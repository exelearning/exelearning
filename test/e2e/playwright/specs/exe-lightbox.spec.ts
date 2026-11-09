import { test, expect } from '../fixtures/auth.fixture';
import type { BrowserContext, FrameLocator, Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { deflateSync } from 'zlib';
import { unzipSync } from '../../../../src/shared/export';
import {
    addTextIdevice,
    exportProjectAs,
    getPreviewFrame,
    gotoWorkarea,
    waitForAppReady,
    waitForPreviewContent,
} from '../helpers/workarea-helpers';

/**
 * The content lightbox (public/app/common/exe_lightbox): stock Tobii from npm
 * plus the eXe adapter, for the `rel="lightbox"` links of saved content.
 *
 * Pins every link convention prettyPhoto used to serve, in the preview, in an
 * offline Web Site export and in a SCORM 1.2 package shown inside a frame:
 * images and `lightbox[name]` galleries, `modalwindow` dialogs (`#id`),
 * YouTube (`t=`/`start=`), Vimeo, Mediateca, `?iframe=true`, the audio/video
 * boxes with their download link, the text-only caption and the
 * "New window" button for images inside a SCORM/IMS frame.
 */

const IMAGE =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGM4Y2xMEmIY1TCqYfhqAABHizIQlvhFxwAAAABJRU5ErkJggg==';

/** A solid-colour PNG of the given size. */
function solidPng(width: number, height: number): Buffer {
    const crcTable = Array.from({ length: 256 }, (_, n) => {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        return c >>> 0;
    });
    const crc32 = (buf: Buffer) => {
        let c = 0xffffffff;
        for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
    };
    const chunk = (type: string, data: Buffer) => {
        const length = Buffer.alloc(4);
        length.writeUInt32BE(data.length);
        const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(crc32(body));
        return Buffer.concat([length, body, crc]);
    };
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
    const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x60)]);
    const png = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', header),
        chunk('IDAT', deflateSync(Buffer.concat(Array(height).fill(row)))),
        chunk('IEND', Buffer.alloc(0)),
    ]);
    return png;
}

/**
 * Larger than any test viewport, so it is shown resized. It is a file written into
 * the extracted export (like a project resource): browsers refuse to open data: URLs
 * in a new window.
 */
const LARGE_IMAGE_FILE = 'e2e-large.png';

const CONTENT = `
<p><a id="e2e-lb-image" rel="lightbox" href="${IMAGE}" title="Red square"><img src="${IMAGE}" alt="Red square" width="16" height="16"></a></p>
<p><a id="e2e-lb-g1" rel="lightbox[e2e]" href="${IMAGE}" title="First">One</a> <a id="e2e-lb-g2" rel="lightbox[e2e]" href="${IMAGE}" title="Second">Two</a></p>
<p><a id="e2e-lb-large" rel="lightbox" href="${LARGE_IMAGE_FILE}">Large</a></p>
<p><a id="e2e-lb-xss" rel="lightbox" href="${IMAGE}" title="%3Cimg src=x onerror=window.__exeLightboxXss=1%3E">Unsafe title</a></p>
<p><a id="e2e-lb-dialog" class="exe-dialog-link" rel="lightbox" href="#e2e-dialog-body">Open dialog</a></p>
<div id="e2e-dialog-body" class="exe-dialog-text js-hidden"><p>Inline dialog body</p></div>
<p><a id="e2e-lb-youtube-t" rel="lightbox" href="https://www.youtube.com/watch?v=aqz-KE-bpKQ&amp;t=1m30s">YouTube t=</a></p>
<p><a id="e2e-lb-youtube-start" rel="lightbox" href="https://youtu.be/aqz-KE-bpKQ?start=42">YouTube start=</a></p>
<p><a id="e2e-lb-vimeo" rel="lightbox" href="https://vimeo.com/76979871">Vimeo</a></p>
<p><a id="e2e-lb-mediateca" rel="lightbox" href="https://mediateca.educa.madrid.org/video/e2etest">Mediateca</a></p>
<p><a id="e2e-lb-iframe" rel="lightbox" href="https://example.org/page.html?iframe=true&amp;width=600&amp;height=400">Page</a></p>
<p><a id="e2e-lb-audio" rel="lightbox" href="https://example.org/media/song.mp3" title="My song">Audio</a></p>
<p><a id="e2e-lb-video" rel="lightbox" href="https://example.org/media/clip.mp4">Video</a></p>
`;

