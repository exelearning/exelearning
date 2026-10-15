/**
 * prettyPhoto (exe_lightbox) must show author-controlled link attributes as text (#2471).
 *
 * The shipped jQuery and exe_lightbox files are served on a dedicated origin with
 * page.route(), so the payloads run in a real browser exactly as in an export.
 * Every other request is aborted, which keeps YouTube and friends out of the test.
 */
import * as fs from 'fs';
import * as path from 'path';

import { expect, type Page, test } from '@playwright/test';

const ORIGIN = 'http://exe-lightbox-harness.test';
const ROOT = path.resolve(__dirname, '../../../../public');
const FILES: Record<string, [string, string]> = {
    '/jquery.min.js': ['libs/jquery/jquery.min.js', 'application/javascript'],
    '/exe_lightbox.js': ['app/common/exe_lightbox/exe_lightbox.js', 'application/javascript'],
    '/exe_lightbox.css': ['app/common/exe_lightbox/exe_lightbox.css', 'text/css'],
    '/photo.png': ['app/common/exe_lightbox/exe_lightbox_default_thumb.png', 'image/png'],
};

async function openHarness(page: Page, links: string) {
    const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/exe_lightbox.css">
<script src="/jquery.min.js"></script><script src="/exe_lightbox.js"></script></head>
<body>${links}<div id="dialog" style="display:none"><p>Inline dialog</p></div>
<script>window.__pwned = false; jQuery("a[rel^='lightbox']").prettyPhoto({ social_tools: '', deeplinking: false });</script>
</body></html>`;
    await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== ORIGIN) return route.abort();
        if (url.pathname === '/index.html') return route.fulfill({ contentType: 'text/html', body: html });
        // Unknown paths get the image too, so prettyPhoto keeps the box open instead of closing on error.
        const file = FILES[url.pathname] ?? FILES['/photo.png'];
        return route.fulfill({ contentType: file[1], body: fs.readFileSync(path.join(ROOT, file[0])) });
    });
    await page.goto(`${ORIGIN}/index.html#prettyPhoto/0/`);
}

test.describe('exe_lightbox injection hardening (#2471)', () => {
    test('shows URL-encoded markup in titles as text', async ({ page }) => {
        const payload = '%3Cimg src=x onerror=window.__pwned=true%3E';
        await openHarness(
            page,
            `<a id="l" href="/photo.png" rel="lightbox" title="${payload}"><img src="/photo.png" alt="${payload}"></a>`,
        );
        await page.click('#l');

        await expect(page.locator('#fullResImage')).toBeVisible();
        await expect(page.locator('.ppt')).toHaveText(payload);
        await expect(page.locator('.pp_description')).toHaveText(payload);
        await expect(page.locator('.ppt img, .pp_description img')).toHaveCount(0);
        expect(await page.evaluate(() => (window as any).__pwned)).toBe(false);
    });

    test('keeps a quote in the href inside the image src', async ({ page }) => {
        await openHarness(page, '<a id="l" rel="lightbox">x</a>');
        const href = '/nope.png" onerror="window.__pwned=true';
        await page.evaluate(h => document.getElementById('l')!.setAttribute('href', h), href);
        await page.click('#l');

        await expect(page.locator('#fullResImage')).toHaveAttribute('src', href);
        await page.waitForTimeout(300);
        expect(await page.evaluate(() => (window as any).__pwned)).toBe(false);
    });

    test('does not fetch ajax=true links nor follow the hash with deeplinking off', async ({ page }) => {
        const xhr: string[] = [];
        page.on('request', r => {
            if (['xhr', 'fetch'].includes(r.resourceType())) xhr.push(r.url());
        });
        await openHarness(page, '<a id="l" href="/evil.html?ajax=true" rel="lightbox">x</a>');
        await page.waitForTimeout(200);
        await expect(page.locator('.pp_pic_holder')).toHaveCount(0);

        await page.click('#l');
        await expect(page.locator('#fullResImage')).toHaveAttribute('src', '/evil.html?ajax=true');
        await expect(page.locator('.pp_inline')).toHaveCount(0);
        expect(xhr).toEqual([]);
        expect(await page.evaluate(() => (window as any).__pwned)).toBe(false);
    });

    test('still opens images, inline dialogs and iframe popups', async ({ page }) => {
        await openHarness(
            page,
            '<a id="img" href="/photo.png" rel="lightbox" title="A &amp; B"><img src="/photo.png" alt="Photo"></a>' +
                '<a id="inl" href="#dialog" rel="lightbox">d</a>' +
                '<a id="ifr" href="/page.html?a=1&amp;iframe=true&amp;width=400&amp;height=300" rel="lightbox">f</a>',
        );

        await page.click('#img');
        await expect(page.locator('#fullResImage')).toHaveAttribute('src', '/photo.png');
        await expect(page.locator('.pp_description')).toHaveText('A & B');
        await page.click('a.pp_close');
        await expect(page.locator('.pp_pic_holder')).toHaveCount(0);

        await page.click('#inl');
        await expect(page.locator('#pp_full_res .pp_inline p')).toHaveText('Inline dialog');
        await page.click('a.pp_close');
        await expect(page.locator('.pp_pic_holder')).toHaveCount(0);

        await page.click('#ifr');
        await expect(page.locator('#pp_full_res iframe')).toHaveAttribute('src', '/page.html?a=1');
    });
});
