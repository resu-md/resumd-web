import { Show, createEffect, createMemo, createSignal } from "solid-js";
import { useParams } from "@solidjs/router";
import { Title } from "@solidjs/meta";
import { formatDocumentTitle } from "@/lib/document-title";
import { getLineDiffStats, type DiffStats } from "@/lib/line-diff";
import { exportAsPdf } from "@/lib/export-as-pdf";
import { exportAsZip } from "@/lib/export-as-zip";
// Contexts
import { login, useGithub } from "@/contexts/github/GithubContext";
import { GithubResumeProvider, useGithubResume } from "@/contexts/github/GithubResumeContext";
// Components
import MonacoEditor from "@/components/editor/monaco-editor/MonacoEditor";
import EditorShell from "@/components/editor/EditorShell";
import ToolbarShell from "@/components/preview/toolbar/ToolbarShell";
import GithubBranchDropdown from "@/components/preview/toolbar/GithubBranchDropdown";
import Preview from "@/components/preview/Preview";
import MonacoDiffEditor from "@/components/editor/monaco-editor/MonacoDiffEditor";
import SaveOptionsButton from "@/components/preview/toolbar/SaveOptionsButton";
import CommitButton from "@/components/preview/toolbar/CommitButton";

import type { SaveRepoResponse } from "@resumd/api/types";
import { ApiError, apiFetch, withSearch } from "@/lib/fetch";

export default function AuthenticatedEditorPage() {
    const params = useParams<{ owner: string; repo: string }>();
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
    const [isCommitting, setIsCommitting] = createSignal(false);
    const [baselineMarkdown, setBaselineMarkdown] = createSignal("");
    const [baselineCss, setBaselineCss] = createSignal("");
    const [baselineHeadSha, setBaselineHeadSha] = createSignal<string | undefined>(undefined);
    const params = useParams<{ owner: string; repo: string }>();
    const {
        remoteMarkdown,
        remoteMarkdownPath,
        remoteCss,
        remoteCssPath,
        remoteHeadSha,
        selectedRepository,
        selectedBranch,
    } = useGithub();
    const {
        markdown: draftMarkdown,
        css: draftCss,
        setMarkdown: setDraftMarkdown,
        setCss: setDraftCss,
    } = useGithubResume();

    const title = createMemo(() => {
        const repository = selectedRepository();
        const branch = selectedBranch();
        const routeRepository = [params.owner, params.repo].filter(Boolean).join("/");
        const repositoryLabel = repository?.fullName ?? (routeRepository || "Repository");
        const workspaceLabel = branch ? `${branch.name} · ${repositoryLabel}` : repositoryLabel;
        return formatDocumentTitle(workspaceLabel);
    });

    const branchWorkspaceKey = createMemo(() => {
        const repository = selectedRepository();
        const branch = selectedBranch();
        if (!repository || !branch) return null;

        return `${repository.fullName}:${branch.name}`;
    });

    createEffect(() => {
        const workspaceKey = branchWorkspaceKey();
        if (!workspaceKey) return;

        setBaselineMarkdown(remoteMarkdown() ?? "");
        setBaselineCss(remoteCss() ?? "");
        setBaselineHeadSha(remoteHeadSha() ?? selectedBranch()?.commitSha);
        setDiffMode(false);
    });

    const hasChanges = createMemo(() => draftMarkdown() !== baselineMarkdown() || draftCss() !== baselineCss());

    createEffect(() => {
        if (!hasChanges() && diffMode()) {
            setDiffMode(false);
        }
    });

    const diffStats = createMemo<DiffStats>(() => {
        if (!hasChanges()) return { added: 0, removed: 0 };

        const markdownDiff = getLineDiffStats(baselineMarkdown(), draftMarkdown());
        const cssDiff = getLineDiffStats(baselineCss(), draftCss());

        return {
            added: markdownDiff.added + cssDiff.added,
            removed: markdownDiff.removed + cssDiff.removed,
        };
    });

    const handleUndo = () => {
        if (isCommitting()) return;
        setDraftMarkdown(baselineMarkdown());
        setDraftCss(baselineCss());
        setDiffMode(false);
    };

    const handleCommit = async (message?: string) => {
        const repository = selectedRepository();
        const branch = selectedBranch();
        if (!repository || !branch || isCommitting()) return;
        if (!hasChanges()) return;

        setIsCommitting(true);
        try {
            const response = await apiFetch<SaveRepoResponse>(
                withSearch("/api/save", { owner: repository.owner, repo: repository.repo }),
                {
                    method: "POST",
                    body: JSON.stringify({
                        targetBranch: branch.name,
                        expectedHeadSha: baselineHeadSha(),
                        message,
                        files: {
                            markdown: draftMarkdown(),
                            css: draftCss(),
                            markdownPath: remoteMarkdownPath() ?? "resume.md",
                            cssPath: remoteCssPath() ?? "resume.css",
                        },
                    }),
                },
            );

            setBaselineMarkdown(draftMarkdown());
            setBaselineCss(draftCss());
            setBaselineHeadSha(response.headSha);
            setDiffMode(false);
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                login(params.owner, params.repo, `${window.location.pathname}${window.location.search}`);
                return;
            }

            const errorMessage = error instanceof ApiError ? error.message : "Failed to commit changes";
            alert(errorMessage);
        } finally {
            setIsCommitting(false);
        }
    };

    return (
        <>
            <Title>{title()}</Title>
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
                                        originalValue: baselineMarkdown(),
                                        modifiedValue: draftMarkdown(),
                                    },
                                    {
                                        id: "theme.css",
                                        language: "css",
                                        originalValue: baselineCss(),
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
                                        <GithubBranchDropdown />
                                        <CommitButton
                                            initialShowDiff={diffMode()}
                                            hasChanges={hasChanges()}
                                            isCommitting={isCommitting()}
                                            diffStats={diffStats()}
                                            onShowDiffChange={(show) => setDiffMode(show && hasChanges())}
                                            onUndo={handleUndo}
                                            onCommit={(message) => {
                                                void handleCommit(message);
                                            }}
                                        />
                                    </>
                                }
                                trailing={
                                    <SaveOptionsButton
                                        onDownloadZip={() => exportAsZip(draftMarkdown(), draftCss())}
                                        onExportPdf={() =>
                                            exportAsPdf(html(), draftCss(), {
                                                title: parsedMarkdown().metadata.title,
                                            })
                                        }
                                    />
                                }
                            />
                        )}
                    </Preview>
                </div>
            </main>
        </>
    );
}
