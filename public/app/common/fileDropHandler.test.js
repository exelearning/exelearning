/**
 * @vitest-environment happy-dom
 */

import FileDropHandler, { isOpenableProjectFile } from './fileDropHandler.js';

/**
 * Build a minimal fake App with spies for the three open paths.
 */
function makeApp(overrides = {}) {
    return {
        capabilities: { embedded: { enabled: false } },
        runtimeConfig: { isStaticMode: () => false },
        openFileFromPath: vi.fn(),
        openStaticFile: vi.fn(),
        modals: {
            openuserodefiles: { largeFilesUpload: vi.fn() },
            alert: { show: vi.fn() },
        },
        ...overrides,
    };
}

/**
 * Build a fake DragEvent carrying files (or not).
 */
function makeDragEvent({ files = [], hasFiles = true } = {}) {
    return {
        preventDefault: vi.fn(),
        dataTransfer: {
            types: hasFiles ? ['Files'] : ['text/plain'],
            files,
            dropEffect: '',
        },
    };
}

afterEach(() => {
    delete window.electronAPI;
});

describe('isOpenableProjectFile', () => {
    it('accepts .elpx and .elp regardless of case', () => {
        expect(isOpenableProjectFile('project.elpx')).toBe(true);
        expect(isOpenableProjectFile('project.elp')).toBe(true);
        expect(isOpenableProjectFile('PROJECT.ELPX')).toBe(true);
    });

    it('rejects other extensions and non-strings', () => {
        expect(isOpenableProjectFile('project.zip')).toBe(false);
        expect(isOpenableProjectFile('project.pdf')).toBe(false);
        expect(isOpenableProjectFile('elpx')).toBe(false);
        expect(isOpenableProjectFile(null)).toBe(false);
        expect(isOpenableProjectFile(undefined)).toBe(false);
        expect(isOpenableProjectFile(42)).toBe(false);
    });
});

describe('FileDropHandler.bind/unbind', () => {
    it('attaches the four drag listeners in the capture phase', () => {
        const target = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
        const handler = new FileDropHandler({ app: makeApp(), target });
        handler.bind();
        expect(target.addEventListener).toHaveBeenCalledTimes(4);
        const events = target.addEventListener.mock.calls.map((c) => c[0]);
        expect(events).toEqual(
            expect.arrayContaining(['dragenter', 'dragover', 'dragleave', 'drop'])
        );
        // Every listener must use capture (third arg true) so it runs before
        // descendant handlers that stopPropagation().
        for (const call of target.addEventListener.mock.calls) {
            expect(call[2]).toBe(true);
        }
    });

    it('is idempotent', () => {
        const target = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
        const handler = new FileDropHandler({ app: makeApp(), target });
        handler.bind();
        handler.bind();
        expect(target.addEventListener).toHaveBeenCalledTimes(4);
    });

    it('does nothing in embedded mode', () => {
        const target = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
        const app = makeApp({ capabilities: { embedded: { enabled: true } } });
        const handler = new FileDropHandler({ app, target });
        handler.bind();
        expect(target.addEventListener).not.toHaveBeenCalled();
    });

    it('unbind removes listeners and is a no-op when not bound', () => {
        const target = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
        const handler = new FileDropHandler({ app: makeApp(), target });
        handler.unbind();
        expect(target.removeEventListener).not.toHaveBeenCalled();
        handler.bind();
        handler.unbind();
        expect(target.removeEventListener).toHaveBeenCalledTimes(4);
    });

    it('defaults the target to window', () => {
        const handler = new FileDropHandler({ app: makeApp() });
        expect(handler.target).toBe(window);
    });
});

