import clsx from "clsx";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { FiChevronDown } from "solid-icons/fi";
import { IoFolderOpen, IoLogoGithub } from "solid-icons/io";
import GithubDropdown from "./GithubDropdown";
import GithubDiff from "./GithubDiff";

export default function PreviewToolbar(props: { onExportPdf: () => void; onDownloadZip: () => void }) {
    return (
        <div class="absolute top-3.5 right-0 left-0 flex items-center justify-between gap-3 px-3.5 pr-5">
            <div class="flex flex-[1_1_0%] items-center gap-2">
                <GithubDropdown />
            </div>

            <div class="flex flex-[1_1_0%] justify-end gap-2 pr-2">
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
