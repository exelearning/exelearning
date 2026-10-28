import { test, expect } from '../../fixtures/auth.fixture';
import { addIdevice, gotoWorkarea, selectFirstPage, waitForAppReady } from '../../helpers/workarea-helpers';

test('Texts tab wraps a long label inside its column and keeps each row of fields aligned', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const uuid = await createProject(page, 'Texts tab layout');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'hidden-image');

    await page.locator('#hiQEIdeviceForm-tab-texts').click();
    const fields = page.locator('#hiQEIdeviceForm .ci18n');
    await expect(fields.first()).toBeVisible();
    // Hidden image's longest text, the one that spilled into the next column.
    const longLabel = page.locator('label[for="ci18n_msgScoreScorm"]');
    await expect(longLabel).toBeVisible();

    for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        const layout = await fields.evaluateAll(columns =>
            columns.map(column => {
                const label = column.querySelector('label')!;
                const input = column.querySelector('input')!;
                const box = column.getBoundingClientRect();
                const text = label.getBoundingClientRect();
                return {
                    id: input.id,
                    columnTop: Math.round(box.top),
                    columnLeft: box.left,
                    columnRight: box.right,
                    labelLeft: text.left,
                    labelRight: text.right,
                    labelLines: Math.round(text.height / Number.parseFloat(getComputedStyle(label).lineHeight)),
                    overflows: label.scrollWidth > label.clientWidth,
                    inputTop: Math.round(input.getBoundingClientRect().top),
                };
            }),
        );

        // Two columns: the test is meaningless if every field sat on a row of its own.
        expect(new Set(layout.map(field => field.columnLeft)).size, `at ${width}px`).toBe(2);
        for (const field of layout) {
            expect(field.labelLeft, `${field.id} at ${width}px`).toBeGreaterThanOrEqual(field.columnLeft - 1);
            expect(field.labelRight, `${field.id} at ${width}px`).toBeLessThanOrEqual(field.columnRight + 1);
            expect(field.overflows, `${field.id} at ${width}px`).toBe(false);
        }
        const scorm = layout.find(field => field.id === 'ci18n_msgScoreScorm')!;
        expect(scorm.labelLines, `the long label wraps at ${width}px`).toBeGreaterThan(1);

        // The fields of one row line up, however many lines each label takes.
        const rows = new Map<number, number[]>();
        for (const field of layout) rows.set(field.columnTop, [...(rows.get(field.columnTop) ?? []), field.inputTop]);
        for (const [top, inputs] of rows) {
            const spread = Math.max(...inputs) - Math.min(...inputs);
            expect(spread, `row at ${top}px, ${width}px wide`).toBeLessThanOrEqual(1);
        }
    }
});
