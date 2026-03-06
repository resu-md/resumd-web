import { useGithubAuth } from "@/contexts/github/GithubAuthContext";
import { useParams } from "@solidjs/router";
import { Show, createEffect, on } from "solid-js";
import GithubEditorPage from "../components/editor/GithubEditorPage";
import { GithubResumeProvider } from "@/contexts/github/GithubResumeContext";

export default function AuthenticatedEditorPage() {
    const params = useParams<{ owner: string; repo: string }>();
    const { status, login } = useGithubAuth();

    createEffect(
        on(status, (s, prev) => {
            if (s === "unauthenticated" && prev !== "authenticated") {
                login(params.owner, params.repo);
            }
        }),
    );

    return (
        <Show
            when={status() === "authenticated"}
            fallback={
                <main class="bg-system-secondary flex h-dvh w-dvw items-center justify-center">
                    <p class="text-sm text-gray-500">
                        {status() === "loading" ? "Checking GitHub authentication..." : "Redirecting to GitHub..."}
                    </p>
                </main>
            }
        >
            <GithubResumeProvider>
                <GithubEditorPage />
            </GithubResumeProvider>
        </Show>
    );
}
