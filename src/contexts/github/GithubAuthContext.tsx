import { api } from "@/lib/api";
import { useNavigate } from "@solidjs/router";
import {
    createContext,
    createMemo,
    createResource,
    createSignal,
    onMount,
    useContext,
    type Accessor,
    type JSXElement,
} from "solid-js";

export type GithubAuthStatus = "loading" | "authenticated" | "unauthenticated";

export type GithubUser = {
    username: string;
    avatarUrl: string;
};

export type GithubRepository = {
    owner: string;
    repo: string;
    fullName: string;
    installationId: number;
};

const GithubAuthContext = createContext<{
    status: Accessor<GithubAuthStatus>;
    user: Accessor<GithubUser | null>;
    login: (owner: string, repo: string, returnTo?: string) => void;
    logout: () => Promise<void>;
}>();

const redirectToGithubAuthorize = (owner: string, repo: string, returnTo?: string) => {
    if (typeof window === "undefined") return;
    const fallbackPath = returnTo ?? window.location.pathname + window.location.search;
    const safePath = fallbackPath.startsWith("/") ? fallbackPath : `/${fallbackPath}`;
    const search = new URLSearchParams({ owner, repo, returnTo: safePath });
    window.location.href = `/api/github/authorize?${search.toString()}`;
};

export function GithubAuthProvider(props: { children?: JSXElement }) {
    const navigate = useNavigate();

    const [status, setStatus] = createSignal<GithubAuthStatus>("loading");
    const [user, setUser] = createSignal<GithubUser | null>(null);

    const logout = async () => {
        try {
            await api("/api/github/logout", { method: "POST" });
        } finally {
            setStatus("unauthenticated");
            setUser(null);
            navigate("/", { replace: true });
        }
    };

    const login = (owner: string, repo: string, returnTo?: string) => {
        redirectToGithubAuthorize(owner, repo, returnTo);
    };

    onMount(async () => {
        try {
            const me = await api<{ login: string; id: number; avatarUrl: string }>("/api/github/me");
            setUser({ username: me.login, avatarUrl: me.avatarUrl });
            setStatus("authenticated");
        } catch {
            setUser(null);
            setStatus("unauthenticated");
        }
    });

    return (
        <GithubAuthContext.Provider value={{ status, user, login, logout }}>
            {props.children}
        </GithubAuthContext.Provider>
    );
}

export function useGithubAuth() {
    const context = useContext(GithubAuthContext);
    if (!context) throw new Error("useGithubAuth must be used within a GithubAuthProvider");
    return context;
}
