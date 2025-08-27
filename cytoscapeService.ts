// cytoscapeService.ts
import cytoscape, { Core, EventObject, NodeSingular, EdgeSingular, ElementDefinition, NodeCollection, LayoutOptions as CyLayoutOptions, StylesheetCSS } from 'cytoscape';
import { 
    cyContainer, nodeLabelModeSelector, searchTextElem, detailsPanel, addEdgeButton,
    loadLayoutButton, clearLayoutButton, saveLayoutButton
} from './dom.js';
import { CyNodeData, CyEdgeData, CyElementDefinition, DPType } from './types.js';
import { dynamicLayoutOptions, maxLabelLength, directedPredicates, undirectedPredicates, predicateColors, predicateSyntax, predicatePhrasing, symmetricPredicatesSet } from './config.js'; // Added predicatePhrasing and symmetricPredicatesSet
import { addError, clearErrors, truncateText, getComputedCssVar, hashStringToColor, formatTextWithReferences, extractDisplayableTextFromReferences } from './utils.js'; // Added formatTextWithReferences & extractDisplayableTextFromReferences
import { showManualTooltip, hideManualTooltip } from './tooltip.js';
import { updateDetailsPanel, hideDetailsPanel, updateDetailsPanelVisibility } from './detailsPanelService.js';
import { saveNodeLabelModeSetting, saveSelectedNodeId, saveNodePositions, loadNodePositions as loadNodePositionsFromPersistence, saveCurrentLayoutName } from './persistenceService.js';
import { 
    isEditModeActive, setupDetailsPanelForEditMode, getEdgeCreationStatus, 
    handleTargetNodeSelectedForEdge, cancelAddEdgeMode, setEdgeCreationStatus,
    getPendingEdgeTargetNodeId, getPendingEdgeSourceNodeId,
    showConfirmEdgeUIToExistingNode
} from './editModeService.js';
import { highlightSunburstNode } from './sunburstService.js';


let cy: Core | null = null;
export type NodeLabelMode = 'full' | 'truncated' | 'none';
let currentNodeLabelMode: NodeLabelMode = 'truncated'; // Default
let currentLayoutName: string = 'coseDefault'; 
let savedNodePositions: Map<string, { x: number; y: number }> | null = null;


// For selected node persistence
let nodeIdToPersistAfterDelay: string | null = null;
let selectedNodePersistenceTimer: number | null = null;
const NODE_SELECTION_PERSISTENCE_DELAY = 60 * 1000; // 1 minute

// Flag to coordinate tap-to-select-edge-target and the subsequent 'select' event
let anEdgeTargetWasJustSelectedViaTap: boolean = false;

// For placing newly added nodes
let pendingNewNodePlacement: { nodeId: string; position: { x: number; y: number } } | null = null;

// Build a reverse lookup map from the predicateSyntax config for efficient parsing
export const syntaxMap = new Map<string, { canonical: string; type: 'incoming' | 'outgoing' | 'symmetric' }>();
for (const canonical in predicateSyntax) {
    const syntaxes = predicateSyntax[canonical as keyof typeof predicateSyntax];
    if (syntaxes.incoming) {
        syntaxes.incoming.forEach(s => syntaxMap.set(s, { canonical, type: 'incoming' }));
    }
    if (syntaxes.outgoing) {
        syntaxes.outgoing.forEach(s => syntaxMap.set(s, { canonical, type: 'outgoing' }));
    }
    if (syntaxes.symmetric) {
        syntaxes.symmetric.forEach(s => syntaxMap.set(s, { canonical, type: 'symmetric' }));
    }
}


export function setPendingNewNodePlacement(nodeId: string, position: { x: number; y: number }): void {
    pendingNewNodePlacement = { nodeId, position };
}

export interface InitializeCytoscapeOptions {
    preventRemoteClearSelection?: boolean;
    retainSelectedNodeId?: string | null;
    viewportToRetain?: {
        zoom?: number;
        pan?: { x: number; y: number };
    };
}

export function getSelectedNode(): NodeSingular | null {
    if (cy && cy.$('node:selected').length > 0) {
        return cy.$('node:selected')[0] as NodeSingular;
    }
    return null;
}

function updateNodeDataLabels(cyInstance: Core | null = cy) {
    if (!cyInstance) return;
    cyInstance.batch(() => {
        cyInstance.nodes().forEach((node: NodeSingular) => {
            const nodeData = node.data() as CyNodeData;
            if (nodeData) {
                switch (currentNodeLabelMode) {
                    case 'full':
                        node.data('label', nodeData.fullLabelText);
                        break;
                    case 'truncated':
                        node.data('label', nodeData.truncatedLabel);
                        break;
                    case 'none':
                        node.data('label', ''); // Set label to empty for 'none' mode
                        break;
                }
            }
        });
    });
}


