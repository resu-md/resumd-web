import { createMemo, type Accessor, type JSXElement } from "solid-js";
import clsx from "clsx";
import { marked } from "marked";
// Context
import { useZoom, useZoomShortcuts, ZoomProvider } from "./zoom/ZoomContext";
// Components
import ZoomControl from "./zoom/ZoomControl";
import PagedPdf from "./paged-pdf/PagedPdf";
import { resolveMarkdown, type ParsedMarkdown } from "@/lib/parse-markdown";

type PreviewProps = {
    markdown: Accessor<string>;
    css: Accessor<string>;
    children?: (parsedMarkdown: Accessor<ParsedMarkdown>, html: Accessor<string>) => JSXElement;
};

export default function Preview(props: PreviewProps) {
    return (
        <ZoomProvider>
            <_Preview markdown={props.markdown} css={props.css}>
                {(parsedMarkdown, html) => props.children?.(parsedMarkdown, html)}
            </_Preview>
        </ZoomProvider>
    );
}

marked.use({
    tokenizer: {
        url(_) {
            // Disable automatic links for plain URLs/emails
            // www.example.com or test@gmail.com will not become <a> unless wrapped in [link.com](link.com)
            return undefined;
        },
    },
});

function _Preview(props: PreviewProps) {
    const { zoom } = useZoom();
    const { handleKeyboardEvent, handleWheelEvent } = useZoomShortcuts();

    const parsedMarkdown = createMemo((prev: ParsedMarkdown | undefined) => resolveMarkdown(props.markdown(), prev));
    const html = createMemo(() => marked.parse(parsedMarkdown().body, { async: false }));

    const handleContainerKeyDown = (event: KeyboardEvent & { currentTarget: HTMLDivElement }) => {
        handleKeyboardEvent(event);
    };
    const handleContainerWheel = (event: WheelEvent & { currentTarget: HTMLDivElement }) => {
        handleWheelEvent(event);
    };

    return (
        <div
            class="group h-full w-full select-none"
            tabIndex={0}
            onKeyDown={handleContainerKeyDown}
            onWheel={handleContainerWheel}
        >
            {props.children?.(parsedMarkdown, html)}

            <div style={{ zoom: `${zoom()}%`, height: "100%" }}>
                <PagedPdf html={html()} css={props.css()} zoom={zoom()} />
            </div>

            <div
                class={clsx(
                    "absolute right-0 bottom-5 left-0 flex items-center justify-center",
                    "opacity-0 transition-opacity delay-300 duration-200 group-hover:opacity-100 group-hover:delay-0",
                )}
            >
                <ZoomControl />
            </div>
        </div>
    );
}
