import { createContext, createMemo, useContext, type Accessor, type JSXElement } from "solid-js";
import { useGithub } from "./GithubContext";
import { GITHUB_WORKSPACE_STORAGE_KEYS } from "@/lib/storage-keys";
import { createKeyedLocalStorageSignal } from "../../lib/createKeyedLocalStorageSignal";

const GithubResumeContext = createContext<{
    markdown: Accessor<string>;
    setMarkdown: (value: string) => void;
    css: Accessor<string>;
    setCss: (value: string) => void;
}>();

export function GithubResumeProvider(props: { children?: JSXElement }) {
    const { selectedRepository, selectedBranch, remoteMarkdown, remoteCss } = useGithub();

    const markdownKey = createMemo(() => {
        const repo = selectedRepository();
        const branch = selectedBranch();
        if (!repo || !branch) return null;

        return GITHUB_WORKSPACE_STORAGE_KEYS.MARKDOWN(repo.fullName, branch.name);
    });

    const cssKey = createMemo(() => {
        const repo = selectedRepository();
        const branch = selectedBranch();
        if (!repo || !branch) return null;

        return GITHUB_WORKSPACE_STORAGE_KEYS.CSS(repo.fullName, branch.name);
    });

    const [markdown, setMarkdown] = createKeyedLocalStorageSignal({
        key: markdownKey,
        fallback: () => remoteMarkdown() ?? "",
    });

    const [css, setCss] = createKeyedLocalStorageSignal({
        key: cssKey,
        fallback: () => remoteCss() ?? "",
    });

    return (
        <GithubResumeContext.Provider
            value={{
                markdown,
                setMarkdown,
                css,
                setCss,
                // clearMarkdownDraft,
                // clearCssDraft,
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
