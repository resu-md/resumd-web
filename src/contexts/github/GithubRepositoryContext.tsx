import {
    createContext,
    createEffect,
    createMemo,
    createResource,
    untrack,
    useContext,
    type Accessor,
    type JSXElement,
} from "solid-js";
import { useLocation, useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { useGithubAuth } from "./GithubAuthContext";
import { api } from "@/lib/api";
import { useBrowserTabs } from "../BrowserTabsContext";

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
    repositories: Accessor<GithubRepository[]>;
    isLoadingRepositories: Accessor<boolean>;
    selectedRepository: Accessor<GithubRepository | null>;
    setSelectedRepository: (repo: GithubRepository) => void;
    selectedBranch: Accessor<GithubBranch | null>;
    setSelectedBranch: (branchName: string) => void;
    // Remote calls
    handleManageRepositories: () => void;
    createBranchFromSelected: (branchName: string) => Promise<void>;
}>();

const TAB_REPO_JOIN_PROMPT_PREFIX = "resumd.tabs.joinPrompt";

function joinPromptSessionKey(owner: string, repo: string) {
    return `${TAB_REPO_JOIN_PROMPT_PREFIX}.${owner}/${repo}`;
}

export function GithubRepositoryProvider(props: { children?: JSXElement }) {
    const { status } = useGithubAuth();
    const { tabId, isNewTab, setWorkspace, listOtherTabsForRepo } = useBrowserTabs();

    const location = useLocation();
    const params = useParams<{ owner?: string; repo?: string }>();
    const [searchParams, setSearchParams] = useSearchParams<{ branch?: string }>();
    const navigate = useNavigate();

    const urlOwner = () => params.owner ?? null;
    const urlRepo = () => params.repo ?? null;
    const urlBranch = () => searchParams.branch ?? null;

    const [repositoriesResource, { refetch: refetchRepositories }] = createResource(
        () => (status() === "authenticated" ? "authenticated" : null),
        async () => {
            const result = await api<{ repos: GithubRepository[] }>("/api/github/installations/branches");
            return result.repos;
        },
    );

    const repositories = createMemo(() => repositoriesResource() ?? []);
    const isLoadingRepositories = createMemo(() => status() === "authenticated" && repositoriesResource.loading);

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

    // Correct the URL if it doesn't match the selected repository/branch
    createEffect(() => {
        if (status() !== "authenticated") return; // TODO: Try to remove those checks (gate this context under auth guard)?

        const selectedRepo = selectedRepository();
        if (!selectedRepo) return;

        const selectedRepoPath = `/${selectedRepo.owner}/${selectedRepo.repo}`;
        const isRepositoryMismatch = urlOwner() !== selectedRepo.owner || urlRepo() !== selectedRepo.repo;

        const selected = selectedBranch();
        const selectedBranchName = selected?.name ?? null;
        const branchNameFromUrl = urlBranch();
        const isBranchMismatch = branchNameFromUrl !== selectedBranchName;

        if (!isRepositoryMismatch && !isBranchMismatch) return;

        if (isRepositoryMismatch) {
            const nextSearchParams = new URLSearchParams(location.search);

            if (selectedBranchName) nextSearchParams.set("branch", selectedBranchName);
            else nextSearchParams.delete("branch");

            const search = nextSearchParams.toString();
            navigate(`${selectedRepoPath}${search ? `?${search}` : ""}`, { replace: true });
            return;
        }

        setSearchParams({ branch: selectedBranchName ?? undefined }, { replace: true });
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

        setSearchParams({ branch: newBranchName });
    };

    createEffect(() => {
        if (status() !== "authenticated") {
            setWorkspace({ kind: "anonymous" });
            return;
        }

        const owner = urlOwner();
        const repo = urlRepo();
        const branch = selectedBranch()?.name ?? null;
        if (!owner || !repo || !branch) {
            setWorkspace({ kind: "anonymous" });
            return;
        }

        setWorkspace({ kind: "github", owner, repo, branch });
    });

    createEffect(() => {
        if (status() !== "authenticated") return;
        if (!isNewTab()) return;
        if (isLoadingRepositories()) return;

        const owner = urlOwner();
        const repo = urlRepo();
        const branch = selectedBranch();
        if (!owner || !repo || !branch) return;

        const promptKey = joinPromptSessionKey(owner, repo);
        if (sessionStorage.getItem(promptKey) === "1") return;
        sessionStorage.setItem(promptKey, "1");

        const otherTabs = listOtherTabsForRepo(owner, repo);
        if (otherTabs.length === 0) return;

        const shouldContinueSynced = window.confirm(
            `This repository is already open in another tab.\n\n` +
                `Press OK to continue editing in sync.\n` +
                `Press Cancel to create a new branch and edit separately in this tab.`,
        );
        if (shouldContinueSynced) return;

        const suffix = untrack(tabId).slice(-4) || "copy";
        const suggestedBranchName = `${branch.name}-tab-${suffix}`;
        const rawBranchName = window.prompt("Enter a name for the new branch:", suggestedBranchName);
        const newBranchName = rawBranchName?.trim();
        if (!newBranchName) return;

        createBranchFromSelected(newBranchName).catch((error) => {
            const message = error instanceof Error ? error.message : "Failed to create branch";
            window.alert(message);
        });
    });

    return (
        <GithubRepositoryContext.Provider
            value={{
                repositories,
                isLoadingRepositories,
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
