import { test, expect } from '../../fixtures/auth.fixture';
import { waitForAppReady, gotoWorkarea, selectFirstPage, addIdevice } from '../../helpers/workarea-helpers';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for the Electrical Circuits iDevice — AI question generation flow.
 *
 * Reproduces and guards the regression from issue #1964: AI-generated questions
 * (pasted into the "Questions" tab of the AI helper) were not loaded into the
 * editor. The same insertion path also normalizes bare circuit symbols
 * (Ω → \Omega) so the stored TikZ compiles under TikZJax.
 *
 * The tests drive the real user-facing flow rather than the (hidden) in-app
 * generator: external AI prompt → paste generated text → Save → questions
 * loaded into the editor → circuit preview rendered as vector paths.
 */

const IDEVICE = 'electrical-circuits';
const NODE = `#node-content article .idevice_node.${IDEVICE}`;

// Canned "AI-generated" output in the electric-circuits format
// (Description#TikZ#Solution#Question#Options...). The first circuit uses a bare
// ohm sign to exercise the Ω → \Omega normalization the insertion path performs.
const GENERATED_QUESTIONS = [
    'Simple resistor#\\begin{circuitikz}\\draw (0,0) to[R=10 Ω] (3,0);\\end{circuitikz}#A#What component is shown?#Resistor#Capacitor#Inductor#Battery',
    'Battery source#\\begin{circuitikz}\\draw (0,0) to[battery1] (0,3);\\end{circuitikz}#B#Which source is shown?#Resistor#Battery#Lamp',
].join('\n');

async function openQuestionsTab(page: Page): Promise<void> {
    // Reveal the outer "AI" form tab, then its inner "Questions" sub-tab.
    const aiTab = page
        .locator(`${NODE} .exe-form-tabs a`)
        .filter({ hasText: /^\s*(AI|IA)\s*$/ })
        .first();
    await aiTab.click();

    await page.locator('#eXeETabQuestions').click();
    await page.locator('#eXeEQuestionsArea').waitFor({ state: 'visible', timeout: 10000 });
}

/** Dismiss the success/info modal the Save button raises. */
async function closeAlertModals(page: Page): Promise<void> {
    const modal = page.locator('#modalAlert[data-open="true"]');
    if ((await modal.count()) > 0) {
        const okBtn = modal.locator('button:has-text("OK"), button:has-text("Aceptar"), .btn-primary').first();
        if ((await okBtn.count()) > 0) {
            await okBtn.click();
            await page.waitForTimeout(300);
        }
    }
}

