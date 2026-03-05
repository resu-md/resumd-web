import { createEffect, onCleanup, onMount } from "solid-js";
import { useTheme } from "@/contexts/ThemeContext";
import monaco from "./monaco-config";
import { ensureThemesRegistered, THEME_DARK_ID, THEME_LIGHT_ID } from "./theme";

type DiffTabConfig = {
    id: string;
    language: string;
    originalValue: string;
    modifiedValue: string;
};

type DiffTabModel = {
    originalModel: monaco.editor.ITextModel;
    modifiedModel: monaco.editor.ITextModel;
    viewState: monaco.editor.IDiffEditorViewState | null;
};

export default function DiffEditor(props: { class?: string; activeTabId: string; tabs: DiffTabConfig[] }) {
    const { theme } = useTheme();

    let editorContainer: HTMLDivElement | undefined;
    let editor: monaco.editor.IStandaloneDiffEditor | undefined;
    let models: Map<string, DiffTabModel> | undefined;

    onMount(() => {
        if (!editorContainer) return;

        ensureThemesRegistered();

        models = new Map();
        props.tabs.forEach((tab) => {
            const originalModel = monaco.editor.createModel(tab.originalValue, tab.language);
            const modifiedModel = monaco.editor.createModel(tab.modifiedValue, tab.language);
            models!.set(tab.id, { originalModel, modifiedModel, viewState: null });
        });

        const activeModel = models.get(props.activeTabId);
        if (!activeModel) return;

        editor = monaco.editor.createDiffEditor(editorContainer, {
            automaticLayout: true,
            padding: { top: 30, bottom: 10 },
            minimap: { enabled: false },
            scrollbar: { useShadows: false },
            renderSideBySide: true,
            originalEditable: false,
            readOnly: true,
            theme: theme() === "dark" ? THEME_DARK_ID : THEME_LIGHT_ID,
            lineNumbersMinChars: 4,
        });

        editor.setModel({
            original: activeModel.originalModel,
            modified: activeModel.modifiedModel,
        });
    });

    createEffect(() => {
        if (!editor || !models) return;

        const activeTabId = props.activeTabId;
        const currentModel = editor.getModel();
        const targetModel = models.get(activeTabId);

        if (!currentModel || !targetModel) return;
        if (currentModel.original === targetModel.originalModel && currentModel.modified === targetModel.modifiedModel) return;

        models.forEach((tabModel) => {
            if (currentModel.original === tabModel.originalModel && currentModel.modified === tabModel.modifiedModel) {
                tabModel.viewState = editor!.saveViewState();
            }
        });

        editor.setModel({
            original: targetModel.originalModel,
            modified: targetModel.modifiedModel,
        });
        if (targetModel.viewState) editor.restoreViewState(targetModel.viewState);
        editor.focus();
    });

    createEffect(() => {
        if (!models) return;

        props.tabs.forEach((tab) => {
            const tabModels = models!.get(tab.id);
            if (!tabModels) return;

            if (tabModels.originalModel.getValue() !== tab.originalValue) {
                tabModels.originalModel.setValue(tab.originalValue);
            }
            if (tabModels.modifiedModel.getValue() !== tab.modifiedValue) {
                tabModels.modifiedModel.setValue(tab.modifiedValue);
            }
        });
    });

    createEffect(() => {
        if (!editor) return;

        ensureThemesRegistered();
        monaco.editor.setTheme(theme() === "dark" ? THEME_DARK_ID : THEME_LIGHT_ID);
    });

    onCleanup(() => {
        models?.forEach((tabModel) => {
            tabModel.originalModel.dispose();
            tabModel.modifiedModel.dispose();
        });
        editor?.dispose();
    });

    return (
        <div class={props.class}>
            <div ref={editorContainer} style={{ width: "100%", height: "100%" }} />
        </div>
    );
}
