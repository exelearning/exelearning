#!/usr/bin/env bun
/**
 * Verify a built external-media distribution.
 *
 * Run with no argument to check this repository's own build; pass a directory to check
 * the copy a host plugin has vendored:
 *
 *   bun scripts/check-external-media-artifacts.ts
 *   bun scripts/check-external-media-artifacts.ts ../mod_exelearning/js/external-media
 *
 * This is the replacement for `check-embed-sync.mjs`'s substring smoke test: instead of
 * asserting that ten strings still appear in five hand-maintained mirrors, it asserts
 * that the vendored bytes are exactly the bytes we built.
 */
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { verifyArtifacts } from './external-media/verify';
import { DIST_DIR } from './external-media/sources';

const ROOT = join(import.meta.dir, '..');
const target = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(ROOT, DIST_DIR);

if (!existsSync(target)) {
    console.error(`[external-media] nothing to check: ${target} does not exist.`);
    console.error('Run `bun scripts/build-external-media.ts` first.');
    process.exit(1);
}

const problems = verifyArtifacts(target);
if (problems.length) {
    console.error(`[external-media] ${target} FAILED verification:`);
    problems.forEach(problem => console.error(`  - ${problem}`));
    process.exit(1);
}

console.log(`[external-media] ${target} verified: artifacts match the manifest.`);
