import type { Page } from '@playwright/test';
import { expect, test } from '../../fixtures/auth.fixture';
import { addIdevice, gotoWorkarea, selectFirstPage, waitForAppReady } from '../../helpers/workarea-helpers';

// An image whose handler would run if the imported text reached the page as markup.
const probe = '/imported-text-probe.png';
const image = `<img src="${probe}" onerror="window.ranImportedHtml = true">`;
const asEntities = image.replace(/</g, '&lt;').replace(/>/g, '&gt;');

const quiz = (question: string) => `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
${question}
</quiz>`;
const shortAnswer = (question: string, answer: string) =>
    quiz(`  <question type="shortanswer">
    <questiontext format="html"><text><![CDATA[${question}]]></text></questiontext>
    <answer fraction="100"><text><![CDATA[${answer}]]></text></answer>
  </question>`);
const trueFalse = (question: string) =>
    quiz(`  <question type="truefalse">
    <questiontext format="html"><text><![CDATA[${question}]]></text></questiontext>
    <answer fraction="100"><text>true</text></answer>
    <answer fraction="0"><text>false</text></answer>
  </question>`);

interface ImportCase {
    device: string;
    source: string;
    file: { name: string; mimeType: string; body: string };
    /** Waits until the import is done, on something the imported markup cannot break. */
    imported: (page: Page) => Promise<void>;
    /** Checks what the iDevice kept, once it is known that nothing ran. */
    kept?: (page: Page) => Promise<void>;
}

const cardShown = (input: string, text: RegExp) => async (page: Page) => {
    await expect(page.locator(input)).toHaveValue(text);
};
const questionShown = async (page: Page) => {
    await expect(page.locator('#formPreview')).toContainText('Is the sky blue?');
};

const cases: ImportCase[] = [];
for (const [device, input] of [
    ['relate', '#rclEText'],
    ['flipcards', '#flipcardsEText'],
]) {
    cases.push(
        {
            device,
            source: 'a Moodle answer whose image is written as entities',
            file: {
                name: 'cards.xml',
                mimeType: 'text/xml',
                body: shortAnswer('Capital of France?', `Paris ${asEntities}`),
            },
            imported: cardShown(input, /Paris/),
        },
        {
            device,
            source: 'a text file with a %-encoded image and an image tag',
            file: {
                name: 'cards.txt',
                mimeType: 'text/plain',
                body: `Capital ${encodeURIComponent(image)}#Paris ${image}`,
            },
            imported: cardShown(input, /Capital/),
        },
    );
}
cases.push(
    {
        device: 'form',
        source: 'a text file with an image tag',
        file: { name: 'questions.txt', mimeType: 'text/plain', body: `1#Is the sky blue?${image}` },
        imported: questionShown,
    },
    {
        device: 'form',
        source: 'a Moodle question whose image is written as entities',
        file: { name: 'questions.xml', mimeType: 'text/xml', body: trueFalse(`Is the sky blue? ${asEntities}`) },
        imported: questionShown,
    },
    {
        device: 'scrambled-list',
        source: 'a text file whose element closes its field and adds an image',
        file: { name: 'list.txt', mimeType: 'text/plain', body: `First">${image}#Second#Third` },
        imported: async page => {
            await expect(page.locator('#sortableListFormList2')).toHaveValue('Third');
        },
        kept: async page => {
            await expect(page.locator('#sortableListFormList0')).toHaveValue(`First">${image}`);
        },
    },
);

for (const { device, source, file, imported, kept } of cases) {
    test(`${device} imports ${source} without running it`, async ({ authenticatedPage: page, createProject }) => {
        // Every request for the probe image fails at once.
        await page.route(`**${probe}`, route => route.fulfill({ status: 404, body: '' }));
        const uuid = await createProject(page, `${device} import`);
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await selectFirstPage(page);
        await addIdevice(page, device);
        // Import reads the file once its change handler is wired.
        await page.waitForFunction(() => {
            const input = document.querySelector('#eXeGameImportGame');
            return !!input && !!(window as any).jQuery?._data(input, 'events')?.change;
        });

        await page.locator('#eXeGameImportGame').setInputFiles({
            name: file.name,
            mimeType: file.mimeType,
            buffer: Buffer.from(file.body),
        });
        await imported(page);

        // The same image, loaded now in the page: once its handler has run, the imported one's would have.
        await page.evaluate(src => {
            const control = document.createElement('img');
            control.onerror = () => {
                (window as any).ranControl = true;
            };
            control.src = src;
        }, probe);
        await page.waitForFunction(() => (window as any).ranControl === true);
        expect(await page.evaluate(() => (window as any).ranImportedHtml)).toBeUndefined();
        await kept?.(page);
    });
}
