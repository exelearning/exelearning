/**
 * How long a print must have been waiting before printing again gives it up.
 *
 * Electron says nothing when its dialog is answered, only when the copy has been sent, so a print
 * that has just been confirmed looks like one whose dialog never answered. Seconds after it
 * started, it may still be on its way to the printer; a minute on, it is the dialog that hangs.
 */
const GIVE_UP_AFTER_MS = 60_000;

/** The print windows waiting for their dialog to answer: who asked for each, and since when. */
const waiting = new Map();

/** Windows whose print was given up on, so that their closing reads as a cancellation. */
const givenUp = new WeakSet();

/**
 * Give up on the prints an editor has been waiting on for a while.
 *
 * On macOS the dialog of a hidden window may be a sheet nobody can see, which never answers. Left
 * alone, its window and the copy it holds would stay until the editor closes. Destroying the
 * window settles its print as cancelled.
 *
 * @param {unknown} owner - The editor whose prints to give up on
 * @param {number} now - The time it prints again, in milliseconds
 */
function giveUpPrints(owner, now) {
    for (const [win, print] of waiting) {
        if (print.owner !== owner || now - print.since < GIVE_UP_AFTER_MS) continue;
        givenUp.add(win);
        if (!win.isDestroyed()) win.destroy();
    }
}

/**
 * Print a snapshot of the visible preview in a separate, hidden window. webContents.print reports
 * native failures and cancellation; window.print/beforeprint cannot report a missing print service.
 * Printing the editor's webContents instead would also print the surrounding application.
 */
async function printPreview(url, { createWindow, owner = null, now = Date.now }) {
    if (typeof url !== 'string' || !url.startsWith('blob:')) {
        return { success: false, canceled: false, error: 'Invalid print preview URL' };
    }

    // The editor can only print again once its preview was closed, so a print it has been waiting
    // on for a while has been given up on. It is not done when the preview closes, nor to a recent
    // print: the dialog may have been answered already, and the copy still be on its way.
    giveUpPrints(owner, now());

    let win;
    let stopWatching = () => {};
    try {
        win = createWindow();
        waiting.set(win, { owner, since: now() });
        // Each step also ends if the window closes first. Electron leaves executeJavaScript
        // pending for good on a destroyed window, and that print would never be settled.
        const closing = new Promise((_resolve, reject) => {
            const closed = () => reject(new Error('Print window closed'));
            win.once('closed', closed);
            stopWatching = () => win.removeListener('closed', closed);
        });
        const untilClosed = step => Promise.race([step, closing]);

        await untilClosed(win.loadURL(url));
        // Stylesheets/images finish with loadURL; web fonts may still be settling.
        await untilClosed(win.webContents.executeJavaScript('document.fonts.ready.then(() => undefined)'));
        return await untilClosed(
            new Promise((resolve, reject) => {
                try {
                    win.webContents.print({ silent: false, printBackground: false }, (success, failureReason) => {
                        const canceled = !success && /cancel(l)?ed/i.test(failureReason);
                        resolve({ success, canceled, ...(!success && !canceled ? { error: failureReason } : {}) });
                    });
                } catch (error) {
                    reject(error);
                }
            }),
        );
    } catch (error) {
        // Given up on before its dialog answered.
        if (win && givenUp.has(win)) return { success: false, canceled: true };
        return { success: false, canceled: false, error: error?.message || String(error) };
    } finally {
        stopWatching();
        if (win) waiting.delete(win);
        if (win && !win.isDestroyed()) win.destroy();
    }
}

module.exports = { printPreview, GIVE_UP_AFTER_MS };
