import { test, expect, skipInStaticMode } from '../fixtures/collaboration.fixture';
import { NavigationPage } from '../pages/navigation.page';
import { waitForYjsSync } from '../helpers/sync-helpers';
import { saveProject } from '../helpers/workarea-helpers';

/**
 * Stale client protection (issue #2615, field report).
 *
 * The WebSocket is a pure relay with no document state. A tab that was offline
 * (laptop asleep, network drop) while another user saved never received those
 * edits on reconnection, kept showing its old copy and, on its next Save,
 * overwrote the server with it. This is the mechanism behind "we reopened the
 * project and the published edits were gone".
 *
 * Two layers now prevent it:
 *   1. the client merges the stored snapshot on every online open and after
 *      every reconnection, so a stale tab converges before it can save;
 *   2. the server validates every save against the stored version
 *      (`X-Base-Version`) and merges a stale state instead of replacing, so
 *      even an old cached bundle or a direct POST cannot erase newer saves.
 *
 * Skipped in static mode (no WebSocket collaboration / no remote storage).
 */
test.describe('Stale client never overwrites newer saves', () => {
    test.setTimeout(150000);

    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'WebSocket collaboration');
    });

    /** Fresh open from the server: last-tab cleanup, new tab session, reload. */
    async function reopenFromServer(page: import('@playwright/test').Page, projectUuid: string): Promise<void> {
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            bridge?.documentManager?._tabTracker?.forceCleanup();
        });
        await page.evaluate(() => sessionStorage.clear());
        await page.goto(`/workarea?project=${projectUuid}`);
        await waitForYjsSync(page);
    }

    test('a tab that was offline while a collaborator saved picks up the saved edits on reconnection and its own Save keeps them', async ({
        authenticatedPage,
        secondAuthenticatedPage,
        createProject,
        getShareUrl,
        joinSharedProject,
    }) => {
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
        await saveProject(authenticatedPage);

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

        // A now edits and saves; the save must carry B's node, not erase it.
        const afterNode = `A After Reconnect ${Date.now()}`;
        await navA.createNodeAtRoot(afterNode);
        await saveProject(authenticatedPage);

        await reopenFromServer(authenticatedPage, projectUuid);
        const navReopen = new NavigationPage(authenticatedPage);
        await navReopen.waitForNodeInNav(baseNode, 30000);
        await navReopen.waitForNodeInNav(laterNode, 30000);
        await navReopen.waitForNodeInNav(afterNode, 30000);
    });

    test('a stale local copy is merged with the server snapshot on open, not shown as current', async ({
        authenticatedPage,
        secondAuthenticatedPage,
        createProject,
        getShareUrl,
        joinSharedProject,
    }) => {
        const projectUuid = await createProject(authenticatedPage, 'Stale Local Copy');
        await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
        const shareUrl = await getShareUrl(authenticatedPage);
        await joinSharedProject(secondAuthenticatedPage, shareUrl);
        await waitForYjsSync(authenticatedPage);
        await waitForYjsSync(secondAuthenticatedPage);

        // A leaves with a local IndexedDB copy that survives (same-tab navigation
        // keeps the tab session, so the deferred cleanup does not run).
        await authenticatedPage.goto('about:blank');

        // B saves new content meanwhile.
        const navB = new NavigationPage(secondAuthenticatedPage);
        const laterNode = `Saved Meanwhile ${Date.now()}`;
        await navB.createNodeAtRoot(laterNode);
        await saveProject(secondAuthenticatedPage);
        await secondAuthenticatedPage.close();

        // A reopens: the stale copy must be merged with the server snapshot.
        await authenticatedPage.goto(`/workarea?project=${projectUuid}`);
        await waitForYjsSync(authenticatedPage);
        await new NavigationPage(authenticatedPage).waitForNodeInNav(laterNode, 30000);
    });

    test('the server merges a stale save posted without a base version instead of overwriting (old bundles, beacons)', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Server Side Save Validation');
        await page.goto(`/workarea?project=${projectUuid}`);
        await waitForYjsSync(page);

        // Capture the document state as an old client would hold it...
        const nav = new NavigationPage(page);
        const oldNode = `Old Client Node ${Date.now()}`;
        await nav.createNodeAtRoot(oldNode);
        await saveProject(page);
        const staleState: number[] = await page.evaluate(() => {
            const dm = (window as any).eXeLearning.app.project._yjsBridge.documentManager;
            return Array.from((window as any).Y.encodeStateAsUpdate(dm.ydoc));
        });

        // ...then keep working and save newer content.
        const newerNode = `Newer Saved Node ${Date.now()}`;
        await nav.createNodeAtRoot(newerNode);
        await saveProject(page);

        // A stale client (no X-Base-Version, like a cached bundle or sendBeacon)
        // posts the old state straight to the endpoint.
        const res = await page.request.post(`/api/projects/uuid/${projectUuid}/yjs-document?markSaved=true`, {
            data: Buffer.from(staleState),
            headers: { 'Content-Type': 'application/octet-stream' },
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.merged).toBe(true);

        // The newer node survived the stale save.
        await reopenFromServer(page, projectUuid);
        const navReopen = new NavigationPage(page);
        await navReopen.waitForNodeInNav(oldNode, 30000);
        await navReopen.waitForNodeInNav(newerNode, 30000);
    });

    test('a current save (matching base version) is stored as-is', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Current Save Fast Path');
        await page.goto(`/workarea?project=${projectUuid}`);
        await waitForYjsSync(page);

        await new NavigationPage(page).createNodeAtRoot(`Fast Path ${Date.now()}`);
        const merged: boolean[] = [];
        page.on('response', async response => {
            if (response.url().includes('/yjs-document') && response.request().method() === 'POST') {
                try {
                    merged.push((await response.json()).merged);
                } catch {
                    // not JSON
                }
            }
        });
        await saveProject(page);

        await expect.poll(() => merged.length, { timeout: 15000 }).toBeGreaterThan(0);
        expect(merged).toEqual([false]);
        const version = await page.evaluate(
            () => (window as any).eXeLearning.app.project._yjsBridge.documentManager.serverVersion,
        );
        expect(typeof version).toBe('string');
        expect(Number(version)).toBeGreaterThan(0);
    });
});
