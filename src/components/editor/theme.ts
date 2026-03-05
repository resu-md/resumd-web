import monaco from "./monaco-config";
import xcodeDarkTheme from "./themes/Xcode Default Dark.json";
import xcodeLightTheme from "./themes/Xcode Classic Light.json";

type VsCodeTheme = {
    colors?: Record<string, string>;
    tokenColors?: Array<{
        scope?: string | string[];
        settings?: {
            foreground?: string;
            fontStyle?: string;
        };
    }>;
};

export const THEME_DARK_ID = "xcode-dark";
export const THEME_LIGHT_ID = "xcode-light";

const TOKEN_SCOPE_RULES: Array<{ pattern: RegExp; token: string }> = [
    { pattern: /comment/i, token: "comment" },
    { pattern: /string/i, token: "string" },
    { pattern: /keyword|storage/i, token: "keyword" },
    { pattern: /constant\.numeric|number/i, token: "number" },
    { pattern: /constant\.language|constant/i, token: "constant" },
    { pattern: /entity\.name\.function|meta\.function|support\.function/i, token: "function" },
    { pattern: /entity\.name\.type|support\.type|meta\.class|entity\.name\.class/i, token: "type" },
    { pattern: /variable\.parameter|parameter/i, token: "parameter" },
    { pattern: /variable/i, token: "variable" },
    { pattern: /entity\.name\.tag|tag/i, token: "tag" },
    { pattern: /attribute-name|attribute/i, token: "attribute" },
    { pattern: /operator|punctuation/i, token: "operator" },
];

let themesRegistered = false;

function normalizeColor(color?: string) {
    if (!color) return undefined;
    return color.startsWith("#") ? color.slice(1) : color;
}

function toMonacoTheme(vsCodeTheme: VsCodeTheme, base: monaco.editor.BuiltinTheme): monaco.editor.IStandaloneThemeData {
    const rules: monaco.editor.ITokenThemeRule[] = [];

    vsCodeTheme.tokenColors?.forEach((tokenColor) => {
        const scopes = tokenColor.scope
            ? Array.isArray(tokenColor.scope)
                ? tokenColor.scope
                : [tokenColor.scope]
            : [];
        const settings = tokenColor.settings ?? {};
        const foreground = normalizeColor(settings.foreground);
        const fontStyle = settings.fontStyle?.trim();

        scopes.forEach((scope) => {
            const match = TOKEN_SCOPE_RULES.find((rule) => rule.pattern.test(scope));
            if (!match || (!foreground && !fontStyle)) return;

            rules.push({
                token: match.token,
                foreground,
                fontStyle: fontStyle || undefined,
            });
        });
    });

    return {
        base,
        inherit: true,
        rules,
        colors: vsCodeTheme.colors ?? {},
    };
}

export function ensureThemesRegistered() {
    if (themesRegistered) return;

    monaco.editor.defineTheme(THEME_DARK_ID, toMonacoTheme(xcodeDarkTheme as VsCodeTheme, "vs-dark"));
    monaco.editor.defineTheme(THEME_LIGHT_ID, toMonacoTheme(xcodeLightTheme as VsCodeTheme, "vs"));
    themesRegistered = true;
}
