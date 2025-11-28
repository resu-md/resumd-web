import { createSignal, createMemo } from "solid-js";
import { marked } from "marked";
// Constants
import { TEMPLATE_1 } from "./components/editor/default";
// Components
import Preview from "./components/preview/Preview";
import Editor from "./components/editor/Editor";

export default function App() {
    const [markdown, setMarkdown] = createSignal(TEMPLATE_1.markdown);
    const [css, setCss] = createSignal(TEMPLATE_1.css);

    const html = createMemo(() => marked.parse(markdown(), { async: false, breaks: true }) as string);

    return (
        <main class="flex h-dvh w-dvw">
            <Editor class="w-1/2" initialValue={markdown()} onValueChange={setMarkdown} />
            <div class="bg-separator h-dvh w-px" />
            <Preview class="w-1/2" html={html} css={css} />
        </main>
    );
}
