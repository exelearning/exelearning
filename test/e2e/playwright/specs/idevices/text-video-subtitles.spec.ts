import { test, expect } from '../../fixtures/auth.fixture';
import type { Download, Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { unzipSync } from '../../../../../src/shared/export';
import {
    waitForAppReady,
    gotoWorkarea,
    addTextIdevice,
    waitForPreviewContent,
    getPreviewFrame,
} from '../../helpers/workarea-helpers';

/**
 * E2E tests for GitHub issue #2034: "Video subtitles (.srt) can't be added
 * and never show in the Text iDevice".
 *
 * Covers, using real UI interaction only (no direct Yjs/API shortcuts):
 *  1. The upload chooser must allow selecting .srt/.vtt files (the reported
 *     "can't be added" symptom).
 *  2. A subtitle attached to a video inside a Text iDevice must actually
 *     produce cues in the Preview panel (native <video><track>).
 *  3. Web Site and SCORM exports must ship the equivalent, working subtitle
 *     track.
 */

const VIDEO_FIXTURE = path.resolve(__dirname, '../../../../fixtures/sample-video-480-900kb.webm');
const SRT_FIXTURE = path.resolve(__dirname, '../../../../fixtures/subtitles/test-subtitle.srt');

// Cue window from test/fixtures/subtitles/test-subtitle.srt: "00:00:02,360 --> 00:00:05,760"
const CUE_START_SECONDS = 2.36;
const CUE_END_SECONDS = 5.76;
const EXPECTED_CUE_TEXT = 'Este es un vídeo de prueba para';

/**
 * Open the Text iDevice's "Insert/Edit Media" (exemedia) dialog, insert the
 * local video fixture as the media source, then browse+select the local SRT
 * fixture in the "Subtitles" tab, and save the media dialog + the iDevice.
 *
 * Also asserts directly on the File Manager upload input's `accept`
 * attribute -- this is the regression check for symptom #1 ("upload chooser
 * doesn't allow selecting .srt/.vtt"). Playwright's setInputFiles() bypasses
 * the native OS picker's accept-attribute filtering, so the
 * upload-and-select flow below would "pass" even with a broken accept
 * attribute; the explicit attribute assertion is what actually catches that
 * bug.
 */
async function insertVideoWithSrtSubtitle(page: Page): Promise<void> {
    await addTextIdevice(page);

    const block = page.locator('#node-content article .idevice_node.text').last();
    await block.waitFor({ timeout: 10000 });

    // addTextIdevice() leaves the iDevice already in edition mode (no "Edit
    // iDevice" button present yet), but guard defensively in case that ever
    // changes: only click it when it actually exists.
    const editBtn = block.locator('.btn-edit-idevice');
    if ((await editBtn.count()) > 0 && (await editBtn.isVisible().catch(() => false))) {
        await editBtn.click();
    }
    await page.waitForSelector('.tox-menubar', { timeout: 15000 });

    // Open the "Insert/Edit Media" (exemedia) dialog.
    const multimediaBtn = page
        .locator('.tox-tbtn[aria-label*="media" i], .tox-tbtn[aria-label*="multimedia" i], .tox-tbtn[title*="media" i]')
        .first();
    await expect(multimediaBtn).toBeVisible({ timeout: 10000 });
    await multimediaBtn.click();
    await page.waitForSelector('.tox-dialog', { timeout: 10000 });

    // --- General tab: browse and select the local video fixture ---
    const sourceBrowseBtn = page.locator('.tox-dialog .tox-browse-url').first();
    await expect(sourceBrowseBtn).toBeVisible({ timeout: 5000 });
    await sourceBrowseBtn.click();

    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });

    const videoUploadInput = page.locator('#modalFileManager .media-library-upload-input');
    await videoUploadInput.setInputFiles(VIDEO_FIXTURE);

    const videoMediaItem = page.locator('#modalFileManager .media-library-item').first();
    await expect(videoMediaItem).toBeVisible({ timeout: 15000 });
    await videoMediaItem.click();

    const videoInsertBtn = page.locator('#modalFileManager .media-library-insert-btn');
    await expect(videoInsertBtn).toBeEnabled({ timeout: 5000 });
    await videoInsertBtn.click();
    await page
        .locator('#modalFileManager[data-open="true"], #modalFileManager.show')
        .waitFor({ state: 'hidden', timeout: 10000 });

    // The "Source" urlinput field should now hold an asset:// URL. TinyMCE's
    // urlinput renders as a combobox and sets the value as a live DOM
    // property (not the `value=` HTML attribute), so assert via
    // inputValue() rather than an attribute-based CSS selector.
    const sourceInput = page.getByRole('combobox', { name: 'Source' }).first();
    await expect(sourceInput).toBeVisible({ timeout: 10000 });
    await expect(async () => {
        expect(await sourceInput.inputValue()).toMatch(/^asset:\/\//);
    }).toPass({ timeout: 10000 });

    // --- Switch to the "Subtitles" tab ---
    const subtitlesTab = page.locator('.tox-dialog__body-nav-item', { hasText: /Subtitles|Subt[ií]tulos/i }).first();
    await expect(subtitlesTab).toBeVisible({ timeout: 5000 });
    await subtitlesTab.click();

    // Browse for the subtitle file (only the active tab's browse button is visible).
    const subtitleBrowseBtn = page.locator('.tox-dialog .tox-browse-url:visible').first();
    await expect(subtitleBrowseBtn).toBeVisible({ timeout: 5000 });
    await subtitleBrowseBtn.click();

    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 10000 });

    // --- Regression check for symptom #1: the accept attribute itself ---
    const subtitleUploadInput = page.locator('#modalFileManager .media-library-upload-input');
    const acceptAttr = (await subtitleUploadInput.getAttribute('accept')) || '';
    const acceptedExtensions = acceptAttr.split(',').map(s => s.trim());
    expect(acceptedExtensions, `upload input accept="${acceptAttr}" must allow .srt and .vtt`).toContain('.srt');
    expect(acceptedExtensions, `upload input accept="${acceptAttr}" must allow .srt and .vtt`).toContain('.vtt');

    await subtitleUploadInput.setInputFiles(SRT_FIXTURE);

    const srtMediaItem = page.locator('#modalFileManager .media-library-item[data-filename="test-subtitle.srt"]');
    await expect(srtMediaItem).toBeVisible({ timeout: 15000 });
    await srtMediaItem.click();

    const srtInsertBtn = page.locator('#modalFileManager .media-library-insert-btn');
    await expect(srtInsertBtn).toBeEnabled({ timeout: 5000 });
    await srtInsertBtn.click();
    await page
        .locator('#modalFileManager[data-open="true"], #modalFileManager.show')
        .waitFor({ state: 'hidden', timeout: 10000 });

    // --- Save the media dialog (inserts the <video>/<track> into the editor) ---
    const saveMediaBtn = page.locator('.tox-dialog .tox-button:has-text("Save")');
    if ((await saveMediaBtn.count()) > 0) {
        await saveMediaBtn.click();
    }
    await page.locator('.tox-dialog').waitFor({ state: 'hidden', timeout: 10000 });

    // --- Save the iDevice (the dropdown-based helper needs the block already
    // out of edition mode, which isn't true yet -- save directly instead,
    // mirroring the working pattern used elsewhere for this same dialog). ---
    const saveIdeviceBtn = block.locator('.btn-save-idevice');
    await saveIdeviceBtn.waitFor({ state: 'visible', timeout: 10000 });
    await saveIdeviceBtn.click();

    // The iDevice must leave edition mode with a <video> element saved. The
    // workarea's inline "view mode" rendering (ideviceNode.js exportHtmlView():
    // addMediaTypes -> simplifyMediaElements -> resolveAssetUrls) is a separate
    // code path from the Preview panel / export pipeline, but it too must carry
    // a working subtitle track now: simplifyMediaElements preserves the <track>
    // and AssetManager serves the .srt display blob as WebVTT (issue #2034).
    // The dedicated edition-view test below asserts that; the Preview panel and
    // export ZIPs are covered by the other tests.
    await page.waitForFunction(
        () => {
            const idevice = document.querySelector('#node-content article .idevice_node.text');
            if (!idevice) return false;
            const stillEditing = idevice.getAttribute('mode') === 'edition' || !!idevice.querySelector('.tox-tinymce');
            return !stillEditing && !!idevice.querySelector('video');
        },
        undefined,
        { timeout: 15000 },
    );
}

