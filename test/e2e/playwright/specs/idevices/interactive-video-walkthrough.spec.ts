import { test, expect } from '../../fixtures/auth.fixture';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { gotoWorkarea, saveIdevice, saveProject, waitForAppReady } from '../../helpers/workarea-helpers';
import {
    IV_IDEVICE,
    IV_LOCAL_VIDEO_FIXTURE,
    IV_VIMEO_URL,
    IV_YOUTUBE_URL,
    addInteraction,
    addInteractiveVideo,
    allResults,
    answerQuestion,
    authorQuestion,
    checkAnswer,
    closePreview,
    continueOverlay,
    exportHtml5,
    emitProviderTime,
    getIdeviceId,
    insertImageIntoBody,
    installFakeProviders,
    isVideoPaused,
    openPreviewWithRuntime,
    overlayOf,
    playFast,
    providerCalls,
    readPersistedDoc,
    setBodyHtml,
    uploadLocalVideo,
    waitForEditorPlayer,
    waitForOverlay,
    waitForPlayableVideo,
    waitForRuntimeReady,
    type IvQuestionSpec,
    type IvSurface,
} from '../../helpers/interactive-video-helpers';

/**
 * End-to-end walkthrough of the Interactive Video iDevice across its FOUR
 * surfaces — the inline editor, the saved workarea view, the workarea Preview
 * and the exported HTML5 site — for the three video providers that ship today
 * (a local file, YouTube and Vimeo).
 *
 * The local-file test is the full cycle: a cover, all seven question kinds, a
 * note, a pause and a jump are authored through the editor UI, then played
 * through as a learner twice — once in Preview and once in the real HTML5
 * export — answering every question correctly and asserting the runtime paused,
 * graded and resumed each time.
 *
 * External providers are covered without live third-party network: their embed
 * markup, adapter wiring, cover opener, timeline and results table are asserted
 * from the same runtime, since playback itself belongs to YouTube/Vimeo.
 *
 * Screenshots of every surface are written to
 * `test-results/interactive-video-report/` and attached to the HTML report.
 */

// Playwright wipes `test-results/` at the start of every run, so point
// IV_REPORT_DIR somewhere else when the screenshots must outlive the run.
const REPORT_DIR = process.env.IV_REPORT_DIR
    ? path.resolve(process.env.IV_REPORT_DIR)
    : path.join(process.cwd(), 'test-results', 'interactive-video-report');

/** Save a screenshot of a page or element into the report folder AND the run. */
async function shot(target: Page | Locator, name: string, testInfo: TestInfo): Promise<void> {
    mkdirSync(REPORT_DIR, { recursive: true });
    const file = path.join(REPORT_DIR, `${name}.png`);
    await target.screenshot({ path: file });
    await testInfo.attach(name, { path: file, contentType: 'image/png' });
}

/** Unpack an exported ZIP into a fresh temp dir and return its path. */
function extractZip(zipPath: string): string {
    // fflate is the same unzip the workarea helpers use for downloaded projects.
    const dir = mkdtempSync(path.join(tmpdir(), 'iv-export-'));
    const files = unzipSync(new Uint8Array(readFileSync(zipPath)));
    for (const [name, bytes] of Object.entries(files)) {
        if (name.endsWith('/')) continue;
        const out = path.join(dir, name);
        mkdirSync(path.dirname(out), { recursive: true });
        writeFileSync(out, Buffer.from(bytes));
    }
    return dir;
}

