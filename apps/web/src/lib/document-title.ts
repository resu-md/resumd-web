export const APP_TAB_NAME = "Resumd";

type TitlePart = string | null | undefined;

export function formatDocumentTitle(...parts: TitlePart[]) {
    const cleanParts = parts
        .map((part) => part?.trim())
        .filter((part): part is string => Boolean(part));

    if (cleanParts.length === 0) {
        return APP_TAB_NAME;
    }

    return `${cleanParts.join(" · ")} | ${APP_TAB_NAME}`;
}
