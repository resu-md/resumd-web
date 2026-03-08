import { createContext, useContext, type Accessor, type JSXElement, type Setter } from "solid-js";

const GithubResumeContext = createContext<{
    draftMarkdown: Accessor<string>;
    setDraftMarkdown: Setter<string>;
    draftCss: Accessor<string>;
    setDraftCss: Setter<string>;

    // Reference values to whitch the diff editor can compare markdown/css changes to show the diff
    sourceMarkdown: Accessor<string>;
    sourceCss: Accessor<string>;
}>();

export function GithubResumeProvider(props: { children?: JSXElement }) {
    return <GithubResumeContext.Provider value={{}}>{props.children}</GithubResumeContext.Provider>;
}

export function useGithubResumeContext() {
    const context = useContext(GithubResumeContext);
    if (!context) throw new Error("useGithubResumeContext must be used within a GithubResumeProvider");
    return context;
}
