/* eslint-disable no-undef */
/**
 * Hidden Image Activity iDevice (export code)
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */

var $eXeHiddenImage = {
    idevicePath: '',
    borderColors: {
        black: '#1c1b1b',
        blue: '#5877c6',
        green: '#137575',
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
        green: '#137575',
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
    _imgResizeObservers: {},
    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            'Hidden Image',
            'hidden-image',
            'hiddenimage-IDevice'
        );
    },

    enable: function () {
        $eXeHiddenImage.loadGame();
    },

    loadGame: function () {
        $eXeHiddenImage.options = [];
        $eXeHiddenImage.activities.each(function (i) {
            const version = $('.hiddenimage-version', this).eq(0).text(),
                dl = $('.hiddenimage-DataGame', this),
                imagesLink = $('.hiddenimage-LinkImages', this),
                audioLink = $('.hiddenimage-LinkAudios', this),
                mOption = $eXeHiddenImage.loadDataGame(
                    dl,
                    imagesLink,
                    audioLink,
                    version
                ),
                msg = mOption.msgs.msgPlayStart;

            mOption.scorerp = 0;
            mOption.idevicePath = $eXeHiddenImage.idevicePath;
            mOption.main = 'hiPMainContainer-' + i;
            mOption.idevice = 'hiddenimage-IDevice';

            $eXeHiddenImage.options.push(mOption);

            const hiP = $eXeHiddenImage.createInterfacehiP(i);
            dl.before(hiP).remove();
            $('#hiPGameMinimize-' + i).hide();
            $('#hiPGameContainer-' + i).hide();

            if (mOption.showMinimize) {
                $('#hiPGameMinimize-' + i)
                    .css({ cursor: 'pointer' })
                    .show();
            } else {
                $('#hiPGameContainer-' + i).show();
            }

            $('#hiPMessageMaximize-' + i).text(msg);

            $eXeHiddenImage.addEvents(i);
        });

        $exeDevices.iDevice.gamification.math.updateLatex(
            '.hiddenimage-IDevice'
        );
    },

    refreshGame: function (instance) {
        const mOptions = $eXeHiddenImage.options[instance];
        if (mOptions && !mOptions.gameOver && mOptions.gameStarted) {
            $eXeHiddenImage.scheduleReflow(instance);
        }
    },

    scheduleReflow: function (instance) {
        const doPass = () => {
            $eXeHiddenImage.updateOverlaySize(instance);
            $eXeHiddenImage.createSquares(instance);
        };
        doPass();
        if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(() => {
                doPass();
                requestAnimationFrame(() => {
                    doPass();
                });
            });
        }
        setTimeout(doPass, 200);
    },

    updateOverlaySize: function (instance) {
        const $img = $('#hiPImage-' + instance);
        const $overlay = $('#hipOverlay-' + instance);
        if (!$img.length || !$overlay.length) return;
        const imgEl = $img.get(0);
        const overlayParent = $overlay.parent();
        if (!imgEl || !overlayParent.length) return;
        const imgRect = imgEl.getBoundingClientRect();
        const parentRect = overlayParent.get(0).getBoundingClientRect();

        const w = Math.round(imgRect.width);
        const h = Math.round(imgRect.height);
        const left = Math.round(imgRect.left - parentRect.left);
        const top = Math.round(imgRect.top - parentRect.top);

        if (w > 0 && h > 0) {
            const pos = overlayParent.css('position');
            if (!pos || pos === 'static') {
                overlayParent.css('position', 'relative');
            }
            $overlay.css({
                position: 'absolute',
                width: w + 'px',
                height: h + 'px',
                left: left + 'px',
                top: top + 'px',
                'z-index': 2,
            });
        }
    },

    createInterfacehiP: function (instance) {
        const path = $eXeHiddenImage.idevicePath,
            msgs = $eXeHiddenImage.options[instance].msgs,
            mOptions = $eXeHiddenImage.options[instance],
            html = `
            <div class="HIP-MainContainer" id="hiPMainContainer-${instance}">
                <div class="HIP-GameMinimize" id="hiPGameMinimize-${instance}">
                    <a href="#" class="HIP-LinkMaximize" id="hiPLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                        <img src="${path}hidden-image-icon.png" class="HIP-IconMinimize HIP-Activo" alt="">
                        <div class="HIP-MessageMaximize" id="hiPMessageMaximize-${instance}"></div>
                    </a>
                </div>
                <div class="HIP-GameContainer" id="hiPGameContainer-${instance}">
                    <div class="HIP-GameScoreBoard">
                        <div class="HIP-GameScores">
                            <div class="exeQuextIcons exeQuextIcons-Number" title="${msgs.msgNumQuestions}"></div>
                            <p><span class="sr-av">${msgs.msgNumQuestions}: </span><span id="hiPNumber-${instance}">0</span></p>
                            <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                            <p><span class="sr-av">${msgs.msgHits}: </span><span id="hiPHits-${instance}">0</span></p>
                            <div class="exeQuextIcons exeQuextIcons-Error" title="${msgs.msgErrors}"></div>
                            <p><span class="sr-av">${msgs.msgErrors}: </span><span id="hiPErrors-${instance}">0</span></p>
                            <div class="exeQuextIcons exeQuextIcons-Score" title="${msgs.msgScore}"></div>
                            <p><span class="sr-av">${msgs.msgScore}: </span><span id="hiPScore-${instance}">0</span></p>
                        </div>
                        <div class="HIP-TimeNumber">
                            <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Time" title="${msgs.msgTime}"></div>
                            <p id="hiPTime-${instance}" class="HIP-PTime">00:00</p>
                            <a href="#" class="HIP-LinkMinimize" id="hiPLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                                <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                                <div class="exeQuextIcons exeQuextIcons-Minimize HIP-Activo"></div>
                            </a>
                            <a href="#" class="HIP-LinkFullScreen" id="hiPLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                                <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                                <div class="exeQuextIcons exeQuextIcons-FullScreen HIP-Activo" id="hiPFullScreen-${instance}"></div>
                            </a>
                        </div>
                    </div>
                    <div class="HIP-ShowClue" id="hiPShowClueDiv-${instance}">
                        <div class="sr-av">${msgs.msgClue}:</div>
                        <div class="HIP-PShowClue HIP-parpadea" id="hiPShowClue-${instance}"></div>
                    </div>                    
                     <div class="HIP-Message" id="hiPMessageDiv-${instance}">
                        <p id="hiPMessage-${instance}"></p>
                    </div>
                     <div class="HIP-StartGame"><a href="#" id="hiPStartGame-${instance}"></a></div> 
                    ${$eXeHiddenImage.getGameHtml(instance)}
                    ${$eXeHiddenImage.getHome(instance)}
                    <div class="HIP-AuthorLicence" id="hiPAuthorLicence-${instance}">
                        <div class="sr-av">${msgs.msgAuthor}:</div>
                        <p id="hiPAuthor-${instance}"></p>
                    </div>                                     
                </div>
                <div class="HIP-Cubierta" id="hiPCubierta-${instance}" style="display:none">
                    <div class="HIP-CodeAccessDiv" id="hiPCodeAccessDiv-${instance}">
                        <p class="HIP-MessageCodeAccessE" id="hiPMesajeAccesCodeE-${instance}"></p>
                        <div class="HIP-DataCodeAccessE">
                            <label class="sr-av">${msgs.msgCodeAccess}:</label>
                            <input type="text" class="HIP-CodeAccessE form-control" id="hiPCodeAccessE-${instance}" placeholder="${msgs.msgCodeAccess}">
                            <a href="#" id="hiPCodeAccessButton-${instance}" title="${msgs.msgSubmit}">
                                <strong><span class="sr-av">${msgs.msgSubmit}</span></strong>
                                <div class="exeQuextIcons exeQuextIcons-Submit HIP-Activo"></div>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}
        `;
        return html;
    },
    getGameHtml: function (instance) {
        const mOptions = $eXeHiddenImage.options[instance],
            path = $eXeHiddenImage.idevicePath,
            msgs = mOptions.msgs,
            html = `<div class="HIP-Container" id="hiPContainer-${instance}">
        <div class="HIP-Content">
            <div class="HIP-LeftPanel">
                <div id="hiPLeftContainer" class="HIP-LefContainer">
                    <img id="hiPImage-${instance}" class="HIP-GameImage" src=""
                        alt="Imagen a descubrir">
                    <a href="#" class="HIP-LinkAudio" id="hiPLinkAudio-${instance}" title="${msgs.msgAudio}">
                        <img src="${path}exequextaudio.png" class="HIP-Activo" alt="${msgs.msgAudio}">
                    </a>
                    <div id="hipOverlay-${instance}" class="HIP-Overlay"></div>
                </div>
            </div>
            <div class="HIP-RghtPanel">
                <div class="HIP-QuestionDiv" id="hiPQuestionDiv-${instance}">
                    <div class="sr-av">${msgs.msgQuestion}:</div>
                    <p class="HIP-Question" id="hiPQuestion-${instance}"></p>   
                </div>
                <div class="HIP-OptionsDiv" id="hiPOptionsDiv-${instance}">
                    <div class="sr-av">${msgs.msgOption} A:</div>
                    <a href="#" class="HIP-Option1 HIP-Options" id="hiPOption1-${instance}" data-number="0"></a>
                    <div class="sr-av">${msgs.msgOption} B:</div>
                    <a href="#" class="HIP-Option2 HIP-Options" id="hiPOption2-${instance}" data-number="1"></a>
                    <div class="sr-av">${msgs.msgOption} C:</div>
                    <a href="#" class="HIP-Option3 HIP-Options" id="hiPOption3-${instance}" data-number="2"></a>
                    <div class="sr-av">${msgs.msgOption} D:</div>
                    <a href="#" class="HIP-Option4 HIP-Options" id="hiPOption4-${instance}" data-number="3"></a>
                </div>
                    
            </div>
        </div>
    </div>`;
        return html;
    },
    getHome: function (instance) {
        const mOptions = $eXeHiddenImage.options[instance],
            path = $eXeHiddenImage.idevicePath,
            msgs = mOptions.msgs,
            html = `<div class="HIP-Home" id="hiPHome-${instance}">
                <a href="#" id="hiPStartGameImage-${instance}">
                    <img src="${path}hidden-image-icon.png" alt="${msgs.msgPlayStart}">  
                </a>                               
            </div>`;
        return html;
    },

    showCubiertaOptions: function (mode, instance) {
        if (mode === false) {
            $('#hiPCubierta-' + instance).fadeOut();
            return;
        }
        $('#hiPCubierta-' + instance).fadeIn();
    },

    loadDataGame: function (data, imgsLink, audioLink, version) {
        let json = data.text();
        version =
            typeof version === 'undefined' || version === ''
                ? 0
                : parseInt(version, 10);

        if (version > 0)
            json = $exeDevices.iDevice.gamification.helpers.decrypt(json);

        let mOptions =
            $exeDevices.iDevice.gamification.helpers.isJsonString(json);

        mOptions.gameOver = false;
        mOptions.gameStarted = false;
        mOptions.percentajeQuestions =
            typeof mOptions.percentajeQuestions !== 'undefined'
                ? mOptions.percentajeQuestions
                : 100;

        for (let i = 0; i < mOptions.questionsGame.length; i++) {
            const question = mOptions.questionsGame[i];
            question.audio =
                typeof question.audio === 'undefined' ? '' : question.audio;
            question.url = $exeDevices.iDevice.gamification.media.extractURLGD(
                question.url
            );
            if (
                typeof question.attempts !== 'number' ||
                isNaN(question.attempts) ||
                question.attempts <= 0
            ) {
                question.attempts = 4;
            }
        }
        mOptions.scoreGame = 0;
        mOptions.scoreTotal = 0;
        mOptions.playerAudio = '';
        mOptions.customMessages =
            typeof mOptions.customMessages !== 'undefined'
                ? mOptions.customMessages
                : false;
        mOptions.evaluation =
            typeof mOptions.evaluation !== 'undefined'
                ? mOptions.evaluation
                : false;
        mOptions.evaluationID =
            typeof mOptions.evaluationID !== 'undefined'
                ? mOptions.evaluationID
                : '';
        mOptions.id = typeof mOptions.id !== 'undefined' ? mOptions.id : false;

        mOptions.revealTime =
            mOptions.revealTime == 0 ? 10000000000 : mOptions.revealTime * 1000;

        imgsLink.each(function () {
            const iq = parseInt($(this).text(), 10);
            if (!isNaN(iq) && iq < mOptions.questionsGame.length) {
                const question = mOptions.questionsGame[iq];
                question.url = $(this).attr('href');
                if (question.url.length < 4) {
                    question.url = '';
                }
            }
        });

        audioLink.each(function () {
            const iq = parseInt($(this).text(), 10);
            if (!isNaN(iq) && iq < mOptions.questionsGame.length) {
                const question = mOptions.questionsGame[iq];
                question.audio = $(this).attr('href');
                if (question.audio.length < 4) {
                    question.audio = '';
                }
            }
        });
        mOptions.questionsGame =
            mOptions.percentajeQuestions < 100
                ? $exeDevices.iDevice.gamification.helpers.getQuestions(
                      mOptions.questionsGame,
                      mOptions.percentajeQuestions
                  )
                : mOptions.questionsGame;

        if (mOptions.optionsRamdon) {
            mOptions.questionsGame =
                $exeDevices.iDevice.gamification.helpers.shuffleAds(
                    mOptions.questionsGame
                );
        }

        mOptions.numberQuestions = mOptions.questionsGame.length;

        return mOptions;
    },

    addEvents: function (instance) {
        const mOptions = $eXeHiddenImage.options[instance];
        $eXeHiddenImage.removeEvents(instance);

        $(window).on('unload.eXehiP beforeunload.eXehiP', () => {
            $exeDevices.iDevice.gamification.scorm.endScorm(
                $eXeHiddenImage.mScorm
            );
        });

        $('#hiPLinkMaximize-' + instance).on('click touchstart', (e) => {
            e.preventDefault();
            $('#hiPGameContainer-' + instance).show();
            $('#hiPGameMinimize-' + instance).hide();
            $eXeHiddenImage.refreshGame(instance);
        });

        $('#hiPLinkMinimize-' + instance).on('click touchstart', (e) => {
            e.preventDefault();
            $('#hiPGameContainer-' + instance).hide();
            $('#hiPGameMinimize-' + instance)
                .css('visibility', 'visible')
                .show();
            return true;
        });

        $('#hiPMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $eXeHiddenImage.sendScore(false, instance);
                $eXeHiddenImage.saveEvaluation(instance);
                return true;
            });

        $('#hiPGamerOver-' + instance).hide();
        $('#hiPCodeAccessDiv-' + instance).hide();
        $('#hiPCover-' + instance).show();

        $('#hiPCodeAccessButton-' + instance).on('click touchstart', (e) => {
            e.preventDefault();
            $eXeHiddenImage.enterCodeAccess(instance);
        });

        $('#hiPCodeAccessE-' + instance).on('keydown', function (event) {
            if (event.which === 13 || event.keyCode === 13) {
                $eXeHiddenImage.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        $('#hiPOptionsDiv-' + instance).on(
            'click touchstart',
            '.HIP-Options',
            function (e) {
                e.preventDefault();
                const respuesta = $(this).data('number');
                $eXeHiddenImage.answerQuestion(respuesta, instance);
            }
        );

        $('#hiPLinkFullScreen-' + instance).on('click touchstart', (e) => {
            e.preventDefault();
            const element = document.getElementById(
                'hiPGameContainer-' + instance
            );
            $exeDevices.iDevice.gamification.helpers.toggleFullscreen(element);
        });

        $('#hiPInstructions-' + instance).text(mOptions.instructions);
        $('#hiPNumber-' + instance).text(mOptions.numberQuestions);
        $('#hiPGameContainer-' + instance + ' .HIP-StartGame').show();

        if (mOptions.itinerary.showCodeAccess) {
            $('#hiPMesajeAccesCodeE-' + instance).text(
                mOptions.itinerary.messageCodeAccess
            );
            $('#hiPCodeAccessDiv-' + instance).show();
            $('#hiPGameContainer-' + instance + ' .HIP-StartGame').hide();
            $eXeHiddenImage.showCubiertaOptions(true, instance);
        }

        $('#hiPInstruction-' + instance).text(mOptions.instructions);
        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        $('#hiPShowClue-' + instance).hide();
        mOptions.gameOver = false;

        $('#hiPStartGame-' + instance)
            .text(mOptions.msgs.msgPlayStart)
            .on('click', (e) => {
                e.preventDefault();
                $eXeHiddenImage.startGame(instance);
            });

        $('#hiPStartGameImage-' + instance).on('click', (e) => {
            e.preventDefault();
            $eXeHiddenImage.startGame(instance);
        });

        $('#hiPLinkAudio-' + instance).on('click', (e) => {
            e.preventDefault();
            const audio = mOptions.questionsGame[mOptions.activeQuestion].audio;
            $exeDevices.iDevice.gamification.media.stopSound(mOptions);
            if (audio && audio.length > 3) {
                $exeDevices.iDevice.gamification.media.playSound(
                    audio,
                    mOptions
                );
            }
        });

        const gameContainer = document.querySelector(
            '#hiPGameContainer-' + instance
        );

        gameContainer.addEventListener('fullscreenchange', () => {
            if (document.fullscreenElement === gameContainer) {
                gameContainer.classList.add('is-fullscreen');
            } else {
                gameContainer.classList.remove('is-fullscreen');
            }
        });

        setTimeout(() => {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                this.isInExe
            );
        }, 500);

        $(document).on('click', '.HIP-Square', function () {
            if (mOptions.attempts <= 0) {
                $eXeHiddenImage.showMessage(
                    3,
                    mOptions.msgs.msgattempts0,
                    instance
                );
                return;
            }
            var $this = $(this);
            $this.fadeOut(200, function () {
                setTimeout(function () {
                    $this.fadeIn(200);
                }, mOptions.revealTime);
            });
            mOptions.attempts = mOptions.attempts - 1;

            if (mOptions.attempts > 0) {
                let message = mOptions.msgs.msgCardClick.replace(
                    '%s',
                    mOptions.attempts
                );
                $eXeHiddenImage.showMessage(0, message, instance);
            } else {
                $eXeHiddenImage.showMessage(
                    3,
                    mOptions.msgs.msgattempts0,
                    instance
                );
            }
        });
        $(window).on('resize', () => {
            $eXeHiddenImage.scheduleReflow(instance);
        });

        $(document).on(
            'fullscreenchange webkitfullscreenchange mozfullscreenchange MSFullscreenChange',
            () => {
                $eXeHiddenImage.scheduleReflow(instance);
            }
        );
        $eXeHiddenImage.setupImageResizeObserver(instance);
    },

    removeEvents: function (instance) {
        $(window).off('unload.eXehiP beforeunload.eXehiP');

        $('#hiPLinkMaximize-' + instance).off('click touchstart');
        $('#hiPLinkMinimize-' + instance).off('click touchstart');
        $('#hiPMainContainer-' + instance)
            .closest('.idevice_node')
            .off('click', '.Games-SendScore');
        $('#hiPCodeAccessButton-' + instance).off('click touchstart');
        $('#hiPCodeAccessE-' + instance).off('keydown');
        $('#hiPOptionsDiv-' + instance).off('click touchstart', '.HIP-Options');
        $('#hiPLinkFullScreen-' + instance).off('click touchstart');
        $('#hiPStartGame-' + instance).off('click');
        $('#hiPLinkAudio-' + instance).off('click');

        const obs = $eXeHiddenImage._imgResizeObservers[instance];
        if (obs) {
            try {
                obs.disconnect();
            } catch (e) {}
            delete $eXeHiddenImage._imgResizeObservers[instance];
        }
    },

    enterCodeAccess: function (instance) {
        const mOptions = $eXeHiddenImage.options[instance],
            enteredCode = $('#hiPCodeAccessE-' + instance)
                .val()
                .toLowerCase(),
            accessCode = mOptions.itinerary.codeAccess.toLowerCase();

        if (accessCode === enteredCode) {
            $eXeHiddenImage.showCubiertaOptions(false, instance);
            $eXeHiddenImage.startGame(instance);
            $('#hiPLinkMaximize-' + instance).trigger('click');
        } else {
            $('#hiPMesajeAccesCodeE-' + instance)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $('#hiPCodeAccessE-' + instance).val('');
        }
    },

    setupImageResizeObserver: function (instance) {
        const img = document.getElementById('hiPImage-' + instance);
        if (!img || typeof ResizeObserver === 'undefined') return;
        if ($eXeHiddenImage._imgResizeObservers[instance]) return;
        const ro = new ResizeObserver(() => {
            $eXeHiddenImage.scheduleReflow(instance);
        });
        try {
            ro.observe(img);
            $eXeHiddenImage._imgResizeObservers[instance] = ro;
        } catch (e) {
            //
        }
    },

    startGame: function (instance) {
        const mOptions = $eXeHiddenImage.options[instance];

        if (mOptions.gameStarted) return;

        mOptions.scoreGame = 0;
        mOptions.obtainedClue = false;
        $('#hiPShowClue-' + instance)
            .hide()
            .text('');
        $('#hiPGameContainer-' + instance + ' .HIP-StartGame').hide();
        $('#hiPQuestionDiv-' + instance).show();
        $('#hiPQuestion-' + instance).text('');
        $('#hiPHome-' + instance).hide();
        $('#hiPContainer-' + instance).css('display', 'flex');

        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.gameActived = false;
        mOptions.activeQuestion = -1;
        mOptions.validQuestions = mOptions.numberQuestions;

        $('#hiPNumber-' + instance).text(mOptions.numberQuestions);

        mOptions.counterClock = setInterval(() => {
            if (mOptions.gameStarted && mOptions.activeCounter) {
                let $node = $('#hiPMainContainer-' + instance);
                let $content = $('#node-content');
                if (
                    !$node.length ||
                    ($content.length && $content.attr('mode') === 'edition')
                ) {
                    clearInterval(mOptions.counterClock);
                    return;
                }
                mOptions.counter--;
                $eXeHiddenImage.uptateTime(mOptions.counter, instance);
                if (mOptions.counter <= 0) {
                    mOptions.activeCounter = false;
                    $eXeHiddenImage.answerQuestion(false, instance);
                    $eXeHiddenImage.showMessage(
                        1,
                        mOptions.msgs.msgEndTime,
                        instance
                    );
                }
            }
        }, 1000);

        mOptions.gameStarted = true;
        $eXeHiddenImage.uptateTime(0, instance);
        $('#hiPGamerOver-' + instance).hide();
        $('#hiPHits-' + instance).text(mOptions.hits);
        $('#hiPErrors-' + instance).text(mOptions.errors);
        $('#hiPScore-' + instance).text(mOptions.score);
        $eXeHiddenImage.saveEvaluation(instance);
        $eXeHiddenImage.newQuestion(instance);
    },

    uptateTime: function (time, instance) {
        const mTime =
            $exeDevices.iDevice.gamification.helpers.getTimeToString(time);
        $('#hiPTime-' + instance).text(mTime);
    },

    gameOver: function (type, instance) {
        const mOptions = $eXeHiddenImage.options[instance];
        const msgs = mOptions.msgs;

        mOptions.gameStarted = false;
        mOptions.gameActived = false;
        const score = (
            (mOptions.hits * 10) /
            mOptions.questionsGame.length
        ).toFixed(2);

        clearInterval(mOptions.counterClock);
        $('#hiPHome-' + instance).css('display', 'flex');
        $('#hiPContainer-' + instance).hide();
        $exeDevices.iDevice.gamification.media.stopSound(mOptions);

        const typem = parseInt(score) >= 5 ? 2 : 1;
        const message = msgs.msgGameOver.replace('%s', score);
        $eXeHiddenImage.showMessage(typem, message, instance);
        $eXeHiddenImage.clearQuestions(instance);
        $('#hiPNumber-' + instance).text('0');
        $('#hiPStartGame-' + instance).text(mOptions.msgs.msgNewGame);
        $('#hiPGameContainer-' + instance + ' .HIP-StartGame').show();

        mOptions.gameOver = true;

        if (mOptions.isScorm > 0) {
            $eXeHiddenImage.sendScore(true, instance);
        }
        $eXeHiddenImage.saveEvaluation(instance);
    },

    showQuestion: function (i, instance) {
        const mOptions = $eXeHiddenImage.options[instance],
            mQuestion = mOptions.questionsGame[i];

        mOptions.activeQuestion = i;
        mOptions.gameActived = true;
        mOptions.question = mQuestion;

        if (mOptions.answersRamdon) {
            $eXeHiddenImage.ramdonOptions(instance);
        }

        $('#hiPQuestion-' + instance).html(mQuestion.question);
        $('#hiPLinkAudio-' + instance).hide();
        $eXeHiddenImage.showAuthor('', instance);

        mOptions.attempts = mQuestion.attempts;
        let message = mOptions.msgs.msgCardClick.replace(
            '%s',
            mOptions.attempts
        );
        $eXeHiddenImage.showMessage(0, message, instance);

        if (mOptions.isScorm > 0) {
            $eXeHiddenImage.sendScore(true, instance);
        }

        $eXeHiddenImage.showImageNeo(mQuestion.url, instance);

        if (mQuestion.audio.length > 4) {
            $('#hiPLinkAudio-' + instance).show();
        }
        $exeDevices.iDevice.gamification.media.stopSound(mOptions);
        $eXeHiddenImage.drawQuestions(instance);

        const html = $('#hiPQuestionDiv-' + instance).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);

        if (latex) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '#hiPQuestionDiv-' + instance
            );
        }
        const audio = mOptions.questionsGame[i].audio;
        if (audio && audio.length > 4) {
            $exeDevices.iDevice.gamification.media.playSound(audio, mOptions);
        }
    },

    ramdonOptions: function (instance) {
        let mOptions = $eXeHiddenImage.options[instance],
            arrayRamdon = mOptions.question.options.slice(
                0,
                mOptions.question.numberOptions
            ),
            sSolution = mOptions.question.options[mOptions.question.solution];
        arrayRamdon =
            $exeDevices.iDevice.gamification.helpers.shuffleAds(arrayRamdon);
        mOptions.question.options = [];
        for (let i = 0; i < 4; i++) {
            if (i < arrayRamdon.length) {
                mOptions.question.options.push(arrayRamdon[i]);
            } else {
                mOptions.question.options.push('');
            }
            if (mOptions.question.options[i] == sSolution) {
                mOptions.question.solution = i;
            }
        }
    },

    showImageNeo: function (url, instance) {
        const mOptions = $eXeHiddenImage.options[instance],
            mQuestion = mOptions.questionsGame[mOptions.activeQuestion],
            $image = $('#hiPImage-' + instance);

        $image.attr('alt', 'No image').hide();

        const imgEl = $image[0];

        function onImageLoad() {
            if (
                !imgEl.complete ||
                typeof imgEl.naturalWidth === 'undefined' ||
                imgEl.naturalWidth === 0
            ) {
                $image.hide();
                $eXeHiddenImage.showAuthor('', instance);
            } else {
                $eXeHiddenImage.showAuthor(mQuestion.author, instance);
                $image.attr('alt', mQuestion.alt).css('opacity', 0).show();
                setTimeout(function () {
                    $eXeHiddenImage.scheduleReflow(instance);
                    $image.css('opacity', 1);
                }, 500);
            }
        }

        function onImageError() {
            $image.hide();
            $eXeHiddenImage.showAuthor('', instance);
            return false;
        }

        $image
            .off('load error')
            .on('load', onImageLoad)
            .on('error', onImageError);

        $image.attr('src', '');
        $image.attr('src', url);

        if (imgEl.complete) {
            if (imgEl.naturalWidth === 0) {
                onImageError.call(imgEl);
            } else {
                onImageLoad.call(imgEl);
            }
        }
    },

    showImageNeo1: function (url, instance) {
        const mOptions = $eXeHiddenImage.options[instance],
            mQuestion = mOptions.questionsGame[mOptions.activeQuestion],
            $image = $('#hiPImage-' + instance);

        $image.attr('alt', 'No image');
        $image.hide();

        $image
            .attr('src', '')
            .attr('src', url)
            .on('load', function () {
                if (
                    !this.complete ||
                    typeof this.naturalWidth === 'undefined' ||
                    this.naturalWidth === 0
                ) {
                    $image.hide();
                    $eXeHiddenImage.showAuthor('', instance);
                } else {
                    $eXeHiddenImage.showAuthor(mQuestion.author, instance);
                    $image.attr('alt', mQuestion.alt);
                    $image.css('opacity', 0);
                    $image.show();
                    setTimeout(function () {
                        $eXeHiddenImage.createSquares(instance);
                        $image.css('opacity', 1);
                    }, 500);
                }
            })
            .on('error', function () {
                $image.hide();
                $eXeHiddenImage.showAuthor('', instance);
                return false;
            });
    },

    createSquares: function (instance) {
        const mOptions = $eXeHiddenImage.options[instance];
        const mQuestion = mOptions.questionsGame[mOptions.activeQuestion];
        const $overlay = $('#hipOverlay-' + instance);
        $eXeHiddenImage.updateOverlaySize(instance);
        const overlayEl = $overlay.get(0);
        if (!overlayEl) return;
        const overlayRect = overlayEl.getBoundingClientRect();
        const overlayWidth = overlayRect.width;
        const overlayHeight = overlayRect.height;
        if (
            !overlayWidth ||
            !overlayHeight ||
            mQuestion.columns <= 0 ||
            mQuestion.rows <= 0
        )
            return;
        const baseW = overlayWidth / mQuestion.columns;
        const baseH = overlayHeight / mQuestion.rows;
        $overlay.empty();
        for (let row = 0; row < mQuestion.rows; row++) {
            const top = row * baseH;
            const height =
                row === mQuestion.rows - 1
                    ? overlayHeight - baseH * (mQuestion.rows - 1)
                    : baseH;
            for (let col = 0; col < mQuestion.columns; col++) {
                const left = col * baseW;
                const width =
                    col === mQuestion.columns - 1
                        ? overlayWidth - baseW * (mQuestion.columns - 1)
                        : baseW;
                const $hipsquare = $("<div class='HIP-Square'></div>");
                $hipsquare.css({
                    position: 'absolute',
                    width: width.toFixed(3) + 'px',
                    height: height.toFixed(3) + 'px',
                    top: top.toFixed(3) + 'px',
                    left: left.toFixed(3) + 'px',
                });
                $overlay.append($hipsquare);
            }
        }
    },

    hideSquares: function (instance, callback) {
        const $overlay = $('#hipOverlay-' + instance);
        const squares = $overlay.find('.HIP-Square').toArray();

        for (let i = squares.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [squares[i], squares[j]] = [squares[j], squares[i]];
        }

        let index = 0;
        const interval = setInterval(function () {
            if (index >= squares.length) {
                clearInterval(interval);
                if (typeof callback === 'function') callback(instance);
                return;
            }
            $(squares[index]).fadeOut(100);
            index++;
        }, 50);
    },

    newQuestion: function (instance) {
        const mOptions = $eXeHiddenImage.options[instance];
        const mActiveQuestion = $eXeHiddenImage.updateNumberQuestion(
            mOptions.activeQuestion,
            instance
        );
        if (mActiveQuestion === null) {
            $('#hiPNumber-' + instance).text('0');
            $eXeHiddenImage.gameOver(0, instance);
            return;
        }
        mOptions.counter = mOptions.questionsGame[mActiveQuestion].time;

        $eXeHiddenImage.showQuestion(mActiveQuestion, instance);
        mOptions.activeCounter = true;
        const numQ = mOptions.numberQuestions - mActiveQuestion;
        $('#hiPNumber-' + instance).text(numQ);
    },

    updateNumberQuestion: function (numq, instance) {
        const mOptions = $eXeHiddenImage.options[instance];
        let numActiveQuestion = numq + 1;
        if (numActiveQuestion >= mOptions.numberQuestions) {
            return null;
        }
        mOptions.activeQuestion = numActiveQuestion;
        return numActiveQuestion;
    },

    getRetroFeedMessages: function (iHit, instance) {
        const msgs = $eXeHiddenImage.options[instance].msgs;
        let sMessages = iHit ? msgs.msgSuccesses : msgs.msgFailures;
        sMessages = sMessages.split('|');
        return sMessages[Math.floor(Math.random() * sMessages.length)];
    },

    updateScore: function (correctAnswer, instance) {
        const mOptions = $eXeHiddenImage.options[instance];
        let message = '',
            type = 2,
            sscore = 0,
            points = 0;

        if (correctAnswer) {
            mOptions.hits++;
            points = 10 / mOptions.questionsGame.length;
            points =
                points > 0
                    ? Number.isInteger(points)
                        ? points
                        : points.toFixed(2)
                    : '0';
        } else {
            mOptions.errors++;
            type = 1;
        }

        $('#hiPScore-' + instance).text(sscore);
        $('#hiPHits-' + instance).text(mOptions.hits);
        $('#hiPErrors-' + instance).text(mOptions.errors);
        mOptions.score = (mOptions.hits * 10) / mOptions.questionsGame.length;
        sscore =
            mOptions.score > 0
                ? Number.isInteger(mOptions.score)
                    ? mOptions.score
                    : mOptions.score.toFixed(2)
                : '0';

        $('#hiPScore-' + instance).text(sscore);

        message = $eXeHiddenImage.getMessageAnswer(
            correctAnswer,
            points,
            instance
        );
        $eXeHiddenImage.showMessage(type, message, instance);
    },

    getMessageAnswer: function (correctAnswer, npts, instance) {
        const mOptions = $eXeHiddenImage.options[instance],
            question = mOptions.questionsGame[mOptions.activeQuestion];
        let message = correctAnswer
            ? $eXeHiddenImage.getMessageCorrectAnswer(npts, instance)
            : $eXeHiddenImage.getMessageErrorAnswer(npts, instance);

        if (mOptions.showSolution && question.typeQuestion === 1) {
            message += ': ' + question.solutionQuestion;
        }
        return message;
    },

    getMessageCorrectAnswer: function (npts, instance) {
        const mOptions = $eXeHiddenImage.options[instance],
            messageCorrect = $eXeHiddenImage.getRetroFeedMessages(
                true,
                instance
            ),
            pts = mOptions.msgs.msgPoints;
        let message = '';
        if (
            mOptions.customMessages &&
            mOptions.questionsGame[mOptions.activeQuestion].msgHit.length > 0
        ) {
            message = mOptions.questionsGame[mOptions.activeQuestion].msgHit;
            message += '. ' + npts + ' ' + pts;
        } else {
            message = messageCorrect + ' ' + npts + ' ' + pts;
        }
        return message;
    },

    getMessageErrorAnswer: function (npts, instance) {
        const mOptions = $eXeHiddenImage.options[instance],
            messageError = $eXeHiddenImage.getRetroFeedMessages(
                false,
                instance
            ),
            pts = mOptions.msgs.msgPoints;

        let message = '';

        if (
            mOptions.customMessages &&
            mOptions.questionsGame[mOptions.activeQuestion].msgError.length > 0
        ) {
            message =
                mOptions.questionsGame[mOptions.activeQuestion].msgError +
                '. ' +
                npts +
                ' ' +
                pts;
        } else {
            message = messageError + ' ' + npts + ' ' + pts;
        }
        return message;
    },

    answerQuestion: function (respuesta, instance) {
        const mOptions = $eXeHiddenImage.options[instance];
        if (!mOptions.gameActived) {
            return;
        }
        mOptions.gameActived = false;
        const solution = mOptions.question.solution,
            answord = parseInt(respuesta, 10);

        $eXeHiddenImage.updateScore(solution === answord, instance);

        mOptions.activeCounter = false;

        $('#hiPHits-' + instance).text(mOptions.hits);
        $('#hiPErrors-' + instance).text(mOptions.errors);

        if (mOptions.showSolution) {
            $eXeHiddenImage.drawSolution(instance);
        }
        $eXeHiddenImage.saveEvaluation(instance);

        $eXeHiddenImage.hideSquares(instance, $eXeHiddenImage.startNewQuestion);
    },

    startNewQuestion: function (instance) {
        const mOptions = $eXeHiddenImage.options[instance];
        $('#hipOverlay-' + instance)
            .find('.HIP-Square')
            .hide();

        const percentageHits = (mOptions.hits / mOptions.numberQuestions) * 100;

        let timeShowSolution = 1000;
        if (
            mOptions.itinerary.showClue &&
            percentageHits >= mOptions.itinerary.percentageClue &&
            !mOptions.obtainedClue
        ) {
            timeShowSolution = 5000;
            $('#hiPShowClue-' + instance)
                .show()
                .text(
                    `${mOptions.msgs.msgInformation}: ${mOptions.itinerary.clueGame}`
                );
            mOptions.obtainedClue = true;
        }
        if (mOptions.showSolution) {
            timeShowSolution = mOptions.timeShowSolution * 1000;
        }
        setTimeout(() => {
            $eXeHiddenImage.newQuestion(instance);
        }, timeShowSolution);
    },

    showMessage: function (type, message, instance) {
        const colors = [
                '#555555',
                $eXeHiddenImage.borderColors.red,
                $eXeHiddenImage.borderColors.green,
                $eXeHiddenImage.borderColors.blue,
                $eXeHiddenImage.borderColors.yellow,
            ],
            mcolor = colors[type],
            weight = type === 0 ? 'normal' : 'normal';
        $('#hiPMessage-' + instance)
            .html(message)
            .css({
                color: mcolor,
                'font-weight': weight,
            })
            .show();
        $('#hiPMessageDiv-' + instance).show();
        $exeDevices.iDevice.gamification.math.updateLatex(
            '#hiPMessage-' + instance
        );
    },

    showAuthor: function (message, instance) {
        $('#hiPAuthor-' + instance)
            .html(message)
            .css({
                color: $eXeHiddenImage.borderColors.grey,
            })
            .show();

        $('#hiPAuthorLicence-' + instance).show();
        if (!message) {
            $('#hiPAuthorLicence-' + instance).hide();
        }
    },

    drawQuestions: function (instance) {
        const mOptions = $eXeHiddenImage.options[instance];
        $('#hiPOptionsDiv-' + instance + ' > .HIP-Options').each(
            function (index) {
                const option = mOptions.question.options[index];
                $(this)
                    .css({
                        'border-color': $eXeHiddenImage.borderColors.grey,
                        'background-color': 'transparent',
                        cursor: 'pointer',
                        color: $eXeHiddenImage.colors.black,
                        'border-width': '1px',
                    })
                    .html(option || '')
                    .toggle(!!option);
            }
        );
    },

    drawSolution: function (instance) {
        const mOptions = $eXeHiddenImage.options[instance];
        mOptions.gameActived = false;
        $('#hiPOptionsDiv-' + instance + ' > .HIP-Options').each(
            function (index) {
                if (index === mOptions.question.solution) {
                    $(this).css({
                        'border-color': $eXeHiddenImage.borderColors.correct,
                        'background-color': $eXeHiddenImage.colors.correct,
                        cursor: 'default',
                    });
                } else {
                    $(this).css({
                        'border-color': $eXeHiddenImage.borderColors.incorrect,
                        'background-color': 'transparent',
                        cursor: 'default',
                    });
                }
            }
        );
    },

    clearQuestions: function (instance) {
        $('#hiPOptionsDiv-' + instance + ' > .HIP-Options').each(function () {
            $(this)
                .css({
                    'border-color': $eXeHiddenImage.borderColors.grey,
                    'background-color': 'transparent',
                    cursor: 'pointer',
                })
                .text('');
        });
    },

    saveEvaluation: function (instance) {
        const mOptions = $eXeHiddenImage.options[instance];
        mOptions.scorerp = (10 * mOptions.hits) / mOptions.questionsGame.length;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $eXeHiddenImage.isInExe
        );
    },

    sendScore: function (auto, instance) {
        const mOptions = $eXeHiddenImage.options[instance];

        mOptions.scorerp = (10 * mOptions.hits) / mOptions.questionsGame.length;
        mOptions.previousScore = $eXeHiddenImage.previousScore;
        mOptions.userName = $eXeHiddenImage.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $eXeHiddenImage.previousScore = mOptions.previousScore;
    },
};
$(function () {
    $eXeHiddenImage.init();
});
