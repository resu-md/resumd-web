import { type JSXElement } from "solid-js";
import { Route, Router } from "@solidjs/router";
// Context
import { ThemeProvider } from "@/contexts/ThemeContext";
// Pages
import EditorPage from "@/pages/EditorPage";
import { DocumentProvider } from "./contexts/DocumentContext";

export default function App() {
    return (
        <Router base={import.meta.env.BASE_URL} root={ContextProviders}>
            <Route component={DocumentProvider}>
                <Route path="/" component={EditorPage} />
            </Route>
        </Router>
    );
}

function ContextProviders(props: { children?: JSXElement }) {
    return <ThemeProvider>{props.children}</ThemeProvider>;
}
