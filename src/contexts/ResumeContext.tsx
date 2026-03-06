import { api } from "@/lib/api";
import { debounce } from "@solid-primitives/scheduled";
import { makePersisted, storageSync } from "@solid-primitives/storage";
import {
    createContext,
    createEffect,
    createMemo,
    createSignal,
    onCleanup,
    onMount,
    on,
    untrack,
    useContext,
    type Accessor,
    type JSXElement,
    type Setter,
} from "solid-js";
import { useBrowserTabs } from "./BrowserTabsContext";
import { useGithubAuth } from "./github/GithubAuthContext";
import { useGithubRepository } from "./github/GithubRepositoryContext";

type ResumeDocuments = {
    markdown: string;
    css: string;
};

type GithubRemoteState = {
    ref: string;
    commitSha: string | null;
    markdownPath: string | null;
    cssPath: string | null;
    fetchedAt: number;
};

type BranchResumeState = {
    source: ResumeDocuments;
    working: ResumeDocuments;
    remote: GithubRemoteState | null;
    lastAccessedAt: number;
};

type LocalWorkspaceState = {
    kind: "local";
    branches: Record<string, BranchResumeState>;
};

type GithubWorkspaceState = {
    kind: "github";
    owner: string;
    repo: string;
    branches: Record<string, BranchResumeState>;
};

type WorkspaceResumeState = LocalWorkspaceState | GithubWorkspaceState;

type ResumePersistenceState = {
    version: 2;
    workspaces: Record<string, WorkspaceResumeState>;
};

type WorkspaceDescriptor =
    | {
          kind: "local";
      }
    | {
          kind: "github";
          owner: string;
          repo: string;
      };

type ResumeDiff = {
    added: number;
    removed: number;
    hasChanges: boolean;
};

type GithubResumeFile = {
    path: string;
    sha: string;
    content: string;
};

type GithubResumeResponse = {
    owner: string;
    repo: string;
    ref: string;
    defaultBranch: string;
    markdown: GithubResumeFile | null;
    stylesheet: GithubResumeFile | null;
};

type ResumeContextValue = {
    css: Accessor<string>;
    setCss: Setter<string>;
    markdown: Accessor<string>;
    setMarkdown: Setter<string>;
    sourceCss: Accessor<string>;
    sourceMarkdown: Accessor<string>;
    isCurrentBranchDirty: Accessor<boolean>;
    diffForCurrentBranch: Accessor<ResumeDiff>;
    getBranchDiff: (branchName: string) => ResumeDiff;
    isBranchDirty: (branchName: string) => boolean;
    resetCurrentBranchToSource: () => void;
    isDiffMode: Accessor<boolean>;
    setDiffMode: Setter<boolean>;
    toggleDiffMode: () => void;
};

const RESUME_STATE_STORAGE_KEY = "resumd.resume.state.v2";
const LOCAL_WORKSPACE_KEY = "local";
const LOCAL_BRANCH_NAME = "local";
const CURRENT_DIFF_DEBOUNCE_MS = 140;
const ZERO_DIFF: ResumeDiff = { added: 0, removed: 0, hasChanges: false };
const DIFF_CACHE_MAX_ENTRIES = 400;

const ResumeContext = createContext<ResumeContextValue>();

function buildGithubWorkspaceKey(owner: string, repo: string) {
    return `gh:${owner}/${repo}`;
}

function createEmptyDocuments(): ResumeDocuments {
    return { markdown: "", css: "" };
}

function cloneDocuments(source: ResumeDocuments): ResumeDocuments {
    return {
        markdown: source.markdown,
        css: source.css,
    };
}

function createBranchState(source?: ResumeDocuments, working?: ResumeDocuments): BranchResumeState {
    const base = source ?? createEmptyDocuments();
    return {
        source: cloneDocuments(base),
        working: cloneDocuments(working ?? base),
        remote: null,
        lastAccessedAt: Date.now(),
    };
}

function createInitialState(): ResumePersistenceState {
    return {
        version: 2,
        workspaces: {
            [LOCAL_WORKSPACE_KEY]: {
                kind: "local",
                branches: {
                    [LOCAL_BRANCH_NAME]: createBranchState(),
                },
            },
        },
    };
}

function clonePersistenceState(value: ResumePersistenceState): ResumePersistenceState {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value)) as ResumePersistenceState;
}

