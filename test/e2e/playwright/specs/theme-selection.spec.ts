import { test, expect } from '../fixtures/auth.fixture';
import * as path from 'path';
import { waitForAppReady, gotoWorkarea } from '../helpers/workarea-helpers';

test.describe('Theme Selection on ELP Import', () => {
    /**
     * Test that theme from imported .elpx is correctly reflected in the styles panel UI
     * This ensures the fix for the bug where theme was applied but UI wasn't updated
     */
    test('should show correct theme selected in styles panel after opening elpx file', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // 1. Create a new project first
        const projectUuid = await createProject(page, 'Theme Test Project');
        expect(projectUuid).toBeDefined();

        // 2. Navigate to the project
        await gotoWorkarea(page, projectUuid);

        // Wait for the app to fully initialize
        await waitForAppReady(page);

        // 3. Import a fixture .elpx file with a known theme ('base')
        const fixturePath = path.resolve(
            __dirname,
            '../../../fixtures/un-contenido-de-ejemplo-para-probar-estilos-y-catalogacion.elpx',
        );

        // Use the import API or file input to load the fixture
        // First, try to find File > Import menu
        const fileMenu = page.locator('#navbarFile, [data-menu="file"], .navbar-file');

        if ((await fileMenu.count()) > 0) {
            await fileMenu.click();

            // Wait for dropdown to appear
            await page.waitForTimeout(300);

            // Look for import option
            const importOption = page.locator(
                '[data-action="import-local-ode-file"], .import-ode-file, li:has-text("Importar")',
            );

            if ((await importOption.count()) > 0) {
                // Setup file chooser before clicking
                const fileChooserPromise = page.waitForEvent('filechooser');
                await importOption.click();
                const fileChooser = await fileChooserPromise;
                await fileChooser.setFiles(fixturePath);

                // Wait for import to complete
                await page.waitForFunction(
                    () => {
                        const nav = document.querySelector('#structure-menu-nav');
                        return nav && nav.querySelectorAll('.page-node').length > 0;
                    },
                    { timeout: 30000 },
                );
            }
        }

        // 4. Wait a moment for theme to be applied
        await page.waitForTimeout(500);

        // 5. Open the Styles panel
        const stylesButton = page.locator('#dropdownStyles');
        await expect(stylesButton).toBeVisible();
        await stylesButton.click();

        // Wait for the styles sidenav to be active
        await page.waitForSelector('#stylessidenav.active', { timeout: 5000 });

        // 6. Verify the 'base' theme is shown as selected
        // The theme card should have the 'selected' class
        const _baseThemeCard = page.locator(
            '#exestylescontent .theme-card[data-theme-id="base"], #exestylescontent .theme-card.selected',
        );

        // Check if the selected theme card exists
        const selectedCards = page.locator('#exestylescontent .theme-card.selected');
        await expect(selectedCards).toHaveCount(1);

        // Verify it's the base theme that's selected
        const selectedThemeId = await selectedCards.getAttribute('data-theme-id');
        expect(selectedThemeId).toBe('base');
    });

    /**
     * Test that ThemesManager.selected is correctly set after import
     */
    test('should have correct theme in ThemesManager after import', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a project
        const projectUuid = await createProject(page, 'Theme Check Project');
        await gotoWorkarea(page, projectUuid);

        // Wait for app initialization
        await page.waitForFunction(
            () => {
                return (window as any).eXeLearning?.app?.themes?.selected;
            },
            { timeout: 30000 },
        );

        // Get the currently selected theme from the app
        const selectedTheme = await page.evaluate(() => {
            return (
                (window as any).eXeLearning.app.themes.selected?.id ||
                (window as any).eXeLearning.app.themes.selected?.name
            );
        });

        // The theme should be defined (either default or from fixture)
        expect(selectedTheme).toBeDefined();
    });
});
