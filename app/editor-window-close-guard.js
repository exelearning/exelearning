const windowsClosingByConfirmation = new WeakSet();
const windowsCheckingUnsavedChanges = new WeakSet();

async function windowHasUnsavedChanges(win) {
    if (!win || win.isDestroyed() || !win.webContents || win.webContents.isDestroyed()) {
        return false;
    }

    try {
        return await win.webContents.executeJavaScript(
            `(() => {
                const bridge = window.eXeLearning?.app?.project?._yjsBridge;
                const documentManager = bridge?.documentManager;
                const assetManager = bridge?.assetManager;
                const hasUnsavedAssets =
                    assetManager &&
                    typeof assetManager.hasUnsavedAssets === 'function' &&
                    assetManager.hasUnsavedAssets();
                return documentManager?.isDirty === true || Boolean(hasUnsavedAssets);
            })()`,
            true,
        );
    } catch (error) {
        console.warn('[Electron] Failed to read unsaved changes state from renderer:', error);
        return false;
    }
}

function attachEditorWindowCloseGuard(win, dependencies) {
    const {
        hasUnsavedChanges,
        getCloseCopy,
        confirmClose,
        isShuttingDown = () => false,
        logger = console,
    } = dependencies;

    win.on('close', async (event) => {
        if (isShuttingDown() || windowsClosingByConfirmation.has(win)) return;
        if (windowsCheckingUnsavedChanges.has(win)) {
            event.preventDefault();
            return;
        }

        event.preventDefault();
        windowsCheckingUnsavedChanges.add(win);

        try {
            if (!(await hasUnsavedChanges(win))) {
                windowsClosingByConfirmation.add(win);
                win.close();
                return;
            }

            const copy = await getCloseCopy(win);
            if (!confirmClose(win, copy)) {
                logger.log('[Electron] Close cancelled: unsaved changes');
                return;
            }

            logger.log('[Electron] User confirmed closing with unsaved changes');
            windowsClosingByConfirmation.add(win);
            win.close();
        } finally {
            windowsCheckingUnsavedChanges.delete(win);
        }
    });

    win.on('closed', () => {
        windowsClosingByConfirmation.delete(win);
        windowsCheckingUnsavedChanges.delete(win);
    });
}

module.exports = { attachEditorWindowCloseGuard, windowHasUnsavedChanges };
