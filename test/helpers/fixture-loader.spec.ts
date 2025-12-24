/**
 * Tests for fixture-loader utilities
 */
import { describe, it, expect, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import {
    getFixturesDir,
    getFixturePath,
    fixtureExists,
    getFixtureInfo,
    getAllFixtureNames,
    getSmallFixtureNames,
    getMediumFixtureNames,
    getLargeFixtureNames,
    getLegacyFixtureNames,
    getModernFixtureNames,
    getElpFixtureNames,
    getElpxFixtureNames,
    getQuickTestFixtureNames,
    readFixture,
    copyFixtureTo,
    createTempTestDir,
    cleanupTempTestDir,
    FIXTURES,
} from './fixture-loader';

describe('fixture-loader', () => {
    let tempDirs: string[] = [];

    afterEach(async () => {
        // Clean up any temp directories created during tests
        for (const dir of tempDirs) {
            await cleanupTempTestDir(dir);
        }
        tempDirs = [];
    });

    describe('getFixturesDir', () => {
        it('should return the fixtures directory path', () => {
            const dir = getFixturesDir();
            expect(dir).toContain('fixtures');
            expect(dir).toMatch(/test[/\\]fixtures$/);
        });
    });

    describe('getFixturePath', () => {
        it('should return full path for fixture', () => {
            const fixturePath = getFixturePath('basic-example.elp');
            expect(fixturePath).toContain('fixtures');
            expect(fixturePath).toContain('basic-example.elp');
        });
    });

    describe('fixtureExists', () => {
        it('should return true for existing fixture', async () => {
            const exists = await fixtureExists('basic-example.elp');
            expect(exists).toBe(true);
        });

        it('should return false for non-existent fixture', async () => {
            const exists = await fixtureExists('non-existent.elp');
            expect(exists).toBe(false);
        });
    });

    describe('getFixtureInfo', () => {
        it('should return info for existing fixture', async () => {
            const info = await getFixtureInfo('basic-example.elp');
            expect(info).not.toBeNull();
            expect(info!.name).toBe('basic-example.elp');
            expect(info!.format).toBe('elp');
            expect(info!.category).toBe('small');
            expect(info!.isLegacy).toBe(false);
            expect(info!.path).toBeDefined();
            expect(info!.size).toBeGreaterThan(0);
        });

        it('should return null for unknown fixture', async () => {
            const info = await getFixtureInfo('unknown-fixture.elp');
            expect(info).toBeNull();
        });

        it('should return null for fixture not on disk', async () => {
            // Save original FIXTURES and restore after test
            const _originalFixtures = { ...FIXTURES };
            // @ts-expect-error - modifying for test
            FIXTURES['fake-fixture.elp'] = {
                name: 'fake-fixture.elp',
                category: 'small',
                format: 'elp',
                isLegacy: false,
            };

            const info = await getFixtureInfo('fake-fixture.elp');
            expect(info).toBeNull();

            // Restore
            // @ts-expect-error - modifying for test
            delete FIXTURES['fake-fixture.elp'];
        });
    });

    describe('getAllFixtureNames', () => {
        it('should return array of all fixture names', () => {
            const names = getAllFixtureNames();
            expect(Array.isArray(names)).toBe(true);
            expect(names.length).toBeGreaterThan(0);
            expect(names).toContain('basic-example.elp');
        });
    });

    describe('getSmallFixtureNames', () => {
        it('should return only small fixtures', () => {
            const names = getSmallFixtureNames();
            expect(names.length).toBeGreaterThan(0);
            for (const name of names) {
                expect(FIXTURES[name].category).toBe('small');
            }
        });
    });

    describe('getMediumFixtureNames', () => {
        it('should return only medium fixtures', () => {
            const names = getMediumFixtureNames();
            expect(names.length).toBeGreaterThan(0);
            for (const name of names) {
                expect(FIXTURES[name].category).toBe('medium');
            }
        });
    });

    describe('getLargeFixtureNames', () => {
        it('should return only large fixtures', () => {
            const names = getLargeFixtureNames();
            expect(names.length).toBeGreaterThan(0);
            for (const name of names) {
                expect(FIXTURES[name].category).toBe('large');
            }
        });
    });

    describe('getLegacyFixtureNames', () => {
        it('should return only legacy fixtures', () => {
            const names = getLegacyFixtureNames();
            expect(names.length).toBeGreaterThan(0);
            for (const name of names) {
                expect(FIXTURES[name].isLegacy).toBe(true);
            }
        });
    });

    describe('getModernFixtureNames', () => {
        it('should return only modern fixtures', () => {
            const names = getModernFixtureNames();
            expect(names.length).toBeGreaterThan(0);
            for (const name of names) {
                expect(FIXTURES[name].isLegacy).toBe(false);
            }
        });
    });

    describe('getElpFixtureNames', () => {
        it('should return only ELP fixtures', () => {
            const names = getElpFixtureNames();
            expect(names.length).toBeGreaterThan(0);
            for (const name of names) {
                expect(FIXTURES[name].format).toBe('elp');
                expect(name.endsWith('.elp')).toBe(true);
            }
        });
    });

    describe('getElpxFixtureNames', () => {
        it('should return only ELPX fixtures', () => {
            const names = getElpxFixtureNames();
            expect(names.length).toBeGreaterThan(0);
            for (const name of names) {
                expect(FIXTURES[name].format).toBe('elpx');
                expect(name.endsWith('.elpx')).toBe(true);
            }
        });
    });

    describe('getQuickTestFixtureNames', () => {
        it('should return small modern fixtures', () => {
            const names = getQuickTestFixtureNames();
            expect(names.length).toBeGreaterThan(0);
            for (const name of names) {
                expect(FIXTURES[name].category).toBe('small');
                expect(FIXTURES[name].isLegacy).toBe(false);
            }
        });
    });

    describe('readFixture', () => {
        it('should read fixture file as buffer', async () => {
            const buffer = await readFixture('basic-example.elp');
            expect(buffer).toBeInstanceOf(Buffer);
            expect(buffer.length).toBeGreaterThan(0);
            // ZIP files start with PK signature
            expect(buffer[0]).toBe(0x50); // P
            expect(buffer[1]).toBe(0x4b); // K
        });
    });

    describe('copyFixtureTo', () => {
        it('should copy fixture to destination', async () => {
            const tempDir = await createTempTestDir('copy-test-');
            tempDirs.push(tempDir);

            const copiedPath = await copyFixtureTo('basic-example.elp', tempDir);
            expect(copiedPath).toContain(tempDir);
            expect(copiedPath).toContain('basic-example.elp');
            expect(await fs.pathExists(copiedPath)).toBe(true);
        });
    });

    describe('createTempTestDir', () => {
        it('should create temp directory with default prefix', async () => {
            const tempDir = await createTempTestDir();
            tempDirs.push(tempDir);

            expect(await fs.pathExists(tempDir)).toBe(true);
            expect(tempDir).toContain('test-');
        });

        it('should create temp directory with custom prefix', async () => {
            const tempDir = await createTempTestDir('custom-prefix-');
            tempDirs.push(tempDir);

            expect(await fs.pathExists(tempDir)).toBe(true);
            expect(tempDir).toContain('custom-prefix-');
        });
    });

    describe('cleanupTempTestDir', () => {
        it('should clean up temp directory', async () => {
            const tempDir = await createTempTestDir('cleanup-test-');
            expect(await fs.pathExists(tempDir)).toBe(true);

            await cleanupTempTestDir(tempDir);
            expect(await fs.pathExists(tempDir)).toBe(false);
        });

        it('should not delete directories without temp in path', async () => {
            // This shouldn't delete anything because it doesn't contain 'temp'
            const safePath = '/tmp/test-safe-dir';
            // Just verify the function doesn't throw
            await cleanupTempTestDir(safePath);
        });

        it('should handle non-existent directory', async () => {
            // Should not throw
            await cleanupTempTestDir('/non/existent/path/temp/dir');
        });
    });
});
