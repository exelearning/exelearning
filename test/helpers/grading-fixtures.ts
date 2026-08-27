/**
 * Test Helper: Grading Fixtures
 *
 * Builds REAL exportable eXeLearning projects whose pages carry gradable
 * ("gamification") iDevices with controlled weights and a controlled, known
 * answer key — the input side of the grading trace contract.
 *
 * Everything here is derived from real `<odeComponent>` payloads pulled out of
 * `test/fixtures/todos-los-idevices_dos_informes.elpx`: for each supported type the
 * `htmlView` container markup and the settings payload are copied verbatim from that
 * fixture, then re-keyed per instance. Nothing about the payload shape is invented.
 *
 * Four gradable types are supported: `trueorfalse`, `dragdrop`, `scrambled-list`
 * and `form`. See the per-type docblocks further down — they carry the scoring model,
 * the settings that make scoring deterministic, and the DOM controls a browser
 * recorder must drive.
 *
 * Usage:
 * ```typescript
 * const spec: ProjectSpec = {
 *     title: 'Weighted 25/75',
 *     odeId: 'GRADING-FIXTURE-0001',
 *     pages: [
 *         { id: 'page-1', title: 'Page One', idevices: [{ id: 'ide-a', weighted: 25, questions: 4 }] },
 *         { id: 'page-2', title: 'Page Two', idevices: [{ id: 'ide-b', type: 'dragdrop', weighted: 75, questions: 4 }] },
 *     ],
 * };
 * const document = createGradingDocument(spec, extractedPath);
 * const result = await new Html5Exporter(document, resources, assets, zip).export();
 * ```
 *
 * ## One block per iDevice
 *
 * `populateYDocFromStructure()` (test/helpers/document-test-utils.ts) forces every page
 * into a SINGLE block. That is unusable here for two reasons:
 *
 * 1. The stored `trueorfalse` `htmlView` has 15 `<div` and 14 `</div>` — one unclosed
 *    container (`.exe-trueorfalse-container`). Rendered inside a shared block, the
 *    browser nests every FOLLOWING sibling iDevice inside it, so a multi-iDevice
 *    fixture would silently lose components and corrupt the measurements. (This is a
 *    real, unmerged core bug; PR #2307.)
 * 2. Real projects author one block per iDevice anyway.
 *
 * So this helper populates its own Y.Doc (`populateGradingYDoc()`), one block per
 * gradable iDevice. `PageSpec.sameBlock` puts them all back in one block, so the
 * swallowing scenario can still be built deliberately.
 *
 * ## Shared runtime facts (all four types)
 *
 * Read out of `public/app/common/common.js` and `public/app/common/exe_export.js`:
 *
 * - `exe_export.js` lists `casestudy, file-attachment, form, image-gallery, magnifier,
 *   three-sixty-viewer, trueorfalse, adaptative-quiz` in `jsonOnlyIdevices`. For those,
 *   the stored `htmlView` is REPLACED at runtime by `renderView()` output. `dragdrop`
 *   and `scrambled-list` are NOT on that list: their stored `htmlView` is what the
 *   browser actually shows, and their runtime reads the authored data out of it.
 * - `gamification.scorm.registerActivity(game)` resolves the identity from the DOM:
 *   `game.ideviceId = game.main`'s closest `.idevice_node` id (i.e. `GradableSpec.id`),
 *   `game.title` = that node's `article header .box-title` text, and
 *   `game.ideviceNumber = $('.idevice_node').index($node) + 1` — the PAGE-LOCAL slot
 *   written into `cmi.suspend_data`. `gradingIdeviceOrder()` mirrors that ordering.
 * - `cmi.suspend_data` lines are `N. "<title>"; <msgScore>: <score>%; <msgWeight>: <weight>%`
 *   joined by `'.\t'` (`convertToLineFormat`). The score stored there is
 *   `game.scorerp * 10` (`updateActivity`), and EVERY type computes `scorerp` on a
 *   0..10 scale — so a suspend_data score is 0..100.
 * - `cmi.core.score.raw` is the weighted roll-up of those lines (`getFinalScore`), and
 *   `cmi.core.lesson_status` flips to `passed` at >= 50.
 * - `gamification.helpers.getQuestions(items, percentage, random)` returns the array
 *   UNCHANGED when `percentage >= 100 && !random`. Every type below therefore pins
 *   its percentage to 100 and its random flag to false so the answer key is stable.
 * - `gamification.track('answered', game)` (the xAPI emitter hop) fires from
 *   `sendScoreNew()` regardless of SCORM, but only when `game.gameStarted ||
 *   game.gameOver`.
 *
 * ## The `body.exe-scorm` save guard (Moodle plugin patch)
 *
 * Two of the four types gate their `sendScore()` call on the `exe-scorm` body class,
 * which only a SCORM export carries:
 *
 * - `form.js`      — `if ($('body').hasClass('exe-scorm') && data.isScorm > 0) $form.sendScore(data)`
 * - `scrambled-list.js` — `if (document.body.classList.contains('exe-scorm') && data.isScorm > 0) this.sendScore(...)`
 *
 * `trueorfalse` and `dragdrop` have no such guard: they call `sendScore()` on
 * `isScorm > 0` alone. So in a plain HTML5/web export `form` and `scrambled-list`
 * never persist a score at all (their suspend_data slot stays at the seeded 0), while
 * the other two do. `mod_exelearning`'s
 * `classes/local/scorm/idevice_patch.php` strips exactly those two conditions from the
 * served `form.js` / `scrambled-list.js`. A recorder driving a non-SCORM package MUST
 * apply the same patch, or those two types will look silently unscored.
 */

import * as Y from 'yjs';
import { ServerYjsDocumentWrapper, YjsDocumentAdapter } from '../../src/shared/export';
import type { ExportDocument } from '../../src/shared/export';
import type { ParsedOdeStructure, NormalizedComponent, NormalizedPage } from '../../src/services/xml/interfaces';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** The gradable iDevice types this generator can author. */
export type GradableType = 'trueorfalse' | 'dragdrop' | 'scrambled-list' | 'form';

/** A gradable iDevice to place on a page. */
export interface GradableSpec {
    /** Becomes odeIdeviceId, the settings payload's id AND the .idevice_node element id. */
    id: string;
    /** Defaults to 'trueorfalse'. */
    type?: GradableType;
    /** Per-iDevice weight, written into the type's settings payload as `weighted`. */
    weighted: number;
    /**
     * How many scorable units to author — controls score granularity (10/questions
     * points per hit on the 0..10 `scorerp` scale). Per type that is:
     * trueorfalse = questions, dragdrop = cards, scrambled-list = list items,
     * form = questions.
     */
    questions?: number;
    /** Optional instructions text; defaults to a title derived from `id`. */
    title?: string;
    /**
     * `isTest` (quiz mode) for the trueorfalse payload. Defaults to `true`, the only
     * configuration in which the type can score.
     *
     * With `true` and `time: 0` the questions render immediately, the "Comprobar"
     * button is visible, and clicking it runs `gameOver()` which sets `gameOver = true`
     * and calls `sendScore(true, …)` — one write per check.
     *
     * `false` is a control configuration that can never score: the start button AND
     * the check button are hidden, `startGame()` is unreachable, so `gameStarted` and
     * `gameOver` stay false and `sendScoreNew()`'s `gameStarted || gameOver` guard
     * drops every write — the per-answer `sendScore()` fires and reports nothing. Main
     * warns about exactly this pair (`isScorm > 0 && !isTest`, #2308).
     */
    isTest?: boolean;
    /**
     * Title of THIS iDevice's own block, rendered as `<h1 class="box-title">` and
     * recorded as the suspend_data item title. Falls back to `PageSpec.blockTitle`.
     */
    blockTitle?: string;
}

