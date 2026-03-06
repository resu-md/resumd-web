import { parseJson } from "@/lib/parse-json";
import {
    createContext,
    createSignal,
    onCleanup,
    onMount,
    useContext,
    type Accessor,
    type JSXElement,
} from "solid-js";

const STORAGE_PREFIX = "resumd.tabs.v1";
const TAB_ID_KEY = `${STORAGE_PREFIX}.tabId`;
const TABS_KEY = `${STORAGE_PREFIX}.tabs`;
const TAB_STALE_AFTER_MS = 20_000;
const TAB_HEARTBEAT_INTERVAL_MS = 5_000;

type NavigationType = "navigate" | "reload" | "back_forward" | "prerender";
type TabWorkspacePresence = {
    repoKey: string | null;
    branch: string | null;
};

type TabRegistryEntry = {
    id: string;
    lastSeen: number;
    repoKey: string | null;
    branch: string | null;
};

type TabRegistry = Record<string, TabRegistryEntry>;

function getNavigationType(): NavigationType {
    const entries = performance.getEntriesByType("navigation");
    const entry = entries[0] as PerformanceNavigationTiming | undefined;
    if (!entry) return "navigate";
    if (entry.type === "reload") return "reload";
    if (entry.type === "back_forward") return "back_forward";
    if (entry.type === "prerender") return "prerender";
    return "navigate";
}

function readTabRegistry(now = Date.now()): TabRegistry {
    const parsed = parseJson<TabRegistry>(localStorage.getItem(TABS_KEY));
    if (!parsed || typeof parsed !== "object") return {};

    const nextRegistry: TabRegistry = {};
    Object.entries(parsed).forEach(([tabId, entry]) => {
        if (!entry || typeof entry !== "object") return;
        if (typeof entry.lastSeen !== "number") return;
        if (now - entry.lastSeen > TAB_STALE_AFTER_MS) return;

        nextRegistry[tabId] = {
            id: tabId,
            lastSeen: entry.lastSeen,
            repoKey: typeof entry.repoKey === "string" ? entry.repoKey : null,
            branch: typeof entry.branch === "string" ? entry.branch : null,
        };
    });

    return nextRegistry;
}

function writeTabRegistry(registry: TabRegistry) {
    localStorage.setItem(TABS_KEY, JSON.stringify(registry));
}

function upsertTab(tabId: string, presence: TabWorkspacePresence, now = Date.now()) {
    const registry = readTabRegistry(now);
    registry[tabId] = {
        id: tabId,
        lastSeen: now,
        repoKey: presence.repoKey,
        branch: presence.branch,
    };
    writeTabRegistry(registry);
}

function removeTab(tabId: string) {
    const registry = readTabRegistry();
    if (!(tabId in registry)) return;
    delete registry[tabId];
    writeTabRegistry(registry);
}

function createTabSession() {
    const navigationType = getNavigationType();
    const isNavigationTypeReloadLike = navigationType === "reload" || navigationType === "back_forward";
    const previousTabId = sessionStorage.getItem(TAB_ID_KEY);
    const tabId = isNavigationTypeReloadLike && previousTabId ? previousTabId : `tab_${crypto.randomUUID()}`;

    const tabRegistry = readTabRegistry();
    const hasOtherTabs = Object.keys(tabRegistry).some((openTabId) => openTabId !== tabId);
    const isFreshTab = !isNavigationTypeReloadLike || previousTabId == null;

    sessionStorage.setItem(TAB_ID_KEY, tabId);
    upsertTab(tabId, { repoKey: null, branch: null });

    if (!import.meta.env.PROD) {
        console.log("Is new tab?", isFreshTab ? "Yes" : "No (reload/back-forward)");
        console.log("Open tabs:", Object.keys(readTabRegistry()));
    }

    return {
        tabId,
        hasOtherTabs,
        isFreshTab,
    };
}

type BrowserTabsContextValue = {
    tabId: Accessor<string>;
    isFreshTab: Accessor<boolean>;
    hasOtherTabsAtOpen: Accessor<boolean>;
    registryRevision: Accessor<number>;
    announceWorkspace: (repoKey: string | null, branch: string | null) => void;
    getPeersByRepo: (repoKey: string) => TabRegistryEntry[];
    getPeersByRepoBranch: (repoKey: string, branch: string) => TabRegistryEntry[];
};

const BrowserTabsContext = createContext<BrowserTabsContextValue>();

export function BrowserTabsProvider(props: { children?: JSXElement }) {
    const session = createTabSession();

    const [tabId] = createSignal(session.tabId);
    const [isFreshTab] = createSignal(session.isFreshTab);
    const [hasOtherTabsAtOpen] = createSignal(session.hasOtherTabs);
    const [registryRevision, setRegistryRevision] = createSignal(0);
    const [presence, setPresence] = createSignal<TabWorkspacePresence>({
        repoKey: null,
        branch: null,
    });

    const heartbeat = () => {
        upsertTab(tabId(), presence());
        setRegistryRevision((value) => value + 1);
    };

    const announceWorkspace = (repoKey: string | null, branch: string | null) => {
        const prev = presence();
        if (prev.repoKey === repoKey && prev.branch === branch) return;

        setPresence({ repoKey, branch });
        upsertTab(tabId(), { repoKey, branch });
        setRegistryRevision((value) => value + 1);
    };

    const getPeersByRepo = (repoKey: string) => {
        registryRevision();
        return Object.values(readTabRegistry()).filter((entry) => entry.id !== tabId() && entry.repoKey === repoKey);
    };

    const getPeersByRepoBranch = (repoKey: string, branch: string) => {
        registryRevision();
        return Object.values(readTabRegistry()).filter(
            (entry) => entry.id !== tabId() && entry.repoKey === repoKey && entry.branch === branch,
        );
    };

    onMount(() => {
        heartbeat();

        const heartbeatIntervalId = window.setInterval(heartbeat, TAB_HEARTBEAT_INTERVAL_MS);
        const handleFocus = () => {
            heartbeat();
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState !== "visible") return;
            heartbeat();
        };
        const handleStorage = (event: StorageEvent) => {
            if (event.key !== TABS_KEY) return;
            setRegistryRevision((value) => value + 1);
        };
        const handleBeforeUnload = () => {
            removeTab(tabId());
        };

        window.addEventListener("focus", handleFocus);
        window.addEventListener("storage", handleStorage);
        window.addEventListener("beforeunload", handleBeforeUnload);
        window.addEventListener("pagehide", handleBeforeUnload);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        onCleanup(() => {
            window.clearInterval(heartbeatIntervalId);
            window.removeEventListener("focus", handleFocus);
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener("beforeunload", handleBeforeUnload);
            window.removeEventListener("pagehide", handleBeforeUnload);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            removeTab(tabId());
            setRegistryRevision((value) => value + 1);
        });
    });

    return (
        <BrowserTabsContext.Provider
            value={{
                tabId,
                isFreshTab,
                hasOtherTabsAtOpen,
                registryRevision,
                announceWorkspace,
                getPeersByRepo,
                getPeersByRepoBranch,
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

export type { TabWorkspacePresence, TabRegistryEntry };
