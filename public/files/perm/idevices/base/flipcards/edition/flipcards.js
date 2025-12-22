/* eslint-disable no-undef */
/**
/**
 *  Memory cards activity iDevice (edition code)
 * Version: 3.0
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narvaez Martinez
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    i18n: {
        category: _('Interactive activities'),
        name: _('Memory cards'),
    },
    msgs: {},
    classIdevice: 'flipcards',
    active: 0,
    activeCard: 0,
    activeID: '',
    cardsGame: [],
    typeEdit: -1,
    idPaste: '',
    numberCutCuestion: -1,
    clipBoard: '',
    idevicePath: '',
    playerAudio: '',
    version: 1.3,
    id: false,
    ci18n: {},
    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.refreshTranslations();
        this.setMessagesInfo();
        this.createForm();
    },
    initCards: function () {
        this.ci18n.msgTryAgain = this.ci18n.msgTryAgain.replace(
            '&percnt;',
            '%'
        ); // Avoid invalid HTML
        if ($exeDevice.cardsGame.length == 0) {
            const card = $exeDevice.getCardDefault();
            $exeDevice.cardsGame.push(card);
        }
        $('#flipcardsETextDiv').hide();
        $('#flipcardsETextDivBack').hide();
        this.active = 0;
    },
    refreshTranslations: function () {
        this.ci18n = {
            msgSubmit: c_('Submit'),
            msgClue: c_('Cool! The clue is:'),
            msgCodeAccess: c_('Access code'),
            msgPlayAgain: c_('Play Again'),
            msgPlayStart: c_('Click here to play'),
            msgScore: c_('Score'),
            msgWeight: c_('Weight'),
            msgErrors: c_('Errors'),
            msgHits: c_('Hits'),
            msgMinimize: c_('Minimize'),
            msgMaximize: c_('Maximize'),
            msgCool: c_('Cool!'),
            msgFullScreen: c_('Full Screen'),
            msgExitFullScreen: c_('Exit Full Screen'),
            msgSuccesses: c_(
                'Right! | Excellent! | Great! | Very good! | Perfect!'
            ),
            msgFailures: c_(
                'It was not that! | Incorrect! | Not correct! | Sorry! | Error!'
            ),
            msgNoImage: c_('No picture question'),
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
            msgPreviousCard: c_('Previous'),
            msgNextCard: c_('Next'),
            msgNumQuestions: c_('Number of cards'),
            msgTrue: c_('True'),
            msgFalse: c_('False'),
            msgTryAgain: c_(
                'You need at least %s&percnt; of correct answers to get the information. Please try again.'
            ),
            mgsAllQuestions: c_('Questions completed!'),
            msgTrue1: c_("Right. That's the card."),
            msgTrue2: c_("You're wrong. That's not the card."),
            msgFalse1: c_("Right. That's not the card."),
            msgFalse2: c_("You're wrong. That's the card."),
            mgsClickCard: c_('Click on the card'),
            msgEndTime: c_('Game time is over. Your score is %s.'),
            msgEnd: c_('Finish'),
            msgEndGameM: c_('You finished the game. Your score is %s.'),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgTypeGame: c_('Memory cards'),
        };
    },
    setMessagesInfo: function () {
        const msgs = this.msgs;
        msgs.msgESelectFile = _(
            'The selected file does not contain a valid game'
        );
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.'
        );
        msgs.msgCompleteData = _(
            "Provide an image, text or audio for each card's front side"
        );
        msgs.msgCompleteDataBack = _(
            "Provide an image, text or audio for each card's back side"
        );
        msgs.msgEOneCard = _('Please create at least one card');
        msgs.msgMaxCards = _('Maximum card number: %s.');
        msgs.msgIDLenght = _(
            'The report identifier must have at least 5 characters'
        );
        msgs.msgTitleAltImageWarning = _('Accessibility warning'); //eXe 3.0
        msgs.msgAltImageWarning = _(
            'At least one image has no description, are you sure you want to continue without including it? Without it the image may not be accessible to some users with disabilities, or to those using a text browser, or browsing the Web with images turned off.'
        ); //eXe 3.0
    },

    createForm: function () {
        const path = $exeDevice.idevicePath,
            html = `
            <div id="flipcardsQEIdeviceForm">
                <p class="exe-block-info exe-block-dismissible" style="position:relative">
                    ${_('Create card memory games with images, sounds or rich text.')} 
                    <a href="https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe29/tarjetas_de_memoria.html" hreflang="es" target="_blank">${_('Usage Instructions')}</a>
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Click on the cards to see what they hide.'))}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_('Options')}</a></legend>
                        <div>
                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <span>${_('Type')}:</span>
                                <div class="form-check form-check-inline m-0">
                                    <input class="FLCRDS-Type form-check-input" checked id="flipcardsETypeShow" type="radio" name="flctype" value="0"/>
                                    <label for="flipcardsETypeShow" class="form-check-label">${_('Show')}</label>
                                </div>
                                <div class="form-check form-check-inline m-0">
                                    <input class="FLCRDS-Type form-check-input" id="flipcardsETypeNavigation" type="radio" name="flctype" value="1"/>
                                    <label for="flipcardsETypeNavigation" class="form-check-label">${_('Navigation')}</label>
                                </div>
                                <div class="form-check form-check-inline m-0">
                                    <input class="FLCRDS-Type form-check-input" id="flipcardsETypeIdentify" type="radio" name="flctype" value="2"/> 
                                    <label for="flipcardsETypeIdentify" class="form-check-label">${_('Identify')}</label>
                                </div>
                                <div class="form-check form-check-inline m-0">
                                    <input class="FLCRDS-Type form-check-input" id="flipcardsETypeMemory" type="radio" name="flctype" value="3"/>
                                    <label for="flipcardsETypeMemory" class="form-check-label">${_('Memory')}</label>
                                </div>
                            </div>
                            <div style="display:none" class="mb-3">
                                <span class="toggle-item" role="switch" aria-checked="true">
                                    <span class="toggle-control">
                                        <input type="checkbox" checked id="flipcardsEShowSolution" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="flipcardsEShowSolution">${_('Show solutions')}.</label>
                                </span>
                                <label for="flipcardsETimeShowSolution" class="ms-2 mb-0">${_('Show solution time (seconds)')}:</label>
                                <input type="number" name="flipcardsETimeShowSolution" id="flipcardsETimeShowSolution" value="3" min="1" max="9" class="form-control" style="width:5ch" />
                                
                            </div>
                            <div id="flipcardsETimeDiv" style="display:none;" class="align-items-center gap-2 flex-nowrap mb-3">
                                <label for="flipcardsETime" class="mb-0">${_('Time (minutes)')}:</label>
                                <input type="number" name="flipcardsETime" id="flipcardsETime" value="3" min="0" max="59" class="form-control" style="width:5ch" />
                            </div>
                            <div class="mb-3">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="flipcardsEShowMinimize" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="flipcardsEShowMinimize">${_('Show minimized.')}</label>
                                </span>
                            </div>
                            <div class="mb-3">
                                <span class="toggle-item" role="switch" aria-checked="true">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="flipcardsERandomCards" class="toggle-input" checked />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="flipcardsERandomCards">${_('Random')}</label>
                                </span>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <label for="flipcardsEPercentajeCards" class="mb-0">%${_('Cards')}:</label>
                                <input type="number" name="flipcardsEPercentajeCards" id="flipcardsEPercentajeCards" value="100" min="1" max="100" class="form-control" style="width:6ch" />
                                <span id="flipcardsENumeroPercentaje">1/1</span>
                            </div>
                            <div class="d-none align-items-center gap-2 flex-nowrap mb-3">
                                <label for="flipcardsEAuthory" class="mb-0">${_('Authorship')}:</label>
                                <input id="flipcardsEAuthory" type="text" class="form-control" />
                            </div>
                            <div id="flipcardBackDiv" style="display:none">
                                <p class="FLCRDS-EInputImageBack">
                                    <label for="flipcardsEURLImgCard">${_('Image back')}: </label>
                                    <input type="text" class="exe-file-picker FLCRDS-EURLImage form-control me-0" id="flipcardsEURLImgCard"/>
                                    <a href="#" id="flipcardEPlayCard" class="flipcard-ENavigationButton flipcardEEPlayVideo" title="${_('Show')}">
                                         <img src="${path}quextIEPlay.png" alt="${_('Show')}" class="FLCRDS-ENavigationButton " />
                                    </a>
                                </p>
                                <p id="flipcardbackground" class="FLCRDS-Back">
                                    <img class="FLCRDS-EImageBack" src="" id="flipcardECard" alt="${_('Image')}" style="display:none" />
                                    <img class="FLCRDS-EImageBack" src="${path}flcsHome.png" id="flipcardENoCard" alt="${_('No image')}" />
                                </p>
                            </div>
                            <div class="Games-Reportdiv d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="flipcardsEEvaluation" class="toggle-input" data-target="#flipcardsEEvaluationIDWrapper" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="flipcardsEEvaluation">${_('Progress report')}.</label>
                                </span>
                                <span id="flipcardsEEvaluationIDWrapper" class="d-flex align-items-center gap-2 flex-nowrap">
                                    <label for="flipcardsEEvaluationID" >${_('Identifier')}:</label>
                                    <input type="text" id="flipcardsEEvaluationID" disabled value="${eXeLearning.app.project.odeId || ''}" class="form-control" />
                                </span>
                                <strong class="GameModeLabel">
                                    <a href="#" id="flipcardsEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                        <img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}"/>
                                    </a>
                                </strong>
                            </div>
                            <p id="flipcardsEEvaluationHelp" class="FLCRDS-TypeGameHelp exe-block-info exe-block-dismissible">
                                ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                            </p>
                        </div>
                    </fieldset>
                    <fieldset class="exe-fieldset">
                        <legend><a href="#">${_('Cards')}</a></legend>
                        <div class="FLCRDS-EPanel" id="flipcardsEPanel">
                            <div class="FLCRDS-EPhrase" id="flipcardsEPhrase">
                                <div class="FLCRDS-EDatosCarta FLCRDS-EFront" id="flipcardsEDatosCarta">
                                    <span class="FLCRDS-ECardType mb-3 mt-2">${_('Front side')}</span>
                                    <div class="FLCRDS-EMultimedia mb-3">
                                        <div class="FLCRDS-ECard">
                                            <img class="FLCRDS-EHideFLCRDS-EImage" id="flipcardsEImage" src="${path}quextIEImage.png" alt="${_('No image')}" />
                                            <img class="FLCRDS-ECursor" id="flipcardsECursor" src="${path}quextIECursor.gif" alt="" />
                                            <img class="FLCRDS-EHideFLCRDS-NoImage" id="flipcardsENoImage" src="${path}quextIEImage.png" alt="${_('No image')}" />
                                            <div class="FLCRDS-ETextDiv" id="flipcardsETextDiv"></div>
                                        </div>
                                    </div>
                                    <span>${_('Text')}</span>
                                    <div class="d-flex align-items-center gap-2 flex-nowrap mb-3" id="flipcardsEInputText">
                                        <label class="sr-av">${_('Text')}</label>
                                        <input type="text" id="flipcardsEText" class="form-control" />
                                        <label id="flipcardsELblColor" class="FLCRDS-LblColor">${_('Color')}: </label> 
                                        <input id="flipcardsEColor" type="color"  class="form-control form-control-color" value="#000000">                                       
                                        <label id="flipcardsELblBgColor" class="FLCRDS-LblBgColor">${_('Background')}:   </label> 
                                        <input id="flipcardsEBgColor" type="color"  class="form-control form-control-color" value="#ffffff">
                                     
                                    </div>
                                    <span>${_('Image')}</span>
                                    <div class="d-flex align-items-center gap-2 flex-nowrap mb-3" id="flipcardsEInputImage">
                                        <label for="flipcardsEURLImage" class="sr-av">URL</label>
                                        <input type="text" id="flipcardsEURLImage" class="exe-file-picker FLCRDS-EURLImage form-control me-0"/>
                                        <a href="#" id="flipcardsEPlayImage" class="FLCRDS-ENavigationButton FLCRDS-EPlayVideo" title="${_('Show')}">
                                            <img src="${path}quextIEPlay.png" alt="${_('Show')}" class="FLCRDS-ENavigationButton " />
                                        </a>
                                        <a href="#" id="flipcardsEShowMore" class="FLCRDS-ENavigationButton FLCRDS-EShowMore" title="${_('More')}">
                                            <img src="${path}quextEIMore.png" alt="${_('More')}" class="FLCRDS-ENavigationButton " />
                                        </a>
                                    </div>
                                    <div class="FLCRDS-ECoord">
                                        <label for="flipcardsEX">X:</label>
                                        <input id="flipcardsEX" class="FLCRDS-EX form-control" type="text" value="0" />
                                        <label for="flipcardsEY">Y:</label>
                                        <input id="flipcardsEY" class="FLCRDS-EY form-control" type="text" value="0" />
                                    </div>
                                    <div class="align-items-center gap-2 flex-nowrap mb-3" id="flipcardsEAuthorAlt">
                                        <div class="FLCRDS-EInputAuthor">
                                            <label for="flipcardsEAuthor">${_('Authorship')}</label>
                                            <input id="flipcardsEAuthor" type="text" class="FLCRDS-EAuthor form-control" />
                                        </div>
                                        <div class="FLCRDS-EInputAlt">
                                            <label for="flipcardsEAlt">${_('Alternative text')}</label>
                                            <input id="flipcardsEAlt" type="text" class="FLCRDS-EAlt form-control" />
                                        </div>
                                    </div>
                                    <span>${_('Audio')}</span>
                                    <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                        <label for="flipcardsEURLAudio" class="sr-av">URL</label>
                                        <input type="text" id="flipcardsEURLAudio" class="exe-file-picker FLCRDS-EURLAudio form-control me-0" />
                                        <a href="#" id="flipcardsEPlayAudio" class="FLCRDS-ENavigationButton FLCRDS-EPlayVideo" title="${_('Audio')}">
                                            <img src="${path}quextIEPlay.png" alt="Play" class="FLCRDS-ENavigationButton " />
                                        </a>
                                    </div>
                                </div>
                                <div class="FLCRDS-EDatosCarta FLCRDS-EBack" id="flipcardsEDatosCartaBack">
                                    <span class="FLCRDS-ECardType mb-3 mt-2">${_('Back side')}</span>
                                    <div class="FLCRDS-EMultimedia">
                                        <div class="FLCRDS-ECard">
                                            <img class="FLCRDS-EHideFLCRDS-EImage" id="flipcardsEImageBack" src="${path}quextIEImage.png" alt="${_('No image')}" />
                                            <img class="FLCRDS-ECursor" id="flipcardsECursorBack" src="${path}quextIECursor.gif" alt="" />
                                            <img class="FLCRDS-EHideFLCRDS-NoImage" id="flipcardsENoImageBack" src="${path}quextIEImage.png" alt="${_('No image')}" />
                                            <div class="FLCRDS-ETextDiv" id="flipcardsETextDivBack"></div>
                                        </div>
                                    </div>
                                    <span >${_('Text')}</span>
                                    <div class="d-flex align-items-center flex-nowrap mb-3 gap-2" id="flipcardsEInputTextBack">
                                        <label for="flipcardsETextBack" class="sr-av">${_('Text')}</label>
                                        <input type="text" id="flipcardsETextBack" class="form-control" />
                                        <label id="flipcardsELblColorBack" class="FLCRDS-LblColor ">${_('Color')}:</label> 
                                        <input id="flipcardsEColorBack" type="color" class="form-control form-control-color" value="#000000">
                                        <label id="flipcardsELblBgColorBack" class="FLCRDS-LblBgColor">${_('Background')}:</label> 
                                        <input id="flipcardsEBgColorBack" type="color" class="form-control form-control-color" value="#ffffff">
                                        
                                    </div>
                                    <span> ${_('Image')}</span>
                                    <div class="d-flex align-items-center flex-nowrap gap-2 mb-3" id="flipcardsEInputImageBack">
                                        <label for="flipcardsEURLImageBack" class="sr-av">URL</label>
                                        <input type="text" id="flipcardsEURLImageBack" class="exe-file-picker form-control me-0"/>
                                        <a href="#" id="flipcardsEPlayImageBack" class="FLCRDS-EPlayVideo" title="${_('Show')}">
                                            <img src="${path}quextIEPlay.png" alt="${_('Show')}" class="FLCRDS-ENavigationButton " />
                                        </a>
                                        <a href="#" id="flipcardsEShowMoreBack" title="${_('More')}">
                                            <img src="${path}quextEIMore.png" alt="${_('More')}" class="FLCRDS-ENavigationButton " />
                                        </a>
                                    </div>
                                    <div class="FLCRDS-ECoord">
                                        <label>X:</label>
                                        <input id="flipcardsEXBack" class="FLCRDS-EX form-control" type="text" value="0" />
                                        <label>Y:</label>
                                        <input id="flipcardsEYBack" class="FLCRDS-EY form-control" type="text" value="0" />
                                    </div>
                                    <div class="align-items-center gap-2 flex-nowrap mb-3" id="flipcardsEAuthorAltBack">
                                        <div class="FLCRDS-EInputAuthor">
                                            <label>${_('Authorship')}</label>
                                            <input id="flipcardsEAuthorBack" type="text" class="FLCRDS-EAuthor form-control" />
                                        </div>
                                        <div class="FLCRDS-EInputAlt">
                                            <label>${_('Alternative text')}</label>
                                            <input id="flipcardsEAltBack" type="text" class="FLCRDS-EAlt form-control" />
                                        </div>
                                    </div>
                                    <span>${_('Audio')}</span>
                                    <div class="d-flex align-items-center flex-nowrap mb-3 gap-2">
                                        <label form="flipcardsEURLAudioBack" class="sr-av">URL</label>
                                        <input type="text" id="flipcardsEURLAudioBack" class="exe-file-picker FLCRDS-EURLAudio form-control  me-0" />
                                        <a href="#" id="flipcardsEPlayAudioBack" class="FLCRDS-ENavigationButton FLCRDS-EPlayVideo" title="${_('Audio')}">
                                            <img src="${path}quextIEPlay.png" alt="Play" class="FLCRDS-ENavigationButton " />
                                        </a>
                                    </div>
                                </div>
                            </div>
                            <div class="FLCRDS-EReverseFacces mt-2">
                                <a href="#" id="flipcardsEReverseCard" title="${_('Flip down the card')}">${_('Flip down the card')}</a>
                                <a href="#" id="flipcardsEReverseFaces" title="${_('Flip down all the cards')}">${_('Flip down all the cards')}</a>
                            </div>
                            <div class="FLCRDS-ENavigationButtons gap-2">
                                <a href="#" id="flipcardsEAddC" class="FLCRDS-ENavigationButton" title="${_('Add question')}"><img src="${path}quextIEAdd.png" alt="${_('Add question')}" class="FLCRDS-ENavigationButton" /></a>
                                <a href="#" id="flipcardsEFirstC" class="FLCRDS-ENavigationButton" title="${_('First question')}"><img src="${path}quextIEFirst.png" alt="${_('First question')}" class="FLCRDS-ENavigationButton" /></a>
                                <a href="#" id="flipcardsEPreviousC" class="FLCRDS-ENavigationButton" title="${_('Previous question')}"><img src="${path}quextIEPrev.png" alt="${_('Previous question')}" class="FLCRDS-ENavigationButton" /></a>
                                <label class="sr-av" for="flipcardsENumberCard">${_('Question number:')}:</label>
                                <input type="text" class="FLCRDS-NumberCard form-control" id="flipcardsENumberCard" value="1"/>
                                <a href="#" id="flipcardsENextC" class="FLCRDS-ENavigationButton" title="${_('Next question')}"><img src="${path}quextIENext.png" alt="${_('Next question')}" class="FLCRDS-ENavigationButton" /></a>
                                <a href="#" id="flipcardsELastC" class="FLCRDS-ENavigationButton" title="${_('Last question')}"><img src="${path}quextIELast.png" alt="${_('Last question')}" class="FLCRDS-ENavigationButton" /></a>
                                <a href="#" id="flipcardsEDeleteC" class="FLCRDS-ENavigationButton" title="${_('Delete question')}"><img src="${path}quextIEDelete.png" alt="${_('Delete question')}" class="FLCRDS-ENavigationButton" /></a>
                                <a href="#" id="flipcardsECopyC" class="FLCRDS-ENavigationButton" title="${_('Copy question')}"><img src="${path}quextIECopy.png" alt="${_('Copy question')}" class="FLCRDS-ENavigationButton" /></a>
                                <a href="#" id="flipcardsECutC" class="FLCRDS-ENavigationButton" title="${_('Cut question')}"><img src="${path}quextIECut.png" alt="${_('Cut question')}" class="FLCRDS-ENavigationButton" /></a>
                                <a href="#" id="flipcardsEPasteC" class="FLCRDS-ENavigationButton" title="${_('Paste question')}"><img src="${path}quextIEPaste.png" alt="${_('Paste question')}" class="FLCRDS-ENavigationButton" /></a>
                            </div>
                            <div class="FLCRDS-ENumCardDiv" id="flipcardsENumCardsDiv">
                                <div class="FLCRDS-ENumCardsIcon"><span class="sr-av">${_('Cards')}:</span></div>
                                <span class="FLCRDS-ENumCards" id="flipcardsENumCards">0</span>
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
        $exeDevicesEdition.iDevice.tabs.init('flipcardsQEIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();
        this.enableForm();
    },

    clearCard: function () {
        $('#flipcardsEURLImage').val('');
        $('#flipcardsEX').val('0');
        $('#flipcardsEY').val('0');
        $('#flipcardsEAuthor').val('');
        $('#flipcardsEAlt').val('');
        $('#flipcardsEURLAudio').val('');
        $('#flipcardsEText').val('');
        $('#flipcardsETextDiv').val('');
        $('#flipcardsEColor').val('#000000');
        $('#flipcardsEBgColor').val('#ffffff');
        $('#flipcardsETextDiv').hide();
        $('#flipcardsETextDiv').css({
            'background-color': $exeDevice.hexToRgba('#ffffff', 0.7),
            color: '#000000',
        });
        $exeDevice.showImage(0);
        $('#flipcardsEURLImageBack').val('');
        $('#flipcardsEXBack').val('0');
        $('#flipcardsEYBack').val('0');
        $('#flipcardsEAuthorBack').val('');
        $('#flipcardsEAltBack').val('');
        $('#flipcardsEURLAudioBack').val('');
        $('#flipcardsETextBack').val('');
        $('#flipcardsETextDivBack').val('');
        $('#flipcardsEColorBack').val('#000000');
        $('#flipcardsEBgColorBack').val('#ffffff');
        $('#flipcardsETextDivBack').hide();
        $('#flipcardsETextDivBack').css({
            'background-color': $exeDevice.hexToRgba('#ffffff', 0.7),
            color: '#000000',
        });

        $exeDevice.showImage(1);
    },
    addCard: function () {
        if (!$exeDevice.validateCard()) return;

        $exeDevice.clearCard();
        $exeDevice.cardsGame.push($exeDevice.getCardDefault());
        $exeDevice.active = $exeDevice.cardsGame.length - 1;
        $exeDevice.typeEdit = -1;
        $('#flipcardsEPasteC').hide();
        $('#flipcardsENumCards').text($exeDevice.cardsGame.length);
        $('#flipcardsENumberCard').val($exeDevice.cardsGame.length);
        $exeDevice.updateCardsNumber();
    },

    removeCard: function () {
        if ($exeDevice.cardsGame.length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneCard);
            return;
        } else {
            $exeDevice.cardsGame.splice($exeDevice.active, 1);
            if ($exeDevice.active >= $exeDevice.cardsGame.length - 1) {
                $exeDevice.active = $exeDevice.cardsGame.length - 1;
            }
            $exeDevice.showCard($exeDevice.active);
            $exeDevice.typeEdit = -1;
            $('#flipcardsEPasteC').hide();
            $('#flipcardsENumCards').text($exeDevice.cardsGame.length);
            $('#flipcardsENumberCard').val($exeDevice.active + 1);
            $exeDevice.updateCardsNumber();
        }
    },

    copyCard: function () {
        if (!$exeDevice.validateCard()) return;
        $exeDevice.typeEdit = 0;
        $exeDevice.clipBoard = JSON.parse(
            JSON.stringify($exeDevice.cardsGame[$exeDevice.active])
        );
        $exeDevice.cardsGame[$exeDevice.active];
        $('#flipcardsEPasteC').show();
    },

    cutCard: function () {
        if (!$exeDevice.validateCard()) return;
        $exeDevice.numberCutCuestion = $exeDevice.active;
        $exeDevice.typeEdit = 1;
        $('#flipcardsEPasteC').show();
    },

    pasteCard: function () {
        if ($exeDevice.typeEdit == 0) {
            $exeDevice.active++;
            $exeDevice.cardsGame.splice(
                $exeDevice.active,
                0,
                $exeDevice.clipBoard
            );
            $exeDevice.showCard($exeDevice.active);
        } else if ($exeDevice.typeEdit == 1) {
            $('#flipcardsEPasteC').hide();
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                $exeDevice.cardsGame,
                $exeDevice.numberCutCuestion,
                $exeDevice.active
            );
            $exeDevice.showCard($exeDevice.active);
            $('#flipcardsENumCards').text($exeDevice.cardsGame.length);
            $('#flipcardsENumberCard').val($exeDevice.active + 1);
            $exeDevice.updateCardsNumber();
        }
    },

    lastCard: function () {
        if (
            $exeDevice.validateCard() &&
            $exeDevice.active < $exeDevice.cardsGame.length - 1
        ) {
            $exeDevice.active = $exeDevice.cardsGame.length - 1;
            $exeDevice.showCard($exeDevice.active);
        }
    },

    previousCard: function () {
        if ($exeDevice.validateCard() && $exeDevice.active > 0) {
            $exeDevice.active--;
            $exeDevice.showCard($exeDevice.active);
        }
    },

    firstCard: function () {
        if ($exeDevice.validateCard() && $exeDevice.active > 0) {
            $exeDevice.active = 0;
            $exeDevice.showCard($exeDevice.active);
        }
    },

    showCard: function (i) {
        let num = i < 0 ? 0 : i;
        num =
            num >= $exeDevice.cardsGame.length
                ? $exeDevice.cardsGame.length - 1
                : num;
        const p = $exeDevice.cardsGame[num];

        $exeDevice.stopSound();

        $('#flipcardsEURLImage').val(p.url);
        $('#flipcardsEX').val(p.x);
        $('#flipcardsEY').val(p.y);
        $('#flipcardsEAuthor').val(p.author);
        $('#flipcardsEAlt').val(p.alt);
        $('#flipcardsETextDiv').html(
            $exeDevice.decodeURIComponentSafe(p.eText)
        );
        $('#flipcardsEText').val($exeDevice.decodeURIComponentSafe(p.eText));
        $('#flipcardsEColor').val(p.color);
        $('#flipcardsEBgColor').val(p.backcolor);
        $('#flipcardsEURLAudio').val(p.audio);

        if (p.eText.length > 0) {
            $('#flipcardsETextDiv').show();
        } else {
            $('#flipcardsETextDiv').hide();
        }

        $('#flipcardsETextDiv').css({
            color: p.color,
            'background-color': $exeDevice.hexToRgba(p.backcolor, 0.7),
        });

        $exeDevice.showImage(0);

        $('#flipcardsEURLImageBack').val(p.urlBk);
        $('#flipcardsEXBack').val(p.xBk);
        $('#flipcardsEYBack').val(p.yBk);
        $('#flipcardsEAuthorBack').val(p.authorBk);
        $('#flipcardsEAltBack').val(p.altBk);
        $('#flipcardsETextDivBack').html(
            $exeDevice.decodeURIComponentSafe(p.eTextBk)
        );
        $('#flipcardsETextBack').val(
            $exeDevice.decodeURIComponentSafe(p.eTextBk)
        );
        $('#flipcardsEColorBack').val(p.colorBk);
        $('#flipcardsEBgColorBack').val(p.backcolorBk);
        $('#flipcardsEURLAudioBack').val(p.audioBk);

        $exeDevice.showImage(1);

        if (p.eTextBk.length > 0) {
            $('#flipcardsETextDivBack').show();
        } else {
            $('#flipcardsETextDivBack').hide();
        }

        $('#flipcardsETextDivBack').css({
            color: p.colorBk,
            'background-color': $exeDevice.hexToRgba(p.backcolorBk, 0.7),
        });
        $('#flipcardsENumberCard').val($exeDevice.active + 1);
        $('#flipcardsENumCards').text($exeDevice.cardsGame.length);
    },

    decodeURIComponentSafe: function (s) {
        if (!s) return s;
        return decodeURIComponent(s).replace('&percnt;', '%');
    },

    encodeURIComponentSafe: function (s) {
        if (!s) return s;
        return encodeURIComponent(s.replace('%', '&percnt;'));
    },

    validateCard: function () {
        const msgs = $exeDevice.msgs,
            p = {};
        let message = '';

        p.url = $('#flipcardsEURLImage').val().trim();
        p.x = parseFloat($('#flipcardsEX').val());
        p.y = parseFloat($('#flipcardsEY').val());
        p.author = $('#flipcardsEAuthor').val();
        p.alt = $('#flipcardsEAlt').val();
        p.audio = $('#flipcardsEURLAudio').val();
        p.color = $('#flipcardsEColor').val();
        p.backcolor = $('#flipcardsEBgColor').val();
        p.eText = $exeDevice.encodeURIComponentSafe($('#flipcardsEText').val());
        p.urlBk = $('#flipcardsEURLImageBack').val().trim();
        p.xBk = parseFloat($('#flipcardsEXBack').val());
        p.yBk = parseFloat($('#flipcardsEYBack').val());
        p.authorBk = $('#flipcardsEAuthorBack').val();
        p.altBk = $('#flipcardsEAltBack').val();
        p.audioBk = $('#flipcardsEURLAudioBack').val();
        p.colorBk = $('#flipcardsEColorBack').val();
        p.backcolorBk = $('#flipcardsEBgColorBack').val();
        p.eTextBk = $exeDevice.encodeURIComponentSafe(
            $('#flipcardsETextBack').val()
        );

        if (p.eText.length == 0 && p.url.length == 0 && p.audio.length == 0) {
            message = msgs.msgCompleteData;
        }
        if (
            p.eTextBk.length == 0 &&
            p.urlBk.length == 0 &&
            p.audioBk.length == 0
        ) {
            message = msgs.msgCompleteDataBack;
        }
        if (message.length == 0) {
            $exeDevice.cardsGame[$exeDevice.active] = p;
            message = true;
        } else {
            $exeDevice.showMessage(message);
            message = false;
        }

        $exeDevice.stopSound();

        return message;
    },

    getID: function () {
        return Math.floor(Math.random() * Date.now());
    },

    enableForm: function () {
        $exeDevice.initCards();

        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
        $exeDevice.addEventCard();
    },

    updateCardsNumber: function () {
        const percentInput = parseInt(
            $exeDevice.removeTags($('#flipcardsEPercentajeCards').val())
        );
        if (isNaN(percentInput)) return;
        const percentaje = Math.min(Math.max(percentInput, 1), 100),
            totalWords = $exeDevice.cardsGame.length,
            num = Math.max(1, Math.round((percentaje * totalWords) / 100));

        $('#flipcardsENumeroPercentaje').text(`${num}/${totalWords}`);
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

    addEventCard: function () {
        const toggleElement = (selector) => $(selector).slideToggle(),
            updateDivText = (inputSelector, divSelector) => {
                const text = $(inputSelector).val().trim();
                $(divSelector)
                    .html(text)
                    .toggle(text.length > 0);
            },
            loadAndPlayAudio = (inputSelector) =>
                $exeDevice.loadAudio($(inputSelector).val());

        $('#flipcardsEAuthorAlt, #flipcardsEAuthorAltBack').hide();

        $('#flipcardsEURLImage').on('change', () => $exeDevice.loadImage(0));
        $('#flipcardsEURLImageBack').on('change', () =>
            $exeDevice.loadImage(1)
        );

        $('#flipcardsEPlayImage').on('click', (e) => {
            e.preventDefault();
            $exeDevice.loadImage(0);
        });
        $('#flipcardsEPlayImageBack').on('click', (e) => {
            e.preventDefault();
            $exeDevice.loadImage(1);
        });
        $('#flipcardsEURLAudio').on('change', function () {
            loadAndPlayAudio(this);
        });
        $('#flipcardsEURLAudioBack').on('change', function () {
            loadAndPlayAudio(this);
        });

        $('#flipcardsEPlayAudio').on('click', (e) => {
            e.preventDefault();
            loadAndPlayAudio('#flipcardsEURLAudio');
        });
        $('#flipcardsEPlayAudioBack').on('click', (e) => {
            e.preventDefault();
            loadAndPlayAudio('#flipcardsEURLAudioBack');
        });

        $('#flipcardsEShowMore').on('click', (e) => {
            e.preventDefault();
            toggleElement('#flipcardsEAuthorAlt');
        });
        $('#flipcardsEShowMoreBack').on('click', (e) => {
            e.preventDefault();
            toggleElement('#flipcardsEAuthorAltBack');
        });

        $('#flipcardsEText').on('keyup', () =>
            updateDivText('#flipcardsEText', '#flipcardsETextDiv')
        );
        $('#flipcardsETextBack').on('keyup', () =>
            updateDivText('#flipcardsETextBack', '#flipcardsETextDivBack')
        );

        $('#flipcardsEColor').on('change', function () {
            $('#flipcardsETextDiv').css('color', $(this).val());
        });
        $('#flipcardsEColorBack').on('change', function () {
            $('#flipcardsETextDivBack').css('color', $(this).val());
        });

        const updateBackgroundColor = (inputSelector, targetDiv) => {
            const color = $exeDevice.hexToRgba($(inputSelector).val(), 0.7);
            $(targetDiv).css('background-color', color);
        };
        $('#flipcardsEBgColor').on('change', function () {
            updateBackgroundColor(this, '#flipcardsETextDiv');
        });
        $('#flipcardsEBgColorBack').on('change', function () {
            updateBackgroundColor(this, '#flipcardsETextDivBack');
        });

        $('#flipcardsEImage').on('click', (e) =>
            $exeDevice.clickImage(e.pageX, e.pageY)
        );
        $('#flipcardsEImageBack').on('click', (e) =>
            $exeDevice.clickImageBack(e.pageX, e.pageY)
        );

        $('#flipcardsECursor').on('click', () => {
            $('#flipcardsECursor').hide();
            $('#flipcardsEX').val(0);
            $('#flipcardsEY').val(0);
        });
        $('#flipcardsECursorBack').on('click', () => {
            $('#flipcardsECursorBack').hide();
            $('#flipcardsEXBack').val(0);
            $('#flipcardsEYBack').val(0);
        });

        $('#flipcardsEURLImgCard').on('change', () =>
            $exeDevice.loadImageCard()
        );

        $('#flipcardEPlayCard').on('click', (e) => {
            e.preventDefault();
            $exeDevice.loadImageCard();
        });
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            const wrapper = $('<div></div>');
            wrapper.html(originalHTML);

            const json = $('.flipcards-DataGame', wrapper).text(),
                dataGame =
                    $exeDevices.iDevice.gamification.helpers.isJsonString(json),
                $imagesLink = $('.flipcards-LinkImages', wrapper),
                $audiosLink = $('.flipcards-LinkAudios', wrapper),
                $imagesLinkBack = $('.flipcards-LinkImagesBack', wrapper),
                $audiosLinkBack = $('.flipcards-LinkAudiosBack', wrapper),
                $imageBack = $('.flipcard-ImageBack', wrapper);

            dataGame.imgCard = '';
            if ($imageBack.length === 1) {
                dataGame.imgCard = $imageBack.attr('href') || '';
            }

            $imagesLink.each(function () {
                const iq = parseInt($(this).text());
                if (!isNaN(iq) && iq < dataGame.cardsGame.length) {
                    const flipcard = dataGame.cardsGame[iq];
                    flipcard.url = $(this).attr('href');
                    if (flipcard.url < 4) {
                        flipcard.url = '';
                    }
                }
            });

            $imagesLinkBack.each(function () {
                const iq = parseInt($(this).text());
                if (!isNaN(iq) && iq < dataGame.cardsGame.length) {
                    const flipcard = dataGame.cardsGame[iq];
                    flipcard.urlBk = $(this).attr('href');
                    if (flipcard.urlBk < 4) {
                        flipcard.urlBk = '';
                    }
                }
            });

            $audiosLink.each(function () {
                const iqa = parseInt($(this).text());
                if (!isNaN(iqa) && iqa < dataGame.cardsGame.length) {
                    const flipcard = dataGame.cardsGame[iqa];
                    flipcard.audio = $(this).attr('href');
                    if (flipcard.audio.length < 4) {
                        flipcard.audio = '';
                    }
                }
            });

            $audiosLinkBack.each(function () {
                const iqa = parseInt($(this).text());
                if (!isNaN(iqa) && iqa < dataGame.cardsGame.length) {
                    const flipcard = dataGame.cardsGame[iqa];
                    flipcard.audioBk = $(this).attr('href');
                    if (flipcard.audioBk.length < 4) {
                        flipcard.audioBk = '';
                    }
                }
            });

            $exeDevice.updateFieldGame(dataGame);

            const instructions = $('.flipcards-instructions', wrapper);
            if (instructions.length == 1)
                $('#eXeGameInstructions').val(instructions.html());

            const textAfter = $('.flipcards-extra-content', wrapper);
            if (textAfter.length == 1)
                $('#eXeIdeviceTextAfter').val(textAfter.html());

            $exeDevicesEdition.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs
            );
            $exeDevice.showCard(0);
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
        if (!$exeDevice.validateCard()) return;

        const dataGame = $exeDevice.validateData();

        if (!dataGame) return;

        const fields = this.ci18n,
            i18n = fields;

        for (let i in fields) {
            let fVal = $('#ci18n_' + i).val();
            if (fVal != '') i18n[i] = fVal;
        }

        dataGame.msgs = i18n;

        let json = JSON.stringify(dataGame),
            divContent = '';

        if (dataGame.instructions != '')
            divContent =
                '<div class="flipcards-instructions">' +
                dataGame.instructions +
                '</div>';

        const linksMedias = $exeDevice.createlinksIMedias(dataGame.cardsGame);
        let imgCard = $('#flipcardsEURLImgCard').val();
        if (imgCard.trim().length > 4) {
            imgCard = `<a href="${imgCard}" class="js-hidden flipcard-ImageBack" alt="Back" />Background</a>`;
        } else {
            imgCard = '';
        }
        let html = '<div class="flipcards-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html += divContent;
        html += '<div class="flipcards-DataGame js-hidden">' + json + '</div>';
        html += linksMedias;
        html += imgCard;

        const textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();
        if (textAfter != '') {
            html +=
                '<div class="flipcards-extra-content">' + textAfter + '</div>';
        }
        html +=
            '<div class="flipcards-bns js-hidden">' +
            $exeDevice.msgs.msgNoSuportBrowser +
            '</div>';
        html += '</div>';
        return html;
    },

    validateAlt: function () {
        const altImage = $('#flipcardsEAlt').val();

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

    createlinksIMedias: function (cardsGame) {
        let html = '';

        cardsGame.forEach((p, i) => {
            const mediaLinks = [
                { url: p.url, className: 'flipcards-LinkImages' },
                { url: p.urlBk, className: 'flipcards-LinkImagesBack' },
                { url: p.audio, className: 'flipcards-LinkAudios' },
                { url: p.audioBk, className: 'flipcards-LinkAudiosBack' },
            ];

            mediaLinks.forEach(({ url, className }) => {
                if (url && url.length > 0 && url.indexOf('http') !== 0) {
                    html += `<a href="${url}" class="js-hidden ${className}">${i}</a>`;
                }
            });
        });

        return html;
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    getIdeviceID: function () {
        const ideviceid =
            $('#flipcardsQEIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';

        return ideviceid;
    },

    validateData: function () {
        const clear = $exeDevice.removeTags,
            instructions = tinyMCE.get('eXeGameInstructions').getContent(),
            textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent(),
            randomCards = $('#flipcardsERandomCards').is(':checked'),
            showMinimize = $('#flipcardsEShowMinimize').is(':checked'),
            showSolution = $('#flipcardsEShowSolution').is(':checked'),
            timeShowSolution = parseInt(
                clear($('#flipcardsETimeShowSolution').val())
            ),
            itinerary =
                $exeDevicesEdition.iDevice.gamification.itinerary.getValues(),
            percentajeCards = parseInt(
                clear($('#flipcardsEPercentajeCards').val())
            ),
            author = $('#flipcardsEAuthory').val(),
            cardsGame = $exeDevice.cardsGame,
            scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues(),
            type = parseInt($('input[name=flctype]:checked').val()),
            time = parseInt($('#flipcardsETime').val()),
            evaluation = $('#flipcardsEEvaluation').is(':checked'),
            evaluationID = $('#flipcardsEEvaluationID').val(),
            id = $exeDevice.getIdeviceID(),
            imgCard = $('#flipcardsEURLImgCard').val();

        if (!itinerary) return false;

        if (evaluation && evaluationID.length < 5) {
            eXe.app.alert($exeDevice.msgs.msgIDLenght);
            return false;
        }
        return {
            typeGame: 'FlipCards',
            author: author,
            randomCards: randomCards,
            instructions: instructions,
            showMinimize: showMinimize,
            itinerary: itinerary,
            cardsGame: cardsGame,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted,
            textAfter: escape(textAfter),
            percentajeCards: percentajeCards,
            version: $exeDevice.version,
            type: type,
            showSolution: showSolution,
            timeShowSolution: timeShowSolution,
            time: time,
            evaluation: evaluation,
            evaluationID: evaluationID,
            imgCard: imgCard,
            id: id,
        };
    },

    showImage: function (type) {
        const $cursor =
                type == 0 ? $('#flipcardsECursor') : $('#flipcardsECursorBack'),
            $image =
                type == 0 ? $('#flipcardsEImage') : $('#flipcardsEImageBack'),
            $nimage =
                type == 0
                    ? $('#flipcardsENoImage')
                    : $('#flipcardsENoImageBack'),
            x =
                type == 0
                    ? $('#flipcardsEX').val()
                    : $('#flipcardsEXBack').val(),
            y =
                type == 0
                    ? $('#flipcardsEY').val()
                    : $('#flipcardsEYBack').val(),
            alt =
                type == 0
                    ? $('#flipcardsEAlt').val()
                    : $('#flipcardsEAltBack').val(),
            url =
                type == 0
                    ? $('#flipcardsEURLImage').val()
                    : $('#flipcardsEURLImageBack').val();

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

    showImageCard: function (url) {
        $image = $('#flipcardECard');
        $nimage = $('#flipcardENoCard');
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
        )
            $exeDevice.playerAudio.pause();
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
                'z-index': 5,
            });
            $(cursor).show();
        }
    },

    drawImage: function (image, mData) {
        $(image).css({
            position: 'absolute',
            left: mData.x + 'px',
            top: mData.y + 'px',
            width: mData.w + 'px',
            height: mData.h + 'px',
        });
    },

    getCardDefault: function () {
        return {
            id: '',
            type: 2,
            url: '',
            audio: '',
            x: 0,
            y: 0,
            author: '',
            alt: '',
            eText: '',
            color: '#000000',
            backcolor: '#ffffff',
            correct: 0,
            urlBk: '',
            audioBk: '',
            xBk: 0,
            yBk: 0,
            authorBk: '',
            altBk: '',
            eTextBk: '',
            colorBk: '#000000',
            backcolorBk: '#ffffff',
        };
    },

    addEvents: function () {
        $('#flipcardsEPasteC').hide();
        // Inicialización accesible de toggles
        const initToggle = function ($input) {
            const checked = $input.is(':checked');
            const $item = $input.closest('.toggle-item[role="switch"]');
            if ($item.length) $item.attr('aria-checked', checked);
            const targetSel = $input.data('target');
            if (targetSel) {
                const $target = $(targetSel);
                if ($target.length) {
                    if (checked) {
                        $target.css('display', 'flex');
                    } else {
                        $target.hide();
                    }
                }
            }
        };
        $('.toggle-input').each(function () {
            initToggle($(this));
        });
        $(document).on('change', '.toggle-input', function () {
            initToggle($(this));
        });
        $('#flipcardsEAddC').on('click', function (e) {
            e.preventDefault();
            if ($exeDevice.cardsGame.length > 200) {
                $exeDevice.showMessage(
                    $exeDevice.msgs.msgMaxCards.replace('%s', 200)
                );
                return;
            }
            $exeDevice.addCard(true);
        });

        $('#flipcardsEDeleteC').on('click', function (e) {
            e.preventDefault();
            $exeDevice.removeCard();
        });

        $('#flipcardsECopyC').on('click', function (e) {
            e.preventDefault();
            $exeDevice.copyCard();
        });

        $('#flipcardsECutC').on('click', function (e) {
            e.preventDefault();
            $exeDevice.cutCard();
        });

        $('#flipcardsEPasteC').on('click', function (e) {
            e.preventDefault();
            if ($exeDevice.cardsGame.length > 200) {
                $exeDevice.showMessage(
                    $exeDevice.msgs.msgMaxCards.replace('%s', 200)
                );
                return;
            }
            $exeDevice.pasteCard();
        });

        $('#flipcardsEFirstC').on('click', function (e) {
            e.preventDefault();
            $exeDevice.firstCard();
        });

        $('#flipcardsEPreviousC').on('click', function (e) {
            e.preventDefault();
            $exeDevice.previousCard();
        });

        $('#flipcardsENextC').on('click', function (e) {
            e.preventDefault();
            $exeDevice.nextCard();
        });

        $('#flipcardsELastC').on('click', function (e) {
            e.preventDefault();
            $exeDevice.lastCard();
        });

        $('#flipcardsEReverseFaces').on('click', function (e) {
            e.preventDefault();
            $exeDevice.reverseFaces();
        });

        $('#flipcardsEReverseCard').on('click', function (e) {
            e.preventDefault();
            $exeDevice.reverseCard();
        });

        if (
            window.File &&
            window.FileReader &&
            window.FileList &&
            window.Blob
        ) {
            $('#eXeGameExportImport .exe-field-instructions')
                .eq(0)
                .text(`${_('Supported formats')}: json, txt, xml(Moodle)`);
            $('#eXeGameExportImport').show();
            $('#eXeGameImportGame').attr('accept', '.txt, .json, .xml');
            $('#eXeGameImportGame').on('change', (e) => {
                const file = e.target.files[0];
                if (!file) {
                    eXe.app.alert(
                        _(
                            'Please select a text file (.txt), a JSON file (.json), or an XML(Moodle) file (.xml)'
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
                            'Please select a text file (.txt), a JSON file (.json), or an XML(Moodle) file (.xml) '
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

        $('#flipcardsEPercentajeCards').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 3);
            this.value = v;
            if (this.value > 0 && this.value < 101) {
                $exeDevice.updateCardsNumber();
            }
        });

        $('#flipcardsEPercentajeCards').on('focusout', function () {
            this.value = this.value.trim() == '' ? 100 : this.value;
            this.value = this.value > 100 ? 100 : this.value;
            this.value = this.value < 1 ? 1 : this.value;
            $exeDevice.updateCardsNumber();
        });

        $('#flipcardsEPercentajeCards').on('click', function () {
            $exeDevice.updateCardsNumber();
        });

        $('#flipcardsEURLAudioDefinition').on('change', function () {
            $exeDevice.loadAudio($(this).val());
        });

        $('#flipcardsENumberCard').keyup(function (e) {
            if (e.keyCode == 13) {
                const num = parseInt($(this).val());
                if (!isNaN(num) && num > 0) {
                    if (!$exeDevice.validateCard()) {
                        $(this).val($exeDevice.active + 1);
                    } else {
                        $exeDevice.active =
                            num < $exeDevice.cardsGame.length
                                ? num - 1
                                : $exeDevice.cardsGame.length - 1;
                        $exeDevice.showCard($exeDevice.active);
                    }
                } else {
                    $(this).val($exeDevice.active + 1);
                }
            }
        });

        $('#flipcardsETime').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 1);
            this.value = v;
        });

        $('#flipcardsETime').on('focusout', function () {
            this.value = this.value.trim() == '' ? 0 : this.value;
            this.value = this.value > 59 ? 59 : this.value;
            this.value = this.value < 0 ? 0 : this.value;
        });

        $('#flipcardsEShowSolution').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#flipcardsETimeShowSolution').prop('disabled', !marcado);
        });

        $('#flipcardsETimeShowSolution').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 1);
            this.value = v;
        });

        $('#flipcardsETimeShowSolution').on('focusout', function () {
            this.value = this.value.trim() == '' ? 3 : this.value;
            this.value = this.value > 9 ? 9 : this.value;
            this.value = this.value < 1 ? 1 : this.value;
        });

        $('#flipcardsQEIdeviceForm').on(
            'click',
            'input.FLCRDS-Type',
            function () {
                const type = parseInt($(this).val());
                $('#flipcardsETimeDiv').hide();
                $('#flipcardBackDiv').hide();
                if (type == 3) {
                    $('#flipcardsETimeDiv').css('display', 'flex');
                    $('#flipcardBackDiv').show();
                }
            }
        );

        $('#flipcardsEEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#flipcardsEEvaluationID').prop('disabled', !marcado);
        });

        $('#flipcardsEEvaluationHelpLnk').click(function (e) {
            e.preventDefault();
            $('#flipcardsEEvaluationHelp').toggle();
            return false;
        });
        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();
        $exeDevicesEdition.iDevice.gamification.share.addEvents(
            0,
            $exeDevice.insertCards
        );

        $('.exe-block-dismissible .exe-block-close').click(function () {
            $(this).parent().fadeOut();
            return false;
        });
    },

    exportQuestions: function () {
        const dataGame = this.validateData();
        if (!dataGame) return false;

        const lines = this.getLinesQuestions(dataGame.cardsGame);
        const fileContent = lines.join('\n');
        const newBlob = new Blob([fileContent], { type: 'text/plain' });
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveOrOpenBlob(newBlob);
            return;
        }
        const data = window.URL.createObjectURL(newBlob);
        const link = document.createElement('a');
        link.href = data;
        link.download = `${_('Memory cards')}.txt`;

        document.getElementById('flipcardsQEIdeviceForm').appendChild(link);
        link.click();
        setTimeout(() => {
            document.getElementById('flipcardsQEIdeviceForm').removeChild(link);
            window.URL.revokeObjectURL(data);
        }, 100);
    },

    getLinesQuestions: function (cards) {
        let linequestions = [];
        for (let i = 0; i < cards.length; i++) {
            let c = cards[i];
            let card = `${c.eText}#${c.eTextBk}`;
            linequestions.push(card);
        }
        return linequestions;
    },

    swapProperties: function (card) {
        const props = [
            'url',
            'x',
            'y',
            'author',
            'alt',
            'eText',
            'color',
            'backcolor',
            'audio',
        ];
        props.forEach((prop) => {
            const temp = card[prop];
            card[prop] = card[`${prop}Bk`];
            card[`${prop}Bk`] = temp;
        });
    },

    reverseFaces: function () {
        if (!$exeDevice.validateCard()) return;
        $exeDevice.cardsGame.forEach((card) => $exeDevice.swapProperties(card));
        $exeDevice.showCard($exeDevice.active);
    },

    reverseCard: function () {
        if (!$exeDevice.validateCard()) return;
        const activeCard = $exeDevice.cardsGame[$exeDevice.active];
        $exeDevice.swapProperties(activeCard);
        $exeDevice.showCard($exeDevice.active);
    },

    nextCard: function () {
        if (
            $exeDevice.validateCard() &&
            $exeDevice.active < $exeDevice.cardsGame.length - 1
        ) {
            $exeDevice.active++;
            $exeDevice.showCard($exeDevice.active);
        }
    },

    loadImage: function (type) {
        const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
            url =
                type == 0
                    ? $('#flipcardsEURLImage').val()
                    : $('#flipcardsEURLImageBack').val(),
            ext = url.split('.').pop().toLowerCase();

        if (url.indexOf('files') == 0 && validExt.indexOf(ext) == -1) {
            $exeDevice.showMessage(
                _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
            );
            return false;
        }
        $exeDevice.showImage(type);
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

    loadImageCard: function (type) {
        const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
            url = $('#flipcardsEURLImgCard').val(),
            ext = url.split('.').pop().toLowerCase();

        if (url.indexOf('files') == 0 && validExt.indexOf(ext) == -1) {
            $exeDevice.showMessage(
                _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
            );
            return false;
        }
        $exeDevice.showImageCard(url);
    },

    updateFieldGame: function (game) {
        $exeDevice.active = 0;
        $exeDevicesEdition.iDevice.gamification.itinerary.setValues(
            game.itinerary
        );
        game.evaluation =
            typeof game.evaluation != 'undefined' ? game.evaluation : false;
        game.evaluationID =
            typeof game.evaluationID != 'undefined' ? game.evaluationID : '';
        game.weighted =
            typeof game.weighted !== 'undefined' ? game.weighted : 100;
        $exeDevice.id = $exeDevice.getIdeviceID();

        game.imgCard = game.imgCard ?? '';

        $('#flipcardsEShowMinimize').prop('checked', game.showMinimize);
        $('#flipcardsEPercentajeCards').val(game.percentajeCards);
        $('#flipcardsEAuthory').val(game.author);
        $('#flipcardsERandomCards').prop('checked', game.randomCards);
        $('#flipcardsEShowSolution').prop('checked', game.showSolution);
        $('#flipcardsETimeShowSolution').val(game.timeShowSolution);
        $('#flipcardsETimeShowSolution').prop('disabled', !game.showSolution);
        $('#flipcardsETime').val(game.time);
        $("input.FLCRDS-Type[name='flctype'][value='" + game.type + "']").prop(
            'checked',
            true
        );
        $('#flipcardsETimeDiv').hide();
        $('#flipcardBackDiv').hide();
        $('#flipcardsEEvaluation').prop('checked', game.evaluation);
        $('#flipcardsEEvaluationID').val(game.evaluationID);
        $('#flipcardsEEvaluationID').prop('disabled', !game.evaluation);
        $('#flipcardsEURLImgCard').val(game.imgCard);
        $exeDevice.showImageCard(game.imgCard);
        if (game.type == 3) {
            $('#flipcardsETimeDiv').css('display', 'flex');
            $('#flipcardBackDiv').show();
        }

        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted
        );
        $exeDevice.cardsGame = game.cardsGame;
        $('#flipcardsENumCards').text($exeDevice.cardsGame.length);

        $exeDevice.updateCardsNumber();
    },

    importText: function (content) {
        const lines = content.split('\n');
        $exeDevice.insertCards(lines);
    },

    insertCards: function (lines) {
        const lineFormat = /^([^#]+)#([^#]+)(#([^#]+))?(#([^#]+))?$/;
        let cards = [];
        lines.forEach(function (line) {
            let p = $exeDevice.getCardDefault();
            if (lineFormat.test(line)) {
                const linarray = line.trim().split('#');
                p.eText = linarray[0];
                p.eTextBk = linarray[1];
                cards.push(p);
            }
        });
        $exeDevice.addCards(cards);
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

        let cardsjs = [];
        cardsJson
            .filter((card) => card)
            .map((card) => {
                const p = $exeDevice.getCardDefault();
                p.eTextBk = card.eTextBk;
                p.eText = card.eText;
                cardsjs.push(p);
                return p;
            });

        $exeDevice.addCards(cardsjs);
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
        let cardsjs = [];
        cardsJson
            .filter((card) => card)
            .map((card) => {
                const p = $exeDevice.getCardDefault();
                p.eTextBk = card.eTextBk;
                p.eText = card.eText;
                cardsjs.push(p);
                return p;
            });

        $exeDevice.addCards(cardsjs);
    },

    addCards: function (cards) {
        if (!cards || cards.length == 0) {
            eXe.app.alert(
                _('Sorry, there are no questions for this type of activity.')
            );
            return;
        }
        for (let i = 0; i < cards.length; i++) {
            let card = cards[i];
            if (card.eTextBk && card.eText) {
                $exeDevice.cardsGame.push(card);
            }
        }
        $exeDevice.postImportProcessing();
    },

    importGame(content, filetype) {
        const game =
            $exeDevices.iDevice.gamification.helpers.isJsonString(content);

        let cards = [];
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
        } else if (game && game.typeGame) {
            switch (game.typeGame) {
                case 'FlipCards':
                    return this.handleGame(game);
                case 'Rosco':
                    cards = $exeDevice.importRosco(game);
                    break;
                case 'QuExt':
                    cards = $exeDevice.importQuExt(game);
                    break;
                case 'Sopa':
                    cards = $exeDevice.importSopa(game);
                    break;
                case 'Adivina':
                    cards = $exeDevice.importAdivina(game);
                    break;
                default:
                    return $exeDevice.showMessage(
                        $exeDevice.msgs.msgESelectFile
                    );
            }
        } else {
            return $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
        }

        if (cards && cards.length > 0) {
            $exeDevice.cardsGame = cards;
        } else {
            $exeDevice.showMessage(_('Sorry, wrong file format'));
            return;
        }

        this.postImportProcessing();
    },

    handleGame(game) {
        $exeDevice.active = 0;
        game.id = $exeDevice.getIdeviceID();
        $exeDevice.updateFieldGame(game);

        const instructions = unescape(
                game.instructionsExe || game.instructions
            ),
            tAfter = unescape(game.textAfter || '');

        tinyMCE.get('eXeGameInstructions')
            ? tinyMCE.get('eXeGameInstructions').setContent(instructions)
            : $('#eXeGameInstructions').val(instructions);
        tinyMCE.get('eXeIdeviceTextAfter')
            ? tinyMCE.get('eXeIdeviceTextAfter').setContent(tAfter)
            : $('#eXeIdeviceTextAfter').val(tAfter);
        this.postImportProcessing();
    },

    postImportProcessing() {
        $exeDevice.active = 0;
        $exeDevice.showCard($exeDevice.active);
        $exeDevice.deleteEmptyQuestion();
        $exeDevice.updateCardsNumber();
        //$('.exe-form-tabs li:first-child a').click();
    },

    importRosco(data) {
        return this.importGameData(data.wordsGame, (cuestion) => ({
            eText: cuestion.definition,
            eTextBk: cuestion.word,
            url: cuestion.url,
            audio: cuestion.audio || '',
        }));
    },

    importSopa(data) {
        return this.importGameData(data.wordsGame, (cuestion) => ({
            eText: cuestion.definition,
            eTextBk: cuestion.word,
            url: cuestion.url,
            audio: cuestion.audio || '',
        }));
    },

    importQuExt(data) {
        return this.importGameData(data.questionsGame, (cuestion) => ({
            eText: cuestion.quextion,
            eTextBk: cuestion.options
                ? cuestion.options[cuestion.solution]
                : '',
            url: cuestion.url,
            audio: cuestion.audio || '',
        }));
    },

    importAdivina(data) {
        return this.importGameData(data.wordsGame, (cuestion) => ({
            eText: cuestion.word,
            eTextBk: cuestion.definition,
            url: cuestion.url,
            audio: cuestion.audio || '',
        }));
    },

    importGameData(data, mapFn) {
        data.forEach((item) => {
            const cardData = mapFn(item),
                p = Object.assign($exeDevice.getCardDefault(), cardData);
            if (p.eText || p.url || p.audio) {
                $exeDevice.cardsGame.push(p);
            }
        });
        return $exeDevice.cardsGame;
    },

    deleteEmptyQuestion: function () {
        const url = $('#flipcardsEURLImage').val().trim(),
            audio = $('#flipcardsEURLAudio').val().trim(),
            eText = $('#flipcardsEText').val().trim();
        if ($exeDevice.cardsGame.length > 1) {
            if (url.length == 0 && audio.length == 0 && eText.length == 0) {
                $exeDevice.removeCard();
            }
        }
    },

    validTime: function (time) {
        const reg = /^(?:(?:([01]?\d|2[0-3]):)?([0-5]?\d):)?([0-5]?\d)$/;
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

    clickImage: function (epx, epy) {
        const $cursor = $('#flipcardsECursor'),
            $image = $('#flipcardsEImage'),
            $x = $('#flipcardsEX'),
            $y = $('#flipcardsEY'),
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
            'z-index': 5,
        });
        $cursor.show();
    },

    clickImageBack: function (epx, epy) {
        const $cursor = $('#flipcardsECursorBack'),
            $image = $('#flipcardsEImageBack'),
            $x = $('#flipcardsEXBack'),
            $y = $('#flipcardsEYBack'),
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
            'z-index': 5,
        });
        $cursor.show();
    },

    removeTags: function (str) {
        const wrapper = $('<div></div>');
        wrapper.html(str);
        return wrapper.text();
    },
};
