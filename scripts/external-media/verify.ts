/**
 * Verify a built external-media distribution.
 *
 * This replaces "diff five hand-maintained mirrors and hope" with a mechanical check:
 * the artifacts are present, they hash to what the manifest says, the manifest and the
 * contract agree on the protocol, and the child bundle is inside its size budget.
 *
 * Runs in core after a build, and in every client against the copy it vendored.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { sha256, type Manifest } from './manifest';

export const MANIFEST_FILE = 'exe-external-media.manifest.json';
export const CONTRACT_FILE = 'exe-external-media.contract.json';

/**
 * Ceiling for the minified+gzipped child bundle.
 *
 * The child is DESTINED to travel inside every exported package — bytes on every download
 * of every course, not a build statistic. It does not do so yet: today only the editor's
 * preview panel loads it, and no exporter injects it. The budget is set now, before that
 * delivery surface exists, because a ceiling adopted after the fact is a ceiling drawn
 * around whatever the size happened to become.
 *
 * Baseline measured in Phase 0: the unminified sources concatenate to 12 551 B gzip, so
 * this leaves headroom while still catching an accidental import of something large.
 */
export const CHILD_GZIP_BUDGET_BYTES = 14 * 1024;

/**
 * The grant that must survive into the shipped bytes (ADR-0018).
 *
 * These artifacts are vendored into five host-plugin repositories that never see our
 * source tree, so a licence notice that lives only in the source is no grant at all to
 * whoever received the file. Minifiers strip ordinary comments, which is precisely why
 * this is checked on the OUTPUT rather than trusted from the input.
 */
export const REQUIRED_GRANT = 'SPDX-License-Identifier: AGPL-3.0-or-later OR GPL-3.0-or-later';

function readJson<T>(path: string): T | null {
    try {
        return JSON.parse(readFileSync(path, 'utf8')) as T;
    } catch {
        return null;
    }
}

/**
 * @returns a list of human-readable problems; empty means the distribution is good.
 */
export function verifyArtifacts(dir: string): string[] {
    const problems: string[] = [];

    const manifestPath = join(dir, MANIFEST_FILE);
    if (!existsSync(manifestPath)) {
        return [`manifest is missing: expected ${MANIFEST_FILE} in ${dir}`];
    }
    const manifest = readJson<Manifest>(manifestPath);
    if (!manifest?.files) {
        return [`manifest is unreadable or has no file list: ${manifestPath}`];
    }

    const contractPath = join(dir, CONTRACT_FILE);
    const contract = existsSync(contractPath) ? readJson<{ libraryProtocol: number }>(contractPath) : null;
    if (!contract) {
        problems.push(`contract is missing or unreadable: expected ${CONTRACT_FILE} in ${dir}`);
    } else if (contract.libraryProtocol !== manifest.protocolVersion) {
        problems.push(
            `protocol mismatch: manifest says ${manifest.protocolVersion}, contract says ${contract.libraryProtocol}`,
        );
    }

    for (const [key, record] of Object.entries(manifest.files)) {
        const artifactPath = join(dir, record.path);
        if (!existsSync(artifactPath)) {
            problems.push(`${key}: artifact is missing (${record.path})`);
            continue;
        }
        const contents = readFileSync(artifactPath, 'utf8');
        const actual = sha256(contents);
        if (actual !== record.sha256) {
            problems.push(`${key}: sha256 mismatch — the file changed after the build (${record.path})`);
        }
        const bytes = statSync(artifactPath).size;
        if (typeof record.bytes === 'number' && bytes !== record.bytes) {
            problems.push(`${key}: size mismatch — manifest says ${record.bytes}, on disk ${bytes}`);
        }
        if (!contents.includes(REQUIRED_GRANT)) {
            problems.push(
                `${key}: the dual-licence grant is missing from the shipped bytes (${record.path}). ` +
                    'Minifiers drop ordinary comments — the banner must be a /*! ... */ legal comment.',
            );
        }
        if (key === 'child') {
            const gzipped = gzipSync(Buffer.from(contents, 'utf8'), { level: 9 }).length;
            if (gzipped > CHILD_GZIP_BUDGET_BYTES) {
                problems.push(
                    `child: gzip budget exceeded — ${gzipped} B > ${CHILD_GZIP_BUDGET_BYTES} B. ` +
                        'This bundle ships inside every exported package.',
                );
            }
        }
    }

    // Recompute the build hash from the recorded digests: a manifest whose buildHash
    // does not cover its own file list is not a manifest anyone should trust.
    const expectedBuildHash = sha256(
        Object.keys(manifest.files)
            .sort()
            .map(key => `${key}:${manifest.files[key].sha256}`)
            .join('\n'),
    );
    if (manifest.buildHash !== expectedBuildHash) {
        problems.push('buildHash does not match the manifest file list — the manifest was edited by hand');
    }

    return problems;
}
