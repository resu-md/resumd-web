import { createEffect, createMemo, createSignal, on, onCleanup, type Accessor } from "solid-js";

type SetterValue = string | ((prev: string) => string);

function resolveValue(next: SetterValue, prev: string) {
    return typeof next === "function" ? next(prev) : next;
}

// TODO: Check implementation
export function createKeyedLocalStorageSignal(options: { key: Accessor<string | null>; fallback: Accessor<string> }) {
    // undefined = "there is no local draft for the current key"
    const [localOverride, setLocalOverride] = createSignal<string | undefined>(undefined);

    const reload = () => {
        const key = options.key();

        if (!key) {
            setLocalOverride(undefined);
            return;
        }

        const stored = window.localStorage.getItem(key);
        setLocalOverride(stored ?? undefined);
    };

    // Re-read from localStorage whenever the draft key changes
    createEffect(on(options.key, reload, { defer: false }));

    // Value seen by consumers:
    // local draft if present, otherwise remote content
    const value = createMemo(() => localOverride() ?? options.fallback());

    const setValue = (next: SetterValue) => {
        const key = options.key();
        if (!key) return;

        const resolved = resolveValue(next, value());

        // update current tab immediately
        setLocalOverride(resolved);

        // persist for refresh and other tabs
        window.localStorage.setItem(key, resolved);
    };

    const clear = () => {
        const key = options.key();
        if (!key) return;

        window.localStorage.removeItem(key);
        setLocalOverride(undefined);
    };

    const onStorage = (event: StorageEvent) => {
        const key = options.key();
        if (!key) return;

        if (event.storageArea !== window.localStorage) return;
        if (event.key !== key) return;

        // another tab changed the same draft
        setLocalOverride(event.newValue ?? undefined);
    };

    window.addEventListener("storage", onStorage);
    onCleanup(() => window.removeEventListener("storage", onStorage));

    return [value, setValue, clear, reload] as const;
}
