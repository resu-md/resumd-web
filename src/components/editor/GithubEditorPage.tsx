import { createSignal } from "solid-js";
import EditorWorkspaceShell from "@/components/editor/EditorWorkspaceShell";
import type { EditorViewModel } from "@/components/editor/editor-view-model";
import { useGithubResume } from "@/contexts/github/GithubResumeContext";

export default function GithubEditorPage() {
    const [showDiff, setShowDiff] = createSignal(false);
    const {
        draftMarkdown,
        setDraftMarkdown,
        draftCss,
        setDraftCss,
        sourceMarkdown,
        sourceCss,
        canShowDiff,
        isEditorBlocked,
        editorBlockedMessage,
        isDirty,
        isBlockingLoad,
        isRevalidating,
        isSaving,
        error,
        selectRepository,
        selectBranch,
        saveToGithub,
        revertAll,
    } = useGithubResume();

    const viewModel: EditorViewModel = {
        mode: "github",
        draftMarkdown,
        setDraftMarkdown,
        draftCss,
        setDraftCss,
        sourceMarkdown,
        sourceCss,
        canShowDiff,
        isEditingBlocked: isEditorBlocked,
        editingBlockedMessage: editorBlockedMessage,
        isBlockingLoad,
        isRevalidating,
        error,
        showDiff,
        setShowDiff,
        canPush: isDirty,
        isSaving,
        onPush: saveToGithub,
        onRevertAll: revertAll,
        onSelectRepository: selectRepository,
        onSelectBranch: selectBranch,
    };

    return <EditorWorkspaceShell viewModel={viewModel} />;
}
