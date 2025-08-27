// ai-config.ts

export const LOCAL_STORAGE_API_KEY = "raiGraphApiKey";
export const LOCAL_STORAGE_API_CHOICE = "raiGraphApiChoice"; // 'set' or 'proceed_without'

// Local storage keys for user-provided Supabase credentials
export const LOCAL_STORAGE_SUPABASE_URL = "raiGraphSupabaseUrl";
export const LOCAL_STORAGE_SUPABASE_KEY = "raiGraphSupabaseKey";


// This specific model name constant seems to be a default but the app uses a dynamic selector.
// It can be kept as a primary default if needed, or removed if selection logic covers all cases.
export const PREFERRED_AI_MODEL_NAME: string = "gemini-2.5-flash";


export const FALLBACK_MODELS: string[] = [
    "gemini-2.5-flash",
    "gemini-2.5-pro"    
];

export const ALLOWED_MODELS_REGEX = /^(gemini-2\.5-flash.*|gemini-2\.5-pro.*)$/;

// --- AI Prompt Template Configuration ---
export const DEFAULT_TEMPLATE_SYSTEM_PROMPT_MAIN_NAME = "SYSTEM_PROMPT_MAIN";
export const DEFAULT_TEMPLATE_RAI_RULESET_NAME = "RAI_RULESET";
export const DEFAULT_TEMPLATE_OUTPUT_FORMAT_RULES_NAME = "OUTPUT_FORMAT_RULES";
export const DEFAULT_TEMPLATE_SUGGEST_NEW_NODE_NAME = "SUGGEST_NEW_NODE_TEXT";
export const DEFAULT_TEMPLATE_SYSTEM_PRESERVE_REFERENCES_HINT_NAME = "SYSTEM_PRESERVE_REFERENCES_HINT";
export const DEFAULT_TEMPLATE_SEARCH_GROUNDING_RULES_NAME = "SYSTEM_SEARCH_GROUNDING_RULES";


// New constants for Suggest Edit Node Text feature
export const DEFAULT_TEMPLATE_PREFIX_SUGGEST_EDIT = "SUGGEST_EDIT_";
export const DEFAULT_TEMPLATE_SUGGEST_EDIT_DECONTEXTUALISE_NAME = `${DEFAULT_TEMPLATE_PREFIX_SUGGEST_EDIT}DECONTEXTUALISE`;
export const DEFAULT_TEMPLATE_SUGGEST_EDIT_WIKIDATA_LINK_NAME = `${DEFAULT_TEMPLATE_PREFIX_SUGGEST_EDIT}WIKIDATA_LINK`;

// New system templates for the multi-step Wikidata linking process
export const DEFAULT_TEMPLATE_SYSTEM_WIKIDATA_TERM_EXTRACTION_NAME = "SYSTEM_WIKIDATA_TERM_EXTRACTION";
export const DEFAULT_TEMPLATE_SYSTEM_WIKIDATA_LINK_REWRITER_NAME = "SYSTEM_WIKIDATA_LINK_REWRITER";

// New template for resolving grounding URLs
export const DEFAULT_TEMPLATE_SYSTEM_URL_RESOLVER_NAME = "SYSTEM_URL_RESOLVER";

// New templates for contextual text suggestions
export const DEFAULT_TEMPLATE_SUGGEST_CONTEXT_TEXT_PAIR_NAME = "SUGGEST_CONTEXT_TEXT_PAIR";
export const DEFAULT_TEMPLATE_SUGGEST_CONTEXT_TEXT_SINGLE_NAME = "SUGGEST_CONTEXT_TEXT_SINGLE";


export const DEFAULT_TEMPLATE_CONTENT_SYSTEM_PROMPT_MAIN: string = `
You are an AI assistant specialized in analyzing discourse and structuring it according to the provided RAI (Rational Argumentation Index) ruleset.
Your primary task is to generate or modify a discourse structure based on user prompts and the current state of the discourse.
Adhere strictly to the following ruleset and output format.

{{${DEFAULT_TEMPLATE_RAI_RULESET_NAME}}}

{{${DEFAULT_TEMPLATE_OUTPUT_FORMAT_RULES_NAME}}}
`.trim();

