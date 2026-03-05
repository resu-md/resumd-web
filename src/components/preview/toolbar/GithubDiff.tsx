import { createSignal, Show } from "solid-js";
import { IoArrowUndo, IoEyeOffOutline, IoEyeOutline } from "solid-icons/io";

export default function GithubDiff() {
    const [isDiffMode, setIsDiffMode] = createSignal(false);

    return (
        <div class="group/diff flex items-center rounded-md px-1 py-1 font-mono text-sm">
            <span class="text-green">+20</span>
            <span class="text-red ml-1">-5</span>

            <button
                title={isDiffMode() ? "Hide diff" : "Show diff"}
                class="text-label-secondary hover:bg-fill-secondary ml-2 flex size-6 items-center justify-center rounded-lg opacity-0 group-hover/diff:opacity-100"
                onClick={() => setIsDiffMode(!isDiffMode())}
            >
                <Show when={isDiffMode()} fallback={<IoEyeOutline size={15} class="text-label-secondary" />}>
                    <IoEyeOffOutline size={15} class="text-label-secondary" />
                </Show>
            </button>

            <button
                title="Revert changes"
                class="text-label-secondary hover:bg-fill-secondary ml-2 flex size-6 items-center justify-center rounded-lg opacity-0 group-hover/diff:opacity-100"
            >
                <IoArrowUndo size={15} class="text-label-secondary" />
            </button>
        </div>
    );
}