/** One page of the project. */
export interface PageSpec {
    id: string;
    title: string;
    idevices: GradableSpec[];
    /**
     * Default title for the blocks (`<article>`) on this page, rendered as
     * `<h1 class="box-title">`.
     *
     * This is what the SCORM producer reads for the item title:
     * `common.js#registerActivity` does
     * `game.title = mainElement.closest('article').find('header .box-title').text()`
     * and `convertToLineFormat` writes it into `cmi.suspend_data` as
     * `N. "<title>"; Puntuación: …; Peso: …`. Leave it (and `GradableSpec.blockTitle`)
     * unset and the recorded suspend_data carries an empty title (`1. ""; …`).
     */
    blockTitle?: string;
    /**
     * Put EVERY iDevice of this page in ONE block instead of one block each.
     *
     * Only for building the swallowing scenario on purpose: the stored `trueorfalse`
     * `htmlView` leaves `.exe-trueorfalse-container` unclosed, so any sibling that
     * follows it inside the same block is nested inside it by the HTML parser.
     */
    sameBlock?: boolean;
}

/** The whole project. */
export interface ProjectSpec {
    title: string;
    /**
     * The `<odeIdentifier>`. Without it the exported `window.exeXapi.odeId` is `''`
     * and the emitter falls back to the served URL for its base IRI.
     */
    odeId?: string;
    pages: PageSpec[];
}

/** Default number of scorable units when a spec omits it. */
const DEFAULT_QUESTIONS = 4;

/**
 * Build the ParsedOdeStructure for a grading project.
 *
 * The result is the same shape `createDocumentFromStructure()` consumes, so it can be
 * fed to any existing export test path. It is flat (page -> components); the block
 * grouping lives in `populateGradingYDoc()`.
 */
export function buildGradingStructure(spec: ProjectSpec): ParsedOdeStructure {
    const pages: NormalizedPage[] = spec.pages.map((page, pageIndex) => ({
        id: page.id,
        title: page.title,
        components: page.idevices.map((idevice, order) => buildGradableComponent(idevice, order)),
        level: 0,
        parent_id: null,
        position: pageIndex,
    }));

    return {
        meta: {
            title: spec.title,
            author: 'Grading Fixture',
            language: 'en',
            theme: 'base',
            description: 'Generated by test/helpers/grading-fixtures.ts',
            ...(spec.odeId ? { odeIdentifier: spec.odeId } : {}),
        },
        pages,
        navigation: null,
        raw: null,
    } as unknown as ParsedOdeStructure;
}

/** Build an ExportDocument for a grading project. */
export function createGradingDocument(spec: ProjectSpec, extractedPath: string): ExportDocument {
    return createGradingDocumentWithYDoc(spec, extractedPath).document;
}

/** Same as {@link createGradingDocument}, but also hands back the Y.Doc and structure. */
export function createGradingDocumentWithYDoc(
    spec: ProjectSpec,
    // Kept for signature parity with createDocumentFromStructure(); the Yjs adapter
    // resolves assets through the AssetProvider, not through this path.
    _extractedPath: string,
): { document: ExportDocument; ydoc: Y.Doc; structure: ParsedOdeStructure } {
    const structure = buildGradingStructure(spec);
    const ydoc = new Y.Doc();
    populateGradingYDoc(ydoc, spec);

    const wrapper = new ServerYjsDocumentWrapper(ydoc, 'grading-fixture');
    return { document: new YjsDocumentAdapter(wrapper), ydoc, structure };
}

/**
 * Populate a Y.Doc for a grading project, ONE BLOCK PER GRADABLE IDEVICE.
 *
 * This is deliberately not `populateYDocFromStructure()`: that helper hardcodes a
 * single `block-${page.id}` per page and an empty block name. Here each iDevice gets
 * its own `<article>` (so the unclosed `trueorfalse` container cannot swallow its
 * neighbour) and its own `.box-title` (so the suspend_data item titles are distinct).
 * `PageSpec.sameBlock` restores the one-block-per-page grouping on demand.
 */
export function populateGradingYDoc(ydoc: Y.Doc, spec: ProjectSpec): void {
    const metadata = ydoc.getMap('metadata');
    metadata.set('title', spec.title);
    metadata.set('author', 'Grading Fixture');
    metadata.set('description', 'Generated by test/helpers/grading-fixtures.ts');
    metadata.set('language', 'en');
    metadata.set('license', '');
    metadata.set('theme', 'base');
    metadata.set('keywords', '');
    // Not part of populateYDocFromStructure()'s allow-list; without it xAPI's odeId is ''.
    if (spec.odeId) metadata.set('odeIdentifier', spec.odeId);

    const navigation = ydoc.getArray('navigation');

    spec.pages.forEach((page, pageIndex) => {
        const pageMap = new Y.Map();
        pageMap.set('id', page.id);
        pageMap.set('title', page.title);
        pageMap.set('parentId', null);
        pageMap.set('order', pageIndex);

        const blocksArray = new Y.Array<Y.Map<unknown>>();
        const groups: GradableSpec[][] = page.sameBlock ? [page.idevices] : page.idevices.map(idevice => [idevice]);

        groups.forEach((group, blockIndex) => {
            if (group.length === 0) return;
            const blockMap = new Y.Map();
            blockMap.set('id', `block-${page.id}-${blockIndex + 1}`);
            blockMap.set('name', group[0].blockTitle ?? page.blockTitle ?? '');
            blockMap.set('order', blockIndex);

            const componentsArray = new Y.Array<Y.Map<unknown>>();
            group.forEach((idevice, order) => {
                componentsArray.push([buildComponentYMap(idevice, order)]);
            });
            blockMap.set('components', componentsArray);
            blocksArray.push([blockMap]);
        });

        pageMap.set('blocks', blocksArray);
        navigation.push([pageMap]);
    });
}

/** One component as the Yjs adapter expects to read it back. */
function buildComponentYMap(spec: GradableSpec, order: number): Y.Map<unknown> {
    const component = buildGradableComponent(spec, order) as unknown as {
        id: string;
        type: string;
        content: string;
        order: number;
        jsonProperties: Record<string, unknown>;
        properties: Record<string, string>;
    };

    const compMap = new Y.Map();
    compMap.set('id', component.id);
    compMap.set('type', component.type);
    compMap.set('order', component.order);
    compMap.set('content', component.content);
    // The adapter accepts a JSON string here; that is how ElpxImporter stores it.
    compMap.set('jsonProperties', JSON.stringify(component.jsonProperties));

    const structProps = new Y.Map();
    for (const [key, value] of Object.entries(component.properties)) {
        structProps.set(key, value);
    }
    compMap.set('properties', structProps);

    return compMap;
}

/**
 * The ORDERED `.idevice_node` ids per page, as the exporter will emit them.
 *
 * This is the `pages[].ideviceNodes` field of the trace contract: index i in this
 * array is suspend_data slot i+1 on that page (`$('.idevice_node').index() + 1`).
 */
