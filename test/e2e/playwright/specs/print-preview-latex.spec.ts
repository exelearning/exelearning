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

        // Games keep their questions encrypted in a hidden DataGame div, which the page's own LaTeX
        // pass cannot see: the preview decrypts it, renders the formulas and encrypts it again.
        test(`prints LaTeX in a game's encrypted data when the project ${addMathJax ? 'includes' : 'does not include'} MathJax`, async ({
            authenticatedPage: page,
            createProject,
        }) => {
            test.setTimeout(120000);

            const projectUuid = await createProject(
                page,
                `Print game LaTeX ${addMathJax ? 'with' : 'without'} MathJax`,
            );
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await page.evaluate(include => {
                const { encrypt } = (window as any).$exeDevices.iDevice.gamification.helpers;
                const dataGame = {
                    typeGame: 'QuExt',
                    questionsGame: [
                        {
                            quextion: 'Is \\( x^2 - 4 = (x-2)(x+2) \\)?',
                            options: ['Yes', 'No', '', ''],
                            solution: 0,
                            numberOptions: 2,
                        },
                    ],
                };
                const htmlContent =
                    '<div class="quext-IDevice">' +
                    '<div class="quext-version js-hidden">1</div>' +
                    `<div class="quext-DataGame js-hidden">${encrypt(JSON.stringify(dataGame))}</div>` +
                    '</div>';

                const bridge = (window as any).eXeLearning.app.project._yjsBridge;
                bridge.documentManager.getMetadata().set('addMathJax', include ? 'true' : 'false');
                const binding = bridge.structureBinding;
                const parent = binding.createPage('Game');
                binding.createComponent(parent.id, binding.createBlock(parent.id, 'Game'), 'quick-questions', {
                    htmlContent,
                });
            }, addMathJax);

            await page.evaluate(() => (window as any).eXeLearning.app.modals.printpreview.show());
            const overlay = page.locator('#printPreviewOverlay');
            await expect(overlay).toHaveAttribute('data-visible', 'true');

            const dataGame = page.frameLocator('.print-preview-iframe').locator('.quext-DataGame').first();
            await expect(dataGame).toBeAttached({ timeout: 30000 });
            const readQuestion = async (): Promise<string> => {
                const decrypted: string = await page.evaluate(
                    text => (window as any).$exeDevices.iDevice.gamification.helpers.decrypt(text.trim()),
                    (await dataGame.textContent()) ?? '',
                );
                try {
                    return JSON.parse(decrypted).questionsGame[0].quextion;
                } catch {
                    return '';
                }
            };

            await expect.poll(readQuestion, { timeout: 30000 }).toMatch(/^Is <span class="exe-math-rendered"/);
            // The rendered formula keeps its source in data-latex; outside it no LaTeX is left.
            expect((await readQuestion()).replace(/data-latex="[^"]*"/g, '')).not.toContain('\\(');
        });
    }
});
