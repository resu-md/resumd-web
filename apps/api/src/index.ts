import { Hono } from "hono";
import { z } from "zod";
import type { BootstrapResponse, RepositoriesResponse, SaveRepoRequest, SaveRepoResponse } from "./types.js";
import {
    assertRepoAccessible,
    ensureTargetBranch,
    getRepositoryInformation,
    listBranchesForRepo,
    listInstalledRepos,
    loadFilesResponse,
    requireInstallationOctokit,
    requireUserOctokit,
} from "./github.js";
import {
    ApiError,
    clearCookie,
    COOKIE_AUTH,
    COOKIE_CTX,
    COOKIE_STATE,
    ensureBranchName,
    getRuntime,
    randomState,
    readSealedCookie,
    safeReturnTo,
    setSealedCookie,
    statusOf,
    type ApiContext,
    type AuthCookie,
    type AuthFlowContextCookie,
    type CookieState,
    type RuntimeBindings,
} from "./runtime.js";

const SaveRepoRequestSchema: z.ZodType<SaveRepoRequest> = z.object({
    targetBranch: z.string().trim().min(1),
    baseBranch: z.string().trim().min(1).optional(),
    createBranchIfMissing: z.boolean().optional(),
    expectedHeadSha: z.string().trim().min(1).optional(),
    message: z.string().trim().min(1).optional(),
    files: z.object({
        markdown: z.string(),
        css: z.string(),
        markdownPath: z.string().trim().min(1),
        cssPath: z.string().trim().min(1),
    }),
});

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 100;
const MAX_PER_PAGE = 100;

function requireQueryParam(c: ApiContext, key: string): string {
    const value = c.req.query(key)?.trim() ?? "";
    if (!value) {
        throw new ApiError(400, `${key} is required`);
    }

    return value;
}

function parseOptionalPositiveIntQuery(c: ApiContext, key: string, defaultValue: number, maxValue: number): number {
    const rawValue = c.req.query(key)?.trim();
    if (!rawValue) {
        return defaultValue;
    }

    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new ApiError(400, `${key} must be a positive integer`);
    }

    if (parsed > maxValue) {
        throw new ApiError(400, `${key} must be <= ${maxValue}`);
    }

    return parsed;
}

async function parseJsonBody<T>(c: ApiContext, schema: z.ZodType<T>): Promise<T> {
    let body: unknown;

    try {
        body = await c.req.json();
    } catch {
        throw new ApiError(400, "Invalid JSON body");
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid request body");
    }

    return parsed.data;
}

const app = new Hono<{ Bindings: RuntimeBindings }>();

app.get("/", (c) => {
    return c.json({ ok: true });
});

app.get("/api/auth/start", async (c) => {
    const runtime = getRuntime(c);
    const returnTo = safeReturnTo(c.req.query("returnTo"), "/");

    const flowContext: AuthFlowContextCookie = { returnTo };
    await setSealedCookie(c, runtime, COOKIE_CTX, flowContext, 60 * 60);

    const state = randomState();
    await setSealedCookie(c, runtime, COOKIE_STATE, { state } satisfies CookieState, 15 * 60);

    const auth = await readSealedCookie<AuthCookie>(c, runtime, COOKIE_AUTH);
    if (!auth?.token) {
        const { url } = runtime.oauthApp.getWebFlowAuthorizationUrl({ state });
        return c.redirect(url, 302);
    }

    try {
        const userOctokit = await requireUserOctokit(c, runtime);
        await userOctokit.rest.users.getAuthenticated();
        return c.redirect(`${runtime.env.APP_ORIGIN}${returnTo}`, 302);
    } catch (error) {
        const status = statusOf(error);

        if (status === 401) {
            clearCookie(c, COOKIE_AUTH);
            const { url } = runtime.oauthApp.getWebFlowAuthorizationUrl({ state });
            return c.redirect(url, 302);
        }

        return c.redirect(`${runtime.env.APP_ORIGIN}${returnTo}`, 302);
    }
});