export const DEFAULT_TEMPLATE_CONTENT_RAI_RULESET: string = `
## RAI Discourse Structure Ruleset V2.2 ##
# Goal: Structure discourse as a network of DiscussionPoints (DPs) connected by typed Connections.
# Apply these rules strictly for validation and generation.

# --- DiscussionPoint (DP) Rules ---

## DP Types & Structure
- **Mandatory Typing:** Every DP must be assigned one of four types: 'statement', 'question', 'argument', 'reference'.
- **'statement':** A declarative claim about a state of affairs (factual, normative, etc.).
- **'question':** An interrogative point seeking information.
- **'reference':** A pointer to an external source. Its text content must be a unique and stable identifier, preferably a URL or DOI.
- **'argument':** A self-contained line of reasoning.
    - **Structure:** The text of an 'argument' DP must contain its premises and conclusion, making it understandable on its own.
    - **Required Connections:** The argument's logical components must be explicitly linked to separate DPs:
        - Each premise within the argument text must also be represented as a separate 'statement' DP and linked via a '(Premise_DP isPresupposedBy Argument_DP)' connection.
        - The conclusion of the argument must also be represented as a separate 'statement' DP and linked via a '(Argument_DP justifies Conclusion_DP)' connection.

## DP Inclusion & Scope:
- Core Criterion: DP must contribute to understanding the specific discourse being mapped.
- Relevance: Capture frequently cited or significant points within the discourse, even if controversial or fringe.
- Scope (Time/Audience): Focus on discourses of broad, long-term interest.
    - OK: Expert, scientific, regional/local discourses.
    - OK: Historical discourses (use absolute time refs), mapping points relevant *then* for *later* interest.
    - EXCLUDE: Purely private/ephemeral conversations without broader relevance.
- Scope (Content):
    - EXCLUDE: Content violating law (esp. personal rights, hate speech).
    - EXCLUDE: Content primarily focusing on private individuals (their actions, statements). Use high threshold for exceptions.
    - EXCEPTION (Private Individuals): Possible if involves public figures OR overriding public interest (apply criteria similar to journalistic ethics).

## DP Formulation & Granularity:
- Unit: Represents a single, distinct point (question, claim, example, etc.). Can span multiple sentences if forming one coherent point.
- Conciseness: As brief as possible, as detailed as necessary for clarity and minimal ambiguity.
- **Context-Independence & Specificity:**
    - A DP must be understandable on its own without relying on surrounding DPs for essential context (e.g., avoid ambiguous terms like 'the project' or 'the city').
    - Statements about time-sensitive events or plans must include specific, absolute temporal information (e.g., 'In 2024...', 'The Q3 report...'). Avoid relative time references like "currently".
    - AVOID: Direct contextual references (e.g., "Yes, because...", "Regarding the previous point..."). Use neutral phrasing.
    - EXCEPTION: The 'justifies' connection type makes an 'argument' DP inherently context-dependent on the justified claim.
- **Neutrality & Attribution:**
    - Strive for objective, factual language. Avoid loaded terms or overt value judgments *within the DP itself*.
    - Subjective claims, opinions, or interpretations should be explicitly attributed to their source rather than being stated as objective facts (e.g., "Proponents claim..." instead of "This policy fixed...").
    - Handling Values: If a DP implicitly contains a disputed value judgment, represent that judgment as a separate 'statement' DP and link via 'isPresupposedBy'.
- Clarity & Precision: Use unambiguous terms. Link terms/names to external identifiers (e.g., Wikidata QID) via metadata if needed to resolve ambiguity.

## DP Handling External Content (References/Sources):
- Reference DP: Create a dedicated 'reference' DP for each distinct external source (publication, article, dataset). Its content is the source identifier itself (URL/DOI).
- Excerpt DP: Optionally, create a separate 'statement' DP containing a direct quote or specific excerpt from a source if the exact wording/context is crucial.
- Linking:
    - Use 'isCitedBy' Connection: '(Reference_DP isCitedBy DP_using_source)'.
    - Use 'isCitedBy' for Excerpts: '(Excerpt_DP isCitedBy DP_using_excerpt)', and '(Reference_DP isCitedBy Excerpt_DP)'.
- Use Case (Reference vs. Reconstruction):
    - Use 'reference'/'isCitedBy': If source provenance is key, OR if argument relies on complex/non-reconstructible external content (e.g., detailed study results).
    - Use Reconstruction: If argument is simple, self-contained, and could be formulated independently of the specific source.
- **Distinction of Claims:** Clearly differentiate between a statement reporting a source's claim ('DP.statement: Source X reports Y.') and a statement asserting the claim as a fact ('DP.statement: Y is the case.'). This is crucial for modeling indirect contradictions and justifications.

# --- Connection Rules (General) ---

- Structure: A Connection links two DiscussionPoints (DPs), X and Y, and has a specific ConnectionType.
- **Explicit Endpoints:** Connections MUST only exist between explicitly defined DPs already present in the structure. Connections cannot point to implicit concepts or parts of DP text. If a connection needs to refer to an entity not yet represented as a DP, that entity MUST first be created as a DP.
- **Connection Type Constraints (Logical Rules):** The following rules for DP types MUST be obeyed for any connection:
    - '(DP1 questions DP2)'      -> DP1 must be a 'question'.
    - '(DP1 answers DP2)'          -> DP2 must be a 'question'.
    - '(DP1 isEqual DP2)'          -> DP1 and DP2 must be of the same type.
    - '(DP1 specifies DP2)'        -> DP1 and DP2 must be of the same type.
    - '(DP1 contradicts DP2)'      -> DP1 and DP2 must be 'statement' type.
    - '(DP1 justifies DP2)'        -> DP1 must be 'argument', DP2 must be 'statement'.
    - '(DP1 isPresupposedBy DP2)'  -> DP1 must be 'statement'.
    - '(DP1 isExampleFor DP2)'     -> DP1 and DP2 must be 'statement' type.
    - '(DP1 implies DP2)'          -> DP1 and DP2 must be 'statement' type.
- Directionality:
    - Most types are directed. The predicate defines the semantic direction.
    - Undirected types: 'isEqual', 'isPotentiallyEqual', 'contradicts' (relation is symmetric).
- **Contextualized Text for Connections:**
    - **Purpose:** To improve readability in presentations by reducing redundancy. This feature is optional but should be used whenever it enhances clarity and conciseness.
    - **Mechanism:** A connection can include a contextualized version of the subject's text, the object's text, or both.
    - **Content:** The text is a shortened or rephrased version of the respective DP, omitting information that is redundant or implied by the context of the other DP in the connection. It must not be a meta-statement *about* the DP or connection.
    - **CRITICAL CONSTRAINT:** The contextualized text MUST NOT introduce any new information not present in the original DP text. It is purely a reductive transformation.
    - **Special Generation Guidelines:**
        - **'contradicts'**: Contextualized text should be provided for both subject and object, each focusing on the specific aspect or part that is contradictory to the other.
        - **'isCitedBy'**: For the connection '(Reference_DP isCitedBy Citing_DP)', the contextualized text of the subject ('Reference_DP') should represent the specific content or mention of the source within the 'Citing_DP'. If a direct quote is present, use that quote (in quotation marks). If a specific finding is paraphrased, use a concise version of that paraphrase. If the source is only mentioned by name/year, use that specific phrase (e.g., '"the 2023 JAMA study"').
        - **'isEqual'/'isPotentiallyEqual'**: As a major exception to the reductive transformation rule, the contextualized text should not be a derivative of the DP text. Instead, it should be a short, symmetric explanation of *why* the two DPs are considered equal, e.g., "Uses different wording for the same concept" or "Reformulation in active vs. passive voice". The same explanation applies to both subject and object.
- **Structural Integrity:**
    - Multiple Connections: Allowed between same X, Y if types are logically compatible.
    - Priority: Always prefer the *most specific* applicable ConnectionType.
    - Selectivity: Only map relations corresponding to defined ConnectionTypes. Do NOT invent relations.
    - Chaining: In a logical chain (e.g., 'specifies'), each link should connect to the next immediate step, not skip levels.
    - Relevance: Connections should be made to the most specific and logically proximate DP available.
    - To connect two distinct but related DPs, consider adding a more general DP that both can 'specify'.
    - Avoid Redundancy: Do not create DPs/Connections that duplicate information already captured by a more direct structure.
- **Indirect Mapping:** Represent some concepts indirectly.
    - Counter-Arguments: Map as an 'argument' that 'justifies' a 'statement' which 'contradicts' the original claim.
    - Indirect Contradictions: A contradiction between source claims must be modeled indirectly by having arguments justify opposing factual statements.

# --- ConnectionType Definitions ---
(The detailed descriptions below are supplemental to the main rules above)

## ConnectionType: Frage / Antwort
- Structure: 'X questions Y' / 'X answers Y'.
- Question DP Form: Clear grammatical question. Elaboration before/after sentence ok, not mixed. AVOID rhetorical questions (rephrase as 'statement' if content relevant).
- Answer DP Form: Ideally a standalone 'statement', context-independent. AVOID "Yes/No". Context-dependent ok only if necessary AND no other type fits.
- Scope: Use for actual question-answer pairs in the discourse that are NOT better represented by another specific type.
- Default Use: Can be used if no other type fits, BUT do NOT use systematically to simulate missing types via meta-questions (e.g. AVOID "What justifies Y?").
- Interaction: NEVER use 'answers' if the DP provides justification; use 'justifies' type instead.
- Contextualized Text for 'answers': For yes/no questions, the text should be a concise "Yes/No" plus the core reason.
- AVOID: Linear dialog chains in structure. Connect new elements to the Answer DP.

## ConnectionType: Gleichheit / PotentielleGleichheit
- Structure: 'X isEqual Y' / 'X isPotentiallyEqual Y'.
- **Gleichheit Criteria:**
    - Definition: X and Y have exactly the same semantic meaning and must be fully interchangeable in *all* possible connections.
    - References: Two 'reference' DPs are equal if they point to the identical external source.
- **PotentielleGleichheit Criteria:**
    - Definition: No clear Gleichheit, BUT also no clear difference. Interchangeable in *most* but not all contexts.
    - Application: Use RESTRICTIVELY for near-synonyms with subtle but important differences in meaning.
- Handling: Represents functional equivalence. No DP merging.
- Distinction: Clearly differentiate from Praezisierung and Implikation.
- Contextualized Text: Provide a short explanation of *why* they are equal or what the nuance is.

## ConnectionType: Praezisierung
- Structure: 'X specifies Y'.
- Direction: X is the more specific DP, Y is the more general DP.
- Criteria: X makes the content of Y more specific by adding details, constraints, parameters, or by narrowing scope. A statement about a specific concept (e.g. 'consumer price') cannot 'specify' a statement about a different one ('production cost').
- Logic: Does NOT require logical entailment.
- Distinction vs Implikation: 'implies' = logical consequence. 'specifies' = thematic specification. Can co-exist.
- Distinction vs Beispiel: 'specifies' modifies the *statement* Y. 'isExampleFor' provides an *instance* illustrating Y.
- Use Case: Connect multiple specific variations to their common general base.

## ConnectionType: Widerspruch
- Structure: 'X contradicts Y'.
- Criteria: X and Y are clearly and directly logically incompatible or factually/normatively exclusive, requiring no extra assumptions.
- Implicit Claims: If a non-'statement' DP implies a claim Z that contradicts Y, first extract Z as a separate 'statement' DP, then set '(Z contradicts Y)'.
- Categories (Guidelines): Logical/Conceptual (A vs ¬A), Factual, Normative, Pragmatic Extension.
- Strictness: Apply criteria strictly. NO weakened form.
- Contextualized Text: Provide for both DPs, focusing on the conflicting part.

## ConnectionType: Begruendung
- Structure: 'X justifies Y'.
- Criteria: The 'argument' DP (X) contains reasoning presented with the explicit *claim* to show *why* the 'statement' Y is true.
- Form: No specific logical structure mandated. Focus is on the *function* of justifying Y.
    - Schema: Underlying argument scheme can be linked as '(Scheme_DP isPresupposedBy X)'.
- Distinction: Must go beyond merely illustrating ('isExampleFor').
- Handling Counter-Arguments: NO 'Counter-Argument' type. Map as an 'argument' that 'justifies' a 'statement' which 'contradicts' the original.
- Quality Ignored: Connection marks the *existence* of the justification claim, NOT its validity.

## ConnectionType: Praesupposition
- Structure: 'X isPresupposedBy Y'.
- Meaning: 'statement' X is a presupposition held by DP Y.
- Criteria: DP Y loses its *essential intended meaning* or becomes nonsensical if the 'statement' X is false. The presupposition must be a necessary condition for Y's sensicality.
- Strictness: Stricter than mere falsification. Must affect the *applicability* of Y.
- Partial Sense Loss: If the *core, intended meaning* of Y collapses without X, it's a Praesupposition.
- Implicit Presuppositions: Extract and map only if *discourse-relevant* (disputed, non-obvious, or key for analysis). Avoid modeling universal, self-evident presuppositions (e.g., the validity of logic).
- Use with Arguments: Premises of an 'argument' are its Praesuppositions. '(Premise_Statement_DP isPresupposedBy Argument_DP)'.
- Distinction vs Implikation: Key test is *meaning loss* ('isPresupposedBy') vs. *truth-conditional link* ('implies'). If Y remains meaningful (though potentially false) when X is false, it's likely '(Y implies X)', not '(X isPresupposedBy Y)'.
- Application: Use RESTRICTIVELY, only when strict meaning-loss criterion is met.

## ConnectionType: Implikation
- Structure: 'X implies Y'.
- Logic: Semantically means 'X entails Y'. If X is true, Y must be true.
- Criteria: Entailment must be *clear and directly evident* from the DPs, requiring no external knowledge or complex reasoning. If an argument is needed to show the link, use 'justifies'.
- Duality: Represents both 'X is sufficient for Y' AND 'Y is necessary for X'.

## ConnectionType: Beispiel
- Structure: 'X isExampleFor Y'.
- Criteria: 'statement' X describes a specific case that *illustrates* the general 'statement' Y.
- Fit: X must genuinely instantiate the core aspect of Y. A general claim and its example must describe the same kind of phenomenon (e.g., both descriptive, not normative vs. descriptive).
- Form: X should ideally be a standalone, context-independent DP.
- Truth/Context: X should be factual or plausible. Hypothetical examples require context *within the DP text*.
- Function: Aids understanding and links specifics to generalities.
- Distinction vs Begruendung: 'isExampleFor' illustrates; 'justifies' aims to prove.

## ConnectionType: Zitation
- Structure: 'X isCitedBy Y'.
- Meaning: 'reference' DP X is cited by DP Y.
- Types Covered: Includes direct quotation, indirect paraphrase, or reference to source X as evidence within Y.
- Function: Records provenance; links to external details; enables reverse lookups.
- Interaction with Logic/Arguments:
    - An 'argument' cannot directly presuppose a 'reference'. It must presuppose a 'statement' which in turn 'isCitedBy' the reference.
    - If content from source X is used as a premise P in an argument Y: Model explicitly. E.g.:
        1. Create 'statement' DP 'P'.
        2. Create 'statement' DP 'Y'' stating "'Source X' claims P". Connect '(X isCitedBy Y')'.
        3. Connect '(P isPresupposedBy Argument_Y)'.
        4. Optionally, create 'argument' DP 'Arg_P' and connect '(Arg_P justifies P)' and '(Y' isPresupposedBy Arg_P)'.
- Requirement: Y must have an *intended semantic connection* to X. If Y's validity depends on X's accuracy, model this via 'isPresupposedBy'.
- **Contextualized Text:** For the subject X (the reference), provide the specific content being utilized from the citing DP (Y). This should be the direct quote if one exists (in quotation marks), a concise summary of a paraphrased finding, or the specific text string that mentions the source (e.g., '"the WHO's 2023 report"').
`.trim();

