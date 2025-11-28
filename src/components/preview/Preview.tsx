import { createSignal, type Accessor } from "solid-js";
import clsx from "clsx";
import { exportAsPdf } from "./exportPdf";
// Contexts
import { useTheme } from "../../contexts/ThemeContext";
// Components
import { IoMoon, IoSunny } from "solid-icons/io";
import ZoomControl from "./ZoomControl";
import PreviewPages from "./PreviewPages";

export default function Preview(props: { class: string; html: Accessor<string>; css: Accessor<string> }) {
    const [zoom, setZoom] = createSignal(100);
    const { theme, toggleTheme } = useTheme();

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

            <div class="absolute top-3 right-0 left-0 flex justify-between px-3.5">
                <div class="flex-[1_1_0%]">
                    <button
                        class="active:bg-fill-quaternary focus-visible:bg-fill-quaternary bg-system-tertiary/90 shadow-secondary flex size-9 items-center justify-center rounded-full hover:cursor-pointer focus:outline-none"
                        onClick={toggleTheme}
                        title={`Switch to ${theme() === "light" ? "dark" : "light"} mode`}
                    >
                        {theme() === "light" ? (
                            <IoMoon size={18} class="text-label-secondary" />
                        ) : (
                            <IoSunny size={18} class="text-label-secondary" />
                        )}
                    </button>
                </div>

                <div>
                    <ZoomControl zoom={zoom} setZoom={setZoom} />
                </div>

                <div class="flex flex-[1_1_0%] justify-end gap-3">
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
