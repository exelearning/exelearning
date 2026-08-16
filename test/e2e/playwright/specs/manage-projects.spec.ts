import { test as authTest } from '../fixtures/auth.fixture';
import { expect, Page } from '@playwright/test';
import { saveProject } from '../helpers/workarea-helpers';
import { ManageProjectsModalPage } from '../pages/manage-projects-modal.page';

/**
 * E2E tests for "Gestionar proyectos" — the File-menu surface exclusive to
 * folder management (create/rename/delete/reparent via drag-and-drop or
 * "Move to…") plus the same project actions (open/rename/duplicate/delete)
 * "Abrir" has. Folder *browsing* from "Abrir" is covered separately in
 * project-folders.spec.ts; this file focuses on what only exists here.
 */

async function openManageProjectsModal(page: Page): Promise<ManageProjectsModalPage> {
    const toastCloseButtons = page.locator('.toast .btn-close, .toast-container .btn-close');
    const toastCount = await toastCloseButtons.count();
    for (let i = 0; i < toastCount; i++) {
        await toastCloseButtons
            .nth(i)
            .click()
            .catch(() => {});
    }
    if (toastCount > 0) {
        await page.waitForTimeout(300);
    }

    await page.locator('#dropdownFile').click();
    await page.waitForTimeout(300);

    const menuOption = page.locator('#navbar-button-manageprojects');
    await menuOption.waitFor({ state: 'visible', timeout: 5000 });
    await menuOption.click();

    const modal = new ManageProjectsModalPage(page);
    await modal.waitForOpen();
    return modal;
}

