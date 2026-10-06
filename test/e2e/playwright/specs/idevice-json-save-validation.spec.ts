import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady } from '../helpers/workarea-helpers';

const VALID_JSON_PROPERTIES = {
    question: '<audio src=""><a href="">audio.webm</a></audio>\n<p>¿Dónde vive?</p>',
    solution: false,
};

interface RejectedSaveResult {
    componentId: string;
    validationError: string;
    beforeHtml: string;
    afterHtml: string;
    beforeJson: string;
    afterJson: string;
}

/**
 * Seed a component with valid JSON, then attempt a malformed `jsonProperties`
 * update that the structure binding must reject. Returns the component state
 * captured before and after the rejected save so callers can assert that the
 * last valid version was preserved atomically.
 */
async function seedComponentAndRejectMalformedSave(page: Page, componentId: string): Promise<RejectedSaveResult> {
    return page.evaluate(
        ({ id, validJson }) => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const navigation = bridge.documentManager.getNavigation();
            const pageId = navigation.get(0).get('id');
            const blockId = bridge.structureBinding.createBlock(pageId, 'Validated activity');
            bridge.structureBinding.createComponent(pageId, blockId, 'trueorfalse', {
                id,
                htmlContent: '<p>Last valid HTML</p>',
                jsonProperties: validJson,
            });

            const before = bridge.structureBinding.getComponent(id);
            let validationError = '';

            try {
                bridge.structureBinding.updateComponent(id, {
                    htmlContent: '<p>Partially saved HTML</p>',
                    jsonProperties: '{"question":"<audio src=\\"">',
                });
            } catch (error) {
                validationError = error instanceof Error ? error.message : String(error);
            }

            const after = bridge.structureBinding.getComponent(id);

            return {
                componentId: id,
                validationError,
                beforeHtml: before.htmlContent,
                afterHtml: after.htmlContent,
                beforeJson: before.jsonProperties,
                afterJson: after.jsonProperties,
            };
        },
        { id: componentId, validJson: VALID_JSON_PROPERTIES },
    );
}

test.describe('iDevice JSON save validation', () => {
    test('rejects a malformed JSON save and preserves the last valid component', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'iDevice JSON save validation');

        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const result = await seedComponentAndRejectMalformedSave(page, 'idevice-json-validation');

        expect(result.validationError).toContain('jsonProperties');
        expect(result.afterHtml).toBe(result.beforeHtml);
        expect(result.afterJson).toBe(result.beforeJson);
        expect(JSON.parse(result.afterJson)).toEqual(VALID_JSON_PROPERTIES);
    });

    test('keeps the preserved component after a page reload', async ({
        authenticatedPage,
        createProject,
    }, testInfo) => {
        // Static builds run fully offline: saveToServer() is a no-op and a page
        // reload boots a fresh project, so project persistence across reloads
        // cannot be exercised there. open-project-clean-state.spec.ts skips
        // static for the same reason.
        test.skip(testInfo.project.name === 'static', 'Project persistence across reload is disabled in static mode');

        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'iDevice JSON save validation reload');

        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const result = await seedComponentAndRejectMalformedSave(page, 'idevice-json-validation-reload');

        expect(result.validationError).toContain('jsonProperties');
        expect(result.afterHtml).toBe(result.beforeHtml);
        expect(result.afterJson).toBe(result.beforeJson);

        await page.evaluate(async () => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            await bridge.documentManager.saveToServer({ silent: true });
        });

        await page.reload();
        await waitForAppReady(page);

        const persisted = await page.evaluate(componentId => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            return bridge.structureBinding.getComponent(componentId);
        }, result.componentId);

        expect(persisted.htmlContent).toBe(result.beforeHtml);
        expect(persisted.jsonProperties).toBe(result.beforeJson);
        expect(() => JSON.parse(persisted.jsonProperties)).not.toThrow();
    });
});
