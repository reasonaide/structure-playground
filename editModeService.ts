// editModeService.ts
import { NodeSingular } from 'cytoscape';
import { 
    inputTextElem, renderButton, toggleEditModeButton, editModeActionButtons, 
    undoButton, redoButton, addEdgeButton, addNodeButton, 
    detailsNodeEditTextArea,
    detailsNodeSaveTextButton, detailsNodeDeleteButton, selectedNodeTextDiv, editNodeTextContainer,
    detailsPanel,
    confirmEdgeUIDiv, confirmEdgeSourceInfoDiv, confirmEdgeTargetInfoDiv,
    confirmEdgePredicateSelect, confirmEdgeConfirmButton, confirmEdgeCancelButton,
    addConnectionToNewNodeUIDiv, acnnSourceInfoDiv, acnnPredicateSelect, 
    acnnNewNodeTextArea, acnnConfirmButton, acnnCancelButton,
    acnnSuggestAiButton, acnnAiLoadingIndicator, acnnNewNodeTypeGroup,
    errorDisplay, // Main error display
    detailsNodeSuggestAiButton, detailsNodeSuggestionTaskSelector, detailsNodeAiLoadingIndicator, // New elements
    detailsNodeWikidataReferencesList // New for displaying Wikidata items
} from './dom.js';
import { showCustomConfirmDialog, addError as addMainPanelError, clearErrors as clearMainPanelErrors, truncateText, getComputedCssVar } from './utils.js';
import { getSelectedNode, getCyInstance, selectNodeInGraph, centerOnNode, setPendingNewNodePlacement, getCurrentLayoutName, saveCurrentNodesLayout } from './cytoscapeService.js';
import { 
    predicateColors, predicatePhrasing, directedPredicates, undirectedPredicates, symmetricPredicatesSet, 
    predicateEmojis, maxDetailPanelLabelLength, connectionValidationRules 
} from './config.js';
import { 
    DEFAULT_TEMPLATE_PREFIX_SUGGEST_EDIT, 
    DEFAULT_TEMPLATE_SUGGEST_EDIT_DECONTEXTUALISE_NAME, DEFAULT_TEMPLATE_SUGGEST_EDIT_WIKIDATA_LINK_NAME 
} from './ai-config.js';
import { updateDetailsPanel, hideDetailsPanel, updateDetailsPanelVisibility } from './detailsPanelService.js';
import { CyNodeData, CyEdgeData, DPType } from './types.js';
import { ICON_PENCIL, ICON_CHECK, ICON_LINK, ICON_TARGET, ICON_CANCEL_X, ICON_PLUS, ICON_UNDO, ICON_REDO, ICON_AI_SUGGEST } from './icons.js';
import { suggestNewNodeTextViaAI, SuggestionContext, isAiInitialized, getAllTemplateNames, suggestNodeTextEditViaAI, EditSuggestionContext, getWikidataItemDetails } from './aiService.js';


const MAX_HISTORY_SIZE = 50;
let undoStack: string[] = [];
let redoStack: string[] = [];
let _isEditModeActive: boolean = false;
let originalNodeTextForEdit: string | null = null;

// --- Edge Creation State ---
type EdgeCreationStatus = 'idle' | 'source_selected_pending_target' | 'target_selected_pending_confirmation' | 'pending_new_node_input';
let edgeCreationStatus: EdgeCreationStatus = 'idle';
let edgeSourceNodeId: string | null = null;
let edgeTargetNodeId: string | null = null;

// --- New Node Added Flag ---
let _newNodeJustAddedInLastOperation: boolean = false;

// New helper function to get a formatted timestamp string
function getFormattedTimestamp(): string {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    return `on ${day}.${month}.${year} at ${hours}:${minutes}`;
}


export function signalNewNodeAddition(): void {
    _newNodeJustAddedInLastOperation = true;
}

export function checkAndResetNewNodeAdditionFlag(): boolean {
    const flagValue = _newNodeJustAddedInLastOperation;
    _newNodeJustAddedInLastOperation = false;
    return flagValue;
}


export function isEditModeActive(): boolean {
    return _isEditModeActive;
}

export function getEdgeCreationStatus(): EdgeCreationStatus {
    return edgeCreationStatus;
}

// For cytoscapeService to check
export function getPendingEdgeSourceNodeId(): string | null { return edgeSourceNodeId; }
export function getPendingEdgeTargetNodeId(): string | null { return edgeTargetNodeId; }


export function initializeEditMode(): void {
    loadHistoryFromLocalStorage();
    updateUndoRedoButtonStates();
    updateEditModeButtonVisuals();
    
    const selectedNode = getSelectedNode();
    if (addNodeButton) { 
        addNodeButton.disabled = !_isEditModeActive || edgeCreationStatus !== 'idle';
    }
    if (addEdgeButton) { 
      addEdgeButton.disabled = !selectedNode || !_isEditModeActive || edgeCreationStatus !== 'idle';
    }

    if (detailsNodeEditTextArea && detailsNodeSaveTextButton) {
        detailsNodeEditTextArea.addEventListener('input', () => {
            if (originalNodeTextForEdit !== null) {
                detailsNodeSaveTextButton.style.display = detailsNodeEditTextArea.value !== originalNodeTextForEdit ? 'inline-block' : 'none';
            }
        });
    }

    // Listeners for confirm edge UI (existing node)
    if (confirmEdgeConfirmButton) {
        confirmEdgeConfirmButton.addEventListener('click', handleConfirmEdgeCreationToExistingNode);
    }
    if (confirmEdgeCancelButton) {
        confirmEdgeCancelButton.addEventListener('click', handleCancelEdgeCreation);
    }

    // Listeners for confirm edge UI (new node)
    if (acnnConfirmButton) {
        acnnConfirmButton.addEventListener('click', handleConfirmConnectionToNewNode);
    }
    if (acnnCancelButton) {
        acnnCancelButton.addEventListener('click', handleCancelConnectionToNewNode);
    }
    if (acnnSuggestAiButton) {
        acnnSuggestAiButton.addEventListener('click', handleAiSuggestNewNodeText);
    }

    // Listener for node text edit AI suggestion
    if (detailsNodeSuggestAiButton) {
        detailsNodeSuggestAiButton.addEventListener('click', handleAiSuggestNodeTextEdit);
    }
}

export function recordSnapshot(): void { // Added export
    if (!inputTextElem) return;
    undoStack.push(inputTextElem.value);
    redoStack = []; // Clear redo stack on new action
    if (undoStack.length > MAX_HISTORY_SIZE) {
        undoStack.shift(); // Remove oldest entry
    }
    saveHistoryToLocalStorage();
    updateUndoRedoButtonStates();
}

export function performUndo(): void {
    if (undoStack.length > 0 && inputTextElem && 
        (edgeCreationStatus === 'idle' || edgeCreationStatus === 'source_selected_pending_target')) {
        const prevState = undoStack.pop();
        if (prevState === undefined) return;
        redoStack.push(inputTextElem.value);
        inputTextElem.value = prevState;
        // setEdgeCreationStatus('idle'); // It should already be idle or source_selected_pending_target which is fine
        if (renderButton) renderButton.click(); 
        saveHistoryToLocalStorage();
        updateUndoRedoButtonStates();
        setTimeout(updateDetailsPanelVisibility, 0); 
    }
}

export function performRedo(): void {
    if (redoStack.length > 0 && inputTextElem &&
        (edgeCreationStatus === 'idle' || edgeCreationStatus === 'source_selected_pending_target')) {
        const nextState = redoStack.pop();
        if (nextState === undefined) return;
        undoStack.push(inputTextElem.value);
        inputTextElem.value = nextState;
        // setEdgeCreationStatus('idle'); 
        if (renderButton) renderButton.click(); 
        saveHistoryToLocalStorage();
        updateUndoRedoButtonStates();
        setTimeout(updateDetailsPanelVisibility, 0); 
    }
}

