import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { serveFilesDirFile } from './files-dir-response';

describe('serveFilesDirFile', () => {
    let filesDir: string;

    beforeAll(() => {
        filesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'files-dir-response-'));
        const resources = path.join(filesDir, 'tmp', 'session', 'content', 'resources');
        fs.mkdirSync(resources, { recursive: true });
        fs.writeFileSync(path.join(resources, 'page.html'), '<script>alert(1)</script>');
        fs.writeFileSync(path.join(resources, 'image.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
        fs.writeFileSync(path.join(resources, 'data.xml'), '<root/>');
        fs.writeFileSync(path.join(resources, 'photo.png'), 'png-bytes');
        fs.writeFileSync(path.join(resources, 'style.css'), 'body {}');
        fs.writeFileSync(path.join(resources, 'payload.unknown'), '<script>alert(1)</script>');
        fs.mkdirSync(path.join(filesDir, 'dist', 'session'), { recursive: true });
        fs.writeFileSync(path.join(filesDir, 'dist', 'session', 'export.zip'), 'zip-bytes');
    });

    afterAll(() => {
        fs.rmSync(filesDir, { recursive: true, force: true });
    });

    const serve = (file: string) => serveFilesDirFile(`/files/tmp/session/content/resources/${file}`, filesDir);

    it('serves a file under tmp with its MIME type and cache header', async () => {
        const res = serve('photo.png');

        expect(res?.status).toBe(200);
        expect(res?.headers.get('Content-Type')).toBe('image/png');
        expect(res?.headers.get('Content-Length')).toBe('9');
        expect(res?.headers.get('Cache-Control')).toBe('public, max-age=3600');
        expect(await res?.text()).toBe('png-bytes');
    });

    it('serves a file under dist', async () => {
        const res = serveFilesDirFile('/files/dist/session/export.zip', filesDir);

        expect(res?.headers.get('Content-Type')).toBe('application/zip');
        expect(await res?.text()).toBe('zip-bytes');
    });

    it('returns null for other paths, missing files and directories so the request falls through', () => {
        expect(serveFilesDirFile('/files/perm/idevices/x.js', filesDir)).toBeNull();
        expect(serve('missing.png')).toBeNull();
        expect(serveFilesDirFile('/files/tmp/session', filesDir)).toBeNull();
    });

    it('never resolves a path outside FILES_DIR', () => {
        fs.writeFileSync(path.join(path.dirname(filesDir), 'outside-files-dir.txt'), 'secret');
        try {
            expect(serveFilesDirFile('/files/tmp/../../outside-files-dir.txt', filesDir)).toBeNull();
        } finally {
            fs.rmSync(path.join(path.dirname(filesDir), 'outside-files-dir.txt'));
        }
    });

    it('serves documents that can run script in a sandboxed, opaque origin', () => {
        for (const file of ['page.html', 'image.svg', 'data.xml']) {
            const csp = serve(file)?.headers.get('Content-Security-Policy') ?? '';
            expect(csp.startsWith('sandbox ')).toBe(true);
            expect(csp).not.toContain('allow-same-origin');
        }
    });

    it('does not sandbox passive resources, so images, styles and downloads keep working', () => {
        for (const file of ['photo.png', 'style.css']) {
            expect(serve(file)?.headers.get('Content-Security-Policy')).toBeNull();
        }
        expect(
            serveFilesDirFile('/files/dist/session/export.zip', filesDir)?.headers.get('Content-Security-Policy'),
        ).toBeNull();
    });

    it('forbids MIME sniffing, so an unknown extension is never rendered as HTML', () => {
        const res = serve('payload.unknown');

        expect(res?.headers.get('Content-Type')).toBe('application/octet-stream');
        expect(res?.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(serve('photo.png')?.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });
});
