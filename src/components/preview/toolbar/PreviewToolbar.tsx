import clsx from "clsx";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { FiChevronDown } from "solid-icons/fi";
import { IoFolderOpen, IoLogoGithub } from "solid-icons/io";
import { Show } from "solid-js";
import GithubDropdown from "./GithubDropdown";
import GithubDiff from "./GithubDiff";
import type { EditorMode } from "@/components/editor/editor-view-model";
import type { GithubRepository } from "@/contexts/github/GithubRepositoryContext";

export type PreviewToolbarConfig = {
    mode: EditorMode;
    canPush: boolean;
    diffAdded: number;
    diffRemoved: number;
    isSaving: boolean;
    onPush?: () => Promise<void> | void;
    showDiff: boolean;
    canShowDiff: boolean;
    onToggleDiff?: () => void;
    onRevertAll?: () => void;
    onSelectRepository?: (repo: GithubRepository) => Promise<boolean> | boolean;
    onSelectBranch?: (branchName: string) => Promise<boolean> | boolean;
    isBlockingLoad: boolean;
    isRevalidating: boolean;
};

export default function PreviewToolbar(props: {
    onExportPdf: () => void;
    onDownloadZip: () => void;
    toolbar: PreviewToolbarConfig;
}) {
    const canPushNow = () =>
        props.toolbar.mode === "github" &&
        props.toolbar.canPush &&
        !props.toolbar.isSaving &&
        !props.toolbar.isBlockingLoad;

    const saveLabel = () => {
        if (props.toolbar.mode !== "github") return "GitHub mode required";
        if (props.toolbar.isSaving) return "Pushing to GitHub...";
        if (!props.toolbar.canPush) return "No unsaved changes";
        return "Push to GitHub";
    };

    return (
        <div class="absolute top-3.5 right-0 left-0 flex items-center justify-between gap-3 px-3.5 pr-5">
            <div class="flex flex-[1_1_0%] items-center gap-2">
                <GithubDropdown
                    onSelectRepository={props.toolbar.onSelectRepository}
                    onSelectBranch={props.toolbar.onSelectBranch}
                    isSwitching={props.toolbar.isBlockingLoad}
                />

                <Show when={props.toolbar.mode === "github" && props.toolbar.canShowDiff}>
                    <GithubDiff
                        canShowDiff={props.toolbar.canShowDiff}
                        showDiff={props.toolbar.showDiff}
                        hasChanges={props.toolbar.canPush}
                        addedCount={props.toolbar.diffAdded}
                        removedCount={props.toolbar.diffRemoved}
                        onToggleDiff={props.toolbar.onToggleDiff}
                        onRevertAll={props.toolbar.onRevertAll}
                    />
                </Show>
            </div>

            <div class="flex flex-[1_1_0%] justify-end gap-2 pr-2">
                <DropdownMenu placement="bottom-end" gutter={8}>
                    <DropdownMenu.Trigger class="proeminent-button text-primary flex h-8.5 items-center gap-1 rounded-full pr-2 pl-3.5">
                        Save <FiChevronDown class="text-label-tertiary size-5 translate-y-px" />
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                        <DropdownMenu.Content class="proeminent-button flex flex-col rounded-[21px] p-[5px] text-sm">
                            <DropdownMenu.Item
                                disabled={!canPushNow()}
                                class="text-label-primary hover:bg-fill-secondary data-disabled:text-label-secondary flex h-8.5 w-full cursor-pointer items-center gap-1 rounded-full pr-4 pl-2 data-disabled:cursor-not-allowed"
                                title={saveLabel()}
                                onSelect={() => void props.toolbar.onPush?.()}
                            >
                                <IoLogoGithub size={17} class="mr-0.5 w-6" />
                                <span class="mt-px">{saveLabel()}</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                                class="text-label-primary hover:bg-fill-secondary flex h-8.5 w-full cursor-pointer items-center gap-1 rounded-full pr-4 pl-2"
                                onSelect={props.onDownloadZip}
                            >
                                <IoFolderOpen size={15} class="mr-0.5 w-6" />
                                <span class="mt-px">Download sources as .zip</span>
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu>
                <button
                    class={clsx(
                        "h-8.5 items-center justify-center gap-1.5 rounded-full px-3 text-white",
                        "bg-linear-to-b from-[#4da3ff] to-[#007aff] shadow-[inset_0_0_1px_1px_#ffffff33,0_2px_20px_#0000000a] backdrop-blur-md",
                        "outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#007aff]",
                    )}
                    onClick={props.onExportPdf}
                >
                    Export as PDF
                </button>
            </div>
        </div>
    );
}
