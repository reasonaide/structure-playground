// persistenceService.ts
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_TABLE_NAME, DEFAULT_SUPABASE_STORAGE_KEY, DEFAULT_SAMPLE_STRUCTURE } from './config.js';
import { 
    inputTextElem, storageKeyInput, cloudStorageStatus, 
    setupCloudSaveContainer, setupCloudSaveButton, autoSyncControlsContainer, 
    supabaseSetupModalOverlay, supabaseUrlInput, supabaseKeyInput, 
    supabaseSetupErrorDisplay, supabaseSaveButton, controlsOverlay
} from './dom.js';
import { parseInputAndGetElements, initializeCytoscape, setInitialLayoutState, isCyInitialized } from './cytoscapeService.js';
import { addError as addErrorMessageToMainPanel, showCustomConfirmDialog } from './utils.js';
import { setCurrentAiStructure, initializeAiTemplates } from './aiService.js';
import { LOCAL_STORAGE_SUPABASE_URL, LOCAL_STORAGE_SUPABASE_KEY } from './ai-config.js';

// Define keys for different data types
export const RAI_STRUCTURE_DATA_KEY = "raiStructure";
export const AI_CHAT_HISTORY_KEY = "aiChatHistory";
export const NODE_LABEL_MODE_KEY = "nodeLabelModeSetting"; 
export const DETAILS_PANEL_COLLAPSE_STATE_KEY = "detailsPanelCollapseState";
export const CONTROLS_OVERLAY_VISIBILITY_KEY = "controlsOverlayVisibility";
export const ACTIVE_CONTROL_PANEL_KEY = "activeControlPanel"; 
export const SELECTED_NODE_ID_KEY = "selectedNodeId";       
export const SAVED_NODE_POSITIONS_KEY = "savedNodePositions";
export const CURRENT_LAYOUT_NAME_KEY = "currentLayoutName";
export const VISUALIZATION_MODE_KEY = "visualizationMode";
export const SUNBURST_FIT_MODE_KEY = "sunburstFitMode";
export const SUNBURST_CONNECTION_MODE_KEY = "sunburstConnectionMode";
export const SUNBURST_FILTER_STATE_KEY = "sunburstFilterState";
export const SUNBURST_ROOT_NODE_ID_KEY = "sunburstRootNodeId";
export const SUNBURST_LABEL_STATE_KEY = "sunburstLabelState";
export const AI_TEMPLATES_KEY_PREFIX = "aiTemplate_"; 

// Local Storage Keys
const LOCAL_STORAGE_AUTOSYNC_ENABLED_KEY = "raiGraphAutoSyncEnabled";
const LOCAL_STORAGE_AUTOSYNC_SYSTEM_DISABLED_KEY = "raiGraphAutoSyncSystemDisabled";
const getLocalStorageCacheKey = (slot: string, dataKey: string) => `raiGraphCache_${slot}_${dataKey}`;

let _isAutoSyncEnabled: boolean = true; 

// --- Supabase Config Management ---

function getSupabaseConfig(): { url: string; key: string } {
    try {
        const localUrl = localStorage.getItem(LOCAL_STORAGE_SUPABASE_URL);
        const localKey = localStorage.getItem(LOCAL_STORAGE_SUPABASE_KEY);
        if (localUrl && localKey) {
            return { url: localUrl, key: localKey };
        }
    } catch (e) {
        console.warn("Could not access localStorage for Supabase credentials.", e);
    }
    return { url: SUPABASE_URL, key: SUPABASE_KEY };
}

function isSupabaseConfigured(config: { url: string, key: string }): boolean {
    return config.url && config.url !== "YOUR_SUPABASE_URL" && config.key && config.key !== "YOUR_SUPABASE_ANON_KEY";
}

export function initializeCloudStorageUI(): void {
    const config = getSupabaseConfig();
    if (isSupabaseConfigured(config)) {
        if (setupCloudSaveContainer) setupCloudSaveContainer.style.display = 'none';
        if (autoSyncControlsContainer) autoSyncControlsContainer.style.display = 'flex';
    } else {
        if (setupCloudSaveContainer) setupCloudSaveContainer.style.display = 'block';
        if (autoSyncControlsContainer) autoSyncControlsContainer.style.display = 'none';
    }
}

export function showSupabaseSetupModal() {
    if (supabaseSetupModalOverlay) {
        supabaseSetupModalOverlay.style.display = 'flex';
        if (supabaseSetupErrorDisplay) supabaseSetupErrorDisplay.style.display = 'none';
        if (supabaseUrlInput) supabaseUrlInput.value = '';
        if (supabaseKeyInput) supabaseKeyInput.value = '';
    }
}

export function hideSupabaseSetupModal() {
    if (supabaseSetupModalOverlay) supabaseSetupModalOverlay.style.display = 'none';
}

function displaySupabaseModalError(message: string, isError: boolean = true): void {
    if (!supabaseSetupErrorDisplay) return;
    supabaseSetupErrorDisplay.textContent = message;
    supabaseSetupErrorDisplay.style.color = isError ? 'var(--error-text-color)' : 'var(--success-text-color)';
    supabaseSetupErrorDisplay.style.backgroundColor = isError ? 'var(--error-bg-color)' : 'var(--success-bg-color)';
    supabaseSetupErrorDisplay.style.borderColor = isError ? 'var(--error-border-color)' : 'var(--success-border-color)';
    supabaseSetupErrorDisplay.style.display = 'block';
}

