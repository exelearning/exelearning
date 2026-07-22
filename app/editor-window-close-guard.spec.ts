import { describe, expect, it, mock } from 'bun:test';
import { EventEmitter } from 'events';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { attachEditorWindowCloseGuard, windowHasUnsavedChanges } = require('./editor-window-close-guard');

class FakeWindow extends EventEmitter {
    closeCalls = 0;

    close() {
        this.closeCalls++;
        this.emit('close', { preventDefault: mock(() => {}) });
    }
}

async function flushCloseGuard() {
    await Promise.resolve();
    await Promise.resolve();
}

describe('attachEditorWindowCloseGuard', () => {
    it('closes normally without opening the native dialog after a successful save', async () => {
        const win = new FakeWindow();
        const getCloseCopy = mock(async () => ({}));
        const confirmClose = mock(() => false);
        attachEditorWindowCloseGuard(win, {
            hasUnsavedChanges: mock(async () => false),
            getCloseCopy,
            confirmClose,
        });

        const event = { preventDefault: mock(() => {}) };
        win.emit('close', event);
        await flushCloseGuard();

        expect(event.preventDefault).toHaveBeenCalled();
        expect(getCloseCopy).not.toHaveBeenCalled();
        expect(confirmClose).not.toHaveBeenCalled();
        expect(win.closeCalls).toBe(1);
    });

    it('opens the native dialog and keeps the window open for unsaved state', async () => {
        const win = new FakeWindow();
        const confirmClose = mock(() => false);
        attachEditorWindowCloseGuard(win, {
            hasUnsavedChanges: mock(async () => true),
            getCloseCopy: mock(async () => ({ title: 'Unsaved changes' })),
            confirmClose,
            logger: { log: mock(() => {}) },
        });

        win.emit('close', { preventDefault: mock(() => {}) });
        await flushCloseGuard();

        expect(confirmClose).toHaveBeenCalled();
        expect(win.closeCalls).toBe(0);
    });

    it('closes after the user confirms discarding unsaved changes', async () => {
        const win = new FakeWindow();
        const confirmClose = mock(() => true);
        attachEditorWindowCloseGuard(win, {
            hasUnsavedChanges: mock(async () => true),
            getCloseCopy: mock(async () => ({ title: 'Unsaved changes' })),
            confirmClose,
            logger: { log: mock(() => {}) },
        });

        win.emit('close', { preventDefault: mock(() => {}) });
        await flushCloseGuard();

        expect(confirmClose).toHaveBeenCalled();
        expect(win.closeCalls).toBe(1);
    });

    it('does not intercept application shutdown', async () => {
        const win = new FakeWindow();
        const event = { preventDefault: mock(() => {}) };
        attachEditorWindowCloseGuard(win, {
            hasUnsavedChanges: mock(async () => true),
            getCloseCopy: mock(async () => ({})),
            confirmClose: mock(() => false),
            isShuttingDown: () => true,
        });

        win.emit('close', event);
        await flushCloseGuard();

        expect(event.preventDefault).not.toHaveBeenCalled();
    });
});

describe('windowHasUnsavedChanges', () => {
    function createWindow(rendererWindow: object) {
        return {
            isDestroyed: () => false,
            webContents: {
                isDestroyed: () => false,
                executeJavaScript: (script: string) => Function('window', `return ${script}`)(rendererWindow),
            },
        };
    }

    it('returns false when both document and asset save state are clean', async () => {
        const win = createWindow({
            eXeLearning: {
                app: {
                    project: {
                        _yjsBridge: {
                            documentManager: { isDirty: false },
                            assetManager: { hasUnsavedAssets: () => false },
                        },
                    },
                },
            },
        });

        expect(await windowHasUnsavedChanges(win)).toBe(false);
    });

    it('returns true while assets are genuinely pending', async () => {
        const win = createWindow({
            eXeLearning: {
                app: {
                    project: {
                        _yjsBridge: {
                            documentManager: { isDirty: false },
                            assetManager: { hasUnsavedAssets: () => true },
                        },
                    },
                },
            },
        });

        expect(await windowHasUnsavedChanges(win)).toBe(true);
    });

    it('returns false when the renderer is unavailable or state evaluation fails', async () => {
        expect(await windowHasUnsavedChanges(null)).toBe(false);
        expect(
            await windowHasUnsavedChanges({
                isDestroyed: () => false,
                webContents: {
                    isDestroyed: () => false,
                    executeJavaScript: () => Promise.reject(new Error('renderer unavailable')),
                },
            }),
        ).toBe(false);
    });
});
