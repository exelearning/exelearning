import { test, expect } from '../../fixtures/auth.fixture';
import type { Locator, Page } from '@playwright/test';
import {
    addIdevice,
    dismissVersionNotice,
    editIdevice,
    expandIdeviceCategory,
    gotoWorkarea,
    reloadPage,
    saveIdevice,
    saveProject,
    selectFirstPage,
    waitForAppReady,
} from '../../helpers/workarea-helpers';
import { waitForEditor } from '../../helpers/editor-helpers';
import { importText } from '../../helpers/idevice-share-helpers';

/**
 * The helps of each iDevice form, one test per iDevice: where each help sits, that its explanation opens
 * inside the panel and that reading it leaves the form as it was; then that the form saves without them and
 * opens again with them. How the help itself behaves (tooltip, focus, keyboard, one open at a time) is
 * checked once, in idevice-help.spec.ts. What else each form does is in the spec of its iDevice.
 */
interface Area {
    /** The tab the helps are in. */
    tab: string;
    /** Where they are. */
    scope: string;
    /** How many are shown as the form opens. */
    helps: number;
    /** How many, once each of these options is chosen, in this order: an option can show rows of its own. */
    variants?: Record<string, number>;
}

interface HelpCase {
    type: string;
    name: string;
    /** The id the shared tabs of the form are built with. */
    form: string;
    areas: Area[];
    /** Requests to refuse: what the form would load from outside and the test does not need. */
    block?: string[];
    /** Adds the iDevice, when the menu item is not enough. */
    add?: (page: Page) => Promise<void>;
    /** What the activity needs to be saved, beyond the fields in `keeps`. */
    prepare?: (page: Page) => Promise<void>;
    /** Fields set before saving, then expected after reopening: checked or not, or a value. */
    keeps: Record<string, boolean | string>;
    /** Marks the saved activity. */
    stored?: string;
    /** For rows whose help explains several options: what it says about each. */
    explains?: Record<string, string[]>;
    /** Done after reopening the activity, before checking it. */
    reopen?: (page: Page) => Promise<void>;
}

const YOUTUBE_API = 'https://www.youtube.com/iframe_api';

/** Writes in a TinyMCE editor of the form. */
async function write(page: Page, editor: string, html: string) {
    await waitForEditor(page, editor);
    await page.evaluate(([id, content]) => (window as any).tinymce.get(id).setContent(content), [editor, html]);
}

