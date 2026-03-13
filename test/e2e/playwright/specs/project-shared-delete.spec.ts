import { test, expect, Browser, Page } from '@playwright/test';
import { OpenProjectModalPage } from '../pages/open-project-modal.page';
import { ShareModalPage } from '../pages/share-modal.page';
import { waitForLoadingScreenHidden } from '../fixtures/auth.fixture';

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
        () => {
            return typeof (window as any).eXeLearning !== 'undefined' && (window as any).eXeLearning.app !== undefined;
        },
        undefined,
        { timeout: 30000 },
    );
    await waitForLoadingScreenHidden(page);

    return { context, page };
}

async function createUserAsAdmin(page: Page, email: string, password: string): Promise<void> {
    const response = await page.request.post('/api/admin/users', {
        data: {
            email,
            password,
            roles: ['ROLE_USER'],
        },
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

async function openProjectModal(page: Page): Promise<OpenProjectModalPage> {
    const modal = new OpenProjectModalPage(page);

    const fileMenu = page.locator('[data-menu="file"], .navbar-file, #navbarFile');
    if ((await fileMenu.count()) > 0) {
        await fileMenu.first().click();
        const openOption = page.locator('[data-action="open-user-ode-files"], .open-user-ode-files');
        await openOption.first().click();
    } else {
        await page.evaluate(() => {
            (window as any).eXeLearning?.app?.menus?.navbar?.file?.openUserOdeFilesEvent?.();
        });
    }

    await modal.waitForOpen();
    return modal;
}

test.describe('Shared Project Delete Protection', () => {
    test('collaborator cannot delete a shared project and shared tab exposes no delete affordances', async ({
        browser,
        page: adminPage,
    }, testInfo) => {
        if (testInfo.project.name.includes('static')) {
            test.skip(true, 'Requires server routes, auth, and collaboration features');
        }

        const baseURL = String(testInfo.project.use.baseURL || process.env.E2E_BASE_URL || 'http://localhost:3001');
        const timestamp = Date.now();
        const ownerEmail = `owner-${timestamp}@example.com`;
        const collaboratorEmail = `collaborator-${timestamp}@example.com`;
        const password = 'ProjectDelete123!';
        const projectTitle = `Shared Delete ${timestamp}`;

        const adminLoginResponse = await adminPage.request.post('/api/auth/login', {
            data: {
                email: 'admin@exelearning.test',
                password: 'AdminPass123!',
            },
            timeout: 30000,
        });
        expect(adminLoginResponse.ok()).toBeTruthy();

        await createUserAsAdmin(adminPage, ownerEmail, password);
        await createUserAsAdmin(adminPage, collaboratorEmail, password);

        const ownerSession = await loginAsUser(browser, baseURL, ownerEmail, password);
        const collaboratorSession = await loginAsUser(browser, baseURL, collaboratorEmail, password);
        const shareModal = new ShareModalPage(ownerSession.page);

        try {
            const projectUuid = await createProject(ownerSession.page, projectTitle);

            await ownerSession.page.goto(`/workarea?project=${projectUuid}`);
            await ownerSession.page.waitForURL(new RegExp(`/workarea\\?project=${projectUuid}`), { timeout: 30000 });
            await waitForLoadingScreenHidden(ownerSession.page);

            await ownerSession.page
                .locator('#head-top-share-button, .btn-share-pill, [data-action="share"]')
                .first()
                .click();
            await shareModal.waitForOpen();
            await shareModal.inviteCollaborator(collaboratorEmail);
            await ownerSession.page.waitForTimeout(1000);
            expect(await shareModal.getInviteError()).toBe('');
            await shareModal.close();

            const collaboratorModal = await openProjectModal(collaboratorSession.page);
            await collaboratorModal.clickSharedWithMeTab();
            await collaboratorModal.waitForProjectInList(projectTitle, 20000);

            const collaboratorProjectId = await collaboratorModal.getProjectOdeIdByTitle(projectTitle);
            expect(collaboratorProjectId).toBe(projectUuid);
            expect(await collaboratorModal.getVisibleCheckboxCount()).toBe(0);
            expect(await collaboratorModal.projectHasDeleteAction(projectUuid)).toBe(false);
            expect(await collaboratorModal.hasFooterDeleteButton()).toBe(false);
            expect(await collaboratorModal.projectHasOwnerInfo(projectUuid)).toBe(true);

            const forcedDeleteResponse = await collaboratorSession.page.request.fetch(
                `/api/projects/uuid/${projectUuid}`,
                {
                    method: 'DELETE',
                },
            );
            expect(forcedDeleteResponse.status()).toBe(403);
            const forcedDeleteBody = await forcedDeleteResponse.json();
            expect(forcedDeleteBody.responseMessage).toBe('FORBIDDEN');

            const ownerModal = await openProjectModal(ownerSession.page);
            await ownerModal.clickMyProjectsTab();
            await ownerModal.waitForProjectInList(projectTitle, 10000);
            const ownerProjectId = await ownerModal.getProjectOdeIdByTitle(projectTitle);
            expect(ownerProjectId).toBe(projectUuid);
            expect(await ownerModal.projectHasDeleteAction(projectUuid)).toBe(true);
        } finally {
            await collaboratorSession.context.close();
            await ownerSession.context.close();
        }
    });
});
