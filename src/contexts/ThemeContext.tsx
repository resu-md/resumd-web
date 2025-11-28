import { createSignal, createContext, useContext, onMount, onCleanup, type ParentComponent } from "solid-js";

type Theme = "light" | "dark";

interface ThemeContextType {
    theme: () => Theme;
}

const ThemeContext = createContext<ThemeContextType>();

const PREFERS_DARK_QUERY = "(prefers-color-scheme: dark)";

export const ThemeProvider: ParentComponent = (props) => {
    const [theme, setTheme] = createSignal<Theme>("light");

    onMount(() => {
        if (typeof window === "undefined") {
            return;
        }

        const mediaQuery = window.matchMedia(PREFERS_DARK_QUERY);

        const syncTheme = (isDark: boolean) => {
            setTheme(isDark ? "dark" : "light");
        };

        // Initialize with the current preference
        syncTheme(mediaQuery.matches);

        const handleChange = (event: MediaQueryListEvent) => {
            syncTheme(event.matches);
        };

        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", handleChange);
        } else {
            mediaQuery.addListener(handleChange);
        }

        onCleanup(() => {
            if (typeof mediaQuery.removeEventListener === "function") {
                mediaQuery.removeEventListener("change", handleChange);
            } else {
                mediaQuery.removeListener(handleChange);
            }
        });
    });

    const value: ThemeContextType = {
        theme,
    };

    return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>;
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
};
