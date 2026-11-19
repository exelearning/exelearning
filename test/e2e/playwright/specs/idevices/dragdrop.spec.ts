import { test, expect } from '../../fixtures/auth.fixture';
import { closeAlert } from '../../helpers/idevice-share-helpers';
import {
    addIdevice,
    gotoWorkarea,
    saveIdevice,
    selectFirstPage,
    waitForAppReady,
} from '../../helpers/workarea-helpers';

test('Drag and drop asks for the image or sound of a copied card that is not on screen', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const uuid = await createProject(page, 'Drag and drop copied card');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'dragdrop');
    const node = page.locator('.idevice_node.dragdrop').first();
    const id = (await node.getAttribute('id'))!;
    await expect(page.locator('#dadEDefinition')).toBeVisible();
    // Two cards saved before an image or a sound was required: they keep working without one.
    await page.evaluate(() => {
        const device = (window as any).$exeDevice;
        device.updateFieldGame({
            typeGame: 'dragdrop',
            showMinimize: false,
            percentajeCards: 100,
            author: '',
            showSolution: true,
            timeShowSolution: 3,
            time: 0,
            type: 0,
            typeDrag: 0,
            itinerary: {},
            evaluation: false,
            evaluationID: '',
            passScoreMode: 'global',
            passScoreCustom: 5,
            isScorm: 0,
            textButtonScorm: '',
            repeatActivity: false,
            weighted: 100,
            cardsGame: ['Heart', 'Lungs'].map(definition => ({ definition, url: '', audio: '', author: '', alt: '' })),
        });
        device.showCard(0);
    });
    // A copy of one needs its own. Pasting twice and deleting the second copy leaves the first off screen.
    await page.locator('#dadECopyC').click();
    await page.locator('#dadEPasteC').click();
    await page.locator('#dadEPasteC').click();
    await page.locator('#dadEDeleteC').click();
    await expect(page.locator('#dadEDefinition')).toHaveValue('Lungs');
    await page.locator('#dadEDefinition').fill('Edited lungs');
    await page.locator('#dragdropQIdeviceForm-tab-options').click();

    await node.locator('.btn-save-idevice').click();
    await closeAlert(page, 'Add a text and an image or a sound to the card');
    // The copy is shown, in its tab.
    await expect(page.locator('#dadEDefinition')).toBeVisible();
    await expect(page.locator('#dadEDefinition')).toHaveValue('Heart');
    await expect(page.locator('#dadENumberCard')).toHaveValue('2');

    // An embedded image needs no file manager.
    const image =
        'data:image/svg+xml;base64,' +
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>').toString('base64');
    await page.locator('#dadEURLImage').fill(image);
    await saveIdevice(page, id);
    const cards = await page.evaluate(componentId => {
        const html = (window as any).eXeLearning.app.project._yjsBridge.structureBinding
            .getComponent(componentId)
            .htmlContent.toString();
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        return JSON.parse(wrapper.querySelector('.dragdrop-DataGame')!.textContent!).cardsGame;
    }, id);
    expect(cards.map((card: { definition: string; url: string }) => [card.definition, card.url])).toEqual([
        ['Heart', ''],
        ['Heart', image],
        ['Edited lungs', ''],
    ]);
});
