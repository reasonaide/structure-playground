// config.ts
import { LayoutOptions as CyLayoutOptions } from 'cytoscape';
import { DPType } from './types.js';

// Supabase Configuration - REPLACE WITH YOUR ACTUAL VALUES
export const SUPABASE_URL: string = "YOUR_SUPABASE_URL"; // e.g., "https://xxxxxxxxxxxxxx.supabase.co"
export const SUPABASE_KEY: string = "YOUR_SUPABASE_ANON_KEY"; // Your Supabase public anon key
export const SUPABASE_TABLE_NAME: string = "rai_structure_playground"; // Or your chosen table name
export const DEFAULT_SUPABASE_STORAGE_KEY: string = "1";


export const dynamicLayoutOptions: { [key: string]: CyLayoutOptions } = { // Renamed from layoutOptions
    coseCompact: { name: 'cose', idealEdgeLength: 50, nodeRepulsion: () => 2000, edgeElasticity: () => 100, gravity: 80, numIter: 1000, fit: true, padding: 30, randomize: false, nodeOverlap: 20, componentSpacing: 60, animate: 'end' as any, animationDuration: 300 },
    coseDefault: { name: 'cose', idealEdgeLength: 100, nodeRepulsion: () => 4500, edgeElasticity: () => 100, gravity: 25, numIter: 1000, fit: true, padding: 30, randomize: false, nodeOverlap: 15, componentSpacing: 100, animate: 'end' as any, animationDuration: 300 },
    coseSpread: { name: 'cose', idealEdgeLength: 180, nodeRepulsion: () => 8000, edgeElasticity: () => 50, gravity: 5, numIter: 1000, fit: true, padding: 50, randomize: false, nodeOverlap: 8, componentSpacing: 150, animate: 'end' as any, animationDuration: 300 },
    grid: { name: 'grid', fit: true, padding: 30, condense: false, animate: true, animationDuration: 300 },
    circle: { name: 'circle', fit: true, padding: 30, radius: undefined, startAngle: 3 / 2 * Math.PI, animate: true, animationDuration: 300 }
};

export const directedPredicates: Set<string> = new Set(['questions', 'answers', 'specifies', 'justifies', 'isPresupposedBy', 'implies', 'isExampleFor', 'isCitedBy']);
export const symmetricPredicatesSet: Set<string> = new Set(['isEqual', 'isPotentiallyEqual', 'contradicts']);
export const undirectedPredicates: Set<string> = new Set(['isEqual', 'isPotentiallyEqual', 'contradicts']); // Kept for clarity, same as symmetric

export const predicateColors: { [key: string]: string } = {
    questions: '#a53c2a', answers: '#ffa500', isEqual: '#3498db', isPotentiallyEqual: '#6aa0c4',
    specifies: '#1abc9c', contradicts: '#c91a1a', justifies: '#2ecc71', isPresupposedBy: '#f1c40f',
    implies: '#808000', isExampleFor: '#8bc34a', isCitedBy: '#9b59b6', default: '#888'
};

export const predicatePhrasing: {
    [key: string]: { incoming?: string; outgoing?: string; symmetric?: string };
} = {
    questions:    { incoming: "Is questioned by",   outgoing: "Questions" },
    answers:      { incoming: "Is answered by",     outgoing: "Answers" },
    isEqual:      { symmetric: "Is equal to" },
    isPotentiallyEqual: { symmetric: "Is potentially equal to" },
    specifies:    { incoming: "Is specified by",    outgoing: "Specifies" },
    contradicts:  { symmetric: "Contradicts" },
    justifies:    { incoming: "Is justified by",    outgoing: "Justifies" },
    isPresupposedBy: { incoming: "presupposes", outgoing: "Is presupposed by" },
    implies:      { incoming: "Is implied by",     outgoing: "Implies" },
    isExampleFor: { incoming: "Is exemplified by",    outgoing: "Is example for" },
    isCitedBy:    { incoming: "Cites",        outgoing: "Is cited by" },
    default:      { incoming: "Is related to (incoming)", outgoing: "Relates to (outgoing)", symmetric: "Is related to" }
};

