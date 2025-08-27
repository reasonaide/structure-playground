// dom.ts
export const toggleControlsButton = document.getElementById('toggleControlsButton') as HTMLButtonElement;
export const toggleDarkModeButton = document.getElementById('toggleDarkModeButton') as HTMLButtonElement;
export const controlsOverlay = document.getElementById('controlsOverlay') as HTMLDivElement;
export const inputTextElem = document.getElementById('inputText') as HTMLTextAreaElement;
export const renderButton = document.getElementById('renderButton') as HTMLButtonElement;
export const cyContainer = document.getElementById('cy') as HTMLDivElement;
export const errorDisplay = document.getElementById('errorDisplay') as HTMLDivElement;
export const searchTextElem = document.getElementById('searchText') as HTMLInputElement;
export const searchButton = document.getElementById('searchButton') as HTMLButtonElement;
export const manualTooltipDiv = document.getElementById('manual-tooltip') as HTMLDivElement;

// New Visualization Elements
export const visualizationWrapper = document.getElementById('visualization-wrapper') as HTMLDivElement;
export const toggleVisualizationButton = document.getElementById('toggleVisualizationButton') as HTMLButtonElement;
export const sunburstContainer = document.getElementById('sunburst-container') as HTMLDivElement;
export const sunburstControls = document.getElementById('sunburstControls') as HTMLDivElement;
export const sunburstDepthInput = document.getElementById('sunburstDepthInput') as HTMLInputElement;
export const sunburstDepthValue = document.getElementById('sunburstDepthValue') as HTMLSpanElement;
export const sunburstFitToggle = document.getElementById('sunburstFitToggle') as HTMLButtonElement;
export const sunburstLabelToggle = document.getElementById('sunburstLabelToggle') as HTMLButtonElement;
export const sunburstConnectionModeButtonGroup = document.getElementById('sunburstConnectionMode') as HTMLDivElement;
// New sunburst filter elements
export const toggleSunburstFilterButton = document.getElementById('toggleSunburstFilterButton') as HTMLButtonElement;
export const sunburstFilterPanel = document.getElementById('sunburstFilterPanel') as HTMLDivElement;


// Node Label Mode Selector
export const nodeLabelModeSelector = document.getElementById('nodeLabelModeSelector') as HTMLDivElement;

// Details Panel Elements
export const detailsPanel = document.getElementById('detailsPanel') as HTMLDivElement;
export const detailsPanelTitle = document.getElementById('detailsPanelTitle') as HTMLHeadingElement;
export const detailsPanelCloseButton = document.getElementById('detailsPanelCloseButton') as HTMLButtonElement; // New
export const detailsNodeCenterButton = document.getElementById('detailsNodeCenterButton') as HTMLButtonElement; // New
export const selectedNodeTextDiv = document.getElementById('selectedNodeText') as HTMLDivElement;
export const connectedNodesListDiv = document.getElementById('connectedNodesList') as HTMLDivElement;
export const detailsNodeDeleteButton = document.getElementById('detailsNodeDeleteButton') as HTMLButtonElement;
export const editNodeTextContainer = document.getElementById('editNodeTextContainer') as HTMLDivElement;
export const detailsNodeEditTextArea = document.getElementById('detailsNodeEditTextArea') as HTMLTextAreaElement;
export const detailsNodeSaveTextButton = document.getElementById('detailsNodeSaveTextButton') as HTMLButtonElement;
export const detailsNodeSuggestAiButton = document.getElementById('detailsNodeSuggestAiButton') as HTMLButtonElement; // New
export const detailsNodeSuggestionTaskSelector = document.getElementById('detailsNodeSuggestionTaskSelector') as HTMLSelectElement; // New
export const detailsNodeAiLoadingIndicator = document.getElementById('detailsNodeAiLoadingIndicator') as HTMLSpanElement; // New
export const detailsNodeWikidataReferencesList = document.getElementById('detailsNodeWikidataReferencesList') as HTMLDivElement;


// Confirm Edge UI Elements (in Details Panel - for existing node)
export const confirmEdgeUIDiv = document.getElementById('confirmEdgeUI') as HTMLDivElement;
export const confirmEdgeSourceInfoDiv = document.getElementById('confirmEdgeSourceInfo') as HTMLDivElement;
export const confirmEdgeTargetInfoDiv = document.getElementById('confirmEdgeTargetInfo') as HTMLDivElement;
export const confirmEdgePredicateSelect = document.getElementById('confirmEdgePredicateSelect') as HTMLSelectElement;
export const confirmEdgeConfirmButton = document.getElementById('confirmEdgeConfirmButton') as HTMLButtonElement;
export const confirmEdgeCancelButton = document.getElementById('confirmEdgeCancelButton') as HTMLButtonElement;

