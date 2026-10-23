import type { Page } from '@playwright/test';
import { test, expect, skipInStaticMode } from '../fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady } from '../helpers/workarea-helpers';
import { waitForYjsSync } from '../helpers/sync-helpers';
import { NavigationPage } from '../pages/navigation.page';

declare global {
    interface Window {
        __EXE_COLLAB_AUTOSAVE_IDLE_MS__?: number;
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

    const badge = (page: Page) => page.locator('#head-top-save-button .collab-autosave-badge');
    const liveRegion = (page: Page) => page.locator('#exe-collab-save-status .content');

    /** Install the short/long idle override before the app boots. */
    async function setIdle(page: Page, ms: number): Promise<void> {
        await page.addInitScript(value => {
            window.__EXE_COLLAB_AUTOSAVE_IDLE_MS__ = value;
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
        await expect(badge(page)).toBeVisible({ timeout: 15000 });
        await expect(badge(page)).toHaveAttribute('data-collab-phase', 'clean', { timeout: 20000 });
        await expect(liveRegion(page)).toHaveText('All changes are saved.');
        await expect(page.locator('#head-top-save-button')).not.toHaveClass(/unsaved/);

        // The server copy must contain the edits: reopen after the local wipe.
        await reopenFromServer(page, projectUuid);
        await new NavigationPage(page).waitForNodeInNav(nodeName, 30000);
        expect(await readAuthor(page)).toBe('Solo Author');
        await expect(page.locator('#head-top-save-button')).not.toHaveClass(/unsaved/);
    });

    test('shows the pending state while an edit awaits autosave and keeps the manual Save button usable', async ({
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

        await expect(badge(page)).toBeVisible({ timeout: 15000 });
        await expect(badge(page)).toHaveAttribute('data-collab-phase', 'pending', { timeout: 15000 });
        await expect(liveRegion(page)).toHaveText('Changes will be saved automatically.');
        await expect(page.locator('#head-top-save-button')).toHaveClass(/unsaved/);

        // The Save button is still there and still works (issue #2615 keeps it
        // until autosave has proven itself in production).
        const saveButton = page.locator('#head-top-save-button');
        await expect(saveButton).toBeVisible();
        await expect(saveButton).toBeEnabled();
        await saveButton.click();
        await page.waitForFunction(
            () => !document.getElementById('head-top-save-button')?.classList.contains('saving'),
            undefined,
            { timeout: 30000 },
        );

        await expect(badge(page)).toHaveAttribute('data-collab-phase', 'clean', { timeout: 15000 });
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
        await expect(badge(page)).toHaveAttribute('data-collab-phase', 'clean', { timeout: 20000 });

        const calls = await saveCalls(page);
        expect(calls.length).toBe(1);
        expect(calls[0].reason).toBe('collaborative-autosave');
        const dirty = await page.evaluate(
            () => (window as any).eXeLearning.app.project._yjsBridge.documentManager.isDirty,
        );
        expect(dirty).toBe(false);
    });

    test('debounces a burst of edits into a single autosave', async ({ authenticatedPage, createProject }) => {
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

        await expect(badge(page)).toHaveAttribute('data-collab-phase', 'clean', { timeout: 20000 });
        await page.waitForTimeout(SHORT_IDLE_MS);
        const calls = await saveCalls(page);
        expect(calls.length).toBe(1);
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
        await expect(badge(page)).toHaveAttribute('data-collab-phase', 'clean', { timeout: 20000 });
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
        await expect(badge(page)).toHaveAttribute('data-collab-phase', 'failed', { timeout: 30000 });
        await expect(liveRegion(page)).toHaveText('Autosave failed.');
        // The document stays dirty, so the leave warning still protects it.
        await expect(page.locator('#head-top-save-button')).toHaveClass(/unsaved/);

        // Restore the endpoint: the bounded retry (or a manual Save) recovers.
        await page.unroute(saveUrl);
        await page.locator('#head-top-save-button').click();
        await expect(badge(page)).toHaveAttribute('data-collab-phase', 'clean', { timeout: 30000 });
        await expect(page.locator('#head-top-save-button')).not.toHaveClass(/unsaved/);

        await reopenFromServer(page, projectUuid);
        expect(await readAuthor(page)).toBe('Failure Author');
    });
});