type Scope = Pick<Page, 'locator' | 'keyboard'> | (Pick<FrameLocator, 'locator'> & { keyboard: Page['keyboard'] });

/** Serve an empty page for every external host, so iframes and media load offline. */
async function stubExternalHosts(context: BrowserContext): Promise<void> {
    await context.route(
        /^https:\/\/(www\.youtube\.com|player\.vimeo\.com|mediateca\.educa\.madrid\.org|example\.org)\//,
        route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>stub</title>' }),
    );
}

/** Add a Text iDevice whose main editor (not the feedback one) holds CONTENT. */
async function addTextWithLightboxLinks(page: Page): Promise<void> {
    await addTextIdevice(page);
    await page.waitForFunction(() => (window as any).tinymce?.get('textTextarea')?.initialized === true, undefined, {
        timeout: 15000,
    });
    await page.evaluate(html => (window as any).tinymce.get('textTextarea').setContent(html), CONTENT);
    const block = page.locator('#node-content article .idevice_node.text').last();
    await block.locator('.btn-save-idevice').click();
    await page.waitForFunction(
        () => document.querySelector('#node-content article .idevice_node.text')?.getAttribute('mode') !== 'edition',
        undefined,
        { timeout: 20000 },
    );
    await expect(block.locator('#e2e-lb-dialog')).toBeAttached();
}

const OPEN = '.tobii[aria-hidden="false"]';
/** Every group keeps its slides in the dialog; only the open group's slider is shown. */
const CURRENT = `${OPEN} .tobii__slider[aria-hidden="false"]`;

async function close(scope: Scope): Promise<void> {
    await scope.keyboard.press('Escape');
    await expect(scope.locator(OPEN)).toHaveCount(0, { timeout: 5000 });
}

/** The current slide: Tobii shows one slider (group) and positions its slides side by side. */
function currentIframe(scope: Scope) {
    return scope.locator(`${CURRENT} iframe`);
}

async function checkImagesAndDialog(scope: Scope): Promise<void> {
    // Single image, with the link title as caption
    await scope.locator('#e2e-lb-image').click();
    const open = scope.locator(OPEN);
    await expect(scope.locator(`${CURRENT} figure img`)).toHaveAttribute('src', IMAGE, {
        timeout: 5000,
    });
    await expect(scope.locator(`${CURRENT} figcaption`)).toHaveText('Red square');
    await close(scope);

    // lightbox[name] gallery: two slides, navigable
    await scope.locator('#e2e-lb-g1').click();
    await expect(open.locator('.tobii__counter')).toHaveText('1/2', { timeout: 5000 });
    await open.locator('.tobii__btn--next').click();
    await expect(open.locator('.tobii__counter')).toHaveText('2/2');
    await close(scope);

    // modalwindow inline dialog: a copy opens, the original stays hidden in the page
    await scope.locator('#e2e-lb-dialog').click();
    await expect(scope.locator(`${CURRENT} .exe-lightbox-inline`)).toContainText('Inline dialog body', {
        timeout: 5000,
    });
    await close(scope);
    await expect(scope.locator('#e2e-dialog-body')).toBeHidden();
}

