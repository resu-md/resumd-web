import { createSignal, createEffect, onMount, onCleanup, Show } from "solid-js";

const pagedJsUrl = `${import.meta.env.BASE_URL}paged.esm.js`;

interface PreviewPagesProps {
    html?: string;
    css?: string;
}

export default function PreviewPages(props: PreviewPagesProps) {
    let iframeRef: HTMLIFrameElement | undefined;

    const [iframeHeight, setIframeHeight] = createSignal(0);
    const [isRendering, setIsRendering] = createSignal(true);

    // 1. Initialize iframe content and Message Listeners (onMount)
    onMount(() => {
        // --- Message Handling ---
        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === "HEIGHT_UPDATE") {
                setIframeHeight(event.data.height);
            } else if (event.data.type === "RENDER_DONE") {
                setIsRendering(false);
            }
        };

        window.addEventListener("message", handleMessage);

        // --- Iframe Initialization ---
        const iframe = iframeRef;
        if (iframe && !iframe.srcdoc) {
            iframe.srcdoc = iframeHtmlContent(pagedJsUrl);
        }

        onCleanup(() => {
            window.removeEventListener("message", handleMessage);
        });
    });

    // 2. Trigger render when props change
    // In Solid, createEffect automatically tracks dependencies (props.html, props.css)
    createEffect(() => {
        // We access props here to ensure the effect tracks them
        const htmlContent = props.html || "";
        const cssContent = props.css || "";

        const iframe = iframeRef;

        // We need a way to stop the polling if the effect re-runs or component unmounts
        let pollInterval: number | undefined;

        const attemptRender = () => {
            if (iframe && iframe.contentWindow && (iframe.contentWindow as any).renderPreview) {
                setIsRendering(true);
                (iframe.contentWindow as any).renderPreview(htmlContent, cssContent);
                if (pollInterval) clearInterval(pollInterval);
            } else if (!pollInterval) {
                // Start polling if not ready and not already polling
                pollInterval = window.setInterval(attemptRender, 100);
            }
        };

        attemptRender();

        // Cleanup function called before the next effect run or on unmount
        onCleanup(() => {
            if (pollInterval) clearInterval(pollInterval);
        });
    });

    return (
        <div class="relative w-full p-8">
            <iframe
                ref={iframeRef}
                style={{
                    width: "100%",
                    height: iframeHeight() ? `${iframeHeight()}px` : "100vh",
                    border: "none",
                    overflow: "hidden",
                }}
                title="Resume Preview"
            />

            {/* Loading Indicator using Solid's <Show> */}
            <Show when={isRendering()}>
                <div class="fixed bottom-4 right-4 bg-black/50 text-white px-3 py-1 rounded text-sm pointer-events-none">
                    Rendering...
                </div>
            </Show>
        </div>
    );
}

const iframeHtmlContent = (pagedJsUrl: string) => `
<!doctype html>
<html>
    <head>
        <style>
            body {
                margin: 0;
                padding: 0;
                background: transparent;
            }
            .pagedjs_pages {
                display: flex;
                flex-direction: column;
                align-items: center;
                width: 100%;
            }
            .pagedjs_page {
                background: white;
                margin-bottom: 2rem;
                box-shadow:
                    0 4px 6px -1px rgb(0 0 0 / 0.1),
                    0 2px 4px -2px rgb(0 0 0 / 0.1);
            }
            /* Hide the buffer containers */
            .preview-buffer {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                visibility: hidden;
            }
            .preview-active {
                position: relative;
                visibility: visible;
            }
        </style>
    </head>
    <body>
        <div id="preview-a" class="preview-buffer"></div>
        <div id="preview-b" class="preview-buffer"></div>

        <script type="module">
            import { Previewer } from "${pagedJsUrl}";

            let activeBuffer = "preview-a";
            let renderId = 0;

            window.renderPreview = async (html, css) => {
                const currentRenderId = ++renderId;
                const targetId = activeBuffer === "preview-a" ? "preview-b" : "preview-a";
                const targetEl = document.getElementById(targetId);

                // Prepare content
                const fullContent =
                    "<style>* { overflow-wrap: break-word; word-break: break-word; }</style>" +
                    html +
                    "<style>" +
                    css +
                    "</style>";

                // Render
                const previewer = new Previewer();
                targetEl.innerHTML = "";

                try {
                    await previewer.preview(fullContent, [], targetEl);

                    // If this is still the latest render
                    if (currentRenderId === renderId) {
                        // Swap visibility
                        document.getElementById(activeBuffer).classList.remove("preview-active");
                        targetEl.classList.add("preview-active");
                        activeBuffer = targetId;

                        // Notify parent of height
                        updateHeight();

                        // Notify done
                        window.parent.postMessage({ type: "RENDER_DONE" }, "*");
                    }
                } catch (e) {
                    console.error(e);
                }
            };

            function updateHeight() {
                const height = document.body.scrollHeight;
                window.parent.postMessage({ type: "HEIGHT_UPDATE", height }, "*");
            }

            // Monitor resize
            const resizeObserver = new ResizeObserver(() => updateHeight());
            resizeObserver.observe(document.body);
        </script>
    </body>
</html>

`;
