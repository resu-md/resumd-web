import { createMemo, createSignal, type Accessor } from "solid-js";
import clsx from "clsx";
// Utils
import { resolveMarkdown, type ParsedMarkdown } from "./parse-markdown";
import { exportAsPdf } from "./export-as-pdf";
import { marked } from "marked";
// Components
import ZoomControl from "./ZoomControl";
import PreviewPages from "./PreviewPages";

export default function Previewer(props: { class: string; markdown: Accessor<string>; css: Accessor<string> }) {
    const [zoom, setZoom] = createSignal(100);

    const parsedMarkdown = createMemo((prev: ParsedMarkdown | undefined) => resolveMarkdown(props.markdown(), prev));
    const html = createMemo(() => marked.parse(parsedMarkdown().body, { async: false, breaks: true }));
    const metadata = createMemo(() => parsedMarkdown().metadata, undefined, {
        equals: (prev, next) => prev.title === next.title && prev.lang === next.lang,
    });

    const handleExport = () => {
        exportAsPdf(html(), props.css(), metadata());
    };

    return (
        <div class={clsx(props.class, "relative flex flex-col")}>
            <div class="flex-1">
                <div style={{ zoom: `${zoom()}%`, height: "100%" }}>
                    <PreviewPages html={html()} css={props.css()} />
                </div>
            </div>

            <div class="absolute top-3 right-0 left-0 flex items-center justify-between gap-3 px-3.5">
                <div class="flex-[1_1_0%]">
                    <ZoomControl zoom={zoom} setZoom={setZoom} />
                </div>

                <div class="rounded-full bg-black/15 px-2.5 py-1 text-sm backdrop-blur-md">
                    <p>{metadata().title ?? "Resume"}.pdf</p>
                </div>

                <div class="flex flex-[1_1_0%] justify-end gap-3 pr-2">
                    <button
                        class="bg-blue outline-blue focus-active:outline-2 flex h-9 cursor-pointer items-center rounded-full px-3.5 font-medium tracking-tight text-white outline-offset-2 backdrop-blur-md active:outline-2"
                        onClick={handleExport}
                        title="Export PDF"
                    >
                        <p>Export as PDF</p>
                        {/* <IoDownloadOutline class="mr-3 ml-2 size-5" /> */}
                    </button>
                </div>
            </div>
        </div>
    );
}
