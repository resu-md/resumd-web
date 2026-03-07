export default function GithubDiff(props: { diffMode: boolean; onToggleDiffMode: (value: boolean) => void }) {
    return (
        <button
            title={!props.diffMode ? "Show diff" : "Hide diff"}
            class="group/diff hover:bg-fill-quaternary flex items-center rounded-lg px-1.5 py-0.75 font-mono text-sm hover:backdrop-blur-2xl"
            onClick={() => props.onToggleDiffMode(!props.diffMode)}
        >
            <span class="text-green">+20</span>
            <span class="text-red ml-1">-5</span>
        </button>
    );
}
