import { createEffect, onMount } from "solid-js";
import previewTemplate from "./pdf-preview-template.html?raw";

const PAGED_JS_URL = "https://unpkg.com/pagedjs/dist/paged.js"; // TODO: Bundle locally

export default function PreviewPages(props: { html: string; css: string }) {
    let iframeRef: HTMLIFrameElement | undefined;

    onMount(() => {
        const iframe = iframeRef;
        if (!iframe) return;

        // Initialize the iframe with the basic structure and the PagedJS library
        iframe.srcdoc = previewTemplate.replace("{{PAGED_JS_URL}}", PAGED_JS_URL);
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
