/**
 * Asset storage layout benchmark (issue #2250 / ADR-2250-01).
 *
 * Compares directory sharding depths for the project asset store:
 *
 *     0 levels: assets/<uuid>/
 *     1 level:  assets/aa/<uuid>/                (the layout adopted by ADR-2250-01)
 *     2 levels: assets/aa/bb/<uuid>/
 *     3 levels: assets/aa/bb/cc/<uuid>/
 *
 * For each depth it creates N projects with M small asset files, then measures:
 *   - creation time (directories + files),
 *   - known-path stat() lookups (random sample),
 *   - readdir of the assets root and of one bucket,
 *   - a complete recursive traversal (files visited + bytes, du-style).
 *
 * The sharding decision is preventive, not driven by a measured failure —
 * run this on the storage backend you actually deploy on (local ext4/NVMe,
 * NFS, SAN, ...) before drawing conclusions, and do not extrapolate local
 * results to network filesystems. Timings are wall-clock and environment
 * dependent; this script is NOT part of CI (its spec only checks correctness).
 *
 * Usage:
 *     bun run scripts/benchmark-asset-storage.ts --projects 20000 --assets 3
 *     bun run scripts/benchmark-asset-storage.ts --projects 200000 --levels 0,1 --json out.json
 *
 * Options:
 *     --projects N       number of projects per layout (default 10000)
 *     --assets M         asset files per project (default 2)
 *     --levels a,b,...   sharding depths to test (default 0,1,2,3)
 *     --root DIR         working directory (default: a temp dir; DELETED afterwards)
 *     --stat-samples N   number of random known-path lookups (default 2000)
 *     --seed N           RNG seed for reproducible UUID sets (default 1)
 *     --json FILE        also write results as JSON
 */
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// Pure helpers (unit tested)
// ============================================================================

/**
 * Directory segments for a project under a given sharding depth, using
 * consecutive two-hex-character prefixes of the UUID per level.
 */
export function layoutSegments(levels: number, uuid: string): string[] {
    if (!Number.isInteger(levels) || levels < 0 || levels > 3) {
        throw new Error(`Unsupported sharding depth: ${levels}`);
    }
    const segments: string[] = [];
    for (let i = 0; i < levels; i++) {
        segments.push(uuid.slice(i * 2, i * 2 + 2));
    }
    segments.push(uuid);
    return segments;
}

/**
 * Deterministic pseudo-random UUIDv4-shaped identifiers (mulberry32 PRNG),
 * so runs with the same seed operate on identical directory sets.
 */
export function generateProjectUuids(count: number, seed: number): string[] {
    let state = seed >>> 0;
    const next = (): number => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const hex = (n: number): string => Math.floor(next() * 16 ** n).toString(16).padStart(n, '0');
    const uuids: string[] = [];
    const seen = new Set<string>();
    while (uuids.length < count) {
        const uuid = `${hex(8)}-${hex(4)}-4${hex(3)}-${((Math.floor(next() * 4) + 8).toString(16) + hex(3)).slice(0, 4)}-${hex(8)}${hex(4)}`;
        if (!seen.has(uuid)) {
            seen.add(uuid);
            uuids.push(uuid);
        }
    }
    return uuids;
}

// ============================================================================
// Benchmark
// ============================================================================

export interface BenchmarkOptions {
    root: string;
    projects: number;
    assetsPerProject: number;
    levels: number[];
    statSamples: number;
    seed: number;
}

export interface LevelResult {
    levels: number;
    projects: number;
    filesCreated: number;
    createMs: number;
    statMs: number;
    statSamples: number;
    rootReaddirMs: number;
    rootEntries: number;
    bucketReaddirMs: number;
    bucketEntries: number;
    traversalMs: number;
    traversal: { files: number; directories: number; bytes: number };
}

async function traverse(dir: string): Promise<{ files: number; directories: number; bytes: number }> {
    const totals = { files: 0, directories: 0, bytes: 0 };
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            totals.directories++;
            const sub = await traverse(entryPath);
            totals.files += sub.files;
            totals.directories += sub.directories;
            totals.bytes += sub.bytes;
        } else {
            totals.files++;
            const stat = await fs.stat(entryPath);
            totals.bytes += stat.size;
        }
    }
    return totals;
}

/**
 * Run the benchmark for every requested sharding depth. Each depth gets a
 * fresh tree under `<root>/level-<n>/assets`, removed before the next depth
 * so disk usage stays bounded.
 */
