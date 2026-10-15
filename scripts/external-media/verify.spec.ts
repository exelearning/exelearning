import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyArtifacts, CHILD_GZIP_BUDGET_BYTES } from './verify';
import { buildManifest, sha256 } from './manifest';

let dir: string;

/** A well-formed dist directory: two artifacts plus the manifest describing them. */
/** What a real artifact's banner looks like, so the default fixture is a valid one. */
const GRANT = '/*! SPDX-License-Identifier: AGPL-3.0-or-later OR GPL-3.0-or-later */\n';

function writeDist(overrides: { child?: string; host?: string; manifestMutator?: (m: any) => void } = {}) {
    const child = overrides.child ?? `${GRANT}var a=1;`;
    const host = overrides.host ?? `${GRANT}var b=2;`;
    writeFileSync(join(dir, 'exe-external-media-child.min.js'), child);
    writeFileSync(join(dir, 'exe-external-media-host.min.js'), host);
    const manifest = buildManifest({
        artifacts: {
            child: { path: 'exe-external-media-child.min.js', contents: child },
            host: { path: 'exe-external-media-host.min.js', contents: host },
        },
        sourceCommit: 'abc1234',
    });
    overrides.manifestMutator?.(manifest);
    writeFileSync(join(dir, 'exe-external-media.manifest.json'), JSON.stringify(manifest, null, 4));
    writeFileSync(join(dir, 'exe-external-media.contract.json'), JSON.stringify({ libraryProtocol: 1 }, null, 4));
}

beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'exe-em-verify-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('verifyArtifacts', () => {
    it('passes a freshly built, intact distribution', () => {
        writeDist();
        expect(verifyArtifacts(dir)).toEqual([]);
    });

    it('reports a missing artifact rather than trusting the manifest', () => {
        writeDist();
        rmSync(join(dir, 'exe-external-media-host.min.js'));
        expect(verifyArtifacts(dir).join(' ')).toContain('missing');
    });

    /** The whole point of shipping hashes: a hand-edited copy must be caught. */
    it('catches an artifact edited after the build', () => {
        writeDist();
        writeFileSync(join(dir, 'exe-external-media-child.min.js'), 'var a=999;');
        const problems = verifyArtifacts(dir).join(' ');
        expect(problems).toContain('sha256');
        expect(problems).toContain('child');
    });

    it('reports an absent manifest', () => {
        writeDist();
        rmSync(join(dir, 'exe-external-media.manifest.json'));
        expect(verifyArtifacts(dir).join(' ')).toContain('manifest');
    });

    it('reports an absent contract', () => {
        writeDist();
        rmSync(join(dir, 'exe-external-media.contract.json'));
        expect(verifyArtifacts(dir).join(' ')).toContain('contract');
    });

    it('catches a manifest whose protocol disagrees with the contract', () => {
        writeDist({ manifestMutator: m => { m.protocolVersion = 99; } });
        expect(verifyArtifacts(dir).join(' ')).toContain('protocol');
    });

    it('catches a build hash that does not cover the recorded files', () => {
        writeDist({ manifestMutator: m => { m.buildHash = sha256('tampered'); } });
        expect(verifyArtifacts(dir).join(' ')).toContain('buildHash');
    });

    /**
     * The child bundle travels inside every exported package, so its size is a
     * shipped cost, not an implementation detail.
     */
    it('enforces the child gzip budget', () => {
        // Deterministic LCG output: high entropy, so gzip cannot shrink it below the
        // budget. A repeating pattern would compress away and prove nothing.
        let seed = 12345;
        const bloat = Array.from({ length: CHILD_GZIP_BUDGET_BYTES * 6 }, () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            // High-order bits: an LCG's low bits are weakly random and gzip eats them.
            return String.fromCharCode(33 + ((seed >>> 16) % 94));
        }).join('');
        writeDist({ child: bloat });
        const problems = verifyArtifacts(dir).join(' ');
        expect(problems).toContain('gzip');
        expect(problems).toContain('budget');
    });

    /**
     * ADR-2199-09 grants the dual licence so host plugins can vendor these bytes. A grant
     * that does not travel WITH the bytes is no grant at all to whoever received them —
     * and these artifacts are copied into five repositories that never see our source.
     */
    it('requires the dual-licence grant in the shipped bytes', () => {
        writeDist({ child: 'var a=1;' });
        expect(verifyArtifacts(dir).join(' ')).toContain('licence');
    });

    it('accepts artifacts that carry the grant', () => {
        writeDist();
        expect(verifyArtifacts(dir).join(' ')).not.toContain('licence');
    });

    it('reports a directory that was never built at all', () => {
        const empty = join(dir, 'nope');
        mkdirSync(empty);
        expect(verifyArtifacts(empty).length).toBeGreaterThan(0);
    });
});
