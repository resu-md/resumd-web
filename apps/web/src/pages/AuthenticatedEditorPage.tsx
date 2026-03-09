import { Show, createEffect, createSignal } from "solid-js";
import { useParams } from "@solidjs/router";
import { exportAsPdf } from "@/lib/export-as-pdf";
// Contexts
import { login, useGithub } from "@/contexts/github/GithubContext";
import { GithubResumeProvider, useGithubResume } from "@/contexts/github/GithubResumeContext";
// Components
import MonacoEditor from "@/components/editor/monaco-editor/MonacoEditor";
import EditorShell from "@/components/editor/EditorShell";
import ToolbarShell from "@/components/preview/toolbar/ToolbarShell";
import ExportPdfButton from "@/components/preview/toolbar/ExportPdfButton";
import GithubBranchDropdown from "@/components/preview/toolbar/GithubBranchDropdown";
import Preview from "@/components/preview/Preview";
import MonacoDiffEditor from "@/components/editor/monaco-editor/MonacoDiffEditor";

export default function AuthenticatedEditorPage() {
    const params = useParams<{ owner: string; repo: string }>();
    // const { user, authState, login } = useGithubAuth();
    const { user } = useGithub();

    createEffect(() => {
        if (user() === null) {
            login(params.owner, params.repo, `${window.location.pathname}${window.location.search}`);
        }
    });

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
            <GithubResumeProvider>
                <AuthenticatedEditor />
            </GithubResumeProvider>
        </Show>
    );
}

function AuthenticatedEditor() {
    const [diffMode, setDiffMode] = createSignal(false);
    const { remoteMarkdown, remoteCss } = useGithub();
    const {
        markdown: draftMarkdown,
        css: draftCss,
        setMarkdown: setDraftMarkdown,
        setCss: setDraftCss,
    } = useGithubResume();

    return (
        <main class="bg-system-secondary flex h-dvh w-dvw">
            <EditorShell tabs={["resume.md", "theme.css"]}>
                {(activeTab) =>
                    !diffMode() ? (
                        <MonacoEditor
                            class="size-full"
                            activeTabId={activeTab()}
                            tabs={[
                                {
                                    id: "resume.md",
                                    language: "markdown",
                                    value: draftMarkdown(),
                                    onChange: setDraftMarkdown,
                                },
                                {
                                    id: "theme.css",
                                    language: "css",
                                    value: draftCss(),
                                    onChange: setDraftCss,
                                },
                            ]}
                        />
                    ) : (
                        <MonacoDiffEditor
                            class="size-full"
                            activeTabId={activeTab()}
                            tabs={[
                                {
                                    id: "resume.md",
                                    language: "markdown",
                                    originalValue: remoteMarkdown() ?? "",
                                    modifiedValue: draftMarkdown(),
                                },
                                {
                                    id: "theme.css",
                                    language: "css",
                                    originalValue: remoteCss() ?? "",
                                    modifiedValue: draftCss(),
                                },
                            ]}
                        />
                    )
                }
            </EditorShell>
            <div class="relative flex-1">
                <Preview markdown={draftMarkdown} css={draftCss}>
                    {(parsedMarkdown, html) => (
                        <ToolbarShell
                            leading={
                                <>
                                    {/* <GithubRepositoryBadge /> */}
                                    <GithubBranchDropdown />
                                </>
                            }
                            trailing={
                                <>
                                    <ExportPdfButton
                                        label="Export as PDF"
                                        alt="Export resume as PDF"
                                        onClick={() => exportAsPdf(html(), draftCss(), parsedMarkdown().metadata)}
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
