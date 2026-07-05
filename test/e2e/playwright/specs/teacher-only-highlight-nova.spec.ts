import { test, expect, skipInStaticMode } from '../fixtures/auth.fixture';
import { waitForAppReady, gotoWorkarea, changeTheme, addTextIdeviceWithContent } from '../helpers/workarea-helpers';

/**
 * Teacher-only iDevice highlight in the Nova theme (issue #1931).
 *
 * The Flux/Neo themes wrap teacher-only iDevices in a yellow (#FC0) border so
 * authors can spot restricted content at a glance. Nova was missing this cue.
 * This test verifies that, with the Nova theme active, enabling "Only visible in
 * teacher mode" renders the yellow highlight in the editor.
 */
test.describe('Teacher-only highlight (Nova theme)', () => {
    test('shows the yellow border on a teacher-only iDevice in the editor', async ({
        authenticatedPage,
        createProject,
    }, testInfo) => {
        skipInStaticMode(test, testInfo, 'Requires server to create projects and add iDevices');

        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'Teacher Highlight Nova');
        expect(projectUuid).toBeDefined();

        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // Use the Nova theme for the whole flow.
        await changeTheme(page, 'nova');

        // Add a text iDevice (added in edit mode, then saved -> view mode).
        await addTextIdeviceWithContent(page, '<p>Restricted teacher material</p>');

        const node = page.locator('#node-content article .idevice_node.text').first();
        await node.waitFor({ state: 'visible', timeout: 15000 });

        // Control: a regular iDevice must not have the yellow highlight.
        const initialBorder = await node.evaluate(el => getComputedStyle(el).borderTopColor);
        expect(initialBorder).not.toBe('rgb(255, 204, 0)');

        // Open the iDevice actions dropdown and the properties modal.
        await node.locator('button[id^="dropdownMenuButtonIdevice"]').click();
        await node.locator('button[id^="propertiesIdevice"]').first().click();

        const modal = page.locator('#modalProperties');
        await modal.waitFor({ state: 'visible', timeout: 10000 });

        // Enable "Only visible in teacher mode".
        const teacherToggle = modal.locator('#teacherOnly input.toggle-input');
        await teacherToggle.waitFor({ state: 'attached', timeout: 5000 });
        await teacherToggle.check();
        await expect(teacherToggle).toBeChecked();

        // Save the properties.
        await modal.locator('button.btn.btn-primary').first().click();
        await modal.waitFor({ state: 'hidden', timeout: 10000 });

        // The editor highlight class is applied to the iDevice node...
        const highlighted = page.locator('#node-content .idevice_node.text.exe-teacher-highlight').first();
        await highlighted.waitFor({ state: 'visible', timeout: 10000 });

        // ...and the Nova theme renders it with the yellow (#FC0) 3px border.
        const borderColor = await highlighted.evaluate(el => getComputedStyle(el).borderTopColor);
        const borderWidth = await highlighted.evaluate(el => getComputedStyle(el).borderTopWidth);
        expect(borderColor).toBe('rgb(255, 204, 0)');
        expect(borderWidth).toBe('3px');
    });
});
