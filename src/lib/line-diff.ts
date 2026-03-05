export type DiffCount = {
    additions: number;
    deletions: number;
};

function toLines(text: string) {
    if (!text) return [];

    const normalized = text.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    if (lines.at(-1) === "") lines.pop();
    return lines;
}

function lcsLength(left: string[], right: string[]) {
    if (left.length === 0 || right.length === 0) return 0;

    const previous = new Array(right.length + 1).fill(0);
    const current = new Array(right.length + 1).fill(0);

    for (let row = 1; row <= left.length; row += 1) {
        current[0] = 0;
        for (let column = 1; column <= right.length; column += 1) {
            if (left[row - 1] === right[column - 1]) {
                current[column] = previous[column - 1] + 1;
            } else {
                current[column] = Math.max(previous[column], current[column - 1]);
            }
        }

        for (let column = 0; column <= right.length; column += 1) {
            previous[column] = current[column];
        }
    }

    return previous[right.length];
}

export function countLineDiff(base: string, current: string): DiffCount {
    if (base === current) return { additions: 0, deletions: 0 };

    const baseLines = toLines(base);
    const currentLines = toLines(current);
    const commonLineCount = lcsLength(baseLines, currentLines);

    return {
        additions: currentLines.length - commonLineCount,
        deletions: baseLines.length - commonLineCount,
    };
}
