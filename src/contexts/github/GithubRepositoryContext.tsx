import {
    createContext,
    createEffect,
    createMemo,
    createResource,
    createSignal,
    useContext,
    type Accessor,
    type JSXElement,
    type Resource,
} from "solid-js";
import { useLocation, useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { useGithubAuth } from "./GithubAuthContext";
import { makePersisted } from "@solid-primitives/storage";
import { GITHUB_STORAGE_KEYS } from "@/lib/storage-keys";

export type GithubBranch = {
    name: string;
    commitSha?: string;
    isDefault: boolean;
};

export type GithubRepository = {
    owner: string;
    repo: string;
    fullName: string;
    installationId: number;
    defaultBranch: string;
    branches: GithubBranch[];
};

type GithubLastSelection = {
    owner: string;
    repo: string;
    branch: string;
};

const GithubRepositoryContext = createContext<{
    repositories: Resource<GithubRepository[] | undefined>;
    selectedRepository: Accessor<GithubRepository | null>;
    setSelectedRepository: (repo: GithubRepository, branchName?: string) => void;
    selectedBranch: Accessor<GithubBranch | null>;
    setSelectedBranch: (branchName: string) => void;
    // Remote calls
    handleManageRepositories: () => void;
    createBranchFromSelected: (branchName: string) => Promise<void>;
}>();

export function GithubRepositoryProvider(props: { children?: JSXElement }) {
    const { status, api } = useGithubAuth();

    const location = useLocation();
    const params = useParams<{ owner?: string; repo?: string }>();
    const [searchParams, setSearchParams] = useSearchParams<{ branch?: string }>();
    const navigate = useNavigate();

    const urlOwner = () => params.owner ?? null;
    const urlRepo = () => params.repo ?? null;
    const urlBranch = () => searchParams.branch ?? null;
    const isRepositoryRoute = () => urlOwner() !== null && urlRepo() !== null;

    const [lastSelection, setLastSelection] = makePersisted(createSignal<GithubLastSelection | null>(null), {
        name: GITHUB_STORAGE_KEYS.LAST_SELECTION,
        storage: localStorage,
    });

    const [repositoriesResource, { refetch: refetchRepositories }] = createResource(
        () => (status() === "authenticated" ? "authenticated" : null),
        async () => {
            const result = await api<{ repos: GithubRepository[] }>("/api/github/installations/branches");
            return result.repos;
        },
        {
            storage: (init) => {
                const [repositories, setRepositories] = makePersisted(
                    createSignal<GithubRepository[] | undefined>(init),
                    {
                        name: GITHUB_STORAGE_KEYS.REPOSITORIES,
                        storage: localStorage,
                    },
                );
                return [repositories, setRepositories];
            },
        },
    );

    const selectedRepository = createMemo(() => {
        const repos = repositoriesResource();
        if (!repos || repos.length === 0) return null;

        const owner = urlOwner();
        const repo = urlRepo();

        if (owner && repo) {
            return repos.find((item) => item.owner === owner && item.repo === repo) ?? null;
        }

        const remembered = lastSelection();
        if (remembered) {
            const rememberedRepo = repos.find(
                (item) => item.owner === remembered.owner && item.repo === remembered.repo,
            );
            if (rememberedRepo) return rememberedRepo;
        }

        return repos[0] ?? null;
    });

    const selectedBranch = createMemo(() => {
        const repo = selectedRepository();
        if (!repo) return null;

        const branchNameFromUrl = urlBranch();

        if (isRepositoryRoute()) {
            return (
                (branchNameFromUrl ? repo.branches.find((branch) => branch.name === branchNameFromUrl) : null) ||
                repo.branches.find((branch) => branch.isDefault) ||
                null
            );
        }

        const remembered = lastSelection();
        if (remembered && remembered.owner === repo.owner && remembered.repo === repo.repo) {
            const rememberedBranch = repo.branches.find((branch) => branch.name === remembered.branch);
            if (rememberedBranch) return rememberedBranch;
        }

        return repo.branches.find((branch) => branch.isDefault) || null;
    });

    const resolveBranchNameForRepository = (repo: GithubRepository, branchName?: string): string | null => {
        if (branchName) {
            return repo.branches.find((branch) => branch.name === branchName)?.name ?? null;
        }

        const remembered = lastSelection();
        if (remembered && remembered.owner === repo.owner && remembered.repo === repo.repo) {
            const rememberedBranch = repo.branches.find((branch) => branch.name === remembered.branch);
            if (rememberedBranch) return rememberedBranch.name;
        }

        return repo.branches.find((branch) => branch.isDefault)?.name ?? null;
    };

    const setSelectedRepository = (repo: GithubRepository, branchName?: string) => {
        const nextSearchParams = new URLSearchParams(location.search);
        const resolvedBranchName = resolveBranchNameForRepository(repo, branchName);

        if (resolvedBranchName) nextSearchParams.set("branch", resolvedBranchName);
        else nextSearchParams.delete("branch");

        const search = nextSearchParams.toString();
        navigate(`/${repo.owner}/${repo.repo}${search ? `?${search}` : ""}`);
    };

    const setSelectedBranch = (branchName: string) => {
        const repo = selectedRepository();
        if (!repo) return;

        if (isRepositoryRoute()) {
            setSearchParams({ branch: branchName });
            return;
        }

        setSelectedRepository(repo, branchName);
    };

    createEffect(() => {
        if (status() !== "authenticated") return;
        if (!isRepositoryRoute()) return;

        const repo = selectedRepository();
        if (!repo) return;

        const branch = selectedBranch();
        const selectedBranchName = branch?.name ?? null;

        if (urlBranch() === selectedBranchName) return;

        setSearchParams({ branch: selectedBranchName ?? undefined }, { replace: true });
    });

    createEffect(() => {
        if (status() !== "authenticated") return;
        if (!isRepositoryRoute()) return;

        const repo = selectedRepository();
        const branch = selectedBranch();
        if (!repo || !branch) return;

        setLastSelection({
            owner: repo.owner,
            repo: repo.repo,
            branch: branch.name,
        });
    });

    // Remote calls

    const handleManageRepositories = () => {
        window.location.href = "/api/github/installations/manage";
    };

    const createBranchFromSelected = async (newBranchName: string) => {
        const repo = selectedRepository();
        if (!repo) throw new Error("No repository selected");

        const branch = selectedBranch();
        const fromBranch = branch?.name ?? repo.defaultBranch;

        await api<{ ok: boolean; branch: GithubBranch }>(
            `/api/github/repo/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/branches`,
            {
                method: "POST",
                body: JSON.stringify({ name: newBranchName, from: fromBranch }),
            },
        );
        await refetchRepositories();

        setSelectedRepository(repo, newBranchName);
    };

    return (
        <GithubRepositoryContext.Provider
            value={{
                repositories: repositoriesResource,
                selectedRepository,
                setSelectedRepository,
                selectedBranch,
                setSelectedBranch,
                // Remote calls
                handleManageRepositories,
                createBranchFromSelected,
            }}
        >
            {props.children}
        </GithubRepositoryContext.Provider>
    );
}

export function useGithubRepository() {
    const context = useContext(GithubRepositoryContext);
    if (!context) throw new Error("useGithubRepository must be used within a GithubRepositoryProvider");
    return context;
}
