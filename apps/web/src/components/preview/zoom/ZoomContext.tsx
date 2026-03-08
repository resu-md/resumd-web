import {
    createContext,
    createSignal,
    mergeProps,
    useContext,
    type Accessor,
    type JSXElement,
    type Setter,
} from "solid-js";

const ZoomContext = createContext<{
    zoom: Accessor<number>;
    setZoom: Setter<number>;
    zoomIn: () => void;
    zoomOut: () => void;
    zoomWithWheelDelta: (deltaY: number) => void;
}>();

const ZOOM_STEPS = [25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 300, 400, 500];
const DEFAULT_MIN_ZOOM = 25;
const DEFAULT_MAX_ZOOM = 500;
export const SCROLL_WHEEL_ZOOM_FACTOR = 1.2;

export function ZoomProvider(props: {
    initial?: number;
    factor?: number;
    min?: number;
    max?: number;
    children?: JSXElement;
}) {
    props = mergeProps({ factor: SCROLL_WHEEL_ZOOM_FACTOR, min: DEFAULT_MIN_ZOOM, max: DEFAULT_MAX_ZOOM }, props);

    const [zoom, setZoom] = createSignal(props.initial ?? 100);

    const zoomIn = () => {
        const next = ZOOM_STEPS.find((z) => z > zoom());
        if (next) setZoom(next);
    };

    const zoomOut = () => {
        const prev = [...ZOOM_STEPS].reverse().find((z) => z < zoom());
        if (prev) setZoom(prev);
    };

    const zoomWithWheelDelta = (deltaY: number) => {
        const normalizedDelta = -deltaY / 100;
        const multiplier = Math.pow(props.factor!, normalizedDelta);
        const newZoom = Math.max(props.min!, Math.min(props.max!, Math.round(zoom() * multiplier)));
        setZoom(newZoom);
    };

    const setZoomClamped: Setter<number> = (value) => {
        if (typeof value === "function") {
            setZoom((prev) => {
                const newValue = value(prev);
                return Math.max(props.min!, Math.min(props.max!, newValue));
            });
        } else {
            setZoom(Math.max(props.min!, Math.min(props.max!, value)));
        }
    };

    return (
        <ZoomContext.Provider value={{ zoom, setZoom: setZoomClamped, zoomIn, zoomOut, zoomWithWheelDelta }}>
            {props.children}
        </ZoomContext.Provider>
    );
}

type ZoomShortcutEvent = Pick<KeyboardEvent | WheelEvent, "ctrlKey" | "metaKey">;

export type ZoomShortcutHandlers = {
    handleKeyboardEvent: (event: KeyboardEvent) => void;
    handleWheelEvent: (event: WheelEvent) => void;
    handleWheelDelta: (deltaY: number, modifierActive?: boolean) => void;
};

export type ZoomShortcutOptions = {
    requireModifier?: boolean;
    modifierPredicate?: (event?: ZoomShortcutEvent) => boolean;
};

const defaultModifierPredicate = (event?: ZoomShortcutEvent) => Boolean(event?.ctrlKey || event?.metaKey);

export function useZoom() {
    const context = useContext(ZoomContext);
    if (!context) {
        throw new Error("useZoom must be used within a ZoomProvider");
    }
    return context;
}

export function useZoomShortcuts(options?: ZoomShortcutOptions): ZoomShortcutHandlers {
    const { zoomIn, zoomOut, zoomWithWheelDelta } = useZoom();

    const requireModifier = options?.requireModifier ?? true;
    const modifierPredicate = options?.modifierPredicate ?? defaultModifierPredicate;

    const modifierSatisfied = (event?: ZoomShortcutEvent, override?: boolean) => {
        if (!requireModifier) return true;
        if (override !== undefined) return override;
        return modifierPredicate(event);
    };

    const handleKeyboardEvent = (event: KeyboardEvent) => {
        if (!modifierSatisfied(event)) return;

        if (event.key === "+" || event.key === "=" || event.key === "Add") {
            event.preventDefault();
            zoomIn();
        } else if (event.key === "-" || event.key === "_" || event.key === "Subtract") {
            event.preventDefault();
            zoomOut();
        }
    };

    const handleWheelEvent = (event: WheelEvent) => {
        if (!modifierSatisfied(event)) return;
        event.preventDefault();
        zoomWithWheelDelta(event.deltaY);
    };

    const handleWheelDelta = (deltaY: number, modifierActive?: boolean) => {
        if (!modifierSatisfied(undefined, modifierActive)) return;
        zoomWithWheelDelta(deltaY);
    };

    return { handleKeyboardEvent, handleWheelEvent, handleWheelDelta };
}
