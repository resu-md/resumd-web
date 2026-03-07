import { Match, Show, Switch, createSignal } from "solid-js";
import { exportAsPdf } from "@/lib/export-as-pdf";
import { exportAsZip } from "@/lib/export-as-zip";
// Contexts
import { useGithubAuth } from "@/contexts/github/GithubAuthContext";
import { AnonymousResumeProvider, useAnonymousResume } from "@/contexts/AnonymousResumeContext";
import { GithubRepositoryProvider } from "@/contexts/github/GithubRepositoryContext";
// Components
import MonacoEditor from "@/components/editor/monaco-editor/MonacoEditor";
import EditorShell from "@/components/editor/EditorShell";
import Preview from "@/components/preview/Preview";
import ToolbarShell from "@/components/preview/toolbar/ToolbarShell";
import ExportPdfButton from "@/components/preview/toolbar/ExportPdfButton";
import SaveDropdown from "@/components/preview/toolbar/SaveDropdown";

// TODO: Maybe rename? (AnonymousEditorPage?)
export default function RootPage() {
    const { user } = useGithubAuth();

    return (
        <Show
            when={user() === undefined || user() === null}
            fallback={
                // GithubRepositoryProvider handles correcting the URL to a /:owner/:repo URL, them redirecting to AuthenticatedEditorPage
                <GithubRepositoryProvider>
                    <div class="text-label-secondary flex h-dvh w-dvw items-center justify-center gap-2">
                        Logged in successfully.
                    </div>
                </GithubRepositoryProvider>
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
                                <>
                                    <SaveDropdown
                                        onDownloadZip={() => exportAsZip(html(), css(), parsedMarkdown().metadata)}
                                    />
                                    <ExportPdfButton
                                        onClick={() => exportAsPdf(html(), css(), parsedMarkdown().metadata)}
                                    />
                                </>
                            }
                        />
                    )}
                </Preview>
            </div>
        </main>
    );
}
