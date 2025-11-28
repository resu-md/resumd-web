import { IoAdd, IoRemoveOutline } from "solid-icons/io";
import { onMount, onCleanup, type Accessor, type Setter } from "solid-js";

const ZOOM_STEPS = [25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 300, 400, 500];
const MIN_ZOOM = 25;
const MAX_ZOOM = 500;
const SCROLL_WHEEL_ZOOM_FACTOR = 1.2;

function clampZoom(value: number): number {
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

export default function ZoomControl(props: { zoom: Accessor<number>; setZoom: Setter<number> }) {
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
        <div class="bg-system-tertiary/90 shadow-secondary flex h-9 items-center overflow-hidden rounded-full backdrop-blur-md">
            <ZoomPercentageInput zoom={props.zoom} onZoomChange={props.setZoom} />

            <div class="bg-separator h-4 w-px" />

            <button
                class="active:bg-fill-quaternary focus-visible:bg-fill-quaternary flex h-9 w-8.5 items-center justify-center pl-0.5 hover:cursor-pointer focus:outline-none"
                onClick={handleZoomOut}
                title="Zoom out"
            >
                <IoRemoveOutline size={20} class="text-label-primary" />
            </button>

            <button
                class="active:bg-fill-quaternary focus-visible:bg-fill-quaternary flex h-9 w-8.5 items-center justify-center rounded-r-full pr-1 hover:cursor-pointer focus:outline-none"
                onClick={handleZoomIn}
                title="Zoom in"
            >
                <IoAdd size={20} class="text-label-primary" />
            </button>
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
            class="mr-0.5 ml-2 h-7 w-12 text-center text-sm outline-none"
        />
    );
}
