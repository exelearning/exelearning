/* eslint-disable no-undef */
/**
/**
 * Ordena Activity iDevice (edition code)
 * Version: 1.5
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narvaez Martinez
 * Graphic Design: Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    i18n: {
        category: _('Games'),
        name: _('Sort'),
    },
    msgs: {},
    classIdevice: 'sort',
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
    checkAltImage: true,
    playerAudio: '',
    version: 1.5,
    id: false,
    ci18n: {
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
        msgSuccesses: c_('Right! | Excellent! | Great! | Very good! | Perfect!'),
        msgFailures: c_('It was not that! | Incorrect! | Not correct! | Sorry! | Error!'),
        msgTryAgain: c_('You need at least %s&percnt; of correct answers to get the information. Please try again.'),
        msgEndGameScore: c_('Please start the game before saving your score.'),
        msgScoreScorm: c_("The score can't be saved because this page is not part of a SCORM package."),
        msgOnlySaveScore: c_('You can only save the score once!'),
        msgOnlySave: c_('You can only save once'),
        msgInformation: c_('Information'),
        msgYouScore: c_('Your score'),
        msgOnlySaveAuto: c_('Your score will be saved after each question. You can only play once.'),
        msgSaveAuto: c_('Your score will be automatically saved after each question.'),
        msgSeveralScore: c_('You can save the score as many times as you want'),
        msgYouLastScore: c_('The last score saved is'),
        msgActityComply: c_('You have already done this activity.'),
        msgPlaySeveralTimes: c_('You can do this activity as many times as you want'),
        msgClose: c_('Close'),
        msgAudio: c_('Audio'),
        msgTimeOver: c_('Time is up. Please try again'),
        msgAllAttemps: c_('You finished all the attempts! Please try again'),
        mgsAllPhrases: c_('You have ordered all the activities!'),
        msgAttempts: c_('Attempts'),
        msgNumbersAttemps: c_('Number of activities to be completed'),
        msgAuthor: c_('Authorship'),
        msgReboot: c_('Restart'),
        msgActivities: c_('Activities'),
        msgCheck: c_('Check'),
        msgNextPhrase: c_('Next activity'),
        msgContinue: c_('Continue'),
        msgPositions: c_('Correct positions'),
        msgAllOK: c_('Brilliant! All correct!'),
        msgAgain: c_('Please try again'),
        msgUncompletedActivity: c_('Incomplete activity'),
        msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
        msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
        msgPhrases: c_('Phrases'),
        msgTypeGame: c_('Sort'),
    },
    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.ci18n.msgTryAgain = this.ci18n.msgTryAgain.replace(
            '&percnt;',
            '%',
        );

        this.setMessagesInfo();
        this.createForm();
    },
    setMessagesInfo: function () {
        const msgs = this.msgs;
        msgs.msgESelectFile = _(
            'The selected file does not contain a valid game',
        );
        msgs.msgEURLValid = _(
            'You must upload or indicate the valid URL of an image',
        );
        msgs.msgEOneQuestion = _('Please provide at least one question');
        msgs.msgTypeChoose = _(
            'Please check all the answers in the right order',
        );
        msgs.msgTimeFormat = _('Please check the time format: hh:mm:ss');
        msgs.msgProvideFB = _('Message to display when passing the game');
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.',
        );
        msgs.msgFewAttempts = _(
            'The number of attempts has to be bigger or equal to the number of phrases in the game. Use 0 for an unlimited number of attempts',
        );
        msgs.msgCompleteData = _(
            'You must indicate an image, a text or/and an audio for each card',
        );
        msgs.msgPairsMax = _('Maximum number of phrases: 20');
        msgs.msgCardsColumn = _(
            'With fixed headers, the number of cards must be bigger than the number of columns',
        );
        msgs.msgIDLenght = _(
            'The report identifier must have at least 5 characters',
        );
        msgs.msgEOneWord = _('Please provide at least one word');
    },

    createForm: function () {
        const path = $exeDevice.idevicePath,
            html = `
            <div id="gameQEIdeviceForm">
                <p class="exe-block-info exe-block-dismissible" style="position:relative">
                    ${_('Create interactive activities in which players will have to order cards with images, texts and/or sounds.')}
                    <a href="https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe29/ordena.html" hreflang="es" target="_blank">${_('Usage Instructions')}</a>
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevices.iDevice.gamification.instructions.getFieldset(c_('Drag each letter to its correct position'))}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_('Options')}</a></legend>
                        <div>
                            <p>
                                <span>${_('Type')}:</span>
                                <span class="ODNE-EInputColumns">
                                    <input class="ODNE-EType" id="odntype0" checked type="radio" name="odntype" value="0" />
                                    <label for="odntype0">${_('Phrases')}</label>
                                    <input class="ODNE-EType" id="odntype1" type="radio" name="odntype" value="1" />
                                    <label for="odntype1">${_('Multimedia')}</label>
                                </span>
                            </p>
                            <p><label for="ordenaEShowMinimize">
                                <input type="checkbox" id="ordenaEShowMinimize">${_('Show minimized.')}</label>
                            </p>
                            <p id="ordenaTimeShowDiv" class="ODNE-Hide">
                                <label for="ordenaETimeShowSolution">${_('Time while the cards will be shown (seconds)')}<input type="number" name="ordenaETimeShowSolution" id="ordenaETimeShowSolution" value="3" min="1" max="999" /></label>
                            </p>
                            <p id="ordenaECustomMessagesDiv" class="ODNE-Hide">
                                <label for="ordenaECustomMessages"><input type="checkbox" id="ordenaECustomMessages">${_('Custom messages')}.</label>
                            </p>
                            <p>
                                <label for="ordenaETime">${_('Time (minutes)')}<input type="number" name="ordenaETime" id="ordenaETime" value="0" min="0" max="120" step="1" /></label>
                            </p>
                            <p>
                                <label for="ordenaEShowSolution"><input type="checkbox" checked id="ordenaEShowSolution">${_('Show solutions')}.</label>
                            </p>
                            <p>
                                <label for="ordenaEHasFeedBack"><input type="checkbox" id="ordenaEHasFeedBack">${_('Feedback')}</label><label for="ordenaEPercentajeFB"></label><input type="number" name="ordenaEPercentajeFB" id="ordenaEPercentajeFB" value="100" min="5" max="100" step="5" disabled />
                            </p>
                            <p id="ordenaEFeedbackP" class="ODNE-EFeedbackP">
                                <textarea id="ordenaEFeedBackEditor" class="exe-html-editor"></textarea>
                            </p>
                            <p>
                                <label for="ordenaEPercentajeQuestions">${_('% Activities')}<input type="number" name="ordenaEPercentajeQuestions" id="ordenaEPercentajeQuestions" value="100" min="1" max="100" /></label><span id="ordenaENumeroPercentaje">1/1</span></p>
                            <p>
                                <label for="ordenaEAuthor">${_('Author')}:</label><input id="ordenaEAuthor" type="text" />
                            </p>
                            <p id="ordenaColumnsDiv" class="ODNE-Hide">
                                <span>${_('Columns')}</span><span class="ODNE-EInputColumns"><input class="ODNE-EColumns" id="odn0" checked type="radio" name="odncolumns" value="0" /><label for="odn0">No</label><input class="ODNE-EColumns" id="odn1" type="radio" name="odncolumns" value="1" /><label for="odn1">1</label><input class="ODNE-EColumns" id="odn2" type="radio" name="odncolumns" value="2" /><label for="odn2">2</label><input class="ODNE-EColumns" id="odn3" type="radio" name="odncolumns" value="3" /><label for="odn3">3</label><input class="ODNE-EColumns" id="odn4" type="radio" name="odncolumns" value="4" /><label for="odn4">4</label><input class="ODNE-EColumns" id="odn5" type="radio" name="odncolumns" value="5" /><label for="odn5">5</label></span>
                            </p>
                            <p id="ordenaCustomizeCard" style="display:none;">
                                <label for="ordenaMaxWidth"><input type="checkbox" checked id="ordenaMaxWidth">${_('Maximum width')}.</label><label for="ordenaCardHeight">${_('Height (px)')}<input type="number" name="ordenaCardHeight" id="ordenaCardHeight" value="200" min="0" max="1000" /></label>
                            </p>
                            <p id="ordenaFixedHeaders" style="display:none;">
                                <label for="ordenaOrderedColumns"><input type="checkbox" id="ordenaOrderedColumns">${_('Fixed headers')}.</label>
                            </p>
                            <p id="ordenaStartAutomaticallyDiv" style="display:none;">
                                <label for="ordenaStartAutomatically"><input type="checkbox" id="ordenaStartAutomatically">${_('Automatic start')}.</label>
                            </p>                            
                            <div id="ordenaEBackDiv" style="display:none">
                                <p class="ODNE-EInputImageBack">
                                    <label for="ordenaEURLImgCard">${_('Image back')}: </label>
                                    <input type="text" class="exe-file-picker ODNE-EURLImage" id="ordenaEURLImgCard"/>
                                    <a href="#" id="ordenaEPlayCard" class="ODNE-ENavigationButton ODNE-EPlayVideo" title="${_('Show')}">
                                         <img src="${path}quextIEPlay.png" alt="${_('Show')}" class="ODNE-EButtonImage b-play" />
                                    </a>
                                </p>
                                <p id="ordenaEbackground" class="ODNE-Back">
                                    <img class="ODNE-EImageBack" src="" id="ordenaECard" alt="${_('Image')}" style="display:none" />
                                    <img class="ODNE-EImageBack" src="${path}ordenaHome.png" id="ordenaENoCard" alt="${_('No image')}" />
                                </p>
                            </div> 
                            <p id="ordenaEWordBorderDiv">
                                <label for="ordenaEWordBorder"><input type="checkbox" checked id="ordenaEWordBorder">${_('Word border')}.</label>
                            </p> 
                            <p class="Games-Reportdiv">
                                <strong class="GameModeLabel"><a href="#ordenaEEvaluationHelp" id="ordenaEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}"><img src="${path}quextIEHelp.gif" width="14" height="14" alt="${_('Help')}"/></a></strong>
                                <input type="checkbox" id="ordenaEEvaluation"><label for="ordenaEEvaluation">${_('Progress report')}.</label>
                                <label for="ordenaEEvaluationID">${_('Identifier')}</label><input type="text" id="ordenaEEvaluationID" disabled/>
                            </p>
                            <div id="ordenaEEvaluationHelp" class="ODNE-TypeGameHelp exe-block-info">
                               <p>${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}</p>
                            </div>
                        </div>
                    </fieldset>
                    <fieldset class="exe-fieldset">
                        <legend><a href="#">${_('Activities')}</a></legend>
                        <div class="ODNE-EPanel" id="ordenaEPanel">
                            <p class="ODNE-EPhraseDivI" id="ordenaEPĥraseIDiv">
                                <label for="ordenaEPraseI">${_('Phrase')}:</label><input type="text" id="ordenaEPraseI">                               
                            </p>
                            <div class="ODNE-ENavigationButtons" id="ordenaButtonsPrhaseDiv">
                                <a href="#" id="ordenaEAdd" class="ODNE-ENavigationButton" title="${_('Add an activity')}"><img src="${path}quextIEAdd.png" alt="${_('Add an activity')}" class="ODNE-EButtonImage b-add" /></a>
                                <a href="#" id="ordenaEFirst" class="ODNE-ENavigationButton" title="${_('First activity')}"><img src="${path}quextIEFirst.png" alt="${_('First activity')}" class="ODNE-EButtonImage b-first" /></a>
                                <a href="#" id="ordenaEPrevious" class="ODNE-ENavigationButton" title="${_('Previous activity')}"><img src="${path}quextIEPrev.png" alt="${_('Previous activity')}" class="ODNE-EButtonImage b-prev" /></a>
                                <span class="sr-av">${_('Activity number:')}</span><span class="ODNE-NumberPhrase" id="ordenaENumberPhrase">1</span>
                                <a href="#" id="ordenaENext" class="ODNE-ENavigationButton" title="${_('Next activity')}"><img src="${path}quextIENext.png" alt="${_('Next activity')}" class="ODNE-EButtonImage b-next" /></a>
                                <a href="#" id="ordenaELast" class="ODNE-ENavigationButton" title="${_('Last activity')}"><img src="${path}quextIELast.png" alt="${_('Last activity')}" class="ODNE-EButtonImage b-last" /></a>
                                <a href="#" id="ordenaEDelete" class="ODNE-ENavigationButton" title="${_('Delete activity')}"><img src="${path}quextIEDelete.png" alt="${_('Delete activity')}" class="ODNE-EButtonImage b-delete" /></a>
                                <a href="#" id="ordenaECopy" class="ODNE-ENavigationButton" title="${_('Copy activity')}"><img src="${path}quextIECopy.png" alt="${_('Copy activity')}" class="ODNE-EButtonImage b-copy" /></a>
                                <a href="#" id="ordenaECut" class="ODNE-ENavigationButton" title="${_('Cut activity')}"><img src="${path}quextIECut.png" alt="${_('Cut activity')}" class="ODNE-EButtonImage b-copy" /></a>
                                <a href="#" id="ordenaEPaste" class="ODNE-ENavigationButton" title="${_('Paste activity')}"><img src="${path}quextIEPaste.png" alt="${_('Paste activity')}" class="ODNE-EButtonImage b-paste" /></a>
                            </div>
                            <p class="ODNE-ENumActivity ODNE-Hide" id="ordenaActivityNumberDiv">${_('Activity')} <span id="ordenaActivityNumber">1</span></p>
                            <p class="ODNE-ECustomMessageDef ODNE-Hide" id="ordenaEDefinitionDiv"><label for="ordenaEDefinition">${_('Statement')}</label><input type="text" id="ordenaEDefinition"><label>${_('Audio')}</label><input type="text" id="ordenaEURLAudioDefinition" class="exe-file-picker ODNE-EURLAudio" /><a href="#" id="ordenaEPlayAudioDefinition" class="ODNE-ENavigationButton ODNE-EPlayVideo" title="${_('Audio')}"><img src="${path}quextIEPlay.png" alt="Play audio" class="ODNE-EButtonImage b-play" /></a></p>
                            <p class="ODNE-ECustomMessageDiv" id="ordenaCustomMessageOKDiv"><label for="ordenaEMessageOK">${_('Success')}</label><input type="text" id="ordenaEMessageOK"><label>${_('Audio')}</label><input type="text" id="ordenaEURLAudioOK" class="exe-file-picker ODNE-EURLAudio" /><a href="#" id="ordenaEPlayAudioOK" class="ODNE-ENavigationButton ODNE-EPlayVideo" title="${_('Audio')}"><img src="${path}quextIEPlay.png" alt="Play audio" class="ODNE-EButtonImage b-play" /></a></p>
                            <p class="ODNE-ECustomMessageDiv" id="ordenaCustomMessageKODiv"><label for="ordenaEMessageKO">${_('Error')}</label><input type="text" id="ordenaEMessageKO"><label>${_('Audio')}</label><input type="text" id="ordenaEURLAudioKO" class="exe-file-picker ODNE-EURLAudio" /><a href="#" id="ordenaEPlayAudioKO" class="ODNE-ENavigationButton ODNE-EPlayVideo" title="${_('Audio')}"><img src="${path}quextIEPlay.png" alt="Play audio" class="ODNE-EButtonImage b-play" /></a></p>
                            <p class="ODNE-EPhrase ODNE-Hide" id="ordenaEPhrase"></p>
                            <div class="ODNE-EContents ODNE-Hide" id="ordenaButtonCardDiv">
                                <div class="ODNE-ENavigationButtons">
                                    <a href="#" id="ordenaEAddC" class="ODNE-ENavigationButton" title="${_('Add a card')}"><img src="${path}quextIEAdd.png" alt="${_('Add a card')}" class="ODNE-EButtonImage b-add" /></a>
                                    <a href="#" id="ordenaEDeleteC" class="ODNE-ENavigationButton" title="${_('Delete card')}"><img src="${path}quextIEDelete.png" alt="${_('Delete card')}" class="ODNE-EButtonImage b-delete" /></a>
                                    <a href="#" id="ordenaECopyC" class="ODNE-ENavigationButton" title="${_('Copy card')}"><img src="${path}quextIECopy.png" alt="${_('Copy card')}" class="ODNE-EButtonImage b-copy" /></a>
                                    <a href="#" id="ordenaECutC" class="ODNE-ENavigationButton" title="${_('Cut card')}"><img src="${path}quextIECut.png" alt="${_('Cut card')}" class="ODNE-EButtonImage b-cut" /></a>
                                    <a href="#" id="ordenaEPasteC" class="ODNE-ENavigationButton" title="${_('Paste card')}"><img src="${path}quextIEPaste.png" alt="${_('Paste card')}" class="ODNE-EButtonImage b-paste" /></a>
                                </div>
                            </div>
                            <div class="ODNE-ENumPhrasesDiv" id="ordenaENumPhrasesDiv">
                                <div class="ODNE-ENumPhraseS"><span class="sr-av">${_('Phrases:')}</span></div><span class="ODNE-ENumPhrases" id="ordenaENumPhrases">1</span>
                            </div>
                        </div>
                    </fieldset>
                    ${$exeDevices.iDevice.common.getTextFieldset('after')}
                </div>
                ${$exeDevices.iDevice.gamification.itinerary.getTab()}
                ${$exeDevices.iDevice.gamification.scorm.getTab()}
                ${$exeDevices.iDevice.gamification.common.getLanguageTab(this.ci18n)}
            </div>`;

        this.ideviceBody.innerHTML = html;
        $exeDevices.iDevice.tabs.init('gameQEIdeviceForm');
        $exeDevices.iDevice.gamification.scorm.init();
        this.enableForm();
    },

    showTypeGame: function (type) {
        if (type == 0) {
            $('#ordenaTimeShowDiv').hide();
            $('#ordenaColumnsDiv').hide();
            $('#ordenaActivityNumberDiv').hide();
            $('#ordenaEDefinitionDiv').hide();
            $('#ordenaEPhrase').hide();
            $('#ordenaButtonCardDiv').hide();
            $('#ordenaCustomizeCard').hide();            
            $('#ordenaEBackDiv').hide();
            $('#ordenaEWordBorderDiv').show();            
            $('#ordenaStartAutomaticallyDiv').hide();
            $('#ordenaECustomMessagesDiv').hide();
            $('#ordenaFixedHeaders').hide();
            $('#ordenaECustomMessages').prop('checked', false);
            $('#ordenaEPĥraseIDiv').show();
            $('#ordenaButtonsPrhaseDiv').insertBefore('#ordenaEPhrase');
        } else {
            $('#ordenaTimeShowDiv').show();
            $('#ordenaColumnsDiv').show();
            $('#ordenaActivityNumberDiv').show();
            $('#ordenaEDefinitionDiv').css({ display: 'flex' });
            $('#ordenaEPhrase').css({ display: 'flex' });
            $('#ordenaButtonCardDiv').show();
            $('#ordenaCustomizeCard').show();
            $('#ordenaFixedHeaders').show();
            $('#ordenaEBackDiv').show();
            $('#ordenaStartAutomaticallyDiv').show();
            $('#ordenaEPĥraseIDiv').hide();
            $('#ordenaEWordBorderDiv').hide();   
            $('#ordenaECustomMessagesDiv').show();
            $('#ordenaButtonsPrhaseDiv').insertBefore(
                'ordenaActivityNumberDiv',
            );
        }

        const customMessages = $('#ordenaECustomMessages').is(':checked');

        if (customMessages) {
            $('.ODNE-ECustomMessageDiv').slideDown();
        } else {
            $('.ODNE-ECustomMessageDiv').slideUp();
        }
    },

    removeCard: function () {
        const numcards = $('#ordenaEPhrase').find(
            'div.ODNE-EDatosCarta',
        ).length;
        if (numcards < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
        } else {
            const next = $('#ordenaEDatosCarta-' + $exeDevice.activeID)
                .next('div.ODNE-EDatosCarta')
                .data('id'),
                prev = $('#ordenaEDatosCarta-' + $exeDevice.activeID)
                    .prev('div.ODNE-EDatosCarta')
                    .data('id');
            if (prev != null) {
                $('#ordenaEDatosCarta-' + $exeDevice.activeID).remove();
                $exeDevice.activeID = prev;
            } else if (next != null) {
                $('#ordenaEDatosCarta-' + $exeDevice.activeID).remove();
                $exeDevice.activeID = next;
            }
            $('.ODNE-EDatosCarta').removeClass('ODNE-EActive');
            $('#ordenaEDatosCarta-' + $exeDevice.activeID).addClass(
                'ODNE-EActive',
            );
            $('#ordenaEPasteC').hide();
        }
    },

    copyCard: function () {
        $exeDevice.typeEditC = 0;
        $exeDevice.idPaste = $exeDevice.activeID;
        $('#ordenaEPasteC').show();
    },

    cutCard: function () {
        $exeDevice.typeEditC = 1;
        $exeDevice.idPaste = $exeDevice.activeID;
        $('#ordenaEPasteC').show();
    },

    pasteCard: function () {
        if ($exeDevice.typeEditC == 0) {
            const $cardcopy = $('#ordenaEDatosCarta-' + $exeDevice.idPaste),
                $cardactive = $('#ordenaEDatosCarta-' + $exeDevice.activeID),
                dataCard = $exeDevice.cardToJson($cardcopy);
            dataCard.id = $exeDevice.getID();
            $cardactive.after($exeDevice.jsonToCard(dataCard, true));
            $exeDevice.activeID = dataCard.id;
        } else if ($exeDevice.typeEditC == 1) {
            $('#ordenaEPasteC').hide();
            $exeDevice.typeEditC = -1;
            const $cardcopy = $('#ordenaEDatosCarta-' + $exeDevice.idPaste),
                $cardactive = $('#ordenaEDatosCarta-' + $exeDevice.activeID);
            if ($exeDevice.idPaste != $exeDevice.activeID) {
                $cardactive.after($cardcopy);
            }
        }
    },

    jsonToCard: function (p, inload) {
        const $card = $exeDevice.addCard(!inload);

        $card.find('.ODNE-EX').eq(0).val(p.x);
        $card.find('.ODNE-EY').eq(0).val(p.y);
        $card.find('.ODNE-EAuthor').eq(0).val(p.author);
        $card.find('.ODNE-EAlt').eq(0).val(p.alt);
        $card.find('.ODNE-EURLImage').eq(0).val(p.url);
        $card.find('.ODNE-EURLAudio').eq(0).val(p.audio);
        $card.find('.ODNE-EText').eq(0).val(p.eText);
        $card.find('.ODNE-ETextDiv').eq(0).text(p.eText);
        $card.find('.ODNE-EColor').eq(0).val(p.color);
        $card.find('.ODNE-EBackColor').eq(0).val(p.backcolor);

        $exeDevice.showImage($exeDevice.activeID);

        if (p.eText.trim().length > 0) {
            $card.find('.ODNE-ETextDiv').show();
        } else {
            $card.find('.ODNE-ETextDiv').hide();
        }
        $card
            .find('.ODNE-ETextDiv')
            .eq(0)
            .css({
                color: p.color,
                'background-color': $exeDevice.hexToRgba(p.backcolor, 0.7),
            });
        return $card;
    },

    getID: function () {
        return Math.floor(Math.random() * Date.now());
    },

    enableForm: function () {
        $exeDevice.initPhrases();

        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
    },

    updateQuestionsNumber: function () {
        const percentInput = parseInt(
            $exeDevice.removeTags($('#ordenaEPercentajeQuestions').val()),
        );

        if (isNaN(percentInput)) return;

        const percentaje = Math.min(Math.max(percentInput, 1), 100),
            totalWords = $exeDevice.phrasesGame.length,
            num = Math.max(1, Math.round((percentaje * totalWords) / 100));

        $('#ordenaENumeroPercentaje').text(`${num}/${totalWords}`);
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

        $('.ODNE-EDatosCarta').removeClass('ODNE-EActive');

        $exeDevice.activeID = $('.ODNE-EDatosCarta').eq(0).data('id');

        $('.ODNE-EDatosCarta').eq(0).addClass('ODNE-EActive');
        $('#ordenaEMessageOK').val(phrase.msgHit);
        $('#ordenaEMessageKO').val(phrase.msgError);
        $('#ordenaEDefinition').val(phrase.definition);
        $('#ordenaENumberPhrase').text($exeDevice.active + 1);
        $('#ordenaActivityNumber').text($exeDevice.active + 1);
        $('#ordenaEURLAudioDefinition').val(phrase.audioDefinition);
        $('#ordenaEURLAudioOK').val(phrase.audioHit);
        $('#ordenaEURLAudioKO').val(phrase.audioError);
        $('#ordenaEPraseI').val(phrase.phrase);

        $exeDevice.stopSound();
    },
    initPhrases: function () {
        $exeDevice.active = 0;
        $exeDevice.phrasesGame.push($exeDevice.getPhraseDefault());
        $exeDevice.addCard(false);
        $('.ODNE-ECustomMessageDiv').hide();
    },

    getPhraseDefault: function () {
        return {
            cards: [],
            msgError: '',
            msgHit: '',
            definition: '',
            phrase: '',
        };
    },

    getCardDefault: function () {
        return {
            id: '',
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
        };
    },

    addCard: function (clone) {
        $exeDevice.activeID = $exeDevice.getID();
        $('#ordenaEPhrase')
            .find('div.ODNE-EDatosCarta')
            .removeClass('ODNE-EActive');

        const path = $exeDevice.idevicePath,
            card = `
            <div class="ODNE-EDatosCarta ODNE-EActive" id="ordenaEDatosCarta-${$exeDevice.activeID}" data-id="${$exeDevice.activeID}">
               <div class="ODNE-EMultimedia">
                    <div class="ODNE-ECard">
                        <img class="ODNE-EHideODNE-EImage" id="ordenaEImage-${$exeDevice.activeID}" src="${path}quextIEImage.png" alt="${_('No image')}" />
                        <img class="ODNE-ECursor" id="ordenaECursor-${$exeDevice.activeID}" src="${path}quextIECursor.gif" alt="" />
                        <img class="ODNE-EHideODNE-NoImage" id="ordenaENoImage-${$exeDevice.activeID}" src="${path}quextIEImage.png" alt="${_('No image')}" />
                        <div class="ODNE-ETextDiv" id="ordenaETextDiv-${$exeDevice.activeID}"></div>
                    </div>
                </div>
               <span class="ODNE-ETitleText" id="ordenaETitleText-${$exeDevice.activeID}">${_('Text')}</span>
               <div class="ODNE-EInputText" id="ordenaEInputText-${$exeDevice.activeID}">
                    <label class="sr-av">${_('Text')}</label><input type="text" id="ordenaEText-${$exeDevice.activeID}" class="ODNE-EText" />
                    <label id="ordenaELblColor-${$exeDevice.activeID}" class="ODNE-LblColor">${_('Color')}: </label><input id="ordenaEColor-${$exeDevice.activeID}" type="color" class="ODNE-EColor" value="#000000">
                    <label id="ordenaELblBgColor-${$exeDevice.activeID}" class="ODNE-LblBgColor">${_('Background')}: </label><input id="ordenaEBgColor-${$exeDevice.activeID}" type="color" class="ODNE-EBackColor" value="#ffffff">
                </div>
               <span class="ODNE-ETitleImage" id="ordenaETitleImage-${$exeDevice.activeID}">${_('Image')}</span>
               <div class="ODNE-EInputImage" id="ordenaEInputImage-${$exeDevice.activeID}">
                   <label class="sr-av">URL</label>
                   <input type="text" id="ordenaEURLImage-${$exeDevice.activeID}" class="exe-file-picker ODNE-EURLImage"/>
                   <a href="#" id="ordenaEPlayImage-${$exeDevice.activeID}" class="ODNE-ENavigationButton ODNE-EPlayVideo" title="${_('Show')}"><img src="${path}quextIEPlay.png" alt="${_('Show')}" class="ODNE-EButtonImage b-play" /></a>
                   <a href="#" id="ordenaEShowMore-${$exeDevice.activeID}" class="ODNE-ENavigationButton ODNE-EShowMore" title="${_('More')}"><img src="${path}quextEIMore.png" alt="${_('More')}" class="ODNE-EButtonImage b-play" /></a>
               </div>
               <div class="ODNE-ECoord">
                   <label>X:</label>
                   <input id="ordenaEX-${$exeDevice.activeID}" class="ODNE-EX" type="text" value="0" />
                   <label>Y:</label>
                   <input id="ordenaEY-${$exeDevice.activeID}" class="ODNE-EY" type="text" value="0" />
               </div>
               <div class="ODNE-EAuthorAlt" id="ordenaEAuthorAlt-${$exeDevice.activeID}">
                   <div class="ODNE-EInputAuthor">
                       <label>${_('Author')}</label><input type="text" class="ODNE-EAuthor" />
                   </div>
                   <div class="ODNE-EInputAlt">
                       <label>${_('Alternative text')}</label><input type="text" class="ODNE-EAlt" />
                   </div>
               </div>
               <span>${_('Audio')}</span>
               <div class="ODNE-EInputAudio">
                   <label class="sr-av">URL</label>
                   <input type="text" id="ordenaEURLAudio-${$exeDevice.activeID}" class="exe-file-picker ODNE-EURLAudio" />
                   <a href="#" id="ordenaEPlayAudio-${$exeDevice.activeID}" class="ODNE-ENavigationButton ODNE-EPlayVideo" title="${_('Audio')}"><img src="${path}quextIEPlay.png" alt="Play" class="ODNE-EButtonImage b-play" /></a>
               </div>
           </div>`;
        $('#ordenaEPhrase').append(card);
        if (clone) {
            $exeDevice.addPickerButton($exeDevice.activeID);
        }

        const $card = $('#ordenaEPhrase').find('div.ODNE-EDatosCarta').last();

        $exeDevice.addEventCard($exeDevice.activeID);
        $exeDevice.showImage($exeDevice.activeID);
        $('#ordenaETextDiv-' + $exeDevice.activeID).hide();
        return $card;
    },

    addPickerButton: function (cardId) {
        const $container = $('#ordenaEDatosCarta-' + cardId);
        if (!$container.length) return;

        $container
            .find(
                '.exe-file-picker:not(.initialized), .exe-image-picker:not(.initialized)',
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
                        style: 'display:none;',
                    }).on('change', function (event) {
                        $exeDevice.processFile(event.target.files[0], id, type);
                    });
                    $container.append($fileInput);
                }
                if (
                    !$container.find(
                        `input[type="button"][data-filepicker="${id}"]`,
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
        $('#ordenaEAuthorAlt-' + id).hide();

        $('#ordenaEURLImage-' + id).on('change', function () {
            $exeDevice.loadImage(id);
        });

        $('#ordenaEPlayImage-' + id).on('click', function (e) {
            e.preventDefault();
            $exeDevice.loadImage(id);
        });

        $('#ordenaEURLAudio-' + id).on('change', function () {
            $exeDevice.loadAudio($(this).val());
        });

        $('#ordenaEPlayAudio-' + id).on('click', function (e) {
            e.preventDefault();
            const audio = $('#ordenaEURLAudio-' + id).val();
            $exeDevice.loadAudio(audio);
        });

        $('#ordenaEShowMore-' + id).on('click', function (e) {
            e.preventDefault();
            $('#ordenaEAuthorAlt-' + id).slideToggle();
        });

        $('#ordenaEText-' + id).on('keyup', function () {
            $('#ordenaETextDiv-' + id).text($(this).val());
            if ($(this).val().trim().length > 0) {
                $('#ordenaETextDiv-' + $exeDevice.activeID).show();
            } else {
                $('#ordenaETextDiv-' + $exeDevice.activeID).hide();
            }
        });

        $('#ordenaEColor-' + id).on('change', function () {
            $('#ordenaETextDiv-' + id).css('color', $(this).val());
        });

        $('#ordenaEBgColor-' + id).on('change', function () {
            const bc = $exeDevice.hexToRgba($(this).val(), 0.7);
            $('#ordenaETextDiv-' + id).css({
                'background-color': bc,
            });
        });

        $('#ordenaEImage-' + id).on('click', function (e) {
            $exeDevice.clickImage(id, e.pageX, e.pageY);
        });

        $('#ordenaECursor-' + id).on('click', function () {
            $(this).hide();
            $('#ordenaEX-' + id).val(0);
            $('#ordenaEY-' + id).val(0);
        });
    },

    cardToJson: function ($card) {
        return {
            id: $card.data('id'),
            type: 2,
            x: parseFloat($card.find('.ODNE-EX').eq(0).val()),
            y: parseFloat($card.find('.ODNE-EY').eq(0).val()),
            author: $card.find('.ODNE-EAuthor').eq(0).val(),
            alt: $card.find('.ODNE-EAlt').eq(0).val(),
            url: $card.find('.ODNE-EURLImage').eq(0).val(),
            audio: $card.find('.ODNE-EURLAudio').eq(0).val(),
            eText: $card.find('.ODNE-EText').eq(0).val(),
            color: $card.find('.ODNE-EColor').eq(0).val(),
            backcolor: $card.find('.ODNE-EBackColor').eq(0).val(),
        };
    },

    validatePhrase: function () {
        let correct = true;
        const phrase = $exeDevice.getPhraseDefault(),
            $cards = $('#ordenaEPhrase').find('div.ODNE-EDatosCarta'),
            orderedColumns = $('#ordenaOrderedColumns').is(':checked'),
            gameColumns = parseInt(
                $('input.ODNE-EColumns[name=odncolumns]:checked').val(),
            ),
            type = parseInt($('input.ODNE-EType[name=odntype]:checked').val());

        $cards.each(function name() {
            const card = $exeDevice.cardToJson($(this));
            if (type == 1 && !$exeDevice.validateCard(card)) {
                correct = false;
            } else {
                phrase.cards.push(card);
            }
        });

        if (type == 1 && gameColumns > 1 && orderedColumns) {
            if (phrase.cards.length <= gameColumns) {
                $exeDevice.showMessage($exeDevice.msgs.msgCardsColumn);
                return false;
            }
        }

        if (type == 0) {
            const ph = $('#ordenaEPraseI').val();
            if (ph.trim().length < 1) {
                $exeDevice.showMessage($exeDevice.msgs.msgEOneWord);
                return false;
            }
        }

        if (!correct) return false;

        phrase.msgHit = $('#ordenaEMessageOK').val();
        phrase.msgError = $('#ordenaEMessageKO').val();
        phrase.definition = $('#ordenaEDefinition').val();
        phrase.audioDefinition = $('#ordenaEURLAudioDefinition').val();
        phrase.audioHit = $('#ordenaEURLAudioOK').val();
        phrase.audioError = $('#ordenaEURLAudioKO').val();
        phrase.phrase = $('#ordenaEPraseI').val();
        $exeDevice.phrasesGame[$exeDevice.active] = phrase;

        return true;
    },

    validateCard: function (p) {
        let message = '';
        if (p.eText.length == 0 && p.url.length < 5 && p.audio.length == 0) {
            message = $exeDevice.msgs.msgCompleteData;
            $exeDevice.showMessage(message);
        }

        return message === '';
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

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            const wrapper = $('<div></div>');

            wrapper.html(originalHTML);

            let json = $('.ordena-DataGame', wrapper).text();
            json = $exeDevices.iDevice.gamification.helpers.decrypt(json);

            const dataGame =
                $exeDevices.iDevice.gamification.helpers.isJsonString(json),
                $audiosDef = $('.ordena-LinkAudiosDef', wrapper),
                $audiosError = $('.ordena-LinkAudiosError', wrapper),
                $audiosHit = $('.ordena-LinkAudiosHit', wrapper),
                $imageBack = $('.ordena-ImageBack', wrapper);

            dataGame.imgCard = '';
            if ($imageBack.length === 1) {
                dataGame.imgCard = $imageBack.attr('href') || '';
            }

            for (let i = 0; i < dataGame.phrasesGame.length; i++) {
                const $imagesLink = $('.ordena-LinkImages-' + i, wrapper),
                    $audiosLink = $('.ordena-LinkAudios-' + i, wrapper),
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
                    dataGame.phrasesGame[i].phrase == null
                        ? ''
                        : dataGame.phrasesGame[i].phrase;
            }

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

            const instructions = $('.ordena-instructions', wrapper);
            if (instructions.length == 1)
                $('#eXeGameInstructions').val(instructions.html());

            const textAfter = $('.ordena-extra-content', wrapper);
            if (textAfter.length == 1)
                $('#eXeIdeviceTextAfter').val(textAfter.html());

            const textFeedBack = $('.ordena-feedback-game', wrapper);
            if (textFeedBack.length == 1)
                $('#ordenaEFeedBackEditor').val(textFeedBack.html());

            $exeDevices.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs,
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

        const textFeedBack = tinyMCE.get('ordenaEFeedBackEditor').getContent();

        if (dataGame.instructions != '')
            divContent =
                '<div class="ordena-instructions">' +
                dataGame.instructions +
                '</div>';

        let imgCard = $('#ordenaEURLImgCard').val();
        if (imgCard.trim().length > 4) {
            imgCard = `<a href="${imgCard}" class="js-hidden ordena-ImageBack" alt="Back" />Background</a>`;
        } else {
            imgCard = '';
        }

        let linksImages = $exeDevice.createlinksImage(dataGame.phrasesGame),
            linksAudios = $exeDevice.createlinksAudio(dataGame.phrasesGame);

        let html = '<div class="ordena-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html += '<div class="ordena-feedback-game">' + textFeedBack + '</div>';
        html += divContent;
        html += '<div class="ordena-DataGame js-hidden">' + json + '</div>';
        
        html += linksImages;
        html += linksAudios;
        html += imgCard;
        const textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();
        if (textAfter != '') {
            html += '<div class="ordena-extra-content">' + textAfter + '</div>';
        }
        html +=
            '<div class="ordena-bns js-hidden">' +
            $exeDevice.msgs.msgNoSuportBrowser +
            '</div>';
        html += '</div>';

        return html;
    },

    validateAlt: function () {
        let altImage = $('#quextEAlt').val();

        if (!$exeDevice.checkAltImage) return true;

        if (altImage !== '') return true;

        eXe.app.confirm(
            $exeDevice.msgs.msgTitleAltImageWarning,
            $exeDevice.msgs.msgAltImageWarning,
            function () {
                $exeDevice.checkAltImage = false;
                let saveButton = document.getElementsByClassName(
                    'button-save-idevice',
                )[0];
                saveButton.click();
            },
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
                        '" class="js-hidden ordena-LinkImages-' +
                        i +
                        '">' +
                        k +
                        '</a>';
                }
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
                        '" class="js-hidden ordena-LinkAudios-' +
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
                    '" class="js-hidden ordena-LinkAudiosDef">' +
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
                    '" class="js-hidden ordena-LinkAudiosHit">' +
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
                    '" class="js-hidden ordena-LinkAudiosError">' +
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
            textFeedBack = tinyMCE.get('ordenaEFeedBackEditor').getContent(),
            textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent(),
            showMinimize = $('#ordenaEShowMinimize').is(':checked'),
            wordBorder = $('#ordenaEWordBorder').is(':checked'),
            itinerary = $exeDevices.iDevice.gamification.itinerary.getValues(),
            caseSensitive = $('#ordenaECaseSensitive').is(':checked'),
            feedBack = $('#ordenaEHasFeedBack').is(':checked'),
            percentajeFB = parseInt(clear($('#ordenaEPercentajeFB').val())),
            customMessages = $('#ordenaECustomMessages').is(':checked'),
            percentajeQuestions = parseInt(
                clear($('#ordenaEPercentajeQuestions').val()),
            ),
            time = parseInt(clear($('#ordenaETime').val())),
            timeShowSolution = parseInt(
                clear($('#ordenaETimeShowSolution').val()),
            ),
            cardHeight = parseInt(clear($('#ordenaCardHeight').val())),
            startAutomatically = $('#ordenaStartAutomatically').is(':checked'),
            gameColumns = parseInt(
                $('input.ODNE-EColumns[name=odncolumns]:checked').val(),
            ),
            author = $('#ordenaEAuthor').val(),
            showSolution = $('#ordenaEShowSolution').is(':checked'),
            maxWidth = $('#ordenaMaxWidth').is(':checked'),
            orderedColumns = $('#ordenaOrderedColumns').is(':checked'),
            phrasesGame = $exeDevice.phrasesGame,
            evaluation = $('#ordenaEEvaluation').is(':checked'),
            evaluationID = $('#ordenaEEvaluationID').val(),
            id = $exeDevice.getIdeviceID(),
            type = parseInt($('input.ODNE-EType[name=odntype]:checked').val());

        if (!itinerary) return;

        if (evaluation && evaluationID.length < 5) {
            eXe.app.alert($exeDevice.msgs.msgIDLenght);
            return false;
        }
        if (phrasesGame.length == 0) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
            return false;
        }

        const scorm = $exeDevices.iDevice.gamification.scorm.getValues();

        return {
            typeGame: 'Ordena',
            author: author,
            instructions: instructions,
            showMinimize: showMinimize,
            showSolution: showSolution,
            itinerary: itinerary,
            phrasesGame: phrasesGame,
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
            version: $exeDevice.version,
            maxWidth: maxWidth,
            cardHeight: cardHeight,
            startAutomatically: startAutomatically,
            orderedColumns: orderedColumns,
            gameColumns: gameColumns,
            evaluation: evaluation,
            evaluationID: evaluationID,
            wordBorder:wordBorder,
            id: id,
            type: type,
        };
    },

    showImage: function (id) {
        const $cursor = $('#ordenaECursor-' + id),
            $image = $('#ordenaEImage-' + id),
            $nimage = $('#ordenaENoImage-' + id),
            x = parseFloat($('#ordenaEX-' + id).val()),
            y = parseFloat($('#ordenaEY-' + id).val()),
            alt = $('#ordenaEAlt-' + id).val(),
            url = $('#ordenaEURLImage-' + id).val();

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
                        this.naturalHeight,
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
                'z-index': 30,
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

    addEvents: function () {
        $('#ordenaEPasteC').hide();

        $('#ordenaEAddC').on('click', function (e) {
            e.preventDefault();
            $exeDevice.addCard(true);
        });

        $('#ordenaEDeleteC').on('click', function (e) {
            e.preventDefault();
            $exeDevice.removeCard();
        });

        $('#ordenaECopyC').on('click', function (e) {
            e.preventDefault();
            $exeDevice.copyCard();
        });

        $('#ordenaECutC').on('click', function (e) {
            e.preventDefault();
            $exeDevice.cutCard();
        });

        $('#ordenaEPasteC').on('click', function (e) {
            e.preventDefault();
            $exeDevice.pasteCard();
        });

        $('#ordenaEPhrase').on('click', '.ODNE-EDatosCarta', function () {
            $exeDevice.activeID = $(this).data('id');
            $('.ODNE-EDatosCarta').removeClass('ODNE-EActive');
            $(this).addClass('ODNE-EActive');
        });

        $('#ordenaEPaste').hide();

        $('input.ODNE-GameMode').on('click', function () {
            $('#ordenaEDatosCarta-2').hide();
            $('#ordenaEDatosCarta-3').hide();
            const type = parseInt($(this).val());
            if (type == 1) {
                $('#ordenaEDatosCarta-2').show();
            } else if (type == 2) {
                $('#ordenaEDatosCarta-2').show();
                $('#ordenaEDatosCarta-3').show();
            }
        });

        $('#ordenaEAdd').on('click', function (e) {
            e.preventDefault();
            $exeDevice.addPhrase();
        });

        $('#ordenaEFirst').on('click', function (e) {
            e.preventDefault();
            $exeDevice.firstPhrase();
        });

        $('#ordenaEPrevious').on('click', function (e) {
            e.preventDefault();
            $exeDevice.previousPhrase();
        });

        $('#ordenaENext').on('click', function (e) {
            e.preventDefault();
            $exeDevice.nextPhrase();
        });

        $('#ordenaELast').on('click', function (e) {
            e.preventDefault();
            $exeDevice.lastPhrase();
        });

        $('#ordenaEDelete').on('click', function (e) {
            e.preventDefault();
            $exeDevice.removePhrase();
        });

        $('#ordenaECopy').on('click', function (e) {
            e.preventDefault();
            $exeDevice.copyPhrase();
        });

        $('#ordenaEPaste').on('click', function (e) {
            e.preventDefault();
            $exeDevice.pastePhrase();
        });

        $('#ordenaEHasFeedBack').on('change', function () {
            const marcado = $(this).is(':checked');
            if (marcado) {
                $('#ordenaEFeedbackP').slideDown();
            } else {
                $('#ordenaEFeedbackP').slideUp();
            }
            $('#ordenaEPercentajeFB').prop('disabled', !marcado);
        });

        $('#ordenaECustomMessages').on('change', function () {
            const messages = $(this).is(':checked');
            if (messages) {
                $('.ODNE-ECustomMessageDiv').slideDown();
            } else {
                $('.ODNE-ECustomMessageDiv').slideUp();
            }
        });

        $('#ordenaEPercentajeQuestions').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 3);
            this.value = v;
            if (this.value > 0 && this.value < 101) {
                $exeDevice.updateQuestionsNumber();
            }
        });

        $('#ordenaEPercentajeQuestions').on('focusout', function () {
            this.value = this.value.trim() == '' ? 100 : this.value;
            this.value = this.value > 100 ? 100 : this.value;
            this.value = this.value < 1 ? 1 : this.value;
            $exeDevice.updateQuestionsNumber();
        });

        $('#ordenaETime').on('focusout', function () {
            this.value = this.value.trim() == '' ? 0 : this.value;
            this.value = this.value > 999 ? 999 : this.value;
            this.value = this.value < 0 ? 0 : this.value;
        });

        $('#ordenaCardHeight').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 3);
            this.value = v;
        });

        $('#ordenaCardHeight').on('focusout', function () {
            this.value = this.value.trim() == '' ? 0 : this.value;
            this.value = this.value > 1000 ? 1000 : this.value;
            this.value = this.value < 0 ? 0 : this.value;
        });

        $('#ordenaETime').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 3);
            this.value = v;
        });

        $('#ordenaEPercentajeQuestions').on('click', function () {
            $exeDevice.updateQuestionsNumber();
        });

        $('#ordenaETimeShowSolution').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 3);
            this.value = v;
        });

        $('#ordenaETimeShowSolution').on('focusout', function () {
            this.value = this.value.trim() == '' ? 3 : this.value;
            this.value = this.value > 999 ? 999 : this.value;
            this.value = this.value < 1 ? 1 : this.value;
        });

        $('#ordenaEURLAudioDefinition').on('change', function () {
            $exeDevice.loadAudio($(this).val());
        });

        $('#ordenaEPlayAudioDefinition').on('click', function (e) {
            e.preventDefault();
            const audio = $('#ordenaEURLAudioDefinition').val();
            $exeDevice.loadAudio(audio);
        });

        $('#ordenaEURLAudioOK').on('change', function () {
            $exeDevice.loadAudio($(this).val());
        });

        $('#ordenaEPlayAudioOK').on('click', function (e) {
            e.preventDefault();
            const audio = $('#ordenaEURLAudioOK').val();
            $exeDevice.loadAudio(audio);
        });

        $('#ordenaEURLAudioKO').on('change', function () {
            $exeDevice.loadAudio($(this).val());
        });

        $('#ordenaEPlayAudioKO').on('click', function (e) {
            e.preventDefault();
            const audio = $('#ordenaEURLAudioKO').val();
            $exeDevice.loadAudio(audio);
        });

        $('#ordenaMaxWidth').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#ordenaCardHeight').prop('disabled', !marcado);
        });

        $('#gameQEIdeviceForm').css({
            'max-width': '100%',
        });

        $('#gameQEIdeviceForm').on(
            'change',
            'input.ODNE-EColumns',
            function () {
                const number = parseInt($(this).val()),
                    ordered = $('#ordenaOrderedColumns').is(':checked');
                if (number == 0) {
                    $('#ordenaCustomizeCard').hide();
                } else {
                    $('#ordenaCustomizeCard').show();
                }
                if (number > 1) {
                    $('#ordenaFixedHeaders').show();
                } else {
                    $('#ordenaFixedHeaders').hide();
                }
                const type = parseInt(
                    $('input.ODNE-EType[name=odntype]:checked').val(),
                );
                if (type == 1) {
                    $exeDevice.resizePanel(ordered, number);
                }
            },
        );

        $('#gameQEIdeviceForm').on('change', 'input.ODNE-EType', function () {
            const type = parseInt($(this).val());
            $exeDevice.showTypeGame(type);
        });

        $('#ordenaOrderedColumns').on('change', function () {
            const number = parseInt(
                $('input.ODNE-EColumns[name=odncolumns]:checked').val(),
            ),
                ordered = $(this).is(':checked'),
                type = parseInt(
                    $('input.ODNE-EType[name=odntype]:checked').val(),
                );
            if (type == 1) {
                $exeDevice.resizePanel(ordered, number);
            }
        });

        $('#ordenaEEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#ordenaEEvaluationID').prop('disabled', !marcado);
        });

        $('#ordenaEEvaluationHelpLnk').click(function () {
            $('#ordenaEEvaluationHelp').toggle();
            return false;
        });

        const gameColumns = parseInt(
            $('input.ODNE-EColumns[name=odncolumns]:checked').val(),
        ),
            orderedColumns = $('#ordenaOrderedColumns').is(':checked'),
            type = parseInt($('input.ODNE-EType[name=odntype]:checked').val());
        if (type == 1) {
            $exeDevice.resizePanel(orderedColumns, gameColumns);
        }
        $exeDevices.iDevice.gamification.itinerary.addEvents();

        $('.exe-block-dismissible .exe-block-close').click(function () {
            $(this).parent().fadeOut();
            return false;
        });

        $('.sortable_container').on('dragenter', function (e) {
            e.preventDefault();
            $(this).addClass('drag-over');
        });

        $('.sortable_container').on('dragleave', function () {
            $(this).removeClass('drag-over');
        });

        $('.sortable_container').on('drop', function () {
            $(this).removeClass('drag-over');
        });
        $('#ordenaEURLImgCard').on('change', () =>
            $exeDevice.loadImageCard(),
        );

    },
    loadImageCard: function () {
        const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
            url = $('#ordenaEURLImgCard').val(),
            ext = url.split('.').pop().toLowerCase();

        if (
            (url.indexOf('files') == 0) &&
            validExt.indexOf(ext) == -1
        ) {
            $exeDevice.showMessage(
                _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp',
            );
            return false;
        }
        $exeDevice.showImageCard(url);
    },


    resizePanel: function (ordered, number) {
        let wd = 1100;
        if (ordered && number > 0) {
            wd = $('div.ODNE-EDatosCarta').eq(0).width() * (number + 1) - 100;
        }
        wd = wd < 700 ? 800 : wd;
        wd = wd > 1200 ? 1200 : wd;
        $('#ordenaEPhrase').width(wd);
        $('#ordenaEPhrase').css({
            'max-width': wd + 'px',
        });
        $('#gameQEIdeviceForm').css({
            'max-width': wd + 'px',
        });
        $('#gameQEIdeviceForm').width(wd);
    },

    loadImage: function (id) {
        const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
            url = $('#ordenaEURLImage-' + id).val(),
            ext = url.split('.').pop().toLowerCase();
        if (
            url.indexOf('files') == 0 &&
            validExt.indexOf(ext) == -1
        ) {
            $exeDevice.showMessage(
                _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp',
            );
            return false;
        }
        $exeDevice.showImage(id);
    },

    loadAudio: function (url) {
        const validExt = ['mp3', 'wab', 'ogg'],
            ext = url.split('.').pop().toLowerCase();
        if (
            url.indexOf('files') == 0 &&
            validExt.indexOf(ext) == -1
        ) {
            $exeDevice.showMessage(_('Supported formats') + ': mp3, wav, ogg');
            return false;
        } else {
            if (url.length > 4) {
                $exeDevice.stopSound();
                $exeDevice.playSound(url);
            }
        }
    },

    updateGameMode: function (feedback) {
        $('#ordenaEHasFeedBack').prop('checked', feedback);
        if (feedback) {
            $('#ordenaEFeedbackP').slideDown();
        }
        if (!feedback) {
            $('#ordenaEFeedbackP').slideUp();
        }
    },

    clearPhrase: function () {
        $('#ordenaEPhrase').empty();
        $('#ordenaEPraseI').val('');
    },

    addPhrase: function () {
        if ($exeDevice.phrasesGame.length >= 20) {
            $exeDevice.showMessage($exeDevice.msgs.msgPairsMax);
            return;
        }

        const valida = $exeDevice.validatePhrase();
        if (valida) {
            $exeDevice.clearPhrase();
            $exeDevice.phrasesGame.push($exeDevice.getPhraseDefault());
            $exeDevice.addCard(true);
            $exeDevice.active = $exeDevice.phrasesGame.length - 1;
            $('#ordenaENumberPhrase').text($exeDevice.phrasesGame.length);
            $exeDevice.typeEdit = -1;
            $('#ordenaEPaste').hide();
            $('#ordenaENumPhrases').text($exeDevice.phrasesGame.length);
            $('#ordenaActivityNumber').text($exeDevice.phrasesGame.length);
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
            $('#ordenaEPaste').hide();
            $('#ordenaENumPhrases').text($exeDevice.phrasesGame.length);
            $('#ordenaENumberPhrase').text($exeDevice.active + 1);
            $('#ordenaActivityNumber').text($exeDevice.active + 1);
            $exeDevice.updateQuestionsNumber();
        }
    },

    copyPhrase: function () {
        if ($exeDevice.validatePhrase()) {
            $exeDevice.typeEdit = 0;
            $exeDevice.clipBoard = JSON.parse(
                JSON.stringify($exeDevice.phrasesGame[$exeDevice.active]),
            );
            $('#ordenaEPaste').show();
        }
    },
    cutPhrase: function () {
        if ($exeDevice.validatePhrase()) {
            $exeDevice.numberCutCuestion = $exeDevice.active;
            $exeDevice.typeEdit = 1;
            $('#ordenaEPaste').show();
        }
    },

    pastePhrase: function () {
        if ($exeDevice.phrasesGame.length >= 20) {
            $exeDevice.showMessage($exeDevice.msgs.msgPairsMax);
            return;
        }
        if ($exeDevice.typeEdit == 0) {
            $exeDevice.active++;
            const p = $.extend(true, {}, $exeDevice.clipBoard);
            $exeDevice.phrasesGame.splice($exeDevice.active, 0, p);
            $exeDevice.showPhrase($exeDevice.active, true);
            $('#ordenaENumPhrases').text($exeDevice.phrasesGame.length);
        } else if ($exeDevice.typeEdit == 1) {
            $('#ordenaEPaste').hide();
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                $exeDevice.phrasesGame,
                $exeDevice.numberCutCuestion,
                $exeDevice.active,
            );
            $exeDevice.showPhrase($exeDevice.active);
            $('#ordenaENumPhrases').text($exeDevice.phrasesGame.length);
            $('#ordenaENumberPhrase').text($exeDevice.active + 1);
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
        $exeDevices.iDevice.gamification.itinerary.setValues(game.itinerary);
        game.maxWidth =
            typeof game.maxWidth == 'undefined' ? false : game.maxWidth;
        game.orderedColumns =
            typeof game.orderedColumns == 'undefined'
                ? false
                : game.orderedColumns;
        game.cardHeight =
            typeof game.cardHeight == 'undefined' ? 200 : game.cardHeight;
        game.startAutomatically =
            typeof game.startAutomatically == 'undefined'
                ? false
                : game.startAutomatically;
        game.evaluation =
            typeof game.evaluation != 'undefined' ? game.evaluation : false;
        game.evaluationID =
            typeof game.evaluationID != 'undefined' ? game.evaluationID : '';
        game.weighted =
            typeof game.weighted !== 'undefined' ? game.weighted : 100;
        game.type = typeof game.type != 'undefined' ? game.type : 1;
        game.wordBorder = 
            typeof game.wordBorder !== 'undefined' ? game.wordBorder : true;
        $exeDevice.id = $exeDevice.getIdeviceID();

        $('#ordenaEShowMinimize').prop('checked', game.showMinimize);
        $('#ordenaEWordBorder').prop('checked', game.wordBorder);
        $('#ordenaECaseSensitive').prop('checked', game.caseSensitive);
        $('#ordenaEHasFeedBack').prop('checked', game.feedBack);
        $('#ordenaEPercentajeFB').val(game.percentajeFB);
        $('#ordenaEPercentajeQuestions').val(game.percentajeQuestions);
        $('#ordenaETime').val(game.time);
        $('#ordenaETimeShowSolution').val(game.timeShowSolution);
        $('#ordenaEAuthor').val(game.author);
        $('#ordenaEShowSolution').prop('checked', game.showSolution);

        $exeDevices.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted,
        );
        $exeDevice.phrasesGame = game.phrasesGame;
        $exeDevice.updateGameMode(game.feedBack);

        $('#ordenaENumPhrases').text($exeDevice.phrasesGame.length);
        $('#ordenaEPercentajeFB').prop('disabled', !game.feedBack);
        $('#ordenaECustomMessages').prop('checked', game.customMessages);

        $(
            "input.ODNE-EColumns[name='odncolumns'][value='" +
            game.gameColumns +
            "']",
        ).prop('checked', true);

        $('#ordenaEURLImgCard').val(game.imgCard)

        $exeDevice.showImageCard(game.imgCard)

        $exeDevice.updateQuestionsNumber();

        $('#ordenaCardHeight').val(game.cardHeight);
        $('#ordenaCardHeight').prop('disabled', !game.maxWidth);
        $('#ordenaStartAutomatically').prop('checked', game.startAutomatically);
        $('#ordenaMaxWidth').prop('checked', game.maxWidth);
        $('#ordenaOrderedColumns').prop('checked', game.orderedColumns);
        $('#ordenaEEvaluation').prop('checked', game.evaluation);
        $('#ordenaEEvaluationID').val(game.evaluationID);
        $('#ordenaEEvaluationID').prop('disabled', !game.evaluation);
        $("input.ODNE-EType[name='odntype'][value='" + game.type + "']").prop(
            'checked',
            true,
        );

        $exeDevice.showTypeGame(game.type);

        if (game.type == 1 && game.customMessages) {
            $('.ODNE-ECustomMessageDiv').slideDown();
        } else {
            $('.ODNE-ECustomMessageDiv').slideUp();
        }
        if (game.type == 1 && game.gameColumns > 0) {
            $('#ordenaCustomizeCard').show();
        } else {
            $('#ordenaCustomizeCard').hide();
        }
        if (game.type == 1 && game.gameColumns > 1) {
            $('#ordenaFixedHeaders').show();
        } else {
            $('#ordenaFixedHeaders').hide();
        }
    },

    showImageCard: function (url) {
        $image = $('#ordenaECard');
        $nimage = $('#ordenaENoCard');
        $image.hide();
        $nimage.show();
        if (!url) return;
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

    importGame: function (content) {
        const game =
            $exeDevices.iDevice.gamification.helpers.isJsonString(content);

        if (!game || typeof game.typeGame == 'undefined') {
            eXe.app.alert($exeDevice.msgs.msgESelectFile);
            return;
        } else if (game.typeGame !== 'Ordena') {
            eXe.app.alert($exeDevice.msgs.msgESelectFile);
            return;
        }

        game.id =  $exeDevice.getIdeviceID();

        $exeDevice.updateFieldGame(game);

        const instructions = game.instructionsExe || game.instructions,
            tAfter = game.textAfter || '',
            textFeedBack = game.textFeedBack || '';
        tinyMCE.get('eXeGameInstructions').setContent(unescape(instructions));
        tinyMCE.get('eXeIdeviceTextAfter').setContent(unescape(tAfter));
        tinyMCE.get('ordenaEFeedBackEditor').setContent(unescape(textFeedBack));
        $('.exe-form-tabs li:first-child a').click();
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
        const $cursor = $('#ordenaECursor-' + id),
            $image = $('#ordenaEImage-' + id),
            $x = $('#ordenaEX-' + id),
            $y = $('#ordenaEY-' + id),
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
            'z-index': 30,
        });
        $cursor.show();
    },

    removeTags: function (str) {
        const wrapper = $('<div></div>');
        wrapper.html(str);
        return wrapper.text();
    },
};
