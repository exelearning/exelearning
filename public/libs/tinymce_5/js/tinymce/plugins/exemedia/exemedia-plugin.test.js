/**
 * Unit tests for the exemedia TinyMCE plugin dialog embed generation.
 *
 * SetNewEmbedData() rebuilds the embed markup whenever the dialog source or
 * media type changes. Some dialog states have no `dimensions` field in
 * api.getData() (issue #2273, Sentry: "undefined is not an object evaluating
 * dimensions.width"), so the function must tolerate a missing block instead of
 * crashing. These tests extract and execute the real function from the plugin
 * source so the shipped code is what gets exercised.
 */

/* eslint-disable no-undef */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PLUGIN_PATH = join(__dirname, 'plugin.min.js');
const pluginSource = readFileSync(PLUGIN_PATH, 'utf-8');

// The plugin is a large IIFE; pull the two relevant top-level functions out of
// it verbatim (they are self-contained) so the real source runs in the tests.
function extractFunction(name) {
    const start = pluginSource.indexOf(`    function ${name}(`);
    expect(start).toBeGreaterThan(-1);
    const closing = '\n    }';
    const end = pluginSource.indexOf(closing, start);
    expect(end).toBeGreaterThan(start);
    return pluginSource.slice(start, end + closing.length);
}

const setNewEmbedData = new Function(
    'api',
    'type',
    `${extractFunction('isLocalPDF')}\n${extractFunction('SetNewEmbedData')}\nreturn SetNewEmbedData(api, type);`,
);

function makeApi(data) {
    const state = { ...data };
    return {
        getData: () => state,
        setData: vi.fn((patch) => Object.assign(state, patch)),
    };
}

describe('exemedia plugin - SetNewEmbedData missing dimensions guard (issue #2273)', () => {
    it('does not throw when getData() has no dimensions field (Sentry repro)', () => {
        const api = makeApi({ source: { value: 'files/tmp/session/movie.mp4' } });

        let embed;
        expect(() => {
            embed = setNewEmbedData(api, 'video');
        }).not.toThrow();

        // Falls back to the generic default size.
        expect(embed).toContain('<video');
        expect(embed).toContain('width ="300"');
        expect(embed).toContain('height="150"');
        expect(api.setData).toHaveBeenCalledWith({ dimensions: { width: '300', height: '150' } });
    });

    it('uses the Mediateca EducaMadrid audio default when dimensions are missing', () => {
        const api = makeApi({ source: { value: 'https://mediateca.educa.madrid.org/audio/abc123' } });

        const embed = setNewEmbedData(api, 'iframe');

        expect(embed).toContain('<iframe');
        expect(embed).toContain('width ="420"');
        expect(embed).toContain('height="44"');
        expect(api.setData).toHaveBeenCalledWith({ dimensions: { width: '420', height: '44' } });
    });

    it('still applies the defaults when dimensions are empty strings (previous behavior)', () => {
        const api = makeApi({
            source: { value: 'files/tmp/session/movie.mp4' },
            dimensions: { width: '', height: '' },
        });

        const embed = setNewEmbedData(api, 'video');

        expect(embed).toContain('width ="300"');
        expect(embed).toContain('height="150"');
    });

    it('keeps explicit dimensions untouched (normal path)', () => {
        const api = makeApi({
            source: { value: 'files/tmp/session/movie.mp4' },
            dimensions: { width: '640', height: '360' },
        });

        const embed = setNewEmbedData(api, 'video');

        expect(embed).toBe(
            '<video width ="640" height="360" controls ="controls"><source src="files/tmp/session/movie.mp4"/></video>',
        );
        expect(api.setData).not.toHaveBeenCalled();
    });

    it("keeps a literal '0' size (size inputs are strings, so '0' is not treated as missing)", () => {
        const api = makeApi({
            source: { value: 'files/tmp/session/movie.mp4' },
            dimensions: { width: '0', height: '0' },
        });

        const embed = setNewEmbedData(api, 'video');

        expect(embed).toContain('width ="0"');
        expect(embed).toContain('height="0"');
        expect(api.setData).not.toHaveBeenCalled();
    });

    it('still clears dimensions for audio embeds (normal path)', () => {
        const api = makeApi({
            source: { value: 'files/tmp/session/track.mp3' },
            dimensions: { width: '300', height: '150' },
        });

        const embed = setNewEmbedData(api, 'audio');

        expect(embed).toBe('<audio controls ="controls" src="files/tmp/session/track.mp3"></audio>');
        expect(api.setData).toHaveBeenCalledWith({ dimensions: { width: '', height: '' } });
    });

    it('still embeds local PDFs when no media type matches (normal path)', () => {
        const api = makeApi({
            source: { value: 'files/tmp/session/doc.pdf' },
            dimensions: { width: '500', height: '400' },
        });

        const embed = setNewEmbedData(api, '');

        expect(embed).toContain('<embed');
        expect(embed).toContain('type="application/pdf"');
        expect(embed).toContain('src="files/tmp/session/doc.pdf"');
    });
});
