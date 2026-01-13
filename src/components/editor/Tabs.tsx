import clsx from "clsx";

export default function Tabs(props: { values: string[]; active: string; onChange: (value: string) => void }) {
    return (
        <div class="border-separator flex w-full border-b">
            {props.values.map((value) => (
                <button
                    type="button"
                    class={clsx(
                        "border-separator h-8.5 border-r px-4 text-sm tracking-tight",
                        value === props.active
                            ? "bg-fill-quaternary"
                            : "hover:bg-fill-quaternary/50 text-label-secondary",
                    )}
                    onClick={() => props.onChange(value)}
                >
                    {String(value)}
                </button>
            ))}
        </div>
    );
}