function saveHistoryToLocalStorage(): void {
    try {
        localStorage.setItem('raiGraphEditUndoStack', JSON.stringify(undoStack));
        localStorage.setItem('raiGraphEditRedoStack', JSON.stringify(redoStack));
    } catch (e) {
        console.warn("Could not save edit history to local storage:", e);
    }
}

function loadHistoryFromLocalStorage(): void {
    try {
        const storedUndo = localStorage.getItem('raiGraphEditUndoStack');
        const storedRedo = localStorage.getItem('raiGraphEditRedoStack');
        if (storedUndo) undoStack = JSON.parse(storedUndo);
        if (storedRedo) redoStack = JSON.parse(storedRedo);
    } catch (e) {
        console.warn("Could not load edit history from local storage:", e);
        undoStack = [];
        redoStack = [];
    }
}

export function updateUndoRedoButtonStates(): void {
    const editActive = _isEditModeActive;
    // General edits (undo, redo, add node) are allowed if edit mode is active AND
    // (edge creation is idle OR is in graph-interactive target selection phase)
    const allowGeneralEdits = editActive && 
                             (edgeCreationStatus === 'idle' || edgeCreationStatus === 'source_selected_pending_target');

    if (undoButton) undoButton.disabled = !allowGeneralEdits || undoStack.length === 0;
    if (redoButton) redoButton.disabled = !allowGeneralEdits || redoStack.length === 0;
    if (addNodeButton) addNodeButton.disabled = !allowGeneralEdits;

    // The addEdgeButton's disabled state is now exclusively managed by setEdgeCreationStatus
}


function updateEditModeButtonVisuals(): void {
    if (!toggleEditModeButton || !editModeActionButtons || !inputTextElem) return;
    if (_isEditModeActive) {
        toggleEditModeButton.innerHTML = ICON_CHECK; // Use checkmark SVG when active
        toggleEditModeButton.title = 'Exit Edit Mode';
        toggleEditModeButton.classList.add('edit-mode-active');
        editModeActionButtons.style.display = 'flex';
        inputTextElem.disabled = true; 
    } else {
        toggleEditModeButton.innerHTML = ICON_PENCIL; // Use pencil SVG when inactive
        toggleEditModeButton.title = 'Enter Edit Mode';
        toggleEditModeButton.classList.remove('edit-mode-active');
        editModeActionButtons.style.display = 'none';
        inputTextElem.disabled = false;
    }
    setEdgeCreationStatus(edgeCreationStatus); 
}

export function toggleEditMode(): void {
    _isEditModeActive = !_isEditModeActive;
    if (!_isEditModeActive) { 
        setEdgeCreationStatus('idle'); 
        if (detailsNodeSaveTextButton) detailsNodeSaveTextButton.style.display = 'none';
        originalNodeTextForEdit = null;
        if (detailsNodeWikidataReferencesList) { // Clear Wikidata list on exiting edit mode
            detailsNodeWikidataReferencesList.innerHTML = '';
            detailsNodeWikidataReferencesList.style.display = 'none';
        }
    }
    updateEditModeButtonVisuals();
    updateDetailsPanelVisibility(); 
}


function getNextNumericDpId(currentText: string): string {
    const dpIdRegex = /^DP(\d+)(?:\.\w+)?:/gm; // Look for optional .type
    let match;
    let maxId = 0;
    while ((match = dpIdRegex.exec(currentText)) !== null) {
        const idNum = parseInt(match[1], 10);
        if (!isNaN(idNum) && idNum > maxId) {
            maxId = idNum;
        }
    }
    return `DP${maxId + 1}`;
}

export async function handleAddNode(): Promise<void> {
    if (!inputTextElem || !renderButton || (edgeCreationStatus !== 'idle' && edgeCreationStatus !== 'source_selected_pending_target')) return;
    
    recordSnapshot();
    const newNodeIdFull = getNextNumericDpId(inputTextElem.value);
    const newNodeIdPart = newNodeIdFull.replace('DP',''); 
    const newNodeText = `${newNodeIdFull}.statement: (New Node - Edit Text) #MANUAL_EDIT ${getFormattedTimestamp()}`;
    
    const currentLayoutIsSaved = getCurrentLayoutName() === 'saved_layout';
    const cyInstance = getCyInstance();

    if (currentLayoutIsSaved && cyInstance) {
        const pan = cyInstance.pan();
        const zoom = cyInstance.zoom();
        // Viewport center in model coordinates
        const targetPosition = {
            x: (-pan.x / zoom) + (cyInstance.width() / (2 * zoom)),
            y: (-pan.y / zoom) + (cyInstance.height() / (2 * zoom))
        };
        console.log(`[AddNode] Current layout is 'saved_layout'. Calculated viewport center for new node DP${newNodeIdPart}:`, targetPosition);
        setPendingNewNodePlacement(newNodeIdPart, targetPosition);
    } else {
        console.log(`[AddNode] Current layout is '${getCurrentLayoutName()}' or graph not initialized. New node DP${newNodeIdPart} will be placed by default layout.`);
    }

    inputTextElem.value = inputTextElem.value.trim() + (inputTextElem.value.trim() ? '\n' : '') + newNodeText;
    
    signalNewNodeAddition(); // Signal that a new node is being added
    
    // Save layout if current layout is 'saved_layout' BEFORE rendering
    if (currentLayoutIsSaved && cyInstance && cyInstance.nodes().length > 0) {
        console.log("[AddNode] Current layout is 'saved_layout'. Auto-saving current node positions before re-render due to edit.");
        await saveCurrentNodesLayout(); // Ensure positions of existing nodes are saved
    }
    
    renderButton.click(); 

    setTimeout(() => {
        const cy = getCyInstance();
        if (cy) {
            const newNode = cy.getElementById(newNodeIdPart) as NodeSingular;
            if (newNode && newNode.length > 0) {
                selectNodeInGraph(newNode);
                centerOnNode(newNode);
            }
        }
    }, 500); 
}

/**
 * Checks if a given predicate (and direction) is possible for a source node type,
 * meaning there is at least one possible target node type that would make a valid connection.
 */
function isPredicatePossibleForSource(sourceType: DPType, predicate: string, direction: 'forward' | 'reverse' | 'symmetric'): boolean {
    const allNodeTypes: DPType[] = ['statement', 'question', 'argument', 'reference'];
    for (const targetType of allNodeTypes) {
        if (isValidConnection(sourceType, predicate, direction, targetType)) {
            return true; // Found at least one valid target type
        }
    }
    return false; // No valid target type exists for this predicate/direction from this source
}

// --- Common Predicate Dropdown Population ---
function populatePredicateDropdown(selectElement: HTMLSelectElement, sourceNodeData: CyNodeData, targetNodeData?: CyNodeData | null): void {
    selectElement.innerHTML = '';

    const options: { option: HTMLOptionElement; isDisabled: boolean }[] = [];
    const sourceType = sourceNodeData.type;
    const targetType = targetNodeData?.type;

    Object.keys(predicatePhrasing).forEach(predicateKey => {
        if (predicateKey === 'default') return;

        const phrasing = predicatePhrasing[predicateKey];
        const emoji = predicateEmojis[predicateKey] || predicateEmojis.default;

        const createAndCheckOption = (value: string, text: string) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = text;
            const [predicate, direction] = value.split(':') as [string, 'forward' | 'reverse' | 'symmetric'];

            let isDisabled = false;
            if (targetType) { // Case: Connecting to EXISTING node
                isDisabled = !isValidConnection(sourceType, predicate, direction, targetType);
            } else { // Case: Connecting to NEW node
                isDisabled = !isPredicatePossibleForSource(sourceType, predicate, direction);
            }
            option.disabled = isDisabled;
            options.push({ option, isDisabled });
        };

        if (phrasing.symmetric) {
            createAndCheckOption(`${predicateKey}:symmetric`, `${emoji} ${phrasing.symmetric}`);
        } else {
            if (phrasing.outgoing) {
                createAndCheckOption(`${predicateKey}:forward`, `${emoji} ${phrasing.outgoing}`);
            }
            if (phrasing.incoming) {
                createAndCheckOption(`${predicateKey}:reverse`, `${emoji} ${phrasing.incoming}`);
            }
        }
    });

    // Sort to group by directionality, and then alphabetically for a stable order.
    // This no longer sorts disabled items to the bottom, preserving the group order.
    const getGroup = (value: string) => {
        if (value.endsWith(':symmetric')) return 1;
        if (value.endsWith(':forward')) return 2; // outgoing
        if (value.endsWith(':reverse')) return 0; // incoming
        return 3;
    };

    options
        .sort((a, b) => {
            const groupA = getGroup(a.option.value);
            const groupB = getGroup(b.option.value);
            if (groupA !== groupB) {
                return groupA - groupB;
            }
            return a.option.textContent.localeCompare(b.option.textContent); // Alphabetical within group
        })
        .forEach(({ option }) => selectElement.appendChild(option));
}


