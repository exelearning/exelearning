import { readFileSync } from 'fs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const EDITION_SRC = 'public/files/perm/idevices/base/adaptative-quiz/edition/adaptative-quiz.js';
const EDITION_CSS = 'public/files/perm/idevices/base/adaptative-quiz/edition/adaptative-quiz.css';

describe('adaptative-quiz edition', () => {
    let idevice;

    beforeEach(async () => {
        document.body.innerHTML = '<div id="idevice-container"></div>';
        idevice = await global.loadIdevice(
            'public/files/perm/idevices/base/adaptative-quiz/edition/adaptative-quiz.js',
        );
    });

    it('should define $exeDevice with required properties', () => {
        expect(idevice).toBeDefined();
        expect(idevice.name).toBe('adaptative-quiz');
        expect(idevice.classIdevice).toBe('adaptative-quiz');
        expect(typeof idevice.init).toBe('function');
        expect(typeof idevice.save).toBe('function');
        expect(typeof idevice.createForm).toBe('function');
        expect(typeof idevice.insertAIContent).toBe('function');
        expect(typeof idevice.parseAIQuestionLine).toBe('function');
    });

    describe('image field', () => {
        it('drops the orphan TitleImage label and ships an image reload control', () => {
            const src = readFileSync(EDITION_SRC, 'utf-8');
            expect(src).not.toContain('adaptativeQuizTitleImage');
            expect(src).toContain('adaptativeQuizEReloadImage');
            expect(typeof idevice.reloadImagePreview).toBe('function');
        });

        it('reloadImagePreview refreshes the preview from an external URL with a cache-buster', () => {
            document.body.innerHTML = `
                <input id="adaptativeQuizEURLImage" value="https://example.com/pic.png" />
                <img id="adaptativeQuizEImagePreview" style="display:none" />
                <img id="adaptativeQuizENoImage" />
            `;

            idevice.reloadImagePreview();

            const preview = document.getElementById('adaptativeQuizEImagePreview');
            expect(preview.getAttribute('src')).toContain('https://example.com/pic.png');
            expect(preview.getAttribute('src')).toContain('_reload=');
            expect(preview.style.display).not.toBe('none');
            expect(document.getElementById('adaptativeQuizENoImage').style.display).toBe('none');
        });

        it('reloadImagePreview applies a local (asset://) URL verbatim, without a cache-buster', () => {
            document.body.innerHTML = `
                <input id="adaptativeQuizEURLImage" value="asset://abc-123.png" />
                <img id="adaptativeQuizEImagePreview" style="display:none" />
                <img id="adaptativeQuizENoImage" />
            `;

            idevice.reloadImagePreview();

            const preview = document.getElementById('adaptativeQuizEImagePreview');
            // A query string would break asset:// resolution, so it must be left intact.
            expect(preview.getAttribute('src')).toBe('asset://abc-123.png');
            expect(preview.getAttribute('src')).not.toContain('_reload=');
            expect(preview.style.display).not.toBe('none');
            expect(document.getElementById('adaptativeQuizENoImage').style.display).toBe('none');
        });

        it('keeps the preview image proportioned (object-fit: contain) so portrait images are not stretched', () => {
            const css = readFileSync(EDITION_CSS, 'utf-8');
            const mediaRule = css.match(/\.ADQ-EMedia\s*\{[\s\S]*?\}/)?.[0] || '';
            expect(mediaRule).toContain('object-fit: contain');
        });

        it('reloadImagePreview shows the placeholder when the URL is empty', () => {
            document.body.innerHTML = `
                <input id="adaptativeQuizEURLImage" value="" />
                <img id="adaptativeQuizEImagePreview" />
                <img id="adaptativeQuizENoImage" style="display:none" />
            `;

            idevice.reloadImagePreview();

            expect(document.getElementById('adaptativeQuizEImagePreview').style.display).toBe('none');
            expect(document.getElementById('adaptativeQuizENoImage').style.display).not.toBe('none');
        });
    });

    it('lays out the Custom texts tab inputs in two responsive columns (like guess)', () => {
        const css = readFileSync(EDITION_CSS, 'utf-8');
        const rule = css.match(/#adaptativeQuizIdeviceForm \.exe-form-tab:has\(> \.ci18n\)\s*\{[\s\S]*?\}/)?.[0] || '';
        expect(rule).toContain('display: flex');
        expect(rule).toContain('flex-wrap: wrap');
        // Each ci18n row takes roughly half the width → two columns.
        expect(css).toContain('.exe-form-tab:has(> .ci18n) > * {');
    });

    it('removes the question number prefix from validation messages', () => {
        expect(idevice.cleanQuestionPrefix('Question %s: the question text cannot be empty.', 1)).toBe(
            'The question text cannot be empty.',
        );
    });

    it('normalizes questions per round without capping it to the current question count', () => {
        expect(idevice.normalizeQuestionsPerRound('30')).toBe(30);
        expect(idevice.normalizeQuestionsPerRound('0')).toBe(1);
        expect(idevice.normalizeQuestionsPerRound('abc')).toBe(1);
    });

    describe('parseAIQuestionLine', () => {
        describe('type 0 (select / multiple-choice)', () => {
            it('parses a 4-option line with single-letter solution and maps level 0 to difficulty 1', () => {
                const q = idevice.parseAIQuestionLine('0@0#B#Q?#A#B#C#D');
                expect(q).not.toBeNull();
                expect(q.typeSelect).toBe(0);
                expect(q.question).toBe('Q?');
                expect(q.numberOptions).toBe(4);
                expect(q.options.map(o => o.text)).toEqual(['A', 'B', 'C', 'D', '', '']);
                expect(q.solutionMulti).toEqual([1]);
                expect(q.difficulty).toBe(1);
            });

            it('parses a multi-letter solution (case-insensitive) into sorted indices', () => {
                const q = idevice.parseAIQuestionLine('0@1#ac#Pick prime numbers#2#4#5#9');
                expect(q).not.toBeNull();
                expect(q.typeSelect).toBe(0);
                expect(q.solutionMulti).toEqual([0, 2]);
                expect(q.difficulty).toBe(2);
            });

            it('accepts an empty solution (no correct option) and keeps numberOptions', () => {
                const q = idevice.parseAIQuestionLine('0@2##Question?#A#B#C');
                expect(q).not.toBeNull();
                expect(q.typeSelect).toBe(0);
                expect(q.solutionMulti).toEqual([]);
                expect(q.numberOptions).toBe(3);
                expect(q.options[3].text).toBe('');
                expect(q.difficulty).toBe(3);
            });

            it('keeps 3 options when only 3 are provided', () => {
                const q = idevice.parseAIQuestionLine('0@1#A#Q?#A#B#C');
                expect(q.numberOptions).toBe(3);
                expect(q.solutionMulti).toEqual([0]);
                expect(q.options[3].text).toBe('');
            });

            it('rejects letters outside A-F', () => {
                expect(idevice.parseAIQuestionLine('0@0#G#Q#A#B#C#D#E#F')).toBeNull();
            });

            it('parses a 5-option line with multi-letter solution including E', () => {
                const q = idevice.parseAIQuestionLine('0@0#AE#Q?#A#B#C#D#E');
                expect(q).not.toBeNull();
                expect(q.numberOptions).toBe(5);
                expect(q.solutionMulti).toEqual([0, 4]);
                expect(q.options.map(o => o.text)).toEqual(['A', 'B', 'C', 'D', 'E', '']);
            });

            it('parses a 6-option line with all letters as solution', () => {
                const q = idevice.parseAIQuestionLine('0@1#ABCDEF#Q?#A#B#C#D#E#F');
                expect(q).not.toBeNull();
                expect(q.numberOptions).toBe(6);
                expect(q.solutionMulti).toEqual([0, 1, 2, 3, 4, 5]);
                expect(q.options.map(o => o.text)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
            });

            it('rejects a letter beyond the number of options', () => {
                expect(idevice.parseAIQuestionLine('0@0#C#Q#A#B')).toBeNull();
            });

            it('rejects duplicated letters in the solution', () => {
                expect(idevice.parseAIQuestionLine('0@0#AA#Q#A#B#C#D')).toBeNull();
            });

            it('rejects fewer than MIN_OPTIONS options', () => {
                expect(idevice.parseAIQuestionLine('0@0#A#Q?#A')).toBeNull();
            });
        });

        describe('type 1 (sort / order)', () => {
            it('parses a 4-item sort line and sets sequential solutionOrder', () => {
                const q = idevice.parseAIQuestionLine('1@2#Sort largest to smallest#Elephant#Tiger#Cat#Mouse');
                expect(q).not.toBeNull();
                expect(q.typeSelect).toBe(1);
                expect(q.question).toBe('Sort largest to smallest');
                expect(q.numberOptions).toBe(4);
                expect(q.options.map(o => o.text)).toEqual(['Elephant', 'Tiger', 'Cat', 'Mouse', '', '']);
                expect(q.solutionOrder).toEqual([1, 2, 3, 4]);
                expect(q.solutionMulti).toEqual([]);
                expect(q.difficulty).toBe(3);
            });

            it('parses a 3-item sort line', () => {
                const q = idevice.parseAIQuestionLine('1@0#Order them#One#Two#Three');
                expect(q.typeSelect).toBe(1);
                expect(q.numberOptions).toBe(3);
                expect(q.solutionOrder).toEqual([1, 2, 3]);
            });

            it('rejects sort with fewer than 3 items', () => {
                expect(idevice.parseAIQuestionLine('1@0#Order them#One#Two')).toBeNull();
            });

            it('rejects sort with more than 6 items', () => {
                expect(
                    idevice.parseAIQuestionLine('1@0#Q#A#B#C#D#E#F#G'),
                ).toBeNull();
            });
        });

        describe('type 2 (word / definition)', () => {
            it('parses a word/definition line and stores word in question and definition in solutionWord', () => {
                const q = idevice.parseAIQuestionLine('2@0#Heart#Pumps blood through the body');
                expect(q).not.toBeNull();
                expect(q.typeSelect).toBe(2);
                // Legacy data model: q.question = the word the learner types,
                // q.solutionWord = the definition shown as the prompt.
                expect(q.question).toBe('Heart');
                expect(q.solutionWord).toBe('Pumps blood through the body');
                expect(q.solutionMulti).toEqual([]);
                expect(q.solutionOrder).toEqual([]);
                expect(q.difficulty).toBe(1);
            });

            it('rejects word/definition lines missing the definition', () => {
                expect(idevice.parseAIQuestionLine('2@0#OnlyWord')).toBeNull();
            });
        });

        describe('common rejections', () => {
            it('rejects lines without @ separator', () => {
                expect(idevice.parseAIQuestionLine('0#1#Q?#A#B#C#D')).toBeNull();
            });

            it('rejects lines without any # separator', () => {
                expect(idevice.parseAIQuestionLine('0@1')).toBeNull();
            });

            it('rejects unknown type token', () => {
                expect(idevice.parseAIQuestionLine('3@0#A#Q?#A#B')).toBeNull();
            });

            it('rejects out-of-range level for the configured numLevels', () => {
                expect(idevice.parseAIQuestionLine('0@3#A#Q?#A#B')).toBeNull();
                expect(idevice.parseAIQuestionLine('0@-1#A#Q?#A#B')).toBeNull();
            });

            it('accepts level 3 when numLevels is 4 and maps it to difficulty 4', () => {
                const originalNumLevels = idevice.numLevels;
                idevice.numLevels = 4;
                try {
                    const q = idevice.parseAIQuestionLine('0@3#C#Q?#A#B#C#D');
                    expect(q).not.toBeNull();
                    expect(q.difficulty).toBe(4);
                    expect(q.solutionMulti).toEqual([2]);
                    // Level 4 is still out of range even with 4 levels configured.
                    expect(idevice.parseAIQuestionLine('0@4#A#Q?#A#B')).toBeNull();
                } finally {
                    idevice.numLevels = originalNumLevels;
                }
            });

            it('still rejects level 3 when numLevels defaults to 3', () => {
                expect(idevice.numLevels).toBe(3);
                expect(idevice.parseAIQuestionLine('0@3#A#Q?#A#B')).toBeNull();
            });

            it('accepts level 4 when numLevels is 5 and maps it to difficulty 5', () => {
                const originalNumLevels = idevice.numLevels;
                idevice.numLevels = 5;
                try {
                    const q = idevice.parseAIQuestionLine('0@4#A#Master question?#A#B#C#D');
                    expect(q).not.toBeNull();
                    expect(q.difficulty).toBe(5);
                    expect(q.solutionMulti).toEqual([0]);
                    // Word/definition at master level still works.
                    const w = idevice.parseAIQuestionLine('2@4#Heart#Pumps blood');
                    expect(w).not.toBeNull();
                    expect(w.difficulty).toBe(5);
                    // Level 5 remains out of range even with 5 levels configured.
                    expect(idevice.parseAIQuestionLine('0@5#A#Q?#A#B')).toBeNull();
                } finally {
                    idevice.numLevels = originalNumLevels;
                }
            });

            it('LEVELS_BY_COUNT exposes 5-level mode as [1..5]', () => {
                expect(idevice.LEVELS_BY_COUNT[5]).toEqual([1, 2, 3, 4, 5]);
                const original = idevice.numLevels;
                idevice.numLevels = 5;
                try {
                    expect(idevice.LEVELS).toEqual([1, 2, 3, 4, 5]);
                } finally {
                    idevice.numLevels = original;
                }
            });

            it('rejects empty or non-string input', () => {
                expect(idevice.parseAIQuestionLine('')).toBeNull();
                expect(idevice.parseAIQuestionLine(null)).toBeNull();
                expect(idevice.parseAIQuestionLine(undefined)).toBeNull();
            });
        });
    });

    describe('insertAIContent', () => {
        beforeEach(() => {
            idevice.questionsGame = [];
            idevice.active = -1;
            idevice.showQuestion = () => {};
        });

        it('loads a mix of valid type-0/1/2 lines and skips invalid ones', () => {
            idevice.insertAIContent([
                '0@1#AB#Multi correct?#A#B#C#D',
                'garbage',
                '1@0#Order#One#Two#Three',
                '2@2#Heart#Pumps blood',
            ]);
            expect(idevice.questionsGame).toHaveLength(3);
            expect(idevice.questionsGame[0].typeSelect).toBe(0);
            expect(idevice.questionsGame[0].solutionMulti).toEqual([0, 1]);
            expect(idevice.questionsGame[1].typeSelect).toBe(1);
            expect(idevice.questionsGame[1].solutionOrder).toEqual([1, 2, 3]);
            expect(idevice.questionsGame[2].typeSelect).toBe(2);
            expect(idevice.questionsGame[2].question).toBe('Heart');
            expect(idevice.questionsGame[2].solutionWord).toBe('Pumps blood');
            expect(idevice.active).toBe(0);
        });

        it('drops the auto-created empty placeholder when importing into a fresh iDevice', () => {
            idevice.questionsGame = [idevice.getCuestionDefault()];
            idevice.active = 0;
            idevice.insertAIContent(['0@0#A#Q?#A#B']);
            expect(idevice.questionsGame).toHaveLength(1);
            expect(idevice.questionsGame[0].question).toBe('Q?');
            expect(idevice.active).toBe(0);
        });

        it('appends imported questions to the existing non-empty list', () => {
            const existing = idevice.getCuestionDefault();
            existing.question = 'Already there';
            existing.options[0].text = 'A';
            existing.options[1].text = 'B';
            existing.solutionMulti = [0];
            idevice.questionsGame = [existing];
            idevice.active = 0;

            idevice.insertAIContent(['0@0#A#Imported?#A#B', '2@1#Word#Definition']);

            expect(idevice.questionsGame).toHaveLength(3);
            expect(idevice.questionsGame[0].question).toBe('Already there');
            expect(idevice.questionsGame[1].question).toBe('Imported?');
            expect(idevice.questionsGame[2].typeSelect).toBe(2);
            // Active jumps to the first newly imported question.
            expect(idevice.active).toBe(1);
        });

        it('alerts and leaves state untouched when no valid lines are provided', () => {
            const original = idevice.questionsGame;
            let alerted = false;
            const originalAlert = globalThis.eXe.app.alert;
            globalThis.eXe.app.alert = () => {
                alerted = true;
            };
            try {
                idevice.insertAIContent(['garbage', '']);
            } finally {
                globalThis.eXe.app.alert = originalAlert;
            }
            expect(alerted).toBe(true);
            expect(idevice.questionsGame).toBe(original);
        });
    });

    describe('isEmptyQuestion', () => {
        it('treats null/undefined/non-objects as empty', () => {
            expect(idevice.isEmptyQuestion(null)).toBe(true);
            expect(idevice.isEmptyQuestion(undefined)).toBe(true);
            expect(idevice.isEmptyQuestion('nope')).toBe(true);
        });

        it('returns true for the default placeholder question', () => {
            expect(idevice.isEmptyQuestion(idevice.getCuestionDefault())).toBe(true);
        });

        it('returns false when the statement is filled', () => {
            const q = idevice.getCuestionDefault();
            q.question = 'Q?';
            expect(idevice.isEmptyQuestion(q)).toBe(false);
        });

        it('returns false when any option text is filled', () => {
            const q = idevice.getCuestionDefault();
            q.options[2].text = 'C';
            expect(idevice.isEmptyQuestion(q)).toBe(false);
        });

        it('returns false when solutionWord is filled', () => {
            const q = idevice.getCuestionDefault();
            q.solutionWord = 'Heart';
            expect(idevice.isEmptyQuestion(q)).toBe(false);
        });
    });

    describe('normalizeQuestion', () => {
        it('preserves typeSelect=1 (Sort) and solutionOrder when loading saved data', () => {
            const out = idevice.normalizeQuestion({
                question: 'Order them',
                type: 0,
                typeSelect: 1,
                numberOptions: 4,
                options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }, { text: 'D' }],
                solutionOrder: [1, 2, 3, 4],
                difficulty: 2,
            });
            expect(out.typeSelect).toBe(1);
            expect(out.solutionOrder).toEqual([1, 2, 3, 4]);
            expect(out.solutionMulti).toEqual([]);
            expect(out.solutionWord).toBe('');
        });

        it('preserves typeSelect=2 (Word) and solutionWord when loading saved data', () => {
            const out = idevice.normalizeQuestion({
                question: 'Define',
                type: 0,
                typeSelect: 2,
                numberOptions: 4,
                options: [{ text: '' }, { text: '' }, { text: '' }, { text: '' }],
                solutionWord: 'answer',
                difficulty: 2,
            });
            expect(out.typeSelect).toBe(2);
            expect(out.solutionWord).toBe('answer');
        });

        it('preserves typeSelect=0 (Select) with solutionMulti when loading saved data', () => {
            const out = idevice.normalizeQuestion({
                question: 'Pick all',
                type: 0,
                typeSelect: 0,
                numberOptions: 4,
                options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }, { text: 'D' }],
                solutionMulti: [0, 2],
                difficulty: 2,
            });
            expect(out.typeSelect).toBe(0);
            expect(out.solutionMulti).toEqual([0, 2]);
        });

        it('promotes legacy typeSelect=4 (True/False) to 0 with solutionMulti from solution', () => {
            const out = idevice.normalizeQuestion({
                question: 'TF',
                type: 0,
                typeSelect: 4,
                numberOptions: 2,
                options: [{ text: 'True' }, { text: 'False' }],
                solution: 1,
                difficulty: 2,
            });
            expect(out.typeSelect).toBe(0);
            expect(out.solutionMulti).toEqual([1]);
        });

        it('coerces typeSelect provided as a string', () => {
            const out = idevice.normalizeQuestion({
                question: 'Q',
                type: 0,
                typeSelect: '1',
                numberOptions: 2,
                options: [{ text: 'A' }, { text: 'B' }],
                difficulty: 2,
            });
            expect(out.typeSelect).toBe(1);
        });

        it('preserves image author and alt text when loading saved data', () => {
            const out = idevice.normalizeQuestion({
                question: 'Look',
                type: 1,
                typeSelect: 0,
                url: 'pic.png',
                author: 'Jane Doe',
                alt: 'A red flower',
                numberOptions: 2,
                options: [{ text: 'A' }, { text: 'B' }],
                difficulty: 2,
            });
            expect(out.author).toBe('Jane Doe');
            expect(out.alt).toBe('A red flower');
        });

        it('defaults author and alt to empty strings when absent', () => {
            const out = idevice.normalizeQuestion({
                question: 'Q',
                type: 0,
                typeSelect: 0,
                numberOptions: 2,
                options: [{ text: 'A' }, { text: 'B' }],
                difficulty: 2,
            });
            expect(out.author).toBe('');
            expect(out.alt).toBe('');
        });
    });

    describe('save', () => {
        // The save path goes through validateData(), which requires every
        // active level to have at least 2 questions. The active question
        // (index 0) is always overwritten by readQuestionFromDom() using the
        // form's #adaptativeQuizDifficulty value (2 in the minimal form), so
        // we seed the rest of the array with one extra level-2 question plus
        // two each at levels 1 and 3 to satisfy the gate.
        function buildValidQuestions(idev) {
            const make = difficulty => ({
                ...idev.getCuestionDefault(),
                difficulty,
                question: 'Q',
                options: [
                    { text: 'A', audio: '' },
                    { text: 'B', audio: '' },
                    { text: '', audio: '' },
                    { text: '', audio: '' },
                    { text: '', audio: '' },
                    { text: '', audio: '' },
                ],
                numberOptions: 2,
                solutionMulti: [0],
            });
            // [0] is the active row and is rebuilt from the DOM (difficulty 2).
            return [make(2), make(2), make(1), make(1), make(3), make(3)];
        }

        function buildMinimalForm() {
            document.body.innerHTML = `
                <div class="idevice_node adaptative-quiz" id="idevice-42">
                    <div id="adaptativeQuizIdeviceForm">
                        <input type="radio" name="adqtype" value="0" checked />
                        <input type="radio" name="adqnumber" value="2" checked />
                        <select id="adaptativeQuizDifficulty"><option value="1">Easy</option><option value="2" selected>Medium</option><option value="3">Hard</option></select>
                        <input id="adaptativeQuizEURLImage" value="" />
                        <input id="adaptativeQuizAudio-question" value="" />
                        <input id="adaptativeQuizEQuestion" value="Sample question?" />
                        <input id="adaptativeQuizEOption0" value="A" />
                        <input id="adaptativeQuizAudio-option0" value="" />
                        <input id="adaptativeQuizEOption1" value="B" />
                        <input id="adaptativeQuizAudio-option1" value="" />
                        <input id="adaptativeQuizEOption2" value="" />
                        <input id="adaptativeQuizAudio-option2" value="" />
                        <input id="adaptativeQuizEOption3" value="" />
                        <input id="adaptativeQuizAudio-option3" value="" />
                        <input type="radio" name="adqsolution" value="0" checked />
                        <input type="checkbox" name="adqsolutionmulti" value="0" checked />
                        <input type="checkbox" name="adqsolutionmulti" value="1" />
                        <input id="adaptativeQuizEMessageOK" value="" />
                        <input id="adaptativeQuizAudio-msgHit" value="" />
                        <input id="adaptativeQuizEMessageKO" value="" />
                        <input id="adaptativeQuizAudio-msgError" value="" />
                        <input id="adaptativeQuizNumRound" value="1" />
                        <input type="checkbox" id="adaptativeQuizShuffle" checked />
                        <div id="adaptativeQuizCustomMessagesRow">
                            <input type="checkbox" id="adaptativeQuizECustomMessages" />
                        </div>
                        <div class="ADQ-EOrders" id="adaptativeQuizEOrder"></div>
                        <select id="adaptativeQuizInitialLevel"><option value="2" selected>2</option></select>
                        <input id="adaptativeQuizLevelName1" value="Easy" />
                        <input id="adaptativeQuizLevelName2" value="Medium" />
                        <input id="adaptativeQuizLevelName3" value="Hard" />
                        <input type="checkbox" id="eXeProgressReport" />
                        <input id="eXeProgressReportID" value="" />
                        <input type="checkbox" id="eXeGameShowClue" />
                        <input id="eXeGameClue" value="" />
                        <select id="eXeGamePercentajeClue"><option value="40" selected>40</option></select>
                        <input type="checkbox" id="eXeGameShowCodeAccess" />
                        <input id="eXeGameCodeAccess" value="" />
                        <input id="eXeGameMessageCodeAccess" value="" />
                        <input type="radio" name="eXeGameSCORM" value="0" checked />
                        <input id="eXeGameSCORMbuttonText" value="Save" />
                        <input id="eXeGameSCORMWeight" value="100" />
                    </div>
                </div>
            `;
        }

        it('defaults time to 0 when the form input is 0', () => {
            globalThis.$exeDevicesEdition = {
                iDevice: {
                    gamification: {
                        itinerary: {
                            getValues: () => ({
                                showClue: false,
                                clueGame: '',
                                percentageClue: 40,
                                showCodeAccess: false,
                                codeAccess: '',
                                messageCodeAccess: '',
                            }),
                        },
                        scorm: {
                            getValues: () => ({
                                isScorm: 0,
                                textButtonScorm: 'Save',
                                repeatActivity: true,
                                weighted: 100,
                            }),
                        },
                        progressBar: {
                            getValues: () => ({ evaluation: false, evaluationID: '' }),
                            setValues: () => {},
                            addEvents: () => {},
                        },
                    },
                },
            };
            if (!globalThis.tinymce) globalThis.tinymce = { get: () => null };

            buildMinimalForm();
            idevice.ideviceBody = document.querySelector('.idevice_node.adaptative-quiz');
            idevice.questionsGame = buildValidQuestions(idevice);
            idevice.active = 0;
            idevice.refreshTranslations();
            idevice.setMessagesInfo();

            // No time input in the minimal form → falls back to 0.
            const result = idevice.save();
            expect(result.time).toBe(0);
        });

        it('reads time from the #adaptativeQuizETime input and clamps it to 0..59', () => {
            globalThis.$exeDevicesEdition = {
                iDevice: {
                    gamification: {
                        itinerary: {
                            getValues: () => ({
                                showClue: false,
                                clueGame: '',
                                percentageClue: 40,
                                showCodeAccess: false,
                                codeAccess: '',
                                messageCodeAccess: '',
                            }),
                        },
                        scorm: {
                            getValues: () => ({
                                isScorm: 0,
                                textButtonScorm: 'Save',
                                repeatActivity: true,
                                weighted: 100,
                            }),
                        },
                        progressBar: {
                            getValues: () => ({ evaluation: false, evaluationID: '' }),
                            setValues: () => {},
                            addEvents: () => {},
                        },
                    },
                },
            };
            if (!globalThis.tinymce) globalThis.tinymce = { get: () => null };

            buildMinimalForm();
            const form = document.getElementById('adaptativeQuizIdeviceForm');
            const time = document.createElement('input');
            time.id = 'adaptativeQuizETime';
            time.type = 'number';
            time.value = '12';
            form.appendChild(time);

            idevice.ideviceBody = document.querySelector('.idevice_node.adaptative-quiz');
            idevice.questionsGame = buildValidQuestions(idevice);
            idevice.active = 0;
            idevice.refreshTranslations();
            idevice.setMessagesInfo();

            expect(idevice.save().time).toBe(12);

            // Out of range values are clamped.
            time.value = '120';
            expect(idevice.save().time).toBe(59);
            time.value = '-3';
            expect(idevice.save().time).toBe(0);
            time.value = '';
            expect(idevice.save().time).toBe(0);
        });

        it('restores the time field via updateFieldGame', () => {
            buildMinimalForm();
            const form = document.getElementById('adaptativeQuizIdeviceForm');
            const time = document.createElement('input');
            time.id = 'adaptativeQuizETime';
            time.type = 'number';
            time.value = '0';
            form.appendChild(time);

            globalThis.$exeDevicesEdition = {
                iDevice: {
                    gamification: {
                        itinerary: { setValues: () => {} },
                        scorm: { setValues: () => {} },
                        common: { setLanguageTabValues: () => {} },
                        share: { refreshIAPrompt: () => {} },
                        progressBar: { setValues: () => {} },
                    },
                },
            };

            idevice.ideviceBody = document.querySelector('.idevice_node.adaptative-quiz');
            idevice.showQuestion = () => {};
            idevice.refreshTranslations();
            idevice.setMessagesInfo();
            idevice.showSelectOrder = () => {};

            idevice.updateFieldGame({
                time: 15,
                questionsGame: [idevice.getCuestionDefault()],
                levelNames: ['Easy', 'Medium', 'Hard'],
            });
            expect(document.getElementById('adaptativeQuizETime').value).toBe('15');

            // Stored out-of-range value is clamped on restore.
            idevice.updateFieldGame({
                time: 999,
                questionsGame: [idevice.getCuestionDefault()],
                levelNames: ['Easy', 'Medium', 'Hard'],
            });
            expect(document.getElementById('adaptativeQuizETime').value).toBe('59');
        });

        it('returns a dataGame object when the form has a valid question', () => {
            // Stub globals that the shared edition helpers rely on.
            globalThis.$exeDevicesEdition = {
                iDevice: {
                    gamification: {
                        itinerary: {
                            getValues: () => ({
                                showClue: false,
                                clueGame: '',
                                percentageClue: 40,
                                showCodeAccess: false,
                                codeAccess: '',
                                messageCodeAccess: '',
                            }),
                        },
                        scorm: {
                            getValues: () => ({
                                isScorm: 0,
                                textButtonScorm: 'Save',
                                repeatActivity: true,
                                weighted: 100,
                            }),
                        },
                        progressBar: {
                            getValues: () => ({ evaluation: false, evaluationID: '' }),
                            setValues: () => {},
                            addEvents: () => {},
                        },
                    },
                },
            };
            if (!globalThis.tinymce) globalThis.tinymce = { get: () => null };
            if (!globalThis.tinyMCE) globalThis.tinyMCE = globalThis.tinymce;

            buildMinimalForm();
            idevice.ideviceBody = document.querySelector('.idevice_node.adaptative-quiz');
            idevice.questionsGame = buildValidQuestions(idevice);
            idevice.active = 0;
            idevice.refreshTranslations();
            idevice.setMessagesInfo();
            document.getElementById('adaptativeQuizNumRound').value = '6';
            const result = idevice.save();
            expect(result).toBeTruthy();
            expect(result.typeGame).toBe('Adaptative Quiz');
            expect(result.numRound).toBe(6);
            expect(document.getElementById('adaptativeQuizNumRound').value).toBe('6');
            expect(result.questionsGame).toHaveLength(6);
            expect(result.questionsGame[0].question).toBe('Sample question?');
            expect(result.id).toBe('idevice-42');
        });

        it('rejects save when questions per round is greater than the created questions', () => {
            globalThis.$exeDevicesEdition = {
                iDevice: {
                    gamification: {
                        itinerary: {
                            getValues: () => ({
                                showClue: false,
                                clueGame: '',
                                percentageClue: 40,
                                showCodeAccess: false,
                                codeAccess: '',
                                messageCodeAccess: '',
                            }),
                        },
                        scorm: {
                            getValues: () => ({
                                isScorm: 0,
                                textButtonScorm: 'Save',
                                repeatActivity: true,
                                weighted: 100,
                            }),
                        },
                        progressBar: {
                            getValues: () => ({ evaluation: false, evaluationID: '' }),
                            setValues: () => {},
                            addEvents: () => {},
                        },
                    },
                },
            };
            if (!globalThis.tinymce) globalThis.tinymce = { get: () => null };
            if (!globalThis.tinyMCE) globalThis.tinyMCE = globalThis.tinymce;

            buildMinimalForm();
            idevice.ideviceBody = document.querySelector('.idevice_node.adaptative-quiz');
            idevice.questionsGame = buildValidQuestions(idevice);
            idevice.active = 0;
            idevice.refreshTranslations();
            idevice.setMessagesInfo();
            document.getElementById('adaptativeQuizNumRound').value = '30';

            let alerted = '';
            const orig = globalThis.eXe.app.alert;
            globalThis.eXe.app.alert = msg => {
                alerted = msg;
            };
            try {
                const result = idevice.save();
                expect(result).toBe(false);
                expect(alerted).toBe('You must add at least 30 questions.');
                expect(document.getElementById('adaptativeQuizNumRound').value).toBe('30');
            } finally {
                globalThis.eXe.app.alert = orig;
            }
        });

        it('rejects save when an active difficulty level has fewer than two questions', () => {
            globalThis.$exeDevicesEdition = {
                iDevice: {
                    gamification: {
                        itinerary: {
                            getValues: () => ({
                                showClue: false,
                                clueGame: '',
                                percentageClue: 40,
                                showCodeAccess: false,
                                codeAccess: '',
                                messageCodeAccess: '',
                            }),
                        },
                        scorm: {
                            getValues: () => ({
                                isScorm: 0,
                                textButtonScorm: 'Save',
                                repeatActivity: true,
                                weighted: 100,
                            }),
                        },
                        progressBar: {
                            getValues: () => ({ evaluation: false, evaluationID: '' }),
                            setValues: () => {},
                            addEvents: () => {},
                        },
                    },
                },
            };
            if (!globalThis.tinymce) globalThis.tinymce = { get: () => null };
            if (!globalThis.tinyMCE) globalThis.tinyMCE = globalThis.tinymce;

            buildMinimalForm();
            idevice.ideviceBody = document.querySelector('.idevice_node.adaptative-quiz');
            idevice.questionsGame = buildValidQuestions(idevice);
            idevice.questionsGame.splice(3, 1);
            idevice.active = 0;
            idevice.refreshTranslations();
            idevice.setMessagesInfo();
            document.getElementById('adaptativeQuizNumRound').value = '5';

            let alerted = '';
            const orig = globalThis.eXe.app.alert;
            globalThis.eXe.app.alert = msg => {
                alerted = msg;
            };
            try {
                const result = idevice.save();
                expect(result).toBe(false);
                expect(alerted).toBe('Level "Easy" must have at least 2 questions.');
            } finally {
                globalThis.eXe.app.alert = orig;
            }
        });

        it('reads showSolution and timeShowSolution from the form when present', () => {
            globalThis.$exeDevicesEdition = {
                iDevice: {
                    gamification: {
                        itinerary: {
                            getValues: () => ({
                                showClue: false,
                                clueGame: '',
                                percentageClue: 40,
                                showCodeAccess: false,
                                codeAccess: '',
                                messageCodeAccess: '',
                            }),
                        },
                        scorm: {
                            getValues: () => ({
                                isScorm: 0,
                                textButtonScorm: 'Save',
                                repeatActivity: true,
                                weighted: 100,
                            }),
                        },
                        progressBar: {
                            getValues: () => ({ evaluation: false, evaluationID: '' }),
                            setValues: () => {},
                            addEvents: () => {},
                        },
                    },
                },
            };
            if (!globalThis.tinymce) globalThis.tinymce = { get: () => null };

            buildMinimalForm();
            const form = document.getElementById('adaptativeQuizIdeviceForm');
            const show = document.createElement('input');
            show.type = 'checkbox';
            show.id = 'adaptativeQuizShowSolution';
            show.checked = true;
            form.appendChild(show);
            const t = document.createElement('input');
            t.type = 'number';
            t.id = 'adaptativeQuizTimeShowSolution';
            t.value = '5';
            form.appendChild(t);

            idevice.ideviceBody = document.querySelector('.idevice_node.adaptative-quiz');
            idevice.questionsGame = buildValidQuestions(idevice);
            idevice.active = 0;
            idevice.refreshTranslations();
            idevice.setMessagesInfo();

            const result = idevice.save();
            expect(result.showSolution).toBe(true);
            expect(result.timeShowSolution).toBe(5);

            document.getElementById('adaptativeQuizECustomMessages').checked = true;
            show.checked = false;
            const resultWithoutSolutions = idevice.save();
            expect(resultWithoutSolutions.showSolution).toBe(false);
            expect(resultWithoutSolutions.customMessages).toBe(false);
        });

        it('keeps custom messages hidden and unchecked when showSolution is disabled', () => {
            // The real row carries the Bootstrap `d-flex` utility; visibility must
            // be driven by swapping `d-flex`/`d-none`, not an inline display that
            // `d-flex !important` would override.
            document.body.innerHTML = `
                <input type="checkbox" id="adaptativeQuizShowSolution" />
                <input type="number" id="adaptativeQuizTimeShowSolution" value="3" />
                <div id="adaptativeQuizCustomMessagesRow" class="d-flex align-items-center">
                    <input type="checkbox" id="adaptativeQuizECustomMessages" checked />
                </div>
            `;
            let showSelectOrderValue = null;
            idevice.showSelectOrder = value => {
                showSelectOrderValue = value;
            };

            idevice.updateSolutionFeedbackControls(false);

            const row = document.getElementById('adaptativeQuizCustomMessagesRow');
            expect(document.getElementById('adaptativeQuizTimeShowSolution').disabled).toBe(true);
            expect(document.getElementById('adaptativeQuizECustomMessages').checked).toBe(false);
            expect(row.classList.contains('d-none')).toBe(true);
            expect(row.classList.contains('d-flex')).toBe(false);
            expect(showSelectOrderValue).toBe(false);

            document.getElementById('adaptativeQuizECustomMessages').checked = true;
            idevice.updateSolutionFeedbackControls(true);

            expect(document.getElementById('adaptativeQuizTimeShowSolution').disabled).toBe(false);
            expect(row.classList.contains('d-none')).toBe(false);
            expect(row.classList.contains('d-flex')).toBe(true);
            expect(showSelectOrderValue).toBe(true);
        });

        it('rejects save when showSolution is on but timeShowSolution is 0', () => {
            globalThis.$exeDevicesEdition = {
                iDevice: {
                    gamification: {
                        itinerary: {
                            getValues: () => ({
                                showClue: false,
                                clueGame: '',
                                percentageClue: 40,
                                showCodeAccess: false,
                                codeAccess: '',
                                messageCodeAccess: '',
                            }),
                        },
                        scorm: {
                            getValues: () => ({
                                isScorm: 0,
                                textButtonScorm: 'Save',
                                repeatActivity: true,
                                weighted: 100,
                            }),
                        },
                        progressBar: {
                            getValues: () => ({ evaluation: false, evaluationID: '' }),
                            setValues: () => {},
                            addEvents: () => {},
                        },
                    },
                },
            };
            if (!globalThis.tinymce) globalThis.tinymce = { get: () => null };

            buildMinimalForm();
            const form = document.getElementById('adaptativeQuizIdeviceForm');
            const show = document.createElement('input');
            show.type = 'checkbox';
            show.id = 'adaptativeQuizShowSolution';
            show.checked = true;
            form.appendChild(show);
            const t = document.createElement('input');
            t.type = 'number';
            t.id = 'adaptativeQuizTimeShowSolution';
            t.value = '0';
            form.appendChild(t);

            idevice.ideviceBody = document.querySelector('.idevice_node.adaptative-quiz');
            idevice.questionsGame = [idevice.getCuestionDefault()];
            idevice.active = 0;
            idevice.refreshTranslations();
            idevice.setMessagesInfo();

            let alerted = '';
            const orig = globalThis.eXe.app.alert;
            globalThis.eXe.app.alert = m => {
                alerted = m;
            };
            try {
                expect(idevice.save()).toBe(false);
                expect(alerted).toBe(idevice.msgs.msgProvideTimeSolution);
            } finally {
                globalThis.eXe.app.alert = orig;
            }
        });

        it('restores showSolution and timeShowSolution via updateFieldGame and clamps invalid values', () => {
            buildMinimalForm();
            const form = document.getElementById('adaptativeQuizIdeviceForm');
            const show = document.createElement('input');
            show.type = 'checkbox';
            show.id = 'adaptativeQuizShowSolution';
            form.appendChild(show);
            const t = document.createElement('input');
            t.type = 'number';
            t.id = 'adaptativeQuizTimeShowSolution';
            form.appendChild(t);

            globalThis.$exeDevicesEdition = {
                iDevice: {
                    gamification: {
                        itinerary: { setValues: () => {} },
                        scorm: { setValues: () => {} },
                        common: { setLanguageTabValues: () => {} },
                        share: { refreshIAPrompt: () => {} },
                        progressBar: { setValues: () => {} },
                    },
                },
            };

            idevice.ideviceBody = document.querySelector('.idevice_node.adaptative-quiz');
            idevice.showQuestion = () => {};
            idevice.refreshTranslations();
            idevice.setMessagesInfo();
            let showSelectOrderValue = null;
            idevice.showSelectOrder = value => {
                showSelectOrderValue = value;
            };

            idevice.updateFieldGame({
                showSolution: false,
                timeShowSolution: 99,
                customMessages: true,
                questionsGame: [idevice.getCuestionDefault()],
                levelNames: ['Easy', 'Medium', 'Hard'],
            });
            expect(document.getElementById('adaptativeQuizShowSolution').checked).toBe(false);
            expect(document.getElementById('adaptativeQuizTimeShowSolution').value).toBe('9');
            expect(document.getElementById('adaptativeQuizTimeShowSolution').disabled).toBe(true);
            expect(document.getElementById('adaptativeQuizECustomMessages').checked).toBe(false);
            expect(document.getElementById('adaptativeQuizCustomMessagesRow').classList.contains('d-none')).toBe(true);
            expect(document.getElementById('adaptativeQuizCustomMessagesRow').classList.contains('d-flex')).toBe(false);
            expect(showSelectOrderValue).toBe(false);

            idevice.updateFieldGame({
                showSolution: true,
                timeShowSolution: undefined,
                customMessages: true,
                questionsGame: [idevice.getCuestionDefault()],
                levelNames: ['Easy', 'Medium', 'Hard'],
            });
            expect(document.getElementById('adaptativeQuizShowSolution').checked).toBe(true);
            // Default value when stored value is missing.
            expect(document.getElementById('adaptativeQuizTimeShowSolution').value).toBe('3');
            expect(document.getElementById('adaptativeQuizTimeShowSolution').disabled).toBe(false);
            expect(document.getElementById('adaptativeQuizECustomMessages').checked).toBe(true);
            expect(document.getElementById('adaptativeQuizCustomMessagesRow').classList.contains('d-none')).toBe(false);
            expect(document.getElementById('adaptativeQuizCustomMessagesRow').classList.contains('d-flex')).toBe(true);
            expect(showSelectOrderValue).toBe(true);
        });
    });

    describe('3 question types (typeSelect)', () => {
        function buildTypedForm() {
            document.body.innerHTML = `
                <div class="idevice_node adaptative-quiz" id="idevice-1">
                    <div id="adaptativeQuizIdeviceForm">
                        <input type="radio" name="adqtypeselect" value="0" id="adaptativeQuizTypeSelect" checked />
                        <input type="radio" name="adqtypeselect" value="1" id="adaptativeQuizTypeOrder" />
                        <input type="radio" name="adqtypeselect" value="2" id="adaptativeQuizTypeWord" />
                        <input type="radio" name="adqtype" value="0" id="adaptativeQuizMediaNormal" checked />
                        <input type="radio" name="adqtype" value="1" id="adaptativeQuizMediaImage" />
                        <input type="radio" name="adqnumber" value="4" checked />
                        <select id="adaptativeQuizDifficulty"><option value="1">Easy</option><option value="2" selected>Medium</option><option value="3">Hard</option></select>
                        <input id="adaptativeQuizEURLImage" value="" />
                        <input id="adaptativeQuizEAuthor" value="" />
                        <input id="adaptativeQuizEAlt" value="" />
                        <input id="adaptativeQuizAudio-question" value="" />
                        <input id="adaptativeQuizEQuestion" value="Q" />
                        <input id="adaptativeQuizEOption0" value="A" />
                        <input id="adaptativeQuizAudio-option0" value="" />
                        <input id="adaptativeQuizEOption1" value="B" />
                        <input id="adaptativeQuizAudio-option1" value="" />
                        <input id="adaptativeQuizEOption2" value="C" />
                        <input id="adaptativeQuizAudio-option2" value="" />
                        <input id="adaptativeQuizEOption3" value="D" />
                        <input id="adaptativeQuizAudio-option3" value="" />
                        <span class="ADQ-EAnswerControl" data-option-index="0"></span>
                        <span class="ADQ-EAnswerControl" data-option-index="1"></span>
                        <span class="ADQ-EAnswerControl" data-option-index="2"></span>
                        <span class="ADQ-EAnswerControl" data-option-index="3"></span>
                        <input id="adaptativeQuizESolutionWord" value="" />
                        <input id="adaptativeQuizEWord" value="" />
                        <input id="adaptativeQuizAudio-word" value="" />
                        <input id="adaptativeQuizAudio-solutionWord" value="" />
                        <div id="adaptativeQuizEQASelect"></div>
                        <div id="adaptativeQuizEQAWord" class="d-none"></div>
                        <input id="adaptativeQuizEMessageOK" value="" />
                        <input id="adaptativeQuizAudio-msgHit" value="" />
                        <input id="adaptativeQuizEMessageKO" value="" />
                        <input id="adaptativeQuizAudio-msgError" value="" />
                    </div>
                </div>
            `;
        }

        beforeEach(() => {
            buildTypedForm();
            idevice.questionsGame = [idevice.getCuestionDefault()];
            idevice.active = 0;
            idevice.refreshTranslations();
            idevice.setMessagesInfo();
            idevice.showMessage = () => {};
            // Populate the answer-control slots with checkboxes (default Select layout)
            // so tests that read/write them directly work without invoking showQuestionType.
            idevice.applyAnswerControls(0);
        });

        it('defaults typeSelect to 0 (select) in getCuestionDefault', () => {
            const q = idevice.getCuestionDefault();
            expect(q.typeSelect).toBe(0);
            expect(q.solutionMulti).toEqual([]);
            expect(q.solutionOrder).toEqual([]);
            expect(q.solutionWord).toBe('');
        });

        it('readQuestionFromDom captures multi solution for typeSelect=0', () => {
            document.querySelector('#adaptativeQuizTypeSelect').checked = true;
            document.querySelector('#adaptativeQuizESolutionMulti0').checked = true;
            document.querySelector('#adaptativeQuizESolutionMulti2').checked = true;
            const q = idevice.readQuestionFromDom();
            expect(q.typeSelect).toBe(0);
            expect(q.solutionMulti.sort()).toEqual([0, 2]);
        });

        it('readQuestionFromDom emits sequential solutionOrder for typeSelect=1', () => {
            document.querySelector('#adaptativeQuizTypeOrder').checked = true;
            document.querySelector('#adaptativeQuizTypeSelect').checked = false;
            const q = idevice.readQuestionFromDom();
            expect(q.typeSelect).toBe(1);
            // The option order in the form is the correct order, so the
            // solutionOrder is always [1, 2, ..., numberOptions].
            expect(q.solutionOrder).toEqual([1, 2, 3, 4]);
        });

        it('showQuestionType(1) removes the answer checkboxes and renders rank labels', () => {
            idevice.showQuestionType(1);
            // Sort mode replaces each row's leading control with a static
            // rank badge, so checkboxes are gone from the DOM.
            expect(document.querySelectorAll('input.ADQ-ESolutionMulti').length).toBe(0);
            expect(document.querySelectorAll('.ADQ-ESolutionOrder').length).toBe(4);
            const ranks = Array.from(document.querySelectorAll('.ADQ-ESolutionOrder')).map(el => el.textContent.trim());
            expect(ranks).toEqual(['1', '2', '3', '4']);
        });

        it('showQuestionType(0) restores the answer checkboxes and removes rank labels', () => {
            idevice.showQuestionType(1);
            idevice.showQuestionType(0);
            expect(document.querySelectorAll('input.ADQ-ESolutionMulti').length).toBe(4);
            expect(document.querySelectorAll('.ADQ-ESolutionOrder').length).toBe(0);
        });

        it('readQuestionFromDom captures word + solution + their audios for typeSelect=2', () => {
            document.querySelector('#adaptativeQuizTypeWord').checked = true;
            document.querySelector('#adaptativeQuizTypeSelect').checked = false;
            document.querySelector('#adaptativeQuizEWord').value = 'apple';
            document.querySelector('#adaptativeQuizAudio-word').value = 'word.mp3';
            document.querySelector('#adaptativeQuizESolutionWord').value = 'answer';
            document.querySelector('#adaptativeQuizAudio-solutionWord').value = 'sol.mp3';
            const q = idevice.readQuestionFromDom();
            expect(q.typeSelect).toBe(2);
            expect(q.question).toBe('apple');
            expect(q.audio).toBe('word.mp3');
            expect(q.solutionWord).toBe('answer');
            expect(q.solutionWordAudio).toBe('sol.mp3');
        });

        it('getCuestionDefault includes empty author and alt fields', () => {
            const q = idevice.getCuestionDefault();
            expect(q.author).toBe('');
            expect(q.alt).toBe('');
        });

        it('readQuestionFromDom captures author and alt when media type is image', () => {
            document.querySelector('#adaptativeQuizMediaImage').checked = true;
            document.querySelector('#adaptativeQuizMediaNormal').checked = false;
            document.querySelector('#adaptativeQuizEURLImage').value = 'pic.png';
            document.querySelector('#adaptativeQuizEAuthor').value = 'Jane Doe';
            document.querySelector('#adaptativeQuizEAlt').value = 'A red flower';
            const q = idevice.readQuestionFromDom();
            expect(q.type).toBe(1);
            expect(q.url).toBe('pic.png');
            expect(q.author).toBe('Jane Doe');
            expect(q.alt).toBe('A red flower');
        });

        it('readQuestionFromDom discards author and alt when media type is not image', () => {
            document.querySelector('#adaptativeQuizMediaNormal').checked = true;
            document.querySelector('#adaptativeQuizMediaImage').checked = false;
            document.querySelector('#adaptativeQuizEAuthor').value = 'Jane Doe';
            document.querySelector('#adaptativeQuizEAlt').value = 'A red flower';
            const q = idevice.readQuestionFromDom();
            expect(q.type).toBe(0);
            expect(q.author).toBe('');
            expect(q.alt).toBe('');
        });

        it('migrates legacy typeSelect=3 (Test) to 0 with solutionMulti from solution', () => {
            idevice.questionsGame = [
                {
                    type: 0,
                    typeSelect: 3,
                    url: '',
                    audio: '',
                    question: 'Q',
                    numberOptions: 4,
                    options: [
                        { text: 'A', audio: '' },
                        { text: 'B', audio: '' },
                        { text: 'C', audio: '' },
                        { text: 'D', audio: '' },
                    ],
                    solution: 2,
                    difficulty: 2,
                    msgHit: '',
                    msgHitAudio: '',
                    msgError: '',
                    msgErrorAudio: '',
                },
            ];
            idevice.showOptions = () => {};
            idevice.updateImagePreview = () => {};
            idevice.showQuestion(0);
            expect(idevice.questionsGame[0].typeSelect).toBe(0);
            expect(idevice.questionsGame[0].solutionMulti).toEqual([2]);
        });

        it('migrates legacy typeSelect=4 (True/False) to 0 with solutionMulti from solution', () => {
            idevice.questionsGame = [
                {
                    type: 0,
                    typeSelect: 4,
                    url: '',
                    audio: '',
                    question: 'Q',
                    numberOptions: 2,
                    options: [
                        { text: 'True', audio: '' },
                        { text: 'False', audio: '' },
                        { text: '', audio: '' },
                        { text: '', audio: '' },
                    ],
                    solution: 1,
                    difficulty: 2,
                    msgHit: '',
                    msgHitAudio: '',
                    msgError: '',
                    msgErrorAudio: '',
                },
            ];
            idevice.showOptions = () => {};
            idevice.updateImagePreview = () => {};
            idevice.showQuestion(0);
            expect(idevice.questionsGame[0].typeSelect).toBe(0);
            expect(idevice.questionsGame[0].solutionMulti).toEqual([1]);
        });

        it('validateQuestion accepts select type with zero correct answers', () => {
            // A select question with no correct answer is valid: the
            // learner is expected to submit without selecting any option
            // to score it correctly.
            document.querySelector('#adaptativeQuizTypeSelect').checked = true;
            const res = idevice.validateQuestion();
            expect(res).toBe(true);
        });

        it('validateQuestion accepts select type with one correct answer', () => {
            document.querySelector('#adaptativeQuizTypeSelect').checked = true;
            document.querySelector('#adaptativeQuizESolutionMulti0').checked = true;
            const res = idevice.validateQuestion();
            expect(res).toBe(true);
        });

        it('validateQuestion accepts select type with multiple correct answers', () => {
            document.querySelector('#adaptativeQuizTypeSelect').checked = true;
            document.querySelector('#adaptativeQuizESolutionMulti0').checked = true;
            document.querySelector('#adaptativeQuizESolutionMulti2').checked = true;
            const res = idevice.validateQuestion();
            expect(res).toBe(true);
        });

        it('validateQuestion accepts sort type when all options have text', () => {
            document.querySelector('#adaptativeQuizTypeOrder').checked = true;
            document.querySelector('#adaptativeQuizTypeSelect').checked = false;
            const res = idevice.validateQuestion();
            expect(res).toBe(true);
        });

        it('validateQuestion rejects sort type when an option text is missing', () => {
            document.querySelector('#adaptativeQuizTypeOrder').checked = true;
            document.querySelector('#adaptativeQuizTypeSelect').checked = false;
            document.querySelector('#adaptativeQuizEOption2').value = '';
            const res = idevice.validateQuestion();
            expect(res).toBe(false);
        });

        it('migrates legacy sort solutionOrder permutation by reordering options', () => {
            idevice.questionsGame = [
                {
                    type: 0,
                    typeSelect: 1,
                    url: '',
                    audio: '',
                    question: 'Q',
                    numberOptions: 4,
                    options: [
                        { text: 'A', audio: '' },
                        { text: 'B', audio: '' },
                        { text: 'C', audio: '' },
                        { text: 'D', audio: '' },
                    ],
                    // A->2, B->4, C->1, D->3 means correct order is C,A,D,B
                    solutionOrder: [2, 4, 1, 3],
                    difficulty: 2,
                    msgHit: '',
                    msgHitAudio: '',
                    msgError: '',
                    msgErrorAudio: '',
                },
            ];
            idevice.showOptions = () => {};
            idevice.updateImagePreview = () => {};
            idevice.showQuestion(0);
            const q = idevice.questionsGame[0];
            expect(q.options.map(o => o.text)).toEqual(['C', 'A', 'D', 'B']);
            expect(q.solutionOrder).toEqual([1, 2, 3, 4]);
        });

        it('validateQuestion rejects word type without solution word', () => {
            document.querySelector('#adaptativeQuizTypeWord').checked = true;
            document.querySelector('#adaptativeQuizTypeSelect').checked = false;
            document.querySelector('#adaptativeQuizEWord').value = 'apple';
            const res = idevice.validateQuestion();
            expect(res).toBe(false);
        });

        it('validateQuestion accepts word type with definition + solution word', () => {
            document.querySelector('#adaptativeQuizTypeWord').checked = true;
            document.querySelector('#adaptativeQuizTypeSelect').checked = false;
            document.querySelector('#adaptativeQuizEWord').value = 'apple';
            document.querySelector('#adaptativeQuizESolutionWord').value = 'answer';
            const res = idevice.validateQuestion();
            expect(res).toBe(true);
        });
    });

    describe('formatQuestionAsAILine', () => {
        it('formats a multi-choice (typeSelect 0) with single correct letter', () => {
            const q = {
                typeSelect: 0,
                question: 'Largest planet?',
                numberOptions: 4,
                options: [
                    { text: 'Earth' }, { text: 'Jupiter' }, { text: 'Mars' }, { text: 'Venus' },
                ],
                solutionMulti: [1],
                difficulty: 1,
            };
            expect(idevice.formatQuestionAsAILine(q)).toBe('0@0#B#Largest planet?#Earth#Jupiter#Mars#Venus');
        });

        it('formats multi-choice with multi-letter solution sorted alphabetically', () => {
            const q = {
                typeSelect: 0,
                question: 'Pick primes',
                numberOptions: 4,
                options: [{ text: '2' }, { text: '4' }, { text: '5' }, { text: '9' }],
                solutionMulti: [2, 0],
                difficulty: 2,
            };
            expect(idevice.formatQuestionAsAILine(q)).toBe('0@1#AC#Pick primes#2#4#5#9');
        });

        it('formats multi-choice with empty solution', () => {
            const q = {
                typeSelect: 0,
                question: 'No correct?',
                numberOptions: 3,
                options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }, { text: '' }],
                solutionMulti: [],
                difficulty: 3,
            };
            expect(idevice.formatQuestionAsAILine(q)).toBe('0@2##No correct?#A#B#C');
        });

        it('formats sort (typeSelect 1) using saved option order', () => {
            const q = {
                typeSelect: 1,
                question: 'Largest to smallest',
                numberOptions: 4,
                options: [{ text: 'Elephant' }, { text: 'Tiger' }, { text: 'Cat' }, { text: 'Mouse' }],
                solutionOrder: [1, 2, 3, 4],
                difficulty: 3,
            };
            expect(idevice.formatQuestionAsAILine(q)).toBe('1@2#Largest to smallest#Elephant#Tiger#Cat#Mouse');
        });

        it('formats word/definition (typeSelect 2) preserving the legacy mapping', () => {
            const q = {
                typeSelect: 2,
                question: 'Heart',
                solutionWord: 'A muscular organ that pumps blood',
                difficulty: 1,
            };
            expect(idevice.formatQuestionAsAILine(q)).toBe('2@0#Heart#A muscular organ that pumps blood');
        });

        it('returns "" for placeholder/empty questions', () => {
            expect(idevice.formatQuestionAsAILine(null)).toBe('');
            expect(idevice.formatQuestionAsAILine(idevice.getCuestionDefault())).toBe('');
        });

        it('returns "" when a multi-choice option text is empty', () => {
            const q = {
                typeSelect: 0,
                question: 'Q?',
                numberOptions: 4,
                options: [{ text: 'A' }, { text: 'B' }, { text: '' }, { text: 'D' }],
                solutionMulti: [0],
                difficulty: 2,
            };
            expect(idevice.formatQuestionAsAILine(q)).toBe('');
        });

        it('strips stray # characters from fields so the output round-trips', () => {
            const q = {
                typeSelect: 2,
                question: 'Heart#shape',
                solutionWord: 'Pumps#blood',
                difficulty: 1,
            };
            const line = idevice.formatQuestionAsAILine(q);
            expect(line).toBe('2@0#Heart shape#Pumps blood');
        });

        it('clamps an out-of-range difficulty to LEVELS bounds', () => {
            const q = {
                typeSelect: 2,
                question: 'X',
                solutionWord: 'Y',
                difficulty: 99,
            };
            // numLevels defaults to 3 -> max difficulty is 3 -> level 2.
            expect(idevice.formatQuestionAsAILine(q)).toBe('2@2#X#Y');
        });

        it('rejects sort (typeSelect 1) when there are fewer than 3 items', () => {
            const q = {
                typeSelect: 1,
                question: 'Order',
                numberOptions: 2,
                options: [{ text: 'A' }, { text: 'B' }],
                solutionOrder: [1, 2],
                difficulty: 2,
            };
            expect(idevice.formatQuestionAsAILine(q)).toBe('');
        });
    });

    describe('buildExportLines', () => {
        it('skips empty placeholder questions and emits one line per filled question', () => {
            idevice.questionsGame = [
                idevice.getCuestionDefault(),
                {
                    typeSelect: 0,
                    question: 'Q1',
                    numberOptions: 2,
                    options: [{ text: 'A' }, { text: 'B' }],
                    solutionMulti: [0],
                    difficulty: 1,
                },
                {
                    typeSelect: 2,
                    question: 'Heart',
                    solutionWord: 'Organ',
                    difficulty: 2,
                },
            ];
            expect(idevice.buildExportLines()).toEqual([
                '0@0#A#Q1#A#B',
                '2@1#Heart#Organ',
            ]);
        });

        it('round-trips through parseAIQuestionLine for all three types', () => {
            idevice.questionsGame = [
                {
                    typeSelect: 0,
                    question: 'Multi?',
                    numberOptions: 3,
                    options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }, { text: '' }],
                    solutionMulti: [0, 2],
                    difficulty: 2,
                },
                {
                    typeSelect: 1,
                    question: 'Sort',
                    numberOptions: 3,
                    options: [{ text: 'One' }, { text: 'Two' }, { text: 'Three' }, { text: '' }],
                    solutionOrder: [1, 2, 3],
                    difficulty: 1,
                },
                {
                    typeSelect: 2,
                    question: 'Heart',
                    solutionWord: 'Pumps blood',
                    difficulty: 3,
                },
            ];
            const lines = idevice.buildExportLines();
            expect(lines).toHaveLength(3);
            for (const line of lines) {
                expect(idevice.parseAIQuestionLine(line)).not.toBeNull();
            }
            const parsedSort = idevice.parseAIQuestionLine(lines[1]);
            expect(parsedSort.typeSelect).toBe(1);
            expect(parsedSort.numberOptions).toBe(3);
            expect(parsedSort.options.slice(0, 3).map(o => o.text)).toEqual(['One', 'Two', 'Three']);
        });
    });

    describe('importGame', () => {
        let alerts;
        let originalAlert;

        beforeEach(() => {
            alerts = [];
            originalAlert = global.eXe?.app?.alert;
            if (!global.eXe) global.eXe = { app: {} };
            if (!global.eXe.app) global.eXe.app = {};
            global.eXe.app.alert = msg => alerts.push(msg);
            // Insulate the test from DOM-only methods invoked by insertAIContent.
            idevice.showQuestion = () => {};
        });

        afterEach(() => {
            if (originalAlert) global.eXe.app.alert = originalAlert;
        });

        it('alerts and bails on null bytes (binary content)', () => {
            idevice.questionsGame = [];
            idevice.importGame('foo\u0000bar', 'text/plain');
            expect(alerts.length).toBe(1);
            expect(idevice.questionsGame).toEqual([]);
        });

        it('alerts when filetype is not text/plain', () => {
            idevice.questionsGame = [];
            idevice.importGame('0@0#A#Q?#A#B', 'application/xml');
            expect(alerts.length).toBe(1);
            expect(idevice.questionsGame).toEqual([]);
        });

        it('alerts when content has no usable lines', () => {
            idevice.questionsGame = [];
            idevice.importGame('   \n   \n', 'text/plain');
            expect(alerts.length).toBe(1);
        });

        it('appends parsed questions to the existing list and skips empty lines', () => {
            idevice.questionsGame = [];
            idevice.importGame('0@0#A#Q1?#A#B\n\n2@1#Heart#Pumps blood\n', 'text/plain');
            expect(alerts.length).toBe(0);
            expect(idevice.questionsGame).toHaveLength(2);
            expect(idevice.questionsGame[0].typeSelect).toBe(0);
            expect(idevice.questionsGame[0].question).toBe('Q1?');
            expect(idevice.questionsGame[1].typeSelect).toBe(2);
            expect(idevice.questionsGame[1].question).toBe('Heart');
            expect(idevice.questionsGame[1].solutionWord).toBe('Pumps blood');
        });

        it('alerts and keeps the original list when no line is valid', () => {
            const original = [{ typeSelect: 0, question: 'keep me' }];
            idevice.questionsGame = original;
            idevice.importGame('not a valid line\nalso bad\n', 'text/plain');
            expect(alerts.length).toBe(1);
            expect(idevice.questionsGame).toBe(original);
        });

        it('handles a CRLF-terminated file', () => {
            idevice.questionsGame = [];
            idevice.importGame('2@0#Heart#Organ\r\n2@1#Brain#Neural\r\n', 'text/plain');
            expect(idevice.questionsGame).toHaveLength(2);
        });

        it('accepts shorthand word#definition lines (e.g. az-quiz-game export)', () => {
            idevice.questionsGame = [];
            idevice.importGame('Heart#Pumps blood\nBrain#Neural organ\n', 'text/plain');
            expect(idevice.questionsGame).toHaveLength(2);
            expect(idevice.questionsGame[0].typeSelect).toBe(2);
            expect(idevice.questionsGame[0].question).toBe('Heart');
            expect(idevice.questionsGame[0].solutionWord).toBe('Pumps blood');
            expect(idevice.questionsGame[1].question).toBe('Brain');
        });

        it('accepts shorthand multi-choice lines without type@level prefix', () => {
            idevice.questionsGame = [];
            idevice.importGame('AC#Pick primes#2#3#4#5\nB#Pick one#A#B#C\n', 'text/plain');
            expect(idevice.questionsGame).toHaveLength(2);
            expect(idevice.questionsGame[0].typeSelect).toBe(0);
            expect(idevice.questionsGame[0].question).toBe('Pick primes');
            expect(idevice.questionsGame[0].solutionMulti).toEqual([0, 2]);
            expect(idevice.questionsGame[0].numberOptions).toBe(4);
            expect(idevice.questionsGame[1].solutionMulti).toEqual([1]);
            expect(idevice.questionsGame[1].numberOptions).toBe(3);
        });

        it('mixes canonical and shorthand lines in the same file', () => {
            idevice.questionsGame = [];
            idevice.importGame('Heart#Organ\n0@2#A#Q?#X#Y#Z\n', 'text/plain');
            expect(idevice.questionsGame).toHaveLength(2);
            expect(idevice.questionsGame[0].typeSelect).toBe(2);
            expect(idevice.questionsGame[1].typeSelect).toBe(0);
            expect(idevice.questionsGame[1].difficulty).toBe(3);
        });
    });

    describe('normalizeImportLine', () => {
        it('returns canonical lines unchanged', () => {
            expect(idevice.normalizeImportLine('0@1#A#Q?#X#Y')).toBe('0@1#A#Q?#X#Y');
            expect(idevice.normalizeImportLine('2@0#word#def')).toBe('2@0#word#def');
            expect(idevice.normalizeImportLine('1@2#Sort#a#b#c')).toBe('1@2#Sort#a#b#c');
        });

        it('rewrites word#definition shorthand to 2@1', () => {
            expect(idevice.normalizeImportLine('Heart#Pumps blood'))
                .toBe('2@1#Heart#Pumps blood');
        });

        it('rewrites multi-choice shorthand to 0@1 (uppercases letters)', () => {
            expect(idevice.normalizeImportLine('ac#Pick primes#2#3#4#5'))
                .toBe('0@1#AC#Pick primes#2#3#4#5');
            expect(idevice.normalizeImportLine('B#Q?#X#Y'))
                .toBe('0@1#B#Q?#X#Y');
        });

        it('rewrites multi-choice shorthand with empty letters (no correct answer)', () => {
            expect(idevice.normalizeImportLine('#Q?#X#Y#Z'))
                .toBe('0@1##Q?#X#Y#Z');
        });

        it('does not rewrite lines that do not match a known shorthand', () => {
            expect(idevice.normalizeImportLine('only one field')).toBe('only one field');
            expect(idevice.normalizeImportLine('not letters#Q?#X#Y'))
                .toBe('not letters#Q?#X#Y');
            // Only one option after the question -> not enough.
            expect(idevice.normalizeImportLine('A#Q?#X')).toBe('A#Q?#X');
        });

        it('returns empty string for empty input', () => {
            expect(idevice.normalizeImportLine('')).toBe('');
        });
    });

    describe('level filter', () => {
        beforeEach(() => {
            idevice.numLevels = 3;
            idevice.levelFilter = 0;
            idevice.questionsGame = [
                { ...idevice.getCuestionDefault(), question: 'Q1', difficulty: 1 },
                { ...idevice.getCuestionDefault(), question: 'Q2', difficulty: 2 },
                { ...idevice.getCuestionDefault(), question: 'Q3', difficulty: 1 },
                { ...idevice.getCuestionDefault(), question: 'Q4', difficulty: 3 },
                { ...idevice.getCuestionDefault(), question: 'Q5', difficulty: 1 },
            ];
            idevice.active = 0;
            idevice.showQuestion = () => {};
            idevice.validateQuestion = () => true;
        });

        it('getFilteredIndices returns all indices when the filter is "All"', () => {
            expect(idevice.getFilteredIndices()).toEqual([0, 1, 2, 3, 4]);
        });

        it('getFilteredIndices returns only indices whose difficulty matches the filter', () => {
            idevice.levelFilter = 1;
            expect(idevice.getFilteredIndices()).toEqual([0, 2, 4]);
            idevice.levelFilter = 3;
            expect(idevice.getFilteredIndices()).toEqual([3]);
            idevice.levelFilter = 2;
            expect(idevice.getFilteredIndices()).toEqual([1]);
        });

        it('findNeighborIndex skips questions of other levels', () => {
            idevice.levelFilter = 1;
            idevice.active = 0;
            expect(idevice.findNeighborIndex('next')).toBe(2);
            idevice.active = 2;
            expect(idevice.findNeighborIndex('next')).toBe(4);
            idevice.active = 4;
            expect(idevice.findNeighborIndex('next')).toBe(-1);
            idevice.active = 4;
            expect(idevice.findNeighborIndex('prev')).toBe(2);
            expect(idevice.findNeighborIndex('first')).toBe(0);
            expect(idevice.findNeighborIndex('last')).toBe(4);
        });

        it('nextQuestion / previousQuestion move only across the filtered level', () => {
            idevice.levelFilter = 1;
            idevice.active = 0;
            idevice.nextQuestion();
            expect(idevice.active).toBe(2);
            idevice.nextQuestion();
            expect(idevice.active).toBe(4);
            idevice.nextQuestion();
            expect(idevice.active).toBe(4);
            idevice.previousQuestion();
            expect(idevice.active).toBe(2);
            idevice.firstQuestion();
            expect(idevice.active).toBe(0);
            idevice.lastQuestion();
            expect(idevice.active).toBe(4);
        });

        it('addQuestion forces the new question to the filtered difficulty', () => {
            idevice.levelFilter = 3;
            idevice.active = 3;
            idevice.addQuestion();
            const last = idevice.questionsGame[idevice.questionsGame.length - 1];
            expect(last.difficulty).toBe(3);
            expect(idevice.active).toBe(idevice.questionsGame.length - 1);
        });

        it('removeQuestion appends an empty question of the filtered level when none remain', () => {
            idevice.questionsGame = [
                { ...idevice.getCuestionDefault(), question: 'Q1', difficulty: 1 },
                { ...idevice.getCuestionDefault(), question: 'Q2', difficulty: 2 },
            ];
            idevice.levelFilter = 1;
            idevice.active = 0;
            idevice.removeQuestion();
            expect(idevice.questionsGame).toHaveLength(2);
            expect(idevice.questionsGame[idevice.questionsGame.length - 1].difficulty).toBe(1);
            expect(idevice.questionsGame[idevice.questionsGame.length - 1].question).toBe('');
        });

        it('removeQuestion jumps to the first matching question when the active one was removed', () => {
            idevice.levelFilter = 1;
            idevice.active = 2;
            idevice.removeQuestion();
            // Original Q3 (index 2, difficulty 1) is gone; remaining matching
            // questions are at indices 0 and 3 (Q5 shifted from 4 to 3).
            expect(idevice.getFilteredIndices()).toContain(idevice.active);
            expect(idevice.questionsGame[idevice.active].difficulty).toBe(1);
        });
    });

    describe('applyLevelFilter and populateLevelFilter', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <input id="adaptativeQuizLevelName1" value="Easy" />
                <input id="adaptativeQuizLevelName2" value="Medium" />
                <input id="adaptativeQuizLevelName3" value="Hard" />
                <input id="adaptativeQuizLevelName4" value="Expert" />
                <input id="adaptativeQuizLevelName5" value="Master" />
                <select id="adaptativeQuizELevelFilter"></select>
                <select id="adaptativeQuizDifficulty">
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                </select>
                <input id="adaptativeQuizENumberQuestion" />
                <span id="adaptativeQuizENumQuestions"></span>
            `;
            idevice.numLevels = 3;
            idevice.levelFilter = 0;
            idevice.msgs = {
                msgLevelEasy: 'Easy',
                msgLevelMedium: 'Medium',
                msgLevelHard: 'Hard',
                msgLevelExpert: 'Expert',
                msgLevelMaster: 'Master',
            };
            idevice.questionsGame = [
                { ...idevice.getCuestionDefault(), difficulty: 2 },
            ];
            idevice.active = 0;
            idevice.showQuestion = () => {};
            idevice.validateQuestion = () => true;
            // Avoid overwriting questionsGame from the (mostly empty) DOM
            // inputs so each test can drive behaviour from in-memory fixtures.
            idevice.readQuestionFromDom = () => idevice.questionsGame[idevice.active];
        });

        it('populateLevelFilter renders one option per active level plus "All"', () => {
            idevice.populateLevelFilter();
            const options = Array.from(document.querySelectorAll('#adaptativeQuizELevelFilter option'));
            expect(options).toHaveLength(4);
            expect(options[0].value).toBe('0');
            expect(options[1].value).toBe('1');
            expect(options[1].textContent).toBe('Easy');
            expect(options[3].textContent).toBe('Hard');
        });

        it('populateLevelFilter resets the filter to "All" when its level no longer exists', () => {
            idevice.numLevels = 5;
            idevice.populateLevelFilter();
            idevice.levelFilter = 5;
            document.querySelector('#adaptativeQuizELevelFilter').value = '5';
            idevice.numLevels = 3;
            idevice.populateLevelFilter();
            expect(idevice.levelFilter).toBe(0);
            expect(document.querySelector('#adaptativeQuizELevelFilter').value).toBe('0');
        });

        it('applyLevelFilter repurposes the lone empty question to the chosen level', () => {
            // The starter question is empty, so switching levels must NOT
            // stack another empty placeholder; it just changes the level of
            // the one that already exists.
            idevice.applyLevelFilter('3');
            expect(idevice.levelFilter).toBe(3);
            expect(idevice.questionsGame).toHaveLength(1);
            expect(idevice.questionsGame[idevice.active].difficulty).toBe(3);
            expect(document.querySelector('#adaptativeQuizDifficulty').disabled).toBe(true);
            expect(document.querySelector('#adaptativeQuizDifficulty').value).toBe('3');
        });

        it('applyLevelFilter appends an empty question only when no real question of the chosen level exists', () => {
            idevice.questionsGame = [
                { ...idevice.getCuestionDefault(), difficulty: 1, question: 'Q1', options: [
                    { text: 'a' }, { text: 'b' }, { text: 'c' }, { text: 'd' },
                    { text: '' }, { text: '' },
                ] },
            ];
            idevice.active = 0;
            idevice.applyLevelFilter('3');
            expect(idevice.questionsGame).toHaveLength(2);
            expect(idevice.questionsGame[1].difficulty).toBe(3);
            expect(idevice.active).toBe(1);
        });

        it('applyLevelFilter drops empty placeholders left over from previous switches', () => {
            // Simulate a chain of level changes that left empty placeholders.
            idevice.questionsGame = [
                { ...idevice.getCuestionDefault(), difficulty: 1, question: 'Q1', options: [
                    { text: 'a' }, { text: 'b' }, { text: 'c' }, { text: 'd' },
                    { text: '' }, { text: '' },
                ] },
                { ...idevice.getCuestionDefault(), difficulty: 2 }, // empty placeholder
                { ...idevice.getCuestionDefault(), difficulty: 3 }, // empty placeholder
            ];
            idevice.active = 2;
            idevice.applyLevelFilter('1');
            expect(idevice.questionsGame).toHaveLength(1);
            expect(idevice.active).toBe(0);
            expect(idevice.questionsGame[0].question).toBe('Q1');
        });

        it('applyLevelFilter("0") restores "All" and re-enables the difficulty selector', () => {
            idevice.applyLevelFilter('2');
            expect(document.querySelector('#adaptativeQuizDifficulty').disabled).toBe(true);
            idevice.applyLevelFilter('0');
            expect(idevice.levelFilter).toBe(0);
            expect(document.querySelector('#adaptativeQuizDifficulty').disabled).toBe(false);
        });

        it('applyLevelFilter switches even when the current question is invalid', () => {
            // The author should be able to change the level filter at any
            // moment without being blocked by a half-finished question. The
            // partial state is just persisted to questionsGame and the new
            // filter takes effect immediately.
            let validateCalls = 0;
            idevice.validateQuestion = () => {
                validateCalls++;
                return false;
            };
            idevice.readQuestionFromDom = () => idevice.questionsGame[idevice.active];
            idevice.applyLevelFilter('3');
            expect(idevice.levelFilter).toBe(3);
            expect(validateCalls).toBe(0);
        });
    });
});
