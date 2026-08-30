import { describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { TEX_DEFAULT_PACKAGES, TEX_EXE_EXTENSIONS, TEX_PACKAGES } from './mathjax-packages';

const repoRoot = path.resolve(import.meta.dir, '../../../..');
const commonJsPath = path.join(repoRoot, 'public/app/common/common.js');
const vendorScriptPath = path.join(repoRoot, 'scripts/vendor-mathjax.ts');

/** Reads the `externalExtensions` array literal out of common.js. */
function readBrowserExtensions(): string[] {
    const source = fs.readFileSync(commonJsPath, 'utf8');
    const match = source.match(/var externalExtensions = \[([\s\S]*?)\];/);
    if (!match) throw new Error('externalExtensions array not found in common.js');
    return [...match[1].matchAll(/'([a-z0-9]+)'/g)].map(m => m[1]);
}

/** Reads the speech locales the vendor script ships, minus the support maps. */
function readVendoredSpeechLocales(): string[] {
    const source = fs.readFileSync(vendorScriptPath, 'utf8');
    const match = source.match(/export const VENDORED_SRE_LOCALES = \[([\s\S]*?)\] as const;/);
    if (!match) throw new Error('VENDORED_SRE_LOCALES array not found in vendor-mathjax.ts');
    return [...match[1].matchAll(/'([a-z]+)'/g)].map(m => m[1]).filter(l => !['base', 'euro', 'nemeth'].includes(l));
}

/** Reads the speech locales common.js trims the menu down to. */
function readBrowserSpeechLocales(): string[] {
    const source = fs.readFileSync(commonJsPath, 'utf8');
    const match = source.match(/window\.MATHJAX_SPEECH_LOCALES = \[([\s\S]*?)\];/);
    if (!match) throw new Error('MATHJAX_SPEECH_LOCALES array not found in common.js');
    return [...match[1].matchAll(/'([a-z]+)'/g)].map(m => m[1]);
}

describe('mathjax-packages', () => {
    it('enables exactly the extensions the browser configures', () => {
        // Browser and server pre-render must produce identical SVG; a document must not
        // depend on which path ran. See ADR-2259-01.
        expect([...TEX_EXE_EXTENSIONS].sort()).toEqual(readBrowserExtensions().sort());
    });

    it('combines the component defaults with the eXeLearning extensions', () => {
        expect(TEX_PACKAGES).toEqual([...TEX_DEFAULT_PACKAGES, ...TEX_EXE_EXTENSIONS]);
    });

    it('registers every package it names, so none is silently omitted', async () => {
        const { ConfigurationHandler } = await import('@mathjax/src/js/input/tex/Configuration.js');
        const registered = new Set(ConfigurationHandler.keys());

        expect(TEX_PACKAGES.filter(name => !registered.has(name))).toEqual([]);
    });
});

describe('speech locale lists', () => {
    it('are the same in the vendor script and in common.js', () => {
        // A locale offered by the menu but absent from disk makes the speech worker
        // hang forever, so these two lists drifting apart is a freeze waiting to happen.
        expect(readBrowserSpeechLocales().sort()).toEqual(readVendoredSpeechLocales().sort());
    });
});
