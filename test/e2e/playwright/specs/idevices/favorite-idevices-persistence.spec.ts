import { test, expect, waitForLoadingScreenHidden } from '../../fixtures/auth.fixture';

test.describe('Favorite iDevices Persistence', () => {
    test('should persist selected favorite iDevices in user preferences', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // Pipe browser console logs to stdout for debugging
        page.on('console', msg => console.log(`[Browser Console] ${msg.text()}`));

        // 1. Create and open a project to ensure the UI is fully loaded for editing
        const projectUuid = await createProject(page, 'Favorite iDevices Test');
        await page.goto(`/workarea?project=${projectUuid}`);
        await page.waitForLoadState('networkidle');
        await waitForLoadingScreenHidden(page);

        // 2. Open "iDevice Manager" (Settings)
        const settingsBtn = page.locator('#setting-menuIdevices');

        // DEBUG: Check for edition mode which hides the bottom menu
        const nodeContent = page.locator('#node-content');
        await expect(nodeContent).toBeVisible();
        const mode = await nodeContent.getAttribute('mode');
        console.log(`[Test Debug] #node-content mode: '${mode}'`);

        // If in edition mode, we might need to verify that first
        if (mode === 'edition') {
            console.log('[Test Debug] In edition mode. Attempting to accept/cancel to exit...');
            // Try to find a save/done button if exists, or simple log for now so we know
        }

        // DEBUG: Inspect #idevices-bottom
        const bottomMenu = page.locator('#idevices-bottom');
        const bottomContent = await bottomMenu.innerHTML();
        console.log(`[Test Debug] #idevices-bottom innerHTML length: ${bottomContent.length}`);
        console.log(`[Test Debug] #idevices-bottom innerHTML: ${bottomContent.substring(0, 200)}...`);

        const isVisible = await bottomMenu.isVisible();
        console.log(`[Test Debug] #idevices-bottom isVisible: ${isVisible}`);

        await bottomMenu.evaluate(el => {
            const style = window.getComputedStyle(el);
            console.log(
                `[Browser Debug] #idevices-bottom Computed Style - Display: ${style.display}, Visibility: ${style.visibility}, Opacity: ${style.opacity}, Z-Index: ${style.zIndex}, Position: ${style.position}, Bottom: ${style.bottom}`,
            );
            console.log(`[Browser Debug] #idevices-bottom Classes: ${el.className}`);
            console.log(`[Browser Debug] #idevices-bottom Rect: ${JSON.stringify(el.getBoundingClientRect())}`);
        });

        await expect(settingsBtn).toBeVisible({ timeout: 10000 });
        await settingsBtn.click();

        // Wait for modal
        const modal = page.locator('#modalIdeviceManager');
        await expect(modal).toBeVisible();

        // 3. Toggle specific iDevice
        // "Activity" (activity)
        const activityCheckbox = modal.locator('tr[idevice-id="activity"] input[type="checkbox"]');
        await expect(activityCheckbox).toBeVisible();

        const wasChecked = await activityCheckbox.isChecked();

        // Click to toggle and trigger save
        const saveResponsePromise = page.waitForResponse(
            response =>
                response.url().includes('/api/user/preferences') &&
                response.status() === 200 &&
                response.request().method() === 'PUT',
        );

        await activityCheckbox.click();
        await saveResponsePromise;

        // Close modal
        await modal.locator('button.close, button:has-text("Close"), button:has-text("Cerrar")').first().click();
        await expect(modal).toBeHidden();

        // 4. Reload the application (simulate fresh session)
        // We reload the same URL with project UUID so we stay in the project
        await page.reload();
        await page.waitForLoadState('networkidle');
        await waitForLoadingScreenHidden(page);

        // 5. Verify persistence
        // Open modal again to check checkbox state
        await expect(settingsBtn).toBeVisible();
        await settingsBtn.click();
        await expect(modal).toBeVisible();

        const isCheckedNow = await activityCheckbox.isChecked();
        expect(isCheckedNow).toBe(!wasChecked); // Should be opposite of what it was initially

        // 6. Verify Bottom Menu Update (optional but good)
        // If we checked it (wasChecked=false -> true), it should be in the bottom menu
        if (!wasChecked) {
            const bottomIcon = page.locator(`#idevices-bottom .idevice_item[id="activity"]`);
            await expect(bottomIcon).toBeVisible();
        } else {
            // If we unchecked it, it should NOT be in the bottom menu
            const bottomIcon = page.locator(`#idevices-bottom .idevice_item[id="activity"]`);
            await expect(bottomIcon).toBeHidden();
        }

        // Toggle back to clean up
        await activityCheckbox.click();
        await page.waitForResponse(response => response.url().includes('/api/user/preferences'));
    });
});
