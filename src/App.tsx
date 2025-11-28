import { createSignal, createMemo } from "solid-js";
import { marked } from "marked";
// Constants
import { TEMPLATE_1 } from "./components/editor/default";
// Components
import Preview from "./components/preview/Preview";
import Editor from "./components/editor/Editor";
import Tabs from "./components/editor/Tabs";
// Contexts
import { ThemeProvider } from "./contexts/ThemeContext";

export default function App() {
    const [markdown, setMarkdown] = createSignal(TEMPLATE_1.markdown);
    const [css, _] = createSignal(TEMPLATE_1.css);

    const html = createMemo(() => marked.parse(markdown(), { async: false, breaks: true }) as string);

    return (
        <ThemeProvider>
            <main class="bg-system-secondary flex h-dvh w-dvw">
                <div class="w-1/2 p-3 2xl:w-2/5">
                    <div class="shadow-primary bg-system-tertiary flex h-full flex-col overflow-hidden rounded-xl">
                        <Tabs />
                        <Editor class="flex-1" initialValue={markdown()} onValueChange={setMarkdown} />
                    </div>
                </div>
                <Preview class="flex-1" html={html} css={css} />
            </main>
        </ThemeProvider>
    );
}
