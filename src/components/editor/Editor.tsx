import { onMount, onCleanup, createEffect } from "solid-js";
import monaco from "./monaco-config";
import { useTheme } from "@/contexts/ThemeContext";
import xcodeDarkTheme from "./themes/Xcode Default Dark.json";
import xcodeLightTheme from "./themes/Xcode Classic Light.json";

type VsCodeTheme = {
    colors?: Record<string, string>;
    tokenColors?: Array<{
        scope?: string | string[];
        settings?: {
            foreground?: string;
            fontStyle?: string;
        };
    }>;
};

const THEME_DARK_ID = "xcode-dark";
const THEME_LIGHT_ID = "xcode-light";

const TOKEN_SCOPE_RULES: Array<{ pattern: RegExp; token: string }> = [
    { pattern: /comment/i, token: "comment" },
    { pattern: /string/i, token: "string" },
    { pattern: /keyword|storage/i, token: "keyword" },
    { pattern: /constant\.numeric|number/i, token: "number" },
    { pattern: /constant\.language|constant/i, token: "constant" },
    { pattern: /entity\.name\.function|meta\.function|support\.function/i, token: "function" },
    { pattern: /entity\.name\.type|support\.type|meta\.class|entity\.name\.class/i, token: "type" },
    { pattern: /variable\.parameter|parameter/i, token: "parameter" },
    { pattern: /variable/i, token: "variable" },
    { pattern: /entity\.name\.tag|tag/i, token: "tag" },
    { pattern: /attribute-name|attribute/i, token: "attribute" },
    { pattern: /operator|punctuation/i, token: "operator" },
];

let themesRegistered = false;

function normalizeColor(color?: string) {
    if (!color) return undefined;
    return color.startsWith("#") ? color.slice(1) : color;
}

function toMonacoTheme(vsCodeTheme: VsCodeTheme, base: monaco.editor.BuiltinTheme): monaco.editor.IStandaloneThemeData {
    const rules: monaco.editor.ITokenThemeRule[] = [];

    vsCodeTheme.tokenColors?.forEach((tokenColor) => {
        const scopes = tokenColor.scope
            ? Array.isArray(tokenColor.scope)
                ? tokenColor.scope
                : [tokenColor.scope]
            : [];
        const settings = tokenColor.settings ?? {};
        const foreground = normalizeColor(settings.foreground);
        const fontStyle = settings.fontStyle?.trim();

        scopes.forEach((scope) => {
            const match = TOKEN_SCOPE_RULES.find((rule) => rule.pattern.test(scope));
            if (!match || (!foreground && !fontStyle)) return;

            rules.push({
                token: match.token,
                foreground,
                fontStyle: fontStyle || undefined,
            });
        });
    });

    return {
        base,
        inherit: true,
        rules,
        colors: vsCodeTheme.colors ?? {},
    };
}

function ensureThemesRegistered() {
    if (themesRegistered) return;

    monaco.editor.defineTheme(THEME_DARK_ID, toMonacoTheme(xcodeDarkTheme as VsCodeTheme, "vs-dark"));
    monaco.editor.defineTheme(THEME_LIGHT_ID, toMonacoTheme(xcodeLightTheme as VsCodeTheme, "vs"));
    themesRegistered = true;
}

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

        ensureThemesRegistered();

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
            padding: { top: 30, bottom: 10 },
            folding: false,
            minimap: { enabled: false },
            scrollbar: { useShadows: false },
            scrollBeyondLastLine: false,
            stickyScroll: { enabled: false },
            wordWrap: "on",
            theme: theme() === "dark" ? THEME_DARK_ID : THEME_LIGHT_ID,
            lineNumbersMinChars: 4,
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
        if (!editor) return;

        ensureThemesRegistered();
        monaco.editor.setTheme(theme() === "dark" ? THEME_DARK_ID : THEME_LIGHT_ID);
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
