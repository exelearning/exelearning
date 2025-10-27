/* eslint-disable no-undef */
/**
 * Clasifica activity (Export)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 *
 */
var $eXeClasifica = {
    idevicePath: '',
    borderColors: {
        black: '#1c1b1b',
        blue: '#3334a1',
        green: '#006641',
        red: '#a2241a',
        white: '#ffffff',
        yellow: '#f3d55a',
    },
    colors: {
        black: '#1c1b1b',
        blue: '#3334a1',
        green: '#006641',
        red: '#a2241a',
        white: '#ffffff',
        yellow: '#fcf4d3',
    },
    options: [],
    hasSCORMbutton: false,
    isInExe: false,
    userName: '',
    previousScore: '',
    initialScore: '',
    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',
    mScorm: null,
    jqueryui: 1,

    init: function () {
        $exeDevices.iDevice.gamification.initGame(this, 'Classify', 'classify', 'clasifica-IDevice');
    },
    enable: function () {
        $eXeClasifica.loadGame();
    },

    loadGame: function () {
        $eXeClasifica.options = [];

        $eXeClasifica.activities.each(function (i) {
            const dl = $('.clasifica-DataGame', this),
                $imagesLink = $('.clasifica-LinkImages', this),
                $audiosLink = $('.clasifica-LinkAudios', this),
                $imageBack = $('.clasifica-ImageBack', this),
                mOption = $eXeClasifica.loadDataGame(
                    dl,
                    $imagesLink,
                    $audiosLink,
                ),
                msg = mOption.msgs.msgPlayStart;

            mOption.imgCard = '';
            if ($imageBack.length == 1) {
                mOption.imgCard = $imageBack.attr('href') || '';
            }

            mOption.scorerp = 0;
            mOption.idevicePath = $eXeClasifica.idevicePath;
            mOption.main = 'clasificaMainContainer-' + i;
            mOption.idevice = 'clasifica-IDevice';

            $eXeClasifica.options.push(mOption);

            const clasifica = $eXeClasifica.createInterfaceClasifica(i);
            dl.before(clasifica).remove();

            $('#clasificaGameMinimize-' + i)
                .css('cursor', 'pointer')
                .show()
            $('#clasificaGameContainer-' + i).show();
            $('#clasificaMessageMaximize-' + i).text(msg);
            $('#clasificaDivFeedBack-' + i).prepend(
                $('.clasifica-feedback-game', this),
            );
            $eXeClasifica.addCards(i, mOption.cardsGame);
            if (mOption.showMinimize) {
                $('#clasificaGameContainer-' + i).hide();;
            } else {
                $('#clasificaGameMinimize-' + i).hide();
            }

            $eXeClasifica.addEvents(i);

            $('#clasificaDivFeedBack-' + i).hide();
            $('#clasificaMainContainer-' + i).show();
        });

        let node = document.querySelector('.page-content');
        if (this.isInExe) {
            node = document.getElementById('node-content');
        }
        if (node)
            $exeDevices.iDevice.gamification.observers.observeResize(
                $eXeClasifica,
                node,
            );

        $exeDevices.iDevice.gamification.math.updateLatex(
            '.clasifica-IDevice',
        );
    },

    loadDataGame: function (data, imgsLink, audioLink) {
        let json = $exeDevices.iDevice.gamification.helpers.decrypt(
            data.text(),
        );

        let mOptions =
            $exeDevices.iDevice.gamification.helpers.isJsonString(json);

        imgsLink.each(function () {
            const iq = parseInt($(this).text());
            if (!isNaN(iq) && iq < mOptions.wordsGame.length) {
                mOptions.wordsGame[iq].url = $(this).attr('href');
                if (
                    mOptions.wordsGame[iq].url.length < 4 &&
                    mOptions.wordsGame[iq].type == 0
                ) {
                    mOptions.wordsGame[iq].url = '';
                }
            }
        });

        audioLink.each(function () {
            const iq = parseInt($(this).text());
            if (!isNaN(iq) && iq < mOptions.wordsGame.length) {
                mOptions.wordsGame[iq].audio = $(this).attr('href');
                if (mOptions.wordsGame[iq].audio.length < 4) {
                    mOptions.wordsGame[iq].audio = '';
                }
            }
        });

        mOptions.playerAudio = '';
        mOptions.gameOver = false;
        mOptions.refreshCard = false;
        mOptions.evaluation =
            typeof mOptions.evaluation == 'undefined'
                ? false
                : mOptions.evaluation;
        mOptions.evaluationID =
            typeof mOptions.evaluationID == 'undefined'
                ? ''
                : mOptions.evaluationID;
        mOptions.id = typeof mOptions.id == 'undefined' ? false : mOptions.id;
        mOptions.wordsGame =
            $exeDevices.iDevice.gamification.helpers.getQuestions(
                mOptions.wordsGame,
                mOptions.percentajeQuestions,
            );
        mOptions.numberQuestions = mOptions.wordsGame.length;
        mOptions.wordsGameFix = [...mOptions.wordsGame];
        mOptions.cardsGame = mOptions.wordsGame;
        mOptions.fullscreen = false;
        mOptions.attempts = 0;

        return mOptions;
    },

    createInterfaceClasifica: function (instance) {
        const path = $eXeClasifica.idevicePath,
            mOptions = $eXeClasifica.options[instance],
            msgs = $eXeClasifica.options[instance].msgs,
            groups = $eXeClasifica.options[instance].groups,
            html = `
        <div class="CQP-MainContainer" id="clasificaMainContainer-${instance}">
            <div class="CQP-GameMinimize" id="clasificaGameMinimize-${instance}">
                <a href="#" class="CQP-LinkMaximize" id="clasificaLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                    <img src="${path}clasificaIcon.png" class="CQP-IconMinimize CQP-Activo" alt="">
                    <div class="CQP-MessageMaximize" id="clasificaMessageMaximize-${instance}"></div>
                </a>
            </div>
            <div class="CQP-GameContainer CQP-GameContainer-${instance}" id="clasificaGameContainer-${instance}">
                <div class="CQP-GameScoreBoard" id="clasificaGameScoreBoard-${instance}">
                    <div class="CQP-GameScores">
                        <div class="exeQuextIcons exeQuextIcons-Number" id="clasificaPNumberIcon-${instance}" title="${msgs.msgNumQuestions}"></div>
                        <p><span class="sr-av">${msgs.msgNumQuestions}: </span><span id="clasificaPNumber-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                        <p><span class="sr-av">${msgs.msgHits}: </span><span id="clasificaPHits-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Error" title="${msgs.msgErrors}"></div>
                        <p><span class="sr-av">${msgs.msgErrors}: </span><span id="clasificaPErrors-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Score" id="clasificaPScoreIcon-${instance}" title="${msgs.msgScore}"></div>
                        <p><span class="sr-av">${msgs.msgScore}: </span><span id="clasificaPScore-${instance}">0</span></p>
                    </div>
                    <div class="CQP-TimeNumber">
                        <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                        <div class="exeQuextIcons exeQuextIcons-Time" id="clasificaImgTime-${instance}" title="${msgs.msgTime}"></div>
                        <p id="clasificaPTime-${instance}" class="CQP-PTime">00:00</p>
                        <a href="#" class="CQP-LinkFullScreen" id="clasificaLinkReboot-${instance}" title="${msgs.msgReboot}">
                            <strong><span class="sr-av">${msgs.msgReboot}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-IconReboot CQP-Activo" id="clasificaReboot-${instance}"></div>
                        </a>
                        <a href="#" class="CQP-LinkMinimize" id="clasificaLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                            <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Minimize CQP-Activo"></div>
                        </a>
                        <a href="#" class="CQP-LinkFullScreen" id="clasificaLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                            <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-FullScreen CQP-Activo" id="clasificaFullScreen-${instance}"></div>
                        </a>
                    </div>
                </div>
                <div class="CQP-Message" id="clasificaMessage-${instance}"></div>
                <div class="CQP-Multimedia" id="clasificaMultimedia-${instance}">
                    <div class="CQP-StartGame">
                        <a href="#" id="clasificaStartGame-${instance}">${msgs.msgPlayStart}</a>
                        <a href="#" id="clasificaValidateAnswers-${instance}">${msgs.msgShowAnswers}</a>
                    </div>
                    <div id="clasificaSlide-${instance}" class="CQP-Slide"></div>
                    <div class="CQP-Container">
                        <div class="CQP-CC CQP-CP-${instance}">
                            <span id="clasificaTitle0-${instance}" class="CQP-Title noselect">${groups[0]}</span>
                            <div class="CQP-Container0 CQP-Line"></div>
                            <div class="CQP-CC-Fill CQP-CC-${instance}" data-group="0"></div>
                        </div>
                        <div class="CQP-CC CQP-CP-${instance}">
                            <span id="clasificaTitle1-${instance}" class="CQP-Title noselect">${groups[1]}</span>
                            <div class="CQP-Container1 CQP-Line"></div>
                            <div class="CQP-CC-Fill CQP-CC-${instance}" data-group="1"></div>
                        </div>
                        <div class="CQP-CC CQP-CP-${instance}">
                            <span id="clasificaTitle2-${instance}" class="CQP-Title noselect">${groups[2]}</span>
                            <div class="CQP-Container2 CQP-Line"></div>
                            <div class="CQP-CC-Fill CQP-CC-${instance}" data-group="2"></div>
                        </div>
                        <div class="CQP-CC CQP-CP-${instance}">
                            <span id="clasificaTitle3-${instance}" class="CQP-Title noselect">${groups[3]}</span>
                            <div class="CQP-Container3 CQP-Line"></div>
                            <div class="CQP-CC-Fill CQP-CC-${instance}" data-group="3"></div>
                        </div>
                    </div>
                </div>                
                <div class="CQP-DivFeedBack" id="clasificaDivFeedBack-${instance}">
                    <input type="button" id="clasificaFeedBackClose-${instance}" value="${msgs.msgClose}" class="feedbackbutton" />
                </div>
                <div class="CQP-AuthorGame" id="clasificaAuthorGame-${instance}"></div>
            </div>
            <div class="CQP-Cubierta" id="clasificaCubierta-${instance}">
                <div class="CQP-CodeAccessDiv" id="clasificaCodeAccessDiv-${instance}">
                    <div class="CQP-MessageCodeAccessE" id="clasificaMesajeAccesCodeE-${instance}"></div>
                    <div class="CQP-DataCodeAccessE">
                        <label class="sr-av">${msgs.msgCodeAccess}:</label>
                        <input type="text" class="CQP-CodeAccessE" id="clasificaCodeAccessE-${instance}" placeholder="${msgs.msgCodeAccess}">
                        <a href="#" id="clasificaCodeAccessButton-${instance}" title="${msgs.msgSubmit}">
                            <strong><span class="sr-av">${msgs.msgSubmit}</span></strong>
                            <div class="exeQuextIcons-Submit CQP-Activo"></div>
                        </a>
                    </div>
                </div>
                <div class="CQP-ShowClue" id="clasificaShowClue-${instance}">
                    <p class="sr-av">${msgs.msgClue}</p>
                    <p class="CQP-PShowClue" id="clasificaPShowClue-${instance}"></p>
                    <a href="#" class="CQP-ClueBotton" id="clasificaClueButton-${instance}" title="${msgs.msgContinue}">${msgs.msgContinue}</a>
                </div>
                <div class="CQP-RebootGame" id="clasificaRebootGame-${instance}">
                    <p>${msgs.msgRebootGame}</p>
                    <p class="CQP-RebootButtons">
                        <a href="#" class="CQP-ClueBotton" id="clasificaRebootYes-${instance}" title="${msgs.msgYes}">${msgs.msgYes}</a>
                        <a href="#" class="CQP-ClueBotton" id="clasificaRebootNo-${instance}" title="${msgs.msgNo}">${msgs.msgNo}</a>
                    </p>
                </div>
            </div>
        </div>
            ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}
        `;
        return html;
    },

    saveEvaluation: function (instance) {
        const mOptions = $eXeClasifica.options[instance],
            hits = mOptions.hits || 0,
            attempts = mOptions.attempts || 0,
            totalCards = mOptions.cardsGame.length || 1;

        let score = (hits * 10) / totalCards;
        if (mOptions.gameLevel === 0)
            score =
                ((hits * 10) / mOptions.numberQuestions) * (hits / attempts);

        mOptions.scorerp = score;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $eXeClasifica.isInExe,
        );
    },

    sendScore: function (auto, instance) {
        const mOptions = $eXeClasifica.options[instance],
            hits = mOptions.hits || 0,
            attempts = mOptions.attempts || 0,
            totalCards = mOptions.cardsGame.length || 1;

        let score = (hits * 10) / totalCards;
        if (mOptions.gameLevel === 0)
            score =
                ((hits * 10) / mOptions.numberQuestions) * (hits / attempts);

        mOptions.scorerp = score;

        mOptions.previousScore = $eXeClasifica.previousScore;
        mOptions.userName = $eXeClasifica.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $eXeClasifica.previousScore = mOptions.previousScore;
    },

    addCards: function (instance, cardsGame) {
        const mOptions = $eXeClasifica.options[instance];
        let cards = '';
        cardsGame =
            $exeDevices.iDevice.gamification.helpers.shuffleAds(cardsGame);

        $('#clasificaMainContainer-' + instance)
            .find('.CQP-CardContainer')
            .remove();
        cardsGame.forEach((cardData, i) => {
            cardData.answer = -1;
            cards += $eXeClasifica.createCard(
                i,
                cardData.type,
                cardData.url,
                cardData.eText,
                cardData.audio,
                cardData.x,
                cardData.y,
                cardData.alt,
                cardData.group,
                cardData.color,
                cardData.backcolor,
                instance,
            );
        });
        $('#clasificaSlide-' + instance).append(cards);

        if (mOptions.imgCard.length > 4) {
            $('#clasificaMainContainer-' + instance)
                .find('.CQP-CardContainer').each(function () {
                    $(this).find('.CQP-CardFront').css({
                        'background-image': 'url(' + mOptions.imgCard + ')',
                        'background-size': 'cover'
                    });
                });
        }


    },

    createCard: function (
        j,
        type,
        url,
        text,
        audio,
        x,
        y,
        alt,
        group,
        color,
        backcolor,
        instance,
    ) {
        const mOptions = $eXeClasifica.options[instance],
            malt = alt || '',
            fullimage =
                url.length > 3
                    ? `<a href="#" class="CQP-FullLinkImage" title="${mOptions.msgs.msgFullScreen}" aria-label="${mOptions.msgs.msgFullScreen}">
                        <div class="exeQuextIcons exeQuextIcons-FullImage CQP-Activo" aria-hidden="true"></div>
                        <span class="sr-av">${mOptions.msgs.msgFullScreen}</span>
                    </a>`
                    : '',
            saudio = `<a href="#" data-audio="${audio}" class="CQP-LinkAudio" title="${mOptions.msgs.msgAudio}">
                          <img src="${$eXeClasifica.idevicePath}exequextplayaudio.svg" class="CQP-Audio" alt="${mOptions.msgs.msgAudio}">
                        </a>`;
        return `
            <div class="CQP-CardContainer CQP-Drag-${instance} noselect" data-number="${j}" data-group="${group}" data-type="${type}" data-state="-1">
                <div class="CQP-Card noselect" data-type="${type}" data-state="-1" data-valid="0">
                    <div class="CQP-CardFront noselect"></div>
                    <div class="CQP-CardBack noselect">
                        <div class="CQP-ImageContain">
                            <img src="" class="CQP-Image noselect" data-url="${url}" data-x="${x}" data-y="${y}" alt="${malt}" />
                            <img class="CQP-Cursor noselect" src="${$eXeClasifica.idevicePath}exequextcursor.gif" alt="" />
                            ${fullimage}
                        </div>
                        <div class="CQP-EText noselect" data-color="${color}" data-backcolor="${backcolor}">
                            <div class="CQP-ETextDinamyc">${text}</div>                      
                        </div>
                        ${saudio}
                    </div>
                </div>
            </div>`;
    },

    moveCard: function ($item, $container, instance) {
        const mOptions = $eXeClasifica.options[instance];
        let type = 1,
            correctAnswer = false,
            message = '';
        $item.css({
            top: '',
            left: '',
            position: '',
            'z-index': '',
        });

        $item.prependTo($container);
        mOptions.attempts++;
        try {
            const $cardAudio = $item.find('.CQP-LinkAudio');
            const audio = $cardAudio.data('audio');
            if (typeof audio !== 'undefined' && audio && audio.length > 3) {
                $exeDevices.iDevice.gamification.media.playSound(audio, mOptions);
            }
        } catch (err) {
            // 
        }

        const group = $item.data('group'),
            groupp = $container.data('group'),
            number = parseInt($item.data('number'));

        if (mOptions.gameLevel === 2) {
            if ($item.data('ui-draggable')) {
                $item.draggable('destroy').css('cursor', 'default');
            }

            if (group === groupp) {
                $item.find('.CQP-Card').addClass('CQP-CardOK');
                correctAnswer = true;
                type = 2;
            } else {
                $item.find('.CQP-Card').addClass('CQP-CardKO');
            }
            message = $eXeClasifica.getMessageAnswer(
                correctAnswer,
                number,
                instance,
            );
        } else {
            if (group === groupp) {
                correctAnswer = true;
                type = 2;
            }
            if (mOptions.gameLevel === 0) {
                const mclass = correctAnswer ? 'CQP-CardOK' : 'CQP-CardKO';
                $item
                    .find('.CQP-Card')
                    .removeClass('CQP-CardOK CQP-CardKO')
                    .addClass(mclass);
                message = $eXeClasifica.getMessageAnswer(
                    correctAnswer,
                    number,
                    instance,
                );
            }
        }

        if (mOptions.gameLevel !== 1)
            messge = $eXeClasifica.getMessageAnswer(
                correctAnswer,
                number,
                instance,
            );

        $eXeClasifica.showMessage(type, message, instance);
        $eXeClasifica.updateScore($item, correctAnswer, instance);
        $eXeClasifica.refreshCards(instance);
        $eXeClasifica.updateQuestionNumber(instance);

        const html = $('#clasificaMultimedia-' + instance).html(),
            latex = /(?:\$|\\\(|\\\[|\\begin\{.*?})/.test(html);
        if (latex)
            $exeDevices.iDevice.gamification.math.updateLatex(
                '#clasificaMultimedia-' + instance,
            );
    },

    initializeDragAndDrop: function (instance) {
        const $cards = $(`#clasificaMainContainer-${instance}`).find(
            '.CQP-CardContainer',
        ),
            $containers = $(`#clasificaMainContainer-${instance}`).find(
                '.CQP-CC-' + instance,
            );

        $cards.draggable({
            revert: 'invalid',
            cursor: 'move',
            containment: 'document',
            helper: 'clone',
            appendTo: '.CQP-GameContainer-' + instance,
            cancel: '.CQP-FullLinkImage',
            start: function (event, ui) {
                $(this).addClass('CQP-Dragging');
                if (ui.helper) {
                    ui.helper.css({
                        width: $(this).width() + 'px',
                        height: $(this).height() + 'px',
                        'z-index': 1000,
                    });
                }
            },
            stop: function (event, ui) {
                $(this).removeClass('CQP-Dragging');
                if (ui.helper) {
                    ui.helper.css('z-index', 5);
                }
            },
        });

        $containers.droppable({
            accept: '.CQP-Drag-' + instance,
            over: function (_event, ui) {
                $(this).closest('.CQP-CC').addClass('CQP-CC-Over');
                ui.draggable.css('z-index', 1000);
            },
            out: function () {
                $(this).closest('.CQP-CC').removeClass('CQP-CC-Over');
            },
            drop: function (_e, ui) {
                const $this = $(this);
                $(this).closest('.CQP-CC').removeClass('CQP-CC-Over');
                ui.draggable.css('z-index', 5);
                $eXeClasifica.moveCard(ui.draggable, $this, instance);
            },
        });
    },

    clear: function (phrase) {
        phrase.replace(/[&\s\n\r]+/g, ' ').trim();
    },

    addEvents: function (instance) {
        $eXeClasifica.removeEvents(instance);

        const mOptions = $eXeClasifica.options[instance];

        $('#clasificaLinkMaximize-' + instance).on('click touchstart', (e) => {
            e.preventDefault();
            $('#clasificaGameContainer-' + instance).show();
            $('#clasificaGameMinimize-' + instance).hide();
        });

        $('#clasificaLinkMinimize-' + instance).on('click touchstart', (e) => {
            e.preventDefault();
            $('#clasificaGameContainer-' + instance).hide();
            $('#clasificaGameMinimize-' + instance)
                .css('visibility', 'visible')
                .show();
        });

        $('#clasificaCubierta-' + instance).hide();
        $('#clasificaGameOver-' + instance).hide();
        $('#clasificaCodeAccessDiv-' + instance).hide();

        $('#clasificaLinkFullScreen-' + instance).on(
            'click touchstart',
            (e) => {
                e.preventDefault();
                const element = document.getElementById(
                    'clasificaGameContainer-' + instance,
                );
                $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                    element,
                    instance,
                );
            },
        );

        $('#clasificaFeedBackClose-' + instance).on('click', () => {
            $('#clasificaDivFeedBack-' + instance).hide();
            $('#clasificaGameOver-' + instance).show();
        });

        if (mOptions.itinerary.showCodeAccess) {
            $('#clasificaMesajeAccesCodeE-' + instance).text(
                mOptions.itinerary.messageCodeAccess,
            );
            $('#clasificaCodeAccessDiv-' + instance).show();
            $('#clasificaCubierta-' + instance).show();
            $('#clasificaStartGame-' + instance).hide();
        }

        $('#clasificaCodeAccessButton-' + instance).on(
            'click touchstart',
            (e) => {
                e.preventDefault();
                $eXeClasifica.enterCodeAccess(instance);
            },
        );

        $('#clasificaCodeAccessE-' + instance).on('keydown', (event) => {
            if (event.which === 13 || event.keyCode === 13) {
                $eXeClasifica.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        $('#clasificaPNumber-' + instance).text(mOptions.numberQuestions);

        $(window).on('unload.eXeClasifica beforeunload.eXeClasifica', () => {
            if ($eXeClasifica.mScorm) {
                $exeDevices.iDevice.gamification.scorm.endScorm(
                    $eXeClasifica.mScorm,
                );
            }
        });

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        $('#clasificaMainContainer-' + instance)
            .closest('.clasifica-IDevice')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                if (mOptions.gameLevel === 2 || mOptions.gameOver) {
                    $eXeClasifica.sendScore(false, instance);
                    $eXeClasifica.saveEvaluation(instance);
                } else {
                    alert(mOptions.msgs.msgEndGamerScore);
                }
            });

        $('#clasificaImage-' + instance).hide();

        $('#clasificaStartGame-' + instance).on('click', (e) => {
            e.preventDefault();
            $eXeClasifica.startGame(instance);
        });

        $('#clasificaClueButton-' + instance).on('click', (e) => {
            e.preventDefault();
            $('#clasificaShowClue-' + instance).hide();
            $('#clasificaCubierta-' + instance).fadeOut();
        });

        $('#clasificaLinkReboot-' + instance)
            .hide()
            .on('click', (e) => {
                e.preventDefault();
                if (!mOptions.gameStarted) return;
                $('#clasificaRebootGame-' + instance).show();
                $('#clasificaCubierta-' + instance).fadeIn();
            });

        $('#clasificaRebootYes-' + instance).on('click', (e) => {
            e.preventDefault();
            mOptions.gameOver = true;
            mOptions.gameStarted = false;
            clearInterval(mOptions.counterClock);
            $eXeClasifica.startGame(instance);
            $('#clasificaRebootGame-' + instance).hide();
            $('#clasificaCubierta-' + instance).fadeOut();
        });

        $('#clasificaRebootNo-' + instance).on('click', (e) => {
            e.preventDefault();
            $('#clasificaRebootGame-' + instance).hide();
            $('#clasificaCubierta-' + instance).fadeOut();
        });

        $('#clasificaMultimedia-' + instance).on(
            'click',
            '.CQP-LinkAudio, .CQP-LinkAudioBig',
            (e) => {
                e.preventDefault();
                const audio = $(e.target)
                    .closest('.CQP-LinkAudio, .CQP-LinkAudioBig')
                    .data('audio');
                $exeDevices.iDevice.gamification.media.playSound(
                    audio,
                    mOptions,
                );
            },
        );

        $('#clasificaPErrors-' + instance).text(0);

        if (mOptions.time === 0) {
            $('#clasificaPTime-' + instance).hide();
            $('#clasificaImgTime-' + instance).hide();
            $eXeClasifica.uptateTime(mOptions.time * 60, instance);
        } else {
            $eXeClasifica.uptateTime(mOptions.time * 60, instance);
        }

        if (mOptions.author.trim().length > 0 && !mOptions.fullscreen) {
            $('#clasificaAuthorGame-' + instance)
                .html(mOptions.msgs.msgAuthor + ': ' + mOptions.author)
                .show();
        }

        $('#clasificaValidateAnswers-' + instance).hide();

        $('#clasificaMultimedia-' + instance)
            .find('img')
            .on('dragstart', (e) => {
                e.preventDefault();
            });

        $('#clasificaMultimedia-' + instance)
            .find('.CQP-CardContainer')
            .on('mousedown touchstart', function () {
                $(this).parent('.CQP-CC').css('z-index', '100');
                $(this).css('z-index', '1000');
                if (mOptions.gameStarted) {
                    $eXeClasifica.checkAudio(this, instance);
                }
            });

        $('#clasificaMultimedia-' + instance)
            .find('.CQP-CardContainer')
            .on('mouseup touchend', function () {
                $(this).parent('.CQP-CC').css('z-index', '1');
                $(this).css('z-index', '1');
            });

        $('#clasificaValidateAnswers-' + instance).on('click', (e) => {
            e.preventDefault();
            $eXeClasifica.gameOver(instance);
        });

        $('#clasificaMultimedia-' + instance)
            .find('.CQP-CP-' + instance)
            .each(function (i) {
                $(this).toggle(i < mOptions.numberGroups);
            });

        if (mOptions.gameLevel < 2) {
            $('#clasificaPHits-' + instance).hide();
            $('#clasificaGameScoreBoard-' + instance)
                .find('div.exeQuextIcons-Hit')
                .hide();
            $('#clasificaPErrors-' + instance).hide();
            $('#clasificaGameScoreBoard-' + instance)
                .find('div.exeQuextIcons-Error')
                .hide();
            $('#clasificaPScore-' + instance).hide();
            $('#clasificaGameScoreBoard-' + instance)
                .find('div.exeQuextIcons-Score')
                .hide();
        }

        $('#clasificaGameContainer-' + instance).off(
            'click',
            '.CQP-FullLinkImage',
        );
        $('#clasificaGameContainer-' + instance).on(
            'click',
            '.CQP-FullLinkImage',
            function (e) {
                e.stopPropagation();
                const $draggable = $(this).closest('.CQP-CardContainer'),
                    largeImageSrc = $draggable.find('.CQP-Image').attr('src');
                if (largeImageSrc && largeImageSrc.length > 3) {
                    $exeDevices.iDevice.gamification.helpers.showFullscreenImage(
                        largeImageSrc,
                        $('#clasificaGameContainer-' + instance),
                    );
                }
            },
        );

        setTimeout(() => {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                this.isInExe,
            );
        }, 500);
    },

    checkAudio: (card, instance) => {
        const mOptions = $eXeClasifica.options[instance],
            audio = $(card).find('.CQP-LinkAudio').data('audio');
        if (typeof audio !== 'undefined' && audio.length > 3) {
            $exeDevices.iDevice.gamification.media.playSound(audio, mOptions);
        }
    },

    removeEvents: function (instance) {
        $('#clasificaLinkMaximize-' + instance).off('click touchstart');
        $('#clasificaLinkMinimize-' + instance).off('click touchstart');
        $('#clasificaLinkFullScreen-' + instance).off('click touchstart');
        $('#clasificaFeedBackClose-' + instance).off('click');
        $('#clasificaCodeAccessButton-' + instance).off('click touchstart');
        $('#clasificaCodeAccessE-' + instance).off('keydown');
        $('#clasificaMainContainer-' + instance)
            .closest('.idevice_node')
            .off('click', '.Games-SendScore');
        $('#clasificaStartGame-' + instance).off('click');
        $('#clasificaClueButton-' + instance).off('click');
        $('#clasificaLinkReboot-' + instance).off('click');
        $('#clasificaRebootYes-' + instance).off('click');
        $('#clasificaRebootNo-' + instance).off('click');
        $('#clasificaMultimedia-' + instance).off(
            'click',
            '.CQP-LinkAudio, .CQP-LinkAudioBig',
        );
        $('#clasificaMultimedia-' + instance)
            .find('img')
            .off('dragstart');
        $('#clasificaMultimedia-' + instance)
            .find('.CQP-CardContainer')
            .off('mousedown touchstart mouseup touchend');
        $('#clasificaValidateAnswers-' + instance).off('click');

        $(window).off('unload.eXeClasifica beforeunload.eXeClasifica');
    },

    refreshGame: function (instance) {
        const mOptions = $eXeClasifica.options[instance];

        if (!mOptions) return;

        mOptions.fullscreen = !!(
            document.fullscreenElement ||
            document.mozFullScreenElement ||
            document.webkitFullscreenElement ||
            document.msFullscreenElement
        );
        $eXeClasifica.refreshCards(instance);
    },

    removeTags: (str) => {
        return $('<div></div>').html(str).text();
    },

    updateScore: function ($card, answer, instance) {
        const mOptions = $eXeClasifica.options[instance];
        let state = parseInt($card.data('state'));

        if (state === -1) {
            if (answer) {
                mOptions.hits++;
                $card.data('state', 1);
            } else {
                mOptions.errors++;
                $card.data('state', 0);
            }
        } else if (state === 0 && answer) {
            mOptions.hits++;
            mOptions.errors--;
            $card.data('state', 1);
        } else if (state === 1 && !answer) {
            mOptions.hits--;
            mOptions.errors++;
            $card.data('state', 0);
        }

        if (mOptions.gameLevel === 2) {
            mOptions.score = (
                (mOptions.hits * 10) /
                mOptions.cardsGame.length
            ).toFixed(2);
            $('#clasificaPHits-' + instance).text(mOptions.hits);
            $('#clasificaPErrors-' + instance).text(mOptions.errors);
            $('#clasificaPScore-' + instance).text(mOptions.score);

            const score = (
                (mOptions.hits * 10) /
                mOptions.numberQuestions
            ).toFixed(2);
            if (mOptions.isScorm === 1) {
                $eXeClasifica.sendScore(true, instance);
                $('#clasificaRepeatActivity-' + instance).text(
                    mOptions.msgs.msgYouScore + ': ' + score,
                );
                $eXeClasifica.initialScore = score;

            }
            $eXeClasifica.saveEvaluation(instance);
        }
    },

    updateQuestionNumber: function (instance) {
        const mOptions = $eXeClasifica.options[instance],
            numch = $('#clasificaSlide-' + instance).children().length;

        $('#clasificaPNumber-' + instance).text(numch);
        $eXeClasifica.checkClueGame(instance);

        if (
            mOptions.gameLevel === 0 &&
            mOptions.hits === mOptions.cardsGame.length
        ) {
            $eXeClasifica.gameOver(instance);
            return;
        }

        if (numch === 0) {
            if (
                mOptions.gameLevel === 2 ||
                (mOptions.gameLevel === 0 &&
                    $eXeClasifica.getNumberCorrectsAnswers(instance) ===
                    mOptions.cardsGame.length)
            ) {
                $eXeClasifica.gameOver(instance);
            } else if (mOptions.gameLevel === 1) {
                $('#clasificaValidateAnswers-' + instance).show();
            }
        }
    },

    handleGameOver: function (instance, showScoreCallback) {
        const mOptions = $eXeClasifica.options[instance];
        showScoreCallback(instance);
        const score = ((mOptions.hits * 10) / mOptions.numberQuestions).toFixed(
            2,
        );

        if (mOptions.isScorm === 1) {
            $eXeClasifica.sendScore(true, instance);
            $('#clasificaRepeatActivity-' + instance).text(
                mOptions.msgs.msgYouScore + ': ' + score,
            );
            $eXeClasifica.initialScore = score;
        }
        $eXeClasifica.saveEvaluation(instance);
    },

    gameOverLevel0: function (instance) {
        $eXeClasifica.handleGameOver(instance, $eXeClasifica.showLevel0Score);
    },

    gameOverLevel1: function (instance) {
        $eXeClasifica.handleGameOver(instance, $eXeClasifica.showLevel1Score);
    },

    gameOverLevel2: function (instance) {
        $eXeClasifica.handleGameOver(instance, $eXeClasifica.showCustomScore);
    },

    checkClueGame: function (instance) {
        const mOptions = $eXeClasifica.options[instance],
            percentageHits = (mOptions.hits / mOptions.cardsGame.length) * 100;

        if (
            mOptions.itinerary.showClue &&
            percentageHits >= mOptions.itinerary.percentageClue &&
            !mOptions.obtainedClue
        ) {
            mOptions.obtainedClue = true;
            $('#clasificaPShowClue-' + instance).text(
                mOptions.itinerary.clueGame,
            );
            $('#clasificaShowClue-' + instance).show();
            $('#clasificaCubierta-' + instance).show();
        }
    },

    gameOver: function (instance) {
        const mOptions = $eXeClasifica.options[instance],
            $cards = $('#clasificaMultimedia-' + instance).find(
                '.CQP-CardContainer',
            );
        if (!mOptions.gameStarted) return;

        mOptions.gameOver = true;
        mOptions.gameStarted = false;
        clearInterval(mOptions.counterClock);

        $cards.each(function () {
            if ($(this).data('ui-draggable')) {
                $(this).draggable('destroy').css('cursor', 'default');
            }
        });

        if ($('#clasificaSlide-' + instance).children().length === 0) {
            $('#clasificaSlide-' + instance).hide();
        }

        if (mOptions.gameLevel === 0) {
            $eXeClasifica.gameOverLevel0(instance);
        } else if (mOptions.gameLevel === 1) {
            $eXeClasifica.gameOverLevel1(instance);
        } else if (mOptions.gameLevel === 2) {
            $eXeClasifica.gameOverLevel2(instance);
        }

        $eXeClasifica.checkClueGame(instance);
        $eXeClasifica.showFeedBack(instance);
    },

    setFontSize: function (instance) {
        const $flcds = $('#clasificaGameContainer-' + instance).find(
            '.CQP-CardContainer',
        );
        $flcds.each(function () {
            const $card = $(this),
                $text = $card.find('.CQP-EText'),
                latex =
                    $text.find('mjx-container').length > 0 ||
                    /(?:\$|\\\(|\\\[|\\begin\{.*?})/.test($text.text());
            if (!latex) {
                $eXeClasifica.adjustFontSize($text);
            } else {
                $eXeClasifica.setFontSizeMath($text, instance);
            }
        });
    },

    isFullScreen: function () {
        return (
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement != null
        );
    },

    getNumberCards: function (instance) {
        const mOptions = $eXeClasifica.options[instance];
        return mOptions.cardsGame.length;
    },

    setFontSizeMath($text, instance) {
        const numCards = $eXeClasifica.getNumberCards(instance),
            isFullScreen = $eXeClasifica.isFullScreen();
        let fontSize;

        const fontSizeSettings = [
            { threshold: 34, fullScreenSize: 10, normalSize: 8 },
            { threshold: 24, fullScreenSize: 12, normalSize: 10 },
            { threshold: 18, fullScreenSize: 16, normalSize: 14 },
            { threshold: 10, fullScreenSize: 18, normalSize: 16 },
        ];

        fontSize = isFullScreen ? 20 : 18;

        for (const setting of fontSizeSettings) {
            if (numCards > setting.threshold) {
                fontSize = isFullScreen
                    ? setting.fullScreenSize
                    : setting.normalSize;
                break;
            }
        }
        $text.css({ 'font-size': `${fontSize}px` });
    },

    adjustFontSize: function ($container) {
        const $text = $container.find('.CQP-ETextDinamyc').eq(0),
            minFontSize = 10,
            maxFontSize = 26,
            widthc = $container.innerWidth(),
            heightc = $container.innerHeight();

        let fontSize = maxFontSize;

        $text.css('font-size', fontSize + 'px');

        while (
            ($text.outerWidth() > widthc || $text.outerHeight() > heightc) &&
            fontSize > minFontSize
        ) {
            fontSize--;
            $text.css('font-size', fontSize + 'px');
        }

        while (
            $text.outerWidth() < widthc &&
            $text.outerHeight() < heightc &&
            fontSize < maxFontSize
        ) {
            fontSize++;
            $text.css('font-size', fontSize + 'px');

            if ($text.outerWidth() > widthc || $text.outerHeight() > heightc) {
                fontSize--;
                $text.css('font-size', fontSize + 'px');
                break;
            }
        }
    },

    showCustomScore: function (instance) {
        const mOptions = $eXeClasifica.options[instance];
        $('#clasificaPHits-' + instance)
            .text(mOptions.hits)
            .show();
        $('#clasificaPErrors-' + instance)
            .text(mOptions.errors)
            .show();
        $('#clasificaPScore-' + instance)
            .text(mOptions.score)
            .show();
        $('#clasificaGameScoreBoard-' + instance)
            .find(
                'div.exeQuextIcons-Hit, div.exeQuextIcons-Error, div.exeQuextIcons-Score',
            )
            .show();
        $('#clasificaStartGame-' + instance).show();

        mOptions.hits = $eXeClasifica.getNumberCorrectsAnswers(instance);
        mOptions.score = (
            (mOptions.hits * 10) /
            mOptions.cardsGame.length
        ).toFixed(2);

        const percentageHits = mOptions.hits / mOptions.cardsGame.length;

        let msg = '',
            type = percentageHits < 0.5 ? 1 : 2;
        if (percentageHits < 0.5) {
            msg = mOptions.msgs.msgQ5.replace(
                '%s',
                mOptions.cardsGame.length - mOptions.hits,
            );
        } else if (percentageHits < 0.7) {
            msg = mOptions.msgs.msgQ7.replace(
                '%s',
                mOptions.cardsGame.length - mOptions.hits,
            );
        } else if (percentageHits < 1) {
            msg = mOptions.msgs.msgQ9.replace(
                '%s',
                mOptions.cardsGame.length - mOptions.hits,
            );
        } else {
            msg = mOptions.msgs.msgAllCorrect;
        }

        $eXeClasifica.showMessage(type, msg, instance);
    },

    showLevel1Score: function (instance) {
        const mOptions = $eXeClasifica.options[instance],
            $cc = $('#clasificaMultimedia-' + instance).find(
                '.CQP-CardContainer',
            );

        mOptions.gameOver = true;
        mOptions.gameStarted = false;
        $cc.each(function () {
            if ($(this).data('ui-draggable')) {
                $(this).draggable('destroy').css('cursor', 'default');
            }
        });

        mOptions.score = mOptions.hits = mOptions.errors = 0;

        $cc.each(function () {
            const group = $(this).data('group'),
                groupp = $(this).parent().data('group');

            if (group === groupp) {
                mOptions.hits++;
                $(this).find('.CQP-Card').addClass('CQP-CardOK');
            } else {
                mOptions.errors++;
                $(this).find('.CQP-Card').addClass('CQP-CardKO');
            }
        });

        $eXeClasifica.showCustomScore(instance);
        $('#clasificaStartGame-' + instance)
            .text(mOptions.msgs.msgPlayAgain)
            .show();
        $('#clasificaValidateAnswers-' + instance).hide();
    },

    showLevel0Score: function (instance) {
        const mOptions = $eXeClasifica.options[instance],
            $cc = $('#clasificaMultimedia-' + instance).find(
                '.CQP-CardContainer',
            );

        $cc.each(function () {
            if ($(this).data('ui-draggable')) {
                $(this).draggable('destroy').css('cursor', 'default');
            }
        });

        mOptions.hits = 0;

        $cc.each(function () {
            const group = $(this).data('group'),
                groupp = $(this).parent().data('group');

            if (group === groupp) {
                mOptions.hits++;
                $(this).find('.CQP-Card').addClass('CQP-CardOK');
            } else {
                $(this).find('.CQP-Card').addClass('CQP-CardKO');
            }
        });

        let msg = '',
            type = 1;

        if (mOptions.hits < mOptions.cardsGame.length) {
            msg = mOptions.msgs.msgUnansweredQuestions.replace(
                '%s',
                mOptions.cardsGame.length - mOptions.hits,
            );
        } else {
            if (mOptions.attempts === mOptions.cardsGame.length) {
                type = 2;
                msg = mOptions.msgs.msgAllCorrect;
            } else {
                msg = mOptions.msgs.msgTooManyTries.replace(
                    '%s',
                    mOptions.attempts,
                );
            }
        }

        $('#clasificaStartGame-' + instance)
            .text(mOptions.msgs.msgPlayAgain)
            .show();
        $('#clasificaValidateAnswers-' + instance).hide();
        $eXeClasifica.showMessage(type, msg, instance);
    },

    getColors: (number) => {
        return Array.from({ length: number }, () => $eXeClasifica.colorRGB());
    },

    colorRGB: () => {
        return `rgb(${(Math.random() * 255).toFixed(0)}, ${(Math.random() * 255).toFixed(0)}, ${(Math.random() * 255).toFixed(0)})`;
    },

    showCard: function (card) {
        const $card = card,
            $text = $card.find('.CQP-EText').eq(0),
            $image = $card.find('.CQP-Image').eq(0),
            $cursor = $card.find('.CQP-Cursor').eq(0),
            $audio = $card.find('.CQP-LinkAudio').eq(0),
            type = parseInt($card.data('type')),
            x = parseFloat($image.data('x')),
            y = parseFloat($image.data('y')),
            url = $image.data('url'),
            alt = $image.attr('alt') || '',
            audio = $audio.data('audio') || '',
            text = $text.find('.CQP-ETextDinamyc').html() || '',
            color = $text.data('color'),
            backcolor = $text.data('backcolor');

        $text.hide();
        $image.hide();
        $cursor.hide();
        $audio.hide();

        if (type === 1) {
            $text.show().css({ color: color, 'background-color': backcolor });
        } else if (type === 0 && url.length > 0) {
            $image
                .attr('alt', alt)
                .prop('src', url)
                .on('load', function () {
                    if (this.complete && this.naturalWidth > 0) {
                        $image.show();
                        $eXeClasifica.positionPointerCard($cursor, x, y);
                    }
                })
                .on('error', () => $cursor.hide());
        } else if (type === 2 && url.length > 0) {
            $image
                .attr('alt', alt)
                .prop('src', url)
                .on('load', function () {
                    if (this.complete && this.naturalWidth > 0) {
                        $image.show();
                        $eXeClasifica.positionPointerCard($cursor, x, y);
                    }
                })
                .on('error', () => $cursor.hide());

            $text.show().css({
                'color': color,
                'background-color': $eXeClasifica.hexToRgba(backcolor, 0.7)
            });
        }

        if (audio.length > 0) {
            if (url.trim().length === 0 && text.trim().length === 0) {
                $audio.addClass('CQP-LinkAudioBig');
            }
            $audio.show();
        }
    },

    getNumberCorrectsAnswers: function (instance) {
        let hits = 0;
        $('#clasificaMultimedia-' + instance)
            .find('.CQP-CardContainer')
            .each(function () {
                const group = $(this).data('group'),
                    groupp = $(this).parent().data('group');
                if (group === groupp) hits++;
            });
        return hits;
    },

    hexToRgba: function (hex, alpha = 1) {

        if (typeof hex !== 'string' || hex.trim() === '') {
            return `rgba(255,255,255,${Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1})`;
        }
        const raw = hex.trim();
        if (/^rgba?\(/i.test(raw)) {

            if (/^rgba\(/i.test(raw) && (alpha === 1 || alpha === undefined)) return raw;
            try {
                const nums = raw.replace(/rgba?\(|\)|\s/g, '').split(',').map(v => parseFloat(v));
                const [r = 255, g = 255, b = 255] = nums;
                const a = Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : (nums[3] ?? 1);
                return `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${a})`;
            } catch (e) {
                return `rgba(255,255,255,${Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1})`;
            }
        }
        let h = raw.replace(/^#/, '');
        if (![3, 6].includes(h.length) || /[^0-9a-f]/i.test(h)) {
            return `rgba(255,255,255,${Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1})`;
        }
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        const a = Number.isFinite(alpha) ? Math.min(1, Math.max(0, Number(alpha))) : 1;
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    },

    refreshCards: function (instance) {
        const mOptions = $eXeClasifica.options[instance],
            $cards = $('#clasificaGameContainer-' + instance).find(
                '.CQP-CardContainer',
            );

        if (!mOptions || mOptions.refreshCard) return;

        mOptions.refreshCard = true;
        $cards.each(function () {
            const $card = $(this),
                $image = $card.find('.CQP-Image').eq(0),
                $cursor = $card.find('.CQP-Cursor').eq(0),
                x = parseFloat($image.data('x')) || 0,
                y = parseFloat($image.data('y')) || 0;
            $eXeClasifica.positionPointerCard($cursor, x, y);
        });
        $eXeClasifica.setFontSize(instance);
        mOptions.refreshCard = false;
    },

    positionPointerCard: function ($cursor, x, y) {
        if (x > 0 || y > 0) {
            const $container = $cursor.parents('.CQP-ImageContain').eq(0),
                $image = $cursor.siblings('.CQP-Image').eq(0),
                containerOffset = $container.offset(),
                imageOffset = $image.offset(),
                marginX = imageOffset.left - containerOffset.left,
                marginY = imageOffset.top - containerOffset.top,
                posX = marginX + x * $image.width(),
                posY = marginY + y * $image.height();

            $cursor.css({ left: posX, top: posY, 'z-index': 10 }).show();
        } else {
            $cursor.hide();
        }
    },

    enterCodeAccess: function (instance) {
        const mOptions = $eXeClasifica.options[instance],
            codeInput = $('#clasificaCodeAccessE-' + instance).val();

        if (mOptions.itinerary.codeAccess === codeInput) {
            $('#clasificaCodeAccessDiv-' + instance).hide();
            $('#clasificaCubierta-' + instance).hide();
            $('#clasificaLinkMaximize-' + instance).trigger('click');
            $eXeClasifica.startGame(instance);
        } else {
            $('#clasificaMesajeAccesCodeE-' + instance)
                .fadeOut(300)
                .fadeIn(200);
            $('#clasificaCodeAccessE-' + instance).val('');
        }
    },

    initCards: function (instance) {
        const $cards = $('#clasificaMultimedia-' + instance).find(
            '.CQP-CardContainer',
        );

        $cards.each(function () {
            $(this).data('state', '-1');
            $eXeClasifica.showCard($(this), instance);
        });

        const hasLatex = /(?:\$|\\\(|\\\[|\\begin\{.*?})/.test(
            $('#clasificaMultimedia-' + instance).html(),
        );
        if (hasLatex) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '#clasificaMultimedia-' + instance,
            );
        }

        $eXeClasifica.refreshCards(instance);
    },

    startGame: function (instance) {
        const mOptions = $eXeClasifica.options[instance];

        if (mOptions.gameStarted) return;

        $eXeClasifica.addCards(instance, mOptions.cardsGame);

        const $cards = $('#clasificaGameContainer-' + instance).find(
            '.CQP-CardContainer',
        );

        $cards.find('.CQP-Card').removeClass('CQP-CardOK CQP-CardKO');
        $eXeClasifica.initializeDragAndDrop(instance);

        $('#clasificaStartGame-' + instance).hide();
        $('#clasificaSlide-' + instance).show();
        $cards.find('.CQP-Card').addClass('flipped');

        $eXeClasifica.showMessage(
            3,
            mOptions.msgs.mgsGameStart,
            instance,
            false,
        );

        Object.assign(mOptions, {
            hits: 0,
            errors: 0,
            score: 0,
            attempts: 0,
            counter: mOptions.time * 60,
            gameOver: false,
            gameStarted: false,
            obtainedClue: false,
        });

        $('#clasificaPShowClue-' + instance).text('');
        $('#clasificaShowClue-' + instance).hide();
        $('#clasificaPHits-' + instance).text(mOptions.hits);
        $('#clasificaPErrors-' + instance).text(mOptions.errors);
        $('#clasificaPScore-' + instance).text(mOptions.score);
        $('#clasificaPNumber-' + instance).text(mOptions.numberQuestions);
        $('#clasificaCubierta-' + instance).hide();
        $('#clasificaGameOver-' + instance).hide();
        $('#clasificaMessage-' + instance).hide();

        if (mOptions.gameLevel < 2) {
            $('#clasificaPHits-' + instance).hide();
            $('#clasificaGameScoreBoard-' + instance)
                .find('div.exeQuextIcons-Hit')
                .hide();
            $('#clasificaPErrors-' + instance).hide();
            $('#clasificaGameScoreBoard-' + instance)
                .find('div.exeQuextIcons-Error')
                .hide();
            $('#clasificaPScore-' + instance).hide();
            $('#clasificaGameScoreBoard-' + instance)
                .find('div.exeQuextIcons-Score')
                .hide();
        }

        $eXeClasifica.initCards(instance);

        if (mOptions.time === 0) {
            $('#clasificaPTime-' + instance).hide();
            $('#clasificaImgTime-' + instance).hide();
        }

        if (mOptions.time > 0) {
            mOptions.counterClock = setInterval(() => {
                if (mOptions.gameStarted) {
                    let $node = $('#clasificaMainContainer-' + instance);
                    let $content = $('#node-content');
                    if (!$node.length || ($content.length && $content.attr('mode') === "edition")) {
                        clearInterval(mOptions.counterClock);
                        return;
                    }
                    mOptions.counter--;
                    $eXeClasifica.uptateTime(mOptions.counter, instance);
                    if (mOptions.counter <= 0) {
                        clearInterval(mOptions.counterClock);
                        $eXeClasifica.gameOver(instance);
                    }
                }
            }, 1000);
            $eXeClasifica.uptateTime(mOptions.time * 60, instance);
        }

        mOptions.gameStarted = true;
    },

    uptateTime: function (tiempo, instance) {
        const mOptions = $eXeClasifica.options[instance];
        if (mOptions.time === 0) return;
        const mTime =
            $exeDevices.iDevice.gamification.helpers.getTimeToString(tiempo);
        $('#clasificaPTime-' + instance).text(mTime);
    },

    showFeedBack: function (instance) {
        const mOptions = $eXeClasifica.options[instance],
            puntos = (mOptions.hits * 100) / mOptions.cardsGame.length;

        if (mOptions.feedBack) {
            if (puntos >= mOptions.percentajeFB) {
                $('#clasificaGameOver-' + instance).hide();
                $('#clasificaDivFeedBack-' + instance)
                    .find('.clasifica-feedback-game')
                    .show();
                $('#clasificaDivFeedBack-' + instance).show();
            } else {
                $eXeClasifica.showMessage(
                    1,
                    mOptions.msgs.msgTryAgain.replace(
                        '%s',
                        mOptions.percentajeFB,
                    ),
                    instance,
                    false,
                );
            }
        }
    },

    isMobile: () =>
        navigator.userAgent.match(
            /Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile/i,
        ),

    getRetroFeedMessages: function (iHit, instance) {
        const mOptions = $eXeClasifica.options[instance];
        let sMessages = iHit
            ? mOptions.msgs.msgSuccesses
            : mOptions.msgs.msgFailures;
        sMessages = sMessages.split('|');
        return sMessages[Math.floor(Math.random() * sMessages.length)];
    },

    getMessageAnswer: function (correctAnswer, number, instance) {
        return correctAnswer
            ? $eXeClasifica.getMessageCorrectAnswer(number, instance)
            : $eXeClasifica.getMessageErrorAnswer(number, instance);
    },

    getMessageCorrectAnswer: function (number, instance) {
        const mOptions = $eXeClasifica.options[instance];
        let message = $eXeClasifica.getRetroFeedMessages(true, instance);

        if (
            !isNaN(number) &&
            number < mOptions.cardsGame.length &&
            mOptions.customMessages &&
            mOptions.cardsGame[number].msgHit.length > 0
        ) {
            message = mOptions.cardsGame[number].msgHit;
        }

        return message;
    },

    getMessageErrorAnswer: function (number, instance) {
        const mOptions = $eXeClasifica.options[instance];
        let message = $eXeClasifica.getRetroFeedMessages(false, instance);

        if (
            !isNaN(number) &&
            number < mOptions.cardsGame.length &&
            mOptions.customMessages &&
            mOptions.cardsGame[number].msgError.length > 0
        ) {
            message = mOptions.cardsGame[number].msgError;
        }

        return message;
    },

    showMessage: function (type, message, instance) {
        const colors = [
            '#555555',
            $eXeClasifica.borderColors.red,
            $eXeClasifica.borderColors.green,
            $eXeClasifica.borderColors.blue,
            $eXeClasifica.borderColors.yellow,
        ],
            color = colors[type];

        $('#clasificaMessage-' + instance)
            .text(message)
            .css('color', color)
            .show();
    },
};
$(function () {
    $eXeClasifica.init();
});
