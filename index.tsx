// main.ts (formerly index.tsx)
import './index.css';
// Fix: Import NodeSingular from cytoscape
import { NodeSingular } from 'cytoscape';
import {
    toggleControlsButton, toggleDarkModeButton, controlsOverlay,
    switchToManualInputButton, switchToAiAssistantButton, manualInputPanel,
    aiAssistantPanel, inputTextElem, renderButton, layoutSection,
    searchTextElem, searchButton,
    storageKeyInput, loadFromStorageButton, saveToStorageButton, cloudStorageStatus,
    toggleEditModeButton, editModeActionButtons, addNodeButton, addEdgeButton, undoButton, redoButton,
    saveLayoutButton, loadLayoutButton, clearLayoutButton,
    detailsNodeDeleteButton, detailsNodeSaveTextButton, detailsPanelCloseButton, detailsNodeCenterButton,
    confirmEdgeConfirmButton, confirmEdgeCancelButton, acnnConfirmButton, acnnCancelButton,
    autoSyncToggleCheckbox, autoSyncStatusIndicator,
    nodeLabelModeSelector, 
    switchToAiLabButton, aiLabPanel, aiTemplateSelector,
    aiTemplateEditorTextArea, aiTemplateSaveButton, aiTemplateNewButton,
    aiTemplateDeleteButton, aiLabErrorDisplay,
    errorDisplay, 
    acnnSuggestAiButton, 
    detailsNodeSuggestAiButton,
    toggleVisualizationButton, sunburstContainer, cyContainer, sunburstControls, sunburstDepthInput, sunburstDepthValue, sunburstFitToggle,
    sunburstConnectionModeButtonGroup,
    toggleSunburstFilterButton, sunburstFilterPanel, sunburstLabelToggle,
    aiPromptInputElem as aiPromptInputTextAreaElem, // Renamed import for consistency
    sendAiPromptButton,
    detailsNodeEditTextArea,
    apiKeyModalOverlay, apiKeyInput, apiKeySaveButton, apiKeyProceedWithoutButton, setApiKeyButton, // New API Key elements
    setupCloudSaveButton, supabaseSetupModalOverlay, supabaseUrlInput, supabaseKeyInput,
    supabaseSaveButton, supabaseCancelButton
} from './dom.js';
import {
    initializeCytoscape, applyLayout, searchNodesAndHighlight,
    clearSearchHighlights, setNodeLabelModeAndUpdateGraph, getCyStylesheet, 
    isCyInitialized, getCyInstance, parseInputAndGetElements,
    setDefaultLayoutName, setInitialNodeLabelMode, 
    selectNodeInGraph, centerOnNode, getSelectedNode,
    saveCurrentNodesLayout, 
    clearSavedNodesLayout, setInitialLayoutState,
    hasSavedLayoutData, getCurrentLayoutName,
    InitializeCytoscapeOptions, NodeLabelMode,
    clearSelectionAndHideDetails
} from './cytoscapeService.js';
import {
    initializeAiService,
    saveApiKeyAndReload,
    proceedWithoutAiAndReload,
    showApiKeyModal,
    sendPromptToAI,
    exportChatAndStructure,
    importChatAndStructureHandler,
    clearChatAndAIServiceState,
    isAiInitialized,
    populateModelsIfNotLoaded,
    getSelectedModel,
    setInitialAiChatHistory,
    setCurrentAiStructure,
    getIsAIProcessing,
    initializeAiTemplates, getAllTemplateNames, getTemplate, setTemplate, deleteTemplate
} from './aiService.js';
import {
    DEFAULT_TEMPLATE_PREFIX_SUGGEST_EDIT,
    DEFAULT_TEMPLATE_SUGGEST_NEW_NODE_NAME,
    DEFAULT_TEMPLATE_RAI_RULESET_NAME,
    DEFAULT_TEMPLATE_SYSTEM_PROMPT_MAIN_NAME,
    DEFAULT_TEMPLATE_OUTPUT_FORMAT_RULES_NAME
} from './ai-config.js';
import { DEFAULT_SUPABASE_STORAGE_KEY, predicateColors, directedPredicates, undirectedPredicates, symmetricPredicatesSet } from './config.js';
import { addError, clearErrors, showCustomConfirmDialog, showCustomPromptDialog } from './utils.js';
import {
    saveRaiStructureToSupabase,
    loadRaiStructureFromSupabase,
    initialLoadGraphStructure,
    loadAiChatHistory,
    loadNodeLabelModeSetting,
    loadDetailsPanelCollapseState,
    loadControlsOverlayVisibility,
    saveControlsOverlayVisibility,
    saveActiveControlPanel,
    loadActiveControlPanel,
    loadSelectedNodeId,
    loadCurrentLayoutName,
    loadNodePositions,
    loadAutoSyncPreference,
    setAutoSyncEnabled,
    syncLocalStorageToSupabase,
    getAutoSyncEnabled,
    registerUIUpdaterForAutoSync,
    saveVisualizationMode,
    loadVisualizationMode,
    saveSunburstFitMode,
    loadSunburstFitMode,
    saveSunburstConnectionMode,
    loadSunburstConnectionMode,
    saveSunburstFilterState,
    loadSunburstFilterState,
    saveSunburstRootNodeId,
    loadSunburstRootNodeId,
    saveSunburstLabelState,
    loadSunburstLabelState,
    updateCloudStatus,
    initializeCloudStorageUI,
    showSupabaseSetupModal,
    hideSupabaseSetupModal,
    testAndSaveSupabaseConfig
} from './persistenceService.js';
import { setInitialDetailsPanelCollapseState, updateDetailsPanelVisibility } from './detailsPanelService.js';
import {
    initializeEditMode, toggleEditMode, isEditModeActive, performUndo, performRedo,
    handleAddNode, toggleAddEdgeMode, updateUndoRedoButtonStates, setEdgeCreationStatus,
    checkAndResetNewNodeAdditionFlag,
    getEdgeCreationStatus, // Added
    handleUpdateNodeText,  // Added
    handleDeleteNode       // Added
} from './editModeService.js';
import {
    ICON_GEAR, ICON_SUN, ICON_MOON, ICON_PENCIL, ICON_CHECK,
    ICON_PLUS, ICON_LINK, ICON_UNDO, ICON_REDO, ICON_TRASH, ICON_CANCEL_X, ICON_TARGET,
    ICON_AI_SUGGEST, ICON_SUNBURST, ICON_GRAPH_VIEW, ICON_FIT_TO_VIEW, ICON_FILL_SPACE,
    ICON_FILTER, ICON_LABEL_ON, ICON_LABEL_OFF
} from './icons.js';
import { renderSunburst, destroySunburst, highlightSunburstNode, SunburstConnectionMode } from './sunburstService.js';


let currentVisualizationMode: 'graph' | 'sunburst' = 'graph';
let sunburstFitMode: 'fit' | 'fill' = 'fit';
let sunburstShowLabels: boolean = true;
let sunburstConnectionMode: SunburstConnectionMode = 'incoming-symmetric';
let sunburstRootNodeId: string | null = null;
let sunburstFilterState: { [key: string]: boolean } = {};
let isFilterPanelVisible = false;

