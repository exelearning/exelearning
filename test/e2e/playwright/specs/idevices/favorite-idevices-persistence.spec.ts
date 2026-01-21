import { test, expect, waitForLoadingScreenHidden } from '../../fixtures/auth.fixture';

test.describe('Favorite iDevices Persistence', () => {
    test('should persist selected favorite iDevices in user preferences', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // 1. Create and open a project to ensure the UI is fully loaded for editing
        const projectUuid = await createProject(page, 'Favorite iDevices Test');
        await page.goto(`/workarea?project=${projectUuid}`);
        await page.waitForLoadState('networkidle');
        await waitForLoadingScreenHidden(page);

        // 2. Open "iDevice Manager" (Settings)
        const settingsBtn = page.locator('#setting-menuIdevices');

        await expect(settingsBtn).toBeVisible({ timeout: 10000 });
        await settingsBtn.click();

        // Wait for modal
        const modal = page.locator('#modalIdeviceManager');
        await expect(modal).toBeVisible();

        // 3. Toggle specific iDevice
        // 3. Toggle specific iDevice
        // "Text" (text)
        const targetRow = modal.locator('div[idevice-id="text"]');
        const targetInput = targetRow.locator('input[type="checkbox"]');
        const targetVisual = targetRow.locator('.toggle-visual');

        // Check visual element is visible (since input is hidden)
        await expect(targetVisual).toBeVisible();

        const wasChecked = await targetInput.isChecked();

        // Click to toggle and trigger save
        const saveResponsePromise = page.waitForResponse(
            response =>
                response.url().includes('/api/user/preferences') &&
                response.status() === 200 &&
                response.request().method() === 'PUT',
        );

        await targetVisual.click();
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

        const isCheckedNow = await targetInput.isChecked();
        expect(isCheckedNow).toBe(!wasChecked); // Should be opposite of what it was initially

        // 6. Verify Bottom Menu Update (optional but good)
        // If we checked it (wasChecked=false -> true), it should be in the bottom menu
        if (!wasChecked) {
            const bottomIcon = page.locator(`#idevices-bottom .idevice_item[id="text"]`);
            await expect(bottomIcon).toBeVisible();
        } else {
            // If we unchecked it, it should NOT be in the bottom menu
            const bottomIcon = page.locator(`#idevices-bottom .idevice_item[id="text"]`);
            await expect(bottomIcon).toBeHidden();
        }

        // Toggle back to clean up
        await targetVisual.click();
        await page.waitForResponse(response => response.url().includes('/api/user/preferences'));
    });
});
