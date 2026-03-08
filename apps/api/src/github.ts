import { Octokit } from "@octokit/rest";
import type { BranchSummary, RepoEditorResponse, RepoSummary } from "./contracts.js";
import {
    ApiError,
    type ApiContext,
    type AuthCookie,
    COOKIE_AUTH,
    readSealedCookie,
    setSealedCookie,
    statusOf,
    type RuntimeServices,
} from "./runtime.js";

const textDecoder = new TextDecoder();

function base64ToBytes(base64: string): Uint8Array {
    const bufferGlobal = globalThis as typeof globalThis & {
        Buffer?: {
            from: (input: string, encoding: string) => Uint8Array;
        };
    };

    if (bufferGlobal.Buffer) {
        return new Uint8Array(bufferGlobal.Buffer.from(base64, "base64"));
    }

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
}

function decodeBase64Text(value: string): string {
    const bytes = base64ToBytes(value.replace(/\n/g, ""));
    return textDecoder.decode(bytes);
}

async function maybeRefreshAuth(
    runtime: RuntimeServices,
    c: ApiContext,
    auth: AuthCookie,
): Promise<AuthCookie> {
    if (!auth.expiresAt || !auth.refreshToken) {
        return auth;
    }

    const expiresAtMs = Date.parse(auth.expiresAt);
    if (!Number.isFinite(expiresAtMs)) {
        return auth;
    }

    if (expiresAtMs - Date.now() > 2 * 60_000) {
        return auth;
    }

    const refreshed = await runtime.oauthApp.refreshToken({
        refreshToken: auth.refreshToken,
    });

    const refreshedAuth = ((refreshed as { authentication?: AuthCookie }).authentication ?? refreshed) as AuthCookie;
    if (refreshedAuth.token) {
        await setSealedCookie(c, runtime, COOKIE_AUTH, refreshedAuth, 180 * 24 * 60 * 60);
    }

    return refreshedAuth;
}

export async function requireUserOctokit(c: ApiContext, runtime: RuntimeServices): Promise<Octokit> {
    const auth = await readSealedCookie<AuthCookie>(c, runtime, COOKIE_AUTH);
    if (!auth?.token) {
        throw new ApiError(401, "Not authenticated");
    }

    const freshAuth = await maybeRefreshAuth(runtime, c, auth);
    return new Octokit({ auth: freshAuth.token });
}

export async function assertRepoAccessible(octokit: Octokit, owner: string, repo: string): Promise<void> {
    await octokit.rest.repos.get({ owner, repo });
}

async function getInstallationIdForRepo(
    runtime: RuntimeServices,
    owner: string,
    repo: string,
): Promise<number> {
    try {
        const { data } = await runtime.ghApp.octokit.request("GET /repos/{owner}/{repo}/installation", {
            owner,
            repo,
        });

        return (data as { id: number }).id;
    } catch {
        throw new ApiError(
            409,
            "GitHub App is not installed on this repository (or access is not granted)",
            "Install the app for this repository and grant Contents read/write permission.",
        );
    }
}

export async function requireInstallationOctokit(
    runtime: RuntimeServices,
    owner: string,
    repo: string,
): Promise<Octokit> {
    const installationId = await getInstallationIdForRepo(runtime, owner, repo);
    const inst = await runtime.ghApp.getInstallationOctokit(installationId);
    return inst as unknown as Octokit;
}

async function getTextFile(
    octokit: Octokit,
    owner: string,
    repo: string,
    path: string,
    ref?: string,
): Promise<{ path: string; sha: string; content: string }> {
    const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref,
    });

    if (Array.isArray(data) || data.type !== "file") {
        throw new ApiError(400, `Not a file: ${path}`);
    }

    return {
        path: data.path,
        sha: data.sha,
        content: decodeBase64Text(data.content ?? ""),
    };
}

