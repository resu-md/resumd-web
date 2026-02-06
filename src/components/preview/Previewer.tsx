import { createMemo, type Accessor, Show, For } from "solid-js";
import { FaBrandsGithub } from "solid-icons/fa";
import clsx from "clsx";
// Utils
import { resolveMarkdown, type ParsedMarkdown } from "./parse-markdown";
import { exportAsPdf } from "./export-as-pdf";
import { exportAsZip } from "./export-as-zip";
import { marked } from "marked";
// Context
import { useZoom, useZoomShortcuts } from "./ZoomContext";
import type { GithubAuthStatus, GithubLinkedRepo } from "@/contexts/GithubAuthContext";
// Components
import ZoomControl from "./ZoomControl";
import PreviewPages from "./PreviewPages";
import SaveDropdown from "./SaveDropdown";

marked.use({
    tokenizer: {
        url(_) {
            // Disable automatic links for plain URLs/emails
            // www.example.com or test@gmail.com will not become <a> unless wrapped in [link.com](link.com)
            return undefined;
        },
    },
});

type RepoBranchOption = {
    name: string;
    commitSha?: string;
    isDefault?: boolean;
};

export default function Previewer(props: {
    class: string;
    markdown: Accessor<string>;
    css: Accessor<string>;
    owner?: string;
    repo?: string;
    onPush?: () => void;
    isPushing?: boolean;
    githubStatus?: GithubAuthStatus;
    githubUserLogin?: string;
    linkedRepos?: GithubLinkedRepo[];
    onSelectRepo?: (repo: GithubLinkedRepo) => void;
    branches?: ReadonlyArray<RepoBranchOption>;
    selectedBranch?: string;
    onSelectBranch?: (branch: string) => void;
    onCreateBranch?: () => void;
    isCreatingBranch?: boolean;
    isFetchingBranches?: boolean;
}) {
    const { zoom } = useZoom();
    const { handleKeyboardEvent, handleWheelEvent } = useZoomShortcuts();

    const parsedMarkdown = createMemo((prev: ParsedMarkdown | undefined) => resolveMarkdown(props.markdown(), prev));
    const html = createMemo(() => marked.parse(parsedMarkdown().body, { async: false }));
    const metadata = createMemo(() => parsedMarkdown().metadata, undefined, {
        equals: (prev, next) => prev.title === next.title && prev.lang === next.lang,
    });

    const handleExport = () => {
        exportAsPdf(html(), props.css(), metadata());
    };

    const handleDownloadZip = () => {
        exportAsZip(props.markdown(), props.css(), metadata());
    };

    const handleContainerKeyDown = (event: KeyboardEvent & { currentTarget: HTMLDivElement }) => {
        handleKeyboardEvent(event);
    };

    const handleContainerWheel = (event: WheelEvent & { currentTarget: HTMLDivElement }) => {
        handleWheelEvent(event);
    };

    const linkedRepos = () => props.linkedRepos ?? [];
    const selectedRepoSlug = () => (props.owner && props.repo ? `${props.owner}/${props.repo}` : "");
    const branchOptions = () => props.branches ?? [];
    const selectedBranch = () => props.selectedBranch ?? "";

    const shouldShowGithubBadge = () => props.githubStatus === "authenticated" || props.githubStatus === "loading";
    const canPush = () =>
        Boolean(
            props.owner &&
                props.repo &&
                props.onPush &&
                props.githubStatus === "authenticated" &&
                selectedBranch()
        );

    const repoOptions = createMemo(() => {
        const options = linkedRepos();
        const slug = selectedRepoSlug();
        if (!slug || !props.owner || !props.repo) return options;
        if (options.some((repo) => `${repo.owner}/${repo.repo}` === slug)) return options;
        return [{ owner: props.owner, repo: props.repo, fullName: slug, installationId: null }, ...options];
    });

    const handleRepoChange = (event: Event & { currentTarget: HTMLSelectElement }) => {
        if (!props.onSelectRepo) return;
        const slug = event.currentTarget.value;
        const match = repoOptions().find((repo) => `${repo.owner}/${repo.repo}` === slug);
        if (match) props.onSelectRepo(match);
    };

    const branchOptionsWithSelection = createMemo(() => {
        const options = branchOptions();
        const current = selectedBranch();
        if (!current) return options;
        if (options.some((branch) => branch.name === current)) return options;
        return [{ name: current }, ...options];
    });

    const handleBranchChange = (event: Event & { currentTarget: HTMLSelectElement }) => {
        if (!props.onSelectBranch) return;
        const name = event.currentTarget.value;
        if (name) props.onSelectBranch(name);
    };

    const branchPlaceholder = () => {
        if (props.isFetchingBranches) return "Loading branches...";
        if (branchOptionsWithSelection().length === 0) return "No branches";
        return "Select a branch";
    };

    const showBranchSelector = () =>
        props.githubStatus === "authenticated" &&
        (branchOptionsWithSelection().length > 0 || props.isFetchingBranches || Boolean(selectedBranch()));

    return (
        <div
            class={clsx(props.class, "group relative flex flex-col select-none")}
            tabIndex={0}
            onKeyDown={handleContainerKeyDown}
            onWheel={handleContainerWheel}
        >
            <div class="flex-1">
                <div style={{ zoom: `${zoom()}%`, height: "100%" }}>
                    <PreviewPages html={html()} css={props.css()} />
                </div>
            </div>

            <div class="absolute top-3 right-0 left-0 flex items-center justify-between gap-3 px-3.5">
                <div class="flex items-center gap-3">
                    <Show when={shouldShowGithubBadge()}>
                        <div class="text-system-foreground/80 flex items-center gap-1.5 rounded-full bg-white/60 px-2.5 py-1 text-sm font-medium backdrop-blur-md dark:bg-black/25">
                            <FaBrandsGithub class="size-3.5" />
                            <Show
                                when={props.githubStatus === "loading"}
                                fallback={
                                    <div class="flex items-center gap-2">
                                        <span>{props.githubUserLogin ?? "GitHub connected"}</span>
                                        <Show when={repoOptions().length > 0} fallback={
                                            <Show when={props.owner && props.repo}>
                                                <span class="opacity-50">•</span>
                                                <span>{props.owner}</span>
                                                <span class="opacity-50">/</span>
                                                <span>{props.repo}</span>
                                            </Show>
                                        }>
                                            <span class="opacity-40">•</span>
                                            <select
                                                class="bg-transparent text-sm font-medium focus:outline-none cursor-pointer border-none appearance-none"
                                                value={selectedRepoSlug()}
                                                onChange={handleRepoChange}
                                                aria-label="Connected GitHub repository"
                                                disabled={!props.onSelectRepo}
                                            >
                                                <option value="" disabled={selectedRepoSlug() !== ""}>
                                                    Select a repo
                                                </option>
                                                <For each={repoOptions()}>
                                                    {(repo) => (
                                                        <option value={`${repo.owner}/${repo.repo}`}>
                                                            {repo.fullName}
                                                        </option>
                                                    )}
                                                </For>
                                            </select>
                                        </Show>
                                    </div>
                                }
                            >
                                <span>Connecting…</span>
                            </Show>
                        </div>
                    </Show>

                    <Show when={showBranchSelector()}>
                        <div class="text-system-foreground/80 flex items-center gap-2 rounded-full bg-white/60 px-2.5 py-1 text-sm font-medium backdrop-blur-md dark:bg-black/25">
                            <span class="text-xs uppercase tracking-wide opacity-60">Branch</span>
                            <select
                                class="bg-transparent text-sm font-medium focus:outline-none cursor-pointer border-none appearance-none"
                                aria-label="Select GitHub branch"
                                value={selectedBranch()}
                                onChange={handleBranchChange}
                                disabled={!props.onSelectBranch || branchOptionsWithSelection().length === 0}
                            >
                                <option value="" disabled={selectedBranch() !== ""}>
                                    {branchPlaceholder()}
                                </option>
                                <For each={branchOptionsWithSelection()}>
                                    {(branch) => (
                                        <option value={branch.name}>{branch.name}</option>
                                    )}
                                </For>
                            </select>

                            <Show when={props.onCreateBranch}>
                                <button
                                    type="button"
                                    class="text-xs font-semibold uppercase tracking-wide rounded-md px-2 py-1 border border-black/10 dark:border-white/20 disabled:opacity-50"
                                    onClick={props.onCreateBranch}
                                    disabled={props.isCreatingBranch}
                                >
                                    {props.isCreatingBranch ? "Creating..." : "New"}
                                </button>
                            </Show>
                        </div>
                    </Show>
                </div>

                <div class="flex flex-1 items-center justify-end gap-3">
                    <Show when={canPush()}>
                        <button
                            type="button"
                            onClick={props.onPush}
                            disabled={props.isPushing}
                            class="bg-system-primary text-label-primary shadow-primary hover:bg-system-secondary flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <FaBrandsGithub class="size-3.5" />
                            <span>{props.isPushing ? "Pushing..." : "Push"}</span>
                        </button>
                    </Show>

                    <div class="flex flex-[1_1_0%] justify-end gap-3 pr-2">
                        <SaveDropdown onExportPdf={handleExport} onDownloadZip={handleDownloadZip} />
                    </div>
                </div>
            </div>

            <div
                class={clsx(
                    "absolute right-0 bottom-5 left-0 flex items-center justify-center",
                    "opacity-0 transition-opacity delay-500 duration-200 group-hover:opacity-100 group-hover:delay-300",
                )}
            >
                <ZoomControl />
            </div>
        </div>
    );
}
