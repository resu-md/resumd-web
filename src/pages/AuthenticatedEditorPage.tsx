import { Show, createEffect, createSignal, on } from "solid-js";
import { useParams } from "@solidjs/router";
import { exportAsPdf } from "@/lib/export-as-pdf";
// Contexts
import { useGithubAuth } from "@/contexts/github/GithubAuthContext";
import { AnonymousResumeProvider, useAnonymousResume } from "@/contexts/AnonymousResumeContext";
import { GithubRepositoryProvider } from "@/contexts/github/GithubRepositoryContext";
// Components
import MonacoEditor from "@/components/editor/monaco-editor/MonacoEditor";
import EditorShell from "@/components/editor/EditorShell";
import ToolbarShell from "@/components/preview/toolbar/ToolbarShell";
import ExportPdfButton from "@/components/preview/toolbar/ExportPdfButton";
import GithubDiff from "@/components/preview/toolbar/GithubDiff";
import GithubDropdown from "@/components/preview/toolbar/GithubDropdown";
import Preview from "@/components/preview/Preview";

export default function AuthenticatedEditorPage() {
    const params = useParams<{ owner: string; repo: string }>();
    const { user, authState, login } = useGithubAuth();

    createEffect(
        on(authState, (state, prev) => {
            // `prev !== "authenticated"` check used to prevent logout triggers login loop (since this component may take some time to unmount)
            if (state === "unauthenticated" && prev !== "authenticated") {
                login(params.owner, params.repo);
            }
        }),
    );

    return (
        <Show
            when={user()} // Loads page optimistically
            fallback={
                // TODO: Improve visually
                <main class="text-label-secondary flex h-dvh w-dvw items-center justify-center">
                    Logging in to GitHub...
                </main>
            }
        >
            <GithubRepositoryProvider>
                <AnonymousResumeProvider>
                    <AuthenticatedEditor />
                </AnonymousResumeProvider>
            </GithubRepositoryProvider>
        </Show>
    );
}

function AuthenticatedEditor() {
    const [diffMode, setDiffMode] = createSignal(false);
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
                            leading={
                                <>
                                    <GithubDropdown />
                                    <GithubDiff diffMode={diffMode()} onToggleDiffMode={setDiffMode} />
                                </>
                            }
                            trailing={
                                <>
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
