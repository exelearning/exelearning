/**
 * E2E round-trip test for internal links (#1927).
 *
 * Builds a real project with an `exe-node:` internal link, downloads it as ELPX through the
 * browser export pipeline, and verifies:
 *   1. the re-editable content.xml inside the package keeps the `exe-node:` reference
 *      (not the static `html/...` export path), and
 *   2. re-importing the downloaded package restores the link as `exe-node:` in the document.
 *
 * Before the fix, content.xml persisted `html/about.html`, which the importer cannot map back
 * to a page — silently breaking internal links on every export → re-import round trip.
 */

import { test, expect } from '../fixtures/auth.fixture';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { unzipSync, strFromU8 } from 'fflate';
import {
    waitForAppReady,
    gotoWorkarea,
    addPage,
    selectNavNode,
    addTextIdeviceWithContent,
    downloadProject,
    openElpFile,
} from '../helpers/workarea-helpers';

async function getFirstPageId(page: import('@playwright/test').Page): Promise<string> {
    const id = await page.evaluate(() => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        const nav = bridge?.documentManager?.getNavigation?.();
        if (!nav) return null;
        for (let i = 0; i < nav.length; i++) {
            const p = nav.get(i);
            const pid = p.get('id') || p.get('pageId');
            if (pid && pid !== 'root') return pid;
        }
        return null;
    });
    if (!id) throw new Error('Could not find first page ID');
    return id;
}

test.describe('Internal link export → re-import round trip (#1927)', () => {
    test('content.xml keeps exe-node: links and they survive re-import', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Internal Link Round Trip');

        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);

        const page1Id = await getFirstPageId(page);
        const page2Id = await addPage(page, 'About');

        // On the first page, add a text iDevice that links to the second page.
        await selectNavNode(page, page1Id);
        await page.waitForTimeout(400);
        await addTextIdeviceWithContent(page, `<p>Go to <a href="exe-node:${page2Id}">About</a>.</p>`);

        // Download the project as ELPX through the real browser export pipeline.
        const download = await downloadProject(page);
        const tmpElpx = path.join(os.tmpdir(), `roundtrip-1927-${Date.now()}.elpx`);
        await download.saveAs(tmpElpx);

        // 1. The re-editable content.xml must keep the exe-node: reference, not a static path.
        const buffer = fs.readFileSync(tmpElpx);
        const entries = unzipSync(new Uint8Array(buffer));
        const contentXmlEntry = entries['content.xml'];
        expect(contentXmlEntry).toBeDefined();
        const contentXml = strFromU8(contentXmlEntry);
        expect(contentXml).toContain(`exe-node:${page2Id}`);
        expect(contentXml).not.toContain('href="html/');

        // 2. Re-import the downloaded package and confirm the link is still exe-node:.
        await openElpFile(page, tmpElpx, 1);
        await page.waitForTimeout(500);

        const importedHtml = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            if (!bridge) return '';
            const nav = bridge.documentManager.getNavigation();
            const parts: string[] = [];
            for (let i = 0; i < nav.length; i++) {
                const p = nav.get(i);
                const pid = p.get('id') || p.get('pageId');
                if (!pid) continue;
                const blocks = bridge.structureBinding.getBlocks(pid) || [];
                for (const block of blocks) {
                    const comps = bridge.structureBinding.getComponents(pid, block.id) || [];
                    for (const comp of comps) {
                        if (comp.htmlContent) parts.push(comp.htmlContent);
                    }
                }
            }
            return parts.join('\n');
        });

        expect(importedHtml).toContain('exe-node:');
        expect(importedHtml).not.toContain('href="html/');

        fs.rmSync(tmpElpx, { force: true });
    });
});
