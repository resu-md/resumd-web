import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { viteStaticCopy } from "vite-plugin-static-copy";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
    base: "/resumd-web/",
    plugins: [
        solid(),
        tailwindcss(),
        viteStaticCopy({
            targets: [
                {
                    src: "node_modules/pagedjs/dist/paged.js",
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
});
