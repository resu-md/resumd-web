// TODO: Test for consistency and performance. Optionally, debounce calculation.

export type LineDiffStats = {
    added: number;
    removed: number;
};

function toLines(value: string): string[] {
    const normalized = value.replace(/\r\n/g, "\n");
    if (normalized.length === 0) return [];

    const lines = normalized.split("\n");
    if (normalized.endsWith("\n")) {
        lines.pop();
    }

    return lines;
}

// Myers shortest edit script (line-based), reduced to added/removed counters.
export function getLineDiffStats(originalValue: string, modifiedValue: string): LineDiffStats {
    const original = toLines(originalValue);
    const modified = toLines(modifiedValue);

    const n = original.length;
    const m = modified.length;

    if (n === 0) return { added: m, removed: 0 };
    if (m === 0) return { added: 0, removed: n };

    const max = n + m;
    const offset = max;
    const size = 2 * max + 1;
    const v = new Array<number>(size).fill(0);
    const trace: number[][] = [];

    for (let d = 0; d <= max; d += 1) {
        trace.push(v.slice());

        for (let k = -d; k <= d; k += 2) {
            const kIndex = offset + k;
            const prevKIndex = offset + k - 1;
            const nextKIndex = offset + k + 1;

            let x: number;
            if (k === -d || (k !== d && v[prevKIndex] < v[nextKIndex])) {
                x = v[nextKIndex];
            } else {
                x = v[prevKIndex] + 1;
            }

            let y = x - k;

            while (x < n && y < m && original[x] === modified[y]) {
                x += 1;
                y += 1;
            }

            v[kIndex] = x;

            if (x >= n && y >= m) {
                let currentX = n;
                let currentY = m;
                let added = 0;
                let removed = 0;

                for (let backtrackD = d; backtrackD > 0; backtrackD -= 1) {
                    const previousV = trace[backtrackD];
                    const currentK = currentX - currentY;

                    let previousK: number;
                    if (
                        currentK === -backtrackD ||
                        (currentK !== backtrackD && previousV[offset + currentK - 1] < previousV[offset + currentK + 1])
                    ) {
                        previousK = currentK + 1;
                    } else {
                        previousK = currentK - 1;
                    }

                    const previousX = previousV[offset + previousK];
                    const previousY = previousX - previousK;

                    while (currentX > previousX && currentY > previousY) {
                        currentX -= 1;
                        currentY -= 1;
                    }

                    if (currentX === previousX) {
                        added += 1;
                        currentY -= 1;
                    } else {
                        removed += 1;
                        currentX -= 1;
                    }
                }

                return { added, removed };
            }
        }
    }

    return { added: 0, removed: 0 };
}
