/**
 * Regression coverage for #2223.
 *
 * `missing-asset-refs.elpx` is a Classify activity whose package carries no
 * `content/resources/` at all, so its eight references have nothing to resolve
 * against. The importer preserves them on purpose, which used to leave the
 * author reading raw `{{context_path}}/…` placeholders in the form fields with
 * nothing saying a file was missing. The import must now say so.
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
        await expect(modal).toContainText('classify');
        await expect(modal).toContainText('rabbit.svg');
    });
});
