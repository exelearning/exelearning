import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { configure, getManifestIds, getResource, hasResource, resetDependencies } from './preview-fixed-resources';

/**
 * Build a throwaway distribution root + manifest. `resources` entries are
 * written verbatim into the manifest; `files` are materialized under the root.
 */
function makeFixture(options: {
    manifest?: unknown;
    files?: Record<string, string>;
}): { root: string; manifestPath: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-fixed-'));
    for (const [rel, content] of Object.entries(options.files ?? {})) {
        const abs = path.join(root, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content);
    }
    const manifestPath = path.join(root, 'bundles', 'preview-fixed-resources.json');
    if (options.manifest !== undefined) {
        fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
        fs.writeFileSync(manifestPath, JSON.stringify(options.manifest));
    }
    return { root, manifestPath };
}

const createdRoots: string[] = [];

function useFixture(options: Parameters<typeof makeFixture>[0]): string {
    const { root, manifestPath } = makeFixture(options);
    createdRoots.push(root);
    configure({ publicRoot: root, manifestPath });
    return root;
}

beforeEach(() => {
    resetDependencies();
});

afterEach(() => {
    resetDependencies();
    for (const root of createdRoots.splice(0)) {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

describe('preview-fixed-resources', () => {
    it('resolves a known id to its bytes and size (happy path)', () => {
        useFixture({
            manifest: {
                schemaVersion: 1,
                buildVersion: 'v1.0.0',
                resources: { 'libs/jquery/jquery.min.js': { path: 'libs/jquery/jquery.min.js', size: 9 } },
            },
            files: { 'libs/jquery/jquery.min.js': 'jquery();' },
        });
        expect(hasResource('libs/jquery/jquery.min.js')).toBe(true);
        expect(getManifestIds()).toEqual(['libs/jquery/jquery.min.js']);
        const resource = getResource('libs/jquery/jquery.min.js');
        expect(resource).not.toBeNull();
        expect(new TextDecoder().decode(resource!.bytes)).toBe('jquery();');
        expect(resource!.size).toBe(9);
    });

    it('returns null / false for unknown ids without touching the filesystem', () => {
        useFixture({
            manifest: { schemaVersion: 1, buildVersion: 'v1', resources: {} },
        });
        expect(hasResource('libs/evil/../../etc/passwd')).toBe(false);
        expect(getResource('anything')).toBeNull();
        expect(getManifestIds()).toEqual([]);
    });

    it('rejects traversal paths in a corrupt manifest (never escapes the root)', () => {
        const root = useFixture({
            manifest: {
                schemaVersion: 1,
                buildVersion: 'v1',
                resources: {
                    'libs/escape.txt': { path: '../outside.txt', size: 7 },
                    'libs/absolute.txt': { path: '/etc/hosts', size: 7 },
                },
            },
        });
        // Materialize the file the traversal points at, to prove containment
        // (not absence) is what blocks it.
        fs.writeFileSync(path.join(path.dirname(root), 'outside.txt'), 'secret!');
        expect(hasResource('libs/escape.txt')).toBe(true);
        expect(getResource('libs/escape.txt')).toBeNull();
        expect(getResource('libs/absolute.txt')).toBeNull();
    });

    it('rejects symlink escapes out of the public root', () => {
        const root = useFixture({
            manifest: {
                schemaVersion: 1,
                buildVersion: 'v1',
                resources: { 'libs/link.txt': { path: 'libs/link.txt', size: 7 } },
            },
        });
        const outside = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'preview-outside-')), 'target.txt');
        createdRoots.push(path.dirname(outside));
        fs.writeFileSync(outside, 'secret!');
        fs.mkdirSync(path.join(root, 'libs'), { recursive: true });
        fs.symlinkSync(outside, path.join(root, 'libs', 'link.txt'));
        expect(getResource('libs/link.txt')).toBeNull();
    });

    it('returns null for files listed in the manifest but missing on disk', () => {
        useFixture({
            manifest: {
                schemaVersion: 1,
                buildVersion: 'v1',
                resources: { 'libs/ghost.js': { path: 'libs/ghost.js', size: 3 } },
            },
        });
        expect(hasResource('libs/ghost.js')).toBe(true);
        expect(getResource('libs/ghost.js')).toBeNull();
    });

    it('treats a missing or schema-mismatched manifest as an empty fixed layer', () => {
        useFixture({}); // no manifest file at all
        expect(hasResource('libs/jquery/jquery.min.js')).toBe(false);
        expect(getManifestIds()).toEqual([]);

        useFixture({
            manifest: { schemaVersion: 2, buildVersion: 'v9', resources: { a: { path: 'a', size: 1 } } },
            files: { a: 'x' },
        });
        expect(hasResource('a')).toBe(false);
        expect(getResource('a')).toBeNull();
    });

    it('caches the manifest until configure() or resetDependencies()', () => {
        const root = useFixture({
            manifest: {
                schemaVersion: 1,
                buildVersion: 'v1',
                resources: { 'libs/a.js': { path: 'libs/a.js', size: 1 } },
            },
            files: { 'libs/a.js': 'a' },
        });
        expect(hasResource('libs/a.js')).toBe(true);
        // Overwrite the manifest on disk; the cached view must not change...
        fs.writeFileSync(
            path.join(root, 'bundles', 'preview-fixed-resources.json'),
            JSON.stringify({ schemaVersion: 1, buildVersion: 'v1', resources: {} }),
        );
        expect(hasResource('libs/a.js')).toBe(true);
        // ...until the cache is invalidated through the DI surface.
        configure({});
        expect(hasResource('libs/a.js')).toBe(false);
    });

    it('resolves ids from the real build manifest by default (integration smoke)', () => {
        // resetDependencies() points at public/bundles/ of the repo; the
        // resource-bundle build may or may not have run in this checkout, so
        // only assert consistency, not presence.
        const ids = getManifestIds();
        for (const id of ids.slice(0, 5)) {
            expect(hasResource(id)).toBe(true);
        }
    });
});