const CASES: HelpCase[] = [
    {
        type: '3dmol',
        name: '3Dmol',
        form: 'dMoleIdeviceForm',
        add: async page => {
            await addIdevice(page, '3dmol');
            await page.locator('#dMoleIdeviceForm').waitFor({ state: 'visible', timeout: 15000 });
            await dismissVersionNotice(page);
            // The form preloads its bundled default model and rebuilds the model row when it lands.
            await expect(page.locator('#dmoleModelFileName')).not.toBeEmpty({ timeout: 20000 });
        },
        areas: [{ tab: 'options', scope: '#dmoleOptions', helps: 8 }],
        keeps: { '#dmoleQuestionsRandom': true, '#dmolePercentajeQuestionsValue': '80' },
        stored: 'dmole-DataGame',
        reopen: dismissVersionNotice,
    },
    {
        type: 'adaptative-quiz',
        name: 'Adaptative quiz',
        form: 'adaptativeQuizIdeviceForm',
        areas: [{ tab: 'options', scope: '#adaptativeQuizEOptions', helps: 9 }],
        // Two questions in each of the three levels.
        prepare: async page => {
            await page.locator('#adaptativeQuizIdeviceForm-tab-contents').click();
            await importText(
                page,
                'questions.txt',
                [
                    '0@0#A#Which is a star?#Sun#Moon',
                    '0@0#B#Which is a planet?#Sun#Mars',
                    '0@1#A#How much is 2+2?#4#5',
                    '0@1#B#How much is 3+3?#5#6',
                    '0@2#A#Capital of France?#Paris#Rome',
                    '0@2#B#Capital of Italy?#Paris#Rome',
                    '',
                ].join('\n'),
            );
        },
        keeps: {
            '#adaptativeQuizShuffle': false,
            '#adaptativeQuizCaseSensitive': true,
            '#adaptativeQuizETime': '5',
            '#adaptativeQuizNumRound': '4',
        },
    },
    {
        type: 'az-quiz-game',
        name: 'A-Z quiz',
        form: 'roscoIdeviceForm',
        areas: [{ tab: 'options', scope: '#roscoOptions', helps: 6 }],
        keeps: {
            '.roscoWordEdition': 'Apple',
            '.roscoDefinitionEdition': 'A fruit that grows on trees',
            '#roscoDuration': '120',
            '#roscoNumberTurns': '0',
            '#roscoCaseSensitive': true,
            '#roscoShowSolution': false,
        },
        stored: 'rosco-DataGame',
        explains: { '#roscoShowSolution': ['Show solutions:', 'Show solution in:'] },
    },
    {
        type: 'beforeafter',
        name: 'BeforeAfter',
        form: 'beforeAfterQIdeviceForm',
        // Its only helps are the settings of each card.
        areas: [{ tab: 'contents', scope: '#bfafEPanel', helps: 2 }],
        prepare: async page => {
            await page.locator('#bfafEURLImageBack').fill('before.jpg');
            await page.locator('#bfafEURLImage').fill('after.jpg');
        },
        keeps: { '#bfafEDescription': 'City view comparison' },
        stored: 'beforeafter-DataGame',
    },
    {
        type: 'challenge',
        name: 'Challenge',
        form: 'desafioIdeviceForm',
        // The type and the time sit under the challenge's title and solution, in Activities.
        areas: [
            { tab: 'options', scope: '#desafioEOptions', helps: 1 },
            { tab: 'contents', scope: '#desafioSelects', helps: 2 },
        ],
        // The final challenge, then its only trial; back to the challenge, where the type and the time are.
        prepare: async page => {
            await page.locator('#desafioIdeviceForm-tab-contents').click();
            await page.locator('#desafioEDSolution').fill('OPEN');
            await write(page, 'desafioEDescription', '<p>Open the vault</p>');
            await page.locator('label[for="desafioEReto"]').click();
            await page.locator('#desafioECTitle').fill('Lock');
            await page.locator('#desafioECSolution').fill('KEY');
            await write(page, 'desafioEChallenge-0', '<p>Find the key</p>');
            await page.locator('label[for="desafioEDesafio"]').click();
        },
        keeps: {
            '#desafioEShowMinimize': true,
            '#desafioEDType': '1',
            '#desafioEDTime': '60',
            '#desafioEDTitle': 'The vault',
        },
        stored: 'desafio-DataGame',
    },
    {
        type: 'checklist',
        name: 'Checklist',
        form: 'gameQEIdeviceForm',
        areas: [{ tab: 'options', scope: '#ctjEOptions', helps: 7 }],
        prepare: async page => {
            await page.locator('#gameQEIdeviceForm-tab-contents').click();
            await page.locator('.CTJ-data-row .CTJ-Level1').first().click();
            await page.keyboard.type('Read the text');
        },
        keeps: { '#ctjUserData': true, '#ctjLogo': true, '#ctjTitle': 'My tasks' },
        stored: 'listacotejo-DataGame',
    },
    {
        type: 'classify',
        name: 'Classify',
        form: 'clasificaQEIdeviceForm',
        areas: [{ tab: 'options', scope: '#clasificaEOptions', helps: 7 }],
        prepare: async page => {
            await page.locator('#clasificaEMediaText').check();
            await page.locator('#clasificaEText').fill('Card text 1');
        },
        keeps: { '#clasificaEShowMinimize': true, '#clasificaEText': 'Card text 1' },
        stored: 'clasifica-DataGame',
    },
    {
        type: 'complete',
        name: 'Complete',
        form: 'completeQEIdeviceForm',
        areas: [{ tab: 'options', scope: '#cmptEOptions', helps: 11 }],
        keeps: { '#cmptEShowMinimize': true },
        stored: 'completa-DataGame',
    },
    {
        type: 'crossword',
        name: 'Crossword',
        form: 'ccgmQEIdeviceForm',
        areas: [{ tab: 'options', scope: '#ccgmEOptions', helps: 8 }],
        prepare: async page => {
            await page.locator('#ccgmESolutionWord').fill('EARTH');
            await page.locator('#ccgmEDefinitionWord').fill('Our home planet');
            await page.locator('#ccgmEAdd').click();
            await page.locator('#ccgmESolutionWord').fill('MOON');
            await page.locator('#ccgmEDefinitionWord').fill('Earth natural satellite');
        },
        keeps: { '#ccgmECaseSensitive': true, '#ccgmETime': '15' },
        stored: 'crucigrama-DataGame',
    },
    {
        type: 'discover',
        name: 'Discover',
        form: 'descubreQEIdeviceForm',
        areas: [{ tab: 'options', scope: '#descubreEOptions', helps: 11 }],
        keeps: { '#descubreEText-0': 'Card 1', '#descubreEText-1': 'Card 2', '#descubreEShowMinimize': true },
        stored: 'descubre-DataGame',
    },
    {
        type: 'dragdrop',
        name: 'Dragdrop',
        form: 'dragdropQIdeviceForm',
        // The time is asked only in the Advanced level.
        areas: [{ tab: 'options', scope: '#dragdropEOptions', helps: 4, variants: { '#dadETypeIdentify': 5 } }],
        // A card: its text and the image it is matched with.
        prepare: page => page.locator('#dadEURLImage').fill('item.png'),
        keeps: { '#dadEDefinition': 'Target item 1', '#dadEShowMinimize': true, '#dadETypeIdentify': true },
        stored: 'dragdrop-DataGame',
    },
    {
        type: 'electrical-circuits',
        name: 'Electrical circuits',
        form: 'electricalCircuitsIdeviceForm',
        add: async page => {
            await expandIdeviceCategory(page, /Science|Ciencia/i);
            const item = page.locator('.idevice_item[id="electrical-circuits"]').first();
            await item.waitFor({ state: 'visible', timeout: 10000 });
            await item.click();
            await page.locator('#electricalCircuitsIdeviceForm').waitFor({ state: 'visible', timeout: 15000 });
            await dismissVersionNotice(page);
        },
        areas: [{ tab: 'options', scope: '#elceOptions', helps: 8 }],
        prepare: async page => {
            await page.locator('#electricalCircuitsIdeviceForm-tab-contents').click();
            await page.locator('#elceTikzCode').fill('');
        },
        keeps: { '#elceQuestionsRandom': true, '#elcePercentajeQuestionsValue': '80' },
        stored: 'electrical-circuits-DataGame',
        reopen: dismissVersionNotice,
    },
    {
        type: 'flipcards',
        name: 'Flipcards',
        form: 'flipcardsQEIdeviceForm',
        // The time and the back image are asked only in the Memory type.
        areas: [{ tab: 'options', scope: '#flipcardsEOptions', helps: 4, variants: { '#flipcardsETypeMemory': 6 } }],
        keeps: {
            '#flipcardsEText': 'Front card text',
            '#flipcardsETextBack': 'Back card text',
            '#flipcardsEShowMinimize': true,
            '#flipcardsETypeMemory': true,
        },
        stored: 'flipcards-DataGame',
    },
    {
        type: 'form',
        name: 'Form',
        form: 'formIdeviceForm',
        add: async page => {
            await addIdevice(page, 'form');
            await waitForEditor(page, 'eXeGameInstructions');
        },
        areas: [{ tab: 'options', scope: '#frmEOptions', helps: 5 }],
        prepare: async page => {
            await page.locator('#formIdeviceForm-tab-contents').click();
            await importText(page, 'questions.txt', '1#The Sun is a star\n0#The Moon is a planet\n');
        },
        keeps: {
            '#checkAddBtnAnswers': false,
            '#frmEShowSlider': true,
            '#frmEQuestionsRandom': true,
            '#frmETime': '5',
            '#frmEPercentageQuestions': '50',
        },
        reopen: page => waitForEditor(page, 'eXeGameInstructions'),
    },
    {
        type: 'geogebra-activity',
        name: 'GeoGebra activity',
        form: 'eXeAutoGeogebraForm',
        areas: [{ tab: 'options', scope: '#eXeAutoGeogebraOptions', helps: 18 }],
        prepare: async page => {
            await page.locator('#eXeAutoGeogebraForm-tab-contents').click();
            await page.locator('#geogebraActivityURL').fill('VgHhQXCC');
        },
        keeps: { '#geogebraActivityshowMenuBar': true, '#geogebraActivityLang': 'fr' },
        stored: 'language-fr',
    },
    {
        type: 'guess',
        name: 'Guess',
        form: 'gameQEIdeviceForm',
        // The form is built when its question editor starts: wait, or what is typed first is lost.
        add: async page => {
            await addIdevice(page, 'guess');
            await waitForEditor(page, 'adivinaEText');
        },
        areas: [{ tab: 'options', scope: '#adivinaEOptions', helps: 10 }],
        keeps: {
            '#adivinaESolutionWord': 'planet',
            '#adivinaEDefinitionWord': 'A world orbiting a star',
            '#adivinaEOptionsRamdon': true,
        },
        stored: 'adivina-DataGame',
    },
    {
        type: 'hidden-image',
        name: 'Hidden image',
        form: 'hiQEIdeviceForm',
        // The question picture is never fetched for real.
        block: ['https://example.com/**'],
        areas: [{ tab: 'options', scope: '#hiEOptions', helps: 6 }],
        prepare: page => page.locator('#hiEURLImage').fill('https://example.com/picture.png'),
        keeps: {
            '#hiEQuestion': 'What is in the picture?',
            '#hiEOption0': 'A cat',
            '#hiEOption1': 'A dog',
            '#hiEOption2': 'A bird',
            '#hiEOption3': 'A fish',
            '#hiEShowMinimize': true,
            '#hiERevealTime': '5',
        },
        stored: 'hiddenimage-DataGame',
    },
    {
        type: 'identify',
        name: 'Identify',
        form: 'identifyQEIdeviceForm',
        areas: [{ tab: 'options', scope: '#idfEOptions', helps: 6 }],
        keeps: {
            '#idfEQuestion': 'Who am I?',
            '#idfESolution': 'Mercury',
            '#idfEPista0': 'Closest planet to the Sun',
            '#idfEPista1': 'Smallest planet',
            '#idfEPista2': 'Named after a Roman god',
            '#idfEPista3': 'No moons',
            '#idfEShowMinimize': true,
            '#idfESAvancedMode': false,
        },
        stored: 'identifica-DataGame',
    },
    {
        type: 'interactive-video',
        name: 'Interactive video',
        form: 'interactiveVideoIdeviceForm',
        // The form has no description above its tabs, so the notice of a development version would sit over them.
        add: async page => {
            await addIdevice(page, 'interactive-video');
            await dismissVersionNotice(page);
        },
        areas: [{ tab: 'options', scope: '#interactiveVideoOptions', helps: 2 }],
        keeps: {
            '#interactiveVideoType-youtube': true,
            '#interactiveVideoYoutubeURL': 'https://www.youtube.com/watch?v=g9gPKSGGkEk',
            '#interactiveVideoShowResults': true,
        },
        reopen: dismissVersionNotice,
    },
    {
        type: 'map',
        name: 'Map',
        form: 'gameQEIdeviceForm',
        // The form is wired once the editor of the point text is ready.
        add: async page => {
            await addIdevice(page, 'map');
            await waitForEditor(page, 'mapaToolTip');
        },
        // Each assessment mode shows its own rows, with their help.
        areas: [
            {
                tab: 'options',
                scope: '#mapaEOptions',
                helps: 6,
                variants: {
                    '#mapaEEvaluationTest': 9,
                    '#mapaEEvaluationOrder': 5,
                    '#mapaEEvaluationTX': 6,
                    '#mapaEEvaluationSearch': 6,
                },
            },
        ],
        // A map needs its image and one point marked on it.
        prepare: async page => {
            await page.locator('#gameQEIdeviceForm-tab-contents').click();
            const image = await page.locator('#mapaNoImage').getAttribute('src');
            await page.locator('#mapaURLImageMap').fill(image!);
            await page.locator('#mapaShowImageMap').click();
            await expect(page.locator('#mapaImage')).toBeVisible();
            await page.locator('#mapaTypePointSelect').selectOption('4');
            const box = (await page.locator('#mapaImage').boundingBox())!;
            await page.mouse.click(box.x + box.width / 3, box.y + box.height / 3);
            await expect(page.locator('#mapaX')).not.toHaveValue('0');
        },
        keeps: {
            '#mapaTitle': 'North',
            '#mapaEEvaluationPoints': true,
            '#mapaEHideAreas': true,
            '#mapaEHideScoreBar': true,
        },
        stored: 'mapa-DataGame',
        reopen: page => waitForEditor(page, 'mapaToolTip'),
    },
    {
        type: 'mathematicaloperations',
        name: 'Math operations',
        form: 'gameQEIdeviceForm',
        // The operations are set in Questions; how the game behaves, in Options.
        areas: [
            { tab: 'contents', scope: '#eRMQEPanel', helps: 8 },
            { tab: 'options', scope: '#eRMQEOptions', helps: 4 },
        ],
        keeps: { '#eRMQShowMinimize': true, '#eRMQTime': '5', '#eRMQadd': true, '#eRMQmult': true },
        stored: 'mathoperations-DataGame',
    },
    {
        type: 'mathproblems',
        name: 'Math problems',
        form: 'gameQEIdeviceForm',
        // The problems are set in Questions; how the game behaves, in Options.
        areas: [
            { tab: 'contents', scope: '#eCQEPanel', helps: 5 },
            { tab: 'options', scope: '#eCQEOptions', helps: 6 },
        ],
        keeps: {
            '#eCQShowMinimize': true,
            '#eCQRelative': true,
            '#eCQPercentajeRelative': '0.1',
            '#eCQTime': '120',
        },
        stored: 'mathproblems-DataGame',
    },
    {
        type: 'padlock',
        name: 'Padlock',
        form: 'candadoIdeviceForm',
        areas: [
            { tab: 'contents', scope: '#candadoEPanel', helps: 1 },
            { tab: 'options', scope: '#candadoEOptions', helps: 5 },
        ],
        // The instructions, and the feedback the code unlocks.
        prepare: async page => {
            await page.locator('#candadoIdeviceForm-tab-contents').click();
            await write(page, 'candadoEDescription', '<p>Find the code</p>');
            await page.locator('label[for="candadoERetro"]').click();
            await write(page, 'candadoEFeedBack', '<p>Well done</p>');
        },
        keeps: {
            '#candadoEDSolution': '2468',
            '#candadoEShowMinimize': true,
            '#candadoEAttemps': '3',
            // To fill once there is a number of attempts.
            '#candadoEErrorMessage': 'Look at the date',
        },
    },
    {
        type: 'periodic-table',
        name: 'Periodic table',
        form: 'ptQEIdeviceForm',
        // What learners do is set in Questions, where the Complete mode asks for the data to fill in;
        // how the game behaves, in Options.
        areas: [
            { tab: 'contents', scope: '#ptEPanel', helps: 4, variants: { '#ptEComplete': 4 } },
            { tab: 'options', scope: '#ptEOptions', helps: 3 },
        ],
        keeps: {
            '#ptEShowMinimize': true,
            '#ptEAttemptsNumber': '3',
            '#ptEComplete': true,
            '#ptEname': true,
        },
        stored: 'periodic-table-DataGame',
    },
    {
        type: 'progress-report',
        name: 'Progress report',
        form: 'reportQEIdeviceForm',
        // The settings in Options; "Show", leading the report above the list it filters.
        areas: [
            { tab: 'options', scope: '#informeEOptions', helps: 5 },
            { tab: 'contents', scope: '#informeEContents', helps: 1 },
        ],
        keeps: { '#informeEEvaluationID': 'unit-one', '#informeEActiveLinks': false, '#showtype2': true },
        stored: 'informe-DataGame',
    },
    {
        type: 'puzzle',
        name: 'Puzzle',
        form: 'puzzleIdeviceForm',
        // Each puzzle is set in Questions; how the game behaves, in Options.
        areas: [
            { tab: 'contents', scope: '#puzzleEPanel', helps: 7 },
            { tab: 'options', scope: '#puzzleEOptions', helps: 3 },
        ],
        block: ['https://example.org/**'],
        keeps: {
            '#puzzleEShowMinimize': true,
            '#puzzleEURLImageDefinition': 'https://example.org/cat.jpg',
            '#puzzleERows': '4',
            '#puzzleEShowTime': true,
            '#puzzleECluePuzzle': 'Well done',
        },
        stored: 'puzzle-DataGame',
    },
    {
        type: 'quick-questions-multiple-choice',
        name: 'Multiple Choice',
        form: 'quickMultipleQEIdeviceForm',
        block: [YOUTUBE_API],
        // The form is built when its question editor starts: wait, or what is typed first is lost.
        add: async page => {
            await addIdevice(page, 'quick-questions-multiple-choice');
            await waitForEditor(page, 'seleccionaEText');
        },
        areas: [{ tab: 'options', scope: '#seleccionaEOptions', helps: 13 }],
        keeps: {
            '#seleccionaEQuestion': 'What is the capital of France?',
            '#seleccionaEOption0': 'Paris',
            '#seleccionaEOption1': 'London',
            '#seleccionaEOption2': 'Rome',
            '#seleccionaEOption3': 'Berlin',
            '#seleccionaESolution0': true,
            '#seleccionaEAnswersRamdon': true,
        },
        stored: 'selecciona-DataGame',
        explains: { '#seleccionaEOrderLinear': ['Default:', 'Random:', 'Tree:'] },
    },
    {
        type: 'quick-questions',
        name: 'Quick Questions',
        form: 'gameQEIdeviceForm',
        block: [YOUTUBE_API],
        // The form is built when its question editor starts: wait, or what is typed first is lost.
        add: async page => {
            await addIdevice(page, 'quick-questions');
            await waitForEditor(page, 'quextEText');
        },
        areas: [{ tab: 'options', scope: '#quextEOptions', helps: 10 }],
        keeps: {
            '#quextEQuestion': 'What is the capital of France?',
            '#quextEOption0': 'Paris',
            '#quextEOption1': 'London',
            '#quextEOption2': 'Rome',
            '#quextEOption3': 'Berlin',
            '#quextEQuestionsRamdon': true,
        },
        stored: 'quext-DataGame',
        explains: { '#quextEQuestionsRamdon': ['Random questions:', 'Random options:'] },
    },
    {
        type: 'quick-questions-video',
        name: 'Video test',
        form: 'vquextQEIdeviceForm',
        block: [YOUTUBE_API],
        areas: [{ tab: 'options', scope: '#vquextEOptions', helps: 13 }],
        // The video and the point where the question stops it.
        prepare: async page => {
            await page.locator('#vquextQEIdeviceForm-tab-contents').click();
            await page.locator('#vquextEVIURL').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
            await page.locator('#vquextEVIEnd').fill('00:01:00');
        },
        keeps: {
            '#vquextENavigable': true,
            '#vquextEPauseVideo': true,
            '#vquextPoint': '00:00:10',
            '#vquextEQuestion': 'What is the capital of France?',
            '#vquextEOption0': 'Paris',
            '#vquextEOption1': 'London',
            '#vquextEOption2': 'Rome',
            '#vquextEOption3': 'Berlin',
        },
        stored: 'vquext-DataGame',
    },
    {
        type: 'relate',
        name: 'Relate',
        form: 'relateQIdeviceForm',
        // The time is asked only in the Advanced level.
        areas: [{ tab: 'options', scope: '#rclEOptions', helps: 3, variants: { '#rclETypeIdentify': 4 } }],
        keeps: { '#rclEText': 'Sun', '#rclETextBack': 'Sol', '#rclETypeIdentify': true, '#rclETime': '5' },
        stored: 'relaciona-DataGame',
    },
    {
        type: 'scrambled-list',
        name: 'Scrambled list',
        form: 'scrambledlistIdeviceForm',
        areas: [{ tab: 'options', scope: '#sortableListOptions', helps: 2 }],
        keeps: {
            '#sortableListFormList0': 'Wake up',
            '#sortableListFormList1': 'Have breakfast',
            '#sortableListFormList2': 'Go to school',
            '#sortableShowSolutions': false,
            '#sortableAttemptsNumber': '3',
        },
    },
    {
        type: 'select-media-files',
        name: 'Select media files',
        form: 'gameQEIdeviceForm',
        areas: [{ tab: 'options', scope: '#slcmEOptions', helps: 9 }],
        keeps: {
            '#slcmEModeTable': true,
            '#slcmEAttemptsNumber': '3',
            '#slcmEDefinition': 'Choose the animal',
            '#slcmEPhrase .SLCME-EText': 'Cat',
            '#slcmEPhrase .SLCME-EState': true,
        },
        stored: 'seleccionamedias-DataGame',
    },
    {
        type: 'sort',
        name: 'Sort',
        form: 'gameQEIdeviceForm',
        // Each type of activity has options of its own.
        areas: [{ tab: 'options', scope: '#ordenaEOptions', helps: 6, variants: { '#odntype1': 10, '#odntype0': 6 } }],
        keeps: { '#ordenaEWordBorder': false, '#ordenaETime': '5', '#ordenaEPraseI': 'The cat sleeps on the sofa' },
        stored: 'ordena-DataGame',
    },
    {
        type: 'trivial',
        name: 'Trivial',
        form: 'gameQEIdeviceForm',
        block: [YOUTUBE_API],
        // The form is built when its question editor starts: wait, or what is done first is lost.
        add: async page => {
            await addIdevice(page, 'trivial');
            await waitForEditor(page, 'trivialEText');
        },
        // Topics and questions are set in Questions; how the game behaves, in Options.
        areas: [
            { tab: 'contents', scope: '#trivialEPanel', helps: 1 },
            { tab: 'options', scope: '#trivialEOptions', helps: 5 },
        ],
        // Each topic needs its name and complete questions to save.
        prepare: page =>
            page.evaluate(() => {
                const edition = (window as any).$exeDevice;
                for (let topic = 0; topic < 2; topic++) {
                    const question = edition.getCuestionDefault();
                    question.quextion = `Question ${topic + 1}`;
                    question.options = ['Right', 'Wrong', '', ''];
                    question.numberOptions = 2;
                    question.solution = 'A';
                    edition.temas[topic] = [question];
                }
                edition.nombresTemas = ['Maths', 'History', '', '', '', ''];
                edition.showTema(0);
            }),
        keeps: {
            '#trivialModeBoard': true,
            '#trivialEShowMinimize': true,
            '#trivialNameTema': 'Maths',
            '#trivialEQuestion': 'Question 1',
        },
        stored: 'trivial-DataGame',
        reopen: page => waitForEditor(page, 'trivialEText'),
    },
    {
        type: 'trueorfalse',
        name: 'True or false',
        form: 'trueorfalseIdeviceForm',
        add: async page => {
            await addIdevice(page, 'trueorfalse');
            await waitForEditor(page, 'tofEQuestionEditor');
        },
        // The time and the attempts only apply to a test.
        areas: [{ tab: 'options', scope: '#tofEOptions', helps: 4, variants: { '#tofEIsTest': 6 } }],
        prepare: page => write(page, 'tofEQuestionEditor', '<p>The Sun is a star</p>'),
        keeps: {
            '#tofAnswerTrue': true,
            '#tofEShowSlider': true,
            '#tofEIsTest': true,
            '#tofETime': '5',
            '#tofEAttemptsNumber': '3',
            '#tofEQuestionsRandom': true,
            '#tofEPercentageQuestions': '50',
        },
        stored: 'exe-trueorfalse-container',
        reopen: page => waitForEditor(page, 'tofEQuestionEditor'),
    },
    {
        type: 'udl-content',
        name: 'UDL content',
        form: 'udlContentEditorWrapper',
        // The form has no description above its tabs, so the notice of a development version would sit over them.
        add: async page => {
            await dismissVersionNotice(page);
            await addIdevice(page, 'udl-content');
            await waitForEditor(page, 'udlContentFormTxt-0');
        },
        // The type leads the blocks in Content: there is no Options tab.
        areas: [{ tab: 'contents', scope: '#udlContentTypeOptions', helps: 1 }],
        prepare: page => write(page, 'udlContentFormTxt-0', '<p>The main text</p>'),
        keeps: { '#udlContentType-expression': true },
        stored: 'exe-udlContent-expression',
        reopen: async page => {
            await dismissVersionNotice(page);
            await waitForEditor(page, 'udlContentFormTxt-0');
        },
    },
    {
        type: 'word-search',
        name: 'Word search',
        form: 'sopaQEIdeviceForm',
        areas: [{ tab: 'options', scope: '#sopaEOptions', helps: 5 }],
        keeps: {
            '#sopaESolutionWord': 'SUN',
            '#sopaEDefinitionWord': 'The star of our system',
            '#sopaEDiagonals': true,
            '#sopaEReverses': false,
            '#sopaETime': '5',
        },
        stored: 'sopa-DataGame',
    },
];

