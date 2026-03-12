import fm from "front-matter";

export type Metadata = {
    title?: string;
    lang?: string;
};

export type ParsedMarkdown = {
    body: string;
    metadata: Metadata;
    error?: boolean;
};

/**
 * Uses previous value if current parsing resulted in an error.
 */
export function resolveMarkdown(source: string, prev?: ParsedMarkdown): ParsedMarkdown {
    const next = parseMarkdownMetadata(source);
    if (next.error && prev) {
        return {
            ...next,
            metadata: prev.metadata,
        };
    }
    return next;
}

export function parseMarkdownMetadata(source: string): ParsedMarkdown {
    try {
        const parsed = fm<Record<string, unknown>>(source);
        const frontmatter = parsed.attributes || {};

        return {
            body: parsed.body ?? "",
            metadata: {
                title: coerceString(frontmatter.title),
                lang: coerceString(frontmatter.lang),
            },
        };
    } catch (e) {
        // console.warn("Failed to parse front-matter:", e);
        return {
            body: source,
            metadata: {},
            error: true,
        };
    }
}

function coerceString(value: unknown): string | undefined {
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length ? trimmed : undefined;
    }
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    return undefined;
}
