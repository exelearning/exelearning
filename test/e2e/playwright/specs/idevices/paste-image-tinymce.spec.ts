import { test, expect } from '../../fixtures/auth.fixture';
import { addTextIdevice, gotoWorkarea, selectFirstPage, waitForTinyMCEReady } from '../../helpers/workarea-helpers';

/**
 * Regression test for issue #1712 — "Paste images in TinyMCE".
 *
 * With `paste_as_text: true` enabled, TinyMCE 5's paste plugin routes HTML
 * pastes through pasteText(), which HTML-encodes the payload and silently
 * strips any <img> tags. When a user copies an image from another app/web
 * page, the clipboard usually contains both the image file AND a text/html
 * fragment — so the image was dropped before our images_upload_handler ever
 * got a chance to run.
 *
 * This test simulates a paste event (the only reliable way to exercise the
 * clipboard path in Playwright) carrying a PNG file and asserts:
 *   1. the <img> survives the paste,
 *   2. the AssetManager stores it as an asset (data-asset-id set),
 *   3. on save, the content is serialised with an `asset://` URL.
 */

test.describe('Paste images in TinyMCE (#1712)', () => {
    test('pasted image is stored as an asset and not stripped', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'Paste Image TinyMCE');
        await gotoWorkarea(page, projectUuid);

        await selectFirstPage(page);
        await addTextIdevice(page);
        await waitForTinyMCEReady(page);

        // Minimal valid PNG (1×1 red pixel), base64-encoded.
        const pngBase64 =
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

        // Dispatch a synthetic paste event on the TinyMCE body carrying an
        // image file. TinyMCE's paste handler runs on the editor iframe body.
        const pasteResult = await page.evaluate(
            async ({ b64 }) => {
                const editor = (window as any).tinymce?.activeEditor;
                if (!editor) return { inserted: false, reason: 'no-editor' };

                const binary = atob(b64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                const file = new File([bytes], 'pasted.png', { type: 'image/png' });

                // DataTransfer.items is read-only in most browsers, so fake the
                // clipboardData with a minimal items collection that the handler
                // understands.
                const items = [
                    {
                        kind: 'file',
                        type: 'image/png',
                        getAsFile: () => file,
                    },
                ];

                const event = new Event('paste', { bubbles: true, cancelable: true }) as any;
                event.clipboardData = {
                    items,
                    types: ['Files'],
                    files: [file],
                    getData: () => '',
                };

                editor.fire('paste', event);

                // Wait up to ~2s for the handler to finish storing the asset and
                // inserting the image into the editor body.
                const start = Date.now();
                while (Date.now() - start < 2000) {
                    const img = editor.getBody()?.querySelector('img[data-asset-id]');
                    if (img) {
                        return {
                            inserted: true,
                            hasAssetId: !!img.getAttribute('data-asset-id'),
                            src: img.getAttribute('src') || '',
                            dataMceSrc: img.getAttribute('data-mce-src') || '',
                        };
                    }
                    await new Promise(r => setTimeout(r, 50));
                }
                return { inserted: false, reason: 'timeout' };
            },
            { b64: pngBase64 },
        );

        expect(pasteResult.inserted).toBe(true);
        expect(pasteResult.hasAssetId).toBe(true);
        // Rendered src is a blob:// URL (for in-editor display) but the
        // canonical data-mce-src must be the asset:// URL.
        expect(pasteResult.dataMceSrc).toMatch(/^asset:\/\//);

        // GetContent must convert the blob back to asset:// for persistence.
        const serialised = await page.evaluate(() => {
            const editor = (window as any).tinymce?.activeEditor;
            return editor ? editor.getContent() : '';
        });
        expect(serialised).toContain('<img');
        expect(serialised).toMatch(/asset:\/\//);
    });
});
