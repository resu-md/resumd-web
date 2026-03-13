import { defineConfig, normalizePath } from "vite";
import solid from "vite-plugin-solid";
import { viteStaticCopy } from "vite-plugin-static-copy";
import tailwindcss from "@tailwindcss/vite";
import { dirname, resolve } from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pagedJsPath = normalizePath(resolve(dirname(require.resolve("pagedjs")), "../dist/paged.js"));

export default defineConfig({
    base: "/",
    plugins: [
        solid(),
        tailwindcss(),
        viteStaticCopy({
            targets: [
                {
                    src: pagedJsPath,
                    dest: "vendor/pagedjs",
                },
            ],
        }),
    ],
    resolve: {
        alias: {
            "@": resolve(__dirname, "./src"),
        },
    },
    server: {
        proxy: {
            "/api": {
                target: "http://localhost:8787",
                changeOrigin: true,
            },
        },
    },
});