/** Every question kind, authored in timeline order. */
const QUESTIONS: IvQuestionSpec[] = [
    {
        kind: 'singleChoice',
        time: '00:02',
        prompt: 'Single choice: which one is the capital of France?',
        answers: [
            ['Madrid', false],
            ['Paris', true],
            ['Rome', false],
        ],
    },
    {
        kind: 'multipleChoice',
        time: '00:04',
        prompt: 'Multiple choice: pick every even number.',
        answers: [
            ['Two', true],
            ['Three', false],
            ['Four', true],
        ],
    },
    {
        kind: 'trueFalse',
        time: '00:06',
        prompt: 'True or false: a clear sky looks blue.',
        solution: true,
    },
    {
        kind: 'dropdown',
        time: '00:08',
        prompt: 'Dropdown: the white horse of Santiago',
        needle: 'Dropdown: the',
        blanks: ['white'],
        extraWords: ['black', 'green'],
    },
    {
        kind: 'cloze',
        time: '00:10',
        prompt: 'Cloze: the capital of Italy is Rome',
        needle: 'Cloze: the capital of Italy is',
        blanks: ['Rome'],
    },
    {
        kind: 'matchElements',
        time: '00:12',
        prompt: 'Match each country with its capital.',
        pairs: [
            ['France', 'Paris'],
            ['Italy', 'Rome'],
        ],
    },
    {
        kind: 'sortableList',
        time: '00:14',
        prompt: 'Sort the planets from the closest to the Sun.',
        items: ['Mercury', 'Venus', 'Earth'],
    },
];

/**
 * Run the real HTML5 export, unpack it and read its `index.html`. Also asserts
 * the invariants every export must hold: the runtime ships as classic scripts
 * and no provider SDK is ever pulled in (ADR-0003).
 */
async function exportAndRead(page: Page): Promise<{ indexPath: string; indexHtml: string }> {
    await saveProject(page);
    const download = await exportHtml5(page);
    const zipPath = await download.path();
    expect(zipPath).toBeTruthy();
    const indexPath = path.join(extractZip(zipPath as string), 'index.html');
    const indexHtml = readFileSync(indexPath, 'utf8');
    // The runtime ships as ONE self-contained bundle (core + providers compiled in).
    expect(indexHtml).toContain('interactive-video.js');
    expect(indexHtml).not.toContain('interactive-video-core.js');
    expect(indexHtml).not.toContain('youtube.com/iframe_api');
    expect(indexHtml).not.toContain('player.vimeo.com/api/player.js');
    return { indexPath, indexHtml };
}

const COVER_TITLE = 'Welcome aboard';
const IMAGE_FIXTURE = 'test/fixtures/sample-2.jpg';
const IMAGE_ALT = 'Cover picture';
const COVER_TEXT = 'Welcome to the interactive video';
const NOTE_TEXT = 'This is a note shown while the video is paused';
const PAUSE_TEXT = 'Take a break here';

/**
 * Play the whole activity as a learner on one surface (Preview or the exported
 * site): start from the cover, answer every question correctly, read the note
 * and the pause, and assert the runtime paused each time and resumed after.
 */
