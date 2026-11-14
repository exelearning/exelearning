/**
 * Regression coverage for #2223, #2242 and #2681.
 *
 * `missing-asset-refs.elpx` is a Classify activity whose package carries no
 * `content/resources/` at all, so its eight references have nothing to resolve
 * against. The importer preserves them on purpose, which used to leave the
 * author reading raw `{{context_path}}/…` placeholders in the form fields with
 * nothing saying a file was missing. The import must now say so, naming each
 * file whole: one of the eight has spaces, and #2681 was that such a name
 * reached the notice cut at the first space.
 */
import * as path from 'path';
import { expect, test } from '../fixtures/auth.fixture';
import { gotoWorkarea, openElpFile, waitForAppReady } from '../helpers/workarea-helpers';

const FIXTURE = path.resolve(__dirname, '../../../fixtures/missing-asset-refs.elpx');

test.describe('Missing asset notice', () => {
    test('importing a package with unresolvable references names the affected activity', async ({
        authenticatedPage,
        createProject,
    }) => {
        test.setTimeout(120000);
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'Missing asset notice');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await openElpFile(page, FIXTURE, 1);

        const modal = page.locator('#modalAlert');
        await expect(modal).toBeVisible({ timeout: 30000 });
        const title = await page.evaluate(
            () => (window as any).eXeLearning.app.idevices.getIdeviceInstalled('classify').title,
        );
        await expect(modal).toContainText(`iDevice 1 (${title}) on page "Classify content"`);
        await expect(modal.locator('li strong')).not.toHaveText('classify');
        await expect(modal).toContainText('Programaci_n sensor movimiento.png');
    });
});
