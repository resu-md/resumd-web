/* @refresh reload */
import { render } from "solid-js/web";
import "./index.css";
import App from "./App.tsx";
import { restorePersistedQueryClient } from "./lib/query-client";

const root = document.getElementById("root");

async function start() {
    try {
        await restorePersistedQueryClient();
    } catch (error) {
        console.warn("Failed to restore persisted query cache:", error);
    }

    render(() => <App />, root!);
}

void start();
