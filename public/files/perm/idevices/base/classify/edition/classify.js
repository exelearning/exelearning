/* eslint-disable no-undef */
/**
/**
 * Clasifica Activity iDevice (edition code)
 * Version: 0.8
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narvaez Martinez
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    i18n: {
        category: _('Interactive activities'),
        name: _('Classify'),
    },
    msgs: {},
    classIdevice: 'classify',
    active: 0,
    wordsGame: [],
    groups: [
        _('Group') + ' ' + 1,
        _('Group') + ' ' + 2,
        _('Group') + ' ' + 3,
        _('Group') + ' ' + 4,
    ],
    numberGroups: 2,
    typeEdit: -1,
    numberCutCuestion: -1,
    clipBoard: '',
    idevicePath: '',
    playerAudio: '',
    isVideoType: false,
    numberCards: 3,
    version: 0.8,
    id: false,
    checkAltImage: true,
    ci18n: {},

    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.refreshTranslations();
        this.ci18n.msgTryAgain = this.ci18n.msgTryAgain.replace(
            '&percnt;',
            '%'
        ); // Avoid invalid HTML
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
            msgYes: c_('Yes'),
            msgNo: c_('No'),
            msgTimeOver: c_('Time is up. Please try again'),
            mgsGameStart: c_(
                'The game has started! Drag each card to its container'
            ),
            msgSelectCard: c_('Choose another card'),
            msgSelectCardOne: c_('Choose a card'),
            msgReboot: c_('Restart'),
            msgTestPassed: c_("Brilliant! You've passed yout test!"),
            msgTestFailed: c_("You didn't pass the test. Please try again"),
            msgRebootGame: c_('Do you want to restart this game?'),
            msgContinue: c_('Continue'),
            msgShowAnswers: c_('Check results'),
            msgUnansweredQuestions: c_(
                'There were %s cards to be placed correctly. Do you want to try again?'
            ),
            msgAllCorrect: c_('Brilliant! All perfect!'),
            msgTooManyTries: c_(
                'Great job! You have solved this activity in %s attempts. Surely you can do it faster!'
            ),
            msgQ5: c_(
                'You placed %s cards in the wrong place. Please try again!'
            ),
            msgQ7: c_(
                'Great job! You have correctly classified most cards, %s, but you can do even better'
            ),
            msgQ9: c_(
                'Great job! Only %s cards left to be placed correctly. Strive for perfection!'
            ),
            msgSaveGameAuto: c_(
                'Your score will be automatically saved at the end of the game.'
            ),
            msgOnlySaveGameAuto: c_(
                'Your score will be automatically saved at the end of the game. You can only play once.'
            ),
            msgEndGamerScore: c_(
                'You can only save your score after finishing the game.'
            ),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgTypeGame: c_('Classify'),
        };
    },

    setMessagesInfo: function () {
        const msgs = this.msgs;
        msgs.msgESelectFile = _(
            'The selected file does not contain a valid game'
        );
        msgs.msgEOneQuestion = _('Please provide at least one question');
        msgs.msgProvideFB = _('Message to display when passing the game');
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.'
        );
        msgs.msgCompleteData = _(
            'You must indicate an image, a text or/and an audio for each card'
        );
        msgs.msgPairsMax = _('Maximum cards to classify: 25');
        msgs.msgCompleteBoth = _(
            'You must select an image and text for this card'
        );
        msgs.msgCompleteText = _(
            'You must indicate a text or sound for this card'
        );
        msgs.msgCompleteImage = _(
            'You must link an image or sound to this card'
        );
        msgs.msgIDLenght = _(
            'The report identifier must have at least 5 characters'
        );
        msgs.msgTitleAltImageWarning = _('Accessibility warning');
        msgs.msgAltImageWarning = _(
            'At least one image has no description, are you sure you want to continue without including it? Without it the image may not be accessible to some users with disabilities, or to those using a text browser, or browsing the Web with images turned off.'
        );
    },

    createForm: function () {
        const path = this.idevicePath,
            html = `
        <div id="clasificaQEIdeviceForm">
            <p class="exe-block-info exe-block-dismissible" style="position:relative">
                ${_('Create interactive activities in which players have to classify cards with images, texts and/or sounds.')}
                <a href="https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe29/clasifica.html" hreflang="es" target="_blank">${_('Usage Instructions')}</a>
                <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
            </p>
            <div class="exe-form-tab" title="${_('General settings')}">
                ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Drag each card to its container.'))}
                <fieldset class="exe-fieldset exe-fieldset-closed">
                    <legend><a href="#">${_('Options')}</a></legend>
                    <div>
                        <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                            <span>${_('Difficulty level')}:</span>
                            <div class="form-check form-check-inline m-0">
                                <input class="form-check-input CQE-ELevel" id="clasificaL1" type="radio" name="qtxgamelevel" value="0" />
                                <label class="form-check-label" for="clasificaL1">${_('Essential')}</label>
                            </div>
                            <div class="form-check form-check-inline m-0">
                                <input class="form-check-input CQE-ELevel" id="clasificaL2" type="radio" name="qtxgamelevel" value="1" />
                                <label class="form-check-label" for="clasificaL2">${_('Medium')}</label>
                            </div>
                            <div class="form-check form-check-inline m-0">
                                <input class="form-check-input CQE-ELevel" id="clasificaL3" type="radio" name="qtxgamelevel" value="2" checked />
                                <label class="form-check-label" for="clasificaL3">${_('Advanced')}</label>
                            </div>
                        </div>
                        <div id="clasificaECustomMessagesDiv" class="mb-3">
                            <span class="toggle-item" role="switch" aria-checked="false">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="clasificaECustomMessages" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="clasificaECustomMessages">${_('Custom messages')}.</label>
                            </span>
                        </div>
                        <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                            <span>${_('Number of categories')}:</span>
                            <div id="quextNumber2Div" class="form-check form-check-inline m-0">
                                <input class="form-check-input CQE-Number" id="quextNumber2" type="radio" name="qxtnumber" value="2" checked="checked" />
                                <label class="form-check-label" for="quextNumber2">2</label>
                            </div>
                            <div id="quextNumber3Div" class="form-check form-check-inline m-0">
                                <input class="form-check-input CQE-Number" id="quextNumber3" type="radio" name="qxtnumber" value="3" />
                                <label class="form-check-label" for="quextNumber3">3</label>
                            </div>
                            <div id="quextNumber4Div" class="form-check form-check-inline m-0">
                                <input class="form-check-input CQE-Number" id="quextNumber4" type="radio" name="qxtnumber" value="4" />
                                <label class="form-check-label" for="quextNumber4">4</label>
                            </div>
                        </div>
                        <div class="mb-3 align-items-center gap-2 flex-wrap">
                            <label for="clasificaTitle0" class="mb-0">${_('Category')} 1:</label>
                            <input type="text" id="clasificaTitle0" class="CQE-EGroup form-control" value="${_('Group')} 1"/>
                        </div>
                        <div class="mb-3  align-items-center gap-2 flex-wrap">
                            <label for="clasificaTitle1" class="mb-0">${_('Category')} 2:</label>
                            <input type="text" id="clasificaTitle1" class="CQE-EGroup form-control" value="${_('Group')} 2"/>
                        </div>
                        <div class="mb-3  align-items-center gap-2 flex-wrap">
                            <label for="clasificaTitle2" class="mb-0">${_('Category')} 3:</label>
                            <input type="text" id="clasificaTitle2" class="CQE-EGroup form-control" value="${_('Group')} 3"/>
                        </div>
                        <div class="mb-3  align-items-center gap-2 flex-wrap">
                            <label for="clasificaTitle3" class="mb-0">${_('Category')} 4:</label>
                            <input type="text" id="clasificaTitle3" class="CQE-EGroup form-control" value="${_('Group')} 4"/>
                        </div>
                        <div class="mb-3">
                            <span class="toggle-item" role="switch" aria-checked="false">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="clasificaEShowMinimize" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="clasificaEShowMinimize">${_('Show minimized.')}</label>
                            </span>
                        </div>
                        <div class="d-flex align-items-center gap-2 mb-3 flex-wrap">
                            <label for="clasificaETime" class="mb-0">${_('Time (minutes)')}</label>
                            <input type="number" name="clasificaETime" id="clasificaETime" value="0" min="0" max="120" step="1" class="form-control" style="width:6ch" />
                        </div>
                        <div class="d-flex align-items-center gap-2 mb-3 flex-nowrap">
                            <span class="toggle-item" role="switch" aria-checked="false">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="clasificaEHasFeedBack" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="clasificaEHasFeedBack">${_('Feedback')}.</label>
                            </span>                              
                            <label for="clasificaEPercentajeFB" class="mb-0">${_('Percent')}</label>
                            <input type="number" name="clasificaEPercentajeFB" id="clasificaEPercentajeFB" value="100" min="5" max="100" step="5" disabled class="form-control" style="width:6ch" />
                            <span>${_('&percnt; right to see the feedback')}</span>
                        </div>
                        <p id="clasificaEFeedbackP" class="CQE-EFeedbackP">
                            <textarea id="clasificaEFeedBackEditor" class="exe-html-editor form-control" rows="4"></textarea>
                        </p>
                        <div class="d-flex align-items-center gap-2 mb-3 flex-wrap">
                            <label for="clasificaEPercentajeQuestions" class="mb-0">%${_('Questions')}</label>
                            <input type="number" name="clasificaEPercentajeQuestions" id="clasificaEPercentajeQuestions" value="100" min="1" max="100" class="form-control" style="width:6ch" />
                            <span id="clasificaENumeroPercentaje">1/1</span>
                        </div>
                       <div class="d-none align-items-center gap-2 mb-3 flex-wrap">
                            <label for="clasificaEAuthor" class="mb-0">${_('Authorship')}:</label>
                            <input id="clasificaEAuthor" type="text" class="form-control" />
                        </div>                       
                        <div id="clasificaEBackDiv">
                            <div class="CQE-EInputImageBack d-flex align-items-center gap-2 mb-3">
                                <label for="clasificaEURLImgCard" class="mb-0">${_('Image back')}: </label>
                                <input type="text" class="exe-file-picker CQE-EURLImage form-control me-0" id="clasificaEURLImgCard"/>
                                <a href="#" id="clasificaEPlayCard" class="clasificaE-ENavigationButton clasificaEEPlayVideo" title="${_('Show')}">
                                     <img src="${path}quextIEPlay.png" alt="${_('Show')}" class="CQE-EButtonImage " />
                                </a>
                            </div>
                            <div id="clasificaEbackground" class="CQE-Back mb-3">
                                <img class="CQE-EImageBack" src="" id="clasificaECard" alt="${_('Image')}" style="display:none" />
                                <img class="CQE-EImageBack" src="${path}clsfHome.png" id="clasificaENoCard" alt="${_('No image')}" />
                            </div>
                        </div>
                        <div class="Games-Reportdiv d-flex align-items-center gap-2 mb-3 flex-wrap">
                            <span class="toggle-item mb-0" data-target="clasificaEEvaluationIDWrapper" role="switch" aria-checked="false">
                                <span class="toggle-control">
                                    <input type="checkbox" id="clasificaEEvaluation" class="toggle-input">
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="clasificaEEvaluation">${_('Progress report')}.</label>
                            </span>
                            <span id="clasificaEEvaluationIDWrapper" class="d-inline-flex align-items-center gap-1">
                                <label for="clasificaEEvaluationID" class="mb-0">${_('Identifier')}:</label>
                                <input type="text" id="clasificaEEvaluationID" disabled class="form-control" value="${eXeLearning.app.project.odeId || ''}" />
                            </span>
                            <strong class="GameModeLabel">
                                <a href="#clasificaEEvaluationHelp" id="clasificaEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                    <img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}" />
                                </a>
                            </strong>
                        </div>
                        <p id="clasificaEEvaluationHelp" class="CQE-TypeGameHelp exe-block-info">
                            ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                        </p>
                    </div>
                </fieldset>
                <fieldset class="exe-fieldset">
                    <legend><a href="#">${_('Cards')}</a></legend>
                    <div class="CQE-EPanel">
                        <div class="CQE-Data">
                            ${$exeDevice.createCards(1)}
                            <div class="CQE-EOrders CQE-Hide" id="clasificaEOrder">
                                <div class="CQE-ECustomMessage">
                                    <span class="sr-av">${_('Hit')}</span><span class="CQE-EHit"></span>
                                    <label for="clasificaEMessageOK">${_('Message')}</label>
                                    <input type="text" id="clasificaEMessageOK" class="form-control" />
                                </div>
                                <div class="CQE-ECustomMessage">
                                    <span class="sr-av">${_('Error')}</span><span class="CQE-EError"></span>
                                    <label for="clasificaEMessageKO">${_('Message')}</label>
                                    <input type="text" id="clasificaEMessageKO" class="form-control" />
                                </div>
                            </div>
                            <div class="CQE-ENumQuestionDiv" id="clasificaENumQuestionDiv">
                                <div class="CQE-ENumQ"><span class="sr-av">${_('Question')}</span></div>
                                <span class="CQE-ENumQuestions" id="clasificaENumQuestions">0</span>
                            </div>
                        </div>
                        <div class="CQE-EContents">
                            <div class="CQE-ENavigationButtons gap-2">
                                <a href="#" id="clasificaEAdd" class="CQE-ENavigationButton" title="${_('Add question')}"><img src="${path}quextIEAdd.png" alt="${_('Add question')}" class="CQE-EButtonImage b-add" /></a>
                                <a href="#" id="clasificaEFirst" class="CQE-ENavigationButton" title="${_('First question')}"><img src="${path}quextIEFirst.png" alt="${_('First question')}" class="CQE-EButtonImage b-first" /></a>
                                <a href="#" id="clasificaEPrevious" class="CQE-ENavigationButton" title="${_('Previous question')}"><img src="${path}quextIEPrev.png" alt="${_('Previous question')}" class="CQE-EButtonImage b-prev" /></a>
                                <label class="sr-av" for="clasificaENumberQuestion">${_('Question number:')}</label><input type="text" class="CQE-NumberQuestion form-control" id="clasificaENumberQuestion" value="1"/>
                                <a href="#" id="clasificaENext" class="CQE-ENavigationButton" title="${_('Next question')}"><img src="${path}quextIENext.png" alt="${_('Next question')}" class="CQE-EButtonImage b-next" /></a>
                                <a href="#" id="clasificaELast" class="CQE-ENavigationButton" title="${_('Last question')}"><img src="${path}quextIELast.png" alt="${_('Last question')}" class="CQE-EButtonImage b-last" /></a>
                                <a href="#" id="clasificaEDelete" class="CQE-ENavigationButton" title="${_('Delete question')}"><img src="${path}quextIEDelete.png" alt="${_('Delete question')}" class="CQE-EButtonImage b-delete" /></a>
                                <a href="#" id="clasificaECopy" class="CQE-ENavigationButton" title="${_('Copy question')}"><img src="${path}quextIECopy.png" alt="${_('Copy question')}" class="CQE-EButtonImage b-copy" /></a>
                                <a href="#" id="clasificaECut" class="CQE-ENavigationButton" title="${_('Cut question')}"><img src="${path}quextIECut.png" alt="${_('Cut question')}" class="CQE-EButtonImage b-cut" /></a>
                                <a href="#" id="clasificaEPaste" class="CQE-ENavigationButton" title="${_('Paste question')}"><img src="${path}quextIEPaste.png" alt="${_('Paste question')}" class="CQE-EButtonImage b-paste" /></a>
                            </div>
                        </div>
                    </div>
                </fieldset>
                ${$exeDevicesEdition.iDevice.common.getTextFieldset('after')}
                </div>
            ${$exeDevicesEdition.iDevice.gamification.itinerary.getTab()}
            ${$exeDevicesEdition.iDevice.gamification.scorm.getTab()}
            ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
            ${$exeDevicesEdition.iDevice.gamification.share.getTab(true, 5)}
            ${$exeDevicesEdition.iDevice.gamification.share.getTabIA(5)}
        </div>
    `;
        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('clasificaQEIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();
        this.enableForm();
    },

    createCards: function (num) {
        let cards = '';
        const path = $exeDevice.idevicePath;
        for (let i = 0; i < num; i++) {
            let card = `
        <div class="CQE-DatosCarta" id="clasificaEDatosCarta">
           <p class="CQE-ECardHeader">
               <span class="d-inline-flex align-items-center gap-2 flex-wrap">
                  <span>${_('Type')}:</span>
                  <span class="form-check form-check-inline m-0 d-inline-flex align-items-center">
                      <input class="CQE-Type form-check-input" checked id="clasificaEMediaImage" type="radio" name="qxtmediatype" value="0" />
                      <label class="form-check-label" for="clasificaEMediaImage">${_('Image')}</label>
                  </span>
                  <span class="form-check form-check-inline m-0 d-inline-flex align-items-center">
                      <input class="CQE-Type form-check-input" id="clasificaEMediaText" type="radio" name="qxtmediatype" value="1" />
                      <label class="form-check-label" for="clasificaEMediaText">${_('Text')}</label>
                  </span>
                  <span class="form-check form-check-inline m-0 d-inline-flex align-items-center">
                      <input class="CQE-Type form-check-input" id="clasificaEMediaBoth" type="radio" name="qxtmediatype" value="2" />
                      <label class="form-check-label" for="clasificaEMediaBoth">${_('Both')}</label>
                  </span>
                </span>
                <span class="d-inline-flex align-items-center gap-2 flex-wrap">
                    <label for="clasificaEGroupSelect" class="mb-0">${_('Group')}:</label>
                    <select id="clasificaEGroupSelect" class="form-select form-select-sm">
                        <option value="0">${_('Group')} 1</option>
                        <option value="1">${_('Group')} 2</option>
                        <option value="2">${_('Group')} 3</option>
                        <option value="3">${_('Group')} 4</option>
                    </select>
                </span>
           </p>
           <div class="CQE-EMultimedia" id="clasificaEMultimedia">
                <div class="CQE-Card">
                    <img class="CQE-Hide CQE-Image" src="${path}quextIEImage.png" id="clasificaEImage" alt="${_('No image')}" />
                    <img class="CQE-ECursor" src="${path}quextIECursor.gif" id="clasificaECursor" alt="" />
                    <img class="CQE-Hide CQE-Image" src="${path}quextIEImage.png" id="clasificaENoImage" alt="${_('No image')}" />
                    <div id="clasificaETextDiv" class="CQE-ETextDiv"></div>
                </div>
            </div>
           <span class="CQE-ETitleText" id="clasificaETitleText">${_('Text')}</span>
           <div class="CQE-EInputImage gap-2 mb-3" id="clasificaEInputText">
                <label for="clasificaEText" class="sr-av">${_('Text')}</label>
                <input id="clasificaEText" type="text" class="form-control me-0" />
                <label for="clasificaEColor" class="mb-0">${_('Color')}: </label>
                <input type="color" id="clasificaEColor" name="clasificaEColor" value="#000000" class="form-control form-control-color" />
                <label for="clasificaEBackColor" class="mb-0">${_('Background')}: </label>
                <input type="color" id="clasificaEBackColor" name="clasificaEBackColor" value="#ffffff" class="form-control form-control-color" />
            </div>
           <span class="CQE-ETitleImage" id="clasificaETitleImage">${_('Image')}</span>
           <div class="CQE-EInputImage mb-3 gap-2" id="clasificaEInputImage">
               <label class="sr-av" for="clasificaEURLImage">URL</label>
               <input type="text" class="exe-file-picker CQE-EURLImage form-control me-0" id="clasificaEURLImage"/>
               <a href="#" id="clasificaEPlayImage" class="CQE-ENavigationButton CQE-EPlayVideo" title="${_('Show')}"><img src="${path}quextIEPlay.png" alt="${_('Show')}" class="CQE-EButtonImage " /></a>
               <a href="#" id="clasificaShowAlt" class="CQE-ENavigationButton CQE-EPlayVideo" title="${_('More')}"><img src="${path}quextEIMore.png" alt="${_('More')}" class="CQE-EButtonImage " /></a>
           </div>
           <div class="CQE-ECoord d-none align-items-center flex-nowrap gap-2 mb-3">
                   <label for="clasificaEXImage" class="mb-0">X:</label>
                   <input id="clasificaEXImage" type="text" value="0" class="form-control" />
                   <label for="clasificaEYImage" class="mb-0">Y:</label>
                   <input id="clasificaEYImage" type="text" value="0" class="form-control" />
           </div>
           <div class="CQE-EAuthorAlt d-none align-items-center flex-nowrap gap-2 mb-3" id="clasificaEAuthorAlt">
               <div class="CQE-EInputAuthor" id="clasificaEInputAuthor">
                   <label for="clasificaEAuthor">${_('Author')}</label><input id="clasificaEAuthor" type="text" class="form-control" />
               </div>
               <div class="CQE-EInputAlt" id="clasificaEInputAlt">
                   <label for="clasificaEAlt">${_('Alternative text')}</label><input id="clasificaEAlt" type="text" class="form-control" />
               </div>
           </div>
           <span id="clasificaETitleAudio">${_('Audio')}</span>
           <div class="CQE-EInputAudio d-flex align-items-center flex-nowrap gap-2" id="clasificaEInputAudio">
               <label class="sr-av" for="clasificaEURLAudio">URL</label>
               <input type="text" class="exe-file-picker CQE-EURLAudio form-control me-0" id="clasificaEURLAudio"/>
               <a href="#" id="clasificaEPlayAudio" class="CQE-ENavigationButton CQE-EPlayVideo" title="${_('Audio')}"><img src="${path}quextIEPlay.png" alt="Play" class="CQE-EButtonImage " /></a>
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
            $exeDevice.removeTags($('#clasificaEPercentajeQuestions').val())
        );
        if (isNaN(percentInput)) return;
        const percentaje = Math.min(Math.max(percentInput, 1), 100),
            totalWords = $exeDevice.wordsGame.length,
            num = Math.max(1, Math.round((percentaje * totalWords) / 100));

        $('#clasificaENumeroPercentaje').text(`${num}/${totalWords}`);
    },

    showQuestion: function (i) {
        const num = Math.min(Math.max(i, 0), $exeDevice.wordsGame.length - 1),
            p = $exeDevice.wordsGame[num];

        $('#clasificaEColor').val(p.color);
        $('#clasificaEBackColor').val(p.backcolor);

        $exeDevice.changeTypeQuestion(p.type);

        $('#clasificaEURLImage').val(p.url);
        $('#clasificaEXImage').val(p.x);
        $('#clasificaEYImage').val(p.y);
        $('#clasificaEAuthor').val(p.author);
        $('#clasificaEAlt').val(p.alt);
        $('#clasificaEText').val(p.eText);
        $('#clasificaETextDiv').text(p.eText);

        if (p.type === 0 || p.type === 2) {
            $exeDevice.showImage(p.url, p.x, p.y, p.alt);
        }
        if (p.type === 1) {
            $('#clasificaETextDiv').css({
                color: p.color,
                'background-color': p.backcolor,
            });
        } else if (p.type === 2) {
            $('#clasificaETextDiv').css({
                color: p.color,
                'background-color': $exeDevice.hexToRgba(p.backcolor, 0.7),
            });
        }
        $('#clasificaEGroupSelect').val(p.group);
        $('#clasificaEURLAudio').val(p.audio);
        $('#clasificaEMessageOK').val(p.msgHit);
        $('#clasificaEMessageKO').val(p.msgError);
        $('#clasificaENumberQuestion').val(i + 1);

        $exeDevice.stopSound();
    },

    hexToRgba: function (hex, alpha = 1) {
        if (typeof hex !== 'string' || hex.trim() === '') {
            return `rgba(255,255,255,${Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1})`;
        }
        const raw = hex.trim();
        if (/^rgba?\(/i.test(raw)) {
            if (/^rgba\(/i.test(raw) && (alpha === 1 || alpha === undefined))
                return raw;
            try {
                const nums = raw
                    .replace(/rgba?\(|\)|\s/g, '')
                    .split(',')
                    .map((v) => parseFloat(v));
                const [r = 255, g = 255, b = 255] = nums;
                const a = Number.isFinite(alpha)
                    ? Math.min(1, Math.max(0, alpha))
                    : (nums[3] ?? 1);
                return `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${a})`;
            } catch (e) {
                return `rgba(255,255,255,${Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1})`;
            }
        }
        let h = raw.replace(/^#/, '');
        if (![3, 6].includes(h.length) || /[^0-9a-f]/i.test(h)) {
            return `rgba(255,255,255,${Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1})`;
        }
        if (h.length === 3)
            h = h
                .split('')
                .map((c) => c + c)
                .join('');
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        const a = Number.isFinite(alpha)
            ? Math.min(1, Math.max(0, Number(alpha)))
            : 1;
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    },

    initQuestions: function () {
        $('#clasificaEInputImage').css('display', 'flex');
        $('#clasificaEMediaImage').prop('disabled', false);
        $('#clasificaEMediaText').prop('disabled', false);
        $('#clasificaEMediaBoth').prop('disabled', false);
        $('#clasificaEAuthorAlt').removeClass('d-flex').addClass('d-none');
        if ($exeDevice.wordsGame.length === 0) {
            $exeDevice.wordsGame.push($exeDevice.getCuestionDefault());
            this.changeTypeQuestion(0);
        }
        this.active = 0;
    },

    changeTypeQuestion: function (type) {
        const elementsToHide =
                '#clasificaETitleAltImage, #clasificaETitleImage, #clasificaEInputImage, #clasificaEImage, #clasificaECover, #clasificaECursor, #clasificaENoImage, #clasificaETextDiv, #clasificaETitleText, #clasificaEInputText',
            $textElements = $(
                '#clasificaETextDiv, #clasificaETitleText, #clasificaEInputText, #clasificaEColor, #clasificaEBackColor'
            ),
            $labelsColor = $(
                'label[for=clasificaEBackColor], label[for=clasificaEColor]'
            ),
            $colorInputs = $('#clasificaEColor, #clasificaEBackColor');

        $(elementsToHide).hide();
        $("input[name='qxtmediatype'][value='" + type + "']").prop(
            'checked',
            true
        );

        const p = $exeDevice.wordsGame[$exeDevice.active] || {};
        const currentColor = (
            p.color ||
            $('#clasificaEColor').val() ||
            '#000000'
        ).trim();
        const currentBg = (
            p.backcolor ||
            $('#clasificaEBackColor').val() ||
            '#ffffff'
        ).trim();

        switch (type) {
            case 0:
                $(
                    '#clasificaEImage, #clasificaETitleImage, #clasificaEInputImage'
                ).show();
                $exeDevice.showImage(
                    $('#clasificaEURLImage').val(),
                    $('#clasificaEXImage').val(),
                    $('#clasificaEYImage').val(),
                    $('#clasificaEAlt').val()
                );
                break;
            case 1:
                $textElements.show();
                $labelsColor.show();
                $('#clasificaEAuthorAlt')
                    .removeClass('d-flex')
                    .addClass('d-none');
                $('#clasificaEColor').val(currentColor).trigger('input');
                $('#clasificaEBackColor').val(currentBg).trigger('input');
                $('#clasificaETextDiv').css({
                    color: currentColor,
                    'background-color': currentBg,
                });
                break;
            case 2:
                $exeDevice.showImage(
                    $('#clasificaEURLImage').val(),
                    $('#clasificaEXImage').val(),
                    $('#clasificaEYImage').val(),
                    $('#clasificaEAlt').val()
                );
                $(elementsToHide).show();
                $colorInputs.show();
                $labelsColor.show();
                $('#clasificaEColor').val(currentColor).trigger('input');
                $('#clasificaEBackColor').val(currentBg).trigger('input');
                $('#clasificaETextDiv').css({
                    color: currentColor,
                    'background-color': $exeDevice.hexToRgba(currentBg, 0.7),
                });
                break;
        }
    },

    getCuestionDefault: function () {
        return {
            type: 0,
            url: '',
            audio: '',
            x: 0,
            y: 0,
            author: '',
            alt: '',
            eText: '',
            type1: 0,
            msgError: '',
            msgHit: '',
            group: 0,
            color: '#000000',
            backcolor: '#ffffff',
        };
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            const wrapper = $('<div></div>').html(originalHTML),
                $imagesLink = $('.clasifica-LinkImages', wrapper),
                $audiosLink = $('.clasifica-LinkAudios', wrapper);
            let json = $('.clasifica-DataGame', wrapper).text();

            json = $exeDevices.iDevice.gamification.helpers.decrypt(json);
            const dataGame =
                $exeDevices.iDevice.gamification.helpers.isJsonString(json);

            $imagesLink.each(function () {
                const iq = parseInt($(this).text());
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
                const iq = parseInt($(this).text());
                if (!isNaN(iq) && iq < dataGame.wordsGame.length) {
                    dataGame.wordsGame[iq].audio = $(this).attr('href');
                    if (dataGame.wordsGame[iq].audio.length < 4) {
                        dataGame.wordsGame[iq].audio = '';
                    }
                }
            });

            const instructions = $('.clasifica-instructions', wrapper);
            if (instructions.length === 1) {
                $('#eXeGameInstructions').val(instructions.html());
            }

            const textAfter = $('.clasifica-extra-content', wrapper);
            if (textAfter.length === 1) {
                $('#eXeIdeviceTextAfter').val(textAfter.html());
            }

            const textFeedBack = $('.clasifica-feedback-game', wrapper);
            if (textFeedBack.length === 1) {
                $('#clasificaEFeedBackEditor').val(textFeedBack.html());
            }

            $exeDevice.updateFieldGame(dataGame);

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

        Object.keys(fields).forEach((i) => {
            const fVal = $('#ci18n_' + i).val();
            if (fVal !== '') i18n[i] = fVal;
        });

        dataGame.msgs = i18n;

        let json = JSON.stringify(dataGame);
        json = $exeDevices.iDevice.gamification.helpers.encrypt(json);

        const textFeedBack = tinyMCE
            .get('clasificaEFeedBackEditor')
            .getContent();
        let divContent = '';
        if (dataGame.instructions !== '') {
            divContent = `<div class="clasifica-instructions">${dataGame.instructions}</div>`;
        }

        const linksImages = $exeDevice.createlinksImage(dataGame.wordsGame),
            linksAudios = $exeDevice.createlinksAudio(dataGame.wordsGame);
        let imgCard = $('#clasificaEURLImgCard').val();
        if (imgCard.trim().length > 4) {
            imgCard = `<a href="${imgCard}" class="js-hidden clasifica-ImageBack" alt="Back" />Background</a>`;
        } else {
            imgCard = '';
        }

        let html = '<div class="clasifica-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html += `<div class="clasifica-feedback-game">${textFeedBack}</div>`;
        html += divContent;
        html += `<div class="clasifica-DataGame js-hidden">${json}</div>`;
        html += linksImages;
        html += linksAudios;
        html += imgCard;

        const textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();
        if (textAfter !== '') {
            html += `<div class="clasifica-extra-content">${textAfter}</div>`;
        }

        html += `<div class="clasifica-bns js-hidden">${$exeDevice.msgs.msgNoSuportBrowser}</div>`;
        html += '</div>';

        return html;
    },

    createlinksImage: function (wordsGame) {
        let html = '';
        wordsGame.forEach((word, i) => {
            if (
                typeof word.url !== 'undefined' &&
                (word.type === 0 || word.type === 2) &&
                word.url.length > 0 &&
                !word.url.startsWith('http')
            ) {
                html += `<a href="${word.url}" class="js-hidden clasifica-LinkImages">${i}</a>`;
            }
        });
        return html;
    },

    createlinksAudio: function (wordsGame) {
        let html = '';
        wordsGame.forEach((word, i) => {
            if (
                typeof word.audio !== 'undefined' &&
                !word.audio.startsWith('http') &&
                word.audio.length > 4
            ) {
                html += `<a href="${word.audio}" class="js-hidden clasifica-LinkAudios">${i}</a>`;
            }
        });
        return html;
    },

    validateQuestion: function () {
        let message = '',
            msgs = $exeDevice.msgs,
            p = {};

        $exeDevice.stopSound();

        p.type = parseInt($('input[name=qxtmediatype]:checked').val());
        p.x = parseFloat($('#clasificaEXImage').val());
        p.y = parseFloat($('#clasificaEYImage').val());
        p.author = $('#clasificaEAuthor').val();
        p.alt = $('#clasificaEAlt').val();
        p.url = $('#clasificaEURLImage').val().trim();
        p.audio = $('#clasificaEURLAudio').val();
        p.eText = $('#clasificaEText').val();
        p.color = $('#clasificaEColor').val();
        p.backcolor = $('#clasificaEBackColor').val();
        p.group = parseInt($('#clasificaEGroupSelect option:selected').val());
        p.msgHit = $('#clasificaEMessageOK').val();
        p.msgError = $('#clasificaEMessageKO').val();

        if (p.type === 0 && p.url.length < 5 && p.audio.length === 0) {
            message = msgs.msgCompleteImage;
        } else if (
            p.type === 1 &&
            p.eText.length === 0 &&
            p.audio.length === 0
        ) {
            message = msgs.msgCompleteText;
        } else if (
            p.type === 2 &&
            (p.eText.length === 0 || p.url.length === 0)
        ) {
            message = msgs.msgCompleteBoth;
        }

        if (p.type === 0) {
            p.eText = '';
        } else if (p.type === 1) {
            p.url = '';
        } else if (p.type === 2) {
            ///
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
            $('#clasificaQEIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';

        return ideviceid;
    },

    validateData: function () {
        const clear = $exeDevice.removeTags,
            instructions = tinyMCE.get('eXeGameInstructions').getContent(),
            textFeedBack = tinyMCE.get('clasificaEFeedBackEditor').getContent(),
            textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent(),
            showMinimize = $('#clasificaEShowMinimize').is(':checked'),
            itinerary =
                $exeDevicesEdition.iDevice.gamification.itinerary.getValues(),
            feedBack = $('#clasificaEHasFeedBack').is(':checked'),
            percentajeFB = parseInt(clear($('#clasificaEPercentajeFB').val())),
            customMessages = $('#clasificaECustomMessages').is(':checked'),
            percentajeQuestions = parseInt(
                clear($('#clasificaEPercentajeQuestions').val())
            ),
            time = parseInt(clear($('#clasificaETime').val())),
            author = $('#clasificaEAuthor').val(),
            numberGroups = parseInt($('input[name=qxtnumber]:checked').val()),
            gameLevel = parseInt($('input[name=qtxgamelevel]:checked').val()),
            evaluation = $('#clasificaEEvaluation').is(':checked'),
            evaluationID = $('#clasificaEEvaluationID').val(),
            imgCard = $('#clasificaEURLImgCard').val(),
            id = $exeDevice.getIdeviceID();

        if (!itinerary) return;
        if (evaluation && evaluationID.length < 5) {
            eXe.app.alert($exeDevice.msgs.msgIDLenght);
            return false;
        }

        if ($exeDevice.wordsGame.length === 0) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
            return false;
        }

        let nogroups = false;
        $('.CQE-EGroup').each(function (i) {
            if (i < numberGroups) {
                const text = $(this).val().trim();
                $exeDevice.groups[i] = text;
                if (text.length === 0) {
                    nogroups = true;
                }
            }
        });

        if (nogroups) {
            $exeDevice.showMessage(
                'Debes indicar un nombre para todos los grupos seleccionados'
            );
            return false;
        }

        for (const mquestion of $exeDevice.wordsGame) {
            if (
                (mquestion.type === 0 &&
                    mquestion.url.length < 4 &&
                    mquestion.audio.length === 0) ||
                (mquestion.type === 1 &&
                    mquestion.eText.length === 0 &&
                    mquestion.audio.length === 0)
            ) {
                $exeDevice.showMessage($exeDevice.msgs.msgCompleteData);
                return false;
            }
        }

        const scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();

        return {
            typeGame: 'Clasifica',
            author,
            instructions,
            showMinimize,
            itinerary,
            wordsGame: $exeDevice.wordsGame,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: true,
            weighted: scorm.weighted || 100,
            textFeedBack: escape(textFeedBack),
            textAfter: escape(textAfter),
            feedBack,
            percentajeFB,
            customMessages,
            percentajeQuestions,
            time,
            version: $exeDevice.version,
            groups: $exeDevice.groups,
            numberGroups,
            gameLevel,
            evaluation,
            evaluationID,
            imgCard: imgCard,
            id,
        };
    },

    validateAlt: function () {
        const altImage = $('#clasificaEAlt').val();

        if (!$exeDevice.checkAltImage || altImage !== '') return true;

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
    },

    showImage: function (url, x, y, alt) {
        const $image = $('#clasificaEImage'),
            $cursor = $('#clasificaECursor'),
            $nimage = $('#clasificaENoImage');

        $image.hide();
        $cursor.hide();
        $image.attr('alt', alt);
        $nimage.show();

        $image
            .prop('src', url)
            .on('load', function () {
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
                    $exeDevice.paintMouse(this, $cursor, x, y);
                    return true;
                }
            })
            .on('error', () => false);
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

    paintMouse: function (image, cursor, x, y) {
        $(cursor).hide();
        if (x > 0 || y > 0) {
            const wI = $(image).width() > 0 ? $(image).width() : 1,
                hI = $(image).height() > 0 ? $(image).height() : 1,
                lI = $(image).position().left + wI * x,
                tI = $(image).position().top + hI * y;

            $(cursor)
                .css({
                    left: `${lI}px`,
                    top: `${tI}px`,
                    'z-index': 30,
                })
                .show();
        }
    },

    drawImage: function (image, mData) {
        $(image).css({
            left: `${mData.x}px`,
            top: `${mData.y}px`,
            width: `${mData.w}px`,
            height: `${mData.h}px`,
        });
    },

    addEvents: function () {
        $('#clasificaEPaste').hide();

        const $form = $('#clasificaQEIdeviceForm');
        $form.on('change', 'input.CQE-Type', function () {
            const type = parseInt(this.value, 10);
            if (!isNaN(type)) {
                $exeDevice.changeTypeQuestion(type);
                if ($exeDevice.wordsGame[$exeDevice.active]) {
                    $exeDevice.wordsGame[$exeDevice.active].type = type;
                    if (type === 0) {
                        $exeDevice.wordsGame[$exeDevice.active].eText = '';
                    } else if (type === 1) {
                        $exeDevice.wordsGame[$exeDevice.active].url = '';
                    }
                }
            }
        });

        $('#clasificaEAdd').on('click', (e) => {
            e.preventDefault();
            $exeDevice.addQuestion();
        });

        $('#clasificaEFirst').on('click', (e) => {
            e.preventDefault();
            $exeDevice.firstQuestion();
        });

        $('#clasificaEPrevious').on('click', (e) => {
            e.preventDefault();
            $exeDevice.previousQuestion();
        });

        $('#clasificaENext').on('click', (e) => {
            e.preventDefault();
            $exeDevice.nextQuestion();
        });

        $('#clasificaELast').on('click', (e) => {
            e.preventDefault();
            $exeDevice.lastQuestion();
        });

        $('#clasificaEDelete').on('click', (e) => {
            e.preventDefault();
            $exeDevice.removeQuestion();
        });

        $('#clasificaECopy').on('click', (e) => {
            e.preventDefault();
            $exeDevice.copyQuestion();
        });

        $('#clasificaEPaste').on('click', (e) => {
            e.preventDefault();
            $exeDevice.pasteQuestion();
        });

        $('#clasificaEPlayAudio').on('click', (e) => {
            e.preventDefault();
            const selectedFile = $('#clasificaEURLAudio').val().trim();
            if (selectedFile.length > 4) {
                $exeDevice.stopSound();
                $exeDevice.playSound(selectedFile);
            }
        });

        $('#clasificaEURLImage').on('change', function () {
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'];
            const selectedFile = this.value.trim();
            const ext = selectedFile.split('.').pop().toLowerCase();
            if (selectedFile.startsWith('files') && !validExt.includes(ext)) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: jpg, jpeg, gif, png, svg, webp`
                );
                return false;
            }
            if ($exeDevice.wordsGame[$exeDevice.active]) {
                $exeDevice.wordsGame[$exeDevice.active].url = selectedFile;
            }
            const alt = $('#clasificaEAlt').val();
            const x = parseFloat($('#clasificaEXImage').val());
            const y = parseFloat($('#clasificaEYImage').val());
            $('#clasificaEImage').hide().attr('alt', 'No image');
            $('#clasificaECursor').hide();
            $('#clasificaENoImage').show();
            if (selectedFile.length > 0) {
                $exeDevice.showImage(selectedFile, x, y, alt);
            }
        });

        $('#clasificaEPlayImage').on('click', (e) => {
            e.preventDefault();
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'];
            const selectedFile = $('#clasificaEURLImage').val();
            const ext = selectedFile.split('.').pop().toLowerCase();
            if (selectedFile.startsWith('files') && !validExt.includes(ext)) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: jpg, jpeg, gif, png, svg, webp`
                );
                return false;
            }
            const url = selectedFile;
            const alt = $('#clasificaEAlt').val();
            const x = parseFloat($('#clasificaEXImage').val());
            const y = parseFloat($('#clasificaEYImage').val());
            $('#clasificaEImage').hide().attr('alt', 'No image');
            $('#clasificaECursor').hide();
            $('#clasificaENoImage').show();
            if (url.length > 0) {
                $exeDevice.showImage(url, x, y, alt);
            }
        });

        $form.on('click', '#clasificaShowAlt', function (e) {
            e.preventDefault();
            const $panel = $('#clasificaEAuthorAlt');
            if ($panel.hasClass('d-none')) {
                $panel.removeClass('d-none').addClass('d-flex');
            } else {
                $panel.removeClass('d-flex').addClass('d-none');
            }
        });

        $form.on('change', '#clasificaEGroupSelect', function () {
            const val = parseInt(this.value, 10);
            if (!isNaN(val) && $exeDevice.wordsGame[$exeDevice.active]) {
                $exeDevice.wordsGame[$exeDevice.active].group = val;
            }
        });

        $form.on('input change', '#clasificaEText', function () {
            const val = this.value;
            $('#clasificaETextDiv').text(val);
            if ($exeDevice.wordsGame[$exeDevice.active]) {
                $exeDevice.wordsGame[$exeDevice.active].eText = val;
            }
        });

        $form.on('change', '#clasificaEColor', function () {
            const val = this.value;
            $('#clasificaETextDiv').css('color', val);
            if ($exeDevice.wordsGame[$exeDevice.active]) {
                $exeDevice.wordsGame[$exeDevice.active].color = val;
            }
        });
        $form.on('change', '#clasificaEBackColor', function () {
            const val = this.value;
            const hasImage = $('#clasificaEURLImage').val().trim().length > 0;
            const cssColor = hasImage ? $exeDevice.hexToRgba(val, 0.7) : val;
            $('#clasificaETextDiv').css('background-color', cssColor);
            if ($exeDevice.wordsGame[$exeDevice.active]) {
                $exeDevice.wordsGame[$exeDevice.active].backcolor = val;
            }
        });

        $form.on('change', '#clasificaEAuthor', function () {
            if ($exeDevice.wordsGame[$exeDevice.active]) {
                $exeDevice.wordsGame[$exeDevice.active].author = this.value;
            }
        });
        $form.on('change', '#clasificaEAlt', function () {
            if ($exeDevice.wordsGame[$exeDevice.active]) {
                $exeDevice.wordsGame[$exeDevice.active].alt = this.value;
            }
        });

        $form.on('change', '#clasificaEXImage, #clasificaEYImage', function () {
            const $x = $('#clasificaEXImage');
            const $y = $('#clasificaEYImage');
            const clamp01 = (n) => (isNaN(n) ? 0 : Math.min(Math.max(n, 0), 1));
            const vx = clamp01(parseFloat($x.val()));
            const vy = clamp01(parseFloat($y.val()));
            $x.val(vx);
            $y.val(vy);
            if ($exeDevice.wordsGame[$exeDevice.active]) {
                $exeDevice.wordsGame[$exeDevice.active].x = vx;
                $exeDevice.wordsGame[$exeDevice.active].y = vy;
            }
            const img = $('#clasificaEImage')[0];
            if (img && $(img).is(':visible')) {
                $exeDevice.paintMouse(img, $('#clasificaECursor')[0], vx, vy);
            }
        });

        $('#clasificaEImage').on('click', function (e) {
            $exeDevice.clickImage(this, e.pageX, e.pageY);
        });

        $('#clasificaECursor').on('click', () => {
            $('#clasificaECursor').hide();
            $('#clasificaEXImage, #clasificaEYImage').val(0);
        });

        $('#clasificaEURLAudio').on('change', function () {
            const selectedFile = this.value.trim();
            if ($exeDevice.wordsGame[$exeDevice.active]) {
                $exeDevice.wordsGame[$exeDevice.active].audio = selectedFile;
            }
            if (selectedFile.length > 4) {
                $exeDevice.stopSound();
                $exeDevice.playSound(selectedFile);
            }
        });

        $('#clasificaEHasFeedBack').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#clasificaEFeedbackP').slideToggle(marcado);
            $('#clasificaEPercentajeFB').prop('disabled', !marcado);
        });

        $('#clasificaECustomMessages').on('change', function () {
            const messages = $(this).is(':checked');
            $exeDevice.showSelectOrder(messages);
        });

        $('#clasificaEPercentajeQuestions').on('keyup focusout', function () {
            let value = this.value.replace(/\D/g, '').substring(0, 3);
            this.value = value || 100;
            this.value = Math.min(Math.max(this.value, 1), 100);
            $exeDevice.updateQuestionsNumber();
        });

        $('#clasificaETime').on('keyup focusout', function () {
            let value = this.value.replace(/\D/g, '').substring(0, 3);
            this.value = value || 0;
            this.value = Math.min(Math.max(this.value, 0), 999);
        });

        $exeDevice.showGroups($exeDevice.numberGroups);

        $('input.CQE-Number').on('click', function () {
            const number = parseInt($(this).val());
            $exeDevice.showGroups(number);
        });

        $('.CQE-EGroup').on('keyup', function () {
            const id = this.id;
            const num = parseInt(id[id.length - 1]);
            $exeDevice.groups[num] = this.value;
            $('#clasificaEGroupSelect option[value=' + num + ']').text(
                this.value
            );
        });

        $('.CQE-EGroup').on('focusout', function () {
            const id = this.id;
            const num = parseInt(id[id.length - 1]);
            $exeDevice.groups[num] = this.value;
            $('#clasificaEGroupSelect option[value=' + num + ']').text(
                this.value
            );
        });

        $('input.CQE-ELevel').on('click', function () {
            const number = parseInt($(this).val());
            if (number != 1) {
                $('#clasificaECustomMessagesDiv').fadeIn();
                $('label[for=clasificaECustomMessages]').fadeIn();
                if ($('#clasificaECustomMessages').is(':checked')) {
                    $exeDevice.showSelectOrder(true);
                } else {
                    $exeDevice.showSelectOrder(false);
                }
            } else {
                $('#clasificaECustomMessagesDiv').fadeOut();
                $exeDevice.showSelectOrder(false);
            }
        });

        $('#clasificaEEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#clasificaEEvaluationID').prop('disabled', !marcado);
        });
        $('#clasificaEEvaluationHelpLnk').on('click', (e) => {
            e.preventDefault();
            $('#clasificaEEvaluationHelp').toggle();
            return false;
        });
        if (
            window.File &&
            window.FileReader &&
            window.FileList &&
            window.Blob
        ) {
            $('#eXeGameExportImport .exe-field-instructions')
                .eq(0)
                .text(`${_('Supported formats')}: txt)`);
            $('#eXeGameExportImport').show();
            $('#eXeGameImportGame').attr('accept', '.txt, .xml');
            $('#eXeGameImportGame').on('change', (e) => {
                const file = e.target.files[0];
                if (!file) {
                    eXe.app.alert(_('Please select a text file (.txt)'));
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
                    eXe.app.alert(_('Please select a text file (.txt)'));
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                    $exeDevice.importGame(e.target.result, file.type);
                };
                reader.readAsText(file);
            });
        } else {
            $('#eXeGameExportImport').hide();
        }

        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();
        $exeDevicesEdition.iDevice.gamification.share.addEvents(
            5,
            $exeDevice.insertWords
        );

        $('#clasificaEURLImgCard').on('change', () =>
            $exeDevice.loadImageCard()
        );

        $('#clasificaEPlayCard').on('click', (e) => {
            e.preventDefault();
            $exeDevice.loadImageCard();
        });

        $('.exe-block-dismissible .exe-block-close').click(function () {
            $(this).parent().fadeOut();
            return false;
        });
    },

    loadImageCard: function () {
        const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
            url = $('#clasificaEURLImgCard').val(),
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
        $image = $('#clasificaECard');
        $nimage = $('#clasificaENoCard');
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

    showGroups: function (number) {
        $('.CQE-EGroup').closest('div').hide();
        $('.CQE-EGroup').each(function (i) {
            const id = $(this).attr('id');
            if (i < number) {
                $(this).closest('div').css('display', 'flex');
            }
            $(this).val($exeDevice.groups[i]);
        });
        $('#clasificaEGroupSelect')
            .find('option')
            .each(function (i) {
                $(this).hide();
                if (i < number) {
                    $(this).show().text($exeDevice.groups[i]);
                }
            });
    },

    showSelectOrder: function (messages) {
        messages ? $('.CQE-EOrders').slideDown() : $('.CQE-EOrders').slideUp();
    },

    updateGameMode: function (feedback) {
        $('#clasificaEHasFeedBack').prop('checked', feedback);
        feedback
            ? $('#clasificaEFeedbackP').slideDown()
            : $('#clasificaEFeedbackP').slideUp();
    },

    clearQuestion: function () {
        $('.CQE-Type')[0].checked = true;
        $(
            '#clasificaEURLImage, #clasificaEXImage, #clasificaEYImage, #clasificaEAuthor, #clasificaEAlt, #clasificaEText, #clasificaEURLAudio'
        ).val('');
        $('#clasificaETextDiv').text('');
        $('#clasificaEColor').val('#000000');
        $('#clasificaEBackColor').val('#ffffff');
    },

    addQuestion: function () {
        if ($exeDevice.wordsGame.length >= 25) {
            $exeDevice.showMessage($exeDevice.msgs.msgPairsMax);
            return;
        }
        if ($exeDevice.validateQuestion()) {
            $exeDevice.clearQuestion();

            $exeDevice.wordsGame.push($exeDevice.getCuestionDefault());

            $exeDevice.active = $exeDevice.wordsGame.length - 1;
            $exeDevice.changeTypeQuestion(0);
            $('#clasificaENumberQuestion').val($exeDevice.wordsGame.length);
            $exeDevice.typeEdit = -1;
            $('#clasificaEPaste').hide();
            $('#clasificaENumQuestions').text($exeDevice.wordsGame.length);
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
            $('#clasificaEPaste').hide();
            $('#clasificaENumQuestions').text($exeDevice.wordsGame.length);
            $('#clasificaENumberQuestion').val($exeDevice.active + 1);
            $exeDevice.updateQuestionsNumber();
        }
    },

    copyQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.typeEdit = 0;
            $exeDevice.clipBoard = JSON.parse(
                JSON.stringify($exeDevice.wordsGame[$exeDevice.active])
            );
            $('#clasificaEPaste').show();
        }
    },

    cutQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.numberCutCuestion = $exeDevice.active;
            $exeDevice.typeEdit = 1;
            $('#clasificaEPaste').show();
        }
    },

    pasteQuestion: function () {
        if ($exeDevice.wordsGame.length >= 25) {
            $exeDevice.showMessage($exeDevice.msgs.msgPairsMax);
            return;
        }
        if ($exeDevice.typeEdit === 0) {
            $exeDevice.active++;
            const p = { ...$exeDevice.clipBoard };
            $exeDevice.wordsGame.splice($exeDevice.active, 0, p);
            $exeDevice.showQuestion($exeDevice.active);
            $('#clasificaENumQuestions').text($exeDevice.wordsGame.length);
        } else if ($exeDevice.typeEdit === 1) {
            $('#clasificaEPaste').hide();
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                $exeDevice.wordsGame,
                $exeDevice.numberCutCuestion,
                $exeDevice.active
            );
            $exeDevice.showQuestion($exeDevice.active);
            $('#clasificaENumQuestions').text($exeDevice.wordsGame.length);
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
            game.percentajeFB !== undefined ? game.percentajeFB : 100;
        game.feedBack = game.feedBack !== undefined ? game.feedBack : false;
        game.customMessages =
            game.customMessages !== undefined ? game.customMessages : false;
        game.percentajeQuestions =
            game.percentajeQuestions !== undefined
                ? game.percentajeQuestions
                : 100;
        game.evaluation =
            game.evaluation !== undefined ? game.evaluation : false;
        game.evaluationID =
            game.evaluationID !== undefined ? game.evaluationID : '';
        game.weighted =
            typeof game.weighted !== 'undefined' ? game.weighted : 100;
        $exeDevice.id = $exeDevice.getIdeviceID();

        game.imgCard = game.imgCard ?? '';

        $('#clasificaEShowMinimize').prop('checked', game.showMinimize);
        $('#clasificaEHasFeedBack').prop('checked', game.feedBack);
        $('#clasificaEPercentajeFB').val(game.percentajeFB);
        $('#clasificaEPercentajeQuestions').val(game.percentajeQuestions);
        $('#clasificaETime').val(game.time);
        $('#clasificaEAuthor').val(game.author);

        $(
            `input.CQE-Number[name='qxtnumber'][value='${game.numberGroups}']`
        ).prop('checked', true);
        $('#clasificaECustomMessages').prop('checked', game.customMessages);
        $('#clasificaEEvaluation').prop('checked', game.evaluation);
        $('#clasificaEEvaluationID')
            .val(game.evaluationID)
            .prop('disabled', !game.evaluation);

        $exeDevice.wordsGame = game.wordsGame;
        $exeDevice.updateGameMode(game.feedBack);
        $('#clasificaENumQuestions').text($exeDevice.wordsGame.length);
        $('#clasificaEPercentajeFB').prop('disabled', !game.feedBack);

        $(
            `input.CQE-ELevel[name='qtxgamelevel'][value='${game.gameLevel}']`
        ).prop('checked', true);

        $('#clasificaEURLImgCard').val(game.imgCard);
        $exeDevice.showImageCard(game.imgCard);

        $exeDevice.showSelectOrder(game.customMessages && game.gameLevel !== 1);
        $exeDevice.updateQuestionsNumber();

        $exeDevice.groups = game.groups;
        $exeDevice.numberGroups = game.numberGroups;

        $exeDevice.showGroups($exeDevice.numberGroups);

        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted
        );
    },

    importText: function (content) {
        const lines = content.split('\n');
        $exeDevice.insertWords(lines);
    },

    insertWords: function (lines) {
        const lineFormat = /^(0|1|2|3)#([^#]+)$/;
        let questions = [],
            valids = [];

        lines.forEach((line) => {
            if (lineFormat.test(line)) {
                const p = $exeDevice.getCuestionDefault();
                valids.push(line);
                const [group, eText] = line.trim().split('#');
                Object.assign(p, {
                    type: 1,
                    eText,
                    group: parseInt(group, 10),
                });
                questions.push(p);
            }
        });

        const numgroups = $exeDevice.validateGroups(valids);
        if (numgroups) {
            $exeDevice.numberGroups = numgroups;
            $(`input.CQE-Number[name='qxtnumber'][value='${numgroups}']`).prop(
                'checked',
                true
            );
            $exeDevice.showGroups(numgroups);
        } else {
            $exeDevice.showMessage(_('Incorrect group number'));
            return;
        }
        $exeDevice.addWords(questions);
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
            if (word.eText && typeof word.group != 'undefined') {
                p.eText = word.eText;
                p.group = parseInt(word.group);
                p.type = 1;
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

    validateGroups: function (elements) {
        const groups = {};

        for (const element of elements) {
            const [group] = element.split('#');
            if (group >= 0 && group <= 3) {
                groups[group] = (groups[group] || 0) + 1;
            } else {
                return false;
            }
        }

        const numGroups = Object.keys(groups).length;
        const allGroupsPresent = [0, 1, 2, 3]
            .slice(0, numGroups)
            .every((group) =>
                Object.prototype.hasOwnProperty.call(groups, group)
            );

        return numGroups >= 2 && numGroups <= 4 && allGroupsPresent
            ? numGroups
            : false;
    },

    importGame: function (content, filetype) {
        const game =
            $exeDevices.iDevice.gamification.helpers.isJsonString(content);

        if (content.includes('\u0000')) {
            eXe.app.alert(_('Sorry, wrong file format'));
        } else if (!game && content) {
            if (filetype.match('text/plain')) {
                $exeDevice.importText(content);
            } else {
                eXe.app.alert(_('Sorry, wrong file format'));
            }
            return;
        } else if (!game || game.typeGame !== 'Clasifica') {
            eXe.app.alert($exeDevice.msgs.msgESelectFile);
        } else {
            game.id = $exeDevice.getIdeviceID();
            $exeDevice.updateFieldGame(game);

            tinyMCE
                .get('eXeGameInstructions')
                .setContent(
                    unescape(game.instructionsExe || game.instructions)
                );
            tinyMCE
                .get('eXeIdeviceTextAfter')
                .setContent(unescape(game.textAfter || ''));
            tinyMCE
                .get('clasificaEFeedBackEditor')
                .setContent(unescape(game.textFeedBack || ''));
        }

        $exeDevice.active = 0;
        $exeDevice.showQuestion($exeDevice.active);
        $exeDevice.deleteEmptyQuestion();
        $exeDevice.updateQuestionsNumber();
        //$('.exe-form-tabs li:first-child a').click();
    },

    deleteEmptyQuestion: function () {
        if ($exeDevice.wordsGame.length > 1) {
            const word = $('#clasificaEText').val().trim(),
                img = $('#clasificaEInputImage').val().trim(),
                audio = $('#clasificaEInputAudio').val().trim();
            if (!word && img.length < 4 && audio.length < 4) {
                $exeDevice.removeQuestion();
            }
        }
    },

    validTime: function (time) {
        const reg = /^(?:(?:([01]?\d|2[0-3]):)?([0-5]?\d):)?([0-5]?\d)$/;
        return reg.test(time) && time.length === 8;
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
        return { w: wImage, h: hImage, x: xImagen, y: yImagen };
    },

    clickImage: function (img, epx, epy) {
        const $cursor = $('#clasificaECursor'),
            $x = $('#clasificaEXImage'),
            $y = $('#clasificaEYImage'),
            $img = $(img);

        const posX = epx - $img.offset().left,
            posY = epy - $img.offset().top,
            wI = $img.width() > 0 ? $img.width() : 1,
            hI = $img.height() > 0 ? $img.height() : 1,
            lI = $img.position().left,
            tI = $img.position().top;

        $x.val(posX / wI);
        $y.val(posY / hI);

        $cursor
            .css({
                left: posX + lI,
                top: posY + tI,
                'z-index': 31,
            })
            .show();
    },

    removeTags: (str) => {
        const wrapper = $('<div></div>').html(str);
        return wrapper.text();
    },
};
