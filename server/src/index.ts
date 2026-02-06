import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import { z } from "zod";
import { OAuthApp } from "@octokit/oauth-app";
import { Octokit } from "@octokit/rest";
import { App as GitHubApp } from "@octokit/app";

const EnvSchema = z.object({
    APP_ORIGIN: z.string().url(),
    BACKEND_ORIGIN: z.string().url(),

    // GitHub App OAuth (user-to-server)
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    GITHUB_APP_SLUG: z.string().min(1),

    // GitHub App installation auth (bot)
    GITHUB_APP_ID: z.string().regex(/^\d+$/, "GITHUB_APP_ID must be numeric"),
    GITHUB_PRIVATE_KEY: z.string().min(1),

    COOKIE_SECRET: z.string().min(32),
    NODE_ENV: z.string().optional(),
    PORT: z.string().default("8787"),
});

const env = EnvSchema.parse(process.env);

const isProd = env.NODE_ENV === "production";
const PORT = Number(env.PORT);

const COOKIE_AUTH = "resumd_gh_auth";
const COOKIE_CTX = "resumd_gh_ctx";
const COOKIE_STATE = "resumd_gh_state";

type AuthCookie = {
    token: string;
    refreshToken?: string;
    expiresAt?: string; // ISO string
    refreshTokenExpiresAt?: string; // ISO string
    tokenType?: string;
    scopes?: string[]; // empty/undefined for GitHub Apps
};

type CtxCookie = {
    owner: string;
    repo: string;
    returnTo: string; // path like "/owner/repo"
};

function b64url(buf: Buffer) {
    return buf.toString("base64url");
}
function unb64url(s: string) {
    return Buffer.from(s, "base64url");
}

const key = crypto.createHash("sha256").update(env.COOKIE_SECRET).digest(); // 32 bytes

