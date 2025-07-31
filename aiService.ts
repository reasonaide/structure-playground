// aiService.ts
// Fix: Import GoogleGenAI correctly as per guidelines
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
// Fix: Import GenerateContentParameters instead of GenerateContentRequest
import type { GenerateContentParameters } from '@google/genai'; // Removed ListModelsResponse as it's not used

import {
    inputTextElem, renderButton, aiChatHistoryDiv, aiPromptInputElem,
    sendAiPromptButton, aiLoadingIndicator, aiModelSelector, importChatInput, errorDisplay,
    toggleControlsButton,
    controlsOverlay,
    aiLabErrorDisplay,
    storageKeyInput,
    acnnSuggestAiButton, acnnAiLoadingIndicator,
    detailsNodeSuggestAiButton, detailsNodeAiLoadingIndicator,
    detailsNodeEditTextArea,
    searchGroundingToggle, urlContextToggle, aiGroundingResultsDiv,
    apiKeyModalOverlay, apiKeyInput, apiKeySaveButton, apiKeyProceedWithoutButton, setApiKeyButton, apiKeySection, detailsNodeSuggestionTaskSelector
} from './dom.js';
import { ChatMessage, ExportData } from './types.js';
import {
    FALLBACK_MODELS, ALLOWED_MODELS_REGEX, PREFERRED_AI_MODEL_NAME,
    LOCAL_STORAGE_API_KEY, LOCAL_STORAGE_API_CHOICE,
    DEFAULT_TEMPLATE_SYSTEM_PROMPT_MAIN_NAME, DEFAULT_TEMPLATE_RAI_RULESET_NAME, DEFAULT_TEMPLATE_OUTPUT_FORMAT_RULES_NAME,
    DEFAULT_TEMPLATE_CONTENT_SYSTEM_PROMPT_MAIN, DEFAULT_TEMPLATE_CONTENT_RAI_RULESET, DEFAULT_TEMPLATE_CONTENT_OUTPUT_FORMAT_RULES,
    DEFAULT_TEMPLATE_SUGGEST_NEW_NODE_NAME, DEFAULT_TEMPLATE_CONTENT_SUGGEST_NEW_NODE,
    DEFAULT_TEMPLATE_SUGGEST_EDIT_DECONTEXTUALISE_NAME, DEFAULT_TEMPLATE_CONTENT_SUGGEST_EDIT_DECONTEXTUALISE,
    DEFAULT_TEMPLATE_SUGGEST_EDIT_WIKIDATA_LINK_NAME, DEFAULT_TEMPLATE_CONTENT_SUGGEST_EDIT_WIKIDATA_LINK,
    DEFAULT_TEMPLATE_SYSTEM_PRESERVE_REFERENCES_HINT_NAME, DEFAULT_TEMPLATE_CONTENT_SYSTEM_PRESERVE_REFERENCES_HINT,
    DEFAULT_TEMPLATE_SYSTEM_WIKIDATA_TERM_EXTRACTION_NAME, DEFAULT_TEMPLATE_CONTENT_SYSTEM_WIKIDATA_TERM_EXTRACTION,
    DEFAULT_TEMPLATE_SYSTEM_WIKIDATA_LINK_REWRITER_NAME, DEFAULT_TEMPLATE_CONTENT_SYSTEM_WIKIDATA_LINK_REWRITER,
    DEFAULT_TEMPLATE_PREFIX_SUGGEST_EDIT,
    DEFAULT_TEMPLATE_SEARCH_GROUNDING_RULES_NAME,
    DEFAULT_TEMPLATE_CONTENT_SEARCH_GROUNDING_RULES
} from './ai-config.js';
import { ICON_GEAR} from './icons.js';
import { addError as addMainPanelError, clearErrors as clearMainPanelErrors, selectDefaultModel, parseJsonFromText, showCustomConfirmDialog, getComputedCssVar } from './utils.js';
import { clearGraphElements, initializeCytoscape, parseInputAndGetElements, setDefaultLayoutName, isCyInitialized, getCyInstance, getCurrentLayoutName } from './cytoscapeService.js';
import {
    saveRaiStructureToSupabase, saveAiChatHistory,
    saveAiTemplate as saveTemplateToPersistence,
    loadAllAiTemplates as loadAllTemplatesFromPersistence,
    deleteAiTemplateFromSupabase as deleteTemplateFromPersistence
} from './persistenceService.js';
import { recordSnapshot } from './editModeService.js';


let genAI: GoogleGenAI | null = null;
let localApiKey: string | null = null;
let currentAiGeneratedStructure: string = "";
let aiRequestTimerId: number | null = null;
let aiRequestStartTime: number | null = null;
let chatHistoryForExport: ChatMessage[] = [];
let modelsFetched = false;
let isAIProcessingFlag: boolean = false;

// AI Templates
let aiTemplates: Map<string, string> = new Map();
const MAX_TEMPLATE_RECURSION = 5;

// Wikidata Cache
type WikidataCacheEntry = { qid: string, label: string, description: string };
const wikidataCache: Map<string, WikidataCacheEntry> = new Map();

export function getWikidataItemDetails(qid: string): WikidataCacheEntry | null {
    return wikidataCache.get(qid) || null;
}


export interface SuggestionContext {
    SOURCE_NODE_ID: string;
    SOURCE_NODE_TEXT: string;
    SOURCE_NODE_CONNECTIONS: string;
    PROPOSED_RELATIONSHIP: string;
    CURRENT_NEW_NODE_INPUT: string;
}

export interface EditSuggestionContext {
    NODE_ID: string;
    CURRENT_NODE_TEXT: string;
    CONNECTED_NODES_INFO: string;
    WIKIDATA_API_RESULTS?: string;
}


export function getIsAIProcessing(): boolean {
    return isAIProcessingFlag;
}

export function isAiInitialized(): boolean {
    return genAI !== null;
}
export function getSelectedModel(): string | null {
    return aiModelSelector ? aiModelSelector.value : null;
}

