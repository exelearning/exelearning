import { test, expect, skipInStaticMode } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';
import { gotoWorkarea, waitForAppReady, waitForLoadingScreen, selectNavNode } from '../helpers/workarea-helpers';

/**
 * E2E regression tests for issue #1129:
 * Undo must visually update block structure immediately (no page switch/reload required).
 */

async function selectPageNode(page: Page): Promise<void> {
    const pageNodeSelectors = [
        '.nav-element:not([nav-id="root"]) .nav-element-text',
        '.structure-tree .nav-element:not([nav-id="root"]) .nav-element-text',
    ];

    for (const selector of pageNodeSelectors) {
        const element = page.locator(selector).first();
        if ((await element.count()) > 0) {
            try {
                await element.waitFor({ state: 'visible', timeout: 5000 });
                await element.click({ timeout: 5000 });
                await page.waitForTimeout(500);
                return;
            } catch {
                // try next selector
            }
        }
    }

    throw new Error('Unable to select a non-root page node');
}

async function createTargetPageViaYjs(page: Page): Promise<string> {
    const targetPageId = await page.evaluate(() => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        const binding = bridge?.structureBinding;
        if (!binding) return '';
        const created = binding.createPage(`Target page ${Date.now()}`);
        return created?.id || created?.pageId || '';
    });

    if (!targetPageId) {
        throw new Error('Failed to create target page via Yjs');
    }

    await page.locator(`.nav-element[nav-id="${targetPageId}"]`).first().waitFor({ state: 'visible', timeout: 10000 });
    return targetPageId;
}

async function addBlockViaYjs(page: Page, pageId: string, blockName: string): Promise<string> {
    const blockId = await page.evaluate(
        ({ targetPageId, name }) => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            if (!bridge?.addBlock) return '';
            return bridge.addBlock(targetPageId, name) || '';
        },
        { targetPageId: pageId, name: blockName },
    );

    if (!blockId) {
        throw new Error('Failed to add block via Yjs');
    }

    return blockId;
}

async function moveFirstBlockToPageViaYjs(page: Page, targetPageId: string): Promise<void> {
    const sourcePageId = await getCurrentPageId(page);
    if (!sourcePageId) {
        throw new Error('No current page selected for move operation');
    }

    const firstBlockId = await page.evaluate(pageId => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        const blocks = bridge?.structureBinding?.getBlocks?.(pageId) || [];
        return blocks[0]?.id || '';
    }, sourcePageId);
    if (!firstBlockId) {
        throw new Error('No block found to move');
    }

    const moved = await page.evaluate(
        ({ blockId, newPageId }) => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            return bridge?.structureBinding?.moveBlockToPage?.(blockId, newPageId) === true;
        },
        { blockId: firstBlockId, newPageId: targetPageId },
    );

    if (!moved) {
        throw new Error('Failed to move block via Yjs');
    }
}

async function deleteFirstBlockViaYjs(page: Page): Promise<void> {
    const currentPageId = await getCurrentPageId(page);
    if (!currentPageId) {
        throw new Error('No current page selected for delete operation');
    }

    const firstBlockId = await page.evaluate(pageId => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        const blocks = bridge?.structureBinding?.getBlocks?.(pageId) || [];
        return blocks[0]?.id || '';
    }, currentPageId);
    if (!firstBlockId) {
        throw new Error('No block found to delete');
    }

    const deleted = await page.evaluate(
        ({ pageId, blockId }) => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            return bridge?.structureBinding?.deleteBlock?.(pageId, blockId) === true;
        },
        { pageId: currentPageId, blockId: firstBlockId },
    );

    if (!deleted) {
        throw new Error('Failed to delete block via Yjs');
    }
}

async function getCurrentPageId(page: Page): Promise<string> {
    return page.evaluate(() => {
        const selected = document.querySelector('.nav-element.selected:not([nav-id="root"])');
        return selected?.getAttribute('nav-id') || '';
    });
}

async function countBlocks(page: Page): Promise<number> {
    return page.locator('#node-content article.box').count();
}

async function waitForBlockCountChange(page: Page, previousCount: number, timeout = 10000): Promise<number> {
    await page.waitForFunction(
        prev => document.querySelectorAll('#node-content article.box').length !== prev,
        previousCount,
        { timeout },
    );
    return countBlocks(page);
}

async function reloadCurrentPageFromYjs(page: Page): Promise<void> {
    await page.evaluate(async () => {
        const app = (window as any).eXeLearning?.app;
        const selectedNavId = app?.project?.structure?.menuStructureBehaviour?.nodeSelected?.getAttribute?.('nav-id');
        if (!selectedNavId) return;

        const pageElement = app?.project?.structure?.menuStructureBehaviour?.menuNav?.querySelector?.(
            `.nav-element[nav-id="${selectedNavId}"]`,
        );

        if (pageElement && app?.project?.idevices?.loadApiIdevicesInPage) {
            await app.project.idevices.loadApiIdevicesInPage(false, pageElement);
        }
    });
}

