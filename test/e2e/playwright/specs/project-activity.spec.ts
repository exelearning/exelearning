import { test, expect, skipInStaticMode } from '../fixtures/collaboration.fixture';
import { ShareModalPage } from '../pages/share-modal.page';
import { waitForYjsSync } from '../helpers/sync-helpers';
import {
    addIdevice,
    addPage,
    deleteIdevice,
    editIdevice,
    getFirstBlockAndIdeviceIds,
    saveIdevice,
    saveProject,
    selectFirstPage,
    waitForAppReady,
    waitForTinyMceReady,
} from '../helpers/workarea-helpers';

/**
 * Per-project activity log (issue #2689).
 *
 * Journey: the owner invites a collaborator; the collaborator opens the
 * project, creates a page, adds, edits and deletes an iDevice and saves; the
 * owner reads and filters the Activity view; an administrator reads the same
 * log from the API and from /admin; an unrelated user is refused; the
 * collaborator reconnects and collaboration still works. Both the visible UI
 * and the persisted records (through the read API) are verified.
 */
test.describe('Project activity log', () => {
    test.setTimeout(180000);

    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'Activity log needs the server');
    });

    const ADMIN_EMAIL = 'admin@exelearning.test';
    const ADMIN_PASSWORD = 'AdminPass123!';
    const XSS_PAGE_TITLE = '<img src=x onerror="window.__activityXss=1">';

    async function openActivityFromShare(page: import('@playwright/test').Page) {
        const shareModal = new ShareModalPage(page);
        await page.locator('#head-top-share-button').click();
        await shareModal.waitForOpen();
        const activityButton = page.locator('#share-activity-button');
        await expect(activityButton).toBeVisible();
        await activityButton.click();
        const modal = page.locator('#modalActivity');
        await expect(modal).toHaveAttribute('data-open', 'true', { timeout: 15000 });
        await expect(modal.locator('.activity-log-status')).not.toHaveText(/Loading/i, { timeout: 15000 });
        return modal;
    }

    test('records who did what, lets owners and admins read it, refuses others, and survives reconnection', async ({
        authenticatedPage: ownerPage,
        secondAuthenticatedPage: collaboratorPage,
        createProject,
        browser,
    }) => {
        const projectTitle = `Activity project ${Date.now()}`;
        const projectUuid = await createProject(ownerPage, projectTitle);
        const collaboratorEmail = await collaboratorPage
            .locator('#head-bottom-user-logged')
            .getAttribute('data-user-email');
        expect(collaboratorEmail).toBeTruthy();

        // 1. Owner opens the project and invites the collaborator.
        await ownerPage.goto(`/workarea?project=${projectUuid}`);
        await waitForAppReady(ownerPage);
        const ownerShare = new ShareModalPage(ownerPage);
        await ownerPage.locator('#head-top-share-button').click();
        await ownerShare.waitForOpen();
        await ownerShare.inviteCollaborator(collaboratorEmail!);
        await expect(ownerPage.locator('#share-people-list .share-person-row')).toHaveCount(2, { timeout: 15000 });
        // The owner can already see the Activity entry point.
        await expect(ownerPage.locator('#share-activity-button')).toBeVisible();
        await ownerShare.close();

        // 2-7. Collaborator opens the project, creates a page, adds, edits and deletes an iDevice, saves.
        await collaboratorPage.goto(`/workarea?project=${projectUuid}`);
        await waitForAppReady(collaboratorPage);
        await waitForYjsSync(collaboratorPage);
        await addPage(collaboratorPage, XSS_PAGE_TITLE);
        await selectFirstPage(collaboratorPage);
        await addIdevice(collaboratorPage, 'text');
        await waitForTinyMceReady(collaboratorPage);
        const { ideviceId } = await getFirstBlockAndIdeviceIds(collaboratorPage);
        await saveIdevice(collaboratorPage, ideviceId);
        await editIdevice(collaboratorPage, ideviceId);
        await waitForTinyMceReady(collaboratorPage);
        await saveIdevice(collaboratorPage, ideviceId);
        await deleteIdevice(collaboratorPage, ideviceId);
        await saveProject(collaboratorPage);

        // Pending browser reports are flushed before the save; give the last batch a moment to land.
        await expect
            .poll(
                async () => {
                    const res = await ownerPage.request.get(`/api/projects/uuid/${projectUuid}/activity?limit=100`);
                    if (!res.ok()) return [];
                    const body = await res.json();
                    return body.events.map((e: { type: string }) => e.type);
                },
                { timeout: 30000 },
            )
            .toEqual(
                expect.arrayContaining([
                    'access.collaborator_added',
                    'session.opened',
                    'save.manual',
                    'page.created',
                    'idevice.created',
                ]),
            );

        // Persisted records: actors, provenance and the XSS label stored as text.
        const apiLog = await (
            await ownerPage.request.get(`/api/projects/uuid/${projectUuid}/activity?limit=100`)
        ).json();
        const byCollaborator = apiLog.events.filter(
            (e: { actor: { email: string } | null }) => e.actor?.email === collaboratorEmail,
        );
        expect(byCollaborator.map((e: { type: string }) => e.type)).toEqual(
            expect.arrayContaining([
                'session.opened',
                'save.manual',
                'page.created',
                'idevice.created',
                'idevice.deleted',
            ]),
        );
        const createdPage = apiLog.events.find((e: { type: string }) => e.type === 'page.created');
        expect(createdPage.target.label).toBe(XSS_PAGE_TITLE);
        expect(createdPage.provenance).toBe('client');
        const invite = apiLog.events.find((e: { type: string }) => e.type === 'access.collaborator_added');
        expect(invite.provenance).toBe('server');
        expect(invite.target.label).toBe(collaboratorEmail);

        // 8-10. Owner opens Activity from the share modal, sees entries, filters by collaborator and date.
        const modal = await openActivityFromShare(ownerPage);
        const entries = modal.locator('.activity-log-entry');
        await expect(entries.first()).toBeVisible();
        expect(await entries.count()).toBeGreaterThanOrEqual(5);
        await expect(modal.locator('.activity-log-entry', { hasText: 'Created page' })).toContainText(XSS_PAGE_TITLE);
        // The hostile title rendered as text: no element was created and the handler never ran.
        await expect(modal.locator('.activity-log-list img')).toHaveCount(0);
        expect(
            await ownerPage.evaluate(() => (window as Window & { __activityXss?: number }).__activityXss),
        ).toBeUndefined();

        const userSelect = modal.locator('select');
        await userSelect.selectOption({ label: collaboratorEmail! });
        await modal.locator('button[type="submit"]').click();
        await expect(modal.locator('.activity-log-status')).not.toHaveText(/Loading/i);
        const actors = await modal.locator('.activity-log-actor').allTextContents();
        expect(actors.length).toBeGreaterThan(0);
        expect(actors.every(a => a === collaboratorEmail)).toBe(true);

        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        await modal.locator('input[type="date"]').first().fill(tomorrow);
        await modal.locator('button[type="submit"]').click();
        await expect(modal.locator('.activity-log-status')).toHaveText(/No activity recorded yet/i);
        await modal.locator('.activity-log-filters button[type="button"]').click(); // Clear
        await expect(modal.locator('.activity-log-entry').first()).toBeVisible();
        await modal.locator('.modal-footer .btn-primary').click();
        await expect(modal).toHaveAttribute('data-open', 'false');

        // 12. An unrelated authenticated user cannot read the log; the collaborator cannot either by default.
        const strangerContext = await browser.newContext();
        const strangerLogin = await strangerContext.request.post('/login/guest', { form: { guest_login_nonce: '' } });
        expect(strangerLogin.ok()).toBeTruthy();
        const strangerRead = await strangerContext.request.get(`/api/projects/uuid/${projectUuid}/activity`);
        expect(strangerRead.status()).toBe(403);
        await strangerContext.close();
        const collaboratorRead = await collaboratorPage.request.get(`/api/projects/uuid/${projectUuid}/activity`);
        expect([200, 403]).toContain(collaboratorRead.status()); // 200 only when PROJECT_ACTIVITY_EDITOR_ACCESS=true
        const unauthenticated = await browser.newContext();
        expect((await unauthenticated.request.get(`/api/projects/uuid/${projectUuid}/activity`)).status()).toBe(401);
        await unauthenticated.close();

        // 11. An administrator reads the same project activity from the API and from /admin.
        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();
        const adminLogin = await adminPage.request.post('/api/auth/login', {
            data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
        });
        expect(adminLogin.ok()).toBeTruthy();
        const projectInfo = await (await adminPage.request.get(`/api/projects/uuid/${projectUuid}/sharing`)).json();
        const projectId = projectInfo.project.id;
        const adminApi = await adminPage.request.get(`/api/admin/projects/${projectId}/activity?limit=100`);
        expect(adminApi.ok()).toBeTruthy();
        const adminBody = await adminApi.json();
        expect(adminBody.project.uuid).toBe(projectUuid);
        expect(adminBody.events.length).toBe(apiLog.events.length);

        await adminPage.goto('/admin');
        await adminPage.waitForLoadState('domcontentloaded');
        await adminPage.locator('.admin-nav-link[data-section="projects"]').click();
        await adminPage.fill('#projectTitleFilter', projectTitle);
        await adminPage.locator('#projectTitleFilter').press('Enter');
        const row = adminPage.locator('#projectsTableBody tr').filter({ hasText: projectTitle }).first();
        await expect(row).toBeVisible({ timeout: 15000 });
        await row.locator('button[data-action="project-activity"]').click();
        const adminModal = adminPage.locator('#projectActivityModal');
        await expect(adminModal).toBeVisible();
        await expect(adminModal.locator('.activity-log-entry').first()).toBeVisible({ timeout: 15000 });
        await expect(adminModal.locator('.activity-log-list img')).toHaveCount(0);
        await adminContext.close();

        // 13. Collaboration remains functional after the collaborator reconnects.
        await collaboratorPage.reload({ waitUntil: 'domcontentloaded' });
        await waitForAppReady(collaboratorPage);
        await waitForYjsSync(collaboratorPage);
        await addPage(collaboratorPage, 'After reconnection');
        await expect
            .poll(
                async () => {
                    const body = await (
                        await ownerPage.request.get(`/api/projects/uuid/${projectUuid}/activity?limit=100`)
                    ).json();
                    return body.events.filter(
                        (e: { type: string; target: { label: string } | null }) =>
                            e.type === 'page.created' && e.target?.label === 'After reconnection',
                    ).length;
                },
                { timeout: 60000 },
            )
            .toBe(1);
        // Reconnection did not create a second session.opened for the same tab, but the reload (a new
        // editor session) did: exactly two sessions for the collaborator.
        const finalLog = await (
            await ownerPage.request.get(`/api/projects/uuid/${projectUuid}/activity?limit=100`)
        ).json();
        const sessions = finalLog.events.filter(
            (e: { type: string; actor: { email: string } | null }) =>
                e.type === 'session.opened' && e.actor?.email === collaboratorEmail,
        );
        expect(sessions).toHaveLength(2);
    });
});
