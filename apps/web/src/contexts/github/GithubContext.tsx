import { createContext, createEffect, createMemo, useContext, type Accessor, type JSXElement } from "solid-js";
import type {
    GithubUser,
    BootstrapResponse,
    BranchInformation,
    RepositoryInformation,
    FilesResponse,
} from "@resumd/api/types";
import { useQuery } from "@tanstack/solid-query";
import { ApiError, apiFetch, apiUrl, withSearch } from "@/lib/fetch";
import { useNavigate, useParams, useSearchParams } from "@solidjs/router";
import queryClient, { clearPersistedQueryClient } from "@/lib/query-client";

const GithubContext = createContext<{
    user: Accessor<GithubUser | null | undefined>;
    selectedRepository: Accessor<RepositoryInformation | null>;
    branches: Accessor<BranchInformation[]>;
    selectedBranch: Accessor<BranchInformation | null>;
    isReloadingBranches: Accessor<boolean>;
    reloadBranches: () => Promise<void>;
    setSelectedBranch: (branch: BranchInformation) => void;
    remoteMarkdown: Accessor<string | null>;
    remoteMarkdownPath: Accessor<string | null>;
    remoteCss: Accessor<string | null>;
    remoteCssPath: Accessor<string | null>;
    remoteHeadSha: Accessor<string | undefined>;
    refetchFiles: () => Promise<void>;
    blockEditor: Accessor<boolean>;
    logout: () => Promise<void>;
}>();

type LoginGuardState = {
    returnTo: string;
    lastAttemptAt: number;
    blocked: boolean;
};

export type LoginResult = {
    redirected: boolean;
    blocked: boolean;
    reason?: string;
};

const LOGIN_GUARD_STORAGE_KEY = "resumd_login_guard";
const LOGIN_GUARD_TTL_MS = 60_000;
const LOGIN_GUARD_MESSAGE =
    "Login keeps failing, so automatic redirects were paused to avoid a loop. Please try again.";

function normalizeReturnToKey(value: string | undefined): string {
    const normalized = value?.trim();
    return normalized ? normalized : "/";
}

