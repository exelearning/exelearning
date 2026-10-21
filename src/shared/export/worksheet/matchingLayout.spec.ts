import { afterEach, describe, expect, it, mock } from 'bun:test';
import { JSDOM } from 'jsdom';
import { partitionMatchingRows } from './matchingCards';
import { installMatchingLayout, renderMatchingLayoutScript } from './matchingLayout';

const documents: JSDOM[] = [];
afterEach(() => documents.splice(0).forEach(dom => dom.window.close()));

function fixture() {
    const indices = [
        [2, 0, 1],
        [1, 2, 0],
    ];
    const columns = indices
        .map(
            (rows, column) =>
                `<ul class="worksheet-cards" style="row-gap:12px">${rows
                    .map(
                        row =>
                            `<li class="worksheet-card" data-name="${column}:${row}" data-height="${column === 0 && row < 2 ? 500 : 100}">${column}:${row}</li>`,
                    )
                    .join('')}</ul>`,
        )
        .join('');
    const dom = new JSDOM(
        `<div class="worksheet-matching-set" data-worksheet-matches='${JSON.stringify(indices)}'><div class="worksheet-match worksheet-pairs">${columns}</div></div>`,
        { runScripts: 'outside-only' },
    );
    documents.push(dom);
    const win = dom.window;
    const doc = win.document;
    let width = 640;
    win.HTMLElement.prototype.getBoundingClientRect = function () {
        return { width, height: Number(this.dataset.height || 0) } as DOMRect;
    };
    Object.defineProperty(doc, 'readyState', { value: 'loading', configurable: true });
    const container = doc.querySelector<HTMLElement>('.worksheet-matching-set')!;
    const groups = () =>
        Array.from(container.children).map(group =>
            Array.from(group.children).map(column =>
                Array.from(column.children).map(card => (card as HTMLElement).dataset.name),
            ),
        );
    return {
        dom,
        win: win as unknown as Window,
        doc,
        container,
        groups,
        setWidth: (value: number) => {
            width = value;
        },
    };
}

describe('matching print layout', () => {
    it('splits measured groups without separating partners or changing shuffled order', () => {
        const f = fixture();
        installMatchingLayout(f.doc, f.win, partitionMatchingRows)();
        expect(f.groups()).toEqual([
            [['0:0'], ['1:0']],
            [
                ['0:2', '0:1'],
                ['1:1', '1:2'],
            ],
        ]);
        expect(f.container.hasAttribute('data-worksheet-matches')).toBe(false);
        expect(f.container.dataset.worksheetLayout).toBe('ready');
    });

    it('remeasures on print and load, without duplicating cards or labels', () => {
        const f = fixture();
        installMatchingLayout(f.doc, f.win, partitionMatchingRows)();
        f.doc.querySelectorAll<HTMLElement>('.worksheet-card').forEach(card => {
            card.dataset.height = '100';
        });
        f.win.dispatchEvent(new f.dom.window.Event('beforeprint'));
        f.win.dispatchEvent(new f.dom.window.Event('load'));
        expect(f.groups()).toEqual([
            [
                ['0:2', '0:0', '0:1'],
                ['1:1', '1:2', '1:0'],
            ],
        ]);
        expect(f.doc.querySelectorAll('.worksheet-card-reference')).toHaveLength(6);
    });

    it('waits for a hidden iframe to acquire a width', () => {
        const f = fixture();
        let resize: ResizeObserverCallback = () => {};
        const observe = mock(() => {});
        Object.assign(f.win, {
            ResizeObserver: class {
                constructor(callback: ResizeObserverCallback) {
                    resize = callback;
                }
                observe = observe;
            },
        });
        const partition = mock(partitionMatchingRows);
        f.setWidth(0);
        installMatchingLayout(f.doc, f.win, partition)();
        expect(partition).not.toHaveBeenCalled();
        f.setWidth(640);
        const entries = [{ contentRect: { width: 640 } }] as ResizeObserverEntry[];
        resize(entries, {} as ResizeObserver);
        resize(entries, {} as ResizeObserver);
        expect(partition).toHaveBeenCalledTimes(1);
        expect(observe).toHaveBeenCalledWith(f.doc.documentElement);
    });

    it('uses arbitrary references when one card alone exceeds a sheet, without truncating it', () => {
        const f = fixture();
        const card = f.doc.querySelector<HTMLElement>('[data-name="0:0"]')!;
        card.dataset.height = '1200';
        const content = 'Long definition '.repeat(1000);
        card.textContent = content;
        const layout = installMatchingLayout(f.doc, f.win, partitionMatchingRows);
        layout();
        expect(f.container.firstElementChild?.classList.contains('worksheet-pairs-referenced')).toBe(true);
        expect(card.textContent).toContain(content);
        expect(card.firstElementChild?.textContent).toBe('A2 → B____');
        expect(f.doc.querySelector('[data-name="1:0"]')?.firstElementChild?.textContent).toBe('B3');
        card.dataset.height = '100';
        layout();
        expect(f.doc.querySelector('.worksheet-pairs-referenced')).toBeNull();
    });

    it('handles DOM readiness, font readiness and a document without matching cards', async () => {
        const f = fixture();
        Object.defineProperty(f.doc, 'readyState', { value: 'complete' });
        Object.defineProperty(f.doc, 'fonts', { value: { ready: Promise.resolve() } });
        const partition = mock(partitionMatchingRows);
        installMatchingLayout(f.doc, f.win, partition);
        await Promise.resolve();
        expect(partition.mock.calls.length).toBeGreaterThanOrEqual(2);
        const empty = new JSDOM('');
        documents.push(empty);
        expect(() =>
            installMatchingLayout(empty.window.document, empty.window as unknown as Window, partition)(),
        ).not.toThrow();
    });

    it('runs the serialized script without module globals', () => {
        const f = fixture();
        f.dom.window.eval(renderMatchingLayoutScript().replace(/^<script>|<\/script>$/g, ''));
        f.doc.dispatchEvent(new f.dom.window.Event('DOMContentLoaded'));
        expect(f.container.children).toHaveLength(2);
    });
});
