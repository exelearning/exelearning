import { test, expect, skipInStaticMode } from '../fixtures/collaboration.fixture';
import { NavigationPage } from '../pages/navigation.page';
import { waitForYjsSync } from '../helpers/sync-helpers';
import { saveProject } from '../helpers/workarea-helpers';

declare global {
    interface Window {
        __EXE_COLLAB_AUTOSAVE_IDLE_MS__?: number;
    }
}

/**
 * Stale client protection (issue #2615, field report).
 *
 * The WebSocket is a pure relay with no document state. A tab that was offline
 * (laptop asleep, network drop) while another user saved never received those
 * edits on reconnection, kept showing its old copy and, on its next save,
 * overwrote the server with it. This is the mechanism behind "we reopened the
 * project and the published edits were gone". The fix merges the server
 * snapshot on every online open and after every reconnection, so the stale
 * client converges before its autosave can run.
 *
 * The explicit-save variants and the open-time merge are covered in
 * stale-client-save.spec.ts (#2618); this spec only adds the autosave path.
 */
test.describe('Cloud autosave: a stale client\'s autosave never overwrites newer saves', () => {
    test.setTimeout(150000);
    const SHORT_IDLE_MS = 1500;

    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'WebSocket collaboration');
    });

    test('a tab that was offline while a collaborator saved picks up the saved edits on reconnection and keeps them', async ({
        authenticatedPage,
        secondAuthenticatedPage,
        createProject,
        getShareUrl,
        joinSharedProject,
    }) => {
        for (const page of [authenticatedPage, secondAuthenticatedPage]) {
            await page.addInitScript(ms => {
                window.__EXE_COLLAB_AUTOSAVE_IDLE_MS__ = ms;
            }, SHORT_IDLE_MS);
        }

        // A owns the project and shares it; B joins through the public link.
        const projectUuid = await createProject(authenticatedPage, 'Stale Client Protection');
        await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
        const shareUrl = await getShareUrl(authenticatedPage);
        await joinSharedProject(secondAuthenticatedPage, shareUrl);
        await waitForYjsSync(authenticatedPage);
        await waitForYjsSync(secondAuthenticatedPage);

        const navA = new NavigationPage(authenticatedPage);
        const navB = new NavigationPage(secondAuthenticatedPage);
        const baseNode = `Base Node ${Date.now()}`;
        await navA.createNodeAtRoot(baseNode);
        await navB.waitForNodeInNav(baseNode, 30000);
        await expect(authenticatedPage.locator('#head-top-save-button')).toHaveAttribute('data-cloud-phase', 'clean', {
            timeout: 20000,
        });

        // A's WebSocket drops (laptop asleep). Closing the provider directly is
        // deterministic in every browser; Firefox's offline emulation does not
        // close an already-open WebSocket.
        await authenticatedPage.evaluate(() => {
            (window as any).eXeLearning.app.project._yjsBridge.documentManager.wsProvider.disconnect();
        });
        await authenticatedPage.waitForFunction(
            () =>
                (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager?.wsProvider?.wsconnected ===
                false,
            undefined,
            { timeout: 30000 },
        );

        // B keeps working and saves (explicitly, like the mentors did).
        const laterNode = `Saved While A Was Offline ${Date.now()}`;
        await navB.createNodeAtRoot(laterNode);
        await saveProject(secondAuthenticatedPage);
        await secondAuthenticatedPage.close();

        // A still shows its stale copy...
        expect(await navA.getNodeIdByTitle(laterNode)).toBeNull();

        // ...comes back online, and must converge with the server before anything else.
        await authenticatedPage.evaluate(() => {
            (window as any).eXeLearning.app.project._yjsBridge.documentManager.wsProvider.connect();
        });
        await authenticatedPage.waitForFunction(
            () =>
                (window as any).eXeLearning?.app?.project?._yjsBridge?.documentManager?.wsProvider?.wsconnected ===
                true,
            undefined,
            { timeout: 60000 },
        );
        await navA.waitForNodeInNav(laterNode, 30000);

        // A now edits; its autosave must carry B's node, not erase it.
        const afterNode = `A After Reconnect ${Date.now()}`;
        await navA.createNodeAtRoot(afterNode);
        await expect(authenticatedPage.locator('#head-top-save-button')).toHaveAttribute('data-cloud-phase', 'clean', {
            timeout: 20000,
        });

        // Fresh open from the server (new tab session after a last-tab cleanup).
        await authenticatedPage.evaluate(() => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            bridge?.documentManager?._tabTracker?.forceCleanup();
        });
        await authenticatedPage.evaluate(() => sessionStorage.clear());
        await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
        await waitForYjsSync(authenticatedPage);
        const navReopen = new NavigationPage(authenticatedPage);
        await navReopen.waitForNodeInNav(baseNode, 30000);
        await navReopen.waitForNodeInNav(laterNode, 30000);
        await navReopen.waitForNodeInNav(afterNode, 30000);
    });
});
