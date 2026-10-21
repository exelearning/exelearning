/* eslint-disable no-undef */
/**
/**
 * Drag and drop Activity iDevice (edition code)
 * Version: 1
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narvaez Martinez
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */

var $exeDevice = {
    name: 'Drag and drop',
    title: _('Drag and drop', 'dragdrop'),
    msgs: {},
    classIdevice: 'dragdrop',
    active: 0,
    activeCard: 0,
    activeID: '',
    cardsGame: [],
    typeEdit: -1,
    idPaste: '',
    numberCutCuestion: -1,
    clipBoard: '',
    idevicePath: '',
    version: 2.0,
    id: false,
    mode: false,
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
        this.active = 0;
    },

    refreshTranslations: function () {
        this.ci18n = {
            msgSubmit: c_('Submit'),
            msgClue: c_('Cool! The clue is:'),
            msgCodeAccess: c_('Access code'),
            msgPlayStart: c_('Click here to play'),
            msgScore: c_('Score'),
            msgWeight: c_('Weight'),
            msgErrors: c_('Errors'),
            msgHits: c_('Hits'),
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
                'You need at least %s% of correct answers to get the information. Please try again.'
            ),
            msgEndGameM: c_('You finished the game. Your score is %s.'),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgPassScore: c_('Minimum score needed to pass this activity: %s'),
            msgTypeGame: c_('Drag and drop'),
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
            'You must complete the text and add an image or video'
        );
        msgs.msgCompleteDataBack = _(
            'You must complete the text and add an image or video'
        );
        msgs.msgEOneCard = _('Please create at least one activity');
        msgs.msgTitleAltImageWarning = _('Accessibility warning');
        msgs.msgAltImageWarning = _(
            'At least one image has no description, are you sure you want to continue without including it? Without it the image may not be accessible to some users with disabilities, or to those using a text browser, or browsing the Web with images turned off.'
        );
    },

    createForm: function () {
        const edition = $exeIDevicesEdition.iDevice;
        const path = this.idevicePath;

        const optionsHtml = `
            <div id="dragdropEOptions">
                <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                    <span>${_('Source')}:</span>
                    <div class="form-check form-check-inline m-0">
                        <input class="DAD-Drags form-check-input" checked id="dadEDragMedia" type="radio" name="flctypedrag" value="0"/>
                        <label for="dadEDragMedia" class="form-check-label">${_('Media')}</label>
                    </div>
                    <div class="form-check form-check-inline m-0">
                        <input class="DAD-Drags form-check-input" id="dadEDragDefintion" type="radio" name="flctypedrag" value="1"/>
                        <label for="dadEDragDefintion" class="form-check-label">${_('Text')}</label>
                    </div>
                    ${edition.common.getHelpTooltip(
                        _('Select whether players drag media (images or audio) onto text or text onto media.')
                    )}
                </div>
                <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                    <span>${_('Level')}:</span>
                    <div class="form-check form-check-inline m-0">
                        <input class="DAD-Type form-check-input" id="dadETypeShow" type="radio" name="flctype" value="0"/>
                        <label for="dadETypeShow" class="form-check-label">${_('Essential')}</label>
                    </div>
                    <div class="form-check form-check-inline m-0">
                        <input class="DAD-Type form-check-input" checked id="dadETypeNavigation" type="radio" name="flctype" value="1"/>
                        <label for="dadETypeNavigation" class="form-check-label">${_('Medium')}</label>
                    </div>
                    <div class="form-check form-check-inline m-0">
                       <input class="DAD-Type form-check-input" id="dadETypeIdentify" type="radio" name="flctype" value="2"/>
                       <label for="dadETypeIdentify" class="form-check-label">${_('Advanced')}</label>
                    </div>
                    ${edition.common.getHelpTooltip(
                        _('Select the difficulty level. In Advanced level, learners must complete the activity within a time limit.')
                    )}
                </div>
                <div style="display:none" class="mb-3">
                    <span class="toggle-item">
                        <span class="toggle-control">
                            <input type="checkbox" checked id="dadEShowSolution" class="toggle-input" />
                            <span class="toggle-visual" aria-hidden="true"></span>
                        </span>
                        <label class="toggle-label" for="dadEShowSolution">${_('Show solutions')}.</label>
                    </span>
                    <label for="dadETimeShowSolution" class="ms-2 mb-0">${_('Show solution time (seconds)')}:
                        <input type="number" name="dadETimeShowSolution" id="dadETimeShowSolution" value="3" min="1" max="9" class="form-control" style="width:5ch" />
                    </label>
                </div>
                <div id="dadETimeDiv" class="d-none align-items-center gap-2 flex-nowrap mb-3">
                    <label for="dadETime" class="mb-0">${_('Time (minutes)')}:</label>
                    <input type="number" name="dadETime" id="dadETime" value="3" min="0" max="59" class="form-control" style="width:5ch" />
                    ${edition.common.getHelpTooltip(
                        _('Maximum time allowed to complete the game. 0 for unlimited time.')
                    )}
                </div>
                <div class="mb-3 d-flex align-items-center gap-2">
                    <span class="toggle-item">
                        <span class="toggle-control">
                            <input type="checkbox" id="dadEShowMinimize" class="toggle-input" />
                            <span class="toggle-visual" aria-hidden="true"></span>
                        </span>
                        <label class="toggle-label" for="dadEShowMinimize">${_('Show minimized.')}</label>
                    </span>
                    ${edition.common.getHelpTooltip(
                        _('Start with the game collapsed. Learners can expand it when they are ready to play.')
                    )}
                </div>
                <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                    <label for="dadEPercentajeCards" class="mb-0">%${_('Activities')}:</label>
                    <input type="number" name="dadEPercentajeCards" id="dadEPercentajeCards" value="100" min="1" max="100" class="form-control" style="width:6ch" />
                    <span id="dadENumeroPercentaje">1/1</span>
                    ${edition.common.getHelpTooltip(
                        _('Percentage of available activities included in each game session.')
                    )}
                </div>
                <div class="d-none align-items-center gap-2 flex-nowrap mb-3">
                    <label for="dadEAuthory" class="mb-0">${_('Authorship')}:</label>
                    <input id="dadEAuthory" type="text" class="form-control" />
                </div>
                <div class="Games-Reportdiv d-flex align-items-center gap-2 flex-nowrap mt-3">
                </div>
            </div>
        `;

        const activitiesHtml = `
            <div class="DAD-EPanel" id="dadEPanel">                            
                <div id="dadEDragDiv">
                        <div class="DAD-DEOptionsMedia">
                            <div class="DAD-DEOptionsGame">
                                <span id="dadETitleWord">${_('Text')}</span>
                                <div class="DAD-DEInputImage mb-3 gap-2" id="dadEWordDiv">
                                    <label class="sr-av" for="dadEDefinition">${_('Text')}: </label>
                                    <input type="text" id="dadEDefinition" maxlength="30" class="form-control"/>
                                </div>
                                <span class="DAD-DETitleImage" id="dadETitleImage">${_('Image URL')}</span>
                                <div class="DAD-DEInputImage mb-3 gap-2" id="dadEInputImage">
                                    <label class="sr-av" for="dadEURLImage">${_('Image URL')}</label>
                                    <input type="text" class="exe-file-picker form-control me-0" id="dadEURLImage"/>
                                    <a href="#" id="dadEPlayImage" class="DAD-ENavigationButton DAD-EPlayVideo" title="${_('Show')}">
                                        <img src="${path}quextIEPlay.png" alt="${_('Show')}" class="DAD-DEButtonImage " />
                                    </a>
                                    <a href="#" id="dadEShowMore" class="DAD-ENavigationButton DAD-EShowMore" title="${_('More')}">
                                        <img src="${path}quextEIMore.png" alt="${_('More')}" class="DAD-EButtonImage " />
                                    </a>
                                </div>
                                <div class="DAD-DEAuthorAlt mb-3" id="dadEAuthorAlt">
                                    <div class="DAD-DEInputAuthor">
                                        <label>${_('Authorship')}</label><input id="dadEAuthor" type="text" class="DAD-EAuthor form-control" />
                                    </div>
                                    <div class="DAD-DEInputAlt">
                                        <label>${_('Alt')}</label><input id="dadEAlt" type="text" class="DAD-EAlt form-control" />
                                    </div>
                                </div>
                                <span id="dadETitleAudio">${_('Audio')}</span>
                                <div class="DAD-DEInputAudio gap-2" id="dadEInputAudio" data-voice-recorder data-voice-input="#dadEURLAudio">
                                    <label class="sr-av" for="dadEURLAudio">${_('URL')}</label>
                                    <input type="text" class="exe-file-picker form-control me-0" id="dadEURLAudio"/>
                                    <a href="#" id="dadEPlayAudio" class="DAD-ENavigationButton DAD-EPlayVideo" title="${_('Play audio')}">
                                        <img src="${path}quextIEPlay.png" alt="${_('Play audio')}" class="DAD-EButtonImage " />
                                    </a>
                                </div>
                            </div>
                            <div class="DAD-DEMultiMediaOption">
                                <div class="DAD-DEMultimedia" id="dadEMultimedia">
                                    <img class="DAD-DEMedia" src="${path}quextIEImage.png" id="dadEImage" alt="${_('Image')}" />
                                    <img class="DAD-DEMedia" src="${path}quextIEImage.png" id="dadENoImage" alt="${_('No image')}" />
                                </div>
                            </div>
                        </div>
                </div>                           
                <div class="DAD-ENavigationButtons gap-2">
                    <a href="#" id="dadEAddC" class="DAD-ENavigationButton" title="${_('Add question')}">
                        <img src="${path}quextIEAdd.png" alt="${_('Add question')}" class="DAD-EButtonImage" />
                    </a>
                   
                    <a href="#" id="dadEFirstC" class="DAD-ENavigationButton" title="${_('First question')}">
                        <img src="${path}quextIEFirst.png" alt="${_('First question')}" class="DAD-EButtonImage" />
                    </a>
                    <a href="#" id="dadEPreviousC" class="DAD-ENavigationButton" title="${_('Previous question')}">
                        <img src="${path}quextIEPrev.png" alt="${_('Previous question')}" class="DAD-EButtonImage" />
                    </a>
                    <label class="sr-av" for="dadENumberCard">${_('Question number:')}:</label>
                    <input type="text" class="DAD-NumberCard form-control" id="dadENumberCard" value="1"/>
                    <a href="#" id="dadENextC" class="DAD-ENavigationButton" title="${_('Next question')}">
                        <img src="${path}quextIENext.png" alt="${_('Next question')}" class="DAD-EButtonImage" />
                    </a>
                    <a href="#" id="dadELastC" class="DAD-ENavigationButton" title="${_('Last question')}">
                        <img src="${path}quextIELast.png" alt="${_('Last question')}" class="DAD-EButtonImage" />
                    </a>
                    <a href="#" id="dadEDeleteC" class="DAD-ENavigationButton" title="${_('Delete question')}">
                        <img src="${path}quextIEDelete.png" alt="${_('Delete question')}" class="DAD-EButtonImage" />
                    </a>
                    <a href="#" id="dadECopyC" class="DAD-ENavigationButton" title="${_('Copy question')}">
                        <img src="${path}quextIECopy.png" alt="${_('Copy question')}" class="DAD-EButtonImage" />
                    </a>
                    <a href="#" id="dadECutC" class="DAD-ENavigationButton" title="${_('Cut question')}">
                        <img src="${path}quextIECut.png" alt="${_('Cut question')}" class="DAD-EButtonImage" />
                    </a>
                    <a href="#" id="dadEPasteC" class="DAD-ENavigationButton" title="${_('Paste question')}">
                        <img src="${path}quextIEPaste.png" alt="${_('Paste question')}" class="DAD-EButtonImage" />
                    </a>
                </div>
                <div class="DAD-ENumCardDiv" id="dadENumCardsDiv">
                    <div class="DAD-ENumCardsIcon"><span class="sr-av">${_('activities')}:</span></div> 
                    <span class="DAD-ENumCards" id="dadENumCards">0</span>
                </div>
            </div>
        `;

        const tabsHtml = edition.tabs.getHtml('dragdropQIdeviceForm', {
            path,
            instructions: c_('Drag each item onto the one it matches with'),
            options: optionsHtml,
            contents: activitiesHtml,
            passwords: true,
            after: true,
            grading: true,
            texts: this.ci18n,
            share: false,
            info: {
                contents: _('Add the text, images and audio for each draggable item and edit them one by one.'),
            },
        });

        const html = `
            <div id="dragdropQIdeviceForm">
                ${edition.common.getIdeviceDescription(
                    _('Create drag-and-drop activities combining texts, images, and audio clips, allowing interactions in any direction (e.g., dragging text onto images or audio, and vice versa).'),
                    'https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe40/html/arrastra.html',
                )}
                ${tabsHtml}
            </div>
        `;
        this.ideviceBody.innerHTML = html;
        edition.tabs.bind('dragdropQIdeviceForm');
        edition.gamification.scorm.init();
        this.enableForm();
    },

    clearCard: function () {
        $('#dadEURLImage').val('');
        $('#dadEAuthor').val('');
        $('#dadEAlt').val('');
        $('#dadEURLAudio').val('');
        $('#dadEDefinition').val('');
        $exeDevice.showImage();
    },

    addCard: function () {
        if (!$exeDevice.validateCard()) return;
        $exeDevice.clearCard();
        $exeDevice.cardsGame.push($exeDevice.getDefaultCard());
        $exeDevice.active = $exeDevice.cardsGame.length - 1;
        $('#dadEPasteC').hide();
        $('#dadENumCards').text($exeDevice.cardsGame.length);
        $('#dadENumberCard').val($exeDevice.cardsGame.length);
        $exeDevice.updateCardsNumber();
    },

    removeCard: function () {
        if ($exeDevice.cardsGame.length < 1) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneCard);
            return;
        }

        $exeDevice.cardsGame.splice($exeDevice.active, 1);
        if ($exeDevice.active >= $exeDevice.cardsGame.length - 1) {
            $exeDevice.active = $exeDevice.cardsGame.length - 1;
        }
        $exeDevice.showCard($exeDevice.active);
        $exeDevice.typeEdit = -1;
        $('#dadEPasteC').hide();
        $('#dadENumCards').text($exeDevice.cardsGame.length);
        $('#dadENumberCard').val($exeDevice.active + 1);

        $exeDevice.updateCardsNumber();
    },

    copyCard: function () {
        if (!$exeDevice.validateCard()) return;
        $exeDevice.typeEdit = 0;
        $exeDevice.clipBoard = JSON.parse(
            JSON.stringify($exeDevice.cardsGame[$exeDevice.active])
        );
        $('#dadEPasteC').show();
    },

    cutCard: function () {
        if (!$exeDevice.validateCard()) return;
        $exeDevice.numberCutCuestion = $exeDevice.active;
        $exeDevice.typeEdit = 1;
        $('#dadEPasteC').show();
    },

    pasteCard: function () {
        $exeIDevicesEdition.iDevice.gamification.share.keepQuestionOnScreen(
            () => $exeDevice.validateCard()
        );
        if ($exeDevice.typeEdit == 0) {
            $exeDevice.active++;
            $exeDevice.cardsGame.splice(
                $exeDevice.active,
                0,
                $exeDevice.clipBoard
            );
            $exeDevice.showCard($exeDevice.active);
        } else if ($exeDevice.typeEdit == 1) {
            $('#dadEPasteC').hide();
            $exeDevice.typeEdit = -1;
            ($exeDevices?.iDevice?.gamification?.helpers || $exeIDevicesEdition?.iDevice?.gamification?.helpers).arrayMove(
                $exeDevice.cardsGame,
                $exeDevice.numberCutCuestion,
                $exeDevice.active
            );
            $('#dadENumCards').text($exeDevice.cardsGame.length);
            $('#dadENumberCard').val($exeDevice.active + 1);

            $exeDevice.updateCardsNumber();
        }
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
            $exeDevice.showCard($exeDevice.active);
        }
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

        $exeIDevicesEdition.iDevice.gamification.helpers.stopSound();
        $('#dadEURLImage').val(p.url);
        $('#dadEAuthor').val(p.author);
        $('#dadEAlt').val(p.alt);
        $('#dadEDefinition').val(p.definition);
        $('#dadEURLAudio').val(p.audio);
        $('#dadENumberCard').val($exeDevice.active + 1);
        $('#dadENumCards').text($exeDevice.cardsGame.length);

        if (p.audio.length > 3) {
            $exeIDevicesEdition.iDevice.gamification.helpers.playSound(p.audio);
        }
        $exeDevice.showImage(p.url);
    },

    decodeURIComponentSafe: function (s) {
        return s ? decodeURIComponent(s).replace('&percnt;', '%') : s;
    },

    encodeURIComponentSafe: function (s) {
        return s ? encodeURIComponent(s.replace('%', '&percnt;')) : s;
    },

    validateCard: function () {
        let message = '',
            msgs = $exeDevice.msgs,
            p = {};

        p.definition = $('#dadEDefinition').val().trim();
        p.url = $('#dadEURLImage').val().trim();
        p.author = $('#dadEAuthor').val();
        p.alt = $('#dadEAlt').val();
        p.audio = $('#dadEURLAudio').val();

        if (p.definition.length == 0) {
            message = msgs.msgCompleteData;
        }
        if (p.url.length < 0 && p.audio.length < 4) {
            message = msgs.msgCompleteDataBack;
        }
        if (message.length == 0) {
            $exeDevice.cardsGame[$exeDevice.active] = p;
            message = true;
        } else {
            $exeDevice.showMessage(message);
            message = false;
        }
        return message;
    },

    enableForm: function () {
        $exeDevice.initCards();

        const root = document.getElementById('dragdropQIdeviceForm') || document;
        $exeIDevicesEdition.iDevice.voiceRecorder.initVoiceRecorders(root);

        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
    },

    updateCardsNumber: function () {
        let percentaje = parseInt(
            $exeDevice.removeTags($('#dadEPercentajeCards').val())
        );
        if (isNaN(percentaje)) return;
        percentaje = Math.min(Math.max(percentaje, 1), 100);

        const cards = $exeDevice.cardsGame,
            totalQuestions = cards.length;

        let num = Math.max(Math.round((percentaje * totalQuestions) / 100), 1);

        $('#dadENumeroPercentaje').text(`${num}/${totalQuestions}`);
    },

    getDefaultCard: function () {
        return {
            id: '',
            definition: '',
            url: '',
            audio: '',
            author: '',
            alt: '',
            type: 1,
        };
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            const wrapper = $('<div></div>').html(originalHTML);
            let json = $('.dragdrop-DataGame', wrapper).text();
            const helpers = $exeDevices?.iDevice?.gamification?.helpers || $exeIDevicesEdition?.iDevice?.gamification?.helpers;
            if (helpers?.sanitizeJSONString) {
                json = helpers.sanitizeJSONString(json);
            }
            const dataGame = helpers?.isJsonString ? helpers.isJsonString(json) : JSON.parse(json),
                cards = dataGame.cardsGame,
                $imagesLink = $('.dragdrop-LinkImages', wrapper),
                $audiosLink = $('.dragdrop-LinkAudios', wrapper),
                $imagesLinkBack = $('.dragdrop-LinkImagesBack', wrapper),
                $audiosLinkBack = $('.dragdrop-LinkAudiosBack', wrapper);

            $imagesLink.each(function () {
                const iq = parseInt($(this).text());
                if (!isNaN(iq) && iq < cards.length) {
                    const rlccard = cards[iq];
                    rlccard.url =
                        $(this).attr('href').length < 4
                            ? ''
                            : $(this).attr('href');
                }
            });

            $imagesLinkBack.each(function () {
                const iq = parseInt($(this).text());
                if (!isNaN(iq) && iq < cards.length) {
                    const rlccard = cards[iq];
                    rlccard.urlBk =
                        $(this).attr('href').length < 4
                            ? ''
                            : $(this).attr('href');
                }
            });

            $audiosLink.each(function () {
                const iqa = parseInt($(this).text());
                if (!isNaN(iqa) && iqa < cards.length) {
                    const rlccard = cards[iqa];
                    rlccard.audio =
                        $(this).attr('href').length < 4
                            ? ''
                            : $(this).attr('href');
                }
            });

            $audiosLinkBack.each(function () {
                const iqa = parseInt($(this).text());
                if (!isNaN(iqa) && iqa < cards.length) {
                    const rlccard = cards[iqa];
                    rlccard.audioBk =
                        $(this).attr('href').length < 4
                            ? ''
                            : $(this).attr('href');
                }
            });

            $exeDevice.updateFieldGame(dataGame);

            let instructions = $('.dragdrop-instructions', wrapper);
            if (instructions.length === 1) {
                instructions = instructions.html() || '';
                $('#eXeGameInstructions').val(instructions);
            }

            let textAfter = $('.dragdrop-extra-content', wrapper);
            if (textAfter.length === 1) {
                textAfter = textAfter.html() || '';
                $('#eXeIdeviceTextAfter').val(textAfter);
            }

            $exeIDevicesEdition.iDevice.gamification.common.setLanguageTabValues(
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
        if (!$exeDevice.validateCard()) return false;

        const dataGame = $exeDevice.validateData();

        if (!dataGame) return false;

        const i18n = { ...this.ci18n };

        Object.keys(this.ci18n).forEach((i) => {
            const fVal = $('#ci18n_' + i).val();
            if (fVal) i18n[i] = fVal;
        });

        dataGame.msgs = i18n;
        const json = JSON.stringify(dataGame),
            cards = dataGame.cardsGame;

        let divContent = dataGame.instructions
            ? `<div class="dragdrop-instructions gameQP-instructions">${dataGame.instructions}</div>`
            : '';
        const linksMedias = $exeDevice.createlinksIMedias(cards);

        let html = '<div class="dragdrop-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html += `${divContent}<div class="dragdrop-DataGame js-hidden">${json}</div>${linksMedias}`;
        const textAfter =
            tinyMCE?.get('eXeIdeviceTextAfter')?.getContent() ||
            $('#eXeIdeviceTextAfter').val() ||
            '';
        if (textAfter) {
            html += `<div class="dragdrop-extra-content">${textAfter}</div>`;
        }

        html += `<div class="dragdrop-bns js-hidden">${$exeDevice.msgs.msgNoSuportBrowser}</div></div>`;

        return html;
    },

    validateAlt: function () {
        if (!$exeDevice.checkAltImage || $('#dadEAlt').val() !== '')
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
                    { prop: 'url', className: 'dragdrop-LinkImages' },
                    { prop: 'urlBk', className: 'dragdrop-LinkImagesBack' },
                    { prop: 'audio', className: 'dragdrop-LinkAudios' },
                    { prop: 'audioBk', className: 'dragdrop-LinkAudiosBack' },
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
            $('#dragdropQIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';

        return ideviceid;
    },

    validateData: function () {
        const clear = $exeDevice.removeTags,
            instructions =
                tinyMCE?.get('eXeGameInstructions')?.getContent() ||
                $('#eXeGameInstructions').val() ||
                '',
            textAfter =
                tinyMCE?.get('eXeIdeviceTextAfter')?.getContent() ||
                $('#eXeIdeviceTextAfter').val() ||
                '',
            showMinimize = $('#dadEShowMinimize').is(':checked'),
            showSolution = $('#dadEShowSolution').is(':checked'),
            timeShowSolution = parseInt(
                clear($('#dadETimeShowSolution').val())
            ),
            itinerary =
                $exeIDevicesEdition.iDevice.gamification.itinerary.getValues(),
            percentajeCards = parseInt(clear($('#dadEPercentajeCards').val())),
            author = $('#dadEAuthory').val(),
            cardsGame = $exeDevice.cardsGame,
            scorm = $exeIDevicesEdition.iDevice.gamification.scorm.getValues(),
            type = parseInt($('input[name=flctype]:checked').val()),
            typeDrag = parseInt($('input[name=flctypedrag]:checked').val()),
            mode = 1,
            time = parseInt($('#dadETime').val()),
            progressBar =
                $exeIDevicesEdition.iDevice.gamification.progressBar.getValues(),
            passScore =
                $exeIDevicesEdition.iDevice.gamification.passScore.getValues(),
            id = $exeDevice.getIdeviceID();

        if (!itinerary) return false;
        if (!progressBar) return false;

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
            typeGame: 'dragdrop',
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
            mode,
            typeDrag,
            showSolution,
            timeShowSolution,
            time,
            evaluation: progressBar.evaluation,
            evaluationID: progressBar.evaluationID,
            passScoreMode: passScore.passScoreMode,
            passScoreCustom: passScore.passScoreCustom,
            id,
        };
    },

    showImage: function () {
        const $image = $('#dadEImage'),
            $nimage = $('#dadENoImage'),
            alt = $('#dadEAlt').val(),
            url = $('#dadEURLImage').val();

        $image.hide();
        $image.attr('alt', alt);
        $nimage.show();
        $image
            .prop('src', url)
            .on('load', function () {
                if (!$exeDevice) return false;
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
        const lifecycle = this.$lifecycle;
        $('#dadEPasteC').hide();
        // Show or hide the block each switch controls (data-target).
        const initToggle = function ($input) {
            const checked = $input.is(':checked');
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
        // Delegated on `document`, which outlives the form: the lifecycle
        // removes it, and only it, when the editor closes. Handlers it owns run
        // bound to the edition, so the changed toggle comes from the event.
        lifecycle.on(document, 'change', '.toggle-input', e => {
            initToggle($(e.currentTarget));
        });

        $('#dadEAddC').on('click', (e) => {
            e.preventDefault();
            $exeDevice?.addCard(true);
        });

        $('#dadEDeleteC').on('click', (e) => {
            e.preventDefault();
            $exeDevice?.removeCard();
        });

        $('#dadECopyC').on('click', (e) => {
            e.preventDefault();
            $exeDevice?.copyCard();
        });

        $('#dadECutC').on('click', (e) => {
            e.preventDefault();
            $exeDevice?.cutCard();
        });

        $('#dadEPasteC').on('click', (e) => {
            e.preventDefault();
            $exeDevice?.pasteCard();
        });

        $('#dadEFirstC, #dadEPreviousC, #dadENextC, #dadELastC').on(
            'click',
            (e) => {
                e.preventDefault();
                const actions = {
                    dadEFirstC: 'firstCard',
                    dadEPreviousC: 'previousCard',
                    dadENextC: 'nextCard',
                    dadELastC: 'lastCard',
                };
                $exeDevice?.[actions[e.currentTarget.id]]();
            }
        );

        $('#dadEPercentajeCards')
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 3);
                this.value = v;
                if (this.value > 0 && this.value < 101) {
                    $exeDevice?.updateCardsNumber();
                }
            })
            .on('focusout', function () {
                this.value = this.value.trim() === '' ? 100 : this.value;
                this.value = Math.max(1, Math.min(100, this.value));
                $exeDevice?.updateCardsNumber();
            })
            .on('click', () => {
                $exeDevice?.updateCardsNumber();
            });

        $('#dadENumberCard').keyup(function (e) {
            if (!$exeDevice) return;
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

        $('#dadETime')
            .on('keyup', function () {
                this.value = this.value.replace(/\D/g, '').substring(0, 2);
            })
            .on('focusout', function () {
                this.value = this.value.trim() === '' ? 0 : this.value;
                this.value = Math.max(0, Math.min(59, this.value));
            });

        $('#dadEShowSolution').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#dadETimeShowSolution').prop('disabled', !marcado);
        });

        $('#dadETimeShowSolution')
            .on('keyup', function () {
                this.value = this.value.replace(/\D/g, '').substring(0, 1);
            })
            .on('focusout', function () {
                this.value = this.value.trim() === '' ? 3 : this.value;
                this.value = Math.max(1, Math.min(9, this.value));
            });

        $('#dragdropQIdeviceForm').on('click', 'input.DAD-Type', function () {
            $('#dadETimeDiv')
                .toggleClass('d-none', $(this).val() !== '2')
                .toggleClass('d-flex', $(this).val() === '2');
        });
        $exeIDevicesEdition.iDevice.gamification.progressBar.addEvents();
        $exeIDevicesEdition.iDevice.gamification.passScore.addEvents();

        $('#dadEURLImage').on('change', function () {
            const url = $(this).val().trim();
            $exeDevice?.loadImage(url);
        });

        $('#dadEPlayImage').on('click', function (e) {
            e.preventDefault();
            const url = $('#dadEURLImage').val().trim();
            $exeDevice?.loadImage(url);
        });

        $('#dadEURLAudio').on('change', function () {
            $exeDevice?.loadAudio($(this).val());
        });

        $('#dadEPlayAudio').on('click', function (e) {
            e.preventDefault();
            const audio = $('#dadEURLAudio').val();
            $exeDevice?.loadAudio(audio);
        });

        $('#dadEShowMore').on('click', function (e) {
            e.preventDefault();
            if ($('#dadEAuthorAlt').is(':visible')) {
                $('#dadEAuthorAlt').slideUp();
            } else {
                $('#dadEAuthorAlt').slideDown({
                    start: function () {
                        $(this).css('display', 'flex');
                    },
                });
            }
        });
        $exeIDevicesEdition.iDevice.gamification.itinerary.addEvents();

        //eXe 3.0 Dismissible messages
        $('.exe-block-dismissible .exe-block-close').click(function () {
            $(this).parent().fadeOut();
            return false;
        });
    },

    loadImage: function (url) {
        if (!url || url.length < 3) return;
        const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
            ext = url.split('.').pop().toLowerCase();

        if (url.indexOf('files') == 0 && validExt.indexOf(ext) == -1) {
            $exeDevice.showMessage(
                _('Supported formats') + ': jpg, jpeg, gif, png, svg,  webp'
            );
            return false;
        }
        $exeDevice.showImage();
    },

    loadAudio: function (url) {
        const validExt = ['mp3', 'ogg', 'waw'],
            ext = url.split('.').pop().toLowerCase();

        if (url.startsWith('files') && !validExt.includes(ext)) {
            $exeDevice.showMessage(`${_('Supported formats')}: mp3, ogg, waw`);
            return false;
        }

        if (url.length > 4) {
            $exeIDevicesEdition.iDevice.gamification.helpers.playSound(url);
        }
    },

    updateFieldGame: function (game) {
        $exeDevice.active = 0;
        $exeDevice.active = 0;
        $exeIDevicesEdition.iDevice.gamification.itinerary.setValues(
            game.itinerary
        );
        game.evaluation =
            typeof game.evaluation != 'undefined' ? game.evaluation : false;
        game.evaluationID =
            typeof game.evaluationID != 'undefined' ? game.evaluationID : '';
        game.typeDrag = typeof game.typeDrag != 'undefined' ? game.typeDrag : 0;
        game.weighted =
            typeof game.weighted !== 'undefined' ? game.weighted : 100;
        $exeDevice.id = $exeDevice.getIdeviceID();

        $('#dadEShowMinimize').prop('checked', game.showMinimize);
        $('#dadEPercentajeCards').val(game.percentajeCards);
        $('#dadEAuthory').val(game.author);
        $('#dadEShowSolution').prop('checked', game.showSolution);
        $('#dadETimeShowSolution').val(game.timeShowSolution);
        $('#dadETimeShowSolution').prop('disabled', !game.showSolution);
        $('#dadETime').val(game.time);
        $(
            "input.DAD-Drags[name='flctypedrag'][value='" + game.typeDrag + "']"
        ).prop('checked', true);
        $("input.DAD-Type[name='flctype'][value='" + game.type + "']").prop(
            'checked',
            true
        );
        $('#dadETimeDiv').removeClass('d-flex').addClass('d-none');
        $exeIDevicesEdition.iDevice.gamification.progressBar.setValues({
            evaluation: game.evaluation,
            evaluationID: game.evaluationID,
        });
        $exeIDevicesEdition.iDevice.gamification.passScore.setValues({
            passScoreMode: game.passScoreMode,
            passScoreCustom: game.passScoreCustom,
        });
        if (game.type == 2) {
            $('#dadETimeDiv').removeClass('d-none').addClass('d-flex');
        }
        $exeDevice.cardsGame = game.cardsGame;
        $('#dadENumCards').text($exeDevice.cardsGame.length);
        $('#dadEDragDiv').show();
        $exeIDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted
        );

        $exeDevice.updateCardsNumber();
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

    removeTags: function (str) {
        return $('<div>').html(str).text();
    },
};