app.get("/api/auth/callback", async (c) => {
    const runtime = getRuntime(c);
    const code = c.req.query("code")?.trim() ?? "";
    const state = c.req.query("state")?.trim() ?? "";
    const oauthError = c.req.query("error")?.trim();

    if (oauthError) {
        return c.text(`GitHub OAuth error: ${oauthError}`, 400);
    }

    if (!code || !state) {
        return c.text("Missing code/state", 400);
    }

    const stateCookie = await readSealedCookie<CookieState>(c, runtime, COOKIE_STATE);
    if (!stateCookie?.state || stateCookie.state !== state) {
        return c.text("Invalid state", 400);
    }
    clearCookie(c, COOKIE_STATE);

    const tokenResult = await runtime.oauthApp.createToken({ code, state });
    const auth = ((tokenResult as { authentication?: AuthCookie }).authentication ?? tokenResult) as AuthCookie;

    if (!auth?.token) {
        throw new ApiError(500, "Failed to create token");
    }

    await setSealedCookie(c, runtime, COOKIE_AUTH, auth, 180 * 24 * 60 * 60);

    const flowContext = await readSealedCookie<AuthFlowContextCookie>(c, runtime, COOKIE_CTX);
    const returnTo = safeReturnTo(flowContext?.returnTo, "/");
    clearCookie(c, COOKIE_CTX);

    const authorizeUrl = `/api/auth/start?returnTo=${encodeURIComponent(returnTo)}`;

    return c.redirect(authorizeUrl, 302);
});

app.post("/api/auth/logout", async (c) => {
    clearCookie(c, COOKIE_AUTH);
    clearCookie(c, COOKIE_CTX);
    clearCookie(c, COOKIE_STATE);
    return c.json({ ok: true });
});

app.get("/api/auth/manage", async (c) => {
    const runtime = getRuntime(c);
    return c.redirect(runtime.githubInstallationUrl, 302);
});

app.get("/api/bootstrap", async (c) => {
    const runtime = getRuntime(c);
    const owner = c.req.query("owner")?.trim() ?? "";
    const repo = c.req.query("repo")?.trim() ?? "";

    const auth = await readSealedCookie<AuthCookie>(c, runtime, COOKIE_AUTH);
    if (!auth?.token) {
        return c.body(null, 401);
    }

    let octokit;
    try {
        octokit = await requireUserOctokit(c, runtime);
    } catch (error) {
        if (statusOf(error) === 401) {
            clearCookie(c, COOKIE_AUTH);
            return c.body(null, 401);
        }

        throw error;
    }

    const me = await octokit.rest.users.getAuthenticated();

    let selected: BootstrapResponse["selected"] = null;
    if (owner && repo) {
        try {
            const selectedRepository = await getRepositoryInformation(runtime, octokit, owner, repo);
            const branchesResult = await listBranchesForRepo(octokit, owner, repo, {
                page: DEFAULT_PAGE,
                perPage: DEFAULT_PER_PAGE,
            });

            selected = {
                repository: selectedRepository,
                branches: {
                    items: branchesResult.branches,
                    pageInfo: branchesResult.pagination,
                },
            };
        } catch (error) {
            const status = statusOf(error);
            if (status === 401) {
                clearCookie(c, COOKIE_AUTH);
                return c.body(null, 401);
            }

            throw error;
        }
    }

    const response: BootstrapResponse = {
        user: {
            username: me.data.login,
            avatarUrl: me.data.avatar_url,
        },
        selected,
    };

    return c.json(response);
});

app.get("/api/repositories", async (c) => {
    const runtime = getRuntime(c);
    const page = parseOptionalPositiveIntQuery(c, "page", DEFAULT_PAGE, Number.MAX_SAFE_INTEGER);
    const perPage = parseOptionalPositiveIntQuery(c, "perPage", DEFAULT_PER_PAGE, MAX_PER_PAGE);

    let octokit;
    try {
        octokit = await requireUserOctokit(c, runtime);
    } catch (error) {
        if (statusOf(error) === 401) {
            clearCookie(c, COOKIE_AUTH);
            return c.body(null, 401);
        }

        throw error;
    }

    try {
        const repositoriesResult = await listInstalledRepos(runtime, octokit, { page, perPage });
        const response: RepositoriesResponse = {
            repositories: {
                items: repositoriesResult.repositories,
                pageInfo: repositoriesResult.pagination,
            },
        };
        return c.json(response);
    } catch (error) {
        if (statusOf(error) === 401) {
            clearCookie(c, COOKIE_AUTH);
            return c.body(null, 401);
        }

        throw error;
    }
});

