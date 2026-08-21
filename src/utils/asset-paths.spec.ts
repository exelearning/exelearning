import * as nodePath from 'path';
import {
    ASSETS_ROOT_DIR_NAME,
    buildAssetStoragePath,
    deriveShardedAssetStoragePath,
    extractAssetsRelativeSegments,
    getAssetShard,
    getProjectAssetsDirCandidates,
    isCanonicalAssetStoragePath,
    resolveAssetStoragePath,
    tryResolveAssetStoragePath,
} from './asset-paths';
import { UnsafePathError } from './safe-path';

describe('asset-paths', () => {
    describe('getAssetShard', () => {
        it('returns the first two hex characters of a canonical UUID', () => {
            expect(getAssetShard('ab12cd34-1234-4abc-8def-1234567890ab')).toBe('ab');
            expect(getAssetShard('00000000-0000-4000-8000-000000000000')).toBe('00');
            expect(getAssetShard('ffe0d5aa-d8d2-4a7b-bf6d-c809321ccc2a')).toBe('ff');
        });

        it('lowercases the shard for uppercase canonical UUIDs', () => {
            expect(getAssetShard('AB12CD34-1234-4ABC-8DEF-1234567890AB')).toBe('ab');
        });

        it('is deterministic for the same input', () => {
            expect(getAssetShard('some-arbitrary-id')).toBe(getAssetShard('some-arbitrary-id'));
        });

        it('hashes non-canonical identifiers to a stable two-hex bucket (FNV-1a, low 8 bits)', () => {
            // Golden values computed independently with FNV-1a 32-bit over UTF-8 bytes.
            expect(getAssetShard('123')).toBe('1b');
            expect(getAssetShard('20250116143027ABCDEF')).toBe('d0');
            expect(getAssetShard('not-a-uuid')).toBe('e0');
            expect(getAssetShard('456')).toBe('3c');
        });

        it('always returns a valid two-character lowercase hex bucket', () => {
            for (const id of ['a', 'zz', 'project x', '../../evil', '9'.repeat(64)]) {
                expect(getAssetShard(id)).toMatch(/^[0-9a-f]{2}$/);
            }
        });

        it('throws UnsafePathError for empty or non-string input', () => {
            expect(() => getAssetShard('')).toThrow(UnsafePathError);
            expect(() => getAssetShard(undefined as unknown as string)).toThrow(UnsafePathError);
        });
    });

    describe('buildAssetStoragePath', () => {
        const uuid = 'ab12cd34-1234-4abc-8def-1234567890ab';

        it('builds a POSIX path under assets/<shard>/<uuid>/ for a flat asset', () => {
            expect(buildAssetStoragePath(uuid, 'client-id-1.png')).toBe(`assets/ab/${uuid}/client-id-1.png`);
        });

        it('builds a nested path for extracted/duplicated assets', () => {
            expect(buildAssetStoragePath(uuid, 'client-id-1', 'index.html')).toBe(
                `assets/ab/${uuid}/client-id-1/index.html`,
            );
        });

        it('accepts filenames with spaces, parentheses and unicode', () => {
            expect(buildAssetStoragePath(uuid, 'client-id-1', 'photo (copy 2).png')).toBe(
                `assets/ab/${uuid}/client-id-1/photo (copy 2).png`,
            );
            expect(buildAssetStoragePath(uuid, 'client-id-1', 'imágen ñ.png')).toBe(
                `assets/ab/${uuid}/client-id-1/imágen ñ.png`,
            );
        });

        it('uses POSIX separators regardless of platform', () => {
            const stored = buildAssetStoragePath(uuid, 'a', 'b.txt');
            expect(stored).not.toContain('\\');
            expect(stored.split('/')).toEqual(['assets', 'ab', uuid, 'a', 'b.txt']);
        });

        it('requires at least one segment below the project directory', () => {
            expect(() => buildAssetStoragePath(uuid)).toThrow(UnsafePathError);
        });

        it('rejects traversal and separator-bearing segments', () => {
            expect(() => buildAssetStoragePath(uuid, '..')).toThrow(UnsafePathError);
            expect(() => buildAssetStoragePath(uuid, '.')).toThrow(UnsafePathError);
            expect(() => buildAssetStoragePath(uuid, 'a/b.txt')).toThrow(UnsafePathError);
            expect(() => buildAssetStoragePath(uuid, 'a\\b.txt')).toThrow(UnsafePathError);
            expect(() => buildAssetStoragePath(uuid, '')).toThrow(UnsafePathError);
            expect(() => buildAssetStoragePath(uuid, 'nul\0byte.png')).toThrow(UnsafePathError);
        });

        it('rejects an unsafe project identifier', () => {
            expect(() => buildAssetStoragePath('../evil', 'f.png')).toThrow(UnsafePathError);
            expect(() => buildAssetStoragePath('', 'f.png')).toThrow(UnsafePathError);
        });
    });

    describe('isCanonicalAssetStoragePath', () => {
        const uuid = 'ab12cd34-1234-4abc-8def-1234567890ab';

        it('accepts new-format sharded paths', () => {
            expect(isCanonicalAssetStoragePath(`assets/ab/${uuid}/client.png`)).toBe(true);
            expect(isCanonicalAssetStoragePath(`assets/ab/${uuid}/client/file name (1).html`)).toBe(true);
        });

        it('accepts unsharded assets-relative paths (conflict fallback form)', () => {
            expect(isCanonicalAssetStoragePath(`assets/${uuid}/client.png`)).toBe(true);
        });

        it('rejects absolute paths', () => {
            expect(isCanonicalAssetStoragePath(`/mnt/data/assets/${uuid}/client.png`)).toBe(false);
            expect(isCanonicalAssetStoragePath(`C:\\data\\assets\\${uuid}\\client.png`)).toBe(false);
        });

        it('rejects traversal, backslashes, empty segments and non-assets prefixes', () => {
            expect(isCanonicalAssetStoragePath(`assets/../etc/passwd`)).toBe(false);
            expect(isCanonicalAssetStoragePath(`assets\\ab\\${uuid}\\f.png`)).toBe(false);
            expect(isCanonicalAssetStoragePath(`assets//${uuid}/f.png`)).toBe(false);
            expect(isCanonicalAssetStoragePath(`themes/site/foo`)).toBe(false);
            expect(isCanonicalAssetStoragePath('assets')).toBe(false);
            expect(isCanonicalAssetStoragePath('assets/')).toBe(false);
            expect(isCanonicalAssetStoragePath('')).toBe(false);
            expect(isCanonicalAssetStoragePath(null)).toBe(false);
            expect(isCanonicalAssetStoragePath(42)).toBe(false);
        });
    });

    describe('extractAssetsRelativeSegments', () => {
        const uuid = 'ab12cd34-1234-4abc-8def-1234567890ab';

        it('extracts the assets-relative segments from a legacy absolute POSIX path', () => {
            expect(extractAssetsRelativeSegments(`/mnt/data/assets/${uuid}/client.png`)).toEqual([uuid, 'client.png']);
        });

        it('extracts from a legacy absolute Windows path', () => {
            expect(extractAssetsRelativeSegments(`C:\\app\\data\\assets\\${uuid}\\client.png`)).toEqual([
                uuid,
                'client.png',
            ]);
        });

        it('extracts nested ZIP-extraction layouts', () => {
            expect(extractAssetsRelativeSegments(`/mnt/data/assets/${uuid}/client-1/index.html`)).toEqual([
                uuid,
                'client-1',
                'index.html',
            ]);
        });

        it('uses the last assets component when several are present', () => {
            expect(extractAssetsRelativeSegments(`/srv/assets/data/assets/${uuid}/f.png`)).toEqual([uuid, 'f.png']);
        });

        it('returns null when there is no assets component', () => {
            expect(extractAssetsRelativeSegments('/mnt/data/tmp/2026/01/01/x/f.png')).toBeNull();
            expect(extractAssetsRelativeSegments('/mnt/assets-data/foo/f.png')).toBeNull();
        });

        it('returns null when the suffix is empty or unsafe', () => {
            expect(extractAssetsRelativeSegments('/mnt/data/assets')).toBeNull();
            expect(extractAssetsRelativeSegments('/mnt/data/assets/')).toBeNull();
            expect(extractAssetsRelativeSegments(`/mnt/data/assets/../etc/passwd`)).toBeNull();
            expect(extractAssetsRelativeSegments(`/mnt/data/assets/${uuid}/..`)).toBeNull();
        });

        it('returns null for a single-segment suffix (would resolve to a directory)', () => {
            // 'assets/ab' style values point at a whole bucket/project dir, not
            // a file; deletes must never recursively remove those.
            expect(extractAssetsRelativeSegments('/mnt/data/assets/ab')).toBeNull();
            expect(extractAssetsRelativeSegments(`/mnt/data/assets/${uuid}`)).toBeNull();
        });

        it('handles a file literally named assets by backtracking to an earlier component', () => {
            expect(extractAssetsRelativeSegments(`/mnt/data/assets/${uuid}/client-1/assets`)).toEqual([
                uuid,
                'client-1',
                'assets',
            ]);
        });
    });

    describe('resolveAssetStoragePath', () => {
        const uuid = 'ab12cd34-1234-4abc-8def-1234567890ab';
        const filesDir = nodePath.join(nodePath.sep, 'srv', 'exelearning-data');

        it('resolves a canonical relative path under FILES_DIR', () => {
            const resolved = resolveAssetStoragePath(filesDir, `assets/ab/${uuid}/client.png`);
            expect(resolved).toBe(nodePath.join(filesDir, ASSETS_ROOT_DIR_NAME, 'ab', uuid, 'client.png'));
        });

        it('resolves the same stored path under a different FILES_DIR (portability)', () => {
            const stored = `assets/ab/${uuid}/client.png`;
            const otherFilesDir = nodePath.join(nodePath.sep, 'mnt', 'restored');
            expect(resolveAssetStoragePath(filesDir, stored)).toStartWith(filesDir + nodePath.sep);
            expect(resolveAssetStoragePath(otherFilesDir, stored)).toStartWith(otherFilesDir + nodePath.sep);
        });

        it('re-roots a legacy absolute path under the current FILES_DIR', () => {
            const legacy = `/old-mount/data/assets/${uuid}/client.png`;
            expect(resolveAssetStoragePath(filesDir, legacy)).toBe(
                nodePath.join(filesDir, ASSETS_ROOT_DIR_NAME, uuid, 'client.png'),
            );
        });

        it('re-roots a legacy Windows absolute path under the current FILES_DIR', () => {
            const legacy = `C:\\app\\data\\assets\\${uuid}\\client.png`;
            expect(resolveAssetStoragePath(filesDir, legacy)).toBe(
                nodePath.join(filesDir, ASSETS_ROOT_DIR_NAME, uuid, 'client.png'),
            );
        });

        it('throws UnsafePathError for traversal attempts', () => {
            expect(() => resolveAssetStoragePath(filesDir, 'assets/../secrets.db')).toThrow(UnsafePathError);
            expect(() => resolveAssetStoragePath(filesDir, `/x/assets/../../etc/passwd`)).toThrow(UnsafePathError);
        });

        it('throws UnsafePathError for values that cannot be interpreted at all', () => {
            expect(() => resolveAssetStoragePath(filesDir, '/mnt/elsewhere/file.png')).toThrow(UnsafePathError);
            expect(() => resolveAssetStoragePath(filesDir, 'relative/but/not/assets.png')).toThrow(UnsafePathError);
            expect(() => resolveAssetStoragePath(filesDir, '')).toThrow(UnsafePathError);
        });

        it('never resolves outside FILES_DIR/assets', () => {
            const attempts = ['assets/ab/../../outside.png', `/mnt/data/assets/${uuid}/\0.png`, 'assets/./client.png'];
            for (const attempt of attempts) {
                let resolved: string | null = null;
                try {
                    resolved = resolveAssetStoragePath(filesDir, attempt);
                } catch (err) {
                    expect(err).toBeInstanceOf(UnsafePathError);
                }
                if (resolved !== null) {
                    const assetsRoot = nodePath.join(filesDir, ASSETS_ROOT_DIR_NAME);
                    expect(resolved.startsWith(assetsRoot + nodePath.sep)).toBe(true);
                }
            }
        });
    });

    describe('getProjectAssetsDirCandidates', () => {
        const uuid = 'ab12cd34-1234-4abc-8def-1234567890ab';
        const filesDir = nodePath.join(nodePath.sep, 'srv', 'exelearning-data');

        it('returns the sharded directory first, then the legacy unsharded directory', () => {
            expect(getProjectAssetsDirCandidates(filesDir, uuid)).toEqual([
                nodePath.join(filesDir, ASSETS_ROOT_DIR_NAME, 'ab', uuid),
                nodePath.join(filesDir, ASSETS_ROOT_DIR_NAME, uuid),
            ]);
        });

        it('never returns a legacy candidate that collides with a shard bucket directory', () => {
            // A hypothetical two-hex project identifier must not cause the
            // legacy candidate to point at a shard bucket (mass deletion).
            const candidates = getProjectAssetsDirCandidates(filesDir, 'ab');
            for (const candidate of candidates) {
                expect(candidate).not.toBe(nodePath.join(filesDir, ASSETS_ROOT_DIR_NAME, 'ab'));
            }
        });

        it('applies the shard-bucket collision guard case-insensitively', () => {
            // On case-insensitive filesystems (macOS/Windows desktop builds)
            // 'AB' aliases the 'ab' bucket; the legacy candidate must be
            // suppressed for uppercase two-hex identifiers too.
            const candidates = getProjectAssetsDirCandidates(filesDir, 'AB');
            expect(candidates.length).toBe(1);
            for (const candidate of candidates) {
                expect(candidate.toLowerCase()).not.toBe(nodePath.join(filesDir, ASSETS_ROOT_DIR_NAME, 'ab'));
            }
        });

        it('throws UnsafePathError for unsafe project identifiers', () => {
            expect(() => getProjectAssetsDirCandidates(filesDir, '../evil')).toThrow(UnsafePathError);
            expect(() => getProjectAssetsDirCandidates(filesDir, '')).toThrow(UnsafePathError);
        });
    });

    describe('tryResolveAssetStoragePath', () => {
        const uuid = 'ab12cd34-1234-4abc-8def-1234567890ab';
        const filesDir = nodePath.join(nodePath.sep, 'srv', 'exelearning-data');

        it('returns the resolved path for valid input', () => {
            expect(tryResolveAssetStoragePath(filesDir, `assets/ab/${uuid}/f.png`)).toBe(
                nodePath.join(filesDir, ASSETS_ROOT_DIR_NAME, 'ab', uuid, 'f.png'),
            );
        });

        it('returns null instead of throwing for invalid input', () => {
            expect(tryResolveAssetStoragePath(filesDir, '/mnt/elsewhere/file.png')).toBeNull();
            expect(tryResolveAssetStoragePath(filesDir, 'assets/../evil')).toBeNull();
            expect(tryResolveAssetStoragePath(filesDir, '')).toBeNull();
        });
    });

    describe('deriveShardedAssetStoragePath', () => {
        const uuid = 'ab12cd34-1234-4abc-8def-1234567890ab';

        it('maps an already-sharded canonical value to itself', () => {
            expect(deriveShardedAssetStoragePath(uuid, `assets/ab/${uuid}/f.png`)).toBe(`assets/ab/${uuid}/f.png`);
            expect(deriveShardedAssetStoragePath(uuid, `assets/ab/${uuid}/client/inner.html`)).toBe(
                `assets/ab/${uuid}/client/inner.html`,
            );
        });

        it('maps a parked conflict value (assets/<uuid>/...) to its sharded target', () => {
            expect(deriveShardedAssetStoragePath(uuid, `assets/${uuid}/f.png`)).toBe(`assets/ab/${uuid}/f.png`);
        });

        it('maps a legacy absolute value to its sharded target via the assets suffix', () => {
            expect(deriveShardedAssetStoragePath(uuid, `/mnt/data/assets/${uuid}/f.png`)).toBe(
                `assets/ab/${uuid}/f.png`,
            );
            expect(deriveShardedAssetStoragePath(uuid, `C:\\data\\assets\\${uuid}\\f.png`)).toBe(
                `assets/ab/${uuid}/f.png`,
            );
        });

        it('re-parents a legacy numeric-directory value under the project uuid', () => {
            expect(deriveShardedAssetStoragePath(uuid, 'assets/42/f.png')).toBe(`assets/ab/${uuid}/f.png`);
        });

        it('returns null for uninterpretable or unsafe values', () => {
            expect(deriveShardedAssetStoragePath(uuid, '/etc/passwd')).toBeNull();
            expect(deriveShardedAssetStoragePath(uuid, `assets/${uuid}/../../evil`)).toBeNull();
            expect(deriveShardedAssetStoragePath(uuid, '')).toBeNull();
            expect(deriveShardedAssetStoragePath('', `assets/${uuid}/f.png`)).toBeNull();
        });
    });
});
