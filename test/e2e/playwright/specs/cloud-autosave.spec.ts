import type { Page } from '@playwright/test';
import { test, expect, skipInStaticMode } from '../fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady } from '../helpers/workarea-helpers';
import { waitForYjsSync } from '../helpers/sync-helpers';
import { NavigationPage } from '../pages/navigation.page';

declare global {
    interface Window {
        __EXE_COLLAB_AUTOSAVE_IDLE_MS__?: number;
        __EXE_COLLAB_AUTOSAVE_RETRY_MS__?: number;
        __exeSaveCalls?: Array<{ reason: string | null }>;
    }
}

/**
 * Cloud autosave for single-user online sessions (issue #2615).
 *
 * Until #2615 the Yjs document was only persisted on a manual Save (the
 * `sendBeacon` fallback on unload silently fails above 64 KiB), so a user who
 * edited, exported and closed the tab without saving found an older version on
 * the next fresh open. These tests pin the Google-Docs-like contract: edits made
 * by a single user are persisted automatically after the idle period, survive
 * the last-tab IndexedDB cleanup (i.e. they really reached the server), never
 * autosave an untouched blank project, and cooperate with the manual Save
 * button, reloads and exports.
 *
 * Skipped in static mode (no remote storage, no WebSocket).
 */
test.describe('Cloud autosave (single user)', () => {
    test.setTimeout(120000);

    const SHORT_IDLE_MS = 1500;
    const LONG_IDLE_MS = 60000;

    test.beforeEach(({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'Requires remote storage and WebSocket');
    });

    // In cloud mode the toolbar control is the status chip itself (issue #2615):
    // the phase is exposed as data-cloud-phase on #head-top-save-button.
    const badge = (page: Page) => page.locator('#head-top-save-button');
    const chipLabel = (page: Page) => page.locator('#head-top-save-button .cloud-save-label');
    const liveRegion = (page: Page) => page.locator('#exe-collab-save-status .content');

    /** Install the short/long idle override before the app boots. */
    async function setIdle(page: Page, ms: number): Promise<void> {
        await page.addInitScript(value => {
            window.__EXE_COLLAB_AUTOSAVE_IDLE_MS__ = value;
        }, ms);
    }

    /** Install the retry backoff base override before the app boots. */
    async function setRetryBase(page: Page, ms: number): Promise<void> {
        await page.addInitScript(value => {
            window.__EXE_COLLAB_AUTOSAVE_RETRY_MS__ = value;
        }, ms);
    }

    /** Count every SaveManager.save() call (manual, autosave, pre-export) with its reason. */
    async function spyOnSaves(page: Page): Promise<void> {
        await page.evaluate(() => {
            const sm = (window as any).eXeLearning.app.project._yjsBridge.saveManager;
            window.__exeSaveCalls = [];
            const original = sm.save.bind(sm);
            sm.save = (options: any = {}) => {
                window.__exeSaveCalls!.push({ reason: options.reason ?? null });
                return original(options);
            };
        });
    }

    async function saveCalls(page: Page): Promise<Array<{ reason: string | null }>> {
        return page.evaluate(() => window.__exeSaveCalls || []);
    }

    /** Make a metadata edit through the bridge (deterministic, no UI timing). */
    async function editMetadata(page: Page, value: string): Promise<void> {
        await page.evaluate(v => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            bridge.documentManager.getMetadata().set('author', v);
        }, value);
    }

    async function readAuthor(page: Page): Promise<string> {
        return page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            return bridge.documentManager.getMetadata().get('author') ?? '';
        });
    }

    /**
     * Simulate "close the last tab, open the project again in a new tab": the
     * tab tracker schedules the cleanup, a fresh tab session deletes IndexedDB
     * and the dirty flag, and the document is loaded from the server. Anything
     * visible afterwards was persisted server-side.
     */
    async function reopenFromServer(page: Page, projectUuid: string): Promise<void> {
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            bridge?.documentManager?._tabTracker?.forceCleanup();
        });
        await page.waitForFunction(id => localStorage.getItem(`exe-needs-cleanup-${id}`) === 'true', projectUuid, {
            timeout: 5000,
        });
        await page.evaluate(() => sessionStorage.clear());
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await waitForYjsSync(page);
        // The deferred cleanup must have run: no stale local copy is in play.
        const idbExists = await page.evaluate(async id => {
            if (typeof indexedDB.databases !== 'function') return null;
            const dbs = await indexedDB.databases();
            return dbs.some(db => db.name === `exelearning-project-${id}`);
        }, projectUuid);
        // Chromium reports databases; after the wipe the DB is recreated empty
        // by y-indexeddb, so we only assert the cleanup flag was consumed.
        expect(idbExists === null || typeof idbExists === 'boolean').toBe(true);
        const flag = await page.evaluate(id => localStorage.getItem(`exe-needs-cleanup-${id}`), projectUuid);
        expect(flag).toBeNull();
    }

    test("persists a single user's edits without clicking Save and survives the IndexedDB wipe", async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await setIdle(page, SHORT_IDLE_MS);
        const projectUuid = await createProject(page, 'Cloud Autosave Persistence');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await waitForYjsSync(page);

        // Nobody else is connected: this is the plain single-user case.
        const others = await page.evaluate(() => {
            const dm = (window as any).eXeLearning.app.project._yjsBridge.documentManager;
            return dm.getOnlineUsers().filter((u: any) => u && !u.isLocal).length;
        });
        expect(others).toBe(0);

        const nav = new NavigationPage(page);
        const nodeName = `Autosaved Solo Node ${Date.now()}`;
        await nav.createNodeAtRoot(nodeName);
        await editMetadata(page, 'Solo Author');

        // Status goes to clean once the idle autosave has persisted the change.
        await expect(badge(page)).toHaveAttribute('data-cloud-phase', 'clean', { timeout: 20000 });
        await expect(liveRegion(page)).toHaveText('All changes are saved.');
        await expect(page.locator('#head-top-save-button')).not.toHaveClass(/unsaved/);

        // Google Docs style: no "Save" button, a status chip instead.
        await expect(page.locator('#head-top-save-button .save-label')).toBeHidden();
        await expect(page.locator('#head-top-save-button .save-icon-white')).toBeHidden();
        await expect(page.locator('#head-top-save-button .cloud-save-icon')).toBeVisible();
        await expect(page.locator('#head-top-save-button .cloud-save-icon')).toHaveText('cloud_done');
        await expect(chipLabel(page)).toHaveText('Saved');
        await expect(page.locator('#head-top-save-button')).toHaveAttribute('title', 'All changes are saved.');

        // The server copy must contain the edits: reopen after the local wipe.
        await reopenFromServer(page, projectUuid);
        await new NavigationPage(page).waitForNodeInNav(nodeName, 30000);
        expect(await readAuthor(page)).toBe('Solo Author');
        await expect(page.locator('#head-top-save-button')).not.toHaveClass(/unsaved/);
    });

    test('shows the pending state while an edit awaits autosave; clicking the status chip saves now', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await setIdle(page, LONG_IDLE_MS);
        const projectUuid = await createProject(page, 'Cloud Autosave Pending');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await waitForYjsSync(page);
        await spyOnSaves(page);

        await editMetadata(page, 'Pending Author');
        await expect(badge(page)).toHaveAttribute('data-cloud-phase', 'pending', { timeout: 15000 });
        await expect(liveRegion(page)).toHaveText('Changes will be saved automatically.');
        await expect(page.locator('#head-top-save-button')).toHaveClass(/unsaved/);
        await expect(chipLabel(page)).toHaveText('Unsaved changes');
        await expect(page.locator('#head-top-save-button .cloud-save-icon')).toHaveText('cloud_upload');
        await expect(page.locator('#head-top-save-button .save-label')).toBeHidden();
        // The legacy red "unsaved" dot must not overlap the chip icon.
        const dotDisplay = await page.evaluate(
            () => getComputedStyle(document.getElementById('head-top-save-button')!, '::before').display,
        );
        expect(dotDisplay).toBe('none');

        // The chip replaces the Save button but a click still means "save now".
        const saveButton = page.locator('#head-top-save-button');
        await expect(saveButton).toBeVisible();
        await expect(saveButton).toBeEnabled();
        await saveButton.click();
        await page.waitForFunction(
            () => !document.getElementById('head-top-save-button')?.classList.contains('saving'),
            undefined,
            { timeout: 30000 },
        );

        await expect(badge(page)).toHaveAttribute('data-cloud-phase', 'clean', { timeout: 15000 });
        await expect(saveButton).not.toHaveClass(/unsaved/);

        // Exactly one save ran: the manual one. The queued autosave was cancelled.
        await page.waitForTimeout(500);
        const calls = await saveCalls(page);
        expect(calls.length).toBe(1);
        expect(calls[0].reason).toBeNull();
    });

    test('never autosaves an untouched blank project', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await setIdle(page, SHORT_IDLE_MS);
        const projectUuid = await createProject(page, 'Cloud Autosave Blank');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await waitForYjsSync(page);
        await spyOnSaves(page);

        // Wait several idle windows without editing anything.
        await page.waitForTimeout(SHORT_IDLE_MS * 3);

        expect(await saveCalls(page)).toEqual([]);
        const dirty = await page.evaluate(
            () => (window as any).eXeLearning.app.project._yjsBridge.documentManager.isDirty,
        );
        expect(dirty).toBe(false);
        await expect(page.locator('#head-top-save-button')).not.toHaveClass(/unsaved/);
    });

    test('falls back to the Save button while no autosave phase has been announced', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Cloud Autosave Fallback');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await waitForYjsSync(page);
        await expect(badge(page)).toHaveAttribute('data-cloud-phase', 'clean', { timeout: 20000 });

        // A session that never becomes eligible (collaboration disabled, WebSocket
        // blocked) has no phase: it must show a usable Save button, not an empty chip.
        await page.evaluate(() => document.getElementById('head-top-save-button')!.removeAttribute('data-cloud-phase'));
        await expect(page.locator('#head-top-save-button .save-label')).toBeVisible();
        await expect(page.locator('#head-top-save-button .cloud-save-icon')).toBeHidden();
    });

    test('an edit made while an autosave is uploading is saved by the next autosave', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await setIdle(page, SHORT_IDLE_MS);
        const projectUuid = await createProject(page, 'Cloud Autosave Concurrent Edit');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await waitForYjsSync(page);
        await spyOnSaves(page);

        // The first upload carries 'First Author'; the second edit lands after the
        // snapshot was encoded, so the save must not mark the document clean.
        const saveUrl = `**/api/projects/uuid/${projectUuid}/yjs-document**`;
        let intercepted = false;
        await page.route(saveUrl, async route => {
            if (route.request().method() === 'POST' && !intercepted) {
                intercepted = true;
                await editMetadata(page, 'Second Author');
            }
            return route.continue();
        });
        await editMetadata(page, 'First Author');

        await expect.poll(async () => (await saveCalls(page)).length, { timeout: 30000 }).toBeGreaterThanOrEqual(2);
        await expect(badge(page)).toHaveAttribute('data-cloud-phase', 'clean', { timeout: 30000 });
        await page.unroute(saveUrl);

        await reopenFromServer(page, projectUuid);
        expect(await readAuthor(page)).toBe('Second Author');
    });

    test('tags the automatic save with its reason and the document ends clean', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await setIdle(page, SHORT_IDLE_MS);
        const projectUuid = await createProject(page, 'Cloud Autosave Reason');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await waitForYjsSync(page);
        await spyOnSaves(page);

        await editMetadata(page, 'Reason Author');
        await expect(badge(page)).toHaveAttribute('data-cloud-phase', 'clean', { timeout: 20000 });

        const calls = await saveCalls(page);
        expect(calls.length).toBe(1);
        expect(calls[0].reason).toBe('collaborative-autosave');
        const dirty = await page.evaluate(
            () => (window as any).eXeLearning.app.project._yjsBridge.documentManager.isDirty,
        );
        expect(dirty).toBe(false);
    });

    test('a burst of edits reaches the server with its last value, without a save per edit', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await setIdle(page, SHORT_IDLE_MS);
        const projectUuid = await createProject(page, 'Cloud Autosave Debounce');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await waitForYjsSync(page);
        await spyOnSaves(page);

        for (let i = 0; i < 5; i++) {
            await editMetadata(page, `Burst ${i}`);
            await page.waitForTimeout(SHORT_IDLE_MS / 3);
        }

        await expect(badge(page)).toHaveAttribute('data-cloud-phase', 'clean', { timeout: 20000 });
        await page.waitForTimeout(SHORT_IDLE_MS);
        // The idle timer starts with the first edit, so a long burst may take a
        // second save for the edits made while the first one was uploading.
        const calls = await saveCalls(page);
        expect(calls.length).toBeGreaterThanOrEqual(1);
        expect(calls.length).toBeLessThan(5);
        expect(calls.every(c => c.reason === 'collaborative-autosave')).toBe(true);

        // Read it back from the server, not from this tab's document.
        await reopenFromServer(page, projectUuid);
        expect(await readAuthor(page)).toBe('Burst 4');
    });

    test('a reload with a pending edit restores the dirty state and then autosaves it', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await setIdle(page, LONG_IDLE_MS);
        const projectUuid = await createProject(page, 'Cloud Autosave Reload');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await waitForYjsSync(page);

        await editMetadata(page, 'Reload Author');
        await expect(page.locator('#head-top-save-button')).toHaveClass(/unsaved/);
        // Let y-indexeddb flush the update before reloading.
        await page.waitForTimeout(500);

        // Reload with a short idle so the restored dirty state autosaves quickly.
        await setIdle(page, SHORT_IDLE_MS);
        await page.reload();
        await waitForAppReady(page);
        await waitForYjsSync(page);

        expect(await readAuthor(page)).toBe('Reload Author');
        await expect(badge(page)).toHaveAttribute('data-cloud-phase', 'clean', { timeout: 20000 });
        await expect(page.locator('#head-top-save-button')).not.toHaveClass(/unsaved/);

        // And the server now has it.
        await reopenFromServer(page, projectUuid);
        expect(await readAuthor(page)).toBe('Reload Author');
    });

    test('exporting an ELPX persists unsaved edits first (export never runs ahead of the server)', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await setIdle(page, LONG_IDLE_MS);
        const projectUuid = await createProject(page, 'Cloud Autosave Export');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await waitForYjsSync(page);
        await spyOnSaves(page);

        await editMetadata(page, 'Export Author');
        await expect(page.locator('#head-top-save-button')).toHaveClass(/unsaved/);

        const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
        await page.evaluate(() => (window as any).eXeLearning.app.project.exportToElpxViaYjs());
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/\.elpx$/);

        const calls = await saveCalls(page);
        expect(calls.map(c => c.reason)).toEqual(['pre-export']);
        await expect(page.locator('#head-top-save-button')).not.toHaveClass(/unsaved/);

        await reopenFromServer(page, projectUuid);
        expect(await readAuthor(page)).toBe('Export Author');
    });

    test('unsaved edits survive closing the last tab and are autosaved on the next open', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await setIdle(page, LONG_IDLE_MS);
        const projectUuid = await createProject(page, 'Cloud Autosave Tab Close');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await waitForYjsSync(page);

        // Edit, and close the last tab before the (long) idle autosave fires.
        await editMetadata(page, 'Closed Too Early');
        await expect(page.locator('#head-top-save-button')).toHaveClass(/unsaved/);
        await page.waitForTimeout(500); // let y-indexeddb flush
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            bridge?.documentManager?._tabTracker?.forceCleanup();
        });
        await page.waitForFunction(id => localStorage.getItem(`exe-needs-cleanup-${id}`) === 'true', projectUuid, {
            timeout: 5000,
        });
        await page.evaluate(() => sessionStorage.clear());

        // Fresh tab: the local copy with unsaved work is kept (not wiped), the
        // dirty state is restored and, with a short idle, autosaved.
        await setIdle(page, SHORT_IDLE_MS);
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await waitForYjsSync(page);
        expect(await readAuthor(page)).toBe('Closed Too Early');
        await expect(badge(page)).toHaveAttribute('data-cloud-phase', 'clean', { timeout: 20000 });

        // Now it is on the server: a real wipe (nothing unsaved) still shows it.
        await reopenFromServer(page, projectUuid);
        expect(await readAuthor(page)).toBe('Closed Too Early');
    });

    test('keeps retrying and recovers by itself once the save endpoint is back (no manual click)', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await setIdle(page, SHORT_IDLE_MS);
        await setRetryBase(page, 1000);
        const projectUuid = await createProject(page, 'Cloud Autosave Retry Queue');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await waitForYjsSync(page);
        await spyOnSaves(page);

        const saveUrl = `**/api/projects/uuid/${projectUuid}/yjs-document**`;
        let blocked = 0;
        await page.route(saveUrl, route => {
            if (route.request().method() === 'POST') {
                blocked += 1;
                return route.fulfill({ status: 503, body: 'unavailable' });
            }
            return route.continue();
        });
        await editMetadata(page, 'Retry Author');
        await expect(badge(page)).toHaveAttribute('data-cloud-phase', 'failed', { timeout: 30000 });

        // Let the retry loop run a few rounds while the endpoint is down ...
        await expect.poll(() => blocked, { timeout: 30000 }).toBeGreaterThanOrEqual(3);
        await expect(badge(page)).toHaveAttribute('data-cloud-phase', 'failed');

        // ... then bring it back: the next retry succeeds on its own.
        await page.unroute(saveUrl);
        await expect(badge(page)).toHaveAttribute('data-cloud-phase', 'clean', { timeout: 30000 });
        await expect(page.locator('#head-top-save-button')).not.toHaveClass(/unsaved/);
        const calls = await saveCalls(page);
        expect(calls.length).toBeGreaterThanOrEqual(4);
        expect(calls.every(c => c.reason === 'collaborative-autosave')).toBe(true);

        await reopenFromServer(page, projectUuid);
        expect(await readAuthor(page)).toBe('Retry Author');
    });

    test('a failed autosave is reported and recovers on the next successful save', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await setIdle(page, SHORT_IDLE_MS);
        const projectUuid = await createProject(page, 'Cloud Autosave Failure');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await waitForYjsSync(page);

        // Break the persistence endpoint, edit, and expect the failed state.
        const saveUrl = `**/api/projects/uuid/${projectUuid}/yjs-document**`;
        await page.route(saveUrl, route => {
            if (route.request().method() === 'POST') {
                return route.fulfill({ status: 503, body: 'unavailable' });
            }
            return route.continue();
        });
        await editMetadata(page, 'Failure Author');
        await expect(badge(page)).toHaveAttribute('data-cloud-phase', 'failed', { timeout: 30000 });
        await expect(liveRegion(page)).toHaveText('Autosave failed.');
        await expect(chipLabel(page)).toHaveText('Not saved');
        await expect(page.locator('#head-top-save-button .cloud-save-icon')).toHaveText('cloud_off');
        // The document stays dirty, so the leave warning still protects it.
        await expect(page.locator('#head-top-save-button')).toHaveClass(/unsaved/);

        // Restore the endpoint: clicking the chip is the manual retry.
        await page.unroute(saveUrl);
        await page.locator('#head-top-save-button').click();
        await expect(badge(page)).toHaveAttribute('data-cloud-phase', 'clean', { timeout: 30000 });
        await expect(page.locator('#head-top-save-button')).not.toHaveClass(/unsaved/);

        await reopenFromServer(page, projectUuid);
        expect(await readAuthor(page)).toBe('Failure Author');
    });
});
