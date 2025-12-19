/**
 * Form iDevice
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: SDWEB - Innovative Digital Solutions
 *
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    scorm: '',
    iDeviceId: 'formIdevice',
    questionsIds: ['dropdown', 'selection', 'true-false', 'fill'],
    i18n: {},
    dataIds: [],
    formPreviewId: 'formPreview',
    msgNoQuestionsId: 'msgNoQuestions',
    btnQuestionsTop: 'buttonHideShowQuestionsTop',
    btnAddTrueFalseTop: 'buttonAddTrueFalseQuestionTop',
    btnAddFillTop: 'buttonAddFillQuestionTop',
    btnAddDropdownTop: 'buttonAddDropdownQuestionTop',
    btnAddSelectionTop: 'buttonAddSelectionQuestionTop',
    btnQuestionsBottom: 'buttonHideShowQuestionsBottom',
    btnAddTrueFalseBottom: 'buttonAddTrueFalseQuestionBottom',
    btnAddFillBottom: 'buttonAddFillQuestionBottom',
    btnAddDropdownBottom: 'buttonAddDropdownQuestionBottom',
    btnAddSelectionBottom: 'buttonAddSelectionQuestionBottom',
    passRateId: 'passRateMessage',
    dropdownPassRateId: 'dropdownPassRate',
    checkCapitalizationId: 'checkCapitalization',
    checkStrictQualificationId: 'checkStrictQualification',
    checkAddBtnAnswersId: 'checkAddBtnAnswers',
    questionTopBarId: 'questionTopBar',
    iconActivityId: 'iconActivity',
    langDropdownHelpId: 'langDropdownHelp',
    langMultipleSelectionHelpId: 'langMultipleSelectionHelp',
    langSingleSelectionHelpId: 'langSingleSelectionHelp',
    langFillHelpId: 'langFillHelp',
    langTrueFalseHelpId: 'langTrueFalseHelp',
    langCheckId: 'langChekButton',
    langResetId: 'langResetButton',
    langSolutionsId: 'langSolutionsButton',
    iconSelectOne: 'rule',
    iconSelectMultiple: 'checklist_rtl',
    iconTrueFalse: 'rule',
    iconDropdown: 'expand_more',
    iconFill: 'horizontal_rule',
    indexDraggingItem: null,
    indexOverItem: null,
    dataIdQuestionBeforeEdit: '',
    questionsForm: [],
    active: 0,
    ideviceBody: '',
    idevicePreviousData: null,
    id: null,
    questions: [],
    strings: {},
    ci18n: {},
    ACTIVITY_TYPES: {
        DROPDOWN: 'dropdown',
        SELECTION: 'selection',
        TRUE_FALSE: 'true-false',
        FILL: 'fill',
    },

    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.id = $(element).attr('idevice-id');
        this.questionsForm = [];
        this.active = 0;
        this.refreshTranslations();
        this.setMessagesInfo();
        this.questions = this.generateStringsQuestions(this.questionsIds);
        this.questionsString = this.questions;
        this.createForm(this.ideviceBody);
        this.setBehaviour();
        this.loadPreviousValues();
        this.setBehaviourFormView();
        this.hideQuestionsPanel('questionsContainerTop');
        this.hideQuestionsPanel('questionsContainerBottom');
    },

    getCuestionDefault: function () {
        return {
            id: this.generateRandomId(),
            activityType: '',
            baseText: '',
            feedbackRight: '',
            feedbackWrong: '',
            suggestion: '',
            wrongAnswersValue: '',
            selectionType: 'single',
            answers: [],
            answer: '1',
            capitalization: false,
            strict: false,
            order: 0,
            customScore: 1,
            time: 0,
        };
    },

    getQuestionIndexById: function (id) {
        return this.questionsForm.findIndex((q) => q.id === id);
    },
    refreshTranslations: function () {
        this.ci18n = {
            msgScoreScorm: c_(
                "The score can't be saved because this page is not part of a SCORM package."
            ),
            msgYouScore: c_('You scores is'),
            msgScore: c_('Score'),
            msgWeight: c_('Weight'),
            msgYouLastScore: c_('The last score saved is'),
            msgOnlySaveScore: c_('You can only save the score once!'),
            msgOnlySave: c_('You can only save once'),
            msgOnlySaveAuto: c_(
                'Your score will be saved after each question. You can only play once.'
            ),
            msgSaveAuto: c_(
                'Your score will be automatically saved after each question.'
            ),
            msgSeveralScore: c_(
                'You can save the score as many times as you want'
            ),
            msgPlaySeveralTimes: c_(
                'You can do this activity as many times as you want'
            ),
            msgActityComply: c_('You have already done this activity.'),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgTypeGame: c_('Form'),
            msgStartGame: c_('Click here to start'),
            msgTime: c_('Time per question'),
            msgSaveScore: c_('Save score'),
            msgResult: c_('Result'),
            msgCheck: c_('Check'),
            msgReset: c_('Reset'),
            msgShowAnswers: c_('Show answers'),
            msgTestResultPass: c_('Congratulations! You passed the test'),
            msgTestResultNotPass: c_('Sorry. You failed the test'),
            msgTrueFalseHelp: c_(
                'Select whether the statement is true or false'
            ),
            msgDropdownHelp: c_(
                'Choose the correct answer among the options proposed'
            ),
            msgFillHelp: c_('Fill in the blanks with the appropriate word'),
            msgSingleSelectionHelp: c_(
                'Multiple choice with only one correct answer'
            ),
            msgMultipleSelectionHelp: c_(
                'Multiple choice with multiple corrects answers'
            ),
            msgPlayStart: c_('Click here to start'),
            msgTrue: c_('True'),
            msgFalse: c_('False'),
            msgNext: c_('Next'),
            msgPrevious: c_('Previous'),
            msgSuggestion: c_('Suggestion'),
        };
    },

    loadPreviousValues: function () {
        let previousData = this.idevicePreviousData;
        if (Object.keys(previousData).length === 0) return;
        let instructionsTextarea = $exeDevice.ideviceBody.querySelector(
            '#eXeGameInstructions'
        );
        if (previousData.eXeFormInstructions !== undefined) {
            instructionsTextarea.innerHTML = previousData.eXeFormInstructions;
        }

        let textAfter = $exeDevice.ideviceBody.querySelector(
            '#eXeIdeviceTextAfter'
        );
        if (previousData.eXeIdeviceTextAfter !== undefined) {
            textAfter.innerHTML = previousData.eXeIdeviceTextAfter;
        }

        if (previousData.questionsData !== undefined) {
            $exeDevice.questionsForm = previousData.questionsData.map((q) => {
                if (!q.id) {
                    q.id = $exeDevice.generateRandomId();
                }

                if (q.feedbackRight === undefined) {
                    q.feedbackRight = '';
                }

                if (q.feedbackWrong === undefined) {
                    q.feedbackWrong = '';
                }

                if (q.suggestion === undefined) {
                    q.suggestion = '';
                }

                if (
                    q.feedback !== undefined &&
                    !q.feedbackRight &&
                    !q.feedbackWrong
                ) {
                    q.feedbackRight = q.feedback;
                    delete q.feedback;
                }

                return q;
            });
            const formPreview = $exeDevice.ideviceBody.querySelector(
                `#${$exeDevice.formPreviewId}`
            );
            formPreview.innerHTML = '';
            $exeDevice.questionsForm.forEach((question, index) => {
                $exeDevice.renderQuestion(question, index);
            });
            if ($exeDevice.questionsForm.length > 0) {
                $exeDevice.ideviceBody.querySelector(
                    `#${$exeDevice.msgNoQuestionsId}`
                ).style.display = 'none';
            }
        }
        let dropdownPassRate = $exeDevice.ideviceBody.querySelector(
            `[id^="${$exeDevice.dropdownPassRateId}"]`
        );
        if (previousData[$exeDevice.dropdownPassRateId] !== undefined) {
            dropdownPassRate.value =
                previousData[$exeDevice.dropdownPassRateId];
        }

        let checkAddBtnAnswers = $exeDevice.ideviceBody.querySelector(
            `#${$exeDevice.checkAddBtnAnswersId}`
        );
        if (previousData[$exeDevice.checkAddBtnAnswersId] !== undefined) {
            checkAddBtnAnswers.checked =
                previousData[$exeDevice.checkAddBtnAnswersId];
        }

        this.ideviceBody.querySelector('#checkAddBtnAnswers').checked =
            previousData.addBtnAnswers ?? true;
        this.ideviceBody.querySelector('#evaluationCheckBox').checked =
            previousData.evaluation ?? false;
        this.ideviceBody.querySelector('#evaluationIDInput').value =
            previousData.evaluationID ?? '';
        this.ideviceBody.querySelector('#evaluationIDInput').disabled =
            !previousData.evaluation;
        this.ideviceBody.querySelector('#eXeGameSCORMRepeatActivity').checked =
            previousData.repeatActivity ?? true;
        this.ideviceBody.querySelector('#frmEQuestionsRandom').checked =
            previousData.questionsRandom || false;
        this.ideviceBody.querySelector('#frmEPercentageQuestions').value =
            previousData.percentageQuestions || 100;
        this.ideviceBody.querySelector('#frmETime').value =
            previousData.time ?? 0;
        previousData.showSlider =
            typeof previousData.showSlider !== 'undefined'
                ? previousData.showSlider
                : false;
        this.ideviceBody.querySelector('#frmEShowSlider').checked =
            previousData.showSlider;
        previousData.weighted = previousData.weighted ?? 100;
        previousData.repeatActivity = previousData.repeatActivity ?? false;
        let isscore =
            previousData.exportScorm && previousData.exportScorm.saveScore
                ? 1
                : 0;
        previousData.isScorm = previousData.isScorm ?? isscore;
        let textscorm =
            previousData.exportScorm && previousData.exportScorm.buttonTextSave
                ? previousData.exportScorm.buttonTextSave
                : _('Save score');
        previousData.textButtonScorm =
            previousData.textButtonScorm ?? textscorm;
        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            previousData.isScorm,
            previousData.textButtonScorm,
            previousData.repeatActivity,
            previousData.weighted
        );
        $exeDevicesEdition.iDevice.gamification.common.setLanguageTabValues(
            previousData.msgs
        );
        $exeDevice.updateQuestionsNumber();
    },

    save: function () {
        $exeDevice.saveInEditionQuestion();
        let scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();
        this.isScorm = scorm.isScorm;
        this.textButtonScorm = scorm.textButtonScorm;
        this.repeatActivity = scorm.repeatActivity;
        this.weighted = scorm.weighted;
        this.evaluation = this.ideviceBody.querySelector(
            '#evaluationCheckBox'
        ).checked;
        this.evaluationID =
            this.ideviceBody.querySelector('#evaluationIDInput').value;
        this.repeatActivity = this.ideviceBody.querySelector(
            '#eXeGameSCORMRepeatActivity'
        ).checked;
        this.eXeFormInstructions = this.getEditorTinyMCEValue(
            'eXeGameInstructions'
        );
        this.eXeIdeviceTextAfter = this.getEditorTinyMCEValue(
            'eXeIdeviceTextAfter'
        );
        this.questionsData = $exeDevice.getQuestionsData();
        this[$exeDevice.dropdownPassRateId] =
            $exeDevice.ideviceBody.querySelector(
                `[id^="${$exeDevice.dropdownPassRateId}"]`
            ).value;
        this[$exeDevice.checkAddBtnAnswersId] =
            $exeDevice.ideviceBody.querySelector(
                `#${$exeDevice.checkAddBtnAnswersId}`
            ).checked;
        this.showSlider =
            this.ideviceBody.querySelector('#frmEShowSlider').checked;
        this.passRate = 50;
        this.addBtnAnswers =
            $exeDevice.ideviceBody.querySelector(`#checkAddBtnAnswers`).checked;
        this.questionsRandom = this.ideviceBody.querySelector(
            '#frmEQuestionsRandom'
        ).checked;
        this.percentageQuestions = this.ideviceBody.querySelector(
            '#frmEPercentageQuestions'
        ).value;
        this.time = this.ideviceBody.querySelector('#frmETime').value;
        this.dataIds.push('eXeFormInstructions');
        this.dataIds.push('questionsData');
        this.dataIds.push($exeDevice.dropdownPassRateId);
        this.dataIds.push($exeDevice.checkAddBtnAnswersId);
        this.dataIds.push('eXeIdeviceTextAfter');
        const fields = this.ci18n,
            i18n = fields;
        for (const i in fields) {
            const fVal = $('#ci18n_' + i).val();
            if (fVal !== '') i18n[i] = fVal;
        }

        this.datamsg = i18n;
        if (this.checkFormValues()) {
            return this.getDataJson();
        } else {
            return false;
        }
    },
    importActivity: function (content, filetype) {
        $('#eXeGameExportImport .exe-field-instructions')
            .eq(0)
            .text(`${_('Supported formats')}: txt, xml(Moodle)`);
        $('#eXeGameExportImport').show();
        $('#eXeGameImportGame').attr('accept', '.txt, .xml');
        if (content && content.includes('\u0000')) {
            eXe.app.alert(msg);
            return;
        } else if (content) {
            if (filetype.match('text/plain')) {
                $exeDevice.importText(content);
            } else if (
                filetype.match('application/xml') ||
                filetype.match('text/xml')
            ) {
                $exeDevice.importCuestionaryXML(content);
            }
        }
    },

    importCuestionaryXML: function (xmlText) {
        if (!xmlText || typeof xmlText !== 'string') {
            eXe.app.alert(_('Invalid file content'));
            return false;
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const msg = _(
            'Sorry, the selected file does not contain any questions that are compatible with this activity.'
        );
        if (xmlDoc.querySelector('parsererror')) {
            eXe.app.alert(msg);
            return false;
        }

        const quiz = xmlDoc.querySelector('quiz');
        if (!quiz) {
            eXe.app.alert(msg);
            return false;
        }

        const questionsArray = [];
        quiz.querySelectorAll('question').forEach((question) => {
            const type = question.getAttribute('type');
            const questionTextElement = question.querySelector(
                'questiontext > text'
            );
            const questionText = questionTextElement
                ? questionTextElement.textContent.trim()
                : '';
            if (!questionText) return;
            if (type === 'multichoice') {
                const answerElements = question.querySelectorAll('answer');
                const answers = [];
                let correctCount = 0;
                answerElements.forEach((answer) => {
                    const fraction = parseFloat(
                        answer.getAttribute('fraction')
                    );
                    const isCorrect = fraction > 0;
                    if (isCorrect) correctCount++;
                    const ansTextElement = answer.querySelector('text');
                    const ansText = ansTextElement
                        ? ansTextElement.textContent.trim()
                        : '';
                    const clearText = $exeDevice.clearText(ansText);
                    answers.push([isCorrect, clearText]);
                });
                const selectionType = correctCount > 1 ? 'multiple' : 'single';
                questionsArray.push({
                    activityType: 'selection',
                    selectionType: selectionType,
                    baseText: `<p>${$exeDevice.clearText(questionText)}<p>`,
                    answers: answers,
                });
            } else if (type === 'truefalse') {
                const answerElements = question.querySelectorAll('answer');
                let correctAnswer = null;
                answerElements.forEach((answer) => {
                    const fraction = parseFloat(
                        answer.getAttribute('fraction')
                    );
                    if (fraction > 0) {
                        const ansTextElement = answer.querySelector('text');
                        const ansText = ansTextElement
                            ? ansTextElement.textContent.trim().toLowerCase()
                            : '';
                        correctAnswer = ansText === 'true' ? '1' : '0';
                    }
                });
                if (correctAnswer !== null) {
                    questionsArray.push({
                        activityType: 'true-false',
                        baseText: `<p>${$exeDevice.clearText(questionText)}<p>`,
                        answer: correctAnswer,
                    });
                }
            }
        });
        if (questionsArray.length) {
            $exeDevice.addQuestions(questionsArray);
        } else {
            eXe.app.alert(msg);
        }
    },
    clearText(text) {
        if (!text || typeof text !== 'string') return '';
        let sinCdata = text.replace(/<!\[CDATA\[/, '').replace(/]]$/, '');
        const container = document.createElement('div');
        container.innerHTML = sinCdata;
        let cleartext = container.textContent || container.innerText || '';
        return cleartext.replace(/\n/g, ' ').trim();
    },

    importText: function (content) {
        const lines = content.split('\n');
        $exeDevice.insertQuestions(lines);
    },

    checkQuestions: function (lines) {
        if (Array.isArray(lines) && lines.length > 0) {
            return lines;
        }

        if (typeof lines === 'string') {
            try {
                lines = JSON.parse(lines);
            } catch (error) {
                return false;
            }
        }
        if (typeof lines === 'object' && lines !== null) {
            lines = Object.values(lines);
        }

        if (Array.isArray(lines) && lines.length > 0) {
            return lines;
        }

        return false;
    },

    insertQuestions: function (lines) {
        const msg = _(
            'Sorry, the selected file does not contain any questions that are compatible with this activity.'
        );
        const slines = $exeDevice.checkQuestions(lines);
        if (!slines) {
            eXe.app.alert(msg);
            return;
        }

        const lineFormat = /^[01]#[^#]+$/,
            lineFormat0 = /^v-f#[^\s#].*?#(0|1)#.*?#.*?$/,
            lineFormat1 = /^[0-5]#[^#]+(?:#[^#]+){2,6}$/,
            lineFormat2 = /^[[A-F]{1,6}#[^#]+(?:#[^#]+){2,6}$/,
            lineFormat3 = /^[^\s#].*?#(0|1)#.*?#.*?$/;
        let questions = [];
        slines.forEach((lined) => {
            let line = $exeDevice.clearText(lined);
            if (!line) return;
            let question = null;
            if (lineFormat.test(line)) {
                question = $exeDevice.getTrueFalseQuestion(line);
            } else if (lineFormat0.test(line)) {
                question = $exeDevice.getTrueFalseQuestionExe(line);
            } else if (lineFormat1.test(line)) {
                question = $exeDevice.getTestQuestion(line);
            } else if (lineFormat2.test(line)) {
                question = $exeDevice.getTestMutiple(line);
            } else if (lineFormat3.test(line)) {
                question = $exeDevice.getTrueFalseQuestionExeSv(line);
            }

            if (question !== null) {
                questions.push(question);
            }
        });
        if (questions.length) {
            $exeDevice.addQuestions(questions);
        } else {
            eXe.app.alert(msg);
        }
    },
    getTrueFalseQuestion: function (line) {
        if (!line || typeof line !== 'string') return null;
        const linarray = line.trim().split('#');
        if (linarray.length < 2) return null;
        const solution = parseInt(linarray[0]);
        if (isNaN(solution) || (solution !== 0 && solution !== 1)) return null;
        return {
            activityType: 'true-false',
            baseText: `<p>${$exeDevice.clearText(linarray[1])}<p>`,
            answer: solution,
        };
    },

    getTrueFalseQuestionExe: function (line) {
        if (!line || typeof line !== 'string') return null;
        const linarray = line.trim().split('#');
        if (linarray.length < 4) return null;
        const solution = parseInt(linarray[2]);
        if (isNaN(solution) || (solution !== 0 && solution !== 1)) return null;
        return {
            activityType: 'true-false',
            baseText: `<p>${$exeDevice.clearText(linarray[1])}<p>`,
            answer: solution,
        };
    },

    getTrueFalseQuestionExeSv: function (line) {
        if (!line || typeof line !== 'string') return null;
        const linarray = line.trim().split('#');
        if (linarray.length < 4) return null;
        const solution = parseInt(linarray[1]) ? 1 : 0;
        return {
            activityType: 'true-false',
            baseText: `<p>${$exeDevice.clearText(linarray[0])}<p>`,
            answer: solution,
        };
    },

    getTestQuestion: function (line) {
        const parts = line.trim().split('#');
        if (parts.length < 4) return false;
        const solutionIndex = parseInt(parts[0], 10);
        const questionText = parts[1].trim();
        const answerOptions = parts.slice(2);
        const answers = answerOptions.map((option, index) => {
            const isCorrect = index === solutionIndex;
            return [isCorrect, option.trim()];
        });
        let question = {
            activityType: 'selection',
            selectionType: 'single',
            baseText: `<p>${$exeDevice.clearText(questionText)}<p>`,
            answers: answers,
        };
        return question;
    },

    getTestMutiple: function (line) {
        const parts = line.trim().split('#');
        if (parts.length < 3) {
            return null;
        }

        const solutionLetters = parts[0].trim().toUpperCase();
        const questionText = parts[1].trim();
        const options = parts.slice(2);
        const answers = options.map((option, index) => {
            const letter = String.fromCharCode('A'.charCodeAt(0) + index);
            const isCorrect = solutionLetters.includes(letter);
            return [isCorrect, option.trim()];
        });
        return {
            activityType: 'selection',
            selectionType: 'multiple',
            baseText: `<p>${$exeDevice.clearText(questionText)}</p>`,
            answers: answers,
        };
    },

    addQuestions: function (newData) {
        if (!newData || newData.length === 0) {
            eXe.app.alert(
                _('Sorry, there are no questions for this type of activity.')
            );
            return;
        }

        newData.forEach((q) => {
            if (!q.id) {
                q.id = $exeDevice.generateRandomId();
            }

            if (q.feedbackRight === undefined) {
                q.feedbackRight = '';
            }

            if (q.feedbackWrong === undefined) {
                q.feedbackWrong = '';
            }

            if (q.suggestion === undefined) {
                q.suggestion = '';
            }

            if (
                q.feedback !== undefined &&
                !q.feedbackRight &&
                !q.feedbackWrong
            ) {
                q.feedbackRight = q.feedback;
                delete q.feedback;
            }
        });
        $exeDevice.questionsForm.push(...newData);
        const startIndex = $exeDevice.questionsForm.length - newData.length;
        newData.forEach((question, i) => {
            $exeDevice.renderQuestion(question, startIndex + i);
        });
        this.setBehaviourFormView();
        $exeDevice.hideQuestionsPanel('questionsContainerTop');
        $exeDevice.hideQuestionsPanel('questionsContainerBottom');
        $exeDevice.updateQuestionsNumber();
        //$('.exe-form-tabs li:first-child a').click();
        if ($exeDevice.questionsForm.length > 0) {
            $exeDevice.ideviceBody.querySelector(
                `#${$exeDevice.msgNoQuestionsId}`
            ).style.display = 'none';
        }
    },
    checkFormValues: function () {
        if (this.evaluation && this.evaluationID.length < 5) {
            eXe.app.alert(
                _('The report identifier must have at least 5 characters')
            );
            return false;
        }

        if (this.questionsData.length < 1) {
            eXe.app.alert(_('Please add at least one question'));
            return false;
        }

        return true;
    },

    getDataJson: function () {
        let data = {};
        data.ideviceId = this.ideviceBody.getAttribute('idevice-id');
        data.evaluation = this.evaluation;
        data.evaluationID = this.evaluationID;
        data.repeatActivity = this.repeatActivity;
        data.isScorm = this.isScorm;
        data.textButtonScorm = this.textButtonScorm;
        data.weighted = this.weighted;
        data.msgs = this.datamsg;
        data.id = data.ideviceId;
        data.questionsRandom = this.questionsRandom;
        data.percentageQuestions = this.percentageQuestions;
        data.time = this.time;
        data.eXeFormInstructions = this.eXeFormInstructions;
        data.questionsData = this.questionsData;
        data.passRate = 5;
        data.addBtnAnswers = this.addBtnAnswers;
        data.eXeIdeviceTextAfter = this.eXeIdeviceTextAfter;
        data.showSlider = this.showSlider;
        return data;
    },

    setBehaviourFormView: function () {
        this.behaviourButtonsQuestionInFormViewAll(
            `ul#${$exeDevice.formPreviewId} .FormView_question .QuestionLabel_actionButton`
        );
        this.addSortableBehaviour();
        this.disableArrowUpDown();
    },

    getEditorTinyMCEValue: function (id) {
        if (tinyMCE.editors[id].getContent() === '<p>undefined</p>') {
            return '';
        } else {
            return tinyMCE.editors[id].getContent();
        }
    },
    getQuestionsData() {
        return $exeDevice.questionsForm;
    },

    updateQuestionsNumber: function () {
        let percentage = parseInt(
            $exeDevice.removeTags($('#frmEPercentageQuestions').val())
        );
        if (isNaN(percentage)) return;
        percentage = Math.min(Math.max(percentage, 1), 100);
        let numq = $exeDevice.getQuestionsData().length;
        const totalQuestions = numq || 1;
        let num = Math.max(Math.round((percentage * totalQuestions) / 100), 1);
        $('#frmENumeroPercentaje').text(`${num}/${totalQuestions}`);
    },

    removeTags: function (str) {
        const wrapper = $('<div></div>');
        wrapper.html(str);
        return wrapper.text();
    },

    setMessagesInfo: function () {
        this.strings.msgEGeneralSettings = _('General settings');
        this.strings.msgESCORM = _('SCORM');
        this.strings.msgELanguageSettings = _('Language settings');
        this.strings.msgELanguageShare = _('Share');
        this.strings.msgEInstructions = _('Instructions');
        this.strings.msgEActivity = _('Activity');
        this.strings.msgEQuestion = _('Question');
        this.strings.msgEAddDropdownQuestion = _(
            'Add a dropdown question to form'
        );
        this.strings.msgEAddFillQuestion = _('Add a fill question to form');
        this.strings.msgEAddTrueFalseQuestion = _(
            'Add a true-false question to form'
        );
        this.strings.msgEAddSelectionQuestion = _(
            'Add a selection question to form'
        );
        this.strings.msgEAddQuestion = _('Add this question to form');
        this.strings.msgESaveQuestion = _('Save');
        this.strings.msgECancelQuestion = _('Cancel');
        this.strings.msgERemoveQuestion = _('Remove');
        this.strings.msgEFormView = _('Form preview');
        this.strings.msgEText = _('Text');
        this.strings.msgEQuestionType = _('Question type');
        this.strings.msgEShowHideWord = _('Show/Hide word');
        this.strings.msgEAddOption = _('Add new option');
        this.strings.msgOtherWords = _('Other words');
        this.strings.msgExampleOtherWords = _('cat|dog|fish');
        this.strings.msgCheck = _('Check');
        this.strings.msgETrue = _('True');
        this.strings.msgEFalse = _('False');
        this.strings.msgNoQuestions = _('No questions in the form');
        this.strings.msgPassRate = _('Set the pass mark');
        this.strings.msgAddBtnAnswers = _(
            'Include a button to display the answers'
        );
        this.strings.msgCapitalization = _('Check capitalization');
        this.strings.msgStrictQualification = _('Strict qualification');
        this.strings.msgInstructionsQuestion = _(
            'The question should be clear and unambiguous. Avoid negative premises as they tend to be ambiguous.'
        );
        this.strings.msgInstructionsSelection =
            _(
                `Click the toggle button to switch between questions with one correct answer and questions with many possible correct answers.`
            ) +
            ' ' +
            this.strings.msgInstructionsQuestion;
        this.strings.msgInstructionsDropdown = _(
            `Enter the text for the drop-down activity in the drop-down field either by pasting the text from another source or by typing it directly into the field. To select which words to choose, double-click on a word to select it and click on the button below.`
        );
        this.strings.msgInstructionsDropdownOtherWords = _(
            'Optional: You can type other words to complete the drop-down activity. Use the vertical bar to separate the words. This field can be left blank.'
        );
        this.strings.msgInstructionsFill = _(
            `Type or paste the text for the fill-in-the-blank activity into the field. Select the words and use the button below to hide them. You can define more than one possible answer using vertical bars to surround and separate them. E.g.: |dog|cat|bird|`
        );
        this.strings.msgInstructionsFillCapitalization = _(
            'If this option is checked, submitted answers with different capitalization will be marked as incorrect'
        );
        this.strings.msgInstructionsFillStrictQualification = _(
            `If unchecked, a small number of spelling and capitalization errors will be accepted. If checked, no spelling or capitalization errors will be accepted. Example: If the correct answer is Elephant and it says elephant or Eliphant, both will be considered as "close enough" by the algorithm, as there is only one spelling error, even if "Check capitalization" is checked. If the case check is disabled in this example, the lowercase letter e is not considered an error and eliphant will also be accepted. If "Strict qualification" and "Check capitalization" are enabled, the only correct answer is "Elephant". If only "Strict qualification" is enabled and "Check capitalization" is not, "elephant" will also be accepted.`
        );
        this.strings.msgInstructionsFillCapitalize = _(
            `If this option is checked, answers submitted with case differences will be marked as incorrect.`
        );
        this.strings.msgConfirmRemoveQuestion = _(
            "Are you sure you want to delete this question? This can't be undone."
        );
        this.strings.msgConfirmCancelEdit = _(
            "Are you sure you want to discard the changes? This can't be undone."
        );
        this.strings.questDropdown = _('Dropdown');
        this.strings.questSelection = _('Selection');
        this.strings.questTrueFalse = _('True-False');
        this.strings.questFill = _('Fill');
        this.strings.msgLangTrueFalseHelp = _(
            'Select whether the statement is true or false'
        );
        this.strings.msgLangDropdownHelp = _(
            'Choose the correct answer among the options proposed'
        );
        this.strings.msgLangFillHelp = _(
            'Fill in the blanks with the appropriate word'
        );
        this.strings.msgLangSingleSelectionHelp = _(
            'Multiple choice with only one correct answer'
        );
        this.strings.msgLangMultipleSelectionHelp = _(
            'Multiple choice with multiple corrects answers'
        );
        this.strings.msgLangCheck = _('Check');
        this.strings.msgLangResetId = _('Reset');
        this.strings.msgLangSolutionsId = _('Show Solutions');
        this.strings.questionsStringsByID = {
            dropdown: this.strings.questDropdown,
            selection: this.strings.questSelection,
            'true-false': this.strings.questTrueFalse,
            fill: this.strings.questFill,
        };
    },

    generateStringsQuestions: function (questions) {
        let qStrings = {};
        questions.forEach((question) => {
            if (this.strings.questionsStringsByID[question]) {
                qStrings[question] =
                    this.strings.questionsStringsByID[question];
            }
        });
        return qStrings;
    },

    createForm(ideviceBody) {
        const html = `<div id="formIdeviceForm">
                <p class="exe-block-info exe-block-dismissible">${_('Create quizzes with multiple-choice, true/false and fill-in-the-blank questions.')}</p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Complete the questions in the following quiz'))}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_('Options')}</a></legend>
                        <div>
                            <div class="mb-3">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" name="frmEShowSlider" id="frmEShowSlider" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="frmEShowSlider">${_('Slides list')}</label>
                                </span>
                            </div>
                            <div class="mb-3">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="frmEQuestionsRandom" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="frmEQuestionsRandom">${_('Random questions')}.</label>
                                </span>
                            </div>
                            <div id="frmETimeDiv" class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <label for="frmETime" class="mb-0">${_('Time (minutes)')}: </label>
                                <input type="number" name="frmETime" id="frmETime" value="0" min="0" max="59" class="form-control" style="width:6ch" />
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <label for="frmEPercentageQuestions" class="mb-0">%${_('Questions')}: </label>
                                <input type="number" name="frmEPercentageQuestions" id="frmEPercentageQuestions" value="100" min="1" max="100" class="form-control" style="width:6ch" />
                                <span id="frmENumeroPercentaje">1/1</span>
                            </div>
                            <!-- Pass Rate Dropdown -->
                            <div class="question-button inline mb-3" style="display:none;">
                                <span id="${$exeDevice.passRateId}">${this.strings.msgPassRate}</span>
                                ${this.createPassRateDropdown('formIdevice')}
                            </div>            
                            <!-- Show Answers Checkbox -->
                            <div id="${$exeDevice.checkAddBtnAnswersId}_container" class="mb-3">
                                <span class="toggle-item" role="switch" aria-checked="true">
                                    <span class="toggle-control">
                                        <input type="checkbox" name="checkShowAnswers" id="${$exeDevice.checkAddBtnAnswersId}" class="toggle-input" checked />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="${$exeDevice.checkAddBtnAnswersId}">${this.strings.msgAddBtnAnswers}</label>
                                </span>
                            </div>
                            <!-- Evaluation -->
                            <div class="Games-Reportdiv d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="evaluationCheckBox" class="toggle-input" data-target="#formEvaluationIDWrapper" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="evaluationCheckBox">${_('Progress report')}. </label>
                                </span>
                                <span id="formEvaluationIDWrapper" class="d-flex align-items-center gap-2 flex-nowrap" style="display:none;">
                                    <label for="evaluationIDInput" class="mb-0">${_('Identifier')}: </label>
                                    <input type="text" id="evaluationIDInput" disabled value="${eXeLearning.app.project.odeId || ''}" class="form-control" />
                                </span>
                                <strong class="GameModeLabel"><a href="" id="helpLinkButton" class="GameModeHelpLink" title="${_('Help')}"><img src="${$exeDevice.idevicePath}quextIEHelp.png" width="18" height="18" alt="${_('Help')}"/></a></strong>
                            </div>
                            <div id="evaluationHelp" style="display:none">
                                <p class="exe-block-info exe-block-dismissible">${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}</p>
                            </div>
                        </div>
                    </fieldset>
                    <fieldset class="exe-fieldset">
                        <legend><a href="#" >${_('Questions')}</a></legend>
                            <div>                
                                <!-- Top Questions Container -->
                                <div class="container-add-questions">
                                    ${this.createIconHTML($exeDevice.btnQuestionsTop, 'add', _('Show questions'), 'show-questions')}
                                    <div id="questionsContainerTop" class="dropdown-popup">
                                        ${this.createButtonHTML($exeDevice.btnAddTrueFalseTop, this.strings.questTrueFalse, this.strings.msgEAddTrueFalseQuestion, 'add-question-button')}
                                        ${this.createButtonHTML($exeDevice.btnAddFillTop, this.strings.questFill, this.strings.msgEAddFillQuestion, 'add-question-button')}
                                        ${this.createButtonHTML($exeDevice.btnAddDropdownTop, this.strings.questDropdown, this.strings.msgEAddDropdownQuestion, 'add-question-button')}
                                        ${this.createButtonHTML($exeDevice.btnAddSelectionTop, this.strings.questSelection, this.strings.msgEAddSelectionQuestion, 'add-question-button')}
                                    </div>
                                </div>
                                <!-- No Questions Message -->
                                <div id="${$exeDevice.msgNoQuestionsId}" class="container">${this.strings.msgNoQuestions}</div>
                                <!-- Form Preview -->
                                <div class="container">
                                    <ul id="${$exeDevice.formPreviewId}"></ul>
                                </div>
                                <!-- Bottom Questions Container -->
                                <div class="container-add-questions">
                                ${this.createIconHTML($exeDevice.btnQuestionsBottom, 'add', _('Show questions'), 'show-questions')}
                                <div id="questionsContainerBottom" class="dropup-popup">
                                    ${this.createButtonHTML($exeDevice.btnAddTrueFalseBottom, this.strings.questTrueFalse, this.strings.msgEAddTrueFalseQuestion, 'add-question-button')}
                                    ${this.createButtonHTML($exeDevice.btnAddFillBottom, this.strings.questFill, this.strings.msgEAddFillQuestion, 'add-question-button')}
                                    ${this.createButtonHTML($exeDevice.btnAddDropdownBottom, this.strings.questDropdown, this.strings.msgEAddDropdownQuestion, 'add-question-button')}
                                    ${this.createButtonHTML($exeDevice.btnAddSelectionBottom, this.strings.questSelection, this.strings.msgEAddSelectionQuestion, 'add-question-button')}
                                </div>
                            </div>
                        </div>
                    </fieldset>
                    ${$exeDevicesEdition.iDevice.common.getTextFieldset('after')}
                </div>
                ${$exeDevicesEdition.iDevice.gamification.scorm.getTab(true)}
                ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab($exeDevice.ci18n)}
                ${$exeDevicesEdition.iDevice.gamification.share.getTab(true, 7, false)}
                ${$exeDevicesEdition.iDevice.gamification.share.getTabIA(7)}
            </div>            
            `;
        ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('formIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();
    },

    setBehaviour() {
        this.behaviourExeTabs();
        this.behaviourButtonHideShowQuestions($exeDevice.btnQuestionsTop);
        this.behaviourButtonAddTrueFalseQuestion(
            $exeDevice.btnAddTrueFalseTop,
            'afterbegin'
        );
        this.behaviourButtonAddFillQuestion(
            $exeDevice.btnAddFillTop,
            'afterbegin'
        );
        this.behaviourButtonAddDropdownQuestion(
            $exeDevice.btnAddDropdownTop,
            'afterbegin'
        );
        this.behaviourButtonAddSelectionQuestion(
            $exeDevice.btnAddSelectionTop,
            'afterbegin'
        );
        this.behaviourButtonHideShowQuestions($exeDevice.btnQuestionsBottom);
        this.behaviourButtonAddTrueFalseQuestion(
            $exeDevice.btnAddTrueFalseBottom,
            'beforeend'
        );
        this.behaviourButtonAddFillQuestion(
            $exeDevice.btnAddFillBottom,
            'beforeend'
        );
        this.behaviourButtonAddDropdownQuestion(
            $exeDevice.btnAddDropdownBottom,
            'beforeend'
        );
        this.behaviourButtonAddSelectionQuestion(
            $exeDevice.btnAddSelectionBottom,
            'beforeend'
        );
        this.behaviourEvaluation();
        const initToggle = function ($input) {
            const checked = $input.is(':checked');
            $input
                .closest('.toggle-item[role="switch"]')
                .attr('aria-checked', checked);
            const targetSel = $input.data('target');
            if (targetSel) {
                const $target = $(targetSel);
                if (checked) {
                    $target.css('display', 'flex');
                } else {
                    $target.hide();
                }
            }
        };
        $('.toggle-input').each(function () {
            initToggle($(this));
        });
        $(document).on('change', '.toggle-input', function () {
            initToggle($(this));
        });
        $exeDevicesEdition.iDevice.gamification.share.addEvents(
            7,
            $exeDevice.insertQuestions
        );
        if (
            window.File &&
            window.FileReader &&
            window.FileList &&
            window.Blob
        ) {
            $('#eXeGameExportImport .exe-field-instructions')
                .eq(0)
                .text(`${_('Supported formats')}: txt, xml(Moodle)`);
            $('#eXeGameExportImport').show();
            $('#eXeGameImportGame').attr('accept', '.txt, .xml');
            $('#eXeGameExportImport').show();
            $('#eXeGameImportGame').on('change', function (e) {
                const file = e.target.files[0];
                if (!file) {
                    return;
                }

                if (
                    !file.type ||
                    !(
                        file.type.match('text/plain') ||
                        file.type.match('application/xml') ||
                        file.type.match('text/xml')
                    )
                ) {
                    eXe.app.alert(
                        _(
                            'Please select a text file (.txt) or a Moodle XML file (.xml)'
                        )
                    );
                    return;
                }

                const reader = new FileReader();
                reader.onload = function (e) {
                    $exeDevice.importActivity(e.target.result, file.type);
                };
                reader.readAsText(file);
            });
        } else {
            $('#eXeGameExportImport').hide();
        }
    },
    getDefaultLangValues() {
        let defaultLang = {};
        defaultLang[_('True/False Help Text:')] = [
            $exeDevice.langTrueFalseHelpId,
            this.strings.msgLangTrueFalseHelp,
        ];
        defaultLang[_('Fill Help Text:')] = [
            $exeDevice.langFillHelpId,
            this.strings.msgLangFillHelp,
        ];
        defaultLang[_('Dropdown Help Text:')] = [
            $exeDevice.langDropdownHelpId,
            this.strings.msgLangDropdownHelp,
        ];
        defaultLang[_('Single Selection Help Text:')] = [
            $exeDevice.langSingleSelectionHelpId,
            this.strings.msgLangSingleSelectionHelp,
        ];
        defaultLang[_('Multiple Selection Help Text:')] = [
            $exeDevice.langMultipleSelectionHelpId,
            this.strings.msgLangMultipleSelectionHelp,
        ];
        defaultLang[_('Text for the button to check the answers:')] = [
            $exeDevice.langCheckId,
            this.strings.msgLangCheck,
        ];
        defaultLang[_('Text for the button to reset the answers:')] = [
            $exeDevice.langResetId,
            this.strings.msgLangResetId,
        ];
        defaultLang[_('Text for the button to show the solutions:')] = [
            $exeDevice.langSolutionsId,
            this.strings.msgLangSolutionsId,
        ];
        return defaultLang;
    },

    getCustomizableLangFields() {
        const langValues = this.getDefaultLangValues();
        const fields = Object.entries(langValues)
            .map(([key, value]) => {
                return `<div class="lang-option">
                            <label for="${value[0]}">${key}</label>
                            ${this.createInputText(value[0], value[1])}
                        </div>`;
            })
            .join('');
        return `<div class="grid-container">
                        ${fields}
                    </div>`;
    },

    createInstructionsFieldset() {
        return `<fieldset class="exe-fieldset exe-fieldset-closed">
                    <legend><a href="#">${this.strings.msgEInstructions}</a></legend>
                    <div>
                    <p id="IdeviceForm_Instructions">
                        ${this.createTextArea('eXeFormInstructions')}
                    </p>
                    </div>
                </fieldset>`;
    },

    createIconHTML(id, text, title, extraClass) {
        let titleText = title ? title : '';
        let iconClass = extraClass ? extraClass : '';
        return `<button id="${id}" class="exe-icon ${iconClass}" title="${titleText}">
                    ${text}
                </button>`;
    },

    createButtonHTML(id, text, title, extraClass) {
        let titleText = title ? title : '';
        let buttonClass = extraClass ? extraClass : '';
        return `<button id="${id}" class="exe-button ${buttonClass}" title="${titleText}">
                    ${text}
                    </button>`;
    },

    behaviourButtonHideShowQuestions(selectorId) {
        const button = $exeDevice.ideviceBody.querySelector(`#${selectorId}`);
        const questionButtonsContainer = button.nextElementSibling;
        button.addEventListener('click', function () {
            const allQuestionsContainers =
                $exeDevice.ideviceBody.querySelectorAll(
                    '[id^="questionsContainer"]'
                );
            const btnsShowQuestions = $exeDevice.ideviceBody.querySelectorAll(
                `[id^="buttonHideShowQuestions"]`
            );
            if (this.classList.contains('hide-questions')) {
                questionButtonsContainer.style.display = 'none';
                this.classList.replace('hide-questions', 'show-questions');
                this.classList.remove('exe-icon-clicked');
                this.title = _('Show questions');
            } else {
                allQuestionsContainers.forEach((container) => {
                    container.style.display = 'none';
                    container.previousElementSibling.classList.replace(
                        'hide-questions',
                        'show-questions'
                    );
                    container.previousElementSibling.title =
                        _('Show questions');
                });
                btnsShowQuestions.forEach((btn) =>
                    btn.classList.remove('exe-icon-clicked')
                );
                questionButtonsContainer.style.display = '';
                this.classList.replace('show-questions', 'hide-questions');
                this.classList.add('exe-icon-clicked');
                this.title = _('Hide questions');
            }
        });
    },

    hideQuestionsPanel(id) {
        $exeDevice.ideviceBody.querySelector(`#${id}`).style.display = 'none';
    },

    behaviourButtonAddTrueFalseQuestion(selectorId, relativePosition) {
        $exeDevice.ideviceBody
            .querySelector(`#${selectorId}`)
            .addEventListener('click', function () {
                $exeDevice.saveInEditionQuestion();
                const trueFalseQuestion = $exeDevice.createTrueFalseQuestion();
                const formPreview = $exeDevice.ideviceBody.querySelector(
                    `#${$exeDevice.formPreviewId}`
                );
                formPreview.insertAdjacentHTML(
                    relativePosition,
                    `<li class="FormView_question">${trueFalseQuestion}</li>`
                );
                $exeTinyMCE.init('multiple-visible', '.exe-html-editor');
                $exeDevice.behaviourButtonSaveQuestion('true-false');
                $exeDevice.behaviourButtonRemoveQuestion();
                const questionTitleContainer =
                    $exeDevice.ideviceBody.querySelector(
                        '#formPreviewTextareaContainer div'
                    );
                const questionTitle = $exeDevice.ideviceBody.querySelector(
                    '#formPreviewTextareaContainer label'
                );
                questionTitle.classList.add('instructions');
                $exeDevice.showQuestionInstructions(
                    questionTitleContainer,
                    $exeDevice.strings.msgInstructionsQuestion
                );
                $exeDevice.ideviceBody.querySelector(
                    `#${$exeDevice.msgNoQuestionsId}`
                ).style.display = 'none';
                this.parentElement.previousElementSibling.click();
                $exeDevice.disableArrowUpDown();
            });
    },

    createTrueFalseQuestion(edit = false) {
        const textareaId = `${$exeDevice.formPreviewId}Textarea_${this.generateRandomId()}`;
        return `<div id="${$exeDevice.formPreviewId}TextareaContainer" class="questionTextarea">
                        <div class="inline instructions">
                        <span id="${$exeDevice.iconActivityId}_${this.generateRandomId}" class="inline-icon">${$exeDevice.iconTrueFalse}</span>
                        ${this.createActivityTitle('true-false')}
                        <button class="inline-icon help-icon">help_center</button>
                        </div>
                        ${this.createTextArea(textareaId)}
                        ${this.showTrueFalseRadioButtons(`${$exeDevice.formPreviewId}TrueFalseRadioButtons`)}
                        ${this.createFeedbackFieldset($exeDevice.formPreviewId)}
                        <div class="inline footer-buttons-container">
                        ${this.createSaveQuestionButton()}
                        ${edit ? this.createCancelQuestionButton() : ''}
                        ${this.createRemoveQuestionButton()}
                        </div>
                    </div>`;
    },

    behaviourButtonAddSelectionQuestion(selectorId, relativePosition) {
        $exeDevice.ideviceBody
            .querySelector(`#${selectorId}`)
            .addEventListener('click', function () {
                $exeDevice.saveInEditionQuestion();
                const selectionQuestion = $exeDevice.createSelectionQuestion();
                const formPreview = $exeDevice.ideviceBody.querySelector(
                    `#${$exeDevice.formPreviewId}`
                );
                formPreview.insertAdjacentHTML(
                    relativePosition,
                    `<li class="FormView_question">${selectionQuestion}</li>`
                );
                $exeTinyMCE.init('multiple-visible', '.exe-html-editor', {
                    forced_root_block: '',
                    forced_br_newlines: true,
                    force_p_newlines: false,
                });
                $exeDevice.behaviourToggleOneMultipleAnswer(
                    'buttonRadioCheckboxToggle'
                );
                $exeDevice.behaviourButtonAddOption(
                    `${$exeDevice.formPreviewId}_buttonAddOption`
                );
                $exeDevice.behaviourButtonSaveQuestion('selection');
                $exeDevice.behaviourButtonRemoveQuestion();
                const questionTitleContainer =
                    $exeDevice.ideviceBody.querySelector(
                        '#formPreviewTextareaContainer div'
                    );
                const questionTitle = $exeDevice.ideviceBody.querySelector(
                    '#formPreviewTextareaContainer label'
                );
                questionTitle.classList.add('instructions');
                $exeDevice.showQuestionInstructions(
                    questionTitleContainer,
                    $exeDevice.strings.msgInstructionsSelection
                );
                $exeDevice.ideviceBody.querySelector(
                    `#${$exeDevice.msgNoQuestionsId}`
                ).style.display = 'none';
                this.parentElement.previousElementSibling.click();
                $exeDevice.disableArrowUpDown();
            });
    },

    createSelectionQuestion(edit = false) {
        const textareaId = `${$exeDevice.formPreviewId}Textarea_${this.generateRandomId()}`;
        const optionTextareaId = `${$exeDevice.formPreviewId}Textarea_${this.generateRandomId()}`;
        const firstOption = `<div id="option_1_container" class="question-button inline">
               <input type="radio" name="options" id="option_1" checked>  
                  <label for="option_1">                    
                    ${_('Option')} 1
                  </label>
                  <button id="remove_option_1" class="exe-icon exe-icon-remove remove-option">close</button>
                </div>
                ${this.createTextArea(optionTextareaId, 'small-textarea')}`;
        return `<div id="${$exeDevice.formPreviewId}TextareaContainer" class="questionTextarea">
                    <div class="inline instructions">
                    <span id="${$exeDevice.iconActivityId}_${this.generateRandomId}" class="inline-icon">${$exeDevice.iconSelectOne}</span>
                    ${this.createActivityTitle('selection')}
                    <button class="inline-icon help-icon">help_center</button>
                    </div>
                    <div class="inline">
                    <button id="buttonRadioCheckboxToggle" class="inline-icon toggle-icon" 
                            aria-labelledby="toggle_single_multiple" selection-type="single">toggle_off</button>
                    <span id="toggle_single_multiple">${_('Answer type: Single')}</span>
                    </div>
                    ${this.createTextArea(textareaId)}
                    ${firstOption}
                    <input type="button" id="${$exeDevice.formPreviewId}_buttonAddOption" 
                        value="${this.strings.msgEAddOption}" class="question-button"/>
                    ${this.createFeedbackFieldset($exeDevice.formPreviewId)}
                    <div class="inline footer-buttons-container">
                    ${this.createSaveQuestionButton()}
                    ${edit ? this.createCancelQuestionButton() : ''}
                    ${this.createRemoveQuestionButton()}
                    </div>
                </div>`;
    },

    behaviourToggleOneMultipleAnswer(selectorId) {
        $exeDevice.ideviceBody
            .querySelector(`#${selectorId}`)
            .addEventListener('click', function () {
                let actualOptions =
                    $exeDevice.ideviceBody.querySelectorAll(
                        `INPUT[id^=option_]`
                    );
                let labelTypeAnswer = $exeDevice.ideviceBody.querySelector(
                    `#buttonRadioCheckboxToggle`
                ).nextElementSibling;
                let iconQuestion = $exeDevice.ideviceBody.querySelector(
                    `[id^="${$exeDevice.iconActivityId}"]`
                );
                if (this.innerHTML == 'toggle_off') {
                    this.innerHTML = 'toggle_on';
                    this.setAttribute('selection-type', 'multiple');
                    if (actualOptions.length > 0) {
                        actualOptions.forEach((option) => {
                            option.type = 'checkbox';
                        });
                    }

                    labelTypeAnswer.innerHTML = _('Answer type: Multiple');
                    iconQuestion.innerHTML = $exeDevice.iconSelectMultiple;
                } else {
                    this.innerHTML = 'toggle_off';
                    this.setAttribute('selection-type', 'single');
                    if (actualOptions.length > 0) {
                        actualOptions.forEach((option) => {
                            option.type = 'radio';
                        });
                    }

                    labelTypeAnswer.innerHTML = _('Answer type: Single');
                    iconQuestion.innerHTML = $exeDevice.iconSelectOne;
                }
            });
    },

    behaviourButtonAddOption(selectorId) {
        let ideviceBody = $exeDevice.ideviceBody;
        ideviceBody
            .querySelector(`#${selectorId}`)
            .addEventListener('click', function () {
                let optionCount =
                    ideviceBody.querySelectorAll(`INPUT[id^=option_]`).length +
                    1;
                let checked = optionCount > 1 ? '' : 'checked';
                let toggleButton = ideviceBody.querySelector(
                    '#buttonRadioCheckboxToggle'
                );
                let optionType =
                    toggleButton.innerHTML === 'toggle_off'
                        ? 'radio'
                        : 'checkbox';
                let randomId = $exeDevice.generateRandomId();
                let newOptionHTML = `<div id="option_${optionCount}_container" class="question-button inline">
                  <input type="${optionType}" name="options" id="option_${optionCount}" ${checked}>
                  <label for="option_${optionCount}">
                    ${_('Option')} ${optionCount}
                  </label>
                  <button id="remove_option_${optionCount}" class="exe-icon exe-icon-remove remove-option">close</button>
                </div>
                ${$exeDevice.createTextArea(`${$exeDevice.formPreviewId}Textarea_${randomId}`, 'small-textarea')}`;
                this.insertAdjacentHTML('beforebegin', newOptionHTML);
                $exeTinyMCE.init('multiple-visible', '.exe-html-editor', {
                    forced_root_block: '',
                    forced_br_newlines: true,
                    force_p_newlines: false,
                });
                $exeDevice.behaviourButtonRemoveOption(
                    `remove_option_${optionCount}`
                );
            });
    },

    behaviourButtonRemoveOption(selectorId) {
        $exeDevice.ideviceBody
            .querySelector(`#${selectorId}`)
            .addEventListener('click', function () {
                this.parentElement.nextElementSibling.remove();
                this.parentElement.remove();
                $exeDevice.updateOptionNumbers();
            });
    },

    updateOptionNumbers() {
        let options =
            $exeDevice.ideviceBody.querySelectorAll(`INPUT[id^=option_]`);
        if (options.length > 0) {
            options.forEach((option, index) => {
                option.id = `option_${index + 1}`;
                if (option.nextElementSibling) {
                    option.nextElementSibling.innerHTML = `${_('Option')} ${index + 1}`;
                    if (option.nextElementSibling.nextElementSibling) {
                        option.nextElementSibling.nextElementSibling.id = `remove_option_${index + 1}`;
                    }
                }
            });
        }
    },
    behaviourButtonAddFillQuestion(selectorId, relativePosition) {
        const button = $exeDevice.ideviceBody.querySelector(`#${selectorId}`);
        button.addEventListener('click', function () {
            $exeDevice.saveInEditionQuestion();
            const fillQuestion = $exeDevice.createFillQuestion();
            const formPreview = $exeDevice.ideviceBody.querySelector(
                `#${$exeDevice.formPreviewId}`
            );
            formPreview.insertAdjacentHTML(
                relativePosition,
                `<li class="FormView_question">${fillQuestion}</li>`
            );
            $exeTinyMCE.init('multiple-visible', '.exe-html-editor');
            $exeDevice.behaviourButtonSaveQuestion('fill');
            $exeDevice.behaviourButtonRemoveQuestion();
            const questionTitleContainer = formPreview.querySelector(
                '#formPreviewTextareaContainer div'
            );
            const questionTitle = formPreview.querySelector(
                '#formPreviewTextareaContainer label'
            );
            questionTitle.classList.add('instructions');
            questionTitleContainer.classList.add('instructions');
            $exeDevice.showQuestionInstructions(
                questionTitleContainer,
                $exeDevice.strings.msgInstructionsFill
            );
            const capitalization = formPreview.querySelector(
                `#${$exeDevice.checkCapitalizationId}_container .help-icon`
            );
            $exeDevice.showQuestionInstructions(
                capitalization,
                $exeDevice.strings.msgInstructionsFillCapitalization
            );
            const strictQualification = formPreview.querySelector(
                `#${$exeDevice.checkStrictQualificationId}_container .help-icon`
            );
            $exeDevice.showQuestionInstructions(
                strictQualification,
                $exeDevice.strings.msgInstructionsFillStrictQualification
            );
            $exeDevice.ideviceBody.querySelector(
                `#${$exeDevice.msgNoQuestionsId}`
            ).style.display = 'none';
            this.parentElement.previousElementSibling.click();
            $exeDevice.disableArrowUpDown();
        });
    },

    createFillQuestion(edit = false) {
        const textareaId = `${$exeDevice.formPreviewId}Textarea_${this.generateRandomId()}`;
        const createInlineIcon = (id, icon) =>
            `<span id="${id}" class="inline-icon">${icon}</span>`;
        const createCheckbox = (
            id,
            name,
            label
        ) => `<input type="checkbox" name="${name}" id="${id}" checked>
                <label for="${id}">
                 ${label}
                </label>`;
        const createHelpButton = () =>
            '<button class="inline-icon help-icon">help_center</button>';
        let html = `<div id="${$exeDevice.formPreviewId}TextareaContainer" class="questionTextarea">
            <div class="inline instructions">
                ${createInlineIcon(`${$exeDevice.iconActivityId}_${this.generateRandomId()}`, $exeDevice.iconFill)}
                ${this.createActivityTitle('fill')}
                ${createHelpButton()}
            </div>
            <div id="options_container" class="inline">
                <div id="${$exeDevice.checkCapitalizationId}_container" class="inline check-options">
                ${createCheckbox(`${$exeDevice.checkCapitalizationId}_${textareaId}`, 'capitalization', this.strings.msgCapitalization)}
                ${createHelpButton()}
                </div>
                <div id="${$exeDevice.checkStrictQualificationId}_container" class="inline check-options">
                ${createCheckbox(`${$exeDevice.checkStrictQualificationId}_${textareaId}`, 'strict-qualification', this.strings.msgStrictQualification)}
                ${createHelpButton()}
                </div>
            </div>
            ${this.createTextArea(textareaId)}
            ${this.showHideWordButton(textareaId)}
            ${this.createFeedbackFieldset($exeDevice.formPreviewId)}
            <div class="inline footer-buttons-container">
                ${this.createSaveQuestionButton()}
                ${edit ? this.createCancelQuestionButton() : ''}
                ${this.createRemoveQuestionButton()}
            </div>
            </div>`;
        return html;
    },

    behaviourButtonAddDropdownQuestion(selectorId, relativePosition) {
        $exeDevice.ideviceBody
            .querySelector(`#${selectorId}`)
            .addEventListener('click', function () {
                $exeDevice.saveInEditionQuestion();
                let dropdownQuestion = $exeDevice.createDropdownQuestion();
                let formPreview = $exeDevice.ideviceBody.querySelector(
                    `#${$exeDevice.formPreviewId}`
                );
                let liQuestion = `<li class="FormView_question">${dropdownQuestion}</li>`;
                formPreview.insertAdjacentHTML(relativePosition, liQuestion);
                $exeTinyMCE.init('multiple-visible', '.exe-html-editor');
                $exeDevice.behaviourButtonSaveQuestion('dropdown');
                $exeDevice.behaviourButtonRemoveQuestion();
                let questionTitleContainer = $exeDevice.ideviceBody
                    .querySelector('#formPreviewTextareaContainer')
                    .querySelector('DIV');
                let questionTitle = $exeDevice.ideviceBody
                    .querySelector('#formPreviewTextareaContainer')
                    .querySelector('LABEL');
                questionTitle.classList.add('instructions');
                $exeDevice.showQuestionInstructions(
                    questionTitleContainer,
                    $exeDevice.strings.msgInstructionsDropdown
                );
                let otherWords = $exeDevice.ideviceBody
                    .querySelector(
                        `#${$exeDevice.formPreviewId}InputTextContainer`
                    )
                    .querySelector('DIV');
                $exeDevice.showQuestionInstructions(
                    otherWords,
                    $exeDevice.strings.msgInstructionsDropdownOtherWords
                );
                $exeDevice.ideviceBody.querySelector(
                    `#${$exeDevice.msgNoQuestionsId}`
                ).style.display = 'none';
                this.parentElement.previousElementSibling.click();
                $exeDevice.disableArrowUpDown();
            });
    },

    createDropdownQuestion(edit = false) {
        const textareaId = `${$exeDevice.formPreviewId}Textarea_${this.generateRandomId()}`;
        const createInlineIcon = (id, icon) =>
            `<span id="${id}" class="inline-icon">${icon}</span>`;
        const createHelpButton = () =>
            '<button class="inline-icon help-icon">help_center</button>';
        let html = `<div id="${$exeDevice.formPreviewId}TextareaContainer" class="questionTextarea">
                        <div class="inline instructions">
                            ${createInlineIcon(`${$exeDevice.iconActivityId}_${this.generateRandomId()}`, $exeDevice.iconDropdown)}
                            ${this.createActivityTitle('dropdown')}
                            ${createHelpButton()}
                        </div>
                        ${this.createTextArea(textareaId)}
                        ${this.showHideWordButton(textareaId)}
                        <div id="${$exeDevice.formPreviewId}InputTextContainer" class="question-input-text">
                            <div class="inline instructions">
                                <div class="instructions">${this.strings.msgOtherWords}</div>
                                ${createHelpButton()}
                            </div>
                            ${this.createInputText(`${$exeDevice.formPreviewId}InputText`, '', '', '', this.strings.msgExampleOtherWords)}
                        </div>
                        ${this.createFeedbackFieldset($exeDevice.formPreviewId)}
                        <div class="inline footer-buttons-container">
                            ${this.createSaveQuestionButton()}
                            ${edit ? this.createCancelQuestionButton() : ''}
                            ${this.createRemoveQuestionButton()}
                        </div>
                    </div>`;
        return html;
    },

    createRemoveQuestionButton() {
        return `<div id="removeQuestionContainer" class="formAddQuestionsContainer">
                    <input type="button" id="removeQuestion" 
                        value="${this.strings.msgERemoveQuestion}" 
                        class="btn btn-outline-light">
                </div>`;
    },

    createCancelQuestionButton() {
        return `
                <div id="cancelQuestionContainer" class="formAddQuestionsContainer">
                    <input type="button" id="cancelQuestion" 
                        value="${this.strings.msgECancelQuestion}" 
                        class="btn btn-outline-secondary">
                </div>
                `;
    },

    createSaveQuestionButton() {
        return `<div id="saveQuestionContainer" class="formAddQuestionsContainer">
                    <input type="button" id="saveQuestion" 
                        value="${this.strings.msgESaveQuestion}" 
                        class="btn btn-primary">
                </div>`;
    },

    behaviourButtonRemoveQuestion() {
        const removeContainer = $exeDevice.ideviceBody.querySelector(
            '#removeQuestionContainer'
        );
        if (!removeContainer) return;
        const newElement = removeContainer.cloneNode(true);
        removeContainer.parentNode.replaceChild(newElement, removeContainer);
        newElement.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            eXe.app.confirm(
                _('Attention'),
                $exeDevice.strings.msgConfirmRemoveQuestion,
                () => {
                    if ($exeDevice.dataIdQuestionBeforeEdit !== '') {
                        const questionId = $exeDevice.dataIdQuestionBeforeEdit;
                        const questionIndex =
                            $exeDevice.getQuestionIndexById(questionId);

                        if (questionIndex !== -1) {
                            $exeDevice.questionsForm.splice(questionIndex, 1);
                        }

                        $exeDevice.manageHideQuestion('remove');
                    }

                    const editForm = $exeDevice.ideviceBody.querySelector(
                        `#${$exeDevice.formPreviewId}TextareaContainer`
                    );
                    if (editForm && editForm.parentElement) {
                        editForm.parentElement.remove();
                    }

                    $exeDevice.disableArrowUpDown();
                    $exeDevice.updateQuestionsNumber();
                }
            );
        });
    },

    behaviourButtonCancelQuestion() {
        const cancelContainer = $exeDevice.ideviceBody.querySelector(
            '#cancelQuestionContainer'
        );
        if (!cancelContainer) return;
        const newElement = cancelContainer.cloneNode(true);
        cancelContainer.parentNode.replaceChild(newElement, cancelContainer);
        newElement.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            eXe.app.confirm(
                _('Attention'),
                $exeDevice.strings.msgConfirmCancelEdit,
                () => {
                    const actualElementQuestion =
                        $exeDevice.ideviceBody.querySelector(
                            `#${$exeDevice.formPreviewId}TextareaContainer`
                        );

                    if (
                        actualElementQuestion &&
                        actualElementQuestion.parentElement
                    ) {
                        const questionLi = actualElementQuestion.parentElement;

                        questionLi.remove();

                        $exeDevice.manageHideQuestion('show');

                        $exeDevice.disableArrowUpDown();
                    }
                }
            );
        });
    },

    behaviourButtonSaveQuestion(questionType) {
        $exeDevice.ideviceBody
            .querySelector('#saveQuestionContainer')
            .addEventListener('click', () => {
                const isEditing = $exeDevice.dataIdQuestionBeforeEdit !== '';
                if (isEditing) {
                    const questionId = $exeDevice.dataIdQuestionBeforeEdit;
                    const questionIndex =
                        $exeDevice.getQuestionIndexById(questionId);
                    if (questionIndex !== -1) {
                        const updatedQuestion = $exeDevice.createQuestionObject(
                            $exeDevice.formPreviewId,
                            questionType
                        );
                        updatedQuestion.id = questionId;
                        $exeDevice.questionsForm[questionIndex] =
                            updatedQuestion;
                        $exeDevice.ideviceBody
                            .querySelector(
                                `#${$exeDevice.formPreviewId}TextareaContainer`
                            )
                            .parentElement.remove();
                        $exeDevice.manageHideQuestion('remove');
                        $exeDevice.renderQuestion(
                            updatedQuestion,
                            questionIndex
                        );
                        $exeDevice.active = questionIndex;
                    }
                } else {
                    $exeDevice.manageHideQuestion('remove');
                    $exeDevice.addQuestionfrmorm(
                        $exeDevice.formPreviewId,
                        questionType
                    );
                    $exeDevice.ideviceBody
                        .querySelector(
                            `#${$exeDevice.formPreviewId}TextareaContainer`
                        )
                        .parentElement.remove();
                }

                $exeDevice.disableArrowUpDown();
                $exeDevice.updateQuestionsNumber();
            });
    },

    showQuestionInstructions(element, msgInstructions) {
        element.addEventListener('click', () => {
            eXe.app.alert(msgInstructions, $exeDevice.strings.msgEInstructions);
        });
    },

    saveInEditionQuestion() {
        const inEditionTextarea = $exeDevice.ideviceBody.querySelector(
            '#formPreview textarea'
        );
        if (inEditionTextarea) {
            inEditionTextarea.parentElement
                .querySelector('#saveQuestion')
                .click();
        }
    },
    manageHideQuestion(action = 'show') {
        const hideQuestion = $exeDevice.ideviceBody.querySelector(
            `[data-id="${$exeDevice.dataIdQuestionBeforeEdit}"]`
        );
        if (hideQuestion) {
            if (action === 'remove') hideQuestion.remove();
            else if (action === 'show') hideQuestion.style.display = '';
        }

        $exeDevice.dataIdQuestionBeforeEdit = '';
    },

    createFormViewFieldset() {
        return `<fieldset class="exe-fieldset exe-fieldset-closed">
                    <legend><a href="#">${this.strings.msgEFormView}</a></legend>
                    <div>
                        <ul id="${$exeDevice.formPreviewId}"></ul>
                    </div>
                </fieldset>`;
    },

    addQuestionfrmorm(containerId, questionType) {
        const newQuestion = this.createQuestionObject(
            containerId,
            questionType
        );
        $exeDevice.questionsForm.push(newQuestion);
        this.renderQuestion(newQuestion);
        $exeDevice.active = $exeDevice.questionsForm.length - 1;
        $exeDevice.ideviceBody.querySelector(
            `#${$exeDevice.msgNoQuestionsId}`
        ).style.display = 'none';
    },

    createQuestionObject(containerId, questionType) {
        const question = $exeDevice.getCuestionDefault();
        question.activityType = questionType;
        const container = $exeDevice.ideviceBody.querySelector(
            `#${containerId}`
        );
        const tinyTextareaId = container.querySelector('TEXTAREA').id;
        question.baseText = $exeDevice.getEditorTinyMCEValue(tinyTextareaId);
        const suggestionInput = container.querySelector(
            '[name="questionSuggestion"]'
        );
        if (suggestionInput) {
            question.suggestion = suggestionInput.value || '';
        }

        const feedbackRightInput = container.querySelector(
            '[name="questionFeedbackRight"]'
        );
        if (feedbackRightInput) {
            question.feedbackRight = feedbackRightInput.value || '';
        }

        const feedbackWrongInput = container.querySelector(
            '[name="questionFeedbackWrong"]'
        );
        if (feedbackWrongInput) {
            question.feedbackWrong = feedbackWrongInput.value || '';
        }

        switch (questionType) {
            case $exeDevice.ACTIVITY_TYPES.DROPDOWN:
                question.wrongAnswersValue = container.querySelector(
                    `INPUT[name="${$exeDevice.formPreviewId}InputText"]`
                ).value;
                break;
            case $exeDevice.ACTIVITY_TYPES.SELECTION:
                let options = container.querySelectorAll(`INPUT[id^=option_]`);
                question.answers = [];
                options.forEach((option, index) => {
                    const optionContainer = option.parentElement;
                    const textareaElement = optionContainer.nextElementSibling;
                    let optionText = '';

                    if (
                        textareaElement &&
                        textareaElement.tagName === 'TEXTAREA'
                    ) {
                        const textareaId = textareaElement.id;
                        if (tinymce.get(textareaId)) {
                            optionText =
                                $exeDevice.getEditorTinyMCEValue(textareaId);
                        } else {
                            optionText = textareaElement.value;
                        }
                    }

                    question.answers.push([option.checked, optionText]);
                });
                question.selectionType = $exeDevice.ideviceBody
                    .querySelector('#buttonRadioCheckboxToggle')
                    .getAttribute('selection-type');
                break;
            case $exeDevice.ACTIVITY_TYPES.TRUE_FALSE:
                const trueFalseAnswer = document.querySelector(
                    'input[name="TrueFalseQuestion"]:checked'
                );
                question.answer =
                    trueFalseAnswer && trueFalseAnswer.value === 'true'
                        ? '1'
                        : '0';
                break;
            case $exeDevice.ACTIVITY_TYPES.FILL:
                question.capitalization = container.querySelector(
                    `#${$exeDevice.checkCapitalizationId}_${tinyTextareaId}`
                ).checked;
                question.strict = container.querySelector(
                    `#${$exeDevice.checkStrictQualificationId}_${tinyTextareaId}`
                ).checked;
                break;
        }

        return question;
    },

    renderQuestion(question, index) {
        const formPreview = $exeDevice.ideviceBody.querySelector(
            `#${$exeDevice.formPreviewId}`
        );
        const html = this.generateQuestionHTML(question);
        let renderedQuestion;
        if (typeof index !== 'undefined' && formPreview.children[index]) {
            const oldElement = formPreview.children[index];
            oldElement.outerHTML = html;
            renderedQuestion = formPreview.children[index];
        } else {
            const inEditionQuestion =
                $exeDevice.ideviceBody.querySelector('#saveQuestion');
            if (inEditionQuestion) {
                const inEditionLi = inEditionQuestion.closest('LI');
                inEditionLi.insertAdjacentHTML('beforebegin', html);
                renderedQuestion = inEditionLi.previousElementSibling;
            } else {
                formPreview.insertAdjacentHTML('beforeend', html);
                renderedQuestion = formPreview.lastElementChild;
            }
        }
        if (renderedQuestion) {
            this.addSortableBehaviour(renderedQuestion);
            const buttons = renderedQuestion.querySelectorAll(
                '.QuestionLabel_actionButton'
            );
            buttons.forEach((button) => {
                const buttonType = button.classList[0];
                switch (buttonType) {
                    case 'QuestionLabel_remove':
                        this.behaviourButtonCloseQuestionInFormView(button);
                        break;
                    case 'QuestionLabel_edit':
                        this.behaviourButtonEditQuestionInFormView(button);
                        break;
                    case 'QuestionLabel_moveUp':
                        this.behaviourButtonMoveUpQuestionInFormView(button);
                        break;
                    case 'QuestionLabel_moveDown':
                        this.behaviourButtonMoveDownQuestionInFormView(button);
                        break;
                }
            });
            this.disableArrowUpDown();
        }
    },
    generateQuestionHTML(question) {
        const id = question.id || this.generateRandomId();
        const activityType = question.activityType;
        let html = `<li class="FormView_question" 
                            data-id="${id}" 
                            activity-type="${activityType}"
                            draggable="true">
                <div id="questionTopBar_${id}">
                    <label class="activity-title">${this.strings.msgEActivity} ${activityType}</label>
                    <div class="inline QuestionLabel_ButtonsContainer">
                        <button class="QuestionLabel_moveUp QuestionLabel_actionButton">arrow_upward</button>
                        <button class="QuestionLabel_moveDown QuestionLabel_actionButton">arrow_downward</button>
                        <button class="QuestionLabel_edit QuestionLabel_actionButton">edit</button>
                        <button class="QuestionLabel_remove QuestionLabel_actionButton">close</button>
                    </div>
                </div>
                <div id="QuestionElement_${id}" class="FormViewContainer">`;
        switch (activityType) {
            case 'dropdown':
                html += this.getPreviewTextDropdownQuestion(question);
                break;
            case 'selection':
                html += this.getPreviewTextSelectionQuestion(question);
                break;
            case 'true-false':
                html += this.getPreviewTextTrueFalseQuestion(question);
                break;
            case 'fill':
                html += this.getPreviewTextFillQuestion(question);
                break;
        }

        html += `</div></li>`;
        return html;
    },

    getPreviewTextDropdownQuestion(question) {
        return this.getProcessTextDropdownQuestion(
            question.baseText,
            question.wrongAnswersValue || ''
        );
    },

    getPreviewTextSelectionQuestion(question) {
        const optionType =
            question.selectionType === 'single' ? 'radio' : 'checkbox';
        return this.getProcessTextSelectionQuestion(
            question.baseText,
            optionType,
            question.answers
        );
    },

    getPreviewTextTrueFalseQuestion(question) {
        const answer = question.answer === '1' ? 1 : 0;
        return this.getProcessTextTrueFalseQuestion(question.baseText, answer);
    },

    getPreviewTextFillQuestion(question) {
        return this.getProcessTextFillQuestion(
            question.baseText,
            question.capitalization || false,
            question.strict || false
        );
    },

    generateElementQuestionForm(containerId, questionId) {
        let html = ``;
        let valueText = ``;
        let valueInputText = ``;
        let valueAnswer = ``;
        let container = $exeDevice.ideviceBody.querySelector(`#${containerId}`);
        let tinyTextareaId = container.querySelector('TEXTAREA').id;
        switch (questionId) {
            case 'dropdown':
                valueText = $exeDevice.getEditorTinyMCEValue(tinyTextareaId);
                valueInputText = container.querySelector(
                    `INPUT[name="${$exeDevice.formPreviewId}InputText"]`
                ).value;
                html += this.getProcessTextDropdownQuestion(
                    valueText,
                    valueInputText
                );
                break;
            case 'selection':
                let valueQuestionText =
                    $exeDevice.getEditorTinyMCEValue(tinyTextareaId);
                let options =
                    $exeDevice.ideviceBody.querySelectorAll(
                        `INPUT[id^=option_]`
                    );
                valueAnswer = [];
                options.forEach((option) => {
                    valueAnswer.push([
                        option.checked,
                        option.parentElement.parentElement.nextElementSibling
                            .value,
                    ]);
                });
                let optionType = '';
                if (options.length > 0) {
                    optionType = options[0].type;
                }

                html += this.getProcessTextSelectionQuestion(
                    valueQuestionText,
                    optionType,
                    valueAnswer
                );
                break;
            case 'true-false':
                valueText = $exeDevice.getEditorTinyMCEValue(tinyTextareaId);
                valueAnswer =
                    this.capitalizar(
                        document
                            .querySelector('input[name="TrueFalseQuestion"]')
                            .checked.toString()
                    ) == 'True'
                        ? 1
                        : 0;
                html += this.getProcessTextTrueFalseQuestion(
                    valueText,
                    valueAnswer
                );
                break;
            case 'fill':
                let checkCapitalization = $exeDevice.ideviceBody.querySelector(
                    `#${$exeDevice.checkCapitalizationId}_${tinyTextareaId}`
                ).checked;
                let strictQualification = $exeDevice.ideviceBody.querySelector(
                    `#${$exeDevice.checkStrictQualificationId}_${tinyTextareaId}`
                ).checked;
                valueText = $exeDevice.getEditorTinyMCEValue(tinyTextareaId);
                html += this.getProcessTextFillQuestion(
                    valueText,
                    checkCapitalization,
                    strictQualification
                );
                break;
            default:
                break;
        }

        return html;
    },

    getHtmlFormQuestionDropdown(visible) {
        const style = visible ? 'style="display:none;"' : '';
        return `<div id="dropdownQuestionFormCreation" 
                         question="dropdown" 
                         class="questionCreationForm" 
                         ${style}>
                        ${this.createQuestionTextareaFieldset('dropdownQuestionTextarea_0', this.strings.msgEText, true, false)}
                        ${this.createQuestionInputTextFieldset('dropdownQuestionInputText_0', this.strings.msgOtherWords)}
                    </div>`;
    },

    removeOrAddUnderline(editorId) {
        const editor = tinyMCE.get(editorId);
        if (!editor) return;
        editor.focus();
        editor.execCommand('Underline');
        const body = editor.getBody();
        const spans = body.querySelectorAll(
            'span[style*="text-decoration: underline"]'
        );
        spans.forEach((span) => {
            const u = body.ownerDocument.createElement('u');
            while (span.firstChild) {
                u.appendChild(span.firstChild);
            }

            span.parentNode.replaceChild(u, span);
        });
    },

    createQuestionInputTextFieldset(id, label) {
        return `<fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${label}</a></legend>
                        <div><p>
                            <div id="${id}InputTextContainer" class="question-input-text">
                                ${this.createInputText(`${id}InputText`, '')}
                            </div>
                        </p></div>
                    </fieldset>`;
    },

    getHtmlFormQuestionSelection(visible) {
        const style = visible ? 'style="display:none;"' : '';
        return `<div id="selectionQuestionFormCreation" 
                         question="selection" 
                         class="questionCreationForm" 
                         ${style}>
                        ${this.createQuestionTextareaFieldset('selectionQuestionTextarea_0', this.strings.msgEQuestion, false, false)}
                    </div>`;
    },

    createQuestionTextareaFieldset(
        id,
        label,
        buttonShowHide = false,
        radioTrueFalse = false
    ) {
        const showHideButton = buttonShowHide
            ? this.showHideWordButton(`${id}Textarea`)
            : '';
        const trueFalseRadios = radioTrueFalse
            ? this.showTrueFalseRadioButtons(`${id}TrueFalseRadioButtons`)
            : '';
        return `<fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${label}</a></legend>
                        <div><p>
                            <div id="${id}TextareaContainer" class="questionTextarea">
                                ${this.createTextArea(`${id}Textarea`)}
                            </div>
                            ${showHideButton}
                            ${trueFalseRadios}
                        </p></div>
                    </fieldset>`;
    },

    getHtmlFormQuestionTrueFalse(visible) {
        const style = visible ? 'style="display:none;"' : '';
        return `<div id="trueFalseQuestionFormCreation" 
                         question="true-false" 
                         class="questionCreationForm" 
                         ${style}>
                        ${this.createQuestionTextareaFieldset('trueFalseQuestionTextarea_0', this.strings.msgEQuestion, false, true)}
                    </div>`;
    },

    getHtmlFormQuestionFill(visible) {
        const style = visible ? 'style="display:none;"' : '';
        return `<div id="fillQuestionFormCreation" 
                         question="fill" 
                         class="questionCreationForm" 
                         ${style}>
                        ${this.createQuestionTextareaFieldset('fillQuestionTextarea_0', this.strings.msgEText, true, false)}
                    </div>`;
    },

    showHideWordButton(editorId) {
        const btnId = `buttonShowHide_${editorId}`;
        const html = `
            <input
                type="button"
                id="${btnId}"
                value="${this.strings.msgEShowHideWord}"
                class="question-button"
            />
            `;
        setTimeout(() => {
            document.getElementById(btnId)?.addEventListener('click', () => {
                this.removeOrAddUnderline(editorId);
            });
        }, 0);
        return html;
    },

    showTrueFalseRadioButtons(id) {
        return `<div id="${id}" 
                         class="true-false-radio-buttons-container inline">
                        <div  class="online">
                            <input type="radio" 
                                       name="TrueFalseQuestion" 
                                       id="InputTrue" 
                                       value="${this.strings.msgETrue}" 
                                       checked>
                            <label for="InputTrue">                                
                                ${this.strings.msgETrue}
                            </label>
                        </div>
                        <div class="online">                        
                            <input type="radio" 
                                    name="TrueFalseQuestion" 
                                    id="InputFalse" 
                                    value="${this.strings.msgEFalse}">
                             <label for="InputFalse">
                                ${this.strings.msgEFalse}
                            </label>
                        </div>
                    </div>`;
    },

    behaviourExeTabs() {
        let exeTabs = document.querySelectorAll('.exe-form-tabs .exe-tab');
        [].forEach.call(exeTabs, function (tab) {
            tab.addEventListener('click', function (event) {
                document
                    .querySelectorAll('.exe-form-content')
                    .forEach((content) => {
                        content.style.display = 'none';
                    });
                document
                    .querySelectorAll('.exe-form-tabs .exe-tab')
                    .forEach((content) => {
                        content.classList.remove('exe-form-active-tab');
                    });
                tab.classList.add('exe-form-active-tab');
                document.getElementById(tab.getAttribute('tab')).style.display =
                    'block';
            });
        });
    },

    behaviourEvaluation() {
        const { ideviceBody } = $exeDevice;
        const evaluation = ideviceBody.querySelector('#evaluationCheckBox');
        const evaluationHelpLink = ideviceBody.querySelector('#helpLinkButton');
        const evaluationInput = ideviceBody.querySelector('#evaluationIDInput');
        const evaluationHelp = ideviceBody.querySelector('#evaluationHelp');
        const divTime = ideviceBody.querySelector('#frmETimeDiv');
        const percentageQuestions = ideviceBody.querySelector(
            '#frmEPercentageQuestions'
        );
        const time = ideviceBody.querySelector('#frmETime');
        if (evaluation) {
            evaluation.addEventListener('change', function () {
                evaluationInput.disabled = !this.checked;
            });
        }

        if (evaluationHelpLink) {
            evaluationHelpLink.addEventListener('click', (event) => {
                event.preventDefault();
                if (evaluationHelp) {
                    evaluationHelp.style.display =
                        evaluationHelp.style.display === 'none'
                            ? 'block'
                            : 'none';
                }
            });
        }

        if (percentageQuestions) {
            percentageQuestions.addEventListener('keyup', updateValue);
            percentageQuestions.addEventListener('click', updateValue);
            percentageQuestions.addEventListener('blur', function () {
                let value =
                    percentageQuestions.value.trim() === ''
                        ? 100
                        : parseInt(percentageQuestions.value, 10);
                value = Math.max(1, Math.min(value, 100));
                percentageQuestions.value = value;
                $exeDevice.updateQuestionsNumber();
            });
        }

        function updateValue() {
            percentageQuestions.value = percentageQuestions.value
                .replace(/\D/g, '')
                .substring(0, 3);
            if (
                percentageQuestions.value > 0 &&
                percentageQuestions.value <= 100
            ) {
                $exeDevice.updateQuestionsNumber();
            }
        }
        if (time) {
            time.addEventListener('keyup', updateValueTime);
            time.addEventListener('click', updateValueTime);
            time.addEventListener('blur', function () {
                let value =
                    time.value.trim() === '' ? 0 : parseInt(time.value, 10);
                value = Math.max(0, Math.min(value, 100));
                time.value = value;
            });
        }

        function updateValueTime() {
            time.value = time.value.replace(/\D/g, '').substring(0, 3);
        }
    },
    behaviourButtonMoveDownQuestionInFormView(element) {
        const newElement = element.cloneNode(true);
        element.parentNode.replaceChild(newElement, element);
        newElement.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            const questionLi = newElement.closest('LI');
            const questionId = questionLi.getAttribute('data-id');
            const index = $exeDevice.getQuestionIndexById(questionId);
            if (index < $exeDevice.questionsForm.length - 1) {
                [
                    $exeDevice.questionsForm[index],
                    $exeDevice.questionsForm[index + 1],
                ] = [
                    $exeDevice.questionsForm[index + 1],
                    $exeDevice.questionsForm[index],
                ];
                if (questionLi.nextElementSibling) {
                    questionLi.nextElementSibling.after(questionLi);
                }

                $exeDevice.disableArrowUpDown();
            }
        });
    },

    behaviourButtonMoveUpQuestionInFormView(element) {
        const newElement = element.cloneNode(true);
        element.parentNode.replaceChild(newElement, element);
        newElement.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            const questionLi = newElement.closest('LI');
            const questionId = questionLi.getAttribute('data-id');
            const index = $exeDevice.getQuestionIndexById(questionId);
            if (index > 0) {
                [
                    $exeDevice.questionsForm[index],
                    $exeDevice.questionsForm[index - 1],
                ] = [
                    $exeDevice.questionsForm[index - 1],
                    $exeDevice.questionsForm[index],
                ];
                if (questionLi.previousElementSibling) {
                    questionLi.previousElementSibling.before(questionLi);
                }

                $exeDevice.disableArrowUpDown();
            }
        });
    },

    behaviourButtonEditQuestionInFormView(element) {
        const newElement = element.cloneNode(true);
        element.parentNode.replaceChild(newElement, element);
        newElement.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (newElement.classList.contains('editing-in-progress')) {
                return;
            }

            newElement.classList.add('editing-in-progress');
            $exeDevice.saveInEditionQuestion();
            let question = newElement.closest('LI');
            if (!question) {
                newElement.classList.remove('editing-in-progress');
                return;
            }

            const parentElement = question.parentNode;
            const nextSibling = question.nextSibling;
            const activityType = question.getAttribute('activity-type');
            const questionId = question.getAttribute('data-id');

            if (!parentElement || !activityType) {
                newElement.classList.remove('editing-in-progress');
                return;
            }

            const questionClone = question.cloneNode(true);
            $exeDevice.dataIdQuestionBeforeEdit = questionId;
            if (!question.parentNode) {
                newElement.classList.remove('editing-in-progress');
                return;
            }

            question.style.display = 'none';
            if (!parentElement || !parentElement.parentNode) {
                newElement.classList.remove('editing-in-progress');
                return;
            }

            let editQuestionHTML = '';
            let liQuestion = '';
            let questionTitle = null;
            let questionTitleContainer = null;
            switch (activityType) {
                case 'true-false':
                    editQuestionHTML = $exeDevice.createTrueFalseQuestion(true);
                    liQuestion = `<li class="FormView_question">${editQuestionHTML}</li>`;
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = liQuestion;
                    const newQuestion = tempDiv.firstElementChild;
                    if (!parentElement || !newQuestion) {
                        return;
                    }

                    if (nextSibling) {
                        parentElement.insertBefore(newQuestion, nextSibling);
                    } else {
                        parentElement.appendChild(newQuestion);
                    }

                    $exeDevice.setDataFromTrueFalseQuestion(questionClone);
                    $exeTinyMCE.init('multiple-visible', '.exe-html-editor');
                    $exeDevice.behaviourButtonSaveQuestion('true-false');
                    $exeDevice.behaviourButtonRemoveQuestion();
                    $exeDevice.behaviourButtonCancelQuestion();
                    questionTitleContainer = $exeDevice.ideviceBody
                        .querySelector('#formPreviewTextareaContainer')
                        .querySelector('DIV');
                    questionTitle = $exeDevice.ideviceBody
                        .querySelector('#formPreviewTextareaContainer')
                        .querySelector('LABEL');
                    questionTitle.classList.add('instructions');
                    $exeDevice.showQuestionInstructions(
                        questionTitleContainer,
                        $exeDevice.strings.msgInstructionsQuestion
                    );
                    newElement.classList.remove('editing-in-progress');
                    break;
                case 'fill':
                    editQuestionHTML = $exeDevice.createFillQuestion(true);
                    liQuestion = `<li class="FormView_question">${editQuestionHTML}</li>`;
                    const tempDivFill = document.createElement('div');
                    tempDivFill.innerHTML = liQuestion;
                    const newQuestionFill = tempDivFill.firstElementChild;
                    if (!parentElement || !newQuestionFill) {
                        return;
                    }

                    if (nextSibling) {
                        parentElement.insertBefore(
                            newQuestionFill,
                            nextSibling
                        );
                    } else {
                        parentElement.appendChild(newQuestionFill);
                    }

                    $exeDevice.setDataFromFillQuestion(questionClone);
                    $exeTinyMCE.init('multiple-visible', '.exe-html-editor');
                    $exeDevice.behaviourButtonSaveQuestion('fill');
                    $exeDevice.behaviourButtonRemoveQuestion();
                    $exeDevice.behaviourButtonCancelQuestion();
                    questionTitleContainer = $exeDevice.ideviceBody
                        .querySelector('#formPreviewTextareaContainer')
                        .querySelector('DIV');
                    questionTitle = $exeDevice.ideviceBody
                        .querySelector('#formPreviewTextareaContainer')
                        .querySelector('LABEL');
                    questionTitle.classList.add('instructions');
                    $exeDevice.showQuestionInstructions(
                        questionTitleContainer,
                        $exeDevice.strings.msgInstructionsFill
                    );
                    let capitalization = $exeDevice.ideviceBody
                        .querySelector(
                            `#${$exeDevice.checkCapitalizationId}_container`
                        )
                        .querySelector('.help-icon');
                    $exeDevice.showQuestionInstructions(
                        capitalization,
                        $exeDevice.strings.msgInstructionsFillCapitalization
                    );
                    let strictQualification = $exeDevice.ideviceBody
                        .querySelector(
                            `#${$exeDevice.checkStrictQualificationId}_container`
                        )
                        .querySelector('.help-icon');
                    $exeDevice.showQuestionInstructions(
                        strictQualification,
                        $exeDevice.strings
                            .msgInstructionsFillStrictQualification
                    );
                    newElement.classList.remove('editing-in-progress');
                    break;
                case 'selection':
                    editQuestionHTML = $exeDevice.createSelectionQuestion(true);
                    liQuestion = `<li class="FormView_question">${editQuestionHTML}</li>`;
                    const tempDivSelection = document.createElement('div');
                    tempDivSelection.innerHTML = liQuestion;
                    const newQuestionSelection =
                        tempDivSelection.firstElementChild;
                    if (!parentElement || !newQuestionSelection) {
                        return;
                    }

                    if (nextSibling) {
                        parentElement.insertBefore(
                            newQuestionSelection,
                            nextSibling
                        );
                    } else {
                        parentElement.appendChild(newQuestionSelection);
                    }

                    $exeDevice.behaviourToggleOneMultipleAnswer(
                        'buttonRadioCheckboxToggle'
                    );
                    $exeDevice.behaviourButtonAddOption(
                        `${$exeDevice.formPreviewId}_buttonAddOption`
                    );
                    $exeDevice.behaviourButtonRemoveOption('remove_option_1');
                    $exeDevice.setDataFromSelectionQuestion(questionClone);
                    $exeTinyMCE.init('multiple-visible', '.exe-html-editor', {
                        forced_root_block: '',
                        forced_br_newlines: true,
                        force_p_newlines: false,
                    });
                    $exeDevice.behaviourButtonSaveQuestion('selection');
                    $exeDevice.behaviourButtonRemoveQuestion();
                    $exeDevice.behaviourButtonCancelQuestion();
                    questionTitleContainer = $exeDevice.ideviceBody
                        .querySelector('#formPreviewTextareaContainer')
                        .querySelector('DIV');
                    questionTitle = $exeDevice.ideviceBody
                        .querySelector('#formPreviewTextareaContainer')
                        .querySelector('LABEL');
                    questionTitle.classList.add('instructions');
                    $exeDevice.showQuestionInstructions(
                        questionTitleContainer,
                        $exeDevice.strings.msgInstructionsSelection
                    );
                    newElement.classList.remove('editing-in-progress');
                    break;
                case 'dropdown':
                    editQuestionHTML = $exeDevice.createDropdownQuestion(true);
                    liQuestion = `<li class="FormView_question">${editQuestionHTML}</li>`;
                    const tempDivDropdown = document.createElement('div');
                    tempDivDropdown.innerHTML = liQuestion;
                    const newQuestionDropdown =
                        tempDivDropdown.firstElementChild;
                    if (!parentElement || !newQuestionDropdown) {
                        return;
                    }

                    if (nextSibling) {
                        parentElement.insertBefore(
                            newQuestionDropdown,
                            nextSibling
                        );
                    } else {
                        parentElement.appendChild(newQuestionDropdown);
                    }

                    $exeDevice.setDataFromDropdownQuestion(questionClone);
                    $exeTinyMCE.init('multiple-visible', '.exe-html-editor');
                    $exeDevice.behaviourButtonSaveQuestion('dropdown');
                    $exeDevice.behaviourButtonRemoveQuestion();
                    $exeDevice.behaviourButtonCancelQuestion();
                    questionTitleContainer = $exeDevice.ideviceBody
                        .querySelector('#formPreviewTextareaContainer')
                        .querySelector('DIV');
                    questionTitle = $exeDevice.ideviceBody
                        .querySelector('#formPreviewTextareaContainer')
                        .querySelector('LABEL');
                    questionTitle.classList.add('instructions');
                    $exeDevice.showQuestionInstructions(
                        questionTitleContainer,
                        $exeDevice.strings.msgInstructionsDropdown
                    );
                    let otherWords = $exeDevice.ideviceBody
                        .querySelector(
                            `#${$exeDevice.formPreviewId}InputTextContainer`
                        )
                        .querySelector('DIV');
                    $exeDevice.showQuestionInstructions(
                        otherWords,
                        $exeDevice.strings.msgInstructionsDropdownOtherWords
                    );
                    newElement.classList.remove('editing-in-progress');
                    break;
                default:
                    newElement.classList.remove('editing-in-progress');
                    break;
            }
        });
    },

    behaviourButtonCloseQuestionInFormView(element) {
        element.addEventListener('click', function (event) {
            eXe.app.confirm(
                _('Attention'),
                $exeDevice.strings.msgConfirmRemoveQuestion,
                function () {
                    const questionLi = element.closest('LI');
                    const questionId = questionLi.getAttribute('data-id');
                    const questionIndex =
                        $exeDevice.getQuestionIndexById(questionId);
                    if (questionIndex !== -1) {
                        $exeDevice.questionsForm.splice(questionIndex, 1);
                    }

                    questionLi.remove();
                    if ($exeDevice.active >= $exeDevice.questionsForm.length) {
                        $exeDevice.active = Math.max(
                            0,
                            $exeDevice.questionsForm.length - 1
                        );
                    }

                    if ($exeDevice.questionsForm.length === 0) {
                        $exeDevice.ideviceBody.querySelector(
                            `#${$exeDevice.msgNoQuestionsId}`
                        ).style.display = '';
                    }

                    $exeDevice.updateQuestionsNumber();
                }
            );
        });
    },

    behaviourButtonsQuestionInFormViewAll(selector) {
        let buttons = $exeDevice.ideviceBody.querySelectorAll(selector);
        buttons.forEach((button) => {
            let buttonType = button.classList[0];
            switch (buttonType) {
                case 'QuestionLabel_remove':
                    this.behaviourButtonCloseQuestionInFormView(button);
                    break;
                case 'QuestionLabel_edit':
                    this.behaviourButtonEditQuestionInFormView(button);
                    break;
                case 'QuestionLabel_moveUp':
                    this.behaviourButtonMoveUpQuestionInFormView(button);
                    break;
                case 'QuestionLabel_moveDown':
                    this.behaviourButtonMoveDownQuestionInFormView(button);
                    break;
                default:
                    break;
            }
        });
    },

    setDataFromTrueFalseQuestion(question) {
        const questionId = question.dataset.id;
        const questionIndex = $exeDevice.getQuestionIndexById(questionId);
        const questionData = $exeDevice.questionsForm[questionIndex];
        if (!questionData) {
            return;
        }

        let newTextarea = $exeDevice.ideviceBody.querySelector(
            `TEXTAREA[id^=${$exeDevice.formPreviewId}`
        );
        newTextarea.innerHTML = questionData.baseText.replace(
            /<p>\s*(<br\s*\/?>)?\s*<\/p>/gi,
            ''
        );
        let falseBtn = $exeDevice.ideviceBody.querySelector('#InputFalse');
        let trueBtn = $exeDevice.ideviceBody.querySelector('#InputTrue');
        if (questionData.answer === '0') {
            falseBtn.checked = true;
        } else {
            trueBtn.checked = true;
        }

        const suggestionInput = $exeDevice.ideviceBody.querySelector(
            '[name="questionSuggestion"]'
        );
        if (suggestionInput && questionData.suggestion) {
            suggestionInput.value = questionData.suggestion;
        }

        const feedbackRightInput = $exeDevice.ideviceBody.querySelector(
            '[name="questionFeedbackRight"]'
        );
        if (feedbackRightInput && questionData.feedbackRight) {
            feedbackRightInput.value = questionData.feedbackRight;
        }

        const feedbackWrongInput = $exeDevice.ideviceBody.querySelector(
            '[name="questionFeedbackWrong"]'
        );
        if (feedbackWrongInput && questionData.feedbackWrong) {
            feedbackWrongInput.value = questionData.feedbackWrong;
        }
    },
    setDataFromSelectionQuestion(question) {
        const questionId = question.dataset.id;
        const questionIndex = $exeDevice.getQuestionIndexById(questionId);
        const questionData = $exeDevice.questionsForm[questionIndex];
        if (!questionData) {
            return;
        }

        if (questionData.selectionType === 'multiple') {
            $exeDevice.ideviceBody
                .querySelector('#buttonRadioCheckboxToggle')
                .click();
        }

        let questionTextarea = $exeDevice.ideviceBody.querySelector(
            `TEXTAREA[id^=${$exeDevice.formPreviewId}`
        );
        questionTextarea.innerHTML = questionData.baseText.replace(
            /<p>\s*(<br\s*\/?>)?\s*<\/p>/gi,
            ''
        );
        let buttonAddOption = $exeDevice.ideviceBody.querySelector(
            `INPUT#${$exeDevice.formPreviewId}_buttonAddOption`
        );
        for (let i = 1; i < questionData.answers.length; i++) {
            buttonAddOption.click();
        }

        setTimeout(() => {
            let optionTextareas = $exeDevice.ideviceBody.querySelectorAll(
                'TEXTAREA.small-textarea'
            );
            if (
                $exeDevice.ideviceBody.querySelector(`#option_1_container`) !==
                null
            ) {
                $exeDevice.ideviceBody
                    .querySelector(`#option_1_container`)
                    .querySelector('INPUT').checked = false;
            }

            questionData.answers.forEach((answer, index) => {
                const [isCorrect, text] = answer;

                if (optionTextareas[index]) {
                    optionTextareas[index].value = text;
                }

                const optionInput = $exeDevice.ideviceBody.querySelector(
                    `#option_${index + 1}_container INPUT`
                );
                if (optionInput) {
                    optionInput.checked = isCorrect;
                }
            });
            const suggestionInput = $exeDevice.ideviceBody.querySelector(
                '[name="questionSuggestion"]'
            );
            if (suggestionInput && questionData.suggestion) {
                suggestionInput.value = questionData.suggestion;
            }

            const feedbackRightInput = $exeDevice.ideviceBody.querySelector(
                '[name="questionFeedbackRight"]'
            );
            if (feedbackRightInput && questionData.feedbackRight) {
                feedbackRightInput.value = questionData.feedbackRight;
            }

            const feedbackWrongInput = $exeDevice.ideviceBody.querySelector(
                '[name="questionFeedbackWrong"]'
            );
            if (feedbackWrongInput && questionData.feedbackWrong) {
                feedbackWrongInput.value = questionData.feedbackWrong;
            }
        }, 100);
    },

    setDataFromFillQuestion(question) {
        const questionId = question.dataset.id;
        const questionIndex = $exeDevice.getQuestionIndexById(questionId);
        const questionData = $exeDevice.questionsForm[questionIndex];
        if (!questionData) {
            return;
        }

        const textarea = $exeDevice.ideviceBody.querySelector(
            `textarea[id^="${$exeDevice.formPreviewId}"]`
        );
        if (textarea) {
            textarea.value = questionData.baseText.replace(
                /<p>\s*(<br\s*\/?>)?\s*<\/p>/gi,
                ''
            );
        }

        const capInput = $exeDevice.ideviceBody.querySelector(
            `input[type="checkbox"][id^="checkCapitalization_${$exeDevice.formPreviewId}"]`
        );
        if (capInput) {
            capInput.checked = questionData.capitalization;
        }

        const strictInput = $exeDevice.ideviceBody.querySelector(
            `input[type="checkbox"][id^="checkStrictQualification_${$exeDevice.formPreviewId}"]`
        );
        if (strictInput) {
            strictInput.checked = questionData.strict;
        }

        const suggestionInput = $exeDevice.ideviceBody.querySelector(
            '[name="questionSuggestion"]'
        );
        if (suggestionInput && questionData.suggestion) {
            suggestionInput.value = questionData.suggestion;
        }

        const feedbackRightInput = $exeDevice.ideviceBody.querySelector(
            '[name="questionFeedbackRight"]'
        );
        if (feedbackRightInput && questionData.feedbackRight) {
            feedbackRightInput.value = questionData.feedbackRight;
        }

        const feedbackWrongInput = $exeDevice.ideviceBody.querySelector(
            '[name="questionFeedbackWrong"]'
        );
        if (feedbackWrongInput && questionData.feedbackWrong) {
            feedbackWrongInput.value = questionData.feedbackWrong;
        }
    },
    setDataFromDropdownQuestion(question) {
        const questionId = question.dataset.id;
        const questionIndex = $exeDevice.getQuestionIndexById(questionId);
        const questionData = $exeDevice.questionsForm[questionIndex];
        if (!questionData) {
            return;
        }

        const textarea = $exeDevice.ideviceBody.querySelector(
            `textarea[id^="${$exeDevice.formPreviewId}"]`
        );
        if (textarea) {
            textarea.value = questionData.baseText.replace(
                /<p>\s*(<br\s*\/?>)?\s*<\/p>/gi,
                ''
            );
        }

        const otherInput = $exeDevice.ideviceBody.querySelector(
            `#${$exeDevice.formPreviewId}InputText`
        );
        if (otherInput) {
            otherInput.value = questionData.wrongAnswersValue || '';
        }

        const suggestionInput = $exeDevice.ideviceBody.querySelector(
            '[name="questionSuggestion"]'
        );
        if (suggestionInput && questionData.suggestion) {
            suggestionInput.value = questionData.suggestion;
        }

        const feedbackRightInput = $exeDevice.ideviceBody.querySelector(
            '[name="questionFeedbackRight"]'
        );
        if (feedbackRightInput && questionData.feedbackRight) {
            feedbackRightInput.value = questionData.feedbackRight;
        }

        const feedbackWrongInput = $exeDevice.ideviceBody.querySelector(
            '[name="questionFeedbackWrong"]'
        );
        if (feedbackWrongInput && questionData.feedbackWrong) {
            feedbackWrongInput.value = questionData.feedbackWrong;
        }
    },
    createQuestionTextareaFieldset(
        id,
        label,
        buttonShowHide = false,
        radioTrueFalse = false
    ) {
        let html = ``;
        html += `<fieldset class="exe-fieldset exe-fieldset-closed">`;
        html += `<legend><a href="#">${label}</a></legend>`;
        html += `<div><p>`;
        html += `<div id="${id}TextareaContainer" class="questionTextarea">`;
        html += this.createTextArea(`${id}Textarea`);
        html += `</div>`;
        if (buttonShowHide) html += this.showHideWordButton(`${id}Textarea`);
        if (radioTrueFalse)
            html += this.showTrueFalseRadioButtons(
                `${id}TrueFalseRadioButtons`
            );
        html += `</p></div>`;
        html += `</fieldset>`;
        html += this.createFeedbackFieldset(id);
        return html;
    },

    createSuggestionField(id) {
        return `<div class="suggestion-field" style="margin-bottom: 10px;">
                    <label for="${id}Suggestion" style="display: block;  margin-bottom: 5px;">
                        ${_('Suggestion or hint (optional)')}:
                    </label>
                    <input type="text"
                           name="questionSuggestion"
                           id="${id}Suggestion"
                           class="form-control suggestion-input"
                           placeholder="${_('Hint or suggestion for the student')}"
                           style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" />
                </div>`;
    },

    createFeedbackFieldset(id) {
        return `<div class="feedback-container" style="margin-top: 15px;">
                ${this.createSuggestionField(id)}
                <div class="feedback-field" style="margin-bottom: 10px;">
                    <label for="${id}FeedbackRight" style="display: block;  margin-bottom: 5px;">
                        ${_('Feedback for correct answer (optional)')}:
                    </label>
                    <input type="text"
                           name="questionFeedbackRight" 
                           id="${id}FeedbackRight" 
                           class="form-control feedback-input" 
                           placeholder="${_('Message shown when answer is correct')}"
                           style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" />
                </div>
                <div class="feedback-field">
                    <label for="${id}FeedbackWrong" style="display: block; margin-bottom: 5px;">
                        ${_('Feedback for wrong answer (optional)')}:
                    </label>
                    <input type="text"
                           name="questionFeedbackWrong" 
                           id="${id}FeedbackWrong" 
                           class="form-control feedback-input" 
                           placeholder="${_('Message shown when answer is wrong')}"
                           style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" />
                </div>
            </div>`;
    },

    getProcessTextDropdownQuestion(baseText, otherWordsText) {
        let $wrapper = $('<div>').append(baseText);
        let $dropdownBaseText = $wrapper.find('div.dropdownBaseText');
        if ($dropdownBaseText.length) {
            $dropdownBaseText.remove();
        }

        let $dropdownWrongAnswer = $wrapper.find('span.dropdownWrongAnswer');
        let wrongAnswer = '';
        if ($dropdownWrongAnswer.length) {
            wrongAnswer = $dropdownWrongAnswer.html().trim();
            $dropdownWrongAnswer.remove();
        }

        var textBase = $wrapper.html().trim();
        let regexReplace = /(<u>)((?:(?!<u>|<\/u>)[\s\S])*?)(<\/u>)/;
        let regexElement = /(?<=<u>)((?:(?!<u>|<\/u>)[\s\S])*?)(?=<\/u>)/;
        let regexElementsAll = /(?<=<u>)((?:(?!<u>|<\/u>)[\s\S])*?)(?=<\/u>)/g;
        let otherWords = otherWordsText ? otherWordsText.split('|') : [];
        let allMatchs = [...textBase.matchAll(regexElementsAll)];
        let allOptions = allMatchs.map((m) => m[0]).concat(otherWords);
        let allOptionsShuffle = this.shuffle(allOptions);
        let selectId = this.generateRandomId();
        let htmlDropdown = textBase;
        while (htmlDropdown.search(regexReplace) >= 0) {
            selectId = this.generateRandomId();
            let answerString = htmlDropdown.match(regexElement)[0];
            htmlDropdown = htmlDropdown.replace(
                regexReplace,
                this.getSelectDropdownQuestion(
                    selectId,
                    allOptionsShuffle,
                    answerString
                )
            );
        }

        selectId = this.generateRandomId();
        let wrongSpan = `<span id="dropdownWrongAnswer_${selectId}" class="dropdownWrongAnswer" style="display:none">${otherWordsText || wrongAnswer}</span>`;
        if (!htmlDropdown.includes('dropdownWrongAnswer')) {
            htmlDropdown += wrongSpan;
        } else {
            let oldWrongAnswers =
                /<span id="dropdownWrongAnswer[^>]*>[\s\S]*?<\/span>/;
            htmlDropdown = htmlDropdown.replace(oldWrongAnswers, wrongSpan);
        }

        selectId = this.generateRandomId();
        let baseDiv = `<div id="dropdownBaseText_${selectId}" class="dropdownBaseText" style="display:none">${textBase}</div>`;
        if (!htmlDropdown.includes('dropdownBaseText')) {
            htmlDropdown += baseDiv;
        } else {
            let oldBaseText = /<div id="dropdownBaseText[^>]*>[\s\S]*?<\/div>/;
            htmlDropdown = htmlDropdown.replace(oldBaseText, baseDiv);
        }

        return htmlDropdown;
    },

    getProcessTextSelectionQuestion(baseText, optionType, answer) {
        let id = this.generateRandomId();
        let htmlSelection = baseText.replace(
            /<p>\s*(<br\s*\/?>)?\s*<\/p>/gi,
            ''
        );
        let rightAnswer = [];
        htmlSelection += `<div id="SelectionQuestion_${id}" data-id="${id}" class="selection-buttons-container">`;
        answer.forEach((option, index) => {
            htmlSelection += `<div class="inline">`;
            htmlSelection += `<input type="${optionType}" name="${id}_SelectionQuestion" id="${id}_option_${index + 1}" value="${option[1]}">`;
            htmlSelection += `<label for="${id}_option_${index + 1}">`;
            htmlSelection += option[1];
            htmlSelection += `</label>`;
            htmlSelection += `</div>`;
            if (option[0]) {
                rightAnswer.push(index);
            }
        });
        htmlSelection += `<span id="SelectionAnswer_${id}" class="selectionAnswer" style="display:none;">${rightAnswer}</span>`;
        htmlSelection += `</div>`;
        return htmlSelection;
    },

    getProcessTextTrueFalseQuestion(baseText, answer) {
        let id = this.generateRandomId();
        let htmlTrueFalse = baseText.replace(
            /<p>\s*(<br\s*\/?>)?\s*<\/p>/gi,
            ''
        );
        htmlTrueFalse += `<div id="TrueFalseQuestion_${id}" data-id="${id}" class="true-false-radio-buttons-container inline">`;
        htmlTrueFalse += `<div class="online">`;
        htmlTrueFalse += `<input type="radio" name="${id}_TrueFalseQuestion" id="${id}_true" value="1">`;
        htmlTrueFalse += `<label for="${id}_true">`;
        htmlTrueFalse += this.strings.msgETrue;
        htmlTrueFalse += `</label>`;
        htmlTrueFalse += `</div>`;
        htmlTrueFalse += `<div class="online">`;
        htmlTrueFalse += `<input type="radio" name="${id}_TrueFalseQuestion" id="${id}_false" value="0">`;
        htmlTrueFalse += `<label for="${id}_false">`;
        htmlTrueFalse += this.strings.msgEFalse;
        htmlTrueFalse += `</label>`;
        htmlTrueFalse += `</div>`;
        htmlTrueFalse += `<span id="TrueFalseAnswer_${id}" class="trueFalseAnswer" style="display:none;">${answer}</span>`;
        htmlTrueFalse += `</div>`;
        return htmlTrueFalse;
    },

    getProcessTextFillQuestion(
        baseText,
        checkCapitalization,
        strictQualification
    ) {
        let $wrapper = $('<div>').append(baseText);
        let $fillBaseText = $wrapper.find('div.fillBaseText');
        if ($fillBaseText.length) {
            $fillBaseText.remove();
        }

        let $capSpan = $wrapper.find('span[id^="fillCapitalization"]');
        if ($capSpan.length) {
            $capSpan.remove();
        }

        let $strictSpan = $wrapper.find('span[id^="fillStrictQualification"]');
        if ($strictSpan.length) {
            $strictSpan.remove();
        }

        let textBase = $wrapper.html().trim();
        let regexReplace = /(<u>).*?(<\/u>)/;
        let regexElement = /(?<=<u>).*?(?=<\/u>)/;
        let htmlFill = textBase;
        while (htmlFill.search(regexReplace) >= 0) {
            let answerString = htmlFill
                .match(regexElement)[0]
                .toString()
                .trim();
            let inputId = this.generateRandomId();
            htmlFill = htmlFill.replace(
                regexReplace,
                `<input id="fillInput_${inputId}" type="text" data-id="${inputId}" class="fillInput" /> <span id="fillAnswer_${inputId}" class="fillAnswer" style="display:none;">${answerString}</span>`
            );
        }

        let capSpanHTML = `<span id="fillCapitalization_${this.generateRandomId()}" style="display:none;">${checkCapitalization}</span>`;
        if (!htmlFill.includes('fillCapitalization')) {
            htmlFill += capSpanHTML;
        } else {
            let oldCap = /<span id="fillCapitalization[^>]*>[\s\S]*?<\/span>/;
            htmlFill = htmlFill.replace(oldCap, capSpanHTML);
        }

        let strictSpanHTML = `<span id="fillStrictQualification_${this.generateRandomId()}" style="display:none;">${strictQualification}</span>`;
        if (!htmlFill.includes('fillStrictQualification')) {
            htmlFill += strictSpanHTML;
        } else {
            let oldStrict =
                /<span id="fillStrictQualification[^>]*>[\s\S]*?<\/span>/;
            htmlFill = htmlFill.replace(oldStrict, strictSpanHTML);
        }

        let baseDiv = `<div id="fillBaseText_${this.generateRandomId()}" class="fillBaseText" style="display:none">${textBase}</div>`;
        if (!htmlFill.includes('fillBaseText')) {
            htmlFill += baseDiv;
        } else {
            let oldBase = /<div id="fillBaseText[^>]*>[\s\S]*?<\/div>/;
            htmlFill = htmlFill.replace(oldBase, baseDiv);
        }

        return htmlFill;
    },

    getSelectDropdownQuestion(id, options, answer) {
        let selectDropdown = ``;
        selectDropdown += `<select id="dropdownSelect_${id}" class="dropdownSelect" data-id="${id}" name="dropdownSelector">`;
        selectDropdown += `<option value="" selected></option>`;
        options.forEach((option) => {
            selectDropdown += `<option value="${option}">${option}</option>`;
        });
        selectDropdown += `</select>`;
        selectDropdown += `<span id="dropdownAnswer_${id}" class="dropdownAnswer" style="display:none">${answer}</span>`;
        return selectDropdown;
    },

    createPassRateDropdown(id) {
        let options = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
        let selectDropdown = ``;
        selectDropdown += `<select id="${$exeDevice.dropdownPassRateId}_${id}" class="dropdownPassRate form-control" aria-labelledby="${$exeDevice.passRateId}" data-id="${id}">`;
        selectDropdown += `<option value="" selected></option>`;
        options.forEach((option) => {
            selectDropdown += `<option value="${option}">${option}%</option>`;
        });
        selectDropdown += `</select>`;
        return selectDropdown;
    },

    createActivityTitle(questionType) {
        let labelElementQuestion = document.createElement('label');
        labelElementQuestion.classList.add('activity-title');
        labelElementQuestion.innerHTML = `${this.strings.msgEActivity} ${questionType}`;
        return labelElementQuestion.outerHTML;
    },

    createTextArea(id, extraClass = 'exe-html-editor', defaultText = '') {
        return `<textarea id="${id}" 
                              class="${extraClass}">${defaultText}</textarea>`;
    },

    createInputText(
        id,
        defaultText,
        size = '80',
        extraClass = '',
        placeholder = ''
    ) {
        const sizeAttr = size ? ` size="${size}"` : '';
        const classAttr = extraClass ? ` class="${extraClass}"` : '';
        const placeholderAttr = placeholder
            ? ` placeholder="${placeholder}"`
            : '';
        return `<input type="text" 
                           name="${id}" 
                           id="${id}" 
                           value="${defaultText}"${sizeAttr}${classAttr}${placeholderAttr}>`;
    },

    generateRandomId() {
        const letters = Math.random()
            .toString(36)
            .substring(2, 7)
            .toUpperCase();
        return `${Date.now()}-${letters}`;
    },

    shuffle(a) {
        let j, x, i;
        for (i = a.length - 1; i > 0; i--) {
            j = Math.floor(Math.random() * (i + 1));
            x = a[i];
            a[i] = a[j];
            a[j] = x;
        }

        return a;
    },

    addSortableBehaviour(question) {
        let sortables =
            $exeDevice.ideviceBody.querySelectorAll('.FormView_question');
        if (question === undefined || question === null) {
            sortables.forEach((question) => {
                this.questionsDragEvents(question);
            });
        } else {
            this.questionsDragEvents(question);
        }
    },
    questionsDragEvents(question) {
        question.setAttribute('draggable', true);
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
            question.addEventListener(eventName, this.preventDefaults, false);
        });
        ['dragenter', 'dragover'].forEach((eventName) => {
            question.addEventListener(
                eventName,
                this.copyQuestionToDestination,
                false
            );
        });
        question.addEventListener('dragstart', this.handleDragStart, false);
        question.addEventListener('dragend', this.handleDragEnd, false);
    },

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    },

    copyQuestionToDestination(e) {
        let overQuestion = e.currentTarget;
        let draggingQuestion =
            $exeDevice.ideviceBody.querySelector('.dragging');
        let questions =
            $exeDevice.ideviceBody.querySelectorAll('.FormView_question');
        questions.forEach((question, index) => {
            if (question === overQuestion) {
                $exeDevice.indexOverItem = index;
            }

            if (question === draggingQuestion) {
                $exeDevice.indexDraggingItem = index;
            }
        });
        let middleReference =
            overQuestion.getBoundingClientRect().top +
            overQuestion.getBoundingClientRect().height / 2;
        if ($exeDevice.indexDraggingItem != $exeDevice.indexOverItem) {
            if (e.pageY < middleReference) {
                overQuestion.before(draggingQuestion);
            } else {
                overQuestion.after(draggingQuestion);
            }
        }
    },

    handleDragStart(e) {
        e.currentTarget.classList.add('dragging');
    },

    handleDragEnd(e) {
        e.currentTarget.classList.remove('dragging');
        const formPreview = $exeDevice.ideviceBody.querySelector(
            `#${$exeDevice.formPreviewId}`
        );
        const newOrder = Array.from(formPreview.children).map((li) =>
            li.getAttribute('data-id')
        );
        const reorderedQuestions = newOrder
            .map((id) => $exeDevice.questionsForm.find((q) => q.id === id))
            .filter((q) => q !== undefined);
        $exeDevice.questionsForm = reorderedQuestions;
        $exeDevice.disableArrowUpDown();
    },

    disableArrowUpDown() {
        let formPreview = $exeDevice.ideviceBody.querySelector(
            `#${$exeDevice.formPreviewId}`
        );
        let questions = formPreview.children;
        Object.entries(questions).forEach(([index, question]) => {
            if (question.querySelector('.QuestionLabel_moveUp') !== null) {
                question
                    .querySelector('.QuestionLabel_moveUp')
                    .removeAttribute('disabled');
            }

            if (question.querySelector('.QuestionLabel_moveDown') !== null) {
                question
                    .querySelector('.QuestionLabel_moveDown')
                    .removeAttribute('disabled');
            }
        });
        Object.entries(questions).forEach(([index, question]) => {
            if (index == 0) {
                if (question.querySelector('.QuestionLabel_moveUp') !== null) {
                    question
                        .querySelector('.QuestionLabel_moveUp')
                        .setAttribute('disabled', true);
                }

                if (questions.length === 1) {
                    if (
                        question.querySelector('.QuestionLabel_moveDown') !==
                        null
                    ) {
                        question
                            .querySelector('.QuestionLabel_moveDown')
                            .setAttribute('disabled', true);
                    }
                }
            } else if (index == questions.length - 1) {
                if (
                    question.querySelector('.QuestionLabel_moveDown') !== null
                ) {
                    question
                        .querySelector('.QuestionLabel_moveDown')
                        .setAttribute('disabled', true);
                }
            }
        });
    },

    capitalizar(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    },
};
