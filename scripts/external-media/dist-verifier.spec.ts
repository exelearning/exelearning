import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyVendoredArtifacts, EXPECTED_GRANT } from './dist-verifier.mjs';

/**
 * This verifier is what a HOST PLUGIN runs, not what our build runs, and the two answer
 * different questions.
 *
 * Ours asks "is this distribution well-formed?" — budgets, contract/protocol agreement,
 * reproducibility. A consumer cannot ask that: it has no build to compare against. It
 * asks "are these bytes the ones eXeLearning published, unmodified since?" — which is
 * answerable from the manifest alone, with nothing but Node and no dependencies.
 *
 * It ships INSIDE the distribution for the same reason the licence banner does: a check
 * that lives only in our repository is no check at all to whoever received the files.
 */
const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

const GRANT = '/*! SPDX-License-Identifier: AGPL-3.0-or-later OR GPL-3.0-or-later */\n';
const CHILD = `${GRANT}child();`;
const HOST = `${GRANT}host();`;

let dir: string;

function writeDist(over: { child?: string; host?: string; mutate?: (m: any) => void } = {}) {
    const child = over.child ?? CHILD;
    const host = over.host ?? HOST;
    writeFileSync(join(dir, 'exe-external-media-child.min.js'), child);
    writeFileSync(join(dir, 'exe-external-media-host.min.js'), host);

    const files = {
        child: { path: 'exe-external-media-child.min.js', sha256: sha256(child), bytes: Buffer.byteLength(child) },
        host: { path: 'exe-external-media-host.min.js', sha256: sha256(host), bytes: Buffer.byteLength(host) },
    };
    const manifest: any = {
        libraryVersion: '1.0.0',
        protocolVersion: 1,
        sourceCommit: 'abc1234',
        files,
        buildHash: sha256(
            Object.keys(files)
                .sort()
                .map(k => `${k}:${(files as any)[k].sha256}`)
                .join('\n'),
        ),
    };
    over.mutate?.(manifest);
    writeFileSync(join(dir, 'exe-external-media.manifest.json'), JSON.stringify(manifest, null, 4));
}

beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'exe-em-vendor-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('verifying a vendored distribution', () => {
    it('accepts an untouched copy', () => {
        writeDist();
        expect(verifyVendoredArtifacts(dir)).toEqual([]);
    });

    /** The case this exists for: someone patched the vendored file instead of core. */
    it('catches a file edited after vendoring', () => {
        writeDist();
        const path = join(dir, 'exe-external-media-child.min.js');
        writeFileSync(path, `${readFileSync(path, 'utf8')}\n/* local hotfix */`);

        expect(verifyVendoredArtifacts(dir).join(' ')).toContain('sha256');
    });

    it('catches a missing file', () => {
        writeDist();
        rmSync(join(dir, 'exe-external-media-host.min.js'));

        expect(verifyVendoredArtifacts(dir).join(' ')).toContain('missing');
    });

    /**
     * Editing the file and the digest together is the obvious way around a per-file
     * check, so the build hash covers the digest list itself.
     */
    it('catches a manifest edited to cover the change', () => {
        writeDist();
        const path = join(dir, 'exe-external-media-child.min.js');
        const patched = `${readFileSync(path, 'utf8')}\n/* local hotfix */`;
        writeFileSync(path, patched);

        const manifestPath = join(dir, 'exe-external-media.manifest.json');
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        manifest.files.child.sha256 = sha256(patched);
        manifest.files.child.bytes = Buffer.byteLength(patched);
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 4));

        expect(verifyVendoredArtifacts(dir).join(' ')).toContain('buildHash');
    });

    it('reports a directory with no manifest at all', () => {
        expect(verifyVendoredArtifacts(dir).join(' ')).toContain('manifest');
    });

    it('reports a manifest with no file list', () => {
        writeDist();
        writeFileSync(join(dir, 'exe-external-media.manifest.json'), JSON.stringify({ libraryVersion: '1.0.0' }));

        expect(verifyVendoredArtifacts(dir).join(' ')).toContain('no file list');
    });

    it('reports an unreadable manifest rather than throwing', () => {
        writeDist();
        writeFileSync(join(dir, 'exe-external-media.manifest.json'), 'not json {');

        expect(() => verifyVendoredArtifacts(dir)).not.toThrow();
        expect(verifyVendoredArtifacts(dir).join(' ')).toContain('manifest');
    });

    /** ADR-2199-09: the grant has to travel with the bytes, so a consumer can check it did. */
    it('requires the dual-licence grant in what was vendored', () => {
        writeDist({ child: 'child();' });

        expect(verifyVendoredArtifacts(dir).join(' ')).toContain('licence');
    });

    it('exposes the grant it looks for, so a consumer can read it', () => {
        expect(EXPECTED_GRANT).toContain('AGPL-3.0-or-later OR GPL-3.0-or-later');
    });
});

describe('checking provenance against a published build', () => {
    /**
     * Integrity and provenance are different claims. The checks above prove nothing was
     * edited *after* vendoring; they cannot prove the copy came from us, because a
     * consistent forgery is easy to produce. That needs core's published buildHash,
     * obtained out of band.
     */
    it('confirms a copy that matches the published build hash', () => {
        writeDist();
        const manifest = JSON.parse(readFileSync(join(dir, 'exe-external-media.manifest.json'), 'utf8'));

        expect(verifyVendoredArtifacts(dir, { expectBuildHash: manifest.buildHash })).toEqual([]);
    });

    it('rejects a copy from a different build than the one expected', () => {
        writeDist();

        const problems = verifyVendoredArtifacts(dir, { expectBuildHash: 'f'.repeat(64) }).join(' ');
        expect(problems).toContain('buildHash');
        expect(problems).toContain('expected');
    });
});

/**
 * Run the real CLI under plain `node`, because that is literally the command a plugin's CI
 * will contain, and because the exit code is the part that CI acts on. Calling the
 * function directly would leave both the argument parsing and the exit codes untested.
 */
describe('the command a plugin runs in CI', () => {
    const VERIFIER = join(import.meta.dir, 'dist-verifier.mjs');

    function run(args: string[]): { status: number; output: string } {
        try {
            const output = execFileSync('node', [VERIFIER, ...args], { encoding: 'utf8', stdio: 'pipe' });
            return { status: 0, output };
        } catch (error) {
            const failure = error as { status?: number; stderr?: string; stdout?: string };
            return { status: failure.status ?? -1, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
        }
    }

    it('exits 0 and says so on an untouched copy', () => {
        writeDist();
        const { status, output } = run([dir]);

        expect(status).toBe(0);
        expect(output).toContain('verified');
    });

    /** A non-zero exit is the whole point: this is what fails the plugin's pipeline. */
    it('exits non-zero and names the file when one was edited', () => {
        writeDist();
        const path = join(dir, 'exe-external-media-child.min.js');
        writeFileSync(path, `${readFileSync(path, 'utf8')}\n/* local hotfix */`);

        const { status, output } = run([dir]);

        expect(status).toBe(1);
        expect(output).toContain('exe-external-media-child.min.js');
        expect(output).toContain('re-vendor');
    });

    it('accepts the published build hash and rejects a different one', () => {
        writeDist();
        const manifest = JSON.parse(readFileSync(join(dir, 'exe-external-media.manifest.json'), 'utf8'));

        expect(run([dir, '--build-hash', manifest.buildHash]).status).toBe(0);

        const wrong = run([dir, '--build-hash', 'f'.repeat(64)]);
        expect(wrong.status).toBe(1);
        expect(wrong.output).toContain('expected');
    });
});
