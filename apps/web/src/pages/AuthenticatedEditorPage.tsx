import { Show, createEffect, createMemo, createSignal } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import { Title } from "@solidjs/meta";
import { formatDocumentTitle } from "@/lib/document-title";
import { getLineDiffStats, type DiffStats } from "@/lib/line-diff";
import { exportAsPdf } from "@/lib/export-as-pdf";
import { exportAsZip } from "@/lib/export-as-zip";
// Contexts
import { clearLoginGuard, login, useGithub } from "@/contexts/github/GithubContext";
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

import { ApiError } from "@/lib/fetch";

export default function AuthenticatedEditorPage() {
    const { user } = useGithub();
    const navigate = useNavigate();
    const [loginBlocked, setLoginBlocked] = createSignal<string | null>(null);

    const currentReturnTo = () => `${window.location.pathname}${window.location.search}`;

    const startLogin = () => {
        const result = login(currentReturnTo());
        if (result.blocked) {
            setLoginBlocked(result.reason ?? "Login failed. Please try again.");
        }
    };

    const retryLogin = () => {
        clearLoginGuard(currentReturnTo());
        setLoginBlocked(null);
        startLogin();
    };

    createEffect(() => {
        if (user() !== null) return;
        if (loginBlocked()) return;
        if (user() === null) {
            startLogin();
        }
    });

    return (
        <Show
            when={user()} // Loads page optimistically
            fallback={
                // TODO: Improve visually
                <main class="text-label-secondary flex h-dvh w-dvw items-center justify-center p-6 text-center">
                    <Show
                        when={!loginBlocked()}
                        fallback={
                            <div class="flex max-w-md flex-col items-center gap-3">
                                <h1 class="text-label-primary text-lg">Login failed</h1>
                                <p class="text-label-secondary text-sm leading-relaxed">{loginBlocked()}</p>
                                <div class="mt-2 flex flex-wrap justify-center gap-2">
                                    <button
                                        class="proeminent-button rounded-full px-4 py-2 text-sm"
                                        onClick={retryLogin}
                                    >
                                        Try login again
                                    </button>
                                    <button
                                        class="button-red rounded-full px-4 py-2 text-sm opacity-90"
                                        onClick={() => navigate("/", { replace: true })}
                                    >
                                        Back to home
                                    </button>
                                </div>
                            </div>
                        }
                    >
                        Logging in to GitHub...
                    </Show>
                </main>
            }
        >
            <GithubResumeProvider>
                <AuthenticatedEditor />
            </GithubResumeProvider>
        </Show>
    );
}

// TODO: Needs some good refactoring
function AuthenticatedEditor() {
    const navigate = useNavigate();
    const [diffMode, setDiffMode] = createSignal(false);
    const params = useParams<{ owner: string; repo: string }>();
    const { remoteMarkdown, remoteCss, blockEditor, selectedRepository, selectedBranch, logout } = useGithub();
    const {
        markdown: draftMarkdown,
        css: draftCss,
        setMarkdown: setDraftMarkdown,
        setCss: setDraftCss,
        clearDraft,
        isCommitting,
        commit,
    } = useGithubResume();

    const title = createMemo(() => {
        const repository = selectedRepository();
        const branch = selectedBranch();
        const routeRepository = [params.owner, params.repo].filter(Boolean).join("/");
        const repositoryLabel = repository?.fullName ?? (routeRepository || "Repository");
        const workspaceLabel = branch ? `${branch.name} · ${repositoryLabel}` : repositoryLabel;
        return formatDocumentTitle(workspaceLabel);
    });

    const isEditorBlocked = createMemo(() => blockEditor() || isCommitting());

    const remoteMarkdownValue = createMemo(() => remoteMarkdown() ?? "");
    const remoteCssValue = createMemo(() => remoteCss() ?? "");

    const hasChanges = createMemo(() => {
        if (isEditorBlocked()) return false;
        return draftMarkdown() !== remoteMarkdownValue() || draftCss() !== remoteCssValue();
    });

    createEffect(() => {
        if (!hasChanges() && diffMode()) {
            setDiffMode(false);
        }
    });

    const diffStats = createMemo<DiffStats>(() => {
        if (!hasChanges()) return { added: 0, removed: 0 };

        const markdownDiff = getLineDiffStats(remoteMarkdownValue(), draftMarkdown());
        const cssDiff = getLineDiffStats(remoteCssValue(), draftCss());

        return {
            added: markdownDiff.added + cssDiff.added,
            removed: markdownDiff.removed + cssDiff.removed,
        };
    });

    const handleUndo = () => {
        if (isEditorBlocked()) return;
        clearDraft();
        setDiffMode(false);
    };

    const handleMarkdownChange = (value: string) => {
        if (isEditorBlocked()) return;
        setDraftMarkdown(value);
    };

    const handleCssChange = (value: string) => {
        if (isEditorBlocked()) return;
        setDraftCss(value);
    };

    const handleCommit = async (message?: string) => {
        if (isEditorBlocked() || !hasChanges()) return;

        try {
            await commit(message);
            setDiffMode(false);
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                const result = login(`${window.location.pathname}${window.location.search}`);
                if (result.blocked) {
                    alert(result.reason ?? "Login failed. Please try again.");
                }
                return;
            }

            alert(error instanceof ApiError ? error.message : "Failed to commit changes");
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
                                readOnly={isEditorBlocked()}
                                tabs={[
                                    {
                                        id: "resume.md",
                                        language: "markdown",
                                        value: draftMarkdown(),
                                        onChange: handleMarkdownChange,
                                    },
                                    {
                                        id: "theme.css",
                                        language: "css",
                                        value: draftCss(),
                                        onChange: handleCssChange,
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
                                        originalValue: remoteMarkdownValue(),
                                        modifiedValue: draftMarkdown(),
                                    },
                                    {
                                        id: "theme.css",
                                        language: "css",
                                        originalValue: remoteCssValue(),
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
                                        <Show when={!isEditorBlocked() && hasChanges()}>
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
                                        </Show>
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
                                        onManageRepositories={() => navigate("/manage")}
                                        onLogout={() => {
                                            if (
                                                confirm(
                                                    "Sign out?\nYour changes will be kept saved in this browser and will be available when you log back in.",
                                                )
                                            )
                                                logout();
                                        }}
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
