import { test, expect } from '../fixtures/auth.fixture';
import { waitForAppReady, gotoWorkarea } from '../helpers/workarea-helpers';

/**
 * E2E Tests for Save Detection (Issue #1117)
 *
 * Tests that the save status indicator (red/green dot on save button) correctly reflects
 * the document's unsaved changes state. This includes:
 * - Opening a new project should show saved status (green dot)
 * - Making changes should show unsaved status (red dot)
 * - Saving should return to saved status (green dot)
 */

test.describe('Save Detection', () => {
    test('new project should start with saved status (no red dot)', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Save Detection Test');

        // Navigate to the project workarea
        await gotoWorkarea(page, projectUuid);

        // Wait for app to fully initialize including Yjs
        await waitForAppReady(page);

        // Wait for baseline state to be captured
        await page.waitForFunction(
            () => {
                const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
                return docManager?._initialized === true;
            },
            { timeout: 10000 },
        );

        // Verify the save button has 'saved' class (green dot) and not 'unsaved' class (red dot)
        const saveButton = page.locator('#head-top-save-button');
        await expect(saveButton).toHaveClass(/saved/);
        await expect(saveButton).not.toHaveClass(/unsaved/);

        // Verify the document manager reports no unsaved changes
        const isDirty = await page.evaluate(() => {
            const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
            return docManager?.isDirty === true;
        });

        expect(isDirty).toBe(false);
    });

    test('making changes should show unsaved status (red dot)', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Save Detection Changes Test');

        // Navigate to the project workarea
        await gotoWorkarea(page, projectUuid);

        // Wait for app to fully initialize
        await waitForAppReady(page);

        // Wait for baseline state to be captured
        await page.waitForFunction(
            () => {
                const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
                return docManager?._initialized === true;
            },
            { timeout: 10000 },
        );

        // Verify initial saved state
        const saveButton = page.locator('#head-top-save-button');
        await expect(saveButton).toHaveClass(/saved/);

        // Make a change: add a new page via Yjs
        await page.evaluate(() => {
            const project = (window as any).eXeLearning.app.project;
            project.addPageViaYjs('Test Page for Save Detection');
        });

        // Wait for the save status to update
        await page.waitForTimeout(500);

        // Verify the save button now has 'unsaved' class (red dot)
        await expect(saveButton).toHaveClass(/unsaved/);
        await expect(saveButton).not.toHaveClass(/\bsaved\b/);

        // Verify the document manager reports unsaved changes
        const isDirty = await page.evaluate(() => {
            const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
            return docManager?.isDirty === true;
        });

        expect(isDirty).toBe(true);
    });

    test('saving should return to saved status (green dot)', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Save Detection Save Test');

        // Navigate to the project workarea
        await gotoWorkarea(page, projectUuid);

        // Wait for app to fully initialize
        await waitForAppReady(page);

        // Wait for baseline state to be captured
        await page.waitForFunction(
            () => {
                const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
                return docManager?._initialized === true;
            },
            { timeout: 10000 },
        );

        // Make a change: rename the first page via Yjs
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const nav = bridge.documentManager.getNavigation();
            const firstPage = nav.get(0);
            const pageId = firstPage.get('id');
            const project = (window as any).eXeLearning.app.project;
            project.renamePageViaYjs(pageId, 'Renamed Page for Save Test');
        });

        // Wait for the save status to show unsaved
        await page.waitForTimeout(500);
        const saveButton = page.locator('#head-top-save-button');
        await expect(saveButton).toHaveClass(/unsaved/);

        // Save the project via the save button
        await saveButton.click();

        // Wait for save to complete (saving -> saved transition)
        await page.waitForFunction(
            () => {
                const saveBtn = document.getElementById('head-top-save-button');
                return saveBtn?.classList.contains('saved') && !saveBtn?.classList.contains('saving');
            },
            { timeout: 30000 },
        );

        // Verify the save button has 'saved' class (green dot)
        await expect(saveButton).toHaveClass(/saved/);
        await expect(saveButton).not.toHaveClass(/unsaved/);

        // Verify the document manager reports no unsaved changes
        const isDirty = await page.evaluate(() => {
            const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
            return docManager?.isDirty === true;
        });

        expect(isDirty).toBe(false);
    });

    test('metadata changes should trigger unsaved status', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Metadata Change Test');

        // Navigate to the project workarea
        await gotoWorkarea(page, projectUuid);

        // Wait for app to fully initialize
        await waitForAppReady(page);

        // Wait for baseline state to be captured
        await page.waitForFunction(
            () => {
                const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
                return docManager?._initialized === true;
            },
            { timeout: 10000 },
        );

        // Verify initial saved state
        const saveButton = page.locator('#head-top-save-button');
        await expect(saveButton).toHaveClass(/saved/);

        // Make a metadata change: update the project title via Yjs
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const metadata = bridge.documentManager.getMetadata();
            metadata.set('title', 'Updated Project Title');
        });

        // Wait for the save status to update
        await page.waitForTimeout(500);

        // Verify the save button shows unsaved status
        await expect(saveButton).toHaveClass(/unsaved/);
    });

    test('hasUnsavedChangesForUI should return correct value', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'HasUnsavedChanges Test');

        // Navigate to the project workarea
        await gotoWorkarea(page, projectUuid);

        // Wait for app to fully initialize
        await waitForAppReady(page);

        // Wait for baseline state
        await page.waitForFunction(
            () => {
                const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
                return docManager?._initialized === true;
            },
            { timeout: 10000 },
        );

        // Check initial state - should return false
        const initialHasChanges = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            return bridge.hasUnsavedChangesForUI();
        });
        expect(initialHasChanges).toBe(false);

        // Make a change
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const metadata = bridge.documentManager.getMetadata();
            metadata.set('author', 'Test Author');
        });

        // Wait for change to register
        await page.waitForTimeout(300);

        // Check after change - should return true
        const afterChangeHasChanges = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            return bridge.hasUnsavedChangesForUI();
        });
        expect(afterChangeHasChanges).toBe(true);
    });
});
