import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '../../fixtures/auth.fixture';
import {
    waitForAppReady,
    gotoWorkarea,
    openElpFile,
    selectFirstPage,
    saveProject,
    downloadProject,
    reloadPage,
} from '../../helpers/workarea-helpers';
import {
    cancelMindmap,
    captions,
    countNodes,
    editTextIdevice,
    editorData,
    findNode,
    openMindmapEditor,
    renameTopic,
    saveIdevice,
    saveMindmap,
    storedMaps,
    topic,
} from '../../helpers/mindmap-helpers';

/**
 * Legacy mind maps stay editable after the move to Mind Elixir.
 *
 * test/fixtures/legacy-mindmaps.elpx was made on main (0d5451abc) with the mindmaps.app
 * editor, through the real exemindmap plugin: a rich map (captions with accents, emoji, CJK,
 * `&`, quotes and `<clima>`, colours, sizes, bold/italic/underline/strike-through, a folded
 * branch, branches on both sides), a map created only with the editor UI, and a 311-node map.
 * The rich one could not be reopened by the legacy editor ("Sorry, wrong file format").
 */

const FIXTURE = path.resolve(__dirname, '../../../../fixtures/legacy-mindmaps.elpx');
const RICH_ROOT = 'Ciencias de la Tierra — ñ á ü 数学 🌍';
const SPECIAL = 'Hidrología & <clima> "comillas" \'simples\'';

