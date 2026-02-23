import { createEffect, onCleanup, onMount } from "solid-js";
import { useZoom, useZoomShortcuts } from "./ZoomContext";
import previewTemplate from "./pdf-preview-template.html?raw";

const PAGED_JS_URL = "https://unpkg.com/pagedjs/dist/paged.js"; // TODO: Bundle locally

export default function PreviewPages(props: { html: string; css: string; zoom: number }) {
    const { handleKeyboardEvent, handleWheelEvent } = useZoomShortcuts();
    const { zoom, setZoom } = useZoom();

    let iframeRef: HTMLIFrameElement | undefined;
    let detachInputHandlers: (() => void) | undefined;
    let initialZoomApplied = false;

    /**
     * Adjust the initial value of zoom to make the page fit the iframe viewport. Called uppon iframe's initialization.
     */
    const applyInitialFitZoom = () => {
        if (initialZoomApplied) return;

        const iframe = iframeRef;
        if (!iframe) {
            requestAnimationFrame(applyInitialFitZoom);
            return;
        }

        const doc = iframe.contentDocument;
        if (!doc) {
            requestAnimationFrame(applyInitialFitZoom);
            return;
        }

        const page = doc.querySelector(".pagedjs_page") as HTMLElement | null;
        const pagesContainer = doc.querySelector(".pagedjs_pages") as HTMLElement | null;
        if (!page) {
            requestAnimationFrame(applyInitialFitZoom);
            return;
        }

        const pageRect = page.getBoundingClientRect();
        const containerStyles = pagesContainer ? window.getComputedStyle(pagesContainer) : null;
        const containerMarginTop = containerStyles ? parseFloat(containerStyles.marginTop) || 0 : 0;
        const containerMarginBottom = containerStyles ? parseFloat(containerStyles.marginBottom) || 0 : 0;
        const totalPageHeight = pageRect.height + containerMarginTop + containerMarginBottom;
        const viewportWidth = iframe.clientWidth;
        const viewportHeight = iframe.clientHeight;
        if (!pageRect.width || !totalPageHeight || !viewportWidth || !viewportHeight) return;

        initialZoomApplied = true;

        const fitScale = Math.min(viewportWidth / pageRect.width, viewportHeight / totalPageHeight);
        if (!Number.isFinite(fitScale)) return;

        const paddingFactor = 0.98;
        const fitZoom = Math.min(100, Math.floor(fitScale * paddingFactor * 100));
        if (fitZoom > 0 && fitZoom < zoom()) {
            setZoom(fitZoom);
        }
    };

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
        if (!iframeRef) return;
        iframeRef.addEventListener("load", handleIframeLoad);
        iframeRef.srcdoc = previewTemplate.replace("{{PAGED_JS_URL}}", PAGED_JS_URL);
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
        applyInitialFitZoom();
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
