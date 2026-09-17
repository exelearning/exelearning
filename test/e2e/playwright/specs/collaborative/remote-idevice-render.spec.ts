import type { Page } from '@playwright/test';
import { expect, skipInStaticMode, test } from '../../fixtures/collaboration.fixture';
import { getTextIdeviceId, ideviceLocator, waitForTextIdeviceEditor } from '../../helpers/idevice-collab-helpers';
import { waitForYjsSync } from '../../helpers/sync-helpers';
import {
    addIdevice,
    addTextIdevice,
    saveIdevice,
    selectFirstPage,
    waitForAppReady,
} from '../../helpers/workarea-helpers';

/**
 * Regression tests for issue #2428:
 * "Collaborative mode: newly added iDevices are not fully rendered for other
 * users until page refresh".
 *
 * When User A saves an iDevice, User B receives it through Yjs and renders it
 * incrementally (no page reload). That incremental path must run the same
 * post-render hooks as a page load or a local save: ABC music notation
 * (TinyMCE plugin), legacy effects, games, highlighter and internal links.
 * Otherwise User B sees the raw source (music) or an inert game until they
 * navigate away and back.
 */

const ABC_NOTATION_HTML = [
    '<p>Score:</p>',
    '<pre class="abc-music">X:1',
    'T:Remote score',
    'M:4/4',
    'L:1/4',
    'K:C',
    'C D E F|G A B c|</pre>',
].join('\n');

async function openSharedProject(
    pageA: Page,
    pageB: Page,
    createProject: (page: Page, title?: string) => Promise<string>,
    getShareUrl: (page: Page) => Promise<string>,
    joinSharedProject: (page: Page, shareUrl: string) => Promise<void>,
    projectTitle: string,
): Promise<void> {
    const projectUuid = await createProject(pageA, projectTitle);
    await pageA.goto(`/workarea?project=${projectUuid}`);
    await waitForAppReady(pageA);

    const shareUrl = await getShareUrl(pageA);
    await joinSharedProject(pageB, shareUrl);
    await waitForYjsSync(pageA);
    await waitForYjsSync(pageB);

    await selectFirstPage(pageA);
    await selectFirstPage(pageB);
}

async function setTextIdeviceContent(page: Page, html: string): Promise<void> {
    await waitForTextIdeviceEditor(page);
    await page.evaluate(content => {
        const editor = (window as any).tinymce.get('textTextarea');
        editor.setContent(content);
        editor.fire('change');
        editor.setDirty(true);
    }, html);
}

test.describe('Remote iDevice rendering after a collaborator saves (#2428)', () => {
    test.setTimeout(120000);

    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'WebSocket collaboration');
    });

    test('music notation saved by User A is rendered as a score for User B without navigating', async ({
        authenticatedPage,
        secondAuthenticatedPage,
        createProject,
        getShareUrl,
        joinSharedProject,
    }) => {
        const pageA = authenticatedPage;
        const pageB = secondAuthenticatedPage;

        await openSharedProject(pageA, pageB, createProject, getShareUrl, joinSharedProject, 'Remote ABC music render');

        await addTextIdevice(pageA);
        const ideviceId = await getTextIdeviceId(pageA);
        await setTextIdeviceContent(pageA, ABC_NOTATION_HTML);
        await saveIdevice(pageA, ideviceId);

        // Local save renders the score (sanity check of the fixture itself).
        await expect(ideviceLocator(pageA, ideviceId).locator('.abcjs-paper svg')).toBeVisible({ timeout: 20000 });

        // Remote client: the iDevice arrives through Yjs and must be rendered the
        // same way, without any navigation or reload.
        const remoteIdevice = ideviceLocator(pageB, ideviceId);
        await expect(remoteIdevice).toBeVisible({ timeout: 20000 });
        await expect(remoteIdevice.locator('pre.abc-music')).toHaveCount(1, { timeout: 20000 });
        await expect(remoteIdevice.locator('.abcjs-paper svg')).toBeVisible({ timeout: 20000 });
    });

    test('A-Z quiz game saved by User A is playable for User B without navigating', async ({
        authenticatedPage,
        secondAuthenticatedPage,
        createProject,
        getShareUrl,
        joinSharedProject,
    }) => {
        const pageA = authenticatedPage;
        const pageB = secondAuthenticatedPage;

        await openSharedProject(pageA, pageB, createProject, getShareUrl, joinSharedProject, 'Remote A-Z quiz render');

        await addIdevice(pageA, 'az-quiz-game');
        const localIdevice = pageA.locator('#node-content article .idevice_node.az-quiz-game').first();
        const ideviceId = await localIdevice.getAttribute('id');
        expect(ideviceId).toBeTruthy();

        // The edition form validates through its TinyMCE instances: wait for them.
        await pageA.waitForFunction(
            () => {
                const editors = (window as any).tinymce?.editors || [];
                return editors.length >= 2 && editors.every((e: any) => e.initialized);
            },
            undefined,
            { timeout: 20000 },
        );
        await pageA.locator('.roscoWordEdition').first().fill('Alpha');
        await pageA.locator('.roscoDefinitionEdition').first().fill('First letter of the alphabet');
        await saveIdevice(pageA, ideviceId as string);

        // Local save renders the game board.
        await expect(localIdevice.locator('.rosco-MainContainer')).toBeVisible({ timeout: 20000 });

        // Remote client must get the same game board, not an empty or inert body.
        const remoteIdevice = ideviceLocator(pageB, ideviceId as string);
        await expect(remoteIdevice).toBeVisible({ timeout: 20000 });
        await expect(remoteIdevice.locator('.rosco-MainContainer')).toBeVisible({ timeout: 20000 });
    });
});

