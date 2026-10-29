import { test, expect } from '@playwright/test';

/**
 * Automatic project cleanup is configured from /admin > Project cleanup (#2671).
 * The spec keeps CLEANUP_ENABLED off: enabling it would run a real cleanup on the
 * shared E2E server and delete the drafts other specs are working with.
 */
test.describe('Admin project cleanup settings', () => {
    test('shows the cleanup settings and the eligible-project count, and saves them', async ({ page }, testInfo) => {
        if (testInfo.project.name.includes('static')) {
            test.skip(true, 'The admin panel requires server routes');
        }

        const loginResponse = await page.request.post('/api/auth/login', {
            data: { email: 'admin@exelearning.test', password: 'AdminPass123!' },
        });
        expect(loginResponse.ok()).toBeTruthy();

        await page.goto('/admin');
        await page.waitForLoadState('domcontentloaded');

        const previewLoaded = page.waitForResponse(res => res.url().includes('/api/admin/cleanup/preview'));
        await page.locator('.admin-nav-link[data-section="cleanup"]').click();

        const section = page.locator('#cleanup');
        await expect(section).toBeVisible();
        await expect(page.locator('#sectionTitle')).toHaveText('Project cleanup');

        // Enabling is destructive, so the panel says so before anything is saved
        await expect(section.getByText('Deletion is permanent', { exact: false })).toBeVisible();

        await expect(section.locator('#cleanupEnabledToggle')).not.toBeChecked();
        await expect(previewLoaded).resolves.toBeTruthy();
        await expect(section.locator('#cleanupPreviewResult')).toContainText('Total:');

        // Retention values are saved; the feature itself stays disabled
        await section.locator('#cleanupIntervalInput').fill('12');
        await section.locator('#cleanupUnsavedInput').fill('48');
        await section.locator('#cleanupGuestInput').fill('14');

        const saved = page.waitForResponse(
            res => res.url().includes('/api/admin/settings') && res.request().method() === 'PUT',
        );
        await section.locator('#cleanupSaveBtn').click();
        const response = await saved;
        expect(response.ok()).toBeTruthy();
        expect(response.request().postDataJSON()).toEqual({
            settings: [
                { key: 'CLEANUP_ENABLED', value: 'false', type: 'boolean' },
                { key: 'CLEANUP_INTERVAL_HOURS', value: '12', type: 'number' },
                { key: 'CLEANUP_UNSAVED_AGE_HOURS', value: '48', type: 'number' },
                { key: 'CLEANUP_GUEST_AGE_DAYS', value: '14', type: 'number' },
            ],
        });
        await expect(section.locator('#cleanupSaveStatus')).toHaveText('Saved');

        // The stored values take precedence over the environment after a reload
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        await page.locator('.admin-nav-link[data-section="cleanup"]').click();
        await expect(page.locator('#cleanupIntervalInput')).toHaveValue('12');
        await expect(page.locator('#cleanupUnsavedInput')).toHaveValue('48');
        await expect(page.locator('#cleanupGuestInput')).toHaveValue('14');
        await expect(page.locator('#cleanupEnabledToggle')).not.toBeChecked();
    });

    test('rejects an invalid retention value', async ({ page }, testInfo) => {
        if (testInfo.project.name.includes('static')) {
            test.skip(true, 'The admin panel requires server routes');
        }

        const loginResponse = await page.request.post('/api/auth/login', {
            data: { email: 'admin@exelearning.test', password: 'AdminPass123!' },
        });
        expect(loginResponse.ok()).toBeTruthy();

        const response = await page.request.put('/api/admin/settings', {
            data: { settings: [{ key: 'CLEANUP_INTERVAL_HOURS', value: '0', type: 'number' }] },
        });

        expect(response.status()).toBe(400);
        expect((await response.json()).message).toContain('CLEANUP_INTERVAL_HOURS');
    });
});