describe('FileDropHandler drag events', () => {
    it('shows the overlay on dragenter with files and hides on dragleave', () => {
        const handler = new FileDropHandler({ app: makeApp() });
        const enter = makeDragEvent();
        handler._onDragEnter(enter);
        expect(enter.preventDefault).toHaveBeenCalled();
        expect(document.querySelector('.exe-file-drop-overlay')).toBeTruthy();

        handler._onDragLeave(makeDragEvent());
        expect(document.querySelector('.exe-file-drop-overlay')).toBeFalsy();
    });

    it('ignores non-file drags', () => {
        const handler = new FileDropHandler({ app: makeApp() });
        const enter = makeDragEvent({ hasFiles: false });
        handler._onDragEnter(enter);
        expect(enter.preventDefault).not.toHaveBeenCalled();
        expect(document.querySelector('.exe-file-drop-overlay')).toBeFalsy();
    });

    it('sets dropEffect to copy on dragover', () => {
        const handler = new FileDropHandler({ app: makeApp() });
        const over = makeDragEvent();
        handler._onDragOver(over);
        expect(over.preventDefault).toHaveBeenCalled();
        expect(over.dataTransfer.dropEffect).toBe('copy');
    });

    it('keeps the overlay until the last nested dragleave', () => {
        const handler = new FileDropHandler({ app: makeApp() });
        handler._onDragEnter(makeDragEvent());
        handler._onDragEnter(makeDragEvent());
        handler._onDragLeave(makeDragEvent());
        expect(document.querySelector('.exe-file-drop-overlay')).toBeTruthy();
        handler._onDragLeave(makeDragEvent());
        expect(document.querySelector('.exe-file-drop-overlay')).toBeFalsy();
    });

    it('opens the dropped file and hides the overlay', () => {
        const app = makeApp();
        const handler = new FileDropHandler({ app });
        handler._onDragEnter(makeDragEvent());
        const file = { name: 'demo.elpx' };
        const drop = makeDragEvent({ files: [file] });
        handler._onDrop(drop);
        expect(drop.preventDefault).toHaveBeenCalled();
        expect(document.querySelector('.exe-file-drop-overlay')).toBeFalsy();
        expect(app.modals.openuserodefiles.largeFilesUpload).toHaveBeenCalledWith(file);
    });

    it('cancels the native open but defers to an open modal (e.g. File Manager)', () => {
        const modal = document.createElement('div');
        modal.className = 'modal show';
        const inner = document.createElement('div');
        modal.appendChild(inner);
        document.body.appendChild(modal);

        const app = makeApp();
        const handler = new FileDropHandler({ app });

        const enter = makeDragEvent();
        enter.target = inner;
        handler._onDragEnter(enter);
        // No overlay over a modal, but the native open is still prevented.
        expect(enter.preventDefault).toHaveBeenCalled();
        expect(document.querySelector('.exe-file-drop-overlay')).toBeFalsy();

        const drop = makeDragEvent({ files: [{ name: 'demo.elpx' }] });
        drop.target = inner;
        handler._onDrop(drop);
        expect(drop.preventDefault).toHaveBeenCalled();
        expect(app.modals.openuserodefiles.largeFilesUpload).not.toHaveBeenCalled();
    });
});

describe('FileDropHandler.handleFiles', () => {
    it('does nothing when no file is present', () => {
        const app = makeApp();
        const handler = new FileDropHandler({ app });
        handler.handleFiles([]);
        handler.handleFiles(undefined);
        expect(app.modals.openuserodefiles.largeFilesUpload).not.toHaveBeenCalled();
    });

    it('alerts on an unsupported file type', () => {
        const app = makeApp();
        const handler = new FileDropHandler({ app });
        handler.handleFiles([{ name: 'photo.png' }]);
        expect(app.modals.alert.show).toHaveBeenCalled();
        expect(app.modals.openuserodefiles.largeFilesUpload).not.toHaveBeenCalled();
    });
});

describe('FileDropHandler.openFile routing', () => {
    it('routes through Electron when a path is available', () => {
        window.electronAPI = {};
        const app = makeApp();
        const handler = new FileDropHandler({ app });
        const file = { name: 'demo.elpx', path: '/tmp/demo.elpx' };
        handler.openFile(file);
        expect(app.openFileFromPath).toHaveBeenCalledWith('/tmp/demo.elpx');
        expect(app.modals.openuserodefiles.largeFilesUpload).not.toHaveBeenCalled();
    });

    it('routes through openStaticFile in static mode', () => {
        const app = makeApp({ runtimeConfig: { isStaticMode: () => true } });
        const handler = new FileDropHandler({ app });
        const file = { name: 'demo.elpx' };
        handler.openFile(file);
        expect(app.openStaticFile).toHaveBeenCalledWith(file);
        expect(app.modals.openuserodefiles.largeFilesUpload).not.toHaveBeenCalled();
    });

    it('routes through largeFilesUpload online', () => {
        const app = makeApp();
        const handler = new FileDropHandler({ app });
        const file = { name: 'demo.elpx' };
        handler.openFile(file);
        expect(app.modals.openuserodefiles.largeFilesUpload).toHaveBeenCalledWith(file);
    });

    it('does nothing without an app', () => {
        const handler = new FileDropHandler({ app: null });
        expect(() => handler.openFile({ name: 'demo.elpx' })).not.toThrow();
    });
});
