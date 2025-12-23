/* git */
/**
 * True or False iDevice (edition code)
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    // i18n
    i18n: {
        name: _('True or false'),
    },
    idevicePath: '',
    msgs: {},
    classIdevice: 'trueorfalse',
    active: 0,
    numberId: 0,
    typeActive: 0,
    questionsGame: [],
    questionsString: [],
    gameString: {},
    time: 0,
    typeEdit: -1,
    numberCutCuestion: -1,
    tofFeedBacks: [],
    tofVersion: 1,
    clipBoard: '',
    saving: false,
    id: false,
    ci18n: {},

    init: function (element, previousData, path) {
        this.ideviceBody = element;

        this.idevicePreviousData = previousData;

        this.idevicePath = path;

        this.id = $(element).attr('idevice-id');
        this.refreshTranslations();
        this.setMessagesInfo();
        this.createForm();
    },

    transformObject: function (data) {
        if (data.typeGame && data.typeGame === 'TrueOrFalse') {
            return data;
        }

        const scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();
        const questionsData = Array.isArray(data.questionsData)
            ? data.questionsData
            : [];

        return {
            id: $exeDevice.id,
            typeGame: 'TrueOrFalse',
            eXeGameInstructions: data.eXeFormInstructions || '',
            eXeIdeviceTextAfter: '',
            msgs: $exeDevice.msgs,
            questionsRandom: false,
            percentageQuestions: 100,
            time: 0,
            questionsGame: questionsData.map((q) => ({
                question: q.baseText || '',
                feedback: q.feedback || '',
                suggestion: q.hint || '',
                solution: q.answer === 'True' ? 1 : 0,
            })),
            isScorm: scorm.isScorm,
            weighted: scorm.weighted || 100,
            isTest: false,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            evaluation: false,
            evaluationID: '',
            ideviceId: $exeDevice.id,
        };
    },
    refreshTranslations: function () {
        this.ci18n = {
            msgStartGame: c_('Click here to start'),
            msgTime: c_('Time per question'),
            msgNoImage: c_('No picture question'),
            msgScoreScorm: c_(
                "The score can't be saved because this page is not part of a SCORM package."
            ),
            msgEndGameScore: c_(
                'Please start the game before saving your score.'
            ),
            msgOnlySaveScore: c_('You can only save the score once!'),
            msgOnlySave: c_('You can only save once'),
            msgYouScore: c_('Your score'),
            msgAuthor: c_('Authorship'),
            msgOnlySaveAuto: c_(
                'Your score will be saved after each question. You can only play once.'
            ),
            msgSaveAuto: c_(
                'Your score will be automatically saved after each question.'
            ),
            msgSeveralScore: c_(
                'You can save the score as many times as you want'
            ),
            msgYouLastScore: c_('The last score saved is'),
            msgActityComply: c_('You have already done this activity.'),
            msgPlaySeveralTimes: c_(
                'You can do this activity as many times as you want'
            ),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgTypeGame: c_('True or false'),
            msgFeedback: c_('Feedback'),
            msgSuggestion: c_('Suggestion'),
            msgSolution: c_('Solution'),
            msgQuestion: c_('Question'),
            msgTrue: c_('True'),
            msgFalse: c_('False'),
            msgOk: c_('Correct'),
            msgKO: c_('Incorrect'),
            msgShow: c_('Show'),
            msgHide: c_('Hide'),
            msgCheck: c_('Check'),
            msgReboot: c_('Try again!'),
            msgScore: c_('Score'),
            msgWeight: c_('Weight'),
            msgNext: c_('Next'),
            msgPrevious: c_('Previous'),
        };
    },
    setMessagesInfo: function () {
        const msgs = this.msgs;
        msgs.msgWriteQuestion = _('Please write the question.');
        msgs.msgOneQuestion = _('Please add at least one question');
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.'
        );
        msgs.msgIDLenght = _(
            'The report identifier must have at least 5 characters'
        );
        msgs.msgTitleAltImageWarning = _('Accessibility warning');
        msgs.msgAltImageWarning = _(
            'At least one image has no description, are you sure you want to continue without including it? Without it the image may not be accessible to some users with disabilities, or to those using a text browser, or browsing the Web with images turned off.'
        );
        msgs.msgCorrect = _('Select the correct answer');
        msgs.msNotScorm = _('SCORM grades can only be saved in Quiz mode');
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    addQuestion: function () {
        if (!$exeDevice.validateQuestion()) return;
        $exeDevice.typeEdit = -1;
        $exeDevice.numberId++;
        $exeDevice.clearQuestion();
        $exeDevice.questionsGame.push($exeDevice.getDefaultQuestion());
        $exeDevice.active = $exeDevice.questionsGame.length - 1;

        $('#tofENumberQuestion').text($exeDevice.active + 1);
        $('#tofEPaste').hide();
        $('#tofENumQuestions').text($exeDevice.questionsGame.length);

        if (tinyMCE.get('tofEQuestionEditor')) {
            tinyMCE.get('tofEQuestionEditor').setContent('');
        }
        $('tofEQuestionEditor').val('');

        if (tinyMCE.get('tofEFeedBackEditor')) {
            tinyMCE.get('tofEFeedBackEditor').setContent('');
        }
        $('tofEFeedBackEditor').val('');

        if (tinyMCE.get('tofESuggestionEditor')) {
            tinyMCE.get('tofESuggestionEditor').setContent('');
        }
        $('tofESuggestionEditor').val('');
        $exeDevice.updateQuestionsNumber();
    },

    clearQuestion: function () {
        if (tinyMCE.get('tofEQuestionEditor')) {
            tinyMCE.get('tofEQuestionEditor').setContent('');
        }
        $('tofEQuestionEditor').val('');

        if (tinyMCE.get('tofEFeedBackEditor')) {
            tinyMCE.get('tofEFeedBackEditor').setContent('');
        }
        $('tofEFeedBackEditor').val('');

        if (tinyMCE.get('tofESuggestionEditor')) {
            tinyMCE.get('tofESuggestionEditor').setContent('');
        }
        $('tofESuggestionEditor').val('');

        $('input[name="tofAnswer"]').prop('checked', false);
    },

    removeQuestion: function () {
        if ($exeDevice.questionsGame.length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgOneQuestion);
            return;
        }

        $exeDevice.questionsGame.splice($exeDevice.active, 1);

        if ($exeDevice.active >= $exeDevice.questionsGame.length - 1) {
            $exeDevice.active = $exeDevice.questionsGame.length - 1;
        }

        $exeDevice.typeEdit = -1;
        $('#tofEPaste').hide();
        $('#tofENumQuestions').text($exeDevice.questionsGame.length);
        $('#tofENumberQuestion').text($exeDevice.active + 1);

        $exeDevice.updateQuestionsNumber();

        $exeDevice.showQuestion($exeDevice.active);
    },

    copyQuestion: function () {
        if (!$exeDevice.validateQuestion()) return;
        $exeDevice.typeEdit = 0;
        $exeDevice.clipBoard = JSON.parse(
            JSON.stringify($exeDevice.questionsGame[$exeDevice.active])
        );
        $('#tofEPaste').show();
    },

    cutQuestion: function () {
        if (
            !$exeDevice.validateQuestion() ||
            !$exeDevice.questionsGame ||
            $exeDevice.questionsGame.length == 0
        )
            return;

        $exeDevice.numberCutCuestion = $exeDevice.active;
        $exeDevice.typeEdit = 1;
        $('#tofEPaste').show();
    },

    pasteQuestion: function () {
        if ($exeDevice.typeEdit === 0) {
            $exeDevice.active++;
            const newquestion = JSON.parse(
                JSON.stringify($exeDevice.clipBoard)
            );
            $exeDevice.questionsGame.splice($exeDevice.active, 0, newquestion);
            $exeDevice.updateQuestionsNumber();
            $exeDevice.showQuestion($exeDevice.active);
        } else if ($exeDevice.typeEdit === 1) {
            $('#tofEPaste').hide();
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                $exeDevice.questionsGame,
                $exeDevice.numberCutCuestion,
                $exeDevice.active
            );
            $exeDevice.showQuestion($exeDevice.active);
        }
        $('#tofENumQuestions').text($exeDevice.questionsGame.length);
    },

    nextQuestion: function () {
        if (!$exeDevice.validateQuestion()) return;

        if ($exeDevice.active < $exeDevice.questionsGame.length - 1) {
            $exeDevice.active++;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    lastQuestion: function () {
        if (!$exeDevice.validateQuestion()) return;

        if ($exeDevice.active < $exeDevice.questionsGame.length - 1) {
            $exeDevice.active = $exeDevice.questionsGame.length - 1;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    previousQuestion: function () {
        if (!$exeDevice.validateQuestion()) return;

        if ($exeDevice.active > 0) {
            $exeDevice.active--;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    firstQuestion: function () {
        if (!$exeDevice.validateQuestion()) return;

        if ($exeDevice.active > 0) {
            $exeDevice.active = 0;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    showQuestion: function (i) {
        const num = Math.min(
            Math.max(i, 0),
            $exeDevice.questionsGame.length - 1
        );
        const p = $exeDevice.questionsGame[num];
        const questionData = p || $exeDevice.getDefaultQuestion();
        $('#tofENumQuestions').text($exeDevice.questionsGame.length);

        if (tinymce.get('tofEQuestionEditor')) {
            tinymce.get('tofEQuestionEditor').setContent(questionData.question);
        }
        $('#tofEQuestionEditor').val(questionData.question);

        if (tinymce.get('tofEFeedBackEditor')) {
            tinymce.get('tofEFeedBackEditor').setContent(questionData.feedback);
        }
        $('#tofEFeedBackEditor').val(questionData.feedback);

        if (tinymce.get('tofESuggestionEditor')) {
            tinymce
                .get('tofESuggestionEditor')
                .setContent(questionData.suggestion);
        }
        $('#tofESuggestionEditor').val(questionData.suggestion);

        const solution = questionData.solution;

        $('input[name="tofAnswer"][value="0"]').prop('checked', solution == 0);
        $('input[name="tofAnswer"][value="1"]').prop('checked', solution == 1);
        $('#tofENumberQuestion').text(num + 1);
    },

    createForm: function () {
        const path = $exeDevice.idevicePath,
            html = `
            <div id="trueorfalseIdeviceForm">
                <p class="exe-block-info exe-block-dismissible">
                    ${_('Create interactive True or False quizzes.')} 
                    <a style="display:none;" href="https://youtu.be/xHhrBZ_66To" hreflang="es" target="_blank">${_('Usage Instructions')}</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Answer all the questions in this quiz.'))}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_('Options')}</a></legend>
                        <div>
                            <div class="toggle-item mb-3">
                                <span class="toggle-control">
                                    <input type="checkbox" id="tofEShowSlider" class="toggle-input" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label mb-0" for="tofEShowSlider">${_('Slides list')}</label>
                            </div>
                            <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                                <div class="toggle-item mb-0">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="tofEIsTest" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label mb-0" for="tofEIsTest">${_('Test')}</label>
                                </div>
                                <div id="tofETimeDiv" class="d-none flex-nowrap align-items-center gap-2">
                                    <label for="tofETime" class="mb-0">${_('Time (minutes)')}:</label>
                                    <input type="number" class="form-control" name="tofETime" id="tofETime" value="0" min="0" max="59" />
                                </div>
                            </div>
                            <div class="toggle-item mb-3">
                                <span class="toggle-control">
                                    <input type="checkbox" id="tofEQuestionsRandom" class="toggle-input" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label mb-0" for="tofEQuestionsRandom">${_('Random questions')}</label>
                            </div>
                            <div class="d-flex flex-nowrap align-items-center gap-2 mb-3">
                                <label for="tofEPercentageQuestions" class="mb-0">%${_('Questions')}:</label>
                                <input type="number" class="form-control" name="tofEPercentageQuestions" id="tofEPercentageQuestions" value="100" min="1" max="100" />
                                <span id="tofENumeroPercentaje">1/1</span>
                            </div>
                            <div class="Games-Reportdiv d-none flex-wrap align-items-center gap-2 mb-3">
                                 <div class="toggle-item mb-0">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="tofEEvaluation" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label mb-0" for="tofEEvaluation">${_('Progress report')}</label>
                                </div>
                                <div class="d-flex flex-nowrap align-items-center gap-2">
                                    <label for="tofEEvaluationID" class="mb-0">${_('Identifier')}:</label>
                                    <input type="text" class="form-control" id="tofEEvaluationID" disabled value="${eXeLearning.app.project.odeId || ''}"/>
                                </div>
                                <a href="#tofEEvaluationHelp" id="tofEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                    <img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}"/>
                                </a>
                            </div>
                            <p id="tofEEvaluationHelp" class="tofTypeGameHelp exe-block-info d-none">
                                ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                            </p>
                        </div>
                    </fieldset>
                    <fieldset class="exe-fieldset">
                        <legend><a href="#">${_('Questions')}</a></legend>
                        <div class="TOF-EPanel" id="tofEPanel">
                            <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                                <a href="#" id="tofQuestionToggle" class="eXeE-TabButton eXeE-TabQuestions eXeE-Active">${_('Question')}</a>
                                <a href="#" id="tofFeedBackToggle" class="eXeE-TabButton eXeE-TabFeebBack">${_('Feedback')}</a>
                                <a href="#" id="tofSuggestionToggle" class="eXeE-TabButton eXeE-TabSuggestion">${_('Suggestion')}</a>
                            </div>
                            <div class="TOF-Editor d-block mb-3" id="tofQuestionDiv">
                                <textarea id="tofEQuestionEditor" class="exe-html-editor TOF-EQuestion"></textarea>
                            </div>
                            <div class="TOF-Editor d-none mb-3" id="tofFeedBackDiv">
                                <textarea id="tofEFeedBackEditor" class="exe-html-editor TOF-EFeedBack"></textarea>
                            </div>
                            <div class="TOF-Editor d-none mb-3" id="SuggestionDiv">
                                <textarea id="tofESuggestionEditor" class="exe-html-editor TOF-ESuggestion"></textarea>
                            </div>
                            <div class="TOF-ERadioButtons d-flex flex-wrap align-items-center gap-3 mb-3">
                                <div class="form-check form-check-inline mb-0">
                                    <input class="form-check-input" type="radio" name="tofAnswer" value="1" id="tofAnswerTrue" />
                                    <label class="form-check-label" for="tofAnswerTrue">${_('True')}</label>
                                </div>
                                <div class="form-check form-check-inline mb-0">
                                    <input class="form-check-input" type="radio" name="tofAnswer" value="0" id="tofAnswerFalse" />
                                    <label class="form-check-label" for="tofAnswerFalse">${_('False')}</label>
                                </div>
                            </div>
                            <div class="d-flex flex-wrap align-items-center justify-content-center gap-2 mb-3" id="tofENavigationButtons">
                                <a href="#" id="tofEAdd" class="TOF-ENavigationButton" title="${_('Add question')}"><img src="${path}quextIEAdd.png" alt="${_('Add question')}" class="TOF-EButtonImage b-add" /></a>
                                <a href="#" id="tofEFirst" class="TOF-ENavigationButton" title="${_('First question')}"><img src="${path}quextIEFirst.png" alt="${_('First question')}" class="TOF-EButtonImage b-first" /></a>
                                <a href="#" id="tofEPrevious" class="TOF-ENavigationButton" title="${_('Previous question')}"><img src="${path}quextIEPrev.png" alt="${_('Previous question')}" class="TOF-EButtonImage b-prev" /></a>
                                <span class="sr-av">${_('Question number:')}</span><span class="TOF-NumberQuestion" id="tofENumberQuestion">1</span>
                                <a href="#" id="tofENext" class="TOF-ENavigationButton" title="${_('Next question')}"><img src="${path}quextIENext.png" alt="${_('Next question')}" class="TOF-EButtonImage b-next" /></a>
                                <a href="#" id="tofELast" class="TOF-ENavigationButton" title="${_('Last question')}"><img src="${path}quextIELast.png" alt="${_('Last question')}" class="TOF-EButtonImage b-last" /></a>
                                <a href="#" id="tofEDelete" class="TOF-ENavigationButton" title="${_('Delete question')}"><img src="${path}quextIEDelete.png" alt="${_('Delete question')}" class="TOF-EButtonImage b-delete" /></a>
                                <a href="#" id="tofECopy" class="TOF-ENavigationButton" title="${_('Copy question')}"><img src="${path}quextIECopy.png" alt="${_('Copy question')}" class="TOF-EButtonImage b-copy" /></a>
                                <a href="#" id="tofECut" class="TOF-ENavigationButton" title="${_('Cut question')}"><img src="${path}quextIECut.png" alt="${_('Cut question')}" class="TOF-EButtonImage b-cut" /></a>
                                <a href="#" id="tofEPaste" class="TOF-ENavigationButton" title="${_('Paste question')}"><img src="${path}quextIEPaste.png" alt="${_('Paste question')}" class="TOF-EButtonImage b-paste" /></a>
                            </div>
                            <div class="TOF-ENumQuestionDiv d-flex flex-nowrap align-items-center gap-2" id="tofENumQuestionDiv">
                                <div class="TOF-ENumQ"><span class="sr-av">${_('Number of questions:')}</span></div>
                                <span class="TOF-ENumQuestions" id="tofENumQuestions">0</span>
                            </div>
                        </div>
                    </fieldset>                        
                    ${$exeDevicesEdition.iDevice.common.getTextFieldset('after')}          
                </div>
                ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
                ${$exeDevicesEdition.iDevice.gamification.scorm.getTab(true, true, true)}
                ${$exeDevicesEdition.iDevice.gamification.share.getTab(true, 6, true)}
                ${$exeDevicesEdition.iDevice.gamification.share.getTabIA(6)}
            </div>
            `;
        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('trueorfalseIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();
        $exeDevice.enable();
    },

    enable() {
        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
        $exeDevice.showQuestion(0);
    },

    showEditor($activeEditor, $link) {
        $('#tofQuestionDiv, #tofFeedBackDiv, #SuggestionDiv')
            .removeClass('d-block')
            .addClass('d-none');

        $activeEditor.removeClass('d-none').addClass('d-block');

        $(
            '#tofQuestionToggle, #tofFeedBackToggle, #tofSuggestionToggle'
        ).removeClass('eXeE-Active');
        $link.addClass('eXeE-Active');
    },

    addEvents: function () {
        if ($exeDevice.questionsGame.length == 0) {
            $exeDevice.active = 0;
            $exeDevice.questionsGame.push($exeDevice.getDefaultQuestion());
        }

        $('#tofQuestionToggle').on('click', () =>
            $exeDevice.showEditor($('#tofQuestionDiv'), $('#tofQuestionToggle'))
        );
        $('#tofFeedBackToggle').on('click', () =>
            $exeDevice.showEditor($('#tofFeedBackDiv'), $('#tofFeedBackToggle'))
        );
        $('#tofSuggestionToggle').on('click', () =>
            $exeDevice.showEditor(
                $('#SuggestionDiv'),
                $('#tofSuggestionToggle')
            )
        );
        $('#tofEPaste').hide();

        $('#tofShowSolutions').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#tofTimeShowSolutions').prop('disabled', !marcado);
        });

        $('#tofShowCodeAccess').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#tofCodeAccess').prop('disabled', !marcado);
            $('#tofMessageCodeAccess').prop('disabled', !marcado);
        });

        $('#tofEAdd').on('click', function (e) {
            e.preventDefault();
            $exeDevice.addQuestion();
        });

        $('#tofEFirst').on('click', function (e) {
            e.preventDefault();
            $exeDevice.firstQuestion();
        });

        $('#tofEPrevious').on('click', function (e) {
            e.preventDefault();
            $exeDevice.previousQuestion();
        });

        $('#tofENext').on('click', function (e) {
            e.preventDefault();
            $exeDevice.nextQuestion();
        });

        $('#tofELast').on('click', function (e) {
            e.preventDefault();
            $exeDevice.lastQuestion();
        });

        $('#tofEDelete').on('click', function (e) {
            e.preventDefault();
            $exeDevice.removeQuestion();
        });

        $('#tofECopy').on('click', function (e) {
            e.preventDefault();
            $exeDevice.copyQuestion();
        });

        $('#tofECut').on('click', function (e) {
            e.preventDefault();
            $exeDevice.cutQuestion();
        });

        $('#tofEPaste').on('click', function (e) {
            e.preventDefault();
            $exeDevice.pasteQuestion();
        });

        $('#tofETime')
            .on('keyup', function () {
                this.value = this.value.replace(/\D/g, '').substring(0, 2);
            })
            .on('focusout', function () {
                this.value = this.value.trim() === '' ? 0 : this.value;
                this.value = Math.max(0, Math.min(59, this.value));
            });

        $('#tofEEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#tofEEvaluationID').prop('disabled', !marcado);
        });

        $('#tofEEvaluationHelpLnk').on('click', function (e) {
            e.preventDefault();
            const $el = $('#tofEEvaluationHelp');
            const show = $el.hasClass('d-none');
            $el.toggleClass('d-none', !show).toggleClass('d-block', show);
        });
        if (
            window.File &&
            window.FileReader &&
            window.FileList &&
            window.Blob
        ) {
            $('#eXeGameExportImport').show();
            $('#eXeGameImportGame').on('change', function (e) {
                const file = e.target.files[0];
                if (!file) {
                    return;
                }
                const reader = new FileReader();
                reader.onload = function (e) {
                    $exeDevice.importGame(e.target.result, file.type);
                };
                reader.readAsText(file);
            });
            $('#eXeGameExportQuestions').on('click', () => {
                $exeDevice.exportQuestions();
            });
        } else {
            $('#eXeGameExportImport').hide();
        }

        $('#tofEIsTest').on('click', function () {
            const $timeDiv = $('#tofETimeDiv');
            const $reportDiv = $('.Games-Reportdiv');

            const show = $timeDiv.hasClass('d-none');

            $timeDiv.toggleClass('d-none', !show).toggleClass('d-flex', show);
            $reportDiv.toggleClass('d-none', !show).toggleClass('d-flex', show);
        });

        $('#tofEPercentageQuestions')
            .on('keyup click', function () {
                this.value = this.value.replace(/\D/g, '').substring(0, 3);
                if (this.value > 0 && this.value <= 100) {
                    $exeDevice.updateQuestionsNumber();
                }
            })
            .on('focusout', function () {
                let value =
                    this.value.trim() === '' ? 100 : parseInt(this.value, 10);
                value = Math.max(1, Math.min(value, 100));
                this.value = value;
                $exeDevice.updateQuestionsNumber();
            });

        $exeDevicesEdition.iDevice.gamification.share.addEvents(
            6,
            $exeDevice.insertQuestions
        );
    },

    updateQuestionsNumber: function () {
        let percentage = parseInt(
            $exeDevice.removeTags($('#tofEPercentageQuestions').val())
        );
        if (isNaN(percentage)) return;

        percentage = Math.min(Math.max(percentage, 1), 100);
        const totalQuestions = $exeDevice.questionsGame.length;
        let num = Math.max(Math.round((percentage * totalQuestions) / 100), 1);

        $('#tofENumeroPercentaje').text(`${num}/${totalQuestions}`);
    },

    removeTags: function (str) {
        const wrapper = $('<div></div>');
        wrapper.html(str);
        return wrapper.text();
    },

    importText: function (content) {
        const lines = content.split('\n');
        $exeDevice.insertQuestions(lines);
    },

    importCuestionaryXML: function (xmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        if ($(xmlDoc).find('parsererror').length > 0) return false;

        const quiz = $(xmlDoc).find('quiz').first();
        if (quiz.length === 0) return false;

        const questions = quiz.find('question');
        const questionsJson = [];

        questions.each(function () {
            const question = $(this);
            const type = question.attr('type');
            if (type !== 'truefalse') return;

            const questionText = question
                .find('questiontext > text')
                .first()
                .text()
                .trim();

            let feedback = '';
            const fbNode = question.find('feedback > text').first();
            if (fbNode.length) {
                feedback = fbNode.text().trim();
            }

            const suggestion = '';

            let solution;
            const ansText = question
                .find('answer > text')
                .first()
                .text()
                .trim()
                .toLowerCase();
            if (ansText === 'true') {
                solution = 1;
            } else if (ansText === 'false') {
                solution = 0;
            }

            if (typeof solution !== 'undefined' && questionText) {
                questionsJson.push({
                    question: questionText,
                    feedback: feedback,
                    suggestion: suggestion,
                    solution: solution,
                });
            }
        });

        const questionsG = questionsJson.filter(
            (q) => q.question && typeof q.solution !== 'undefined'
        );
        $exeDevice.addQuestions(questionsG);
    },

    importGame: function (content, filetype) {
        const game =
            $exeDevices.iDevice.gamification.helpers.isJsonString(content);
        if (content && content.includes('\u0000')) {
            $exeDevice.showMessage(_('Sorry, wrong file format'));
            return;
        } else if (!game && content) {
            if (filetype.match('text/plain')) {
                $exeDevice.importText(content);
            } else if (
                filetype.match('application/xml') ||
                filetype.match('text/xml')
            ) {
                $exeDevice.importMoodle(content);
            } else {
                eXe.app.alert(_('Sorry, wrong file format'));
            }
            return;
        } else if (!game || typeof game.typeGame === 'undefined') {
            $exeDevice.showMessage(_('Sorry, wrong file format'));
            return;
        } else if (game.typeGame === 'TrueOrFalse') {
            $exeDevice.questionsGame = game.questionsGame;
            game.id = $exeDevice.id;
            $exeDevice.updateFieldGame(game);
            const eXeGameInstructions = game.eXeGameInstructions || '',
                eXeIdeviceTextAfter = game.eXeIdeviceTextAfter || '';
            if (tinymce.get('eXeGameInstructions')) {
                tinymce
                    .get('eXeGameInstructions')
                    .setContent(eXeGameInstructions);
            }
            $('#eXeGameInstructions').val(eXeGameInstructions);

            if (tinymce.get('eXeIdeviceTextAfter')) {
                tinymce
                    .get('eXeIdeviceTextAfter')
                    .setContent(eXeIdeviceTextAfter);
            }
            $('#eXeIdeviceTextAfter').val(eXeIdeviceTextAfter);
        } else if (game.typeGame !== 'TrueOrFalse') {
            $exeDevice.showMessage(_('Sorry, wrong file format'));
            return;
        }
        $exeDevice.active = 0;
        $exeDevice.showQuestion($exeDevice.active);
        $exeDevice.deleteEmptyQuestion();
        $exeDevice.updateQuestionsNumber();
        //$('.exe-form-tabs li:first-child a').click();
    },

    importMoodle: function (xmlString) {
        const xmlDoc = $.parseXML(xmlString),
            $xml = $(xmlDoc);
        if ($xml.find('quiz').length > 0) {
            $exeDevice.importCuestionaryXML(xmlString);
        } else {
            eXe.app.alert(_('Sorry, wrong file format'));
        }
    },

    insertQuestions: function (lines) {
        const lineFormat =
            /^vof#[^\s#].*?#(0|1)#.*?#.*?|[^\s#].*?#(0|1)#.*?#.*?|[01]#[^#]+$/;
        let questions = [];
        lines.forEach((line) => {
            if (lineFormat.test(line)) {
                const p = $exeDevice.getDefaultQuestion();
                const lineContent = line.replace('v-f#', '');
                let question = '';
                let solutionRaw = '';
                let suggestion = '';
                let feedback = '';
                const simplePattern = /^[01]#[^#]+$/;
                if (simplePattern.test(lineContent)) {
                    [solutionRaw, question] = lineContent.split('#');
                } else {
                    const parts = lineContent.split('#');
                    [
                        question = '',
                        solutionRaw = '',
                        suggestion = '',
                        feedback = '',
                    ] = parts;
                }

                p.question = question;
                p.solution = ['true', '1'].includes(
                    solutionRaw.trim().toLowerCase()
                );
                p.suggestion = suggestion;
                p.feedback = feedback;

                questions.push(p);
            }
        });
        $exeDevice.addQuestions(questions);
    },
    addQuestions: function (questions) {
        if (!questions || questions.length == 0) {
            eXe.app.alert(
                _('Sorry, there are no questions for this type of activity.')
            );
            return;
        }
        for (let i = 0; i < questions.length; i++) {
            $exeDevice.questionsGame.push(questions[i]);
        }
        $exeDevice.active = 0;
        $exeDevice.showQuestion($exeDevice.active);
        $exeDevice.deleteEmptyQuestion();
        $exeDevice.updateQuestionsNumber();
        //$('.exe-form-tabs li:first-child a').click();
    },

    deleteEmptyQuestion: function () {
        if (tinyMCE.get('tofEQuestionEditor')) {
            question = tinyMCE.get('tofEQuestionEditor').getContent();
        }
        if (question.length === 0 && $exeDevice.questionsGame.length > 1) {
            $exeDevice.removeQuestion();
        }
    },

    loadPreviousValues: function () {
        let dataGame = this.idevicePreviousData;

        if (dataGame && Object.keys(dataGame).length > 0) {
            dataGame = $exeDevice.transformObject(dataGame);

            $exeDevice.active = 0;
            $exeDevice.questionsGame = dataGame.questionsGame;

            const instructions = dataGame.eXeGameInstructions || '';

            const textAfter = dataGame.eXeIdeviceTextAfter || '';
            $('#eXeGameInstructions').val(instructions);
            $('#eXeIdeviceTextAfter').val(textAfter);

            $exeDevicesEdition.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs
            );
            $exeDevice.updateFieldGame(dataGame);
        }
    },

    updateFieldGame: function (game) {
        $('#tofEEvaluation').prop('checked', game.evaluation);
        $('#tofEEvaluationID').val(game.evaluationID);
        $('#tofEEvaluationID').prop('disabled', !game.evaluation);
        $('#tofETime').val(game.time);
        $('#tofEQuestionsRandom').prop('checked', game.questionsRandom);
        $('#tofEPercentageQuestions').val(game.percentageQuestions);
        $('#tofEShowSlider').prop('checked', game.showSlider || false);
        $('#tofEIsTest').prop('checked', game.isTest || false);

        if (game.isTest) {
            $('#tofETimeDiv, .Games-Reportdiv')
                .removeClass('d-none')
                .addClass('d-flex');
        } else {
            $('#tofETimeDiv, .Games-Reportdiv')
                .removeClass('d-flex')
                .addClass('d-none');
        }

        $exeDevice.updateQuestionsNumber();
        game.weighted =
            typeof game.weighted !== 'undefined' ? game.weighted : 100;
        game.showSlider =
            typeof game.showSlider !== 'undefined' ? game.showSlider : false;
        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted
        );
    },

    save: function () {
        if (!$exeDevice.validateQuestion()) return false;
        let dataGame = $exeDevice.validateData();
        if (dataGame) {
            return dataGame;
        } else {
            return false;
        }
    },

    getDefaultQuestion: function () {
        return {
            question: '',
            feedback: '',
            suggestion: '',
            solution: true,
        };
    },

    validateQuestion: function () {
        let message = '';
        const msgs = $exeDevice.msgs,
            p = {};
        if (tinyMCE.get('tofEQuestionEditor')) {
            p.question = tinyMCE.get('tofEQuestionEditor').getContent();
        } else {
            p.question = $('#tofEQuestionEditor').val();
        }

        if (tinyMCE.get('tofEFeedBackEditor')) {
            p.feedback = tinyMCE.get('tofEFeedBackEditor').getContent();
        } else {
            p.feedback = $('#tofEFeedBackEditor').val();
        }

        if (tinyMCE.get('tofESuggestionEditor')) {
            p.suggestion = tinyMCE.get('tofESuggestionEditor').getContent();
        } else {
            p.suggestion = $('#tofESuggestionEditor').val();
        }

        if (p.question.length === 0) {
            message = msgs.msgWriteQuestion;
        }

        if ($('input[name="tofAnswer"]:checked').length === 0) {
            message = msgs.msgCorrect;
        }

        p.solution = parseInt($('input[name=tofAnswer]:checked').val());

        if (message.length === 0) {
            $exeDevice.questionsGame[$exeDevice.active] = p;
            return true;
        } else {
            $exeDevice.showMessage(message);
            return false;
        }
    },

    exportQuestions: function () {
        const dataGame = this.validateData();
        if (!dataGame) return false;

        const lines = this.getLinesQuestions(dataGame.questionsGame);
        const fileContent = lines.join('\n');
        const newBlob = new Blob([fileContent], { type: 'text/plain' });
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveOrOpenBlob(newBlob);
            return;
        }
        const data = window.URL.createObjectURL(newBlob);
        const link = document.createElement('a');
        link.href = data;
        link.download = `${_('True or false')}.txt`;

        document.getElementById('trueorfalseIdeviceForm').appendChild(link);
        link.click();
        setTimeout(() => {
            document.getElementById('trueorfalseIdeviceForm').removeChild(link);
            window.URL.revokeObjectURL(data);
        }, 100);
    },

    getLinesQuestions: function (questionsGame) {
        let lineswords = [];
        for (let i = 0; i < questionsGame.length; i++) {
            const solution =
                questionsGame[i].solution &&
                questionsGame[i].solution !== 'false'
                    ? 1
                    : 0;
            let question = `v-f#${questionsGame[i].question}#${solution}#${questionsGame[i].feedback}#${questionsGame[i].suggestion}`;
            lineswords.push(question);
        }
        return lineswords;
    },

    validateData: function () {
        let evaluation = $('#tofEEvaluation').is(':checked');
        const evaluationID = $('#tofEEvaluationID').val(),
            questionsRandom = $('#tofEQuestionsRandom').is(':checked'),
            percentageQuestions = parseInt(
                $exeDevice.removeTags($('#tofEPercentageQuestions').val())
            ),
            isTest = $('#tofEIsTest').is(':checked'),
            id = $exeDevice.id,
            time = parseInt($('#tofETime').val(), 10),
            questionsGame = $exeDevice.questionsGame,
            showSlider = $('#tofEShowSlider').is(':checked');

        evaluation = isTest ? evaluation : false;

        if (questionsGame.length == 0) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
            return false;
        }

        if (evaluation && evaluationID.length < 5) {
            $exeDevice.showMessage($exeDevice.msgs.msgIDLenght);
            return false;
        }
        for (let i = 0; i < questionsGame.length; i++) {
            const mQuestion = questionsGame[i];

            if (mQuestion.question.length === 0) {
                $exeDevice.showMessage($exeDevice.msgs.msgWriteQuestion);
                return false;
            }
        }

        const scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();

        if (scorm.isScorm > 0 && !isTest) {
            $exeDevice.showMessage($exeDevice.msgs.msNotScorm);
            return false;
        }

        let eXeGameInstructions = '';
        if (tinyMCE.get('eXeGameInstructions')) {
            eXeGameInstructions = tinyMCE
                .get('eXeGameInstructions')
                .getContent();
        }
        let eXeIdeviceTextAfter = '';
        if (tinyMCE.get('eXeIdeviceTextAfter')) {
            eXeIdeviceTextAfter = tinyMCE
                .get('eXeIdeviceTextAfter')
                .getContent();
        }

        const fields = this.ci18n,
            i18n = fields;
        for (const i in fields) {
            const fVal = $('#ci18n_' + i).val();
            if (fVal !== '') i18n[i] = fVal;
        }

        return {
            id: id,
            typeGame: 'TrueOrFalse',
            eXeGameInstructions: eXeGameInstructions,
            eXeIdeviceTextAfter: eXeIdeviceTextAfter,
            msgs: i18n,
            questionsRandom: questionsRandom,
            percentageQuestions: percentageQuestions,
            isTest: isTest,
            time: time,
            questionsGame: questionsGame,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted || 100,
            evaluation: evaluation,
            evaluationID: evaluationID,
            showSlider: showSlider,
            ideviceId: id,
        };
    },
};
