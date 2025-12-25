/**
/**
 * Tarjetas de meoria Activity iDevice (edition code)
 * Version: 1
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narvaez Martinez
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */

var $exeDevice = {
    name: 'relate',
    title: _('Relate', 'relate'),
    msgs: {},
    classIdevice: 'relate',
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
    version: 2.0,
    id: false,
    checkAltImage: true,
    ci18n: {},

    init: function (element, previousData, path) {
        if (!element) return;
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
        );

        if (!$exeDevice.cardsGame.length)
            $exeDevice.cardsGame.push($exeDevice.getDefaultCard());

        $('#rclETextDiv, #rclETextDivBack').hide();
        this.active = 0;
    },

    refreshTranslations: function () {
        this.ci18n = {
            msgSubmit: c_('Submit'),
            msgClue: c_('Cool! The clue is:'),
            msgCodeAccess: c_('Access code'),
            msgPlayStart: c_('Click here to play'),
            msgScore: c_('Score'),
            msgErrors: c_('Errors'),
            msgHits: c_('Hits'),
            msgScore: c_('Score'),
            msgMinimize: c_('Minimize'),
            msgMaximize: c_('Maximize'),
            msgFullScreen: c_('Full Screen'),
            msgExitFullScreen: c_('Exit Full Screen'),
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
            msgNumQuestions: c_('Number of cards'),
            msgTryAgain: c_(
                'You need at least %s&percnt; of correct answers to get the information. Please try again.'
            ),
            msgEndGameM: c_('You finished the game. Your score is %s.'),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgTypeGame: c_('Relate'),
            msgCheck: c_('Check'),
            msgRestart: c_('Restart'),
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
        msgs.msgTitleAltImageWarning = _('Accessibility warning');
        msgs.msgAltImageWarning = _(
            'At least one image has no description, are you sure you want to continue without including it? Without it the image may not be accessible to some users with disabilities, or to those using a text browser, or browsing the Web with images turned off.'
        );
    },

    createForm: function () {
        const path = $exeDevice.idevicePath,
            html = `
        <div id="relateQIdeviceForm">
            <p class="exe-block-info exe-block-dismissible" style="position:relative">
                ${_('Create matching games with images, sounds and enriched texts.')} 
                <a href="https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe29/relaciona.html" hreflang="es" target="_blank">${_('Usage Instructions')}</a>
                <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
            </p>
            <div class="exe-form-tab" title="${_('General settings')}">
                ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Match each card with its pair.'))}
                <fieldset class="exe-fieldset exe-fieldset-closed">
                    <legend><a href="#">${_('Options')}</a></legend>
                    <div>
                        <div class="d-flex align-items-center flex-nowrap gap-2 mb-3">
                            <span>${_('Level')}:</span>
                            <span class="d-flex align-items-center gap-2 flex-nowrap">
                                <div class="form-check form-check-inline m-0">
                                    <input class="RLC-Type form-check-input" checked id="rclETypeShow" type="radio" name="flctype" value="0"/>
                                    <label for="rclETypeShow">${_('Essential')}</label>
                                </div>
                                <div class="form-check form-check-inline m-0">
                                    <input class="RLC-Type form-check-input" id="rclETypeNavigation" type="radio" name="flctype" value="1"/>
                                    <label for="rclETypeNavigation">${_('Medium')}</label>
                                </div>
                                <div class="form-check form-check-inline m-0">
                                    <input class="RLC-Type form-check-input" id="rclETypeIdentify" type="radio" name="flctype" value="2"/>
                                    <label for="rclETypeIdentify">${_('Advanced')}</label>
                                </div>
                            </span>
                        </div>
                        <div class="d-none align-items-center flex-nowrap gap-2 mb-3">
                            <div class="toggle-item">
                                <span class="toggle-control">
                                    <input type="checkbox" checked id="rclEShowSolution" class="toggle-input" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="rclEShowSolution">${_('Show solutions')}</label>
                            </div>
                            <label for="rclETimeShowSolution">${_('Show solution time (seconds)')}:</label>
                            <input type="number" class="form-control" name="rclETimeShowSolution" id="rclETimeShowSolution" value="3" min="1" max="9" />
                        </div>
                        <div id="rclETimeDiv" class="d-none align-items-center flex-nowrap gap-2 mb-3">
                            <label for="rclETime" class="mb-0">${_('Time (minutes)')}:</label>
                            <input type="number" class="form-control" name="rclETime" id="rclETime" value="3" min="0" max="59" />
                        </div>
                        <div class="toggle-item mb-3">
                            <span class="toggle-control">
                                <input type="checkbox" id="rclEShowMinimize" class="toggle-input" />
                                <span class="toggle-visual"></span>
                            </span>
                            <label class="toggle-label" for="rclEShowMinimize">${_('Show minimized.')}</label>
                        </div>
                        <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                            <label for="rclEPercentajeCards" class="mb-0">%${_('Cards')}:</label>
                            <input type="number" class="form-control" name="rclEPercentajeCards" id="rclEPercentajeCards" value="100" min="1" max="100" />
                            <span id="rclENumeroPercentaje">1/1</span>
                        </div>
                        <div class="d-none flex-nowrap align-items-center gap-2 mb-3">
                            <label for="rclEAuthory" class="mb-0">${_('Authorship')}:</label>
                            <input id="rclEAuthory" type="text" class="form-control" />
                        </div>
                        <div class="d-flex flex-nowrap align-items-center gap-2 mb-3">
                            <div class="toggle-item">
                                <span class="toggle-control">
                                    <input type="checkbox" id="rclEEvaluation" class="toggle-input" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="rclEEvaluation">${_('Progress report')}</label>
                            </div>
                            <div class="d-flex align-items-center flex-nowrap gap-2">
                                <label for="rclEEvaluationID" class="mb-0">${_('Identifier')}:</label>
                                <input type="text" class="form-control" id="rclEEvaluationID" disabled value="${eXeLearning.app.project.odeId || ''}"/>
                            </div>
                            <a href="#rclEEvaluationHelp" id="rclEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                <img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}"/>
                            </a>
                        </div>
                        <p id="rclEEvaluationHelp" class="RLC-TypeGameHelp exe-block-info">
                            ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                        </p>
                    </div>
                </fieldset>
                <fieldset class="exe-fieldset">
                    <legend><a href="#">${_('Pairs')}</a></legend>
                    <div class="RLC-EPanel" id="rclEPanel">
                        <div id="rclEArrowsDiv">
                            <div class="RLC-EPhrase" id="rclEPhrase">
                                <div class="RLC-EDatosCarta RLC-EFront" id="rclEDatosCarta">
                                    <div class="RLC-EMultimedia mt-2 mb-2">
                                        <div class="RLC-ECard">
                                            <img class="RLC-EHideRLC-EImage" id="rclEImage" src="${path}quextIEImage.png" alt="${_('No image')}" />
                                            <img class="RLC-ECursor" id="rclECursor" src="${path}quextIECursor.gif" alt="" />
                                            <img class="RLC-EHideRLC-NoImage" id="rclENoImage" src="${path}quextIEImage.png" alt="${_('No image')}" />
                                            <div class="RLC-ETextDiv" id="rclETextDiv"></div>
                                        </div>
                                    </div>
                                    <span id="rclETitleText">${_('Text')}</span>
                                    <div class="d-flex flex-nowrap align-items-center gap-2 mb-3" id="rclEInputText">
                                        <label class="sr-av">${_('Text')}</label>
                                        <input type="text" id="rclEText" class="form-control w-100  me-0" />
                                        <label id="rclELblColor">${_('Color')}: </label>
                                        <input id="rclEColor" type="color" class="form-control form-control-color" value="#000000">
                                        <label id="rclELblBgColor">${_('Background')}:</label>
                                        <input id="rclEBgColor" type="color" class="form-control form-control-color" value="#ffffff">
                                    </div>
                                    <span id="rclETitleImage">${_('Image')}</span>
                                    <div class="d-flex align-items-center gap-2 mb-3" id="rclEInputImage">
                                        <label class="sr-av" for="rclEURLImage">URL</label>
                                        <input type="text" id="rclEURLImage" class="exe-file-picker form-control me-0 w-100"/>
                                        <a href="#" id="rclEPlayImage" class="RLC-ENavigationButton" title="${_('Show')}">
                                            <img src="${path}quextIEPlay.png" alt="${_('Show')}" class="RLC-ENavigationButton " />
                                        </a>
                                        <a href="#" id="rclEShowMore" class="RLC-ENavigationButton RLC-EShowMore" title="${_('More')}">
                                            <img src="${path}quextEIMore.png" alt="${_('More')}" class="RLC-ENavigationButton " />
                                        </a>
                                    </div>
                                    <div class="RLC-ECoord d-none">
                                        <label for="rclEX">X:</label>
                                        <input id="rclEX" class="RLC-EX form-control" type="text" value="0" />
                                        <label for="rclEY">Y:</label>
                                        <input id="rclEY" class="RLC-EY form-control" type="text" value="0" />
                                    </div>
                                    <div class="d-flex align-items-center gap-2 mb-3 flex-nowrap" id="rclEAuthorAlt">
                                        <div class="d-flex w-50 flex-wrap align-items-center gap-2">
                                            <label class="mb-0">${_('Authorship')}</label>
                                            <input id="rclEAuthor" type="text" class="w-100 form-control" />
                                        </div>
                                        <div class="d-flex flex-wrap w-50 align-items-center gap-2">
                                            <label class="mb-0">${_('Alternative text')}</label>
                                            <input id="rclEAlt" type="text" class="w-100 form-control" />
                                        </div>
                                    </div>
                                    <span>${_('Audio')}</span>
                                    <div class="d-flex align-items-center gap-2 mb-2 flex-nowrap">
                                        <label class="sr-av" for="rclEURLAudio">URL</label>
                                        <input type="text" id="rclEURLAudio" class="exe-file-picker form-control me-0 w-100" />
                                        <a href="#" id="rclEPlayAudio" class="RLC-ENavigationButton" title="${_('Audio')}">
                                            <img src="${path}quextIEPlay.png" alt="Play" class="RLC-ENavigationButton " />
                                        </a>
                                    </div>
                                </div>
                                <div class="RLC-EDatosCarta RLC-EBack" id="rclEDatosCartaBack">
                                    <div class="RLC-EMultimedia mt-2 mb-2">
                                        <div class="RLC-ECard">
                                            <img class="RLC-EHideRLC-EImage" id="rclEImageBack" src="${path}quextIEImage.png" alt="${_('No image')}" />
                                            <img class="RLC-ECursor" id="rclECursorBack" src="${path}quextIECursor.gif" alt="" />
                                            <img class="RLC-EHideRLC-NoImage" id="rclENoImageBack" src="${path}quextIEImage.png" alt="${_('No image')}" />
                                            <div class="RLC-ETextDiv" id="rclETextDivBack"></div>
                                        </div>
                                    </div>
                                    <span id="rclETitleTextBack">${_('Text')}</span>
                                    <div class="d-flex flex-nowrap align-items-center gap-2 mb-3" id="rclEInputTextBack">
                                        <label class="sr-av">${_('Text')}</label>
                                        <input type="text" id="rclETextBack" class="w-100 form-control me-0" />
                                        <label id="rclELblColorBack">${_('Color')}: </label>
                                        <input id="rclEColorBack" type="color" class="form-control form-control-color" value="#000000">
                                        <label id="rclELblBgColorBack">${_('Background')}:</label>
                                        <input id="rclEBgColorBack" type="color" class="form-control form-control-color" value="#ffffff">
                                    </div>
                                    <span id="rclETitleImageBack">${_('Image')}</span>
                                    <div class="d-flex align-items-center gap-2 mb-3" id="rclEInputImageBack">
                                        <label class="sr-av" for="rclEURLImageBack">URL</label>
                                        <input type="text" id="rclEURLImageBack" class="exe-file-picker form-control me-0 w-100"/>
                                        <a href="#" id="rclEPlayImageBack" class="RLC-ENavigationButton" title="${_('Show')}">
                                            <img src="${path}quextIEPlay.png" alt="${_('Show')}" class="RLC-ENavigationButton " />
                                        </a>
                                        <a href="#" id="rclEShowMoreBack" class="RLC-ENavigationButton RLC-EShowMore" title="${_('More')}">
                                            <img src="${path}quextEIMore.png" alt="${_('More')}" class="RLC-ENavigationButton " />
                                        </a>
                                    </div>
                                    <div class="d-none flex-wrap align-items-center gap-2">
                                        <label for="rclEXBack">X:</label>
                                        <input id="rclEXBack" class="RLC-EX form-control" type="text" value="0" />
                                        <label for="rclEYBack">Y:</label>
                                        <input id="rclEYBack" class="RLC-EY form-control" type="text" value="0" />
                                    </div>
                                    <div class="d-none align-items-center gap-2 mb-3 flex-nowrap" id="rclEAuthorAltBack">
                                        <div class="d-flex w-50 flex-wrap align-items-center gap-2">
                                            <label class="mb-0">${_('Authorship')}</label>
                                            <input id="rclEAuthorBack" type="text" class="w-100 form-control" />
                                        </div>
                                        <div class="RLC-EInputAlt d-flex flex-wrap w-50 align-items-center gap-2">
                                            <label class="mb-0">${_('Alternative text')}</label>
                                            <input id="rclEAltBack" type="text" class="w-100 form-control" />
                                        </div>
                                    </div>
                                    <span>${_('Audio')}</span>
                                    <div class="RLC-EInputAudio d-flex align-items-center flex-nowrap gap-2 mb-2">
                                        <label class="sr-av" for="rclEURLAudioBack">URL</label>
                                        <input type="text" id="rclEURLAudioBack" class="exe-file-picker form-control me-0 w-100" />
                                        <a href="#" id="rclEPlayAudioBack" class="RLC-ENavigationButton" title="${_('Audio')}">
                                            <img src="${path}quextIEPlay.png" alt="Play" class="RLC-ENavigationButton " />
                                        </a>
                                    </div>
                                </div>
                            </div>
                            <div class="d-flex align-items-center justify-content-center flex-nowrap gap-2 mt-2">
                                <a href="#" id="rclEReverseCard" title="${_('Flip down the card')}">${_('Flip down the card')}</a>
                                <a href="#" id="rclEReverseFaces" title="${_('Flip down all the cards')}">${_('Flip down all the cards')}</a>
                            </div>
                        </div>
                        <div class="RLC-ENavigationButtons d-flex flex-nowrap gap-2">
                            <a href="#" id="rclEAddC" class="RLC-ENavigationButton" title="${_('Add question')}">
                                <img src="${path}quextIEAdd.png" alt="${_('Add question')}" class="RLC-ENavigationButton" />
                            </a>
                            <a href="#" id="rclEFirstC" class="RLC-ENavigationButton" title="${_('First question')}">
                                <img src="${path}quextIEFirst.png" alt="${_('First question')}" class="RLC-ENavigationButton" />
                            </a>
                            <a href="#" id="rclEPreviousC" class="RLC-ENavigationButton" title="${_('Previous question')}">
                                <img src="${path}quextIEPrev.png" alt="${_('Previous question')}" class="RLC-ENavigationButton" />
                            </a>
                            <label class="sr-av" for="rclENumberCard">${_('Question number:')}:</label>
                            <input type="text" class="RLC-NumberCard form-control" id="rclENumberCard" value="1"/>
                            <a href="#" id="rclENextC" class="RLC-ENavigationButton" title="${_('Next question')}">
                                <img src="${path}quextIENext.png" alt="${_('Next question')}" class="RLC-ENavigationButton" />
                            </a>
                            <a href="#" id="rclELastC" class="RLC-ENavigationButton" title="${_('Last question')}">
                                <img src="${path}quextIELast.png" alt="${_('Last question')}" class="RLC-ENavigationButton" />
                            </a>
                            <a href="#" id="rclEDeleteC" class="RLC-ENavigationButton" title="${_('Delete question')}">
                                <img src="${path}quextIEDelete.png" alt="${_('Delete question')}" class="RLC-ENavigationButton" />
                            </a>
                            <a href="#" id="rclECopyC" class="RLC-ENavigationButton" title="${_('Copy question')}">
                                <img src="${path}quextIECopy.png" alt="${_('Copy question')}" class="RLC-ENavigationButton" />
                            </a>
                            <a href="#" id="rclECutC" class="RLC-ENavigationButton" title="${_('Cut question')}">
                                <img src="${path}quextIECut.png" alt="${_('Cut question')}" class="RLC-ENavigationButton" />
                            </a>
                            <a href="#" id="rclEPasteC" class="RLC-ENavigationButton" title="${_('Paste question')}">
                                <img src="${path}quextIEPaste.png" alt="${_('Paste question')}" class="RLC-ENavigationButton" />
                            </a>
                        </div>
                        <div class="RLC-ENumCardDiv" id="rclENumCardsDiv">
                            <div class="RLC-ENumCardsIcon"><span class="sr-av">${_('Cards')}:</span></div>
                            <span class="RLC-ENumCards" id="rclENumCards">0</span>
                        </div>
                    </div>
                </fieldset>
                ${$exeDevice.getTextFieldset('after')}
            </div>

            ${$exeDevicesEdition.iDevice.gamification.itinerary.getTab()}
            ${$exeDevicesEdition.iDevice.gamification.scorm.getTab()}
            ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
            ${$exeDevicesEdition.iDevice.gamification.share.getTab(true, 0, true)}
            ${$exeDevicesEdition.iDevice.gamification.share.getTabIA(0)}
        </div>
    `;
        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('relateQIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();
        this.enableForm();
    },

    getTextFieldset: function (position) {
        if (
            typeof position != 'string' ||
            (position != 'after' && position != 'before')
        )
            return '';
        let tit = _('Content after'),
            id = 'After';
        if (position == 'before') {
            tit = _('Content before');
            id = 'Before';
        }
        return (
            "<fieldset class='exe-fieldset exe-feedback-fieldset exe-fieldset-closed'>\
                    <legend><a href='#'>" +
            tit +
            ' (' +
            _('Optional').toLowerCase() +
            ")</a></legend>\
                    <div>\
                        <p>\
                            <label for='eXeIdeviceText" +
            id +
            "' class='sr-av'>" +
            tit +
            ":</label>\
                            <textarea id='eXeIdeviceText" +
            id +
            "' class='exe-html-editor'\></textarea>\
                        </p>\
                    <div>\
				</fieldset>"
        );
    },

    clearCard: function () {
        const resetFields = [
            '#rclEURLImage',
            '#rclEX',
            '#rclEY',
            '#rclEAuthor',
            '#rclEAlt',
            '#rclEURLAudio',
            '#rclEText',
            '#rclETextDiv',
            '#rclEColor',
            '#rclEBgColor',
            '#rclEURLImageBack',
            '#rclEXBack',
            '#rclEYBack',
            '#rclEAuthorBack',
            '#rclEAltBack',
            '#rclEURLAudioBack',
            '#rclETextBack',
            '#rclETextDivBack',
            '#rclEColorBack',
            '#rclEBgColorBack',
        ];

        resetFields.forEach((selector, index) => {
            const defaultValue =
                selector.includes('Color') || selector.includes('BgColor')
                    ? selector.includes('BgColor')
                        ? '#ffffff'
                        : '#000000'
                    : '';
            $(selector).val(defaultValue);
        });

        $('#rclEX, #rclEY, #rclEXBack, #rclEYBack').val('0');
        $('#rclETextDiv, #rclETextDivBack')
            .hide()
            .css({
                'background-color': $exeDevice.hexToRgba('#ffffff', 0.7),
                color: '#000000',
            });

        $exeDevice.showImage(0);
        $exeDevice.showImage(1);
    },

    addCard: function () {
        if (!$exeDevice.validateCard()) return;
        let cards = $exeDevice.cardsGame;
        $exeDevice.clearCard();
        cards.push($exeDevice.getDefaultCard());
        $exeDevice.active = cards.length - 1;
        $('#rclEPasteC').hide();
        $('#rclENumCards').text(cards.length);
        $('#rclENumberCard').val(cards.length);
        $exeDevice.updateCardsNumber();
    },

    removeCard: function () {
        let cards = $exeDevice.cardsGame,
            active = $exeDevice.active;
        if (cards.length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneCard);
            return;
        }

        cards.splice(active, 1);
        if (active >= cards.length - 1) {
            active = cards.length - 1;
        }

        $('#rclENumberCard').val(active);
        $exeDevice.showCard(active);
        $exeDevice.active = active;

        $exeDevice.typeEdit = -1;
        $('#rclEPasteC').hide();
        $('#rclENumCards').text(cards.length);

        $exeDevice.updateCardsNumber();
    },

    copyCard: function () {
        if (!$exeDevice.validateCard()) return;

        $exeDevice.typeEdit = 0;
        $exeDevice.clipBoard = JSON.parse(
            JSON.stringify($exeDevice.cardsGame[$exeDevice.active])
        );

        $('#rclEPasteC').show();
    },

    cutCard: function () {
        if (!$exeDevice.validateCard()) return;

        $exeDevice.numberCutCuestion = $exeDevice.active;
        $exeDevice.typeEdit = 1;
        $('#rclEPasteC').show();
    },

    pasteCard: function () {
        let cards = $exeDevice.cardsGame,
            active = $exeDevice.active;

        if ($exeDevice.typeEdit == 0) {
            active++;
            cards.splice(active, 0, $exeDevice.clipBoard);
        } else if ($exeDevice.typeEdit == 1) {
            $('#rclEPasteC').hide();
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                cards,
                $exeDevice.numberCutCuestion,
                active
            );
            $('#rclENumCards').text(cards.length);
            $('#rclENumberCard').val(active + 1);

            $exeDevice.updateCardsNumber();
        }

        $exeDevice.active = active;
        $exeDevice.showCard(active);
    },

    nextCard: function () {
        if (!$exeDevice.validateCard()) return;
        if ($exeDevice.active < $exeDevice.cardsGame.length - 1) {
            $exeDevice.active++;
            $exeDevice.showCard($exeDevice.active);
        }
    },

    lastCard: function () {
        if (!$exeDevice.validateCard()) return;
        if ($exeDevice.active < $exeDevice.cardsGame.length - 1) {
            $exeDevice.active = $exeDevice.cardsGame.length - 1;
            $exeDevice.showCard($exeDevice.active);
        }
    },

    previousCard: function () {
        if (!$exeDevice.validateCard()) return;
        if ($exeDevice.active > 0) {
            $exeDevice.active--;
        }
        $exeDevice.showCard($exeDevice.active);
    },

    firstCard: function () {
        if (!$exeDevice.validateCard()) return;
        if ($exeDevice.active > 0) {
            $exeDevice.active = 0;
            $exeDevice.showCard($exeDevice.active);
        }
    },

    showCard: function (i) {
        let num = Math.max(0, Math.min(i, $exeDevice.cardsGame.length - 1)),
            p = $exeDevice.cardsGame[num];
        $exeDevice.stopSound();

        $('#rclEURLImage').val(p.url);
        $('#rclEURLImageBack').val(p.urlBk);

        $('#rclEX').val(p.x);
        $('#rclEXBack').val(p.xBk);

        $('#rclEY').val(p.y);
        $('#rclEYBack').val(p.yBk);

        $('#rclEAuthor').val(p.author);
        $('#rclEAuthorBack').val(p.authorBk);

        $('#rclEAlt').val(p.alt);
        $('#rclEAltBack').val(p.altBk);

        $('#rclEURLAudio').val(p.audio);
        $('#rclEURLAudioBack').val(p.audioBk);

        let eText = $exeDevice.decodeURIComponentSafe(p.eText),
            eTextBk = $exeDevice.decodeURIComponentSafe(p.eTextBk);

        $('#rclETextDiv')
            .html(eText)
            .toggle(!!eText)
            .css({
                color: p.color,
                'background-color': $exeDevice.hexToRgba(p.backcolor, 0.7),
            });

        $('#rclEText').val(eText);
        $('#rclEColor').val(p.color);
        $('#rclEBgColor').val(p.backcolor);

        $('#rclETextDivBack')
            .html(eTextBk)
            .toggle(!!eTextBk)
            .css({
                color: p.colorBk,
                'background-color': $exeDevice.hexToRgba(p.backcolorBk, 0.7),
            });

        $('#rclETextBack').val(eTextBk);
        $('#rclEColorBack').val(p.colorBk);
        $('#rclEBgColorBack').val(p.backcolorBk);

        $exeDevice.showImage(0);
        $exeDevice.showImage(1);

        $('#rclENumberCard').val($exeDevice.active + 1);
        $('#rclENumCards').text($exeDevice.cardsGame.length);
    },

    decodeURIComponentSafe: function (s) {
        return s ? decodeURIComponent(s).replace('&percnt;', '%') : s;
    },

    encodeURIComponentSafe: function (s) {
        return s ? encodeURIComponent(s.replace('%', '&percnt;')) : s;
    },

    validateCard: function () {
        const msgs = $exeDevice.msgs;
        let p = {
            url: $('#rclEURLImage').val().trim(),
            x: parseFloat($('#rclEX').val()),
            y: parseFloat($('#rclEY').val()),
            author: $('#rclEAuthor').val(),
            alt: $('#rclEAlt').val(),
            audio: $('#rclEURLAudio').val(),
            color: $('#rclEColor').val(),
            backcolor: $('#rclEBgColor').val(),
            eText: $exeDevice.encodeURIComponentSafe($('#rclEText').val()),
            urlBk: $('#rclEURLImageBack').val().trim(),
            xBk: parseFloat($('#rclEXBack').val()),
            yBk: parseFloat($('#rclEYBack').val()),
            authorBk: $('#rclEAuthorBack').val(),
            altBk: $('#rclEAltBack').val(),
            audioBk: $('#rclEURLAudioBack').val(),
            colorBk: $('#rclEColorBack').val(),
            backcolorBk: $('#rclEBgColorBack').val(),
            eTextBk: $exeDevice.encodeURIComponentSafe(
                $('#rclETextBack').val()
            ),
        };

        $exeDevice.stopSound();

        let message = '';
        if (!p.eText && !p.url && !p.audio) {
            message = msgs.msgCompleteData;
        }
        if (!p.eTextBk && !p.urlBk && !p.audioBk) {
            message = msgs.msgCompleteDataBack;
        }

        if (!message) {
            $exeDevice.cardsGame[$exeDevice.active] = p;
            return true;
        } else {
            $exeDevice.showMessage(message);
            return false;
        }
    },

    enableForm: function () {
        $exeDevice.initCards();

        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
        $exeDevice.addEventCard();
    },

    updateCardsNumber: function () {
        let percentaje = parseInt(
            $exeDevice.removeTags($('#rclEPercentajeCards').val())
        );
        if (isNaN(percentaje)) return;
        percentaje = Math.min(Math.max(percentaje, 1), 100);

        const cards = $exeDevice.cardsGame,
            totalQuestions = cards.length;

        let num = Math.max(Math.round((percentaje * totalQuestions) / 100), 1);

        $('#rclENumeroPercentaje').text(`${num}/${totalQuestions}`);
    },

    addEventCard: function () {
        $('#rclEAuthorAlt, #rclEAuthorAltBack')
            .removeClass('d-flex')
            .addClass('d-none');

        const loadAndPlayImage = (index) => $exeDevice.loadImage(index),
            loadAndPlayAudio = (selector) =>
                $exeDevice.loadAudio($(selector).val());

        $('#rclEURLImage').on('change', () => loadAndPlayImage(0));
        $('#rclEURLImageBack').on('change', () => loadAndPlayImage(1));

        $('#rclEPlayImage').on('click', (e) => {
            e.preventDefault();
            loadAndPlayImage(0);
        });
        $('#rclEPlayImageBack').on('click', (e) => {
            e.preventDefault();
            loadAndPlayImage(1);
        });

        $('#rclEURLAudio, #rclEURLAudioBack').on('change', function () {
            loadAndPlayAudio(this);
        });

        $('#rclEPlayAudio').on('click', (e) => {
            e.preventDefault();
            loadAndPlayAudio('#rclEURLAudio');
        });
        $('#rclEPlayAudioBack').on('click', (e) => {
            e.preventDefault();
            loadAndPlayAudio('#rclEURLAudioBack');
        });

        $('#rclEShowMore').on('click', (e) => {
            e.preventDefault();
            const $el = $('#rclEAuthorAlt');
            if ($el.hasClass('d-none'))
                $el.removeClass('d-none').addClass('d-flex');
            else $el.removeClass('d-flex').addClass('d-none');
        });

        $('#rclEShowMoreBack').on('click', (e) => {
            e.preventDefault();
            const $el = $('#rclEAuthorAltBack');
            if ($el.hasClass('d-none'))
                $el.removeClass('d-none').addClass('d-flex');
            else $el.removeClass('d-flex').addClass('d-none');
        });

        $('#rclEText, #rclETextBack').on('keyup', function () {
            const textDiv = $(this).is('#rclEText')
                ? '#rclETextDiv'
                : '#rclETextDivBack';
            $(textDiv)
                .html($(this).val())
                .toggle($(this).val().trim().length > 0);
        });

        $('#rclEColor, #rclEColorBack').on('change', function () {
            const textDiv = $(this).is('#rclEColor')
                ? '#rclETextDiv'
                : '#rclETextDivBack';
            $(textDiv).css('color', $(this).val());
        });

        $('#rclEBgColor, #rclEBgColorBack').on('change', function () {
            const textDiv = $(this).is('#rclEBgColor')
                    ? '#rclETextDiv'
                    : '#rclETextDivBack',
                bc = $exeDevice.hexToRgba($(this).val(), 0.7);
            $(textDiv).css('background-color', bc);
        });

        $('#rclEImage').on('click', (e) =>
            $exeDevice.clickImage(e.pageX, e.pageY)
        );

        $('#rclECursor').on('click', function () {
            $(this).hide();
            $('#rclEX, #rclEY').val(0);
        });

        $('#rclEImageBack').on('click', (e) =>
            $exeDevice.clickImageBack(e.pageX, e.pageY)
        );

        $('#rclECursorBack').on('click', function () {
            $(this).hide();
            $('#rclEXBack, #rclEYBack').val(0);
        });
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

    getDefaultCard: function () {
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

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            const wrapper = $('<div></div>').html(originalHTML),
                json = $('.relaciona-DataGame', wrapper).text(),
                dataGame =
                    $exeDevices.iDevice.gamification.helpers.isJsonString(json),
                cards = dataGame.cardsGame,
                $imagesLink = $('.relaciona-LinkImages', wrapper),
                $audiosLink = $('.relaciona-LinkAudios', wrapper),
                $imagesLinkBack = $('.relaciona-LinkImagesBack', wrapper),
                $audiosLinkBack = $('.relaciona-LinkAudiosBack', wrapper);

            $imagesLink.each(function () {
                const iq = parseInt($(this).text());
                if (!isNaN(iq) && iq < cards.length) {
                    const flipcard = cards[iq];
                    flipcard.url =
                        $(this).attr('href').length < 4
                            ? ''
                            : $(this).attr('href');
                }
            });

            $imagesLinkBack.each(function () {
                const iq = parseInt($(this).text());
                if (!isNaN(iq) && iq < cards.length) {
                    const flipcard = cards[iq];
                    flipcard.urlBk =
                        $(this).attr('href').length < 4
                            ? ''
                            : $(this).attr('href');
                }
            });

            $audiosLink.each(function () {
                const iqa = parseInt($(this).text());
                if (!isNaN(iqa) && iqa < cards.length) {
                    const flipcard = cards[iqa];
                    flipcard.audio =
                        $(this).attr('href').length < 4
                            ? ''
                            : $(this).attr('href');
                }
            });

            $audiosLinkBack.each(function () {
                const iqa = parseInt($(this).text());
                if (!isNaN(iqa) && iqa < cards.length) {
                    const flipcard = cards[iqa];
                    flipcard.audioBk =
                        $(this).attr('href').length < 4
                            ? ''
                            : $(this).attr('href');
                }
            });
            $exeDevice.updateFieldGame(dataGame);

            let instructions = $('.relaciona-instructions', wrapper);
            if (instructions.length === 1) {
                instructions = instructions.html() || '';
                $('#eXeGameInstructions').val(instructions);
            }

            let textAfter = $('.relaciona-extra-content', wrapper);
            if (textAfter.length === 1) {
                textAfter = textAfter.html() || '';
                $('#eXeIdeviceTextAfter').val(textAfter);
            }

            $exeDevicesEdition.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs
            );
            $exeDevice.showCard(0);
        }
    },

    save: function () {
        if (!$exeDevice.validateCard()) return false;

        const dataGame = $exeDevice.validateData();

        if (!dataGame) return false;

        const i18n = { ...this.ci18n };

        Object.keys(this.ci18n).forEach((i) => {
            const fVal = $('#ci18n_' + i).val();
            if (fVal) i18n[i] = fVal;
        });

        dataGame.msgs = i18n;
        const json = JSON.stringify(dataGame);
        const cards = dataGame.cardsGame;

        let divContent = dataGame.instructions
            ? `<div class="relaciona-instructions gameQP-instructions">${dataGame.instructions}</div>`
            : '';
        const linksMedias = $exeDevice.createlinksIMedias(cards);
        let html = `<div class="relaciona-IDevice">${divContent}<div class="relaciona-DataGame js-hidden">${json}</div>`;
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html += linksMedias;
        const textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();
        if (textAfter)
            html += `<div class="relaciona-extra-content">${textAfter}</div>`;

        html += `<div class="relaciona-bns js-hidden">${$exeDevice.msgs.msgNoSuportBrowser}</div></div>`;

        return html;
    },

    validateAlt: function () {
        if (!$exeDevice.checkAltImage || $('#relacionaEAlt').val() !== '')
            return true;

        eXe.app.confirm(
            $exeDevice.msgs.msgTitleAltImageWarning,
            $exeDevice.msgs.msgAltImageWarning,
            () => {
                $exeDevice.checkAltImage = false;
                document
                    .getElementsByClassName('button-save-idevice')[0]
                    .click();
            }
        );
        return false;
    },

    createlinksIMedias: function (cardsGame) {
        return cardsGame
            .map((p, i) => {
                const properties = [
                    { prop: 'url', className: 'relaciona-LinkImages' },
                    { prop: 'urlBk', className: 'relaciona-LinkImagesBack' },
                    { prop: 'audio', className: 'relaciona-LinkAudios' },
                    { prop: 'audioBk', className: 'relaciona-LinkAudiosBack' },
                ];
                return properties
                    .map(({ prop, className }) => {
                        const val = p[prop];
                        if (val && val.indexOf('http') !== 0) {
                            return `<a href="${val}" class="js-hidden ${className}">${i}</a>`;
                        }
                        return '';
                    })
                    .join('');
            })
            .join('');
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    getIdeviceID: function () {
        const ideviceid =
            $('#relateQIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';
        return ideviceid;
    },

    validateData: function () {
        const clear = $exeDevice.removeTags,
            instructions = tinyMCE.get('eXeGameInstructions').getContent(),
            textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent(),
            showMinimize = $('#rclEShowMinimize').is(':checked'),
            showSolution = $('#rclEShowSolution').is(':checked'),
            timeShowSolution = parseInt(
                clear($('#rclETimeShowSolution').val())
            ),
            itinerary =
                $exeDevicesEdition.iDevice.gamification.itinerary.getValues(),
            percentajeCards = parseInt(clear($('#rclEPercentajeCards').val())),
            author = $('#rclEAuthory').val(),
            cardsGame = $exeDevice.cardsGame,
            scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues(),
            type = parseInt($('input[name=flctype]:checked').val()),
            time = parseInt($('#rclETime').val()),
            evaluation = $('#rclEEvaluation').is(':checked'),
            evaluationID = $('#rclEEvaluationID').val(),
            id = $exeDevice.getIdeviceID();

        if (!itinerary) return false;

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

        return {
            typeGame: 'Relaciona',
            author,
            randomCards: true,
            instructions,
            showMinimize,
            itinerary,
            cardsGame,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted || 100,
            textAfter: escape(textAfter),
            version: $exeDevice.version,
            percentajeCards,
            type,
            showSolution,
            timeShowSolution,
            time,
            evaluation,
            evaluationID,
            id,
        };
    },

    showImage: function (type) {
        const suffix = type == 0 ? '' : 'Back',
            $cursor = $(`#rclECursor${suffix}`),
            $image = $(`#rclEImage${suffix}`),
            $nimage = $(`#rclENoImage${suffix}`),
            x = $(`#rclEX${suffix}`).val(),
            y = $(`#rclEY${suffix}`).val(),
            alt = $(`#rclEAlt${suffix}`).val(),
            url = $(`#rclEURLImage${suffix}`).val();

        $image.hide();
        $cursor.hide();
        $image.attr('alt', alt);
        $nimage.show();

        $image
            .prop('src', url)
            .on('load', function () {
                if (
                    this.complete &&
                    typeof this.naturalWidth !== 'undefined' &&
                    this.naturalWidth !== 0
                ) {
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
                return false;
            })
            .on('error', function () {
                return false;
            });
    },

    playSound: function (selectedFile) {
        const selectFile =
            $exeDevices.iDevice.gamification.media.extractURLGD(selectedFile);
        $exeDevice.playerAudio = new Audio(selectFile);
        $exeDevice.playerAudio.addEventListener('canplaythrough', () => {
            $exeDevice.playerAudio.play();
        });
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
            const wI = $(image).width() || 1,
                hI = $(image).height() || 1,
                position = $(image).position(),
                lI = position.left + wI * x,
                tI = position.top + hI * y;
            $(cursor)
                .css({
                    left: `${lI}px`,
                    top: `${tI}px`,
                    'z-index': 50,
                })
                .show();
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
        $('#rclEPasteC').hide();

        const maxCards = 200;

        const checkMaxCards = (e) => {
            e.preventDefault();
            const numcards = $exeDevice.cardsGame.length;
            if (numcards.length > maxCards) {
                $exeDevice.showMessage(
                    $exeDevice.msgs.msgMaxCards.replace('%s', maxCards)
                );
                return true;
            }
            return false;
        };

        $('#rclEAddC').on('click', (e) => {
            if (!checkMaxCards(e)) {
                $exeDevice.addCard(true);
            }
        });

        $('#rclEDeleteC').on('click', (e) => {
            e.preventDefault();
            $exeDevice.removeCard();
        });

        $('#rclECopyC').on('click', (e) => {
            e.preventDefault();
            $exeDevice.copyCard();
        });

        $('#rclECutC').on('click', (e) => {
            e.preventDefault();
            $exeDevice.cutCard();
        });

        $('#rclEPasteC').on('click', (e) => {
            if (!checkMaxCards(e)) {
                $exeDevice.pasteCard();
            }
        });

        $('#rclEFirstC, #rclEPreviousC, #rclENextC, #rclELastC').on(
            'click',
            (e) => {
                e.preventDefault();
                const actions = {
                    rclEFirstC: 'firstCard',
                    rclEPreviousC: 'previousCard',
                    rclENextC: 'nextCard',
                    rclELastC: 'lastCard',
                };
                $exeDevice[actions[e.currentTarget.id]]();
            }
        );

        $('#rclEReverseFaces').on('click', (e) => {
            e.preventDefault();
            $exeDevice.reverseFaces();
        });

        $('#rclEReverseCard').on('click', (e) => {
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

        $('#rclEPercentajeCards')
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 3);
                this.value = v;
                if (this.value > 0 && this.value < 101) {
                    $exeDevice.updateCardsNumber();
                }
            })
            .on('focusout', function () {
                this.value = this.value.trim() === '' ? 100 : this.value;
                this.value = Math.max(1, Math.min(100, this.value));
                $exeDevice.updateCardsNumber();
            })
            .on('click', () => {
                $exeDevice.updateCardsNumber();
            });

        $('#rclEURLAudioDefinition').on('change', function () {
            $exeDevice.loadAudio($(this).val());
        });

        $('#rclENumberCard').keyup(function (e) {
            if (e.keyCode === 13) {
                const num = parseInt($(this).val(), 10);
                if (!isNaN(num) && num > 0) {
                    if ($exeDevice.validateCard() === false) {
                        $(this).val($exeDevice.active + 1);
                    }
                    $exeDevice.active =
                        num < $exeDevice.cardsGame.length
                            ? num - 1
                            : $exeDevice.cardsGame.length - 1;
                    $exeDevice.showCard($exeDevice.active);
                } else {
                    $(this).val($exeDevice.active + 1);
                }
            }
        });

        $('#rclETime')
            .on('keyup', function () {
                this.value = this.value.replace(/\D/g, '').substring(0, 2);
            })
            .on('focusout', function () {
                this.value = this.value.trim() === '' ? 0 : this.value;
                this.value = Math.max(0, Math.min(59, this.value));
            });

        $('#rclEShowSolution').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#rclETimeShowSolution').prop('disabled', !marcado);
        });

        $('#rclETimeShowSolution')
            .on('keyup', function () {
                this.value = this.value.replace(/\D/g, '').substring(0, 1);
            })
            .on('focusout', function () {
                this.value = this.value.trim() === '' ? 3 : this.value;
                this.value = Math.max(1, Math.min(9, this.value));
            });

        $('#relateQIdeviceForm').on('click', 'input.RLC-Type', function () {
            const type = parseInt($(this).val(), 10);
            $('#rclETimeDiv')
                .toggleClass('d-none', type !== 2)
                .toggleClass('d-flex', type === 2);
        });

        $('#rclEEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#rclEEvaluationID').prop('disabled', !marcado);
        });

        $('#rclEEvaluationHelpLnk').click(() => {
            $('#rclEEvaluationHelp').toggle();
            return false;
        });

        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();
        $exeDevicesEdition.iDevice.gamification.share.addEvents(
            0,
            $exeDevice.insertCards
        );

        //eXe 3.0 Dismissible messages
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
        link.download = `${_('Relate')}.txt`;

        document.getElementById('').appendChild(link);
        link.click();
        setTimeout(() => {
            document.getElementById('relateQIdeviceForm').removeChild(link);
            window.URL.revokeObjectURL(data);
        }, 100);
    },

    getLinesQuestions: function (cards) {
        let lineswords = [];
        for (let i = 0; i < cards.length; i++) {
            let card = `${$exeDevice.decodeURIComponentSafe(cards[i].eText)}#${$exeDevice.decodeURIComponentSafe(cards[i].eTextBk)}`;
            lineswords.push(card);
        }
        return lineswords;
    },

    reverseFaces: function () {
        if (!$exeDevice.validateCard()) return;

        const properties = [
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
        $exeDevice.cardsGame.forEach((p) => {
            properties.forEach((prop) => {
                const temp = p[prop];
                p[prop] = p[`${prop}Bk`];
                p[`${prop}Bk`] = temp;
            });
        });
        $exeDevice.showCard($exeDevice.active);
    },

    reverseCard: function () {
        if (!$exeDevice.validateCard()) return;

        const p = $exeDevice.cardsGame[$exeDevice.active],
            properties = [
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
        properties.forEach((prop) => {
            const temp = p[prop];
            p[prop] = p[`${prop}Bk`];
            p[`${prop}Bk`] = temp;
        });
        $exeDevice.showCard($exeDevice.active);
    },

    loadImage: function (type) {
        const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
            url =
                type === 0
                    ? $('#rclEURLImage').val()
                    : $('#rclEURLImageBack').val(),
            ext = url.split('.').pop().toLowerCase();

        if (url.length < 3) {
            return false;
        }
        if (url.startsWith('files') && !validExt.includes(ext)) {
            $exeDevice.showMessage(
                `${_('Supported formats')}: jpg, jpeg, gif, png, svg, webp`
            );
            return false;
        }
        $exeDevice.showImage(type);
    },

    loadAudio: function (url) {
        const validExt = ['mp3', 'ogg', 'waw'],
            ext = url.split('.').pop().toLowerCase();

        if (url.startsWith('files') && !validExt.includes(ext)) {
            $exeDevice.showMessage(`${_('Supported formats')}: mp3, ogg, waw`);
            return false;
        }

        if (url.length > 4) {
            $exeDevice.stopSound();
            $exeDevice.playSound(url);
        }
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

        $('#rclEShowMinimize').prop('checked', game.showMinimize);
        $('#rclEPercentajeCards').val(game.percentajeCards);
        $('#rclEAuthory').val(game.author);
        $('#rclEShowSolution').prop('checked', game.showSolution);
        $('#rclETimeShowSolution').val(game.timeShowSolution);
        $('#rclETimeShowSolution').prop('disabled', !game.showSolution);
        $('#rclETime').val(game.time);
        $("input.RLC-Type[name='flctype'][value='" + game.type + "']").prop(
            'checked',
            true
        );
        $('#rclETimeDiv').removeClass('d-flex').addClass('d-none');
        $('#rclEEvaluation').prop('checked', game.evaluation);
        $('#rclEEvaluationID').val(game.evaluationID);
        $('#rclEEvaluationID').prop('disabled', !game.evaluation);
        if (game.type == 2) {
            $('#rclETimeDiv').removeClass('d-none').addClass('d-flex');
        }

        $('#rclEArrowsDiv').hide();

        $exeDevice.cardsGame = game.cardsGame;

        $('#rclEArrowsDiv').show();

        $('#rclENumCards').text($exeDevice.cardsGame.length);
        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted
        );
        $exeDevice.updateCardsNumber();
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
        link.download = `${_('Activity')}-Relaciona.json`;
        document.getElementById('relateQIdeviceForm').appendChild(link);
        link.click();
        setTimeout(() => {
            document.getElementById('relateQIdeviceForm').removeChild(link);
            window.URL.revokeObjectURL(data);
        }, 100);
    },

    importMoodle: function (xmlString) {
        const xmlDoc = $.parseXML(xmlString),
            $xml = $(xmlDoc);
        if ($xml.find('GLOSSARY').length > 0) {
            return $exeDevice.importGlosary(xmlString);
        } else if ($xml.find('quiz').length > 0) {
            return $exeDevice.importCuestionaryXML(xmlString);
        } else {
            return false;
        }
    },

    importCuestionaryXML: function (xmlText) {
        const parser = new DOMParser(),
            xmlDoc = parser.parseFromString(xmlText, 'text/xml'),
            $xml = $(xmlDoc);

        if ($xml.find('parsererror').length > 0) return false;

        const $quiz = $xml.find('quiz').first();
        if ($quiz.length === 0) {
            return false;
        }

        const cardsJson = [];
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
            let eText = '',
                maxFraction = -1;
            $answers.each(function () {
                const $answer = $(this),
                    answerText = $answer.find('text').eq(0).text(),
                    currentFraction = parseInt($answer.attr('fraction'), 10);
                if (currentFraction > maxFraction) {
                    maxFraction = currentFraction;
                    eText = answerText;
                }
            });
            if (eText && questionText) {
                cardsJson.push({
                    eTextBk: $exeDevice.removeTags(questionText),
                    eText: $exeDevice.removeTags(eText),
                });
            }
        });

        const validQuestions = [];
        cardsJson.forEach((card) => {
            const p = $exeDevice.getDefaultCard();
            p.eTextBk = card.eTextBk;
            p.eText = card.eText;
            if (p.eText && p.eTextBk) {
                $exeDevice.cardsGame.push(p);
                validQuestions.push(p);
            }
        });
        return validQuestions.length > 0 ? $exeDevice.cardsGame : false;
    },

    importGlosary: function (xmlText) {
        const parser = new DOMParser(),
            xmlDoc = parser.parseFromString(xmlText, 'text/xml'),
            $xml = $(xmlDoc);

        if ($xml.find('parsererror').length > 0) return false;

        const $entries = $xml.find('ENTRIES').first();

        if ($entries.length === 0) return false;

        const cardsJson = [];
        $entries.find('ENTRY').each(function () {
            const $this = $(this),
                concept = $this.find('CONCEPT').text(),
                definition = $this
                    .find('DEFINITION')
                    .text()
                    .replace(/<[^>]*>/g, ''); // Elimina HTML
            if (concept && definition) {
                cardsJson.push({
                    eText: concept,
                    eTextBk: definition,
                });
            }
        });

        let valids = 0;
        cardsJson.forEach((card) => {
            const p = $exeDevice.getDefaultCard();
            p.eTextBk = card.eTextBk;
            p.eText = card.eText;
            if (p.eText && p.eTextBk) {
                $exeDevice.cardsGame.push(p);
                valids++;
            }
        });
        return valids > 0 ? $exeDevice.cardsGame : false;
    },

    importGame(content, filetype) {
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
        } else if (game && game.typeGame && game.typeGame == 'Relaciona') {
            return this.handleGame(game);
        } else {
            return $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
        }
    },

    importText: function (content) {
        const lines = content.split('\n');
        $exeDevice.insertCards(lines);
    },

    insertCards: function (lines) {
        const lineFormat = /^([^#]+)#([^#]+)(#([^#]+))?(#([^#]+))?$/;
        let cards = [];
        lines.forEach(function (line) {
            let p = $exeDevice.getDefaultCard();
            if (lineFormat.test(line)) {
                const linarray = line.trim().split('#');
                p.eText = linarray[0];
                p.eTextBk = linarray[1];
                cards.push(p);
            }
        });
        $exeDevice.addCards(cards);
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

    importCuestionaryXML: function (xmlText) {
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
                const et = {
                    eTextBk: $exeDevice.removeTags(
                        $question.find('questiontext').first().text().trim()
                    ),
                    eText: $exeDevice.removeTags(eText),
                };
                return eText ? et : null;
            })
            .get();

        let cardsjs = [];
        cardsJson
            .filter((card) => card)
            .map((card) => {
                const p = $exeDevice.getDefaultCard();
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
                const p = $exeDevice.getDefaultCard();
                p.eTextBk = card.eTextBk;
                p.eText = card.eText;
                cardsjs.push(p);
                return p;
            });

        $exeDevice.addCards(cardsjs);
    },

    postImportProcessing() {
        $exeDevice.active = 0;
        $exeDevice.showCard($exeDevice.active);
        $exeDevice.deleteEmptyQuestion();
        $exeDevice.updateCardsNumber();
        //$('.exe-form-tabs li:first-child a').click();
    },

    deleteEmptyQuestion: function () {
        let url = $('#rclEURLImage').val().trim(),
            audio = $('#rclEURLAudio').val().trim(),
            eText = $('#rclEText').val().trim();
        if ($exeDevice.cardsGame.length > 1) {
            if (url.length == 0 && audio.length == 0 && eText.length == 0) {
                $exeDevice.removeCard();
            }
        }
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
            hImage = Math.round(naturalHeight / varW);
            yImagen = Math.round((hDiv - hImage) / 2);
        } else {
            wImage = Math.round(naturalWidth / varH);
            xImagen = Math.round((wDiv - wImage) / 2);
        }

        return { w: wImage, h: hImage, x: xImagen, y: yImagen };
    },

    clickImage: function (epx, epy) {
        const $cursor = $('#rclECursor'),
            $image = $('#rclEImage'),
            $x = $('#rclEX'),
            $y = $('#rclEY'),
            posX = epx - $image.offset().left,
            posY = epy - $image.offset().top,
            wI = $image.width() || 1,
            hI = $image.height() || 1,
            lI = $image.position().left,
            tI = $image.position().top;

        $x.val(posX / wI);
        $y.val(posY / hI);
        $cursor
            .css({
                left: posX + lI,
                top: posY + tI,
                'z-index': 50,
            })
            .show();
    },

    clickImageBack: function (epx, epy) {
        const $cursor = $('#rclECursorBack'),
            $image = $('#rclEImageBack'),
            $x = $('#rclEXBack'),
            $y = $('#rclEYBack'),
            posX = epx - $image.offset().left,
            posY = epy - $image.offset().top,
            wI = $image.width() || 1,
            hI = $image.height() || 1,
            lI = $image.position().left,
            tI = $image.position().top;

        $x.val(posX / wI);
        $y.val(posY / hI);
        $cursor
            .css({
                left: posX + lI,
                top: posY + tI,
                'z-index': 50,
            })
            .show();
    },

    removeTags: function (str) {
        return $('<div>').html(str).text();
    },
};