// --- Edge Creation State Management ---
export function setEdgeCreationStatus(newStatus: EdgeCreationStatus): void {
    const oldStatus = edgeCreationStatus;
    edgeCreationStatus = newStatus;
    console.log(`Edge creation status: ${oldStatus} -> ${newStatus}`);
    
    if (addEdgeButton) {
        const selectedNode = getSelectedNode();
        let isDisabled = !_isEditModeActive; // Base: if not in edit mode, it's disabled
        let title = addEdgeButton.title;
        let innerHTML = addEdgeButton.innerHTML; // Preserve existing SVG if any
        addEdgeButton.classList.remove('edit-mode-active-accent');

        switch (newStatus) {
            case 'idle':
                innerHTML = ICON_LINK;
                isDisabled = isDisabled || !selectedNode; 
                title = selectedNode ? "Add Connection" : "Add Connection (Select Source Node First)";
                break;
            case 'source_selected_pending_target':
                innerHTML = ICON_TARGET; 
                addEdgeButton.classList.add('edit-mode-active-accent');
                title = "Select a target node on the graph. Click this Target button again to cancel.";
                isDisabled = isDisabled || !edgeSourceNodeId; 
                break;
            case 'target_selected_pending_confirmation':
            case 'pending_new_node_input':
                innerHTML = ICON_CANCEL_X; 
                title = "Cancel Operation (duplicates ❌ in Details Panel)";
                isDisabled = isDisabled || !edgeSourceNodeId; 
                break;
        }
        addEdgeButton.disabled = isDisabled;
        addEdgeButton.title = title;
        addEdgeButton.innerHTML = innerHTML;
    }

    if (confirmEdgeUIDiv) confirmEdgeUIDiv.style.display = (newStatus === 'target_selected_pending_confirmation') ? 'block' : 'none';
    if (addConnectionToNewNodeUIDiv) addConnectionToNewNodeUIDiv.style.display = (newStatus === 'pending_new_node_input') ? 'block' : 'none';
    
    if (newStatus !== 'pending_new_node_input' && acnnAiLoadingIndicator) {
         acnnAiLoadingIndicator.style.display = 'none';
    }


    if (newStatus === 'idle') {
        edgeSourceNodeId = null;
        edgeTargetNodeId = null;
        if (acnnNewNodeTextArea) acnnNewNodeTextArea.value = '';
    }
    
    updateUndoRedoButtonStates(); 
    setupDetailsPanelForEditMode(getSelectedNode()); 

    if (oldStatus !== newStatus) {
        updateDetailsPanelVisibility(); 
    }
}

export function toggleAddEdgeMode(): void {
    if (!_isEditModeActive) {
        addMainPanelError("Enable Edit Mode first to add connections.");
        return;
    }

    switch (edgeCreationStatus) {
        case 'idle':
            const sourceNode = getSelectedNode();
            if (!sourceNode) {
                addMainPanelError("Select a source node first to start adding a connection.");
                return;
            }
            edgeSourceNodeId = sourceNode.id();
            setEdgeCreationStatus('source_selected_pending_target');
            break;
        case 'source_selected_pending_target':
            setEdgeCreationStatus('idle');
            break;
        case 'target_selected_pending_confirmation':
            handleCancelEdgeCreation(); 
            break;
        case 'pending_new_node_input':
            handleCancelConnectionToNewNode(); 
            break;
    }
}


export function cancelAddEdgeMode(): void { 
    if (edgeCreationStatus === 'source_selected_pending_target') { 
        setEdgeCreationStatus('idle');
    }
}

export function handleTargetNodeSelectedForEdge(targetCyNode: NodeSingular): boolean { 
    if (edgeCreationStatus !== 'source_selected_pending_target' || !edgeSourceNodeId) {
        return false;
    }
    if (targetCyNode.id() === edgeSourceNodeId) {
        addMainPanelError("Cannot connect a node to itself in this manner. Select a different target node.");
        return false; 
    }

    edgeTargetNodeId = targetCyNode.id();
    
    const cy = getCyInstance();
    if (!cy) { setEdgeCreationStatus('idle'); return false; }
    const sourceCyNode = cy.getElementById(edgeSourceNodeId) as NodeSingular;

    if (sourceCyNode.empty() || targetCyNode.empty()) {
        addMainPanelError("Source or target node for connection not found.");
        setEdgeCreationStatus('idle'); return false;
    }
    setEdgeCreationStatus('target_selected_pending_confirmation');
    showConfirmEdgeUIToExistingNode(sourceCyNode, targetCyNode);
    return true; 
}

export function showConfirmEdgeUIToExistingNode(sourceNode: NodeSingular, targetNode: NodeSingular): void {
    if (!confirmEdgeUIDiv || !confirmEdgeSourceInfoDiv || !confirmEdgeTargetInfoDiv || !confirmEdgePredicateSelect || !detailsPanel) return;
    
    if (detailsPanel.style.display === 'none' || getSelectedNode()?.id() !== sourceNode.id()) {
       updateDetailsPanel(sourceNode); 
    }

    const sourceData = sourceNode.data() as CyNodeData;
    const targetData = targetNode.data() as CyNodeData;

    confirmEdgeSourceInfoDiv.textContent = `DP${sourceData.id}: ${truncateText(sourceData.rawText, 50)}`;
    confirmEdgeTargetInfoDiv.textContent = `DP${targetData.id}: ${truncateText(targetData.rawText, 50)}`;
    populatePredicateDropdown(confirmEdgePredicateSelect, sourceData, targetData);
    
    if (confirmEdgeUIDiv.style.display !== 'block') {
        confirmEdgeUIDiv.style.display = 'block';
    }
}

function handleConfirmEdgeCreationToExistingNode(): void {
    if (edgeCreationStatus !== 'target_selected_pending_confirmation' || !edgeSourceNodeId || !edgeTargetNodeId || !inputTextElem || !renderButton) {
        addMainPanelError("Cannot confirm edge: Invalid state or missing information.");
        setEdgeCreationStatus('idle'); return;
    }
    const selectedOption = confirmEdgePredicateSelect.value;
    if (!selectedOption) { addMainPanelError("Please select a connection type."); return; }

    const [predicateName, direction] = selectedOption.split(':');
    let finalSourceId = edgeSourceNodeId;
    let finalTargetId = edgeTargetNodeId;

    if (direction === 'reverse') { 
        [finalSourceId, finalTargetId] = [edgeTargetNodeId, edgeSourceNodeId];
    }

    recordSnapshot();
    const newConnectionText = `(DP${finalSourceId} ${predicateName} DP${finalTargetId}) #MANUAL_EDIT ${getFormattedTimestamp()}`;
    inputTextElem.value = (inputTextElem.value.trim() ? inputTextElem.value.trim() + '\n' : '') + newConnectionText;
    
    setEdgeCreationStatus('idle'); 
    renderButton.click(); 
}

function handleCancelEdgeCreation(): void { 
    setEdgeCreationStatus('idle');
}


