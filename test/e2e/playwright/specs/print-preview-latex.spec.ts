import { test, expect } from '../fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady } from '../helpers/workarea-helpers';

/**
 * Formulas print as formulas whether or not the project includes MathJax. "Include MathJax" leaves
 * them to MathJax in the exports, but the printed page carries no MathJax script and prints from a
 * copy without scripts, so the preview draws them itself, as it does when MathJax is not included.
 */
test.describe('Print preview formulas', () => {
    for (const addMathJax of [false, true]) {
        test(`prints LaTeX as formulas when the project ${addMathJax ? 'includes' : 'does not include'} MathJax`, async ({
            authenticatedPage: page,
            createProject,
        }) => {
            test.setTimeout(120000);

            const projectUuid = await createProject(page, `Print LaTeX ${addMathJax ? 'with' : 'without'} MathJax`);
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await page.evaluate(include => {
                const bridge = (window as any).eXeLearning.app.project._yjsBridge;
                bridge.documentManager.getMetadata().set('addMathJax', include ? 'true' : 'false');
                const binding = bridge.structureBinding;
                const parent = binding.createPage('Formulas');
                binding.createComponent(parent.id, binding.createBlock(parent.id, 'Formulas'), 'text', {
                    htmlContent: '<p class="formula">Factor \\( x^2 - 4 = (x-2)(x+2) \\) by hand.</p>',
                });
            }, addMathJax);

            await page.evaluate(() => (window as any).eXeLearning.app.modals.printpreview.show());
            const overlay = page.locator('#printPreviewOverlay');
            await expect(overlay).toHaveAttribute('data-visible', 'true');

            const formula = page.frameLocator('.print-preview-iframe').locator('p.formula');
            await expect(formula.locator('.exe-math-rendered svg')).toHaveCount(1, { timeout: 30000 });
            await expect(formula).not.toContainText('\\(');
        });
    }
});
