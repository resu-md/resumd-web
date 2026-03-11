import { createContext, createEffect, createMemo, useContext, type Accessor, type JSXElement } from "solid-js";
import type {
    GithubUser,
    BootstrapResponse,
    BranchInformation,
    RepositoryInformation,
    FilesResponse,
} from "@resumd/api/types";
import { useQuery } from "@tanstack/solid-query";
import { ApiError, apiFetch, withSearch } from "@/lib/fetch";
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
    logout: () => Promise<void>;
}>();

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

    const filesQuery = useQuery(() => {
        const repo = selectedRepository();
        const branchName = selectedBranch()?.name;

        return {
            queryKey:
                repo && branchName
                    ? (["files", repo.owner, repo.repo, branchName] as const)
                    : (["files", null, null, null] as const),
            enabled: !!repo && !!branchName,
            queryFn: async () => {
                if (!repo || !branchName) throw new Error("Repository or branch not resolved");

                return apiFetch<FilesResponse>(
                    withSearch("/api/files", { owner: repo.owner, repo: repo.repo, branch: branchName }),
                );
            },
            staleTime: 60_000,
        };
    });

    const remoteMarkdown = createMemo(() => filesQuery.data?.files.markdown?.content ?? null);
    const remoteMarkdownPath = createMemo(() => filesQuery.data?.files.markdown?.path ?? null);
    const remoteCss = createMemo(() => filesQuery.data?.files.css?.content ?? null);
    const remoteCssPath = createMemo(() => filesQuery.data?.files.css?.path ?? null);
    const remoteHeadSha = createMemo(() => filesQuery.data?.branch.commitSha);

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

export const login = (returnTo?: string) => {
    const normalizedReturnTo = returnTo?.trim();
    const query = new URLSearchParams();

    if (normalizedReturnTo) {
        query.set("returnTo", normalizedReturnTo);
    }

    const loginUrl = query.size > 0 ? `/api/auth/start?${query.toString()}` : "/api/auth/start";
    window.location.assign(loginUrl);
};
