/* eslint-disable no-undef */
/**
 * Challenge iDevice (edition code)
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno, Francisco Javier Pulido
 * Testers: Ricardo Málaga Floriano, Francisco Muñoz de la Peña
 * Translator: Antonio Juan Delgado García
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    // i18n
    i18n: {
        name: _('Challenge'),
    },
    idevicePath: '',
    msgs: {},
    classIdevice: 'challenge',
    active: 0,
    numberId: 0,
    typeActive: 0,
    challengesGame: [],
    desafioTitle: '',
    desafioTime: 40,
    desafioSolution: '',
    desafioDescription: '',
    typeEdit: -1,
    numberCutCuestion: -1,
    desafioFeedBacks: [],
    desafioVersion: 1,
    clipBoard: '',
    desafioID: 0,
    id: false,
    ci18n: {},

    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.desafioID = this.getId();
        this.refreshTranslations();
        this.setMessagesInfo();
        this.createForm();
    },

    getId: function () {
        return Math.round(new Date().getTime() + Math.random() * 100);
    },

    refreshTranslations: function () {
        this.ci18n = {
            msgStartGame: c_('Click here to start'),
            msgSubmit: c_('Submit'),
            msgInformationLooking: c_(
                'Cool! The information you were looking for'
            ),
            msgPlayStart: c_('Click here to play'),
            msgMinimize: c_('Minimize'),
            msgMaximize: c_('Maximize'),
            msgTime: c_('Time per question'),
            msgNoImage: c_('No picture question'),
            msgSuccesses: c_(
                'Right! | Excellent! | Great! | Very good! | Perfect!'
            ),
            msgFailures: c_(
                'It was not that! | Incorrect! | Not correct! | Sorry! | Error!'
            ),
            msgInformation: c_('Information'),
            mgsSolution: c_('Solution'),
            msgDate: c_('Date'),
            msgDesafio: c_('Challenge'), // Desafío in ES
            msgChallenge: c_('Trial'), // Reto in ES
            msgChallengesCompleted: c_('Completed trials'),
            msgStartTime: c_('Starting time'),
            msgReadTime: c_(
                "Read the instructions and click on a trial when you're ready to play."
            ),
            msgChallengesAllCompleted: c_(
                "You've completed all the trials! You can now complete the game."
            ),
            msgDesafioSolved: c_('You made it! You can restart to play again.'),
            msgDesafioSolved1: c_('You solved the trial! Congratulations!'),
            msgEndTime: c_('Time Over. Please restart to try again.'),
            msgSolutionError: c_('Sorry. Wrong solution.'),
            msgSolutionCError: c_('Sorry. The solution is wrong.'),
            msgChallengeSolved: c_(
                'You solved this trial! Please select another one.'
            ),
            msgDesafioReboot: c_(
                'This will restart the game and reset its starting time. Do you want to continue?'
            ),
            msgCompleteAllChallenged: c_(
                'You must complete all the trials before facing the final challenge.'
            ),
            msgSolvedChallenge: c_('You already completed this trial.'),
            msgWriteChallenge: c_('Complete the trial. Write the solution.'),
            msgEndTimeRestart: c_('Time Over. Please restart to try again.'),
            msgReboot: c_('Restart'),
            msgHelp: c_('Help'),
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
            msgTypeGame: c_('Challenge'),
        };
    },

    setMessagesInfo: function () {
        const msgs = this.msgs;
        msgs.msgESelectFile = _(
            'The selected file does not contain a valid game'
        );
        msgs.msgTitleDesafio = _('Please write the challenge title.');
        msgs.msgDescriptionDesafio = _(
            'Please write the challenge description.'
        );
        msgs.msgSolutionDesafio = _('Please write the challenge solution.');
        msgs.msgOneChallenge = _('Please add at least one trial.');
        msgs.msgTenChallenges = _(
            'You can only add ten trials to a challenge.'
        );
        msgs.msgDataChanllenge = _(
            'Please write the title, description and solution of all the trials.'
        );
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.'
        );
        msgs.msgClue = _('Help');
        msgs.msgIDLenght = _(
            'The report identifier must have at least 5 characters'
        );
        msgs.msgTitleAltImageWarning = _('Accessibility warning');
        msgs.msgAltImageWarning = _(
            'At least one image has no description, are you sure you want to continue without including it? Without it the image may not be accessible to some users with disabilities, or to those using a text browser, or browsing the Web with images turned off.'
        );
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    addChallenge: function () {
        $exeDevice.saveChallenge();

        if ($exeDevice.challengesGame.length === 10) {
            $exeDevice.showMessage($exeDevice.msgs.msgTenChallenges);
            return;
        }

        $exeDevice.typeEdit = -1;
        $exeDevice.numberId++;
        $exeDevice.clearChallenge();
        $exeDevice.challengesGame.push($exeDevice.getChallengeDefault());
        $exeDevice.active = $exeDevice.challengesGame.length - 1;

        $('#desafioENumberChallenge').text($exeDevice.active + 1);
        $('#desafioEPaste').hide();
        $('#desafioENumChallenges').text($exeDevice.challengesGame.length);
        $('.desafio-EDivFeebBack').hide();
        $('#desafioEDivFeebBack-' + $exeDevice.active).show();

        if (tinyMCE.get('desafioEChallenge-' + $exeDevice.active)) {
            tinyMCE
                .get('desafioEChallenge-' + $exeDevice.active)
                .setContent('');
        } else {
            $('desafioEChallenge-' + $exeDevice.active).val('');
        }
    },

    clearChallenge: function () {
        $('#desafioECTitle').val('');
        $('#desafioECSolution').val('');
        $('#desafioECMessage').val('');
        $('#desafioECTime').val(5);
    },

    removeChallenge: function () {
        if ($exeDevice.challengesGame.length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgOneChallenge);
            return;
        }

        $exeDevice.challengesGame.splice($exeDevice.active, 1);

        if ($exeDevice.active >= $exeDevice.challengesGame.length - 1) {
            $exeDevice.active = $exeDevice.challengesGame.length - 1;
        }

        $exeDevice.typeEdit = -1;
        $('#desafioEPaste').hide();
        $('#desafioENumChallenges').text($exeDevice.challengesGame.length);
        $('#desafioENumberChallenge').text($exeDevice.active + 1);

        $exeDevice.updateFeedBack();
        $exeDevice.showChallenge($exeDevice.active);
    },

    updateFeedBack: function () {
        for (let i = 0; i < 10; i++) {
            let text = '';
            if (i < $exeDevice.challengesGame.length) {
                text = $exeDevice.challengesGame[i].description;
            }
            if (tinyMCE.get('desafioEChallenge-' + i)) {
                tinyMCE.get('desafioEChallenge-' + i).setContent(text);
            } else {
                $('desafioEChallenge-' + i).val(text);
            }
        }
    },

    copyChallenge: function () {
        $exeDevice.saveChallenge();
        $exeDevice.typeEdit = 0;
        $exeDevice.clipBoard = JSON.parse(
            JSON.stringify($exeDevice.challengesGame[$exeDevice.active])
        );
        $('#desafioEPaste').show();
    },

    cutChallenge: function () {
        $exeDevice.saveChallenge();
        $exeDevice.numberCutCuestion = $exeDevice.active;
        $exeDevice.typeEdit = 1;
        $('#desafioEPaste').show();
    },

    pasteChallenge: function () {
        if ($exeDevice.challengesGame.length > 9 + $exeDevice.typeEdit) {
            $('#desafioEPaste').hide();
            $exeDevice.showMessage($exeDevice.msgs.msgTenChallenges);
            return;
        }

        if ($exeDevice.typeEdit === 0) {
            $exeDevice.active++;
            $exeDevice.challengesGame.splice(
                $exeDevice.active,
                0,
                $exeDevice.clipBoard
            );
            $exeDevice.updateFeedBack();
            $exeDevice.showChallenge($exeDevice.active);
        } else if ($exeDevice.typeEdit === 1) {
            $('#desafioEPaste').hide();
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                $exeDevice.challengesGame,
                $exeDevice.numberCutCuestion,
                $exeDevice.active
            );
            $exeDevice.updateFeedBack();
            $exeDevice.showChallenge($exeDevice.active);
            $('#desafioENumChallenges').text($exeDevice.challengesGame.length);
        }
    },

    nextChallenge: function () {
        $exeDevice.saveChallenge();

        if ($exeDevice.active < $exeDevice.challengesGame.length - 1) {
            $exeDevice.active++;
            $exeDevice.showChallenge($exeDevice.active);
        }
    },

    lastChallenge: function () {
        $exeDevice.saveChallenge();

        if ($exeDevice.active < $exeDevice.challengesGame.length - 1) {
            $exeDevice.active = $exeDevice.challengesGame.length - 1;
            $exeDevice.showChallenge($exeDevice.active);
        }
    },

    previousChallenge: function () {
        $exeDevice.saveChallenge();

        if ($exeDevice.active > 0) {
            $exeDevice.active--;
            $exeDevice.showChallenge($exeDevice.active);
        }
    },

    firstChallenge: function () {
        $exeDevice.saveChallenge();

        if ($exeDevice.active > 0) {
            $exeDevice.active = 0;
            $exeDevice.showChallenge($exeDevice.active);
        }
    },

    showChallenge: function (i) {
        let num = i < 0 ? 0 : i;
        num =
            num >= $exeDevice.challengesGame.length
                ? $exeDevice.challengesGame.length - 1
                : num;

        const hide = (sel) => $(sel).addClass('js-hidden');
        const show = (sel) => $(sel).removeClass('js-hidden');

        hide('label[for="desafioEDSolution"], #desafioEDSolution');
        hide('label[for="desafioEDTitle"], #desafioEDTitle');
        show('label[for="desafioECTitle"], #desafioECTitle');
        show('label[for="desafioECSolution"], #desafioECSolution');

        $('#desafioENumQuestionDiv').show();
        $('#desafioSelects').hide();

        $('#desafioENavigationButtons').show();

        const c = $exeDevice.challengesGame[num];
        $('#desafioECTitle').val(c.title);
        $('#desafioECSolution').val(c.solution);
        $('#divDesafioEDescription').hide();
        $('.desafio-EDivFeebBack').hide();
        $('#desafioEDivFeebBack-' + i).show();
        $('#desafioEChallenges').show();
        $('#desafioENumChallenges').text($exeDevice.challengesGame.length);
        $('#desafioENumberChallenge').text($exeDevice.active + 1);

        if (typeof c.clues !== 'undefined') {
            $('#desafioEClue1').val(c.clues[0].clue);
            $('#desafioEClue2').val(c.clues[1].clue);
            $('#desafioEClue3').val(c.clues[2].clue);
            $('#desafioECTime1').val(c.clues[0].time);
            $('#desafioECTime2').val(c.clues[1].time);
            $('#desafioECTime3').val(c.clues[2].time);
        }
    },

    createForm: function () {
        const path = $exeDevice.idevicePath,
            html = `
        <div id="desafioIdeviceForm">
            <p class="exe-block-info exe-block-dismissible">${_('Create escape room type activities in which players will have to complete trials before solving the final challenge.')} <a href="https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe29/desafo.html" hreflang="es" target="_blank">${_('Usage Instructions')}</a></p>
            <div class="exe-form-tab" title="${_('General settings')}">
                ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Solve all the trials and complete the final challenge.'))}
                <fieldset class="exe-fieldset exe-fieldset-closed">
                    <legend><a href="#">${_('Options')}</a></legend>
                    <div>
                        <div class="mb-3">
                            <span class="toggle-item" role="switch" aria-checked="false">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="desafioEShowMinimize" aria-label="${_('Show minimized.')}" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="desafioEShowMinimize">${_('Show minimized.')}</label>
                            </span>
                        </div>
                        <div class="Games-Reportdiv  d-flex align-items-center gap-2 flex-nowrap">
                            <span class="toggle-item mb-0" data-target="desafioEEvaluationIDWrapper" role="switch" aria-checked="false">
                                <span class="toggle-control">
                                    <input type="checkbox" id="desafioEEvaluation" class="toggle-input" aria-label="${_('Progress report')}" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="desafioEEvaluation">${_('Progress report')}.</label>
                            </span>
                            <span id="desafioEEvaluationIDWrapper" class="d-inline-flex align-items-center gap-1">
                                <label for="desafioEEvaluationID" class="mb-0">${_('Identifier')}: </label>
                                <input type="text" id="desafioEEvaluationID" class="form-control form-control-sm" disabled value="${eXeLearning.app.project.odeId || ''}"/>
                            </span>
                            <strong class="GameModeLabel"><a href="#desafioEEvaluationHelp" id="desafioEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}"><img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}"/></a></strong>
                        </div>
                        <p id="desafioEEvaluationHelp" class="desafioTypeGameHelp exe-block-info">
                            ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                        </p>
                    </div>
                </fieldset>
                <fieldset class="exe-fieldset">
                    <legend><a href="#">${_('Questions')}</a></legend>
                    <div class="desafio-EPanel" id="desafioEPanel">
                        <div class="desafioToggle d-flex align-items-center mb-3">
                            <div class="m-0">
                                <input class="desafio-Type" checked="checked" id="desafioEDesafio" type="radio" name="dsfDesRet" value="0" />
                                <label id="labelDesafio" for="desafioEDesafio">${_('Challenge')}</label>
                            </div>
                            <div class="m-0">
                                <input class="desafio-Type" id="desafioEReto" type="radio" name="dsfDesRet" value="1" />
                                <label id="labelReto"  for="desafioEReto">${_('Trials')}</label>
                            </div>
                            </div>
                        <div class="desafio-EDAtaGame">
                            <div class="desafio-EDataChallenger">
                                <div class="desafio-DataDesafio mb-3 gap-2">
                                    <label for="desafioEDTitle">${_('Title')}:</label><input type="text" id="desafioEDTitle" class="form-control form-control-sm" />
                                    <label for="desafioEDSolution">${_('Solution')}:</label><input type="text" id="desafioEDSolution" class="form-control form-control-sm" />
                                    <label for="desafioECTitle">${_('Title')}:</label><input type="text" id="desafioECTitle" class="form-control form-control-sm" />
                                    <label for="desafioECSolution">${_('Solution')}:</label><input type="text" id="desafioECSolution" class="form-control form-control-sm" />
                                </div>
                                <div id="desafioSelects" class="align-items-center gap-2 flex-nowrap justify-flex-start mb-3">
                                    <label id="desafiolblEDType" for="desafioEDType">${_('Type')}: </label>
                                    <select id="desafioEDType" class="form-select form-select-sm">
                                        <option value="0" selected>Lineal</option>
                                        <option value="1">Libre</option>
                                    </select>
                                    <label id="desafiolblEDTime" for="desafioEDTime">${_('Max time')}: </label>
                                    <select id="desafioEDTime" class="form-select form-select-sm">
                                        <option value="1">1m</option>
                                        <option value="10">10m</option>
                                        <option value="15">15m</option>
                                        <option value="20">20m</option>
                                        <option value="25">25m</option>
                                        <option value="30">30m</option>
                                        <option value="35">35m</option>
                                        <option value="40" selected>40m</option>
                                        <option value="45">45m</option>
                                        <option value="50">50m</option>
                                        <option value="55">55m</option>
                                        <option value="60">60m</option>
                                        <option value="70">70m</option>
                                        <option value="80">80m</option>
                                        <option value="90">90m</option>
                                        <option value="120">120m</option>
                                        <option value="150">150m</option>
                                        <option value="180">180m</option>
                                        <option value="210">210m</option>
                                        <option value="240">240m</option>
                                    </select>
                                </div>
                            </div>
                            <div class="desafio-EInputMedias">
                                <span>${_('Description')}:</span>
                                <div id="divDesafioEDescription">
                                    <label for="desafioEDescription" class="sr-av">${_('Instructions')}:</label>
                                    <textarea id="desafioEDescription" class="exe-html-editor"></textarea>
                                </div>
                                <div id="desafioEChallenges" class="mb-3">
                                    ${this.getDivChallenges(10)}
                                </div>
                                <div class="desafio-EClues" id="desafioEClues">
                                    ${this.getDivClues()}
                                </div>
                            </div>
                        </div>
                        <div class="desafio-ENavigationButtons gap-2" id="desafioENavigationButtons">
                            <a href="#" id="desafioEAdd" class="desafio-ENavigationButton" title="${_('Add question')}"><img src="${path}quextIEAdd.png" alt="${_('Add question')}" class="desafio-EButtonImage b-add" /></a>
                            <a href="#" id="desafioEFirst" class="desafio-ENavigationButton" title="${_('First question')}"><img src="${path}quextIEFirst.png" alt="${_('First question')}" class="desafio-EButtonImage b-first" /></a>
                            <a href="#" id="desafioEPrevious" class="desafio-ENavigationButton" title="${_('Previous question')}"><img src="${path}quextIEPrev.png" alt="${_('Previous question')}" class="desafio-EButtonImage b-prev" /></a>
                            <span class="sr-av">${_('Question number:')}</span><span class="desafio-NumberQuestion" id="desafioENumberChallenge">1</span>
                            <a href="#" id="desafioENext" class="desafio-ENavigationButton" title="${_('Next question')}"><img src="${path}quextIENext.png" alt="${_('Next question')}" class="desafio-EButtonImage b-next" /></a>
                            <a href="#" id="desafioELast" class="desafio-ENavigationButton" title="${_('Last question')}"><img src="${path}quextIELast.png" alt="${_('Last question')}" class="desafio-EButtonImage b-last" /></a>
                            <a href="#" id="desafioEDelete" class="desafio-ENavigationButton" title="${_('Delete question')}"><img src="${path}quextIEDelete.png" alt="${_('Delete question')}" class="desafio-EButtonImage b-delete" /></a>
                            <a href="#" id="desafioECopy" class="desafio-ENavigationButton" title="${_('Copy question')}"><img src="${path}quextIECopy.png" alt="${_('Copy question')}" class="desafio-EButtonImage b-copy" /></a>
                            <a href="#" id="desafioECut" class="desafio-ENavigationButton" title="${_('Cut question')}"><img src="${path}quextIECut.png" alt="${_('Cut question')}" class="desafio-EButtonImage b-cut" /></a>
                            <a href="#" id="desafioEPaste" class="desafio-ENavigationButton" title="${_('Paste question')}"><img src="${path}quextIEPaste.png" alt="${_('Paste question')}" class="desafio-EButtonImage b-paste" /></a>
                        </div>
                        <div class="desafio-ENumQuestionDiv" id="desafioENumQuestionDiv">
                            <div class="desafio-ENumQ"><span class="sr-av">${_('Number of questions:')}</span></div>
                            <span class="desafio-ENumQuestions" id="desafioENumChallenges">0</span>
                        </div>
                    </div>
                </fieldset>
            </div>
            ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
            ${$exeDevicesEdition.iDevice.gamification.scorm.getTab()}
        </div>
    `;
        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('desafioIdeviceForm');

        $exeDevicesEdition.iDevice.gamification.scorm.init();

        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
        $exeDevice.showDesafio();
    },
    addEvents: function () {
        if ($exeDevice.challengesGame.length == 0) {
            $exeDevice.active = 0;
            $exeDevice.challengesGame.push($exeDevice.getChallengeDefault());
        }

        $('#desafioENavigationButtons').hide();
        $('#desafioEPaste').hide();
        $('#desafioENumQuestionDiv').hide();

        // Toggle switches: sync aria-checked and optional target visibility
        $('#desafioIdeviceForm').on('change', '.toggle-input', function () {
            const $toggle = $(this).closest('.toggle-item');
            const checked = $(this).is(':checked');
            $toggle.attr('aria-checked', checked ? 'true' : 'false');
            const target = $toggle.data('target');
            if (target) {
                $('#' + target).toggle(checked);
            }
        });
        // Initialize toggle states
        const initToggle = function (inputSelector) {
            const $input = $(inputSelector);
            const $toggle = $input.closest('.toggle-item');
            const checked = $input.is(':checked');
            $toggle.attr('aria-checked', checked ? 'true' : 'false');
            const target = $toggle.data('target');
            if (target) {
                $('#' + target).toggle(checked);
            }
        };
        initToggle('#desafioEShowMinimize');
        initToggle('#desafioEEvaluation');

        $('#desafioEUseLives').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#desafioENumberLives').prop('disabled', !marcado);
        });

        $('#desafioShowSolutions').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#desafioTimeShowSolutions').prop('disabled', !marcado);
        });

        $('#desafioShowCodeAccess').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#desafioCodeAccess').prop('disabled', !marcado);
            $('#desafioMessageCodeAccess').prop('disabled', !marcado);
        });

        $('#desafioEAdd').on('click', function (e) {
            e.preventDefault();
            $exeDevice.addChallenge();
        });

        $('#desafioEFirst').on('click', function (e) {
            e.preventDefault();
            $exeDevice.firstChallenge();
        });

        $('#desafioEPrevious').on('click', function (e) {
            e.preventDefault();
            $exeDevice.previousChallenge();
        });

        $('#desafioENext').on('click', function (e) {
            e.preventDefault();
            $exeDevice.nextChallenge();
        });

        $('#desafioELast').on('click', function (e) {
            e.preventDefault();
            $exeDevice.lastChallenge();
        });

        $('#desafioEDelete').on('click', function (e) {
            e.preventDefault();
            $exeDevice.removeChallenge();
        });

        $('#desafioECopy').on('click', function (e) {
            e.preventDefault();
            $exeDevice.copyChallenge();
        });

        $('#desafioECut').on('click', function (e) {
            e.preventDefault();
            $exeDevice.cutChallenge();
        });

        $('#desafioEPaste').on('click', function (e) {
            e.preventDefault();
            $exeDevice.pasteChallenge();
        });

        $('#desafioEDesafio').on('click', function () {
            if ($exeDevice.typeActive != 0) {
                $exeDevice.typeActive = 0;
                $exeDevice.saveChallenge();
                $exeDevice.showDesafio();
                $exeDevice.showClues(false);
            }
        });

        $('#desafioEReto').on('click', function () {
            if ($exeDevice.typeActive != 1) {
                $exeDevice.typeActive = 1;
                $exeDevice.saveDesafio();
                $exeDevice.showChallenge($exeDevice.active);
                $exeDevice.showClues(true);
            }
        });

        $('#desafioEEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#desafioEEvaluationID').prop('disabled', !marcado);
        });

        $('#desafioEEvaluationHelpLnk').on('click', function () {
            $('#desafioEEvaluationHelp').toggle();
            return false;
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
                    $exeDevice.importGame(e.target.result);
                };
                reader.readAsText(file);
            });
            $('#eXeGameExportGame').on('click', function () {
                $exeDevice.exportGame();
            });
        } else {
            $('#eXeGameExportImport').hide();
        }
    },

    getDivChallenges: function (num) {
        let chs = '';
        for (let j = 0; j < num; j++) {
            const ch = `
            <div class="desafio-EDivFeebBack" id="desafioEDivFeebBack-${j}">
                <label for="desafioEChallenge-${j}" class="sr-av">${_('Feedback')}</label>
                <textarea id="desafioEChallenge-${j}" class="exe-html-editor desafio-EFeedBack"></textarea>
            </div>
        `;
            chs += ch;
        }

        return chs;
    },

    getDivClues: function () {
        const chs = ` <div class="desafio-EClue gap-2 mb-3">
            <label for="desafioEClue1">${_('Help')} 1:</label><input type="text" id="desafioEClue1" class="form-control form-control-sm" />
            <label id="desafiolblECTime1" for="desafioECTime1" class="sr-av">${_('Time')}:</label>
            <select id="desafioECTime1" class="form-select form-select-sm">
                <option value="1">1m</option>
                <option value="3">3m</option>
                <option value="5" selected>5m</option>
                <option value="10">10m</option>
                <option value="15">15m</option>
                <option value="20" >20m</option>
                <option value="25">25m</option>
                <option value="30">30m</option>
                <option value="35">35m</option>
                <option value="40">40m</option>
                <option value="45">45m</option>
                <option value="50">50m</option>
                <option value="55">55m</option>
                <option value="60">60m</option>
                <option value="65">65m</option>
                <option value="70">70m</option>
                <option value="75">75m</option>
                <option value="80">80m</option>
                <option value="85">85m</option>
                <option value="90">90m</option>
                <option value="95">95m</option>
                <option value="100">100m</option>
                <option value="110">110m</option>
                <option value="120">120m</option>
                <option value="150">150m</option>
                <option value="180">180m</option>
                <option value="210">210m</option>
                <option value="240">240m</option>
            </select>
        </div>
        <div class="desafio-EClue gap-2 mb-3">
            <label for="desafioEClue2">${_('Help')} 2:</label><input type="text" id="desafioEClue2" class="form-control form-control-sm" />
            <label id="desafiolblECTime2" for="desafioECTime2" class="sr-av">${_('Time')}:</label>
            <select id="desafioECTime2" class="form-select form-select-sm">
                <option value="1">1m</option>
                <option value="3">3m</option>
                <option value="5">5m</option>
                <option value="10" selected>10m</option>
                <option value="15">15m</option>
                <option value="20">20m</option>
                <option value="25">25m</option>
                <option value="30">30m</option>
                <option value="35">35m</option>
                <option value="40">40m</option>
                <option value="45">45m</option>
                <option value="50">50m</option>
                <option value="55">55m</option>
                <option value="60">60m</option>
                <option value="65">65m</option>
                <option value="70">70m</option>
                <option value="75">75m</option>
                <option value="80">80m</option>
                <option value="85">85m</option>
                <option value="90">90m</option>
                <option value="95">95m</option>
                <option value="100">100m</option>
                <option value="110">110m</option>
                <option value="120">120m</option>
                <option value="150">150m</option>
                <option value="180">180m</option>
                <option value="210">210m</option>
                <option value="240">240m</option>
            </select>
        </div>
        <p class="desafio-EClue gap-2">
            <label for="desafioEClue3">${_('Help')} 3:</label><input type="text" id="desafioEClue3" class="form-control form-control-sm" />
            <label id="desafiolblECTime3" for="desafioECTime3" class="sr-av">${_('Time')}:</label>
            <select id="desafioECTime3" class="form-select form-select-sm">
               <option value="3">3m</option>
                <option value="5" selected>5m</option>
                <option value="10">10m</option>
                <option value="15">15m</option>
                <option value="20" >20m</option>
                <option value="25">25m</option>
                <option value="30">30m</option>
                <option value="35">35m</option>
                <option value="40">40m</option>
                <option value="45">45m</option>
                <option value="50">50m</option>
                <option value="55">55m</option>
                <option value="60">60m</option>
                <option value="65">65m</option>
                <option value="70">70m</option>
                <option value="75">75m</option>
                <option value="80">80m</option>
                <option value="85">85m</option>
                <option value="90">90m</option>
                <option value="95">95m</option>
                <option value="100">100m</option>
                <option value="110">110m</option>
                <option value="120">120m</option>
                <option value="150">150m</option>
                <option value="180">180m</option>
                <option value="210">210m</option>
                <option value="240">240m</option>
            </select>
        </p>`;
        return chs;
    },

    getChallengeDefault: function () {
        return {
            title: '',
            solution: '',
            description: '',
        };
    },

    loadPreviousValues: function () {
        let originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            $exeDevice.active = 0;
            const wrapper = $('<div></div>');
            wrapper.html(originalHTML);

            let json = $('.desafio-DataGame', wrapper).text(),
                version = $('.desafio-version', wrapper).text();

            if (version.length === 1 || !json.startsWith('{')) {
                json = $exeDevices.iDevice.gamification.helpers.decrypt(json);
            }

            const dataGame =
                $exeDevices.iDevice.gamification.helpers.isJsonString(json);
            $exeDevice.desafioTitle = dataGame.desafioTitle;
            $exeDevice.active = 0;
            $exeDevice.desafioSolution = dataGame.desafioSolution;
            $exeDevice.desafioType = dataGame.desafioType;
            $exeDevice.desafioTime = dataGame.desafioTime;
            $exeDevice.desafioDescription = '';

            let description = $('.desafio-EDescription', wrapper);
            if (description.length === 1) {
                description = description.html() || '';
                $('#desafioEDescription').val(description);
                $exeDevice.desafioDescription = description;
            }

            $('.desafio-ChallengeDescription', wrapper).each(function (i) {
                dataGame.challengesGame[i].description = $(this).html();
                $(`#desafioEChallenge-${i}`).val($(this).html());
            });

            $exeDevice.challengesGame = dataGame.challengesGame;

            const c = $exeDevice.challengesGame[0];
            $('#desafioECTitle').val(c.title);
            $('#desafioECSolution').val(c.solution);

            if (typeof c.clues !== 'undefined') {
                $('#desafioEClue1').val(c.clues[0].clue);
                $('#desafioEClue2').val(c.clues[1].clue);
                $('#desafioEClue3').val(c.clues[2].clue);
                $('#desafioECTime1').val(c.clues[0].time);
                $('#desafioECTime2').val(c.clues[1].time);
                $('#desafioECTime3').val(c.clues[2].time);
            }

            const instructions = $('.desafio-instructions', wrapper);
            if (instructions.length === 1) {
                $('#eXeGameInstructions').val(instructions.html());
            }

            $exeDevicesEdition.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs
            );
            $exeDevice.updateFieldGame(dataGame);
        }
    },

    updateFieldGame: function (game) {
        $exeDevice.desafioID =
            typeof game.desafioID === 'undefined'
                ? $exeDevice.desafioID
                : game.desafioID;
        game.evaluation =
            typeof game.evaluation !== 'undefined' ? game.evaluation : false;
        game.evaluationID =
            typeof game.evaluationID !== 'undefined' ? game.evaluationID : '';
        game.weighted =
            typeof game.weighted !== 'undefined' ? game.weighted : 100;
        $exeDevice.id = $exeDevice.getIdeviceID();

        $('#desafioEShowMinimize').prop('checked', game.showMinimize);
        $('#desafioEEvaluation').prop('checked', game.evaluation);
        $('#desafioEEvaluationID').val(game.evaluationID);
        $('#desafioEEvaluationID').prop('disabled', !game.evaluation);
        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted
        );
        $exeDevice.showDesafio();
    },

    escapeHtml: function (string) {
        return String(string)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    save: function () {
        const dataGame = this.validateData();

        if (!dataGame) return false;

        const fields = this.ci18n,
            i18n = fields;
        for (const i in fields) {
            const fVal = $('#ci18n_' + i).val();
            if (fVal !== '') i18n[i] = fVal;
        }

        dataGame.msgs = i18n;
        let json = JSON.stringify(dataGame);

        json = $exeDevices.iDevice.gamification.helpers.encrypt(json);

        const instructions = tinyMCE.get('eXeGameInstructions').getContent(),
            description = tinyMCE.get('desafioEDescription').getContent();
        let divContent = '';
        if (instructions !== '') {
            divContent =
                '<div class="desafio-instructions">' + instructions + '</div>';
        }

        let html = '<div class="desafio-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html += divContent;
        html +=
            '<div class="desafio-version js-hidden">' +
            $exeDevice.desafioVersion +
            '</div>';
        html += '<div class="desafio-EDescription">' + description + '</div>';
        for (let i = 0; i < $exeDevice.challengesGame.length; i++) {
            const df = tinyMCE.get(`desafioEChallenge-${i}`).getContent();
            html +=
                '<div class="desafio-ChallengeDescription">' + df + '</div>';
        }
        html += '<div class="desafio-DataGame js-hidden">' + json + '</div>';

        html +=
            '<div class="desafio-bns js-hidden">' +
            $exeDevice.msgs.msgNoSuportBrowser +
            '</div>';

        html += '</div>';
        return html;
    },

    saveChallenge: function () {
        let message = '';
        const p = {},
            i = $exeDevice.active;

        if (tinyMCE.get(`desafioEChallenge-${i}`)) {
            p.description = tinyMCE.get(`desafioEChallenge-${i}`).getContent();
        } else {
            p.description = $(`desafioEChallenge-${i}`).val();
        }

        p.title = $('#desafioECTitle').val();
        p.solution = $('#desafioECSolution').val();
        p.timeShow = -1;

        const clues = [
            {
                clue: $('#desafioEClue1').val(),
                time: parseInt($('#desafioECTime1 option:selected').val(), 10),
            },
            {
                clue: $('#desafioEClue2').val(),
                time: parseInt($('#desafioECTime2 option:selected').val(), 10),
            },
            {
                clue: $('#desafioEClue3').val(),
                time: parseInt($('#desafioECTime3 option:selected').val(), 10),
            },
        ];
        p.clues = clues;
        $exeDevice.challengesGame[i] = p;
        return message;
    },

    saveDesafio: function () {
        $exeDevice.desafioTitle = $('#desafioEDTitle').val();
        $exeDevice.desafioSolution = $('#desafioEDSolution').val();
        $exeDevice.desafioType = parseInt(
            $('#desafioEDType option:selected').val()
        );
        $exeDevice.desafioTime = parseInt(
            $('#desafioEDTime option:selected').val()
        );
        $exeDevice.desafioDescription = '';

        if (tinyMCE.get('desafioEDescription')) {
            $exeDevice.desafioDescription = tinyMCE
                .get('desafioEDescription')
                .getContent();
        } else {
            $exeDevice.desafioDescription = $('#desafioEDescription').val();
        }
    },

    exportGame: function () {
        const dataGame = this.validateData();
        if (!dataGame) {
            return false;
        }

        const blob = JSON.stringify(dataGame),
            newBlob = new Blob([blob], { type: 'text/plain' });
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveOrOpenBlob(newBlob);
            return;
        }

        const data = window.URL.createObjectURL(newBlob),
            link = document.createElement('a');

        link.href = data;
        link.download = `${_('Game')}desafio.json`;
        document.getElementById('desafioIdeviceForm').appendChild(link);
        link.click();

        setTimeout(() => {
            document.getElementById('desafioIdeviceForm').removeChild(link);
            window.URL.revokeObjectURL(data);
        }, 100);
    },

    importGame: function (content) {
        const game =
            $exeDevices.iDevice.gamification.helpers.isJsonString(content);

        if (!game || typeof game.typeGame === 'undefined') {
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
            return;
        } else if (game.typeGame !== 'desafio') {
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
            return;
        }

        game.id = $exeDevice.getIdeviceID();
        $exeDevice.active = 0;
        $exeDevice.desafioTitle = game.desafioTitle;
        $exeDevice.desafioSolution = game.desafioSolution;
        $exeDevice.desafioDescription = game.desafioDescription;
        $exeDevice.desafioType = game.desafioType;
        $exeDevice.desafioTime = game.desafioTime;

        $exeDevice.challengesGame = game.challengesGame;
        $exeDevice.updateFieldGame(game);
        const instructions = game.instructionsExe || game.instructions;
        tinymce.editors[0].setContent(instructions);
        //$('.exe-form-tabs li:first-child a').click();
    },

    getIdeviceID: function () {
        const ideviceid =
            $('#desafioIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';

        return ideviceid;
    },

    validateData: function () {
        $exeDevice.saveDesafio();
        $exeDevice.saveChallenge();

        const instructions = $('#eXeGameInstructions').text(),
            instructionsExe = tinyMCE.get('eXeGameInstructions').getContent(),
            showMinimize = $('#desafioEShowMinimize').is(':checked'),
            evaluation = $('#desafioEEvaluation').is(':checked'),
            evaluationID = $('#desafioEEvaluationID').val(),
            id = $exeDevice.getIdeviceID();

        if ($exeDevice.desafioTitle.length === 0) {
            $exeDevice.showMessage($exeDevice.msgs.msgTitleDesafio);
            return false;
        } else if ($exeDevice.desafioSolution.length === 0) {
            $exeDevice.showMessage($exeDevice.msgs.msgSolutionDesafio);
            return false;
        } else if ($exeDevice.desafioDescription.length === 0) {
            $exeDevice.showMessage($exeDevice.msgs.msgDescriptionDesafio);
            return false;
        }

        if (evaluation && evaluationID.length < 5) {
            eXe.app.alert($exeDevice.msgs.msgIDLenght);
            return false;
        }

        const challengesGame = $exeDevice.challengesGame;
        for (let i = 0; i < challengesGame.length; i++) {
            const mChallenge = challengesGame[i];
            if (
                mChallenge.title.length === 0 ||
                mChallenge.solution.length === 0 ||
                mChallenge.description.length === 0
            ) {
                $exeDevice.showMessage($exeDevice.msgs.msgDataChanllenge);
                return false;
            }
        }

        const scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();

        return {
            asignatura: '',
            author: '',
            typeGame: 'desafio',
            desafioTitle: $exeDevice.desafioTitle,
            desafioTime: $exeDevice.desafioTime,
            desafioType: $exeDevice.desafioType,
            desafioSolution: $exeDevice.desafioSolution,
            desafioSolved: false,
            desafioDescription: $exeDevice.desafioDescription,
            instructionsExe: instructionsExe,
            instructions: instructions,
            showMinimize: showMinimize,
            challengesGame: challengesGame,
            title: '',
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted || 100,
            desafioID: $exeDevice.desafioID,
            evaluation: evaluation,
            evaluationID: evaluationID,
            id: id,
        };
    },
    showClues: function (show) {
        if (show) {
            $('#desafioEClues').show();
        } else {
            $('#desafioEClues').hide();
        }
    },

    showDesafio: function () {
        const hide = (sel) => $(sel).addClass('js-hidden');
        const show = (sel) => $(sel).removeClass('js-hidden');

        show('label[for="desafioEDSolution"], #desafioEDSolution');
        show('label[for="desafioEDTitle"], #desafioEDTitle');
        hide('label[for="desafioECTitle"], #desafioECTitle');
        hide('label[for="desafioECSolution"], #desafioECSolution');

        $exeDevice.typeActive = 0;
        $('#desafioSelects').css('display', 'flex');
        $('#desafioENavigationButtons').hide();
        $('#desafioENumQuestionDiv').hide();
        $('#desafioEDTitle').val($exeDevice.desafioTitle);
        $('#desafioEDSolution').val($exeDevice.desafioSolution);
        $('#desafioEDTime').val($exeDevice.desafioTime);
        $('#desafioEDType').val($exeDevice.desafioType);
        $('#divDesafioEDescription').show();
        $('#desafioEChallenges').hide();
    },
};
