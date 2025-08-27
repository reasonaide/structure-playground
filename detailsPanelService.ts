// detailsPanelService.ts
import { NodeSingular, NodeCollection } from 'cytoscape';
import { 
    detailsPanel, detailsPanelTitle, selectedNodeTextDiv, connectedNodesListDiv,
    detailsNodeEditTextArea, detailsNodeSaveTextButton, detailsNodeDeleteButton, editNodeTextContainer
} from './dom.js';
import { CyNodeData, CyEdgeData, ConnectedNodeInfo, DPType } from './types.js';
import { predicateColors, predicatePhrasing, symmetricPredicatesSet, maxDetailPanelLabelLength } from './config.js';
import { truncateText, getComputedCssVar, getTextColorForBackground, formatTextWithReferences, addError } from './utils.js'; // Added formatTextWithReferences
import { getCyInstance, selectNodeInGraph, centerOnNode, getSelectedNode } from './cytoscapeService.js'; 
import { saveDetailsPanelCollapseState } from './persistenceService.js';
import { isEditModeActive, setupDetailsPanelForEditMode, handleDeleteEdge, initiateAddConnectionToNewNode, handleUpdateConnectionContext } from './editModeService.js';
import { ICON_PLUS, ICON_TRASH, ICON_PENCIL, ICON_CHECK, ICON_AI_SUGGEST, ICON_CANCEL_X } from './icons.js';
import { suggestContextTextsForConnection, suggestSingleContextText, ContextualTextSuggestionContext } from './aiService.js';


let detailsPanelCollapseState: { [groupKey: string]: boolean } = {};
let currentOriginalNodeText: string | null = null;


export function setInitialDetailsPanelCollapseState(initialState: { [key: string]: boolean }): void {
    detailsPanelCollapseState = initialState || {};
}

// Helper to create the "Add to New Node" button
function createAddToNewNodeButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.innerHTML = ICON_PLUS;
    btn.className = 'icon-button add-to-new-node-button';
    btn.title = 'Add connection to a new node';
    btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent details/summary toggle
        initiateAddConnectionToNewNode();
    });
    return btn;
}