test.describe('Content lightbox (exe_lightbox on Tobii)', () => {
    test('opens every link type in the preview', async ({ authenticatedPage, createProject }) => {
        // Editor, preview and fourteen link types in one project: slower than one default timeout.
        test.slow();
        const page = authenticatedPage;
        await stubExternalHosts(page.context());
        const projectUuid = await createProject(page, 'exe_lightbox preview');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await addTextWithLightboxLinks(page);

        // The editor's own view of the iDevice (workarea.njk loads Tobii too). Its sanitizer
        // drops the data: hrefs of the image links; the dialog link keeps working.
        await expect.poll(() => page.evaluate(() => !!document.querySelector('.tobii')), { timeout: 15000 }).toBe(true);
        await page.locator('#node-content #e2e-lb-dialog').click();
        await expect(page.locator(`${CURRENT} .exe-lightbox-inline`)).toContainText('Inline dialog body', {
            timeout: 5000,
        });
        await close(page);

        expect(await waitForPreviewContent(page)).toBe(true);
        const frame = getPreviewFrame(page);
        await frame.locator('#e2e-lb-dialog').waitFor({ state: 'attached', timeout: 15000 });
        await page.waitForFunction(
            () => {
                const iframe = document.querySelector('#preview-iframe') as HTMLIFrameElement | null;
                const w = iframe?.contentWindow as any;
                return !!w?.exeLightbox && !!w?.Tobii && !!w?.document.querySelector('.tobii');
            },
            undefined,
            { timeout: 15000 },
        );
        const previewWindow = () =>
            page.evaluate(() => {
                const w = (document.querySelector('#preview-iframe') as HTMLIFrameElement).contentWindow as any;
                return { prettyPhoto: typeof w.jQuery?.fn?.prettyPhoto, xss: w.__exeLightboxXss };
            });
        expect((await previewWindow()).prettyPhoto).toBe('undefined');

        const scope = Object.assign(frame, { keyboard: page.keyboard }) as unknown as Scope;
        await checkImagesAndDialog(scope);

        // The caption is text: markup in the title (even URL-encoded) is shown, not run.
        await frame.locator('#e2e-lb-xss').click();
        await expect(frame.locator(`${CURRENT} figcaption`)).toHaveText(
            '<img src=x onerror=window.__exeLightboxXss=1>',
            { timeout: 5000 },
        );
        await expect(frame.locator(`${OPEN} figcaption img`)).toHaveCount(0);
        expect((await previewWindow()).xss).toBeUndefined();
        await close(scope);

        const iframeCases: Array<[string, string]> = [
            ['#e2e-lb-youtube-t', 'https://www.youtube.com/embed/aqz-KE-bpKQ?rel=1&autoplay=1&start=90'],
            ['#e2e-lb-youtube-start', 'https://www.youtube.com/embed/aqz-KE-bpKQ?rel=1&autoplay=1&start=42'],
            ['#e2e-lb-vimeo', 'https://player.vimeo.com/video/76979871?title=0&byline=0&portrait=0&autoplay=1'],
            ['#e2e-lb-mediateca', 'https://mediateca.educa.madrid.org/video/e2etest/fs'],
            ['#e2e-lb-iframe', 'https://example.org/page.html'],
        ];
        for (const [link, src] of iframeCases) {
            await frame.locator(link).click();
            await expect(currentIframe(scope)).toHaveAttribute('src', src, { timeout: 5000 });
            await close(scope);
        }
        await frame.locator('#e2e-lb-iframe').click();
        await expect(currentIframe(scope)).toHaveCSS('max-width', '600px', { timeout: 5000 });
        await close(scope);

        // Audio and video boxes, with the title and a download link
        await frame.locator('#e2e-lb-audio').click();
        const audioBox = frame.locator(`${CURRENT} .exe-lightbox-inline.with-audio`);
        await expect(audioBox.locator('audio')).toHaveAttribute('src', 'https://example.org/media/song.mp3', {
            timeout: 5000,
        });
        await expect(audioBox.locator('.exe-lightbox-caption')).toHaveText('My song');
        await expect(audioBox.locator('.exe-media-download a[download]')).toHaveText('mp3');
        await close(scope);

        await frame.locator('#e2e-lb-video').click();
        const videoBox = frame.locator(`${CURRENT} .exe-lightbox-inline`);
        await expect(videoBox.locator('video source')).toHaveAttribute('src', 'https://example.org/media/clip.mp4', {
            timeout: 5000,
        });
        await expect(videoBox.locator('.exe-media-download a[download]')).toHaveText('mp4');
        await close(scope);
    });

    test('ships Tobii in the Web Site export and works offline from file://', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'exe_lightbox export');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await addTextWithLightboxLinks(page);

        const dir = await exportAndExtract(page, 'html5');
        const files = listFiles(dir);
        for (const file of ['tobii.min.js', 'tobii.min.css', 'exe_lightbox.js', 'exe_lightbox.css']) {
            expect(files.some(f => f.endsWith(`libs/exe_lightbox/${file}`))).toBe(true);
        }
        // The image-gallery iDevice's SimpleLightbox is not needed here.
        expect(files.some(f => f.includes('simple-lightbox'))).toBe(false);

        const exported = await page.context().newPage();
        const external: string[] = [];
        await exported.route(/^(?!(file|data):)/, route => {
            external.push(route.request().url());
            return route.abort();
        });
        await exported.goto(pathToFileURL(path.join(dir, 'index.html')).href);
        await exported.waitForFunction(() => !!document.querySelector('.tobii'), undefined, { timeout: 15000 });
        expect(await exported.evaluate(() => typeof (window as any).jQuery?.fn?.prettyPhoto)).toBe('undefined');

        await checkImagesAndDialog(exported);
        // Outside a SCORM/IMS frame a resized image offers "Full size".
        await exported.locator('#e2e-lb-large').click();
        await expect(exported.locator(`${OPEN} .exe-lightbox-full-size`)).toBeVisible({ timeout: 5000 });
        await close(exported);

        // Nothing but the content's own (fake, external) media: the hidden players that
        // $exe.setMultimediaGalleries creates load their file, as they did with prettyPhoto.
        expect(external.filter(url => !url.startsWith('https://example.org/media/'))).toEqual([]);
        await exported.close();
    });

    test('offers "New window" for a resized image inside a SCORM 1.2 frame', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'exe_lightbox scorm');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await addTextWithLightboxLinks(page);

        const dir = await exportAndExtract(page, 'scorm12');
        expect(listFiles(dir).some(f => f.endsWith('libs/exe_lightbox/tobii.min.js'))).toBe(true);
        // A frame, as in an LMS player.
        const wrapper = path.join(dir, 'e2e-lms.html');
        fs.writeFileSync(
            wrapper,
            '<!doctype html><title>LMS</title><iframe id="sco" src="index.html" width="320" height="240"></iframe>',
        );

        const lms = await page.context().newPage();
        await lms.goto(pathToFileURL(wrapper).href);
        const sco = lms.frameLocator('#sco');
        await sco.locator('#e2e-lb-large').waitFor({ state: 'attached', timeout: 15000 });
        await expect(sco.locator('body')).toHaveClass(/exe-scorm/);
        await expect
            .poll(() => lms.frame({ url: /index\.html$/ })?.evaluate(() => !!document.querySelector('.tobii')), {
                timeout: 15000,
            })
            .toBe(true);

        await sco.locator('#e2e-lb-large').click();
        const button = sco.locator(`${OPEN} .exe-lightbox-full-size`);
        await expect(button).toBeVisible({ timeout: 5000 });
        const expected = await lms.frame({ url: /index\.html$/ })!.evaluate(() => (window as any).$exe_i18n?.newWindow);
        if (expected) await expect(button).toHaveText(expected);

        const popupPromise = lms.waitForEvent('popup');
        await button.click();
        const popup = await popupPromise;
        expect(popup.url()).toBe(pathToFileURL(path.join(dir, LARGE_IMAGE_FILE)).href);
        await popup.close();
        // The lightbox stays open behind the new window.
        await expect(sco.locator(OPEN)).toHaveCount(1);
        await lms.close();
    });
});

async function exportAndExtract(page: Page, format: 'html5' | 'scorm12'): Promise<string> {
    const download = await exportProjectAs(page, format);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `exe-lightbox-${format}-`));
    const zipPath = path.join(dir, 'package.zip');
    await download.saveAs(zipPath);
    const entries = unzipSync(fs.readFileSync(zipPath));
    const out = path.join(dir, 'out');
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, LARGE_IMAGE_FILE), solidPng(2400, 1600));
    for (const [name, data] of Object.entries(entries)) {
        if (name.endsWith('/')) continue;
        const target = path.join(out, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, data);
    }
    return out;
}

function listFiles(dir: string): string[] {
    return fs
        .readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'));
}
