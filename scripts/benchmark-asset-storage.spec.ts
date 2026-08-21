/**
 * Correctness tests for the asset storage benchmark (issue #2250).
 *
 * These tests only validate that the benchmark harness is correct (layouts,
 * counts, result structure) using tiny datasets. They intentionally assert no
 * timing thresholds — timings are environment-dependent and belong in the
 * benchmark's own report, not in CI.
 */
import { describe, it, expect } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
    layoutSegments,
    generateProjectUuids,
    runBenchmark,
    parseCliOptions,
    formatResultsTable,
    runCli,
} from './benchmark-asset-storage';

describe('benchmark-asset-storage', () => {
    describe('layoutSegments', () => {
        const uuid = 'ab12cd34-1234-4abc-8def-1234567890ab';

        it('produces the flat layout for 0 levels', () => {
            expect(layoutSegments(0, uuid)).toEqual([uuid]);
        });

        it('produces one two-hex level for 1 level', () => {
            expect(layoutSegments(1, uuid)).toEqual(['ab', uuid]);
        });

        it('produces two levels for 2 levels', () => {
            expect(layoutSegments(2, uuid)).toEqual(['ab', '12', uuid]);
        });

        it('produces three levels for 3 levels', () => {
            expect(layoutSegments(3, uuid)).toEqual(['ab', '12', 'cd', uuid]);
        });

        it('rejects unsupported depths', () => {
            expect(() => layoutSegments(4, uuid)).toThrow();
            expect(() => layoutSegments(-1, uuid)).toThrow();
        });
    });

    describe('generateProjectUuids', () => {
        it('generates the requested number of unique, deterministic UUIDs', () => {
            const uuids = generateProjectUuids(50, 42);
            expect(uuids.length).toBe(50);
            expect(new Set(uuids).size).toBe(50);
            for (const uuid of uuids) {
                expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
            }
            // Same seed -> same sequence (reproducibility).
            expect(generateProjectUuids(50, 42)).toEqual(uuids);
            // Different seed -> different sequence.
            expect(generateProjectUuids(50, 43)).not.toEqual(uuids);
        });
    });

    describe('runBenchmark', () => {
        it('creates the expected tree per level and reports consistent counts', async () => {
            const root = await fs.mkdtemp(path.join(os.tmpdir(), 'asset-bench-test-'));
            try {
                const results = await runBenchmark({
                    root,
                    projects: 20,
                    assetsPerProject: 2,
                    levels: [0, 1, 2, 3],
                    statSamples: 5,
                    seed: 7,
                });

                expect(results.length).toBe(4);
                for (const result of results) {
                    expect(result.projects).toBe(20);
                    expect(result.filesCreated).toBe(40);
                    // Full traversal must visit every asset file exactly once.
                    expect(result.traversal.files).toBe(40);
                    expect(result.traversal.bytes).toBeGreaterThan(0);
                    // Timings exist and are non-negative; no thresholds.
                    expect(result.createMs).toBeGreaterThanOrEqual(0);
                    expect(result.statMs).toBeGreaterThanOrEqual(0);
                    expect(result.traversalMs).toBeGreaterThanOrEqual(0);
                }

                const byLevel = new Map(results.map(r => [r.levels, r]));
                // 0 levels: root readdir sees one entry per project.
                expect(byLevel.get(0)!.rootEntries).toBe(20);
                // 1 level: root readdir sees at most 256 buckets and at most
                // one bucket per project (lazy creation, no empty buckets).
                expect(byLevel.get(1)!.rootEntries).toBeLessThanOrEqual(20);
                expect(byLevel.get(1)!.rootEntries).toBeGreaterThan(0);
            } finally {
                await fs.remove(root);
            }
        });

        it('cleans up its working directories between levels', async () => {
            const root = await fs.mkdtemp(path.join(os.tmpdir(), 'asset-bench-test-'));
            try {
                await runBenchmark({ root, projects: 3, assetsPerProject: 1, levels: [0, 1], statSamples: 2, seed: 1 });
                const entries = await fs.readdir(root);
                expect(entries.length).toBe(0);
            } finally {
                await fs.remove(root);
            }
        });
    });

    describe('parseCliOptions', () => {
        it('applies defaults when no flags are given', () => {
            const options = parseCliOptions(['bun', 'script.ts']);
            expect(options.projects).toBe(10000);
            expect(options.assetsPerProject).toBe(2);
            expect(options.levels).toEqual([0, 1, 2, 3]);
            expect(options.statSamples).toBe(2000);
            expect(options.seed).toBe(1);
            expect(options.root).toBeUndefined();
            expect(options.jsonOut).toBeUndefined();
        });

        it('parses explicit flags', () => {
            const options = parseCliOptions([
                'bun',
                'script.ts',
                '--projects',
                '500',
                '--assets',
                '3',
                '--levels',
                '0,1',
                '--stat-samples',
                '10',
                '--seed',
                '9',
                '--root',
                '/tmp/x',
                '--json',
                'out.json',
            ]);
            expect(options.projects).toBe(500);
            expect(options.assetsPerProject).toBe(3);
            expect(options.levels).toEqual([0, 1]);
            expect(options.statSamples).toBe(10);
            expect(options.seed).toBe(9);
            expect(options.root).toBe('/tmp/x');
            expect(options.jsonOut).toBe('out.json');
        });
    });

    describe('formatResultsTable', () => {
        it('renders one line per level plus a header', async () => {
            const root = await fs.mkdtemp(path.join(os.tmpdir(), 'asset-bench-test-'));
            try {
                const results = await runBenchmark({
                    root,
                    projects: 2,
                    assetsPerProject: 1,
                    levels: [0, 1],
                    statSamples: 1,
                    seed: 3,
                });
                const lines = formatResultsTable(results);
                expect(lines.length).toBe(3);
                expect(lines[0]).toContain('levels');
                expect(lines[1]).toStartWith('0');
                expect(lines[2]).toStartWith('1');
            } finally {
                await fs.remove(root);
            }
        });
    });

    describe('runCli', () => {
        it('runs end to end with injected IO, writes JSON, and cleans up its temp root', async () => {
            const jsonOut = path.join(os.tmpdir(), `asset-bench-cli-${Date.now()}.json`);
            const logged: string[] = [];
            try {
                await runCli({
                    argv: [
                        'bun',
                        'script.ts',
                        '--projects',
                        '3',
                        '--assets',
                        '1',
                        '--levels',
                        '0,1',
                        '--stat-samples',
                        '2',
                        '--json',
                        jsonOut,
                    ],
                    log: (message: string) => logged.push(message),
                });

                expect(logged.join('\n')).toContain('levels');
                const report = JSON.parse(await fs.readFile(jsonOut, 'utf-8'));
                expect(report.results.length).toBe(2);
                expect(report.environment.platform).toBe(os.platform());
                expect(report.options.projects).toBe(3);
            } finally {
                await fs.remove(jsonOut).catch(() => {});
            }
        });
    });
});
