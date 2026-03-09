export type PaginatedCollection<T> = {
    items: T[];
    pageInfo: {
        page: number;
        perPage: number;
        hasMore: boolean;
    };
};

// User

export type GithubUser = {
    username: string;
    avatarUrl: string;
};

// Repository

export type RepositoryInformation = {
    owner: string;
    repo: string;
    fullName: string;
    installationId: number;
};

// Branch

export type BranchInformation = {
    name: string;
    commitSha?: string;
    isDefault: boolean;
};

// Files

export type EditorFile = {
    path: string;
    sha: string;
    content: string;
};

export type EditorFiles = {
    markdown: EditorFile | null;
    css: EditorFile | null;
};

/**
 * Request/response bodies
 */

/**
 * GET `/api/bootstrap?owner=...&repo=...&branch=...`
 * Branch is optional.
 * If repository is not found, selected will be null.
 * If repository has no branches, selected_branch will be null.
 * If branch is not provided a fallback branch will be used. If branch is provided but not found, selected_branch will be null.
 */
export type BootstrapResponse = {
    user: GithubUser;
    repositories: PaginatedCollection<RepositoryInformation>;
    selected: {
        repository: RepositoryInformation;
        branches: PaginatedCollection<BranchInformation>;
    } | null;
};

// GET `/api/branches?owner=...&repo=...`
export type BranchesResponse = {
    branches: PaginatedCollection<BranchInformation>;
};

// GET `/api/files?owner=...&repo=...&branch=...`
export type FilesResponse = {
    repository: RepositoryInformation;
    branch: BranchInformation;
    files: EditorFiles;
};

// POST `/api/save`
export type SaveRepoRequest = {
    targetBranch: string;
    baseBranch?: string;
    createBranchIfMissing?: boolean;
    expectedHeadSha?: string;
    message?: string;
    files: {
        markdown: string;
        css: string;
        markdownPath: string;
        cssPath: string;
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
