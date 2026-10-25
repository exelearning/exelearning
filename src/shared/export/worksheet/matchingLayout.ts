import { partitionMatchingRows } from './matchingCards';

/**
 * Measure the final fonts, formulas and pictures before partitioning matching exercises.
 * This function is also serialized into both print documents, so it has no module dependencies.
 */
export function installMatchingLayout(doc: Document, win: Window, partition: typeof partitionMatchingRows): () => void {
    const sets: {
        container: HTMLElement;
        original: HTMLElement;
        columns: HTMLElement[];
        cards: HTMLElement[][];
        indices: number[][];
    }[] = [];
    // A4 minus 15 mm margins, with spare room for the group's own margin and rounding.
    const available = (250 * 96) / 25.4;

    const layout = () => {
        for (const container of doc.querySelectorAll<HTMLElement>('[data-worksheet-matches]')) {
            const original = container.firstElementChild as HTMLElement;
            const columns = Array.from(original.children) as HTMLElement[];
            const cards = columns.map(column => Array.from(column.children) as HTMLElement[]);
            const indices = JSON.parse(container.dataset.worksheetMatches!) as number[][];
            // Keep the relation in the closure, not in the displayed cards or their labels.
            container.removeAttribute('data-worksheet-matches');
            cards.forEach((column, col) =>
                column.forEach((card, index) => {
                    const label = doc.createElement('span');
                    label.className = 'worksheet-card-reference';
                    label.textContent =
                        `${String.fromCharCode(65 + col)}${index + 1}` +
                        (col < columns.length - 1 ? ` → ${String.fromCharCode(66 + col)}____` : '');
                    card.prepend(label);
                }),
            );
            sets.push({ container, original, columns, cards, indices });
        }

        for (const set of sets) {
            const { container, original, columns, cards, indices } = set;
            if (!container.getBoundingClientRect().width) continue;
            original.classList.remove('worksheet-pairs-referenced');
            columns.forEach((column, index) => column.replaceChildren(...cards[index]));
            original.replaceChildren(...columns);
            container.replaceChildren(original);

            const heights: number[][] = indices[0].map(() => []);
            cards.forEach((column, col) =>
                column.forEach((card, index) => {
                    heights[indices[col][index]][col] = card.getBoundingClientRect().height;
                }),
            );
            const gap = Number.parseFloat(win.getComputedStyle(columns[0]).rowGap) || 0;

            if (heights.some(row => row.some(height => height > available))) {
                // An individual card can be longer than a sheet. Preserve all its content and
                // give cards arbitrary references to match in writing across page boundaries.
                original.classList.add('worksheet-pairs-referenced');
            } else {
                const groups = partition(heights, available, gap).map(rows => {
                    const group = original.cloneNode(false) as HTMLElement;
                    columns.forEach((column, col) => {
                        const list = column.cloneNode(false) as HTMLElement;
                        cards[col].forEach((card, index) => {
                            if (rows.includes(indices[col][index])) list.append(card);
                        });
                        group.append(list);
                    });
                    return group;
                });
                container.replaceChildren(...groups);
            }
            container.dataset.worksheetLayout = 'ready';
        }
    };

    doc.addEventListener('DOMContentLoaded', layout, { once: true });
    win.addEventListener('load', layout);
    win.addEventListener('beforeprint', layout);
    doc.fonts?.ready.then(layout);
    // Print preview iframes may start hidden. Measure again when their width becomes available.
    const Observer = (win as Window & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    if (Observer) {
        let width = 0;
        new Observer(entries => {
            const next = entries[0].contentRect.width;
            if (next !== width) {
                width = next;
                layout();
            }
        }).observe(doc.documentElement);
    }
    if (doc.readyState !== 'loading') layout();
    return layout;
}

/** One script for standalone worksheets and activities embedded in print previews. */
export function renderMatchingLayoutScript(): string {
    return `<script>(${installMatchingLayout.toString()})(document, window, ${partitionMatchingRows.toString()});</script>`;
}