export function gradingIdeviceOrder(spec: ProjectSpec): string[][] {
    return spec.pages.map(page => page.idevices.map(idevice => idevice.id));
}

// ---------------------------------------------------------------------------
// Answer key
// ---------------------------------------------------------------------------

/** The authored solution for one `trueorfalse` iDevice. */
export interface TrueOrFalseAnswerKey {
    type: 'trueorfalse';
    /** Per question, in authored order: 1 = Verdadero is correct, 0 = Falso is correct. */
    solutions: (0 | 1)[];
}

/** The authored solution for one `dragdrop` iDevice. */
export interface DragDropAnswerKey {
    type: 'dragdrop';
    /**
     * `pairs[i]` is the `data-id` of the target the source card `data-id` i belongs on.
     * The generator authors the identity mapping (card i -> target i), because
     * `moveCard()` scores a drop correct exactly when source `data-id` === target
     * `data-id`.
     */
    pairs: number[];
    /** The authored card labels, indexed by card id. */
    labels: string[];
}

/** The authored solution for one `scrambled-list` iDevice. */
export interface ScrambledListAnswerKey {
    type: 'scrambled-list';
    /**
     * The authored option order — the CORRECT order. The runtime always reshuffles the
     * playable list, so the answer is expressed by `data-orig-index`: an item is right
     * when its `data-orig-index` equals its position in the list.
     */
    order: string[];
}

/** One authored `form` question. */
export interface FormAnswerKeyQuestion {
    /** `data-question-index` on the rendered `li.FormView_question`. */
    index: number;
    activityType: 'true-false';
    /** 1 = Verdadero is correct, 0 = Falso is correct (the radio `value`). */
    answer: 0 | 1;
}

/** The authored solution for one `form` iDevice. */
export interface FormAnswerKey {
    type: 'form';
    questions: FormAnswerKeyQuestion[];
}

export type GradingAnswerKey = TrueOrFalseAnswerKey | DragDropAnswerKey | ScrambledListAnswerKey | FormAnswerKey;

/**
 * The authored answer key, keyed by iDevice id.
 *
 * Every entry is a discriminated union tagged with the iDevice type, so a scenario can
 * compute the expected score BY HAND: answering k of n units correctly gives
 * `scorerp = k * 10 / n` on every type, which lands in `cmi.suspend_data` as
 * `k * 100 / n`.
 */
export function gradingAnswerKey(spec: ProjectSpec): Record<string, GradingAnswerKey> {
    const key: Record<string, GradingAnswerKey> = {};
    for (const page of spec.pages) {
        for (const idevice of page.idevices) {
            const count = idevice.questions ?? DEFAULT_QUESTIONS;
            switch (idevice.type ?? 'trueorfalse') {
                case 'trueorfalse':
                    key[idevice.id] = {
                        type: 'trueorfalse',
                        solutions: buildQuestions(count).map(q => q.solution),
                    };
                    break;
                case 'dragdrop': {
                    const cards = buildCards(count);
                    key[idevice.id] = {
                        type: 'dragdrop',
                        pairs: cards.map((_, index) => index),
                        labels: cards.map(card => card.definition),
                    };
                    break;
                }
                case 'scrambled-list':
                    key[idevice.id] = { type: 'scrambled-list', order: buildListOptions(count) };
                    break;
                case 'form':
                    key[idevice.id] = {
                        type: 'form',
                        questions: buildFormQuestions(count).map((question, index) => ({
                            index,
                            activityType: 'true-false',
                            answer: Number(question.answer) === 1 ? 1 : 0,
                        })),
                    };
                    break;
            }
        }
    }
    return key;
}

// ---------------------------------------------------------------------------
// Component construction
// ---------------------------------------------------------------------------

/** The instance id baked into the ELPX fixture the trueorfalse template was copied from. */
export const TEMPLATE_INSTANCE_ID = '20250605150704MFDSBR';

/** The instance ids of the other three source components in the same ELPX fixture. */
export const TEMPLATE_INSTANCE_IDS: Record<GradableType, string> = {
    'trueorfalse': TEMPLATE_INSTANCE_ID,
    'dragdrop': '20250605150704WPLCGC',
    'scrambled-list': '20250605150704CJUQLN',
    'form': '20250605150704YWTQEJ',
};

/** Build one gradable component (an `<odeComponent>` equivalent) for a page. */
export function buildGradableComponent(spec: GradableSpec, order: number): NormalizedComponent {
    const type: GradableType = spec.type ?? 'trueorfalse';
    const builders: Record<
        GradableType,
        (s: GradableSpec) => { content: string; jsonProperties: Record<string, unknown> }
    > = {
        'trueorfalse': buildTrueOrFalse,
        'dragdrop': buildDragDrop,
        'scrambled-list': buildScrambledList,
        'form': buildForm,
    };
    const builder = builders[type];
    if (!builder) {
        throw new Error(`grading-fixtures: unsupported gradable type '${type}'`);
    }

    const { content, jsonProperties } = builder(spec);
    const component = {
        id: spec.id,
        type,
        content,
        order,
        position: order,
        jsonProperties,
        properties: {
            visibility: 'true',
            teacherOnly: 'false',
            cssClass: '',
        },
    };
    // NormalizedComponent has no `jsonProperties` field, but the Yjs population and
    // populateYDocFromStructure() both read exactly that key off the component.
    return component as unknown as NormalizedComponent;
}

// ===========================================================================
// trueorfalse
// ===========================================================================

/**
 * ## trueorfalse — scoring, settings and DOM controls
 *
 * Runtime: `public/files/perm/idevices/base/trueorfalse/export/trueorfalse.js`.
 *
 * **How the score reaches `cmi.suspend_data`**
 * `sendScore()` sets `scorerp = hits * 10 / questionsGame.length` (0..10) and calls
 * `gamification.scorm.sendScoreNew(true, data)`, which writes `scorerp * 10` (0..100)
 * into this iDevice's suspend_data slot. There is NO `body.exe-scorm` guard: the call
 * fires on `isScorm > 0` alone, so a plain HTML5 export scores.
 *
 * **Achievable values**
 * `questions: n` ⇒ each hit is worth `10/n` on the scorerp scale, i.e. `100/n` in
 * suspend_data. With the default `questions: 4`: 0 / 25 / 50 / 75 / 100.
 *
 * **Settings that make it deterministic and reachable**
 * - `percentageQuestions: 100` + `questionsRandom: false` ⇒ `getQuestions()` returns
 *   the authored array unchanged, in authored order, every run.
 * - `isTest: true` + `time: 0` ⇒ `createInterfaceTrueOrFalse()` hides the start button
 *   (only shown with a countdown) and shows the questions and the "Comprobar" button
 *   immediately; the `.TOFP-Answer` click handler returns early in quiz mode, and
 *   "Comprobar" runs `gameOver()` ⇒ `gameOver = true` ⇒ `sendScore(true)`. One
 *   deterministic SCORM write per check. This is the ONLY pair that can score: with
 *   `isTest: false` the check button is hidden too, `startGame()` is never reached,
 *   and `sendScoreNew()` drops every write behind its `gameStarted || gameOver` guard
 *   (main #2308 warns on `isScorm > 0 && !isTest`). Pass `isTest: false` only to
 *   record that control case.
 * - `time: 0` ⇒ no countdown (`startGame`'s `setInterval` is gated on
 *   `isTest && time > 0`), so nothing runs on a timer.
 * - `evaluation: false` / `evaluationID: ''` ⇒ the "informe" report machinery stays
 *   out of the trace (`addEvents()` only touches it when
 *   `isTest && evaluation && evaluationID.length > 3`).
 * - `isScorm: 1` ⇒ "save automatically after each question". (`2` renders a manual
 *   "Guardar puntuación" button instead; `0` disables reporting.)
 *
 * **DOM controls to answer it**
 * The type is in `exe_export.js`'s `jsonOnlyIdevices`, so the stored `htmlView` is
 * REPLACED by `renderView()` output, and every runtime element id is derived from the
 * `.idevice_node` id (`jsonData.ideviceId = ideviceNode.id`, then
 * `updateConfig()` does `data.id = ideviceId ?? data.ideviceId`). Inside
 * `#tofPMainContainer-<ideviceId>`, question i exposes two `.TOFP-Answer` buttons;
 * clicking the one whose value matches `solutions[i]` is a hit. The container markup
 * below still ships as the stored `htmlView` (re-keyed) because that is what a real
 * project carries.
 */
