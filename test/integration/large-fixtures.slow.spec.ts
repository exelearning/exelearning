/**
 * Slow test suite for large ELP/ELPX fixtures (> 5MB)
 * These tests take longer to run and should be separated from CI
 *
 * Migrated from NestJS to Elysia - uses direct function imports
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import { extractZip, listZipContents } from '../../src/services/zip';
import { parseFromFile } from '../../src/services/xml/xml-parser';
import {
    getFixturePath,
    getLargeFixtureNames,
    FIXTURES,
    createTempTestDir,
    cleanupTempTestDir,
    getFixtureInfo,
} from '../helpers/fixture-loader';

describe('Large ELP/ELPX Fixtures - Slow Tests', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await createTempTestDir('large-fixture-');
    });

    afterEach(async () => {
        await cleanupTempTestDir(tempDir);
    });

    describe('Large Fixtures (> 5MB)', () => {
        const largeFixtures = getLargeFixtureNames();

        // Only run if fixtures exist
        const existingFixtures = largeFixtures.filter(name => {
            const fixturePath = getFixturePath(name);
            return fs.pathExistsSync(fixturePath);
        });

        if (existingFixtures.length === 0) {
            it.skip('No large fixtures available', () => {});
        } else {
            for (const fixtureName of existingFixtures) {
                const fixtureInfo = FIXTURES[fixtureName];

                describe(`Fixture: ${fixtureName}`, () => {
                    it('should be a valid ZIP file (can list contents)', async () => {
                        const fixturePath = getFixturePath(fixtureName);
                        const contents = await listZipContents(fixturePath);
                        expect(contents.length).toBeGreaterThan(0);
                    }, 60000);

                    it('should extract without errors', async () => {
                        const fixturePath = getFixturePath(fixtureName);
                        const extractDir = path.join(tempDir, fixtureName.replace(/\./g, '_'));

                        const extractedFiles = await extractZip(fixturePath, extractDir);

                        expect(extractedFiles.length).toBeGreaterThan(0);
                        expect(await fs.pathExists(extractDir)).toBe(true);
                    }, 120000); // 2 minutes for large files

                    it(`should have ${fixtureInfo.isLegacy ? 'contentv3.xml' : 'content.xml'}`, async () => {
                        const fixturePath = getFixturePath(fixtureName);
                        const extractDir = path.join(tempDir, `${fixtureName}_content`);

                        await extractZip(fixturePath, extractDir);

                        const expectedFile = fixtureInfo.isLegacy ? 'contentv3.xml' : 'content.xml';
                        const contentPath = path.join(extractDir, expectedFile);
                        expect(await fs.pathExists(contentPath)).toBe(true);
                    }, 120000);

                    it('should parse XML structure successfully', async () => {
                        const fixturePath = getFixturePath(fixtureName);
                        const extractDir = path.join(tempDir, `${fixtureName}_parse`);

                        await extractZip(fixturePath, extractDir);

                        const contentFile = fixtureInfo.isLegacy ? 'contentv3.xml' : 'content.xml';
                        const contentPath = path.join(extractDir, contentFile);

                        const structure = await parseFromFile(contentPath, 'test-session');

                        expect(structure).toBeDefined();
                        expect(structure.meta).toBeDefined();
                        expect(structure.pages).toBeDefined();
                        expect(Array.isArray(structure.pages)).toBe(true);
                    }, 180000); // 3 minutes for parsing large XMLs

                    it('should have complex structure with many pages', async () => {
                        const fixturePath = getFixturePath(fixtureName);
                        const extractDir = path.join(tempDir, `${fixtureName}_complex`);

                        await extractZip(fixturePath, extractDir);

                        const contentFile = fixtureInfo.isLegacy ? 'contentv3.xml' : 'content.xml';
                        const contentPath = path.join(extractDir, contentFile);

                        const structure = await parseFromFile(contentPath, 'test-session');

                        // Large fixtures should have many pages
                        expect(structure.pages.length).toBeGreaterThan(5);
                    }, 180000);

                    it('should contain many resources', async () => {
                        const fixturePath = getFixturePath(fixtureName);

                        const contents = await listZipContents(fixturePath);

                        // Large fixtures should have many files
                        expect(contents.length).toBeGreaterThan(10);

                        // Should have various resource types
                        const hasImages = contents.some(f => /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f));
                        expect(hasImages).toBe(true);
                    }, 60000);

                    it('should have deep page hierarchy', async () => {
                        const fixturePath = getFixturePath(fixtureName);
                        const extractDir = path.join(tempDir, `${fixtureName}_hierarchy`);

                        await extractZip(fixturePath, extractDir);

                        const contentFile = fixtureInfo.isLegacy ? 'contentv3.xml' : 'content.xml';
                        const contentPath = path.join(extractDir, contentFile);

                        const structure = await parseFromFile(contentPath, 'test-session');

                        // Find maximum page level
                        const maxLevel = Math.max(...structure.pages.map(p => p.level));

                        // Large fixtures typically have nested hierarchy
                        expect(maxLevel).toBeGreaterThanOrEqual(1);
                    }, 180000);
                });
            }
        }
    });

    describe('Performance Benchmarks', () => {
        const largeFixtures = getLargeFixtureNames().filter(name => {
            const fixturePath = getFixturePath(name);
            return fs.pathExistsSync(fixturePath);
        });

        if (largeFixtures.length === 0) {
            it.skip('No large fixtures available for benchmarks', () => {});
        } else {
            it('should extract all large fixtures within timeout', async () => {
                const results: { name: string; size: number; extractTime: number }[] = [];

                for (const fixtureName of largeFixtures) {
                    const fixturePath = getFixturePath(fixtureName);
                    const extractDir = path.join(tempDir, `bench_${fixtureName.replace(/\./g, '_')}`);

                    const info = await getFixtureInfo(fixtureName);
                    const startTime = Date.now();

                    await extractZip(fixturePath, extractDir);

                    const extractTime = Date.now() - startTime;

                    results.push({
                        name: fixtureName,
                        size: info?.size || 0,
                        extractTime,
                    });
                }

                // Log benchmark results
                console.log('\n=== Extraction Benchmark Results ===');
                for (const result of results) {
                    const sizeMB = (result.size / (1024 * 1024)).toFixed(2);
                    console.log(`${result.name}: ${sizeMB}MB in ${result.extractTime}ms`);
                }

                // All extractions should complete (test passes if we reach here)
                expect(results.length).toBe(largeFixtures.length);
            }, 300000); // 5 minutes total

            it('should parse all large fixtures within timeout', async () => {
                const results: { name: string; parseTime: number; pageCount: number }[] = [];

                for (const fixtureName of largeFixtures) {
                    const fixturePath = getFixturePath(fixtureName);
                    const fixtureInfo = FIXTURES[fixtureName];
                    const extractDir = path.join(tempDir, `bench_parse_${fixtureName.replace(/\./g, '_')}`);

                    await extractZip(fixturePath, extractDir);

                    const contentFile = fixtureInfo.isLegacy ? 'contentv3.xml' : 'content.xml';
                    const contentPath = path.join(extractDir, contentFile);

                    const startTime = Date.now();
                    const structure = await parseFromFile(contentPath, 'test-session');
                    const parseTime = Date.now() - startTime;

                    results.push({
                        name: fixtureName,
                        parseTime,
                        pageCount: structure.pages.length,
                    });
                }

                // Log benchmark results
                console.log('\n=== Parse Benchmark Results ===');
                for (const result of results) {
                    console.log(`${result.name}: ${result.pageCount} pages parsed in ${result.parseTime}ms`);
                }

                // All parses should complete
                expect(results.length).toBe(largeFixtures.length);
            }, 600000); // 10 minutes total
        }
    });

    describe('Memory Usage', () => {
        const largeFixtures = getLargeFixtureNames().filter(name => {
            const fixturePath = getFixturePath(name);
            return fs.pathExistsSync(fixturePath);
        });

        if (largeFixtures.length === 0) {
            it.skip('No large fixtures available for memory tests', () => {});
        } else {
            it('should not exceed memory limits when processing large files', async () => {
                // Get initial memory usage
                const initialMemory = process.memoryUsage().heapUsed;

                // Process the largest fixture
                const fixtureName = largeFixtures[largeFixtures.length - 1]; // Largest is usually last
                const fixturePath = getFixturePath(fixtureName);
                const fixtureInfo = FIXTURES[fixtureName];
                const extractDir = path.join(tempDir, 'memory_test');

                await extractZip(fixturePath, extractDir);

                const contentFile = fixtureInfo.isLegacy ? 'contentv3.xml' : 'content.xml';
                const contentPath = path.join(extractDir, contentFile);

                await parseFromFile(contentPath, 'test-session');

                // Check memory usage
                const finalMemory = process.memoryUsage().heapUsed;
                const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024);

                console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`);

                // Should not use more than 500MB additional memory
                expect(memoryIncrease).toBeLessThan(500);
            }, 180000);
        }
    });

    describe('Content Integrity', () => {
        it('should preserve all resources after extraction', async () => {
            const largeFixtures = getLargeFixtureNames().filter(name => {
                const fixturePath = getFixturePath(name);
                return fs.pathExistsSync(fixturePath);
            });

            const fixtureName = largeFixtures[0];
            if (!fixtureName) {
                return;
            }

            const fixturePath = getFixturePath(fixtureName);
            const extractDir = path.join(tempDir, 'integrity_test');

            // List contents before extraction
            const zipContents = await listZipContents(fixturePath);

            // Extract
            await extractZip(fixturePath, extractDir);

            // Verify all files exist
            let missingFiles = 0;
            for (const file of zipContents) {
                const extractedPath = path.join(extractDir, file);
                if (!(await fs.pathExists(extractedPath))) {
                    missingFiles++;
                }
            }

            expect(missingFiles).toBe(0);
        }, 180000);
    });
});
