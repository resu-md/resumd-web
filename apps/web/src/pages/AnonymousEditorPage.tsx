import { Show, createEffect } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { exportAsPdf } from "@/lib/export-as-pdf";
import { exportAsZip } from "@/lib/export-as-zip";
// Contexts
import { useGithub } from "@/contexts/github/GithubContext";
import { AnonymousResumeProvider, useAnonymousResume } from "@/contexts/AnonymousResumeContext";
// Components
import MonacoEditor from "@/components/editor/monaco-editor/MonacoEditor";
import EditorShell from "@/components/editor/EditorShell";
import Preview from "@/components/preview/Preview";
import ToolbarShell from "@/components/preview/toolbar/ToolbarShell";
import SaveOptionsButton from "@/components/preview/toolbar/SaveOptionsButton";

export default function AnonymousEditorPage() {
    const { user } = useGithub();
    const navigate = useNavigate();

    createEffect(() => {
        if (user()) {
            navigate("/manage", { replace: true });
        }
    });

    return (
        <Show
            when={user() === undefined || user() === null}
            fallback={
                <div class="text-label-secondary flex h-dvh w-dvw items-center justify-center gap-2">
                    Redirecting...
                </div>
            }
        >
            {/* User is loading (undefined) or is logged out (null) */}
            <AnonymousResumeProvider>
                <AnonymousEditor />
            </AnonymousResumeProvider>
        </Show>
    );
}

function AnonymousEditor() {
    const { markdown, css, setMarkdown, setCss } = useAnonymousResume();

    return (
        <main class="bg-system-secondary flex h-dvh w-dvw">
            <EditorShell tabs={["resume.md", "theme.css"]}>
                {(activeTab) => (
                    <MonacoEditor
                        class="size-full"
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
                )}
            </EditorShell>
            <div class="relative flex-1">
                <Preview markdown={markdown} css={css}>
                    {(parsedMarkdown, html) => (
                        <ToolbarShell
                            trailing={
                                <SaveOptionsButton
                                    onDownloadZip={() => exportAsZip(html(), css(), parsedMarkdown().metadata)}
                                    onExportPdf={() => exportAsPdf(html(), css(), parsedMarkdown().metadata)}
                                    onPushToGithub={() => {
                                        alert("You must be logged in to use this feature.");
                                    }}
                                />
                            }
                        />
                    )}
                </Preview>
            </div>
        </main>
    );
}
