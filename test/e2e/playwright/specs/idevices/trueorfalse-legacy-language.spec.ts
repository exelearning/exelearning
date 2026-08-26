/**
 * E2E test for issue #2252
 *
 * A True/False iDevice imported from an eXeLearning 2.x package must show its
 * default interface texts in the language declared by the package, instead of
 * falling back to English.
 *
 * Fixture: test/fixtures/more/verdaderofalso.elp (Spanish package, one question)
 */
import { test, expect } from '../../fixtures/auth.fixture';
import * as path from 'path';
import type { Page } from '@playwright/test';
import { openElpFile, waitForAppReady, gotoWorkarea, selectPageByIndex } from '../../helpers/workarea-helpers';

const FIXTURE_PATH = path.resolve(__dirname, '../../../../fixtures/more/verdaderofalso.elp');

/**
 * Read the jsonProperties of the first trueorfalse component stored in Yjs.
 */
async function getTrueOrFalseProperties(page: Page) {
    return await page.evaluate(() => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        const yDoc = bridge?.getDocumentManager()?.getDoc();
        if (!yDoc) return { error: 'No yDoc' };

        const navigation = yDoc.getArray('navigation');

        const findInPage = (pageMap: any): any => {
            const blocks = pageMap?.get('blocks');
            for (let blockIdx = 0; blocks && blockIdx < blocks.length; blockIdx++) {
                const components = blocks.get(blockIdx)?.get('components');
                for (let compIdx = 0; components && compIdx < components.length; compIdx++) {
                    const component = components.get(compIdx);
                    if (component?.get('type') === 'trueorfalse') return component;
                }
            }

            const subpages = pageMap?.get('pages');
            for (let i = 0; subpages && i < subpages.length; i++) {
                const found = findInPage(subpages.get(i));
                if (found) return found;
            }
            return null;
        };

        let component = null;
        for (let pageIdx = 0; pageIdx < navigation.length && !component; pageIdx++) {
            component = findInPage(navigation.get(pageIdx));
        }
        if (!component) return { error: 'No trueorfalse component found' };

        const raw = component.get('jsonProperties');
        try {
            return { properties: typeof raw === 'string' ? JSON.parse(raw) : raw };
        } catch {
            return { error: 'Failed to parse jsonProperties' };
        }
    });
}

test.describe('True/False legacy import language (issue #2252)', () => {
    test('should store the interface texts in the package language', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'True/False legacy language');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await openElpFile(page, FIXTURE_PATH);

        const result = await getTrueOrFalseProperties(page);

        expect(result.error).toBeUndefined();
        expect(result.properties.msgs.msgTrue).toBe('Verdadero');
        expect(result.properties.msgs.msgFalse).toBe('Falso');
        expect(result.properties.msgs.msgSuggestion).toBe('Sugerencia');
    });

    test('should render the answer labels in the package language', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'True/False legacy render');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await openElpFile(page, FIXTURE_PATH);
        await selectPageByIndex(page, 0);

        const answers = page.locator('#node-content .idevice_node.trueorfalse .TOFP-Answers').first();
        await expect(answers).toContainText('Verdadero');
        await expect(answers).toContainText('Falso');

        const suggestion = page.locator('#node-content .idevice_node.trueorfalse .TOFP-ShowSuggestion span').first();
        await expect(suggestion).toHaveText('Sugerencia');
    });
});
