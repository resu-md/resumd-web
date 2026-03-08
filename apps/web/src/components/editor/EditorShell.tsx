import { createSignal, type Accessor, type JSXElement } from "solid-js";
import ResizablePane from "../layout/ResizablePane";
import Tabs from "./Tabs";

export default function EditorShell(props: { tabs: string[]; children?: (activeTab: Accessor<string>) => JSXElement }) {
    const [activeTab, setActiveTab] = createSignal(props.tabs[0]);

    return (
        <ResizablePane
            class="relative z-10 p-3 pr-0"
            storageKey="resumd.editorWidth"
            defaultWidth={47}
            minWidth={25}
            maxWidth={65}
        >
            <div class="border-gray-5 dark:border-gray-4 bg-system-primary mt-4.5 h-[calc(100%-1.125rem)] overflow-hidden rounded-2xl border">
                <Tabs values={props.tabs} active={activeTab()} onChange={setActiveTab} />
                {props.children?.(activeTab)}
            </div>
        </ResizablePane>
    );
}
