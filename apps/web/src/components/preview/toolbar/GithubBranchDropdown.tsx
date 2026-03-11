import clsx from "clsx";
import { For, Show } from "solid-js";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { FiChevronDown, FiGitBranch, FiRefreshCw } from "solid-icons/fi";
import { useGithub } from "@/contexts/github/GithubContext";

export default function GithubBranchDropdown() {
    const { selectedRepository, branches, selectedBranch, isReloadingBranches, reloadBranches, setSelectedBranch } =
        useGithub();

    return (
        <Show when={selectedRepository() !== null}>
            <DropdownMenu placement="bottom-start" gutter={8}>
                <DropdownMenu.Trigger class="proeminent-button text-primary flex h-8 items-center gap-2 rounded-full text-sm">
                    <span class="ml-3 flex items-center">
                        <FiGitBranch class="text-label-secondary mr-1.25" />
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
                    <DropdownMenu.Content class="bg-system-primary/95 proeminent-button flex max-h-[70vh] flex-col rounded-[13px] py-1 text-sm backdrop-blur-lg outline-none">
                        <div class="mx-1 flex items-center justify-between px-2.5 pt-0.5 pr-5 pb-1">
                            <span class="text-label-tertiary mr-2 text-xs font-semibold">
                                <a href={selectedRepository()!.url} target="_blank" rel="noopener noreferrer">
                                    {selectedRepository()!.owner}/{selectedRepository()!.repo}
                                </a>
                                's branches
                            </span>
                            <button
                                type="button"
                                class="text-label-tertiary hit-area-x-3 hit-area-y-2 hover:text-label-secondary inline-flex items-center justify-center rounded-full transition-colors"
                                aria-label="Reload branches"
                                onClick={() => void reloadBranches()}
                                disabled={isReloadingBranches()}
                            >
                                <FiRefreshCw
                                    class={clsx(
                                        "size-3 transition-transform duration-300",
                                        isReloadingBranches() && "animate-spin",
                                    )}
                                />
                            </button>
                        </div>
                        <div class="flex flex-col gap-0.5 overflow-y-auto">
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
                        </div>
                    </DropdownMenu.Content>
                </DropdownMenu.Portal>
            </DropdownMenu>
        </Show>
    );
}
