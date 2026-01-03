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

var $quickquestions = {
    idevicePath: '',
    borderColors: {
        black: '#1c1b1b',
        blue: '#5877c6',
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
    image: '',
    widthImage: 0,
    heightImage: 0,
    options: {},
    videos: [],
    video: {
        player: '',
        duration: 0,
        id: '',
    },
    player: null,
    playerIntro: null,
    userName: '',
    previousScore: '',
    initialScore: '',
    msgs: '',
    youtubeLoaded: false,
    hasSCORMbutton: false,
    isInExe: false,
    started: false,
    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',
    mScorm: null,

    hasVideo: false,
    idpvideo: false,
    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            'Quick questions',
            'quick-questions',
            'quext-IDevice'
        );
    },

    enable: function () {
        $quickquestions.loadGame();
    },

    loadGame: function () {
        $quickquestions.options = [];
        $quickquestions.activities.each(function (i) {
            const version = $('.quext-version', this).eq(0).text(),
                dl = $('.quext-DataGame', this),
                imagesLink = $('.quext-LinkImages', this),
                audioLink = $('.quext-LinkAudios', this),
                mOption = $quickquestions.loadDataGame(
                    dl,
                    imagesLink,
                    audioLink,
                    version
                ),
                msg = mOption.msgs.msgPlayStart;

            mOption.scorerp = 0;
            mOption.idevicePath = $quickquestions.idevicePath;
            mOption.main = 'quextMainContainer-' + i;
            mOption.idevice = 'quext-IDevice';

            $quickquestions.options.push(mOption);

            const quext = $quickquestions.createInterfaceQuExt(i);
            dl.before(quext).remove();
            $('#quextGameMinimize-' + i).hide();
            $('#quextGameContainer-' + i).hide();

            if (mOption.showMinimize) {
                $('#quextGameMinimize-' + i)
                    .css({ cursor: 'pointer' })
                    .show();
            } else {
                $('#quextGameContainer-' + i).show();
            }

            $('#quextMessageMaximize-' + i).text(msg);
            $('#quextDivFeedBack-' + i).prepend(
                $('.quext-feedback-game', this)
            );

            $('#quextDivFeedBack-' + i).hide();

            $quickquestions.addEvents(i);
        });

        let node = document.querySelector('.page-content');
        if (this.isInExe) {
            node = document.getElementById('node-content');
        }
        if (node)
            $exeDevices.iDevice.gamification.observers.observeResize(
                $quickquestions,
                node
            );

        $exeDevices.iDevice.gamification.math.updateLatex('.quext-IDevice');

        if ($quickquestions.hasVideo) $quickquestions.loadApiPlayer();
    },

    loadApiPlayer: function () {
        if (!this.hasVideo) return;

        $exeDevices.iDevice.gamification.media.YouTubeAPILoader.load()
            .then(() => this.activatePlayer())
            .catch(() => this.showStartedButton());
    },

    activatePlayer: function () {
        $quickquestions.options.forEach((option, i) => {
            if (
                $quickquestions.hasVideo &&
                (option.player === null || option.playerIntro == null)
            ) {
                option.player = new YT.Player(`quextVideo-${i}`, {
                    width: '100%',
                    height: '100%',
                    videoId: '',
                    playerVars: {
                        color: 'white',
                        autoplay: 0,
                        controls: 0,
                    },
                    events: {
                        onReady: $quickquestions.onPlayerReady.bind(this),
                    },
                });

                option.playerIntro = new YT.Player('quextVideoIntro-' + i, {
                    width: '100%',
                    height: '100%',
                    videoId: '',
                    playerVars: {
                        color: 'white',
                        autoplay: 0,
                        controls: 1,
                    },
                });
            }
        });
    },

    youTubeReady: function () {
        this.activatePlayer();
    },

    showStartedButton: function () {
        $quickquestions.options.forEach((option, i) => {
            if (!option.gameStarted && !option.gameOver) {
                $(`#quextStartGame-${i}`).show();
                $quickquestions.showMessage(1, '', i);
            }
        });
    },

    onPlayerReady: function (event) {
        const iframe = event.target.getIframe();
        if (iframe && iframe.id) {
            const [prefix, instanceStr] = iframe.id.split('-');
            if (prefix === 'quextVideo') {
                const instance = parseInt(instanceStr, 10);
                if (!isNaN(instance)) {
                    $(`#quextStartGame-${instance}`).show();
                    $quickquestions.showMessage(1, '', instance);
                    if (
                        $quickquestions.options &&
                        $quickquestions.options[instance] &&
                        $quickquestions.options[instance].idVideo &&
                        !$quickquestions.options[instance].gameOver
                    ) {
                        $(`#quextLinkVideoIntroShow-${instance}`).show();
                    }
                } else {
                    console.warn(
                        `Número de instancia inválido para ${iframe.id}`
                    );
                }
            }
        } else {
            console.warn('No se pudo identificar el iframe del reproductor');
        }
    },

    createInterfaceQuExt: function (instance) {
        const path = $quickquestions.idevicePath,
            msgs = $quickquestions.options[instance].msgs,
            mOptions = $quickquestions.options[instance],
            html = `
            <div class="QXTP-MainContainer" id="quextMainContainer-${instance}">
                <div class="QXTP-GameMinimize" id="quextGameMinimize-${instance}">
                    <a href="#" class="QXTP-LinkMaximize" id="quextLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                        <img src="${path}quextIcon.png" class="QXTP-IconMinimize QXTP-Activo" alt="">
                        <div class="QXTP-MessageMaximize" id="quextMessageMaximize-${instance}"></div>
                    </a>
                </div>
                <div class="QXTP-GameContainer" id="quextGameContainer-${instance}">
                    <div class="QXTP-GameScoreBoard">
                        <div class="QXTP-GameScores">
                            <div class="exeQuextIcons exeQuextIcons-Number" title="${msgs.msgNumQuestions}"></div>
                            <p><span class="sr-av">${msgs.msgNumQuestions}: </span><span id="quextPNumber-${instance}">0</span></p>
                            <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                            <p><span class="sr-av">${msgs.msgHits}: </span><span id="quextPHits-${instance}">0</span></p>
                            <div class="exeQuextIcons exeQuextIcons-Error" title="${msgs.msgErrors}"></div>
                            <p><span class="sr-av">${msgs.msgErrors}: </span><span id="quextPErrors-${instance}">0</span></p>
                            <div class="exeQuextIcons exeQuextIcons-Score" title="${msgs.msgScore}"></div>
                            <p><span class="sr-av">${msgs.msgScore}: </span><span id="quextPScore-${instance}">0</span></p>
                        </div>
                        <div class="QXTP-LifesGame" id="quextLifesGame-${instance}">
                            ${$quickquestions.createLives(msgs)}
                        </div>
                        <div class="QXTP-NumberLifesGame" id="quextNumberLivesGame-${instance}">
                            <strong><span class="sr-av">${msgs.msgLive}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Life"></div>
                            <p id="quextPLifes-${instance}">0</p>
                        </div>
                        <div class="QXTP-TimeNumber">
                            <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Time" title="${msgs.msgTime}"></div>
                            <p id="quextPTime-${instance}" class="QXTP-PTime">00:00</p>
                            <a href="#" class="QXTP-LinkMinimize" id="quextLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                                <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                                <div class="exeQuextIcons exeQuextIcons-Minimize QXTP-Activo"></div>
                            </a>
                            <a href="#" class="QXTP-LinkFullScreen" id="quextLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                                <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                                <div class="exeQuextIcons exeQuextIcons-FullScreen QXTP-Activo" id="quextFullScreen-${instance}"></div>
                            </a>
                        </div>
                    </div>
                    <div class="QXTP-ShowClue" id="quextShowClue-${instance}">
                        <div class="sr-av">${msgs.msgClue}:</div>
                        <p class="QXTP-PShowClue QXTP-parpadea" id="quextPShowClue-${instance}"></p>
                    </div>
                    <div class="QXTP-Multimedia" id="quextMultimedia-${instance}">
                        <img class="QXTP-Cursor" id="quextCursor-${instance}" src="${path}exequextcursor.gif" alt="" />
                        <img src="" class="QXTP-Images" id="quextImage-${instance}" alt="${msgs.msgNoImage}" />
                        <div class="QXTP-EText" id="quextEText-${instance}"></div>
                        <img src="${path}quextHome.png" class="QXTP-Cover" id="quextCover-${instance}" alt="${msgs.msgNoImage}" />
                        <div class="QXTP-Video" id="quextVideo-${instance}"></div>
                        <video class="QXTP-Video" id="quextVideoLocal-${instance}" preload="auto" controls></video>
                        <div class="QXTP-Protector" id="quextProtector-${instance}"></div>
                        <a href="#" class="QXTP-LinkAudio" id="quextLinkAudio-${instance}" title="${msgs.msgAudio}">
                            <img src="${path}exequextaudio.png" class="QXTP-Activo" alt="${msgs.msgAudio}">
                        </a>
                    </div>
                    <div class="QXTP-GameOver" id="quextGamerOver-${instance}">
                        <div class="QXTP-DataImage">
                            <img src="${path}exequextwon.png" class="QXTP-HistGGame" id="quextHistGame-${instance}" alt="${msgs.msgAllQuestions}" />
                            <img src="${path}exequextlost.png" class="QXTP-LostGGame" id="quextLostGame-${instance}" alt="${msgs.msgLostLives}" />
                        </div>
                        <div class="QXTP-DataScore">
                            <p id="quextOverScore-${instance}">Score: 0</p>
                            <p id="quextOverHits-${instance}">Hits: 0</p>
                            <p id="quextOverErrors-${instance}">Errors: 0</p>
                        </div>
                    </div>
                    <div class="QXTP-AuthorLicence" id="quextAuthorLicence-${instance}">
                        <div class="sr-av">${msgs.msgAuthor}:</div>
                        <p id="quextPAuthor-${instance}"></p>
                    </div>
                    <div class="sr-av" id="quextStartGameSRAV-${instance}">${msgs.msgPlayStart}:</div>
                    <div class="QXTP-StartGame"><a href="#" id="quextStartGame-${instance}"></a></div>
                    <div class="QXTP-QuestionDiv" id="quextQuestionDiv-${instance}">
                        <div class="sr-av">${msgs.msgQuestion}:</div>
                        <p class="QXTP-Question" id="quextQuestion-${instance}"></p>
                        <div class="QXTP-OptionsDiv" id="quextOptionsDiv-${instance}">
                            <div class="sr-av">${msgs.msgOption} A:</div>
                            <a href="#" class="QXTP-Option1 QXTP-Options" id="quextOption1-${instance}" data-number="0"></a>
                            <div class="sr-av">${msgs.msgOption} B:</div>
                            <a href="#" class="QXTP-Option2 QXTP-Options" id="quextOption2-${instance}" data-number="1"></a>
                            <div class="sr-av">${msgs.msgOption} C:</div>
                            <a href="#" class="QXTP-Option3 QXTP-Options" id="quextOption3-${instance}" data-number="2"></a>
                            <div class="sr-av">${msgs.msgOption} D:</div>
                            <a href="#" class="QXTP-Option4 QXTP-Options" id="quextOption4-${instance}" data-number="3"></a>
                        </div>
                    </div>
                    <div class="QXTP-VideoIntroContainer" id="quextVideoIntroContainer-${instance}">
                        <a href="#" class="QXTP-LinkVideoIntroShow" id="quextLinkVideoIntroShow-${instance}" title="${msgs.msgVideoIntro}">
                            <strong><span class="sr-av">${msgs.msgVideoIntro}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Video QXTP-Activo"></div>
                        </a>
                    </div>
                    <div class="QXTP-VideoIntroDiv" id="quextVideoIntroDiv-${instance}">
                        <div class="QXTP-VideoIntro" id="quextVideoIntro-${instance}"></div>
                        <video class="QXTP-VideoIntro" id="quextVideoIntroLocal-${instance}" preload="auto" controls width="100%" height="100%"></video>
                        <input type="button" class="QXTP-VideoIntroClose" id="quextVideoIntroClose-${instance}" value="${msgs.msgClose}" />
                    </div>
                    <div class="QXTP-DivFeedBack" id="quextDivFeedBack-${instance}">
                        <input type="button" id="quextFeedBackClose-${instance}" value="${msgs.msgClose}" class="feedbackbutton" />
                    </div>                    
                </div>
                <div class="QXTP-Cubierta" id="quextCubierta-${instance}" style="display:none">
                    <div class="QXTP-CodeAccessDiv" id="quextCodeAccessDiv-${instance}">
                        <p class="QXTP-MessageCodeAccessE" id="quextMesajeAccesCodeE-${instance}"></p>
                        <div class="QXTP-DataCodeAccessE">
                            <label class="sr-av">${msgs.msgCodeAccess}:</label>
                            <input type="text" class="QXTP-CodeAccessE form-control" id="quextCodeAccessE-${instance}" placeholder="${msgs.msgCodeAccess}">
                            <a href="#" id="quextCodeAccessButton-${instance}" title="${msgs.msgSubmit}">
                                <strong><span class="sr-av">${msgs.msgSubmit}</span></strong>
                                <div class="exeQuextIcons exeQuextIcons-Submit QXTP-Activo"></div>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}
        `;
        return html;
    },
    createLives: function (msgs) {
        let lives = [...Array(5)]
            .map(
                () => `
                        <strong class="sr-av">${msgs.msgLive}:</strong>
                        <div class="exeQuextIcons exeQuextIcons-Life" title="${msgs.msgLive}"></div>
                    `
            )
            .join('');

        return lives;
    },

    showCubiertaOptions: function (mode, instance) {
        if (mode === false) {
            $('#quextCubierta-' + instance).fadeOut();
            return;
        }
        $('#quextCubierta-' + instance).fadeIn();
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

        mOptions.player = null;
        mOptions.playerIntro = null;
        mOptions.gameOver = false;
        mOptions.hasVideo = false;
        mOptions.waitStart = false;
        mOptions.waitPlayIntro = false;
        mOptions.hasVideoIntro = false;
        mOptions.gameStarted = false;
        mOptions.idpvideo = '';
        mOptions.durationVideoIntro = mOptions.endVideo + 100;
        mOptions.percentajeQuestions =
            typeof mOptions.percentajeQuestions !== 'undefined'
                ? mOptions.percentajeQuestions
                : 100;

        for (let i = 0; i < mOptions.questionsGame.length; i++) {
            const question = mOptions.questionsGame[i];
            question.audio =
                typeof question.audio === 'undefined' ? '' : question.audio;
            if (question.type !== 2) {
                question.url =
                    $exeDevices.iDevice.gamification.media.extractURLGD(
                        question.url
                    );
            }
            const idyt = $exeDevices.iDevice.gamification.media.getIDYoutube(
                question.url
            );
            if (question.type === 2 && idyt) {
                if (!$quickquestions.idpvideo) $quickquestions.idpvideo = idyt;
                mOptions.hasVideo = true;
                $quickquestions.hasVideo = true;
            }
        }
        if (
            $exeDevices.iDevice.gamification.media.getIDYoutube(
                mOptions.idVideo
            )
        ) {
            if (!$quickquestions.idpvideo)
                $quickquestions.idpvideo =
                    $exeDevices.iDevice.gamification.media.getIDYoutube(
                        mOptions.idVideo
                    );
            mOptions.hasVideo = true;
            $quickquestions.hasVideo = true;
        }

        mOptions.scoreGame = 0;
        mOptions.scoreTotal = 0;
        mOptions.playerAudio = '';
        mOptions.gameMode =
            typeof mOptions.gameMode !== 'undefined' ? mOptions.gameMode : 0;
        mOptions.percentajeFB =
            typeof mOptions.percentajeFB !== 'undefined'
                ? mOptions.percentajeFB
                : 100;
        mOptions.customMessages =
            typeof mOptions.customMessages !== 'undefined'
                ? mOptions.customMessages
                : false;
        mOptions.useLives = mOptions.gameMode !== 0 ? false : mOptions.useLives;
        mOptions.evaluation =
            typeof mOptions.evaluation !== 'undefined'
                ? mOptions.evaluation
                : false;
        mOptions.evaluationID =
            typeof mOptions.evaluationID !== 'undefined'
                ? mOptions.evaluationID
                : '';
        mOptions.id = typeof mOptions.id !== 'undefined' ? mOptions.id : false;

        imgsLink.each(function () {
            const iq = parseInt($(this).text(), 10);
            if (!isNaN(iq) && iq < mOptions.questionsGame.length) {
                const question = mOptions.questionsGame[iq];
                question.url = $(this).attr('href');
                if (question.url.length < 4 && question.type === 1) {
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
        for (let i = 0; i < mOptions.questionsGame.length; i++) {
            const question = mOptions.questionsGame[i];
            if (mOptions.customScore) {
                mOptions.scoreTotal += question.customScore;
            } else {
                question.customScore = 1;
                mOptions.scoreTotal += question.customScore;
            }
        }

        if (mOptions.optionsRamdon) {
            mOptions.questionsGame =
                $exeDevices.iDevice.gamification.helpers.shuffleAds(
                    mOptions.questionsGame
                );
        }

        mOptions.numberQuestions = mOptions.questionsGame.length;

        return mOptions;
    },

    updateTimerDisplayLocal: function (instance) {
        const mOptions = $quickquestions.options[instance];
        if (mOptions.localPlayer && mOptions.localPlayer.currentTime) {
            const currentTime = mOptions.localPlayer.currentTime;
            $quickquestions.updateSoundVideoLocal(instance);
            if (
                Math.ceil(currentTime) === mOptions.pointEnd ||
                Math.ceil(currentTime) === mOptions.durationVideo
            ) {
                mOptions.localPlayer.pause();
                mOptions.pointEnd = 100000;
            }
        }
    },

    updateTimerDisplayLocalIntro: function (instance) {
        const mOptions = $quickquestions.options[instance];
        if (
            mOptions.localPlayerIntro &&
            mOptions.localPlayerIntro.currentTime
        ) {
            const currentTime = mOptions.localPlayerIntro.currentTime;
            if (
                Math.ceil(currentTime) === mOptions.pointEndIntro ||
                Math.ceil(currentTime) === mOptions.durationVideoIntro
            ) {
                mOptions.localPlayerIntro.pause();
                mOptions.pointEndIntro = 100000;
                clearInterval(mOptions.timeUpdateIntervalIntro);
            }
        }
    },

    updateSoundVideoLocal: function (instance) {
        const mOptions = $quickquestions.options[instance];
        if (
            mOptions.activeSilent &&
            mOptions.localPlayer &&
            mOptions.localPlayer.currentTime
        ) {
            const time = Math.round(mOptions.localPlayer.currentTime);
            if (time === mOptions.question.silentVideo) {
                mOptions.localPlayer.muted = true;
            } else if (time === mOptions.endSilent) {
                mOptions.localPlayer.muted = false;
            }
        }
    },

    startVideoIntro: function (id, start, end, instance, type) {
        const mOptions = $quickquestions.options[instance],
            mstart = start < 1 ? 0.1 : start;
        $('#quextVideoIntro-' + instance).hide();
        $('#quextVideoIntroLocal-' + instance).hide();

        if (type === 1) {
            if (mOptions.localPlayerIntro) {
                mOptions.pointEndIntro = end;
                mOptions.localPlayerIntro.src = id;
                mOptions.localPlayerIntro.currentTime = parseFloat(start);
                if (typeof mOptions.localPlayerIntro.play === 'function') {
                    mOptions.localPlayerIntro.play();
                }
            }
            clearInterval(mOptions.timeUpdateIntervalIntro);
            mOptions.timeUpdateIntervalIntro = setInterval(() => {
                let $node = $('#quextMainContainer-' + instance);
                let $content = $('#node-content');
                if (
                    !$node.length ||
                    ($content.length && $content.attr('mode') === 'edition')
                ) {
                    clearInterval(mOptions.timeUpdateIntervalIntro);
                    return;
                }

                $quickquestions.updateTimerDisplayLocalIntro(instance);
            }, 1000);
            $('#quextVideoIntroLocal-' + instance).show();
            return;
        }

        if (
            mOptions.playerIntro &&
            typeof mOptions.playerIntro.loadVideoById === 'function'
        ) {
            mOptions.playerIntro.loadVideoById({
                videoId: id,
                startSeconds: mstart,
                endSeconds: end,
            });
            $('#quextVideoIntro-' + instance).show();
        }
    },

    startVideo: function (id, start, end, instance, type) {
        const mOptions = $quickquestions.options[instance],
            mstart = start < 1 ? 0.1 : start;

        if (type === 1) {
            if (mOptions.localPlayer) {
                mOptions.pointEnd = end;
                mOptions.localPlayer.src = id;
                mOptions.localPlayer.currentTime = parseFloat(start);
                if (typeof mOptions.localPlayer.play === 'function') {
                    mOptions.localPlayer.play();
                }
            }
            clearInterval(mOptions.timeUpdateInterval);
            mOptions.timeUpdateInterval = setInterval(() => {
                let $node = $('#quextMainContainer-' + instance);
                let $content = $('#node-content');
                if (
                    !$node.length ||
                    ($content.length && $content.attr('mode') === 'edition')
                ) {
                    clearInterval(mOptions.timeUpdateInterval);
                    return;
                }

                $quickquestions.updateTimerDisplayLocal(instance);
            }, 1000);
            return;
        }

        if (
            mOptions.player &&
            typeof mOptions.player.loadVideoById === 'function'
        ) {
            mOptions.player.loadVideoById({
                videoId: id,
                startSeconds: mstart,
                endSeconds: end,
            });
        }
    },

    stopVideo: function (game) {
        if (
            game &&
            game.localPlayer &&
            typeof game.localPlayer.pause === 'function'
        ) {
            game.localPlayer.pause();
        }
        if (
            game &&
            game.player &&
            typeof game.player.pauseVideo === 'function'
        ) {
            game.player.pauseVideo();
        }
    },

    stopVideoIntro: function (game) {
        if (typeof game !== 'object' || game === null) return;

        if (
            game.localPlayerIntro &&
            typeof game.localPlayerIntro.pause == 'function'
        ) {
            game.localPlayerIntro.pause();
        }

        if (
            game.playerIntro &&
            typeof game.playerIntro.pauseVideo == 'function'
        ) {
            game.playerIntro.pauseVideo();
        }
    },

    addEvents: function (instance) {
        const mOptions = $quickquestions.options[instance];
        $quickquestions.removeEvents(instance);

        $(window).on('unload.eXeQuExt beforeunload.eXeQuExt', () => {
            $exeDevices.iDevice.gamification.scorm.endScorm(
                $quickquestions.mScorm
            );
        });

        $('#quextLinkMaximize-' + instance).on('click touchstart', (e) => {
            e.preventDefault();
            $('#quextGameContainer-' + instance).show();
            $('#quextGameMinimize-' + instance).hide();
            $quickquestions.refreshGame(instance);
        });

        $('#quextLinkMinimize-' + instance).on('click touchstart', (e) => {
            e.preventDefault();
            $('#quextGameContainer-' + instance).hide();
            $('#quextGameMinimize-' + instance)
                .css('visibility', 'visible')
                .show();
            return true;
        });

        $('#quextMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $quickquestions.sendScore(false, instance);
                $quickquestions.saveEvaluation(instance);
                return true;
            });

        $('#quextGamerOver-' + instance).hide();
        $('#quextCodeAccessDiv-' + instance).hide();
        $('#quextVideo-' + instance).hide();
        $('#quextVideoLocal-' + instance).hide();
        $('#quextImage-' + instance).hide();
        $('#quextCursor-' + instance).hide();
        $('#quextCover-' + instance).show();

        $('#quextCodeAccessButton-' + instance).on('click touchstart', (e) => {
            e.preventDefault();
            $quickquestions.enterCodeAccess(instance);
        });

        $('#quextCodeAccessE-' + instance).on('keydown', function (event) {
            if (event.which === 13 || event.keyCode === 13) {
                $quickquestions.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        mOptions.livesLeft = mOptions.numberLives;

        $('#quextOptionsDiv-' + instance).on(
            'click touchstart',
            '.QXTP-Options',
            function (e) {
                e.preventDefault();
                const respuesta = $(this).data('number');
                $quickquestions.answerQuestion(respuesta, instance);
            }
        );

        $('#quextLinkFullScreen-' + instance).on('click touchstart', (e) => {
            e.preventDefault();
            const element = document.getElementById(
                'quextGameContainer-' + instance
            );
            $exeDevices.iDevice.gamification.helpers.toggleFullscreen(element);
        });

        $quickquestions.updateLives(instance);
        $('#quextInstructions-' + instance).text(mOptions.instructions);
        $('#quextPNumber-' + instance).text(mOptions.numberQuestions);
        $('#quextGameContainer-' + instance + ' .QXTP-StartGame').show();
        $('#quextQuestionDiv-' + instance).hide();

        if (mOptions.itinerary.showCodeAccess) {
            $('#quextMesajeAccesCodeE-' + instance).text(
                mOptions.itinerary.messageCodeAccess
            );
            $('#quextCodeAccessDiv-' + instance).show();
            $('#quextGameContainer-' + instance + ' .QXTP-StartGame').hide();
            $quickquestions.showCubiertaOptions(true, instance);
        }

        $('#quextInstruction-' + instance).text(mOptions.instructions);
        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        document.title = mOptions.title;
        $('meta[name=author]').attr('content', mOptions.author);
        $('#quextPShowClue-' + instance).hide();
        mOptions.gameOver = false;
        $('#quextLinkVideoIntroShow-' + instance).hide();

        if (
            $exeDevices.iDevice.gamification.media.getIDYoutube(
                mOptions.idVideo
            ) !== '' ||
            $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                mOptions.idVideo
            )
        ) {
            if (
                $exeDevices.iDevice.gamification.media.getIDYoutube(
                    mOptions.idVideo
                ) !== ''
            ) {
                mOptions.hasVideoIntro = true;
            }
            $('#quextVideoIntroContainer-' + instance)
                .css('display', 'flex')
                .show();
            $('#quextLinkVideoIntroShow-' + instance).show();
        }

        $('#quextLinkVideoIntroShow-' + instance).on(
            'click touchstart',
            (e) => {
                e.preventDefault();
                if (
                    $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                        mOptions.idVideo
                    )
                ) {
                    $quickquestions.playVideoIntroLocal(instance);
                } else if (
                    $exeDevices.iDevice.gamification.media.getIDYoutube(
                        mOptions.idVideo
                    )
                ) {
                    $quickquestions.playVideoIntro(instance);
                }
            }
        );

        $('#quextVideoIntroClose-' + instance).on('click touchstart', (e) => {
            e.preventDefault();
            $('#quextVideoIntroDiv-' + instance).hide();
            $('#quextStartGame-' + instance).text(mOptions.msgs.msgPlayStart);
            $quickquestions.stopVideoIntro(mOptions);
        });

        $('#quextStartGame-' + instance)
            .text(mOptions.msgs.msgPlayStart)
            .on('click', (e) => {
                e.preventDefault();
                $quickquestions.startGame(instance);
            });

        $('#quextFeedBackClose-' + instance).on('click', () => {
            $('#quextDivFeedBack-' + instance).hide();
        });

        $('#quextLinkAudio-' + instance).on('click', (e) => {
            e.preventDefault();
            const audio = mOptions.questionsGame[mOptions.activeQuestion].audio;
            $exeDevices.iDevice.gamification.media.stopSound(mOptions);
            $exeDevices.iDevice.gamification.media.playSound(audio, mOptions);
        });

        if (mOptions.gameMode === 2) {
            const $gameContainer = $('#quextGameContainer-' + instance);
            $gameContainer.find('.exeQuextIcons-Hit').hide();
            $gameContainer.find('.exeQuextIcons-Error').hide();
            $('#quextPErrors-' + instance).hide();
            $('#quextPHits-' + instance).hide();
            $gameContainer.find('.exeQuextIcons-Score').hide();
            $('#quextPScore-' + instance).hide();
        }

        const gameContainer = document.querySelector(
            '#quextGameContainer-' + instance
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
        if (mOptions.hasVideo) {
            $(`#quextStartGame-${instance}`).hide();
            $quickquestions.showMessage(
                1,
                'Cargando. Por favor, espere',
                instance
            );
        }
        $(`#quextLinkVideoIntroShow-${instance}`).hide();
    },

    removeEvents: function (instance) {
        $(window).off('unload.eXeQuExt beforeunload.eXeQuExt');

        $('#quextLinkMaximize-' + instance).off('click touchstart');
        $('#quextLinkMinimize-' + instance).off('click touchstart');
        $('#quextMainContainer-' + instance)
            .closest('.idevice_node')
            .off('click', '.Games-SendScore');
        $('#quextCodeAccessButton-' + instance).off('click touchstart');
        $('#quextCodeAccessE-' + instance).off('keydown');
        $('#quextOptionsDiv-' + instance).off(
            'click touchstart',
            '.QXTP-Options'
        );
        $('#quextLinkFullScreen-' + instance).off('click touchstart');
        $('#quextLinkVideoIntroShow-' + instance).off('click touchstart');
        $('#quextVideoIntroClose-' + instance).off('click touchstart');
        $('#quextStartGame-' + instance).off('click');
        $('#quextFeedBackClose-' + instance).off('click');
        $('#quextLinkAudio-' + instance).off('click');
    },

    playVideoIntro: function (instance) {
        $('#quextVideoIntroDiv-' + instance).show();
        const mOptions = $quickquestions.options[instance],
            idVideo = $exeDevices.iDevice.gamification.media.getIDYoutube(
                mOptions.idVideo
            );
        mOptions.endVideo =
            mOptions.endVideo <= mOptions.startVideo
                ? 36000
                : mOptions.endVideo;
        $quickquestions.startVideoIntro(
            idVideo,
            mOptions.startVideo,
            mOptions.endVideo,
            instance,
            0
        );
    },

    playVideoIntroLocal: function (instance) {
        $('#quextVideoIntroDiv-' + instance).show();
        const mOptions = $quickquestions.options[instance],
            idVideo =
                $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                    mOptions.idVideo
                );
        mOptions.endVideo =
            mOptions.endVideo <= mOptions.startVideo
                ? 36000
                : mOptions.endVideo;
        $quickquestions.startVideoIntro(
            idVideo,
            mOptions.startVideo,
            mOptions.endVideo,
            instance,
            1
        );
    },

    refreshGame: function (instance) {
        const mOptions = $quickquestions.options[instance];
        if (!mOptions) return;

        const mQuestion = mOptions.questionsGame[mOptions.activeQuestion];

        if (!mQuestion) return;

        if (mQuestion.type === 1 && mQuestion.url && mQuestion.url.length > 3) {
            $quickquestions.centerImage(instance);
        }
    },

    centerImage: function (instance) {
        const $image = $('#quextImage-' + instance);

        if ($image.length !== 1) return;

        const $parent = $image.parent(),
            wDiv = $parent.width() > 0 ? $parent.width() : 1,
            hDiv = $parent.height() > 0 ? $parent.height() : 1,
            naturalWidth = $image[0].naturalWidth,
            naturalHeight = $image[0].naturalHeight,
            varW = naturalWidth / wDiv,
            varH = naturalHeight / hDiv;

        let wImage = wDiv,
            hImage = hDiv,
            xImage = 0,
            yImage = 0;
        if (varW > varH) {
            wImage = parseInt(wDiv);
            hImage = parseInt(naturalHeight / varW);
            yImage = parseInt((hDiv - hImage) / 2);
        } else {
            wImage = parseInt(naturalWidth / varH);
            hImage = parseInt(hDiv);
            xImage = parseInt((wDiv - wImage) / 2);
        }
        $image.css({
            width: wImage,
            height: hImage,
            position: 'absolute',
            left: xImage,
            top: yImage,
        });
        $quickquestions.positionPointer(instance);
    },

    positionPointer: function (instance) {
        const mOptions = $quickquestions.options[instance],
            mQuestion = mOptions.questionsGame[mOptions.activeQuestion],
            x = parseFloat(mQuestion.x) || 0,
            y = parseFloat(mQuestion.y) || 0,
            $cursor = $('#quextCursor-' + instance);

        $cursor.hide();
        if (x > 0 || y > 0) {
            const containerElement = document.getElementById(
                'quextMultimedia-' + instance
            );
            const containerPos = containerElement.getBoundingClientRect(),
                imgElement = document.getElementById('quextImage-' + instance),
                imgPos = imgElement.getBoundingClientRect(),
                marginTop = imgPos.top - containerPos.top,
                marginLeft = imgPos.left - containerPos.left,
                posX = marginLeft + x * imgPos.width,
                posY = marginTop + y * imgPos.height;

            $cursor.css({ left: posX, top: posY, 'z-index': 30 }).show();
        }
    },

    enterCodeAccess: function (instance) {
        const mOptions = $quickquestions.options[instance],
            enteredCode = $('#quextCodeAccessE-' + instance)
                .val()
                .toLowerCase(),
            accessCode = mOptions.itinerary.codeAccess.toLowerCase();

        if (accessCode === enteredCode) {
            $quickquestions.showCubiertaOptions(false, instance);
            $quickquestions.startGame(instance);
            $('#quextLinkMaximize-' + instance).trigger('click');
        } else {
            $('#quextMesajeAccesCodeE-' + instance)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $('#quextCodeAccessE-' + instance).val('');
        }
    },

    showScoreGame: function (type, instance) {
        const mOptions = $quickquestions.options[instance],
            msgs = mOptions.msgs,
            $quextHistGame = $('#quextHistGame-' + instance),
            $quextLostGame = $('#quextLostGame-' + instance),
            $quextOverPoint = $('#quextOverScore-' + instance),
            $quextOverHits = $('#quextOverHits-' + instance),
            $quextOverErrors = $('#quextOverErrors-' + instance),
            $quextPShowClue = $('#quextPShowClue-' + instance),
            $quextGamerOver = $('#quextGamerOver-' + instance),
            $quextMultimedia = $('#quextMultimedia-' + instance);

        let message = '',
            messageColor = 2;

        $quextHistGame.hide();
        $quextLostGame.hide();
        $quextOverPoint.show();
        $quextOverHits.show();
        $quextOverErrors.show();
        $quextPShowClue.hide();

        switch (parseInt(type, 10)) {
            case 0:
                message = `${msgs.msgCool} ${msgs.msgAllQuestions}`;
                $quextHistGame.show();
                if (mOptions.itinerary.showClue) {
                    if (mOptions.obtainedClue) {
                        message = msgs.msgAllQuestions;
                        $quextPShowClue
                            .text(
                                `${msgs.msgInformation}: ${mOptions.itinerary.clueGame}`
                            )
                            .show();
                    } else {
                        $quextPShowClue
                            .text(
                                msgs.msgTryAgain.replace(
                                    '%s',
                                    mOptions.itinerary.percentageClue
                                )
                            )
                            .show();
                    }
                }
                break;
            case 1:
                message = msgs.msgLostLives;
                messageColor = 1;
                $quextLostGame.show();
                if (mOptions.itinerary.showClue) {
                    if (mOptions.obtainedClue) {
                        $quextPShowClue
                            .text(
                                `${msgs.msgInformation}: ${mOptions.itinerary.clueGame}`
                            )
                            .show();
                    } else {
                        $quextPShowClue
                            .text(
                                msgs.msgTryAgain.replace(
                                    '%s',
                                    mOptions.itinerary.percentageClue
                                )
                            )
                            .show();
                    }
                }
                break;
            case 2:
                message = msgs.msgInformationLooking;
                $quextOverPoint.hide();
                $quextOverHits.hide();
                $quextOverErrors.hide();
                $quextPShowClue.text(mOptions.itinerary.clueGame).show();
                break;
            default:
                break;
        }

        $quickquestions.showMessage(messageColor, message, instance);

        const scoreMsg =
            mOptions.gameMode === 0
                ? `${msgs.msgScore}: ${mOptions.score}`
                : `${msgs.msgScore}: ${mOptions.score.toFixed(2)}`;
        $quextOverPoint.html(scoreMsg);
        $quextOverHits.html(`${msgs.msgHits}: ${mOptions.hits}`);
        $quextOverErrors.html(`${msgs.msgErrors}: ${mOptions.errors}`);
        $quextGamerOver.show();
        $quextMultimedia.hide();
    },

    startGame: function (instance) {
        const mOptions = $quickquestions.options[instance];

        if (mOptions.gameStarted) return;

        mOptions.scoreGame = 0;
        mOptions.obtainedClue = false;
        $('#quextVideoIntroContainer-' + instance).hide();
        $('#quextLinkVideoIntroShow-' + instance).hide();
        $('#quextPShowClue-' + instance)
            .hide()
            .text('');
        $('#quextGameContainer-' + instance + ' .QXTP-StartGame').hide();
        $('#quextQuestionDiv-' + instance).show();
        $('#quextQuestion-' + instance).text('');

        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.gameActived = false;
        mOptions.activeQuestion = -1;
        mOptions.validQuestions = mOptions.numberQuestions;
        mOptions.counter = 0;
        mOptions.gameStarted = false;
        mOptions.livesLeft = mOptions.numberLives;

        $quickquestions.updateLives(instance);

        $('#quextPNumber-' + instance).text(mOptions.numberQuestions);

        mOptions.counterClock = setInterval(() => {
            if (mOptions.gameStarted && mOptions.activeCounter) {
                let $node = $('#quextMainContainer-' + instance);
                let $content = $('#node-content');
                if (
                    !$node.length ||
                    ($content.length && $content.attr('mode') === 'edition')
                ) {
                    clearInterval(mOptions.counterClock);
                    return;
                }
                mOptions.counter--;
                $quickquestions.uptateTime(mOptions.counter, instance);
                $quickquestions.updateSoundVideo(instance);
                if (mOptions.counter <= 0) {
                    mOptions.activeCounter = false;
                    let timeShowSolution = mOptions.showSolution
                        ? mOptions.timeShowSolution * 1000
                        : 1000;
                    if (mOptions.showSolution) {
                        $quickquestions.drawSolution(instance);
                    }
                    setTimeout(() => {
                        $quickquestions.newQuestion(instance);
                    }, timeShowSolution);
                }
            }
        }, 1000);

        $quickquestions.uptateTime(0, instance);
        $('#quextGamerOver-' + instance).hide();
        $('#quextMultimedia-' + instance).show();
        $('#quextPHits-' + instance).text(mOptions.hits);
        $('#quextPErrors-' + instance).text(mOptions.errors);
        $('#quextPScore-' + instance).text(mOptions.score);
        mOptions.gameStarted = true;
        $quickquestions.newQuestion(instance);
    },

    updateSoundVideo: function (instance) {
        const mOptions = $quickquestions.options[instance];
        if (
            mOptions.activeSilent &&
            mOptions.player &&
            typeof mOptions.player.getCurrentTime === 'function'
        ) {
            const time = Math.round(mOptions.player.getCurrentTime());
            if (time === mOptions.question.silentVideo) {
                mOptions.player.mute();
            } else if (time === mOptions.endSilent) {
                mOptions.player.unMute();
            }
        }
    },

    uptateTime: function (tiempo, instance) {
        const mTime =
            $exeDevices.iDevice.gamification.helpers.getTimeToString(tiempo);
        $('#quextPTime-' + instance).text(mTime);
    },

    gameOver: function (type, instance) {
        const mOptions = $quickquestions.options[instance];

        mOptions.gameStarted = false;
        mOptions.gameActived = false;

        clearInterval(mOptions.counterClock);

        $quickquestions.showImageNeo('', instance);

        $('#quextVideo-' + instance).hide();
        $('#quextVideoLocal-' + instance).hide();
        $('#quextLinkAudio-' + instance).hide();

        $quickquestions.startVideo('', 0, 0, instance, 0);
        $quickquestions.stopVideo(mOptions);
        $exeDevices.iDevice.gamification.media.stopSound(mOptions);

        $('#quextImage-' + instance).hide();
        $('#quextEText-' + instance).hide();
        $('#quextCursor-' + instance).hide();
        $('#quextCover-' + instance).hide();

        const message =
            type === 0
                ? mOptions.msgs.msgAllQuestions
                : mOptions.msgs.msgLostLives;
        $quickquestions.showMessage(0, message, instance);
        $quickquestions.showScoreGame(type, instance);
        $quickquestions.clearQuestions(instance);
        $('#quextPNumber-' + instance).text('0');
        $('#quextStartGame-' + instance).text(mOptions.msgs.msgNewGame);
        $('#quextGameContainer-' + instance + ' .QXTP-StartGame').show();
        $('#quextQuestionDiv-' + instance).hide();

        if (
            $exeDevices.iDevice.gamification.media.getIDYoutube(
                mOptions.idVideo
            ) !== '' ||
            $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                mOptions.idVideo
            )
        ) {
            $('#quextVideoIntroContainer-' + instance)
                .css('display', 'flex')
                .show();
            $('#quextLinkVideoIntroShow-' + instance).show();
        }

        mOptions.gameOver = true;

        if (mOptions.isScorm === 1) {
            if (
                mOptions.repeatActivity ||
                $quickquestions.initialScore === ''
            ) {
                const score = (
                    (mOptions.scoreGame * 10) /
                    mOptions.scoreTotal
                ).toFixed(2);
                $quickquestions.sendScore(true, instance);
                $('#quextRepeatActivity-' + instance).text(
                    `${mOptions.msgs.msgYouScore}: ${score}`
                );
                $quickquestions.initialScore = score;
            }
        }

        $quickquestions.saveEvaluation(instance);
        clearInterval(mOptions.timeUpdateInterval);
        clearInterval(mOptions.timeUpdateIntervalIntro);
        $quickquestions.showFeedBack(instance);
    },

    showFeedBack: function (instance) {
        const mOptions = $quickquestions.options[instance],
            puntos = (mOptions.hits * 100) / mOptions.questionsGame.length;

        if (mOptions.gameMode === 2 || mOptions.feedBack) {
            if (puntos >= mOptions.percentajeFB) {
                $('#quextDivFeedBack-' + instance)
                    .find('.quext-feedback-game')
                    .show();
                $('#quextDivFeedBack-' + instance).show();
            } else {
                $quickquestions.showMessage(
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

    showQuestion: function (i, instance) {
        const mOptions = $quickquestions.options[instance],
            mQuestion = mOptions.questionsGame[i],
            q = mQuestion;
        mOptions.activeQuestion = i;
        mOptions.gameActived = true;
        mOptions.question = mQuestion;

        if (mOptions.answersRamdon) {
            $quickquestions.ramdonOptions(instance);
        }

        const tiempo = $exeDevices.iDevice.gamification.helpers.getTimeToString(
            $exeDevices.iDevice.gamification.helpers.getTimeSeconds(
                mQuestion.time
            )
        );

        $('#quextPTime-' + instance).text(tiempo);
        $('#quextQuestion-' + instance).html(mQuestion.quextion);
        $('#quextImage-' + instance).hide();
        $('#quextCover-' + instance).show();
        $('#quextEText-' + instance).hide();
        $('#quextVideo-' + instance).hide();
        $('#quextVideoLocal-' + instance).hide();
        $('#quextLinkAudio-' + instance).hide();
        $('#quextPAuthor-' + instance).text('');
        $quickquestions.stopVideo(mOptions);
        $('#quextCursor-' + instance).hide();
        $quickquestions.showMessage(0, '', instance);

        if (mOptions.isScorm === 1) {
            if (
                mOptions.repeatActivity ||
                $quickquestions.initialScore === ''
            ) {
                const score = (
                    (mOptions.scoreGame * 10) /
                    mOptions.scoreTotal
                ).toFixed(2);
                $quickquestions.sendScore(true, instance);
                $('#quextRepeatActivity-' + instance).text(
                    `${mOptions.msgs.msgYouScore}: ${score}`
                );
            }
        }

        $quickquestions.saveEvaluation(instance);

        mOptions.activeSilent =
            q.type === 2 &&
            q.soundVideo === 1 &&
            q.tSilentVideo > 0 &&
            q.silentVideo >= q.iVideo &&
            q.iVideo < q.fVideo;

        const endSonido =
            parseInt(q.silentVideo) + parseInt(q.tSilentVideo, 10);
        mOptions.endSilent = endSonido > q.fVideo ? q.fVideo : endSonido;

        if (mQuestion.type === 1) {
            $quickquestions.showImageNeo(mQuestion.url, instance);
        } else if (mQuestion.type === 3) {
            const text = unescape(mQuestion.eText);
            $('#quextEText-' + instance)
                .html(text)
                .show();
            $('#quextCover-' + instance).hide();
            $quickquestions.showMessage(0, '', instance);
        } else if (mQuestion.type === 2) {
            $('#quextVideo-' + instance).show();
            const idVideo = $exeDevices.iDevice.gamification.media.getIDYoutube(
                mQuestion.url
            );
            const urllv =
                $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                    mQuestion.url
                );
            const type = urllv ? 1 : 0,
                id = type === 0 ? idVideo : urllv;

            $quickquestions.startVideo(
                id,
                mQuestion.iVideo,
                mQuestion.fVideo,
                instance,
                type
            );
            $quickquestions.showMessage(0, '', instance);
            $('#quextVideo-' + instance).hide();
            $('#quextVideoLocal-' + instance).hide();
            $('#quextCover-' + instance).hide();

            if (mQuestion.imageVideo === 0) {
                $('#quextCover-' + instance).show();
            } else {
                if (type === 1) {
                    $('#quextVideoLocal-' + instance).show();
                } else {
                    $('#quextVideo-' + instance).show();
                }
            }

            if (mQuestion.soundVideo === 0) {
                $exeDevices.iDevice.gamification.media.muteVideo(
                    true,
                    instance,
                    type
                );
            } else {
                $exeDevices.iDevice.gamification.media.muteVideo(
                    false,
                    instance,
                    type
                );
            }
        }

        if (q.audio.length > 4 && q.type !== 2) {
            $('#quextLinkAudio-' + instance).show();
        }

        $exeDevices.iDevice.gamification.media.stopSound(mOptions);

        if (q.type !== 2 && q.audio.trim().length > 5) {
            $exeDevices.iDevice.gamification.media.playSound(
                q.audio.trim(),
                mOptions
            );
        }

        $quickquestions.drawQuestions(instance);

        const html = $('#quextMainContainer-' + instance).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);

        if (latex) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '#quextMainContainer-' + instance
            );
        }
    },

    ramdonOptions: function (instance) {
        let mOptions = $quickquestions.options[instance],
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
        const mOptions = $quickquestions.options[instance],
            mQuestion = mOptions.questionsGame[mOptions.activeQuestion],
            $cursor = $('#quextCursor-' + instance),
            $noImage = $('#quextCover-' + instance),
            $image = $('#quextImage-' + instance),
            $author = $('#quextAuthor-' + instance),
            $protect = $('#quextProtector-' + instance);

        $image.attr('alt', 'No image');
        $cursor.hide();
        $image.hide();
        $noImage.hide();
        $protect.hide();

        if ($.trim(url).length === 0 || $image.length !== 1) {
            $cursor.hide();
            $image.hide();
            $noImage.show();
            $author.text('');
            return false;
        }

        $image
            .attr('src', '')
            .attr('src', url)
            .on('load', function () {
                if (
                    !this.complete ||
                    typeof this.naturalWidth === 'undefined' ||
                    this.naturalWidth === 0
                ) {
                    $cursor.hide();
                    $image.hide();
                    $noImage.show();
                    $author.text('');
                } else {
                    $image.show();
                    $cursor.show();
                    $noImage.hide();
                    $author.text(mQuestion.author);
                    $image.attr('alt', mQuestion.alt);
                    $quickquestions.centerImage(instance);
                }
            })
            .on('error', function () {
                $cursor.hide();
                $image.hide();
                $noImage.show();
                $author.text('');
                return false;
            });

        $quickquestions.showMessage(0, mQuestion.author, instance);
    },

    updateLives: function (instance) {
        const mOptions = $quickquestions.options[instance];
        $('#quextPLifes-' + instance).text(mOptions.livesLeft);

        $('#quextLifesGame-' + instance)
            .find('.exeQuextIcons-Life')
            .each(function (index) {
                $(this).hide();
                if (mOptions.useLives) {
                    if (index < mOptions.livesLeft) {
                        $(this).show();
                    }
                }
            });

        if (!mOptions.useLives) {
            $('#quextNumberLivesGame-' + instance).hide();
        }
    },

    newQuestion: function (instance) {
        const mOptions = $quickquestions.options[instance];
        if (mOptions.useLives && mOptions.livesLeft <= 0) {
            $quickquestions.gameOver(1, instance);
            return;
        }

        const mActiveQuestion = $quickquestions.updateNumberQuestion(
            mOptions.activeQuestion,
            instance
        );
        if (mActiveQuestion === null) {
            $('#quextPNumber-' + instance).text('0');
            $quickquestions.gameOver(0, instance);
            return;
        }

        mOptions.counter =
            $exeDevices.iDevice.gamification.helpers.getTimeSeconds(
                mOptions.questionsGame[mActiveQuestion].time
            );
        if (mOptions.questionsGame[mActiveQuestion].type === 2) {
            const durationVideo =
                mOptions.questionsGame[mActiveQuestion].fVideo -
                mOptions.questionsGame[mActiveQuestion].iVideo;
            mOptions.counter += durationVideo;
        }

        $quickquestions.showQuestion(mActiveQuestion, instance);
        mOptions.activeCounter = true;
        const numQ = mOptions.numberQuestions - mActiveQuestion;
        $('#quextPNumber-' + instance).text(numQ);
    },

    updateNumberQuestion: function (numq, instance) {
        const mOptions = $quickquestions.options[instance];
        let numActiveQuestion = numq + 1;
        if (numActiveQuestion >= mOptions.numberQuestions) {
            return null;
        }
        mOptions.activeQuestion = numActiveQuestion;
        return numActiveQuestion;
    },

    getRetroFeedMessages: function (iHit, instance) {
        const msgs = $quickquestions.options[instance].msgs;
        let sMessages = iHit ? msgs.msgSuccesses : msgs.msgFailures;
        sMessages = sMessages.split('|');
        return sMessages[Math.floor(Math.random() * sMessages.length)];
    },

    updateScore: function (correctAnswer, instance) {
        const mOptions = $quickquestions.options[instance],
            question = mOptions.questionsGame[mOptions.activeQuestion];
        let message = '',
            obtainedPoints = 0,
            type = 1,
            sscore = 0,
            points = 0;

        if (correctAnswer) {
            mOptions.hits++;
            if (mOptions.gameMode === 0) {
                const pointsTemp =
                    mOptions.counter < 60 ? mOptions.counter * 10 : 600;
                obtainedPoints = 1000 + pointsTemp;
                obtainedPoints *= question.customScore;
                points = obtainedPoints;
            } else if (mOptions.gameMode === 1 || mOptions.gameMode === 2) {
                obtainedPoints =
                    (10 * question.customScore) / mOptions.scoreTotal;
                if (mOptions.order === 2) {
                    obtainedPoints = question.customScore / 10;
                }
                points =
                    obtainedPoints % 1 === 0
                        ? obtainedPoints
                        : obtainedPoints.toFixed(2);
            }
            type = 2;
            mOptions.scoreGame += question.customScore;
        } else {
            mOptions.errors++;
            if (mOptions.gameMode !== 0) {
                message = '';
            } else {
                obtainedPoints = -330 * question.customScore;
                points = obtainedPoints;
                if (mOptions.useLives) {
                    mOptions.livesLeft--;
                    $quickquestions.updateLives(instance);
                }
            }
        }

        mOptions.score = Math.max(mOptions.score + obtainedPoints, 0);
        sscore =
            mOptions.gameMode !== 0
                ? mOptions.score % 1 === 0
                    ? mOptions.score
                    : mOptions.score.toFixed(2)
                : mOptions.score;
        $('#quextPScore-' + instance).text(sscore);
        $('#quextPHits-' + instance).text(mOptions.hits);
        $('#vquextPErrors-' + instance).text(mOptions.errors);

        message = $quickquestions.getMessageAnswer(
            correctAnswer,
            points,
            instance
        );
        $quickquestions.showMessage(type, message, instance);
    },

    getMessageAnswer: function (correctAnswer, npts, instance) {
        const mOptions = $quickquestions.options[instance],
            question = mOptions.questionsGame[mOptions.activeQuestion];
        let message = correctAnswer
            ? $quickquestions.getMessageCorrectAnswer(npts, instance)
            : $quickquestions.getMessageErrorAnswer(npts, instance);

        if (mOptions.showSolution && question.typeQuestion === 1) {
            message += ': ' + question.solutionQuestion;
        }
        return message;
    },

    getMessageCorrectAnswer: function (npts, instance) {
        const mOptions = $quickquestions.options[instance],
            messageCorrect = $quickquestions.getRetroFeedMessages(
                true,
                instance
            ),
            pts = mOptions.msgs.msgPoints || 'puntos';
        let message = '';

        if (
            mOptions.customMessages &&
            mOptions.questionsGame[mOptions.activeQuestion].msgHit.length > 0
        ) {
            message = mOptions.questionsGame[mOptions.activeQuestion].msgHit;
            if (mOptions.gameMode < 2) {
                message += '. ' + npts + ' ' + pts;
            }
        } else {
            message =
                mOptions.gameMode === 2
                    ? messageCorrect
                    : messageCorrect + ' ' + npts + ' ' + pts;
        }
        return message;
    },

    getMessageErrorAnswer: function (npts, instance) {
        const mOptions = $quickquestions.options[instance],
            messageError = $quickquestions.getRetroFeedMessages(
                false,
                instance
            ),
            pts = mOptions.msgs.msgPoints || 'puntos';
        let message = '';

        if (
            mOptions.customMessages &&
            mOptions.questionsGame[mOptions.activeQuestion].msgError.length > 0
        ) {
            message = mOptions.questionsGame[mOptions.activeQuestion].msgError;
            if (mOptions.gameMode !== 2) {
                message += mOptions.useLives
                    ? '. ' + mOptions.msgs.msgLoseLive
                    : '. ' + npts + ' ' + pts;
            }
        } else {
            message = mOptions.useLives
                ? messageError + ' ' + mOptions.msgs.msgLoseLive
                : messageError + ' ' + npts + ' ' + pts;
            if (mOptions.gameMode > 0) {
                message = messageError;
            }
        }
        return message;
    },

    answerQuestion: function (respuesta, instance) {
        const mOptions = $quickquestions.options[instance];
        if (!mOptions.gameActived) {
            return;
        }
        mOptions.gameActived = false;
        const solution = mOptions.question.solution,
            answord = parseInt(respuesta, 10);

        $quickquestions.updateScore(solution === answord, instance);

        const percentageHits = (mOptions.hits / mOptions.numberQuestions) * 100;

        mOptions.activeCounter = false;

        $('#quextPHits-' + instance).text(mOptions.hits);
        $('#quextPErrors-' + instance).text(mOptions.errors);

        let timeShowSolution = 1000;

        if (
            mOptions.itinerary.showClue &&
            percentageHits >= mOptions.itinerary.percentageClue &&
            !mOptions.obtainedClue
        ) {
            timeShowSolution = 5000;
            $('#quextPShowClue-' + instance)
                .show()
                .text(
                    `${mOptions.msgs.msgInformation}: ${mOptions.itinerary.clueGame}`
                );
            mOptions.obtainedClue = true;
        }

        if (mOptions.showSolution) {
            timeShowSolution = mOptions.timeShowSolution * 1000;
            $quickquestions.drawSolution(instance);
        }

        setTimeout(() => {
            $quickquestions.newQuestion(instance);
        }, timeShowSolution);
    },

    reduceText: function (text) {
        let rText = text;
        for (let i = 8; i < 40; i++) {
            const normal = i + 'pt',
                re = new RegExp(normal, 'gi'),
                reducido = i - 3 + 'pt';
            rText = rText.replace(re, reducido);
        }
    },

    showMessage: function (type, message, instance) {
        const colors = [
                '#555555',
                $quickquestions.borderColors.red,
                $quickquestions.borderColors.green,
                $quickquestions.borderColors.blue,
                $quickquestions.borderColors.yellow,
            ],
            mcolor = colors[type],
            weight = type === 0 ? 'normal' : 'normal';
        $('#quextPAuthor-' + instance)
            .html(message)
            .css({
                color: mcolor,
                'font-weight': weight,
            })
            .show();
        $exeDevices.iDevice.gamification.math.updateLatex(
            '#quextPAuthor-' + instance
        );
    },

    drawQuestions: function (instance) {
        const mOptions = $quickquestions.options[instance];
        $('#quextOptionsDiv-' + instance + ' > .QXTP-Options').each(
            function (index) {
                const option = mOptions.question.options[index];
                $(this)
                    .css({
                        'border-color': $quickquestions.borderColors.grey,
                        'background-color': 'transparent',
                        cursor: 'pointer',
                        color: $quickquestions.colors.black,
                        'border-width': '1px',
                    })
                    .html(option || '')
                    .toggle(!!option);
            }
        );
    },

    drawSolution: function (instance) {
        const mOptions = $quickquestions.options[instance];
        mOptions.gameActived = false;
        $('#quextOptionsDiv-' + instance + ' > .QXTP-Options').each(
            function (index) {
                if (index === mOptions.question.solution) {
                    $(this).css({
                        'border-color': $quickquestions.borderColors.correct,
                        'background-color': $quickquestions.colors.correct,
                        cursor: 'default',
                    });
                } else {
                    $(this).css({
                        'border-color': $quickquestions.borderColors.incorrect,
                        'background-color': 'transparent',
                        cursor: 'default',
                    });
                }
            }
        );
    },

    clearQuestions: function (instance) {
        $('#quextOptionsDiv-' + instance + ' > .QXTP-Options').each(
            function () {
                $(this)
                    .css({
                        'border-color': $quickquestions.borderColors.grey,
                        'background-color': 'transparent',
                        cursor: 'pointer',
                    })
                    .text('');
            }
        );
    },

    saveEvaluation: function (instance) {
        const mOptions = $quickquestions.options[instance];
        mOptions.scorerp = (10 * mOptions.scoreGame) / mOptions.scoreTotal;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $quickquestions.isInExe
        );
    },

    sendScore: function (auto, instance) {
        const mOptions = $quickquestions.options[instance];

        mOptions.scorerp = (10 * mOptions.scoreGame) / mOptions.scoreTotal;
        mOptions.previousScore = $quickquestions.previousScore;
        mOptions.userName = $quickquestions.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $quickquestions.previousScore = mOptions.previousScore;
    },
};
$(function () {
    $quickquestions.init();
});
