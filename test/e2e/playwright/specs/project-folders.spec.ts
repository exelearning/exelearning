import { test as authTest } from '../fixtures/auth.fixture';
import { test, expect, Browser, Page } from '@playwright/test';
import { saveProject } from '../helpers/workarea-helpers';
import { waitForLoadingScreenHidden } from '../fixtures/auth.fixture';
import { OpenProjectModalPage } from '../pages/open-project-modal.page';

/**
 * E2E tests for how "Abrir" (the quick-open dashboard modal) surfaces
 * personal folders: browsing the read-only folder tree, filtering the
 * project list by folder, moving a project into a folder, and renaming/
 * duplicating a project from its row.
 *
 * Folder *management* (create/rename/delete/reparent a folder) is exclusive
 * to "Gestionar proyectos" and is covered in manage-projects.spec.ts —
 * "Abrir" only navigates folders that already exist, so every test here
 * seeds folders directly via the API rather than clicking through a
 * create-folder UI that no longer exists in this modal.
 *
 * Also verifies the core per-user design decision carried over from the
 * flat-folders phase: two users filing the same shared project into
 * differently-named folders of their own don't affect each other.
 */

async function openProjectModal(page: Page): Promise<OpenProjectModalPage> {
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

    const openOption = page.locator('#navbar-button-openuserodefiles');
    await openOption.waitFor({ state: 'visible', timeout: 5000 });
    await openOption.click();

    const modal = new OpenProjectModalPage(page);
    await modal.waitForOpen();
    return modal;
}

