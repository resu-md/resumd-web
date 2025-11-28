import { IoAdd, IoDownloadOutline, IoRemoveOutline } from "solid-icons/io";
import { onMount, onCleanup, type Accessor, type Setter } from "solid-js";

const ZOOM_STEPS = [25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 300, 400, 500];
const MIN_ZOOM = 25;
const MAX_ZOOM = 500;
const SCROLL_WHEEL_ZOOM_FACTOR = 1.2;

function clampZoom(value: number): number {
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

export default function PreviewControls(props: {
    zoom: Accessor<number>;
    setZoom: Setter<number>;
    onExport: () => void;
}) {
    const handleZoomIn = () => {
        const next = ZOOM_STEPS.find((z) => z > props.zoom());
        if (next) props.setZoom(next);
    };

    const handleZoomOut = () => {
        const prev = [...ZOOM_STEPS].reverse().find((z) => z < props.zoom());
        if (prev) props.setZoom(prev);
    };

    const handleScrollZoom = (deltaY: number) => {
        const normalizedDelta = -deltaY / 100;
        const multiplier = Math.pow(SCROLL_WHEEL_ZOOM_FACTOR, normalizedDelta);
        const newZoom = clampZoom(Math.round(props.zoom() * multiplier));
        props.setZoom(newZoom);
    };

    onMount(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === "+" || e.key === "=") {
                    e.preventDefault();
                    handleZoomIn();
                } else if (e.key === "-") {
                    e.preventDefault();
                    handleZoomOut();
                }
            }
        };

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                handleScrollZoom(e.deltaY);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("wheel", handleWheel, { passive: false });

        onCleanup(() => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("wheel", handleWheel);
        });
    });

    return (
        <div class="flex h-10 w-full items-center">
            <div class="flex-[1_1_0%]" />
            <div class="flex items-center">
                <button
                    class="hover:bg-fill-tertiary flex size-7 items-center justify-center rounded-md hover:cursor-pointer"
                    onClick={handleZoomOut}
                    title="Zoom Out"
                >
                    <IoRemoveOutline size={20} class="text-label-primary" />
                </button>

                <ZoomPercentageInput zoom={props.zoom} onZoomChange={props.setZoom} />

                <button
                    class="hover:bg-fill-tertiary flex size-7 items-center justify-center rounded-md hover:cursor-pointer"
                    onClick={handleZoomIn}
                    title="Zoom In"
                >
                    <IoAdd size={20} class="text-label-primary" />
                </button>
            </div>

            <div class="flex flex-[1_1_0%] justify-end pr-4">
                <button
                    class="hover:bg-fill-tertiary flex size-7 items-center justify-center rounded-md hover:cursor-pointer"
                    onClick={props.onExport}
                    title="Export PDF"
                >
                    <IoDownloadOutline size={18} />
                </button>
            </div>
        </div>
    );
}

function ZoomPercentageInput(props: { zoom: Accessor<number>; onZoomChange: Setter<number> }) {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Enter") {
            (e.currentTarget as HTMLInputElement).blur();
        }
    };

    const handleSubmit = (value: string) => {
        const val = parseInt(value.replace("%", ""));
        if (!isNaN(val)) {
            const clampedVal = clampZoom(val);
            props.onZoomChange(clampedVal);
        }
    };

    return (
        <input
            type="text"
            value={props.zoom() + "%"}
            onBlur={(e) => handleSubmit(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            class="mx-1.5 h-7 w-12 rounded-lg border border-gray-300 bg-white text-center text-sm"
        />
    );
}
