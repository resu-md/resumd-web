import { onMount, onCleanup, createEffect } from "solid-js";
import monaco from "./monaco-config";
import { useTheme } from "../../contexts/ThemeContext";

type EditorModel = {
    model: monaco.editor.ITextModel;
    viewState: monaco.editor.ICodeEditorViewState | null;
};

type TabConfig = {
    id: string;
    language: string;
    value: string;
    onChange: (value: string) => void;
};

export default function Editor(props: { class?: string; activeTabId: string; tabs: TabConfig[] }) {
    const { theme } = useTheme();

    let editorContainer: HTMLDivElement | undefined;
    let editor: monaco.editor.IStandaloneCodeEditor | undefined;
    let models: Map<string, EditorModel> | undefined;
    let isUpdatingFromProps = false;

    onMount(() => {
        if (!editorContainer) return;

        // Create models for all tabs
        models = new Map();
        props.tabs.forEach((tab) => {
            const model = monaco.editor.createModel(tab.value, tab.language);
            models!.set(tab.id, { model, viewState: null });
        });

        // Get the active model
        const activeModel = models.get(props.activeTabId);
        if (!activeModel) return;

        // Create editor with the active model
        editor = monaco.editor.create(editorContainer, {
            model: activeModel.model,
            automaticLayout: true,
            folding: false,
            minimap: { enabled: false },
            scrollbar: { useShadows: false },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            theme: theme() === "dark" ? "vs-dark" : "vs-light",
        });

        // Listen to content changes
        editor.onDidChangeModelContent(() => {
            if (isUpdatingFromProps || !editor || !models) return;

            const currentModel = editor.getModel();
            if (!currentModel) return;

            // Find which tab's model this is and call its onChange
            props.tabs.forEach((tab) => {
                const tabModel = models!.get(tab.id);
                if (tabModel && currentModel === tabModel.model) {
                    tab.onChange(currentModel.getValue());
                }
            });
        });
    });

    // Handle tab switching
    createEffect(() => {
        if (!editor || !models) return;

        const activeTabId = props.activeTabId;
        const currentModel = editor.getModel();
        const targetEditorModel = models.get(activeTabId);

        if (!targetEditorModel) return;

        // Only switch if we're not already on the target model
        if (currentModel !== targetEditorModel.model) {
            // Save current view state
            if (currentModel) {
                models.forEach((editorModel) => {
                    if (editorModel.model === currentModel) {
                        editorModel.viewState = editor!.saveViewState();
                    }
                });
            }

            // Switch to new model
            editor.setModel(targetEditorModel.model);

            // Restore view state
            if (targetEditorModel.viewState) {
                editor.restoreViewState(targetEditorModel.viewState);
            }
            editor.focus();
        }
    });

    // Sync value changes from props for all tabs
    createEffect(() => {
        if (!models) return;

        props.tabs.forEach((tab) => {
            const editorModel = models!.get(tab.id);
            if (!editorModel) return;

            const nextValue = tab.value;
            if (editorModel.model.getValue() === nextValue) return;

            isUpdatingFromProps = true;
            editorModel.model.setValue(nextValue);
            isUpdatingFromProps = false;
        });
    });

    // Handle theme changes
    createEffect(() => {
        if (editor) {
            editor.updateOptions({
                theme: theme() === "dark" ? "vs-dark" : "vs-light",
            });
        }
    });

    onCleanup(() => {
        models?.forEach((editorModel) => editorModel.model.dispose());
        editor?.dispose();
    });

    return (
        <div class={props.class}>
            <div ref={editorContainer} style={{ width: "100%", height: "100%" }} />
        </div>
    );
}
