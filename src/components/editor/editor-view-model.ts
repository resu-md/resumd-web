import type { Accessor, Setter } from "solid-js";
import type { GithubRepository } from "@/contexts/github/GithubRepositoryContext";

export type EditorMode = "local" | "github";

export type EditorViewModel = {
    mode: EditorMode;
    draftMarkdown: Accessor<string>;
    setDraftMarkdown: Setter<string>;
    draftCss: Accessor<string>;
    setDraftCss: Setter<string>;
    isEditingBlocked: Accessor<boolean>;
    editingBlockedMessage: Accessor<string | null>;
    canShowDiff: Accessor<boolean>;
    isBlockingLoad: Accessor<boolean>;
    isRevalidating?: Accessor<boolean>;
    error?: Accessor<string | null>;
    showDiff: Accessor<boolean>;
    setShowDiff: Setter<boolean>;
    canPush: Accessor<boolean>;
    isSaving: Accessor<boolean>;
    onPush?: () => Promise<void> | void;
    onRevertAll?: () => void;
    sourceMarkdown?: Accessor<string>;
    sourceCss?: Accessor<string>;
    onSelectRepository?: (repo: GithubRepository) => Promise<boolean> | boolean;
    onSelectBranch?: (branchName: string) => Promise<boolean> | boolean;
};
