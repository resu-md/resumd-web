import { IoEye, IoEyeOff } from "solid-icons/io";
import { createEffect, createSignal, Show } from "solid-js";

export default function CommitButton(props: {
    initialShowDiff?: boolean;
    hasChanges?: boolean;
    isCommitting?: boolean;
    diffStats: { added: number; removed: number };
    onShowDiffChange: (show: boolean) => void;
    onUndo: () => void;
    onCommit: (message?: string) => void;
}) {
    const [showDiff, setShowDiff] = createSignal(props.initialShowDiff ?? false);
    const hasChanges = () => props.hasChanges ?? true;

    createEffect(() => {
        setShowDiff(props.initialShowDiff ?? false);
    });

    const handleCommit = () => {
        if (!hasChanges() || props.isCommitting) return;

        const message = prompt("Commit message (optional):");
        if (message === null) return;
        props.onCommit(message.trim() || undefined);
    };

    const handleShowDiffToggle = () => {
        if (!hasChanges()) return;

        const newShowDiff = !showDiff();
        setShowDiff(newShowDiff);
        props.onShowDiffChange(newShowDiff);
    };

    const handleUndo = () => {
        if (!hasChanges()) return;

        if (confirm("Are you sure you want to undo your changes? This action cannot be undone.")) {
            props.onUndo();
        }
    };

    return (
        <div
            class="proeminent-button group/commit-button flex items-center rounded-full"
            style={{ "interpolate-size": "allow-keywords" }}
            // onMouseEnter={handleMouseEnter}
            // onMouseLeave={handleMouseLeave}
        >
            <button
                class="button-green -m-px flex h-8 items-center gap-2 rounded-full px-3 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleCommit}
                disabled={!hasChanges() || props.isCommitting}
                title={!hasChanges() ? "Make changes to commit" : undefined}
            >
                {props.isCommitting ? "Committing..." : "Commit"}
            </button>
            <div class="h-full pr-3.25 pl-2.25 font-mono text-sm tabular-nums transition-[margin]">
                <span class="text-[#62BA46]">+{props.diffStats.added}</span>
                <span class="text-red ml-0.75">-{props.diffStats.removed}</span>
            </div>
            <div class="ease flex h-7.75 w-0 items-center justify-start overflow-hidden rounded-r-full transition-[width] delay-100 group-hover/commit-button:w-auto data-[open=true]:w-auto">
                <div class="bg-separator h-4 w-px shrink-0" />
                <button
                    class="hover:bg-fill-quaternary active:bg-fill-secondary text-label-secondary flex h-full shrink-0 items-center gap-1 text-sm"
                    title="Preview changes"
                    onClick={handleShowDiffToggle}
                    disabled={!hasChanges()}
                >
                    <Show when={!showDiff()} fallback={<IoEye class="text-label-secondary mx-1.5 ml-2 size-4" />}>
                        <IoEyeOff class="text-label-secondary mx-1.5 ml-2 size-4" />
                    </Show>
                </button>
                <div class="bg-separator h-4 w-px shrink-0" />
                <button
                    class="hover:bg-fill-quaternary active:bg-fill-secondary h-full shrink-0"
                    title="Undo changes"
                    onClick={handleUndo}
                    disabled={!hasChanges()}
                >
                    {/* <IoArrowUndo class="text-label-secondary mx-1.5 mr-2.5 size-4" /> */}
                    {/* <svg
                        stroke-width="0"
                        height="1em"
                        width="1em"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        color="currentColor"
                        style="overflow: visible;"
                        class="text-label-secondary mx-1.5 mr-2.5 size-4 -rotate-45"
                    >
                        <path d="M1.22 6.28a.749.749 0 0 1 0-1.06l3.5-3.5a.749.749 0 1 1 1.06 1.06L3.561 5h7.188l.001.007L10.749 5c.058 0 .116.007.171.019A4.501 4.501 0 0 1 10.5 14H8.796a.75.75 0 0 1 0-1.5H10.5a3 3 0 1 0 0-6H3.561L5.78 8.72a.749.749 0 1 1-1.06 1.06l-3.5-3.5Z"></path>
                    </svg> */}
                    {/* <RiArrowsArrowGoBackFill class="text-label-secondary mx-1.5 mr-2.5 size-4" /> */}
                    <svg
                        stroke-width="2"
                        height="1em"
                        width="1em"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        viewBox="0 0 24 24"
                        color="currentColor"
                        style="overflow: visible;"
                        class="text-label-secondary mx-1.5 mr-2.5 size-4.5"
                    >
                        <path d="m9 14-4-4 4-4"></path>
                        <path d="M5 10h11a4 4 0 1 1 0 8h-1"></path>
                    </svg>
                </button>
            </div>
        </div>
    );
}
