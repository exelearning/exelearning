import { test, expect } from '../fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady } from '../helpers/workarea-helpers';

test.describe('iDevice JSON save validation', () => {
    test('preserves the last valid component when a save contains malformed JSON', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'iDevice JSON save validation');

        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const result = await page.evaluate(async () => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const navigation = bridge.documentManager.getNavigation();
            const pageId = navigation.get(0).get('id');
            const blockId = bridge.structureBinding.createBlock(pageId, 'Validated activity');
            const componentId = bridge.structureBinding.createComponent(pageId, blockId, 'trueorfalse', {
                id: 'idevice-json-validation',
                htmlContent: '<p>Last valid HTML</p>',
                jsonProperties: {
                    question: '<audio src=""><a href="">audio.webm</a></audio>\n<p>¿Dónde vive?</p>',
                    solution: false,
                },
            });
            const before = bridge.structureBinding.getComponent(componentId);
            let validationError = '';

            try {
                bridge.structureBinding.updateComponent(componentId, {
                    htmlContent: '<p>Partially saved HTML</p>',
                    jsonProperties: '{"question":"<audio src=\\"">',
                });
            } catch (error) {
                validationError = error instanceof Error ? error.message : String(error);
            }

            const after = bridge.structureBinding.getComponent(componentId);
            if (validationError) {
                await bridge.documentManager.saveToServer({ silent: true });
            }

            return {
                componentId,
                validationError,
                beforeHtml: before.htmlContent,
                afterHtml: after.htmlContent,
                beforeJson: before.jsonProperties,
                afterJson: after.jsonProperties,
            };
        });

        expect(result.validationError).toContain('jsonProperties');
        expect(result.afterHtml).toBe(result.beforeHtml);
        expect(result.afterJson).toBe(result.beforeJson);
        expect(JSON.parse(result.afterJson)).toEqual({
            question: '<audio src=""><a href="">audio.webm</a></audio>\n<p>¿Dónde vive?</p>',
            solution: false,
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
