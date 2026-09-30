/**
 * Centralized build for TypeScript-based iDevices.
 *
 * Any iDevice under `public/files/perm/idevices/base/<name>/` that keeps its
 * maintained source in a `src/` directory is built by CONVENTION:
 *
 *   src/edition/index.ts  ->  edition/<name>.js
 *   src/export/index.ts   ->  export/<name>.js
 *
 * Each bundle is a self-contained classic-script IIFE (browser target, no
 * chunks, linked source maps, unminified) whose entry point explicitly
 * assigns its window global(s). Generated bundles and maps are gitignored.
 *
 * An iDevice that needs to deviate ships a `build.config.json` next to its
 * `config.xml`, which REPLACES the convention for that iDevice:
 *
 *   {
 *       "entries": [
 *           {
 *               "entry": "src/index.ts",             // relative to the iDevice dir
 *               "outdir": "edition",                  // relative to the iDevice dir
 *               "naming": "[dir]/slide-editor.bundle.[ext]",
 *               "globalName": "__slideEditorInit",   // optional IIFE global
 *               "minify": true,                       // default false
 *               "sourcemap": "none",                  // default "linked"
 *               "externals": {                        // import name -> window global
 *                   "fabric": "fabric",
 *                   "dompurify": { "global": "DOMPurify", "default": true }
 *               }
 *           }
 *       ]
 *   }
 *
 * `externals` maps a bare import specifier to a global the page already
 * provides (vendored under public/libs/), so the library is never inlined.
 * With `"default": true` the shim also exposes the global as the module's
 * default export (what `import X from '...'` consumers need).
 *
 * Type checking: every discovered iDevice that ships a `tsconfig.json` is
 * checked with `tsc -p` (see --typecheck-only / --typecheck).
 *
 * Usage:
 *   bun scripts/build-idevices.ts                  # build every TS iDevice
 *   bun scripts/build-idevices.ts --typecheck-only # tsc -p only, no build
 *   bun scripts/build-idevices.ts --typecheck      # tsc -p, then build
 *   bun scripts/build-idevices.ts --watch          # rebuild on src changes
 *   bun scripts/build-idevices.ts --only slide     # filter (comma-separated)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { existsSync, readdirSync, readFileSync, watch } from 'fs';
import { join, resolve } from 'path';

export const IDEVICES_BASE = resolve(import.meta.dir, '..', 'public/files/perm/idevices/base');

type SourcemapMode = 'linked' | 'none' | 'inline' | 'external';

export interface ExternalSpec {
    global: string;
    default: boolean;
}

export interface BundleEntry {
    /** iDevice folder name (also the default bundle basename). */
    idevice: string;
    /** Short label for logs, e.g. 'interactive-video/edition'. */
    label: string;
    entrypoint: string;
    outdir: string;
    naming: string;
    globalName?: string;
    minify: boolean;
    sourcemap: SourcemapMode;
    externals: Record<string, ExternalSpec>;
}

export interface TsIdevice {
    name: string;
    dir: string;
    srcDir: string;
    tsconfig: string | null;
    entries: BundleEntry[];
}

function normalizeExternals(value: unknown): Record<string, ExternalSpec> {
    const out: Record<string, ExternalSpec> = {};
    if (!value || typeof value !== 'object') {
        return out;
    }
    for (const [name, spec] of Object.entries(value as Record<string, unknown>)) {
        if (typeof spec === 'string') {
            out[name] = { global: spec, default: false };
        } else if (spec && typeof spec === 'object' && typeof (spec as { global?: unknown }).global === 'string') {
            out[name] = {
                global: (spec as { global: string }).global,
                default: (spec as { default?: unknown }).default === true,
            };
        }
    }
    return out;
}

/** The build entries of one iDevice: its manifest, or the src/ convention. */
export function resolveEntries(name: string, dir: string): BundleEntry[] {
    const manifestPath = join(dir, 'build.config.json');
    if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
            entries?: Array<Record<string, unknown>>;
        };
        return (manifest.entries || []).map((raw, index) => {
            const entry = String(raw.entry || '');
            const outdir = String(raw.outdir || '');
            if (!entry || !outdir) {
                throw new Error(`${name}/build.config.json: entries[${index}] needs "entry" and "outdir"`);
            }
            return {
                idevice: name,
                label: `${name}/${outdir}`,
                entrypoint: join(dir, entry),
                outdir: join(dir, outdir),
                naming: typeof raw.naming === 'string' ? raw.naming : `[dir]/${name}.[ext]`,
                globalName: typeof raw.globalName === 'string' ? raw.globalName : undefined,
                minify: raw.minify === true,
                sourcemap: (typeof raw.sourcemap === 'string' ? raw.sourcemap : 'linked') as SourcemapMode,
                externals: normalizeExternals(raw.externals),
            };
        });
    }
    const entries: BundleEntry[] = [];
    for (const surface of ['edition', 'export'] as const) {
        const entrypoint = join(dir, 'src', surface, 'index.ts');
        if (existsSync(entrypoint)) {
            entries.push({
                idevice: name,
                label: `${name}/${surface}`,
                entrypoint,
                outdir: join(dir, surface),
                naming: `[dir]/${name}.[ext]`,
                minify: false,
                sourcemap: 'linked',
                externals: {},
            });
        }
    }
    return entries;
}