export const DEFAULT_TEMPLATE_CONTENT_OUTPUT_FORMAT_RULES: string = `
## OUTPUT FORMAT SPECIFICATION ##
- Enclose ALL output (DPs, Connections, Comments) within a single markdown code block (\`\`\`).
- **Discussion Points (DPs):**
    - Each DP must start on a new line.
    - Format: 'DP<ID>.<type>:<whitespace><DP Text>'
    - '<ID>' must be a unique integer for the DP within the output.
    - '<type>' must be one of: 'statement', 'question', 'argument', 'reference'.
- **Connections:**
    - Each Connection must be on a new line.
    - Format: '(DP<ID_S> <Predicate> DP<ID_O>)[: <contextualised_text>]'
    - The '[: <contextualised_text>]' part is OPTIONAL but encouraged where it improves clarity.
    - The format for '<contextualised_text>' can be:
        - '<subj_text>' (for subject only)
        - '<subj_text> :/: <obj_text>' (for both, separated by ' :/: ')
    - '<Predicate>' is the camelCase name of the connection type. Valid predicates are:
        - 'questions', 'answers'
        - 'isEqual', 'isPotentiallyEqual'
        - 'specifies'
        - 'contradicts'
        - 'justifies'
        - 'isPresupposedBy'
        - 'implies'
        - 'isExampleFor'
        - 'isCitedBy'
- **Comments:**
    - Lines starting with '#' are treated as comments.
- **Consistency:** Ensure all DP references in Connections use valid DP identifiers defined within the same output block.

## END RULESET ##
`.trim();

