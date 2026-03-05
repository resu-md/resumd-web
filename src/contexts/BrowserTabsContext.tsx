import { parseJson } from "@/lib/parse-json";

// Constants (storage keys, intervals)
// TODO: Move to storage-keys.ts
const STORAGE_PREFIX = "temp_prefix"; // TODO: Define prefix
const TAB_ID_KEY = `${STORAGE_PREFIX}.tabId`;
const TABS_KEY = `${STORAGE_PREFIX}.tabs`;
const TAB_STALE_AFTER_MS = 20_000; // 20s old tab entries are considered stale and removed from the registry
const TAB_HEARTBEAT_INTERVAL_MS = 5_000; // Tabs update their last seen timestamp every 5s to indicate they're still active

// Navigation type detection
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

// Tab registry management
type TabRegistry = Record<string, number>;
function readTabRegistry(now = Date.now()) {
    const parsed = parseJson<TabRegistry>(localStorage.getItem(TABS_KEY));
    if (!parsed || !(typeof parsed === "object" && parsed !== null)) return {};

    const nextRegistry: TabRegistry = {};
    Object.entries(parsed).forEach(([tabId, lastSeen]) => {
        if (typeof lastSeen !== "number") return;
        if (now - lastSeen > TAB_STALE_AFTER_MS) return; // removes stale tabs
        nextRegistry[tabId] = lastSeen;
    });
    return nextRegistry;
}
function writeTabRegistry(registry: TabRegistry) {
    localStorage.setItem(TABS_KEY, JSON.stringify(registry));
}
function heartbeatTab(tabId: string) {
    const registry = readTabRegistry();
    registry[tabId] = Date.now();
    writeTabRegistry(registry);
}
function removeTab(tabId: string) {
    const registry = readTabRegistry();
    if (!(tabId in registry)) return;
    delete registry[tabId];
    writeTabRegistry(registry);
}

function createTabSession() {
    // Get current tab ID
    const navigationType = getNavigationType();
    const isNavigationTypeReloadLike = navigationType === "reload" || navigationType === "back_forward";
    const previousTabId = sessionStorage.getItem(TAB_ID_KEY);
    const tabId = isNavigationTypeReloadLike && previousTabId ? previousTabId : `tab_${crypto.randomUUID()}`; // reuse tabId on reload/back-forward, otherwise generate new

    // Identify current active tabs and register self
    const tabRegistry = readTabRegistry();
    const hasOtherTabs = Object.keys(tabRegistry).some((openTabId) => openTabId !== tabId);
    tabRegistry[tabId] = Date.now();
    writeTabRegistry(tabRegistry);
    sessionStorage.setItem(TAB_ID_KEY, tabId);

    if (import.meta.env.PROD == false) {
        console.log("Is new tab? ", previousTabId === tabId ? "No, same tab (reload/back-forward)" : "Yes, new tab");
        console.log("Current open tabs: ", Object.keys(tabRegistry));
    }

    // Register intervals and event listeners to keep heartbeat and clean up on unload
    const heartbeatIntervalId = window.setInterval(() => heartbeatTab(tabId), TAB_HEARTBEAT_INTERVAL_MS);
    const handleFocus = () => {
        heartbeatTab(tabId);
    };
    const handleVisibilityChange = () => {
        if (document.visibilityState !== "visible") return;
        heartbeatTab(tabId);
    };
    const handleBeforeUnload = () => {
        removeTab(tabId);
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const dispose = () => {
        window.clearInterval(heartbeatIntervalId);
        window.removeEventListener("focus", handleFocus);
        window.removeEventListener("beforeunload", handleBeforeUnload);
        window.removeEventListener("pagehide", handleBeforeUnload);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        removeTab(tabId);
    };

    return {
        tabId,
        hasOtherTabs,
        dispose,
    };
}
