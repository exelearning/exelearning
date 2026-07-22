/**
 * Preview snapshot store tests: lifecycle (create/replace/get/delete), TTL
 * expiry and sliding renewal, per-user quota + eviction, capability id
 * entropy/format, traversal-safe file resolution, MIME mapping, and archive
 * unpacking limits.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fflate from 'fflate';
import {
    PREVIEW_ID_RE,
    clearAllForTests,
    configure,
    createOrReplace,
    deleteSnapshot,
    getFile,
    getForServing,
    getLimits,
    getOwned,
    liveCount,
    resetDependencies,
    startSweeper,
    sweepExpired,
    unpackSnapshotArchive,
    type PreviewSnapshot,
} from './preview-snapshot-store';

const OWNER = 42;
const OTHER = 7;

function makeFiles(entries: Record<string, string> = { 'index.html': '<html></html>' }): Map<string, Uint8Array> {
    return new Map(Object.entries(entries).map(([path, text]) => [path, new TextEncoder().encode(text)]));
}

function createSnapshot(owner = OWNER, files = makeFiles()): PreviewSnapshot {
    const result = createOrReplace(owner, null, files);
    if (!('snapshot' in result)) throw new Error(`create failed: ${JSON.stringify(result)}`);
    return result.snapshot;
}

describe('preview-snapshot-store', () => {
    let fakeNow: number;
    const savedMaxUpload = process.env.MAX_UPLOAD_SIZE;

    beforeEach(() => {
        fakeNow = 1_000_000;
        configure({ now: () => fakeNow });
    });

    afterEach(() => {
        clearAllForTests();
        resetDependencies();
        if (savedMaxUpload === undefined) delete process.env.MAX_UPLOAD_SIZE;
        else process.env.MAX_UPLOAD_SIZE = savedMaxUpload;
    });

    describe('capability ids', () => {
        it('mints 32-lowercase-hex (128-bit) ids that match the serving gate', () => {
            resetDependencies(); // use the real crypto id generator
            const snapshot = createSnapshot();
            expect(snapshot.id).toMatch(/^[0-9a-f]{32}$/);
            expect(PREVIEW_ID_RE.test(snapshot.id)).toBe(true);
        });

        it('mints unique ids across creations', () => {
            resetDependencies();
            const seen = new Set<string>();
            for (let i = 0; i < 50; i++) {
                // Distinct owners dodge the per-user quota eviction.
                seen.add(createSnapshot(i).id);
            }
            expect(seen.size).toBe(50);
        });
    });

    describe('create / replace', () => {
        it('creates a snapshot and serves it back', () => {
            const snapshot = createSnapshot();
            expect(getForServing(snapshot.id)).toBe(snapshot);
            expect(snapshot.ownerUserId).toBe(OWNER);
            expect(snapshot.totalBytes).toBeGreaterThan(0);
        });

        it('replaces in place: same previewId, new contents, renewed touch time', () => {
            const snapshot = createSnapshot();
            fakeNow += 60_000;
            const result = createOrReplace(OWNER, snapshot.id, makeFiles({ 'index.html': '<p>v2</p>' }));
            expect('snapshot' in result && result.snapshot.id).toBe(snapshot.id);
            expect(new TextDecoder().decode(getFile(snapshot, 'index.html')!.bytes)).toBe('<p>v2</p>');
            expect(snapshot.touchedAt).toBe(fakeNow);
        });

        it('mints a fresh id when the requested previewId is unknown (self-healing)', () => {
            const result = createOrReplace(OWNER, 'f'.repeat(32), makeFiles());
            expect('snapshot' in result && result.snapshot.id).not.toBe('f'.repeat(32));
        });

        it("refuses to replace another user's snapshot (403) and leaves it intact", () => {
            const snapshot = createSnapshot(OWNER, makeFiles({ 'index.html': 'original' }));
            const result = createOrReplace(OTHER, snapshot.id, makeFiles({ 'index.html': 'hijacked' }));
            expect('status' in result && result.status).toBe(403);
            expect(new TextDecoder().decode(getFile(snapshot, 'index.html')!.bytes)).toBe('original');
        });

        it('rejects a snapshot over the byte cap with 413', () => {
            process.env.MAX_UPLOAD_SIZE = '16';
            const result = createOrReplace(OWNER, null, makeFiles({ 'index.html': 'x'.repeat(17) }));
            expect('status' in result && result.status).toBe(413);
        });

        it('rejects a snapshot over the file-count cap with 413', () => {
            const files = new Map<string, Uint8Array>();
            for (let i = 0; i <= getLimits().maxFilesPerSnapshot; i++) {
                files.set(`f${i}.txt`, new Uint8Array(1));
            }
            const result = createOrReplace(OWNER, null, files);
            expect('status' in result && result.status).toBe(413);
        });
    });

    describe('quota and eviction', () => {
        it('evicts the least-recently-touched snapshot beyond the per-user cap', () => {
            const first = createSnapshot();
            fakeNow += 1000;
            const second = createSnapshot();
            fakeNow += 1000;
            // Touch the first so the second becomes the eviction candidate.
            createOrReplace(OWNER, first.id, makeFiles());
            fakeNow += 1000;
            const third = createSnapshot();
            expect(getForServing(first.id)).not.toBeNull();
            expect(getForServing(second.id)).toBeNull();
            expect(getForServing(third.id)).not.toBeNull();
        });

        it("does not count another user's snapshots against the quota", () => {
            const mine = createSnapshot(OWNER);
            createSnapshot(OTHER);
            createSnapshot(OTHER);
            createSnapshot(OWNER);
            expect(getForServing(mine.id)).not.toBeNull();
        });
    });

    describe('TTL', () => {
        it('expires after the idle TTL without management writes', () => {
            const snapshot = createSnapshot();
            fakeNow += getLimits().idleTtlMs + 1;
            expect(getForServing(snapshot.id)).toBeNull();
            expect(getOwned(snapshot.id, OWNER)).toEqual({ status: 404 });
        });

        it('slides the idle TTL on management writes (replace)', () => {
            const snapshot = createSnapshot();
            const { idleTtlMs } = getLimits();
            fakeNow += idleTtlMs - 1000;
            createOrReplace(OWNER, snapshot.id, makeFiles());
            fakeNow += idleTtlMs - 1000;
            expect(getForServing(snapshot.id)).not.toBeNull();
        });

        it('serving does NOT renew the idle TTL', () => {
            const snapshot = createSnapshot();
            const { idleTtlMs } = getLimits();
            fakeNow += idleTtlMs - 1000;
            expect(getForServing(snapshot.id)).not.toBeNull();
            fakeNow += 2000; // past idle TTL relative to the last WRITE
            expect(getForServing(snapshot.id)).toBeNull();
        });

        it('enforces the absolute cap even under constant renewal', () => {
            const snapshot = createSnapshot();
            const { idleTtlMs, absoluteTtlMs } = getLimits();
            const step = idleTtlMs - 1000;
            for (let elapsed = 0; elapsed <= absoluteTtlMs; elapsed += step) {
                fakeNow += step;
                createOrReplace(OWNER, snapshot.id, makeFiles());
            }
            expect(getForServing(snapshot.id)).toBeNull();
        });

        it('sweepExpired reclaims expired snapshots', () => {
            createSnapshot();
            createSnapshot(OTHER);
            fakeNow += getLimits().idleTtlMs + 1;
            expect(sweepExpired()).toBe(2);
            expect(liveCount()).toBe(0);
        });
    });

    describe('startSweeper', () => {
        it('schedules periodic sweeps through the injected interval scheduler', () => {
            let swept: (() => void) | null = null;
            let cleared = false;
            const timer = { unref: () => {} } as unknown as ReturnType<typeof setInterval>;
            configure({
                now: () => fakeNow,
                scheduleInterval: (fn: () => void) => {
                    swept = fn;
                    return timer;
                },
            });
            const originalClearInterval = globalThis.clearInterval;
            globalThis.clearInterval = ((t: unknown) => {
                if (t === timer) cleared = true;
            }) as typeof clearInterval;
            try {
                const stop = startSweeper(60_000);
                createSnapshot();
                fakeNow += getLimits().idleTtlMs + 1;
                expect(liveCount()).toBe(0);
                swept!();
                expect(sweepExpired()).toBe(0); // already reclaimed by the sweep
                stop();
                expect(cleared).toBe(true);
            } finally {
                globalThis.clearInterval = originalClearInterval;
            }
        });
    });

    describe('ownership and deletion', () => {
        it('getOwned distinguishes 403 (wrong user) from 404 (unknown)', () => {
            const snapshot = createSnapshot();
            expect('snapshot' in getOwned(snapshot.id, OWNER)).toBe(true);
            expect(getOwned(snapshot.id, OTHER)).toEqual({ status: 403 });
            expect(getOwned('0'.repeat(32), OWNER)).toEqual({ status: 404 });
        });

        it('deleteSnapshot removes the snapshot from serving', () => {
            const snapshot = createSnapshot();
            expect(deleteSnapshot(snapshot.id)).toBe(true);
            expect(getForServing(snapshot.id)).toBeNull();
            expect(deleteSnapshot(snapshot.id)).toBe(false);
        });
    });

    describe('getForServing id gate', () => {
        it('rejects ids that are not 32 lowercase hex chars', () => {
            createSnapshot();
            for (const bad of [
                '',
                'short',
                'G'.repeat(32),
                'f'.repeat(31),
                'f'.repeat(33),
                '../../etc',
                'F'.repeat(32),
            ]) {
                expect(getForServing(bad)).toBeNull();
            }
        });
    });

    describe('getFile', () => {
        const files = makeFiles({
            'index.html': '<html></html>',
            'theme/style.css': 'body{}',
            'libs/app.js': ';',
            'img/logo.svg': '<svg/>',
            'img/photo.png': 'png',
            'content/doc.pdf': 'pdf',
            'content/data.xml': '<x/>',
            'notes.txt': '<script>plain text, html-looking</script>',
        });

        it('resolves normalized paths and maps MIME types', () => {
            const snapshot = createSnapshot(OWNER, files);
            expect(getFile(snapshot, 'index.html')?.contentType).toBe('text/html; charset=utf-8');
            expect(getFile(snapshot, '/theme/style.css')?.contentType).toBe('text/css; charset=utf-8');
            expect(getFile(snapshot, 'libs/app.js')?.contentType).toBe('application/javascript; charset=utf-8');
            expect(getFile(snapshot, 'img/photo.png')?.contentType).toBe('image/png');
            expect(getFile(snapshot, 'content/doc.pdf')?.contentType).toBe('application/pdf');
            // A .txt file keeps text/plain no matter what its bytes look like.
            expect(getFile(snapshot, 'notes.txt')?.contentType).toBe('text/plain; charset=utf-8');
        });

        it('flags scriptable document types (HTML, SVG, XML, PDF) and only those', () => {
            const snapshot = createSnapshot(OWNER, files);
            expect(getFile(snapshot, 'index.html')?.isScriptable).toBe(true);
            expect(getFile(snapshot, 'img/logo.svg')?.isScriptable).toBe(true);
            expect(getFile(snapshot, 'content/data.xml')?.isScriptable).toBe(true);
            expect(getFile(snapshot, 'content/doc.pdf')?.isScriptable).toBe(true);
            expect(getFile(snapshot, 'theme/style.css')?.isScriptable).toBe(false);
            expect(getFile(snapshot, 'libs/app.js')?.isScriptable).toBe(false);
            expect(getFile(snapshot, 'img/photo.png')?.isScriptable).toBe(false);
        });

        it('rejects the traversal corpus', () => {
            const snapshot = createSnapshot(OWNER, files);
            const corpus = [
                '../secret',
                '..',
                'a/../../secret',
                '%2e%2e%2fsecret',
                '..%2fsecret',
                '%2e%2e/secret',
                'a\0b.html',
                '%00',
                '%ZZ',
            ];
            for (const path of corpus) {
                expect(getFile(snapshot, path)).toBeNull();
            }
            // Backslashes are literal (not separators) and simply miss the map.
            expect(getFile(snapshot, '..\\secret')).toBeNull();
            // Absolute-looking paths resolve web-root-relative into the map.
            expect(getFile(snapshot, '/index.html')).not.toBeNull();
        });

        it('returns null for paths not in the snapshot', () => {
            const snapshot = createSnapshot(OWNER, files);
            expect(getFile(snapshot, 'missing.html')).toBeNull();
        });
    });

    describe('unpackSnapshotArchive', () => {
        function zipOf(entries: Record<string, string>): Uint8Array {
            return fflate.zipSync(
                Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, new TextEncoder().encode(v)])),
            );
        }

        it('unpacks a valid archive into a normalized file map', () => {
            const result = unpackSnapshotArchive(zipOf({ 'index.html': '<p>x</p>', 'theme/style.css': 'body{}' }));
            if ('status' in result) throw new Error('expected success');
            expect(new TextDecoder().decode(result.files.get('index.html'))).toBe('<p>x</p>');
            expect(result.files.has('theme/style.css')).toBe(true);
        });

        it('rejects an archive containing a traversal entry (whole archive, 400)', () => {
            const result = unpackSnapshotArchive(zipOf({ 'index.html': 'ok', '../evil.html': 'evil' }));
            expect('status' in result && result.status).toBe(400);
        });

        it('rejects non-ZIP bytes with 400', () => {
            const result = unpackSnapshotArchive(new TextEncoder().encode('not a zip'));
            expect('status' in result && result.status).toBe(400);
        });

        it('rejects archives over the byte cap with 413 (pre-inflation guard)', () => {
            process.env.MAX_UPLOAD_SIZE = '64';
            const result = unpackSnapshotArchive(zipOf({ 'index.html': 'x'.repeat(200) }));
            expect('status' in result && result.status).toBe(413);
        });

        it('skips directory entries', () => {
            const zipped = fflate.zipSync({ 'dir/': new Uint8Array(0), 'dir/file.txt': new TextEncoder().encode('x') });
            const result = unpackSnapshotArchive(zipped);
            if ('status' in result) throw new Error('expected success');
            expect(result.files.has('dir')).toBe(false);
            expect(result.files.has('dir/file.txt')).toBe(true);
        });
    });
});
