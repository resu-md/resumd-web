import { Combobox, useComboboxContext } from "@kobalte/core/combobox";
import type { ComboboxRootProps, ComboboxInputProps } from "@kobalte/core/combobox";
import {
    createContext,
    createEffect,
    createMemo,
    createSignal,
    on,
    onCleanup,
    splitProps,
    useContext,
    type Accessor,
    type JSX,
    type ParentProps,
} from "solid-js";

/**
 * Whether SearchInput is always visible (classic combobox),
 * or hidden until the user types (select-like + type-to-search).
 */
export type SearchInputVisibility = "always" | "on-type";

type SearchableDropdownCtx = {
    visibility: Accessor<SearchInputVisibility>;
    isSearching: Accessor<boolean>;
    setIsSearching: (v: boolean) => void;

    /** Focuses the first *focusable item* in the current (filtered) collection. */
    focusFirstItem: () => void;

    /** If true, focusing the first item happens on open. */
    focusFirstOnOpen: Accessor<boolean>;

    /** If true, focusing the first item happens when search begins. */
    focusFirstOnSearchStart: Accessor<boolean>;
};

const SearchableDropdownContext = createContext<SearchableDropdownCtx>();

export function useSearchableDropdownContext() {
    const ctx = useContext(SearchableDropdownContext);
    if (!ctx) {
        throw new Error("[SearchableDropdown]: must be used within <SearchableDropdown.Root>.");
    }
    return ctx;
}

function isPrintableKey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    return e.key.length === 1;
}

const VISUALLY_HIDDEN: JSX.CSSProperties = {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: "0",
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    "white-space": "nowrap",
    border: "0",
};

type RootExtraProps = {
    /** Controls SearchInput visibility behavior. Default: "on-type". */
    searchInputVisibility?: SearchInputVisibility;

    /**
     * When the dropdown opens, focus the first option immediately.
     * Default: true.
     */
    focusFirstOnOpen?: boolean;

    /**
     * When search begins (first typed character in on-type mode), focus the first option.
     * Default: true.
     */
    focusFirstOnSearchStart?: boolean;

    /**
     * Loop keyboard navigation (ArrowDown from last -> first, ArrowUp from first -> last).
     * Default: true.
     */
    loop?: boolean;
};

export type SearchableDropdownRootProps<Option, OptGroup = never> = ParentProps<
    ComboboxRootProps<Option, OptGroup> & RootExtraProps
>;

/**
 * Root: wraps Kobalte <Combobox> and adds the “hidden until type” behavior + focus rules.
 */
function Root<Option, OptGroup = never>(props: SearchableDropdownRootProps<Option, OptGroup>) {
    const [local, comboboxProps] = splitProps(props, [
        "searchInputVisibility",
        "focusFirstOnOpen",
        "focusFirstOnSearchStart",
        "loop",
        "children",
    ]);

    const visibility = () => local.searchInputVisibility ?? "on-type";
    const focusFirstOnOpen = () => local.focusFirstOnOpen ?? true;
    const focusFirstOnSearchStart = () => local.focusFirstOnSearchStart ?? true;

    // Default to loop navigation.
    const shouldFocusWrap = () => local.loop ?? true;

    return (
        <Combobox {...(comboboxProps as any)} shouldFocusWrap={shouldFocusWrap()}>
            <InnerProvider
                visibility={visibility}
                focusFirstOnOpen={focusFirstOnOpen}
                focusFirstOnSearchStart={focusFirstOnSearchStart}
            >
                {local.children}
            </InnerProvider>
        </Combobox>
    );
}

