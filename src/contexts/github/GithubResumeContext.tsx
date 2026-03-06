import {
    createContext,
    createEffect,
    createMemo,
    createResource,
    useContext,
    type JSXElement,
    type Resource,
} from "solid-js";
import { isServer } from "solid-js/web";
import { makeCache, makeRetrying } from "@solid-primitives/resource";
import { useGithubAuth } from "./GithubAuthContext";
import { useGithubRepository } from "./GithubRepositoryContext";
import { GITHUB_STORAGE_KEYS } from "@/lib/storage-keys";

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

type ResumeKey = {
    owner: string;
    repo: string;
    branch: string;
};

const GithubResumeContext = createContext<{
    resume: Resource<GithubResumeReference | null>;
    // refetchResume: () => Promise<GithubResumeReference | null | undefined>;
    // invalidateResume: (key?: ResumeKey) => void;
}>();

const resumeKeyHash = (key: ResumeKey) => `${key.owner}/${key.repo}?ref=${key.branch}`;

export function GithubResumeProvider(props: { children?: JSXElement }) {
    const { api } = useGithubAuth();
    const { selectedRepository, selectedBranch } = useGithubRepository();

    const source = createMemo<ResumeKey | null>(() => {
        const repo = selectedRepository();
        const branch = selectedBranch();
        if (!repo || !branch) return null;
        return {
            owner: repo.owner,
            repo: repo.repo,
            branch: branch.name,
        };
    });

    const fetchResume = async (key: ResumeKey): Promise<GithubResumeReference | null> => {
        try {
            const data = await api<GithubResumeApiResponse>(
                `/api/github/repo/${encodeURIComponent(key.owner)}/${encodeURIComponent(key.repo)}/resume?ref=${encodeURIComponent(key.branch)}`,
            );
            return {
                owner: data.owner,
                repo: data.repo,
                branch: data.ref,
                markdown: data.markdown,
                stylesheet: data.stylesheet,
                fetchedAt: Date.now(),
            };
        } catch (err: any) {
            const status = err?.status;
            // No resume files or key no longer valid -> treat as empty result.
            // Also remove any old positive cache for this exact key.
            if (status === 404 || status === 410) {
                invalidateResume(key);
                return null;
            }
            throw err;
        }
    };

    // Optional but nice for transient failures.
    const retryingFetchResume = makeRetrying(fetchResume, {
        retries: 2,
        delay: 750,
    });

    const [cachedFetchResume, invalidateResume] = makeCache(retryingFetchResume, {
        storage: isServer ? undefined : localStorage,
        storageKey: GITHUB_STORAGE_KEYS.RESUMES,
        sourceHash: resumeKeyHash,
        expires: (entry) => {
            // Cache "no resume here" briefly; real content longer.
            if (entry.data === null) return 60_000; // 1 minute
            return 15 * 60_000; // 15 minutes
        },
    });

    const [resume, { refetch }] = createResource(source, cachedFetchResume, {
        name: "debug:resume_createResource",
    });

    createEffect(() => {
        console.log(resume());
    });
    createEffect(() => {
        console.log(resume.state);
    });

    return (
        <GithubResumeContext.Provider
            value={{
                resume,
            }}
        >
            {props.children}
        </GithubResumeContext.Provider>
    );
}

export function useGithubResume() {
    const ctx = useContext(GithubResumeContext);
    if (!ctx) throw new Error("useGithubResume must be used within a GithubResumeProvider");
    return ctx;
}
