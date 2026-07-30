/**
 * Unit tests for the learner runtime's declarative HTML builders.
 *
 * Everything here is a pure string builder over a schema-v2 document: no
 * instance state, no event wiring. The tests assert the accessible markup the
 * exported page ships — including the escaping that keeps author content inert
 * and the id namespacing that lets several videos share one page.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeV2 } from '../shared/schema';
import type {
    Interaction,
    InteractiveVideoDocumentV2,
    NoteInteraction,
    Question,
    QuestionInteraction,
} from '../shared/types';
import type { ProviderAdapter, ProviderFactory } from '../providers/types';
import {
    isAuthoring,
    makeTranslator,
    panelPlaceholderHtml,
    renderInteractionBodyHtml,
    renderPlayerHtml,
    renderQuestionHtml,
    renderResultsHtml,
    renderViewHtml,
    resolveProviders,
    scopeId,
    segmentsFor,
    shuffle,
    shuffleIndices,
    type Translate,
} from './renderer';

/** Identity translator: no Custom texts, no workarea `window._`. */
const t: Translate = makeTranslator(null);

/** Normalize a partial v2 payload into a full document, as the runtime does. */
function makeDoc(overrides: Record<string, unknown> = {}): InteractiveVideoDocumentV2 {
    return normalizeV2({
        schemaVersion: 2,
        video: { provider: 'local', url: 'resources/clip.mp4' },
        ...overrides,
    });
}

/**
 * A question interaction built from a RAW question object — not normalized —
 * so a legacy question with an HTML prompt and no `segments` can be rendered,
 * which is exactly what the runtime's on-demand fallback has to cope with.
 */
function questionInteraction(question: Record<string, unknown>, id = 'iv-q'): QuestionInteraction {
    return { id, type: 'question', time: 5, duration: null, pause: true, question: question as unknown as Question };
}

/** The window slice the tests install fakes on. */
interface TestWindow {
    exeInteractiveVideoProviders?: unknown;
    _?: (text: string) => string;
}

/** The globals slice the authoring probe reads. */
interface TestGlobal {
    eXe?: { app?: { isInExe?: () => boolean } };
}

const testWindow = window as unknown as TestWindow;
const testGlobal = globalThis as unknown as TestGlobal;

/** A provider factory whose URL builders are controllable from the test. */
function fakeFactory(overrides: Partial<ProviderFactory> = {}): ProviderFactory {
    return {
        embedUrl: () => 'https://fake.example/embed',
        mediatecaStreamUrl: id => 'https://fake.example/stream?id=' + String(id),
        createAdapter: () => ({}) as unknown as ProviderAdapter,
        ...overrides,
    };
}

afterEach(() => {
    delete testWindow.exeInteractiveVideoProviders;
    delete testWindow._;
    delete testGlobal.eXe;
    document.body.innerHTML = '';
});

describe('makeTranslator', () => {
    it('prefers the author Custom text for a key', () => {
        const translate = makeTranslator({ goOn: 'Seguir' });
        expect(translate('Continue', 'goOn')).toBe('Seguir');
    });

    it('keeps the built-in text when the key has no Custom text', () => {
        const translate = makeTranslator({ goOn: 'Seguir' });
        expect(translate('Check', 'check')).toBe('Check');
        expect(translate('Check')).toBe('Check');
    });

    it('ignores an empty Custom text instead of blanking the string', () => {
        const translate = makeTranslator({ goOn: '' });
        expect(translate('Continue', 'goOn')).toBe('Continue');
    });

    it('translates through window._ when the page publishes one', () => {
        testWindow._ = text => 'ES:' + text;
        expect(makeTranslator(null)('Continue', 'goOn')).toBe('ES:Continue');
        // A Custom text still wins over the global translator.
        expect(makeTranslator({ goOn: 'Seguir' })('Continue', 'goOn')).toBe('Seguir');
    });
});

describe('resolveProviders', () => {
    it('prefers the factory published on window', () => {
        const external = fakeFactory();
        testWindow.exeInteractiveVideoProviders = external;
        expect(resolveProviders(null)).toBe(external);
    });

    it('falls back to the bundled factory when nothing is published', () => {
        const bundled = fakeFactory();
        expect(resolveProviders(bundled)).toBe(bundled);
        expect(resolveProviders()).toBeNull();
    });

    it('ignores a published value that is not a factory', () => {
        const bundled = fakeFactory();
        testWindow.exeInteractiveVideoProviders = { embedUrl: () => '' };
        expect(resolveProviders(bundled)).toBe(bundled);
    });
});

