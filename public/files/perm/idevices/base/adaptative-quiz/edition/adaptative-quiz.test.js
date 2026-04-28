import { describe, it, expect, beforeEach } from 'vitest';

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

    describe('parseAIQuestionLine', () => {
        it('parses a full 4-option line and maps level 0 to difficulty 1', () => {
            const q = idevice.parseAIQuestionLine('0@1#Q?#A#B#C#D');
            expect(q).not.toBeNull();
            expect(q.question).toBe('Q?');
            expect(q.numberOptions).toBe(4);
            expect(q.options.map(o => o.text)).toEqual(['A', 'B', 'C', 'D']);
            expect(q.solutionMulti).toEqual([1]);
            expect(q.difficulty).toBe(1);
        });

        it('maps level 1 to difficulty 2 and keeps 3 options', () => {
            const q = idevice.parseAIQuestionLine('1@0#Q?#A#B#C');
            expect(q.numberOptions).toBe(3);
            expect(q.difficulty).toBe(2);
            expect(q.solutionMulti).toEqual([0]);
            expect(q.options[3].text).toBe('');
        });

        it('maps level 2 to difficulty 3 and keeps 2 options', () => {
            const q = idevice.parseAIQuestionLine('2@1#Q?#A#B');
            expect(q.numberOptions).toBe(2);
            expect(q.difficulty).toBe(3);
            expect(q.solutionMulti).toEqual([1]);
        });

        it('rejects lines without @ separator', () => {
            expect(idevice.parseAIQuestionLine('1#Q?#A#B#C#D')).toBeNull();
        });

        it('rejects out-of-range level and solution', () => {
            expect(idevice.parseAIQuestionLine('3@1#Q?#A#B')).toBeNull();
            expect(idevice.parseAIQuestionLine('0@4#Q?#A#B')).toBeNull();
        });

        it('accepts level 3 when numLevels is 4 and maps it to difficulty 4', () => {
            const originalNumLevels = idevice.numLevels;
            idevice.numLevels = 4;
            try {
                const q = idevice.parseAIQuestionLine('3@2#Q?#A#B#C#D');
                expect(q).not.toBeNull();
                expect(q.difficulty).toBe(4);
                expect(q.solutionMulti).toEqual([2]);
                // Level 4 is still out of range even with 4 levels configured.
                expect(idevice.parseAIQuestionLine('4@0#Q?#A#B')).toBeNull();
            } finally {
                idevice.numLevels = originalNumLevels;
            }
        });

        it('still rejects level 3 when numLevels defaults to 3', () => {
            expect(idevice.numLevels).toBe(3);
            expect(idevice.parseAIQuestionLine('3@0#Q?#A#B')).toBeNull();
        });

        it('rejects lines with fewer than MIN_OPTIONS options', () => {
            expect(idevice.parseAIQuestionLine('0@0#Q?#A')).toBeNull();
        });

        it('rejects when solution index is out of range for the provided options', () => {
            expect(idevice.parseAIQuestionLine('0@3#Q?#A#B')).toBeNull();
        });

        it('rejects empty or non-string input', () => {
            expect(idevice.parseAIQuestionLine('')).toBeNull();
            expect(idevice.parseAIQuestionLine(null)).toBeNull();
            expect(idevice.parseAIQuestionLine(undefined)).toBeNull();
        });
    });

    describe('insertAIContent', () => {
        beforeEach(() => {
            idevice.questionsGame = [];
            idevice.active = -1;
            idevice.showQuestion = () => {};
        });

        it('loads valid lines and skips invalid ones', () => {
            idevice.insertAIContent(['0@1#Q1#A#B#C#D', 'garbage', '1@0#Q2#A#B']);
            expect(idevice.questionsGame).toHaveLength(2);
            expect(idevice.questionsGame[0].question).toBe('Q1');
            expect(idevice.questionsGame[0].difficulty).toBe(1);
            expect(idevice.questionsGame[1].question).toBe('Q2');
            expect(idevice.questionsGame[1].difficulty).toBe(2);
            expect(idevice.active).toBe(0);
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
    });

    describe('save', () => {
        function buildMinimalForm() {
            document.body.innerHTML = `
                <div class="idevice_node adaptative-quiz" id="idevice-42">
                    <div id="adaptativeQuizIdeviceForm">
                        <input type="radio" name="adqtype" value="0" checked />
                        <input type="radio" name="adqnumber" value="2" checked />
                        <select id="adaptativeQuizDifficulty"><option value="2" selected>2</option></select>
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
                        <input type="checkbox" id="adaptativeQuizImmediateFeedback" checked />
                        <input type="checkbox" id="adaptativeQuizECustomMessages" />
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
            idevice.questionsGame = [idevice.getCuestionDefault()];
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
            idevice.questionsGame = [idevice.getCuestionDefault()];
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
            idevice.questionsGame = [idevice.getCuestionDefault()];
            idevice.active = 0;
            idevice.refreshTranslations();
            idevice.setMessagesInfo();

            const result = idevice.save();
            expect(result).toBeTruthy();
            expect(result.typeGame).toBe('Adaptative Quiz');
            expect(result.questionsGame).toHaveLength(1);
            expect(result.questionsGame[0].question).toBe('Sample question?');
            expect(result.id).toBe('idevice-42');
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
            idevice.questionsGame = [idevice.getCuestionDefault()];
            idevice.active = 0;
            idevice.refreshTranslations();
            idevice.setMessagesInfo();

            const result = idevice.save();
            expect(result.showSolution).toBe(true);
            expect(result.timeShowSolution).toBe(5);
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
            idevice.showSelectOrder = () => {};

            idevice.updateFieldGame({
                showSolution: false,
                timeShowSolution: 99,
                questionsGame: [idevice.getCuestionDefault()],
                levelNames: ['Easy', 'Medium', 'Hard'],
            });
            expect(document.getElementById('adaptativeQuizShowSolution').checked).toBe(false);
            expect(document.getElementById('adaptativeQuizTimeShowSolution').value).toBe('9');
            expect(document.getElementById('adaptativeQuizTimeShowSolution').disabled).toBe(true);

            idevice.updateFieldGame({
                showSolution: true,
                timeShowSolution: undefined,
                questionsGame: [idevice.getCuestionDefault()],
                levelNames: ['Easy', 'Medium', 'Hard'],
            });
            expect(document.getElementById('adaptativeQuizShowSolution').checked).toBe(true);
            // Default value when stored value is missing.
            expect(document.getElementById('adaptativeQuizTimeShowSolution').value).toBe('3');
            expect(document.getElementById('adaptativeQuizTimeShowSolution').disabled).toBe(false);
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
                        <input type="radio" name="adqtype" value="0" checked />
                        <input type="radio" name="adqnumber" value="4" checked />
                        <select id="adaptativeQuizDifficulty"><option value="2" selected>2</option></select>
                        <input id="adaptativeQuizEURLImage" value="" />
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

        it('readQuestionFromDom captures definition + word + their audios for typeSelect=2', () => {
            document.querySelector('#adaptativeQuizTypeWord').checked = true;
            document.querySelector('#adaptativeQuizTypeSelect').checked = false;
            // Definition (prompt) goes in the shared Question input.
            document.querySelector('#adaptativeQuizEQuestion').value = 'Round red fruit';
            document.querySelector('#adaptativeQuizAudio-question').value = 'def.mp3';
            // Word (answer) goes in the dedicated Word input.
            document.querySelector('#adaptativeQuizEWord').value = 'apple';
            document.querySelector('#adaptativeQuizAudio-word').value = 'word.mp3';
            const q = idevice.readQuestionFromDom();
            expect(q.typeSelect).toBe(2);
            expect(q.question).toBe('Round red fruit');
            expect(q.audio).toBe('def.mp3');
            expect(q.solutionWord).toBe('apple');
            expect(q.solutionWordAudio).toBe('word.mp3');
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
            document.querySelector('#adaptativeQuizEQuestion').value = 'Round red fruit';
            const res = idevice.validateQuestion();
            expect(res).toBe(false);
        });

        it('validateQuestion accepts word type with definition + solution word', () => {
            document.querySelector('#adaptativeQuizTypeWord').checked = true;
            document.querySelector('#adaptativeQuizTypeSelect').checked = false;
            document.querySelector('#adaptativeQuizEQuestion').value = 'Round red fruit';
            document.querySelector('#adaptativeQuizEWord').value = 'apple';
            const res = idevice.validateQuestion();
            expect(res).toBe(true);
        });
    });
});
