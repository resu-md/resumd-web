export const ANONYMOUS_WORKSPACE_STORAGE_KEYS = {
    MARKDOWN: "resumd.anonymous_workspace.resume.md",
    CSS: "resumd.anonymous_workspace.resume.css",
};

export const QUERY_CACHE_STORAGE_KEYS = {
    TANSTACK_QUERY: "resumd.tanstack_query.cache",
};

export const GITHUB_WORKSPACE_STORAGE_KEYS = {
    WORKSPACE: (repoFullName: string, branchName: string) =>
        `resumd.github_workspace.doc.${repoFullName}_${branchName}`,
};
