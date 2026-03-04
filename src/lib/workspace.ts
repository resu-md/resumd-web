export type WorkspaceDocument = {
    id: string;
    name: string;
    createdAt: string;
    branchedFrom?: string;
};

type WorkspaceMeta = {
    version: 1;
    defaultDocumentId: string;
    order: string[];
    documents: Record<string, WorkspaceDocument>;
};

type TabDocumentSessionOptions = {
    defaultMarkdown: string;
    defaultCss: string;
};

export type TabDocumentSession = {
    documentId: string;
    markdown: string;
    css: string;
    getActiveDocumentId: () => string;
    getDocuments: () => WorkspaceDocument[];
    switchDocument: (documentId: string) => { markdown: string; css: string } | undefined;
    persistMarkdown: (value: string) => void;
    persistCss: (value: string) => void;
    dispose: () => void;
};

const STORAGE_PREFIX = "resumd.workspace.v1";
const META_KEY = `${STORAGE_PREFIX}.meta`;
const TABS_KEY = `${STORAGE_PREFIX}.tabs`;
const LAST_FOCUSED_DOCUMENT_ID_KEY = `${STORAGE_PREFIX}.lastFocusedDocumentId`;
const LEGACY_MARKDOWN_KEY = "resumd.markdown";
const LEGACY_CSS_KEY = "resumd.css";

const SESSION_ACTIVE_DOCUMENT_ID_KEY = `${STORAGE_PREFIX}.activeDocumentId`;
const SESSION_TAB_ID_KEY = `${STORAGE_PREFIX}.tabId`;

const TAB_HEARTBEAT_INTERVAL_MS = 5_000;
const TAB_STALE_AFTER_MS = 20_000;

type TabRegistry = Record<string, number>;
type NavigationType = "navigate" | "reload" | "back_forward" | "prerender";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function parseJson<T>(value: string | null): T | undefined {
    if (!value) return undefined;
    try {
        return JSON.parse(value) as T;
    } catch {
        return undefined;
    }
}

function toIsoNow() {
    return new Date().toISOString();
}

function createDocumentId() {
    return `doc-${crypto.randomUUID()}`;
}

function createTabId() {
    return `tab-${crypto.randomUUID()}`;
}

function getDocumentMarkdownKey(documentId: string) {
    return `${STORAGE_PREFIX}.document.${documentId}.markdown`;
}

function getDocumentCssKey(documentId: string) {
    return `${STORAGE_PREFIX}.document.${documentId}.css`;
}

