import { test, expect, skipInStaticMode } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';
import { gotoWorkarea, waitForAppReady, waitForLoadingScreen, saveProject } from '../helpers/workarea-helpers';

/**
 * E2E reproduction for issue #1665.
 *
 * Reorder of blocks ("cajas") inside a single page via the up/down arrow
 * buttons must produce a stable, deterministic order. The bug report says
 * the order ends up random and that exporting the project then yields
 * "page not found" errors. The unit test
 * `YjsStructureBinding > updateBlockOrder regression #1665` reproduces the
 * Yjs side; this spec exercises the full UI flow: create a page with
 * several blocks, click the arrows many times alternating between blocks,
 * navigate away and back, and verify the order matches what an in-memory
 * reference array would produce.
 */

const BLOCK_SELECTOR = '#node-content article.box:not(#empty_articles)';

async function selectFirstNonRootPage(page: Page): Promise<void> {
    const selectors = [
        '.nav-element:not([nav-id="root"]) .nav-element-text',
        '.structure-tree .nav-element:not([nav-id="root"]) .nav-element-text',
    ];
    for (const sel of selectors) {
        const el = page.locator(sel).first();
        if ((await el.count()) > 0) {
            await el.click({ timeout: 5000 });
            await page.waitForTimeout(300);
            return;
        }
    }
    throw new Error('No non-root page node found');
}

async function getCurrentPageId(page: Page): Promise<string> {
    return page.evaluate(() => {
        const selected = document.querySelector('.nav-element.selected:not([nav-id="root"])');
        return selected?.getAttribute('nav-id') || '';
    });
}

async function createPageViaYjs(page: Page, name: string): Promise<string> {
    const id = await page.evaluate(pageName => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        const created = bridge?.structureBinding?.createPage?.(pageName);
        return created?.id || created?.pageId || '';
    }, name);
    if (!id) throw new Error(`Could not create page "${name}" via Yjs`);
    await page.locator(`.nav-element[nav-id="${id}"]`).first().waitFor({ state: 'visible', timeout: 10000 });
    return id;
}

async function selectPageNode(page: Page, pageId: string): Promise<void> {
    const node = page.locator(`.nav-element[nav-id="${pageId}"] .nav-element-text`).first();
    await node.waitFor({ state: 'visible', timeout: 10000 });
    await node.click();
    await page.waitForTimeout(300);
}

async function addBlockViaYjs(page: Page, pageId: string, name: string): Promise<string> {
    const blockId = await page.evaluate(
        ({ targetPageId, blockName }) => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            return bridge?.addBlock ? bridge.addBlock(targetPageId, blockName) || '' : '';
        },
        { targetPageId: pageId, blockName: name },
    );
    if (!blockId) throw new Error(`Could not add block "${name}" via Yjs`);
    return blockId;
}

async function waitForDomBlockCount(page: Page, expected: number, timeout = 10000): Promise<void> {
    await page.waitForFunction(
        ({ selector, n }) => document.querySelectorAll(selector).length === n,
        { selector: BLOCK_SELECTOR, n: expected },
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
    // Allow the click handler's promise chain (apiUpdateOrder + DOM reflow)
    // to settle. We deliberately do NOT wait for the .moving CSS class to
    // disappear because that's part of the bug surface — we want to reflect
    // a real user clicking quickly.
    await page.waitForTimeout(120);
}

async function clickMoveUp(page: Page, blockId: string): Promise<void> {
    const btn = page.locator(`#moveUp${blockId}`).first();
    await btn.waitFor({ state: 'attached', timeout: 5000 });
    await btn.click({ force: true });
    await page.waitForTimeout(120);
}

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
        await selectFirstNonRootPage(page);

        // Two pages so we can navigate away and back.
        const sourcePageId = await getCurrentPageId(page);
        expect(sourcePageId).not.toBe('');
        const otherPageId = await createPageViaYjs(page, 'Other page #1665');

        await selectPageNode(page, sourcePageId);

        // Seed the source page with N blocks. Capture their ids in creation order.
        const N = 5;
        const ids: string[] = [];
        for (let i = 0; i < N; i++) {
            ids.push(await addBlockViaYjs(page, sourcePageId, `Block ${i}`));
        }

        // The Yjs and DOM should already converge to N blocks before we
        // start clicking arrows.
        await waitForDomBlockCount(page, N);
        const initialYjsOrder = await readBlockOrderFromYjs(page, sourcePageId);
        expect(initialYjsOrder.length).toBe(N);
        // We won't assume the order matches `ids` exactly here — addBlock
        // may push or splice; only assume that every id we created is present.
        expect(new Set(initialYjsOrder)).toEqual(new Set(ids));

        // Build a reference array starting from the same Yjs order and
        // mutate it in lockstep with the user clicks. Each "click move
        // down" is a single neighbour swap towards the back; each "click
        // move up" is a single neighbour swap towards the front. That's
        // what the user expects from each arrow click.
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

        // A sequence of arrow clicks alternating between blocks and
        // directions. Each entry refers to the *original* block id, NOT
        // its current position in the page.
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

        // After all clicks, both Yjs and the DOM must agree with the reference.
        const yjsOrderAfter = await readBlockOrderFromYjs(page, sourcePageId);
        const domOrderAfter = await readBlockOrderFromDom(page);

        expect(yjsOrderAfter.length).toBe(N);
        expect(new Set(yjsOrderAfter)).toEqual(new Set(ids)); // no losses, no duplicates
        expect(yjsOrderAfter).toEqual(reference);
        // The DOM ids carry an "article-" prefix or sym-id attribute; we
        // compare as suffix-match to be tolerant to that.
        for (let i = 0; i < domOrderAfter.length; i++) {
            expect(domOrderAfter[i]).toContain(reference[i]);
        }

        // Save and bounce: navigate to the other page and back. The Yjs
        // doc is the source of truth, so the page rebuild should still
        // honour the same order.
        await saveProject(page);
        await selectPageNode(page, otherPageId);
        await page.waitForTimeout(300);
        await selectPageNode(page, sourcePageId);
        await waitForDomBlockCount(page, N);

        const yjsOrderAfterBounce = await readBlockOrderFromYjs(page, sourcePageId);
        const domOrderAfterBounce = await readBlockOrderFromDom(page);
        expect(yjsOrderAfterBounce).toEqual(reference);
        for (let i = 0; i < domOrderAfterBounce.length; i++) {
            expect(domOrderAfterBounce[i]).toContain(reference[i]);
        }
    });
});
