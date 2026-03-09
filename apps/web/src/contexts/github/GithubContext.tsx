import { createContext, createEffect, createMemo, useContext, type Accessor, type JSXElement } from "solid-js";
import type {
    GithubUser,
    BootstrapResponse,
    BranchesResponse,
    RepositoryInformation,
    BranchInformation,
    FilesResponse,
} from "@resumd/api/types";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/solid-query";
import { ApiError, apiFetch, withSearch } from "@/lib/fetch";
import { useNavigate, useParams, useSearchParams } from "@solidjs/router";

const GithubContext = createContext<{
    user: Accessor<GithubUser | null | undefined>;
    repositories: Accessor<RepositoryInformation[] | undefined>;
    refreshSession: () => Promise<void>;
    branches: Accessor<BranchInformation[] | undefined>;
    remoteMarkdown: Accessor<string | null>;
    remoteCss: Accessor<string | null>;

    selectedRepository: Accessor<RepositoryInformation | null>;
    setSelectedRepository: (repo: RepositoryInformation) => void;
    selectedBranch: Accessor<BranchInformation | null>;
    setSelectedBranch: (branch: BranchInformation) => void;
}>();

export function GithubProvider(props: { children?: JSXElement }) {
    const navigate = useNavigate();

    const queryClient = useQueryClient();

    const params = useParams<{ owner: string; repo: string }>();
    const normalizeParam = (value: string | undefined) => {
        const normalized = value?.trim();
        return normalized ? normalized : undefined;
    };

    const initialOwner = normalizeParam(params.owner);
    const initialRepo = normalizeParam(params.repo);
    const initialRouteRepository = initialOwner && initialRepo ? { owner: initialOwner, repo: initialRepo } : null;

    const routeRepository = createMemo(() => {
        const owner = normalizeParam(params.owner);
        const repo = normalizeParam(params.repo);
        if (!owner || !repo) return null;
        return { owner, repo };
    });

    const [searchParams, setSearchParams] = useSearchParams<{ branch?: string }>();
    const searchParamsBranch = createMemo(() => searchParams.branch?.trim() || undefined);

    /// Initial fetching

    const bootstrapQuery = useQuery(() => ({
        queryKey: ["github", "session"],
        queryFn: () =>
            apiFetch<BootstrapResponse>(
                withSearch("/api/bootstrap", {
                    owner: initialOwner,
                    repo: initialRepo,
                }),
            ),
        retry: false,
        staleTime: 0,
        placeholderData: keepPreviousData,
    }));

    createEffect(() => {
        const selected = bootstrapQuery.data?.selected;
        if (!selected) return;

        queryClient.setQueryData<BranchesResponse>(
            ["branches", selected.repository.owner, selected.repository.repo],
            (current) => current ?? { branches: selected.branches },
        );
    });

    const user = createMemo(() => {
        if (bootstrapQuery.isLoading) return undefined;
        return bootstrapQuery.data?.user ?? null;
    });

    const refreshSession = async () => {
        await bootstrapQuery.refetch();
    };

    /// Repository

    const repositories = createMemo(() => bootstrapQuery.data?.repositories.items);

    const selectedRepository = createMemo(() => {
        const repos = repositories();
        const selectedRouteRepository = routeRepository();
        if (!selectedRouteRepository) return null;

        const bootstrappedRepo = bootstrapQuery.data?.selected?.repository;
        if (!repos?.length) {
            if (
                bootstrappedRepo &&
                bootstrappedRepo.owner === selectedRouteRepository.owner &&
                bootstrappedRepo.repo === selectedRouteRepository.repo
            ) {
                return bootstrappedRepo;
            }

            return null;
        }

        const matchedRouteRepository = repos.find(
            (repository) =>
                repository.owner === selectedRouteRepository.owner && repository.repo === selectedRouteRepository.repo,
        );
        if (matchedRouteRepository) return matchedRouteRepository;

        if (
            bootstrappedRepo &&
            bootstrappedRepo.owner === selectedRouteRepository.owner &&
            bootstrappedRepo.repo === selectedRouteRepository.repo
        ) {
            return bootstrappedRepo;
        }

        return null;
    });

    const setSelectedRepository = (repo: RepositoryInformation) => {
        navigate(`/${repo.owner}/${repo.repo}`);
    };

    /// Branch

    const branchesQuery = useQuery(() => {
        const repo = routeRepository();
        const waitForBootstrap =
            !!repo &&
            !!initialRouteRepository &&
            repo.owner === initialRouteRepository.owner &&
            repo.repo === initialRouteRepository.repo &&
            bootstrapQuery.isLoading;

        return {
            queryKey: repo ? (["branches", repo.owner, repo.repo] as const) : (["branches", null, null] as const),
            enabled: !!repo && !waitForBootstrap,
            queryFn: async () => {
                if (!repo) throw new Error("No repository selected");
                return apiFetch<BranchesResponse>(
                    withSearch("/api/branches", {
                        owner: repo.owner,
                        repo: repo.repo,
                    }),
                );
            },
            staleTime: 60_000, // TODO: Consider making 0
        };
    });

    const branches = createMemo(() => branchesQuery.data?.branches.items);
    const getFallbackBranch = (branchList: BranchInformation[]) =>
        branchList.find((branch) => branch.isDefault) ?? branchList[0] ?? null;

    createEffect(() => {
        const repo = routeRepository();
        if (!repo) return;

        const error = branchesQuery.error;
        if (!(error instanceof ApiError) || (error.status !== 403 && error.status !== 404)) {
            return;
        }

        const availableRepositories = repositories();
        if (!availableRepositories) return;

        const fallbackRepository = availableRepositories[0];
        if (!fallbackRepository) {
            navigate("/", { replace: true });
            return;
        }

        if (fallbackRepository.owner === repo.owner && fallbackRepository.repo === repo.repo) {
            return;
        }

        navigate(`/${fallbackRepository.owner}/${fallbackRepository.repo}`, { replace: true });
    });

    const selectedBranch = createMemo(() => {
        // Explicit ?branch=... wins if it exists; otherwise fallback to default branch; otherwise fallback to first branch
        const branches = branchesQuery.data?.branches.items ?? [];
        if (!branches.length) return null;

        const searchBranch = searchParamsBranch();
        if (searchBranch) {
            const found = branches.find((b) => b.name === searchBranch);
            if (found) return found;
        }

        return getFallbackBranch(branches);
    });

    createEffect(() => {
        const branchFromUrl = searchParamsBranch();
        if (!branchFromUrl) return;

        const branchList = branchesQuery.data?.branches.items;
        if (!branchList?.length) return;
        if (branchList.some((branch) => branch.name === branchFromUrl)) return;

        const fallbackBranch = getFallbackBranch(branchList);
        if (!fallbackBranch) return;

        setSearchParams({ branch: fallbackBranch.name }, { replace: true });
    });

    const setSelectedBranch = (branch: BranchInformation) => {
        setSearchParams({ branch: branch.name }, { replace: true });
    };

    /// Files

    const filesQuery = useQuery(() => {
        const repo = routeRepository();
        const branch = selectedBranch();
        const branchName = branch?.name;

        return {
            queryKey:
                repo && branchName
                    ? (["files", repo.owner, repo.repo, branchName] as const)
                    : (["files", null, null, null] as const),
            enabled: !!repo && !!branchName,
            queryFn: async () => {
                if (!repo || !branchName) throw new Error("Repository or branch not resolved");

                return apiFetch<FilesResponse>(
                    withSearch("/api/files", {
                        owner: repo.owner,
                        repo: repo.repo,
                        branch: branchName,
                    }),
                );
            },
            staleTime: 60_000, // TODO: Consider making 0
        };
    });

    const remoteMarkdown = createMemo(() => filesQuery.data?.files.markdown?.content ?? null);
    const remoteCss = createMemo(() => filesQuery.data?.files.css?.content ?? null);

    return (
        <GithubContext.Provider
            value={{
                user,
                repositories,
                refreshSession,
                branches,
                remoteMarkdown,
                remoteCss,
                selectedBranch,
                setSelectedBranch,
                selectedRepository,
                setSelectedRepository,
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

export const login = (owner: string, repo: string, returnTo: string) => {
    const query = new URLSearchParams({
        owner,
        repo,
        returnTo,
    });

    window.location.assign(`/api/auth/start?${query.toString()}`);
};

export const logout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
};
