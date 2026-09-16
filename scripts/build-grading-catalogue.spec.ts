/**
 * The grading catalogue producer (scripts/build-grading-catalogue.ts) must leave the
 * live-Moodle lanes with everything they read: a catalogue that lists every declared
 * scenario, and a package zip per scenario whose digest matches the manifest.
 *
 * Only `scorm12` is built here — the point is the wiring (catalogue, manifest, one zip
 * per scenario, matching sha256), not re-checking each exporter, which the exporters'
 * own specs and the integration spec already cover. The producer runs the real
 * `Scorm12Exporter`, so this doubles as an end-to-end check that a declared scenario
 * survives a full export.
 */
import { describe, it, expect, afterAll } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { unzipSync } from '../src/shared/export';
import {
    CATALOGUE_VERSION,
    GRADING_SCENARIOS,
    cataloguePath,
    loadCatalogue,
    manifestPath,
    packageFileName,
} from '../test/helpers/grading-scenarios';
import { buildCatalogue, parseArgs, resolveFormats, type CatalogueManifest } from './build-grading-catalogue';

const roots: string[] = [];

afterAll(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('grading catalogue producer', () => {
    it('writes a catalogue and a scorm12 zip for every declared scenario', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'grading-producer-'));
        roots.push(root);
        const producer = 'test';

        const result = await buildCatalogue({ root, producer, formats: ['scorm12'], log: () => {} });

        // The catalogue lists every declared scenario, at the version the reader accepts.
        const catalogue = loadCatalogue(root);
        expect(catalogue?.catalogueVersion).toBe(CATALOGUE_VERSION);
        expect(catalogue?.scenarios.map(s => s.id)).toEqual(GRADING_SCENARIOS.map(s => s.id));
        expect(fs.existsSync(cataloguePath(root))).toBe(true);

        // The manifest names one scorm12 package per scenario, and the zip exists and
        // has the digest the manifest declares — the exact check package-oracles makes.
        const manifest = JSON.parse(fs.readFileSync(manifestPath(root, producer), 'utf8')) as CatalogueManifest;
        expect(manifest.scenarios.map(s => s.id)).toEqual(GRADING_SCENARIOS.map(s => s.id));

        for (const scenario of GRADING_SCENARIOS) {
            const entry = manifest.scenarios.find(s => s.id === scenario.id);
            const pkg = entry?.packages.scorm12;
            expect(pkg, `${scenario.id} has a scorm12 package in the manifest`).toBeDefined();
            expect(pkg?.file).toBe(packageFileName(scenario.id, producer, 'scorm12'));

            const zipPath = path.join(root, 'packages', producer, pkg?.file ?? '');
            expect(fs.existsSync(zipPath), `${scenario.id} zip exists`).toBe(true);

            const files = unzipSync(new Uint8Array(fs.readFileSync(zipPath))) as unknown as Record<string, Uint8Array>;
            // The exporter really ran: the SCORM manifest and the runtime pair are there.
            expect(files['imsmanifest.xml']).toBeDefined();
            expect(files['libs/SCOFunctions.js']).toBeDefined();
            expect(pkg?.runtimeSha256?.['libs/SCOFunctions.js']).toBeTruthy();
        }

        expect(result.zips.length).toBe(GRADING_SCENARIOS.length);
    });

    it('gives scenarios that share a package identical bytes under their own names', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'grading-producer-share-'));
        roots.push(root);
        const producer = 'test';
        await buildCatalogue({ root, producer, formats: ['scorm12'], log: () => {} });

        // M3 and its control M3C are the same ProjectSpec answered differently, so the
        // packages are byte-identical — the lanes address them by scenario id all the same.
        const dir = path.join(root, 'packages', producer);
        const m3 = fs.readFileSync(path.join(dir, packageFileName('M3', producer, 'scorm12')));
        const m3c = fs.readFileSync(path.join(dir, packageFileName('M3C', producer, 'scorm12')));
        expect(m3c.equals(m3)).toBe(true);
    });
});

describe('producer argument parsing', () => {
    it('reads --key=value pairs', () => {
        expect(parseArgs(['--root=/a', '--producer=main', 'stray'])).toEqual({ root: '/a', producer: 'main' });
    });

    it('defaults to every format and refuses an unknown one', () => {
        expect(resolveFormats(undefined)).toEqual(['scorm12', 'html5', 'elpx']);
        expect(resolveFormats('scorm12,elpx')).toEqual(['scorm12', 'elpx']);
        expect(() => resolveFormats('scorm12,bogus')).toThrow("unknown format 'bogus'");
    });
});
