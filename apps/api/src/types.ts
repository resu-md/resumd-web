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
 * GET `/api/bootstrap?owner=...&repo=...`
 * If owner/repo are omitted, selected is null and only user/session information is returned.
 */
export type BootstrapResponse = {
    user: GithubUser;
    selected: {
        repository: RepositoryInformation;
        branches: PaginatedCollection<BranchInformation>;
    } | null;
};

// GET `/api/repositories`
export type RepositoriesResponse = {
    repositories: PaginatedCollection<RepositoryInformation>;
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