// --- Connect to NEW Node (from Details Panel) ---
export function initiateAddConnectionToNewNode(): void {
    if (!_isEditModeActive || edgeCreationStatus !== 'idle') { 
         addMainPanelError(!_isEditModeActive ? "Enable Edit Mode first." : "Another edit operation is in progress."); 
         return; 
    }
    const sourceNode = getSelectedNode();
    if (!sourceNode) { addMainPanelError("Select a source node first."); return; }

    edgeSourceNodeId = sourceNode.id();
    setEdgeCreationStatus('pending_new_node_input');
    showAddConnectionToNewNodeUI(sourceNode); 
}

function isValidConnection(sourceType: DPType, predicate: string, direction: 'forward' | 'reverse' | 'symmetric', targetType: DPType): boolean {
    const rule = connectionValidationRules[predicate];
    if (!rule) {
        return true; // Unknown predicates are always valid
    }

    // Determine the logical subject and object based on the connection direction in the UI
    const logicalSubjectType = direction === 'reverse' ? targetType : sourceType;
    const logicalObjectType = direction === 'reverse' ? sourceType : targetType;

    if (rule.mustHaveSameType) {
        // For predicates like 'isEqual', 'specifies'
        if (sourceType !== targetType) return false;
    }

    if (rule.subjectType) {
        // Check if the logical subject's type is allowed
        if (!rule.subjectType.includes(logicalSubjectType)) return false;
    }

    if (rule.objectType) {
        // Check if the logical object's type is allowed
        if (!rule.objectType.includes(logicalObjectType)) return false;
    }

    return true;
}

function updateAcnnNodeTypeOptions() {
    if (!edgeSourceNodeId || !acnnPredicateSelect || !acnnNewNodeTypeGroup) return;

    const cy = getCyInstance();
    if (!cy) return;

    const sourceNode = cy.getElementById(edgeSourceNodeId);
    if (sourceNode.empty()) return;

    const sourceType = sourceNode.data('type') as DPType;
    
    const selectedPredicateValue = acnnPredicateSelect.value;
    const [selectedPredicate, selectedDirection] = selectedPredicateValue.split(':') as [string, 'forward' | 'reverse' | 'symmetric'];

    const typeRadios = acnnNewNodeTypeGroup.querySelectorAll('input[type="radio"]') as NodeListOf<HTMLInputElement>;
    let isCurrentTypeSelectionValid = false;
    
    typeRadios.forEach(radio => {
        const newType = radio.value as DPType;
        const isValid = isValidConnection(sourceType, selectedPredicate, selectedDirection, newType);
        radio.disabled = !isValid;
        if (radio.checked && isValid) {
            isCurrentTypeSelectionValid = true;
        }
        const label = radio.nextElementSibling as HTMLLabelElement;
        label.style.textDecoration = isValid ? 'none' : 'line-through';
        label.style.opacity = isValid ? '1' : '0.5';
    });
    
    // If current type selection is now invalid, check the first valid one
    if (!isCurrentTypeSelectionValid) {
        const firstValidRadio = Array.from(typeRadios).find(r => !r.disabled);
        if (firstValidRadio) {
            firstValidRadio.checked = true;
        }
    }
}


function showAddConnectionToNewNodeUI(sourceNode: NodeSingular): void {
    if (!addConnectionToNewNodeUIDiv || !acnnSourceInfoDiv || !acnnPredicateSelect || !acnnNewNodeTextArea || !detailsPanel || !acnnSuggestAiButton || !acnnNewNodeTypeGroup) return;

    if (detailsPanel.style.display === 'none' || getSelectedNode()?.id() !== sourceNode.id()) {
       updateDetailsPanel(sourceNode); 
    }

    const sourceData = sourceNode.data() as CyNodeData;
    acnnSourceInfoDiv.textContent = `DP${sourceData.id}: ${truncateText(sourceData.rawText, 50)}`;
    acnnNewNodeTextArea.value = '';
    acnnNewNodeTextArea.placeholder = "Enter text for the new node...";
    
    acnnNewNodeTypeGroup.innerHTML = '';
    const nodeTypes: DPType[] = ['statement', 'question', 'argument', 'reference'];
    nodeTypes.forEach((type, index) => {
        const inputId = `acnn-type-${type}`;
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'acnn-new-node-type';
        input.id = inputId;
        input.value = type;
        if (index === 0) {
            input.checked = true;
        }
        // No listener here; predicate drives the filtering.

        const label = document.createElement('label');
        label.htmlFor = inputId;
        label.textContent = type;
        label.title = `Set the new node's type to ${type}`;

        acnnNewNodeTypeGroup.appendChild(input);
        acnnNewNodeTypeGroup.appendChild(label);
    });

    acnnPredicateSelect.removeEventListener('change', updateAcnnNodeTypeOptions);
    populatePredicateDropdown(acnnPredicateSelect, sourceData, null);
    acnnPredicateSelect.addEventListener('change', updateAcnnNodeTypeOptions);
    
    updateAcnnNodeTypeOptions();

    if (addConnectionToNewNodeUIDiv.style.display !== 'block') {
        addConnectionToNewNodeUIDiv.style.display = 'block';
    }
}

async function handleAiSuggestNewNodeText(): Promise<void> {
    if (!edgeSourceNodeId || !acnnPredicateSelect || !acnnNewNodeTextArea || !acnnSuggestAiButton || !acnnAiLoadingIndicator) return;

    const sourceNode = getCyInstance()?.getElementById(edgeSourceNodeId);
    if (!sourceNode || sourceNode.empty()) {
        addMainPanelError("Source node not found for AI suggestion.");
        return;
    }

    const sourceData = sourceNode.data() as CyNodeData;
    const currentNewNodeInput = acnnNewNodeTextArea.value;
    const selectedPredicateOption = acnnPredicateSelect.value;
    if (!selectedPredicateOption) {
        addMainPanelError("Please select a connection type before asking for AI suggestion.");
        return;
    }

    const [predicateName, direction] = selectedPredicateOption.split(':');
    
    let proposedRelationship = "";
    if (direction === 'forward') { // Source -> New Node
        proposedRelationship = `DP${sourceData.id} '${predicateName}' (New Node Text)`;
    } else if (direction === 'reverse') { // New Node -> Source
        proposedRelationship = `(New Node Text) '${predicateName}' DP${sourceData.id}`;
    } else { // Symmetric
        proposedRelationship = `DP${sourceData.id} '${predicateName}' (New Node Text) (Symmetric)`;
    }

    let existingConnections = "";
    const connectedEdges = sourceNode.connectedEdges();
    if (connectedEdges.length > 0) {
        const connectionLines: string[] = [];
        connectedEdges.forEach(edge => {
            const edgeData = edge.data() as CyEdgeData;
            const otherNode = edge.source().id() === sourceNode.id() ? edge.target() : edge.source();
            const otherNodeData = otherNode.data() as CyNodeData;
            const phrasing = predicatePhrasing[edgeData.label] || { symmetric: edgeData.label, incoming: edgeData.label, outgoing: edgeData.label };
            
            let line = `- `;
            if (edge.source().id() === sourceNode.id()) { // Outgoing from source
                 line += `'${phrasing.outgoing || edgeData.label}' DP${otherNode.id()}: ${truncateText(otherNodeData.rawText, maxDetailPanelLabelLength)}`;
            } else if (edge.target().id() === sourceNode.id()) { // Incoming to source
                 line += `DP${otherNode.id()}: ${truncateText(otherNodeData.rawText, maxDetailPanelLabelLength)} '${phrasing.incoming || edgeData.label}' this node`;
            } else { // Symmetric with source
                 line += `'${phrasing.symmetric || edgeData.label}' DP${otherNode.id()}: ${truncateText(otherNodeData.rawText, maxDetailPanelLabelLength)}`;
            }
            connectionLines.push(line);
        });
        existingConnections = connectionLines.join('\n');
    } else {
        existingConnections = "No existing connections.";
    }


    const context: SuggestionContext = {
        SOURCE_NODE_ID: sourceData.id,
        SOURCE_NODE_TEXT: sourceData.rawText,
        SOURCE_NODE_CONNECTIONS: existingConnections,
        PROPOSED_RELATIONSHIP: proposedRelationship,
        CURRENT_NEW_NODE_INPUT: currentNewNodeInput
    };

    acnnSuggestAiButton.disabled = true;
    acnnAiLoadingIndicator.style.display = 'inline';
    acnnAiLoadingIndicator.textContent = 'AI thinking...';


    const suggestion = await suggestNewNodeTextViaAI(context);

    acnnSuggestAiButton.disabled = false;
    acnnAiLoadingIndicator.style.display = 'none';


    if (suggestion) {
        acnnNewNodeTextArea.value = suggestion;
        acnnAiLoadingIndicator.textContent = "AI suggestion populated.";
        acnnAiLoadingIndicator.style.color = 'var(--success-text-color)';
        acnnAiLoadingIndicator.style.fontStyle = 'normal';
        acnnAiLoadingIndicator.style.display = 'inline';
        setTimeout(() => {
            if (acnnAiLoadingIndicator && acnnAiLoadingIndicator.textContent === "AI suggestion populated.") {
                acnnAiLoadingIndicator.style.display = 'none';
            }
        }, 2000);
    } else {
        // Error is handled by suggestNewNodeTextViaAI by adding to main panel
        acnnAiLoadingIndicator.textContent = "Suggestion failed.";
        acnnAiLoadingIndicator.style.color = 'var(--error-text-color)';
        acnnAiLoadingIndicator.style.fontStyle = 'italic';
        acnnAiLoadingIndicator.style.display = 'inline';
         setTimeout(() => {
            if (acnnAiLoadingIndicator && acnnAiLoadingIndicator.textContent === "Suggestion failed.") {
                acnnAiLoadingIndicator.style.display = 'none';
            }
        }, 2000);
    }
}


