export type GithubUserSummary = {
    username: string;
    avatarUrl: string;
};

export type RepoSummary = {
    owner: string;
    repo: string;
    fullName: string;
    installationId: number;
    defaultBranch?: string;
};

export type BranchSummary = {
    name: string;
    commitSha?: string;
    isDefault: boolean;
};

export type EditorFile = {
    path: string;
    sha: string;
    content: string;
};

export type EditorFiles = {
    markdown: EditorFile | null;
    css: EditorFile | null;
};

export type RepoEditorResponse = {
    owner: string;
    repo: string;
    branch: string;
    defaultBranch: string;
    headSha: string | null;
    branches: BranchSummary[];
    files: EditorFiles;
};

export type BootstrapResponse = {
    authenticated: boolean;
    user: GithubUserSummary | null;
    repos: RepoSummary[];
    selected: RepoEditorResponse | null;
};

export type SaveRepoRequest = {
    targetBranch: string;
    baseBranch?: string;
    createBranchIfMissing?: boolean;
    expectedHeadSha?: string;
    message?: string;
    files: {
        markdown: string;
        css: string;
        markdownPath?: string;
        cssPath?: string;
    };
};

export type SaveRepoResponse = {
    ok: true;
    branch: string;
    commitSha: string;
    headSha: string;
    createdBranch: boolean;
    updatedPaths: {
        markdown: string;
        css: string;
    };
};
