import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveSiteThemeFile, serveSiteThemeFile } from './site-theme-file';

const FILES_DIR = '/data';
const SITE_DIR = path.join(FILES_DIR, 'themes', 'site');

describe('resolveSiteThemeFile', () => {
    it('resolves a plain /site-files/themes/* path (BASE_PATH already stripped)', () => {
        const result = resolveSiteThemeFile('/site-files/themes/my-style/screenshot.png', FILES_DIR);
        expect(result).toBe(path.join(SITE_DIR, 'my-style/screenshot.png'));
    });

    it('resolves a versioned /v{version}/site-files/themes/* path', () => {
        const result = resolveSiteThemeFile('/v3.0.0/site-files/themes/my-style/style.css', FILES_DIR);
        expect(result).toBe(path.join(SITE_DIR, 'my-style/style.css'));
    });

    it('resolves a versioned cache-busted /v{version}-{ts}/site-files/themes/* path', () => {
        const result = resolveSiteThemeFile(
            '/v3.0.0-1700000000000/site-files/themes/my-style/screenshot.png',
            FILES_DIR,
        );
        expect(result).toBe(path.join(SITE_DIR, 'my-style/screenshot.png'));
    });

    it('returns null for non-site-theme paths', () => {
        expect(resolveSiteThemeFile('/files/perm/themes/base/x/screenshot.png', FILES_DIR)).toBeNull();
        expect(resolveSiteThemeFile('/site-files/themes/', FILES_DIR)).toBeNull();
        expect(resolveSiteThemeFile('/', FILES_DIR)).toBeNull();
    });

    it('returns null for path traversal attempts', () => {
        expect(resolveSiteThemeFile('/site-files/themes/../../../etc/passwd', FILES_DIR)).toBeNull();
        expect(resolveSiteThemeFile('/v3.0.0/site-files/themes/../../secret.txt', FILES_DIR)).toBeNull();
    });
});

describe('serveSiteThemeFile', () => {
    let tmpDir: string;
    const bytes = Buffer.from('fake-png');

    beforeAll(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exe-serve-theme-'));
        fs.mkdirSync(path.join(tmpDir, 'themes', 'site', 'my-style'), { recursive: true });
        fs.writeFileSync(path.join(tmpDir, 'themes', 'site', 'my-style', 'screenshot.png'), bytes);
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('serves an existing file with the correct content type and cache header', async () => {
        const res = serveSiteThemeFile('/site-files/themes/my-style/screenshot.png', tmpDir);
        expect(res).not.toBeNull();
        expect(res!.headers.get('Content-Type')).toBe('image/png');
        expect(res!.headers.get('Cache-Control')).toBe('public, max-age=31536000');
        expect(Buffer.from(await res!.arrayBuffer())).toEqual(bytes);
    });

    it('serves the versioned URL shape too', () => {
        const res = serveSiteThemeFile('/v3.0.0-123/site-files/themes/my-style/screenshot.png', tmpDir);
        expect(res).not.toBeNull();
    });

    it('returns null for a missing file', () => {
        expect(serveSiteThemeFile('/site-files/themes/my-style/missing.png', tmpDir)).toBeNull();
    });

    it('returns null for a directory (not a file)', () => {
        expect(serveSiteThemeFile('/site-files/themes/my-style', tmpDir)).toBeNull();
    });

    it('returns null for non-site-theme paths and traversal', () => {
        expect(serveSiteThemeFile('/files/perm/themes/base/x.png', tmpDir)).toBeNull();
        expect(serveSiteThemeFile('/site-files/themes/../../../etc/passwd', tmpDir)).toBeNull();
    });
});
