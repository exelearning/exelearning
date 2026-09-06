import path from 'path';
import { test, expect, skipInStaticMode } from '../fixtures/auth.fixture';
import { gotoWorkarea, saveProject } from '../helpers/workarea-helpers';

/**
 * E2E coverage for the online-mode "/projects" landing page (PR #1460).
 *
 * The page is online-only: in offline/static mode "/projects" redirects to the
 * workarea, so every test here is skipped in static mode.
 */

const LOCAL_ELPX_FIXTURE = path.resolve(__dirname, '../../../fixtures/really-simple-test-project.elpx');

/** Wait until the workarea Yjs document has at least `minPages` navigation pages. */
async function waitForImportedPages(page: import('@playwright/test').Page, minPages = 1): Promise<void> {
    await page.waitForFunction(
        expectedMinPages => {
            try {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                if (!bridge) return false;
                const docManager = bridge.getDocumentManager?.();
                if (!docManager || !docManager.initialized) return false;
                const yDoc = docManager.getDoc?.();
                if (!yDoc) return false;
                const navigation = yDoc.getArray('navigation');
                return navigation && navigation.length >= expectedMinPages;
            } catch {
                return false;
            }
        },
        minPages,
        { timeout: 60000, polling: 200 },
    );
}

test.describe('Projects landing page (online mode)', () => {
    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'Projects landing page is online-only');
    });

    test('renders the landing page with actions and tabs', async ({ page }) => {
        await page.goto('/projects');
        await page.waitForURL(/\/projects/, { timeout: 30000 });

        await expect(page.locator('#btn-new-project')).toBeVisible();
        await expect(page.locator('#btn-open-file')).toBeVisible();
        await expect(page.locator('.ode-project-tab[data-tab="my-projects"]')).toBeVisible();
        await expect(page.locator('.ode-project-tab[data-tab="shared-with-me"]')).toBeVisible();
        // The list container resolves out of its loading state.
        await expect(page.locator('#project-list-container .projects-loading')).toHaveCount(0, { timeout: 15000 });
    });

    test('New Project button creates a project and opens the workarea', async ({ page }) => {
        await page.goto('/projects');
        await page.waitForURL(/\/projects/, { timeout: 30000 });

        await page.locator('#btn-new-project').click();

        await page.waitForURL(/\/workarea\?project=/, { timeout: 30000 });
        await page.waitForFunction(
            () => typeof (window as any).eXeLearning !== 'undefined' && (window as any).eXeLearning.app !== undefined,
            undefined,
            { timeout: 30000 },
        );
    });

    test('Open from file imports an .elpx and lands in the workarea with content', async ({ page }) => {
        await page.goto('/projects');
        await page.waitForURL(/\/projects/, { timeout: 30000 });

        // Drive the hidden file input directly (clicking the button would open a
        // native file chooser). This triggers the same change handler.
        await page.locator('#file-input').setInputFiles(LOCAL_ELPX_FIXTURE);

        // The handler stashes the file, creates a project, and navigates to the
        // workarea with pendingImport=1; the workarea imports it client-side.
        await page.waitForURL(/\/workarea\?project=/, { timeout: 30000 });
        await page.waitForFunction(
            () => typeof (window as any).eXeLearning !== 'undefined' && (window as any).eXeLearning.app !== undefined,
            undefined,
            { timeout: 30000 },
        );

        await waitForImportedPages(page, 1);
    });

    test('lists a saved project and can delete it', async ({ page }) => {
        const title = `Projects Page Spec ${Date.now()}`;
        const createResponse = await page.request.post('/api/project/create-quick', {
            data: { title },
            headers: { 'Content-Type': 'application/json' },
        });
        expect(createResponse.ok()).toBeTruthy();
        const { uuid } = await createResponse.json();

        // The saved-projects list only shows projects saved at least once, so open
        // the new project in the workarea and save it before checking the list.
        await gotoWorkarea(page, uuid);
        await saveProject(page);

        await page.goto('/projects');
        await page.waitForURL(/\/projects/, { timeout: 30000 });

        // The saved project shows in the My Projects list.
        const row = page.locator('.ode-row', { hasText: title });
        await expect(row.first()).toBeVisible({ timeout: 15000 });

        // Delete it (the page uses a native confirm) -> the row disappears.
        page.once('dialog', dialog => dialog.accept());
        await row.first().locator('.action-delete').click();
        await expect(page.locator('.ode-row', { hasText: title })).toHaveCount(0, { timeout: 15000 });
    });
});
