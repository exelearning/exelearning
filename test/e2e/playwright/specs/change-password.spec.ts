import { test, expect, type Page } from '@playwright/test';

/**
 * Self-service password change (issue #2261).
 *
 * Covers the two halves of the feature that only a real browser can prove:
 * the menu entry is rendered from the server-side `canChangePassword`
 * capability, and the dialog talks to `PATCH /api/user/password` without
 * dropping the session on a wrong current password.
 */

const ADMIN_EMAIL = 'admin@exelearning.test';
const ADMIN_PASSWORD = 'AdminPass123!';

/** Open the avatar menu in the workarea toolbar. */
async function openUserMenu(page: Page): Promise<void> {
    await page.locator('#exeUserMenuToggler').click();
    await expect(page.locator('#head-bottom-user-logged .dropdown-menu')).toBeVisible();
}

/** Open the Change password dialog and wait for it to finish animating in. */
async function openChangePasswordModal(page: Page): Promise<void> {
    await openUserMenu(page);
    await page.locator('#navbar-button-change-password').click();
    await expect(page.locator('#modalChangePassword')).toHaveAttribute('data-open', 'true');
}

async function fillChangePasswordForm(
    page: Page,
    values: { current: string; next: string; confirm: string },
): Promise<void> {
    await page.locator('[data-testid="change-password-current"]').fill(values.current);
    await page.locator('[data-testid="change-password-new"]').fill(values.next);
    await page.locator('[data-testid="change-password-confirm"]').fill(values.confirm);
}

test.describe('Change password', () => {
    test.beforeEach(async ({}, testInfo) => {
        if (testInfo.project.name.includes('static')) {
            test.skip(true, 'Static builds have no accounts and no password to change');
        }
    });

    test('local user changes their password from the user menu', async ({ page, request }) => {
        const email = `change-password-${Date.now()}@example.com`;
        const originalPassword = 'OriginalPass123!';
        const newPassword = 'BrandNewPass456!';

        // Create the target account through the admin API.
        const adminLogin = await page.request.post('/api/auth/login', {
            data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
        });
        expect(adminLogin.ok()).toBeTruthy();

        const createUser = await page.request.post('/api/admin/users', {
            data: { email, password: originalPassword, roles: ['ROLE_USER'] },
        });
        expect(createUser.ok()).toBeTruthy();

        // Become that user and open the workarea.
        const userLogin = await page.request.post('/api/auth/login', {
            data: { email, password: originalPassword },
        });
        expect(userLogin.ok()).toBeTruthy();

        await page.goto('/workarea');
        await page.waitForURL(/\/workarea/);
        await page.waitForFunction(() => (window as any).eXeLearning?.app?.modals !== undefined, undefined, {
            timeout: 30000,
        });

        // The capability is computed server-side, so the entry must be in the DOM.
        await openUserMenu(page);
        await expect(page.locator('#navbar-button-change-password')).toBeVisible();
        await page.keyboard.press('Escape');

        // A wrong current password is reported in place — it must not log the user out.
        await openChangePasswordModal(page);
        await fillChangePasswordForm(page, {
            current: 'WrongPass000!',
            next: newPassword,
            confirm: newPassword,
        });
        await page.locator('[data-testid="change-password-submit"]').click();
        await expect(page.locator('[data-testid="change-password-feedback"]')).toContainText(
            'Current password is incorrect',
        );
        await expect(page).toHaveURL(/\/workarea/);

        // A mismatched confirmation is caught before any request goes out.
        await fillChangePasswordForm(page, {
            current: originalPassword,
            next: newPassword,
            confirm: 'DifferentPass789!',
        });
        await page.locator('[data-testid="change-password-submit"]').click();
        await expect(page.locator('[data-testid="change-password-feedback"]')).toContainText('Passwords do not match');

        // The real change.
        await fillChangePasswordForm(page, {
            current: originalPassword,
            next: newPassword,
            confirm: newPassword,
        });
        await page.locator('[data-testid="change-password-submit"]').click();
        await expect(page.locator('[data-testid="change-password-feedback"]')).toContainText(
            'Password changed successfully',
        );

        // Fields are cleared so the credentials do not linger in the DOM.
        await expect(page.locator('[data-testid="change-password-current"]')).toHaveValue('');
        await expect(page.locator('[data-testid="change-password-new"]')).toHaveValue('');
        await expect(page.locator('[data-testid="change-password-confirm"]')).toHaveValue('');

        // The old password stops working and the new one authenticates.
        // `request` has its own cookie jar, so this does not disturb the page session.
        const oldLogin = await request.post('/api/auth/login', {
            data: { email, password: originalPassword },
        });
        expect(oldLogin.status()).toBe(401);

        const newLogin = await request.post('/api/auth/login', {
            data: { email, password: newPassword },
        });
        expect(newLogin.ok()).toBeTruthy();
    });

    test('guest session gets neither the menu entry nor the endpoint', async ({ page }) => {
        const guestLogin = await page.request.post('/login/guest', { form: { guest_login_nonce: '' } });
        expect(guestLogin.ok()).toBeTruthy();

        await page.goto('/workarea');
        await page.waitForURL(/\/workarea/);
        await page.waitForFunction(() => (window as any).eXeLearning?.app?.modals !== undefined, undefined, {
            timeout: 30000,
        });

        await openUserMenu(page);
        await expect(page.locator('#navbar-button-change-password')).toHaveCount(0);

        // The hidden entry is not the authorization boundary: the API refuses too.
        const response = await page.request.patch('/api/user/password', {
            data: { currentPassword: 'anything', newPassword: 'BrandNewPass456!' },
        });
        expect(response.status()).toBe(403);
    });
});