export const TRUEORFALSE_HTML_TEMPLATE = `<div class="exe-trueorfalse-container">
        <div class="game-evaluation-ids js-hidden" data-id="__INSTANCE__" data-evaluationid="__EVALUATION_ID__"></div>
        <div class="TOFP-instructions"><p>Revisión Final</p></div>
        <div class="TOFP-MainContainer" data-instance="__INSTANCE__" id="tofPMainContainer-__INSTANCE__">
            <div class="TOFP-GameContainer" id="tofPGameContainer-__INSTANCE__">
                <div class="TOFP-GameScoreBoard TOFP-EHidden">
                    <div class="TOFP-TimeNumber">
                        <strong><span class="sr-av">Tiempo por pregunta:</span></strong>
                        <p id="tofPPTime-__INSTANCE__" class="TOFP-PTime">00:00:</p>
                    </div>
                </div>
                <div class="TOFP-MessgeDiv" id="tofPMessageDiv-__INSTANCE__">
                    <div class="TOFP-Message" id="tofPMessage-__INSTANCE__"></div>
                </div>
                <div class="TOFP-StartGameDiv TOFP-EHidden" id="tofPStartGameDiv-__INSTANCE__">
                    <button  id="tofPStartGame-__INSTANCE__" type="button" class="btn btn-primary">Haz clic aquí para empezar</button>
                </div>
                <div class="TOFP-Multimedia " id="tofPMultimedia-__INSTANCE__">
                </div>
            <div class="TOFP-CheckTestDiv " id="tofPCheckTestDiv-__INSTANCE__">
                 <button id="tofPCheckTest-__INSTANCE__" type="button" class="btn btn-primary">Comprobar</button>
                 <button id="tofRebootTest-__INSTANCE__" type="button" class="btn btn-primary TOFP-EHidden">Inténtalo de nuevo</button>
            </div>
        </div>
        <div class="Games-BottonContainer">
            <div class="Games-GetScore">
                <input id="tofPSendScore-__INSTANCE__" type="button" value="Guardar puntuación" class="feedbackbutton Games-SendScore" style="display:none"/> <span class="Games-RepeatActivity"></span>
            </div>
        </div>
        <div class="TOFP-After"></div>
        </div>`;

/** The `msgs` block from the same fixture, verbatim. The runtime reads these keys. */
export const TRUEORFALSE_MSGS: Record<string, string> = {
    'msgStartGame': 'Haz clic aquí para empezar',
    'msgTime': 'Tiempo por pregunta',
    'msgNoImage': 'Sin pregunta de imagen',
    'msgScoreScorm': 'La puntuación no se puede guardar porque esta página no es parte de un paquete SCORM.',
    'msgEndGameScore': 'Por favor, empieza el juego antes de guardar tu puntuación.',
    'msgOnlySaveScore': 'Solo puedes guardar la puntuación una vez!',
    'msgOnlySave': 'Solo puedes guardar una vez',
    'msgYouScore': 'Tu puntuación',
    'msgAuthor': 'Autoría',
    'msgOnlySaveAuto': 'Tu puntuación será guardada después de cada pregunta. Solo puedes jugar una vez.',
    'msgSaveAuto': 'Tu puntuación será guardada automáticamente después de cada pregunta.',
    'msgSeveralScore': 'Puedes guardar tu puntuación las veces que quieras',
    'msgYouLastScore': 'La última puntuación guardada es',
    'msgActityComply': 'Ya has hecho esta actividad.',
    'msgPlaySeveralTimes': 'Puedes hacer esta actividad las veces que quieras. ',
    'msgUncompletedActivity': 'Actividad incompleta',
    'msgSuccessfulActivity': 'Actividad: Aprobada. Puntuación: %s',
    'msgUnsuccessfulActivity': 'Actividad: No aprobada. Puntuación: %s',
    'msgTypeGame': 'VerdaderoOFalso',
    'msgFeedback': 'Retroalimentación',
    'msgSuggestion': 'Sugerencia',
    'msgSolution': 'Solución',
    'msgQuestion': 'Pregunta',
    'msgTrue': 'Verdadero',
    'msgFalse': 'Falso',
    'msgOk': 'Correcto',
    'msgKO': 'Incorrecto',
    'msgShow': 'Mostrar',
    'msgHide': 'Esconder',
    'msgCheck': 'Comprobar',
    'msgReboot': 'Inténtalo de nuevo',
    'msgScore': 'Puntuación',
    'msgWeight': 'Peso',
};

/** A single authored question, in the shape `questionsGame` uses. */
export interface GradingQuestion {
    question: string;
    feedback: string;
    suggestion: string;
    /** 1 = Verdadero is correct, 0 = Falso is correct. */
    solution: 0 | 1;
}

/**
 * Author `count` questions with a deterministic, alternating answer key
 * (V, F, V, F, …). Text is plain and numbered so a browser recorder can target a
 * question by index without depending on wording.
 */
export function buildQuestions(count: number): GradingQuestion[] {
    const questions: GradingQuestion[] = [];
    for (let i = 0; i < count; i++) {
        const solution: 0 | 1 = i % 2 === 0 ? 1 : 0;
        questions.push({
            question: `<p>Q${i + 1}: statement number ${i + 1} is true.</p>`,
            feedback: `<p>Feedback for question ${i + 1}.</p>`,
            suggestion: `<p>Hint for question ${i + 1}.</p>`,
            solution,
        });
    }
    return questions;
}

/**
 * Build the jsonProperties payload for one `trueorfalse` iDevice.
 *
 * Keys and their order match the ELPX fixture exactly; only the instance-specific
 * and scoring-relevant values are replaced.
 */
