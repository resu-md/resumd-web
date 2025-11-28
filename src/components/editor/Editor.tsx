import { onMount, onCleanup, createEffect } from "solid-js";
import monaco from "./monaco-config";
import { useTheme } from "../../contexts/ThemeContext";

export default function Editor(props: {
    class: string;
    initialValue?: string;
    onValueChange?: (value: string) => void;
}) {
    let editorContainer: HTMLDivElement | undefined;
    let editor: monaco.editor.IStandaloneCodeEditor | undefined;
    const { theme } = useTheme();

    onMount(() => {
        if (editorContainer) {
            editor = monaco.editor.create(editorContainer, {
                value: props.initialValue || "",
                language: "markdown",
                automaticLayout: true,
                folding: false,
                minimap: { enabled: false },
                scrollbar: { useShadows: false },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                theme: theme() === "dark" ? "vs-dark" : "vs-light",
            });

            editor.onDidChangeModelContent(() => {
                if (props.onValueChange && editor) {
                    props.onValueChange(editor.getValue());
                }
            });
        }
    });

    createEffect(() => {
        if (editor) {
            editor.updateOptions({
                theme: theme() === "dark" ? "vs-dark" : "vs-light",
            });
        }
    });

    onCleanup(() => {
        editor?.dispose();
    });

    return (
        <div class={props.class}>
            <div ref={editorContainer} style={{ width: "100%", height: "100%" }} />
        </div>
    );
}
