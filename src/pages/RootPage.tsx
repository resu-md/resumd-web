import { ResumeProvider } from "@/contexts/ResumeContext";
import { useGithubAuth } from "@/contexts/github/GithubAuthContext";
import { useGithubRepository } from "@/contexts/github/GithubRepositoryContext";
import { useNavigate } from "@solidjs/router";
import { Show, createEffect } from "solid-js";
import EditorPage from "../components/editor/EditorPage";

export default function RootPage() {
    const navigate = useNavigate();
    const { status } = useGithubAuth();
    const { repositories, selectedRepository, selectedBranch, handleManageRepositories } = useGithubRepository();

    createEffect(() => {
        if (status() !== "authenticated") return;

        const repo = selectedRepository();
        const branch = selectedBranch();
        if (!repo || !branch) return;

        navigate(`/${repo.owner}/${repo.repo}?branch=${encodeURIComponent(branch.name)}`, { replace: true });
    });

    return (
        <Show
            when={status() === "unauthenticated"}
            fallback={
                <main class="bg-system-secondary flex h-dvh w-dvw items-center justify-center">
                    <Show
                        when={status() === "authenticated"}
                        fallback={<p class="text-sm text-gray-500">Checking GitHub authentication...</p>}
                    >
                        <Show
                            when={repositories() !== undefined}
                            fallback={<p class="text-sm text-gray-500">Loading repositories...</p>}
                        >
                            <Show
                                when={(repositories()?.length ?? 0) > 0}
                                fallback={
                                    <div class="flex flex-col items-center gap-2">
                                        <p class="text-sm text-gray-500">No GitHub repositories linked.</p>
                                        <button
                                            class="proeminent-button h-8.5 rounded-full px-3 text-sm"
                                            onClick={handleManageRepositories}
                                        >
                                            Manage repositories
                                        </button>
                                    </div>
                                }
                            >
                                <p class="text-sm text-gray-500">Opening repository...</p>
                            </Show>
                        </Show>
                    </Show>
                </main>
            }
        >
            <ResumeProvider>
                <EditorPage />
            </ResumeProvider>
        </Show>
    );
}
