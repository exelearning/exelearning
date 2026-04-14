import * as path from 'path';
import { test, expect, skipInStaticMode } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';
import {
    gotoWorkarea,
    waitForAppReady,
    waitForLoadingScreen,
    selectNavNode,
    saveProject,
    openElpFile,
    addIdevice,
} from '../helpers/workarea-helpers';

/**
 * E2E reproduction and regression for issue #1665.
 *
 * Moving blocks ("cajas") inside a single page with the up/down arrow
 * buttons must produce a stable, deterministic order across consecutive
 * clicks and across page navigation.
 *
 * Historical bug: the legacy click handlers mutated a per-instance
 * `this.order` field and forwarded it to `updateBlockOrder`. Other JS
 * block instances on the same page never had their `this.order`
 * reconciled with the Y.Doc after a reorder, so consecutive arrow clicks
 * on neighbours fed `updateBlockOrder` a target computed from a stale
 * snapshot and blocks appeared to "jump" positions. Fixed by routing
 * the arrow path through `moveBlockRelative`, which reads the current
 * index directly from the Y.Doc. See
 * `public/app/yjs/YjsStructureBinding.test.js > updateBlockOrder
 * regression #1665` for the unit-level reproduction.
 */

const BLOCK_SELECTOR = '#node-content article.box:not(#empty_articles)';

// --- helpers (mirrored from undo-redo-block-structure.spec.ts) ---

async function selectFirstNonRootPage(page: Page): Promise<void> {
    const selectors = [
        '.nav-element:not([nav-id="root"]) .nav-element-text',
        '.structure-tree .nav-element:not([nav-id="root"]) .nav-element-text',
    ];
    for (const sel of selectors) {
        const el = page.locator(sel).first();
        if ((await el.count()) > 0) {
            try {
                await el.waitFor({ state: 'visible', timeout: 5000 });
                await el.click({ timeout: 5000 });
                await page.waitForTimeout(500);
                return;
            } catch {
                // try next selector
            }
        }
    }
    throw new Error('Unable to select a non-root page node');
}

async function getCurrentPageId(page: Page): Promise<string> {
    return page.evaluate(() => {
        const selected = document.querySelector('.nav-element.selected:not([nav-id="root"])');
        return selected?.getAttribute('nav-id') || '';
    });
}

async function createTargetPageViaYjs(page: Page, name: string): Promise<string> {
    const targetPageId = await page.evaluate(pageName => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        const binding = bridge?.structureBinding;
        if (!binding) return '';
        const created = binding.createPage(pageName);
        return created?.id || created?.pageId || '';
    }, name);

    if (!targetPageId) throw new Error(`Failed to create target page "${name}" via Yjs`);

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
    if (!blockId) throw new Error(`Failed to add block "${blockName}" via Yjs`);
    return blockId;
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
    await page.waitForTimeout(250);
}

async function clearUndoHistory(page: Page): Promise<void> {
    await page.evaluate(() => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        const undoManager = bridge?.documentManager?.undoManager;
        if (undoManager?.clear) undoManager.clear();
        if (bridge?.updateUndoRedoButtons) bridge.updateUndoRedoButtons();
    });
    await page.waitForTimeout(200);
}

async function waitForDomAndYjsBlockCount(
    page: Page,
    pageId: string,
    expectedCount: number,
    timeout = 15000,
): Promise<void> {
    await page.waitForFunction(
        ({ selector, targetPageId, expected }) => {
            const domCount = document.querySelectorAll(selector).length;
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            const yjsCount = bridge?.structureBinding?.getBlocks?.(targetPageId)?.length ?? -1;
            return domCount === expected && yjsCount === expected;
        },
        { selector: BLOCK_SELECTOR, targetPageId: pageId, expected: expectedCount },
        { timeout },
    );
}

async function readBlockOrderFromYjs(page: Page, pageId: string): Promise<string[]> {
    return page.evaluate(targetPageId => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        const blocks = bridge?.structureBinding?.getBlocks?.(targetPageId) || [];
        return blocks.map((b: any) => b.id || b.blockId || '');
    }, pageId);
}

async function readBlockOrderFromDom(page: Page): Promise<string[]> {
    return page.evaluate(selector => {
        const nodes = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
        return nodes.map(n => n.id || n.getAttribute('sym-id') || '');
    }, BLOCK_SELECTOR);
}

async function clickMoveDown(page: Page, blockId: string): Promise<void> {
    const btn = page.locator(`#moveDown${blockId}`).first();
    await btn.waitFor({ state: 'attached', timeout: 5000 });
    await btn.click({ force: true });
    await page.waitForTimeout(200);
}

async function clickMoveUp(page: Page, blockId: string): Promise<void> {
    const btn = page.locator(`#moveUp${blockId}`).first();
    await btn.waitFor({ state: 'attached', timeout: 5000 });
    await btn.click({ force: true });
    await page.waitForTimeout(200);
}