export function setCurrentAiStructure(structure: string): void {
    currentAiGeneratedStructure = structure;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- AI Template Management ---
export async function initializeAiTemplates(): Promise<void> {
    const currentSlot = storageKeyInput ? storageKeyInput.value : undefined;
    const loadedTemplates = await loadAllTemplatesFromPersistence(currentSlot);

    aiTemplates.clear();

    aiTemplates.set(DEFAULT_TEMPLATE_SYSTEM_PROMPT_MAIN_NAME, DEFAULT_TEMPLATE_CONTENT_SYSTEM_PROMPT_MAIN);
    aiTemplates.set(DEFAULT_TEMPLATE_RAI_RULESET_NAME, DEFAULT_TEMPLATE_CONTENT_RAI_RULESET);
    aiTemplates.set(DEFAULT_TEMPLATE_OUTPUT_FORMAT_RULES_NAME, DEFAULT_TEMPLATE_CONTENT_OUTPUT_FORMAT_RULES);
    aiTemplates.set(DEFAULT_TEMPLATE_SUGGEST_NEW_NODE_NAME, DEFAULT_TEMPLATE_CONTENT_SUGGEST_NEW_NODE);
    aiTemplates.set(DEFAULT_TEMPLATE_SUGGEST_EDIT_DECONTEXTUALISE_NAME, DEFAULT_TEMPLATE_CONTENT_SUGGEST_EDIT_DECONTEXTUALISE);
    aiTemplates.set(DEFAULT_TEMPLATE_SUGGEST_EDIT_WIKIDATA_LINK_NAME, DEFAULT_TEMPLATE_CONTENT_SUGGEST_EDIT_WIKIDATA_LINK);
    aiTemplates.set(DEFAULT_TEMPLATE_SYSTEM_PRESERVE_REFERENCES_HINT_NAME, DEFAULT_TEMPLATE_CONTENT_SYSTEM_PRESERVE_REFERENCES_HINT);
    aiTemplates.set(DEFAULT_TEMPLATE_SYSTEM_WIKIDATA_TERM_EXTRACTION_NAME, DEFAULT_TEMPLATE_CONTENT_SYSTEM_WIKIDATA_TERM_EXTRACTION);
    aiTemplates.set(DEFAULT_TEMPLATE_SYSTEM_WIKIDATA_LINK_REWRITER_NAME, DEFAULT_TEMPLATE_CONTENT_SYSTEM_WIKIDATA_LINK_REWRITER);
    aiTemplates.set(DEFAULT_TEMPLATE_SEARCH_GROUNDING_RULES_NAME, DEFAULT_TEMPLATE_CONTENT_SEARCH_GROUNDING_RULES);


    if (loadedTemplates) {
        loadedTemplates.forEach((content, name) => {
            aiTemplates.set(name, content);
        });
    }
    console.log("AI Templates initialized/loaded:", Array.from(aiTemplates.keys()));
}

export function getTemplate(templateName: string): string | null {
    return aiTemplates.get(templateName) || null;
}

export async function setTemplate(templateName: string, content: string): Promise<boolean> {
    aiTemplates.set(templateName, content);
    const currentSlot = storageKeyInput ? storageKeyInput.value : undefined;
    return saveTemplateToPersistence(templateName, content, currentSlot);
}

export async function deleteTemplate(templateName: string): Promise<boolean> {
    const isCoreDefault =
        DEFAULT_TEMPLATE_SYSTEM_PROMPT_MAIN_NAME === templateName ||
        DEFAULT_TEMPLATE_RAI_RULESET_NAME === templateName ||
        DEFAULT_TEMPLATE_OUTPUT_FORMAT_RULES_NAME === templateName ||
        DEFAULT_TEMPLATE_SUGGEST_NEW_NODE_NAME === templateName ||
        DEFAULT_TEMPLATE_SUGGEST_EDIT_DECONTEXTUALISE_NAME === templateName ||
        DEFAULT_TEMPLATE_SUGGEST_EDIT_WIKIDATA_LINK_NAME === templateName ||
        DEFAULT_TEMPLATE_SYSTEM_PRESERVE_REFERENCES_HINT_NAME === templateName ||
        DEFAULT_TEMPLATE_SYSTEM_WIKIDATA_TERM_EXTRACTION_NAME === templateName ||
        DEFAULT_TEMPLATE_SYSTEM_WIKIDATA_LINK_REWRITER_NAME === templateName ||
        DEFAULT_TEMPLATE_SEARCH_GROUNDING_RULES_NAME === templateName;

    if (isCoreDefault) {
        let revertedContent = "";
        if (templateName === DEFAULT_TEMPLATE_SYSTEM_PROMPT_MAIN_NAME) revertedContent = DEFAULT_TEMPLATE_CONTENT_SYSTEM_PROMPT_MAIN;
        else if (templateName === DEFAULT_TEMPLATE_RAI_RULESET_NAME) revertedContent = DEFAULT_TEMPLATE_CONTENT_RAI_RULESET;
        else if (templateName === DEFAULT_TEMPLATE_OUTPUT_FORMAT_RULES_NAME) revertedContent = DEFAULT_TEMPLATE_CONTENT_OUTPUT_FORMAT_RULES;
        else if (templateName === DEFAULT_TEMPLATE_SUGGEST_NEW_NODE_NAME) revertedContent = DEFAULT_TEMPLATE_CONTENT_SUGGEST_NEW_NODE;
        else if (templateName === DEFAULT_TEMPLATE_SUGGEST_EDIT_DECONTEXTUALISE_NAME) revertedContent = DEFAULT_TEMPLATE_CONTENT_SUGGEST_EDIT_DECONTEXTUALISE;
        else if (templateName === DEFAULT_TEMPLATE_SUGGEST_EDIT_WIKIDATA_LINK_NAME) revertedContent = DEFAULT_TEMPLATE_CONTENT_SUGGEST_EDIT_WIKIDATA_LINK;
        else if (templateName === DEFAULT_TEMPLATE_SYSTEM_PRESERVE_REFERENCES_HINT_NAME) revertedContent = DEFAULT_TEMPLATE_CONTENT_SYSTEM_PRESERVE_REFERENCES_HINT;
        else if (templateName === DEFAULT_TEMPLATE_SYSTEM_WIKIDATA_TERM_EXTRACTION_NAME) revertedContent = DEFAULT_TEMPLATE_CONTENT_SYSTEM_WIKIDATA_TERM_EXTRACTION;
        else if (templateName === DEFAULT_TEMPLATE_SYSTEM_WIKIDATA_LINK_REWRITER_NAME) revertedContent = DEFAULT_TEMPLATE_CONTENT_SYSTEM_WIKIDATA_LINK_REWRITER;
        else if (templateName === DEFAULT_TEMPLATE_SEARCH_GROUNDING_RULES_NAME) revertedContent = DEFAULT_TEMPLATE_CONTENT_SEARCH_GROUNDING_RULES;
        aiTemplates.set(templateName, revertedContent);
    } else {
        aiTemplates.delete(templateName);
    }
    const currentSlot = storageKeyInput ? storageKeyInput.value : undefined;
    return deleteTemplateFromPersistence(templateName, currentSlot);
}

export function getAllTemplateNames(): string[] {
    return Array.from(aiTemplates.keys()).sort();
}

function resolveTemplate(
    templateName: string,
    visited: Set<string> = new Set(),
    context?: Record<string, string>
): string {
    if (visited.has(templateName)) {
        console.warn(`Recursive template call detected for ${templateName}. Aborting recursion.`);
        return `[ERROR: Recursive template {{${templateName}}}]`;
    }
    if (visited.size >= MAX_TEMPLATE_RECURSION) {
        console.warn(`Max template recursion depth (${MAX_TEMPLATE_RECURSION}) reached for ${templateName}.`);
        return `[ERROR: Max recursion depth for template {{${templateName}}}]`;
    }

    visited.add(templateName);
    let content = getTemplate(templateName);

    if (content === null) {
        let coreDefaultContent: string | null = null;
        if (templateName === DEFAULT_TEMPLATE_SYSTEM_PROMPT_MAIN_NAME) coreDefaultContent = DEFAULT_TEMPLATE_CONTENT_SYSTEM_PROMPT_MAIN;
        else if (templateName === DEFAULT_TEMPLATE_RAI_RULESET_NAME) coreDefaultContent = DEFAULT_TEMPLATE_CONTENT_RAI_RULESET;
        else if (templateName === DEFAULT_TEMPLATE_OUTPUT_FORMAT_RULES_NAME) coreDefaultContent = DEFAULT_TEMPLATE_CONTENT_OUTPUT_FORMAT_RULES;
        else if (templateName === DEFAULT_TEMPLATE_SUGGEST_NEW_NODE_NAME) coreDefaultContent = DEFAULT_TEMPLATE_CONTENT_SUGGEST_NEW_NODE;
        else if (templateName === DEFAULT_TEMPLATE_SUGGEST_EDIT_DECONTEXTUALISE_NAME) coreDefaultContent = DEFAULT_TEMPLATE_CONTENT_SUGGEST_EDIT_DECONTEXTUALISE;
        else if (templateName === DEFAULT_TEMPLATE_SUGGEST_EDIT_WIKIDATA_LINK_NAME) coreDefaultContent = DEFAULT_TEMPLATE_CONTENT_SUGGEST_EDIT_WIKIDATA_LINK;
        else if (templateName === DEFAULT_TEMPLATE_SYSTEM_PRESERVE_REFERENCES_HINT_NAME) coreDefaultContent = DEFAULT_TEMPLATE_CONTENT_SYSTEM_PRESERVE_REFERENCES_HINT;
        else if (templateName === DEFAULT_TEMPLATE_SYSTEM_WIKIDATA_TERM_EXTRACTION_NAME) coreDefaultContent = DEFAULT_TEMPLATE_CONTENT_SYSTEM_WIKIDATA_TERM_EXTRACTION;
        else if (templateName === DEFAULT_TEMPLATE_SYSTEM_WIKIDATA_LINK_REWRITER_NAME) coreDefaultContent = DEFAULT_TEMPLATE_CONTENT_SYSTEM_WIKIDATA_LINK_REWRITER;
        else if (templateName === DEFAULT_TEMPLATE_SEARCH_GROUNDING_RULES_NAME) coreDefaultContent = DEFAULT_TEMPLATE_CONTENT_SEARCH_GROUNDING_RULES;

        if (coreDefaultContent !== null) {
            content = coreDefaultContent;
        } else {
            console.warn(`Template "${templateName}" not found and not a core default.`);
            return `[ERROR: Template {{${templateName}}} not found]`;
        }
    }

    let currentContent = content;
    const placeholderRegex = /\{\{([\w_.-]+)\}\}/g;
    let match;
    while ((match = placeholderRegex.exec(content)) !== null) {
        const key = match[1];
        if (context && context.hasOwnProperty(key)) {
            currentContent = currentContent.replace(new RegExp(escapeRegExp(match[0]), 'g'), context[key]);
        } else {
            const resolvedNestedTemplate = resolveTemplate(key, new Set(visited)); // Pass new Set for true depth tracking per branch
            if (resolvedNestedTemplate.startsWith("[ERROR:")) {
                 // Propagate error from nested resolution
                 console.warn(`Error resolving nested template {{${key}}} within {{${templateName}}}: ${resolvedNestedTemplate}`);
                 return resolvedNestedTemplate; // Stop processing and return the error string
            }
            currentContent = currentContent.replace(new RegExp(escapeRegExp(match[0]), 'g'), resolvedNestedTemplate);
        }
    }
    visited.delete(templateName); // Remove after successful resolution of this level
    return currentContent;
}

// --- UI Helpers ---
function startAiRequestIndicator(): void {
    isAIProcessingFlag = true;
    if (aiLoadingIndicator) aiLoadingIndicator.style.display = 'flex';
    if (sendAiPromptButton) sendAiPromptButton.disabled = true;
    if (toggleControlsButton) {
        toggleControlsButton.innerHTML = `<div class="spinner"></div>`;
        toggleControlsButton.title = 'AI is processing...';
    }
    aiRequestStartTime = Date.now();
    let seconds = 0;
    if (aiLoadingIndicator) aiLoadingIndicator.textContent = `AI is thinking... ${seconds}s`;
    aiRequestTimerId = window.setInterval(() => {
        seconds++;
        if (aiLoadingIndicator) aiLoadingIndicator.textContent = `AI is thinking... ${seconds}s`;
    }, 1000);
}

function stopAiRequestIndicator(): void {
    isAIProcessingFlag = false;
    if (aiLoadingIndicator) {
        aiLoadingIndicator.style.display = 'none';
        aiLoadingIndicator.textContent = 'AI is thinking...';
    }
    if (sendAiPromptButton) sendAiPromptButton.disabled = false;
    if (toggleControlsButton) {
        toggleControlsButton.innerHTML = ICON_GEAR;
        const isVisible = controlsOverlay ? !controlsOverlay.classList.contains('hidden') : true;
        toggleControlsButton.title = isVisible ? 'Hide Controls' : 'Show Controls';
    }
    if (aiRequestTimerId !== null) {
        clearInterval(aiRequestTimerId);
        aiRequestTimerId = null;
    }
    aiRequestStartTime = null;
    if (aiGroundingResultsDiv) { // Clear previous results
        aiGroundingResultsDiv.innerHTML = '';
        aiGroundingResultsDiv.style.display = 'none';
    }
}

function appendMessageToChatUI(message: ChatMessage): void {
    if (!aiChatHistoryDiv) return;
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('chat-message', `${message.type}-message`);
    if (message.isCodeBlock) {
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = message.text;
        pre.appendChild(code);
        messageDiv.appendChild(pre);
    } else {
        messageDiv.textContent = message.text;
    }
    aiChatHistoryDiv.appendChild(messageDiv);
    aiChatHistoryDiv.scrollTop = aiChatHistoryDiv.scrollHeight;
}

// --- API Key Management ---
export function showApiKeyModal() {
    if (apiKeyModalOverlay) apiKeyModalOverlay.style.display = 'flex';
}

function hideApiKeyModal() {
    if (apiKeyModalOverlay) apiKeyModalOverlay.style.display = 'none';
}

export async function saveApiKeyAndReload(key: string): Promise<void> {
    if (!key) {
        alert("Please enter a valid API key.");
        return;
    }
    try {
        localStorage.setItem(LOCAL_STORAGE_API_KEY, key);
        localStorage.setItem(LOCAL_STORAGE_API_CHOICE, 'set');
        localApiKey = key;
        hideApiKeyModal();
        await initializeAiService(); // Re-initialize with the new key
    } catch (e) {
        console.error("Could not save API key to local storage:", e);
        alert("Error saving API key. Check browser settings.");
    }
}

export async function proceedWithoutAiAndReload(): Promise<void> {
    try {
        localStorage.setItem(LOCAL_STORAGE_API_CHOICE, 'proceed_without');
        localStorage.removeItem(LOCAL_STORAGE_API_KEY);
        localApiKey = null;
        hideApiKeyModal();
        await initializeAiService(); // Re-initialize to set disabled states
    } catch (e) {
        console.error("Could not save preference to local storage:", e);
    }
}

function disableAiFeatures() {
    console.warn("AI features disabled.");
    if (aiModelSelector) aiModelSelector.disabled = true;
    if (sendAiPromptButton) sendAiPromptButton.disabled = true;
    if (aiPromptInputElem) aiPromptInputElem.disabled = true;
    if (searchGroundingToggle) searchGroundingToggle.disabled = true;
    if (urlContextToggle) urlContextToggle.disabled = true;
    if (acnnSuggestAiButton) acnnSuggestAiButton.style.visibility = 'hidden';
    if (detailsNodeSuggestAiButton) detailsNodeSuggestAiButton.style.visibility = 'hidden';
    if (detailsNodeSuggestionTaskSelector) detailsNodeSuggestionTaskSelector.style.visibility = 'hidden';
    if (apiKeySection) apiKeySection.style.display = 'block';
    genAI = null;
    localApiKey = null;
}

function enableAiFeatures() {
    console.log("AI features enabled.");
    if (aiModelSelector) aiModelSelector.disabled = false;
    if (sendAiPromptButton) sendAiPromptButton.disabled = false;
    if (aiPromptInputElem) aiPromptInputElem.disabled = false;
    if (searchGroundingToggle) searchGroundingToggle.disabled = false;
    if (urlContextToggle) urlContextToggle.disabled = false;
    if (apiKeySection) apiKeySection.style.display = 'none';
    // other AI buttons' visibility is handled by editModeService based on isAiInitialized()
}


// --- Core AI Service Functions ---
export async function initializeAiService(): Promise<void> {
    let choice: string | null = null;
    try {
        choice = localStorage.getItem(LOCAL_STORAGE_API_CHOICE);
    } catch (e) {
        console.warn("Could not access local storage for API choice.", e);
    }

    if (!choice) {
        showApiKeyModal();
        disableAiFeatures(); // Disable features until a choice is made
        return;
    }

    if (choice === 'proceed_without') {
        disableAiFeatures();
        return;
    }

    if (choice === 'set') {
        try {
            localApiKey = localStorage.getItem(LOCAL_STORAGE_API_KEY);
        } catch (e) {
             console.warn("Could not access local storage for API key.", e);
             localApiKey = null;
        }

        if (!localApiKey) {
            // Choice was 'set' but key is missing. Re-prompt.
            localStorage.removeItem(LOCAL_STORAGE_API_CHOICE);
            showApiKeyModal();
            disableAiFeatures();
            return;
        }

        // Key is present, try to initialize
        if (!genAI) {
            try {
                genAI = new GoogleGenAI({ apiKey: localApiKey });
                console.log("AI Service Initialized with GoogleGenAI using stored key.");
                enableAiFeatures();
                await populateModelsIfNotLoaded();
                await initializeAiTemplates();
            } catch (error) {
                console.error("Failed to initialize GoogleGenAI with stored key:", error);
                genAI = null;
                addMainPanelError(`Failed to initialize AI Service with stored key: ${error instanceof Error ? error.message : String(error)}. Please check the key.`);
                disableAiFeatures(); // Disable again if init fails
            }
        } else {
             // Already initialized
             enableAiFeatures();
             await populateModelsIfNotLoaded();
             await initializeAiTemplates();
        }
    }
}

export async function populateModelsIfNotLoaded(): Promise<void> {
    if (modelsFetched || !aiModelSelector) {
        return;
    }
    // With the new SDK, explicit model listing isn't standard client-side.
    // We rely on pre-configured models.
    aiModelSelector.innerHTML = ''; // Clear existing options

    // Use models defined in config.ts, filtered by ALLOWED_MODELS_REGEX
    const availableModels = FALLBACK_MODELS.filter(modelName => ALLOWED_MODELS_REGEX.test(modelName));

    if (availableModels.length === 0) {
        const option = document.createElement('option');
        option.value = "No models available";
        option.textContent = "No compatible models found";
        aiModelSelector.appendChild(option);
        aiModelSelector.disabled = true;
        if (sendAiPromptButton) sendAiPromptButton.disabled = true;
        if (aiPromptInputElem) aiPromptInputElem.disabled = true;
        if (searchGroundingToggle) searchGroundingToggle.disabled = true;
        if (urlContextToggle) urlContextToggle.disabled = true;
    } else {
        availableModels.forEach(modelName => {
            const option = document.createElement('option');
            option.value = modelName;
            option.textContent = modelName;
            aiModelSelector.appendChild(option);
        });

        const preferredModel = selectDefaultModel(availableModels);
        if (preferredModel) {
            aiModelSelector.value = preferredModel;
        } else {
            aiModelSelector.value = availableModels[0]; // Fallback to first if preferred not found
        }
        
        // Disable selector if AI is not initialized (key missing/invalid)
        aiModelSelector.disabled = !isAiInitialized();
        if (searchGroundingToggle) searchGroundingToggle.disabled = !isAiInitialized();
        if (urlContextToggle) urlContextToggle.disabled = !isAiInitialized();
    }
    modelsFetched = true;
    console.log("AI Models populated in dropdown based on config.");
}

export function setInitialAiChatHistory(history: ChatMessage[]): void {
    chatHistoryForExport = history;
    if (aiChatHistoryDiv) {
        aiChatHistoryDiv.innerHTML = '';
        history.forEach(msg => appendMessageToChatUI(msg));
    }
}

/**
 * Resolves a Google redirect URL to its final destination.
 * @param url The URL to resolve.
 * @returns The final destination URL, or the original URL if resolution fails.
 */
async function resolveRedirectUrl(url: string): Promise<string> {
    if (!url.startsWith('https://vertexaisearch.cloud.google.com/grounding-api-redirect/')) {
        return url;
    }

    console.log(`DEBUG: Attempting to resolve redirect for: ${url}`);
    try {
        // Using a proxy is a common way to handle CORS issues in a production environment.
        // For a client-side only app, we rely on the browser's fetch handling.
        // A `no-cors` request won't give us the final URL, so we must make a standard request.
        // If this fails due to CORS, there's no client-side workaround, so we catch and fallback.
        const response = await fetch(url, { method: 'GET' }); // Standard request
        
        if (response.ok && response.url && response.url !== url) {
            console.log(`DEBUG: Resolved ${url} -> ${response.url}`);
            return response.url;
        } else {
             console.warn(`DEBUG: Redirect resolution for ${url} did not result in a new URL. Final URL: ${response.url}, Status: ${response.status}`);
             return url; // Return original if something is weird (e.g., redirect loop caught by browser, or not a redirect)
        }
    } catch (error) {
        console.warn(`Could not resolve redirect for ${url} due to a network error (likely CORS). Falling back to original URL.`, error);
        return url; // Fallback to the original URL if resolution fails
    }
}


/**
 * Processes a response that may contain search grounding information.
 * It extracts references, creates Reference DPs, and links them via 'cites' connections
 * based on citations found in the text. This version is more robust against
 * malformed reference sections generated by the AI model.
 * @param responseText The full text response from the AI.
 * @param groundingMetadata The grounding metadata object from the API response, can be null.
 * @returns A modified RAI structure string with references integrated.
 */
async function processGroundedResponse(responseText: string, groundingMetadata: any | null): Promise<string> {
    const references: { dpText: string, refNumber: number, id: string }[] = [];
    const refNumberToDpId = new Map<number, string>();

    // Step 1: Extract References to create Reference DPs.
    const groundingChunks = groundingMetadata?.groundingChunks;
    if (groundingChunks && Array.isArray(groundingChunks) && groundingChunks.length > 0) {
        // Use metadata as the source of truth
        const refPromises = groundingChunks.map(async (chunk: any, index: number) => {
            if (chunk.web && chunk.web.uri) {
                const refNumber = index + 1;
                const refId = `Ref${refNumber}`;
                const resolvedUrl = await resolveRedirectUrl(chunk.web.uri);
                const title = chunk.web.title || resolvedUrl;
                const dpText = `DP${refId}.reference: "${title}" from ${resolvedUrl}`;
                references.push({ dpText, refNumber, id: refId });
                refNumberToDpId.set(refNumber, refId);
            }
        });
        await Promise.all(refPromises);
    } else {
        // Fallback to parsing text if metadata is missing or empty
        const refSectionRegex = /#\s*References\s*([\s\S]*)/;
        const refSectionMatch = responseText.match(refSectionRegex);
        if (refSectionMatch) {
            const refRegex = /\[(\d+)\]\s*(.*?)\s*\((https?:\/\/[^\s)]+)\)/g;
            let match;
            const refPromises = [];
            while ((match = refRegex.exec(refSectionMatch[1])) !== null) {
                const refNumber = parseInt(match[1], 10);
                const title = match[2].trim();
                const url = match[3].trim();
                const promise = (async () => {
                    const refId = `Ref${refNumber}`;
                    const resolvedUrl = await resolveRedirectUrl(url);
                    const finalTitle = title || resolvedUrl;
                    const dpText = `DP${refId}.reference: "${finalTitle}" from ${resolvedUrl}`;
                    references.push({ dpText, refNumber, id: refId });
                    refNumberToDpId.set(refNumber, refId);
                })();
                refPromises.push(promise);
            }
            await Promise.all(refPromises);
        }
    }

    // Step 2: Clean the original response to remove the AI's potentially malformed reference section.
    const originalLines = responseText.split('\n');
    const refSectionHeaderRegex = /^#\s*References/i;
    let refSectionStartIndex = -1;
    for (let i = 0; i < originalLines.length; i++) {
        if (refSectionHeaderRegex.test(originalLines[i].trim())) {
            refSectionStartIndex = i;
            break;
        }
    }
    const contentLines = refSectionStartIndex === -1 ? originalLines : originalLines.slice(0, refSectionStartIndex);
    const cleanedContent = contentLines.join('\n');

    // Step 3: Find citations in the cleaned content and generate connections.
    const newCiteConnections = new Set<string>();
    const citationRegex = /\[([\d,\s]+)\]/g;
    const dpRegex = /^DP(_?[\w-]+)((?:\.[a-zA-Z]+)?):\s*(.*)/;

    cleanedContent.split('\n').forEach(line => {
        const dpMatch = line.match(dpRegex);
        if (dpMatch) {
            const dpId = dpMatch[1]; // Correctly captures just the ID part, e.g., "_1" or "MyID"
            const textPart = dpMatch[3];
            let citationMatch;
            while ((citationMatch = citationRegex.exec(textPart)) !== null) {
                const numbersStr = citationMatch[1];
                const numbers = numbersStr.split(',').map(n => parseInt(n.trim(), 10)).filter(num => !isNaN(num));
                for (const num of numbers) {
                    if (refNumberToDpId.has(num)) {
                        const refDpId = refNumberToDpId.get(num)!; // Correctly gets "Ref1"
                        newCiteConnections.add(`(DP${dpId} cites DP${refDpId})`);
                    }
                }
            }
        }
    });

    // Step 4: Assemble the final structure, removing citations from the original DP text.
    const finalContentLines = cleanedContent.split('\n').map(line => line.replace(citationRegex, '').trimEnd());
    let finalStructure = finalContentLines.join('\n').trim();

    if (references.length > 0) {
        const referenceDps = references.sort((a, b) => a.refNumber - b.refNumber).map(r => r.dpText);
        if (finalStructure) {
            finalStructure += '\n\n';
        }
        finalStructure += [
            '# Auto-generated from grounding data',
            ...referenceDps,
            ...Array.from(newCiteConnections)
        ].join('\n').trim();
    }

    return finalStructure;
}