export function buildTrueOrFalseJsonProperties(spec: GradableSpec): Record<string, unknown> {
    const questionCount = spec.questions ?? DEFAULT_QUESTIONS;
    return {
        id: spec.id,
        typeGame: 'TrueOrFalse',
        eXeGameInstructions: `<p>${spec.title ?? spec.id}</p>`,
        eXeIdeviceTextAfter: '',
        msgs: { ...TRUEORFALSE_MSGS },
        // getQuestions() returns the authored array unchanged only when
        // percentage >= 100 && !random — that is what keeps the answer key stable.
        questionsRandom: false,
        percentageQuestions: 100,
        // Quiz mode with no countdown: questions visible immediately, "Comprobar"
        // visible, and one score write when it is clicked. See GradableSpec.isTest.
        isTest: spec.isTest ?? true,
        time: 0,
        questionsGame: buildQuestions(questionCount),
        // 1 => "save automatically after each question" (the traffic under test).
        isScorm: 1,
        textButtonScorm: 'Guardar puntuación',
        repeatActivity: true,
        weighted: spec.weighted,
        // Keeps the evaluation-report machinery out of the trace.
        evaluation: false,
        evaluationID: '',
        ideviceId: spec.id,
    };
}

function buildTrueOrFalse(spec: GradableSpec): { content: string; jsonProperties: Record<string, unknown> } {
    return {
        content: renderTemplate(spec.id),
        jsonProperties: buildTrueOrFalseJsonProperties(spec),
    };
}

/**
 * Substitute the placeholders in the trueorfalse container markup: the instance id (14
 * occurrences) and the evaluation id, which is blanked to match `evaluationID: ''`.
 */
export function renderTemplate(instanceId: string): string {
    return TRUEORFALSE_HTML_TEMPLATE.replaceAll('__INSTANCE__', instanceId).replaceAll('__EVALUATION_ID__', '');
}

// ===========================================================================
// dragdrop
// ===========================================================================

/**
 * ## dragdrop — scoring, settings and DOM controls
 *
 * Runtime: `public/files/perm/idevices/base/dragdrop/export/dragdrop.js`.
 *
 * **Where the settings live — NOT in jsonProperties**
 * `dragdrop/config.xml` has no `<component-type>`, so `idevice-config.ts` defaults it
 * to `html`: the exporter emits NO `data-idevice-json-data` for this type, and the
 * component's `<jsonProperties>` is empty in the source ELPX too. The whole settings
 * payload — including `weighted` — is authored as JSON text inside
 * `<div class="dragdrop-DataGame js-hidden">` in the `htmlView`, and
 * `loadDataGame()` parses it from there. A test asserting the weight of a dragdrop
 * must read that div, not `data-idevice-json-data`.
 *
 * **How the score reaches `cmi.suspend_data`**
 * `checkState()` → `sendScore(true, instance)` sets
 * `scorerp = hits * 10 / realNumberCards` (0..10) and calls `sendScoreNew`, which
 * stores `scorerp * 10` (0..100). No `body.exe-scorm` guard — the call is gated on
 * `isScorm === 1` only, so a plain HTML5 export scores.
 *
 * **Achievable values**
 * `questions: n` authors n cards ⇒ each correctly-placed card is worth `10/n`
 * (`100/n` in suspend_data). With 4 cards: 0 / 25 / 50 / 75 / 100.
 *
 * **Settings that make it deterministic and reachable**
 * - `type: 1` — the "check button" mode. `type: 0` REJECTS every wrong drop
 *   (`moveCard` returns early unless `id == idt`), so it can only ever end at 100%
 *   and is useless for partial scores. `type: 2` adds a countdown. With `type: 1`,
 *   `addEvents()` auto-starts the game (`type < 2 && !itinerary.showCodeAccess`) and
 *   `checkStateDrags()` counts a card as a hit exactly when its `data-state` is `'0'`.
 * - `randomCards: false` + `percentajeCards: 100` (note the source's spelling) ⇒
 *   `getQuestions()` returns the authored `cardsGame` unchanged, so `card.id` equals
 *   the authored index and the answer key is the identity mapping.
 * - `time: 0` and `itinerary.showCodeAccess: false` ⇒ no timer, no access-code cover
 *   blocking the board.
 * - `typeDrag: 1` ⇒ the DRAGGABLE side carries the card text
 *   (`.DADP-TextSource` gets the `DADP-DS` class) and the targets are the media boxes.
 *   With `typeDrag: 0` the draggables would be the (empty, image-less) media boxes.
 *   Either way both sides carry `data-id`.
 * - `isScorm: 1`, `evaluation: false`, `evaluationID: ''`, `showMinimize: false`.
 *
 * **DOM controls to answer it**
 * Element ids are indexed by the PAGE-GLOBAL dragdrop instance number `i` from
 * `$eXeDragDrop.activities.each(function (i))` — NOT by the iDevice id. So the board of
 * the first dragdrop on a page is `#dadPMainContainer-0`, `#dadPGameContainer-0`, and
 * its check button is `#dadPCheckButton-0`.
 * - source card for card id `k`:  `#dadPDragSourcesContainer-<i> .DADP-DS[data-id="k"]`
 * - target for card id `k`:       `#dadPDragTargetsContainer-<i> .DADP-DragTargetContainer[data-id="k"]`
 * - submit:                       `#dadPCheckButton-<i>` (calls `checkState`, which sends the score)
 * Both containers are reshuffled on every load (`shuffleAds`), so the recorder MUST
 * match on `data-id`, never on position. A real pixel drag works (jQuery UI
 * draggable/droppable), and `$eXeDragDrop.moveCard($source, $target, i)` is the exact
 * function the drop handler calls — usable directly for a deterministic recording.
 */
export const DRAGDROP_MSGS: Record<string, string> = {
    'msgSubmit': 'Enviar',
    'msgClue': 'Bien! La pista es:',
    'msgCodeAccess': 'Código de acceso',
    'msgPlayStart': 'Haz clic aquí para jugar',
    'msgScore': 'Puntuación',
    'msgWeight': 'Peso',
    'msgErrors': 'Errores',
    'msgHits': 'Aciertos',
    'msgMinimize': 'Minimizar',
    'msgMaximize': 'Maximizar',
    'msgFullScreen': 'Pantalla completa',
    'msgExitFullScreen': 'Salir de pantalla completa',
    'msgNoImage': 'Sin pregunta de imagen',
    'msgEndGameScore': 'Por favor, empieza el juego antes de guardar tu puntuación.',
    'msgScoreScorm': 'La puntuación no se puede guardar porque esta página no es parte de un paquete SCORM.',
    'msgOnlySaveScore': 'Solo puedes guardar la puntuación una vez!',
    'msgOnlySave': 'Solo puedes guardar una vez',
    'msgInformation': 'Información',
    'msgYouScore': 'Tu puntuación',
    'msgAuthor': 'Autoría',
    'msgOnlySaveAuto': 'Tu puntuación será guardada después de cada pregunta. Solo puedes jugar una vez.',
    'msgSaveAuto': 'Tu puntuación será guardada automáticamente después de cada pregunta.',
    'msgSeveralScore': 'Puedes guardar tu puntuación las veces que quieras',
    'msgYouLastScore': 'La última puntuación guardada es',
    'msgActityComply': 'Ya has hecho esta actividad.',
    'msgPlaySeveralTimes': 'Puedes hacer esta actividad las veces que quieras. ',
    'msgClose': 'Cerrar',
    'msgAudio': 'Audio',
    'msgNumQuestions': 'Número de tarjetas',
    'msgTryAgain':
        'Necesitas al menos  %s% preguntas correctas para recibir la información. Por favor, escoge de nuevo. ',
    'msgEndGameM': 'Terminaste el juego. Tu puntuación es %s.',
    'msgUncompletedActivity': 'Actividad incompleta',
    'msgSuccessfulActivity': 'Actividad: Aprobada. Puntuación: %s',
    'msgUnsuccessfulActivity': 'Actividad: No aprobada. Puntuación: %s',
    'msgTypeGame': 'Relacionar',
    'msgCheck': 'Comprobar',
    'msgRestart': 'Reempezar',
};

