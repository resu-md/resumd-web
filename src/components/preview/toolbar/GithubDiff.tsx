import { IoEyeOffOutline, IoEyeOutline } from "solid-icons/io";
import { debounce } from "@solid-primitives/scheduled";
import { createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js";
import { useResume } from "@/contexts/ResumeContext";
import { useGithubAuth } from "@/contexts/github/GithubAuthContext";
import { type GithubResumeReference, useGithubResume } from "@/contexts/github/GithubResumeContext";
import { countLineDiff, type DiffCount } from "@/lib/line-diff";

export default function GithubDiff() {
    const { status } = useGithubAuth();
    const { markdown, css } = useResume();
    const { referenceResume, isLoadingReference, referenceError, isDiffMode, setDiffMode } = useGithubResume();
    const [diffCount, setDiffCount] = createSignal<DiffCount>({ additions: 0, deletions: 0 });

    const calculateDiffCount = debounce((reference: GithubResumeReference, currentMarkdown: string, currentCss: string) => {
        const markdownDiff = countLineDiff(reference.markdown?.content ?? "", currentMarkdown);
        const cssDiff = countLineDiff(reference.stylesheet?.content ?? "", currentCss);
        setDiffCount({
            additions: markdownDiff.additions + cssDiff.additions,
            deletions: markdownDiff.deletions + cssDiff.deletions,
        });
    }, 150);

    createEffect(() => {
        const reference = referenceResume();
        if (!reference) {
            calculateDiffCount.clear();
            setDiffCount({ additions: 0, deletions: 0 });
            return;
        }

        calculateDiffCount(reference, markdown(), css());
    });

    onCleanup(() => calculateDiffCount.clear());

    const shouldDisplay = createMemo(() => {
        if (status() !== "authenticated") return false;
        return isDiffMode() || Boolean(referenceResume()) || isLoadingReference() || Boolean(referenceError());
    });

    const buttonTitle = createMemo(() => {
        if (isDiffMode()) return "Hide diff";
        const error = referenceError();
        if (error) return error;
        const reference = referenceResume();
        if (!reference) return "Loading repository files";
        return `Diff against ${reference.owner}/${reference.repo}@${reference.branch}`;
    });

    return (
        <Show when={shouldDisplay()}>
            <div class="group flex items-center rounded-md px-2 py-1 font-mono text-sm">
                <Show when={!isLoadingReference() || referenceResume()} fallback={<span class="text-label-tertiary">...</span>}>
                    <span class="text-green">+{diffCount().additions}</span>
                    <span class="text-red ml-1">-{diffCount().deletions}</span>
                </Show>

                <button
                    title={buttonTitle()}
                    disabled={!referenceResume()}
                    onClick={() => setDiffMode(!isDiffMode())}
                    class={`text-label-secondary hover:bg-fill-secondary ml-2 flex size-6 items-center justify-center rounded-lg ${
                        isDiffMode() ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                    <Show when={isDiffMode()} fallback={<IoEyeOutline size={15} class="text-label-secondary" />}>
                        <IoEyeOffOutline size={15} class="text-label-secondary" />
                    </Show>
                </button>
            </div>
        </Show>
    );
}
