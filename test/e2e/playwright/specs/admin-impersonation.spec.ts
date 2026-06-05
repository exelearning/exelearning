import { test, expect } from '@playwright/test';

test.describe('Admin Impersonation', () => {
    test('should impersonate a user, keep banner visible, and return to admin', async ({ page }, testInfo) => {
        if (testInfo.project.name.includes('static')) {
            test.skip(true, 'Impersonation requires server routes');
        }

        const adminEmail = 'admin@exelearning.test';
        const adminPassword = 'AdminPass123!';
        const targetEmail = `impersonation-target-${Date.now()}@example.com`;

        const loginResponse = await page.request.post('/api/auth/login', {
            data: {
                email: adminEmail,
                password: adminPassword,
            },
        });
        expect(loginResponse.ok()).toBeTruthy();

        const createUserResponse = await page.request.post('/api/admin/users', {
            data: {
                email: targetEmail,
                password: 'TargetPass123!',
                roles: ['ROLE_USER'],
            },
        });
        expect(createUserResponse.ok()).toBeTruthy();

        await page.goto('/admin');
        await page.waitForLoadState('networkidle');

        await page.locator('.admin-nav-link[data-section="users"]').click();
        await page.fill('#userSearch', targetEmail);
        const targetRow = page.locator('#usersTableBody tr').filter({ hasText: targetEmail }).first();
        await expect(targetRow).toBeVisible();

        page.once('dialog', dialog => dialog.accept());
        await targetRow.locator('button[data-action="impersonate"]').click();

        await page.waitForURL(/\/workarea/);
        const banner = page.locator('#impersonation-banner');
        await expect(banner).toBeVisible();
        await expect(banner).toContainText(targetEmail);

        await page.goto('/workarea');
        await expect(page.locator('#impersonation-banner')).toBeVisible();

        await page.locator('#impersonation-return-button').click();
        await page.waitForURL(/\/admin/);
        await expect(page.locator('#impersonation-banner')).toHaveCount(0);
    });
});
