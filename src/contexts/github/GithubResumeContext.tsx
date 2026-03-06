import { makePersisted, storageSync } from "@solid-primitives/storage";
import {
    createContext,
    createEffect,
    createMemo,
    createSignal,
    on,
    useContext,
    type Accessor,
    type JSXElement,
    type Setter,
} from "solid-js";
import { useGithubAuth } from "./GithubAuthContext";
import { useGithubRepository, type GithubRepository } from "./GithubRepositoryContext";
import { GITHUB_STORAGE_KEYS } from "@/lib/storage-keys";

type GithubRemoteFile = {
    path: string;
    sha: string;
    content: string;
};

type GithubResumeApiResponse = {
    owner: string;
    repo: string;
    ref: string;
    defaultBranch: string;
    markdown: GithubRemoteFile | null;
    stylesheet: GithubRemoteFile | null;
};

type GithubPushApiResponse = {
    ok: boolean;
    commit: string;
    branch: string;
    updated?: {
        markdown?: string;
        css?: string;
    };
};

type WorkspaceReference = {
    owner: string;
    repo: string;
    branch: string;
    key: string;
};

type WorkspaceFile = {
    path: string | null;
    sha: string | null;
    content: string;
};

type GithubWorkspaceEntry = {
    key: string;
    owner: string;
    repo: string;
    branch: string;
    sourceMarkdown: WorkspaceFile;
    sourceCss: WorkspaceFile;
    draftMarkdown: string;
    draftCss: string;
    lastFetchedAt: number;
    lastAccessedAt: number;
};

type GithubWorkspaceCache = {
    version: 1;
    entries: Record<string, GithubWorkspaceEntry>;
    lru: string[];
    lastOpenedKey: string | null;
};

const MAX_WORKSPACES = 20;
const REVALIDATE_MIN_INTERVAL_MS = 5_000;

const initialWorkspaceCache: GithubWorkspaceCache = {
    version: 1,
    entries: {},
    lru: [],
    lastOpenedKey: null,
};

function makeWorkspaceKey(owner: string, repo: string, branch: string) {
    return `${owner}/${repo}?ref=${encodeURIComponent(branch)}`;
}

function parseWorkspaceKey(key: string): WorkspaceReference | null {
    const separatorIndex = key.indexOf("?ref=");
    if (separatorIndex < 0) return null;

    const repoPart = key.slice(0, separatorIndex);
    const refPart = key.slice(separatorIndex + "?ref=".length);
    const slashIndex = repoPart.indexOf("/");
    if (slashIndex < 0) return null;

    const owner = repoPart.slice(0, slashIndex);
    const repo = repoPart.slice(slashIndex + 1);
    if (!owner || !repo) return null;

    return {
        owner,
        repo,
        branch: decodeURIComponent(refPart),
        key,
    };
}

function dedupeKeys(keys: string[]) {
    const seen = new Set<string>();
    const next: string[] = [];
    for (const key of keys) {
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(key);
    }
    return next;
}

function touchWorkspaceKey(lru: string[], key: string) {
    return [key, ...lru.filter((item) => item !== key)];
}

function trimWorkspaceCache(cache: GithubWorkspaceCache, protectedKey?: string | null): GithubWorkspaceCache {
    let nextLru = dedupeKeys(cache.lru.filter((key) => key in cache.entries));

    if (protectedKey && protectedKey in cache.entries) {
        nextLru = touchWorkspaceKey(nextLru, protectedKey);
    }

    nextLru = nextLru.slice(0, MAX_WORKSPACES);

    const allowedKeys = new Set(nextLru);
    const nextEntries: Record<string, GithubWorkspaceEntry> = {};
    Object.entries(cache.entries).forEach(([key, value]) => {
        if (!allowedKeys.has(key)) return;
        nextEntries[key] = value;
    });

    return {
        ...cache,
        entries: nextEntries,
        lru: nextLru,
        lastOpenedKey: cache.lastOpenedKey && allowedKeys.has(cache.lastOpenedKey) ? cache.lastOpenedKey : null,
    };
}

