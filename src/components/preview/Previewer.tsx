import { createMemo, Show, type Accessor } from "solid-js";
import clsx from "clsx";
// Utils
import { resolveMarkdown, type ParsedMarkdown } from "./parse-markdown";
import { exportAsPdf } from "./export-as-pdf";
import { exportAsZip } from "./export-as-zip";
import { marked } from "marked";
// Context
import { useZoom, useZoomShortcuts } from "./ZoomContext";
// Assets
import { FiChevronDown, FiGitBranch } from "solid-icons/fi";
// Components
import ZoomControl from "./ZoomControl";
import PreviewPages from "./PreviewPages";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { IoFolderOpen, IoLogoGithub } from "solid-icons/io";

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

    const handleContainerKeyDown = (event: KeyboardEvent & { currentTarget: HTMLDivElement }) => {
        handleKeyboardEvent(event);
    };

    const handleContainerWheel = (event: WheelEvent & { currentTarget: HTMLDivElement }) => {
        handleWheelEvent(event);
    };

    const handleExportPdf = () => {
        exportAsPdf(html(), props.css(), metadata());
    };

    const handleDownloadZip = () => {
        exportAsZip(props.markdown(), props.css(), metadata());
    };

    return (
        <div
            class={clsx(props.class, "group relative flex flex-col select-none")}
            tabIndex={0}
            onKeyDown={handleContainerKeyDown}
            onWheel={handleContainerWheel}
        >
            <div class="flex-1">
                <div style={{ zoom: `${zoom()}%`, height: "100%" }}>
                    <PreviewPages html={html()} css={props.css()} zoom={zoom()} />
                </div>
            </div>

            <PreviewToolbar onExportPdf={handleExportPdf} onDownloadZip={handleDownloadZip} />

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

function PreviewToolbar(props: { onExportPdf: () => void; onDownloadZip: () => void }) {
    return (
        <div class="absolute top-6 right-0 left-0 flex items-center justify-between gap-3 px-3.5 pr-5">
            <Show when={false}>
                <div class="flex flex-[1_1_0%] items-center gap-2">
                    <button class="proeminent-button text-primary h-8.5 rounded-full px-4 font-mono">
                        github.com<span class="text-label-tertiary px-1.5">/</span>andrerocco
                    </button>
                    <button class="proeminent-button text-primary flex h-8.5 items-center gap-1 rounded-full font-mono">
                        <span class="ml-3 flex items-center gap-1.5">
                            <FiGitBranch class="text-green" />
                            main
                        </span>
                        <FiChevronDown class="text-label-tertiary mr-2 size-5.5 translate-y-px" />
                    </button>
                    <div class="ml-1 flex gap-1 font-mono text-sm font-medium">
                        <span class="text-green">+20</span>
                        <span class="text-red">-3</span>
                    </div>
                </div>
            </Show>

            <div class="flex flex-[1_1_0%] justify-end gap-2 pr-2">
                {/* <SaveDropdown onExportPdf={handleExportPdf} onDownloadZip={handleDownloadZip} /> */}

                <DropdownMenu placement="bottom-end" gutter={8}>
                    <DropdownMenu.Trigger class="proeminent-button text-primary flex h-8.5 items-center gap-1 rounded-full pr-2 pl-3.5">
                        Save <FiChevronDown class="text-label-tertiary size-5.5 translate-y-px" />
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                        <DropdownMenu.Content class="proeminent-button flex flex-col gap-[4px] rounded-[22px] p-[6px]">
                            <DropdownMenu.Item
                                disabled
                                class="text-label-primary hover:bg-fill-tertiary flex h-8.5 w-full cursor-pointer items-center gap-1 rounded-full pr-4 pl-2 text-sm data-disabled:cursor-not-allowed data-disabled:opacity-50"
                                title="GitHub integration coming soon."
                            >
                                <IoLogoGithub size={18} class="text-label-secondary mr-0.5 w-6" />
                                <span>Push to GitHub</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                                class="text-label-primary hover:bg-fill-tertiary flex h-8.5 w-full cursor-pointer items-center gap-1 rounded-full pr-4 pl-2 text-sm"
                                onSelect={props.onDownloadZip}
                            >
                                <IoFolderOpen size={16} class="text-label-secondary mr-0.5 w-6" />
                                <span>Download sources as .zip</span>
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu>
                <button
                    class={clsx(
                        "h-8.5 items-center justify-center gap-1.5 rounded-full px-3 text-white",
                        "bg-linear-to-b from-[#4da3ff] to-[#007aff] shadow-[inset_0_0_1px_1px_#ffffff33,0_2px_20px_#0000000a] backdrop-blur-md",
                        "outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#007aff]",
                    )}
                    onClick={props.onExportPdf}
                >
                    Export as PDF
                </button>
            </div>
        </div>
    );
}