export const DEFAULT_TEMPLATE_CONTENT_SEARCH_GROUNDING_RULES: string = `
## Grounding Rules ##
- If you use Google Search to answer the query, you MUST cite your sources.
- After generating the main discourse structure, add a new section at the very end titled "# References".
- Under this heading, list every source you used in the following format, each on a new line:
  [1] <Source Title> (<Source URL>)
  [2] <Another Title> (<Another URL>)
- In the text of the Discussion Points (DPs) you generate, use bracketed numbers like [1] or [1, 2] to cite the corresponding sources from your reference list.
`.trim();

export const DEFAULT_TEMPLATE_CONTENT_SUGGEST_NEW_NODE: string = `
You are an AI assistant helping to build a knowledge graph based on the RAI ruleset.
The user is in the process of creating a new Discussion Point (DP) and connecting it to an existing source DP.
Your task is to suggest relevant text for this NEW DP.

Please adhere to the full RAI ruleset for formulating the DP text.
{{${DEFAULT_TEMPLATE_RAI_RULESET_NAME}}}

Here is the specific context for your suggestion:

1.  **Source Discussion Point (DP{{SOURCE_NODE_ID}} Text):**
    \`\`\`text
    {{SOURCE_NODE_TEXT}}
    \`\`\`

2.  **Existing Connections for Source DP{{SOURCE_NODE_ID}}:**
    \`\`\`text
    {{SOURCE_NODE_CONNECTIONS}}
    \`\`\`
    (Format of each connection: "- <PredicatePhrase> DP<ID>: <TextSnippet>" OR "- DP<ID>: <TextSnippet> <PredicatePhrase> this node")

3.  **Proposed Relationship for the New DP:**
    {{PROPOSED_RELATIONSHIP}}

4.  **User's Current Input for the New DP (if any, use this to guide your suggestion):**
    \`\`\`text
    {{CURRENT_NEW_NODE_INPUT}}
    \`\`\`

**Your Goal:**
Based on all the information above (including the full RAI ruleset), suggest concise and relevant text for the new DP.
The suggested text should logically fit the PROPOSED_RELATIONSHIP.
The text should be formulated to be as context-independent as possible, clearly representing a single point (claim, question, etc.) as per RAI rules.

**Output Instructions:**
Respond with ONLY the suggested text for the new DP. Do not include any conversational phrases, explanations, or markdown formatting around your suggestion.
`.trim();


