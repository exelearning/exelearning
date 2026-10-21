import type { Page } from '@playwright/test';
import { expect, skipInStaticMode, test } from '../../fixtures/collaboration.fixture';
import { waitForYjsSync } from '../../helpers/sync-helpers';
import { selectFirstPage, waitForAppReady } from '../../helpers/workarea-helpers';

/**
 * A collaborator controls everything in the shared Y.Doc. A malicious one can
 * write it directly (bypassing the editor and TinyMCE), so the other users'
 * editors must render it without running any of it.
 *
 * Every payload sets `top.__xss` when it runs; User A's page must never get it.
 * Each check also proves the legitimate part of the same content still renders.
 */

const CANARY = 'top.__xss=(top.__xss||[]).concat';

async function openSharedProject(
    pageA: Page,
    pageB: Page,
    createProject: (page: Page, title?: string) => Promise<string>,
    getShareUrl: (page: Page) => Promise<string>,
    joinSharedProject: (page: Page, shareUrl: string) => Promise<void>,
    title: string,
): Promise<string> {
    const projectUuid = await createProject(pageA, title);
    await pageA.goto(`/workarea?project=${projectUuid}`);
    await waitForAppReady(pageA);
    const shareUrl = await getShareUrl(pageA);
    await joinSharedProject(pageB, shareUrl);
    await waitForYjsSync(pageA);
    await waitForYjsSync(pageB);
    await selectFirstPage(pageA);
    await selectFirstPage(pageB);
    return projectUuid;
}

/** User B writes straight into the Y.Doc, the way a modified client would. */
async function injectRemoteContent(page: Page, html: string, icon: { source: string; value: string }) {
    return page.evaluate(
        ({ htmlContent, iconDescriptor }) => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            const binding = bridge?.structureBinding;
            const pageId = bridge?.documentManager?.getNavigation()?.get(0)?.get('id');
            if (!binding || !pageId) throw new Error('Yjs project structure is not available');
            const blockId = binding.createBlock(pageId, 'Remote block');
            binding.updateBlock(blockId, { icon: iconDescriptor });
            binding.createComponent(pageId, blockId, 'text', {
                id: 'idevice-remote-xss',
                htmlContent,
                jsonProperties: '{}',
            });
            return blockId;
        },
        { htmlContent: html, iconDescriptor: icon },
    );
}

/** Wait until every image in the content has finished (or failed) loading, so handlers would have fired. */
async function waitForImagesSettled(page: Page) {
    await page.waitForFunction(() =>
        Array.from(document.querySelectorAll('#node-content img')).every(img => (img as HTMLImageElement).complete),
    );
}

async function expectNoActiveContent(page: Page) {
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    const handlers = await page.evaluate(() =>
        Array.from(document.querySelectorAll('#node-content *')).flatMap(el =>
            Array.from(el.attributes)
                .filter(a => a.name.startsWith('on') || a.name === 'srcdoc' || /^\s*javascript:/i.test(a.value))
                .map(a => `${el.tagName.toLowerCase()}[${a.name}]`),
        ),
    );
    expect(handlers).toEqual([]);
}

const MALICIOUS_HTML = [
    '<p class="legit-remote">Legitimate remote paragraph</p>',
    `<img src="missing-image.png" onerror="${CANARY}('img')">`,
    `<svg><a xlink:href="javascript:${CANARY}('svg')"><text>svg</text></a></svg>`,
    `<iframe srcdoc="<script>${CANARY}('srcdoc')</script>"></iframe>`,
    `<details open ontoggle="${CANARY}('details')"><summary>s</summary></details>`,
    `<input autofocus onfocus="${CANARY}('focus')">`,
    `<a href="java&#x09;script:${CANARY}('href')" id="remote-link">link</a>`,
    `<script>${CANARY}('script')</script>`,
].join('');

const MALICIOUS_ICON = { source: 'asset', value: `asset://missing/icon.png" onerror="${CANARY}('icon')` };

