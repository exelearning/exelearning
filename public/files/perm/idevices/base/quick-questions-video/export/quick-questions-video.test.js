/**
 * Unit tests for quick-questions-video iDevice (export/runtime), focused on the
 * external-media bridge integration: detection, control delegation and graceful
 * fallback when the package runs inside an opaque-origin sandboxed iframe.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
    let modified = code.replace(/var\s+\$quickquestionsvideo\s*=/, 'global.$quickquestionsvideo =');
    // eslint-disable-next-line no-eval
    (0, eval)(modified);
    return global.$quickquestionsvideo;
}

describe('quick-questions-video iDevice export — media bridge', () => {
    let qqv;

    beforeEach(() => {
        global.$quickquestionsvideo = undefined;
        global.$ = () => ({ html: () => {}, show: () => {}, hide: () => {}, length: 0, attr: () => '' });
        global.$.fn = {};
        const code = readFileSync(join(__dirname, 'quick-questions-video.js'), 'utf-8');
        qqv = loadExportIdevice(code);
        qqv.options = [];
    });

    afterEach(() => {
        delete global.$quickquestionsvideo;
        delete global.$;
        if (global.window) delete global.window.exeMediaBridge;
    });

    function instance(extra) {
        qqv.options[0] = Object.assign({ videoType: 0, idVideoQuExt: 'dQw4w9WgXcQ', player: null }, extra);
        return qqv.options[0];
    }

    describe('bridgeEligible', () => {
        it('is false when no bridge runtime is present', () => {
            instance();
            delete global.window.exeMediaBridge;
            expect(qqv.bridgeEligible(0)).toBe(false);
        });

        it('is true for a YouTube instance when the runtime says to use the bridge', () => {
            instance({ videoType: 0 });
            global.window.exeMediaBridge = { shouldUseBridge: () => true };
            expect(qqv.bridgeEligible(0)).toBe(true);
        });

        it('is false for local/mediateca instances (videoType > 0)', () => {
            global.window.exeMediaBridge = { shouldUseBridge: () => true };
            instance({ videoType: 1 });
            expect(qqv.bridgeEligible(0)).toBe(false);
            instance({ videoType: 3 });
            expect(qqv.bridgeEligible(0)).toBe(false);
        });
    });

    describe('control delegation', () => {
        it('playVideo shows then plays the parent player when a controller is active', () => {
            const calls = [];
            instance({ mediaController: { show: () => calls.push('show'), play: () => calls.push('play') } });
            qqv.playVideo(0);
            expect(calls).toEqual(['show', 'play']);
        });

        it('stopVideo pauses and hides the parent modal when a controller is active', () => {
            const calls = [];
            instance({ mediaController: { pause: () => calls.push('pause'), hide: () => calls.push('hide') } });
            qqv.stopVideo(0);
            expect(calls).toContain('pause');
            expect(calls).toContain('hide');
        });

        it('endVideoYoutube closes the parent modal when a controller is active', () => {
            let closed = false;
            instance({ mediaController: { close: () => { closed = true; } } });
            qqv.endVideoYoutube(0);
            expect(closed).toBe(true);
        });
    });
});