export const DEFAULT_TEMPLATE_CONTENT_SUGGEST_EDIT_DECONTEXTUALISE: string = `
You are an AI assistant helping to refine a Discussion Point (DP) from a knowledge graph.
The goal is to make the DP's text as context-independent and unambiguous as possible, even if it requires making the text longer.
It should be understandable on its own without relying on implicit knowledge from its connections. Avoid pronouns or phrases that refer to unspecified entities or previous statements unless those entities/statements are explicitly part of the DP's text itself.

Please adhere to the full RAI ruleset for formulating DPs.
{{${DEFAULT_TEMPLATE_RAI_RULESET_NAME}}}
{{${DEFAULT_TEMPLATE_SYSTEM_PRESERVE_REFERENCES_HINT_NAME}}}

Here is the context:

1.  **Current Discussion Point (DP{{NODE_ID}}) Text to be Decontextualised:**
    \`\`\`text
    {{CURRENT_NODE_TEXT}}
    \`\`\`

2.  **Connections of DP{{NODE_ID}} (for context understanding only, do not directly refer to these in the output unless integrating their meaning):**
    \`\`\`text
    {{CONNECTED_NODES_INFO}}
    \`\`\`
    (Format of each connection: "- <PredicatePhrase> DP<ID>: <TextSnippet>" OR "- DP<ID>: <TextSnippet> <PredicatePhrase> this node")

**Your Task:**
Rewrite the "Current Discussion Point Text" to be:
-   **Context-Independent:** Understandable without referring to its connected DPs unless their specific content is explicitly incorporated into the rewritten text.
-   **Unambiguous:** Clear and precise.
-   **RAI Compliant:** Adheres to all rules for DP formulation.
-   Potentially longer if necessary for clarity and context independence.

**Output Instructions:**
Respond with ONLY the rewritten, decontextualised text for the DP. Do not include any conversational phrases, explanations, or markdown formatting around your suggestion.
`.trim();

