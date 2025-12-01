import { createSignal, createMemo } from "solid-js";
import { makePersisted } from "@solid-primitives/storage";
import { marked } from "marked";
// Constants
import markdownTemplate from "@/templates/refer.me/resume.md?raw";
import cssTemplate from "@/templates/refer.me/theme.css?raw";
// Components
import Preview from "@/components/preview/Preview";
import Editor from "@/components/editor/Editor";
import Tabs from "@/components/editor/Tabs";

export default function EditorPage() {
    const [activeTab, setActiveTab] = createSignal<"resume.md" | "theme.css">("resume.md");

    const [markdown, setMarkdown] = makePersisted(createSignal(markdownTemplate), { name: "resumd.markdown" });
    const [css, setCss] = makePersisted(createSignal(cssTemplate), { name: "resumd.css" });

    const html = createMemo(() => marked.parse(markdown(), { async: false, breaks: true }) as string);

    return (
        <main class="bg-system-grouped-secondary padding-r flex h-dvh w-dvw">
            <div class="w-[47%] max-w-[1100px] p-3">
                <div class="shadow-primary bg-system-secondary flex h-full flex-col overflow-hidden rounded-xl">
                    <Tabs values={["resume.md", "theme.css"]} active={activeTab()} onChange={setActiveTab} />
                    <Editor
                        class="flex-1"
                        activeTabId={activeTab()}
                        tabs={[
                            {
                                id: "resume.md",
                                language: "markdown",
                                value: markdown(),
                                onChange: setMarkdown,
                            },
                            {
                                id: "theme.css",
                                language: "css",
                                value: css(),
                                onChange: setCss,
                            },
                        ]}
                    />
                </div>
            </div>
            <Preview class="flex-1" html={html} css={css} />
        </main>
    );
}
