#!/usr/bin/env bun
/**
 * Build the distributable external-media artifacts.
 *
 * Produces two bundles split by privilege boundary — a CHILD that runs inside
 * untrusted author content, and a HOST that runs on the trusted page — plus a manifest
 * (hashes, versions) and a contract (protocol, providers, handshake, sandbox) so a
 * host plugin can vendor verified bytes instead of hand-copying our source.
 *
 * The bundles are CONCATENATED then minified, not module-bundled: every source is a
 * classic browser script with no imports, which is exactly what lets the child run
 * from `file://` inside an exported package.
 *
 *   bun scripts/build-external-media.ts [--check]
 *
 * `--check` builds into a temporary directory and fails if the result differs from
 * what is already on disk (reproducibility / "did you forget to rebuild?").
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build, transform } from 'esbuild';
import { buildManifest } from './external-media/manifest';
import { deriveContract } from './external-media/contract';
import { verifyArtifacts, CHILD_GZIP_BUDGET_BYTES } from './external-media/verify';
import {
    ARTIFACT_NAMES,
    CHILD_LEGACY_SOURCES,
    CONTRACT_SOURCES,
    DIST_DIR,
    ENTRIES,
    HOST_LEGACY_SOURCES,
    VERIFIER_NAME,
    VERIFIER_SOURCE,
} from './external-media/sources';

const ROOT = join(import.meta.dir, '..');

function read(relative: string): string {
    return readFileSync(join(ROOT, relative), 'utf8');
}

/**
 * Concatenate classic scripts in load order. Each source is already an IIFE that
 * publishes its own global, so no wrapper is added — wrapping them would hide the
 * globals the host page and the iDevices look up by name.
 */
function concatenate(relatives: readonly string[]): string {
    return relatives.map(relative => `/* ${relative} */\n${read(relative)}`).join('\n;\n');
}

/**
 * Bundle a canonical TypeScript entry down to a single classic script.
 *
 * `format: 'iife'` with no `globalName` is what makes the output a plain script that
 * publishes nothing of its own — the entry's own `window.*` assignments are the entire
 * public surface, exactly as the classic sources it replaces behaved. ES2017 keeps it
 * parseable by the older engines an exported package can land on, and guarantees esbuild
 * does not lower anything into a module construct that `file://` would refuse.
 */
async function bundleEntry(relative: string, label: string): Promise<string> {
    const result = await build({
        entryPoints: [join(ROOT, relative)],
        bundle: true,
        write: false,
        format: 'iife',
        platform: 'browser',
        target: 'es2017',
        legalComments: 'inline', // keep the dual-licence notices (ADR-0018)
        logLevel: 'silent',
    });
    for (const warning of result.warnings) {
        console.warn(`[external-media] ${label}: ${warning.text}`);
    }
    const [output] = result.outputFiles;
    if (!output) throw new Error(`[external-media] ${label}: esbuild produced no output for ${relative}`);
    return `/* ${relative} */\n${output.text}`;
}

/**
 * The banner every artifact carries.
 *
 * A `/*!` legal comment rather than the sources' own JSDoc headers, because esbuild — like
 * every minifier — drops ordinary comments, so the grants written in the sources do NOT
 * survive into the output. These bytes are vendored into five host-plugin repositories
 * that never see our source tree, and a grant that does not travel with the file it
 * licenses is no grant at all to whoever received it (ADR-0018). `verifyArtifacts`
 * enforces this on the output, not on the input, for exactly that reason.
 */
function banner(label: string): string {
    return [
        '/*!',
        ` * eXeLearning external-media ${label} bundle — https://github.com/exelearning/exelearning`,
        ' *',
        ' * Copyright (C) 2026 eXeLearning Team',
        ' *',
        ' * Dual-licensed so these bytes can ship inside eXeLearning (AGPL-3.0-or-later)',
        ' * and inside the GPL-3.0-or-later host plugins without either project',
        ' * relicensing them. Combining is already permitted by GPLv3 s13 and AGPLv3 s13;',
        ' * combining never relicenses, so this grant is what makes vendoring lawful.',
        ' *',
        ` * SPDX-License-Identifier: AGPL-3.0-or-later OR GPL-3.0-or-later`,
        ' */',
        '',
    ].join('\n');
}

async function minify(source: string, label: string): Promise<string> {
    const result = await transform(source, {
        loader: 'js',
        minify: true,
        // ES2017 keeps the output parseable by the older engines an exported package
        // can land on, and avoids esbuild lowering anything into a module construct.
        target: 'es2017',
        legalComments: 'inline',
    });
    if (result.warnings.length) {
        for (const warning of result.warnings) {
            console.warn(`[external-media] ${label}: ${warning.text}`);
        }
    }
    return `${banner(label)}${result.code}`;
}

