import { createSignal } from "solid-js";
import Editor from "@/components/editor/Editor";
import Tabs from "@/components/editor/Tabs";
import Previewer from "@/components/preview/Previewer";
import { ZoomProvider } from "@/components/preview/ZoomContext";
import ResizablePane from "@/components/ResizablePane";
import { useResume } from "@/contexts/ResumeContext";

export default function EditorPage() {
    const { css, setCss, markdown, setMarkdown } = useResume();
    const [activeTab, setActiveTab] = createSignal<"resume.md" | "theme.css">("resume.md");

    return (
        <main class="bg-system-secondary padding-r flex h-dvh w-dvw">
            <ResizablePane
                class="relative z-10 p-3 pr-0"
                storageKey="resumd.editorWidth"
                defaultWidth={47}
                minWidth={25}
                maxWidth={65}
            >
                <div class="border-gray-5 dark:border-gray-4 bg-system-primary mt-4.5 flex h-[calc(100%-1.125rem)] flex-col overflow-hidden rounded-2xl border">
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
                    {/* <div class="flex flex-1 items-center justify-center text-sm text-gray-500">Editor coming soon!</div> */}
                </div>
            </ResizablePane>
            <ZoomProvider>
                <Previewer class="flex-1" markdown={markdown} css={css} />
            </ZoomProvider>
        </main>
    );
}
