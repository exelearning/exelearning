import { describe, expect, it, mock } from 'bun:test';
import path from 'node:path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { findPreviewFrame, pageSizeFor, pdfFileName, savePrintPreviewAsPdf } = require('./print-to-pdf');

/** A window whose frames carry the given names; each frame prints the given bytes. */
const windowWithFrames = (names: string[], pdf = Buffer.from('%PDF-1.7')) => {
    const frames = names.map(name => ({ name, printToPDF: mock(async () => pdf) }));
    return { webContents: { mainFrame: { framesInSubtree: frames } }, frames };
};

describe('print-to-pdf', () => {
    describe('findPreviewFrame', () => {
        it('finds the preview among the frames of the window that asked', () => {
            const { webContents, frames } = windowWithFrames(['', 'other', 'exe-print-preview']);

            expect(findPreviewFrame(webContents, 'exe-print-preview')).toBe(frames[2]);
        });

        it('finds nothing without a name, or without such a frame', () => {
            const { webContents } = windowWithFrames(['', 'other']);

            expect(findPreviewFrame(webContents, '')).toBeNull();
            expect(findPreviewFrame(webContents, 'exe-print-preview')).toBeNull();
            expect(findPreviewFrame(null, 'exe-print-preview')).toBeNull();
        });
    });

    describe('pageSizeFor', () => {
        it('lays the PDF out on A4, except where Letter is the paper', () => {
            expect(pageSizeFor('ES')).toBe('A4');
            expect(pageSizeFor('us')).toBe('Letter');
            expect(pageSizeFor('')).toBe('A4');
            expect(pageSizeFor(undefined)).toBe('A4');
        });
    });

    describe('pdfFileName', () => {
        it('names the PDF after the document, in a name every file system takes', () => {
            expect(pdfFileName('El Cid: cantar 1/3')).toBe('El Cid_ cantar 1_3.pdf');
            expect(pdfFileName('  Unidad   didáctica.  ')).toBe('Unidad didáctica.pdf');
            expect(pdfFileName('a\u0007b')).toBe('a_b.pdf');
        });

        it('falls back to a generic name when the document has none', () => {
            expect(pdfFileName('')).toBe('print.pdf');
            expect(pdfFileName(undefined)).toBe('print.pdf');
            expect(pdfFileName('...')).toBe('print.pdf');
        });
    });

    describe('savePrintPreviewAsPdf', () => {
        const deps = (overrides: Record<string, unknown> = {}) => ({
            showSaveDialog: mock(async () => ({ canceled: false, filePath: 'C:/docs/Unidad.pdf' })),
            writeFile: mock(async () => {}),
            defaultDir: 'C:/docs',
            countryCode: 'ES',
            ...overrides,
        });

        it('asks where first, then writes the PDF of the preview there', async () => {
            const pdf = Buffer.from('%PDF-1.7 preview');
            const { webContents, frames } = windowWithFrames(['exe-print-preview'], pdf);
            const d = deps({ dialogText: { title: 'Save file', buttonLabel: 'Save' } });

            const result = await savePrintPreviewAsPdf(
                { webContents, frameName: 'exe-print-preview', title: 'Unidad' },
                d,
            );

            expect(result).toEqual({ saved: true, canceled: false, filePath: 'C:/docs/Unidad.pdf' });
            expect(d.showSaveDialog).toHaveBeenCalledWith({
                title: 'Save file',
                buttonLabel: 'Save',
                defaultPath: path.join('C:/docs', 'Unidad.pdf'),
                filters: [{ name: 'PDF', extensions: ['pdf'] }],
            });
            expect(frames[0].printToPDF).toHaveBeenCalledWith({
                pageSize: 'A4',
                preferCSSPageSize: true,
                printBackground: false,
            });
            expect(d.writeFile).toHaveBeenCalledWith('C:/docs/Unidad.pdf', pdf);
        });

        it('offers just the file name when there is no folder to start from', async () => {
            const { webContents } = windowWithFrames(['exe-print-preview']);
            const d = deps({ defaultDir: null });

            await savePrintPreviewAsPdf({ webContents, frameName: 'exe-print-preview', title: '' }, d);

            expect(d.showSaveDialog.mock.calls[0][0].defaultPath).toBe('print.pdf');
        });

        it('makes nothing for a user who closes the dialog', async () => {
            const { webContents, frames } = windowWithFrames(['exe-print-preview']);
            const d = deps({ showSaveDialog: mock(async () => ({ canceled: true })) });

            const result = await savePrintPreviewAsPdf({ webContents, frameName: 'exe-print-preview' }, d);

            expect(result).toEqual({ saved: false, canceled: true });
            expect(frames[0].printToPDF).not.toHaveBeenCalled();
            expect(d.writeFile).not.toHaveBeenCalled();
        });

        it('says so when the window has no preview', async () => {
            const { webContents } = windowWithFrames(['other']);
            const d = deps();

            const result = await savePrintPreviewAsPdf({ webContents, frameName: 'exe-print-preview' }, d);

            expect(result).toEqual({ saved: false, canceled: false, error: 'Print preview not found' });
            expect(d.showSaveDialog).not.toHaveBeenCalled();
        });

        it('says why when the PDF cannot be made', async () => {
            const { webContents, frames } = windowWithFrames(['exe-print-preview']);
            frames[0].printToPDF = mock(async () => {
                throw new Error('Printing failed');
            });
            const d = deps();

            const result = await savePrintPreviewAsPdf({ webContents, frameName: 'exe-print-preview' }, d);

            expect(result).toEqual({ saved: false, canceled: false, error: 'Printing failed' });
            expect(d.writeFile).not.toHaveBeenCalled();
        });

        it('says why when the PDF cannot be written', async () => {
            const { webContents } = windowWithFrames(['exe-print-preview']);
            const d = deps({
                writeFile: mock(async () => {
                    throw 'EACCES';
                }),
            });

            const result = await savePrintPreviewAsPdf({ webContents, frameName: 'exe-print-preview' }, d);

            expect(result).toEqual({ saved: false, canceled: false, error: 'EACCES' });
        });
    });
});
