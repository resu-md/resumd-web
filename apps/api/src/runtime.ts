import { App as GitHubApp } from "@octokit/app";
import { OAuthApp } from "@octokit/oauth-app";
import { Octokit } from "@octokit/rest";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import { z } from "zod";

const EnvSchema = z.object({
    APP_ORIGIN: z.string().url(),
    BACKEND_ORIGIN: z.string().url().optional(),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    GITHUB_APP_SLUG: z.string().min(1),
    GITHUB_APP_ID: z.string().regex(/^\d+$/, "GITHUB_APP_ID must be numeric"),
    GITHUB_PRIVATE_KEY: z.string().min(1),
    COOKIE_SECRET: z.string().min(32),
    NODE_ENV: z.string().optional(),
});

export type RuntimeEnv = z.infer<typeof EnvSchema>;

export type RuntimeBindings = Partial<Record<keyof RuntimeEnv, string>>;

export type ApiVariables = {
    requestId: string;
};

export type ApiContext = Context<{ Bindings: RuntimeBindings; Variables: ApiVariables }>;

export type AuthCookie = {
    token: string;
    refreshToken?: string;
    expiresAt?: string;
    refreshTokenExpiresAt?: string;
    tokenType?: string;
    scopes?: string[];
};

export type AuthFlowContextCookie = {
    returnTo: string;
};

export type CookieState = {
    state: string;
};

export type RuntimeServices = {
    env: RuntimeEnv;
    backendOrigin: string;
    oauthApp: OAuthApp<any>;
    ghApp: GitHubApp;
    githubInstallationUrl: string;
    isProd: boolean;
};

export const COOKIE_AUTH = "resumd_gh_auth";
export const COOKIE_CTX = "resumd_gh_ctx";
export const COOKIE_STATE = "resumd_gh_state";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const runtimeCache = new Map<string, RuntimeServices>();
const cookieKeyCache = new Map<string, Promise<CryptoKey>>();

export class ApiError extends Error {
    readonly status: number;
    readonly hint?: string;

    constructor(status: number, message: string, hint?: string) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.hint = hint;
    }
}

function getNodeEnv(): Record<string, string | undefined> {
    const maybeProcess = globalThis as typeof globalThis & {
        process?: {
            env?: Record<string, string | undefined>;
        };
    };
    return maybeProcess.process?.env ?? {};
}

export function resolveRuntimeEnv(bindings: RuntimeBindings): RuntimeEnv {
    const nodeEnv = getNodeEnv();

    return EnvSchema.parse({
        APP_ORIGIN: bindings.APP_ORIGIN ?? nodeEnv.APP_ORIGIN,
        BACKEND_ORIGIN: bindings.BACKEND_ORIGIN ?? nodeEnv.BACKEND_ORIGIN,
        GITHUB_CLIENT_ID: bindings.GITHUB_CLIENT_ID ?? nodeEnv.GITHUB_CLIENT_ID,
        GITHUB_CLIENT_SECRET: bindings.GITHUB_CLIENT_SECRET ?? nodeEnv.GITHUB_CLIENT_SECRET,
        GITHUB_APP_SLUG: bindings.GITHUB_APP_SLUG ?? nodeEnv.GITHUB_APP_SLUG,
        GITHUB_APP_ID: bindings.GITHUB_APP_ID ?? nodeEnv.GITHUB_APP_ID,
        GITHUB_PRIVATE_KEY: bindings.GITHUB_PRIVATE_KEY ?? nodeEnv.GITHUB_PRIVATE_KEY,
        COOKIE_SECRET: bindings.COOKIE_SECRET ?? nodeEnv.COOKIE_SECRET,
        NODE_ENV: bindings.NODE_ENV ?? nodeEnv.NODE_ENV,
    });
}

function readEnv(c: ApiContext): RuntimeEnv {
    return resolveRuntimeEnv(c.env);
}

export function getRuntime(c: ApiContext): RuntimeServices {
    const env = readEnv(c);
    const backendOrigin = env.BACKEND_ORIGIN ?? new URL(c.req.url).origin;
    const cacheKey = [
        env.APP_ORIGIN,
        backendOrigin,
        env.GITHUB_CLIENT_ID,
        env.GITHUB_CLIENT_SECRET,
        env.GITHUB_APP_ID,
        env.GITHUB_APP_SLUG,
        env.GITHUB_PRIVATE_KEY,
        env.COOKIE_SECRET,
        env.NODE_ENV,
    ].join("|");

    const cached = runtimeCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const oauthApp = new OAuthApp({
        clientType: "github-app",
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        redirectUrl: `${backendOrigin}/api/auth/callback`,
    });

    const ghApp = new GitHubApp({
        appId: Number(env.GITHUB_APP_ID),
        privateKey: env.GITHUB_PRIVATE_KEY.replace(/\\n/g, "\n"),
        Octokit,
    });

    const runtime: RuntimeServices = {
        env,
        backendOrigin,
        oauthApp,
        ghApp,
        githubInstallationUrl: `https://github.com/apps/${encodeURIComponent(env.GITHUB_APP_SLUG)}/installations/new`,
        isProd: env.NODE_ENV === "production",
    };

    runtimeCache.set(cacheKey, runtime);
    return runtime;
}

