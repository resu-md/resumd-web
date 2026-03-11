import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { FiChevronDown } from "solid-icons/fi";
import { IoFolderOpenOutline } from "solid-icons/io";

export default function SaveOptionsButton(props: { onExportPdf: () => void; onDownloadZip: () => void }) {
    return (
        <div class="save-options-button flex items-center gap-[2px]">
            <button
                class="button-blue flex h-8 items-center justify-center rounded-[16px_3px_3px_16px] pr-2.5 pl-3 text-nowrap"
                onClick={props.onExportPdf}
            >
                Export as PDF
            </button>
            <DropdownMenu gutter={8}>
                <DropdownMenu.Trigger class="button-blue expanded-active flex h-8 items-center justify-center rounded-[3px_16px_16px_3px] pr-2 pl-1">
                    <FiChevronDown class="size-5 translate-y-px text-white" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                    <DropdownMenu.Content class="proeminent-button flex flex-col gap-1 rounded-[14px] py-1 text-sm backdrop-blur-lg outline-none">
                        <DropdownMenu.Item
                            class="group data-highlighted:bg-fill-tertiary mx-1 flex cursor-pointer items-center gap-1.5 rounded-[10px] px-2.5 py-0.75 pr-4 pl-2 outline-none"
                            onSelect={props.onDownloadZip}
                        >
                            <IoFolderOpenOutline class="text-label-primary mr-0.5 size-3.5" />
                            Download sources as .zip
                        </DropdownMenu.Item>
                    </DropdownMenu.Content>
                </DropdownMenu.Portal>
            </DropdownMenu>
        </div>
    );
}
