/**
 * Unit tests for the DigCompEdu iDevice (edition).
 *
 * They cover the resources the editor owns beyond its own form: the framework
 * download, the `document` keydown listener and the `<body>` overlay class.
 */

/* eslint-disable no-undef */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
            received.forEach(options => {
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
    });

    describe('init', () => {
        it('does not build the form when the framework arrives after the edition closed', async () => {
            document.body.innerHTML = '<div id="digcompeduBody"></div>';
            const element = document.getElementById('digcompeduBody');
            let release;
            $exeDevice.loadFrameworkData = () =>
                new Promise(resolve => {
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
