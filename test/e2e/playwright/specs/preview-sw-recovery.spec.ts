import { test, expect, type Page } from '../fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady, getPreviewFrame } from '../helpers/workarea-helpers';

/**
 * E2E tests for preview Service Worker recovery (GitHub issue #2429).
 *
 * After a server upgrade a browser profile can keep a preview-sw.js registration that the
 * browser reports as "activated" but that never answers messages. The app used to adopt it
 * blindly and fail with "Timeout waiting for SW content ready". Pre-4.0.0 builds also left a
 * root-scope registration behind that captured the content while the /viewer/ worker served
 * the iframe, which produced a blank preview.
 *
 * The dead worker is simulated from the page (a script installed before the app loads drops
 * every message sent to the registered preview worker until the app unregisters it), which
 * works in Chromium and Firefox alike. Serving a stub preview-sw.js through page.route() was
 * ruled out: Playwright cannot intercept the worker script request in Firefox, and in Chromium a
 * worker installed from a route-fulfilled script makes the browser reinstall the worker on every
 * in-scope navigation afterwards, which does not happen with a real script change on disk.
 */

type ZombieState = { dropped: number; unregistered: boolean };

/** Drop every message to the preview worker until the app unregisters it. */
function installZombiePreviewWorker() {
    const state: ZombieState = { dropped: 0, unregistered: false };
    (window as any).__previewSwZombie = state;
    const realPostMessage = ServiceWorker.prototype.postMessage;
    const realUnregister = ServiceWorkerRegistration.prototype.unregister;
    ServiceWorker.prototype.postMessage = function (this: ServiceWorker, ...args: any[]) {
        const isPreviewWorker = new URL(this.scriptURL).pathname.endsWith('/preview-sw.js');
        if (isPreviewWorker && !state.unregistered) {
            state.dropped += 1;
            return undefined;
        }
        return (realPostMessage as any).apply(this, args);
    } as any;
    ServiceWorkerRegistration.prototype.unregister = function (this: ServiceWorkerRegistration) {
        state.unregistered = true;
        return realUnregister.call(this);
    };
}

async function getPreviewRegistrations(page: Page): Promise<Array<{ scope: string; script: string | null }>> {
    return page.evaluate(async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations
            .map(registration => ({
                scope: new URL(registration.scope).pathname,
                script: (registration.active || registration.waiting || registration.installing)?.scriptURL || null,
            }))
            .filter(entry => entry.script && new URL(entry.script).pathname.endsWith('/preview-sw.js'));
    });
}

async function expectPreviewRenders(page: Page): Promise<void> {
    await page.click('#head-bottom-preview');
    await expect(page.locator('#previewsidenav')).toBeVisible({ timeout: 15000 });
    // The exported page body carries the exe-export class; the error page does not.
    await expect(getPreviewFrame(page).locator('body.exe-export')).toBeAttached({ timeout: 30000 });
}

test.describe('Preview Service Worker recovery', () => {
    test('re-registers a preview worker that never answers and still renders the preview', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Preview SW recovery');

        const previewErrors: string[] = [];
        page.on('console', message => {
            if (message.type() === 'error' && message.text().includes('[PreviewPanel] Error')) {
                previewErrors.push(message.text());
            }
        });

        await page.context().addInitScript(installZombiePreviewWorker);
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // The app must have detected the dead worker and replaced its registration.
        await page.waitForFunction(() => (window as any).eXeLearning?.app?._previewSwRegistrationPromise, undefined, {
            timeout: 15000,
        });
        const zombie = await page.evaluate(async () => {
            await (window as any).eXeLearning.app._previewSwRegistrationPromise;
            return (window as any).__previewSwZombie as ZombieState;
        });
        expect(zombie.dropped).toBeGreaterThan(0);
        expect(zombie.unregistered).toBe(true);

        await expectPreviewRenders(page);
        expect(previewErrors).toEqual([]);
    });

    test('removes an orphaned root-scope preview worker registration', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Preview SW orphan cleanup');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // Pre-4.0.0 builds registered the preview worker with scope basePath ("/").
        await page.evaluate(async () => {
            const swPath = `${(window as any).eXeLearning.app.getBasePath?.() || ''}/preview-sw.js`;
            const scope = `${(window as any).eXeLearning.app.getBasePath?.() || ''}/`;
            const registration = await navigator.serviceWorker.register(swPath, { scope });
            await new Promise<void>(resolve => {
                const worker = registration.installing || registration.waiting || registration.active;
                if (!worker || worker.state === 'activated') return resolve();
                worker.addEventListener('statechange', () => {
                    if (worker.state === 'activated') resolve();
                });
            });
        });
        const before = await getPreviewRegistrations(page);
        expect(before.map(entry => entry.scope)).toContain('/');

        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForAppReady(page);
        await page.evaluate(async () => {
            await (window as any).eXeLearning.app._previewSwRegistrationPromise;
        });

        const after = await getPreviewRegistrations(page);
        expect(after.map(entry => entry.scope)).not.toContain('/');
        expect(after.map(entry => entry.scope)).toContain('/viewer/');

        await expectPreviewRenders(page);
    });
});
