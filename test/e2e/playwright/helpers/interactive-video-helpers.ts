import type { Download, Frame, FrameLocator, Locator, Page } from '@playwright/test';
import {
    addIdevice,
    dismissBlockingAlertModal,
    downloadViaFileMenu,
    getPreviewFrame,
    selectFirstPage,
} from './workarea-helpers';

/**
 * Shared helpers for the Interactive Video iDevice E2E specs.
 *
 * Two surfaces run the SAME declarative runtime — the workarea/preview document
 * and the exported HTML5 site — so every learner-side helper takes an `IvSurface`
 * (a Page or a Frame) and works unchanged on both.
 */

/** A document running the interactive-video runtime: a page or an iframe. */
export type IvSurface = Page | Frame;

export const IV_IDEVICE = '#node-content article .idevice_node.interactive-video';
export const IV_YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
/** A long-standing public Vimeo video (Vimeo's own "The New Vimeo Player"). */
export const IV_VIMEO_URL = 'https://vimeo.com/76979871';
export const IV_LOCAL_VIDEO_FIXTURE = 'test/fixtures/sample-video-480-900kb.webm';

export type IvQuestionKind =
    | 'singleChoice'
    | 'multipleChoice'
    | 'trueFalse'
    | 'dropdown'
    | 'cloze'
    | 'matchElements'
    | 'sortableList';

/** One authored question: everything the editor needs and the learner must answer. */
export interface IvQuestionSpec {
    kind: IvQuestionKind;
    /** mm:ss timestamp for the add bar. */
    time: string;
    prompt: string;
    /**
     * Substring to wait for in the rendered panel. cloze/dropdown replace their
     * blanks with form controls, so their full prompt never appears verbatim —
     * those specs pass the leading, blank-free part of the sentence instead.
     */
    needle?: string;
    /** Choice kinds: `[label, isCorrect]` rows, in authoring order. */
    answers?: [string, boolean][];
    /** trueFalse: the correct statement value. */
    solution?: boolean;
    /** cloze/dropdown: words of `prompt` to turn into blanks (left to right). */
    blanks?: string[];
    /** dropdown: extra distractor words. */
    extraWords?: string[];
    /** matchElements: `[left, right]` pairs. */
    pairs?: [string, string][];
    /** sortableList: items in their CORRECT order. */
    items?: string[];
}

// --------------------------------------------------------------- workarea

/** Dismiss the "development version" beta banner that overlays the top toolbar. */
export async function dismissBetaWarning(page: Page): Promise<void> {
    const close = page.locator('#eXeBetaWarning .btn-close, #eXeBetaWarning [data-bs-dismiss="alert"]').first();
    if ((await close.count()) > 0) {
        await close.click({ force: true }).catch(() => {});
    }
}

/**
 * Add the interactive-video iDevice and wait for its inline editor. Everything
 * essential is on the default-active first tab, so we only wait for the add-bar
 * time input to be visible — no tab switching is required.
 */
export async function addInteractiveVideo(page: Page): Promise<void> {
    await dismissBetaWarning(page);
    await selectFirstPage(page);
    await addIdevice(page, 'interactive-video');
    await page.locator('#interactiveVideoIdeviceForm').first().waitFor({ timeout: 15000 });
    await page.locator('#ivAddTime').waitFor({ state: 'visible', timeout: 15000 });
}

export async function getIdeviceId(page: Page): Promise<string> {
    const id = await page.locator(IV_IDEVICE).first().getAttribute('id');
    if (!id) throw new Error('interactive-video iDevice id not found');
    return id;
}

/**
 * Upload a local video into the open editor via the media-library file picker.
 * The workarea injects a "Select a file" browse button (`input.exe-pick-any-file`)
 * next to the `#ivVideoFile` picker; the id contains "video" so the file manager
 * filters to video assets. On insert the input receives an `asset://…` reference
 * (and a resolved blob URL) and the inline preview `<video>` mounts.
 */