function setDarkMode(isDark: boolean): void {
    if (isDark) {
        document.body.classList.add('dark-mode');
        toggleDarkModeButton.innerHTML = ICON_SUN;
        toggleDarkModeButton.title = 'Switch to Light Mode';
    } else {
        document.body.classList.remove('dark-mode');
        toggleDarkModeButton.innerHTML = ICON_MOON;
        toggleDarkModeButton.title = 'Switch to Dark Mode';
    }
    if (isCyInitialized()) {
        const cy = getCyInstance();
        if (cy) {
            cy.style(getCyStylesheet());
        }
    }
    // Re-render sunburst if it's active, as colors might change
    if (currentVisualizationMode === 'sunburst') {
        renderCurrentVisualization();
    }
}

export function setInitialControlsOverlayVisibility(isVisible: boolean): void {
    if (controlsOverlay) {
        if (isVisible) {
            controlsOverlay.classList.remove('hidden');
            if (!getIsAIProcessing()) {
                toggleControlsButton.innerHTML = ICON_GEAR;
                toggleControlsButton.title = 'Hide Controls';
            }
        } else {
            controlsOverlay.classList.add('hidden');
            if (!getIsAIProcessing()) {
                toggleControlsButton.innerHTML = ICON_GEAR;
                toggleControlsButton.title = 'Show Controls';
            }
        }
    }
}

export function setInitialActiveControlPanel(panelName: 'manual' | 'ai' | 'ai_lab' | null): void {
    if (panelName === 'manual') {
        switchToManualInputButton.click();
    } else if (panelName === 'ai') {
        switchToAiAssistantButton.click();
    } else if (panelName === 'ai_lab') {
        switchToAiLabButton.click();
    } else {
        if (!switchToAiAssistantButton.classList.contains('active') && !switchToAiLabButton.classList.contains('active')) {
             switchToManualInputButton.click();
        }
    }
}

export function setInitialVisualizationMode(mode: 'graph' | 'sunburst' | null, shouldSave: boolean = true): void {
    setVisualizationMode(mode || 'graph', shouldSave); // Don't save on initial load
}

export function setInitialSunburstFitMode(mode: 'fit' | 'fill' | null): void {
    sunburstFitMode = mode || 'fit';
    if (sunburstFitToggle) {
        if (sunburstFitMode === 'fit') {
            sunburstFitToggle.innerHTML = ICON_FIT_TO_VIEW;
            sunburstFitToggle.title = 'Fit chart to viewport (current)';
        } else {
            sunburstFitToggle.innerHTML = ICON_FILL_SPACE;
            sunburstFitToggle.title = 'Fill available space (current)';
        }
    }
}

export function setInitialSunburstLabelState(show: boolean | null): void {
    sunburstShowLabels = show ?? true; // default to true if null
    if (sunburstLabelToggle) {
        if (sunburstShowLabels) {
            sunburstLabelToggle.innerHTML = ICON_LABEL_ON;
            sunburstLabelToggle.title = 'Hide chart labels (current)';
        } else {
            sunburstLabelToggle.innerHTML = ICON_LABEL_OFF;
            sunburstLabelToggle.title = 'Show chart labels (current)';
        }
    }
}


export function setInitialSunburstRootNodeId(nodeId: string | null): void {
    sunburstRootNodeId = nodeId;
}

export function setInitialSunburstConnectionMode(mode: SunburstConnectionMode | null): void {
    sunburstConnectionMode = mode || 'incoming-symmetric';
    if (sunburstConnectionModeButtonGroup) {
        sunburstConnectionModeButtonGroup.querySelectorAll('.connection-mode-button').forEach(btn => {
            btn.classList.remove('active');
            if ((btn as HTMLElement).dataset.mode === sunburstConnectionMode) {
                btn.classList.add('active');
            }
        });
    }
}


function updateGlobalLayoutButtonStates() {
    const hasSaved = hasSavedLayoutData();
    if (loadLayoutButton) loadLayoutButton.disabled = !hasSaved;
    if (clearLayoutButton) clearLayoutButton.disabled = !hasSaved;


    const layoutButtons = layoutSection.querySelectorAll('.button-group button[data-layout]');
    layoutButtons.forEach(btn => btn.classList.remove('active'));
    if (loadLayoutButton) loadLayoutButton.classList.remove('active');

    const activeLayout = getCurrentLayoutName();
    if (activeLayout === 'saved_layout' && hasSaved) {
        if (loadLayoutButton) loadLayoutButton.classList.add('active');
    } else {
        const activeButton = layoutSection.querySelector(`.button-group button[data-layout="${activeLayout}"]`);
        if (activeButton) activeButton.classList.add('active');
    }
}

// --- Sunburst Filter Panel ---
function updateToggleAllCheckboxState(groupElement: HTMLElement) {
    if (!groupElement) return;
    const toggleAllCheckbox = groupElement.querySelector('.toggle-all-checkbox') as HTMLInputElement | null;
    if (!toggleAllCheckbox) return;

    const childCheckboxes = Array.from(groupElement.querySelectorAll('.filter-item input[type="checkbox"]')) as HTMLInputElement[];
    if (childCheckboxes.length === 0) {
        toggleAllCheckbox.checked = false;
        toggleAllCheckbox.indeterminate = false;
        return;
    }

    const total = childCheckboxes.length;
    const checkedCount = childCheckboxes.filter(cb => cb.checked).length;

    if (checkedCount === 0) {
        toggleAllCheckbox.checked = false;
        toggleAllCheckbox.indeterminate = false;
    } else if (checkedCount === total) {
        toggleAllCheckbox.checked = true;
        toggleAllCheckbox.indeterminate = false;
    } else {
        toggleAllCheckbox.checked = false;
        toggleAllCheckbox.indeterminate = true;
    }
}

function updateAllToggleAllCheckboxes() {
    if (!sunburstFilterPanel) return;
    sunburstFilterPanel.querySelectorAll('.filter-panel-group').forEach(group => {
        updateToggleAllCheckboxState(group as HTMLElement);
    });
}

function updateFilterPanelDisabledState() {
    if (!sunburstFilterPanel) return;

    const groups: { [key: string]: Element | null } = {
        symmetric: sunburstFilterPanel.querySelector('[data-direction="symmetric"]'),
        incoming: sunburstFilterPanel.querySelector('[data-direction="incoming"]'),
        outgoing: sunburstFilterPanel.querySelector('[data-direction="outgoing"]')
    };

    // Reset all first
    Object.values(groups).forEach(group => {
        if (group) {
            group.classList.remove('disabled');
            group.querySelectorAll('input').forEach(input => (input as HTMLInputElement).disabled = false);
        }
    });

    const setDisabled = (group: Element | null) => {
        if (group) {
            group.classList.add('disabled');
            group.querySelectorAll('input').forEach(input => (input as HTMLInputElement).disabled = true);
        }
    };

    switch (sunburstConnectionMode) {
        case 'incoming-only':
            setDisabled(groups.symmetric);
            setDisabled(groups.outgoing);
            break;
        case 'outgoing-only':
            setDisabled(groups.symmetric);
            setDisabled(groups.incoming);
            break;
        case 'incoming-symmetric':
            setDisabled(groups.outgoing);
            break;
        case 'outgoing-symmetric':
            setDisabled(groups.incoming);
            break;
        case 'all':
            // All enabled, do nothing
            break;
    }
}


