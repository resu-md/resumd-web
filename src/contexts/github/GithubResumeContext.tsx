import { useResume } from "@/contexts/ResumeContext";
import { api } from "@/lib/api";
import { GITHUB_STORAGE_KEYS } from "@/lib/storage-keys";
import { makePersisted, storageSync } from "@solid-primitives/storage";
import {
    createContext,
    createEffect,
    createMemo,
    createResource,
    createSignal,
    on,
    untrack,
    useContext,
    type Accessor,
    type JSXElement,
} from "solid-js";
import { useGithubAuth } from "./GithubAuthContext";
import { useGithubRepository } from "./GithubRepositoryContext";

type GithubRemoteFile = {
    path: string;
    sha: string;
    content: string;
};

export type GithubResumeReference = {
    owner: string;
    repo: string;
    branch: string;
    markdown: GithubRemoteFile | null;
    stylesheet: GithubRemoteFile | null;
    fetchedAt: number;
};

type GithubResumeApiResponse = {
    owner: string;
    repo: string;
    ref: string;
    defaultBranch: string;
    markdown: GithubRemoteFile | null;
    stylesheet: GithubRemoteFile | null;
};

type GithubSelection = {
    owner: string;
    repo: string;
    branch: string;
};

const MAX_CACHE_ENTRIES = 25;

const GithubResumeContext = createContext<{
    referenceResume: Accessor<GithubResumeReference | null>;
    isLoadingReference: Accessor<boolean>;
    referenceError: Accessor<string | null>;
    refreshReference: () => Promise<void>;
    isDiffMode: Accessor<boolean>;
    setDiffMode: (value: boolean) => void;
}>();

function buildReferenceKey(owner: string, repo: string, branch: string) {
    return `${owner}/${repo}#${branch}`;
}

function trimReferenceCache(cache: Record<string, GithubResumeReference>) {
    const entries = Object.entries(cache);
    if (entries.length <= MAX_CACHE_ENTRIES) return cache;

    const sorted = entries.sort(([, left], [, right]) => right.fetchedAt - left.fetchedAt).slice(0, MAX_CACHE_ENTRIES);
    return Object.fromEntries(sorted);
}

export function GithubResumeProvider(props: { children?: JSXElement }) {
    const { status } = useGithubAuth();
    const { selectedRepository, selectedBranch } = useGithubRepository();
    const { markdownDirty, cssDirty, applyContent } = useResume();

    const [referenceResume, setReferenceResume] = createSignal<GithubResumeReference | null>(null);
    const [referenceError, setReferenceError] = createSignal<string | null>(null);
    const [isDiffMode, setDiffMode] = createSignal(false);

    const [referenceCache, setReferenceCache] = makePersisted(createSignal<Record<string, GithubResumeReference>>({}), {
        name: GITHUB_STORAGE_KEYS.REFERENCE_CACHE,
        storage: localStorage,
        sync: storageSync,
    });

    const selection = createMemo<GithubSelection | null>(() => {
        if (status() !== "authenticated") return null;
        const repository = selectedRepository();
        const branch = selectedBranch();
        if (!repository || !branch) return null;
        return {
            owner: repository.owner,
            repo: repository.repo,
            branch: branch.name,
        };
    });

    const selectedReferenceKey = createMemo(() => {
        const currentSelection = selection();
        if (!currentSelection) return null;
        return buildReferenceKey(currentSelection.owner, currentSelection.repo, currentSelection.branch);
    });

    const [referenceResource, { refetch }] = createResource(
        () => selection() ?? undefined,
        async (currentSelection) => {
            const owner = encodeURIComponent(currentSelection.owner);
            const repo = encodeURIComponent(currentSelection.repo);
            const ref = encodeURIComponent(currentSelection.branch);
            const response = await api<GithubResumeApiResponse>(`/api/github/repo/${owner}/${repo}/resume?ref=${ref}`);

            const key = buildReferenceKey(currentSelection.owner, currentSelection.repo, currentSelection.branch);
            return {
                key,
                reference: {
                    owner: response.owner,
                    repo: response.repo,
                    branch: response.ref,
                    markdown: response.markdown,
                    stylesheet: response.stylesheet,
                    fetchedAt: Date.now(),
                } satisfies GithubResumeReference,
            };
        },
    );

    const tryApplyReference = (reference: GithubResumeReference) => {
        const isMarkdownDirty = untrack(markdownDirty);
        const isCssDirty = untrack(cssDirty);

        const nextContent: { markdown?: string; css?: string } = {};

        if (reference.markdown) {
            if (!isMarkdownDirty) {
                nextContent.markdown = reference.markdown.content;
            }
        }

        if (reference.stylesheet) {
            if (!isCssDirty) {
                nextContent.css = reference.stylesheet.content;
            }
        }

        if (nextContent.markdown !== undefined || nextContent.css !== undefined) {
            applyContent(nextContent, { markClean: true });
        }
    };

    createEffect(
        on(selectedReferenceKey, (key) => {
            setReferenceError(null);
            setDiffMode(false);

            if (!key) {
                setReferenceResume(null);
                return;
            }

            const cachedReference = untrack(() => referenceCache()[key]);
            if (!cachedReference) {
                setReferenceResume(null);
                return;
            }

            setReferenceResume(cachedReference);
            tryApplyReference(cachedReference);
        }),
    );

    createEffect(() => {
        const payload = referenceResource();
        const key = selectedReferenceKey();

        if (!payload || !key || payload.key !== key) return;

        setReferenceError(null);
        setReferenceResume(payload.reference);
        setReferenceCache((cache) => trimReferenceCache({ ...cache, [key]: payload.reference }));
        tryApplyReference(payload.reference);
    });

    createEffect(() => {
        const key = selectedReferenceKey();
        const error = referenceResource.error;
        if (!key || !error) return;
        const message = error instanceof Error ? error.message : "Failed to load repository resume files";
        setReferenceError(message);
    });

    createEffect(() => {
        if (status() !== "authenticated") {
            setDiffMode(false);
            return;
        }

        if (!referenceResume()) setDiffMode(false);
    });

    const isLoadingReference = createMemo(() => selectedReferenceKey() !== null && referenceResource.loading);

    const refreshReference = async () => {
        if (!selection()) return;
        await refetch();
    };

    return (
        <GithubResumeContext.Provider
            value={{
                referenceResume,
                isLoadingReference,
                referenceError,
                refreshReference,
                isDiffMode,
                setDiffMode,
            }}
        >
            {props.children}
        </GithubResumeContext.Provider>
    );
}

export function useGithubResume() {
    const context = useContext(GithubResumeContext);
    if (!context) throw new Error("useGithubResume must be used within a GithubResumeProvider");
    return context;
}
