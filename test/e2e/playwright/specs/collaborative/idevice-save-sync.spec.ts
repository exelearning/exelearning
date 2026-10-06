import type { Page } from '@playwright/test';
import { expect, skipInStaticMode, test } from '../../fixtures/collaboration.fixture';
import {
    DISCARDED_IDEVICE_CONTENT,
    ORIGINAL_IDEVICE_CONTENT,
    UPDATED_IDEVICE_CONTENT,
    confirmDiscardModal,
    expectUnsavedTextDoesNotLeak,
    fillTextIdeviceEditor,
    getTextIdeviceId,
    getTinyMCEPlainText,
    getVisibleIdeviceText,
    ideviceLocator,
    isIdeviceCollabSessionAlive,
    markIdeviceCollabSession,
} from '../../helpers/idevice-collab-helpers';
import {
    getIdeviceLockState,
    getYjsComponentPlainText,
    waitForIdeviceLockedByMe,
    waitForIdeviceLockedByOther,
    waitForIdeviceUnlocked,
    waitForTextInContent,
    waitForYjsComponentText,
    waitForYjsSync,
} from '../../helpers/sync-helpers';
import {
    addTextIdevice,
    editIdevice,
    saveIdevice,
    selectFirstPage,
    waitForAppReady,
    waitForIdeviceEditionEnd,
    waitForTinyMCEReady,
} from '../../helpers/workarea-helpers';

/**
 * Collaborative iDevice save/lock contract (issue #2169, PR #2267).
 *
 * Collaboration is not character-by-character TinyMCE editing. An iDevice is
 * edited under an exclusive lock and the complete iDevice is synchronized when
 * it is saved. Unsaved editor changes must stay local. After Save, the remote
 * client must refresh the rendered iDevice without a browser reload or
 * navigation.
 */

async function openSharedProjectWithSavedTextIdevice(
    pageA: Page,
    pageB: Page,
    createProject: (page: Page, title?: string) => Promise<string>,
    getShareUrl: (page: Page) => Promise<string>,
    joinSharedProject: (page: Page, shareUrl: string) => Promise<void>,
    projectTitle: string,
): Promise<string> {
    const projectUuid = await createProject(pageA, projectTitle);
    await pageA.goto(`/workarea?project=${projectUuid}`);
    await waitForAppReady(pageA);

    const shareUrl = await getShareUrl(pageA);
    await joinSharedProject(pageB, shareUrl);
    await waitForYjsSync(pageA);
    await waitForYjsSync(pageB);

    await selectFirstPage(pageA);
    await selectFirstPage(pageB);

    await addTextIdevice(pageA);
    const ideviceId = await getTextIdeviceId(pageA);

    await fillTextIdeviceEditor(pageA, ORIGINAL_IDEVICE_CONTENT);
    await saveIdevice(pageA, ideviceId);
    await expect(ideviceLocator(pageA, ideviceId)).toContainText(ORIGINAL_IDEVICE_CONTENT, { timeout: 15000 });
    await waitForYjsComponentText(pageA, ideviceId, ORIGINAL_IDEVICE_CONTENT);

    await expect(pageB.locator('#node-content article .idevice_node.text').first()).toBeVisible({ timeout: 20000 });
    await expect(ideviceLocator(pageB, ideviceId)).toBeVisible({ timeout: 20000 });
    await waitForYjsComponentText(pageB, ideviceId, ORIGINAL_IDEVICE_CONTENT);
    await waitForTextInContent(pageB, ORIGINAL_IDEVICE_CONTENT, 20000);
    await expect(ideviceLocator(pageB, ideviceId).locator('.idevice_body')).toContainText(ORIGINAL_IDEVICE_CONTENT, {
        timeout: 20000,
    });
    await waitForIdeviceUnlocked(pageA, ideviceId);
    await waitForIdeviceUnlocked(pageB, ideviceId);

    await markIdeviceCollabSession(pageA);
    await markIdeviceCollabSession(pageB);

    return ideviceId;
}

