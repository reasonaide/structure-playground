// utils.ts
import {
    errorDisplay, customConfirmOverlay, customConfirmMessage,
    customConfirmOkButton, customConfirmCancelButton, customPromptInput // Added customPromptInput
} from './dom.js';

export function clearErrors(): void {
    if (errorDisplay) {
        errorDisplay.innerHTML = '';
        errorDisplay.style.display = 'none';
    }
}

export function addError(message: string): void {
    console.warn(message);
    if (errorDisplay) {
        errorDisplay.innerHTML += message + '<br>';
        errorDisplay.style.display = 'block';
    }
}

export function truncateText(text: string, maxLength: number): string {
    if (!text) return '';
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength) + '...';
}

export function selectDefaultModel(models: string[]): string | null {
    if (!models || models.length === 0) return null;

    if (models.includes("gemini-2.5-flash")) {
        return "gemini-2.5-flash";
    }
    if (models.includes("gemini-2.5-pro")) {
        return "gemini-2.5-pro";
    }
    
    // Fallback to the first available model if preferred ones are not in the list
    return models[0];
}

// Helper to safely parse JSON that might be wrapped in markdown fences
export function parseJsonFromText(text: string): any {
    let jsonStr = text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s; // Handles optional language and newlines
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
        jsonStr = match[2].trim(); // Trim the extracted content itself
    }
    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Failed to parse JSON response:", e, "Original string:", text);
        throw new Error("Response was not valid JSON, or JSON parsing failed.");
    }
}

// --- Custom Confirmation/Prompt Dialog Logic ---
let currentOnConfirmCallback: (() => void) | null = null;
let currentOnPromptConfirmCallback: ((value: string) => void) | null = null;
let currentOnCancelCallback: (() => void) | null = null;

function handleDialogConfirm() {
    if (customPromptInput && customPromptInput.style.display !== 'none') { // It's a prompt
        if (currentOnPromptConfirmCallback) {
            currentOnPromptConfirmCallback(customPromptInput.value);
        }
    } else { // It's a confirm
        if (currentOnConfirmCallback) {
            currentOnConfirmCallback();
        }
    }
    hideCustomConfirmDialog();
}

function handleDialogCancel() {
    if (currentOnCancelCallback) {
        currentOnCancelCallback();
    }
    hideCustomConfirmDialog();
}

export function showCustomConfirmDialog(
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    parentElement?: HTMLElement | null,
    isDestructive: boolean = true // Added to control OK button style
): void {
    if (!customConfirmOverlay || !customConfirmMessage || !customPromptInput || !customConfirmOkButton || !customConfirmCancelButton) {
        console.error("Custom confirm/prompt dialog elements not found. Falling back to window.confirm.");
        if (window.confirm(message)) {
            onConfirm();
        } else {
            if (onCancel) onCancel();
        }
        return;
    }

    customConfirmMessage.textContent = message;
    customPromptInput.style.display = 'none'; // Ensure prompt input is hidden for confirm dialog
    customPromptInput.value = '';


    customConfirmOkButton.removeEventListener('click', handleDialogConfirm);
    customConfirmCancelButton.removeEventListener('click', handleDialogCancel);

    currentOnConfirmCallback = onConfirm;
    currentOnPromptConfirmCallback = null; // Not a prompt
    currentOnCancelCallback = onCancel || null;

    customConfirmOkButton.addEventListener('click', handleDialogConfirm);
    customConfirmCancelButton.addEventListener('click', handleDialogCancel);

    customConfirmOkButton.textContent = 'Confirm';
    if (isDestructive) {
        customConfirmOkButton.classList.add('confirm-ok-destructive');
    } else {
        customConfirmOkButton.classList.remove('confirm-ok-destructive');
    }
    
    const targetParent = parentElement || document.getElementById('detailsPanel') || document.body;
    if (customConfirmOverlay.parentNode !== targetParent) {
        targetParent.appendChild(customConfirmOverlay);
    }
    customConfirmOverlay.style.display = 'flex';
}


