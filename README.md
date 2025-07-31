# Structure Playground

This is a provisional tool for experimenting with the preliminary proposed structuring concept for mapping (verbal) discourse. It allows for visualising and editing these structures, and can use the Google Gemini AI to assist in generating or refining them.

Feel free to give feedback, note however: 
- The AI assistant often does not adhere correctly to the rules of the structuring concept, so the discussion points and connections generated are not necessarily exemplary for the concept.
- A detailed explanation of the concept and its purposes is not yet publicly available
- This tool is just for experimentation and does in no way resemble any planned product
- There is no intention for further development, the code is mostly AI-generated without any regard for maintainability

## Features (AI-generated)

*   **Dual Visualization:** Switch between a force-directed graph and an interactive sunburst chart.
*   **AI Assistance:** Generate or refine discourse structures from a topic using the AI Assistant.
*   **Manual Editing:** An edit mode allows for adding/deleting nodes and connections, with undo/redo.
*   **AI Suggestions:** Get AI-based suggestions for node text.
*   **Storage:** Save and load work to different "slots" using local storage and an optional cloud backend.
*   **Customizable Prompts:** Inspect and modify the AI system prompts in the AI Lab.
*   **Filtering & Layouts:** Customize the graph's appearance with different layouts and display modes.

---

## How to Use (AI-generated)

### Getting Started

**Q: The app is asking for an API key. What is this and how do I get one?**

**A:** The AI features of this application are powered by Google's Gemini models. To use them, you need a Google AI API key.

