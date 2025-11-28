interface Template {
    markdown: string;
    css: string;
}

export const DEFAULT_TEMPLATE: Template = {
    markdown: `# Welcome to resu.md!
`,
    css: `body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    font-size: 14px;
    color: black;
}
`,
};

export const TEMPLATE_1: Template = {
    markdown: `<!--
Welcome to resume.lol !

This is the template you can use to get started.

More documentation can be found in the docs section
>>> https://resume.lol/docs
-->
@REDACTED=false
@NAME=My Name||Hidden Name
@EMAIL=realemail@gmail.com||fake@email.com
@PHONE=(123) 123-REAL||(555) 123-5555
@LOCATION=Los Angeles, CA
@WEBSITE=mysite.com||example.com

# {NAME}

<div class="section headerInfo">

- {EMAIL}
- {PHONE}
- [{WEBSITE}](https://{WEBSITE})
- {LOCATION}

</div>

## Experience

### Software Engineer, TikTok <span class="spacer"></span> Jul 2021 &mdash; Present

You can include a blurb here explaining a bit about what you worked on

- Built out some feature on the For You Page
- Worked on a feature related to User Profiles
- Launched a feature that grew to 50M users in the first week
- Mentored peer engineers on front-end development and best practices

Technologies: React, Preact, Javascript, TypeScript, styled-components, Storybook, CSS, Sass, Jest

### Software Engineer, Spotify <span class="spacer"></span> Feb 2019 &mdash; Jun 2021

- Worked on the front-end experience for the Year-In-Review feature
- Implemented a backend API for Playlist Radio
- Built the ML model for Discover Weekly playlists

Technologies: React, NextJS, Javascript, styled-components, Golang, Docker, AWS, Chrome Extensions

### Software Engineer, Airbnb <span class="spacer"></span> Sept 2018 &mdash; Feb 2019

- Worked on a feature on the Hosts dashboard

<!-- Older resume bits can be commented out so that you can keep the info without deleting it -->

<!-- ### <span>Software Engineering Intern, Google</span> <span>Mar 2017 &mdash; Sept 2017</span>

### <span>Software Engineering Intern, Curalate</span> <span>June 2016 &mdash; Sept 2016</span> -->

## Education

### University Name, Major, Bachelors of Science <span class="spacer"></span> 2014 &mdash; 2018

- Include GPA if you like
- Teacher Assistant for 1 year (Intro to Programming and Client Side Web Development)
- Resident Advisor for 2 years

## Current Projects

### resume.lol

- Built a resume editor which converts Markdown and CSS into a beautifully rendered resume PDF
- Implemented a WYSIWYG multi-page live preview of the resume from scratch
- Exported this resume from the website :)

## Skills

- Code: React + hooks, NextJS, Javascript, TypeScript, NodeJS, CSS, styled-components, Golang
- Tools: Docker, Redis, SQL, AWS, Puppeteer, Storybook, Jest, Shell, Tailwind

## Achievements

### Best Undergrad Research Project <span class="spacer"></span> 2018

### Eagle Scout <span class="spacer"></span> 2012
`,
    css: `/* You can poke around this CSS if you want to customize your formatting / styling further */
/* You can even import custom fonts! */

@page {
  size: letter;
  margin: 0.5in;
}

/* fonts */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&display=swap');

/* meta */
body {
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    font-size:  14px;
}

.spacer {
    margin: 0px auto;
}

/* ordering of content */
h1 {
    order: 0;
}

.headerInfo {
    order: 1;
}

/* styling content */
h1, h2, h3, p, a, li {
    color: black;
}

h2 {
    margin: 10px 0px;
}

h3 {
    margin: 6px 0px;
}

h1 {
    color: black;
    text-transform: uppercase;
    text-align: center;
    font-size: 24px;
    margin: 0;
    padding: 0;
}

h2 {
    border-bottom: 1px solid #000000;
    text-transform: uppercase;
    font-size: 16px;
    padding: 0;
}

h3 {
    display: flex;
    font-size: 15px;
    padding: 0;
    justify-content: space-between;
}

p {
    margin: 0;
    padding: 0;
}

a {
    color: black;
}

ul {
    margin: 4px 0;
    padding-left: 24px;
    padding-right: 24px;
}

/* header info content */
.headerInfo > ul {
    display: flex;
    text-align: center;
    justify-content: center;
    margin: 6px auto 0px !important;
    padding: 0;
}

.headerInfo > ul > li {
    display: inline;
    white-space: pre;
    list-style-type: none;
}

.headerInfo > ul >li:not(:last-child) {
    margin-right: 8px;
}

.headerInfo > ul > li:not(:last-child):after {
    content: "•";
    margin-left: 8px;
}
`,
};
