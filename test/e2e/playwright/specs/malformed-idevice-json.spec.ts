import { test, expect } from '../fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady } from '../helpers/workarea-helpers';

test.describe('Malformed iDevice JSON', () => {
    test('does not prevent later blocks from loading', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Malformed iDevice JSON');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const pageErrors: string[] = [];
        page.on('pageerror', error => pageErrors.push(error.message));
        const malformedJson = '{"questions":[{"question":"<audio src=\\""><a href=\\"">audio.webm</a></audio>"}]}';

        const pageId = await page.evaluate(jsonProperties => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            const navigation = bridge?.documentManager?.getNavigation();
            const firstPage = navigation?.get(0);
            const firstPageId = firstPage?.get('id');
            if (!firstPageId || !bridge?.structureBinding) {
                throw new Error('Yjs project structure is not available');
            }

            const brokenBlockId = bridge.structureBinding.createBlock(firstPageId, 'Broken activity');
            const laterBlockId = bridge.structureBinding.createBlock(firstPageId, 'Later content');

            bridge.structureBinding.createComponent(firstPageId, brokenBlockId, 'text', {
                id: 'idevice-malformed-json',
                htmlContent: '<p>Previously rendered activity</p>',
                jsonProperties,
            });
            bridge.structureBinding.createComponent(firstPageId, laterBlockId, 'text', {
                id: 'idevice-after-malformed-json',
                htmlContent: '<p>Content after malformed activity</p>',
                jsonProperties: '{}',
            });

            return firstPageId;
        }, malformedJson);

        await page.locator(`#menu_nav_content .nav-element[nav-id="${pageId}"]`).click();

        await expect(page.locator('.idevice_node#idevice-malformed-json')).toContainText(
            'Previously rendered activity',
        );
        await expect(page.locator('.idevice_node#idevice-after-malformed-json')).toContainText(
            'Content after malformed activity',
        );

        const storedBeforeEdit = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            return bridge?.structureBinding?.getComponent('idevice-malformed-json')?.jsonProperties;
        });
        expect(storedBeforeEdit).toBe(malformedJson);

        await page.locator('#editIdeviceidevice-malformed-json').click();

        await expect(page.locator('#modalAlert')).toContainText('cannot be edited because its saved data is damaged');
        await expect(page.locator('.idevice_node#idevice-malformed-json')).toHaveAttribute('mode', 'export');

        const storedAfterEdit = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            return bridge?.structureBinding?.getComponent('idevice-malformed-json')?.jsonProperties;
        });
        expect(storedAfterEdit).toBe(malformedJson);
        expect(pageErrors).toEqual([]);
    });
});
