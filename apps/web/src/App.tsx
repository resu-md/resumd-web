import { type JSXElement } from "solid-js";
import { Route, Router } from "@solidjs/router";
import { Meta, MetaProvider, Title } from "@solidjs/meta";
// Context
import queryClient from "./lib/query-client";
import { QueryClientProvider } from "@tanstack/solid-query";
import { ThemeProvider } from "@/contexts/ThemeContext";
// Pages
import AuthenticatedEditorPage from "./pages/AuthenticatedEditorPage";
import ManageRepositoriesPage from "./pages/ManageRepositoriesPage";
import AnonymousEditorPage from "./pages/AnonymousEditorPage";
import { GithubProvider } from "./contexts/github/GithubContext";

export default function App() {
    const routerBase = import.meta.env.BASE_URL === "/" ? "/" : import.meta.env.BASE_URL.replace(/\/+$/, ""); // TODO: Check if needed

    return (
        <MetaProvider>
            <Title>Resumd</Title>
            <Meta
                name="description"
                content="Markdown-based resume editor. Create resumes with Markdown, styled with CSS, and manage their versions in Github."
            />

            <Router base={routerBase} root={ContextProviders}>
                <Route component={GithubProvider}>
                    <Route path="/" component={AnonymousEditorPage} />
                    <Route path="/manage" component={ManageRepositoriesPage} />
                    <Route path="/:owner/:repo" component={AuthenticatedEditorPage} />
                </Route>
            </Router>
        </MetaProvider>
    );
}

function ContextProviders(props: { children?: JSXElement }) {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>{props.children}</ThemeProvider>
        </QueryClientProvider>
    );
}