app.get("/api/files", async (c) => {
    const runtime = getRuntime(c);
    const owner = requireQueryParam(c, "owner");
    const repo = requireQueryParam(c, "repo");
    const branch = ensureBranchName(requireQueryParam(c, "branch"), "branch");

    const octokit = await requireUserOctokit(c, runtime);
    const response = await loadFilesResponse(runtime, octokit, owner, repo, branch);
    return c.json(response);
});

app.post("/api/save", async (c) => {
    const runtime = getRuntime(c);
    const owner = requireQueryParam(c, "owner");
    const repo = requireQueryParam(c, "repo");

    const body = await parseJsonBody(c, SaveRepoRequestSchema);
    const targetBranch = ensureBranchName(body.targetBranch, "targetBranch");
    const baseBranch = body.baseBranch ? ensureBranchName(body.baseBranch, "baseBranch") : undefined;

    const userOctokit = await requireUserOctokit(c, runtime);
    await assertRepoAccessible(userOctokit, owner, repo);

    const botOctokit = await requireInstallationOctokit(runtime, owner, repo);
    const repoInfo = await botOctokit.rest.repos.get({ owner, repo });
    const defaultBranch = repoInfo.data.default_branch;

    const branchState = await ensureTargetBranch({
        octokit: botOctokit,
        owner,
        repo,
        targetBranch,
        defaultBranch,
        baseBranch,
        createBranchIfMissing: body.createBranchIfMissing ?? false,
    });

    if (body.expectedHeadSha && body.expectedHeadSha !== branchState.headSha) {
        return c.json(
            {
                error: "Branch head changed. Refresh before saving again.",
                currentHeadSha: branchState.headSha,
            },
            409,
        );
    }

    const markdownPath = body.files.markdownPath;
    const cssPath = body.files.cssPath;

    const [markdownBlob, cssBlob, currentCommit] = await Promise.all([
        botOctokit.rest.git.createBlob({
            owner,
            repo,
            content: body.files.markdown,
            encoding: "utf-8",
        }),
        botOctokit.rest.git.createBlob({
            owner,
            repo,
            content: body.files.css,
            encoding: "utf-8",
        }),
        botOctokit.rest.git.getCommit({
            owner,
            repo,
            commit_sha: branchState.headSha,
        }),
    ]);

    const tree = await botOctokit.rest.git.createTree({
        owner,
        repo,
        base_tree: currentCommit.data.tree.sha,
        tree: [
            {
                path: markdownPath,
                mode: "100644",
                type: "blob",
                sha: markdownBlob.data.sha,
            },
            {
                path: cssPath,
                mode: "100644",
                type: "blob",
                sha: cssBlob.data.sha,
            },
        ],
    });

    const commit = await botOctokit.rest.git.createCommit({
        owner,
        repo,
        message: body.message ?? "Update resume via resumd web",
        tree: tree.data.sha,
        parents: [branchState.headSha],
    });

    try {
        await botOctokit.rest.git.updateRef({
            owner,
            repo,
            ref: `heads/${targetBranch}`,
            sha: commit.data.sha,
            force: false,
        });
    } catch (error) {
        if (statusOf(error) === 422) {
            return c.json({ error: "Branch head changed while saving. Refresh and try again." }, 409);
        }

        throw error;
    }

    const response: SaveRepoResponse = {
        ok: true,
        branch: targetBranch,
        commitSha: commit.data.sha,
        headSha: commit.data.sha,
        createdBranch: branchState.createdBranch,
        updatedPaths: {
            markdown: markdownPath,
            css: cssPath,
        },
    };

    return c.json(response);
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((error, c) => {
    if (error instanceof ApiError) {
        if (error.status === 401) {
            return c.body(null, 401);
        }

        return c.json(
            {
                error: error.message,
                ...(error.hint ? { hint: error.hint } : {}),
            },
            { status: error.status as any },
        );
    }

    if (error instanceof z.ZodError) {
        return c.json(
            {
                error: error.issues[0]?.message ?? "Invalid request",
            },
            400,
        );
    }

    const status = statusOf(error) ?? 500;
    const message =
        typeof error === "object" && error && "message" in error && typeof error.message === "string"
            ? error.message
            : "Internal error";

    if (status === 401) {
        return c.body(null, 401);
    }

    return c.json({ error: message }, { status: status as any });
});

export default app;
export type * from "./types.js";
