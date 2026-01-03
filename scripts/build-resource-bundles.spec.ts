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