/** Every iDevice that keeps TypeScript sources under src/. */
export function discoverTsIdevices(baseDir: string = IDEVICES_BASE, only?: string[]): TsIdevice[] {
    const idevices: TsIdevice[] = [];
    for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) {
            continue;
        }
        if (only && only.length > 0 && !only.includes(entry.name)) {
            continue;
        }
        const dir = join(baseDir, entry.name);
        const srcDir = join(dir, 'src');
        if (!existsSync(srcDir)) {
            continue;
        }
        const entries = resolveEntries(entry.name, dir);
        if (entries.length === 0) {
            continue;
        }
        const tsconfig = existsSync(join(dir, 'tsconfig.json')) ? join(dir, 'tsconfig.json') : null;
        idevices.push({ name: entry.name, dir, srcDir, tsconfig, entries });
    }
    return idevices;
}

/** Bun plugin resolving the declared externals to page-provided globals. */
function externalsPlugin(externals: Record<string, ExternalSpec>): import('bun').BunPlugin {
    const names = Object.keys(externals);
    return {
        name: 'idevice-externals',
        setup(build) {
            if (names.length === 0) {
                return;
            }
            const filter = new RegExp(`^(${names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`);
            build.onResolve({ filter }, args => ({ path: args.path, namespace: 'idevice-externals' }));
            build.onLoad({ filter: /.*/, namespace: 'idevice-externals' }, args => {
                const spec = externals[args.path];
                if (!spec) {
                    throw new Error(`No external mapping for '${args.path}'`);
                }
                const message = `iDevice bundle: window.${spec.global} is not loaded. Load its vendored script first.`;
                return {
                    contents: `
                        const __global = globalThis[${JSON.stringify(spec.global)}];
                        if (!__global) {
                            throw new Error(${JSON.stringify(message)});
                        }
                        module.exports = __global;
                        ${spec.default ? 'module.exports.default = __global;' : ''}
                    `,
                    loader: 'js',
                };
            });
        },
    };
}

/** Build one entry; returns false (after printing every diagnostic) on failure. */
async function buildEntry(entry: BundleEntry): Promise<boolean> {
    try {
        const result = await Bun.build({
            entrypoints: [entry.entrypoint],
            outdir: entry.outdir,
            naming: entry.naming,
            format: 'iife',
            target: 'browser',
            sourcemap: entry.sourcemap,
            minify: entry.minify,
            ...(entry.globalName ? { globalName: entry.globalName } : {}),
            plugins: [externalsPlugin(entry.externals)],
        });
        if (!result.success) {
            console.error(`iDevice bundle FAILED: ${entry.label}`);
            for (const log of result.logs) {
                console.error(log);
            }
            return false;
        }
        for (const out of result.outputs) {
            console.log(`  ${out.path}`);
        }
        return true;
    } catch (error) {
        console.error(`iDevice bundle FAILED: ${entry.label}`);
        console.error(error);
        return false;
    }
}

/** Build every entry of one iDevice independently. */
async function buildIdevice(idevice: TsIdevice): Promise<boolean> {
    const results = await Promise.all(idevice.entries.map(buildEntry));
    return results.every(ok => ok);
}

/**
 * tsc -p for every discovered iDevice that ships a tsconfig. The processes run
 * concurrently (each cold tsc takes seconds and they are independent); output
 * is buffered per iDevice so failures stay readable.
 */
async function typecheck(idevices: TsIdevice[]): Promise<boolean> {
    const checked = idevices.filter(idevice => idevice.tsconfig);
    const results = await Promise.all(
        checked.map(async idevice => {
            const run = Bun.spawn(['bun', 'x', 'tsc', '-p', idevice.tsconfig as string], {
                stdout: 'pipe',
                stderr: 'pipe',
            });
            const [stdout, stderr, exitCode] = await Promise.all([
                new Response(run.stdout).text(),
                new Response(run.stderr).text(),
                run.exited,
            ]);
            console.log(`Type-checking ${idevice.name}…`);
            if (stdout.trim()) {
                console.log(stdout.trimEnd());
            }
            if (stderr.trim()) {
                console.error(stderr.trimEnd());
            }
            return exitCode === 0;
        }),
    );
    return results.every(ok => ok);
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const isWatch = args.includes('--watch');
    const typecheckOnly = args.includes('--typecheck-only');
    const withTypecheck = typecheckOnly || args.includes('--typecheck');
    const onlyIndex = args.indexOf('--only');
    const only = onlyIndex > -1 ? (args[onlyIndex + 1] || '').split(',').filter(Boolean) : undefined;

    const idevices = discoverTsIdevices(IDEVICES_BASE, only);
    if (idevices.length === 0) {
        console.error('No TypeScript iDevices found' + (only ? ` matching --only ${only.join(',')}` : ''));
        process.exit(1);
    }

    if (withTypecheck && !(await typecheck(idevices))) {
        process.exit(1);
    }
    if (typecheckOnly) {
        console.log('Type checks passed.');
        return;
    }

    console.log(`Building ${idevices.length} TypeScript iDevice(s): ${idevices.map(i => i.name).join(', ')}`);
    const results = await Promise.all(idevices.map(buildIdevice));
    const ok = results.every(Boolean);
    if (!isWatch) {
        process.exit(ok ? 0 : 1);
    }

    console.log('Watching src/ directories… (Ctrl+C to stop)');
    for (const idevice of idevices) {
        let pending: ReturnType<typeof setTimeout> | null = null;
        watch(idevice.srcDir, { recursive: true }, (_event, filename) => {
            if (filename && /\.(spec|test)\.[tj]s$/.test(filename)) {
                return;
            }
            if (pending) {
                clearTimeout(pending);
            }
            pending = setTimeout(() => {
                pending = null;
                void buildIdevice(idevice);
            }, 100);
        });
    }
}

if (import.meta.main) {
    await main();
}