function currentCommit(): string {
    try {
        return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
    } catch {
        return 'unknown';
    }
}

async function buildInto(outDir: string): Promise<void> {
    // Canonical entry first, legacy remainder after: the media bridge reads
    // `win.exeEmbedShim` at module scope and the entry is what publishes it.
    const child = await minify(
        [await bundleEntry(ENTRIES.child, 'child'), concatenate(CHILD_LEGACY_SOURCES)].join('\n;\n'),
        'child',
    );
    const host = await minify(
        [await bundleEntry(ENTRIES.host, 'host'), concatenate(HOST_LEGACY_SOURCES)].join('\n;\n'),
        'host',
    );

    const contract = deriveContract({
        policy: read(CONTRACT_SOURCES.policy),
        relay: read(CONTRACT_SOURCES.relay),
        shim: read(CONTRACT_SOURCES.shim),
    });

    const manifest = buildManifest({
        artifacts: {
            child: { path: ARTIFACT_NAMES.child, contents: child },
            host: { path: ARTIFACT_NAMES.host, contents: host },
        },
        sourceCommit: currentCommit(),
    });

    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, ARTIFACT_NAMES.child), child);
    writeFileSync(join(outDir, ARTIFACT_NAMES.host), host);
    writeFileSync(join(outDir, 'exe-external-media.contract.json'), `${JSON.stringify(contract, null, 4)}\n`);
    writeFileSync(join(outDir, 'exe-external-media.manifest.json'), `${JSON.stringify(manifest, null, 4)}\n`);
    // Verbatim, and deliberately NOT covered by the manifest: a digest of the checker,
    // listed by the thing it checks, would only ever confirm itself.
    writeFileSync(join(outDir, VERIFIER_NAME), read(VERIFIER_SOURCE));
}

/** `--out <dir>`: build somewhere other than the repository's dist (tests, packaging). */
function outDirFromArgv(): string {
    const index = process.argv.indexOf('--out');
    if (index !== -1 && process.argv[index + 1]) {
        const value = process.argv[index + 1];
        return value.startsWith('/') ? value : join(process.cwd(), value);
    }
    return join(ROOT, DIST_DIR);
}

async function main(): Promise<void> {
    const check = process.argv.includes('--check');
    const outDir = outDirFromArgv();

    if (check) {
        const tmpDir = join(ROOT, `${DIST_DIR}.check`);
        rmSync(tmpDir, { recursive: true, force: true });
        await buildInto(tmpDir);
        let differs = false;
        // The verifier is compared too: it ships to consumers, so an edit that was never
        // rebuilt would leave plugins running a different checker from the one in tree.
        for (const name of [
            ARTIFACT_NAMES.child,
            ARTIFACT_NAMES.host,
            'exe-external-media.contract.json',
            VERIFIER_NAME,
        ]) {
            const built = readFileSync(join(tmpDir, name), 'utf8');
            const onDisk = existsSync(join(outDir, name)) ? readFileSync(join(outDir, name), 'utf8') : null;
            if (built !== onDisk) {
                console.error(`[external-media] ${name} differs from the committed build`);
                differs = true;
            }
        }
        rmSync(tmpDir, { recursive: true, force: true });
        if (differs) {
            console.error('\nRun `bun scripts/build-external-media.ts` and commit the result.');
            process.exit(1);
        }
        console.log('[external-media] artifacts are up to date');
        return;
    }

    await buildInto(outDir);

    const problems = verifyArtifacts(outDir);
    if (problems.length) {
        console.error('[external-media] the build produced a distribution that does not verify:');
        problems.forEach(problem => console.error(`  - ${problem}`));
        process.exit(1);
    }

    const childBytes = readFileSync(join(outDir, ARTIFACT_NAMES.child), 'utf8');
    const hostBytes = readFileSync(join(outDir, ARTIFACT_NAMES.host), 'utf8');
    const gz = (s: string) => gzipSync(Buffer.from(s, 'utf8'), { level: 9 }).length;
    console.log(`[external-media] written to ${DIST_DIR}`);
    console.log(
        `  child ${childBytes.length} B raw / ${gz(childBytes)} B gzip ` +
            `(budget ${CHILD_GZIP_BUDGET_BYTES} B — set for the export surface, see verify.ts)`,
    );
    console.log(`  host  ${hostBytes.length} B raw / ${gz(hostBytes)} B gzip`);
}

// Only run when invoked directly, so the spec can import the helpers.
if (import.meta.main) {
    main().catch(error => {
        console.error(`[external-media] build failed: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
    });
}

export { buildInto, concatenate, minify };
