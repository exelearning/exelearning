import FocusedEditMode from './focusedEditMode.js';

/**
 * Build a minimal but realistic workarea DOM:
 *   #node-content-container > #node-content > .box > .box-content > .idevice_node
 * plus the global header controls and the bottom quick toolbar.
 */
function buildDom() {
    document.body.innerHTML = `
        <header id="head">
            <button id="head-top-download-button" title="Download"></button>
            <button id="head-top-save-button" title="Save"></button>
            <button id="head-bottom-preview" title="Preview"></button>
            <button id="dropdownStyles"></button>
            <button id="head-top-settings-button"></button>
            <button id="head-top-share-button" title="Share"></button>
        </header>
        <div id="node-content-container" class="exe-content">
            <div id="node-content" mode="view">
                <article class="box idevice-element-in-content" id="block-1" mode="export">
                    <header class="box-head"></header>
                    <div class="box-content">
                        <div class="idevice_node idevice-element-in-content text" id="idevice-1" mode="export">
                            <div class="idevice_actions">
                                <button class="btn-edit-idevice" id="editIdevice-1">Edit</button>
                            </div>
                            <div class="idevice_body"></div>
                        </div>
                    </div>
                </article>
            </div>
        </div>
        <div id="idevices-bottom"></div>
    `;
}

/** Set the engine-managed mode attribute and a node's mode together. */
function setEditing(editing) {
    const nodeContent = document.getElementById('node-content');
    const node = document.getElementById('idevice-1');
    nodeContent.setAttribute('mode', editing ? 'edition' : 'view');
    node.setAttribute('mode', editing ? 'edition' : 'export');
}

