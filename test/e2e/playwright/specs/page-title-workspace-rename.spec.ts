import { test, expect } from '../fixtures/auth.fixture';
import {
    waitForAppReady,
    gotoWorkarea,
    selectNavNode,
    selectFirstPage,
    saveProject,
    reloadPage,
} from '../helpers/workarea-helpers';

/**
 * E2E Tests for renaming the page title directly from the editing workspace.
 *
 * Covers issue #1600: clicking the workspace page title
 * (<h1 data-testid="page-title">) or its pencil button enters inline edit mode
 * and renames the current page through the same canonical path as the
 * structure-tree rename, keeping the workspace heading, the structure tree and
 * the underlying model in sync.
 */
test.describe('Workspace page title rename', () => {
    /**
     * Read the id of the first navigation page.
     */
    async function getFirstPageId(page: import('@playwright/test').Page): Promise<string> {
        return page.evaluate(() => {
            const project = (window as any).eXeLearning.app.project;
            const nav = project._yjsBridge.documentManager.getNavigation();
            return nav.get(0).get('id');
        });
    }

    /**
     * Read the pageName stored in the Yjs model for a given page id.
     */
    async function getModelPageName(page: import('@playwright/test').Page, pageId: string): Promise<string | null> {
        return page.evaluate(id => {
            const project = (window as any).eXeLearning.app.project;
            const nav = project._yjsBridge.documentManager.getNavigation();
            for (let i = 0; i < nav.length; i++) {
                const p = nav.get(i);
                if (p.get('id') === id) return p.get('pageName');
            }
            return null;
        }, pageId);
    }

    /**
     * Ensure the first page is selected and its title is rendered in the
     * workspace heading with a known value. Returns the first page id.
     */
    async function prepareFirstPage(page: import('@playwright/test').Page): Promise<string> {
        const firstId = await getFirstPageId(page);
        // Give the page a known, visible title through the canonical rename path.
        await page.evaluate(id => {
            (window as any).eXeLearning.app.project.renamePageViaYjs(id, 'New page');
        }, firstId);
        // renamePageViaYjs re-renders the structure nav asynchronously, recreating
        // the page node. Wait for that re-render to settle (the renamed node shows
        // the new text) before selectFirstPage interacts with it, otherwise the
        // selection races the re-render. The page name renders in `.node-text-span`
        // (the `.nav-element-text` container also holds the icon node).
        await expect(page.locator(`.nav-element[nav-id="${firstId}"] .node-text-span`)).toHaveText('New page');
        await selectFirstPage(page);
        // Force the workspace heading to render from the (updated) model.
        await page.evaluate(id => {
            (window as any).eXeLearning.app.project.idevices.setNodeContentPageTitle(id);
        }, firstId);
        await expect(page.locator('[data-testid="page-title"]')).toHaveText('New page');
        return firstId;
    }

    /**
     * Enter edit mode on the workspace title and replace its content.
     */
    async function editWorkspaceTitle(
        page: import('@playwright/test').Page,
        newText: string,
        confirmKey: 'Enter' | 'Escape',
        { clearOnly = false }: { clearOnly?: boolean } = {},
    ): Promise<void> {
        const title = page.locator('[data-testid="page-title"]');
        await title.click();
        await expect(title).toHaveAttribute('contenteditable', 'true');
        await page.keyboard.press('ControlOrMeta+A');
        if (clearOnly) {
            await page.keyboard.press('Delete');
        } else {
            await page.keyboard.type(newText);
        }
        await page.keyboard.press(confirmKey);
    }

    test('renames the page from the workspace, syncing the tree and model', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Workspace Title Rename');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const firstId = await prepareFirstPage(page);
        const title = page.locator('[data-testid="page-title"]');

        // Click the title and rename it.
        await editWorkspaceTitle(page, 'Renamed from workspace', 'Enter');

        // Workspace heading reflects the new title and leaves edit mode.
        await expect(title).toHaveText('Renamed from workspace');
        await expect(title).not.toHaveAttribute('contenteditable', 'true');

        // Structure tree shows the new title.
        const navText = page.locator(`.nav-element[nav-id="${firstId}"] .node-text-span`);
        await expect(navText).toHaveText('Renamed from workspace');

        // Underlying model carries the new title (single source of truth).
        await expect.poll(() => getModelPageName(page, firstId)).toBe('Renamed from workspace');

        // Persistence across page switches: add a second page, switch away and back.
        const secondId = await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const newPage = bridge.structureBinding.addPage('Second page', null);
            return newPage.id || newPage.pageId;
        });
        await page.waitForTimeout(300);
        await selectNavNode(page, secondId);
        await selectNavNode(page, firstId);
        await expect(title).toHaveText('Renamed from workspace');

        // Persistence across save + reload (Yjs snapshot).
        await saveProject(page);
        await reloadPage(page);
        await waitForAppReady(page);
        await selectFirstPage(page);
        await page.evaluate(id => {
            (window as any).eXeLearning.app.project.idevices.setNodeContentPageTitle(id);
        }, firstId);
        await expect(page.locator('[data-testid="page-title"]')).toHaveText('Renamed from workspace');
    });

    test('Escape cancels editing and keeps the previous title', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Workspace Title Escape');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const firstId = await prepareFirstPage(page);
        const title = page.locator('[data-testid="page-title"]');

        await editWorkspaceTitle(page, 'Discarded title', 'Escape');

        // The previous title is preserved everywhere.
        await expect(title).toHaveText('New page');
        await expect(title).not.toHaveAttribute('contenteditable', 'true');
        await expect(page.locator(`.nav-element[nav-id="${firstId}"] .node-text-span`)).toHaveText('New page');
        await expect.poll(() => getModelPageName(page, firstId)).toBe('New page');
    });

    test('rejects an empty title and restores the previous value', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Workspace Title Empty');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const firstId = await prepareFirstPage(page);
        const title = page.locator('[data-testid="page-title"]');

        // Clear all text and confirm: empty titles must be rejected.
        await editWorkspaceTitle(page, '', 'Enter', { clearOnly: true });

        await expect(title).toHaveText('New page');
        await expect(title).not.toHaveAttribute('contenteditable', 'true');
        await expect.poll(() => getModelPageName(page, firstId)).toBe('New page');
    });

    test('enters inline edit mode from the pencil edit button', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Workspace Title Pencil');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await prepareFirstPage(page);
        const title = page.locator('[data-testid="page-title"]');
        const editButton = page.locator('.content-editable-title .btn-edit-title');

        // The pencil button carries the same "enter inline edit mode" handler as the
        // title itself (see initPageTitleInlineRename). It is only revealed on hover
        // via a pure-CSS opacity transition and stays pointer-events:none until then,
        // so a real hover+click is animation/pointer-timing dependent and flaky under
        // load. Dispatch the click straight to the button to assert the handler is
        // wired, independent of the reveal animation and the compiled stylesheet.
        await editButton.dispatchEvent('click');
        await expect(title).toHaveAttribute('contenteditable', 'true');
    });
});
