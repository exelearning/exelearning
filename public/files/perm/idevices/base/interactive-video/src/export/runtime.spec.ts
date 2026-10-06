/**
 * Unit tests for the Interactive Video learner runtime (export code).
 *
 * These drive the public JSON-iDevice surface a fresh runtime exposes —
 * `renderView` (declarative, script-free HTML) and `renderBehaviour` (player,
 * scheduler, grading, scoring) — over the native `<video>` path and, through a
 * fake provider factory, over the external-provider path.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdapterSpec, PlaybackState, ProviderAdapter, ProviderFactory } from '../providers/types';
import { uniqueWatchedTime, watchedProgress } from '../shared/playback';
import { hydrateDocument } from '../shared/schema';
import type { InteractiveVideoDocumentV2 } from '../shared/types';
import { createInteractiveVideoRuntime, type InteractiveVideoRuntime } from './runtime';
import { updateScore } from './scoring';

const TEMPLATE = '<div class="exe-interactive-video-container">{content}</div>';

/** The legacy line-through markup that marks a blank in original content. */
const BLANK = '<span style="text-decoration: line-through;">';

interface TestWindow {
    exeInteractiveVideoProviders?: unknown;
}

interface TestGlobal {
    eXe?: { app?: { isInExe?: () => boolean } };
}

const testWindow = window as unknown as TestWindow;
const testGlobal = globalThis as unknown as TestGlobal;

/** A fake adapter whose time/state can be driven straight from the test. */
interface FakeAdapter extends ProviderAdapter {
    spec: AdapterSpec;
    calls: { play: number; pause: number; seekTo: number[]; loaded: boolean; destroyed: boolean };
    emitTime(seconds: number): void;
    emitState(state: PlaybackState): void;
}

interface FakeProviders {
    providers: ProviderFactory;
    created: FakeAdapter[];
}

/**
 * A controllable provider factory for the external-provider tests. `embedUrl`
 * returns nothing on purpose so no cross-origin `<iframe>` is injected into
 * happy-dom (which would noisily refuse to load it); the real embed markup is
 * asserted by the renderer tests. Here we only exercise how the runtime drives
 * the adapter, which is independent of the iframe markup.
 */
interface FakeOptions {
    loadRejects?: boolean;
    loadThrows?: boolean;
    duration?: number | null;
}

function makeFakeProviders(options: FakeOptions = {}): FakeProviders {
    const created: FakeAdapter[] = [];
    const providers: ProviderFactory = {
        embedUrl() {
            return '';
        },
        mediatecaStreamUrl(id) {
            return 'https://mediateca.educa.madrid.org/streaming.php?id=' + String(id);
        },
        createAdapter(spec) {
            const timeCallbacks: ((seconds: number) => void)[] = [];
            const stateCallbacks: ((state: PlaybackState) => void)[] = [];
            const readyCallbacks: (() => void)[] = [];
            const calls = { play: 0, pause: 0, seekTo: [] as number[], loaded: false, destroyed: false };
            const adapter: FakeAdapter = {
                spec: spec ?? {},
                calls: calls,
                load() {
                    calls.loaded = true;
                    if (options.loadThrows) {
                        throw new Error('no player');
                    }
                    return options.loadRejects ? Promise.reject(new Error('degraded')) : Promise.resolve();
                },
                play() {
                    calls.play += 1;
                },
                pause() {
                    calls.pause += 1;
                },
                seekTo(seconds) {
                    calls.seekTo.push(seconds);
                },
                getCurrentTime() {
                    return Promise.resolve(0);
                },
                getDuration() {
                    return Promise.resolve(options.duration === undefined ? 120 : options.duration);
                },
                onTimeUpdate(callback) {
                    timeCallbacks.push(callback);
                },
                onStateChange(callback) {
                    stateCallbacks.push(callback);
                },
                onReady(callback) {
                    readyCallbacks.push(callback);
                },
                destroy() {
                    calls.destroyed = true;
                },
                emitTime(seconds) {
                    for (const callback of timeCallbacks.slice()) {
                        callback(seconds);
                    }
                },
                emitState(state) {
                    for (const callback of stateCallbacks.slice()) {
                        callback(state);
                    }
                },
            };
            created.push(adapter);
            return adapter;
        },
    };
    return { providers, created };
}

/** Publish a fake factory on window, as the E2E fake-provider seam does. */
function useFakeProviders(options: FakeOptions = {}): FakeProviders {
    const fake = makeFakeProviders(options);
    (window as unknown as TestWindow).exeInteractiveVideoProviders = fake.providers;
    return fake;
}

/** Let the adapter's load()/getDuration() promise chain settle. */
async function flushMicrotasks(): Promise<void> {
    for (let round = 0; round < 5; round++) {
        await Promise.resolve();
    }
}

/**
 * Whether the panel is idle — holding no interaction — regardless of whether
 * the idle hint is drawn, which depends on being in the workarea.
 */
function panelIsIdle(overlay: HTMLElement): boolean {
    return !overlay.querySelector(
        '.exe-iv-question, .exe-iv-note-body, .exe-iv-pause-body, .exe-iv-cover-body, .exe-iv-continue',
    );
}

function overlayOf(root: ParentNode = document): HTMLElement {
    const overlay = root.querySelector<HTMLElement>('.exe-iv-overlay');
    if (!overlay) {
        throw new Error('the interaction panel did not mount');
    }
    return overlay;
}

/** Hydrate ORIGINAL (unversioned) legacy slides and give them a local video. */
function legacyDoc(slides: unknown[]): InteractiveVideoDocumentV2 {
    const result = hydrateDocument({ slides: slides });
    if (result.status !== 'ok') {
        throw new Error('the legacy slides did not hydrate');
    }
    result.document.video = { ...result.document.video, provider: 'local', url: 'resources/clip.mp4' };
    return result.document;
}

/** A v2 document payload the way the engine hands it over (a plain object). */
function v2(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        schemaVersion: 2,
        video: { provider: 'local', url: 'resources/clip.mp4' },
        interactions: [],
        completion: { mode: 'none', requiredScore: null },
        scorm: { enabled: false, showResults: true },
        ...overrides,
    };
}

