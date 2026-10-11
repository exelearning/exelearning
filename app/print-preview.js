/**
 * Print a snapshot of the visible preview in a separate, hidden window. webContents.print reports
 * native failures and cancellation; window.print/beforeprint cannot report a missing print service.
 * Printing the editor's webContents instead would also print the surrounding application.
 */
async function printPreview(url, { createWindow }) {
    if (typeof url !== 'string' || !url.startsWith('blob:')) {
        return { success: false, canceled: false, error: 'Invalid print preview URL' };
    }

    let win;
    try {
        win = createWindow();
        await win.loadURL(url);
        // Stylesheets/images finish with loadURL; web fonts may still be settling.
        await win.webContents.executeJavaScript('document.fonts.ready.then(() => undefined)');
        return await new Promise((resolve, reject) => {
            const closed = () => reject(new Error('Print window closed'));
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
        return { success: false, canceled: false, error: error?.message || String(error) };
    } finally {
        if (win && !win.isDestroyed()) win.destroy();
    }
}

module.exports = { printPreview };
