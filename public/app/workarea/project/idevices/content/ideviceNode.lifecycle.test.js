/**
 * IdeviceNode edition teardown tests (#2293).
 *
 * These cover the centralized teardown that every path closing an editor goes
 * through, and in particular the ordering guarantee that makes it correct: the
 * edition is disposed while its instance and its DOM are still available, and
 * the global `$exeDevice` is released only afterwards.
 */

/* eslint-disable no-undef */

// Setup global mocks BEFORE importing the module (ES6 imports are hoisted, so
// the vitest.setup.js mocks are already in place; this only extends them).
global.eXeLearning = {
    app: {
        api: {
            parameters: {
                odeComponentsSyncPropertiesConfig: {
                    visibility: { value: 'false' },
                    cssClass: { value: '' },
                },
            },
            putSaveComponent: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
        },
        project: {
            _yjsEnabled: false,
            _yjsBridge: null,
            structure: {
                getSelectNodeNavId: vi.fn(() => 'nav-id-1'),
                getSelectNodePageId: vi.fn(() => 'page-id-1'),
                getAllNodesOrderByView: vi.fn(() => []),
            },
        },
        idevices: {
            getIdeviceInstalled: vi.fn(() => ({
                name: 'text',
                title: 'Text',
                cssClass: 'text',
                edition: true,
            })),
            setIdeviceActive: vi.fn(),
        },
        modals: {
            alert: { show: vi.fn(), modal: { _isShown: false } },
            confirm: { show: vi.fn(), modal: { _isShown: false } },
        },
        menus: { menuStructure: { menuStructureBehaviour: { checkIfEmptyNode: vi.fn() } } },
        common: { initTooltips: vi.fn() },
    },
    config: { isOfflineInstallation: false },
};

import IdeviceNode from './ideviceNode.js';
import EditionLifecycle, {
    getActiveEditionLifecycle,
    setActiveEditionLifecycle,
} from './editionLifecycle.js';

