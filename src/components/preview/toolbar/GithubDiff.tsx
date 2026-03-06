import { Show } from "solid-js";
import { IoArrowUndo, IoEyeOffOutline, IoEyeOutline } from "solid-icons/io";
import clsx from "clsx";

export default function GithubDiff(props: {
    canShowDiff: boolean;
    showDiff: boolean;
    hasChanges: boolean;
    addedCount: number;
    removedCount: number;
    onToggleDiff?: () => void;
    onRevertAll?: () => void;
}) {
    return (
        <div class="group/diff flex items-center rounded-md px-1 py-1 font-mono text-sm">
            <span class={clsx("text-green text-nowrap")}>+{props.addedCount}</span>
            <span class={clsx("text-red ml-1 text-nowrap")}>-{props.removedCount}</span>

            <Show when={props.canShowDiff}>
                <button
                    title={props.showDiff ? "Hide diff" : "Show diff"}
                    class="text-label-secondary hover:bg-fill-secondary ml-2 flex size-6 items-center justify-center rounded-lg opacity-0 group-hover/diff:opacity-100"
                    onClick={props.onToggleDiff}
                    disabled={!props.onToggleDiff}
                >
                    <Show when={props.showDiff} fallback={<IoEyeOutline size={15} class="text-label-secondary" />}>
                        <IoEyeOffOutline size={15} class="text-label-secondary" />
                    </Show>
                </button>
            </Show>

            <button
                title="Revert all changes"
                class="text-label-secondary hover:bg-fill-secondary ml-0.5 flex size-6 items-center justify-center rounded-lg opacity-0 group-hover/diff:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={props.onRevertAll}
                disabled={!props.hasChanges || !props.onRevertAll}
            >
                <IoArrowUndo size={15} class="text-label-secondary" />
            </button>
        </div>
    );
}