/**
 * Trigger a Web Site (HTML5) export and return the Playwright download.
 */
async function exportWebsite(page: Page): Promise<Download> {
    await page.locator('#dropdownFile').click();
    const exportSubmenuToggle = page.locator('#dropdownExportAs:visible, #dropdownExportAsOffline:visible').first();
    if ((await exportSubmenuToggle.count()) > 0) {
        await exportSubmenuToggle.click();
    }
    const exportOption = page
        .locator('#navbar-button-export-html5:visible, #navbar-button-exportas-html5:visible')
        .first();
    await exportOption.waitFor({ state: 'visible', timeout: 10000 });
    const downloadPromise = page.waitForEvent('download', { timeout: 90000 });
    await exportOption.click();
    return downloadPromise;
}

/**
 * Trigger a SCORM 1.2 export and return the Playwright download.
 */
async function exportScorm(page: Page): Promise<Download> {
    await page.locator('#dropdownFile').click();
    const exportSubmenuToggle = page.locator('#dropdownExportAs:visible, #dropdownExportAsOffline:visible').first();
    if ((await exportSubmenuToggle.count()) > 0) {
        await exportSubmenuToggle.click();
    }
    const exportOption = page
        .locator('#navbar-button-export-scorm12:visible, #navbar-button-exportas-scorm12:visible')
        .first();
    await exportOption.waitFor({ state: 'visible', timeout: 10000 });
    const downloadPromise = page.waitForEvent('download', { timeout: 90000 });
    await exportOption.click();
    return downloadPromise;
}

