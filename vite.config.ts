import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [solid(), tailwindcss()],
    optimizeDeps: {
        include: ["monaco-editor"],
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    monaco: ["monaco-editor"],
                },
            },
        },
    },
});