describe('interactive-video learner runtime', () => {
    let iv: InteractiveVideoRuntime;

    beforeEach(() => {
        iv = createInteractiveVideoRuntime();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.useRealTimers();
        delete testWindow.exeInteractiveVideoProviders;
        delete testGlobal.eXe;
        document.body.innerHTML = '';
    });

    /** Render a document into the page, failing loudly if it was refused. */
    function mount(data: unknown, id?: string): void {
        const html = iv.renderView(data, false, TEMPLATE, id);
        if (html === false) {
            throw new Error('renderView refused the document');
        }
        document.body.innerHTML = html;
    }

    /** Push a native time signal, the way a playing `<video>` does. */
    function tick(time: number, root: ParentNode = document): void {
        const video = root.querySelector<HTMLVideoElement>('video.exe-iv-video');
        if (!video) {
            throw new Error('the native player did not mount');
        }
        video.currentTime = time;
        video.dispatchEvent(new Event('timeupdate'));
    }

    function instanceOf(id: string): NonNullable<InteractiveVideoRuntime['instances'][string]> {
        const instance = iv.instances[id];
        if (!instance) {
            throw new Error('no instance for ' + id);
        }
        return instance;
    }

    describe('the iDevice surface', () => {
        it('publishes the identity the engine resolves it by', () => {
            expect(iv.baseId).toBe('interactivevideo');
            expect(iv.classIdevice).toBe('interactive-video');
            expect(() => iv.init()).not.toThrow();
            expect(Object.keys(iv.instances)).toEqual([]);
        });

        it('keeps the instances of each runtime to itself', () => {
            mount(v2({ interactions: [{ id: 'n', type: 'note', time: 5, body: 'x' }] }), 'iv1');
            iv.renderBehaviour(v2({ interactions: [{ id: 'n', type: 'note', time: 5, body: 'x' }] }), false, 'iv1');
            expect(iv.instances['iv1']).toBeDefined();
            expect(createInteractiveVideoRuntime().instances['iv1']).toBeUndefined();
        });
    });

    describe('renderView', () => {
        it('wraps declarative content in the export template', () => {
            const html = iv.renderView(v2(), false, TEMPLATE, 'iv1');
            expect(html).toContain('exe-interactive-video-container');
            expect(html).toContain('id="exe-iv-iv1"');
            expect(html).not.toContain('<script');
        });

        it('falls back to its own container when the engine passes no template', () => {
            const html = iv.renderView(v2(), false, undefined, 'iv1');
            expect(html).toContain('<div class="exe-interactive-video-container">');
            expect(html).toContain('id="exe-iv-iv1"');
        });

        it('returns false for data that is not a document', () => {
            expect(iv.renderView(null, false, TEMPLATE, 'iv1')).toBe(false);
            expect(iv.renderView('nope', false, TEMPLATE, 'iv1')).toBe(false);
            expect(iv.renderView(7, false, TEMPLATE, 'iv1')).toBe(false);
        });

        it('leaves content from a NEWER schema untouched instead of emptying it', () => {
            // Schema v2 is the only published shape. A document claiming a
            // higher version was written by a newer eXeLearning: refusing to
            // render it keeps the stored markup — rendering an empty player
            // would silently destroy the activity.
            const future = { schemaVersion: 99, video: { provider: 'local', url: 'x.mp4' }, interactions: [] };
            expect(iv.renderView(future, false, TEMPLATE, 'ivFuture')).toBe(false);
            expect(iv.renderBehaviour(future, false, 'ivFuture')).toBe(false);
        });

        it('renders a native player for a local source and an inline embed for YouTube', () => {
            mount(v2(), 'iv1');
            expect(document.querySelector('video.exe-iv-video source')?.getAttribute('src')).toBe('resources/clip.mp4');
            // The embed is asserted on the returned markup rather than mounted:
            // a cross-origin <iframe> in happy-dom starts a real request whose
            // teardown noise can outlive the test.
            const embedHtml = iv.renderView(
                v2({ video: { provider: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ', videoId: 'dQw4w9WgXcQ' } }),
                false,
                TEMPLATE,
                'iv2',
            );
            expect(embedHtml).toContain('<iframe class="exe-iv-embed-frame"');
            expect(embedHtml).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
        });

        it('lists every interaction as a time-labelled seek row', () => {
            mount(
                v2({
                    interactions: [
                        { id: 'n', type: 'note', time: 5, body: '<p>Intro</p>' },
                        {
                            id: 'q',
                            type: 'question',
                            time: 65,
                            question: { kind: 'singleChoice', prompt: 'Q?', answers: [['a', 1]] },
                        },
                    ],
                }),
                'iv1',
            );
            expect(document.querySelectorAll('.exe-iv-results-table tbody tr').length).toBe(2);
            expect(document.querySelector('[data-iv-seek="5"]')?.textContent).toBe('00:05');
            expect(document.querySelector('[data-iv-seek="65"]')?.textContent).toBe('01:05');
        });

        it('drops the per-interaction title legacy content carried, instead of rendering it', () => {
            const doc = legacyDoc([{ type: 'text', text: 'x', startTime: 1, title: '<img src=x onerror=alert(1)>' }]);
            const html = iv.renderView(doc, false, TEMPLATE, 'iv1');
            // The title field is gone: its (malicious) content is neither
            // rendered nor injected.
            expect(html).not.toContain('onerror=alert(1)');
            const interaction = doc.interactions[0];
            expect(interaction && 'title' in interaction).toBe(false);
        });

        it('shows the idle hint only in the workarea', () => {
            // "Interactions will appear here" tells an AUTHOR what the empty
            // panel is for. A learner does not need to be told that something
            // might happen later.
            const data = v2({ interactions: [{ id: 'n', type: 'note', time: 5, body: 'x' }] });
            expect(iv.renderView(data, false, TEMPLATE, 'iv1')).not.toContain('Interactions will appear here.');
            testGlobal.eXe = { app: { isInExe: () => true } };
            expect(iv.renderView(data, false, TEMPLATE, 'iv1')).toContain('Interactions will appear here.');
        });

        it('still tells a learner when the video has no interactions at all', () => {
            const html = iv.renderView(v2(), false, TEMPLATE, 'iv1');
            expect(html).toContain('This video has no interactive elements.');
            expect(html).not.toContain('Interactions will appear here.');
        });
    });

    describe('renderBehaviour over a native video', () => {
        it('returns false when the mount element is missing', () => {
            expect(iv.renderBehaviour(v2(), false, 'missing-id')).toBe(false);
        });

        it('reveals a note when the video crosses its time', () => {
            const data = v2({ interactions: [{ id: 'n', type: 'note', time: 5, pause: true, body: '<p>Hello</p>' }] });
            mount(data, 'iv1');
            expect(iv.renderBehaviour(data, false, 'iv1')).toBe(true);
            const overlay = overlayOf();
            expect(panelIsIdle(overlay)).toBe(true);
            tick(6);
            expect(panelIsIdle(overlay)).toBe(false);
            expect(overlay.innerHTML).toContain('Hello');
        });

        it('always shows the player plus a stable panel; only the panel content swaps', () => {
            const data = v2({ interactions: [{ id: 'n', type: 'note', time: 5, pause: true, body: '<p>Hi</p>' }] });
            mount(data, 'iv1');
            iv.renderBehaviour(data, false, 'iv1');
            const stage = document.querySelector('.exe-iv-stage');
            const overlay = overlayOf();
            expect(stage?.querySelector('.exe-iv-player-wrap')).not.toBeNull();
            expect(stage?.classList.contains('is-interacting')).toBe(false);
            tick(6);
            // Active: the placeholder is replaced; the player never resizes.
            expect(panelIsIdle(overlay)).toBe(false);
            expect(stage?.classList.contains('is-interacting')).toBe(false);
            overlay.querySelector<HTMLElement>('.exe-iv-continue')?.click();
            expect(panelIsIdle(overlay)).toBe(true);
        });

        it('shows the cover as an opening screen with a Start button in the panel', () => {
            const data = v2({ interactions: [{ id: 'iv-cover', type: 'cover', time: 0, body: '<p>Bienvenido</p>' }] });
            mount(data, 'ivC');
            iv.renderBehaviour(data, false, 'ivC');
            const overlay = overlayOf();
            expect(overlay.innerHTML).toContain('Bienvenido');
            expect(overlay.querySelector('.exe-iv-continue')).not.toBeNull();
            expect(panelIsIdle(overlay)).toBe(false);
            // Start dismisses the cover, which is consumed for good.
            overlay.querySelector<HTMLElement>('.exe-iv-continue')?.click();
            expect(panelIsIdle(overlay)).toBe(true);
            expect(instanceOf('ivC').consumed.has('iv-cover')).toBe(true);
            tick(1);
            expect(panelIsIdle(overlay)).toBe(true);
        });

        it('marks a viewed note Seen in the collapsed results table', () => {
            const data = v2({
                interactions: [
                    { id: 'c', type: 'cover', time: 0, body: '<p>Portada</p>' },
                    { id: 'n', type: 'note', time: 5, pause: true, body: '<p>Hi</p>' },
                ],
            });
            mount(data, 'iv1');
            const rows = document.querySelectorAll('.exe-iv-results-table tbody tr');
            expect(rows[0]?.textContent).toContain('Cover');
            expect(rows[1]?.querySelector('.exe-iv-results-status')?.textContent).toBe('-');
            iv.renderBehaviour(data, false, 'iv1');
            // The cover shows first; the note is presented once it is dismissed.
            const overlay = overlayOf();
            overlay.querySelector<HTMLElement>('.exe-iv-continue')?.click();
            tick(6);
            overlay.querySelector<HTMLElement>('.exe-iv-continue')?.click();
            expect(rows[1]?.querySelector('.exe-iv-results-status')?.textContent).toBe('Seen');
        });

        it('omits the results table when Show results is off', () => {
            const html = iv.renderView(v2({ scorm: { enabled: false, showResults: false } }), false, TEMPLATE, 'iv1');
            expect(html).not.toContain('exe-iv-results-table');
        });

        it('grades a single-choice question and records the score', () => {
            const data = v2({
                interactions: [
                    {
                        id: 'q',
                        type: 'question',
                        time: 5,
                        pause: true,
                        question: {
                            kind: 'singleChoice',
                            prompt: 'Q?',
                            answers: [
                                ['wrong', 0],
                                ['right', 1],
                            ],
                        },
                    },
                ],
            });
            mount(data, 'iv1');
            iv.renderBehaviour(data, false, 'iv1');
            tick(6);
            const overlay = overlayOf();
            const correct = overlay.querySelector<HTMLInputElement>('input[value="1"]');
            if (!correct) {
                throw new Error('the question did not render');
            }
            correct.checked = true;
            overlay.querySelector<HTMLElement>('.exe-iv-check')?.click();
            expect(instanceOf('iv1').results['q']).toBe(1);
            expect(overlay.querySelector('.exe-iv-feedback')?.textContent).toContain('Correct');
        });

        it('presents two simultaneously-due questions one at a time, discarding neither (#2147)', () => {
            // Scrubbing forward (or authoring two interactions within one
            // timeupdate) makes several fall due in a single tick. They must be
            // shown ONE AT A TIME, not collapsed onto the last one — otherwise
            // the skipped questions are never answerable and score 0 in the
            // aggregate denominator.
            const question = (id: string, prompt: string): Record<string, unknown> => ({
                id: id,
                type: 'question',
                time: 5,
                pause: true,
                question: {
                    kind: 'singleChoice',
                    prompt: prompt,
                    answers: [
                        ['wrong', 0],
                        ['right', 1],
                    ],
                },
            });
            const data = v2({ interactions: [question('q1', 'Q1?'), question('q2', 'Q2?')] });
            mount(data, 'iv1');
            iv.renderBehaviour(data, false, 'iv1');
            const overlay = overlayOf();

            tick(6);
            expect(overlay.innerHTML).toContain('Q1?');
            expect(overlay.innerHTML).not.toContain('Q2?');

            const answer = (): void => {
                const correct = overlay.querySelector<HTMLInputElement>('input[value="1"]');
                if (!correct) {
                    throw new Error('the question did not render');
                }
                correct.checked = true;
                overlay.querySelector<HTMLElement>('.exe-iv-check')?.click();
            };
            answer();
            overlay.querySelector<HTMLElement>('.exe-iv-continue')?.click();
            expect(overlay.innerHTML).toContain('Q2?');
            expect(overlay.innerHTML).not.toContain('Q1?');
            answer();

            // Both questions were answerable and both scored.
            expect(instanceOf('iv1').results['q1']).toBe(1);
            expect(instanceOf('iv1').results['q2']).toBe(1);
        });

        it('does not re-fire a consumed backward jump (no trap)', () => {
            const data = v2({ interactions: [{ id: 'j1', type: 'jump', time: 10, jump: { toTime: 2 } }] });
            mount(data, 'iv1');
            iv.renderBehaviour(data, false, 'iv1');
            tick(11);
            expect(instanceOf('iv1').consumed.has('j1')).toBe(true);
        });

        it('auto-resumes a note after its duration elapses', () => {
            const data = v2({
                interactions: [{ id: 'n', type: 'note', time: 5, pause: true, duration: 3, body: '<p>Timed</p>' }],
            });
            mount(data, 'iv1');
            iv.renderBehaviour(data, false, 'iv1');
            const overlay = overlayOf();
            vi.useFakeTimers();
            tick(6);
            expect(panelIsIdle(overlay)).toBe(false);
            vi.advanceTimersByTime(3000);
            expect(panelIsIdle(overlay)).toBe(true);
        });

        it('drops a pending auto-resume timer when the same instance re-renders', () => {
            const data = v2({
                interactions: [{ id: 'n', type: 'note', time: 5, pause: true, duration: 3, body: '<p>Timed</p>' }],
            });
            mount(data, 'iv1');
            iv.renderBehaviour(data, false, 'iv1');
            vi.useFakeTimers();
            tick(6);
            const first = instanceOf('iv1');
            expect(first.overlayTimer).not.toBeNull();
            // A second behaviour pass tears the previous instance down, so no
            // stray timer can dismiss an interaction of the new one.
            iv.renderBehaviour(data, false, 'iv1');
            expect(first.overlayTimer).toBeNull();
            expect(first.adapter).toBeNull();
        });

        it('drives the native video directly when no adapter is bound', () => {
            const data = v2({ interactions: [{ id: 'n', type: 'note', time: 5, pause: true, body: '<p>Hi</p>' }] });
            mount(data, 'iv1');
            iv.renderBehaviour(data, false, 'iv1');
            const instance = instanceOf('iv1');
            const video = document.querySelector<HTMLVideoElement>('video.exe-iv-video');
            if (!video) {
                throw new Error('the native player did not mount');
            }
            instance.adapter = null;
            instance.seek(12);
            expect(video.currentTime).toBe(12);
            // A time that is not a time is ignored rather than thrown.
            instance.seek(Number.NaN);
            expect(video.currentTime).toBe(12);
            expect(() => instance.pause()).not.toThrow();
            expect(() => instance.resume()).not.toThrow();
        });

        it('keeps a note with no duration up until Continue', () => {
            const data = v2({
                interactions: [{ id: 'n', type: 'note', time: 5, pause: true, duration: null, body: '<p>Manual</p>' }],
            });
            mount(data, 'iv1');
            iv.renderBehaviour(data, false, 'iv1');
            const overlay = overlayOf();
            vi.useFakeTimers();
            tick(6);
            vi.advanceTimersByTime(60000);
            expect(panelIsIdle(overlay)).toBe(false);
            vi.useRealTimers();
            overlay.querySelector<HTMLElement>('.exe-iv-continue')?.click();
            expect(panelIsIdle(overlay)).toBe(true);
        });
    });

    describe('seeking and replays', () => {
        const questionDoc = (): Record<string, unknown> =>
            v2({
                interactions: [
                    {
                        id: 'iv-q',
                        type: 'question',
                        time: 5,
                        pause: true,
                        question: {
                            kind: 'singleChoice',
                            prompt: 'Capital?',
                            answers: [
                                ['Paris', 1],
                                ['Rome', 0],
                            ],
                        },
                    },
                ],
            });

        it('keeps a question on screen while the learner seeks', () => {
            // Seeking does not dismiss an interaction: it is a gate — the video
            // stopped because something is being asked.
            const data = questionDoc();
            mount(data, 'iv1');
            iv.renderBehaviour(data, false, 'iv1');
            const overlay = overlayOf();
            tick(6);
            expect(overlay.querySelector('.exe-iv-question')).not.toBeNull();
            for (const time of [15, 2, 6]) {
                tick(time);
                expect(overlay.querySelector('.exe-iv-question')).not.toBeNull();
            }
        });

        it('asks a question again when the learner rewinds past it, replacing the score', () => {
            const data = questionDoc();
            mount(data, 'iv1');
            iv.renderBehaviour(data, false, 'iv1');
            const overlay = overlayOf();
            tick(6);
            const paris = overlay.querySelector<HTMLInputElement>('input[type="radio"]');
            if (!paris) {
                throw new Error('the question did not render');
            }
            paris.checked = true;
            overlay.querySelector<HTMLElement>('.exe-iv-check')?.click();
            expect(instanceOf('iv1').results['iv-q']).toBe(1);
            overlay.querySelector<HTMLElement>('.exe-iv-continue')?.click();
            expect(panelIsIdle(overlay)).toBe(true);

            // Rewinding is a deliberate "ask me again".
            tick(2);
            tick(6);
            expect(overlay.querySelector('.exe-iv-question')).not.toBeNull();
            const rome = Array.from(overlay.querySelectorAll<HTMLInputElement>('input[type="radio"]'))[1];
            if (!rome) {
                throw new Error('the question did not re-render');
            }
            rome.checked = true;
            overlay.querySelector<HTMLElement>('.exe-iv-check')?.click();
            expect(instanceOf('iv1').results['iv-q']).toBe(0);
        });

        it('shows a note again when the learner replays that part', () => {
            const data = v2({
                interactions: [{ id: 'n', type: 'note', time: 5, pause: true, body: '<p>Look here</p>' }],
            });
            mount(data, 'iv1');
            iv.renderBehaviour(data, false, 'iv1');
            const overlay = overlayOf();
            tick(6);
            expect(overlay.textContent).toContain('Look here');
            overlay.querySelector<HTMLElement>('.exe-iv-continue')?.click();
            tick(2);
            tick(6);
            expect(overlay.textContent).toContain('Look here');
        });
    });

    describe('question kinds migrated from original content', () => {
        /** Mount one legacy slide, fire it at its time, and return the overlay. */
        function fire(slide: Record<string, unknown>): { overlay: HTMLElement; id: string } {
            const doc = legacyDoc([{ startTime: 5, ...slide }]);
            mount(doc, 'iv1');
            iv.renderBehaviour(doc, false, 'iv1');
            tick(6);
            const interaction = doc.interactions[0];
            if (!interaction) {
                throw new Error('the legacy slide did not migrate');
            }
            return { overlay: overlayOf(), id: interaction.id };
        }

        it('renders and grades a dropdown (blanks become selects)', () => {
            const { overlay, id } = fire({
                type: 'dropdown',
                text: `<p>Capital is ${BLANK}Paris</span>.</p>`,
                additionalWords: ['London'],
            });
            const select = overlay.querySelector<HTMLSelectElement>('.exe-iv-dropdown-select');
            if (!select) {
                throw new Error('the dropdown did not render');
            }
            select.value = 'Paris';
            overlay.querySelector<HTMLElement>('.exe-iv-check')?.click();
            expect(instanceOf('iv1').results[id]).toBe(1);
        });

        it('renders and grades a cloze (case-insensitive inputs)', () => {
            const { overlay, id } = fire({ type: 'cloze', text: `<p>Capital is ${BLANK}Paris</span>.</p>` });
            const input = overlay.querySelector<HTMLInputElement>('.exe-iv-cloze-input');
            if (!input) {
                throw new Error('the cloze did not render');
            }
            input.value = '  paris ';
            overlay.querySelector<HTMLElement>('.exe-iv-check')?.click();
            expect(instanceOf('iv1').results[id]).toBe(1);
        });

        it('renders and grades matchElements (one select per left)', () => {
            const { overlay, id } = fire({
                type: 'matchElements',
                text: '<p>Match</p>',
                pairs: [
                    ['France', 'Paris'],
                    ['Spain', 'Madrid'],
                ],
            });
            const selects = Array.from(overlay.querySelectorAll<HTMLSelectElement>('.exe-iv-match-select'));
            const [france, spain] = selects;
            if (!france || !spain) {
                throw new Error('the match rows did not render');
            }
            expect(selects.length).toBe(2);
            france.value = 'Paris';
            spain.value = 'Madrid';
            overlay.querySelector<HTMLElement>('.exe-iv-check')?.click();
            expect(instanceOf('iv1').results[id]).toBe(1);
        });

        it('renders sortableList with move buttons and grades the correct order', () => {
            const { overlay, id } = fire({ type: 'sortableList', text: '<p>Order</p>', items: ['a', 'b', 'c'] });
            const list = overlay.querySelector('.exe-iv-sortable-list');
            if (!list) {
                throw new Error('the sortable list did not render');
            }
            expect(overlay.querySelectorAll('.exe-iv-sort-btn').length).toBeGreaterThan(0);
            Array.from(list.querySelectorAll('.exe-iv-sortable-item'))
                .sort((a, b) => Number(a.getAttribute('data-iv-index')) - Number(b.getAttribute('data-iv-index')))
                .forEach(item => list.appendChild(item));
            overlay.querySelector<HTMLElement>('.exe-iv-check')?.click();
            expect(instanceOf('iv1').results[id]).toBe(1);
        });

        it('renders and grades a True/False question authored in v2', () => {
            const data = v2({
                interactions: [
                    {
                        id: 'iv-q',
                        type: 'question',
                        time: 5,
                        pause: true,
                        question: { kind: 'trueFalse', prompt: 'Sky is blue', solution: 1 },
                    },
                ],
            });
            mount(data, 'iv1');
            iv.renderBehaviour(data, false, 'iv1');
            tick(6);
            const overlay = overlayOf();
            expect(overlay.querySelectorAll('input[type="radio"]').length).toBe(2);
            const yes = overlay.querySelector<HTMLInputElement>('input[value="1"]');
            if (!yes) {
                throw new Error('the True/False control did not render');
            }
            yes.checked = true;
            overlay.querySelector<HTMLElement>('.exe-iv-check')?.click();
            expect(instanceOf('iv1').results['iv-q']).toBe(1);
        });
    });

    describe('provider parity (adapter-driven scheduler)', () => {
        const youtube = (interactions: Record<string, unknown>[]): Record<string, unknown> =>
            v2({
                video: {
                    provider: 'youtube',
                    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                    videoId: 'dQw4w9WgXcQ',
                },
                interactions: interactions,
            });

        it('builds a youtube adapter, pauses and reveals the panel at the interaction time', () => {
            const { providers, created } = makeFakeProviders();
            testWindow.exeInteractiveVideoProviders = providers;
            const data = youtube([
                {
                    id: 'q',
                    type: 'question',
                    time: 5,
                    pause: true,
                    question: { kind: 'singleChoice', prompt: 'Q?', answers: [['a', 1]] },
                },
            ]);
            mount(data, 'ivY');
            iv.renderBehaviour(data, false, 'ivY');

            const adapter = created[0];
            if (!adapter) {
                throw new Error('no adapter was created');
            }
            expect(adapter.spec.provider).toBe('youtube');
            const overlay = overlayOf();
            expect(panelIsIdle(overlay)).toBe(true);

            adapter.emitTime(6);
            expect(panelIsIdle(overlay)).toBe(false);
            expect(overlay.innerHTML).toContain('Q?');
            expect(adapter.calls.pause).toBeGreaterThan(0);
        });

        it('resumes playback through the adapter when the learner continues', () => {
            const { providers, created } = makeFakeProviders();
            testWindow.exeInteractiveVideoProviders = providers;
            const data = youtube([{ id: 'n', type: 'note', time: 5, pause: true, body: '<p>Hello</p>' }]);
            mount(data, 'ivY');
            iv.renderBehaviour(data, false, 'ivY');

            created[0]?.emitTime(6);
            const overlay = overlayOf();
            expect(panelIsIdle(overlay)).toBe(false);
            overlay.querySelector<HTMLElement>('.exe-iv-continue')?.click();
            expect(panelIsIdle(overlay)).toBe(true);
            expect(created[0]?.calls.play).toBeGreaterThan(0);
        });

        it('seeks through the adapter when a results row is clicked', () => {
            const { providers, created } = makeFakeProviders();
            testWindow.exeInteractiveVideoProviders = providers;
            const data = youtube([{ id: 'n', type: 'note', time: 8, pause: true, body: '<p>Hi</p>' }]);
            mount(data, 'ivY');
            iv.renderBehaviour(data, false, 'ivY');

            document.querySelector<HTMLElement>('.exe-iv-results-seek')?.click();
            expect(created[0]?.calls.seekTo).toContain(8);
        });

        it('drives watch completion from the adapter ended state', () => {
            // The provider reports no duration here, so completion falls back
            // to its own end-of-video signal.
            const { providers, created } = makeFakeProviders({ duration: null });
            testWindow.exeInteractiveVideoProviders = providers;
            const data = v2({
                video: { provider: 'vimeo', url: 'https://vimeo.com/123456789', videoId: '123456789' },
                completion: { mode: 'watch', requiredScore: null },
            });
            mount(data, 'ivV');
            iv.renderBehaviour(data, false, 'ivV');

            expect(created[0]?.spec.provider).toBe('vimeo');
            created[0]?.emitState('ended');
            expect(instanceOf('ivV').completed).toBe(true);
        });

        it('takes the duration the adapter reports', async () => {
            const { providers } = makeFakeProviders();
            testWindow.exeInteractiveVideoProviders = providers;
            const data = youtube([]);
            mount(data, 'ivD');
            iv.renderBehaviour(data, false, 'ivD');
            await flushMicrotasks();
            expect(instanceOf('ivD').duration).toBe(120);
        });

        it('destroys the previous adapter when the same instance re-renders (no listener leak)', () => {
            const { providers, created } = makeFakeProviders();
            testWindow.exeInteractiveVideoProviders = providers;
            const data = youtube([]);
            mount(data, 'ivR');
            iv.renderBehaviour(data, false, 'ivR');
            iv.renderBehaviour(data, false, 'ivR');
            expect(created.length).toBe(2);
            expect(created[0]?.calls.destroyed).toBe(true);
        });

        it('degrades without throwing when the player never loads', async () => {
            const { providers } = makeFakeProviders({ loadRejects: true });
            testWindow.exeInteractiveVideoProviders = providers;
            const data = youtube([{ id: 'n', type: 'note', time: 5, pause: true, body: '<p>Hi</p>' }]);
            mount(data, 'ivDeg');
            expect(() => iv.renderBehaviour(data, false, 'ivDeg')).not.toThrow();
            await flushMicrotasks();
            expect(instanceOf('ivDeg').degraded).toBe(true);
            // The accessible results list keeps working.
            const seek = document.querySelector<HTMLElement>('.exe-iv-results-seek');
            expect(seek).not.toBeNull();
            expect(() => seek?.click()).not.toThrow();
        });

        it('degrades when building the player throws outright', () => {
            useFakeProviders({ loadThrows: true });
            const data = youtube([{ id: 'n', type: 'note', time: 5, pause: true, body: '<p>Hi</p>' }]);
            mount(data, 'ivThrow');
            expect(() => iv.renderBehaviour(data, false, 'ivThrow')).not.toThrow();
            expect(instanceOf('ivThrow').degraded).toBe(true);
        });

        it('falls back to the bundled providers when nothing is published on window', () => {
            // The provider adapters are compiled into the bundle, so the local
            // path keeps working even with no global factory in sight.
            const data = v2({ interactions: [{ id: 'n', type: 'note', time: 5, pause: true, body: '<p>Local</p>' }] });
            mount(data, 'ivLocalOnly');
            iv.renderBehaviour(data, false, 'ivLocalOnly');
            tick(6);
            expect(panelIsIdle(overlayOf())).toBe(false);
        });
    });

    describe('several activities on one page', () => {
        it('resolves distinct ids from the injected data.ideviceId', () => {
            // exe_export injects the DOM id as data.ideviceId and calls
            // renderView/renderBehaviour WITHOUT the ideviceId argument. Two
            // activities on one page must not collapse to the shared baseId.
            const dataA = v2({ ideviceId: 'idA', video: { provider: 'local', url: 'resources/a.mp4' } });
            const dataB = v2({ ideviceId: 'idB', video: { provider: 'local', url: 'resources/b.mp4' } });
            const htmlA = iv.renderView(dataA, false, TEMPLATE);
            const htmlB = iv.renderView(dataB, false, TEMPLATE);
            document.body.innerHTML = String(htmlA) + String(htmlB);

            expect(document.getElementById('exe-iv-idA')).not.toBeNull();
            expect(document.getElementById('exe-iv-idB')).not.toBeNull();
            iv.renderBehaviour(dataA, false);
            iv.renderBehaviour(dataB, false);
            expect(iv.instances['idA']).toBeDefined();
            expect(iv.instances['idB']).toBeDefined();
            expect(iv.instances['idA']).not.toBe(iv.instances['idB']);
        });

        it('falls back to data.id, then to the shared base id', () => {
            const byId = v2({ id: 'byId' });
            expect(iv.renderView(byId, false, TEMPLATE)).toContain('id="exe-iv-byId"');
            expect(iv.renderView(v2(), false, TEMPLATE)).toContain('id="exe-iv-interactivevideo"');
        });

        it('fires independently, with distinct control ids and separate scores', () => {
            const doc = (id: string): Record<string, unknown> =>
                v2({
                    ideviceId: id,
                    interactions: [
                        {
                            id: 'iv-q',
                            type: 'question',
                            time: 5,
                            pause: true,
                            question: { kind: 'trueFalse', prompt: 'Q', solution: 1 },
                        },
                    ],
                });
            const dataA = doc('idA');
            const dataB = doc('idB');
            document.body.innerHTML =
                String(iv.renderView(dataA, false, TEMPLATE)) + String(iv.renderView(dataB, false, TEMPLATE));
            iv.renderBehaviour(dataA, false);
            iv.renderBehaviour(dataB, false);

            const rootA = document.getElementById('exe-iv-idA');
            const rootB = document.getElementById('exe-iv-idB');
            if (!rootA || !rootB) {
                throw new Error('both activities must mount');
            }
            tick(6, rootA);
            tick(6, rootB);

            const radioA = rootA.querySelector<HTMLInputElement>('.exe-iv-overlay input[type="radio"][value="1"]');
            const radioB = rootB.querySelector<HTMLInputElement>('.exe-iv-overlay input[type="radio"][value="1"]');
            if (!radioA || !radioB) {
                throw new Error('both questions must render');
            }
            // Distinct namespaced name (separate browser radio groups) and id
            // (no duplicate ids that would break <label for> across instances).
            expect(radioA.getAttribute('name')).toBe('idA-iv-q');
            expect(radioB.getAttribute('name')).toBe('idB-iv-q');
            expect(radioA.id).not.toBe(radioB.id);

            radioA.checked = true;
            radioB.checked = true;
            rootA.querySelector<HTMLElement>('.exe-iv-overlay .exe-iv-check')?.click();
            rootB.querySelector<HTMLElement>('.exe-iv-overlay .exe-iv-check')?.click();
            // Each instance grades into its own results, keyed by the raw id.
            expect(instanceOf('idA').results['iv-q']).toBe(1);
            expect(instanceOf('idB').results['iv-q']).toBe(1);
        });
    });

    describe('a legacy activity keeps its video (#2147)', () => {
        // A legacy interactive video keeps its video URL ONLY in the data island
        // — the old model never stored it in the properties. The engine renders
        // the view while the island is still in the node, then REPLACES the
        // node's innerHTML with that output before calling renderBehaviour. So a
        // behaviour pass that re-resolves the document would find no island and
        // silently build a different one: provider `local`, no URL, fewer
        // interactions — a YouTube player that nothing was driving. Reported
        // against a real CEDEC package ("campaña de denuncia").
        const island = (videoId: string, slides: unknown[], extra: Record<string, unknown> = {}): string =>
            '<div class="exe-interactive-video">' +
            '<p id="exe-interactive-video-file" class="js-hidden">' +
            '<a href="https://www.youtube.com/watch?v=' +
            videoId +
            '">watch?v=' +
            videoId +
            '</a></p>' +
            '<script id="exe-interactive-video-contents" type="application/json">' +
            JSON.stringify({ slides: slides, ...extra }) +
            '</script></div>';

        const LEGACY_SLIDES = [
            { type: 'text', text: '<p>Apertura</p>', startTime: 1, endTime: 13 },
            { type: 'text', text: '<p>Problema</p>', startTime: 21, endTime: 60 },
            { type: 'text', text: '<p>Cierre</p>', startTime: 62, endTime: 80 },
        ];

        /** What an imported legacy activity has in its properties: no video. */
        const LEGACY_PROPERTIES = { slides: [], coverType: 'text' };

        it('hydrates the legacy island when the stored properties are empty', () => {
            // exe_export mounts the node (id === data.ideviceId) whose innerHTML
            // is the island, then calls renderView BEFORE overwriting it.
            document.body.innerHTML =
                '<div id="ivLegacy">' +
                island('uGNFMMn-U8M', [
                    { type: 'text', text: '<p>Body</p>', startTime: 5, title: 'Legacy Note' },
                    {
                        type: 'singleChoice',
                        question: '<p>Q?</p>',
                        answers: [
                            ['a', 0],
                            ['b', 1],
                        ],
                        startTime: 10,
                        title: 'Legacy Question',
                    },
                ]) +
                '</div>';

            const html = iv.renderView({ ideviceId: 'ivLegacy' }, false, TEMPLATE);
            expect(html).toContain('exe-iv-results-table');
            expect(String(html).match(/data-iv-result=/g)?.length).toBe(2);
            expect(html).toContain('data-iv-seek="5"');
            expect(html).toContain('data-iv-seek="10"');
        });

        it('recovers the video URL from the island even when the properties carry slides', () => {
            // The reported regression: a legacy .elpx whose jsonProperties DID
            // carry the slides, but the old model stored the video URL only in
            // the island's link. The questions survived yet the URL was dropped,
            // so no video was displayed.
            const data = {
                htmlView: island('uGNFMMn-U8M', [{ type: 'text', text: '<p>Body</p>', startTime: 5, title: 'Note' }]),
                slides: [{ type: 'text', text: '<p>Body</p>', startTime: 5, title: 'Note' }],
            };
            const html = iv.renderView(data, false, TEMPLATE, 'iv1');
            expect(html).toContain('data-iv-provider="youtube"');
            expect(html).toContain('youtube-nocookie.com/embed/uGNFMMn-U8M');
            expect(html).toContain('data-iv-seek="5"');
            expect(html).toContain('data-iv-result=');
        });

        it('reads the legacy island from the Text-bag mirror as well', () => {
            // Legacy content was mirrored into the Text bag (`textTextarea`);
            // that copy is a data island too and carries the same video URL.
            const data = {
                textTextarea: island('uGNFMMn-U8M', [{ type: 'text', text: '<p>Body</p>', startTime: 5 }]),
            };
            const html = iv.renderView(data, false, TEMPLATE, 'ivMirror');
            expect(html).toContain('youtube-nocookie.com/embed/uGNFMMn-U8M');
            expect(html).toContain('data-iv-seek="5"');
        });

        it('keeps the legacy slides when no island survives anywhere', () => {
            // Properties only: the slides are migrated and the activity still
            // renders — it simply has no video URL left to play.
            const html = iv.renderView(
                { slides: [{ type: 'text', text: '<p>Body</p>', startTime: 5 }] },
                false,
                TEMPLATE,
                'ivNoIsland',
            );
            expect(html).toContain('data-iv-seek="5"');
            expect(html).toContain('<video class="exe-iv-video"');
        });

        it('does not treat an already-migrated v2 document as a legacy island', () => {
            // A modern doc carries schemaVersion; even if a stray htmlView is
            // present it must be used as-is (no island recovery, no data loss).
            const data = v2({
                htmlView:
                    '<div class="exe-interactive-video"><p id="exe-interactive-video-file">' +
                    '<a href="https://www.youtube.com/watch?v=STALE1234567">stale</a></p></div>',
            });
            const html = iv.renderView(data, false, TEMPLATE, 'iv1');
            expect(html).toContain('src="resources/clip.mp4"');
            expect(html).not.toContain('STALE1234567');
        });

        it('drives the same document the view was rendered from', () => {
            // The fake factory keeps a cross-origin <iframe> out of happy-dom;
            // the recovered URL itself is asserted by the test above and by the
            // instance's own document below.
            useFakeProviders();
            const node = document.createElement('div');
            node.id = 'iv-legacy';
            node.className = 'idevice_node interactive-video';
            node.innerHTML = island('uGNFMMn-U8M', LEGACY_SLIDES, {
                title: 'Modelo de campaña',
                description: '<p>Intro</p>',
                coverType: 'text',
            });
            document.body.appendChild(node);

            const html = iv.renderView(LEGACY_PROPERTIES, false, TEMPLATE, 'iv-legacy');
            expect(html).toContain('data-iv-provider="youtube"');

            // The engine replaces the node with the rendered output: the island
            // is gone before behaviour runs.
            node.innerHTML = String(html);
            expect(node.querySelector('#exe-interactive-video-file')).toBeNull();

            expect(iv.renderBehaviour(LEGACY_PROPERTIES, false, 'iv-legacy')).toBe(true);
            const instance = instanceOf('iv-legacy');
            expect(instance.provider).toBe('youtube');
            expect(instance.doc.video.videoId).toBe('uGNFMMn-U8M');
            expect(instance.doc.video.url).toContain('uGNFMMn-U8M');
            // The three legacy slides plus the cover the migration synthesises.
            expect(instance.doc.interactions.length).toBe(4);
            expect(instance.doc.interactions[0]?.type).toBe('cover');
        });

        it('opens a legacy text cover with its title as a heading', () => {
            useFakeProviders();
            const node = document.createElement('div');
            node.id = 'iv-cover-legacy';
            node.innerHTML = island('uGNFMMn-U8M', LEGACY_SLIDES, {
                title: 'Modelo de campaña',
                description: '<p>Intro</p>',
                coverType: 'text',
            });
            document.body.appendChild(node);
            node.innerHTML = String(iv.renderView(LEGACY_PROPERTIES, false, TEMPLATE, 'iv-cover-legacy'));
            iv.renderBehaviour(LEGACY_PROPERTIES, false, 'iv-cover-legacy');

            const overlay = overlayOf(node);
            // The legacy opener's title lands in the cover's own title field —
            // still editable AS a title — and only the description is body.
            expect(overlay.innerHTML).toContain('<h3 class="exe-iv-cover-title">Modelo de campaña</h3>');
            expect(overlay.innerHTML).toContain('Intro');
            expect(overlay.querySelector('.exe-iv-continue')).not.toBeNull();
        });

        it('still resolves from the properties when there never was an island', () => {
            useFakeProviders();
            const data = v2({
                video: {
                    provider: 'youtube',
                    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                    videoId: 'dQw4w9WgXcQ',
                },
            });
            mount(data, 'iv-modern');
            iv.renderBehaviour(data, false, 'iv-modern');
            expect(instanceOf('iv-modern').provider).toBe('youtube');
        });

        it('keeps two legacy activities on one page apart', () => {
            useFakeProviders();
            for (const [id, videoId] of [
                ['iv-a', 'uGNFMMn-U8M'],
                ['iv-b', 'dQw4w9WgXcQ'],
            ]) {
                const node = document.createElement('div');
                node.id = String(id);
                node.innerHTML = island(String(videoId), LEGACY_SLIDES, { coverType: 'text' });
                document.body.appendChild(node);
                node.innerHTML = String(iv.renderView(LEGACY_PROPERTIES, false, TEMPLATE, String(id)));
                iv.renderBehaviour(LEGACY_PROPERTIES, false, String(id));
            }
            expect(instanceOf('iv-a').doc.video.videoId).toBe('uGNFMMn-U8M');
            expect(instanceOf('iv-b').doc.video.videoId).toBe('dQw4w9WgXcQ');
        });
    });

    describe('watched progress', () => {
        function boot(
            overrides: Record<string, unknown> = {},
        ): NonNullable<InteractiveVideoRuntime['instances'][string]> {
            const data = v2(overrides);
            mount(data, 'iv1');
            iv.renderBehaviour(data, false, 'iv1');
            return instanceOf('iv1');
        }

        it('accumulates watched ranges from playback but not from seeks', () => {
            const instance = boot();
            instance.duration = 100;
            for (const time of [1, 2, 3]) {
                tick(time);
            }
            // A jump to the end is a seek, not 96 more seconds of watching. The
            // very first signal has nothing to measure against, so the span
            // before it is not claimed either.
            tick(99);
            tick(100);
            expect(uniqueWatchedTime(instance.playback)).toBeCloseTo(3, 5);
            expect(watchedProgress(instance.playback, 100)).toBeCloseTo(0.03, 5);
        });

        it('does not complete a watch activity satisfied by seeking to the end', () => {
            const instance = boot({ completion: { mode: 'watch', requiredScore: null } });
            instance.duration = 100;
            tick(1);
            tick(100);
            document.querySelector('video.exe-iv-video')?.dispatchEvent(new Event('ended'));
            expect(instance.completed).toBe(false);
        });

        it('completes a watch activity once the video has really been watched', () => {
            const instance = boot({ completion: { mode: 'watch', requiredScore: null } });
            instance.duration = 10;
            for (let time = 0.5; time <= 10; time += 0.5) {
                tick(time);
            }
            document.querySelector('video.exe-iv-video')?.dispatchEvent(new Event('ended'));
            expect(instance.completed).toBe(true);
        });

        it('falls back to the ended event when the provider reports no duration', () => {
            const instance = boot({ completion: { mode: 'watch', requiredScore: null } });
            instance.duration = undefined;
            tick(1);
            updateScore(instance);
            expect(instance.completed).toBe(false);
            document.querySelector('video.exe-iv-video')?.dispatchEvent(new Event('ended'));
            expect(instance.completed).toBe(true);
        });
    });
});