test.describe('Legacy mind maps in the Mind Elixir editor', () => {
    test('opens, edits, saves, reopens, exports and reimports a legacy map', async ({
        authenticatedPage: page,
        createProject,
    }, testInfo) => {
        test.setTimeout(240000);
        const pageErrors: string[] = [];
        page.on('pageerror', error => pageErrors.push(error.message));

        // 1-2. Open the legacy project and find the map in the Text iDevice
        const projectUuid = await createProject(page, 'Legacy mind maps');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await openElpFile(page, FIXTURE);
        await selectFirstPage(page);
        const before = await storedMaps(page);
        expect(before.map(m => m.format)).toEqual(['legacy', 'legacy', 'legacy']);
        expect(before.map(m => countNodes(m.data.nodeData))).toEqual([16, 3, 311]);

        // 3-4. Open it with the plugin; every original node is there
        let block = await editTextIdevice(page, 0);
        let { frame, frame2 } = await openMindmapEditor(page, 0);
        await expect(frame.locator('#message')).toContainText(/previous editor/i);
        const opened = await editorData(frame2);
        expect(countNodes(opened.nodeData)).toBe(16);
        expect(captions(opened.nodeData)).toEqual(captions(before[0].data.nodeData));
        await expect(topic(frame, RICH_ROOT)).toBeVisible();
        await expect(topic(frame, SPECIAL)).toBeVisible();
        // The folded branch starts folded: its children are not drawn
        await expect(topic(frame, 'Ríos')).toHaveCount(0);

        // 5. Edit the root title
        await renameTopic(page, frame, RICH_ROOT, 'Planeta Tierra');
        // 6. Edit an existing child
        await renameTopic(page, frame, 'Minerales', 'Minerales y gemas');
        // 7. Add a child to an existing node
        await topic(frame, 'Atmósfera').click();
        await frame.locator('#add-child').click();
        await expect(frame.locator('#input-box')).toBeVisible();
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.type('Clima');
        await page.keyboard.press('Enter');
        await expect(topic(frame, 'Clima')).toBeVisible();
        // 8. Delete another node
        await topic(frame, 'Capas').click();
        await frame.locator('#remove').click();
        await expect(topic(frame, 'Capas')).toHaveCount(0);
        // 9. Change a branch colour
        await topic(frame, 'Geología').click();
        await frame.locator('#branch-color').fill('#123456');
        // 10. Expand the folded branch, then collapse it again
        const expander = topic(frame, SPECIAL).locator('xpath=following-sibling::me-epd');
        await expander.click();
        await expect(topic(frame, 'Ríos')).toHaveCount(1);
        expect(findNode((await editorData(frame2)).nodeData, SPECIAL)?.expanded).toBe(true);
        await expander.click();
        await expect(topic(frame, 'Ríos')).toHaveCount(0);
        expect(findNode((await editorData(frame2)).nodeData, SPECIAL)?.expanded).toBe(false);

        // 11-12. Save; the legacy PNG is replaced by an SVG of the edited map
        await saveMindmap(page, frame, 'Mapa rico editado');
        await saveIdevice(page, block);
        const afterSave = await storedMaps(page);
        expect(afterSave[0].format).toBe('mind-elixir');
        expect(afterSave[0].svg).toContain('>Planeta Tierra</tspan>');
        expect(before[0].svg).toBe('');
        expect(afterSave.slice(1).map(m => m.format)).toEqual(['legacy', 'legacy']);

        const expectEdited = (data: (typeof afterSave)[0]['data']) => {
            expect(data.nodeData.topic).toBe('Planeta Tierra');
            expect(findNode(data.nodeData, 'Minerales y gemas')).toBeTruthy();
            expect(findNode(data.nodeData, 'Atmósfera')?.children?.map(c => c.topic)).toEqual(['Composición', 'Clima']);
            expect(findNode(data.nodeData, 'Capas')).toBeUndefined();
            expect(findNode(data.nodeData, 'Geología')?.branchColor).toBe('#123456');
            expect(findNode(data.nodeData, SPECIAL)?.expanded).toBe(false);
            // Unchanged nodes keep their legacy styles, offsets and ids
            const hidro = findNode(data.nodeData, SPECIAL);
            expect(hidro?.style).toEqual({ fontStyle: 'italic', textDecoration: 'underline' });
            expect(hidro?.metadata).toEqual({ legacyOffset: { x: 240, y: 120 } });
            expect(hidro?.id).toBe(findNode(before[0].data.nodeData, SPECIAL)?.id);
            expect(countNodes(data.nodeData)).toBe(16);
            expect(data.meta?.exelearning?.legacy?.title).toBe(RICH_ROOT);
        };
        expectEdited(afterSave[0].data);

        // 13-14. Save the project and reload it
        await saveProject(page);
        await reloadPage(page);
        await selectFirstPage(page);
        const reloaded = await storedMaps(page);
        expectEdited(reloaded[0].data);
        await expect(page.locator('#node-content .exe-mind-map figcaption').first()).toHaveText('Mapa rico editado');

        // 15-17. Reopen the same map; the changes are there and it can be edited again
        block = await editTextIdevice(page, 0);
        ({ frame, frame2 } = await openMindmapEditor(page, 0));
        await expect(frame.locator('#message')).toBeHidden();
        await expect(topic(frame, 'Planeta Tierra')).toBeVisible();
        await expect(topic(frame, 'Clima')).toBeVisible();
        await renameTopic(page, frame, 'Clima', 'Clima y tiempo');
        await saveMindmap(page, frame, 'Mapa rico editado dos veces');
        await saveIdevice(page, block);
        const edited = (await storedMaps(page))[0];
        expect(findNode(edited.data.nodeData, 'Clima y tiempo')).toBeTruthy();
        expect(edited.svg).toContain('>Clima y tiempo</tspan>');
        await saveProject(page);

        // 18. Export the project
        const download = await downloadProject(page);
        const exported = testInfo.outputPath('legacy-mindmaps-edited.elpx');
        await download.saveAs(exported);
        expect(fs.statSync(exported).size).toBeGreaterThan(0);

        // 19-20. Reimport it into a new project; the map is still editable
        const secondUuid = await createProject(page, 'Legacy mind maps reimported');
        await gotoWorkarea(page, secondUuid);
        await waitForAppReady(page);
        await openElpFile(page, exported);
        await selectFirstPage(page);
        const reimported = await storedMaps(page);
        expect(findNode(reimported[0].data.nodeData, 'Clima y tiempo')).toBeTruthy();
        expect(reimported.slice(1).map(m => countNodes(m.data.nodeData))).toEqual([3, 311]);

        block = await editTextIdevice(page, 0);
        ({ frame, frame2 } = await openMindmapEditor(page, 0));
        await expect(topic(frame, 'Clima y tiempo')).toBeVisible();
        await topic(frame, 'Planeta Tierra').click();
        await frame.locator('#add-child').click();
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.type('Tras reimportar');
        await page.keyboard.press('Enter');
        await saveMindmap(page, frame, 'Mapa reimportado');
        await saveIdevice(page, block);
        expect(findNode((await storedMaps(page))[0].data.nodeData, 'Tras reimportar')).toBeTruthy();

        expect(pageErrors).toEqual([]);
    });

    test('opens the large legacy map and the map made with the legacy UI', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const projectUuid = await createProject(page, 'Legacy mind maps large');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await openElpFile(page, FIXTURE);
        await selectFirstPage(page);

        // The stored source of every map, exactly as it is in the page
        const rawCodes = () =>
            page.locator('#node-content .exe-mindmap-code').evaluateAll(codes => codes.map(c => c.innerHTML));
        const original = await rawCodes();

        const simpleBlock = await editTextIdevice(page, 1);
        let { frame, frame2 } = await openMindmapEditor(page, 0);
        await expect(topic(frame, 'Mi primer mapa')).toBeVisible();
        await expect(topic(frame, 'Segunda idea')).toBeVisible();
        await renameTopic(page, frame, 'Segunda idea', 'No guardado');
        await cancelMindmap(page);
        await saveIdevice(page, simpleBlock);
        // Cancelling changed nothing
        expect((await storedMaps(page))[1].format).toBe('legacy');

        const largeBlock = await editTextIdevice(page, 2);
        ({ frame, frame2 } = await openMindmapEditor(page, 0));
        const start = Date.now();
        await expect(frame.locator('me-tpc')).toHaveCount(311, { timeout: 15000 });
        expect(Date.now() - start).toBeLessThan(15000);
        expect(countNodes((await editorData(frame2)).nodeData)).toBe(311);
        // Closing the dialog does not convert or touch the legacy source either
        await page.locator('.tox-dialog__header button[aria-label="Close"]').click();
        await expect(page.locator('.tox-dialog')).toHaveCount(0);
        await saveIdevice(page, largeBlock);
        expect(await rawCodes()).toEqual(original);
    });
});
