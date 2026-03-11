import {
    createContext,
    createEffect,
    createMemo,
    createRenderEffect,
    createSignal,
    on,
    onCleanup,
    onMount,
    useContext,
    type Accessor,
    type JSXElement,
} from "solid-js";
import { GITHUB_WORKSPACE_STORAGE_KEYS } from "@/lib/storage-keys";
import { useGithub } from "./GithubContext";
import type { BranchInformation, RepositoryInformation } from "@resumd/api/types";

type ResumeDoc = {
    markdown: string;
    css: string;
};

type GithubResumeContextValue = {
    markdown: Accessor<string>;
    setMarkdown: (value: string | ((prev: string) => string)) => void;
    css: Accessor<string>;
    setCss: (value: string | ((prev: string) => string)) => void;
};

const GithubResumeContext = createContext<GithubResumeContextValue>();

function canUseStorage() {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function parseStoredDoc(raw: string | null, fallback: ResumeDoc): ResumeDoc {
    if (!raw) return fallback;

    try {
        const parsed = JSON.parse(raw) as Partial<ResumeDoc>;
        return {
            markdown: typeof parsed.markdown === "string" ? parsed.markdown : fallback.markdown,
            css: typeof parsed.css === "string" ? parsed.css : fallback.css,
        };
    } catch {
        return fallback;
    }
}

export function GithubResumeProvider(props: {
    children?: JSXElement;
    repository: RepositoryInformation;
    branch: BranchInformation;
}) {
    const { remoteMarkdown, remoteCss } = useGithub();

    const workspaceStorageKey = createMemo(() => {
        return `resumd.github_workspace.doc:${props.repository.fullName}:${props.branch.name}`;
    });

    const getRemoteDoc = (): ResumeDoc => ({
        markdown: remoteMarkdown() ?? "",
        css: remoteCss() ?? "",
    });

    const readCurrentWorkspace = (): ResumeDoc => {
        const key = workspaceStorageKey();
        const fallback = getRemoteDoc();

        if (!canUseStorage() || !key) return fallback;

        return parseStoredDoc(window.localStorage.getItem(key), fallback);
    };

    const [doc, setDoc] = createSignal<ResumeDoc>(readCurrentWorkspace());

    // Tracks the last serialized snapshot we applied/wrote,
    // so we don't bounce the same value back into storage.
    let lastSerialized = JSON.stringify(doc());

    const applyDoc = (next: ResumeDoc) => {
        const serialized = JSON.stringify(next);
        if (serialized === lastSerialized) return;
        lastSerialized = serialized;
        setDoc(next);
    };

    // Reload atomically when repo/branch changes
    createRenderEffect(
        on(workspaceStorageKey, () => {
            const next = readCurrentWorkspace();
            lastSerialized = JSON.stringify(next);
            setDoc(next);
        }),
    );

    // If remote content arrives later and there is still no local draft for this workspace,
    // hydrate from remote without overwriting an existing local draft.
    createEffect(
        on([workspaceStorageKey, remoteMarkdown, remoteCss], ([key]) => {
            const fallback = getRemoteDoc();

            if (!canUseStorage() || !key) {
                applyDoc(fallback);
                return;
            }

            const raw = window.localStorage.getItem(key);
            if (raw != null) return;

            applyDoc(fallback);
        }),
    );

    // Persist local edits for the current workspace
    createEffect(() => {
        const key = workspaceStorageKey();
        if (!canUseStorage() || !key) return;

        const serialized = JSON.stringify(doc());
        if (serialized === lastSerialized) return;

        lastSerialized = serialized;
        window.localStorage.setItem(key, serialized);
    });

    // Cross-tab sync for the current workspace
    onMount(() => {
        if (!canUseStorage()) return;

        const onStorage = (event: StorageEvent) => {
            const key = workspaceStorageKey();
            if (!key) return;

            if (event.storageArea !== window.localStorage) return;
            if (event.key !== key) return;

            const next = parseStoredDoc(event.newValue, getRemoteDoc());
            applyDoc(next);
        };

        window.addEventListener("storage", onStorage);
        onCleanup(() => window.removeEventListener("storage", onStorage));
    });

    const markdown = () => doc().markdown;
    const css = () => doc().css;

    const setMarkdown = (value: string | ((prev: string) => string)) => {
        setDoc((prev) => {
            const nextMarkdown = typeof value === "function" ? value(prev.markdown) : value;
            if (nextMarkdown === prev.markdown) return prev;
            return { ...prev, markdown: nextMarkdown };
        });
    };

    const setCss = (value: string | ((prev: string) => string)) => {
        setDoc((prev) => {
            const nextCss = typeof value === "function" ? value(prev.css) : value;
            if (nextCss === prev.css) return prev;
            return { ...prev, css: nextCss };
        });
    };

    return (
        <GithubResumeContext.Provider
            value={{
                markdown,
                setMarkdown,
                css,
                setCss,
            }}
        >
            {props.children}
        </GithubResumeContext.Provider>
    );
}

export function useGithubResume() {
    const context = useContext(GithubResumeContext);
    if (!context) throw new Error("useGithubResume must be used within a GithubResumeProvider");
    return context;
}
