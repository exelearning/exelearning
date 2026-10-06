import { test, expect, skipInStaticMode } from '../fixtures/collaboration.fixture';
import { NavigationPage } from '../pages/navigation.page';
import { waitForYjsSync } from '../helpers/sync-helpers';

declare global {
    interface Window {
        __EXE_COLLAB_AUTOSAVE_IDLE_MS__?: number;
    }
}

/**
 * Wait until this client's Yjs awareness reports at least one other (remote)
 * collaborator. The collaborative autosave only activates once a collaborator
 * has been present, so this makes the autosave deterministic instead of racing
 * awareness propagation.
 */
async function waitForCollaboratorPresent(page: import('@playwright/test').Page): Promise<void> {
    await page.waitForFunction(
        () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const dm = (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager;
            if (!dm || typeof dm.getOnlineUsers !== 'function') return false;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return dm.getOnlineUsers().filter((u: any) => u && !u.isLocal).length > 0;
        },
        undefined,
        { timeout: 30000 },
    );
}

/**
 * Collaborative autosave (issue #1592).
 *
 * In an online collaborative session, Yjs changes are shared live but were only
 * persisted when someone clicked Save. If the last editor closed their tab
 * without saving, the visible collaborative changes were lost on reopen. These
 * tests verify that the conservative idle autosave persists the shared state,
 * and that the compact Save-button status badge (with a visually-hidden live
 * region for screen readers) communicates it.
 *
 * Skipped in static mode (no WebSocket collaboration / no remote storage).
 */
test.describe('Collaborative autosave', () => {
    // Real WebSocket collaboration plus an idle window and a project reopen.
    test.setTimeout(120000);

    // Shorten the autosave idle debounce so the test does not wait the full
    // production delay. Mirrors the existing window.__EXE_STATIC_MODE__ override.
    const SHORT_IDLE_MS = 1500;

    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'WebSocket collaboration');
    });

    test('persists collaborative changes after every editor leaves without saving', async ({
        authenticatedPage,
        secondAuthenticatedPage,
        createProject,
        getShareUrl,
        joinSharedProject,
    }) => {
        await authenticatedPage.addInitScript(ms => {
            window.__EXE_COLLAB_AUTOSAVE_IDLE_MS__ = ms;
        }, SHORT_IDLE_MS);
        await secondAuthenticatedPage.addInitScript(ms => {
            window.__EXE_COLLAB_AUTOSAVE_IDLE_MS__ = ms;
        }, SHORT_IDLE_MS);

        // Client A opens a project; Client B joins it → real collaborative session.
        const projectUuid = await createProject(authenticatedPage, 'Autosave Persistence');
        await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
        const shareUrl = await getShareUrl(authenticatedPage);
        await joinSharedProject(secondAuthenticatedPage, shareUrl);
        await waitForYjsSync(authenticatedPage);
        await waitForYjsSync(secondAuthenticatedPage);
        await waitForCollaboratorPresent(authenticatedPage);

        const navA = new NavigationPage(authenticatedPage);
        const navB = new NavigationPage(secondAuthenticatedPage);

        // Client A makes a change but never clicks Save.
        const nodeName = `Autosaved Node ${Date.now()}`;
        await navA.createNodeAtRoot(nodeName);

        // Client B sees it live (confirms the shared-live state).
        await navB.waitForNodeInNav(nodeName, 30000);

        // The compact Save-button badge settles on the "clean" state once the
        // idle autosave has persisted the change to the server, and the
        // visually-hidden live region announces it to screen readers.
        const badge = authenticatedPage.locator('#head-top-save-button .collab-autosave-badge');
        await expect(badge).toBeVisible({ timeout: 15000 });
        await expect(badge).toHaveAttribute('data-collab-phase', 'clean', { timeout: 20000 });
        const liveRegion = authenticatedPage.locator('#exe-collab-save-status .content');
        await expect(liveRegion).toHaveText('All collaborative changes are saved.');

        // Both editors leave WITHOUT clicking Save.
        await secondAuthenticatedPage.close();
        await authenticatedPage.goto('about:blank');

        // Reopen the project fresh: the autosaved node must still be present.
        await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
        const navReopen = new NavigationPage(authenticatedPage);
        await navReopen.waitForNodeInNav(nodeName, 30000);
    });

    test('shows the pending notice while collaborative changes await autosave', async ({
        authenticatedPage,
        secondAuthenticatedPage,
        createProject,
        getShareUrl,
        joinSharedProject,
    }) => {
        // A long idle window so the "pending" state stays observable and does
        // not race into "saving"/"clean" before the assertion runs.
        await authenticatedPage.addInitScript(() => {
            window.__EXE_COLLAB_AUTOSAVE_IDLE_MS__ = 30000;
        });

        const projectUuid = await createProject(authenticatedPage, 'Autosave Pending Notice');
        await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
        const shareUrl = await getShareUrl(authenticatedPage);
        await joinSharedProject(secondAuthenticatedPage, shareUrl);
        await waitForYjsSync(authenticatedPage);
        await waitForYjsSync(secondAuthenticatedPage);
        await waitForCollaboratorPresent(authenticatedPage);

        const navA = new NavigationPage(authenticatedPage);
        await navA.createNodeAtRoot(`Pending Node ${Date.now()}`);

        // The compact badge shows the "pending" state and the visually-hidden
        // live region carries the full explanation for screen readers.
        const badge = authenticatedPage.locator('#head-top-save-button .collab-autosave-badge');
        await expect(badge).toBeVisible({ timeout: 15000 });
        await expect(badge).toHaveAttribute('data-collab-phase', 'pending', { timeout: 15000 });
        const liveRegion = authenticatedPage.locator('#exe-collab-save-status .content');
        await expect(liveRegion).toHaveText('Collaborative changes are shared live and will be saved automatically.');

        // Responsive: the compact indicator must stay reachable and not vanish
        // at a narrow (mobile) width, where the Save button collapses to an icon.
        await authenticatedPage.setViewportSize({ width: 375, height: 720 });
        await expect(authenticatedPage.locator('#head-top-save-button')).toBeVisible();
        await expect(badge).toBeVisible();
    });
});