function readTabRegistry(now = Date.now()) {
    const parsed = parseJson<TabRegistry>(localStorage.getItem(TABS_KEY));
    if (!parsed || !isRecord(parsed)) return {};

    const nextRegistry: TabRegistry = {};

    Object.entries(parsed).forEach(([tabId, lastSeen]) => {
        if (typeof lastSeen !== "number") return;
        if (now - lastSeen > TAB_STALE_AFTER_MS) return;
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

function getNavigationType(): NavigationType {
    const entries = performance.getEntriesByType("navigation");
    const entry = entries[0] as PerformanceNavigationTiming | undefined;
    if (!entry) return "navigate";
    if (entry.type === "reload") return "reload";
    if (entry.type === "back_forward") return "back_forward";
    if (entry.type === "prerender") return "prerender";
    return "navigate";
}

function isReloadLikeNavigation(type: NavigationType) {
    return type === "reload" || type === "back_forward";
}

function readWorkspaceMeta(): WorkspaceMeta | undefined {
    const parsed = parseJson<WorkspaceMeta>(localStorage.getItem(META_KEY));
    if (!parsed || !isRecord(parsed)) return undefined;
    if (parsed.version !== 1) return undefined;
    if (typeof parsed.defaultDocumentId !== "string") return undefined;
    if (!Array.isArray(parsed.order)) return undefined;
    if (!isRecord(parsed.documents)) return undefined;

    return parsed;
}

function writeWorkspaceMeta(meta: WorkspaceMeta) {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
}

function ensureDocumentContent(documentId: string, defaults: { markdown: string; css: string }) {
    const markdownKey = getDocumentMarkdownKey(documentId);
    const cssKey = getDocumentCssKey(documentId);

    if (localStorage.getItem(markdownKey) === null) {
        localStorage.setItem(markdownKey, defaults.markdown);
    }

    if (localStorage.getItem(cssKey) === null) {
        localStorage.setItem(cssKey, defaults.css);
    }
}

function ensureWorkspace(options: TabDocumentSessionOptions) {
    const existing = readWorkspaceMeta();
    if (existing) {
        Object.keys(existing.documents).forEach((documentId) => {
            ensureDocumentContent(documentId, {
                markdown: options.defaultMarkdown,
                css: options.defaultCss,
            });
        });
        return existing;
    }

    const legacyMarkdown = localStorage.getItem(LEGACY_MARKDOWN_KEY);
    const legacyCss = localStorage.getItem(LEGACY_CSS_KEY);
    const initialDocumentId = createDocumentId();

    const meta: WorkspaceMeta = {
        version: 1,
        defaultDocumentId: initialDocumentId,
        order: [initialDocumentId],
        documents: {
            [initialDocumentId]: {
                id: initialDocumentId,
                name: "Resume",
                createdAt: toIsoNow(),
            },
        },
    };

    writeWorkspaceMeta(meta);

    localStorage.setItem(getDocumentMarkdownKey(initialDocumentId), legacyMarkdown ?? options.defaultMarkdown);
    localStorage.setItem(getDocumentCssKey(initialDocumentId), legacyCss ?? options.defaultCss);

    return meta;
}

function readDocumentContent(documentId: string, defaults: { markdown: string; css: string }) {
    const markdown = localStorage.getItem(getDocumentMarkdownKey(documentId)) ?? defaults.markdown;
    const css = localStorage.getItem(getDocumentCssKey(documentId)) ?? defaults.css;

    return { markdown, css };
}

function createBranchedDocument(meta: WorkspaceMeta, sourceDocumentId: string) {
    const sourceDocument = meta.documents[sourceDocumentId];
    const sourceContent = readDocumentContent(sourceDocumentId, { markdown: "", css: "" });
    const branchedId = createDocumentId();
    const branchedAt = toIsoNow();

    const branchedDocument: WorkspaceDocument = {
        id: branchedId,
        name: `${sourceDocument?.name ?? "Resume"} Copy`,
        createdAt: branchedAt,
        branchedFrom: sourceDocumentId,
    };

    const nextMeta: WorkspaceMeta = {
        ...meta,
        order: [...meta.order, branchedId],
        documents: {
            ...meta.documents,
            [branchedId]: branchedDocument,
        },
    };

    writeWorkspaceMeta(nextMeta);
    localStorage.setItem(getDocumentMarkdownKey(branchedId), sourceContent.markdown);
    localStorage.setItem(getDocumentCssKey(branchedId), sourceContent.css);

    return branchedId;
}

function resolveSourceDocumentId(meta: WorkspaceMeta, sessionDocumentId: string | null) {
    if (sessionDocumentId && meta.documents[sessionDocumentId]) {
        return sessionDocumentId;
    }

    const focusedDocumentId = localStorage.getItem(LAST_FOCUSED_DOCUMENT_ID_KEY);
    if (focusedDocumentId && meta.documents[focusedDocumentId]) {
        return focusedDocumentId;
    }

    return meta.defaultDocumentId;
}

function resolveActiveDocumentId(meta: WorkspaceMeta, hasOtherTabs: boolean, isReloadLike: boolean) {
    const sessionDocumentId = sessionStorage.getItem(SESSION_ACTIVE_DOCUMENT_ID_KEY);
    if (isReloadLike && sessionDocumentId && meta.documents[sessionDocumentId]) {
        return sessionDocumentId;
    }

    if (hasOtherTabs) {
        const sourceDocumentId = resolveSourceDocumentId(meta, sessionDocumentId);
        return createBranchedDocument(meta, sourceDocumentId);
    }

    if (sessionDocumentId && meta.documents[sessionDocumentId]) {
        return sessionDocumentId;
    }

    const focusedDocumentId = localStorage.getItem(LAST_FOCUSED_DOCUMENT_ID_KEY);
    if (focusedDocumentId && meta.documents[focusedDocumentId]) {
        return focusedDocumentId;
    }

    return meta.defaultDocumentId;
}

function markFocusedDocument(documentId: string) {
    localStorage.setItem(LAST_FOCUSED_DOCUMENT_ID_KEY, documentId);
}

function listWorkspaceDocuments(meta: WorkspaceMeta) {
    return meta.order
        .map((documentId) => meta.documents[documentId])
        .filter((document): document is WorkspaceDocument => Boolean(document));
}

export function createTabDocumentSession(options: TabDocumentSessionOptions): TabDocumentSession {
    const navigationType = getNavigationType();
    const isReloadLike = isReloadLikeNavigation(navigationType);

    const previousTabId = sessionStorage.getItem(SESSION_TAB_ID_KEY);
    const tabId = isReloadLike && previousTabId ? previousTabId : createTabId();

    const registry = readTabRegistry();
    const hasOtherTabs = Object.keys(registry).some((openTabId) => openTabId !== tabId);

    registry[tabId] = Date.now();
    writeTabRegistry(registry);
    sessionStorage.setItem(SESSION_TAB_ID_KEY, tabId);

    const meta = ensureWorkspace(options);
    let activeDocumentId = resolveActiveDocumentId(meta, hasOtherTabs, isReloadLike);
    const content = readDocumentContent(activeDocumentId, { markdown: options.defaultMarkdown, css: options.defaultCss });
    const heartbeatIntervalId = window.setInterval(() => heartbeatTab(tabId), TAB_HEARTBEAT_INTERVAL_MS);

    const handleVisibilityChange = () => {
        if (document.visibilityState !== "visible") return;
        heartbeatTab(tabId);
        markFocusedDocument(activeDocumentId);
    };

    const handleFocus = () => {
        markFocusedDocument(activeDocumentId);
        heartbeatTab(tabId);
    };

    const handleBeforeUnload = () => {
        removeTab(tabId);
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    sessionStorage.setItem(SESSION_ACTIVE_DOCUMENT_ID_KEY, activeDocumentId);
    markFocusedDocument(activeDocumentId);

    const getDocuments = () => {
        const workspace = ensureWorkspace(options);
        return listWorkspaceDocuments(workspace);
    };

    const persistMarkdown = (value: string) => {
        localStorage.setItem(getDocumentMarkdownKey(activeDocumentId), value);
        markFocusedDocument(activeDocumentId);
    };

    const persistCss = (value: string) => {
        localStorage.setItem(getDocumentCssKey(activeDocumentId), value);
        markFocusedDocument(activeDocumentId);
    };

    const switchDocument: TabDocumentSession["switchDocument"] = (documentId) => {
        const workspace = ensureWorkspace(options);
        if (!workspace.documents[documentId]) return undefined;

        activeDocumentId = documentId;
        sessionStorage.setItem(SESSION_ACTIVE_DOCUMENT_ID_KEY, activeDocumentId);
        markFocusedDocument(activeDocumentId);
        heartbeatTab(tabId);

        return readDocumentContent(activeDocumentId, {
            markdown: options.defaultMarkdown,
            css: options.defaultCss,
        });
    };

    const dispose = () => {
        window.clearInterval(heartbeatIntervalId);
        window.removeEventListener("focus", handleFocus);
        window.removeEventListener("beforeunload", handleBeforeUnload);
        window.removeEventListener("pagehide", handleBeforeUnload);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        removeTab(tabId);
    };

    return {
        documentId: activeDocumentId,
        markdown: content.markdown,
        css: content.css,
        getActiveDocumentId: () => activeDocumentId,
        getDocuments,
        switchDocument,
        persistMarkdown,
        persistCss,
        dispose,
    };
}