export async function runBenchmark(options: BenchmarkOptions): Promise<LevelResult[]> {
    const { root, projects, assetsPerProject, levels, statSamples, seed } = options;
    const uuids = generateProjectUuids(projects, seed);
    const payload = Buffer.from('exelearning-benchmark-asset-payload\n');
    const results: LevelResult[] = [];

    for (const depth of levels) {
        const assetsRoot = path.join(root, `level-${depth}`, 'assets');
        await fs.ensureDir(assetsRoot);

        // ---- creation --------------------------------------------------------
        const createStart = performance.now();
        let filesCreated = 0;
        for (const uuid of uuids) {
            const projectDir = path.join(assetsRoot, ...layoutSegments(depth, uuid));
            await fs.ensureDir(projectDir);
            for (let i = 0; i < assetsPerProject; i++) {
                await fs.writeFile(path.join(projectDir, `asset-${i}.bin`), payload);
                filesCreated++;
            }
        }
        const createMs = performance.now() - createStart;

        // ---- known-path lookups ---------------------------------------------
        let state = seed >>> 0;
        const nextIndex = (): number => {
            state = (state * 1664525 + 1013904223) >>> 0;
            return state % uuids.length;
        };
        const samples = Math.min(statSamples, uuids.length * assetsPerProject);
        const statStart = performance.now();
        for (let i = 0; i < samples; i++) {
            const uuid = uuids[nextIndex()];
            const file = path.join(assetsRoot, ...layoutSegments(depth, uuid), `asset-${i % assetsPerProject}.bin`);
            await fs.stat(file);
        }
        const statMs = performance.now() - statStart;

        // ---- readdir of the root and of one bucket --------------------------
        const rootStart = performance.now();
        const rootEntryNames = await fs.readdir(assetsRoot);
        const rootReaddirMs = performance.now() - rootStart;

        const bucketDir = depth === 0 ? assetsRoot : path.join(assetsRoot, rootEntryNames[0]);
        const bucketStart = performance.now();
        const bucketEntryNames = await fs.readdir(bucketDir);
        const bucketReaddirMs = performance.now() - bucketStart;

        // ---- complete recursive traversal (du-style) -------------------------
        const traversalStart = performance.now();
        const traversal = await traverse(assetsRoot);
        const traversalMs = performance.now() - traversalStart;

        results.push({
            levels: depth,
            projects,
            filesCreated,
            createMs,
            statMs,
            statSamples: samples,
            rootReaddirMs,
            rootEntries: rootEntryNames.length,
            bucketReaddirMs,
            bucketEntries: bucketEntryNames.length,
            traversalMs,
            traversal,
        });

        await fs.remove(path.join(root, `level-${depth}`));
    }

    return results;
}

// ============================================================================
// CLI
// ============================================================================

export interface CliOptions {
    projects: number;
    assetsPerProject: number;
    levels: number[];
    statSamples: number;
    seed: number;
    root?: string;
    jsonOut?: string;
}

/** Parse CLI flags (see the header comment for the option list). */
export function parseCliOptions(argv: string[]): CliOptions {
    const getArg = (name: string): string | undefined => {
        const index = argv.indexOf(`--${name}`);
        return index !== -1 ? argv[index + 1] : undefined;
    };
    return {
        projects: parseInt(getArg('projects') ?? '10000', 10),
        assetsPerProject: parseInt(getArg('assets') ?? '2', 10),
        levels: (getArg('levels') ?? '0,1,2,3').split(',').map(v => parseInt(v, 10)),
        statSamples: parseInt(getArg('stat-samples') ?? '2000', 10),
        seed: parseInt(getArg('seed') ?? '1', 10),
        root: getArg('root'),
        jsonOut: getArg('json'),
    };
}

/** Render the human-readable results table (header + one line per level). */
export function formatResultsTable(results: LevelResult[]): string[] {
    const lines = [
        `levels | create(ms) | stat x${results[0]?.statSamples ?? 0}(ms) | root readdir(ms/entries) | traversal(ms/files)`,
    ];
    for (const result of results) {
        lines.push(
            `${result.levels}      | ${result.createMs.toFixed(0).padStart(10)} | ${result.statMs
                .toFixed(0)
                .padStart(12)} | ${result.rootReaddirMs.toFixed(1)}ms / ${result.rootEntries} | ${result.traversalMs.toFixed(
                0,
            )}ms / ${result.traversal.files}`,
        );
    }
    return lines;
}

export interface CliDeps {
    argv: string[];
    log: (message: string) => void;
}

/** CLI entrypoint with injected IO so the whole flow is testable. */
export async function runCli(deps: CliDeps): Promise<void> {
    const options = parseCliOptions(deps.argv);
    const root = options.root ?? (await fs.mkdtemp(path.join(os.tmpdir(), 'exe-asset-bench-')));

    const environment = {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        cpus: os.cpus()[0]?.model ?? 'unknown',
        bun: typeof Bun !== 'undefined' ? Bun.version : 'n/a',
        root,
        note: 'Record the filesystem type and mount options of the root path (e.g. `df -T`, `mount`) alongside these numbers.',
    };

    deps.log(`[bench] environment: ${JSON.stringify(environment, null, 2)}`);
    deps.log(
        `[bench] projects=${options.projects} assetsPerProject=${options.assetsPerProject} levels=${options.levels.join(',')}`,
    );

    const results = await runBenchmark({
        root,
        projects: options.projects,
        assetsPerProject: options.assetsPerProject,
        levels: options.levels,
        statSamples: options.statSamples,
        seed: options.seed,
    });

    for (const line of formatResultsTable(results)) {
        deps.log(line);
    }

    if (options.jsonOut) {
        await fs.writeFile(
            options.jsonOut,
            JSON.stringify(
                {
                    environment,
                    options: {
                        projects: options.projects,
                        assetsPerProject: options.assetsPerProject,
                        levels: options.levels,
                        statSamples: options.statSamples,
                        seed: options.seed,
                    },
                    results,
                },
                null,
                2,
            ),
        );
        deps.log(`[bench] JSON written to ${options.jsonOut}`);
    }

    if (!options.root) {
        await fs.remove(root);
    }
}

if (import.meta.main) {
    runCli({ argv: process.argv, log: console.log }).catch(err => {
        console.error(err);
        process.exit(1);
    });
}
