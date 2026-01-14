import { createMemo, type Accessor } from "solid-js";
import clsx from "clsx";
// Utils
import { resolveMarkdown, type ParsedMarkdown } from "./parse-markdown";
import { exportAsPdf } from "./export-as-pdf";
import { exportAsZip } from "./export-as-zip";
import { marked } from "marked";
// Context
import { useZoom, useZoomShortcuts } from "./ZoomContext";
// Components
import ZoomControl from "./ZoomControl";
import PreviewPages from "./PreviewPages";
import SaveDropdown from "./SaveDropdown";

marked.use({
    tokenizer: {
        url(_) {
            // Disable automatic links for plain URLs/emails
            // www.example.com or test@gmail.com will not become <a> unless wrapped in [link.com](link.com)
            return undefined;
        },
    },
});

export default function Previewer(props: { class: string; markdown: Accessor<string>; css: Accessor<string> }) {
    const { zoom } = useZoom();
    const { handleKeyboardEvent, handleWheelEvent } = useZoomShortcuts();

    const parsedMarkdown = createMemo((prev: ParsedMarkdown | undefined) => resolveMarkdown(props.markdown(), prev));
    const html = createMemo(() => marked.parse(parsedMarkdown().body, { async: false }));
    const metadata = createMemo(() => parsedMarkdown().metadata, undefined, {
        equals: (prev, next) => prev.title === next.title && prev.lang === next.lang,
    });

    const handleExport = () => {
        exportAsPdf(html(), props.css(), metadata());
    };

    const handleDownloadZip = () => {
        exportAsZip(props.markdown(), props.css(), metadata());
    };

    const handleContainerKeyDown = (event: KeyboardEvent & { currentTarget: HTMLDivElement }) => {
        handleKeyboardEvent(event);
    };

    const handleContainerWheel = (event: WheelEvent & { currentTarget: HTMLDivElement }) => {
        handleWheelEvent(event);
    };

    return (
        <div
            class={clsx(props.class, "group relative flex flex-col")}
            tabIndex={0}
            onKeyDown={handleContainerKeyDown}
            onWheel={handleContainerWheel}
        >
            <div class="flex-1">
                <div style={{ zoom: `${zoom()}%`, height: "100%" }}>
                    <PreviewPages html={html()} css={props.css()} />
                </div>
            </div>

            <div class="absolute top-3 right-0 left-0 flex items-center justify-between gap-3 px-3.5">
                {/* <div class="rounded-full bg-black/15 px-2.5 py-1 text-sm backdrop-blur-md">
                    <p>{metadata().title ?? "Resume"}.pdf</p>
                </div> */}

                <div class="flex flex-[1_1_0%] justify-end gap-3 pr-2">
                    <SaveDropdown onExportPdf={handleExport} onDownloadZip={handleDownloadZip} />
                </div>
            </div>

            <div
                class={clsx(
                    "absolute right-0 bottom-5 left-0 flex items-center justify-center",
                    "opacity-0 transition-opacity delay-500 duration-200 group-hover:opacity-100 group-hover:delay-300",
                )}
            >
                <ZoomControl />
            </div>
        </div>
    );
}