describe('isAuthoring', () => {
    it('is true only inside the workarea', () => {
        expect(isAuthoring()).toBe(false);
        testGlobal.eXe = { app: { isInExe: () => true } };
        expect(isAuthoring()).toBe(true);
    });

    it('is false in preview and in exported content', () => {
        testGlobal.eXe = { app: { isInExe: () => false } };
        expect(isAuthoring()).toBe(false);
        testGlobal.eXe = { app: {} };
        expect(isAuthoring()).toBe(false);
    });
});

describe('panelPlaceholderHtml', () => {
    it('tells a learner when the video has no interactive elements', () => {
        expect(panelPlaceholderHtml(true, t)).toContain('This video has no interactive elements.');
    });

    it('shows the authoring hint only in the workarea', () => {
        testGlobal.eXe = { app: { isInExe: () => true } };
        expect(panelPlaceholderHtml(false, t)).toContain('Interactions will appear here.');
    });

    it('stays quiet for a learner whose video does have interactions', () => {
        // The panel keeps its space (rendered by renderViewHtml) but says
        // nothing: a learner does not need to be told something may happen.
        expect(panelPlaceholderHtml(false, t)).toBe('');
    });

    it('lets a Custom text replace the no-interactions message', () => {
        expect(panelPlaceholderHtml(true, makeTranslator({ noSlides: 'Sin interacciones' }))).toContain(
            'Sin interacciones',
        );
    });
});