function InnerProvider(props: {
    visibility: Accessor<SearchInputVisibility>;
    focusFirstOnOpen: Accessor<boolean>;
    focusFirstOnSearchStart: Accessor<boolean>;
    children: JSX.Element;
}) {
    const combobox = useComboboxContext();

    // In always-visible mode, searching is effectively always "on".
    const [isSearching, setIsSearching] = createSignal(props.visibility() === "always");

    const focusFirstItem = () => {
        const listState = combobox.listState();
        const collection = listState.collection();

        let key = collection.getFirstKey?.();
        while (key) {
            const node = collection.getItem(key) as any;
            if (node?.type === "item" && !node?.disabled) {
                listState.selectionManager().setFocused(true);
                listState.selectionManager().setFocusedKey(key);
                return;
            }
            key = collection.getKeyAfter?.(key);
        }
    };

    // Focus input + first item on open.
    createEffect(
        on(
            () => combobox.isOpen(),
            (open, prev) => {
                if (!open || prev) return;

                queueMicrotask(() => {
                    combobox.inputRef()?.focus();
                    if (props.focusFirstOnOpen()) focusFirstItem();
                });
            },
        ),
    );

    // When selection changes, stop “searching” in on-type mode (hide the SearchInput again).
    createEffect(
        on(
            () => combobox.listState().selectionManager().selectedKeys(),
            () => {
                if (props.visibility() === "on-type") setIsSearching(false);
            },
        ),
    );

    // Type-to-search from trigger: if trigger focused and user types, open + reveal input + seed value.
    createEffect(() => {
        const trigger = combobox.triggerRef();
        if (!trigger) return;

        const onKeyDownCapture = (e: KeyboardEvent) => {
            if (props.visibility() !== "on-type") return;

            if (isPrintableKey(e)) {
                e.preventDefault();
                setIsSearching(true);

                // open first
                combobox.open(false, "input");

                queueMicrotask(() => {
                    combobox.inputRef()?.focus();
                    // Kobalte currently exposes setInputValue on combobox context in practice;
                    // cast to any to keep compatibility across versions.
                    (combobox as any).setInputValue?.(e.key);

                    if (props.focusFirstOnSearchStart()) focusFirstItem();
                });
            } else if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                combobox.open(false, "manual");
                queueMicrotask(() => {
                    combobox.inputRef()?.focus();
                    if (props.focusFirstOnOpen()) focusFirstItem();
                });
            }
        };

        trigger.addEventListener("keydown", onKeyDownCapture, { capture: true });
        onCleanup(() => trigger.removeEventListener("keydown", onKeyDownCapture, { capture: true } as any));
    });

    // Start searching when input is focused but still hidden (on-type mode) and user types.
    createEffect(() => {
        const input = combobox.inputRef();
        if (!input) return;

        const onKeyDownCapture = (e: KeyboardEvent) => {
            if (props.visibility() !== "on-type") return;
            if (isSearching()) return;

            if (isPrintableKey(e)) {
                e.preventDefault();
                setIsSearching(true);

                (combobox as any).setInputValue?.(e.key);

                if (!combobox.isOpen()) combobox.open(false, "input");

                if (props.focusFirstOnSearchStart()) queueMicrotask(focusFirstItem);
            }
        };

        input.addEventListener("keydown", onKeyDownCapture, { capture: true });
        onCleanup(() => input.removeEventListener("keydown", onKeyDownCapture, { capture: true } as any));
    });

    const ctx: SearchableDropdownCtx = {
        visibility: props.visibility,
        isSearching,
        setIsSearching,
        focusFirstItem,
        focusFirstOnOpen: props.focusFirstOnOpen,
        focusFirstOnSearchStart: props.focusFirstOnSearchStart,
    };

    return <SearchableDropdownContext.Provider value={ctx}>{props.children}</SearchableDropdownContext.Provider>;
}

/**
 * SearchInput: renders Kobalte's Combobox.Input, but can be visually hidden until typing.
 */
type SearchInputExtraProps = {
    /** Optional override of visibility behavior at this input site. Defaults to Root’s setting. */
    visibility?: SearchInputVisibility;

    /**
     * Styles applied when `visibility="on-type"` and the user has NOT started searching yet.
     * Default: visually hidden (doesn't take space).
     */
    hiddenStyle?: JSX.CSSProperties;

    /**
     * Placeholder to use only when visible.
     * In on-type mode, placeholder is suppressed until searching starts.
     */
    placeholder?: string;
};

export type SearchableDropdownSearchInputProps = ComboboxInputProps &
    SearchInputExtraProps & {
        style?: JSX.CSSProperties | string;
    };

function SearchInput(props: SearchableDropdownSearchInputProps) {
    const ctx = useSearchableDropdownContext();
    const [local, others] = splitProps(props, ["visibility", "hiddenStyle", "placeholder", "style"]);

    const effectiveVisibility = () => local.visibility ?? ctx.visibility();
    const hidden = () => effectiveVisibility() === "on-type" && !ctx.isSearching();

    const style = createMemo<JSX.CSSProperties | string | undefined>(() => {
        const base = local.style;

        if (!hidden()) return base;

        const hiddenObj: JSX.CSSProperties = {
            ...VISUALLY_HIDDEN,
            ...(local.hiddenStyle ?? {}),
        };

        // If base is a string, don't try to merge; enforce hidden.
        if (typeof base === "string") return hiddenObj;

        // If base is an object, merge but ensure hidden wins.
        if (typeof base === "object" && base) return { ...base, ...hiddenObj };

        return hiddenObj;
    });

    return (
        <Combobox.Input
            {...(others as any)}
            style={style()}
            placeholder={hidden() ? "" : local.placeholder}
            data-search-input=""
            data-searching={ctx.isSearching() ? "" : undefined}
        />
    );
}

/**
 * Re-export the Kobalte pieces, plus our Root/SearchInput.
 */
export const SearchableDropdown = Object.assign(Root, {
    // Our additions
    Root,
    SearchInput,
    useContext: useSearchableDropdownContext,

    // Pass-through Kobalte parts (unstyled primitives)
    Label: Combobox.Label,
    Description: Combobox.Description,
    ErrorMessage: Combobox.ErrorMessage,
    Control: Combobox.Control,
    Trigger: Combobox.Trigger,
    Icon: Combobox.Icon,
    Portal: Combobox.Portal,
    Content: Combobox.Content,
    Arrow: Combobox.Arrow,
    Listbox: Combobox.Listbox,
    Section: Combobox.Section,
    Item: Combobox.Item,
    ItemLabel: Combobox.ItemLabel,
    ItemDescription: Combobox.ItemDescription,
    ItemIndicator: Combobox.ItemIndicator,
    HiddenSelect: Combobox.HiddenSelect,
});
