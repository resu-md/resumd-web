import { createSignal, createEffect, onCleanup, createMemo } from "solid-js";
import { useParams } from "@solidjs/router";
import { makePersisted } from "@solid-primitives/storage";
// Constants
import markdownTemplate from "@/templates/refer.me/resume.md?raw";
import cssTemplate from "@/templates/refer.me/theme.css?raw";
// Components
import { ZoomProvider } from "@/components/preview/ZoomContext";
import Previewer from "@/components/preview/Previewer";
import Editor from "@/components/editor/Editor";
import Tabs from "@/components/editor/Tabs";
import ResizablePane from "@/components/ResizablePane";
import { useGithubAuth, type GithubLinkedRepo } from "@/contexts/GithubAuthContext";

type RepoBranch = {
    name: string;
    commitSha?: string;
    isDefault?: boolean;
};

export default function EditorPage() {
    const params = useParams();
    const github = useGithubAuth();

    // Editor State
    const [activeTab, setActiveTab] = createSignal<"resume.md" | "theme.css">("resume.md");
    const [markdown, setMarkdown] = makePersisted(createSignal(markdownTemplate), { name: "resumd.markdown" });
    const [css, setCss] = makePersisted(createSignal(cssTemplate), { name: "resumd.css" });
    const [branches, setBranches] = createSignal<RepoBranch[]>([]);
    const [activeBranch, setActiveBranch] = createSignal<string | null>(null);
    const [isFetchingBranches, setIsFetchingBranches] = createSignal(false);
    const [isCreatingBranch, setIsCreatingBranch] = createSignal(false);

    const redirectToGithubAuthorize = (owner: string, repo: string, returnTo?: string) => {
        if (typeof window === "undefined") return;
        const fallbackPath = returnTo ?? window.location.pathname + window.location.search;
        const safePath = fallbackPath.startsWith("/") ? fallbackPath : `/${fallbackPath}`;
        const search = new URLSearchParams({ owner, repo, returnTo: safePath });
        window.location.href = `/api/github/authorize?${search.toString()}`;
    };

    const resolvedOwner = createMemo(() => params.owner ?? github.activeRepo()?.owner);
    const resolvedRepo = createMemo(() => params.repo ?? github.activeRepo()?.repo);

    createEffect(() => {
        const owner = params.owner;
        const repo = params.repo;
        if (owner && repo) {
            github.setActiveRepoBySlug(owner, repo);
            setBranches([]);
            setActiveBranch(null);
        }
    });

    let lastResolvedRepoKey: string | null = null;
    createEffect(() => {
        const owner = resolvedOwner();
        const repo = resolvedRepo();
        const key = owner && repo ? `${owner}/${repo}` : null;
        if (key && key !== lastResolvedRepoKey) {
            setBranches([]);
            setActiveBranch(null);
        }
        lastResolvedRepoKey = key;
    });

    const pickBranch = (list: RepoBranch[], preferred?: string | null) => {
        if (!list.length) return null;
        if (preferred && list.some((branch) => branch.name === preferred)) return preferred;
        return list.find((branch) => branch.isDefault)?.name ?? list[0]?.name ?? null;
    };

    let branchFetchToken = 0;

    const fetchBranches = async (
        owner: string,
        repo: string,
        options?: { signal?: AbortSignal; prefer?: string }
    ) => {
        const token = ++branchFetchToken;
        const signal = options?.signal;
        try {
            setIsFetchingBranches(true);
            const res = await fetch(`/api/github/repo/${owner}/${repo}/branches`, { signal });

            if (res.status === 401) {
                github.markUnauthorized();
                redirectToGithubAuthorize(owner, repo);
                return;
            }

            if (res.status === 404) {
                redirectToGithubAuthorize(owner, repo);
                return;
            }

            if (!res.ok) {
                console.error("Failed to load branches", await res.text());
                return;
            }

            const data = await res.json();
            const list: RepoBranch[] = Array.isArray(data.branches) ? data.branches : [];
            setBranches(list);
            setActiveBranch((prev) => pickBranch(list, options?.prefer ?? prev ?? data.defaultBranch ?? null));
        } catch (error) {
            if (signal?.aborted) return;
            console.error("Failed to load branches", error);
        } finally {
            if (branchFetchToken === token) {
                setIsFetchingBranches(false);
            }
        }
    };

    createEffect(() => {
        const owner = resolvedOwner();
        const repo = resolvedRepo();
        const status = github.status();

        if (!owner || !repo) {
            setBranches([]);
            setActiveBranch(null);
            return;
        }

        if (status !== "authenticated") return;

        const controller = new AbortController();
        void fetchBranches(owner, repo, { signal: controller.signal });
        onCleanup(() => controller.abort());
    });

    const ensureRepoTracked = (owner: string, repo: string) => {
        const exists = github
            .linkedRepos()
            .some((linked) => linked.owner === owner && linked.repo === repo);
        if (!exists) {
            void github.refreshLinkedRepos().catch(() => undefined);
        }
    };

    // Fetch from GitHub if params are present
    createEffect(() => {
        const owner = resolvedOwner();
        const repo = resolvedRepo();
        const status = github.status();
        const linkedList = github.linkedRepos();
        const fromRoute = Boolean(params.owner && params.repo);
        const branch = activeBranch();

        if (!owner || !repo) {
            if (!fromRoute && status === "authenticated" && linkedList.length > 0) {
                github.setActiveRepo(linkedList[0]);
            }
            return;
        }

        if (status === "loading") return;

        if (status === "unauthenticated") {
            redirectToGithubAuthorize(owner, repo);
            return;
        }

        if (!fromRoute) {
            if (!linkedList.length) return;
            const match = linkedList.find((linkedRepo) => linkedRepo.owner === owner && linkedRepo.repo === repo);
            if (!match) {
                github.setActiveRepo(linkedList[0]);
                return;
            }
        }

        const controller = new AbortController();

        const fetchRepo = async () => {
            try {
                const branchQuery = branch ? `?ref=${encodeURIComponent(branch)}` : "";
                const res = await fetch(`/api/github/repo/${owner}/${repo}/resume${branchQuery}`, {
                    signal: controller.signal,
                });

                if (res.status === 401) {
                    github.markUnauthorized();
                    redirectToGithubAuthorize(owner, repo);
                    return;
                }

                if (res.status === 404) {
                    redirectToGithubAuthorize(owner, repo);
                    return;
                }

                if (!res.ok) {
                    let err: any = null;
                    try {
                        err = await res.json();
                    } catch {
                        err = { error: res.statusText };
                    }
                    console.error("Failed to fetch repo:", err);
                    alert(`Error fetching repo: ${err.error || res.statusText}`);
                    return;
                }

                const data = await res.json();

                if (data.markdown?.content) setMarkdown(data.markdown.content);
                if (data.stylesheet?.content) setCss(data.stylesheet.content);

                if (!branch) {
                    const resolved = data.ref ?? data.defaultBranch ?? null;
                    if (resolved) setActiveBranch(resolved);
                }

                ensureRepoTracked(owner, repo);
            } catch (error) {
                if (controller.signal.aborted) return;
                console.error("Network error:", error);
            }
        };

        void fetchRepo();

        onCleanup(() => controller.abort());
    });

    const [isPushing, setIsPushing] = createSignal(false);

    const handlePush = async () => {
        const owner = resolvedOwner();
        const repo = resolvedRepo();
        const branch = activeBranch();

        if (!owner || !repo) {
            alert("Select a GitHub repository to push changes.");
            return;
        }

        if (!branch) {
            alert("Select a branch to push changes.");
            return;
        }

        if (github.status() !== "authenticated") {
            redirectToGithubAuthorize(owner, repo);
            return;
        }

        const message = prompt("Enter commit message (optional):");
        if (message === null) return; // User cancelled

        setIsPushing(true);
        try {
            const res = await fetch(`/api/github/repo/${owner}/${repo}/push`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    markdown: markdown(),
                    css: css(),
                    message: message || undefined,
                    branch,
                })
            });

            if (res.status === 401) {
                github.markUnauthorized();
                redirectToGithubAuthorize(owner, repo);
                return;
            }

            if (!res.ok) {
                const err = await res.json();
                alert(`Failed to push: ${err.error || res.statusText}`);
                return;
            }

            alert("Successfully pushed to GitHub!");
        } catch (e) {
            console.error(e);
            alert("Error pushing to GitHub");
        } finally {
            setIsPushing(false);
        }
    };

    const handleBranchSelect = (branchName: string) => {
        if (!branchName) return;
        const exists = branches().some((branch) => branch.name === branchName);
        if (!exists) return;
        setActiveBranch(branchName);
    };

    const handleCreateBranch = async () => {
        const owner = resolvedOwner();
        const repo = resolvedRepo();
        if (!owner || !repo) {
            alert("Select a GitHub repository first.");
            return;
        }

        if (github.status() !== "authenticated") {
            redirectToGithubAuthorize(owner, repo);
            return;
        }

        const base = activeBranch() ?? branches()[0]?.name ?? "";
        const branchName = prompt("Enter new branch name:");
        if (branchName === null) return;
        const trimmed = branchName.trim();
        if (!trimmed) {
            alert("Branch name cannot be empty.");
            return;
        }

        setIsCreatingBranch(true);
        try {
            const res = await fetch(`/api/github/repo/${owner}/${repo}/branches`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: trimmed, from: base }),
            });

            if (res.status === 401) {
                github.markUnauthorized();
                redirectToGithubAuthorize(owner, repo);
                return;
            }

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: res.statusText }));
                alert(err.error || "Failed to create branch");
                return;
            }

            const data = await res.json();
            const newName = data.branch?.name ?? trimmed;
            await fetchBranches(owner, repo, { prefer: newName });
        } catch (error) {
            console.error("Failed to create branch", error);
            alert("Error creating branch");
        } finally {
            setIsCreatingBranch(false);
        }
    };

    return (
        <main class="bg-system-secondary/60 dark:bg-system-secondary padding-r flex h-dvh w-dvw">
            <ResizablePane
                class="relative z-10 p-3 pr-0"
                storageKey="resumd.editorWidth"
                defaultWidth={47}
                minWidth={25}
                maxWidth={65}
            >
                <div class="shadow-primary bg-system-primary flex h-full flex-col overflow-hidden rounded-xl dark:shadow-none">
                    <Tabs values={["resume.md", "theme.css"]} active={activeTab()} onChange={setActiveTab} />
                    <Editor
                        class="flex-1"
                        activeTabId={activeTab()}
                        tabs={[
                            {
                                id: "resume.md",
                                language: "markdown",
                                value: markdown(),
                                onChange: setMarkdown,
                            },
                            {
                                id: "theme.css",
                                language: "css",
                                value: css(),
                                onChange: setCss,
                            },
                        ]}
                    />
                </div>
            </ResizablePane>
            <ZoomProvider>
                <Previewer
                    class="flex-1"
                    markdown={markdown}
                    css={css}
                    owner={resolvedOwner()}
                    repo={resolvedRepo()}
                    branches={branches()}
                    selectedBranch={activeBranch() ?? undefined}
                    onSelectBranch={handleBranchSelect}
                    onCreateBranch={handleCreateBranch}
                    isCreatingBranch={isCreatingBranch()}
                    isFetchingBranches={isFetchingBranches()}
                    onPush={handlePush}
                    isPushing={isPushing()}
                    githubStatus={github.status()}
                    githubUserLogin={github.user()?.login}
                    linkedRepos={github.linkedRepos()}
                    onSelectRepo={(repoSelection: GithubLinkedRepo) => github.setActiveRepo(repoSelection)}
                />
            </ZoomProvider>
        </main>
    );
}