/**
 * Regression test for the defect found while reviewing the fix above (#2434):
 * rendering a remote iDevice must not tear down the scripts of the whole page.
 *
 * clearNeedlessScripts() removes every `head > script:not(.exe)`, edition
 * scripts included, and only the export ones were put back. A single remote
 * save produces several updates, so the page-wide teardown left the shared
 * `$exeDevice` global out of sync with the tags in <head>, and a later local
 * save exhausted the export-load retry loop and raised "Failed to load the
 * iDevice view" instead of saving.
 */
test.describe('A remote render must not disturb the local page runtime (#2434)', () => {
    test.setTimeout(120000);

    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'WebSocket collaboration');
    });

    /** Tag the scripts already in <head> so we can tell survivors from replacements. */
    function markLoadedScripts(page: Page): Promise<number> {
        return page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('head > script[src]'));
            scripts.forEach(script => script.setAttribute('data-e2e-marked', '1'));
            return scripts.length;
        });
    }

    function countMarkedScripts(page: Page): Promise<number> {
        return page.evaluate(() => document.querySelectorAll('head > script[data-e2e-marked="1"]').length);
    }

    /**
     * Write into the editor that belongs to a given iDevice. `tinymce.get()`
     * can still hand back a removed instance right after an editor is reopened,
     * and writing there silently loses the content.
     */
    async function setTextIdeviceContentIn(page: Page, ideviceId: string, html: string): Promise<void> {
        await page.waitForFunction(
            id => {
                const editor = (window as any).tinymce?.get('textTextarea');
                if (!editor || !editor.initialized || editor.removed) return false;
                const node = document.getElementById(id as string);
                const container = editor.getContainer?.() || editor.getElement?.();
                return !!node && !!container && node.contains(container);
            },
            ideviceId,
            { timeout: 20000 },
        );
        await setTextIdeviceContent(page, html);
    }

    test('User B keeps its loaded scripts and can still edit and save', async ({
        authenticatedPage,
        secondAuthenticatedPage,
        createProject,
        getShareUrl,
        joinSharedProject,
    }) => {
        const pageA = authenticatedPage;
        const pageB = secondAuthenticatedPage;

        await openSharedProject(
            pageA,
            pageB,
            createProject,
            getShareUrl,
            joinSharedProject,
            'Remote render keeps runtime',
        );

        // B owns a text iDevice, so its scripts are loaded on B's page.
        await addTextIdevice(pageB);
        const ideviceB = await getTextIdeviceId(pageB);
        await setTextIdeviceContent(pageB, '<p>First draft from user B</p>');
        await saveIdevice(pageB, ideviceB);

        const markedScripts = await markLoadedScripts(pageB);
        expect(markedScripts).toBeGreaterThan(0);

        // A saves an HTML-type iDevice: the case that does need its own export
        // script executed again on B.
        await addIdevice(pageA, 'az-quiz-game');
        const ideviceA = await pageA
            .locator('#node-content article .idevice_node.az-quiz-game')
            .first()
            .getAttribute('id');
        expect(ideviceA).toBeTruthy();
        await pageA.waitForFunction(
            () => {
                const editors = (window as any).tinymce?.editors || [];
                return editors.length >= 2 && editors.every((e: any) => e.initialized);
            },
            undefined,
            { timeout: 20000 },
        );
        await pageA.locator('.roscoWordEdition').first().fill('Alpha');
        await pageA.locator('.roscoDefinitionEdition').first().fill('First letter of the alphabet');
        await saveIdevice(pageA, ideviceA as string);

        const remoteIdevice = ideviceLocator(pageB, ideviceA as string);
        await expect(remoteIdevice).toBeVisible({ timeout: 20000 });
        await expect(remoteIdevice.locator('.rosco-MainContainer')).toBeVisible({ timeout: 20000 });

        // The remote render must have left every script B had loaded in place.
        expect(await countMarkedScripts(pageB)).toBe(markedScripts);

        // And B must still be able to edit and save, instead of exhausting the
        // export-load retry loop and raising "Failed to load the iDevice view".
        const ownIdevice = ideviceLocator(pageB, ideviceB);
        await ownIdevice.hover();
        await ownIdevice.locator('.btn-edit-idevice').first().click({ force: true });
        await setTextIdeviceContentIn(pageB, ideviceB, '<p>Second draft from user B</p>');
        await saveIdevice(pageB, ideviceB);

        await expect(ownIdevice).toContainText('Second draft from user B', { timeout: 20000 });
        await expect(pageB.locator('.modal.show')).toHaveCount(0);
    });
});
