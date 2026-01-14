export async function exportAsZip(markdown: string, css: string, options?: { title?: string }) {
    const title = options?.title ?? "Resume";
    const filename = `${title}.zip`;

    // Dynamically import JSZip
    const JSZip = (await import("jszip")).default;

    const zip = new JSZip();

    // Add the markdown file
    zip.file("resume.md", markdown);

    // Add the CSS file
    zip.file("theme.css", css);

    // Generate the zip file
    const blob = await zip.generateAsync({ type: "blob" });

    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