export function showCustomPromptDialog(
    message: string,
    onConfirm: (value: string) => void,
    onCancel?: () => void,
    parentElement?: HTMLElement | null,
    defaultValue: string = ''
): void {
    if (!customConfirmOverlay || !customConfirmMessage || !customPromptInput || !customConfirmOkButton || !customConfirmCancelButton) {
        console.error("Custom confirm/prompt dialog elements not found. Cannot show prompt.");
        // Potentially call onCancel or a specific error handler if critical
        if(onCancel) onCancel();
        return;
    }

    customConfirmMessage.textContent = message;
    customPromptInput.style.display = 'block';
    customPromptInput.value = defaultValue;
    customPromptInput.focus();


    customConfirmOkButton.removeEventListener('click', handleDialogConfirm);
    customConfirmCancelButton.removeEventListener('click', handleDialogCancel);

    currentOnConfirmCallback = null; // Not a simple confirm
    currentOnPromptConfirmCallback = onConfirm;
    currentOnCancelCallback = onCancel || null;

    customConfirmOkButton.addEventListener('click', handleDialogConfirm);
    customConfirmCancelButton.addEventListener('click', handleDialogCancel);
    
    customConfirmOkButton.textContent = 'OK';
    customConfirmOkButton.classList.remove('confirm-ok-destructive'); // Ensure neutral style

    const targetParent = parentElement || document.getElementById('controlsOverlay') || document.body; // Default to controlsOverlay for prompts
    if (customConfirmOverlay.parentNode !== targetParent) {
        targetParent.appendChild(customConfirmOverlay);
    }
    customConfirmOverlay.style.display = 'flex';
}


export function hideCustomConfirmDialog(): void {
    if (customConfirmOverlay) {
        customConfirmOverlay.style.display = 'none';
    }
    if (customPromptInput) { // Also hide prompt input when dialog closes
        customPromptInput.style.display = 'none';
        customPromptInput.value = '';
    }
    if (customConfirmOkButton) {
        customConfirmOkButton.removeEventListener('click', handleDialogConfirm);
        customConfirmOkButton.classList.remove('confirm-ok-destructive'); // Reset style
    }
    if (customConfirmCancelButton) {
        customConfirmCancelButton.removeEventListener('click', handleDialogCancel);
    }
    
    currentOnConfirmCallback = null;
    currentOnPromptConfirmCallback = null;
    currentOnCancelCallback = null;
}

// --- CSS Variable Helper ---
export function getComputedCssVar(variableName: string): string {
    // Use document.body to correctly get variables affected by body.dark-mode
    return getComputedStyle(document.body).getPropertyValue(variableName).trim();
}

// --- Text Color for Background Helper ---
export function getTextColorForBackground(hexBgColor: string): string {
    const bgColor = hexBgColor.replace("#", "");
    if (bgColor.length !== 6 && bgColor.length !== 3) return '#000000'; // Default to black for invalid hex

    let r, g, b;
    if (bgColor.length === 3) {
        r = parseInt(bgColor[0] + bgColor[0], 16);
        g = parseInt(bgColor[1] + bgColor[1], 16);
        b = parseInt(bgColor[2] + bgColor[2], 16);
    } else { // length is 6
        r = parseInt(bgColor.substring(0, 2), 16);
        g = parseInt(bgColor.substring(2, 4), 16); // Corrected: end index should be 4
        b = parseInt(bgColor.substring(4, 6), 16); // Corrected: end index should be 6
    }

    // Check for NaN values which can occur if parsing fails (e.g., from incorrect substring)
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
        return '#000000'; // Default to black if parsing failed
    }

    // Calculate brightness (YIQ formula)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // Threshold can be adjusted. 128 is common.
    // If brightness < 128, background is dark, use light text.
    // Else, background is light, use dark text.
    return brightness < 128 ? '#FFFFFF' : '#000000';
}

// --- Hash String to Color ---
export function hashStringToColor(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer (keeps it signed)
    }

    // Improve distribution for HSL values
    // Using a common prime multiplier for hue dispersion (golden angle approximation related)
    const hue = (Math.abs(hash * 137.508) % 360); 
    
    // Mix bits for saturation and lightness sources to make them less dependent on simple hash sequence
    const saturationSource = Math.abs((hash >> 7) ^ (hash << 5)); 
    const lightnessSource = Math.abs((hash >> 15) ^ (hash << 3));

    // Saturation: 60-90% (vibrant)
    const saturation = 60 + (saturationSource % 31); 
    // Lightness: 45-70% (good visibility, not too dark/light)
    const lightness = 45 + (lightnessSource % 26);   
    
    return `hsl(${hue.toFixed(0)}, ${saturation.toFixed(0)}%, ${lightness.toFixed(0)}%)`;
}

// --- Format text with [Term](QID) references for HTML display ---
export function formatTextWithReferences(rawText: string): string {
    if (!rawText) return '';
    const referenceRegex = /\[([^\]]+?)\]\((Q\d+?)\)/g;
    return rawText.replace(referenceRegex, (match, term, qid) => {
        // Display only the term, use QID in title for tooltip
        return `<span class="reference-link" title="Wikidata: ${qid}">${term}</span>`;
    });
}

// --- Extract displayable text from [Term](QID) references for plain text (e.g., canvas labels) ---
export function extractDisplayableTextFromReferences(rawText: string): string {
    if (!rawText) return '';
    const referenceRegex = /\[([^\]]+?)\]\(Q\d+?\)/g;
    // Replace "[Term](QID)" with "Term"
    return rawText.replace(referenceRegex, '$1');
}