export async function sendPromptToAI(): Promise<void> {
    if (!genAI || !aiPromptInputElem || !inputTextElem || !aiModelSelector) {
        addMainPanelError("AI Service not ready or UI elements missing.");
        return;
    }
    const userPrompt = aiPromptInputElem.value.trim();
    if (!userPrompt) {
        addMainPanelError("Please enter a prompt for the AI.");
        return;
    }

    const selectedModel = aiModelSelector.value;
    if (!selectedModel || selectedModel === "No models available") {
        addMainPanelError("Please select a valid AI model.");
        return;
    }

    appendMessageToChatUI({ text: userPrompt, type: 'user' });
    chatHistoryForExport.push({ text: userPrompt, type: 'user' });
    aiPromptInputElem.value = '';
    startAiRequestIndicator();
    clearMainPanelErrors();

    try {
        const currentStructure = inputTextElem.value;
        let systemPromptText = resolveTemplate(DEFAULT_TEMPLATE_SYSTEM_PROMPT_MAIN_NAME);
        if (systemPromptText.startsWith("[ERROR:")) {
            throw new Error(`Template Error (System Prompt): ${systemPromptText}`);
        }
        
        let userPromptContent = `## User Query ##\n${userPrompt}\n\n## Current Discourse Structure ##\n\`\`\`\n${currentStructure.trim() === "" ? "# No structure yet. Start by defining DPs. If the User Query does not specifiy otherwise, generate multiple connected DPs discussing the topic mentioned in the user query" : currentStructure}\n\`\`\`\nGenerate the new or modified discourse structure based on the User Query and the rules.`;

        const tools: any[] = [];
        if (searchGroundingToggle && searchGroundingToggle.checked) {
            tools.push({googleSearch: {}});
            const groundingRules = resolveTemplate(DEFAULT_TEMPLATE_SEARCH_GROUNDING_RULES_NAME);
            if (!groundingRules.startsWith("[ERROR:")) {
                 systemPromptText += "\n\n" + groundingRules;
            } else {
                console.warn("Could not resolve search grounding rules template.");
            }
        }
        if (urlContextToggle && urlContextToggle.checked) {
            // Placeholder for future URL context tool
            // tools.push({urlContext: {}});
            console.warn("URL Context feature is not yet implemented.");
        }
        
        const requestConfig: GenerateContentParameters = {
            model: selectedModel,
            contents: userPromptContent,
            config: {
                systemInstruction: systemPromptText
            }
        };

        if (tools.length > 0) {
            requestConfig.config!.tools = tools;
        }
        
        const response: GenerateContentResponse = await genAI.models.generateContent(requestConfig);
        const aiResponseText = response.text;

        if (!aiResponseText) {
            throw new Error("AI returned an empty response.");
        }

        let processedStructure = aiResponseText;
        const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

        // If the user intended to use grounding, check for API metadata.
        // This is the most reliable signal that grounding was actually used.
        // processGroundedResponse will then handle the fallback from chunks to text parsing internally.
        if (searchGroundingToggle.checked && groundingMetadata) {
            console.log("Grounding toggle is on and grounding metadata found in response. Processing for references...");
            console.log("Grounding Metadata Object:", groundingMetadata); // For debugging
            processedStructure = await processGroundedResponse(aiResponseText, groundingMetadata);
        }

        currentAiGeneratedStructure = processedStructure;
        appendMessageToChatUI({ text: "Received AI Structure:", type: 'ai' });
        appendMessageToChatUI({ text: currentAiGeneratedStructure, type: 'ai-code', isCodeBlock: true });
        chatHistoryForExport.push({ text: "Received AI Structure:", type: 'ai' });
        chatHistoryForExport.push({ text: currentAiGeneratedStructure, type: 'ai-code', isCodeBlock: true });

        inputTextElem.value = currentAiGeneratedStructure;
        if (renderButton) renderButton.click();

        let groundingInfoHtml = '';
        if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
            const chunks = response.candidates[0].groundingMetadata.groundingChunks;
            if (chunks.length > 0) {
                groundingInfoHtml += '<h5>Google Search Results Used:</h5><ul>';
                const resolvedUrls = await Promise.all(chunks.map((chunk: any) => chunk.web ? resolveRedirectUrl(chunk.web.uri) : Promise.resolve('')));
                chunks.forEach((chunk: any, index: number) => { 
                    if (chunk.web && chunk.web.uri) {
                        const finalUrl = resolvedUrls[index];
                        const title = chunk.web.title || finalUrl;
                        groundingInfoHtml += `<li><a href="${finalUrl}" target="_blank" rel="noopener noreferrer">${title}</a></li>`;
                    }
                });
                groundingInfoHtml += '</ul>';
            }
        }

        if (aiGroundingResultsDiv && groundingInfoHtml) {
            aiGroundingResultsDiv.innerHTML = groundingInfoHtml;
            aiGroundingResultsDiv.style.display = 'block';
        }


        await saveAiChatHistory(chatHistoryForExport);
    } catch (error: any) {
        console.error("Error sending prompt to AI:", error);
        const errorMessage = error.message || "An unknown error occurred with the AI.";
        appendMessageToChatUI({ text: `Error: ${errorMessage}`, type: 'ai' });
        chatHistoryForExport.push({ text: `Error: ${errorMessage}`, type: 'ai' });
        addMainPanelError(`AI Error: ${errorMessage}`);
    } finally {
        stopAiRequestIndicator();
    }
}