function bytesToBase64(bytes: Uint8Array): string {
    const bufferGlobal = globalThis as typeof globalThis & {
        Buffer?: {
            from: (input: ArrayBuffer | Uint8Array | string, encoding?: string) => {
                toString: (encoding?: string) => string;
            };
        };
    };

    if (bufferGlobal.Buffer) {
        return bufferGlobal.Buffer.from(bytes).toString("base64");
    }

    let binary = "";
    for (let index = 0; index < bytes.length; index += 1) {
        binary += String.fromCharCode(bytes[index]);
    }

    return btoa(binary);
}

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

function base64UrlFromBytes(bytes: Uint8Array): string {
    return bytesToBase64(bytes)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return base64ToBytes(padded);
}

async function getCookieKey(secret: string): Promise<CryptoKey> {
    const cached = cookieKeyCache.get(secret);
    if (cached) {
        return cached;
    }

    const keyPromise = (async () => {
        const hash = await crypto.subtle.digest("SHA-256", textEncoder.encode(secret));
        return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    })();

    cookieKeyCache.set(secret, keyPromise);
    return keyPromise;
}

async function sealCookieValue(secret: string, value: unknown): Promise<string> {
    const key = await getCookieKey(secret);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = textEncoder.encode(JSON.stringify(value));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

    return `${base64UrlFromBytes(iv)}.${base64UrlFromBytes(new Uint8Array(encrypted))}`;
}

async function unsealCookieValue<T>(secret: string, token: string): Promise<T | null> {
    try {
        const [ivPart, payloadPart] = token.split(".");
        if (!ivPart || !payloadPart) {
            return null;
        }

        const key = await getCookieKey(secret);
        const iv = base64UrlToBytes(ivPart);
        const payload = base64UrlToBytes(payloadPart);
        const ivBuffer = new Uint8Array(iv.byteLength);
        ivBuffer.set(iv);
        const payloadBuffer = new Uint8Array(payload.byteLength);
        payloadBuffer.set(payload);

        const plaintext = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: ivBuffer,
            },
            key,
            payloadBuffer,
        );

        return JSON.parse(textDecoder.decode(new Uint8Array(plaintext))) as T;
    } catch {
        return null;
    }
}

function resolveCookieOptions(runtime: RuntimeServices): { secure: boolean; sameSite: "Lax" | "None" } {
    const appOrigin = new URL(runtime.env.APP_ORIGIN);
    const backendOrigin = new URL(runtime.backendOrigin);
    const isHttps = appOrigin.protocol === "https:" && backendOrigin.protocol === "https:";

    if (!isHttps) {
        return { secure: false, sameSite: "Lax" };
    }

    const isSameOrigin = appOrigin.origin === backendOrigin.origin;
    return {
        secure: true,
        sameSite: isSameOrigin ? "Lax" : "None",
    };
}

export async function setSealedCookie(
    c: ApiContext,
    runtime: RuntimeServices,
    name: string,
    value: unknown,
    maxAgeSeconds?: number,
): Promise<void> {
    const sealed = await sealCookieValue(runtime.env.COOKIE_SECRET, value);
    const { secure, sameSite } = resolveCookieOptions(runtime);
    const requestId = c.get("requestId") ?? "unknown";
    console.log(
        JSON.stringify({
            event: "cookie_set",
            requestId,
            cookie: name,
            secure,
            sameSite,
            maxAgeSeconds: maxAgeSeconds ?? null,
            appOrigin: runtime.env.APP_ORIGIN,
            backendOrigin: runtime.backendOrigin,
        }),
    );
    setCookie(c, name, sealed, {
        path: "/",
        httpOnly: true,
        secure,
        sameSite,
        maxAge: maxAgeSeconds,
    });
}

export async function readSealedCookie<T>(
    c: ApiContext,
    runtime: RuntimeServices,
    name: string,
): Promise<T | null> {
    const raw = getCookie(c, name);
    if (!raw) {
        return null;
    }

    return unsealCookieValue<T>(runtime.env.COOKIE_SECRET, raw);
}

export function clearCookie(c: ApiContext, name: string): void {
    deleteCookie(c, name, { path: "/" });
}

export function safeReturnTo(value: string | undefined, fallback: string): string {
    if (!value) {
        return fallback;
    }

    if (!value.startsWith("/") || value.startsWith("//")) {
        return fallback;
    }

    return value;
}

export function randomState(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    return base64UrlFromBytes(bytes);
}

export function statusOf(error: unknown): number | null {
    if (typeof error !== "object" || !error) {
        return null;
    }

    if ("status" in error && typeof (error as { status?: unknown }).status === "number") {
        return (error as { status: number }).status;
    }

    return null;
}

export function ensureBranchName(branch: string, fieldName: string): string {
    const normalized = branch.trim();

    if (
        !normalized ||
        normalized.length > 255 ||
        normalized.startsWith("/") ||
        normalized.endsWith("/") ||
        normalized.includes("..") ||
        normalized.includes(" ") ||
        normalized.includes("~") ||
        normalized.includes("^") ||
        normalized.includes(":") ||
        normalized.includes("?") ||
        normalized.includes("*") ||
        normalized.includes("[") ||
        normalized.includes("\\") ||
        normalized.includes("@{") ||
        normalized.endsWith(".")
    ) {
        throw new ApiError(400, `${fieldName} is not a valid branch name`);
    }

    return normalized;
}