async function playFullCycle(surface: IvSurface, testInfo: TestInfo, prefix: string): Promise<void> {
    const overlay = overlayOf(surface);

    // 1. The cover is the opener: it is shown before any playback, with Start.
    await waitForOverlay(surface, COVER_TEXT);
    await expect(overlay.locator('.exe-iv-cover-body')).toBeVisible();
    // The cover keeps a title of its own, rendered as a heading above the body.
    await expect(overlay.locator('.exe-iv-cover-title')).toHaveText(COVER_TITLE);
    // …and the opening screen is centred, Start button included.
    expect(await overlay.locator('.exe-iv-cover-body').evaluate(el => getComputedStyle(el).textAlign)).toBe('center');
    await shot(overlay, `${prefix}-01-cover`, testInfo);
    await continueOverlay(surface);

    // 2. Play fast and muted; each interaction pauses the video at its timestamp.
    await playFast(surface);

    for (let i = 0; i < QUESTIONS.length; i++) {
        const spec = QUESTIONS[i];
        await waitForOverlay(surface, spec.needle ?? spec.prompt);
        expect(await isVideoPaused(surface)).toBe(true);
        await shot(overlay, `${prefix}-${String(i + 2).padStart(2, '0')}-${spec.kind}`, testInfo);
        if (i === 0) {
            // The action button is actually styled — a filled, high-contrast
            // button rather than raw browser chrome — on this surface too.
            const checkStyle = await overlay.locator('.exe-iv-check').evaluate(el => {
                const style = getComputedStyle(el);
                return { background: style.backgroundColor, color: style.color };
            });
            expect(checkStyle.background).not.toBe('rgba(0, 0, 0, 0)');
            expect(checkStyle.background).not.toBe('transparent');
            expect(checkStyle.color).toBe('rgb(255, 255, 255)');

            // Checking an untouched question nudges instead of recording a
            // silent 0, and offers no way past it until it is answered.
            await overlay.locator('.exe-iv-check').click();
            await expect(overlay.locator('.exe-iv-feedback')).toContainText('Please finish the activity');
            await expect(overlay.locator('.exe-iv-continue')).toHaveCount(0);
        }
        await answerQuestion(surface, spec);
        await checkAnswer(surface);
        if (i === 0) {
            // The verdict is marked as correct, not just worded that way.
            await expect(overlay.locator('.exe-iv-feedback')).toHaveClass(/is-correct/);
        }
        await continueOverlay(surface);
    }

    // 3. The note and the pause both hold the video until Continue.
    await waitForOverlay(surface, NOTE_TEXT);
    expect(await isVideoPaused(surface)).toBe(true);
    await expect(overlay.locator('.exe-iv-note-body')).toBeVisible();
    await shot(overlay, `${prefix}-09-note`, testInfo);
    await continueOverlay(surface);

    await waitForOverlay(surface, PAUSE_TEXT);
    expect(await isVideoPaused(surface)).toBe(true);
    await expect(overlay.locator('.exe-iv-pause-body')).toBeVisible();
    await shot(overlay, `${prefix}-10-pause`, testInfo);
    await continueOverlay(surface);

    // 4. Every question was graded 1 (fully correct) — seven of them.
    await surface.waitForFunction(
        () => {
            const runtime = (
                window as {
                    $interactivevideo?: { instances?: Record<string, { results?: Record<string, number> }> };
                }
            ).$interactivevideo;
            const instances = runtime?.instances || {};
            const first = Object.keys(instances)[0];
            const results = first ? instances[first].results || {} : {};
            return Object.keys(results).length === 7;
        },
        undefined,
        { timeout: 15000 },
    );
    const results = await allResults(surface);
    expect(Object.keys(results)).toHaveLength(QUESTIONS.length);
    expect(Object.values(results).every(value => value === 1)).toBe(true);

    // 5. The jump interaction seeks the video forward past its own timestamp.
    //    This only works when the media is actually seekable: a surface that
    //    serves the video without byte ranges reports `seekable = [0, 0]`, every
    //    seek clamps to 0 and the activity restarts instead of jumping.
    await surface.waitForFunction(
        () => {
            const v = document.querySelector('video.exe-iv-video') as HTMLVideoElement | null;
            return !!v && v.currentTime >= 24;
        },
        undefined,
        { timeout: 20000 },
    );

    // 6. The layout follows the space the activity HAS, not the window: the
    //    panel sits beside the video only when the container is wide enough.
    //    Preview (a narrow panel) and the export (a full page) therefore land on
    //    different sides of the same rule, and both must obey it.
    const layout = await surface.evaluate(() => {
        const root = document.querySelector('.exe-iv') as HTMLElement;
        const stage = document.querySelector('.exe-iv-stage') as HTMLElement;
        return {
            width: root.getBoundingClientRect().width,
            direction: getComputedStyle(stage).flexDirection,
        };
    });
    expect(layout.direction).toBe(layout.width >= 768 ? 'row' : 'column');

    // 7. The results table lists every interaction and the total.
    const resultsTable = surface.locator('.exe-iv-results');
    await expect(resultsTable).toHaveCount(1);
    await resultsTable.locator('.exe-iv-results-toggle').click();
    await expect(resultsTable.locator('.exe-iv-results-table tbody tr')).toHaveCount(11);
    await shot(resultsTable, `${prefix}-11-results`, testInfo);
}