async function handleConfirmConnectionToNewNode(): Promise<void> {
    if (edgeCreationStatus !== 'pending_new_node_input' || !edgeSourceNodeId || !acnnNewNodeTextArea.value.trim() || !inputTextElem || !renderButton || !acnnNewNodeTypeGroup) {
        if (!acnnNewNodeTextArea.value.trim()) addMainPanelError("New node text cannot be empty.");
        else addMainPanelError("Cannot create node & connection: Invalid state.");
        if (edgeCreationStatus !== 'pending_new_node_input' || !edgeSourceNodeId || !inputTextElem || !renderButton) {
            setEdgeCreationStatus('idle'); // Reset if state is truly broken
        }
        return;
    }

    const selectedOption = acnnPredicateSelect.value;
    if (!selectedOption) { addMainPanelError("Please select a connection type."); return; }

    recordSnapshot();
    const newNodeIdFull = getNextNumericDpId(inputTextElem.value);
    const newNodeIdPart = newNodeIdFull.replace('DP','');
    
    const selectedTypeRadio = acnnNewNodeTypeGroup.querySelector('input[type="radio"]:checked') as HTMLInputElement | null;
    const newNodeType = selectedTypeRadio ? (selectedTypeRadio.value as DPType) : 'statement';

    const newNodeDefinition = `${newNodeIdFull}.${newNodeType}: ${acnnNewNodeTextArea.value.trim()} #MANUAL_EDIT ${getFormattedTimestamp()}`;

    const currentLayoutIsSaved = getCurrentLayoutName() === 'saved_layout';
    const cyInstance = getCyInstance();

    if (currentLayoutIsSaved && cyInstance) {
        const pan = cyInstance.pan();
        const zoom = cyInstance.zoom();
        const targetPosition = {
            x: (-pan.x / zoom) + (cyInstance.width() / (2 * zoom)),
            y: (-pan.y / zoom) + (cyInstance.height() / (2 * zoom))
        };
        console.log(`[AddConnectionToNewNode] Current layout is 'saved_layout'. Calculated viewport center for new node DP${newNodeIdPart}:`, targetPosition);
        setPendingNewNodePlacement(newNodeIdPart, targetPosition);
    } else {
        console.log(`[AddConnectionToNewNode] Current layout is '${getCurrentLayoutName()}' or graph not initialized. New node DP${newNodeIdPart} will be placed by default layout.`);
    }

    const [predicateName, direction] = selectedOption.split(':');
    let finalSourceIdForConnection = edgeSourceNodeId; 
    let finalTargetIdForConnection = newNodeIdPart;   

    if (direction === 'reverse') { 
        finalSourceIdForConnection = newNodeIdPart;
        finalTargetIdForConnection = edgeSourceNodeId;
    }
    const newConnectionText = `(DP${finalSourceIdForConnection} ${predicateName} DP${finalTargetIdForConnection}) #MANUAL_EDIT ${getFormattedTimestamp()}`;
    
    const currentInput = inputTextElem.value.trim();
    inputTextElem.value = (currentInput ? currentInput + '\n' : '') + newNodeDefinition + '\n' + newConnectionText;
    
    signalNewNodeAddition(); 

    if (currentLayoutIsSaved && cyInstance && cyInstance.nodes().length > 0) {
        await saveCurrentNodesLayout();
    }
    
    setEdgeCreationStatus('idle'); 
    renderButton.click();

    setTimeout(() => {
        const cy = getCyInstance();
        if (cy) {
            const newNode = cy.getElementById(newNodeIdPart) as NodeSingular;
            if (newNode && newNode.length > 0) {
                selectNodeInGraph(newNode);
                centerOnNode(newNode);
            }
        }
    }, 500); 
}

function handleCancelConnectionToNewNode(): void {
    setEdgeCreationStatus('idle');
}


