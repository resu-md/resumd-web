export function exportAsPdf(html: string, css: string) {
    const htmlContent = `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <title>Export PDF</title>
                <style>
                    @page { margin: 0.4in; size: A4 portrait; }
                    body { margin: 0; padding: 0; }
                    ${css}
                </style>
            </head>
            <body>
                ${html}
                <script>
                    window.addEventListener('load', function() {
                        window.print();
                    });
                </script>
            </body>
        </html>
    `;

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
