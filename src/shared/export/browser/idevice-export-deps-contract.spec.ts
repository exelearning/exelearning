/**
 * Filesystem contract test for the browser export-JS dependency registry.
 *
 * The Node exporter directory-scans each iDevice's `export/` folder, but the
 * browser exporter (preview + browser HTML5/SCORM/EPUB downloads + static PWA)
 * cannot read the filesystem, so it relies on the hand-maintained
 * `IDEVICE_JS_DEPENDENCIES` map in `idevice-config-browser.ts`. When a
 * `component-type=json` iDevice ships EXTRA classic export scripts declared in
 * its `config.xml <export-js>` (beyond the main `<cssClass>.js`) but the browser
 * map forgets them, those scripts never get a `<script>` tag in browser exports —
 * exactly the interactive-video review-item-7 regression (its shared core was
 * never loaded, so the runtime silently disabled itself).
 *
 * This test locks that invariant: for every `component-type=json` iDevice, each
 * `<export-js>` entry other than the main file MUST appear in the browser
 * dependency list, before the main file. `config.xml <export-js>` is the
 * authoritative declaration of the scripts that need a top-level tag — helper
 * scripts an iDevice loads dynamically (e.g. magnifier's `mojomagnify.js`,
 * three-d-viewer's runtime module) are deliberately NOT declared there and so
 * are correctly out of scope here.
 */
import { describe, it, expect } from 'bun:test';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { getIdeviceExportFiles } from './idevice-config-browser';

// Resolve from the repo root (bun test's cwd), matching src/routes/idevices.spec.ts.
const IDEVICES_DIR = join(process.cwd(), 'public/files/perm/idevices/base');

/** Extract the text of the first `<tag>...</tag>` block, or '' when absent. */
function block(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
    return match ? match[1] : '';
}

/** Extract the first `<tag>value</tag>` inner text, trimmed, or ''. */
function tagValue(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
    return match ? match[1].trim() : '';
}

/** All `<filename>…</filename>` entries inside a config.xml section. */
function filenames(sectionXml: string): string[] {
    const out: string[] = [];
    const re = /<filename>([\s\S]*?)<\/filename>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sectionXml)) !== null) {
        out.push(m[1].trim());
    }
    return out;
}

interface JsonIdevice {
    dir: string;
    cssClass: string;
    exportJs: string[];
}

/** Discover every component-type=json iDevice and its declared <export-js>. */
function jsonIdevices(): JsonIdevice[] {
    const result: JsonIdevice[] = [];
    for (const dir of readdirSync(IDEVICES_DIR)) {
        const configPath = join(IDEVICES_DIR, dir, 'config.xml');
        if (!existsSync(configPath)) {
            continue;
        }
        const xml = readFileSync(configPath, 'utf-8');
        if (tagValue(xml, 'component-type') !== 'json') {
            continue;
        }
        const cssClass = tagValue(xml, 'css-class') || dir;
        result.push({ dir, cssClass, exportJs: filenames(block(xml, 'export-js')) });
    }
    return result;
}

describe('browser export-JS dependency contract', () => {
    const idevices = jsonIdevices();

    it('discovers the component-type=json iDevices (sanity)', () => {
        expect(idevices.length).toBeGreaterThan(0);
        expect(idevices.map(d => d.cssClass)).toContain('interactive-video');
    });

    for (const idevice of idevices) {
        const extras = idevice.exportJs.filter(file => file !== `${idevice.cssClass}.js`);
        if (extras.length === 0) {
            continue;
        }

        it(`registers every declared extra export script for "${idevice.cssClass}" before the main file`, () => {
            const files = getIdeviceExportFiles(idevice.cssClass, '.js');
            const mainFile = `${idevice.cssClass}.js`;
            expect(files[files.length - 1]).toBe(mainFile);
            for (const extra of extras) {
                expect(files).toContain(extra);
                expect(files.indexOf(extra)).toBeLessThan(files.indexOf(mainFile));
            }
        });
    }
});
