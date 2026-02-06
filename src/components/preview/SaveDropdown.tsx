import { createSignal } from "solid-js";
import clsx from "clsx";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { IoChevronDownOutline, IoDocumentOutline, IoFolderOpenOutline, IoLogoGithub } from "solid-icons/io";

interface SaveDropdownProps {
    onExportPdf: () => void;
    onDownloadZip: () => void;
}

export default function SaveDropdown(props: SaveDropdownProps) {
    const [isOpen, setIsOpen] = createSignal(false);

    return (
        <DropdownMenu open={isOpen()} onOpenChange={setIsOpen}>
            <DropdownMenu.Trigger class={clsx(
                "flex h-7 cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 pr-1.5 pl-2.5",
                "font-medium tracking-tight text-white",
                "bg-linear-to-b from-[#4da3ff] to-[#007aff] backdrop-blur-md",
                "shadow-[inset_0_0_1px_1px_#ffffff33,0_0_0_1px_#00000014,0_2px_2px_#0000000a,0_0_0_1px_#007aff]",
                "outline-offset-4 focus-visible:outline-2 focus-visible:outline-[#007aff]"
            )}>
                <span>Export</span>
                <IoChevronDownOutline size={16} class={clsx("translate-y-px", isOpen() && "rotate-180")} />
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content class="bg-fill-secondary dark:bg-system-tertiary/80 shadow-tertiary z-10 mt-2 w-52 overflow-hidden rounded-lg p-1 backdrop-blur-xl">
                    <DropdownMenu.Item
                        class="text-label-primary hover:bg-blue flex h-7 w-full cursor-pointer items-center gap-1 rounded-md pr-3 pl-0.5 text-left text-[13px] hover:text-white"
                        onSelect={props.onExportPdf}
                    >
                        <IoDocumentOutline size={14} class="w-6" />
                        <span>Export as PDF</span>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                        disabled
                        class="text-label-primary hover:bg-blue flex h-7 w-full cursor-pointer items-center gap-1 rounded-md pr-3 pl-0.5 text-left text-[13px] hover:text-white data-disabled:cursor-not-allowed data-disabled:opacity-50"
                        title="GitHub integration coming soon."
                    >
                        <IoLogoGithub size={15} class="w-6" />
                        <span>Push to GitHub</span>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                        class="text-label-primary hover:bg-blue flex h-7 w-full cursor-pointer items-center gap-1 rounded-md pr-3 pl-0.5 text-left text-[13px] hover:text-white"
                        onSelect={props.onDownloadZip}
                    >
                        <IoFolderOpenOutline size={14} class="w-6" />
                        <span>Download sources as .zip</span>
                    </DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu>
    );
}