function getOrCreateWorkspaceMutable(
    state: ResumePersistenceState,
    workspaceKey: string,
    descriptor: WorkspaceDescriptor,
): WorkspaceResumeState {
    const existing = state.workspaces[workspaceKey];
    if (existing) {
        if (descriptor.kind === "github") {
            const githubWorkspace = existing as GithubWorkspaceState;
            githubWorkspace.kind = "github";
            githubWorkspace.owner = descriptor.owner;
            githubWorkspace.repo = descriptor.repo;
        }
        return existing;
    }

    if (descriptor.kind === "github") {
        const workspace: GithubWorkspaceState = {
            kind: "github",
            owner: descriptor.owner,
            repo: descriptor.repo,
            branches: {},
        };
        state.workspaces[workspaceKey] = workspace;
        return workspace;
    }

    const workspace: LocalWorkspaceState = {
        kind: "local",
        branches: {},
    };
    state.workspaces[workspaceKey] = workspace;
    return workspace;
}

function getOrCreateBranchMutable(workspace: WorkspaceResumeState, branchName: string): BranchResumeState {
    const existing = workspace.branches[branchName];
    if (existing) return existing;

    const branch = createBranchState();
    workspace.branches[branchName] = branch;
    return branch;
}

function isSameDocuments(left: ResumeDocuments, right: ResumeDocuments) {
    return left.markdown === right.markdown && left.css === right.css;
}

function isBranchDirtyState(branch: BranchResumeState) {
    return !isSameDocuments(branch.source, branch.working);
}

function parseScopeKey(scopeKey: string) {
    const splitIndex = scopeKey.lastIndexOf("#");
    if (splitIndex < 0) return null;
    return {
        workspaceKey: scopeKey.slice(0, splitIndex),
        branchName: scopeKey.slice(splitIndex + 1),
    };
}

function sanitizeBranchName(input: string | null | undefined) {
    const candidate = typeof input === "string" ? input.trim() : "";
    if (!candidate) return null;
    if (candidate.includes(" ") || candidate.includes("..")) return null;
    if (candidate.startsWith("/") || candidate.endsWith("/")) return null;
    return candidate;
}

function suggestBranchName(fromBranch: string, tabId: string) {
    const suffix = tabId.slice(-4).replace(/[^a-zA-Z0-9_-]/g, "");
    const safeBase = fromBranch.replace(/[^a-zA-Z0-9/_-]/g, "-");
    return `${safeBase}-tab-${suffix || "copy"}`;
}

function hashString(value: string) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function countLineDiff(original: string, modified: string) {
    if (original === modified) return { added: 0, removed: 0 };

    const a = original.split(/\r?\n/);
    const b = modified.split(/\r?\n/);
    const lcs = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));

    for (let i = 1; i <= a.length; i += 1) {
        for (let j = 1; j <= b.length; j += 1) {
            if (a[i - 1] === b[j - 1]) {
                lcs[i][j] = lcs[i - 1][j - 1] + 1;
                continue;
            }
            lcs[i][j] = lcs[i - 1][j] > lcs[i][j - 1] ? lcs[i - 1][j] : lcs[i][j - 1];
        }
    }

    const commonLines = lcs[a.length][b.length];
    return {
        added: b.length - commonLines,
        removed: a.length - commonLines,
    };
}

