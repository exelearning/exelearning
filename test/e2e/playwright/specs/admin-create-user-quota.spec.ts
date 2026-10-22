import { test, expect } from '@playwright/test';

/**
 * The create-user modal in /admin says "Leave empty for unlimited quota". Clearing the field
 * sends `quota_mb: null`, which used to be rejected with a 422 (#2514). It must create an
 * unlimited user, and a typed value must be kept as is.
 */
test.describe('Admin create user quota', () => {
    test('creates an unlimited user when the quota field is left empty', async ({ page }, testInfo) => {
        if (testInfo.project.name.includes('static')) {
            test.skip(true, 'The admin panel requires server routes');
        }

        const loginResponse = await page.request.post('/api/auth/login', {
            data: { email: 'admin@exelearning.test', password: 'AdminPass123!' },
        });
        expect(loginResponse.ok()).toBeTruthy();

        await page.goto('/admin');
        await page.waitForLoadState('domcontentloaded');
        await page.locator('.admin-nav-link[data-section="users"]').click();

        const createUser = async (email: string, quota: string) => {
            await page.locator('[data-bs-target="#createUserModal"]').click();
            const modal = page.locator('#createUserModal');
            await expect(modal).toBeVisible();
            await modal.locator('[name="email"]').fill(email);
            await modal.locator('[name="password"]').fill('QuotaPass123!');
            await modal.locator('[name="quota_mb"]').fill(quota);

            const created = page.waitForResponse(
                res => new URL(res.url()).pathname.endsWith('/api/admin/users') && res.request().method() === 'POST',
            );
            await modal.locator('button[type="submit"]').click();
            const response = await created;
            await expect(modal).toBeHidden();
            return response;
        };

        const unlimitedEmail = `quota-unlimited-${Date.now()}@example.com`;
        const unlimited = await createUser(unlimitedEmail, '');
        expect(unlimited.status()).toBe(201);
        expect(unlimited.request().postDataJSON().quota_mb).toBeNull();
        expect((await unlimited.json()).user.quota_mb).toBeNull();

        const limited = await createUser(`quota-limited-${Date.now()}@example.com`, '75');
        expect(limited.status()).toBe(201);
        expect((await limited.json()).user.quota_mb).toBe(75);
    });
});
