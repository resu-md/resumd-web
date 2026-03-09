import clsx from "clsx";
import { For, Show } from "solid-js";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { FiChevronDown, FiGitBranch } from "solid-icons/fi";
import { useGithub } from "@/contexts/github/GithubContext";

export default function GithubBranchDropdown() {
    const { selectedRepository, branches, selectedBranch, setSelectedBranch } = useGithub();

    return (
        <Show when={selectedRepository() !== null}>
            <DropdownMenu placement="bottom-start" gutter={8}>
                <DropdownMenu.Trigger class="proeminent-button text-primary flex h-8.5 items-center gap-1 rounded-full text-sm">
                    <span class="ml-3 flex items-center gap-1.5">
                        <FiGitBranch class="text-green" />
                        <Show when={branches()} fallback={<span class="text-label-tertiary">No branch</span>}>
                            <span class="font-mono">{selectedBranch()?.name}</span>
                        </Show>
                    </span>
                    <FiChevronDown class="text-label-tertiary mr-2 size-5.5 translate-y-px" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                    <DropdownMenu.Content
                        class={clsx(
                            "bg-system-primary/95 proeminent-button backdrop-blur-lg",
                            "flex flex-col gap-0.5 rounded-xl py-1.5 text-sm outline-none",
                        )}
                    >
                        <Show when={branches()}>
                            <span class="text-label-tertiary mx-1.5 px-3 pt-1 pb-1 text-xs font-semibold">
                                Branches
                            </span>
                        </Show>
                        <For
                            each={branches()}
                            fallback={
                                <span class="text-label-tertiary mx-1.5 px-3 py-0.75 text-sm">No branches found</span>
                            }
                        >
                            {(branch) => (
                                <DropdownMenu.Item
                                    class={clsx(
                                        "group mx-1.5 flex cursor-pointer items-center justify-between rounded-lg px-3 py-0.75 outline-none",
                                        selectedBranch()?.name === branch.name
                                            ? "bg-blue/95 text-white"
                                            : "data-highlighted:bg-fill-secondary",
                                    )}
                                    onSelect={() => setSelectedBranch(branch)}
                                >
                                    <span>{branch.name}</span>
                                    {/* TODO: Placeholder for the actuall diff values: */}
                                    <div
                                        class={clsx(
                                            "flex items-center gap-1 font-mono text-xs",
                                            selectedBranch()?.name === branch.name
                                                ? "text-white"
                                                : "text-label-secondary",
                                        )}
                                    >
                                        <span>+20</span>
                                        <span>-5</span>
                                    </div>
                                </DropdownMenu.Item>
                            )}
                        </For>
                        <DropdownMenu.Separator class="border-fill-tertiary mx-4 my-1" />
                        <DropdownMenu.Item
                            class="data-highlighted:bg-fill-secondary mx-1.5 flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-0.75 outline-none"
                            // onSelect={handleCreateBranch}
                        >
                            <Show when={branches()} fallback="Create branch">
                                Create branch from "{selectedBranch()?.name}"
                            </Show>
                        </DropdownMenu.Item>
                    </DropdownMenu.Content>
                </DropdownMenu.Portal>
            </DropdownMenu>
        </Show>
    );
}
