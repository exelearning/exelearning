import { expect, test } from '../../fixtures/auth.fixture';
import {
    addIdevice,
    gotoWorkarea,
    saveIdevice,
    selectFirstPage,
    waitForAppReady,
} from '../../helpers/workarea-helpers';

/**
 * Form shows its answers as plain text, both while it is edited and once it is
 * saved and rendered by its export. An imported answer has to stay text through
 * that whole cycle: written as entities in a Moodle file, markup must not come
 * back as live HTML after saving, whether it looks like an image or like a
 * formula the export keeps as SVG.
 */
const probe = '/form-imported-answer-probe.png';

for (const [name, answer] of [
    ['an image', `<img src="${probe}" onerror="window.ranImportedAnswer = true">`],
    [
        'a rendered formula',
        '<span class="exe-math-rendered" data-latex="x"><svg/onload="window.ranImportedAnswer = true"></svg></span>',
    ],
]) {
    test(`form keeps an imported answer shaped like ${name} as text once saved`, async ({
        authenticatedPage: page,
        createProject,
    }) => {
        // Every request for the probe image fails at once.
        await page.route(`**${probe}`, route => route.fulfill({ status: 404, body: '' }));
        const uuid = await createProject(page, 'form imported answers');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await selectFirstPage(page);
        await addIdevice(page, 'form');
        // Import reads the file once its change handler is wired.
        await page.waitForFunction(() => {
            const input = document.querySelector('#eXeGameImportGame');
            return !!input && !!(window as any).jQuery?._data(input, 'events')?.change;
        });

        const asEntities = answer.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        await page.locator('#eXeGameImportGame').setInputFiles({
            name: 'questions.xml',
            mimeType: 'text/xml',
            buffer: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="multichoice">
    <questiontext format="html"><text><![CDATA[Which answer is written as text?]]></text></questiontext>
    <answer fraction="100"><text><![CDATA[${asEntities}]]></text></answer>
    <answer fraction="0"><text>Plain answer</text></answer>
  </question>
</quiz>`),
        });
        await expect(page.locator('#formPreview .selection-buttons-container label').first()).toHaveText(answer);

        const ideviceId = await page.locator('#node-content .idevice_node.form').first().getAttribute('id');
        expect(ideviceId).toBeTruthy();
        await saveIdevice(page, ideviceId as string);
        const saved = page.locator(`#${ideviceId}`);
        await expect(saved.locator('.selection-buttons-container label').first()).toHaveText(answer);

        // The same image, loaded now in the page: once its handler has run, the imported one's would have.
        await page.evaluate(src => {
            const control = document.createElement('img');
            control.onerror = () => {
                (window as any).ranControl = true;
            };
            control.src = src;
        }, probe);
        await page.waitForFunction(() => (window as any).ranControl === true);
        expect(await page.evaluate(() => (window as any).ranImportedAnswer)).toBeUndefined();
        await expect(saved.locator('svg[onload], img[onerror]')).toHaveCount(0);
    });
}
