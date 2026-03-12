export type DiffStats = { added: number; removed: number };

export function splitLines(value: string): string[] {
    if (!value.length) return [];
    return value.split(/\r?\n/);
}

export function getLineDiffStats(original: string, modified: string): DiffStats {
    if (original === modified) {
        return { added: 0, removed: 0 };
    }

    const originalLines = splitLines(original);
    const modifiedLines = splitLines(modified);

    let start = 0;
    while (
        start < originalLines.length &&
        start < modifiedLines.length &&
        originalLines[start] === modifiedLines[start]
    ) {
        start += 1;
    }

    let originalEnd = originalLines.length - 1;
    let modifiedEnd = modifiedLines.length - 1;
    while (originalEnd >= start && modifiedEnd >= start && originalLines[originalEnd] === modifiedLines[modifiedEnd]) {
        originalEnd -= 1;
        modifiedEnd -= 1;
    }

    const originalCore = originalLines.slice(start, originalEnd + 1);
    const modifiedCore = modifiedLines.slice(start, modifiedEnd + 1);

    if (!originalCore.length) {
        return { added: modifiedCore.length, removed: 0 };
    }

    if (!modifiedCore.length) {
        return { added: 0, removed: originalCore.length };
    }

    const cellCount = originalCore.length * modifiedCore.length;
    if (cellCount > 250_000) {
        return {
            added: modifiedCore.length,
            removed: originalCore.length,
        };
    }

    const dp = new Array<number>(modifiedCore.length + 1).fill(0);
    for (const originalLine of originalCore) {
        let previousDiagonal = 0;

        for (let index = 1; index <= modifiedCore.length; index += 1) {
            const previousValue = dp[index];
            if (originalLine === modifiedCore[index - 1]) {
                dp[index] = previousDiagonal + 1;
            } else if (dp[index - 1] > dp[index]) {
                dp[index] = dp[index - 1];
            }

            previousDiagonal = previousValue;
        }
    }

    const commonCount = dp[modifiedCore.length];
    return {
        added: modifiedCore.length - commonCount,
        removed: originalCore.length - commonCount,
    };
}
