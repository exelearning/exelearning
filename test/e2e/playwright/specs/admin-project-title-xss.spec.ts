import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'admin@exelearning.test';
const ADMIN_PASSWORD = 'AdminPass123!';

// Models a project title stored verbatim by any ROLE_USER via
// POST /api/project/create-quick or POST /api/v1/projects, then returned
// raw by GET /api/admin/projects. The admin panel must render it as text.
const XSS_TITLE = '<img src=x onerror="window.__xssProjectTitle = 1">';

test.describe('Admin Projects panel - stored XSS in project title', () => {
    test('renders an attacker-controlled project title as text, not HTML', async ({ page }, testInfo) => {
        if (testInfo.project.name.includes('static')) {
            test.skip(true, 'Admin projects panel requires server routes');
        }

        const loginResponse = await page.request.post('/api/auth/login', {
            data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
        });
        expect(loginResponse.ok()).toBeTruthy();

        await page.route('**/api/admin/projects?*', route =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    projects: [
                        {
                            id: 999001,
                            uuid: '00000000-0000-4000-8000-000000000001',
                            title: XSS_TITLE,
                            owner_email: 'attacker@evil.test',
                            owner_user_id: null,
                            owner_id: 1,
                            status: 'active',
                            visibility: 'private',
                            created_at: Date.now(),
                        },
                    ],
                    total: 1,
                }),
            }),
        );

        await page.goto('/admin');
        await page.waitForLoadState('networkidle');
        await page.locator('.admin-nav-link[data-section="projects"]').click();

        // 3rd cell = checkbox(0), #id(1), title(2)
        const titleCell = page.locator('#projectsTableBody tr td').nth(2);
        await expect(titleCell).toHaveText(XSS_TITLE);

        // The payload must NOT have been parsed into a live <img> element.
        await expect(page.locator('#projectsTableBody img')).toHaveCount(0);
        const flag = await page.evaluate(() => (window as Window & { __xssProjectTitle?: number }).__xssProjectTitle);
        expect(flag).toBeUndefined();
    });
});
