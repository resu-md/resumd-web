import { type Accessor, type Setter } from "solid-js";
import { useZoom } from "./ZoomContext";

import { CgMathMinus, CgMathPlus } from "solid-icons/cg";

const ZOOM_STEPS = [25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 300, 400, 500];
const MIN_ZOOM = 25;
const MAX_ZOOM = 500;

function clampZoom(value: number): number {
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

export default function ZoomControl() {
    const { zoom, setZoom, zoomIn, zoomOut } = useZoom();

    const handleZoomIn = () => {
        const next = ZOOM_STEPS.find((z) => z > zoom());
        if (next) zoomIn();
    };

    const handleZoomOut = () => {
        const prev = [...ZOOM_STEPS].reverse().find((z) => z < zoom());
        if (prev) zoomOut();
    };

    return (
        <div class="bg-fill-primary ring-separator flex h-7.5 w-fit items-center overflow-hidden rounded-full backdrop-blur-2xl">
            <ZoomPercentageInput zoom={zoom} onZoomChange={setZoom} />

            <div class="bg-separator h-4 w-px" />

            <button
                class="active:bg-fill-tertiary focus-visible:bg-fill-tertiary flex h-7.5 w-7 items-center justify-center pl-0.5 hover:cursor-pointer focus:outline-none"
                onClick={handleZoomOut}
                title="Zoom out"
            >
                <CgMathMinus class="text-label-primary" />
            </button>

            <button
                class="active:bg-fill-tertiary focus-visible:bg-fill-tertiary flex h-7.5 w-7 items-center justify-center rounded-r-full pr-1.5 hover:cursor-pointer focus:outline-none"
                onClick={handleZoomIn}
                title="Zoom in"
            >
                <CgMathPlus class="text-label-primary" />
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
            class="mr-1 ml-1.5 h-7.5 w-12 pb-0.5 text-center text-sm outline-none"
        />
    );
}
