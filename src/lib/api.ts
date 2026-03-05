export async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${path}`, {
        ...init,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers || {}),
        },
    });

    if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
            const data = await res.json();
            message = data.error || message;
        } catch {}
        throw new Error(message);
    }

    return res.json();
}
