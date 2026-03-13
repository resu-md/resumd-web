import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { Title } from "@solidjs/meta";
import { formatDocumentTitle } from "@/lib/document-title";
// Contexts
import { clearLoginGuard, login, useGithub } from "@/contexts/github/GithubContext";
// Components
import { useNavigate } from "@solidjs/router";
import { FiChevronRight, FiExternalLink } from "solid-icons/fi";
import { IoLogOutOutline } from "solid-icons/io";

import { apiFetch, apiUrl } from "@/lib/fetch";
import type { RepositoriesResponse } from "@resumd/api/types";
import { useQuery } from "@tanstack/solid-query";

export default function ManageRepositoriesPage() {
    const { user } = useGithub();
    const navigate = useNavigate();
    const [loginBlocked, setLoginBlocked] = createSignal<string | null>(null);

    const startLogin = () => {
        const result = login("/manage");
        if (result.blocked) {
            setLoginBlocked(result.reason ?? "Login failed. Please try again.");
        }
    };

    const retryLogin = () => {
        clearLoginGuard("/manage");
        setLoginBlocked(null);
        startLogin();
    };

    createEffect(() => {
        if (user() !== null) return;
        if (loginBlocked()) return;
        if (user() === null) {
            startLogin();
        }
    });

    return (
        <Show
            when={user()}
            fallback={
                // TODO: Improve visually
                <main class="text-label-secondary flex h-dvh w-dvw items-center justify-center p-6 text-center">
                    <Show
                        when={!loginBlocked()}
                        fallback={
                            <div class="flex max-w-md flex-col items-center gap-3">
                                <h1 class="text-label-primary text-lg">Login failed</h1>
                                <p class="text-label-secondary text-sm leading-relaxed">{loginBlocked()}</p>
                                <div class="mt-2 flex flex-wrap justify-center gap-2">
                                    <button
                                        class="proeminent-button rounded-full px-4 py-2 text-sm"
                                        onClick={retryLogin}
                                    >
                                        Try login again
                                    </button>
                                    <button
                                        class="button-red rounded-full px-4 py-2 text-sm opacity-90"
                                        onClick={() => navigate("/", { replace: true })}
                                    >
                                        Back to home
                                    </button>
                                </div>
                            </div>
                        }
                    >
                        Logging in to GitHub...
                    </Show>
                </main>
            }
        >
            <ManageRepositoriesContent />
        </Show>
    );
}

function ManageRepositoriesContent() {
    const navigate = useNavigate();
    const { logout } = useGithub();

    // TODO: Move this to a context?
    const repositoriesQuery = useQuery(() => ({
        queryKey: ["github", "repositories"] as const,
        queryFn: () => apiFetch<RepositoriesResponse>("/api/repositories"),
        retry: false,
        staleTime: 0,
    }));

    const repositories = createMemo(() => {
        if (repositoriesQuery.isLoading) return undefined;
        return repositoriesQuery.data?.repositories.items;
    });

    createEffect(() => {
        console.log("repositories():", repositories());
    });

    return (
        <>
            <Title>{formatDocumentTitle("Manage repositories")}</Title>
            <main class="bg-system-primary flex min-h-dvh w-dvw items-center justify-center p-2">
                <div class="mt-13 flex w-100 max-w-100 flex-col">
                    <Show
                        when={repositories() === undefined || repositories()!.length > 0}
                        fallback={<NoRepositories />}
                    >
                        <div class="mx-4 mb-5">
                            <h1 class="text-label-primary text-left text-2xl">Select a repository</h1>
                            <p class="text-label-secondary mt-2.5 text-left text-sm leading-relaxed tracking-wide hyphens-auto">
                                You have granted Resumd access to the repositories bellow. Select one of the
                                repositories or add/remove repositories by clicking "Manage repositories".
                            </p>
                        </div>
                        {/* <span class="text-label-tertiary mx-4 text-xs font-semibold">Authorized repositories</span> */}
                        <For
                            each={repositories()}
                            fallback={
                                <div class="px-4 py-3">
                                    <div class="bg-fill-quaternary inline-block animate-pulse rounded-md text-left font-mono text-transparent select-none">
                                        username/repository
                                    </div>
                                    <br />
                                    <div class="bg-fill-quaternary mt-1 inline-block animate-pulse rounded-md text-xs text-transparent select-none">
                                        github.com/repository
                                    </div>
                                </div>
                            }
                        >
                            {(repository, index) => (
                                <>
                                    <Show when={index() !== 0}>
                                        <div class="bg-separator mx-4 h-px" />
                                    </Show>
                                    <button
                                        class="hover:bg-fill-quaternary/50 flex items-center justify-between gap-0.5 rounded-2xl px-4 py-3"
                                        onClick={() => navigate(`/${repository.owner}/${repository.repo}`)}
                                    >
                                        <div>
                                            <p class="text-label-primary text-left font-mono">{repository.fullName}</p>
                                            <a
                                                class="text-gray-2 mt-1 flex items-center gap-0.5 text-left text-xs hover:underline"
                                                href={repository.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                {repository.url.replace(/^(?:\w+:)?\/\//i, "")}
                                                <FiExternalLink class="ml-0.5 inline-block" />
                                            </a>
                                        </div>
                                        <FiChevronRight class="text-label-tertiary" />
                                    </button>
                                </>
                            )}
                        </For>
                        <div class="mx-4 mt-5 flex flex-wrap gap-2">
                            <button
                                class="proeminent-button grow rounded-full px-4 py-2 text-sm"
                                onClick={() => {
                                    window.location.assign(apiUrl("/api/auth/manage"));
                                }}
                            >
                                Manage repositories
                            </button>
                            <button
                                class="button-red grow rounded-full px-4 py-2 text-sm opacity-90"
                                onClick={() => void logout()}
                            >
                                <IoLogOutOutline class="mr-1 inline-block -translate-y-px" />
                                Logout
                            </button>
                        </div>
                    </Show>
                </div>
            </main>
        </>
    );
}

function NoRepositories() {
    const { logout } = useGithub();

    // TODO: Maybe add user avatar or information to this state, so user can know which account is logged in
    return (
        <div class="mx-4">
            <h1 class="text-label-primary text-left text-2xl">No repositories authorized</h1>
            <p class="text-label-secondary mt-2.5 text-left text-sm leading-relaxed tracking-wide hyphens-auto">
                It seems that you haven't authorized Resumd to access any repositories yet. Click the button bellow to
                authorize a repository.
            </p>
            {/* <p class="text-label-secondary mt-2.5 text-left text-sm leading-relaxed tracking-wide hyphens-auto">
                We recommend creating a new repository for your resumes, but you can also select an existing repository
                if you prefer. Resumd only needs read/write access to the selected repositories, so it won't have access
                to any other repositories in your account.
            </p> */}
            <div class="mt-5 flex flex-wrap gap-2">
                <button
                    class="proeminent-button grow rounded-full px-4 py-2 text-sm"
                    onClick={() => {
                        window.location.assign(apiUrl("/api/auth/manage"));
                    }}
                >
                    Add repositories
                </button>
                <button class="button-red grow rounded-full px-4 py-2 text-sm opacity-90" onClick={() => void logout()}>
                    <IoLogOutOutline class="mr-1 inline-block -translate-y-px" />
                    Logout
                </button>
            </div>
        </div>
    );
}