function updateSunburstFilterCheckboxes() {
    if (!sunburstFilterPanel) return;
    const checkboxes = sunburstFilterPanel.querySelectorAll('input[type="checkbox"].filter-checkbox');
    checkboxes.forEach(cb => {
        const checkbox = cb as HTMLInputElement;
        const key = checkbox.dataset.filterKey;
        if (key && sunburstFilterState.hasOwnProperty(key)) {
            checkbox.checked = sunburstFilterState[key];
        }
    });
    updateAllToggleAllCheckboxes();
}

function populateSunburstFilterPanel() {
    if (!sunburstFilterPanel) return;
    sunburstFilterPanel.innerHTML = '';

    const createGroup = (title: string, direction: 'symmetric' | 'incoming' | 'outgoing'): HTMLElement => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'filter-panel-group';
        groupDiv.dataset.direction = direction;
    
        const headerDiv = document.createElement('div');
        headerDiv.className = 'filter-group-header';
    
        const titleEl = document.createElement('h5');
        titleEl.textContent = title;
    
        const toggleAllContainer = document.createElement('div');
        toggleAllContainer.className = 'toggle-all-container';
    
        const toggleAllCheckbox = document.createElement('input');
        toggleAllCheckbox.type = 'checkbox';
        toggleAllCheckbox.id = `toggle-all-${direction}`;
        toggleAllCheckbox.className = 'toggle-all-checkbox';
        
        const toggleAllLabel = document.createElement('label');
        toggleAllLabel.htmlFor = toggleAllCheckbox.id;
        toggleAllLabel.className = 'toggle-all-label';
        toggleAllLabel.textContent = 'All';
    
        toggleAllContainer.appendChild(toggleAllCheckbox);
        toggleAllContainer.appendChild(toggleAllLabel);
        
        headerDiv.appendChild(titleEl);
        headerDiv.appendChild(toggleAllContainer);
        
        groupDiv.appendChild(headerDiv);
        sunburstFilterPanel.appendChild(groupDiv);
    
        toggleAllCheckbox.addEventListener('change', async () => {
            const isChecked = toggleAllCheckbox.checked;
            const childCheckboxes = groupDiv.querySelectorAll('.filter-item input[type="checkbox"]');
            let changed = false;
            childCheckboxes.forEach(cb => {
                const childCb = cb as HTMLInputElement;
                const key = childCb.dataset.filterKey;
                if (key && sunburstFilterState[key] !== isChecked) {
                    sunburstFilterState[key] = isChecked;
                    childCb.checked = isChecked;
                    changed = true;
                }
            });
            if (changed) {
                await saveSunburstFilterState(sunburstFilterState);
                if (currentVisualizationMode === 'sunburst') {
                    renderCurrentVisualization();
                }
            }
        });
    
        return groupDiv;
    };

    const createFilterItem = (group: HTMLElement, predicate: string, direction: 'symmetric' | 'incoming' | 'outgoing', labelText: string) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'filter-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        const filterKey = `${predicate}:${direction}`;
        checkbox.id = `filter-${filterKey.replace(':', '-')}`;
        checkbox.dataset.filterKey = filterKey;
        checkbox.className = 'filter-checkbox'; // Add class to distinguish from 'toggle-all'
        
        checkbox.addEventListener('change', async () => {
            sunburstFilterState[filterKey] = checkbox.checked;
            updateToggleAllCheckboxState(group); // Update parent state
            await saveSunburstFilterState(sunburstFilterState);
            if (currentVisualizationMode === 'sunburst') {
                renderCurrentVisualization();
            }
        });

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = labelText;

        itemDiv.appendChild(checkbox);
        itemDiv.appendChild(label);
        group.appendChild(itemDiv);
    };

    const symmetricGroup = createGroup('Symmetric', 'symmetric');
    Array.from(symmetricPredicatesSet).sort().forEach(p => createFilterItem(symmetricGroup, p, 'symmetric', p));

    const incomingGroup = createGroup('Incoming', 'incoming');
    Array.from(directedPredicates).sort().forEach(p => createFilterItem(incomingGroup, p, 'incoming', p));

    const outgoingGroup = createGroup('Outgoing', 'outgoing');
    Array.from(directedPredicates).sort().forEach(p => createFilterItem(outgoingGroup, p, 'outgoing', p));
    
    updateSunburstFilterCheckboxes();
}



// --- Visualization Mode ---
async function renderCurrentVisualization() {
    const cy = getCyInstance();
    if (!cy) {
        console.warn("Cannot render visualization, graph not initialized.");
        return;
    }

    if (currentVisualizationMode === 'sunburst') {
        if (!sunburstRootNodeId) {
            const firstNode = cy.nodes()[0];
            if (firstNode) {
                sunburstRootNodeId = firstNode.id();
                await saveSunburstRootNodeId(sunburstRootNodeId);
            } else {
                console.warn("Cannot render sunburst, no nodes exist to select a root.");
                destroySunburst();
                return;
            }
        }
        
        const selectedNodeId = cy.$('node:selected').id() || null;

        await renderSunburst(
            sunburstRootNodeId,
            parseInt(sunburstDepthInput.value, 10),
            sunburstFitMode,
            sunburstConnectionMode,
            sunburstFilterState,
            sunburstShowLabels,
            selectedNodeId,
            (nodeId) => { // onClick
                const node = cy.getElementById(nodeId);
                if (node?.length) {
                    selectNodeInGraph(node as NodeSingular);
                }
            },
            async (nodeId) => { // onDblClick
                sunburstRootNodeId = nodeId;
                await saveSunburstRootNodeId(sunburstRootNodeId);
                await renderCurrentVisualization();
            },
            () => { // onBackgroundClick
                 clearSelectionAndHideDetails();
            }
        );

    } else { // 'graph'
        destroySunburst();
    }
}


async function setVisualizationMode(mode: 'graph' | 'sunburst', shouldSave: boolean = true) {
    currentVisualizationMode = mode;
    if (detailsNodeCenterButton) {
        if (mode === 'graph') {
            detailsNodeCenterButton.title = 'Center View on this Node';
        } else {
            detailsNodeCenterButton.title = 'Set as Sunburst Center';
        }
    }
    if (mode === 'graph') {
        cyContainer.style.display = 'block';
        sunburstContainer.style.display = 'none';
        layoutSection.style.display = 'block';
        sunburstControls.style.display = 'none';
        toggleVisualizationButton.innerHTML = ICON_SUNBURST;
        toggleVisualizationButton.title = 'Switch to Sunburst View';
        if (toggleSunburstFilterButton) toggleSunburstFilterButton.style.display = 'none';
        if (sunburstFilterPanel && isFilterPanelVisible) {
            sunburstFilterPanel.style.display = 'none';
        }
        destroySunburst();
    } else { // sunburst
        cyContainer.style.display = 'none';
        sunburstContainer.style.display = 'block';
        layoutSection.style.display = 'none';
        sunburstControls.style.display = 'block';
        toggleVisualizationButton.innerHTML = ICON_GRAPH_VIEW;
        toggleVisualizationButton.title = 'Switch to Graph View';
        if (toggleSunburstFilterButton) toggleSunburstFilterButton.style.display = 'block';
        if (sunburstFilterPanel && isFilterPanelVisible) {
            sunburstFilterPanel.style.display = 'flex';
        }
        await renderCurrentVisualization();
    }
    if (shouldSave) {
        await saveVisualizationMode(mode);
    }
}