// Add Connection to New Node UI Elements (in Details Panel)
export const addConnectionToNewNodeUIDiv = document.getElementById('addConnectionToNewNodeUI') as HTMLDivElement;
export const acnnSourceInfoDiv = document.getElementById('acnnSourceInfo') as HTMLDivElement;
export const acnnPredicateSelect = document.getElementById('acnnPredicateSelect') as HTMLSelectElement;
export const acnnNewNodeTextArea = document.getElementById('acnnNewNodeTextArea') as HTMLTextAreaElement;
export const acnnNewNodeTypeSelector = document.getElementById('acnnNewNodeTypeSelector') as HTMLDivElement;
export const acnnNewNodeTypeGroup = document.getElementById('acnnNewNodeTypeGroup') as HTMLDivElement;
export const acnnConfirmButton = document.getElementById('acnnConfirmButton') as HTMLButtonElement;
export const acnnCancelButton = document.getElementById('acnnCancelButton') as HTMLButtonElement;
export const acnnSuggestAiButton = document.getElementById('acnnSuggestAiButton') as HTMLButtonElement; 
export const acnnAiLoadingIndicator = document.getElementById('acnnAiLoadingIndicator') as HTMLSpanElement; 
// New Contextual Text Elements
export const acnnContextualTextSection = document.getElementById('acnnContextualTextSection') as HTMLDivElement;
export const acnnContextPreviewContainer = document.getElementById('acnnContextPreviewContainer') as HTMLDivElement;
export const acnnContextPreviewText = document.getElementById('acnnContextPreviewText') as HTMLSpanElement;
export const acnnSuggestContextBothButton = document.getElementById('acnnSuggestContextBothButton') as HTMLButtonElement;
export const acnnEditContextButton = document.getElementById('acnnEditContextButton') as HTMLButtonElement;
export const acnnContextEditorContainer = document.getElementById('acnnContextEditorContainer') as HTMLDivElement;
export const acnnSubjectContextInput = document.getElementById('acnnSubjectContextInput') as HTMLInputElement;
export const acnnSuggestSubjectContextButton = document.getElementById('acnnSuggestSubjectContextButton') as HTMLButtonElement;
export const acnnObjectContextInput = document.getElementById('acnnObjectContextInput') as HTMLInputElement;
export const acnnSuggestObjectContextButton = document.getElementById('acnnSuggestObjectContextButton') as HTMLButtonElement;
export const acnnConfirmContextButton = document.getElementById('acnnConfirmContextButton') as HTMLButtonElement;


export const switchToManualInputButton = document.getElementById('switchToManualInputButton') as HTMLButtonElement;
export const switchToAiAssistantButton = document.getElementById('switchToAiAssistantButton') as HTMLButtonElement;
export const manualInputPanel = document.getElementById('manualInputPanel') as HTMLDivElement;
export const aiAssistantPanel = document.getElementById('aiAssistantPanel') as HTMLDivElement;
export const aiChatHistoryDiv = document.getElementById('aiChatHistory') as HTMLDivElement;
export const aiPromptInputElem = document.getElementById('aiPromptInput') as HTMLTextAreaElement;
export const sendAiPromptButton = document.getElementById('sendAiPromptButton') as HTMLButtonElement;
export const cancelAiPromptButton = document.getElementById('cancelAiPromptButton') as HTMLButtonElement;
export const aiLoadingIndicator = document.getElementById('aiLoadingIndicator') as HTMLDivElement;
export const aiModelSelector = document.getElementById('aiModelSelector') as HTMLSelectElement;
export const exportChatButton = document.getElementById('exportChatButton') as HTMLButtonElement;
export const importChatInput = document.getElementById('importChatInput') as HTMLInputElement;
export const clearChatButton = document.getElementById('clearChatButton') as HTMLButtonElement;
export const layoutSection = document.getElementById('layoutSection') as HTMLDivElement;

// New AI Tool Toggles
export const searchGroundingToggle = document.getElementById('searchGroundingToggle') as HTMLInputElement;
export const urlContextToggle = document.getElementById('urlContextToggle') as HTMLInputElement;
export const aiGroundingResultsDiv = document.getElementById('aiGroundingResultsDiv') as HTMLDivElement;

// New API Key Modal Elements
export const apiKeyModalOverlay = document.getElementById('apiKeyModalOverlay') as HTMLDivElement;
export const apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement;
export const apiKeySaveButton = document.getElementById('apiKeySaveButton') as HTMLButtonElement;
export const apiKeyProceedWithoutButton = document.getElementById('apiKeyProceedWithoutButton') as HTMLButtonElement;
export const apiKeySection = document.getElementById('apiKeySection') as HTMLDivElement;
export const setApiKeyButton = document.getElementById('setApiKeyButton') as HTMLButtonElement;
export const apiKeyUnsetButton = document.getElementById('apiKeyUnsetButton') as HTMLButtonElement; // New
export const apiKeyInitialSetupSection = document.getElementById('apiKeyInitialSetupSection') as HTMLDivElement; // New
export const apiKeyManageSection = document.getElementById('apiKeyManageSection') as HTMLDivElement; // New
export const apiKeyStatusMessage = document.getElementById('apiKeyStatusMessage') as HTMLParagraphElement; // New


