/**
 * Verify a VENDORED copy of the eXeLearning external-media distribution.
 *
 * This is the consumer's tool, and it ships inside the distribution itself — for the same
 * reason the licence banner does: a check that lives only in eXeLearning's repository is
 * no check at all to whoever received the files.
 *
 * It answers a different question from eXeLearning's own build verifier, which is why the
 * two are not one file. Ours asks "is this distribution well-formed?" — size budgets,
 * contract and protocol agreement, reproducibility against a fresh build. A consumer
 * cannot ask that; it has no build to compare against. It asks "are these the bytes
 * eXeLearning published, unmodified since?", which is answerable from the manifest alone.
 *
 * Deliberately dependency-free and plain ESM: it must run under `node` in a PHP plugin's
 * CI with no toolchain, no install step and no package.json.
 *
 *   node exe_external_media/verify.mjs [dir] [--build-hash <hash>]
 *
 * INTEGRITY vs PROVENANCE. Without `--build-hash` this proves only that nothing was edited
 * after vendoring: a consistent forgery — file and digests changed together — is easy to
 * produce, and the build hash inside the copy cannot detect a copy that was built with it.
 * Pass the hash eXeLearning published for the release you meant to vendor, obtained out of
 * band, and the check becomes one of provenance.
 *
 * Copyright (C) 2026 eXeLearning Team
 *
 * Dual-licensed so this ONE file can ship inside eXeLearning (AGPL-3.0-or-later)
 * and inside the GPL-3.0-or-later host plugins (mod_exelearning) without either
 * project relicensing it. GPLv3 s13 and AGPLv3 s13 already permit COMBINING the
 * two, but combining never relicenses a file: only the copyright holder can offer
 * it under both, which is what this grant does. Keep this notice in every mirror.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later OR GPL-3.0-or-later
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const MANIFEST_FILE = 'exe-external-media.manifest.json';

/** ADR-2199-09. Checked on the received bytes, because that is where it has to be. */
export const EXPECTED_GRANT = 'SPDX-License-Identifier: AGPL-3.0-or-later OR GPL-3.0-or-later';

const sha256 = contents => createHash('sha256').update(contents, 'utf8').digest('hex');

/**
 * @param {string} dir directory holding the vendored artifacts and their manifest
 * @param {{expectBuildHash?: string}} [options] the build hash published for the release
 *        you meant to vendor; supply it to check provenance, not just integrity
 * @returns {string[]} human-readable problems; empty means the copy is good
 */
export function verifyVendoredArtifacts(dir, options = {}) {
    const manifestPath = join(dir, MANIFEST_FILE);
    if (!existsSync(manifestPath)) {
        return [`manifest is missing: expected ${MANIFEST_FILE} in ${dir}`];
    }

    let manifest;
    try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch (error) {
        return [`manifest is not readable JSON: ${manifestPath} (${error.message})`];
    }
    if (!manifest || typeof manifest.files !== 'object' || manifest.files === null) {
        return [`manifest has no file list: ${manifestPath}`];
    }

    const problems = [];

    for (const [key, record] of Object.entries(manifest.files)) {
        const artifactPath = join(dir, record.path);
        if (!existsSync(artifactPath)) {
            problems.push(`${key}: artifact is missing (${record.path})`);
            continue;
        }

        const contents = readFileSync(artifactPath, 'utf8');
        if (sha256(contents) !== record.sha256) {
            problems.push(
                `${key}: sha256 mismatch — ${record.path} was modified after it was vendored. ` +
                    'Change eXeLearning core and re-vendor; a local edit here is invisible upstream.',
            );
        }
        if (typeof record.bytes === 'number' && statSync(artifactPath).size !== record.bytes) {
            problems.push(`${key}: size mismatch — manifest says ${record.bytes}`);
        }
        if (!contents.includes(EXPECTED_GRANT)) {
            problems.push(`${key}: the dual-licence grant is missing from ${record.path}`);
        }
    }

    // The digest list is itself covered, so editing a file and its digest together does
    // not produce a manifest that agrees with itself.
    const recomputed = sha256(
        Object.keys(manifest.files)
            .sort()
            .map(key => `${key}:${manifest.files[key].sha256}`)
            .join('\n'),
    );
    if (manifest.buildHash !== recomputed) {
        problems.push('buildHash does not match the manifest file list — the manifest was edited by hand');
    }

    if (options.expectBuildHash && manifest.buildHash !== options.expectBuildHash) {
        problems.push(
            `buildHash is not the build you expected — vendored ${manifest.buildHash}, ` +
                `expected ${options.expectBuildHash}`,
        );
    }

    return problems;
}

/* c8 ignore start -- CLI wrapper; the behaviour above is what is tested */
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
    const args = process.argv.slice(2);
    const hashIndex = args.indexOf('--build-hash');
    const expectBuildHash = hashIndex !== -1 ? args[hashIndex + 1] : undefined;
    const dir = args.find(a => !a.startsWith('--') && a !== expectBuildHash) ?? process.cwd();

    const problems = verifyVendoredArtifacts(dir, { expectBuildHash });
    if (problems.length) {
        console.error(`[exe-external-media] ${dir} did NOT verify:`);
        for (const problem of problems) console.error(`  - ${problem}`);
        process.exit(1);
    }
    console.log(`[exe-external-media] ${dir} verified.`);
}
/* c8 ignore stop */