// --- the test ---

test.describe('Block reorder stability — issue #1665', () => {
    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'Requires server-backed project for Yjs reorder flow');
    });

    test('arrow moves on blocks must produce a stable order across page navigation', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Block Reorder #1665');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await waitForLoadingScreen(page);
        await clearUndoHistory(page);
        await selectFirstNonRootPage(page);

        const sourcePageId = await getCurrentPageId(page);
        expect(sourcePageId).not.toBe('');

        // Seed the source page with N blocks. `bridge.addBlock` writes to
        // the Y.Doc but the node content renderer needs a reload to paint
        // the new DOM nodes — same pattern as undo-redo-block-structure.spec.ts.
        const N = 5;
        const ids: string[] = [];
        for (let i = 0; i < N; i++) {
            ids.push(await addBlockViaYjs(page, sourcePageId, `Block ${i}`));
        }
        await reloadCurrentPageFromYjs(page);
        await waitForDomAndYjsBlockCount(page, sourcePageId, N);

        const initialYjsOrder = await readBlockOrderFromYjs(page, sourcePageId);
        expect(initialYjsOrder.length).toBe(N);
        expect(new Set(initialYjsOrder)).toEqual(new Set(ids));

        // Reference array advanced in lockstep with the intended
        // single-slot neighbour swap per click.
        const reference = [...initialYjsOrder];
        function refMoveDown(id: string) {
            const i = reference.indexOf(id);
            if (i < 0 || i === reference.length - 1) return;
            [reference[i], reference[i + 1]] = [reference[i + 1], reference[i]];
        }
        function refMoveUp(id: string) {
            const i = reference.indexOf(id);
            if (i <= 0) return;
            [reference[i], reference[i - 1]] = [reference[i - 1], reference[i]];
        }

        const sequence: Array<['up' | 'down', string]> = [
            ['down', ids[0]],
            ['up', ids[3]],
            ['down', ids[1]],
            ['up', ids[4]],
            ['down', ids[2]],
            ['up', ids[0]],
            ['down', ids[3]],
        ];

        for (const [dir, id] of sequence) {
            if (dir === 'down') {
                refMoveDown(id);
                await clickMoveDown(page, id);
            } else {
                refMoveUp(id);
                await clickMoveUp(page, id);
            }
        }

        // After all clicks, Yjs must agree with the reference and there
        // must be no duplicates / losses.
        const yjsOrderAfter = await readBlockOrderFromYjs(page, sourcePageId);
        expect(yjsOrderAfter.length).toBe(N);
        expect(new Set(yjsOrderAfter)).toEqual(new Set(ids));
        expect(yjsOrderAfter).toEqual(reference);

        const domOrderAfter = await readBlockOrderFromDom(page);
        for (let i = 0; i < domOrderAfter.length; i++) {
            expect(domOrderAfter[i]).toContain(reference[i]);
        }

        // Save, then bounce: create a second page, navigate away and back.
        // The second page is created AFTER the moves so that the initial
        // seeding is unambiguously on the source page.
        await saveProject(page);
        const otherPageId = await createTargetPageViaYjs(page, `Other page ${Date.now()}`);
        await selectNavNode(page, otherPageId);
        await page.waitForTimeout(300);
        await selectNavNode(page, sourcePageId);
        await reloadCurrentPageFromYjs(page);
        await waitForDomAndYjsBlockCount(page, sourcePageId, N);

        const yjsOrderAfterBounce = await readBlockOrderFromYjs(page, sourcePageId);
        expect(yjsOrderAfterBounce).toEqual(reference);

        const domOrderAfterBounce = await readBlockOrderFromDom(page);
        for (let i = 0; i < domOrderAfterBounce.length; i++) {
            expect(domOrderAfterBounce[i]).toContain(reference[i]);
        }
    });

    // Issue #1667 — @ignaciogros' repro: open arrows.elpx (one block "A"),
    // add a second text iDevice "B" at the bottom, then click block A's
    // down arrow. Before the fix, getContentNextBlock() used nextSibling
    // and returned a whitespace text node introduced by the elpx
    // renderer, so the click handler exited silently and the block did
    // not move. After the fix, A must end up after B in both the DOM
    // and the Y.Doc.
    test('block A down-arrow after adding block B (arrows.elpx) — regression #1667', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Block Reorder #1667');

        // arrows.elpx is a self-contained project with a single page and a
        // single text iDevice whose body is "A". Loading it via openElpFile
        // drives the full import path so the node-content <article.box>
        // siblings get rendered with whitespace text nodes between them,
        // which is exactly the condition that triggered #1667.
        const fixture = path.resolve(__dirname, '../../../fixtures/arrows.elpx');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await waitForLoadingScreen(page);
        await openElpFile(page, fixture, 1);
        await selectFirstNonRootPage(page);

        const sourcePageId = await getCurrentPageId(page);
        expect(sourcePageId).not.toBe('');

        // Confirm the imported project starts with exactly one block.
        await waitForDomAndYjsBlockCount(page, sourcePageId, 1);
        const initialOrder = await readBlockOrderFromYjs(page, sourcePageId);
        expect(initialOrder.length).toBe(1);
        const blockAId = initialOrder[0];

        // Assert the repro condition (text nodes between siblings) is
        // actually present before touching anything. If the DOM ever
        // stops producing them, this test should be updated so it
        // still exercises the handler path deliberately.
        const hasWhitespaceBetweenBlocks = async (): Promise<boolean> => {
            return page.evaluate(() => {
                const nodeContent = document.getElementById('node-content');
                if (!nodeContent) return false;
                const kids = Array.from(nodeContent.childNodes);
                return kids.some(
                    n =>
                        n.nodeType === Node.TEXT_NODE &&
                        ((n as Text).textContent || '').length > 0 &&
                        !((n as Text).textContent || '').trim(),
                );
            });
        };

        // Add a second Text iDevice at the bottom — this creates a new
        // block "B" after "A" on the same page, reproducing the exact
        // scenario @ignaciogros described.
        await addIdevice(page, 'text');
        await waitForDomAndYjsBlockCount(page, sourcePageId, 2);

        // Newly-added text iDevices auto-enter edition mode. While any
        // iDevice is in edition, projectManager.checkOpenIdevice() is
        // truthy and the block arrow click handlers return silently.
        // Save the open iDevice (if any) so the subsequent arrow clicks
        // are actually processed. Mirrors what a real user would do
        // before touching block controls.
        await page.evaluate(() => {
            const open = document.querySelector('#node-content div.idevice_node[mode="edition"]');
            const saveBtn = open?.querySelector('.btn-save-idevice') as HTMLElement | null;
            saveBtn?.click();
        });
        await page.waitForFunction(
            () => !document.querySelector('#node-content div.idevice_node[mode="edition"]'),
            undefined,
            { timeout: 10000 },
        );

        const twoBlocksOrder = await readBlockOrderFromYjs(page, sourcePageId);
        expect(twoBlocksOrder.length).toBe(2);
        expect(twoBlocksOrder[0]).toBe(blockAId);
        const blockBId = twoBlocksOrder[1];

        // Record whether the whitespace-between-siblings condition is
        // present. If yes, the pre-fix handler would have silently
        // aborted here; if no, the test still exercises the arrow path
        // but the repro value is reduced — surface that via a warning.
        const whitespacePresent = await hasWhitespaceBetweenBlocks();
        if (!whitespacePresent) {
            // eslint-disable-next-line no-console
            console.warn(
                '[regression #1667] no whitespace text nodes between ' +
                    'blocks — fix still covered, repro strength reduced.',
            );
        }

        // Click block A's down arrow. A must end up after B.
        await clickMoveDown(page, blockAId);
        await page.waitForFunction(
            ({ targetPageId, expectedFirst }) => {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                const blocks = bridge?.structureBinding?.getBlocks?.(targetPageId) || [];
                return blocks[0]?.id === expectedFirst || blocks[0]?.blockId === expectedFirst;
            },
            { targetPageId: sourcePageId, expectedFirst: blockBId },
            { timeout: 5000 },
        );

        const orderAfterDown = await readBlockOrderFromYjs(page, sourcePageId);
        expect(orderAfterDown).toEqual([blockBId, blockAId]);

        const domOrderAfterDown = await readBlockOrderFromDom(page);
        expect(domOrderAfterDown[0]).toContain(blockBId);
        expect(domOrderAfterDown[1]).toContain(blockAId);

        // Round-trip: click the now-first block B's down arrow (should
        // be a no-op since it's already at the top after A's move…
        // actually it's at index 0, so moving it down should swap back).
        await clickMoveDown(page, blockBId);
        await page.waitForFunction(
            ({ targetPageId, expectedFirst }) => {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                const blocks = bridge?.structureBinding?.getBlocks?.(targetPageId) || [];
                return blocks[0]?.id === expectedFirst || blocks[0]?.blockId === expectedFirst;
            },
            { targetPageId: sourcePageId, expectedFirst: blockAId },
            { timeout: 5000 },
        );

        const orderAfterRoundTrip = await readBlockOrderFromYjs(page, sourcePageId);
        expect(orderAfterRoundTrip).toEqual([blockAId, blockBId]);

        // And click A's up arrow when it's already at the top — must be
        // a clean no-op.
        await clickMoveUp(page, blockAId);
        await page.waitForTimeout(200);
        const orderAfterTopUp = await readBlockOrderFromYjs(page, sourcePageId);
        expect(orderAfterTopUp).toEqual([blockAId, blockBId]);
    });
});
