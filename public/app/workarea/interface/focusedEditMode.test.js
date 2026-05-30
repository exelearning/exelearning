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
        // Enabled by default in this suite so the enter/exit behaviour can be
        // exercised; the isEnabled describe block overrides the flag per test.
        window.eXeLearning = { config: { experimentalIdeviceFocusedEditMode: true } };
        mode = new FocusedEditMode(window.eXeLearning.app);
    });

    afterEach(() => {
        mode?.destroy();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        delete window.eXeLearning;
    });

    describe('isEnabled', () => {
        let originalLocalStorage;

        beforeEach(() => {
            // localStorage is not available in this test runner, so provide a
            // minimal in-memory stub for the opt-in cases.
            originalLocalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
            const store = {};
            Object.defineProperty(window, 'localStorage', {
                configurable: true,
                value: {
                    getItem: k => (k in store ? store[k] : null),
                    setItem: (k, v) => {
                        store[k] = String(v);
                    },
                    removeItem: k => {
                        delete store[k];
                    },
                },
            });
        });

        afterEach(() => {
            if (originalLocalStorage) {
                Object.defineProperty(window, 'localStorage', originalLocalStorage);
            } else {
                delete window.localStorage;
            }
        });

        it('is off by default when the flag is absent', () => {
            window.eXeLearning.config = {};
            expect(FocusedEditMode.isEnabled()).toBe(false);
        });

        it('is on when the config flag is explicitly true', () => {
            window.eXeLearning.config.experimentalIdeviceFocusedEditMode = true;
            expect(FocusedEditMode.isEnabled()).toBe(true);
        });

        it('is off when the config flag is explicitly false', () => {
            window.eXeLearning.config.experimentalIdeviceFocusedEditMode = false;
            expect(FocusedEditMode.isEnabled()).toBe(false);
        });

        it('can be opted in via localStorage when no config flag is set', () => {
            window.eXeLearning.config = {};
            window.localStorage.setItem('exe.experimentalIdeviceFocusedEditMode', '1');
            expect(FocusedEditMode.isEnabled()).toBe(true);
        });

        it('config flag takes precedence over localStorage opt-in', () => {
            window.eXeLearning.config.experimentalIdeviceFocusedEditMode = false;
            window.localStorage.setItem('exe.experimentalIdeviceFocusedEditMode', '1');
            expect(FocusedEditMode.isEnabled()).toBe(false);
        });
    });

    describe('init', () => {
        it('does nothing when disabled by config', async () => {
            window.eXeLearning.config.experimentalIdeviceFocusedEditMode = false;
            mode.init();
            expect(mode.observer).toBeNull();

            setEditing(true);
            await flushObserver();
            expect(document.body.classList.contains('exe-idevice-focus-editing')).toBe(false);
        });

        it('does nothing when #node-content is missing', () => {
            document.getElementById('node-content').remove();
            mode.init();
            expect(mode.observer).toBeNull();
        });

        it('starts observing when enabled', () => {
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

        it('disables global controls with aria-disabled and a title, not the disabled attribute', () => {
            const save = document.getElementById('head-top-save-button');
            save.setAttribute('disabled', 'disabled'); // emulate saveButton.js mid-save
            mode.enter(document.getElementById('idevice-1'));

            expect(save.getAttribute('aria-disabled')).toBe('true');
            expect(save.classList.contains('exe-disabled-during-focus')).toBe(true);
            // The module must never clear the disabled attribute it doesn't own.
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

        it('moves focus into the focused node when triggered from outside it', () => {
            const node = document.getElementById('idevice-1');
            document.getElementById('editIdevice-1').focus();
            // previousFocus (edit button) is inside the node -> focus is NOT stolen.
            mode.enter(node);
            expect(node.contains(document.activeElement)).toBe(true);
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
