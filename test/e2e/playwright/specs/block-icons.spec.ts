import { test, expect, skipInStaticMode } from '../fixtures/auth.fixture';
import {
    waitForAppReady,
    addTextIdevice,
    addTextIdeviceWithContent,
    selectFirstPage,
    gotoWorkarea,
} from '../helpers/workarea-helpers';

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

        // The focused full-workarea edit mode shows only the iDevice (the block
        // header is hidden) while an iDevice is in edition. Block icons are
        // changed outside edition mode, so add content and save the iDevice to
        // leave edition before opening the block icon modal.
        await page.waitForFunction(
            () => {
                const ed = (window as any).tinymce?.activeEditor;
                return ed && ed.initialized;
            },
            undefined,
            { timeout: 15000 },
        );
        await page.evaluate(() => {
            const ed = (window as any).tinymce.activeEditor;
            ed.setContent('<p>Block icon test</p>');
            ed.fire('change');
            ed.setDirty(true);
        });
        await page.locator('#node-content .idevice_node[mode="edition"] .btn-save-idevice').click();
        await page.waitForFunction(
            () => !document.querySelector('#node-content .idevice_node[mode="edition"]'),
            undefined,
            { timeout: 15000 },
        );

        // Wait a moment for the UI to stabilize
        await page.waitForTimeout(500);

        // Click on the block icon button (the + icon with dashed border) to open the icon selection modal
        // The button has aria-label="Select an icon"
        // Wait deterministically for the block's icon button to render rather than
        // sleeping a fixed amount of time.
        const blockIconBtn = page.locator('button[aria-label="Select an icon"]').first();
        await blockIconBtn.waitFor({ state: 'visible', timeout: 10000 });
        await blockIconBtn.click();

        // Wait for modal to appear
        await page.waitForSelector('#change-block-icon-modal-content', { timeout: 10000 });

        // Verify that icons exist in the modal (excluding empty icon)
        const icons = page.locator('#change-block-icon-modal-content .option-block-icon:not(.empty-block-icon)');
        const iconCount = await icons.count();

        // If the theme has icons, verify they are properly structured
        if (iconCount > 0) {
            const sampleCount = Math.min(iconCount, 25);
            for (let i = 0; i < sampleCount; i++) {
                const icon = icons.nth(i);
                // Verify icon-id is not undefined
                const iconId = await icon.getAttribute('icon-id');
                expect(iconId).not.toBe('undefined');
                expect(iconId).toBeTruthy();

                // Theme/custom icons render as img; material modal icons render via sprite SVG.
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
                    continue;
                }

                const materialSprite = icon.locator('.exe-material-icon-sprite use');
                await expect(materialSprite).toHaveCount(1);
                const href = await materialSprite.getAttribute('href');
                expect(href).toBeTruthy();
                expect(href).toContain('/libs/material-icons/material-icons.svg#');
            }
        }

        // Verify the empty icon is present and properly structured
        const emptyIcon = page.locator('#change-block-icon-modal-content .empty-block-icon');
        await expect(emptyIcon).toBeVisible();
        const emptyIconId = await emptyIcon.getAttribute('icon-id');
        expect(emptyIconId).toBe('0'); // Empty icon should have id "0"
    });

    test('should render an applied Material icon as a self-contained data: URI', async ({
        authenticatedPage,
        createProject,
    }, testInfo) => {
        // Skip in static mode - requires server to create projects and add iDevices
        skipInStaticMode(test, testInfo, 'Requires server to create projects and add iDevices');

        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'Test Applied Material Icon');
        expect(projectUuid).toBeDefined();

        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await selectFirstPage(page);
        // Add the iDevice WITH content and save it: the focused full-workarea edit
        // mode hides the block header (and its icon button) while an iDevice is in
        // edition, so we must leave edition before the block icon button is visible.
        await addTextIdeviceWithContent(page, 'Block icon test');

        // Open the icon picker for the first block. Wait deterministically for the
        // block's icon button to render rather than sleeping a fixed amount of time.
        const blockIconBtn = page.locator('button[aria-label="Select an icon"]').first();
        await blockIconBtn.waitFor({ state: 'visible', timeout: 10000 });
        await blockIconBtn.click();

        const modalBody = page.locator('#change-block-icon-modal-content').last();
        await modalBody.waitFor({ state: 'visible', timeout: 10000 });

        // Pick a known Material icon ("lightbulb") deterministically by its id.
        const lightbulb = modalBody.locator('.option-block-icon[icon-id="mi-lightbulb"]').first();
        await lightbulb.scrollIntoViewIfNeeded();
        await lightbulb.click();

        // Confirm the selection (the confirm modal's primary button is "Save").
        const modal = page.locator('.modal.show').filter({ has: modalBody }).last();
        await modal.locator('button.btn.button-primary').first().click();
        await page.waitForFunction(() => !document.querySelector('.modal.show'), undefined, { timeout: 5000 });

        // The applied block icon must render from the sprite as an inline data: URI
        // (the loose per-icon SVG files were removed), not a /libs/.../icons/*.svg path.
        await page.waitForFunction(
            () => {
                const block = document.querySelector('#node-content article.box');
                const span = block?.querySelector('header.box-head button.box-icon .exe-material-icon');
                if (!span) return false;
                const url = (span as HTMLElement).style.getPropertyValue('--exe-material-icon-url');
                return url.includes('data:image/svg+xml') && !url.includes('/icons/');
            },
            undefined,
            { timeout: 10000 },
        );
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