export async function exportChatAndStructure(): Promise<void> {
    const currentStructure = inputTextElem ? inputTextElem.value : currentAiGeneratedStructure;
    const dataToExport: ExportData = {
        version: "1.1",
        chatHistory: chatHistoryForExport,
        currentAiStructure: currentStructure,
        selectedModel: getSelectedModel() || PREFERRED_AI_MODEL_NAME
    };
    const jsonData = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `rai_graph_export_${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addMainPanelError("Chat and structure exported.");
     setTimeout(clearMainPanelErrors, 3000);
}

export async function importChatAndStructureHandler(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const importedText = e.target?.result as string;
            const importedData: ExportData = JSON.parse(importedText);

            if (!importedData.version || !importedData.chatHistory || importedData.currentAiStructure === undefined) {
                throw new Error("Invalid import file format.");
            }
            
            showCustomConfirmDialog(
                "Importing will overwrite current chat and structure. Are you sure?",
                async () => {
                    clearMainPanelErrors();
                    chatHistoryForExport = importedData.chatHistory;
                    currentAiGeneratedStructure = importedData.currentAiStructure;

                    if (aiChatHistoryDiv) {
                        aiChatHistoryDiv.innerHTML = '';
                        chatHistoryForExport.forEach(msg => appendMessageToChatUI(msg));
                    }
                    if (inputTextElem) {
                        inputTextElem.value = currentAiGeneratedStructure;
                    }
                    if (renderButton) {
                        // Ensure the graph is re-rendered with the imported structure.
                        // InitializeCytoscape will be called by renderButton's click handler.
                         const cyInstance = getCyInstance();
                        if (cyInstance && getCurrentLayoutName() === 'saved_layout') {
                            console.log("Import: Current layout is saved_layout. Not auto-saving before this import-render.");
                        }
                        renderButton.click(); 
                    }

                    if (importedData.selectedModel && aiModelSelector) {
                        const modelOption = Array.from(aiModelSelector.options).find(opt => opt.value === importedData.selectedModel);
                        if (modelOption) {
                            aiModelSelector.value = importedData.selectedModel;
                        } else {
                             addMainPanelError(`Imported model "${importedData.selectedModel}" not found. Keeping current selection.`);
                        }
                    }
                    
                    await saveAiChatHistory(chatHistoryForExport);
                    await saveRaiStructureToSupabase(currentAiGeneratedStructure); 
                    addMainPanelError("Chat and structure imported successfully.");
                    setTimeout(clearMainPanelErrors, 3000);
                },
                () => {
                     addMainPanelError("Import cancelled.");
                     setTimeout(clearMainPanelErrors, 3000);
                },
                controlsOverlay, // Parent for dialog
                false // Not a destructive action in terms of UI, more of a load.
            );

        } catch (error: any) {
            addMainPanelError(`Error importing file: ${error.message}`);
        } finally {
            if (importChatInput) importChatInput.value = ''; // Reset file input
        }
    };
    reader.readAsText(file);
}

export async function clearChatAndAIServiceState(confirm: boolean = true): Promise<void> {
    const doClear = async () => {
        chatHistoryForExport = [];
        currentAiGeneratedStructure = "";
        if (aiChatHistoryDiv) aiChatHistoryDiv.innerHTML = '';
        
        recordSnapshot(); // Record current structure BEFORE clearing inputTextElem
        
        if (inputTextElem) {
            inputTextElem.value = ""; // Clear the source of truth for the graph
        }
        
        // Calling renderButton.click() will:
        // 1. Parse the (now empty) inputTextElem.
        // 2. Call initializeCytoscape with empty elements, clearing the graph.
        // 3. Save the empty structure to Supabase (as part of renderButton's logic).
        if (renderButton) {
            renderButton.click(); // This is synchronous dispatch, the handler is async.
        } else {
            // Fallback if renderButton is somehow not available
            await clearGraphElements(); 
            await saveRaiStructureToSupabase(""); 
        }
        
        await saveAiChatHistory([]); 
        // saveRaiStructureToSupabase("") is handled by renderButton.click() or the fallback
        
        addMainPanelError("AI chat history and graph structure cleared. Structure change undoable.");
        if (aiGroundingResultsDiv) {
            aiGroundingResultsDiv.innerHTML = '';
            aiGroundingResultsDiv.style.display = 'none';
        }
        setTimeout(clearMainPanelErrors, 4000);
    };

    if (confirm) {
        showCustomConfirmDialog(
            "Are you sure you want to clear the AI chat history and the current graph structure? The structure change can be undone, but the chat history cannot.",
            doClear,
            undefined,
            controlsOverlay,
            true // Destructive action
        );
    } else {
        await doClear(); // Ensure await if called directly without confirm
    }
}

function constructSuggestionPrompt(templateName: string, context: SuggestionContext | EditSuggestionContext): string {
    const resolvedTemplate = resolveTemplate(templateName, new Set(), (context as unknown) as Record<string, string>);
    if (resolvedTemplate.startsWith("[ERROR:")) {
        throw new Error(`Template Error (${templateName}): ${resolvedTemplate}`);
    }
    return resolvedTemplate;
}


export async function suggestNewNodeTextViaAI(context: SuggestionContext): Promise<string | null> {
    if (!genAI || !aiModelSelector) {
        addMainPanelError("AI Service not ready for suggestion.");
        return null;
    }
    const selectedModel = aiModelSelector.value;
    if (!selectedModel || selectedModel === "No models available") {
        addMainPanelError("Please select a valid AI model for suggestion.");
        return null;
    }

    try {
        const prompt = constructSuggestionPrompt(DEFAULT_TEMPLATE_SUGGEST_NEW_NODE_NAME, context);
        const response: GenerateContentResponse = await genAI.models.generateContent({
            model: selectedModel,
            contents: prompt,
             config: { temperature: 0.5 } // Slightly more creative for suggestions
        });
        const suggestion = response.text;
        if (!suggestion) {
             addMainPanelError("AI returned an empty suggestion.");
            return null;
        }
        return suggestion.trim();
    } catch (error: any) {
        console.error("Error getting AI suggestion for new node:", error);
        addMainPanelError(`AI Suggestion Error: ${error.message}`);
        return null;
    }
}

// --- Wikidata Linking Multi-Step Process ---
async function wikidataTermExtraction(text: string, connectedNodesInfo: string, model: string, onProgress: (message: string) => void): Promise<Array<{ term: string; language: string }> | null> {
    if (!genAI) return null;
    onProgress("Extracting terms for Wikidata...");
    const context: EditSuggestionContext = {
        NODE_ID: '', // Not strictly needed for term extraction template
        CURRENT_NODE_TEXT: text,
        CONNECTED_NODES_INFO: connectedNodesInfo
    };
    const prompt = constructSuggestionPrompt(DEFAULT_TEMPLATE_SYSTEM_WIKIDATA_TERM_EXTRACTION_NAME, context);

    try {
        const response: GenerateContentResponse = await genAI.models.generateContent({
            model: model,
            contents: prompt,
            config: { responseMimeType: "application/json" } // This template is designed to output JSON
        });
        const jsonText = response.text;
        if (!jsonText) throw new Error("Term extraction returned empty response.");
        
        const parsed = parseJsonFromText(jsonText); // parseJsonFromText handles ```json fences
        if (!Array.isArray(parsed)) throw new Error("Term extraction did not return a JSON array.");
        
        // Validate array items
        const validTerms = parsed.filter(item => typeof item.term === 'string' && typeof item.language === 'string');
        if (validTerms.length === 0 && parsed.length > 0) {
            console.warn("Term extraction returned array but items are not in correct format:", parsed);
        }
        onProgress(validTerms.length > 0 ? "Terms extracted." : "No relevant terms found for Wikidata linking.");
        return validTerms.length > 0 ? validTerms : null;

    } catch (e: any) {
        console.error("Wikidata Term Extraction AI Error:", e);
        addMainPanelError(`AI Error (Term Extraction): ${e.message}`);
        onProgress("Term extraction failed.");
        return null;
    }
}

