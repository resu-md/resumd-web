import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    base: "/resumd-web-solid/",
    plugins: [solid(), tailwindcss()],
});