// --- AI Lab Specific Functions ---
let originalTemplateContent: string | null = null;
const RESERVED_TEMPLATE_PREFIXES = [
    DEFAULT_TEMPLATE_SYSTEM_PROMPT_MAIN_NAME.split('_')[0] + '_', 
    DEFAULT_TEMPLATE_RAI_RULESET_NAME.split('_')[0] + '_',       
    DEFAULT_TEMPLATE_OUTPUT_FORMAT_RULES_NAME.split('_')[0] + '_', 
    DEFAULT_TEMPLATE_SUGGEST_NEW_NODE_NAME.substring(0, DEFAULT_TEMPLATE_SUGGEST_NEW_NODE_NAME.lastIndexOf('_') + 1), 
    DEFAULT_TEMPLATE_PREFIX_SUGGEST_EDIT 
];


function populateAiTemplateSelector() {
    if (!aiTemplateSelector) return;
    aiTemplateSelector.innerHTML = '';
    const templateNames = getAllTemplateNames();
    if (templateNames.length === 0) {
        const option = document.createElement('option');
        option.textContent = "No templates available";
        option.disabled = true;
        aiTemplateSelector.appendChild(option);
        aiTemplateEditorTextArea.value = '';
        aiTemplateEditorTextArea.disabled = true;
        aiTemplateSaveButton.style.display = 'none';
        originalTemplateContent = null;
        return;
    }

    templateNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        aiTemplateSelector.appendChild(option);
    });
    aiTemplateSelector.value = templateNames[0]; 
    loadSelectedAiTemplateToEditor();
    aiTemplateEditorTextArea.disabled = false;
}

function loadSelectedAiTemplateToEditor() {
    if (!aiTemplateSelector || !aiTemplateEditorTextArea || !aiTemplateSaveButton) return;
    const selectedTemplateName = aiTemplateSelector.value;
    if (!selectedTemplateName || selectedTemplateName === "No templates available") {
        aiTemplateEditorTextArea.value = '';
        originalTemplateContent = null;
        aiTemplateEditorTextArea.disabled = true;
        aiTemplateSaveButton.style.display = 'none';
        return;
    }
    const content = getTemplate(selectedTemplateName);
    aiTemplateEditorTextArea.value = content || '';
    originalTemplateContent = content || '';
    aiTemplateEditorTextArea.disabled = false;
    aiTemplateSaveButton.style.display = 'none'; 
     if (aiLabErrorDisplay) aiLabErrorDisplay.style.display = 'none'; 
}

async function handleSaveAiTemplate() {
    if (!aiTemplateSelector || !aiTemplateEditorTextArea || !aiTemplateSaveButton) return;
    const templateName = aiTemplateSelector.value;
    const newContent = aiTemplateEditorTextArea.value;
    if (!templateName || templateName === "No templates available") {
        displayErrorInContext("Cannot save: No template selected.", aiLabErrorDisplay);
        return;
    }
    try {
        await setTemplate(templateName, newContent);
        originalTemplateContent = newContent;
        aiTemplateSaveButton.style.display = 'none';
        displayErrorInContext("Template saved successfully.", aiLabErrorDisplay, false); 
        setTimeout(() => {
            if (aiLabErrorDisplay && aiLabErrorDisplay.textContent === "Template saved successfully.") {
                aiLabErrorDisplay.style.display = 'none';
            }
        }, 2000);
    } catch (e: any) {
        displayErrorInContext(`Error saving template: ${e.message}`, aiLabErrorDisplay);
    }
}

async function handleNewAiTemplate() {
    if (aiLabErrorDisplay) {
        aiLabErrorDisplay.textContent = '';
        aiLabErrorDisplay.style.display = 'none';
    }

    showCustomPromptDialog(
        "Enter a name for the new AI template (e.g., MY_CUSTOM_ANALYSIS):",
        async (userInputName) => {
            if (!userInputName || !userInputName.trim()) {
                displayErrorInContext("Template name cannot be empty.", aiLabErrorDisplay);
                return;
            }
            let newTemplateName = userInputName.trim();
            if (!/^[A-Z0-9_]+$/i.test(newTemplateName)) {
                displayErrorInContext("Template name can only contain letters, numbers, and underscores.", aiLabErrorDisplay);
                return;
            }

            const hasReservedPrefix = RESERVED_TEMPLATE_PREFIXES.some(prefix => newTemplateName.toUpperCase().startsWith(prefix.toUpperCase()));
            if (hasReservedPrefix && !newTemplateName.toUpperCase().startsWith("MY_")) { 
                 const conflictingPrefix = RESERVED_TEMPLATE_PREFIXES.find(prefix => newTemplateName.toUpperCase().startsWith(prefix.toUpperCase()));
                 displayErrorInContext(`Template name cannot start with a reserved system prefix like '${conflictingPrefix}'. Try 'MY_${newTemplateName}'.`, aiLabErrorDisplay);
                 return;
            }

            if (!newTemplateName.toUpperCase().startsWith("MY_") && !hasReservedPrefix) {
                newTemplateName = `MY_${newTemplateName}`;
            }

            newTemplateName = newTemplateName.toUpperCase(); 

            if (getAllTemplateNames().map(n => n.toUpperCase()).includes(newTemplateName)) {
                displayErrorInContext(`Template "${newTemplateName}" already exists. Choose a different name.`, aiLabErrorDisplay);
                return;
            }

            try {
                await setTemplate(newTemplateName, `// Template: ${newTemplateName}\n// Add your content here.\n// You can use {{OtherTemplateName}} to embed other templates.`);
                populateAiTemplateSelector();
                aiTemplateSelector.value = newTemplateName;
                loadSelectedAiTemplateToEditor();
                displayErrorInContext(`Template "${newTemplateName}" created.`, aiLabErrorDisplay, false);
                setTimeout(() => {
                    if (aiLabErrorDisplay && aiLabErrorDisplay.textContent === `Template "${newTemplateName}" created.`) {
                        aiLabErrorDisplay.style.display = 'none';
                    }
                }, 2000);
            } catch (e: any) {
                displayErrorInContext(`Error creating template: ${e.message}`, aiLabErrorDisplay);
            }
        },
        () => {
            displayErrorInContext("New template creation cancelled.", aiLabErrorDisplay, false);
             setTimeout(() => {
                if (aiLabErrorDisplay && aiLabErrorDisplay.textContent === "New template creation cancelled.") {
                    aiLabErrorDisplay.style.display = 'none';
                }
            }, 1500);
        },
        controlsOverlay
    );
}