async function createFolderViaApi(
    page: Page,
    name: string,
    parentFolderUuid: string | null = null,
): Promise<{ uuid: string; name: string }> {
    const res = await page.request.post('/api/projects/folders', {
        data: { name, parentFolderUuid },
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    return body.folder;
}

authTest.describe('Project Folders - browsing and filing via "Abrir"', () => {
    authTest.setTimeout(90000);

    authTest.beforeEach(({}, testInfo) => {
        if (testInfo.project.name.includes('static')) {
            authTest.skip(true, 'Skipped in static mode: personal folders require the server API');
        }
    });

    authTest(
        'shows folders in the tree, filters the list on selection, and files a project via the move picker',
        async ({ authenticatedPage }) => {
            const page = authenticatedPage;
            await saveProject(page);

            const suffix = Date.now();
            const rootFolder = await createFolderViaApi(page, `Root ${suffix}`);
            const childFolder = await createFolderViaApi(page, `Child ${suffix}`, rootFolder.uuid);

            const modal = await openProjectModal(page);
            await modal.clickMyProjectsTab();

            const odeId = await page.evaluate(() => {
                const firstRow = document.querySelector('.ode-files-list .ode-row');
                return firstRow?.getAttribute('ode-id') || '';
            });
            expect(odeId).toBeTruthy();

            // Tree shows the two pseudo-items plus both real folders, nested
            // correctly. Uses arrayContaining rather than an exact match:
            // guest accounts are scoped per Playwright worker, so a worker
            // that also ran another folder-creating spec earlier may still
            // have those unrelated folders sitting in the same tree.
            const labels = await modal.getFolderTreeLabels();
            expect(labels).toEqual(
                expect.arrayContaining(['All projects', 'Unfiled', `Root ${suffix} (0)`, `Child ${suffix} (0)`]),
            );
            expect(await modal.getFolderTreeDepth(rootFolder.uuid)).toBe(0);
            expect(await modal.getFolderTreeDepth(childFolder.uuid)).toBe(1);

            // The tree starts collapsed — the child isn't reachable until its
            // parent is expanded.
            await modal.toggleFolderInTree(rootFolder.uuid);

            // Selecting the child folder filters the (currently empty) list
            await modal.selectFolderInTree(childFolder.uuid);
            expect(await modal.getSelectedFolderTreeValue()).toBe(childFolder.uuid);
            expect(await modal.getVisibleProjectCount()).toBe(0);

            // File the project via the existing per-row move picker
            await modal.selectFolderInTree('');
            await modal.moveProjectToFolder(odeId!, `Child ${suffix}`);

            await modal.selectFolderInTree(childFolder.uuid);
            expect(await modal.getVisibleProjectCount()).toBe(1);

            // Verify system state via the API too
            const listResponse = await page.request.get('/api/projects/user/list');
            const listBody = await listResponse.json();
            const entry = (listBody.odeFiles.odeFilesSync as Array<{ odeId: string; folderId: string | null }>).find(
                p => p.odeId === odeId,
            );
            expect(entry?.folderId).toBe(childFolder.uuid);
        },
    );

    authTest('renames and duplicates a project from its row actions', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        await saveProject(page);

        const modal = await openProjectModal(page);
        await modal.clickMyProjectsTab();

        const odeId = await page.evaluate(() => {
            const firstRow = document.querySelector('.ode-files-list .ode-row');
            return firstRow?.getAttribute('ode-id') || '';
        });
        expect(odeId).toBeTruthy();

        const suffix = Date.now();
        const newTitle = `Renamed Project ${suffix}`;
        await modal.renameProject(odeId!, newTitle);

        await modal.waitForProjectInList(newTitle, 10000);
        const renamedOdeId = await modal.getProjectOdeIdByTitle(newTitle);
        expect(renamedOdeId).toBe(odeId);

        await modal.clickDuplicateForProject(odeId!);
        await modal.waitForProjectInList(`${newTitle} (copy)`, 10000);

        // Count only groups whose title contains this test's own (unique,
        // timestamped) title rather than the modal's total visible-project
        // count — getVisibleProjectCount() counts every .ode-group in the
        // DOM regardless of the search filter (it hides non-matches via
        // CSS, it doesn't remove them), and the shared per-worker guest
        // account may carry other projects saved by an earlier spec on the
        // same worker.
        const matchingGroups = modal.projectList.locator('.ode-group', { hasText: newTitle });
        expect(await matchingGroups.count()).toBe(2);
    });

    authTest(
        'cancelling the rename-project dialog leaves the dashboard modal open and usable',
        async ({ authenticatedPage }) => {
            // Regression test: eXeLearning.app.modals.confirm.show() closes
            // every other open modal; the rename-project dialog's confirmExec
            // used to re-show the dashboard modal, but cancelling (or closing
            // via Escape/backdrop) never ran confirmExec, so the dashboard
            // modal was left closed with no way back to it. Shared behavior
            // between "Abrir" and "Manage Projects" via ProjectListRenderMixin
            // — see manage-projects.spec.ts for the equivalent test there.
            const page = authenticatedPage;
            await saveProject(page);

            const modal = await openProjectModal(page);
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
            await modal.clickRenameForProject(odeId!);
            await expect(page.locator('#modalConfirm #input-rename-ode-project')).toBeVisible();
            await modal.cancelConfirmDialog();
        },
    );

    authTest('reflects deeper nesting in the tree without any depth limit in the UI', async ({ authenticatedPage }) => {
        const page = authenticatedPage;
        const modal = await openProjectModal(page);
        await modal.clickMyProjectsTab();

        const suffix = Date.now();
        let parentUuid: string | null = null;
        const names = Array.from({ length: 5 }, (_, i) => `DeepNest${i} ${suffix}`);
        for (const name of names) {
            const folder = await createFolderViaApi(page, name, parentUuid);
            parentUuid = folder.uuid;
        }

        // Re-open the modal so it picks up the freshly seeded folders
        await modal.close();
        const reopened = await openProjectModal(page);
        await reopened.clickMyProjectsTab();

        for (let depth = 0; depth < names.length; depth++) {
            const value = await reopened.getFolderTreeValueByName(names[depth]);
            expect(value).toBeTruthy();
            expect(await reopened.getFolderTreeDepth(value!)).toBe(depth);
        }
    });
});

// ─── Personal-scope collaboration test ───

async function loginAsUser(browser: Browser, baseURL: string, email: string, password: string) {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    const loginResponse = await page.request.post('/api/auth/login', {
        data: { email, password },
        timeout: 30000,
    });
    expect(loginResponse.ok()).toBeTruthy();

    await page.goto('/workarea');
    await page.waitForURL(/\/workarea/, { timeout: 30000 });
    await page.waitForFunction(
        () => typeof (window as any).eXeLearning !== 'undefined' && (window as any).eXeLearning.app !== undefined,
        undefined,
        { timeout: 30000 },
    );
    await waitForLoadingScreenHidden(page);

    return { context, page };
}

async function createUserAsAdmin(page: Page, email: string, password: string): Promise<void> {
    const response = await page.request.post('/api/admin/users', {
        data: { email, password, roles: ['ROLE_USER'] },
        timeout: 30000,
    });
    expect(response.ok()).toBeTruthy();
}

async function createProject(page: Page, title: string): Promise<string> {
    const response = await page.request.post('/api/project/create-quick', {
        data: { title },
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    return data.uuid || data.projectUuid;
}

test.describe('Project Folders - personal scope across collaborators', () => {
    test('two collaborators file the same shared project into their own folders without interfering', async ({
        browser,
        page: adminPage,
    }, testInfo) => {
        if (testInfo.project.name.includes('static')) {
            test.skip(true, 'Requires server routes, auth, and collaboration features');
        }
        // Two full logins + two dashboard modal open/move cycles take longer
        // than the 45s default, especially under load.
        test.setTimeout(150000);

        const baseURL = String(testInfo.project.use.baseURL || process.env.E2E_BASE_URL || 'http://localhost:3001');
        const timestamp = Date.now();
        const ownerEmail = `folders-owner-${timestamp}@example.com`;
        const collaboratorEmail = `folders-collab-${timestamp}@example.com`;
        const password = 'ProjectFolders123!';
        const projectTitle = `Shared Folders ${timestamp}`;

        const adminLoginResponse = await adminPage.request.post('/api/auth/login', {
            data: { email: 'admin@exelearning.test', password: 'AdminPass123!' },
            timeout: 30000,
        });
        expect(adminLoginResponse.ok()).toBeTruthy();

        await createUserAsAdmin(adminPage, ownerEmail, password);
        await createUserAsAdmin(adminPage, collaboratorEmail, password);

        const ownerSession = await loginAsUser(browser, baseURL, ownerEmail, password);
        const collaboratorSession = await loginAsUser(browser, baseURL, collaboratorEmail, password);

        try {
            const projectUuid = await createProject(ownerSession.page, projectTitle);

            // Save so it shows up in the owner's dashboard
            await ownerSession.page.goto(`/workarea?project=${projectUuid}`);
            await ownerSession.page.waitForURL(new RegExp(`/workarea\\?project=${projectUuid}`), { timeout: 30000 });
            await waitForLoadingScreenHidden(ownerSession.page);
            await saveProject(ownerSession.page);

            // Share with the collaborator via the API (equivalent to the Share modal, faster/more deterministic here)
            const shareResponse = await ownerSession.page.request.post(
                `/api/projects/uuid/${projectUuid}/collaborators`,
                {
                    data: { email: collaboratorEmail },
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 30000,
                },
            );
            expect(shareResponse.ok()).toBeTruthy();

            // Owner files the project into their own folder (seeded via API — folder
            // creation itself is no longer done through "Abrir")
            const ownerFolder = await createFolderViaApi(ownerSession.page, 'Owner Folder');
            const ownerModal = await openProjectModal(ownerSession.page);
            await ownerModal.clickMyProjectsTab();
            await ownerModal.waitForProjectInList(projectTitle, 20000);
            await ownerModal.moveProjectToFolder(projectUuid, 'Owner Folder');

            // Collaborator independently files the SAME project into their own folder
            const collaboratorFolder = await createFolderViaApi(collaboratorSession.page, 'Collaborator Folder');
            const collaboratorModal = await openProjectModal(collaboratorSession.page);
            await collaboratorModal.clickSharedWithMeTab();
            await collaboratorModal.waitForProjectInList(projectTitle, 20000);
            await collaboratorModal.moveProjectToFolder(projectUuid, 'Collaborator Folder');

            // Verify independence via each user's own /api/projects/user/list view
            const ownerListResponse = await ownerSession.page.request.get('/api/projects/user/list');
            const ownerListBody = await ownerListResponse.json();
            const ownerEntry = (
                ownerListBody.odeFiles.odeFilesSync as Array<{ odeId: string; folderId: string | null }>
            ).find(p => p.odeId === projectUuid);
            expect(ownerEntry?.folderId).toBe(ownerFolder.uuid);

            const collaboratorListResponse = await collaboratorSession.page.request.get('/api/projects/user/list');
            const collaboratorListBody = await collaboratorListResponse.json();
            const collaboratorEntry = (
                collaboratorListBody.odeFiles.odeFilesSync as Array<{ odeId: string; folderId: string | null }>
            ).find(p => p.odeId === projectUuid);
            expect(collaboratorEntry?.folderId).toBe(collaboratorFolder.uuid);

            // The two folder ids belong to different personal folders and don't collide
            expect(ownerFolder.uuid).not.toBe(collaboratorFolder.uuid);

            // The owner's folder list never contains the collaborator's folder, and vice versa
            expect((ownerListBody.odeFiles.folders as Array<{ name: string }>).map(f => f.name)).toEqual([
                'Owner Folder',
            ]);
            expect((collaboratorListBody.odeFiles.folders as Array<{ name: string }>).map(f => f.name)).toEqual([
                'Collaborator Folder',
            ]);
        } finally {
            await collaboratorSession.context.close();
            await ownerSession.context.close();
        }
    });
});
