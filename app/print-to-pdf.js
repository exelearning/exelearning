/**
 * Save the print preview as a PDF, for the Electron desktop app.
 *
 * Printing from the desktop app goes through the operating system's dialog, which needs a working
 * print service and at least one printer; on a locked-down machine it may not open at all (issue
 * #1398). A PDF needs neither, so the preview offers to save one.
 *
 * The PDF is made from the preview's own frame with `WebFrameMain.printToPDF()`, which Electron
 * provides to print one <iframe> from the main process. That frame is the document the user has
 * been looking at — with the blocks they folded or opened, and its assets as the renderer's blob
 * URLs — so nothing is drawn again. Printing the whole window would print the editor around it.
 *
 * The dialog and the file system are injected so the flow can be unit-tested without Electron.
 *
 * Result contract (also the `app:savePrintPreviewAsPdf` IPC contract):
 *   { saved: true, canceled: false, filePath }
 *   { saved: false, canceled: true }            — the user closed the dialog
 *   { saved: false, canceled: false, error }    — no preview frame, or the PDF could not be made or written
 */

const path = require('path');

/** Countries whose default paper is Letter rather than A4. */
const LETTER_COUNTRIES = new Set(['US', 'CA', 'MX', 'PH', 'CL', 'CO', 'VE', 'GT', 'PR']);

/** Characters no file system takes in a name (control characters are handled apart). */
const UNSAFE_NAME_CHARACTERS = /[\\/:*?"<>|]/g;

/**
 * The preview's frame among the frames of the window that asked.
 *
 * @param {Electron.WebContents} webContents - The window's contents
 * @param {string} frameName - The name the preview's iframe carries
 * @returns {Electron.WebFrameMain|null} The frame, or null when there is none by that name
 */
function findPreviewFrame(webContents, frameName) {
    if (!frameName) return null;
    return webContents?.mainFrame?.framesInSubtree?.find(frame => frame.name === frameName) ?? null;
}

/**
 * The paper the PDF is laid out on when the document asks for none (`@page` wins otherwise).
 *
 * @param {string} countryCode - The system's country, e.g. 'ES'
 * @returns {'A4'|'Letter'} The size
 */
function pageSizeFor(countryCode) {
    return LETTER_COUNTRIES.has(String(countryCode || '').toUpperCase()) ? 'Letter' : 'A4';
}

/**
 * A file name for the PDF, taken from the document's title.
 *
 * @param {string} title - The preview's title, which is the project's
 * @returns {string} A name every file system takes, ending in .pdf
 */
function pdfFileName(title) {
    // Control characters sort before the space: they go too.
    const base = Array.from(String(title || ''), character => (character < ' ' ? '_' : character))
        .join('')
        .replace(UNSAFE_NAME_CHARACTERS, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[. ]+$/, '');
    return `${base || 'print'}.pdf`;
}

/**
 * Ask where to save the PDF, then make it from the preview's frame and write it there.
 *
 * The dialog comes first, so nothing is made for a user who changes their mind.
 *
 * @param {object} request
 * @param {Electron.WebContents} request.webContents - The window that asked
 * @param {string} request.frameName - The name of the preview's iframe
 * @param {string} request.title - The preview's title
 * @param {object} deps
 * @param {(options: object) => Promise<{canceled: boolean, filePath?: string}>} deps.showSaveDialog
 * @param {(filePath: string, data: Buffer) => Promise<void>} deps.writeFile
 * @param {string|null} deps.defaultDir - Where the dialog starts
 * @param {string} deps.countryCode - The system's country, for the default paper
 * @param {object} [deps.dialogText] - Translated `title` and `buttonLabel` for the dialog
 * @returns {Promise<object>} The result, as described above
 */
async function savePrintPreviewAsPdf(
    { webContents, frameName, title },
    { showSaveDialog, writeFile, defaultDir, countryCode, dialogText = {} },
) {
    const frame = findPreviewFrame(webContents, frameName);
    if (!frame) return { saved: false, canceled: false, error: 'Print preview not found' };

    const fileName = pdfFileName(title);
    const { canceled, filePath } = await showSaveDialog({
        ...dialogText,
        defaultPath: defaultDir ? path.join(defaultDir, fileName) : fileName,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (canceled || !filePath) return { saved: false, canceled: true };

    try {
        const data = await frame.printToPDF({
            pageSize: pageSizeFor(countryCode),
            preferCSSPageSize: true,
            // As a printer does by default: the icons that must keep their colour say so
            // themselves (print-color-adjust), and other backgrounds stay off the page.
            printBackground: false,
        });
        await writeFile(filePath, data);
        return { saved: true, canceled: false, filePath };
    } catch (error) {
        return { saved: false, canceled: false, error: error?.message || String(error) };
    }
}

module.exports = { findPreviewFrame, pageSizeFor, pdfFileName, savePrintPreviewAsPdf };