// New: Helper to create the editor for an existing connection's context
function createConnectionContextEditor(parentLi: HTMLLIElement, edgeInfo: { sourceId: string, predicate: string, targetId: string, subjectContextualText?: string, objectContextualText?: string }): void {
    // Remove any existing editor first
    const existingEditor = document.querySelector('.connection-context-editor');
    if (existingEditor) {
        existingEditor.remove();
    }

    const cy = getCyInstance();
    if (!cy) return;

    const sourceNode = cy.getElementById(edgeInfo.sourceId);
    const targetNode = cy.getElementById(edgeInfo.targetId);

    if (sourceNode.empty() || targetNode.empty()) {
        addError("Could not find nodes to create context editor.");
        return;
    }

    const sourceData = sourceNode.data() as CyNodeData;
    const targetData = targetNode.data() as CyNodeData;

    const editorDiv = document.createElement('div');
    editorDiv.className = 'connection-context-editor';

    editorDiv.innerHTML = `
        <div class="context-input-group">
            <label for="editor-source-ctx">Contextualised Text for DP${edgeInfo.sourceId} (Subject):</label>
            <div class="input-with-button">
                <input type="text" id="editor-source-ctx" class="editor-source-ctx-input" placeholder="(optional)" value="${edgeInfo.subjectContextualText || ''}">
                <button class="icon-button suggest-source-ctx" title="Suggest context for source node with AI">${ICON_AI_SUGGEST}</button>
            </div>
        </div>
        <div class="context-input-group">
            <label for="editor-target-ctx">Contextualised Text for DP${edgeInfo.targetId} (Object):</label>
            <div class="input-with-button">
                <input type="text" id="editor-target-ctx" class="editor-target-ctx-input" placeholder="(optional)" value="${edgeInfo.objectContextualText || ''}">
                <button class="icon-button suggest-target-ctx" title="Suggest context for target node with AI">${ICON_AI_SUGGEST}</button>
            </div>
        </div>
        <div class="connection-context-editor-actions">
            <button class="icon-button suggest-both-ctx" title="Suggest contextual text for both with AI">${ICON_AI_SUGGEST}</button>
            <div>
                <button class="icon-button confirm-ctx-edit" title="Save changes">${ICON_CHECK}</button>
                <button class="icon-button cancel-ctx-edit" title="Cancel changes">${ICON_CANCEL_X}</button>
            </div>
        </div>
    `;

    parentLi.after(editorDiv);

    const sourceInput = editorDiv.querySelector('.editor-source-ctx-input') as HTMLInputElement;
    const targetInput = editorDiv.querySelector('.editor-target-ctx-input') as HTMLInputElement;

    editorDiv.querySelector('.cancel-ctx-edit')?.addEventListener('click', () => editorDiv.remove());

    editorDiv.querySelector('.confirm-ctx-edit')?.addEventListener('click', () => {
        handleUpdateConnectionContext(edgeInfo.sourceId, edgeInfo.predicate, edgeInfo.targetId, sourceInput.value, targetInput.value);
        editorDiv.remove(); // The graph will re-render, but this provides immediate feedback
    });

    const handleAISuggest = async (side: 'both' | 'subject' | 'object') => {
        const phrasing = predicatePhrasing[edgeInfo.predicate] || predicatePhrasing.default;
        const predicatePhrase = phrasing.outgoing || phrasing.symmetric || edgeInfo.predicate;

        const buttons = [
            editorDiv.querySelector('.suggest-both-ctx'),
            editorDiv.querySelector('.suggest-source-ctx'),
            editorDiv.querySelector('.suggest-target-ctx')
        ].filter(b => b) as HTMLButtonElement[];
        
        const clickedButton = buttons.find(b => b.classList.contains(`suggest-${side}-ctx`)) || buttons[0];
        const originalIcon = clickedButton.innerHTML;

        buttons.forEach(b => b.disabled = true);
        clickedButton.innerHTML = `<div class="spinner"></div>`;

        try {
            if (side === 'both') {
                const context: ContextualTextSuggestionContext = {
                    SUBJECT_DP_TEXT: sourceData.rawText,
                    OBJECT_DP_TEXT: targetData.rawText,
                    PREDICATE_PHRASE: predicatePhrase
                };
                const result = await suggestContextTextsForConnection(context);
                if (result) {
                    sourceInput.value = result.subjectContext;
                    targetInput.value = result.objectContext;
                }
            } else {
                const context: ContextualTextSuggestionContext = {
                    SUBJECT_DP_TEXT: sourceData.rawText,
                    OBJECT_DP_TEXT: targetData.rawText,
                    PREDICATE_PHRASE: predicatePhrase,
                    SIDE_TO_GENERATE: side,
                    OTHER_SIDE_CONTEXT: side === 'subject' ? targetInput.value : sourceInput.value
                };
                const result = await suggestSingleContextText(context);
                if (result !== null) {
                    (side === 'subject' ? sourceInput : targetInput).value = result;
                }
            }
        } finally {
            buttons.forEach(b => b.disabled = false);
            clickedButton.innerHTML = originalIcon;
        }
    };

    editorDiv.querySelector('.suggest-both-ctx')?.addEventListener('click', () => handleAISuggest('both'));
    editorDiv.querySelector('.suggest-source-ctx')?.addEventListener('click', () => handleAISuggest('subject'));
    editorDiv.querySelector('.suggest-target-ctx')?.addEventListener('click', () => handleAISuggest('object'));
}


