import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";

self.MonacoEnvironment = {
    getWorker(_: any, label: string) {
        if (label === "css" || label === "scss" || label === "less") {
            return new cssWorker();
        }
        return new editorWorker();
    },
};

export default monaco;

// TODO: Consider https://github.com/alxnddr/solid-monaco