function seal(obj: unknown): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${b64url(iv)}.${b64url(tag)}.${b64url(ciphertext)}`;
}

function open<T>(token: string): T | null {
    try {
        const [ivS, tagS, ctS] = token.split(".");
        if (!ivS || !tagS || !ctS) return null;
        const iv = unb64url(ivS);
        const tag = unb64url(tagS);
        const ct = unb64url(ctS);
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(tag);
        const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
        return JSON.parse(plaintext.toString("utf8")) as T;
    } catch {
        return null;
    }
}

function setCookie(res: express.Response, name: string, value: string, maxAgeMs?: number) {
    res.cookie(name, value, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: maxAgeMs,
    });
}

function clearCookie(res: express.Response, name: string) {
    res.clearCookie(name, { path: "/" });
}

function safeReturnTo(pathMaybe: unknown, fallback: string) {
    if (typeof pathMaybe !== "string") return fallback;
    if (!pathMaybe.startsWith("/")) return fallback;
    if (pathMaybe.startsWith("//")) return fallback;
    return pathMaybe;
}

function randomState() {
    return crypto.randomBytes(24).toString("base64url");
}

// 1) OAuth for GitHub App user tokens
const oauthApp = new OAuthApp({
    clientType: "github-app",
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    redirectUrl: `${env.BACKEND_ORIGIN}/api/github/oauth/callback`,
});

// 2) GitHub App installation auth for bot commits
const ghApp = new GitHubApp({
    appId: Number(env.GITHUB_APP_ID),
    privateKey: env.GITHUB_PRIVATE_KEY.replace(/\n/g, "\n"),
    Octokit,
});

async function maybeRefreshAuth(auth: AuthCookie, res: express.Response): Promise<AuthCookie> {
    if (!auth.expiresAt || !auth.refreshToken) return auth;

    const expiresAtMs = Date.parse(auth.expiresAt);
    if (!Number.isFinite(expiresAtMs)) return auth;

    // Refresh if expiring within 2 minutes
    if (expiresAtMs - Date.now() > 2 * 60_000) return auth;

    const refreshed = await oauthApp.refreshToken({ refreshToken: auth.refreshToken });
    const newAuth = (refreshed as any).authentication ?? refreshed;
    setCookie(res, COOKIE_AUTH, seal(newAuth), 30 * 24 * 60 * 60_000);
    return newAuth;
}

async function requireUserOctokit(req: express.Request, res: express.Response): Promise<Octokit> {
    const raw = req.cookies?.[COOKIE_AUTH];
    const auth = raw ? open<AuthCookie>(raw) : null;
    if (!auth?.token) {
        const err: any = new Error("Not authenticated");
        err.status = 401;
        throw err;
    }
    const fresh = await maybeRefreshAuth(auth, res);
    return new Octokit({ auth: fresh.token });
}

/**
 * If we can read repo metadata using USER token, the user is authorized and
 * the app is installed for that repo (because GitHub App user tokens are limited
 * to installations).
 */
async function assertRepoAccessible(octokit: Octokit, owner: string, repo: string) {
    await octokit.rest.repos.get({ owner, repo });
}

/**
 * Fetch the installation id for this repo using APP auth (JWT).
 * This is what lets us create an installation token and commit as <app>[bot].
 */
async function getInstallationIdForRepo(owner: string, repo: string): Promise<number> {
    try {
        const { data } = await ghApp.octokit.request("GET /repos/{owner}/{repo}/installation", { owner, repo });
        return (data as any).id as number;
    } catch (e: any) {
        const err: any = new Error(
            "GitHub App is not installed on this repository (or not granted access). Please install the app for this repo.",
        );
        err.status = 409;
        throw err;
    }
}

async function requireInstallationOctokit(owner: string, repo: string): Promise<Octokit> {
    const installationId = await getInstallationIdForRepo(owner, repo);
    const inst = await ghApp.getInstallationOctokit(installationId);
    return inst as unknown as Octokit;
}

async function getTextFile(octokit: Octokit, owner: string, repo: string, path: string, ref?: string) {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref });
    if (Array.isArray(data) || (data as any).type !== "file") {
        const err: any = new Error(`Not a file: ${path}`);
        err.status = 400;
        throw err;
    }
    const file = data as any;
    const contentB64 = file.content ?? "";
    const content = Buffer.from(contentB64, "base64").toString("utf8");
    return { path: file.path as string, sha: file.sha as string, content };
}

async function detectResumeFiles(octokit: Octokit, owner: string, repo: string, ref?: string) {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path: "", ref });
    if (!Array.isArray(data)) {
        const err: any = new Error("Unexpected repo root response");
        err.status = 500;
        throw err;
    }

    const names = data.filter((x: any) => x.type === "file").map((x: any) => x.name as string);

    const pick = (candidates: string[]) => candidates.find((n) => names.includes(n));

    const md = pick(["resume.md", "Resume.md", "README.md"]) ?? names.find((n) => n.toLowerCase().endsWith(".md"));

    const css = pick(["resume.css", "style.css", "styles.css"]) ?? names.find((n) => n.toLowerCase().endsWith(".css"));

    return { md, css };
}

const app = express();
app.set("trust proxy", true);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

/**
 * Entry point used by your SPA route /:owner/:repo:
 * Navigate browser to:
 *   /api/github/authorize?owner=...&repo=...&returnTo=/owner/repo
 *
 * This will:
 *   1) redirect to GitHub OAuth if no token cookie
 *   2) if token exists, check repo access; if missing, redirect to install page
 *   3) if OK, redirect back to APP_ORIGIN + returnTo
 */
app.get("/api/github/authorize", async (req, res, next) => {
    try {
        const owner = String(req.query.owner || "");
        const repo = String(req.query.repo || "");
        const fallbackReturnTo = `/${owner}/${repo}`;
        const returnTo = safeReturnTo(req.query.returnTo, fallbackReturnTo);

        if (!owner || !repo) {
            res.status(400).json({ error: "owner and repo are required" });
            return;
        }

        const ctx: CtxCookie = { owner, repo, returnTo };
        setCookie(res, COOKIE_CTX, seal(ctx), 60 * 60_000); // 1 hour
        const state = randomState();
        setCookie(res, COOKIE_STATE, seal({ state }), 15 * 60_000); // 15 min

        const rawAuth = req.cookies?.[COOKIE_AUTH];
        const auth = rawAuth ? open<AuthCookie>(rawAuth) : null;

        if (!auth?.token) {
            const { url } = oauthApp.getWebFlowAuthorizationUrl({ state });
            res.redirect(url);
            return;
        }

        const userOctokit = await requireUserOctokit(req, res);

        try {
            await assertRepoAccessible(userOctokit, owner, repo);
            res.redirect(`${env.APP_ORIGIN}${returnTo}`);
            return;
        } catch (e: any) {
            const status = e?.status;

            // If the token is invalid/expired in a way refresh didn't fix
            if (status === 401) {
                clearCookie(res, COOKIE_AUTH);
                const { url } = oauthApp.getWebFlowAuthorizationUrl({ state });
                res.redirect(url);
                return;
            }

            // Most common for private repos when app not installed on that repo
            if (status === 404) {
                const installUrl = `https://github.com/apps/${encodeURIComponent(env.GITHUB_APP_SLUG)}/installations/new`;
                res.redirect(installUrl);
                return;
            }

            // Installed but missing permissions (e.g. Contents write not granted)
            if (status === 403) {
                res.status(403).json({
                    error: "Access denied. Check GitHub App permissions/installation.",
                    hint: "Ensure the GitHub App has Contents: Read & write and is installed for this repository.",
                });
                return;
            }

            throw e;
        }
    } catch (err) {
        next(err);
    }
});

