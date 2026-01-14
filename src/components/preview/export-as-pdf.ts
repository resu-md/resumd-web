import printTemplate from "./pdf-print-template.html?raw";

export function exportAsPdf(html: string, css: string, options?: { lang?: string; title?: string }) {
    const lang = sanitizeLang(options?.lang) ?? "";
    const title = options?.title ?? "Resume";

    const htmlContent = printTemplate
        .replace("{{LANG}}", escapeHtml(lang))
        .replace("<!--{{TITLE}}-->", escapeHtml(title))
        .replace("/*{{CSS}}*/", css)
        .replace("<!--{{BODY}}-->", html);

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    // Calculate popup size based on screen and A4 dimensions
    const a4WidthPx = 794; // A4 width at 96 DPI
    const a4HeightPx = 1123; // A4 height at 96 DPI
    const popupWidth = Math.min(Math.floor(screen.availWidth * 0.9), a4WidthPx);
    const popupHeight = Math.min(Math.floor(screen.availHeight * 0.7), a4HeightPx);
    const left = Math.floor((screen.availWidth - popupWidth) / 2);
    const top = Math.floor((screen.availHeight - popupHeight) / 2);

    const printWindow = window.open(url, "_blank", `width=${popupWidth},height=${popupHeight},left=${left},top=${top}`);

    if (!printWindow) {
        alert("Please allow popups to export as PDF");
        URL.revokeObjectURL(url);
        return;
    }

    printWindow.addEventListener("load", () => {
        URL.revokeObjectURL(url);
    });
}

function sanitizeLang(value: string | undefined) {
    if (!value) return undefined;
    const sanitized = value.toLowerCase();
    const isValid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(sanitized);
    return isValid ? sanitized : undefined;
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
