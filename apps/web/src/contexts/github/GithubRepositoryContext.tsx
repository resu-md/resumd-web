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

const GithubRepositoryContext = createContext<{
    repositories: Resource<GithubRepository[] | undefined>;
    selectedRepository: Accessor<GithubRepository | null>;
    setSelectedRepository: (repo: GithubRepository) => void;
    selectedBranch: Accessor<GithubBranch | null>;
    setSelectedBranch: (branchName: string) => void;
    // Remote calls
    handleManageRepositories: () => void;
    createBranchFromSelected: (branchName: string) => Promise<void>;
}>();

export function GithubRepositoryProvider(props: { children?: JSXElement }) {
    const { authState, api } = useGithubAuth();

    const location = useLocation();
    const params = useParams<{ owner?: string; repo?: string }>();
    const [searchParams, setSearchParams] = useSearchParams<{ branch?: string }>();
    const navigate = useNavigate();

    const urlOwner = () => params.owner ?? null;
    const urlRepo = () => params.repo ?? null;
    const urlBranch = () => searchParams.branch ?? null;

    const [repositoriesResource, { refetch: refetchRepositories }] = createResource(
        () => (authState() === "authenticated" ? "authenticated" : null), // Only fetch repositories when authenticated
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
        if (!repos) return null;

        const owner = urlOwner();
        const repo = urlRepo();

        // Search for exact owner/repo match, else search for owner match, else default to first repo
        return (
            repos.find((r) => r.owner === owner && r.repo === repo) ||
            (owner ? repos.find((r) => r.owner === owner) : null) ||
            repos[0] ||
            null
        );
    });

    const selectedBranch = createMemo(() => {
        const repo = selectedRepository();
        if (!repo) return null;

        const branchName = urlBranch();

        // Search for exact branch match, else default to default branch
        return repo.branches.find((b) => b.name === branchName) || repo.branches.find((b) => b.isDefault) || null;
    });

    const setSelectedRepository = (repo: GithubRepository) => {
        navigate(`/${repo.owner}/${repo.repo}`);
    };

    const setSelectedBranch = (branchName: string) => {
        setSearchParams({ branch: branchName });
    };

    console.log("Selected repository:", selectedRepository());
    console.log("Selected branch:", selectedBranch());

    /**
     * URL synchronization
     */

    // Correct the URL if it doesn't match the selected repository/branch
    createEffect(() => {
        selectedRepository();
        selectedBranch();

        const repos = repositoriesResource();
        if (!repos || repos.length === 0) return;

        const repo = selectedRepository();
        if (!repo) return;

        const branchName = selectedBranch()?.name ?? null;
        const repositoryOutOfSync = urlOwner() !== repo.owner || urlRepo() !== repo.repo;
        const branchOutOfSync = urlBranch() !== branchName;

        if (repositoryOutOfSync || branchOutOfSync) {
            navigate(buildRepositoryUrl(repo, branchName), { replace: true });
        }
    });

    /**
     * Remote calls
     */

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

        setSearchParams({ branch: newBranchName });
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

function buildRepositoryUrl(repo: GithubRepository, branchName: string | null) {
    const path = `/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`;
    return branchName ? `${path}?branch=${encodeURIComponent(branchName)}` : path;
}