export function ResumeProvider(props: { children?: JSXElement }) {
    const { status } = useGithubAuth();
    const {
        selectedRepository,
        selectedBranch,
        createBranchFromSelected,
    } = useGithubRepository();
    const tabs = useBrowserTabs();

    const [persistedState, setPersistedState] = makePersisted(createSignal<ResumePersistenceState>(createInitialState()), {
        name: RESUME_STATE_STORAGE_KEY,
        storage: localStorage,
        sync: storageSync,
    });

    const [isDiffMode, setDiffMode] = createSignal(false);
    const [currentBranchDiff, setCurrentBranchDiff] = createSignal<ResumeDiff>(ZERO_DIFF);
    const diffCache = new Map<string, ResumeDiff>();
    let activeRemoteFetchVersion = 0;
    const promptedRepoKeys = new Set<string>();

    const activeGithubRepository = createMemo(() => {
        if (status() !== "authenticated") return null;
        return selectedRepository();
    });

    const activeWorkspaceDescriptor = createMemo<WorkspaceDescriptor>(() => {
        const repository = activeGithubRepository();
        if (!repository) return { kind: "local" };
        return {
            kind: "github",
            owner: repository.owner,
            repo: repository.repo,
        };
    });

    const activeWorkspaceKey = createMemo(() => {
        const repository = activeGithubRepository();
        if (!repository) return LOCAL_WORKSPACE_KEY;
        return buildGithubWorkspaceKey(repository.owner, repository.repo);
    });

    const activeBranchName = createMemo(() => {
        const repository = activeGithubRepository();
        if (!repository) return LOCAL_BRANCH_NAME;
        return selectedBranch()?.name ?? repository.defaultBranch;
    });

    const activeScopeKey = createMemo(() => `${activeWorkspaceKey()}#${activeBranchName()}`);

    const mutatePersistedState = (mutator: (draft: ResumePersistenceState) => void) => {
        setPersistedState((current) => {
            const draft = clonePersistenceState(current);
            mutator(draft);
            return draft;
        });
    };

    const getBranchStateFromSnapshot = (
        snapshot: ResumePersistenceState,
        workspaceKey: string,
        branchName: string,
    ): BranchResumeState | null => {
        return snapshot.workspaces[workspaceKey]?.branches[branchName] ?? null;
    };

    const readActiveBranchSnapshot = () => {
        const snapshot = untrack(persistedState);
        return getBranchStateFromSnapshot(snapshot, activeWorkspaceKey(), activeBranchName()) ?? createBranchState();
    };

    const computeDiffWithCache = (source: ResumeDocuments, working: ResumeDocuments): ResumeDiff => {
        if (isSameDocuments(source, working)) return ZERO_DIFF;

        const cacheKey = [
            hashString(source.markdown),
            source.markdown.length,
            hashString(working.markdown),
            working.markdown.length,
            hashString(source.css),
            source.css.length,
            hashString(working.css),
            working.css.length,
        ].join(":");

        const cached = diffCache.get(cacheKey);
        if (cached) return cached;

        const markdownDiff = countLineDiff(source.markdown, working.markdown);
        const cssDiff = countLineDiff(source.css, working.css);

        const result: ResumeDiff = {
            added: markdownDiff.added + cssDiff.added,
            removed: markdownDiff.removed + cssDiff.removed,
            hasChanges: true,
        };

        if (diffCache.size >= DIFF_CACHE_MAX_ENTRIES) diffCache.clear();
        diffCache.set(cacheKey, result);
        return result;
    };

    const ensureActiveBranchRegistered = () => {
        const workspaceKey = activeWorkspaceKey();
        const branchName = activeBranchName();
        const descriptor = activeWorkspaceDescriptor();

        mutatePersistedState((draft) => {
            const workspace = getOrCreateWorkspaceMutable(draft, workspaceKey, descriptor);
            const branch = getOrCreateBranchMutable(workspace, branchName);
            branch.lastAccessedAt = Date.now();
        });
    };

    createEffect(
        on(
            activeScopeKey,
            (nextScopeKey, previousScopeKey) => {
                if (!previousScopeKey) return;

                const nextScope = parseScopeKey(nextScopeKey);
                const previousScope = parseScopeKey(previousScopeKey);
                if (!nextScope || !previousScope) return;

                if (previousScope.workspaceKey !== LOCAL_WORKSPACE_KEY) return;
                if (!nextScope.workspaceKey.startsWith("gh:")) return;

                const snapshot = untrack(persistedState);
                const existingTarget = getBranchStateFromSnapshot(
                    snapshot,
                    nextScope.workspaceKey,
                    nextScope.branchName,
                );
                if (existingTarget) return;

                const previousBranch = getBranchStateFromSnapshot(
                    snapshot,
                    previousScope.workspaceKey,
                    previousScope.branchName,
                );
                if (!previousBranch || !isBranchDirtyState(previousBranch)) return;

                const descriptor = untrack(activeWorkspaceDescriptor);
                if (descriptor.kind !== "github") return;

                mutatePersistedState((draft) => {
                    const workspace = getOrCreateWorkspaceMutable(draft, nextScope.workspaceKey, descriptor);
                    if (workspace.branches[nextScope.branchName]) return;

                    workspace.branches[nextScope.branchName] = {
                        source: cloneDocuments(previousBranch.source),
                        working: cloneDocuments(previousBranch.working),
                        remote: null,
                        lastAccessedAt: Date.now(),
                    };
                });
            },
            { defer: true },
        ),
    );

    createEffect(() => {
        ensureActiveBranchRegistered();
    });

    createEffect(() => {
        tabs.announceWorkspace(activeWorkspaceKey(), activeBranchName());
    });

    createEffect(() => {
        const repository = activeGithubRepository();
        if (!repository) return;
        if (!tabs.isFreshTab() || !tabs.hasOtherTabsAtOpen()) return;

        tabs.registryRevision();
        const repoKey = buildGithubWorkspaceKey(repository.owner, repository.repo);
        if (promptedRepoKeys.has(repoKey)) return;

        const peers = tabs.getPeersByRepo(repoKey);
        if (!peers.length) return;

        promptedRepoKeys.add(repoKey);

        const shouldKeepInSync = window.confirm(
            `${repository.owner}/${repository.repo} is already open in another tab.\n\n` +
                "Press OK to keep editing this repo in sync.\n" +
                "Press Cancel to create a new branch for this tab.",
        );

        if (shouldKeepInSync) return;

        const fromBranch = selectedBranch()?.name ?? repository.defaultBranch;
        const suggestedName = suggestBranchName(fromBranch, tabs.tabId());
        const branchName = sanitizeBranchName(
            window.prompt(`Name for a new branch from "${fromBranch}":`, suggestedName),
        );

        if (!branchName) return;

        createBranchFromSelected(branchName).catch((error) => {
            const message = error instanceof Error ? error.message : "Failed to create a branch";
            window.alert(message);
        });
    });

    createEffect(
        on(
            [activeGithubRepository, activeBranchName, () => selectedBranch()?.commitSha ?? null],
            async ([repository, branchName, commitSha]) => {
                if (!repository) return;

                const workspaceKey = buildGithubWorkspaceKey(repository.owner, repository.repo);
                const snapshot = untrack(persistedState);
                const existingBranch = getBranchStateFromSnapshot(snapshot, workspaceKey, branchName);

                const shouldFetch =
                    !existingBranch?.remote ||
                    existingBranch.remote.ref !== branchName ||
                    !existingBranch.remote.commitSha ||
                    !commitSha ||
                    existingBranch.remote.commitSha !== commitSha;

                if (!shouldFetch) return;

                const requestVersion = ++activeRemoteFetchVersion;

                try {
                    const response = await api<GithubResumeResponse>(
                        `/api/github/repo/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}` +
                            `/resume?ref=${encodeURIComponent(branchName)}`,
                    );

                    if (requestVersion !== activeRemoteFetchVersion) return;

                    const currentSnapshot = untrack(persistedState);
                    const currentBranchState =
                        getBranchStateFromSnapshot(currentSnapshot, workspaceKey, branchName) ?? createBranchState();

                    const remoteDocuments: ResumeDocuments = {
                        markdown: response.markdown?.content ?? currentBranchState.source.markdown,
                        css: response.stylesheet?.content ?? currentBranchState.source.css,
                    };

                    const sourceChanged = !isSameDocuments(currentBranchState.source, remoteDocuments);
                    const branchIsDirty = isBranchDirtyState(currentBranchState);

                    let keepLocalWorkingCopy = false;
                    if (branchIsDirty && sourceChanged) {
                        keepLocalWorkingCopy = !window.confirm(
                            `Fetched newer resume files from ${repository.owner}/${repository.repo} (${branchName}).\n\n` +
                                "Press OK to replace your local unsaved edits.\n" +
                                "Press Cancel to keep your current local edits.",
                        );
                    }

                    mutatePersistedState((draft) => {
                        const descriptor: WorkspaceDescriptor = {
                            kind: "github",
                            owner: repository.owner,
                            repo: repository.repo,
                        };
                        const workspace = getOrCreateWorkspaceMutable(draft, workspaceKey, descriptor);
                        const branch = getOrCreateBranchMutable(workspace, branchName);

                        branch.source = cloneDocuments(remoteDocuments);
                        branch.remote = {
                            ref: branchName,
                            commitSha: commitSha ?? null,
                            markdownPath: response.markdown?.path ?? null,
                            cssPath: response.stylesheet?.path ?? null,
                            fetchedAt: Date.now(),
                        };
                        branch.lastAccessedAt = Date.now();

                        if (!keepLocalWorkingCopy) {
                            branch.working = cloneDocuments(remoteDocuments);
                        }
                    });
                } catch (error) {
                    if (!import.meta.env.PROD) {
                        console.error("Failed to fetch remote resume files", error);
                    }
                }
            },
            { defer: true },
        ),
    );

    const activeBranchState = createMemo(() => {
        const snapshot = persistedState();
        return (
            getBranchStateFromSnapshot(snapshot, activeWorkspaceKey(), activeBranchName()) ?? createBranchState()
        );
    });

    const markdown = createMemo(() => activeBranchState().working.markdown);
    const css = createMemo(() => activeBranchState().working.css);
    const sourceMarkdown = createMemo(() => activeBranchState().source.markdown);
    const sourceCss = createMemo(() => activeBranchState().source.css);
    const isCurrentBranchDirty = createMemo(() => isBranchDirtyState(activeBranchState()));

    const setCurrentWorkingDocuments = (updater: (working: ResumeDocuments) => ResumeDocuments) => {
        const workspaceKey = untrack(activeWorkspaceKey);
        const branchName = untrack(activeBranchName);
        const descriptor = untrack(activeWorkspaceDescriptor);

        mutatePersistedState((draft) => {
            const workspace = getOrCreateWorkspaceMutable(draft, workspaceKey, descriptor);
            const branch = getOrCreateBranchMutable(workspace, branchName);
            branch.working = updater(branch.working);
            branch.lastAccessedAt = Date.now();
        });
    };

    const setMarkdown: Setter<string> = (value) => {
        const previous = untrack(markdown);
        const next = typeof value === "function" ? (value as (prev: string) => string)(previous) : value;
        setCurrentWorkingDocuments((working) => ({
            ...working,
            markdown: next,
        }));
        return next;
    };

    const setCss: Setter<string> = (value) => {
        const previous = untrack(css);
        const next = typeof value === "function" ? (value as (prev: string) => string)(previous) : value;
        setCurrentWorkingDocuments((working) => ({
            ...working,
            css: next,
        }));
        return next;
    };

    const resetCurrentBranchToSource = () => {
        const workspaceKey = untrack(activeWorkspaceKey);
        const branchName = untrack(activeBranchName);
        const descriptor = untrack(activeWorkspaceDescriptor);

        mutatePersistedState((draft) => {
            const workspace = getOrCreateWorkspaceMutable(draft, workspaceKey, descriptor);
            const branch = getOrCreateBranchMutable(workspace, branchName);
            branch.working = cloneDocuments(branch.source);
            branch.lastAccessedAt = Date.now();
        });
    };

    const getBranchDiff = (branchName: string) => {
        const snapshot = persistedState();
        const branchState = getBranchStateFromSnapshot(snapshot, activeWorkspaceKey(), branchName);
        if (!branchState) return ZERO_DIFF;
        return computeDiffWithCache(branchState.source, branchState.working);
    };

    const isBranchDirty = (branchName: string) => {
        const snapshot = persistedState();
        const branchState = getBranchStateFromSnapshot(snapshot, activeWorkspaceKey(), branchName);
        if (!branchState) return false;
        return isBranchDirtyState(branchState);
    };

    const updateCurrentDiffDebounced = debounce((source: ResumeDocuments, working: ResumeDocuments) => {
        setCurrentBranchDiff(computeDiffWithCache(source, working));
    }, CURRENT_DIFF_DEBOUNCE_MS);

    createEffect(
        on(activeScopeKey, () => {
            const snapshot = readActiveBranchSnapshot();
            setCurrentBranchDiff(computeDiffWithCache(snapshot.source, snapshot.working));
        }),
    );

    createEffect(() => {
        const snapshot = activeBranchState();
        updateCurrentDiffDebounced(snapshot.source, snapshot.working);
    });

    createEffect(() => {
        if (isCurrentBranchDirty()) return;
        setDiffMode(false);
    });

    onMount(() => {
        const snapshot = readActiveBranchSnapshot();
        setCurrentBranchDiff(computeDiffWithCache(snapshot.source, snapshot.working));
    });

    onCleanup(() => {
        updateCurrentDiffDebounced.clear();
    });

    const toggleDiffMode = () => {
        if (!isCurrentBranchDirty()) {
            setDiffMode(false);
            return;
        }
        setDiffMode((value) => !value);
    };

    return (
        <ResumeContext.Provider
            value={{
                css,
                setCss,
                markdown,
                setMarkdown,
                sourceCss,
                sourceMarkdown,
                isCurrentBranchDirty,
                diffForCurrentBranch: currentBranchDiff,
                getBranchDiff,
                isBranchDirty,
                resetCurrentBranchToSource,
                isDiffMode,
                setDiffMode,
                toggleDiffMode,
            }}
        >
            {props.children}
        </ResumeContext.Provider>
    );
}

export function useResume() {
    const context = useContext(ResumeContext);
    if (!context) throw new Error("useResume must be used within a ResumeProvider");
    return context;
}

export type { ResumeDiff };
