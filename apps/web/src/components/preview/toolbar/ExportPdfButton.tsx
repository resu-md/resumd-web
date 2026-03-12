import clsx from "clsx";

export default function ExportPdfButton(props: { label: string; alt?: string; onClick?: () => void }) {
    return (
        <button
            class={clsx(
                "h-8 items-center justify-center gap-1.5 rounded-full px-3 text-white",
                "bg-linear-to-b from-[#4da3ff] to-[#007aff] shadow-[inset_0_0_1px_1px_#ffffff33,0_2px_20px_#0000000a] backdrop-blur-md",
                "outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#007aff]",
            )}
            onClick={props.onClick}
            aria-label={props.alt}
            title={props.alt}
        >
            {props.label}
        </button>
    );
}
