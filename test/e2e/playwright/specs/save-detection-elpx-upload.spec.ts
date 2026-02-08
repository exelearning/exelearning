import { test, expect } from '../fixtures/auth.fixture';
import { waitForAppReady, openElpFile, gotoWorkarea } from '../helpers/workarea-helpers';
import * as path from 'path';

/**
 * E2E Tests for Save Detection after ELPX Upload (Issue #1117)
 *
 * Tests that after opening an ELPX file, the save status correctly reflects:
 * - Immediately after open: should show saved (clean baseline)
 * - After user changes: should show unsaved
 */

test.describe('Save Detection - ELPX Upload', () => {
    const FIXTURE_PATH = path.resolve(__dirname, '../../../fixtures/really-simple-test-project.elpx');

    test('opening ELPX should start with saved status', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a new project first
        const projectUuid = await createProject(page, 'ELPX Import Test');

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

        // Verify initial saved state before open
        const saveButton = page.locator('#head-top-save-button');
        await expect(saveButton).toHaveClass(/saved/);

        // Open the ELPX file (replaces current project)
        await openElpFile(page, FIXTURE_PATH, 1);

        // Wait for baseline state to be captured on the opened project
        await page.waitForFunction(
            () => {
                const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
                return docManager?._initialized === true;
            },
            { timeout: 10000 },
        );

        // After opening, the document should be clean
        const isDirtyAfterOpen = await page.evaluate(() => {
            const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
            return docManager?.isDirty === true;
        });

        expect(isDirtyAfterOpen).toBe(false);

        // Verify the save button shows saved status
        const saveButtonAfterOpen = page.locator('#head-top-save-button');
        await expect(saveButtonAfterOpen).toHaveClass(/saved/);
    });

    test('changes after opening ELPX should show unsaved status', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a new project first
        const projectUuid = await createProject(page, 'ELPX Open Change Test');

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

        // Open the ELPX file
        await openElpFile(page, FIXTURE_PATH, 1);

        // Wait for baseline state
        await page.waitForFunction(
            () => {
                const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
                return docManager?._initialized === true;
            },
            { timeout: 10000 },
        );

        // Make a change
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const metadata = bridge.documentManager.getMetadata();
            metadata.set('author', 'Changed After Open');
        });

        await page.waitForTimeout(300);

        // Verify unsaved after change
        const isDirtyAfterChange = await page.evaluate(() => {
            const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
            return docManager?.isDirty === true;
        });

        expect(isDirtyAfterChange).toBe(true);

        const saveButton = page.locator('#head-top-save-button');
        await expect(saveButton).toHaveClass(/unsaved/);
    });

    test('hasUnsavedChangesForUI reflects changes after opening ELPX', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        // Create a new project first
        const projectUuid = await createProject(page, 'ELPX Unsaved Navigation Test');

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

        // Open the ELPX file
        await openElpFile(page, FIXTURE_PATH, 1);

        // Wait for baseline state
        await page.waitForFunction(
            () => {
                const docManager = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
                return docManager?._initialized === true;
            },
            { timeout: 10000 },
        );

        // Make a change
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const metadata = bridge.documentManager.getMetadata();
            metadata.set('description', 'Changed After Open');
        });

        // Verify that hasUnsavedChangesForUI returns true
        const hasUnsavedChanges = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            return bridge?.hasUnsavedChangesForUI?.() === true;
        });

        // After change, there should be unsaved changes
        expect(hasUnsavedChanges).toBe(true);
    });
});