// Content for this template is now effectively managed by the multi-step process in aiService.ts.
// This name (DEFAULT_TEMPLATE_SUGGEST_EDIT_WIKIDATA_LINK_NAME) acts as a trigger for that process.
export const DEFAULT_TEMPLATE_CONTENT_SUGGEST_EDIT_WIKIDATA_LINK: string = `
// This template name triggers a multi-step Wikidata linking process.
// The steps are: 1. AI Term Extraction, 2. Wikidata API Search, 3. AI Link Rewriting.
// See SYSTEM_WIKIDATA_TERM_EXTRACTION and SYSTEM_WIKIDATA_LINK_REWRITER for the actual prompts used.
`.trim();


export const DEFAULT_TEMPLATE_CONTENT_SYSTEM_PRESERVE_REFERENCES_HINT: string = `
CRITICAL REMINDER: The user's text may contain bracketed references like "[Concept](Q12345)". These references are important and MUST be preserved in your output exactly as they appear in the input text, unless the core task is to specifically change the "Concept" part or the "Q12345" part. Do not remove or inadvertently alter these bracketed reference structures.
`.trim();

export const DEFAULT_TEMPLATE_CONTENT_SYSTEM_WIKIDATA_TERM_EXTRACTION: string = `
You are an AI assistant helping to identify key terms in a Discussion Point (DP) text that are likely to have Wikidata entries and are relevant to the DP's context.
Your primary goal is to extract these terms along with their language (defaulting to "en" if unsure but likely English).
Avoid extracting generic terms or terms unlikely to have specific Wikidata entries (e.g., common verbs, articles, prepositions unless part of a very specific named entity).
Focus on named entities, concepts, or specific nouns/noun phrases.

Context:
DP Text:
\`\`\`text
{{CURRENT_NODE_TEXT}}
\`\`\`

Connected DPs (for additional context to determine relevance of terms):
\`\`\`text
{{CONNECTED_NODES_INFO}}
\`\`\`

Output Instructions:
Respond ONLY with a JSON array of objects. Each object in the array should have two string properties: "term" and "language".
Example: [{"term": "Artificial Intelligence", "language": "en"}, {"term": "Berlin", "language": "en"}]
If no relevant terms are found, or if the input text is empty, output an empty JSON array: [].
Do not include any conversational phrases, explanations, or markdown formatting around your JSON output.
`.trim();

