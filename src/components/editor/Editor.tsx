import { onMount, onCleanup } from "solid-js";
import monaco from "./monaco-config";

export default function Editor(props: {
    class: string;
    initialValue?: string;
    onValueChange?: (value: string) => void;
}) {
    let editorContainer: HTMLDivElement | undefined;
    let editor: monaco.editor.IStandaloneCodeEditor | undefined;

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
                theme: "vs-light",
            });

            editor.onDidChangeModelContent(() => {
                if (props.onValueChange && editor) {
                    props.onValueChange(editor.getValue());
                }
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