test.describe('Interactive Video — full walkthrough across editor, workarea, preview and export', () => {
    test('local video: every interaction kind, played end to end in Preview and in the HTML5 export', async ({
        authenticatedPage,
        createProject,
    }, testInfo) => {
        test.setTimeout(600000);
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'IV Walkthrough Local');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // ---------------------------------------------------------- EDITOR
        await addInteractiveVideo(page);
        await uploadLocalVideo(page, IV_LOCAL_VIDEO_FIXTURE);
        await waitForEditorPlayer(page);
        await shot(page.locator('#interactiveVideoIdeviceForm'), 'editor-00-source', testInfo);

        // The cover is pinned to the start of the video and is a singleton.
        await addInteraction(page, 'cover');
        await expect(page.locator('.exe-iv-detail-fixed-time')).toHaveCount(1);
        await page.locator('#ivDetailTitle').fill(COVER_TITLE);
        await setBodyHtml(page, `<p>${COVER_TEXT}</p>`);
        // The body field is eXe's OWN rich-text editor, so it carries the Media
        // Library image button — that is what makes an image in a cover or note
        // possible at all, and what stores it as an asset:// reference.
        const bodyEditorButtons = await page.evaluate(() => {
            const editor = (window as { tinymce?: { get?: (id: string) => unknown } }).tinymce?.get?.('ivDetailBody') as
                | { ui?: { registry?: { getAll?: () => { buttons?: Record<string, unknown> } } } }
                | undefined;
            return Object.keys(editor?.ui?.registry?.getAll?.()?.buttons || {});
        });
        expect(bodyEditorButtons).toContain('exeimage');
        expect(bodyEditorButtons).toContain('exemedia');
        await shot(page.locator('#ivDetailPanel'), 'editor-01-cover', testInfo);

        // All seven question kinds.
        for (const spec of QUESTIONS) {
            await authorQuestion(page, spec);
            await shot(page.locator('#ivDetailPanel'), `editor-02-${spec.kind}`, testInfo);
        }

        // A note, a pause and a jump complete the interaction model.
        await addInteraction(page, 'note', '00:16');
        await setBodyHtml(page, `<p>${NOTE_TEXT}</p>`);
        await expect(page.locator('#ivDetailPause')).toBeChecked();
        await addInteraction(page, 'pause', '00:18');
        await setBodyHtml(page, `<p>${PAUSE_TEXT}</p>`);
        await addInteraction(page, 'jump', '00:20');
        await page.locator('#ivDetailJump').fill('00:25');
        await page.locator('#ivDetailJump').dispatchEvent('change');

        // Eleven rows in the list and eleven markers on the edit timeline.
        await expect(page.locator('#ivInteractionList .exe-iv-edit-select')).toHaveCount(11);
        await expect(page.locator('#ivEditTimeline button[data-iv-id]')).toHaveCount(11);
        await shot(page.locator('#interactiveVideoIdeviceForm'), 'editor-03-interactions', testInfo);

        // --------------------------------------------------------- WORKAREA
        const ideviceId = await getIdeviceId(page);
        await saveIdevice(page, ideviceId);
        await expect(page.locator(`.idevice_node[id="${ideviceId}"]`)).not.toHaveAttribute('mode', 'edition');

        // The saved iDevice renders the runtime in the workarea itself: the
        // player, the always-visible panel and the results table.
        const savedNode = page.locator(`${IV_IDEVICE}[id="${ideviceId}"]`);
        await expect(savedNode.locator('video.exe-iv-video')).toHaveCount(1);
        await expect(savedNode.locator('.exe-iv-overlay')).toHaveCount(1);
        await expect(savedNode.locator('.exe-iv-results')).toHaveCount(1);
        await shot(savedNode, 'workarea-01-saved', testInfo);

        // The persisted Yjs document is the versioned JSON, with all 11 interactions
        // and the local asset reference for the video.
        const doc = (await readPersistedDoc(page)) as {
            schemaVersion: number;
            video: { provider: string; url: string };
            interactions: { type: string; title?: string; question?: { kind: string } }[];
        } | null;
        expect(doc).not.toBeNull();
        // Schema v2 is the only published versioned schema (the intermediate
        // v3 was consolidated back into v2 by the TypeScript refactor).
        expect(doc?.schemaVersion).toBe(2);
        expect(doc?.video.provider).toBe('local');
        expect(doc?.video.url).toContain('asset://');
        expect(doc?.interactions).toHaveLength(11);
        const questionKinds = (doc?.interactions || [])
            .filter(it => it.type === 'question')
            .map(it => it.question?.kind);
        expect(questionKinds).toEqual(QUESTIONS.map(spec => spec.kind));
        const persistedCover = (doc?.interactions || []).find(it => it.type === 'cover');
        expect(persistedCover).toBeDefined();
        expect((persistedCover as { title?: string })?.title).toBe(COVER_TITLE);

        // ---------------------------------------------------------- PREVIEW
        const { frame } = await openPreviewWithRuntime(page);
        await waitForPlayableVideo(frame);
        await shot(page.locator('#preview-iframe'), 'preview-00-panel', testInfo);
        await playFullCycle(frame, testInfo, 'preview');

        // Close the preview so the export menu is reachable.
        await closePreview(page);

        // ----------------------------------------------------- HTML5 EXPORT
        const { indexPath, indexHtml } = await exportAndRead(page);

        const exported = await page.context().newPage();
        await exported.goto(`file://${indexPath}`);
        await waitForRuntimeReady(exported);
        await waitForPlayableVideo(exported);
        await shot(exported, 'export-00-page', testInfo);
        await playFullCycle(exported, testInfo, 'export');
        await exported.close();
    });

    // Timed interactions on an external provider, without third-party network.
    // The embed markup and the real adapter are asserted by the two tests above;
    // this drives the SCHEDULER, which is the half that is ours to get right.
    for (const [label, url, spec] of [
        ['youtube', IV_YOUTUBE_URL, QUESTIONS[0]],
        ['vimeo', IV_VIMEO_URL, QUESTIONS[2]],
    ] as const) {
        test(`${label}: a timed question fires, grades and resumes on provider time events`, async ({
            authenticatedPage,
            createProject,
        }) => {
            test.setTimeout(180000);
            const page = authenticatedPage;
            await installFakeProviders(page);

            const projectUuid = await createProject(page, `IV Scheduler ${label}`);
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);

            await addInteractiveVideo(page);
            await page.locator('#ivVideoFile').fill(url);
            await authorQuestion(page, spec);
            const ideviceId = await getIdeviceId(page);
            await saveIdevice(page, ideviceId);

            const { frame } = await openPreviewWithRuntime(page);

            // Nothing is due before its timestamp…
            await emitProviderTime(frame, 1);
            await expect(frame.locator('.exe-iv-overlay .exe-iv-question')).toHaveCount(0);

            // …and at it the runtime pauses the player and shows the question.
            await emitProviderTime(frame, 7);
            await waitForOverlay(frame, spec.needle ?? spec.prompt);
            expect((await providerCalls(frame))?.pause).toBeGreaterThan(0);

            await answerQuestion(frame, spec);
            await checkAnswer(frame);
            await expect(frame.locator('.exe-iv-feedback')).toHaveClass(/is-correct/);
            await continueOverlay(frame);

            // Continue hands control back to the provider.
            await expect.poll(async () => (await providerCalls(frame))?.play ?? 0).toBeGreaterThan(0);
        });
    }

    test('an image inserted in the cover survives save, preview and the HTML5 export', async ({
        authenticatedPage,
        createProject,
    }, testInfo) => {
        test.setTimeout(300000);
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'IV Cover Image');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await addInteractiveVideo(page);
        await page.locator('#ivVideoFile').fill(IV_YOUTUBE_URL);

        // The cover is the one interaction shown without playing anything, so it
        // is where an image can be asserted on every surface.
        await addInteraction(page, 'cover');
        await page.locator('#ivDetailTitle').fill(COVER_TITLE);
        await insertImageIntoBody(page, IMAGE_FIXTURE, IMAGE_ALT);
        await shot(page.locator('#ivDetailPanel'), 'image-00-editor', testInfo);

        const ideviceId = await getIdeviceId(page);
        await saveIdevice(page, ideviceId);

        // Persisted as an asset reference, not a blob: URL that dies with the tab.
        const doc = (await readPersistedDoc(page)) as {
            interactions: { type: string; body?: string }[];
        } | null;
        const cover = (doc?.interactions || []).find(it => it.type === 'cover');
        expect(cover?.body).toMatch(/<img[^>]+src="asset:\/\//);
        expect(cover?.body).toContain(IMAGE_ALT);

        // Workarea: the saved iDevice resolves it to something the browser can draw.
        const savedImage = page.locator(`${IV_IDEVICE}[id="${ideviceId}"] .exe-iv-cover-body img`);
        await expect(savedImage).toHaveCount(1);
        await expect(savedImage).toHaveAttribute('alt', IMAGE_ALT);
        await shot(page.locator(`${IV_IDEVICE}[id="${ideviceId}"]`), 'image-01-workarea', testInfo);

        // Preview: same image, resolved and actually decoded by the browser.
        const { frame } = await openPreviewWithRuntime(page);
        await waitForOverlay(frame, COVER_TITLE);
        const previewImage = frame.locator('.exe-iv-cover-body img');
        await expect(previewImage).toHaveCount(1);
        await frame.waitForFunction(
            () => {
                const img = document.querySelector('.exe-iv-cover-body img') as HTMLImageElement | null;
                return !!img && !img.src.startsWith('asset:') && img.complete && img.naturalWidth > 0;
            },
            undefined,
            { timeout: 20000 },
        );
        await shot(page.locator('#preview-iframe'), 'image-02-preview', testInfo);

        // Export: the image ships as a file and the cover points at it.
        await closePreview(page);
        const { indexPath, indexHtml } = await exportAndRead(page);
        // The runtime renders from JSON, so in the exported page the cover body
        // lives in the (escaped) document payload rather than as literal markup.
        expect(indexHtml).toContain(IMAGE_ALT);
        const exportedSrc = (indexHtml.match(/([\w./-]*resources\/sample-2[^"&\\]*\.jpg)/) || [])[1];
        expect(exportedSrc, 'the exported cover points at a packaged file').toBeTruthy();
        expect(exportedSrc).not.toMatch(/^(asset:|blob:)/);
        expect(existsSync(path.join(path.dirname(indexPath), exportedSrc))).toBe(true);

        // …and it renders in the exported page opened straight from disk.
        const exported = await page.context().newPage();
        await exported.goto(`file://${indexPath}`);
        await waitForRuntimeReady(exported);
        await exported.waitForFunction(
            () => {
                const img = document.querySelector('.exe-iv-cover-body img') as HTMLImageElement | null;
                return !!img && img.complete && img.naturalWidth > 0;
            },
            undefined,
            { timeout: 20000 },
        );
        await shot(exported, 'image-03-export', testInfo);
        await exported.close();
    });

    test('youtube: embeds inline, wires the adapter and opens on the cover', async ({
        authenticatedPage,
        createProject,
    }, testInfo) => {
        test.setTimeout(180000);
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'IV Walkthrough YouTube');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await addInteractiveVideo(page);
        await page.locator('#ivVideoFile').fill(IV_YOUTUBE_URL);
        await addInteraction(page, 'cover');
        await setBodyHtml(page, `<p>${COVER_TEXT}</p>`);
        await authorQuestion(page, QUESTIONS[0]);
        await shot(page.locator('#interactiveVideoIdeviceForm'), 'youtube-00-editor', testInfo);

        const ideviceId = await getIdeviceId(page);
        await saveIdevice(page, ideviceId);

        // Workarea: a privacy-enhanced, controllable embed — never a facade link.
        const savedNode = page.locator(`${IV_IDEVICE}[id="${ideviceId}"]`);
        const embed = savedNode.locator('iframe.exe-iv-embed-frame');
        await expect(embed).toHaveCount(1);
        const src = (await embed.getAttribute('src')) || '';
        expect(src).toContain('youtube-nocookie.com/embed/');
        expect(src).toContain('enablejsapi=1');
        // Autoplay must be delegated to the cross-origin player, or the browser
        // refuses the adapter's play command and no interaction can ever fire.
        expect(await embed.getAttribute('allow')).toContain('autoplay');
        await expect(savedNode.locator('a.exe-iv-embed-facade')).toHaveCount(0);
        await shot(savedNode, 'youtube-01-workarea', testInfo);

        // Preview: the cover opens the activity and the YouTube adapter is bound.
        const { frame } = await openPreviewWithRuntime(page);
        await waitForOverlay(frame, COVER_TEXT);
        const provider = await frame.evaluate(() => {
            const runtime = (
                window as {
                    $interactivevideo?: {
                        instances?: Record<string, { provider?: string; adapter?: unknown }>;
                    };
                }
            ).$interactivevideo;
            const instances = runtime?.instances || {};
            const first = Object.keys(instances)[0];
            return first ? { provider: instances[first].provider, hasAdapter: !!instances[first].adapter } : null;
        });
        expect(provider).toEqual({ provider: 'youtube', hasAdapter: true });
        await expect(frame.locator('iframe.exe-iv-embed-frame')).toHaveCount(1);
        await shot(page.locator('#preview-iframe'), 'youtube-02-preview', testInfo);

        // Export: the same controllable embed, still without a provider SDK.
        await closePreview(page);
        const { indexHtml } = await exportAndRead(page);
        expect(indexHtml).toContain('youtube-nocookie.com/embed/');
        expect(indexHtml).toContain('enablejsapi=1');
        expect(indexHtml).toContain('allow="autoplay; fullscreen; picture-in-picture"');
    });

    test('vimeo: embeds inline with the do-not-track player and wires the adapter', async ({
        authenticatedPage,
        createProject,
    }, testInfo) => {
        test.setTimeout(180000);
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'IV Walkthrough Vimeo');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await addInteractiveVideo(page);
        await page.locator('#ivVideoFile').fill(IV_VIMEO_URL);
        await addInteraction(page, 'cover');
        await setBodyHtml(page, `<p>${COVER_TEXT}</p>`);
        await authorQuestion(page, QUESTIONS[2]);
        await shot(page.locator('#interactiveVideoIdeviceForm'), 'vimeo-00-editor', testInfo);

        const ideviceId = await getIdeviceId(page);
        await saveIdevice(page, ideviceId);

        const savedNode = page.locator(`${IV_IDEVICE}[id="${ideviceId}"]`);
        const embed = savedNode.locator('iframe.exe-iv-embed-frame');
        await expect(embed).toHaveCount(1);
        const src = (await embed.getAttribute('src')) || '';
        expect(src).toContain('player.vimeo.com/video/');
        expect(src).toContain('dnt=1');
        expect(await embed.getAttribute('allow')).toContain('autoplay');
        await expect(savedNode.locator('a.exe-iv-embed-facade')).toHaveCount(0);
        await shot(savedNode, 'vimeo-01-workarea', testInfo);

        const { frame } = await openPreviewWithRuntime(page);
        await waitForOverlay(frame, COVER_TEXT);
        const provider = await frame.evaluate(() => {
            const runtime = (
                window as {
                    $interactivevideo?: {
                        instances?: Record<string, { provider?: string; adapter?: unknown }>;
                    };
                }
            ).$interactivevideo;
            const instances = runtime?.instances || {};
            const first = Object.keys(instances)[0];
            return first ? { provider: instances[first].provider, hasAdapter: !!instances[first].adapter } : null;
        });
        expect(provider).toEqual({ provider: 'vimeo', hasAdapter: true });
        await shot(page.locator('#preview-iframe'), 'vimeo-02-preview', testInfo);

        // Export: the same do-not-track embed, still without a provider SDK.
        await closePreview(page);
        const { indexHtml } = await exportAndRead(page);
        expect(indexHtml).toContain('player.vimeo.com/video/');
        expect(indexHtml).toContain('dnt=1');
        expect(indexHtml).toContain('allow="autoplay; fullscreen; picture-in-picture"');
    });
});
