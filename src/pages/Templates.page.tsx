import { For } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { marked } from "marked";
// Data
import { templates, type Template } from "@/data/templates";
// Components
import PreviewPages from "@/components/preview/PreviewPages";

export default function TemplatesPage() {
    const navigate = useNavigate();

    function handleUseTemplate(template: Template) {
        // Save to local storage
        localStorage.setItem("resumd.markdown", JSON.stringify(template.markdown));
        localStorage.setItem("resumd.css", JSON.stringify(template.css));

        // Navigate to editor
        navigate("/");
    }

    return (
        <main class="bg-system-grouped-secondary h-dvh w-dvw overflow-y-auto p-8">
            <div class="mx-auto max-w-6xl">
                <header class="mb-8 text-center">
                    <h1 class="text-3xl font-bold text-label-primary mb-2">Choose a Template</h1>
                    <p class="text-label-secondary">Select a template to start building your resume.</p>
                </header>

                <div class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                    <For each={templates}>
                        {(template) => (
                            <div class="bg-system-secondary shadow-primary flex flex-col overflow-hidden rounded-xl transition-transform hover:scale-[1.02]">
                                <div class="relative aspect-[1/1.414] w-full overflow-hidden bg-white">
                                    <div class="absolute inset-0 origin-top-left scale-[0.25] h-[400%] w-[400%]">
                                        <PreviewPages
                                            html={marked.parse(template.markdown, { async: false, breaks: true }) as string}
                                            css={template.css}
                                        />
                                    </div>
                                    {/* Overlay to prevent interaction with the preview */}
                                    <div class="absolute inset-0 z-10" />
                                </div>

                                <div class="flex flex-col gap-4 p-4">
                                    <h3 class="text-xl font-semibold text-label-primary">{template.name}</h3>
                                    <button
                                        onClick={() => handleUseTemplate(template)}
                                        class="bg-blue hover:bg-blue-dark active:bg-blue-darker w-full rounded-lg py-2 font-medium text-white transition-colors"
                                    >
                                        Use Template
                                    </button>
                                </div>
                            </div>
                        )}
                    </For>
                </div>
            </div>
        </main>
    );
}