// Custom Confirmation/Prompt Dialog Elements
export const customConfirmOverlay = document.getElementById('customConfirmOverlay') as HTMLDivElement;
export const customConfirmDialog = document.getElementById('customConfirmDialog') as HTMLDivElement;
export const customConfirmMessage = document.getElementById('customConfirmMessage') as HTMLParagraphElement;
export const customChoiceContainer = document.getElementById('customChoiceContainer') as HTMLDivElement;
export const customPromptInput = document.getElementById('customPromptInput') as HTMLInputElement; 
export const customConfirmOkButton = document.getElementById('customConfirmOkButton') as HTMLButtonElement;
export const customConfirmCancelButton = document.getElementById('customConfirmCancelButton') as HTMLButtonElement;

// Cloud Storage Elements
export const storageKeyInput = document.getElementById('storageKeyInput') as HTMLInputElement;
export const loadFromStorageButton = document.getElementById('loadFromStorageButton') as HTMLButtonElement;
export const saveToStorageButton = document.getElementById('saveToStorageButton') as HTMLButtonElement;
export const cloudStorageStatus = document.getElementById('cloudStorageStatus') as HTMLDivElement;
export const setupCloudSaveContainer = document.getElementById('setupCloudSaveContainer') as HTMLDivElement;
export const setupCloudSaveButton = document.getElementById('setupCloudSaveButton') as HTMLButtonElement;
export const autoSyncControlsContainer = document.getElementById('autoSyncControlsContainer') as HTMLDivElement;
export const autoSyncToggleCheckbox = document.getElementById('autoSyncToggle') as HTMLInputElement;
export const autoSyncStatusIndicator = document.getElementById('autoSyncStatusIndicator') as HTMLSpanElement;

// New Supabase Setup Modal Elements
export const supabaseSetupModalOverlay = document.getElementById('supabaseSetupModalOverlay') as HTMLDivElement;
export const supabaseSetupModalDialog = document.getElementById('supabaseSetupModalDialog') as HTMLDivElement;
export const supabaseUrlInput = document.getElementById('supabaseUrlInput') as HTMLInputElement;
export const supabaseKeyInput = document.getElementById('supabaseKeyInput') as HTMLInputElement;
export const supabaseSaveButton = document.getElementById('supabaseSaveButton') as HTMLButtonElement;
export const supabaseCancelButton = document.getElementById('supabaseCancelButton') as HTMLButtonElement;
export const supabaseSetupErrorDisplay = document.getElementById('supabaseSetupErrorDisplay') as HTMLDivElement;


// Edit Mode Elements
export const toggleEditModeButton = document.getElementById('toggleEditModeButton') as HTMLButtonElement;
export const editModeActionButtons = document.getElementById('editModeActionButtons') as HTMLDivElement;
export const addNodeButton = document.getElementById('addNodeButton') as HTMLButtonElement;
export const addEdgeButton = document.getElementById('addEdgeButton') as HTMLButtonElement;
export const undoButton = document.getElementById('undoButton') as HTMLButtonElement;
export const redoButton = document.getElementById('redoButton') as HTMLButtonElement;

// Layout Persistence Buttons
export const saveLayoutButton = document.getElementById('saveLayoutButton') as HTMLButtonElement;
export const loadLayoutButton = document.getElementById('loadLayoutButton') as HTMLButtonElement;
export const clearLayoutButton = document.getElementById('clearLayoutButton') as HTMLButtonElement;

// AI Lab Panel Elements
export const switchToAiLabButton = document.getElementById('switchToAiLabButton') as HTMLButtonElement;
export const aiLabPanel = document.getElementById('aiLabPanel') as HTMLDivElement;
export const aiTemplateSelector = document.getElementById('aiTemplateSelector') as HTMLSelectElement;
export const aiTemplateEditorTextArea = document.getElementById('aiTemplateEditorTextArea') as HTMLTextAreaElement;
export const aiTemplateSaveButton = document.getElementById('aiTemplateSaveButton') as HTMLButtonElement;
export const aiTemplateNewButton = document.getElementById('aiTemplateNewButton') as HTMLButtonElement;
export const aiTemplateDeleteButton = document.getElementById('aiTemplateDeleteButton') as HTMLButtonElement;
export const aiLabErrorDisplay = document.getElementById('aiLabErrorDisplay') as HTMLDivElement;

// New Help/API Key button
export const helpButton = document.getElementById('helpButton') as HTMLButtonElement;
