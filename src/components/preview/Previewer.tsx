import { For, Show, createMemo, type Accessor } from "solid-js";
import clsx from "clsx";
// Utils
import { resolveMarkdown, type ParsedMarkdown } from "./parse-markdown";
import { exportAsPdf } from "./export-as-pdf";
import { exportAsZip } from "./export-as-zip";
import { marked } from "marked";
import type { WorkspaceDocument } from "@/lib/workspace";
// Context
import { useZoom, useZoomShortcuts } from "./ZoomContext";
// Assets
import { FiChevronDown } from "solid-icons/fi";
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

export default function Previewer(props: {
    class: string;
    markdown: Accessor<string>;
    css: Accessor<string>;
    activeDocumentId: string;
    currentDocumentName: string;
    documents: WorkspaceDocument[];
    onSelectDocument: (documentId: string) => void;
}) {
    const { zoom } = useZoom();
    const { handleKeyboardEvent, handleWheelEvent } = useZoomShortcuts();

    const parsedMarkdown = createMemo((prev: ParsedMarkdown | undefined) => resolveMarkdown(props.markdown(), prev));
    const html = createMemo(() => marked.parse(parsedMarkdown().body, { async: false }));
    const metadata = createMemo(() => parsedMarkdown().metadata, undefined, {
        equals: (prev, next) => prev.title === next.title && prev.lang === next.lang,
    });
    const currentResumeTitle = createMemo(() => metadata().title || props.currentDocumentName);

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

            <PreviewToolbar
                onExportPdf={handleExportPdf}
                onDownloadZip={handleDownloadZip}
                activeDocumentId={props.activeDocumentId}
                documents={props.documents}
                currentDocumentTitle={currentResumeTitle()}
                onSelectDocument={props.onSelectDocument}
            />

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

function PreviewToolbar(props: {
    onExportPdf: () => void;
    onDownloadZip: () => void;
    activeDocumentId: string;
    currentDocumentTitle: string;
    documents: WorkspaceDocument[];
    onSelectDocument: (documentId: string) => void;
}) {
    return (
        <div class="absolute top-4 right-0 left-0 flex items-center justify-between gap-3 px-5">
            <div class="flex flex-[1_1_0%] items-center gap-1.5"></div>

            <div class="">
                <DropdownMenu placement="bottom" gutter={8}>
                    <DropdownMenu.Trigger class="flex items-center gap-1 text-sm">
                        {props.currentDocumentTitle}
                        <FiChevronDown class="text-label-tertiary size-5" />
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                        <DropdownMenu.Content class="proeminent-button flex min-w-48 flex-col rounded-[21px] p-[5px]">
                            <For each={props.documents}>
                                {(document) => (
                                    <DropdownMenu.Item
                                        class="text-label-primary hover:bg-fill-secondary flex h-8.5 w-full cursor-pointer items-center justify-between gap-3 rounded-full pr-3 pl-4"
                                        onSelect={() => props.onSelectDocument(document.id)}
                                    >
                                        <span class="truncate">{document.name}</span>
                                        <Show when={document.id === props.activeDocumentId}>
                                            <span class="text-label-secondary text-xs">Current</span>
                                        </Show>
                                    </DropdownMenu.Item>
                                )}
                            </For>
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu>
            </div>

            <div class="flex flex-[1_1_0%] justify-end gap-2 pr-2">
                <DropdownMenu placement="bottom-end" gutter={8}>
                    <DropdownMenu.Trigger class="proeminent-button text-primary flex h-8.5 items-center gap-1 rounded-full pr-2 pl-3.5">
                        Save <FiChevronDown class="text-label-tertiary size-5 translate-y-px" />
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                        <DropdownMenu.Content class="proeminent-button flex flex-col rounded-[21px] p-[5px]">
                            <DropdownMenu.Item
                                disabled
                                class="text-label-primary hover:bg-fill-secondary flex h-8.5 w-full cursor-pointer items-center gap-1 rounded-full pr-4 pl-2 data-disabled:cursor-not-allowed"
                                title="GitHub integration coming soon."
                            >
                                <IoLogoGithub size={18} class="mr-0.5 w-6" />
                                <span class="mt-px">Push to GitHub</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                                class="text-label-primary hover:bg-fill-secondary flex h-8.5 w-full cursor-pointer items-center gap-1 rounded-full pr-4 pl-2"
                                onSelect={props.onDownloadZip}
                            >
                                <IoFolderOpen size={16} class="mr-0.5 w-6" />
                                <span class="mt-px">Download sources as .zip</span>
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
