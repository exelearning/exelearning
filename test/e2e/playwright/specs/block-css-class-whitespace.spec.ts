import { test, expect } from '../fixtures/auth.fixture';
import * as path from 'path';
import { waitForAppReady, openElpFile, selectPageByIndex } from '../helpers/workarea-helpers';

/**
 * Regression test for the "page stuck loading" bug.
 *
 * The fixture block-css-class-whitespace.elp contains a block whose "CSS class"
 * property is "  css-a  css-b  " (leading/trailing/double spaces, like a value
 * produced by pasting CSS into the field). Splitting it on a single space
 * yields empty tokens; classList.add('') then throws a SyntaxError in the
 * browser ("The token provided must not be empty"), which aborts the page
 * render and leaves the page stuck loading.
 *
 * After the fix (parseCssClassList), opening the project renders the page
 * normally with both real classes applied.
 */
test.describe('Block CSS class with extra whitespace', () => {
    test('renders the page without a DOMTokenList error when cssClass has extra spaces', async ({
        authenticatedPage,
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

        // Open a project that already contains a block with a whitespace-heavy
        // cssClass — exactly the scenario users hit (the page renders on load).
        const fixturePath = path.resolve(__dirname, '../../../fixtures/block-css-class-whitespace.elp');
        await openElpFile(page, fixturePath, 1);
        await waitForAppReady(page);

        // Render the first page, which holds the affected block.
        await selectPageByIndex(page, 0);

        // The block must render with both real classes applied and no empty token.
        const block = page.locator('#node-content article.box.css-a.css-b');
        await expect(block).toBeVisible({ timeout: 15000 });

        expect(tokenErrors, `Unexpected DOMTokenList errors:\n${tokenErrors.join('\n')}`).toHaveLength(0);
    });
});
