import { test, expect } from '../../fixtures/auth.fixture';
import { waitForAppReady, gotoWorkarea, addTextIdevice } from '../../helpers/workarea-helpers';
import { editTextIdevice, openMindmapEditor, renameTopic, topic } from '../../helpers/mindmap-helpers';

/**
 * The mind map editor works with no network: it must not request anything that this
 * application does not serve. Offline installations, the Electron build and exported
 * packages have no network, and nobody else needs to learn who opens a mind map.
 *
 * Every request type counts, images and fonts included, and it is checked by origin, so a
 * CDN nobody thought of still fails. Adapted from the mindmaps.app version of this test.
 */
test.describe('Mind map editor offline contract', () => {
    test('requests nothing from another origin while editing and saving', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const uuid = await createProject(page, 'Mind map offline');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await addTextIdevice(page);
        await editTextIdevice(page);

        const origin = new URL(page.url()).origin;
        const foreign: string[] = [];
        const editorFiles: string[] = [];
        page.on('request', request => {
            const url = request.url();
            if (url.startsWith('data:') || url.startsWith('blob:')) return;
            if (!url.startsWith(origin)) foreign.push(`${request.resourceType()} ${url}`);
            // What the editor page loads (the page itself may go through a static server's
            // clean-URL redirects, which are navigations, not files the editor needs)
            const isEditor = url.includes('exemindmap-editor') || url.includes('/exemindmap/');
            if (isEditor && request.resourceType() !== 'document') {
                editorFiles.push(new URL(url).pathname.split('/').pop() || '');
            }
        });

        const { frame } = await openMindmapEditor(page);
        // Exercise the interactions too: a lazily loaded dependency would only show up here
        await renameTopic(page, frame, 'Central Idea', 'Sin conexión');
        await topic(frame, 'Sin conexión').click();
        await frame.locator('#add-child').click();
        await page.keyboard.press('Enter');
        await frame.locator('#bold').click();
        await frame.locator('#text-color').fill('#336699');
        await frame.locator('.mind-elixir-toolbar.rb span').last().click();
        await frame.locator('#export').click();
        await frame.locator('#export-mermaid').click();
        await frame.locator('#save').click();
        await expect(page.locator('iframe[src*="exemindmap"]')).toHaveCount(0);

        expect(foreign, `editor requested remote resources:\n${foreign.join('\n')}`).toEqual([]);
        // The editor is two built files next to its page, each requested once
        expect(editorFiles.sort(), editorFiles.join(', ')).toEqual([
            'mindmap-editor.bundle.css',
            'mindmap-editor.bundle.js',
        ]);
    });

    test('loads no jQuery or legacy mindmaps code into the editor', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const uuid = await createProject(page, 'Mind map no jQuery');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await addTextIdevice(page);
        await editTextIdevice(page);
        const { frame2 } = await openMindmapEditor(page);

        const runtime = await frame2.evaluate(() => ({
            jquery: typeof (window as unknown as { jQuery?: unknown }).jQuery,
            mindmaps: typeof (window as unknown as { mindmaps?: unknown }).mindmaps,
            // What the editor document fetched (the page replaces its body, script tag included)
            resources: performance
                .getEntriesByType('resource')
                .map(entry => new URL(entry.name).pathname.split('/').pop())
                .sort(),
        }));
        expect(runtime, JSON.stringify(runtime)).toEqual({
            jquery: 'undefined',
            mindmaps: 'undefined',
            resources: ['mindmap-editor.bundle.css', 'mindmap-editor.bundle.js'],
        });
    });
});
