import { type Accessor, createSignal, onCleanup, onMount } from "solid-js";

const EDITOR_SESSION_KEY = "resumd.activeEditorSession";
const SESSION_REFRESH_MS = 2000;
const SESSION_STALE_MS = 7000;

export type SessionState = "checking" | "active" | "blocked";
type SessionPayload = {
    id: string;
    updatedAt: number;
};

type SingleSessionGuard = {
    status: Accessor<SessionState>;
    retry: () => void;
};

export function useSingleSessionGuard(): SingleSessionGuard {
    const [status, setStatus] = createSignal<SessionState>(isBrowser() ? "checking" : "active");
    const sessionId = createSessionId();
    let heartbeatId: number | undefined;
    let storageReady = false;
    let hasLock = false;

    const stopHeartbeat = () => {
        if (heartbeatId !== undefined && isBrowser()) {
            window.clearInterval(heartbeatId);
            heartbeatId = undefined;
        }
    };

    const readSession = (): SessionPayload | null => {
        if (!storageReady || !isBrowser()) {
            return null;
        }
        return parseSession(window.localStorage.getItem(EDITOR_SESSION_KEY));
    };

    const writeSession = () => {
        if (!storageReady || !isBrowser()) {
            return;
        }
        window.localStorage.setItem(
            EDITOR_SESSION_KEY,
            JSON.stringify({
                id: sessionId,
                updatedAt: Date.now(),
            }),
        );
    };

    const releaseLock = () => {
        stopHeartbeat();
        if (!storageReady || !hasLock || !isBrowser()) {
            hasLock = false;
            return;
        }
        const stored = readSession();
        if (!stored || stored.id === sessionId) {
            window.localStorage.removeItem(EDITOR_SESSION_KEY);
        }
        hasLock = false;
    };

    const startHeartbeat = () => {
        if (!storageReady || heartbeatId !== undefined || !isBrowser()) {
            return;
        }
        heartbeatId = window.setInterval(() => {
            if (!hasLock) {
                stopHeartbeat();
                return;
            }
            const stored = readSession();
            if (!stored || stored.id !== sessionId) {
                hasLock = false;
                stopHeartbeat();
                setStatus("blocked");
                return;
            }
            writeSession();
        }, SESSION_REFRESH_MS);
    };

    const claimLock = () => {
        if (!storageReady) {
            setStatus("active");
            return true;
        }
        const existing = readSession();
        if (existing && existing.id !== sessionId && isSessionFresh(existing)) {
            hasLock = false;
            stopHeartbeat();
            setStatus("blocked");
            return false;
        }
        writeSession();
        hasLock = true;
        startHeartbeat();
        setStatus("active");
        return true;
    };

    onMount(() => {
        storageReady = isLocalStorageAvailable();
        if (!storageReady) {
            setStatus("active");
            return;
        }

        claimLock();

        const handleStorage = (event: StorageEvent) => {
            if (event.key !== EDITOR_SESSION_KEY) {
                return;
            }
            const payload = parseSession(event.newValue);
            if (!payload) {
                if (!hasLock) {
                    claimLock();
                }
                return;
            }
            if (payload.id !== sessionId) {
                hasLock = false;
                stopHeartbeat();
                setStatus("blocked");
            }
        };

        const handleVisibility = () => {
            if (document.visibilityState === "visible" && !hasLock) {
                claimLock();
            }
        };

        const handleBeforeUnload = () => releaseLock();

        window.addEventListener("storage", handleStorage);
        document.addEventListener("visibilitychange", handleVisibility);
        window.addEventListener("beforeunload", handleBeforeUnload);

        onCleanup(() => {
            window.removeEventListener("storage", handleStorage);
            document.removeEventListener("visibilitychange", handleVisibility);
            window.removeEventListener("beforeunload", handleBeforeUnload);
            releaseLock();
        });
    });

    return {
        status,
        retry: () => {
            if (!hasLock) {
                claimLock();
            }
        },
    };
}

function isBrowser(): boolean {
    return typeof window !== "undefined" && typeof document !== "undefined";
}

function isLocalStorageAvailable(): boolean {
    if (!isBrowser()) {
        return false;
    }
    try {
        const testKey = "__resumd_session_test__";
        window.localStorage.setItem(testKey, "1");
        window.localStorage.removeItem(testKey);
        return true;
    } catch {
        return false;
    }
}

function parseSession(raw: string | null): SessionPayload | null {
    if (!raw) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.id === "string" && typeof parsed?.updatedAt === "number") {
            return parsed as SessionPayload;
        }
    } catch {
        // ignore invalid payloads
    }
    return null;
}

function isSessionFresh(session: SessionPayload) {
    return Date.now() - session.updatedAt <= SESSION_STALE_MS;
}

function createSessionId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
