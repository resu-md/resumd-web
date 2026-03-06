import { useGithubAuth } from "@/contexts/github/GithubAuthContext";
import { useGithubRepository, type GithubRepository } from "@/contexts/github/GithubRepositoryContext";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import clsx from "clsx";
import { FiChevronDown, FiGitBranch } from "solid-icons/fi";
import { IoLogOutOutline } from "solid-icons/io";
import { RiLogosGithubFill } from "solid-icons/ri";
import { For, Show } from "solid-js";

export default function GithubDropdown(props: {
    onSelectRepository?: (repo: GithubRepository) => Promise<boolean> | boolean;
    onSelectBranch?: (branchName: string) => Promise<boolean> | boolean;
    isSwitching?: boolean;
}) {
    const { user, status, logout } = useGithubAuth();
    const {
        repositories,
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

    const handleRepositorySelect = async (repo: GithubRepository) => {
        if (props.isSwitching) return;

        try {
            if (props.onSelectRepository) {
                await props.onSelectRepository(repo);
                return;
            }

            setSelectedRepository(repo);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to switch repository";
            window.alert(message);
        }
    };

    const handleBranchSelect = async (branchName: string) => {
        if (props.isSwitching) return;

        try {
            if (props.onSelectBranch) {
                await props.onSelectBranch(branchName);
                return;
            }

            setSelectedBranch(branchName);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to switch branch";
            window.alert(message);
        }
    };

    // TODO: Loading state while creating branches
    const handleCreateBranch = async () => {
        if (props.isSwitching) return;

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
        <Show when={status() === "authenticated" && repositories() !== undefined}>
            <div class="flex items-center gap-2">
                <DropdownMenu placement="bottom-start" gutter={8}>
                    <DropdownMenu.Trigger class="proeminent-button flex h-8.5 items-center rounded-full pr-3.5 pl-2 font-mono text-sm">
                        <RiLogosGithubFill class="size-5" />
                        <span class="text-label-tertiary px-0.75">/</span>
                        <span>{selectedRepository()?.owner ?? user()?.username}</span>
                        <Show when={repositories()!.length > 0 && selectedRepository()}>
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
                            <Show when={repositories()!.length > 0}>
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
                                            props.isSwitching && "pointer-events-none opacity-50",
                                        )}
                                        onSelect={() => void handleRepositorySelect(repo)}
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

                <Show when={repositories()!.length > 0}>
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
                                <Show when={selectedRepositoryBranches().length > 0}>
                                    <span class="text-label-tertiary mx-1.5 px-3 pt-1 pb-1 text-xs font-semibold">
                                        Branches
                                    </span>
                                </Show>
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
                                                "group mx-1.5 flex cursor-pointer items-center justify-between rounded-lg px-3 py-0.75 outline-none",
                                                selectedBranch()?.name === branch.name
                                                    ? "bg-blue/95 text-white"
                                                    : "data-highlighted:bg-fill-secondary",
                                                props.isSwitching && "pointer-events-none opacity-50",
                                            )}
                                            onSelect={() => void handleBranchSelect(branch.name)}
                                        >
                                            <span>{branch.name}</span>
                                        </DropdownMenu.Item>
                                    )}
                                </For>
                                <DropdownMenu.Separator class="border-fill-tertiary mx-4 my-1" />
                                <DropdownMenu.Item
                                    class="data-highlighted:bg-fill-secondary mx-1.5 flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-0.75 outline-none"
                                    onSelect={() => void handleCreateBranch()}
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