test.describe('Collaborator content cannot run in other editors', () => {
    test.setTimeout(180000);

    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'WebSocket collaboration');
    });

    test('remote iDevice HTML and block icon render inert, live and after a reload', async ({
        authenticatedPage,
        secondAuthenticatedPage,
        createProject,
        getShareUrl,
        joinSharedProject,
    }) => {
        const pageA = authenticatedPage;
        const pageB = secondAuthenticatedPage;
        const dialogs: string[] = [];
        pageA.on('dialog', async dialog => {
            // The reload below may raise the unsaved-changes prompt; anything else is a payload.
            if (dialog.type() === 'beforeunload') return dialog.accept();
            dialogs.push(dialog.message());
            await dialog.dismiss();
        });

        await openSharedProject(pageA, pageB, createProject, getShareUrl, joinSharedProject, 'Remote XSS render');

        await injectRemoteContent(pageB, MALICIOUS_HTML, MALICIOUS_ICON);

        // Live remote render on User A.
        const remote = pageA.locator('.idevice_node#idevice-remote-xss');
        await expect(remote.locator('.legit-remote')).toHaveText('Legitimate remote paragraph', { timeout: 30000 });
        await expect(remote.locator('#remote-link')).toHaveText('link');
        await waitForImagesSettled(pageA);
        await expectNoActiveContent(pageA);

        // Clicking the neutralized link must not run anything either.
        await remote.locator('#remote-link').click();
        await expectNoActiveContent(pageA);

        // Full render from the persisted document (page reload path).
        await pageA.reload();
        await waitForAppReady(pageA);
        await selectFirstPage(pageA);
        await expect(pageA.locator('.idevice_node#idevice-remote-xss .legit-remote')).toHaveText(
            'Legitimate remote paragraph',
            { timeout: 30000 },
        );
        await waitForImagesSettled(pageA);
        await expectNoActiveContent(pageA);

        // The stored content itself is untouched: exports still get what was written.
        const stored = await pageA.evaluate(() => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            return bridge?.structureBinding?.getComponent('idevice-remote-xss')?.htmlContent;
        });
        expect(stored).toContain('legit-remote');

        expect(dialogs).toEqual([]);
    });

    test('a crafted project language cannot select which script the editor runs', async ({
        authenticatedPage,
        secondAuthenticatedPage,
        createProject,
        getShareUrl,
        joinSharedProject,
    }) => {
        const pageA = authenticatedPage;
        const pageB = secondAuthenticatedPage;

        await openSharedProject(pageA, pageB, createProject, getShareUrl, joinSharedProject, 'Remote language');

        // If the language reached the URL, the browser would normalize it to this file.
        // (No '-' in the value: the loader keeps only the part before the first one.)
        let canaryRequested = false;
        await pageA.route('**/xsscanary.js', async route => {
            canaryRequested = true;
            await route.fulfill({ contentType: 'application/javascript', body: "window.__xss = ['lang'];" });
        });
        await pageA.evaluate(() => {
            delete (window as any).$exe_i18n;
        });

        // Only script loads matter here; the JSON catalogue request is not executed.
        const i18nRequest = pageA.waitForRequest(req => /common_i18n\.|xsscanary\.js/.test(req.url()));
        await pageB.evaluate(() => {
            const metadata = (window as any).eXeLearning.app.project._yjsBridge.documentManager.getMetadata();
            metadata.set('language', 'x/../../../../libs/xsscanary');
        });
        const request = await i18nRequest;

        await pageA.waitForFunction(
            () => (window as any).$exe_i18n !== undefined || (window as any).__xss !== undefined,
        );
        expect(canaryRequested).toBe(false);
        expect(request.url()).toMatch(/\/common_i18n\.en\.js$/);
        expect(await pageA.evaluate(() => (window as any).__xss)).toBeUndefined();

        // A legitimate language change still loads its bundle.
        const esRequest = pageA.waitForRequest(req => /common_i18n\.es\.js$/.test(req.url()));
        await pageB.evaluate(() => {
            const metadata = (window as any).eXeLearning.app.project._yjsBridge.documentManager.getMetadata();
            metadata.set('language', 'es');
        });
        await esRequest;
    });

    test('the auto-generated screenshot renders collaborator HTML without running it', async ({
        authenticatedPage,
        secondAuthenticatedPage,
        createProject,
        getShareUrl,
        joinSharedProject,
    }) => {
        const pageA = authenticatedPage;
        const pageB = secondAuthenticatedPage;

        await openSharedProject(pageA, pageB, createProject, getShareUrl, joinSharedProject, 'Remote screenshot');
        await injectRemoteContent(pageB, MALICIOUS_HTML, { source: 'none', value: '' });
        await expect(pageA.locator('.idevice_node#idevice-remote-xss .legit-remote')).toBeVisible({ timeout: 30000 });

        const screenshot = await pageA.evaluate(async () => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            bridge.documentManager.getMetadata().delete('screenshot');
            await bridge.generateScreenshotFromFirstPage();
            return bridge.documentManager.getMetadata().get('screenshot') || null;
        });

        // The capture still works in the script-disabled frame...
        expect(screenshot).toMatch(/^data:image\/png;base64,/);
        // ...and nothing in the captured page ran.
        expect(await pageA.evaluate(() => (window as any).__xss)).toBeUndefined();
    });
});
