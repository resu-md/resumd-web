import { createEffect, onMount, onCleanup } from "solid-js";

const pagedJsUrl = `${import.meta.env.BASE_URL}paged.esm.js`;

interface PreviewPagesProps {
    html: string;
    css: string;
}

export default function PreviewPages(props: PreviewPagesProps) {
    let iframeRef: HTMLIFrameElement | undefined;

    // 1. Initialize iframe content and Message Listeners (onMount)
    onMount(() => {
        // --- Iframe Initialization ---
        const iframe = iframeRef;
        if (iframe && !iframe.srcdoc) {
            iframe.srcdoc = iframeHtmlContent(pagedJsUrl);
        }
    });

    // 2. Trigger render when props change
    // In Solid, createEffect automatically tracks dependencies (props.html, props.css)
    createEffect(() => {
        // We access props here to ensure the effect tracks them
        const htmlContent = props.html;
        const cssContent = props.css;

        const iframe = iframeRef;

        // We need a way to stop the polling if the effect re-runs or component unmounts
        let pollInterval: number | undefined;

        const attemptRender = () => {
            if (iframe && iframe.contentWindow && (iframe.contentWindow as any).renderPreview) {
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
        <iframe
            ref={iframeRef}
            style={{
                width: "100%",
                height: "100%",
            }}
        />
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
        
            .preview-hidden {
                position: absolute;
                top: 0;
                left: 0;
                visibility: hidden;
            }
            .preview-visible {
                position: relative;
                visibility: visible;
            }

            .pagedjs_pages {
                width: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                margin: 5px 0;
            }
            .pagedjs_page {
                margin: 5px auto;
                border: 1px solid #ddd;
                background: white;
            }
        </style>
    </head>
    <body>
        <div id="preview-root"></div>

        <script type="module">
            import { Previewer } from "${pagedJsUrl}";

            let renderId = 0;
            let isRendering = false;
            let queuedRender = null;

            window.renderPreview = (html, css) => {
                queuedRender = { html, css };
                scheduleNextRender();
            };

            function scheduleNextRender() {
                if (isRendering || !queuedRender) {
                    return;
                }

                const { html, css } = queuedRender;
                queuedRender = null;
                startRender(html, css);
            }

            async function startRender(html, css) {
                isRendering = true;
                const currentRenderId = ++renderId;
                const root = document.getElementById("preview-root");

                if (!root) {
                    console.error("Preview root not found");
                    isRendering = false;
                    scheduleNextRender();
                    return;
                }

                // Ensure at least one page is rendered even if HTML is empty
                if (!html || !html.trim()) {
                    html = "&nbsp;";
                }

                // Create new container for this render
                const container = document.createElement("div");
                container.classList.add("preview-container", "preview-hidden");
                root.appendChild(container);

                // Inject CSS
                let styleEl = document.getElementById("user-style");
                if (!styleEl) {
                    styleEl = document.createElement("style");
                    styleEl.id = "user-style";
                    document.head.appendChild(styleEl);
                }
                // Prepend default @page rules so user CSS can override them
                css = "@page { margin: 0.4in; }\\nbody { margin: 0; padding: 0; }\\n\\n" + css; // TODO: DRY with exportPdf.ts
                styleEl.textContent = css;
                
                // Wait for fonts to load
                await document.fonts.ready;
                
                const previewer = new Previewer();
                const inlineStylesheets = [{ "inline://user.css": css }];

                try {
                    await previewer.preview(html, inlineStylesheets, container);

                    if (currentRenderId === renderId) {
                        // Remove old containers
                        Array.from(root.children).forEach(child => {
                            if (child !== container) {
                                child.remove();
                            }
                        });

                        // Show new container
                        container.classList.remove("preview-hidden");
                        container.classList.add("preview-visible");
                    } else {
                        // Superseded
                        container.remove();
                    }
                } catch (e) {
                    console.error(e);
                    container.remove();
                } finally {
                    isRendering = false;
                    scheduleNextRender();
                }
            }

        </script>
    </body>
</html>
`;