/**
 * Checks, in the page and at once, every help shown in `scope`: it is wired, nothing covers it, it sits
 * right after what precedes it and on the line of its control, its explanation opens at it (or as near as
 * fits, by the right edge) inside the panel, and opening, reading and closing it changes nothing in the
 * form. Returns what is wrong, by help.
 */
function helpProblems(page: Page, scope: string): Promise<string[]> {
    return page.evaluate(async selector => {
        const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
        const shown = (element: Element) => element.getClientRects().length > 0;
        const form = document.querySelector(selector)!.closest('.idevice_node')!;
        const values = () =>
            [...form.querySelectorAll<HTMLInputElement>('input, select, textarea')].map(control =>
                control.type === 'checkbox' || control.type === 'radio' ? control.checked : control.value,
            );
        const before = JSON.stringify(values());
        const problems: string[] = [];
        const buttons = [...document.querySelectorAll<HTMLElement>(`${selector} .exe-idevice-help`)].filter(shown);
        // The side panels fold, and some rows unfold, with a transition: measure once nothing moves.
        const layout = () => JSON.stringify(buttons.map(button => button.getBoundingClientRect().toJSON()));
        for (let last = '', still = 0, frames = 0; still < 5 && frames < 300; frames++) {
            await nextFrame();
            const now = layout();
            still = now === last ? still + 1 : 0;
            last = now;
        }
        for (const button of buttons) {
            const fail = (what: string) => problems.push(`${button.getAttribute('aria-label')}: ${what}`);
            // At once: the page scrolls smoothly otherwise, and would move while it is measured.
            button.scrollIntoView({ block: 'center', behavior: 'instant' });
            if (!(window as any).bootstrap.Tooltip.getInstance(button)) fail('has no tooltip');
            const icon = button.getBoundingClientRect();
            const hit = document.elementFromPoint(icon.left + icon.width / 2, icon.top + icon.height / 2);
            if (!hit || !button.contains(hit)) fail(`is covered by ${hit?.outerHTML.slice(0, 80)}`);
            const container = button.parentElement!;
            let previous = container.previousElementSibling;
            while (previous && !shown(previous)) previous = previous.previousElementSibling;
            if (!previous) {
                fail('follows nothing');
            } else {
                const box = previous.getBoundingClientRect();
                const gap = icon.left - box.right;
                if (!(icon.top < box.bottom && box.top < icon.bottom && gap >= 0 && gap <= 24)) {
                    fail(`is not right after what precedes it (gap ${Math.round(gap)})`);
                }
            }
            const control = [...container.parentElement!.querySelectorAll('input, select, textarea')].find(
                element => shown(element) && !container.contains(element),
            );
            if (control) {
                const box = control.getBoundingClientRect();
                if (!(icon.top < box.bottom && box.top < icon.bottom)) fail('is not on the line of its control');
            }
            button.click();
            await nextFrame();
            const content = document.getElementById(button.getAttribute('aria-controls')!)!;
            if (!shown(content) || button.getAttribute('aria-expanded') !== 'true') {
                fail('does not open');
                continue;
            }
            // The part of the panel on screen: the window and the scrolling boxes around it cut it.
            const pane = content.closest('.tab-pane')!;
            const panel = pane.getBoundingClientRect();
            let left = Math.max(0, panel.left);
            let right = Math.min(panel.right, document.documentElement.clientWidth);
            for (let parent = pane.parentElement; parent; parent = parent.parentElement) {
                if (/auto|scroll|hidden|clip/.test(getComputedStyle(parent).overflowX)) {
                    const clip = parent.getBoundingClientRect();
                    left = Math.max(left, clip.left);
                    right = Math.min(right, clip.right);
                }
            }
            const rect = content.getBoundingClientRect();
            const start = button.getBoundingClientRect().left;
            const atIcon = Math.abs(rect.left - start) < 2;
            const byTheEdge = rect.left < start && Math.abs(rect.right - (right - 8)) < 2;
            if (!atIcon && !byTheEdge) {
                fail(`opens away from its icon (at ${rect.left}-${rect.right}, icon ${start}, edge ${right - 8})`);
            }
            if (rect.left < left - 1 || rect.right > right + 1) fail('opens outside the panel');
            if (content.scrollWidth > content.clientWidth) fail('has to scroll');
            // Reading the explanation keeps it open.
            content.click();
            await nextFrame();
            if (!shown(content)) fail('closes when its explanation is clicked');
            button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            await nextFrame();
            if (shown(content) || button.getAttribute('aria-expanded') !== 'false') fail('does not close');
        }
        if (JSON.stringify(values()) !== before) problems.push('Reading the helps changed the form');
        return problems;
    }, scope);
}

