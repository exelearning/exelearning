/**
 * Regression coverage for #2376.
 *
 * `stale-text-template-refs.elpx` holds two html-type activities and no
 * `content/resources/`. The Select media files activity genuinely references
 * `imagen1.jpg` from its htmlView. The Map activity references nothing any
 * more, but its jsonProperties still carry the text template eXeLearning 3
 * stamped on it, with an older copy of the activity pointing at `do.mp3`.
 * The notice must name the real gap and stay silent about the ghost.
 */
import * as path from 'path';
import { expect, test } from '../fixtures/auth.fixture';
import { gotoWorkarea, openElpFile, waitForAppReady } from '../helpers/workarea-helpers';

const FIXTURE = path.resolve(__dirname, '../../../fixtures/stale-text-template-refs.elpx');

test.describe('Missing asset notice with a stale eXe 3 text template', () => {
    test('reports the file the activity references and not the one only its stale template knew', async ({
        authenticatedPage,
        createProject,
    }) => {
        test.setTimeout(120000);
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'Stale text template notice');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await openElpFile(page, FIXTURE, 1);

        const modal = page.locator('#modalAlert');
        await expect(modal).toBeVisible({ timeout: 30000 });
        const title = await page.evaluate(
            () => (window as any).eXeLearning.app.idevices.getIdeviceInstalled('select-media-files').title,
        );
        await expect(modal).toContainText(`iDevice 1 (${title}) on page "Stale template"`);
        await expect(modal.locator('li strong')).not.toHaveText('select-media-files');
        await expect(modal).toContainText('imagen1.jpg');
        await expect(modal).not.toContainText('map');
        await expect(modal).not.toContainText('do.mp3');
    });
});
