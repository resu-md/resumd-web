import { RESUME_STORAGE_KEYS } from "@/lib/storage-keys";
import { makePersisted, storageSync } from "@solid-primitives/storage";
import { useParams } from "@solidjs/router";
import {
    batch,
    createContext,
    createMemo,
    createSignal,
    Show,
    useContext,
    type Accessor,
    type JSXElement,
    type Setter,
} from "solid-js";
import { useGithubAuth } from "./github/GithubAuthContext";
import { useGithubRepository } from "./github/GithubRepositoryContext";

export type ResumeContent = {
    markdown: string;
    css: string;
};

type ResumeContextValue = {
    resumeId: Accessor<string>;
    switchResume: (resumeId: string) => void;
    css: Accessor<string>;
    setCss: Setter<string>;
    markdown: Accessor<string>;
    setMarkdown: Setter<string>;
    cssDirty: Accessor<boolean>;
    markdownDirty: Accessor<boolean>;
    isDirty: Accessor<boolean>;
    applyContent: (content: Partial<ResumeContent>, options?: { markClean?: boolean }) => void;
    markCurrentAsClean: () => void;
};

const ResumeContext = createContext<ResumeContextValue>();

function newResumeId() {
    return `resume_${crypto.randomUUID()}`;
}

function buildGithubResumeId(owner: string, repo: string, branch: string) {
    return `github:${encodeURIComponent(owner)}/${encodeURIComponent(repo)}#${encodeURIComponent(branch)}`;
}

function ResumeSession(props: { resumeId: string; switchResume: (resumeId: string) => void; children?: JSXElement }) {
    const cssKey = `resumd.resume.${props.resumeId}.css`;
    const markdownKey = `resumd.resume.${props.resumeId}.md`;
    const cleanCssKey = `resumd.resume.${props.resumeId}.css.clean`;
    const cleanMarkdownKey = `resumd.resume.${props.resumeId}.md.clean`;

    const [css, setRawCss] = makePersisted(createSignal(""), {
        name: cssKey,
        storage: localStorage,
        sync: storageSync,
    });
    const [markdown, setRawMarkdown] = makePersisted(createSignal(""), {
        name: markdownKey,
        storage: localStorage,
        sync: storageSync,
    });
    const [cleanCss, setCleanCss] = makePersisted(createSignal(""), {
        name: cleanCssKey,
        storage: localStorage,
        sync: storageSync,
    });
    const [cleanMarkdown, setCleanMarkdown] = makePersisted(createSignal(""), {
        name: cleanMarkdownKey,
        storage: localStorage,
        sync: storageSync,
    });

    if (localStorage.getItem(cleanCssKey) == null) setCleanCss(css());
    if (localStorage.getItem(cleanMarkdownKey) == null) setCleanMarkdown(markdown());

    const cssDirty = createMemo(() => css() !== cleanCss());
    const markdownDirty = createMemo(() => markdown() !== cleanMarkdown());
    const isDirty = createMemo(() => cssDirty() || markdownDirty());

    const setCss: Setter<string> = (value) => setRawCss(value);
    const setMarkdown: Setter<string> = (value) => setRawMarkdown(value);

    const applyContent = (content: Partial<ResumeContent>, options?: { markClean?: boolean }) => {
        const markClean = options?.markClean ?? true;
        batch(() => {
            if (content.markdown !== undefined) {
                setRawMarkdown(content.markdown);
                if (markClean) setCleanMarkdown(content.markdown);
            }
            if (content.css !== undefined) {
                setRawCss(content.css);
                if (markClean) setCleanCss(content.css);
            }
        });
    };

    const markCurrentAsClean = () => {
        batch(() => {
            setCleanMarkdown(markdown());
            setCleanCss(css());
        });
    };

    return (
        <ResumeContext.Provider
            value={{
                resumeId: () => props.resumeId,
                switchResume: props.switchResume,
                css,
                setCss,
                markdown,
                setMarkdown,
                cssDirty,
                markdownDirty,
                isDirty,
                applyContent,
                markCurrentAsClean,
            }}
        >
            {props.children}
        </ResumeContext.Provider>
    );
}

export function ResumeProvider(props: { children?: JSXElement }) {
    const params = useParams<{ owner?: string; repo?: string }>();
    const { status } = useGithubAuth();
    const { selectedBranch } = useGithubRepository();

    const [anonymousResumeId, setAnonymousResumeId] = makePersisted(createSignal<string | null>(null), {
        name: RESUME_STORAGE_KEYS.CURRENT_RESUME_ID,
        storage: localStorage,
        sync: storageSync,
    });
    const firstAnonymousResumeId = anonymousResumeId() ?? newResumeId();
    if (anonymousResumeId() == null) setAnonymousResumeId(firstAnonymousResumeId);

    const currentResumeId = createMemo(() => {
        const isGithubEditorRoute = Boolean(params.owner && params.repo);
        if (status() !== "authenticated" || !isGithubEditorRoute) {
            return anonymousResumeId() ?? firstAnonymousResumeId;
        }

        const branch = selectedBranch()?.name;
        if (!branch) return `github:${encodeURIComponent(params.owner!)}/${encodeURIComponent(params.repo!)}#pending`;

        return buildGithubResumeId(params.owner!, params.repo!, branch);
    });

    return (
        <Show when={currentResumeId()} keyed>
            {(resumeId) => (
                <ResumeSession resumeId={resumeId} switchResume={(value) => setAnonymousResumeId(value)}>
                    {props.children}
                </ResumeSession>
            )}
        </Show>
    );
}

export function useResume() {
    const ctx = useContext(ResumeContext);
    if (!ctx) throw new Error("useResume must be used within a ResumeProvider");
    return ctx;
}
