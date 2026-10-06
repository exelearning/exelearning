/**
 * Tests for build-resource-bundles.js
 *
 * These tests verify that the resource bundles are created with the correct
 * file paths that exporters expect.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { unzipSync } from 'fflate';

const projectRoot = path.resolve(__dirname, '..');

// Bundles are stored without version in path (version is virtual cache buster in URLs only)
const bundlesPath = path.join(projectRoot, 'public/bundles');

/**
 * Budget for the beforeAll hook below. It shells out to the real resource-bundle build, which is
 * a deterministic synchronous job measured at ~1.5s warm and ~3s from a cold cache — not a unit
 * test, and nothing Bun's 5s default hook budget was calibrated for. CI hits the slowest case:
 * `make test-unit-ci` runs before `make bundle` (ci.yml) and, unlike `make test-unit`, does not
 * take `bundle` as a prerequisite, so public/bundles is always cold there. With the default
 * budget the hook fails on a loaded runner purely because the build outran an arbitrary cliff
 * (observed locally at 5012ms). The generous explicit value keeps a genuine hang detectable
 * while removing that cliff.
 */
const BUILD_HOOK_TIMEOUT_MS = 120_000;

describe('build-resource-bundles', () => {
    beforeAll(() => {
        // Build bundles before tests
        console.log('Building resource bundles for testing...');
        execSync('bun scripts/build-resource-bundles.js', {
            cwd: projectRoot,
            stdio: 'pipe',
        });
    }, BUILD_HOOK_TIMEOUT_MS);

    describe('content-css.zip', () => {
        it('should exist after build', () => {
            const bundlePath = path.join(bundlesPath, 'content-css.zip');
            expect(fs.existsSync(bundlePath)).toBe(true);
        });

        it('should contain files with content/css/ prefix', () => {
            const bundlePath = path.join(bundlesPath, 'content-css.zip');
            const zipBuffer = fs.readFileSync(bundlePath);
            const unzipped = unzipSync(new Uint8Array(zipBuffer));

            const filePaths = Object.keys(unzipped);

            // All CSS files should have the content/css/ prefix
            for (const filePath of filePaths) {
                expect(filePath.startsWith('content/css/')).toBe(true);
            }
        });

        it('should contain content/css/base.css', () => {
            const bundlePath = path.join(bundlesPath, 'content-css.zip');
            const zipBuffer = fs.readFileSync(bundlePath);
            const unzipped = unzipSync(new Uint8Array(zipBuffer));

            const filePaths = Object.keys(unzipped);
            expect(filePaths).toContain('content/css/base.css');
        });

        it('should contain valid CSS content', () => {
            const bundlePath = path.join(bundlesPath, 'content-css.zip');
            const zipBuffer = fs.readFileSync(bundlePath);
            const unzipped = unzipSync(new Uint8Array(zipBuffer));

            const baseCss = unzipped['content/css/base.css'];
            expect(baseCss).toBeDefined();

            const content = new TextDecoder().decode(baseCss);
            expect(content.length).toBeGreaterThan(0);
            // Should contain some CSS (just a sanity check)
            expect(content).toContain('{');
        });
    });

    describe('manifest.json', () => {
        it('should exist after build', () => {
            const manifestPath = path.join(bundlesPath, 'manifest.json');
            expect(fs.existsSync(manifestPath)).toBe(true);
        });

        it('should contain contentCss entry', () => {
            const manifestPath = path.join(bundlesPath, 'manifest.json');
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

            expect(manifest.contentCss).toBeDefined();
            expect(manifest.contentCss.files).toBeGreaterThan(0);
            expect(manifest.contentCss.size).toBeGreaterThan(0);
            expect(manifest.contentCss.hash).toBeDefined();
        });
    });

    describe('themes/', () => {
        it('should create theme bundles', () => {
            const themesPath = path.join(bundlesPath, 'themes');
            expect(fs.existsSync(themesPath)).toBe(true);

            const themes = fs.readdirSync(themesPath);
            expect(themes.length).toBeGreaterThan(0);
        });
    });

    describe('libs.zip', () => {
        it('should exist after build', () => {
            const bundlePath = path.join(bundlesPath, 'libs.zip');
            expect(fs.existsSync(bundlePath)).toBe(true);
        });

        it('should contain jQuery', () => {
            const bundlePath = path.join(bundlesPath, 'libs.zip');
            const zipBuffer = fs.readFileSync(bundlePath);
            const unzipped = unzipSync(new Uint8Array(zipBuffer));

            const filePaths = Object.keys(unzipped);
            expect(filePaths).toContain('jquery/jquery.min.js');
        });
    });

    describe('idevices.zip', () => {
        it('should exist after build', () => {
            const bundlePath = path.join(bundlesPath, 'idevices.zip');
            expect(fs.existsSync(bundlePath)).toBe(true);
        });

        it('should contain iDevice files with correct structure', () => {
            const bundlePath = path.join(bundlesPath, 'idevices.zip');
            const zipBuffer = fs.readFileSync(bundlePath);
            const unzipped = unzipSync(new Uint8Array(zipBuffer));

            const filePaths = Object.keys(unzipped);
            expect(filePaths.length).toBeGreaterThan(0);

            // Each file should be prefixed with iDevice name
            for (const filePath of filePaths) {
                expect(filePath.includes('/')).toBe(true);
            }
        });
    });

    // The static distribution ships no zips; the client assembles each bundle
    // from the loose files listed here. These tests guarantee the manifest
    // describes the same content as the zips and that every source URL resolves.
    describe('staticFiles (loose-file mappings for static mode)', () => {
        let manifest: any;

        beforeAll(() => {
            const manifestPath = path.join(bundlesPath, 'manifest.json');
            manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        });

        it('should declare every bundle group', () => {
            const sf = manifest.staticFiles;
            expect(sf).toBeDefined();
            expect(sf.themes).toBeDefined();
            expect(sf.idevices).toBeDefined();
            expect(Array.isArray(sf.libs)).toBe(true);
            expect(sf.common).toBeDefined();
            expect(Array.isArray(sf.contentCss)).toBe(true);
        });

        it('should use { s, t } entries whose source URL is relative to public/', () => {
            const sample = manifest.staticFiles.libs[0];
            expect(sample.s).toBeDefined();
            expect(sample.t).toBeDefined();
            // s is a relative URL (no leading slash, no scheme)
            expect(sample.s.startsWith('/')).toBe(false);
            expect(sample.s.includes('://')).toBe(false);
        });

        it('should map content CSS to the content/css/ target prefix', () => {
            for (const { s, t } of manifest.staticFiles.contentCss) {
                expect(t.startsWith('content/css/')).toBe(true);
                expect(s.startsWith('style/workarea/')).toBe(true);
            }
        });

        it('should map iDevice sources under each export/ directory', () => {
            for (const [name, entries] of Object.entries<any>(manifest.staticFiles.idevices)) {
                for (const { s } of entries) {
                    expect(s.startsWith(`files/perm/idevices/base/${name}/export/`)).toBe(true);
                }
            }
        });

        it('should not list colocated .test.js / .spec.js sources (idevices and common)', () => {
            // The dist/static copy excludes these test sources, so the manifest
            // must not list them either — otherwise assembly 404s on every one
            // and the static manifest diverges from the server-mode zips.
            const isTestSource = (p: string) => /\.(test|spec)\.js$/.test(p);
            const groups = [
                ...Object.values<any>(manifest.staticFiles.idevices),
                ...Object.values<any>(manifest.staticFiles.common),
            ];
            for (const entries of groups) {
                for (const { s, t } of entries) {
                    expect(isTestSource(s)).toBe(false);
                    expect(isTestSource(t)).toBe(false);
                }
            }
        });

        it('should reference loose files that actually exist on disk', () => {
            // Spot-check one entry per group so assembly never 404s.
            const groups = [
                manifest.staticFiles.libs,
                manifest.staticFiles.contentCss,
                manifest.staticFiles.idevices.text,
                manifest.staticFiles.themes.base,
                manifest.staticFiles.common.exe_lightbox,
            ];
            for (const entries of groups) {
                expect(Array.isArray(entries)).toBe(true);
                for (const { s } of entries) {
                    expect(fs.existsSync(path.join(projectRoot, 'public', s))).toBe(true);
                }
            }
        });

        it('should describe the same file set as idevices.zip (assembled === zipped)', () => {
            const unzipped = unzipSync(new Uint8Array(fs.readFileSync(path.join(bundlesPath, 'idevices.zip'))));
            // Group zip entries (`<name>/<rel>`) by iDevice into target paths.
            const zipByIdevice: Record<string, Set<string>> = {};
            for (const full of Object.keys(unzipped)) {
                const slash = full.indexOf('/');
                const name = full.slice(0, slash);
                const rel = full.slice(slash + 1);
                (zipByIdevice[name] ??= new Set()).add(rel);
            }
            for (const [name, entries] of Object.entries<any>(manifest.staticFiles.idevices)) {
                const manifestTargets = new Set(entries.map((e: any) => e.t));
                expect(manifestTargets).toEqual(zipByIdevice[name]);
            }
        });

        it('should describe the same file set as content-css.zip', () => {
            const unzipped = unzipSync(new Uint8Array(fs.readFileSync(path.join(bundlesPath, 'content-css.zip'))));
            const zipTargets = new Set(Object.keys(unzipped));
            const manifestTargets = new Set(manifest.staticFiles.contentCss.map((e: any) => e.t));
            expect(manifestTargets).toEqual(zipTargets);
        });

        it('should describe the same file set as libs.zip', () => {
            const unzipped = unzipSync(new Uint8Array(fs.readFileSync(path.join(bundlesPath, 'libs.zip'))));
            const zipTargets = new Set(Object.keys(unzipped));
            const manifestTargets = new Set(manifest.staticFiles.libs.map((e: any) => e.t));
            expect(manifestTargets).toEqual(zipTargets);
        });
    });
});
