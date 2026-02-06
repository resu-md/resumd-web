import { createSignal, createEffect } from "solid-js";
import { useParams } from "@solidjs/router";
import { makePersisted } from "@solid-primitives/storage";
// Constants
import markdownTemplate from "@/templates/refer.me/resume.md?raw";
import cssTemplate from "@/templates/refer.me/theme.css?raw";
// Components
import { ZoomProvider } from "@/components/preview/ZoomContext";
import Previewer from "@/components/preview/Previewer";
import Editor from "@/components/editor/Editor";
import Tabs from "@/components/editor/Tabs";
import ResizablePane from "@/components/ResizablePane";

export default function EditorPage() {
    const params = useParams();

    // Editor State
    const [activeTab, setActiveTab] = createSignal<"resume.md" | "theme.css">("resume.md");
    const [markdown, setMarkdown] = makePersisted(createSignal(markdownTemplate), { name: "resumd.markdown" });
    const [css, setCss] = makePersisted(createSignal(cssTemplate), { name: "resumd.css" });

    // Fetch from GitHub if params are present
    createEffect(async () => {
        if (!params.owner || !params.repo) return;

        try {
            const res = await fetch(`/api/github/repo/${params.owner}/${params.repo}/resume`);

            if (res.status === 401) {
                const returnTo = `/${params.owner}/${params.repo}`;
                window.location.href = `/api/github/authorize?owner=${params.owner}&repo=${params.repo}&returnTo=${returnTo}`;
                return;
            }

            if (!res.ok) {
                const err = await res.json();
                console.error("Failed to fetch repo:", err);
                alert(`Error fetching repo: ${err.error || res.statusText}`); // Simple error handling for now
                return;
            }

            const data = await res.json();

            // Only update if we have content
            if (data.markdown?.content) setMarkdown(data.markdown.content);
            if (data.stylesheet?.content) setCss(data.stylesheet.content);

        } catch (error) {
            console.error("Network error:", error);
        }
    });

    const [isPushing, setIsPushing] = createSignal(false);

    const handlePush = async () => {
        if (!params.owner || !params.repo) return;

        const message = prompt("Enter commit message (optional):");
        if (message === null) return; // User cancelled

        setIsPushing(true);
        try {
            const res = await fetch(`/api/github/repo/${params.owner}/${params.repo}/push`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    markdown: markdown(),
                    css: css(),
                    message: message || undefined // Let backend handle default if empty
                })
            });

            if (!res.ok) {
                const err = await res.json();
                alert(`Failed to push: ${err.error || res.statusText}`);
                return;
            }

            alert("Successfully pushed to GitHub!");
        } catch (e) {
            console.error(e);
            alert("Error pushing to GitHub");
        } finally {
            setIsPushing(false);
        }
    };

    return (
        <main class="bg-system-secondary/60 dark:bg-system-secondary padding-r flex h-dvh w-dvw">
            <ResizablePane
                class="relative z-10 p-3 pr-0"
                storageKey="resumd.editorWidth"
                defaultWidth={47}
                minWidth={25}
                maxWidth={65}
            >
                <div class="shadow-primary bg-system-primary flex h-full flex-col overflow-hidden rounded-xl dark:shadow-none">
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
            </ResizablePane>
            <ZoomProvider>
                <Previewer
                    class="flex-1"
                    markdown={markdown}
                    css={css}
                    owner={params.owner}
                    repo={params.repo}
                    onPush={handlePush}
                    isPushing={isPushing()}
                />
            </ZoomProvider>
        </main>
    );
}
