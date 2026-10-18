import * as fs from 'fs';
import { test, expect } from '../../fixtures/auth.fixture';
import type { Page } from '@playwright/test';
import { waitForAppReady, gotoWorkarea, addTextIdevice } from '../../helpers/workarea-helpers';
import {
    cancelMindmap,
    countNodes,
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
        await expect(frame.locator('#message')).toBeHidden();
        // The editor draws the map in the font the SVG is laid out for
        expect(await frame.locator('.map-container').evaluate(e => getComputedStyle(e).fontFamily)).toMatch(/^Arial,/);
        await renameTopic(page, frame, 'Central Idea', 'Fotosíntesis');
        await addChild(page, frame, 'Fotosíntesis', 'Luz');
        await addChild(page, frame, 'Fotosíntesis', 'Agua & CO₂ <H2O>');
        await addChild(page, frame, 'Luz', 'Clorofila');

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
        await frame.locator('#strike').click();
        expect(findNode((await editorData(frame2)).nodeData, 'Luz')?.style?.textDecoration).toBe('line-through');

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

        await saveMindmap(page, frame, 'Fotosíntesis');
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
        expect(saved.svg).not.toMatch(/<script|<foreignObject/);
        const img = page.locator('#node-content .exe-mind-map img').first();
        await expect(img).toHaveAttribute('alt', 'Fotosíntesis');
        expect(await img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(100);
        await expect(page.locator('#node-content .exe-mind-map figcaption')).toContainText('Fotosíntesis');
        expect(errors).toEqual([]);
    });

    test('leaves the caption out on request; the alt names the map', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const block = await newProjectWithTextIdevice(page, createProject, 'Mind map caption');
        const { frame } = await openMindmapEditor(page);
        await renameTopic(page, frame, 'Central Idea', 'Raíz "1" # *a*');
        await addChild(page, frame, 'Raíz "1" # *a*', 'Hija');

        await frame.locator('#save').click();
        await expect(page.locator('iframe[src*="exemindmap"]')).toHaveCount(0);
        const dialog = page.locator('.tox-dialog');
        await dialog
            .locator('.tox-form__group', { hasText: /Descriptive title/i })
            .locator('input')
            .fill('Sin título');
        await dialog.locator('.tox-checkbox', { hasText: /Show the title/i }).click();
        await dialog
            .locator('.tox-dialog__footer button')
            .filter({ hasText: /^(Save|Guardar)$/ })
            .click();
        await saveIdevice(page, block);

        const [saved] = await storedMaps(page);
        expect(saved.svg).toContain('>Raíz &quot;1&quot; # *a*</tspan>');
        await expect(page.locator('#node-content .exe-mind-map figcaption')).toHaveCount(0);
        await expect(page.locator('#node-content .exe-mind-map img')).toHaveAttribute('alt', 'Sin título');
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
        await saveIdevice(page, block);

        const maps = await storedMaps(page);
        expect(maps.map(m => m.data.nodeData.topic).sort()).toEqual(['Primero editado', 'Segundo']);
        expect(maps.map(m => m.svg.includes('>Primero editado</tspan>'))).toEqual([true, false]);
    });
});