export function updateDetailsPanel(node: NodeSingular): void {
    if (!node || !node.isNode() || !detailsPanel || !detailsPanelTitle || !selectedNodeTextDiv || !connectedNodesListDiv) {
        if (detailsPanel) detailsPanel.style.display = 'none';
        return;
    }

    const nodeData = node.data() as CyNodeData;
    const typeDisplay = nodeData.type || 'unspecified';
    const typeBadgeHtml = `<span class="dp-type-badge type-${typeDisplay}">${typeDisplay}</span>`;
    detailsPanelTitle.innerHTML = `Details for DP${nodeData.id} ${typeBadgeHtml}`;
    
    setupDetailsPanelForEditMode(node); // This will handle visibility of edit elements

    if (!isEditModeActive()) {
        selectedNodeTextDiv.innerHTML = formatTextWithReferences(nodeData.rawText || '(No text content)');
    } else {
        // Text area is handled by setupDetailsPanelForEditMode
    }


    connectedNodesListDiv.innerHTML = '';
    let hasAnyConnections = false;

    const createPredicateGroupHTML = (
        groupKey: string,
        nodes: ConnectedNodeInfo[],
        color: string,
        edgesData: { sourceId: string, predicate: string, targetId: string, subjectContextualText?: string, objectContextualText?: string }[]
    ): HTMLDetailsElement => {
        hasAnyConnections = true;
        const detailsElem = document.createElement('details');
        const initialOpenState = detailsPanelCollapseState[groupKey] !== undefined ? detailsPanelCollapseState[groupKey] : true;
        detailsElem.open = initialOpenState;


        const summaryElem = document.createElement('summary');
        summaryElem.textContent = `${groupKey} (${nodes.length})`;
        summaryElem.style.backgroundColor = color; // Apply predicate color to summary background
        summaryElem.style.color = getTextColorForBackground(color); // Adjust text color for contrast

        detailsElem.appendChild(summaryElem);

        detailsElem.addEventListener('toggle', async () => {
            const newState = detailsElem.open;
            if (newState !== detailsPanelCollapseState[groupKey]) {
                detailsPanelCollapseState[groupKey] = newState;
                await saveDetailsPanelCollapseState(detailsPanelCollapseState);
            }
        });

        const ulElem = document.createElement('ul');
        nodes.forEach((connNode, index) => {
            const liElem = document.createElement('li');
            liElem.style.borderLeft = `3px solid ${color}`;

            const textSpan = document.createElement('span');
            textSpan.className = 'connection-text';
            
            const edgeInfo = edgesData[index];

            // Determine which node is "this" (the selected one) and which is "other"
            const isThisNodeTheSource = edgeInfo.sourceId === node.id();
            const contextualTextForOtherNode = isThisNodeTheSource ? edgeInfo.objectContextualText : edgeInfo.subjectContextualText;

            const originalText = `DP${connNode.id}: ${truncateText(connNode.text, maxDetailPanelLabelLength)}`;

            if (contextualTextForOtherNode) {
                const displayText = `DP${connNode.id}: ${truncateText(contextualTextForOtherNode, maxDetailPanelLabelLength)}`;
                const formattedDisplayText = formatTextWithReferences(displayText);
                const formattedOriginalText = formatTextWithReferences(originalText);
                
                textSpan.innerHTML = formattedDisplayText;
                textSpan.dataset.originalText = formattedOriginalText;
                textSpan.dataset.contextualText = formattedDisplayText;

                textSpan.addEventListener('mouseenter', () => {
                    textSpan.innerHTML = textSpan.dataset.originalText!;
                    textSpan.style.fontStyle = 'italic';
                    textSpan.style.opacity = '0.8';
                });
                textSpan.addEventListener('mouseleave', () => {
                    textSpan.innerHTML = textSpan.dataset.contextualText!;
                    textSpan.style.fontStyle = 'normal';
                    textSpan.style.opacity = '1';
                });
            } else {
                textSpan.innerHTML = formatTextWithReferences(originalText);
            }

            textSpan.dataset.nodeId = connNode.id;
            textSpan.title = `Click to select DP${connNode.id}`;
            textSpan.addEventListener('click', (e: MouseEvent) => {
                const currentTargetElement = e.currentTarget as HTMLElement;
                const targetNodeId = currentTargetElement.dataset.nodeId;

                if (!targetNodeId) return;
                
                const cy = getCyInstance();
                if (!cy) return;

                const targetCyNode = cy.getElementById(targetNodeId) as NodeSingular; 
                if (targetCyNode && targetCyNode.nonempty()) {
                    selectNodeInGraph(targetCyNode); 
                    centerOnNode(targetCyNode);       
                } else {
                    console.warn(`Node with ID ${targetNodeId} not found.`);
                }
            });
            liElem.appendChild(textSpan);

            if (isEditModeActive()) {
                const buttonsWrapper = document.createElement('div');
                buttonsWrapper.style.display = 'flex';
                buttonsWrapper.style.alignItems = 'center';

                const editEdgeBtn = document.createElement('button');
                editEdgeBtn.innerHTML = ICON_PENCIL;
                editEdgeBtn.className = 'icon-button edit-edge-button';
                editEdgeBtn.title = 'Edit contextual text for this connection';
                editEdgeBtn.addEventListener('click', () => {
                    createConnectionContextEditor(liElem, edgeInfo);
                });
                buttonsWrapper.appendChild(editEdgeBtn);

                const deleteEdgeBtn = document.createElement('button');
                deleteEdgeBtn.innerHTML = ICON_TRASH;
                deleteEdgeBtn.className = 'icon-button delete-edge-button';
                deleteEdgeBtn.title = 'Delete this connection';
                deleteEdgeBtn.addEventListener('click', () => {
                    handleDeleteEdge(edgeInfo.sourceId, edgeInfo.predicate, edgeInfo.targetId);
                });
                buttonsWrapper.appendChild(deleteEdgeBtn);

                liElem.appendChild(buttonsWrapper);
            }
            ulElem.appendChild(liElem);
        });
        detailsElem.appendChild(ulElem);
        return detailsElem;
    };

    const symmetricConnectionsGrouped: { [key: string]: { color: string; nodes: ConnectedNodeInfo[]; edges: { sourceId: string, predicate: string, targetId: string, subjectContextualText?: string, objectContextualText?: string }[] } } = {};
    const allConnectedEdges = node.connectedEdges();

    allConnectedEdges.forEach(edge => {
        const edgeData = edge.data() as CyEdgeData;
        const predicate = edgeData.label;

        if (symmetricPredicatesSet.has(predicate)) {
            const phrasing = predicatePhrasing[predicate] || predicatePhrasing.default;
            const phrasedPredicate = phrasing.symmetric || predicate;
            const color = predicateColors[predicate] || predicateColors.default;
            const otherNode = edge.source().id() === node.id() ? edge.target() : edge.source();
            const otherNodeData = otherNode.data() as CyNodeData;

            if (!symmetricConnectionsGrouped[phrasedPredicate]) {
                symmetricConnectionsGrouped[phrasedPredicate] = { color: color, nodes: [], edges: [] };
            }
            symmetricConnectionsGrouped[phrasedPredicate].nodes.push({
                id: otherNode.id(),
                text: otherNodeData.rawText || otherNodeData.shortLabel
            });

            symmetricConnectionsGrouped[phrasedPredicate].edges.push({
                 sourceId: edge.source().id(), predicate: predicate, targetId: edge.target().id(), subjectContextualText: edgeData.subjectContextualText, objectContextualText: edgeData.objectContextualText
            });
        }
    });

    let isFirstHeader = true;
    const createSectionHeader = (title: string): HTMLHeadingElement => {
        const header = document.createElement('h5');
        header.textContent = title;
        header.className = 'details-section-header';
        if (!isFirstHeader) {
            header.classList.add('subsequent-header');
        }
        isFirstHeader = false;
        
        if (isEditModeActive()) {
            header.appendChild(createAddToNewNodeButton());
        }
        connectedNodesListDiv.appendChild(header);
        return header;
    };


    if (Object.keys(symmetricConnectionsGrouped).length > 0) {
        createSectionHeader("Symmetric Connections");
        Object.keys(symmetricConnectionsGrouped).sort().forEach(phrasedPred => {
            const group = symmetricConnectionsGrouped[phrasedPred];
            connectedNodesListDiv.appendChild(createPredicateGroupHTML(phrasedPred, group.nodes, group.color, group.edges));
        });
    }

    const incomingAsymmetricEdges = allConnectedEdges.filter(edge =>
        edge.target().id() === node.id() && !symmetricPredicatesSet.has(edge.data('label'))
    );
    if (incomingAsymmetricEdges.length > 0) {
        createSectionHeader("Incoming Connections (Node is Target/Object)");
        const incomingGrouped: { [key: string]: { color: string; nodes: ConnectedNodeInfo[]; edges: { sourceId: string, predicate: string, targetId: string, subjectContextualText?: string, objectContextualText?: string }[] } } = {};
        incomingAsymmetricEdges.forEach(edge => {
            const edgeData = edge.data() as CyEdgeData;
            const predicate = edgeData.label;
            const phrasing = predicatePhrasing[predicate] || predicatePhrasing.default;
            const phrasedPredicate = phrasing.incoming || predicate;
            const color = predicateColors[predicate] || predicateColors.default;
            const sourceNode = edge.source();
            const sourceNodeData = sourceNode.data() as CyNodeData;
            if (!incomingGrouped[phrasedPredicate]) incomingGrouped[phrasedPredicate] = { color: color, nodes: [], edges: [] };
            incomingGrouped[phrasedPredicate].nodes.push({ id: sourceNode.id(), text: sourceNodeData.rawText || sourceNodeData.shortLabel });
            
            incomingGrouped[phrasedPredicate].edges.push({
                sourceId: edge.source().id(), predicate: predicate, targetId: edge.target().id(), subjectContextualText: edgeData.subjectContextualText, objectContextualText: edgeData.objectContextualText
            });
        });
        Object.keys(incomingGrouped).sort().forEach(phrasedPred => {
            const group = incomingGrouped[phrasedPred];
            connectedNodesListDiv.appendChild(createPredicateGroupHTML(phrasedPred, group.nodes, group.color, group.edges));
        });
    }

    const outgoingAsymmetricEdges = allConnectedEdges.filter(edge =>
        edge.source().id() === node.id() && !symmetricPredicatesSet.has(edge.data('label'))
    );
    if (outgoingAsymmetricEdges.length > 0) {
        createSectionHeader("Outgoing Connections (Node is Source/Subject)");
        const outgoingGrouped: { [key: string]: { color: string; nodes: ConnectedNodeInfo[]; edges: { sourceId: string, predicate: string, targetId: string, subjectContextualText?: string, objectContextualText?: string }[] } } = {};
        outgoingAsymmetricEdges.forEach(edge => {
            const edgeData = edge.data() as CyEdgeData;
            const predicate = edgeData.label;
            const phrasing = predicatePhrasing[predicate] || predicatePhrasing.default;
            const phrasedPredicate = phrasing.outgoing || predicate;
            const color = predicateColors[predicate] || predicateColors.default;
            const targetNode = edge.target();
            const targetNodeData = targetNode.data() as CyNodeData;
            if (!outgoingGrouped[phrasedPredicate]) outgoingGrouped[phrasedPredicate] = { color: color, nodes: [], edges: [] };
            outgoingGrouped[phrasedPredicate].nodes.push({ id: targetNode.id(), text: targetNodeData.rawText || targetNodeData.shortLabel });

            outgoingGrouped[phrasedPredicate].edges.push({
                 sourceId: edge.source().id(), predicate: predicate, targetId: edge.target().id(), subjectContextualText: edgeData.subjectContextualText, objectContextualText: edgeData.objectContextualText
            });
        });
        Object.keys(outgoingGrouped).sort().forEach(phrasedPred => {
            const group = outgoingGrouped[phrasedPred];
            connectedNodesListDiv.appendChild(createPredicateGroupHTML(phrasedPred, group.nodes, group.color, group.edges));
        });
    }

    if (!hasAnyConnections) {
        const noConnectionsP = document.createElement('p');
        noConnectionsP.style.cssText = 'padding:10px; font-style:italic; opacity:0.7; display: flex; justify-content: space-between; align-items: center;';
        noConnectionsP.textContent = 'No connections to display.';
        if (isEditModeActive()) {
            noConnectionsP.appendChild(createAddToNewNodeButton());
        }
        connectedNodesListDiv.appendChild(noConnectionsP);
    }
    detailsPanel.style.display = 'block';
}

export function hideDetailsPanel(): void {
    if (detailsPanel) {
        detailsPanel.style.display = 'none';
    }
    setupDetailsPanelForEditMode(null); // Clear edit mode state for panel
}

// New function to update panel visibility based on selection and edit mode
export function updateDetailsPanelVisibility(): void {
    const selectedNode = getSelectedNode();
    if (selectedNode && selectedNode.length > 0) {
        updateDetailsPanel(selectedNode);
    } else {
        hideDetailsPanel();
    }
}