export function getCyStylesheet(): StylesheetCSS[] {
    const nodeBorderColor = getComputedCssVar('--node-border-color');
    const nodeTextColor = getComputedCssVar('--node-text-color');
    const searchedNodeBorderColor = getComputedCssVar('--searched-node-border-color');
    const selectedNodeBorderColor = getComputedCssVar('--selected-node-border-color');
    const edgeLabelTextColor = getComputedCssVar('--edge-label-text-color');
    const defaultNodeBgColor = getComputedCssVar('--node-bg-color');
    const searchedNodeBgColorFromVar = getComputedCssVar('--searched-node-bg-color');
    const graphBgColor = getComputedCssVar('--graph-bg-color'); // For edge label outline

    const defaultNodeBorderWidth = '2px';
    const circleNodeBorderWidth = '3px'; // Thicker border for circles

    let nodeSpecificStyles: any = {};
    let edgeLabelVisibilityStyles: any = {}; 
    let searchedNodeBgStyle: any;
    let currentActualNodeBorderWidth = defaultNodeBorderWidth;


    switch (currentNodeLabelMode) {
        case 'full':
        case 'truncated':
            nodeSpecificStyles = {
                'shape': 'round-rectangle',
                'width': 'label', 'height': 'label',
                'padding-top': '2px',       // Reduced vertical padding
                'padding-bottom': '2px',    // Reduced vertical padding
                'padding-left': '8px',      // Keep horizontal padding as before
                'padding-right': '8px',     // Keep horizontal padding as before
                'background-color': defaultNodeBgColor,
                'text-opacity': 1
            };
            edgeLabelVisibilityStyles = { 
                'text-opacity': 1,
            };
            searchedNodeBgStyle = searchedNodeBgColorFromVar;
            currentActualNodeBorderWidth = defaultNodeBorderWidth;
            break;
        case 'none':
            nodeSpecificStyles = {
                'shape': 'ellipse', 
                'width': '25px', 'height': '25px', // Reverted to 25px
                'padding': '0px', 
                'background-color': (ele: NodeSingular) => hashStringToColor(ele.id()), 
                'text-opacity': 0 
            };
            edgeLabelVisibilityStyles = { 
                'label': '', 
                'text-opacity': 0,
            };
            searchedNodeBgStyle = (ele: NodeSingular) => hashStringToColor(ele.id());
            currentActualNodeBorderWidth = circleNodeBorderWidth;
            break;
    }

    return [
        { selector: 'node', css: {
            'border-color': nodeBorderColor,
            'border-width': currentActualNodeBorderWidth, 
            'label': 'data(label)', 
            'text-valign': 'center', 'text-halign': 'center',
            'font-size': '10px',
            'color': nodeTextColor,
            'text-wrap': 'wrap', 'text-max-width': '100px',
            ...nodeSpecificStyles 
        }},
        { selector: 'edge', css: {
            'width': 1.5,
            'line-color': 'data(color)',
            'line-opacity': 1, 
            'target-arrow-opacity': 1, 
            'curve-style': 'bezier',
            'font-size': '9px',
            'color': edgeLabelTextColor, 
            'text-outline-width': '2px', 
            'text-outline-color': graphBgColor, 
            'text-rotation': 'autorotate',
            'label': (ele: EdgeSingular): string => {
                const predicate = ele.data('label');
                if (!predicate) return '';
        
                const phrasing = predicatePhrasing[predicate] || predicatePhrasing.default;
        
                if (symmetricPredicatesSet.has(predicate)) {
                    return phrasing.symmetric || predicate;
                }
                // For directed edges, use the "outgoing" phrasing as it describes the action from source to target.
                return phrasing.outgoing || predicate;
            },
            ...edgeLabelVisibilityStyles 
        }},
        { selector: 'edge[direction = "directed"]', css: { 'target-arrow-shape': 'triangle', 'target-arrow-color': 'data(color)' as any }},
        { selector: 'edge[direction = "undirected"]', css: { 'line-style': 'dashed' }},
        { selector: '.searched', css: {
            'background-color': searchedNodeBgStyle,
            'border-color': searchedNodeBorderColor,
            'border-width': currentActualNodeBorderWidth, 
            'font-weight': currentNodeLabelMode === 'none' ? 'normal' : 'bold',
        }},
        { selector: 'node:selected', css: {
            'border-color': selectedNodeBorderColor,
            'border-width': currentActualNodeBorderWidth, 
        }},
        { selector: '.faded-edge', css: { 
            'line-opacity': 0.3,
            'target-arrow-opacity': 0.3,
        }}
    ];
}

