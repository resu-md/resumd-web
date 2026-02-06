import { type JSXElement, Match, Switch } from "solid-js";
import { useSingleSessionGuard } from "@/components/editor/useSingleSessionGuard";

type SessionBlockedScreenProps = {
    onRetry: () => void;
};

type EditorSessionGateProps = {
    children?: JSXElement;
};

export default function EditorSessionGate(props: EditorSessionGateProps) {
    const { status, retry } = useSingleSessionGuard();

    return (
        <Switch>
            <Match when={status() === "active"}>{props.children}</Match>
            <Match when={status() === "blocked"}>
                <SessionBlockedScreen onRetry={retry} />
            </Match>
            <Match when={status() === "checking"}>
                <SessionCheckingScreen />
            </Match>
        </Switch>
    );
}

function SessionBlockedScreen(props: SessionBlockedScreenProps) {
    return (
        <main class="bg-system-secondary/60 dark:bg-system-secondary flex h-dvh w-dvw flex-col items-center justify-center gap-6 px-6 text-center">
            <div class="max-w-md space-y-2">
                <p class="text-xl font-semibold">Editor already open</p>
                <p class="text-system-foreground/80 text-sm">
                    Close the other ResuMD tab to keep your changes safe. Once it is closed, you can try again here.
                </p>
            </div>
            <button
                type="button"
                class="border-system-secondary/50 text-system-foreground hover:bg-system-primary focus-visible:ring-brand-primary w-fit rounded-full border px-6 py-2 text-sm font-medium transition"
                onClick={props.onRetry}
            >
                Try again
            </button>
        </main>
    );
}

function SessionCheckingScreen() {
    return (
        <main class="bg-system-secondary/60 dark:bg-system-secondary flex h-dvh w-dvw items-center justify-center px-6">
            <p class="text-system-foreground/70 text-sm tracking-wide">Preparing your editor…</p>
        </main>
    );
}
