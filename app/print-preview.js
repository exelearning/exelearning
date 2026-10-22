/**
 * How long a native print must have been waiting before printing again gives it up.
 *
 * Electron says nothing when its dialog is answered, only when the copy has been sent, so a print
 * that has just been confirmed looks like one whose dialog never answered. Allow a minute from
 * asking for the dialog before a later print can give it up. A copy still loading has not asked
 * the printer for anything and can be cancelled immediately.
 */
const GIVE_UP_AFTER_MS = 60_000;

/** Pending print windows, their editor and when each asked for its native print dialog. */
const waiting = new Map();

/** Windows whose print was given up on, so that their closing reads as a cancellation. */
const givenUp = new WeakSet();

/**
 * Give up on an editor's copies still loading and native prints waiting beyond the grace period.
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
        if (print.owner !== owner) continue;
        if (print.printingSince !== null && now - print.printingSince < GIVE_UP_AFTER_MS) continue;
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

    // Printing again abandons copies still loading. Once the native dialog has been requested,
    // allow time for a recently confirmed copy to reach the printer before giving it up.
    giveUpPrints(owner, now());

    let win;
    let stopWatching = () => {};
    try {
        win = createWindow();
        const pending = { owner, printingSince: null };
        waiting.set(win, pending);
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
                    pending.printingSince = now();
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
