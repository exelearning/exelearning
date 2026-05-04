import { expect, skipInStaticMode, test } from '../fixtures/auth.fixture';
import type { Download, Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { unzipSync } from '../../../../src/shared/export';
import { getTinyMCEContent, setTinyMCEContent } from '../helpers/editor-helpers';
import { addTextIdevice, editIdevice, gotoWorkarea, saveIdevice, waitForAppReady } from '../helpers/workarea-helpers';

async function exportPageScorm(page: Page, nodeId: string): Promise<Download> {
    const navElement = page.locator(`.nav-element[nav-id="${nodeId}"]`);
    await navElement.waitFor({ state: 'visible', timeout: 10000 });
    await navElement.hover();

    const dropdownTrigger = navElement.locator('.page-settings-trigger');
    await dropdownTrigger.waitFor({ state: 'visible', timeout: 5000 });
    await dropdownTrigger.click();

    const dropdownMenu = navElement.locator('.dropdown-menu.show');
    await dropdownMenu.waitFor({ state: 'visible', timeout: 5000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    await dropdownMenu.locator('.action_export_page_scorm').click();
    return downloadPromise;
}

async function exportIdeviceScorm(page: Page, ideviceId: string): Promise<Download> {
    const dropdownBtn = page.locator(`#dropdownMenuButtonIdevice${ideviceId}`);
    await dropdownBtn.waitFor({ state: 'visible', timeout: 10000 });
    await dropdownBtn.click();

    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    await page.locator(`#exportScormIdevice${ideviceId}`).click();
    return downloadPromise;
}

async function exportBoxScorm(page: Page, blockId: string): Promise<Download> {
    const dropdownBtn = page.locator(`#dropdownMenuButton${blockId}`);
    await dropdownBtn.waitFor({ state: 'visible', timeout: 10000 });
    await dropdownBtn.click();

    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    await page.locator(`#dropdownBlockMore-button-export-scorm${blockId}`).click();
    return downloadPromise;
}

function readZip(downloadPath: string): Record<string, Uint8Array> {
    return unzipSync(fs.readFileSync(downloadPath));
}

function readText(files: Record<string, Uint8Array>, name: string): string {
    return new TextDecoder().decode(files[name]);
}

function expectMinimalScormZip(files: Record<string, Uint8Array>, expectedContent: string): void {
    const paths = Object.keys(files);
    expect(paths).toContain('imsmanifest.xml');
    expect(paths).toContain('imslrm.xml');
    expect(paths).toContain('index.html');
    expect(paths).toContain('content/css/base.css');
    expect(paths).toContain('libs/jquery/jquery.min.js');
    expect(paths).toContain('libs/common.js');
    expect(paths).toContain('libs/common_i18n.js');
    expect(paths).toContain('libs/exe_export.js');
    expect(paths).toContain('libs/SCORM_API_wrapper.js');
    expect(paths).toContain('libs/SCOFunctions.js');
    expect(paths.some(file => file.startsWith('theme/'))).toBe(false);
    expect(paths.some(file => file.startsWith('html/'))).toBe(false);
    expect(paths).not.toContain('content.xml');
    expect(paths).not.toContain('content.dtd');

    const html = readText(files, 'index.html');
    expect(html).toContain(expectedContent);
    expect(html).toContain('libs/SCORM_API_wrapper.js');
    expect(html).not.toContain('theme/');
    expect(html).not.toContain('<nav id="siteNav"');

    const manifest = readText(files, 'imsmanifest.xml');
    expect((manifest.match(/<item /g) || []).length).toBe(1);
    expect(manifest).toContain('href="index.html"');
    expect(manifest).not.toContain('html/');
}

async function setTextIdeviceContent(page: Page, ideviceId: string, content: string): Promise<void> {
    const textIdevice = page.locator(`.idevice_node[id="${ideviceId}"]`).first();
    const isEditionMode = await textIdevice.evaluate(element => element.getAttribute('mode') === 'edition');

    if (!isEditionMode) {
        await editIdevice(page, ideviceId);
    }

    await setTinyMCEContent(page, `<p>${content}</p>`);
    await expect.poll(() => getTinyMCEContent(page)).toContain(content);
    await saveIdevice(page, ideviceId);
    await expect(textIdevice).toContainText(content);
}

async function getTextIdeviceId(page: Page): Promise<string> {
    const textIdevice = page.locator('#node-content article.box .idevice_node.text').first();
    await textIdevice.waitFor({ state: 'attached', timeout: 15000 });

    const ideviceId = await textIdevice.getAttribute('id');
    if (!ideviceId) {
        throw new Error('Text iDevice does not have an id attribute');
    }

    return ideviceId;
}

async function getFirstBoxId(page: Page): Promise<string> {
    const box = page.locator('#node-content article.box').first();
    await box.waitFor({ state: 'attached', timeout: 15000 });

    const blockId = await box.getAttribute('id');
    if (!blockId) {
        throw new Error('Box does not have an id attribute');
    }

    return blockId;
}

test.describe('Partial SCORM export', () => {
    let tempDir: string;

    test.beforeAll(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exelearning-scorm-partial-'));
    });

    test.afterAll(() => {
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('downloads minimal SCORM 1.2 ZIPs for one page, one box, and one iDevice', async ({
        authenticatedPage,
        createProject,
    }, testInfo) => {
        skipInStaticMode(test, testInfo, 'Requires server project creation');

        const page = authenticatedPage;
        const uniqueContent = `Partial SCORM content ${Date.now()}`;
        const projectUuid = await createProject(page, 'Partial SCORM Export');

        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await addTextIdevice(page);

        const nodeId = await page.evaluate(() => {
            const selected = document.querySelector('.nav-element.selected:not([nav-id="root"])');
            return selected?.getAttribute('nav-id') || null;
        });
        expect(nodeId).toBeTruthy();

        const ideviceId = await getTextIdeviceId(page);
        const blockId = await getFirstBoxId(page);
        await setTextIdeviceContent(page, ideviceId, uniqueContent);

        const pageDownload = await exportPageScorm(page, nodeId as string);
        expect(pageDownload.suggestedFilename()).toContain('_scorm12.zip');
        const pageZipPath = path.join(tempDir, pageDownload.suggestedFilename());
        await pageDownload.saveAs(pageZipPath);
        expectMinimalScormZip(readZip(pageZipPath), uniqueContent);

        const boxDownload = await exportBoxScorm(page, blockId);
        expect(boxDownload.suggestedFilename()).toContain('_scorm12.zip');
        const boxZipPath = path.join(tempDir, boxDownload.suggestedFilename());
        await boxDownload.saveAs(boxZipPath);
        expectMinimalScormZip(readZip(boxZipPath), uniqueContent);

        const ideviceDownload = await exportIdeviceScorm(page, ideviceId);
        expect(ideviceDownload.suggestedFilename()).toContain('_scorm12.zip');
        const ideviceZipPath = path.join(tempDir, ideviceDownload.suggestedFilename());
        await ideviceDownload.saveAs(ideviceZipPath);
        expectMinimalScormZip(readZip(ideviceZipPath), uniqueContent);
    });
});
