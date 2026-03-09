import { Octokit } from "@octokit/rest";
import type { BranchInformation, EditorFile, EditorFiles, FilesResponse, RepositoryInformation } from "./types.js";
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
const GITHUB_PAGE_SIZE = 100;
const MAX_INSTALLATIONS = 20;

export type SimplePagination = {
    page: number;
    perPage: number;
    hasMore: boolean;
};

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

function toRepositoryInformation(
    repository: {
        owner?: { login?: string | null } | null;
        name: string;
        full_name?: string | null;
        html_url?: string | null;
    },
    installationId: number,
): RepositoryInformation {
    const owner = repository.owner?.login ?? repository.full_name?.split("/")[0] ?? "";
    return {
        owner,
        repo: repository.name,
        fullName: repository.full_name ?? `${owner}/${repository.name}`,
        url: repository.html_url ?? `https://github.com/${owner}/${repository.name}`,
        installationId,
    };
}

function sortBranches(branches: BranchInformation[]): BranchInformation[] {
    return branches.sort((left, right) => {
        if (left.isDefault !== right.isDefault) {
            return left.isDefault ? -1 : 1;
        }

        return left.name.localeCompare(right.name, undefined, {
            sensitivity: "base",
        });
    });
}

async function maybeRefreshAuth(runtime: RuntimeServices, c: ApiContext, auth: AuthCookie): Promise<AuthCookie> {
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

async function getInstallationIdForRepo(runtime: RuntimeServices, owner: string, repo: string): Promise<number> {
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

export async function getRepositoryInformation(
    runtime: RuntimeServices,
    octokit: Octokit,
    owner: string,
    repo: string,
): Promise<RepositoryInformation> {
    const [repoInfo, installationId] = await Promise.all([
        octokit.rest.repos.get({ owner, repo }),
        getInstallationIdForRepo(runtime, owner, repo),
    ]);

    return {
        owner,
        repo,
        fullName: repoInfo.data.full_name ?? `${owner}/${repo}`,
        url: repoInfo.data.html_url ?? `https://github.com/${owner}/${repo}`,
        installationId,
    };
}

async function getTextFile(
    octokit: Octokit,
    owner: string,
    repo: string,
    path: string,
    ref: string,
): Promise<EditorFile> {
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
    ref: string,
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

export async function listInstalledRepos(
    runtime: RuntimeServices,
    octokit: Octokit,
    pagination?: { page?: number; perPage?: number },
): Promise<{ repositories: RepositoryInformation[]; pagination: SimplePagination }> {
    const page = pagination?.page ?? 1;
    const perPage = pagination?.perPage ?? GITHUB_PAGE_SIZE;

    const installations = await octokit.rest.apps.listInstallationsForAuthenticatedUser({
        per_page: MAX_INSTALLATIONS,
        page: 1,
    });

    const matchingInstallations = installations.data.installations
        .filter((installation) => installation.app_slug === runtime.env.GITHUB_APP_SLUG)
        .slice(0, MAX_INSTALLATIONS);

    const repoLists = await Promise.all(
        matchingInstallations.map(async (installation) => {
            const { data } = await octokit.rest.apps.listInstallationReposForAuthenticatedUser({
                installation_id: installation.id,
                per_page: perPage,
                page,
            });

            return {
                repositories: data.repositories.map((repository) =>
                    toRepositoryInformation(repository, installation.id),
                ),
                hasMore: data.repositories.length === perPage,
            };
        }),
    );

    const byFullName = new Map<string, RepositoryInformation>();
    for (const pageResult of repoLists) {
        for (const repo of pageResult.repositories) {
            if (!byFullName.has(repo.fullName)) {
                byFullName.set(repo.fullName, repo);
            }
        }
    }

    return {
        repositories: Array.from(byFullName.values()).sort((left, right) =>
            left.fullName.localeCompare(right.fullName),
        ),
        pagination: {
            page,
            perPage,
            hasMore: repoLists.some((result) => result.hasMore),
        },
    };
}

export async function listBranchesForRepo(
    octokit: Octokit,
    owner: string,
    repo: string,
    pagination?: { page?: number; perPage?: number },
): Promise<{ branches: BranchInformation[]; pagination: SimplePagination }> {
    const page = pagination?.page ?? 1;
    const perPage = pagination?.perPage ?? GITHUB_PAGE_SIZE;
    const repoInfo = await octokit.rest.repos.get({ owner, repo });
    const defaultBranch = repoInfo.data.default_branch;

    let branches: BranchInformation[] = [];
    let hasMore = false;

    try {
        const { data } = await octokit.rest.repos.listBranches({
            owner,
            repo,
            per_page: perPage,
            page,
        });

        branches = data.map((branch) => ({
            name: branch.name,
            commitSha: branch.commit.sha,
            isDefault: branch.name === defaultBranch,
        }));
        hasMore = data.length === perPage;
    } catch (error) {
        if (statusOf(error) !== 409) {
            throw error;
        }
    }

    return {
        branches: sortBranches(branches),
        pagination: {
            page,
            perPage,
            hasMore,
        },
    };
}

export async function loadFilesResponse(
    runtime: RuntimeServices,
    octokit: Octokit,
    owner: string,
    repo: string,
    branchName: string,
): Promise<FilesResponse> {
    const [repoInfo, installationId] = await Promise.all([
        octokit.rest.repos.get({ owner, repo }),
        getInstallationIdForRepo(runtime, owner, repo),
    ]);

    const defaultBranch = repoInfo.data.default_branch;
    const repository: RepositoryInformation = {
        owner,
        repo,
        fullName: repoInfo.data.full_name ?? `${owner}/${repo}`,
        url: repoInfo.data.html_url ?? `https://github.com/${owner}/${repo}`,
        installationId,
    };

    let branch: BranchInformation;
    try {
        const ref = await octokit.rest.git.getRef({
            owner,
            repo,
            ref: `heads/${branchName}`,
        });
        branch = {
            name: branchName,
            commitSha: ref.data.object.sha,
            isDefault: branchName === defaultBranch,
        };
    } catch (error) {
        const status = statusOf(error);
        if (status === 404) {
            throw new ApiError(404, `Branch "${branchName}" was not found`);
        }

        if (status !== 409) {
            throw error;
        }

        branch = {
            name: branchName,
            commitSha: undefined,
            isDefault: branchName === defaultBranch,
        };
    }

    let files: EditorFiles = {
        markdown: null,
        css: null,
    };

    if (branch.commitSha) {
        const { markdownPath, cssPath } = await detectResumeFiles(octokit, owner, repo, branchName);
        const [markdown, css] = await Promise.all([
            markdownPath ? getTextFile(octokit, owner, repo, markdownPath, branchName) : Promise.resolve(null),
            cssPath ? getTextFile(octokit, owner, repo, cssPath, branchName) : Promise.resolve(null),
        ]);

        files = { markdown, css };
    }

    return {
        repository,
        branch,
        files,
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
        throw new ApiError(404, `Target branch "${targetBranch}" does not exist`);
    }

    const branchBase =
        (baseBranch && baseBranch.trim().length > 0 ? baseBranch.trim() : defaultBranch) || defaultBranch;

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
        throw new ApiError(404, `Base branch "${baseBranch}" does not exist`);
    }

    let hasBranches = false;
    try {
        const existingBranches = await octokit.rest.repos.listBranches({
            owner,
            repo,
            per_page: 1,
            page: 1,
        });
        hasBranches = existingBranches.data.length > 0;
    } catch (error) {
        if (statusOf(error) !== 409) {
            throw error;
        }
    }

    if (hasBranches) {
        throw new ApiError(404, `Base branch "${branchBase}" does not exist`);
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
