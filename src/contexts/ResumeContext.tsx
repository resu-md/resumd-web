// import { RESUME_STORAGE_KEYS } from "@/lib/storage-keys";
// import { makePersisted, storageSync } from "@solid-primitives/storage";
// import { createContext, createSignal, Show, useContext, type Accessor, type JSXElement, type Setter } from "solid-js";

// type ResumeContextValue = {
//     resumeId: Accessor<string>;
//     switchResume: (resumeId: string) => void;
//     css: Accessor<string>;
//     setCss: Setter<string>;
//     markdown: Accessor<string>;
//     setMarkdown: Setter<string>;
// };

// const ResumeContext = createContext<ResumeContextValue>();

// function newResumeId() {
//     return `resume_${crypto.randomUUID()}`;
// }

// function ResumeSession(props: { resumeId: string; switchResume: (resumeId: string) => void; children?: JSXElement }) {
//     const [css, setCss] = makePersisted(createSignal(""), {
//         name: `resumd.resume.${props.resumeId}.css`,
//         storage: localStorage,
//         sync: storageSync,
//     });
//     const [markdown, setMarkdown] = makePersisted(createSignal(""), {
//         name: `resumd.resume.${props.resumeId}.md`,
//         storage: localStorage,
//         sync: storageSync,
//     });

//     return (
//         <ResumeContext.Provider
//             value={{
//                 resumeId: () => props.resumeId,
//                 switchResume: props.switchResume,
//                 css,
//                 setCss,
//                 markdown,
//                 setMarkdown,
//             }}
//         >
//             {props.children}
//         </ResumeContext.Provider>
//     );
// }

// export function ResumeProvider(props: { children?: JSXElement }) {
//     const [currentResumeId, setCurrentResumeId] = makePersisted(createSignal<string | null>(null), {
//         name: RESUME_STORAGE_KEYS.CURRENT_RESUME_ID,
//         storage: localStorage,
//     });

//     const firstResumeId = currentResumeId() ?? newResumeId();
//     if (currentResumeId() == null) setCurrentResumeId(firstResumeId);

//     console.log("Current Resume ID:", currentResumeId());

//     // Using keyed Show to ensure that when currentResumeId changes, the entire ResumeSession is remounted, thus loading the new resume's data from localStorage.
//     return (
//         <Show when={currentResumeId()} keyed>
//             {(resumeId) => (
//                 <ResumeSession resumeId={resumeId} switchResume={(value) => setCurrentResumeId(value)}>
//                     {props.children}
//                 </ResumeSession>
//             )}
//         </Show>
//     );
// }

// export function useResume() {
//     const ctx = useContext(ResumeContext);
//     if (!ctx) throw new Error("useResume must be used within a ResumeProvider");
//     return ctx;
// }

import { makePersisted, storageSync } from "@solid-primitives/storage";
import { createContext, createSignal, useContext, type Accessor, type JSXElement, type Setter } from "solid-js";

type ResumeContextValue = {
    css: Accessor<string>;
    setCss: Setter<string>;
    markdown: Accessor<string>;
    setMarkdown: Setter<string>;
};

const ResumeContext = createContext<ResumeContextValue>();

export function ResumeProvider(props: { children?: JSXElement }) {
    const [css, setCss] = makePersisted(createSignal(""), {
        name: `temp_key.css`, // TEMP
        storage: localStorage,
        sync: storageSync,
    });
    const [markdown, setMarkdown] = makePersisted(createSignal(""), {
        name: `temp_key.md`, // TEMP
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
