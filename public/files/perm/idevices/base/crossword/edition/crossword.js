/* eslint-disable no-undef */
/**
/**
 * Crossword activity iDevice (edition code)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narvaez Martinez
 * Author: Ricardo Malaga Floriano
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */

var $exeDevice = {
    i18n: {
        category: _('Games'),
        name: _('Crossword'),
    },
    msgs: {},
    classIdevice: 'crossword',
    active: 0,
    wordsGame: [],
    timeQuestion: 30,
    percentajeShow: 35,
    typeEdit: -1,
    numberCutCuestion: -1,
    clipBoard: '',
    endSilent: 0,
    version: 1,
    playerAudio: '',
    localPlayer: null,
    id: false,
    idevicePath: '',
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
            msgReply: c_('Reply'),
            msgEnterCode: c_('Enter the access code'),
            msgErrorCode: c_('The access code is not correct'),
            msgIndicateWord: c_('Provide a word or phrase'),
            msgClue: c_('Cool! The clue is:'),
            msgCodeAccess: c_('Access code'),
            msgRequiredAccessKey: c_('Access code required'),
            msgInformationLooking: c_(
                'Cool! The information you were looking for'
            ),
            msgPlayStart: c_('Click here to play'),
            msgErrors: c_('Errors'),
            msgHits: c_('Hits'),
            msgScore: c_('Score'),
            msgWeight: c_('Weight'),
            msgMinimize: c_('Minimize'),
            msgMaximize: c_('Maximize'),
            msgTime: c_('Time Limit (mm:ss)'),
            msgFullScreen: c_('Full Screen'),
            msgExitFullScreen: c_('Exit Full Screen'),
            msgNumQuestions: c_('Number of questions'),
            msgNoImage: c_('No picture question'),
            msgCool: c_('Cool!'),
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
            msgLoading: c_('Loading. Please wait...'),
            msgPoints: c_('points'),
            msgAudio: c_('Audio'),
            msgCorrect: c_('Correct'),
            msgIncorrect: c_('Incorrect'),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgTypeGame: c_('Crossword'),
            msgCheck: c_('Check'),
            msgShowSolution: c_('Show solutions'),
            msgReboot: c_('Play Again'),
            msgGameOver: c_(
                'The game is over. You scored %s. Hits: %s out of %s.'
            ),
            msgSelectWord: c_('Click on a word’s square to see the definition'),
            msgHorizontals: c_('Horizontals'),
            msgVerticals: c_('Verticals'),
            msgShowDefinitions: c_('Show/hide definitions'),
            msgShowBack: c_('Show/hide background image'),
            msgSolutionWord: c_('Word'),
        };
    },

    setMessagesInfo: function () {
        const msgs = this.msgs;
        msgs.msgEProvideDefinition = _(
            'You must provide a definition, an image, and/or an audio for the word'
        );
        msgs.msgESelectFile = _(
            'The selected file does not contain a valid game'
        );
        msgs.msgEProvideWord = _('Provide a word');
        msgs.msgEOneQuestion = _('The crossword must have at least two words');
        msgs.msgProvideFB = _('Message to display when passing the game');
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.'
        );
        msgs.msgIDLenght = _(
            'The report identifier must have at least 5 characters'
        );
        msgs.msgMaximeSize = _(
            'The word cannot contain more than fourteen characters or white spaces'
        );
    },

    createForm: function () {
        const path = $exeDevice.idevicePath,
            html = `
        <div id="ccgmQEIdeviceForm">
            <p class="exe-block-info exe-block-dismissible">
                ${_('Create crossword-type activities')} 
                <a style="display:none;" href="https://youtu.be/br6S9kcuJI8" hreflang="es" target="_blank">${_('Usage Instructions')}</a>
                <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
            </p>
            <div class="exe-form-tab" title="${_('General settings')}">
                ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Complete the following crossword puzzle.'))}
                <fieldset class="exe-fieldset exe-fieldset-closed">
                    <legend><a href="#">${_('Options')}</a></legend>
                    <div>
                        <div class="mb-3">
                            <span class="toggle-item" role="switch" aria-checked="false">
                                <span class="toggle-control">
                                    <input type="checkbox" id="ccgmEShowMinimize" class="toggle-input" />
                                    <span class="toggle-visual" aria-hidden="true"></span>
                                </span>
                                <label class="toggle-label" for="ccgmEShowMinimize">${_('Show minimized.')}</label>
                            </span>
                        </div>
                        <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                            <label for="ccgmETime" class="mb-0">${_('Time (minutes)')}:</label>
                            <input type="number" name="ccgmETime" id="ccgmETime" value="0" min="0" max="59" class="form-control" style="width:6ch" /> 
                        </div>
                        <div class="mb-3">
                            <span class="toggle-item" role="switch" aria-checked="true">
                                <span class="toggle-control">
                                    <input type="checkbox" checked id="ccgmEShowSolution" class="toggle-input" />
                                    <span class="toggle-visual" aria-hidden="true"></span>
                                </span>
                                <label class="toggle-label" for="ccgmEShowSolution">${_('Show solutions')}.</label> 
                            </span>
                        </div>
                        <div class="mb-3">
                            <span class="toggle-item" role="switch" aria-checked="false">
                                <span class="toggle-control">
                                    <input type="checkbox" id="ccgmECaseSensitive" class="toggle-input" />
                                    <span class="toggle-visual" aria-hidden="true"></span>
                                </span>
                                <label class="toggle-label" for="ccgmECaseSensitive">${_('Case sensitive')}</label>
                            </span>
                        </div>
                        <div class="mb-3">
                            <span class="toggle-item" role="switch" aria-checked="false">
                                <span class="toggle-control">
                                    <input type="checkbox" checked id="ccgmETilde" class="toggle-input" />
                                    <span class="toggle-visual" aria-hidden="true"></span>
                                </span>
                                <label class="toggle-label" for="ccgmETilde">${_('Accent marks')}</label>
                            </span>
                        </div>
                        <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                            <label for="ccgmEDifficulty" class="mb-0">%${_('Difficulty')}:</label>
                            <input type="number" name="ccgmEDifficulty" id="ccgmEDifficulty" value="100" min="0" max="100" class="form-control" style="width:6ch" /> 
                        </div>
                        <div class="mb-3 d-flex align-items-center gap-2 flex-nowrap">
                            <span class="toggle-item" role="switch" aria-checked="false">
                                <span class="toggle-control">
                                    <input type="checkbox" id="ccgmEHasFeedBack" class="toggle-input" />
                                    <span class="toggle-visual" aria-hidden="true"></span>
                                </span>
                                <label class="toggle-label" for="ccgmEHasFeedBack">${_('Feedback')}.</label>
                            </span>
                           <input type="number" name="ccgmEPercentajeFB" id="ccgmEPercentajeFB" value="100" min="5" max="100" step="5" disabled class="form-control" style="width:6ch" />
                           <label for="ccgmEPercentajeFB" class="ms-0">${_('&percnt; right to see the feedback')}</label>
                        </div>
                        <div id="ccgmEFeedbackP" class="CCGM-EFeedbackP">
                            <textarea id="ccgmEFeedBackEditor" class="exe-html-editor form-control" rows="4"></textarea>
                        </div>
                        <div class=" d-flex align-items-center gap-2 flex-nowrap mb-3">
                            <label for="ccgmEPercentajeQuestions" class="mb-0">% ${_('Questions')}:</label>
                            <input type="number" name="ccgmEPercentajeQuestions" id="ccgmEPercentajeQuestions" value="100" min="1" max="100" class="form-control" style="width:6ch" /> 
                            <span id="ccgmENumeroPercentaje">1/1</span>
                        </div>
                        <div class="d-flex align-items-center gap-2 flex-nowrap">
                            <span class="toggle-item" role="switch" aria-checked="true">
                                <span class="toggle-control">
                                    <input type="checkbox" id="ccgmBack0" class="toggle-input" checked />
                                    <span class="toggle-visual" aria-hidden="true"></span>
                                </span>
                                <label class="toggle-label" for="ccgmBack0">${_('Background')}:</label>
                            </span>                            
                            <div class="d-flex align-items-center gap-2 flex-nowrap" id="ccgmbackground1">
                                <label for="ccgmEURLBack" class="mb-0">${_('URL')}: </label>
                                <input type="text" class="exe-file-picker CCGM-EURLImage form-control me-0" id="ccgmEURLBack"/>
                                <a href="#" id="ccgmEPlayBack" class="CCGM-ENavigationButton CCGMEEPlayVideo" title="${_('Show')}">
                                    <img src="${path}quextIEPlay.png" alt="${_('Show')}" class="CCGM-EButtonImage " />
                                </a>
                            </div>
                         </div>
                        <div id="ccgmbackground" class="CCGM-Back mb-3">
                            <img class="CCGM-EMedia1" src="" id="ccgmEImageBack" alt="${_('Image')}" />
                            <img class="CCGM-EMedia1" src="${path}ccgmbackground.jpg" id="ccgmEImageNoBack" alt="${_('No image')}" />
                        </div>
                        <div id="ccgmAuthorBackDiv" class="CCGM-AuthorBack d-none align-items-center gap-2 flex-nowrap mb-3">
                            <label for="ccgmAuthorBack" class="mb-0">${_('Authorship')}: </label>
                            <input type="text" class="CCGM-EURLImage form-control" id="ccgmAuthorBack"/>
                        </div>
                        <div class="d-none align-items-center gap-2 flex-nowrap mb-3">
                            <span>${_('Quick edit')}</span>
                            <button id="eXeQuickEditButton" class="btn btn-primary">${_('Show')}</button>
                        </div>
                        <div class="Games-Reportdiv d-flex align-items-center gap-2 flex-nowrap mt-3">
                            <span class="toggle-item" role="switch" aria-checked="false">
                                <span class="toggle-control">
                                    <input type="checkbox" id="ccgmEEvaluation" class="toggle-input" data-target="#ccgmEEvaluationIDWrapper" />
                                    <span class="toggle-visual" aria-hidden="true"></span>
                                </span>
                                <label class="toggle-label" for="ccgmEEvaluation">${_('Progress report')}.</label>
                            </span>
                            <span id="ccgmEEvaluationIDWrapper" class="d-flex align-items-center gap-2 flex-nowrap">
                                <label for="ccgmEEvaluationID" class="mb-0 me-0">${_('Identifier')}: </label>
                                <input type="text" id="ccgmEEvaluationID" disabled class="form-control" value="${eXeLearning.app.project.odeId || ''}"/> 
                            </span>
                            <strong class="GameModeLabel">
                                <a href="#ccgmEEvaluationHelp" id="ccgmEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                    <img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}"/>
                                </a>
                            </strong>
                        </div>
                        <p id="ccgmEEvaluationHelp" class="CCGM-TypeGameHelp exe-block-info" style="display:none;">
                            ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                        </p>
                     </div>
                </fieldset>
                <fieldset class="exe-fieldset">
                    <legend><a href="#">${_('Words')}</a></legend>
                    <div class="CCGM-EPanel" id="ccgmEPanel">
                        <div class="CCGM-EOptionsMedia">
                            <div class="CCGM-EOptionsGame">
                                <span id="ccgmETitleWord">${_('Word')}</span>
                                <div class="CCGM-EInputImage align-items-center gap-2 mb-3 flex-nowrap" id="ccgmEWordDiv">
                                    <label class="sr-av" for="ccgmESolutionWord">${_('Word')}: </label>
                                    <input type="text" id="ccgmESolutionWord" maxlength="14" class="form-control"/>
                                </div>
                                <span id="ccgmETitleDefinition">${_('Definition')}</span>
                                <div class="CCGM-EInputImage align-items-center gap-2 mb-3  flex-nowrap" id="ccgmEDefinitionDiv">
                                    <label class="sr-av" for="ccgmEDefinitionWord">${_('Definition')}: </label>
                                    <input type="text" id="ccgmEDefinitionWord" class="form-control"/>
                                </div>
                                <span class="CCGM-ETitleImage" id="ccgmETitleImage">${_('Image URL')}</span>
                                <div class="CCGM-EInputImage align-items-center gap-2 mb-3  flex-nowrap" id="ccgmEInputImage">
                                    <label class="sr-av" for="ccgmEURLImage">${_('Image URL')}</label>
                                    <input type="text" class="exe-file-picker form-control me-0" id="ccgmEURLImage"/>
                                    <a href="#" id="ccgmEPlayImage" class="CCGM-ENavigationButton CCGM-EPlayVideo" title="${_('Show')}">
                                        <img src="${path}quextIEPlay.png" alt="${_('Show')}" class="CCGM-EButtonImage " />
                                    </a>
                                    <a href="#" id="ccgmEShowMore" class="CCGM-ENavigationButton CCGM-EShowMore" title="${_('More')}">
                                        <img src="${path}quextEIMore.png" alt="${_('More')}" class="CCGM-EButtonImage " />
                                    </a>
                                </div>
                                <div class="CCGM-ECoord align-items-center gap-2 mb-3 flex-nowrap">
                                    <label for="ccgmEXImage">X:</label>
                                    <input id="ccgmEXImage" type="text" value="0" class="form-control" />
                                    <label for="ccgmEYImage">Y:</label>
                                    <input id="ccgmEYImage" type="text" value="0" class="form-control" />
                                </div>
                                <div class="CCGM-EAuthorAlt mb-3" id="ccgmEAuthorAlt">
                                    <div class="CCGM-EInputAuthor align-items-center gap-2 flex-nowrap">
                                        <label class="mb-0">${_('Authorship')}</label><input id="ccgmEAuthor" type="text" class="CCGM-EAuthor form-control" />
                                    </div>
                                    <div class="CCGM-EInputAlt align-items-center gap-2 flex-nowrap">
                                        <label class="mb-0">${_('Alt')}</label><input id="ccgmEAlt" type="text" class="CCGM-EAlt form-control" />
                                    </div>
                                </div>
                                <span id="ccgmETitleAudio">${_('Audio')}</span>
                                <div class="CCGM-EInputAudio mb-3 align-items-center gap-2 flex-nowrap" id="ccgmEInputAudio">
                                    <label class="sr-av" for="ccgmEURLAudio">${_('URL')}</label>
                                    <input type="text" class="exe-file-picker CCGM-EURLAudio form-control me-0" id="ccgmEURLAudio"/>
                                    <a href="#" id="ccgmEPlayAudio" class="CCGM-ENavigationButton CCGM-EPlayVideo" title="${_('Play audio')}">
                                        <img src="${path}quextIEPlay.png" alt="${_('Play audio')}" class="CCGM-EButtonImage " />
                                    </a>
                                </div>
                            </div>
                            <div class="CCGM-EMultiMediaOption">
                                <div class="CCGM-EMultimedia" id="ccgmEMultimedia">
                                    <img class="CCGM-EMedia" src="${path}quextIEImage.png" id="ccgmEImage" alt="${_('Image')}" />
                                    <img class="CCGM-EMedia" src="${path}quextIEImage.png" id="ccgmENoImage" alt="${_('No image')}" />
                                    <img class="CCGM-ECursor" src="${path}quextIECursor.gif" id="ccgmECursor" alt="" />
                                    <img class="CCGM-EMedia" src="${path}quextIECoverAdivina.png" id="ccgmECover" alt="${_('No image')}" />
                                </div>
                            </div>
                        </div>
                        <div class="CCGM-EContents">
                            <div class="CCGM-ENavigationButtons gap-2">
                                <a href="#" id="ccgmEAdd" class="CCGM-ENavigationButton" title="${_('Add question')}">
                                    <img src="${path}quextIEAdd.png" alt="${_('Add question')}" class="CCGM-EButtonImage b-add" />
                                </a>
                                <a href="#" id="ccgmEFirst" class="CCGM-ENavigationButton" title="${_('First question')}">
                                    <img src="${path}quextIEFirst.png" alt="${_('First question')}" class="CCGM-EButtonImage b-first" />
                                </a>
                                <a href="#" id="ccgmEPrevious" class="CCGM-ENavigationButton" title="${_('Previous question')}">
                                    <img src="${path}quextIEPrev.png" alt="${_('Previous question')}" class="CCGM-EButtonImage b-prev" />
                                </a>
                                <label class="sr-av" for="ccgmENumberQuestion">${_('Question number:')}</label>
                                <input type="text" class="CCGM-NumberQuestion form-control" id="ccgmENumberQuestion" value="1"/>
                                <a href="#" id="ccgmENext" class="CCGM-ENavigationButton" title="${_('Next question')}">
                                    <img src="${path}quextIENext.png" alt="${_('Next question')}" class="CCGM-EButtonImage b-next" />
                                </a>
                                <a href="#" id="ccgmELast" class="CCGM-ENavigationButton" title="${_('Last question')}">
                                    <img src="${path}quextIELast.png" alt="${_('Last question')}" class="CCGM-EButtonImage b-last" />
                                </a>
                                <a href="#" id="ccgmEDelete" class="CCGM-ENavigationButton" title="${_('Delete question')}">
                                    <img src="${path}quextIEDelete.png" alt="${_('Delete question')}" class="CCGM-EButtonImage b-delete" />
                                </a>
                                <a href="#" id="ccgmECopy" class="CCGM-ENavigationButton" title="${_('Copy question')}">
                                    <img src="${path}quextIECopy.png" alt="${_('Copy question')}" class="CCGM-EButtonImage b-copy" />
                                </a>
                                <a href="#" id="ccgmECut" class="CCGM-ENavigationButton" title="${_('Cut question')}">
                                    <img src="${path}quextIECut.png" alt="${_('Cut question')}" class="CCGM-EButtonImage b-cut" />
                                </a>
                                <a href="#" id="ccgmEPaste" class="CCGM-ENavigationButton" title="${_('Paste question')}">
                                    <img src="${path}quextIEPaste.png" alt="${_('Paste question')}" class="CCGM-EButtonImage b-paste" />
                                </a>
                            </div>
                        </div>
                        <div class="CCGM-ENumQuestionDiv" id="ccgmENumQuestionDiv">
                            <div class="CCGM-ENumQ"><span class="sr-av">${_('Number of questions:')}</span></div>
                            <span class="CCGM-ENumQuestions" id="ccgmENumQuestions">0</span>
                        </div>
                    </div>
                </fieldset>
                ${$exeDevicesEdition.iDevice.common.getTextFieldset('after')}
            </div>
            ${$exeDevicesEdition.iDevice.gamification.itinerary.getTab()}
            ${$exeDevicesEdition.iDevice.gamification.scorm.getTab()}
            ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
            ${$exeDevicesEdition.iDevice.gamification.share.getTab(true, 9, true)}
            ${$exeDevicesEdition.iDevice.gamification.share.getTabIA(9)}
        </div>
    `;
        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('ccgmQEIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();
        $exeDevice.enableForm();
    },

    enableForm: function () {
        $exeDevice.initQuestions();

        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
    },

    updateQuestionsNumber: function () {
        const percentInput = parseInt(
            $exeDevice.removeTags($('#ccgmEPercentajeQuestions').val())
        );

        if (isNaN(percentInput)) return;

        const percentaje = Math.min(Math.max(percentInput, 1), 100),
            totalWords = $exeDevice.wordsGame.length,
            num = Math.max(1, Math.round((percentaje * totalWords) / 100));

        $('#ccgmENumeroPercentaje').text(`${num}/${totalWords}`);
    },

    showQuestion: function (i) {
        let num = Math.max(0, Math.min(i, $exeDevice.wordsGame.length - 1)),
            p = $exeDevice.wordsGame[num];

        $exeDevice.clearQuestion();

        $('#ccgmEDefinitionWord').val(p.definition);
        $('#ccgmENumQuestions').text($exeDevice.wordsGame.length);
        $('#ccgmESolutionWord').val(p.word);
        $('#ccgmEPercentageShow').val(p.percentageShow);

        if (p.url.length > 4) {
            $('#ccgmEURLImage').val(p.url);
            $('#ccgmEXImage').val(p.x);
            $('#ccgmEYImage').val(p.y);
            $('#ccgmEAuthor').val(p.author);
            $('#ccgmEAlt').val(p.alt);
            $exeDevice.showImage(p.url, p.x, p.y, p.alt);
        }

        $exeDevice.stopSound();

        if (p.audio.trim().length > 4) {
            $exeDevice.playSound(p.audio.trim());
        }

        $('#ccgmEURLAudio').val(p.audio);
        $('#ccgmENumberQuestion').val(num + 1);
    },

    initQuestions: function () {
        $('#ccgmEMediaNormal, #ccgmEMediaImage').prop('disabled', false);

        if ($exeDevice.wordsGame.length === 0) {
            const question = $exeDevice.getCuestionDefault();
            $exeDevice.wordsGame.push(question);
            this.changeTypeQuestion();
        }

        this.active = 0;
    },

    changeTypeQuestion: function () {
        $('#ccgmEImage, #ccgmENoImage, #ccgmECover, #ccgmECursor').hide();
        $('#ccgmENoImage, #ccgmECursor').show();
        $exeDevice.showImage(
            $('#ccgmEURLImage').val(),
            $('#ccgmEXImage').val(),
            $('#ccgmEYImage').val(),
            $('#ccgmEAlt').val()
        );
    },

    getCuestionDefault: function () {
        return {
            word: '',
            definition: '',
            url: '',
            audio: '',
            x: 0,
            y: 0,
            author: '',
            alt: '',
        };
    },
    getIdeviceID: function () {
        const ideviceid =
            $('#ccgmQEIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';

        return ideviceid;
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            const wrapper = $('<div></div>').html(originalHTML),
                json = $('.crucigrama-DataGame', wrapper).text(),
                versionText = $('.crucigrama-version', wrapper).text();
            let dataJson = json;

            if (versionText.length === 1) {
                dataJson =
                    $exeDevices.iDevice.gamification.helpers.decrypt(json);
            }

            const dataGame =
                    $exeDevices.iDevice.gamification.helpers.isJsonString(
                        dataJson
                    ),
                $imagesLink = $('.crucigrama-LinkImages', wrapper),
                $audiosLink = $('.crucigrama-LinkAudios', wrapper),
                $imageBack = $('.crucigrama-LinkBack', wrapper);
            if ($imageBack.length === 1) {
                dataGame.urlBack = $imageBack.attr('href') || '';
            }

            $imagesLink.each(function () {
                const iq = parseInt($(this).text());
                if (!isNaN(iq) && iq < dataGame.wordsGame.length) {
                    dataGame.wordsGame[iq].url = $(this).attr('href') || '';
                    if (dataGame.wordsGame[iq].url.length < 4) {
                        dataGame.wordsGame[iq].url = '';
                    }
                }
            });

            $audiosLink.each(function () {
                const iq = parseInt($(this).text());
                if (!isNaN(iq) && iq < dataGame.wordsGame.length) {
                    dataGame.wordsGame[iq].audio = $(this).attr('href') || '';
                    if (dataGame.wordsGame[iq].audio.length < 4) {
                        dataGame.wordsGame[iq].audio = '';
                    }
                }
            });

            $exeDevice.updateFieldGame(dataGame);

            let instructions = $('.crucigrama-instructions', wrapper);
            if (instructions.length === 1) {
                instructions = instructions.html() || '';
                $('#eXeGameInstructions').val(instructions);
            }

            let textFeedBack = $('.crucigrama-feedback-game', wrapper);
            if (textFeedBack.length === 1) {
                textFeedBack = textFeedBack.html() || '';
                $('#ccgmEFeedBackEditor').val(textFeedBack);
            }

            let textAfter = $('.crucigrama-extra-content', wrapper);
            if (textAfter.length === 1) {
                textAfter = textAfter.html() || '';
                $('#eXeIdeviceTextAfter').val(textAfter);
            }

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
        if (!$exeDevice.validateQuestion()) return;

        const dataGame = $exeDevice.validateData();

        if (!dataGame) return false;

        $exeDevice.stopSound();

        const fields = this.ci18n,
            i18n = fields;
        for (const i in fields) {
            const fVal = $(`#ci18n_${i}`).val();
            if (fVal !== '') i18n[i] = fVal;
        }

        dataGame.msgs = i18n;
        let json = JSON.stringify(dataGame);

        json = $exeDevices.iDevice.gamification.helpers.encrypt(json);

        const textFeedBack = tinyMCE.get('ccgmEFeedBackEditor').getContent();

        let divInstructions = '';
        if (dataGame.instructions !== '') {
            divInstructions = `<div class="crucigrama-instructions gameQP-instructions">${dataGame.instructions}</div>`;
        }

        const linksImages = $exeDevice.createlinksImage(dataGame.wordsGame),
            linksAudios = $exeDevice.createlinksAudio(dataGame.wordsGame);

        let img = $('#ccgmEURLBack').val();
        if (img.trim().length > 4) {
            img = `<a href="${img}" class="js-hidden crucigrama-LinkBack" alt="Back" />Background</a>`;
        }

        let textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();
        if (textAfter !== '') {
            textAfter = `<div class="crucigrama-extra-content">${textAfter}</div>`;
        }
        const html = `<div class="crucigrama-IDevice">
       <div class="game-evaluation-ids js-hidden" data-id="${dataGame.id}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>
            <div class="crucigrama-version js-hidden">${$exeDevice.version}</div>
            <div class="crucigrama-feedback-game">${textFeedBack}</div>
            ${divInstructions}
            <div class="crucigrama-DataGame js-hidden">${json}</div>
            ${linksImages}
            ${linksAudios}
            ${img}
            ${textAfter}
            <div class="crucigrama-bns js-hidden">${$exeDevice.msgs.msgNoSuportBrowser}</div>
        </div>`;

        return html;
    },

    validateAlt: function () {
        let altImage = $('#ccgmEAlt').val();

        if (!$exeDevice.checkAltImage || altImage !== '') return true;

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

    getMediaType: function () {
        const ele = document.getElementsByName('ccgmtype');
        for (i = 0; i < ele.length; i++) {
            if (ele[i].checked) return ele[i].value;
        }
    },

    createlinksImage: function (wordsGame) {
        let html = '';
        for (let i = 0; i < wordsGame.length; i++) {
            if (
                wordsGame[i].url.length > 4 &&
                !wordsGame[i].url.startsWith('http')
            ) {
                html += `<a href="${wordsGame[i].url}" class="js-hidden crucigrama-LinkImages">${i}</a>`;
            }
        }
        return html;
    },

    createlinksAudio: function (wordsGame) {
        let html = '';
        for (let i = 0; i < wordsGame.length; i++) {
            if (
                wordsGame[i].audio.length > 4 &&
                !wordsGame[i].audio.startsWith('http')
            ) {
                html += `<a href="${wordsGame[i].audio}" class="js-hidden crucigrama-LinkAudios">${i}</a>`;
            }
        }
        return html;
    },

    validateQuestion: function () {
        let message = '',
            p = {
                word: $('#ccgmESolutionWord').val().trim(),
                definition: $('#ccgmEDefinitionWord').val(),
                x: parseFloat($('#ccgmEXImage').val()),
                y: parseFloat($('#ccgmEYImage').val()),
                author: $('#ccgmEAuthor').val(),
                alt: $('#ccgmEAlt').val(),
                url: $('#ccgmEURLImage').val().trim(),
                audio: $('#ccgmEURLAudio').val(),
                percentageShow: parseInt($('#ccgmEPercentageShow').val()),
            };

        $exeDevice.stopSound();

        if (p.word.length === 0) {
            message = $exeDevice.msgs.msgEProvideWord;
        } else if (p.word.length > 14 || p.word.includes(' ')) {
            message = $exeDevice.msgs.msgMaximeSize;
        } else if (
            p.definition.length === 0 &&
            p.url.length < 4 &&
            p.audio.length < 4
        ) {
            message = $exeDevice.msgs.msgEProvideDefinition;
        }

        if (p.url.length < 4) p.url = '';
        if (p.audio.length < 4) p.audio = '';
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

    validateData() {
        const clear = $exeDevice.removeTags,
            instructions = tinyMCE.get('eXeGameInstructions').getContent(),
            textFeedBack = tinyMCE.get('ccgmEFeedBackEditor').getContent(),
            textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent(),
            time = $('#ccgmETime').val(),
            difficulty = $('#ccgmEDifficulty').val(),
            showMinimize = $('#ccgmEShowMinimize').is(':checked'),
            showSolution = $('#ccgmEShowSolution').is(':checked'),
            hasBack = $('#ccgmBack0').is(':checked'),
            urlBack = $('#ccgmEURLBack').val().trim(),
            itinerary =
                $exeDevicesEdition.iDevice.gamification.itinerary.getValues(),
            caseSensitive = $('#ccgmECaseSensitive').is(':checked'),
            tilde = $('#ccgmETilde').is(':checked'),
            feedBack = $('#ccgmEHasFeedBack').is(':checked'),
            percentajeFB = parseInt(clear($('#ccgmEPercentajeFB').val())),
            evaluation = $('#ccgmEEvaluation').is(':checked'),
            evaluationID = $('#ccgmEEvaluationID').val(),
            percentajeQuestions = $('#ccgmEPercentajeQuestions').val(),
            authorBackImage = $('#ccgmAuthorBack').val(),
            id = $exeDevice.getIdeviceID(),
            wordsGame = $exeDevice.wordsGame,
            scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();

        if (!itinerary) return false;

        if (feedBack && textFeedBack.trim().length === 0) {
            eXe.app.alert($exeDevice.msgs.msgProvideFB);
            return false;
        }
        if (wordsGame.length < 2) {
            eXe.app.alert($exeDevice.msgs.msgEOneQuestion);
            return false;
        }
        if (evaluation && evaluationID.length < 5) {
            eXe.app.alert($exeDevice.msgs.msgIDLenght);
            return false;
        }
        for (let i = 0; i < wordsGame.length; i++) {
            const mquestion = wordsGame[i];
            if (mquestion.word.length === 0) {
                $exeDevice.showMessage($exeDevice.msgs.msgEProvideWord);
                return false;
            } else if (
                mquestion.definition.length === 0 &&
                mquestion.url.length < 4 &&
                mquestion.audio.length < 4
            ) {
                $exeDevice.showMessage(
                    `${$exeDevice.msgs.msgEProvideDefinition} ${mquestion.word}`
                );
                return false;
            }
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
            typeGame: 'Crucigrama',
            instructions,
            showMinimize,
            showSolution,
            itinerary,
            wordsGame,
            isScorm: scorm.isScorm,
            hasBack,
            urlBack,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted || 100,
            textFeedBack: escape(textFeedBack),
            textAfter: escape(textAfter),
            caseSensitive,
            tilde,
            feedBack,
            percentajeFB,
            version: 2,
            evaluation,
            evaluationID,
            percentajeQuestions,
            difficulty,
            time,
            authorBackImage,
            id,
        };
    },

    showImage: function (url, x, y, alt) {
        const $image = $('#ccgmEImage'),
            $cursor = $('#ccgmECursor');
        $image.hide();
        $cursor.hide();
        $image.attr('alt', alt);

        $('#ccgmENoImage').show();
        url = $exeDevices.iDevice.gamification.media.extractURLGD(url);
        $image
            .prop('src', url)
            .on('load', function () {
                if (
                    !this.complete ||
                    typeof this.naturalWidth === 'undefined' ||
                    this.naturalWidth === 0
                ) {
                    //
                } else {
                    const mData = $exeDevice.placeImageWindows(
                        this,
                        this.naturalWidth,
                        this.naturalHeight
                    );
                    $exeDevice.drawImage(this, mData);
                    $image.show();
                    $('#ccgmENoImage').hide();
                    $exeDevice.paintMouse(this, $cursor, x, y);
                }
            })
            .on('error', function () {
                //
            });
    },

    showImageBack: function (hasback, url) {
        const $image = $('#ccgmEImageBack'),
            $imageno = $('#ccgmEImageNoBack');
        $image.hide();
        $imageno.show();
        url = $exeDevices.iDevice.gamification.media.extractURLGD(url);
        if (hasback && url.length > 4) {
            $image
                .prop('src', url)
                .on('load', function () {
                    $image.show();
                    $imageno.hide();
                })
                .on('error', function () {});
        }
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
            const $image = $(image),
                wI = $image.width() || 1,
                hI = $image.height() || 1,
                lI = $image.position().left + wI * x,
                tI = $image.position().top + hI * y;
            $(cursor)
                .css({
                    left: `${lI}px`,
                    top: `${tI}px`,
                    'z-index': 3,
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
        $('#ccgmEPaste').hide();

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

        $('#ccgmEAdd').on('click', (e) => {
            e.preventDefault();
            $exeDevice.addQuestion();
        });

        $('#ccgmEFirst').on('click', (e) => {
            e.preventDefault();
            $exeDevice.firstQuestion();
        });

        $('#ccgmEPrevious').on('click', (e) => {
            e.preventDefault();
            $exeDevice.previousQuestion();
        });

        $('#ccgmENext').on('click', (e) => {
            e.preventDefault();
            $exeDevice.nextQuestion();
        });

        $('#ccgmELast').on('click', (e) => {
            e.preventDefault();
            $exeDevice.lastQuestion();
        });

        $('#ccgmEDelete').on('click', (e) => {
            e.preventDefault();
            $exeDevice.removeQuestion();
        });

        $('#ccgmECopy').on('click', (e) => {
            e.preventDefault();
            $exeDevice.copyQuestion();
        });

        $('#ccgmECut').on('click', (e) => {
            e.preventDefault();
            $exeDevice.cutQuestion();
        });

        $('#ccgmEPaste').on('click', (e) => {
            e.preventDefault();
            $exeDevice.pasteQuestion();
        });

        $('#ccgmEPlayAudio').on('click', (e) => {
            e.preventDefault();
            const selectedFile = $('#ccgmEURLAudio').val().trim();
            if (selectedFile.length > 4) {
                $exeDevice.stopSound();
                $exeDevice.playSound(selectedFile);
            }
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

        $('#ccgmEURLImage').on('change', function () {
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $(this).val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (selectedFile.startsWith('files') && !validExt.includes(ext)) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: jpg, jpeg, gif, png, svg, webp`
                );
                return false;
            }
            const url = selectedFile,
                alt = $('#ccgmEAlt').val(),
                x = parseFloat($('#ccgmEXImage').val()),
                y = parseFloat($('#ccgmEYImage').val());
            $exeDevice.showImage(url, x, y, alt);
        });

        $('#ccgmEPlayImage').on('click', (e) => {
            e.preventDefault();
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $('#ccgmEURLImage').val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (selectedFile.startsWith('files') && !validExt.includes(ext)) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: jpg, jpeg, gif, png, svg, webp`
                );
                return false;
            }
            const url = selectedFile,
                alt = $('#ccgmEAlt').val(),
                x = parseFloat($('#ccgmEXImage').val()),
                y = parseFloat($('#ccgmEYImage').val());
            $exeDevice.showImage(url, x, y, alt);
        });

        $('#ccgmEImage').on('click', (e) => {
            e.preventDefault();
            $exeDevice.clickImage(e.currentTarget, e.pageX, e.pageY);
        });

        $('#ccgmECursor').on('click', function (e) {
            e.preventDefault();
            $(this).hide();
            $('#ccgmEXImage').val(0);
            $('#ccgmEYImage').val(0);
        });

        $('#ccgmEURLAudio').on('change', function () {
            const selectedFile = $(this).val().trim();
            if (selectedFile.length === 0) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: mp3, ogg, wav`
                );
            } else {
                if (selectedFile.length > 4) {
                    $exeDevice.stopSound();
                    $exeDevice.playSound(selectedFile);
                }
            }
        });

        $('#ccgmEHasFeedBack').on('change', function () {
            const checked = $(this).is(':checked');
            if (checked) {
                $('#ccgmEFeedbackP').slideDown();
            } else {
                $('#ccgmEFeedbackP').slideUp();
            }
            $('#ccgmEPercentajeFB').prop('disabled', !checked);
        });

        $('#ccgmENumberQuestion').on('keyup', function (e) {
            if (e.keyCode === 13) {
                const num = parseInt($(this).val());
                if (!isNaN(num) && num > 0) {
                    if ($exeDevice.validateQuestion()) {
                        $exeDevice.active = Math.min(
                            num - 1,
                            $exeDevice.wordsGame.length - 1
                        );
                        $exeDevice.showQuestion($exeDevice.active);
                    } else {
                        $(this).val($exeDevice.active + 1);
                    }
                } else {
                    $(this).val($exeDevice.active + 1);
                }
            }
        });

        $('#ccgmEEvaluation').on('change', function () {
            const checked = $(this).is(':checked');
            $('#ccgmEEvaluationID').prop('disabled', !checked);
        });

        $('#ccgmEEvaluationHelpLnk').on('click', function () {
            $('#ccgmEEvaluationHelp').toggle();
            return false;
        });

        $('#ccgmEShowMore').on('click', (e) => {
            e.preventDefault();
            $('#ccgmEAuthorAlt').slideToggle();
            if ($('#ccgmEAuthorAlt').is(':visible')) {
                $('#ccgmEAuthorAlt').css('display', 'flex');
            }
        });

        $('#ccgmETime')
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 3);
                this.value = v;
            })
            .on('focusout', function () {
                this.value = this.value.trim() === '' ? 0 : this.value;
                this.value = Math.min(Math.max(this.value, 0), 59);
            });

        $('#ccgmEDifficulty')
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 3);
                this.value = v;
            })
            .on('focusout', function () {
                this.value = this.value.trim() === '' ? 100 : this.value;
                this.value = Math.min(Math.max(this.value, 0), 100);
            });

        $('#ccgmBack0').on('change', function () {
            if ($(this).is(':checked')) {
                $('#ccgmbackground, #ccgmbackground1, #ccgmAuthorBackDiv')
                    .removeClass('d-none')
                    .addClass('d-flex');
            } else {
                $('#ccgmbackground, #ccgmbackground1, #ccgmAuthorBackDiv')
                    .removeClass('d-flex')
                    .addClass('d-none');
            }
        });

        $('#ccgmEPlayBack').on('click', (e) => {
            e.preventDefault();
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $('#ccgmEURLBack').val(),
                ext = selectedFile.split('.').pop().toLowerCase(),
                hasBack = $('#ccgmBack0').is(':checked');
            if (selectedFile.startsWith('files') && !validExt.includes(ext)) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: jpg, jpeg, gif, png, svg, webp`
                );
                return false;
            }
            $exeDevice.showImageBack(hasBack, selectedFile);
        });

        $('#ccgmEURLBack').on('change', function () {
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $(this).val(),
                ext = selectedFile.split('.').pop().toLowerCase(),
                hasBack = $('#ccgmBack0').is(':checked');
            if (selectedFile.startsWith('files') && !validExt.includes(ext)) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: jpg, jpeg, gif, png, svg, webp`
                );
                return false;
            }
            $exeDevice.showImageBack(hasBack, selectedFile);
        });

        $('#ccgmEPercentajeQuestions').on('change', () => {
            $exeDevice.updateQuestionsNumber();
        });

        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents(
            $exeDevice.insertWords
        );
        $exeDevicesEdition.iDevice.gamification.share.addEvents(
            0,
            $exeDevice.insertWords
        );

        //eXe 3.0 Dismissible messages
        $('.exe-block-dismissible .exe-block-close').on('click', function () {
            $(this).parent().fadeOut();
            return false;
        });
    },

    updateGameMode: function (gamemode, feedback) {
        $('#ccgmEPercentajeFB').prop('disabled', !feedback && gamemode !== 2);
        $('#ccgmEHasFeedBack').prop('disabled', gamemode === 2);
        $('#ccgmEHasFeedBack').prop('checked', feedback);

        if (feedback) {
            $('#ccgmEFeedbackP').slideDown();
        } else {
            $('#ccgmEFeedbackP').slideUp();
        }
    },

    clearQuestion: function () {
        $exeDevice.changeTypeQuestion();

        $('#ccgmEImage').removeAttr('src alt title');
        $(
            '#ccgmEURLImage, #ccgmEXImage, #ccgmEYImage, #ccgmEAuthor, #ccgmEAlt, #ccgmEDefinitionWord, #ccgmESolutionWord, #ccgmEURLAudio'
        ).val('');
        $('#ccgmEXImage, #ccgmEYImage').val('0');
    },

    addQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.clearQuestion();
            $exeDevice.wordsGame.push($exeDevice.getCuestionDefault());
            $exeDevice.active = $exeDevice.wordsGame.length - 1;
            $('#ccgmENumberQuestion').val($exeDevice.wordsGame.length);
            $exeDevice.typeEdit = -1;
            $('#ccgmEPaste').hide();
            $('#ccgmENumQuestions').text($exeDevice.wordsGame.length);
            $exeDevice.updateQuestionsNumber();
        }
    },

    removeQuestion: function () {
        if ($exeDevice.wordsGame.length < 3) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
        } else {
            $exeDevice.wordsGame.splice($exeDevice.active, 1);
            if ($exeDevice.active >= $exeDevice.wordsGame.length - 1) {
                $exeDevice.active = $exeDevice.wordsGame.length - 1;
            }
            $exeDevice.showQuestion($exeDevice.active);
            $exeDevice.typeEdit = -1;
            $('#ccgmEPaste').hide();
            $('#ccgmENumQuestions').text($exeDevice.wordsGame.length);
            $('#ccgmENumberQuestion').val($exeDevice.active + 1);
            $exeDevice.updateQuestionsNumber();
        }
    },

    copyQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.typeEdit = 0;
            $exeDevice.clipBoard = JSON.parse(
                JSON.stringify($exeDevice.wordsGame[$exeDevice.active])
            );
            $('#ccgmEPaste').show();
        }
    },

    cutQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.numberCutCuestion = $exeDevice.active;
            $exeDevice.typeEdit = 1;
            $('#ccgmEPaste').show();
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
            $('#ccgmEPaste').hide();
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                $exeDevice.wordsGame,
                $exeDevice.numberCutCuestion,
                $exeDevice.active
            );
            $exeDevice.showQuestion($exeDevice.active);
            $('#ccgmENumQuestions').text($exeDevice.wordsGame.length);
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
        game.weighted =
            typeof game.weighted !== 'undefined' ? game.weighted : 100;
        game.tilde = typeof game.tilde !== 'undefined' ? game.tilde : true;
        $exeDevice.id = $exeDevice.getIdeviceID();
        $('#ccgmEShowMinimize').prop('checked', game.showMinimize);
        $('#ccgmETime').val(game.time);
        $('#ccgmEDifficulty').val(game.difficulty);
        $('#ccgmEShowSolution').prop('checked', game.showSolution);
        $('#ccgmECaseSensitive').prop('checked', game.caseSensitive);
        $('#ccgmETilde').prop('checked', game.tilde);
        $('#ccgmEHasFeedBack').prop('checked', game.feedBack);
        $('#ccgmEPercentajeFB').val(game.percentajeFB);
        $('#ccgmEEvaluation').prop('checked', game.evaluation);
        $('#ccgmEEvaluationID').val(game.evaluationID);
        $('#ccgmBack0').prop('checked', game.hasBack);
        $('#ccgmEEvaluationID').prop('disabled', !game.evaluation);
        $('#ccgmAuthorBack').val(game.authorBackImage);
        $('#ccgmEPercentajeQuestions').val(game.percentajeQuestions);

        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted
        );
        $exeDevice.wordsGame = game.wordsGame;

        if (game.feedBack) {
            $('#ccgmEFeedbackP').show();
        } else {
            $('#ccgmEFeedbackP').hide();
        }

        $('#ccgmEPercentajeFB').prop('disabled', !game.feedBack);
        $exeDevice.showImageBack(game.hasBack, game.urlBack);
        $('#ccgmbackground, #ccgmbackground1').hide();

        if (game.hasBack) {
            $('#ccgmbackground, #ccgmbackground1, #ccgmAuthorBackDiv')
                .removeClass('d-none')
                .addClass('d-flex');
            if (game.urlBack.length > 4) {
                $('#ccgmEURLBack').val(game.urlBack);
            }
        }
        $exeDevice.updateQuestionsNumber();
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

    importGame: function (content, filetype) {
        const game =
            $exeDevices.iDevice.gamification.helpers.isJsonString(content);
        let instructions, tAfter, textFeedBack;
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
        } else if (game && game.typeGame == 'Crucigrama') {
            game.id = $exeDevice.getIdeviceID();
            $exeDevice.updateFieldGame(game);
            instructions = game.instructionsExe || game.instructions;
            tAfter = game.textAfter || '';
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
            if (tinyMCE.get('ccgmEFeedBackEditor')) {
                tinyMCE
                    .get('ccgmEFeedBackEditor')
                    .setContent(unescape(textFeedBack));
            } else {
                $('#ccgmEFeedBackEditor').val(unescape(textFeedBack));
            }
        } else if (game && game.typeGame !== 'Crucigrama') {
            eXe.app.alert($exeDevice.msgs.msgESelectFile);
            return;
        }

        $exeDevice.active = 0;
        $exeDevice.showQuestion($exeDevice.active);
        $exeDevice.deleteEmptyQuestion();
        $exeDevice.updateQuestionsNumber();
        //$('.exe-form-tabs li:first-child a').click();
    },

    deleteEmptyQuestion: function () {
        if ($exeDevice.wordsGame.length > 1) {
            const quextion = $('#ccgmESolutionWord').val().trim();
            if (quextion.length == 0) {
                $exeDevice.removeQuestion();
            }
        }
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
                if (
                    p.word &&
                    p.definition &&
                    p.word.length < 15 &&
                    !p.word.includes(' ')
                ) {
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
            $exeDevice.showMessage(_('Sorry, wrong file format'));
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

    clickImage: function (img, epx, epy) {
        const $cursor = $('#ccgmECursor'),
            $x = $('#ccgmEXImage'),
            $y = $('#ccgmEYImage'),
            $img = $(img),
            posX = epx - $img.offset().left,
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
