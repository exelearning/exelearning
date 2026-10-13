/** The print windows waiting for their dialog to answer, with the editor that asked for each. */
const waiting = new Map();

/** Windows whose print was given up on, so that their closing reads as a cancellation. */
const givenUp = new WeakSet();

/**
 * Give up on the prints an editor is still waiting on.
 *
 * On macOS the dialog of a hidden window may be a sheet nobody can see, which never answers. Left
 * alone, its window and the copy it holds would stay until the editor closes. Destroying the
 * window settles its print as cancelled.
 *
 * @param {unknown} owner - The editor whose prints to give up on
 */
function giveUpPrints(owner) {
    for (const [win, by] of waiting) {
        if (by !== owner) continue;
        givenUp.add(win);
        if (!win.isDestroyed()) win.destroy();
    }
}

/**
 * Print a snapshot of the visible preview in a separate, hidden window. webContents.print reports
 * native failures and cancellation; window.print/beforeprint cannot report a missing print service.
 * Printing the editor's webContents instead would also print the surrounding application.
 */
async function printPreview(url, { createWindow, owner = null }) {
    if (typeof url !== 'string' || !url.startsWith('blob:')) {
        return { success: false, canceled: false, error: 'Invalid print preview URL' };
    }

    // The editor can only print again once its preview was closed, so a print it is still waiting
    // on has been given up on. It is not done when the preview closes: the dialog may have been
    // answered already, and the copy still be on its way to the printer.
    giveUpPrints(owner);

    let win;
    try {
        win = createWindow();
        waiting.set(win, owner);
        await win.loadURL(url);
        // Stylesheets/images finish with loadURL; web fonts may still be settling.
        await win.webContents.executeJavaScript('document.fonts.ready.then(() => undefined)');
        return await new Promise((resolve, reject) => {
            const closed = () =>
                givenUp.has(win)
                    ? resolve({ success: false, canceled: true })
                    : reject(new Error('Print window closed'));
            win.once('closed', closed);
            try {
                win.webContents.print({ silent: false, printBackground: false }, (success, failureReason) => {
                    win.removeListener('closed', closed);
                    const canceled = !success && /cancel(l)?ed/i.test(failureReason);
                    resolve({ success, canceled, ...(!success && !canceled ? { error: failureReason } : {}) });
                });
            } catch (error) {
                win.removeListener('closed', closed);
                reject(error);
            }
        });
    } catch (error) {
        // Given up on while it was still loading.
        if (win && givenUp.has(win)) return { success: false, canceled: true };
        return { success: false, canceled: false, error: error?.message || String(error) };
    } finally {
        if (win) waiting.delete(win);
        if (win && !win.isDestroyed()) win.destroy();
    }
}

module.exports = { printPreview };
