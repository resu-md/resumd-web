import { createSignal, type Accessor } from "solid-js";
import clsx from "clsx";
import printTemplate from "./pdf-print-template.html?raw";
// Components
import ZoomControl from "./ZoomControl";
import PreviewPages from "./PreviewPages";

export default function Preview(props: { class: string; html: Accessor<string>; css: Accessor<string> }) {
    const [zoom, setZoom] = createSignal(100);

    function handleExport() {
        exportAsPdf(props.html(), props.css());
    }

    return (
        <div class={clsx(props.class, "relative flex flex-col")}>
            <div class="flex-1 overflow-auto">
                <div style={{ zoom: `${zoom()}%`, height: "100%" }}>
                    <PreviewPages html={props.html()} css={props.css()} />
                </div>
            </div>

            <div class="absolute top-3 right-0 left-0 flex items-center justify-between gap-3 px-3.5">
                <div>
                    <ZoomControl zoom={zoom} setZoom={setZoom} />
                </div>

                <div class="flex flex-1 justify-end gap-3">
                    <button
                        class="bg-blue outline-blue focus-active:outline-2 flex h-9 cursor-pointer items-center rounded-full px-3.5 font-medium tracking-tight text-white outline-offset-2 backdrop-blur-md active:outline-2"
                        onClick={handleExport}
                        title="Export PDF"
                    >
                        <p>Export as PDF</p>
                        {/* <IoDownloadOutline class="mr-3 ml-2 size-5" /> */}
                    </button>
                </div>
            </div>
        </div>
    );
}

function exportAsPdf(html: string, css: string) {
    const htmlContent = printTemplate.replace("/*{{css}}*/", css).replace("<!--{{html}}-->", html);

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    const printWindow = window.open(url, "_blank", "width=800,height=600");

    if (!printWindow) {
        alert("Please allow popups to export as PDF");
        URL.revokeObjectURL(url);
        return;
    }

    printWindow.addEventListener("load", () => {
        URL.revokeObjectURL(url);
    });
}