function toWorkspaceFile(file: GithubRemoteFile | null): WorkspaceFile {
    if (!file) {
        return {
            path: null,
            sha: null,
            content: "",
        };
    }

    return {
        path: file.path,
        sha: file.sha,
        content: file.content,
    };
}

function fromRemote(
    reference: WorkspaceReference,
    data: GithubResumeApiResponse | null,
    now: number,
): GithubWorkspaceEntry {
    const sourceMarkdown = toWorkspaceFile(data?.markdown ?? null);
    const sourceCss = toWorkspaceFile(data?.stylesheet ?? null);

    return {
        key: reference.key,
        owner: reference.owner,
        repo: reference.repo,
        branch: reference.branch,
        sourceMarkdown,
        sourceCss,
        draftMarkdown: sourceMarkdown.content,
        draftCss: sourceCss.content,
        lastFetchedAt: now,
        lastAccessedAt: now,
    };
}

function reconcileWorkspace(
    existing: GithubWorkspaceEntry,
    nextRemote: GithubWorkspaceEntry,
    now: number,
): GithubWorkspaceEntry {
    const hasUnsavedMarkdown = existing.draftMarkdown !== existing.sourceMarkdown.content;
    const hasUnsavedCss = existing.draftCss !== existing.sourceCss.content;

    const draftMarkdown = hasUnsavedMarkdown
        ? existing.draftMarkdown === nextRemote.sourceMarkdown.content
            ? nextRemote.sourceMarkdown.content
            : existing.draftMarkdown
        : nextRemote.sourceMarkdown.content;

    const draftCss = hasUnsavedCss
        ? existing.draftCss === nextRemote.sourceCss.content
            ? nextRemote.sourceCss.content
            : existing.draftCss
        : nextRemote.sourceCss.content;

    return {
        ...existing,
        owner: nextRemote.owner,
        repo: nextRemote.repo,
        branch: nextRemote.branch,
        sourceMarkdown: nextRemote.sourceMarkdown,
        sourceCss: nextRemote.sourceCss,
        draftMarkdown,
        draftCss,
        lastFetchedAt: now,
        lastAccessedAt: now,
    };
}

function isWorkspaceDirty(entry: GithubWorkspaceEntry | null): boolean {
    if (!entry) return false;
    return entry.draftMarkdown !== entry.sourceMarkdown.content || entry.draftCss !== entry.sourceCss.content;
}

function resolveSetterValue(value: string | ((prev: string) => string), prev: string) {
    return typeof value === "function" ? value(prev) : value;
}

function toWorkspaceReference(owner: string, repo: string, branch: string): WorkspaceReference {
    return {
        owner,
        repo,
        branch,
        key: makeWorkspaceKey(owner, repo, branch),
    };
}

function toErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    return "Failed to sync repository files.";
}

const GithubResumeContext = createContext<{
    draftMarkdown: Accessor<string>;
    setDraftMarkdown: Setter<string>;
    draftCss: Accessor<string>;
    setDraftCss: Setter<string>;
    sourceMarkdown: Accessor<string>;
    sourceCss: Accessor<string>;
    canShowDiff: Accessor<boolean>;
    isEditorBlocked: Accessor<boolean>;
    editorBlockedMessage: Accessor<string | null>;
    isDirty: Accessor<boolean>;
    isBlockingLoad: Accessor<boolean>;
    isRevalidating: Accessor<boolean>;
    isSaving: Accessor<boolean>;
    error: Accessor<string | null>;
    selectRepository: (repo: GithubRepository) => Promise<boolean>;
    selectBranch: (branchName: string) => Promise<boolean>;
    saveToGithub: (message?: string) => Promise<void>;
    revertFile: (file: "markdown" | "css") => void;
    revertAll: () => void;
}>();