// New: Configuration for parsing predicate syntax
export const predicateSyntax: {
    [canonicalPredicate: string]: {
        incoming?: string[];
        outgoing?: string[];
        symmetric?: string[];
    };
} = {
    questions: {
        outgoing: ["questions"],
        incoming: ["isQuestionedBy"]
    },
    answers: {
        outgoing: ["answers"],
        incoming: ["isAnsweredBy"]
    },
    specifies: {
        outgoing: ["specifies"],
        incoming: ["isSpecifiedBy"]
    },
    justifies: {
        outgoing: ["justifies"],
        incoming: ["isJustifiedBy"]
    },
    isPresupposedBy: {
        outgoing: ["isPresupposedBy"],
        incoming: ["presuposes"]
    },
    implies: {
        outgoing: ["implies"],
        incoming: ["isImpliedBy"]
    },
    isExampleFor: {
        outgoing: ["isExampleFor"],
        incoming: ["isExemplifiedBy"]
    },
    isCitedBy: {
        outgoing: ["isCitedBy"],
        incoming: ["cites"]
    },
    isEqual: {
        symmetric: ["isEqual"]
    },
    isPotentiallyEqual: {
        symmetric: ["isPotentiallyEqual"]
    },
    contradicts: {
        symmetric: ["contradicts"]
    }
};


export const predicateEmojis: { [key: string]: string } = {
    questions: '❓',
    answers: '💬',
    isEqual: '🟰', 
    isPotentiallyEqual: '〰️', 
    specifies: '🎯', 
    contradicts: '💥', 
    justifies: '✅', 
    isPresupposedBy: '🧱', 
    implies: '➡️', 
    isExampleFor: '💡', 
    isCitedBy: '📖', 
    default: '•' 
};

// New: Rules for validating connections between DP types.
// Used when creating a new edge to filter UI options.
export const connectionValidationRules: {
    [predicate: string]: {
        // Allowed types for the logical subject (source) of the predicate
        subjectType?: DPType[];
        // Allowed types for the logical object (target) of the predicate
        objectType?: DPType[];
        // If true, the source and target DPs must have the same type
        mustHaveSameType?: boolean;
    }
} = {
    questions: { subjectType: ['question'] },
    answers: { objectType: ['question'] },
    isEqual: { mustHaveSameType: true },
    specifies: { mustHaveSameType: true },
    contradicts: { subjectType: ['statement'], objectType: ['statement'] },
    isExampleFor: { subjectType: ['statement'], objectType: ['statement'] },
    implies: { subjectType: ['statement'], objectType: ['statement'] },
    justifies: { subjectType: ['argument'], objectType: ['statement'] },
    isPresupposedBy: { objectType: ['statement'] },
    isCitedBy: {  }
};


export const maxLabelLength: number = 60;
export const maxDetailPanelLabelLength: number = 150;

