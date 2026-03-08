import { Hono } from "hono";
import { z } from "zod";
import type { BootstrapResponse, SaveRepoRequest, SaveRepoResponse } from "./contracts.js";
import {
    assertRepoAccessible,
    detectResumeFiles,
    ensureTargetBranch,
    listInstalledRepos,
    loadEditorPayload,
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
        markdownPath: z.string().trim().min(1).optional(),
        cssPath: z.string().trim().min(1).optional(),
    }),
});

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

app.get("/api/auth/start", async (c) => {
    const runtime = getRuntime(c);
    const owner = c.req.query("owner")?.trim() ?? "";
    const repo = c.req.query("repo")?.trim() ?? "";

    if (!owner || !repo) {
        return c.json({ error: "owner and repo are required" }, 400);
    }

    const fallbackReturnTo = `/${owner}/${repo}`;
    const returnTo = safeReturnTo(c.req.query("returnTo"), fallbackReturnTo);

    const flowContext: AuthFlowContextCookie = { owner, repo, returnTo };
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
        await assertRepoAccessible(userOctokit, owner, repo);
        return c.redirect(`${runtime.env.APP_ORIGIN}${returnTo}`, 302);
    } catch (error) {
        const status = statusOf(error);

        if (status === 401) {
            clearCookie(c, COOKIE_AUTH);
            const { url } = runtime.oauthApp.getWebFlowAuthorizationUrl({ state });
            return c.redirect(url, 302);
        }

        if (status === 404) {
            return c.redirect(runtime.githubInstallationUrl, 302);
        }

        if (status === 403) {
            return c.json(
                {
                    error: "Access denied. Check GitHub App permissions/installation.",
                    hint: "Ensure the GitHub App has Contents: Read & write and is installed for this repository.",
                },
                403,
            );
        }

        throw error;
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
    if (!flowContext?.owner || !flowContext?.repo) {
        return c.redirect(runtime.env.APP_ORIGIN, 302);
    }

    const authorizeUrl =
        `/api/auth/start?owner=${encodeURIComponent(flowContext.owner)}` +
        `&repo=${encodeURIComponent(flowContext.repo)}` +
        `&returnTo=${encodeURIComponent(flowContext.returnTo ?? "/")}`;

    return c.redirect(authorizeUrl, 302);
});

app.post("/api/auth/logout", async (c) => {
    clearCookie(c, COOKIE_AUTH);
    clearCookie(c, COOKIE_CTX);
    clearCookie(c, COOKIE_STATE);
    return c.json({ ok: true });
});

app.get("/api/bootstrap", async (c) => {
    const runtime = getRuntime(c);

    const auth = await readSealedCookie<AuthCookie>(c, runtime, COOKIE_AUTH);
    if (!auth?.token) {
        const response: BootstrapResponse = {
            authenticated: false,
            user: null,
            repos: [],
            selected: null,
        };

        return c.json(response);
    }

    let octokit;
    try {
        octokit = await requireUserOctokit(c, runtime);
    } catch (error) {
        if (statusOf(error) === 401) {
            clearCookie(c, COOKIE_AUTH);
            const response: BootstrapResponse = {
                authenticated: false,
                user: null,
                repos: [],
                selected: null,
            };
            return c.json(response);
        }

        throw error;
    }

    const ctxCookie = await readSealedCookie<AuthFlowContextCookie>(c, runtime, COOKIE_CTX);
    const owner = c.req.query("owner")?.trim() || ctxCookie?.owner || "";
    const repo = c.req.query("repo")?.trim() || ctxCookie?.repo || "";
    const branch = c.req.query("branch")?.trim() || undefined;

    const [me, repos] = await Promise.all([
        octokit.rest.users.getAuthenticated(),
        listInstalledRepos(runtime, octokit),
    ]);

    let selected = null;
    if (owner && repo) {
        try {
            await assertRepoAccessible(octokit, owner, repo);
            selected = await loadEditorPayload(octokit, owner, repo, branch);
        } catch (error) {
            const status = statusOf(error);
            if (status === 401) {
                clearCookie(c, COOKIE_AUTH);
                const response: BootstrapResponse = {
                    authenticated: false,
                    user: null,
                    repos: [],
                    selected: null,
                };

                return c.json(response);
            }

            if (status !== 403 && status !== 404) {
                throw error;
            }
        }
    }

    const response: BootstrapResponse = {
        authenticated: true,
        user: {
            username: me.data.login,
            avatarUrl: me.data.avatar_url,
        },
        repos,
        selected,
    };

    return c.json(response);
});

app.get("/api/repo/:owner/:repo/editor", async (c) => {
    const runtime = getRuntime(c);
    const owner = c.req.param("owner");
    const repo = c.req.param("repo");
    const branch = c.req.query("branch")?.trim() || undefined;

    const octokit = await requireUserOctokit(c, runtime);
    await assertRepoAccessible(octokit, owner, repo);

    const payload = await loadEditorPayload(octokit, owner, repo, branch);
    return c.json(payload);
});

app.post("/api/repo/:owner/:repo/save", async (c) => {
    const runtime = getRuntime(c);
    const owner = c.req.param("owner");
    const repo = c.req.param("repo");

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

    const detectedFiles = await detectResumeFiles(botOctokit, owner, repo, targetBranch);
    const markdownPath = body.files.markdownPath ?? detectedFiles.markdownPath ?? "resume.md";
    const cssPath = body.files.cssPath ?? detectedFiles.cssPath ?? "style.css";

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

    return c.json({ error: message }, { status: status as any });
});

export default app;
export type * from "./contracts.js";
