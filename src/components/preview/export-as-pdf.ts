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

    const printWindow = window.open(url, "_blank", "width=800,height=600");

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
