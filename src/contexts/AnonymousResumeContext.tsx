import { makePersisted, storageSync } from "@solid-primitives/storage";
import { createContext, createSignal, useContext, type Accessor, type JSXElement, type Setter } from "solid-js";
import { ANONYMOUS_WORKSPACE_STORAGE_KEYS } from "@/lib/storage-keys";

type AnonymousResumeContextValue = {
    markdown: Accessor<string>;
    setMarkdown: Setter<string>;
    css: Accessor<string>;
    setCss: Setter<string>;
};

const AnonymousResumeContext = createContext<AnonymousResumeContextValue>();

export function AnonymousResumeProvider(props: { children?: JSXElement }) {
    const [markdown, setMarkdown] = makePersisted(
        createSignal(
            "# Hello, world!\n\nThis is a markdown editor with live preview.\n\n- Start editing the markdown on the left.\n- See the preview on the right.\n\nThis editor is anonymous and does not save your changes. Refreshing the page will reset the content.\n\nEnjoy!",
        ),
        {
            name: ANONYMOUS_WORKSPACE_STORAGE_KEYS.MARKDOWN,
            storage: localStorage,
            sync: storageSync,
        },
    );
    const [css, setCss] = makePersisted(
        createSignal(
            "body {\n    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;\n}\n\nh1 {\n    color: #4a90e2;\n}\n\np {\n    line-height: 1.5;\n}\n\nul {\n    list-style-type: square;\n    padding-left: 1.5rem;\n}\n\nli {\n    margin-bottom: 0.5rem;\n}\n",
        ),
        {
            name: ANONYMOUS_WORKSPACE_STORAGE_KEYS.CSS,
            storage: localStorage,
            sync: storageSync,
        },
    );

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