export async function uploadLocalVideo(page: Page, fixturePath: string): Promise<void> {
    const browse = page.locator('#interactiveVideoIdeviceForm input.exe-pick-any-file').first();
    await browse.waitFor({ state: 'visible', timeout: 15000 });
    await browse.click();

    await page.waitForSelector('#modalFileManager.show, #modalFileManager[data-open="true"]', { timeout: 15000 });

    const fileInput = page.locator('#modalFileManager .media-library-upload-input');
    await fileInput.setInputFiles(fixturePath);

    const mediaItem = page.locator('#modalFileManager .media-library-item').first();
    await mediaItem.waitFor({ state: 'visible', timeout: 20000 });
    await mediaItem.click();

    const insertBtn = page.locator('#modalFileManager .media-library-insert-btn');
    await insertBtn.click();

    // Deterministic settle: the picker input carries the asset:// reference and
    // the file-manager modal has closed.
    await page.waitForFunction(
        () => {
            const input = document.getElementById('ivVideoFile') as HTMLInputElement | null;
            const modal = document.querySelector('#modalFileManager');
            const modalClosed = !modal || !modal.classList.contains('show');
            return !!input && input.value.startsWith('asset://') && modalClosed;
        },
        undefined,
        { timeout: 20000 },
    );
}

/** Wait for the inline editor player to have loaded metadata for a local video. */
export async function waitForEditorPlayer(page: Page, minDuration = 3): Promise<void> {
    await page.waitForFunction(
        (min: number) => {
            const v = document.getElementById('ivEditPlayerVideo') as HTMLVideoElement | null;
            return !!v && v.readyState >= 1 && isFinite(v.duration) && v.duration > min;
        },
        minDuration,
        { timeout: 20000 },
    );
}

/**
 * The interactive-video document as PERSISTED in the Yjs project: the component's
 * `jsonProperties` string, parsed. Components created in the workarea carry their
 * type in `ideviceType` (imported ones may use `type`), so both are accepted.
 */
export async function readPersistedDoc(page: Page): Promise<Record<string, unknown> | null> {
    const raw = await page.evaluate(() => {
        type YMap = { get: (key: string) => unknown; length?: number };
        const bridge = (window as { eXeLearning?: { app?: { project?: { _yjsBridge?: unknown } } } }).eXeLearning?.app
            ?.project?._yjsBridge as { getDocumentManager?: () => { getDoc?: () => unknown } } | undefined;
        const yDoc = bridge?.getDocumentManager?.()?.getDoc?.() as
            | { getArray: (name: string) => { length: number; get: (i: number) => YMap } }
            | undefined;
        if (!yDoc) return null;
        const navigation = yDoc.getArray('navigation');
        for (let p = 0; p < navigation.length; p++) {
            const blocks = navigation.get(p)?.get('blocks') as { length: number; get: (i: number) => YMap } | undefined;
            if (!blocks) continue;
            for (let b = 0; b < blocks.length; b++) {
                const components = blocks.get(b)?.get('components') as
                    | { length: number; get: (i: number) => YMap }
                    | undefined;
                if (!components) continue;
                for (let c = 0; c < components.length; c++) {
                    const component = components.get(c);
                    const type = component.get('ideviceType') || component.get('type');
                    if (type === 'interactive-video') {
                        const json = component.get('jsonProperties');
                        return typeof json === 'string' ? json : JSON.stringify(json ?? null);
                    }
                }
            }
        }
        return null;
    });
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
}

// ------------------------------------------------------------- authoring

/** Add one interaction of `kind` at `time` (mm:ss); the cover is pinned to 0. */
export async function addInteraction(
    page: Page,
    kind: 'cover' | 'note' | 'pause' | 'question' | 'jump',
    time?: string,
): Promise<void> {
    if (time && kind !== 'cover') {
        await page.locator('#ivAddTime').fill(time);
    }
    const buttons: Record<string, string> = {
        cover: '#ivAddCover',
        note: '#ivAddNote',
        pause: '#ivAddPause',
        question: '#ivAddQuestion',
        jump: '#ivAddJump',
    };
    await page.locator(buttons[kind]).click();
    await page.locator('#ivDetailPanel').waitFor({ state: 'visible', timeout: 10000 });
}

/**
 * Set the rich-text body of the selected note/pause/cover. The field is a shared
 * lite TinyMCE (`.exe-html-editor`); when the editor has attached we drive it
 * through its API (that is what `commitBodyEditor()` reads back), otherwise we
 * fall back to the plain textarea.
 */
