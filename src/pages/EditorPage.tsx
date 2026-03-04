import { createMemo, createSignal, onCleanup } from "solid-js";
// Constants
import markdownTemplate from "@/templates/refer.me/resume.md?raw";
import cssTemplate from "@/templates/refer.me/theme.css?raw";
import { createTabDocumentSession } from "@/lib/workspace";
// Components
import { ZoomProvider } from "@/components/preview/ZoomContext";
import Previewer from "@/components/preview/Previewer";
import Editor from "@/components/editor/Editor";
import ResizablePane from "@/components/ResizablePane";
import Tabs from "@/components/editor/Tabs";

export default function EditorPage() {
    const [activeTab, setActiveTab] = createSignal<"resume.md" | "theme.css">("resume.md");
    const tabSession = createTabDocumentSession({
        defaultMarkdown: markdownTemplate,
        defaultCss: cssTemplate,
    });

    const [markdown, setMarkdown] = createSignal(tabSession.markdown);
    const [css, setCss] = createSignal(tabSession.css);
    const [activeDocumentId, setActiveDocumentId] = createSignal(tabSession.getActiveDocumentId());
    const [documents, setDocuments] = createSignal(tabSession.getDocuments());

    const currentDocument = createMemo(() => documents().find((document) => document.id === activeDocumentId()));

    const setAndPersistMarkdown = (value: string) => {
        setMarkdown(value);
        tabSession.persistMarkdown(value);
    };

    const setAndPersistCss = (value: string) => {
        setCss(value);
        tabSession.persistCss(value);
    };

    const handleSelectDocument = (documentId: string) => {
        const content = tabSession.switchDocument(documentId);
        if (!content) return;

        setActiveDocumentId(documentId);
        setDocuments(tabSession.getDocuments());
        setMarkdown(content.markdown);
        setCss(content.css);
    };

    onCleanup(() => {
        tabSession.dispose();
    });

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
                                onChange: setAndPersistMarkdown,
                            },
                            {
                                id: "theme.css",
                                language: "css",
                                value: css(),
                                onChange: setAndPersistCss,
                            },
                        ]}
                    />
                    {/* <div class="flex flex-1 items-center justify-center text-sm text-gray-500">Editor coming soon!</div> */}
                </div>
            </ResizablePane>
            <ZoomProvider>
                <Previewer
                    class="flex-1"
                    markdown={markdown}
                    css={css}
                    activeDocumentId={activeDocumentId()}
                    documents={documents()}
                    currentDocumentName={currentDocument()?.name ?? "Resume"}
                    onSelectDocument={handleSelectDocument}
                />
            </ZoomProvider>
        </main>
    );
}