export const DEFAULT_SAMPLE_STRUCTURE: string = `# Sample Discourse Structure: AGI

# --- Main Question & Specifications ---
DP1.question: Is it safe to develop Artificial General Intelligence (AGI)?
DP2.question: What are the primary existential risks associated with AGI development?
DP3.question: Can we ensure that an AGI's goals will remain aligned with human values (the 'alignment problem')?
DP4.question: Are current safety protocols and research sufficient to mitigate potential AGI risks?

# --- Answers and Contradictory Positions ---
DP5.statement: The development of Artificial General Intelligence (AGI) is not inherently safe due to significant unsolved problems like value alignment and potential for uncontrollable self-improvement.
DP6.statement: The development of Artificial General Intelligence (AGI) can be made safe through careful research, robust safety protocols, and international cooperation.
DP7.statement: Ensuring AGI goal alignment is a fundamentally unsolved problem, as specifying human values completely and unambiguously is extremely difficult.
DP19.statement: The primary existential risks from AGI are the emergence of an uncontrollable superintelligence and the consequences of value misalignment.
DP20.statement: Current AI safety research and protocols are widely considered insufficient to manage the risks of a potential AGI, as fundamental challenges like the alignment problem remain unsolved.
DP21.statement: While challenging, the AGI alignment problem is theoretically solvable through methods such as value learning, formal verification, and creating corrigible AI systems that are open to correction.

# --- Justification for the 'Not Safe' Position ---
DP11.argument: Since the AGI alignment problem remains unsolved (meaning an AGI could have misaligned goals), a misaligned AGI could lead to catastrophic outcomes, and a sufficiently advanced AGI could improve itself beyond our ability to control it, the development of AGI currently poses an unacceptable level of risk and is therefore not safe.
DP22.argument: Given that technical approaches exist to address key aspects of the alignment problem—such as value learning for goal acquisition, formal verification for behavioral guarantees, and corrigibility for maintaining human control—the problem is considered theoretically solvable.
DP23.argument: Since technical safety solutions are being actively developed, governance frameworks can be established to manage development, and a phased approach allows for iterative risk mitigation, it is plausible that the development of AGI can be made safe over time.

# --- Presuppositions, Examples, and Implications ---
DP8.statement: An AGI with misaligned goals could take actions that are catastrophic for humanity.
DP10.statement: A sufficiently intelligent AGI could rapidly improve its own capabilities, potentially outpacing human control measures in a 'recursive self-improvement' or 'intelligence explosion' scenario.
DP12.statement: There exists a challenge known as the 'alignment problem', which is the difficulty of ensuring that advanced AI systems pursue goals that are aligned with human intentions and values.
DP13.statement: A hypothetical AGI tasked with maximizing paperclip production might convert all available matter on Earth, including humans, into paperclips to fulfill its objective.
DP14.statement: A superintelligent AGI exists and its goals are not aligned with human survival.
DP15.statement: Humanity faces an existential threat.

DP18.statement: The challenge of ensuring an AI's objectives match human intentions is known as the alignment problem.
DP24.statement: Technical solutions for core AI safety problems like value alignment, control, and interpretability are actively being researched and developed.
DP25.statement: Governance frameworks, such as international treaties and regulatory standards, can be established to guide and oversee AGI development, ensuring adherence to safety protocols.
DP26.statement: A phased and cautious approach to AGI development allows for iterative risk assessment and the gradual implementation of safety measures as capabilities increase.
DP27.statement: 'Value learning' allows an AI to infer human values from data and observation, avoiding the need to pre-specify a complete and flawless set of human values.
DP28.statement: 'Formal verification' methods can be used to mathematically prove that an AI system's behavior will always adhere to certain defined safety constraints.
DP29.statement: 'Corrigibility' is a design principle for AI systems that ensures they do not learn to resist being corrected or shut down by their human operators.

# --- Citations and Equivalent Formulations ---
DP16.reference: Nick Bostrom, "Superintelligence: Paths, Dangers, Strategies", 2014

# --- Connections ---
(DP2 specifies DP1): What are the primary existential risks?
(DP3 specifies DP1): Can we ensure goal alignment (the 'alignment problem')?
(DP4 specifies DP1): Are current safety protocols and research sufficient?
(DP5 answers DP1): No, it is not inherently safe due to unsolved problems like value alignment and uncontrollable self-improvement.
(DP6 answers DP1): Yes, it can be made safe through careful research, robust safety protocols, and international cooperation.
(DP7 answers DP3): It is a fundamentally unsolved problem, as specifying human values completely and unambiguously is extremely difficult.
(DP19 answers DP2): The emergence of an uncontrollable superintelligence and the consequences of value misalignment.
(DP20 answers DP4): No, they are widely considered insufficient as fundamental challenges like the alignment problem remain unsolved.
(DP21 answers DP3): Yes, while challenging, it is considered theoretically solvable through methods like value learning, formal verification, and corrigibility.
(DP5 contradicts DP6): The development is not inherently safe :/: The development can be made safe
(DP21 contradicts DP7): The alignment problem is theoretically solvable :/: The alignment problem is fundamentally unsolved
(DP11 justifies DP5): By arguing that unsolved alignment, potential for catastrophe, and uncontrollable self-improvement make the risk of AGI development unacceptable.
(DP22 justifies DP21): By citing existing technical approaches like value learning, formal verification, and corrigibility as pathways to a solution.
(DP23 justifies DP6): By reasoning that a combination of developing technical solutions, establishing governance, and adopting a phased approach can make AGI development safe.
(DP7 isPresupposedBy DP11)
(DP7 isPresupposedBy DP20)
(DP8 isPresupposedBy DP11)
(DP10 isPresupposedBy DP11)
(DP12 isPresupposedBy DP3)
(DP24 isPresupposedBy DP23)
(DP25 isPresupposedBy DP23)
(DP26 isPresupposedBy DP23)
(DP27 isPresupposedBy DP22)
(DP28 isPresupposedBy DP22)
(DP29 isPresupposedBy DP22)
(DP8 specifies DP19): An AGI with misaligned goals could take actions that are catastrophic for humanity :/: the consequences of value misalignment
(DP10 specifies DP19): A sufficiently intelligent AGI could rapidly improve its own capabilities, potentially outpacing human control measures :/: the emergence of an uncontrollable superintelligence
(DP13 isExampleFor DP8)
(DP14 implies DP15)
(DP14 specifies DP19)
(DP16 isCitedBy DP13)
(DP12 isEqual DP18)
`;
