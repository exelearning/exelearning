import { test, expect } from '../../fixtures/auth.fixture';
import { addIdevice, gotoWorkarea, selectFirstPage, waitForAppReady } from '../../helpers/workarea-helpers';

// The image preview, or the back of the card that holds it, beside the fields.
const forms = [
    { name: 'word-search', preview: '#sopaEMultimedia' },
    { name: 'crossword', preview: '#ccgmEMultimedia' },
    { name: 'adaptative-quiz', preview: '#adaptativeQuizMultimedia' },
    { name: 'relate', preview: '#rclEDatosCartaBack' },
    { name: 'flipcards', preview: '#flipcardsEDatosCartaBack' },
];

for (const { name, preview } of forms) {
    test(`${name} keeps its image preview inside the form, clear of the fields, on a 1024px screen`, async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const uuid = await createProject(page, `${name} preview at 1024`);
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await selectFirstPage(page);
        await addIdevice(page, name);
        await page.setViewportSize({ width: 1024, height: 900 });

        const box = page.locator(`.idevice_node.${name} ${preview}`);
        await expect(box).toBeVisible();
        const layout = await box.evaluate(element => {
            const rect = element.getBoundingClientRect();
            const panel = element.closest('.tab-pane')!;
            const covered = [...panel.querySelectorAll('input, select, button, a, label')]
                .filter(control => !element.contains(control) && !control.closest('.sr-av'))
                .filter(control => {
                    const r = control.getBoundingClientRect();
                    return (
                        r.width > 0 &&
                        r.left < rect.right &&
                        rect.left < r.right &&
                        r.top < rect.bottom &&
                        rect.top < r.bottom
                    );
                })
                .map(control => control.id || control.className);
            return { outside: Math.round(rect.right - panel.getBoundingClientRect().right), covered };
        });

        expect(layout.outside).toBeLessThanOrEqual(0);
        expect(layout.covered).toEqual([]);
    });
}
