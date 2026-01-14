import { test, expect, waitForLoadingScreenHidden } from '../fixtures/auth.fixture';

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
    }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Test Block Icons');
        expect(projectUuid).toBeDefined();

        // Navigate to workarea
        await page.goto(`/workarea?project=${projectUuid}`);
        await page.waitForLoadState('networkidle');

        // Wait for Yjs initialization
        await page.waitForFunction(
            () => {
                const app = (window as any).eXeLearning?.app;
                return app?.project?._yjsBridge !== undefined;
            },
            { timeout: 30000 },
        );

        // Wait for loading screen to be hidden
        await waitForLoadingScreenHidden(page);

        // Select a page (not root) to be able to add iDevices
        const pageNode = page.locator('.nav-element:not([nav-id="root"]) > .nav-element-text').first();
        await pageNode.scrollIntoViewIfNeeded();
        await pageNode.click({ force: true });
        await page.waitForTimeout(1500);

        // Wait for page content area to be ready
        await page.waitForFunction(
            () => {
                const nodeContent = document.querySelector('#node-content');
                return nodeContent !== null;
            },
            { timeout: 10000 },
        );

        // Add a text iDevice to create a block
        // First expand the "Information" category where the text iDevice is located
        const infoCategory = page
            .locator('.idevice_category')
            .filter({ has: page.locator('h3.idevice_category_name').filter({ hasText: /Information|Información/i }) })
            .first();

        if ((await infoCategory.count()) > 0) {
            const isCollapsed = await infoCategory.evaluate(el => el.classList.contains('off'));
            if (isCollapsed) {
                await infoCategory.locator('.label').click();
                await page.waitForTimeout(800);
            }
        }

        // Click text iDevice
        const textIdevice = page.locator('.idevice_item[id="text"]').first();
        await textIdevice.waitFor({ state: 'visible', timeout: 10000 });
        await textIdevice.click();

        // Wait for iDevice to appear in content area
        await page.waitForFunction(
            () => {
                const idevices = document.querySelectorAll('#node-content article .idevice_node.text');
                return idevices.length > 0;
            },
            { timeout: 15000 },
        );

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

    test('should return icons with proper ThemeIcon structure from API', async ({ authenticatedPage }) => {
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
