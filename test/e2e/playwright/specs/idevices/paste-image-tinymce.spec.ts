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
                    types: ['Files', 'text/html', 'text/plain'],
                    files: [file],
                    // The real clipboard from a web-page copy contains both the
                    // image file AND a text/html fragment. That is the case the
                    // built-in paste plugin strips — exercise it explicitly so
                    // the test matches real Google-Docs/Chrome-copy behaviour.
                    getData: (type: string) => {
                        if (type === 'text/html') return '<p>caption</p>';
                        if (type === 'text/plain') return 'caption';
                        return '';
                    },
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

    test('remote <img src> in pasted HTML (Google Docs/web page) is downloaded and stored', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'Paste Remote Image TinyMCE');
        await gotoWorkarea(page, projectUuid);

        await selectFirstPage(page);
        await addTextIdevice(page);
        await waitForTinyMCEReady(page);

        // Stub fetch to return a tiny valid PNG so we don't depend on network.
        const pasteResult = await page.evaluate(async () => {
            const editor = (window as any).tinymce?.activeEditor;
            if (!editor) return { inserted: false, reason: 'no-editor' };

            const pngBase64 =
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
            const bin = atob(pngBase64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const imgBlob = new Blob([bytes], { type: 'image/png' });

            const originalFetch = window.fetch;
            (window as any).fetch = async (url: string) => {
                if (String(url).includes('stub-remote.png')) {
                    return { ok: true, status: 200, blob: () => Promise.resolve(imgBlob) } as unknown as Response;
                }
                return originalFetch(url);
            };

            const html = '<p>From Google Docs:</p><img src="https://example.com/stub-remote.png" alt="doc">';
            const event = new Event('paste', { bubbles: true, cancelable: true }) as any;
            event.clipboardData = {
                items: [{ kind: 'string', type: 'text/html', getAsFile: () => null }],
                types: ['text/html', 'text/plain'],
                files: [],
                getData: (type: string) => {
                    if (type === 'text/html') return html;
                    if (type === 'text/plain') return 'From Google Docs:';
                    return '';
                },
            };

            editor.fire('paste', event);

            const start = Date.now();
            while (Date.now() - start < 3000) {
                const img = editor.getBody()?.querySelector('img[data-asset-id]');
                if (img) {
                    (window as any).fetch = originalFetch;
                    return {
                        inserted: true,
                        alt: img.getAttribute('alt'),
                        dataMceSrc: img.getAttribute('data-mce-src'),
                    };
                }
                await new Promise(r => setTimeout(r, 50));
            }
            (window as any).fetch = originalFetch;
            return { inserted: false, reason: 'timeout' };
        });

        expect(pasteResult.inserted).toBe(true);
        expect(pasteResult.alt).toBe('doc');
        expect(pasteResult.dataMceSrc).toMatch(/^asset:\/\//);
    });

    test('pasting an <img src="data:..."> data URL stores a new asset', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Paste Data URL TinyMCE');
        await gotoWorkarea(page, projectUuid);

        await selectFirstPage(page);
        await addTextIdevice(page);
        await waitForTinyMCEReady(page);

        const pasteResult = await page.evaluate(async () => {
            const editor = (window as any).tinymce?.activeEditor;
            if (!editor) return { inserted: false };

            const dataUrl =
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
            const html = `<img src="${dataUrl}" alt="fromData">`;

            const event = new Event('paste', { bubbles: true, cancelable: true }) as any;
            event.clipboardData = {
                items: [{ kind: 'string', type: 'text/html', getAsFile: () => null }],
                types: ['text/html'],
                files: [],
                getData: (type: string) => (type === 'text/html' ? html : ''),
            };
            editor.fire('paste', event);

            const start = Date.now();
            while (Date.now() - start < 3000) {
                const img = editor.getBody()?.querySelector('img[data-asset-id]');
                if (img) {
                    return {
                        inserted: true,
                        alt: img.getAttribute('alt'),
                        src: img.getAttribute('src'),
                    };
                }
                await new Promise(r => setTimeout(r, 50));
            }
            return { inserted: false };
        });

        expect(pasteResult.inserted).toBe(true);
        expect(pasteResult.alt).toBe('fromData');
        expect(pasteResult.src || '').toMatch(/^(asset:\/\/|blob:)/);
    });

    test('round-trip: copy from TinyMCE puts a data: URL on the clipboard and pasting it back reuses the asset', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Copy Paste RoundTrip TinyMCE');
        await gotoWorkarea(page, projectUuid);

        await selectFirstPage(page);
        await addTextIdevice(page);
        await waitForTinyMCEReady(page);

        // First, paste an image so there's something to copy back out.
        const result = await page.evaluate(async () => {
            const editor = (window as any).tinymce?.activeEditor;
            if (!editor) return { ok: false, reason: 'no-editor' };

            const dataUrl =
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

            // --- 1. Prime the editor with an image ---
            const primeEvent = new Event('paste', { bubbles: true, cancelable: true }) as any;
            primeEvent.clipboardData = {
                items: [{ kind: 'string', type: 'text/html', getAsFile: () => null }],
                types: ['text/html'],
                files: [],
                getData: (t: string) => (t === 'text/html' ? `<img src="${dataUrl}" alt="round">` : ''),
            };
            editor.fire('paste', primeEvent);
            let firstAssetId = '';
            const t1 = Date.now();
            while (Date.now() - t1 < 3000 && !firstAssetId) {
                const i = editor.getBody()?.querySelector('img[data-asset-id]');
                if (i) firstAssetId = i.getAttribute('data-asset-id') || '';
                if (!firstAssetId) await new Promise(r => setTimeout(r, 50));
            }
            if (!firstAssetId) return { ok: false, reason: 'prime-timeout' };

            // --- 2. Build a selection that covers the image and trigger copy ---
            // editor.selection.select(img) fails in Firefox under Playwright
            // because contentWindow.getSelection() returns null when the iframe
            // isn't focused. The handler we're testing only reads from
            // selection.isCollapsed() / getContent() / ... so stub those
            // directly — that matches what the handler sees in real use.
            const body = editor.getBody();
            const img = body.querySelector('img[data-asset-id]') as HTMLElement;
            const realSelection = editor.selection;
            editor.selection = {
                ...realSelection,
                isCollapsed: () => false,
                getContent: ({ format }: { format?: string } = {}) =>
                    format === 'text' ? '' : img.outerHTML,
            };

            // Capture what handleCopyCut writes to the clipboard.
            // navigator.clipboard is a read-only getter on the Navigator
            // prototype, so we can't reassign the whole clipboard object —
            // just replace the .write method in place.
            const writes: any[] = [];
            const originalWrite = (window as any).navigator.clipboard?.write;
            const originalClipboardItem = (window as any).ClipboardItem;
            if ((window as any).navigator.clipboard) {
                (window as any).navigator.clipboard.write = async (items: any[]) => {
                    writes.push(items);
                    return Promise.resolve();
                };
            }
            (window as any).ClipboardItem = function (parts: any) {
                (this as any).parts = parts;
            };

            const copyEvent = new Event('copy', { bubbles: true, cancelable: true }) as any;
            copyEvent.clipboardData = null;

            const selectionState = {
                collapsed: editor.selection.isCollapsed(),
                html: editor.selection.getContent({ contextual: true }),
            };

            editor.fire('copy', copyEvent);

            // Drain any pending microtasks (async clipboard.write).
            for (let i = 0; i < 50; i++) await new Promise(r => setTimeout(r, 50));

            // Restore the real selection object before the paste step.
            editor.selection = realSelection;
            if (originalWrite && (window as any).navigator.clipboard) {
                (window as any).navigator.clipboard.write = originalWrite;
            }
            (window as any).ClipboardItem = originalClipboardItem;

            if (!writes.length)
                return {
                    ok: false,
                    reason: 'no-copy-write',
                    selectionCollapsed: selectionState.collapsed,
                    selectedHtml: selectionState.html,
                };
            const parts = writes[0][0].parts;
            const htmlBlob = await parts['text/html'];
            const html = await htmlBlob.text();

            // --- 3. Paste that HTML back and check dedup ---
            const pasteEvent = new Event('paste', { bubbles: true, cancelable: true }) as any;
            pasteEvent.clipboardData = {
                items: [{ kind: 'string', type: 'text/html', getAsFile: () => null }],
                types: ['text/html'],
                files: [],
                getData: (t: string) => (t === 'text/html' ? html : ''),
            };
            // The paste just needs somewhere to insert: TinyMCE falls back to
            // the editor body when no selection exists. We don't move the
            // caret on purpose — setting a selection via the iframe API is
            // flaky under Playwright Firefox, and the position doesn't matter
            // for the dedup assertion below.
            editor.fire('paste', pasteEvent);

            const t2 = Date.now();
            while (Date.now() - t2 < 3000) {
                const all = editor.getBody()?.querySelectorAll('img[data-asset-id]');
                if (all && all.length >= 2) {
                    return {
                        ok: true,
                        clipboardHtml: html.slice(0, 200),
                        firstAssetId,
                        secondAssetId: (all[1] as HTMLElement).getAttribute('data-asset-id'),
                    };
                }
                await new Promise(r => setTimeout(r, 50));
            }
            return { ok: false, reason: 'paste-timeout', clipboardHtml: html.slice(0, 200) };
        });

        expect(result.ok, `round-trip failed: ${JSON.stringify(result)}`).toBe(true);
        // Clipboard must hold self-contained data: (not asset://) for portability.
        expect(result.clipboardHtml).toMatch(/data:image\//);
        expect(result.clipboardHtml).not.toMatch(/asset:\/\//);
        // Same bytes → SHA-256 dedup → both <img>s point at the same UUID.
        expect(result.secondAssetId).toBe(result.firstAssetId);
    });
});