async function handleDeleteAiTemplate() {
    if (!aiTemplateSelector) return;
    const templateName = aiTemplateSelector.value;
    if (!templateName || templateName === "No templates available") {
        displayErrorInContext("No template selected to delete.", aiLabErrorDisplay);
        return;
    }

    showCustomConfirmDialog(
        `Are you sure you want to delete the template "${templateName}"? This action cannot be undone. If it's a core template, it will revert to its default content.`,
        async () => {
            try {
                await deleteTemplate(templateName);
                populateAiTemplateSelector();
                displayErrorInContext(`Template "${templateName}" deleted/reverted.`, aiLabErrorDisplay, false);
                setTimeout(() => {
                     if (aiLabErrorDisplay && aiLabErrorDisplay.textContent === `Template "${templateName}" deleted/reverted.`) {
                        aiLabErrorDisplay.style.display = 'none';
                    }
                }, 2000);
            } catch (e: any) {
                displayErrorInContext(`Error deleting template: ${e.message}`, aiLabErrorDisplay);
            }
        },
        undefined, 
        controlsOverlay,
        true 
    );
}

function displayErrorInContext(message: string, displayElement?: HTMLElement, isError: boolean = true): void {
    const targetEl = displayElement || errorDisplay; 

    if (targetEl) {
        if (targetEl === errorDisplay) { 
            clearErrors(); 
            errorDisplay.innerHTML += message + '<br>'; 
            errorDisplay.style.color = isError ? 'var(--error-text-color)' : 'var(--success-text-color)';
            errorDisplay.style.backgroundColor = isError ? 'var(--error-bg-color)' : 'var(--success-bg-color)';
            errorDisplay.style.borderColor = isError ? 'var(--error-border-color)' : 'var(--success-border-color)';
            errorDisplay.style.border = '1px solid';
            errorDisplay.style.padding = '8px 10px';
            errorDisplay.style.borderRadius = '4px';
            errorDisplay.style.display = 'block';
        } else { 
            targetEl.innerHTML = message; 
            targetEl.style.color = isError ? 'var(--error-text-color)' : 'var(--success-text-color)';
            targetEl.style.backgroundColor = isError ? 'var(--error-bg-color)' : 'var(--success-bg-color)';
            targetEl.style.borderColor = isError ? 'var(--error-border-color)' : 'var(--success-border-color)';
            if (!targetEl.classList.contains('error-display-inline')) {
                 targetEl.style.border = '1px solid';
                 targetEl.style.padding = '8px 10px';
                 targetEl.style.borderRadius = '4px';
            }
            targetEl.style.display = 'block';
        }
    }
    if (isError) console.warn(message); else console.log(message);
}

async function handleLoadAllDataForSlot(): Promise<void> {
    clearErrors();
    const currentSlot = storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY;
    if (!currentSlot) {
        addError("Cannot load: Slot ID is empty.");
        updateCloudStatus("Slot ID is empty.", true);
        return;
    }

    updateCloudStatus(`Loading all data from slot ${currentSlot}...`, false, 0);

    const loadOptions = { isExplicitLoad: true };

    // --- Load all data and state from persistence first ---
    await initializeAiTemplates();

    const layoutName = await loadCurrentLayoutName(currentSlot, loadOptions);
    const nodePositions = (layoutName === 'saved_layout') ? await loadNodePositions(currentSlot, loadOptions) : null;
    const controlsVisible = await loadControlsOverlayVisibility(currentSlot, loadOptions);
    const chatHistory = await loadAiChatHistory(currentSlot, loadOptions);
    const nodeLabelDispMode = await loadNodeLabelModeSetting(currentSlot, loadOptions);
    const vizMode = await loadVisualizationMode(currentSlot, loadOptions);
    const fitMode = await loadSunburstFitMode(currentSlot, loadOptions);
    const connMode = await loadSunburstConnectionMode(currentSlot, loadOptions);
    const labelState = await loadSunburstLabelState(currentSlot, loadOptions);
    const collapseState = await loadDetailsPanelCollapseState(currentSlot, loadOptions);
    const activePanel = await loadActiveControlPanel(currentSlot, loadOptions);
    const rootId = await loadSunburstRootNodeId(currentSlot, loadOptions);
    const structure = await loadRaiStructureFromSupabase(currentSlot, loadOptions);
    const loadedNodeIdForSlot = await loadSelectedNodeId(currentSlot, loadOptions);
    const loadedFilters = await loadSunburstFilterState(currentSlot, loadOptions);

    // --- Now apply the loaded states to the UI and global variables ---
    if (loadedFilters) {
        sunburstFilterState = loadedFilters;
        updateSunburstFilterCheckboxes();
    }

    setInitialLayoutState(layoutName, nodePositions);
    setInitialControlsOverlayVisibility(controlsVisible ?? !document.getElementById('controlsOverlay')?.classList.contains('hidden'));
    setInitialAiChatHistory(chatHistory ?? []);
    setInitialNodeLabelMode((nodeLabelDispMode ?? 'truncated') as NodeLabelMode);
    setInitialSunburstFitMode(fitMode ?? 'fit');
    setInitialSunburstConnectionMode((connMode as any) ?? 'incoming-symmetric');
    setInitialSunburstLabelState(labelState);
    setInitialDetailsPanelCollapseState(collapseState ?? {});
    setInitialActiveControlPanel(activePanel ?? 'manual');
    setInitialSunburstRootNodeId(rootId ?? null);
    updateFilterPanelDisabledState();
    setCurrentAiStructure(structure ?? "");

    if (structure !== null && inputTextElem) {
        inputTextElem.value = structure;
        try {
            const elements = parseInputAndGetElements(structure);
            await initializeCytoscape(elements, { retainSelectedNodeId: loadedNodeIdForSlot, preventRemoteClearSelection: true });
            if (!isCyInitialized() && structure.trim() !== "") {
                addError("Loaded data, but graph failed to render. Check format.");
            }
        } catch (error: any) {
            addError(`Error rendering loaded graph: ${error.message}`);
            console.error("Error rendering loaded graph:", error);
        }
    } else if (structure === null) {
        if (inputTextElem) inputTextElem.value = "";
        await initializeCytoscape(parseInputAndGetElements(""), { retainSelectedNodeId: loadedNodeIdForSlot, preventRemoteClearSelection: true });
    }

    // Set visualization mode last, as it triggers rendering with all the new state
    setInitialVisualizationMode((vizMode as any) ?? 'graph', false);

    const finalStatusMessage = cloudStorageStatus?.textContent?.includes("Loading") ? `Finished loading slot ${currentSlot}.` : (cloudStorageStatus?.textContent || `Operations for slot ${currentSlot} finished.`);
    const isFinalStatusError = cloudStorageStatus?.classList.contains('error') || false;
    updateCloudStatus(finalStatusMessage, isFinalStatusError, 5000);
}


