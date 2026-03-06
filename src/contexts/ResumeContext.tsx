import { makePersisted, storageSync } from "@solid-primitives/storage";
import { createContext, createSignal, useContext, type Accessor, type JSXElement, type Setter } from "solid-js";
import { RESUME_STORAGE_KEYS } from "@/lib/storage-keys";

type ResumeContextValue = {
    css: Accessor<string>;
    setCss: Setter<string>;
    markdown: Accessor<string>;
    setMarkdown: Setter<string>;
};

const ResumeContext = createContext<ResumeContextValue>();

export function ResumeProvider(props: { children?: JSXElement }) {
    const [css, setCss] = makePersisted(createSignal(""), {
        name: RESUME_STORAGE_KEYS.LOCAL_CSS,
        storage: localStorage,
        sync: storageSync,
    });
    const [markdown, setMarkdown] = makePersisted(createSignal(""), {
        name: RESUME_STORAGE_KEYS.LOCAL_MARKDOWN,
        storage: localStorage,
        sync: storageSync,
    });

    return (
        <ResumeContext.Provider
            value={{
                css,
                setCss,
                markdown,
                setMarkdown,
            }}
        >
            {props.children}
        </ResumeContext.Provider>
    );
}

export function useResume() {
    const ctx = useContext(ResumeContext);
    if (!ctx) throw new Error("useResume must be used within a ResumeProvider");
    return ctx;
}
