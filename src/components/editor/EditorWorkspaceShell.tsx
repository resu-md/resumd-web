import { createMemo, createSignal, Show } from "solid-js";
import Editor from "@/components/editor/Editor";
import DiffEditor from "@/components/editor/DiffEditor";
import Tabs from "@/components/editor/Tabs";
import Previewer from "@/components/preview/Previewer";
import { ZoomProvider } from "@/components/preview/ZoomContext";
import ResizablePane from "@/components/ResizablePane";
import type { EditorViewModel } from "@/components/editor/editor-view-model";
import { getLineDiffStats } from "@/lib/line-diff-stats";

export default function EditorWorkspaceShell(props: { viewModel: EditorViewModel }) {
    const [activeTab, setActiveTab] = createSignal<"resume.md" | "theme.css">("resume.md");

    const canShowDiff = createMemo(() => props.viewModel.mode === "github" && props.viewModel.canShowDiff());

    const shouldRenderDiff = createMemo(() => canShowDiff() && props.viewModel.showDiff());

    const errorMessage = createMemo(() => props.viewModel.error?.() ?? null);
    const blockedMessage = createMemo(() => props.viewModel.editingBlockedMessage());
    const aggregatedDiffStats = createMemo(() => {
        if (!canShowDiff()) {
            return { added: 0, removed: 0 };
        }

        const markdownStats = getLineDiffStats(
            props.viewModel.sourceMarkdown?.() ?? "",
            props.viewModel.draftMarkdown(),
        );
        const cssStats = getLineDiffStats(props.viewModel.sourceCss?.() ?? "", props.viewModel.draftCss());

        return {
            added: markdownStats.added + cssStats.added,
            removed: markdownStats.removed + cssStats.removed,
        };
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
                <div class="mt-4.5 h-[calc(100%-1.125rem)]">
                    <Tabs values={["resume.md", "theme.css"]} active={activeTab()} onChange={setActiveTab} />
                    <div class="border-gray-5 dark:border-gray-4 bg-system-primary relative flex h-full overflow-hidden rounded-2xl border">
                        <Show
                            when={shouldRenderDiff()}
                            fallback={
                                <Editor
                                    class="flex-1"
                                    activeTabId={activeTab()}
                                    readOnly={props.viewModel.isEditingBlocked()}
                                    tabs={[
                                        {
                                            id: "resume.md",
                                            language: "markdown",
                                            value: props.viewModel.draftMarkdown(),
                                            onChange: props.viewModel.setDraftMarkdown,
                                        },
                                        {
                                            id: "theme.css",
                                            language: "css",
                                            value: props.viewModel.draftCss(),
                                            onChange: props.viewModel.setDraftCss,
                                        },
                                    ]}
                                />
                            }
                        >
                            <DiffEditor
                                class="flex-1"
                                activeTabId={activeTab()}
                                tabs={[
                                    {
                                        id: "resume.md",
                                        language: "markdown",
                                        originalValue: props.viewModel.sourceMarkdown?.() ?? "",
                                        modifiedValue: props.viewModel.draftMarkdown(),
                                    },
                                    {
                                        id: "theme.css",
                                        language: "css",
                                        originalValue: props.viewModel.sourceCss?.() ?? "",
                                        modifiedValue: props.viewModel.draftCss(),
                                    },
                                ]}
                            />
                        </Show>

                        <Show when={props.viewModel.isEditingBlocked()}>
                            {/* TODO: Improve visually */}
                            <div class="bg-system-primary/70 absolute inset-0 z-20 flex items-center justify-center backdrop-blur-[2px]">
                                <div class="text-label-secondary font-mono text-sm">
                                    {blockedMessage() ?? "Editor unavailable."}
                                </div>
                            </div>
                        </Show>

                        <Show when={errorMessage()}>
                            {/* TODO: Test states, improve visually */}
                            {(message) => (
                                <div class="absolute right-3 bottom-3 left-3 z-30 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                                    {message()}
                                </div>
                            )}
                        </Show>
                    </div>
                </div>
            </ResizablePane>
            <ZoomProvider>
                <Previewer
                    class="flex-1"
                    markdown={props.viewModel.draftMarkdown}
                    css={props.viewModel.draftCss}
                    toolbar={{
                        mode: props.viewModel.mode,
                        canPush: props.viewModel.canPush(),
                        isSaving: props.viewModel.isSaving(),
                        onPush: props.viewModel.onPush,
                        showDiff: props.viewModel.showDiff(),
                        canShowDiff: canShowDiff(),
                        onToggleDiff: canShowDiff() ? () => props.viewModel.setShowDiff((value) => !value) : undefined,
                        onRevertAll: props.viewModel.onRevertAll,
                        onSelectRepository: props.viewModel.onSelectRepository,
                        onSelectBranch: props.viewModel.onSelectBranch,
                        isBlockingLoad: props.viewModel.isBlockingLoad(),
                        isRevalidating: props.viewModel.isRevalidating?.() ?? false,
                        diffAdded: aggregatedDiffStats().added,
                        diffRemoved: aggregatedDiffStats().removed,
                    }}
                />
            </ZoomProvider>
        </main>
    );
}
