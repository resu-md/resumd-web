import { createSignal } from "solid-js";
import EditorWorkspaceShell from "@/components/editor/EditorWorkspaceShell";
import type { EditorViewModel } from "@/components/editor/editor-view-model";
import { useResume } from "@/contexts/ResumeContext";

export default function EditorPage() {
    const { css, setCss, markdown, setMarkdown } = useResume();
    const [showDiff, setShowDiff] = createSignal(false);

    const viewModel: EditorViewModel = {
        mode: "local",
        draftMarkdown: markdown,
        setDraftMarkdown: setMarkdown,
        draftCss: css,
        setDraftCss: setCss,
        isEditingBlocked: () => false,
        editingBlockedMessage: () => null,
        canShowDiff: () => false,
        isBlockingLoad: () => false,
        showDiff,
        setShowDiff,
        canPush: () => false,
        isSaving: () => false,
    };

    return <EditorWorkspaceShell viewModel={viewModel} />;
}
