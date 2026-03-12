import { createContext, createMemo, useContext, type Accessor, type JSXElement } from "solid-js";
import { GITHUB_WORKSPACE_STORAGE_KEYS } from "@/lib/storage-keys";
import { useGithub } from "./GithubContext";
import { createDraftablePersistedSignal } from "./createDraftablePersistedSignal";

type ResumeDoc = {
    markdown: string;
    css: string;
};

type GithubResumeContextValue = {
    markdown: Accessor<string>;
    setMarkdown: (value: string | ((prev: string) => string)) => void;
    css: Accessor<string>;
    setCss: (value: string | ((prev: string) => string)) => void;
    clearDraft: () => void;
};

const GithubResumeContext = createContext<GithubResumeContextValue>();

export function GithubResumeProvider(props: { children?: JSXElement }) {
    const { selectedRepository, selectedBranch, remoteMarkdown, remoteCss } = useGithub();

    const workspaceStorageKey = createMemo(() =>
        selectedBranch() && selectedRepository()
            ? GITHUB_WORKSPACE_STORAGE_KEYS.WORKSPACE(selectedRepository()!.fullName, selectedBranch()!.name)
            : "",
    );

    const getRemoteDoc = (): ResumeDoc => ({
        markdown: remoteMarkdown() ?? "",
        css: remoteCss() ?? "",
    });

    const [doc, setDoc, clearDraft] = createDraftablePersistedSignal<ResumeDoc>({
        key: workspaceStorageKey,
        fallback: getRemoteDoc,
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
                clearDraft,
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
