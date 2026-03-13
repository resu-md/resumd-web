import { makePersisted, storageSync } from "@solid-primitives/storage";
import { createContext, createSignal, useContext, type Accessor, type JSXElement, type Setter } from "solid-js";
import { ANONYMOUS_WORKSPACE_STORAGE_KEYS } from "@/lib/storage-keys";
import defaultMarkdown from "@/templates/jakes-resume/resume.md?raw";
import defaultCss from "@/templates/jakes-resume/theme.css?raw";

type AnonymousResumeContextValue = {
    markdown: Accessor<string>;
    setMarkdown: Setter<string>;
    css: Accessor<string>;
    setCss: Setter<string>;
};

const AnonymousResumeContext = createContext<AnonymousResumeContextValue>();

export function AnonymousResumeProvider(props: { children?: JSXElement }) {
    const [markdown, setMarkdown] = makePersisted(createSignal(defaultMarkdown), {
        name: ANONYMOUS_WORKSPACE_STORAGE_KEYS.MARKDOWN,
        storage: localStorage,
        sync: storageSync,
    });
    const [css, setCss] = makePersisted(createSignal(defaultCss), {
        name: ANONYMOUS_WORKSPACE_STORAGE_KEYS.CSS,
        storage: localStorage,
        sync: storageSync,
    });

    return (
        <AnonymousResumeContext.Provider
            value={{
                markdown,
                setMarkdown,
                css,
                setCss,
            }}
        >
            {props.children}
        </AnonymousResumeContext.Provider>
    );
}

export function useAnonymousResume() {
    const ctx = useContext(AnonymousResumeContext);
    if (!ctx) throw new Error("useAnonymousResume must be used within a AnonymousResumeProvider");
    return ctx;
}