async function searchWikidata(terms: Array<{ term: string; language: string }>, onProgress: (message: string) => void): Promise<Array<{ term: string; apiResponse: any }> | null> {
    onProgress("Querying Wikidata API...");
    const results = [];
    let foundAnyResults = false;
    for (const item of terms) {
        const params = new URLSearchParams({
            action: 'wbsearchentities',
            format: 'json',
            language: item.language,
            uselang: item.language, // search in this language
            type: 'item',
            search: item.term,
            limit: '5', // Limit to 5 results per term for disambiguation
            origin: '*' // CORS
        });
        try {
            const response = await fetch(`https://www.wikidata.org/w/api.php?${params.toString()}`);
            if (!response.ok) throw new Error(`Wikidata API error ${response.status} for term "${item.term}"`);
            const data = await response.json();
            if (data.search && data.search.length > 0) {
                foundAnyResults = true;
                // Cache QID details
                data.search.forEach((entity: any) => {
                    if (entity.id && entity.label && entity.description) {
                        wikidataCache.set(entity.id, { qid: entity.id, label: entity.label, description: entity.description });
                    }
                });
            }
            results.push({ term: item.term, apiResponse: data });
        } catch (e: any) {
            console.error(`Wikidata API search failed for "${item.term}":`, e);
            addMainPanelError(`Wikidata API Error: ${e.message}`);
            results.push({ term: item.term, apiResponse: { error: e.message, search: [] } }); // Include error for rewriting context
        }
    }
    onProgress(foundAnyResults ? "Wikidata search complete." : "No results from Wikidata API for extracted terms.");
    return results.length > 0 ? results : null;
}

