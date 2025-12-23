/* eslint-disable no-undef */
/**
/**
 * Adivina Activity iDevice (edition code)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narvaez Martinez
 * Desing: Ana María Zamora Moreno
 * Author: Ricardo Malaga Floriano
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    i18n: {
        category: _('Assessment and tracking'),
        name: _('Guess'),
    },
    msgs: {},
    classIdevice: 'guess',
    active: 0,
    wordsGame: [],
    youtubeLoaded: false,
    player: '',
    timeUpdateInterval: '',
    timeUpdateVIInterval: '',
    timeVideoFocus: 0,
    timeVIFocus: true,
    timeQuestion: 30,
    percentajeShow: 35,
    typeEdit: -1,
    numberCutCuestion: -1,
    clipBoard: '',
    activeSilent: false,
    silentVideo: 0,
    tSilentVideo: 0,
    endSilent: 0,
    version: 2,
    idevicePath: '',
    playerAudio: '',
    isVideoType: false,
    localPlayer: null,
    sgoogle: null,
    id: false,
    ci18n: {},
    checkAltImage: true,
    modeBoard: false,
    accesibilityIsOk: true,
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
            msgHappen: c_('Move on'),
            msgReply: c_('Reply'),
            msgSubmit: c_('Submit'),
            msgEnterCode: c_('Enter the access code'),
            msgErrorCode: c_('The access code is not correct'),
            msgGameOver: c_('Game Over!'),
            msgIndicateWord: c_('Provide a word or phrase'),
            msgClue: c_('Cool! The clue is:'),
            msgYouHas: c_('You have got %1 hits and %2 misses'),
            msgCodeAccess: c_('Access code'),
            msgPlayAgain: c_('Play Again'),
            msgRequiredAccessKey: c_('Access code required'),
            msgInformationLooking: c_(
                'Cool! The information you were looking for'
            ),
            msgPlayStart: c_('Click here to play'),
            msgErrors: c_('Errors'),
            msgMoveOne: c_('Move on'),
            msgHits: c_('Hits'),
            msgScore: c_('Score'),
            msgWeight: c_('Weight'),
            msgMinimize: c_('Minimize'),
            msgMaximize: c_('Maximize'),
            msgTime: c_('Time Limit (mm:ss)'),
            msgLive: c_('Life'),
            msgFullScreen: c_('Full Screen'),
            msgExitFullScreen: c_('Exit Full Screen'),
            msgNumQuestions: c_('Number of questions'),
            msgNoImage: c_('No picture question'),
            msgCool: c_('Cool!'),
            msgLoseT: c_('You lost 330 points'),
            msgLoseLive: c_('You lost one life'),
            msgLostLives: c_('You lost all your lives!'),
            mgsAllQuestions: c_('Questions completed!'),
            msgSuccesses: c_(
                'Right! | Excellent! | Great! | Very good! | Perfect!'
            ),
            msgFailures: c_(
                'It was not that! | Incorrect! | Not correct! | Sorry! | Error!'
            ),
            msgTryAgain: c_(
                'You need at least %s&percnt; of correct answers to get the information. Please try again.'
            ),
            msgWrote: c_(
                'Write the correct word and click on Reply. If you hesitate, click on Move on.'
            ),
            msgNotNetwork: c_(
                'You can only play this game with internet connection.'
            ),
            msgEndGameScore: c_(
                'Please start the game before saving your score.'
            ),
            msgScoreScorm: c_(
                "The score can't be saved because this page is not part of a SCORM package."
            ),
            msgQuestion: c_('Question'),
            msgAnswer: c_('Answer'),
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
            msgLoading: c_('Loading. Please wait...'),
            msgPoints: c_('points'),
            msgAudio: c_('Audio'),
            msgCorrect: c_('Correct'),
            msgIncorrect: c_('Incorrect'),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgTypeGame: c_('Word Guessing'),
        };
    },
    setMessagesInfo: function () {
        const msgs = this.msgs;
        msgs.msgEProvideDefinition = _(
            'Please provide the definition of the word or phrase'
        );
        msgs.msgESelectFile = _(
            'The selected file does not contain a valid game'
        );
        msgs.msgEURLValid = _(
            'You must upload or indicate the valid URL of an image'
        );
        msgs.msgEProvideWord = _('Please provide one word or phrase');
        msgs.msgEOneQuestion = _('Please provide at least one question');
        msgs.msgEUnavailableVideo = _('This video is not currently available');
        msgs.msgECompleteQuestion = _('You have to complete the question');
        msgs.msgECompleteAllOptions = _(
            'You have to complete all the selected options'
        );
        msgs.msgESelectSolution = _('Choose the right answer');
        msgs.msgECompleteURLYoutube = _('Please type or paste a valid URL.');
        msgs.msgEStartEndVideo = _(
            'You have to indicate the start and the end of the video that you want to show'
        );
        msgs.msgEStartEndIncorrect = _(
            'The video end value must be higher than the start one'
        );
        msgs.msgWriteText = _('You have to type a text in the editor');
        msgs.msgSilentPoint = _(
            'The silence time is wrong. Check the video duration.'
        );
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
            'Are you sure you want to continue without including an Image Description? Without it the image may not be accessible to some users with disabilities, or to those using a text browser, or browsing the Web with images turned off.'
        );
    },

    createForm: function () {
        const path = $exeDevice.idevicePath,
            html = `
            <div id="gameQEIdeviceForm">
                <p class="exe-block-info exe-block-dismissible" style="position:relative">
                    ${_('Create activities where, given a definition, students complete the word by filling in the missing letters.')} 
                    <a href="https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe29/adivina.html" hreflang="es" target="_blank">${_('Usage Instructions')}</a>
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Observe the letters, identify and fill in the missing words.'))}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_('Options')}</a></legend>
                        <div id="adivinaEOptions">
                            <div class="toggle-item mb-3" data-target="adivinaEShowMinimize">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="adivinaEShowMinimize" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="adivinaEShowMinimize">${_('Show minimized.')}</label>
                            </div>
                            <div class="toggle-item mb-3" data-target="adivinaEOptionsRamdon">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="adivinaEOptionsRamdon" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="adivinaEOptionsRamdon">${_('Random questions')}</label>
                            </div>
                            <div class="toggle-item mb-3" data-target="adivinaECustomMessages">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="adivinaECustomMessages" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="adivinaECustomMessages">${_('Custom messages')}.</label>
                            </div>
                            <div class="d-flex align-items-center flex-nowrap mb-3 gap-2">
                                <div class="toggle-item toggle-related m-0" data-target="adivinaEShowSolution">
                                    <span class="toggle-control">
                                        <input type="checkbox" class="toggle-input" id="adivinaEShowSolution" checked />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="adivinaEShowSolution">${_('Show solutions')}.</label>
                                </div>
                                <label for="adivinaETimeShowSolution">${_('Show solution time (seconds)')}</label>
                                <input type="number" name="adivinaETimeShowSolution" id="adivinaETimeShowSolution" value="3" min="1" max="9" class="form-control" />
                            </div>
                            <div class="toggle-item mb-3" data-target="adivinaECaseSensitive">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="adivinaECaseSensitive" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="adivinaECaseSensitive">${_('Case sensitive')}</label>
                            </div>
                            <div class="d-flex align-items-center flex-nowrap gap-2 mb-3">
                                <span>${_('Score')}: </span>
                                <div class="form-check form-check-inline m-0">
                                    <input class="form-check-input ADVNE-TypeGame" checked="checked" id="adivinaETypeActivity" type="radio" name="qxtgamemode" value="1" />
                                    <label class="form-check-label" for="adivinaETypeActivity">${_('From 0 to 10')}</label>
                                </div>
                                <div class="form-check form-check-inline m-0">
                                    <input class="form-check-input ADVNE-TypeGame" id="adivinaEGameMode" type="radio" name="qxtgamemode" value="0" />
                                    <label class="form-check-label" for="adivinaEGameMode">${_('Points and lives')}</label>
                                </div>
                                <div class="form-check form-check-inline m-0">
                                    <input class="form-check-input ADVNE-TypeGame" id="adivinaETypeReto" type="radio" name="qxtgamemode" value="2" />
                                    <label class="form-check-label" for="adivinaETypeReto">${_('No score')}</label>
                                </div>
                                <a href="#adivinaEGameModeHelp" id="adivinaEGameModeHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                    <img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}" />
                                </a> 
                            </div>
                            <div id="adivinaEGameModeHelp" class="exe-block-info ADVNE-TypeGameHelp pt-3">
                                <ul>
                                    <li><strong>${_('From 0 to 10')}: </strong>${_('No lives, 0 to 10 score, right/wrong answers counter... A more educational context.')}</li>
                                    <li><strong>${_('Points and lives')}: </strong>${_('Just like a game: Aim for a high score (thousands of points) and try not to lose your lives.')}</li>
                                    <li><strong>${_('No score')}: </strong>${_('No score and no lives. You have to answer right to get some information (a feedback).')}</li>
                                </ul>
                            </div>
                            <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                                <div class="toggle-item toggle-related m-0" data-target="adivinaEUseLives">
                                    <span class="toggle-control">
                                        <input type="checkbox" class="toggle-input" id="adivinaEUseLives" checked />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="adivinaEUseLives">${_('Use lives')}.</label>
                                </div>
                                <label for="adivinaENumberLives"> ${_('Number of lives')}:</label>
                                <input type="number" name="adivinaENumberLives" id="adivinaENumberLives" value="3" min="1" max="5" class="form-control" />

                            </div>
                            <div class="d-flex align-items-center flex-wrap mb-3 gap-2">
                                <div class="toggle-item toggle-related m-0" data-target="adivinaEHasFeedBack">
                                    <span class="toggle-control">
                                        <input type="checkbox" class="toggle-input" id="adivinaEHasFeedBack" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="adivinaEHasFeedBack">${_('Feedback')}.</label>
                                </div>
                                <input type="number" name="adivinaEPercentajeFB" id="adivinaEPercentajeFB" value="100" min="5" max="100" step="5" disabled class="form-control" />
                                <label for="adivinaEPercentajeFB">${_('&percnt; right to see the feedback')}</label>
                            </div>
                            <div id="adivinaEFeedbackP" class="ADVNE-EFeedbackP mb-3">
                                <textarea id="adivinaEFeedBackEditor" class="exe-html-editor form-control" rows="4"></textarea>
                            </div>
                            <div class="d-flex align-items-center flex-wrap mb-3 gap-2">
                                <label for="adivinaEPercentajeQuestions" class="toggle-label">%${_('Questions')}:</label>
                                <input type="number" name="adivinaEPercentajeQuestions" id="adivinaEPercentajeQuestions" value="100" min="1" max="100" class="form-control" />
                                <span id="adivinaENumeroPercentaje" >1/1</span>
                            </div>
                            <div class="toggle-item mb-3" data-target="adivinaModeBoard">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="adivinaModeBoard" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="adivinaModeBoard">${_('Digital whiteboard mode')}</label>
                            </div>
                            <div class="toggle-item mb-3" data-target="adivinaETranslate" style="display:none">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="adivinaETranslate" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="adivinaETranslate">${_('Activate translator')}.</label>
                            </div>
                            <div class="d-flex align-items-center gap-2 mb-3">
                                <label for="adivinaEGlobalTimes">${_('Time per question')}:</label>
                                <select id="adivinaEGlobalTimes" class="form-select form-select-sm" style="max-width:10ch">
                                    <option value="0" selected>15s</option>
                                    <option value="1">30s</option>
                                    <option value="2">1m</option>
                                    <option value="3">3m</option>
                                    <option value="4">5m</option>
                                    <option value="5">10m</option>
                                </select>
                                <button id="adivinaGlobalTimeButton" class="btn btn-primary" type="button">${_('Accept')}</button> 
                            </div>
                            <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                                <div class="toggle-item m-0" data-target="adivinaEEvaluation">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="adivinaEEvaluation" class="toggle-input" aria-label="${_('Progress report')}">
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="adivinaEEvaluation">${_('Progress report')}.</label>
                                </div>
                                <div class="d-flex align-items-center flex-nowrap gap-2">
                                    <label for="adivinaEEvaluationID" class="mb-0">${_('Identifier')}:</label>
                                    <input type="text" class="form-control" id="adivinaEEvaluationID" disabled value="${eXeLearning.app.project.odeId || ''}"/>
                                    <a href="#adivinaEEvaluationHelp" id="adivinaEEvaluationHelpLnk" style="min-width:18px" class="GameModeHelpLink" title="${_('Help')}">
                                        <img src="${path}quextIEHelp.png"  width="18" height="18" alt="${_('Help')}"/>
                                    </a>
                                </div>
                            </div>
                            <p id="adivinaEEvaluationHelp" class="exe-block-info ADVNE-TypeGameHelp">
                                ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                            </p>
                        </div>
                    </fieldset>
                    <fieldset class="exe-fieldset">
                        <legend><a href="#">${_('Words/Phrases')}</a></legend>
                        <div class="ADVNE-EPanel" id="adivinaEPanel">
                            <div class="ADVNE-EOptionsMedia">
                                <div class="ADVNE-EOptionsGame">
                                    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                                        <span>${_('Multimedia Type')}:</span>
                                        <div class="form-check form-check-inline m-0">
                                            <input class="form-check-input ADVNE-Type" checked="checked" id="adivinaEMediaNormal" type="radio" name="qxtmediatype" value="0" disabled />
                                            <label class="form-check-label" for="adivinaEMediaNormal">${_('None')}</label>
                                         </div>
                                        <div class="form-check form-check-inline m-0">
                                            <input class="form-check-input ADVNE-Type" id="adivinaEMediaImage" type="radio" name="qxtmediatype" value="1" disabled />
                                            <label class="form-check-label" for="adivinaEMediaImage">${_('Image')}</label>
                                        </div>
                                        <div class="form-check form-check-inline m-0">
                                            <input class="form-check-input ADVNE-Type" id="adivinaEMediaVideo" type="radio" name="qxtmediatype" value="2" disabled />
                                            <label class="form-check-label" for="adivinaEMediaVideo">${_('Video')}</label>
                                        </div>
                                        <div class="form-check form-check-inline m-0">
                                            <input class="form-check-input ADVNE-Type" id="adivinaEMediaText" type="radio" name="qxtmediatype" value="3" disabled />
                                            <label class="form-check-label" for="adivinaEMediaText">${_('Text')}</label>
                                        </div>
                                    </div>
                                    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                                        <span class="mb3">${_('Time per question')}:</span>
                                        <div class="form-check form-check-inline m-0">
                                            <input class="form-check-input ADVNE-Times" checked="checked" id="q15s" type="radio" name="qxttime" value="0" />
                                            <label class="form-check-label" for="q15s">15s</label>
                                        </div>
                                        <div class="form-check form-check-inline m-0">
                                            <input class="form-check-input ADVNE-Times" id="q30s" type="radio" name="qxttime" value="1" />
                                            <label class="form-check-label" for="q30s">30s</label>
                                        </div>
                                        <div class="form-check form-check-inline m-0">
                                            <input class="form-check-input ADVNE-Times" id="q1m" type="radio" name="qxttime" value="2" />
                                            <label class="form-check-label" for="q1m">1m</label>
                                        </div>
                                        <div class="form-check form-check-inline m-0">
                                            <input class="form-check-input ADVNE-Times" id="q3m" type="radio" name="qxttime" value="3" />
                                            <label class="form-check-label" for="q3m">3m</label>
                                        </div>
                                        <div class="form-check form-check-inline m-0">
                                            <input class="form-check-input ADVNE-Times" id="q5m" type="radio" name="qxttime" value="4" />
                                            <label class="form-check-label" for="q5m">5m</label>
                                        </div>
                                        <div class="form-check form-check-inline m-0">
                                            <input class="form-check-input ADVNE-Times" id="q10m" type="radio" name="qxttime" value="5" />
                                            <label class="form-check-label" for="q10m">10m</label>
                                        </div>
                                    </div>
                                    <div id="adivinaEPercentageShowDiv" class="d-flex flex-wrap align-items-center gap-2 mb-3">                                        
                                        <label for="adivinaEPercentageShow">${_('Percentage of letters to show (%)')}:</label>
                                        <input type="number" name="adivinaEPercentageShow" id="adivinaEPercentageShow" value="35" min="0" max="100" step="5" class="form-control" />
                                    </div>
                                    <span id="adivinaTitleImage">${_('Image URL')}</span>
                                    <div class="flex-nowrap align-items-center  flex-nowrap gap-2 mb-3" id="adivinaEInputImage">
                                        <label class="sr-av" for="adivinaEURLImage">${_('Image URL')}</label>
                                        <input type="text" class="exe-file-picker form-control me-0" id="adivinaEURLImage"/>
                                        <a href="#" id="adivinaEPlayImage" class="ADVNE-ENavigationButton ADVNE-EPlayVideo" title="${_('Show')}">
                                            <img src="${path}quextIEPlay.png" alt="${_('Show')}" class="ADVNE-ENavigationButton " />
                                        </a>
                                    </div>

                                    <div class="ADVNE-ECoord">
                                        <label for="adivinaEXImage">X:</label>
                                        <input id="adivinaEXImage" type="text" value="0" />
                                        <label for="adivinaEYImage">Y:</label>
                                        <input id="adivinaEYImage" type="text" value="0" />
                                    </div>
                                    <span id="adivinaTitleVideo">${_('URL')}</span>
                                    <div class="flex-nowrap align-items-center gap-2 flex-nowrap mb-3" id="adivinaEInputVideo">
                                        <label class="sr-av" for="adivinaEURLYoutube">${_('URL')}</label>
                                        <input id="adivinaEURLYoutube" type="text" class="form-control" />
                                        <a href="#" id="adivinaEPlayVideo" class="ADVNE-ENavigationButton" title="${_('Play video')}">
                                            <img src="${path}quextIEPlay.png" alt="${_('Play video')}" class="ADVNE-ENavigationButton " />
                                        </a>
                                    </div>
                                    <div class="mb-3" id="adivinaEInputOptionsVideo">
                                        <div class="ADVNE-EMediaRow ADVNE-EVideoTimeRow">
                                            <div class="ADVNE-EMediaRow-options d-flex align-items-center flex-nowrap ADVNE-EVideoTimeCompact">
                                                <label for="adivinaEInitVideo" class="mb-0 me-1">${_('Start')}:</label>
                                                <input id="adivinaEInitVideo" type="text" value="00:00:00" maxlength="8" class="form-control" />
                                                <label for="adivinaEEndVideo" class="mb-0 ms-2 me-1">${_('End')}:</label>
                                                <input id="adivinaEEndVideo" type="text" value="00:00:00" maxlength="8" class="form-control" />
                                                <button class="bnt btn-primary"  id="adivinaEVideoTime" type="button">00:00:00</button>
                                            </div>
                                        </div>
                                        <div class="ADVNE-EMediaRow ADVNE-EVideoSilentRow">
                                            <div class="ADVNE-EMediaRow-options d-flex align-items-center flex-nowrap ADVNE-EVideoTimeCompact">
                                                <label for="adivinaESilenceVideo" class="mb-0 me-1">${_('Silence')}:</label>
                                                <input id="adivinaESilenceVideo" type="text" value="00:00:00" maxlength="8" class="form-control" />
                                                <label for="adivinaETimeSilence" class="mb-0 ms-2 me-1">${_('Time (s)')}:</label>
                                                <input type="number" name="adivinaETimeSilence" id="adivinaETimeSilence" value="0" min="0" max="120" class="form-control" />
                                            </div>
                                        </div>
                                        <div class="ADVNE-EMediaRow">
                                            <div class="ADVNE-EMediaRow-options d-flex align-items-center flex-wrap ADVNE-EVideoTimeCompact">
                                                <span class="mb-0 me-1">${_('Options')}:</span>
                                                <div class="toggle-item form-check m-0 d-flex align-items-center gap-1" data-target="adivinaECheckSoundVideo">
                                                    <span class="toggle-control">
                                                        <input id="adivinaECheckSoundVideo" type="checkbox" class="toggle-input" checked />
                                                        <span class="toggle-visual"></span>
                                                    </span>
                                                    <label for="adivinaECheckSoundVideo" class="toggle-label mb-0">${_('Audio')}</label>
                                                </div>
                                                <div class="toggle-item form-check m-0 d-flex align-items-center gap-1 ms-2" data-target="adivinaECheckImageVideo">
                                                    <span class="toggle-control">
                                                        <input id="adivinaECheckImageVideo" type="checkbox" class="toggle-input" checked />
                                                        <span class="toggle-visual"></span>
                                                    </span>
                                                    <label for="adivinaECheckImageVideo" class="toggle-label mb-0">${_('Image')}</label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="align-items-center flex-nowrap gap-2 mb-3" id="adivinaEAuthorAlt">
                                            <div class="w-50" id="adivinaEInputAuthor">
                                                <label for="adivinaEAuthor" class="form-label">${_('Authorship')}</label>
                                                <input id="adivinaEAuthor" type="text" class="form-control w-100" />
                                            </div>
                                            <div class="w-50" id="adivinaEInputAlt">
                                                <label for="adivinaEAlt" class="form-label mb-1">${_('Alternative text')}</label>
                                                <input id="adivinaEAlt" type="text" class="form-control w-100" />
                                            </div>
                                    </div>
                                    <span id="adivinaETitleInputAudio">${_('Audio')}</span>
                                    <div class="d-flex align-items-center flex-nowrap gap-2 mb-3" id="adivinaEInputAudio">
                                        <label class="sr-av" for="adivinaEURLAudio">${_('URL')}</label>
                                        <input type="text" class="exe-file-picker ADVNE-EURLAudio form-control  me-0" id="adivinaEURLAudio"/>
                                        <a href="#" id="adivinaEPlayAudio" class="ADVNE-ENavigationButton ADVNE-EPlayVideo" title="${_('Play audio')}">
                                            <img src="${path}quextIEPlay.png" alt="${_('Play audio')}" class="ADVNE-ENavigationButton " />
                                        </a>
                                    </div>
                                </div>
                                <div class="ADVNE-EMultiMediaOption">
                                    <div class="ADVNE-EMultimedia" id="adivinaEMultimedia">
                                        <textarea id="adivinaEText"></textarea>
                                        <img class="ADVNE-EMedia" src="${path}quextIEImage.png" id="adivinaEImage" alt="${_('Image')}" />
                                        <img class="ADVNE-EMedia" src="${path}quextIEImage.png" id="adivinaENoImage" alt="${_('No image')}" />
                                        <div class="ADVNE-EMedia" id="adivinaEVideo"></div>
                                        <video class="ADVNE-EMedia" id="adivinaEVideoLocal" preload="auto" controls></video>
                                        <img class="ADVNE-EMedia" src="${path}quextIENoImageVideo.png" id="adivinaENoImageVideo" alt="" />
                                        <img class="ADVNE-EMedia" src="${path}quextIENoVideo.png" id="adivinaENoVideo" alt="" />
                                        <img class="ADVNE-ECursor" src="${path}quextIECursor.gif" id="adivinaECursor" alt="" />
                                        <img class="ADVNE-EMedia" src="${path}quextIECoverAdivina.png" id="adivinaECover" alt="${_('No image')}" />
                                    </div>
                                </div>
                            </div>
                            <div class="ADVNE-EContents">
                                <div class="ADVNE-EWordDiv" id="adivinaEWordDiv">
                                    <div class="ADVNE-ESolutionWord">
                                        <label for="adivinaESolutionWord">${_('Word/Phrase')}: </label>
                                        <input type="text" id="adivinaESolutionWord" class="form-control"/>
                                    </div>
                                    <div class="ADVNE-ESolutionWord">
                                        <label for="adivinaEDefinitionWord">${_('Definition')}: </label>
                                        <input type="text" id="adivinaEDefinitionWord" class="form-control"/>
                                    </div>
                                </div>
                                <div class="ADVNE-EOrders" id="adivinaEOrder">
                                    <div class="ADVNE-ECustomMessage">
                                        <span class="sr-av">${_('Hit')}</span>
                                        <span class="ADVNE-EHit"></span>
                                        <label for="adivinaEMessageOK">${_('Message')}:</label>
                                        <input type="text" id="adivinaEMessageOK" class="form-control">
                                    </div>
                                    <div class="ADVNE-ECustomMessage">
                                        <span class="sr-av">${_('Error')}</span>
                                        <span class="ADVNE-EError"></span>
                                        <label for="adivinaEMessageKO">${_('Message')}:</label>
                                        <input type="text" id="adivinaEMessageKO" class="form-control">
                                    </div>
                                </div>
                                <div class="ADVNE-ENavigationButtons gap-2">
                                    <a href="#" id="adivinaEAdd" class="ADVNE-ENavigationButton" title="${_('Add question')}">
                                        <img src="${path}quextIEAdd.png" alt="${_('Add question')}" class="ADVNE-ENavigationButton b-add" />
                                    </a>
                                    <a href="#" id="adivinaEFirst" class="ADVNE-ENavigationButton" title="${_('First question')}">
                                        <img src="${path}quextIEFirst.png" alt="${_('First question')}" class="ADVNE-ENavigationButton b-first" />
                                    </a>
                                    <a href="#" id="adivinaEPrevious" class="ADVNE-ENavigationButton" title="${_('Previous question')}">
                                        <img src="${path}quextIEPrev.png" alt="${_('Previous question')}" class="ADVNE-ENavigationButton b-prev" />
                                    </a>
                                    <label class="sr-av" for="adivinaENumberQuestion">${_('Question number:')}:</label>
                                    <input type="text" class="ADVNE-NumberQuestion form-control" id="adivinaENumberQuestion" value="1"/>
                                    <a href="#" id="adivinaENext" class="ADVNE-ENavigationButton gap-2" title="${_('Next question')}">
                                        <img src="${path}quextIENext.png" alt="${_('Next question')}" class="ADVNE-ENavigationButton b-next" />
                                    </a>
                                    <a href="#" id="adivinaELast" class="ADVNE-ENavigationButton" title="${_('Last question')}">
                                        <img src="${path}quextIELast.png" alt="${_('Last question')}" class="ADVNE-ENavigationButton b-last" />
                                    </a>
                                    <a href="#" id="adivinaEDelete" class="ADVNE-ENavigationButton" title="${_('Delete question')}">
                                        <img src="${path}quextIEDelete.png" alt="${_('Delete question')}" class="ADVNE-ENavigationButton b-delete" />
                                    </a>
                                    <a href="#" id="adivinaECopy" class="ADVNE-ENavigationButton" title="${_('Copy question')}">
                                        <img src="${path}quextIECopy.png" alt="${_('Copy question')}" class="ADVNE-ENavigationButton b-copy" />
                                    </a>
                                    <a href="#" id="adivinaECut" class="ADVNE-ENavigationButton" title="${_('Cut question')}">
                                        <img src="${path}quextIECut.png" alt="${_('Cut question')}" class="ADVNE-ENavigationButton b-cut" />
                                    </a>
                                    <a href="#" id="adivinaEPaste" class="ADVNE-ENavigationButton" title="${_('Paste question')}">
                                        <img src="${path}quextIEPaste.png" alt="${_('Paste question')}" class="ADVNE-ENavigationButton b-paste" />
                                    </a>
                                </div>
                                <div class="ADVNE-ENumQuestionDiv" id="adivinaENumQuestionDiv">
                                    <div class="ADVNE-ENumQ">
                                        <span class="sr-av">${_('Number of questions:')}</span>
                                    </div>
                                    <span class="ADVNE-ENumQuestions" id="adivinaENumQuestions">0</span>
                                </div>
                            </div>
                        </div>
                    </fieldset>
                    ${$exeDevicesEdition.iDevice.common.getTextFieldset('after')}
                </div>
                ${$exeDevicesEdition.iDevice.gamification.itinerary.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.scorm.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
                ${$exeDevicesEdition.iDevice.gamification.share.getTab(true, 0, true)}
                ${$exeDevicesEdition.iDevice.gamification.share.getTabIA(0)}
            </div>
        `;

        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('gameQEIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();
        tinymce.init({
            selector: '#adivinaEText',
            height: 220,
            language: 'all',
            width: 400,
            plugins: ['code paste textcolor link'],
            paste_as_text: true,
            entity_encoding: 'raw',
            toolbar:
                'undo redo | removeformat | fontselect | formatselect | fontsizeselect |  bold italic underline |  alignleft aligncenter alignright alignjustify | forecolor backcolor | link ',
            fontsize_formats: '8pt 10pt 12pt 14pt 18pt 24pt 36pt',
            menubar: false,
            statusbar: false,
            setup: function (ed) {
                ed.on('init', function () {
                    $exeDevice.enableForm();
                });
            },
        });
    },

    getDataVideoLocal: function () {
        if ($exeDevice.videoType > 0 && $exeDevice.duration > 0) {
            $exeDevice.durationVideo = Math.floor($exeDevice.duration);
            const endVideo =
                $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                    $('adivinaEEndVideo').val()
                ) || 0;
            if (endVideo < 1) {
                $('#adivinaEEndVideo').val(
                    $exeDevices.iDevice.gamification.helpers.secondsToHour(
                        $exeDevice.durationVideo
                    )
                );
            }
        }
    },

    updateProgressBarLocal: function () {
        if ($exeDevice.localPlayer) {
            $('#progress-bar').val(
                (Math.round($exeDevice.localPlayer.currentTime) /
                    Math.round($exeDevice.localPlayer.duration)) *
                    100
            );
        }
    },

    enableForm: function () {
        this.initQuestions();

        this.loadPreviousValues();
        this.addEvents();
    },

    updateQuestionsNumber: function () {
        const percentInput = parseInt(
            $exeDevice.removeTags($('#adivinaEPercentajeQuestions').val())
        );
        if (isNaN(percentInput)) return;
        const percentaje = Math.min(Math.max(percentInput, 1), 100),
            totalWords = $exeDevice.wordsGame.length,
            num = Math.max(1, Math.round((percentaje * totalWords) / 100));

        $('#adivinaENumeroPercentaje').text(`${num}/${totalWords}`);
    },

    showQuestion: function (i) {
        const num = Math.min(Math.max(i, 0), $exeDevice.wordsGame.length - 1),
            p = $exeDevice.wordsGame[num];

        $exeDevice.stopVideo();
        $exeDevice.changeTypeQuestion(p.type);

        $('#adivinaEDefinitionWord').val(p.definition);
        $('#adivinaENumQuestions').text($exeDevice.wordsGame.length);
        $('#adivinaESolutionWord').val(p.word);
        $('#adivinaEPercentageShow').val(p.percentageShow);

        if (p.type == 1) {
            $('#adivinaEURLImage').val(p.url);
            $('#adivinaEXImage').val(p.x);
            $('#adivinaEYImage').val(p.y);
            $('#adivinaEAuthor').val(p.author);
            $('#adivinaEAlt').val(p.alt);
            $exeDevice.showImage(p.url, p.x, p.y, p.alt);
        } else if (p.type == 2) {
            $('#adivinaECheckSoundVideo').prop('checked', p.soundVideo == 1);
            $('#adivinaECheckImageVideo').prop('checked', p.imageVideo == 1);
            $('#adivinaEURLYoutube').val(p.url);
            $('#adivinaEInitVideo').val(
                $exeDevices.iDevice.gamification.helpers.secondsToHour(p.iVideo)
            );
            $('#adivinaEEndVideo').val(
                $exeDevices.iDevice.gamification.helpers.secondsToHour(p.fVideo)
            );
            $('#adivinaESilenceVideo').val(
                $exeDevices.iDevice.gamification.helpers.secondsToHour(
                    p.silentVideo
                )
            );
            $('#adivinaETimeSilence').val(p.tSilentVideo);
            $exeDevice.silentVideo = p.silentVideo;
            $exeDevice.tSilentVideo = p.tSilentVideo;
            $exeDevice.activeSilent =
                p.soundVideo == 1 &&
                p.tSilentVideo > 0 &&
                p.silentVideo >= p.iVideo &&
                p.iVideo < p.fVideo;
            $exeDevice.endSilent = p.silentVideo + p.tSilentVideo;
            if ($exeDevices.iDevice.gamification.media.getIDYoutube(p.url)) {
                if (typeof YT == 'undefined') {
                    $exeDevice.isVideoType = true;
                    $exeDevice.loadYoutubeApi();
                } else {
                    $exeDevice.showVideoQuestion();
                }
            } else if (
                $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                    p.url
                )
            ) {
                $exeDevice.showVideoQuestion();
            }
        } else if (p.type == 3) {
            tinyMCE.get('adivinaEText').setContent(unescape(p.eText));
        }

        $exeDevice.stopSound();

        if (p.type != 2 && p.audio.trim().length > 4) {
            $exeDevice.playSound(p.audio.trim());
        }

        $('#adivinaEURLAudio').val(p.audio);
        $('#adivinaENumberQuestion').val(i + 1);
        $("input.ADVNE-Type[name='qxtmediatype'][value='" + p.type + "']").prop(
            'checked',
            true
        );
        $("input.ADVNE-Times[name='qxttime'][value='" + p.time + "']").prop(
            'checked',
            true
        );
        $('#adivinaEMessageKO').val(p.msgError);
        $('#adivinaEMessageOK').val(p.msgHit);
    },

    initQuestions: function () {
        $('#adivinaEInputVideo').hide();
        $('#adivinaEInputImage').hide();
        $('#adivinaTitleImage').hide();
        $('#adivinaEMediaNormal').prop('disabled', false);
        $('#adivinaEMediaImage').prop('disabled', false);
        $('#adivinaEMediaText').prop('disabled', false);
        $('#adivinaEMediaVideo').prop('disabled', false);

        if ($exeDevice.wordsGame.length == 0) {
            const question = $exeDevice.getCuestionDefault();
            $exeDevice.wordsGame.push(question);
            this.changeTypeQuestion(0);
        }

        this.localPlayer = document.getElementById('adivinaEVideoLocal');
        this.active = 0;
    },

    changeTypeQuestion: function (type) {
        $('#adivinaETitleAltImage').hide();
        $('#adivinaEAuthorAlt').hide();
        $('#adivinaTitleImage').hide();
        $('#adivinaEInputImage').hide();
        $('#adivinaETitleAudio').show();
        $('#adivinaEInputAudio').show();
        $('#adivinaETitleInputAudio').show();
        $('#adivinaTitleVideo').hide();
        $('#adivinaEInputVideo').hide();
        $('#adivinaEInputOptionsVideo').hide();
        if (tinyMCE.get('adivinaEText')) {
            tinyMCE.get('adivinaEText').hide();
        }
        $('#adivinaEText').hide();
        $('#adivinaEVideo').hide();
        $('#adivinaEVideoLocal').hide();
        $('#adivinaEImage').hide();
        $('#adivinaENoImage').hide();
        $('#adivinaECover').hide();
        $('#adivinaECursor').hide();
        $('#adivinaENoImageVideo').hide();
        $('#adivinaENoVideo').hide();

        switch (type) {
            case 0:
                $('#adivinaECover').show();
                break;
            case 1:
                $('#adivinaENoImage').show();
                $('#adivinaETitleImage').show();
                $('#adivinaEInputImage').css('display', 'flex');
                $('#adivinaEAuthorAlt').css('display', 'flex');
                $('#adivinaECursor').show();
                $exeDevice.showImage(
                    $('#adivinaEURLImage').val(),
                    $('#adivinaEXImage').val(),
                    $('#adivinaEYImage').val(),
                    $('#adivinaEAlt').val()
                );
                break;
            case 2:
                $('#adivinaTitleVideo').show();
                $('#adivinaEInputVideo').css('display', 'flex');
                $('#adivinaENoVideo').show();
                $('#adivinaEVideo').show();
                $('#adivinaEInputOptionsVideo').show();
                $('#adivinaEInputAudio').hide();
                $('#adivinaETitleInputAudio').hide();
                break;
            case 3:
                $('#adivinaEText').show();
                if (tinyMCE.get('adivinaEText')) {
                    tinyMCE.get('adivinaEText').show();
                }
                break;
            default:
                break;
        }
    },

    loadYoutubeApi: function () {
        if (typeof YT == 'undefined') {
            onYouTubeIframeAPIReady = $exeDevice.youTubeReady;
            let tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            tag.async = true;
            let firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else {
            $exeDevice.loadPlayerYoutube();
        }
    },

    loadPlayerYoutube: function () {
        $exeDevice.player = new YT.Player('adivinaEVideo', {
            width: '100%',
            height: '100%',
            videoId: '',
            playerVars: {
                color: 'white',
                autoplay: 1,
                controls: 1,
            },
            events: {
                onReady: $exeDevice.playVideoQuestion,
                onError: $exeDevice.onPlayerError,
            },
        });
    },

    playVideoQuestion: function () {
        const urlvideo = $('#adivinaEURLYoutube').val();
        if (!urlvideo) return;
        if (
            $exeDevices.iDevice.gamification.media.getIDYoutube(urlvideo.trim())
        ) {
            $exeDevice.showVideoQuestion();
        } else if (
            $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                urlvideo.trim()
            )
        ) {
            $exeDevice.showVideoQuestion();
        }
    },

    youTubeReady: function () {
        $exeDevice.player = new YT.Player('adivinaEVideo', {
            width: '100%',
            height: '100%',
            videoId: '',
            playerVars: {
                color: 'white',
                autoplay: 1,
                controls: 1,
            },
            events: {
                onReady: $exeDevice.onPlayerReady,
                onError: $exeDevice.onPlayerError,
            },
        });
    },

    onPlayerReady: function () {
        if ($exeDevice.isVideoType) {
            $exeDevice.showVideoQuestion();
        }
    },

    updateSoundVideo: function () {
        if (
            $exeDevice.activeSilent &&
            $exeDevice.player &&
            typeof $exeDevice.player.getCurrentTime === 'function'
        ) {
            const time = Math.round($exeDevice.player.getCurrentTime());
            if (time == $exeDevice.silentVideo) {
                $exeDevice.player.mute();
            } else if (time == $exeDevice.endSilent) {
                $exeDevice.player.unMute();
            }
        }
    },

    updateSoundVideoLocal: function () {
        if (
            $exeDevice.activeSilent &&
            $exeDevice.localPlayer &&
            $exeDevice.localPlayer.currentTime
        ) {
            const time = Math.round($exeDevice.localPlayer.currentTime);
            if (time == $exeDevice.silentVideo) {
                $exeDevice.localPlayer.muted = true;
            } else if (time == $exeDevice.endSilent) {
                $exeDevice.localPlayer.muted = false;
            }
        }
    },

    updateTimerDisplayLocal: function () {
        if ($exeDevice.localPlayer && $exeDevice.localPlayer.currentTime) {
            const currentTime = $exeDevice.localPlayer.currentTime;
            const time = $exeDevices.iDevice.gamification.helpers.secondsToHour(
                Math.floor(currentTime)
            );
            $('#adivinaEVideoTime').text(time);
            $exeDevice.updateSoundVideoLocal();
            if (
                Math.ceil(currentTime) == $exeDevice.pointEnd ||
                Math.ceil(currentTime) == $exeDevice.durationVideo
            ) {
                $exeDevice.localPlayer.pause();
                $exeDevice.pointEnd = 100000;
            }
        }
    },

    updateTimerDisplay: function () {
        if (
            $exeDevice.player &&
            typeof $exeDevice.player.getCurrentTime === 'function'
        ) {
            const time = $exeDevices.iDevice.gamification.helpers.secondsToHour(
                $exeDevice.player.getCurrentTime()
            );
            $('#adivinaEVideoTime').text(time);
            $exeDevice.updateSoundVideo();
        }
    },

    updateTimerVIDisplay: function () {
        if (
            $exeDevice.playerIntro &&
            typeof $exeDevice.playerIntro.getCurrentTime === 'function'
        ) {
            const time = $exeDevices.iDevice.gamification.helpers.secondsToHour(
                $exeDevice.playerIntro.getCurrentTime()
            );
            $('adivinaEVITime').text(time);
        }
    },

    updateProgressBar: function () {
        $('#progress-bar').val(
            (player.getCurrentTime() / player.getDuration()) * 100
        );
    },

    onPlayerError: function () {
        //$exeDevice.showMessage("El video adivinaEdo no está disponible")
    },

    startVideo: function (id, start, end, type) {
        let mstart = start < 1 ? 0.1 : start;
        if (type > 0) {
            if ($exeDevice.localPlayer) {
                $exeDevice.pointEnd = end;
                $exeDevice.localPlayer.src = id;
                $exeDevice.localPlayer.currentTime = parseFloat(start);
                $exeDevice.localPlayer.play();
            }
            $('#adivinaEVideoTime').show();
            $exeDevice.clockVideo.stop();
            $exeDevice.clockVideo.start('local');
            return;
        }

        if ($exeDevice.player) {
            if (typeof $exeDevice.player.loadVideoById === 'function') {
                $exeDevice.player.loadVideoById({
                    videoId: id,
                    startSeconds: mstart,
                    endSeconds: end,
                });
            }
            $exeDevice.clockVideo.stop();
            $exeDevice.clockVideo.start('remote');
        }
    },

    clockVideo: {
        start: function (type) {
            this.type = type;
            this.intervalID = setInterval(this.update.bind(this), 1000);
        },
        update: function () {
            if (typeof $exeDevice === 'undefined') {
                clearInterval(this.intervalID);
            } else {
                if (this.type === 'local') {
                    $exeDevice.updateTimerDisplayLocal();
                } else if (this.type === 'remote') {
                    $exeDevice.updateTimerDisplay();
                }
            }
        },
        stop: function () {
            if (this.intervalID) {
                clearInterval(this.intervalID);
                this.intervalID = null;
            }
        },
    },

    stopVideo: function () {
        $exeDevice.clockVideo.stop();
        if ($exeDevice.localPlayer) {
            if (typeof $exeDevice.localPlayer.pause == 'function') {
                $exeDevice.localPlayer.pause();
            }
        }
        if ($exeDevice.player) {
            if (typeof $exeDevice.player.pauseVideo === 'function') {
                $exeDevice.player.pauseVideo();
            }
        }
    },

    muteVideo: function (mute) {
        if ($exeDevice.localPlayer) {
            if (mute) {
                $exeDevice.localPlayer.muted = true;
            } else {
                $exeDevice.localPlayer.muted = false;
            }
        }
        if ($exeDevice.player) {
            if (mute) {
                if (typeof $exeDevice.player.mute === 'function') {
                    $exeDevice.player.mute();
                }
            } else {
                if (typeof $exeDevice.player.unMute === 'function') {
                    $exeDevice.player.unMute();
                }
            }
        }
    },

    getCuestionDefault: function () {
        const p = {
            word: '',
            definition: '',
            type: 0,
            url: '',
            audio: '',
            x: 0,
            y: 0,
            author: '',
            alt: '',
            soundVideo: 1,
            imageVideo: 1,
            iVideo: 0,
            fVideo: 0,
            eText: '',
            solution: '',
            silentVideo: 0,
            tSilentVideo: 0,
            msgHit: '',
            msgError: '',
            percentageShow: 35,
            time: 0,
        };
        return p;
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            const wrapper = $('<div></div>').html(originalHTML);

            let json = $('.adivina-DataGame', wrapper).text(),
                version = $('.adivina-version', wrapper).text();

            if (version.length === 1) {
                json = $exeDevices.iDevice.gamification.helpers.decrypt(json);
            }

            const dataGame =
                    $exeDevices.iDevice.gamification.helpers.isJsonString(json),
                $imagesLink = $('.adivina-LinkImages', wrapper),
                $audiosLink = $('.adivina-LinkAudios', wrapper);

            dataGame.modeBoard =
                typeof dataGame.modeBoard === 'undefined'
                    ? false
                    : dataGame.modeBoard;
            version = version === '' ? 0 : parseInt(version, 10);

            for (let i = 0; i < dataGame.wordsGame.length; i++) {
                let p = dataGame.wordsGame[i];
                if (version < 2) {
                    p.type = p.type === 2 ? 1 : p.type;
                    p.percentageShow =
                        typeof dataGame.percentageShow === 'undefined'
                            ? 35
                            : dataGame.percentageShow;
                    p.time =
                        typeof dataGame.timeQuestion === 'undefined'
                            ? 1
                            : $exeDevice.getIndexTime(dataGame.timeQuestion);
                    p.soundVideo = 1;
                    p.imageVideo = 1;
                    p.iVideo = 0;
                    p.fVideo = 0;
                    p.silentVideo = 0;
                    p.eText = '';
                    p.audio = '';
                }
                dataGame.wordsGame[i] = p;
            }

            $imagesLink.each(function () {
                const iq = parseInt($(this).text(), 10);
                if (!isNaN(iq) && iq < dataGame.wordsGame.length) {
                    dataGame.wordsGame[iq].url = $(this).attr('href');
                    if (
                        dataGame.wordsGame[iq].url.length < 4 &&
                        dataGame.wordsGame[iq].type === 1
                    ) {
                        dataGame.wordsGame[iq].url = '';
                    }
                }
            });

            $audiosLink.each(function () {
                const iq = parseInt($(this).text(), 10);
                if (!isNaN(iq) && iq < dataGame.wordsGame.length) {
                    dataGame.wordsGame[iq].audio = $(this).attr('href');
                    if (dataGame.wordsGame[iq].audio.length < 4) {
                        dataGame.wordsGame[iq].audio = '';
                    }
                }
            });

            $exeDevice.updateFieldGame(dataGame);

            const instructions = $('.adivina-instructions', wrapper);
            if (instructions.length === 1)
                $('#eXeGameInstructions').val(instructions.html());

            const textAfter = $('.adivina-extra-content', wrapper);
            if (textAfter.length === 1)
                $('#eXeIdeviceTextAfter').val(textAfter.html());

            const textFeedBack = $('.adivina-feedback-game', wrapper);
            if (textFeedBack.length === 1)
                $('#adivinaEFeedBackEditor').val(textFeedBack.html());

            $exeDevicesEdition.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs
            );

            $exeDevice.showQuestion(0);
        }
    },

    getIndexTime: function (tm) {
        const tms = [15, 30, 60, 180, 300, 600, 900];
        let itm = tms.indexOf(tm);
        itm = itm < 0 ? 1 : itm;
        return itm;
    },

    getMediaType: function () {
        const ele = document.getElementsByName('qxtmediatype');
        for (let i = 0; i < ele.length; i++) {
            if (ele[i].checked) {
                return ele[i].value;
            }
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
        if (!$exeDevice.validateQuestion()) return false;
        const dataGame = $exeDevice.validateData();
        if (!dataGame) return false;

        $exeDevice.clockVideo.stop();

        const fields = this.ci18n,
            i18n = fields;
        for (const i in fields) {
            const fVal = $(`#ci18n_${i}`).val();
            if (fVal !== '') i18n[i] = fVal;
        }
        dataGame.msgs = i18n;

        let json = JSON.stringify(dataGame),
            divContent = '';
        json = $exeDevices.iDevice.gamification.helpers.encrypt(json);

        const textFeedBack = tinyMCE.get('adivinaEFeedBackEditor').getContent();
        if (dataGame.instructions !== '') {
            divContent = `<div class="adivina-instructions gameQP-instructions">${dataGame.instructions}</div>`;
        }

        const linksImages = $exeDevice.createlinksImage(dataGame.wordsGame),
            linksAudios = $exeDevice.createlinksAudio(dataGame.wordsGame);

        let html = '<div class="adivina-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html += `<div class="adivina-version js-hidden">${$exeDevice.version}</div>`;
        html += `<div class="adivina-feedback-game">${textFeedBack}</div>`;
        html += divContent;

        html += `<div class="adivina-DataGame js-hidden">${json}</div>`;
        html += linksImages;
        html += linksAudios;

        const textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();
        if (textAfter !== '') {
            html += `<div class="adivina-extra-content">${textAfter}</div>`;
        }
        html += `<div class="adivina-bns js-hidden">${$exeDevice.msgs.msgNoSuportBrowser}</div>`;
        html += '</div>';
        return html;
    },

    validateAlt: function () {
        const altImage = $('#adivinaEAlt').val();
        if ($exeDevice.checkAltImage) {
            if (altImage === '') {
                eXe.app.confirm(
                    $exeDevice.msgs.msgTitleAltImageWarning,
                    $exeDevice.msgs.msgAltImageWarning,
                    () => {
                        $exeDevice.checkAltImage = false;
                        const saveButton = document.getElementsByClassName(
                            'button-save-idevice'
                        )[0];
                        saveButton.click();
                    }
                );
                return false;
            } else {
                return true;
            }
        } else {
            return true;
        }
    },

    createlinksImage: function (wordsGame) {
        let html = '';
        for (let i = 0; i < wordsGame.length; i++) {
            let linkImage = '';
            if (
                wordsGame[i].type === 1 &&
                wordsGame[i].url.indexOf('http') !== 0
            ) {
                linkImage = `<a href="${wordsGame[i].url}" class="js-hidden adivina-LinkImages">${i}</a>`;
            }
            html += linkImage;
        }
        return html;
    },

    createlinksAudio: function (wordsGame) {
        let html = '';
        for (let i = 0; i < wordsGame.length; i++) {
            let linkAudio = '';
            if (
                wordsGame[i].type !== 2 &&
                wordsGame[i].audio.indexOf('http') !== 0 &&
                wordsGame[i].audio.length > 4
            ) {
                linkAudio = `<a href="${wordsGame[i].audio}" class="js-hidden adivina-LinkAudios">${i}</a>`;
            }
            html += linkAudio;
        }
        return html;
    },

    validateQuestion: function () {
        let message = '';
        const msgs = $exeDevice.msgs,
            p = {};

        p.word = $('#adivinaESolutionWord').val();
        p.definition = $('#adivinaEDefinitionWord').val();
        p.type = parseInt($('input[name=qxtmediatype]:checked').val(), 10);
        p.time = parseInt($('input[name=qxttime]:checked').val(), 10);
        p.x = parseFloat($('#adivinaEXImage').val());
        p.y = parseFloat($('#adivinaEYImage').val());
        p.author = $('#adivinaEAuthor').val();
        p.alt = $('#adivinaEAlt').val();
        p.url = $('#adivinaEURLImage').val();
        p.audio = $('#adivinaEURLAudio').val();
        p.msgHit = $('#adivinaEMessageOK').val();
        p.msgError = $('#adivinaEMessageKO').val();
        $exeDevice.stopSound();
        $exeDevice.stopVideo();

        if (p.type === 2) {
            const youtubeUrl = $('#adivinaEURLYoutube').val().trim();
            p.url = $exeDevices.iDevice.gamification.media.getIDYoutube(
                youtubeUrl
            )
                ? youtubeUrl
                : '';
            if (p.url === '') {
                p.url =
                    $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                        youtubeUrl
                    )
                        ? youtubeUrl
                        : '';
            }
        }

        p.soundVideo = $('#adivinaECheckSoundVideo').is(':checked') ? 1 : 0;
        p.imageVideo = $('#adivinaECheckImageVideo').is(':checked') ? 1 : 0;
        p.iVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
            $('#adivinaEInitVideo').val().trim()
        );
        p.fVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
            $('#adivinaEEndVideo').val().trim()
        );
        p.silentVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
            $('#adivinaESilenceVideo').val().trim()
        );
        p.tSilentVideo = parseInt($('#adivinaETimeSilence').val(), 10);
        p.eText = tinyMCE.get('adivinaEText').getContent();
        p.percentageShow = parseInt($('#adivinaEPercentageShow').val(), 10);

        if (p.word.length === 0) {
            message = msgs.msgEProvideWord;
        } else if (p.definition.length === 0 && p.type !== 1) {
            message = msgs.msgEProvideDefinition;
        } else if (p.type === 1 && p.url.length < 5) {
            message = msgs.msgEURLValid;
        } else if (p.type === 2 && p.url.length === 0) {
            message = msgs.msgECompleteURLYoutube;
        } else if (p.type === 2 && (!p.iVideo || !p.fVideo)) {
            message = msgs.msgEStartEndVideo;
        } else if (p.type === 2 && p.iVideo >= p.fVideo) {
            message = msgs.msgEStartEndIncorrect;
        } else if (p.type === 3 && p.eText.length === 0) {
            message = msgs.msgWriteText;
        } else if (
            p.type === 2 &&
            (!$exeDevice.validTime($('#adivinaEInitVideo').val()) ||
                !$exeDevice.validTime($('#adivinaEEndVideo').val()))
        ) {
            message = msgs.msgTimeFormat;
        } else if (
            p.type === 2 &&
            p.tSilentVideo > 0 &&
            !$exeDevice.validTime($('#adivinaESilenceVideo').val())
        ) {
            message = msgs.msgTimeFormat;
        } else if (
            p.type === 2 &&
            p.tSilentVideo > 0 &&
            (p.silentVideo < p.iVideo || p.silentVideo >= p.fVideo)
        ) {
            message = msgs.msgSilentPoint;
        }

        if (message.length === 0) {
            $exeDevice.wordsGame[$exeDevice.active] = p;
            return true;
        } else {
            $exeDevice.showMessage(message);
            return false;
        }
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    getIdeviceID: function () {
        const ideviceid =
            $('#gameQEIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';

        return ideviceid;
    },

    validateData: function () {
        const clear = $exeDevice.removeTags,
            instructions = tinyMCE.get('eXeGameInstructions').getContent(),
            textFeedBack = tinyMCE.get('adivinaEFeedBackEditor').getContent(),
            textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent(),
            showMinimize = $('#adivinaEShowMinimize').is(':checked'),
            optionsRamdon = $('#adivinaEOptionsRamdon').is(':checked'),
            showSolution = $('#adivinaEShowSolution').is(':checked'),
            modeBoard = $('#adivinaModeBoard').is(':checked'),
            timeShowSolution = parseInt(
                clear($('#adivinaETimeShowSolution').val())
            ),
            useLives = $('#adivinaEUseLives').is(':checked'),
            numberLives = parseInt(clear($('#adivinaENumberLives').val())),
            timeQuestion = $exeDevice.timeQuestion,
            percentageShow = 30,
            itinerary =
                $exeDevicesEdition.iDevice.gamification.itinerary.getValues(),
            caseSensitive = $('#adivinaECaseSensitive').is(':checked'),
            feedBack = $('#adivinaEHasFeedBack').is(':checked'),
            percentajeFB = parseInt(clear($('#adivinaEPercentajeFB').val())),
            gameMode = parseInt($('input[name=qxtgamemode]:checked').val()),
            customMessages = $('#adivinaECustomMessages').is(':checked'),
            percentajeQuestions = parseInt(
                clear($('#adivinaEPercentajeQuestions').val())
            ),
            activateTranslate = $('#adivinaETranslate').is(':checked'),
            evaluation = $('#adivinaEEvaluation').is(':checked'),
            evaluationID = $('#adivinaEEvaluationID').val(),
            globalTime = parseInt($('#adivinaEGlobalTimes').val(), 10),
            id = $exeDevice.getIdeviceID();

        if (!itinerary) return false;

        if (showSolution && timeShowSolution.length == 0) {
            eXe.app.alert($exeDevice.msgs.msgEProvideTimeSolution);
            return false;
        }

        if ((gameMode == 2 || feedBack) && textFeedBack.trim().length == 0) {
            eXe.app.alert($exeDevice.msgs.msgProvideFB);
            return false;
        }

        let wordsGame = $exeDevice.wordsGame;
        if (wordsGame.length == 0) {
            eXe.app.alert($exeDevice.msgs.msgEOneQuestion);

            return false;
        }
        if (evaluation && evaluationID.length < 5) {
            eXe.app.alert($exeDevice.msgs.msgIDLenght);
            return false;
        }

        if (itinerary.showClue && itinerary.clueGame.length == '') {
            return false;
        }

        if (
            itinerary.showCodeAccess &&
            (itinerary.codeAccess.length == '' ||
                itinerary.messageCodeAccess.length == '')
        ) {
            return false;
        }

        for (let i = 0; i < wordsGame.length; i++) {
            let mquestion = wordsGame[i];
            if (mquestion.word.length == 0) {
                $exeDevice.showMessage($exeDevice.msgs.msgEProvideWord);
                return false;
            } else if (
                mquestion.definition.length == 0 &&
                mquestion.url.length < 4
            ) {
                eXe.app.alert(
                    $exeDevice.msgs.msgEProvideDefinition + ' ' + mquestion.word
                );
                return false;
            } else if (mquestion.type == 1 && mquestion.url.length < 4) {
                $exeDevice.showMessage($exeDevice.msgs.msgEURLValid);
                return false;
            } else if (
                mquestion.type == 2 &&
                !$exeDevices.iDevice.gamification.media.getIDYoutube(
                    mquestion.url
                ) &&
                !$exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                    mquestion.url
                )
            ) {
                $exeDevice.showMessage($exeDevice.msgs.msgECompleteURLYoutube);
                return false;
            }
        }

        const scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();
        return {
            typeGame: 'Adivina',
            instructions: instructions,
            showMinimize: showMinimize,
            optionsRamdon: optionsRamdon,
            showSolution: showSolution,
            timeShowSolution: timeShowSolution,
            useLives: useLives,
            numberLives: numberLives,
            timeQuestion: timeQuestion,
            percentageShow: percentageShow,
            itinerary: itinerary,
            wordsGame: wordsGame,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted || 100,
            textFeedBack: escape(textFeedBack),
            textAfter: escape(textAfter),
            caseSensitive: caseSensitive,
            gameMode: gameMode,
            feedBack: feedBack,
            percentajeFB: percentajeFB,
            version: 2,
            customMessages: customMessages,
            percentajeQuestions: percentajeQuestions,
            modeBoard: modeBoard,
            activateTranslate: activateTranslate,
            evaluation: evaluation,
            evaluationID: evaluationID,
            globalTime: globalTime,
            id: id,
        };
    },

    showImage: function (url, x, y, alt) {
        const $image = $('#adivinaEImage'),
            $cursor = $('#adivinaECursor');

        $image.hide();
        $cursor.hide();
        $image.attr('alt', alt);
        $('#adivinaENoImage').show();
        url = $exeDevices.iDevice.gamification.media.extractURLGD(url);

        $image
            .prop('src', url)
            .on('load', function () {
                if (
                    !this.complete ||
                    typeof this.naturalWidth == 'undefined' ||
                    this.naturalWidth == 0
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
                    $('#adivinaENoImage').hide();
                    $exeDevice.paintMouse(this, $cursor, x, y);
                    return true;
                }
            })
            .on('error', function () {
                return false;
            });
    },

    playSound: function (selectedFile) {
        let selectFile =
            $exeDevices.iDevice.gamification.media.extractURLGD(selectedFile);
        $exeDevice.playerAudio = new Audio(selectFile);
        $exeDevice.playerAudio
            .play()
            .catch((error) => console.error('Error playing audio:', error));
    },

    stopSound() {
        if (
            $exeDevice.playerAudio &&
            typeof $exeDevice.playerAudio.pause == 'function'
        ) {
            $exeDevice.playerAudio.pause();
        }
    },

    paintMouse: function (image, cursor, x, y) {
        $(cursor).hide();
        if (x > 0 || y > 0) {
            const wI = $(image).width() > 0 ? $(image).width() : 1,
                hI = $(image).height() > 0 ? $(image).height() : 1,
                lI = $(image).position().left + wI * x,
                tI = $(image).position().top + hI * y;
            $(cursor).css({
                left: lI + 'px',
                top: tI + 'px',
                'z-index': 3,
            });
            $(cursor).show();
        }
    },

    drawImage: function (image, mData) {
        $(image).css({
            left: mData.x + 'px',
            top: mData.y + 'px',
            width: mData.w + 'px',
            height: mData.h + 'px',
        });
    },

    addEvents: function () {
        $('#adivinaEPaste').hide();

        $('#gameQEIdeviceForm').on(
            'click.guess.toggle',
            '.toggle-item',
            function (e) {
                if ($(e.target).is('input.toggle-input, label[for]')) return;
                if (
                    $(e.target).is('#adivinaEEvaluationID') ||
                    $(e.target).closest('#adivinaEEvaluationHelpLnk').length
                )
                    return;
                const $input = $(this).find('input.toggle-input').first();
                if ($input.length) {
                    const newVal = !$input.prop('checked');
                    $input.prop('checked', newVal).trigger('change');
                }
            }
        );

        $('#gameQEIdeviceForm').on(
            'click',
            '#adivinaEEvaluationID',
            function (e) {
                e.stopPropagation();
            }
        );
        $('#gameQEIdeviceForm').on(
            'click',
            '#adivinaEEvaluationHelpLnk, #adivinaEEvaluationHelpLnk *',
            function (e) {
                e.stopPropagation();
            }
        );

        $('#adivinaEInitVideo, #adivinaEEndVideo, #adivinaESilenceVideo').on(
            'focusout',
            function () {
                if (!$exeDevice.validTime(this.value)) {
                    $(this).css({
                        'background-color': 'red',
                        color: 'white',
                    });
                }
            }
        );

        $('#adivinaEInitVideo, #adivinaEEndVideo, #adivinaESilenceVideo').on(
            'click',
            function () {
                $(this).css({
                    'background-color': 'white',
                    color: '#2c6d2c',
                });
            }
        );

        $('.ADVNE-EPanel').on('click', 'input.ADVNE-Type', (e) => {
            const type = parseInt($(e.target).val(), 10);
            $exeDevice.changeTypeQuestion(type);
        });

        $('#adivinaEAdd').on('click', (e) => {
            e.preventDefault();
            $exeDevice.addQuestion();
        });

        $('#adivinaEFirst').on('click', (e) => {
            e.preventDefault();
            $exeDevice.firstQuestion();
        });

        $('#adivinaEPrevious').on('click', (e) => {
            e.preventDefault();
            $exeDevice.previousQuestion();
        });

        $('#adivinaENext').on('click', (e) => {
            e.preventDefault();
            $exeDevice.nextQuestion();
        });

        $('#adivinaELast').on('click', (e) => {
            e.preventDefault();
            $exeDevice.lastQuestion();
        });

        $('#adivinaEDelete').on('click', (e) => {
            e.preventDefault();
            $exeDevice.removeQuestion();
        });

        $('#adivinaECopy').on('click', (e) => {
            e.preventDefault();
            $exeDevice.copyQuestion();
        });

        $('#adivinaECut').on('click', (e) => {
            e.preventDefault();
            $exeDevice.cutQuestion();
        });

        $('#adivinaEPaste').on('click', (e) => {
            e.preventDefault();
            $exeDevice.pasteQuestion();
        });

        $('#adivinaEPlayVideo').on('click', (e) => {
            e.preventDefault();
            const youtubeUrl = $('#adivinaEURLYoutube').val().trim();
            if (
                $exeDevices.iDevice.gamification.media.getIDYoutube(youtubeUrl)
            ) {
                if (typeof YT === 'undefined') {
                    $exeDevice.isVideoType = true;
                    $exeDevice.loadYoutubeApi();
                } else {
                    $exeDevice.showVideoQuestion();
                }
            } else if (
                $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                    youtubeUrl
                )
            ) {
                $exeDevice.showVideoQuestion();
            } else {
                $exeDevice.showMessage($exeDevice.msgs.msgECompleteURLYoutube);
            }
        });

        $('#adivinaEPlayAudio').on('click', (e) => {
            e.preventDefault();
            const selectedFile = $('#adivinaEURLAudio').val().trim();
            if (selectedFile.length > 4) {
                $exeDevice.stopSound();
                $exeDevice.playSound(selectedFile);
            }
        });

        $('#adivinaECheckSoundVideo').on('change', () => {
            const youtubeUrl = $('#adivinaEURLYoutube').val().trim();
            if (typeof YT === 'undefined') {
                $exeDevice.isVideoType = true;
                $exeDevice.loadYoutubeApi();
            } else {
                $exeDevice.showVideoQuestion();
            }
        });

        $('#adivinaECheckImageVideo').on('change', () => {
            const youtubeUrl = $('#adivinaEURLYoutube').val().trim();
            if (typeof YT === 'undefined') {
                $exeDevice.isVideoType = true;
                $exeDevice.loadYoutubeApi();
            } else {
                $exeDevice.showVideoQuestion();
            }
        });

        $('#adivinaEUseLives').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#adivinaENumberLives').prop('disabled', !marcado);
        });

        $('#adivinaEShowSolution').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#adivinaETimeShowSolution').prop('disabled', !marcado);
        });

        $('#adivinaETimeQuestion')
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 3);
                this.value = v;
            })
            .on('focusout', function () {
                let value =
                    this.value.trim() === '' ? 30 : parseInt(this.value, 10);
                value = Math.max(1, Math.min(value, 600));
                this.value = value;
            });

        $('#adivinaENumberLives')
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 1);
                this.value = v;
            })
            .on('focusout', function () {
                let value =
                    this.value.trim() === '' ? 3 : parseInt(this.value, 10);
                value = Math.max(1, Math.min(value, 5));
                this.value = value;
            });

        $('#adivinaETimeShowSolution')
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 1);
                this.value = v;
            })
            .on('focusout', function () {
                let value =
                    this.value.trim() === '' ? 3 : parseInt(this.value, 10);
                value = Math.max(1, Math.min(value, 9));
                this.value = value;
            });

        $('#adivinaEPercentageShow')
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 3);
                this.value = v;
            })
            .on('focusout', function () {
                let value =
                    this.value.trim() === '' ? 35 : parseInt(this.value, 10);
                value = Math.max(0, Math.min(value, 100));
                this.value = value;
            });

        $('#adivinaGlobalTimeButton').on('click', function (e) {
            e.preventDefault();
            const selectedTime = parseInt($('#adivinaEGlobalTimes').val(), 10);

            for (let i = 0; i < $exeDevice.wordsGame.length; i++) {
                $exeDevice.wordsGame[i].time = selectedTime;
            }

            $(
                "input.ADVNE-Times[name='qxttime'][value='" +
                    selectedTime +
                    "']"
            ).prop('checked', true);
        });

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
            $('#eXeGameImportGame').on('change', (e) => {
                const file = e.target.files[0];
                if (!file) {
                    eXe.app.alert(
                        _(
                            'Please select a text file (.txt) or a Moodle XML file (.xml)'
                        )
                    );
                    return;
                }
                if (
                    !file.type ||
                    !(
                        file.type.match('text/plain') ||
                        file.type.match('application/json') ||
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
                reader.onload = (e) => {
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

        $('#adivinaEInitVideo').css('color', '#2c6d2c');
        $('#adivinaEInitVideo').on('click', (e) => {
            e.preventDefault();
            $exeDevice.timeVideoFocus = 0;
            $('#adivinaEInitVideo').css('color', '#2c6d2c');
            $('#adivinaEEndVideo, #adivinaESilenceVideo').css('color', '#333');
        });

        $('#adivinaEEndVideo').on('click', (e) => {
            e.preventDefault();
            $exeDevice.timeVideoFocus = 1;
            $('#adivinaEEndVideo').css('color', '#2c6d2c');
            $('#adivinaEInitVideo, #adivinaESilenceVideo').css('color', '#333');
        });

        $('#adivinaESilenceVideo').on('click', (e) => {
            e.preventDefault();
            $exeDevice.timeVideoFocus = 2;
            $('#adivinaESilenceVideo').css('color', '#2c6d2c');
            $('#adivinaEInitVideo, #adivinaEEndVideo').css('color', '#333');
        });

        $('#adivinaEVideoTime').on('click', (e) => {
            e.preventDefault();
            let $timeV;
            switch ($exeDevice.timeVideoFocus) {
                case 0:
                    $timeV = $('#adivinaEInitVideo');
                    break;
                case 1:
                    $timeV = $('#adivinaEEndVideo');
                    break;
                case 2:
                    $timeV = $('#adivinaESilenceVideo');
                    break;
                default:
                    break;
            }
            if ($timeV) {
                $timeV.val($('#adivinaEVideoTime').text());
                $timeV.css({
                    'background-color': 'white',
                    color: '#2c6d2c',
                });
            }
        });

        $('#adivinaEURLImage').on('change', function () {
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $(this).val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (
                (selectedFile.startsWith('files') ||
                    selectedFile.startsWith('/previews/')) &&
                !validExt.includes(ext)
            ) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: jpg, jpeg, gif, png, svg, webp`
                );
                return false;
            }
            const url = selectedFile,
                alt = $('#adivinaEAlt').val(),
                x = parseFloat($('#adivinaEXImage').val()),
                y = parseFloat($('#adivinaEYImage').val());
            $exeDevice.showImage(url, x, y, alt);
        });

        $('#adivinaEPlayImage').on('click', (e) => {
            e.preventDefault();
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $('#adivinaEURLImage').val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (selectedFile.startsWith('files') && !validExt.includes(ext)) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: jpg, jpeg, gif, png, svg, webp`
                );
                return false;
            }
            const url = selectedFile,
                alt = $('#adivinaEAlt').val(),
                x = parseFloat($('#adivinaEXImage').val()),
                y = parseFloat($('#adivinaEYImage').val());
            $exeDevice.showImage(url, x, y, alt);
        });

        $('#adivinaEImage').on('click', function (e) {
            $exeDevice.clickImage(this, e.pageX, e.pageY);
        });

        $('#adivinaECursor').on('click', () => {
            $('#adivinaECursor').hide();
            $('#adivinaEXImage, #adivinaEYImage').val(0);
        });

        $('#adivinaEURLAudio').on('change', function () {
            const selectedFile = $(this).val().trim();
            if (selectedFile.length === 0) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: mp3, ogg, wav`
                );
            } else if (selectedFile.length > 4) {
                $exeDevice.stopSound();
                $exeDevice.playSound(selectedFile);
            }
        });

        $('#adivinaEHasFeedBack').on('change', function () {
            const marcado = $(this).is(':checked');
            if (marcado) {
                $('#adivinaEFeedbackP').slideDown();
            } else {
                $('#adivinaEFeedbackP').slideUp();
            }
            $('#adivinaEPercentajeFB').prop('disabled', !marcado);
        });

        $('#gameQEIdeviceForm').on('click', 'input.ADVNE-TypeGame', (e) => {
            const gm = parseInt($(e.target).val(), 10);
            const fb = $('#adivinaEHasFeedBack').is(':checked');
            const ul = $('#adivinaEUseLives').is(':checked');
            $exeDevice.updateGameMode(gm, fb, ul);
        });

        $('#adivinaEGameModeHelpLnk').click((e) => {
            e.preventDefault();
            $('#adivinaEGameModeHelp').toggle();
        });

        $('#adivinaECustomMessages').on('change', function () {
            const messages = $(this).is(':checked');
            $exeDevice.showSelectOrder(messages);
        });

        $('#adivinaEPercentajeQuestions')
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 3);
                this.value = v;
                if (this.value > 0 && this.value <= 100) {
                    $exeDevice.updateQuestionsNumber();
                }
            })
            .on('click', () => {
                $exeDevice.updateQuestionsNumber();
            })
            .on('focusout', function () {
                let value =
                    this.value.trim() === '' ? 100 : parseInt(this.value, 10);
                value = Math.max(1, Math.min(value, 100));
                this.value = value;
                $exeDevice.updateQuestionsNumber();
            });

        $('#adivinaENumberQuestion').on('keyup', function (e) {
            if (e.keyCode === 13) {
                const num = parseInt($(this).val(), 10);
                if (!isNaN(num) && num > 0) {
                    if ($exeDevice.validateQuestion()) {
                        $exeDevice.active =
                            num < $exeDevice.wordsGame.length
                                ? num - 1
                                : $exeDevice.wordsGame.length - 1;
                        $exeDevice.showQuestion($exeDevice.active);
                    } else {
                        $(this).val($exeDevice.active + 1);
                    }
                } else {
                    $(this).val($exeDevice.active + 1);
                }
            }
        });

        $('#adivinaEEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#adivinaEEvaluationID').prop('disabled', !marcado);
        });

        $('#adivinaEEvaluationHelpLnk').click((e) => {
            e.preventDefault();
            $('#adivinaEEvaluationHelp').toggle();
        });

        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();
        $exeDevicesEdition.iDevice.gamification.share.addEvents(
            0,
            $exeDevice.insertWords
        );

        $exeDevice.loadYoutubeApi();
        //eXe 3.0 Dismissible messages
        $('.exe-block-dismissible .exe-block-close').click(function () {
            $(this).parent().fadeOut();
        });
    },

    exportQuestions: function () {
        const dataGame = this.validateData();
        if (!dataGame) return false;

        const lines = this.getLinesQuestions(dataGame.wordsGame);
        const fileContent = lines.join('\n');
        const newBlob = new Blob([fileContent], { type: 'text/plain' });
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveOrOpenBlob(newBlob);
            return;
        }
        const data = window.URL.createObjectURL(newBlob);
        const link = document.createElement('a');
        link.href = data;
        link.download = `${_('Guess')}.txt`;

        document.getElementById('gameQEIdeviceForm').appendChild(link);
        link.click();
        setTimeout(() => {
            document.getElementById('gameQEIdeviceForm').removeChild(link);
            window.URL.revokeObjectURL(data);
        }, 100);
    },

    getLinesQuestions: function (words) {
        let lineswords = [];
        for (let i = 0; i < words.length; i++) {
            let word = `${words[i].word}#${words[i].definition}`;
            lineswords.push(word);
        }
        return lineswords;
    },

    showSelectOrder: function (messages) {
        if (messages) {
            $('.ADVNE-EOrders').slideDown();
        } else {
            $('.ADVNE-EOrders').slideUp();
        }
    },

    updateGameMode: function (gamemode, feedback, useLives) {
        $('#adivinaEUseLives, #adivinaENumberLives').prop('disabled', true);
        gamemode = parseInt(gamemode, 10);
        $('#adivinaEPercentajeFB').prop(
            'disabled',
            !feedback && gamemode !== 2
        );
        $('#adivinaEHasFeedBack')
            .prop('disabled', gamemode === 2)
            .prop('checked', feedback);

        if (gamemode === 2 || feedback) {
            $('#adivinaEFeedbackP').slideDown();
        } else if (gamemode !== 2 && !feedback) {
            $('#adivinaEFeedbackP').slideUp();
        }

        if (gamemode === 0) {
            $('#adivinaEUseLives').prop('disabled', false);
            $('#adivinaENumberLives').prop('disabled', !useLives);
        }
    },

    showVideoQuestion: function () {
        let soundVideo = $('#adivinaECheckSoundVideo').is(':checked') ? 1 : 0,
            imageVideo = $('#adivinaECheckImageVideo').is(':checked') ? 1 : 0,
            iVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                $('#adivinaEInitVideo').val()
            ),
            fVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                $('#adivinaEEndVideo').val()
            ),
            url = $('#adivinaEURLYoutube').val().trim(),
            id = $exeDevices.iDevice.gamification.media.getIDYoutube(url),
            idLocal =
                $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                    url
                ),
            type = id ? 0 : 1;

        $exeDevice.silentVideo =
            $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                $('#adivinaESilenceVideo').val().trim()
            );
        $exeDevice.tSilentVideo = parseInt($('#adivinaETimeSilence').val(), 10);
        $exeDevice.activeSilent =
            soundVideo === 1 &&
            $exeDevice.tSilentVideo > 0 &&
            $exeDevice.silentVideo >= iVideo &&
            iVideo < fVideo;
        $exeDevice.endSilent = $exeDevice.silentVideo + $exeDevice.tSilentVideo;

        if (fVideo <= iVideo) fVideo = 36000;

        $('#adivinaENoImageVideo, #adivinaEVideo, #adivinaEVideoLocal').hide();
        $('#adivinaENoVideo').show();

        if (id || idLocal) {
            if (id) {
                $exeDevice.startVideo(id, iVideo, fVideo, 0);
            } else {
                $exeDevice.startVideo(idLocal, iVideo, fVideo, 1);
            }
            $('#adivinaENoVideo').hide();
            if (imageVideo === 0) {
                $('#adivinaENoImageVideo').show();
            } else {
                type === 0
                    ? $('#adivinaEVideo').show()
                    : $('#adivinaEVideoLocal').show();
            }
            $exeDevice.muteVideo(soundVideo === 0);
        } else {
            $exeDevice.showMessage(_('This video is not available'));
            $('#adivinaENoVideo').show();
        }
    },

    clearQuestion: function () {
        $exeDevice.changeTypeQuestion(0);
        $('.ADVNE-Type')[0].checked = true;
        $('.ADVNE-Times')[0].checked = true;

        const fieldsToClear = [
            '#adivinaEURLImage',
            '#adivinaEAuthor',
            '#adivinaEAlt',
            '#adivinaEURLYoutube',
            '#adivinaEDefinitionWord',
            '#adivinaESolutionWord',
            '#adivinaEURLAudio',
        ];
        fieldsToClear.forEach((selector) => $(selector).val(''));

        $('#adivinaEXImage, #adivinaEYImage').val('0');
        $('#adivinaEInitVideo, #adivinaEEndVideo').val('00:00:00');
        $('#adivinaECheckSoundVideo, #adivinaECheckImageVideo').prop(
            'checked',
            true
        );
        tinyMCE.get('adivinaEText').setContent('');
    },

    addQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.clearQuestion();
            $exeDevice.wordsGame.push($exeDevice.getCuestionDefault());
            $exeDevice.active = $exeDevice.wordsGame.length - 1;

            $('#adivinaENumberQuestion').val($exeDevice.wordsGame.length);
            $exeDevice.typeEdit = -1;

            $('#adivinaEPaste').hide();
            $('#adivinaENumQuestions').text($exeDevice.wordsGame.length);
            $exeDevice.updateQuestionsNumber();
        }
    },

    removeQuestion: function () {
        if ($exeDevice.wordsGame.length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
        } else {
            $exeDevice.wordsGame.splice($exeDevice.active, 1);
            $exeDevice.active = Math.min(
                $exeDevice.active,
                $exeDevice.wordsGame.length - 1
            );
            $exeDevice.showQuestion($exeDevice.active);
            $exeDevice.typeEdit = -1;
            $('#adivinaEPaste').hide();
            $('#adivinaENumQuestions').text($exeDevice.wordsGame.length);
            $('#adivinaENumberQuestion').val($exeDevice.active + 1);
            $exeDevice.updateQuestionsNumber();
        }
    },

    copyQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.typeEdit = 0;
            $exeDevice.clipBoard = JSON.parse(
                JSON.stringify($exeDevice.wordsGame[$exeDevice.active])
            );
            $('#adivinaEPaste').show();
        }
    },

    cutQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.numberCutCuestion = $exeDevice.active;
            $exeDevice.typeEdit = 1;
            $('#adivinaEPaste').show();
        }
    },

    pasteQuestion: function () {
        if ($exeDevice.typeEdit === 0) {
            $exeDevice.active++;
            $exeDevice.wordsGame.splice(
                $exeDevice.active,
                0,
                $exeDevice.clipBoard
            );
            $exeDevice.showQuestion($exeDevice.active);
        } else if ($exeDevice.typeEdit === 1) {
            $('#adivinaEPaste').hide();
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                $exeDevice.wordsGame,
                $exeDevice.numberCutCuestion,
                $exeDevice.active
            );
            $exeDevice.showQuestion($exeDevice.active);
            $('#adivinaENumQuestions').text($exeDevice.wordsGame.length);
            $exeDevice.updateQuestionsNumber();
        }
    },

    nextQuestion: function () {
        if (
            $exeDevice.validateQuestion() &&
            $exeDevice.active < $exeDevice.wordsGame.length - 1
        ) {
            $exeDevice.active++;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    lastQuestion: function () {
        if (
            $exeDevice.validateQuestion() &&
            $exeDevice.active < $exeDevice.wordsGame.length - 1
        ) {
            $exeDevice.active = $exeDevice.wordsGame.length - 1;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    previousQuestion: function () {
        if ($exeDevice.validateQuestion() && $exeDevice.active > 0) {
            $exeDevice.active--;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    firstQuestion: function () {
        if ($exeDevice.validateQuestion() && $exeDevice.active > 0) {
            $exeDevice.active = 0;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    updateFieldGame: function (game) {
        $exeDevice.active = 0;
        $exeDevicesEdition.iDevice.gamification.itinerary.setValues(
            game.itinerary
        );
        const defaultValues = {
            percentajeFB: 100,
            gameMode: 0,
            feedBack: false,
            customMessages: false,
            percentajeQuestions: 100,
            activateTranslate: false,
            evaluation: false,
            evaluationID: '',
            timeQuestion: $exeDevice.timeQuestion,
            percentageShow: $exeDevice.percentageShow,
            globalTime: 0,
            id: false,
        };

        game.percentajeFB =
            typeof game.percentajeFB !== 'undefined'
                ? game.percentajeFB
                : defaultValues.percentajeFB;
        game.gameMode =
            typeof game.gameMode !== 'undefined'
                ? game.gameMode
                : defaultValues.gameMode;
        game.feedBack =
            typeof game.feedBack !== 'undefined'
                ? game.feedBack
                : defaultValues.feedBack;
        game.customMessages =
            typeof game.customMessages !== 'undefined'
                ? game.customMessages
                : defaultValues.customMessages;
        game.percentajeQuestions =
            typeof game.percentajeQuestions !== 'undefined'
                ? game.percentajeQuestions
                : defaultValues.percentajeQuestions;
        game.activateTranslate =
            typeof game.activateTranslate !== 'undefined'
                ? game.activateTranslate
                : defaultValues.activateTranslate;
        game.evaluation =
            typeof game.evaluation !== 'undefined'
                ? game.evaluation
                : defaultValues.evaluation;
        game.evaluationID =
            typeof game.evaluationID !== 'undefined'
                ? game.evaluationID
                : defaultValues.evaluationID;
        game.weighted =
            typeof game.weighted !== 'undefined' ? game.weighted : 100;
        game.globalTime =
            typeof game.globalTime !== 'undefined'
                ? game.globalTime
                : defaultValues.globalTime;
        $exeDevice.timeQuestion =
            typeof game.timeQuestion !== 'undefined'
                ? game.timeQuestion
                : defaultValues.timeQuestion;
        $exeDevice.percentageShow =
            typeof game.percentageShow !== 'undefined'
                ? game.percentageShow
                : defaultValues.percentageShow;
        $exeDevice.id = $exeDevice.getIdeviceID();
        game.timeQuestion = $exeDevice.timeQuestion;
        game.percentageShow = $exeDevice.percentageShow;

        $('#adivinaEShowMinimize').prop('checked', game.showMinimize);
        $('#adivinaEOptionsRamdon').prop('checked', game.optionsRamdon);
        $('#adivinaEUseLives').prop('checked', game.useLives);
        $('#adivinaENumberLives').val(game.numberLives);
        $('#adivinaEShowSolution').prop('checked', game.showSolution);
        $('#adivinaModeBoard').prop('checked', game.modeBoard);
        $('#adivinaETimeShowSolution')
            .val(game.timeShowSolution)
            .prop('disabled', !game.showSolution);
        $('#adivinaECaseSensitive').prop('checked', game.caseSensitive);
        $('#adivinaEHasFeedBack').prop('checked', game.feedBack);
        $('#adivinaEPercentajeFB').val(game.percentajeFB);
        $('#adivinaEGlobalTimes').val(game.globalTime);
        $(
            `input.ADVNE-TypeGame[name='qxtgamemode'][value='${game.gameMode}']`
        ).prop('checked', true);
        $('#adivinaEUseLives').prop('disabled', game.gameMode === 0);
        $('#adivinaENumberLives').prop(
            'disabled',
            game.gameMode === 0 && game.useLives
        );
        $('#adivinaECustomMessages').prop('checked', game.customMessages);
        $('#adivinaETranslate').prop('checked', game.activateTranslate);
        $('#adivinaEPercentajeQuestions').val(game.percentajeQuestions);
        $('#adivinaEEvaluation').prop('checked', game.evaluation);
        $('#adivinaEEvaluationID')
            .val(game.evaluationID)
            .prop('disabled', !game.evaluation);

        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted
        );

        $exeDevice.updateGameMode(game.gameMode, game.feedBack, game.useLives);
        $exeDevice.showSelectOrder(game.customMessages);

        const version = typeof game.version !== 'undefined' ? game.version : 0;

        for (let i = 0; i < game.wordsGame.length; i++) {
            let p = game.wordsGame[i];

            if (version < 2) {
                p.type = p.type === 2 ? 1 : p.type;
            }
            p.soundVideo =
                typeof p.soundVideo !== 'undefined' ? p.soundVideo : 1;
            p.imageVideo =
                typeof p.imageVideo !== 'undefined' ? p.imageVideo : 1;
            p.iVideo = typeof p.iVideo !== 'undefined' ? p.iVideo : 0;
            p.fVideo = typeof p.fVideo !== 'undefined' ? p.fVideo : 0;
            p.silentVideo =
                typeof p.silentVideo !== 'undefined' ? p.silentVideo : 0;
            p.eText = typeof p.eText !== 'undefined' ? p.eText : '';
            p.percentageShow =
                typeof p.percentageShow !== 'undefined' ? p.percentageShow : 35;
            p.time =
                typeof p.time !== 'undefined'
                    ? p.time
                    : $exeDevice.getIndexTime(game.timeQuestion);
            p.audio = typeof p.audio !== 'undefined' ? p.audio : '';
            p.hit = typeof p.hit !== 'undefined' ? p.hit : -1;
            p.error = typeof p.error !== 'undefined' ? p.error : -1;
            p.msgHit = typeof p.msgHit !== 'undefined' ? p.msgHit : '';
            p.msgError = typeof p.msgError !== 'undefined' ? p.msgError : '';
            p.time = p.time < 0 ? 0 : p.time;

            game.wordsGame[i] = p;
        }

        $exeDevice.wordsGame = game.wordsGame;

        if (game.feedBack || game.gameMode === 2) {
            $('#adivinaEFeedbackP').show();
        } else {
            $('#adivinaEFeedbackP').hide();
        }
        $('#adivinaEPercentajeFB').prop('disabled', !game.feedBack);
        $exeDevice.updateQuestionsNumber();
    },

    deleteEmptyQuestion: function () {
        if ($exeDevice.wordsGame.length > 1) {
            const question = $('#adivinaESolutionWord').val().trim();
            if (question.length === 0) {
                $exeDevice.removeQuestion();
            }
        }
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
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
            return;
        } else if (game.typeGame === 'Adivina') {
            game.id = $exeDevice.getIdeviceID();
            $exeDevice.updateFieldGame(game);
            const instructions =
                    game.instructionsExe || game.instructions || '',
                tAfter = game.textAfter || '',
                textFeedBack = game.textFeedBack || '';
            if (tinyMCE.get('eXeGameInstructions')) {
                tinyMCE
                    .get('eXeGameInstructions')
                    .setContent(unescape(instructions));
            } else {
                $('#eXeGameInstructions').val(unescape(instructions));
            }
            if (tinyMCE.get('eXeIdeviceTextAfter')) {
                tinyMCE.get('eXeIdeviceTextAfter').setContent(unescape(tAfter));
            } else {
                $('#eXeIdeviceTextAfter').val(unescape(tAfter));
            }
            if (tinyMCE.get('adivinaEFeedBackEditor')) {
                tinyMCE
                    .get('adivinaEFeedBackEditor')
                    .setContent(unescape(textFeedBack));
            } else {
                $('#adivinaEFeedBackEditor').val(unescape(textFeedBack));
            }
        } else {
            eXe.app.alert($exeDevice.msgs.msgESelectFile);
            return;
        }

        $exeDevice.active = 0;
        $exeDevice.showQuestion($exeDevice.active);
        $exeDevice.deleteEmptyQuestion();
        $exeDevice.updateQuestionsNumber();
        //$('.exe-form-tabs li:first-child a').click();
    },

    importText: function (content) {
        const lines = content.split('\n');
        $exeDevice.insertWords(lines);
    },

    insertWords: function (lines) {
        const lineFormat = /^([^#]+)#([^#]+)(#([^#]+))?(#([^#]+))?$/;
        let words = [];
        lines.forEach((line) => {
            if (lineFormat.test(line)) {
                const p = $exeDevice.getCuestionDefault();
                const parts = line.split('#');
                p.word = parts[0];
                p.definition = parts[1];
                if (p.word && p.definition) {
                    words.push(p);
                }
            }
        });
        $exeDevice.addWords(words);
    },

    importMoodle: function (xmlString) {
        const xmlDoc = $.parseXML(xmlString),
            $xml = $(xmlDoc);
        if ($xml.find('GLOSSARY').length > 0) {
            $exeDevice.importGlosary(xmlString);
        } else if ($xml.find('quiz').length > 0) {
            $exeDevice.importCuestionaryXML(xmlString);
        } else {
            eXe.app.alert(_('Sorry, wrong file format'));
        }
    },

    importGlosary: function (xmlText) {
        const parser = new DOMParser(),
            xmlDoc = parser.parseFromString(xmlText, 'text/xml'),
            $xml = $(xmlDoc);

        if ($xml.find('parsererror').length > 0) return false;

        const $entries = $xml.find('ENTRIES').first();
        if ($entries.length === 0) return false;

        const words = [];
        $entries.find('ENTRY').each(function () {
            const concept = $(this).find('CONCEPT').text(),
                definition = $(this)
                    .find('DEFINITION')
                    .text()
                    .replace(/<[^>]*>/g, '');
            if (concept && definition) {
                let wd = {
                    word: concept,
                    definition: definition,
                };
                words.push(wd);
            }
        });
        $exeDevice.addWords(words);
    },

    importCuestionaryXML: function (xmlText) {
        const parser = new DOMParser(),
            xmlDoc = parser.parseFromString(xmlText, 'text/xml'),
            $xml = $(xmlDoc);

        if ($xml.find('parsererror').length > 0) {
            return false;
        }

        const $quiz = $xml.find('quiz').first();
        if ($quiz.length === 0) {
            return false;
        }

        const words = [];
        $quiz.find('question').each(function () {
            const $question = $(this),
                type = $question.attr('type');
            if (type !== 'shortanswer') {
                return true;
            }
            const questionText = $question
                    .find('questiontext')
                    .first()
                    .text()
                    .trim(),
                $answers = $question.find('answer');
            let word = '',
                maxFraction = -1;

            $answers.each(function () {
                const $answer = $(this),
                    answerText = $answer.find('text').eq(0).text(),
                    currentFraction = parseInt($answer.attr('fraction'), 10);
                if (currentFraction > maxFraction) {
                    maxFraction = currentFraction;
                    word = answerText;
                }
            });
            if (word && questionText) {
                let wd = {
                    word: $exeDevice.removeTags(word),
                    definition: $exeDevice.removeTags(questionText),
                };
                words.push(wd);
            }
        });
        $exeDevice.addWords(words);
    },

    addWords: function (words) {
        if (!words || words.length == 0) {
            eXe.app.alert(
                _('Sorry, there are no questions for this type of activity.')
            );
            return;
        }
        const wordsGame = $exeDevice.wordsGame;
        for (let i = 0; i < words.length; i++) {
            let p = $exeDevice.getCuestionDefault();
            let word = words[i];
            if (word.word && word.definition) {
                p.word = word.word;
                p.definition = word.definition;
                wordsGame.push(p);
            }
        }
        $exeDevice.wordsGame = wordsGame;
        $exeDevice.active = 0;
        $exeDevice.showQuestion($exeDevice.active);
        $exeDevice.deleteEmptyQuestion();
        $exeDevice.updateQuestionsNumber();
        //$('.exe-form-tabs li:first-child a').click();
    },

    importAdivina: function (game) {
        const wordsGame = $exeDevice.wordsGame;

        for (let i = 0; i < game.wordsGame.length; i++) {
            const p = game.wordsGame[i];
            p.percentageShow =
                typeof game.percentageShow !== 'undefined'
                    ? game.percentageShow
                    : 35;
            p.time = typeof p.time !== 'undefined' ? p.time : 1;
            p.audio = typeof p.audio !== 'undefined' ? p.audio : '';
            p.hit = typeof p.hit !== 'undefined' ? p.hit : -1;
            p.error = typeof p.error !== 'undefined' ? p.error : -1;
            p.msgHit = typeof p.msgHit !== 'undefined' ? p.msgHit : '';
            p.msgError = typeof p.msgError !== 'undefined' ? p.msgError : '';
            wordsGame.push(p);
        }
        return wordsGame;
    },

    validTime: function (time) {
        const reg = /^(?:(?:([01]?\d|2[0-3]):)?([0-5]?\d):)?([0-5]?\d)$/;
        return time.length === 8 && reg.test(time);
    },

    placeImageWindows: function (image, naturalWidth, naturalHeight) {
        const $parent = $(image).parent(),
            wDiv = $parent.width() || 1,
            hDiv = $parent.height() || 1,
            varW = naturalWidth / wDiv,
            varH = naturalHeight / hDiv;

        let wImage = wDiv,
            hImage = hDiv,
            xImagen = 0,
            yImagen = 0;

        if (varW > varH) {
            wImage = parseInt(wDiv, 10);
            hImage = parseInt(naturalHeight / varW, 10);
            yImagen = parseInt((hDiv - hImage) / 2, 10);
        } else {
            wImage = parseInt(naturalWidth / varH, 10);
            hImage = parseInt(hDiv, 10);
            xImagen = parseInt((wDiv - wImage) / 2, 10);
        }
        return {
            w: wImage,
            h: hImage,
            x: xImagen,
            y: yImagen,
        };
    },

    clickImage: function (img, epx, epy) {
        const $cursor = $('#adivinaECursor'),
            $x = $('#adivinaEXImage'),
            $y = $('#adivinaEYImage'),
            $img = $(img),
            posX = epx - $img.offset().left,
            posY = epy - $img.offset().top,
            wI = $img.width() || 1,
            hI = $img.height() || 1,
            lI = $img.position().left,
            tI = $img.position().top;

        $x.val(posX / wI);
        $y.val(posY / hI);
        $cursor.css({
            left: posX + lI,
            top: posY + tI,
            'z-index': 3,
        });
        $cursor.show();
    },

    removeTags: function (str) {
        return $('<div>').html(str).text();
    },
};
