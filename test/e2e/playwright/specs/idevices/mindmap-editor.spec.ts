import * as fs from 'fs';
import { test, expect } from '../../fixtures/auth.fixture';
import type { Page } from '@playwright/test';
import { waitForAppReady, gotoWorkarea, addTextIdevice } from '../../helpers/workarea-helpers';
import {
    cancelMindmap,
    countNodes,
    dialogButton,
    doubleClick,
    editTextIdevice,
    editorData,
    findNode,
    openMindmapEditor,
    renameTopic,
    saveIdevice,
    saveMindmap,
    setTextContent,
    storedMaps,
    tinymceFrame,
    topic,
} from '../../helpers/mindmap-helpers';

/** The editor features the legacy mindmaps editor offered, in the Mind Elixir editor. */

async function newProjectWithTextIdevice(
    page: Page,
    createProject: (p: Page, n: string) => Promise<string>,
    name: string,
) {
    const uuid = await createProject(page, name);
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await addTextIdevice(page);
    return editTextIdevice(page);
}

async function addChild(page: Page, frame: ReturnType<Page['frameLocator']>, parent: string, caption: string) {
    await topic(frame, parent).click();
    await frame.locator('#add-child').click();
    await expect(frame.locator('#input-box')).toBeVisible();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(caption);
    await page.keyboard.press('Enter');
    await expect(topic(frame, caption)).toHaveCount(1);
}

