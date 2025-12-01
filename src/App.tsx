import { lazy, type JSXElement } from "solid-js";
import { Route, Router } from "@solidjs/router";
// Context
import { ThemeProvider } from "@/contexts/ThemeContext";
// Pages
import EditorPage from "@/pages/Editor.page";
const TemplatesPage = lazy(() => import("@/pages/Templates.page"));

export default function App() {
    return (
        <Router base={import.meta.env.BASE_URL} root={ContextProviders}>
            <Route path="/" component={EditorPage} />
            <Route path="/templates" component={TemplatesPage} />
        </Router>
    );
}

function ContextProviders(props: { children?: JSXElement }) {
    return <ThemeProvider>{props.children}</ThemeProvider>;
}