async function wikidataLinkRewriter(originalText: string, connectedNodesInfo: string, wikidataApiResultsJson: string, model: string, onProgress: (message: string) => void): Promise<string | null> {
    if (!genAI) return null;
    onProgress("Linking terms with AI rewriter...");
    const context: EditSuggestionContext = {
        NODE_ID: '', // Not strictly needed here
        CURRENT_NODE_TEXT: originalText,
        CONNECTED_NODES_INFO: connectedNodesInfo,
        WIKIDATA_API_RESULTS: wikidataApiResultsJson
    };
    const prompt = constructSuggestionPrompt(DEFAULT_TEMPLATE_SYSTEM_WIKIDATA_LINK_REWRITER_NAME, context);
    try {
        const response: GenerateContentResponse = await genAI.models.generateContent({
            model: model,
            contents: prompt,
            config: { temperature: 0.2 } // More conservative for rewriting
        });
        const rewrittenText = response.text;
        if (!rewrittenText) throw new Error("Link rewriter returned empty response.");
        onProgress("Text rewriting complete.");
        return rewrittenText.trim();
    } catch (e: any) {
        console.error("Wikidata Link Rewriter AI Error:", e);
        addMainPanelError(`AI Error (Link Rewriter): ${e.message}`);
        onProgress("Link rewriting failed.");
        return null;
    }
}


