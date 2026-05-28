/**
 * Regression test for PR #1775: site-theme screenshots 404 behind BASE_PATH.
 *
 * The admin panel emits screenshot URLs as `BASE_PATH + /site-files/themes/<dir>/screenshot.png`.
 * The request handler must strip BASE_PATH and serve the file from FILES_DIR/themes/site,
 * mirroring the real `onRequest` handler in src/index.ts. This builds a minimal app that
 * reuses the real `resolveSiteThemeFile` resolver to verify both BASE_PATH and root cases.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { serveSiteThemeFile } from '../../src/utils/site-theme-file';

const BASE_PATH = '/mybase';
let filesDir: string;
const THEME_DIR = 'my-style';
const SCREENSHOT_BYTES = Buffer.from('fake-png-bytes');

// Minimal app that mirrors src/index.ts onRequest: strip BASE_PATH, then resolve site theme files.
const createTestApp = () =>
    new Elysia().onRequest(({ request }) => {
        const url = new URL(request.url);
        let pathname = url.pathname;

        // Strip BASE_PATH prefix if present (mirrors src/index.ts).
        if (BASE_PATH && pathname.startsWith(BASE_PATH)) {
            pathname = pathname.slice(BASE_PATH.length) || '/';
        }

        const siteThemeResponse = serveSiteThemeFile(pathname, filesDir);
        if (siteThemeResponse) {
            return siteThemeResponse;
        }

        return new Response('Not Found', { status: 404 });
    });

describe('Site theme files behind BASE_PATH', () => {
    let app: ReturnType<typeof createTestApp>;

    beforeAll(() => {
        filesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exe-site-themes-'));
        const themePath = path.join(filesDir, 'themes', 'site', THEME_DIR);
        fs.mkdirSync(themePath, { recursive: true });
        fs.writeFileSync(path.join(themePath, 'screenshot.png'), SCREENSHOT_BYTES);
        app = createTestApp();
    });

    afterAll(() => {
        fs.rmSync(filesDir, { recursive: true, force: true });
    });

    it('serves the screenshot when requested behind BASE_PATH', async () => {
        const res = await app.handle(
            new Request(`http://localhost${BASE_PATH}/site-files/themes/${THEME_DIR}/screenshot.png`),
        );
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('image/png');
        expect(Buffer.from(await res.arrayBuffer())).toEqual(SCREENSHOT_BYTES);
    });

    it('serves the screenshot at the root path (BASE_PATH empty)', async () => {
        const res = await app.handle(new Request(`http://localhost/site-files/themes/${THEME_DIR}/screenshot.png`));
        expect(res.status).toBe(200);
        expect(Buffer.from(await res.arrayBuffer())).toEqual(SCREENSHOT_BYTES);
    });

    it('returns 404 for a missing theme file', async () => {
        const res = await app.handle(
            new Request(`http://localhost${BASE_PATH}/site-files/themes/${THEME_DIR}/missing.png`),
        );
        expect(res.status).toBe(404);
    });

    it('refuses path traversal outside themes/site', async () => {
        const res = await app.handle(new Request(`http://localhost${BASE_PATH}/site-files/themes/../../../etc/passwd`));
        expect(res.status).toBe(404);
    });
});