describe('renderPlayerHtml', () => {
    it('renders a native <video> for a local source, with no external script', () => {
        const html = renderPlayerHtml(makeDoc(), t);
        expect(html).toContain('<video class="exe-iv-video"');
        expect(html).toContain('src="resources/clip.mp4"');
        expect(html).not.toContain('<script');
    });

    it('renders a native <track> per subtitle (SRT->VTT is an export concern, issue #2035)', () => {
        const html = renderPlayerHtml(
            makeDoc({
                video: {
                    provider: 'local',
                    url: 'resources/clip.mp4',
                    captions: [
                        { src: 'resources/es.vtt', lang: 'es', label: 'Español', default: true },
                        { src: 'resources/en.srt', lang: 'en', label: 'English' },
                    ],
                },
            }),
            t,
        );
        expect(html).toContain('<track kind="captions" srclang="es"');
        expect(html).toContain('src="resources/es.vtt" default>');
        // The .srt survives verbatim; the exporter converts it to .vtt.
        expect(html).toContain('src="resources/en.srt"');
    });

    it('plays Mediateca through a native <video> over the derived stream URL', () => {
        const html = renderPlayerHtml(makeDoc({ video: { provider: 'mediateca', url: '', videoId: '42' } }), t);
        expect(html).toContain('data-iv-provider="mediateca"');
        expect(html).toContain('src="https://mediateca.educa.madrid.org/streaming.php?id=42"');
    });

    it('embeds YouTube inline via the controllable privacy-enhanced URL (no facade, no SDK)', () => {
        const html = renderPlayerHtml(
            makeDoc({ video: { provider: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ', videoId: 'dQw4w9WgXcQ' } }),
            t,
        );
        expect(html).toContain('data-iv-provider="youtube"');
        expect(html).toContain('<iframe class="exe-iv-embed-frame"');
        // enablejsapi=1 is what makes raw postMessage control possible (ADR-0003).
        expect(html).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ?enablejsapi=1&amp;rel=0');
        expect(html).toContain('origin=' + encodeURIComponent(window.location.origin).replace(/&/g, '&amp;'));
        expect(html).not.toContain('target="_blank"');
        expect(html).not.toContain('youtube.com/iframe_api');
    });

    it('delegates autoplay to the external player so the adapter can resume it', () => {
        // Without `autoplay` in the permissions policy the browser refuses the
        // adapter's play command on a cross-origin player: it buffers, falls
        // back to "unstarted", no time events arrive and nothing can fire.
        for (const video of [
            { provider: 'youtube', url: 'https://youtu.be/x', videoId: 'x' },
            { provider: 'vimeo', url: 'https://vimeo.com/76979871', videoId: '76979871' },
        ]) {
            expect(renderPlayerHtml(makeDoc({ video }), t)).toContain(
                'allow="autoplay; fullscreen; picture-in-picture"',
            );
        }
    });

    it('offers a keyboard-accessible external link when the provider has no inline embed', () => {
        testWindow.exeInteractiveVideoProviders = fakeFactory({ embedUrl: () => '' });
        const html = renderPlayerHtml(
            makeDoc({ video: { provider: 'youtube', url: 'https://youtu.be/x', videoId: 'x' } }),
            t,
        );
        expect(html).toContain('class="exe-iv-embed-facade"');
        expect(html).toContain('href="https://youtu.be/x"');
        expect(html).toContain('rel="noopener"');
    });

    it('resolves the embed and stream URLs through the published factory when there is one', () => {
        testWindow.exeInteractiveVideoProviders = fakeFactory();
        expect(renderPlayerHtml(makeDoc({ video: { provider: 'youtube', videoId: 'x' } }), t)).toContain(
            'src="https://fake.example/embed"',
        );
        expect(renderPlayerHtml(makeDoc({ video: { provider: 'mediateca', videoId: '7' } }), t)).toContain(
            'src="https://fake.example/stream?id=7"',
        );
    });

    it('still builds both URLs from the bundled providers when none is published', () => {
        // The bundled factory is compiled in, so a packaging change can no
        // longer leave the runtime without provider URLs.
        expect(renderPlayerHtml(makeDoc({ video: { provider: 'youtube', videoId: 'dQw4w9WgXcQ' } }), t)).toContain(
            'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        );
        expect(renderPlayerHtml(makeDoc({ video: { provider: 'vimeo', videoId: '123' } }), t)).toContain(
            'https://player.vimeo.com/video/123?dnt=1',
        );
        expect(renderPlayerHtml(makeDoc({ video: { provider: 'mediateca', videoId: '42' } }), t)).toContain(
            'https://mediateca.educa.madrid.org/streaming.php?id=42',
        );
    });
});

describe('renderResultsHtml', () => {
    const resultsDoc = makeDoc({
        interactions: [
            { id: 'c', type: 'cover', time: 0, body: '<p>Portada</p>' },
            { id: 'n', type: 'note', time: 5, pause: true, body: '<p>Hi</p>' },
            {
                id: 'q',
                type: 'question',
                time: 65,
                question: {
                    kind: 'singleChoice',
                    prompt: 'Q?',
                    answers: [
                        ['a', 1],
                        ['b', 0],
                    ],
                },
            },
        ],
    });

    it('lists every interaction as a time-labelled seek link, cover first', () => {
        document.body.innerHTML = renderResultsHtml(resultsDoc, t);
        const rows = document.querySelectorAll('.exe-iv-results-table tbody tr');
        expect(rows.length).toBe(3);
        expect(rows[0]?.textContent).toContain('Cover');
        expect(document.querySelector('.exe-iv-results-seek[data-iv-seek="5"]')).not.toBeNull();
        expect(document.querySelector('.exe-iv-results-seek[data-iv-seek="65"]')?.textContent).toBe('01:05');
        expect(rows[1]?.querySelector('.exe-iv-results-status')?.textContent).toBe('-');
    });

    it('is collapsed by default', () => {
        document.body.innerHTML = renderResultsHtml(resultsDoc, t);
        const details = document.querySelector('.exe-iv-results-details');
        expect(details).not.toBeNull();
        expect(details?.hasAttribute('open')).toBe(false);
    });

    it('explains what the total requires', () => {
        expect(renderResultsHtml(resultsDoc, t)).toContain('see all the slides and answer all the questions');
    });

    it('is omitted when Show results is off', () => {
        expect(renderResultsHtml(makeDoc({ scorm: { showResults: false } }), t)).toBe('');
    });

    it('lets Custom texts rename the cover row and the table labels', () => {
        const html = renderResultsHtml(
            resultsDoc,
            makeTranslator({ cover: 'Portada', results: 'Resultados', total: 'Suma' }),
        );
        expect(html).toContain('Portada');
        expect(html).toContain('Resultados');
        expect(html).toContain('Suma');
    });
});

describe('renderViewHtml', () => {
    it('always shows the player plus a stable interaction panel', () => {
        document.body.innerHTML = renderViewHtml(makeDoc(), 'iv1', t);
        const stage = document.querySelector('.exe-iv-stage');
        expect(stage?.querySelector('.exe-iv-player-wrap')).not.toBeNull();
        expect(stage?.querySelector('.exe-iv-overlay')).not.toBeNull();
        expect(document.querySelector('.exe-iv-overlay')?.getAttribute('aria-live')).toBe('polite');
    });

    it('identifies the instance by id, and injects no script', () => {
        const html = renderViewHtml(makeDoc(), 'iv1', t);
        expect(html).toContain('id="exe-iv-iv1"');
        expect(html).toContain('data-iv-id="iv1"');
        expect(html).not.toContain('<script');
    });

    it('renders the optional title and description, never before/after wrappers', () => {
        const html = renderViewHtml(
            makeDoc({
                title: 'Mi <vídeo>',
                description: '<p>Intro</p>',
                // Stale fields from a pre-release document: not part of v2 and
                // never rendered (the importer converts them to Text iDevices).
                contentBefore: '<p>Antes</p>',
                contentAfter: '<p>Después</p>',
            } as never),
            'iv1',
            t,
        );
        // The title is plain text (escaped); the description is author HTML.
        expect(html).toContain('<h3 class="exe-iv-title">Mi &lt;vídeo&gt;</h3>');
        expect(html).toContain('<div class="exe-iv-description"><p>Intro</p></div>');
        expect(html).not.toContain('exe-iv-before');
        expect(html).not.toContain('exe-iv-after');
    });
});

describe('renderQuestionHtml', () => {
    it('renders single choice as a labelled radio group with an escaped prompt', () => {
        const html = renderQuestionHtml(
            questionInteraction({ kind: 'singleChoice', prompt: '<img src=x onerror=alert(1)>', answers: [['a', 1]] }),
            'idA',
            t,
        );
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(html).not.toContain('<img src=x onerror=alert(1)>');
        expect(html).toContain('type="radio"');
        expect(html).toContain('class="exe-iv-check"');
    });

    it('renders multiple choice as checkboxes', () => {
        const html = renderQuestionHtml(
            questionInteraction({
                kind: 'multipleChoice',
                prompt: 'Even?',
                answers: [
                    ['Two', 1],
                    ['Three', 0],
                ],
            }),
            'idA',
            t,
        );
        expect(html).toContain('type="checkbox"');
        expect(html).not.toContain('type="radio"');
    });

    it('renders True/False as exactly two labelled radios and no free-text row', () => {
        document.body.innerHTML = renderQuestionHtml(
            questionInteraction({ kind: 'trueFalse', prompt: 'Sky is blue', solution: 1 }),
            'idA',
            t,
        );
        expect(document.querySelectorAll('input[type="radio"]').length).toBe(2);
        expect(document.querySelectorAll('.exe-iv-option input[type="text"]').length).toBe(0);
        expect(document.querySelector('input[value="1"]')).not.toBeNull();
        expect(document.querySelector('input[value="0"]')).not.toBeNull();
    });

    it('renders a dropdown <select> per blank, with the distractors in the pool', () => {
        document.body.innerHTML = renderQuestionHtml(
            questionInteraction({
                kind: 'dropdown',
                prompt: 'Capital is [[Paris]].',
                segments: [
                    { t: 'text', text: 'Capital is ' },
                    { t: 'blank', answers: ['Paris'] },
                    { t: 'text', text: '.' },
                ],
                additionalWords: ['London'],
            }),
            'idA',
            t,
        );
        const select = document.querySelector<HTMLSelectElement>('.exe-iv-dropdown-select');
        expect(select).not.toBeNull();
        const values = Array.from(select?.options ?? []).map(option => option.value);
        expect(values).toContain('Paris');
        expect(values).toContain('London');
        // The empty first option is the "nothing chosen yet" state.
        expect(values[0]).toBe('');
    });

    it('renders a cloze <input> per blank, sized from the longest answer', () => {
        document.body.innerHTML = renderQuestionHtml(
            questionInteraction({
                kind: 'cloze',
                segments: [
                    { t: 'text', text: 'Capital is ' },
                    { t: 'blank', answers: ['Paris'] },
                ],
            }),
            'idA',
            t,
        );
        const input = document.querySelector<HTMLInputElement>('.exe-iv-cloze-input');
        expect(input).not.toBeNull();
        expect(input?.getAttribute('data-cloze-index')).toBe('0');
        expect(input?.getAttribute('size')).toBe('6');
        expect(input?.getAttribute('aria-label')).toBe('Blank 1');
    });

    it('renders one labelled <select> per left item for matchElements', () => {
        document.body.innerHTML = renderQuestionHtml(
            questionInteraction({
                kind: 'matchElements',
                prompt: 'Match',
                pairs: [
                    ['France', 'Paris'],
                    ['Spain', 'Madrid'],
                ],
            }),
            'idA',
            t,
        );
        const selects = document.querySelectorAll('.exe-iv-match-select');
        expect(selects.length).toBe(2);
        expect(document.querySelectorAll('.exe-iv-match-left').length).toBe(2);
        expect(selects[0]?.getAttribute('data-index')).toBe('0');
    });

    it('renders a sortable list with move buttons and no position numbers', () => {
        document.body.innerHTML = renderQuestionHtml(
            questionInteraction({ kind: 'sortableList', prompt: 'Order', items: ['a', 'b', 'c'] }),
            'idA',
            t,
        );
        expect(document.querySelectorAll('.exe-iv-sortable-item').length).toBe(3);
        expect(document.querySelectorAll('.exe-iv-sort-btn').length).toBe(6);
        // The confusing "1 / 2 / 3" indicators are gone — they were especially
        // misleading when the items to order are themselves numbers.
        expect(document.querySelectorAll('.exe-iv-sortable-pos').length).toBe(0);
        for (const item of Array.from(document.querySelectorAll('.exe-iv-sortable-item'))) {
            expect((item.textContent ?? '').replace(/[▲▼\s]/g, '')).not.toMatch(/^\d/);
        }
        // The ends of the list cannot move further out.
        expect(document.querySelector('.exe-iv-sortable-item .exe-iv-sort-up')?.hasAttribute('disabled')).toBe(true);
    });

    it("lets the author's Custom text replace the sortable-list instructions", () => {
        const html = renderQuestionHtml(
            questionInteraction({ kind: 'sortableList', prompt: 'Order', items: ['A', 'B'] }),
            'idA',
            makeTranslator({ sortableListInstructions: 'Coloca las tarjetas en orden' }),
        );
        expect(html).toContain('Coloca las tarjetas en orden');
        expect(html).not.toContain('Use the Move up and Move down buttons');
    });

    it('renders malicious matchElements, sortableList and cloze content inert', () => {
        const payload = '<img src=x onerror=alert(1)>';
        const escaped = '&lt;img src=x onerror=alert(1)&gt;';
        const matchHtml = renderQuestionHtml(
            questionInteraction({ kind: 'matchElements', prompt: payload, pairs: [['a', 'b']] }),
            'idA',
            t,
        );
        expect(matchHtml).toContain(escaped);
        expect(matchHtml).not.toContain(payload);
        const sortHtml = renderQuestionHtml(
            questionInteraction({ kind: 'sortableList', prompt: payload, items: [payload] }),
            'idA',
            t,
        );
        expect(sortHtml).toContain(escaped);
        expect(sortHtml).not.toContain(payload);
        const clozeHtml = renderQuestionHtml(
            questionInteraction({
                kind: 'cloze',
                segments: [
                    { t: 'text', text: payload + ' ' },
                    { t: 'blank', answers: ['a'] },
                ],
            }),
            'idA',
            t,
        );
        expect(clozeHtml).toContain(escaped);
        expect(clozeHtml).not.toContain(payload);
        expect(clozeHtml).toContain('exe-iv-cloze-input');
    });

    it('falls back to the legacy <s>-tag prompt when a question has no segments', () => {
        // Legacy content hydrated at render time may carry only an HTML prompt;
        // the blanks are derived on demand (DOM-based, never a regex).
        expect(
            renderQuestionHtml(questionInteraction({ kind: 'cloze', prompt: 'Capital is <s>Paris</s>.' }), '', t),
        ).toContain('exe-iv-cloze-input');
        expect(
            renderQuestionHtml(
                questionInteraction({ kind: 'dropdown', prompt: 'A <s>one</s> B', additionalWords: ['two'] }),
                '',
                t,
            ),
        ).toContain('exe-iv-dropdown-select');
    });
});

describe('renderInteractionBodyHtml', () => {
    it('renders the cover title as a heading above the cover body, with a Start button', () => {
        const cover: Interaction = {
            id: 'iv-cover',
            type: 'cover',
            time: 0,
            duration: null,
            pause: false,
            title: 'Bienvenida',
            body: '<p>Intro</p>',
        };
        const html = renderInteractionBodyHtml(cover, 'idA', t);
        expect(html).toContain('<h3 class="exe-iv-cover-title">Bienvenida</h3>');
        expect(html.indexOf('Bienvenida')).toBeLessThan(html.indexOf('Intro'));
        expect(html).toContain('>Start</button>');
        // A cover with no title renders no empty heading.
        expect(renderInteractionBodyHtml({ ...cover, title: '' }, 'idA', t)).not.toContain('exe-iv-cover-title');
    });

    it('renders a note with its body and a Continue button', () => {
        const note: NoteInteraction = {
            id: 'n',
            type: 'note',
            time: 5,
            duration: null,
            pause: true,
            body: '<p>Hi</p>',
        };
        const html = renderInteractionBodyHtml(note, 'idA', t);
        expect(html).toContain('<div class="exe-iv-note-body"><p>Hi</p>');
        expect(html).toContain('class="exe-iv-continue"');
    });

    it('gives a timed note no Continue button (it auto-dismisses)', () => {
        const note: NoteInteraction = { id: 'n', type: 'note', time: 5, duration: 3, pause: true, body: '<p>Hi</p>' };
        expect(renderInteractionBodyHtml(note, 'idA', t)).not.toContain('exe-iv-continue');
    });

    it('renders a note image from its asset', () => {
        const note: NoteInteraction = {
            id: 'n',
            type: 'note',
            time: 5,
            duration: null,
            pause: true,
            body: '',
            asset: { assetId: null, url: 'resources/p.jpg', alt: 'Un mapa', width: null, height: null },
        };
        const html = renderInteractionBodyHtml(note, 'idA', t);
        expect(html).toContain('<img class="exe-iv-note-image" src="resources/p.jpg" alt="Un mapa">');
    });

    it('renders a pause with its body and a Continue button', () => {
        const html = renderInteractionBodyHtml(
            { id: 'p', type: 'pause', time: 5, duration: null, pause: true, body: '<p>Espera</p>' },
            'idA',
            t,
        );
        expect(html).toContain('<div class="exe-iv-pause-body"><p>Espera</p></div>');
        expect(html).toContain('class="exe-iv-continue"');
    });

    it('offers a way out of an interaction this view cannot render', () => {
        for (const interaction of [
            { id: 'j', type: 'jump' as const, time: 5, duration: null, pause: false, jump: { toTime: 2 } },
            { id: 'u', type: 'unsupported' as const, time: 5, duration: null, pause: false, originalType: 'weird' },
        ]) {
            const html = renderInteractionBodyHtml(interaction, 'idA', t);
            expect(html).toContain('This interaction type is not supported in this view.');
            expect(html).toContain('class="exe-iv-continue"');
        }
    });

    // Every question kind builds its control ids/names from the interaction id,
    // which is only unique WITHIN one document (`iv-q`). Two videos on one page
    // would collide; the instance id namespaces them apart.
    const KINDS: Record<string, unknown>[] = [
        { kind: 'trueFalse', prompt: 'Q', solution: 1 },
        {
            kind: 'singleChoice',
            prompt: 'Q',
            answers: [
                ['a', 1],
                ['b', 0],
            ],
        },
        {
            kind: 'multipleChoice',
            prompt: 'Q',
            answers: [
                ['a', 1],
                ['b', 0],
            ],
        },
        {
            kind: 'cloze',
            segments: [
                { t: 'text', text: 'x ' },
                { t: 'blank', answers: ['a'] },
            ],
        },
        {
            kind: 'dropdown',
            segments: [
                { t: 'text', text: 'x ' },
                { t: 'blank', answers: ['a'] },
            ],
            additionalWords: ['b'],
        },
        { kind: 'matchElements', prompt: 'Q', pairs: [['a', 'b']] },
        { kind: 'sortableList', prompt: 'Q', items: ['one', 'two'] },
    ];

    for (const question of KINDS) {
        it(`namespaces the "${String(question.kind)}" question controls by instance id`, () => {
            const interaction = questionInteraction(question);
            const a = renderInteractionBodyHtml(interaction, 'idA', t);
            const b = renderInteractionBodyHtml(interaction, 'idB', t);
            // The prompt id is emitted for every kind: namespaced and distinct.
            expect(a).toContain('"idA-iv-q-prompt"');
            expect(b).toContain('"idB-iv-q-prompt"');
            // No un-namespaced control id/name leaks through.
            expect(a).not.toContain('"iv-q-prompt"');
            expect(a).not.toContain('name="iv-q"');
        });
    }

    it('emits a distinct radio-group name per instance (no cross-instance group merge)', () => {
        const interaction = questionInteraction({ kind: 'trueFalse', prompt: 'Q', solution: 1 });
        expect(renderInteractionBodyHtml(interaction, 'idA', t)).toContain('name="idA-iv-q"');
        expect(renderInteractionBodyHtml(interaction, 'idB', t)).toContain('name="idB-iv-q"');
    });

    it('falls back to the raw interaction id when no instance id is given', () => {
        const html = renderInteractionBodyHtml(
            questionInteraction({ kind: 'trueFalse', prompt: 'Q', solution: 1 }),
            '',
            t,
        );
        expect(html).toContain('name="iv-q"');
        expect(html).toContain('"iv-q-prompt"');
    });
});

describe('shuffle', () => {
    it('returns a copy holding exactly the same members', () => {
        const input = ['a', 'b', 'c', 'd'];
        const output = shuffle(input);
        expect(output).not.toBe(input);
        expect(output.slice().sort()).toEqual(['a', 'b', 'c', 'd']);
        expect(input).toEqual(['a', 'b', 'c', 'd']);
    });

    it('degrades to an empty array for a non-array input', () => {
        expect(shuffle(null as unknown as readonly string[])).toEqual([]);
    });
});

describe('shuffleIndices', () => {
    it('returns a permutation of every index', () => {
        const order = shuffleIndices(6);
        expect(order.slice().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('never returns the identity order for more than one item', () => {
        // A "shuffled" list that is already in the correct order would ask the
        // learner to sort something that is already sorted.
        for (let run = 0; run < 20; run++) {
            const order = shuffleIndices(4);
            expect(order.join(',')).not.toBe('0,1,2,3');
        }
    });

    it('handles the degenerate lengths', () => {
        expect(shuffleIndices(0)).toEqual([]);
        expect(shuffleIndices(1)).toEqual([0]);
    });
});

describe('segmentsFor', () => {
    it('uses the stored v2 segments when they are present', () => {
        const segments = [
            { t: 'text' as const, text: 'x ' },
            { t: 'blank' as const, answers: ['a'] },
        ];
        expect(segmentsFor({ kind: 'cloze', prompt: '', score: 1, retry: true, segments })).toBe(segments);
    });

    it('derives segments from a legacy HTML prompt on demand', () => {
        const derived = segmentsFor({
            kind: 'cloze',
            prompt: 'Capital is <s>Paris</s>.',
            score: 1,
            retry: true,
        } as unknown as Question);
        expect(derived.filter(segment => segment.t === 'blank').length).toBe(1);
    });

    it('returns nothing for a missing question', () => {
        expect(segmentsFor(null)).toEqual([]);
        expect(segmentsFor(undefined)).toEqual([]);
    });
});

describe('scopeId', () => {
    it('prefixes an id with the instance id, and is a no-op without one', () => {
        expect(scopeId('idA', 'iv-q')).toBe('idA-iv-q');
        expect(scopeId('', 'iv-q')).toBe('iv-q');
        expect(scopeId(undefined as unknown as string, 'iv-q')).toBe('iv-q');
    });
});

describe('document defaults', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('renders an empty document without throwing', () => {
        const html = renderViewHtml(normalizeV2({}), 'iv1', t);
        expect(html).toContain('This video has no interactive elements.');
        expect(html).toContain('exe-iv-results-table');
    });
});
