import { useResume } from "@/contexts/ResumeContext";
import { Show } from "solid-js";
import { IoArrowUndo, IoEyeOffOutline, IoEyeOutline } from "solid-icons/io";

export default function GithubDiff() {
    const {
        diffForCurrentBranch,
        isCurrentBranchDirty,
        isDiffMode,
        toggleDiffMode,
        resetCurrentBranchToSource,
    } = useResume();

    const diff = () => diffForCurrentBranch();
    const isDirty = () => isCurrentBranchDirty();

    return (
        <div class="group/diff flex items-center rounded-md px-1 py-1 font-mono text-sm">
            <span class="text-green">+{diff().added}</span>
            <span class="text-red ml-1">-{diff().removed}</span>

            <button
                title={isDiffMode() ? "Hide diff" : "Show diff"}
                class="text-label-secondary hover:bg-fill-secondary ml-2 flex size-6 items-center justify-center rounded-lg opacity-0 group-hover/diff:opacity-100"
                disabled={!isDirty()}
                onClick={toggleDiffMode}
            >
                <Show when={isDiffMode()} fallback={<IoEyeOutline size={15} class="text-label-secondary" />}>
                    <IoEyeOffOutline size={15} class="text-label-secondary" />
                </Show>
            </button>

            <button
                title="Revert changes"
                class="text-label-secondary hover:bg-fill-secondary ml-2 flex size-6 items-center justify-center rounded-lg opacity-0 group-hover/diff:opacity-100"
                disabled={!isDirty()}
                onClick={resetCurrentBranchToSource}
            >
                <IoArrowUndo size={15} class="text-label-secondary" />
            </button>
        </div>
    );
}
