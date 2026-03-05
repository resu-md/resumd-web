import { createContext, createSignal, onCleanup, onMount, useContext, type Accessor, type JSXElement } from "solid-js";

type TabWorkspace =
    | { kind: "anonymous" }
    | { kind: "idle" }
    | { kind: "github"; owner: string; repo: string; branch: string | null };

type TabRegistryEntry = {
    tabId: string;
    lastSeen: number;
    workspace: TabWorkspace;
};

type TabRegistry = Record<string, TabRegistryEntry>;

const STORAGE_PREFIX = "resumd.tabs.v1";
const TAB_ID_SESSION_KEY = `${STORAGE_PREFIX}.tabId`;
const TAB_REGISTRY_KEY = `${STORAGE_PREFIX}.registry`;
const TAB_STALE_AFTER_MS = 20_000;
const TAB_HEARTBEAT_INTERVAL_MS = 5_000;

const BrowserTabsContext = createContext<{
    tabId: Accessor<string>;
    isNewTab: Accessor<boolean>;
    setWorkspace: (workspace: TabWorkspace) => void;
    listOtherTabsForRepo: (owner: string, repo: string) => TabRegistryEntry[];
}>();

type NavigationType = "navigate" | "reload" | "back_forward" | "prerender";

function getNavigationType(): NavigationType {
    const entries = performance.getEntriesByType("navigation");
    const entry = entries[0] as PerformanceNavigationTiming | undefined;
    if (!entry) return "navigate";
    if (entry.type === "reload") return "reload";
    if (entry.type === "back_forward") return "back_forward";
    if (entry.type === "prerender") return "prerender";
    return "navigate";
}

function parseJson<T>(value: string | null): T | null {
    if (!value) return null;
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}

function readRegistry(now = Date.now()): TabRegistry {
    const parsed = parseJson<TabRegistry>(localStorage.getItem(TAB_REGISTRY_KEY));
    if (!parsed || typeof parsed !== "object") return {};

    const nextRegistry: TabRegistry = {};
    Object.values(parsed).forEach((entry) => {
        if (!entry || typeof entry !== "object") return;
        if (typeof entry.tabId !== "string" || typeof entry.lastSeen !== "number") return;
        if (now - entry.lastSeen > TAB_STALE_AFTER_MS) return;
        nextRegistry[entry.tabId] = entry;
    });
    return nextRegistry;
}

function writeRegistry(registry: TabRegistry) {
    localStorage.setItem(TAB_REGISTRY_KEY, JSON.stringify(registry));
}

function upsertTabEntry(tabId: string, workspace: TabWorkspace) {
    const registry = readRegistry();
    registry[tabId] = {
        tabId,
        lastSeen: Date.now(),
        workspace,
    };
    writeRegistry(registry);
}

function removeTabEntry(tabId: string) {
    const registry = readRegistry();
    if (!(tabId in registry)) return;
    delete registry[tabId];
    writeRegistry(registry);
}

function buildTabIdentity() {
    const navigationType = getNavigationType();
    const isReloadLikeNavigation = navigationType === "reload" || navigationType === "back_forward";
    const previousTabId = sessionStorage.getItem(TAB_ID_SESSION_KEY);
    const nextTabId = isReloadLikeNavigation && previousTabId ? previousTabId : `tab_${crypto.randomUUID()}`;
    sessionStorage.setItem(TAB_ID_SESSION_KEY, nextTabId);
    return {
        tabId: nextTabId,
        isNewTab: nextTabId !== previousTabId,
    };
}

export function BrowserTabsProvider(props: { children?: JSXElement }) {
    const [tabId, setTabId] = createSignal("");
    const [isNewTab, setIsNewTab] = createSignal(false);
    const [workspace, setWorkspace] = createSignal<TabWorkspace>({ kind: "idle" });

    onMount(() => {
        const identity = buildTabIdentity();
        setTabId(identity.tabId);
        setIsNewTab(identity.isNewTab);
        upsertTabEntry(identity.tabId, workspace());

        const heartbeat = () => {
            upsertTabEntry(identity.tabId, workspace());
        };
        const heartbeatInterval = window.setInterval(heartbeat, TAB_HEARTBEAT_INTERVAL_MS);

        const handleFocus = () => heartbeat();
        const handleVisibility = () => {
            if (document.visibilityState !== "visible") return;
            heartbeat();
        };
        const handleUnload = () => removeTabEntry(identity.tabId);

        window.addEventListener("focus", handleFocus);
        window.addEventListener("beforeunload", handleUnload);
        window.addEventListener("pagehide", handleUnload);
        document.addEventListener("visibilitychange", handleVisibility);

        onCleanup(() => {
            window.clearInterval(heartbeatInterval);
            window.removeEventListener("focus", handleFocus);
            window.removeEventListener("beforeunload", handleUnload);
            window.removeEventListener("pagehide", handleUnload);
            document.removeEventListener("visibilitychange", handleVisibility);
            removeTabEntry(identity.tabId);
        });
    });

    const updateWorkspace = (nextWorkspace: TabWorkspace) => {
        setWorkspace(nextWorkspace);
        const id = tabId();
        if (!id) return;
        upsertTabEntry(id, nextWorkspace);
    };

    const listOtherTabsForRepo = (owner: string, repo: string) => {
        const id = tabId();
        return Object.values(readRegistry()).filter((entry) => {
            if (entry.tabId === id) return false;
            const tabWorkspace = entry.workspace;
            if (!tabWorkspace || tabWorkspace.kind !== "github") return false;
            return tabWorkspace.owner === owner && tabWorkspace.repo === repo;
        });
    };

    return (
        <BrowserTabsContext.Provider
            value={{
                tabId,
                isNewTab,
                setWorkspace: updateWorkspace,
                listOtherTabsForRepo,
            }}
        >
            {props.children}
        </BrowserTabsContext.Provider>
    );
}

export function useBrowserTabs() {
    const context = useContext(BrowserTabsContext);
    if (!context) throw new Error("useBrowserTabs must be used within a BrowserTabsProvider");
    return context;
}
