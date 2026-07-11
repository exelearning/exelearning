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
// Importing the script module must NOT trigger a build (require.main guard).
import { buildPreviewFixedResourcesManifest } from './build-resource-bundles.js';

const projectRoot = path.resolve(__dirname, '..');

// Bundles are stored without version in path (version is virtual cache buster in URLs only)
const bundlesPath = path.join(projectRoot, 'public/bundles');

describe('build-resource-bundles', () => {
    beforeAll(() => {
        // Build bundles before tests
        console.log('Building resource bundles for testing...');
        execSync('bun scripts/build-resource-bundles.js', {
            cwd: projectRoot,
            stdio: 'pipe',
        });
    });

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

    describe('preview-fixed-resources.json', () => {
        it('is written by the build with schemaVersion 1', () => {
            const manifestPath = path.join(bundlesPath, 'preview-fixed-resources.json');
            expect(fs.existsSync(manifestPath)).toBe(true);
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            expect(manifest.schemaVersion).toBe(1);
            expect(typeof manifest.buildVersion).toBe('string');
            expect(Object.keys(manifest.resources).length).toBeGreaterThan(0);
        });
    });

    describe('buildPreviewFixedResourcesManifest', () => {
        // Run once against the real public/ tree; every assertion below reads
        // from this shared result.
        const manifest = buildPreviewFixedResourcesManifest();
        const resources: Record<string, { path: string; size: number }> = manifest.resources;

        it('declares schemaVersion 1 and the build version', () => {
            expect(manifest.schemaVersion).toBe(1);
            expect(manifest.buildVersion).toMatch(/^v/);
        });

        it('contains the base libraries the exporter always includes', () => {
            expect(resources['libs/jquery/jquery.min.js']).toMatchObject({ path: 'libs/jquery/jquery.min.js' });
            expect(resources['libs/bootstrap/bootstrap.bundle.min.js']).toBeDefined();
            expect(resources['libs/xapi/exe_xapi.js']).toMatchObject({ path: 'app/common/xapi/exe_xapi.js' });
            expect(resources['libs/exe_export.js']).toMatchObject({ path: 'app/common/exe_export.js' });
        });

        it('resolves content-detected libraries from both library roots', () => {
            // app/common/-rooted runtime (exporter serves it under libs/)
            expect(resources['libs/exe_wikipedia/exe_wikipedia.css']).toMatchObject({
                path: 'app/common/exe_wikipedia/exe_wikipedia.css',
            });
            // libs/-rooted third-party file
            expect(resources['libs/jquery-ui/jquery-ui.min.js']).toMatchObject({
                path: 'libs/jquery-ui/jquery-ui.min.js',
            });
            // isDirectory pattern pulls the whole tree (MathJax core, not just entry files)
            expect(Object.keys(resources).some(id => id.startsWith('libs/exe_math/'))).toBe(true);
        });

        it('includes PDF.js, at least one base theme and one base iDevice runtime', () => {
            expect(resources['libs/pdfjs/pdf.min.mjs']).toBeDefined();
            expect(resources['libs/pdfjs/pdf.worker.min.mjs']).toBeDefined();
            expect(Object.keys(resources).some(id => id.startsWith('theme:base/'))).toBe(true);
            expect(resources['idevices/text/text.js']).toMatchObject({
                path: 'files/perm/idevices/base/text/export/text.js',
            });
        });

        it('includes the content CSS, logo and global fonts under their export-path ids', () => {
            expect(resources['content/css/base.css']).toMatchObject({ path: 'style/workarea/base.css' });
            expect(resources['content/img/exe_powered_logo.png']).toMatchObject({
                path: 'app/common/exe_powered_logo/exe_powered_logo.png',
            });
            const fontIds = Object.keys(resources).filter(id => id.startsWith('fonts/global/'));
            expect(fontIds.length).toBeGreaterThan(0);
            expect(fontIds.every(id => /\.(woff2?|ttf|txt)$/.test(id))).toBe(true);
        });

        it('never emits absolute paths, traversal segments, zero sizes or test files', () => {
            for (const [id, entry] of Object.entries(resources)) {
                expect(entry.path.startsWith('/')).toBe(false);
                expect(path.isAbsolute(entry.path)).toBe(false);
                expect(entry.path.includes('..')).toBe(false);
                expect(id.includes('..')).toBe(false);
                expect(entry.size).toBeGreaterThan(0);
                expect(/\.(test|spec)\.js$/.test(id)).toBe(false);
            }
        });

        it('lists only base resources (no site/ or user-scoped paths)', () => {
            for (const entry of Object.values(resources)) {
                expect(entry.path.includes('themes/site/')).toBe(false);
                expect(entry.path.startsWith('files/perm/themes/') === false || entry.path.includes('/base/')).toBe(
                    true,
                );
            }
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
});
