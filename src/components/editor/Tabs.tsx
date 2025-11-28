import clsx from "clsx";

export default function Tabs(props: { values: string[]; active: string; onChange: (value: string) => void }) {
    return (
        <div class="border-separator flex w-full border-b">
            {props.values.map((value) => (
                <button
                    type="button"
                    class={clsx("h-9 px-7 text-sm tracking-tight", {
                        "bg-blue/20 text-blue": value === props.active,
                        "text-system-on-tertiary/60": value !== props.active,
                    })}
                    onClick={() => props.onChange(value)}
                >
                    {String(value)}
                </button>
            ))}
        </div>
    );
}