export async function suggestNodeTextEditViaAI(
    templateName: string,
    context: EditSuggestionContext,
    onProgress: (message: string) => void = () => {}
): Promise<string | null> {
    if (!genAI || !aiModelSelector) {
        addMainPanelError("AI Service not ready for edit suggestion.");
        onProgress("AI service not ready.");
        return null;
    }
    const selectedModel = aiModelSelector.value;
    if (!selectedModel || selectedModel === "No models available") {
        addMainPanelError("Please select a valid AI model for edit suggestion.");
        onProgress("AI model not selected.");
        return null;
    }

    try {
        if (templateName === DEFAULT_TEMPLATE_SUGGEST_EDIT_WIKIDATA_LINK_NAME) {
            // Multi-step process for Wikidata linking
            const termsToSearch = await wikidataTermExtraction(context.CURRENT_NODE_TEXT, context.CONNECTED_NODES_INFO, selectedModel, onProgress);
            if (!termsToSearch || termsToSearch.length === 0) {
                 // Message already set by wikidataTermExtraction's onProgress
                return null; // Or return original text if no terms found
            }

            const apiSearchResults = await searchWikidata(termsToSearch, onProgress);
            if (!apiSearchResults) {
                // Message already set by searchWikidata's onProgress
                return null; // Or return original text
            }
            
            const relevantApiResults = apiSearchResults.filter(r => r.apiResponse && r.apiResponse.search && r.apiResponse.search.length > 0);
            if (relevantApiResults.length === 0) {
                onProgress("No relevant results from Wikidata to use for rewriting.");
                return context.CURRENT_NODE_TEXT; // Return original text if no usable API results
            }

            const wikidataApiResultsJson = JSON.stringify(relevantApiResults);
            const finalRewrittenText = await wikidataLinkRewriter(context.CURRENT_NODE_TEXT, context.CONNECTED_NODES_INFO, wikidataApiResultsJson, selectedModel, onProgress);
            onProgress(""); // Clear progress message
            return finalRewrittenText;

        } else {
            // Single-step process for other edit suggestions
            onProgress("AI generating suggestion...");
            const prompt = constructSuggestionPrompt(templateName, context);
            const response: GenerateContentResponse = await genAI.models.generateContent({
                model: selectedModel,
                contents: prompt,
                config: { temperature: 0.3 } // Adjust temperature as needed
            });
            const suggestion = response.text;
             onProgress(""); // Clear progress message
            if (!suggestion) {
                addMainPanelError("AI returned an empty suggestion for edit.");
                return null;
            }
            return suggestion.trim();
        }
    } catch (error: any) {
        console.error(`Error getting AI suggestion for edit (template ${templateName}):`, error);
        addMainPanelError(`AI Edit Suggestion Error: ${error.message}`);
        onProgress("Suggestion failed.");
        return null;
    }
}