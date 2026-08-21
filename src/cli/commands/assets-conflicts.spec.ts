/**
 * Tests for the Assets Conflicts Command (issue #2287)
 */
import { describe, it, expect } from 'bun:test';
import { execute, printHelp, runCli, type AssetsConflictsDependencies } from './assets-conflicts';
import type { AssetStorageConflict, ResolveConflictResult } from '../../services/asset-conflicts';

describe('Assets Conflicts Command', () => {
    const sampleConflict: AssetStorageConflict = {
        assetId: 123,
        projectUuid: 'ab12cd34-1234-4abc-8def-1234567890ab',
        filename: 'photo.png',
        storedPath: 'assets/ab12cd34-1234-4abc-8def-1234567890ab/photo.png',
        canonicalStoredPath: 'assets/ab/ab12cd34-1234-4abc-8def-1234567890ab/photo.png',
        legacyPath: '/data/assets/ab12cd34-1234-4abc-8def-1234567890ab/photo.png',
        canonicalPath: '/data/assets/ab/ab12cd34-1234-4abc-8def-1234567890ab/photo.png',
        legacySize: 14,
        canonicalSize: 17,
        legacyMtime: '2026-08-01T10:00:00.000Z',
        canonicalMtime: '2026-08-02T11:00:00.000Z',
    };

    function createDeps(options: { conflicts?: AssetStorageConflict[]; resolveResult?: ResolveConflictResult } = {}) {
        const { conflicts = [], resolveResult = { success: true, resolved: true, message: 'resolved' } } = options;
        const resolveCalls: Array<{ assetId: number; choice: string; dryRun: boolean }> = [];
        const deps: AssetsConflictsDependencies = {
            listConflicts: async () => conflicts,
            resolveConflict: async (assetId, choice, resolveOptions = {}) => {
                resolveCalls.push({ assetId, choice, dryRun: resolveOptions.dryRun === true });
                return resolveResult;
            },
        };
        return { deps, resolveCalls };
    }

    describe('list', () => {
        it('reports when there are no conflicts', async () => {
            const { deps } = createDeps();

            const result = await execute([], {}, deps);

            expect(result.success).toBe(true);
            expect(result.message).toContain('No unresolved asset storage conflicts');
        });

        it('lists conflicts with both absolute paths, sizes, mtimes and a resolve hint', async () => {
            const { deps } = createDeps({ conflicts: [sampleConflict] });

            const result = await execute(['list'], {}, deps);

            expect(result.success).toBe(true);
            expect(result.message).toContain('Asset 123');
            expect(result.message).toContain(sampleConflict.projectUuid);
            expect(result.message).toContain(sampleConflict.legacyPath);
            expect(result.message).toContain(sampleConflict.canonicalPath);
            expect(result.message).toContain('14 bytes');
            expect(result.message).toContain('17 bytes');
            expect(result.message).toContain('2026-08-01T10:00:00.000Z');
            expect(result.message).toContain('resolve <asset-id> --keep-old | --keep-new');
        });

        it('outputs machine-parseable JSON with --json', async () => {
            const { deps } = createDeps({ conflicts: [sampleConflict] });

            const result = await execute(['list'], { json: true }, deps);

            expect(result.success).toBe(true);
            expect(result.raw).toBe(true);
            const parsed = JSON.parse(result.message);
            expect(parsed).toHaveLength(1);
            expect(parsed[0].assetId).toBe(123);
        });
    });

    describe('resolve', () => {
        it('requires a positive integer asset id', async () => {
            const { deps, resolveCalls } = createDeps();

            for (const positional of [['resolve'], ['resolve', 'abc'], ['resolve', '-3'], ['resolve', '1.5']]) {
                const result = await execute(positional, { 'keep-new': true }, deps);
                expect(result.success).toBe(false);
                expect(result.message).toContain('Usage:');
            }
            expect(resolveCalls).toHaveLength(0);
        });

        it('requires exactly one of --keep-old / --keep-new', async () => {
            const { deps, resolveCalls } = createDeps();

            const neither = await execute(['resolve', '123'], {}, deps);
            expect(neither.success).toBe(false);
            expect(neither.message).toContain('exactly one');

            const both = await execute(['resolve', '123'], { 'keep-old': true, 'keep-new': true }, deps);
            expect(both.success).toBe(false);
            expect(both.message).toContain('exactly one');

            expect(resolveCalls).toHaveLength(0);
        });

        it('delegates keep-new resolution to the service', async () => {
            const { deps, resolveCalls } = createDeps();

            const result = await execute(['resolve', '123'], { 'keep-new': true }, deps);

            expect(result.success).toBe(true);
            expect(resolveCalls).toEqual([{ assetId: 123, choice: 'keep-new', dryRun: false }]);
        });

        it('delegates keep-old with --dry-run to the service', async () => {
            const { deps, resolveCalls } = createDeps();

            await execute(['resolve', '42'], { 'keep-old': true, 'dry-run': true }, deps);

            expect(resolveCalls).toEqual([{ assetId: 42, choice: 'keep-old', dryRun: true }]);
        });

        it('propagates a failed resolution', async () => {
            const { deps } = createDeps({
                resolveResult: { success: false, resolved: false, message: 'changed concurrently' },
            });

            const result = await execute(['resolve', '123'], { 'keep-new': true }, deps);

            expect(result.success).toBe(false);
            expect(result.message).toContain('concurrently');
        });
    });

    it('rejects unknown subcommands', async () => {
        const { deps } = createDeps();

        const result = await execute(['frobnicate'], {}, deps);

        expect(result.success).toBe(false);
        expect(result.message).toContain('frobnicate');
    });

    describe('runCli', () => {
        it('exits 0 and prints help with --help', async () => {
            let exitCode: number | undefined;

            await runCli(['bun', 'cli', 'assets:conflicts', '--help'], createDeps().deps, code => {
                exitCode = code;
            });

            expect(exitCode).toBe(0);
        });

        it('exits 0 on a successful list', async () => {
            let exitCode: number | undefined;

            await runCli(['bun', 'cli', 'assets:conflicts'], createDeps().deps, code => {
                exitCode = code;
            });

            expect(exitCode).toBe(0);
        });

        it('exits 0 printing raw JSON with --json', async () => {
            let exitCode: number | undefined;
            const { deps } = createDeps({ conflicts: [sampleConflict] });

            await runCli(['bun', 'cli', 'assets:conflicts', 'list', '--json'], deps, code => {
                exitCode = code;
            });

            expect(exitCode).toBe(0);
        });

        it('exits 0 on a dry-run resolve', async () => {
            let exitCode: number | undefined;
            const { deps } = createDeps({
                resolveResult: { success: true, resolved: false, message: '[dry-run] would resolve' },
            });

            await runCli(
                ['bun', 'cli', 'assets:conflicts', 'resolve', '123', '--keep-new', '--dry-run'],
                deps,
                code => {
                    exitCode = code;
                },
            );

            expect(exitCode).toBe(0);
        });

        it('exits non-zero on failure', async () => {
            let exitCode: number | undefined;

            await runCli(['bun', 'cli', 'assets:conflicts', 'resolve'], createDeps().deps, code => {
                exitCode = code;
            });

            expect(exitCode).not.toBe(0);
        });

        it('exits non-zero when the service throws', async () => {
            let exitCode: number | undefined;
            const deps: AssetsConflictsDependencies = {
                listConflicts: async () => {
                    throw new Error('disk on fire');
                },
                resolveConflict: async () => ({ success: true, resolved: true, message: 'unused' }),
            };

            await runCli(['bun', 'cli', 'assets:conflicts'], deps, code => {
                exitCode = code;
            });

            expect(exitCode).not.toBe(0);
        });
    });

    it('printHelp does not throw', () => {
        expect(() => printHelp()).not.toThrow();
    });
});