1.  Visit [Google AI Studio](https://aistudio.google.com/app/apikey).
2.  Sign in with your Google account.
3.  Click "Create API key" to generate a new key.
4.  Copy the key and paste it into the API key modal in the app.

If you prefer not to use the AI features, you can click "Use without AI features". The AI Assistant panel will then show a button allowing you to set a key later if you change your mind.

### Understanding the Interface

**Q: What are the main parts of the screen?**

**A:** The interface has three main parts:
1.  **Controls Panel (Left):** This is where you input data, interact with the AI, and change graph settings. It's divided into "Manual Input," "AI Assistant," and "AI Lab" tabs.
2.  **Visualization Area (Center):** This is where the graph or sunburst chart is displayed. You can pan, zoom, and select nodes here.
3.  **Utility & Edit Buttons (Corners):**
    *   **Bottom Right:** Buttons to toggle the Controls Panel, switch between Graph/Sunburst views, and toggle dark/light mode.
    *   **Bottom Left:** Edit Mode controls, which appear when you activate edit mode.

### Working with the Graph

**Q: How do I create a graph manually?**

**A:**
1.  Go to the **Manual Input** tab in the Controls Panel.
2.  Paste or type your data in the text area using the following format:
    *   **Nodes:** `DP1.statement: This is a statement.`
    *   **Connections:** `(DP1 specifies DP2)`
3.  Click the "Render Graph" button.

**Q: How do I use the AI Assistant?**

**A:**
1.  Make sure you have entered your API key.
2.  Go to the **AI Assistant** tab.
3.  Type a topic or a question into the prompt input box (e.g., "nuclear energy").
4.  Click "Send Prompt". The AI will generate a discourse structure in the format you specified, which will then be automatically rendered.
5.  You can continue the conversation by sending more prompts to refine or add to the structure.

**Q: What are the 'Search Grounding' and 'URL Context' toggles in the AI Assistant?**

**A:** These are advanced options to modify the AI's behavior:

*   **Search Grounding:** When enabled, this allows the AI to use Google Search to find up-to-date information for your prompt. This is useful for topics related to recent events or news. When the AI uses this feature, it will automatically create `reference` nodes for the web pages it used and cite them in the graph.
    *   **Please Note:** This is an experimental feature. The quality of the grounded results can vary, and it may not always produce the desired output.

*   **URL Context:** When enabled, this feature allows you to include the content of one or more web pages directly into your prompt. Simply paste the full URL(s) into the AI Assistant's prompt box. This is useful for tasks like:
    *   "Extract the key arguments from https://example.com/another-article"

**Q: How do I change how the graph looks?**

**A:** In the **Manual Input** tab, you'll find sections for:
*   **Node Display Mode:** Choose between `Circles` (no text), `Truncated` text, or `Full Text`.
*   **Layouts:** Apply different layout algorithms like `Compact`, `Spread`, `Grid`, etc.
*   **Save/Load Layout:** You can manually arrange nodes by dragging them and then click `Save Layout`. This saves their positions. `Load Saved Layout` will restore these positions, and `Clear Saved Layout` will remove them.

**Q: What is the Sunburst View and how do I use it?**

**A:** The Sunburst View provides an alternative, hierarchical way to explore the graph's connections, starting from a single "root" node.

*   **Switching Views:** Click the graph/sunburst icon in the bottom-right corner to toggle between the standard graph view and the sunburst view.
*   **Interaction:**
    *   **Hover** over a segment to see the node's details.
    *   **Single-click** a segment to select the corresponding node in the app. This will also update the Details Panel on the right.
    *   **Double-click** a segment to make that node the new center (root) of the sunburst chart, redrawing the visualization from its perspective.
*   **Controls:** When the Sunburst View is active, new controls will appear in the main Controls Panel on the left, allowing you to:
    *   Adjust the **Max Depth** of the hierarchy displayed.
    *   Change the **Connection Mode** (e.g., show only incoming connections, only outgoing, or a mix).
    *   Filter connections by their type using the **Filter Panel** that appears at the bottom of the screen (toggle its visibility with the filter icon in the bottom right).

### Editing the Graph

**Q: How do I edit the graph?**

**A:** Click the **pencil icon** in the bottom-left corner to enter Edit Mode. The controls panel on the left will be locked, and new action buttons will appear next to the pencil icon. Click the checkmark icon to exit edit mode.

**Q: How do I add or delete a node?**

**A:** In Edit Mode:
*   **Add Node:** Click the plus icon. A new node will be added to the center of your view. Select it to edit its text in the Details Panel on the right.
*   **Delete Node:** Select the node you want to delete. In the Details Panel on the right, click the trash icon.

**Q: How do I add or delete connections (edges)?**

**A:** In Edit Mode:
*   **Add Connection:**
    1.  Select the **source** node.
    2.  Click the link icon. It will turn into a target icon.
    3.  Click the desired **target** node in the graph.
    4.  A confirmation UI will appear in the Details Panel. Choose the predicate (the type of connection) and click the checkmark to confirm.
*   **Delete Connection:** Select a node. In the Details Panel on the right, find the connection you want to delete in the lists and click the small trash icon next to it.

**Q: Is there a faster way to add a new node that's already connected to an existing one?**

**A:** Yes. This is a very efficient workflow, especially when combined with the AI.

1.  Enter **Edit Mode**.
2.  Select the node you want to connect from (the source node).
3.  In the **Details Panel** on the right, you will see the node's connections grouped by type (e.g., "Outgoing Connections").
4.  Next to the header of each connection group, there is a **plus (+) icon**. Click this icon.
5.  A new UI will appear in the panel. Here you can define the new connection by selecting its type (predicate) and the type for the new node (e.g., 'statement', 'question').
6.  You can type the text for the new node in the text area.
7.  **AI Pro-Tip:** Click the **AI suggest icon** in this UI. The AI will propose text for your new node based on the source node's content and the connection type you selected.
8.  Click the checkmark to create both the new node and the connection in a single step.


### Saving & Loading

**Q: How do I save my work?**

**A:**
*   **Auto-Sync:** By default, "Auto-Sync" is enabled. Any changes you make (rendering a graph, adding a node, changing a setting) are automatically saved to the cloud and your browser's local cache for the current "Slot ID". This requires a one-time cloud setup.
*   **Manual Save:** You can click the "Save" button in the Cloud Storage section to force a save.

**Q: What are "Slot IDs"?**

**A:** Slots are like different save files. You can work on one graph in Slot `1`, then switch to Slot `2` to work on a completely different graph. Use the `Slot ID` input and the `Load` button to switch between them.

**Q: The app shows a "Setup Cloud" button. What is this for?**

**A:** This application supports saving your work to the cloud using [Supabase](https://supabase.com/), a free and open-source backend service. If you see the "Setup Cloud" button, it means the application hasn't been connected to a Supabase project yet. Setting it up enables the "Auto-Sync" feature and allows you to access your saved graphs from any browser.

To set it up:
1.  Click the "Setup Cloud" button. A modal will appear with instructions.
2.  Create a free account and a new project on Supabase.
3.  In your Supabase project's "SQL Editor", run the SQL command provided in the modal to create the necessary table for storage.
4.  Go to your Supabase project's "Settings" > "API" page.
5.  Copy the **Project URL** and the **public `anon` key**.
6.  Paste these two values into the modal in the app and click "Save & Enable".
7.  The application will test the connection live. If successful, the modal will close, and Auto-Sync will be enabled immediately—no page reload is required! If it fails, an error will be displayed in the modal so you can correct your details.

Your credentials are saved in your browser's `localStorage` so you don't have to re-enter them every time you visit.

### The AI Lab

**Q: What is the AI Lab for?**

**A:** The AI Lab gives you control over the AI's behavior by allowing you to view and edit the "System Prompts" that guide the AI. You can see how the AI is instructed to format its output, the rules it must follow, and create custom templates. This is an advanced feature for users who want to fine-tune the AI's performance.