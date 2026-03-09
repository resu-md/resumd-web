import { Show } from "solid-js";
import { RiLogosGithubFill } from "solid-icons/ri";
import { useGithub } from "@/contexts/github/GithubContext";

export default function GithubRepositoryBadge() {
    const { selectedRepository } = useGithub();

    return (
        <Show when={selectedRepository()}>
            {(repo) => (
                <div class="proeminent-button flex h-8 items-center rounded-full pr-3.5 pl-2 font-mono text-sm">
                    <RiLogosGithubFill class="size-5" />
                    <span class="text-label-tertiary px-0.75">/</span>
                    <span>{repo().owner}</span>
                    <span class="text-label-tertiary px-0.75">/</span>
                    <span>{repo().repo}</span>
                </div>
            )}
        </Show>
    );
}