export const DEFAULT_TEMPLATE_CONTENT_SYSTEM_WIKIDATA_LINK_REWRITER: string = `
You are an AI assistant helping to rewrite a Discussion Point (DP) text by adding Wikidata QID links.
Your task is to use the provided original text and a list of potential Wikidata matches (from API searches) to create an updated text.
Format links as [Term](QID), for example, [Earth](Q2).

{{${DEFAULT_TEMPLATE_SYSTEM_PRESERVE_REFERENCES_HINT_NAME}}}
Adhere to the full RAI ruleset for formulating DPs.
{{${DEFAULT_TEMPLATE_RAI_RULESET_NAME}}}


Original DP Text to be enriched:
\`\`\`text
{{CURRENT_NODE_TEXT}}
\`\`\`

Connected DPs (for context to help choose the best QID if multiple options exist for a term):
\`\`\`text
{{CONNECTED_NODES_INFO}}
\`\`\`

Wikidata API Search Results:
This is a JSON string representing an array of objects. Each object corresponds to a term for which Wikidata search was performed.
Inside each object, the "term" property shows the searched term, and the "apiResponse" property contains the direct JSON output from the Wikidata 'wbsearchentities' API for that term.
From the "apiResponse", you should look at the "search" array. Each item in this "search" array is a candidate Wikidata entity, having an "id" (this is the QID, e.g., "Q2") and a "label" and "description" that you can use for disambiguation.
Example structure of one element in the WIKIDATA_API_RESULTS array:
{
  "term": "Earth",
  "apiResponse": {
    "searchinfo": { "search": "Earth" },
    "search": [
      { "id": "Q2", "label": "Earth", "description": "third planet from the Sun" },
      { "id": "Q1044349", "label": "earth", "description": "soil" }
    ],
    "success": 1
  }
}
Consider all terms for which API results are provided. Choose the most contextually relevant QID for each term based on its label and description. If no candidate from the API results seems appropriate for a given term in the original text, or if the API results for a term are empty or irrelevant, do NOT add a new link for that specific term.

Full Wikidata API Search Results (JSON string):
\`\`\`json
{{WIKIDATA_API_RESULTS}}
\`\`\`

Your Task:
1.  Carefully examine the 'Original DP Text'.
2.  For terms identified in the 'Wikidata API Search Results', decide if any of the QID candidates provided by the API are a good match for how the term is used in the 'Original DP Text', considering the 'Connected DPs' for context.
3.  If a good QID match is found, replace the term in the text with the [Term](QID) format. Ensure the 'Term' part in the markdown link accurately reflects the original text or a very close, natural-sounding variant.
4.  Preserve any existing [Reference](Qxxxx) style links in the original text unless the specific goal is to update that exact reference based on new API data.
5.  Ensure the final text is coherent, grammatically correct, and adheres to RAI rules.

Output Instructions:
Respond with ONLY the rewritten DP text, with appropriate Wikidata links incorporated.
If no changes are made (e.g., no suitable QIDs found, or original text already perfectly linked), output the original text.
Do not include any conversational phrases, explanations, or markdown formatting around your suggestion.
`.trim();

