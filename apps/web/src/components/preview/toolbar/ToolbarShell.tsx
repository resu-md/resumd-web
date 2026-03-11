import { Show, type JSXElement } from "solid-js";

export default function ToolbarShell(props: { leading?: JSXElement; trailing?: JSXElement; center?: JSXElement }) {
    return (
        <div class="pointer-events-none absolute top-4 right-0 left-0">
            <div class="pointer-events-auto flex items-center justify-between gap-3 px-5">
                <Show when={props.leading}>
                    <div class={/*flex-[1_1_0%]*/ "flex items-center justify-end gap-2"}>{props.leading}</div>
                </Show>
                {/* <Show when={props.center}>
                    <div class="flex items-center">{props.center}</div>
                </Show> */}
                <Show when={props.trailing}>
                    <div class={/*flex-[1_1_0%]*/ "flex items-center justify-end gap-2"}>{props.trailing}</div>
                </Show>
            </div>
        </div>
    );
}
