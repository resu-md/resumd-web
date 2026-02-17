import { createEffect, onCleanup, onMount } from "solid-js";
import { useZoomShortcuts } from "./ZoomContext";
import previewTemplate from "./pdf-preview-template.html?raw";

const PAGED_JS_URL = "https://unpkg.com/pagedjs/dist/paged.js"; // TODO: Bundle locally

export default function PreviewPages(props: { html: string; css: string; zoom: number }) {
    let iframeRef: HTMLIFrameElement | undefined;
    let detachInputHandlers: (() => void) | undefined;
    const { handleKeyboardEvent, handleWheelEvent } = useZoomShortcuts();

    const attachInputHandlers = () => {
        const iframe = iframeRef;
        if (!iframe) return;

        const contentWindow = iframe.contentWindow;
        if (!contentWindow) return;

        const handleWheel = (event: WheelEvent) => {
            handleWheelEvent(event);
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            handleKeyboardEvent(event);
        };

        contentWindow.addEventListener("wheel", handleWheel, { passive: false });
        contentWindow.addEventListener("keydown", handleKeyDown);

        detachInputHandlers = () => {
            contentWindow.removeEventListener("wheel", handleWheel);
            contentWindow.removeEventListener("keydown", handleKeyDown);
        };
    };

    const handleIframeLoad = () => {
        detachInputHandlers?.();
        attachInputHandlers();

        const doc = iframeRef?.contentDocument;
        if (doc) {
            doc.documentElement.style.setProperty("--preview-zoom-scale", `${props.zoom / 100}`);
        }
    };

    onMount(() => {
        const iframe = iframeRef;
        if (!iframe) return;

        iframe.addEventListener("load", handleIframeLoad);
        // Initialize the iframe with the basic structure and the PagedJS library
        iframe.srcdoc = previewTemplate.replace("{{PAGED_JS_URL}}", PAGED_JS_URL);
    });

    onCleanup(() => {
        iframeRef?.removeEventListener("load", handleIframeLoad);
        detachInputHandlers?.();
    });

    createEffect(() => {
        const html = props.html;
        const css = props.css;
        const iframe = iframeRef;

        if (!iframe) return;

        // We need to wait for the iframe to load initially
        const triggerRender = () => {
            if (iframe.contentWindow && (iframe.contentWindow as any).renderPreview) {
                (iframe.contentWindow as any).renderPreview(html, css);
            } else {
                // Retry shortly if not ready (e.g. script loading)
                setTimeout(triggerRender, 100);
            }
        };

        triggerRender();
    });

    // Update zoom scale CSS variable when zoom changes
    createEffect(() => {
        const iframe = iframeRef;
        if (!iframe?.contentDocument) return;
        iframe.contentDocument.documentElement.style.setProperty("--preview-zoom-scale", `${props.zoom / 100}`);
    });

    return (
        <iframe
            ref={iframeRef}
            style={{
                width: "100%",
                height: "100%",
                border: "none",
            }}
        />
    );
}