/** Flush the MutationObserver microtask queue. */
function flushObserver() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('FocusedEditMode', () => {
    let mode;

    beforeEach(() => {
        globalThis._ = vi.fn((s) => s);
        // Run rAF callbacks synchronously so exit() restore is deterministic.
        vi.stubGlobal('requestAnimationFrame', (cb) => {
            cb();
            return 0;
        });
        buildDom();
        window.eXeLearning = { config: {} };
        mode = new FocusedEditMode(window.eXeLearning.app);
    });

    afterEach(() => {
        mode?.destroy();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        delete window.eXeLearning;
    });

    describe('init', () => {
        it('does nothing when #node-content is missing', () => {
            document.getElementById('node-content').remove();
            mode.init();
            expect(mode.observer).toBeNull();
        });

        it('always starts observing when #node-content is present', () => {
            mode.init();
            expect(mode.observer).not.toBeNull();
        });

        it('syncs immediately if an iDevice is already in edition at init', () => {
            setEditing(true);
            mode.init();
            expect(document.body.classList.contains('exe-idevice-focus-editing')).toBe(true);
        });
    });

    describe('entering focused edit mode', () => {
        beforeEach(() => mode.init());

        it('reacts to the mode attribute via the observer', async () => {
            setEditing(true);
            await flushObserver();
            expect(document.body.classList.contains('exe-idevice-focus-editing')).toBe(true);
            expect(
                document.getElementById('idevice-1').classList.contains('idevice-node--focused-editing')
            ).toBe(true);
        });

        it('marks global controls with a dim class + tooltip, never aria-disabled/disabled', () => {
            const save = document.getElementById('head-top-save-button');
            save.setAttribute('disabled', 'disabled'); // emulate saveButton.js mid-save
            mode.enter(document.getElementById('idevice-1'));

            expect(save.classList.contains('exe-disabled-during-focus')).toBe(true);
            // Must NOT block actionability: no aria-disabled, and never touch the
            // `disabled` attribute it does not own (kept here only as a fixture).
            expect(save.hasAttribute('aria-disabled')).toBe(false);
            expect(save.getAttribute('disabled')).toBe('disabled');
            expect(save.getAttribute('title')).toBe(
                'Save or discard the open iDevice before saving the project.'
            );
        });

        it('creates a polite live region and announces editing', () => {
            mode.enter(document.getElementById('idevice-1'));
            const region = document.getElementById('exe-focus-editing-live');
            expect(region).not.toBeNull();
            expect(region.getAttribute('aria-live')).toBe('polite');
            expect(region.textContent).toMatch(/Editing iDevice/);
        });

        it('saves the outer scroll position', () => {
            const container = document.getElementById('node-content-container');
            Object.defineProperty(container, 'scrollTop', { value: 250, writable: true });
            mode.enter(document.getElementById('idevice-1'));
            expect(mode.savedScrollTop).toBe(250);
        });

        it('pins the container to the top so the inset:0 overlay stays on-screen', () => {
            const container = document.getElementById('node-content-container');
            let scrollTop = 1500;
            Object.defineProperty(container, 'scrollTop', {
                get: () => scrollTop,
                set: (v) => {
                    scrollTop = v;
                },
            });
            mode.enter(document.getElementById('idevice-1'));
            // Saved for restore-on-exit, then reset to 0: a residual scroll would
            // otherwise push the absolutely-positioned focus overlay off-screen.
            expect(mode.savedScrollTop).toBe(1500);
            expect(scrollTop).toBe(0);
        });

        it('does not steal focus on enter (the editor manages its own focus)', () => {
            const editButton = document.getElementById('editIdevice-1');
            editButton.focus();
            mode.enter(document.getElementById('idevice-1'));
            // Focus is left where it was so TinyMCE init is not disrupted.
            expect(document.activeElement).toBe(editButton);
        });
    });

    describe('exiting focused edit mode', () => {
        beforeEach(() => mode.init());

        it('removes all focus-mode state and re-enables controls', async () => {
            setEditing(true);
            await flushObserver();
            setEditing(false);
            await flushObserver();

            expect(document.body.classList.contains('exe-idevice-focus-editing')).toBe(false);
            expect(
                document.getElementById('idevice-1').classList.contains('idevice-node--focused-editing')
            ).toBe(false);
            const save = document.getElementById('head-top-save-button');
            expect(save.hasAttribute('aria-disabled')).toBe(false);
            expect(save.classList.contains('exe-disabled-during-focus')).toBe(false);
        });

        it('restores the original control titles', () => {
            const save = document.getElementById('head-top-save-button');
            mode.enter(document.getElementById('idevice-1'));
            expect(save.getAttribute('title')).not.toBe('Save');
            mode.exit(document.getElementById('idevice-1'));
            expect(save.getAttribute('title')).toBe('Save');
        });

        it('announces that editing finished', () => {
            mode.enter(document.getElementById('idevice-1'));
            mode.exit(document.getElementById('idevice-1'));
            expect(document.getElementById('exe-focus-editing-live').textContent).toMatch(
                /Finished editing/
            );
        });

        it('restores focus to the edit button', () => {
            const node = document.getElementById('idevice-1');
            mode.enter(node);
            mode.exit(node); // rAF stubbed to run synchronously
            expect(document.activeElement).toBe(document.getElementById('editIdevice-1'));
        });

        it('restores the saved outer scroll position', () => {
            const container = document.getElementById('node-content-container');
            let scrollTop = 0;
            Object.defineProperty(container, 'scrollTop', {
                get: () => scrollTop,
                set: (v) => {
                    scrollTop = v;
                },
            });
            scrollTop = 300;
            mode.enter(document.getElementById('idevice-1'));
            scrollTop = 0; // engine reset; module restores when still 0
            mode.exit(document.getElementById('idevice-1'));
            expect(scrollTop).toBe(300);
        });
    });

    describe('stale TinyMCE fullscreen cleanup', () => {
        beforeEach(() => mode.init());

        afterEach(() => {
            document.documentElement.classList.remove('tox-fullscreen');
            document.body.classList.remove('tox-fullscreen');
        });

        it('strips a stale tox-fullscreen class from <html>/<body> on enter', () => {
            // Saving an iDevice from TinyMCE fullscreen destroys the editor before
            // its fullscreen teardown runs, leaving the document-level class behind.
            document.documentElement.classList.add('tox-fullscreen');
            document.body.classList.add('tox-fullscreen');
            mode.enter(document.getElementById('idevice-1'));
            expect(document.documentElement.classList.contains('tox-fullscreen')).toBe(false);
            expect(document.body.classList.contains('tox-fullscreen')).toBe(false);
        });

        it('strips a stale tox-fullscreen class on exit', () => {
            mode.enter(document.getElementById('idevice-1'));
            document.documentElement.classList.add('tox-fullscreen');
            document.body.classList.add('tox-fullscreen');
            mode.exit(document.getElementById('idevice-1'));
            expect(document.documentElement.classList.contains('tox-fullscreen')).toBe(false);
            expect(document.body.classList.contains('tox-fullscreen')).toBe(false);
        });

        it('never strips the class while an editor is genuinely in fullscreen', () => {
            // A live fullscreen editor keeps tox-fullscreen on its own .tox-tinymce
            // element; that is the signal we must not interfere with.
            const editor = document.createElement('div');
            editor.className = 'tox tox-tinymce tox-fullscreen';
            document.body.appendChild(editor);
            document.documentElement.classList.add('tox-fullscreen');
            document.body.classList.add('tox-fullscreen');
            mode.enter(document.getElementById('idevice-1'));
            expect(document.documentElement.classList.contains('tox-fullscreen')).toBe(true);
            expect(document.body.classList.contains('tox-fullscreen')).toBe(true);
            editor.remove();
        });
    });

    describe('idempotency and teardown', () => {
        beforeEach(() => mode.init());

        it('enters only once across redundant edition mutations', async () => {
            const enterSpy = vi.spyOn(mode, 'enter');
            setEditing(true);
            await flushObserver();
            // Redundant re-write of the same attribute value.
            document.getElementById('node-content').setAttribute('mode', 'edition');
            await flushObserver();
            expect(enterSpy).toHaveBeenCalledTimes(1);
        });

        it('does not allow two iDevices to be focused at once', async () => {
            setEditing(true);
            await flushObserver();
            const focused = document.querySelectorAll('.idevice-node--focused-editing');
            expect(focused.length).toBe(1);
        });

        it('destroy() disconnects the observer', async () => {
            mode.destroy();
            setEditing(true);
            await flushObserver();
            expect(document.body.classList.contains('exe-idevice-focus-editing')).toBe(false);
        });
    });
});
