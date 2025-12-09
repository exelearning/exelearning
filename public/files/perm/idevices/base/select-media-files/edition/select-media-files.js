/* eslint-disable no-undef */
/**
 * SeleccionaMedias Activity iDevice (edition code)
 * Version: 1.5
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narvaez Martinez
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    i18n: {
        category: _('Assessment and tracking'),
        name: _('Select media files'),
    },
    msgs: {},
    classIdevice: 'select-media-files',
    active: 0,
    activeCard: 0,
    activeID: '',
    phrasesGame: [],
    phrase: {},
    typeEdit: -1,
    typeEditC: -1,
    idPaste: '',
    numberCutCuestion: -1,
    clipBoard: '',
    idevicePath: '',
    playerAudio: '',
    version: 1.5,
    id: false,
    accesibilityIsOk: true,
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
            mgsAllPhrases: c_('You completed all the activities!'),
            msgNumbersAttemps: c_('Number of activities to be completed'),
            msgActivities: c_('Activities'),
            msgCheck: c_('Check'),
            msgContinue: c_('Continue'),
            msgAllOK: c_('Brilliant! All correct!'),
            msgAgain: c_('Please try again'),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgChangeMode: c_('Change visualization mode'),
            msgTypeGame: c_('Select media files'),
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
        msgs.msgCompleteData = _(
            'You must indicate an image, a text or/and an audio for each card'
        );
        msgs.msgPairsMax = _('Maximum number of activities: 30');
        msgs.msgIDLenght = _(
            'The report identifier must have at least 5 characters'
        );
    },

    createForm: function () {
        const path = $exeDevice.idevicePath,
            html = `
            <div id="gameQEIdeviceForm">
                <p class="exe-block-info exe-block-dismissible">
                    ${_('Create interactive activities in which players will have to select the correct multimedia cards.')}
                    <a href="https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe29/selecciona_multimedia.html" hreflang="es" target="_blank">${_('Usage Instructions')}</a>
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Select the right cards'))}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_('Options')}</a></legend>
                        <div>
                            <div class="toggle-item mb-3">
                                <span class="toggle-control">
                                    <input type="checkbox" id="slcmEShowMinimize" class="toggle-input" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label mb-0" for="slcmEShowMinimize">${_('Show minimized.')}</label>
                            </div>
                            <div class="d-flex flex-nowrap align-items-center gap-2 mb-3">
                                <label for="slcmETime" class="mb-0">${_('Time to complete the game')}(m):</label>
                                <input type="number" name="slcmETime" id="slcmETime" value="0" min="0" max="120" step="1" class="form-control" />
                            </div>
                            <div class="d-flex flex-nowrap align-items-center gap-2 mb-3">
                                <label for="slcmEAttemptsNumber" class="mb-0">${_('Number of attempts')}:</label>
                                <input type="number" name="slcmEAttemptsNumber" id="slcmEAttemptsNumber" value="1" min="1" max="9" class="form-control" />
                            </div>
                            <div class="toggle-item mb-3">
                                <span class="toggle-control">
                                    <input type="checkbox" id="slcmEShowSolution" class="toggle-input" checked />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label mb-0" for="slcmEShowSolution">${_('Show solutions')}.</label>
                            </div>
                            <div id="slcmTimeShowDiv" class="d-flex flex-wrap align-items-center gap-2 mb-3">
                                <label for="slcmETimeShowSolution" class="mb-0">${_('Time while the cards will be shown (seconds)')}:</label>
                                <input type="number" name="slcmETimeShowSolution" id="slcmETimeShowSolution" value="4" min="1" max="999" class="form-control" />
                            </div>
                            <div class="d-flex flex-nowrap align-items-center gap-2 mb-3">
                                <label for="slcmEPercentajeQuestions" class="mb-0">${_('% Activities')}:</label>
                                <input type="number" name="slcmEPercentajeQuestions" id="slcmEPercentajeQuestions" value="100" min="1" max="100" class="form-control" />
                                <span id="slcmENumeroPercentaje">1/1</span>
                            </div>
                            <div id="slcmEANumberMaxDiv" class="d-flex flex-nowrap align-items-center gap-2 mb-3">
                                <label for="slcmEANumberMaxCard" class="mb-0">${_('Maximum number of cards')}:</label>
                                <input type="number" name="slcmEANumberMaxCard" id="slcmEANumberMaxCard" value="30" min="1" max="30" class="form-control" />
                            </div>
                            <div id="slcmECustomMessagesDiv" class="toggle-item mb-3">
                                <span class="toggle-control">
                                    <input type="checkbox" id="slcmECustomMessages" class="toggle-input" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label mb-0" for="slcmECustomMessages">${_('Custom messages')}.</label>
                            </div>
                            <div class="toggle-item mb-3">
                                <span class="toggle-control">
                                    <input type="checkbox" id="slcmEModeTable" class="toggle-input" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label mb-0" for="slcmEModeTable">${_('Table mode')}.</label>
                            </div>
                            <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                                <div class="toggle-item mb-0">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="slcmEHasFeedBack" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label mb-0" for="slcmEHasFeedBack">${_('Feedback')}.</label>
                                </div>
                                <div class="d-flex flex-nowrap align-items-center gap-2">
                                    <label for="slcmEPercentajeFB" class="mb-0"></label>
                                    <input type="number" name="slcmEPercentajeFB" id="slcmEPercentajeFB" value="100" min="5" max="100" step="5" class="form-control" disabled />
                                </div>
                            </div>
                            <div id="slcmEFeedbackP" class="SLCME-EFeedbackP mb-3">
                                <textarea id="slcmEFeedBackEditor" class="exe-html-editor"></textarea>
                            </div>
                            <div class="d-none flex-nowrap align-items-center gap-2 mb-3">
                                <label for="slcmEAuthor" class="mb-0">${_('Authorship')}:</label>
                                <input id="slcmEAuthor" type="text" class="form-control" />
                            </div>
                            <div class="d-flex flex-wrap align-items-center gap-2 mb-3 Games-Reportdiv">
                                <div class="toggle-item mb-0">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="slcmEEvaluation" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label mb-0" for="slcmEEvaluation">${_('Progress report')}.</label>
                                </div>
                                <div class="d-flex flex-nowrap align-items-center gap-2">
                                    <label for="slcmEEvaluationID" class="mb-0">${_('Identifier')}:</label>
                                    <input type="text" id="slcmEEvaluationID" disabled value="${eXeLearning.app.project.odeId || ''}" class="form-control" />
                                </div>
                                <a href="#slcmEEvaluationHelp" id="slcmEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                    <img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}" />
                                </a>
                            </div>
                            <p id="slcmEEvaluationHelp" class="SLCME-TypeGameHelp exe-block-info d-none">
                                ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                            </p>
                        </div>
                    </fieldset>
                    <fieldset class="exe-fieldset">
                        <legend><a href="#">${_('Activities')}</a></legend>
                        <div class="SLCME-EPanel" id="slcmEPanel">
                            <div class="SLCME-ENavigationButtons d-flex flex-wrap align-items-center justify-content-center gap-2 mb-3" id="slcmButtonsPrhaseDiv">
                                <a href="#" id="slcmEAdd" class="SLCME-ENavigationButton" title="${_('Add an activity')}"><img src="${path}quextIEAdd.png" alt="${_('Add an activity')}" class="SLCME-EButtonImage b-add" /></a>
                                <a href="#" id="slcmEFirst" class="SLCME-ENavigationButton" title="${_('First activity')}"><img src="${path}quextIEFirst.png" alt="${_('First activity')}" class="SLCME-EButtonImage b-first" /></a>
                                <a href="#" id="slcmEPrevious" class="SLCME-ENavigationButton" title="${_('Previous activity')}"><img src="${path}quextIEPrev.png" alt="${_('Previous activity')}" class="SLCME-EButtonImage b-prev" /></a>
                                <span class="sr-av">${_('Activity number:')}</span><span class="SLCME-NumberPhrase" id="slcmENumberPhrase">1</span>
                                <a href="#" id="slcmENext" class="SLCME-ENavigationButton" title="${_('Next activity')}"><img src="${path}quextIENext.png" alt="${_('Next activity')}" class="SLCME-EButtonImage b-next" /></a>
                                <a href="#" id="slcmELast" class="SLCME-ENavigationButton" title="${_('Last activity')}"><img src="${path}quextIELast.png" alt="${_('Last activity')}" class="SLCME-EButtonImage b-last" /></a>
                                <a href="#" id="slcmEDelete" class="SLCME-ENavigationButton" title="${_('Delete activity')}"><img src="${path}quextIEDelete.png" alt="${_('Delete activity')}" class="SLCME-EButtonImage b-delete" /></a>
                                <a href="#" id="slcmECopy" class="SLCME-ENavigationButton" title="${_('Copy activity')}"><img src="${path}quextIECopy.png" alt="${_('Copy activity')}" class="SLCME-EButtonImage b-copy" /></a>
                                <a href="#" id="slcmECut" class="SLCME-ENavigationButton" title="${_('Cut activity')}"><img src="${path}quextIECut.png" alt="${_('Cut activity')}" class="SLCME-EButtonImage b-cut" /></a>
                                <a href="#" id="slcmEPaste" class="SLCME-ENavigationButton" title="${_('Paste activity')}"><img src="${path}quextIEPaste.png" alt="${_('Paste activity')}" class="SLCME-EButtonImage b-paste" /></a>
                            </div>
                            <div class="d-flex flex-wrap align-items-center justify-content-center gap-2 mb-3" id="slcmActivityNumberDiv">${_('Activity')} <span id="slcmActivityNumber">1</span></div>
                            <div id="slcmEImageDefinitionDiv" class="d-none mb-3">
                                <div class="SLCME-EImageDefinition d-flex align-items-center justify-content-center">
                                    <img class="SLCME-EImageEnu" id="slcmEImageDefinition" src="${path}quextIEImagex.png" alt="${_('No image')}" />
                                </div>
                            </div>
                            <div class="d-flex flex-nowrap align-items-center gap-2 mb-3" id="slcmEDefinitionDiv">
                                <label for="slcmEDefinition" class="mb-0">${_('Statement')}:</label>
                                <input type="text" id="slcmEDefinition" class="form-control" />
                            </div>
                            <div class="mb-3">
                                <div class="d-flex flex-nowrap align-items-center gap-2 mb-3 SLCME-EDefinitioMedia">
                                    <label class="mb-0">${_('Image')}:</label>
                                    <input type="text" id="slcmEURLImageDefinition" class="exe-file-picker form-control me-0 w-100" />
                                    <a href="#" id="slcmEPlayImageDefinition" class="SLCME-ENavigationButton" title="${_('Image')}"><img src="${path}quextIEPlay.png" alt="Play audio" class="SLCME-EButtonImage" /></a>
                                    <a href="#" id="slcmEShowMoreDefinition" class="SLCME-ENavigationButton SLCME-EShowMore" title="${_('More')}"><img src="${path}quextEIMore.png" alt="${_('More')}" class="SLCME-EButtonImage" /></a>
                                </div>
                                <div id="slcmEDefinitionAltAuthor" class="d-none flex-nowrap align-items-center gap-2">
                                    <div class="d-flex flex-nowrap align-items-center gap-2 w-50">
                                        <label for="slcmEAuthorDefinition" class="mb-0">${_('Authorship')}:</label>
                                        <input id="slcmEAuthorDefinition" type="text" class="form-control w-100 me-0" />
                                    </div>
                                    <div class="d-flex flex-nowrap align-items-center gap-2 w-50">
                                        <label for="slcmEAltDefinition" class="mb-0">${_('Alt')}:</label>
                                        <input id="slcmEAltDefinition" type="text" class="form-control w-100 me-0" />
                                    </div>
                                </div>
                            </div>
                            <div class="SLCME-ECustomMessageAudio d-flex flex-nowrap align-items-center gap-2 mb-3">
                                <label class="mb-0">${_('Audio')}:</label>
                                <input type="text" id="slcmEURLAudioDefinition" class="exe-file-picker SLCME-EURLAudio form-control me-0 w-100" />
                                <a href="#" id="slcmEPlayAudioDefinition" class="SLCME-ENavigationButton" title="${_('Audio')}"><img src="${path}quextIEPlay.png" alt="Play audio" class="SLCME-EButtonImage" /></a>
                            </div>
                            <div class="SLCME-ECustomMessageDiv d-none flex-nowrap align-items-center gap-2 mb-3">
                                <label for="slcmEMessageOK" class="mb-0">${_('Success')}:</label>
                                <input type="text" id="slcmEMessageOK" class="form-control" />
                                <label class="mb-0">${_('Audio')}:</label>
                                <input type="text" id="slcmEURLAudioOK" class="exe-file-picker SLCME-EURLAudio form-control me-0 w-100" />
                                <a href="#" id="slcmEPlayAudioOK" class="SLCME-ENavigationButton" title="${_('Audio')}"><img src="${path}quextIEPlay.png" alt="Play audio" class="SLCME-EButtonImage" /></a>
                            </div>
                            <div class="SLCME-ECustomMessageDiv d-none flex-nowrap align-items-center gap-2 mb-3" >
                                <label for="slcmEMessageKO" class="mb-0">${_('Error')}:</label>
                                <input type="text" id="slcmEMessageKO" class="form-control" />
                                <label class="mb-0">${_('Audio')}:</label>
                                <input type="text" id="slcmEURLAudioKO" class="exe-file-picker SLCME-EURLAudio form-control me-0 w-100" />
                                <a href="#" id="slcmEPlayAudioKO" class="SLCME-ENavigationButton" title="${_('Audio')}"><img src="${path}quextIEPlay.png" alt="Play audio" class="SLCME-EButtonImage" /></a>
                            </div>
                            <div class="d-flex flex-wrap align-items-start justify-content-start mb-3 justify-content-start" id="slcmEPhrase"></div>
                            <div class="SLCME-EContents" id="slcmButtonCardDiv">
                                <div class="SLCME-ENavigationButtons d-flex flex-wrap align-items-center justify-content-center gap-2 mb-3">
                                    <a href="#" id="slcmEAddC" class="SLCME-ENavigationButton" title="${_('Add a card')}"><img src="${path}quextIEAdd.png" alt="${_('Add a card')}" class="SLCME-EButtonImage b-add" /></a>
                                    <a href="#" id="slcmEDeleteC" class="SLCME-ENavigationButton" title="${_('Delete card')}"><img src="${path}quextIEDelete.png" alt="${_('Delete card')}" class="SLCME-EButtonImage b-delete" /></a>
                                    <a href="#" id="slcmECopyC" class="SLCME-ENavigationButton" title="${_('Copy card')}"><img src="${path}quextIECopy.png" alt="${_('Copy card')}" class="SLCME-EButtonImage b-copy" /></a>
                                    <a href="#" id="slcmECutC" class="SLCME-ENavigationButton" title="${_('Cut card')}"><img src="${path}quextIECut.png" alt="${_('Cut card')}" class="SLCME-EButtonImage b-cut" /></a>
                                    <a href="#" id="slcmEPasteC" class="SLCME-ENavigationButton" title="${_('Paste card')}"><img src="${path}quextIEPaste.png" alt="${_('Paste card')}" class="SLCME-EButtonImage b-paste" /></a>
                                </div>
                            </div>
                            <div class="SLCME-ENumPhrasesDiv d-flex flex-nowrap align-items-center gap-2" id="slcmENumPhrasesDiv">
                                <div class="SLCME-ENumPhraseS"><span class="sr-av">${_('Phrases:')}</span></div><span class="SLCME-ENumPhrases" id="slcmENumPhrases">1</span>
                            </div>
                        </div>
                    </fieldset>
                     ${$exeDevicesEdition.iDevice.common.getTextFieldset('after')}
                </div>
                ${$exeDevicesEdition.iDevice.gamification.itinerary.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.scorm.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
            </div>
            `;

        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('gameQEIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();
        this.enableForm();
    },

    removeCard: function () {
        const numcards = $('#slcmEPhrase').find('div.SLCME-EDatosCarta').length;
        if (numcards < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
        } else {
            const next = $('#slcmEDatosCarta-' + $exeDevice.activeID)
                    .next('div.SLCME-EDatosCarta')
                    .data('id'),
                prev = $('#slcmEDatosCarta-' + $exeDevice.activeID)
                    .prev('div.SLCME-EDatosCarta')
                    .data('id');
            if (prev != null) {
                $('#slcmEDatosCarta-' + $exeDevice.activeID).remove();
                $exeDevice.activeID = prev;
            } else if (next != null) {
                $('#slcmEDatosCarta-' + $exeDevice.activeID).remove();
                $exeDevice.activeID = next;
            }
            $('.SLCME-EDatosCarta').removeClass('SLCME-EActive');
            $('#slcmEDatosCarta-' + $exeDevice.activeID).addClass(
                'SLCME-EActive'
            );
            $exeDevice.hideFlex($('#slcmEPasteC'));
        }
    },

    copyCard: function () {
        $exeDevice.typeEditC = 0;
        $exeDevice.idPaste = $exeDevice.activeID;
        $exeDevice.showFlex($('#slcmEPasteC'));
    },

    cutCard: function () {
        $exeDevice.typeEditC = 1;
        $exeDevice.idPaste = $exeDevice.activeID;
        $exeDevice.showFlex($('#slcmEPasteC'));
    },

    pasteCard: function () {
        if ($exeDevice.typeEditC == 0) {
            const $cardcopy = $('#slcmEDatosCarta-' + $exeDevice.idPaste),
                $cardactive = $('#slcmEDatosCarta-' + $exeDevice.activeID),
                dataCard = $exeDevice.cardToJson($cardcopy);

            dataCard.id = $exeDevice.getID();
            $cardactive.after($exeDevice.jsonToCard(dataCard, true));
            $exeDevice.activeID = dataCard.id;
        } else if ($exeDevice.typeEditC == 1) {
            $exeDevice.hideFlex($('#slcmEPasteC'));
            $exeDevice.typeEditC = -1;
            const $cardcopy = $('#slcmEDatosCarta-' + $exeDevice.idPaste),
                $cardactive = $('#slcmEDatosCarta-' + $exeDevice.activeID);
            if ($exeDevice.idPaste != $exeDevice.activeID) {
                $cardactive.after($cardcopy);
            }
        }
    },

    jsonToCard: function (p, inload) {
        const $card = $exeDevice.addCard(!inload);
        // Valores seguros (retrocompatibilidad con versiones antiguas sin color/fondo)
        const safe = {
            author: p?.author || '',
            alt: p?.alt || '',
            url: p?.url || '',
            audio: p?.audio || '',
            eText: p?.eText || '',
            color: p?.color || '#000000',
            backcolor: p?.backcolor || '#ffffff',
            state: !!p?.state,
        };

        $card.find('.SLCME-EAuthor').eq(0).val(safe.author);
        $card.find('.SLCME-EAlt').eq(0).val(safe.alt);
        $card.find('.SLCME-EURLImage').eq(0).val(safe.url);
        $card.find('.SLCME-EURLAudio').eq(0).val(safe.audio);
        $card.find('.SLCME-EText').eq(0).val(safe.eText);
        $card.find('.SLCME-ETextDiv').eq(0).text(safe.eText);
        $card.find('.SLCME-EColor').eq(0).val(safe.color);
        $card.find('.SLCME-EBackColor').eq(0).val(safe.backcolor);
        $card.find('.SLCME-EState').eq(0).prop('checked', safe.state);

        $exeDevice.showImage($exeDevice.activeID);
        if (safe.eText.trim().length > 0) {
            $exeDevice.showFlex($card.find('.SLCME-ETextDiv'));
        } else {
            $exeDevice.hideFlex($card.find('.SLCME-ETextDiv'));
        }

        $card
            .find('.SLCME-ETextDiv')
            .eq(0)
            .css({
                color: safe.color,
                'background-color': $exeDevice.hexToRgba(safe.backcolor, 0.7),
            });
        return $card;
    },

    getID: function () {
        return Math.floor(Math.random() * Date.now());
    },

    enableForm: function (field) {
        $exeDevice.initPhrases();

        $exeDevice.loadPreviousValues(field);
        $exeDevice.addEvents();
    },

    updateQuestionsNumber: function () {
        const percentInput = parseInt(
            $exeDevice.removeTags($('#slcmEPercentajeQuestions').val())
        );
        if (isNaN(percentInput)) return;
        const percentaje = Math.min(Math.max(percentInput, 1), 100),
            totalWords = $exeDevice.phrasesGame.length,
            num = Math.max(1, Math.round((percentaje * totalWords) / 100));

        $('#slcmENumeroPercentaje').text(`${num}/${totalWords}`);
    },

    showPhrase: function (i, inload) {
        let num = i < 0 ? 0 : i;

        $exeDevice.active =
            num >= $exeDevice.phrasesGame.length
                ? $exeDevice.phrasesGame.length - 1
                : num;

        const phrase = $exeDevice.phrasesGame[num];

        $exeDevice.clearPhrase();

        for (let k = 0; k < phrase.cards.length; k++) {
            const p = phrase.cards[k];
            $exeDevice.jsonToCard(p, inload);
        }

        $exeDevice.activeID = $('.SLCME-EDatosCarta').eq(0).data('id');

        $('.SLCME-EDatosCarta').removeClass('SLCME-EActive');
        $('.SLCME-EDatosCarta').eq(0).addClass('SLCME-EActive');
        $('#slcmEURLImageDefinition').val(phrase.url);
        $('#slcmEAltDefinition').val(phrase.alt);
        $('#slcmEAuthorDefinition').val(phrase.author);
        $('#slcmEImageDefinition').attr('src', phrase.url);
        $exeDevice.hideFlex($('#slcmEImageDefinitionDiv'));
        if (phrase.url.trim().length > 4)
            $('#slcmEImageDefinitionDiv')
                .removeClass('d-none')
                .addClass('d-flex');
        $('#slcmEMessageOK').val(phrase.msgHit);
        $('#slcmEMessageKO').val(phrase.msgError);
        $('#slcmEDefinition').val(phrase.definition);
        $('#slcmENumberPhrase').text($exeDevice.active + 1);
        $('#slcmActivityNumber').text($exeDevice.active + 1);
        $('#slcmEURLAudioDefinition').val(phrase.audioDefinition);
        $('#slcmEURLAudioOK').val(phrase.audioHit);
        $('#slcmEURLAudioKO').val(phrase.audioError);

        $exeDevice.stopSound();
    },

    initPhrases: function () {
        $exeDevice.active = 0;
        $exeDevice.phrasesGame.push($exeDevice.getPhraseDefault());
        $exeDevice.addCard(false);
        $('.SLCME-ECustomMessageDiv').removeClass('d-flex').addClass('d-none');
    },

    addCard: function (clone) {
        $exeDevice.activeID = $exeDevice.getID();
        $('#slcmEPhrase')
            .find('div.SLCME-EDatosCarta')
            .removeClass('SLCME-EActive');
        const path = $exeDevice.idevicePath,
            card = `
            <div class="SLCME-EDatosCarta SLCME-EActive" id="slcmEDatosCarta-${$exeDevice.activeID}" data-id="${$exeDevice.activeID}">
                <div class="SLCME-EMultimedia d-flex align-items-center justify-content-center mb-3 mt-2">
                    <div class="SLCME-ECard position-relative">
                        <img id="slcmEImage-${$exeDevice.activeID}" src="${path}quextIEImage.png" alt="${_('No image')}" />
                        <img class="SLCME-ECursor" id="slcmECursor-${$exeDevice.activeID}" src="${path}quextIECursor.gif" alt="" />
                        <img id="slcmENoImage-${$exeDevice.activeID}" src="${path}quextIEImage.png" alt="${_('No image')}" />
                        <div class="SLCME-ETextDiv d-none" id="slcmETextDiv-${$exeDevice.activeID}"></div>
                    </div>
                </div>
                <span class="SLCME-ETitleText" id="slcmETitleText-${$exeDevice.activeID}">${_('Text')}</span>
                <div class="d-flex flex-nowrap align-items-center gap-2 mb-3" id="slcmEInputText-${$exeDevice.activeID}">
                    <label class="sr-av">${_('Text')}</label>
                    <input type="text" id="slcmEText-${$exeDevice.activeID}" class="SLCME-EText form-control w-100 me-0" />
                    <label id="slcmELblColor-${$exeDevice.activeID}">${_('Color')}:</label>
                    <input id="slcmEColor-${$exeDevice.activeID}" type="color" class="SLCME-EColor form-control" value="#000000">
                    <label id="slcmELblBgColor-${$exeDevice.activeID}">${_('Background')}:</label>
                    <input id="slcmEBgColor-${$exeDevice.activeID}" type="color" class="SLCME-EBackColor form-control" value="#ffffff">
                </div>
                <span class="SLCME-ETitleImage" id="slcmETitleImage-${$exeDevice.activeID}">${_('Image')}</span>
                <div class="SLCME-EInputImage d-flex flex-nowrap align-items-center gap-2 mb-3" id="slcmEInputImage-${$exeDevice.activeID}">
                    <label class="sr-av">URL</label>
                    <input type="text" id="slcmEURLImage-${$exeDevice.activeID}" class="exe-file-picker SLCME-EURLImage form-control me-0 w-100" />
                    <a href="#" id="slcmEPlayImage-${$exeDevice.activeID}" class="SLCME-ENavigationButton" title="${_('Show')}">
                        <img src="${path}quextIEPlay.png" alt="${_('Show')}" class="SLCME-EButtonImage" />
                    </a>
                    <a href="#" id="slcmEShowMore-${$exeDevice.activeID}" class="SLCME-ENavigationButton SLCME-EShowMore" title="${_('More')}">
                        <img src="${path}quextEIMore.png" alt="${_('More')}" class="SLCME-EButtonImage" />
                    </a>
                </div>
        <div class="d-none flex-nowrap align-items-center gap-2 mb-3" id="slcmEAuthorAlt-${$exeDevice.activeID}">
                    <div class="d-flex w-50 flex-nowrap align-items-center gap-2">
                        <label>${_('Authorship')}</label>
            <input type="text" class="form-control me-0 w-100 SLCME-EAuthor" />
                    </div>
                    <div class="d-flex w-50 flex-nowrap align-items-center gap-2">
                        <label>${_('Alt')}</label>
            <input type="text" class="form-control me-0 w-100 SLCME-EAlt" />
                    </div>
                </div>
                <span>${_('Audio')}</span>
                <div class="SLCME-EInputAudio d-flex flex-nowrap align-items-center gap-2 mb-3">
                    <label class="sr-av">URL</label>
                    <input type="text" id="slcmEURLAudio-${$exeDevice.activeID}" class="exe-file-picker SLCME-EURLAudio form-control me-0 w-100" />
                    <a href="#" id="slcmEPlayAudio-${$exeDevice.activeID}" class="SLCME-ENavigationButton" title="${_('Audio')}">
                        <img src="${path}quextIEPlay.png" alt="Play" class="SLCME-EButtonImage" />
                    </a>
                </div>
                <div class="toggle-item mb-3">
                    <span class="toggle-control">
                        <input type="checkbox" id="slcmState-${$exeDevice.activeID}" class="SLCME-EState toggle-input" />
                        <span class="toggle-visual"></span>
                    </span>
                    <label class="toggle-label mb-0" for="slcmState-${$exeDevice.activeID}">${_('Correct answer')}:</label>
                </div>
            </div>`;
        $('#slcmEPhrase').append(card);
        if (clone) {
            $exeDevice.addPickerButton($exeDevice.activeID);
        }
        const $card = $('#slcmEPhrase').find('div.SLCME-EDatosCarta').last();
        $exeDevice.addEventCard($exeDevice.activeID);
        $exeDevice.showImage($exeDevice.activeID);
        return $card;
    },

    addPickerButton: function (cardId) {
        const $container = $('#slcmEDatosCarta-' + cardId);
        if (!$container.length) return;

        $container
            .find(
                '.exe-file-picker:not(.initialized), .exe-image-picker:not(.initialized)'
            )
            .each(function () {
                const $input = $(this);
                $input.addClass('initialized');
                const id = $input.attr('id'),
                    css = $input.hasClass('exe-image-picker')
                        ? 'exe-pick-image'
                        : 'exe-pick-any-file',
                    type = css === 'exe-pick-image' ? 'image' : 'media';

                let $fileInput = $('#' + `_browseFor${id}`);
                if (!$fileInput.length) {
                    $fileInput = $('<input>', {
                        id: `_browseFor${id}`,
                        type: 'file',
                        accept: type === 'image' ? 'image/*' : undefined,
                        style: 'display:none;', // Se oculta
                    }).on('change', function (event) {
                        $exeDevice.processFile(event.target.files[0], id, type);
                    });
                    $container.append($fileInput);
                }
                if (
                    !$container.find(
                        `input[type="button"][data-filepicker="${id}"]`
                    ).length
                ) {
                    const $button = $('<input>', {
                        type: 'button',
                        class: css,
                        value: _('Select a file'),
                        'data-filepicker': id,
                    }).on('click', function () {
                        $fileInput.trigger('click');
                    });
                    $input.after($button);
                }
            });
    },

    processFile: function (file, id, type) {
        try {
            this.addUploadImage(file, file.name, id, type);
        } catch (err) {
            console.error('Error processing file:', err);
        }
    },

    addUploadImage: async function (imageData, imageName, id) {
        let fd = new FormData();
        fd.append('file', imageData);
        fd.append('filename', imageName);
        fd.append('odeSessionId', eXeLearning.app.project.odeSession);

        this.lockScreen();
        let lockStartTime = Date.now();

        try {
            let response = await eXe.app.uploadLargeFile(fd);
            let loadTime = Date.now() - lockStartTime;

            if (response?.savedPath && response?.savedFilename) {
                let fileUrl = `${response.savedPath}/${response.savedFilename}`;
                let $fileContainerField = $(`#${id}`);

                if ($fileContainerField.length) {
                    $fileContainerField.val(fileUrl).trigger('change');
                }
            } else {
                eXe.app.alert(_(response?.code || 'Upload failed'));
            }

            this.unlockScreen(loadTime);
        } catch (err) {
            console.error('Upload failed:', err);
            this.unlockScreen();
        }
    },

    lockScreen: function () {
        let $loadScreen = $('#load-screen-node-content');
        $loadScreen
            .css({ zIndex: 9999, position: 'fixed', top: 0, left: 0 })
            .removeClass('hide hidden')
            .addClass('loading');
    },

    unlockScreen: function (delay = 1000) {
        delay = delay > 1000 ? 400 : 0;
        let $loadScreen = $('#load-screen-node-content');

        $loadScreen.removeClass('loading').addClass('hidding');
        setTimeout(() => {
            $loadScreen
                .addClass('hide hidden')
                .removeClass('hidding')
                .css({ zIndex: 990, position: 'absolute' })
                .removeAttr('top left');
        }, delay);
    },

    addEventCard: function (id) {
        $('#slcmEAuthorAlt-' + id)
            .removeClass('d-flex')
            .addClass('d-none');

        $('#slcmEURLImage-' + id).on('change', function () {
            $exeDevice.loadImage(id);
        });

        $('#slcmEPlayImage-' + id).on('click', function (e) {
            e.preventDefault();
            $exeDevice.loadImage(id);
        });

        $('#slcmEURLAudio-' + id).on('change', function () {
            $exeDevice.loadAudio($(this).val());
        });

        $('#slcmEPlayAudio-' + id).on('click', function (e) {
            e.preventDefault();
            const audio = $('#slcmEURLAudio-' + id).val();
            $exeDevice.loadAudio(audio);
        });

        $('#slcmEShowMore-' + id).on('click', function (e) {
            e.preventDefault();
            if ($('#slcmEAuthorAlt-' + id).hasClass('d-none')) {
                $('#slcmEAuthorAlt-' + id)
                    .removeClass('d-none')
                    .addClass('d-flex');
            } else {
                $('#slcmEAuthorAlt-' + id)
                    .removeClass('d-flex')
                    .addClass('d-none');
            }
        });

        $('#slcmEText-' + id).on('keyup', function () {
            $('#slcmETextDiv-' + id).text($(this).val());
            if ($(this).val().trim().length > 0) {
                $('#slcmETextDiv-' + $exeDevice.activeID)
                    .removeClass('d-flex')
                    .addClass('d-none');
            } else {
                $('#slcmETextDiv-' + $exeDevice.activeID)
                    .removeClass('d-none')
                    .addClass('d-flex');
            }
        });

        $('#slcmEColor-' + id).on('change', function () {
            $('#slcmETextDiv-' + id).css('color', $(this).val());
        });

        $('#slcmEBgColor-' + id).on('change', function () {
            const bc = $exeDevice.hexToRgba($(this).val(), 0.7);
            $('#slcmETextDiv-' + id).css({
                'background-color': bc,
            });
        });

        $('#slcmEImage-' + id).on('click', function (e) {
            $exeDevice.clickImage(id, e.pageX, e.pageY);
        });
    },
    cardToJson: function ($card) {
        return {
            id: $card.data('id'),
            type: 2,
            author: $card.find('.SLCME-EAuthor').eq(0).val(),
            alt: $card.find('.SLCME-EAlt').eq(0).val(),
            url: $card.find('.SLCME-EURLImage').eq(0).val(),
            audio: $card.find('.SLCME-EURLAudio').eq(0).val(),
            eText: $card.find('.SLCME-EText').eq(0).val(),
            color: $card.find('.SLCME-EColor').eq(0).val(),
            backcolor: $card.find('.SLCME-EBackColor').eq(0).val(),
            state: $card.find('.SLCME-EState').is(':checked'),
        };
    },

    validatePhrase: function () {
        let correct = true,
            phrase = $exeDevice.getPhraseDefault(),
            $cards = $('#slcmEPhrase').find('div.SLCME-EDatosCarta');

        $cards.each(function () {
            const card = $exeDevice.cardToJson($(this));
            if ($exeDevice.validateCard(card)) {
                correct = false;
            } else {
                phrase.cards.push(card);
            }
        });

        if (!correct) return false;

        phrase.url = $('#slcmEURLImageDefinition').val();
        phrase.alt = $('#slcmEAltDefinition').val();
        phrase.author = $('#slcmEAuthorDefinition').val();
        phrase.msgHit = $('#slcmEMessageOK').val();
        phrase.msgError = $('#slcmEMessageKO').val();
        phrase.definition = $('#slcmEDefinition').val();
        phrase.audioDefinition = $('#slcmEURLAudioDefinition').val();
        phrase.audioHit = $('#slcmEURLAudioOK').val();
        phrase.audioError = $('#slcmEURLAudioKO').val();
        $exeDevice.phrasesGame[$exeDevice.active] = phrase;

        return true;
    },

    validateCard: function (p) {
        if (p.eText.length == 0 && p.url.length < 5 && p.audio.length == 0) {
            const message = $exeDevice.msgs.msgCompleteData;
            $exeDevice.showMessage(message);
            return true;
        }
        return false;
    },

    hexToRgba: function (hex, opacity) {
        try {
            if (typeof hex !== 'string' || hex.trim() === '') hex = '#ffffff';
            hex = hex.trim();
            if (hex[0] !== '#') {
                if (/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex))
                    hex = '#' + hex;
                else hex = '#ffffff';
            }
            const raw = hex.replace('#', '');
            const parts = raw
                .match(new RegExp('(.{' + raw.length / 3 + '})', 'g'))
                .map(function (l) {
                    return parseInt(raw.length % 2 ? l + l : l, 16);
                });
            const alpha = isFinite(opacity) ? opacity : 1;
            return 'rgba(' + parts.concat(alpha).join(',') + ')';
        } catch (e) {
            return (
                'rgba(255,255,255,' + (isFinite(opacity) ? opacity : 1) + ')'
            );
        }
    },

    getPhraseDefault: function () {
        return {
            cards: [],
            msgError: '',
            msgHit: '',
            definition: '',
            audioDefinition: '',
            audioHit: '',
            audioError: '',
            url: '',
            alt: '',
            author: '',
        };
    },

    getCardDefault: function () {
        return {
            id: '',
            type: 2,
            url: '',
            audio: '',
            author: '',
            alt: '',
            eText: '',
            color: '#000000',
            backcolor: '#ffffff',
            state: false,
        };
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            const wrapper = $('<div></div>');
            wrapper.html(originalHTML);

            let json = $('.seleccionamedias-DataGame', wrapper).text();
            json = $exeDevices.iDevice.gamification.helpers.decrypt(json);

            const dataGame =
                    $exeDevices.iDevice.gamification.helpers.isJsonString(json),
                $audiosDef = $('.seleccionamedias-LinkAudiosDef', wrapper),
                $imagesDef = $('.seleccionamedias-LinkImagesDef', wrapper),
                $audiosError = $('.seleccionamedias-LinkAudiosError', wrapper),
                $audiosHit = $('.seleccionamedias-LinkAudiosHit', wrapper);

            for (let i = 0; i < dataGame.phrasesGame.length; i++) {
                const $imagesLink = $(
                        '.seleccionamedias-LinkImages-' + i,
                        wrapper
                    ),
                    $audiosLink = $(
                        '.seleccionamedias-LinkAudios-' + i,
                        wrapper
                    ),
                    cards = dataGame.phrasesGame[i].cards;

                $imagesLink.each(function () {
                    const iq = parseInt($(this).text());
                    if (!isNaN(iq) && iq < cards.length) {
                        cards[iq].url = $(this).attr('href');
                        if (cards[iq].url < 4) {
                            cards[iq].url = '';
                        }
                    }
                });

                $audiosLink.each(function () {
                    const iqa = parseInt($(this).text());
                    if (!isNaN(iqa) && iqa < cards.length) {
                        cards[iqa].audio = $(this).attr('href');
                        if (cards[iqa].audio.length < 4) {
                            cards[iqa].audio = '';
                        }
                    }
                });

                dataGame.phrasesGame[i].phrase =
                    typeof dataGame.phrasesGame[i].phrase == 'undefined'
                        ? ''
                        : dataGame.phrasesGame[i].phrase;
                dataGame.phrasesGame[i].url =
                    typeof dataGame.phrasesGame[i].url == 'undefined'
                        ? ''
                        : dataGame.phrasesGame[i].url;
                dataGame.phrasesGame[i].alt =
                    typeof dataGame.phrasesGame[i].alt == 'undefined'
                        ? ''
                        : dataGame.phrasesGame[i].alt;
                dataGame.phrasesGame[i].author =
                    typeof dataGame.phrasesGame[i].author == 'undefined'
                        ? ''
                        : dataGame.phrasesGame[i].author;
            }

            $imagesDef.each(function () {
                const iqb = parseInt($(this).text());
                if (!isNaN(iqb) && iqb < dataGame.phrasesGame.length) {
                    dataGame.phrasesGame[iqb].url = $(this).attr('href');
                    if (dataGame.phrasesGame[iqb].url.length < 4) {
                        dataGame.phrasesGame[iqb].url = '';
                    }
                }
            });

            $audiosDef.each(function () {
                const iqa = parseInt($(this).text());
                if (!isNaN(iqa) && iqa < dataGame.phrasesGame.length) {
                    dataGame.phrasesGame[iqa].audioDefinition =
                        $(this).attr('href');
                    if (dataGame.phrasesGame[iqa].audioDefinition.length < 4) {
                        dataGame.phrasesGame[iqa].audioDefinition = '';
                    }
                }
            });

            $audiosError.each(function () {
                const iqa = parseInt($(this).text());
                if (!isNaN(iqa) && iqa < dataGame.phrasesGame.length) {
                    dataGame.phrasesGame[iqa].audioError = $(this).attr('href');
                    if (dataGame.phrasesGame[iqa].audioError.length < 4) {
                        dataGame.phrasesGame[iqa].audioError = '';
                    }
                }
            });

            $audiosHit.each(function () {
                const iqa = parseInt($(this).text());
                if (!isNaN(iqa) && iqa < dataGame.phrasesGame.length) {
                    dataGame.phrasesGame[iqa].audioHit = $(this).attr('href');
                    if (dataGame.phrasesGame[iqa].audioHit.length < 4) {
                        dataGame.phrasesGame[iqa].audioHit = '';
                    }
                }
            });

            $exeDevice.updateFieldGame(dataGame);

            const instructions = $('.seleccionamedias-instructions', wrapper);
            if (instructions.length == 1)
                $('#eXeGameInstructions').val(instructions.html());

            const textAfter = $('.seleccionamedias-extra-content', wrapper);
            if (textAfter.length == 1)
                $('#eXeIdeviceTextAfter').val(textAfter.html());

            const textFeedBack = $('.seleccionamedias-feedback-game', wrapper);
            if (textFeedBack.length == 1)
                $('#slcmEFeedBackEditor').val(textFeedBack.html());

            $exeDevicesEdition.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs
            );
            $exeDevice.showPhrase(0, true);
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
        if (!$exeDevice.validatePhrase()) return;

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

        const textFeedBack = tinyMCE.get('slcmEFeedBackEditor').getContent();

        if (dataGame.instructions != '')
            divContent =
                '<div class="seleccionamedias-instructions gameQP-instructions">' +
                dataGame.instructions +
                '</div>';

        let linksImages = $exeDevice.createlinksImage(dataGame.phrasesGame),
            linksAudios = $exeDevice.createlinksAudio(dataGame.phrasesGame),
            html = '<div class="seleccionamedias-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html +=
            '<div class="seleccionamedias-feedback-game">' +
            textFeedBack +
            '</div>';
        html += divContent;
        html +=
            '<div class="seleccionamedias-DataGame js-hidden">' +
            json +
            '</div>';

        html += linksImages;
        html += linksAudios;
        let textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();
        if (textAfter != '')
            html +=
                '<div class="seleccionamedias-extra-content">' +
                textAfter +
                '</div>';
        html +=
            '<div class="seleccionamedias-bns js-hidden">' +
            $exeDevice.msgs.msgNoSuportBrowser +
            '</div>';
        html += '</div>';
        return html;
    },

    validateAlt: function () {
        let altImage = $('#slcmEEAlt').val();

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

    createlinksImage: function (phrasesGame) {
        let html = '';
        for (let i = 0; i < phrasesGame.length; i++) {
            const q = phrasesGame[i];
            for (let k = 0; k < q.cards.length; k++) {
                let p = q.cards[k],
                    linkImage = '';
                if (
                    typeof p.url != 'undefined' &&
                    p.url.length > 4 &&
                    p.url.indexOf('http') != 0
                ) {
                    linkImage =
                        '<a href="' +
                        p.url +
                        '" class="js-hidden seleccionamedias-LinkImages-' +
                        i +
                        '">' +
                        k +
                        '</a>';
                }
                html += linkImage;
            }
            if (
                typeof q.url != 'undefined' &&
                q.url.indexOf('http') != 0 &&
                q.url.length > 4
            ) {
                linkImage =
                    '<a href="' +
                    q.url +
                    '" class="js-hidden seleccionamedias-LinkImagesDef">' +
                    i +
                    '</a>';
                html += linkImage;
            }
        }
        return html;
    },

    createlinksAudio: function (phrasesGame) {
        let html = '';
        for (let i = 0; i < phrasesGame.length; i++) {
            const q = phrasesGame[i];
            for (let k = 0; k < q.cards.length; k++) {
                let p = q.cards[k],
                    linkImage = '';
                if (
                    typeof p.audio != 'undefined' &&
                    p.audio.indexOf('http') != 0 &&
                    p.audio.length > 4
                ) {
                    linkImage =
                        '<a href="' +
                        p.audio +
                        '" class="js-hidden seleccionamedias-LinkAudios-' +
                        i +
                        '">' +
                        k +
                        '</a>';
                }
                html += linkImage;
            }
            if (
                typeof q.audioDefinition != 'undefined' &&
                q.audioDefinition.indexOf('http') != 0 &&
                q.audioDefinition.length > 4
            ) {
                const linkImage =
                    '<a href="' +
                    q.audioDefinition +
                    '" class="js-hidden seleccionamedias-LinkAudiosDef">' +
                    i +
                    '</a>';
                html += linkImage;
            }
            if (
                typeof q.audioHit != 'undefined' &&
                q.audioHit.indexOf('http') != 0 &&
                q.audioHit.length > 4
            ) {
                const linkImage =
                    '<a href="' +
                    q.audioHit +
                    '" class="js-hidden seleccionamedias-LinkAudiosHit">' +
                    i +
                    '</a>';
                html += linkImage;
            }
            if (
                typeof q.audioError != 'undefined' &&
                q.audioError.indexOf('http') != 0 &&
                q.audioError.length > 4
            ) {
                const linkImage =
                    '<a href="' +
                    q.audioError +
                    '" class="js-hidden seleccionamedias-LinkAudiosError">' +
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
            textFeedBack = tinyMCE.get('slcmEFeedBackEditor').getContent(),
            textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent(),
            showMinimize = $('#slcmEShowMinimize').is(':checked'),
            itinerary =
                $exeDevicesEdition.iDevice.gamification.itinerary.getValues(),
            feedBack = $('#slcmEHasFeedBack').is(':checked'),
            percentajeFB = parseInt(clear($('#slcmEPercentajeFB').val())),
            customMessages = $('#slcmECustomMessages').is(':checked'),
            percentajeQuestions = parseInt(
                clear($('#slcmEPercentajeQuestions').val())
            ),
            time = parseInt(clear($('#slcmETime').val())),
            showSolution = $('#slcmEShowSolution').is(':checked'),
            timeShowSolution = parseInt(
                clear($('#slcmETimeShowSolution').val())
            ),
            author = $('#slcmEAuthor').val(),
            phrasesGame = $exeDevice.phrasesGame,
            evaluation = $('#slcmEEvaluation').is(':checked'),
            evaluationID = $('#slcmEEvaluationID').val(),
            id = $exeDevice.getIdeviceID(),
            modeTable = $('#slcmEModeTable').is(':checked'),
            numberMaxCards = $('#slcmEANumberMaxCard').val(),
            attempsNumber = parseInt($('#slcmEAttemptsNumber').val());

        if (!itinerary) return false;

        if (showSolution && timeShowSolution.length == 0) {
            eXe.app.alert($exeDevice.msgs.msgEProvideTimeSolution);
            return false;
        }
        if (phrasesGame.length == 0) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
            return false;
        }
        const scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();
        return {
            typeGame: 'SeleccionaMedias',
            author: author,
            instructions: instructions,
            showMinimize: showMinimize,
            showSolution: showSolution,
            itinerary: itinerary,
            phrasesGame: phrasesGame,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted || 100,
            textFeedBack: escape(textFeedBack),
            textAfter: escape(textAfter),
            feedBack: feedBack,
            percentajeFB: percentajeFB,
            customMessages: customMessages,
            percentajeQuestions: percentajeQuestions,
            timeShowSolution: timeShowSolution,
            time: time,
            version: $exeDevice.version,
            evaluation: evaluation,
            evaluationID: evaluationID,
            attempsNumber: attempsNumber,
            numberMaxCards: numberMaxCards,
            modeTable: modeTable,
            id: id,
        };
    },

    showImage: function (id) {
        const $image = $('#slcmEImage-' + id),
            $nimage = $('#slcmENoImage-' + id),
            alt = $('#slcmEAlt-' + id).val(),
            url = $('#slcmEURLImage-' + id).val();

        $exeDevice.hideFlex($image);
        $image.attr('alt', alt);
        $exeDevice.showFlex($nimage);
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
                    $exeDevice.showFlex($image);
                    $exeDevice.hideFlex($nimage);
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

    drawImage: function (image, mData) {
        $(image).css({
            position: 'absolute',
            left: mData.x + 'px',
            top: mData.y + 'px',
            width: mData.w + 'px',
            height: mData.h + 'px',
        });
    },

    addEvents: function () {
        $exeDevice.hideFlex($('#slcmEPasteC'));

        $('#slcmEAddC').on('click', function (e) {
            e.preventDefault();
            $exeDevice.addCard(true);
        });

        $('#slcmEDeleteC').on('click', function (e) {
            e.preventDefault();
            $exeDevice.removeCard();
        });

        $('#slcmECopyC').on('click', function (e) {
            e.preventDefault();
            $exeDevice.copyCard();
        });

        $('#slcmECutC').on('click', function (e) {
            e.preventDefault();
            $exeDevice.cutCard();
        });

        $('#slcmEPasteC').on('click', function (e) {
            e.preventDefault();
            $exeDevice.pasteCard();
        });

        $('#slcmEPhrase').on('click', '.SLCME-EDatosCarta', function () {
            $exeDevice.activeID = $(this).data('id');
            $('.SLCME-EDatosCarta').removeClass('SLCME-EActive');
            $(this).addClass('SLCME-EActive');
        });

        $exeDevice.hideFlex($('#slcmEPaste'));
        $('#slcmEAdd').on('click', function (e) {
            e.preventDefault();
            $exeDevice.addPhrase();
        });

        $('#slcmEFirst').on('click', function (e) {
            e.preventDefault();
            $exeDevice.firstPhrase();
        });

        $('#slcmEPrevious').on('click', function (e) {
            e.preventDefault();
            $exeDevice.previousPhrase();
        });

        $('#slcmENext').on('click', function (e) {
            e.preventDefault();
            $exeDevice.nextPhrase();
        });

        $('#slcmELast').on('click', function (e) {
            e.preventDefault();
            $exeDevice.lastPhrase();
        });

        $('#slcmEDelete').on('click', function (e) {
            e.preventDefault();
            $exeDevice.removePhrase();
        });

        $('#slcmECopy').on('click', function (e) {
            e.preventDefault();
            $exeDevice.copyPhrase();
        });

        $('#slcmEPaste').on('click', function (e) {
            e.preventDefault();
            $exeDevice.pastePhrase();
        });

        if (
            window.File &&
            window.FileReader &&
            window.FileList &&
            window.Blob
        ) {
            $exeDevice.showFlex($('#eXeGameExportImport'));
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
                $exeDevices.iDevice.gamification.share.exportGame(
                    dataGame,
                    _('Select media files'),
                    'gameQEIdeviceForm'
                );
            });
        } else {
            $exeDevice.hideFlex($('#eXeGameExportImport'));
        }

        $('#slcmEHasFeedBack').on('change', function () {
            const marcado = $(this).is(':checked');
            if (marcado) {
                $('#slcmEFeedbackP').slideDown();
            } else {
                $('#slcmEFeedbackP').slideUp();
            }
            $('#slcmEPercentajeFB').prop('disabled', !marcado);
        });

        $('#slcmECustomMessages').on('change', function () {
            const messages = $(this).is(':checked');
            $('.SLCME-ECustomMessageDiv')
                .toggleClass('d-none', !messages)
                .toggleClass('d-flex', messages);
        });

        $('#slcmEPercentajeQuestions').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 3);
            this.value = v;
            if (this.value > 0 && this.value < 101) {
                $exeDevice.updateQuestionsNumber();
            }
        });

        $('#slcmEPercentajeQuestions').on('focusout', function () {
            this.value = this.value.trim() == '' ? 100 : this.value;
            this.value = this.value > 100 ? 100 : this.value;
            this.value = this.value < 1 ? 1 : this.value;
            $exeDevice.updateQuestionsNumber();
        });

        $('#slcmEANumberMaxCard').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 2);
            this.value = v;
        });

        $('#slcmEANumberMaxCard').on('focusout', function () {
            this.value = this.value.trim() == '' ? 30 : this.value;
            this.value = this.value > 30 ? 30 : this.value;
            this.value = this.value < 1 ? 1 : this.value;
        });

        $('#slcmETime').on('focusout', function () {
            this.value = this.value.trim() == '' ? 0 : this.value;
            this.value = this.value > 999 ? 999 : this.value;
            this.value = this.value < 0 ? 0 : this.value;
        });

        $('#slcmETime').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 3);
            this.value = v;
        });

        $('#slcmEPercentajeQuestions').on('click', function () {
            $exeDevice.updateQuestionsNumber();
        });

        $('#slcmETimeShowSolution').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 3);
            this.value = v;
        });

        $('#slcmETimeShowSolution').on('focusout', function () {
            this.value = this.value.trim() == '' ? 3 : this.value;
            this.value = this.value > 999 ? 999 : this.value;
            this.value = this.value < 1 ? 1 : this.value;
        });

        $('#slcmEAttemptsNumber').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 1);
            this.value = v;
        });

        $('#slcmEAttemptsNumber').on('focusout', function () {
            this.value = this.value.trim() == '' ? 1 : this.value;
            this.value = this.value > 9 ? 9 : this.value;
            this.value = this.value < 1 ? 1 : this.value;
        });

        $('#slcmEURLAudioDefinition').on('change', function () {
            $exeDevice.loadAudio($(this).val());
        });

        $('#slcmEPlayAudioDefinition').on('click', function (e) {
            e.preventDefault();
            const audio = $('#slcmEURLAudioDefinition').val();
            $exeDevice.loadAudio(audio);
        });

        $('#slcmEURLAudioOK').on('change', function () {
            $exeDevice.loadAudio($(this).val());
        });

        $('#slcmEPlayAudioOK').on('click', function (e) {
            e.preventDefault();
            const audio = $('#slcmEURLAudioOK').val();
            $exeDevice.loadAudio(audio);
        });

        $('#slcmEURLAudioKO').on('change', function () {
            $exeDevice.loadAudio($(this).val());
        });
        $('#slcmEPlayAudioKO').on('click', function (e) {
            e.preventDefault();
            const audio = $('#slcmEURLAudioKO').val();
            $exeDevice.loadAudio(audio);
        });

        $('#slcmEEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#slcmEEvaluationID').prop('disabled', !marcado);
        });

        $('#slcmEEvaluationHelpLnk').on('click', function (e) {
            e.preventDefault();
            if ($('#slcmEEvaluationHelp').hasClass('d-none')) {
                $('#slcmEEvaluationHelp')
                    .removeClass('d-none')
                    .addClass('d-flex');
            } else {
                $('#slcmEEvaluationHelp')
                    .removeClass('d-flex')
                    .addClass('d-none');
            }
        });

        $('#slcmEShowMoreDefinition').on('click', function (e) {
            e.preventDefault();
            if ($('#slcmEDefinitionAltAuthor').hasClass('d-none')) {
                $('#slcmEDefinitionAltAuthor')
                    .removeClass('d-none')
                    .addClass('d-flex');
            } else {
                $('#slcmEDefinitionAltAuthor')
                    .removeClass('d-flex')
                    .addClass('d-none');
            }
        });

        $('#slcmEURLImageDefinition').on('change', function () {
            $exeDevice.loadImageDefinition();
        });

        $('#slcmEPlayImageDefinition').on('click', function (e) {
            e.preventDefault();
            $exeDevice.loadImageDefinition();
        });

        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();
    },
    loadImage: function (id) {
        const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
            url = $('#slcmEURLImage-' + id).val(),
            ext = url.split('.').pop().toLowerCase();
        if (url.indexOf('files') == 0 && validExt.indexOf(ext) == -1) {
            $exeDevice.showMessage(
                _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
            );
            return false;
        }
        $exeDevice.showImage(id);
    },

    loadImageDefinition: function () {
        const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
            url = $('#slcmEURLImageDefinition').val(),
            ext = url.split('.').pop().toLowerCase();
        if (url.trim().length < 4) {
            $exeDevice.hideFlex($('#slcmEImageDefinitionDiv'));
            return false;
        }
        if (url.indexOf('files') == 0 && validExt.indexOf(ext) == -1) {
            $exeDevice.showMessage(
                _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
            );
            return false;
        }
        $exeDevice.showFlex($('#slcmEImageDefinitionDiv'));
        $('#slcmEImageDefinition').attr('src', url);
    },

    loadAudio: function (url) {
        const validExt = ['mp3', 'ogg', 'wav'],
            ext = url.split('.').pop().toLowerCase();
        if (url.indexOf('files') == 0 && validExt.indexOf(ext) == -1) {
            $exeDevice.showMessage(_('Supported formats') + ': mp3, ogg, waq');
            return false;
        } else {
            if (url.length > 4) {
                $exeDevice.stopSound();
                $exeDevice.playSound(url);
            }
        }
    },

    updateGameMode: function (feedback) {
        $('#slcmEHasFeedBack').prop('checked', feedback);
        if (feedback) {
            $('#slcmEFeedbackP').slideDown();
        }
        if (!feedback) {
            $('#slcmEFeedbackP').slideUp();
        }
    },

    clearPhrase: function () {
        $('#slcmEPhrase').empty();
        $('#slcmEDefinition').val('');
        $('#slcmEURLImageDefinition').val('');
        $('#slcmEAltDefinition').val('');
        $('#slcmEAuthorDefinition').val('');
        $('#slcmEImageDefinition').attr('src', '');
        $('#slcmEURLAudioDefinition').attr('src', '');
        $exeDevice.hideFlex($('#slcmEImageDefinitionDiv'));
    },

    addPhrase: function () {
        if ($exeDevice.phrasesGame.length >= 30) {
            $exeDevice.showMessage($exeDevice.msgs.msgPairsMax);
            return;
        }
        const valida = $exeDevice.validatePhrase();
        if (valida) {
            $exeDevice.clearPhrase();
            $exeDevice.phrasesGame.push($exeDevice.getPhraseDefault());
            $exeDevice.addCard(true);
            $exeDevice.active = $exeDevice.phrasesGame.length - 1;
            $('#slcmENumberPhrase').text($exeDevice.phrasesGame.length);
            $exeDevice.typeEdit = -1;
            $exeDevice.hideFlex($('#slcmEPaste'));
            $('#slcmENumPhrases').text($exeDevice.phrasesGame.length);
            $('#slcmActivityNumber').text($exeDevice.phrasesGame.length);
            $exeDevice.updateQuestionsNumber();
        }
    },

    removePhrase: function () {
        if ($exeDevice.phrasesGame.length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
        } else {
            $exeDevice.phrasesGame.splice($exeDevice.active, 1);
            if ($exeDevice.active >= $exeDevice.phrasesGame.length - 1) {
                $exeDevice.active = $exeDevice.phrasesGame.length - 1;
            }
            $exeDevice.showPhrase($exeDevice.active);
            $exeDevice.typeEdit = -1;
            $exeDevice.hideFlex($('#slcmEPaste'));
            $('#slcmENumPhrases').text($exeDevice.phrasesGame.length);
            $('#slcmENumberPhrase').text($exeDevice.active + 1);
            $('#slcmActivityNumber').text($exeDevice.active + 1);
            $exeDevice.updateQuestionsNumber();
        }
    },
    copyPhrase: function () {
        if ($exeDevice.validatePhrase()) {
            $exeDevice.typeEdit = 0;
            $exeDevice.clipBoard = JSON.parse(
                JSON.stringify($exeDevice.phrasesGame[$exeDevice.active])
            );
            $exeDevice.showFlex($('#slcmEPaste'));
        }
    },

    cutPhrase: function () {
        if ($exeDevice.validatePhrase()) {
            $exeDevice.numberCutCuestion = $exeDevice.active;
            $exeDevice.typeEdit = 1;
            $exeDevice.showFlex($('#slcmEPaste'));
        }
    },

    pastePhrase: function () {
        if ($exeDevice.phrasesGame.length >= 30) {
            $exeDevice.showMessage($exeDevice.msgs.msgPairsMax);
            return;
        }
        if ($exeDevice.typeEdit == 0) {
            $exeDevice.active++;
            const p = $.extend(true, {}, $exeDevice.clipBoard);
            $exeDevice.phrasesGame.splice($exeDevice.active, 0, p);
            $exeDevice.showPhrase($exeDevice.active);
            $('#slcmENumPhrases').text($exeDevice.phrasesGame.length);
        } else if ($exeDevice.typeEdit == 1) {
            $exeDevice.hideFlex($('#slcmEPaste'));
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                $exeDevice.phrasesGame,
                $exeDevice.numberCutCuestion,
                $exeDevice.active
            );
            $exeDevice.showPhrase($exeDevice.active);
            $('#slcmENumPhrases').text($exeDevice.phrasesGame.length);
            $('#slcmENumberPhrase').text($exeDevice.active + 1);
            $exeDevice.updateQuestionsNumber();
        }
    },

    nextPhrase: function () {
        if (
            $exeDevice.validatePhrase() &&
            $exeDevice.active < $exeDevice.phrasesGame.length - 1
        ) {
            $exeDevice.active++;
            $exeDevice.showPhrase($exeDevice.active);
        }
    },

    lastPhrase: function () {
        if (
            $exeDevice.validatePhrase() &&
            $exeDevice.active < $exeDevice.phrasesGame.length - 1
        ) {
            $exeDevice.active = $exeDevice.phrasesGame.length - 1;
            $exeDevice.showPhrase($exeDevice.active);
        }
    },

    previousPhrase: function () {
        if ($exeDevice.validatePhrase() && $exeDevice.active > 0) {
            $exeDevice.active--;
            $exeDevice.showPhrase($exeDevice.active);
        }
    },

    firstPhrase: function () {
        if ($exeDevice.validatePhrase() && $exeDevice.active > 0) {
            $exeDevice.active = 0;
            $exeDevice.showPhrase($exeDevice.active);
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
        $exeDevice.id = $exeDevice.getIdeviceID();

        game.weighted =
            typeof game.weighted !== 'undefined' ? game.weighted : 100;

        $('#slcmEShowMinimize').prop('checked', game.showMinimize);
        $('#slcmEHasFeedBack').prop('checked', game.feedBack);
        $('#slcmEPercentajeFB').val(game.percentajeFB);
        $('#slcmEPercentajeQuestions').val(game.percentajeQuestions);
        $('#slcmETime').val(game.time);
        $('#slcmETimeShowSolution').val(game.timeShowSolution);
        $('#slcmEAuthor').val(game.author);
        $('#slcmEShowSolution').prop('checked', game.showSolution);

        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted
        );
        $exeDevice.phrasesGame = game.phrasesGame;
        $exeDevice.updateGameMode(game.feedBack);
        $('#slcmENumPhrases').text($exeDevice.phrasesGame.length);

        $('#slcmEPercentajeFB').prop('disabled', !game.feedBack);
        $('#slcmECustomMessages').prop('checked', game.customMessages);

        $exeDevice.updateQuestionsNumber();
        $('#slcmEEvaluation').prop('checked', game.evaluation);
        $('#slcmEEvaluationID').val(game.evaluationID);
        $('#slcmEEvaluationID').prop('disabled', !game.evaluation);
        $('#slcmEAttemptsNumber').val(game.attempsNumber);
        $('#slcmEModeTable').prop('checked', game.modeTable);
        $('#slcmEANumberMaxCard').val(game.numberMaxCards);
    },

    importGame: function (content) {
        const game = $exeDevice.isJsonString(content);

        if (!game || typeof game.typeGame == 'undefined') {
            eXe.app.alert($exeDevice.msgs.msgESelectFile);
            return;
        } else if (game.typeGame !== 'SeleccionaMedias') {
            eXe.app.alert($exeDevice.msgs.msgESelectFile);
            return;
        }

        game.id = $exeDevice.getIdeviceID();

        $exeDevice.updateFieldGame(game);

        const instructions = game.instructionsExe || game.instructions,
            tAfter = game.textAfter || '',
            textFeedBack = game.textFeedBack || '';
        tinyMCE.get('eXeGameInstructions').setContent(unescape(instructions));
        tinyMCE.get('eXeIdeviceTextAfter').setContent(unescape(tAfter));
        tinyMCE.get('slcmEFeedBackEditor').setContent(unescape(textFeedBack));

        //$('.exe-form-tabs li:first-child a').click();
        $exeDevice.showPhrase(0, false);
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

    clickImage: function (id, epx, epy) {
        const $image = $('#slcmEImage-' + id),
            $x = $('#slcmEX-' + id),
            $y = $('#slcmEY-' + id),
            posX = epx - $image.offset().left,
            posY = epy - $image.offset().top,
            wI = $image.width() > 0 ? $image.width() : 1,
            hI = $image.height() > 0 ? $image.height() : 1;
        $x.val(posX / wI);
        $y.val(posY / hI);
    },

    removeTags: function (str) {
        let wrapper = $('<div></div>');
        wrapper.html(str);
        return wrapper.text();
    },
    showFlex: function ($el) {
        if ($el && $el.length) {
            if ($el.hasClass('d-none')) {
                $el.removeClass('d-none').addClass('d-flex');
            } else if (!$el.hasClass('d-flex') && !$el.hasClass('d-none')) {
                $el.show();
            }
        }
    },
    hideFlex: function ($el) {
        if ($el && $el.length) {
            if ($el.hasClass('d-flex')) {
                $el.removeClass('d-flex').addClass('d-none');
            } else if (!$el.hasClass('d-flex') && !$el.hasClass('d-none')) {
                $el.hide();
            }
        }
    },
    toggleFlex: function ($el) {
        if ($el && $el.length) {
            if ($el.hasClass('d-none')) {
                $el.removeClass('d-none').addClass('d-flex');
            } else if ($el.hasClass('d-flex')) {
                $el.removeClass('d-flex').addClass('d-none');
            } else {
                if ($el.is(':visible')) {
                    $el.hide();
                } else {
                    $el.show();
                }
            }
        }
    },
};
