import {
    batch,
    createContext,
    createEffect,
    createMemo,
    createRenderEffect,
    on,
    useContext,
    type JSXElement,
} from "solid-js";
import { createStore } from "solid-js/store";
import { useGithub } from "./GithubContext";
import type { BranchInformation, RepositoryInformation } from "@resumd/api/types";

type ResumeDoc = {
    markdown: string;
    css: string;
};

type GithubResumeContextValue = {
    markdown: () => string;
    setMarkdown: (v: string | ((p: string) => string)) => void;
    css: () => string;
    setCss: (v: string | ((p: string) => string)) => void;
};

const GithubResumeContext = createContext<GithubResumeContextValue>();

export function GithubResumeProvider(props: {
    children?: JSXElement;
    repository: RepositoryInformation;
    branch: BranchInformation;
}) {
    const { remoteMarkdown, remoteCss } = useGithub();

    const workspaceKey = createMemo(() => {
        const repository = props.repository;
        const branch = props.branch;
        return `resume:${repository.fullName}:${branch.name}`;
    });

    const [doc, setDoc] = createStore<ResumeDoc>({
        markdown: "",
        css: "",
    });

    const readWorkspace = (key: string | null): ResumeDoc => {
        if (!key) {
            return {
                markdown: remoteMarkdown() ?? "",
                css: remoteCss() ?? "",
            };
        }

        const raw = localStorage.getItem(key);
        if (!raw) {
            return {
                markdown: remoteMarkdown() ?? "",
                css: remoteCss() ?? "",
            };
        }

        try {
            const parsed = JSON.parse(raw) as Partial<ResumeDoc>;
            return {
                markdown: parsed.markdown ?? remoteMarkdown() ?? "",
                css: parsed.css ?? remoteCss() ?? "",
            };
        } catch {
            return {
                markdown: remoteMarkdown() ?? "",
                css: remoteCss() ?? "",
            };
        }
    };

    // Load the whole workspace atomically when repo/branch changes
    createRenderEffect(
        on(workspaceKey, (key) => {
            const next = readWorkspace(key);
            batch(() => {
                setDoc("markdown", next.markdown);
                setDoc("css", next.css);
            });
        }),
    );

    // Persist the whole workspace atomically
    createEffect(
        on(
            [workspaceKey, () => doc.markdown, () => doc.css],
            ([key, markdown, css]) => {
                if (!key) return;
                localStorage.setItem(key, JSON.stringify({ markdown, css }));
            },
            { defer: true },
        ),
    );

    return (
        <GithubResumeContext.Provider
            value={{
                markdown: () => doc.markdown,
                setMarkdown: (v) => setDoc("markdown", typeof v === "function" ? v(doc.markdown) : v),
                css: () => doc.css,
                setCss: (v) => setDoc("css", typeof v === "function" ? v(doc.css) : v),
            }}
        >
            {props.children}
        </GithubResumeContext.Provider>
    );
}

export function useGithubResume() {
    const context = useContext(GithubResumeContext);
    if (!context) {
        throw new Error("useGithubResume must be used within a GithubResumeProvider");
    }
    return context;
}