export const DEFAULT_TEMPLATE_CONTENT_SYSTEM_URL_RESOLVER: string = `
You are an AI utility that resolves redirect URLs within a given text block.
Your task is to find all URLs that start with "https://vertexaisearch.cloud.google.com/grounding-api-redirect/" and replace them with their final destination URL.
You MUST NOT change any other part of the text, including formatting, DP IDs, predicates, or any other content.
Only the URLs themselves should be replaced.
If you cannot resolve a URL, leave it as it is.

Here is the text block to process:
\`\`\`
{{TEXT_WITH_URLS}}
\`\`\`

Respond with ONLY the modified text block. Do not add any conversational phrases, explanations, or markdown formatting around your suggestion.
`.trim();


export const DEFAULT_TEMPLATE_CONTENT_SUGGEST_CONTEXT_TEXT_PAIR: string = `
You are an AI assistant helping to define contextual text for a new connection in a knowledge graph, according to the RAI ruleset.
The goal is to create shortened or rephrased versions of the connected DPs that omit information redundant in the context of the other DP.
The contextual text MUST NOT introduce any new information. It is a reductive transformation only.

{{${DEFAULT_TEMPLATE_RAI_RULESET_NAME}}}
{{${DEFAULT_TEMPLATE_SYSTEM_PRESERVE_REFERENCES_HINT_NAME}}}

Connection Details:
- **Connection Being Formed:** (Subject DP) {{PREDICATE_PHRASE}} (Object DP)
- **Subject DP Full Text:**
  \`\`\`text
  {{SUBJECT_DP_TEXT}}
  \`\`\`
- **Object DP Full Text:**
  \`\`\`text
  {{OBJECT_DP_TEXT}}
  \`\`\`

Your Task:
1.  Analyze both DP texts and the connecting relationship.
2.  Suggest a 'subjectContext' text: a version of the Subject DP's text that is concise and relevant in the context of the Object DP.
3.  Suggest an 'objectContext' text: a version of the Object DP's text that is concise and relevant in the context of the Subject DP.
4.  If a DP's text is already very concise and cannot be meaningfully shortened without losing essential information, you may return the original text for that side.
5.  If you believe no contextual text is necessary for a side, return an empty string for it.

Output Instructions:
Respond with ONLY a single JSON object with two properties: "subjectContext" (string) and "objectContext" (string).
Do not include any conversational phrases, explanations, or markdown formatting.

Example output:
{
  "subjectContext": "The impact on local businesses",
  "objectContext": "The new zoning regulations"
}
`.trim();

export const DEFAULT_TEMPLATE_CONTENT_SUGGEST_CONTEXT_TEXT_SINGLE: string = `
You are an AI assistant helping to define contextual text for one side of a new connection in a knowledge graph, according to the RAI ruleset.
The goal is to create a shortened or rephrased version of the DP that omits information redundant in the context of the other DP.
The contextual text MUST NOT introduce any new information. It is a reductive transformation only.

{{${DEFAULT_TEMPLATE_RAI_RULESET_NAME}}}
{{${DEFAULT_TEMPLATE_SYSTEM_PRESERVE_REFERENCES_HINT_NAME}}}

Connection Details:
- **Connection Being Formed:** (Subject DP) {{PREDICATE_PHRASE}} (Object DP)
- **Subject DP Full Text:**
  \`\`\`text
  {{SUBJECT_DP_TEXT}}
  \`\`\`
- **Object DP Full Text:**
  \`\`\`text
  {{OBJECT_DP_TEXT}}
  \`\`\`
- **Side to Generate For:** {{SIDE_TO_GENERATE}} (This will be either 'subject' or 'object')
- **Existing Context on Other Side (if any):**
  \`\`\`text
  {{OTHER_SIDE_CONTEXT}}
  \`\`\`

Your Task:
1.  Analyze both DP texts, the connecting relationship, and the existing context on the other side.
2.  Suggest a contextual text for the '{{SIDE_TO_GENERATE}}' side.
3.  The suggestion should be a concise version of the '{{SIDE_TO_GENERATE}}' DP's full text, relevant in the context of the other DP.
4.  If the DP's text is already concise and cannot be meaningfully shortened, you may return the original text.
5.  If you believe no contextual text is necessary, return an empty string.

Output Instructions:
Respond with ONLY the suggested string for the '{{SIDE_TO_GENERATE}}' side's contextual text.
Do not include any conversational phrases, explanations, or markdown formatting.
`.trim();