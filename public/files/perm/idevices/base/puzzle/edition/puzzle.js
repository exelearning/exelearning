/* eslint-disable no-undef */
/**
 * Puzzle iDevice (edition code)
 * Version: 1.0
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narvaez Martinez
 * Graphic design: Ana María Zamora Moreno,
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    i18n: {
        name: _('Puzzle'),
    },
    msgs: {},
    classIdevice: 'puzzle',
    active: 0,
    activeCard: 0,
    activeID: '',
    puzzlesGame: [],
    puzzle: {},
    typeEdit: -1,
    typeEditC: -1,
    idPaste: '',
    numberCutCuestion: -1,
    clipBoard: '',
    playerAudio: '',
    version: 1,
    id: false,
    idevicePath: '',
    accesibilityIsOk: true,
    ci18n: {},

    checkAltImage: true,
    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.refreshTranslations();
        this.ci18n.msgTryAgain = this.ci18n.msgTryAgain.replace(
            '&percnt;',
            '%'
        );

        this.setMessagesInfo();
        this.createForm();
    },

    refreshTranslations: function () {
        this.ci18n = {
            msgSubmit: c_('Submit'),
            msgClue: c_('Cool! The clue is:'),
            msgCodeAccess: c_('Access code'),
            msgPlayAgain: c_('Play Again'),
            msgPlayStart: c_('Click here to play'),
            msgErrors: c_('Errors'),
            msgHits: c_('Hits'),
            msgScore: c_('Score'),
            msgWeight: c_('Weight'),
            msgMinimize: c_('Minimize'),
            msgMaximize: c_('Maximize'),
            msgFullScreen: c_('Full Screen'),
            msgExitFullScreen: c_('Exit Full Screen'),
            msgNumQuestions: c_('Number of questions'),
            msgNoImage: c_('No picture question'),
            msgCool: c_('Cool!'),
            msgSuccesses: c_(
                'Right! | Excellent! | Great! | Very good! | Perfect!'
            ),
            msgFailures: c_(
                'It was not that! | Incorrect! | Not correct! | Sorry! | Error!'
            ),
            msgTryAgain: c_(
                'You need at least %s&percnt; of correct answers to get the information. Please try again.'
            ),
            msgEndGameScore: c_(
                'Please start the game before saving your score.'
            ),
            msgScoreScorm: c_(
                "The score can't be saved because this page is not part of a SCORM package."
            ),
            msgOnlySaveScore: c_('You can only save the score once!'),
            msgOnlySave: c_('You can only save once'),
            msgInformation: c_('Information'),
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
            msgClose: c_('Close'),
            msgAudio: c_('Audio'),
            msgTimeOver: c_('Time is up'),
            mgsAllPuzzles: c_('You completed all the activities!'),
            msgNumbersAttemps: c_('Number of activities to be completed'),
            msgActivities: c_('Activities'),
            msgContinue: c_('Continue'),
            msgAgain: c_('Please try again'),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgShowImage: c_('Show/Hide image'),
            msgShowNumbers: c_('Show/Hide numbers'),
            msgAttempsNumbers: c_('Number of attempts'),
            msgTimePuzzle: c_('Time spent'),
            msgsCompletedPuzzle: c_('Puzzle completed'),
            msgsNext: c_('Next'),
            msgsRepeat: c_('Repeat'),
            msgsTerminate: c_('Finish'),
            msgTypeGame: c_('Puzzle'),
        };
    },

    setMessagesInfo: function () {
        const msgs = this.msgs;
        msgs.msgESelectFile = _(
            'The selected file does not contain a valid game'
        );
        msgs.msgEURLValid = _(
            'You must upload or indicate the valid URL of an image'
        );
        msgs.msgEOneQuestion = _('Please provide at least one question');
        msgs.msgTypeChoose = _(
            'Please check all the answers in the right order'
        );
        msgs.msgTimeFormat = _('Please check the time format: hh:mm:ss');
        msgs.msgProvideFB = _('Message to display when passing the game');
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.'
        );
        msgs.msgIDLenght = _(
            'The report identifier must have at least 5 characters'
        );
        msgs.msgTitleAltImageWarning = _('Accessibility warning');
        msgs.msgAltImageWarning = _(
            'Are you sure you want to continue without including an image description? Without it the image may not be accessible to some users with disabilities, or to those using a text browser, or browsing the Web with images turned off.'
        );
        msgs.msgRowsNumber = _(
            'You must specify a number of rows and columns between three and five'
        );
        msgs.msgSelectPuzzleImage = _('You must select the puzzle image');
        msgs.msgSelectImage = _('Select an image');
    },

    createForm: function () {
        const path = $exeDevice.idevicePath,
            html = `
            <div id="puzzleIdeviceForm">
                <p class="exe-block-info exe-block-dismissible" style="position:relative;">
                    ${_('Create interactive activities where players must solve various puzzles.')}
                    <a style="display:none" href="https://www.youtube.com/watch?v=th78R1PAiJQ" hreflang="en" target="_blank">${_('Usage Instructions')}</a>
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Solve the following puzzles.'))}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_('Options')}</a></legend>
                        <div>
                            <div class="mb-3">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="puzzleERandomPuzzles" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="puzzleERandomPuzzles">${_('Random puzzles.')}</label>
                                </span>
                            </div>
                            <div class="mb-3">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="puzzleEShowMinimize" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="puzzleEShowMinimize">${_('Show minimized.')}</label>
                                </span>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-wrap mb-3">
                                <label for="puzzleEPercentajeQuestions">${_('% Activities')}:</label>
                                <input type="number" name="puzzleEPercentajeQuestions" id="puzzleEPercentajeQuestions" value="100" min="1" max="100" class="form-control" style="width:6ch" />
                                <span id="puzzleENumeroPercentaje">1/1</span>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-wrap mb-3">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="puzzleEHasFeedBack" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="puzzleEHasFeedBack">${_('Feedback')}.</label>
                                </span>
                                <label for="puzzleEPercentajeFB" class="sr-av">${_('Percent')}</label>
                                <input type="number" name="puzzleEPercentajeFB" id="puzzleEPercentajeFB" value="100" min="5" max="100" step="5" disabled class="form-control" style="width:6ch" />
                            </div>
                            <div id="puzzleEFeedbackP" class="PZLE-EFeedbackP mb-3">
                                <textarea id="puzzleEFeedBackEditor" class="exe-html-editor form-control" rows="4"></textarea>
                            </div>
                            <div class="d-none align-items-center gap-2 flex-wrap mb-3">
                                <label for="puzzleEAuthor">${_('Authorship')}:</label>
                                <input id="puzzleEAuthor" type="text" class="form-control" />
                            </div>
                            <div class="Games-Reportdiv d-flex align-items-center gap-2 flex-wrap mb-3">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="puzzleEEvaluation" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="puzzleEEvaluation">${_('Progress report')}.</label>
                                </span>
                                <label for="puzzleEEvaluationID">${_('Identifier')}:</label>
                                <input type="text" id="puzzleEEvaluationID" disabled value="${eXeLearning.app.project.odeId || ''}" class="form-control" style="max-width:16ch" />
                                <strong class="GameModeLabel"><a href="#puzzleEEvaluationHelp" id="puzzleEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}"><img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}"/></a></strong>

                            </div>
                            <p id="puzzleEEvaluationHelp" class="PZLE-TypeGameHelp exe-block-info">
                                ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                            </p>
                        </div>
                    </fieldset>
                    <fieldset class="exe-fieldset">
                        <legend><a href="#">${_('Puzzles')}</a></legend>
                        <div class="PZLE-EPanel" id="puzzleEPanel">
                            <div class=" d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <span>${_('Type')}:</span>
                                <div class="form-check form-check-inline m-0">
                                    <input class="PZLP-Type form-check-input" checked id="puzzleESliding" type="radio" name="pzltype" value="0" />
                                    <label class="form-check-label" for="puzzleESliding">${_('Slide')}</label>
                                </div>
                                <div class="form-check form-check-inline m-0">
                                    <input class="PZLP-Type form-check-input" id="puzzleEChange" type="radio" name="pzltype" value="1" />
                                    <label class="form-check-label" for="puzzleEChange">${_('Swap')}</label>
                                </div>
                            </div>
                            <div class="mb-3 d-flex align-items-center flex-nowrap gap-2">
                                <span class="d-flex align-items-center flex-nowrap gap-2">
                                     <label for="puzzleERows">${_('Rows')}:</label>
                                    <select id="puzzleERows" class="form-select form-select-sm" style="min-width:8ch">
                                        <option>2</option>
                                        <option selected>3</option>
                                        <option>4</option>
                                        <option>5</option>
                                        <option>6</option>
                                        <option>7</option>
                                    </select>  
                                </span>
                                <span class="d-flex align-items-center flex-nowrap gap-2">
                                    <label for="puzzleEColumns">${_('Columns')}:</label>
                                    <select id="puzzleEColumns" class="form-select form-select-sm" style="min-width:8ch">
                                        <option>2</option>
                                        <option selected>3</option>
                                        <option>4</option>
                                        <option>5</option>
                                        <option>6</option>
                                        <option>7</option>
                                    </select> 
                                </span>  
                            </div>
                            <div class="mb-3 d-flex flex-nowrap gap-2">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="puzzleEShowImage" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="puzzleEShowImage">${_('Show image')}</label>
                                </span>
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="puzzleEShowNumber" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="puzzleEShowNumber">${_('Show numbers')}</label>
                                </span>
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="puzzleEShowTime" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="puzzleEShowTime">${_('Show time')}</label>
                                </span>
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="puzzleEShowAttemps" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="puzzleEShowAttemps">${_('Show attempt')}</label>
                                </span>
                            </div>
                            <div>
                                <div class="d-flex align-items-center flex-nowrap gap-2 mb-3">
                                    <label>${_('Image')}:</label>
                                    <input type="text" id="puzzleEURLImageDefinition" class="exe-file-picker form-control me-0" />
                                    <a href="#" id="puzzleEPlayImageDefinition" class="PZLE-ENavigationButton PZLE-EPlayVideo" title="${_('Image')}"><img src="${path}quextIEPlay.png" alt="Play audio" class="PZLE-EButtonImage " /></a>
                                    <a href="#" id="puzzleEShowMoreDefinition" class="PZLE-ENavigationButton PZLE-EShowMore" title="${_('More')}"><img src="${path}quextEIMore.png" alt="${_('More')}" class="PZLE-EButtonImage " /></a>
                                </div>
                                <div  id="puzzleEDefinitionAltAuthor" class="d-none">
                                    <div class="d-flex align-items-center flex-nowrap gap-2 mb-3">                                        
                                        <label>${_('Authorship')}:</label>
                                        <input id="puzzleEAuthorDefinition" type="text" class="form-control" />
                                        <label>${_('Alternative text')}:</label>
                                        <input id="puzzleEAltDefinition" type="text" class="form-control" />
                                    </div>
                                </div>
                            </div>
                            <div id="puzzleEImageDefinitionDiv" class="mb-3">
                                <p class="PZLE-EImageDefinition">
                                    <img class="PZLE-EImageEnu" id="puzzleEImageDefinition" src="${path}quextIEImagen.png" alt="${_('No image')}" />
                                </p>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3" id="puzzleEDefinitionDiv">
                                <label for="puzzleEDefinition">${_('Statement')}:</label>
                                <input type="text" id="puzzleEDefinition" class="form-control" />
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-nowrap  mb-3">
                                <label for="puzzleEURLAudioDefinition">${_('Audio')}:</label>
                                <input type="text" id="puzzleEURLAudioDefinition" class="exe-file-picker PZLE-EURLAudio form-control me-0" />
                                <a href="#" id="puzzleEPlayAudioDefinition" class="PZLE-ENavigationButton PZLE-EPlayVideo" title="${_('Audio')}"><img src="${path}quextIEPlay.png" alt="Play audio" class="PZLE-EButtonImage " /></a>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-nowrap  mb-3">
                                <label for="puzzleECluePuzzle">${_('Feedback/Solution')}:</label>
                                <input type="text" id="puzzleECluePuzzle" class="PZLE-EURLAudio form-control" />
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <label for="puzzleEURLAudioClue">${_('Audio')}:</label>
                                <input type="text" id="puzzleEURLAudioClue" class="exe-file-picker PZLE-EURLAudio form-control me-0" />
                                <a href="#" id="puzzleEPlayAudioClue" class="PZLE-ENavigationButton PZLE-EPlayVideo" title="${_('Audio')}"><img src="${path}quextIEPlay.png" alt="Play audio" class="PZLE-EButtonImage " /></a>
                            </div>
                            <div class="PZLE-ENavigationButtons gap-2" id="puzzleButtonsPrhaseDiv">
                                <a href="#" id="puzzleEAdd" class="PZLE-ENavigationButton" title="${_('Add an activity')}"><img src="${path}quextIEAdd.png" alt="${_('Add an activity')}" class="PZLE-EButtonImage b-add" /></a>
                                <a href="#" id="puzzleEFirst" class="PZLE-ENavigationButton" title="${_('First activity')}"><img src="${path}quextIEFirst.png" alt="${_('First activity')}" class="PZLE-EButtonImage b-first" /></a>
                                <a href="#" id="puzzleEPrevious" class="PZLE-ENavigationButton" title="${_('Previous activity')}"><img src="${path}quextIEPrev.png" alt="${_('Previous activity')}" class="PZLE-EButtonImage b-prev" /></a>
                                <span class="sr-av">${_('Puzzle number:')}</span><span class="PZLE-ENumberPuzzle" id="puzzleENumberPuzzle">1</span>
                                <a href="#" id="puzzleENext" class="PZLE-ENavigationButton" title="${_('Next activity')}"><img src="${path}quextIENext.png" alt="${_('Next activity')}" class="PZLE-EButtonImage b-next" /></a>
                                <a href="#" id="puzzleELast" class="PZLE-ENavigationButton" title="${_('Last activity')}"><img src="${path}quextIELast.png" alt="${_('Last activity')}" class="PZLE-EButtonImage b-last" /></a>
                                <a href="#" id="puzzleEDelete" class="PZLE-ENavigationButton" title="${_('Delete activity')}"><img src="${path}quextIEDelete.png" alt="${_('Delete activity')}" class="PZLE-EButtonImage b-delete" /></a>
                                <a href="#" id="puzzleECopy" class="PZLE-ENavigationButton" title="${_('Copy activity')}"><img src="${path}quextIECopy.png" alt="${_('Copy activity')}" class="PZLE-EButtonImage b-copy" /></a>
                                <a href="#" id="puzzleECut" class="PZLE-ENavigationButton" title="${_('Cut activity')}"><img src="${path}quextIECut.png" alt="${_('Cut activity')}" class="PZLE-EButtonImage b-copy" /></a>
                                <a href="#" id="puzzleEPaste" class="PZLE-ENavigationButton" title="${_('Paste activity')}"><img src="${path}quextIEPaste.png" alt="${_('Paste activity')}" class="PZLE-EButtonImage b-paste" /></a>
                            </div>
                            <div class="PZLE-ENumPuzzlesDiv" id="puzzleENumPuzzlesDiv">
                                <div class="PZLE-ENumPuzzlesA">
                                    <div class="sr-av">${_('Puzzles')}:</div>
                                    <div class="PZLE-ENumPuzzlesIcon"></div>
                                    <div id="puzzleENumPuzzles">1</div>
                                </div>
                            </div>
                        </div>
                    </fieldset>
                    ${$exeDevicesEdition.iDevice.common.getTextFieldset('after')}
                </div>
                ${$exeDevicesEdition.iDevice.gamification.itinerary.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.scorm.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
            </div>`;

        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('puzzleIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();
        // Inicializar switches accesibles
        $('.toggle-input').each(function () {
            const $i = $(this),
                $item = $i.closest('.toggle-item');
            $item.attr('aria-checked', $i.is(':checked'));
            $i.on('change.puzzleToggle', function () {
                $item.attr('aria-checked', $i.is(':checked'));
            });
        });
        this.enableForm();
    },
    enableForm: function () {
        $exeDevice.initPuzzles();

        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
    },

    updateQuestionsNumber: function () {
        const percentInput = parseInt(
            $exeDevice.removeTags($('#puzzleEPercentajeQuestions').val())
        );

        if (isNaN(percentInput)) return;

        const percentaje = Math.min(Math.max(percentInput, 1), 100),
            totalPuzzles = $exeDevice.puzzlesGame.length,
            num = Math.max(1, Math.round((percentaje * totalPuzzles) / 100));

        $('#puzzleENumeroPercentaje').text(`${num}/${totalPuzzles}`);
    },

    showPuzzle: function (i) {
        const num = Math.min(Math.max(i, 0), $exeDevice.puzzlesGame.length - 1),
            puzzle = $exeDevice.puzzlesGame[num];

        $exeDevice.clearPuzzle();

        $("input.PZLP-Type[name='pzltype'][value='" + puzzle.type + "']").prop(
            'checked',
            true
        );
        $('#puzzleEShowImage').prop('checked', puzzle.showImage);
        $('#puzzleEShowNumber').prop('checked', puzzle.showNumber);
        $('#puzzleEShowTime').prop('checked', puzzle.showTime);
        $('#puzzleEShowAttemps').prop('checked', puzzle.showAttemps);
        $('#puzzleERows').val(puzzle.rows);
        $('#puzzleEColumns').val(puzzle.columns);
        $('#puzzleEURLImageDefinition').val(puzzle.url);
        $('#puzzleEAltDefinition').val(puzzle.alt);
        $('#puzzleEAuthorDefinition').val(puzzle.author);
        $('#puzzleEImageDefinition').attr('src', puzzle.url);
        $('#puzzleEDefinition').val(puzzle.definition);
        $('#puzzleENumberPuzzle').text($exeDevice.active + 1);
        $('#puzzleEURLAudioDefinition').val(puzzle.audioDefinition);
        $('#puzzleEURLAudioClue').val(puzzle.audioClue);
        $('#puzzleECluePuzzle').val(puzzle.clue);

        $exeDevice.stopSound();
    },
    initPuzzles: function () {
        $exeDevice.active = 0;
        $exeDevice.puzzlesGame.push($exeDevice.getPuzzleDefault());
    },

    validatePuzzle: function () {
        if ($('#puzzleEURLImageDefinition').val().length < 3) {
            $exeDevice.showMessage($exeDevice.msgs.msgSelectPuzzleImage);
            return false;
        }

        let puzzle = $exeDevice.getPuzzleDefault();

        puzzle.url = $('#puzzleEURLImageDefinition').val();

        if (puzzle.url.length < 3) {
            $exeDevice.showMessage($exeDevice.msgs.msgSelectImage);
            return false;
        }

        puzzle.rows = parseInt($('#puzzleERows').val());
        puzzle.columns = parseInt($('#puzzleEColumns').val());

        const pcc =
            Number.isInteger(puzzle.rows) &&
            puzzle.rows >= 2 &&
            puzzle.rows <= 6 &&
            Number.isInteger(puzzle.columns) &&
            puzzle.columns >= 2 &&
            puzzle.columns <= 6;
        if (!pcc) {
            $exeDevice.showMessage($exeDevice.msgs.rowsNumber);
            return false;
        }

        puzzle.showImage = $('#puzzleEShowImage').is(':checked');
        puzzle.showNumber = $('#puzzleEShowNumber').is(':checked');
        puzzle.showTime = $('#puzzleEShowTime').is(':checked');
        puzzle.showAttemps = $('#puzzleEShowAttemps').is(':checked');
        puzzle.alt = $('#puzzleEAltDefinition').val();
        puzzle.author = $('#puzzleEAuthorDefinition').val();
        puzzle.msgHit = $('#puzzleEMessageOK').val();
        puzzle.msgError = $('#puzzleEMessageKO').val();
        puzzle.definition = $('#puzzleEDefinition').val();
        puzzle.audioDefinition = $('#puzzleEURLAudioDefinition').val();
        puzzle.audioClue = $('#puzzleEURLAudioClue').val();
        puzzle.audioError = $('#puzzleEURLAudioKO').val();
        puzzle.clue = $('#puzzleECluePuzzle').val();
        puzzle.type = parseInt($('input[name=pzltype]:checked').val());
        $exeDevice.puzzlesGame[$exeDevice.active] = puzzle;

        return true;
    },

    hexToRgba: function (hex, opacity) {
        return (
            'rgba(' +
            (hex = hex.replace('#', ''))
                .match(new RegExp('(.{' + hex.length / 3 + '})', 'g'))
                .map(function (l) {
                    return parseInt(hex.length % 2 ? l + l : l, 16);
                })
                .concat(isFinite(opacity) ? opacity : 1)
                .join(',') +
            ')'
        );
    },

    getPuzzleDefault: function () {
        return {
            type: 0,
            rows: 3,
            columns: 3,
            showImage: false,
            showNumber: false,
            msgError: '',
            msgHit: '',
            definition: '',
            audioDefinition: '',
            audioClue: '',
            url: '',
            alt: '',
            author: '',
            clue: '',
            showTime: false,
            showAttemps: false,
        };
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            const wrapper = $('<div></div>');
            wrapper.html(originalHTML);

            let json = $('.puzzle-DataGame', wrapper).text();
            json = $exeDevices.iDevice.gamification.helpers.decrypt(json);

            const dataGame =
                    $exeDevices.iDevice.gamification.helpers.isJsonString(json),
                $audiosDef = $('.puzzle-LinkAudiosDef', wrapper),
                $imagesDef = $('.puzzle-LinkImagesDef', wrapper),
                $audiosClue = $('.puzzle-LinkAudiosClue', wrapper);

            dataGame.puzzlesGame.forEach((puzzle) => {
                puzzle.puzzle = puzzle.puzzle === 'null' ? '' : puzzle.puzzle;
                puzzle.url =
                    typeof puzzle.url === 'undefined' ? '' : puzzle.url;
                puzzle.alt =
                    typeof puzzle.alt === 'undefined' ? '' : puzzle.alt;
                puzzle.author =
                    typeof puzzle.author === 'undefined' ? '' : puzzle.author;
            });

            $imagesDef.each(function () {
                const iqb = parseInt($(this).text(), 10);
                if (!isNaN(iqb) && iqb < dataGame.puzzlesGame.length) {
                    const puzzle = dataGame.puzzlesGame[iqb];
                    puzzle.url = $(this).attr('href');
                    if (puzzle.url.length < 4) {
                        puzzle.url = '';
                    }
                }
            });

            $audiosDef.each(function () {
                const iqa = parseInt($(this).text(), 10);
                if (!isNaN(iqa) && iqa < dataGame.puzzlesGame.length) {
                    const puzzle = dataGame.puzzlesGame[iqa];
                    puzzle.audioDefinition = $(this).attr('href');
                    if (puzzle.audioDefinition.length < 4) {
                        puzzle.audioDefinition = '';
                    }
                }
            });

            $audiosClue.each(function () {
                const iqa = parseInt($(this).text(), 10);
                if (!isNaN(iqa) && iqa < dataGame.puzzlesGame.length) {
                    const puzzle = dataGame.puzzlesGame[iqa];
                    puzzle.audioClue = $(this).attr('href');
                    if (puzzle.audioClue.length < 4) {
                        puzzle.audioClue = '';
                    }
                }
            });

            $exeDevice.updateFieldGame(dataGame);

            const instructions = $('.puzzle-instructions', wrapper);
            if (instructions.length === 1) {
                $('#eXeGameInstructions').val(instructions.html());
            }

            const textAfter = $('.puzzle-extra-content', wrapper);
            if (textAfter.length === 1) {
                $('#eXeIdeviceTextAfter').val(textAfter.html());
            }

            const textFeedBack = $('.puzzle-feedback-game', wrapper);
            if (textFeedBack.length === 1) {
                $('#puzzleEFeedBackEditor').val(textFeedBack.html());
            }

            $exeDevicesEdition.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs
            );
            $exeDevice.showPuzzle(0, true);
        }
    },

    getMediaType: function () {
        const ele = document.getElementsByName('qxtype');
        for (let i = 0; i < ele.length; i++) {
            if (ele[i].checked) return ele[i].value;
        }
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
        if (!$exeDevice.validatePuzzle()) return false;

        const dataGame = $exeDevice.validateData();
        if (!dataGame) return false;

        let fields = this.ci18n,
            i18n = fields;
        for (let i in fields) {
            let fVal = $('#ci18n_' + i).val();
            if (fVal != '') i18n[i] = fVal;
        }

        dataGame.msgs = i18n;
        let json = JSON.stringify(dataGame),
            divContent = '';

        json = $exeDevices.iDevice.gamification.helpers.encrypt(json);

        const textFeedBack = tinyMCE.get('puzzleEFeedBackEditor').getContent();
        if (dataGame.instructions != '')
            divContent =
                '<div class="puzzle-instructions">' +
                dataGame.instructions +
                '</div>';

        const linksImages = $exeDevice.createlinksImage(dataGame.puzzlesGame),
            linksAudios = $exeDevice.createlinksAudio(dataGame.puzzlesGame);

        let html = '<div class="puzzle-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html += '<div class="puzzle-feedback-game">' + textFeedBack + '</div>';
        html += divContent;
        html += '<div class="puzzle-DataGame js-hidden">' + json + '</div>';
        html += linksImages;
        html += linksAudios;
        const textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();
        if (textAfter != '') {
            html += '<div class="puzzle-extra-content">' + textAfter + '</div>';
        }

        html +=
            '<div class="puzzle-bns js-hidden">' +
            $exeDevice.msgs.msgNoSuportBrowser +
            '</div>';
        html += '</div>';
        return html;
    },
    createlinksImage: function (puzzlesGame) {
        let html = '';
        for (let i = 0; i < puzzlesGame.length; i++) {
            const q = puzzlesGame[i];
            if (
                typeof q.url != 'undefined' &&
                q.url.indexOf('http') != 0 &&
                q.url.length > 4
            ) {
                linkImage =
                    '<a href="' +
                    q.url +
                    '" class="js-hidden puzzle-LinkImagesDef">' +
                    i +
                    '</a>';
                html += linkImage;
            }
        }
        return html;
    },

    createlinksAudio: function (puzzlesGame) {
        let html = '';
        for (let i = 0; i < puzzlesGame.length; i++) {
            const q = puzzlesGame[i];
            if (
                typeof q.audioDefinition != 'undefined' &&
                q.audioDefinition.indexOf('http') != 0 &&
                q.audioDefinition.length > 4
            ) {
                linkImage =
                    '<a href="' +
                    q.audioDefinition +
                    '" class="js-hidden puzzle-LinkAudiosDef">' +
                    i +
                    '</a>';
                html += linkImage;
            }
            if (
                typeof q.audioClue != 'undefined' &&
                q.audioClue.indexOf('http') != 0 &&
                q.audioClue.length > 4
            ) {
                linkImage =
                    '<a href="' +
                    q.audioClue +
                    '" class="js-hidden puzzle-LinkAudiosClue">' +
                    i +
                    '</a>';
                html += linkImage;
            }
        }
        return html;
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    validateAlt: function () {
        const altImage = $('#puzzleEAlt').val();
        if (!$exeDevice.checkAltImage) return true;
        if (altImage !== '') return true;

        eXe.app.confirm(
            $exeDevice.msgs.msgTitleAltImageWarning,
            $exeDevice.msgs.msgAltImageWarning,
            function () {
                $exeDevice.checkAltImage = false;
                let saveButton = document.getElementsByClassName(
                    'button-save-idevice'
                )[0];
                saveButton.click();
            }
        );
        return false;
    },

    getIdeviceID: function () {
        const ideviceid =
            $('#puzzleIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';

        return ideviceid;
    },

    validateData: function () {
        const clear = $exeDevice.removeTags,
            instructions = tinyMCE.get('eXeGameInstructions').getContent(),
            textFeedBack = tinyMCE.get('puzzleEFeedBackEditor').getContent(),
            textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent(),
            showMinimize = $('#puzzleEShowMinimize').is(':checked'),
            randomPuzzles = $('#puzzleERandomPuzzles').is(':checked'),
            itinerary =
                $exeDevicesEdition.iDevice.gamification.itinerary.getValues(),
            feedBack = $('#puzzleEHasFeedBack').is(':checked'),
            percentajeFB = parseInt(clear($('#puzzleEPercentajeFB').val()), 10),
            percentajeQuestions = parseInt(
                clear($('#puzzleEPercentajeQuestions').val()),
                10
            ),
            author = $('#puzzleEAuthor').val(),
            puzzlesGame = $exeDevice.puzzlesGame,
            evaluation = $('#puzzleEEvaluation').is(':checked'),
            evaluationID = $('#puzzleEEvaluationID').val(),
            id = $exeDevice.getIdeviceID();

        if (!itinerary) return false;

        if (puzzlesGame.length === 0) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
            return false;
        }

        const scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();

        const data = {
            typeGame: 'Puzzle',
            author,
            instructions,
            randomPuzzles,
            showMinimize,
            itinerary,
            puzzlesGame,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted || 100,
            textFeedBack: escape(textFeedBack),
            textAfter: escape(textAfter),
            feedBack,
            percentajeFB,
            percentajeQuestions,
            version: $exeDevice.version,
            evaluation,
            evaluationID,
            id,
        };
        return data;
    },

    showImage: function (id) {
        const $image = $(`#puzzleEImage-${id}`),
            $nimage = $(`#puzzleENoImage-${id}`),
            alt = $(`#puzzleEAlt-${id}`).val(),
            url = $(`#puzzleEURLImage-${id}`).val();

        $image.hide();
        $image.attr('alt', alt);
        $nimage.show();

        const onLoadHandler = function () {
            if (
                !this.complete ||
                typeof this.naturalWidth === 'undefined' ||
                this.naturalWidth === 0
            ) {
                return false;
            } else {
                const mData = $exeDevice.placeImageWindows(
                    this,
                    this.naturalWidth,
                    this.naturalHeight
                );
                $exeDevice.drawImage(this, mData);
                $image.show();
                $nimage.hide();
                return true;
            }
        };

        const onErrorHandler = function () {
            return false;
        };

        $image
            .prop('src', url)
            .on('load', onLoadHandler)
            .on('error', onErrorHandler);

        $exeDevice.imageLoadHandlers = $exeDevice.imageLoadHandlers || {};
        $exeDevice.imageLoadHandlers[id] = {
            load: onLoadHandler,
            error: onErrorHandler,
        };
    },

    removeImageEvents: function (id) {
        const $image = $(`#puzzleEImage-${id}`),
            handlers =
                $exeDevice.imageLoadHandlers &&
                $exeDevice.imageLoadHandlers[id];

        if (handlers) {
            $image.off('load', handlers.load).off('error', handlers.error);

            delete $exeDevice.imageLoadHandlers[id];
        }
    },

    playSound: function (selectedFile) {
        const selectFile =
            $exeDevices.iDevice.gamification.media.extractURLGD(selectedFile);
        $exeDevice.playerAudio = new Audio(selectFile);
        $exeDevice.playerAudio
            .play()
            .catch((error) => console.error('Error playing audio:', error));
    },

    stopSound: function () {
        if (
            $exeDevice.playerAudio &&
            typeof $exeDevice.playerAudio.pause === 'function'
        ) {
            $exeDevice.playerAudio.pause();
        }
    },

    drawImage: function (image, mData) {
        $(image).css({
            position: 'absolute',
            left: `${mData.x}px`,
            top: `${mData.y}px`,
            width: `${mData.w}px`,
            height: `${mData.h}px`,
        });
    },

    addEvents: function () {
        $('#puzzleEPaste').hide();

        $('#puzzleEAdd').on('click', function (e) {
            e.preventDefault();
            $exeDevice.addPuzzle();
        });

        $('#puzzleEFirst').on('click', function (e) {
            e.preventDefault();
            $exeDevice.firstPuzzle();
        });

        $('#puzzleEPrevious').on('click', function (e) {
            e.preventDefault();
            $exeDevice.previousPuzzle();
        });

        $('#puzzleENext').on('click', function (e) {
            e.preventDefault();
            $exeDevice.nextPuzzle();
        });

        $('#puzzleELast').on('click', function (e) {
            e.preventDefault();
            $exeDevice.lastPuzzle();
        });

        $('#puzzleEDelete').on('click', function (e) {
            e.preventDefault();
            $exeDevice.removePuzzle();
        });

        $('#puzzleECopy').on('click', function (e) {
            e.preventDefault();
            $exeDevice.copyPuzzle();
        });

        $('#puzzleEPaste').on('click', function (e) {
            e.preventDefault();
            $exeDevice.pastePuzzle();
        });

        $('#puzzleECut').on('click', function (e) {
            e.preventDefault();
            $exeDevice.cutPuzzle();
        });

        if (
            window.File &&
            window.FileReader &&
            window.FileList &&
            window.Blob
        ) {
            $('#eXeGameExportImport').show();
            $('#eXeGameImportGame').on('change', function (e) {
                let file = e.target.files[0];
                if (!file) {
                    return;
                }
                let reader = new FileReader();
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

        $('#puzzleEHasFeedBack').on('change', function () {
            const marcado = $(this).is(':checked');
            if (marcado) {
                $('#puzzleEFeedbackP').slideDown();
            } else {
                $('#puzzleEFeedbackP').slideUp();
            }
            $('#puzzleEPercentajeFB').prop('disabled', !marcado);
        });

        $('#puzzleEPercentajeQuestions').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 3);
            this.value = v;
            if (this.value > 0 && this.value < 101) {
                $exeDevice.updateQuestionsNumber();
            }
        });

        $('#puzzleEPercentajeQuestions').on('focusout', function () {
            this.value = this.value.trim() == '' ? 100 : this.value;
            this.value = this.value > 100 ? 100 : this.value;
            this.value = this.value < 1 ? 1 : this.value;
            $exeDevice.updateQuestionsNumber();
        });
        $('#puzzleETime').on('focusout', function () {
            this.value = this.value.trim() == '' ? 0 : this.value;
            this.value = this.value > 999 ? 999 : this.value;
            this.value = this.value < 0 ? 0 : this.value;
        });

        $('#puzzleETime').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 3);
            this.value = v;
        });

        $('#puzzleEPercentajeQuestions').on('click', function () {
            $exeDevice.updateQuestionsNumber();
        });

        $('#puzzleETimeShowSolution').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 3);
            this.value = v;
        });

        $('#puzzleETimeShowSolution').on('focusout', function () {
            this.value = this.value.trim() == '' ? 3 : this.value;
            this.value = this.value > 999 ? 999 : this.value;
            this.value = this.value < 1 ? 1 : this.value;
        });

        $('#puzzleEURLAudioDefinition').on('change', function () {
            $exeDevice.loadAudio($(this).val());
        });

        $('#puzzleEPlayAudioDefinition').on('click', function (e) {
            e.preventDefault();
            const audio = $('#puzzleEURLAudioDefinition').val();
            $exeDevice.loadAudio(audio);
        });

        $('#puzzleEURLAudioClue').on('change', function () {
            $exeDevice.loadAudio($(this).val());
        });

        $('#puzzleEPlayAudioClue').on('click', function (e) {
            e.preventDefault();
            const audio = $('#puzzleEURLAudioClue').val();
            $exeDevice.loadAudio(audio);
        });

        $('#puzzleEEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#puzzleEEvaluationID').prop('disabled', !marcado);
        });

        $('#puzzleEEvaluationHelpLnk').click(function () {
            $('#puzzleEEvaluationHelp').toggle();
            return false;
        });

        $('#puzzleEShowMoreDefinition').on('click', function (e) {
            e.preventDefault();
            if ($('#puzzleEDefinitionAltAuthor').hasClass('d-none')) {
                $('#puzzleEDefinitionAltAuthor')
                    .removeClass('d-none')
                    .addClass('d-blok');
            } else {
                $('#puzzleEDefinitionAltAuthor')
                    .removeClass('d-block')
                    .addClass('d-none');
            }
        });

        $('#puzzleEURLImageDefinition').on('change', function () {
            $exeDevice.loadImageDefinition();
        });

        $('#puzzleEPlayImageDefinition').on('click', function (e) {
            e.preventDefault();
            $exeDevice.loadImageDefinition();
        });

        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();

        //eXe 3.0 Dismissible messages
        $('.exe-block-dismissible .exe-block-close').click(function () {
            $(this).parent().fadeOut();
            return false;
        });
    },

    loadImage: function (id) {
        const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
            url = $('#puzzleEURLImage-' + id).val(),
            ext = url.split('.').pop().toLowerCase();

        if (url.indexOf('files') == 0 && validExt.indexOf(ext) == -1) {
            $exeDevice.showMessage(
                _('Supported formats') + ': jpg, jpeg, gif, png, svg webp'
            );
            return false;
        }
        $exeDevice.showImage(id);
    },

    loadImageDefinition: function () {
        const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
            url = $('#puzzleEURLImageDefinition').val(),
            ext = url.split('.').pop().toLowerCase();

        if (url.trim().length < 4) return false;
        if (url.indexOf('files') == 0 && validExt.indexOf(ext) == -1) {
            $exeDevice.showMessage(
                _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
            );
            return false;
        }
        $('#puzzleEImageDefinition').attr('src', url);
    },

    loadAudio: function (url) {
        const validExt = ['mp3', 'ogg', 'waw'],
            ext = url.split('.').pop().toLowerCase();
        if (url.indexOf('files') == 0 && validExt.indexOf(ext) == -1) {
            $exeDevice.showMessage(_('Supported formats') + ': mp3, ogg, waw');
            return false;
        } else {
            if (url.length > 4) {
                $exeDevice.stopSound();
                $exeDevice.playSound(url);
            }
        }
    },

    updateGameMode: function (feedback) {
        $('#puzzleEHasFeedBack').prop('checked', feedback);

        if (feedback) $('#puzzleEFeedbackP').slideDown();

        if (!feedback) $('#puzzleEFeedbackP').slideUp();
    },

    clearPuzzle: function () {
        $('#puzzleEDefinition').val('');
        $('#puzzleEURLImageDefinition').val('');
        $('#puzzleEAltDefinition').val('');
        $('#puzzleEAuthorDefinition').val('');
        $('#puzzleEImageDefinition').attr(
            'src',
            $exeDevice.iDevicePath + 'quextIEImagen.png'
        );
        $('#puzzleEURLAudioDefinition').val('');
        $('#puzzleECluePuzzle').val('');
        $('#puzzleEURLAudioClue').val('');
    },

    addPuzzle: function () {
        if (!$exeDevice.validatePuzzle()) return;

        $exeDevice.clearPuzzle();
        $exeDevice.puzzlesGame.push($exeDevice.getPuzzleDefault());
        $exeDevice.active = $exeDevice.puzzlesGame.length - 1;

        $('#puzzleENumberPuzzle').text($exeDevice.puzzlesGame.length);
        $exeDevice.typeEdit = -1;
        $('#puzzleEPaste').hide();
        $('#puzzleENumPuzzles').text($exeDevice.puzzlesGame.length);
        $exeDevice.updateQuestionsNumber();
    },

    removePuzzle: function () {
        if ($exeDevice.puzzlesGame.length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
        } else {
            $exeDevice.puzzlesGame.splice($exeDevice.active, 1);
            if ($exeDevice.active >= $exeDevice.puzzlesGame.length - 1)
                $exeDevice.active = $exeDevice.puzzlesGame.length - 1;
            $exeDevice.showPuzzle($exeDevice.active);
            $exeDevice.typeEdit = -1;
            $('#puzzleEPaste').hide();
            $('#puzzleENumPuzzles').text($exeDevice.puzzlesGame.length);
            $('#puzzleENumberPuzzle').text($exeDevice.active + 1);
            $exeDevice.updateQuestionsNumber();
        }
    },

    copyPuzzle: function () {
        if ($exeDevice.validatePuzzle()) {
            $exeDevice.typeEdit = 0;
            $exeDevice.clipBoard = JSON.parse(
                JSON.stringify($exeDevice.puzzlesGame[$exeDevice.active])
            );
            $exeDevice.puzzlesGame[$exeDevice.active];
            $('#puzzleEPaste').show();
        }
    },

    cutPuzzle: function () {
        if ($exeDevice.validatePuzzle()) {
            $exeDevice.numberCutCuestion = $exeDevice.active;
            $exeDevice.typeEdit = 1;
            $('#puzzleEPaste').show();
        }
    },

    pastePuzzle: function () {
        if ($exeDevice.puzzlesGame.length >= 30) {
            $exeDevice.showMessage($exeDevice.msgs.msgPairsMax);
            return;
        }
        if ($exeDevice.typeEdit === 0) {
            $exeDevice.active++;
            const p = $.extend(true, {}, $exeDevice.clipBoard);
            $exeDevice.puzzlesGame.splice($exeDevice.active, 0, p);
            $exeDevice.showPuzzle($exeDevice.active);
            $('#puzzleENumPuzzles').text($exeDevice.puzzlesGame.length);
        } else if ($exeDevice.typeEdit === 1) {
            $('#puzzleEPaste').hide();
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                $exeDevice.puzzlesGame,
                $exeDevice.numberCutCuestion,
                $exeDevice.active
            );
            $exeDevice.showPuzzle($exeDevice.active);
            $('#puzzleENumPuzzles').text($exeDevice.puzzlesGame.length);
            $('#puzzleENumberPuzzle').text($exeDevice.active + 1);
            $exeDevice.updateQuestionsNumber();
        }
    },

    nextPuzzle: function () {
        if (
            $exeDevice.validatePuzzle() &&
            $exeDevice.active < $exeDevice.puzzlesGame.length - 1
        ) {
            $exeDevice.active++;
            $exeDevice.showPuzzle($exeDevice.active);
        }
    },

    lastPuzzle: function () {
        if (
            $exeDevice.validatePuzzle() &&
            $exeDevice.active < $exeDevice.puzzlesGame.length - 1
        ) {
            $exeDevice.active = $exeDevice.puzzlesGame.length - 1;
            $exeDevice.showPuzzle($exeDevice.active);
        }
    },

    previousPuzzle: function () {
        if ($exeDevice.validatePuzzle() && $exeDevice.active > 0) {
            $exeDevice.active--;
            $exeDevice.showPuzzle($exeDevice.active);
        }
    },

    firstPuzzle: function () {
        if ($exeDevice.validatePuzzle() && $exeDevice.active > 0) {
            $exeDevice.active = 0;
            $exeDevice.showPuzzle($exeDevice.active);
        }
    },

    updateFieldGame: function (game) {
        $exeDevice.active = 0;
        $exeDevicesEdition.iDevice.gamification.itinerary.setValues(
            game.itinerary
        );

        game.evaluation =
            typeof game.evaluation !== 'undefined' ? game.evaluation : false;
        game.evaluationID =
            typeof game.evaluationID !== 'undefined' ? game.evaluationID : '';
        game.weighted =
            typeof game.weighted !== 'undefined' ? game.weighted : 100;
        $exeDevice.id = $exeDevice.getIdeviceID();

        $('#puzzleEShowMinimize').prop('checked', game.showMinimize);
        $('#puzzleERandomPuzzles').prop('checked', game.randomPuzzles);
        $('#puzzleEHasFeedBack').prop('checked', game.feedBack);
        $('#puzzleEPercentajeFB').val(game.percentajeFB);
        $('#puzzleEPercentajeQuestions').val(game.percentajeQuestions);
        $('#puzzleETimeShowSolution').val(game.timeShowSolution);
        $('#puzzleEAuthor').val(game.author);

        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted
        );
        $exeDevice.puzzlesGame = game.puzzlesGame;
        $exeDevice.updateGameMode(game.feedBack);

        $('#puzzleENumPuzzles').text($exeDevice.puzzlesGame.length);
        $('#puzzleEPercentajeFB').prop('disabled', !game.feedBack);
        $exeDevice.updateQuestionsNumber();

        $('#puzzleEEvaluation').prop('checked', game.evaluation);
        $('#puzzleEEvaluationID').val(game.evaluationID);
        $('#puzzleEEvaluationID').prop('disabled', !game.evaluation);
    },

    exportGame: function () {
        const dataGame = this.validateData();

        if (!dataGame) return false;

        const blob = JSON.stringify(dataGame),
            newBlob = new Blob([blob], { type: 'text/plain' });

        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveOrOpenBlob(newBlob);
            return;
        }

        const data = window.URL.createObjectURL(newBlob),
            link = document.createElement('a');
        link.href = data;
        link.download = `${_('Activity')}-Puzzle.json`;
        document.getElementById('puzzleIdeviceForm').appendChild(link);
        link.click();
        setTimeout(() => {
            document.getElementById('puzzleIdeviceForm').removeChild(link);
            window.URL.revokeObjectURL(data);
        }, 100);
    },

    importGame: function (content) {
        const game =
            $exeDevices.iDevice.gamification.helpers.isJsonString(content);

        if (!game || typeof game.typeGame === 'undefined') {
            eXe.app.alert($exeDevice.msgs.msgESelectFile);
            return;
        } else if (game.typeGame !== 'Puzzle') {
            eXe.app.alert($exeDevice.msgs.msgESelectFile);
            return;
        }

        game.id = $exeDevice.getIdeviceID();
        $exeDevice.updateFieldGame(game);

        const instructions = game.instructionsExe || game.instructions || '',
            tAfter = game.textAfter || '',
            textFeedBack = game.textFeedBack || '';

        $('#eXeGameInstructions').val(unescape(instructions));
        $('#eXeIdeviceTextAfter').val(unescape(tAfter));
        $('#puzzleEFeedBackEditor').val(unescape(textFeedBack));

        //$('.exe-form-tabs li:first-child a').click();
        $exeDevice.showPuzzle(0, false);
    },

    validTime: function (time) {
        const reg = /^(?:(?:([01]?\d|2[0-3]):)?([0-5]?\d):)?([0-5]?\d)$/;
        return time.length == 8 && reg.test(time);
    },

    placeImageWindows: function (image, naturalWidth, naturalHeight) {
        const $parent = $(image).parent(),
            wDiv = Math.max($parent.width(), 1),
            hDiv = Math.max($parent.height(), 1),
            varW = naturalWidth / wDiv,
            varH = naturalHeight / hDiv;

        let wImage = wDiv,
            hImage = hDiv,
            xImage = 0,
            yImage = 0;

        if (varW > varH) {
            wImage = Math.round(wDiv);
            hImage = Math.round(naturalHeight / varW);
            yImage = Math.round((hDiv - hImage) / 2);
        } else {
            wImage = Math.round(naturalWidth / varH);
            hImage = Math.round(hDiv);
            xImage = Math.round((wDiv - wImage) / 2);
        }

        return {
            w: wImage,
            h: hImage,
            x: xImage,
            y: yImage,
        };
    },

    clickImage: function (id, epx, epy) {
        const $image = $('#puzzleEImage-' + id),
            $x = $('#puzzleEX-' + id),
            $y = $('#puzzleEY-' + id),
            posX = epx - $image.offset().left,
            posY = epy - $image.offset().top,
            wI = $image.width() > 0 ? $image.width() : 1,
            hI = $image.height() > 0 ? $image.height() : 1,
            lI = $image.position().left,
            tI = $image.position().top;

        $x.val(posX / wI);
        $y.val(posY / hI);
        $cursor.css({
            left: posX + lI,
            top: posY + tI,
            'z-index': 120,
        });
        $cursor.show();
    },

    removeTags: function (str) {
        let wrapper = $('<div></div>');
        wrapper.html(str);
        return wrapper.text();
    },
};
