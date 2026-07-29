import { describe, expect, it } from 'bun:test';
import { buildManifest, sha256, PROTOCOL_VERSION, LIBRARY_VERSION } from './manifest';

describe('sha256', () => {
    it('hashes bytes, not the path', () => {
        expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });

    it('gives different digests for content that differs by one byte', () => {
        expect(sha256('a')).not.toBe(sha256('b'));
    });
});

describe('buildManifest', () => {
    const artifacts = {
        child: { path: 'exe-external-media-child.min.js', contents: 'child();' },
        host: { path: 'exe-external-media-host.min.js', contents: 'host();' },
    };

    it('records a sha256 per artifact so a client can verify what it copied', () => {
        const m = buildManifest({ artifacts, sourceCommit: 'abc1234' });
        expect(m.files.child.sha256).toBe(sha256('child();'));
        expect(m.files.host.sha256).toBe(sha256('host();'));
        expect(m.files.child.path).toBe('exe-external-media-child.min.js');
    });

    it('carries the library and protocol versions clients gate on', () => {
        const m = buildManifest({ artifacts, sourceCommit: 'abc1234' });
        expect(m.libraryVersion).toBe(LIBRARY_VERSION);
        expect(m.protocolVersion).toBe(PROTOCOL_VERSION);
        expect(m.sourceCommit).toBe('abc1234');
    });

    /**
     * The build hash is what makes "did anything change?" a single comparison
     * instead of a walk over every file.
     */
    it('derives one build hash covering every artifact', () => {
        const a = buildManifest({ artifacts, sourceCommit: 'abc1234' });
        const b = buildManifest({ artifacts, sourceCommit: 'abc1234' });
        expect(a.buildHash).toBe(b.buildHash);

        const changed = buildManifest({
            artifacts: { ...artifacts, host: { path: artifacts.host.path, contents: 'host2();' } },
            sourceCommit: 'abc1234',
        });
        expect(changed.buildHash).not.toBe(a.buildHash);
    });

    it('does not let the source commit alone change the build hash', () => {
        // Two builds of identical bytes from different commits are the same build;
        // folding the commit in would defeat reproducibility checks.
        const a = buildManifest({ artifacts, sourceCommit: 'aaaaaaa' });
        const b = buildManifest({ artifacts, sourceCommit: 'bbbbbbb' });
        expect(a.buildHash).toBe(b.buildHash);
    });

    it('is stable regardless of the order artifacts are supplied in', () => {
        const reordered = { host: artifacts.host, child: artifacts.child };
        expect(buildManifest({ artifacts: reordered, sourceCommit: 'x' }).buildHash).toBe(
            buildManifest({ artifacts, sourceCommit: 'x' }).buildHash,
        );
    });

    it('serialises deterministically, so two builds produce byte-identical JSON', () => {
        const a = JSON.stringify(buildManifest({ artifacts, sourceCommit: 'x' }), null, 4);
        const b = JSON.stringify(buildManifest({ artifacts, sourceCommit: 'x' }), null, 4);
        expect(a).toBe(b);
        expect(a).not.toContain('undefined');
    });
});