test.describe('Mind map editor (Mind Elixir)', () => {
    test('creates a map, styles it and saves it as an SVG image with its source', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', e => errors.push(e.message));
        const block = await newProjectWithTextIdevice(page, createProject, 'Mind map new');

        const { frame, frame2 } = await openMindmapEditor(page);
        // One dialog: the editor itself, with TinyMCE's Save and Cancel
        await expect(page.locator('.tox-dialog')).toHaveCount(1);
        await expect(dialogButton(page, 'Save')).toBeVisible();
        await expect(frame.locator('#message')).toBeHidden();
        // The editor draws the map in the font the SVG is laid out for
        expect(await frame.locator('.map-container').evaluate(e => getComputedStyle(e).fontFamily)).toMatch(/^Arial,/);
        // The navigator previews the whole map
        const preview = frame.locator('#navigator img');
        await expect(preview).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/);
        const firstPreview = await preview.getAttribute('src');
        // A new map's title follows its central idea
        await expect(frame.locator('#map-title')).toHaveValue('Central Idea');
        await expect(frame.locator('#map-caption')).toBeChecked();
        await renameTopic(page, frame, 'Central Idea', 'Fotosíntesis');
        await expect(frame.locator('#map-title')).toHaveValue('Fotosíntesis');
        await addChild(page, frame, 'Fotosíntesis', 'Luz');
        await addChild(page, frame, 'Fotosíntesis', 'Agua & CO₂ <H2O>');
        await addChild(page, frame, 'Luz', 'Clorofila');
        await expect.poll(() => preview.getAttribute('src')).not.toBe(firstPreview);

        // Text style controls reflect and change the selected node
        await topic(frame, 'Luz').click();
        await frame.locator('#bold').click();
        await expect(frame.locator('#bold')).toHaveAttribute('aria-pressed', 'true');
        await frame.locator('#italic').click();
        await frame.locator('#underline').click();
        await frame.locator('#font-larger').click();
        await frame.locator('#text-color').fill('#c0392b');
        let luz = findNode((await editorData(frame2)).nodeData, 'Luz');
        expect(luz?.style).toMatchObject({
            fontWeight: 'bold',
            fontStyle: 'italic',
            textDecoration: 'underline',
            color: '#c0392b',
        });
        expect(Number.parseFloat(luz?.style?.fontSize ?? '0')).toBeGreaterThan(16);
        // The editor shows the decoration on the caption (Mind Elixir alone would not)
        const decoration = () =>
            topic(frame, 'Luz')
                .locator('.text')
                .evaluate(e => getComputedStyle(e).textDecorationLine);
        expect(await decoration()).toBe('underline');
        await frame.locator('#strike').click();
        await expect(frame.locator('#strike')).toHaveAttribute('aria-pressed', 'true');
        await expect(frame.locator('#underline')).toHaveAttribute('aria-pressed', 'false');
        expect(findNode((await editorData(frame2)).nodeData, 'Luz')?.style?.textDecoration).toBe('line-through');
        expect(await decoration()).toBe('line-through');

        // Branch colour, also applied to the children
        await frame.locator('#branch-color').fill('#2e7d32');
        await frame.locator('#branch-color-children').click();
        luz = findNode((await editorData(frame2)).nodeData, 'Luz');
        expect(luz?.branchColor).toBe('#2e7d32');
        expect(luz?.children?.[0].branchColor).toBe('#2e7d32');

        // Undo and redo
        await addChild(page, frame, 'Fotosíntesis', 'Temporal');
        await topic(frame, 'Temporal').click();
        await frame.locator('#remove').click();
        await expect(topic(frame, 'Temporal')).toHaveCount(0);
        await frame.locator('#undo').click();
        await expect(topic(frame, 'Temporal')).toHaveCount(1);
        await frame.locator('#redo').click();
        await expect(topic(frame, 'Temporal')).toHaveCount(0);
        // The root cannot be deleted
        await topic(frame, 'Fotosíntesis').click();
        await expect(frame.locator('#remove')).toBeDisabled();

        // One Save: the title is the one the editor proposed
        await saveMindmap(page, frame);
        // TinyMCE uploads the image as a project asset, like any other image
        await expect
            .poll(() => page.evaluate(() => (window as any).tinymce.get('textTextarea').getContent()))
            .toMatch(/<img src="asset:\/\/[^"]+\.svg" width="\d+" height="\d+" alt="Fotosíntesis"/);
        await saveIdevice(page, block);

        const [saved] = await storedMaps(page);
        expect(saved.format).toBe('mind-elixir');
        expect(countNodes(saved.data.nodeData)).toBe(4);
        expect(findNode(saved.data.nodeData, 'Agua & CO₂ <H2O>')).toBeTruthy();
        expect(saved.data.meta?.exelearning?.version).toBe(1);
        // The stored source is escaped, so its captions are never parsed as markup
        const html = await page.locator('#node-content .exe-mind-map').first().innerHTML();
        expect(html).toContain('&lt;H2O&gt;');
        // An SVG image of the map, with every topic as text and the node's style
        expect(saved.svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
        for (const caption of ['Fotosíntesis', 'Luz', 'Clorofila', 'Agua &amp; CO₂ &lt;H2O&gt;']) {
            expect(saved.svg).toContain(`>${caption}</tspan>`);
        }
        expect(saved.svg).toContain('fill="#c0392b"');
        expect(saved.svg).toContain('text-decoration="line-through"');
        // The editor's theme: a white central idea with an orange border, on white
        expect(saved.svg).toMatch(/fill="#ffffff" stroke="#ffa500"/);
        expect(saved.svg).toMatch(/<title[^>]*>Fotosíntesis<\/title>/);
        expect(saved.svg).not.toMatch(/<script|<foreignObject/);
        const img = page.locator('#node-content .exe-mind-map img').first();
        await expect(img).toHaveAttribute('alt', 'Fotosíntesis');
        expect(await img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(100);
        await expect(page.locator('#node-content .exe-mind-map figcaption')).toContainText('Fotosíntesis');
        expect(errors).toEqual([]);
    });

    test('adds, deletes and reorders ideas from the map, as in the legacy editor', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        await newProjectWithTextIdevice(page, createProject, 'Mind map nub');
        const { frame, frame2 } = await openMindmapEditor(page);
        const children = async (caption: string) =>
            findNode((await editorData(frame2)).nodeData, caption)?.children?.map(c => c.topic);
        /** The legacy nub: the "+" on the selected idea adds a child */
        const addWithNub = async (parent: string, caption: string) => {
            await topic(frame, parent).click();
            await frame.locator('#node-add').click();
            await expect(frame.locator('#input-box')).toBeVisible();
            await expect(frame.locator('#node-add')).toBeHidden();
            await page.keyboard.press('ControlOrMeta+a');
            await page.keyboard.type(caption);
            await page.keyboard.press('Enter');
            await expect(topic(frame, caption)).toHaveCount(1);
        };

        // The central idea cannot be deleted, so it has no "×"
        await expect(frame.locator('#node-add')).toBeVisible();
        await expect(frame.locator('#node-remove')).toBeHidden();
        await addWithNub('Central Idea', 'Rama');
        for (const caption of ['Uno', 'Dos', 'Tres']) await addWithNub('Rama', caption);
        expect(await children('Rama')).toEqual(['Uno', 'Dos', 'Tres']);

        // Move up and down
        await topic(frame, 'Tres').click();
        await frame.locator('#move-up').click();
        expect(await children('Rama')).toEqual(['Uno', 'Tres', 'Dos']);
        await frame.locator('#move-down').click();
        expect(await children('Rama')).toEqual(['Uno', 'Dos', 'Tres']);

        // Dragged just above another idea, an idea goes before it; dropped on one, it becomes its child
        const drag = async (from: string, to: string, above: boolean) => {
            const a = await topic(frame, from).boundingBox();
            const b = await topic(frame, to).boundingBox();
            if (!a || !b) throw new Error('topic not found');
            await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
            await page.mouse.down();
            await page.mouse.move(b.x + b.width / 2, above ? b.y - 5 : b.y + b.height / 2, { steps: 10 });
            await page.mouse.up();
        };
        await drag('Tres', 'Uno', true);
        expect(await children('Rama')).toEqual(['Tres', 'Uno', 'Dos']);
        await drag('Dos', 'Uno', false);
        expect(await children('Rama')).toEqual(['Tres', 'Uno']);
        expect(await children('Uno')).toEqual(['Dos']);

        // The "×" deletes the selected idea
        await topic(frame, 'Tres').click();
        await expect(frame.locator('#node-remove')).toBeVisible();
        await frame.locator('#node-remove').click();
        await expect(topic(frame, 'Tres')).toHaveCount(0);
        expect(await children('Rama')).toEqual(['Uno']);
    });

    test('leaves the caption out on request, and keeps the title and caption when reopened', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const block = await newProjectWithTextIdevice(page, createProject, 'Mind map caption');
        let { frame } = await openMindmapEditor(page);
        await renameTopic(page, frame, 'Central Idea', 'Raíz "1" # *a*');
        await addChild(page, frame, 'Raíz "1" # *a*', 'Hija');
        await frame.locator('#map-title').fill('Sin título');
        await frame.locator('#map-caption').uncheck();
        await saveMindmap(page, frame);
        await expect(tinymceFrame(page).locator('.exe-mind-map figcaption')).toHaveCount(0);

        // Reopened, the title (not the central idea) and the caption setting are kept
        ({ frame } = await openMindmapEditor(page, 0));
        await expect(frame.locator('#map-title')).toHaveValue('Sin título');
        await expect(frame.locator('#map-caption')).not.toBeChecked();
        // A caption still being typed is kept when Save is clicked
        await doubleClick(topic(frame, 'Hija'));
        await expect(frame.locator('#input-box')).toBeVisible();
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.type('Hija editada');
        await saveMindmap(page, frame);
        await saveIdevice(page, block);

        const [saved] = await storedMaps(page);
        expect(saved.svg).toContain('>Raíz &quot;1&quot; # *a*</tspan>');
        expect(saved.svg).toContain('>Hija editada</tspan>');
        await expect(page.locator('#node-content .exe-mind-map')).toHaveCount(1);
        await expect(page.locator('#node-content .exe-mind-map figcaption')).toHaveCount(0);
        await expect(page.locator('#node-content .exe-mind-map img')).toHaveAttribute('alt', 'Sin título');
    });

    test('cancelling or closing changes nothing; a failed save keeps the dialog and the map', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const block = await newProjectWithTextIdevice(page, createProject, 'Mind map cancel');
        const content = () => page.evaluate(() => (window as any).tinymce.get('textTextarea').getContent());

        // A new map that is cancelled is not inserted
        let { frame } = await openMindmapEditor(page);
        await renameTopic(page, frame, 'Central Idea', 'Descartado');
        await cancelMindmap(page);
        expect(await content()).not.toContain('exe-mind-map');

        // A saved map, then edits closed with the dialog's close button
        ({ frame } = await openMindmapEditor(page));
        await renameTopic(page, frame, 'Central Idea', 'Guardado');
        await saveMindmap(page, frame);
        // TinyMCE stores the image as an asset after the map is inserted
        await expect.poll(content).toMatch(/<img src="asset:\/\/[^"]+\.svg"/);
        const saved = await content();
        let frame2;
        ({ frame, frame2 } = await openMindmapEditor(page, 0));
        await renameTopic(page, frame, 'Guardado', 'Cerrado sin guardar');
        await page.locator('.tox-dialog__header button[aria-label="Close"]').click();
        await expect(page.locator('.tox-dialog')).toHaveCount(0);
        expect(await content()).toBe(saved);

        // An SVG that cannot be made: the dialog stays open, says why and can save again
        ({ frame, frame2 } = await openMindmapEditor(page, 0));
        await renameTopic(page, frame, 'Guardado', 'Falla');
        await frame2.evaluate(() => {
            (window as any).__mindmapEditor.exportVectorSvg = () => Promise.reject(new Error('no SVG'));
        });
        await dialogButton(page, 'Save').click();
        await expect(frame.locator('#message.error')).toContainText('no SVG');
        await expect(page.locator('.tox-dialog')).toHaveCount(1);
        await expect(dialogButton(page, 'Save')).toBeEnabled();
        expect(await content()).toBe(saved);
        await cancelMindmap(page);
        expect(await content()).toBe(saved);
        await saveIdevice(page, block);
        expect((await storedMaps(page))[0].data.nodeData.topic).toBe('Guardado');
    });

    test('imports a legacy mindmaps JSON file and exports the map as JSON', async ({
        authenticatedPage: page,
        createProject,
    }, testInfo) => {
        await newProjectWithTextIdevice(page, createProject, 'Mind map import');
        const { frame, frame2 } = await openMindmapEditor(page);

        // A file exported by the legacy editor's Tools > Export
        const legacy = {
            id: 'doc',
            title: 'Importado',
            mindmap: {
                root: {
                    id: 'root',
                    parentId: null,
                    text: {
                        caption: 'Importado',
                        font: { style: 'normal', weight: 'bold', decoration: 'none', size: 20, color: '#000000' },
                    },
                    offset: { x: 0, y: 0 },
                    foldChildren: false,
                    branchColor: '#000000',
                    children: [
                        {
                            id: 'a',
                            parentId: 'root',
                            text: {
                                caption: 'Rama izquierda',
                                font: {
                                    style: 'italic',
                                    weight: 'normal',
                                    decoration: 'none',
                                    size: 15,
                                    color: '#1565c0',
                                },
                            },
                            offset: { x: -150, y: 0 },
                            foldChildren: false,
                            branchColor: '#1565c0',
                            children: [],
                        },
                    ],
                },
            },
            dates: { created: 1 },
            dimensions: { x: 4000, y: 2000 },
            autosave: false,
        };
        const file = testInfo.outputPath('legacy-export.json');
        fs.writeFileSync(file, `﻿${JSON.stringify(legacy)}`);
        await frame.locator('#import-file').setInputFiles(file);
        await expect(topic(frame, 'Rama izquierda')).toHaveCount(1);
        const imported = findNode((await editorData(frame2)).nodeData, 'Rama izquierda');
        expect(imported).toMatchObject({
            direction: 0,
            branchColor: '#1565c0',
            style: { fontStyle: 'italic', color: '#1565c0' },
        });

        const downloadPromise = page.waitForEvent('download');
        await frame.locator('#export').click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe('Importado.json');
        const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
        expect(exported.nodeData.children[0].topic).toBe('Rama izquierda');
        expect(exported.meta.exelearning.version).toBe(1);

        // An unreadable file is refused without touching the map
        const bad = testInfo.outputPath('bad.json');
        fs.writeFileSync(bad, '{"nope": true}');
        await frame.locator('#import-file').setInputFiles(bad);
        await expect(frame.locator('#message.error')).toContainText(/wrong file format/i);
        await expect(topic(frame, 'Rama izquierda')).toHaveCount(1);
    });

    test('keeps an unreadable map until the author saves a new one', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const block = await newProjectWithTextIdevice(page, createProject, 'Mind map damaged');
        const damaged =
            '<p>Antes</p><div class="exe-mind-map"><figure class="exe-figure exe-image position-center"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" width="10" height="10" alt="Dañado"></figure><p class="exe-mindmap-code">{"broken": </p></div><p>Después</p>';
        await setTextContent(page, damaged);

        const { frame } = await openMindmapEditor(page, 0);
        await expect(frame.locator('#message.error')).toContainText(/could not be opened/i);
        await expect(topic(frame, 'Central Idea')).toHaveCount(1);
        await cancelMindmap(page);
        await saveIdevice(page, block);

        // Cancelling left the original source and image in place
        const code = await page
            .locator('#node-content .exe-mindmap-code')
            .first()
            .evaluate(p => p.innerHTML);
        expect(code).toMatch(/^\{"broken":\s*$/);
        await expect(page.locator('#node-content .exe-mind-map img')).toHaveAttribute('alt', 'Dañado');
    });

    test('edits two maps of one iDevice separately', async ({ authenticatedPage: page, createProject }) => {
        const block = await newProjectWithTextIdevice(page, createProject, 'Mind map two');
        let { frame } = await openMindmapEditor(page);
        await renameTopic(page, frame, 'Central Idea', 'Primero');
        await saveMindmap(page, frame, 'Primero');
        await tinymceFrame(page).locator('body > p').last().click();
        await page.keyboard.press('ControlOrMeta+End');
        ({ frame } = await openMindmapEditor(page));
        await renameTopic(page, frame, 'Central Idea', 'Segundo');
        await saveMindmap(page, frame, 'Segundo');

        ({ frame } = await openMindmapEditor(page, 0));
        await expect(topic(frame, 'Primero')).toHaveCount(1);
        await renameTopic(page, frame, 'Primero', 'Primero editado');
        await saveMindmap(page, frame, 'Primero editado');

        // The map was replaced where it was, as one TinyMCE undo step
        const titles = () =>
            page.evaluate(() =>
                Array.from(
                    (window as any).tinymce.get('textTextarea').getBody().querySelectorAll('.exe-mind-map img'),
                    (img: HTMLImageElement) => img.alt,
                ),
            );
        expect(await titles()).toEqual(['Primero editado', 'Segundo']);
        await page.evaluate(() => (window as any).tinymce.get('textTextarea').undoManager.undo());
        expect(await titles()).toEqual(['Primero', 'Segundo']);
        await page.evaluate(() => (window as any).tinymce.get('textTextarea').undoManager.redo());
        expect(await titles()).toEqual(['Primero editado', 'Segundo']);
        await saveIdevice(page, block);

        const maps = await storedMaps(page);
        expect(maps.map(m => m.data.nodeData.topic).sort()).toEqual(['Primero editado', 'Segundo']);
        expect(maps.map(m => m.svg.includes('>Primero editado</tspan>'))).toEqual([true, false]);
    });
});