function setupEventListeners(): void {
    toggleControlsButton.addEventListener('click', async () => {
        controlsOverlay.classList.toggle('hidden');
        const isVisible = !controlsOverlay.classList.contains('hidden');

        if (!getIsAIProcessing()) {
            toggleControlsButton.innerHTML = ICON_GEAR;
            if (isVisible) {
                toggleControlsButton.title = 'Hide Controls';
            } else {
                toggleControlsButton.title = 'Show Controls';
            }
        }
        await saveControlsOverlayVisibility(isVisible);
    });

    toggleDarkModeButton.addEventListener('click', () => {
        setDarkMode(!document.body.classList.contains('dark-mode'));
    });

    // --- API Key Modal Listeners ---
    if (apiKeySaveButton && apiKeyInput) {
        apiKeySaveButton.addEventListener('click', () => {
            saveApiKeyAndReload(apiKeyInput.value);
        });
        apiKeyInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveApiKeyAndReload(apiKeyInput.value);
            }
        });
    }
    if (apiKeyProceedWithoutButton) {
        apiKeyProceedWithoutButton.addEventListener('click', proceedWithoutAiAndReload);
    }
    if (setApiKeyButton) {
        setApiKeyButton.addEventListener('click', showApiKeyModal);
    }

    // --- Supabase Setup Modal Listeners ---
    if (setupCloudSaveButton) {
        setupCloudSaveButton.addEventListener('click', showSupabaseSetupModal);
    }
    if (supabaseSaveButton && supabaseUrlInput && supabaseKeyInput) {
        supabaseSaveButton.addEventListener('click', async () => {
            await testAndSaveSupabaseConfig(supabaseUrlInput.value.trim(), supabaseKeyInput.value.trim());
        });
    }
    if (supabaseCancelButton) {
        supabaseCancelButton.addEventListener('click', hideSupabaseSetupModal);
    }

    // --- Edit Mode Listeners ---
    toggleEditModeButton.addEventListener('click', toggleEditMode);
    addNodeButton.addEventListener('click', handleAddNode);
    addEdgeButton.addEventListener('click', toggleAddEdgeMode);
    undoButton.addEventListener('click', performUndo);
    redoButton.addEventListener('click', performRedo);

    // --- Details Panel Edit Listeners ---
    if (detailsNodeSaveTextButton) {
        detailsNodeSaveTextButton.addEventListener('click', () => {
            const selectedNode = getSelectedNode();
            if (selectedNode && detailsNodeEditTextArea) {
                const status = getEdgeCreationStatus();
                if (status === 'idle' || status === 'source_selected_pending_target') {
                    handleUpdateNodeText(selectedNode.id(), detailsNodeEditTextArea.value);
                } else {
                    displayErrorInContext("Complete or cancel current edge operation before editing text.");
                }
            }
        });
    }
    if (detailsNodeDeleteButton) {
        detailsNodeDeleteButton.addEventListener('click', () => {
            const selectedNode = getSelectedNode();
            if (selectedNode) {
                const status = getEdgeCreationStatus();
                if (status === 'idle' || status === 'source_selected_pending_target') {
                    handleDeleteNode(selectedNode.id());
                } else {
                    displayErrorInContext("Complete or cancel current edge operation before deleting node.");
                }
            }
        });
    }


    if (detailsPanelCloseButton) {
        detailsPanelCloseButton.addEventListener('click', clearSelectionAndHideDetails);
    }

    if (detailsNodeCenterButton) {
        detailsNodeCenterButton.addEventListener('click', async () => {
            const selectedNode = getSelectedNode();
            if (!selectedNode) return;

            if (currentVisualizationMode === 'graph') {
                centerOnNode(selectedNode);
            } else { // sunburst
                sunburstRootNodeId = selectedNode.id();
                await saveSunburstRootNodeId(sunburstRootNodeId);
                await renderCurrentVisualization();
            }
        });
    }

    toggleVisualizationButton.addEventListener('click', () => {
        setVisualizationMode(currentVisualizationMode === 'graph' ? 'sunburst' : 'graph');
    });

    toggleSunburstFilterButton.addEventListener('click', () => {
        isFilterPanelVisible = !isFilterPanelVisible;
        if (sunburstFilterPanel) {
            sunburstFilterPanel.style.display = isFilterPanelVisible ? 'flex' : 'none';
        }
    });

    sunburstDepthInput.addEventListener('input', () => {
        sunburstDepthValue.textContent = sunburstDepthInput.value;
    });

    sunburstDepthInput.addEventListener('change', () => {
        if (currentVisualizationMode === 'sunburst') {
            renderCurrentVisualization();
        }
    });

    if (sunburstLabelToggle) {
        sunburstLabelToggle.addEventListener('click', async () => {
            sunburstShowLabels = !sunburstShowLabels;
            setInitialSunburstLabelState(sunburstShowLabels); // Update UI
            await saveSunburstLabelState(sunburstShowLabels);
            if (currentVisualizationMode === 'sunburst') {
                renderCurrentVisualization();
            }
        });
    }

    sunburstFitToggle.addEventListener('click', async () => {
        sunburstFitMode = sunburstFitMode === 'fit' ? 'fill' : 'fit';
        if (sunburstFitMode === 'fit') {
            sunburstFitToggle.innerHTML = ICON_FIT_TO_VIEW;
            sunburstFitToggle.title = 'Fit chart to viewport (current)';
        } else {
            sunburstFitToggle.innerHTML = ICON_FILL_SPACE;
            sunburstFitToggle.title = 'Fill available space (current)';
        }
        await saveSunburstFitMode(sunburstFitMode);
        if (currentVisualizationMode === 'sunburst') {
            renderCurrentVisualization();
        }
    });

    sunburstConnectionModeButtonGroup.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        const button = target.closest('.connection-mode-button');
        if (button) {
            const mode = button.getAttribute('data-mode') as SunburstConnectionMode;
            if (mode && mode !== sunburstConnectionMode) {
                sunburstConnectionMode = mode;
                
                sunburstConnectionModeButtonGroup.querySelectorAll('.connection-mode-button').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                await saveSunburstConnectionMode(sunburstConnectionMode);
                updateFilterPanelDisabledState();
                if (currentVisualizationMode === 'sunburst') {
                    renderCurrentVisualization();
                }
            }
        }
    });

    renderButton.addEventListener('click', async () => {
        const rawInputText: string = inputTextElem.value;
        clearErrors(); 
        try {
            const layoutBeforeRenderIsSaved = getCurrentLayoutName() === 'saved_layout';
            const cyInstanceExistsAndHasNodes = isCyInitialized() && getCyInstance()?.nodes().length > 0;

            if (layoutBeforeRenderIsSaved && cyInstanceExistsAndHasNodes) {
                console.log("[RenderButton] Current layout is 'saved_layout'. Auto-saving current node positions before re-render due to edit.");
                await saveCurrentNodesLayout();
            }

            const elements = parseInputAndGetElements(rawInputText);

            // Set default sunburst root if not already set
            if (!sunburstRootNodeId) {
                const firstNode = elements.find(el => el.group === 'nodes');
                if (firstNode) {
                    sunburstRootNodeId = firstNode.data.id!;
                    await saveSunburstRootNodeId(sunburstRootNodeId);
                }
            }

            const currentCy = getCyInstance();
            const selectedNodeIdBeforeRender = currentCy?.$('node:selected').id() || null;

            let viewportToRetain: InitializeCytoscapeOptions['viewportToRetain'] = undefined;
            const cyInstanceForViewport = getCyInstance();

            if (getCurrentLayoutName() === 'saved_layout' && cyInstanceForViewport && isCyInitialized()) {
                viewportToRetain = {
                    zoom: cyInstanceForViewport.zoom(),
                    pan: cyInstanceForViewport.pan()
                };
                console.log("[RenderButton] Current layout (potentially just auto-saved) is 'saved_layout'. Capturing viewport:", viewportToRetain);
            }

            if (isEditModeActive()) {
                setEdgeCreationStatus('idle');
            }

            await initializeCytoscape(elements, {
                retainSelectedNodeId: selectedNodeIdBeforeRender,
                viewportToRetain: viewportToRetain
            });
            
            await renderCurrentVisualization();

            if (checkAndResetNewNodeAdditionFlag() && getCurrentLayoutName() === 'saved_layout') {
                console.log("[RenderButton] New node was added and current layout is 'saved_layout'. Auto-saving layout again to capture new node's position.");
                await saveCurrentNodesLayout();
            }

            if (isCyInitialized()) {
                await saveRaiStructureToSupabase(rawInputText);
            } else if(rawInputText.trim() === "") {
                 await saveRaiStructureToSupabase(rawInputText);
            } else {
                addError("Graph not rendered, changes not saved to cloud/cache. Check input format.");
            }
        } catch (error: any) {
            addError(`Fatal error processing input: ${error.message}`); 
            console.error("Fatal error processing input:", error);
            if(cloudStorageStatus) {
                cloudStorageStatus.textContent = "Save failed: Graph error.";
                cloudStorageStatus.className = 'cloud-status-message error';
                cloudStorageStatus.style.display = 'block';
                setTimeout(() => {
                    if (cloudStorageStatus.textContent === "Save failed: Graph error.") {
                         cloudStorageStatus.style.display = 'none';
                         cloudStorageStatus.textContent = '';
                    }
                }, 3000);
            }
        }
        updateGlobalLayoutButtonStates();
    });

    if (nodeLabelModeSelector) {
        nodeLabelModeSelector.querySelectorAll('.label-mode-button').forEach(button => {
            button.addEventListener('click', async (e) => {
                const mode = (e.target as HTMLButtonElement).dataset.mode as NodeLabelMode;
                if (mode) {
                    await setNodeLabelModeAndUpdateGraph(mode);
                }
            });
        });
    }

    searchButton.addEventListener('click', searchNodesAndHighlight);
    searchTextElem.addEventListener('keyup', (event: KeyboardEvent) => {
        if (event.key === 'Enter') searchNodesAndHighlight();
    });

    layoutSection.querySelectorAll('button[data-layout]').forEach(button => {
        button.addEventListener('click', (e) => {
            const layoutName = (e.target as HTMLButtonElement).dataset.layout;
            if (layoutName) {
                applyLayout(layoutName);
            }
        });
    });

    if (saveLayoutButton) saveLayoutButton.addEventListener('click', saveCurrentNodesLayout);
    if (loadLayoutButton) loadLayoutButton.addEventListener('click', () => applyLayout('saved_layout'));
    if (clearLayoutButton) clearLayoutButton.addEventListener('click', clearSavedNodesLayout);

    // AI Assistant Panel Listeners
    if (sendAiPromptButton) {
        sendAiPromptButton.addEventListener('click', sendPromptToAI);
    }
    if (aiPromptInputTextAreaElem) {
        aiPromptInputTextAreaElem.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendPromptToAI();
            }
        });
    }

    // AI Lab Panel Listeners
    if (aiTemplateSelector) {
        aiTemplateSelector.addEventListener('change', loadSelectedAiTemplateToEditor);
    }
    if (aiTemplateEditorTextArea) {
        aiTemplateEditorTextArea.addEventListener('input', () => {
            if (originalTemplateContent !== null && aiTemplateSaveButton) {
                aiTemplateSaveButton.style.display = aiTemplateEditorTextArea.value !== originalTemplateContent ? 'inline-block' : 'none';
            }
        });
    }
    if (aiTemplateSaveButton) {
        aiTemplateSaveButton.addEventListener('click', handleSaveAiTemplate);
    }
    if (aiTemplateNewButton) {
        aiTemplateNewButton.addEventListener('click', handleNewAiTemplate);
    }
    if (aiTemplateDeleteButton) {
        aiTemplateDeleteButton.addEventListener('click', handleDeleteAiTemplate);
    }

    // Panel Switcher Listeners
    const panelButtons = [switchToManualInputButton, switchToAiAssistantButton, switchToAiLabButton];
    const panels = [manualInputPanel, aiAssistantPanel, aiLabPanel];

    panelButtons.forEach((button, index) => {
        if (button) { // Add null check
            button.addEventListener('click', async () => {
                panelButtons.forEach(btn => btn?.classList.remove('active'));
                button.classList.add('active');
                panels.forEach(panel => {
                    if(panel) panel.style.display = 'none';
                });
                if (panels[index]) panels[index].style.display = 'block';

                let panelName: 'manual' | 'ai' | 'ai_lab' | null = null;
                if (index === 0) panelName = 'manual';
                else if (index === 1) panelName = 'ai';
                else if (index === 2) panelName = 'ai_lab';
                await saveActiveControlPanel(panelName);
            });
        }
    });

    // Chat Management Listeners
    const exportChatButton = document.getElementById('exportChatButton');
    if (exportChatButton) {
        exportChatButton.addEventListener('click', exportChatAndStructure);
    }
    const importChatInput = document.getElementById('importChatInput') as HTMLInputElement;
    if (importChatInput) {
        importChatInput.addEventListener('change', importChatAndStructureHandler);
    }
    const clearChatButton = document.getElementById('clearChatButton');
    if (clearChatButton) {
        clearChatButton.addEventListener('click', () => clearChatAndAIServiceState(true));
    }


    // Cloud Storage Listeners
    loadFromStorageButton.addEventListener('click', async () => {
        await handleLoadAllDataForSlot();

        // After loading, the sunburst view is automatically re-rendered if it's the active view
        // by the setInitialVisualizationMode call inside handleLoadAllDataForSlot.
        // We just need to check if the root node still exists.
        const cy = getCyInstance();
        if (sunburstRootNodeId && cy) {
            const rootNodeExists = cy.getElementById(sunburstRootNodeId).length > 0;
            if (!rootNodeExists) {
                sunburstRootNodeId = null; // Let renderCurrentVisualization pick a new default
                await saveSunburstRootNodeId(null);
                // Re-render if we had to clear the invalid root ID
                if (currentVisualizationMode === 'sunburst') {
                    await renderCurrentVisualization();
                }
            }
        } else if ((!cy || cy.nodes().length === 0) && sunburstRootNodeId) {
            sunburstRootNodeId = null;
            await saveSunburstRootNodeId(null);
        }
    });
    saveToStorageButton.addEventListener('click', async () => {
        clearErrors();
        const currentStructure = inputTextElem.value;
        if (isCyInitialized()) {
            await saveRaiStructureToSupabase(currentStructure);
        } else if (currentStructure.trim() === "") {
            await saveRaiStructureToSupabase(currentStructure);
        } else {
            addError("Graph not rendered. Changes not saved to cloud.");
        }
    });

    if (autoSyncToggleCheckbox) {
        autoSyncToggleCheckbox.addEventListener('change', () => {
            const isEnabled = autoSyncToggleCheckbox.checked;
            setAutoSyncEnabled(isEnabled, 'user');
            if (isEnabled) {
                showCustomConfirmDialog(
                    "Auto-Sync enabled. Do you want to sync any pending local changes to the cloud now?",
                    () => { syncLocalStorageToSupabase(); },
                    () => { updateCloudStatus("Manual sync skipped. Future changes will auto-sync.", false, 3000); },
                    controlsOverlay,
                    false
                );
            } else {
                 updateCloudStatus("Auto-Sync is now OFF.", false, 2000);
            }
        });
    }

    registerUIUpdaterForAutoSync((enabled, systemDisabled) => {
        if (!autoSyncToggleCheckbox || !autoSyncStatusIndicator) return;
        autoSyncToggleCheckbox.checked = enabled;
        autoSyncToggleCheckbox.disabled = systemDisabled;
        if (systemDisabled) {
            autoSyncStatusIndicator.style.display = 'inline-block';
            autoSyncStatusIndicator.title = "Auto-Sync disabled due to a connection error with the cloud storage. Changes are being saved to your browser's local storage. Manual Load/Save or page reload may be required to resolve.";
        } else {
            autoSyncStatusIndicator.style.display = 'none';
            autoSyncStatusIndicator.title = '';
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    // --- Set up UI and Icons ---
    toggleControlsButton.innerHTML = ICON_GEAR;
    toggleDarkModeButton.innerHTML = ICON_MOON;
    toggleEditModeButton.innerHTML = ICON_PENCIL;
    addNodeButton.innerHTML = ICON_PLUS;
    addEdgeButton.innerHTML = ICON_LINK;
    undoButton.innerHTML = ICON_UNDO;
    redoButton.innerHTML = ICON_REDO;
    detailsNodeDeleteButton.innerHTML = ICON_TRASH;
    if (detailsPanelCloseButton) detailsPanelCloseButton.innerHTML = ICON_CANCEL_X;
    if (detailsNodeCenterButton) detailsNodeCenterButton.innerHTML = ICON_TARGET;
    confirmEdgeConfirmButton.innerHTML = ICON_CHECK;
    confirmEdgeCancelButton.innerHTML = ICON_CANCEL_X;
    acnnConfirmButton.innerHTML = ICON_CHECK;
    acnnCancelButton.innerHTML = ICON_CANCEL_X;
    acnnSuggestAiButton.innerHTML = ICON_AI_SUGGEST;
    if (aiTemplateNewButton) aiTemplateNewButton.innerHTML = ICON_PLUS;
    if (aiTemplateDeleteButton) aiTemplateDeleteButton.innerHTML = ICON_TRASH;
    if (aiTemplateSaveButton) aiTemplateSaveButton.innerHTML = ICON_CHECK;
    if (detailsNodeSuggestAiButton) detailsNodeSuggestAiButton.innerHTML = ICON_AI_SUGGEST;
    if (detailsNodeSaveTextButton) detailsNodeSaveTextButton.innerHTML = ICON_CHECK;
    toggleVisualizationButton.innerHTML = ICON_SUNBURST;
    if (toggleSunburstFilterButton) toggleSunburstFilterButton.innerHTML = ICON_FILTER;
    if(sunburstFitToggle) sunburstFitToggle.innerHTML = ICON_FIT_TO_VIEW;
    if(sunburstLabelToggle) sunburstLabelToggle.innerHTML = ICON_LABEL_ON;

    // --- Automatic Theme Detection ---
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(prefersDark);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => setDarkMode(e.matches));


    // --- Initialize Services and Listeners ---
    if (isEditModeActive()) {
        toggleEditMode();
    }
    initializeEditMode();
    
    setupEventListeners();
    populateSunburstFilterPanel();

    // --- Load Persistent State and Data ---
    initializeCloudStorageUI(); // New: Initialize cloud storage button/toggle visibility
    const { enabled: autoSyncEnabled, systemDisabledDueToError } = loadAutoSyncPreference();
    if (autoSyncToggleCheckbox) autoSyncToggleCheckbox.checked = autoSyncEnabled;
    if (autoSyncStatusIndicator) {
        autoSyncStatusIndicator.style.display = systemDisabledDueToError ? 'inline-block' : 'none';
        if (systemDisabledDueToError) {
             autoSyncStatusIndicator.title = "Auto-Sync was disabled due to a previous connection error. Changes were saved locally. Please check your connection and consider manually loading.";
        }
    }

    await initializeAiService(); // This will now handle the API key check and modal
    populateAiTemplateSelector();

    const currentSlot = storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY;
    if(storageKeyInput && !storageKeyInput.value) {
        storageKeyInput.value = DEFAULT_SUPABASE_STORAGE_KEY;
    }

    await initialLoadGraphStructure();

    // --- Load all states from persistence BEFORE setting them to avoid race conditions ---
    const chatHistory = await loadAiChatHistory(currentSlot, { isExplicitLoad: false });
    const nodeLabelDispMode = await loadNodeLabelModeSetting(currentSlot, { isExplicitLoad: false });
    const collapseState = await loadDetailsPanelCollapseState(currentSlot, { isExplicitLoad: false });
    const vizMode = await loadVisualizationMode(currentSlot, { isExplicitLoad: false });
    const fitMode = await loadSunburstFitMode(currentSlot, { isExplicitLoad: false });
    const connMode = await loadSunburstConnectionMode(currentSlot, { isExplicitLoad: false });
    const labelState = await loadSunburstLabelState(currentSlot, { isExplicitLoad: false });
    const rootId = await loadSunburstRootNodeId(currentSlot, { isExplicitLoad: false });
    const loadedFilters = await loadSunburstFilterState(currentSlot, { isExplicitLoad: false });
    const controlsVisible = await loadControlsOverlayVisibility(currentSlot, { isExplicitLoad: false });
    const activePanel = await loadActiveControlPanel(currentSlot, { isExplicitLoad: false });

    // --- Now, apply the loaded states to the UI and global variables ---
    setInitialAiChatHistory(chatHistory ?? []);
    setInitialNodeLabelMode((nodeLabelDispMode ?? 'truncated') as NodeLabelMode);
    setInitialDetailsPanelCollapseState(collapseState ?? {});
    setInitialSunburstRootNodeId(rootId);
    
    if (loadedFilters) {
        sunburstFilterState = loadedFilters;
    } else {
        // Default to all true if nothing is loaded
        sunburstFilterState = {};
        symmetricPredicatesSet.forEach(p => sunburstFilterState[`${p}:symmetric`] = true);
        directedPredicates.forEach(p => {
            sunburstFilterState[`${p}:incoming`] = true;
            sunburstFilterState[`${p}:outgoing`] = true;
        });
    }
    updateSunburstFilterCheckboxes();
    updateFilterPanelDisabledState();

    setInitialControlsOverlayVisibility(controlsVisible ?? !controlsOverlay.classList.contains('hidden'));
    setInitialActiveControlPanel(activePanel ?? 'manual');
    
    setInitialSunburstFitMode(fitMode ?? 'fit');
    setInitialSunburstLabelState(labelState);
    setInitialSunburstConnectionMode((connMode as SunburstConnectionMode) ?? 'incoming-symmetric');
    
    // Set visualization mode last, as it triggers rendering with the correct, fully-loaded state
    setInitialVisualizationMode(vizMode ?? 'graph', false);
});