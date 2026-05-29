import { test, expect } from '../fixtures/auth.fixture';
import {
    waitForAppReady,
    selectPageByIndex,
    addTextIdevice,
    saveProject,
    gotoWorkarea,
} from '../helpers/workarea-helpers';

/**
 * Regression test for the "page stuck loading" bug.
 *
 * When a block's "CSS class" property contains leading/trailing/double spaces
 * (e.g. a user pastes a whole CSS rule into the field), the split-on-space
 * produces empty tokens. Calling classList.add('') throws a SyntaxError in the
 * browser ("The token provided must not be empty"), which aborts the page
 * render and leaves the page stuck loading.
 *
 * After the fix (parseCssClassList), the page must render normally.
 */
test.describe('Block CSS class with extra whitespace', () => {
    test('renders the page without a DOMTokenList error when cssClass has extra spaces', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // The bug surfaces as an uncaught "SyntaxError ... DOMTokenList ...
        // must not be empty". Capture both uncaught errors and console errors.
        const tokenErrors: string[] = [];
        const collect = (text: string) => {
            if (/DOMTokenList|must not be empty/i.test(text)) {
                tokenErrors.push(text);
            }
        };
        page.on('pageerror', err => collect(err.message));
        page.on('console', msg => {
            if (msg.type() === 'error') collect(msg.text());
        });

        const projectUuid = await createProject(page, 'CSS Class Whitespace Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // First page with a text iDevice (this creates a block).
        await selectPageByIndex(page, 0);
        await page.waitForTimeout(500);
        await addTextIdevice(page);

        // Read the block id directly from the rendered block element.
        const blockNode = page.locator('#node-content article.box').first();
        await blockNode.waitFor({ state: 'visible', timeout: 15000 });
        const blockId = await blockNode.getAttribute('id');
        expect(blockId).toBeTruthy();

        // Inject a CSS class value with leading/trailing/double spaces, like the
        // value a user produces by pasting CSS into the "CSS class" field.
        const updated = await page.evaluate(
            ({ id }) => {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                if (!bridge) throw new Error('Yjs bridge not available');
                return bridge.structureBinding.updateBlock(id, {
                    properties: { cssClass: '  spaced-a  spaced-b  ' },
                });
            },
            { id: blockId },
        );
        expect(updated).toBe(true);

        // Persist and reload: this is exactly how users hit the bug — opening the
        // project renders the first page from the stored document. Before the fix
        // this render threw and the page stayed stuck loading.
        await saveProject(page);
        await page.reload();
        await waitForAppReady(page);
        await selectPageByIndex(page, 0);

        // The block must render with both real classes applied and no empty token.
        const block = page.locator(`#node-content article.box[id="${blockId}"]`);
        await expect(block).toBeVisible({ timeout: 15000 });
        await expect(block).toHaveClass(/spaced-a/);
        await expect(block).toHaveClass(/spaced-b/);

        expect(tokenErrors, `Unexpected DOMTokenList errors:\n${tokenErrors.join('\n')}`).toHaveLength(0);
    });
});
