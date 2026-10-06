import path from 'path';
import { expect, test } from '../fixtures/auth.fixture';
import { gotoWorkarea, openElpFile, waitForAppReady } from '../helpers/workarea-helpers';

/**
 * Regression coverage for #2177 and #2190.
 *
 * Both scenarios use a trueorfalse iDevice on purpose: it renders through its
 * export script, whose legacy migration branch reads questionsData off the
 * parsed jsonProperties. A text iDevice cannot cover this — it has no such
 * branch and renders its retained HTML whatever the properties hold.
 */
const FIXTURE = path.join(__dirname, '../../../fixtures/damaged-trueorfalse-json.elpx');
const FIXTURE_PAGE_ID = 'page-damaged-json-repro';

const MALFORMED_JSON = '{"questionsData":[{"baseText":"<audio src=\\""><a href=\\"">audio.webm</a></audio>"}]}';

// The damaged payload persisted verbatim inside the fixture (#2177 corruption
// shape: lost escape backslashes leave raw quotes inside a JSON string).
const FIXTURE_DAMAGED_JSON =
    '{"ideviceId":"idevice-damaged-malformed","typeGame":"TrueOrFalse","questionsData":[{"baseText":"<audio controls="controls" src=""><a href="">audio.webm</a></audio>","answer":"True"}]}';

const TRUEORFALSE_HTML = `<div class="exe-trueorfalse-container">
    <div class="TOFP-instructions"><p>Previously rendered activity</p></div>
    <div class="TOFP-MainContainer" id="tofPMainContainer-idevice-malformed-json"></div>
</div>`;

test.describe('Damaged iDevice JSON', () => {
    /**
     * Imports a project whose stored trueorfalse properties are damaged: one
     * block malformed, one empty, then a valid text block that must still load.
     * The import must preserve the damaged payload instead of replacing it
     * with {}, and must name the affected activity to the author (#2190).
     */
    test('damaged activities do not prevent later blocks from loading', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        const pageErrors: string[] = [];
        page.on('pageerror', error => pageErrors.push(error.message));

        await openElpFile(page, FIXTURE);
        await waitForAppReady(page);

        // The import warns about the damaged activity instead of only logging
        // to the console (#2190). The type name is language-independent.
        const alertModal = page.locator('#modalAlert');
        await expect(alertModal).toBeVisible({ timeout: 30000 });
        await expect(alertModal).toContainText('trueorfalse');
        await alertModal.locator('.modal-footer button.btn-secondary').click();
        await expect(page.locator('#modalAlert[data-open="true"]')).toHaveCount(0);

        // The damaged payload reaches the document byte for byte — this is the
        // data the importer used to discard by storing {} (#2190).
        const storedAfterImport = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            return bridge?.structureBinding?.getComponent('idevice-damaged-malformed')?.jsonProperties;
        });
        expect(storedAfterImport).toBe(FIXTURE_DAMAGED_JSON);

        // Selecting the page is what forces the components to be reconstructed.
        await page.locator(`#menu_nav_content .nav-element[nav-id="${FIXTURE_PAGE_ID}"]`).click();

        // Both damaged activities keep the HTML they were last rendered with...
        await expect(page.locator('.idevice_node#idevice-damaged-malformed')).toContainText(
            'Malformed jsonProperties: this rendered HTML must stay visible.',
        );
        await expect(page.locator('.idevice_node#idevice-damaged-empty')).toContainText(
            'Empty jsonProperties: this rendered HTML must stay visible.',
        );
        // ...and the block after them still loads, which is what #2177 reported broken.
        await expect(page.locator('.idevice_node#idevice-after-damaged')).toContainText(
            'This block comes after the damaged activities and must still load.',
        );

        // Catches the render-time TypeError raised by the legacy migration branch
        // when the properties carry no questionsData.
        expect(pageErrors).toEqual([]);
    });

    /**
     * A malformed payload can also reach a component without an import, the
     * way older builds left it in the document: written straight through the
     * structure binding, bypassing the write-boundary validation.
     */
    test('malformed properties are preserved and cannot be edited', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Malformed iDevice JSON');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const pageErrors: string[] = [];
        page.on('pageerror', error => pageErrors.push(error.message));

        const pageId = await page.evaluate(
            ({ jsonProperties, html }) => {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                const firstPageId = bridge?.documentManager?.getNavigation()?.get(0)?.get('id');
                if (!firstPageId || !bridge?.structureBinding) {
                    throw new Error('Yjs project structure is not available');
                }

                const binding = bridge.structureBinding;
                const brokenBlockId = binding.createBlock(firstPageId, 'Broken activity');
                const laterBlockId = binding.createBlock(firstPageId, 'Later content');

                binding.createComponent(firstPageId, brokenBlockId, 'trueorfalse', {
                    id: 'idevice-malformed-json',
                    htmlContent: html,
                    jsonProperties: '{}',
                });
                // Damage the stored payload the way it happens in the wild: a
                // raw compMap write (pre-existing damaged doc, importer path),
                // which bypasses the write-boundary validation on purpose.
                const compMap = binding.getComponentMap('idevice-malformed-json');
                binding.manager.getDoc().transact(() => {
                    compMap.set('jsonProperties', jsonProperties);
                });
                binding.createComponent(firstPageId, laterBlockId, 'text', {
                    id: 'idevice-after-malformed-json',
                    htmlContent: '<p>Content after malformed activity</p>',
                    jsonProperties: '{}',
                });

                return firstPageId;
            },
            { jsonProperties: MALFORMED_JSON, html: TRUEORFALSE_HTML },
        );

        await page.locator(`#menu_nav_content .nav-element[nav-id="${pageId}"]`).click();

        await expect(page.locator('.idevice_node#idevice-malformed-json')).toContainText(
            'Previously rendered activity',
        );
        await expect(page.locator('.idevice_node#idevice-after-malformed-json')).toContainText(
            'Content after malformed activity',
        );

        const readStored = () =>
            page.evaluate(() => {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                return bridge?.structureBinding?.getComponent('idevice-malformed-json')?.jsonProperties;
            });
        expect(await readStored()).toBe(MALFORMED_JSON);

        await page.locator('#editIdeviceidevice-malformed-json').click();

        await expect(page.locator('#modalAlert')).toContainText('cannot be edited because its saved data is damaged');
        await expect(page.locator('.idevice_node#idevice-malformed-json')).toHaveAttribute('mode', 'export');

        // The original payload must survive the blocked edit, not be overwritten.
        expect(await readStored()).toBe(MALFORMED_JSON);
        expect(pageErrors).toEqual([]);
    });
});
