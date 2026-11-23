import { expect, test } from '../../fixtures/auth.fixture';
import { addIdevice, gotoWorkarea, selectFirstPage, waitForAppReady } from '../../helpers/workarea-helpers';

test('Quick Questions imports the text of Moodle questions without running their HTML', async ({
    authenticatedPage: page,
    createProject,
}) => {
    await page.route('https://www.youtube.com/iframe_api', route => route.abort());
    // Every request for the probe image fails at once.
    await page.route('**/moodle-probe.png', route => route.fulfill({ status: 404, body: '' }));
    const uuid = await createProject(page, 'Quick Questions Moodle import');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'quick-questions');
    // The form, Import included, is wired once the question editor has started.
    await page.waitForFunction(() => (window as any).tinymce?.get('quextEText')?.initialized === true);

    // An image whose handler would run if the question text were parsed in the page.
    const quiz = `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="multichoice">
    <questiontext format="html"><text><![CDATA[<p>Capital of France?<img src="/moodle-probe.png" onerror="window.ranImportedHtml = true"></p>]]></text></questiontext>
    <answer fraction="100"><text>Paris</text></answer>
    <answer fraction="0"><text>Rome</text></answer>
  </question>
</quiz>`;
    await page.locator('#eXeGameImportGame').setInputFiles({
        name: 'questions.xml',
        mimeType: 'text/xml',
        buffer: Buffer.from(quiz),
    });
    await expect(page.locator('#quextEQuestion')).toHaveValue('Capital of France?');

    // The same image, loaded now in the page: once its handler has run, the imported one's would have.
    await page.evaluate(() => {
        const image = document.createElement('img');
        image.onerror = () => {
            (window as any).ranControl = true;
        };
        image.src = '/moodle-probe.png';
    });
    await page.waitForFunction(() => (window as any).ranControl === true);
    expect(await page.evaluate(() => (window as any).ranImportedHtml)).toBeUndefined();
});
