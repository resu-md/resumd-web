import { Match, Switch, createSignal } from "solid-js";
import { exportAsPdf } from "@/lib/export-as-pdf";
import { exportAsZip } from "@/lib/export-as-zip";
// Contexts
import { useGithubAuth } from "@/contexts/github/GithubAuthContext";
import { AnonymousResumeProvider, useAnonymousResume } from "@/contexts/AnonymousResumeContext";
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
        <Switch fallback={<div class="bg-red h-screen w-screen">none</div>}>
            <Match when={user() === null}>
                {/* No user (may be momentary) */}
                <AnonymousResumeProvider>
                    <AnonymousEditor />
                </AnonymousResumeProvider>
            </Match>
            <Match when={user() !== null}>
                {/* Has user (may be optimistic) */}
                {/* TODO: Redirect to a valid route /:owner/:repo */}
                <div>logged in, waiting for redirect</div>
            </Match>
        </Switch>
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
