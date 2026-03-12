import { createComputed, createSignal, on, onCleanup, onMount, untrack, type Accessor } from "solid-js";
import { isDev, isServer } from "solid-js/web";

type MaybeKey = string | null | undefined;

/**
 * Creates a draftable signal whose persisted value is stored in `localStorage` under a reactive key.
 *
 * Behavior:
 * - The signal is initialized from `localStorage` for the current `key()`.
 * - If there is no stored value for the current key, or the stored value cannot be read / parsed, the signal falls
 *   back to `fallback()`.
 * - When `key()` changes:
 *   - if the new key is a non-empty string, the signal reloads from `localStorage` for that key, or falls back to
 *     `fallback()` if nothing valid is stored there.
 *   - if the new key is `""`, `null`, or `undefined`, persistence is treated as disabled for the current state, and
 *     the signal is reset to `fallback()`.
 * - When `fallback()` changes:
 *   - if the current key is missing / disabled, the signal updates to the new fallback immediately.
 *   - if the current key has no valid stored value, the signal updates to the new fallback.
 *   - if the current key has a valid stored value, the stored value continues to win over the fallback.
 * - Calling the setter updates the in-memory signal immediately.
 *   - if the current key is valid, the new value is also serialized and written to `localStorage`.
 *   - if the current key is missing / disabled, the value is only kept in memory and is not persisted.
 * - Calling `clearDraft()` resets the signal to `fallback()`.
 *   - if the current key is valid, its `localStorage` entry is removed.
 *   - if the current key is missing / disabled, only the in-memory signal is reset.
 * - Cross-tab synchronization is enabled through the browser `storage` event for the current key only. Changes made
 *   in other tabs for the same key will update the signal. Same-tab writes made outside this primitive are not
 *   observed automatically.
 *
 * Important notes:
 * - `""`, `null`, and `undefined` are all treated as "no active persistence key".
 * - Switching from a valid key to no key does not delete the old stored entry; it only stops using it.
 * - Serialization defaults to `JSON.stringify` / `JSON.parse`, so `T` should be compatible with JSON unless custom
 *   `serialize` / `deserialize` functions are provided.
 * - Storage access is best-effort: if reading, parsing, serializing, or writing fails, the signal still remains usable
 *   in memory.
 */
export function createDraftablePersistedSignal<T>(options: {
    key: Accessor<MaybeKey>;
    fallback: Accessor<T>;
    serialize?: (value: T) => string;
    deserialize?: (raw: string) => T;
}): [Accessor<T>, (value: T | ((prev: T) => T)) => void, () => void] {
    const serialize = options.serialize ?? JSON.stringify;
    const deserialize = options.deserialize ?? (JSON.parse as (raw: string) => T);

    const currentKey = () => {
        const key = options.key();
        return key ? key : undefined;
    };

    function readStored(key: string): T | undefined {
        try {
            const raw = window.localStorage.getItem(key);
            if (raw == null) return undefined;
            return deserialize(raw);
        } catch {
            if (isDev) console.warn("Failed to read or parse localStorage for key:", key);
            return undefined;
        }
    }

    const [value, setValue] = createSignal<T>(
        untrack(() => {
            if (isServer) return options.fallback();
            const key = currentKey();
            return key ? (readStored(key) ?? options.fallback()) : options.fallback();
        }),
    );

    if (!isServer) {
        createComputed(
            on([currentKey, options.fallback], ([key, fallback], prev) => {
                if (!key) {
                    setValue(() => fallback);
                    return;
                }

                const stored = readStored(key);

                if (!prev || prev[0] !== key || stored === undefined) {
                    setValue(() => stored ?? fallback);
                }
            }),
        );

        onMount(() => {
            const onStorage = (event: StorageEvent) => {
                const key = currentKey();
                if (!key) return;
                if (event.storageArea !== window.localStorage) return;
                if (event.key !== key && event.key !== null) return;

                const stored = readStored(key);
                setValue(() => stored ?? options.fallback());
            };

            window.addEventListener("storage", onStorage);
            onCleanup(() => window.removeEventListener("storage", onStorage));
        });
    }

    const setDraft = (next: T | ((prev: T) => T)) => {
        setValue((prev) => {
            const newValue = typeof next === "function" ? (next as (prev: T) => T)(prev) : next;

            const key = currentKey();
            if (!key || isServer) return newValue;

            try {
                window.localStorage.setItem(key, serialize(newValue));
            } catch {
                if (isDev) console.warn("Failed to serialize or save localStorage for key:", key);
            }

            return newValue;
        });
    };

    const clearDraft = () => {
        const fallback = options.fallback();
        const key = currentKey();

        if (key && !isServer) {
            try {
                window.localStorage.removeItem(key);
            } catch {
                if (isDev) console.warn("Failed to remove localStorage item for key:", key);
            }
        }

        setValue(() => fallback);
    };

    return [value, setDraft, clearDraft];
}
