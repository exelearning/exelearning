/* eslint-disable no-undef */
/**
 * Rosco Activity iDevice (edition code)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narvaez Martinez
 * Author: Ricardo Malaga Floriano
 * Author: Ignacio Gros
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    name: 'az-quiz-game',
    title: _('A-Z quiz', 'az-quiz-game'),
    idevicePath: '',
    msgs: {},
    classIdevice: 'az-quiz-game',
    roscoVersion: 2,
    id: false,
    ci18n: {},
    colors: {
        black: '#1c1b1b',
        blue: '#0099cc',
        verde: '#009245',
        red: '#ff0000',
        white: '#ffffff',
        yellow: '#f3d55a',
        grey: '#818181',
    },
    letters: _('abcdefghijklmnopqrstuvwxyz').toUpperCase(),
    modeBoard: false,
    checkAltImage: true,
    accesibilityIsOk: true,

    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.letters = $exeDevice.replaceLetters(this.letters);
        this.refreshTranslations();
        this.setMessagesInfo();
        this.createForm();
        this.addEvents();
    },

    refreshTranslations: function () {
        this.ci18n = {
            msgReady: c_('Ready?'),
            msgStartGame: c_('Click here to start'),
            msgHappen: c_('Move on'),
            msgReply: c_('Reply'),
            msgSubmit: c_('Submit'),
            msgEnterCode: c_('Enter the access code'),
            msgErrorCode: c_('The access code is not correct'),
            msgGameOver: c_('Game Over!'),
            msgNewWord: c_('New word'),
            msgStartWith: c_('Starts with %1'),
            msgContaint: c_('Contains letter %1'),
            msgPass: c_('Move on to the next word'),
            msgIndicateWord: c_('Provide a word'),
            msgClue: c_('Cool! The clue is:'),
            msgNewGame: c_('Click here for a new game'),
            msgYouHas: c_('You have got %1 hits and %2 misses'),
            msgCodeAccess: c_('Access code'),
            msgPlayAgain: c_('Play Again'),
            msgRequiredAccessKey: c_('Access code required'),
            msgInformationLooking: c_('The information you were looking for'),
            msgPlayStart: c_('Click here to play'),
            msgMinimize: c_('Minimize'),
            msgMaximize: c_('Maximize'),
            msgHits: c_('Hits'),
            msgErrors: c_('Errors'),
            msgTime: c_('Time Limit (mm:ss)'),
            msgOneRound: c_('One round'),
            msgTowRounds: c_('Two rounds'),
            msgImage: c_('Image'),
            msgNoImage: c_('No image'),
            msgWrote: c_(
                'Write the correct word and click on Reply. If you hesitate, click on Move on.'
            ),
            msgNotNetwork: c_(
                'You can only play this game with internet connection.'
            ),
            msgSuccesses: c_(
                'Right! | Excellent! | Great! | Very good! | Perfect!'
            ),
            msgFailures: c_(
                'It was not that! | Incorrect! | Not correct! | Sorry! | Error!'
            ),
            msgEndGameScore: c_(
                'Please start the game before saving your score.'
            ),
            msgScoreScorm: c_(
                "The score can't be saved because this page is not part of a SCORM package."
            ),
            msgShowRoulette: c_('Show word wheel'),
            msgHideRoulette: c_('Hide word wheel'),
            msgQuestion: c_('Question'),
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
            msgAuthor: c_('Authorship'),
            msgSeveralScore: c_(
                'You can save the score as many times as you want'
            ),
            msgYouLastScore: c_('The last score saved is'),
            msgActityComply: c_('You have already done this activity.'),
            msgPlaySeveralTimes: c_(
                'You can do this activity as many times as you want'
            ),
            msgFullScreen: c_('Full Screen'),
            msgExitFullScreen: c_('Exit Full Screen'),
            msgMoveOne: c_('Move on'),
            msgAudio: c_('Audio'),
            msgCorrect: c_('Correct'),
            msgIncorrect: c_('Incorrect'),
            msgWhiteBoard: c_('Digital whiteboard'),
            msgClose: c_('Close'),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgTypeGame: c_('A-Z quiz'),
            msgShowWords: c_('Show solutions'),
            msgAll: c_('All'),
            msgUnanswered: c_('Not answered'),
            msgScore: c_('Score'),
            msgWeight: c_('Weight'),
        };
    },

    setMessagesInfo: function () {
        const msgs = this.msgs;
        msgs.msgNotStart = _('%1 does not start with letter %2');
        msgs.msgNotContain = _('%1 does not contain letter %2');
        msgs.msgProvideDefinition = _(
            'Please provide the word definition or the valid URL of an image'
        );
        msgs.msgGame = _('Game');
        msgs.msgSelectFile = _(
            'The selected file does not contain a valid game'
        );
        msgs.msgURLValid = _(
            'You must upload or indicate the valid URL of an image'
        );
        msgs.msgOneWord = _('Please provide at least one word');
        msgs.msgProvideTimeSolution = _(
            'You must provide the time to view the solution'
        );
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.'
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
        let path = this.idevicePath,
            wordInstructions = _(
                "Provide a word and its definition. May toggle between: 'Word starts' or 'Word contains', by clicking on %s"
            );
        wordInstructions = wordInstructions.replace(
            '%s',
            `<img src="${path}roscoIcoStart.png" alt="${_('Starts with/Contains')}" title="${_('Starts with/Contains')}" />`
        );
        const html = `
            <div id="roscoIdeviceForm">
                <p class="exe-block-info exe-block-dismissible" style="position:relative">
                    ${_('Create activities in which students are given a definition and they have to guess the word that starts with a letter or contains a letter.')} 
                    <a href="https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe29/rosco.html" hreflang="es" target="_blank">${_('Usage Instructions')}</a>
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Observe the letters, identify and fill in the missing words.'))}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_('Options')}</a></legend>
                            <div>
                                <div class="toggle-item" idevice-id="roscoShowMinimize">
                                    <div class="toggle-control">
                                        <input type="checkbox" id="roscoShowMinimize" class="toggle-input">
                                        <span class="toggle-visual"></span>
                                    </div>
                                    <label class="toggle-label idevice-title" for="roscoShowMinimize">${_('Show minimized.')}</label>
                                </div>
                                <div>
                                    <label for="roscoDuration">${_('Game time (seconds)')}: </label>
                                    <input type="number" class="form-control form-control-sm" name="roscoDuration" id="roscoDuration" value="240" min="5" max="9999" step="10" required />
                                </div>
                                <div>
                                    <label for="roscoNumberTurns">${_('Number of rounds')}: </label>
                                    <input type="number" class="form-control form-control-sm" value="1" min="0" max="2" id="roscoNumberTurns" required />
                                </div>
                                <div class="roscoShowSolutionRow d-flex align-items-center flex-wrap">
                                    <div class="toggle-item m-0" idevice-id="roscoShowSolution">
                                        <div class="toggle-control">
                                            <input type="checkbox" checked id="roscoShowSolution" class="toggle-input">
                                            <span class="toggle-visual"></span>
                                        </div>
                                        <label class="toggle-label" for="roscoShowSolution">${_('Show solutions')}.</label>
                                    </div>
                                    <label for="roscoTimeShowSolution" class="mb-0 ms-2 d-flex align-items-center gap-1 roscoShowSolutionTime">
                                        ${_('Show solution in')}:                                        
                                    </label>
                                    <input type="number" class="form-control form-control-sm" name="roscoTimeShowSolution" id="roscoTimeShowSolution" value="3" min="1" max="9" />
                                    <span>${_('seconds')}</span>
                                </div>
                                <div class="toggle-item" idevice-id="roscoCaseSensitive">
                                    <div class="toggle-control">
                                        <input type="checkbox" id="roscoCaseSensitive" class="toggle-input">
                                        <span class="toggle-visual"></span>
                                    </div>
                                    <label class="toggle-label" for="roscoCaseSensitive">${_('Case sensitive')}.</label>
                                </div>

                                <div class="toggle-item" idevice-id="roscoModeBoard">
                                    <div class="toggle-control">
                                        <input type="checkbox" id="roscoModeBoard" class="toggle-input">
                                        <span class="toggle-visual"></span>
                                    </div>
                                    <label class="toggle-label" for="roscoModeBoard">${_('Digital whiteboard mode')}.</label>
                                </div>

                                <div class="toggle-item" idevice-id="roscoEEvaluation">
                                    <div class="toggle-control">
                                        <input type="checkbox" id="roscoEEvaluation" class="toggle-input"">
                                        <span class="toggle-visual"></span>
                                    </div>
                                    <label class="toggle-label" for="roscoEEvaluation">${_('Progress report')}.</label>
                                    <div class="toggle-related">
                                        <label for="roscoEEvaluationID">${_('Identifier')}:</label>
                                        <input type="text" class="form-control form-control-sm" id="roscoEEvaluationID" disabled value="${eXeLearning.app.project.odeId || ''}"/>
                                        <a href="#roscoEEvaluationHelp" id="roscoEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                            <img src="${path}quextIEHelp.png"  width="18" height="18" alt="${_('Help')}"/>
                                        </a>
                                    </div>
                                </div>
                                <p id="roscoEEvaluationHelp" class="roscoTypeGameHelp exe-block-info">
                                    ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                                </p>
                            </div>
                    </fieldset>
                    <fieldset class="exe-fieldset">
                        <legend><a href="#">${_('Words')}</a></legend>
                        <div id="roscoDataWord">
                            <div class="exe-idevice-info">${wordInstructions}</div>
                            ${this.getWords().join('')}
                        </div>
                    </fieldset>
                    ${$exeDevicesEdition.iDevice.common.getTextFieldset('after')}
                </div>
                ${$exeDevicesEdition.iDevice.gamification.itinerary.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.scorm.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
                ${$exeDevicesEdition.iDevice.gamification.share.getTab(true, 1, true)}
                ${$exeDevicesEdition.iDevice.gamification.share.getTabIA(1)}
            </div>
        `;

        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('roscoIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();

        this.loadPreviousValues();
    },

    insertWords: function (content) {
        const lines = content;
        const lineFormat = /^([^#]+)#([^#]+)(#(0|1)(#[A-Za-zÑñ])?)?$/;
        const words = lines.filter((line) => lineFormat.test(line.trim()));

        if (words.length > 0) {
            const swords = $exeDevice.getImportLetters(
                $exeDevice.letters,
                words
            );
            if (swords.length > 0) {
                $exeDevice.updateImportFields(swords);
                //$('.exe-form-tabs li:first-child a').click();
            } else {
                eXe.app.alert(_('Sorry, wrong file format'));
            }
        } else {
            eXe.app.alert(_('Sorry, wrong file format'));
        }
    },

    getLetters: function (dataGame) {
        const { letters, wordsGame } = dataGame;

        if (typeof letters === 'undefined') {
            let resultLetters = '';
            wordsGame.forEach((word) => {
                resultLetters += word.letter;
            });
            dataGame.letters = resultLetters;
        }

        return dataGame.letters;
    },

    updateFieldGame: function (dataGame) {
        $exeDevice.letters = $exeDevice.getLetters(dataGame);

        dataGame.evaluation =
            typeof dataGame.evaluation !== 'undefined'
                ? dataGame.evaluation
                : false;
        dataGame.evaluationID =
            typeof dataGame.evaluationID !== 'undefined'
                ? dataGame.evaluationID
                : '';
        dataGame.weighted =
            typeof dataGame.weighted !== 'undefined' ? dataGame.weighted : 100;

        $exeDevice.id = $exeDevice.getIdeviceID();

        $('#roscoDataWord').append($exeDevice.getWords().join(''));
        $('#roscoDuration').val(dataGame.durationGame);
        $('#roscoNumberTurns').val(dataGame.numberTurns);
        $('#roscoShowSolution').prop('checked', dataGame.showSolution);
        $('#roscoShowMinimize').prop('checked', dataGame.showMinimize);
        $('#roscoTimeShowSolution').val(dataGame.timeShowSolution);
        $('#roscoModeBoard').prop('checked', dataGame.modeBoard);
        $('#roscoTimeShowSolution').prop('disabled', !dataGame.showSolution);
        $('#roscoEEvaluation').prop('checked', dataGame.evaluation);
        $('#roscoEEvaluationID').val(dataGame.evaluationID);
        $('#roscoEEvaluationID').prop('disabled', !dataGame.evaluation);

        for (let i = 0; i < dataGame.wordsGame.length; i++) {
            dataGame.wordsGame[i].audio =
                typeof dataGame.wordsGame[i].audio === 'undefined'
                    ? ''
                    : dataGame.wordsGame[i].audio;
        }

        $('#roscoCaseSensitive').prop('checked', dataGame.caseSensitive);

        $('.roscoWordEdition').each(function (index) {
            const word =
                index < dataGame.wordsGame.length
                    ? dataGame.wordsGame[index].word
                    : '';
            $(this).val(word);
        });

        $('.roscoDefinitionEdition').each(function (index) {
            const definition =
                index < dataGame.wordsGame.length
                    ? dataGame.wordsGame[index].definition
                    : '';
            $(this).val(definition);
        });

        $('.roscoAuthorEdition').each(function (index) {
            const author =
                index < dataGame.wordsGame.length
                    ? dataGame.wordsGame[index].author
                    : '';
            $(this).val(author);
        });

        $('.roscoAlt').each(function (index) {
            const alt =
                index < dataGame.wordsGame.length
                    ? dataGame.wordsGame[index].alt
                    : '';
            $(this).val(alt);
        });

        $('.roscoURLImageEdition').each(function (index) {
            const url =
                index < dataGame.wordsGame.length
                    ? dataGame.wordsGame[index].url
                    : '';
            $(this).val(url);
        });

        $('.roscoURLAudioEdition').each(function (index) {
            const audio =
                index < dataGame.wordsGame.length
                    ? dataGame.wordsGame[index].audio
                    : '';
            $(this).val(audio);
        });

        $('.roscoXImageEdition').each(function (index) {
            const x =
                index < dataGame.wordsGame.length
                    ? dataGame.wordsGame[index].x
                    : 0;
            $(this).val(x);
        });

        $('.roscoYImageEdition').each(function (index) {
            const y =
                index < dataGame.wordsGame.length
                    ? dataGame.wordsGame[index].y
                    : 0;
            $(this).val(y);
        });

        $('.roscoStartEdition').each(function (index) {
            const type =
                index < dataGame.wordsGame.length
                    ? dataGame.wordsGame[index].type
                    : 1;
            const imageStart = type ? 'roscoContains.png' : 'roscoStart.png';
            $(this).attr('src', $exeDevice.idevicePath + imageStart);
        });

        $('.roscoSelectImageEdition').each(function (index) {
            const url =
                index < dataGame.wordsGame.length
                    ? dataGame.wordsGame[index].url
                    : '';
            const imageSelect =
                $.trim(url).length > 0
                    ? 'roscoSelectImage.png'
                    : 'roscoSelectImageInactive.png';
            $(this).attr('src', $exeDevice.idevicePath + imageSelect);
        });

        $('.imagesLink').each(function (index) {
            const url =
                index < dataGame.wordsGame.length
                    ? dataGame.wordsGame[index].url
                    : '';
            const imageSelect =
                $.trim(url).length > 0
                    ? 'roscoSelectImage.png'
                    : 'roscoSelectImageInactive.png';
            $(this).attr('src', $exeDevice.idevicePath + imageSelect);
        });

        $('h3.roscoLetterEdition').each(function (index) {
            const word =
                index < dataGame.wordsGame.length
                    ? dataGame.wordsGame[index].word
                    : '';
            const longitud = word.length;
            const color =
                longitud > 0 ? $exeDevice.colors.blue : $exeDevice.colors.grey;
            $(this).css('background-color', color);
        });

        $exeDevicesEdition.iDevice.gamification.itinerary.setValues(
            dataGame.itinerary
        );

        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            dataGame.isScorm,
            dataGame.textButtonScorm,
            dataGame.repeatActivity,
            dataGame.weighted
        );
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            const wrapper = $('<div></div>');
            wrapper.html(originalHTML);

            let json = $('.rosco-DataGame', wrapper).text(),
                version = $('.rosco-version', wrapper).text();

            if (version.length === 1) {
                json = $exeDevices.iDevice.gamification.helpers.decrypt(json);
            }

            let dataGame =
                $exeDevices.iDevice.gamification.helpers.isJsonString(json);
            dataGame.modeBoard =
                typeof dataGame.modeBoard === 'undefined'
                    ? false
                    : dataGame.modeBoard;
            $exeDevice.modeBoard = dataGame.modeBoard;

            version = version ? parseInt(version) : 0;

            for (let i = 0; i < dataGame.wordsGame.length; i++) {
                if (version < 2) {
                    dataGame.wordsGame[i].audio = '';
                }
            }

            const $imagesLink = $('.rosco-LinkImages', wrapper),
                $audiosLink = $('.rosco-LinkAudios', wrapper);

            $imagesLink.each(function (index) {
                dataGame.wordsGame[index].url = $(this).attr('href');
                if (dataGame.wordsGame[index].url.length < 4) {
                    dataGame.wordsGame[index].url = '';
                }
            });

            $audiosLink.each(function (index) {
                dataGame.wordsGame[index].audio = $(this).attr('href');
                if (dataGame.wordsGame[index].audio.length < 4) {
                    dataGame.wordsGame[index].audio = '';
                }
            });

            $exeDevice.updateFieldGame(dataGame);

            let instructions = $('.rosco-instructions', wrapper);
            if (instructions.length === 1) {
                instructions = instructions.html() || '';
                $('#eXeGameInstructions').val(instructions);
            }

            let textAfter = $('.rosco-extra-content', wrapper);
            if (textAfter.length == 1) {
                textAfter = textAfter.html() || '';
                $('#eXeIdeviceTextAfter').val(textAfter);
            }

            $exeDevicesEdition.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs
            );
        }
    },

    clickImage: function (img, epx, epy) {
        const $cursor = $(img).siblings('.roscoCursorEdition'),
            $x = $(img)
                .parent()
                .siblings('.roscoBarEdition')
                .find('.roscoXImageEdition'),
            $y = $(img)
                .parent()
                .siblings('.roscoBarEdition')
                .find('.roscoYImageEdition'),
            imgOffset = $(img).offset(),
            imgPosition = $(img).position();

        if (epx === 0 && epy === 0) {
            $x.val(0);
            $y.val(0);
            $cursor.hide();
            return;
        }

        const posX = epx - imgOffset.left,
            posY = epy - imgOffset.top,
            wI = $(img).width() > 0 ? $(img).width() : 1,
            hI = $(img).height() > 0 ? $(img).height() : 1,
            lI = imgPosition.left,
            tI = imgPosition.top;

        $x.val(posX / wI);
        $y.val(posY / hI);

        $cursor
            .css({
                left: posX + lI,
                top: posY + tI,
                'z-index': 3000,
            })
            .show();
    },

    paintMouse: function (image, cursor, x, y) {
        $(cursor).hide();
        if (x > 0 || y > 0) {
            const wI = $(image).width() > 0 ? $(image).width() : 1,
                hI = $(image).height() > 0 ? $(image).height() : 1,
                imgPosition = $(image).position(),
                lI = imgPosition.left + wI * x,
                tI = imgPosition.top + hI * y;

            $(cursor)
                .css({
                    left: lI + 'px',
                    top: tI + 'px',
                    'z-index': 3000,
                })
                .show();
        }
    },

    placeImageWindows: function (image, naturalWidth, naturalHeight) {
        const $parent = $(image).parent(),
            wDiv = $parent.width() > 0 ? $parent.width() : 1,
            hDiv = $parent.height() > 0 ? $parent.height() : 1,
            varW = naturalWidth / wDiv,
            varH = naturalHeight / hDiv;

        let wImage = wDiv,
            hImage = hDiv,
            xImagen = 0,
            yImagen = 0;

        if (varW > varH) {
            wImage = Math.floor(wDiv);
            hImage = Math.floor(naturalHeight / varW);
            yImagen = Math.floor((hDiv - hImage) / 2);
        } else {
            wImage = Math.floor(naturalWidth / varH);
            hImage = Math.floor(hDiv);
            xImagen = Math.floor((wDiv - wImage) / 2);
        }

        return {
            w: wImage,
            h: hImage,
            x: xImagen,
            y: yImagen,
        };
    },

    showImage: function (image, url, x, y, alt, type) {
        const $cursor = image.siblings('.roscoCursorEdition'),
            $noImage = image.siblings('.roscoNoImageEdition'),
            $iconSelection = image
                .parents('.roscoWordMutimediaEdition')
                .find('.roscoSelectImageEdition');

        $iconSelection.attr(
            'src',
            $exeDevice.idevicePath + 'roscoSelectImageInactive.png'
        );
        image.attr('alt', '');

        if ($.trim(url).length === 0) {
            $cursor.hide();
            image.hide();
            $noImage.show();
            if (type === 1) {
                eXe.app.alert($exeDevice.msgs.msgURLValid);
            }
            return false;
        }

        url = $exeDevices.iDevice.gamification.media.extractURLGD(url);

        image
            .prop('src', url)
            .on('load', function () {
                if (
                    !this.complete ||
                    typeof this.naturalWidth === 'undefined' ||
                    this.naturalWidth === 0
                ) {
                    $cursor.hide();
                    image.hide();
                    $noImage.show();
                    if (type === 1) {
                        eXe.app.alert($exeDevice.msgs.msgURLValid);
                    }
                    return false;
                } else {
                    const mData = $exeDevice.placeImageWindows(
                        this,
                        this.naturalWidth,
                        this.naturalHeight
                    );
                    $exeDevice.drawImage(this, mData);
                    image.attr('alt', alt).show();
                    $cursor.show();
                    $noImage.hide();
                    $exeDevice.paintMouse(this, $cursor, x, y);
                    $iconSelection.attr(
                        'src',
                        $exeDevice.idevicePath + 'roscoSelectImage.png'
                    );
                    return true;
                }
            })
            .on('error', function () {
                $cursor.hide();
                image.hide();
                $noImage.show();
                if (type === 1) {
                    eXe.app.alert($exeDevice.msgs.msgURLValid);
                }
                return false;
            });
    },

    drawImage: function (image, mData) {
        $(image).css({
            left: `${mData.x}px`,
            top: `${mData.y}px`,
            width: `${mData.w}px`,
            height: `${mData.h}px`,
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
        const dataGame = this.validateData();
        if (!dataGame) return false;

        let i18n = this.ci18n;

        for (const i in i18n) {
            if (Object.hasOwnProperty.call(i18n, i)) {
                const fVal = $('#ci18n_' + i).val();
                if (fVal !== '') i18n[i] = fVal;
            }
        }

        dataGame.msgs = i18n;

        let json = JSON.stringify(dataGame);

        json = $exeDevices.iDevice.gamification.helpers.encrypt(json);

        let divContent = '';
        if (dataGame.instructions !== '') {
            divContent =
                '<div class="rosco-instructions">' +
                dataGame.instructions +
                '</div>';
        }

        const linksImages = $exeDevice.createlinksImage(dataGame.wordsGame),
            linksAudios = $exeDevice.createlinksAudio(dataGame.wordsGame),
            textAfter = tinymce.editors[1].getContent();

        let html = '<div class="rosco-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html +=
            '<div class="rosco-version js-hidden">' +
            $exeDevice.roscoVersion +
            '</div>';
        html += divContent;
        html += '<div class="rosco-DataGame js-hidden">' + json + '</div>';

        html += linksImages;
        html += linksAudios;

        if (textAfter !== '') {
            html += '<div class="rosco-extra-content">' + textAfter + '</div>';
        }

        html +=
            '<div class="rosco-bns js-hidden">' +
            $exeDevice.msgs.msgNoSuportBrowser +
            '</div>';
        html += '</div>';

        return html;
    },

    validateAlt: function () {
        $exeDevice.accesibilityIsOk = true;

        const clear = $exeDevice.removeTags;
        let words = [],
            alts = [],
            urls = [];

        $('.roscoWordEdition').each(function () {
            const word = clear($(this).val().trim());
            words.push(word);
        });

        $('.roscoAlt').each(function () {
            const alt = clear($(this).val());
            alts.push(alt);
        });

        $('.roscoURLImageEdition').each(function () {
            urls.push($(this).val());
        });

        if (!$exeDevice.checkAltImage) {
            return true;
        }

        $exeDevice.stopSound();

        words.every((word, index) => {
            if (word !== '' && urls[index] !== '' && alts[index] === '') {
                $exeDevice.accesibilityIsOk = false;
                eXe.app.confirm(
                    $exeDevice.msgs.msgTitleAltImageWarning,
                    $exeDevice.msgs.msgAltImageWarning,
                    function () {
                        $exeDevice.checkAltImage = false;
                        document
                            .getElementsByClassName('button-save-idevice')[0]
                            .click();
                    }
                );
                return false;
            }
            return true;
        });

        return $exeDevice.accesibilityIsOk;
    },

    createlinksImage: function (wordsGame) {
        let html = '';
        wordsGame.forEach((word, i) => {
            const url = word.url || '';
            const linkImage =
                url.length > 0
                    ? `<a href="${url}" class="js-hidden rosco-LinkImages">${i}</a>`
                    : `<a href="#" class="js-hidden rosco-LinkImages">${i}</a>`;
            html += linkImage;
        });
        return html;
    },

    createlinksAudio: function (wordsGame) {
        let html = '';
        wordsGame.forEach((word, i) => {
            const audio = word.audio || '';
            const linkAudio =
                audio.length > 0
                    ? `<a href="${audio}" class="js-hidden rosco-LinkAudios">${i}</a>`
                    : `<a href="#" class="js-hidden rosco-LinkAudios">${i}</a>`;
            html += linkAudio;
        });
        return html;
    },

    removeTags: function (str) {
        return $('<div></div>').html(str).text();
    },

    startContains: function (letter, word, type) {
        let start = false;
        const vocalLetter = 'AEIOU',
            mWord = $.trim(word.toUpperCase()),
            mletter = $exeDevice.getRealLetter(letter),
            slicedWord =
                type === 0 ? mWord.slice(0, mletter.length) : mWord.substr(1);

        if (vocalLetter.indexOf(letter) !== -1) {
            const vowelMap = {
                A: /[AÁÀÂÄ]/,
                E: /[EÉÈÊË]/,
                I: /[IÍÌÎÏ]/,
                O: /[OÓÒÔÖ]/,
                U: /[UÚÙÛÜ]/,
            };
            start = vowelMap[letter]?.test(slicedWord) || false;
        } else {
            start = slicedWord.indexOf(mletter) !== -1;
        }

        return start;
    },

    startContainsAll: function (letter, word, type) {
        const words = word.split('|');
        return words.every((sWord) =>
            this.startContains(letter, $.trim(sWord).toUpperCase(), type)
        );
    },

    getDataWord: function (letter) {
        let mLetter = $exeDevice.getRealLetter(letter),
            path = $exeDevice.idevicePath,
            fileWord = `
                <div class="roscoWordMutimediaEdition">
                    <div class="roscoFileWordEdition row g-2 align-items-center">
                        <div class="col-auto">
                            <h3 class="roscoLetterEdition mb-0">${mLetter}</h3>
                        </div>
                        <div class="col-auto">
                            <a href="#" class="roscoLinkStart" title="${_('Click here to toggle between Word starts with... and Word contains...')}"><img src="${path}roscoStart.png" alt="${_('The word starts with...')}" class="roscoStartEdition"/></a>
                        </div>
                        <div class="col-3">
                            <label class="form-label sr-av">${_('Word')}: </label>
                            <input type="text" class="form-control roscoWordEdition" placeholder="${_('Word')}">
                        </div>
                        <div class="col-7">
                            <label class="form-label sr-av">${_('Definition')}: </label>
                            <input type="text" class="form-control roscoDefinitionEdition" placeholder="${_('Definition')}">
                        </div>
                        <div class="col-auto">
                            <a href="#" class="roscoLinkSelectImage" title="${_('Show/Hide image')}"><img src="${path}roscoSelectImageInactive.png" alt="${_('Select Image')}" class="roscoSelectImageEdition"/></a>
                        </div>
                    </div>
                    <div class="roscoImageBarEdition">
                        <div class="roscoImageEdition">
                            <img src="${path}quextIECursor.gif" class="roscoCursorEdition" alt="" /> 
                            <img src="" class="roscoHomeImageEdition" alt="${_('No image')}" /> 
                            <img src="${path}roscoHomeImage.png" class="roscoNoImageEdition" alt="${_('No image')}" /> 
                        </div>
                        <div class="roscoBarEdition row g-2 align-items-center">
                            <div class="col-12 roscoImageInputWrapper">
                                <label class="form-label mb-0">${_('Image')}: </label>
                                <input type="text" class="form-control exe-file-picker roscoURLImageEdition me-0" id="roscoURLImage-${letter}" placeholder="${_('Indicate a valid URL of an image or select one from your device')}"/>
                            </div>
                            <div class="col-auto d-none">
                                <label class="form-label sr-av">X: </label><input type="text" class="roscoXImageEdition" value="0" readonly />
                            </div>
                            <div class="col-auto d-none">
                                <label class="form-label sr-av">Y: </label><input type="text" class="roscoYImageEdition" value="0" readonly />
                            </div>
                        </div>
                        <div class="roscoMetaData row g-2 align-items-center ">
                            <div class="roscoMetaItem col-12 d-flex align-items-center">
                                <label for="roscoAlt${letter}" class="form-label mb-0">Alt:</label>
                                <input type="text" id="roscoAlt${letter}" class="form-control roscoAlt flex-fill" />
                            </div>
                            <div class="roscoMetaItem col-12 d-flex align-items-center">
                                <label for="roscoAuthorEdition${letter}" class="form-label mb-0">${_('Authorship')}:</label>
                                <input type="text" id="roscoAuthorEdition${letter}" class="form-control roscoAuthorEdition flex-fill" />
                            </div>
                        </div>
                        <div class="roscoAudioDiv row g-2 align-items-center">
                            <div class="col-12 roscoAudioInputWrapper">
                                <label for="roscoEURLAudio${letter}" class="form-label mb-0">${_('Audio')}:</label>
                                <input type="text" class="form-control exe-file-picker roscoURLAudioEdition me-0" id="roscoEURLAudio${letter}" placeholder="${_('Indicate a valid URL of an audio or select one from your device')}"/>
                                <a href="#" class="roscoPlayAudio" title="${_('Play audio')}" id="roscoPlayAudio${letter}"><img src="${path}quextIEPlay.png" alt="${_('Play audio')}" class="roscoIconoPlayAudio"/></a>
                                <a href="#" class="roscoLinkClose" title="${_('Hide image')}"><img src="${path}roscoClose.png" alt="${_('Minimize')}" class="roscoCloseImage"/></a>
                            </div>
                        </div>
                        <hr class="roscoSeparation"/>
                    </div>
                </div>`;

        return fileWord;
    },

    getWords: function () {
        $('.roscoWordMutimediaEdition').remove();
        let rows = [];
        for (let i = 0; i < this.letters.length; i++) {
            let letter = this.letters.charAt(i),
                wordData = this.getDataWord(letter);
            rows.push(wordData);
        }
        return rows;
    },

    getIdeviceID: function () {
        const ideviceid =
            $('#roscoIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';

        return ideviceid;
    },

    validateData: function () {
        const clear = $exeDevice.removeTags,
            msgs = $exeDevice.msgs,
            instructions = tinymce.editors[0].getContent(),
            textAfter = tinymce.editors[1].getContent(),
            showMinimize = $('#roscoShowMinimize').is(':checked'),
            showSolution = $('#roscoShowSolution').is(':checked'),
            modeBoard = $('#roscoModeBoard').is(':checked'),
            timeShowSolution =
                parseInt(clear($.trim($('#roscoTimeShowSolution').val()))) || 0,
            durationGame = parseInt(clear($('#roscoDuration').val())) || 0,
            numberTurns = parseInt(clear($('#roscoNumberTurns').val())) || 0,
            itinerary =
                $exeDevicesEdition.iDevice.gamification.itinerary.getValues(),
            caseSensitive = $('#roscoCaseSensitive').is(':checked'),
            evaluation = $('#roscoEEvaluation').is(':checked'),
            evaluationID = $('#roscoEEvaluationID').val(),
            id = $exeDevice.getIdeviceID();

        if (!itinerary) return false;

        if (showSolution && timeShowSolution === 0) {
            eXe.app.alert(msgs.msgProvideTimeSolution);
            return false;
        }

        let words = [],
            zr = true;

        $('.roscoWordEdition').each(function () {
            const word = clear($(this).val().trim());
            words.push(word);
            if (word.length > 0) zr = false;
        });

        if (zr) {
            eXe.app.alert(msgs.msgOneWord);
            return false;
        }

        if (evaluation && evaluationID.length < 5) {
            eXe.app.alert(msgs.msgIDLenght);
            return false;
        }

        const definitions = $('.roscoDefinitionEdition')
            .map(function () {
                return clear($(this).val());
            })
            .get();

        const authors = $('.roscoAuthorEdition')
            .map(function () {
                return clear($(this).val());
            })
            .get();

        const alts = $('.roscoAlt')
            .map(function () {
                return clear($(this).val());
            })
            .get();

        const urls = $('.roscoURLImageEdition')
            .map(function () {
                return $(this).val();
            })
            .get();

        const audios = $('.roscoURLAudioEdition')
            .map(function () {
                return $(this).val();
            })
            .get();

        const xs = $('.roscoXImageEdition')
            .map(function () {
                return $(this).val() || 0;
            })
            .get();

        const ys = $('.roscoYImageEdition')
            .map(function () {
                return $(this).val() || 0;
            })
            .get();

        const types = $('.roscoStartEdition')
            .map(function () {
                const src = $(this).attr('src');
                return src.includes('roscoContains') ? 1 : 0;
            })
            .get();

        const wordsGame = [];
        for (let i = 0; i < this.letters.length; i++) {
            const letter = this.letters.charAt(i),
                mletter = $exeDevice.getRealLetter(letter),
                word = $.trim(words[i]),
                definition = $.trim(definitions[i]),
                url = $.trim(urls[i]),
                mType = types[i];

            if (word.length > 0) {
                if (
                    !modeBoard &&
                    mType === 0 &&
                    !this.startContainsAll(letter, word, mType)
                ) {
                    const message = _('%1 does not start with letter %2')
                        .replace('%1', word)
                        .replace('%2', mletter);
                    eXe.app.alert(message);
                    return false;
                } else if (
                    !modeBoard &&
                    mType === 1 &&
                    !this.startContainsAll(letter, word, mType)
                ) {
                    const message = msgs.msgNotContain
                        .replace('%1', word)
                        .replace('%2', mletter);
                    eXe.app.alert(message);
                    return false;
                } else if (definition.length === 0 && url.length < 10) {
                    eXe.app.alert(msgs.msgProvideDefinition + ' ' + word);
                    return false;
                }
            }

            wordsGame.push({
                letter: letter,
                word: word,
                definition: definition,
                type: mType,
                alt: alts[i] || '',
                author: authors[i] || '',
                url: url || '',
                audio: audios[i] || '',
                x: parseFloat(xs[i]) || 0,
                y: parseFloat(ys[i]) || 0,
            });
        }

        const scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();

        return {
            typeGame: 'Rosco',
            instructions: instructions,
            timeShowSolution: timeShowSolution,
            durationGame: durationGame,
            numberTurns: numberTurns,
            showSolution: showSolution,
            showMinimize: showMinimize,
            itinerary: itinerary,
            wordsGame: wordsGame,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted || 100,
            letters: this.letters,
            textAfter: escape(textAfter),
            caseSensitive: caseSensitive,
            version: 2,
            modeBoard: modeBoard,
            evaluation: evaluation,
            evaluationID: evaluationID,
            id: id,
        };
    },

    replaceLetters: function (letters) {
        return letters
            .toUpperCase()
            .replace(/[,\s]/g, '')
            .replace(/L·L/g, '0')
            .replace(/SS/g, '1');
    },

    getRealLetter: function (letter) {
        return letter === '0' ? 'L·L' : letter === '1' ? 'SS' : letter;
    },

    getCaracterLetter: function (letter) {
        return letter === 'L·L' ? '0' : letter === 'SS' ? '1' : letter;
    },

    importMoodle: function (xmlString) {
        const xmlDoc = $.parseXML(xmlString),
            $xml = $(xmlDoc);
        if ($xml.find('GLOSSARY').length > 0) {
            return $exeDevice.importGlosary(xmlString);
        } else if ($xml.find('quiz').length > 0) {
            return $exeDevice.importCuestionaryXML(xmlString);
        }
        return false;
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
                .trim();
            const $answers = $question.find('answer');
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
                words.push(
                    `${$exeDevice.removeTags(word)}#${$exeDevice.removeTags(questionText)}`
                );
            }
        });

        if (words.length > 0) {
            const swords = $exeDevice.getImportLetters(
                $exeDevice.letters,
                words
            );
            if (swords.length > 0) {
                $exeDevice.updateImportFields(swords);
                //$('.exe-form-tabs li:first-child a').click();
            } else {
                eXe.app.alert(_('Sorry, wrong file format'));
            }
        } else {
            eXe.app.alert(_('Sorry, wrong file format'));
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
                words.push(`${concept}#${definition}`);
            }
        });

        if (words.length > 0) {
            const swords = $exeDevice.getImportLetters(
                $exeDevice.letters,
                words
            );
            if (swords.length > 0) {
                $exeDevice.updateImportFields(swords);
                //$('.exe-form-tabs li:first-child a').click();
            } else {
                eXe.app.alert(_('Sorry, wrong file format'));
            }
        } else {
            eXe.app.alert(_('Sorry, wrong file format'));
        }
    },

    importGame: function (content, filetype) {
        const game =
            $exeDevices.iDevice.gamification.helpers.isJsonString(content);

        if (content && content.includes('\u0000')) {
            eXe.app.alert(_('Sorry, wrong file format'));
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
        } else if (!game || typeof game.typeGame === 'undefined') {
            eXe.app.alert($exeDevice.msgs.msgSelectFile);
            return;
        } else if (game.typeGame !== 'Rosco') {
            eXe.app.alert($exeDevice.msgs.msgSelectFile);
            return;
        }

        game.id = $exeDevice.getIdeviceID();
        $exeDevice.updateFieldGame(game);
        tinymce.editors[0].setContent(game.instructions);
        const tAfter = game.textAfter || '';
        tinymce.editors[1].setContent(unescape(tAfter));
        //$('.exe-form-tabs li:first-child a').click();
    },

    addEvents: function () {
        const msgs = $exeDevice.msgs;

        $('#roscoDataWord a.roscoLinkStart').on('click', function (e) {
            e.preventDefault();
            const imageStart = $(this)
                .find('.roscoStartEdition')
                .attr('src')
                .includes('roscoContains.png')
                ? 'roscoStart.png'
                : 'roscoContains.png';
            let alt = _('The word starts with...');
            if (imageStart === 'roscoContains.png')
                alt = _('The word contains...');
            $(this)
                .find('.roscoStartEdition')
                .attr('src', $exeDevice.idevicePath + imageStart)
                .attr('alt', alt);
        });

        $('#roscoDataWord input.roscoURLImageEdition').on(
            'change',
            function () {
                const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                    selectedFile = $(this).val(),
                    ext = selectedFile.split('.').pop().toLowerCase();
                if (
                    selectedFile.startsWith('files/') &&
                    !validExt.includes(ext)
                ) {
                    eXe.app.alert(
                        _('Supported formats') +
                            ': jpg, jpeg, gif, png, svg, webp'
                    );
                    return false;
                }
                const $imageBar = $(this).closest('.roscoImageBarEdition');
                const img = $imageBar.find('.roscoHomeImageEdition');
                const url = selectedFile;
                const alt = $imageBar.find('.roscoAlt').val();
                let x = parseFloat($imageBar.find('.roscoXImageEdition').val());
                let y = parseFloat($imageBar.find('.roscoYImageEdition').val());
                x = x || 0;
                y = y || 0;
                $exeDevice.showImage(img, url, x, y, alt, 1);

                // Sincroniza icono activo/inactivo
                const $container = $(this).closest(
                    '.roscoWordMutimediaEdition'
                );
                const hasImage = $.trim($(this).val() || '').length > 0;
                const hasAudio =
                    $.trim($container.find('.roscoURLAudioEdition').val() || '')
                        .length > 0;
                const icon =
                    hasImage || hasAudio
                        ? 'roscoSelectImage.png'
                        : 'roscoSelectImageInactive.png';
                $container
                    .find('.roscoSelectImageEdition')
                    .attr('src', $exeDevice.idevicePath + icon);
            }
        );

        $('#roscoDataWord input.roscoURLAudioEdition').on(
            'change',
            function () {
                const selectedFile = $(this).val();
                if (!selectedFile) {
                    eXe.app.alert(_('Supported formats') + ': mp3, ogg, wav');
                } else if (selectedFile.length > 4) {
                    $exeDevice.playSound(selectedFile);
                }

                // Sincroniza icono activo/inactivo
                const $container = $(this).closest(
                    '.roscoWordMutimediaEdition'
                );
                const hasImage =
                    $.trim($container.find('.roscoURLImageEdition').val() || '')
                        .length > 0;
                const hasAudio = $.trim($(this).val() || '').length > 0;
                const icon =
                    hasImage || hasAudio
                        ? 'roscoSelectImage.png'
                        : 'roscoSelectImageInactive.png';
                $container
                    .find('.roscoSelectImageEdition')
                    .attr('src', $exeDevice.idevicePath + icon);
            }
        );

        $('#roscoDataWord a.roscoPlayAudio').on('click', function (e) {
            e.preventDefault();
            const $audio = $(this)
                .parent()
                .find('.roscoURLAudioEdition')
                .first();
            const selectedFile = $audio.val();
            if (!selectedFile) {
                eXe.app.alert(_('Supported formats') + ": mp3', 'ogg', 'wav'");
            } else if (selectedFile.length > 4) {
                $exeDevice.playSound(selectedFile);
            }
        });

        // Uso de delegación para soportar elementos añadidos tras updateFieldGame
        // Handler con namespace para poder desregistrar fácilmente y evitar duplicados.
        $(document)
            .off('click.roscoSelectImg')
            .on(
                'click.roscoSelectImg',
                '#roscoDataWord a.roscoLinkSelectImage',
                function (e) {
                    e.preventDefault();
                    const $container = $(this).closest(
                        '.roscoWordMutimediaEdition'
                    );
                    const $panel = $container.children('.roscoImageBarEdition');
                    if (!$panel.length) return;

                    // Evita cola de animaciones si se hace clic repetidamente rápido.
                    $panel.stop(true, true).slideToggle(180);

                    const img = $panel.find('.roscoHomeImageEdition');
                    const url = $panel.find('.roscoURLImageEdition').val();
                    const alt = $panel.find('.roscoAlt').val();
                    let y =
                        parseFloat($panel.find('.roscoYImageEdition').val()) ||
                        0;
                    let x =
                        parseFloat($panel.find('.roscoXImageEdition').val()) ||
                        0;

                    $exeDevice.stopSound();
                    $exeDevice.showImage(img, url, x, y, alt, 0);

                    // Sincroniza icono activo/inactivo también aquí
                    const hasImage =
                        $.trim($panel.find('.roscoURLImageEdition').val() || '')
                            .length > 0;
                    const hasAudio =
                        $.trim($panel.find('.roscoURLAudioEdition').val() || '')
                            .length > 0;
                    const icon =
                        hasImage || hasAudio
                            ? 'roscoSelectImage.png'
                            : 'roscoSelectImageInactive.png';
                    $container
                        .find('.roscoSelectImageEdition')
                        .attr('src', $exeDevice.idevicePath + icon);

                    if (!hasImage) {
                        const $cursor = $panel.find('.roscoCursorEdition');
                        const $noImage = $panel.find('.roscoNoImageEdition');
                        img.hide();
                        $cursor.hide();
                        $noImage.show();
                    }
                }
            );

        $('#roscoDataWord a.roscoLinkClose').on('click', function (e) {
            e.preventDefault();
            $exeDevice.stopSound();
            const $container = $(this).closest('.roscoWordMutimediaEdition');
            const hasImage =
                $.trim($container.find('.roscoURLImageEdition').val() || '')
                    .length > 0;
            const hasAudio =
                $.trim($container.find('.roscoURLAudioEdition').val() || '')
                    .length > 0;
            const icon =
                hasImage || hasAudio
                    ? 'roscoSelectImage.png'
                    : 'roscoSelectImageInactive.png';
            $container
                .find('.roscoSelectImageEdition')
                .attr('src', $exeDevice.idevicePath + icon);
            $container.find('.roscoImageBarEdition').slideUp();
        });

        $(document).on(
            'focusout',
            '#roscoDataWord .roscoWordEdition',
            function () {
                const $input = $(this);
                const word = $input.val().trim();
                const $row = $input.closest('.roscoFileWordEdition');
                const $letterEl = $row.find('h3.roscoLetterEdition').first();
                const letter = $letterEl.text();
                const color = word
                    ? $exeDevice.colors.blue
                    : $exeDevice.colors.grey;
                const mletter = $exeDevice.getCaracterLetter(letter);

                $letterEl.css('background-color', color);

                if (!word.length) return;

                const $startIcon = $row.find('.roscoStartEdition').first();
                const mType =
                    $startIcon.attr('src') &&
                    $startIcon.attr('src').includes('roscoContains.png')
                        ? 1
                        : 0;

                if ($exeDevice.modeBoard) return;

                if (
                    mType === 0 &&
                    !$exeDevice.startContainsAll(mletter, word, mType)
                ) {
                    const message = msgs.msgNotStart
                        .replace('%1', word)
                        .replace('%2', letter);
                    eXe.app.alert(message);
                } else if (
                    mType === 1 &&
                    !$exeDevice.startContainsAll(mletter, word, mType)
                ) {
                    const message = msgs.msgNotContain
                        .replace('%1', word)
                        .replace('%2', letter);
                    eXe.app.alert(message);
                }
            }
        );

        $('#roscoShowSolution').on('change', function () {
            const mark = $(this).is(':checked');
            $('#roscoTimeShowSolution').prop('disabled', !mark);
        });

        $('#roscoModeBoard').on('change', function () {
            $exeDevice.modeBoard = $(this).is(':checked');
        });

        // Delegación para soportar imágenes añadidas dinámicamente y evitar bindings duplicados
        $(document)
            .off('click.roscoImg')
            .on(
                'click.roscoImg',
                '#roscoDataWord img.roscoHomeImageEdition',
                function (e) {
                    $exeDevice.clickImage(this, e.pageX, e.pageY);
                }
            );

        $('.roscoWordMutimediaEdition').on(
            'dblclick',
            'img.roscoHomeImageEdition',
            function () {
                $exeDevice.clickImage(this, 0, 0);
            }
        );

        $('.roscoWordMutimediaEdition').on(
            'click',
            '.roscoCursorEdition',
            function () {
                const $x = $(this)
                    .parent()
                    .siblings('.roscoBarEdition')
                    .find('.roscoXImageEdition');
                const $y = $(this)
                    .parent()
                    .siblings('.roscoBarEdition')
                    .find('.roscoYImageEdition');
                $x.val(0);
                $y.val(0);
                $(this).hide();
            }
        );

        const sanitizeInput = function (input) {
            let v = input.value.replace(/\D/g, '').substring(0, 4);
            input.value = v;
        };

        $('#roscoDuration').on('keyup', function () {
            sanitizeInput(this);
        });

        $('#roscoNumberTurns').on('keyup', function () {
            sanitizeInput(this);
        });

        $('#roscoTimeShowSolution').on('keyup', function () {
            sanitizeInput(this);
        });

        $('#roscoNumberTurns').on('focusout', function () {
            this.value =
                this.value.trim() === ''
                    ? 1
                    : Math.min(Math.max(this.value, 0), 2);
        });

        $('#roscoDuration').on('focusout', function () {
            this.value = this.value.trim() === '' ? 240 : this.value;
        });

        $('#roscoTimeShowSolution').on('focusout', function () {
            this.value =
                this.value.trim() === ''
                    ? 3
                    : Math.min(Math.max(this.value, 1), 9);
        });

        if (
            window.File &&
            window.FileReader &&
            window.FileList &&
            window.Blob
        ) {
            $('#eXeGameExportImport .exe-field-instructions')
                .eq(0)
                .text(_('Supported formats') + ': txt, xml(Moodle)');
            $('#eXeGameExportImport').show();
            $('#eXeGameImportGame').attr('accept', '.txt, .xml');
            $('#eXeGameImportGame').on('change', function (e) {
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
                reader.onload = function (e) {
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

        $('#roscoEEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#roscoEEvaluationID').prop('disabled', !marcado);
        });

        $('#roscoEEvaluationHelpLnk').click(function () {
            $('#roscoEEvaluationHelp').toggle();
            return false;
        });

        $(document).on('click', '.toggle-item', function (e) {
            if ($(e.target).is('input, label, a, button')) return;
            const id = $(this).attr('idevice-id');
            if (!id) return;
            const $input = $('#' + id);
            if ($input.length) {
                $input
                    .prop('checked', !$input.is(':checked'))
                    .trigger('change');
            }
        });

        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();
        $exeDevicesEdition.iDevice.gamification.share.addEvents(
            1,
            $exeDevice.insertWords
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
        link.download = `${_('A-Z quiz')}.txt`;

        document.getElementById('roscoIdeviceForm').appendChild(link);
        link.click();
        setTimeout(() => {
            document.getElementById('roscoIdeviceForm').removeChild(link);
            window.URL.revokeObjectURL(data);
        }, 100);
    },

    getLinesQuestions: function (words) {
        let lineswords = [];
        for (let i = 0; i < words.length; i++) {
            if (words[i].word && words[i].definition) {
                let word = `${words[i].word}#${words[i].definition}`;
                lineswords.push(word);
            }
        }
        return lineswords;
    },

    rearrangeAlphabet: function (alphabet) {
        const vowels = 'AEIOU';
        let consonants = alphabet
            .split('')
            .filter((letter) => !vowels.includes(letter));
        const indexN = consonants.indexOf('Ñ'),
            nTilde = indexN !== -1 ? consonants.splice(indexN, 1) : '';
        return nTilde + consonants.join('') + vowels;
    },

    normaliceLetter: function (letter) {
        const normalizeleter = letter
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase();
        return letter.toUpperCase() === 'Ñ' ? 'Ñ' : normalizeleter;
    },

    normaliceWord: function (word) {
        const normalized = word
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase();
        if (word.trim().length === 1) {
            return word.toUpperCase() === 'Ñ' ? 'Ñ' : normalized;
        }
        return word.includes('Ñ') ? normalized + 'Ñ' : normalized;
    },

    getImportLetters: function (alphabet_letters, stringArray) {
        let usedWords = new Set(),
            result_letters = [],
            abcs = $exeDevice.rearrangeAlphabet(alphabet_letters);

        stringArray.forEach((stringItem) => {
            let [sword, sdefinition, sstatus = '-1', sletter = ''] =
                stringItem.split('#');

            if (usedWords.has(sword) || !sdefinition || sstatus === '-1')
                return;

            if (sstatus === '0') {
                sletter = $exeDevice.normaliceLetter(sword[0]).toUpperCase();
                if (abcs.includes(sletter)) {
                    result_letters.push(`${sletter}#0#${sword}#${sdefinition}`);
                    usedWords.add(sword);
                    abcs = abcs.replace(sletter, '');
                }
            } else if (sstatus === '1' && stringItem.split('#').length === 4) {
                sletter = $exeDevice.normaliceLetter(sletter).toUpperCase();
                if (
                    abcs.includes(sletter) &&
                    sword.slice(1).toUpperCase().includes(sletter)
                ) {
                    result_letters.push(`${sletter}#1#${sword}#${sdefinition}`);
                    usedWords.add(sword);
                    abcs = abcs.replace(sletter, '');
                }
            } else if (sstatus === '1') {
                for (let i = 1; i < sword.length; i++) {
                    sletter = $exeDevice
                        .normaliceLetter(sword[i])
                        .toUpperCase();
                    if (abcs.includes(sletter)) {
                        result_letters.push(
                            `${sletter}#1#${sword}#${sdefinition}`
                        );
                        usedWords.add(sword);
                        abcs = abcs.replace(sletter, '');
                        break;
                    }
                }
            }
        });

        if (abcs.trim().length === 0) return result_letters.sort();

        abcs.split('').forEach((sletter) => {
            let swordFind = stringArray.find((cadena) => {
                let [sword] = cadena.split('#');
                let nomaliceleter = $exeDevice
                    .normaliceLetter(sword[0])
                    .toUpperCase();
                return nomaliceleter === sletter && !usedWords.has(sword);
            });
            if (swordFind) {
                let [sword, sdefinition] = swordFind.split('#');
                result_letters.push(`${sletter}#0#${sword}#${sdefinition}`);
                abcs = abcs.replace(sletter, '');
                usedWords.add(sword);
            }
        });

        if (abcs.trim().length === 0) return result_letters.sort();

        abcs.split('').forEach((sletter) => {
            let swordFind = stringArray.find((cadena) => {
                let [sword] = cadena.split('#');
                return (
                    sword.length > 1 &&
                    $exeDevice
                        .normaliceWord(sword.slice(1))
                        .includes(sletter) &&
                    !usedWords.has(sword)
                );
            });
            if (swordFind) {
                let [sword, sdefinition] = swordFind.split('#');
                result_letters.push(`${sletter}#1#${sword}#${sdefinition}`);
                usedWords.add(sword);
            }
        });

        return result_letters.sort();
    },

    importText: function (content) {
        const lines = content.split('\n'),
            lineFormat = /^([^#]+)#([^#]+)(#(0|1)(#[A-Za-zÑñ])?)?$/,
            words = lines.filter((line) => lineFormat.test(line.trim()));

        if (words.length > 0) {
            const swords = $exeDevice.getImportLetters(
                $exeDevice.letters,
                words
            );
            if (swords.length > 0) {
                $exeDevice.updateImportFields(swords);
                //$('.exe-form-tabs li:first-child a').click();
            } else {
                eXe.app.alert(_('Sorry, wrong file format'));
            }
        } else {
            eXe.app.alert(_('Sorry, wrong file format'));
        }
    },

    updateImportFields: function (wordsArray) {
        const resetFields = () => {
            $(
                '.roscoDefinitionEdition, .roscoWordEdition, .roscoURLAudioEdition, .roscoURLImageEdition'
            ).val('');
            $('.roscoXImageEdition, .roscoYImageEdition').val('0');
            $('.roscoStartEdition')
                .attr('src', $exeDevice.idevicePath + 'roscoStart.png')
                .attr('alt', _('The word starts with...'));
            $('.roscoLetterEdition').css(
                'background-color',
                $exeDevice.colors.grey
            );
        };

        resetFields();

        $('.roscoWordMutimediaEdition').each(function () {
            const $this = $(this),
                letter = $this
                    .find('.roscoLetterEdition')
                    .eq(0)
                    .text()
                    .toUpperCase(),
                wordData = wordsArray.find(
                    (word) => word.split('#')[0].toUpperCase() === letter
                );

            if (wordData) {
                const [, wordType, word, definition] = wordData.split('#');
                $this.find('.roscoDefinitionEdition').eq(0).val(definition);
                $this.find('.roscoWordEdition').eq(0).val(word);
                $this
                    .find('h3.roscoLetterEdition')
                    .eq(0)
                    .css('background-color', $exeDevice.colors.blue);

                if (wordType === '1') {
                    $this
                        .find('.roscoStartEdition')
                        .attr(
                            'src',
                            $exeDevice.idevicePath + 'roscoContains.png'
                        )
                        .attr('alt', _('The word contains...'));
                }
            }
        });
    },

    playSound: function (selectedFile) {
        $exeDevice.stopSound();
        const selectFile =
            $exeDevices.iDevice.gamification.media.extractURLGD(selectedFile);

        $exeDevice.playerAudio = new Audio(selectFile);
        $exeDevice.playerAudio.addEventListener('canplaythrough', () => {
            $exeDevice.playerAudio
                .play()
                .catch((err) => console.error('Error playing sound:', err));
        });
    },

    stopSound: function () {
        if (
            $exeDevice.playerAudio &&
            typeof $exeDevice.playerAudio.pause === 'function'
        ) {
            $exeDevice.playerAudio.pause();
            $exeDevice.playerAudio.currentTime = 0;
        }
    },
    exportGame: function () {
        const dataGame = this.validateData();
        if (!dataGame) return false;

        const blob = new Blob([JSON.stringify(dataGame)], {
            type: 'text/plain',
        });
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveOrOpenBlob(blob);
            return;
        }

        const data = window.URL.createObjectURL(blob),
            link = document.createElement('a');
        link.href = data;
        link.download = _('Activity') + '-Rosco.json';
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
            link.remove();
            window.URL.revokeObjectURL(data);
        }, 100);
    },
};