export async function detectResumeFiles(
    octokit: Octokit,
    owner: string,
    repo: string,
    ref?: string,
): Promise<{ markdownPath: string | null; cssPath: string | null }> {
    try {
        const { data } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: "",
            ref,
        });

        if (!Array.isArray(data)) {
            return { markdownPath: null, cssPath: null };
        }

        const fileNames = data.filter((entry) => entry.type === "file").map((entry) => entry.name);

        const pick = (candidates: string[]) => candidates.find((candidate) => fileNames.includes(candidate));

        const markdownPath =
            pick(["resume.md", "Resume.md", "README.md"]) ??
            fileNames.find((name) => name.toLowerCase().endsWith(".md")) ??
            null;

        const cssPath =
            pick(["resume.css", "style.css", "styles.css"]) ??
            fileNames.find((name) => name.toLowerCase().endsWith(".css")) ??
            null;

        return { markdownPath, cssPath };
    } catch (error) {
        const status = statusOf(error);
        if (status === 404 || status === 409) {
            return { markdownPath: null, cssPath: null };
        }

        throw error;
    }
}

export async function listInstalledRepos(runtime: RuntimeServices, octokit: Octokit): Promise<RepoSummary[]> {
    const installations = await octokit.rest.apps.listInstallationsForAuthenticatedUser();

    const matchingInstallations = installations.data.installations.filter(
        (installation) => installation.app_slug === runtime.env.GITHUB_APP_SLUG,
    );

    const repoLists = await Promise.all(
        matchingInstallations.map(async (installation) => {
            const repos: RepoSummary[] = [];

            for (let page = 1; ; page += 1) {
                const { data } = await octokit.rest.apps.listInstallationReposForAuthenticatedUser({
                    installation_id: installation.id,
                    per_page: 100,
                    page,
                });

                for (const repository of data.repositories) {
                    const fullName = repository.full_name ?? `${repository.owner?.login ?? ""}/${repository.name}`;
                    repos.push({
                        owner: repository.owner?.login ?? fullName.split("/")[0] ?? "",
                        repo: repository.name,
                        fullName,
                        installationId: installation.id,
                        defaultBranch: repository.default_branch ?? undefined,
                    });
                }

                if (data.repositories.length < 100) {
                    break;
                }
            }

            return repos;
        }),
    );

    return repoLists.flat().sort((left, right) => left.fullName.localeCompare(right.fullName));
}

export async function listRepoBranches(
    octokit: Octokit,
    owner: string,
    repo: string,
): Promise<{ defaultBranch: string; branches: BranchSummary[] }> {
    const repoInfo = await octokit.rest.repos.get({ owner, repo });
    const defaultBranch = repoInfo.data.default_branch;

    let branchData: Array<{
        name: string;
        commit?: {
            sha?: string;
        };
    }> = [];

    try {
        branchData = (await octokit.paginate(octokit.rest.repos.listBranches, {
            owner,
            repo,
            per_page: 100,
        })) as Array<{
            name: string;
            commit?: {
                sha?: string;
            };
        }>;
    } catch (error) {
        const status = statusOf(error);
        if (status !== 409) {
            throw error;
        }
    }

    const branches: BranchSummary[] = branchData.map((branch) => ({
        name: branch.name,
        commitSha: branch.commit?.sha,
        isDefault: branch.name === defaultBranch,
    }));

    if (branches.length === 0) {
        branches.push({
            name: defaultBranch,
            commitSha: undefined,
            isDefault: true,
        });
    }

    branches.sort((left, right) => {
        if (left.isDefault !== right.isDefault) {
            return left.isDefault ? -1 : 1;
        }

        return left.name.localeCompare(right.name, undefined, {
            sensitivity: "base",
        });
    });

    return {
        defaultBranch,
        branches,
    };
}

