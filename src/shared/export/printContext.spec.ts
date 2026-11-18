import { describe, expect, it } from 'bun:test';
import { renderPrintContextScript } from './printContext';

/** Run the injected script against a fake window and document, as a browser would. */
function run(script: string, runtime: Record<string, unknown> | undefined = {}, className = '') {
    const root = {
        className,
        attributes: {} as Record<string, string>,
        setAttribute(name: string, value: string) {
            this.attributes[name] = value;
        },
    };
    const win: Record<string, unknown> = { $exeExport: runtime, matchMedia: () => ({ matches: false }) };
    const body = script.replace('<script>', '').replace('</script>', '');

    new Function('window', 'document', body)(win, { documentElement: root });

    return { window: win, root };
}

describe('renderPrintContextScript', () => {
    it('says which document this is', () => {
        const { window } = run(renderPrintContextScript({ kind: 'worksheet' }));

        expect((window.$exeExport as { printing: unknown }).printing).toEqual({
            kind: 'worksheet',
            activities: null,
        });
    });

    it('says what became of the interactive activities', () => {
        const { window } = run(renderPrintContextScript({ kind: 'document', activities: 'appendix' }));

        expect((window.$exeExport as { printing: unknown }).printing).toEqual({
            kind: 'document',
            activities: 'appendix',
        });
    });

    it('reports no activity mode when the author was never asked', () => {
        // Printing behaved this way before there was anything to choose.
        const { window } = run(renderPrintContextScript({ kind: 'document', activities: null }));

        expect((window.$exeExport as { printing: { activities: unknown } }).printing.activities).toBeNull();
    });

    it('marks the document element for CSS that cannot wait for a script', () => {
        const { root } = run(renderPrintContextScript({ kind: 'worksheet' }));

        expect(root.className).toBe('exe-print-document');
        expect(root.attributes['data-exe-print']).toBe('worksheet');
    });

    it('keeps the classes the document already had', () => {
        const { root } = run(renderPrintContextScript({ kind: 'document' }), {}, 'js');

        expect(root.className).toBe('js exe-print-document');
    });

    it('adds to the runtime rather than replacing it', () => {
        // exe_export.js has already run by the time this script does, and everything it built has
        // to survive: it defines itself only when the global is absent.
        const runtime = { init: () => 'kept', isTogglingBox: false };
        const { window } = run(renderPrintContextScript({ kind: 'document' }), runtime);

        expect((window.$exeExport as { init: () => string }).init()).toBe('kept');
        expect((window.$exeExport as { isTogglingBox: boolean }).isTogglingBox).toBe(false);
    });

    it("leaves the runtime's own isPrinting alone", () => {
        const runtime = { isPrinting: () => 'the real one' };
        const { window } = run(renderPrintContextScript({ kind: 'document' }), runtime);

        expect((window.$exeExport as { isPrinting: () => string }).isPrinting()).toBe('the real one');
    });

    it('supplies isPrinting for the document that has no runtime to borrow it from', () => {
        // The worksheet is a standalone document and does not load exe_export.js.
        const { window } = run(renderPrintContextScript({ kind: 'worksheet' }), undefined);

        expect(typeof (window.$exeExport as { isPrinting: unknown }).isPrinting).toBe('function');
        expect((window.$exeExport as { isPrinting: () => boolean }).isPrinting()).toBe(false);
    });

    it('is a script element, ready to go at the end of the head', () => {
        const script = renderPrintContextScript({ kind: 'document' });

        expect(script.startsWith('<script>')).toBe(true);
        expect(script.trimEnd().endsWith('</script>')).toBe(true);
    });
});
