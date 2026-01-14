import { createSignal, Show } from "solid-js";
import clsx from "clsx";
import { IoChevronDownOutline, IoDocumentOutline, IoFolderOpenOutline, IoLogoGithub } from "solid-icons/io";

interface SaveDropdownProps {
    onExportPdf: () => void;
    onDownloadZip: () => void;
}

export default function SaveDropdown(props: SaveDropdownProps) {
    const [isOpen, setIsOpen] = createSignal(false);
    let dropdownRef: HTMLDivElement | undefined;

    const handleToggle = () => {
        setIsOpen(!isOpen());
    };

    const handleExportPdf = () => {
        props.onExportPdf();
        setIsOpen(false);
    };

    const handleDownloadZip = () => {
        props.onDownloadZip();
        setIsOpen(false);
    };

    return (
        <div class="relative" ref={dropdownRef}>
            <button
                class="bg-blue outline-blue focus-active:outline-2 flex h-7 cursor-pointer items-center gap-1.25 rounded-lg py-1.5 pr-2 pl-2.5 font-medium tracking-tight text-white outline-offset-2 backdrop-blur-md active:outline-2"
                onClick={handleToggle}
            >
                <span>Save resume</span>
                <IoChevronDownOutline size={16} class={clsx("translate-y-px", isOpen() && "rotate-180")} />
            </button>

            <Show when={isOpen()}>
                <div class="bg-fill-secondary shadow-tertiary absolute top-full right-0 z-10 mt-2 w-52 overflow-hidden rounded-lg backdrop-blur-xl">
                    <div class="p-1">
                        <button
                            class="text-label-primary hover:bg-blue flex h-7 w-full items-center gap-2.5 rounded-md pr-3 pl-2 text-left text-[13px] hover:text-white"
                            onClick={handleExportPdf}
                        >
                            <IoDocumentOutline size={14} />
                            <span>Export as PDF</span>
                        </button>
                        <button
                            class="text-label-primary hover:bg-blue flex h-7 w-full items-center gap-2.5 rounded-md pr-3 pl-2 text-left text-[13px] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={true}
                            title="GitHub integration coming soon."
                        >
                            <IoLogoGithub size={15} />
                            <span>Push to GitHub</span>
                        </button>
                        <button
                            class="text-label-primary hover:bg-blue flex h-7 w-full items-center gap-2.5 rounded-md pr-3 pl-2 text-left text-[13px] hover:text-white"
                            onClick={handleDownloadZip}
                        >
                            <IoFolderOpenOutline size={14} />
                            <span>Download sources as .zip</span>
                        </button>
                    </div>
                </div>
            </Show>
        </div>
    );
}
