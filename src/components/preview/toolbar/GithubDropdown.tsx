import { useGithubAuth } from "@/contexts/github/GithubAuthContext";
import { useGithubRepository } from "@/contexts/github/GithubRepositoryContext";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import clsx from "clsx";
import { FiChevronDown, FiGitBranch } from "solid-icons/fi";
import { IoLogOutOutline } from "solid-icons/io";
import { RiLogosGithubFill } from "solid-icons/ri";
import { For, Show } from "solid-js";

export default function GithubDropdown() {
    const { user, status, logout } = useGithubAuth();
    const {
        repositories,
        isLoadingRepositories,
        selectedRepository,
        selectedBranch,
        setSelectedRepository,
        setSelectedBranch,
        // Remote calls
        handleManageRepositories,
        createBranchFromSelected,
    } = useGithubRepository();

    const selectedRepositoryBranches = () => selectedRepository()?.branches ?? [];
    const selectedBranchLabel = () => selectedBranch()?.name ?? null;

    const handleCreateBranch = async () => {
        const newBranchName = window.prompt("Enter a name for the new branch:");
        if (!newBranchName) return;
        try {
            await createBranchFromSelected(newBranchName);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to create branch";
            window.alert(message);
        }
    };

    return (
        <Show when={status() === "authenticated" && !isLoadingRepositories()}>
            <div class="animate-fade-in flex items-center gap-2">
                <DropdownMenu placement="bottom-start" gutter={8}>
                    <DropdownMenu.Trigger class="proeminent-button flex h-8.5 items-center rounded-full pr-3.5 pl-2 font-mono text-sm">
                        <RiLogosGithubFill class="size-5" />
                        <span class="text-label-tertiary px-0.75">/</span>
                        <span>{selectedRepository()?.owner ?? user()?.username}</span>
                        <Show when={repositories().length > 0}>
                            <span class="text-label-tertiary px-0.75">/</span>
                            <span>{selectedRepository()?.repo}</span>
                        </Show>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                        <DropdownMenu.Content
                            class={clsx(
                                "proeminent-button backdrop-blur-lg",
                                "flex flex-col gap-0.5 rounded-xl py-1.5 text-sm outline-none",
                            )}
                        >
                            <Show when={repositories().length > 0}>
                                <span class="text-label-tertiary mx-1.5 px-3 pt-1 pb-1 text-xs font-semibold">
                                    Repositories
                                </span>
                            </Show>
                            <For
                                each={repositories()}
                                fallback={
                                    <span class="text-label-tertiary mx-1.5 px-3 py-0.75 text-sm">
                                        No repositories linked
                                    </span>
                                }
                            >
                                {(repo) => (
                                    <DropdownMenu.Item
                                        class={clsx(
                                            "group mx-1.5 cursor-pointer rounded-lg px-3 py-0.75 pr-6 outline-none",
                                            selectedRepository()?.fullName === repo.fullName
                                                ? "bg-blue/95 text-white"
                                                : "data-highlighted:bg-fill-secondary",
                                        )}
                                        onSelect={() => setSelectedRepository(repo)}
                                    >
                                        <span>{repo.owner}</span>
                                        <span>/</span>
                                        <span>{repo.repo}</span>
                                    </DropdownMenu.Item>
                                )}
                            </For>
                            <DropdownMenu.Separator class="border-fill-tertiary mx-4 my-1" />
                            <DropdownMenu.Item
                                class="data-highlighted:bg-fill-secondary mx-1.5 flex cursor-pointer items-center rounded-lg px-3 py-0.75 pr-10 outline-none"
                                onSelect={handleManageRepositories}
                            >
                                Manage repositories...
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                                class="data-highlighted:bg-fill-secondary data-highlighted:text-red text-red mx-1.5 flex cursor-pointer items-center rounded-lg px-3 py-0.75 outline-none"
                                onSelect={logout}
                            >
                                <IoLogOutOutline class="mr-1 size-4 -translate-x-px" />
                                Logout
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu>

                <Show when={repositories().length > 0}>
                    <DropdownMenu placement="bottom-start" gutter={8}>
                        <DropdownMenu.Trigger class="proeminent-button text-primary flex h-8.5 items-center gap-1 rounded-full text-sm">
                            <span class="ml-3 flex items-center gap-1.5">
                                <FiGitBranch class="text-green" />
                                <Show
                                    when={selectedRepositoryBranches().length > 0}
                                    fallback={<span class="text-label-tertiary">No branch</span>}
                                >
                                    <span class="font-mono">{selectedBranchLabel()}</span>
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
                                <For
                                    each={selectedRepositoryBranches()}
                                    fallback={
                                        <span class="text-label-tertiary mx-1.5 px-3 py-0.75 text-sm">
                                            No branches found
                                        </span>
                                    }
                                >
                                    {(branch) => (
                                        <DropdownMenu.Item
                                            class={clsx(
                                                "group mx-1.5 cursor-pointer rounded-lg px-3 py-0.75 pr-6 outline-none",
                                                selectedBranch()?.name === branch.name
                                                    ? "bg-blue/95 text-white"
                                                    : "data-highlighted:bg-fill-secondary",
                                            )}
                                            onSelect={() => setSelectedBranch(branch.name)}
                                        >
                                            <span>{branch.name}</span>
                                        </DropdownMenu.Item>
                                    )}
                                </For>
                                <DropdownMenu.Separator class="border-fill-tertiary mx-4 my-1" />
                                <DropdownMenu.Item
                                    class="data-highlighted:bg-fill-secondary mx-1.5 flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-0.75 outline-none"
                                    onSelect={handleCreateBranch}
                                >
                                    <Show when={selectedRepositoryBranches().length > 0} fallback="Create branch">
                                        Create branch from "{selectedBranchLabel()}"
                                    </Show>
                                </DropdownMenu.Item>
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu>
                </Show>
            </div>
        </Show>
    );
}
