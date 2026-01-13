import { createSignal } from "solid-js";
import { makePersisted } from "@solid-primitives/storage";
// Constants
import markdownTemplate from "@/templates/refer.me/resume.md?raw";
import cssTemplate from "@/templates/refer.me/theme.css?raw";
// Components
import Previewer from "@/components/preview/Previewer";
import Editor from "@/components/editor/Editor";
import Tabs from "@/components/editor/Tabs";
import { ZoomProvider } from "@/components/preview/ZoomContext";

export default function EditorPage() {
    const [activeTab, setActiveTab] = createSignal<"resume.md" | "theme.css">("resume.md");
    const [markdown, setMarkdown] = makePersisted(createSignal(markdownTemplate), { name: "resumd.markdown" });
    const [css, setCss] = makePersisted(createSignal(cssTemplate), { name: "resumd.css" });

    return (
        <main class="bg-system-secondary/60 padding-r flex h-dvh w-dvw">
            <div class="w-[47%] max-w-[1100px] p-3">
                <div class="shadow-primary bg-system-primary flex h-full flex-col overflow-hidden rounded-xl">
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
            <ZoomProvider>
                <Previewer class="flex-1" markdown={markdown} css={css} />
            </ZoomProvider>
        </main>
    );
}
