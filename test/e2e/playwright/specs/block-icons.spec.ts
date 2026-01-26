import { test, expect, skipInStaticMode } from '../fixtures/auth.fixture';
import { waitForAppReady, addTextIdevice, selectFirstPage, gotoWorkarea } from '../helpers/workarea-helpers';

/**
 * Block Icon Selection Modal Tests
 *
 * These tests verify that the block icon selection modal displays icons correctly.
 * This prevents regression of the bug where icons showed 'undefined' values due to
 * incorrect ThemeIcon structure from the backend.
 *
 * Related commit: cdb2dab7 (which broke the icon structure)
 */
test.describe('Block Icon Selection Modal', () => {
    test('should display icons correctly in the block icon selection modal', async ({
        authenticatedPage,
        createProject,
    }, testInfo) => {
        // Skip in static mode - requires server to create projects and add iDevices
        skipInStaticMode(test, testInfo, 'Requires server to create projects and add iDevices');

        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Test Block Icons');
        expect(projectUuid).toBeDefined();

        // Navigate to workarea
        await gotoWorkarea(page, projectUuid);

        // Wait for app initialization
        await waitForAppReady(page);

        // Select a non-root page and add a text iDevice to create a block
        await selectFirstPage(page);
        await addTextIdevice(page);

        // Wait a moment for the UI to stabilize
        await page.waitForTimeout(1000);

        // Click on the block icon button (the + icon with dashed border) to open the icon selection modal
        // The button has aria-label="Select an icon"
        const blockIconBtn = page.locator('button[aria-label="Select an icon"]').first();
        await blockIconBtn.waitFor({ state: 'visible', timeout: 10000 });
        await blockIconBtn.click();

        // Wait for modal to appear
        await page.waitForSelector('#change-block-icon-modal-content', { timeout: 10000 });

        // Verify that icons exist in the modal (excluding empty icon)
        const icons = await page
            .locator('#change-block-icon-modal-content .option-block-icon:not(.empty-block-icon)')
            .all();

        // If the theme has icons, verify they are properly structured
        if (icons.length > 0) {
            for (const icon of icons) {
                // Verify icon-id is not undefined
                const iconId = await icon.getAttribute('icon-id');
                expect(iconId).not.toBe('undefined');
                expect(iconId).toBeTruthy();

                // Verify the img src is not undefined
                const img = icon.locator('img');
                if ((await img.count()) > 0) {
                    const src = await img.getAttribute('src');
                    expect(src).not.toBe('undefined');
                    expect(src).toBeTruthy();
                    // The src should contain /icons/ path
                    expect(src).toMatch(/\/icons\//);

                    // Verify the alt text is not undefined
                    const alt = await img.getAttribute('alt');
                    expect(alt).not.toBe('undefined');
                }
            }
        }

        // Verify the empty icon is present and properly structured
        const emptyIcon = page.locator('#change-block-icon-modal-content .empty-block-icon');
        await expect(emptyIcon).toBeVisible();
        const emptyIconId = await emptyIcon.getAttribute('icon-id');
        expect(emptyIconId).toBe('0'); // Empty icon should have id "0"
    });

    test('should return icons with proper ThemeIcon structure from API', async ({ authenticatedPage }, testInfo) => {
        // Skip in static mode - requires server API endpoints
        skipInStaticMode(test, testInfo, 'Requires server API endpoints');

        const page = authenticatedPage;

        // Directly call the themes API and verify icon structure
        const response = await page.request.get('/api/themes/installed');
        expect(response.ok()).toBeTruthy();

        const data = await response.json();
        expect(data.themes).toBeDefined();
        expect(Array.isArray(data.themes)).toBe(true);

        // Find a theme with icons
        const themeWithIcons = data.themes.find(
            (t: { icons?: Record<string, unknown> }) => Object.keys(t.icons || {}).length > 0,
        );

        if (themeWithIcons) {
            const iconKeys = Object.keys(themeWithIcons.icons);
            expect(iconKeys.length).toBeGreaterThan(0);

            // Verify the first icon has the correct structure
            const firstIcon = themeWithIcons.icons[iconKeys[0]];
            expect(firstIcon).toHaveProperty('id');
            expect(firstIcon).toHaveProperty('title');
            expect(firstIcon).toHaveProperty('type');
            expect(firstIcon).toHaveProperty('value');

            // Verify values are not undefined
            expect(firstIcon.id).toBeDefined();
            expect(firstIcon.title).toBeDefined();
            expect(firstIcon.type).toBe('img');
            expect(firstIcon.value).toMatch(/\/icons\//);
        }
    });
});
