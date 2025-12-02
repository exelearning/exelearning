/* eslint-disable no-undef */
/**
 * QuExt Activity iDevice (export code)
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno, Francisco Javier Pulido
 * Testers: Ricardo Málaga Floriano, Francisco Muñoz de la Peña
 * Translator: Antonio Juan Delgado García
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $eXeIdentifica = {
    idevicePath: '',
    borderColors: {
        black: '#1c1b1b',
        blue: '#45085f',
        green: '#00a300',
        red: '#b3092f',
        white: '#f9f9f9',
        yellow: '#f3d55a',
        grey: '#777777',
        incorrect: '#d9d9d9',
        correct: '#00ff00',
    },
    colors: {
        black: '#1c1b1b',
        blue: '#dfe3f1',
        green: '#caede8',
        red: '#fbd2d6',
        white: '#f9f9f9',
        yellow: '#fcf4d3',
        correct: '#dcffdc',
    },
    options: {},
    userName: '',
    previousScore: '',
    initialScore: '',
    msgs: '',
    hasSCORMbutton: false,
    isInExe: false,
    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',
    mScorm: null,

    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            'Identify',
            'identify',
            'identifica-IDevice'
        );
    },

    enable: function () {
        $eXeIdentifica.loadGame();
    },

    loadGame: function () {
        $eXeIdentifica.options = [];
        $eXeIdentifica.activities.each(function (i) {
            const dl = $('.identifica-DataGame', this),
                imagesLink = $('.identifica-LinkImages', this),
                audioLink = $('.identifica-LinkAudios', this),
                mOption = $eXeIdentifica.loadDataGame(
                    dl,
                    imagesLink,
                    audioLink
                ),
                msg = mOption.msgs.msgPlayStart;

            mOption.scorerp = 0;
            mOption.idevicePath = $eXeIdentifica.idevicePath;
            mOption.main = 'idfMainContainer-' + i;
            mOption.idevice = 'identifica-IDevice';

            $eXeIdentifica.options.push(mOption);

            const idf = $eXeIdentifica.createInterfaceIndetify(i);
            dl.before(idf).remove();
            $('#idfGameMinimize-' + i).hide();
            $('#idfGameContainer-' + i).hide();

            if (mOption.showMinimize) {
                $('#idfGameMinimize-' + i)
                    .css({
                        cursor: 'pointer',
                    })
                    .show();
            } else {
                $('#idfGameContainer-' + i).show();
            }
            $('#idfMessageMaximize-' + i).text(msg);
            $('#idfDivFeedBack-' + i).prepend(
                $('.identifica-feedback-game', this)
            );

            $eXeIdentifica.addEvents(i);

            $('#idfDivFeedBack-' + i).hide();
            $eXeIdentifica.startGame(i);
            $('#idfMainContainer-' + i).show();
        });

        let node = document.querySelector('.page-content');
        if (this.isInExe) {
            node = document.getElementById('node-content');
        }
        if (node)
            $exeDevices.iDevice.gamification.observers.observeResize(
                $eXeIdentifica,
                node
            );

        $exeDevices.iDevice.gamification.math.updateLatex(
            '.identifica-IDevice'
        );
    },

    createInterfaceIndetify: function (instance) {
        const path = $eXeIdentifica.idevicePath,
            msgs = $eXeIdentifica.options[instance].msgs,
            mOptions = $eXeIdentifica.options[instance],
            html = `
            <div class="IDFP-MainContainer" id="idfMainContainer-${instance}">
                <div class="IDFP-GameMinimize" id="idfGameMinimize-${instance}">
                    <a href="#" class="IDFP-LinkMaximize" id="idfLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                        <img src="${path}identificaIcon.png" class="IDFP-IconMinimize IDFP-Activo" alt="">
                        <div class="IDFP-MessageMaximize" id="idfMessageMaximize-${instance}"></div>
                    </a>
                </div>
                <div class="IDFP-GameContainer" id="idfGameContainer-${instance}">
                    <div class="IDFP-GameScoreBoard">
                        <div class="IDFP-GameScores">
                            <div class="IDFPIcons IDFPIcons-Number" title="${msgs.msgNumQuestions}"></div>
                            <p><span class="sr-av">${msgs.msgNumQuestions}: </span><span id="idfPNumber-${instance}">0</span></p>
                            <div class="IDFPIcons IDFPIcons-Hit" title="${msgs.msgHits}"></div>
                            <p><span class="sr-av">${msgs.msgHits}: </span><span id="idfPHits-${instance}">0</span></p>
                            <div class="IDFPIcons IDFPIcons-Error" title="${msgs.msgErrors}"></div>
                            <p><span class="sr-av">${msgs.msgErrors}: </span><span id="idfPErrors-${instance}">0</span></p>
                            <div class="IDFPIcons IDFPIcons-Score" title="${msgs.msgScore}"></div>
                            <p><span class="sr-av">${msgs.msgScore}: </span><span id="idfPScore-${instance}">0</span></p>
                        </div>
                        <div class="IDFP-LifesGame" id="idfLifesGame-${instance}"></div>
                        <div class="IDFP-TimeNumber">
                            <div class="IDFPIcons IDFPIcons-Life" title="${msgs.msgAttempts}"></div>
                            <p><span class="sr-av">${msgs.msgAttempts}: </span><span id="idfAttempts-${instance}">1</span></p>
                            <div class="IDFPIcons IDFPIcons-PointsClue" title="${msgs.msgScoreQuestion}"></div>
                            <p><span class="sr-av">${msgs.msgScoreQuestion}: </span><span id="idfPoints-${instance}">1.00</span></p>
                            <a href="#" class="IDFP-LinkMinimize" id="idfLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                                <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                                <div class="IDFPIcons IDFPIcons-Minimize IDFP-Activo"></div>
                            </a>
                            <a href="#" class="IDFP-LinkFullScreen" id="idfLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                                <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                                <div class="IDFPIcons IDFPIcons-FullScreen IDFP-Activo" id="idfFullScreen-${instance}"></div>
                            </a>
                        </div>
                    </div>
                    <div class="IDFP-ShowClue" id="idfShowClue-${instance}">
                        <div class="sr-av">${msgs.msgClue}</div>
                        <p class="IDFP-PShowClue IDFP-parpadea" id="idfPShowClue-${instance}"></p>
                    </div>
                    <div id="idfMessageClue-${instance}" class="IDFP-MessageClue"></div>
                    <div class="IDFP-Multimedia" id="idfMultimedia-${instance}">
                        <div class="IDFP-Left">
                            ${$eXeIdentifica.getClues(0, instance)}
                        </div>
                        <div class="IDFP-Media">
                            <a href="#" id="idfLinkAudio-${instance}" class="IDFP-LinkAudio" title="${msgs.msgAudio}" style="position:absolute;top:8px;right:8px;z-index:1000;display:none;">
                                <img src="${path}exequextaudio.png" class="IDFP-Audio" alt="Audio">
                            </a>
                            <div id="idfCardDraw-${instance}" class="IDFP-CardDraw">
                                <div class="IDFP-card">
                                    <div class="IDFP-card-inner" id="idfcardinner-${instance}">
                                        <div class="IDFP-card-front">
                                            <div class="IDFP-ImageContain">
                                                <img src="${path}identificaHome.png" class="IDFP-Image IDFP-Image-Front" alt="" />
                                            </div>
                                        </div>
                                        <div class="IDFP-card-back">
                                            <div class="IDFP-ImageContain" id="idfImageContainerBack-${instance}">
                                                <img src="" id="idfBackImage-${instance}" class="IDFP-Image IDFP-Image-Back" alt="" />
                                                <img class="IDFP-Cursor IDFP-Cursor-Back" id="idfBackCursor-${instance}" src="${path}exequextcursor.gif" alt="Cursor" />
                                                <a href="#" class="IDFP-LinkAudio IDFP-LinkAudio-Back" id="idfBackAudio-${instance}" title="Audio">
                                                    <img src="${path}exequextaudio.png" class="IDFP-Audio" alt="Audio">
                                                </a>
                                            </div>
                                            <div class="IDFP-AuthorLicence" id="idfAuthorLicence-${instance}">
                                                <div class="sr-av">${msgs.msgAuthor}:</div>
                                                <p id="idfPAuthor-${instance}"></p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="IDFP-GameOver" id="idfGamerOver-${instance}">
                                <div class="IDFP-DataImage">
                                    <img src="${path}exequextlost.png" class="IDFP-HistGGame" id="idfHistGame-${instance}" alt="${msgs.msgAllQuestions}" />
                                </div>
                                <div class="IDFP-DataScore">
                                    <p id="idfOverScore-${instance}">Score: 0</p>
                                    <p id="idfOverHits-${instance}">Hits: 0</p>
                                    <p id="idfOverErrors-${instance}">Errors: 0</p>
                                </div>
                            </div>
                        </div>
                        <div class="IDFP-Right">
                            ${$eXeIdentifica.getClues(1, instance)}
                        </div>
                    </div>
                    <div class="IDFP-Botton">
                        ${$eXeIdentifica.getCluesBotton(instance)}
                    </div>
                    <div class="IDFP-ButtonClue">
                        <a href="#" id="idfUseClue-${instance}" class="IDFP-BClue">${msgs.msgShowClue}</a>
                    </div>
                    <div id="idfMessageAnswer-${instance}" class="IDFP-MessageClue"></div>
                    <div class="IDFP-DivSubmit" id="idfDivSubmit-${instance}">
                        <a href="#" id="idfBtnMoveOn-${instance}" title="${msgs.msgMoveOne}">
                            <strong><span class="sr-av">${msgs.msgMoveOne}</span></strong>
                            <div class="exeQuextIcons-MoveOne IDFP-Activo"></div>
                        </a>
                        <label for="idfAnswer-${instance}" class="sr-av">${msgs.msgReply}</label>
                        <input id="idfAnswer-${instance}" class="form-control" type="text">
                        <a href="#" id="idfSubmit-${instance}" title="${msgs.msgReply}">
                            <strong><span class="sr-av">${msgs.msgReply}</span></strong>
                            <div class="exeQuextIcons-Submit IDFP-Activo"></div>
                        </a>
                    </div>                    
                </div>
                <div class="IDFP-Cubierta" id="idfCubierta-${instance}">
                    <div class="IDFP-CodeAccessDiv" id="idfCodeAccessDiv-${instance}">
                        <p class="IDFP-MessageCodeAccessE" id="idfMesajeAccesCodeE-${instance}"></p>
                            <div class="IDFP-DataCodeAccessE">
                                <label class="sr-av">${msgs.msgCodeAccess}:</label>
                                <input type="text" class="IDFP-CodeAccessE form-control" id="idfCodeAccessE-${instance}">
                                <a href="#" id="idfCodeAccessButton-${instance}" title="${msgs.msgSubmit}">
                                    <strong><span class="sr-av">${msgs.msgSubmit}</span></strong>
                                    <div class="IDFPIcons IDFPIcons-Submit IDFP-Activo"></div>
                                </a>
                            </div>
                        </div>
                        <div class="IDFP-DivFeedBack" id="idfDivFeedBack-${instance}">
                            <input type="button" id="idfFeedBackClose-${instance}" value="${msgs.msgClose}" class="feedbackbutton" />
                        </div>
                    </div>
            </div>
           ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}
        `;
        return html;
    },

    showCubiertaOptions(mode, instance) {
        if (mode === false) {
            $('#idfCubierta-' + instance).fadeOut();
            return;
        }
        $('#idfCodeAccessDiv-' + instance).hide();
        $('#idfDivFeedBack-' + instance).hide();
        switch (mode) {
            case 0:
                $('#idfCodeAccessDiv-' + instance).show();
                break;
            case 1:
                $('#idfDivFeedBack-' + instance)
                    .find('.identifica-feedback-game')
                    .show();
                $('#idfDivFeedBack-' + instance).css('display', 'flex');
                $('#idfDivFeedBack-' + instance).show();
                break;
            default:
                break;
        }
        $('#idfCubierta-' + instance).fadeIn();
    },

    getCluesBotton: function (instance) {
        const mOptions = $eXeIdentifica.options[instance];
        let html = '';

        for (let i = 0; i < 8; i++) {
            const clue =
                ' <a href="#" data-number="' +
                i +
                '" class="IDFP-LinkClue">\
                <img class="IDFP-Clue" src="' +
                $eXeIdentifica.idevicePath +
                'identificaPistaI.svg" alt="' +
                mOptions.msgs.msgClue +
                ' ' +
                i +
                '">\
            </a>';
            html += clue;
        }
        return html;
    },

    getClues: function (num, instance) {
        const mOptions = $eXeIdentifica.options[instance];
        let html = '';
        for (let i = 0; i < 5; i++) {
            let clue =
                ' <a href="#" data-number="' +
                (i * 2 + num) +
                '" class="IDFP-LinkClue">\
                <img class="IDFP-Clue" src="' +
                $eXeIdentifica.idevicePath +
                'identificaPistaI.svg" alt="' +
                mOptions.msgs.msgClue +
                ' ' +
                (2 * i + num) +
                '">\
            </a>';
            html += clue;
        }
        return html;
    },

    loadDataGame: function (data, imgsLink, audioLink) {
        let json = data.text();
        json = $exeDevices.iDevice.gamification.helpers.decrypt(json);

        let mOptions =
            $exeDevices.iDevice.gamification.helpers.isJsonString(json);

        mOptions.gameOver = false;
        mOptions.gameStarted = false;
        mOptions.gameinit = false;
        mOptions.activeClue = 0;
        mOptions.activeQuestion = 0;

        for (let i = 0; i < mOptions.questionsGame.length; i++) {
            mOptions.questionsGame[i].url =
                $exeDevices.iDevice.gamification.media.extractURLGD(
                    mOptions.questionsGame[i].url
                );
            mOptions.questionsGame[i].audio =
                $exeDevices.iDevice.gamification.media.extractURLGD(
                    mOptions.questionsGame[i].audio
                );
        }

        mOptions.scoreGame = 0;
        mOptions.scoreTotal = 0;
        mOptions.score = 0;
        mOptions.playerAudio = '';
        mOptions.evaluation =
            typeof mOptions.evaluation == 'undefined'
                ? false
                : mOptions.evaluation;
        mOptions.evaluationID =
            typeof mOptions.evaluationID == 'undefined'
                ? ''
                : mOptions.evaluationID;
        mOptions.id = typeof mOptions.id == 'undefined' ? false : mOptions.id;

        imgsLink.each(function () {
            const iq = parseInt($(this).text());
            if (!isNaN(iq) && iq < mOptions.questionsGame.length) {
                mOptions.questionsGame[iq].url = $(this).attr('href');
                if (
                    mOptions.questionsGame[iq].url.length < 4 &&
                    mOptions.questionsGame[iq].type == 1
                ) {
                    mOptions.questionsGame[iq].url = '';
                }
            }
        });

        audioLink.each(function () {
            const iq = parseInt($(this).text());
            if (!isNaN(iq) && iq < mOptions.questionsGame.length) {
                mOptions.questionsGame[iq].audio = $(this).attr('href');
                if (mOptions.questionsGame[iq].audio.length < 4) {
                    mOptions.questionsGame[iq].audio = '';
                }
            }
        });

        mOptions.questionsGame =
            $exeDevices.iDevice.gamification.helpers.getQuestions(
                mOptions.questionsGame,
                mOptions.percentajeQuestions
            );
        for (let i = 0; i < mOptions.questionsGame.length; i++) {
            mOptions.scoreTotal += 1;
        }
        const al = $exeDevices.iDevice.gamification.helpers.shuffleAds(
            mOptions.questionsGame
        );
        mOptions.questionsGame = mOptions.questionsRamdon
            ? al
            : mOptions.questionsGame;
        mOptions.numberQuestions = mOptions.questionsGame.length;
        return mOptions;
    },

    addEvents: function (instance) {
        $eXeIdentifica.removeEvents(instance);
        const mOptions = $eXeIdentifica.options[instance],
            $gameContainer = $(`#idfGameContainer-${instance}`),
            $gameMinimize = $(`#idfGameMinimize-${instance}`),
            $linkMaximize = $(`#idfLinkMaximize-${instance}`),
            $linkMinimize = $(`#idfLinkMinimize-${instance}`),
            $gamerOver = $(`#idfGamerOver-${instance}`),
            $codeAccessDiv = $(`#idfCodeAccessDiv-${instance}`),
            $cursor = $(`#idfCursor-${instance}`),
            $codeAccessButton = $(`#idfCodeAccessButton-${instance}`),
            $codeAccessE = $(`#idfCodeAccessE-${instance}`),
            $linkFullScreen = $(`#idfLinkFullScreen-${instance}`),
            $instructions = $(`#idfInstructions-${instance}`),
            $pNumber = $(`#idfPNumber-${instance}`),
            $questionDiv = $(`#idfQuestionDiv-${instance}`),
            $startGame = $(`#idfGameContainer-${instance} .IDFP-StartGame`),
            $instruction = $(`#idfInstruction-${instance}`),
            $showClue = $(`#idfShowClue-${instance}`),
            $feedBackClose = $(`#idfFeedBackClose-${instance}`),
            $linkAudio = $(`#idfLinkAudio-${instance}`),
            $gameContainerClue = $(`#idfGameContainer-${instance}`),
            $submit = $(`#idfSubmit-${instance}`),
            $answer = $(`#idfAnswer-${instance}`),
            $btnMoveOn = $(`#idfBtnMoveOn-${instance}`),
            $cardDraw = $(`#idfCardDraw-${instance}`),
            $useClue = $(`#idfUseClue-${instance}`),
            $messageClue = $(`#idfMessageClue-${instance}`),
            $startGameButton = $(`#idfStartGame-${instance}`);

        $(window).on(
            'unload.eXeIdentifica beforeunload.eXeIdentifica',
            function () {
                $exeDevices.iDevice.gamification.scorm.endScorm(
                    $eXeIdentifica.mScorm
                );
            }
        );

        $linkMaximize.on('click touchstart', function (e) {
            e.preventDefault();
            $gameContainer.show();
            $gameMinimize.hide();
            setTimeout(() => {
                $eXeIdentifica.showBackCard(
                    mOptions.questionsGame[mOptions.activeQuestion],
                    instance
                );
            }, 200);
        });

        $linkMinimize.on('click touchstart', function (e) {
            e.preventDefault();
            $gameContainer.hide();
            $gameMinimize.css('visibility', 'visible').show();
        });

        $('#idfMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $eXeIdentifica.sendScore(false, instance);
                $eXeIdentifica.saveEvaluation(instance);
            });

        $gamerOver.hide();
        $codeAccessDiv.hide();
        $cursor.hide();

        $codeAccessButton.on('click touchstart', function (e) {
            e.preventDefault();
            $eXeIdentifica.enterCodeAccess(instance);
        });

        $codeAccessE.on('keydown', function (event) {
            if (event.which === 13 || event.keyCode === 13) {
                $eXeIdentifica.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        $linkFullScreen.on('click touchstart', function (e) {
            e.preventDefault();
            const element = document.getElementById(
                `idfGameContainer-${instance}`
            );
            $exeDevices.iDevice.gamification.helpers.toggleFullscreen(element);
        });

        $instructions.text(mOptions.instructions);
        $pNumber.text(mOptions.numberQuestions);
        $startGame.show();
        $questionDiv.hide();

        if (mOptions.itinerary.showCodeAccess) {
            $(`#idfMesajeAccesCodeE-${instance}`).text(
                mOptions.itinerary.messageCodeAccess
            );
            $eXeIdentifica.showCubiertaOptions(0, instance);
        }

        $instruction.text(mOptions.instructions);

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        document.title = mOptions.title;
        $('meta[name=author]').attr('content', mOptions.author);
        $showClue.hide();
        mOptions.gameOver = false;
        $startGameButton.text(mOptions.msgs.msgPlayStart);

        $feedBackClose.on('click', function () {
            $eXeIdentifica.showCubiertaOptions(false, instance);
        });

        $linkAudio.on('click', function (e) {
            e.preventDefault();
            const audio = (
                mOptions.questionsGame[mOptions.activeQuestion].audio || ''
            ).trim();
            if (!audio || audio.length <= 4) return;
            $exeDevices.iDevice.gamification.media.stopSound(mOptions);
            $exeDevices.iDevice.gamification.media.playSound(audio, mOptions);
        });

        $gameContainerClue.on('click', '.IDFP-LinkClue', function (e) {
            e.preventDefault();
            if (!$(this).hasClass('IDFP-ActivoClue')) return;
            const num = parseInt($(this).data('number'), 10),
                $pulsados = $gameContainerClue.find(
                    `.IDFP-LinkClue[data-number='${num}']`
                ),
                message =
                    mOptions.questionsGame[mOptions.activeQuestion].clues[num];
            $pulsados.each(function () {
                $(this).attr('title', message);
            });
            mOptions.initGame = true;
            $messageClue
                .html(message)
                .fadeOut(400)
                .fadeIn(300)
                .fadeOut(400)
                .fadeIn(300);
            $exeDevices.iDevice.gamification.math.updateLatex(
                `idfGameContainer-${instance}`
            );
        });

        $submit.on('click', function (e) {
            e.preventDefault();
            const solution =
                    mOptions.questionsGame[mOptions.activeQuestion].solution,
                answer = $answer.val().trim();
            if (answer.length === 0) {
                $eXeIdentifica.showMessage(
                    0,
                    mOptions.msgs.msgAnswer,
                    instance
                );
                return;
            }
            const correct = $eXeIdentifica.checkWord(solution, answer);
            mOptions.initGame = true;
            $eXeIdentifica.answerWord(correct, instance);
        });

        $answer.on('keydown', function (event) {
            if (event.which === 13 || event.keyCode === 13) {
                const solution =
                        mOptions.questionsGame[mOptions.activeQuestion]
                            .solution,
                    answer = $answer.val().trim();
                if (answer.length === 0) {
                    $eXeIdentifica.showMessage(
                        0,
                        mOptions.msgs.msgAnswer,
                        instance
                    );
                    return true;
                }
                const correct = $eXeIdentifica.checkWord(solution, answer);
                $eXeIdentifica.answerWord(correct, instance);
                return false;
            }
            return true;
        });

        $btnMoveOn.on('click', function (e) {
            e.preventDefault();
            $eXeIdentifica.newQuestion(instance);
        });

        $cardDraw.on('click', function (e) {
            e.preventDefault();
            if (!mOptions.gameStarted) return;
            $messageClue.html(
                mOptions.questionsGame[mOptions.activeQuestion].question
            );
        });

        $useClue.on('click', function (e) {
            e.preventDefault();
            $eXeIdentifica.showClue(instance);
        });

        $useClue.hide();

        setTimeout(() => {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                this.isInExe
            );
        }, 500);
    },

    removeEvents: function (instance) {
        $(window).off('unload.eXeIdentifica beforeunload.eXeIdentifica');

        $(`#idfLinkMaximize-${instance}`).off('click touchstart');
        $(`#idfLinkMinimize-${instance}`).off('click touchstart');
        $('#idfMainContainer-' + instance)
            .closest('.idevice_node')
            .off('click', '.Games-SendScore');
        $(`#idfCodeAccessE-${instance}`).off('keydown');
        $(`#idfLinkFullScreen-${instance}`).off('click touchstart');
        $(`#idfFeedBackClose-${instance}`).off('click');
        $(`#idfLinkAudio-${instance}`).off('click');
        $(`#idfGameContainer-${instance}`).off('click', '.IDFP-LinkClue');
        $(`#idfSubmit-${instance}`).off('click');
        $(`#idfAnswer-${instance}`).off('keydown');
        $(`#idfBtnMoveOn-${instance}`).off('click');
        $(`#idfCardDraw-${instance}`).off('click');
        $(`#idfUseClue-${instance}`).off('click');
    },

    showClue(instance) {
        let mOptions = $eXeIdentifica.options[instance],
            numclues =
                mOptions.questionsGame[mOptions.activeQuestion].numberClues,
            clue =
                mOptions.questionsGame[mOptions.activeQuestion].clues[
                    mOptions.activeClue
                ],
            message = mOptions.msgs.msgUseClue;

        $pulsados = $('#idfGameContainer-' + instance).find(
            ".IDFP-LinkClue[data-number='" + mOptions.activeClue + "']"
        );
        $pulsados.each(function () {
            $(this)
                .find('.IDFP-Clue')
                .eq(0)
                .attr(
                    'src',
                    $eXeIdentifica.idevicePath + 'identificaPistaOpen.svg'
                );
            $(this).attr('title', clue);
            $(this).addClass('IDFP-ActivoClue');
            $(this).css('cursor', 'pointer');
        });

        $('#idfMessageClue-' + instance).html(clue);
        $('#idfMessageClue-' + instance)
            .fadeOut(400)
            .fadeIn(300)
            .fadeOut(400)
            .fadeIn(300);

        mOptions.pointsClue =
            mOptions.pointsQuestion -
            ((mOptions.activeClue + 1) * mOptions.pointsQuestion) /
                (mOptions.questionsGame[mOptions.activeQuestion].numberClues *
                    2);
        message = mOptions.msgs.msgUseClue.replace(
            '%s',
            mOptions.pointsClue.toFixed(2)
        );

        $('#idfPoints-' + instance).text(mOptions.pointsClue.toFixed(2));
        mOptions.activeClue++;
        $('#idfUseClue-' + instance).html(mOptions.msgs.msgShowNewClue);
        if (mOptions.activeClue >= numclues) {
            $('#idfUseClue-' + instance).hide();
            message = mOptions.msgs.msgUseAllClues.replace(
                '%s',
                mOptions.pointsClue.toFixed(2)
            );
            $('#idfUseClue-' + instance).html(mOptions.msgs.msgShowClue);
        }

        $eXeIdentifica.showMessage(0, message, instance);
        $exeDevices.iDevice.gamification.math.updateLatex(
            '#idfGameContainer-' + instance
        );
    },

    checkWord: function (word, answord) {
        let sWord = $.trim(word)
                .replace(/\s+/g, ' ')
                .replace(/\.$/, '')
                .replace(/,$/, '')
                .replace(/;$/, ''),
            sAnsWord = $.trim(answord)
                .replace(/\s+/g, ' ')
                .replace(/\.$/, '')
                .replace(/,$/, '')
                .replace(/;$/, '');
        sWord = $.trim(sWord).toLowerCase();
        sAnsWord = $.trim(sAnsWord).toLowerCase();
        if (sWord.indexOf('|') === -1) {
            return sWord === sAnsWord;
        }
        let words = sWord.split('|');
        for (let i = 0; i < words.length; i++) {
            const mword = $.trim(words[i])
                .replace(/\.$/, '')
                .replace(/,$/, '')
                .replace(/;$/, '');
            if (mword === sAnsWord) {
                return true;
            }
        }
        return false;
    },

    answerWord: function (correct, instance) {
        const mOptions = $eXeIdentifica.options[instance];
        let message;

        if (correct) {
            message = $eXeIdentifica.getMessageAnswer(true, instance);
            $eXeIdentifica.showMessage(2, message, instance);
            $eXeIdentifica.endQuestion(true, instance);
        } else {
            mOptions.attempts--;
            message =
                mOptions.attempts > 0
                    ? `${$eXeIdentifica.getRetroFeedMessages(false, instance)} ${mOptions.msgs.msgYouCanTryAgain}`
                    : $eXeIdentifica.getMessageAnswer(false, instance);
            $eXeIdentifica.showMessage(1, message, instance);
            if (mOptions.attempts <= 0) {
                $eXeIdentifica.endQuestion(false, instance);
            }
        }

        $(`#idfAttempts-${instance}`).text(mOptions.attempts);
        $(`#idfPoints-${instance}`).text(mOptions.pointsClue.toFixed(2));
        $(`#idfAnswer-${instance}`).val('');
    },

    endQuestion: function (respuesta, instance) {
        const mOptions = $eXeIdentifica.options[instance];

        if (!mOptions.gameActived) return;

        $(`#idfUseClue-${instance}`).hide();
        $eXeIdentifica.updateScore(respuesta, instance);
        mOptions.gameActived = false;

        let timeShowSolution = 1000;
        const percentageHits = (mOptions.hits / mOptions.numberQuestions) * 100;

        if (
            mOptions.itinerary.showClue &&
            percentageHits >= mOptions.itinerary.percentageClue &&
            !mOptions.obtainedClue
        ) {
            timeShowSolution = 5000;
            $(`#idfShowClue-${instance}`).show();
            $(`#idfPShowClue-${instance}`).text(
                `${mOptions.msgs.msgInformation}: ${mOptions.itinerary.clueGame}`
            );
            mOptions.obtainedClue = true;
        }

        if (mOptions.showSolution || respuesta) {
            $(`#idfBackImage-${instance}`).show();
            timeShowSolution = mOptions.timeShowSolution * 1000;
            const $cardInner = $(`#idfCardDraw-${instance}`)
                .find('.IDFP-card-inner')
                .eq(0);
            if (!$cardInner.hasClass('flipped')) {
                $cardInner.addClass('flipped');
            }
        }

        $(`#idfPAuthor-${instance}`).show();
        $(`#idfAnswer-${instance}`).prop('disabled', true).hide();
        $(`#idfSubmit-${instance}`).prop('disabled', true).hide().blur();
        $(`#idfBtnMoveOn-${instance}`).prop('disabled', true).hide();

        if (mOptions.isScorm === 1) {
            const score = mOptions.score.toFixed(2);
            $eXeIdentifica.sendScore(true, instance);
            $(`#idfRepeatActivity-${instance}`).text(
                `${mOptions.msgs.msgYouScore}: ${score}`
            );
        }

        $eXeIdentifica.saveEvaluation(instance);

        setTimeout(() => {
            $eXeIdentifica.newQuestion(instance);
        }, timeShowSolution);
    },

    refreshGame: function (instance) {
        const mOptions = $eXeIdentifica.options[instance];
        if (!mOptions) return;

        const mQuestion = mOptions.questionsGame[mOptions.activeQuestion];
        if (!mQuestion || mOptions.gameOver) return;

        $eXeIdentifica.positionPointerCard(instance);
    },

    positionPointerCard: function (instance) {
        const mOptions = $eXeIdentifica.options[instance],
            mQuestion = mOptions.questionsGame[mOptions.activeQuestion],
            $cursor = $(`#idfBackCursor-${instance}`);

        let x = parseFloat(mQuestion.x) || 0,
            y = parseFloat(mQuestion.y) || 0;

        $cursor.hide();

        if (x > 0 || y > 0) {
            const containerElement = document.getElementById(
                `idfImageContainerBack-${instance}`
            );
            const containerPos = containerElement.getBoundingClientRect();
            const imgElement = document.getElementById(
                    `idfBackImage-${instance}`
                ),
                imgPos = imgElement.getBoundingClientRect(),
                marginTop = imgPos.top - containerPos.top,
                marginLeft = imgPos.left - containerPos.left;

            x = marginLeft + x * imgPos.width;
            y = marginTop + y * imgPos.height;

            $cursor.css({ left: x, top: y, 'z-index': 20 }).show();
        }
    },

    enterCodeAccess: function (instance) {
        const mOptions = $eXeIdentifica.options[instance],
            codeInput = $(`#idfCodeAccessE-${instance}`)
                .val()
                .trim()
                .toLowerCase(),
            requiredCode = mOptions.itinerary.codeAccess.toLowerCase();

        if (codeInput === requiredCode) {
            $eXeIdentifica.showCubiertaOptions(false, instance);
            $(`#idfLinkMaximize-${instance}`).trigger('click');
        } else {
            $(`#idfMesajeAccesCodeE-${instance}`)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $(`#idfCodeAccessE-${instance}`).val('');
        }
    },

    showScoreGame: function (instance) {
        const mOptions = $eXeIdentifica.options[instance],
            msgs = mOptions.msgs,
            $idfHistGame = $('#idfHistGame-' + instance),
            $idfLostGame = $('#idfLostGame-' + instance),
            $idfOverPoint = $('#idfOverScore-' + instance),
            $idfOverHits = $('#idfOverHits-' + instance),
            $idfOverErrors = $('#idfOverErrors-' + instance),
            $idfShowClue = $('#idfShowClue-' + instance),
            $idfPShowClue = $('#idfPShowClue-' + instance),
            $idfGamerOver = $('#idfGamerOver-' + instance),
            $idfCardDraw = $('#idfCardDraw-' + instance);

        $idfHistGame.hide();
        $idfLostGame.hide();
        $idfOverPoint.show();
        $idfOverHits.show();
        $idfOverErrors.show();
        $idfShowClue.hide();
        $idfHistGame.show();

        if (mOptions.itinerary.showClue) {
            if (mOptions.obtainedClue) {
                $idfPShowClue.text(
                    msgs.msgInformation + ': ' + mOptions.itinerary.clueGame
                );
                $idfShowClue.show();
            } else {
                $idfPShowClue.text(
                    msgs.msgTryAgain.replace(
                        '%s',
                        mOptions.itinerary.percentageClue
                    )
                );
                $idfShowClue.show();
            }
        }

        const msscore = msgs.msgScore + ': ' + mOptions.score.toFixed(2);
        $idfOverPoint.html(msscore);
        $idfOverHits.html(msgs.msgHits + ': ' + mOptions.hits);
        $idfOverErrors.html(msgs.msgErrors + ': ' + mOptions.errors);
        $idfGamerOver.show();
        $idfCardDraw.hide();
    },

    startGame: function (instance) {
        let mOptions = $eXeIdentifica.options[instance];
        if (mOptions.gameStarted) return;

        mOptions.scoreGame = 0;
        mOptions.obtainedClue = false;

        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.activeClue = 0;
        mOptions.gameActived = false;
        mOptions.activeQuestion = -1;
        mOptions.validQuestions = mOptions.numberQuestions;
        mOptions.counter = 0;
        mOptions.gameStarted = false;
        mOptions.scoreQuestion = 10 / mOptions.questionsGame.length;

        $('#idfShowClue-' + instance).hide();
        $('#idfPShowClue-' + instance).text('');
        $('#idfGameContainer-' + instance + ' .IDFP-StartGame').hide();
        $('#idfPNumber-' + instance).text(mOptions.numberQuestions);
        $('#idfPHits-' + instance).text(mOptions.hits);
        $('#idfPErrors-' + instance).text(mOptions.errors);
        $('#idfPScore-' + instance).text(mOptions.score.toFixed(2));

        mOptions.gameStarted = true;
        $eXeIdentifica.newQuestion(instance);

        setTimeout(function () {
            const h = $('#idfMultimedia-' + instance).height() + 'px';
            $('#idfMultimedia-' + instance)
                .find('.IDFP-Left')
                .css({
                    height: h,
                });
            $('#idfMultimedia-' + instance)
                .find('.IDFP-Right')
                .css({
                    height: h,
                });
        }, 200);

        $eXeIdentifica.showMessage(3, mOptions.msgs.msgGameStarted, instance);
    },
    gameOver: function (instance) {
        let mOptions = $eXeIdentifica.options[instance];
        mOptions.gameStarted = false;
        $eXeIdentifica.showCluesLinks(0, instance);
        $('#idfLinkAudio-' + instance).hide();
        $exeDevices.iDevice.gamification.media.stopSound(mOptions);
        $('#idfCursor-' + instance).hide();

        let message = mOptions.msgs.msgGameEnd;
        $eXeIdentifica.showMessage(1, message, instance);
        $eXeIdentifica.showScoreGame(instance);

        $('#idfPNumber-' + instance).text('0');
        $('#idfAnswer-' + instance).hide();
        $('#idfSubmit-' + instance).hide();
        $('#idfBtnMoveOn-' + instance).hide();
        $('#idfMessageClue-' + instance).hide();
        $('#idfUseClue-' + instance).hide();

        if (mOptions.isScorm === 1) {
            const score = mOptions.score.toFixed(2);
            $eXeIdentifica.sendScore(true, instance);
            $('#idfRepeatActivity-' + instance).text(
                mOptions.msgs.msgYouScore + ': ' + score
            );
            $eXeIdentifica.initialScore = score;
        }

        $eXeIdentifica.saveEvaluation(instance);
        $eXeIdentifica.showFeedBack(instance);
    },

    showFeedBack: function (instance) {
        const mOptions = $eXeIdentifica.options[instance],
            puntos = (mOptions.hits * 100) / mOptions.questionsGame.length;
        if (mOptions.feedBack) {
            if (puntos >= mOptions.percentajeFB) {
                $('#idfDivFeedBack-' + instance)
                    .find('.identifica-feedback-game')
                    .show();
                $eXeIdentifica.showCubiertaOptions(1, instance);
            } else {
                $eXeIdentifica.showMessage(
                    1,
                    mOptions.msgs.msgTryAgain.replace(
                        '%s',
                        mOptions.percentajeFB
                    ),
                    instance
                );
            }
        }
    },

    showCluesLinks: function (numclues, instance) {
        const mOptions = $eXeIdentifica.options[instance],
            $clues = $('#idfGameContainer-' + instance).find('.IDFP-LinkClue'),
            img = $eXeIdentifica.idevicePath + 'identificaPistaA.svg';
        $clues.removeClass('IDFP-ActivoClue');
        $clues.hide();
        $clues.find('.IDFP-Clue').attr('src', img);

        $clues.each(function () {
            const mn = parseInt($(this).data('number'));
            if (mn < numclues) {
                $(this).fadeIn();
            }
            if (mOptions.avancedMode) {
                $(this).css({
                    cursor: 'default',
                });
                $(this).attr('title', 'Pista ' + (mn + 1));
            } else {
                const actimg =
                    $eXeIdentifica.idevicePath + 'identificaPistaOpen.svg';
                $(this).find('.IDFP-Clue').attr('src', actimg);
                $(this).css({
                    cursor: 'pointer',
                });
                $(this).addClass('IDFP-ActivoClue');
                $(this).attr(
                    'title',
                    mOptions.questionsGame[mOptions.activeQuestion].clues[mn]
                );
            }
        });
    },

    showBackCard: function (q, instance) {
        const $image = $('#idfBackImage-' + instance),
            $audio = $('#idfBackAudio-' + instance),
            $cursor = $('#idfBackCursor-' + instance);

        $audio.hide();
        $cursor.hide();
        const url =
            q.url.length > 3
                ? q.url
                : $eXeIdentifica.idevicePath + 'identificaHome.png';
        $image.attr('alt', q.alt);

        $image
            .prop('src', url)
            .on('load', function () {
                if (
                    !this.complete ||
                    typeof this.naturalWidth == 'undefined' ||
                    this.naturalWidth == 0
                ) {
                    $cursor.hide();
                } else {
                    $image.show();
                    $eXeIdentifica.positionPointerCard(instance);
                    return true;
                }
            })
            .on('error', function () {
                $cursor.hide();
            });
        $image.hide();
    },

    showQuestion: function (i, instance) {
        const mOptions = $eXeIdentifica.options[instance],
            q = mOptions.questionsGame[i];

        mOptions.gameActived = true;
        mOptions.question = q;
        mOptions.attempts = q.attempts;
        mOptions.activeClue = 0;
        mOptions.pointsQuestion = 10 / mOptions.questionsGame.length;
        mOptions.pointsClue = mOptions.pointsQuestion;

        $(`#idfCardDraw-${instance}`)
            .find('.IDFP-card-inner')
            .eq(0)
            .removeClass('flipped');
        $(`#idfAttempts-${instance}`).text(q.attempts);
        $(`#idfPoints-${instance}`).text(mOptions.pointsClue.toFixed(2));
        $(`#idfUseClue-${instance}`).text(mOptions.msgs.msgShowClue);

        if (mOptions.isScorm === 1 && mOptions.initGame) {
            const score = mOptions.score.toFixed(2);
            $eXeIdentifica.sendScore(true, instance);
            $(`#idfRepeatActivity-${instance}`).text(
                `${mOptions.msgs.msgYouScore}: ${score}`
            );
        }

        $exeDevices.iDevice.gamification.media.stopSound(mOptions);
        const hasAudio = q.audio && q.audio.trim().length > 4;
        if (hasAudio) {
            $(`#idfLinkAudio-${instance}`).show();
        } else {
            $(`#idfLinkAudio-${instance}`).hide();
        }

        $(`#idfMessageClue-${instance}`).html(q.question);
        $(`#idfPAuthor-${instance}`).html(q.author);
        $eXeIdentifica.showCluesLinks(q.numberClues, instance);
        $eXeIdentifica.showMessage(0, '', instance);

        const html = $(`#idfGameContainer-${instance}`).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);

        if (latex) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                `idfGameContainer-${instance}`
            );
        }

        setTimeout(() => {
            $eXeIdentifica.showBackCard(q, instance);
        }, 1000);

        if (mOptions.avancedMode) {
            $(`#idfUseClue-${instance}`).show();
        }
    },

    newQuestion: function (instance) {
        const mOptions = $eXeIdentifica.options[instance],
            mActiveQuestion = $eXeIdentifica.updateNumberQuestion(
                mOptions.activeQuestion,
                instance
            );

        if (mActiveQuestion === null) {
            $(`#idfPNumber-${instance}`).text('0');
            $eXeIdentifica.gameOver(instance);
        } else {
            $eXeIdentifica.showQuestion(mActiveQuestion, instance);
            mOptions.activeCounter = true;
            const numQ = mOptions.numberQuestions - mActiveQuestion;
            $(`#idfPNumber-${instance}`).text(numQ);
            $(`#idfAnswer-${instance}`).prop('disabled', false).show();
            $(`#idfSubmit-${instance}`).prop('disabled', false).show();
            $(`#idfBtnMoveOn-${instance}`).prop('disabled', false).show();
        }
    },

    updateNumberQuestion: function (numq, instance) {
        const mOptions = $eXeIdentifica.options[instance],
            numActiveQuestion = numq + 1;

        if (numActiveQuestion >= mOptions.numberQuestions) return null;

        mOptions.activeQuestion = numActiveQuestion;
        return numActiveQuestion;
    },

    getRetroFeedMessages: function (hit, instance) {
        const msgs = $eXeIdentifica.options[instance].msgs;
        let sMessages = hit ? msgs.msgSuccesses : msgs.msgFailures;
        sMessages = sMessages.split('|');
        return sMessages[Math.floor(Math.random() * sMessages.length)];
    },

    updateScore: function (correctAnswer, instance) {
        const mOptions = $eXeIdentifica.options[instance];

        if (correctAnswer) {
            mOptions.hits++;
            mOptions.score += mOptions.pointsClue;
        } else {
            mOptions.errors++;
        }

        const sscore = mOptions.score.toFixed(2);
        $(`#idfPScore-${instance}`).text(sscore);
        $(`#idfPHits-${instance}`).text(mOptions.hits);
        $(`#idfPErrors-${instance}`).text(mOptions.errors);
    },

    getMessageAnswer: function (correctAnswer, instance) {
        const mOptions = $eXeIdentifica.options[instance];
        let message = '';
        const q = mOptions.questionsGame[mOptions.activeQuestion];

        if (correctAnswer) {
            message = $eXeIdentifica.getMessageCorrectAnswer(instance);
        } else {
            message = $eXeIdentifica.getMessageErrorAnswer(instance);
        }

        if (mOptions.showSolution && q.typeQuestion === 1) {
            message += `: ${q.solution}`;
        }

        if (mOptions.showSolution) {
            message += `. ${mOptions.msgs.msgCorrectAnswer} ${q.solution}`;
        }

        return message;
    },

    getMessageCorrectAnswer: function (instance) {
        const mOptions = $eXeIdentifica.options[instance],
            messageCorrect = $eXeIdentifica.getRetroFeedMessages(
                true,
                instance
            );

        let message = '';
        if (
            mOptions.customMessages &&
            mOptions.questionsGame[mOptions.activeQuestion].msgHit.length > 0
        ) {
            message =
                mOptions.questionsGame[mOptions.activeQuestion].msgHit +
                ' ' +
                mOptions.pointsClue.toFixed(2) +
                ' ' +
                mOptions.msgs.msgPoints;
        } else {
            message =
                messageCorrect +
                ' ' +
                mOptions.pointsClue.toFixed(2) +
                ' ' +
                mOptions.msgs.msgPoints;
        }
        return message;
    },

    getMessageErrorAnswer: function (instance) {
        const mOptions = $eXeIdentifica.options[instance],
            messageError = $eXeIdentifica.getRetroFeedMessages(false, instance),
            question = mOptions.questionsGame[mOptions.activeQuestion],
            message =
                mOptions.customMessages && question.msgError.length > 0
                    ? question.msgError
                    : messageError;
        return message;
    },

    showMessage: function (type, message, instance) {
        const colors = [
            '#555555',
            $eXeIdentifica.borderColors.red,
            $eXeIdentifica.borderColors.green,
            $eXeIdentifica.borderColors.blue,
            $eXeIdentifica.borderColors.yellow,
        ];
        const mcolor = colors[type];
        $(`#idfMessageAnswer-${instance}`)
            .text(message)
            .css({
                color: mcolor,
                'font-weight': 'normal',
            })
            .show();
    },

    drawImage: function (image, mData) {
        $(image).css({
            left: `${mData.x}px`,
            top: `${mData.y}px`,
            width: `${mData.w}px`,
            height: `${mData.h}px`,
        });
    },

    placeImageWindows: function (image, naturalWidth, naturalHeight) {
        const $parent = $(image).parent(),
            wDiv = $parent.width() || 1,
            hDiv = $parent.height() || 1,
            varW = naturalWidth / wDiv,
            varH = naturalHeight / hDiv;
        let wImage = wDiv,
            hImage = hDiv,
            xImage = 0,
            yImage = 0;

        if (varW > varH) {
            wImage = parseInt(wDiv, 10);
            hImage = parseInt(naturalHeight / varW, 10);
            yImage = parseInt((hDiv - hImage) / 2, 10);
        } else {
            wImage = parseInt(naturalWidth / varH, 10);
            hImage = parseInt(hDiv, 10);
            xImage = parseInt((wDiv - wImage) / 2, 10);
        }

        return {
            w: wImage,
            h: hImage,
            x: xImage,
            y: yImage,
        };
    },

    saveEvaluation: function (instance) {
        const mOptions = $eXeIdentifica.options[instance];
        mOptions.scorerp = mOptions.score;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $eXeIdentifica.isInExe
        );
    },

    sendScore: function (auto, instance) {
        const mOptions = $eXeIdentifica.options[instance];

        mOptions.scorerp = mOptions.score;
        mOptions.previousScore = $eXeIdentifica.previousScore;
        mOptions.userName = $eXeIdentifica.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $eXeIdentifica.previousScore = mOptions.previousScore;
    },
};
$(function () {
    $eXeIdentifica.init();
});
