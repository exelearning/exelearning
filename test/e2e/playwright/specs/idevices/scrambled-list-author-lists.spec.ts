import { test, expect } from '../../fixtures/auth.fixture';
import type { Locator } from '@playwright/test';
import {
    addIdevice,
    getPreviewFrame,
    gotoWorkarea,
    saveIdevice,
    selectFirstPage,
    waitForAppReady,
    waitForPreviewContent,
} from '../../helpers/workarea-helpers';

// Issue #2777: a bulleted list in the instructions or in the text after the
// activity left the list unplayable, and any list there had its links drawn as
// the sorting arrows.
const INSTRUCTIONS =
    '<ul><li>Watch the song</li><li>Sort the <a href="https://example.org/habits">habits</a></li></ul>';
const TEXT_AFTER =
    '<ol><li>Video 1: <a href="https://example.org/song">Tell the time song</a></li><li>Video 2</li></ol>' +
    '<ul><li>Video 3: <a href="https://example.org/routines">Daily routines</a></li></ul>';
const OPTIONS = ['I wake up', 'I have breakfast', 'I go to school'];

/** The author's lists keep their items, and their links stay links. */
async function expectAuthorListsIntact(activity: Locator): Promise<void> {
    await expect(activity.locator('.exe-sortableList-instructions li')).toHaveCount(2);
    await expect(activity.locator('.exe-sortableList-textAfter li')).toHaveCount(3);
    await expect(activity.locator('.exe-sortableList-textAfter li').first()).toHaveCSS('display', 'list-item');
    const links = activity.locator('.exe-sortableList-instructions a, .exe-sortableList-textAfter a');
    await expect(links).toHaveCount(3);
    for (const link of await links.all()) {
        await expect(link).toHaveCSS('position', 'static');
        await expect(link).not.toHaveCSS('background-image', /scrambled-list\.png/);
    }
}

test('scrambled-list stays playable with lists in its instructions and text after', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(120000);
    const uuid = await createProject(page, 'Scrambled list with author lists');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'scrambled-list');

    const node = page.locator('#node-content .idevice_node.scrambled-list').first();
    const ideviceId = (await node.getAttribute('id'))!;
    await page.waitForFunction(() =>
        ['eXeGameInstructions', 'eXeIdeviceTextAfter'].every(id => (window as any).tinymce?.get(id)?.initialized),
    );
    await page.evaluate(
        ({ instructions, textAfter }) => {
            const tinymce = (window as any).tinymce;
            tinymce.get('eXeGameInstructions').setContent(instructions);
            tinymce.get('eXeIdeviceTextAfter').setContent(textAfter);
        },
        { instructions: INSTRUCTIONS, textAfter: TEXT_AFTER },
    );
    for (const [i, option] of OPTIONS.entries()) {
        await page.locator(`#sortableListFormList${i}`).fill(option);
    }
    await saveIdevice(page, ideviceId);

    // What was saved is what the author wrote.
    const stored = await page.evaluate(id => {
        const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
        return JSON.parse(binding.getComponent(id).jsonProperties);
    }, ideviceId);
    expect(stored.options).toEqual(OPTIONS);
    expect(stored.instructions).toContain('<ul>');
    expect(stored.textAfter).toContain('<ol>');
    expect(stored.textAfter).toContain('https://example.org/routines');

    // In the editor, the list the learner sorts is built from the options.
    const activity = node.locator('.exe-sortableList');
    await expect(activity.locator('.exe-sortableList-options > li')).toHaveCount(OPTIONS.length);
    await expect(activity.locator('.exe-sortableList-list')).toBeHidden();
    await expectAuthorListsIntact(activity);

    // And in the preview, which runs the exported package's markup, it can be played.
    expect(await waitForPreviewContent(page, 30000)).toBe(true);
    const preview = getPreviewFrame(page).locator('.idevice_node.scrambled-list');
    await preview.waitFor({ state: 'visible', timeout: 30000 });
    const playable = preview.locator('#exe-sortableList-0');
    await expect(playable.locator('> li')).toHaveCount(OPTIONS.length);
    await expect(playable.locator('a.up')).toHaveCount(OPTIONS.length);
    await expectAuthorListsIntact(preview);

    await playable.evaluate(list => {
        const items = [...list.children] as HTMLElement[];
        items
            .sort((a, b) => Number(a.dataset.origIndex) - Number(b.dataset.origIndex))
            .forEach(item => list.appendChild(item));
    });
    await preview.locator('.exe-sortableList-check-0').click();
    await expect(preview.locator('#exe-sortableList-0-feedback')).toHaveClass(/feedback-right/);
});