// --- Node Text Editing & Deletion ---
export function handleUpdateNodeText(nodeId: string, newText: string): void {
    if (!inputTextElem || !renderButton || (edgeCreationStatus !== 'idle' && edgeCreationStatus !== 'source_selected_pending_target')) {
        if (edgeCreationStatus !== 'idle' && edgeCreationStatus !== 'source_selected_pending_target') {
            addMainPanelError("Complete or cancel current edge operation before editing text.");
        }
        return;
    }
    recordSnapshot();
    
    const lines = inputTextElem.value.split('\n');
    const nodeLineRegex = new RegExp(`^DP${nodeId}(?:\\.\\w+)?:`);
    const nodeLineIndex = lines.findIndex(line => nodeLineRegex.test(line));
    
    if (nodeLineIndex !== -1) {
        const oldLine = lines[nodeLineIndex];
        const definitionPart = oldLine.split(':')[0];
        
        const commentMatch = oldLine.match(/(\s*#.*)$/);
        const oldCommentWithHashtag = commentMatch ? commentMatch[1] : '';

        // Regex to find and remove a previous manual edit comment, with or without a timestamp
        const manualEditCommentRegex = /\s*#MANUAL_EDIT(?:\s+on\s+[\d.:\s]+at\s+[\d.:]+)?/;
        const otherComments = oldCommentWithHashtag.replace(manualEditCommentRegex, '').trim();

        const newManualEditComment = `#MANUAL_EDIT ${getFormattedTimestamp()}`;

        // Re-assemble the comment string
        const finalComment = otherComments ? `${otherComments} ${newManualEditComment}` : ` ${newManualEditComment}`;

        lines[nodeLineIndex] = `${definitionPart}: ${newText.trim()}${finalComment}`;
        inputTextElem.value = lines.join('\n');
        
        renderButton.click(); 
        
        if (detailsNodeSaveTextButton) detailsNodeSaveTextButton.style.display = 'none';
        originalNodeTextForEdit = newText; 

        // If Wikidata Link task was just run, re-populate the list
        if (detailsNodeSuggestionTaskSelector.value === DEFAULT_TEMPLATE_SUGGEST_EDIT_WIKIDATA_LINK_NAME) {
            populateWikidataReferencesList(newText);
        }

    } else {
        addMainPanelError(`Node DP${nodeId} not found in text for updating.`);
    }
}

export function handleDeleteNode(nodeId: string): void {
    if (!inputTextElem || !renderButton || (edgeCreationStatus !== 'idle' && edgeCreationStatus !== 'source_selected_pending_target')) {
         if (edgeCreationStatus !== 'idle' && edgeCreationStatus !== 'source_selected_pending_target') {
             addMainPanelError("Complete or cancel current edge operation before deleting node.");
         }
        return;
    }
    
    showCustomConfirmDialog(
        `Are you sure you want to delete DP${nodeId} and all its connections? This action will be recorded in the undo history.`,
        () => {
            recordSnapshot();
            let lines = inputTextElem.value.split('\n');
            
            const nodeLineRegex = new RegExp(`^DP${nodeId}(?:\\.\\w+)?:`);
            lines = lines.filter(line => !nodeLineRegex.test(line));

            const escapedNodeId = nodeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Regex to match connections involving the node, with optional type annotations
            const connectionRegex = new RegExp(`^\\s*\\((DP${escapedNodeId}(?:\\.\\w+)?\\s+\\w+\\s+DP\\w+(?:\\.\\w+)?|DP\\w+(?:\\.\\w+)?\\s+\\w+\\s+DP${escapedNodeId}(?:\\.\\w+)?)\\)`);
            lines = lines.filter(line => !connectionRegex.test(line.trim()));
            
            inputTextElem.value = lines.join('\n');
            hideDetailsPanel(); 
            renderButton.click();
        },
        undefined, 
        detailsPanel 
    );
}

export function handleDeleteEdge(sourceId: string, predicate: string, targetId: string): void {
     if (!inputTextElem || !renderButton || (edgeCreationStatus !== 'idle' && edgeCreationStatus !== 'source_selected_pending_target')) {
        if (edgeCreationStatus !== 'idle' && edgeCreationStatus !== 'source_selected_pending_target') {
            addMainPanelError("Complete or cancel current edge operation before deleting edge.");
        }
        return;
     }

    const confirmMessage = `Are you sure you want to delete the connection: (DP${sourceId} ${predicate} DP${targetId})? This action will be recorded in the undo history.`;

    showCustomConfirmDialog(confirmMessage, () => {
        recordSnapshot();
        const lines = inputTextElem.value.split('\n');
        const escapeRegExpLocal = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const sIdEsc = escapeRegExpLocal(sourceId);
        const pEsc = escapeRegExpLocal(predicate);
        const tIdEsc = escapeRegExpLocal(targetId);

        const edgePatternRegex = new RegExp(`^\\s*\\(DP${sIdEsc}(?:\\.\\w+)?\\s+${pEsc}\\s+DP${tIdEsc}(?:\\.\\w+)?\\)(?:.*)?$`);
        
        let filteredLines = lines.filter(line => !edgePatternRegex.test(line.trim()));
        
        if (lines.length === filteredLines.length) {
            if (symmetricPredicatesSet.has(predicate)) {
                const symmetricEdgePatternRegex = new RegExp(`^\\s*\\(DP${tIdEsc}(?:\\.\\w+)?\\s+${pEsc}\\s+DP${sIdEsc}(?:\\.\\w+)?\\)(?:.*)?$`);
                filteredLines = lines.filter(line => !symmetricEdgePatternRegex.test(line.trim()));
                if (lines.length === filteredLines.length) {
                     addMainPanelError("Could not find the exact edge (or its symmetric equivalent) to delete in the text."); return;
                }
            } else {
                addMainPanelError("Could not find the exact edge to delete in the text."); return;
            }
        }
        inputTextElem.value = filteredLines.join('\n');
        renderButton.click(); 
    },
    undefined, 
    detailsPanel 
    );
}

function handleRemoveSingleWikidataReference(qidToRemove: string): void {
    if (!detailsNodeEditTextArea) return;

    const currentText = detailsNodeEditTextArea.value;
    const escapedQid = qidToRemove.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Regex to find [Term](QID) and replace it with Term
    // It captures the "Term" part in $1
    const referencePattern = new RegExp(`\\[([^\\]]+?)\\]\\((${escapedQid})\\)`, 'g');
    
    const newText = currentText.replace(referencePattern, '$1');

    if (newText !== currentText) {
        detailsNodeEditTextArea.value = newText;
        // Dispatch input event to update save button visibility and originalNodeTextForEdit comparison
        detailsNodeEditTextArea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        
        // Refresh the Wikidata references list based on the new text
        populateWikidataReferencesList(newText);
        
        // Optionally, provide feedback
        if (detailsNodeAiLoadingIndicator) {
            detailsNodeAiLoadingIndicator.textContent = `Reference ${qidToRemove} removed.`;
            detailsNodeAiLoadingIndicator.style.color = getComputedCssVar('--success-text-color');
            detailsNodeAiLoadingIndicator.style.fontStyle = 'normal';
            detailsNodeAiLoadingIndicator.style.display = 'inline';
            setTimeout(() => {
                if (detailsNodeAiLoadingIndicator && detailsNodeAiLoadingIndicator.textContent === `Reference ${qidToRemove} removed.`) {
                    detailsNodeAiLoadingIndicator.style.display = 'none';
                }
            }, 2000);
        }
    } else {
        if (detailsNodeAiLoadingIndicator) {
            detailsNodeAiLoadingIndicator.textContent = `Reference ${qidToRemove} not found in text.`;
            detailsNodeAiLoadingIndicator.style.color = getComputedCssVar('--warning-color');
             detailsNodeAiLoadingIndicator.style.fontStyle = 'italic';
            detailsNodeAiLoadingIndicator.style.display = 'inline';
            setTimeout(() => {
                 if (detailsNodeAiLoadingIndicator && detailsNodeAiLoadingIndicator.textContent === `Reference ${qidToRemove} not found in text.`) {
                    detailsNodeAiLoadingIndicator.style.display = 'none';
                }
            }, 2000);
        }
    }
}


function populateWikidataReferencesList(text: string) {
    if (!detailsNodeWikidataReferencesList) return;
    detailsNodeWikidataReferencesList.innerHTML = '';
    const referenceRegex = /\[([^\]]+?)\]\((Q\d+?)\)/g;
    let match;
    const qidsFound = new Set<string>();
    const termQidMap = new Map<string, string>(); // term from text -> QID

    while ((match = referenceRegex.exec(text)) !== null) {
        const termInText = match[1];
        const qid = match[2];
        qidsFound.add(qid);
        if (!termQidMap.has(qid)) { 
            termQidMap.set(qid, termInText);
        }
    }

    if (qidsFound.size === 0) {
        detailsNodeWikidataReferencesList.style.display = 'none';
        return;
    }

    qidsFound.forEach(qid => {
        const itemDetails = getWikidataItemDetails(qid);
        const termFromText = termQidMap.get(qid) || "Unknown Term";

        const itemDiv = document.createElement('div');
        itemDiv.className = 'wikidata-reference-item';

        const textContentDiv = document.createElement('div');
        textContentDiv.className = 'wikidata-item-text-content';

        const termSpan = document.createElement('span');
        termSpan.className = 'user-term';
        termSpan.textContent = termFromText;

        const qidSpan = document.createElement('span');
        qidSpan.className = 'qid';
        qidSpan.textContent = `(${qid})`;
        
        const labelSpan = document.createElement('span');
        labelSpan.className = 'official-label';
        labelSpan.textContent = itemDetails ? `: ${itemDetails.label}` : ": (Details not cached)";
        
        textContentDiv.appendChild(termSpan);
        textContentDiv.appendChild(qidSpan);
        textContentDiv.appendChild(labelSpan);

        if (itemDetails && itemDetails.description) { 
            const descriptionSpan = document.createElement('span');
            descriptionSpan.className = 'description';
            const fullDescription = itemDetails.description;
            descriptionSpan.textContent = truncateText(fullDescription, 50); 
            descriptionSpan.title = fullDescription; 
            textContentDiv.appendChild(descriptionSpan);
        }
        
        itemDiv.appendChild(textContentDiv);

        // Add remove button
        const removeButton = document.createElement('button');
        removeButton.innerHTML = ICON_CANCEL_X;
        removeButton.className = 'icon-button remove-wikidata-reference-button';
        removeButton.title = `Remove all references to ${qid} (${termFromText})`;
        removeButton.dataset.qid = qid;
        removeButton.addEventListener('click', () => handleRemoveSingleWikidataReference(qid));
        itemDiv.appendChild(removeButton);
        
        detailsNodeWikidataReferencesList.appendChild(itemDiv);
    });

    detailsNodeWikidataReferencesList.style.display = 'block';
}


async function handleAiSuggestNodeTextEdit(): Promise<void> {
    const selectedNode = getSelectedNode();
    if (!selectedNode || !detailsNodeEditTextArea || !detailsNodeSuggestionTaskSelector || !detailsNodeSuggestAiButton || !detailsNodeAiLoadingIndicator || !detailsNodeWikidataReferencesList) return;

    const currentNodeTextInArea = detailsNodeEditTextArea.value;
    const selectedTaskTemplateName = detailsNodeSuggestionTaskSelector.value;

    if (!selectedTaskTemplateName) {
        detailsNodeAiLoadingIndicator.textContent = "Select an AI task first.";
        detailsNodeAiLoadingIndicator.style.color = 'var(--error-text-color)';
        detailsNodeAiLoadingIndicator.style.fontStyle = 'italic';
        detailsNodeAiLoadingIndicator.style.display = 'inline';
        setTimeout(() => {
            if (detailsNodeAiLoadingIndicator) detailsNodeAiLoadingIndicator.style.display = 'none';
        }, 3000);
        return;
    }
    
    // Clear previous Wikidata list before starting a new suggestion
    detailsNodeWikidataReferencesList.innerHTML = '';
    detailsNodeWikidataReferencesList.style.display = 'none';

    const nodeData = selectedNode.data() as CyNodeData;
    let connectedNodesInfoStr = "";
    const connectedEdges = selectedNode.connectedEdges();
    if (connectedEdges.length > 0) {
        const connectionLines: string[] = [];
        connectedEdges.forEach(edge => {
            const edgeData = edge.data() as CyEdgeData;
            const otherNode = edge.source().id() === selectedNode.id() ? edge.target() : edge.source();
            const otherNodeData = otherNode.data() as CyNodeData;
            const phrasing = predicatePhrasing[edgeData.label] || { symmetric: edgeData.label, incoming: edgeData.label, outgoing: edgeData.label };
            
            let line = `- `;
            if (edge.source().id() === selectedNode.id()) { 
                 line += `'${phrasing.outgoing || edgeData.label}' DP${otherNode.id()}: ${truncateText(otherNodeData.rawText, maxDetailPanelLabelLength)}`;
            } else if (edge.target().id() === selectedNode.id()) { 
                 line += `DP${otherNode.id()}: ${truncateText(otherNodeData.rawText, maxDetailPanelLabelLength)} '${phrasing.incoming || edgeData.label}' this node (DP${selectedNode.id()})`;
            } else { 
                 line += `'${phrasing.symmetric || edgeData.label}' DP${otherNode.id()}: ${truncateText(otherNodeData.rawText, maxDetailPanelLabelLength)}`;
            }
            connectionLines.push(line);
        });
        connectedNodesInfoStr = connectionLines.join('\n');
    } else {
        connectedNodesInfoStr = "This node has no existing connections.";
    }

    const context: EditSuggestionContext = {
        NODE_ID: nodeData.id,
        CURRENT_NODE_TEXT: currentNodeTextInArea,
        CONNECTED_NODES_INFO: connectedNodesInfoStr
    };

    detailsNodeSuggestAiButton.disabled = true;
    detailsNodeAiLoadingIndicator.textContent = 'AI thinking...'; // Default for single-step or start of multi-step
    detailsNodeAiLoadingIndicator.style.color = getComputedCssVar('--text-color');
    detailsNodeAiLoadingIndicator.style.fontStyle = 'italic';
    detailsNodeAiLoadingIndicator.style.display = 'inline';

    let suggestion: string | null = null;
    let progressUpdateTimer: number | null = null;

    const onProgress = (message: string) => {
        if (detailsNodeAiLoadingIndicator) {
            detailsNodeAiLoadingIndicator.textContent = message || 'Processing...'; 
            detailsNodeAiLoadingIndicator.style.color = getComputedCssVar('--text-color');
            detailsNodeAiLoadingIndicator.style.fontStyle = 'italic';
            detailsNodeAiLoadingIndicator.style.display = 'inline';
        }
        // Debounce clearing the message to avoid flicker if multiple onProgress calls happen quickly
        if (progressUpdateTimer) clearTimeout(progressUpdateTimer);
        if (message === "" && detailsNodeAiLoadingIndicator) { // Only set timer to hide if message is empty (signal to hide)
             progressUpdateTimer = window.setTimeout(() => {
                if(detailsNodeAiLoadingIndicator && detailsNodeAiLoadingIndicator.textContent !== 'AI thinking...'){ // Don't hide if another process started
                    detailsNodeAiLoadingIndicator.style.display = 'none';
                }
            }, 3000);
        }
    };

    suggestion = await suggestNodeTextEditViaAI(selectedTaskTemplateName, context, onProgress);
    
    detailsNodeSuggestAiButton.disabled = false;

    let messageForUser = "";
    let messageColor = getComputedCssVar('--text-color'); 

    console.log('Current text in area (trimmed):', `"${currentNodeTextInArea.trim()}"`);
    console.log('AI suggestion (trimmed):', suggestion ? `"${suggestion.trim()}"` : 'null');


    if (suggestion) {
        if (suggestion.trim() === currentNodeTextInArea.trim()) {
            console.log('AI Suggestion: No change detected.');
            messageForUser = "AI suggestion matches current text. No changes needed.";
            messageColor = getComputedCssVar('--text-color'); 
            detailsNodeAiLoadingIndicator.style.fontStyle = 'italic';
        } else {
            console.log('AI Suggestion: Applying new text.');
            detailsNodeEditTextArea.value = suggestion;
            detailsNodeEditTextArea.dispatchEvent(new Event('input', { bubbles:true, cancelable:true }));
            messageForUser = "AI suggestion applied.";
            messageColor = getComputedCssVar('--success-text-color');
            detailsNodeAiLoadingIndicator.style.fontStyle = 'normal';

            if (selectedTaskTemplateName === DEFAULT_TEMPLATE_SUGGEST_EDIT_WIKIDATA_LINK_NAME) {
                populateWikidataReferencesList(suggestion);
            }
        }
    } else {
        messageForUser = "AI suggestion failed. Check AI Lab/console.";
        messageColor = getComputedCssVar('--error-text-color');
        detailsNodeAiLoadingIndicator.style.fontStyle = 'italic';
    }
    
    if (progressUpdateTimer) clearTimeout(progressUpdateTimer); // Clear any pending hide timer
    detailsNodeAiLoadingIndicator.textContent = messageForUser;
    detailsNodeAiLoadingIndicator.style.color = messageColor;
    detailsNodeAiLoadingIndicator.style.display = 'inline'; 

    setTimeout(() => {
        if (detailsNodeAiLoadingIndicator) {
            detailsNodeAiLoadingIndicator.style.display = 'none';
            detailsNodeAiLoadingIndicator.textContent = 'AI thinking...'; 
        }
    }, 3000);
}


// --- Setup Details Panel UI based on Edit Mode & Node Selection ---
export function setupDetailsPanelForEditMode(node: NodeSingular | null) {
    const editActive = isEditModeActive();
    const status = getEdgeCreationStatus();
    const aiReady = isAiInitialized();

    // General visibility of non-edit vs edit text display
    if (selectedNodeTextDiv) selectedNodeTextDiv.style.display = editActive && node ? 'none' : 'block';
    if (editNodeTextContainer) editNodeTextContainer.style.display = editActive && node ? 'block' : 'none';
    
    // Save button for edited text (initially hidden by default, shown on text change)
    if (detailsNodeSaveTextButton) detailsNodeSaveTextButton.style.display = 'none'; 

    // --- Text Area and AI Suggest for the *SELECTED (SOURCE)* node ---
    if (detailsNodeEditTextArea) {
        if (editActive && node) {
            const nodeData = node.data() as CyNodeData;
            // Store original text for comparison only if it's not already being edited for this node
            // Or if the sub-operation is not active (meaning we are directly editing this node)
            if (originalNodeTextForEdit === null || 
                (detailsNodeEditTextArea.dataset.editingNodeId !== node.id()) ||
                (status === 'idle' || status === 'source_selected_pending_target') ) {
                originalNodeTextForEdit = nodeData.rawText || '';
            }
            detailsNodeEditTextArea.value = nodeData.rawText || ''; // Always show current rawText of the node
            detailsNodeEditTextArea.dataset.editingNodeId = node.id();

            // Disable text area if a connection sub-operation is active
            detailsNodeEditTextArea.disabled = (status === 'target_selected_pending_confirmation' || status === 'pending_new_node_input');
        } else { // Not editActive or no node selected
            detailsNodeEditTextArea.value = '';
            detailsNodeEditTextArea.disabled = true;
            originalNodeTextForEdit = null;
            delete detailsNodeEditTextArea.dataset.editingNodeId;
        }
    }

    // AI Suggest button, Task Selector for the source node
    if (detailsNodeSuggestAiButton && detailsNodeSuggestionTaskSelector && detailsNodeAiLoadingIndicator && detailsNodeWikidataReferencesList) {
        let showThisAiSuggestButton = false;
        let disableThisAiSuggestButton = true;

        if (editActive && node) {
            showThisAiSuggestButton = true; // Visible if node selected in edit mode
            // Enable if AI is ready AND it's not a sub-operation that locks the source node edit
            if (aiReady && (status === 'idle' || status === 'source_selected_pending_target')) {
                disableThisAiSuggestButton = false;
            }
        }

        detailsNodeSuggestAiButton.style.visibility = showThisAiSuggestButton ? 'visible' : 'hidden';
        detailsNodeSuggestionTaskSelector.style.visibility = showThisAiSuggestButton ? 'visible' : 'hidden';
        detailsNodeSuggestAiButton.disabled = disableThisAiSuggestButton;
        detailsNodeSuggestionTaskSelector.disabled = disableThisAiSuggestButton; // Also disable selector
        
        // Clear Wikidata list if AI suggest is not active or node changed
        if (!showThisAiSuggestButton || (node && detailsNodeWikidataReferencesList.dataset.nodeId !== node.id())) {
            detailsNodeWikidataReferencesList.innerHTML = '';
            detailsNodeWikidataReferencesList.style.display = 'none';
            if (node) detailsNodeWikidataReferencesList.dataset.nodeId = node.id();
            else delete detailsNodeWikidataReferencesList.dataset.nodeId;
        }

        if (detailsNodeAiLoadingIndicator.textContent !== 'AI thinking...' && 
            !detailsNodeAiLoadingIndicator.textContent?.startsWith("AI suggestion") &&
            !detailsNodeAiLoadingIndicator.textContent?.startsWith("Extracting terms") &&
            !detailsNodeAiLoadingIndicator.textContent?.startsWith("Querying Wikidata") &&
            !detailsNodeAiLoadingIndicator.textContent?.startsWith("Linking terms") &&
            !detailsNodeAiLoadingIndicator.textContent?.startsWith("No relevant terms") &&
            !detailsNodeAiLoadingIndicator.textContent?.startsWith("No results from Wikidata") &&
            !detailsNodeAiLoadingIndicator.textContent?.startsWith("Reference ") 
            ) {
             detailsNodeAiLoadingIndicator.style.display = 'none';
        }

        if (showThisAiSuggestButton) {
            detailsNodeSuggestAiButton.disabled = disableThisAiSuggestButton;
            detailsNodeSuggestionTaskSelector.innerHTML = '';
            const suggestionTemplates = getAllTemplateNames().filter(name => name.startsWith(DEFAULT_TEMPLATE_PREFIX_SUGGEST_EDIT));
            
            if (suggestionTemplates.length === 0) {
                const option = document.createElement('option');
                option.textContent = "No tasks defined";
                option.disabled = true;
                detailsNodeSuggestionTaskSelector.appendChild(option);
                if(!disableThisAiSuggestButton) detailsNodeSuggestAiButton.disabled = true;
            } else {
                suggestionTemplates.forEach(templateName => {
                    const option = document.createElement('option');
                    option.value = templateName;
                    let displayName = templateName.substring(DEFAULT_TEMPLATE_PREFIX_SUGGEST_EDIT.length);
                    if (displayName.startsWith("MY_")) { 
                        displayName = displayName.substring(3);
                    }
                    option.textContent = displayName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); 
                    detailsNodeSuggestionTaskSelector.appendChild(option);
                });
                const defaultWikidataTask = DEFAULT_TEMPLATE_SUGGEST_EDIT_WIKIDATA_LINK_NAME;
                const defaultDecontextTask = DEFAULT_TEMPLATE_SUGGEST_EDIT_DECONTEXTUALISE_NAME;

                if (suggestionTemplates.includes(defaultWikidataTask)) {
                    detailsNodeSuggestionTaskSelector.value = defaultWikidataTask;
                } else if (suggestionTemplates.includes(defaultDecontextTask)) {
                    detailsNodeSuggestionTaskSelector.value = defaultDecontextTask;
                }
            }
        } else {
             detailsNodeSuggestionTaskSelector.innerHTML = ''; 
        }
    }
    
    // Delete button for the selected (source) node
    if (detailsNodeDeleteButton) {
        let showDeleteButton = false;
        let disableDeleteButton = true;
        if (editActive && node) {
            showDeleteButton = true;
            // Enable if not in a sub-operation that locks the source node
            if (status === 'idle' || status === 'source_selected_pending_target') {
                disableDeleteButton = false;
            }
        }
        detailsNodeDeleteButton.style.display = showDeleteButton ? 'inline-block' : 'none';
        detailsNodeDeleteButton.disabled = disableDeleteButton;
    }

    // --- UI for connecting to EXISTING node ---
    if (confirmEdgeUIDiv) { 
        confirmEdgeUIDiv.style.display = (editActive && node && status === 'target_selected_pending_confirmation') ? 'block' : 'none';
    }
    // --- UI for connecting to NEW node ---
    if (addConnectionToNewNodeUIDiv) { 
         addConnectionToNewNodeUIDiv.style.display = (editActive && node && status === 'pending_new_node_input') ? 'block' : 'none';
    }
    
    // AI Suggest Button for the *NEW* node text (acnnSuggestAiButton)
    if (acnnSuggestAiButton && acnnAiLoadingIndicator) {
        const conditionsForAcnnUiAndNode = editActive && node && status === 'pending_new_node_input';
        
        acnnSuggestAiButton.style.visibility = conditionsForAcnnUiAndNode ? 'visible' : 'hidden';
        acnnSuggestAiButton.disabled = !(conditionsForAcnnUiAndNode && aiReady);

        if (acnnAiLoadingIndicator.textContent !== 'AI thinking...' && !acnnAiLoadingIndicator.textContent?.startsWith("AI suggestion")) {
            acnnAiLoadingIndicator.style.display = 'none';
        }
    }

    if (!editActive && status !== 'idle') {
        setEdgeCreationStatus('idle');
    }

    if (!node || !editActive) {
        if (detailsNodeWikidataReferencesList) {
            detailsNodeWikidataReferencesList.innerHTML = '';
            detailsNodeWikidataReferencesList.style.display = 'none';
            delete detailsNodeWikidataReferencesList.dataset.nodeId;
        }
    }
}