/** One authored dragdrop card, in the shape `cardsGame` uses. */
export interface GradingCard {
    definition: string;
    url: string;
    author: string;
    alt: string;
    audio: string;
}

/**
 * Author `count` cards with no media, numbered so a recorder can read them.
 *
 * `url`/`audio` stay empty: the fixture ships no assets, and `createDrags()` only
 * renders the `<img>`/audio when the source string is longer than 3 chars. `alt`
 * carries the label so the (otherwise blank) target box is still identifiable in the DOM.
 */
export function buildCards(count: number): GradingCard[] {
    const cards: GradingCard[] = [];
    for (let i = 0; i < count; i++) {
        cards.push({
            definition: `Card ${i + 1}`,
            url: '',
            author: '',
            alt: `Card ${i + 1}`,
            audio: '',
        });
    }
    return cards;
}

/**
 * Build the `.dragdrop-DataGame` settings payload for one `dragdrop` iDevice.
 *
 * Keys and their order match the ELPX fixture's DataGame JSON exactly; only the
 * instance-specific and scoring-relevant values are replaced.
 */
export function buildDragDropDataGame(spec: GradableSpec): Record<string, unknown> {
    const cardCount = spec.questions ?? DEFAULT_QUESTIONS;
    return {
        typeGame: 'dragdrop',
        author: '',
        // false + percentajeCards 100 => getQuestions() returns cardsGame unchanged.
        randomCards: false,
        instructions: `<p>${spec.title ?? spec.id}</p>`,
        showMinimize: false,
        itinerary: {
            showClue: false,
            clueGame: '',
            percentageClue: 40,
            // true would drop a code-access cover over the board and block the drags.
            showCodeAccess: false,
            codeAccess: '',
            messageCodeAccess: '',
        },
        cardsGame: buildCards(cardCount),
        isScorm: 1,
        textButtonScorm: 'Guardar la puntuación',
        repeatActivity: true,
        weighted: spec.weighted,
        textAfter: '',
        version: 2,
        percentajeCards: 100,
        // 1 => free placement + explicit "Comprobar"; the only mode with partial scores.
        type: 1,
        mode: 1,
        // 1 => the text side is the draggable one.
        typeDrag: 1,
        showSolution: true,
        timeShowSolution: 3,
        time: 0,
        evaluation: false,
        evaluationID: '',
        id: spec.id,
        msgs: { ...DRAGDROP_MSGS },
    };
}

/**
 * The real `htmlView` container markup for a `dragdrop` component, cloned from the
 * ELPX fixture. The asset `<a class="dragdrop-LinkImages/LinkAudios">` elements are
 * dropped because this fixture authors no media (`loadDataGame()` only reads them when
 * they exist).
 */
function buildDragDrop(spec: GradableSpec): { content: string; jsonProperties: Record<string, unknown> } {
    const dataGame = buildDragDropDataGame(spec);
    const content =
        `<div class="dragdrop-IDevice">` +
        `<div class="game-evaluation-ids js-hidden" data-id="${spec.id}" data-evaluationb="false" data-evaluationid=""></div>` +
        `<div class="dragdrop-instructions gameQP-instructions"><p>${spec.title ?? spec.id}</p></div>` +
        `<div class="dragdrop-DataGame js-hidden">${JSON.stringify(dataGame)}</div>` +
        `<div class="dragdrop-bns js-hidden">Su navegador no es compatible con esta herramienta.</div>` +
        `</div>`;
    // The source component's <jsonProperties> is empty, and the exporter emits no
    // data-idevice-json-data for an html-type component anyway.
    return { content, jsonProperties: {} };
}

// ===========================================================================
// scrambled-list
// ===========================================================================

/**
 * ## scrambled-list — scoring, settings and DOM controls
 *
 * Runtime: `public/files/perm/idevices/base/scrambled-list/export/scrambled-list.js`.
 *
 * **How the score reaches `cmi.suspend_data`**
 * `check()` counts hits with `countRightAnswers()` (an item is a hit when its
 * `data-orig-index` equals its position) and, via `showResultFeedback()`, calls
 * `sendScore(nRight, total, data)` which sets `scorerp = nRight * 10 / total` (0..10)
 * and `sendScoreNew(true, data)` — `scorerp * 10` (0..100) in suspend_data.
 *
 * **⚠ The `body.exe-scorm` save guard**
 * `showResultFeedback()` gates that call on
 * `document.body.classList.contains('exe-scorm') && data.isScorm > 0`.
 * Only a SCORM export carries `body.exe-scorm`, so in an HTML5/web package this type
 * NEVER sends a score and its suspend_data slot stays at the seeded 0. `mod_exelearning`
 * (`classes/local/scorm/idevice_patch.php`) rewrites that exact string in the served
 * `scrambled-list.js` to `data.isScorm > 0`. A recorder must apply the same patch.
 *
 * **Achievable values**
 * `questions: n` authors n list items ⇒ `100/n` per correctly-placed item in
 * suspend_data. With 4 items: 0 / 25 / 50 / 75 / 100. Note `countRightAnswers()` counts
 * absolute positions, so a single swap of two adjacent items costs 2 hits, not 1.
 *
 * **Settings that make it deterministic and reachable**
 * - `isScorm: 1` (the fixture's source component ships `0`, which reports nothing).
 * - `attemptsNumber: 1` ⇒ `pendingAttempts` is decremented to 0 on the first check, so
 *   the retry prompt never appears and the first check is the scoring one. Anything
 *   higher inserts a modal between the click and the score.
 * - `time: 0`, `showSolutions: true`, `repeatActivity: true` (forced by `updateConfig`).
 * - `evaluation: false` / `evaluationID: ''` keep the report machinery out.
 * - The list order CANNOT be pinned: `enableList()` always calls `randomizeArray()`,
 *   which recurses until the order actually differs from the authored one. The answer
 *   is therefore always expressed through `data-orig-index`, never through the
 *   authored order.
 *
 * **DOM controls to answer it**
 * The type is NOT in `jsonOnlyIdevices`, so the stored `htmlView` below is what ships;
 * `enableList()` requires exactly one `<ul>` inside `.exe-sortableList` and rebuilds it
 * as `#exe-sortableList-<listOrder>`, where `listOrder` is the PAGE-GLOBAL index from
 * `$('.exe-sortableList').each(function (instance))` — not the iDevice id.
 * - items:  `#exe-sortableList-<listOrder> li[data-orig-index="k"]`
 * - reorder: drag (html5sortable) or the per-item arrows
 *   `a.exe-sortableList-sort-<from>_<to>_<listOrder>` (`.up` / `.down`), which the
 *   runtime re-renders after every move
 * - submit: `#exe-sortableListButton-<listOrder> input[type=button]`
 * To answer correctly: reorder until every `li`'s `data-orig-index` equals its index.
 * `check()` re-reads the settings from the `.idevice_node`'s `data-idevice-json-data`
 * attribute, so that attribute must be present (it is: `component-type` is `json`).
 */
