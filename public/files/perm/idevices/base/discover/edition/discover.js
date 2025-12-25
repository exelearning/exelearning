/* eslint-disable no-undef */
/**
/**
 * Descubre Activity iDevice (edition code)
 * Version: 1
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narvaez Martinez
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    i18n: {
        category: _('Games'),
        name: _('Discover'),
    },
    msgs: {},
    classIdevice: 'discover',
    active: 0,
    wordsGame: [],
    typeEdit: -1,
    numberCutCuestion: -1,
    clipBoard: '',
    idevicePath: '',
    checkAltImage: true,
    playerAudio: '',
    isVideoType: false,
    version: 2,
    id: false,
    NUMMAXCARD: 4,
    ci18n: {},
    init: function (element, previousData, path) {
        this.refreshTranslations();
        this.ci18n.msgTryAgain = this.ci18n.msgTryAgain.replace(
            '&percnt;',
            '%'
        );
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;

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
            msgLive: c_('Life'),
            msgFullScreen: c_('Full Screen'),
            msgExitFullScreen: c_('Exit Full Screen'),
            msgNumQuestions: c_('Number of questions'),
            msgNoImage: c_('No picture question'),
            msgCool: c_('Cool!'),
            msgLoseT: c_('You lost 330 points'),
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
            msgOnlySaveAuto: c_(
                'Your score will be saved after each question. You can only play once.'
            ),
            msgSaveAuto: c_(
                'Your score will be automatically saved after each question.'
            ),
            msgYouScore: c_('Your score'),
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
            msgAuthor: c_('Authorship'),
            msgReboot: c_('Restart'),
            msgTimeOver: c_('Time is up. Please try again'),
            msgAllAttemps: c_(
                'You finished all the attempts! Please try again'
            ),
            mgsAllCards: c_('You found all the pairs!'),
            mgsAllTrios: c_('You found all the trios!'),
            mgsAllQuartets: c_('You found all the quartets!'),
            mgsGameStart: c_('The game has started! Select two cards'),
            mgsGameStart3: c_('The game has started! Select three cards'),
            mgsGameStart4: c_('The game has started! Select four cards'),
            msgNumbersAttemps: c_('Number of attempts'),
            msgPairs: c_('Pairs'),
            msgTrios: c_('Trios'),
            msgQuarts: c_('Quartets'),
            msgAttempts: c_('Attempts'),
            msgCompletedPair: c_('You completed a pair. Keep going!'),
            msgCompletedTrio: c_('You completed a trio. Keep going!'),
            msgCompletedQuartet: c_('You completed a quartet. Keep going!'),
            msgSelectCard: c_('Choose another card'),
            msgSelectCardOne: c_('Choose a card'),
            msgRookie: c_('Initial'),
            msgExpert: c_('Medium'),
            msgMaster: c_('Advanced'),
            msgLevel: c_('Level'),
            msgSelectLevel: c_('Select a level'),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgTypeGame: c_('Discover'),
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
        msgs.msgFewAttempts = _(
            'The number of attempts has to be bigger or equal to the number of pairs in the game. Please select 0 for infinite an unlimited number of attempts'
        );
        msgs.msgCompleteData = _(
            'You must indicate an image, a text or/and an audio for each card'
        );
        msgs.msgPairsMax = _('Maximum number of pairs: 20');
        msgs.msgIDLenght = _(
            'The report identifier must have at least 5 characters'
        );
        msgs.msgTitleAltImageWarning = _('Accessibility warning'); //eXe 3.0
        msgs.msgAltImageWarning = _(
            'At least one image has no description, are you sure you want to continue without including it? Without it the image may not be accessible to some users with disabilities, or to those using a text browser, or browsing the Web with images turned off.'
        ); //eXe 3.0
    },

    createForm: function () {
        const path = this.idevicePath,
            html = `
            <div id="descubreQEIdeviceForm">
                <p class="exe-block-info exe-block-dismissible" style="position:relative">
                    ${_('Create interactive activities in which players will have to discover pairs, trios or card quartets with images, texts and/or sounds.')}
                    <a href="https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe29/descubre.html" hreflang="es" target="_blank">
                        ${_('Usage Instructions')}
                    </a>
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Birds of a feather flock together.'))}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_('Options')}</a></legend>
                        <div>
                            <div class="mb-3">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="descubreEShowMinimize" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="descubreEShowMinimize">${_('Show minimized.')}</label>
                                </span>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <span class="me-2">${_('Type')}:</span>
                                <div class="form-check form-check-inline m-0">                               
                                    <input class="Descubre-GameMode form-check-input" checked id="descubreGame2" type="radio" name="qtxgamemode" value="0" />
                                    <label for="descubreGame2" class="form-check-label me-2">${_('Pairs')}</label>
                                </div>
                                <div class="form-check form-check-inline m-0"> 
                                    <input class="Descubre-GameMode form-check-input" id="descubreGame3" type="radio" name="qtxgamemode" value="1" />
                                    <label for="descubreGame3" class="form-check-label me-2">${_('Trios')}</label>
                                 </div>
                                <div class="form-check form-check-inline m-0"> 
                                    <input class="Descubre-GameMode form-check-input" id="descubreGame4" type="radio" name="qtxgamemode" value="2" />
                                    <label for="descubreGame4" class="form-check-label">${_('Quartets')}</label>
                                </div>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <span class="me-2">${_('Difficulty levels')}:</span>
                                <div class="form-check form-check-inline m-0"> 
                                    <input class="Descubre-GameLevel form-check-input" checked id="descubreL1" type="radio" name="qtxgamelevels" value="1" />1
                                    <label for="descubreL1" class="form-check-label me-2"></label>
                                </div>
                                <div class="form-check form-check-inline m-0"> 
                                    <input class="Descubre-GameLevel form-check-input" id="descubreL2" type="radio" name="qtxgamelevels" value="2" />
                                    <label for="descubreL2" class="form-check-label me-2">2</label>
                                </div>
                                <div class="form-check form-check-inline m-0"> 
                                    <input class="Descubre-GameLevel form-check-input" id="descubreL3" type="radio" name="qtxgamelevels" value="3" />
                                    <label for="descubreL3" class="form-check-label">3</label>
                                </div>
                            </div>
                            <div class="mb-2">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="descubreEShowCards" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="descubreEShowCards">${_('Visible cards')}.</label>
                                </span>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <label for="descubreETimeShowSolution" class="mb-0">${_('Time while the cards will be shown (seconds)')}:</label>
                                <input type="number" name="descubreETimeShowSolution" id="descubreETimeShowSolution" value="3" min="1" max="999" class="form-control" style="width:6ch" />
                            </div>
                            <div class="mb-2">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="descubreECustomMessages" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="descubreECustomMessages">${_('Custom messages')}.</label>
                                </span>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <label for="descubreETime" class="mb-0">${_('Time (minutes)')}:</label>
                                <input type="number" name="descubreETime" id="descubreETime" value="0" min="0" max="120" step="1" class="form-control" style="width:6ch" />
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <label for="descubreEAttempts" class="mb-0">${_('Number of attempts')}:</label>
                                <input type="number" name="descubreEAttempts" id="descubreEAttempts" value="0" min="0" max="100" step="1" class="form-control" style="width:6ch" />
                            </div>
                            <div class="mb-3">
                                <span class="toggle-item" role="switch" aria-checked="true">
                                    <span class="toggle-control">
                                        <input type="checkbox" checked id="descubreEShowSolution" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="descubreEShowSolution">${_('Show solutions')}.</label>
                                </span>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="descubreEHasFeedBack" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="descubreEHasFeedBack">${_('Feedback')}.</label>
                                </span>
                                <label for="descubreEPercentajeFB" class="ms-2 mb-0"><input type="number" name="descubreEPercentajeFB" id="descubreEPercentajeFB" value="100" min="5" max="100" step="5" disabled class="form-control" style="width:6ch" /></label>
                            </div>
                            <div id="descubreEFeedbackP" class="Descubre-EFeedbackP">
                                <textarea id="descubreEFeedBackEditor" class="exe-html-editor form-control" rows="4"></textarea>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <label for="descubreEPercentajeQuestions" class="mb-0">% ${_('Questions')}:</label>
                                <input type="number" name="descubreEPercentajeQuestions" id="descubreEPercentajeQuestions" value="100" min="1" max="100" class="form-control" style="width:6ch" />
                                <span id="descubreENumeroPercentaje">1/1</span>
                            </div>
                            <div class="d-none align-items-center gap-2 flex-nowrap mb-3">
                                <label for="descubreEAuthor" class="mb-0">${_('Authorship')}:</label>
                                <input id="descubreEAuthor" type="text" class="form-control" />
                            </div>
                            <div id="descubreEBackDiv">
                                <p class="Descubre-EInputImageBack gap-2">
                                    <label for="descubreEURLImgCard">${_('Image back')}: </label>
                                    <input type="text" class="exe-file-picker Descubre-EURLImage form-control me-0" id="descubreEURLImgCard"/>
                                    <a href="#" id="descubreEPlayCard" class="Descubre-ENavigationButton" title="${_('Show')}">
                                         <img src="${path}quextIEPlay.png" alt="${_('Show')}" class="Descubre-EButtonImage " />
                                    </a>
                                </p>
                                <p id="descubreEbackground" class="Descubre-Back">
                                    <img class="Descubre-EImageBack" src="" id="descubreECard" alt="${_('Image')}" style="display:none" />
                                    <img class="Descubre-EImageBack" src="${path}dcbHome.png" id="descubreENoCard" alt="${_('No image')}" />
                                </p>
                            </div>   
                           <div class="Games-Reportdiv d-flex align-items-center gap-2 flex-nowrap mt-3">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="descubreEEvaluation" class="toggle-input" data-target="#descubreEEvaluationIDWrapper" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="descubreEEvaluation">${_('Progress report')}.</label>
                                </span>
                                <span id="descubreEEvaluationIDWrapper" class="d-flex align-items-center gap-2 flex-nowrap">
                                   <label for="descubreEEvaluationID" class="mb-0">${_('Identifier')}:</label><input type="text" id="descubreEEvaluationID" disabled class="form-control" value="${eXeLearning.app.project.odeId || ''}" />
                                </span>
                                <strong class="GameModeLabel">
                                    <a href="#descubreEEvaluationHelp" id="descubreEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                        <img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}" />
                                    </a>
                                </strong>
                            </div>
                            <p id="descubreEEvaluationHelp" class="Descubre-TypeGameHelp exe-block-info">
                                ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                            </p>
                        </div>
                    </fieldset>
                    <fieldset class="exe-fieldset">
                        <legend><a href="#">${_('Pairs')}</a></legend>
                        <div class="Descubre-EPanel" id="descubreEPanel-0">
                            <div class="Descubre-Pareja">
                                ${$exeDevice.createCards(this.NUMMAXCARD)}
                            </div>
                            <div class="Descubre-EContents">
                                <div class="Descubre-EOrders Descubre-Hide" id="descubreEOrder">
                                    <div class="Descubre-ECustomMessage">
                                        <span class="sr-av">${_('Success')}</span>
                                        <span class="Descubre-EHit"></span>
                                        <label for="descubreEMessageOK">${_('Message')}:</label>
                                        <input type="text" id="descubreEMessageOK" />
                                    </div>
                                </div>
                                <div class="Descubre-ENavigationButtons gap-2">
                                    <a href="#" id="descubreEAdd" class="Descubre-ENavigationButton" title="${_('Add question')}">
                                        <img src="${path}quextIEAdd.png" alt="${_('Add question')}" class="Descubre-EButtonImage b-add" />
                                    </a>
                                    <a href="#" id="descubreEFirst" class="Descubre-ENavigationButton" title="${_('First question')}">
                                        <img src="${path}quextIEFirst.png" alt="${_('First question')}" class="Descubre-EButtonImage b-first" />
                                    </a>
                                    <a href="#" id="descubreEPrevious" class="Descubre-ENavigationButton" title="${_('Previous question')}">
                                        <img src="${path}quextIEPrev.png" alt="${_('Previous question')}" class="Descubre-EButtonImage b-prev" />
                                    </a>
                                    <span class="sr-av">${_('Question number:')}</span>
                                    <span class="Descubre-NumberQuestion" id="descubreENumberQuestion">1</span>
                                    <a href="#" id="descubreENext" class="Descubre-ENavigationButton" title="${_('Next question')}">
                                        <img src="${path}quextIENext.png" alt="${_('Next question')}" class="Descubre-EButtonImage b-next" />
                                    </a>
                                    <a href="#" id="descubreELast" class="Descubre-ENavigationButton" title="${_('Last question')}">
                                        <img src="${path}quextIELast.png" alt="${_('Last question')}" class="Descubre-EButtonImage b-last" />
                                    </a>
                                    <a href="#" id="descubreEDelete" class="Descubre-ENavigationButton" title="${_('Delete question')}">
                                        <img src="${path}quextIEDelete.png" alt="${_('Delete question')}" class="Descubre-EButtonImage b-delete" />
                                    </a>
                                    <a href="#" id="descubreECopy" class="Descubre-ENavigationButton" title="${_('Copy question')}">
                                        <img src="${path}quextIECopy.png" alt="${_('Copy question')}" class="Descubre-EButtonImage b-copy" />
                                    </a>
                                    <a href="#" id="descubreEPaste" class="Descubre-ENavigationButton" title="${_('Paste question')}">
                                        <img src="${path}quextIEPaste.png" alt="${_('Paste question')}" class="Descubre-EButtonImage b-paste" />
                                    </a>
                                </div>
                            </div>
                            <div class="Descubre-ENumQuestionDiv" id="descubreENumQuestionDiv">
                                <div class="Descubre-ENumQ"><span class="sr-av">${_('Question')}</span></div>
                                <span class="Descubre-ENumQuestions" id="descubreENumQuestions">0</span>
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
        $exeDevicesEdition.iDevice.tabs.init('descubreQEIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();
        this.enableForm();
    },

    createCards: function (num) {
        let cards = '';
        const path = $exeDevice.idevicePath;
        for (let i = 0; i < num; i++) {
            const card = `
            <div class="Descubre-DatosCarta" id="descubreEDatosCarta-${i}">
               <div class="Descubre-ECardHeader mb-3" style="display:none">
                   <span>
                        <span>Tipo:</span>
                        <div class="form-check form-check-inline m-0"> 
                            <input class="Descubre-Type-${i} form-check-input" checked id="descubreEMediaImage-${i}" type="radio" name="qxtmediatype-${i}" value="0" />
                            <label for="descubreEMediaImage-${i}">${_('Image')}</label>
                       </div>
                        <div class="form-check form-check-inline m-0"> 
                            <input class="Descubre-Type-${i} form-check-input" id="descubreEMediaText-${i}" type="radio" name="qxtmediatype-${i}" value="1" />
                            <label for="descubreEMediaText-${i}">${_('Text')}</label>
                       </div>
                        <div class="form-check form-check-inline m-0"> 
                            <input class="Descubre-Type-${i} form-check-input" id="descubreEMediaBoth-${i}" type="radio" name="qxtmediatype-${i}" value="2" />
                            <label for="descubreEMediaBoth-${i}">${_('Both')}</label>
                       </div>
                    </span>
               </div>
               <div class="Descubre-EMultimedia mb-3" id="descubreEMultimedia-${i}">
                    <div class="Descubre-Card">
                        <img class="Descubre-Hide Descubre-Image" src="${path}quextIEImage.png" id="descubreEImage-${i}" alt="${_('No image')}" />
                        <img class="Descubre-ECursor" src="${path}quextIECursor.gif" id="descubreECursor-${i}" alt="" />
                        <img class="Descubre-Image" src="${path}quextIEImage.png" id="descubreENoImage-${i}" alt="${_('No image')}" />
                        <div id="descubreETextDiv-${i}" class="Descubre-ETextDiv"></div>
                    </div>
                </div>
               <span class="Descubre-ETitleText" id="descubreETitleText-${i}">${_('Text')}</span>
               <div class="Descubre-EInputImage gap-2 mb-3" id="descubreEInputText-${i}">
                        <label for="descubreEText-${i}" class="sr-av">${_('Text')}</label>
                        <input id="descubreEText-${i}" type="text" class="form-control me-0" />
                        <label for="descubreEColor-${i}">${_('Color')}: </label>
                        <input type="color" id="descubreEColor-${i}" class="form-control form-control-color" name="descubreEColor-${i}" value="#000000">
                        <label for="descubreEBackColor-${i}">${_('Background')}: </label>
                        <input type="color" id="descubreEBackColor-${i}" class="form-control form-control-color" name="descubreEBackColor-${i}" value="#ffffff">
                </div>
               <span class="Descubre-ETitleImage" id="descubreETitleImage-${i}">${_('Image')}</span>
               <div class="Descubre-EInputImage mb-3 gap-2" id="descubreEInputImage-${i}">
                   <label class="sr-av" for="descubreEURLImage-${i}">URL</label>
                       <input type="text" class="exe-file-picker Descubre-EURLImage form-control me-0" id="descubreEURLImage-${i}" />
                   <a href="#" id="descubreEPlayImage-${i}" class="Descubre-ENavigationButton Descubre-EPlayVideo" title="${_('Show')}"><img src="${path}quextIEPlay.png" alt="${_('Show')}" class="Descubre-EButtonImage " /></a>
                   <a href="#" id="descubreShowAlt-${i}" class="Descubre-ENavigationButton Descubre-EPlayVideo" title="${_('More')}"><img src="${path}quextEIMore.png" alt="${_('More')}" class="Descubre-EButtonImage " /></a>
               </div>
               <div class="Descubre-ECoord">
                       <label for="descubreEXImage-${i}">X:</label>
                           <input id="descubreEXImage-${i}" type="text" value="0" class="form-control" />
                       <label for="descubreEYImage-${i}">Y:</label>
                           <input id="descubreEYImage-${i}" type="text" value="0" class="form-control" />
               </div>
               <div class="Descubre-EAuthorAlt  mb-3" id="descubreEAuthorAlt-${i}">
                   <div class="Descubre-EInputAuthor" id="descubreEInputAuthor-${i}">
                           <label for="descubreEAuthor-${i}">${_('Authorship')}</label><input id="descubreEAuthor-${i}" type="text" class="form-control" />
                   </div>
                   <div class="Descubre-EInputAlt" id="descubreEInputAlt-${i}">
                           <label for="descubreEAlt-${i}">${_('Alternative text')}</label><input id="descubreEAlt-${i}" type="text" class="form-control" />
                   </div>
               </div>
               <span id="descubreETitleAudio-${i}">${_('Audio')}</span>
               <div class="Descubre-EInputAudio gap-2" id="descubreEInputAudio-${i}">
                   <label class="sr-av" for="descubreEURLAudio-${i}">URL</label>
                       <input type="text" class="exe-file-picker Descubre-EURLAudio form-control me-0" id="descubreEURLAudio-${i}" />
                   <a href="#" id="descubreEPlayAudio-${i}" class="Descubre-ENavigationButton Descubre-EPlayVideo" title="${_('Audio')}"><img src="${path}quextIEPlay.png" alt="Play" class="Descubre-EButtonImage " /></a>
               </div>
           </div>`;
            cards += card;
        }
        return cards;
    },

    enableForm: function () {
        $exeDevice.initQuestions();

        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
    },

    updateQuestionsNumber: function () {
        const percentInput = parseInt(
            $exeDevice.removeTags($('#descubreEPercentajeQuestions').val())
        );

        if (isNaN(percentInput)) return;

        const percentaje = Math.min(Math.max(percentInput, 1), 100),
            totalWords = $exeDevice.wordsGame.length,
            num = Math.max(1, Math.round((percentaje * totalWords) / 100));

        $('#descubreENumeroPercentaje').text(`${num}/${totalWords}`);
    },

    showQuestion: function (i) {
        let num = Math.max(0, Math.min(i, $exeDevice.wordsGame.length - 1));
        const q = $exeDevice.wordsGame[num];
        $exeDevice.clearQuestion();
        for (let k = 0; k < $exeDevice.NUMMAXCARD; k++) {
            const p = q.data[k];
            $('#descubreEText-' + k).val(p.eText);
            $('#descubreETextDiv-' + k).text(p.eText);
            $('#descubreEColor-' + k).val(p.color);
            $('#descubreEBackColor-' + k).val(p.backcolor);
            $('#descubreEURLImage-' + k).val(p.url);
            $('#descubreEXImage-' + k).val(p.x);
            $('#descubreEYImage-' + k).val(p.y);
            $('#descubreEAuthor-' + k).val(p.author);
            $('#descubreEAlt-' + k).val(p.alt);
            $('#descubreEURLAudio-' + k).val(p.audio);
            $exeDevice.showImage(p.url, p.x, p.y, p.alt, k);
            $('#descubreETextDiv-' + k).css({
                color: p.color,
                'background-color': $exeDevice.hexToRgba(p.backcolor),
            });
        }
        $('#descubreEMessageOK').val(q.msgHit);
        $('#descubreEMessageKO').val(q.msgError);
        $('#descubreENumberQuestion').text(i + 1);
    },

    hexToRgba: function (hex) {
        hex = hex.replace(/^#/, '');
        if (!/^[\da-f]{3}([\da-f]{3})?$/i.test(hex))
            throw new Error('Color hexadecimal inválido');
        if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
        const [r, g, b] = [
            hex.slice(0, 2),
            hex.slice(2, 4),
            hex.slice(4, 6),
        ].map((v) => parseInt(v, 16));
        return `rgba(${r}, ${g}, ${b}, 0.7)`;
    },

    initQuestions: function () {
        for (let i = 0; i < $exeDevice.NUMMAXCARD; i++) {
            $('#descubreEInputImage-' + i).css('display', 'flex');
            $('#descubreEMediaImage-' + i).prop('disabled', false);
            $('#descubreEMediaText-' + i).prop('disabled', false);
            $('#descubreEMediaBoth-' + i).prop('disabled', false);
            $('#descubreEAuthorAlt-' + i).hide();
        }

        $('#descubreEDatosCarta-2').hide();
        $('#descubreEDatosCarta-3').hide();

        if ($exeDevice.wordsGame.length == 0) {
            const question = $exeDevice.getQuestionDefault();
            $exeDevice.wordsGame.push(question);
        }
        this.active = 0;
    },

    getQuestionDefault() {
        const data = [];
        for (let i = 0; i < $exeDevice.NUMMAXCARD; i++) {
            data.push({
                type: 0,
                url: '',
                audio: '',
                x: 0,
                y: 0,
                author: '',
                alt: '',
                eText: '',
                color: '#000000',
                backcolor: '#ffffff',
            });
        }
        return {
            data,
            msgError: '',
            msgHit: '',
        };
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            let wrapper = $('<div></div>');
            wrapper.html(originalHTML);
            let json = $('.descubre-DataGame', wrapper).text();
            json = $exeDevices.iDevice.gamification.helpers.decrypt(json);

            const dataGame =
                    $exeDevices.iDevice.gamification.helpers.isJsonString(json),
                $imagesLink0 = $('.descubre-LinkImages-0', wrapper),
                $audiosLink0 = $('.descubre-LinkAudios-0', wrapper),
                $imagesLink1 = $('.descubre-LinkImages-1', wrapper),
                $audiosLink1 = $('.descubre-LinkAudios-1', wrapper),
                $imagesLink2 = $('.descubre-LinkImages-2', wrapper),
                $audiosLink2 = $('.descubre-LinkAudios-2', wrapper),
                $imagesLink3 = $('.descubre-LinkImages-3', wrapper),
                $audiosLink3 = $('.descubre-LinkAudios-3', wrapper),
                $imageBack = $('.descubre-ImageBack', wrapper),
                linkImages = [
                    $imagesLink0,
                    $imagesLink1,
                    $imagesLink2,
                    $imagesLink3,
                ],
                linkAudios = [
                    $audiosLink0,
                    $audiosLink1,
                    $audiosLink2,
                    $audiosLink3,
                ];

            dataGame.imgCard = '';
            if ($imageBack.length === 1) {
                dataGame.imgCard = $imageBack.attr('href') || '';
            }

            if (
                typeof dataGame.version == 'undefined' ||
                dataGame.version < 1
            ) {
                $imagesLink0.each(function () {
                    const iq = parseInt($(this).text());
                    if (!isNaN(iq) && iq < dataGame.wordsGame.length) {
                        dataGame.wordsGame[iq].url0 = $(this).attr('href');
                        if (dataGame.wordsGame[iq].url0.length < 4) {
                            dataGame.wordsGame[iq].url0 = '';
                        }
                    }
                });

                $audiosLink0.each(function () {
                    const iq = parseInt($(this).text());
                    if (!isNaN(iq) && iq < dataGame.wordsGame.length) {
                        dataGame.wordsGame[iq].audio0 = $(this).attr('href');
                        if (dataGame.wordsGame[iq].audio0.length < 4) {
                            dataGame.wordsGame[iq].audio0 = '';
                        }
                    }
                });

                $imagesLink1.each(function () {
                    const iq = parseInt($(this).text());
                    if (!isNaN(iq) && iq < dataGame.wordsGame.length) {
                        dataGame.wordsGame[iq].url1 = $(this).attr('href');
                        if (dataGame.wordsGame[iq].url1.length < 4) {
                            dataGame.wordsGame[iq].url1 = '';
                        }
                    }
                });

                $audiosLink1.each(function () {
                    const iq = parseInt($(this).text());
                    if (!isNaN(iq) && iq < dataGame.wordsGame.length) {
                        dataGame.wordsGame[iq].audio1 = $(this).attr('href');
                        if (dataGame.wordsGame[iq].audio1.length < 4) {
                            dataGame.wordsGame[iq].audio1 = '';
                        }
                    }
                });

                $imagesLink2.each(function () {
                    const iq = parseInt($(this).text());
                    if (!isNaN(iq) && iq < dataGame.wordsGame.length) {
                        dataGame.wordsGame[iq].url2 = $(this).attr('href');
                        if (dataGame.wordsGame[iq].url2.length < 4) {
                            dataGame.wordsGame[iq].url2 = '';
                        }
                    }
                });

                $audiosLink2.each(function () {
                    const iq = parseInt($(this).text());
                    if (!isNaN(iq) && iq < dataGame.wordsGame.length) {
                        dataGame.wordsGame[iq].audio2 = $(this).attr('href');
                        if (dataGame.wordsGame[iq].audio2.length < 4) {
                            dataGame.wordsGame[iq].audio2 = '';
                        }
                    }
                });

                $imagesLink3.each(function () {
                    const iq = parseInt($(this).text());
                    if (!isNaN(iq) && iq < dataGame.wordsGame.length) {
                        dataGame.wordsGame[iq].url3 = $(this).attr('href');
                        if (dataGame.wordsGame[iq].url3.length < 4) {
                            dataGame.wordsGame[iq].url3 = '';
                        }
                    }
                });

                $audiosLink3.each(function () {
                    const iq = parseInt($(this).text());
                    if (!isNaN(iq) && iq < dataGame.wordsGame.length) {
                        dataGame.wordsGame[iq].audio3 = $(this).attr('href');
                        if (dataGame.wordsGame[iq].audio3.length < 4) {
                            dataGame.wordsGame[iq].audio3 = '';
                        }
                    }
                });

                let words = [];
                for (let j = 0; j < dataGame.wordsGame.length; j++) {
                    const p = $exeDevice.getQuestionDefault();
                    p.data[0].url = dataGame.wordsGame[j].url0 || '';
                    p.data[1].url = dataGame.wordsGame[j].url1 || '';
                    p.data[2].url = dataGame.wordsGame[j].url2 || '';
                    p.data[3].url = '';
                    p.data[0].audio = dataGame.wordsGame[j].audio0 || '';
                    p.data[1].audio = dataGame.wordsGame[j].audio1 || '';
                    p.data[2].audio = dataGame.wordsGame[j].audio2 || '';
                    p.data[3].audio = '';
                    p.data[0].x = dataGame.wordsGame[j].x0 || 0;
                    p.data[1].x = dataGame.wordsGame[j].x1 || 0;
                    p.data[2].x = dataGame.wordsGame[j].x2 || 0;
                    p.data[3].x = 0;
                    p.data[0].y = dataGame.wordsGame[j].y0 || 0;
                    p.data[1].y = dataGame.wordsGame[j].y1 || 0;
                    p.data[2].y = dataGame.wordsGame[j].y2 || 0;
                    p.data[3].y = 0;
                    p.data[0].author = dataGame.wordsGame[j].autmor0 || '';
                    p.data[1].author = dataGame.wordsGame[j].autmor1 || '';
                    p.data[2].author = dataGame.wordsGame[j].autmor2 || '';
                    p.data[3].author = '';
                    p.data[0].alt = dataGame.wordsGame[j].alt0 || '';
                    p.data[1].alt = dataGame.wordsGame[j].alt1 || '';
                    p.data[2].alt = dataGame.wordsGame[j].alt2 || '';
                    p.data[3].alt = '';
                    p.data[0].eText = dataGame.wordsGame[j].eText0 || '';
                    p.data[1].eText = dataGame.wordsGame[j].eText1 || '';
                    p.data[2].eText = dataGame.wordsGame[j].eText2 || '';
                    p.data[3].eText = '';
                    p.data[0].backcolor = '#ffffff';
                    p.data[1].backcolor = '#ffffff';
                    p.data[2].backcolor = '#ffffff';
                    p.data[3].backcolor = '#ffffff';
                    p.data[0].color = '#00000';
                    p.data[1].color = '#00000';
                    p.data[2].color = '#00000';
                    p.data[3].color = '#00000';
                    p.msgError = '';
                    p.msgHit = '';
                    words.push(p);
                }
                dataGame.wordsGame = words;
            } else {
                for (let k = 0; k < linkImages.length; k++) {
                    const $linImg = linkImages[k];
                    $linImg.each(function () {
                        const iq = parseInt($(this).text());
                        if (!isNaN(iq) && iq < dataGame.wordsGame.length) {
                            const p = dataGame.wordsGame[iq].data[k];
                            p.url = $(this).attr('href');
                            if (p.url.length < 4) {
                                p.url = '';
                            }
                        }
                    });
                    const $linkAudio = linkAudios[k];
                    $linkAudio.each(function () {
                        const iq = parseInt($(this).text());
                        if (!isNaN(iq) && iq < dataGame.wordsGame.length) {
                            const p = dataGame.wordsGame[iq].data[k];
                            p.audio = $(this).attr('href');
                            if (p.audio.length < 4) {
                                p.audio = '';
                            }
                        }
                    });
                }
            }

            $exeDevice.updateFieldGame(dataGame);

            const instructions = $('.descubre-instructions', wrapper);
            if (instructions.length == 1)
                $('#eXeGameInstructions').val(instructions.html());

            const textAfter = $('.descubre-extra-content', wrapper);
            if (textAfter.length == 1)
                $('#eXeIdeviceTextAfter').val(textAfter.html());

            const textFeedBack = $('.descubre-feedback-game', wrapper);
            if (textFeedBack.length == 1)
                $('#descubreEFeedBackEditor').val(textFeedBack.html());
            $exeDevicesEdition.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs
            );
            $exeDevice.showQuestion(0);
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

        const fields = this.ci18n,
            i18n = fields;

        for (let i in fields) {
            let fVal = $('#ci18n_' + i).val();
            if (fVal != '') i18n[i] = fVal;
        }
        dataGame.msgs = i18n;

        let json = JSON.stringify(dataGame),
            divContent = '';

        json = $exeDevices.iDevice.gamification.helpers.encrypt(json);

        const textFeedBack = tinyMCE
            .get('descubreEFeedBackEditor')
            .getContent();
        if (dataGame.instructions != '')
            divContent =
                '<div class="descubre-instructions">' +
                dataGame.instructions +
                '</div>';

        const linksImages = $exeDevice.createlinksImage(dataGame.wordsGame),
            linksAudios = $exeDevice.createlinksAudio(dataGame.wordsGame);

        let imgCard = $('#descubreEURLImgCard').val();
        if (imgCard.trim().length > 4) {
            imgCard = `<a href="${imgCard}" class="js-hidden descubre-ImageBack" alt="Back" />Background</a>`;
        } else {
            imgCard = '';
        }

        let html = '<div class="descubre-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html +=
            '<div class="descubre-feedback-game">' + textFeedBack + '</div>';
        html += divContent;
        html += '<div class="descubre-DataGame js-hidden">' + json + '</div>';
        html += linksImages;
        html += linksAudios;
        html += imgCard;

        const textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();
        if (textAfter != '') {
            html +=
                '<div class="descubre-extra-content">' + textAfter + '</div>';
        }

        html +=
            '<div class="descubre-bns js-hidden">' +
            $exeDevice.msgs.msgNoSuportBrowser +
            '</div>';
        html += '</div>';
        return html;
    },

    validateAlt: function () {
        const altImage = $('#descubreEAlt').val();
        if (!$exeDevice.checkAltImage || altImage !== '') return true;

        eXe.app.confirm(
            $exeDevice.msgs.msgTitleAltImageWarning,
            $exeDevice.msgs.msgAltImageWarning,
            function () {
                $exeDevice.checkAltImage = false;
                const saveButton = document.getElementsByClassName(
                    'button-save-idevice'
                )[0];
                saveButton.click();
            }
        );
        return false;
    },

    createlinksImage: function (wordsGame) {
        let html = '';
        for (let i = 0; i < wordsGame.length; i++) {
            const q = wordsGame[i];
            for (let k = 0; k < $exeDevice.NUMMAXCARD; k++) {
                const p = q.data[k];
                let linkImage = '';
                if (
                    typeof p.url != 'undefined' &&
                    p.url.length > 0 &&
                    p.url.indexOf('http') != 0
                ) {
                    linkImage =
                        '<a href="' +
                        p.url +
                        '" class="js-hidden descubre-LinkImages-' +
                        k +
                        '">' +
                        i +
                        '</a>';
                }
                html += linkImage;
            }
        }
        return html;
    },

    createlinksAudio: function (wordsGame) {
        let html = '';
        for (let i = 0; i < wordsGame.length; i++) {
            const q = wordsGame[i];
            for (let k = 0; k < $exeDevice.NUMMAXCARD; k++) {
                const p = q.data[k];
                let linkImage = '';
                if (
                    typeof p.audio != 'undefined' &&
                    p.audio.indexOf('http') != 0 &&
                    p.audio.length > 4
                ) {
                    linkImage =
                        '<a href="' +
                        p.audio +
                        '" class="js-hidden descubre-LinkAudios-' +
                        k +
                        '">' +
                        i +
                        '</a>';
                }
                html += linkImage;
            }
        }
        return html;
    },

    validateQuestion: function () {
        let message = '',
            msgs = $exeDevice.msgs,
            gameMode = parseInt($('input[name=qtxgamemode]:checked').val()),
            q = {};

        q.data = [];

        for (let k = 0; k < $exeDevice.NUMMAXCARD; k++) {
            const p = {};
            p.x = parseFloat($('#descubreEXImage-' + k).val());
            p.y = parseFloat($('#descubreEYImage-' + k).val());
            p.author = $('#descubreEAuthor-' + k).val();
            p.alt = $('#descubreEAlt-' + k).val();
            p.url = $('#descubreEURLImage-' + k)
                .val()
                .trim();
            p.audio = $('#descubreEURLAudio-' + k).val();
            p.eText = $('#descubreEText-' + k).val();
            p.color = $('#descubreEColor-' + k).val();
            p.backcolor = $('#descubreEBackColor-' + k).val();
            q.data.push(p);
        }

        q.msgHit = $('#descubreEMessageOK').val();
        q.msgError = $('#descubreEMessageKO').val();

        $exeDevice.stopSound();

        let num_cards = 2;
        if (gameMode == 1) {
            num_cards = 3;
        } else if (gameMode == 2) {
            num_cards = 4;
        }

        for (let j = 0; j < num_cards; j++) {
            if (
                q.data[j].eText.length == 0 &&
                q.data[j].url.length < 5 &&
                q.data[j].audio.length == 0
            ) {
                message = msgs.msgCompleteData;
                break;
            }
        }
        if (message.length == 0) {
            $exeDevice.wordsGame[$exeDevice.active] = q;
            message = true;
        } else {
            $exeDevice.showMessage(message);
            message = false;
        }
        return message;
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    getIdeviceID: function () {
        const ideviceid =
            $('#descubreQEIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';

        return ideviceid;
    },

    validateData: function () {
        const clear = $exeDevice.removeTags,
            instructions = tinyMCE.get('eXeGameInstructions').getContent(),
            textFeedBack = tinyMCE.get('descubreEFeedBackEditor').getContent(),
            textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent(),
            showMinimize = $('#descubreEShowMinimize').is(':checked'),
            itinerary =
                $exeDevicesEdition.iDevice.gamification.itinerary.getValues(),
            caseSensitive = $('#descubreECaseSensitive').is(':checked'),
            feedBack = $('#descubreEHasFeedBack').is(':checked'),
            percentajeFB = parseInt(clear($('#descubreEPercentajeFB').val())),
            customMessages = $('#descubreECustomMessages').is(':checked'),
            showCards = $('#descubreEShowCards').is(':checked'),
            percentajeQuestions = parseInt(
                clear($('#descubreEPercentajeQuestions').val())
            ),
            time = parseInt(clear($('#descubreETime').val())),
            attempts = parseInt(clear($('#descubreEAttempts').val())),
            timeShowSolution = parseInt(
                clear($('#descubreETimeShowSolution').val())
            ),
            author = $('#descubreEAuthor').val(),
            showSolution = $('#descubreEShowSolution').is(':checked'),
            gameMode = parseInt($('input[name=qtxgamemode]:checked').val()),
            gameLevels = parseInt($('input[name=qtxgamelevels]:checked').val()),
            wordsGame = $exeDevice.wordsGame,
            evaluation = $('#descubreEEvaluation').is(':checked'),
            evaluationID = $('#descubreEEvaluationID').val(),
            id = $exeDevice.getIdeviceID();

        if (!itinerary) return;

        if (evaluation && evaluationID.length < 5) {
            eXe.app.alert($exeDevice.msgs.msgIDLenght);
            return false;
        }

        if (wordsGame.length == 0) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
            return false;
        }

        if (gameLevels == 3 && wordsGame.length < 3) {
            $exeDevice.showMessage(
                'Para un juego con tres niveles de dificultad necesita al menos tres cuestiones'
            );
            return false;
        } else if (gameLevels == 2 && wordsGame.length < 2) {
            $exeDevice.showMessage(
                'Para un juego con dos niveles de dificultad necesita al menos dos cuestiones'
            );
            return false;
        }

        let num_cards = 2;
        if (gameMode == 1) {
            num_cards = 3;
        } else if (gameMode == 2) {
            num_cards = 4;
        }

        for (let i = 0; i < wordsGame.length; i++) {
            for (let j = 0; j < num_cards; j++) {
                const p = wordsGame[i].data[j];
                if (p.eText == 0 && p.url.length < 5 && p.audio.length < 5) {
                    $exeDevice.showMessage($exeDevice.msgs.msgCompleteData);
                    return false;
                }
            }
        }

        if (
            attempts > 0 &&
            attempts < (wordsGame.length * percentajeQuestions) / 100
        ) {
            $exeDevice.showMessage($exeDevice.msgs.msgFewAttempts);
            return false;
        }

        const scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();

        return {
            typeGame: 'Descubre',
            author: author,
            instructions: instructions,
            showMinimize: showMinimize,
            showSolution: showSolution,
            itinerary: itinerary,
            wordsGame: wordsGame,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted,
            textFeedBack: escape(textFeedBack),
            textAfter: escape(textAfter),
            caseSensitive: caseSensitive,
            feedBack: feedBack,
            percentajeFB: percentajeFB,
            customMessages: customMessages,
            percentajeQuestions: percentajeQuestions,
            timeShowSolution: timeShowSolution,
            time: time,
            attempts: attempts,
            gameMode: gameMode,
            gameLevels: gameLevels,
            showCards: showCards,
            version: $exeDevice.version,
            evaluation: evaluation,
            evaluationID: evaluationID,
            id: id,
        };
    },

    showImage: function (url, x, y, alt, nimg) {
        let $image = $('#descubreEImage-0'),
            $cursor = $('#descubreECursor-0'),
            $nimage = $('#descubreENoImage-0');
        if (nimg == 1) {
            $image = $('#descubreEImage-1');
            $cursor = $('#descubreECursor-1');
            $nimage = $('#descubreENoImage-1');
        } else if (nimg == 2) {
            $image = $('#descubreEImage-2');
            $cursor = $('#descubreECursor-2');
            $nimage = $('#descubreENoImage-2');
        } else if (nimg == 3) {
            $image = $('#descubreEImage-3');
            $cursor = $('#descubreECursor-3');
            $nimage = $('#descubreENoImage-3');
        }
        $image.hide();
        $cursor.hide();
        $image.attr('alt', alt);
        $nimage.show();
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
                    $nimage.hide();
                    $exeDevice.paintMouse(this, $cursor, x, y);
                    return true;
                }
            })
            .on('error', function () {
                return false;
            });
    },

    playSound: function (selectedFile) {
        const selectFile =
            $exeDevices.iDevice.gamification.media.extractURLGD(selectedFile);
        $exeDevice.playerAudio = new Audio(selectFile);
        $exeDevice.playerAudio.addEventListener('canplaythrough', function () {
            $exeDevice.playerAudio.play();
        });
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
        // Inicializar toggles (ARIA + data-target)
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
        $('#descubreEPaste').hide();
        $('input.Descubre-GameMode').on('click', function () {
            $('#descubreEDatosCarta-2').hide();
            $('#descubreEDatosCarta-3').hide();
            const type = parseInt($(this).val());
            if (type == 1) {
                $('#descubreEDatosCarta-2').show();
            } else if (type == 2) {
                $('#descubreEDatosCarta-2').show();
                $('#descubreEDatosCarta-3').show();
            }
        });

        $('#descubreEAdd').on('click', function (e) {
            e.preventDefault();
            $exeDevice.addQuestion();
        });

        $('#descubreEFirst').on('click', function (e) {
            e.preventDefault();
            $exeDevice.firstQuestion();
        });

        $('#descubreEPrevious').on('click', function (e) {
            e.preventDefault();
            $exeDevice.previousQuestion();
        });

        $('#descubreENext').on('click', function (e) {
            e.preventDefault();
            $exeDevice.nextQuestion();
            return false;
        });

        $('#descubreELast').on('click', function (e) {
            e.preventDefault();
            $exeDevice.lastQuestion();
        });

        $('#descubreEDelete').on('click', function (e) {
            e.preventDefault();
            $exeDevice.removeQuestion();
        });

        $('#descubreECopy').on('click', function (e) {
            e.preventDefault();
            $exeDevice.copyQuestion();
        });

        $('#descubreECut').on('click', function (e) {
            e.preventDefault();
            $exeDevice.cutQuestion();
        });

        $('#descubreEPaste').on('click', function (e) {
            e.preventDefault();
            $exeDevice.pasteQuestion();
        });

        if (
            window.File &&
            window.FileReader &&
            window.FileList &&
            window.Blob
        ) {
            $('#eXeGameExportImport .exe-field-instructions')
                .eq(0)
                .text(_('Supported formats') + ': json, txt');
            $('#eXeGameExportImport').show();
            $('#eXeGameImportGame').attr('accept', '.txt, .json, .xml');
            $('#eXeGameImportGame').on('change', function (e) {
                const file = e.target.files[0];
                if (!file) {
                    eXe.app.alert(_('Select a file') + ' (txt, json)');
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
                    eXe.app.alert(_('Select a file') + ' (txt, json)');
                    return;
                }
                const reader = new FileReader();
                reader.onload = function (e) {
                    $exeDevice.importGame(e.target.result, file.type);
                };
                reader.readAsText(file);
            });
            $('#eXeGameExportGame').on('click', function () {
                $exeDevice.exportGame();
            });
        } else {
            $('#eXeGameExportImport').hide();
        }

        $('#descubreEHasFeedBack').on('change', function () {
            const marcado = $(this).is(':checked');
            if (marcado) {
                $('#descubreEFeedbackP').slideDown();
            } else {
                $('#descubreEFeedbackP').slideUp();
            }
            $('#descubreEPercentajeFB').prop('disabled', !marcado);
        });

        $('#descubreECustomMessages').on('change', function () {
            const messages = $(this).is(':checked');
            $exeDevice.showSelectOrder(messages);
        });

        $('#descubreEShowCards').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#descubreETimeShowSolution').prop('disabled', marcado);
        });

        $('#descubreEPercentajeQuestions').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 3);
            this.value = v;
            if (this.value > 0 && this.value < 101) {
                $exeDevice.updateQuestionsNumber();
            }
        });

        $('#descubreEPercentajeQuestions').on('focusout', function () {
            this.value = this.value.trim() == '' ? 100 : this.value;
            this.value = this.value > 100 ? 100 : this.value;
            this.value = this.value < 1 ? 1 : this.value;
            $exeDevice.updateQuestionsNumber();
        });

        $('#descubreETime').on('focusout', function () {
            this.value = this.value.trim() == '' ? 0 : this.value;
            this.value = this.value > 999 ? 999 : this.value;
            this.value = this.value < 0 ? 0 : this.value;
        });

        $('#descubreETime').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 3);
            this.value = v;
        });
        $('#descubreEAttempts').on('focusout', function () {
            this.value = this.value.trim() == '' ? 0 : this.value;
            this.value = this.value > 999 ? 999 : this.value;
            this.value = this.value < 0 ? 0 : this.value;
        });

        $('#descubreEAttempts').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 3);
            this.value = v;
        });

        $('#descubreEPercentajeQuestions').on('click', function () {
            $exeDevice.updateQuestionsNumber();
        });

        $('#descubreETimeShowSolution').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 3);
            this.value = v;
        });

        $('#descubreETimeShowSolution').on('focusout', function () {
            this.value = this.value.trim() == '' ? 3 : this.value;
            this.value = this.value > 999 ? 999 : this.value;
            this.value = this.value < 1 ? 1 : this.value;
        });

        $('#descubreEURLImage-0').on('change', function () {
            $exeDevice.loadImage(0, $(this).val());
        });

        $('#descubreEURLImage-1').on('change', function () {
            $exeDevice.loadImage(1, $(this).val());
        });

        $('#descubreEURLImage-2').on('change', function () {
            $exeDevice.loadImage(2, $(this).val());
        });

        $('#descubreEURLImage-3').on('change', function () {
            $exeDevice.loadImage(3, $(this).val());
        });

        $('#descubreEPlayImage-0').on('click', function (e) {
            e.preventDefault();
            $exeDevice.loadImage(0, $('#descubreEURLImage-0').val());
        });
        $('#descubreEPlayImage-1').on('click', function (e) {
            e.preventDefault();
            $exeDevice.loadImage(1, $('#descubreEURLImage-1').val());
        });

        $('#descubreEPlayImage-2').on('click', function (e) {
            e.preventDefault();
            $exeDevice.loadImage(2, $('#descubreEURLImage-2').val());
        });

        $('#descubreEPlayImage-3').on('click', function (e) {
            e.preventDefault();
            $exeDevice.loadImage(3, $('#descubreEURLImage-3').val());
        });

        $('#descubreEURLAudio-0').on('change', function () {
            $exeDevice.loadAudio($(this).val());
        });

        $('#descubreEURLAudio-1').on('change', function () {
            $exeDevice.loadAudio($(this).val());
        });

        $('#descubreEURLAudio-2').on('change', function () {
            $exeDevice.loadAudio($(this).val());
        });
        $('#descubreEURLAudio-3').on('change', function () {
            $exeDevice.loadAudio($(this).val());
        });

        $('#descubreEPlayAudio-0').on('click', function (e) {
            e.preventDefault();
            $exeDevice.loadAudio($('#descubreEURLAudio-0').val());
        });

        $('#descubreEPlayAudio-1').on('click', function (e) {
            e.preventDefault();
            $exeDevice.loadAudio($('#descubreEURLAudio-1').val());
        });

        $('#descubreEPlayAudio-2').on('click', function (e) {
            e.preventDefault();
            $exeDevice.loadAudio($('#descubreEURLAudio-2').val());
        });
        $('#descubreEPlayAudio-3').on('click', function (e) {
            e.preventDefault();
            $exeDevice.loadAudio($('#descubreEURLAudio-3').val());
        });

        $('#descubreEText-0').on('keyup', function () {
            $('#descubreETextDiv-0').text($(this).val());
        });

        $('#descubreEText-1').on('keyup', function () {
            $('#descubreETextDiv-1').text($(this).val());
        });
        $('#descubreEText-2').on('keyup', function () {
            $('#descubreETextDiv-2').text($(this).val());
        });

        $('#descubreEText-3').on('keyup', function () {
            $('#descubreETextDiv-3').text($(this).val());
        });

        $('#descubreEBackColor-0').on('change', function () {
            $('#descubreETextDiv-0').css(
                'background-color',
                $exeDevice.hexToRgba($(this).val())
            );
        });

        $('#descubreEBackColor-1').on('change', function () {
            $('#descubreETextDiv-1').css(
                'background-color',
                $exeDevice.hexToRgba($(this).val())
            );
        });
        $('#descubreEBackColor-2').on('change', function () {
            $('#descubreETextDiv-2').css(
                'background-color',
                $exeDevice.hexToRgba($(this).val())
            );
        });

        $('#descubreEBackColor-3').on('change', function () {
            $('#descubreETextDiv-3').css(
                'background-color',
                $exeDevice.hexToRgba($(this).val())
            );
        });

        $('#descubreEColor-0').on('change', function () {
            $('#descubreETextDiv-0').css('color', $(this).val());
        });

        $('#descubreEColor-1').on('change', function () {
            $('#descubreETextDiv-1').css('color', $(this).val());
        });

        $('#descubreEColor-2').on('change', function () {
            $('#descubreETextDiv-2').css('color', $(this).val());
        });

        $('#descubreEColor-3').on('change', function () {
            $('#descubreETextDiv-3').css('color', $(this).val());
        });

        $('#descubreEImage-0').on('click', function (e) {
            $exeDevice.clickImage(this, e.pageX, e.pageY, 0);
        });

        $('#descubreEImage-1').on('click', function (e) {
            $exeDevice.clickImage(this, e.pageX, e.pageY, 1);
        });

        $('#descubreEImage-2').on('click', function (e) {
            $exeDevice.clickImage(this, e.pageX, e.pageY, 2);
        });

        $('#descubreEImage-3').on('click', function (e) {
            $exeDevice.clickImage(this, e.pageX, e.pageY, 3);
        });

        $('#descubreECursor-0').on('click', function () {
            $(this).hide();
            $('#descubreEXImage-0').val(0);
            $('#descubreEYImage-0').val(0);
        });

        $('#descubreECursor-1').on('click', function () {
            $(this).hide();
            $('#descubreEXImage-1').val(0);
            $('#descubreEYImage-1').val(0);
        });

        $('#descubreECursor-2').on('click', function () {
            $(this).hide();
            $('#descubreEXImage-2').val(0);
            $('#descubreEYImage-2').val(0);
        });

        $('#descubreECursor-3').on('click', function () {
            $(this).hide();
            $('#descubreEXImage-3').val(0);
            $('#descubreEYImage-3').val(0);
        });

        $('#descubreShowAlt-0').on('click', function (e) {
            e.preventDefault();
            $('#descubreEAuthorAlt-0').slideToggle();
        });

        $('#descubreShowAlt-1').on('click', function (e) {
            e.preventDefault();
            $('#descubreEAuthorAlt-1').slideToggle();
        });

        $('#descubreShowAlt-2').on('click', function (e) {
            e.preventDefault();
            $('#descubreEAuthorAlt-2').slideToggle();
        });

        $('#descubreShowAlt-3').on('click', function (e) {
            e.preventDefault();
            $('#descubreEAuthorAlt-3').slideToggle();
        });

        $('#descubreEEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#descubreEEvaluationID').prop('disabled', !marcado);
        });

        $('#descubreEEvaluationHelpLnk').click(function () {
            $('#descubreEEvaluationHelp').toggle();
            return false;
        });

        $('#descubreEURLImgCard').on('change', () =>
            $exeDevice.loadImageCard()
        );

        $('#descubreEPlayCard').on('click', (e) => {
            e.preventDefault();
            $exeDevice.loadImageCard();
        });

        $exeDevicesEdition.iDevice.gamification.share.addEvents(
            0,
            $exeDevice.insertCards
        );

        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();
        //eX3 3.0 Dismissible messages
        $('.exe-block-dismissible .exe-block-close').click(function () {
            $(this).parent().fadeOut();
            return false;
        });
    },

    importText: function (content) {
        const lines = content.split('\n');
        $exeDevice.insertCards(lines);
    },

    insertCards: function (lines) {
        const lineFormat = /^([^#]+)#([^#]+)(#([^#]+))?(#([^#]+))?$/,
            questions = [],
            types = [0, 0, 0];

        lines.forEach(function (line) {
            if (lineFormat.test(line)) {
                const q = $exeDevice.getQuestionDefault();
                let linarray = line.trim().split('#'),
                    typeGame = linarray.length - 2;
                types[typeGame]++;
                for (let i = 0; i < q.data.length; i++) {
                    if (i < linarray.length) {
                        q.data[i].eText = linarray[i];
                    }
                }
                questions.push(q);
            }
        });
        let gameMode = 2;
        if (types[0] > 0) {
            gameMode = 0;
        } else if (types[1] > 0) {
            gameMode = 1;
        }

        if (types[gameMode] > 0) {
            $("input[name='qtxgamemode'][value='" + gameMode + "']").prop(
                'checked',
                true
            );
            $('#descubreEDatosCarta-2').hide();
            $('#descubreEDatosCarta-3').hide();
            if (gameMode == 1) {
                $('#descubreEDatosCarta-2').show();
            } else if (gameMode == 2) {
                $('#descubreEDatosCarta-2').show();
                $('#descubreEDatosCarta-3').show();
            }
            $exeDevice.addCards(questions);
        }
    },

    importMoodle(xmlString) {
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

    importCuestionaryXML(xmlText) {
        const parser = new DOMParser(),
            xmlDoc = parser.parseFromString(xmlText, 'text/xml'),
            $xml = $(xmlDoc),
            $quiz = $xml.find('quiz').first();

        if ($xml.find('parsererror').length > 0 || $quiz.length === 0)
            return false;

        const cardsJson = $quiz
            .find('question')
            .map((_, question) => {
                const $question = $(question);
                if ($question.attr('type') !== 'shortanswer') return null;

                let eText = '',
                    maxFraction = -1;
                $question.find('answer').each((_, answer) => {
                    const $answer = $(answer),
                        answerText = $answer.find('text').eq(0).text(),
                        currentFraction = parseInt($answer.attr('fraction'));

                    if (currentFraction > maxFraction) {
                        maxFraction = currentFraction;
                        eText = answerText;
                    }
                });
                const bktext = {
                    eTextBk: $exeDevice.removeTags(
                        $question.find('questiontext').first().text().trim()
                    ),
                    eText: $exeDevice.removeTags(eText),
                };
                return eText ? bktext : null;
            })
            .get();
        $exeDevice.insertCards(cardsJson);
    },

    importGlosary(xmlText) {
        const parser = new DOMParser(),
            xmlDoc = parser.parseFromString(xmlText, 'text/xml'),
            $xml = $(xmlDoc),
            $entries = $xml.find('ENTRIES').first();

        if ($xml.find('parsererror').length > 0 || $entries.length === 0)
            return false;

        const cardsJson = $entries
            .find('ENTRY')
            .map((_, entry) => {
                const concept = $(entry).find('CONCEPT').text(),
                    definition = $(entry)
                        .find('DEFINITION')
                        .text()
                        .replace(/<[^>]*>/g, '');
                return concept && definition
                    ? { eText: concept, eTextBk: definition }
                    : null;
            })
            .get();
        $exeDevice.insertCards(cardsJson);
    },

    addCards: function (cards) {
        if (!cards || cards.length == 0) {
            eXe.app.alert(
                _('Sorry, there are no questions for this type of activity.')
            );
            return;
        }
        $exeDevice.wordsGame = cards;
        $exeDevice.active = 0;
        $exeDevice.showQuestion($exeDevice.active);
        $exeDevice.deleteEmptyQuestion();
        $exeDevice.updateQuestionsNumber();
        //$('.exe-form-tabs li:first-child a').click();
    },

    loadImageCard: function () {
        const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
            url = $('#descubreEURLImgCard').val(),
            ext = url.split('.').pop().toLowerCase();

        if (url.indexOf('files') == 0 && validExt.indexOf(ext) == -1) {
            $exeDevice.showMessage(
                _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
            );
            return false;
        }
        $exeDevice.showImageCard(url);
    },

    showImageCard: function (url) {
        $image = $('#descubreECard');
        $nimage = $('#descubreENoCard');
        $image.hide();
        $nimage.show();
        if (!url.length) return;
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
                    $image.show();
                    $nimage.hide();
                    return true;
                }
            })
            .on('error', function () {
                return false;
            });
    },

    loadImage: function (number, url) {
        const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
            selectedFile = url,
            ext = selectedFile.split('.').pop().toLowerCase(),
            alt = $('#descubreEAlt-' + number).val(),
            x = parseFloat($('#descubreEXImage-' + number).val()),
            y = parseFloat($('#descubreEYImage-' + number).val());

        if (selectedFile.indexOf('files') == 0 && validExt.indexOf(ext) == -1) {
            $exeDevice.showMessage(
                _('Supported formats') + ': jpg, jpeg, gif, png, svg webp'
            );
            return false;
        }

        $('#descubreEImage-' + number).hide();
        $('#descubreEImage-' + number).attr('alt', 'No image');
        $('#descubreECursor-' + number).hide();
        $('#descubreENoImage-' + number).show();
        if (url.length > 0) {
            $exeDevice.showImage(url, x, y, alt, number);
        }
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

    showSelectOrder: function (messages) {
        if (messages) {
            $('.Descubre-EOrders').slideDown();
        } else {
            $('.Descubre-EOrders').slideUp();
        }
    },

    updateGameMode: function (feedback) {
        $('#descubreEHasFeedBack').prop('checked', feedback);
        if (feedback) {
            $('#descubreEFeedbackP').slideDown();
        }
        if (!feedback) {
            $('#descubreEFeedbackP').slideUp();
        }
    },

    clearQuestion: function () {
        for (let i = 0; i < $exeDevice.NUMMAXCARD; i++) {
            $('.Descubre-Type-' + i)[0].checked = true;
            $('#descubreEURLImage-' + i).val('');
            $('#descubreEXImage-' + i).val('0');
            $('#descubreEYImage-' + i).val('0');
            $('#descubreEAuthor-' + i).val('');
            $('#descubreEAlt-' + i).val('');
            $('#descubreEText-' + i).val('');
            $('#descubreETextDiv-' + i).text('');
            $('#descubreEURLAudio-' + i).val('');
            $('#descubreEColor-' + i).val('#000000');
            $('#descubreEBackColor-' + i).val('#ffffff');
            $('#descubreETextDiv-' + i).css({
                color: '#000000',
                'background-color': $exeDevice.hexToRgba('#ffffff'),
            });

            $exeDevice.showImage('', 0, 0, _('No image'), i);
        }
        $exeDevice.stopSound();
    },

    addQuestion: function () {
        if ($exeDevice.wordsGame.length >= 20) {
            $exeDevice.showMessage($exeDevice.msgs.msgPairsMax);
            return;
        }

        const valida = $exeDevice.validateQuestion();
        if (valida) {
            $exeDevice.clearQuestion();
            $exeDevice.wordsGame.push($exeDevice.getQuestionDefault());
            $exeDevice.active = $exeDevice.wordsGame.length - 1;
            $('#descubreENumberQuestion').text($exeDevice.wordsGame.length);
            $exeDevice.typeEdit = -1;
            $('#descubreEPaste').hide();
            $('#descubreENumQuestions').text($exeDevice.wordsGame.length);
            $exeDevice.updateQuestionsNumber();
        }
    },

    removeQuestion: function () {
        if ($exeDevice.wordsGame.length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
        } else {
            $exeDevice.wordsGame.splice($exeDevice.active, 1);
            if ($exeDevice.active >= $exeDevice.wordsGame.length - 1) {
                $exeDevice.active = $exeDevice.wordsGame.length - 1;
            }
            $exeDevice.showQuestion($exeDevice.active);
            $exeDevice.typeEdit = -1;
            $('#descubreEPaste').hide();
            $('#descubreENumQuestions').text($exeDevice.wordsGame.length);
            $('#descubreENumberQuestion').text($exeDevice.active + 1);
            $exeDevice.updateQuestionsNumber();
        }
    },
    copyQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.typeEdit = 0;
            $exeDevice.clipBoard = JSON.parse(
                JSON.stringify($exeDevice.wordsGame[$exeDevice.active])
            );
            $('#descubreEPaste').show();
        }
    },

    cutQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.numberCutCuestion = $exeDevice.active;
            $exeDevice.typeEdit = 1;
            $('#descubreEPaste').show();
        }
    },

    pasteQuestion: function () {
        if ($exeDevice.wordsGame.length >= 20) {
            $exeDevice.showMessage($exeDevice.msgs.msgPairsMax);
            return;
        }

        if ($exeDevice.typeEdit == 0) {
            $exeDevice.active++;
            const p = $.extend(true, {}, $exeDevice.clipBoard);
            $exeDevice.wordsGame.splice($exeDevice.active, 0, p);
            $exeDevice.showQuestion($exeDevice.active);
            $('#descubreENumQuestions').text($exeDevice.wordsGame.length);
        } else if ($exeDevice.typeEdit == 1) {
            $('#descubreEPaste').hide();
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                $exeDevice.wordsGame,
                $exeDevice.numberCutCuestion,
                $exeDevice.active
            );
            $exeDevice.showQuestion($exeDevice.active);
            $('#descubreENumQuestions').text($exeDevice.wordsGame.length);
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
        game.percentajeFB =
            typeof game.percentajeFB != 'undefined' ? game.percentajeFB : 100;
        game.feedBack =
            typeof game.feedBack != 'undefined' ? game.feedBack : false;
        game.customMessages =
            typeof game.customMessages == 'undefined'
                ? false
                : game.customMessages;
        game.timeShowSolution =
            typeof game.timeShowSolution == 'undefined'
                ? 3
                : game.timeShowSolution;
        game.showSolution =
            typeof game.showSolution == 'undefined' ? true : game.showSolution;
        game.gameMode = typeof game.gameMode == 'undefined' ? 0 : game.gameMode;
        game.gameLevels =
            typeof game.gameLevels == 'undefined' ? 1 : game.gameLevels;
        game.showCards =
            typeof game.showCards == 'undefined' ? false : game.showCards;
        game.percentajeQuestions =
            typeof game.percentajeQuestions == 'undefined'
                ? 100
                : game.percentajeQuestions;
        game.evaluation =
            typeof game.evaluation != 'undefined' ? game.evaluation : false;
        game.evaluationID =
            typeof game.evaluationID != 'undefined' ? game.evaluationID : '';
        game.weighted =
            typeof game.weighted !== 'undefined' ? game.weighted : 100;
        $exeDevice.id = $exeDevice.getIdeviceID();

        $('#descubreEShowMinimize').prop('checked', game.showMinimize);
        $('#descubreECaseSensitive').prop('checked', game.caseSensitive);
        $('#descubreEHasFeedBack').prop('checked', game.feedBack);
        $('#descubreEPercentajeFB').val(game.percentajeFB);
        $('#descubreECustomMessages').prop('checked', game.customMessages);
        $('#descubreEShowCards').prop('checked', game.showCards);
        $('#descubreEPercentajeQuestions').val(game.percentajeQuestions);
        $('#descubreETime').val(game.time);
        $('#descubreEAttempts').val(game.attempts);
        $('#descubreETimeShowSolution').val(game.timeShowSolution);
        $('#descubreEAuthor').val(game.author);
        $('#descubreETimeShowSolution').prop('disabled', game.showCards);
        $('#descubreEShowSolution').prop('checked', game.showSolution);
        $("input[name='qtxgamemode'][value='" + game.gameMode + "']").prop(
            'checked',
            true
        );
        $("input[name='qtxgamelevels'][value='" + game.gameLevels + "']").prop(
            'checked',
            true
        );

        if (game.gameMode == 1) {
            $('#descubreEDatosCarta-2').show();
        } else if (game.gameMode == 2) {
            $('#descubreEDatosCarta-2').show();
            $('#descubreEDatosCarta-3').show();
        }
        $('#descubreEEvaluation').prop('checked', game.evaluation);
        $('#descubreEEvaluationID').val(game.evaluationID);
        $('#descubreEEvaluationID').prop('disabled', !game.evaluation);

        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted
        );
        $('#descubreEURLImgCard').val(game.imgCard);

        $exeDevice.showImageCard(game.imgCard);

        $exeDevice.showSelectOrder(game.customMessages);

        $exeDevice.wordsGame = game.wordsGame;

        $exeDevice.updateGameMode(game.feedBack);

        $('#descubreENumQuestions').text($exeDevice.wordsGame.length);
        $('#descubreEPercentajeFB').prop('disabled', !game.feedBack);

        $exeDevice.updateQuestionsNumber();
    },

    exportGame: function () {
        const dataGame = this.validateData();

        if (!dataGame) return false;

        const blob = JSON.stringify(dataGame),
            newBlob = new Blob([blob], {
                type: 'text/plain',
            });
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveOrOpenBlob(newBlob);
            return;
        }

        const data = window.URL.createObjectURL(newBlob);

        let link = document.createElement('a');
        link.href = data;
        link.download = _('Activity') + '-Descubre.json';
        document.getElementById('descubreQEIdeviceForm').appendChild(link);
        link.click();

        setTimeout(function () {
            document.getElementById('descubreQEIdeviceForm').removeChild(link);
            window.URL.revokeObjectURL(data);
        }, 100);
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
        link.download = `${_('words')}-crucigrama.txt`;

        document.getElementById('ccgmQEIdeviceForm').appendChild(link);
        link.click();
        setTimeout(() => {
            document.getElementById('ccgmQEIdeviceForm').removeChild(link);
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

    importText: function (content) {
        const lines = content.split('\n'),
            lineFormat = /^([^#]+)#([^#]+)(#([^#]+))?(#([^#]+))?$/,
            questions = [];
        types = [0, 0, 0];
        lines.forEach(function (line) {
            if (lineFormat.test(line)) {
                const q = $exeDevice.getQuestionDefault();
                let linarray = line.trim().split('#'),
                    typeGame = linarray.length - 2;
                types[typeGame]++;
                for (let i = 0; i < q.data.length; i++) {
                    if (i < linarray.length) {
                        q.data[i].eText = linarray[i];
                    }
                }
                questions.push(q);
            }
        });
        let gameMode = 2;
        if (types[0] > 0) {
            gameMode = 0;
        } else if (types[1] > 0) {
            gameMode = 1;
        }

        if (types[gameMode] > 0) {
            $("input[name='qtxgamemode'][value='" + gameMode + "']").prop(
                'checked',
                true
            );
            $('#descubreEDatosCarta-2').hide();
            $('#descubreEDatosCarta-3').hide();
            if (gameMode == 1) {
                $('#descubreEDatosCarta-2').show();
            } else if (gameMode == 2) {
                $('#descubreEDatosCarta-2').show();
                $('#descubreEDatosCarta-3').show();
            }
            return questions;
        } else {
            return false;
        }
    },

    importGame(content, filetype) {
        const game =
            $exeDevices.iDevice.gamification.helpers.isJsonString(content);

        if (content && content.includes('\u0000')) {
            $exeDevice.showMessage(_('Sorry, wrong file format'));
        } else if (!game && content) {
            if (filetype.match('text/plain')) {
                $exeDevice.importText(content);
            } else if (
                filetype.match('application/xml') ||
                filetype.match('text/xml')
            ) {
                $exeDevice.importMoodle(content);
            }
        } else {
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
        }
    },
    deleteEmptyQuestion: function () {
        const url = $('#descubreEURLImage-0').val().trim(),
            audio = $('#descubreEURLAudio-0').val().trim(),
            eText = $('#descubreEText-0').val().trim();
        if ($exeDevice.wordsGame && $exeDevice.wordsGame.length > 1) {
            if (
                url.length < 3 &&
                audio.length < 3 &&
                eText.trim().length == 0
            ) {
                $exeDevice.removeQuestion();
            }
        }
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
    clickImage: function (img, epx, epy, type) {
        let $cursor = $('#descubreECursor-0'),
            $x = $('#descubreEXImage-0'),
            $y = $('#descubreEYImage-0'),
            $img = $(img);

        if (type == 1) {
            $cursor = $('#descubreECursor-1');
            $x = $('#descubreEXImage-1');
            $y = $('#descubreEYImage-1');
        } else if (type == 2) {
            $cursor = $('#descubreECursor-2');
            $x = $('#descubreEXImage-2');
            $y = $('#descubreEYImage-2');
        } else if (type == 3) {
            $cursor = $('#descubreECursor-3');
            $x = $('#descubreEXImage-3');
            $y = $('#descubreEYImage-3');
        }

        const posX = epx - $img.offset().left,
            posY = epy - $img.offset().top,
            wI = $img.width() > 0 ? $img.width() : 1,
            hI = $img.height() > 0 ? $img.height() : 1,
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
        const wrapper = $('<div></div>');
        wrapper.html(str);
        return wrapper.text();
    },
};
