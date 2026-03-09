import { QueryClient } from "@tanstack/solid-query";
import {
    type Persister,
    type PersistedClient,
    persistQueryClientRestore,
    persistQueryClientSubscribe,
    type PersistedQueryClientSaveOptions,
} from "@tanstack/query-persist-client-core";
import { QUERY_CACHE_STORAGE_KEYS } from "./storage-keys";

const QUERY_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const QUERY_CACHE_BUSTER = "resumd-query-cache-v1";

const queryPersistenceOptions: Omit<PersistedQueryClientSaveOptions, "queryClient" | "persister"> = {
    dehydrateOptions: {
        shouldDehydrateQuery: (query) => query.state.status === "success",
    },
};

// TODO: Check configuration
function createLocalStoragePersister(options: { storage: Storage; key: string; throttleTime?: number }): Persister {
    let throttleTimeout: ReturnType<typeof setTimeout> | null = null;
    let pendingPersistedClient: PersistedClient | null = null;

    const persistNow = (persistedClient: PersistedClient) => {
        options.storage.setItem(options.key, JSON.stringify(persistedClient));
    };

    return {
        persistClient: async (persistedClient) => {
            const throttleTime = options.throttleTime ?? 0;

            if (throttleTime <= 0) {
                persistNow(persistedClient);
                return;
            }

            pendingPersistedClient = persistedClient;
            if (throttleTimeout !== null) return;

            throttleTimeout = setTimeout(() => {
                throttleTimeout = null;
                if (!pendingPersistedClient) return;

                persistNow(pendingPersistedClient);
                pendingPersistedClient = null;
            }, throttleTime);
        },
        restoreClient: async () => {
            const cached = options.storage.getItem(options.key);
            return cached ? (JSON.parse(cached) as PersistedClient) : undefined;
        },
        removeClient: async () => {
            options.storage.removeItem(options.key);
        },
    };
}

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            gcTime: QUERY_CACHE_MAX_AGE_MS,
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});

let restorePromise: Promise<void> | null = null;
let unsubscribePersist: (() => void) | null = null;

export async function restorePersistedQueryClient() {
    if (typeof window === "undefined") {
        return;
    }

    if (restorePromise) {
        await restorePromise;
        return;
    }

    restorePromise = (async () => {
        const persister = createLocalStoragePersister({
            storage: window.localStorage,
            key: QUERY_CACHE_STORAGE_KEYS.TANSTACK_QUERY,
            throttleTime: 1_000,
        });

        await persistQueryClientRestore({
            queryClient,
            persister,
            maxAge: QUERY_CACHE_MAX_AGE_MS,
            buster: QUERY_CACHE_BUSTER,
        });

        unsubscribePersist?.();
        unsubscribePersist = persistQueryClientSubscribe({
            queryClient,
            persister,
            buster: QUERY_CACHE_BUSTER,
            ...queryPersistenceOptions,
        });
    })();

    await restorePromise;
}

export default queryClient;

declare global {
    interface Window {
        __TANSTACK_QUERY_CLIENT__: import("@tanstack/query-core").QueryClient;
    }
}

if (typeof window !== "undefined") {
    window.__TANSTACK_QUERY_CLIENT__ = queryClient;
}

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        unsubscribePersist?.();
        unsubscribePersist = null;
        restorePromise = null;
    });
}
