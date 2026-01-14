import { createSignal } from "solid-js";
import clsx from "clsx";
import { DropdownMenu } from "@kobalte/core";
import { IoChevronDownOutline, IoDocumentOutline, IoFolderOpenOutline, IoLogoGithub } from "solid-icons/io";

interface SaveDropdownProps {
    onExportPdf: () => void;
    onDownloadZip: () => void;
}

export default function SaveDropdown(props: SaveDropdownProps) {
    const [isOpen, setIsOpen] = createSignal(false);

    return (
        <DropdownMenu.Root open={isOpen()} onOpenChange={setIsOpen}>
            <DropdownMenu.Trigger>
                <button class="bg-blue outline-blue focus-active:outline-2 flex h-7 cursor-pointer items-center gap-1.25 rounded-lg py-1.5 pr-2 pl-2.5 font-medium tracking-tight text-white outline-offset-2 backdrop-blur-md active:outline-2">
                    <span>Save resume</span>
                    <IoChevronDownOutline size={16} class={clsx("translate-y-px", isOpen() && "rotate-180")} />
                </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content class="bg-fill-secondary shadow-tertiary z-10 mt-2 w-52 overflow-hidden rounded-lg p-1 backdrop-blur-xl">
                    <DropdownMenu.Item
                        class="text-label-primary hover:bg-blue flex h-7 w-full items-center gap-2.5 rounded-md pr-3 pl-2 text-left text-[13px] hover:text-white"
                        onSelect={props.onExportPdf}
                    >
                        <IoDocumentOutline size={14} />
                        <span>Export as PDF</span>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                        disabled
                        class="text-label-primary hover:bg-blue flex h-7 w-full items-center gap-2.5 rounded-md pr-3 pl-2 text-left text-[13px] hover:text-white data-disabled:cursor-not-allowed data-disabled:opacity-50"
                        title="GitHub integration coming soon."
                    >
                        <IoLogoGithub size={15} />
                        <span>Push to GitHub</span>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                        class="text-label-primary hover:bg-blue flex h-7 w-full items-center gap-2.5 rounded-md pr-3 pl-2 text-left text-[13px] hover:text-white"
                        onSelect={props.onDownloadZip}
                    >
                        <IoFolderOpenOutline size={14} />
                        <span>Download sources as .zip</span>
                    </DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}
