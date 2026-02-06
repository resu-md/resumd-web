import { type JSXElement } from "solid-js";
import { Route, Router } from "@solidjs/router";
// Context
import { ThemeProvider } from "@/contexts/ThemeContext";
import { GithubAuthProvider } from "@/contexts/GithubAuthContext";
// Pages
import EditorPage from "@/pages/EditorPage";

export default function App() {
    return (
        <Router base={import.meta.env.BASE_URL} root={ContextProviders}>
            <Route path="/" component={EditorPage} />
            <Route path="/:owner/:repo" component={EditorPage} />
        </Router>
    );
}

function ContextProviders(props: { children?: JSXElement }) {
    return (
        <GithubAuthProvider>
            <ThemeProvider>{props.children}</ThemeProvider>
        </GithubAuthProvider>
    );
}
