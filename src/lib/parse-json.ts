export function parseJson<T>(value: string | null | undefined): T | null {
    if (value == null) return null;
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}