function readLoginGuard(): LoginGuardState | null {
    if (typeof window === "undefined") return null;

    try {
        const raw = window.sessionStorage.getItem(LOGIN_GUARD_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as LoginGuardState;

        if (
            typeof parsed !== "object" ||
            !parsed ||
            typeof parsed.returnTo !== "string" ||
            typeof parsed.lastAttemptAt !== "number" ||
            typeof parsed.blocked !== "boolean"
        ) {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

function writeLoginGuard(state: LoginGuardState): void {
    if (typeof window === "undefined") return;

    try {
        window.sessionStorage.setItem(LOGIN_GUARD_STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Ignore storage failures (private mode, etc).
    }
}

export function clearLoginGuard(returnTo?: string): void {
    if (typeof window === "undefined") return;

    if (!returnTo) {
        window.sessionStorage.removeItem(LOGIN_GUARD_STORAGE_KEY);
        return;
    }

    const guard = readLoginGuard();
    if (!guard) return;

    const key = normalizeReturnToKey(returnTo);
    if (guard.returnTo === key) {
        window.sessionStorage.removeItem(LOGIN_GUARD_STORAGE_KEY);
    }
}

// TODO: Needs a good refactor

export function GithubProvider(props: { children?: JSXElement }) {
    const navigate = useNavigate();
    const params = useParams<{ owner: string; repo: string }>();

    const normalizeParam = (value: string | undefined) => {
        const normalized = value?.trim();
        return normalized ? normalized : undefined;
    };

    const routeRepository = createMemo(() => {
        const owner = normalizeParam(params.owner);
        const repo = normalizeParam(params.repo);
        if (!owner || !repo) return null;

        return { owner, repo };
    });

    const [searchParams, setSearchParams] = useSearchParams<{ branch?: string }>();
    const searchParamsBranch = createMemo(() => searchParams.branch?.trim() || undefined);

    const bootstrapQuery = useQuery(() => {
        const repo = routeRepository();
        return {
            queryKey: repo
                ? (["github", "bootstrap", repo.owner, repo.repo] as const)
                : (["github", "bootstrap", null, null] as const),
            queryFn: () =>
                apiFetch<BootstrapResponse>(withSearch("/api/bootstrap", { owner: repo?.owner, repo: repo?.repo })),
            retry: false,
            staleTime: 0,
        };
    });

    createEffect(() => {
        const repo = routeRepository();
        if (!repo) return;

        const error = bootstrapQuery.error;
        if (!(error instanceof ApiError)) return;

        if (error.status === 403 || error.status === 404 || error.status === 409) {
            navigate("/manage", { replace: true });
        }
    });

    const user = createMemo(() => {
        if (bootstrapQuery.isLoading) return undefined;

        // TODO: Needed? Shouldn't it be globally handled by the queryClient?
        const error = bootstrapQuery.error;
        if (error instanceof ApiError) {
            if (error.status === 401) {
                return null;
            }

            return undefined;
        }

        return bootstrapQuery.data?.user ?? null;
    });

    createEffect(() => {
        const resolvedUser = user();
        if (resolvedUser) {
            clearLoginGuard();
        }
    });

    const selectedRepository = createMemo(() => bootstrapQuery.data?.selected?.repository ?? null);

    const branches = createMemo(() => bootstrapQuery.data?.selected?.branches.items ?? []);
    const getFallbackBranch = (branchList: BranchInformation[]) =>
        branchList.find((branch) => branch.isDefault) ?? branchList[0] ?? null;

    const selectedBranch = createMemo(() => {
        const branchList = branches() ?? [];
        if (!branchList.length) return null;

        const searchBranch = searchParamsBranch();
        if (searchBranch) {
            const found = branchList.find((branch) => branch.name === searchBranch);
            if (found) return found;
        }

        return getFallbackBranch(branchList);
    });

    const isReloadingBranches = createMemo(() => bootstrapQuery.isRefetching);

    createEffect(() => {
        const branchFromUrl = searchParamsBranch();
        if (!branchFromUrl) return;

        const branchList = branches();
        if (!branchList?.length) return;
        if (branchList.some((branch) => branch.name === branchFromUrl)) return;

        const fallbackBranch = getFallbackBranch(branchList);
        if (!fallbackBranch) return;

        setSearchParams({ branch: fallbackBranch.name }, { replace: true });
    });

    const setSelectedBranch = (branch: BranchInformation) => {
        setSearchParams({ branch: branch.name }, { replace: true });
    };

    const reloadBranches = async () => {
        await bootstrapQuery.refetch();
    };

    const filesWorkspace = createMemo(() => {
        const repo = selectedRepository();
        const branchName = selectedBranch()?.name;

        if (!repo || !branchName) return null;

        return {
            key: ["files", repo.owner, repo.repo, branchName] as const,
            workspaceKey: `${repo.owner}/${repo.repo}:${branchName}`,
            repo,
            branchName,
        };
    });

    const filesQuery = useQuery(() => {
        const workspace = filesWorkspace();

        return {
            queryKey: workspace?.key ?? (["files", null, null, null] as const),
            enabled: !!workspace,
            queryFn: async () => {
                if (!workspace) throw new Error("Repository or branch not resolved");

                return apiFetch<FilesResponse>(
                    withSearch("/api/files", {
                        owner: workspace.repo.owner,
                        repo: workspace.repo.repo,
                        branch: workspace.branchName,
                    }),
                );
            },
            staleTime: 60_000,
        };
    });

    const resolvedFiles = createMemo<{ workspaceKey: string; data: FilesResponse } | null>((previous) => {
        const workspace = filesWorkspace();
        if (!workspace) return null;

        const data = filesQuery.data ?? queryClient.getQueryData<FilesResponse>(workspace.key);
        if (data) {
            return { workspaceKey: workspace.workspaceKey, data };
        }

        return previous ?? null;
    }, null);

    const blockEditor = createMemo(() => {
        const workspace = filesWorkspace();
        if (!workspace) return false;

        return resolvedFiles()?.workspaceKey !== workspace.workspaceKey;
    });

    const remoteMarkdown = createMemo(() => resolvedFiles()?.data.files.markdown?.content ?? null);
    const remoteMarkdownPath = createMemo(() => resolvedFiles()?.data.files.markdown?.path ?? null);
    const remoteCss = createMemo(() => resolvedFiles()?.data.files.css?.content ?? null);
    const remoteCssPath = createMemo(() => resolvedFiles()?.data.files.css?.path ?? null);
    const remoteHeadSha = createMemo(() => resolvedFiles()?.data.branch.commitSha);

    const refetchFiles = async () => {
        const workspace = filesWorkspace();
        if (!workspace) return;

        await queryClient.fetchQuery<FilesResponse>({
            queryKey: [...workspace.key],
            queryFn: () =>
                apiFetch<FilesResponse>(
                    withSearch("/api/files", {
                        owner: workspace.repo.owner,
                        repo: workspace.repo.repo,
                        branch: workspace.branchName,
                    }),
                ),
            staleTime: 0,
        });
    };

    const logout = async () => {
        await queryClient.cancelQueries();
        try {
            navigate("/", { replace: true });
            clearPersistedQueryClient();
            await apiFetch("/api/auth/logout", { method: "POST" });
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    return (
        <GithubContext.Provider
            value={{
                user,
                selectedRepository,
                branches,
                selectedBranch,
                isReloadingBranches,
                reloadBranches,
                setSelectedBranch,
                remoteMarkdown,
                remoteMarkdownPath,
                remoteCss,
                remoteCssPath,
                remoteHeadSha,
                refetchFiles,
                blockEditor,
                logout,
            }}
        >
            {props.children}
        </GithubContext.Provider>
    );
}

export function useGithub() {
    const context = useContext(GithubContext);
    if (!context) throw new Error("useGithubContext must be used within a GithubProvider");
    return context;
}

let loginRedirectInProgress = false;

export const login = (returnTo?: string): LoginResult => {
    if (loginRedirectInProgress) {
        return { redirected: false, blocked: false };
    }

    const normalizedReturnTo = returnTo?.trim();
    const query = new URLSearchParams();

    if (normalizedReturnTo) {
        query.set("returnTo", normalizedReturnTo);
    }

    const loginPath = query.size > 0 ? `/api/auth/start?${query.toString()}` : "/api/auth/start";

    const returnToKey = normalizeReturnToKey(normalizedReturnTo);
    const now = Date.now();
    const guard = readLoginGuard();

    if (guard && guard.returnTo === returnToKey && guard.blocked) {
        console.warn("Login redirect blocked", { returnTo: returnToKey, reason: "blocked_state" });
        return { redirected: false, blocked: true, reason: LOGIN_GUARD_MESSAGE };
    }

    if (guard && guard.returnTo === returnToKey) {
        const isRecent = now - guard.lastAttemptAt < LOGIN_GUARD_TTL_MS;
        if (isRecent) {
            writeLoginGuard({ ...guard, lastAttemptAt: now, blocked: true });
            console.warn("Login redirect blocked", { returnTo: returnToKey, reason: "rapid_retry" });
            return { redirected: false, blocked: true, reason: LOGIN_GUARD_MESSAGE };
        }
    }

    writeLoginGuard({ returnTo: returnToKey, lastAttemptAt: now, blocked: false });
    loginRedirectInProgress = true;
    console.info("Redirecting to login", { returnTo: returnToKey, url: apiUrl(loginPath) });
    window.location.assign(apiUrl(loginPath));
    return { redirected: true, blocked: false };
};
