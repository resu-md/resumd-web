import clsx from "clsx";
import { For, Show } from "solid-js";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { FiChevronDown, FiGitBranch } from "solid-icons/fi";
import { useGithub } from "@/contexts/github/GithubContext";
import { IoAdd } from "solid-icons/io";

export default function GithubBranchDropdown() {
    const { selectedRepository, branches, selectedBranch, setSelectedBranch } = useGithub();

    const handleCreateBranchFromCurrent = () => {};

    const handleCreateBranch = () => {};

    return (
        <Show when={selectedRepository() !== null}>
            <DropdownMenu placement="bottom-start" gutter={8}>
                <DropdownMenu.Trigger class="proeminent-button text-primary flex h-8 items-center gap-2 rounded-full text-sm">
                    <span class="ml-3 flex items-center gap-1.5">
                        <FiGitBranch class="text-green" />
                        <Show
                            when={branches()?.length > 0}
                            fallback={<span class="text-label-tertiary">Select a branch</span>}
                        >
                            <span class="font-mono">{selectedBranch()?.name}</span>
                        </Show>
                    </span>
                    <FiChevronDown class="text-label-tertiary mr-2 size-5 translate-y-px" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                    <DropdownMenu.Content class="bg-system-primary/95 proeminent-button flex flex-col gap-0.5 rounded-[14px] py-1 text-sm backdrop-blur-lg outline-none">
                        {/* <span class="text-label-tertiary mx-1 px-2.5 pt-1 pb-1 text-xs font-semibold">Branches</span> */}
                        <For
                            each={branches()}
                            fallback={
                                <span class="text-label-tertiary mx-1 flex items-center justify-between px-2.5 pt-0.75 pr-6 pb-0.5 outline-none">
                                    No branches detected
                                </span>
                            }
                        >
                            {(branch) => (
                                <DropdownMenu.Item
                                    class={clsx(
                                        "group mx-1 flex cursor-pointer items-center gap-1.5 rounded-[10px] px-2.5 py-0.75 outline-none",
                                        selectedBranch()?.name === branch.name
                                            ? "bg-linear-to-b from-[#4da3ff] to-[#007aff] text-white shadow-[inset_0_0_1px_1px_#ffffff33,0_2px_20px_#0000000a]"
                                            : "data-highlighted:bg-fill-tertiary",
                                    )}
                                    onSelect={() => setSelectedBranch(branch)}
                                >
                                    <span class="font-mono">{branch.name}</span>
                                    {/* TODO: Placeholder for the actuall diff values: */}
                                    {/* <div
                                        class={clsx(
                                            "flex items-center gap-0.75 font-mono text-xs",
                                            selectedBranch()?.name === branch.name
                                                ? "text-white/50"
                                                : "text-label-tertiary",
                                        )}
                                    >
                                        <span>+20</span>
                                        <span>-5</span>
                                    </div> */}
                                </DropdownMenu.Item>
                            )}
                        </For>
                        <DropdownMenu.Separator class="border-fill-tertiary mx-3" />
                        <Show
                            when={selectedBranch() !== null && branches()?.length > 0}
                            fallback={
                                <DropdownMenu.Item
                                    class="data-highlighted:bg-fill-tertiary mx-1 flex cursor-pointer items-center gap-1.5 rounded-[10px] px-2.5 py-0.75 pr-6 outline-none"
                                    // onSelect={handleCreateBranch}
                                >
                                    Start a new branch
                                </DropdownMenu.Item>
                            }
                        >
                            <DropdownMenu.Item
                                class="data-highlighted:bg-fill-tertiary mx-1 flex cursor-pointer items-center gap-1.5 rounded-[10px] px-2.5 py-0.75 pr-6 outline-none"
                                // onSelect={handleCreateBranch}
                            >
                                Start a branch from <span class="font-mono">{selectedBranch()?.name}</span>
                            </DropdownMenu.Item>
                        </Show>
                    </DropdownMenu.Content>
                </DropdownMenu.Portal>
            </DropdownMenu>
        </Show>
    );
}
