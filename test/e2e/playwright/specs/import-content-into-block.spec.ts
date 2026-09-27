import { test, expect } from '../fixtures/auth.fixture';
import * as fs from 'fs';
import * as path from 'path';
import {
    waitForAppReady,
    gotoWorkarea,
    selectPageByIndex,
    addTextIdevice,
    editTextIdevice,
    getFirstBlockAndIdeviceIds,
    importIdeviceIntoBlock,
} from '../helpers/workarea-helpers';

/**
 * E2E Tests for importing a .idevice into an EXISTING block ("Import content"
 * box menu item).
 *
 * The pre-existing flows (file manager modal / #local-ode-file-upload, tested in
 * component-export-import.spec.ts) always land an imported iDevice in a NEW
 * block appended to the page. This spec covers the new entry point: the block's
 * own actions menu, which appends the imported component(s) to the clicked
 * block in place.
 */

const FIXTURE_IDEVICE = path.join(process.cwd(), 'test/fixtures/idevice-mkg5tfoo-i0k5qzyvx.idevice');

test.describe('Import content into an existing block (.idevice)', () => {
    test.beforeAll(() => {
        if (!fs.existsSync(FIXTURE_IDEVICE)) {
            throw new Error(`Fixture file not found: ${FIXTURE_IDEVICE}`);
        }
    });

    test('the block actions menu offers "Import content"', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'Import Content Menu Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await selectPageByIndex(page, 0);

        await addTextIdevice(page);
        await editTextIdevice(page, `Menu test content ${Date.now()}`);

        const { blockId } = await getFirstBlockAndIdeviceIds(page);
        expect(blockId).toBeTruthy();

        // The menu item is rendered with the import icon inside the actions dropdown.
        const importItem = page.locator(`#dropdownBlockMore-button-import-idevice${blockId}`);
        await expect(importItem).toBeAttached();
        await expect(importItem.locator('.small-icon.import-icon-green')).toBeAttached();

        // No force here: this test asserts the item is genuinely visible to a
        // user in the current mode. If exe-advanced hides the dropdown, this
        // test fails on purpose; the other test forces the click to exercise
        // the handler regardless of visibility.
        await page.locator(`#dropdownMenuButton${blockId}`).click();
        await expect(importItem).toBeVisible({ timeout: 5000 });
    });

    test('should import a .idevice file into an existing block from its actions menu', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // 1. New project, first page, one text iDevice inside one block.
        const projectUuid = await createProject(page, 'Import Content Into Block Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await selectPageByIndex(page, 0);
        await page.waitForTimeout(500);

        await addTextIdevice(page);
        await editTextIdevice(page, `Initial block content ${Date.now()}`);

        const { blockId } = await getFirstBlockAndIdeviceIds(page);
        expect(blockId).toBeTruthy();

        // 2. Capture the pre-import state: blocks on the page and iDevices in the block.
        const block = page.locator(`#node-content article.box#${blockId}`);
        const blocksBefore = await page.locator('#node-content article.box').count();
        const idevicesBefore = await block.locator('.idevice_node').count();

        // 3. Import the fixture in place via the block actions menu.
        await importIdeviceIntoBlock(page, blockId, FIXTURE_IDEVICE);

        // 4. The imported component is appended to the SAME block (no new block).
        await page.waitForFunction(
            ({ id, before }) => {
                const target = document.getElementById(id);
                return !!target && target.querySelectorAll('.idevice_node').length === before + 1;
            },
            { id: blockId, before: idevicesBefore },
            { timeout: 15000 },
        );

        const blocksAfter = await page.locator('#node-content article.box').count();
        expect(blocksAfter).toBe(blocksBefore);

        // 5. The imported iDevice (a text iDevice in the fixture) renders inside the block.
        const importedIdevice = block.locator('.idevice_node.text').last();
        await expect(importedIdevice).toBeVisible({ timeout: 10000 });

        // 6. The fixture carries an image asset: it must be resolved (blob or
        // resolved asset URL) AND fully loaded, proving asset extraction and
        // rendering ran end-to-end for this flow. The function must only return
        // truthy once the image has actually painted (naturalWidth > 0), so the
        // waitForFunction does not resolve on a resolved-but-broken src.
        await page.waitForFunction(
            id => {
                const target = document.getElementById(id);
                if (!target) return false;
                const idevices = target.querySelectorAll('.idevice_node.text');
                const last = idevices[idevices.length - 1];
                if (!last) return false;
                const img = last.querySelector('img');
                if (!img) return false;
                const src = img.getAttribute('src');
                const dataAssetUrl = img.getAttribute('data-asset-url');
                const isResolved = src?.startsWith('blob:') || dataAssetUrl?.startsWith('asset://');
                return isResolved && img.complete && img.naturalWidth > 0;
            },
            blockId,
            { timeout: 15000 },
        );
    });
});
