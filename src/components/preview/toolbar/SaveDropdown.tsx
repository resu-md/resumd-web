import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { FiChevronDown } from "solid-icons/fi";
import { IoFolderOpen, IoLogoGithub } from "solid-icons/io";

export default function SaveDropdown(props: { onDownloadZip?: () => void }) {
    return (
        <DropdownMenu placement="bottom-end" gutter={8}>
            <DropdownMenu.Trigger class="proeminent-button text-primary flex h-8.5 items-center gap-1 rounded-full pr-2 pl-3.5">
                Save <FiChevronDown class="text-label-tertiary size-5 translate-y-px" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content class="proeminent-button flex flex-col rounded-[21px] p-[5px] text-sm">
                    <DropdownMenu.Item
                        disabled
                        class="text-label-primary hover:bg-fill-secondary data-disabled:text-label-secondary flex h-8.5 w-full cursor-pointer items-center gap-1 rounded-full pr-4 pl-2 data-disabled:cursor-not-allowed"
                        title="GitHub integration coming soon."
                    >
                        <IoLogoGithub size={17} class="mr-0.5 w-6" />
                        <span class="mt-px">Push to GitHub</span>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                        class="text-label-primary hover:bg-fill-secondary flex h-8.5 w-full cursor-pointer items-center gap-1 rounded-full pr-4 pl-2"
                        onSelect={props.onDownloadZip}
                    >
                        <IoFolderOpen size={15} class="mr-0.5 w-6" />
                        <span class="mt-px">Download sources as .zip</span>
                    </DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu>
    );
}
