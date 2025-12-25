/**
/**
 * Tarjetas de meoria Activity iDevice (edition code)
 * Version: 1
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narvaez Martinez
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */

var $exeDevice = {
    name: 'beforeafter',
    title: _('Before/After'),
    msgs: {},
    classIdevice: 'beforeafter',
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
        if (!$exeDevice.cardsGame.length)
            $exeDevice.cardsGame.push($exeDevice.getDefaultCard());

        $('#bfafETextDiv, #bfafETextDivBack').hide();
        this.active = 0;
    },

    refreshTranslations: function () {
        this.ci18n = {
            msgSubmit: c_('Submit'),
            msgClue: c_('Cool! The clue is:'),
            msgCodeAccess: c_('Access code'),
            msgInformationLooking: c_(
                'Cool! The information you were looking for'
            ),
            msgMinimize: c_('Minimize'),
            msgMaximize: c_('Maximize'),
            msgFullScreen: c_('Full Screen'),
            msgExitFullScreen: c_('Exit Full Screen'),
            msgNoImage: c_('No picture question'),
            msgAuthor: c_('Authorship'),
            msgAfterImage: c_('After image'),
            msgBeforeImage: c_('Before image'),
            msgNext: c_('Next'),
            msgPrevious: c_('Previous'),
            msgImage: c_('Image'),
            msgScoreScorm: c_(
                "The score can't be saved because this page is not part of a SCORM package."
            ),
            msgQuestion: c_('Question'),
            msgOnlySaveScore: c_('You can only save the score once!'),
            msgOnlySave: c_('You can only save once'),
            msgInformation: c_('Information'),
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
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgTypeGame: c_('Before/After'),
            msgPlayStart: c_('Click here to play'),
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
        msgs.msgCompleteData = _('Provide an image');
        msgs.msgCompleteDataBack = _('Provide an image');
        msgs.msgDescription = _('Provide a description');
        msgs.msgEOneCard = _('Please create at least one card');
        msgs.msgTitleAltImageWarning = _('Accessibility warning');
        msgs.msgAltImageWarning = _(
            'At least one image has no description, are you sure you want to continue without including it? Without it the image may not be accessible to some users with disabilities, or to those using a text browser, or browsing the Web with images turned off.'
        );
        msgs.msgIDLenght = _(
            'The report identifier must have at least 5 characters'
        );
    },

    createForm: function () {
        const path = $exeDevice.idevicePath,
            html = `
            <div id="beforeAfterQIdeviceForm">
                <p class="exe-block-info exe-block-dismissible" style="position:relative">
                    ${_('Create before-and-after comparisons with side-by-side images of similar or proportional size.')} 
                    <a style="display:none;" href="https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe29/beforeafter-.html" hreflang="es" target="_blank">${_('Usage Instructions')}</a>
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Slide to reveal the differences between the images.'))}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_('Options')}</a></legend>
                        <div>                            
                            <div class="d-none align-items-center gap-2 flex-nowrap mb-3">
                                <label for="bfafEAuthory">${_('Authorship')}: </label>
                                <input id="bfafEAuthory" type="text" class="form-control" />
                            </div>
                            <div class="Games-Reportdiv d-flex align-items-center gap-2 mb-3 flex-wrap">
                                <span class="toggle-item mb-0" data-target="bfafEEvaluationIDWrapper" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" class="toggle-input" id="bfafEEvaluation" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="bfafEEvaluation">${_('Progress report')}.</label>
                                </span>
                                <span id="bfafEEvaluationIDWrapper" class="d-flex align-items-center gap-1">
                                    <label for="bfafEEvaluationID" class="mb-0">${_('Identifier')}:</label>
                                    <input type="text" id="bfafEEvaluationID" disabled class="form-control" value="${eXeLearning.app.project.odeId || ''}" />
                                </span>
                                <strong class="GameModeLabel"><a href="#bfafEEvaluationHelp" id="bfafEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}"><img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}"/></a></strong>
                            </div>
                            <p id="bfafEEvaluationHelp" class="BFAFE-TypeGameHelp exe-block-info">
                                ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                            </p>
                        </div>
                    </fieldset>
                    <fieldset class="exe-fieldset">
                        <legend><a href="#">${_('Images')}</a></legend>
                        <div class="BFAFE-EPanel" id="bfafEPanel">
                            <p class="exe-block-info">${_('Both images should have a similar or proportional size.')}</p>
                            <div id="bfafEArrowsDiv" >
                                <div class="BFAFE-Description d-flex align-items-center gap-2 mb-3">
                                    <label for="bfafEDescription">${_('Description')}:</label>
                                    <input id="bfafEDescription" type="text" class="form-control" />
                                </div>
                                <div class="mb-3">
                                    <span class="toggle-item" role="switch" aria-checked="false" >
                                        <span class="toggle-control">
                                            <input type="checkbox" class="toggle-input" id="bfafEVertical" />
                                            <span class="toggle-visual"></span>
                                        </span>
                                        <label class="toggle-label" for="bfafEVertical">${_('Vertical orientation')}.</label>
                                    </span>
                                </div>
                                <div class="d-flex align-items-center gap-2 flex-wrap mb-3">
                                    <label for="bfafEPosition">${_('Position')}:</label>
                                    <input type="number" name="bfafEPosition" id="bfafEPosition" value="50" min="0" max="100" step="2" class="form-control" />
                                </div>
                                <div class="BFAFE-EPhrase mb-2" id="bfafEPhrase">
                                     <div class="BFAFE-EDatosCarta BFAFE-EBack" id="bfafEDatosCartaBack">
                                        <div class="BFAFE-ETitleImage mb-3 mt-2">${_('Before')}</div>
                                        <div class="BFAFE-EMultimedia">
                                            <div class="BFAFE-ECard">
                                                <img class="BFAFE-EHideBFAFE-EImage" id="bfafEImageBack" src="${path}quextIEImage.png" alt="${_('No image')}" />
                                                <img class="BFAFE-EHideBFAFE-NoImage" id="bfafENoImageBack" src="${path}quextIEImage.png" alt="${_('No image')}" />
                                            </div>
                                        </div>
                                        <span id="bfafETitleImageBack">${_('Image')}</span>
                                        <div class="BFAFE-EInputImage gap-2 mb-3" id="bfafEInputImageBack">
                                            <label for="bfafEURLImageBack" class="sr-av">URL</label>
                                            <input type="text" id="bfafEURLImageBack" class="exe-file-picker BFAFE-EURLImage form-control me-0"/>
                                            <a href="#" id="bfafEPlayImageBack" class="BFAFE-ENavigationButton BFAFE-EPlayVideo" title="${_('Show')}">
                                                <img src="${path}quextIEPlay.png" alt="${_('Show')}" class="BFAFE-EButtonImage " />
                                            </a>
                                            <a href="#" id="bfafEShowMoreBack" class="BFAFE-ENavigationButton BFAFE-EShowMore" title="${_('More')}">
                                                <img src="${path}quextEIMore.png" alt="${_('More')}" class="BFAFE-EButtonImage " />
                                            </a>
                                        </div>
                                        <div class="BFAFE-EAuthorAlt" id="bfafEAuthorAltBack">
                                            <div class="BFAFE-EInputAuthor">
                                                <label for="bfafEAuthorBack">${_('Authorship')}</label>
                                                <input id="bfafEAuthorBack" type="text" class="BFAFE-EAuthor form-control" />
                                            </div>
                                            <div class="BFAFE-EInputAlt">
                                                <label  for="bfafEAltBack">${_('Alternative text')}</label>
                                                <input id="bfafEAltBack" type="text" class="BFAFE-EAlt form-control" />
                                            </div>
                                        </div>
                                        <span class="BFAFE-ETitleText" id="bfafETitleTextBack">${_('Title')}</span>
                                        <div class="BFAFE-EInputText" id="bfafEInputTextBack">
                                            <label class="sr-av">${_('Title')}</label>
                                            <input type="text" id="bfafETextBack" class="BFAFE-EText form-control" />
                                        </div>
                                    </div>
                                    <div class="BFAFE-EDatosCarta BFAFE-EFront" id="bfafEDatosCarta">
                                        <div class="BFAFE-ETitleImage mb-3 mt-2">${_('After')}</div>
                                        <div class="BFAFE-EMultimedia">
                                            <div class="BFAFE-ECard">
                                                <img class="BFAFE-EHideBFAFE-EImage" id="bfafEImage" src="${path}quextIEImage.png" alt="${_('No image')}" />
                                                <img class="BFAFE-EHideBFAFE-NoImage" id="bfafENoImage" src="${path}quextIEImage.png" alt="${_('No image')}" />
                                            </div>
                                        </div>
                                        <span id="bfafETitleImage">${_('Image')}</span>
                                        <div class="BFAFE-EInputImage gap-2 mb-3" id="bfafEInputImage">
                                            <label for="bfafEURLImage" class="sr-av">URL</label>
                                            <input type="text" id="bfafEURLImage" class="exe-file-picker BFAFE-EURLImage form-control me-0"/>
                                            <a href="#" id="bfafEPlayImage" class="BFAFE-ENavigationButton BFAFE-EPlayVideo" title="${_('Show')}">
                                                <img src="${path}quextIEPlay.png" alt="${_('Show')}" class="BFAFE-EButtonImage " />
                                            </a>
                                            <a href="#" id="bfafEShowMore" class="BFAFE-ENavigationButton BFAFE-EShowMore" title="${_('More')}">
                                                <img src="${path}quextEIMore.png" alt="${_('More')}" class="BFAFE-EButtonImage " />
                                            </a>
                                        </div>
                                         <div class="BFAFE-EAuthorAlt" id="bfafEAuthorAlt">
                                            <div class="BFAFE-EInputAuthor">
                                                <label for="bfafEAuthor">${_('Authorship')}</label>
                                                <input id="bfafEAuthor" type="text" class="BFAFE-EAuthor form-control" />
                                            </div>
                                            <div class="BFAFE-EInputAlt">
                                                <label for="bfafEAlt">${_('Alternative text')}</label>
                                                <input id="bfafEAlt" type="text" class="BFAFE-EAlt form-control" />
                                            </div>
                                        </div>
                                        <span class="BFAFE-ETitleText" id="bfafETitleText">${_('Title')}</span>
                                        <div class="BFAFE-EInputText" id="bfafEInputText">
                                            <label class="sr-av">${_('Title')}</label>
                                            <input type="text" id="bfafEText" class="BFAFE-EText form-control" />
                                        </div>
                                    </div>                                    
                                </div>
                                 <div class="BFAFE-EReverseFacces mt-3">
                                    <a href="#" id="bfafEReverseCard" title="${_('Flip down the card')}">${_('Flip down the card')}</a>
                                    <a href="#" id="bfafEReverseFaces" title="${_('Flip down all the cards')}">${_('Flip down all the cards')}</a>
                                </div>
                            </div>                        
                            <div class="BFAFE-ENavigationButtons gap-2">
                                <a href="#" id="bfafEAddC" class="BFAFE-ENavigationButton" title="${_('Add question')}">
                                    <img src="${path}quextIEAdd.png" alt="${_('Add question')}" class="BFAFE-EButtonImage" />
                                </a>
                               
                                <a href="#" id="bfafEFirstC" class="BFAFE-ENavigationButton" title="${_('First question')}">
                                    <img src="${path}quextIEFirst.png" alt="${_('First question')}" class="BFAFE-EButtonImage" />
                                </a>
                                <a href="#" id="bfafEPreviousC" class="BFAFE-ENavigationButton" title="${_('Previous question')}">
                                    <img src="${path}quextIEPrev.png" alt="${_('Previous question')}" class="BFAFE-EButtonImage" />
                                </a>
                                <label class="sr-av" for="bfafENumberCard">${_('Question number:')}:</label>
                                <input type="text" class="BFAFE-NumberCard form-control" id="bfafENumberCard" value="1"/>
                                <a href="#" id="bfafENextC" class="BFAFE-ENavigationButton" title="${_('Next question')}">
                                    <img src="${path}quextIENext.png" alt="${_('Next question')}" class="BFAFE-EButtonImage" />
                                </a>
                                <a href="#" id="bfafELastC" class="BFAFE-ENavigationButton" title="${_('Last question')}">
                                    <img src="${path}quextIELast.png" alt="${_('Last question')}" class="BFAFE-EButtonImage" />
                                </a>
                                <a href="#" id="bfafEDeleteC" class="BFAFE-ENavigationButton" title="${_('Delete question')}">
                                    <img src="${path}quextIEDelete.png" alt="${_('Delete question')}" class="BFAFE-EButtonImage" />
                                </a>
                                <a href="#" id="bfafECopyC" class="BFAFE-ENavigationButton" title="${_('Copy question')}">
                                    <img src="${path}quextIECopy.png" alt="${_('Copy question')}" class="BFAFE-EButtonImage" />
                                </a>
                                <a href="#" id="bfafECutC" class="BFAFE-ENavigationButton" title="${_('Cut question')}">
                                    <img src="${path}quextIECut.png" alt="${_('Cut question')}" class="BFAFE-EButtonImage" />
                                </a>
                                <a href="#" id="bfafEPasteC" class="BFAFE-ENavigationButton" title="${_('Paste question')}">
                                    <img src="${path}quextIEPaste.png" alt="${_('Paste question')}" class="BFAFE-EButtonImage" />
                                </a>
                            </div>
                            <div class="BFAFE-ENumCardDiv" id="bfafENumCardsDiv">
                                <div class="BFAFE-ENumCardsIcon"><span class="sr-av">${_('Cards')}:</span></div> 
                                <span class="BFAFE-ENumCards" id="bfafENumCards">0</span>
                            </div>
                        </div>
                    </fieldset>
                    ${$exeDevice.getTextFieldset('after')}
                </div>
                ${$exeDevicesEdition.iDevice.gamification.itinerary.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.scorm.getTab(true, true, true)}
                ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
            </div>
        `;
        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('beforeAfterQIdeviceForm');
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
        $(`#bfafEImage`).val('');
        $(`#bfafEURLImageBack`).val('');

        $('#bfafEAuthor').val('');
        $('#bfafEAuthorBack').val('');

        $('#bfafEAlt').val('');
        $('#bfafEAltBack').val('');

        $('#bfafEText').val('');
        $('#bfafETextBack').val('');
        $('#bfafEDescription').val('');
        $exeDevice.showImage(0);
        $exeDevice.showImage(1);
    },

    addCard: function () {
        if (!$exeDevice.validateCard()) return;
        let cards = $exeDevice.cardsGame;
        $exeDevice.clearCard();
        cards.push($exeDevice.getDefaultCard());
        $exeDevice.active = cards.length - 1;
        $('#bfafEPasteC').hide();
        $('#bfafENumCards').text(cards.length);
        $('#bfafENumberCard').val(cards.length);
        $exeDevice.showCard($exeDevice.active);
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

        $('#bfafENumberCard').val(active);
        $exeDevice.showCard(active);
        $exeDevice.active = active;

        $exeDevice.typeEdit = -1;
        $('#bfafEPasteC').hide();
        $('#bfafENumCards').text(cards.length);
    },

    copyCard: function () {
        if (!$exeDevice.validateCard()) return;

        $exeDevice.typeEdit = 0;
        $exeDevice.clipBoard = JSON.parse(
            JSON.stringify($exeDevice.cardsGame[$exeDevice.active])
        );

        $('#bfafEPasteC').show();
    },

    cutCard: function () {
        if (!$exeDevice.validateCard()) return;

        $exeDevice.numberCutCuestion = $exeDevice.active;
        $exeDevice.typeEdit = 1;
        $('#bfafEPasteC').show();
    },

    pasteCard: function () {
        let cards = $exeDevice.cardsGame,
            active = $exeDevice.active;

        if ($exeDevice.typeEdit == 0) {
            active++;
            cards.splice(active, 0, $exeDevice.clipBoard);
        } else if ($exeDevice.typeEdit == 1) {
            $('#bfafEPasteC').hide();
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                cards,
                $exeDevice.numberCutCuestion,
                active
            );
            $('#bfafENumCards').text(cards.length);
            $('#bfafENumberCard').val(active + 1);
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

        $('#bfafEURLImage').val(p.url);
        $('#bfafEURLImageBack').val(p.urlBk);

        $('#bfafENumberCard').val(num + 1);

        $('#bfafEAuthor').val(p.author);
        $('#bfafEAuthorBack').val(p.authorBk);

        $('#bfafEAlt').val(p.alt);
        $('#bfafEAltBack').val(p.altBk);

        $('#bfafEText').val(p.eText);
        $('#bfafETextBack').val(p.eTextBk);

        $('#bfafEDescription').val(p.description);
        $('#bfafEPosition').val(p.position);
        $('#bfafEVertical').prop('checked', p.vertical);
        $('#bfafEVertical')
            .closest('.toggle-item')
            .attr('aria-checked', !!p.vertical);

        $exeDevice.showImage(0);
        $exeDevice.showImage(1);
    },

    validateCard: function () {
        const msgs = $exeDevice.msgs;
        let p = {
            url: $('#bfafEURLImage').val().trim(),
            author: $('#bfafEAuthor').val(),
            alt: $('#bfafEAlt').val(),
            eText: $('#bfafEText').val(),
            urlBk: $('#bfafEURLImageBack').val().trim(),
            authorBk: $('#bfafEAuthorBack').val(),
            altBk: $('#bfafEAltBack').val(),
            eTextBk: $('#bfafETextBack').val(),
            description: $('#bfafEDescription').val(),
            position: $('#bfafEPosition').val(),
            vertical: $('#bfafEVertical').is(':checked'),
        };

        let message = '';
        p.position = p.position ?? 50;
        p.vertical = p.vertical ?? false;
        if (!p.url) {
            message = msgs.msgCompleteData;
        }
        if (!p.urlBk) {
            message = msgs.msgCompleteDataBack;
        }
        if (!p.description) {
            message = msgs.msgDescription;
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

    addEventCard: function () {
        $('#bfafEAuthorAlt, #bfafEAuthorAltBack').hide();

        const loadAndPlayImage = (index) => $exeDevice.loadImage(index);

        $('#bfafEURLImage').on('change', () => loadAndPlayImage(0));
        $('#bfafEURLImageBack').on('change', () => loadAndPlayImage(1));

        $('#bfafEPlayImage').on('click', (e) => {
            e.preventDefault();
            loadAndPlayImage(0);
        });
        $('#bfafEPlayImageBack').on('click', (e) => {
            e.preventDefault();
            loadAndPlayImage(1);
        });

        $('#bfafEShowMore').on('click', (e) => {
            e.preventDefault();
            $('#bfafEAuthorAlt').slideToggle();
        });
        $('#bfafEShowMoreBack').on('click', (e) => {
            e.preventDefault();
            $('#bfafEAuthorAltBack').slideToggle();
        });

        $('#bfafEText, #bfafETextBack').on('keyup', function () {
            const textDiv = $(this).is('#bfafEText')
                ? '#bfafETextDiv'
                : '#bfafETextDivBack';
            $(textDiv)
                .html($(this).val())
                .toggle($(this).val().trim().length > 0);
        });
    },

    getDefaultCard: function () {
        return {
            id: '',
            position: 50,
            vertical: false,
            url: '',
            author: '',
            alt: '',
            eText: '',
            urlBk: '',
            authorBk: '',
            altBk: '',
            eTextBk: '',
        };
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            const wrapper = $('<div></div>').html(originalHTML),
                json = $('.beforeafter-DataGame', wrapper).text(),
                dataGame =
                    $exeDevices.iDevice.gamification.helpers.isJsonString(json),
                cards = dataGame.cardsGame,
                $imagesLink = $('.beforeafter-LinkImages', wrapper),
                $imagesLinkBack = $('.beforeafter-LinkImagesBack', wrapper);

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

            $exeDevice.updateFieldGame(dataGame);

            let instructions = $('.beforeafter-instructions', wrapper);
            if (instructions.length === 1) {
                instructions = instructions.html() || '';
                $('#eXeGameInstructions').val(instructions);
            }

            let textAfter = $('.beforeafter-extra-content', wrapper);
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
            ? `<div class="beforeafter-instructions gameQP-instructions">${dataGame.instructions}</div>`
            : '';
        const linksMedias = $exeDevice.createlinksIMedias(cards);
        let html = `<div class="beforeafter-IDevice">${divContent}<div class="beforeafter-DataGame js-hidden">${json}</div>${linksMedias}`;
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        const textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();
        if (textAfter)
            html += `<div class="beforeafter-extra-content">${textAfter}</div>`;
        html += `<div class="beforeafter-bns js-hidden">${$exeDevice.msgs.msgNoSuportBrowser}</div></div>`;
        return html;
    },

    validateAlt: function () {
        if (!$exeDevice.checkAltImage || $('#beforeafter-EAlt').val() !== '')
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
                    { prop: 'url', className: 'beforeafter-LinkImages' },
                    { prop: 'urlBk', className: 'beforeafter-LinkImagesBack' },
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
            $('#beforeAfterQIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';
        return ideviceid;
    },

    validateData: function () {
        const clear = $exeDevice.removeTags,
            instructions = tinyMCE.get('eXeGameInstructions').getContent(),
            textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent(),
            author = $('#bfafEAuthory').val(),
            cardsGame = $exeDevice.cardsGame,
            id = $exeDevice.getIdeviceID(),
            itinerary =
                $exeDevicesEdition.iDevice.gamification.itinerary.getValues(),
            scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues(),
            evaluation = $('#bfafEEvaluation').is(':checked'),
            evaluationID = $('#bfafEEvaluationID').val();

        if (evaluation && evaluationID.length < 5) {
            eXe.app.alert($exeDevice.msgs.msgIDLenght);
            return false;
        }
        if (!itinerary) return;
        return {
            typeGame: 'BeforeAfter',
            author,
            instructions,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: true,
            itinerary,
            weighted: scorm.weighted ?? 100,
            cardsGame,
            textAfter: escape(textAfter),
            version: $exeDevice.version,
            evaluation,
            evaluationID,
            id,
        };
    },

    showImage: function (type) {
        const suffix = type == 0 ? '' : 'Back',
            $image = $(`#bfafEImage${suffix}`),
            $nimage = $(`#bfafENoImage${suffix}`),
            alt = $(`#bfafEAlt${suffix}`).val(),
            url = $(`#bfafEURLImage${suffix}`).val();

        $image.hide();
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
                    return true;
                }
                return false;
            })
            .on('error', function () {
                return false;
            });
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
        $('#bfafEPasteC').hide();

        $('#bfafEAddC').on('click', (e) => {
            $exeDevice.addCard(true);
        });

        $('#bfafEDeleteC').on('click', (e) => {
            e.preventDefault();
            $exeDevice.removeCard();
        });

        $('#bfafECopyC').on('click', (e) => {
            e.preventDefault();
            $exeDevice.copyCard();
        });

        $('#bfafECutC').on('click', (e) => {
            e.preventDefault();
            $exeDevice.cutCard();
        });

        $('#bfafEPasteC').on('click', (e) => {
            $exeDevice.pasteCard();
        });

        $('#bfafEFirstC, #bfafEPreviousC, #bfafENextC, #bfafELastC').on(
            'click',
            (e) => {
                e.preventDefault();
                const actions = {
                    bfafEFirstC: 'firstCard',
                    bfafEPreviousC: 'previousCard',
                    bfafENextC: 'nextCard',
                    bfafELastC: 'lastCard',
                };
                $exeDevice[actions[e.currentTarget.id]]();
            }
        );

        $('#bfafEReverseFaces').on('click', (e) => {
            e.preventDefault();
            $exeDevice.reverseFaces();
        });

        $('#bfafEReverseCard').on('click', (e) => {
            e.preventDefault();
            $exeDevice.reverseCard();
        });

        // Ayuda evaluación
        $('#bfafEEvaluationHelpLnk').on('click', function () {
            $('#bfafEEvaluationHelp').toggle();
            return false;
        });

        $('#beforeAfterQIdeviceForm').on(
            'change',
            '.toggle-input',
            function () {
                const $input = $(this);
                const checked = $input.is(':checked');
                const $item = $input.closest('.toggle-item');
                $item.attr('aria-checked', checked);
                const target = $item.data('target');
                if (target) {
                    const $targetEl = $('#' + target);
                    if ($targetEl.length) {
                        $targetEl.toggle(checked);
                    }
                }
                if (this.id === 'bfafEEvaluation') {
                    $('#bfafEEvaluationID').prop('disabled', !checked);
                } else if (this.id === 'bfafEVertical') {
                    if ($exeDevice.cardsGame[$exeDevice.active]) {
                        $exeDevice.cardsGame[$exeDevice.active].vertical =
                            checked;
                    }
                }
            }
        );

        (function initToggleStates() {
            const evalChecked = $('#bfafEEvaluation').is(':checked');
            $('#bfafEEvaluation')
                .closest('.toggle-item')
                .attr('aria-checked', evalChecked);
            $('#bfafEEvaluationIDWrapper').toggle(evalChecked);
            const vertChecked = $('#bfafEVertical').is(':checked');
            $('#bfafEVertical')
                .closest('.toggle-item')
                .attr('aria-checked', vertChecked);
        })();

        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();
        //eXe 3.0 Dismissible messages
        $('.exe-block-dismissible .exe-block-close').click(function () {
            $(this).parent().fadeOut();
            return false;
        });
    },

    reverseFaces: function () {
        if (!$exeDevice.validateCard()) return;

        const properties = ['url', 'author', 'alt', 'eText'];
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
            properties = ['url', 'author', 'alt', 'eText'];
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
                    ? $('#bfafEURLImage').val()
                    : $('#bfafEURLImageBack').val(),
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

    updateFieldGame: function (game) {
        $exeDevice.active = 0;
        $exeDevice.id = $exeDevice.getIdeviceID();
        $('#bfafEAuthory').val(game.author);
        game.evaluation =
            typeof game.evaluation !== 'undefined' ? game.evaluation : false;
        game.evaluationID =
            typeof game.evaluationID !== 'undefined' ? game.evaluationID : '';
        game.weighted =
            typeof game.weighted !== 'undefined' ? game.weighted : 100;
        game.position =
            typeof game.position !== 'undefined' ? parseInt(game.position) : 50;
        $exeDevice.cardsGame = game.cardsGame;
        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted
        );
        $('#bfafEEvaluation').prop('checked', game.evaluation);
        $('#bfafEEvaluationID').val(game.evaluationID);
        $('#bfafEEvaluationID').prop('disabled', !game.evaluation);
        $('#bfafEPosition').val(game.position);
        $exeDevicesEdition.iDevice.gamification.itinerary.setValues(
            game.itinerary
        );
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

    removeTags: function (str) {
        return $('<div>').html(str).text();
    },
};
