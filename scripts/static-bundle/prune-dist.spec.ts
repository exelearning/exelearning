import { describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
    KEEP_LOOSE_APP_FILES,
    STATIC_ONLY_PRUNE_PATHS,
    computeBundledAppSources,
    pruneDistPaths,
    removeEmptyDirs,
} from './prune-dist';

const projectRoot = path.resolve(import.meta.dir, '../..');

function makeTempDist(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'exe-prune-dist-'));
}

describe('pruneDistPaths', () => {
    it('removes listed files and directories and reports sizes', () => {
        const dist = makeTempDist();
        try {
            fs.mkdirSync(path.join(dist, 'app/admin'), { recursive: true });
            fs.writeFileSync(path.join(dist, 'app/admin/admin.js'), 'server only');
            fs.writeFileSync(path.join(dist, 'app/dead.js'), 'dead file');
            fs.writeFileSync(path.join(dist, 'app/alive.js'), 'still here');

            const stats = pruneDistPaths(dist, ['app/admin', 'app/dead.js']);

            expect(stats.files).toBe(2);
            expect(stats.bytes).toBe('server only'.length + 'dead file'.length);
            expect(fs.existsSync(path.join(dist, 'app/admin'))).toBe(false);
            expect(fs.existsSync(path.join(dist, 'app/dead.js'))).toBe(false);
            expect(fs.existsSync(path.join(dist, 'app/alive.js'))).toBe(true);
        } finally {
            fs.rmSync(dist, { recursive: true, force: true });
        }
    });

    it('throws on a missing path so a stale list fails the build loudly', () => {
        const dist = makeTempDist();
        try {
            expect(() => pruneDistPaths(dist, ['app/never-existed.js'])).toThrow(/stale prune list/);
        } finally {
            fs.rmSync(dist, { recursive: true, force: true });
        }
    });

    it('refuses to prune license material regardless of the list contents', () => {
        const dist = makeTempDist();
        try {
            fs.mkdirSync(path.join(dist, 'libs/foo'), { recursive: true });
            fs.writeFileSync(path.join(dist, 'libs/foo/LICENSE'), 'MIT');
            expect(() => pruneDistPaths(dist, ['libs/foo/LICENSE'])).toThrow(/license/);
            expect(fs.existsSync(path.join(dist, 'libs/foo/LICENSE'))).toBe(true);
        } finally {
            fs.rmSync(dist, { recursive: true, force: true });
        }
    });
});

describe('removeEmptyDirs', () => {
    it('removes directories left empty by pruning, keeping populated ones and the root', () => {
        const dist = makeTempDist();
        try {
            fs.mkdirSync(path.join(dist, 'app/empty/nested'), { recursive: true });
            fs.mkdirSync(path.join(dist, 'app/full'), { recursive: true });
            fs.writeFileSync(path.join(dist, 'app/full/file.js'), 'x');

            const removed = removeEmptyDirs(dist);

            expect(removed).toBe(2);
            expect(fs.existsSync(path.join(dist, 'app/empty'))).toBe(false);
            expect(fs.existsSync(path.join(dist, 'app/full/file.js'))).toBe(true);
            expect(fs.existsSync(dist)).toBe(true);
        } finally {
            fs.rmSync(dist, { recursive: true, force: true });
        }
    });
});

describe('STATIC_ONLY_PRUNE_PATHS', () => {
    it('lists only paths that exist in public/ (list must not go stale)', () => {
        for (const rel of STATIC_ONLY_PRUNE_PATHS) {
            expect(fs.existsSync(path.join(projectRoot, 'public', rel)), `missing in public/: ${rel}`).toBe(true);
        }
    });

    it('never touches license/attribution material or runtime-fetched docs', () => {
        const forbidden = ['libs/README.md', 'libs/LICENSES.md', 'CHANGELOG.md'];
        for (const rel of STATIC_ONLY_PRUNE_PATHS) {
            expect(rel.toLowerCase()).not.toContain('license');
            expect(forbidden).not.toContain(rel);
        }
    });
});

describe('computeBundledAppSources', () => {
    it('derives the app.bundle.js graph from the real sources', async () => {
        const bundled = await computeBundledAppSources(projectRoot);

        expect(bundled.length).toBeGreaterThanOrEqual(50);
        expect(bundled).toContain('app/app.js');
        for (const rel of bundled) {
            expect(rel.startsWith('app/')).toBe(true);
            expect(fs.existsSync(path.join(projectRoot, 'public', rel)), `missing in public/: ${rel}`).toBe(true);
        }
        // The static index.html loads these two loose as ES modules — they must
        // survive the prune even though they are also bundle inputs.
        for (const kept of KEEP_LOOSE_APP_FILES) {
            expect(bundled).not.toContain(kept);
        }
    });
});
