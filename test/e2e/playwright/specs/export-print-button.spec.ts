import { unzipSync } from 'fflate';
import { encryptDataGame } from '../../../../src/shared/export/utils/dataGameCipher';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';
import {
    gotoWorkarea,
    waitForAppReady,
    openPreviewPanel,
    getPreviewFrame,
    closePreviewPanel,
} from '../helpers/workarea-helpers';

/**
 * End-to-end verification of configurable print button in exported resources.
 *
 * Checks that:
 * 1. By default (addPrintButton = false), exports do NOT include print.html or the #exe-print-btn button.
 * 2. When addPrintButton = true, website exports bundle print.html at root and render #exe-print-btn in HTML.
 * 3. Single page exports render #exe-print-btn when addPrintButton = true.
 */

async function exportPackage(page: Page, format: string, addPrintButton: boolean): Promise<Record<string, Uint8Array>> {
    const zipBase64 = await page.evaluate(
        async ({ format, addPrintButton }) => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            const exporters = (window as any).SharedExporters;
            if (!bridge?.documentManager || !exporters?.quickExport) {
                throw new Error('Browser export dependencies are not available');
            }
            bridge.documentManager.getMetadata().set('addPrintButton', addPrintButton);

            const exported = await exporters.quickExport(
                format,
                bridge.documentManager,
                bridge.assetCache || null,
                bridge.resourceFetcher || null,
                {},
                bridge.assetManager || null,
            );
            if (!exported.success || !exported.data) {
                throw new Error(exported.error || `${format} export failed`);
            }
            const bytes = new Uint8Array(exported.data);
            let binary = '';
            const CHUNK = 0x8000;
            for (let i = 0; i < bytes.length; i += CHUNK) {
                binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
            }
            return btoa(binary);
        },
        { format, addPrintButton },
    );
    return unzipSync(new Uint8Array(Buffer.from(zipBase64, 'base64')));
}

