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
        await page.waitForLoadState('domcontentloaded');

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

    test('renders an attacker-controlled user email in the impersonate button without breaking out (stored XSS)', async ({
        page,
    }, testInfo) => {
        if (testInfo.project.name.includes('static')) {
            test.skip(true, 'Admin users panel requires server routes');
        }

        const loginResponse = await page.request.post('/api/auth/login', {
            data: { email: 'admin@exelearning.test', password: 'AdminPass123!' },
        });
        expect(loginResponse.ok()).toBeTruthy();

        // A single quote in the email would break out of the single-quoted
        // `onclick='impersonateUser(...)'` attribute and inject an event handler
        // unless the argument is HTML-encoded. Real user creation rejects quotes
        // in emails, so the malicious value is injected by mocking the admin API.
        const evilEmail = "x'onmouseover='window.__xssImpersonate=1'@evil.test";
        await page.route('**/api/admin/users?*', route =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    users: [
                        {
                            id: 999002,
                            email: evilEmail,
                            roles: ['ROLE_USER'],
                            is_active: 1,
                            quota_mb: null,
                            storage_used_mb: 0,
                            created_at: Date.now(),
                            updated_at: Date.now(),
                        },
                    ],
                    total: 1,
                }),
            }),
        );

        await page.goto('/admin');
        await page.waitForLoadState('networkidle');
        await page.locator('.admin-nav-link[data-section="users"]').click();

        const impersonate = page.locator('#usersTableBody button[data-action="impersonate"]').first();
        await expect(impersonate).toBeVisible();

        // A successful break-out would attach an onmouseover handler to the button.
        await expect(impersonate).not.toHaveAttribute('onmouseover');

        await impersonate.hover();
        const flag = await page.evaluate(() => (window as Window & { __xssImpersonate?: number }).__xssImpersonate);
        expect(flag).toBeUndefined();
    });
});
