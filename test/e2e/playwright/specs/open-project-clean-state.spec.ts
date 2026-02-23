import { test, expect } from '../fixtures/auth.fixture';
import { waitForAppReady, gotoWorkarea } from '../helpers/workarea-helpers';

/**
 * E2E Tests for Opening Existing Projects with Clean State (Issue #1117)
 *
 * Tests that opening an existing project that was previously saved shows the
 * correct save status (green dot, not red dot).
 *
 * This tests the baseline state capture and localStorage persistence of dirty state.
 */

test.describe('Open Project Clean State', () => {
    test.beforeEach(({}, testInfo) => {
        if (testInfo.project.name === 'static') {
            test.skip(true, 'Dirty state persistence is disabled in static mode');
        }
    });

    test('opening an existing saved project should show saved status', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Clean State Test');

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
            undefined,
            { timeout: 10000 },
        );

        // Make a change
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const metadata = bridge.documentManager.getMetadata();
            metadata.set('title', 'Updated Title for Clean State Test');
        });

        // Wait for change to register
        await page.waitForTimeout(300);

        // Save the project
        const saveButton = page.locator('#head-top-save-button');
        await saveButton.click();

        // Wait for save to complete
        await page.waitForFunction(
            () => {
                const btn = document.getElementById('head-top-save-button');
                return btn?.classList.contains('saved') && !btn?.classList.contains('saving');
            },
            undefined,
            { timeout: 30000 },
        );

        // Verify saved status
        await expect(saveButton).toHaveClass(/saved/);

        // Now reload the page to simulate reopening the project
        await page.reload();

        // Wait for app to reinitialize
        await waitForAppReady(page);

        // Wait for baseline state to be recaptured
        await page.waitForFunction(
            () => {
                const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
                return docManager?._initialized === true;
            },
            undefined,
            { timeout: 10000 },
        );

        // Verify the save button shows saved status (not unsaved)
        const saveButtonAfterReload = page.locator('#head-top-save-button');
        await expect(saveButtonAfterReload).toHaveClass(/saved/);
        await expect(saveButtonAfterReload).not.toHaveClass(/unsaved/);

        // Verify document is not dirty
        const isDirty = await page.evaluate(() => {
            const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
            return docManager?.isDirty === true;
        });
        expect(isDirty).toBe(false);
    });

    test('persisted dirty state should be restored after page reload', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Dirty State Persistence Test');

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
            undefined,
            { timeout: 10000 },
        );

        // Make a change (but don't save)
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const metadata = bridge.documentManager.getMetadata();
            metadata.set('author', 'Test Author for Persistence');
        });

        // Wait for change to register and be persisted to localStorage
        await page.waitForTimeout(500);

        // Verify unsaved status before reload
        const saveButton = page.locator('#head-top-save-button');
        await expect(saveButton).toHaveClass(/unsaved/);

        // Verify dirty state was persisted to localStorage
        const dirtyStatePersisted = await page.evaluate(projectId => {
            const key = `exelearning_dirty_state_${projectId}`;
            return localStorage.getItem(key) === 'true';
        }, projectUuid);
        expect(dirtyStatePersisted).toBe(true);

        // Reload the page
        await page.reload();

        // Wait for app to reinitialize
        await waitForAppReady(page);

        // Wait for baseline state with persisted dirty state restored
        await page.waitForFunction(
            () => {
                const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
                return docManager?._initialized === true;
            },
            undefined,
            { timeout: 10000 },
        );

        // Verify the save button shows unsaved status (dirty state was restored)
        const saveButtonAfterReload = page.locator('#head-top-save-button');
        await expect(saveButtonAfterReload).toHaveClass(/unsaved/);

        // Verify document is dirty
        const isDirtyAfterReload = await page.evaluate(() => {
            const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
            return docManager?.isDirty === true;
        });
        expect(isDirtyAfterReload).toBe(true);
    });

    test('saving should clear persisted dirty state', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a new project
        const projectUuid = await createProject(page, 'Clear Dirty State Test');

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
            undefined,
            { timeout: 10000 },
        );

        // Make a change
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const metadata = bridge.documentManager.getMetadata();
            metadata.set('description', 'Test description');
        });

        // Wait for change to register
        await page.waitForTimeout(300);

        // Verify dirty state is persisted
        const dirtyStateBefore = await page.evaluate(projectId => {
            const key = `exelearning_dirty_state_${projectId}`;
            return localStorage.getItem(key) === 'true';
        }, projectUuid);
        expect(dirtyStateBefore).toBe(true);

        // Save the project
        const saveButton = page.locator('#head-top-save-button');
        await saveButton.click();

        // Wait for save to complete
        await page.waitForFunction(
            () => {
                const btn = document.getElementById('head-top-save-button');
                return btn?.classList.contains('saved') && !btn?.classList.contains('saving');
            },
            undefined,
            { timeout: 30000 },
        );

        // Verify dirty state is cleared from localStorage
        const dirtyStateAfter = await page.evaluate(projectId => {
            const key = `exelearning_dirty_state_${projectId}`;
            return localStorage.getItem(key);
        }, projectUuid);
        expect(dirtyStateAfter).toBeNull();
    });
});