export const SCRAMBLEDLIST_MSGS: Record<string, string> = {
    'msgScoreScorm': 'La puntuación no se puede guardar porque esta página no es parte de un paquete SCORM.',
    'msgYouScore': 'Tu puntuación',
    'msgScore': 'Puntuación',
    'msgWeight': 'Peso',
    'msgYouLastScore': 'La última puntuación guardada es',
    'msgOnlySaveScore': 'Solo puedes guardar la puntuación una vez!',
    'msgOnlySave': 'Solo puedes guardar una vez',
    'msgOnlySaveAuto': 'Tu puntuación será guardada después de cada pregunta. Solo puedes jugar una vez.',
    'msgSaveAuto': 'Tu puntuación será guardada automáticamente después de cada pregunta.',
    'msgSeveralScore': 'Puedes guardar tu puntuación las veces que quieras',
    'msgPlaySeveralTimes': 'Puedes hacer esta actividad las veces que quieras. ',
    'msgActityComply': 'Ya has hecho esta actividad.',
    'msgUncompletedActivity': 'Actividad incompleta',
    'msgSuccessfulActivity': 'Actividad: Aprobada. Puntuación: %s',
    'msgUnsuccessfulActivity': 'Actividad: No aprobada. Puntuación: %s',
    'msgTypeGame': 'ListaRevuelta',
    'msgStartGame': 'Haz clic aquí para empezar',
    'msgSubmit': 'Enviar',
    'msgPlayStart': 'Haz clic aquí para jugar',
    'msgTime': 'Tiempo por pregunta',
    'msgCheck': 'Comprobar',
    'msgSaveScore': 'Guardar puntuación',
};

/** Author `count` list items, numbered so the correct order is obvious. */
export function buildListOptions(count: number): string[] {
    const options: string[] = [];
    for (let i = 0; i < count; i++) {
        options.push(`Step ${i + 1}`);
    }
    return options;
}

/** Build the jsonProperties payload for one `scrambled-list` iDevice. */
export function buildScrambledListJsonProperties(spec: GradableSpec): Record<string, unknown> {
    const optionCount = spec.questions ?? DEFAULT_QUESTIONS;
    return {
        typeGame: 'ScrambledList',
        instructions: `<p>${spec.title ?? spec.id}</p>`,
        textAfter: '',
        afterElement: '',
        options: buildListOptions(optionCount),
        time: 0,
        buttonText: 'Comprobar',
        rightText: 'Correcto!',
        wrongText: 'Lo siento... La respuesta correcta es:',
        // The fixture ships 0 (no reporting); 1 is what puts a score on the wire.
        isScorm: 1,
        textButtonScorm: 'Guardar puntuación',
        repeatActivity: true,
        weighted: spec.weighted,
        evaluation: false,
        evaluationID: '',
        main: `sl${spec.id}`,
        msgs: { ...SCRAMBLEDLIST_MSGS },
        scorerp: 0,
        idevice: 'idevice_node',
        id: spec.id,
        // 1 => pendingAttempts hits 0 on the first check, so no retry prompt.
        attemptsNumber: 1,
        showSolutions: true,
        ideviceId: spec.id,
    };
}

function buildScrambledList(spec: GradableSpec): { content: string; jsonProperties: Record<string, unknown> } {
    const options = buildListOptions(spec.questions ?? DEFAULT_QUESTIONS);
    const items = options.map(option => `<li>${option}</li>`).join('');
    const content =
        `<div class="exe-sortableList" id="sl${spec.id}" scorm=false>` +
        `<div class="game-evaluation-ids js-hidden" data-id="${spec.id}" data-evaluationid=""></div>` +
        `<div class="exe-sortableList-instructions"><p>${spec.title ?? spec.id}</p></div>` +
        `<ul class="exe-sortableList-list">${items}</ul>` +
        `<div style="display:none"><p class="exe-sortableList-buttonText">Comprobar</p>` +
        `<p class="exe-sortableList-rightText">Correcto!</p>` +
        `<p class="exe-sortableList-wrongText">Lo siento... La respuesta correcta es:</p></div>` +
        `<div class="exe-scorm-message"></div>` +
        `</div>`;
    return { content, jsonProperties: buildScrambledListJsonProperties(spec) };
}

// ===========================================================================
// form
// ===========================================================================

/**
 * ## form — scoring, settings and DOM controls
 *
 * Runtime: `public/files/perm/idevices/base/form/export/form.js`.
 *
 * **How the score reaches `cmi.suspend_data`**
 * The "Comprobar" button calls `gameOver(data)` → `checkAllQuestions(data)`, which
 * walks every `.FormView_question` and increments `data.totalQuestions` /
 * `data.rightQuestions`. Then `sendScore(data)` sets
 * `scorerp = rightQuestions * 10 / totalQuestions` (0..10) and `sendScoreNew(true, data)`
 * stores `scorerp * 10` (0..100).
 *
 * **⚠ The `body.exe-scorm` save guard**
 * `gameOver()` gates that call on `$('body').hasClass('exe-scorm') && data.isScorm > 0`.
 * As with `scrambled-list`, a plain HTML5/web export never scores; `mod_exelearning`'s
 * `idevice_patch.php` rewrites that exact string in the served `form.js` to
 * `data.isScorm > 0`. A recorder must apply the same patch.
 *
 * **Achievable values**
 * `questions: n` ⇒ `100/n` per correct question in suspend_data. With 4: 0/25/50/75/100.
 * An unanswered question counts as wrong (`checkQuestionTrueFalse` increments
 * `wrongQuestions` when nothing is checked), so `totalQuestions` is always n and the
 * denominator never moves.
 *
 * **Settings that make it deterministic and reachable**
 * - `percentageQuestions: '100'` + `questionsRandom: false` ⇒ `getQuestions()` returns
 *   the authored `questionsData` unchanged. (The fixture stores the percentage as a
 *   STRING; `>= 100` still holds, and this clone keeps the fixture's shape.)
 * - `time: '0'` ⇒ no countdown and no "Haz clic aquí para empezar" gate
 *   (`renderView` shows the start block only when `time > 0`).
 * - `showSlider` unset/false ⇒ every question is rendered on one page
 *   (`generatePage`), not one per slide, so no navigation is needed.
 * - `isScorm: 1`, `evaluation: false`, `evaluationID: ''`.
 * - `passRate: 5` only decides the pass/fail sentence; `showScore(50, data)` is
 *   hardcoded at the call site and does not affect `scorerp`.
 * - This generator authors ONLY `true-false` questions. The real fixture also carries
 *   `selection` (single and multiple); those work, but their correct option indices
 *   live in a hidden `#SelectionAnswer_<randomId>` span, which makes a recorder's job
 *   harder for no extra coverage of the scoring path.
 *
 * **DOM controls to answer it**
 * The type IS in `jsonOnlyIdevices`, so the stored `htmlView` is replaced by
 * `renderView()`. Container ids are keyed by the iDevice id
 * (`#frmMainContainer-<ideviceId>`, `#form-button-check-<ideviceId>`), but the
 * per-question ids are `generateRandomId()` output — never reproducible. Target
 * questions structurally instead:
 * - question i: `#frmMainContainer-<id> li.FormView_question[data-question-index="i"]`
 * - answer:     that `li`'s `.true-false-radio-buttons-container input[value="1"]`
 *   (Verdadero) or `input[value="0"]` (Falso); the correct one is `answer` in the key
 * - submit:     `#form-button-check-<ideviceId>`
 * The correct answer is also readable off the DOM as
 * `li .true-false-radio-buttons-container[data-answer]`.
 */
