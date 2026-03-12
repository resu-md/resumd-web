import { createContext, createMemo, createSignal, useContext, type Accessor, type JSXElement } from "solid-js";
import { GITHUB_WORKSPACE_STORAGE_KEYS } from "@/lib/storage-keys";
import { useGithub } from "./GithubContext";
import { createDraftablePersistedSignal } from "./createDraftablePersistedSignal";
import { apiFetch, withSearch } from "@/lib/fetch";
import type { SaveRepoResponse } from "@resumd/api/types";

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
    isCommitting: Accessor<boolean>;
    commit: (message?: string) => Promise<void>;
};

const GithubResumeContext = createContext<GithubResumeContextValue>();

export function GithubResumeProvider(props: { children?: JSXElement }) {
    const {
        selectedRepository,
        selectedBranch,
        remoteMarkdown,
        remoteMarkdownPath,
        remoteCss,
        remoteCssPath,
        remoteHeadSha,
        refetchFiles,
    } = useGithub();

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

    const [isCommitting, setIsCommitting] = createSignal(false);

    const commit = async (message?: string) => {
        const repository = selectedRepository();
        const branch = selectedBranch();
        if (!repository || !branch || isCommitting()) return;

        setIsCommitting(true);
        try {
            await apiFetch<SaveRepoResponse>(
                withSearch("/api/save", { owner: repository.owner, repo: repository.repo }),
                {
                    method: "POST",
                    body: JSON.stringify({
                        targetBranch: branch.name,
                        expectedHeadSha: remoteHeadSha() ?? branch.commitSha,
                        message,
                        files: {
                            markdown: doc().markdown,
                            css: doc().css,
                            markdownPath: remoteMarkdownPath() ?? "resume.md",
                            cssPath: remoteCssPath() ?? "resume.css",
                        },
                    }),
                },
            );

            await refetchFiles();

            if (remoteMarkdown() === doc().markdown && remoteCss() === doc().css) {
                clearDraft();
            }
        } finally {
            setIsCommitting(false);
        }
    };

    return (
        <GithubResumeContext.Provider
            value={{
                markdown,
                setMarkdown,
                css,
                setCss,
                clearDraft,
                isCommitting,
                commit,
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