export async function loadEditorPayload(
    octokit: Octokit,
    owner: string,
    repo: string,
    requestedBranch?: string,
): Promise<RepoEditorResponse> {
    const { defaultBranch, branches } = await listRepoBranches(octokit, owner, repo);
    const branchName = requestedBranch && requestedBranch.length > 0 ? requestedBranch : defaultBranch;
    const selectedBranch = branches.find((branch) => branch.name === branchName);

    if (!selectedBranch) {
        throw new ApiError(404, `Branch \"${branchName}\" was not found`);
    }

    const headSha = selectedBranch.commitSha ?? null;
    if (!headSha) {
        return {
            owner,
            repo,
            branch: branchName,
            defaultBranch,
            headSha: null,
            branches,
            files: {
                markdown: null,
                css: null,
            },
        };
    }

    const { markdownPath, cssPath } = await detectResumeFiles(octokit, owner, repo, branchName);

    const [markdown, css] = await Promise.all([
        markdownPath ? getTextFile(octokit, owner, repo, markdownPath, branchName) : Promise.resolve(null),
        cssPath ? getTextFile(octokit, owner, repo, cssPath, branchName) : Promise.resolve(null),
    ]);

    return {
        owner,
        repo,
        branch: branchName,
        defaultBranch,
        headSha,
        branches,
        files: {
            markdown,
            css,
        },
    };
}

export async function ensureTargetBranch(params: {
    octokit: Octokit;
    owner: string;
    repo: string;
    targetBranch: string;
    defaultBranch: string;
    baseBranch?: string;
    createBranchIfMissing: boolean;
}): Promise<{ headSha: string; createdBranch: boolean; baseBranch: string }> {
    const { octokit, owner, repo, targetBranch, defaultBranch, baseBranch, createBranchIfMissing } = params;

    try {
        const targetRef = await octokit.rest.git.getRef({
            owner,
            repo,
            ref: `heads/${targetBranch}`,
        });

        return {
            headSha: targetRef.data.object.sha,
            createdBranch: false,
            baseBranch: targetBranch,
        };
    } catch (error) {
        if (statusOf(error) !== 404) {
            throw error;
        }
    }

    if (!createBranchIfMissing) {
        throw new ApiError(404, `Target branch \"${targetBranch}\" does not exist`);
    }

    const branchBase = (baseBranch && baseBranch.trim().length > 0 ? baseBranch.trim() : defaultBranch) || defaultBranch;

    try {
        const baseRef = await octokit.rest.git.getRef({
            owner,
            repo,
            ref: `heads/${branchBase}`,
        });

        await octokit.rest.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${targetBranch}`,
            sha: baseRef.data.object.sha,
        });

        return {
            headSha: baseRef.data.object.sha,
            createdBranch: true,
            baseBranch: branchBase,
        };
    } catch (error) {
        const status = statusOf(error);

        if (status === 422) {
            const targetRef = await octokit.rest.git.getRef({
                owner,
                repo,
                ref: `heads/${targetBranch}`,
            });

            return {
                headSha: targetRef.data.object.sha,
                createdBranch: false,
                baseBranch: branchBase,
            };
        }

        if (status !== 404) {
            throw error;
        }
    }

    if (baseBranch) {
        throw new ApiError(404, `Base branch \"${baseBranch}\" does not exist`);
    }

    let hasBranches = false;
    try {
        const existingBranches = await octokit.rest.repos.listBranches({
            owner,
            repo,
            per_page: 1,
        });
        hasBranches = existingBranches.data.length > 0;
    } catch (error) {
        if (statusOf(error) !== 409) {
            throw error;
        }
    }

    if (hasBranches) {
        throw new ApiError(404, `Base branch \"${branchBase}\" does not exist`);
    }

    const tree = await octokit.rest.git.createTree({
        owner,
        repo,
        tree: [],
    });

    const commit = await octokit.rest.git.createCommit({
        owner,
        repo,
        message: `Initialize ${targetBranch}`,
        tree: tree.data.sha,
        parents: [],
    });

    await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${targetBranch}`,
        sha: commit.data.sha,
    });

    return {
        headSha: commit.data.sha,
        createdBranch: true,
        baseBranch: branchBase,
    };
}
