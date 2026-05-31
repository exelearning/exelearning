/**
 * Unit tests for the select-media-files iDevice (export/runtime).
 *
 * Regression coverage for the "first statement audio autoplays on load and the
 * speaker icon is missing" bug:
 *   - showPhrase must reveal the speaker icon whenever the statement has audio,
 *     for every question (including the first / num === 0).
 *   - showPhrase must only auto-play on navigation to a later question
 *     (num > 0); the first question stays silent until the icon is clicked.
 *   - startGame must never auto-play the statement audio (the game auto-starts
 *     on load when there is no timer / access code).
 *
 * The export declares `var $eXeSeleccionaMedias`; it is rewired to a global and
 * the auto-init call is stripped so importing has no side effects. Real jQuery
 * + happy-dom (from vitest.setup.js) back the DOM, and a media spy stands in
 * for the shared gamification audio helper.
 */

/* eslint-disable no-undef */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExport() {
    const code = readFileSync(join(__dirname, 'select-media-files.js'), 'utf-8');
    let modified = code.replace(/var\s+\$eXeSeleccionaMedias\s*=/, 'global.$eXeSeleccionaMedias =');
    modified = modified.replace(
        /\$\(function\s*\(\)\s*\{\s*\$eXeSeleccionaMedias\.init\(\);\s*\}\);?/g,
        '',
    );
    // eslint-disable-next-line no-eval
    (0, eval)(modified);
    return global.$eXeSeleccionaMedias;
}

describe('select-media-files iDevice export', () => {
    let media;
    let dmedia;

    beforeEach(() => {
        global.$eXeSeleccionaMedias = undefined;
        media = { playSound: vi.fn(), stopSound: vi.fn() };
        global.$exeDevices = { iDevice: { gamification: { media } } };
        dmedia = loadExport();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        delete global.$exeDevices;
        delete global.$eXeSeleccionaMedias;
    });

    describe('showPhrase audio icon + autoplay gating', () => {
        const instance = 0;

        function setup(phrases) {
            dmedia.options[instance] = {
                active: 0,
                attempsNumber: 1,
                phrasesGame: phrases,
            };
            // Isolate showPhrase from the card/image/message rendering helpers.
            dmedia.addCards = () => {};
            dmedia.showImage = () => {};
            dmedia.showMessage = () => {};
            document.body.innerHTML = `
                <a href="#" id="slcmpAudioDef-${instance}" style="display:none"></a>
                <div id="slcmpQuestion-${instance}"></div>
            `;
        }

        it('shows the speaker icon and does NOT autoplay on the first question (num === 0)', () => {
            setup([{ definition: 'Q0', audioDefinition: 'audio0.mp3', cards: [] }]);
            dmedia.showPhrase(0, instance);
            const icon = document.getElementById(`slcmpAudioDef-${instance}`);
            expect(icon.style.display).toBe('block');
            expect(media.playSound).not.toHaveBeenCalled();
        });

        it('shows the speaker icon AND autoplays when navigating to a later question (num > 0)', () => {
            setup([
                { definition: 'Q0', audioDefinition: 'audio0.mp3', cards: [] },
                { definition: 'Q1', audioDefinition: 'audio1.mp3', cards: [] },
            ]);
            dmedia.showPhrase(1, instance);
            const icon = document.getElementById(`slcmpAudioDef-${instance}`);
            expect(icon.style.display).toBe('block');
            expect(media.playSound).toHaveBeenCalledWith('audio1.mp3');
        });

        it('keeps the icon hidden when the statement has no audio', () => {
            setup([{ definition: 'Q0', audioDefinition: '', cards: [] }]);
            dmedia.showPhrase(0, instance);
            const icon = document.getElementById(`slcmpAudioDef-${instance}`);
            expect(icon.style.display).toBe('none');
            expect(media.playSound).not.toHaveBeenCalled();
        });
    });

    describe('startGame never autoplays the statement audio', () => {
        const instance = 0;

        it('starts the game silently even when the first statement has audio', () => {
            dmedia.options[instance] = {
                phrasesGame: [{ definition: 'Q0', audioDefinition: 'audio0.mp3', cards: [] }],
                phrase: { definition: 'Q0', audioDefinition: 'audio0.mp3', cards: [] },
                time: 0,
                attempts: 0,
                gameStarted: false,
                itinerary: { showCodeAccess: false },
            };
            // activateHover/uptateTime touch unrelated DOM; stub them out.
            dmedia.activateHover = () => {};
            dmedia.uptateTime = () => {};

            dmedia.startGame(instance);

            expect(media.playSound).not.toHaveBeenCalled();
            expect(dmedia.options[instance].gameStarted).toBe(true);
        });
    });
});