describe('IdeviceNode edition teardown (#2293)', () => {
    let idevice;
    let mockEngine;

    /**
     * Put a node into the state `initExeDeviceEdition()` leaves behind: an
     * edition form in the DOM and a live lifecycle owned by the device.
     *
     * @param {Object} device
     * @returns {EditionLifecycle}
     */
    function openEdition(node, device) {
        node.ideviceBody = document.createElement('div');
        node.ideviceBody.innerHTML = '<button id="edition-button">go</button>';
        document.body.appendChild(node.ideviceBody);

        const lifecycle = new EditionLifecycle({
            device,
            name: 'text',
            formElement: node.ideviceBody,
            ownerNode: node,
        });
        setActiveEditionLifecycle(lifecycle);
        device.$lifecycle = lifecycle;
        global.$exeDevice = device;
        return lifecycle;
    }

    beforeEach(() => {
        vi.clearAllMocks();
        setActiveEditionLifecycle(null);
        global.$exeDevice = undefined;

        mockEngine = {
            generateId: vi.fn(() => 'engine-id-1'),
            clientCallWaitingTime: 5000,
            nodeContentElement: document.createElement('div'),
            components: { blocks: [], idevices: [] },
            getBlockById: vi.fn(),
            removeIdeviceOfComponentList: vi.fn(),
            updateMode: vi.fn(),
            project: { _yjsBridge: null },
        };

        document.body.innerHTML = `
            <div id="node-content-container"><div id="node-content"></div></div>
        `;

        idevice = new IdeviceNode(mockEngine, {
            id: 'idevice-1',
            odeIdeviceId: 'idevice-id-1',
            odeIdeviceTypeName: 'text',
            blockId: 'block-1',
            mode: 'export',
        });
    });

    afterEach(() => {
        setActiveEditionLifecycle(null);
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    /*******************************************************************************
     * ORDERING
     *******************************************************************************/

    describe('teardown ordering', () => {
        it('disposes the edition before the global is cleared', () => {
            const seen = [];
            const device = {
                destroyEdition() {
                    // The whole point: the hook still sees its own instance and
                    // the global still points at it.
                    seen.push({ self: this, global: global.$exeDevice });
                },
            };
            openEdition(idevice, device);

            idevice.destroyEditionInstance();

            expect(seen).toHaveLength(1);
            expect(seen[0].self).toBe(device);
            expect(seen[0].global).toBe(device);
            expect(global.$exeDevice).toBeUndefined();
        });

        /**
         * The form keeps its content — blanking it would leave the iDevice
         * empty on screen for as long as the export view takes to load — but
         * nothing bound inside it may still fire.
         */
        it('unbinds the edition form without blanking it', () => {
            const device = {};
            openEdition(idevice, device);
            const form = idevice.ideviceBody;
            const viaLifecycle = vi.fn();
            const viaPlainJQuery = vi.fn();
            device.$lifecycle.on('#edition-button', 'click', viaLifecycle);
            // A handler the edition bound directly, without the lifecycle:
            // this is the case the form teardown exists for.
            $('#edition-button').on('click', viaPlainJQuery);

            idevice.destroyEditionInstance();
            $('#edition-button').trigger('click');

            expect(form.isConnected).toBe(true);
            expect(form.innerHTML).not.toBe('');
            expect(viaLifecycle).not.toHaveBeenCalled();
            expect(viaPlainJQuery).not.toHaveBeenCalled();
        });

        it('releases the active lifecycle registration', () => {
            openEdition(idevice, {});
            expect(getActiveEditionLifecycle()).not.toBeNull();

            idevice.destroyEditionInstance();

            expect(getActiveEditionLifecycle()).toBeNull();
            expect(window.$exeEditionLifecycle).toBeNull();
        });

        it('stops the initialization poll so a half-loaded editor cannot finish', () => {
            vi.useFakeTimers();
            const device = {};
            openEdition(idevice, device);
            idevice.ideviceInitEditionLoadSuccess = vi.fn();
            idevice.checkDeviceLoadInterval = setInterval(
                () => idevice.ideviceInitEditionLoadSuccess(),
                100
            );

            idevice.destroyEditionInstance();
            vi.advanceTimersByTime(1000);

            expect(idevice.ideviceInitEditionLoadSuccess).not.toHaveBeenCalled();
            expect(idevice.checkDeviceLoadInterval).toBeNull();
        });
    });

    /*******************************************************************************
     * IDEMPOTENCY AND ROBUSTNESS
     *******************************************************************************/

    describe('idempotency', () => {
        it('disposes owned resources exactly once across repeated teardown', () => {
            const disposer = vi.fn();
            const device = { destroyEdition: vi.fn() };
            openEdition(idevice, device);
            device.$lifecycle.own(disposer);

            idevice.destroyEditionInstance();
            idevice.destroyEditionInstance();
            idevice.destroyEditionInstance();

            expect(disposer).toHaveBeenCalledTimes(1);
            expect(device.destroyEdition).toHaveBeenCalledTimes(1);
        });

        it('is safe when no edition was ever opened', () => {
            expect(() => idevice.destroyEditionInstance()).not.toThrow();
            expect(global.$exeDevice).toBeUndefined();
        });

        it('is safe when initialization never completed', () => {
            // `initExeDeviceEdition()` never ran, so there is no form and no
            // lifecycle, but the global was already set by the loaded script.
            global.$exeDevice = { init: vi.fn() };

            expect(() => idevice.destroyEditionInstance()).not.toThrow();
            expect(global.$exeDevice).toBeUndefined();
        });

        it('still clears the global when a disposer throws', () => {
            const device = {};
            openEdition(idevice, device);
            device.$lifecycle.own(() => {
                throw new Error('cleanup exploded');
            });

            expect(() => idevice.destroyEditionInstance()).not.toThrow();
            expect(global.$exeDevice).toBeUndefined();
            expect(getActiveEditionLifecycle()).toBeNull();
        });

        it('still clears the global when the destroy hook throws', () => {
            const device = {
                destroyEdition() {
                    throw new Error('hook exploded');
                },
            };
            openEdition(idevice, device);

            expect(() => idevice.destroyEditionInstance()).not.toThrow();
            expect(global.$exeDevice).toBeUndefined();
        });
    });

    /*******************************************************************************
     * THE CALL PATHS THAT CLOSE AN EDITOR
     *******************************************************************************/

    describe('close paths', () => {
        it('restartExeIdeviceValue() tears the edition down', () => {
            const device = { destroyEdition: vi.fn() };
            openEdition(idevice, device);

            idevice.restartExeIdeviceValue();

            expect(device.destroyEdition).toHaveBeenCalledTimes(1);
            expect(global.$exeDevice).toBeUndefined();
        });

        /**
         * A synchronized reload deliberately keeps the open editor alive; the
         * flag is consumed once and the edition must survive intact.
         */
        it('restartExeIdeviceValue() preserves a synchronized edition', () => {
            const device = { destroyEdition: vi.fn() };
            openEdition(idevice, device);
            idevice.isSync = true;

            idevice.restartExeIdeviceValue();

            expect(device.destroyEdition).not.toHaveBeenCalled();
            expect(global.$exeDevice).toBe(device);
            expect(device.$lifecycle.isActive()).toBe(true);
            expect(idevice.isSync).toBe(false);
        });

        it('loadEditionIdevice() disposes an editor left open before loading the next', async () => {
            const device = { destroyEdition: vi.fn() };
            openEdition(idevice, device);
            idevice.loadScriptsEdition = vi.fn();
            idevice.loadStylesEdition = vi.fn().mockResolvedValue([]);
            idevice.clearFilesElements = vi.fn();

            await idevice.loadEditionIdevice();

            expect(device.destroyEdition).toHaveBeenCalledTimes(1);
            expect(global.$exeDevice).toBeUndefined();
        });

        it('remove() tears the edition down while in edition mode', () => {
            const device = { destroyEdition: vi.fn() };
            openEdition(idevice, device);
            idevice.mode = 'edition';
            idevice.ideviceContent = document.createElement('div');
            document.body.appendChild(idevice.ideviceContent);
            idevice.releaseYjsEditingLock = vi.fn();
            idevice.clearFilesElements = vi.fn();
            idevice.removeBlockParentProcess = vi.fn();

            idevice.remove(false);

            expect(device.destroyEdition).toHaveBeenCalledTimes(1);
            expect(global.$exeDevice).toBeUndefined();
        });

        /**
         * A collaborative sync renders a remote iDevice through the export
         * path while a different iDevice is open locally. That node does not
         * own the editor, so it must not dismantle it — doing so would leave
         * the user with a visually intact but dead form.
         */
        it('restartExeIdeviceValue() does not dispose an editor owned by another node', () => {
            const device = { destroyEdition: vi.fn() };
            const owner = new IdeviceNode(mockEngine, {
                id: 'idevice-owner',
                odeIdeviceId: 'idevice-id-owner',
                odeIdeviceTypeName: 'text',
                blockId: 'block-1',
                mode: 'edition',
            });
            openEdition(owner, device);

            // A different node reaches the export path.
            idevice.restartExeIdeviceValue();

            expect(device.destroyEdition).not.toHaveBeenCalled();
            expect(device.$lifecycle.isActive()).toBe(true);
            expect(getActiveEditionLifecycle()).toBe(device.$lifecycle);

            owner.destroyEditionInstance();
        });

        /**
         * Clearing the global belongs to whoever owns the edition. A remote
         * iDevice rendering through the export path used to strand the local
         * editor with `$exeDevice` undefined while its form stayed on screen.
         */
        it('restartExeIdeviceValue() leaves the global alone when another node owns the editor', () => {
            const device = {};
            const owner = new IdeviceNode(mockEngine, {
                id: 'idevice-owner',
                odeIdeviceId: 'idevice-id-owner',
                odeIdeviceTypeName: 'text',
                blockId: 'block-1',
                mode: 'edition',
            });
            openEdition(owner, device);

            idevice.restartExeIdeviceValue();

            expect(global.$exeDevice).toBe(device);

            owner.destroyEditionInstance();
            expect(global.$exeDevice).toBeUndefined();
        });

        it('still clears the global for a node whose edition never initialized', () => {
            // The edition script defined the global, but `initExeDeviceEdition()`
            // never ran, so there is no lifecycle to own it.
            global.$exeDevice = { init: vi.fn() };

            idevice.restartExeIdeviceValue();

            expect(global.$exeDevice).toBeUndefined();
        });

        it('disposes another node\'s edition before loading its own', async () => {
            const device = {};
            const owner = new IdeviceNode(mockEngine, {
                id: 'idevice-owner',
                odeIdeviceId: 'idevice-id-owner',
                odeIdeviceTypeName: 'text',
                blockId: 'block-1',
                mode: 'edition',
            });
            const ownerLifecycle = openEdition(owner, device);

            idevice.loadScriptsEdition = vi.fn();
            idevice.loadStylesEdition = vi.fn().mockResolvedValue([]);
            idevice.clearFilesElements = vi.fn();

            await idevice.loadEditionIdevice();

            expect(ownerLifecycle.isDestroyed()).toBe(true);
            expect(getActiveEditionLifecycle()).toBeNull();
        });

        it('leaves another node\'s live editor alone, and its global with it', () => {
            // A node that owns no edition must not strand the open one: this is
            // the collaborative-sync path, where a remote iDevice re-renders
            // while a different one is being edited locally.
            const device = { name: 'owner-device' };
            const owner = new IdeviceNode(mockEngine, {
                id: 'idevice-owner',
                odeIdeviceId: 'idevice-id-owner',
                odeIdeviceTypeName: 'text',
                blockId: 'block-1',
                mode: 'edition',
            });
            const ownerLifecycle = openEdition(owner, device);

            idevice.destroyEditionInstance();

            expect(ownerLifecycle.isDestroyed()).toBe(false);
            expect(getActiveEditionLifecycle()).toBe(ownerLifecycle);
            expect(global.$exeDevice).toBe(device);
        });

        it('loadEditionIdevice() does dispose an editor owned by another node', async () => {
            const device = { destroyEdition: vi.fn() };
            const owner = new IdeviceNode(mockEngine, {
                id: 'idevice-owner',
                odeIdeviceId: 'idevice-id-owner',
                odeIdeviceTypeName: 'text',
                blockId: 'block-1',
                mode: 'edition',
            });
            openEdition(owner, device);

            idevice.loadScriptsEdition = vi.fn();
            idevice.loadStylesEdition = vi.fn().mockResolvedValue([]);
            idevice.clearFilesElements = vi.fn();

            await idevice.loadEditionIdevice();

            expect(device.destroyEdition).toHaveBeenCalledTimes(1);
            expect(getActiveEditionLifecycle()).toBeNull();
        });

        it('remove() leaves an export-mode node alone', () => {
            const device = { destroyEdition: vi.fn() };
            openEdition(idevice, device);
            idevice.mode = 'export';
            idevice.ideviceContent = document.createElement('div');
            document.body.appendChild(idevice.ideviceContent);
            idevice.clearFilesElements = vi.fn();
            idevice.removeBlockParentProcess = vi.fn();

            idevice.remove(false);

            expect(device.destroyEdition).not.toHaveBeenCalled();
        });
    });

    /*******************************************************************************
     * THE #2293 REGRESSION
     *******************************************************************************/

    describe('stale callbacks across editions', () => {
        /**
         * The bug behind #2293: a handler left by edition A resolves the global
         * `$exeDevice` when it finally fires. Optional chaining does not help,
         * because by then the global holds a perfectly valid *different* device.
         */
        it('cannot let a handler from edition A drive edition B', () => {
            const deviceA = { touched: 0, touch() { this.touched++; } };
            openEdition(idevice, deviceA);
            deviceA.$lifecycle.on('#edition-button', 'click', function () {
                this.touch();
            });
            const button = document.getElementById('edition-button');

            $(button).trigger('click');
            expect(deviceA.touched).toBe(1);

            // Close A, then open B on another node.
            idevice.destroyEditionInstance();

            const deviceB = { touched: 0, touch() { this.touched++; } };
            const other = new IdeviceNode(mockEngine, {
                id: 'idevice-2',
                odeIdeviceId: 'idevice-id-2',
                odeIdeviceTypeName: 'text',
                blockId: 'block-1',
                mode: 'export',
            });
            openEdition(other, deviceB);

            // The stale button is gone with the form, but even re-attached and
            // fired it must reach neither instance.
            document.body.appendChild(button);
            expect(() => $(button).trigger('click')).not.toThrow();

            expect(deviceA.touched).toBe(1);
            expect(deviceB.touched).toBe(0);

            other.destroyEditionInstance();
        });

        it('cannot let a timer from edition A run against edition B', () => {
            vi.useFakeTimers();
            const deviceA = { ticks: 0, tick() { this.ticks++; } };
            openEdition(idevice, deviceA);
            deviceA.$lifecycle.setTimeout(function () {
                this.tick();
            }, 1000);

            idevice.destroyEditionInstance();

            const deviceB = { ticks: 0, tick() { this.ticks++; } };
            openEdition(idevice, deviceB);

            vi.advanceTimersByTime(5000);

            expect(deviceA.ticks).toBe(0);
            expect(deviceB.ticks).toBe(0);

            idevice.destroyEditionInstance();
        });

        it('removes document-level handlers owned by the closed edition only', () => {
            const device = {};
            openEdition(idevice, device);
            const mine = vi.fn();
            const unrelated = vi.fn();
            $(document).on('click', unrelated);
            device.$lifecycle.on(document, 'click', mine);

            idevice.destroyEditionInstance();
            $(document).trigger('click');

            expect(mine).not.toHaveBeenCalled();
            expect(unrelated).toHaveBeenCalledTimes(1);

            $(document).off('click', unrelated);
        });
    });

    /*******************************************************************************
     * TINYMCE
     *******************************************************************************/

    describe('removeEditionEditors()', () => {
        it('removes only the editors whose target lives in the edition form', () => {
            const inForm = { getElement: () => form.firstChild, remove: vi.fn() };
            const outsideForm = { getElement: () => document.body, remove: vi.fn() };
            const form = document.createElement('div');
            form.innerHTML = '<textarea></textarea>';
            document.body.appendChild(form);

            const original = tinymce.editors;
            tinymce.editors = [inForm, outsideForm];
            try {
                idevice.removeEditionEditors(form);
            } finally {
                tinymce.editors = original;
            }

            expect(inForm.remove).toHaveBeenCalledTimes(1);
            expect(outsideForm.remove).not.toHaveBeenCalled();
        });

        it('keeps going when one editor fails to remove', () => {
            const failing = {
                getElement: () => null,
                remove: vi.fn(() => {
                    throw new Error('tinymce exploded');
                }),
            };
            const healthy = { getElement: () => null, remove: vi.fn() };

            const original = tinymce.editors;
            tinymce.editors = [failing, healthy];
            try {
                expect(() => idevice.removeEditionEditors(null)).not.toThrow();
            } finally {
                tinymce.editors = original;
            }

            expect(healthy.remove).toHaveBeenCalledTimes(1);
        });

        it('does nothing when TinyMCE is not loaded', () => {
            const original = tinymce.editors;
            tinymce.editors = undefined;
            try {
                expect(() => idevice.removeEditionEditors(document.createElement('div'))).not.toThrow();
            } finally {
                tinymce.editors = original;
            }
        });
    });

    describe('clearEditionFormHandlers()', () => {
        it('unbinds the form in place without emptying it', () => {
            const form = document.createElement('div');
            form.innerHTML = '<button id="bound">go</button>';
            document.body.appendChild(form);
            const spy = vi.fn();
            window.jQuery('#bound', form).on('click', spy);

            idevice.clearEditionFormHandlers(form);

            window.jQuery('#bound', form).trigger('click');
            expect(spy).not.toHaveBeenCalled();
            // The content stays visible until the caller has a replacement.
            expect(form.querySelector('#bound')).not.toBeNull();
        });

        it('ignores a missing form or a page without jQuery', () => {
            const jq = window.jQuery;
            expect(() => idevice.clearEditionFormHandlers(null)).not.toThrow();
            window.jQuery = undefined;
            try {
                expect(() => idevice.clearEditionFormHandlers(document.createElement('div'))).not.toThrow();
            } finally {
                window.jQuery = jq;
            }
        });

        it('falls back to emptying the form when jQuery exposes no cleanData', () => {
            const form = document.createElement('div');
            form.innerHTML = '<button>go</button>';
            const empty = vi.fn();
            const jq = window.jQuery;
            window.jQuery = Object.assign(() => ({ empty }), {});
            try {
                idevice.clearEditionFormHandlers(form);
            } finally {
                window.jQuery = jq;
            }

            expect(empty).toHaveBeenCalledTimes(1);
        });

        it('reports a failing cleanup instead of aborting teardown', () => {
            const jq = window.jQuery;
            window.jQuery = Object.assign(
                () => {
                    throw new Error('jquery exploded');
                },
                { cleanData: () => {} }
            );
            try {
                expect(() => idevice.clearEditionFormHandlers(document.createElement('div'))).not.toThrow();
            } finally {
                window.jQuery = jq;
            }
        });
    });

    describe('initExeDeviceEdition()', () => {
        it('publishes a lifecycle owned by this node before the script initializes', () => {
            let lifecycleAtInit;
            idevice.ideviceBody = document.createElement('div');
            idevice.getSavedData = vi.fn(() => ({}));
            idevice.getPathEdition = vi.fn(() => '/edition/');
            global.$exeDevice = {
                init: vi.fn(() => {
                    // The edition script can already own resources here.
                    lifecycleAtInit = global.$exeDevice.$lifecycle;
                }),
            };

            idevice.initExeDeviceEdition();

            const lifecycle = getActiveEditionLifecycle();
            expect(lifecycle).not.toBeNull();
            expect(lifecycleAtInit).toBe(lifecycle);
            expect(lifecycle.ownerNode).toBe(idevice);
            expect(lifecycle.name).toBe('text');
            expect(lifecycle.formElement).toBe(idevice.ideviceBody);
            expect(global.$exeDevice.init).toHaveBeenCalledTimes(1);
        });
    });
});