/** Find the single subtitle .vtt entry in an unzipped export map, if any. */
function findVttEntry(zip: Record<string, Uint8Array>): string | undefined {
    return Object.keys(zip).find(k => k.startsWith('content/resources/') && k.endsWith('.vtt'));
}

test.describe('Text iDevice video subtitles (issue #2034)', () => {
    test('allows attaching a local .srt subtitle to a video and renders cues in the Preview panel', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'Text Video Subtitles Preview Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await insertVideoWithSrtSubtitle(page);

        // --- Preview panel (served over the app's HTTP server, never file://) ---
        const previewLoaded = await waitForPreviewContent(page, 30000);
        expect(previewLoaded, 'Preview panel must render article content').toBe(true);
        const previewFrame = getPreviewFrame(page);

        const video = previewFrame.locator('video').first();
        await expect(video).toBeVisible({ timeout: 15000 });

        const track = previewFrame.locator('video track').first();
        await expect(track).toBeAttached({ timeout: 10000 });

        // The exported/previewed track must be WebVTT, not the raw .srt asset
        // (native <video><track> never understood .srt -- this is the primary
        // reason subtitles "never showed").
        const trackSrc = await track.getAttribute('src');
        expect(trackSrc, `track src "${trackSrc}" must resolve to a .vtt resource, not .srt`).toMatch(/\.vtt(\?|$)/);
        expect(trackSrc).not.toMatch(/\.srt(\?|$)/);

        // The referenced resource must actually be fetchable, valid WebVTT.
        // Fetched from *inside* the preview iframe (not Playwright's separate
        // page.request API) because the Preview panel serves its files from an
        // in-memory Service Worker (see doc/development real-time/embedding
        // notes on the SW-based preview) that only intercepts fetches
        // originating from the page itself -- page.request bypasses it
        // entirely and would 404 against the real server, which has no
        // /viewer/* route by design.
        const vttResult = await track.evaluate(async (el: HTMLTrackElement) => {
            const response = await fetch(el.src);
            return { ok: response.ok, text: await response.text() };
        });
        expect(vttResult.ok).toBe(true);
        expect(vttResult.text.trim().startsWith('WEBVTT')).toBe(true);
        expect(vttResult.text).toContain(EXPECTED_CUE_TEXT);

        // Enable the track and read the parsed cue straight from the browser's
        // native track engine (TextTrack.cues), rather than actually seeking
        // the <video> and reading activeCues: the Preview panel's Service
        // Worker (public/preview-sw.js) serves media without HTTP Range/206
        // support, which makes Chromium treat the resource as unseekable --
        // an orthogonal, pre-existing limitation of the SW-based preview
        // transport, unrelated to subtitle parsing. Reading the cue directly
        // still fully proves the point that matters for issue #2034: a raw
        // .srt reference produces zero native cues, while our converted
        // WebVTT resource is parsed into a correct, well-timed cue.
        const cue = await video.evaluate(async (el: HTMLVideoElement) => {
            const tt = el.textTracks[0];
            if (!tt) return null;
            tt.mode = 'showing';

            const deadline = Date.now() + 10000;
            while ((!tt.cues || tt.cues.length === 0) && Date.now() < deadline) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            if (!tt.cues || tt.cues.length === 0) return null;
            const first = tt.cues[0] as VTTCue;
            return { text: first.text, startTime: first.startTime, endTime: first.endTime };
        });

        expect(cue).toBeTruthy();
        expect(cue?.text).toContain(EXPECTED_CUE_TEXT);
        expect(cue?.startTime).toBeCloseTo(CUE_START_SECONDS, 1);
        expect(cue?.endTime).toBeCloseTo(CUE_END_SECONDS, 1);
    });

    test('renders subtitle cues in the workarea edition view (native <track>, issue #2034)', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'Text Video Subtitles Edition Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await insertVideoWithSrtSubtitle(page);

        // The workarea inline view renders the iDevice via ideviceNode.exportHtmlView()
        // (addMediaTypes -> simplifyMediaElements -> resolveAssetUrls). The <track>
        // must survive simplification AND resolve to a WebVTT blob: URL -- AssetManager
        // converts the raw .srt display blob to WebVTT on the fly (issue #2034) -- so
        // the browser's native track engine produces cues in edition mode, not only in
        // Preview/exports.
        const video = page.locator('#node-content article .idevice_node.text video').first();
        await expect(video).toBeVisible({ timeout: 15000 });

        const track = page.locator('#node-content article .idevice_node.text video track').first();
        await expect(track).toBeAttached({ timeout: 10000 });

        const trackSrc = await track.getAttribute('src');
        expect(trackSrc, `edition-mode <track src> "${trackSrc}" must be a blob: URL`).toMatch(/^blob:/);

        const cue = await video.evaluate(async (el: HTMLVideoElement) => {
            const tt = el.textTracks[0];
            if (!tt) return null;
            tt.mode = 'showing';

            const deadline = Date.now() + 10000;
            while ((!tt.cues || tt.cues.length === 0) && Date.now() < deadline) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            if (!tt.cues || tt.cues.length === 0) return null;
            const first = tt.cues[0] as VTTCue;
            return { text: first.text, startTime: first.startTime, endTime: first.endTime };
        });

        expect(cue, 'native <track> must parse the converted WebVTT into cues in edition mode').toBeTruthy();
        expect(cue?.text).toContain(EXPECTED_CUE_TEXT);
        expect(cue?.startTime).toBeCloseTo(CUE_START_SECONDS, 1);
        expect(cue?.endTime).toBeCloseTo(CUE_END_SECONDS, 1);
    });

    test('ships a valid .vtt subtitle track in the Web Site export', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'Text Video Subtitles Website Export Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await insertVideoWithSrtSubtitle(page);

        const download = await exportWebsite(page);
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'text-video-subtitles-html5-'));
        const zipPath = path.join(tmpDir, download.suggestedFilename());
        await download.saveAs(zipPath);
        const zip = unzipSync(fs.readFileSync(zipPath));

        // Find the exported page HTML that contains the video.
        // Exclude per-iDevice runtime templates (e.g. "idevices/text/text.html",
        // a static `{content}` placeholder filled in client-side at runtime,
        // not a real rendered page) so this always resolves to an actual
        // exported page such as "index.html".
        const htmlKey = Object.keys(zip).find(
            k => k.endsWith('.html') && !k.includes('_export') && !k.includes('idevices/'),
        );
        expect(htmlKey, 'exported website must contain at least one page HTML file').toBeTruthy();

        const decoder = new TextDecoder('utf-8');
        const html = decoder.decode(zip[htmlKey as string]);

        expect(html).toMatch(/<track[^>]*kind="subtitles"/);
        expect(html).not.toMatch(/<track[^>]*src="[^"]*\.srt"/);

        const vttKey = findVttEntry(zip);
        expect(
            vttKey,
            'exported ZIP must contain a converted .vtt subtitle resource in content/resources/',
        ).toBeTruthy();

        const vttContent = decoder.decode(zip[vttKey as string]);
        expect(vttContent.trim().startsWith('WEBVTT')).toBe(true);
        expect(vttContent).toContain(EXPECTED_CUE_TEXT);
        // No raw comma-decimal SRT timestamps should survive the conversion.
        expect(vttContent).not.toMatch(/\d{2}:\d{2}:\d{2},\d{3}/);
    });

    test('ships a valid .vtt subtitle track in the SCORM export', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'Text Video Subtitles SCORM Export Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await insertVideoWithSrtSubtitle(page);

        const download = await exportScorm(page);
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'text-video-subtitles-scorm-'));
        const zipPath = path.join(tmpDir, download.suggestedFilename());
        await download.saveAs(zipPath);
        const zip = unzipSync(fs.readFileSync(zipPath));

        // Exclude per-iDevice runtime templates (e.g. "idevices/text/text.html",
        // a static `{content}` placeholder filled in client-side at runtime,
        // not a real rendered page) so this always resolves to an actual
        // exported page such as "index.html".
        const htmlKey = Object.keys(zip).find(
            k => k.endsWith('.html') && !k.includes('_export') && !k.includes('idevices/'),
        );
        expect(htmlKey, 'SCORM export must contain at least one page HTML file').toBeTruthy();

        const decoder = new TextDecoder('utf-8');
        const html = decoder.decode(zip[htmlKey as string]);

        expect(html).toMatch(/<track[^>]*kind="subtitles"/);
        expect(html).not.toMatch(/<track[^>]*src="[^"]*\.srt"/);

        const vttKey = findVttEntry(zip);
        expect(vttKey, 'SCORM ZIP must contain a converted .vtt subtitle resource in content/resources/').toBeTruthy();

        const vttContent = decoder.decode(zip[vttKey as string]);
        expect(vttContent.trim().startsWith('WEBVTT')).toBe(true);
        expect(vttContent).toContain(EXPECTED_CUE_TEXT);
    });
});
