import { createSignal, createContext, useContext, onMount, type ParentComponent } from "solid-js";

type Theme = "light" | "dark";

interface ThemeContextType {
    theme: () => Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>();

export const ThemeProvider: ParentComponent = (props) => {
    const [theme, setTheme] = createSignal<Theme>("light");

    onMount(() => {
        // Check localStorage for saved preference
        const savedTheme = localStorage.getItem("theme") as Theme | null;

        if (savedTheme) {
            setTheme(savedTheme);
            applyTheme(savedTheme);
        } else {
            // Check system preference
            const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            const initialTheme = prefersDark ? "dark" : "light";
            setTheme(initialTheme);
            applyTheme(initialTheme);
        }
    });

    const applyTheme = (newTheme: Theme) => {
        const root = document.documentElement;
        if (newTheme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
    };

    const toggleTheme = () => {
        const newTheme = theme() === "light" ? "dark" : "light";
        setTheme(newTheme);
        applyTheme(newTheme);
        localStorage.setItem("theme", newTheme);
    };

    const value: ThemeContextType = {
        theme,
        toggleTheme,
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
