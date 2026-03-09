import { For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useQuery } from "@tanstack/solid-query";
import type { RepositoriesResponse } from "@resumd/api/types";
import { apiFetch, ApiError } from "@/lib/fetch";
import { logout, useGithub } from "@/contexts/github/GithubContext";

export default function ManageRepositoriesPage() {
    const navigate = useNavigate();
    const { user } = useGithub();

    const repositoriesQuery = useQuery(() => ({
        queryKey: ["github", "repositories"],
        enabled: user() !== undefined && user() !== null,
        queryFn: () => apiFetch<RepositoriesResponse>("/api/repositories"),
        retry: false,
        staleTime: 60_000,
    }));

    const repositories = () => repositoriesQuery.data?.repositories.items ?? [];

    return (
        <main class="bg-system-secondary flex min-h-dvh w-dvw items-center justify-center p-6">
            <section class="proeminent-button w-full max-w-2xl rounded-2xl p-6">
                <h1 class="text-xl font-semibold">Select a repository</h1>
                <p class="text-label-secondary mt-2 text-sm">
                    Choose a repository that already granted access to the GitHub App.
                </p>

                <Show when={user() === undefined}>
                    <p class="text-label-secondary mt-6 text-sm">Loading session...</p>
                </Show>

                <Show when={user() !== undefined && user() === null}>
                    <p class="text-label-secondary mt-6 text-sm">
                        You are logged out. Open a repository URL to authenticate.
                    </p>
                </Show>

                <Show
                    when={
                        user() && repositoriesQuery.error instanceof ApiError && repositoriesQuery.error.status !== 401
                    }
                >
                    <p class="text-red mt-6 text-sm">Failed to load repositories.</p>
                </Show>

                <Show when={user() && repositoriesQuery.isLoading}>
                    <p class="text-label-secondary mt-6 text-sm">Loading repositories...</p>
                </Show>

                <Show when={user() && !repositoriesQuery.isLoading}>
                    <div class="mt-6 flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
                        <For
                            each={repositories()}
                            fallback={<p class="text-label-secondary text-sm">No repositories connected yet.</p>}
                        >
                            {(repository) => (
                                <button
                                    class="bg-fill-secondary hover:bg-fill-primary flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm"
                                    onClick={() => navigate(`/${repository.owner}/${repository.repo}`)}
                                >
                                    <span class="font-medium">{repository.fullName}</span>
                                </button>
                            )}
                        </For>
                    </div>
                </Show>

                <div class="mt-6 flex flex-wrap gap-2">
                    <button
                        class="proeminent-button rounded-full px-4 py-2 text-sm"
                        onClick={() => {
                            window.location.assign("/api/auth/manage");
                        }}
                    >
                        Manage repositories
                    </button>
                    <button
                        class="bg-fill-secondary hover:bg-fill-primary text-red rounded-full px-4 py-2 text-sm"
                        onClick={() => {
                            void logout();
                        }}
                    >
                        Logout
                    </button>
                </div>
            </section>
        </main>
    );
}