test.describe('Collaborative iDevice lock and save sync (#2169)', () => {
    test.setTimeout(90000);

    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'WebSocket collaboration');
    });

    test('Client A save refreshes Client B automatically without character-level sync', async ({
        authenticatedPage,
        secondAuthenticatedPage,
        createProject,
        getShareUrl,
        joinSharedProject,
    }) => {
        const pageA = authenticatedPage;
        const pageB = secondAuthenticatedPage;

        const ideviceId = await openSharedProjectWithSavedTextIdevice(
            pageA,
            pageB,
            createProject,
            getShareUrl,
            joinSharedProject,
            'Collaborative iDevice Save Sync',
        );

        await editIdevice(pageA, ideviceId);
        await waitForTinyMCEReady(pageA);
        await waitForIdeviceLockedByMe(pageA, ideviceId);
        await waitForIdeviceLockedByOther(pageB, ideviceId);

        const lockOnA = await getIdeviceLockState(pageA, ideviceId);
        const lockOnB = await getIdeviceLockState(pageB, ideviceId);
        expect(lockOnA.isLockedByMe).toBe(true);
        expect(lockOnA.mode).toBe('edition');
        expect(lockOnB.isLockedByOther || lockOnB.editDisabled).toBe(true);
        expect(lockOnB.mode).not.toBe('edition');

        const editBtnOnB = ideviceLocator(pageB, ideviceId).locator('.btn-edit-idevice');
        if (lockOnB.editDisabled) {
            await expect(editBtnOnB).toBeDisabled();
        } else {
            await editBtnOnB.click();
            const lockedAlert = pageB.locator('#modalAlert, .modal.show').filter({
                hasText: /locked|being edited/i,
            });
            if ((await lockedAlert.count()) > 0) {
                await expect(lockedAlert.first()).toBeVisible();
            }
        }
        await expect(ideviceLocator(pageB, ideviceId)).not.toHaveAttribute('mode', 'edition');

        await fillTextIdeviceEditor(pageA, UPDATED_IDEVICE_CONTENT);
        await expectUnsavedTextDoesNotLeak(pageA, pageB, ideviceId, UPDATED_IDEVICE_CONTENT, ORIGINAL_IDEVICE_CONTENT);

        // Re-apply immediately before Save. TinyMCE can reload last-saved JSON while we
        // wait for the unsaved-leak assertion, and Save reads the live editor.
        await fillTextIdeviceEditor(pageA, UPDATED_IDEVICE_CONTENT);
        await saveIdevice(pageA, ideviceId);
        await waitForYjsComponentText(pageA, ideviceId, UPDATED_IDEVICE_CONTENT);
        await waitForYjsComponentText(pageB, ideviceId, UPDATED_IDEVICE_CONTENT);

        // Critical regression: Yjs update must refresh the remote view without reload/navigation.
        await expect(ideviceLocator(pageB, ideviceId)).toContainText(UPDATED_IDEVICE_CONTENT, { timeout: 20000 });
        await waitForTextInContent(pageB, UPDATED_IDEVICE_CONTENT, 20000);
        expect(await isIdeviceCollabSessionAlive(pageB)).toBe(true);
        expect(await isIdeviceCollabSessionAlive(pageA)).toBe(true);
        expect(pageB.url()).toContain('/workarea');

        await waitForIdeviceUnlocked(pageA, ideviceId);
        await waitForIdeviceUnlocked(pageB, ideviceId);
        await expect
            .poll(() => getIdeviceLockState(pageB, ideviceId))
            .toMatchObject({
                isLockedByOther: false,
                editDisabled: false,
            });

        await editIdevice(pageB, ideviceId);
        await waitForTinyMCEReady(pageB);
        await waitForIdeviceLockedByMe(pageB, ideviceId);
        expect(await getTinyMCEPlainText(pageB)).toContain(UPDATED_IDEVICE_CONTENT);
    });

    test('discarding unsaved iDevice edits does not write to Yjs or the remote view', async ({
        authenticatedPage,
        secondAuthenticatedPage,
        createProject,
        getShareUrl,
        joinSharedProject,
    }) => {
        const pageA = authenticatedPage;
        const pageB = secondAuthenticatedPage;

        const ideviceId = await openSharedProjectWithSavedTextIdevice(
            pageA,
            pageB,
            createProject,
            getShareUrl,
            joinSharedProject,
            'Collaborative iDevice Discard',
        );

        await editIdevice(pageA, ideviceId);
        await waitForTinyMCEReady(pageA);
        await waitForIdeviceLockedByMe(pageA, ideviceId);
        await waitForIdeviceLockedByOther(pageB, ideviceId);

        await fillTextIdeviceEditor(pageA, DISCARDED_IDEVICE_CONTENT);
        await expectUnsavedTextDoesNotLeak(
            pageA,
            pageB,
            ideviceId,
            DISCARDED_IDEVICE_CONTENT,
            ORIGINAL_IDEVICE_CONTENT,
        );

        await ideviceLocator(pageA, ideviceId).locator('.btn-undo-idevice').click();
        await confirmDiscardModal(pageA);
        await waitForIdeviceEditionEnd(pageA, ideviceId);

        const yjsAfterDiscardA = await getYjsComponentPlainText(pageA, ideviceId);
        const yjsAfterDiscardB = await getYjsComponentPlainText(pageB, ideviceId);
        expect(yjsAfterDiscardA).toContain(ORIGINAL_IDEVICE_CONTENT);
        expect(yjsAfterDiscardA).not.toContain(DISCARDED_IDEVICE_CONTENT);
        expect(yjsAfterDiscardB).toContain(ORIGINAL_IDEVICE_CONTENT);
        expect(yjsAfterDiscardB).not.toContain(DISCARDED_IDEVICE_CONTENT);

        await expect(ideviceLocator(pageA, ideviceId)).toContainText(ORIGINAL_IDEVICE_CONTENT, { timeout: 15000 });
        await expect(ideviceLocator(pageB, ideviceId)).toContainText(ORIGINAL_IDEVICE_CONTENT, { timeout: 15000 });
        expect(await getVisibleIdeviceText(pageB, ideviceId)).not.toContain(DISCARDED_IDEVICE_CONTENT);
        expect(await isIdeviceCollabSessionAlive(pageB)).toBe(true);

        await waitForIdeviceUnlocked(pageA, ideviceId);
        await waitForIdeviceUnlocked(pageB, ideviceId);
        await expect
            .poll(() => getIdeviceLockState(pageB, ideviceId))
            .toMatchObject({
                isLockedByOther: false,
                editDisabled: false,
            });
    });
});
