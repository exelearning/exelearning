import { test, expect } from '../../fixtures/auth.fixture';
import { waitForAppReady, gotoWorkarea, selectFirstPage, expandIdeviceCategory } from '../../helpers/workarea-helpers';
import type { Page } from '@playwright/test';

/**
 * E2E Tests for the Electrical Circuits iDevice.
 *
 * The iDevice renders circuit diagrams with TikZJax. TikZJax (tikzjax.js, ~6.7 MB)
 * and its BaKoMa TeX fonts ship a single time in the iDevice's export/ folder.
 * The edition form must reuse that copy — it must NOT pull a duplicate from an
 * edition/ folder (regression guard for the dedup in this PR).
 */

async function addElectricalCircuitsIdevice(page: Page): Promise<void> {
    await expandIdeviceCategory(page, /Science|Ciencia/i);
    const ec = page.locator('.idevice_item[id="electrical-circuits"]').first();
    await ec.waitFor({ state: 'visible', timeout: 10000 });
    await ec.click();
    await page.locator('#node-content article .idevice_node.electrical-circuits').first().waitFor({ timeout: 15000 });
}

test.describe('Electrical Circuits iDevice', () => {
    test('renders the TikZ preview using the single export-folder TikZJax copy', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        // Capture every TikZJax / font request the iDevice triggers.
        const tikzRequests: string[] = [];
        const editionAssetRequests: string[] = [];
        page.on('request', req => {
            const u = req.url();
            if (u.includes('electrical-circuits')) {
                if (u.includes('tikzjax.js')) tikzRequests.push(u);
                if (/\/edition\/(tikzjax\.js|fonts\/)/.test(u)) editionAssetRequests.push(u);
            }
        });

        const projectUuid = await createProject(page, 'Electrical Circuits Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await selectFirstPage(page);

        await addElectricalCircuitsIdevice(page);

        // Enter a circuit with math labels and trigger the preview.
        const code =
            '\\begin{circuitikz}\\draw (0,0) to[battery1, l=$V$] (0,3) to[short] (3,3) ' +
            'to[R, l=$R_1$] (3,1.5) to[R, l=$R_2$] (3,0) to[short] (0,0);\\end{circuitikz}';
        await page.locator('#elceTikzCode').first().fill(code);
        await page.locator('#elcePreviewTikz').first().click();

        // The preview must render an SVG (TikZJax actually executed).
        await page.waitForFunction(
            () => {
                const p = document.querySelector('#elceTikzPreview');
                return !!p?.querySelector('svg');
            },
            { timeout: 30000 },
        );
        const svg = page.locator('#elceTikzPreview svg').first();
        await expect(svg).toBeVisible();

        // Allow any late asset request to surface, then assert provenance.
        await page.waitForTimeout(1000);

        // TikZJax was loaded, and every copy came from the export/ folder.
        expect(tikzRequests.length).toBeGreaterThan(0);
        for (const u of tikzRequests) {
            expect(u, `tikzjax.js must load from export/, got: ${u}`).toContain('/export/tikzjax.js');
        }
        // No duplicated edition/ library assets were ever requested.
        expect(editionAssetRequests, `unexpected edition/ asset requests: ${editionAssetRequests.join(', ')}`).toEqual(
            [],
        );
    });
});
