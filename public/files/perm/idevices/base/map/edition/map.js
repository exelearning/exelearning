/* eslint-disable no-undef */
/**
/**
 * Mapa Activity iDevice (edition code)
 * Version: 1
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narvaez Martinez
 * Graphic design: Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    i18n: {
        category: _('Information and presentation'),
        name: _('Map'),
    },
    msgs: {},
    classIdevice: 'map',
    active: 0,
    activeSlide: 0,
    activeTest: 0,
    slides: [],
    testsPoint: [],
    points: [],
    selectsGame: [],
    qActive: 0,
    youtubeLoaded: false,
    player: '',
    timeUpdateInterval: '',
    timeUpdateVIInterval: '',
    timeVideoFocus: 0,
    timeVIFocus: true,
    timePoint: 30,
    typeEdit: -1,
    typeEditSlide: -1,
    qTypeEdit: -1,
    pTypeEdit: -1,
    numberCutCuestion: -1,
    numberCutCuestionSlide: -1,
    numberCutPointQuestion: -1,
    clipBoard: '',
    sClipBoard: '',
    qClipBoard: '',
    idevicePath: '',
    playerAudio: '',
    isVideoType: false,
    xA: 0,
    yA: 0,
    iconType: 0,
    iconX: 0,
    iconY: 0,
    levels: [],
    level: 0,
    url: '',
    map: {},
    hasYoutube: false,
    activeMap: {},
    parentMap: {},
    localPlayer: '',
    id: false,
    currentPoints: [],
    redoPoints: [],
    canvas: null,
    ctx: null,
    version: 3,
    areas: [],
    ci18n: {},
    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.refreshTranslations();
        this.ci18n.msgTryAgain = this.ci18n.msgTryAgain.replace(
            '&percnt;',
            '%'
        );
        this.ci18n.msgReviewContents = this.ci18n.msgReviewContents.replace(
            '&percnt;',
            '%'
        );

        this.setMessagesInfo();
        this.createForm();
    },

    refreshTranslations: function () {
        this.ci18n = {
            msgSubmit: c_('Submit'),
            msgIndicateWord: c_('Provide a word or phrase'),
            msgClue: c_('Cool! The clue is:'),
            msgErrors: c_('Errors'),
            msgHits: c_('Hits'),
            msgScore: c_('Score'),
            msgWeight: c_('Weight'),
            msgMinimize: c_('Minimize'),
            msgMaximize: c_('Maximize'),
            msgFullScreen: c_('Full Screen'),
            msgNoImage: c_('No picture question'),
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
            msgPoint: c_('Point'),
            msgAnswer: c_('Answer'),
            msgOnlySaveScore: c_('You can only save the score once!'),
            msgOnlySave: c_('You can only save once'),
            msgInformation: c_('Information'),
            msgYouScore: c_('Your score'),
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
            msgPoints: c_('points'),
            msgPointsA: c_('Points'),
            msgQuestions: c_('Questions'),
            msgAudio: c_('Audio'),
            msgAccept: c_('Accept'),
            msgYes: c_('Yes'),
            msgNo: c_('No'),
            msgShowAreas: c_('Show active areas'),
            msgShowTest: c_('Show questionnaire'),
            msgGoActivity: c_('Click here to do this activity'),
            msgSelectAnswers: c_(
                "Select the correct options and click on the 'Reply' button."
            ),
            msgCheksOptions: c_(
                "Mark all the options in the correct order and click on the 'Reply' button."
            ),
            msgWriteAnswer: c_(
                "Write the correct word o phrase and click on the 'Reply' button."
            ),
            msgIdentify: c_('Identify'),
            msgSearch: c_('Find'),
            msgClickOn: c_('Click on'),
            msgReviewContents: c_(
                'You must review %s&percnt; of the contents of the activity before completing the questionnaire.'
            ),
            msgScore10: c_(
                'Everything is perfect! Do you want to repeat this activity?'
            ),
            msgScore4: c_(
                'You have not passed this test. You should review its contents and try again. Do you want to repeat this activity?'
            ),
            msgScore6: c_(
                'Great! You have passed the test, but you can improve it surely. Do you want to repeat this activity?'
            ),
            msgScore8: c_(
                'Almost perfect! You can still do it better. Do you want to repeat this activity?'
            ),
            msgNotCorrect: c_('It is not correct! You have clicked on'),
            msgNotCorrect1: c_('It is not correct! You have clicked on'),
            msgNotCorrect2: c_('and the correct answer is'),
            msgNotCorrect3: c_('Try again!'),
            msgAllVisited: c_('Great! You have visited the required dots.'),
            msgCompleteTest: c_('You can do the test.'),
            msgPlayStart: c_('Click here to start'),
            msgSubtitles: c_('Subtitles'),
            msgSelectSubtitles: c_(
                'Select a subtitle file. Supported formats:'
            ),
            msgNumQuestions: c_('Number of questions'),
            msgHome: c_('Home'),
            msgReturn: c_('Return'),
            msgCheck: c_('Check'),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgTypeGame: c_('Map'),
        };
    },

    setMessagesInfo: function () {
        const msgs = this.msgs;
        msgs.msgEProvideDefinition = _(
            'Please provide the definition of the word or phrase'
        );
        msgs.msgEURLValid = _(
            'You must upload or indicate the valid URL of an image'
        );
        msgs.msgECompletePoint = _('You have to complete the question');
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
        msgs.msgTypeChoose = _(
            'Please check all the answers in the right order'
        );
        msgs.msgTimeFormat = _('Please check the time format: hh:mm:ss');
        msgs.msgProvideFB = _('Message to display when passing the game');
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.'
        );
        msgs.msgESelectFile = _(
            'The selected file does not contain a valid game'
        );
        msgs.msgEProvideWord = _('Please provide one word or phrase');
        msgs.msgEOneQuestion = _('Please provide at least one question');
        msgs.msgEUnavailableVideo = _('This video is not currently available');
        msgs.msgECompleteQuestion = _('You have to complete the question');
        msgs.msgSilentPoint = _(
            'The silence time is wrong. Check the video duration.'
        );
        msgs.msgProvideSolution = _('Please write the solution');
        msgs.msgEDefintion = _(
            'Please provide the definition of the word or phrase'
        );
        msgs.msgNotHitCuestion = _(
            'The question marked as next in case of success does not exist.'
        );
        msgs.msgNotErrorCuestion = _(
            'The question marked as next in case of error does not exist.'
        );
        msgs.msgProvideTitle = _('You must indicate a title for this point.');
        msgs.msgMarkPoint = _('You must mark a point on the map.');
        msgs.msgDrawArea = _('You must draw an area on the map.');
        msgs.msgTitle = _('Provide a slide title.');
        msgs.msgSelectAudio = _('Select an audio file.');
        msgs.msgErrorPointMap = _('Error in the submap.');
        msgs.msgEOnePoint = _('You must indicate one point at least.');
        msgs.msgCloseMap = _(
            'You must close all the edited maps before saving the activity.'
        );
        msgs.msgCloseSlide = _(
            'You must close the edited presentation before saving the activity.'
        );
        msgs.msgEOneSlide = _(
            'There must be at least one slide in the presentation.'
        );
        msgs.msgWriteLink = _('Please type or paste a valid URL.');
        msgs.msgIDLenght = _(
            'The report identifier must have at least 5 characters'
        );
        msgs.msgSolutionOrder = _(
            'Indicate, using commas, the correct order in which points must be clicked'
        );
        msgs.msgWriteAnswer = _('You have to complete the question');
    },

    createForm: function () {
        const path = $exeDevice.idevicePath,
            html = `
            <div id="gameQEIdeviceForm">
                <p class="exe-block-info exe-block-dismissible">
                    ${_('Create image maps: Images with interactive hotspots to reveal images, videos, sounds, texts...')}
                    <a href="https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe29/mapa.html" hreflang="es" target="_blank">
                        ${_('Usage Instructions')}
                    </a>
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Click on the active areas or image icons.'))}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_('Options')}</a></legend>
                        <div id="mapaEOptions" class="mb-3">
                            <div class="mb-3 d-flex flex-wrap align-items-center gap-2">
                                <span>${_('Assessment')}:</span>
                                <div class="form-check form-check-inline m-0 p-0">
                                    <input class="form-check-input MQE-TypeEvaluation" checked id="mapaEEvaluationPoints" type="radio" name="mpevaluation" value="0" />
                                    <label class="form-check-label" for="mapaEEvaluationPoints">${_('Visited points')}</label>
                                </div>
                                <div class="form-check form-check-inline m-0 p-0">
                                    <input class="form-check-input MQE-TypeEvaluation" id="mapaEEvaluationSearch" type="radio" name="mpevaluation" value="2" />
                                    <label class="form-check-label" for="mapaEEvaluationSearch">${_('Identify')}</label>
                                </div>
                                <div class="form-check form-check-inline m-0 p-0">
                                    <input class="form-check-input MQE-TypeEvaluation" id="mapaEEvaluationIdentify" type="radio" name="mpevaluation" value="3" />
                                    <label class="form-check-label" for="mapaEEvaluationIdentify">${_('Find')}</label>
                                </div>
                                <div class="form-check form-check-inline m-0 p-0">
                                    <input class="form-check-input MQE-TypeEvaluation" id="mapaEEvaluationTX" type="radio" name="mpevaluation" value="1" />
                                    <label class="form-check-label" for="mapaEEvaluationTX">${_('Identify Spot')}</label>
                                </div>
                                <div class="form-check form-check-inline m-0 p-0">
                                    <input class="form-check-input MQE-TypeEvaluation" id="mapaEEvaluationTest" type="radio" name="mpevaluation" value="4" />
                                    <label class="form-check-label" for="mapaEEvaluationTest">${_('Quiz')}</label>
                                </div>
                                <div class="form-check form-check-inline m-0 p-0">
                                    <input class="form-check-input MQE-TypeEvaluation" id="mapaEEvaluationOrder" type="radio" name="mpevaluation" value="5" />
                                    <label class="form-check-label" for="mapaEEvaluationOrder">${_('Order')}</label>
                                </div>
                            </div>
                            <div class="toggle-item mb-3" data-target="mapaEShowMinimize">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="mapaEShowMinimize" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="mapaEShowMinimize">${_('Show minimized.')}</label>
                            </div>
                            <div class="toggle-item mb-3" data-target="mapaEHideScoreBar">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="mapaEHideScoreBar" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="mapaEHideScoreBar">${_('Hide score bar')}</label>
                            </div>
                            <div class="toggle-item mb-3" data-target="mapaEHideAreas">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="mapaEHideAreas" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="mapaEHideAreas">${_('Hide areas')}</label>
                            </div>
                            <div class="MQE-EHide mb-3  align-items-center flex-nowrap" id="mapaSolutionOrderDiv">
                                <label for="mapaSolutionOrder">${_('Solution')}:</label>
                                <input type="text" id="mapaSolutionOrder" class="form-control" />
                            </div>
                            <div class="MQE-EHide align-items-center mb-3 gap-2" id="mapaNumOptionsData">
                                <label for="mapaNumOptions">${_('Options Number')}:</label>
                                <input type="number" name="mapaNumOptions" id="mapaNumOptions" value="0" min="0" max="100" class="form-control" />
                            </div>
                            <div class="MQE-EHide align-items-center flex-wrap gap-2 mb-3" id="mapaSolutionData">
                                <div class="toggle-item toggle-related m-0 d-flex align-items-center" data-target="mapaEShowSolution">
                                    <span class="toggle-control">
                                        <input type="checkbox" class="toggle-input" checked id="mapaEShowSolution" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="mapaEShowSolution">${_('Show solutions')}.</label>
                                </div>
                                <label for="mapaETimeShowSolution" class="mb-0 d-flex align-items-center gap-1">${_('Show solution time (seconds)')}:</label>
                                <input type="number" name="mapaETimeShowSolution" id="mapaETimeShowSolution" value="3" min="1" max="9" class="form-control" style="width:70px" />
                            </div>
                            <div class="MQE-EHide mb-3" id="mapaEvaluationData">
                                <div class="d-flex align-items-center gap-2 mb-3">
                                    <label for="mapaPercentajeShowQ">${_('Percentage of visited contents necessary to be able to carry out the activity questionnaire')}: </label>
                                    <input type="number" name="mapaPercentajeShowQ" id="mapaPercentajeShowQ" value="100" min="1" max="100" class="form-control" />
                                    <span id="mapaPShowQuestions">1/1</span>
                                </div>
                                <div class="d-flex align-items-center gap-2 mb-0">
                                    <label for="mapaPercentajeQuestions">${_('Percentage of questionnaire questions')}: </label>
                                    <input type="number" name="mapaPercentajeQuestions" id="mapaPercentajeQuestions" value="100" min="1" max="100" class="form-control" />
                                    <span id="mapaNumberQuestions">1/1</span>
                                </div>
                            </div>
                            <div class="MQE-EHide mb-3 align-items-center gap-2" id="mapaEvaluationIdentify">
                                <label for="mapaPercentajeIdentify">${_('Percentage of questions')}: </label>
                                <input type="number" name="mapaPercentajeIdentify" id="mapaPercentajeIdentify" value="100" min="1" max="100" class="form-control" />
                                <span id="mapaNumberPercentaje">1/1</span>
                            </div>
                            <div id="mapaEAutoShowDiv" class="toggle-item mb-3" data-target="mapaEAutoShow">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="mapaEAutoShow" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="mapaEAutoShow">${_('Show when the mouse is over the icon or active area')}.</label>
                            </div>
                            <div id="mapaEAutoAudioDiv" class="MQE-EHide toggle-item mb-3" data-target="mapaEAutoAudio">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="mapaEAutoAudio" checked />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="mapaEAutoAudio">${_('Play the sound when scrolling the mouse over the points.')}.</label>
                            </div>
                            <div class="d-flex flex-nowrap align-items-center gap-2">
                                <div class="toggle-item m-0" data-target="mapaEEvaluation">
                                    <span class="toggle-control">
                                        <input type="checkbox" class="toggle-input" id="mapaEEvaluation" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="mapaEEvaluation">${_('Progress report')}.</label>
                                </div>
                                <label for="mapaEEvaluationID">${_('Identifier')}:</label>
                                <input type="text" id="mapaEEvaluationID" disabled class="form-control" style="max-width:200px" value="${eXeLearning.app.project.odeId || ''}" />
                                <a href="#mapaEEvaluationHelp" id="mapaEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                    <img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}" />
                                </a>
                            </div>
                            <p id="mapaEEvaluationHelp" class="MQE-TypeGameHelp exe-block-info">
                                ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                            </p>
                        </div>
                    </fieldset>
                    
                    <fieldset class="exe-fieldset MQE-FieldPanel">
                        <legend><a href="#">${_('Map')}</a></legend>
                        <div class="MQE-EPanel" id="mapaEPanel">
                            <div id="mapaImageSelect">
                                <p class="MQE-CloseDetail" id="mapaCloseDetail">
                                    <a href="#" id="mapaCloseLevel" title="${_('Close map')}">${_('Close map')} 
                                        <img src="${path}mapacerrarventana.svg" class="ms-1 MQE-ENavigationButton MQE-EActivo" alt="" />
                                    </a>
                                </p>
                                <div class="d-flex align-items-center gap-2 mb-4 w-100" style="width:100%">
                                    <label for="mapaURLImageMap" class="m-0">${_('Image')}:</label>
                                    <input type="text" id="mapaURLImageMap" class="form-control exe-file-picker me-0" style="flex:1 1 auto; min-width:0;" />
                                    <a href="#" id="mapaShowImageMap" class="MQE-ENavigationButton MQE-EActivo MQE-Play flex-shrink-0" title="${_('Show image')}"></a>
                                    <a href="#" id="mapaMoreImageMap" class="MQE-ENavigationButton MQE-EActivo MQE-More flex-shrink-0" title="${_('More')}"></a>
                                </div>
                                <div class="MQE-EHide align-items-center gap-2 mb-4 w-100" id="mapaMoreImage" style="width:100%">
                                    <label for="mapaAuthorImageMap">${_('Authorship')}:</label>
                                    <input id="mapaAuthorImageMap" type="text" class="form-control" />
                                    <label for="mapaAltImageMap">${_('Alt')}:</label>
                                    <input id="mapaAltImageMap" type="text" class="form-control me-0" />
                                </div>
                                <div class="MQE-EFlex MQE-EHide">
                                    <label for="mapaX">X:</label>
                                    <input id="mapaX" type="text" value="0" class="form-control" />
                                    <label for="mapaY">Y:</label>
                                    <input id="mapaY" type="text" value="0" class="form-control" />
                                    <label for="mapaX1">X1:</label>
                                    <input id="mapaX1" type="text" value="0" class="form-control" />
                                    <label for="mapaY1">Y1:</label>
                                    <input id="mapaY1" type="text" value="0" class="form-control" />
                                </div>
                            </div>
                            <div class="MQE-EMultimedias mb-4">
                                <div class="d-flex align-items-center justify-content-center gap-2 mb-4 w-100">
                                    <div class="MQE-EMultimedia">
                                        <img id="mapaImage" class="MQE-EImage" src="${path}quextIEImage.png" alt="" />
                                        <div class="MQE-ECursorPoint" id="mapaCursor"></div>
                                        <div id="mapaArea" class="MQE-EArea"></div>
                                        <div id="mapaTextLink" class="MQE-ETextLink"></div>
                                        <img id="mapaNoImage" class="MQE-EImageCover" src="${path}quextIEImage.png" alt="" />
                                        <div id="mapaProtector" class="MQE-EProtector"></div>
                                        <canvas id="mapaCanvas" style="display:none"></canvas>
                                    </div>
                                </div>
                                <div id="mapaControls" style="display:none" class="align-items-center justify-content-center gap-2 mb-4">
                                    <button class="btn btn-primary" id="mapaClearButton">Limpiar</button>
                                    <button class="btn btn-primary" id="mapaRedoButton">Rehacer</button>
                                    <button class="btn btn-primary" id="mapaUndoButton">Deshacer</button>
                                </div>
                                ${$exeDevice.getMultimediaPoint(path)}
                                ${$exeDevice.getSlide(path)}
                                ${$exeDevice.getPointTest()}

                            </div>
                            ${$exeDevice.getSelectType()}
                            <div id="mapaDataImage" class="mb-4">
                                <div class="d-flex align-items-center gap-2 flex-nowrap">
                                    <label for="mapaURLImage">${_('Image')}:</label>
                                    <input type="text" id="mapaURLImage" class="exe-file-picker form-control me-0"  />
                                    <a href="#" id="mapaShowImage" class="MQE-ENavigationButton MQE-EActivo MQE-Play" title="${_('Show image')}"></a>
                                </div>
                            </div>
                            <div id="mapaDataVideo" class="MQE-EHide mb-4">
                                <div class="d-flex align-items-center gap-2 flex-nowrap">
                                    <label for="mapaURLYoutube">${_('URL:')}</label>
                                    <input type="text" id="mapaURLYoutube" class="form-control" />
                                    <a href="#" id="mapaPlayVideo" class="MQE-ENavigationButton MQE-EActivo MQE-Play" title="${_('Play video')}"></a>
                                </div>
                            </div>
                            <div id="mapaDataLink" class="MQE-EHide  mb-4">
                                <div class="d-flex align-items-center gap-2 flex-nowrap">
                                    <label for="mapaLink">${_('Link')}</label>
                                    <input type="text" id="mapaLink" class="form-control" />
                                </div>
                            </div>
                            <div id="mapaDataAudio" class="MQE-EHide mb-4">
                                <div class="d-flex align-items-center gap-2 flex-nowrap">
                                    <label for="mapaURLAudio">${_('Audio')}:</label>
                                    <input type="text" id="mapaURLAudio" class="exe-file-picker form-control me-0" />
                                    <a href="#" id="mapaEPlayAudio" class="MQE-ENavigationButton MQE-EActivo MQE-Play" title="${_('Play audio')}"></a>
                                </div>
                            </div>
                            <div id="mapaDataFooter" class="MQE-EHide  mb-4">
                                <div class="d-flex align-items-center gap-2 flex-nowrap">
                                    <label for="mapaFooter">${_('Footer')}:</label>
                                    <input type="text" id="mapaFooter" class="form-control" />
                                </div>
                            </div>
                            <div id="mapaDataToolTip" class="MQE-EHide  mb-4">
                                <label for="mapaToolTip">${_('Text')}</label>
                                <textarea id="mapaToolTip" class="MQE-EText"></textarea>
                            </div>
                            <div id="mapaDataText" class="MQE-EHide mb-4 ">
                                <label for="mapaText">${_('Text')}</label>
                                <textarea id="mapaText" class="exe-html-editor MQE-EText form-control"></textarea>
                            </div>
                            <div id="mapaDataIdentifica" class="MQE-EHide mb-4">
                                <div class="d-flex align-items-center gap-2 flex-nowrap">
                                    <label for="mapaIdentify">${_('Identify')}:</label>
                                    <input type="text" id="mapaIdentify" class="form-control" />
                                    <a href="#" id="mapaIdentifyMoreAudio" class="MQE-ENavigationButton MQE-EActivo MQE-More" title="${_('Audio')}"></a>
                                </div>
                                <div id="mapaDataIdentifyAudio" class="MQE-EHide mb-4">
                                    <div class="d-flex align-items-center gap-2 flex-nowrap">
                                        <label for="mapaURLAudioIdentify">${_('Audio')}:</label>
                                        <input type="text" id="mapaURLAudioIdentify" class="form-control exe-file-picker me-0" />
                                        <a href="#" id="mapaPlayAudioIdentify" class="MQE-ENavigationButton MQE-EActivo MQE-Play" title="${_('Play audio')}"></a>
                                    </div>
                                </div>
                            </div>
                            <div class="MQE-EContents">
                                <div class="MQE-ENavigationButtons gap-1">
                                    <a href="#" id="mapaEAdd" class="MQE-ENavigationButton MQE-EActivo MQE-Add" title="${_('Add point')}"></a>
                                    <a href="#" id="mapaEFirst" class="MQE-ENavigationButton MQE-EActivo MQE-First" title="${_('First point')}"></a>
                                    <a href="#" id="mapaEPrevious" class="MQE-ENavigationButton MQE-EActivo MQE-Previous" title="${_('Previous point')}"></a>
                                    <label class="sr-av" for="mapaNumberPoint">${_('Point number')}:</label>
                                    <input type="text" class="MQE-NumberPoint form-control" id="mapaNumberPoint" value="1" />
                                    <a href="#" id="mapaENext" class="MQE-ENavigationButton MQE-EActivo MQE-Next" title="${_('Next Point')}"></a>
                                    <a href="#" id="mapaELast" class="MQE-ENavigationButton MQE-EActivo MQE-Last" title="${_('Last point')}"></a>
                                    <a href="#" id="mapaEDelete" class="MQE-ENavigationButton MQE-EActivo MQE-Delete" title="${_('Delete point')}"></a>
                                    <a href="#" id="mapaECopy" class="MQE-ENavigationButton MQE-EActivo MQE-Copy" title="${_('Copy point')}"></a>
                                    <a href="#" id="mapaECut" class="MQE-ENavigationButton MQE-EActivo MQE-Cut" title="${_('Cut point')}"></a>
                                    <a href="#" id="mapaEPaste" class="MQE-ENavigationButton MQE-EActivo MQE-Paste" title="${_('Paste point')}"></a>
                                </div>
                            </div>
                            <div class="MQE-ENumQuestionDiv">
                                <div class="MQE-ENumQ">
                                    <span class="sr-av">${_('Number of points')}:</span>
                                </div>
                                <span class="MQE-ENumQuestions" id="mapaENumPoints">1</span>
                            </div>
                            <div class="MQE-Cubierta" id="mapaCubierta"></div>
                        </div>
                    </fieldset>
                    ${$exeDevice.getCuestionario()}
                    ${$exeDevice.getTextFieldset('after')}
                </div>
                ${$exeDevicesEdition.iDevice.gamification.itinerary.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.scorm.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
                <p class="exe-block-warning exe-block-dismissible">
                    ${_('This game may present accessibility problems for some users. You should provide an accessible alternative if the users need it.')}
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
            </div>`;
        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('gameQEIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();

        tinymce.init({
            selector: '#mapaToolTip',
            height: 100,
            language: 'all',
            width: '100%',
            plugins: ['lists link code paste textcolor image'],
            paste_as_text: true,
            entity_encoding: 'raw',
            browser_spellcheck: true,
            toolbar:
                'undo redo | bold italic underline strikethrough | alignleft aligncenter alignright | forecolor backcolor | bullist numlist | link | image | code',
            menubar: false,
            statusbar: false,
            convert_urls: false,
            file_browser_callback: function (field_name, url, type, win) {
                exe_tinymce.chooseImage(field_name, url, type, win);
            },
            setup: function (ed) {
                ed.on('init', function () {
                    $exeDevice.enableForm();
                });
            },
        });
    },

    getSelectType: function () {
        return `
            <div id="mapaMutimediaType" class="mb-4">
                <div class="flex-nowrap align-items-center gap-2" style="display:flex;width:100%">
                    ${$exeDevice.getDrowpBox()}
                    <label for="mapaTitle" class="m-0">${_('Title')}:</label>
                    <input id="mapaTitle" type="text" class="form-control" />
                    <div class="d-flex justify-content-start flex-nowrap align-items-center gap-2">
                        <label for="mapaTypePointSelect" class="m-0">${_('Type')}:</label>
                        <select id="mapaTypePointSelect" name="mapaTypePointSelect" class="form-select">
                            <option value="4">${_('None')}</option>
                            <option value="0">${_('Image')}</option>
                            <option value="1">${_('Video')}</option>
                            <option value="2">${_('Text')}</option>
                            <option value="3">${_('Audio')}</option>
                            <option value="7">${_('Simple')}</option>
                            <option value="8">${_('Link')}</option>
                            <option value="9">${_('Questionnaire')}</option>
                            <option value="5">${_('Map')}</option>
                            <option value="6">${_('Presentation')}</option>
                        </select>
                        <button type="button" id="mapaEditPointsMap" class="MQE-EditPointsMap btn btn-primary btn-sm" title="${_('Edit map points')}">${_('Edit')}</button>
                        <button type="button" id="mapaEditSlide" class="MQE-EditPointsMap btn btn-primary btn-sm" title="${_('Edit presentation points')}">${_('Edit')}</button>
                        <button type="button" id="mapaEditPointTest" class="MQE-EditPointsMap btn btn-primary btn-sm" title="${_('Editar cuestionario')}">${_('Edit')}</button>
                    </div>
                </div>
            </div>`;
    },

    getIDMediaTeca: function (url) {
        if (url) {
            const matc =
                url.indexOf('https://mediateca.educa.madrid.org/video/') != -1;
            if (matc) {
                let id = url
                    .split('https://mediateca.educa.madrid.org/video/')[1]
                    .split('?')[0];
                id = 'http://mediateca.educa.madrid.org/streaming.php?id=' + id;
                return id;
            } else {
                return false;
            }
        } else {
            return false;
        }
    },

    updateTimerDisplayLocal: function () {
        if ($exeDevice.localPlayer) {
            const currentTime = $exeDevice.localPlayer.currentTime;
            if (currentTime) {
                const time =
                    $exeDevices.iDevice.gamification.helpers.secondsToHour(
                        Math.floor(currentTime)
                    );
                $('#mapaPVideoTime').text(time);
                if (
                    Math.ceil(currentTime) == $exeDevice.pointEnd ||
                    Math.ceil(currentTime) == $exeDevice.durationVideo
                ) {
                    $exeDevice.localPlayer.pause();
                    $exeDevice.pointEnd = 100000;
                }
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

    getMultimediaPoint: function (path) {
        const html = `
            <div class="MQE-EPointContainer" id="mapaPContainer">
                <div class="MQE-EPointMultimedia">
                    <div class="d-flex align-items-center mb-4 flex-nowrap gap-2">
                        <label for="mapaPTitle" >${_('Title')}:</label>
                        <input id="mapaPTitle" type="text" class="form-control" />
                        <a href="#" id="mapaPClose" class="MQE-ENavigationButton MQE-EActivo MQE-Close" title="${_('Close')}"></a>
                    </div>
                    <div id="mapaPImageContainer" class="MQE-PointImageContainer mb-3">
                        <img id="mapaPImage" class="MQE-EImage" src="${path}quextIEImage.png" alt="" />
                        <img id="mapaPNoImage" class="MQE-EImageCover" src="${path}quextIEImage.png" alt="" />
                        <img class="MQE-EImageCover" src="${path}quextIENoVideo.png" id="mapaPNoVideo" alt="" />
                        <div id="mapaPVideo" class="MQE-EImageCover"></div>
                        <video class="MQE-EImageCover" id="mapaEVideoLocal" preload="auto" controls></video>
                    </div>
                    <div id="mapaPDataImage" class="mb-3">
                        <div class="d-flex align-items-center mb-3 flex-nowrap gap-2">
                            <label for="mapaPURLImage">${_('Image')}:</label>
                            <input type="text" id="mapaPURLImage" class="form-control exe-file-picker me-0" />
                            <a href="#" id="mapaPShowImage" class="MQE-ENavigationButton MQE-EActivo MQE-Play" title="${_('Show image')}"></a>
                        </div>
                        <div class="d-flex align-items-center flex-nowrap gap-2">
                            <label for="mapaPAuthorImage">${_('Authorship')}:</label>
                            <input id="mapaPAuthorImage" type="text" class="form-control me-2"/>
                            <label for="mapaPAltImage">${_('Alt')}:</label>
                            <input id="mapaPAltImage" type="text" class="form-control me-0"/>
                        </div>
                    </div>
                    <div id="mapaPDataVideo" class="MQE-EHide mb-3">
                        <div class="d-flex align-items-center mb-3 flex-nowrap gap-2">
                            <label for="mapaPURLYoutube">${_('URL:')}</label>
                            <input type="text" id="mapaPURLYoutube" class="form-control" />
                            <a href="#" id="mapaPPlayVideo" class="MQE-ENavigationButton MQE-EActivo MQE-Play" title="${_('Play video')}"></a>
                        </div>
                        <div class="d-flex align-items-center flex-nowrap mb-0" id="mapaEPointInputOptionsVideo">
                            <label for="mapaPInitVideo">${_('Start')}:</label>
                            <input id="mapaPInitVideo" type="text" value="00:00:00" maxlength="8" class="form-control me-2"/>
                            <label for="mapaPEndVideo">${_('End')}:</label>
                            <input id="mapaPEndVideo" type="text" value="00:00:00" maxlength="8" class="form-control me-2"/>
                            <button class="btn btn-primary" id="mapaPVideoTime">00:00:00</button>
                        </div>
                    </div>
                    <div id="mapaPDataFooter" class="mb-0">
                        <div class="d-flex align-items-center flex-nowrap gap-2">
                            <label for="mapaPFooter">${_('Footer')}: </label>
                            <input type="text" id="mapaPFooter" class="form-control" />
                        </div>
                    </div>
                </div>
            </div>`;
        return html;
    },

    getSlide: function (path) {
        const html = `
            <div class="MQE-ESlideContainer" id="mapaSContainer">
                <div class="MQE-ESlideMultimedia">
                    <div class="d-flex align-items-center mb-3 gap-2">
                        <label for="mapaSTitle">${_('Title')}:</label>
                        <input id="mapaSTitle" type="text" class="form-control" />
                        <a href="#" id="mapaSClose" class="MQE-ENavigationButton MQE-EActivo MQE-Close" title="${_('Close')}"></a>
                    </div>
                    <div id="mapaSImageContainer" class="MQE-PointImageContainer">
                        <img id="mapaSImage" class="MQE-EImage" src="${path}quextIEImage.png" alt="" />
                        <img id="mapaSNoImage" class="MQE-EImageCover" src="${path}quextIEImage.png" alt="" />
                    </div>
                    <div id="mapaSDataImage">
                        <div class="d-flex align-items-center mb-3 gap-2">
                            <label for="mapaSURLImage">${_('Image')}:</label>
                            <input type="text" id="mapaSURLImage" class="form-control exe-file-picker me-0" />
                            <a href="#" id="mapaSShowImage" class="MQE-ENavigationButton MQE-EActivo MQE-Play" title="${_('Show image')}"></a>
                        </div>
                        <div class="d-flex align-items-center  gap-2 mb-3">
                            <label for="mapaSAuthorImage">${_('Authorship')}:</label>
                            <input id="mapaSAuthorImage" type="text" class="form-control me-0" />
                            <label for="mapaSAltImage">${_('Alt')}:</label>
                            <input id="mapaSAltImage" type="text" class="form-control me-0" />
                        </div>
                    </div>
                    <div id="mapaSDataFooter">
                        <div class="d-flex align-items-center mb-3">
                            <label for="mapaSFooter">${_('Footer')}: </label>
                            <input type="text" id="mapaSFooter" class="form-control" />
                        </div>
                    </div>
                    <div class="MQE-EContents">
                        <div class="MQE-ENavigationButtons gap-1">
                            <a href="#" id="mapaEAddSlide" class="MQE-ENavigationButton MQE-EActivo MQE-Add" title="${_('Add a slide')}"></a>
                            <a href="#" id="mapaEFirstSlide" class="MQE-ENavigationButton MQE-EActivo MQE-First" title="${_('First slide')}"></a>
                            <a href="#" id="mapaEPreviousSlide" class="MQE-ENavigationButton MQE-EActivo MQE-Previous" title="${_('Previous slide')}"></a>
                            <label class="sr-av" for="mapaNumberSlide">${_('Slide number')}:</label>
                            <input type="text" class="MQE-NumberPoint form-control" id="mapaNumberSlide" value="1" />
                            <a href="#" id="mapaENextSlide" class="MQE-ENavigationButton MQE-EActivo MQE-Next" title="${_('Next slide')}"></a>
                            <a href="#" id="mapaELastSlide" class="MQE-ENavigationButton MQE-EActivo MQE-Last" title="${_('Last slide')}"></a>
                            <a href="#" id="mapaEDeleteSlide" class="MQE-ENavigationButton MQE-EActivo MQE-Delete" title="${_('Delete slide')}"></a>
                            <a href="#" id="mapaECopySlide" class="MQE-ENavigationButton MQE-EActivo MQE-Copy" title="${_('Copy slide')}"></a>
                            <a href="#" id="mapaECutSlide" class="MQE-ENavigationButton MQE-EActivo MQE-Cut" title="${_('Cut slide')}"></a>
                            <a href="#" id="mapaEPasteSlide" class="MQE-ENavigationButton MQE-EActivo MQE-Paste" title="${_('Paste slide')}"></a>
                        </div>
                    </div>
                </div>
            </div>`;
        return html;
    },

    getPointTest: function () {
        const html = `
            <div class="MQE-ESTestPointContainer" id="mapaTContainer">
               <div class="MQE-EFlexSolution mb-3">
                    <label class="me-1">${_('Questionnaire')}:</label>
                    <a href="#" id="mapaPTClose" class="MQE-ENavigationButton MQE-EActivo MQE-Close" title="${_('Close')}"></a>
                </div>
                <div class="MQE-EContents">
                    <div id="mapaDataQuestion1" class="MQE-EFlexSolution mb-3 flex-wrap align-items-center">
                        <div class="d-flex flex-nowrap align-items-center m-0 gap-2">
                            <span>${_('Type')}:</span>
                            <div class="form-check form-check-inline m-0">
                                <input class="form-check-input MQE-PTypeSelect" checked id="mapaTypeSelect1" type="radio" name="mptypeselect1" value="0" />
                                <label class="form-check-label" for="mapaTypeSelect1">${_('Select')}</label>
                            </div>
                            <div class="form-check form-check-inline m-0">
                                <input class="form-check-input MQE-PTypeSelect" id="mapaTypeOrders1" type="radio" name="mptypeselect1" value="1" />
                                <label class="form-check-label" for="mapaTypeOrders1">${_('Order')}</label>
                            </div>
                            <div class="form-check form-check-inline m-0">
                                <input class="form-check-input MQE-PTypeSelect" id="mapaTypeWord1" type="radio" name="mptypeselect1" value="2" />
                                <label class="form-check-label" for="mapaTypeWord1">${_('Word')}</label>
                            </div>
                        </div>
                        <div id="mapaPercentageLetters1" class="MQE-EHide align-items-center flex-nowrap gap-3">
                            <label class="m-0" for="mapaPercentageShow1">${_('Percentage of letters to show (%)')}:</label>
                            <input type="number" id="mapaPercentageShow1" value="35" min="0" max="100" step="5" class="form-control" style="width:110px" />
                        </div>
                        <div id="mapaOptionsNumberA1" class="d-flex align-items-center flex-nowrap gap-2">
                            <span id="mapaOptionsNumberSpan1" class="m-0">${_('Options Number')}:</span>
                            <div class="form-check form-check-inline m-0">
                                <input class="form-check-input MQE-PNumber" id="numQ21" type="radio" name="mpnumber1" value="2" />
                                <label class="form-check-label" for="numQ21">2</label>
                            </div>
                            <div class="form-check form-check-inline m-0">
                                <input class="form-check-input MQE-PNumber" id="numQ31" type="radio" name="mpnumber1" value="3" />
                                <label class="form-check-label" for="numQ31">3</label>
                            </div>
                             <div class="form-check form-check-inline m-0">
                                <input class="form-check-input MQE-PNumber" id="numQ41" type="radio" name="mpnumber1" value="4" checked="checked" />
                                <label class="form-check-label" for="numQ41">4</label>
                            </div>
                        </div>
                        <div id="mapaESolitionOptions1" class="MQE-EHiden">
                            <span>${_('Solution')}:</span>
                            <span id="mapaESolutionSelect1"></span>
                        </div>
                    </div>
                    <div class="MQE-EQuestionDiv1 mb-4" id="mapaEQuestionDiv1">
                        <label class="sr-av">${_('Question')}:</label>
                        <input type="text" class="MQE-EQuestion form-control" id="mapaEQuestion1">
                    </div>
                    <div class="MQE-EAnswers mb-4" id="mapaEAnswers1">
                        <div class="MQE-PEOptionDiv d-flex align-items-center mb-3 flex-nowrap">
                            <label class="sr-av">${_('Solution')} A:</label>
                            <input type="checkbox" class="MQE-PESolution form-check-input" name="mpsolution1" id="mapaESolution01" value="A" />
                            <label>A</label>
                            <input type="text" class="MQE-EOption0 MQE-PEAnwersOptions form-control ms-1" id="mapaEOption01">
                        </div>
                        <div class="MQE-PEOptionDiv d-flex align-items-center mb-3 flex-nowrap">
                            <label class="sr-av">${_('Solution')} B:</label>
                            <input type="checkbox" class="MQE-PESolution form-check-input" name="mpsolution1" id="mapaESolution11" value="B" />
                            <label>B</label>
                            <input type="text" class="MQE-EOption1 MQE-PEAnwersOptions form-control ms-1" id="mapaEOption11">
                        </div>
                        <div class="MQE-PEOptionDiv d-flex align-items-center mb-3 flex-nowrap">
                            <label class="sr-av">${_('Solution')} C:</label>
                            <input type="checkbox" class="MQE-PESolution form-check-input" name="mpsolution1" id="mapaESolution21" value="C" />
                            <label>C</label>
                            <input type="text" class="MQE-EOption2 MQE-PEAnwersOptions form-control ms-1" id="mapaEOption21">
                        </div>
                        <div class="MQE-PEOptionDiv d-flex align-items-center mb-3 flex-nowrap">
                            <label class="sr-av">${_('Solution')} D:</label>
                            <input type="checkbox" class="MQE-PESolution form-check-input" name="mpsolution1" id="mapaESolution31" value="D" />
                            <label>D</label>
                            <input type="text" class="MQE-EOption3 MQE-PEAnwersOptions form-control ms-1" id="mapaEOption31">
                        </div>
                    </div>
                    <div class="MQE-EWordDiv MQE-DP mb-4" id="mapaEWordDiv1">
                        <div class="MQE-ESolutionWord d-flex align-items-center mb-4 flex-nowrap">
                            <label for="mapaESolutionWord1" class="m-0">${_('Word/Phrase')}: </label>
                            <input type="text" id="mapaESolutionWord1" class="form-control" />
                        </div>
                        <div class="MQE-ESolutionWord d-flex align-items-center flex-nowrap">
                            <label for="mapaEDefinitionWord1" class="m-0">${_('Definition')}:</label>
                            <input type="text" id="mapaEDefinitionWord1" class="form-control" />
                        </div>
                    </div>
                </div>
                <div class="MQE-ENavigationButtons gap-1">
                    <a href="#" id="mapaEAddQ1" class="MQE-ENavigationButton MQE-EActivo MQE-Add" title="${_('Add question')}"></a>
                    <a href="#" id="mapaEFirstQ1" class="MQE-ENavigationButton MQE-EActivo MQE-First" title="${_('First question')}"></a>
                    <a href="#" id="mapaEPreviousQ1" class="MQE-ENavigationButton MQE-EActivo MQE-Previous" title="${_('Previous question')}"></a>
                    <label class="sr-av" for="mapaENumberQuestionQ1">${_('Question number')}:</label>
                    <input type="text" class="MQE-NumberPoint form-control" id="mapaENumberQuestionQ1" value="1" />
                    <a href="#" id="mapaENextQ1" class="MQE-ENavigationButton MQE-EActivo MQE-Next" title="${_('Next question')}"></a>
                    <a href="#" id="mapaELastQ1" class="MQE-ENavigationButton MQE-EActivo MQE-Last" title="${_('Last question')}"></a>
                    <a href="#" id="mapaEDeleteQ1" class="MQE-ENavigationButton MQE-EActivo MQE-Delete" title="${_('Delete question')}"></a>
                    <a href="#" id="mapaECopyQ1" class="MQE-ENavigationButton MQE-EActivo MQE-Copy" title="${_('Copy question')}"></a>
                    <a href="#" id="mapaECutQ1" class="MQE-ENavigationButton MQE-EActivo MQE-Cut" title="${_('Cut question')}"></a>
                    <a href="#" id="mapaEPasteQ1" class="MQE-ENavigationButton MQE-EActivo MQE-Paste" title="${_('Paste question')}"></a>
                </div>
                <div class="MQE-PENumQuestionDiv">
                    <div class="MQE-ENumQ"><span class="sr-av">${_('Number of questions')}:</span></div>
                    <span class="MQE-ENumQuestions" id="mapaENumQuestions1">0</span>
                </div>
            </div>`;
        return html;
    },

    getCuestionario: function () {
        const html = `
            <fieldset class="exe-fieldset exe-fieldset-closed" id="mapaFQuestions">
                <legend><a href="#">${_('Questionnaire')}</a></legend>
                <div class="MQE-EContents">
                    <div id="mapaDataQuestion" class="MQE-EFlexSolution mb-3 ">
                        <div class="MQE-EInputType d-flex flex-nowrap  gap-2 align-items-center">
                            <span>${_('Type')}:</span>
                            <div class="form-check form-check-inline m-0">
                                <input class="form-check-input MQE-TypeSelect" checked id="mapaTypeSelect" type="radio" name="mptypeselect" value="0" />
                                <label class="form-check-label" for="mapaTypeSelect">${_('Select')}</label>
                            </div>
                            <div class="form-check form-check-inline m-0">
                                <input class="form-check-input MQE-TypeSelect" id="mapaTypeOrders" type="radio" name="mptypeselect" value="1" />
                                <label class="form-check-label" for="mapaTypeOrders">${_('Order')}</label>
                            </div>
                            <div class="form-check form-check-inline m-0">
                                <input class="form-check-input MQE-TypeSelect" id="mapaTypeWord" type="radio" name="mptypeselect" value="2" />
                                <label class="form-check-label" for="mapaTypeWord">${_('Word')}</label>
                            </div>
                        </div>
                        <div id="mapaPercentageLetters" class="MQE-EHide align-items-center flex-nowrap">
                            <label for="mapaPercentageShow" class="m-0">${_('Percentage of letters to show (%)')}:</label>
                            <input type="number" id="mapaPercentageShow" value="35" min="0" max="100" step="5" class="form-control" style="width:110px" />
                        </div>
                        <div id="mapaOptionsNumberA" class="align-items-center flex-nowrap justify-content-start gap-2" style="display:flex ">
                            <span id="mapaOptionsNumberSpan" class="m-0">${_('Options Number')}:</span>
                            <div class="MQE-EInputNumbers d-flex align-items-center gap-2" id="mapaEInputNumbers">
                                <div class="form-check form-check-inline m-0">
                                    <input class="form-check-input MQE-Number" id="numQ2" type="radio" name="mpnumber" value="2" />
                                    <label class="form-check-label" for="numQ2">2</label>
                                </div>
                                <div class="form-check form-check-inline m-0">
                                    <input class="form-check-input MQE-Number" id="numQ3" type="radio" name="mpnumber" value="3" />
                                    <label class="form-check-label" for="numQ3">3</label>
                                </div>
                                <div class="form-check form-check-inline m-0">
                                    <input class="form-check-input MQE-Number" id="numQ4" type="radio" name="mpnumber" value="4" checked="checked" />
                                    <label class="form-check-label" for="numQ4">4</label>
                                </div>
                            </div>
                        </div>
                        <div id="mapaESolutionOptions">
                            <span>${_('Solution')}:</span>
                            <span id="mapaESolutionSelect"></span>
                        </div>
                    </div>
                    <div class="MQE-EQuestionDiv" id="mapaEQuestionDiv">
                        <label class="sr-av">${_('Question')}:</label>
                        <input type="text" class="MQE-EQuestion form-control" id="mapaEQuestion">
                    </div>
                    <div class="MQE-EAnswers" id="mapaEAnswers">
                        <div class="MQE-EOptionDiv d-flex align-items-center gap-2 mb-2 flex-nowrap">
                            <label class="sr-av">${_('Solution')} A:</label>
                            <input type="checkbox" class="MQE-ESolution" name="mpsolution" id="mapaESolution0" value="A" />
                            <label>A</label>
                            <input type="text" class="MQE-EOption0 MQE-EAnwersOptions form-control" id="mapaEOption0">
                        </div>
                        <div class="MQE-EOptionDiv d-flex align-items-center gap-2 mb-2 flex-nowrap">
                            <label class="sr-av">${_('Solution')} B:</label>
                            <input type="checkbox" class="MQE-ESolution" name="mpsolution" id="mapaESolution1" value="B" />
                            <label>B</label>
                            <input type="text" class="MQE-EOption1 MQE-EAnwersOptions form-control" id="mapaEOption1">
                        </div>
                        <div class="MQE-EOptionDiv d-flex align-items-center gap-2 mb-2 flex-nowrap">
                            <label class="sr-av">${_('Solution')} C:</label>
                            <input type="checkbox" class="MQE-ESolution" name="mpsolution" id="mapaESolution2" value="C" />
                            <label>C</label>
                            <input type="text" class="MQE-EOption2 MQE-EAnwersOptions form-control" id="mapaEOption2">
                        </div>
                        <div class="MQE-EOptionDiv d-flex align-items-center gap-2 mb-2 flex-nowrap">
                            <label class="sr-av">${_('Solution')} D:</label>
                            <input type="checkbox" class="MQE-ESolution" name="mpsolution" id="mapaESolution3" value="D" />
                            <label>D</label>
                            <input type="text" class="MQE-EOption3 MQE-EAnwersOptions form-control" id="mapaEOption3">
                        </div>
                    </div>
                    <div class="MQE-EWordDiv MQE-DP" id="mapaEWordDiv">
                        <div class="MQE-ESolutionWord">
                            <label for="mapaESolutionWord">${_('Word/Phrase')}: </label>
                            <input type="text" id="mapaESolutionWord" class="form-control" />
                        </div>
                        <div class="MQE-ESolutionWord">
                            <label for="mapaEDefinitionWord">${_('Definition')}:</label>
                            <input type="text" id="mapaEDefinitionWord" class="form-control" />
                        </div>
                    </div>
                </div>
                <div class="MQE-EOrders" id="mapaEOrder">
                    <div class="MQE-ECustomMessage">
                        <span class="sr-av">${_('Hit')}</span>
                        <span class="MQE-EHit"></span>
                        <label for="mapaEMessageOK">${_('Message')}:</label>
                        <input type="text" id="mapaEMessageOK" class="form-control">
                    </div>
                    <div class="MQE-ECustomMessage">
                        <span class="sr-av">${_('Error')}</span>
                        <span class="MQE-EError"></span>
                        <label for="mapaEMessageKO">${_('Message')}:</label>
                        <input type="text" id="mapaEMessageKO" class="form-control">
                    </div>
                </div>
                <div class="MQE-ENavigationButtons gap-1">
                    <a href="#" id="mapaEAddQ" class="MQE-ENavigationButton MQE-EActivo MQE-Add" title="${_('Add question')}"></a>
                    <a href="#" id="mapaEFirstQ" class="MQE-ENavigationButton MQE-EActivo MQE-First" title="${_('First question')}"></a>
                    <a href="#" id="mapaEPreviousQ" class="MQE-ENavigationButton MQE-EActivo MQE-Previous" title="${_('Previous question')}"></a>
                    <label class="sr-av" for="mapaENumberQuestionQ">${_('Question number')}:</label>
                    <input type="text" class="MQE-NumberPoint form-control" id="mapaENumberQuestionQ" value="1" />
                    <a href="#" id="mapaENextQ" class="MQE-ENavigationButton MQE-EActivo MQE-Next" title="${_('Next question')}"></a>
                    <a href="#" id="mapaELastQ" class="MQE-ENavigationButton MQE-EActivo MQE-Last" title="${_('Last question')}"></a>
                    <a href="#" id="mapaEDeleteQ" class="MQE-ENavigationButton MQE-EActivo MQE-Delete" title="${_('Delete question')}"></a>
                    <a href="#" id="mapaECopyQ" class="MQE-ENavigationButton MQE-EActivo MQE-Copy" title="${_('Copy question')}"></a>
                    <a href="#" id="mapaECutQ" class="MQE-ENavigationButton MQE-EActivo MQE-Cut" title="${_('Cut question')}"></a>
                    <a href="#" id="mapaEPasteQ" class="MQE-ENavigationButton MQE-EActivo MQE-Paste" title="${_('Paste question')}"></a>
                </div>
                <div class="MQE-ENumQuestionDiv">
                    <div class="MQE-ENumQ">
                        <span class="sr-av">${_('Number of questions')};</span>
                    </div>
                    <span class="MQE-ENumQuestions" id="mapaENumQuestions">0</span>
                </div>
            </fieldset>`;
        return html;
    },

    getTextFieldset: function (position) {
        if (
            typeof position !== 'string' ||
            (position !== 'after' && position !== 'before')
        )
            return '';
        const tit =
                position === 'before'
                    ? _('Content before')
                    : _('Content after'),
            id = position === 'before' ? 'Before' : 'After';
        return `
            <fieldset class='exe-fieldset exe-feedback-fieldset exe-fieldset-closed'>
                <legend><a href='#'>${_('Additional content')} (${_('Optional').toLowerCase()})</a></legend>
                <div>
                    <p>
                        <label for='eXeIdeviceText${id}' class='sr-av'>${tit}:</label>
                        <textarea id='eXeIdeviceText${id}' class='exe-html-editor'></textarea>
                    </p>
                </div>
            </fieldset>`;
    },

    enableForm: function () {
        $exeDevice.initPoints();

        $exeDevice.loadPreviousValues();
        $exeDevice.showPoint(0);
        $exeDevice.addEvents();
        $exeDevice.loadYoutubeApi();
    },

    initLevels: function (data) {
        $exeDevice.activeMap = {};
        $exeDevice.activeMap.pts = Object.values(
            $.extend(true, {}, data.points)
        );
        $exeDevice.activeMap.url = data.url;
        $exeDevice.activeMap.author = data.authorImage;
        $exeDevice.activeMap.alt = data.altImage;
        $exeDevice.activeMap.active = 0;
        $exeDevice.levels = [];
        $exeDevice.levels.push($.extend(true, {}, $exeDevice.activeMap));
        $exeDevice.level = 0;
        $exeDevice.updateQuestionsNumber();
    },

    getNumberIdentify: function (pts) {
        let m = 0;
        for (let i = 0; i < pts.length; i++) {
            let p = pts[i];
            if (p.type != 5) {
                m++;
            } else {
                m += $exeDevice.getNumberIdentify(p.map.pts);
            }
        }
        return m;
    },

    showPoint: function (i) {
        $exeDevice.clearPoint();
        let num = i < 0 ? 0 : i;
        num =
            num >= $exeDevice.activeMap.pts.length
                ? $exeDevice.activeMap.pts.length - 1
                : num;
        const p = $exeDevice.activeMap.pts[num];
        $exeDevice.stopVideo();
        $exeDevice.changeTypePoint(p.type);
        $exeDevice.currentPoints = [];
        $exeDevice.redoPoints = [];
        $exeDevice.currentPoints = p.points;

        $('#mapaX').val(p.x);
        $('#mapaY').val(p.y);
        $('#mapaX1').val(p.x1);
        $('#mapaY1').val(p.y1);
        $('#mapaTitle').val(p.title);
        $('#mapaFooter').val(p.footer);
        $('#mapaPTitle').val(p.title);
        $('#mapaPFooter').val(p.footer);

        $exeDevice.setIconType(p.iconType);

        $('#mapaIdentify').val(p.question);
        $('#mapaLink').val(p.link);
        $('#mapaURLAudioIdentify').val(p.question_audio);
        if (p.type == 0) {
            $('#mapaURLImage').val(p.url);
            $('#mapaPURLImage').val(p.url);
            $('#mapaPAltImage').val(p.alt);
            $('#mapaPAuthorImage').val(p.author);
        } else if (p.type == 1) {
            $('#mapaURLYoutube').val(p.video);
            $('#mapaPURLYoutube').val(p.video);
            $('#mapaPInitVideo').val(
                $exeDevices.iDevice.gamification.helpers.secondsToHour(p.iVideo)
            );
            $('#mapaPEndVideo').val(
                $exeDevices.iDevice.gamification.helpers.secondsToHour(p.fVideo)
            );
        } else if (p.type == 2) {
            if (tinyMCE.get('mapaText')) {
                tinyMCE.get('mapaText').setContent(p.eText);
            } else {
                $('#mapaText').val(p.eText);
            }
        } else if (p.type == 7) {
            if (tinyMCE.get('mapaToolTip')) {
                tinyMCE.get('mapaToolTip').setContent(p.toolTip);
            } else {
                $('#mapaToolTip').val(p.toolTip);
            }
        }

        $('#mapaColorTitle').val(p.color);
        $('#mapaFontSizeTitle').val(p.fontSize);
        $('#mapaTextLink').text(p.title);
        $('#mapaTextLink').css({
            color: p.color,
            'font-size': p.fontSize + 'px',
        });

        $exeDevice.changeIcon(p.iconType, p.x, p.y);
        $exeDevice.stopSound();

        $('#mapaURLAudio').val(p.audio);
        $('#mapaNumberPoint').val(i + 1);
        $('#mapaENumPoints').text($exeDevice.activeMap.pts.length);
        $('#mapaTypePointSelect').val(p.type);
    },

    initPoints: function () {
        $('#mapaEInputVideo').css('display', 'flex');
        $('#mapaEInputImage').css('display', 'flex');
        $('#mapaMoreImage').css('display', 'flex');
        $('#mapaCloseDetail').hide();
        $('#mapaMoreImage').hide();
        $('#mapaFQuestions').hide();
        $('#mapaCubierta').hide();
        $('#mapaEPaste').hide();
        $('#mapaImage').attr('draggable', false);
        $('#mapaNoImage').attr('draggable', false);
        $('#mapaEPasteQ').hide();
        $('#mapaPContainer').hide();
        $('#mapaSContainer').hide();
        $('#mapaTContainer').hide();

        this.active = 0;
        this.url = '';

        if ($exeDevice.selectsGame.length == 0) {
            let question = $exeDevice.getDefaultQuestion();
            $exeDevice.selectsGame.push(question);
            this.showOptions(4);
            this.showSolution('');
        }

        this.qActive = 0;
        this.activeMap = {};
        this.activeMap.url = '';
        this.activeMap.author = '';
        this.activeMap.alt = '';
        this.activeMap.active = 0;
        this.activeMap.pts = [];
        this.activeMap.pts.push($exeDevice.getDefaultPoint());
        this.levels = [];
        this.levels.push($.extend(true, {}, this.activeMap));
        this.level = 0;
        this.canvas = $('#mapaCanvas')[0];
        this.ctx = this.canvas.getContext('2d');
        this.changeTypePoint(0);
        this.changeIcon(0, 0, 0);
        this.showTypeQuestion(0);
    },

    changeTypePoint: function (type) {
        $('#mapaDataImage').hide();
        $('#mapaDataVideo').hide();
        $('#mapaDataText').hide();
        $('#mapaDataAudio').show();
        $('#mapaDataFooter').show();
        $('#mapaPDataImage').hide();
        $('#mapaPDataVideo').hide();
        $('#mapaPMap').hide();
        $('#mapaEditPointsMap').hide();
        $('#mapaEditSlide').hide();
        $('#mapaEditPointTest').hide();
        $('#mapaDataToolTip').hide();
        $('#mapaDataLink').hide();
        $('#mapaEPanel').show();

        switch (type) {
            case 0:
                $('#mapaDataImage').show();
                $('#mapaPDataImage').show();
                break;
            case 1:
                $('#mapaDataVideo').show();
                $('#mapaDataAudio').hide();
                $('#mapaPDataVideo').show();
                break;
            case 2:
                $('#mapaDataText').show();
                $('#mapaDataFooter').hide();
                if (tinyMCE.get('mapaText')) {
                    tinyMCE.get('mapaText').show();
                }
                break;
            case 3:
                $('#mapaDataImage').hide();
                $('#mapaDataVideo').hide();
                $('#mapaDataText').hide();
                $('#mapaDataToolTip').hide();
                break;
            case 4:
                $('#mapaDataAudio').hide();
                $('#mapaDataFooter').hide();
                break;
            case 5:
                $('#mapaDataAudio').hide();
                $('#mapaDataFooter').hide();
                $('#mapaEditPointsMap').show();
                break;
            case 6:
                $('#mapaDataAudio').hide();
                $('#mapaDataFooter').hide();
                $('#mapaEditSlide').show();
                break;
            case 7:
                $('#mapaDataToolTip').show();
                $('#mapaDataFooter').hide();
                if (tinyMCE.get('mapaToolTip')) {
                    tinyMCE.get('mapaToolTip').show();
                }
                break;
            case 8:
                $('#mapaDataLink').show();
                $('#mapaDataFooter').hide();
                $('#mapaDataAudio').hide();
                break;
            case 9:
                $('#mapaEditPointTest').show();
                $('#mapaDataFooter').hide();
                $('#mapaDataAudio').hide();
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
        $exeDevice.player = new YT.Player('mapaPVideo', {
            width: '100%',
            height: '100%',
            videoId: '',
            playerVars: {
                color: 'white',
                autoplay: 1,
                controls: 1,
            },
            events: {
                onReady: $exeDevice.clickPlay,
                onError: $exeDevice.onPlayerError,
            },
        });
    },

    clickPlay: function () {
        const ulrvideo = $('#mapaPVideo');
        if (ulrvideo.length === 0 || ulrvideo.val().trim().length < 3) return;
        if (
            $exeDevices.iDevice.gamification.media.getIDYoutube(
                $('#mapaPVideo').val().trim()
            ) ||
            $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                $('#mapaPVideo').val().trim()
            )
        ) {
            $exeDevice.showVideoPoint();
        }
    },

    youTubeReady: function () {
        $exeDevice.player = new YT.Player('mapaPVideo', {
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
            $exeDevice.showVideoPoint();
        }
    },

    updateTimerDisplay: function () {
        if ($exeDevice.player) {
            if (typeof $exeDevice.player.getCurrentTime === 'function') {
                let time =
                    $exeDevices.iDevice.gamification.helpers.secondsToHour(
                        $exeDevice.player.getCurrentTime()
                    );
                $('#mapaPVideoTime').text(time);
            }
        }
    },

    updateProgressBar: function () {
        // $('#progress-bar').val((player.getCurrentTime() / player.getDuration()) * 100);
    },
    onPlayerError: function () {
        //$exeDevice.showMessage("El video mapaEdo no está disponible")
    },

    startVideo: function (id, start, end, type) {
        const mstart = start < 1 ? 0.1 : start;
        if (type > 0) {
            if ($exeDevice.localPlayer) {
                $exeDevice.pointEnd = end;
                $exeDevice.localPlayer.src = id;
                $exeDevice.localPlayer.currentTime = parseFloat(mstart);
                $exeDevice.localPlayer.play();
            }
            clearInterval($exeDevice.timeUpdateInterval);
            $exeDevice.timeUpdateInterval = setInterval(function () {
                $exeDevice.updateTimerDisplayLocal();
            }, 1000);
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
            clearInterval($exeDevice.timeUpdateInterval);
            $exeDevice.timeUpdateInterval = setInterval(function () {
                $exeDevice.updateTimerDisplay();
            }, 1000);
        }
    },

    playVideo: function () {
        if ($exeDevice.player) {
            clearInterval($exeDevice.timeUpdateInterval);
            if (typeof $exeDevice.player.playVideo === 'function') {
                $exeDevice.player.playVideo();
            }
            $exeDevice.timeUpdateInterval = setInterval(function () {
                $exeDevice.updateTimerDisplay();
            }, 1000);
        }
    },

    stopVideo: function () {
        if ($exeDevice.localPlayer) {
            clearInterval($exeDevice.timeUpdateInterval);
            if (typeof $exeDevice.localPlayer.pause == 'function') {
                $exeDevice.localPlayer.pause();
            }
        }
        if ($exeDevice.player) {
            clearInterval($exeDevice.timeUpdateInterval);
            if (typeof $exeDevice.player.pauseVideo === 'function') {
                $exeDevice.player.pauseVideo();
            }
        }
    },

    getID: function () {
        return Math.floor(Math.random() * Date.now());
    },

    getDefaultPoint: function () {
        const id = $exeDevice.getID();

        return {
            id: 'p' + id,
            title: '',
            type: 0,
            url: '',
            video: '',
            x: 0,
            y: 0,
            x1: 0,
            y1: 0,
            points: [],
            pointsd: [],
            footer: '',
            author: '',
            alt: '',
            iVideo: 0,
            fVideo: 0,
            eText: '',
            iconType: 0,
            question: '',
            question_audio: '',
            toolTip: '',
            link: '',
            color: '#000000',
            fontSize: '14',
            map: {
                id: 'a' + id,
                url: '',
                alt: '',
                author: '',
                pts: [],
            },
            slides: [
                {
                    id: 's' + id,
                    title: '',
                    url: '',
                    author: '',
                    alt: '',
                    footer: '',
                },
            ],
            tests: [],
            activeSlide: 0,
            activeTest: 0,
        };
    },

    updateAreaPoints: function (x, y, x1, y1) {
        const topLeft = { x: Math.min(x, x1), y: Math.min(y, y1) },
            bottomRight = { x: Math.max(x, x1), y: Math.max(y, y1) },
            topRight = { x: bottomRight.x, y: topLeft.y },
            bottomLeft = { x: topLeft.x, y: bottomRight.y },
            vertices = [topLeft, topRight, bottomRight, bottomLeft];
        return vertices;
    },

    drawCurrentArea1: function () {
        const ctx = $exeDevice.ctx,
            currentPoints = $exeDevice.currentPoints,
            canvas = $exeDevice.canvas;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const rect = $('#mapaImage')[0].getBoundingClientRect();

        if (currentPoints.length < 2) return;

        ctx.beginPath();
        ctx.moveTo(
            Math.round(currentPoints[0].x * rect.width),
            Math.round(currentPoints[0].y * rect.height)
        );
        currentPoints.forEach((point) =>
            ctx.lineTo(
                Math.round(rect.width * point.x),
                Math.round(point.y * rect.height)
            )
        );
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
        ctx.fill();
    },

    drawCurrentArea2: function () {
        const ctx = $exeDevice.ctx,
            currentPoints = $exeDevice.currentPoints,
            canvas = $exeDevice.canvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const rect = $('#mapaImage')[0].getBoundingClientRect();

        if (currentPoints.length < 2) return;

        ctx.beginPath();
        ctx.moveTo(
            Math.round(currentPoints[0].x * rect.width),
            Math.round(currentPoints[0].y * rect.height)
        );
        currentPoints.forEach((point) =>
            ctx.lineTo(
                Math.round(rect.width * point.x),
                Math.round(point.y * rect.height)
            )
        );
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
        ctx.fill();
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.stroke();
    },

    drawCurrentArea: function () {
        const ctx = $exeDevice.ctx,
            currentPoints = $exeDevice.currentPoints,
            canvas = $exeDevice.canvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const rect = $('#mapaImage')[0].getBoundingClientRect();

        if (currentPoints.length === 1) {
            ctx.beginPath();
            const x = Math.round(currentPoints[0].x * rect.width),
                y = Math.round(currentPoints[0].y * rect.height);
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = 'red';
            ctx.fill();
            return;
        }

        if (currentPoints.length >= 2) {
            ctx.beginPath();
            ctx.moveTo(
                Math.round(currentPoints[0].x * rect.width),
                Math.round(currentPoints[0].y * rect.height)
            );
            currentPoints.forEach((point) =>
                ctx.lineTo(
                    Math.round(rect.width * point.x),
                    Math.round(point.y * rect.height)
                )
            );
            ctx.closePath();
            ctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
            ctx.fill();
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    },

    drawSavedAreas: function (backgroundImage) {
        const ctx = $exeDevice.ctx,
            canvas = $exeDevice.canvas,
            areas = $exeDevice.areas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
            backgroundImage,
            0,
            0,
            backgroundImage.width,
            backgroundImage.height
        );
        areas.forEach((area) => {
            if (area.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(area[0].x, area[0].y);
            area.forEach((point) => ctx.lineTo(point.x, point.y));
            ctx.closePath;
            ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
            ctx.fill();
        });
    },

    getDefaultSlide: function () {
        return {
            id: 's' + this.getID(),
            title: '',
            url: '',
            author: '',
            alt: '',
            footer: '',
        };
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            const wrapper = $('<div></div>');
            wrapper.html(originalHTML);

            const json = $('.mapa-DataGame', wrapper).text(),
                dataGame =
                    $exeDevices.iDevice.gamification.helpers.isJsonString(json),
                $imagesLink = $('.mapa-LinkImagesPoints', wrapper),
                $audiosLink = $('.mapa-LinkAudiosPoints', wrapper),
                $textLink = $('.mapa-LinkTextsPoints', wrapper),
                $imagesMap = $('.mapa-LinkImagesMapas', wrapper),
                $audiosIdentifyLink = $('.mapa-LinkAudiosIdentify', wrapper),
                $imagesSlides = $('.mapa-LinkImagesSlides', wrapper),
                $tooltipLinks = $('.mapa-LinkToolTipPoints', wrapper);

            if (dataGame.version < 3) {
                dataGame.evaluationG = dataGame.evaluation;
                dataGame.evaluation = dataGame.evaluationF;
                dataGame.evaluationID = dataGame.evaluationIDF;
            }

            dataGame.evaluation =
                typeof dataGame.evaluation == 'undefined'
                    ? false
                    : dataGame.evaluation;
            dataGame.evaluationID =
                typeof dataGame.evaluationID == 'undefined'
                    ? ''
                    : dataGame.evaluationID;

            dataGame.url = $('.mapa-ImageMap', wrapper).eq(0).attr('src');
            dataGame.url =
                typeof dataGame.url == 'undefined'
                    ? $('.mapa-ImageMap', wrapper).eq(0).attr('href')
                    : dataGame.url;

            $exeDevice.setMedias(
                dataGame.points,
                $imagesLink,
                $textLink,
                $audiosLink,
                $imagesMap,
                $audiosIdentifyLink,
                $imagesSlides,
                $tooltipLinks
            );
            $exeDevice.updateFieldGame(dataGame);
            let instructions = $('.mapa-instructions', wrapper);
            if (instructions.length == 1) {
                instructions = instructions.html() || '';
                $('#eXeGameInstructions').val(instructions);
            }

            let textAfter = $('.mapa-extra-content', wrapper);
            if (textAfter.length == 1) {
                textAfter = $exeDevice.clearTags(textAfter.html()) || '';
                $('#eXeIdeviceTextAfter').val(textAfter);
            }
            $exeDevicesEdition.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs
            );

            $exeDevice.initLevels(dataGame);
            $exeDevice.updateNumberQuestions();
            $exeDevice.updateQuestionsNumber();
        }
    },

    setMedias: function (
        pts,
        $images,
        $texts,
        $audios,
        $imgmpas,
        $audiosIdentifyLink,
        $imagesSlides,
        $toolTips
    ) {
        for (let i = 0; i < pts.length; i++) {
            let p = pts[i];
            p.color = typeof p.color == 'undefined' ? '#000000' : p.color;
            p.fontSize = typeof p.fontSize == 'undefined' ? '14' : p.fontSize;
            p.points =
                typeof p.points == 'undefined'
                    ? $exeDevice.updateAreaPoints(p.x, p.y, p.x1, p.y1)
                    : p.points;
            p.question_audio = p.question_audio || '';
            p.id = typeof p.id == 'undefined' ? 'p' + $exeDevice.getID() : p.id;
            p.tests = typeof p.tests == 'undefined' ? [] : p.tests;
            p.activeTest =
                typeof p.activeTest == 'undefined' ? 0 : p.activeTest;
            if (p.type != 5) {
                if (
                    p.type == 0 &&
                    typeof p.url != 'undefined' &&
                    !p.url.indexOf('http') == 0 &&
                    p.url.length > 4
                ) {
                    $exeDevice.setImage(p, $images);
                } else if (p.type == 2 && typeof p.eText != 'undefined') {
                    $exeDevice.setText(p, $texts);
                } else if (p.type == 7 && typeof p.toolTip != 'undefined') {
                    $exeDevice.setToolTip(p, $toolTips);
                }
                if (
                    p.type != 1 &&
                    typeof p.audio != 'undefined' &&
                    !p.audio.indexOf('http') == 0 &&
                    p.audio.length > 4
                ) {
                    $exeDevice.setAudio(p, $audios);
                }
                if (p.type == 2 && !p.video.length > 4) {
                    $exeDevice.hasYoutube = true;
                }
                if (
                    typeof p.question_audio != 'undefined' &&
                    !p.question_audio.indexOf('http') == 0 &&
                    p.question_audio.length > 4
                ) {
                    $exeDevice.setAudioIdentefy(p, $audiosIdentifyLink);
                }
                if (
                    p.type == 6 &&
                    typeof p.slides != 'undefined' &&
                    p.slides.length > 0
                ) {
                    for (let j = 0; j < p.slides.length; j++) {
                        let s = p.slides[j];
                        $exeDevice.setImageSlide(s, $imagesSlides);
                    }
                } else if (
                    p.type != 6 &&
                    (typeof p.slides == 'undefined' || p.slides.length == 0)
                ) {
                    p.slides = [];
                    p.slides.push($exeDevice.getDefaultSlide());
                    p.activeSlide = 0;
                }
            } else {
                if (
                    typeof p.map.url != 'undefined' &&
                    !p.map.url.indexOf('http') == 0 &&
                    p.map.url.length > 4
                ) {
                    $exeDevice.setImgMap(p, $imgmpas);
                }
                $exeDevice.setMedias(
                    p.map.pts,
                    $images,
                    $texts,
                    $audios,
                    $imgmpas,
                    $audiosIdentifyLink,
                    $imagesSlides,
                    $toolTips
                );
            }
        }
    },

    setImageSlide: function (s, $images) {
        $images.each(function () {
            let id = $(this).data('id'),
                type = true;
            if (typeof id == 'undefined') {
                type = false;
                id = $(this).text();
            }
            if (
                typeof s.id != 'undefined' &&
                typeof id != 'undefined' &&
                s.id == id
            ) {
                s.url = type ? $(this).attr('src') : $(this).attr('href');
                return;
            }
        });
    },

    setImage: function (p, $images) {
        $images.each(function () {
            let id = $(this).data('id'),
                type = true;
            if (typeof id == 'undefined') {
                type = false;
                id = $(this).text();
            }
            if (
                typeof p.id != 'undefined' &&
                typeof id != 'undefined' &&
                p.id == id
            ) {
                p.url = type ? $(this).attr('src') : $(this).attr('href');
                return;
            }
        });
    },

    setAudio: function (p, $audios) {
        $audios.each(function () {
            let id = $(this).data('id'),
                type = true;
            if (typeof id == 'undefined') {
                type = false;
                id = $(this).text();
            }
            if (
                typeof p.id != 'undefined' &&
                typeof id != 'undefined' &&
                p.id == id
            ) {
                p.audio = type ? $(this).attr('src') : $(this).attr('href');
                return;
            }
        });
    },

    setAudioIdentefy: function (p, $audios) {
        $audios.each(function () {
            let id = $(this).data('id'),
                type = true;
            if (typeof id == 'undefined') {
                type = false;
                id = $(this).text();
            }
            if (
                typeof p.id != 'undefined' &&
                typeof id != 'undefined' &&
                p.id == id
            ) {
                p.question_audio = type
                    ? $(this).attr('src')
                    : $(this).attr('href');
                return;
            }
        });
    },

    setText: function (p, $texts) {
        $texts.each(function () {
            let id = $(this).data('id');
            if (
                typeof p.id != 'undefined' &&
                typeof id != 'undefined' &&
                p.id == id
            ) {
                p.eText = $exeDevice.clearTags($(this).html());
                return;
            }
        });
    },

    setToolTip: function (p, $tt) {
        $tt.each(function () {
            let id = $(this).data('id');
            if (
                typeof p.id != 'undefined' &&
                typeof id != 'undefined' &&
                p.id == id
            ) {
                p.toolTip = $exeDevice.clearTags($(this).html());
                return;
            }
        });
    },

    setImgMap: function (p, $imgmap) {
        $imgmap.each(function () {
            let id = $(this).data('id'),
                type = true;
            if (typeof id == 'undefined') {
                type = false;
                id = $(this).text();
            }
            if (
                typeof p.id != 'undefined' &&
                typeof id != 'undefined' &&
                p.id == id
            ) {
                p.map.url = type ? $(this).attr('src') : $(this).attr('href');
                return;
            }
        });
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
        if ($exeDevice.levels.length > 1) {
            $exeDevice.showMessage($exeDevice.msgs.msgCloseMap);
            return false;
        }

        if ($exeDevice.slides.length > 0) {
            $exeDevice.showMessage($exeDevice.msgs.msgCloseSlide);
            return false;
        }

        let pvalid = $exeDevice.validatePoint(
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active]
        );
        if (pvalid === false) {
            return false;
        }

        $exeDevice.activeMap.pts[$exeDevice.activeMap.active] = pvalid;

        let evaluationG = parseInt($('input[name=mpevaluation]:checked').val());
        if (evaluationG == 4 && !$exeDevice.validateQuestion()) {
            return false;
        }

        let dataGame = $exeDevice.validateData();
        if (!dataGame) {
            return false;
        }

        let fields = this.ci18n,
            i18n = fields;
        for (let i in fields) {
            let fVal = $('#ci18n_' + i).val();
            if (fVal != '') i18n[i] = fVal;
        }

        dataGame.msgs = i18n;
        let divContent = '';
        if (dataGame.instructions != '')
            divContent =
                '<div class="mapa-instructions gameQP-instructions">' +
                $exeDevice.clearTags(dataGame.instructions) +
                '</div>';
        dataGame.textAfter = '';
        dataGame.instructions = '';

        let medias = $exeDevice.saveMedias(dataGame.points),
            json = JSON.stringify(dataGame);

        medias =
            medias.maps +
            medias.images +
            medias.audios +
            medias.texts +
            medias.slides +
            medias.tooltips;

        let html = '<div class="mapa-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html +=
            '<div class="mapa-version js-hidden">' +
            $exeDevice.version +
            '</div>';
        html += divContent;
        html += '<div class="mapa-DataGame js-hidden">' + json + '</div>';
        html +=
            '<img src="' +
            dataGame.url +
            '" class="js-hidden mapa-ImageMap" data-id="0" />';
        html += medias;
        let textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();
        if (textAfter != '') {
            html +=
                '<div class="mapa-extra-content">' +
                $exeDevice.clearTags(textAfter) +
                '</div>';
        }

        html +=
            '<div class="mapa-bns js-hidden">' +
            $exeDevice.msgs.msgNoSuportBrowser +
            '</div>';
        html += '</div>';
        return html;
    },

    clearTags(text) {
        const txt = text.replace(/\\"/g, '"');
        return txt;
    },

    saveMedias: function (pts) {
        let medias = {
            images: '',
            audios: '',
            texts: '',
            maps: '',
            slides: '',
            tooltips: '',
        };

        for (let i = 0; i < pts.length; i++) {
            let p = pts[i];
            if (p.type != 5) {
                if (
                    p.type == 0 &&
                    typeof p.url != 'undefined' &&
                    !p.url.indexOf('http') == 0 &&
                    p.url.length > 4
                ) {
                    medias.images +=
                        '<img src="' +
                        p.url +
                        '" class="js-hidden mapa-LinkImagesPoints" data-id="' +
                        p.id +
                        '">';
                } else if (p.type == 2 && typeof p.eText != 'undefined') {
                    medias.texts +=
                        '<div class="js-hidden mapa-LinkTextsPoints" data-id="' +
                        p.id +
                        '">' +
                        $exeDevice.clearTags(p.eText) +
                        '</div>';
                    p.eText = '';
                } else if (
                    p.type == 7 &&
                    typeof p.toolTip != 'undefined' &&
                    p.toolTip
                ) {
                    medias.tooltips +=
                        '<div class="js-hidden mapa-LinkToolTipPoints" data-id="' +
                        p.id +
                        '">' +
                        $exeDevice.clearTags(p.toolTip) +
                        '</div>';
                    p.toolTip = '';
                }
                if (
                    p.type != 1 &&
                    typeof p.audio != 'undefined' &&
                    !p.audio.indexOf('http') == 0 &&
                    p.audio.length > 4
                ) {
                    medias.audios +=
                        '<audio src="' +
                        p.audio +
                        '" preload="none" class="js-hidden mapa-LinkAudiosPoints" data-id="' +
                        p.id +
                        '"></audio>';
                }
                if (
                    p.question_audio != 'undefined' &&
                    !p.question_audio.indexOf('http') == 0 &&
                    p.question_audio.length > 4
                ) {
                    medias.audios +=
                        '<audio src="' +
                        p.question_audio +
                        '" preload="none" class="js-hidden mapa-LinkAudiosIdentify" data-id="' +
                        p.id +
                        '"></audio>';
                }
                if (
                    p.type == 6 &&
                    typeof p.slides != 'undefined' &&
                    p.slides.length > 0
                ) {
                    for (let j = 0; j < p.slides.length; j++) {
                        let s = p.slides[j];
                        medias.slides +=
                            '<img src="' +
                            s.url +
                            '" class=" js-hidden mapa-LinkImagesSlides" data-id="' +
                            s.id +
                            '">';
                    }
                }
            } else {
                medias.maps +=
                    '<img src="' +
                    p.map.url +
                    '" class="js-hidden mapa-LinkImagesMapas" data-id="' +
                    p.id +
                    '">';
                let rdata = $exeDevice.saveMedias(p.map.pts);
                medias.images += rdata.images;
                medias.audios += rdata.audios;
                medias.maps += rdata.maps;
                medias.texts += rdata.texts;
                medias.slides += rdata.slides;
                medias.tooltips += rdata.tooltips;
            }
        }
        return medias;
    },

    validateDataLevel: function () {
        const url = $('#mapaURLImageMap').val(),
            author = $('#mapaAuthorImageMap').val(),
            alt = $('#mapaAltImageMap').val();

        if (url.length < 4) {
            $exeDevice.showMessage($exeDevice.msgs.msgEURLValid);
            return false;
        }

        const vpp = $exeDevice.validatePoint(
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active]
        );
        if (vpp === false) return false;
        $exeDevice.activeMap.url = url;
        $exeDevice.activeMap.author = author;
        $exeDevice.activeMap.alt = alt;
        $exeDevice.activeMap.pts[$exeDevice.activeMap.active] = vpp;
        return true;
    },

    validatePoint: function (p) {
        const msgs = $exeDevice.msgs,
            url = $('#mapaURLImageMap').val();
        let message = '';

        p.title = $('#mapaTitle').val().trim();
        p.type = parseInt($('#mapaTypePointSelect').val());
        p.x = parseFloat($('#mapaX').val());
        p.y = parseFloat($('#mapaY').val());
        p.points = $exeDevice.currentPoints;
        p.footer = $('#mapaFooter').val();
        p.author = $('#mapaPAuthorImage').val();
        p.alt = $('#mapaPAltImage').val();
        p.url = $('#mapaURLImage').val().trim();
        p.video = $('#mapaURLYoutube').val().trim();
        p.iVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
            $('#mapaPInitVideo').val()
        );
        p.fVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
            $('#mapaPEndVideo').val()
        );
        p.audio = $('#mapaURLAudio').val().trim();
        p.iVideo = isNaN(p.iVideo) ? 0 : p.iVideo;
        p.fVideo = isNaN(p.fVideo) ? 3600 : p.fVideo;
        p.iconType = parseInt($('#mapaBtnDrop').data('value'));
        p.question = $('#mapaIdentify').val();
        p.question_audio = $('#mapaURLAudioIdentify').val();
        p.link = $('#mapaLink').val();
        p.color = $('#mapaColorTitle').val();
        p.fontSize = $('#mapaFontSizeTitle').val();

        if (tinyMCE.get('mapaToolTip')) {
            p.toolTip = tinyMCE.get('mapaToolTip').getContent();
        } else {
            p.toolTip = $('#mapaToolTip').val();
        }

        if (p.iconType == 1 && p.points.length > 2) {
            p.x = p.points[0].x;
            p.y = p.points[0].y;
        }

        if ($('#mapaPContainer').is(':visible')) {
            p.video = $('#mapaPURLYoutube').val().trim();
            p.url = $('#mapaPURLImage').val().trim();
            p.title = $('#mapaPTitle').val().trim();
            p.footer = $('#mapaPFooter').val();
            p.toolTip = $('#mapaToolTip').val().trim();
        }

        if (p.fVideo <= p.iVideo) p.fVideo = 36000;

        $exeDevice.stopSound();
        $exeDevice.stopVideo();
        if (url.length < 4) {
            $exeDevice.showMessage($exeDevice.msgs.msgEURLValid);
            return false;
        }

        p.eText = tinyMCE.get('mapaText').getContent();
        if (p.type == 1) {
            p.video = $exeDevices.iDevice.gamification.media.getIDYoutube(
                $('#mapaURLYoutube').val().trim()
            )
                ? $('#mapaURLYoutube').val()
                : '';
            if (p.video.length == 0) {
                p.video = $exeDevice.getIDMediaTeca(
                    $('#mapaURLYoutube').val().trim()
                )
                    ? $('#mapaURLYoutube').val()
                    : '';
            }
        }

        if (p.x == 0 && p.y == 0) {
            message = msgs.msgMarkPoint;
        }

        if (p.iconType == 1 && p.points.length < 3) {
            message = msgs.msgDrawArea;
        } else if (p.title.length == 0) {
            message = $exeDevice.msgs.msgTitle;
        } else if (p.type == 0 && p.url.length < 5) {
            message = msgs.msgEURLValid;
        } else if (p.type == 1 && p.video.length < 5) {
            message = msgs.msgECompleteURLYoutube;
        } else if (
            p.type == 1 &&
            (p.iVideo.length == 0 || p.fVideo.length == 0)
        ) {
            message = msgs.msgEStartEndVideo;
        } else if (p.type == 1 && p.iVideo >= p.fVideo) {
            message = msgs.msgEStartEndIncorrect;
        } else if (p.type == 2 && p.eText.length == 0) {
            message = msgs.msgWriteText;
        } else if (
            (p.type == 1 &&
                !$exeDevice.validTime($('#mapaPInitVideo').val())) ||
            !$exeDevice.validTime($('#mapaPEndVideo').val())
        ) {
            message = $exeDevice.msgs.msgTimeFormat;
        } else if (p.type == 3 && p.audio.length == 0) {
            message = msgs.msgSelectAudio;
        } else if (p.type == 7 && p.toolTip.length == 0) {
            message = msgs.msgWriteText;
        } else if (p.type == 8 && p.link.length == 0) {
            message = msgs.msgWriteLink;
        } else if (p.type == 5) {
            message = $exeDevice.validateMap(p.map);
        } else if (p.type == 9 && p.tests.length == 0) {
            message = msgs.msgWriteAnswer;
        }

        p.pointsd = [];
        for (let i = 0; i < p.points.length; i++) {
            let ps = {
                x: Math.round(p.points[i].x / $exeDevice.canvas.width),
                y: Math.round(p.points[i].y / $exeDevice.canvas.height),
            };
            p.pointsd.push(ps);
        }

        if (message.length == 0) {
            $exeDevice.updateQuestionsNumber();
            message = p;
        } else {
            $exeDevice.showMessage(message);
            message = false;
        }
        return message;
    },

    validateMap: function (map) {
        let message = '';
        if (
            typeof map == 'undefined' ||
            typeof map.pts == 'undefined' ||
            map.pts.length == 0 ||
            map.active >= map.pts.length
        ) {
            return (
                $exeDevice.msgs.msgErrorPointMap +
                ': ' +
                $exeDevice.msgs.msgEOnePoint
            );
        }

        const p = map.pts[map.active];
        if (map.url.length < 4) {
            message = $exeDevice.msgs.msgEURLValid;
        } else if (p.x == 0 && p.y == 0) {
            message = $exeDevice.msgs.msgMarkPoint;
        } else if (p.iconType == 1 && p.x1 == p.x && p.y == p.y1) {
            message = $exeDevice.msgs.msgDrawArea;
        } else if (p.title.length == 0) {
            message = $exeDevice.msgs.msgTitle;
        } else if (p.type == 0 && p.url.length < 5) {
            message = $exeDevice.msgs.msgEURLValid;
        } else if (p.type == 1 && p.video.length < 5) {
            message = $exeDevice.msgs.msgECompleteURLYoutube;
        } else if (
            p.type == 1 &&
            (p.iVideo.length == 0 || p.fVideo.length == 0)
        ) {
            message = $exeDevice.msgs.msgEStartEndVideo;
        } else if (p.type == 1 && p.iVideo >= p.fVideo) {
            message = $exeDevice.msgs.msgEStartEndIncorrect;
        } else if (p.type == 3 && p.audio.length == 0) {
            message = $exeDevice.msgs.msgSelectAudio;
        } else if (p.type == 2 && p.eText.length == 0) {
            message = $exeDevice.msgs.msgWriteText;
        } else if (p.type == 7 && p.toolTip.length == 0) {
            message = $exeDevice.msgs.msgWriteText;
        } else if (p.type == 8 && p.link.length < 4) {
            message = $exeDevice.msgs.msgWriteLink;
        }
        if (message.length > 0) {
            message = $exeDevice.msgs.msgErrorPointMap + ': ' + message;
        }
        return message;
    },

    clearSavePoints: function () {
        for (let i = 0; i < $exeDevice.activeMap.pts.length; i++) {
            const p = $exeDevice.activeMap.pts[i];
            let id = p.id.substring(1);
            if (p.type == 0) {
                p.video = '';
                p.eText = '';
                p.iVideo = 0;
                p.fVideo = 0;
                p.map = {};
                p.map.id = 'a' + id;
                p.map.pts = [];
                p.map.pts.push($exeDevice.getDefaultPoint());
                p.map.url = '';
                p.map.alt = '';
                p.map.author = '';
                p.map.active = 0;
            } else if (p.type == 1) {
                p.eText = '';
                p.url = '';
                p.audio = '';
                p.author = '';
                p.alt = '';
                p.map = {};
                p.map.id = 'a' + id;
                p.map.pts = [];
                p.map.pts.push($exeDevice.getDefaultPoint());
                p.map.url = '';
                p.map.alt = '';
                p.map.author = '';
                p.map.active = 0;
            } else if (p.type == 2) {
                p.video = '';
                p.url = '';
                p.author = '';
                p.alt = '';
                p.iVideo = 0;
                p.fVideo = 0;
                p.map = {};
                p.map.id = 'a' + id;
                p.map.pts = [];
                p.map.pts.push($exeDevice.getDefaultPoint());
                p.map.url = '';
                p.map.alt = '';
                p.map.author = '';
                p.map.active = 0;
            } else if (p.type == 3) {
                p.eText = '';
                p.video = '';
                p.url = '';
                p.author = '';
                p.alt = '';
                p.iVideo = 0;
                p.fVideo = 0;
                p.map = {};
                p.map.id = 'a' + id;
                p.map.pts = [];
                p.map.pts.push($exeDevice.getDefaultPoint());
                p.map.url = '';
                p.map.alt = '';
                p.map.author = '';
                p.map.active = 0;
            } else if (p.type == 4) {
                p.audio = '';
                p.eText = '';
                p.video = '';
                p.url = '';
                p.author = '';
                p.alt = '';
                p.iVideo = 0;
                p.fVideo = 0;
                p.map = {};
                p.map.id = 'a' + id;
                p.map.pts = [];
                p.map.pts.push($exeDevice.getDefaultPoint());
                p.map.url = '';
                p.map.alt = '';
                p.map.author = '';
                p.map.active = 0;
            } else if (p.type == 5) {
                p.audio = '';
                p.eText = '';
                p.video = '';
                p.author = '';
                p.alt = '';
                p.iVideo = 0;
                p.fVideo = 0;
                p.url = p.map.url;
                for (let j = 0; j < p.map.pts.length; j++) {
                    let q = $exeDevice.activeMap.pts[i];
                    if (q.type == 0) {
                        q.eText = '';
                        q.video = '';
                    } else if (q.type == 1) {
                        q.eText = '';
                        q.url = '';
                    } else if (q.type == 2) {
                        q.video = '';
                        q.url = '';
                    } else if (q.type == 3) {
                        q.eText = '';
                        q.video = '';
                        q.url = '';
                    } else if (q.type == 4) {
                        q.eText = '';
                        q.video = '';
                        q.url = '';
                    }
                }
            } else if (p.type == 6) {
                p.video = '';
                p.url = '';
                p.author = '';
                p.audio = '';
                p.alt = '';
                p.iVideo = 0;
                p.fVideo = 0;
                p.map = {};
                p.map.id = 'a' + id;
                p.map.pts = [];
                p.map.pts.push($exeDevice.getDefaultPoint());
                p.map.url = '';
                p.map.alt = '';
                p.map.author = '';
                p.map.active = 0;
            } else if (p.type == 7) {
                p.video = '';
                p.url = '';
                p.author = '';
                p.alt = '';
                p.iVideo = 0;
                p.fVideo = 0;
                p.map = {};
                p.map.id = 'a' + id;
                p.map.pts = [];
                p.map.pts.push($exeDevice.getDefaultPoint());
                p.map.url = '';
                p.map.alt = '';
                p.map.author = '';
                p.map.active = 0;
            } else if (p.type == 8) {
                p.video = '';
                p.url = '';
                p.author = '';
                p.audio = '';
                p.alt = '';
                p.iVideo = 0;
                p.fVideo = 0;
                p.map = {};
                p.map.id = 'a' + id;
                p.map.pts = [];
                p.map.pts.push($exeDevice.getDefaultPoint());
                p.map.url = '';
                p.map.alt = '';
                p.map.author = '';
                p.map.active = 0;
            }
        }
        return $exeDevice.activeMap.pts;
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
            textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent(),
            showMinimize = $('#mapaEShowMinimize').is(':checked'),
            hideScoreBar = $('#mapaEHideScoreBar').is(':checked'),
            hideAreas = $('#mapaEHideAreas').is(':checked'),
            showActiveAreas = $('#mapaEShowActiveAreas').is(':checked'),
            url = $('#mapaURLImageMap').val(),
            authorImage = $('#mapaAuthorImageMap').val(),
            altImage = $('#mapaAltImageMap').val(),
            itinerary =
                $exeDevicesEdition.iDevice.gamification.itinerary.getValues(),
            evaluationG = parseInt($('input[name=mpevaluation]:checked').val()),
            showSolution = $('#mapaEShowSolution').is(':checked'),
            timeShowSolution = parseInt(
                clear($('#mapaETimeShowSolution').val())
            ),
            percentajeIdentify = parseInt(
                clear($('#mapaPercentajeIdentify').val())
            ),
            percentajeShowQ = parseInt(clear($('#mapaPercentajeShowQ').val())),
            percentajeQuestions = parseInt(
                clear($('#mapaPercentajeQuestions').val())
            ),
            autoShow = $('#mapaEAutoShow').is(':checked') || false,
            optionsNumber = parseInt(clear($('#mapaNumOptions').val())),
            evaluation = $('#mapaEEvaluation').is(':checked'),
            evaluationID = $('#mapaEEvaluationID').val(),
            id = $exeDevice.getIdeviceID(),
            order = $('#mapaSolutionOrder').val();

        if (!itinerary) return;

        let points = $exeDevice.activeMap.pts,
            autoAudio = $('#mapaEAutoAudio').is(':checked') || false;

        if (points.length == 0) {
            eXe.app.alert($exeDevice.msgs.msgEOnePoint);
            return false;
        }

        if (url.length < 4) {
            $exeDevice.showMessage($exeDevice.msgs.msgEURLValid);
            return false;
        }

        if (evaluation && evaluationID.length < 5) {
            eXe.app.alert($exeDevice.msgs.msgIDLenght);
            return false;
        }

        if (evaluationG == 5 && order && order.length == 0) {
            $exeDevice.showMessage($exeDevice.msgs.msgSolutionOrder);
            return false;
        }

        for (let i = 0; i < points.length; i++) {
            let mpoint = points[i];
            if (mpoint.title.length == 0) {
                $exeDevice.showMessage($exeDevice.msgs.msgProvideTitle);
                return false;
            } else if (mpoint.type == 0 && mpoint.url.length < 5) {
                $exeDevice.showMessage($exeDevice.msgs.msgEURLValid);
                return false;
            } else if (
                mpoint.type == 1 &&
                !$exeDevices.iDevice.gamification.media.getIDYoutube(
                    mpoint.video
                ) &&
                !$exeDevice.getIDMediaTeca(mpoint.video)
            ) {
                $exeDevice.showMessage($exeDevice.msgs.msgECompleteURLYoutube);
                return false;
            } else if (mpoint.type == 2 && mpoint.eText.length == 0) {
                $exeDevice.showMessage($exeDevice.msgs.msgWriteText);
                return false;
            } else if (mpoint.type == 5) {
                if (mpoint.map.url.length < 4) {
                    $exeDevice.showMessage($exeDevice.msgs.msgEURLValid);
                    return false;
                } else if (
                    typeof mpoint.map.pts == 'undefined' ||
                    mpoint.map.pts.length == 0
                ) {
                    $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
                    return false;
                }
                for (let j = 0; j < mpoint.map.pts.length; j++) {
                    let vpp = mpoint.map.pts[j];
                    if (vpp.title.length == 0) {
                        $exeDevice.showMessage($exeDevice.msgs.msgProvideTitle);
                        return false;
                    } else if (vpp.type == 0 && vpp.url.length < 5) {
                        $exeDevice.showMessage($exeDevice.msgs.msgEURLValid);
                        return false;
                    } else if (
                        vpp.type == 1 &&
                        !$exeDevices.iDevice.gamification.media.getIDYoutube(
                            vpp.video
                        ) &&
                        !$exeDevices.iDevice.gamification.media.getIDYoutube(
                            mpoint.video
                        )
                    ) {
                        $exeDevice.showMessage(
                            $exeDevice.msgs.msgECompleteURLYoutube
                        );
                        return false;
                    } else if (vpp.type == 2 && vpp.eText.length == 0) {
                        $exeDevice.showMessage($exeDevice.msgs.msgWriteText);
                        return false;
                    } else if (vpp.type == 3 && vpp.audio.trim().length == 0) {
                        $exeDevice.showMessage($exeDevice.msgs.msgSelectAudio);
                        return false;
                    } else if (vpp.x == 0 && vpp.y == 0) {
                        $exeDevice.showMessage($exeDevice.msgs.msgMarkPoint);
                    }
                }
            }
        }

        if (evaluationG == 2 || evaluationG == 3) autoAudio = true;
        points = $exeDevice.clearSavePoints();

        let scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();
        let data = {
            typeGame: 'Mapa',
            instructions: instructions,
            showMinimize: showMinimize,
            showActiveAreas: showActiveAreas,
            author: '',
            url: url,
            authorImage: authorImage,
            altImage: altImage,
            itinerary: itinerary,
            points: points,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted,
            textAfter: textAfter,
            evaluationG: evaluationG,
            selectsGame: $exeDevice.selectsGame,
            isNavigable: true,
            showSolution: showSolution,
            timeShowSolution: timeShowSolution,
            version: 3,
            percentajeIdentify: percentajeIdentify,
            percentajeShowQ: percentajeShowQ,
            percentajeQuestions: percentajeQuestions,
            autoShow: autoShow,
            autoAudio: autoAudio,
            optionsNumber: optionsNumber,
            evaluation: evaluation,
            evaluationID: evaluationID,
            id: id,
            order: order,
            hideScoreBar: hideScoreBar,
            hideAreas: hideAreas,
        };
        return data;
    },

    showImageMap: function (url, x, y, alt, icontype) {
        let $image = $('#mapaImage'),
            $noImage = $('#mapaNoImage'),
            $protector = $('#mapaProtector');
        $protector.hide();
        $image.attr('alt', alt);
        $noImage.show();
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
                    let mData = $exeDevice.placeImageWindows(
                        this,
                        this.naturalWidth,
                        this.naturalHeight
                    );
                    $exeDevice.drawImage(this, mData);
                    $exeDevice.canvas.width = mData.w;
                    $exeDevice.canvas.height = mData.h;
                    $noImage.hide();
                    if (icontype == 1) {
                        $exeDevice.paintAreaPoints($exeDevice.currentPoints);
                    } else if (icontype == 84) {
                        $exeDevice.paintTextLink(x, y);
                    } else {
                        $exeDevice.paintMouse(x, y);
                    }
                    $protector.css({
                        left: mData.x + 'px',
                        top: mData.y + 'px',
                        width: mData.w + 'px',
                        height: mData.h + 'px',
                    });
                    $('#mapaCanvas').css({
                        left: mData.x + 'px',
                        top: mData.y + 'px',
                        width: mData.w + 'px',
                        height: mData.h + 'px',
                    });
                    $protector.show();
                    return true;
                }
            })
            .on('error', function () {
                return false;
            });
    },

    showImage: function (url, alt) {
        const $image = $('#mapaPImage'),
            $noImage = $('#mapaPNoImage'),
            $video = $('#mapaPVideo'),
            $videoLocal = $('#mapaEVideoLocal'),
            $noVideo = $('#mapaPNoVideo');
        $video.hide();
        $videoLocal.hide();
        $noVideo.hide();
        $image.hide();
        $image.attr('alt', alt);
        $noImage.show();
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
                    $noImage.hide();
                    return true;
                }
            })
            .on('error', function () {
                return false;
            });
    },

    showImageSlide: function (url, alt) {
        const $image = $('#mapaSImage'),
            $noImage = $('#mapaSNoImage');
        $image.hide();
        $image.attr('alt', alt);
        $noImage.show();
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
                    $noImage.hide();
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
        $exeDevice.playerAudio.addEventListener('canplaythrough', function () {
            $exeDevice.playerAudio.play();
        });
    },

    stopSound: function () {
        if (
            $exeDevice.playerAudio &&
            typeof $exeDevice.playerAudio.pause == 'function'
        ) {
            $exeDevice.playerAudio.pause();
        }
    },

    paintMouse: function (x, y) {
        const $image = $('#mapaImage'),
            $cursor = $('#mapaCursor'),
            $area = $('#mapaArea'),
            $textLink = $('#mapaTextLink'),
            $canvas = $('#mapaCanvas'),
            $control = $('#mapaControls');

        $textLink.hide();
        $area.hide();
        $canvas.hide();
        $control.hide();
        $('#mapaTextLinkDiv').hide();
        $('#mapaIconPoint').show();
        if (x > 0 || y > 0) {
            const wI = $image.width() > 0 ? $image.width() : 1,
                hI = $image.height() > 0 ? $image.height() : 1,
                iw = parseInt($('#mapaCursor').width() * $exeDevice.iconX),
                ih = parseInt($('#mapaCursor').height() * $exeDevice.iconY),
                lI = $image.position().left + wI * x - iw,
                tI = $image.position().top + hI * y - ih;
            $cursor.css({
                left: lI + 'px',
                top: tI + 'px',
                'z-index': 10,
            });
            $cursor.show();
        }
    },

    paintAreaPoints: function (points) {
        const $cursor = $('#mapaCursor'),
            $area = $('#mapaArea'),
            $textLink = $('#mapaTextLink'),
            $canvas = $('#mapaCanvas'),
            $control = $('#mapaControls');

        $textLink.hide();
        $cursor.hide();
        $area.hide();
        $canvas.show();
        $control.css('display', 'flex');
        $('#mapaIconPoint').show();
        $('#mapaTextLinkDiv').hide();
        $exeDevice.currentPoints = [];
        $exeDevice.redoPoints = [];
        if (points.length < 3) {
            return;
        }
        $exeDevice.currentPoints = points;
        $exeDevice.redoPoints = points;
        $exeDevice.drawCurrentArea();
    },

    paintTextLink: function (x, y) {
        const $image = $('#mapaImage'),
            $cursor = $('#mapaCursor'),
            $area = $('#mapaArea'),
            $textLink = $('#mapaTextLink'),
            text = $('#mapaTitle').val(),
            $canvas = $('#mapaCanvas'),
            $control = $('#mapaControls');

        $area.hide();
        $cursor.hide();
        $canvas.hide();
        $control.hide();
        $('#mapaTextLinkDiv').css('display', 'flex');
        $('#mapaIconPoint').hide();
        if (x > 0 || y > 0) {
            const wI = $image.width() > 0 ? $image.width() : 1,
                hI = $image.height() > 0 ? $image.height() : 1,
                wm = $('#mapaTextLink').width() / 2,
                lI = $image.position().left + wI * x - wm,
                tI = $image.position().top + hI * y;
            $textLink.css({
                left: lI + 'px',
                top: tI + 'px',
                'z-index': 10,
            });
        }
        $textLink.text(text);
        $textLink.show();
    },

    drawImage: function (image, mData) {
        $(image).css({
            left: mData.x + 'px',
            top: mData.y + 'px',
            width: mData.w + 'px',
            height: mData.h + 'px',
        });
        $(image).show();
    },

    addEvents: function () {
        $('#mapaPInitVideo, #mapaPEndVideo').on('focusout', function () {
            if (!$exeDevice.validTime(this.value)) {
                $(this).css({
                    'background-color': 'red',
                    color: 'white',
                });
            }
        });

        $('#mapaPInitVideo, #mapaPEndVideo').on('click', function () {
            $(this).css({
                'background-color': 'white',
                color: '#2c6d2c',
            });
        });

        $('.MQE-ESolution').on('change', function () {
            const marcado = $(this).is(':checked'),
                value = $(this).val();
            $exeDevice.clickSolution(marcado, value);
        });

        $('.MQE-PESolution').on('change', function () {
            const marcado = $(this).is(':checked'),
                value = $(this).val();
            $exeDevice.clickPointSolution(marcado, value);
        });

        $('#mapaTypePointSelect').on('change', function () {
            let type = parseInt($(this).val());
            $exeDevice.changeTypePoint(type);
        });

        $('#mapaEAdd').on('click', function (e) {
            e.preventDefault();
            $exeDevice.addPoint();
        });

        $('#mapaEFirst').on('click', function (e) {
            e.preventDefault();
            $exeDevice.firstPoint();
        });

        $('#mapaEPrevious').on('click', function (e) {
            e.preventDefault();
            $exeDevice.previousPoint();
        });

        $('#mapaENext').on('click', function (e) {
            e.preventDefault();
            $exeDevice.nextPoint();
        });

        $('#mapaELast').on('click', function (e) {
            e.preventDefault();
            $exeDevice.lastPoint();
        });

        $('#mapaEDelete').on('click', function (e) {
            e.preventDefault();
            $exeDevice.removePoint();
        });

        $('#mapaECopy').on('click', function (e) {
            e.preventDefault();
            $exeDevice.copyPoint();
        });

        $('#mapaECut').on('click', function (e) {
            e.preventDefault();
            $exeDevice.cutPoint();
        });

        $('#mapaEPaste').on('click', function (e) {
            e.preventDefault();
            $exeDevice.pastePoint();
        });

        $('#mapaEAddSlide').on('click', function (e) {
            e.preventDefault();
            $exeDevice.addSlide();
        });

        $('#mapaEFirstSlide').on('click', function (e) {
            e.preventDefault();
            $exeDevice.firstSlide();
        });

        $('#mapaEPreviousSlide').on('click', function (e) {
            e.preventDefault();
            $exeDevice.previousSlide();
        });

        $('#mapaENextSlide').on('click', function (e) {
            e.preventDefault();
            $exeDevice.nextSlide();
        });

        $('#mapaELastSlide').on('click', function (e) {
            e.preventDefault();
            $exeDevice.lastSlide();
        });

        $('#mapaEDeleteSlide').on('click', function (e) {
            e.preventDefault();
            $exeDevice.removeSlide();
        });

        $('#mapaECopySlide').on('click', function (e) {
            e.preventDefault();
            $exeDevice.copySlide();
        });

        $('#mapaECutSlide').on('click', function (e) {
            e.preventDefault();
            $exeDevice.cutSlide();
        });

        $('#mapaEPasteSlide').on('click', function (e) {
            e.preventDefault();
            $exeDevice.pasteSlide();
        });

        $('#mapaEAddQ').on('click', function (e) {
            e.preventDefault();
            $exeDevice.addQuestion();
        });

        $('#mapaEFirstQ').on('click', function (e) {
            e.preventDefault();
            $exeDevice.firstQuestion();
        });

        $('#mapaEPreviousQ').on('click', function (e) {
            e.preventDefault();
            $exeDevice.previousQuestion();
        });

        $('#mapaENextQ').on('click', function (e) {
            e.preventDefault();
            $exeDevice.nextQuestion();
        });

        $('#mapaELastQ').on('click', function (e) {
            e.preventDefault();
            $exeDevice.lastQuestion();
        });

        $('#mapaEDeleteQ').on('click', function (e) {
            e.preventDefault();
            $exeDevice.removeQuestion();
        });

        $('#mapaECopyQ').on('click', function (e) {
            e.preventDefault();
            $exeDevice.copyQuestion();
        });

        $('#mapaECutQ').on('click', function (e) {
            e.preventDefault();
            $exeDevice.cutQuestion();
        });

        $('#mapaEPasteQ').on('click', function (e) {
            e.preventDefault();
            $exeDevice.pasteQuestion();
        });

        $('#mapaEAddQ1').on('click', function (e) {
            e.preventDefault();
            $exeDevice.addPointQuestion();
        });

        $('#mapaEFirstQ1').on('click', function (e) {
            e.preventDefault();
            $exeDevice.firstPointQuestion();
        });

        $('#mapaEPreviousQ1').on('click', function (e) {
            e.preventDefault();
            $exeDevice.previousPointQuestion();
        });

        $('#mapaENextQ1').on('click', function (e) {
            e.preventDefault();
            $exeDevice.nextPointQuestion();
        });

        $('#mapaELastQ1').on('click', function (e) {
            e.preventDefault();
            $exeDevice.lastPointQuestion();
        });

        $('#mapaEDeleteQ1').on('click', function (e) {
            e.preventDefault();
            $exeDevice.removePointQuestion();
        });

        $('#mapaECopyQ1').on('click', function (e) {
            e.preventDefault();
            $exeDevice.copyPointQuestion();
        });

        $('#mapaECutQ1').on('click', function (e) {
            e.preventDefault();
            $exeDevice.cutPointQuestion();
        });

        $('#mapaEPasteQ1').on('click', function (e) {
            e.preventDefault();
            $exeDevice.pastePointQuestion();
        });

        $('#mapaETimeShowSolution').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 1);
            this.value = v;
        });

        $('#mapaETimeShowSolution').on('focusout', function () {
            this.value = this.value.trim() == '' ? 3 : this.value;
            this.value = this.value > 9 ? 9 : this.value;
            this.value = this.value < 1 ? 1 : this.value;
        });

        $('#mapaPercentageShow').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 3);
            this.value = v;
        });

        $('#mapaPercentageShow').on('focusout', function () {
            this.value = this.value.trim() == '' ? 35 : this.value;
            this.value = this.value > 100 ? 100 : this.value;
            this.value = this.value < 0 ? 0 : this.value;
        });

        $('#mapaPercentajeIdentify').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 3);
            this.value = v;
            if (this.value > 0 && this.value < 101) {
                $exeDevice.updateQuestionsNumber();
            }
        });

        $('#mapaPercentajeIdentify').on('click', function () {
            $exeDevice.updateQuestionsNumber();
        });
        $('#mapaPercentajeIdentify').on('focusout', function () {
            this.value = this.value.trim() == '' ? 100 : this.value;
            this.value = this.value > 100 ? 100 : this.value;
            this.value = this.value < 1 ? 1 : this.value;
            $exeDevice.updateQuestionsNumber();
        });

        $('#mapaPercentajeShowQ').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 3);
            this.value = v;
            if (this.value > 0 && this.value < 101) {
                $exeDevice.updateShowQ();
            }
        });

        $('#mapaPercentajeShowQ').on('click', function () {
            $exeDevice.updateShowQ();
        });

        $('#mapaPercentajeShowQ').on('focusout', function () {
            this.value = this.value.trim() == '' ? 100 : this.value;
            this.value = this.value > 100 ? 100 : this.value;
            this.value = this.value < 1 ? 1 : this.value;
            $exeDevice.updateShowQ();
        });

        $('#mapaPercentajeQuestions').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 3);
            this.value = v;
            if (this.value > 0 && this.value < 101) {
                $exeDevice.updateNumberQuestions();
            }
        });

        $('#mapaPercentajeQuestions').on('click', function () {
            $exeDevice.updateNumberQuestions();
        });

        $('#mapaPercentajeQuestions').on('focusout', function () {
            this.value = this.value.trim() == '' ? 100 : this.value;
            this.value = this.value > 100 ? 100 : this.value;
            this.value = this.value < 1 ? 1 : this.value;
            $exeDevice.updateNumberQuestions();
        });

        $('#mapaPInitVideo').css('color', '#2c6d2c');
        $('#mapaPInitVideo').on('click', function (e) {
            e.preventDefault();
            $exeDevice.timeVideoFocus = 0;
            $('#mapaPInitVideo').css('color', '#2c6d2c');
            $('#mapaPEndVideo').css('color', '#333');
        });

        $('#mapaPEndVideo').on('click', function (e) {
            e.preventDefault();
            $exeDevice.timeVideoFocus = 1;
            $('#mapaPEndVideo').css('color', '#2c6d2c');
        });

        $('#mapaPVideoTime').on('click', function (e) {
            e.preventDefault();
            let $timeV = '';
            switch ($exeDevice.timeVideoFocus) {
                case 0:
                    $timeV = $('#mapaPInitVideo');
                    break;
                case 1:
                    $timeV = $('#mapaPEndVideo');
                    break;
                default:
                    break;
            }
            $timeV.val($('#mapaPVideoTime').text());
            $timeV.css({
                'background-color': 'white',
                color: '#2c6d2c',
            });
        });

        $('#mapaURLImageMap').on('change', function () {
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $(this).val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (
                selectedFile.indexOf('files') == 0 &&
                validExt.indexOf(ext) == -1
            ) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
                return false;
            }
            const url = selectedFile,
                alt = $('#mapaAltImageMap').val(),
                x = parseFloat($('#mapaX').val()),
                y = parseFloat($('#mapaY').val()),
                icon = parseInt($('#mapaBtnDrop').data('value'));
            $exeDevice.showImageMap(url, x, y, alt, icon);
        });

        $('#mapaShowImageMap').on('click', function (e) {
            e.preventDefault();
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $('#mapaURLImageMap').val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (selectedFile.length < 5) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
            }
            if (
                selectedFile.indexOf('files') == 0 &&
                validExt.indexOf(ext) == -1
            ) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
                return false;
            }
            const url = selectedFile,
                alt = $('#mapaAltImageMap').val(),
                x = parseFloat($('#mapaX').val()),
                y = parseFloat($('#mapaY').val()),
                icon = parseInt($('#mapaBtnDrop').data('value'));
            $exeDevice.showImageMap(url, x, y, alt, icon);
        });

        $('#mapaShowImage').on('click', function (e) {
            e.preventDefault();
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $('#mapaURLImage').val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (selectedFile.length < 5) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
            }
            if (
                selectedFile.indexOf('files') == 0 &&
                validExt.indexOf(ext) == -1
            ) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
                return false;
            }
            const url = selectedFile,
                alt = $('#mapaAltImageMap').val();
            $exeDevice.showImage(url, alt);
            $('#mapaMultimediaPoint').fadeIn();
        });

        $('#mapaSShowImage').on('click', function (e) {
            e.preventDefault();
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $('#mapaSURLImage').val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (selectedFile.length < 5) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
            }
            if (
                selectedFile.indexOf('files') == 0 &&
                validExt.indexOf(ext) == -1
            ) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
                return false;
            }
            const url = selectedFile,
                alt = $('#mapaSAltImage').val();
            $exeDevice.showImageSlide(url, alt);
        });
        $('#mapaSURLImage').on('change', function () {
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $(this).val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (
                selectedFile.indexOf('files') == 0 &&
                validExt.indexOf(ext) == -1
            ) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
                return false;
            }
            const alt = $('#mapaSAltImage').val();
            $exeDevice.showImageSlide(selectedFile, alt);
        });

        $('#mapaMultimediaPoint').on('click', function () {
            $(this).fadeOut();
        });

        $('#gameQEIdeviceForm').on('click', 'input.MQE-Number', function () {
            let number = parseInt($(this).val());
            $exeDevice.showOptions(number);
        });

        $('#gameQEIdeviceForm').on('click', 'input.MQE-PNumber', function () {
            let number = parseInt($(this).val());
            $exeDevice.showPointOptions(number);
        });

        $('#mapaMoreImageMap').on('click', function (e) {
            e.preventDefault();
            const $el = $('#mapaMoreImage');
            $el.stop(true, true);
            if ($el.is(':visible')) {
                const hActual = $el.outerHeight();
                $el.css({ height: hActual + 'px', overflow: 'hidden' });
                $el.animate({ height: 0, opacity: 0 }, 100, function () {
                    $el.css({
                        display: 'none',
                        height: '',
                        opacity: '',
                        overflow: '',
                    });
                });
            } else {
                $el.css({ display: 'flex', height: 'auto', opacity: 1 });
                const hDestino = $el.outerHeight();
                $el.css({ height: 0, opacity: 0, overflow: 'hidden' });
                $el.animate({ height: hDestino, opacity: 1 }, 100, function () {
                    $el.css({ height: '', opacity: '', overflow: '' });
                });
            }
        });

        $('#mapaIdentifyMoreAudio').on('click', function (e) {
            e.preventDefault();
            $('#mapaDataIdentifyAudio').slideToggle();
        });

        $('#mapaProtector').on('mousedown', function (e) {
            let iconType = parseInt($('#mapaBtnDrop').data('value')),
                evaluationG = parseInt(
                    $('input[name=mpevaluation]:checked').val()
                );
            if (iconType == 1 && evaluationG != 1) {
                $exeDevice.xA = e.pageX;
                $exeDevice.yA = e.pageY;
            } else if (iconType == 84 && evaluationG != 1) {
                $exeDevice.clickImageTitle(this, e.pageX, e.pageY);
            } else {
                $exeDevice.clickImage(this, e.pageX, e.pageY);
            }
        });

        $('#mapaProtector').on('mouseup', function (e) {
            let iconType = parseInt($('#mapaBtnDrop').data('value')),
                evaluationG = parseInt(
                    $('input[name=mpevaluation]:checked').val()
                );
            if (iconType == 1 && evaluationG != 1) {
                $exeDevice.clickArea(
                    $exeDevice.xA,
                    $exeDevice.yA,
                    e.pageX,
                    e.pageY
                );
                $exeDevice.xA = 0;
                $exeDevice.yA = 0;
            }
        });

        $('#mapaNumberPoint').keyup(function (e) {
            if (e.keyCode == 13) {
                let num = parseInt($(this).val());
                if (!isNaN(num) && num > 0) {
                    num =
                        num < $exeDevice.activeMap.pts.length
                            ? num - 1
                            : $exeDevice.activeMap.pts.length - 1;
                    if (
                        $exeDevice.validatePoint(
                            $exeDevice.activeMap.pts[num]
                        ) !== false
                    ) {
                        $exeDevice.activeMap.active = num;
                        $exeDevice.showPoint($exeDevice.activeMap.active);
                    } else {
                        $(this).val($exeDevice.activeMap.active + 1);
                    }
                } else {
                    $(this).val($exeDevice.activeMap.active + 1);
                }
            }
        });

        $('#mapaNumberPoint1').keyup(function (e) {
            if (e.keyCode == 13) {
                let num = parseInt($(this).val());
                if (!isNaN(num) && num > 0) {
                    num =
                        num < $exeDevice.activeMap.pts.length
                            ? num - 1
                            : $exeDevice.activeMap.pts.length - 1;
                    if (
                        $exeDevice.validatePoint(
                            $exeDevice.activeMap.pts[num]
                        ) !== false
                    ) {
                        $exeDevice.activeMap.active = num;
                        $exeDevice.showPoint($exeDevice.activeMap.active);
                    } else {
                        $(this).val($exeDevice.activeMap.active + 1);
                    }
                } else {
                    $(this).val($exeDevice.activeMap.active + 1);
                }
            }
        });

        $('#gameQEIdeviceForm').on(
            'click',
            'input.MQE-TypeSelect',
            function () {
                const type = parseInt($(this).val());
                $exeDevice.showTypeQuestion(type);
            }
        );
        $('#gameQEIdeviceForm').on(
            'click',
            'input.MQE-PTypeSelect',
            function () {
                const type = parseInt($(this).val());
                $exeDevice.showTypePointQuestion(type);
            }
        );
        $('#gameQEIdeviceForm').on(
            'click',
            'input.MQE-TypeEvaluation',
            function () {
                const type = parseInt($(this).val());
                $('#mapaSolutionData').css('display', 'flex');
                if (type == 4) {
                    $('#mapaFQuestions').show();
                    $('#mapaEvaluationData').show();
                    $('#mapaEShowSolution').show();
                    $('label[for=mapaEShowSolution]').show();
                    $('#mapaETimeShowSolution').prop(
                        'disabled',
                        !$('#mapaEShowSolution').is(':checked')
                    );
                } else {
                    $('#mapaFQuestions').hide();
                    $('#mapaEvaluationData').hide();
                    $('#mapaEShowSolution').hide();
                    $('label[for=mapaEShowSolution]').hide();
                    $('#mapaETimeShowSolution').prop('disabled', false);
                }
                $('#mapaSolutionOrderDiv').hide();
                if (type == 5) {
                    $('#mapaSolutionOrderDiv').css('display', 'flex');
                    $('#mapaSolutionData').hide();
                }
                $('#mapaEAutoAudioDiv').hide();
                $('#mapaEAutoShowDiv').hide();

                $('#mapaNumOptionsData').hide();
                if (type == 1) {
                    $('#mapaNumOptionsData').css('display', 'flex');
                }
                if (type == 0 || type == 4) {
                    $('#mapaEAutoShowDiv').show();
                    $('#mapaEAutoAudioDiv').show();
                }
                if (type == 1 || type == 2 || type == 3) {
                    $('#mapaDataIdentifica').show();
                } else {
                    $('#mapaDataIdentifica').hide();
                }
                $('#mapaIconTypeDiv').show();
                if (type == 1) {
                    $('#mapaIconTypeDiv').hide();
                }
                $('#mapaEvaluationIdentify').hide();
                if (type == 2 || type == 3) {
                    $('#mapaEvaluationIdentify').css('display', 'flex');
                }
                if (type == 0 || type == 6) {
                    $('#mapaSolutionData').hide();
                }
                $exeDevice.loadIcon();
            }
        );

        $('#mapaURLImage').on('change', function () {
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $(this).val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (
                selectedFile.indexOf('files') == 0 &&
                validExt.indexOf(ext) == -1
            ) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
                return false;
            }
            const alt = $('#mapaPAltImage').val();
            $('#mapaPURLImage').val(selectedFile);
            $('#mapaPTitle').val($('#mapaTitle').val());
            $('#mapaPFooter').val($('#mapaFooter').val());
            $('#mapaPContainer').css('display', 'flex');
            $('#mapaCubierta').css('display', 'flex');
            $('#mapaCubierta').show();
            $exeDevice.showImage(selectedFile, alt);
        });

        $('#mapaPURLImage').on('change', function () {
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $(this).val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (
                selectedFile.indexOf('files') == 0 &&
                validExt.indexOf(ext) == -1
            ) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
                return false;
            }
            const alt = $('#mapaPAltImage').val();
            $('#mapaURLImage').val(selectedFile);
            $('#mapaTitle').val($('#mapaPTitle').val());
            $('#mapaFooter').val($('#mapaPFooter').val());
            $exeDevice.showImage(selectedFile, alt);
        });

        $('#mapaEShowSolution').on('change', function () {
            const checked = $(this).is(':checked');
            $('#mapaETimeShowSolution').prop('disabled', !checked);
        });

        $('#mapaShowImage').on('click', function (e) {
            e.preventDefault();
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $('#mapaURLImage').val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (selectedFile.length < 5) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
            }
            if (
                selectedFile.indexOf('files') == 0 &&
                validExt.indexOf(ext) == -1
            ) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
                return false;
            }
            let alt = $('#mapaPAltImage').val();
            $('#mapaPContainer').css('display', 'flex');
            $('#mapaCubierta').css('display', 'flex');
            $('#mapaCubierta').show();
            $('#mapaPURLImage').val(selectedFile);
            $('#mapaPTitle').val($('#mapaTitle').val());
            $('#mapaPFooter').val($('#mapaFooter').val());
            $exeDevice.showImage(selectedFile, alt);
        });

        $('#mapaPShowImage').on('click', function (e) {
            e.preventDefault();
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $('#mapaPURLImage').val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (selectedFile.length < 5) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
            }
            if (
                selectedFile.indexOf('files') == 0 &&
                validExt.indexOf(ext) == -1
            ) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
                return false;
            }
            const alt = $('#mapaPAltImage').val();
            $('#mapaURLImage').val(selectedFile);
            $('#mapaTitle').val($('#mapaPTitle').val());
            $('#mapaFooter').val($('#mapaPFooter').val());
            $exeDevice.showImage(selectedFile, alt);
        });

        $('#mapaPClose').on('click', function (e) {
            e.preventDefault();
            $('#mapaURLImage').val($('#mapaPURLImage').val());
            $('#mapaTitle').val($('#mapaPTitle').val());
            $('#mapaFooter').val($('#mapaPFooter').val());
            $('#mapaURLYoutube').val($('#mapaPURLYoutube').val());
            $exeDevice.stopVideo();
            $exeDevice.stopSound();
            $('#mapaPContainer').fadeOut();
            $('#mapaCubierta').hide();
        });

        $('#mapaPlayVideo').on('click', function (e) {
            e.preventDefault();
            if (
                $exeDevices.iDevice.gamification.media.getIDYoutube(
                    $('#mapaURLYoutube').val().trim()
                )
            ) {
                $('#mapaPURLYoutube').val($('#mapaURLYoutube').val());
                if (typeof YT == 'undefined') {
                    $exeDevice.isVideoType = true;
                    $exeDevice.loadYoutubeApi();
                } else {
                    $exeDevice.showVideoPoint();
                }
            } else if (
                $exeDevice.getIDMediaTeca($('#mapaURLYoutube').val().trim())
            ) {
                $('#mapaPURLYoutube').val($('#mapaURLYoutube').val());
                $exeDevice.showVideoPoint();
            } else {
                $exeDevice.showMessage($exeDevice.msgs.msgECompleteURLYoutube);
                return;
            }
            $('#mapaPTitle').val($('#mapaTitle').val());
            $('#mapaPFooter').val($('#mapaFooter').val());
        });

        $('#mapaPPlayVideo').on('click', function (e) {
            e.preventDefault();
            if (
                $exeDevices.iDevice.gamification.media.getIDYoutube(
                    $('#mapaPURLYoutube').val().trim()
                )
            ) {
                $('#mapaURLYoutube').val($('#mapaPURLYoutube').val());
                if (typeof YT == 'undefined') {
                    $exeDevice.isVideoType = true;
                    $exeDevice.loadYoutubeApi();
                } else {
                    $exeDevice.showVideoPoint();
                }
            } else if (
                $exeDevice.getIDMediaTeca($('#mapaPURLYoutube').val().trim())
            ) {
                $('#mapaURLYoutube').val($('#mapaPURLYoutube').val());
                $exeDevice.showVideoPoint();
            } else {
                $exeDevice.showMessage($exeDevice.msgs.msgECompleteURLYoutube);
                return;
            }

            $('#mapaURLYoutube').val($('#mapaPURLYoutube').val());
            $('#mapaTitle').val($('#mapaPTitle').val());
            $('#mapaFooter').val($('#mapaPFooter').val());
        });

        $('#mapaEPlayAudio').on('click', function (e) {
            e.preventDefault();
            const selectedFile = $('#mapaURLAudio').val().trim();
            if (selectedFile.length > 4) {
                $exeDevice.stopSound();
                $exeDevice.playSound(selectedFile);
            }
        });

        $('#mapaURLAudio').on('change', function () {
            const selectedFile = $(this).val().trim();
            if (selectedFile.length == 0) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': mp3, ogg, wav'
                );
            } else {
                if (selectedFile.length > 4) {
                    $exeDevice.stopSound();
                    $exeDevice.playSound(selectedFile);
                }
            }
        });

        $('#mapaPlayAudioIdentify').on('click', function (e) {
            e.preventDefault();
            const selectedFile = $('#mapaURLAudioIdentify').val().trim();
            if (selectedFile.length > 4) {
                $exeDevice.stopSound();
                $exeDevice.playSound(selectedFile);
            }
        });

        $('#mapaURLAudioIdentify').on('change', function () {
            const selectedFile = $(this).val().trim();
            if (selectedFile.length == 0) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': mp3, ogg, wav'
                );
            } else {
                if (selectedFile.length > 4) {
                    $exeDevice.stopSound();
                    $exeDevice.playSound(selectedFile);
                }
            }
        });

        $('#mapaCloseLevel').on('click', function (e) {
            e.preventDefault();
            $exeDevice.closeLevel();
        });

        $('#mapaEditPointsMap').on('click', function (e) {
            e.preventDefault();
            $exeDevice.addLevel();
        });

        $('#mapaEditSlide').on('click', function (e) {
            e.preventDefault();
            $exeDevice.showSlides();
        });

        $('#mapaEditPointTest').on('click', function (e) {
            e.preventDefault();
            $exeDevice.showPointTests();
        });

        $('#mapaSClose').on('click', function (e) {
            e.preventDefault();
            $exeDevice.closeSlide();
        });

        $('#mapaPTClose').on('click', function (e) {
            e.preventDefault();
            $exeDevice.closePointTest();
        });

        $('#mapaEEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#mapaEEvaluationID').prop('disabled', !marcado);
        });

        $('#mapaEEvaluationHelpLnk').click(function () {
            $('#mapaEEvaluationHelp').toggle();
            return false;
        });

        $('#mapaTitle').on('input', function () {
            $('#mapaTextLink').text($(this).val());
        });

        $('#mapaColorTitle').on('change', function () {
            $('#mapaTextLink').css('color', $(this).val());
        });

        $('#mapaFontSizeTitle').on('input', function () {
            const fontSize = $(this).val() ? $(this).val() + 'px' : '';
            $('#mapaTextLink').css('font-size', fontSize);
        });

        $('#mapaCanvas').on('click', function (event) {
            event.preventDefault();
            const rect = this.getBoundingClientRect(),
                x = (event.clientX - rect.left) / rect.width,
                y = (event.clientY - rect.top) / rect.height;
            $exeDevice.currentPoints.push({ x: x, y: y });
            $exeDevice.redoPoints = [];
            $exeDevice.drawCurrentArea();
        });

        $('#mapaUndoButton').on('click', function (e) {
            e.preventDefault();
            if ($exeDevice.currentPoints.length > 0) {
                $exeDevice.redoPoints.push($exeDevice.currentPoints.pop());
                $exeDevice.drawCurrentArea();
            }
        });

        $('#mapaRedoButton').on('click', function (e) {
            e.preventDefault();
            if ($exeDevice.redoPoints.length > 0) {
                $exeDevice.currentPoints.push($exeDevice.redoPoints.pop());
                $exeDevice.drawCurrentArea();
            }
        });
        $('#mapaClearButton').on('click', function (e) {
            e.preventDefault();
            $exeDevice.currentPoints = [];
            $exeDevice.redoPoints = [];
            $exeDevice.drawCurrentArea();
        });

        $('#mapaBtnDrop').on('click', function () {
            if ($('.MQP-DropdownContent').css('display') === 'none') {
                $('.MQP-DropdownContent').css('display', 'flex');
            } else {
                $('.MQP-DropdownContent').css('display', 'none');
            }
        });

        $('.MQP-DropdownContent li').on('click', function () {
            $exeDevice.setIconType($(this).data('value'));
            $('.MQP-DropdownContent ').hide();
            $exeDevice.loadIcon();
        });

        $('.MQP-DropdownContent').on('mouseleave', function () {
            $(this).hide();
        });

        $exeDevice.localPlayer = document.getElementById('mapaEVideoLocal');
        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();

        $('.exe-block-dismissible .exe-block-close').click(function () {
            $(this).parent().fadeOut();
            return false;
        });
    },

    showSlides: function () {
        const slide = $exeDevice.getDefaultSlide();
        $exeDevice.slides = $.extend(
            true,
            {},
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active].slides
        );
        $exeDevice.slides = Object.values($exeDevice.slides) || [];
        $exeDevice.activeSlide =
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active].activeSlide;

        if ($exeDevice.slides.length == 0) {
            $exeDevice.slides.push(slide);
            $exeDevice.activeSlide = 0;
        }

        $exeDevice.showSlide($exeDevice.activeSlide);
    },

    showPointTests: function () {
        const test = $exeDevice.getDefaultQuestion();
        $exeDevice.activeTest = 0;
        if (
            $exeDevice.activeMap &&
            $exeDevice.activeMap.pts &&
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active] &&
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active].tests
        ) {
            $exeDevice.tests = $.extend(
                true,
                {},
                $exeDevice.activeMap.pts[$exeDevice.activeMap.active].tests
            );
            $exeDevice.tests = Object.values($exeDevice.tests);
            $exeDevice.activeTest =
                $exeDevice.activeMap.pts[$exeDevice.activeMap.active]
                    .activeTest || 0;
        } else {
            $exeDevice.tests = [];
        }

        if ($exeDevice.tests.length == 0) {
            $exeDevice.tests.push(test);
        }

        $exeDevice.showPointQuestion($exeDevice.activeTest);

        $('#mapaCubierta').css('display', 'flex');
        $('#mapaCubierta').show();
        $('#mapaTContainer').show();
        $exeDevice.stopSound();
        $exeDevice.stopVideo();
    },

    showSlide: function (i) {
        $exeDevice.activeSlide = i;

        $('#mapaSTitle').val($exeDevice.slides[i].title);
        $('#mapaSURLImage').val($exeDevice.slides[i].url);
        $('#mapaSAuthorImage').val($exeDevice.slides[i].author);
        $('#mapaSAltImage').val($exeDevice.slides[i].alt);
        $('#mapaSFooter').val($exeDevice.slides[i].footer);
        $('#mapaNumberSlide').val(i + 1);
        $('#mapaCubierta').css('display', 'flex');
        $('#mapaCubierta').show();
        $('#mapaSContainer').css('display', 'flex');

        $exeDevice.showImageSlide(
            $('#mapaSURLImage').val(),
            $('#mapaSAltImage').val()
        );
        $exeDevice.stopSound();
        $exeDevice.stopVideo();
    },

    closeSlide: function () {
        const saveChanges = window.confirm(
            _('Do you want to save the changes of this presentation?')
        );
        if (saveChanges) {
            if (!$exeDevice.validateSlide()) {
                return;
            }
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active].slides =
                Object.values($.extend(true, {}, $exeDevice.slides));
        }
        $exeDevice.slides = [];
        $exeDevice.activeSlide = 0;
        $('#mapaSContainer').fadeOut();
        $('#mapaCubierta').fadeOut();
    },

    closePointTest: function () {
        const saveChanges = window.confirm(
            _('Do you want to save the changes of this quiz?')
        );
        if (saveChanges) {
            if (!$exeDevice.validatePointQuestion()) {
                return;
            }
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active].tests =
                Object.values($.extend(true, {}, $exeDevice.tests));
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active].activeTest =
                $exeDevice.activeTest;
        }
        $exeDevice.tests = [];
        $exeDevice.activeTest = 0;
        $('#mapaTContainer').fadeOut();
        $('#mapaCubierta').fadeOut();
    },

    validateSlide: function () {
        let msg = '';
        if ($('#mapaSTitle').val().trim().length == 0) {
            msg = $exeDevice.msgs.msgTitle;
        } else if ($('#mapaSURLImage').val().trim().length < 4) {
            msg = $exeDevice.msgs.msgEURLValid;
        }
        if (msg.length > 0) {
            $exeDevice.showMessage(msg);
        } else {
            let slide = $exeDevice.slides[$exeDevice.activeSlide];
            slide.title = $('#mapaSTitle').val();
            slide.url = $('#mapaSURLImage').val();
            slide.author = $('#mapaSAuthorImage').val();
            slide.alt = $('#mapaSAltImage').val();
            slide.footer = $('#mapaSFooter').val();
        }
        return msg == '';
    },

    updateQuestionsNumber: function () {
        let percentaje = parseInt(
            $exeDevice.removeTags($('#mapaPercentajeIdentify').val())
        );
        if (isNaN(percentaje)) return;

        let pts = $exeDevice.activeMap.pts;
        if ($exeDevice.levels.length > 1) {
            pts = $exeDevice.levels[0].pts;
        }
        percentaje = Math.max(1, Math.min(percentaje, 100));

        let nq = $exeDevice.getNumberIdentify(pts);

        const num = Math.max(1, Math.round((percentaje * nq) / 100));
        $('#mapaNumberPercentaje').text(num + '/' + nq);
        $exeDevice.updateShowQ();
    },

    updateShowQ: function () {
        let percentaje = parseInt(
            $exeDevice.removeTags($('#mapaPercentajeShowQ').val())
        );
        if (isNaN(percentaje)) return;
        percentaje = Math.max(1, Math.min(percentaje, 100));

        let pts = $exeDevice.activeMap.pts;

        if ($exeDevice.levels.length > 1) pts = $exeDevice.levels[0].pts;

        let nq = $exeDevice.getNumberIdentify(pts),
            num = Math.max(1, Math.round((percentaje * nq) / 100));

        $('#mapaPShowQuestions').text(num + '/' + nq);
    },

    updateNumberQuestions: function () {
        let percentaje = parseInt(
                $exeDevice.removeTags($('#mapaPercentajeQuestions').val())
            ),
            nq = $exeDevice.selectsGame.length;
        if (isNaN(percentaje)) return;
        percentaje = Math.max(1, Math.min(percentaje, 100));
        let num = Math.max(1, Math.round((percentaje * nq) / 100));
        $('#mapaNumberQuestions').text(num + '/' + nq);
    },

    updateNumberPointQuestions: function () {
        let percentaje = parseInt(
                $exeDevice.removeTags($('#mapaPercentajeQuestions1').val())
            ),
            nq = $exeDevice.tests.length;

        if (isNaN(percentaje)) return;

        percentaje = Math.max(1, Math.min(percentaje, 100));
        let num = Math.max(1, Math.round((percentaje * nq) / 100));
        $('#mapaNumberQuestions1').text(num + '/' + nq);
    },

    getDrowpBox() {
        const select = `
            <div class="MQP-Dropdown">
                <div class="d-flex align-items-center gap-2">
                    <div>Icono:</div>
                    <div id="mapaBtnDrop" class="MQP-Dropbtn" data-value="0">
                        <div class="MQE-P0"></div>
                        ${_('Magnifier')}
                    </div>
                    <div class="MQE-TextLinkDiv" id="mapaTextLinkDiv">
                        <label for="mapaColorTitle" style="margin-left:0.4em">${_('Color')}:</label>
                        <input type="color" id="mapaColorTitle" value="#000000">
                        <label for="mapaFontSizeTitle" style="margin-left:0.4em">${_('Font size')} (px):</label>
                        <input type="number" id="mapaFontSizeTitle" placeholder="" value="14" min="10" max="40" class="form-control">
                    </div>
                </div>
                <ul class="MQP-DropdownContent">
                    <li data-value="1"><div class="MQE-P1" title="${_('Invisible area')}"></div></li>
                    <li data-value="84"><div class="MQE-P84" title="${_('Title')}"></div></li>
                    <li data-value="0"><div class="MQE-P0" title="${_('Magnifier')}"></div></li>
                    <li data-value="7"><div class="MQE-P7" title="${_('Map marker')}"></div></li>
                    <li data-value="2"><div class="MQE-P2" title="${_('Audio')}"></div></li>
                    <li data-value="3"><div class="MQE-P3" title="${_('Image')}"></div></li>
                    <li data-value="4"><div class="MQE-P4" title="${_('Text')}"></div></li>
                    <li data-value="5"><div class="MQE-P5" title="${_('Video')}"></div></li>
                    <li data-value="6"><div class="MQE-P6" title="${_('Presentation')}"></div></li>
                    <li data-value="80"><div class="MQE-P80" title="${_('Information')}"></div></li>
                    <li data-value="8"><div class="MQE-P8" title="${_('Pushpin')} 1"></div></li>
                    <li data-value="9"><div class="MQE-P9" title="${_('Pushpin')} 2"></div></li>
                    <li data-value="10"><div class="MQE-P10" title="${_('Pushpin')} 3"></div></li>
                    <li data-value="11"><div class="MQE-P11" title="${_('Arrow')} 1"></div></li>
                    <li data-value="12"><div class="MQE-P12" title="${_('Arrow')} 2"></div></li>
                    <li data-value="13"><div class="MQE-P13" title="${_('Arrow')} 3"></div></li>
                    <li data-value="14"><div class="MQE-P14" title="${_('Arrow')} 4"></div></li>
                    <li data-value="15"><div class="MQE-P15" title="${_('Arrow')} 5"></div></li>
                    <li data-value="16"><div class="MQE-P16" title="${_('Arrow')} 6"></div></li>
                    <li data-value="17"><div class="MQE-P17" title="${_('Arrow')} 7"></div></li>
                    <li data-value="18"><div class="MQE-P18" title="${_('Arrow')} 8"></div></li>
                    <li data-value="19"><div class="MQE-P19" title="${_('Point')}"></div></li>
                    <li data-value="20"><div class="MQE-P20" title="${_('Magnifier')}"></div></li>
                    <li data-value="27"><div class="MQE-P27" title="${_('Map marker')}"></div></li>
                    <li data-value="22"><div class="MQE-P22" title="${_('Audio')}"></div></li>
                    <li data-value="23"><div class="MQE-P23" title="${_('Image')}"></div></li>
                    <li data-value="24"><div class="MQE-P24" title="${_('Text')}"></div></li>
                    <li data-value="25"><div class="MQE-P25" title="${_('Video')}"></div></li>
                    <li data-value="26"><div class="MQE-P26" title="${_('Presentation')}"></div></li>
                    <li data-value="81"><div class="MQE-P81" title="${_('Information')}"></div></li>
                    <li data-value="28"><div class="MQE-P28" title="${_('Pushpin')} 1"></div></li>
                    <li data-value="29"><div class="MQE-P29" title="${_('Pushpin')} 2"></div></li>
                    <li data-value="30"><div class="MQE-P30" title="${_('Pushpin')} 3"></div></li>
                    <li data-value="31"><div class="MQE-P31" title="${_('Arrow')} 1"></div></li>
                    <li data-value="32"><div class="MQE-P32" title="${_('Arrow')} 2"></div></li>
                    <li data-value="33"><div class="MQE-P33" title="${_('Arrow')} 3"></div></li>
                    <li data-value="34"><div class="MQE-P34" title="${_('Arrow')} 4"></div></li>
                    <li data-value="35"><div class="MQE-P35" title="${_('Arrow')} 5"></div></li>
                    <li data-value="36"><div class="MQE-P36" title="${_('Arrow')} 6"></div></li>
                    <li data-value="37"><div class="MQE-P37" title="${_('Arrow')} 7"></div></li>
                    <li data-value="38"><div class="MQE-P38" title="${_('Arrow')} 8"></div></li>
                    <li data-value="40"><div class="MQE-P40" title="${_('Magnifier')}"></div></li>
                    <li data-value="47"><div class="MQE-P47" title="${_('Map marker')}"></div></li>
                    <li data-value="42"><div class="MQE-P42" title="${_('Audio')}"></div></li>
                    <li data-value="43"><div class="MQE-P43" title="${_('Image')}"></div></li>
                    <li data-value="44"><div class="MQE-P44" title="${_('Text')}"></div></li>
                    <li data-value="45"><div class="MQE-P45" title="${_('Video')}"></div></li>
                    <li data-value="46"><div class="MQE-P46" title="${_('Presentation')}"></div></li>
                    <li data-value="82"><div class="MQE-P82" title="${_('Information')}"></div></li>
                    <li data-value="48"><div class="MQE-P48" title="${_('Pushpin')} 1"></div></li>
                    <li data-value="49"><div class="MQE-P49" title="${_('Pushpin')} 2"></div></li>
                    <li data-value="50"><div class="MQE-P50" title="${_('Pushpin')} 3"></div></li>
                    <li data-value="51"><div class="MQE-P51" title="${_('Arrow')} 1"></div></li>
                    <li data-value="52"><div class="MQE-P52" title="${_('Arrow')} 2"></div></li>
                    <li data-value="53"><div class="MQE-P53" title="${_('Arrow')} 3"></div></li>
                    <li data-value="54"><div class="MQE-P54" title="${_('Arrow')} 4"></div></li>
                    <li data-value="55"><div class="MQE-P55" title="${_('Arrow')} 5"></div></li>
                    <li data-value="56"><div class="MQE-P56" title="${_('Arrow')} 6"></div></li>
                    <li data-value="57"><div class="MQE-P57" title="${_('Arrow')} 7"></div></li>
                    <li data-value="58"><div class="MQE-P58" title="${_('Arrow')} 8"></div></li>
                    <li data-value="60"><div class="MQE-P60" title="${_('Magnifier')}"></div></li>
                    <li data-value="67"><div class="MQE-P67" title="${_('Map marker')}"></div></li>
                    <li data-value="62"><div class="MQE-P62" title="${_('Audio')}"></div></li>
                    <li data-value="63"><div class="MQE-P63" title="${_('Image')}"></div></li>
                    <li data-value="64"><div class="MQE-P64" title="${_('Text')}"></div></li>
                    <li data-value="65"><div class="MQE-P65" title="${_('Video')}"></div></li>
                    <li data-value="66"><div class="MQE-P66" title="${_('Presentation')}"></div></li>
                    <li data-value="83"><div class="MQE-P83" title="${_('Information')}"></div></li>
                    <li data-value="68"><div class="MQE-P68" title="${_('Pushpin')} 1"></div></li>
                    <li data-value="69"><div class="MQE-P69" title="${_('Pushpin')} 2"></div></li>
                    <li data-value="70"><div class="MQE-P70" title="${_('Pushpin')} 3"></div></li>
                    <li data-value="71"><div class="MQE-P71" title="${_('Arrow')} 1"></div></li>
                    <li data-value="72"><div class="MQE-P72" title="${_('Arrow')} 2"></div></li>
                    <li data-value="73"><div class="MQE-P73" title="${_('Arrow')} 3"></div></li>
                    <li data-value="74"><div class="MQE-P74" title="${_('Arrow')} 4"></div></li>
                    <li data-value="75"><div class="MQE-P75" title="${_('Arrow')} 5"></div></li>
                    <li data-value="76"><div class="MQE-P76" title="${_('Arrow')} 6"></div></li>
                    <li data-value="77"><div class="MQE-P77" title="${_('Arrow')} 7"></div></li>
                    <li data-value="78"><div class="MQE-P78" title="${_('Arrow')} 8"></div></li>
                    <li data-value="85"><div class="MQE-P85" title="${_('Magnifier')}"></div></li>
                    <li data-value="92"><div class="MQE-P92" title="${_('Map marker')}"></div></li>
                    <li data-value="87"><div class="MQE-P87" title="${_('Audio')}"></div></li>
                    <li data-value="88"><div class="MQE-P88" title="${_('Image')}"></div></li>
                    <li data-value="89"><div class="MQE-P89" title="${_('Text')}"></div></li>
                    <li data-value="90"><div class="MQE-P90" title="${_('Video')}"></div></li>
                    <li data-value="91"><div class="MQE-P91" title="${_('Presentation')}"></div></li>
                    <li data-value="124"><div class="MQE-P124" title="${_('Information')}"></div></li>
                    <li data-value="93"><div class="MQE-P93" title="${_('Pushpin')} 1"></div></li>
                    <li data-value="94"><div class="MQE-P94" title="${_('Pushpin')} 2"></div></li>
                    <li data-value="95"><div class="MQE-P95" title="${_('Pushpin')} 3"></div></li>
                    <li data-value="96"><div class="MQE-P96" title="${_('Arrow')} 1"></div></li>
                    <li data-value="97"><div class="MQE-P97" title="${_('Arrow')} 2"></div></li>
                    <li data-value="98"><div class="MQE-P98" title="${_('Arrow')} 3"></div></li>
                    <li data-value="99"><div class="MQE-P99" title="${_('Arrow')} 4"></div></li>
                    <li data-value="100"><div class="MQE-P100" title="${_('Arrow')} 5"></div></li>
                    <li data-value="101"><div class="MQE-P101" title="${_('Arrow')} 6"></div></li>
                    <li data-value="102"><div class="MQE-P102" title="${_('Arrow')} 7"></div></li>
                    <li data-value="103"><div class="MQE-P103" title="${_('Arrow')} 8"></div></li>
                    <li data-value="105"><div class="MQE-P105" title="${_('Magnifier')}"></div></li>
                    <li data-value="112"><div class="MQE-P112" title="${_('Map marker')}"></div></li>
                    <li data-value="107"><div class="MQE-P107" title="${_('Audio')}"></div></li>
                    <li data-value="108"><div class="MQE-P108" title="${_('Image')}"></div></li>
                    <li data-value="109"><div class="MQE-P109" title="${_('Text')}"></div></li>
                    <li data-value="110"><div class="MQE-P110" title="${_('Video')}"></div></li>
                    <li data-value="111"><div class="MQE-P111" title="${_('Presentation')}"></div></li>
                    <li data-value="125"><div class="MQE-P125" title="${_('Information')}"></div></li>
                    <li data-value="113"><div class="MQE-P113" title="${_('Pushpin')} 1"></div></li>
                    <li data-value="114"><div class="MQE-P114" title="${_('Pushpin')} 2"></div></li>
                    <li data-value="115"><div class="MQE-P115" title="${_('Pushpin')} 3"></div></li>
                    <li data-value="116"><div class="MQE-P116" title="${_('Arrow')} 1"></div></li>
                    <li data-value="117"><div class="MQE-P117" title="${_('Arrow')} 2"></div></li>
                    <li data-value="118"><div class="MQE-P118" title="${_('Arrow')} 3"></div></li>
                    <li data-value="119"><div class="MQE-P119" title="${_('Arrow')} 4"></div></li>
                    <li data-value="120"><div class="MQE-P120" title="${_('Arrow')} 5"></div></li>
                    <li data-value="121"><div class="MQE-P121" title="${_('Arrow')} 6"></div></li>
                    <li data-value="122"><div class="MQE-P122" title="${_('Arrow')} 7"></div></li>
                    <li data-value="123"><div class="MQE-P123" title="${_('Arrow')} 8"></div></li>
                </ul>
            </div>`;
        return select;
    },

    setIconType: function (value) {
        $('#mapaBtnDrop').data('value', value);
        const content = $(
                '.MQP-DropdownContent li[data-value="' + value + '"]'
            ).html(),
            text =
                '<di>' +
                $('.MQP-DropdownContent li[data-value="' + value + '"]')
                    .find('div')
                    .eq(0)
                    .attr('title') +
                '</di>';
        $('#mapaBtnDrop').html(content + text);
    },

    loadIcon: function () {
        const icon = parseInt($('#mapaBtnDrop').data('value')),
            x = parseFloat($('#mapaX').val()),
            y = parseFloat($('#mapaY').val());
        $exeDevice.changeIcon(icon, x, y);
    },

    changeIcon: function (icon, x, y) {
        const evaluationG = parseInt(
            $('input[name=mpevaluation]:checked').val()
        );

        $('#mapaCursor').hide();
        $('#mapaArea').hide();

        let mI =
            icon == 19 || icon == 39 || icon == 59 || icon == 79
                ? `${$exeDevice.idevicePath}mapam${icon}.png`
                : `${$exeDevice.idevicePath}mapam${icon}.svg`;
        if (evaluationG == 1) {
            mI = `${$exeDevice.idevicePath}mapam19.png`;
            icon = 19;
        }
        let icon1 = `url(${mI})`;
        $('#mapaIconPoint').css({
            'background-image': icon1,
        });
        $('#mapaCursor').css({
            'background-image': icon1,
        });

        const c = [
                0, 1, 2, 3, 4, 5, 6, 10, 19, 20, 21, 22, 23, 24, 25, 26, 30, 39,
                40, 41, 42, 43, 44, 45, 46, 50, 59, 60, 61, 62, 63, 64, 65, 66,
                70, 79, 80, 81, 82, 83, 85, 86, 87, 88, 89, 90, 91, 95, 104,
                105, 106, 107, 108, 109, 100, 111, 115, 105, 124,
            ],
            uc = [18, 38, 58, 78, 84, 103, 123],
            dc = [
                7, 9, 15, 27, 29, 35, 47, 49, 55, 67, 69, 75, 92, 94, 100, 112,
                114, 120,
            ],
            lu = [11, 31, 51, 71, 96, 116],
            lc = [16, 36, 56, 76, 101, 121],
            ld = [8, 14, 28, 34, 48, 54, 68, 74, 93, 99, 113, 119],
            ru = [12, 32, 52, 72, 97, 117],
            rc = [17, 37, 57, 77, 102, 122],
            rd = [13, 33, 53, 73, 98, 118];

        $exeDevice.iconX = 0.5;
        $exeDevice.iconY = 0.5;

        if (c.indexOf(icon) != -1) {
            $exeDevice.iconX = 0.5;
            $exeDevice.iconY = 0.5;
        } else if (uc.indexOf(icon) != -1) {
            $exeDevice.iconX = 0.5;
            $exeDevice.iconY = 0;
        } else if (dc.indexOf(icon) != -1) {
            $exeDevice.iconX = 0.5;
            $exeDevice.iconY = 1;
        } else if (lu.indexOf(icon) != -1) {
            $exeDevice.iconX = 0;
            $exeDevice.iconY = 0;
        } else if (lc.indexOf(icon) != -1) {
            $exeDevice.iconX = 0;
            $exeDevice.iconY = 0.5;
        } else if (ld.indexOf(icon) != -1) {
            $exeDevice.iconX = 0;
            $exeDevice.iconY = 1;
        } else if (ru.indexOf(icon) != -1) {
            $exeDevice.iconX = 1;
            $exeDevice.iconY = 0;
        } else if (rc.indexOf(icon) != -1) {
            $exeDevice.iconX = 1;
            $exeDevice.iconY = 0.5;
        } else if (rd.indexOf(icon) != -1) {
            $exeDevice.iconX = 1;
            $exeDevice.iconY = 1;
        }

        if (icon == 84 && evaluationG != 1) {
            $('#mapaTextLinkDiv').css('display', 'flex');
            $('#mapaIconPoint').hide();
        } else {
            $('#mapaTextLinkDiv').hide();
            $('#mapaIconPoint').show();
        }

        if (icon == 84 && evaluationG != 1) {
            $exeDevice.paintTextLink(x, y);
            return;
        }
        if (icon == 1 && evaluationG != 1) {
            $exeDevice.paintAreaPoints($exeDevice.currentPoints);
        } else {
            $exeDevice.paintMouse(x, y);
        }
    },

    clickSolution: function (checked, value) {
        let solutions = $('#mapaESolutionSelect').text();
        if (checked) {
            if (solutions.indexOf(value) == -1) {
                solutions += value;
            }
        } else {
            solutions = solutions.split(value).join('');
        }
        $('#mapaESolutionSelect').text(solutions);
    },

    clickPointSolution: function (checked, value) {
        let solutions = $('#mapaESolutionSelect1').text();
        if (checked) {
            if (solutions.indexOf(value) == -1) {
                solutions += value;
            }
        } else {
            solutions = solutions.split(value).join('');
        }
        $('#mapaESolutionSelect1').text(solutions);
    },

    addQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.clearQuestion();
            $exeDevice.selectsGame.push($exeDevice.getDefaultQuestion());
            $exeDevice.qActive = $exeDevice.selectsGame.length - 1;
            $exeDevice.qTypeEdit = -1;
            $('#mapaEPasteQ').hide();
            $('#mapaENumQuestionsQ').text($exeDevice.selectsGame.length);
            $('#mapaENumberQuestionQ').val($exeDevice.selectsGame.length);
            $exeDevice.updateNumberQuestions();
        }
    },

    getDefaultQuestion: function () {
        return {
            typeSelect: 0,
            numberOptions: 4,
            quextion: '',
            options: ['', '', '', ''],
            solution: '',
            solutionWord: '',
            percentageShow: 35,
            msgError: '',
            msgHit: '',
            tests: [],
            respuesta: '',
            numbertests: 0,
        };
    },

    removeQuestion: function () {
        if ($exeDevice.selectsGame.length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
            return;
        } else {
            $exeDevice.selectsGame.splice($exeDevice.qActive, 1);
            if ($exeDevice.qActive >= $exeDevice.selectsGame.length - 1) {
                $exeDevice.qActive = $exeDevice.selectsGame.length - 1;
            }
            $exeDevice.showQuestion($exeDevice.qActive);
            $exeDevice.qTypeEdit = -1;
            $('#mapaEPasteQ').hide();
            $('#mapaENumQuestionsQ').text($exeDevice.selectsGame.length);
            $('#mapaENumberQuestionQ').val($exeDevice.qActive + 1);
            $exeDevice.updateNumberQuestions();
        }
    },
    copyQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.qTypeEdit = 0;
            $exeDevice.qClipBoard = JSON.parse(
                JSON.stringify($exeDevice.selectsGame[$exeDevice.active])
            );
            $('#mapaEPasteQ').show();
        }
    },
    cutQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.numberCutCuestion = $exeDevice.qActive;
            $exeDevice.qTypeEdit = 1;
            $('#mapaEPasteQ').show();
            $exeDevice.updateNumberQuestions();
        }
    },
    pasteQuestion: function () {
        if ($exeDevice.qTypeEdit == 0) {
            $exeDevice.qActive++;
            $exeDevice.selectsGame.splice(
                $exeDevice.qActive,
                0,
                $exeDevice.qClipBoard
            );
            $exeDevice.showQuestion($exeDevice.qActive);
        } else if ($exeDevice.qTypeEdit == 1) {
            $('#mapaEPasteQ').hide();
            $exeDevice.qTypeEdit = -1;
            $exeDevice.arrayMove(
                $exeDevice.selectsGame,
                $exeDevice.numberCutCuestion,
                $exeDevice.qActive
            );
            $exeDevice.showQuestion($exeDevice.qActive);
            $('#mapaENumQuestionsQ').text($exeDevice.selectsGame.length);
        }
    },

    nextQuestion: function () {
        if (
            $exeDevice.validateQuestion() &&
            $exeDevice.qActive < $exeDevice.selectsGame.length - 1
        ) {
            $exeDevice.qActive++;
            $exeDevice.showQuestion($exeDevice.qActive);
        }
    },

    lastQuestion: function () {
        if (
            $exeDevice.validateQuestion() &&
            $exeDevice.qActive < $exeDevice.selectsGame.length - 1
        ) {
            $exeDevice.qActive = $exeDevice.selectsGame.length - 1;
            $exeDevice.showQuestion($exeDevice.qActive);
        }
    },

    previousQuestion: function () {
        if ($exeDevice.validateQuestion() && $exeDevice.qActive > 0) {
            $exeDevice.qActive--;
            $exeDevice.showQuestion($exeDevice.qActive);
        }
    },

    firstQuestion: function () {
        if ($exeDevice.validateQuestion() && $exeDevice.qActive > 0) {
            $exeDevice.qActive = 0;
            $exeDevice.showQuestion($exeDevice.qActive);
        }
    },

    addPointQuestion: function () {
        if ($exeDevice.validatePointQuestion()) {
            $exeDevice.clearPointQuestion();
            $exeDevice.tests.push($exeDevice.getDefaultQuestion());
            $exeDevice.activeTest = $exeDevice.tests.length - 1;
            $exeDevice.pTypeEdit = -1;
            $('#mapaEPasteQ1').hide();
            $('#mapaENumQuestionsQ1').text($exeDevice.tests.length);
            $('#mapaENumberQuestionQ1').val($exeDevice.tests.length);
            $exeDevice.updateNumberPointQuestions();
        }
    },

    removePointQuestion: function () {
        if ($exeDevice.tests.length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
            return;
        } else {
            $exeDevice.tests.splice($exeDevice.activeTest, 1);
            if ($exeDevice.activeTest >= $exeDevice.tests.length - 1) {
                $exeDevice.activeTest = $exeDevice.tests.length - 1;
            }
            $exeDevice.showPointQuestion($exeDevice.activeTest);
            $exeDevice.pTypeEdit = -1;
            $('#mapaEPasteQ1').hide();
            $('#mapaENumQuestionsQ1').text($exeDevice.tests.length);
            $('#mapaENumberQuestionQ1').val($exeDevice.activeTest + 1);
            $exeDevice.updateNumberPointQuestions();
        }
    },

    copyPointQuestion: function () {
        if ($exeDevice.validatePointQuestion()) {
            $exeDevice.pTypeEdit = 0;
            $exeDevice.qClipBoard = JSON.parse(
                JSON.stringify($exeDevice.tests[$exeDevice.activeTest])
            );
            $('#mapaEPasteQ1').show();
        }
    },

    cutPointQuestion: function () {
        if ($exeDevice.validatePointQuestion()) {
            $exeDevice.numberCutPointQuestion = $exeDevice.activeTest;
            $exeDevice.pTypeEdit = 1;
            $('#mapaEPasteQ1').show();
            $exeDevice.updateNumberPointQuestions();
        }
    },

    pastePointQuestion: function () {
        if ($exeDevice.pTypeEdit == 0) {
            $exeDevice.activeTest++;
            $exeDevice.tests.splice(
                $exeDevice.activeTest,
                0,
                $exeDevice.qClipBoard
            );
            $exeDevice.showPointQuestion($exeDevice.activeTest);
        } else if ($exeDevice.pTypeEdit == 1) {
            $('#mapaEPasteQ1').hide();
            $exeDevice.pTypeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                $exeDevice.tests,
                $exeDevice.numberCutPointQuestion,
                $exeDevice.activeTest
            );
            $exeDevice.showPointQuestion($exeDevice.activeTest);
            $('#mapaENumQuestionsQ1').text($exeDevice.tests.length);
        }
    },

    firstPointQuestion: function () {
        if ($exeDevice.validatePointQuestion() && $exeDevice.activeTest > 0) {
            $exeDevice.activeTest = 0;
            $exeDevice.showPointQuestion($exeDevice.activeTest);
        }
    },

    previousPointQuestion: function () {
        if ($exeDevice.validatePointQuestion() && $exeDevice.activeTest > 0) {
            $exeDevice.activeTest--;
            $exeDevice.showPointQuestion($exeDevice.activeTest);
        }
    },

    nextPointQuestion: function () {
        if (
            $exeDevice.validatePointQuestion() &&
            $exeDevice.activeTest < $exeDevice.tests.length - 1
        ) {
            $exeDevice.activeTest++;
            $exeDevice.showPointQuestion($exeDevice.activeTest);
        }
    },

    lastPointQuestion: function () {
        if (
            $exeDevice.validatePointQuestion() &&
            $exeDevice.activeTest < $exeDevice.tests.length - 1
        ) {
            $exeDevice.activeTest = $exeDevice.tests.length - 1;
            $exeDevice.showPointQuestion($exeDevice.activeTest);
        }
    },

    validatePointQuestion: function () {
        let message = '',
            msgs = $exeDevice.msgs,
            p = {};
        p.type = 0;
        p.time = parseInt($('input[name=mptime1]:checked').val());
        p.numberOptions = parseInt($('input[name=mpnumber1]:checked').val());
        p.typeSelect = parseInt($('input[name=mptypeselect1]:checked').val());
        p.quextion = $('#mapaEQuestion1').val().trim();
        p.options = [];
        p.solution = $('#mapaESolutionSelect1').text().trim();
        p.percentageShow = parseInt($('#mapaPercentageShow1').val());
        p.solutionQuestion = '';

        if (p.typeSelect == 2) {
            p.quextion = $('#mapaEDefinitionWord1').val().trim();
            p.solution = '';
            p.solutionQuestion = $('#mapaESolutionWord1').val();
        }

        let optionEmpy = false;
        $('.MQE-PEAnwersOptions').each(function (i) {
            let option = $(this).val().trim();
            if (i < p.numberOptions && option.length == 0) {
                optionEmpy = true;
            }
            if (p.typeSelect == 2) {
                option = '';
            }
            p.options.push(option);
        });

        if (p.typeSelect == 1 && p.solution.length != p.numberOptions) {
            message = msgs.msgTypeChoose;
        } else if (p.typeSelect != 2 && p.quextion.length == 0) {
            message = msgs.msgECompleteQuestion;
        } else if (p.typeSelect != 2 && optionEmpy) {
            message = msgs.msgECompleteAllOptions;
        } else if (p.typeSelect == 2 && p.solutionQuestion.trim().length == 0) {
            message = $exeDevice.msgs.msgEProvideWord;
        } else if (p.typeSelect == 2 && p.quextion.trim().length == 0) {
            message = $exeDevice.msgs.msgEDefintion;
        }

        if (message.length == 0) {
            $exeDevice.tests[$exeDevice.activeTest] = p;
            message = true;
        } else {
            $exeDevice.showMessage(message);
            m;
            essage = false;
        }
        return message;
    },

    showPointOptions: function (number) {
        $('.MQE-PEOptionDiv').each(function (i) {
            $(this).css('display', 'flex');
            $(this).show();
            if (i >= number) {
                $(this).hide();
                $exeDevice.showPointSolution('');
            }
        });

        $('.MQE-PEAnwersOptions').each(function (j) {
            if (j >= number) {
                $(this).val('');
            }
        });
    },

    showPointSolution: function (solution) {
        $("input.MQE-PESolution[name='mpsolution1']").prop('checked', false);
        for (let i = 0; i < solution.length; i++) {
            let sol = solution[i];
            $('.MQE-PESolution')[solution].checked = true;
            $(
                "input.MQE-PESolution[name='mpsolution1'][value='" + sol + "']"
            ).prop('checked', true);
        }
        $('#mapaESolutionSelect1').text(solution);
    },

    clearPointQuestion: function () {
        $exeDevice.showPointOptions(4);
        $exeDevice.showPointSolution('');
        $("input.MQE-PESolution[name='mpsolution1']").prop('checked', false);
        $('#mapaESolutionSelect1').text('');
        $('#mapaEQuestion1').val('');
        $('#mapaESolutionWord1').val('');
        $('#mapaEDefinitionWord1').val('');
        $('.MQE-PEAnwersOptions').each(function () {
            $(this).val('');
        });
    },

    showPointQuestion: function (i) {
        $exeDevice.clearPointQuestion();
        let num = i < 0 ? 0 : i;
        num =
            num >= $exeDevice.tests.length ? $exeDevice.tests.length - 1 : num;
        let p = $exeDevice.tests[num],
            numOptions = 0;
        $exeDevice.activeTest = num;

        if (p.typeSelect != 2) {
            $('.MQE-PEAnwersOptions').each(function (j) {
                numOptions++;
                if (p.options[j].trim() !== '') {
                    p.numOptions = numOptions;
                }
                $(this).val(p.options[j]);
            });
        } else {
            $('#mapaESolutionWord1').val(p.solutionQuestion);
            $('#mapaEDefinitionWord1').val(p.quextion);
            $('#mapaPercentageShow1').val(p.percentageShow);
        }

        $exeDevice.showTypePointQuestion(p.typeSelect);
        $exeDevice.showPointOptions(p.numberOptions);

        $('#mapaEQuestion1').val(p.quextion);
        $('#mapaENumQuestions1').text($exeDevice.tests.length);
        $('.MQE-PEAnwersOptions').each(function (j) {
            const option = j < p.numOptions ? p.options[j] : '';
            $(this).val(option);
        });

        $('#mapaENumberQuestion1').val(i + 1);
        $('#mapaEScoreQuestion1').val(1);
        $(
            "input.MQE-PNumber[name='mpnumber1'][value='" +
                p.numberOptions +
                "']"
        ).prop('checked', true);
        $exeDevice.checkPointQuestions(p.solution);
        $("input.MQE-Times[name='mptime1'][value='" + p.time + "']").prop(
            'checked',
            true
        );
        $(
            "input.MQE-PTypeSelect[name='mptypeselect1'][value='" +
                p.typeSelect +
                "']"
        ).prop('checked', true);
        $('#mapaENumberQuestionQ1').val($exeDevice.activeTest + 1);
    },

    checkPointQuestions: function (solution) {
        $("input.MQE-PESolution[name='mpsolution1']").prop('checked', false);
        for (let i = 0; i < solution.length; i++) {
            const sol = solution[i];
            $(
                "input.MQE-PESolution[name='mpsolution1'][value='" + sol + "']"
            ).prop('checked', true);
        }
        $('#mapaESolutionSelect1').text(solution);
    },

    showTypePointQuestion: function (type) {
        if (type == 2) {
            $('#mapaEAnswers1').hide();
            $('#mapaEQuestionDiv1').hide();
            $('#mapaEWordDiv1').show();
            $('#mapaESolitionOptions1').hide();
            $('#mapaOptionsNumberA1').addClass('d-none').removeClass('d-flex');
            $('#mapaPercentageLetters1')
                .addClass('d-flex')
                .removeClass('d-none');
        } else {
            $('#mapaEAnswers1').show();
            $('#mapaEQuestionDiv1').show();
            $('#mapaEWordDiv1').hide();
            $('#mapaESolitionOptions1').show();
            $('#mapaPercentageLetters1')
                .addClass('d-none')
                .removeClass('d-flex');

            $('#mapaOptionsNumberA1').addClass('d-flex').removeClass('d-none');
        }
    },

    validateQuestion: function () {
        let message = '',
            msgs = $exeDevice.msgs,
            p = {};
        p.type = 0;
        p.time = parseInt($('input[name=mptime]:checked').val());
        p.numberOptions = parseInt($('input[name=mpnumber]:checked').val());
        p.typeSelect = parseInt($('input[name=mptypeselect]:checked').val());
        p.msgHit = $('#mapaEMessageOK').val();
        p.msgError = $('#mapaEMessageKO').val();
        p.quextion = $('#mapaEQuestion').val().trim();
        p.options = [];
        p.solution = $('#mapaESolutionSelect').text().trim();
        p.percentageShow = parseInt($('#mapaPercentageShow').val());
        p.solutionQuestion = '';

        if (p.typeSelect == 2) {
            p.quextion = $('#mapaEDefinitionWord').val().trim();
            p.solution = '';
            p.solutionQuestion = $('#mapaESolutionWord').val();
        }

        let optionEmpy = false;
        $('.MQE-EAnwersOptions').each(function (i) {
            let option = $(this).val().trim();
            if (i < p.numberOptions && option.length == 0) {
                optionEmpy = true;
            }
            if (p.typeSelect == 2) {
                option = '';
            }
            p.options.push(option);
        });

        if (p.typeSelect == 1 && p.solution.length != p.numberOptions) {
            message = msgs.msgTypeChoose;
        } else if (p.typeSelect != 2 && p.quextion.length == 0) {
            message = msgs.msgECompleteQuestion;
        } else if (p.typeSelect != 2 && optionEmpy) {
            message = msgs.msgECompleteAllOptions;
        } else if (p.typeSelect == 2 && p.solutionQuestion.trim().length == 0) {
            message = $exeDevice.msgs.msgEProvideWord;
        } else if (p.typeSelect == 2 && p.quextion.trim().length == 0) {
            message = $exeDevice.msgs.msgEDefintion;
        }
        if (message.length == 0) {
            $exeDevice.selectsGame[$exeDevice.qActive] = p;
            message = true;
        } else {
            $exeDevice.showMessage(message);
            message = false;
        }
        return message;
    },

    showOptions: function (number) {
        $('.MQE-EOptionDiv').each(function (i) {
            $(this).css('display', 'flex');
            $(this).show();
            if (i >= number) {
                $(this).hide();
                $exeDevice.showSolution('');
            }
        });

        $('.MQE-EAnwersOptions').each(function (j) {
            if (j >= number) {
                $(this).val('');
            }
        });
    },

    showSolution: function (solution) {
        $("input.MQE-ESolution[name='mpsolution']").prop('checked', false);
        for (let i = 0; i < solution.length; i++) {
            const sol = solution[i];
            $('.MQE-ESolution')[solution].checked = true;
            $(
                "input.MQE-ESolution[name='mpsolution'][value='" + sol + "']"
            ).prop('checked', true);
        }
        $('#mapaESolutionSelect').text(solution);
    },

    clearQuestion: function () {
        $exeDevice.showOptions(4);
        $exeDevice.showSolution('');
        $("input.MQE-ESolution[name='mpsolution']").prop('checked', false);
        $('#mapaESolutionSelect').text('');
        $('#mapaEQuestion').val('');
        $('#mapaESolutionWord').val('');
        $('#mapaEDefinitionWord').val('');
        $('.MQE-EAnwersOptions').each(function () {
            $(this).val('');
        });
        $('#mapaEMessageOK').val('');
        $('#mapaEMessageKO').val('');
    },

    showQuestion: function (i) {
        $exeDevice.clearQuestion();
        let num = i < 0 ? 0 : i;
        num =
            num >= $exeDevice.selectsGame.length
                ? $exeDevice.selectsGame.length - 1
                : num;
        let p = $exeDevice.selectsGame[num],
            numOptions = 0;
        if (p.typeSelect != 2) {
            $('.MQE-EAnwersOptions').each(function (j) {
                numOptions++;
                if (p.options[j].trim() !== '') {
                    p.numOptions = numOptions;
                }
                $(this).val(p.options[j]);
            });
        } else {
            $('#mapaESolutionWord').val(p.solutionQuestion);
            $('#mapaEDefinitionWord').val(p.quextion);
            $('#mapaPercentageShow').val(p.percentageShow);
        }

        $exeDevice.showTypeQuestion(p.typeSelect);
        $exeDevice.showOptions(p.numberOptions);

        $('#mapaEQuestion').val(p.quextion);
        $('#mapaENumQuestions').text($exeDevice.selectsGame.length);
        $('.MQE-EAnwersOptions').each(function (j) {
            const option = j < p.numOptions ? p.options[j] : '';
            $(this).val(option);
        });
        $('#mapaEMessageOK').val(p.msgHit);
        $('#mapaEMessageKO').val(p.msgError);
        $('#mapaENumberQuestion').val(i + 1);
        $('#mapaEScoreQuestion').val(1);
        $(
            "input.MQE-Number[name='mpnumber'][value='" + p.numberOptions + "']"
        ).prop('checked', true);
        $exeDevice.checkQuestions(p.solution);
        $("input.MQE-Times[name='mptime'][value='" + p.time + "']").prop(
            'checked',
            true
        );
        $(
            "input.MQE-TypeSelect[name='mptypeselect'][value='" +
                p.typeSelect +
                "']"
        ).prop('checked', true);
        $('#mapaENumberQuestionQ').val($exeDevice.qActive + 1);
    },

    checkQuestions: function (solution) {
        $("input.MQE-ESolution[name='mpsolution']").prop('checked', false);
        for (let i = 0; i < solution.length; i++) {
            const sol = solution[i];
            $(
                "input.MQE-ESolution[name='mpsolution'][value='" + sol + "']"
            ).prop('checked', true);
        }
        $('#mapaESolutionSelect').text(solution);
    },

    showTypeQuestion: function (type) {
        if (type == 2) {
            $('#mapaEAnswers').hide();
            $('#mapaEQuestionDiv').hide();
            $('#mapaEWordDiv').show();
            $('#mapaOptionsNumberA').hide();
            $('#mapaESolutionOptions').hide();
            $('#mapaPercentageLetters').css('display', 'flex').show();
        } else {
            $('#mapaEAnswers').show();
            $('#mapaEQuestionDiv').show();
            $('#mapaEWordDiv').hide();
            $('#mapaPercentageLetters').hide();
            $('#mapaESolutionOptions').show();
            $('#mapaOptionsNumberA').css('display', 'flex').show();
        }
    },

    showVideoPoint: function () {
        let iVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                $('#mapaPInitVideo').val()
            ),
            fVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                $('#mapaPEndVideo').val()
            );
        const url = $('#mapaPURLYoutube').val().trim(),
            id = $exeDevices.iDevice.gamification.media.getIDYoutube(url),
            idLocal = $exeDevice.getIDMediaTeca(url);

        iVideo = isNaN(iVideo) ? 0 : iVideo;
        fVideo = isNaN(fVideo) ? 3600 : fVideo;
        if (fVideo <= iVideo) fVideo = 36000;

        $('#mapaPImage').hide();
        $('#mapaPNoImage').hide();
        $('#mapaPDataImage').hide();
        $('#mapaPNoVideo').show();
        $('#mapaPDataVideo').show();
        $('#mapaPVideo').hide();
        $('#mapaEVideoLocal').hide();

        if (id) {
            $exeDevice.startVideo(id, iVideo, fVideo, 0);
            $('#mapaPVideo').show();
            $('#mapaPNoVideo').hide();
            $('#mapaEVideoLocal').hide();
        } else if (idLocal) {
            $exeDevice.startVideo(idLocal, iVideo, fVideo, 1);
            $('#mapaPVideo').hide();
            $('#mapaPNoVideo').hide();
            $('#mapaEVideoLocal').show();
        } else {
            $exeDevice.showMessage(_('This video is not currently available'));
        }

        $('#mapaPContainer').css('display', 'flex');
        $('#mapaCubierta').css('display', 'flex');
        $('#mapaCubierta').show();
    },

    clearPoint: function () {
        $('#mapaTitle').val('');
        $('#mapaCursor').hide();
        $('#mapaArea').hide();
        $('#mapaURLImage').val('');
        $('#mapaX').val('0');
        $('#mapaY').val('0');
        $('#mapaX1').val('0');
        $('#mapaY1').val('0');
        $('#mapaURLYoutube').val('');
        $('#mapaURLAudio').val('');
        $('#mapaText').val('');
        $('#mapaFooter').val('');
        $('#mapaIdentify').val('');
        $('#mapaURLAudioIdentify').val('');
        $('#mapaToolTip').val('');
        $('#mapaLink').val('');
        $('#mapaTextLink').hide();
        $('#mapaTextLink').text('');
        if (tinyMCE.get('mapaText')) {
            tinyMCE.get('mapaText').setContent('');
        }
        if (tinyMCE.get('mapaToolTip')) {
            tinyMCE.get('mapaToolTip').setContent('');
        }
        $('#mapaPTitle').val('');
        $('#mapaPURLImage').val('');
        $('#mapaPAuthorImage').val('');
        $('#mapaPAltImage').val('');
        $('#mapaPURLYoutube').val('');
        $('#mapaPInitVideo').val('00:00:00');
        $('#mapaPEndVideo').val('00:00:00');
        $('#mapaPVideoTime').text('00:00:00');
        $('#mapaPFooter').val('');
    },

    clearSlide: function () {
        $('#mapaSTitle').val('');
        $('#mapaSURLImage').val('');
        $('#mapaSAuthorImage').val('');
        $('#mapaSAltImage').val('');
        $('#mapaSFooter').val('');
    },

    addSlide: function () {
        if ($exeDevice.validateSlide()) {
            $exeDevice.clearSlide();
            $exeDevice.slides.push($exeDevice.getDefaultSlide());
            $exeDevice.activeSlide = $exeDevice.slides.length - 1;
            $('#mapaNumberSlide').val($exeDevice.slides.length);
            $exeDevice.typeEditSlide = -1;
            $('#mapaEPasteSlide').hide();
            $exeDevice.showImageSlide('', '');
        }
    },
    removeSlide: function () {
        if ($exeDevice.slides.length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneSlide);
        } else {
            $exeDevice.slides.splice($exeDevice.activeSlide, 1);
            if ($exeDevice.activeSlide >= $exeDevice.slides.length - 1) {
                $exeDevice.activeSlide = $exeDevice.slides.length - 1;
            }
            $exeDevice.showSlide($exeDevice.activeSlide);
            $exeDevice.typeEditSlide = -1;
            $('#mapaEPasteSlide').hide();
            $('#mapaNumberSlide').val($exeDevice, activeSlide + 1);
        }
    },

    copySlide: function () {
        if ($exeDevice.validateSlide()) {
            $exeDevice.typeEditSlide = 0;
            $exeDevice.sClipBoard = JSON.parse(
                JSON.stringify($exeDevice.slides[$exeDevice.activeSlide])
            );
            $('#mapaEPasteSlide').show();
        }
    },

    cutSlide: function () {
        if ($exeDevice.validateSlide()) {
            $exeDevice.numberCutCuestionSlide = $exeDevice.activeSlide;
            $exeDevice.typeEditSlide = 1;
            $('#mapaEPasteSlide').show();
        }
    },

    pasteSlide: function () {
        if ($exeDevice.typeEditSlide == 0) {
            $exeDevice.activeSlide++;
            let slide = $.extend(true, {}, $exeDevice.sClipBoard);
            slide.id = 's' + $exeDevice.getID();
            $exeDevice.slides.splice($exeDevice.activeSlide, 0, slide);
            $exeDevice.showSlide($exeDevice.activeSlide);
        } else if ($exeDevice.typeEditSlide == 1) {
            $('#mapaEPasteSlide').hide();
            $exeDevice.typeEditSlide = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                $exeDevice.slides,
                $exeDevice.numberCutCuestionSlide,
                $exeDevice.activeSlide
            );
            $exeDevice.showSlide($exeDevice.activeSlide);
        }
    },

    nextSlide: function () {
        if (
            $exeDevice.validateSlide() &&
            $exeDevice.activeSlide < $exeDevice.slides.length - 1
        ) {
            $exeDevice.activeSlide++;
            $exeDevice.showSlide($exeDevice.activeSlide);
        }
    },

    lastSlide: function () {
        if (
            $exeDevice.validateSlide() &&
            $exeDevice.activeSlide < $exeDevice.slides.length - 1
        ) {
            $exeDevice.activeSlide = $exeDevice.slides.length - 1;
            $exeDevice.showSlide($exeDevice.activeSlide);
        }
    },

    previousSlide: function () {
        if ($exeDevice.validateSlide() && $exeDevice.activeSlide > 0) {
            $exeDevice.activeSlide--;
            $exeDevice.showSlide($exeDevice.activeSlide);
        }
    },

    firstSlide: function () {
        if ($exeDevice.validateSlide() && $exeDevice.activeSlide > 0) {
            $exeDevice.activeSlide = 0;
            $exeDevice.showSlide($exeDevice.activeSlide);
        }
    },

    addPoint: function () {
        const pvalid = $exeDevice.validatePoint(
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active]
        );
        if (pvalid !== false) {
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active] = pvalid;
            $exeDevice.clearPoint();
            $exeDevice.currentPoints = [];
            $exeDevice.redoPoints = [];
            $exeDevice.drawCurrentArea();
            $exeDevice.activeMap.pts.push($exeDevice.getDefaultPoint());
            $exeDevice.activeMap.active = $exeDevice.activeMap.pts.length - 1;
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active].map.pts.push(
                $exeDevice.getDefaultPoint()
            );
            $('#mapaNumberPoint').val($exeDevice.activeMap.pts.length);
            $exeDevice.typeEdit = -1;
            $('#mapaEPaste').hide();
            $('#mapaENumPoints').text($exeDevice.activeMap.pts.length);
            $exeDevice.updateQuestionsNumber();
        }
    },

    removePoint: function () {
        if ($exeDevice.activeMap.pts.length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOnePoint);
        } else {
            $exeDevice.activeMap.pts.splice($exeDevice.activeMap.active, 1);
            if (
                $exeDevice.activeMap.active >=
                $exeDevice.activeMap.pts.length - 1
            ) {
                $exeDevice.activeMap.active =
                    $exeDevice.activeMap.pts.length - 1;
            }
            $exeDevice.showPoint($exeDevice.activeMap.active);
            $exeDevice.typeEdit = -1;
            $('#mapaEPaste').hide();
            $('#mapaENumPoints').text($exeDevice.activeMap.pts.length);
            $('#mapaNumberPoint').val($exeDevice.activeMap.active + 1);
            $exeDevice.updateQuestionsNumber();
        }
    },

    copyPoint: function () {
        const pvalid = $exeDevice.validatePoint(
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active]
        );
        if (pvalid !== false) {
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active] = pvalid;
            $exeDevice.typeEdit = 0;
            $exeDevice.clipBoard = JSON.parse(
                JSON.stringify(
                    $exeDevice.activeMap.pts[$exeDevice.activeMap.active]
                )
            );
            $('#mapaEPaste').show();
        }
    },

    cutPoint: function () {
        const pvalid = $exeDevice.validatePoint(
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active]
        );
        if (pvalid !== false) {
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active] = pvalid;
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active] = pvalid;
            $exeDevice.numberCutCuestion = $exeDevice.activeMap.active;
            $exeDevice.typeEdit = 1;
            $('#mapaEPaste').show();
        }
    },

    pastePoint: function () {
        if ($exeDevice.typeEdit == 0) {
            $exeDevice.activeMap.active++;
            let p = $.extend(true, {}, $exeDevice.clipBoard);
            $exeDevice.changeId(p);
            $exeDevice.activeMap.pts.splice($exeDevice.activeMap.active, 0, p);
            $exeDevice.showPoint($exeDevice.activeMap.active);
            $exeDevice.updateQuestionsNumber();
        } else if ($exeDevice.typeEdit == 1) {
            $('#mapaEPaste').hide();
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                $exeDevice.activeMap.pts,
                $exeDevice.numberCutPointQuestion,
                $exeDevice.activeMap.active
            );
            $exeDevice.showPoint($exeDevice.activeMap.active);
            $('#mapaENumPoints').text($exeDevice.activeMap.pts.length);
            $exeDevice.updateQuestionsNumber();
        }
    },

    changeId: function (p) {
        let id = $exeDevice.getID();
        p.id = 'p' + id;
        p.map.id = 'a' + id;
        for (let i = 0; i < p.map.pts.length; i++) {
            let pi = p.map.pts[i];
            $exeDevice.changeId(pi);
        }
    },

    nextPoint: function () {
        const pvalid = $exeDevice.validatePoint(
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active]
        );
        if (pvalid !== false) {
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active] = pvalid;
            if (
                $exeDevice.activeMap.active <
                $exeDevice.activeMap.pts.length - 1
            ) {
                $exeDevice.activeMap.active++;
                $exeDevice.showPoint($exeDevice.activeMap.active);
            }
        }
    },

    lastPoint: function () {
        const pvalid = $exeDevice.validatePoint(
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active]
        );
        if (pvalid !== false) {
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active] = pvalid;
            if (
                $exeDevice.activeMap.active <
                $exeDevice.activeMap.pts.length - 1
            ) {
                $exeDevice.activeMap.active =
                    $exeDevice.activeMap.pts.length - 1;
                $exeDevice.showPoint($exeDevice.activeMap.active);
            }
        }
    },

    previousPoint: function () {
        const pvalid = $exeDevice.validatePoint(
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active]
        );
        if (pvalid !== false) {
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active] = pvalid;
            if ($exeDevice.activeMap.active > 0) {
                $exeDevice.activeMap.active--;
                $exeDevice.showPoint($exeDevice.activeMap.active);
            }
        }
    },

    firstPoint: function () {
        let pvalid = $exeDevice.validatePoint(
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active]
        );
        if (pvalid !== false) {
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active] = pvalid;
            if ($exeDevice.activeMap.active > 0) {
                $exeDevice.activeMap.active = 0;
                $exeDevice.showPoint($exeDevice.activeMap.active);
            }
        }
    },

    updateFieldGame: function (game) {
        $exeDevice.activeMap.active = 0;
        $exeDevice.qActive = 0;
        game.order = typeof game.order == 'undefined' ? '' : game.order;
        game.autoAudio =
            typeof game.autoAudio == 'undefined' ? true : game.autoAudio;
        game.autoShow =
            typeof game.autoShow == 'undefined' ? false : game.autoShow;
        game.optionsNumber =
            typeof game.optionsNumber == 'undefined' ? 0 : game.optionsNumber;
        game.evaluation =
            typeof game.evaluation != 'undefined' ? game.evaluation : false;
        game.evaluationID =
            typeof game.evaluationID != 'undefined' ? game.evaluationID : '';
        game.hideScoreBar =
            typeof game.hideScoreBar != 'undefined' ? game.hideScoreBar : false;
        game.weighted =
            typeof game.weighted !== 'undefined' ? game.weighted : 100;
        $exeDevice.id = $exeDevice.getIdeviceID();
        $exeDevicesEdition.iDevice.gamification.itinerary.setValues(
            game.itinerary
        );

        $('#mapaNumOptions').val(game.optionsNumber);
        $('#mapaEShowMinimize').prop('checked', game.showMinimize);
        $('#mapaEHideScoreBar').prop('checked', game.hideScoreBar);
        $('#mapaEHideAreas').prop('checked', game.hideAreas);
        $('#mapaEShowActiveAreas').prop('checked', game.showActiveAreas);
        $('#mapaURLImageMap').val(game.url);
        $('#mapaAuthorImageMap').val(game.authorImage);
        $('#mapaAltImageMap').val(game.altImage);
        $('#mapaEShowSolution').prop('checked', game.showSolution);
        $('#mapaEAutoShow').prop('checked', game.autoShow);
        $('#mapaEAutoAudio').prop('checked', game.autoAudio);
        $('#mapaETimeShowSolution').prop('disabled', !game.showSolution);
        $('#mapaETimeShowSolution').val(game.timeShowSolution);
        $('#mapaPercentajeIdentify').val(game.percentajeIdentify || 100);
        $('#mapaPercentajeShowQ').val(game.percentajeShowQ || 100);
        $('#mapaPercentajeQuestions').val(game.percentajeQuestions || 100);
        $('#mapaEEvaluation').prop('checked', game.evaluation);
        $('#mapaEEvaluationID').val(game.evaluationID);
        $('#mapaEEvaluationID').prop('disabled', !game.evaluation);

        $exeDevice.showImageMap(
            game.url,
            game.points[0].x,
            game.points[0].y,
            game.points[0].alt,
            game.points[0].iconType
        );
        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted
        );
        $exeDevice.activeMap.pts = game.points;
        $exeDevice.selectsGame = game.selectsGame;

        $(
            "input.MQE-TypeEvaluation[name='mpevaluation'][value='" +
                game.evaluationG +
                "']"
        ).prop('checked', true);
        $('#mapaEvaluationData').hide();
        $('#mapaSolutionData').css('display', 'flex');
        $('#mapaNumOptionsData').hide();
        $('#mapaSolutionOrder').val(game.order);
        $('#mapaEAutoAudioDiv').hide();
        $('#mapaEAutoShowDiv').hide();

        if (game.evaluationG == 1) {
            $('#mapaNumOptionsData').css('display', 'flex');
        }

        if (game.evaluationG == 4 || game.evaluationG == 0) {
            $('#mapaEAutoShowDiv').show();
            $('#mapaEAutoAudioDiv').show();
        }

        $('#mapaEvaluationIdentify').hide();
        if (game.evaluationG == 2 || game.evaluationG == 3) {
            $('#mapaEvaluationIdentify').css('display', 'flex');
        }

        $exeDevice.showQuestion($exeDevice.qActive);
        $('#mapaDataIdentifica').hide();
        if (
            game.evaluationG == 1 ||
            game.evaluationG == 2 ||
            game.evaluationG == 3
        ) {
            $('#mapaDataIdentifica').show();
            $('#mapaEShowSolution').hide();
            $('label[for=mapaEShowSolution]').hide();
            $('#mapaETimeShowSolution').prop('disabled', false);
        }

        $('#mapaIconTypeDiv').show();
        if (game.evaluationG == 1) {
            $('#mapaIconTypeDiv').hide();
        }

        if (game.evaluationG == 0) {
            $('#mapaSolutionData').hide();
        }

        if (game.evaluationG == 4) {
            $('#mapaFQuestions').show();
            $('#mapaEvaluationData').show();
            $('#mapaEShowSolution').show();
            $('label[for=mapaEShowSolution]').show();
            $('#mapaETimeShowSolution').prop('disabled', !game.showSolution);
        }

        $('#mapaSolutionOrderDiv').hide();
        if (game.evaluationG == 5) {
            $('#mapaSolutionOrderDiv').css('display', 'flex');
            $('#mapaSolutionData').hide();
        }
        $exeDevice.updateQuestionsNumber();
    },

    validTime: function (time) {
        let reg = /^(?:(?:([01]?\d|2[0-3]):)?([0-5]?\d):)?([0-5]?\d)$/;
        return time.length == 8 && reg.test(time);
    },

    placeImageWindows: function (image, naturalWidth, naturalHeight) {
        const wDiv =
                $(image).parent().width() > 0 ? $(image).parent().width() : 1,
            hDiv =
                $(image).parent().height() > 0 ? $(image).parent().height() : 1,
            varW = naturalWidth / wDiv,
            varH = naturalHeight / hDiv;
        let wImage = wDiv,
            hImage = hDiv,
            xImagen = 0,
            yImagen = 0;

        if (varW > varH) {
            wImage = parseInt(wDiv);
            hImage = parseInt(naturalHeight / varW);
            yImagen = parseInt((hDiv - hImage) / 2);
        } else {
            wImage = parseInt(naturalWidth / varH);
            hImage = parseInt(hDiv);
            xImagen = parseInt((wDiv - wImage) / 2);
        }
        return {
            w: wImage,
            h: hImage,
            x: xImagen,
            y: yImagen,
        };
    },

    clickImage: function (div, epx, epy) {
        $('#mapaArea').hide();
        const $cursor = $('#mapaCursor'),
            $div = $(div),
            posX = epx - $div.offset().left,
            posY = epy - $div.offset().top,
            wI = $div.width() > 0 ? $div.width() : 1,
            hI = $div.height() > 0 ? $div.height() : 1,
            lI = $div.position().left,
            tI = $div.position().top,
            iw = parseInt($('#mapaCursor').width() * $exeDevice.iconX),
            ih = parseInt($('#mapaCursor').height() * $exeDevice.iconY);

        $('#mapaX').val(posX / wI);
        $('#mapaY').val(posY / hI);

        $cursor.css({
            left: posX + lI - iw + 'px',
            top: posY + tI - ih + 'px',
            'z-index': 10,
        });
        $cursor.show();
    },

    clickImageTitle: function (div, epx, epy) {
        $('#mapaArea').hide();
        $('#mapaCursor').hide();
        const $textLink = $('#mapaTextLink'),
            $div = $(div),
            posX = epx - $div.offset().left,
            posY = epy - $div.offset().top,
            wI = $div.width() > 0 ? $div.width() : 1,
            hI = $div.height() > 0 ? $div.height() : 1,
            wl = $textLink.width() / 2,
            lI = $div.position().left,
            tI = $div.position().top;

        $('#mapaX').val(posX / wI);
        $('#mapaY').val(posY / hI);

        $textLink.css({
            left: posX + lI - wl + 'px',
            top: posY + tI + 'px',
            'z-index': 10,
        });
        $textLink.show();
    },

    addLevel: function () {
        $exeDevice.saveLevel();
        $exeDevice.levels[$exeDevice.levels.length - 1] = $.extend(
            true,
            {},
            $exeDevice.activeMap
        );
        let nlevel = $.extend(
            true,
            {},
            $exeDevice.activeMap.pts[$exeDevice.activeMap.active].map
        );
        $exeDevice.activeMap = $.extend(true, {}, nlevel);
        $exeDevice.levels.push(nlevel);
        $exeDevice.showLevel();
    },

    removeLevel: function (save) {
        let parent = $exeDevice.levels[$exeDevice.levels.length - 2];
        if (save) {
            parent.pts[parent.active].map = $.extend(
                true,
                {},
                $exeDevice.activeMap
            );
        }
        $exeDevice.activeMap = $.extend(true, {}, parent);
        $exeDevice.levels.pop();
        $exeDevice.showLevel();
    },

    saveLevel: function () {
        const p = $exeDevice.activeMap.pts[$exeDevice.activeMap.active],
            url = $('#mapaURLImageMap').val(),
            author = $('#mapaAuthorImageMap').val(),
            alt = $('#mapaAltImageMap').val();

        p.title = $('#mapaTitle').val().trim();
        p.type = parseInt($('#mapaTypePointSelect').val());
        p.x = parseFloat($('#mapaX').val());
        p.y = parseFloat($('#mapaY').val());
        p.x1 = parseFloat($('#mapaX1').val());
        p.y1 = parseFloat($('#mapaY1').val());
        p.footer = $('#mapaFooter').val();
        p.author = $('#mapaPAuthorImage').val();
        p.alt = $('#mapaPAltImage').val();
        p.url = $('#mapaURLImage').val().trim();
        p.question = $('#mapaIdentify').val();
        p.question_audio = $('#mapaURLAudioIdentify').val();
        p.video = $('#mapaURLYoutube').val().trim();
        p.iVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
            $('#mapaPInitVideo').val()
        );
        p.fVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
            $('#mapaPEndVideo').val()
        );
        p.audio = $('#mapaURLAudio').val().trim();
        p.iVideo = isNaN(p.iVideo) ? 0 : p.iVideo;
        p.fVideo = isNaN(p.fVideo) ? 3600 : p.fVideo;
        p.iconType = parseInt($('#mapaBtnDrop').data('value'));

        $exeDevice.activeMap.url = url;
        $exeDevice.activeMap.author = author;
        $exeDevice.activeMap.alt = alt;
        $exeDevice.activeMap.pts[$exeDevice.activeMap.active] = p;
    },

    closeLevel: function () {
        const confirmed = window.confirm(
            _('Do you want to save the changes of this map?')
        );
        if (!confirmed) {
            $exeDevice.removeLevel(false);
            $exeDevice.updateQuestionsNumber();
            return;
        }
        if (!$exeDevice.validateDataLevel()) {
            return;
        }
        $exeDevice.removeLevel(true);
        $exeDevice.updateQuestionsNumber();
    },

    showLevel: function () {
        let p = $exeDevice.getDefaultPoint();
        $exeDevice.activeMap.pts = $exeDevice.activeMap.pts || [];
        $exeDevice.activeMap.url = $exeDevice.activeMap.url || '';
        $exeDevice.activeMap.author = $exeDevice.activeMap.author || '';
        $exeDevice.activeMap.alt = $exeDevice.activeMap.alt || '';
        $exeDevice.activeMap.active = $exeDevice.activeMap.active || 0;

        if ($exeDevice.activeMap.pts.length > $exeDevice.activeMap.active) {
            p = $exeDevice.activeMap.pts[$exeDevice.activeMap.active];
        } else {
            $exeDevice.activeMap.pts.push(p);
        }

        $('#mapaURLImageMap').val($exeDevice.activeMap.url);
        $('#mapaAuthorImageMap').val($exeDevice.activeMap.author);
        $('#mapaAltImageMap').val($exeDevice.activeMap.alt);
        $('#mapaCursor').hide();

        $exeDevice.showImageMap(
            $exeDevice.activeMap.url,
            p.x,
            p.y,
            p.alt,
            p.iconType
        );
        $exeDevice.showPoint($exeDevice.activeMap.active);

        $('#mapaCloseDetail').hide();
        if ($exeDevice.levels.length > 1) {
            $('#mapaCloseDetail').css('display', 'flex');
            $('#mapaCloseDetail').show();
        }

        $exeDevice.stopSound();
        $exeDevice.stopVideo();
    },

    getPointValues: function () {
        let p = {};
        p.title = $('#mapaTitle').val().trim();
        p.type = parseInt($('#mapaTypePointSelect').val());
        p.x = parseFloat($('#mapaX').val());
        p.y = parseFloat($('#mapaY').val());
        p.x1 = parseFloat($('#mapaX1').val());
        p.y1 = parseFloat($('#mapaY1').val());
        p.footer = $('#mapaFooter').val();
        p.author = $('#mapaPAuthorImage').val();
        p.alt = $('#mapaPAltImage').val();
        p.url = $('#mapaURLImage').val().trim();
        p.video = $('#mapaURLYoutube').val().trim();
        p.iVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
            $('#mapaPInitVideo').val()
        );
        p.fVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
            $('#mapaPEndVideo').val()
        );
        p.audio = $('#mapaURLAudio').val().trim();
        p.iVideo = isNaN(p.iVideo) ? 0 : p.iVideo;
        p.fVideo = isNaN(p.fVideo) ? 3600 : p.fVideo;
        p.iconType = parseInt($('#mapaBtnDrop').data('value'));
        p.question = $('#mapaIdentify').val();
        p.question_audio = $('#mapaURLAudioIdentify').val();
        if ($('#mapaPContainer').is(':visible')) {
            p.video = $('#mapaPURLYoutube').val().trim();
            p.url = $('#mapaPURLImage').val().trim();
            p.title = $('#mapaPTitle').val().trim();
            p.footer = $('#mapaPFooter').val();
        }
        if (p.fVideo <= p.iVideo) p.fVideo = 36000;
        if (p.type == 1) {
            p.video = $exeDevices.iDevice.gamification.media.getIDYoutube(
                $('#mapaURLYoutube').val().trim()
            )
                ? $('#mapaURLYoutube').val()
                : '';
            if (p.video == '') {
                p.video = $exeDevice.getIDMediaTeca(
                    $('#mapaURLYoutube').val().trim()
                )
                    ? $('#mapaURLYoutube').val()
                    : '';
            }
        }
        p.eText = tinyMCE.get('mapaText').getContent();
        p.toolTip = tinyMCE.get('mapaToolTip').getContent();
        return p;
    },

    clickArea: function (epx, epy, epx1, epy1) {
        $('#mapaCursor').hide();
        const $area = $('#mapaArea'),
            $x = $('#mapaX'),
            $y = $('#mapaY'),
            $x1 = $('#mapaX1'),
            $y1 = $('#mapaY1'),
            $div = $('#mapaProtector'),
            posX = Math.round(epx - $div.offset().left),
            posY = Math.round(epy - $div.offset().top),
            posX1 = Math.round(epx1 - $div.offset().left),
            posY1 = Math.round(epy1 - $div.offset().top),
            wI = $div.width() > 0 ? $div.width() : 1,
            hI = $div.height() > 0 ? $div.height() : 1,
            lI = $div.position().left,
            tI = $div.position().top,
            px = posX >= posX1 ? lI + posX1 : lI + posX,
            py = posY >= posY1 ? tI + posY1 : tI + posY,
            w = Math.abs(posX1 - posX),
            h = Math.abs(posY1 - posY);

        $x.val(posX / wI);
        $y.val(posY / hI);
        $x1.val(posX1 / wI);
        $y1.val(posY1 / hI);
        $area.css({
            left: px + 'px',
            top: py + 'px',
            width: w + 'px',
            height: h + 'px',
            'z-index': 9,
        });
        $area.show();
    },

    removeTags: function (str) {
        const wrapper = $('<div></div>');
        wrapper.html(str);
        return wrapper.text();
    },
};
