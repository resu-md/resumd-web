// Templates
import harvardMarkdown from "@/templates/Harvard/resume.md?raw";
import harvardCss from "@/templates/Harvard/theme.css?raw";

import bobaTalksMarkdown from "@/templates/boba-talks/resume.md?raw";
import bobaTalksCss from "@/templates/boba-talks/theme.css?raw";

import jakesResumeMarkdown from "@/templates/jakes-resume/resume.md?raw";
import jakesResumeCss from "@/templates/jakes-resume/theme.css?raw";

import levelsFiyMarkdown from "@/templates/levels.fiy/resume.md?raw";
import levelsFiyCss from "@/templates/levels.fiy/theme.css?raw";

import referMeMarkdown from "@/templates/refer.me/resume.md?raw";
import referMeCss from "@/templates/refer.me/theme.css?raw";

export interface Template {
    id: string;
    name: string;
    markdown: string;
    css: string;
}

export const templates: Template[] = [
    {
        id: "harvard",
        name: "Harvard",
        markdown: harvardMarkdown,
        css: harvardCss,
    },
    {
        id: "boba-talks",
        name: "Boba Talks",
        markdown: bobaTalksMarkdown,
        css: bobaTalksCss,
    },
    {
        id: "jakes-resume",
        name: "Jake's Resume",
        markdown: jakesResumeMarkdown,
        css: jakesResumeCss,
    },
    {
        id: "levels-fiy",
        name: "Levels.fyi",
        markdown: levelsFiyMarkdown,
        css: levelsFiyCss,
    },
    {
        id: "refer-me",
        name: "Refer.me",
        markdown: referMeMarkdown,
        css: referMeCss,
    },
];
