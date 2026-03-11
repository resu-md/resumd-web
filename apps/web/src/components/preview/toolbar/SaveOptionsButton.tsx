import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import clsx from "clsx";
import { FiChevronDown } from "solid-icons/fi";
import { IoDocumentOutline, IoFolderOpenOutline } from "solid-icons/io";
import { Match, Show, Switch } from "solid-js";

export default function SaveOptionsButton(props: { showing: "export" | "commit" }) {
    return (
        <div class="flex items-center gap-[2px]">
            <button
                class={clsx(
                    "button-blue h-8",
                    // blueButtonClasses,
                    // "proeminent-button h-7.75 text-sm",
                    // "shadow-proeminent from-gray-5 to-gray-6 h-8 bg-linear-to-b",
                    "flex items-center justify-center rounded-[16px_3px_3px_16px] pr-2.5 pl-3",
                )}
            >
                <Switch>
                    <Match when={props.showing === "export"}>Export as PDF</Match>
                    <Match when={props.showing === "commit"}>
                        Commit
                        {/* <span class="ml-2 font-mono text-xs font-medium text-white/70">+20</span>
                        <span class="font-mono text-xs font-medium text-white/70">-5</span> */}
                    </Match>
                </Switch>
            </button>
            <DropdownMenu gutter={8}>
                <DropdownMenu.Trigger
                    class={clsx(
                        "button-blue h-8",
                        // blueButtonClasses,
                        // "proeminent-button h-7.75",
                        // "shadow-proeminent from-gray-4 to-gray-6 h-7.75 bg-linear-to-b",
                        "flex items-center justify-center rounded-[3px_16px_16px_3px] pr-2 pl-1",
                    )}
                >
                    <FiChevronDown class="size-5 translate-y-px text-white" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                    <DropdownMenu.Content class="proeminent-button flex flex-col gap-1 rounded-[14px] py-1 text-sm backdrop-blur-lg outline-none">
                        <Show when={props.showing !== "export"}>
                            <DropdownMenu.Item class="group data-highlighted:bg-fill-tertiary mx-1 flex cursor-pointer items-center gap-1.5 rounded-[10px] px-2.5 py-0.75 pl-2 outline-none">
                                <IoDocumentOutline class="text-label-primary mr-0.5 size-3.5" />
                                Export as PDF
                            </DropdownMenu.Item>
                        </Show>
                        <DropdownMenu.Item class="group data-highlighted:bg-fill-tertiary mx-1 flex cursor-pointer items-center gap-1.5 rounded-[10px] px-2.5 py-0.75 pr-4 pl-2 outline-none">
                            <IoFolderOpenOutline class="text-label-primary mr-0.5 size-3.5" />
                            Download sources as .zip
                        </DropdownMenu.Item>
                    </DropdownMenu.Content>
                </DropdownMenu.Portal>
            </DropdownMenu>
        </div>
    );
}
