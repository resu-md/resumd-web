// src/lib/api/http.ts
export class ApiError extends Error {
    status: number;
    data?: unknown;

    constructor(status: number, message: string, data?: unknown) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.data = data;
    }
}

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
    const res = await fetch(input, {
        credentials: "include",
        headers: {
            Accept: "application/json",
            ...(init?.body ? { "Content-Type": "application/json" } : {}),
            ...(init?.headers ?? {}),
        },
        ...init,
    });

    if (res.status === 401) {
        throw new ApiError(401, "Unauthorized");
    }

    if (!res.ok) {
        const text = await res.text();
        let data: unknown = undefined;

        try {
            data = text ? JSON.parse(text) : undefined;
        } catch {
            data = text || undefined;
        }

        const message =
            typeof data === "object" && data !== null && "error" in data && typeof (data as any).error === "string"
                ? (data as any).error
                : res.statusText || "Request failed";

        throw new ApiError(res.status, message, data);
    }

    if (res.status === 204) {
        return undefined as T;
    }

    return (await res.json()) as T;
}

export function withSearch(path: string, params: Record<string, string | undefined>) {
    const search = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
        if (value) search.set(key, value);
    }

    const qs = search.toString();
    return qs ? `${path}?${qs}` : path;
}