test.describe('Electrical Circuits iDevice — AI generation flow', () => {
    // These tests drive the real TikZJax engine (WASM cold start + per-circuit
    // compile), which easily exceeds the 45s global per-test timeout — especially
    // the AI save, which now renders every circuit before inserting it.
    test.describe.configure({ timeout: 120000 });

    test('loads AI-generated questions into the editor and normalizes Ω', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Electrical Circuits AI E2E');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await selectFirstPage(page);
        await addIdevice(page, IDEVICE);
        await page.locator('#elceTikzCode').waitFor({ state: 'attached', timeout: 15000 });

        await openQuestionsTab(page);

        // Paste the "AI-generated" questions and save them. The save now renders
        // every circuit to SVG before inserting it (a "please wait" modal is
        // shown meanwhile), so only circuits TikZJax can compile are kept. Both
        // sample circuits are valid, so both must land in the editor — with their
        // image already generated. Allow generous time for the TikZJax engine.
        await page.locator('#eXeEQuestionsArea').fill(GENERATED_QUESTIONS);
        await page.locator('#eXeESaveButton').click();

        // The questions must be loaded into the editor — this is the regression.
        await expect
            .poll(async () => parseInt((await page.locator('#elceNumQuestions').textContent()) || '0', 10), {
                timeout: 90000,
            })
            .toBeGreaterThanOrEqual(2);

        await closeAlertModals(page);

        // Assert against the editor model so the check is independent of which
        // question is currently active: both the generated question text and the
        // normalized ohm sign (\Omega) must be present in the loaded questions,
        // and every loaded question must carry a pre-rendered circuit SVG.
        const model = await page.evaluate(() => {
            const game = (window as unknown as { $exeDevice?: { selectsGame?: Array<Record<string, unknown>> } })
                .$exeDevice;
            const questions = game?.selectsGame ?? [];
            return {
                count: questions.length,
                tikz: questions.map(q => String(q.tikzCode ?? '')).join('\n'),
                texts: questions.map(q => String(q.quextion ?? '')).join('\n'),
                // Number of questions that carry a pre-rendered circuit SVG. The
                // iDevice starts with one default placeholder question (TikZ code
                // but no SVG) that the AI insert leaves untouched, so assert the
                // two AI circuits were generated rather than every question.
                withSvg: questions.filter(q => String(q.tikzSvg ?? '').includes('<svg')).length,
            };
        });

        expect(model.count).toBeGreaterThanOrEqual(2);
        expect(model.texts).toContain('What component is shown?');
        expect(model.tikz).toContain('circuitikz');
        expect(model.tikz).toContain('\\Omega');
        // Both AI circuits must have been rendered to SVG during the save.
        expect(model.withSvg).toBeGreaterThanOrEqual(2);

        // All AI circuits were generated, so nothing is left to correct: the text
        // box is cleared (rejected questions would have been kept here instead).
        await expect(page.locator('#eXeEQuestionsArea')).toHaveValue('');
    });

    test('renders a circuit with an ohm label as vector paths in the preview', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Electrical Circuits Preview E2E');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await selectFirstPage(page);
        await addIdevice(page, IDEVICE);
        const tikzCode = page.locator('#elceTikzCode');
        await tikzCode.waitFor({ state: 'visible', timeout: 15000 });

        // Drive the renderer with the malformed AI-style labels that used to
        // crash TikZJax: bare commas inside `$...$` (l=$9,V$, R=$1,k\Omega$) that
        // split the to[...] option list. normalizeTikzCode/sanitizeTikzRendererSyntax
        // must brace them so the circuit compiles.
        await tikzCode.fill(
            '\\begin{circuitikz}\\draw (0,0) to[battery1,l=$9,V$] (0,2) to[R=$1,k\\Omega$] (3,2) to[C=$100\\,\\mu F$] (3,0) -- (0,0);\\end{circuitikz}',
        );
        await page.locator('#elcePreviewTikz').click();

        // TikZJax compiles the (now repaired) circuit and the iDevice converts
        // the glyphs to <path>s so the ohm sign renders without web fonts.
        await page.locator('#elceTikzPreview svg').first().waitFor({ state: 'attached', timeout: 60000 });
        await expect(page.locator('#elceTikzPreview svg path').first()).toBeAttached({ timeout: 60000 });
    });

    test('renders an AI logic-gate circuit after the sanitizer rewrites it to circuitikz ports', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Electrical Circuits Gate E2E');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await selectFirstPage(page);
        await addIdevice(page, IDEVICE);
        const tikzCode = page.locator('#elceTikzCode');
        await tikzCode.waitFor({ state: 'visible', timeout: 15000 });

        // pgf logic-gate syntax (node[and gate], .input/.output) that TikZJax
        // cannot compile; sanitizeTikzRendererSyntax must rewrite it to the
        // circuitikz `and port` shape with .in/.out anchors so it renders.
        await tikzCode.fill(
            '\\begin{circuitikz}\\draw (0,0) node[and gate] (g) {}; \\draw (g.input 1) -- (-2,0.3); \\draw (g.input 2) -- (-2,-0.3); \\draw (g.output) -- (2,0);\\end{circuitikz}',
        );
        await page.locator('#elcePreviewTikz').click();

        await page.locator('#elceTikzPreview svg').first().waitFor({ state: 'attached', timeout: 60000 });
        await expect(page.locator('#elceTikzPreview svg path').first()).toBeAttached({ timeout: 60000 });
    });
});
