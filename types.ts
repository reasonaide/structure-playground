// types.ts
import { ElementDefinition } from 'cytoscape';

export type DPType = 'statement' | 'question' | 'argument' | 'reference' | 'unspecified';

export type CyNodeData = {
    id: string;
    rawText: string;
    comment: string;
    shortLabel: string;
    fullLabelText: string;
    truncatedLabel: string;
    label: string; // Current label to display
    tooltipContent: string;
    type: DPType;
};

export type CyEdgeData = {
    id:string;
    source: string;
    target: string;
    label: string; // Predicate
    color: string;
    comment: string;
    direction: 'directed' | 'undirected' | 'none';
    tooltipContent: string;
    subjectContextualText?: string;
    objectContextualText?: string;
};

export type CyElementData = CyNodeData | CyEdgeData; // Union type for data property
export type CyElementDefinition = ElementDefinition;


export type ChatMessage = {
    text: string;
    type: 'user' | 'ai' | 'ai-code'; // ai-code for structured AI output like JSON or ruleset echoes
    isCodeBlock?: boolean;
};

export interface ExportData {
    version: string;
    chatHistory: ChatMessage[];
    currentAiStructure: string;
    selectedModel?: string;
}

export type ConnectedNodeInfo = {
    id: string;
    text: string;
};

export type ConnectionGroup = {
    color: string;
    nodes: ConnectedNodeInfo[];
};