export const FORM_MSGS: Record<string, string> = {
    'msgScoreScorm': 'La puntuación no se puede guardar porque esta página no es parte de un paquete SCORM.',
    'msgYouScore': 'You scores is',
    'msgScore': 'Puntuación',
    'msgWeight': 'Weight',
    'msgYouLastScore': 'La última puntuación guardada es',
    'msgOnlySaveScore': 'Solo puedes guardar la puntuación una vez!',
    'msgOnlySave': 'Solo puedes guardar una vez',
    'msgOnlySaveAuto': 'Tu puntuación será guardada después de cada pregunta. Solo puedes jugar una vez.',
    'msgSaveAuto': 'Tu puntuación será guardada automáticamente después de cada pregunta.',
    'msgSeveralScore': 'Puedes guardar tu puntuación las veces que quieras',
    'msgPlaySeveralTimes': 'Puedes hacer esta actividad las veces que quieras. ',
    'msgActityComply': 'Ya has hecho esta actividad.',
    'msgUncompletedActivity': 'Actividad incompleta',
    'msgSuccessfulActivity': 'Actividad: Aprobada. Puntuación: %s',
    'msgUnsuccessfulActivity': 'Actividad: No aprobada. Puntuación: %s',
    'msgTypeGame': 'Formulario',
    'msgStartGame': 'Haz clic aquí para empezar',
    'msgTime': 'Tiempo por pregunta',
    'msgSaveScore': 'Guardar puntuación',
    'msgResult': 'Resultado',
    'msgCheck': 'Comprobar',
    'msgReset': 'Reiniciar',
    'msgShowAnswers': 'Mostrar respuestas',
    'msgTestResultPass': '¡Felicidades! Has pasado la prueba',
    'msgTestResultNotPass': 'Lo siento. Has fallado la prueba',
    'msgTrueFalseHelp': 'Seleccione si la afirmación es verdadera o falsa',
    'msgDropdownHelp': 'Elige la respuesta correcta entre las opciones propuestas',
    'msgFillHelp': 'Completa los espacios en blanco con la palabra adecuada',
    'msgSingleSelectionHelp': 'Opción múltiple con una sola respuesta correcta',
    'msgMultipleSelectionHelp': 'Opción múltiple con múltiples respuestas correctas',
    'msgPlayStart': 'Haz clic aquí para empezar',
    'msgTrue': 'Verdadero',
    'msgFalse': 'Falso',
};

/** One authored form question, in the shape `questionsData` uses. */
export interface GradingFormQuestion {
    activityType: 'true-false';
    baseText: string;
    /** '1' = Verdadero is correct, '0' = Falso is correct. Stored as a string, as in the fixture. */
    answer: string;
}

/**
 * Author `count` true/false form questions with the same alternating key as
 * `buildQuestions()` (V, F, V, F, …), numbered for a recorder.
 */
export function buildFormQuestions(count: number): GradingFormQuestion[] {
    const questions: GradingFormQuestion[] = [];
    for (let i = 0; i < count; i++) {
        questions.push({
            activityType: 'true-false',
            baseText: `<p>Q${i + 1}: statement number ${i + 1} is true.</p>`,
            answer: i % 2 === 0 ? '1' : '0',
        });
    }
    return questions;
}

/** Build the jsonProperties payload for one `form` iDevice. */
export function buildFormJsonProperties(spec: GradableSpec): Record<string, unknown> {
    const questionCount = spec.questions ?? DEFAULT_QUESTIONS;
    return {
        ideviceId: spec.id,
        evaluation: false,
        evaluationID: '',
        repeatActivity: true,
        isScorm: 1,
        textButtonScorm: 'Guardar puntuación',
        weighted: spec.weighted,
        msgs: { ...FORM_MSGS },
        id: spec.id,
        questionsRandom: false,
        // String, exactly as the fixture stores it; getQuestions() compares >= 100.
        percentageQuestions: '100',
        time: '0',
        eXeFormInstructions: `<p>${spec.title ?? spec.id}</p>`,
        questionsData: buildFormQuestions(questionCount),
        passRate: 5,
        addBtnAnswers: true,
        eXeIdeviceTextAfter: '',
    };
}

/**
 * The real `htmlView` container markup for a `form` component, cloned from the ELPX
 * fixture with every instance-specific id re-keyed. `renderView()` replaces it at
 * runtime, but a real project stores it, so the fixture does too.
 */
export const FORM_HTML_TEMPLATE = `<div class="exe-form-container"><div class="game-evaluation-ids js-hidden" data-id="__INSTANCE__" data-evaluationid=""></div>

            <div id="frmMainContainer-__INSTANCE__" class="form-IDevice" data-id="__INSTANCE__">
                <div class="form-Data js-hidden">{}</div>
                <div class="form-instructions"><p>__INSTRUCTIONS__</p></div>
                <div class="FRMP-GameScoreBoard" style="display:none;">
                    <div>
                        <strong><span class="sr-av">Tiempo por pregunta:</span></strong>
                        <span id="frmPTime-__INSTANCE__">00:00</span>
                    </div>
                </div>
                <div class="FRMP-StartGame" id="frmStartGameDiv-__INSTANCE__" style="display:none;">
                      <button  id="frmStartGame-__INSTANCE__" type="button" class="btn btn-primary">Haz clic aquí para empezar</button>
                </div>
                <div class="form-body" id="frmBody-__INSTANCE__" style="display:hide;">
                    <div class="FRMP-Questions">
                        <div id="form-questions-__INSTANCE__" > </div>
                        <div id="frmCover-__INSTANCE__" class="FRMP-Cover"> </div>
                    </div>

                    <div id="resultsContainer-__INSTANCE__" class="form-results-container inline">
                        <div id="form-score-__INSTANCE__" class="score-text">Puntuación.</div>
                        <div id="form-result-test-__INSTANCE__" class="score-text phrase-score"></div>
                    </div>
                    <div class="form-buttons-container inline">
                        <input id="form-button-check-__INSTANCE__" class="btn btn-primary" type="button" value="Comprobar"
                            data-id="__INSTANCE__" pass-rate="" />
                        <input id="form-button-reset-__INSTANCE__" type="button" value="Reiniciar"
                            data-id="__INSTANCE__" class="btn btn-primary"  style="display:none" />
                        <input id="form-button-show-answers-__INSTANCE__" class="btn btn-primary" type="button" value="Mostrar respuestas"
                            data-id="__INSTANCE__" style="display: " />
                    </div>
                </div>
                <div class="Games-BottonContainer">
                    <div class="Games-GetScore">
                        <input id="frmPSendScore-__INSTANCE__" type="button" value="Guardar puntuación" class="feedbackbutton Games-SendScore" style="display:none"/> <span class="Games-RepeatActivity"></span>
                    </div>
                </div>
                <div class="form-instructions"></div>
            </div></div>`;

function buildForm(spec: GradableSpec): { content: string; jsonProperties: Record<string, unknown> } {
    const content = FORM_HTML_TEMPLATE.replaceAll('__INSTANCE__', spec.id).replaceAll(
        '__INSTRUCTIONS__',
        spec.title ?? spec.id,
    );
    return { content, jsonProperties: buildFormJsonProperties(spec) };
}