export async function testAndSaveSupabaseConfig(url: string, key: string): Promise<void> {
    if (!url || !key) {
        displaySupabaseModalError("URL and Key cannot be empty.");
        return;
    }
    if (supabaseSaveButton) supabaseSaveButton.disabled = true;
    displaySupabaseModalError("Testing connection...", false);

    try {
        // Test query to check credentials and table existence
        const testQueryUrl = `${url}/rest/v1/${SUPABASE_TABLE_NAME}?select=key&limit=0`;
        const response = await fetch(testQueryUrl, {
            method: 'GET',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP Error ${response.status}: ${response.statusText}`}));
            const detailedMessage = errorData.message.includes("relation") && errorData.message.includes("does not exist")
                ? "Connection successful, but table not found. Please run the setup SQL script in your Supabase project."
                : `Connection failed: ${errorData.message}. Check URL and Key.`;
            throw new Error(detailedMessage);
        }

        // --- Success Case ---
        localStorage.setItem(LOCAL_STORAGE_SUPABASE_URL, url);
        localStorage.setItem(LOCAL_STORAGE_SUPABASE_KEY, key);
        
        hideSupabaseSetupModal();
        initializeCloudStorageUI();
        setAutoSyncEnabled(true, 'user');

        updateCloudStatus("Cloud storage successfully connected!", false, 4000);
        
        showCustomConfirmDialog(
            "Auto-Sync enabled. Do you want to sync any pending local changes to the cloud now?",
            () => { syncLocalStorageToSupabase(); },
            () => { updateCloudStatus("Manual sync skipped. Future changes will auto-sync.", false, 3000); },
            controlsOverlay,
            false
        );

    } catch (error: any) {
        console.error("Supabase connection test failed:", error);
        displaySupabaseModalError(error.message || "An unknown error occurred during connection test.");
    } finally {
        if (supabaseSaveButton) supabaseSaveButton.disabled = false;
    }
}


// --- AutoSync State Management ---
let _updateAutoSyncUICallback: ((enabled: boolean, systemDisabledDueToError: boolean) => void) | null = null;

export function registerUIUpdaterForAutoSync(updater: (enabled: boolean, systemDisabledDueToError: boolean) => void): void {
    _updateAutoSyncUICallback = updater;
}

export function getAutoSyncEnabled(): boolean {
    return _isAutoSyncEnabled;
}

export function setAutoSyncEnabled(enabled: boolean, reason?: 'user' | 'system_supabase_error'): void {
    const oldState = _isAutoSyncEnabled;
    _isAutoSyncEnabled = enabled;
    let systemDisabledDueToError = false;

    try {
        localStorage.setItem(LOCAL_STORAGE_AUTOSYNC_ENABLED_KEY, JSON.stringify(enabled));
        if (reason === 'system_supabase_error' && !enabled) {
            localStorage.setItem(LOCAL_STORAGE_AUTOSYNC_SYSTEM_DISABLED_KEY, 'true');
            systemDisabledDueToError = true;
        } else {
            localStorage.removeItem(LOCAL_STORAGE_AUTOSYNC_SYSTEM_DISABLED_KEY);
        }
    } catch (e) {
        console.warn("Could not save auto-sync preference/state to local storage:", e);
    }

    if (_updateAutoSyncUICallback) {
        const currentSystemDisabledFlag = localStorage.getItem(LOCAL_STORAGE_AUTOSYNC_SYSTEM_DISABLED_KEY) === 'true';
        const finalSystemDisabledState = !_isAutoSyncEnabled && currentSystemDisabledFlag;
        _updateAutoSyncUICallback(_isAutoSyncEnabled, finalSystemDisabledState);
    }

    if (oldState === true && enabled === false && reason === 'system_supabase_error') {
        updateCloudStatus("Auto-Sync disabled (connection issue). Changes saved locally.", true, 6000);
    }
}

export function loadAutoSyncPreference(): { enabled: boolean, systemDisabledDueToError: boolean } {
    let loadedEnabledState = true; 
    let loadedSystemDisabledState = false;
    try {
        const storedValue = localStorage.getItem(LOCAL_STORAGE_AUTOSYNC_ENABLED_KEY);
        if (storedValue !== null) {
            loadedEnabledState = JSON.parse(storedValue);
        }
        const storedSystemDisabled = localStorage.getItem(LOCAL_STORAGE_AUTOSYNC_SYSTEM_DISABLED_KEY);
        if (storedSystemDisabled === 'true') {
            loadedSystemDisabledState = true;
        }
    } catch (e) {
        console.warn("Could not load auto-sync preference from local storage:", e);
    }
    
    _isAutoSyncEnabled = loadedEnabledState;
    let systemDisabledDueToErrorOutput = false;

    if (!_isAutoSyncEnabled && loadedSystemDisabledState) {
        systemDisabledDueToErrorOutput = true;
    } else {
        localStorage.removeItem(LOCAL_STORAGE_AUTOSYNC_SYSTEM_DISABLED_KEY);
    }
    
    const initialReason = loadedEnabledState ? 'user' : (systemDisabledDueToErrorOutput ? 'system_supabase_error' : 'user');
    setAutoSyncEnabled(loadedEnabledState, initialReason);

    return { enabled: _isAutoSyncEnabled, systemDisabledDueToError: systemDisabledDueToErrorOutput };
}


export function updateCloudStatus(message: string, isError: boolean = false, duration: number = 3000): void {
    if (!cloudStorageStatus) return;
    cloudStorageStatus.textContent = message;
    cloudStorageStatus.className = 'cloud-status-message'; 
    if (isError) {
        cloudStorageStatus.classList.add('error');
    } else {
        cloudStorageStatus.classList.add('success');
    }
    cloudStorageStatus.style.display = 'block';

    if (duration > 0) {
        setTimeout(() => {
            if (cloudStorageStatus.textContent === message) { 
                 cloudStorageStatus.style.display = 'none';
                 cloudStorageStatus.textContent = '';
            }
        }, duration);
    }
}

// --- Local Storage Helpers ---
async function saveToLocalStorageOnly(dataKey: string, slot: string, value: any): Promise<boolean> {
    if (!slot) {
        updateCloudStatus(`Local Storage: Slot ID cannot be empty for saving ${dataKey}.`, true);
        return false;
    }
    const lsKey = getLocalStorageCacheKey(slot, dataKey);
    try {
        localStorage.setItem(lsKey, JSON.stringify(value));
        const statusMsg = _isAutoSyncEnabled 
            ? `Saved ${dataKey} to local cache (cloud issue).`
            : `Saved ${dataKey} to local cache (Auto-Sync OFF).`;
        updateCloudStatus(statusMsg, !_isAutoSyncEnabled, 2000); 
        console.log(`Saved ${dataKey} to LS for slot ${slot}:`, value ? (typeof value === 'string' && value.length > 100 ? value.substring(0,100) + "..." : value) : value);
        return true;
    } catch (error: any) {
        console.error(`Error saving ${dataKey} to Local Storage (slot ${slot}):`, error);
        updateCloudStatus(`Error saving ${dataKey} to local cache (slot ${slot}): ${error.message}`, true, 5000);
        return false;
    }
}

async function loadFromLocalStorageOnly(dataKey: string, slot: string): Promise<any | null> {
    if (!slot) {
        return null;
    }
    const lsKey = getLocalStorageCacheKey(slot, dataKey);
    try {
        const storedValue = localStorage.getItem(lsKey);
        if (storedValue !== null) {
            console.log(`Loaded ${dataKey} from LS for slot ${slot}`);
            return JSON.parse(storedValue);
        }
        return null;
    } catch (error: any) {
        console.error(`Error loading ${dataKey} from Local Storage (slot ${slot}):`, error);
        return null;
    }
}

function deepEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;
    if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
        return false;
    }
    try {
        return JSON.stringify(obj1) === JSON.stringify(obj2);
    } catch (e) {
        console.warn("DeepEqual: Error stringifying objects for comparison, falling back to false.", e);
        return false;
    }
}


// --- Modified Generic Save/Load ---
async function saveDataToSupabaseGeneric(dataKey: string, slot: string, value: any): Promise<boolean> {
    if (!slot) {
        updateCloudStatus(`Storage Slot ID cannot be empty for saving ${dataKey}.`, true);
        return false;
    }
    
    if (!getAutoSyncEnabled()) {
        return saveToLocalStorageOnly(dataKey, slot, value);
    }

    const lsKey = getLocalStorageCacheKey(slot, dataKey);
    try {
        const currentLocalValueRaw = localStorage.getItem(lsKey);
        if (currentLocalValueRaw !== null) {
            const currentLocalValue = JSON.parse(currentLocalValueRaw);
            if (deepEqual(currentLocalValue, value)) {
                console.log(`Data for ${dataKey} (slot ${slot}) is unchanged from local cache. Skipping cloud save.`);
                updateCloudStatus(`Saved ${dataKey} to local cache (already synced).`, false, 2000);
                return true;
            }
        }
    } catch (e) {
        console.warn(`Error comparing with local cache for ${dataKey} (slot ${slot}), proceeding with cloud save:`, e);
    }
    
    const config = getSupabaseConfig();
    if (!isSupabaseConfigured(config)) {
        updateCloudStatus(`Cloud not configured. Saving ${dataKey} to local cache (slot ${slot}).`, true, 4000);
        console.warn("Supabase URL or Key not configured. Saving to local cache.");
        if (getAutoSyncEnabled()) { 
            setAutoSyncEnabled(false, 'system_supabase_error');
        }
        return saveToLocalStorageOnly(dataKey, slot, value);
    }

    updateCloudStatus(`Saving ${dataKey} to cloud (slot ${slot})...`, false, 0); 

    try {
        const response = await fetch(`${config.url}/rest/v1/${SUPABASE_TABLE_NAME}`, {
            method: 'POST',
            headers: {
                'apikey': config.key,
                'Authorization': `Bearer ${config.key}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({ key: dataKey, slot: slot, value: JSON.stringify(value) })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`Cloud save error for ${dataKey} (${response.status}): ${errorData.message || 'Failed to save'}`);
        }
        
        localStorage.setItem(getLocalStorageCacheKey(slot, dataKey), JSON.stringify(value));
        console.log(`Cached ${dataKey} to LS for slot ${slot} after cloud save.`);
        updateCloudStatus(`Saved ${dataKey} to cloud & local cache (slot ${slot}).`, false);
        return true;
    } catch (error: any) {
        console.error(`Error saving ${dataKey} to cloud (slot ${slot}):`, error);
        const autoSyncWasOn = getAutoSyncEnabled();
        if (autoSyncWasOn) {
            setAutoSyncEnabled(false, 'system_supabase_error');
        }
        return saveToLocalStorageOnly(dataKey, slot, value); 
    }
}

