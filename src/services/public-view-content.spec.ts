/**
 * Tests for the public read-only viewer content service.
 *
 * The real exporter is replaced via dependency injection
 * (`configurePublicViewContent`) so these tests do not run the full export
 * pipeline; they focus on path safety, content-type resolution and caching.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { zipSync, strToU8 } from 'fflate';
import type { Project } from '../db/types';
import {
    getPublicViewFile,
    normalizePublicViewPath,
    configurePublicViewContent,
    resetPublicViewContent,
    type ExportResult,
} from './public-view-content';

function makeProject(overrides: Partial<Project> = {}): Project {
    return {
        id: 1,
        uuid: 'project-uuid',
        public_view_id: 'public-id',
        public_view_enabled: 1,
        updated_at: 1000,
        ...overrides,
    } as Project;
}

function makeZip(files: Record<string, string>): Uint8Array {
    const entries: Record<string, Uint8Array> = {};
    for (const [p, content] of Object.entries(files)) {
        entries[p] = strToU8(content);
    }
    return zipSync(entries);
}

describe('normalizePublicViewPath', () => {
    it('defaults an empty path to index.html', () => {
        expect(normalizePublicViewPath('')).toBe('index.html');
    });

    it('strips leading slashes', () => {
        expect(normalizePublicViewPath('/html/page.html')).toBe('html/page.html');
    });

    it('strips query strings and hashes', () => {
        expect(normalizePublicViewPath('index.html?t=1')).toBe('index.html');
        expect(normalizePublicViewPath('index.html#section')).toBe('index.html');
    });

    it('normalizes interior dot segments that stay inside the root', () => {
        expect(normalizePublicViewPath('a/b/../c.html')).toBe('a/c.html');
    });

    it('rejects path traversal', () => {
        expect(normalizePublicViewPath('../secret')).toBeNull();
        expect(normalizePublicViewPath('a/../../secret')).toBeNull();
        expect(normalizePublicViewPath('..')).toBeNull();
    });

    it('rejects encoded traversal', () => {
        expect(normalizePublicViewPath('%2e%2e%2fsecret')).toBeNull();
    });

    it('rejects malformed percent-encoding', () => {
        expect(normalizePublicViewPath('%ZZ')).toBeNull();
    });

    it('rejects NUL bytes', () => {
        expect(normalizePublicViewPath('a\0b')).toBeNull();
    });
});

describe('getPublicViewFile', () => {
    beforeEach(() => {
        resetPublicViewContent();
    });

    afterEach(() => {
        resetPublicViewContent();
    });

    it('serves a file from the export with the right content type', async () => {
        configurePublicViewContent({
            resolveVersion: async (): Promise<string> => '1',
            buildExport: async (): Promise<ExportResult> => ({
                success: true,
                data: makeZip({ 'index.html': '<h1>hi</h1>' }),
            }),
        });

        const file = await getPublicViewFile(makeProject(), 'index.html');
        expect(file).not.toBeNull();
        expect(file!.contentType).toBe('text/html; charset=utf-8');
        expect(new TextDecoder().decode(file!.content)).toBe('<h1>hi</h1>');
    });

    it('serves nested files and resolves css/js/images content types', async () => {
        configurePublicViewContent({
            resolveVersion: async (): Promise<string> => '1',
            buildExport: async (): Promise<ExportResult> => ({
                success: true,
                data: makeZip({
                    'html/page.html': '<p>p</p>',
                    'css/style.css': 'body{}',
                    'js/app.js': 'var x=1;',
                    'img/logo.png': 'PNG',
                }),
            }),
        });

        const project = makeProject();
        expect((await getPublicViewFile(project, 'html/page.html'))!.contentType).toBe('text/html; charset=utf-8');
        expect((await getPublicViewFile(project, 'css/style.css'))!.contentType).toBe('text/css; charset=utf-8');
        expect((await getPublicViewFile(project, 'js/app.js'))!.contentType).toBe(
            'application/javascript; charset=utf-8',
        );
        expect((await getPublicViewFile(project, 'img/logo.png'))!.contentType).toBe('image/png');
    });

    it('returns null for a missing file', async () => {
        configurePublicViewContent({
            resolveVersion: async (): Promise<string> => '1',
            buildExport: async (): Promise<ExportResult> => ({
                success: true,
                data: makeZip({ 'index.html': 'x' }),
            }),
        });

        expect(await getPublicViewFile(makeProject(), 'does-not-exist.html')).toBeNull();
    });

    it('returns null for path traversal without building', async () => {
        let built = 0;
        configurePublicViewContent({
            buildExport: async (): Promise<ExportResult> => {
                built++;
                return { success: true, data: makeZip({ 'index.html': 'x' }) };
            },
        });

        expect(await getPublicViewFile(makeProject(), '../../secret')).toBeNull();
        expect(built).toBe(0);
    });

    it('returns null when the export fails to build', async () => {
        configurePublicViewContent({
            resolveVersion: async (): Promise<string> => '1',
            buildExport: async (): Promise<ExportResult> => ({ success: false, error: 'boom' }),
        });

        expect(await getPublicViewFile(makeProject(), 'index.html')).toBeNull();
    });

    it('caches the unzipped export and rebuilds when the Yjs document version changes', async () => {
        // Regression: the cache must key on the persisted Yjs document version,
        // NOT on projects.updated_at. A Yjs edit bumps the document version but
        // never touches projects.updated_at, so keying on updated_at would serve
        // a stale public view after every edit.
        let built = 0;
        let docVersion = '1000';
        configurePublicViewContent({
            resolveVersion: async (): Promise<string> => docVersion,
            buildExport: async (): Promise<ExportResult> => {
                built++;
                return { success: true, data: makeZip({ 'index.html': 'v' + built }) };
            },
        });

        // updated_at is intentionally held constant across edits to prove the
        // cache no longer depends on it.
        const project = makeProject({ updated_at: 1000 });
        await getPublicViewFile(project, 'index.html');
        await getPublicViewFile(project, 'index.html');
        expect(built).toBe(1); // second call served from cache

        // Simulate a persisted Yjs edit: the document version advances while
        // updated_at stays the same.
        docVersion = '2000';
        const file = await getPublicViewFile(makeProject({ updated_at: 1000 }), 'index.html');
        expect(built).toBe(2); // document version changed → rebuilt (fresh bytes)
        expect(new TextDecoder().decode(file!.content)).toBe('v2');
    });

    it('serves stale-free bytes after a persisted edit even when updated_at is unchanged', async () => {
        // End-to-end of the staleness fix: an edit changes the served bytes.
        let docVersion = '100';
        let html = '<h1>original</h1>';
        configurePublicViewContent({
            resolveVersion: async (): Promise<string> => docVersion,
            buildExport: async (): Promise<ExportResult> => ({
                success: true,
                data: makeZip({ 'index.html': html }),
            }),
        });

        const before = await getPublicViewFile(makeProject({ updated_at: 555 }), 'index.html');
        expect(new TextDecoder().decode(before!.content)).toBe('<h1>original</h1>');

        // Persist an edit: content + document version change, updated_at does not.
        html = '<h1>edited</h1>';
        docVersion = '200';

        const after = await getPublicViewFile(makeProject({ updated_at: 555 }), 'index.html');
        expect(new TextDecoder().decode(after!.content)).toBe('<h1>edited</h1>');
    });

    it('coalesces concurrent builds for the same project into one', async () => {
        let built = 0;
        configurePublicViewContent({
            resolveVersion: async (): Promise<string> => '1',
            buildExport: async (): Promise<ExportResult> => {
                built++;
                // Defer so both callers reach the builder before it resolves.
                await new Promise(resolve => setTimeout(resolve, 10));
                return { success: true, data: makeZip({ 'index.html': 'x' }) };
            },
        });

        const project = makeProject();
        const [a, b] = await Promise.all([
            getPublicViewFile(project, 'index.html'),
            getPublicViewFile(project, 'index.html'),
        ]);

        expect(built).toBe(1); // single build shared by both concurrent callers
        expect(a).not.toBeNull();
        expect(b).not.toBeNull();
    });

    it('throws when the export exceeds the file-count limit', async () => {
        const tooMany: Record<string, string> = {};
        for (let i = 0; i < 5001; i++) {
            tooMany[`f${i}.txt`] = 'x';
        }
        configurePublicViewContent({
            resolveVersion: async (): Promise<string> => '1',
            buildExport: async (): Promise<ExportResult> => ({ success: true, data: makeZip(tooMany) }),
        });

        await expect(getPublicViewFile(makeProject(), 'index.html')).rejects.toThrow(/too large/);
    });

    it('resolves an unknown/extension-less file to application/octet-stream', async () => {
        configurePublicViewContent({
            resolveVersion: async (): Promise<string> => '1',
            buildExport: async (): Promise<ExportResult> => ({
                success: true,
                data: makeZip({
                    // No extension at all.
                    LICENSE: 'do-what-you-want',
                    // Unknown/binary-ish extension not in the MIME table.
                    'data.bin': 'binary',
                }),
            }),
        });

        const project = makeProject();
        expect((await getPublicViewFile(project, 'LICENSE'))!.contentType).toBe('application/octet-stream');
        expect((await getPublicViewFile(project, 'data.bin'))!.contentType).toBe('application/octet-stream');
    });
});
