import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '../fixtures/auth.fixture';
import {
    waitForAppReady,
    addTextIdevice,
    waitForTinyMCEReady,
    selectFirstPage,
    gotoWorkarea,
    waitForPreviewContent,
} from '../helpers/workarea-helpers';

/**
 * ABC music notation (abcjs).
 *
 * `libs/abcjs/abcjs-basic-min.js` is generated from the npm `abcjs` package by
 * `bundle:vendor`, while `exe_abc_music.js` and `abcjs-audio.css` are tracked.
 * This checks that the generated build still works with eXe's glue code: the
 * score renders as SVG and the synth controls (SynthController) are built.
 */

const ABC_TUNE = `X:1
T:Scale
M:4/4
L:1/4
K:C
CDEF|GABc|`;

const ABC_HTML = `<pre class="abc-music abc-music-midi">${ABC_TUNE}</pre>`;

const expectedAbcjsVersion = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../../../node_modules/abcjs/package.json'), 'utf-8'),
).version as string;

test.describe('ABC music notation', () => {
    test('renders the score and the audio controls in preview', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'ABC Music Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await selectFirstPage(page);
        await addTextIdevice(page);
        await waitForTinyMCEReady(page);

        // Write into the main text editor (the iDevice also has a feedback editor,
        // and `activeEditor` may point at it).
        await page.waitForFunction(() =>
            (window as any).tinymce?.get().some((e: any) => e.id.endsWith('textTextarea') && e.initialized),
        );
        await page.evaluate(html => {
            const editor = (window as any).tinymce.get().find((e: any) => e.id.endsWith('textTextarea'));
            editor.setContent(html);
            editor.fire('change');
            editor.setDirty(true);
        }, ABC_HTML);

        const block = page.locator('#node-content article .idevice_node.text').first();
        await block.locator('.btn-save-idevice').click();
        await page.waitForFunction(
            () =>
                document.querySelector('#node-content article .idevice_node.text')?.getAttribute('mode') !== 'edition',
            undefined,
            { timeout: 20000 },
        );

        // Editor view: exe_abc_music.js injects abcjs and renders the score.
        const editorScore = page.locator('#node-content .abcjs-paper svg').first();
        await expect(editorScore).toBeVisible({ timeout: 20000 });

        expect(await waitForPreviewContent(page)).toBe(true);
        const iframe = page.frameLocator('#preview-iframe');

        // The generated build is the npm version, not a stale copy.
        await expect
            .poll(() => iframe.locator('body').evaluate(() => (window as any).ABCJS?.signature ?? null), {
                timeout: 20000,
            })
            .toBe(`abcjs-basic v${expectedAbcjsVersion}`);

        const score = iframe.locator('.abcjs-paper svg').first();
        await expect(score).toBeVisible({ timeout: 20000 });
        // Four notes per bar, two bars.
        await expect(iframe.locator('.abcjs-paper .abcjs-note')).toHaveCount(8);

        // MIDI toggle reveals the SynthController widget and the download link.
        await iframe.locator('.abc-audio-tooglebutton').first().click();
        const audio = iframe.locator('.abcjs-audio .abcjs-inline-audio').first();
        await expect(audio).toBeVisible({ timeout: 10000 });
        await expect(audio.locator('.abcjs-midi-start')).toBeVisible();
        await expect(audio.locator('.abcjs-midi-progress-background')).toBeVisible();
        // abcjs-audio.css is applied (upstream rule for the control bar).
        await expect(audio).toHaveCSS('display', 'flex');
        await expect(iframe.locator('.abcjs-midi a').first()).toHaveAttribute('href', /^data:audio\/midi,/);
    });

    test('previews the tune from the TinyMCE dialog like the exported content', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'ABC Music Dialog Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await selectFirstPage(page);
        await addTextIdevice(page);
        await waitForTinyMCEReady(page);
        await page.waitForFunction(() =>
            (window as any).tinymce?.get().some((e: any) => e.id.endsWith('textTextarea') && e.initialized),
        );

        // Same as clicking the toolbar button of the main text editor.
        await page.evaluate(() => {
            const editor = (window as any).tinymce.get().find((e: any) => e.id.endsWith('textTextarea'));
            editor.ui.registry.getAll().buttons.abcmusic.onAction();
        });
        const form = page.locator('.tox-dialog').filter({ has: page.locator('#htmlSource') });
        await form.locator('#htmlSource').fill(ABC_TUNE);
        await form.locator('label.tox-checkbox', { hasText: 'MIDI' }).click();
        await expect(form.locator('#midi')).toBeChecked();
        await form.getByRole('button', { name: 'Preview' }).click();

        // abcmusic.html (opened with #midi=1) builds the exported markup and exe_abc_music.js renders it.
        const dialog = page.frameLocator('.tox-dialog__body-iframe iframe');
        await expect(dialog.locator('.abcjs-paper svg').first()).toBeVisible({ timeout: 20000 });
        await expect(dialog.locator('.abcjs-paper .abcjs-note')).toHaveCount(8);
        // ABC source hidden behind its toggle, as in the export.
        await expect(dialog.locator('pre.abc-music')).toBeHidden();
        await dialog.locator('.abc-tooglebutton').click();
        await expect(dialog.locator('pre.abc-music')).toBeVisible();

        await dialog.locator('.abc-audio-tooglebutton').click();
        await expect(dialog.locator('.abcjs-audio .abcjs-inline-audio')).toBeVisible({ timeout: 10000 });
        // Download label comes from the editor's $exe_i18n.
        await expect(dialog.locator('.abcjs-midi a')).toHaveAttribute('href', /^data:audio\/midi,/);
        await expect(dialog.locator('.abcjs-midi a')).toHaveText('Download');
        // abcjs-audio.css styles the playback highlight.
        await expect
            .poll(() =>
                dialog.locator('body').evaluate(() => {
                    const note = document.querySelector('.abcjs-paper .abcjs-note') as Element;
                    note.classList.add('abcjs-highlight');
                    return getComputedStyle(note).fill;
                }),
            )
            .toBe('rgb(10, 158, 204)');
    });
});