async function loadDataFromSupabaseGeneric(dataKey: string, slot: string, options?: { isExplicitLoad?: boolean }): Promise<any | null> {
    if (!slot) {
        return null;
    }

    const autoSyncIsCurrentlyOn = getAutoSyncEnabled();
    const config = getSupabaseConfig();
    const supabaseConfigured = isSupabaseConfigured(config);
    const attemptSupabase = (options?.isExplicitLoad || autoSyncIsCurrentlyOn) && supabaseConfigured;

    if (attemptSupabase) {
        updateCloudStatus(`Loading ${dataKey} from cloud (slot ${slot})...`, false, 0); 
        try {
            const response = await fetch(`${config.url}/rest/v1/${SUPABASE_TABLE_NAME}?key=eq.${dataKey}&slot=eq.${slot}&select=value`, {
                method: 'GET',
                headers: {
                    'apikey': config.key,
                    'Authorization': `Bearer ${config.key}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                const errorMsg = `Cloud load error for ${dataKey}. Trying local cache.`;
                console.warn(`Cloud load error for ${dataKey} (${response.status}): ${errorData.message || 'Failed to load'}. Trying local cache.`);
                if (autoSyncIsCurrentlyOn) { 
                    setAutoSyncEnabled(false, 'system_supabase_error');
                } else if (options?.isExplicitLoad) { 
                     updateCloudStatus(errorMsg, true, 3000);
                }
            } else {
                const data = await response.json();
                if (data && data.length > 0 && data[0].value !== undefined) {
                    updateCloudStatus(`Loaded ${dataKey} from cloud (slot ${slot}).`, false);
                    try {
                        const parsedValue = JSON.parse(data[0].value);
                        localStorage.setItem(getLocalStorageCacheKey(slot, dataKey), data[0].value);
                        console.log(`Updated LS cache for ${dataKey} (slot ${slot}) from cloud.`);
                        return parsedValue;
                    } catch (parseError: any) {
                        console.error(`Error parsing ${dataKey} from cloud:`, parseError, "Raw value:", data[0].value);
                        updateCloudStatus(`Error parsing ${dataKey} from slot ${slot}. Data corrupted. Trying local cache.`, true, 5000);
                    }
                } else {
                    updateCloudStatus(`No data for ${dataKey} in cloud (slot ${slot}). Trying local cache.`, false, 2000);
                }
            }
        } catch (error: any) {
            const errorMsg = `Error loading ${dataKey} from cloud (slot ${slot}). Trying local cache.`;
            console.error(`Error loading ${dataKey} from cloud (slot ${slot}): ${error.message}. Trying local cache.`, error);
            if (autoSyncIsCurrentlyOn) {
                 setAutoSyncEnabled(false, 'system_supabase_error');
            } else if (options?.isExplicitLoad) {
                 updateCloudStatus(errorMsg, true, 5000);
            }
        }
    } else if (!supabaseConfigured && (options?.isExplicitLoad || autoSyncIsCurrentlyOn)) {
        const reason = autoSyncIsCurrentlyOn ? "Auto-Sync ON" : "Explicit load";
        updateCloudStatus(`Cloud not configured (${reason}). Loading ${dataKey} from local cache (slot ${slot}).`, false, 4000);
        if (autoSyncIsCurrentlyOn) { 
            setAutoSyncEnabled(false, 'system_supabase_error');
        }
    } else {
        console.log(`Skipping cloud for ${dataKey} (slot ${slot}). Auto-Sync OFF & not explicit load, or cloud not configured. Loading local cache.`);
    }

    const localData = await loadFromLocalStorageOnly(dataKey, slot);
    if (localData !== null) {
        if (!attemptSupabase || (cloudStorageStatus && cloudStorageStatus.textContent?.includes('Trying local cache'))) { 
             updateCloudStatus(`Loaded ${dataKey} from local cache (slot ${slot}).`, false, 2000);
        }
        return localData;
    }
    
    if (attemptSupabase && localData === null) {
        // Message might be "No data for ... in cloud. Trying local cache." then local is null.
    }
    return null;
}


export async function saveRaiStructureToSupabase(structure: string, slotToSave?: string): Promise<boolean> {
    const currentStorageSlot = slotToSave || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    return saveDataToSupabaseGeneric(RAI_STRUCTURE_DATA_KEY, currentStorageSlot, structure);
}

export async function loadRaiStructureFromSupabase(slotToLoad?: string, options?: { isExplicitLoad?: boolean }): Promise<string | null> {
    const currentStorageSlot = slotToLoad || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    const result = await loadDataFromSupabaseGeneric(RAI_STRUCTURE_DATA_KEY, currentStorageSlot, options);
    return typeof result === 'string' ? result : null;
}

export async function saveAiChatHistory(chatHistory: any[], slotToSave?: string): Promise<boolean> {
    const currentStorageSlot = slotToSave || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    return saveDataToSupabaseGeneric(AI_CHAT_HISTORY_KEY, currentStorageSlot, chatHistory);
}

export async function loadAiChatHistory(slotToLoad?: string, options?: { isExplicitLoad?: boolean }): Promise<any[] | null> {
    const currentStorageSlot = slotToLoad || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    const result = await loadDataFromSupabaseGeneric(AI_CHAT_HISTORY_KEY, currentStorageSlot, options);
    return Array.isArray(result) ? result : null;
}

export async function saveNodeLabelModeSetting(mode: string, slotToSave?: string): Promise<boolean> {
    const currentStorageSlot = slotToSave || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    return saveDataToSupabaseGeneric(NODE_LABEL_MODE_KEY, currentStorageSlot, mode);
}

export async function loadNodeLabelModeSetting(slotToLoad?: string, options?: { isExplicitLoad?: boolean }): Promise<string | null> {
    const currentStorageSlot = slotToLoad || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    const result = await loadDataFromSupabaseGeneric(NODE_LABEL_MODE_KEY, currentStorageSlot, options);
    if (result === 'full' || result === 'truncated' || result === 'none') {
        return result as string;
    }
    return null; 
}

export async function saveDetailsPanelCollapseState(state: { [key: string]: boolean }, slotToSave?: string): Promise<boolean> {
    const currentStorageSlot = slotToSave || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    return saveDataToSupabaseGeneric(DETAILS_PANEL_COLLAPSE_STATE_KEY, currentStorageSlot, state);
}

export async function loadDetailsPanelCollapseState(slotToLoad?: string, options?: { isExplicitLoad?: boolean }): Promise<{ [key: string]: boolean } | null> {
    const currentStorageSlot = slotToLoad || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    const result = await loadDataFromSupabaseGeneric(DETAILS_PANEL_COLLAPSE_STATE_KEY, currentStorageSlot, options);
    return typeof result === 'object' && result !== null && !Array.isArray(result) ? result : null;
}

export async function saveControlsOverlayVisibility(isVisible: boolean, slotToSave?: string): Promise<boolean> {
    const currentStorageSlot = slotToSave || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    return saveDataToSupabaseGeneric(CONTROLS_OVERLAY_VISIBILITY_KEY, currentStorageSlot, isVisible);
}

export async function loadControlsOverlayVisibility(slotToLoad?: string, options?: { isExplicitLoad?: boolean }): Promise<boolean | null> {
    const currentStorageSlot = slotToLoad || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    const result = await loadDataFromSupabaseGeneric(CONTROLS_OVERLAY_VISIBILITY_KEY, currentStorageSlot, options);
    return typeof result === 'boolean' ? result : null;
}

export async function saveActiveControlPanel(panelName: 'manual' | 'ai' | 'ai_lab' | null, slotToSave?: string): Promise<boolean> {
    const currentStorageSlot = slotToSave || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    return saveDataToSupabaseGeneric(ACTIVE_CONTROL_PANEL_KEY, currentStorageSlot, panelName);
}

export async function loadActiveControlPanel(slotToLoad?: string, options?: { isExplicitLoad?: boolean }): Promise<'manual' | 'ai' | 'ai_lab' | null> {
    const currentStorageSlot = slotToLoad || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    const result = await loadDataFromSupabaseGeneric(ACTIVE_CONTROL_PANEL_KEY, currentStorageSlot, options);
    if (result === 'manual' || result === 'ai' || result === 'ai_lab') {
        return result;
    }
    return null;
}

export async function saveSelectedNodeId(nodeId: string | null, slotToSave?: string): Promise<boolean> {
    const currentStorageSlot = slotToSave || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    console.log(`Attempting to save selected node ID: ${nodeId} to slot ${currentStorageSlot} (AutoSync: ${getAutoSyncEnabled()})`);
    return saveDataToSupabaseGeneric(SELECTED_NODE_ID_KEY, currentStorageSlot, nodeId);
}

export async function loadSelectedNodeId(slotToLoad?: string, options?: { isExplicitLoad?: boolean }): Promise<string | null> {
    const currentStorageSlot = slotToLoad || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    const result = await loadDataFromSupabaseGeneric(SELECTED_NODE_ID_KEY, currentStorageSlot, options);
    return typeof result === 'string' ? result : null;
}

export async function saveNodePositions(positions: Map<string, { x: number; y: number }> | null, slotToSave?: string): Promise<boolean> {
    const currentStorageSlot = slotToSave || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    const serializablePositions = positions ? Array.from(positions.entries()) : null;
    return saveDataToSupabaseGeneric(SAVED_NODE_POSITIONS_KEY, currentStorageSlot, serializablePositions);
}

export async function loadNodePositions(slotToLoad?: string, options?: { isExplicitLoad?: boolean }): Promise<Map<string, { x: number; y: number }> | null> {
    const currentStorageSlot = slotToLoad || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    const result = await loadDataFromSupabaseGeneric(SAVED_NODE_POSITIONS_KEY, currentStorageSlot, options);
    if (Array.isArray(result)) {
        try {
            return new Map(result as [string, { x: number; y: number }][]);
        } catch (e) {
            console.error("Error deserializing node positions:", e);
            return null;
        }
    }
    return null;
}

export async function saveCurrentLayoutName(layoutName: string, slotToSave?: string): Promise<boolean> {
    const currentStorageSlot = slotToSave || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    return saveDataToSupabaseGeneric(CURRENT_LAYOUT_NAME_KEY, currentStorageSlot, layoutName);
}

export async function loadCurrentLayoutName(slotToLoad?: string, options?: { isExplicitLoad?: boolean }): Promise<string | null> {
    const currentStorageSlot = slotToLoad || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    const result = await loadDataFromSupabaseGeneric(CURRENT_LAYOUT_NAME_KEY, currentStorageSlot, options);
    return typeof result === 'string' ? result : null;
}

// --- New Visualization Mode Persistence ---
export async function saveVisualizationMode(mode: 'graph' | 'sunburst', slotToSave?: string): Promise<boolean> {
    const currentStorageSlot = slotToSave || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    return saveDataToSupabaseGeneric(VISUALIZATION_MODE_KEY, currentStorageSlot, mode);
}

export async function loadVisualizationMode(slotToLoad?: string, options?: { isExplicitLoad?: boolean }): Promise<'graph' | 'sunburst' | null> {
    const currentStorageSlot = slotToLoad || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    const result = await loadDataFromSupabaseGeneric(VISUALIZATION_MODE_KEY, currentStorageSlot, options);
    if (result === 'graph' || result === 'sunburst') {
        return result;
    }
    return null;
}

// --- New Sunburst Fit Mode Persistence ---
export async function saveSunburstFitMode(mode: 'fit' | 'fill', slotToSave?: string): Promise<boolean> {
    const currentStorageSlot = slotToSave || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    return saveDataToSupabaseGeneric(SUNBURST_FIT_MODE_KEY, currentStorageSlot, mode);
}

export async function loadSunburstFitMode(slotToLoad?: string, options?: { isExplicitLoad?: boolean }): Promise<'fit' | 'fill' | null> {
    const currentStorageSlot = slotToLoad || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    const result = await loadDataFromSupabaseGeneric(SUNBURST_FIT_MODE_KEY, currentStorageSlot, options);
    if (result === 'fit' || result === 'fill') {
        return result;
    }
    return null;
}

// --- New Sunburst Connection Mode Persistence ---
export async function saveSunburstConnectionMode(mode: string, slotToSave?: string): Promise<boolean> {
    const currentStorageSlot = slotToSave || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    return saveDataToSupabaseGeneric(SUNBURST_CONNECTION_MODE_KEY, currentStorageSlot, mode);
}

export async function loadSunburstConnectionMode(slotToLoad?: string, options?: { isExplicitLoad?: boolean }): Promise<string | null> {
    const currentStorageSlot = slotToLoad || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    const result = await loadDataFromSupabaseGeneric(SUNBURST_CONNECTION_MODE_KEY, currentStorageSlot, options);
    if (typeof result === 'string' && ['incoming-symmetric', 'incoming-only', 'outgoing-only', 'outgoing-symmetric', 'all'].includes(result)) {
        return result;
    }
    return null;
}

// --- New Sunburst Filter State Persistence ---
export async function saveSunburstFilterState(state: { [key: string]: boolean }, slotToSave?: string): Promise<boolean> {
    const currentStorageSlot = slotToSave || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    return saveDataToSupabaseGeneric(SUNBURST_FILTER_STATE_KEY, currentStorageSlot, state);
}

export async function loadSunburstFilterState(slotToLoad?: string, options?: { isExplicitLoad?: boolean }): Promise<{ [key: string]: boolean } | null> {
    const currentStorageSlot = slotToLoad || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    const result = await loadDataFromSupabaseGeneric(SUNBURST_FILTER_STATE_KEY, currentStorageSlot, options);
    // Basic validation: is it an object of booleans?
    if (typeof result === 'object' && result !== null && !Array.isArray(result) && Object.values(result).every(v => typeof v === 'boolean')) {
        return result;
    }
    return null;
}

// --- New Sunburst Root Node ID Persistence ---
export async function saveSunburstRootNodeId(nodeId: string | null, slotToSave?: string): Promise<boolean> {
    const currentStorageSlot = slotToSave || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    return saveDataToSupabaseGeneric(SUNBURST_ROOT_NODE_ID_KEY, currentStorageSlot, nodeId);
}

export async function loadSunburstRootNodeId(slotToLoad?: string, options?: { isExplicitLoad?: boolean }): Promise<string | null> {
    const currentStorageSlot = slotToLoad || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    const result = await loadDataFromSupabaseGeneric(SUNBURST_ROOT_NODE_ID_KEY, currentStorageSlot, options);
    return typeof result === 'string' ? result : null;
}

// --- New Sunburst Label State Persistence ---
export async function saveSunburstLabelState(isEnabled: boolean, slotToSave?: string): Promise<boolean> {
    const currentStorageSlot = slotToSave || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    return saveDataToSupabaseGeneric(SUNBURST_LABEL_STATE_KEY, currentStorageSlot, isEnabled);
}

export async function loadSunburstLabelState(slotToLoad?: string, options?: { isExplicitLoad?: boolean }): Promise<boolean | null> {
    const currentStorageSlot = slotToLoad || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    const result = await loadDataFromSupabaseGeneric(SUNBURST_LABEL_STATE_KEY, currentStorageSlot, options);
    return typeof result === 'boolean' ? result : null;
}


// --- AI Template Persistence ---
export async function saveAiTemplate(templateName: string, content: string, slotToSave?: string): Promise<boolean> {
    const currentStorageSlot = slotToSave || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    const dataKey = `${AI_TEMPLATES_KEY_PREFIX}${templateName}`;
    return saveDataToSupabaseGeneric(dataKey, currentStorageSlot, content);
}

export async function loadAiTemplate(templateName: string, slotToLoad?: string, options?: { isExplicitLoad?: boolean }): Promise<string | null> {
    const currentStorageSlot = slotToLoad || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    const dataKey = `${AI_TEMPLATES_KEY_PREFIX}${templateName}`;
    const result = await loadDataFromSupabaseGeneric(dataKey, currentStorageSlot, options);
    return typeof result === 'string' ? result : null;
}

export async function loadAllAiTemplates(slotToLoad?: string, options?: { isExplicitLoad?: boolean }): Promise<Map<string, string> | null> {
    const currentSlot = slotToLoad || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    if (!currentSlot) return null;

    const config = getSupabaseConfig();
    const supabaseConfigured = isSupabaseConfigured(config);
    const autoSyncIsCurrentlyOn = getAutoSyncEnabled();
    const attemptSupabase = (options?.isExplicitLoad || autoSyncIsCurrentlyOn) && supabaseConfigured;
    
    const templatesMap = new Map<string, string>();
    let loadedFromCloud = false;

    if (attemptSupabase) {
        updateCloudStatus(`Loading AI templates from cloud (slot ${currentSlot})...`, false, 0);
        try {
            const response = await fetch(`${config.url}/rest/v1/${SUPABASE_TABLE_NAME}?key=like.${AI_TEMPLATES_KEY_PREFIX}*&slot=eq.${currentSlot}&select=key,value`, {
                method: 'GET',
                headers: { 'apikey': config.key, 'Authorization': `Bearer ${config.key}` }
            });
            if (!response.ok) throw new Error(`Supabase error ${response.status}`);
            
            const data = await response.json();
            if (data && data.length > 0) {
                data.forEach((item: { key: string, value: string }) => {
                    try {
                        const templateName = item.key.substring(AI_TEMPLATES_KEY_PREFIX.length);
                        const content = JSON.parse(item.value); 
                        if (typeof content === 'string') {
                            templatesMap.set(templateName, content);
                            localStorage.setItem(getLocalStorageCacheKey(currentSlot, item.key), item.value);
                        }
                    } catch (e) { console.error(`Error parsing template ${item.key} from cloud`, e); }
                });
                updateCloudStatus(`Loaded AI templates from cloud (slot ${currentSlot}).`, false);
                loadedFromCloud = true;
            } else {
                 updateCloudStatus(`No AI templates in cloud (slot ${currentSlot}). Trying local cache.`, false, 2000);
            }
        } catch (e) {
            console.error("Error loading all AI templates from cloud:", e);
            if (autoSyncIsCurrentlyOn) setAutoSyncEnabled(false, 'system_supabase_error');
            else if (options?.isExplicitLoad) updateCloudStatus(`Error loading AI templates. Trying local cache.`, true, 3000);
        }
    }

    if (!loadedFromCloud) { 
        for (let i = 0; i < localStorage.length; i++) {
            const lsKey = localStorage.key(i);
            if (lsKey && lsKey.startsWith(getLocalStorageCacheKey(currentSlot, AI_TEMPLATES_KEY_PREFIX))) {
                const templateName = lsKey.substring(getLocalStorageCacheKey(currentSlot, AI_TEMPLATES_KEY_PREFIX).length);
                const item = await loadFromLocalStorageOnly(`${AI_TEMPLATES_KEY_PREFIX}${templateName}`, currentSlot);
                if (typeof item === 'string') {
                    templatesMap.set(templateName, item);
                }
            }
        }
        if (templatesMap.size > 0 && (!attemptSupabase || cloudStorageStatus?.textContent?.includes('Trying local cache'))) {
             updateCloudStatus(`Loaded AI templates from local cache (slot ${currentSlot}).`, false, 2000);
        }
    }
    return templatesMap.size > 0 ? templatesMap : null;
}

export async function deleteAiTemplateFromSupabase(templateName: string, slotToSave?: string): Promise<boolean> {
    const currentStorageSlot = slotToSave || (storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY);
    const dataKey = `${AI_TEMPLATES_KEY_PREFIX}${templateName}`;

    localStorage.removeItem(getLocalStorageCacheKey(currentStorageSlot, dataKey));
    
    const config = getSupabaseConfig();

    if (!getAutoSyncEnabled()) {
        updateCloudStatus(`Template ${templateName} removed from local cache (Auto-Sync OFF).`, false, 2000);
        return true;
    }
    if (!isSupabaseConfigured(config)) {
        updateCloudStatus(`Cloud not configured. Template ${templateName} removed from local cache only.`, true);
        if (getAutoSyncEnabled()) setAutoSyncEnabled(false, 'system_supabase_error');
        return true;
    }

    try {
        const response = await fetch(`${config.url}/rest/v1/${SUPABASE_TABLE_NAME}?key=eq.${dataKey}&slot=eq.${currentStorageSlot}`, {
            method: 'DELETE',
            headers: { 'apikey': config.key, 'Authorization': `Bearer ${config.key}` }
        });
        if (!response.ok && response.status !== 404) { 
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`Cloud delete error for template ${templateName} (${response.status}): ${errorData.message || 'Failed to delete'}`);
        }
        updateCloudStatus(`Template ${templateName} deleted from cloud & local cache.`, false);
        return true;
    } catch (error: any) {
        console.error(`Error deleting template ${templateName} from cloud:`, error);
        if (getAutoSyncEnabled()) setAutoSyncEnabled(false, 'system_supabase_error');
        updateCloudStatus(`Failed to delete template ${templateName} from cloud. Check connection.`, true);
        return false;
    }
}


export async function initialLoadGraphStructure(): Promise<void> {
    const slotToLoad = storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY;
    if (storageKeyInput && !storageKeyInput.value) {
         storageKeyInput.value = DEFAULT_SUPABASE_STORAGE_KEY;
    }
    
    const loadOptions = { isExplicitLoad: false };

    await initializeAiTemplates(); 

    const layoutName = await loadCurrentLayoutName(slotToLoad, loadOptions);
    let nodePositions: Map<string, { x: number; y: number }> | null = null;
    if (layoutName === 'saved_layout') {
        nodePositions = await loadNodePositions(slotToLoad, loadOptions);
    }
    setInitialLayoutState(layoutName, nodePositions);

    let structure = await loadRaiStructureFromSupabase(slotToLoad, loadOptions);
    setCurrentAiStructure(structure ?? ""); 

    const loadedNodeId = await loadSelectedNodeId(slotToLoad, loadOptions); 

    if (structure === null) {
        // If no structure is loaded from persistence (local or cloud), load the default sample.
        structure = DEFAULT_SAMPLE_STRUCTURE;
        setCurrentAiStructure(structure);
        console.log(`No structure found for slot ${slotToLoad}. Loading default sample structure.`);
    }

    if (structure !== null && inputTextElem) {
        inputTextElem.value = structure;
        try {
            const elements = parseInputAndGetElements(structure);
            await initializeCytoscape(elements, { retainSelectedNodeId: loadedNodeId, preventRemoteClearSelection: true }); 
             if (!isCyInitialized() && structure.trim() !== "") {
                 addErrorMessageToMainPanel("Initially loaded data, but graph failed to render. Check format or cloud/cache content.");
            }
        } catch (error: any) {
             addErrorMessageToMainPanel(`Error rendering initially loaded graph: ${error.message}`);
        }
    } else if (structure === null && inputTextElem && inputTextElem.value.trim() === "") {
        await initializeCytoscape([], { retainSelectedNodeId: loadedNodeId, preventRemoteClearSelection: true });
        
        const config = getSupabaseConfig();
        if (!getAutoSyncEnabled() || !isSupabaseConfigured(config)) {
             updateCloudStatus(`Slot ${slotToLoad} (structure) is empty (local cache). Starting fresh.`, false, 4000);
        } else {
        }
    } else if (structure === null && inputTextElem && inputTextElem.value.trim() !== "") {
        updateCloudStatus(`No data in slot ${slotToLoad} (cloud/cache). Local changes are unsaved.`, false, 5000);
        try {
            const elements = parseInputAndGetElements(inputTextElem.value);
            await initializeCytoscape(elements, { retainSelectedNodeId: loadedNodeId, preventRemoteClearSelection: true });
        } catch (error: any) {
            addErrorMessageToMainPanel(`Error rendering local unsaved graph: ${error.message}`);
        }
    }
}


const ALL_DATA_KEYS_EXCEPT_TEMPLATES = [ 
    RAI_STRUCTURE_DATA_KEY, AI_CHAT_HISTORY_KEY, NODE_LABEL_MODE_KEY,
    DETAILS_PANEL_COLLAPSE_STATE_KEY, CONTROLS_OVERLAY_VISIBILITY_KEY,
    ACTIVE_CONTROL_PANEL_KEY, SELECTED_NODE_ID_KEY,
    SAVED_NODE_POSITIONS_KEY, CURRENT_LAYOUT_NAME_KEY,
    VISUALIZATION_MODE_KEY, SUNBURST_FIT_MODE_KEY, SUNBURST_CONNECTION_MODE_KEY,
    SUNBURST_FILTER_STATE_KEY, SUNBURST_ROOT_NODE_ID_KEY, SUNBURST_LABEL_STATE_KEY
];

export async function syncLocalStorageToSupabase(): Promise<void> {
    const currentSlot = storageKeyInput ? storageKeyInput.value : DEFAULT_SUPABASE_STORAGE_KEY;
    if (!currentSlot) {
        updateCloudStatus("Cannot sync: Slot ID is empty.", true);
        return;
    }
    const config = getSupabaseConfig();
    if (!isSupabaseConfigured(config)) {
        updateCloudStatus("Cannot sync: Cloud not configured. Auto-Sync disabled.", true);
        setAutoSyncEnabled(false, 'system_supabase_error'); 
        return;
    }

    updateCloudStatus(`Syncing local data for slot ${currentSlot} to cloud...`, false, 0);
    let allItemsAttempted = 0;
    let successfulSyncs = 0;
    let failedSyncsDueToSupabase = 0;

    const originalAutoSyncState = getAutoSyncEnabled();
    if (!originalAutoSyncState) { 
         setAutoSyncEnabled(true, 'user'); 
    }

    for (const dataKey of ALL_DATA_KEYS_EXCEPT_TEMPLATES) {
        const localData = await loadFromLocalStorageOnly(dataKey, currentSlot); 
        if (localData !== null) {
            allItemsAttempted++;
            console.log(`Syncing ${dataKey} for slot ${currentSlot} from local cache to cloud.`);
            
            const success = await saveDataToSupabaseGeneric(dataKey, currentSlot, localData);
            if (success) {
                if (getAutoSyncEnabled()) { 
                    successfulSyncs++;
                } else {
                    failedSyncsDueToSupabase++;
                    console.warn(`Cloud sync failed for ${dataKey} (slot ${currentSlot}) during mass sync, data remains in local cache. Auto-Sync disabled.`);
                }
            } else {
                failedSyncsDueToSupabase++; 
                console.error(`Critical sync failure for ${dataKey} (slot ${currentSlot}). Not saved to cloud or local cache.`);
            }
        } else {
            console.log(`No local data for ${dataKey} (slot ${currentSlot}) to sync.`);
        }
    }

    for (let i = 0; i < localStorage.length; i++) {
        const lsKey = localStorage.key(i);
        if (lsKey && lsKey.startsWith(getLocalStorageCacheKey(currentSlot, AI_TEMPLATES_KEY_PREFIX))) {
            const templateName = lsKey.substring(getLocalStorageCacheKey(currentSlot, AI_TEMPLATES_KEY_PREFIX).length);
            const dataKey = `${AI_TEMPLATES_KEY_PREFIX}${templateName}`;
            const localData = await loadFromLocalStorageOnly(dataKey, currentSlot); 
            if (typeof localData === 'string') { 
                allItemsAttempted++;
                console.log(`Syncing template ${templateName} for slot ${currentSlot} from local cache to cloud.`);
                const success = await saveDataToSupabaseGeneric(dataKey, currentSlot, localData); 
                if (success) {
                    if (getAutoSyncEnabled()) successfulSyncs++;
                    else failedSyncsDueToSupabase++;
                } else {
                    failedSyncsDueToSupabase++;
                }
            }
        }
    }


    if (!originalAutoSyncState) { 
        setAutoSyncEnabled(false, 'user');
    }

    if (allItemsAttempted === 0) {
         updateCloudStatus(`No local data in slot ${currentSlot} to sync.`, false);
    } else if (failedSyncsDueToSupabase === 0 && successfulSyncs === allItemsAttempted) {
        updateCloudStatus(`All ${successfulSyncs} local item(s) for slot ${currentSlot} synced to cloud.`, false);
    } else if (failedSyncsDueToSupabase > 0) {
        updateCloudStatus(`Sync for slot ${currentSlot} done. ${successfulSyncs}/${allItemsAttempted} synced. ${failedSyncsDueToSupabase} failed cloud sync (data in cache). Auto-Sync OFF.`, true, 7000);
    } else {
         updateCloudStatus(`Sync for slot ${currentSlot} completed. ${successfulSyncs}/${allItemsAttempted} processed.`, false, 7000);
    }
}