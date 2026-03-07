import {
    createContext,
    createMemo,
    createResource,
    createSignal,
    useContext,
    type Accessor,
    type ParentProps,
    type Resource,
    type Setter,
} from "solid-js";
import { isServer } from "solid-js/web"; // TODO: Is it necessary?
import { makePersisted, storageSync } from "@solid-primitives/storage";
import { useNavigate } from "@solidjs/router";
import { GITHUB_STORAGE_KEYS } from "@/lib/storage-keys";

export type GithubUser = {
    username: string;
    avatarUrl: string;
};

export type GithubAuthState = "unknown" | "authenticated" | "unauthenticated";
// export type GithubFetchStatus = "idle" | "fetching";
// export type GithubCacheStatus = "empty" | "cached" | "refreshing";

type GithubAuthContextValue = {
    user: Accessor<GithubUser | null | undefined>;
    authState: Accessor<GithubAuthState>;
    // fetchStatus: Accessor<GithubFetchStatus>;
    // cacheStatus: Accessor<GithubCacheStatus>;
    api: <T>(path: string, init?: RequestInit) => Promise<T>;
    login: (owner: string, repo: string, returnTo?: string) => void;
    logout: () => Promise<void>;
    refreshSession: () => Promise<GithubUser | null | undefined>;
    finishSession: () => void;
};

const GithubAuthContext = createContext<GithubAuthContextValue>();

function buildHeaders(init?: HeadersInit): Headers {
    const headers = new Headers(init);

    if (!headers.has("Accept")) {
        headers.set("Accept", "application/json");
    }

    return headers;
}

async function readErrorMessage(response: Response): Promise<string> {
    const fallback = `HTTP ${response.status}`;

    try {
        const contentType = response.headers.get("content-type") ?? "";

        if (contentType.includes("application/json")) {
            const data: unknown = await response.clone().json();

            if (typeof data === "object" && data !== null) {
                if ("error" in data && typeof data.error === "string") {
                    return data.error;
                }

                if ("message" in data && typeof data.message === "string") {
                    return data.message;
                }
            }
        }

        const text = await response.clone().text();
        return text || fallback;
    } catch {
        return fallback;
    }
}

class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

async function toApiError(response: Response): Promise<ApiError> {
    return new ApiError(await readErrorMessage(response), response.status);
}

function createPersistedResourceStorage<T>(key: string) {
    return (init: T | undefined): [Accessor<T | undefined>, Setter<T | undefined>] => {
        if (isServer) {
            return createSignal<T | undefined>(init);
        }

        const [get, set] = makePersisted(createSignal<T | undefined>(init), {
            name: key,
            storage: localStorage,
            sync: storageSync,
        });

        return [get, set];
    };
}

export function GithubAuthProvider(props: ParentProps) {
    const navigate = useNavigate();

    let sessionEpoch = 0;

    const fetchSession = async (): Promise<GithubUser | null> => {
        const myEpoch = sessionEpoch;

        const response = await fetch("/api/github/me", {
            method: "GET",
            credentials: "include",
            headers: buildHeaders(),
        });

        let nextValue: GithubUser | null;

        if (response.status === 401) {
            nextValue = null;
        } else if (!response.ok) {
            throw await toApiError(response);
        } else {
            nextValue = (await response.json()) as GithubUser;
        }

        if (myEpoch !== sessionEpoch) {
            return null;
        }

        return nextValue;
    };

    const [session, { mutate: mutateSession, refetch: refetchSession }] = createResource<GithubUser | null>(
        fetchSession,
        {
            storage: createPersistedResourceStorage<GithubUser | null>(GITHUB_STORAGE_KEYS.SESSION),
        },
    );

    const finishSession = () => {
        sessionEpoch += 1;
        mutateSession(null);
    };

    const api = async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
        const response = await fetch(path, {
            ...init,
            credentials: "include",
            headers: buildHeaders(init.headers),
        });

        if (response.status === 401) {
            // TODO: Check authState? If it is loading should logout?
            finishSession();
            throw new ApiError("Unauthorized", 401);
        }

        if (!response.ok) {
            throw await toApiError(response);
        }

        if (response.status === 204) {
            return undefined as T;
        }

        const contentType = response.headers.get("content-type") ?? "";

        if (contentType.includes("application/json")) {
            return (await response.json()) as T;
        }

        return (await response.text()) as T;
    };

    const login = async (owner: string, repo: string, returnTo = `${import.meta.env.BASE_URL}${owner}/${repo}`) => {
        if (isServer) return;

        const params = new URLSearchParams({
            owner,
            repo,
            returnTo,
        });

        window.location.assign(`/api/github/authorize?${params.toString()}`);
    };

    const logout = async () => {
        try {
            await fetch("/api/github/logout", {
                method: "POST",
                credentials: "include",
                headers: buildHeaders(),
            });
        } finally {
            finishSession();
            if (!isServer) {
                for (const key of Object.values(GITHUB_STORAGE_KEYS)) {
                    localStorage.removeItem(key);
                }
            }
            navigate("/", { replace: true });
        }
    };

    /**
     * undefined: not loaded yet
     * null: user is not authenticated, optimistically
     * GithubUser: user is authenticated, optimistically
     */
    const user = createMemo<GithubUser | null | undefined>(() => session.latest);

    const authState = createMemo<GithubAuthState>(() => {
        if (session.loading) return "unknown";
        return user() ? "authenticated" : "unauthenticated";
    });

    // const fetchStatus = createMemo<GithubFetchStatus>(() => {
    //     return session.state === "pending" || session.state === "refreshing" ? "fetching" : "idle";
    // });

    // const cacheStatus = createMemo<GithubCacheStatus>(() => {
    //     if (session.latest === undefined) return "empty";
    //     return session.state === "refreshing" ? "refreshing" : "cached";
    // });

    const value: GithubAuthContextValue = {
        user,
        authState,
        api,
        login,
        logout,
        refreshSession: () => Promise.resolve(refetchSession()),
        finishSession,
    };

    return <GithubAuthContext.Provider value={value}>{props.children}</GithubAuthContext.Provider>;
}

export function useGithubAuth() {
    const ctx = useContext(GithubAuthContext);

    if (!ctx) {
        throw new Error("useGithubAuth must be used inside GithubAuthProvider");
    }

    return ctx;
}

export function useGithubApi() {
    return useGithubAuth().api;
}
