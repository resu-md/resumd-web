import { useGithubAuth } from "@/contexts/github/GithubAuthContext";
import { useParams } from "@solidjs/router";
import { Match, Switch } from "solid-js";
import EditorPage from "./EditorPage";

export default function AuthenticatedEditorPage() {
    const params = useParams<{ owner: string; repo: string }>();
    const { status, login } = useGithubAuth();

    return (
        <Switch>
            <Match when={status() === "loading"}>
                <main class="bg-system-secondary flex h-dvh w-dvw items-center justify-center">
                    <p class="text-sm text-gray-500">Checking GitHub authentication...</p>
                </main>
            </Match>
            <Match when={status() === "unauthenticated"}>
                <main class="bg-system-secondary flex h-dvh w-dvw items-center justify-center">
                    <div class="flex flex-col items-center gap-4">
                        <p class="text-sm text-gray-500">
                            You need to authenticate with GitHub to access this repository.
                        </p>
                        <button
                            class="rounded bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
                            onClick={() => login(params.owner, params.repo)}
                        >
                            Authenticate with GitHub
                        </button>
                    </div>
                </main>
            </Match>
            <Match when={status() === "authenticated"}>
                <EditorPage />
            </Match>
        </Switch>
    );
}
