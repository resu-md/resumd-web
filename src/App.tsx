import { type JSXElement } from "solid-js";
import { Route, Router } from "@solidjs/router";
// Context
import { ThemeProvider } from "@/contexts/ThemeContext";
import { GithubAuthProvider } from "./contexts/github/GithubAuthContext";
import { GithubRepositoryProvider } from "./contexts/github/GithubRepositoryContext";
// Pages
import RootPage from "@/pages/RootPage";
import AuthenticatedEditorPage from "./pages/AuthenticatedEditorPage";

export default function App() {
    const routerBase = import.meta.env.BASE_URL === "/" ? "/" : import.meta.env.BASE_URL.replace(/\/+$/, ""); // TODO: Check if needed

    return (
        <Router base={routerBase} root={ContextProviders}>
            <Route component={GithubAuthProvider}>
                <Route component={GithubRepositoryProvider}>
                    <Route path="/" component={RootPage} />
                    <Route path="/:owner/:repo" component={AuthenticatedEditorPage} />
                </Route>
            </Route>
        </Router>
    );
}

function ContextProviders(props: { children?: JSXElement }) {
    return <ThemeProvider>{props.children}</ThemeProvider>;
}