async function clearUndoHistory(page: Page): Promise<void> {
    await page.evaluate(() => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        const undoManager = bridge?.documentManager?.undoManager;
        if (undoManager?.clear) {
            undoManager.clear();
        }
        if (bridge?.updateUndoRedoButtons) {
            bridge.updateUndoRedoButtons();
        }
    });
    await page.waitForTimeout(200);
}

async function getYjsBlockCount(page: Page, pageId: string): Promise<number> {
    return page.evaluate(targetPageId => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        const blocks = bridge?.structureBinding?.getBlocks?.(targetPageId) || [];
        return blocks.length;
    }, pageId);
}

async function clickUndoButton(page: Page): Promise<void> {
    const undoBtn = page.locator('button[title*="Undo"]').first();
    await undoBtn.waitFor({ state: 'visible', timeout: 5000 });
    await expect(undoBtn).toBeEnabled();
    await undoBtn.click();
    await page.waitForTimeout(400);
}

test.describe('Undo/Redo Block Structure - Issue #1129', () => {
    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'Requires server for project creation and Yjs undo');
    });

    test('undo should immediately remove a just-created block in current page', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Undo Block Create');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await waitForLoadingScreen(page);
        await clearUndoHistory(page);
        await selectPageNode(page);

        const sourcePageId = await getCurrentPageId(page);
        expect(sourcePageId).not.toBe('');

        const initialCount = await countBlocks(page);
        await addBlockViaYjs(page, sourcePageId, `Create test block ${Date.now()}`);
        await reloadCurrentPageFromYjs(page);
        const countAfterCreate = await waitForBlockCountChange(page, initialCount);
        expect(countAfterCreate).not.toBe(initialCount);

        const countBeforeUndo = await countBlocks(page);
        await page.waitForTimeout(700);
        await clickUndoButton(page);
        const countAfterUndo = await waitForBlockCountChange(page, countBeforeUndo);
        expect(countAfterUndo).not.toBe(countBeforeUndo);
    });

    test('undo should immediately restore a deleted block in current page', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Undo Block Delete');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await waitForLoadingScreen(page);
        await selectPageNode(page);
        const sourcePageId = await getCurrentPageId(page);
        expect(sourcePageId).not.toBe('');
        const refreshPageId = await createTargetPageViaYjs(page);
        expect(refreshPageId).not.toBe('');
        await selectNavNode(page, sourcePageId);

        await addBlockViaYjs(page, sourcePageId, `Delete test block ${Date.now()}`);
        await reloadCurrentPageFromYjs(page);
        await clearUndoHistory(page);

        const countBeforeDelete = await countBlocks(page);
        expect(countBeforeDelete).toBeGreaterThan(0);

        const yjsCountBeforeDelete = await getYjsBlockCount(page, sourcePageId);
        await deleteFirstBlockViaYjs(page);
        const yjsCountAfterDelete = await getYjsBlockCount(page, sourcePageId);
        expect(yjsCountAfterDelete).toBeLessThan(yjsCountBeforeDelete);

        // Force visual refresh without mutating Yjs/undo history.
        await selectNavNode(page, refreshPageId);
        await selectNavNode(page, sourcePageId);
        const countAfterDelete = await countBlocks(page);
        expect(countAfterDelete).toBeLessThan(countBeforeDelete);

        const countBeforeUndo = await countBlocks(page);
        await page.waitForTimeout(700);
        await clickUndoButton(page);
        const countAfterUndo = await waitForBlockCountChange(page, countBeforeUndo);
        expect(countAfterUndo).not.toBe(countBeforeUndo);
    });

    test('undo should immediately restore block moved to another page without navigation', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Undo Block Move Page');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await waitForLoadingScreen(page);
        await selectPageNode(page);

        const sourcePageId = await getCurrentPageId(page);
        expect(sourcePageId).not.toBe('');

        const targetPageId = await createTargetPageViaYjs(page);
        expect(targetPageId).not.toBe('');

        await selectNavNode(page, sourcePageId);

        await addBlockViaYjs(page, sourcePageId, `Move test block ${Date.now()}`);
        await reloadCurrentPageFromYjs(page);
        const sourceCountBeforeMove = await countBlocks(page);
        expect(sourceCountBeforeMove).toBeGreaterThan(0);
        await clearUndoHistory(page);

        const yjsCountBeforeMove = await getYjsBlockCount(page, sourcePageId);
        await moveFirstBlockToPageViaYjs(page, targetPageId);
        const yjsCountAfterMove = await getYjsBlockCount(page, sourcePageId);
        expect(yjsCountAfterMove).toBeLessThan(yjsCountBeforeMove);

        // Force visual refresh without mutating Yjs/undo history.
        await selectNavNode(page, targetPageId);
        await selectNavNode(page, sourcePageId);
        const sourceCountAfterMove = await countBlocks(page);
        expect(sourceCountAfterMove).toBeLessThan(sourceCountBeforeMove);

        const countBeforeUndo = await countBlocks(page);
        await page.waitForTimeout(700);
        await clickUndoButton(page);
        const sourceCountAfterUndo = await waitForBlockCountChange(page, countBeforeUndo);
        expect(sourceCountAfterUndo).not.toBe(countBeforeUndo);
    });
});