/** Opens the tab that holds `field`. */
async function showTabOf(page: Page, field: Locator) {
    const panel = await field.evaluate(element => element.closest('[role="tabpanel"]')?.id);
    if (panel) await page.locator(`#${panel.replace('-panel-', '-tab-')}`).click();
}

/** Turns a switch or a choice on or off, through its label when the input itself is not shown. */
async function setChecked(page: Page, input: Locator, checked: boolean) {
    if (await input.isVisible()) {
        await input.setChecked(checked);
    } else if ((await input.isChecked()) !== checked) {
        await page.locator(`label[for="${await input.getAttribute('id')}"]`).click();
    }
    await expect(input).toBeChecked({ checked });
}

// Each case creates a project, checks every help at two widths, then saves, reloads and reopens it: up to
// 40 s in Chromium, and about a minute in Firefox.
test.describe.configure({ timeout: 90_000 });

for (const c of CASES) {
    test(`${c.name} explains each option inline without changing it`, async ({
        authenticatedPage: page,
        createProject,
    }) => {
        for (const url of c.block ?? []) await page.route(url, route => route.abort());
        const uuid = await createProject(page, `${c.name} option help`);
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await selectFirstPage(page);
        await (c.add ? c.add(page) : addIdevice(page, c.type));
        const id = await page.locator(`#${c.form}-tabs`).evaluate(tabs => tabs.closest('.idevice_node')!.id);
        await c.prepare?.(page);

        for (const area of c.areas) {
            await page.locator(`#${c.form}-tab-${area.tab}`).click();
            const help = page.locator(`${area.scope} .exe-idevice-help:visible`);
            for (const [choice, count] of [['', area.helps], ...Object.entries(area.variants ?? {})] as const) {
                if (choice) await setChecked(page, page.locator(choice), true);
                if (process.env.LIST_HELP_COUNTS) {
                    console.log(`COUNT ${c.type} ${area.scope} ${choice || '-'} ${await help.count()}`);
                    continue;
                }
                await expect(help).toHaveCount(count);
                for (const width of [1280, 1024]) {
                    await page.setViewportSize({ width, height: 900 });
                    const problems = await helpProblems(page, area.scope);
                    expect(problems, `${area.scope}, ${choice || 'as added'}, at ${width}px`).toEqual([]);
                }
            }
        }
        if (process.env.LIST_HELP_COUNTS) return;

        // With the pointer, as the author does, on the first help.
        const first = c.areas[0];
        const firstTab = page.locator(`#${c.form}-tab-${first.tab}`);
        await firstTab.click();
        const help = page.locator(`${first.scope} .exe-idevice-help:visible`).first();
        await help.hover();
        await expect(page.getByRole('tooltip')).toHaveText('Information');
        await help.click();
        const content = page.locator(`#${await help.getAttribute('aria-controls')}`);
        await expect(content).toBeVisible();
        await firstTab.hover();
        await expect(content).toBeVisible();
        await help.press('Escape');
        await expect(content).toBeHidden();

        for (const [control, texts] of Object.entries(c.explains ?? {})) {
            await showTabOf(page, page.locator(control));
            // The help of the row: the first one around the control.
            const button = page
                .locator(control)
                .locator('xpath=ancestor::*[.//*[contains(@class, "exe-idevice-help-container")]][1]')
                .locator('.exe-idevice-help')
                .first();
            await button.click();
            const explanation = page.locator(`#${await button.getAttribute('aria-controls')}`);
            for (const text of texts) await expect(explanation).toContainText(text);
            await button.press('Escape');
        }

        for (const [selector, value] of Object.entries(c.keeps)) {
            const field = page.locator(selector).first();
            await showTabOf(page, field);
            if (typeof value === 'boolean') {
                await setChecked(page, field, value);
            } else if ((await field.evaluate(element => element.tagName)) === 'SELECT') {
                await field.selectOption(value);
            } else {
                await field.fill(value);
                await field.blur();
            }
        }
        await saveIdevice(page, id);
        await expect(page.getByRole('tooltip')).toHaveCount(0);
        const stored = await page.evaluate(componentId => {
            const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(
                componentId,
            );
            return { type: component.ideviceType, html: component.htmlContent as string };
        }, id);
        expect(stored.type).toBe(c.type);
        if (c.stored) expect(stored.html).toContain(c.stored);
        expect(stored.html).not.toContain('exe-idevice-help');

        await saveProject(page);
        await reloadPage(page);
        await selectFirstPage(page);
        await editIdevice(page, id);
        await c.reopen?.(page);
        for (const [selector, value] of Object.entries(c.keeps)) {
            const field = page.locator(selector).first();
            await showTabOf(page, field);
            if (typeof value === 'boolean') await expect(field).toBeChecked({ checked: value });
            else await expect(field).toHaveValue(value);
        }
        // The helps work again in the reopened form.
        await firstTab.click();
        await help.hover();
        await expect(page.getByRole('tooltip')).toHaveText('Information');
        await help.click();
        await expect(page.locator(`#${await help.getAttribute('aria-controls')}`)).toBeVisible();
    });
}
