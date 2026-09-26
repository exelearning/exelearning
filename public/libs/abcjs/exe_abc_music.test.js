/**
 * exe_abc_music.js Tests
 *
 * abcjs must play ABC notation with the soundfont bundled next to this script,
 * never with its remote default.
 */

/* eslint-disable no-undef */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(__dirname, 'exe_abc_music.js'), 'utf-8')
    // Re-evaluating a top-level class declaration throws; expose it as a global instead.
    .replace('class CursorControl {', 'globalThis.CursorControl = class CursorControl {')
    // Skip the document-ready auto-init.
    .replace(/\$\(function \(\) \{[\s\S]*?\}\);\s*$/, '');

function load(scriptSrc) {
    Object.defineProperty(document, 'currentScript', {
        configurable: true,
        get: () => (scriptSrc ? { src: scriptSrc } : null),
    });
    // eslint-disable-next-line no-eval
    (0, eval)(code);
    delete document.currentScript;
}

function mockAbcjs() {
    const inits = [];
    class CreateSynth {
        init(params) {
            inits.push(params);
            return Promise.resolve();
        }
        prime() {
            return Promise.resolve();
        }
        start() {}
    }
    class SynthSequence {
        constructor() {
            this.tracks = [];
        }
        addTrack() {
            this.tracks.push({ notes: [] });
            return this.tracks.length - 1;
        }
        setInstrument(track, instrument) {
            this.tracks[track].instrument = instrument;
        }
        appendNote(track, pitch) {
            this.tracks[track].notes.push(pitch);
        }
    }
    window.ABCJS = { synth: { CreateSynth, SynthSequence } };
    return inits;
}

describe('exe_abc_music soundfont', () => {
    afterEach(() => {
        delete window.ABCJS;
    });

    it('resolves the bundled soundfont against the script URL', () => {
        load('https://example.test/content/libs/abcjs/exe_abc_music.js');
        expect(exeAbcSynthOptions.soundFontUrl).toBe('https://example.test/content/libs/abcjs/soundfont/');
        expect(exeAbcSynthOptions.soundFontVolumeMultiplier).toBe(3);
    });

    it('falls back to a relative local path, never a remote one', () => {
        load(null);
        expect(exeAbcSynthOptions.soundFontUrl).toBe('soundfont/');
    });

    it('ships the piano notes abcjs requests', () => {
        for (const note of ['A0', 'Db4', 'C4', 'C8']) {
            expect(existsSync(join(__dirname, 'soundfont', 'acoustic_grand_piano-mp3', `${note}.mp3`))).toBe(true);
        }
    });

    it('plays a clicked note with the bundled soundfont', async () => {
        load('https://example.test/libs/abcjs/exe_abc_music.js');
        const inits = mockAbcjs();

        await exeAbcPlayEvent([{ pitch: 60, instrument: 0, duration: 0.25 }], [{ pitch: 62 }], 1000);

        expect(inits).toHaveLength(1);
        expect(inits[0].options).toBe(exeAbcSynthOptions);
        expect(inits[0].millisecondsPerMeasure).toBe(1000);
        expect(inits[0].sequence.tracks[0]).toEqual({ instrument: 0, notes: [62, 60] });
    });

    it('does not reference the remote abcjs soundfont', () => {
        expect(code).not.toMatch(/paulrosen|https?:\/\/(?!www\.w3\.org)/);
    });
});