authTest.describe('Manage Projects', () => {
    authTest.setTimeout(90000);

    authTest.beforeEach(({}, testInfo) => {
        if (testInfo.project.name.includes('static')) {
            authTest.skip(true, 'Skipped in static mode: personal folders/manage projects require the server API');
        }
    });

    authTest('opens from the File menu and shows the folder tree and project list', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        await saveProject(page);

        const modal = await openManageProjectsModal(page);
        await modal.clickMyProjectsTab();

        expect(await modal.folderTree.isVisible()).toBe(true);
        expect(await modal.getFolderTreeLabels()).toEqual(expect.arrayContaining(['All projects', 'Unfiled']));
        expect(await modal.getVisibleProjectCount()).toBeGreaterThan(0);
    });

    authTest('creates, renames, and deletes a folder', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        const modal = await openManageProjectsModal(page);
        await modal.clickMyProjectsTab();

        const suffix = Date.now();
        const folderName = `E2E Folder ${suffix}`;
        await modal.createFolder(folderName);

        const folderUuid = await modal.getFolderTreeValueByName(folderName);
        expect(folderUuid).toBeTruthy();

        const renamedName = `E2E Folder Renamed ${suffix}`;
        await modal.renameFolder(folderUuid!, renamedName);
        expect(await modal.getFolderTreeValueByName(renamedName)).toBe(folderUuid);
        expect(await modal.getFolderTreeValueByName(folderName)).toBeNull();

        await modal.deleteFolder(folderUuid!);
        await modal.expectFolderNotInTree(renamedName);
    });

    authTest('creates a nested subfolder and reparents it via drag-and-drop', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        const modal = await openManageProjectsModal(page);
        await modal.clickMyProjectsTab();

        const suffix = Date.now();
        const parentA = `Parent A ${suffix}`;
        const parentB = `Parent B ${suffix}`;
        const child = `Child ${suffix}`;

        await modal.createFolder(parentA);
        await modal.createFolder(parentB);
        const parentAUuid = await modal.getFolderTreeValueByName(parentA);
        await modal.createFolder(child, parentA);

        const childUuid = await modal.getFolderTreeValueByName(child);
        expect(childUuid).toBeTruthy();
        expect(await modal.getFolderTreeDepth(childUuid!)).toBe(1);

        // Expand Parent A so the child row is visible for the drag, then drag
        // it onto Parent B to reparent.
        await modal.toggleFolderInTree(parentAUuid!);
        const parentBUuid = await modal.getFolderTreeValueByName(parentB);
        await modal.dragFolderOnto(childUuid!, parentBUuid!);

        expect(await modal.getFolderTreeDepth(childUuid!)).toBe(1);
        await modal.toggleFolderInTree(parentBUuid!);
        expect(await modal.getFolderTreeValueByName(child)).toBe(childUuid);
    });

    authTest('reparents a folder via the "Move to…" button', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        const modal = await openManageProjectsModal(page);
        await modal.clickMyProjectsTab();

        const suffix = Date.now();
        const source = `MoveSource ${suffix}`;
        const dest = `MoveDest ${suffix}`;
        await modal.createFolder(source);
        await modal.createFolder(dest);

        const sourceUuid = await modal.getFolderTreeValueByName(source);
        await modal.moveFolderViaButton(sourceUuid!, dest);

        expect(await modal.getFolderTreeDepth(sourceUuid!)).toBe(1);
        const destUuid = await modal.getFolderTreeValueByName(dest);
        await modal.toggleFolderInTree(destUuid!);
        expect(await modal.getFolderTreeValueByName(source)).toBe(sourceUuid);
    });

    authTest('renames and duplicates a project from its row actions', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        await saveProject(page);

        const modal = await openManageProjectsModal(page);
        await modal.clickMyProjectsTab();

        const odeId = await page.evaluate(() => {
            const firstRow = document.querySelector('.ode-files-list .ode-row');
            return firstRow?.getAttribute('ode-id') || '';
        });
        expect(odeId).toBeTruthy();

        const suffix = Date.now();
        const newTitle = `Managed Rename ${suffix}`;
        await modal.renameProject(odeId!, newTitle);
        await modal.waitForProjectInList(newTitle, 10000);
        expect(await modal.getProjectOdeIdByTitle(newTitle)).toBe(odeId);

        await modal.clickDuplicateForProject(odeId!);
        await modal.waitForProjectInList(`${newTitle} (copy)`, 10000);

        // Count only groups whose title contains this test's own (unique,
        // timestamped) title — the shared per-worker guest account may
        // carry other projects saved by an earlier spec on the same worker.
        const matchingGroups = modal.projectList.locator('.ode-group', { hasText: newTitle });
        expect(await matchingGroups.count()).toBe(2);
    });

    authTest('files a project into a folder via its row move picker', async ({ authenticatedPage }) => {
        // Regression test: showFolderPicker/moveProjectToFolder used to
        // exist only on "Abrir" (modalOpenUserOdeFiles.js) — the shared row
        // renderer wires every project row's move button to
        // this.showFolderPicker(...), but "Manage Projects" never got its
        // own copy, so clicking it here threw silently and did nothing.
        const page = authenticatedPage;
        await saveProject(page);

        const suffix = Date.now();
        const folderName = `MoveTarget ${suffix}`;
        const createRes = await page.request.post('/api/projects/folders', {
            data: { name: folderName, parentFolderUuid: null },
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000,
        });
        expect(createRes.ok()).toBeTruthy();

        const modal = await openManageProjectsModal(page);
        await modal.clickMyProjectsTab();

        const odeId = await page.evaluate(() => {
            const firstRow = document.querySelector('.ode-files-list .ode-row');
            return firstRow?.getAttribute('ode-id') || '';
        });
        expect(odeId).toBeTruthy();

        await modal.openFolderPicker(odeId!);
        expect(await modal.getFolderPickerOptionTexts()).toEqual(expect.arrayContaining(['Unfiled', folderName]));
        await modal.moveProjectToFolder(odeId!, folderName);

        const listResponse = await page.request.get('/api/projects/user/list');
        const listBody = await listResponse.json();
        const entry = (listBody.odeFiles.odeFilesSync as Array<{ odeId: string; folderId: string | null }>).find(
            p => p.odeId === odeId,
        );
        const folderUuid = await modal.getFolderTreeValueByName(folderName);
        expect(entry?.folderId).toBe(folderUuid);
    });

    authTest('moves several checked projects to a folder in one go', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        await saveProject(page);

        const suffix = Date.now();
        const folderName = `BulkTarget ${suffix}`;
        await page.request.post('/api/projects/folders', {
            data: { name: folderName, parentFolderUuid: null },
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000,
        });

        const modal = await openManageProjectsModal(page);
        await modal.clickMyProjectsTab();

        const firstOdeId = await page.evaluate(() => {
            const firstRow = document.querySelector('.ode-files-list .ode-row');
            return firstRow?.getAttribute('ode-id') || '';
        });
        expect(firstOdeId).toBeTruthy();

        // A second project so there's more than one to check — create-quick
        // alone doesn't make a project appear in the dashboard list (it needs
        // an actual save), so duplicate the existing saved one instead.
        await modal.clickDuplicateForProject(firstOdeId!);
        await modal.waitForProjectInList('(copy)', 10000);

        const odeIds = await page.evaluate(() =>
            Array.from(document.querySelectorAll('.ode-files-list .ode-row')).map(row => row.getAttribute('ode-id')),
        );
        expect(odeIds.length).toBeGreaterThanOrEqual(2);

        await expect(modal.moveSelectedButton).toBeHidden();
        for (const odeId of odeIds) {
            await modal.checkProject(odeId!);
        }
        await expect(modal.moveSelectedButton).toBeVisible();

        await modal.bulkMoveSelectedToFolder(folderName);

        const listResponse = await page.request.get('/api/projects/user/list');
        const listBody = await listResponse.json();
        const entries = listBody.odeFiles.odeFilesSync as Array<{ odeId: string; folderId: string | null }>;
        const folderUuid = await modal.getFolderTreeValueByName(folderName);
        for (const odeId of odeIds) {
            expect(entries.find(p => p.odeId === odeId)?.folderId).toBe(folderUuid);
        }
    });

    authTest(
        'cancelling the rename-project dialog leaves the dashboard modal open and usable',
        async ({ authenticatedPage }) => {
            // Regression test: eXeLearning.app.modals.confirm.show() closes
            // every other open modal; the rename-project dialog's confirmExec
            // used to re-show the dashboard modal, but cancelling (or closing
            // via Escape/backdrop) never ran confirmExec, so the dashboard
            // modal was left closed with no way back to it.
            const page = authenticatedPage;
            await saveProject(page);

            const modal = await openManageProjectsModal(page);
            await modal.clickMyProjectsTab();

            const odeId = await page.evaluate(() => {
                const firstRow = document.querySelector('.ode-files-list .ode-row');
                return firstRow?.getAttribute('ode-id') || '';
            });
            expect(odeId).toBeTruthy();

            await modal.clickRenameForProject(odeId!);
            await page.locator('#modalConfirm #input-rename-ode-project').waitFor({ state: 'visible', timeout: 5000 });
            await modal.cancelConfirmDialog();

            await expect(modal.modal).toBeVisible();
            // The modal isn't just visible but actually usable again — able
            // to open the same dialog a second time.
            await modal.clickRenameForProject(odeId!);
            await expect(page.locator('#modalConfirm #input-rename-ode-project')).toBeVisible();
            await modal.cancelConfirmDialog();
        },
    );

    authTest(
        'cancelling the create-folder dialog leaves the dashboard modal open and usable',
        async ({ authenticatedPage }) => {
            // Same regression as above, for the folder-management dialogs
            // exclusive to "Manage Projects" (projectFolderActions.js).
            const page = authenticatedPage;
            const modal = await openManageProjectsModal(page);
            await modal.clickMyProjectsTab();

            await modal.newFolderButton.click();
            await page.locator('#modalConfirm #input-new-ode-folder').waitFor({ state: 'visible', timeout: 5000 });
            await modal.cancelConfirmDialog();

            await expect(modal.modal).toBeVisible();
            await expect(modal.newFolderButton).toBeVisible();
        },
    );

    authTest('deletes a project from its row action', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        // A project only shows up in the dashboard list once it's actually
        // been saved (create-quick alone isn't enough — see the equivalent
        // saveProject() step in project-folders.spec.ts's collaboration test).
        await saveProject(page);

        const modal = await openManageProjectsModal(page);
        await modal.clickMyProjectsTab();

        const odeId = await page.evaluate(() => {
            const firstRow = document.querySelector('.ode-files-list .ode-row');
            return firstRow?.getAttribute('ode-id') || '';
        });
        expect(odeId).toBeTruthy();

        await modal.clickDeleteForProject(odeId!);
        await modal.confirmInlineDelete(odeId!);

        const listResponse = await page.request.get('/api/projects/user/list');
        const listBody = await listResponse.json();
        const stillExists = (listBody.odeFiles.odeFilesSync as Array<{ odeId: string }>).some(p => p.odeId === odeId);
        expect(stillExists).toBe(false);
    });

    authTest.describe('small screens', () => {
        authTest.use({ viewport: { width: 390, height: 844 } });

        // The desktop File menu (#dropdownFile) is hidden at this viewport
        // width — open via the mobile user menu instead.
        async function openManageProjectsModalMobile(page: Page): Promise<ManageProjectsModalPage> {
            await page.locator('#exeUserMenuToggler').click();
            await page.locator('#mobile-navbar-button-manageprojects').click();
            const modal = new ManageProjectsModalPage(page);
            await modal.waitForOpen();
            return modal;
        }

        authTest('is reachable from the mobile user menu', async ({ authenticatedPage }) => {
            const page = authenticatedPage;
            await saveProject(page);

            await page.locator('#exeUserMenuToggler').click();
            const menuOption = page.locator('#mobile-navbar-button-manageprojects');
            await expect(menuOption).toBeVisible();
            await menuOption.click();

            const modal = new ManageProjectsModalPage(page);
            await modal.waitForOpen();
            expect(await modal.folderTree.isVisible()).toBe(true);
        });

        authTest(
            'stacks the folder sidebar above the project list instead of beside it',
            async ({ authenticatedPage }) => {
                // Regression test: a fixed-width left sidebar next to a project
                // list is unusable on a narrow screen — both get squeezed. Below
                // the md breakpoint the sidebar becomes a bounded-height panel
                // above the list instead of a column beside it.
                const page = authenticatedPage;
                await saveProject(page);

                const modal = await openManageProjectsModalMobile(page);
                await modal.clickMyProjectsTab();

                const sidebarBox = await page.locator('.modal-dashboard-sidebar').boundingBox();
                const listBox = await page.locator('.modal-actions').boundingBox();
                expect(sidebarBox).not.toBeNull();
                expect(listBox).not.toBeNull();
                // Stacked, not side-by-side: the sidebar sits fully above the
                // tabs/search header instead of sharing its vertical range.
                expect(sidebarBox!.y + sidebarBox!.height).toBeLessThanOrEqual(listBox!.y + 1);
            },
        );

        authTest(
            "reveals a folder's move/rename/delete buttons only once it is selected",
            async ({ authenticatedPage }) => {
                // Regression test: those buttons are hover-revealed on desktop
                // (visibility: hidden by default) to keep the tree uncluttered,
                // but touch devices have no reliable hover state, so tapping a
                // folder to select it never revealed them at all. Below the
                // breakpoint they become visible for the selected folder only
                // — not every folder at once, which would be cluttered.
                const page = authenticatedPage;

                const suffix = Date.now();
                const folderAName = `Small Screen A ${suffix}`;
                const folderBName = `Small Screen B ${suffix}`;
                await page.request.post('/api/projects/folders', {
                    data: { name: folderAName, parentFolderUuid: null },
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 30000,
                });
                await page.request.post('/api/projects/folders', {
                    data: { name: folderBName, parentFolderUuid: null },
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 30000,
                });

                const modal = await openManageProjectsModalMobile(page);
                await modal.clickMyProjectsTab();

                const rowA = page.locator('.project-folder-tree-item', { hasText: folderAName }).first();
                const rowB = page.locator('.project-folder-tree-item', { hasText: folderBName }).first();

                // Before selecting anything, neither folder's buttons are visible.
                await expect(rowA.locator('.project-folder-tree-move-button')).toBeHidden();
                await expect(rowB.locator('.project-folder-tree-move-button')).toBeHidden();

                await rowA.locator('.project-folder-tree-row').click();

                await expect(rowA.locator('.project-folder-tree-move-button')).toBeVisible();
                await expect(rowA.locator('.project-folder-tree-rename-button')).toBeVisible();
                await expect(rowA.locator('.project-folder-tree-delete-button')).toBeVisible();
                await expect(rowB.locator('.project-folder-tree-move-button')).toBeHidden();
            },
        );
    });
});