export function parseInputAndGetElements(text: string): CyElementDefinition[] {
    clearErrors();
    if (!text || text.trim() === "") {
        return [];
    }
    const lines: string[] = text.split('\n');
    const elements: CyElementDefinition[] = [];
    const dpMap: Map<string, boolean> = new Map();
    const parseWarnings: string[] = [];

    const dpRegex = /^DP([\w-]+)(?:\.([a-zA-Z]+))?:\s*(.*?)(?:\s*#\s*(.*))?$/;
    const connectionRegex = /^\(DP([\w-]+)(?:\.[a-zA-Z]+)?\s+(\w+)\s+DP([\w-]+)(?:\.[a-zA-Z]+)?\)(?::\s*(.*?))?$/;

    lines.forEach((line: string, index: number) => {
        line = line.trim();
        if (line === '') return;

        // More robust comment handling: a line starting with '#' is only a comment if it doesn't match DP/Connection formats.
        if (line.startsWith('#') && !line.match(dpRegex) && !line.match(connectionRegex)) return;


        let definitionPart = line;
        let commentPart = '';
        const commentIndex = line.indexOf('#');
        if (commentIndex > 0 && (line[commentIndex - 1] === ' ' || line[commentIndex - 1] === ')')) {
            definitionPart = line.substring(0, commentIndex).trim();
            commentPart = line.substring(commentIndex + 1).trim();
        }

        const dpMatch = definitionPart.match(dpRegex);
        if (dpMatch) {
            const id = dpMatch[1];
            const typeString = dpMatch[2]?.toLowerCase();
            const rawDpTextOriginal = dpMatch[3].trim();
            const nodeCommentOriginal = (dpMatch[4] ? dpMatch[4].trim() : '') || commentPart;


            let type: DPType = 'unspecified';
            if (typeString && ['statement', 'question', 'argument', 'reference'].includes(typeString)) {
                type = typeString as DPType;
            } else if (typeString) {
                parseWarnings.push(`Invalid DP type "${dpMatch[2]}" for DP${id} at line ${index + 1}. Treating as unspecified.`);
            }


            if (dpMap.has(id)) {
                parseWarnings.push(`Duplicate DP ID "${id}" at line ${index + 1}. Keeping first occurrence.`);
                return;
            }

            const displayableDpText = extractDisplayableTextFromReferences(rawDpTextOriginal);
            const displayableNodeComment = extractDisplayableTextFromReferences(nodeCommentOriginal);


            const shortLabel = `DP${id}`;
            const fullLabelText = `${shortLabel}: ${displayableDpText}`;
            const truncatedLabel = `${shortLabel}: ${truncateText(displayableDpText, maxLabelLength)}`;
            
            const typeDisplay = type.charAt(0).toUpperCase() + type.slice(1);
            let tooltipContent = `<b>${shortLabel}</b> (Type: ${typeDisplay})<br>${formatTextWithReferences(rawDpTextOriginal)}`;
            if (nodeCommentOriginal) {
                tooltipContent += `<br><hr><i>Comment: ${formatTextWithReferences(nodeCommentOriginal)}</i>`;
            }
            
            let initialLabelValue = '';
            switch (currentNodeLabelMode) {
                case 'full': initialLabelValue = fullLabelText; break;
                case 'truncated': initialLabelValue = truncatedLabel; break;
                case 'none': initialLabelValue = ''; break;
            }

            elements.push({
                group: 'nodes',
                data: {
                    id: id, 
                    rawText: rawDpTextOriginal,
                    comment: nodeCommentOriginal,
                    shortLabel,
                    fullLabelText,
                    truncatedLabel,
                    label: initialLabelValue,
                    tooltipContent,
                    type: type
                } as CyNodeData
            });
            dpMap.set(id, true);
            return;
        }

        const connectionMatch = definitionPart.match(connectionRegex);
        if (connectionMatch) {
            const subjectId = connectionMatch[1];
            const predicatePhrase = connectionMatch[2];
            const objectId = connectionMatch[3];
            const contextualTextRaw = connectionMatch[4]?.trim() || undefined;
            const edgeCommentRaw = commentPart;

            const syntaxInfo = syntaxMap.get(predicatePhrase);

            if (!syntaxInfo) {
                parseWarnings.push(`Unknown predicate phrase "${predicatePhrase}" at line ${index + 1}. Assuming directed, using phrase as label.`);
                // Fallback for unknown predicates
                elements.push({
                    group: 'edges',
                    data: {
                        id: `e_${subjectId}_${predicatePhrase}_${objectId}_${Math.random().toString(16).slice(2)}`,
                        source: subjectId,
                        target: objectId,
                        label: predicatePhrase,
                        color: predicateColors.default,
                        comment: edgeCommentRaw,
                        direction: 'directed',
                        tooltipContent: `<b>${predicatePhrase}</b>` + (edgeCommentRaw ? `<br><hr><i>Comment: ${formatTextWithReferences(edgeCommentRaw)}</i>` : ''),
                        subjectContextualText: contextualTextRaw
                    } as CyEdgeData
                });
                return;
            }

            const { canonical: finalPredicate, type } = syntaxInfo;
            let finalSourceId = subjectId;
            let finalTargetId = objectId;

            if (type === 'incoming') {
                [finalSourceId, finalTargetId] = [objectId, subjectId];
            } else if (type === 'symmetric') {
                // Ensure consistent ordering for symmetric predicates to avoid duplicates
                if (subjectId > objectId) {
                    [finalSourceId, finalTargetId] = [objectId, subjectId];
                }
            }
            // 'outgoing' type is the default where subject is source, object is target.

            let direction: 'directed' | 'undirected' | 'none' = 'none';
            if (directedPredicates.has(finalPredicate)) direction = 'directed';
            else if (undirectedPredicates.has(finalPredicate)) direction = 'undirected';
            
            const phrasing = predicatePhrasing[finalPredicate] || predicatePhrasing.default;
            let displayPredicate = finalPredicate;
            if (symmetricPredicatesSet.has(finalPredicate)) {
                displayPredicate = phrasing.symmetric || finalPredicate;
            } else {
                displayPredicate = phrasing.outgoing || finalPredicate;
            }

            let edgeTooltip = `<b>${displayPredicate}</b>`;
            if (edgeCommentRaw) {
                edgeTooltip += `<br><hr><i>Comment: ${formatTextWithReferences(edgeCommentRaw)}</i>`;
            }

            let subjectContextualText: string | undefined;
            let objectContextualText: string | undefined;
            if (contextualTextRaw) {
                const parts = contextualTextRaw.split(' :/: ');
                if (parts.length === 2) {
                    const textForDpS = parts[0].trim();
                    const textForDpO = parts[1].trim();
                    if (finalSourceId === subjectId) { // No swap
                        subjectContextualText = textForDpS;
                        objectContextualText = textForDpO;
                    } else { // Swapped
                        subjectContextualText = textForDpO;
                        objectContextualText = textForDpS;
                    }
                } else {
                    // old format, only one text provided. This is for the grammatical subject (DP_S).
                    const textForDpS = contextualTextRaw.trim();
                    if (finalSourceId === subjectId) {
                        subjectContextualText = textForDpS;
                    } else {
                        // grammatical subject (S) became the logical object (target)
                        objectContextualText = textForDpS;
                    }
                }
            }


            elements.push({
                group: 'edges',
                data: {
                    id: `e_${finalSourceId}_${finalPredicate}_${finalTargetId}_${Math.random().toString(16).slice(2)}`,
                    source: finalSourceId,
                    target: finalTargetId,
                    label: finalPredicate,
                    color: predicateColors[finalPredicate] || predicateColors.default,
                    comment: edgeCommentRaw,
                    direction,
                    tooltipContent: edgeTooltip,
                    subjectContextualText,
                    objectContextualText
                } as CyEdgeData
            });
            return;
        }
        parseWarnings.push(`Skipping invalid line ${index + 1}: "${line}"`);
    });

    const finalElements: CyElementDefinition[] = [];
    const nodeIds = new Set<string>();
    elements.filter(el => el.group === 'nodes').forEach(n => nodeIds.add(n.data.id!));

    elements.forEach(el => {
        if (el.group === 'nodes') finalElements.push(el);
        else if (el.group === 'edges') {
            if (nodeIds.has(el.data.source!) && nodeIds.has(el.data.target!)) {
                finalElements.push(el);
            } else {
                if (!nodeIds.has(el.data.source!)) parseWarnings.push(`Edge references non-existent source DP "${el.data.source}".`);
                if (!nodeIds.has(el.data.target!)) parseWarnings.push(`Edge references non-existent target DP "${el.data.target}".`);
            }
        }
    });
    parseWarnings.forEach(addError);
    return finalElements;
}

async function clearAndSaveSelectedNode(preventRemoteClear: boolean = false): Promise<void> {
    if (selectedNodePersistenceTimer) {
        clearTimeout(selectedNodePersistenceTimer);
        selectedNodePersistenceTimer = null;
    }
    nodeIdToPersistAfterDelay = null;
    if (!preventRemoteClear) {
        await saveSelectedNodeId(null);
    }
}

export function setInitialLayoutState(layoutName: string | null, positions: Map<string, { x: number; y: number }> | null): void {
    currentLayoutName = layoutName || 'coseDefault';
    savedNodePositions = positions;
    updateLayoutButtonUIStates();
}

export async function initializeCytoscape(
    elementsToLoad: CyElementDefinition[], 
    options?: InitializeCytoscapeOptions
): Promise<void> {
    hideManualTooltip();
    anEdgeTargetWasJustSelectedViaTap = false; 
    
    const nodeIdToRetain = options?.retainSelectedNodeId;
    let shouldRestoreViewport = false; 

    return new Promise<void>(async (resolve, reject) => {
        if (!options?.preventRemoteClearSelection && !nodeIdToRetain) {
            await clearAndSaveSelectedNode(); 
        }

        if (cy !== null) {
            cy.destroy();
            cy = null;
        }
        if (cyContainer) cyContainer.innerHTML = '';
        updateDetailsPanelVisibility(); 


        if (!elementsToLoad || elementsToLoad.length === 0) {
            const errorDisplay = document.getElementById('errorDisplay') as HTMLDivElement;
            if (errorDisplay && errorDisplay.innerHTML === '') addError("No valid elements to render from input.");
            resolve(); 
            return;
        }
        
        let initialLayoutConfig: CyLayoutOptions; 

        try {
            cy = cytoscape({
                container: cyContainer,
                elements: elementsToLoad,
                style: getCyStylesheet() as any, 
                wheelSensitivity: 0.2, minZoom: 0.05, maxZoom: 4
            });

            cy.on('mouseover', 'node, edge', (event: EventObject) => showManualTooltip(event.target as NodeSingular | EdgeSingular, event.target.data('tooltipContent')));
            cy.on('mouseout', 'node, edge', hideManualTooltip);
            cy.on('drag', 'node', hideManualTooltip);
            cy.on('zoom pan', () => { hideManualTooltip(); clearSearchHighlights(); });
            
            cy.on('select', 'node', (evt: EventObject) => {
                const newlySelectedNode = evt.target as NodeSingular;
                const cyInstance = evt.cy; // Use the cytoscape instance from the event

                const currentEdgeOpStatus = getEdgeCreationStatus();
                const currentSourceNodeId = getPendingEdgeSourceNodeId();
                const currentTargetNodeId = getPendingEdgeTargetNodeId();

                console.log(`Select event for DP${newlySelectedNode.id()}. EdgeOpStatus: ${currentEdgeOpStatus}, Source: ${currentSourceNodeId}, Target: ${currentTargetNodeId}, anEdgeTargetWasJustSelectedViaTap: ${anEdgeTargetWasJustSelectedViaTap}`);
            
                // Handle edge creation mode specific logic first
                if (currentEdgeOpStatus !== 'idle' && currentSourceNodeId && cyInstance) {
                    const sourceNodeCy = cyInstance.getElementById(currentSourceNodeId);
            
                    if (newlySelectedNode.id() === currentSourceNodeId) {
                        // If source node is re-selected during an edge op, ensure it remains selected and update panel
                        if (sourceNodeCy.length > 0 && !sourceNodeCy.selected()) sourceNodeCy.select(); 
                        updateDetailsPanel(newlySelectedNode);
                        // Fading logic will run after this block if we don't return
                    } else if (currentEdgeOpStatus === 'target_selected_pending_confirmation' &&
                               newlySelectedNode.id() === currentTargetNodeId &&
                               anEdgeTargetWasJustSelectedViaTap) {
                        // This case is for when the target was just tapped and now confirmed by selection event
                        anEdgeTargetWasJustSelectedViaTap = false; 
                        if (sourceNodeCy.length > 0 && !sourceNodeCy.selected()) {
                            sourceNodeCy.select(); 
                        }
                        showConfirmEdgeUIToExistingNode(sourceNodeCy, newlySelectedNode);
                        return; // Return early to prevent general select logic from overriding UI
                    } else { 
                        // Illegal selection during an active edge operation (not source, not confirmed target)
                        console.log(`Illegal selection of DP${newlySelectedNode.id()} during edge op. Reverting.`);
                        if (newlySelectedNode.selected()) { 
                            newlySelectedNode.unselect();
                        }
                        if (sourceNodeCy.length > 0 && !sourceNodeCy.selected()) {
                            sourceNodeCy.select();
                        }
                        return; // Return early
                    }
                }
            
                // Apply edge fading (new strategy: fade all, then unfade connected)
                if (cyInstance) {
                    cyInstance.edges().addClass('faded-edge'); // Fade ALL edges
                    if (newlySelectedNode && newlySelectedNode.length > 0 && newlySelectedNode.isNode()) {
                        newlySelectedNode.connectedEdges().removeClass('faded-edge'); // Un-fade edges connected to the selected node
                    }
                }

                updateDetailsPanel(newlySelectedNode);
                highlightSunburstNode(newlySelectedNode.id());

                if (addEdgeButton) {
                    addEdgeButton.disabled = !isEditModeActive(); 
                }
            
                if (selectedNodePersistenceTimer) {
                    clearTimeout(selectedNodePersistenceTimer);
                }
                nodeIdToPersistAfterDelay = newlySelectedNode.id();
                selectedNodePersistenceTimer = window.setTimeout(async () => {
                    const freshCy = getCyInstance();
                    if (freshCy && freshCy.$('node:selected').length === 1 && freshCy.$('node:selected').id() === nodeIdToPersistAfterDelay) {
                        console.log(`Persisting selected node ID after delay: ${nodeIdToPersistAfterDelay}`);
                        await saveSelectedNodeId(nodeIdToPersistAfterDelay);
                    } else {
                        console.log(`Selection changed or cleared during persistence timeout for ${nodeIdToPersistAfterDelay}. Not saving.`);
                    }
                    selectedNodePersistenceTimer = null;
                }, NODE_SELECTION_PERSISTENCE_DELAY);
            });
            
            cy.on('unselect', 'node', async (evt: EventObject) => {
                const unselectedNodesCollection = evt.target as NodeCollection;
                if (unselectedNodesCollection.empty()) return;
                const unselectedNode = unselectedNodesCollection[0];
                const cyInstance = evt.cy; // Use event's cy instance
            
                const currentEdgeOpStatus = getEdgeCreationStatus();
                const currentSourceNodeId = getPendingEdgeSourceNodeId(); 
                console.log(`Unselect event for DP${unselectedNode.id()}. EdgeOpStatus: ${currentEdgeOpStatus}, Source (from editMode): ${currentSourceNodeId}`);
            
                if (currentEdgeOpStatus !== 'idle' && unselectedNode.id() === currentSourceNodeId) {
                    console.log(`Source node DP${currentSourceNodeId} unselected during ACTIVE edge op (${currentEdgeOpStatus}). Re-selecting.`);
                    setTimeout(() => {
                        const currentCyInstance = getCyInstance();
                        if (currentCyInstance && currentSourceNodeId) {
                            const nodeToReselect = currentCyInstance.getElementById(currentSourceNodeId);
                            if (nodeToReselect.length > 0 && nodeToReselect.isNode() && !nodeToReselect.removed()) {
                                if (!nodeToReselect.selected()) { 
                                    nodeToReselect.select();
                                }
                            }
                        }
                    }, 0);
                    return; 
                }
            
                // Delayed logic to handle cases where unselect is part of a direct reselect
                setTimeout(async () => {
                    const currentCy = getCyInstance(); // Get fresh instance at the time of execution
                    if (!currentCy) return;

                    if (currentCy.$('node:selected').length === 0 && getEdgeCreationStatus() === 'idle') {
                        console.log("Unselect (delayed): All nodes are unselected AND edge op is idle. Hiding details and unfading edges.");
                        hideDetailsPanel();
                        highlightSunburstNode(null);
                        await clearAndSaveSelectedNode(); // This function already saves null for the active slot
                        currentCy.edges().removeClass('faded-edge');
                    } else if (currentCy.$('node:selected').length > 0) {
                        // If another node is now selected, the 'select' handler for that node would have already set the edge fading.
                        // So, this unselect handler for the *previous* node doesn't need to touch edge fading.
                        console.log(`Unselect (delayed): Another node (DP${currentCy.$('node:selected').id()}) is selected. Fading handled by its select event.`);
                    } else if (getEdgeCreationStatus() !== 'idle') {
                        // No node selected, but an edge operation is still technically active (e.g., UI panel open, but user clicked away)
                        console.log(`Unselect (delayed): No nodes selected, but edge op status is '${getEdgeCreationStatus()}'. Not unfading edges. Edge op UI might still need cleanup.`);
                    }
                }, 0); // A timeout of 0ms pushes execution to the end of the event queue
            });

            cy.on('tap', async (event: EventObject) => {
                const target = event.target;
                const currentStatus = getEdgeCreationStatus();
                const tappedNodeId = (target && target.isNode && target.isNode()) ? target.id() : null;
                const currentGlobalSourceId = getPendingEdgeSourceNodeId(); 
                const currentCy = event.cy; // Use event's cy instance
                if (!currentCy) return;
            
                console.log(`Tap event. Target: ${target === cy ? 'background' : tappedNodeId || 'non-node'}. EdgeOpStatus: ${currentStatus}, GlobalSource: ${currentGlobalSourceId}`);
            
                if (currentStatus === 'pending_new_node_input' || currentStatus === 'target_selected_pending_confirmation') {
                    const sourceNodeForUICancel = currentGlobalSourceId; 
                    
                    if (target === cy) { 
                        console.log(`Tap: Background tap during UI-driven edge op (${currentStatus}). IGNORING for state change. Original source DP${sourceNodeForUICancel}.`);
                        if (sourceNodeForUICancel) {
                            const nodeToKeepSelected = currentCy.getElementById(sourceNodeForUICancel);
                            if (nodeToKeepSelected.length > 0 && nodeToKeepSelected.isNode() && !nodeToKeepSelected.removed()) {
                                setTimeout(() => { 
                                    if (!nodeToKeepSelected.selected()) {
                                        console.log(`Tap->setTimeout: Re-affirming selection of source DP${sourceNodeForUICancel} after ignored background tap.`);
                                        nodeToKeepSelected.select();
                                    }
                                }, 0);
                            }
                        }
                    } else if (tappedNodeId && tappedNodeId === sourceNodeForUICancel) {
                        console.log(`Tap: Source node DP${sourceNodeForUICancel} tapped during UI-driven edge op. No state change, ensuring it remains selected.`);
                        const sourceNodeCy = currentCy.getElementById(sourceNodeForUICancel);
                        if (sourceNodeCy.length > 0 && !sourceNodeCy.selected()) {
                            sourceNodeCy.select(); 
                        }
                    } else { 
                        console.log(`Tap: Other element tapped during UI-driven edge op. Selection lock (via 'select' handler) should prevent change. Ensuring original source DP${sourceNodeForUICancel} remains selected.`);
                        if (sourceNodeForUICancel) {
                            const sourceNodeCy = currentCy.getElementById(sourceNodeForUICancel);
                            if (sourceNodeCy.length > 0 && !sourceNodeCy.selected()) {
                                sourceNodeCy.select();
                            }
                        }
                    }
                    return; 
                }
            
                if (currentStatus === 'source_selected_pending_target' && currentGlobalSourceId) {
                    if (target === cy) { 
                        console.log(`Tap: Background tap during target selection for source DP${currentGlobalSourceId}. Cancelling addEdgeMode.`);
                        cancelAddEdgeMode(); 
                        const nodeToKeepSelected = currentCy.getElementById(currentGlobalSourceId);
                        if (nodeToKeepSelected.length > 0 && nodeToKeepSelected.isNode() && !nodeToKeepSelected.removed()) {
                             setTimeout(() => {
                                if (!nodeToKeepSelected.selected()) {
                                    console.log(`Tap->setTimeout: Re-selecting source DP${currentGlobalSourceId} after background tap cancellation (target selection mode).`);
                                    nodeToKeepSelected.select();
                                }
                            }, 0);
                        }
                    } else if (tappedNodeId) {
                        if (tappedNodeId !== currentGlobalSourceId) {
                            console.log(`Tap: Node DP${tappedNodeId} tapped as potential target for source DP${currentGlobalSourceId}.`);
                            if (handleTargetNodeSelectedForEdge(target as NodeSingular)) {
                                anEdgeTargetWasJustSelectedViaTap = true;
                            }
                        } else {
                             console.log(`Tap: Source node DP${currentGlobalSourceId} tapped during target selection. No-op.`);
                             const sourceNodeCy = currentCy.getElementById(currentGlobalSourceId);
                             if (sourceNodeCy.length > 0 && !sourceNodeCy.selected()) sourceNodeCy.select();
                        }
                    }
                    if (!anEdgeTargetWasJustSelectedViaTap) {
                        const sourceNodeCy = currentCy.getElementById(currentGlobalSourceId);
                        if (sourceNodeCy.length > 0 && !sourceNodeCy.selected()) {
                            console.log(`Tap: Ensuring source node DP${currentGlobalSourceId} remains selected during target selection phase (no target chosen yet or source tapped).`);
                            sourceNodeCy.select();
                        }
                    }
                    return; 
                }
            
                if (target === cy && currentStatus === 'idle') {
                    console.log("Tap: Background tap when idle. Unselecting all.");
                    currentCy.$('node:selected').unselect(); 
                }
            });
            
            const layoutCompletionPromise = new Promise<void>(async (layoutResolve, layoutReject) => {
                if (currentLayoutName === 'saved_layout' && savedNodePositions && savedNodePositions.size > 0) {
                    if (options?.viewportToRetain && options.viewportToRetain.zoom !== undefined && options.viewportToRetain.pan) {
                        console.log("[InitializeCytoscape] Using 'saved_layout' with preset positions and WILL RESTORE viewport (fit: false for preset).");
                        initialLayoutConfig = {
                            name: 'preset',
                            positions: (n: any) => savedNodePositions!.get(n.id()) || { x: 0, y: 0 },
                            fit: false, 
                            padding: 30,
                            animate: false
                        };
                        shouldRestoreViewport = true;
                    } else {
                        console.log("[InitializeCytoscape] Using 'saved_layout' with preset positions and WILL FIT (fit: true for preset).");
                        initialLayoutConfig = {
                            name: 'preset',
                            positions: (n: any) => savedNodePositions!.get(n.id()) || { x: 0, y: 0 },
                            fit: true, 
                            padding: 30,
                            animate: false
                        };
                    }
                } else {
                     initialLayoutConfig = dynamicLayoutOptions[currentLayoutName] || dynamicLayoutOptions['coseDefault'];
                     if (currentLayoutName === 'saved_layout' && (!savedNodePositions || savedNodePositions.size === 0)) {
                        console.warn("[InitializeCytoscape] Initial layout was 'saved_layout' but no positions found or empty. Falling back to coseDefault.");
                        currentLayoutName = 'coseDefault'; 
                        await saveCurrentLayoutName(currentLayoutName);
                        initialLayoutConfig = dynamicLayoutOptions['coseDefault'];
                    } else {
                        console.log(`[InitializeCytoscape] Using dynamic layout: ${currentLayoutName}`);
                    }
                }

                const layout = cy!.layout(initialLayoutConfig);
                if (layout && typeof layout.run === 'function') {
                    layout.one('layoutstop', () => {
                        console.log(`[InitializeCytoscape] Initial layout '${initialLayoutConfig.name}' completed (layoutstop event).`);
                        layoutResolve();
                    });
                    layout.run();
                } else { 
                    console.warn("[InitializeCytoscape] Layout or layout.run() not available. Resolving layout promise immediately.");
                    layoutResolve();
                }
            });

            await layoutCompletionPromise;
            updateLayoutButtonUIStates();

            if (shouldRestoreViewport && options?.viewportToRetain && options.viewportToRetain.zoom !== undefined && options.viewportToRetain.pan) {
                console.log("[InitializeCytoscape] Restoring captured viewport for 'saved_layout' after layout stop.", options.viewportToRetain);
                cy?.viewport({
                    zoom: options.viewportToRetain.zoom,
                    pan: options.viewportToRetain.pan
                });
            } else if (initialLayoutConfig && 'fit' in initialLayoutConfig && initialLayoutConfig.fit !== true) {
                console.log("[InitializeCytoscape] Fitting graph as viewport was not restored and layout did not specify fit:true.", initialLayoutConfig);
                cy?.fit(undefined, 30);
            } else {
                 console.log("[InitializeCytoscape] Viewport not restored or layout already handled fitting.");
            }

            if (pendingNewNodePlacement && cy) {
                const newNodeToPosition = cy.getElementById(pendingNewNodePlacement.nodeId) as NodeSingular;
                if (newNodeToPosition.length > 0 && newNodeToPosition.isNode()) {
                    console.log(`[InitializeCytoscape] Applying pending placement for new node DP${pendingNewNodePlacement.nodeId} at`, pendingNewNodePlacement.position);
                    newNodeToPosition.position(pendingNewNodePlacement.position);
                }
                pendingNewNodePlacement = null; 
            }


            if (nodeIdToRetain && cy) {
                const nodeToReselect = cy.getElementById(nodeIdToRetain) as NodeSingular;
                if (nodeToReselect && nodeToReselect.length > 0 && nodeToReselect.isNode()) {
                    console.log(`Re-selecting and centering node after re-render: ${nodeIdToRetain}`);
                    
                    const status = getEdgeCreationStatus();
                    // Rewritten logic for shouldReselectNode for clarity and to address the TypeScript error context
                    const shouldReselectNode = (status === 'idle') || 
                                               (status === 'target_selected_pending_confirmation' && !anEdgeTargetWasJustSelectedViaTap);

                    if (shouldReselectNode) {
                        nodeToReselect.select(); 
                        if (!shouldRestoreViewport) { 
                             centerOnNode(nodeToReselect);
                        }
                        if (!options?.preventRemoteClearSelection) { 
                           await saveSelectedNodeId(nodeIdToRetain);
                        }
                    }
                } else {
                     if (getSelectedNode()?.id() === nodeIdToRetain) { 
                        hideDetailsPanel();
                        if (!options?.preventRemoteClearSelection) await saveSelectedNodeId(null);
                        if (cy) cy.edges().removeClass('faded-edge'); 
                    }
                }
            } else if (cy && cy.$('node:selected').length === 0) {
                hideDetailsPanel();
                if (!options?.preventRemoteClearSelection) await saveSelectedNodeId(null);
                cy.edges().removeClass('faded-edge'); 
            }
            
            resolve(); 

        } catch (renderError: any) {
            addError(`Graph Rendering Error: ${renderError.message}`);
            console.error("Graph Rendering Error:", renderError);
            reject(renderError); 
        }
    });
}

export async function applyLayout(layoutNameKey: string): Promise<void> {
    if (!cy) return;
    hideManualTooltip();
    cy.stop(); 

    const wasSavedLayoutActiveBeforeClick = currentLayoutName === 'saved_layout';

    if (layoutNameKey === 'saved_layout') {
        let positionsToApply = savedNodePositions;

        if (!positionsToApply) {
            console.log("[ApplyLayout] In-memory savedNodePositions is null, attempting to load from persistence...");
            const positionsFromStore = await loadNodePositionsFromPersistence();
            if (positionsFromStore && positionsFromStore.size > 0) {
                console.log("[ApplyLayout] Loaded positions from store. Count:", positionsFromStore.size);
                positionsToApply = positionsFromStore;
                savedNodePositions = positionsFromStore; 
            } else {
                const msg = "No saved layout data found or data is empty after attempting load. Applying default layout.";
                addError(msg);
                console.warn(`[ApplyLayout] ${msg}`);
                await applyLayout('coseDefault'); 
                return;
            }
        } else {
            console.log("[ApplyLayout] Using in-memory savedNodePositions. Count:", positionsToApply.size);
        }

        if (positionsToApply && positionsToApply.size > 0) {
            console.log(`[ApplyLayout] Applying 'saved_layout' by directly setting ${positionsToApply.size} node positions.`);
            
            let capturedZoom: number | undefined;
            let capturedPan: { x: number, y: number } | undefined;

            if (wasSavedLayoutActiveBeforeClick) {
                capturedZoom = cy.zoom();
                capturedPan = cy.pan();
                console.log(`[ApplyLayout] Current layout was 'saved_layout'. Capturing viewport: zoom=${capturedZoom}, pan=${JSON.stringify(capturedPan)}`);
            } else {
                console.log(`[ApplyLayout] Current layout was '${currentLayoutName}'. Will fit after applying positions.`);
            }
            
            const firstNodeId = positionsToApply.keys().next().value;
            if (firstNodeId && cy.getElementById(firstNodeId).length > 0) {
                const sampleNode = cy.getElementById(firstNodeId) as NodeSingular;
                console.log(`[ApplyLayout-Compare] Sample Node DP${firstNodeId}:`);
                console.log(`  Current Position Before Apply: ${JSON.stringify(sampleNode.position())}`);
                console.log(`  Target Saved Position:         ${JSON.stringify(positionsToApply.get(firstNodeId))}`);
            }

            cy.batch(() => {
                cy!.nodes().forEach(node => {
                    const savedPos = positionsToApply!.get(node.id());
                    if (savedPos) {
                        node.position(savedPos);
                    }
                });
            });
            
            if (firstNodeId && cy.getElementById(firstNodeId).length > 0) {
                const sampleNodeAfter = cy.getElementById(firstNodeId) as NodeSingular;
                console.log(`  Current Position After Apply:  ${JSON.stringify(sampleNodeAfter.position())}`);
            }

            if (wasSavedLayoutActiveBeforeClick && capturedZoom !== undefined && capturedPan !== undefined) {
                cy.viewport({
                    zoom: capturedZoom,
                    pan: capturedPan
                });
                console.log("[ApplyLayout] Finished applying saved positions and restored viewport (as current layout was 'saved_layout').");
            } else {
                cy.fit(undefined, 30); 
                console.log("[ApplyLayout] Finished applying saved positions and fitted graph (as current layout was not 'saved_layout').");
            }
            currentLayoutName = 'saved_layout';
        } else {
            const msg = "Saved layout data is missing or empty even after attempting load. Applying default layout.";
            addError(msg);
            console.warn(`[ApplyLayout] ${msg}`);
            await applyLayout('coseDefault'); 
            return; 
        }
    } else if (dynamicLayoutOptions[layoutNameKey]) {
        console.log(`[ApplyLayout] Applying dynamic layout: ${layoutNameKey}`);
        const layout = cy.layout(dynamicLayoutOptions[layoutNameKey]);
        if (layout && typeof layout.run === 'function') {
            layout.one('layoutstop', () => { 
                console.log(`[ApplyLayout] Dynamic layout '${layoutNameKey}' completed (layoutstop). Fitting graph.`);
                cy?.fit(undefined, 30); 
            });
            layout.run();
        }
        currentLayoutName = layoutNameKey;
    } else {
        console.warn(`[ApplyLayout] Layout ${layoutNameKey} not found.`);
        return;
    }
    
    await saveCurrentLayoutName(currentLayoutName);
    updateLayoutButtonUIStates();
    console.log(`[ApplyLayout] Applied and saved current layout name: ${currentLayoutName}.`);
}


export async function saveCurrentNodesLayout(): Promise<void> {
    if (!cy) {
        addError("Graph not initialized. Cannot save layout.");
        return;
    }
    const positions = new Map<string, { x: number, y: number }>();
    let sampleNodeLogged = false;
    cy.nodes().forEach(node => {
        const currentPos = node.position();
        positions.set(node.id(), { x: currentPos.x, y: currentPos.y }); 
        if (!sampleNodeLogged && node.id()) { 
             console.log(`[SaveLayout] Saving position for DP${node.id()}: ${JSON.stringify(currentPos)}`);
             sampleNodeLogged = true;
        }
    });

    savedNodePositions = positions;
    await saveNodePositions(savedNodePositions);
    currentLayoutName = 'saved_layout'; 
    await saveCurrentLayoutName(currentLayoutName);
    addError("Current layout saved."); 
    console.log("Saved current node positions. Count:", positions.size);
    updateLayoutButtonUIStates();
}

export async function clearSavedNodesLayout(): Promise<void> {
    savedNodePositions = null;
    await saveNodePositions(null); 
    addError("Saved layout cleared. Applying default layout.");
    console.log("Cleared saved node positions.");
    await applyLayout('coseDefault'); 
    updateLayoutButtonUIStates();
}

function updateLayoutButtonUIStates(): void {
    const hasData = !!savedNodePositions && savedNodePositions.size > 0; 
    if (loadLayoutButton) loadLayoutButton.disabled = !hasData;
    if (clearLayoutButton) clearLayoutButton.disabled = !hasData;

    Object.keys(dynamicLayoutOptions).forEach(key => {
        const button = document.getElementById(`layout${key.charAt(0).toUpperCase() + key.slice(1)}Button`);
        if (button) button.classList.remove('active');
    });
    if (saveLayoutButton) saveLayoutButton.classList.remove('active'); 
    if (loadLayoutButton) loadLayoutButton.classList.remove('active');


    if (currentLayoutName === 'saved_layout' && hasData) {
        if (loadLayoutButton) loadLayoutButton.classList.add('active');
    } else if (dynamicLayoutOptions[currentLayoutName]) {
        const activeButtonId = `layout${currentLayoutName.charAt(0).toUpperCase() + currentLayoutName.slice(1)}Button`;
        const activeButton = document.getElementById(activeButtonId);
        if (activeButton) activeButton.classList.add('active');
    } else if (currentLayoutName === 'coseDefault' || (!hasData && currentLayoutName === 'saved_layout')) { 
         const defaultButton = document.getElementById('layoutDefaultButton');
         if (defaultButton) defaultButton.classList.add('active');
    }
}

export function setDefaultLayoutName(layoutNameKey: string): void {
    if (dynamicLayoutOptions[layoutNameKey] || layoutNameKey === 'saved_layout') {
        currentLayoutName = layoutNameKey;
    }
}

export function clearSearchHighlights(): void {
    if (!cy) return;
    cy.nodes('.searched').removeClass('searched');
}

export function searchNodesAndHighlight(): void {
    if (!cy || !searchTextElem) return;
    clearSearchHighlights();
    const searchTerm = searchTextElem.value.trim().toLowerCase();
    if (searchTerm === '') return;

    const foundNodes = cy.nodes().filter((node: NodeSingular) => {
        const nodeData = node.data() as CyNodeData;
        return (nodeData.fullLabelText?.toLowerCase() || '').includes(searchTerm) ||
               (node.id().toLowerCase() || '').includes(searchTerm) ||
               (nodeData.shortLabel?.toLowerCase() || '').includes(searchTerm);
    });

    if (foundNodes.nonempty()) {
        foundNodes.addClass('searched');
        if (getEdgeCreationStatus() === 'idle') { 
            centerOnNode(foundNodes[0]);
             if (!foundNodes[0].selected()) {
                selectNodeInGraph(foundNodes[0]); 
            }
        }
    } else {
        addError(`Search term "${searchTextElem.value}" not found.`);
    }
}

export async function setNodeLabelModeAndUpdateGraph(mode: NodeLabelMode): Promise<void> {
    currentNodeLabelMode = mode;
    if (cy) {
        updateNodeDataLabels(); 
        cy.style(getCyStylesheet() as any); 
        
        const selectedNode = getSelectedNode();
        if (selectedNode && selectedNode.length > 0 && selectedNode.isNode()) {
            cy.edges().addClass('faded-edge');
            selectedNode.connectedEdges().removeClass('faded-edge');
        } else {
            cy.edges().removeClass('faded-edge');
        }
    }
    if (nodeLabelModeSelector) {
        nodeLabelModeSelector.querySelectorAll('.label-mode-button').forEach(btn => {
            btn.classList.remove('active');
            if ((btn as HTMLButtonElement).dataset.mode === mode) {
                btn.classList.add('active');
            }
        });
    }
    await saveNodeLabelModeSetting(mode);
}

export function setInitialNodeLabelMode(mode: NodeLabelMode | null): void {
    currentNodeLabelMode = mode || 'truncated'; 
    if (nodeLabelModeSelector) { 
        nodeLabelModeSelector.querySelectorAll('.label-mode-button').forEach(btn => {
            btn.classList.remove('active');
            if ((btn as HTMLButtonElement).dataset.mode === currentNodeLabelMode) {
                btn.classList.add('active');
            }
        });
    }
    
    if (cy && cy.nodes().length > 0) {
        updateNodeDataLabels();
        cy.style(getCyStylesheet() as any);
    }
}


export function isCyInitialized(): boolean {
    return cy !== null;
}

export function getCyInstance(): Core | null {
    return cy;
}

export function selectNodeInGraph(node: NodeSingular): void {
    if (!cy || !node) return;
    if (!node.selected()) {
        cy.elements().unselect(); 
        node.select(); 
    }
    highlightSunburstNode(node.id());
}

export function centerOnNode(node: NodeSingular): void {
    if (!cy || !node) return;
    cy.animate({ center: { eles: node }, zoom: cy.zoom() < 1 ? 1.2 : cy.zoom(), duration: 500 });
}

export async function clearGraphElements(): Promise<void> {
    if (cy) {
        cy.elements().remove();
    }
    updateDetailsPanelVisibility();
    await clearAndSaveSelectedNode(); 
}

export function getCurrentLayoutName(): string {
    return currentLayoutName;
}

export function hasSavedLayoutData(): boolean {
    return !!savedNodePositions && savedNodePositions.size > 0; 
}

export function getCurrentNodeLabelMode(): NodeLabelMode {
    return currentNodeLabelMode;
}

export function clearSelectionAndHideDetails(): void {
    if (!cy) return;
    const selected = cy.$('node:selected');
    if (selected.length > 0) {
        // The existing 'unselect' event handler will take care of hiding the panel
        // and unfading edges, so we just need to trigger it.
        selected.unselect();
        console.log("Cleared selection programmatically.");
    } else {
        // If nothing is selected, but panel is somehow visible (e.g. edge creation cancelled), hide it.
        hideDetailsPanel();
    }
    highlightSunburstNode(null);
}