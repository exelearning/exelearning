import { test as collabTest, expect, skipInStaticMode } from '../fixtures/collaboration.fixture';
import { test as authTest } from '../fixtures/auth.fixture';
import { saveProject, gotoWorkarea } from '../helpers/workarea-helpers';
import { OpenProjectModalPage } from '../pages/open-project-modal.page';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for Project Clone / Duplicate (Issue #1175)
 *
 * Verifies that:
 * 1. Duplicating a project from "My Projects" shows the copy immediately
 * 2. Cloning a shared project into "My Projects" shows it without reload
 */

/**
 * Helper: open the "Open Project" modal from the File menu.
 * Dismisses blocking toasts before opening.
 */
async function openProjectModal(page: Page): Promise<OpenProjectModalPage> {
    // Dismiss any blocking toast notifications first
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

/**
 * Helper: get current user's email from the JS context
 */
async function getUserEmail(page: Page): Promise<string> {
    return page.evaluate(() => {
        const eXe = (window as any).eXeLearning;
        return (
            eXe?.app?.auth?.user?.email ||
            eXe?.app?.user?.email ||
            eXe?.config?.userEmail ||
            document.querySelector('[id*="user-dropdown"], .header-user-menu-dropdown')?.textContent?.trim() ||
            ''
        );
    });
}

/**
 * Helper: intercept duplicate API response.
 */
function interceptDuplicateResponse(page: Page): Promise<{ status: number; body: unknown }> {
    return new Promise(resolve => {
        const handler = async (response: { url: () => string; status: () => number; json: () => Promise<unknown> }) => {
            if (response.url().includes('/duplicate')) {
                page.off('response', handler);
                try {
                    const body = await response.json();
                    resolve({ status: response.status(), body });
                } catch {
                    resolve({ status: response.status(), body: null });
                }
            }
        };
        page.on('response', handler);
    });
}

/**
 * Helper: wait for the "(copy)" project to appear in the list.
 */
async function waitForCopyInList(page: Page, timeout = 20000): Promise<void> {
    await page.waitForFunction(
        () => {
            const titles = document.querySelectorAll('.ode-files-list .ode-title');
            return Array.from(titles).some(el => el.textContent?.includes('(copy)'));
        },
        { timeout },
    );
}

// ─── Test 1: Duplicate in My Projects ───

authTest.describe('Project Duplicate', () => {
    authTest.setTimeout(180000);

    authTest.beforeEach(({}, testInfo) => {
        if (testInfo.project.name.includes('static')) {
            authTest.skip(true, 'Skipped in static mode: requires server API');
        }
    });

    authTest('duplicated project should appear and be selected in My Projects', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        // The authenticatedPage fixture already loaded a project in the workarea.
        // Save it so it appears in the "My Projects" list (saved_once = 1).
        await saveProject(page);

        // Open the "Open Project" modal
        const modal = await openProjectModal(page);

        // Ensure we're on My Projects tab and get initial count
        await modal.clickMyProjectsTab();
        const initialCount = await modal.getMyProjectsCount();
        expect(initialCount).toBeGreaterThanOrEqual(1);

        // Get the first project's ode-id (the one we just saved)
        const odeId = await page.evaluate(() => {
            const firstRow = document.querySelector('.ode-files-list .ode-row');
            return firstRow?.getAttribute('ode-id') || '';
        });
        expect(odeId).toBeTruthy();

        // Intercept the duplicate API response
        const responsePromise = interceptDuplicateResponse(page);

        await modal.clickDuplicateForProject(odeId!);

        // Check the API response
        const apiResponse = await responsePromise;
        expect(apiResponse.status).toBe(200);

        // Wait for the "(copy)" project to appear
        await waitForCopyInList(page);

        // Wait for the selection to happen
        await page.waitForFunction(() => document.querySelector('.ode-files-list .ode-row.selected') !== null, {
            timeout: 10000,
        });

        // Assert: My Projects tab is active
        expect(await modal.isMyProjectsTabActive()).toBe(true);

        // Assert: count increased by 1
        const newCount = await modal.getMyProjectsCount();
        expect(newCount).toBe(initialCount + 1);

        // Assert: a project is selected and it's the copy (not the original)
        const selectedUuid = await modal.getSelectedProjectUuid();
        expect(selectedUuid).toBeTruthy();
        expect(selectedUuid).not.toBe(odeId);

        // Assert: Open button is enabled
        expect(await modal.isOpenButtonEnabled()).toBe(true);
    });
});

// ─── Test 2: Clone from Shared ───

collabTest.describe('Clone Shared Project', () => {
    collabTest.setTimeout(180000);

    collabTest.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(collabTest, testInfo, 'requires server + collaboration');
    });

    collabTest(
        'cloning shared project should appear in My Projects',
        async ({ authenticatedPage, secondAuthenticatedPage, createProject, getShareUrl, joinSharedProject }) => {
            const pageA = authenticatedPage;
            const pageB = secondAuthenticatedPage;

            // ── User A: create, save, and share a project ──
            const projectTitle = `Share Clone ${Date.now()}`;
            const projectUuid = await createProject(pageA, projectTitle);
            await gotoWorkarea(pageA, projectUuid);
            await saveProject(pageA);

            // Make project public via share modal
            const shareUrl = await getShareUrl(pageA);
            expect(shareUrl).toContain(projectUuid);

            // ── User B: join the shared project ──
            await joinSharedProject(pageB, shareUrl);

            // ── Get User B's email and add as collaborator via API ──
            const userBEmail = await getUserEmail(pageB);
            expect(userBEmail).toBeTruthy();

            const addCollabResponse = await pageA.request.post(`/api/projects/uuid/${projectUuid}/collaborators`, {
                data: { email: userBEmail },
                headers: { 'Content-Type': 'application/json' },
            });
            expect(addCollabResponse.ok()).toBeTruthy();

            // ── User B: open the Open Project modal ──
            const modal = await openProjectModal(pageB);

            // Switch to "Shared with me" tab
            await modal.clickSharedWithMeTab();
            expect(await modal.isSharedWithMeTabActive()).toBe(true);

            // Wait for the shared project to appear
            await modal.waitForProjectInList(projectTitle, 10000);

            // Find the shared project
            const sharedOdeId = await modal.getProjectOdeIdByTitle(projectTitle);
            expect(sharedOdeId).toBeTruthy();

            // Intercept the duplicate API response
            const responsePromise = interceptDuplicateResponse(pageB);

            // Click "Clone to my projects" (duplicate/copy button)
            await modal.clickDuplicateForProject(sharedOdeId!);

            // Check the API response
            const apiResponse = await responsePromise;
            expect(apiResponse.status).toBe(200);

            // Wait for the "(copy)" project to appear
            await waitForCopyInList(pageB, 30000);

            // Assert: tab switched to My Projects
            expect(await modal.isMyProjectsTabActive()).toBe(true);

            // Assert: cloned project is selected (wait briefly for selection)
            await pageB
                .waitForFunction(() => document.querySelector('.ode-files-list .ode-row.selected') !== null, {
                    timeout: 10000,
                })
                .catch(() => {}); // Selection is secondary; project appearing is the main test

            const selectedUuid = await modal.getSelectedProjectUuid();
            expect(selectedUuid).toBeTruthy();
            expect(selectedUuid).not.toBe(sharedOdeId);

            // Assert: Open button is enabled
            expect(await modal.isOpenButtonEnabled()).toBe(true);
        },
    );
});