test.describe('Export print button project property (addPrintButton)', () => {
    test('controls print button and print.html generation in exported website and single page', async ({
        authenticatedPage,
        createProject,
    }) => {
        test.setTimeout(180_000);
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Print button test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await page.locator('#head-top-settings-button').click();
        await page.locator('#props-tab-export').click();
        const printRow = page.locator('.property-row[property="pp_addPrintButton"]');
        const checkbox = await printRow.locator('input[type="checkbox"]').boundingBox();
        const info = await printRow.locator('.form-help-exe-icon').boundingBox();
        expect(checkbox).not.toBeNull();
        expect(info).not.toBeNull();
        expect(info!.x).toBeGreaterThan(checkbox!.x + checkbox!.width);
        expect(Math.abs(info!.y + info!.height / 2 - checkbox!.y - checkbox!.height / 2)).toBeLessThan(5);

        // 1. Default: addPrintButton = false
        const defaultWebsite = await exportPackage(page, 'html5', false);
        expect(
            Object.keys(defaultWebsite),
            'website with addPrintButton=false should not have print.html',
        ).not.toContain('print.html');
        const defaultIndexHtml = new TextDecoder().decode(defaultWebsite['index.html']);
        expect(defaultIndexHtml).not.toContain('id="exe-print-btn"');

        // 2. Enabled: addPrintButton = true on website
        const printWebsite = await exportPackage(page, 'html5', true);
        expect(Object.keys(printWebsite), 'website with addPrintButton=true should have print.html').toContain(
            'print.html',
        );
        const printIndexHtml = new TextDecoder().decode(printWebsite['index.html']);
        expect(printIndexHtml).toContain('id="exe-print-btn"');

        const printHtmlContent = new TextDecoder().decode(printWebsite['print.html']);
        expect(printHtmlContent).toContain('id="printPreviewMount"');
        expect(printHtmlContent).toContain('libs/exe_print/runtime.js');

        // 3. Enabled: addPrintButton = true on single-page export
        const singlePageZip = await exportPackage(page, 'page', true);
        const singlePageIndexHtml = new TextDecoder().decode(singlePageZip['index.html']);
        expect(singlePageIndexHtml).toContain('id="exe-print-btn"');
        expect(singlePageIndexHtml).toContain('exe-single-page');

        for (const enabled of [false, true]) {
            const elpx = await exportPackage(page, 'elpx', enabled);
            expect(Boolean(elpx['print.html'])).toBe(enabled);
            expect(Boolean(elpx['libs/exe_print/runtime.js'])).toBe(enabled);
            expect(new TextDecoder().decode(elpx['index.html']).includes('id="exe-print-btn"')).toBe(enabled);
        }
    });

    for (const format of ['scorm12', 'scorm2004', 'ims']) {
        test(
            format + ' includes the complete print preview in its manifest',
            async ({ authenticatedPage: page, createProject }) => {
                test.setTimeout(180_000);
                const uuid = await createProject(page, 'Printed ' + format);
                await gotoWorkarea(page, uuid);
                await waitForAppReady(page);
                const files = await exportPackage(page, format, true);
                const manifest = new TextDecoder().decode(files['imsmanifest.xml']);
                for (const file of [
                    'print.html',
                    'libs/exe_print/data.js',
                    'libs/exe_print/runtime.js',
                    'libs/exe_print/frame.js',
                    'libs/exe_print/preview.css',
                ]) {
                    expect(files[file], file).toBeDefined();
                    expect(manifest).toContain(file);
                }
                const payload = new TextDecoder().decode(files['libs/exe_print/data.js']);
                expect(payload).not.toContain('scormType');
            },
        );
    }

    test('recovers from stalled print preparation after timeout, closing and reopening', async ({
        authenticatedPage: page,
        createProject,
        browser,
    }) => {
        test.setTimeout(120_000);
        const uuid = await createProject(page, 'Print preparation recovery');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            bridge.documentManager.getMetadata().set('language', 'en');
            const binding = bridge.structureBinding;
            const node = binding.createPage('Formula');
            const block = binding.createBlock(node.id, 'Formula');
            binding.createComponent(node.id, block, 'text', { htmlContent: '<p>\\(x^2+1\\)</p>' });
        });
        const files = await exportPackage(page, 'html5', true);
        const context = await browser.newContext();
        const exported = await context.newPage();
        let hold = true;
        const held: Array<() => void> = [];
        const missing: string[] = [];
        await context.route('https://print-recovery.test/**', async route => {
            const name = decodeURIComponent(new URL(route.request().url()).pathname.slice('/course/'.length));
            if (!files[name]) {
                missing.push(name);
                await route.fulfill({ status: 404 });
                return;
            }
            if (hold && name === 'libs/exe_math/tex-mml-svg.js') await new Promise<void>(resolve => held.push(resolve));
            const types: Record<string, string> = {
                '.html': 'text/html',
                '.js': 'text/javascript',
                '.css': 'text/css',
                '.svg': 'image/svg+xml',
                '.woff2': 'font/woff2',
            };
            await route
                .fulfill({
                    body: Buffer.from(files[name]),
                    contentType: types[path.extname(name)] || 'application/octet-stream',
                })
                .catch(() => {});
        });
        try {
            await exported.clock.install();
            await exported.goto('https://print-recovery.test/course/print.html', { waitUntil: 'domcontentloaded' });
            await expect.poll(() => held.length).toBe(1);
            await exported.clock.fastForward(25001);
            await expect(exported.locator('.print-preview-error')).toContainText(
                'Print resources did not finish loading',
            );
            await expect(exported.locator('.print-preview-print-btn')).toBeDisabled();
            await exported.locator('.print-preview-close-btn').click();
            await exported.locator('#printPreviewLaunch').click();
            await expect.poll(() => held.length).toBe(2);
            await exported.locator('.print-preview-close-btn').click();
            await expect
                .poll(() =>
                    exported.evaluate(() => (window as any).ExePrintPreview.controller.generationPromise === null),
                )
                .toBe(true);
            await exported.locator('#printPreviewLaunch').click();
            await expect.poll(() => held.length).toBe(3);
            hold = false;
            for (const release of held.splice(0)) release();
            await expect(exported.locator('.print-preview-print-btn')).toBeEnabled({ timeout: 30_000 });
            await expect(exported.frameLocator('.print-preview-iframe').locator('.exe-math-rendered svg')).toHaveCount(
                1,
            );
            expect(missing).toEqual([]);
        } finally {
            hold = false;
            for (const release of held.splice(0)) release();
            await context.close();
        }
    });

    test('keeps one notice while the preview cannot load and clears it once it opens', async ({
        authenticatedPage: page,
        createProject,
        browser,
    }) => {
        const uuid = await createProject(page, 'Print notice');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            bridge.documentManager.getMetadata().set('language', 'en');
            const binding = bridge.structureBinding;
            const node = binding.createPage('Notice');
            const block = binding.createBlock(node.id, 'Notice');
            binding.createComponent(node.id, block, 'text', { htmlContent: '<p>Printable text</p>' });
        });
        const files = await exportPackage(page, 'html5', true);
        const context = await browser.newContext();
        const exported = await context.newPage();
        let unavailable = true;
        await context.route('https://print-notice.test/**', async route => {
            const name = decodeURIComponent(new URL(route.request().url()).pathname.slice('/course/'.length));
            if (!files[name] || (unavailable && name === 'libs/exe_print/data.js')) {
                await route.fulfill({ status: 404 });
                return;
            }
            const types: Record<string, string> = {
                '.html': 'text/html',
                '.js': 'text/javascript',
                '.css': 'text/css',
            };
            await route.fulfill({
                body: Buffer.from(files[name]),
                contentType: types[path.extname(name)] || 'application/octet-stream',
            });
        });
        try {
            await exported.goto('https://print-notice.test/course/index.html');
            const button = exported.locator('#exe-print-btn');
            const notice = exported.getByRole('alert').filter({ hasText: 'Print preview not available' });
            // The click disables the button until the attempt ends, so count once it is enabled again.
            for (let attempt = 0; attempt < 3; attempt++) {
                await button.click();
                await expect(button).toBeEnabled();
                await expect(notice).toHaveCount(1);
            }
            // Nor does a failed attempt leave its stylesheet behind for the next one to repeat.
            const stylesheet = exported.locator('head link[href$="libs/exe_print/preview.css"]');
            await expect(stylesheet).toHaveCount(0);

            unavailable = false;
            await button.click();
            await expect(exported.locator('.print-preview-close-btn')).toBeVisible();
            await expect(notice).toHaveCount(0);
            await expect(stylesheet).toHaveCount(1);
        } finally {
            await context.close();
        }
    });

    test('uses the editor options in a nested web path and offline from print.html', async ({
        authenticatedPage: page,
        createProject,
        browser,
    }) => {
        test.setTimeout(180_000);
        const uuid = await createProject(page, 'Portable print preview');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await page.evaluate(
            async guess => {
                const bridge = (window as any).eXeLearning.app.project._yjsBridge;
                const binding = bridge.structureBinding;
                const picture = new Blob(
                    [
                        '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="orange"/></svg>',
                    ],
                    { type: 'image/svg+xml' },
                );
                await bridge.assetManager.putAsset({
                    id: 'bd270ba8-8fc1-4137-97b3-4a10432a42bd',
                    filename: 'rabbit photo.svg',
                    mime: picture.type,
                    size: picture.size,
                    blob: picture,
                });
                bridge.documentManager.getMetadata().set('language', 'en');
                const parent = binding.createPage('Printable page');
                const text = binding.createBlock(parent.id, 'Reading');
                binding.createComponent(parent.id, text, 'text', {
                    htmlContent:
                        '<p>Ordinary reading <a href="https://example.org/lesson">lesson</a> \\(\\mathbb{R}+x^2+1\\)</p>',
                });
                const folded = binding.createBlock(parent.id, 'Folded box');
                binding.updateBlock(folded, { properties: { minimized: true, allowToggle: true } });
                binding.createComponent(parent.id, folded, 'text', { htmlContent: '<p>Folded paragraph</p>' });
                const teacher = binding.createBlock(parent.id, 'Teacher box');
                binding.updateBlock(teacher, { properties: { teacherOnly: true } });
                binding.createComponent(parent.id, teacher, 'text', { htmlContent: '<p>Teacher explanation</p>' });
                const hidden = binding.createBlock(parent.id, 'Excluded box');
                binding.updateBlock(hidden, { properties: { visibility: false } });
                binding.createComponent(parent.id, hidden, 'text', {
                    htmlContent: '<p>Never publish in print data</p>',
                });
                binding.createComponent(parent.id, binding.createBlock(parent.id, 'Riddle'), 'guess', {
                    htmlContent: guess,
                });
            },
            '<div class="adivina-IDevice"><div class="adivina-DataGame js-hidden">' +
                encryptDataGame(
                    JSON.stringify({
                        wordsGame: [{ word: 'sun', definition: 'A star', type: 1, alt: 'Rabbit' }],
                        percentajeQuestions: 100,
                    }),
                ) +
                '</div><a class="adivina-LinkImages" href="asset://bd270ba8-8fc1-4137-97b3-4a10432a42bd">0</a></div>',
        );
        const files = await exportPackage(page, 'html5', true);
        expect(new TextDecoder().decode(files['libs/exe_print/data.js'])).not.toContain('Never publish in print data');

        // Exercise the same export-backed UI inside the editor's normal preview panel.
        const previewErrors: string[] = [];
        page.on('pageerror', error => previewErrors.push(error.message));
        page.on('console', message => {
            if (message.type() === 'error' && message.text().includes('MathJax')) previewErrors.push(message.text());
        });
        await openPreviewPanel(page);
        const resourcePreview = getPreviewFrame(page);
        await expect(resourcePreview.locator('#exe-print-btn')).toHaveAttribute('data-print-bound', 'true', {
            timeout: 60_000,
        });
        await expect(resourcePreview.locator('#exe-print-btn svg')).toBeVisible();
        await expect(resourcePreview.locator('#exe-print-btn')).toHaveAttribute('title', 'Print');
        const buttonPosition = await resourcePreview.locator('#exe-print-btn').evaluate(button => {
            const box = button.getBoundingClientRect();
            return { top: box.top, right: innerWidth - box.right, width: box.width, height: box.height };
        });
        expect(buttonPosition.top).toBeCloseTo(10, 0);
        expect(buttonPosition.right).toBeCloseTo(15, 0);
        expect(buttonPosition.width).toBe(40);
        expect(buttonPosition.height).toBe(40);
        await resourcePreview.locator('#exe-print-btn').click();
        await expect(resourcePreview.locator('.print-preview-print-btn')).toBeEnabled({ timeout: 60_000 });
        const nestedPrint = resourcePreview.frameLocator('.print-preview-iframe');
        await expect(nestedPrint.locator('body')).toContainText('A star');
        await expect(nestedPrint.locator('.exe-math-rendered svg')).toHaveCount(1);
        await resourcePreview.locator('input[name="print-activity-mode"][value="idevices"]').check();
        await expect(nestedPrint.locator('.worksheet')).toContainText('A star');
        await expect(nestedPrint.locator('body')).not.toContainText('Ordinary reading');
        await expect
            .poll(() =>
                nestedPrint
                    .locator('img[alt="Rabbit"]')
                    .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
            )
            .toBe(true);
        await expect(resourcePreview.locator('.print-preview-print-btn')).toBeEnabled();
        await resourcePreview.locator('.print-preview-close-btn').click();
        await expect(resourcePreview.locator('#exe-print-btn')).toBeFocused();
        await closePreviewPanel(page);

        // Embedded hosts can disable Service Workers. The blob fallback must keep printing available.
        await page.evaluate(() => {
            (window as any).eXeLearning.app.getPreviewServiceWorker = () => null;
        });
        await openPreviewPanel(page);
        await expect(page.locator('#preview-iframe')).toHaveAttribute('src', /^blob:/, { timeout: 30_000 });
        await expect(resourcePreview.locator('#exe-print-btn')).toHaveAttribute('data-print-bound', 'true');
        await resourcePreview.locator('#exe-print-btn').click();
        await expect(resourcePreview.locator('.print-preview-print-btn')).toBeEnabled({ timeout: 60_000 });
        await expect(nestedPrint.locator('body')).toContainText('A star');
        await resourcePreview.locator('input[name="print-activity-mode"][value="idevices"]').check();
        await expect(nestedPrint.locator('.worksheet')).toContainText('A star');
        await expect(nestedPrint.locator('body')).not.toContainText('Ordinary reading');
        await expect
            .poll(() =>
                nestedPrint
                    .locator('img[alt="Rabbit"]')
                    .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
            )
            .toBe(true);
        await resourcePreview.locator('.print-preview-close-btn').click();
        await closePreviewPanel(page);
        expect(previewErrors).toEqual([]);

        const context = await browser.newContext();
        const exported = await context.newPage();
        const missing: string[] = [];
        let imageMode: 'hold' | 'fail' | 'pass' = 'hold';
        const heldImages: Array<() => void> = [];
        const releaseImages = () => {
            imageMode = 'pass';
            for (const release of heldImages.splice(0)) release();
        };
        await context.route('https://export.example.test/**', async route => {
            const name = decodeURIComponent(new URL(route.request().url()).pathname.replace('/html/course/', ''));
            const body = files[name];
            if (!body) {
                missing.push(name);
                await route.fulfill({ status: 404 });
                return;
            }
            const ext = path.extname(name);
            if (name.endsWith('/rabbit photo.svg') && route.request().frame().parentFrame()) {
                if (imageMode === 'fail') {
                    await route.fulfill({ status: 503 });
                    return;
                }
                if (imageMode === 'hold') await new Promise<void>(resolve => heldImages.push(resolve));
            }
            const types: Record<string, string> = {
                '.html': 'text/html',
                '.js': 'text/javascript',
                '.css': 'text/css',
                '.svg': 'image/svg+xml',
                '.woff2': 'font/woff2',
                '.json': 'application/json',
            };
            await route.fulfill({
                body: Buffer.from(body),
                contentType: types[ext] || 'application/octet-stream',
                headers: { 'Access-Control-Allow-Origin': '*' },
            });
        });
        const folder = await mkdtemp(path.join(tmpdir(), 'exe-print-preview-'));
        try {
            // Start from a subpage under a hosting path that itself contains /html/.
            const subpage = Object.keys(files).find(name => /^html\/.*\.html$/.test(name))!;
            await exported.goto('https://export.example.test/html/course/' + subpage);
            await expect(exported.locator('#exe-print-btn')).toHaveAttribute('data-print-bound', 'true');
            await exported.clock.install();
            await exported.locator('#exe-print-btn').click();
            const overlay = exported.locator('#printPreviewOverlay');
            const frame = exported.frameLocator('.print-preview-iframe');
            await expect.poll(() => heldImages.length).toBeGreaterThan(0);
            await expect.poll(() => frame.locator('html').evaluate(() => document.readyState)).toBe('interactive');
            await exported.clock.fastForward(3500);
            await expect(overlay.locator('.print-preview-print-btn')).toBeDisabled();
            expect(await frame.locator('img[alt="Rabbit"]').evaluate((img: HTMLImageElement) => img.complete)).toBe(
                false,
            );
            releaseImages();
            await expect(overlay.locator('.print-preview-print-btn')).toBeEnabled({ timeout: 60_000 });
            await expect(frame.locator('body')).toContainText('Ordinary reading');
            await expect(frame.locator('body')).toContainText('A star');
            await expect(frame.getByText('Teacher explanation', { exact: true })).not.toBeVisible();
            await expect(exported.locator('#printOptLinkUrls')).toBeChecked();
            const linkSuffix = () =>
                frame.locator('a[href="https://example.org/lesson"]').evaluate(link => {
                    // Firefox preserves attr(href) in computed content; Chromium resolves it.
                    return getComputedStyle(link, '::after').content.replace(
                        /attr\(href\)/g,
                        JSON.stringify(link.getAttribute('href')),
                    );
                });
            // Option changes replace the iframe document; retry evaluations across navigation.
            await expect(async () => {
                expect(await linkSuffix()).toContain('https://example.org/lesson');
            }).toPass({ timeout: 7000 });
            await exported.locator('#printOptLinkUrls').uncheck();
            await expect(async () => {
                expect(await linkSuffix()).toBe('none');
            }).toPass({ timeout: 7000 });
            await expect(exported.locator('#printOptUnfoldBlocks')).not.toBeChecked();
            await expect(frame.locator('html')).toHaveClass(/exe-print-as-shown/);
            await exported.locator('#printOptUnfoldBlocks').check();
            await expect(frame.locator('html')).not.toHaveClass(/exe-print-as-shown/);
            await exported.locator('#printOptTeacherOnly').check();
            await expect(frame.getByText('Teacher explanation', { exact: true })).toBeVisible();
            for (const mode of ['appendix', 'idevices', 'omit', 'in-place']) {
                await exported.locator('input[name="print-activity-mode"][value="' + mode + '"]').check();
                if (mode === 'idevices') {
                    await expect(frame.locator('.worksheet')).toContainText('A star');
                    await expect(frame.locator('body')).not.toContainText('Ordinary reading');
                    await expect
                        .poll(() =>
                            frame
                                .locator('img[alt="Rabbit"]')
                                .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
                        )
                        .toBe(true);
                } else if (mode === 'omit') {
                    await expect(frame.locator('body')).toContainText('Ordinary reading');
                    await expect(frame.locator('body')).not.toContainText('A star');
                } else if (mode === 'appendix') {
                    await expect(frame.locator('#section-worksheet-appendix')).toContainText('A star');
                } else {
                    await expect(frame.locator('.worksheet-activity')).toContainText('A star');
                    await expect(frame.locator('#section-worksheet-appendix')).toHaveCount(0);
                }
                await expect(overlay.locator('.print-preview-print-btn')).toBeEnabled({ timeout: 30_000 });
            }
            await overlay.locator('.print-preview-close-btn').click();
            await expect(exported.locator('#exe-print-btn')).toBeFocused();
            expect(missing).toEqual([]);

            // An image that fails is left out and the rest still prints.
            const skippedNotice = overlay.locator('[data-notice="images-skipped"]');
            imageMode = 'fail';
            await exported.locator('#exe-print-btn').click();
            await expect(overlay.locator('.print-preview-print-btn')).toBeEnabled({ timeout: 30_000 });
            await expect(skippedNotice).toBeVisible();
            await expect(skippedNotice).toHaveText('Some images could not be loaded and are left out of the printout.');
            await expect(overlay.locator('.print-preview-error')).toHaveCount(0);
            await expect(frame.locator('body')).toContainText('A star');
            await expect(frame.locator('img[alt="Rabbit"]')).toBeHidden();
            await overlay.locator('.print-preview-close-btn').click();

            // An image that never answers keeps the document itself from finishing loading, and
            // printing before its scripts run is not safe: that one still stops the printout.
            imageMode = 'hold';
            await exported.locator('#exe-print-btn').click();
            await expect.poll(() => heldImages.length).toBeGreaterThan(0);
            await expect.poll(() => frame.locator('html').evaluate(() => document.readyState)).toBe('interactive');
            await exported.clock.fastForward(25001);
            // The package has no icon font: the icon is drawn, never its name written out.
            const errorBox = overlay.locator('.print-preview-error');
            await expect(errorBox).toHaveText('Print resources did not finish loading. Please try again.');
            const errorIcon = errorBox.locator('svg.print-preview-error-icon');
            await expect(errorIcon).toBeVisible();
            expect(await errorIcon.boundingBox()).toMatchObject({ width: 48, height: 48 });
            await expect(overlay.locator('.print-preview-print-btn')).toBeDisabled();
            await overlay.locator('.print-preview-close-btn').click();
            releaseImages();

            // Closing a loading frame must not let its eventual response enable a newer preview.
            imageMode = 'hold';
            await exported.locator('#exe-print-btn').click();
            await expect.poll(() => heldImages.length).toBeGreaterThan(0);
            await overlay.locator('.print-preview-close-btn').click();
            releaseImages();
            await exported.locator('#exe-print-btn').click();
            await expect(overlay.locator('.print-preview-print-btn')).toBeEnabled({ timeout: 30_000 });
            await expect(overlay.locator('.print-preview-error')).toHaveCount(0);
            await expect(skippedNotice).toBeHidden();
            await overlay.locator('.print-preview-close-btn').click();

            for (const [name, bytes] of Object.entries(files)) {
                const target = path.resolve(folder, name);
                if (!target.startsWith(folder + path.sep)) throw new Error('Unexpected export path');
                await mkdir(path.dirname(target), { recursive: true });
                await writeFile(target, bytes);
            }
            // Open the course's HTML directly, with all networking disabled.
            await context.setOffline(true);
            await exported.goto(pathToFileURL(path.join(folder, 'index.html')).href);
            await expect(exported.locator('#exe-print-btn svg')).toBeVisible();
            await exported.locator('#exe-print-btn').click();
            await expect(overlay.locator('.print-preview-print-btn')).toBeEnabled({ timeout: 60_000 });
            await exported.locator('input[name="print-activity-mode"][value="idevices"]').check();
            await expect(frame.locator('.worksheet')).toContainText('A star');
            await expect
                .poll(() =>
                    frame
                        .locator('img[alt="Rabbit"]')
                        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
                )
                .toBe(true);
            await exported.screenshot({ path: test.info().outputPath('offline-activities.png') });
            for (const mode of ['appendix', 'omit', 'in-place']) {
                await exported.locator('input[name="print-activity-mode"][value="' + mode + '"]').check();
                await expect(frame.locator('body')).toContainText('Ordinary reading');
                await expect(frame.locator('img[alt="Rabbit"]')).toHaveCount(mode === 'omit' ? 0 : 1);
                await expect(overlay.locator('.print-preview-print-btn')).toBeEnabled({ timeout: 30_000 });
            }
            await exported.goto(pathToFileURL(path.join(folder, 'print.html')).href);
            await expect(overlay.locator('.print-preview-print-btn')).toBeEnabled({ timeout: 60_000 });
            await expect(frame.locator('body')).toContainText('A star');
            await expect(exported.locator('#printOptionsPanel')).toBeVisible();
            await overlay.locator('.print-preview-close-btn').click();
            await expect(exported.locator('#printPreviewLaunch')).toBeFocused();
            await exported.locator('#printPreviewLaunch').click();
            await expect(overlay.locator('.print-preview-print-btn')).toBeEnabled({ timeout: 30_000 });
        } finally {
            releaseImages();
            await context.close();
            // This directory was created by mkdtemp above and never comes from package paths.
            if (
                path.dirname(folder) === path.resolve(tmpdir()) &&
                path.basename(folder).startsWith('exe-print-preview-')
            ) {
                await rm(folder, { recursive: true, force: true });
            }
        }
    });
});
