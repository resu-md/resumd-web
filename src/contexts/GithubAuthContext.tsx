import { createContext, useContext, createSignal, type Accessor, onMount, type JSXElement } from "solid-js";

export type GithubAuthStatus = "loading" | "authenticated" | "unauthenticated";

export type GithubUser = {
    login: string;
    avatarUrl: string;
};

export type GithubLinkedRepo = {
    owner: string;
    repo: string;
    fullName: string;
    installationId: number | null;
};

type GithubAuthContextValue = {
    status: Accessor<GithubAuthStatus>;
    user: Accessor<GithubUser | null>;
    linkedRepos: Accessor<ReadonlyArray<GithubLinkedRepo>>;
    activeRepo: Accessor<GithubLinkedRepo | null>;
    refresh: () => Promise<void>;
    refreshLinkedRepos: () => Promise<void>;
    logout: () => Promise<void>;
    markUnauthorized: () => void;
    setActiveRepo: (repo: GithubLinkedRepo | null) => void;
    setActiveRepoBySlug: (owner: string, repo: string) => void;
};

const GithubAuthContext = createContext<GithubAuthContextValue>();

const ACTIVE_REPO_STORAGE_KEY = "resumd.github.activeRepo";

async function readGithubUser(): Promise<GithubUser> {
    const res = await fetch("/api/github/me", { credentials: "include" });
    if (!res.ok) {
        throw new Error("Unauthorized");
    }
    const data = await res.json();
    return { login: data.login, avatarUrl: data.avatarUrl };
}

async function readGithubLinkedRepos(): Promise<GithubLinkedRepo[]> {
    const res = await fetch("/api/github/installations", { credentials: "include" });
    if (!res.ok) {
        throw new Error("Unauthorized");
    }
    const data = await res.json();
    const repos = Array.isArray(data.repos) ? data.repos : [];
    return repos.map((repo: any) => ({
        owner: repo.owner,
        repo: repo.repo,
        fullName: repo.fullName ?? `${repo.owner}/${repo.repo}`,
        installationId: typeof repo.installationId === "number" ? repo.installationId : null,
    }));
}

function repoFromSlug(slug: string | null): GithubLinkedRepo | null {
    if (!slug) return null;
    const [owner, repo] = slug.split("/");
    if (!owner || !repo) return null;
    return { owner, repo, fullName: `${owner}/${repo}`, installationId: null };
}

export function GithubAuthProvider(props: { children?: JSXElement }) {
    const [status, setStatus] = createSignal<GithubAuthStatus>("loading");
    const [user, setUser] = createSignal<GithubUser | null>(null);
    const [linkedRepos, setLinkedRepos] = createSignal<GithubLinkedRepo[]>([]);

    const storedSlug = typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_REPO_STORAGE_KEY) : null;
    const [activeRepo, setActiveRepoState] = createSignal<GithubLinkedRepo | null>(repoFromSlug(storedSlug));

    const persistActiveRepo = (repo: GithubLinkedRepo | null) => {
        if (typeof window === "undefined") return;
        if (repo) {
            window.localStorage.setItem(ACTIVE_REPO_STORAGE_KEY, `${repo.owner}/${repo.repo}`);
        } else {
            window.localStorage.removeItem(ACTIVE_REPO_STORAGE_KEY);
        }
    };

    const updateActiveRepo = (repo: GithubLinkedRepo | null) => {
        setActiveRepoState(repo);
        persistActiveRepo(repo);
    };

    const syncActiveRepoWithLinkedList = (list: GithubLinkedRepo[]) => {
        const current = activeRepo();
        if (current) {
            const match = list.find((repo) => repo.owner === current.owner && repo.repo === current.repo);
            if (match) {
                updateActiveRepo(match);
                return;
            }

            if (current.installationId !== null) {
                updateActiveRepo(list[0] ?? null);
            }
            return;
        }

        if (list.length > 0) {
            updateActiveRepo(list[0]);
        }
    };

    const clearAuthState = () => {
        setUser(null);
        setLinkedRepos([]);
        updateActiveRepo(null);
    };

    const refresh = async () => {
        setStatus("loading");
        try {
            const [profile, repos] = await Promise.all([readGithubUser(), readGithubLinkedRepos()]);
            setUser(profile);
            setLinkedRepos(repos);
            syncActiveRepoWithLinkedList(repos);
            setStatus("authenticated");
        } catch {
            clearAuthState();
            setStatus("unauthenticated");
        }
    };

    const refreshLinkedRepos = async () => {
        const repos = await readGithubLinkedRepos();
        setLinkedRepos(repos);
        syncActiveRepoWithLinkedList(repos);
    };

    const logout = async () => {
        try {
            await fetch("/api/github/logout", { method: "POST", credentials: "include" });
        } finally {
            clearAuthState();
            setStatus("unauthenticated");
        }
    };

    const markUnauthorized = () => {
        clearAuthState();
        setStatus("unauthenticated");
    };

    const setActiveRepoBySlug = (owner: string, repo: string) => {
        updateActiveRepo({ owner, repo, fullName: `${owner}/${repo}`, installationId: null });
    };

    onMount(() => {
        void refresh();
    });

    const value: GithubAuthContextValue = {
        status,
        user,
        linkedRepos,
        activeRepo,
        refresh,
        refreshLinkedRepos,
        logout,
        markUnauthorized,
        setActiveRepo: updateActiveRepo,
        setActiveRepoBySlug,
    };

    return <GithubAuthContext.Provider value={value}>{props.children}</GithubAuthContext.Provider>;
}

export function useGithubAuth() {
    const ctx = useContext(GithubAuthContext);
    if (!ctx) {
        throw new Error("useGithubAuth must be used within GithubAuthProvider");
    }
    return ctx;
}