app.get("/api/github/oauth/callback", async (req, res, next) => {
    try {
        const code = String(req.query.code || "");
        const state = String(req.query.state || "");
        const error = req.query.error ? String(req.query.error) : null;

        if (error) {
            res.status(400).send(`GitHub OAuth error: ${error}`);
            return;
        }
        if (!code || !state) {
            res.status(400).send("Missing code/state");
            return;
        }

        const rawState = req.cookies?.[COOKIE_STATE];
        const stateObj = rawState ? open<{ state: string }>(rawState) : null;
        if (!stateObj?.state || stateObj.state !== state) {
            res.status(400).send("Invalid state");
            return;
        }
        clearCookie(res, COOKIE_STATE);

        const tokenResult = await oauthApp.createToken({ code, state });
        const auth = (tokenResult as any).authentication ?? (tokenResult as any);
        if (!auth?.token) {
            res.status(500).send("Failed to create token");
            return;
        }

        setCookie(res, COOKIE_AUTH, seal(auth), 180 * 24 * 60 * 60_000); // 180 days cookie lifetime

        const rawCtx = req.cookies?.[COOKIE_CTX];
        const ctx = rawCtx ? open<CtxCookie>(rawCtx) : null;
        const owner = ctx?.owner ?? "";
        const repo = ctx?.repo ?? "";
        const returnTo = ctx?.returnTo ?? "/";

        const authorizeUrl =
            `/api/github/authorize?owner=${encodeURIComponent(owner)}` +
            `&repo=${encodeURIComponent(repo)}` +
            `&returnTo=${encodeURIComponent(returnTo)}`;

        res.redirect(authorizeUrl);
    } catch (err) {
        next(err);
    }
});

app.get("/api/github/setup", async (req, res) => {
    // We don’t trust installation_id from query (spoofable). We just re-run /authorize.
    const rawCtx = req.cookies?.[COOKIE_CTX];
    const ctx = rawCtx ? open<CtxCookie>(rawCtx) : null;
    const owner = ctx?.owner ?? "";
    const repo = ctx?.repo ?? "";
    const returnTo = ctx?.returnTo ?? "/";

    const authorizeUrl =
        `/api/github/authorize?owner=${encodeURIComponent(owner)}` +
        `&repo=${encodeURIComponent(repo)}` +
        `&returnTo=${encodeURIComponent(returnTo)}`;

    res.redirect(authorizeUrl);
});

app.post("/api/github/logout", (req, res) => {
    clearCookie(res, COOKIE_AUTH);
    clearCookie(res, COOKIE_CTX);
    clearCookie(res, COOKIE_STATE);
    res.json({ ok: true });
});

app.get("/api/github/me", async (req, res, next) => {
    try {
        const octokit = await requireUserOctokit(req, res);
        const { data } = await octokit.rest.users.getAuthenticated();
        res.json({ login: data.login, id: data.id, avatarUrl: data.avatar_url });
    } catch (err) {
        next(err);
    }
});

app.get("/api/github/repo/:owner/:repo/resume", async (req, res, next) => {
    try {
        const { owner, repo } = req.params;
        const ref = req.query.ref ? String(req.query.ref) : undefined;

        const octokit = await requireUserOctokit(req, res);
        await assertRepoAccessible(octokit, owner, repo);

        const repoInfo = await octokit.rest.repos.get({ owner, repo });
        const defaultBranch = repoInfo.data.default_branch;

        const { md, css } = await detectResumeFiles(octokit, owner, repo, ref ?? defaultBranch);

        if (!md && !css) {
            res.status(404).json({
                error: "No .md/.css files found in repo root",
                hint: "Put resume.md and style.css in the repo root (or update detection logic).",
            });
            return;
        }

        const markdown = md ? await getTextFile(octokit, owner, repo, md, ref ?? defaultBranch) : null;
        const stylesheet = css ? await getTextFile(octokit, owner, repo, css, ref ?? defaultBranch) : null;

        res.json({
            owner,
            repo,
            ref: ref ?? defaultBranch,
            defaultBranch,
            markdown,
            stylesheet,
        });
    } catch (err) {
        next(err);
    }
});

