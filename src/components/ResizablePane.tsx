import { createSignal, type JSXElement } from "solid-js";
import { makePersisted } from "@solid-primitives/storage";

export default function ResizablePane(props: {
    children: JSXElement;
    storageKey: string;
    defaultWidth: number;
    minWidth?: number;
    maxWidth?: number;
    class?: string;
}) {
    const [width, setWidth] = makePersisted(createSignal(props.defaultWidth), { name: props.storageKey });
    const [isDragging, setIsDragging] = createSignal(false);

    const handleMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startWidth = width();

        setIsDragging(true);

        // Prevent text selection during drag
        document.body.style.userSelect = "none";

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - startX;
            const viewportWidth = window.innerWidth;
            const deltaPercent = (deltaX / viewportWidth) * 100;

            // Calculate min/max constraints
            const minPercent = Math.max(props.minWidth ?? 25, (300 / viewportWidth) * 100);
            const maxPercent = props.maxWidth ?? 80;
            const newWidth = Math.max(minPercent, Math.min(maxPercent, startWidth + deltaPercent));
            setWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            document.body.style.userSelect = "";
            window.removeEventListener("mousemove", handleMouseMove, true);
            window.removeEventListener("mouseup", handleMouseUp, true);
        };

        window.addEventListener("mousemove", handleMouseMove, true);
        window.addEventListener("mouseup", handleMouseUp, true);
    };

    return (
        <>
            {isDragging() && <div class="fixed inset-0 z-50 cursor-col-resize" />}
            <div class={props.class} style={{ width: `${width()}%` }}>
                {props.children}
                <div
                    class="group absolute inset-y-0 left-full flex cursor-col-resize items-center pr-2"
                    onMouseDown={handleMouseDown}
                />
            </div>
        </>
    );
}