export async function setBodyHtml(page: Page, html: string): Promise<void> {
    await page.locator('#ivDetailBody').waitFor({ state: 'attached', timeout: 10000 });
    // TinyMCE attaches asynchronously and only accepts content once it has
    // INITIALISED — setting it earlier is silently dropped, which is what
    // `commitBodyEditor()` would then read back. Wait for the initialised editor,
    // but never hard-fail: without TinyMCE the plain textarea is the source.
    await page
        .waitForFunction(
            () => {
                const tm = (window as { tinymce?: { get?: (id: string) => { initialized?: boolean } | null } }).tinymce;
                return !!tm?.get?.('ivDetailBody')?.initialized;
            },
            undefined,
            { timeout: 10000 },
        )
        .catch(() => {});
    await page.evaluate((value: string) => {
        type Editor = { initialized?: boolean; setContent: (h: string) => void; getContent: () => string };
        const tm = (window as { tinymce?: { get?: (id: string) => Editor | null } }).tinymce;
        const editor = tm?.get?.('ivDetailBody');
        if (editor?.initialized) {
            editor.setContent(value);
            return;
        }
        const textarea = document.getElementById('ivDetailBody') as HTMLTextAreaElement | null;
        if (textarea) {
            textarea.value = value;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }, html);
    // Read back: the body must be in whichever field the editor will commit.
    await page.waitForFunction(
        (value: string) => {
            const tm = (window as { tinymce?: { get?: (id: string) => { getContent: () => string } | null } }).tinymce;
            const editor = tm?.get?.('ivDetailBody');
            const textarea = document.getElementById('ivDetailBody') as HTMLTextAreaElement | null;
            const current = editor ? editor.getContent() : textarea?.value || '';
            return current.includes(value.replace(/<[^>]+>/g, ''));
        },
        html,
        { timeout: 10000 },
    );
}

/**
 * Insert an image into the selected note/pause/cover body through the REAL
 * authoring path: the body editor's Media Library image button → upload → pick →
 * insert → alt text → confirm. The body field is eXe's shared editor, so this is
 * the same dialog every other iDevice uses and the image lands as an `asset://`
 * reference.
 *
 * Everything is scoped to `#ivDetailPanel` so only the open detail editor's
 * toolbar can match, whatever other TinyMCE instances the page carries.
 */
export async function insertImageIntoBody(page: Page, fixturePath: string, alt: string): Promise<void> {
    const imageButton = page
        .locator('#ivDetailPanel .tox-tbtn[aria-label*="image" i], #ivDetailPanel .tox-tbtn[aria-label*="imagen" i]')
        .first();
    await imageButton.waitFor({ state: 'visible', timeout: 15000 });
    await imageButton.click();

    await page.waitForSelector('.tox-dialog', { timeout: 15000 });
    const browse = page.locator('.tox-dialog .tox-browse-url').first();
    await browse.waitFor({ state: 'visible', timeout: 10000 });
    await browse.click();

    await page.waitForSelector('#modalFileManager[data-open="true"], #modalFileManager.show', { timeout: 15000 });
    await page.locator('#modalFileManager .media-library-upload-input').setInputFiles(fixturePath);
    const item = page.locator('#modalFileManager .media-library-item:not(.media-library-folder)').first();
    await item.waitFor({ state: 'visible', timeout: 20000 });
    await item.click();
    await page.locator('#modalFileManager .media-library-insert-btn').click();

    // The picker fills the source field; the dialog stays open for the alt text.
    const altField = page.getByLabel(/Alternative description|Descripción alternativa/i).first();
    if ((await altField.count()) > 0) {
        await altField.fill(alt);
    }
    const confirm = page.locator('.tox-dialog .tox-button:has-text("Save"), .tox-dialog .tox-button--primary').first();
    await confirm.click();

    // Settle on the outcome, not on a delay: the body carries the asset image.
    await page.waitForFunction(
        () => {
            const tm = (window as { tinymce?: { get?: (id: string) => { getContent: () => string } | null } }).tinymce;
            const editor = tm?.get?.('ivDetailBody');
            const html = editor ? editor.getContent() : '';
            return /<img[^>]+src="(asset:\/\/|blob:)/.test(html);
        },
        undefined,
        { timeout: 20000 },
    );
}

/** Select `word` inside `#ivQuestionPrompt` and click the mark-blank button. */
async function markBlank(page: Page, word: string, buttonSelector: string): Promise<void> {
    const prompt = page.locator('#ivQuestionPrompt');
    await prompt.evaluate((el: HTMLTextAreaElement, target: string) => {
        const start = el.value.indexOf(target);
        if (start < 0) throw new Error(`word "${target}" not found in the prompt`);
        el.focus();
        el.setSelectionRange(start, start + target.length);
    }, word);
    await page.locator(buttonSelector).click();
}

/**
 * Author one question of any supported kind through the editor UI: add it at its
 * timestamp, switch the kind, fill the prompt and then the kind-specific answer
 * controls (repeaters, radio pairs, blank marking, pairs, sortable items).
 */
export async function authorQuestion(page: Page, spec: IvQuestionSpec): Promise<void> {
    await addInteraction(page, 'question', spec.time);
    await page.locator('#ivQuestionKind').waitFor({ state: 'visible', timeout: 10000 });
    if (spec.kind !== 'singleChoice') {
        await page.locator('#ivQuestionKind').selectOption(spec.kind);
        await page.locator('#ivQuestionPrompt').waitFor({ state: 'visible', timeout: 10000 });
    }
    await page.locator('#ivQuestionPrompt').fill(spec.prompt);

    if (spec.kind === 'singleChoice' || spec.kind === 'multipleChoice') {
        const answers = spec.answers || [];
        // Two empty rows exist by default; add the rest.
        const rows = page.locator('#ivAnswers .exe-iv-answer-row');
        for (let i = await rows.count(); i < answers.length; i++) {
            await page.locator('#ivAddAnswer').click();
        }
        for (let i = 0; i < answers.length; i++) {
            await page.locator('#ivAnswers .exe-iv-answer-text').nth(i).fill(answers[i][0]);
        }
        // Set the correct flags AFTER the labels so a re-render never drops them.
        // singleChoice uses an exclusive radio group (checking one clears the
        // rest); multipleChoice uses independent checkboxes.
        const toggles = page.locator('#ivAnswers .exe-iv-answer-correct');
        if (spec.kind === 'singleChoice') {
            const correct = answers.findIndex(answer => answer[1]);
            await toggles.nth(correct < 0 ? 0 : correct).check();
        } else {
            for (let i = 0; i < answers.length; i++) {
                await toggles.nth(i).setChecked(answers[i][1]);
            }
        }
    } else if (spec.kind === 'trueFalse') {
        await page.locator(`.exe-iv-tf-correct[value="${spec.solution ? '1' : '0'}"]`).check();
    } else if (spec.kind === 'cloze') {
        for (const word of spec.blanks || []) {
            await markBlank(page, word, '#ivClozeMark');
        }
    } else if (spec.kind === 'dropdown') {
        for (const word of spec.blanks || []) {
            await markBlank(page, word, '#ivDropdownMarkBlank');
        }
        if (spec.extraWords?.length) {
            await page.locator('#ivDropdownWords').fill(spec.extraWords.join('\n'));
        }
    } else if (spec.kind === 'matchElements') {
        const pairs = spec.pairs || [];
        for (let i = 0; i < pairs.length; i++) {
            await page.locator('#ivAddPair').click();
            await page.locator('#ivMatchPairs .exe-iv-match-left-input').nth(i).fill(pairs[i][0]);
            await page.locator('#ivMatchPairs .exe-iv-match-right-input').nth(i).fill(pairs[i][1]);
        }
    } else if (spec.kind === 'sortableList') {
        const items = spec.items || [];
        for (let i = 0; i < items.length; i++) {
            await page.locator('#ivAddSortItem').click();
            await page.locator('#ivSortItems .exe-iv-sort-item-text').nth(i).fill(items[i]);
        }
    }
}

/**
 * Replace the external-provider adapters with a controllable fake, so a YouTube
 * or Vimeo activity can be driven from a test WITHOUT third-party network.
 *
 * The adapters are a separate classic script that assigns a global, so a
 * property setter can wrap it the moment it loads and before the runtime binds.
 * Local video is left alone — there a real `<video>` is the point.
 *
 * What this covers is OUR half of the contract: given time events, does the
 * scheduler pause, grade and resume. The providers' own wire protocols are
 * theirs, and only a live run can vouch for those.
 */
export async function installFakeProviders(page: Page): Promise<void> {
    await page.addInitScript(() => {
        type Fake = {
            calls: { play: number; pause: number; seekTo: number[] };
            emitTime: (seconds: number) => void;
        };
        let real: Record<string, unknown> | null = null;
        (window as unknown as { __ivFakes: Fake[] }).__ivFakes = [];
        Object.defineProperty(window, 'exeInteractiveVideoProviders', {
            configurable: true,
            get() {
                if (!real) return undefined;
                return {
                    ...real,
                    createAdapter(spec: { provider: string }) {
                        if (spec.provider !== 'youtube' && spec.provider !== 'vimeo') {
                            return (real as { createAdapter: (s: unknown) => unknown }).createAdapter(spec);
                        }
                        const timeCbs: ((s: number) => void)[] = [];
                        const calls = { play: 0, pause: 0, seekTo: [] as number[] };
                        const fake = {
                            calls,
                            load: () => Promise.resolve(),
                            play: () => {
                                calls.play += 1;
                            },
                            pause: () => {
                                calls.pause += 1;
                            },
                            seekTo: (s: number) => calls.seekTo.push(s),
                            getCurrentTime: () => Promise.resolve(0),
                            getDuration: () => Promise.resolve(213),
                            onTimeUpdate: (cb: (s: number) => void) => timeCbs.push(cb),
                            onStateChange: () => {},
                            onReady: () => {},
                            destroy: () => {},
                            emitTime: (s: number) => timeCbs.forEach(cb => cb(s)),
                        };
                        (window as unknown as { __ivFakes: unknown[] }).__ivFakes.push(fake);
                        return fake;
                    },
                };
            },
            set(value: Record<string, unknown>) {
                real = value;
            },
        });
    });
}

/** Feed a time event to the faked provider, as the real player would. */
export async function emitProviderTime(surface: IvSurface, seconds: number): Promise<void> {
    await surface.evaluate((s: number) => {
        const fakes = (window as unknown as { __ivFakes?: { emitTime: (n: number) => void }[] }).__ivFakes || [];
        fakes.forEach(fake => fake.emitTime(s));
    }, seconds);
}

/** play / pause / seekTo the runtime asked the faked provider for. */
export async function providerCalls(
    surface: IvSurface,
): Promise<{ play: number; pause: number; seekTo: number[] } | null> {
    return surface.evaluate(() => {
        const fakes = (
            window as unknown as { __ivFakes?: { calls: { play: number; pause: number; seekTo: number[] } }[] }
        ).__ivFakes;
        return fakes && fakes.length ? fakes[0].calls : null;
    });
}

// -------------------------------------------------------------- preview

/** Resolve the live preview iframe as a Frame so we can waitForFunction inside it. */
export async function previewFrame(page: Page): Promise<Frame> {
    const handle = await page.locator('#preview-iframe').elementHandle();
    if (!handle) throw new Error('preview iframe element not found');
    const frame = await handle.contentFrame();
    if (!frame) throw new Error('preview iframe has no content frame');
    return frame;
}

/** Open the workarea preview and wait for the interactive-video runtime to mount. */
export async function openPreviewWithRuntime(page: Page): Promise<{ frameLoc: FrameLocator; frame: Frame }> {
    // The slide-out `#previewsidenav` reads "visible" even when closed, so the
    // shared openPreviewPanel() helper can skip the click and leave the iframe on
    // about:blank — click the toolbar button directly instead.
    await dismissBetaWarning(page);
    await page.click('#head-bottom-preview');
    // The panel is a slide-out: it stays in the DOM and reads "visible" even when
    // closed, so the deterministic signal is the `active` class (transform 0).
    await page.locator('#previewsidenav.active').waitFor({ timeout: 15000 });
    const frameLoc = getPreviewFrame(page);
    await frameLoc.locator('article').first().waitFor({ state: 'attached', timeout: 40000 });
    await frameLoc.locator('.exe-iv').first().waitFor({ state: 'attached', timeout: 20000 });
    const frame = await previewFrame(page);
    await waitForRuntimeReady(frame);
    return { frameLoc, frame };
}

/**
 * Close the slide-out preview panel. `closePreviewPanel()` waits for the panel to
 * become hidden, which never happens (it only slides out), so wait for the
 * `active` class to drop instead.
 */
export async function closePreview(page: Page): Promise<void> {
    const close = page.locator('#previewsidenavclose');
    if ((await close.count()) > 0) {
        await close.click({ force: true });
    }
    await page.locator('#previewsidenav:not(.active)').waitFor({ timeout: 15000 });
}

/** Wait until both runtime scripts have booted on a surface. */
export async function waitForRuntimeReady(surface: IvSurface): Promise<void> {
    await surface.waitForFunction(
        () => {
            const w = window as {
                exeInteractiveVideoCore?: unknown;
                exeInteractiveVideoProviders?: unknown;
                $interactivevideo?: { instances?: Record<string, unknown> };
            };
            return (
                typeof w.exeInteractiveVideoCore !== 'undefined' &&
                typeof w.exeInteractiveVideoProviders !== 'undefined' &&
                !!w.$interactivevideo &&
                Object.keys(w.$interactivevideo.instances || {}).length > 0
            );
        },
        undefined,
        { timeout: 30000 },
    );
}

/** Wait until the local `<video>` has a playable (resolved, non-`asset://`) source. */
export async function waitForPlayableVideo(surface: IvSurface): Promise<void> {
    await surface.waitForFunction(
        () => {
            const v = document.querySelector('video.exe-iv-video') as HTMLVideoElement | null;
            if (!v) return false;
            const source = v.querySelector('source') as HTMLSourceElement | null;
            const src = v.currentSrc || v.getAttribute('src') || source?.src || '';
            return src !== '' && !src.startsWith('asset:') && v.readyState >= 3;
        },
        undefined,
        { timeout: 30000 },
    );
}

/**
 * Start playback muted and fast. The scheduler is event-driven off `timeupdate`,
 * so a higher rate simply delivers the same interactions sooner; every blocking
 * interaction still pauses the video until the learner continues.
 */
export async function playFast(surface: IvSurface, rate = 6): Promise<void> {
    await surface.evaluate((playbackRate: number) => {
        const v = document.querySelector('video.exe-iv-video') as HTMLVideoElement;
        v.muted = true;
        v.playbackRate = playbackRate;
        try {
            v.currentTime = 0;
        } catch {
            /* not seekable yet */
        }
        return v.play().catch(() => {});
    }, rate);
}

/** Wait for the panel to show an interaction whose text contains `needle`. */
export async function waitForOverlay(surface: IvSurface, needle: string): Promise<void> {
    await surface.waitForFunction(
        (text: string) => {
            const overlay = document.querySelector('.exe-iv-overlay') as HTMLElement | null;
            return !!overlay && (overlay.textContent || '').includes(text);
        },
        needle,
        { timeout: 30000 },
    );
}

/** The panel element for the (single-instance) activity on this surface. */
export function overlayOf(surface: IvSurface): Locator {
    return surface.locator('.exe-iv-overlay');
}

/**
 * Answer the question currently shown in the panel, CORRECTLY, using only the
 * controls a learner has. Match/dropdown/sortable options are shuffled at render
 * time, so the answers are resolved from the visible labels, never from order.
 */
export async function answerQuestion(surface: IvSurface, spec: IvQuestionSpec): Promise<void> {
    const overlay = overlayOf(surface);
    if (spec.kind === 'singleChoice' || spec.kind === 'multipleChoice') {
        for (const [label, correct] of spec.answers || []) {
            if (!correct) continue;
            await overlay.locator('.exe-iv-option').filter({ hasText: label }).locator('input').check();
        }
    } else if (spec.kind === 'trueFalse') {
        await overlay.locator(`input[type="radio"][value="${spec.solution ? '1' : '0'}"]`).check();
    } else if (spec.kind === 'dropdown') {
        const words = spec.blanks || [];
        for (let i = 0; i < words.length; i++) {
            await overlay.locator('.exe-iv-dropdown-select').nth(i).selectOption({ label: words[i] });
        }
    } else if (spec.kind === 'cloze') {
        const words = spec.blanks || [];
        for (let i = 0; i < words.length; i++) {
            await overlay.locator('.exe-iv-cloze-input').nth(i).fill(words[i]);
        }
    } else if (spec.kind === 'matchElements') {
        const pairs = spec.pairs || [];
        for (let i = 0; i < pairs.length; i++) {
            await overlay.locator(`select.exe-iv-match-select[data-index="${i}"]`).selectOption({ label: pairs[i][1] });
        }
    } else if (spec.kind === 'sortableList') {
        await sortListIntoOrder(surface, (spec.items || []).length);
    }
}

/**
 * Put a shuffled sortable list back into the authored order using ONLY the
 * Move up / Move down buttons: for each target position, walk the item whose
 * `data-iv-index` matches it up until it lands there (selection sort).
 */
async function sortListIntoOrder(surface: IvSurface, itemCount: number): Promise<void> {
    const overlay = overlayOf(surface);
    for (let target = 0; target < itemCount; target++) {
        for (;;) {
            const order = await overlay
                .locator('.exe-iv-sortable-item')
                .evaluateAll(items => items.map(item => Number(item.getAttribute('data-iv-index'))));
            const at = order.indexOf(target);
            if (at <= target) break;
            await overlay.locator('.exe-iv-sortable-item').nth(at).locator('.exe-iv-sort-up').click();
        }
    }
}

/** Click Check and wait for the graded Continue button to appear. */
export async function checkAnswer(surface: IvSurface): Promise<void> {
    const overlay = overlayOf(surface);
    await overlay.locator('.exe-iv-check').click();
    await overlay.locator('.exe-iv-continue').waitFor({ state: 'visible', timeout: 10000 });
}

/** Dismiss the current interaction (Continue) and let playback resume. */
export async function continueOverlay(surface: IvSurface): Promise<void> {
    await overlayOf(surface).locator('.exe-iv-continue').click();
}

/** The recorded score fraction (0..1) for one interaction id, or undefined. */
export async function resultFor(surface: IvSurface, interactionId: string): Promise<number | undefined> {
    return surface.evaluate((id: string) => {
        const runtime = (
            window as {
                $interactivevideo?: { instances?: Record<string, { results?: Record<string, number> }> };
            }
        ).$interactivevideo;
        const instances = runtime?.instances || {};
        const first = Object.keys(instances)[0];
        return first ? instances[first].results?.[id] : undefined;
    }, interactionId);
}

/** Every recorded result on this surface, keyed by interaction id. */
export async function allResults(surface: IvSurface): Promise<Record<string, number>> {
    return surface.evaluate(() => {
        const runtime = (
            window as {
                $interactivevideo?: { instances?: Record<string, { results?: Record<string, number> }> };
            }
        ).$interactivevideo;
        const instances = runtime?.instances || {};
        const first = Object.keys(instances)[0];
        return first ? { ...(instances[first].results || {}) } : {};
    });
}

/** True while the video element is paused (the runtime's pause contract). */
export async function isVideoPaused(surface: IvSurface): Promise<boolean> {
    return surface.evaluate(() => {
        const v = document.querySelector('video.exe-iv-video') as HTMLVideoElement | null;
        return !!v && v.paused;
    });
}

// --------------------------------------------------------------- export

/**
 * Run the real "File ▸ Download as ▸ Website" HTML5 export and return the
 * download. The online and static navbars use different ids for the same
 * submenu and item, so both are targeted.
 */
export async function exportHtml5(page: Page): Promise<Download> {
    await dismissBlockingAlertModal(page);
    return downloadViaFileMenu(page, {
        submenu: '#dropdownExportAs:visible, #dropdownExportAsOffline:visible',
        item: '#navbar-button-export-html5:visible, #navbar-button-exportas-html5:visible',
    });
}