app.get("/api/github/repo/:owner/:repo/file", async (req, res, next) => {
    try {
        const { owner, repo } = req.params;
        const path = String(req.query.path || "");
        const ref = req.query.ref ? String(req.query.ref) : undefined;

        if (!path) {
            res.status(400).json({ error: "path is required" });
            return;
        }

        const octokit = await requireUserOctokit(req, res);
        await assertRepoAccessible(octokit, owner, repo);

        const repoInfo = await octokit.rest.repos.get({ owner, repo });
        const defaultBranch = repoInfo.data.default_branch;

        const file = await getTextFile(octokit, owner, repo, path, ref ?? defaultBranch);
        res.json({ owner, repo, ref: ref ?? defaultBranch, file });
    } catch (err) {
        next(err);
    }
});

/**
 * PUSH (now commits as <app-slug>[bot])
 *
 * Requires:
 * - user is authorized AND can access repo (user token check)
 * - app is installed on repo (installation lookup)
 * - app has Contents: Read & write permission
 */
app.post("/api/github/repo/:owner/:repo/push", async (req, res, next) => {
    try {
        const { owner, repo } = req.params;
        const { markdown, css, message } = req.body;

        if (typeof markdown !== "string" || typeof css !== "string") {
            res.status(400).json({ error: "markdown and css content are required" });
            return;
        }

        // Gate with USER token (prevents anonymous pushes)
        const userOctokit = await requireUserOctokit(req, res);
        await assertRepoAccessible(userOctokit, owner, repo);

        // Do the write with INSTALLATION token (bot identity)
        const botOctokit = await requireInstallationOctokit(owner, repo);

        // Get default branch (bot or user both work; use bot for consistency)
        const repoInfo = await botOctokit.rest.repos.get({ owner, repo });
        const defaultBranch = repoInfo.data.default_branch;
        const refName = `heads/${defaultBranch}`;

        // Get latest commit SHA
        const refData = await botOctokit.rest.git.getRef({ owner, repo, ref: refName });
        const latestCommitSha = refData.data.object.sha;

        // Get the tree SHA for that commit (createTree.base_tree expects a tree sha)
        const commitData = await botOctokit.rest.git.getCommit({
            owner,
            repo,
            commit_sha: latestCommitSha,
        });
        const baseTreeSha = commitData.data.tree.sha;

        // Create blobs
        const mdBlob = await botOctokit.rest.git.createBlob({
            owner,
            repo,
            content: Buffer.from(markdown, "utf8").toString("base64"),
            encoding: "base64",
        });

        const cssBlob = await botOctokit.rest.git.createBlob({
            owner,
            repo,
            content: Buffer.from(css, "utf8").toString("base64"),
            encoding: "base64",
        });

        // Detect existing filenames (or fall back)
        const { md: mdPath, css: cssPath } = await detectResumeFiles(botOctokit, owner, repo, defaultBranch);
        const targetMdPath = mdPath ?? "resume.md";
        const targetCssPath = cssPath ?? "style.css";

        // Create tree
        const tree = await botOctokit.rest.git.createTree({
            owner,
            repo,
            base_tree: baseTreeSha,
            tree: [
                { path: targetMdPath, mode: "100644", type: "blob", sha: mdBlob.data.sha },
                { path: targetCssPath, mode: "100644", type: "blob", sha: cssBlob.data.sha },
            ],
        });

        // Create a new commit
        const newCommit = await botOctokit.rest.git.createCommit({
            owner,
            repo,
            message: message || "Update resume via resumd web", // TODO: Make this "Update <filenames>"
            tree: tree.data.sha,
            parents: [latestCommitSha],
        });

        // Update the reference
        await botOctokit.rest.git.updateRef({
            owner,
            repo,
            ref: refName,
            sha: newCommit.data.sha,
        });

        res.json({
            ok: true,
            commit: newCommit.data.sha,
            updated: { markdown: targetMdPath, css: targetCssPath },
            actor: `${env.GITHUB_APP_SLUG}[bot]`,
        });
    } catch (err) {
        next(err);
    }
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err?.status ?? 500;
    const message = err?.message ?? "Internal error";
    res.status(status).json({ error: message });
});

app.listen(PORT, () => {
    console.log(`resumd backend listening on http://localhost:${PORT}`);
});
