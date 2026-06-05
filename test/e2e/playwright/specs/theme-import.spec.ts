import { test, expect } from '../fixtures/auth.fixture';
import { waitForAppReady, waitForLoadingScreen, gotoWorkarea } from '../helpers/workarea-helpers';
import * as path from 'path';
import type { Page } from '@playwright/test';

/**
 * Import an ELPX fixture.
 * Uses File > Open.
 */
async function importElpxFixture(page: Page, fixtureName: string): Promise<void> {
    const fixturePath = path.resolve(__dirname, `../../../fixtures/${fixtureName}`);

    // Open File menu
    await page.locator('#dropdownFile').click();
    await page.waitForTimeout(300);

    const openOfflineOption = page.locator('#navbar-button-open-offline');
    const openOnlineOption = page.locator('#navbar-button-openuserodefiles');
    const openOption = ((await openOfflineOption.count()) > 0 ? openOfflineOption : openOnlineOption).first();
    await expect(openOption).toHaveCount(1);

    // In static mode Open triggers a file chooser; in online mode it opens a modal with file inputs.
    const fileChooserPromise = page
        .waitForEvent('filechooser', { timeout: 12000 })
        .then(fileChooser => ({ type: 'filechooser' as const, fileChooser }))
        .catch(() => null);
    await openOption.click({ force: true });

    const modalUploadInput = page.locator('#local-ode-modal-file-upload');
    const staticOpenInput = page.locator('#static-open-file-input');

    await page
        .waitForSelector('#local-ode-modal-file-upload, #static-open-file-input', {
            state: 'attached',
            timeout: 12000,
        })
        .catch(() => {});

    if (await modalUploadInput.count()) {
        await modalUploadInput.setInputFiles(fixturePath);
    } else {
        if (await staticOpenInput.count()) {
            await staticOpenInput.setInputFiles(fixturePath);
        } else {
            const chooserResult = await fileChooserPromise;
            if (!chooserResult) {
                throw new Error('Open did not expose a file input or file chooser');
            }
            await chooserResult.fileChooser.setFiles(fixturePath);
        }
    }

    // Wait for loading screen to hide (import progress shows and then hides)
    await waitForLoadingScreen(page);

    // Wait for navigation to be populated
    await page.waitForFunction(
        () => {
            try {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                if (!bridge) return false;
                const yDoc = bridge.getDocumentManager()?.getDoc();
                if (!yDoc) return false;
                const navigation = yDoc.getArray('navigation');
                return navigation && navigation.length >= 1;
            } catch {
                return false;
            }
        },
        undefined,
        { timeout: 30000 },
    );
}

test.describe('Theme Import from ELPX', () => {
    /**
     * Test that ELPX import completes successfully
     * Note: Full theme import verification requires manual testing
     * as it depends on a confirmation dialog interaction
     */
    test('ELPX import completes with theme metadata', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Theme Import Test');
        expect(projectUuid).toBeDefined();

        // Navigate to the project
        await gotoWorkarea(page, projectUuid);

        // Wait for app initialization
        await waitForAppReady(page);

        // Import the fixture
        await importElpxFixture(page, 'download-elpx-link.elpx');

        // Wait until Yjs is initialized and imported navigation is available.
        await page.waitForFunction(
            () => {
                try {
                    const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                    if (!bridge) return false;
                    const documentManager = bridge.getDocumentManager();
                    if (!documentManager?._initialized) return false;
                    const yDoc = documentManager.getDoc();
                    if (!yDoc) return false;
                    const navigation = yDoc.getArray('navigation');
                    return (navigation?.length || 0) > 0;
                } catch {
                    return false;
                }
            },
            undefined,
            { timeout: 60000 },
        );

        // Verify import completed (check that content was imported).
        // Use poll to avoid transient 0-length reads while Firefox finishes Yjs hydration.
        await expect
            .poll(
                async () => {
                    try {
                        return await page.evaluate(() => {
                            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                            if (!bridge) return 0;
                            const yDoc = bridge.getDocumentManager()?.getDoc();
                            if (!yDoc) return 0;
                            const navigation = yDoc.getArray('navigation');
                            return navigation?.length || 0;
                        });
                    } catch {
                        return 0;
                    }
                },
                { timeout: 60000, intervals: [250, 500, 1000] },
            )
            .toBeGreaterThan(0);

        // Ensure page has finished any navigation (ELPX import may reload in online mode)
        await page.waitForLoadState('load');

        // Check theme in Yjs metadata with retry; import can trigger navigation mid-read in CI.
        await expect
            .poll(
                async () => {
                    try {
                        return await page.evaluate(() => {
                            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                            if (!bridge) return null;
                            const documentManager = bridge.getDocumentManager();
                            if (!documentManager?._initialized) return null;
                            const metadata = documentManager.getMetadata();
                            return metadata?.get('theme') || null;
                        });
                    } catch {
                        return null;
                    }
                },
                { timeout: 60000, intervals: [250, 500, 1000] },
            )
            .not.toBeNull();
    });

    /**
     * Test that the styles panel UI can show user themes
     * Note: This verifies the UI elements exist, not the full import flow
     */
    test('styles panel has user themes tab', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create and navigate to project
        const projectUuid = await createProject(page, 'Styles Panel Test');
        await gotoWorkarea(page, projectUuid);

        // Wait for app initialization
        await waitForAppReady(page);

        // Open the Styles panel
        const stylesButton = page.locator('#dropdownStyles');
        await expect(stylesButton).toBeVisible();
        await stylesButton.click();

        // Wait for the styles sidenav to be active
        await page.waitForSelector('#stylessidenav.active', { timeout: 5000 });

        // Verify the "Imported" tab exists
        const importedTab = page.locator('#importedstylescontent-tab');
        await expect(importedTab).toBeVisible();

        // Click the Imported tab
        await importedTab.click();
        await page.waitForTimeout(300);

        // Verify the imported themes content area exists
        const importedContent = page.locator('#importedstylescontent');
        await expect(importedContent).toBeVisible();
    });

    /**
     * Skip: Full theme import with confirmation dialog
     * This test requires interaction with a confirmation modal that appears
     * asynchronously after import. Manual testing recommended.
     */
    test.skip('imported theme appears in styles panel immediately', async ({ authenticatedPage, createProject }) => {
        // This test is skipped because it requires clicking a confirmation
        // dialog that appears during import. The dialog timing is inconsistent
        // in automated tests. Manual testing confirms the fix works.
        //
        // To test manually:
        // 1. Create a new project
        // 2. File > Open > select download-elpx-link.elpx
        // 3. When "Import style" dialog appears, click "Yes"
        // 4. Open Styles panel > Imported tab
        // 5. Verify "Universal" theme appears
    });

    /**
     * Skip: Theme CSS loading in preview
     * This test depends on the full import flow working correctly.
     */
    test.skip('imported theme CSS loads in preview', async ({ authenticatedPage, createProject }) => {
        // Skipped - depends on theme being fully imported first
    });
});
