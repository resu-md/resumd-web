import { createSignal, type Accessor } from "solid-js";
import clsx from "clsx";
import { exportAsPdf } from "./exportPdf";
import PreviewControls from "./PreviewControls";
import PreviewPages from "./PreviewPages";

export default function Preview(props: { class: string; html: Accessor<string>; css: Accessor<string> }) {
    const [zoom, setZoom] = createSignal(100);

    function handleExport() {
        exportAsPdf(props.html(), props.css());
    }

    return (
        <div class={clsx(props.class, "flex flex-col")}>
            <div class="border-separator border-b">
                <PreviewControls zoom={zoom} setZoom={setZoom} onExport={handleExport} />
            </div>
            <div class="bg-system-secondary flex-1 overflow-auto">
                <div style={{ zoom: `${zoom()}%`, height: "100%" }}>
                    <PreviewPages html={props.html()} css={props.css()} />
                </div>
            </div>
        </div>
    );
}