export function GithubResumeProvider(props: { children?: JSXElement }) {
    const { api } = useGithubAuth();
    const { selectedRepository, selectedBranch, setSelectedRepository } = useGithubRepository();

    const [workspaceCache, setWorkspaceCache] = makePersisted(
        createSignal<GithubWorkspaceCache>(initialWorkspaceCache),
        {
            name: GITHUB_STORAGE_KEYS.WORKSPACES,
            storage: localStorage,
            sync: storageSync,
        },
    );

    const [blockingCount, setBlockingCount] = createSignal(0);
    const [revalidatingByKey, setRevalidatingByKey] = createSignal<Record<string, true>>({});
    const [isSaving, setIsSaving] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);

    const inflightFetches = new Map<string, Promise<boolean>>();

    const activeWorkspaceReference = createMemo<WorkspaceReference | null>(() => {
        const repo = selectedRepository();
        const branch = selectedBranch();
        if (!repo || !branch) return null;
        return toWorkspaceReference(repo.owner, repo.repo, branch.name);
    });

    const activeWorkspace = createMemo<GithubWorkspaceEntry | null>(() => {
        const reference = activeWorkspaceReference();
        if (!reference) return null;
        return workspaceCache().entries[reference.key] ?? null;
    });

    const isBlockingLoad = createMemo(() => blockingCount() > 0);

    const setRevalidating = (key: string, value: boolean) => {
        setRevalidatingByKey((prev) => {
            if (value) {
                if (prev[key]) return prev;
                return { ...prev, [key]: true };
            }

            if (!(key in prev)) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const updateWorkspaceEntry = (
        reference: WorkspaceReference,
        updater: (entry: GithubWorkspaceEntry) => GithubWorkspaceEntry,
    ) => {
        setWorkspaceCache((prev) => {
            const entry = prev.entries[reference.key];
            if (!entry) return prev;

            const updatedEntry = updater(entry);
            const now = Date.now();
            const next: GithubWorkspaceCache = {
                ...prev,
                entries: {
                    ...prev.entries,
                    [reference.key]: {
                        ...updatedEntry,
                        key: reference.key,
                        owner: reference.owner,
                        repo: reference.repo,
                        branch: reference.branch,
                        lastAccessedAt: now,
                    },
                },
                lru: touchWorkspaceKey(prev.lru, reference.key),
                lastOpenedKey: reference.key,
            };

            return trimWorkspaceCache(next, reference.key);
        });
    };

    const fetchWorkspaceFromRemote = async (reference: WorkspaceReference): Promise<GithubResumeApiResponse | null> => {
        try {
            return await api<GithubResumeApiResponse>(
                `/api/github/repo/${encodeURIComponent(reference.owner)}/${encodeURIComponent(reference.repo)}/resume?ref=${encodeURIComponent(reference.branch)}`,
            );
        } catch (error: any) {
            const status = error?.status;
            if (status === 404) return null;
            throw error;
        }
    };

    const fetchAndReconcileWorkspace = async (
        reference: WorkspaceReference,
        options: { blocking: boolean; force?: boolean } = { blocking: false },
    ): Promise<boolean> => {
        const cachedEntry = workspaceCache().entries[reference.key];
        if (!options.force && cachedEntry && Date.now() - cachedEntry.lastFetchedAt < REVALIDATE_MIN_INTERVAL_MS) {
            return true;
        }

        const existingRequest = inflightFetches.get(reference.key);
        if (existingRequest) return existingRequest;

        const request = (async () => {
            if (options.blocking) {
                setBlockingCount((count) => count + 1);
            }

            setRevalidating(reference.key, true);

            try {
                const remote = await fetchWorkspaceFromRemote(reference);
                const now = Date.now();
                const remoteWorkspace = fromRemote(reference, remote, now);

                setWorkspaceCache((prev) => {
                    const existing = prev.entries[reference.key] ?? null;
                    const nextEntry = existing ? reconcileWorkspace(existing, remoteWorkspace, now) : remoteWorkspace;

                    const next: GithubWorkspaceCache = {
                        ...prev,
                        entries: {
                            ...prev.entries,
                            [reference.key]: nextEntry,
                        },
                        lru: touchWorkspaceKey(prev.lru, reference.key),
                        lastOpenedKey: reference.key,
                    };

                    return trimWorkspaceCache(next, reference.key);
                });

                if (activeWorkspaceReference()?.key === reference.key) {
                    setError(null);
                }

                return true;
            } catch (error) {
                if (activeWorkspaceReference()?.key === reference.key || options.blocking) {
                    setError(toErrorMessage(error));
                }
                return false;
            } finally {
                setRevalidating(reference.key, false);

                if (options.blocking) {
                    setBlockingCount((count) => Math.max(0, count - 1));
                }

                inflightFetches.delete(reference.key);
            }
        })();

        inflightFetches.set(reference.key, request);
        return request;
    };

    const selectWorkspace = async (reference: WorkspaceReference, repo: GithubRepository): Promise<boolean> => {
        setError(null);

        const hasCachedEntry = reference.key in workspaceCache().entries;
        if (!hasCachedEntry) {
            const ready = await fetchAndReconcileWorkspace(reference, { blocking: true, force: true });
            if (!ready) return false;
        }

        setSelectedRepository(repo, reference.branch);

        if (hasCachedEntry) {
            const cachedEntry = workspaceCache().entries[reference.key];
            const isStale = !cachedEntry || Date.now() - cachedEntry.lastFetchedAt >= REVALIDATE_MIN_INTERVAL_MS;
            if (isStale) {
                void fetchAndReconcileWorkspace(reference, { blocking: false, force: true });
            }
        }

        return true;
    };

    const resolveBranchForRepository = (repo: GithubRepository): string => {
        const cache = workspaceCache();

        if (cache.lastOpenedKey) {
            const lastOpened = parseWorkspaceKey(cache.lastOpenedKey);
            if (
                lastOpened &&
                lastOpened.owner === repo.owner &&
                lastOpened.repo === repo.repo &&
                repo.branches.some((branch) => branch.name === lastOpened.branch)
            ) {
                return lastOpened.branch;
            }
        }

        for (const key of cache.lru) {
            const parsed = parseWorkspaceKey(key);
            if (!parsed) continue;
            if (parsed.owner !== repo.owner || parsed.repo !== repo.repo) continue;
            if (!repo.branches.some((branch) => branch.name === parsed.branch)) continue;
            return parsed.branch;
        }

        return repo.branches.find((branch) => branch.isDefault)?.name ?? repo.defaultBranch;
    };

    const selectRepository = async (repo: GithubRepository): Promise<boolean> => {
        const targetBranch = resolveBranchForRepository(repo);
        const reference = toWorkspaceReference(repo.owner, repo.repo, targetBranch);
        return selectWorkspace(reference, repo);
    };

    const selectBranch = async (branchName: string): Promise<boolean> => {
        const repo = selectedRepository();
        if (!repo) {
            setError("No repository selected.");
            return false;
        }

        const targetBranch = repo.branches.find((branch) => branch.name === branchName);
        if (!targetBranch) {
            setError(`Branch \"${branchName}\" not found in ${repo.fullName}.`);
            return false;
        }

        const reference = toWorkspaceReference(repo.owner, repo.repo, targetBranch.name);
        return selectWorkspace(reference, repo);
    };

    createEffect(
        on(
            activeWorkspaceReference,
            (reference) => {
                if (!reference) return;

                const entry = workspaceCache().entries[reference.key] ?? null;
                if (entry) {
                    updateWorkspaceEntry(reference, (current) => current);

                    const isStale = Date.now() - entry.lastFetchedAt >= REVALIDATE_MIN_INTERVAL_MS;
                    if (isStale) {
                        void fetchAndReconcileWorkspace(reference, { blocking: false });
                    }
                    return;
                }

                void fetchAndReconcileWorkspace(reference, { blocking: true, force: true });
            },
            { defer: true },
        ),
    );

    const draftMarkdown = createMemo(() => activeWorkspace()?.draftMarkdown ?? "");
    const draftCss = createMemo(() => activeWorkspace()?.draftCss ?? "");
    const sourceMarkdown = createMemo(() => activeWorkspace()?.sourceMarkdown.content ?? "");
    const sourceCss = createMemo(() => activeWorkspace()?.sourceCss.content ?? "");
    const canShowDiff = createMemo(() => selectedBranch() !== null && activeWorkspace() !== null);
    const isEditorBlocked = createMemo(
        () => selectedBranch() === null || isBlockingLoad() || activeWorkspace() === null,
    );
    const editorBlockedMessage = createMemo<string | null>(() => {
        if (selectedRepository() === null) return "No repository selected.";
        if (selectedBranch() === null) return "This repository has no branch yet.";
        if (isBlockingLoad()) return "Loading repository...";
        if (activeWorkspace() === null) return "Repository workspace unavailable.";
        return null;
    });

    const setDraftMarkdown: Setter<string> = (value) => {
        const reference = activeWorkspaceReference();
        const entry = activeWorkspace();
        const fallbackNextValue = resolveSetterValue(value, entry?.draftMarkdown ?? "");
        if (!reference) return fallbackNextValue;

        let nextValue = fallbackNextValue;
        updateWorkspaceEntry(reference, (current) => {
            nextValue = resolveSetterValue(value, current.draftMarkdown);
            return {
                ...current,
                draftMarkdown: nextValue,
            };
        });

        return nextValue;
    };

    const setDraftCss: Setter<string> = (value) => {
        const reference = activeWorkspaceReference();
        const entry = activeWorkspace();
        const fallbackNextValue = resolveSetterValue(value, entry?.draftCss ?? "");
        if (!reference) return fallbackNextValue;

        let nextValue = fallbackNextValue;
        updateWorkspaceEntry(reference, (current) => {
            nextValue = resolveSetterValue(value, current.draftCss);
            return {
                ...current,
                draftCss: nextValue,
            };
        });

        return nextValue;
    };

    const isDirty = createMemo(() => isWorkspaceDirty(activeWorkspace()));

    const isRevalidating = createMemo(() => {
        const reference = activeWorkspaceReference();
        if (!reference) return false;
        return reference.key in revalidatingByKey();
    });

    const revertFile = (file: "markdown" | "css") => {
        const reference = activeWorkspaceReference();
        if (!reference) return;

        updateWorkspaceEntry(reference, (entry) => {
            if (file === "markdown") {
                return {
                    ...entry,
                    draftMarkdown: entry.sourceMarkdown.content,
                };
            }

            return {
                ...entry,
                draftCss: entry.sourceCss.content,
            };
        });
    };

    const revertAll = () => {
        const reference = activeWorkspaceReference();
        if (!reference) return;

        updateWorkspaceEntry(reference, (entry) => ({
            ...entry,
            draftMarkdown: entry.sourceMarkdown.content,
            draftCss: entry.sourceCss.content,
        }));
    };

    const saveToGithub = async (message?: string) => {
        const reference = activeWorkspaceReference();
        const entry = activeWorkspace();
        if (!reference || !entry) return;

        setIsSaving(true);
        setError(null);

        try {
            const response = await api<GithubPushApiResponse>(
                `/api/github/repo/${encodeURIComponent(reference.owner)}/${encodeURIComponent(reference.repo)}/push`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        markdown: entry.draftMarkdown,
                        css: entry.draftCss,
                        message,
                        branch: reference.branch,
                    }),
                },
            );

            const now = Date.now();

            updateWorkspaceEntry(reference, (current) => ({
                ...current,
                sourceMarkdown: {
                    path: response.updated?.markdown ?? current.sourceMarkdown.path,
                    sha: null,
                    content: current.draftMarkdown,
                },
                sourceCss: {
                    path: response.updated?.css ?? current.sourceCss.path,
                    sha: null,
                    content: current.draftCss,
                },
                lastFetchedAt: now,
            }));

            void fetchAndReconcileWorkspace(reference, { blocking: false, force: true });
        } catch (error) {
            setError(toErrorMessage(error));
            throw error;
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <GithubResumeContext.Provider
            value={{
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
                revertFile,
                revertAll,
            }}
        >
            {props.children}
        </GithubResumeContext.Provider>
    );
}

export function useGithubResume() {
    const ctx = useContext(GithubResumeContext);
    if (!ctx) throw new Error("useGithubResume must be used within a GithubResumeProvider");
    return ctx;
}
