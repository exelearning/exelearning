/**
 * In-page helpers for the preview benchmark. Each function is passed to
 * `page.evaluate`, so it must be fully self-contained (no closure over module
 * scope) and use only browser globals plus the app singletons on `window`.
 *
 * They drive the SAME code paths a real user's edits drive: mutating the Y.Doc
 * fires `ydoc.on('update')`, which the preview panel debounces (500 ms) into a
 * `refresh()`. Binary assets are inserted through `AssetManager.insertImage()`,
 * exactly like dropping a file into a page.
 */

/** Shape returned by readState(). */
export interface RefreshState {
    version: number;
    isLoading: boolean;
    mode: string | null;
    currentPage: string | null;
    pageCount: number;
}

/** Read the preview provider's refresh counter and loading flag. */
export function readState(): RefreshState {
    const w = window as any;
    const panel = w.eXeLearning?.app?.interface?.previewButton?.getPanel?.() || null;
    const provider = panel?._provider || null;
    const dm = w.eXeLearning?.app?.project?._yjsBridge?.getDocumentManager?.();
    const nav = dm?.getDoc?.()?.getArray?.('navigation');
    return {
        version: typeof provider?._version === 'number' ? provider._version : -1,
        isLoading: !!panel?.isLoading,
        mode: provider?.mode ?? null,
        currentPage: panel?._currentPagePath ?? null,
        pageCount: nav ? nav.length : 0,
    };
}

/**
 * Insert deterministic binary assets and reference them from pages.
 * Runs while the preview is CLOSED so no refresh fires mid-build.
 */
export async function buildAssets(args: {
    specs: Array<{
        seed: number;
        sizeBytes: number;
        filename: string;
        mime: string;
        pageIndex: number;
        tag: 'img' | 'video';
    }>;
}): Promise<{ refs: string[]; totalBytes: number }> {
    const w = window as any;
    const bridge = w.eXeLearning?.app?.project?._yjsBridge;
    const assetManager = bridge?.getAssetManager?.();
    const dm = bridge?.getDocumentManager?.();
    const ydoc = dm?.getDoc?.();
    const nav = ydoc?.getArray?.('navigation');
    if (!assetManager || !ydoc || !nav) throw new Error('buildAssets: app not ready');

    const makeBytes = (seed: number, size: number): Uint8Array => {
        let a = seed >>> 0;
        const out = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
            a = (a + 0x6d2b79f5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            out[i] = (t ^ (t >>> 14)) & 0xff;
        }
        return out;
    };

    const refs: string[] = [];
    let totalBytes = 0;
    for (const spec of args.specs) {
        const bytes = makeBytes(spec.seed, spec.sizeBytes);
        totalBytes += bytes.length;
        const file = new File([bytes], spec.filename, { type: spec.mime });
        const ref: string = await assetManager.insertImage(file);
        refs.push(ref);

        const html =
            spec.tag === 'img'
                ? `<p><img src="${ref}" alt="asset ${spec.filename}" width="240" height="240"></p>`
                : `<p><video src="${ref}" controls width="320"></video></p>`;

        ydoc.transact(() => {
            const page = nav.get(spec.pageIndex);
            const blocks = page.get('blocks');
            const block = blocks.get(0);
            const comps = block.get('components');
            const comp = comps.get(0);
            const current = (comp.get('htmlView') as string) || '';
            comp.set('htmlView', current + html);
        }, 'benchmark-build');
    }
    return { refs, totalBytes };
}

/** Mutate one page's marker span to `rev{rev}` (simulates a text edit). */
export function editText(args: { pageIndex: number; rev: number }): string {
    const w = window as any;
    const dm = w.eXeLearning?.app?.project?._yjsBridge?.getDocumentManager?.();
    const ydoc = dm?.getDoc?.();
    const nav = ydoc?.getArray?.('navigation');
    if (!ydoc || !nav) throw new Error('editText: app not ready');
    const marker = `rev${args.rev}`;
    const setMarker = (html: string): string =>
        /<span class="bench-marker"[^>]*>[^<]*<\/span>/.test(html)
            ? html.replace(/(<span class="bench-marker"[^>]*>)[^<]*(<\/span>)/, `$1${marker}$2`)
            : html + `<span class="bench-marker" id="bench-marker-${args.pageIndex}">${marker}</span>`;
    ydoc.transact(() => {
        const page = nav.get(args.pageIndex);
        const comp = page.get('blocks').get(0).get('components').get(0);
        const html = setMarker((comp.get('htmlView') as string) || '');
        comp.set('htmlView', html);
        // Keep jsonProperties.textTextarea in sync in case the idevice runtime
        // re-renders from it rather than the static htmlView.
        const rawJson = comp.get('jsonProperties');
        if (typeof rawJson === 'string') {
            try {
                const obj = JSON.parse(rawJson);
                if (typeof obj.textTextarea === 'string') obj.textTextarea = setMarker(obj.textTextarea);
                comp.set('jsonProperties', JSON.stringify(obj));
            } catch {
                /* leave as-is */
            }
        }
    }, 'benchmark-edit');
    return marker;
}

/** Rename one page (title + pageName) — a structural change touching global nav. */
export function renamePage(args: { pageIndex: number; newTitle: string }): void {
    const w = window as any;
    const dm = w.eXeLearning?.app?.project?._yjsBridge?.getDocumentManager?.();
    const ydoc = dm?.getDoc?.();
    const nav = ydoc?.getArray?.('navigation');
    if (!ydoc || !nav) throw new Error('renamePage: app not ready');
    ydoc.transact(() => {
        const page = nav.get(args.pageIndex);
        page.set('title', args.newTitle);
        if (page.get('pageName') !== undefined) page.set('pageName', args.newTitle);
    }, 'benchmark-rename');
}

/** Fire N marker edits on one page as fast as possible (rapid-typing burst). */
export function rapidEdits(args: { pageIndex: number; count: number; baseRev: number }): number {
    const w = window as any;
    const dm = w.eXeLearning?.app?.project?._yjsBridge?.getDocumentManager?.();
    const ydoc = dm?.getDoc?.();
    const nav = ydoc?.getArray?.('navigation');
    if (!ydoc || !nav) throw new Error('rapidEdits: app not ready');
    let last = args.baseRev;
    for (let i = 1; i <= args.count; i++) {
        last = args.baseRev + i;
        const marker = `rev${last}`;
        const setMarker = (html: string): string =>
            html.replace(/(<span class="bench-marker"[^>]*>)[^<]*(<\/span>)/, `$1${marker}$2`);
        ydoc.transact(() => {
            const comp = nav.get(args.pageIndex).get('blocks').get(0).get('components').get(0);
            comp.set('htmlView', setMarker((comp.get('htmlView') as string) || ''));
            const rawJson = comp.get('jsonProperties');
            if (typeof rawJson === 'string') {
                try {
                    const obj = JSON.parse(rawJson);
                    if (typeof obj.textTextarea === 'string') obj.textTextarea = setMarker(obj.textTextarea);
                    comp.set('jsonProperties', JSON.stringify(obj));
                } catch {
                    /* leave as-is */
                }
            }
        }, 'benchmark-rapid');
    }
    return last;
}
