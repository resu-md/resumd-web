import { type JSXElement } from "solid-js";
import { Route, Router } from "@solidjs/router";
// Context
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ResumeProvider } from "./contexts/ResumeContext";
import { GithubAuthProvider } from "./contexts/github/GithubAuthContext";
import { GithubRepositoryProvider } from "./contexts/github/GithubRepositoryContext";
import { BrowserTabsProvider } from "./contexts/BrowserTabsContext";
// Pages
import EditorPage from "@/pages/EditorPage";
import AuthenticatedEditorPage from "./pages/AuthenticatedEditorPage";

export default function App() {
    const routerBase = import.meta.env.BASE_URL === "/" ? "/" : import.meta.env.BASE_URL.replace(/\/+$/, ""); // TODO: Check if needed

    return (
        <Router base={routerBase} root={ContextProviders}>
            <Route component={GithubAuthProvider}>
                <Route component={GithubRepositoryProvider}>
                    <Route component={BrowserTabsProvider}>
                        <Route component={ResumeProvider}>
                            <Route path="/" component={EditorPage} />
                            <Route path="/:owner/:repo" component={AuthenticatedEditorPage} />
                        </Route>
                    </Route>
                </Route>
            </Route>
        </Router>
    );
}

function ContextProviders(props: { children?: JSXElement }) {
    return <ThemeProvider>{props.children}</ThemeProvider>;
}
