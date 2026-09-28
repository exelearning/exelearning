/**
 * Unit tests for the DigCompEdu iDevice (edition).
 *
 * They cover the resources the editor owns beyond its own form: the framework
 * download (including the .zst → plain → XHR fallback chain), the `document`
 * keydown listener and the `<body>` overlay class.
 */

/* eslint-disable no-undef */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function minimalFramework() {
    return {
        competences: {
            C1: {
                name: 'Competence 1',
                levels: {},
            },
        },
    };
}

function mockZstFetch(data) {
    const jsonBytes = new TextEncoder().encode(JSON.stringify(data));
    globalThis.window.fzstd = { decompress: vi.fn(() => jsonBytes) };
    globalThis.fetch = vi.fn((url) => {
        if (/\.zst$/.test(url)) {
            return Promise.resolve({
                ok: true,
                arrayBuffer: () => Promise.resolve(jsonBytes.buffer),
            });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
    });
}

function mockZstFetch404ThenPlain(data) {
    globalThis.window.fzstd = { decompress: vi.fn() };
    globalThis.fetch = vi.fn((url) => {
        if (/\.zst$/.test(url)) {
            return Promise.resolve({ ok: false, status: 404 });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
    });
}

function mockPlainFetchOnly(data) {
    delete globalThis.window.fzstd;
    globalThis.fetch = vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
    );
}

describe('digcompedu iDevice (edition)', () => {
    let $exeDevice;

    beforeEach(() => {
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
        document.body.className = '';
        $exeDevice = global.loadIdevice(join(__dirname, 'digcompedu.js'));
    });

    afterEach(() => {
        vi.restoreAllMocks();
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
        document.body.className = '';
        delete global.fetch;
        delete globalThis.window.fzstd;
    });

    /**
     * Minimal form: `attachBehaviour` guards every optional control, so the
     * overlay and the modal are enough to exercise the global keydown path.
     */
    function buildEditor() {
        document.body.innerHTML = `
            <div id="digcompeduBody">
                <div class="digcompedu-editor">
                    <div id="digcompeduFullscreenOverlay" aria-hidden="true">
                        <div class="digcompedu-fullscreen-content"></div>
                    </div>
                    <div id="digcompeduSummaryModal" aria-hidden="true"></div>
                </div>
            </div>
        `;
        $exeDevice.ideviceBody = document.getElementById('digcompeduBody');
        $exeDevice.attachBehaviour();
    }

    describe('global keydown listener', () => {
        it('closes the summary modal on Escape while the edition is open', () => {
            buildEditor();
            const modal = document.getElementById('digcompeduSummaryModal');
            modal.setAttribute('aria-hidden', 'false');

            document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));

            expect(modal.getAttribute('aria-hidden')).toBe('true');
        });

        it('stops listening on document once the edition closes', () => {
            buildEditor();
            const closeSummaryModal = vi.spyOn($exeDevice, 'closeSummaryModal');
            const unrelated = vi.fn();
            document.addEventListener('keydown', unrelated);

            $exeDevice.$lifecycle.destroy();
            document.getElementById('digcompeduSummaryModal').setAttribute('aria-hidden', 'false');
            document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));

            expect(closeSummaryModal).not.toHaveBeenCalled();
            // Removal is scoped to this edition's own listener.
            expect(unrelated).toHaveBeenCalledTimes(1);

            document.removeEventListener('keydown', unrelated);
        });
    });

    describe('body overlay class', () => {
        it('is dropped when the editor closes while the fullscreen view is open', () => {
            buildEditor();
            $exeDevice.openSummaryModal = () => {};
            document.body.classList.add('digcompedu-overlay-open');

            $exeDevice.$lifecycle.destroy();

            expect(document.body.classList.contains('digcompedu-overlay-open')).toBe(false);
        });

        it('leaves unrelated body classes alone', () => {
            buildEditor();
            document.body.classList.add('digcompedu-overlay-open', 'some-other-class');

            $exeDevice.$lifecycle.destroy();

            expect(document.body.classList.contains('some-other-class')).toBe(true);
        });
    });

    describe('loadFrameworkData', () => {
        it('passes the edition abort signal to fetch', async () => {
            const received = [];
            global.fetch = vi.fn(async (url, options) => {
                received.push(options);
                return { ok: true, url, json: async () => ({ areas: [] }) };
            });

            await $exeDevice.loadFrameworkData('en');

            expect(global.fetch).toHaveBeenCalled();
            received.forEach((options) => {
                expect(options.signal).toBe($exeDevice.$lifecycle.signal);
            });
        });

        it('aborts the pending download when the edition closes', async () => {
            let received = null;
            global.fetch = vi.fn(async (url, options) => {
                received = options;
                return new Promise(() => {});
            });

            $exeDevice.loadFrameworkData('en');
            await Promise.resolve();
            $exeDevice.$lifecycle.destroy();

            expect(received.signal.aborted).toBe(true);
        });

        // Review H2: an aborted fetch() rejected into the same fallback chain
        // as a network failure, which then opened and sent an XHR after the
        // edition had already closed.
        describe('when the edition closes mid-download', () => {
            let xhrs;
            let OriginalXHR;

            beforeEach(() => {
                xhrs = [];
                OriginalXHR = global.XMLHttpRequest;
                global.XMLHttpRequest = function () {
                    const xhr = { open: vi.fn(), send: vi.fn(), abort: vi.fn(), overrideMimeType: vi.fn() };
                    xhrs.push(xhr);
                    return xhr;
                };
            });

            afterEach(() => {
                global.XMLHttpRequest = OriginalXHR;
                delete globalThis.window.fzstd;
            });

            const abortableFetch = () =>
                vi.fn(
                    (url, options) =>
                        new Promise((_resolve, reject) => {
                            options.signal.addEventListener('abort', () =>
                                reject(new DOMException('aborted', 'AbortError')),
                            );
                        }),
                );

            it('does not fall back to an XHR from the plain fetch', async () => {
                global.fetch = abortableFetch();
                const pending = $exeDevice.loadFrameworkData('en');
                await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
                $exeDevice.$lifecycle.destroy();

                await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
                expect(xhrs).toEqual([]);
                expect(global.fetch).toHaveBeenCalledTimes(1);
            });

            it('does not fall back from the .zst request either', async () => {
                globalThis.window.fzstd = { decompress: vi.fn() };
                global.fetch = abortableFetch();
                const pending = $exeDevice.loadFrameworkData('en');
                await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
                $exeDevice.$lifecycle.destroy();

                await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
                expect(xhrs).toEqual([]);
                expect(global.fetch).toHaveBeenCalledTimes(1);
            });

            it('starts no tier at all when the edition closes before the first one', async () => {
                global.fetch = abortableFetch();
                const pending = $exeDevice.loadFrameworkData('en');
                $exeDevice.$lifecycle.destroy();

                await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
                expect(global.fetch).not.toHaveBeenCalled();
                expect(xhrs).toEqual([]);
            });

            it('still falls back to an XHR when the fetch fails for another reason', async () => {
                global.fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
                $exeDevice.loadFrameworkData('en').catch(() => {});
                await vi.waitFor(() => expect(xhrs).toHaveLength(1));

                expect(xhrs[0].open).toHaveBeenCalled();
                expect(xhrs[0].send).toHaveBeenCalled();
            });
        });

        it('tries <url>.zst first and decompresses via window.fzstd when available', async () => {
            mockZstFetch(minimalFramework());
            const data = await $exeDevice.loadFrameworkData('es');
            expect(globalThis.fetch).toHaveBeenCalled();
            const firstCall = globalThis.fetch.mock.calls[0];
            expect(firstCall[0]).toMatch(/\.zst$/);
            expect(firstCall[1].signal).toBe($exeDevice.$lifecycle.signal);
            expect(globalThis.window.fzstd.decompress).toHaveBeenCalled();
            expect(data).toEqual(minimalFramework());
        });

        it('falls back to the plain <url> fetch when the .zst request 404s', async () => {
            mockZstFetch404ThenPlain(minimalFramework());
            const data = await $exeDevice.loadFrameworkData('es');
            const urls = globalThis.fetch.mock.calls.map((c) => c[0]);
            expect(urls.some((u) => /\.zst$/.test(u))).toBe(true);
            expect(urls.some((u) => !/\.zst$/.test(u))).toBe(true);
            expect(data).toEqual(minimalFramework());
        });

        it('skips the .zst tier entirely when window.fzstd is not loaded', async () => {
            mockPlainFetchOnly(minimalFramework());
            const data = await $exeDevice.loadFrameworkData('es');
            const urls = globalThis.fetch.mock.calls.map((c) => c[0]);
            expect(urls.every((u) => !/\.zst$/.test(u))).toBe(true);
            expect(data).toEqual(minimalFramework());
        });

        it('caches the result per language and does not re-fetch on a second call', async () => {
            mockZstFetch(minimalFramework());
            await $exeDevice.loadFrameworkData('es');
            const callsAfterFirst = globalThis.fetch.mock.calls.length;
            await $exeDevice.loadFrameworkData('es');
            expect(globalThis.fetch.mock.calls.length).toBe(callsAfterFirst);
        });
    });

    describe('open edition continuations', () => {
        const stubRendering = () => {
            for (const name of [
                'prepareLookupStructures',
                'ensureGranularityCompatibility',
                'createForm',
                'renderTable',
                'restoreInterfaceState',
                'updateSelectionCounter',
                'updateSummaryPreview',
                'updateSelectionInputs',
                'updateGranularityControls',
            ]) {
                vi.spyOn($exeDevice, name).mockImplementation(() => {});
            }
            vi.spyOn($exeDevice, 'transitionSelections').mockReturnValue(new Set(['x']));
        };

        it('init() renders the framework while the edition is open', async () => {
            document.body.innerHTML = '<div id="digcompeduBody"></div>';
            stubRendering();
            $exeDevice.loadFrameworkData = () => Promise.resolve(minimalFramework());

            $exeDevice.init(document.getElementById('digcompeduBody'), {});
            await vi.waitFor(() => expect($exeDevice.createForm).toHaveBeenCalled());

            expect($exeDevice.frameworkData).toEqual(minimalFramework());
            expect($exeDevice.updateSummaryPreview).toHaveBeenCalled();
        });

        it('init() reports a failed download while the edition is open', async () => {
            document.body.innerHTML = '<div id="digcompeduBody"></div>';
            const element = document.getElementById('digcompeduBody');
            vi.spyOn(console, 'error').mockImplementation(() => {});
            $exeDevice.loadFrameworkData = () => Promise.reject(new Error('404'));

            $exeDevice.init(element, {});
            await vi.waitFor(() => expect(element.querySelector('.digcompedu-error')).not.toBeNull());
        });

        it('handleFrameworkChange() switches the framework while the edition is open', async () => {
            buildEditor();
            stubRendering();
            $exeDevice.activeLang = 'en';
            $exeDevice.selectedIds = new Set();
            $exeDevice.loadFrameworkData = () => Promise.resolve(minimalFramework());

            await $exeDevice.handleFrameworkChange('es');

            expect($exeDevice.activeLang).toBe('es');
            expect($exeDevice.selectedIds).toEqual(new Set(['x']));
            expect($exeDevice.ideviceBody.classList.contains('digcompedu-loading')).toBe(false);
        });

        it('handleFrameworkChange() restores the previous framework when the switch fails', async () => {
            buildEditor();
            const select = document.createElement('select');
            select.id = $exeDevice.dataLangSelectId;
            select.innerHTML = '<option value="en">en</option><option value="es">es</option>';
            select.value = 'es';
            $exeDevice.ideviceBody.appendChild(select);
            $exeDevice.activeLang = 'en';
            $exeDevice.selectedIds = new Set();
            vi.spyOn(console, 'error').mockImplementation(() => {});
            const alert = vi.fn();
            const previousExe = globalThis.eXe;
            globalThis.eXe = { app: { alert } };
            $exeDevice.loadFrameworkData = () => Promise.reject(new Error('404'));

            try {
                await expect($exeDevice.handleFrameworkChange('es')).rejects.toThrow('404');
            } finally {
                globalThis.eXe = previousExe;
            }

            expect(alert).toHaveBeenCalled();
            expect(select.value).toBe('en');
            expect($exeDevice.ideviceBody.classList.contains('digcompedu-loading')).toBe(false);
        });

        it('handleFrameworkChange() does nothing once the edition closed mid-switch', async () => {
            buildEditor();
            stubRendering();
            $exeDevice.activeLang = 'en';
            $exeDevice.selectedIds = new Set();
            let release;
            $exeDevice.loadFrameworkData = () => new Promise((resolve) => (release = resolve));

            const pending = $exeDevice.handleFrameworkChange('es');
            $exeDevice.$lifecycle.destroy();
            release(minimalFramework());
            await pending;

            expect($exeDevice.activeLang).toBe('en');
            expect($exeDevice.renderTable).not.toHaveBeenCalled();
        });
    });

    describe('init', () => {
        it('does not build the form when the framework arrives after the edition closed', async () => {
            document.body.innerHTML = '<div id="digcompeduBody"></div>';
            const element = document.getElementById('digcompeduBody');
            let release;
            $exeDevice.loadFrameworkData = () =>
                new Promise((resolve) => {
                    release = resolve;
                });
            const createForm = vi.spyOn($exeDevice, 'createForm').mockImplementation(() => {});

            $exeDevice.init(element, {});
            $exeDevice.$lifecycle.destroy();
            release({ areas: [] });
            await Promise.resolve();
            await Promise.resolve();

            expect(createForm).not.toHaveBeenCalled();
            expect(element.innerHTML).toBe('');
        });

        it('does not report an error raised by its own abort', async () => {
            document.body.innerHTML = '<div id="digcompeduBody"></div>';
            const element = document.getElementById('digcompeduBody');
            let fail;
            $exeDevice.loadFrameworkData = () =>
                new Promise((resolve, reject) => {
                    fail = reject;
                });

            $exeDevice.init(element, {});
            $exeDevice.$lifecycle.destroy();
            fail(new Error('aborted'));
            await Promise.resolve();
            await Promise.resolve();

            expect(element.innerHTML).toBe('');
        });
    });
});
