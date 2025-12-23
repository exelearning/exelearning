/* eslint-disable no-undef */
/**
 * Select Activity iDevice (export code)
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno, Francisco Javier Pulido
 * Testers: Francisco Muñoz de la Peña
 * Translator: Antonio Juan Delgado García
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $quickquestionsmultiplechoice = {
    idevicePath: '',
    borderColors: $exeDevices.iDevice.gamification.colors.borderColors,
    colors: $exeDevices.iDevice.gamification.colors.backColor,
    image: '',
    widthImage: 0,
    heightImage: 0,
    hasVideo: false,
    options: {},
    videos: [],
    video: {
        player: '',
        duration: 0,
        id: '',
    },
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

    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            'Multiple Choice Quiz',
            'quick-questions-multiple-choice',
            'selecciona-IDevice'
        );
    },

    enable: function () {
        $quickquestionsmultiplechoice.loadGame();
    },

    sendScore: function (auto, instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance];

        mOptions.scorerp =
            mOptions.order == 2
                ? mOptions.score / 10
                : (mOptions.scoreGame * 10) / mOptions.scoreTotal;
        mOptions.previousScore = $quickquestionsmultiplechoice.previousScore;
        mOptions.userName = $quickquestionsmultiplechoice.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $quickquestionsmultiplechoice.previousScore = mOptions.previousScore;
    },

    loadGame: function () {
        $quickquestionsmultiplechoice.options = [];
        $quickquestionsmultiplechoice.activities.each(function (i) {
            const version = $('.selecciona-version', this).eq(0).text(),
                dl = $('.selecciona-DataGame', this),
                imagesLink = $('.selecciona-LinkImages', this),
                audioLink = $('.selecciona-LinkAudios', this),
                mOption = $quickquestionsmultiplechoice.loadDataGame(
                    dl,
                    imagesLink,
                    audioLink,
                    version
                ),
                msg = mOption.msgs.msgPlayStart;

            mOption.scorerp = 0;
            mOption.idevicePath = $quickquestionsmultiplechoice.idevicePath;
            mOption.main = 'seleccionaMainContainer-' + i;
            mOption.idevice = 'selecciona-IDevice';

            $quickquestionsmultiplechoice.options.push(mOption);
            const selecciona =
                $quickquestionsmultiplechoice.createInterfaceSelecciona(i);
            dl.before(selecciona).remove();

            $('#seleccionaGameMinimize-' + i).hide();
            $('#seleccionaGameContainer-' + i).hide();
            if (mOption.showMinimize) {
                $('#seleccionaGameMinimize-' + i)
                    .css({
                        cursor: 'pointer',
                    })
                    .show();
            } else {
                $('#seleccionaGameContainer-' + i).show();
            }
            $('#seleccionaMessageMaximize-' + i).text(msg);
            $('#seleccionaDivFeedBack-' + i).prepend(
                $('.selecciona-feedback-game', this)
            );

            $('#seleccionaDivFeedBack-' + i).hide();
            if (mOption.order == 2) {
                $('#seleccionaGameContainer-' + i)
                    .find('.exeQuextIcons-Number')
                    .hide();
                $('#seleccionaPNumber-' + i).hide();
            }
            $('#seleccionaMainContainer-' + i).show();

            $quickquestionsmultiplechoice.addEvents(i);
        });

        let node = document.querySelector('.page-content');
        if (this.isInExe) {
            node = document.getElementById('node-content');
        }
        if (node)
            $exeDevices.iDevice.gamification.observers.observeResize(
                $quickquestionsmultiplechoice,
                node
            );

        $exeDevices.iDevice.gamification.math.updateLatex(
            '.selecciona-IDevice'
        );

        if ($quickquestionsmultiplechoice.hasVideo)
            $quickquestionsmultiplechoice.loadApiPlayer();
    },

    createInterfaceSelecciona: function (instance) {
        const path = $quickquestionsmultiplechoice.idevicePath,
            msgs = $quickquestionsmultiplechoice.options[instance].msgs,
            mOptions = $quickquestionsmultiplechoice.options[instance],
            html = `
        <div class="SLCNP-MainContainer" id="seleccionaMainContainer-${instance}">
            <div class="SLCNP-GameMinimize" id="seleccionaGameMinimize-${instance}">
                <a href="#" class="SLCNP-LinkMaximize" id="seleccionaLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                    <img src="${path}seleccionaIcon.png" class="SLCNP-IconMinimize SLCNP-Activo" alt="">
                    <div class="SLCNP-MessageMaximize" id="seleccionaMessageMaximize-${instance}"></div>
                </a>
            </div>
            <div class="SLCNP-GameContainer" id="seleccionaGameContainer-${instance}">
                <div class="SLCNP-GameScoreBoard">
                    <div class="SLCNP-GameScores">
                        <div class="exeQuextIcons exeQuextIcons-Number" title="${msgs.msgNumQuestions}"></div>
                        <p><span class="sr-av">${msgs.msgNumQuestions}: </span><span id="seleccionaPNumber-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                        <p><span class="sr-av">${msgs.msgHits}: </span><span id="seleccionaPHits-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Error" title="${msgs.msgErrors}"></div>
                        <p><span class="sr-av">${msgs.msgErrors}: </span><span id="seleccionaPErrors-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Score" title="${msgs.msgScore}"></div>
                        <p><span class="sr-av">${msgs.msgScore}: </span><span id="seleccionaPScore-${instance}">0</span></p>
                    </div>
                    <div class="SLCNP-LifesGame" id="seleccionaLifesGame-${instance}">
                        ${$quickquestionsmultiplechoice.createLives(msgs)}
                    </div>
                    <div class="SLCNP-NumberLifesGame" id="seleccionaNumberLivesGame-${instance}">
                        <strong class="sr-av">${msgs.msgLive}:</strong>
                        <div class="exeQuextIcons exeQuextIcons-Life"></div>
                        <p id="seleccionaPLifes-${instance}">0</p>
                    </div>
                    <div class="SLCNP-TimeNumber">
                        <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                        <div class="exeQuextIcons exeQuextIcons-Time" title="${msgs.msgTime}"></div>
                        <p id="seleccionaPTime-${instance}" class="SLCNP-PTime">00:00</p>
                        <a href="#" class="SLCNP-LinkMinimize" id="seleccionaLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                            <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Minimize SLCNP-Activo"></div>
                        </a>
                        <a href="#" class="SLCNP-LinkFullScreen" id="seleccionaLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                            <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-FullScreen SLCNP-Activo" id="seleccionaFullScreen-${instance}"></div>
                        </a>
                    </div>
                </div>
                <div class="SLCNP-ShowClue" id="seleccionaShowClue-${instance}">
                    <div class="sr-av">${msgs.msgClue}:</div>
                    <p class="SLCNP-PShowClue SLCNP-parpadea" id="seleccionaPShowClue-${instance}"></p>
                </div>
                <div class="SLCNP-Multimedia" id="seleccionaMultimedia-${instance}">
                    <img class="SLCNP-Cursor" id="seleccionaCursor-${instance}" src="${path}exequextcursor.gif" alt="" />
                    <img src="" class="SLCNP-Images" id="seleccionaImagen-${instance}" alt="${msgs.msgNoImage}" />
                    <div class="SLCNP-EText" id="seleccionaEText-${instance}"></div>
                    <img src="${path}seleccionaHome.png" class="SLCNP-Cover" id="seleccionaCover-${instance}" alt="${msgs.msgNoImage}" />
                    <div class="SLCNP-Video" id="seleccionaVideo-${instance}"></div>
                    <video class="SLCNP-Video" id="seleccionaVideoLocal-${instance}" preload="auto" controls></video>
                    <div class="SLCNP-Protector" id="seleccionaProtector-${instance}"></div>
                    <a href="#" class="SLCNP-LinkAudio" id="seleccionaLinkAudio-${instance}" title="${msgs.msgAudio}">
                        <img src="${path}exequextaudio.png" class="SLCNP-Activo" alt="${msgs.msgAudio}" />
                    </a>
                    <div class="SLCNP-GameOver" id="seleccionaGamerOver-${instance}">
                        <div class="SLCNP-DataImage">
                            <img src="${path}exequextwon.png" class="SLCNP-HistGGame" id="seleccionaHistGame-${instance}" alt="${msgs.msgAllQuestions}" />
                            <img src="${path}exequextlost.png" class="SLCNP-LostGGame" id="seleccionaLostGame-${instance}" alt="${msgs.msgLostLives}" />
                        </div>
                        <div class="SLCNP-DataScore">
                            <p id="seleccionaOverScore-${instance}">Score: 0</p>
                            <p id="seleccionaOverHits-${instance}">Hits 0</p>
                            <p id="seleccionaOverErrors-${instance}">Errors: 0</p>
                        </div>
                    </div>
                </div>
                <div class="SLCNP-AuthorLicence" id="seleccionaAuthorLicence-${instance}">
                    <div class="sr-av">${msgs.msgAuthor}:</div>
                    <p id="seleccionaPAuthor-${instance}"></p>
                </div>
                <div class="sr-av" id="seleccionaStartGameSRAV-${instance}">${msgs.msgPlayStart}:</div>
                <div class="SLCNP-StartGame"><a href="#" id="seleccionaStartGame-${instance}"></a></div>
                <div class="SLCNP-QuestionDiv" id="seleccionaQuestionDiv-${instance}">
                    <div class="sr-av">${msgs.msgQuestion}:</div>
                    <div class="SLCNP-Question" id="seleccionaQuestion-${instance}"></div>
                    <div class="SLCNP-OptionsDiv" id="seleccionaOptionsDiv-${instance}">
                        ${$quickquestionsmultiplechoice.createOptions(msgs, instance)}
                    </div>
                </div>
                <div class="SLCNP-WordsDiv" id="seleccionaWordDiv-${instance}">
                    <div class="sr-av">${msgs.msgAnswer}:</div>
                    <div class="SLCNP-Prhase" id="seleccionaEPhrase-${instance}"></div>
                    <div class="sr-av">${msgs.msgQuestion}:</div>
                    <div class="SLCNP-Definition" id="seleccionaDefinition-${instance}"></div>
                    <div class="SLCNP-DivReply" id="seleccionaDivResponder-${instance}">
                        <input type="text" value="" class="SLCNP-EdReply form-control" id="seleccionaEdAnswer-${instance}" autocomplete="off">
                        <a href="#" id="seleccionaBtnReply-${instance}" title="${msgs.msgAnswer}">
                            <strong class="sr-av">${msgs.msgAnswer}</strong>
                            <div class="exeQuextIcons-Submit SLCNP-Activo"></div>
                        </a>
                    </div>
                </div>
                <div class="SLCNP-BottonContainerDiv" id="seleccionaBottonContainer-${instance}">
                    <a href="#" class="SLCNP-LinkVideoIntroShow" id="seleccionaLinkVideoIntroShow-${instance}" title="${msgs.msgVideoIntro}">
                        <strong class="sr-av">${msgs.msgVideoIntro}:</strong>
                        <div class="exeQuextIcons exeQuextIcons-Video"></div>
                    </a>
                    <div class="SLCNP-AnswersDiv" id="seleccionaAnswerDiv-${instance}">
                        <div class="SLCNP-Answers" id="seleccionaAnswers-${instance}"></div>
                        <a href="#" id="seleccionaButtonAnswer-${instance}" title="${msgs.msgAnswer}">
                            <strong class="sr-av">${msgs.msgAnswer}</strong>
                            <div class="exeQuextIcons-Submit SLCNP-Activo"></div>
                        </a>
                    </div>
                </div>
                <div class="SLCNP-VideoIntroDiv" id="seleccionaVideoIntroDiv-${instance}">
                    <div class="SLCNP-VideoIntro" id="seleccionaVideoIntro-${instance}"></div>
                    <video class="SLCNP-Video" id="seleccionaVideoIntroLocal-${instance}" preload="auto" controls></video>
                    <input type="button" class="SLCNP-VideoIntroClose" id="seleccionaVideoIntroClose-${instance}" value="${msgs.msgClose}" />
                </div>
                <div class="SLCNP-DivFeedBack" id="seleccionaDivFeedBack-${instance}">
                    <input type="button" id="seleccionaFeedBackClose-${instance}" value="${msgs.msgClose}" class="feedbackbutton" />
                </div>
                <div class="SLCNP-DivModeBoard" id="seleccionaDivModeBoard-${instance}">
                    <a class="SLCNP-ModeBoard" href="#" id="seleccionaModeBoardOK-${instance}" title="${msgs.msgCorrect}">${msgs.msgCorrect}</a>
                    <a class="SLCNP-ModeBoard" href="#" id="seleccionaModeBoardMoveOn-${instance}" title="${msgs.msgMoveOne}">${msgs.msgMoveOne}</a>
                    <a class="SLCNP-ModeBoard" href="#" id="seleccionaModeBoardKO-${instance}" title="${msgs.msgIncorrect}">${msgs.msgIncorrect}</a>
                </div>                
            </div>
            <div class="SLCNP-Cubierta" id="seleccionaCubierta-${instance}" style="display:none">
                    <div class="SLCNP-CodeAccessDiv" id="seleccionaCodeAccessDiv-${instance}">
                        <p class="SLCNP-MessageCodeAccessE" id="seleccionaMesajeAccesCodeE-${instance}"></p>
                        <div class="SLCNP-DataCodeAccessE">
                            <label for="seleccionaCodeAccessE-${instance}" class="sr-av">${msgs.msgCodeAccess}:</label>
                            <input type="text" class="SLCNP-CodeAccessE form-control" id="seleccionaCodeAccessE-${instance}" placeholder="${msgs.msgCodeAccess}">
                            <a href="#" id="seleccionaCodeAccessButton-${instance}" title="${msgs.msgSubmit}">
                                <strong class="sr-av">${msgs.msgSubmit}</strong>
                                <div class="exeQuextIcons exeQuextIcons-Submit SLCNP-Activo"></div>
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
    createOptions: function (msgs, instance) {
        let optionss = ['A', 'B', 'C', 'D']
            .map(
                (option, index) => `
            <div class="sr-av">${msgs.msgOption} ${option}:</div>
            <a href="#" class="SLCNP-Option${index + 1} SLCNP-Options" id="seleccionaOption${index + 1}-${instance}" data-number="${index}"></a>
        `
            )
            .join('');

        return optionss;
    },

    showCubiertaOptions(mode, instance) {
        if (mode === false) {
            $('#seleccionaCubierta-' + instance).fadeOut();
            return;
        }
        $('#seleccionaCubierta-' + instance).fadeIn();
    },

    loadDataGame: function (data, imgsLink, audioLink) {
        let json = $exeDevices.iDevice.gamification.helpers.decrypt(
                data.text()
            ),
            mOptions =
                $exeDevices.iDevice.gamification.helpers.isJsonString(json);
        mOptions.gameOver = false;
        mOptions.hasVideo = false;
        mOptions.waitStart = false;
        mOptions.waitPlayIntro = false;
        mOptions.hasVideoIntro = false;
        mOptions.gameStarted = false;
        mOptions.scoreGame = 0;
        mOptions.player = null;
        mOptions.playerIntro = null;
        mOptions.percentajeQuestions =
            typeof mOptions.percentajeQuestions != 'undefined'
                ? mOptions.percentajeQuestions
                : 100;
        mOptions.modeBoard =
            typeof mOptions.modeBoard == 'undefined'
                ? false
                : mOptions.modeBoard;

        for (let i = 0; i < mOptions.selectsGame.length; i++) {
            mOptions.selectsGame[i].audio =
                typeof mOptions.selectsGame[i].audio == 'undefined'
                    ? ''
                    : mOptions.selectsGame[i].audio;
            mOptions.selectsGame[i].hit =
                typeof mOptions.selectsGame[i].hit == 'undefined'
                    ? 0
                    : mOptions.selectsGame[i].hit;
            mOptions.selectsGame[i].error =
                typeof mOptions.selectsGame[i].error == 'undefined'
                    ? 0
                    : mOptions.selectsGame[i].error;
            mOptions.selectsGame[i].msgHit =
                typeof mOptions.selectsGame[i].msgHit == 'undefined'
                    ? ''
                    : mOptions.selectsGame[i].msgHit;
            mOptions.selectsGame[i].msgError =
                typeof mOptions.selectsGame[i].msgError == 'undefined'
                    ? ''
                    : mOptions.selectsGame[i].msgError;
            if (mOptions.selectsGame[i].type != 2) {
                mOptions.selectsGame[i].url =
                    $exeDevices.iDevice.gamification.media.extractURLGD(
                        mOptions.selectsGame[i].url
                    );
            }
            const idyt = $exeDevices.iDevice.gamification.media.getIDYoutube(
                mOptions.selectsGame[i].url
            );
            if (mOptions.selectsGame[i].type == 2 && idyt) {
                mOptions.hasVideo = true;
                $quickquestionsmultiplechoice.hasVideo = true;
            }
        }

        if (
            $exeDevices.iDevice.gamification.media.getIDYoutube(
                mOptions.idVideo
            )
        ) {
            mOptions.hasVideo = true;
            $quickquestionsmultiplechoice.hasVideo = true;
        }

        mOptions.scoreGame = 0;
        mOptions.scoreTotal = 0;
        mOptions.playerAudio = '';
        mOptions.gameMode =
            typeof mOptions.gameMode != 'undefined' ? mOptions.gameMode : 1;
        mOptions.percentajeFB =
            typeof mOptions.percentajeFB != 'undefined'
                ? mOptions.percentajeFB
                : 100;
        mOptions.useLives = mOptions.gameMode != 0 ? false : mOptions.useLives;
        mOptions.customMessages =
            typeof mOptions.customMessages != 'undefined'
                ? mOptions.customMessages
                : false;
        mOptions.audioFeedBach =
            typeof mOptions.audioFeedBach != 'undefined'
                ? mOptions.audioFeedBach
                : false;
        mOptions.customMessages =
            mOptions.order == 2 ? true : mOptions.customMessages;
        mOptions.gameOver = false;
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
            if (!isNaN(iq) && iq < mOptions.selectsGame.length) {
                mOptions.selectsGame[iq].url = $(this).attr('href');
                if (
                    mOptions.selectsGame[iq].url.length < 4 &&
                    mOptions.selectsGame[iq].type == 1
                ) {
                    mOptions.selectsGame[iq].url = '';
                }
            }
        });

        audioLink.each(function () {
            const iq = parseInt($(this).text());
            if (!isNaN(iq) && iq < mOptions.selectsGame.length) {
                mOptions.selectsGame[iq].audio = $(this).attr('href');
                if (mOptions.selectsGame[iq].audio.length < 4) {
                    mOptions.selectsGame[iq].audio = '';
                }
            }
        });

        if (typeof mOptions.order == 'undefined') {
            mOptions.order = mOptions.optionsRamdon ? 1 : 0;
        }

        if (mOptions.order != 2 && mOptions.percentajeQuestions < 100) {
            mOptions.selectsGame =
                $exeDevices.iDevice.gamification.helpers.getQuestions(
                    mOptions.selectsGame,
                    mOptions.percentajeQuestions
                );
        }

        for (let i = 0; i < mOptions.selectsGame.length; i++) {
            if (mOptions.customScore || mOptions.order == 2) {
                mOptions.scoreTotal += mOptions.selectsGame[i].customScore;
            } else {
                mOptions.selectsGame[i].customScore = 1;
                mOptions.scoreTotal += mOptions.selectsGame[i].customScore;
            }
        }

        if (mOptions.order == 1) {
            mOptions.selectsGame =
                $exeDevices.iDevice.gamification.helpers.shuffleAds(
                    mOptions.selectsGame
                );
        }
        mOptions.numberQuestions = mOptions.selectsGame.length;
        return mOptions;
    },

    loadApiPlayer: function () {
        if (!this.hasVideo) return;

        $exeDevices.iDevice.gamification.media.YouTubeAPILoader.load()
            .then(() => this.activatePlayer())
            .catch(() => this.showStartedButton());
    },

    activatePlayer: function () {
        $quickquestionsmultiplechoice.options.forEach((option, i) => {
            if (
                $quickquestionsmultiplechoice.hasVideo &&
                (option.player === null || option.playerIntro == null)
            ) {
                option.player = new YT.Player(`seleccionaVideo-${i}`, {
                    width: '100%',
                    height: '100%',
                    videoId: '',
                    playerVars: {
                        color: 'white',
                        autoplay: 0,
                        controls: 0,
                    },
                    events: {
                        onReady:
                            $quickquestionsmultiplechoice.onPlayerReady.bind(
                                this
                            ),
                    },
                });

                option.playerIntro = new YT.Player(
                    'seleccionaVideoIntro-' + i,
                    {
                        width: '100%',
                        height: '100%',
                        videoId: '',
                        playerVars: {
                            color: 'white',
                            autoplay: 0,
                            controls: 1,
                        },
                    }
                );
            }
        });
    },

    youTubeReady: function () {
        this.activatePlayer();
    },

    showStartedButton: function () {
        $quickquestionsmultiplechoice.options.forEach((option, i) => {
            if (!option.gameStarted && !option.gameOver) {
                $(`#seleccionaStartGame-${ì}`).show();
                $quickquestionsmultiplechoice.showMessage(1, '', i);
            }
        });
    },

    onPlayerReady: function (event) {
        const iframe = event.target.getIframe();
        if (iframe && iframe.id) {
            const [prefix, instanceStr] = iframe.id.split('-');
            if (prefix === 'seleccionaVideo') {
                const instance = parseInt(instanceStr, 10);
                if (!isNaN(instance)) {
                    if (
                        $quickquestionsmultiplechoice.options &&
                        $quickquestionsmultiplechoice.options[instance] &&
                        !$quickquestionsmultiplechoice.options[instance]
                            .gameStarted
                    ) {
                        $(`#seleccionaStartGame-${instance}`).show();
                        $quickquestionsmultiplechoice.showMessage(
                            1,
                            '',
                            instance
                        );
                        if (
                            $quickquestionsmultiplechoice.options &&
                            $quickquestionsmultiplechoice.options[instance] &&
                            $quickquestionsmultiplechoice.options[instance]
                                .idVideo
                        ) {
                            $(
                                `#seleccionaLinkVideoIntroShow-${instance}`
                            ).show();
                        }
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

    playVideoIntro: function (instance) {
        $('#seleccionaVideoIntroDiv-' + instance).show();
        $('#seleccionaVideoIntro-' + instance).show();
        $('#seleccionaVideoIntroLocal-' + instance).hide();

        const mOptions = $quickquestionsmultiplechoice.options[instance],
            idVideo = $exeDevices.iDevice.gamification.media.getIDYoutube(
                mOptions.idVideo
            );

        mOptions.endVideo =
            mOptions.endVideo <= mOptions.startVideo
                ? 36000
                : mOptions.endVideo;

        $quickquestionsmultiplechoice.startVideoIntro(
            idVideo,
            mOptions.startVideo,
            mOptions.endVideo,
            instance,
            0
        );
    },

    startVideoIntro: function (id, start, end, instance, type) {
        const mOptions = $quickquestionsmultiplechoice.options[instance],
            mstart = start < 1 ? 0.1 : start;
        $('#seleccionaVideoIntro-' + instance).hide();
        $('#seleccionaVideoIntroLocal-' + instance).hide();

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
                let $node = $('#seleccionaMainContainer-' + instance);
                let $content = $('#node-content');
                if (
                    !$node.length ||
                    ($content.length && $content.attr('mode') === 'edition')
                ) {
                    clearInterval(mOptions.timeUpdateIntervalIntro);
                    return;
                }
                $quickquestionsmultiplechoice.updateTimerDisplayLocalIntro(
                    instance
                );
            }, 1000);
            $('#seleccionaVideoIntroLocal-' + instance).show();
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
            $('#seleccionaVideoIntro-' + instance).show();
        }
    },

    startVideo: function (id, start, end, instance, type) {
        const mOptions = $quickquestionsmultiplechoice.options[instance],
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
                let $node = $('#seleccionaMainContainer-' + instance);
                let $content = $('#node-content');
                if (
                    !$node.length ||
                    ($content.length && $content.attr('mode') === 'edition')
                ) {
                    clearInterval(mOptions.timeUpdateInterval);
                    return;
                }
                $quickquestionsmultiplechoice.updateTimerDisplayLocal(instance);
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

    playVideoIntroLocal(instance) {
        $('#seleccionaVideoIntroDiv-' + instance).show();
        $('#seleccionaVideoIntro-' + instance).hide();
        $('#seleccionaVideoIntroLocal-' + instance).show();

        const mOptions = $quickquestionsmultiplechoice.options[instance],
            idVideo =
                $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                    mOptions.idVideo
                );

        mOptions.endVideo =
            mOptions.endVideo <= mOptions.startVideo
                ? 36000
                : mOptions.endVideo;

        $quickquestionsmultiplechoice.startVideoIntro(
            idVideo,
            mOptions.startVideo,
            mOptions.endVideo,
            mOptions,
            instance,
            1
        );
    },

    updateTimerDisplayLocal: function (instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance];
        if (mOptions.localPlayer && mOptions.localPlayer.currentTime) {
            const currentTime = mOptions.localPlayer.currentTime;
            $quickquestionsmultiplechoice.updateSoundVideoLocal(instance);
            if (
                Math.ceil(currentTime) === mOptions.pointEnd ||
                Math.ceil(currentTime) === mOptions.durationVideo
            ) {
                mOptions.localPlayer.pause();
                mOptions.pointEnd = 100000;
            }
        }
    },

    updateSoundVideoLocal: function (instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance];
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

    updateTimerDisplayLocalIntro: function (instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance];
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

    updateTimerDisplay: function () {},
    updateProgressBar: function () {},
    onPlayerError: function () {},

    removeEvents: function (instance) {
        $(window).off('unload.exeSelecciona beforeunload.exeSelecciona');
        $(`#seleccionaLinkMaximize-${instance}`).off('click touchstart');
        $(`#seleccionaLinkMinimize-${instance}`).off('click touchstart');
        $('#seleccionaMainContainer-' + instance)
            .closest('.idevice_node')
            .off('click', '.Games-SendScore');
        $(`#seleccionaCodeAccessButton-${instance}`).off('click touchstart');
        $(`#seleccionaCodeAccessE-${instance}`).off('keydown');
        $(`#seleccionaBtnMoveOn-${instance}`).off('click');
        $(`#seleccionaBtnReply-${instance}`).off('click');
        $(`#seleccionaEdAnswer-${instance}`).off('keydown');
        $(`#seleccionaOptionsDiv-${instance}`)
            .find('.SLCNP-Options')
            .off('click');
        $(`#seleccionaLinkFullScreen-${instance}`).off('click touchstart');
        $(`#seleccionaButtonAnswer-${instance}`).off('click touchstart');
        $(`#seleccionaStartGame-${instance}`).off('click');
        $(`#seleccionaVideoIntroClose-${instance}`).off('click');
        $(`#seleccionaFeedBackClose-${instance}`).off('click');
        $(`#seleccionaLinkAudio-${instance}`).off('click');
        $(`#seleccionaLinkVideoIntroShow-${instance}`).off('click touchstart');
        $(`#seleccionaModeBoardOK-${instance}`).off('click');
        $(`#seleccionaModeBoardKO-${instance}`).off('click');
        $(`#seleccionaModeBoardMoveOn-${instance}`).off('click');
    },

    addEvents: function (instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance];

        mOptions.respuesta = '';

        $quickquestionsmultiplechoice.removeEvents(instance);
        $(window).on('unload.exeSelecciona beforeunload.exeSelecciona', () => {
            $exeDevices.iDevice.gamification.scorm.endScorm(
                $quickquestionsmultiplechoice.mScorm
            );
        });

        mOptions.localPlayer = document.getElementById(
            `seleccionaVideoLocal-${instance}`
        );
        mOptions.localPlayerIntro = document.getElementById(
            `seleccionaVideoIntroLocal-${instance}`
        );

        $(`#seleccionaGamerOver-${instance}`).css('display', 'flex');

        $(`#seleccionaLinkMaximize-${instance}`).on('click touchstart', (e) => {
            e.preventDefault();
            $(`#seleccionaGameContainer-${instance}`).show();
            $(`#seleccionaGameMinimize-${instance}`).hide();
            $quickquestionsmultiplechoice.refreshGame(instance);
        });

        $(`#seleccionaLinkMinimize-${instance}`).on('click touchstart', (e) => {
            e.preventDefault();
            $(`#seleccionaGameContainer-${instance}`).hide();
            $(`#seleccionaGameMinimize-${instance}`)
                .css('visibility', 'visible')
                .show();
            return true;
        });

        $('#seleccionaMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $quickquestionsmultiplechoice.sendScore(false, instance);
                $quickquestionsmultiplechoice.saveEvaluation(instance);
                return true;
            });

        $(
            `#seleccionaGamerOver-${instance}, #seleccionaCodeAccessDiv-${instance}, #seleccionaVideo-${instance}, #seleccionaVideoLocal-${instance}, #seleccionaImagen-${instance}, #seleccionaCursor-${instance}, #seleccionaAnswerDiv-${instance}`
        ).hide();
        $(`#seleccionaCover-${instance}`).show();

        $(`#seleccionaCodeAccessButton-${instance}`).on(
            'click touchstart',
            (e) => {
                e.preventDefault();
                $quickquestionsmultiplechoice.enterCodeAccess(instance);
            }
        );

        $(`#seleccionaCodeAccessE-${instance}`).on('keydown', (event) => {
            if (event.which === 13 || event.keyCode === 13) {
                $quickquestionsmultiplechoice.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        $(`#seleccionaBtnMoveOn-${instance}`).on('click', (e) => {
            e.preventDefault();
            $quickquestionsmultiplechoice.newQuestion(instance, false, false);
        });

        $(`#seleccionaBtnReply-${instance}`).on('click', (e) => {
            e.preventDefault();
            $quickquestionsmultiplechoice.answerQuestion(instance);
        });

        $(`#seleccionaEdAnswer-${instance}`).on('keydown', (event) => {
            if (event.which === 13 || event.keyCode === 13) {
                $quickquestionsmultiplechoice.answerQuestion(instance);
                return false;
            }
            return true;
        });

        mOptions.livesLeft = mOptions.numberLives;

        $(`#seleccionaOptionsDiv-${instance}`)
            .find('.SLCNP-Options')
            .on('click', function (e) {
                e.preventDefault();
                $quickquestionsmultiplechoice.changeQuextion(instance, this);
            });

        $(`#seleccionaLinkFullScreen-${instance}`).on(
            'click touchstart',
            (e) => {
                e.preventDefault();
                const element = document.getElementById(
                    `seleccionaGameContainer-${instance}`
                );
                $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                    element
                );
            }
        );

        $quickquestionsmultiplechoice.updateLives(instance);
        $(`#seleccionaInstructions-${instance}`).text(mOptions.instructions);
        $(`#seleccionaPNumber-${instance}`).text(mOptions.numberQuestions);
        $(`#seleccionaGameContainer-${instance} .SLCNP-StartGame`).show();
        $(`#seleccionaQuestionDiv-${instance}`).hide();
        $(`#seleccionaBottonContainer-${instance}`).addClass(
            'SLCNP-BottonContainerDivEnd'
        );

        if (mOptions.itinerary.showCodeAccess) {
            $(`#seleccionaAnswerDiv-${instance}`).hide();
            $(`#seleccionaMesajeAccesCodeE-${instance}`).text(
                mOptions.itinerary.messageCodeAccess
            );
            $(`#seleccionaCodeAccessDiv-${instance}`).show();
            $(`#seleccionaGameContainer-${instance} .SLCNP-StartGame`).hide();
            $quickquestionsmultiplechoice.showCubiertaOptions(true, instance);
        }

        $(`#seleccionaInstruction-${instance}`).text(mOptions.instructions);
        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        document.title = mOptions.title;
        $('meta[name=author]').attr('content', mOptions.author);
        $(`#seleccionaPShowClue-${instance}`).hide();
        mOptions.gameOver = false;

        $(`#seleccionaButtonAnswer-${instance}`).on('click touchstart', (e) => {
            e.preventDefault();
            $quickquestionsmultiplechoice.answerQuestion(instance);
        });

        $(`#seleccionaStartGame-${instance}`)
            .text(mOptions.msgs.msgPlayStart)
            .on('click', (e) => {
                e.preventDefault();
                $quickquestionsmultiplechoice.startGame(instance);
            });

        $(`#seleccionaVideoIntroClose-${instance}`).on('click', (e) => {
            e.preventDefault();
            $(`#seleccionaVideoIntroDiv-${instance}`).hide();
            $(`#seleccionaStartGame-${instance}`).text(
                mOptions.msgs.msgPlayStart
            );
            $quickquestionsmultiplechoice.stopVideoIntro(mOptions);
        });

        $(`#seleccionaFeedBackClose-${instance}`).on('click', () => {
            $(`#seleccionaDivFeedBack-${instance}`).hide();
        });

        $(`#seleccionaLinkAudio-${instance}`).on('click', (e) => {
            e.preventDefault();
            const audio = mOptions.selectsGame[mOptions.activeQuestion].audio;
            $exeDevices.iDevice.gamification.media.playSound(audio, mOptions);
        });

        $(`#seleccionaLinkVideoIntroShow-${instance}`).on(
            'click touchstart',
            (e) => {
                e.preventDefault();
                if (
                    $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                        mOptions.idVideo
                    )
                ) {
                    $quickquestionsmultiplechoice.playVideoIntroLocal(instance);
                } else {
                    $quickquestionsmultiplechoice.playVideoIntro(instance);
                }
            }
        );

        if (mOptions.gameMode === 2) {
            const $gameContainer = $(`#seleccionaGameContainer-${instance}`);
            $gameContainer
                .find(
                    '.exeQuextIcons-Hit, .exeQuextIcons-Error, .exeQuextIcons-Score'
                )
                .hide();
            $(
                `#seleccionaPErrors-${instance}, #seleccionaPHits-${instance}, #seleccionaPScore-${instance}`
            ).hide();
        }

        $(`#seleccionaWordDiv-${instance}`).hide();

        $(`#seleccionaModeBoardOK-${instance}`).on('click', (e) => {
            e.preventDefault();
            $quickquestionsmultiplechoice.answerQuestionBoard(true, instance);
        });

        $(`#seleccionaModeBoardKO-${instance}`).on('click', (e) => {
            e.preventDefault();
            $quickquestionsmultiplechoice.answerQuestionBoard(false, instance);
        });

        $(`#seleccionaModeBoardMoveOn-${instance}`).on('click', (e) => {
            e.preventDefault();
            $quickquestionsmultiplechoice.newQuestion(instance);
        });

        $(`#seleccionaLinkVideoIntroShow-${instance}`).hide();
        if (mOptions.hasVideo) {
            $(`#seleccionaStartGame-${instance}`).hide();
            $quickquestionsmultiplechoice.showMessage(
                0,
                'Cargando. Por favor, espere',
                instance
            );
        }

        setTimeout(() => {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                this.isInExe
            );
        }, 500);
    },

    saveEvaluation: function (instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance];
        mOptions.scorerp =
            mOptions.order == 2
                ? mOptions.score / 10
                : ((mOptions.scoreGame * 10) / mOptions.scoreTotal).toFixed(2);

        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $quickquestionsmultiplechoice.isInExe
        );
    },

    changeQuextion: function (instance, button) {
        const mOptions = $quickquestionsmultiplechoice.options[instance],
            numberButton = parseInt($(button).data('number'), 10),
            letters = 'ABCD',
            letter = letters[numberButton],
            bordeColors = [
                $quickquestionsmultiplechoice.borderColors.red,
                $quickquestionsmultiplechoice.borderColors.blue,
                $quickquestionsmultiplechoice.borderColors.green,
                $quickquestionsmultiplechoice.borderColors.yellow,
            ];
        let type = false;

        if (!mOptions.gameActived) return;

        if (!mOptions.respuesta.includes(letter)) {
            mOptions.respuesta += letter;
            type = true;
        } else {
            mOptions.respuesta = mOptions.respuesta.replace(letter, '');
        }
        const obj1 = {
            'border-size': 1,
            'border-color': bordeColors[numberButton],
            'background-color': bordeColors[numberButton],
            cursor: 'pointer',
            color: '#ffffff',
        };
        const obj2 = {
            'border-size': 1,
            'border-color': bordeColors[numberButton],
            'background-color': 'transparent',
            cursor: 'default',
            color: $quickquestionsmultiplechoice.colors.black,
        };

        const css = type ? obj1 : obj2;

        $(button).css(css);
        $(`#seleccionaAnswers-${instance} .SLCNP-AnswersOptions`).remove();

        for (let i = 0; i < mOptions.respuesta.length; i++) {
            const answerClass = `SLCNP-Answer${letters.indexOf(mOptions.respuesta[i]) + 1}`;
            $(`#seleccionaAnswers-${instance}`).append(
                `<div class="SLCNP-AnswersOptions ${answerClass}"></div>`
            );
        }
    },

    showImage: function (url, instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance],
            mQuestion = mOptions.selectsGame[mOptions.activeQuestion],
            $cursor = $(`#seleccionaCursor-${instance}`),
            $noImage = $(`#seleccionaCover-${instance}`),
            $image = $(`#seleccionaImagen-${instance}`),
            $author = $(`#seleccionaAuthor-${instance}`),
            $protect = $(`#seleccionaProtector-${instance}`);

        $image.attr('alt', 'No image');
        $cursor.hide();
        $image.hide();
        $noImage.hide();
        $protect.hide();

        if ($.trim(url).length === 0) {
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
                    $quickquestionsmultiplechoice.centerImage(instance);
                }
            })
            .on('error', function () {
                $cursor.hide();
                $image.hide();
                $noImage.show();
                $author.text('');
                return false;
            });

        $quickquestionsmultiplechoice.showMessage(
            0,
            mQuestion.author,
            instance
        );
    },

    refreshGame: function (instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance];
        if (!mOptions) return;

        const mQuestion = mOptions.selectsGame[mOptions.activeQuestion];

        if (!mQuestion) return;

        if (mQuestion.type === 1 && mQuestion.url && mQuestion.url.length > 3) {
            $quickquestionsmultiplechoice.centerImage(instance);
        }
    },

    centerImage: function (instance) {
        const $image = $(`#seleccionaImagen-${instance}`);

        if ($image.length === 0) return;

        const wDiv = $image.parent().width() || 1,
            hDiv = $image.parent().height() || 1,
            naturalWidth = $image[0].naturalWidth,
            naturalHeight = $image[0].naturalHeight,
            varW = naturalWidth / wDiv,
            varH = naturalHeight / hDiv;

        let wImage = wDiv,
            hImage = hDiv,
            xImage = 0,
            yImage = 0;

        if (varW > varH) {
            wImage = wDiv;
            hImage = Math.round(naturalHeight / varW);
            yImage = Math.round((hDiv - hImage) / 2);
        } else {
            wImage = Math.round(naturalWidth / varH);
            hImage = hDiv;
            xImage = Math.round((wDiv - wImage) / 2);
        }

        $image.css({
            width: wImage,
            height: hImage,
            position: 'absolute',
            left: xImage,
            top: yImage,
        });

        $quickquestionsmultiplechoice.positionPointer(instance);
    },

    positionPointer: function (instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance],
            mQuestion = mOptions.selectsGame[mOptions.activeQuestion],
            x = parseFloat(mQuestion.x) || 0,
            y = parseFloat(mQuestion.y) || 0,
            $cursor = $(`#seleccionaCursor-${instance}`);

        $cursor.hide();

        if (x > 0 || y > 0) {
            const containerElement = document.getElementById(
                    `seleccionaMultimedia-${instance}`
                ),
                containerPos = containerElement.getBoundingClientRect(),
                imgElement = document.getElementById(
                    `seleccionaImagen-${instance}`
                ),
                imgPos = imgElement.getBoundingClientRect(),
                marginTop = imgPos.top - containerPos.top,
                marginLeft = imgPos.left - containerPos.left,
                posX = marginLeft + x * imgPos.width,
                posY = marginTop + y * imgPos.height;

            $cursor.css({ left: posX, top: posY, 'z-index': 3 }).show();
        }
    },

    enterCodeAccess: function (instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance],
            codeEntered = $(`#seleccionaCodeAccessE-${instance}`)
                .val()
                .toLowerCase(),
            correctCode = mOptions.itinerary.codeAccess.toLowerCase();

        if (codeEntered === correctCode) {
            $quickquestionsmultiplechoice.showCubiertaOptions(false, instance);
            $quickquestionsmultiplechoice.startGame(instance);
            $(`#seleccionaLinkMaximize-${instance}`).trigger('click');
        } else {
            $(`#seleccionaMesajeAccesCodeE-${instance}`)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $(`#seleccionaCodeAccessE-${instance}`).val('');
        }
    },

    showScoreGame: function (type, instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance],
            msgs = mOptions.msgs,
            $seleccionaHistGame = $(`#seleccionaHistGame-${instance}`),
            $seleccionaLostGame = $(`#seleccionaLostGame-${instance}`),
            $seleccionaOverPoint = $(`#seleccionaOverScore-${instance}`),
            $seleccionaOverHits = $(`#seleccionaOverHits-${instance}`),
            $seleccionaOverErrors = $(`#seleccionaOverErrors-${instance}`),
            $seleccionaPShowClue = $(`#seleccionaPShowClue-${instance}`),
            $seleccionaGamerOver = $(`#seleccionaGamerOver-${instance}`);

        let message = '',
            messageColor = 2;

        $seleccionaHistGame.hide();
        $seleccionaLostGame.hide();
        $seleccionaOverPoint.show();
        $seleccionaOverHits.show();
        $seleccionaOverErrors.show();
        $seleccionaPShowClue.hide();

        switch (parseInt(type, 10)) {
            case 0:
                message = `${msgs.msgCool} ${msgs.msgAllQuestions}`;
                $seleccionaHistGame.show();
                if (mOptions.itinerary.showClue) {
                    if (mOptions.obtainedClue) {
                        message = msgs.msgAllQuestions;
                        $seleccionaPShowClue
                            .text(
                                `${msgs.msgInformation}: ${mOptions.itinerary.clueGame}`
                            )
                            .show();
                    } else {
                        $seleccionaPShowClue
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
                $seleccionaLostGame.show();
                if (mOptions.itinerary.showClue) {
                    if (mOptions.obtainedClue) {
                        $seleccionaPShowClue
                            .text(
                                `${msgs.msgInformation}: ${mOptions.itinerary.clueGame}`
                            )
                            .show();
                    } else {
                        $seleccionaPShowClue
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
                $seleccionaOverPoint.hide();
                $seleccionaOverHits.hide();
                $seleccionaOverErrors.hide();
                $seleccionaPShowClue.text(mOptions.itinerary.clueGame).show();
                break;
            default:
                break;
        }

        $quickquestionsmultiplechoice.showMessage(
            messageColor,
            message,
            instance
        );

        const scoreText =
            mOptions.gameMode === 0
                ? `${msgs.msgScore}: ${mOptions.score}`
                : `${msgs.msgScore}: ${mOptions.score.toFixed(2)}`;

        $seleccionaOverPoint.html(scoreText);
        $seleccionaOverHits.html(`${msgs.msgHits}: ${mOptions.hits}`);
        $seleccionaOverErrors.html(`${msgs.msgErrors}: ${mOptions.errors}`);

        if (mOptions.gameMode === 2) {
            $(`#seleccionaGameContainer-${instance}`)
                .find('.SLCNP-DataGameScore')
                .hide();
        }

        $seleccionaGamerOver.show();
    },

    startGame: function (instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance];
        if (mOptions.gameStarted) return;

        mOptions.scoreGame = 0;
        mOptions.obtainedClue = false;

        $(
            `#seleccionaVideoIntroContainer-${instance}, #seleccionaLinkVideoIntroShow-${instance}, #seleccionaPShowClue-${instance}`
        ).hide();
        $(`#seleccionaGameContainer-${instance} .SLCNP-StartGame`).hide();
        $(`#seleccionaQuestion-${instance}`).text('');
        $(`#seleccionaQuestionDiv-${instance}`).show();
        $(`#seleccionaWordDiv-${instance}`).hide();

        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.gameActived = false;
        mOptions.activeQuestion = -1;
        mOptions.validQuestions = mOptions.numberQuestions;
        mOptions.counter = 0;
        mOptions.gameStarted = false;
        mOptions.livesLeft = mOptions.numberLives;

        $quickquestionsmultiplechoice.updateLives(instance);
        $(`#seleccionaPNumber-${instance}`).text(mOptions.numberQuestions);

        mOptions.selectsGame.forEach((question) => {
            question.answerScore = -1;
        });

        mOptions.counterClock = setInterval(() => {
            if (mOptions.gameStarted && mOptions.activeCounter) {
                let $node = $('#seleccionaMainContainer-' + instance);
                let $content = $('#node-content');
                if (
                    !$node.length ||
                    ($content.length && $content.attr('mode') === 'edition')
                ) {
                    clearInterval(mOptions.counterClock);
                    return;
                }
                mOptions.counter--;
                $quickquestionsmultiplechoice.updateTime(
                    mOptions.counter,
                    instance
                );
                $quickquestionsmultiplechoice.updateSoundVideo(instance);

                if (mOptions.counter <= 0) {
                    mOptions.activeCounter = false;
                    let timeShowSolution = 1000;
                    if (mOptions.showSolution) {
                        timeShowSolution = mOptions.timeShowSolution * 1000;
                        if (
                            !$quickquestionsmultiplechoice.sameQuestion(
                                false,
                                instance
                            )
                        ) {
                            const currentQuestion =
                                mOptions.selectsGame[mOptions.activeQuestion];
                            if (currentQuestion.typeSelect !== 2) {
                                $quickquestionsmultiplechoice.drawSolution(
                                    instance
                                );
                            } else {
                                $quickquestionsmultiplechoice.drawPhrase(
                                    currentQuestion.solutionQuestion,
                                    currentQuestion.quextion,
                                    100,
                                    1,
                                    false,
                                    instance,
                                    true
                                );
                            }
                        }
                    }
                    setTimeout(() => {
                        $quickquestionsmultiplechoice.newQuestion(
                            instance,
                            false,
                            false
                        );
                    }, timeShowSolution);
                    return;
                }
            }
        }, 1000);

        $quickquestionsmultiplechoice.updateTime(0, instance);
        $(`#seleccionaGamerOver-${instance}`).hide();
        $(`#seleccionaPHits-${instance}`).text(mOptions.hits);
        $(`#seleccionaPErrors-${instance}`).text(mOptions.errors);
        $(`#seleccionaPScore-${instance}`).text(mOptions.score);

        mOptions.gameStarted = true;
        $quickquestionsmultiplechoice.newQuestion(instance, false, true);
    },

    updateSoundVideo: function (instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance];
        if (
            mOptions.activeSilent &&
            mOptions.player &&
            typeof mOptions.player.getCurrentTime === 'function'
        ) {
            const time = Math.round(mOptions.player.getCurrentTime());
            if (time === mOptions.question.silentVideo) {
                mOptions.player.mute(instance);
            } else if (time === mOptions.endSilent) {
                mOptions.player.unMute(instance);
            }
        }
    },

    updateTime: function (tiempo, instance) {
        const mTime =
            $exeDevices.iDevice.gamification.helpers.getTimeToString(tiempo);
        $(`#seleccionaPTime-${instance}`).text(mTime);
    },

    gameOver: function (type, instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance];
        mOptions.gameStarted = false;
        mOptions.gameActived = false;
        clearInterval(mOptions.counterClock);

        $quickquestionsmultiplechoice.showImage('', instance);
        $(
            `#seleccionaDivModeBoard-${instance}, #seleccionaVideo-${instance}, #seleccionaVideoLocal-${instance}, #seleccionaLinkAudio-${instance}, #seleccionaImagen-${instance}, #seleccionaEText-${instance}, #seleccionaCursor-${instance}, #seleccionaCover-${instance}`
        ).hide();

        $quickquestionsmultiplechoice.stopVideo(instance);
        $exeDevices.iDevice.gamification.media.stopSound(mOptions);

        const message =
            type === 0
                ? mOptions.msgs.mgsAllQuestions
                : mOptions.msgs.msgLostLives;
        $quickquestionsmultiplechoice.showMessage(2, message, instance);
        $quickquestionsmultiplechoice.showScoreGame(type, instance);
        $quickquestionsmultiplechoice.clearQuestions(instance);
        $quickquestionsmultiplechoice.updateTime(0, instance);

        $(`#seleccionaPNumber-${instance}`).text('0');
        $(`#seleccionaStartGame-${instance}`).text(mOptions.msgs.msgNewGame);
        $(`#seleccionaGameContainer-${instance} .SLCNP-StartGame`).show();
        $(
            `#seleccionaQuestionDiv-${instance}, #seleccionaAnswerDiv-${instance}, #seleccionaWordDiv-${instance}`
        ).hide();

        mOptions.gameOver = true;

        if (mOptions.isScorm === 1) {
            if (
                mOptions.repeatActivity ||
                $quickquestionsmultiplechoice.initialScore === ''
            ) {
                const score = (
                    (mOptions.scoreGame * 10) /
                    mOptions.scoreTotal
                ).toFixed(2);
                $quickquestionsmultiplechoice.sendScore(true, instance);
                $(`#seleccionaRepeatActivity-${instance}`).text(
                    `${mOptions.msgs.msgYouScore}: ${score}`
                );
                $quickquestionsmultiplechoice.initialScore = score;
            }
        }
        $quickquestionsmultiplechoice.saveEvaluation(instance);
        $quickquestionsmultiplechoice.showFeedBack(instance);

        if (
            $exeDevices.iDevice.gamification.media.getIDYoutube(
                mOptions.idVideo
            ) !== '' ||
            $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                mOptions.idVideo
            )
        ) {
            $(`#seleccionaLinkVideoIntroShow-${instance}`).show();
        }

        clearInterval(mOptions.timeUpdateInterval);
        clearInterval(mOptions.timeUpdateIntervalIntro);
    },

    showFeedBack: function (instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance];
        let puntos = (mOptions.hits * 100) / mOptions.selectsGame.length;
        if (mOptions.order === 2) {
            puntos = mOptions.score * 10;
        }
        if (mOptions.gameMode === 2 || mOptions.feedBack) {
            if (puntos >= mOptions.percentajeFB) {
                $(`#seleccionaDivFeedBack-${instance}`)
                    .find('.selecciona-feedback-game')
                    .show();
                $(`#seleccionaDivFeedBack-${instance}`).show();
            } else {
                $quickquestionsmultiplechoice.showMessage(
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

    drawPhrase: function (
        phrase,
        definition,
        nivel,
        type,
        casesensitive,
        instance,
        solution
    ) {
        const $phraseContainer = $(`#seleccionaEPhrase-${instance}`);
        $phraseContainer.find('.SLCNP-Word').remove();

        $(
            `#seleccionaBtnReply-${instance}, #seleccionaBtnMoveOn-${instance}, #seleccionaEdAnswer-${instance}`
        ).prop('disabled', true);
        $(`#seleccionaQuestionDiv-${instance}`).hide();
        $(`#seleccionaWordDiv-${instance}`).show();
        $(`#seleccionaAnswerDiv-${instance}`).hide();

        if (!casesensitive) {
            phrase = phrase.toUpperCase();
        }

        const cPhrase = $quickquestionsmultiplechoice.clear(phrase),
            letterShow = $quickquestionsmultiplechoice.getShowLetter(
                cPhrase,
                nivel
            ),
            h = cPhrase.replace(/\s/g, '&');
        let nPhrase = [];

        for (let z = 0; z < h.length; z++) {
            nPhrase.push(h[z] !== '&' && !letterShow.includes(z) ? ' ' : h[z]);
        }

        nPhrase = nPhrase.join('');
        const phraseArray = nPhrase.split('&');

        phraseArray.forEach((cleanWord) => {
            if (cleanWord !== '') {
                const $wordDiv = $('<div class="SLCNP-Word"></div>').appendTo(
                    $phraseContainer
                );
                for (let char of cleanWord) {
                    let letterClass = 'blue';
                    if (type === 1) letterClass = 'red';
                    if (type === 2) letterClass = 'green';
                    $wordDiv.append(
                        `<div class="SLCNP-Letter ${letterClass}">${char}</div>`
                    );
                }
            }
        });

        if (!solution) {
            $(`#seleccionaDefinition-${instance}`).html(definition);
        }

        const htmlContent = $(`#seleccionaWordDiv-${instance}`).html();
        if ($exeDevices.iDevice.gamification.math.hasLatex(htmlContent)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                `seleccionaWordDiv-${instance}`
            );
        }

        return cPhrase;
    },

    clear: function (phrase) {
        return phrase.replace(/[&\s\n\r]+/g, ' ').trim();
    },

    getShowLetter: function (phrase, nivel) {
        const numberLetter = Math.floor((phrase.length * nivel) / 100),
            arrayRandom = [];
        while (arrayRandom.length < numberLetter) {
            const numberRandom = Math.floor(Math.random() * phrase.length);
            if (!arrayRandom.includes(numberRandom)) {
                arrayRandom.push(numberRandom);
            }
        }
        return arrayRandom.sort((a, b) => a - b);
    },

    showQuestion: function (i, instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance],
            mQuestion = mOptions.selectsGame[i];

        $quickquestionsmultiplechoice.clearQuestions(instance);
        mOptions.gameActived = true;
        mOptions.question = mQuestion;
        mOptions.respuesta = '';

        const time = $exeDevices.iDevice.gamification.helpers.getTimeToString(
            $exeDevices.iDevice.gamification.helpers.getTimeSeconds(
                mQuestion.time
            )
        );
        $(`#seleccionaPTime-${instance}`).text(time);
        $(`#seleccionaQuestion-${instance}`).html(mQuestion.quextion);

        $(
            `#seleccionaImagen-${instance}, #seleccionaEText-${instance}, #seleccionaVideo-${instance}, #seleccionaLinkAudio-${instance}, #seleccionaCursor-${instance}`
        ).hide();
        $(`#seleccionaCover-${instance}`).show();

        $quickquestionsmultiplechoice.stopVideo(instance);
        $quickquestionsmultiplechoice.showMessage(0, '', instance);

        if (mOptions.answersRamdon) {
            $quickquestionsmultiplechoice.ramdonOptions(instance);
        }

        const q = mQuestion;
        mOptions.activeSilent =
            q.type === 2 &&
            q.soundVideo === 1 &&
            q.tSilentVideo > 0 &&
            q.silentVideo >= q.iVideo &&
            q.iVideo < q.fVideo;
        const endSonido = parseInt(q.silentVideo) + parseInt(q.tSilentVideo);
        mOptions.endSilent = endSonido > q.fVideo ? q.fVideo : endSonido;

        $(`#seleccionaAuthor-${instance}`).text('');

        if (mQuestion.type === 1) {
            $quickquestionsmultiplechoice.showImage(mQuestion.url, instance);
        } else if (mQuestion.type === 3) {
            const text = unescape(mQuestion.eText);
            $(`#seleccionaEText-${instance}`).html(text).show();
            $(`#seleccionaCover-${instance}`).hide();
            $quickquestionsmultiplechoice.showMessage(0, '', instance);
        } else if (mQuestion.type === 2) {
            const idVideo = $exeDevices.iDevice.gamification.media.getIDYoutube(
                    mQuestion.url
                ),
                urlVideo =
                    $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                        mQuestion.url
                    ),
                type = urlVideo ? 1 : 0,
                id = type === 0 ? idVideo : urlVideo;

            $quickquestionsmultiplechoice.startVideo(
                id,
                q.iVideo,
                q.fVideo,
                instance,
                type
            );

            $quickquestionsmultiplechoice.showMessage(0, '', instance);

            $(
                `#seleccionaVideo-${instance}, #seleccionaVideoLocal-${instance}`
            ).hide();
            if (mQuestion.imageVideo === 0) {
                $(`#seleccionaCover-${instance}`).show();
            } else {
                if (type === 1) {
                    $(`#seleccionaVideoLocal-${instance}`).show();
                } else {
                    $(`#seleccionaVideo-${instance}`).show();
                }
            }
            if (mQuestion.soundVideo === 0) {
                $exeDevices.iDevice.gamification.media.muteVideo(
                    true,
                    mOptions
                );
            } else {
                $exeDevices.iDevice.gamification.media.muteVideo(
                    false,
                    instance
                );
            }
        }

        $(`#seleccionaDivModeBoard-${instance}`).hide();

        if (mQuestion.typeSelect !== 2) {
            $quickquestionsmultiplechoice.drawQuestions(instance);
        } else {
            $quickquestionsmultiplechoice.drawPhrase(
                mQuestion.solutionQuestion,
                mQuestion.quextion,
                mQuestion.percentageShow,
                mQuestion.typeSelect,
                false,
                instance,
                false
            );
            $(
                `#seleccionaBtnReply-${instance}, #seleccionaBtnMoveOn-${instance}, #seleccionaEdAnswer-${instance}`
            ).prop('disabled', false);
            $(`#seleccionaEdAnswer-${instance}`).focus().val('');

            if (mOptions.modeBoard) {
                $(`#seleccionaDivModeBoard-${instance}`)
                    .css('display', 'flex')
                    .fadeIn();
            }
        }

        if (mOptions.isScorm === 1) {
            if (
                mOptions.repeatActivity ||
                $quickquestionsmultiplechoice.initialScore === ''
            ) {
                const score = (
                    (mOptions.scoreGame * 10) /
                    mOptions.scoreTotal
                ).toFixed(2);
                $quickquestionsmultiplechoice.sendScore(true, instance);
                $(`#seleccionaRepeatActivity-${instance}`).text(
                    `${mOptions.msgs.msgYouScore}: ${score}`
                );
            }
        }

        if (q.audio.length > 4 && q.type !== 2 && !mOptions.audioFeedBach) {
            $(`#seleccionaLinkAudio-${instance}`).show();
        }

        $quickquestionsmultiplechoice.saveEvaluation(instance);
        $exeDevices.iDevice.gamification.media.stopSound(mOptions);

        if (
            q.type !== 2 &&
            q.audio.trim().length > 5 &&
            !mOptions.audioFeedBach
        ) {
            $exeDevices.iDevice.gamification.media.playSound(
                q.audio.trim(),
                mOptions
            );
        }
    },

    updateLives: function (instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance];
        $(`#seleccionaPLifes-${instance}`).text(mOptions.livesLeft);
        const $livesIcons = $(`#seleccionaLifesGame-${instance}`).find(
            '.exeQuextIcons-Life'
        );

        if (mOptions.useLives) {
            $livesIcons.each((index, element) => {
                $(element).toggle(index < mOptions.livesLeft);
            });
        } else {
            $livesIcons.hide();
            $(`#seleccionaNumberLivesGame-${instance}`).hide();
        }
    },

    newQuestion: function (instance, correctAnswer, start) {
        const mOptions = $quickquestionsmultiplechoice.options[instance];

        if (mOptions.useLives && mOptions.livesLeft <= 0) {
            $quickquestionsmultiplechoice.gameOver(1, instance);
            return;
        }

        const mActiveQuestion =
            $quickquestionsmultiplechoice.updateNumberQuestion(
                mOptions.activeQuestion,
                correctAnswer,
                start,
                instance
            );

        if (mActiveQuestion === null) {
            $(`#seleccionaPNumber-${instance}`).text('0');
            $quickquestionsmultiplechoice.gameOver(0, instance);
        } else {
            mOptions.counter =
                $exeDevices.iDevice.gamification.helpers.getTimeSeconds(
                    mOptions.selectsGame[mActiveQuestion].time
                );
            if (mOptions.selectsGame[mActiveQuestion].type === 2) {
                const durationVideo =
                    mOptions.selectsGame[mActiveQuestion].fVideo -
                    mOptions.selectsGame[mActiveQuestion].iVideo;
                mOptions.counter += durationVideo;
            }
            $quickquestionsmultiplechoice.showQuestion(
                mActiveQuestion,
                instance
            );
            mOptions.activeCounter = true;
            const numQ = mOptions.numberQuestions - mActiveQuestion;
            $(`#seleccionaPNumber-${instance}`).text(numQ);
        }
    },

    updateNumberQuestion: function (numq, correct, start, instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance];
        let numActiveQuestion = numq;

        if (mOptions.order === 2) {
            if (start) {
                numActiveQuestion = 0;
            } else if (mOptions.activeQuestion < 0) {
                numActiveQuestion = 0;
            } else if (
                (correct && mOptions.selectsGame[numq].hit === -2) ||
                (!correct && mOptions.selectsGame[numq].error === -2)
            ) {
                return null;
            } else if (
                (correct && mOptions.selectsGame[numq].hit === -1) ||
                (!correct && mOptions.selectsGame[numq].error === -1)
            ) {
                numActiveQuestion++;
                if (numActiveQuestion >= mOptions.numberQuestions) {
                    return null;
                }
            } else if (correct && mOptions.selectsGame[numq].hit >= 0) {
                numActiveQuestion = mOptions.selectsGame[numq].hit;
                if (numActiveQuestion >= mOptions.numberQuestions) {
                    return null;
                }
            } else if (!correct && mOptions.selectsGame[numq].error >= 0) {
                numActiveQuestion = mOptions.selectsGame[numq].error;
                if (numActiveQuestion >= mOptions.numberQuestions) {
                    return null;
                }
            }
        } else {
            numActiveQuestion++;
            if (numActiveQuestion >= mOptions.numberQuestions) {
                return null;
            }
        }

        mOptions.activeQuestion = numActiveQuestion;
        return numActiveQuestion;
    },

    getRetroFeedMessages: function (iHit, instance) {
        const msgs = $quickquestionsmultiplechoice.options[instance].msgs,
            sMessages = iHit ? msgs.msgSuccesses : msgs.msgFailures,
            messagesArray = sMessages.split('|');
        return messagesArray[Math.floor(Math.random() * messagesArray.length)];
    },

    answerQuestion: function (instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance],
            question = mOptions.selectsGame[mOptions.activeQuestion];

        if (!mOptions.gameActived) return;

        mOptions.gameActived = false;
        let correct = true,
            solution = question.solution,
            answer = mOptions.respuesta.toUpperCase();

        if (question.typeSelect === 2) {
            solution = question.solutionQuestion.toUpperCase();
            answer = $.trim(
                $(`#seleccionaEdAnswer-${instance}`).val()
            ).toUpperCase();
            if (answer.length === 0) {
                $quickquestionsmultiplechoice.showMessage(
                    1,
                    mOptions.msgs.msgIndicateWord,
                    instance
                );
                mOptions.gameActived = true;
                return;
            }
            correct = solution === answer;
        } else if (question.typeSelect === 1) {
            if (answer.length !== solution.length) {
                $quickquestionsmultiplechoice.showMessage(
                    1,
                    mOptions.msgs.msgOrders,
                    instance
                );
                mOptions.gameActived = true;
                return;
            }
            correct = solution === answer;
        } else {
            if (
                answer.length !== solution.length ||
                ![...answer].every((letter) => solution.includes(letter))
            ) {
                correct = false;
            }
        }

        mOptions.activeCounter = false;

        if (mOptions.order !== 2) {
            $quickquestionsmultiplechoice.updateScore(correct, instance);
        } else {
            $quickquestionsmultiplechoice.updateScoreThree(correct, instance);
        }

        if (
            mOptions.showSolution &&
            question.audio.trim().length > 5 &&
            mOptions.audioFeedBach
        ) {
            $exeDevices.iDevice.gamification.media.playSound(
                question.audio.trim(),
                mOptions
            );

            $(`#seleccionaLinkAudio-${instance}`).show();
        }

        let timeShowSolution = mOptions.showSolution
            ? mOptions.timeShowSolution * 1000
            : 1000;
        const percentageHits = (mOptions.hits / mOptions.numberQuestions) * 100;

        $(`#seleccionaPHits-${instance}`).text(mOptions.hits);
        $(`#seleccionaPErrors-${instance}`).text(mOptions.errors);

        if (
            mOptions.itinerary.showClue &&
            percentageHits >= mOptions.itinerary.percentageClue &&
            !mOptions.obtainedClue
        ) {
            timeShowSolution = 5000;
            $(`#seleccionaPShowClue-${instance}`)
                .text(
                    `${mOptions.msgs.msgInformation}: ${mOptions.itinerary.clueGame}`
                )
                .show();
            mOptions.obtainedClue = true;
        }

        if (
            mOptions.showSolution &&
            !$quickquestionsmultiplechoice.sameQuestion(correct, instance)
        ) {
            if (question.typeSelect !== 2) {
                $quickquestionsmultiplechoice.drawSolution(instance);
            } else {
                const mType = correct ? 2 : 1;
                $quickquestionsmultiplechoice.drawPhrase(
                    question.solutionQuestion,
                    question.quextion,
                    100,
                    mType,
                    false,
                    instance,
                    true
                );
            }
        }

        setTimeout(() => {
            $quickquestionsmultiplechoice.newQuestion(instance, correct, false);
        }, timeShowSolution);
    },

    answerQuestionBoard: function (value, instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance],
            question = mOptions.selectsGame[mOptions.activeQuestion];

        if (!mOptions.gameActived) return;

        mOptions.gameActived = false;
        mOptions.activeCounter = false;

        if (mOptions.order !== 2) {
            $quickquestionsmultiplechoice.updateScore(value, instance);
        } else {
            $quickquestionsmultiplechoice.updateScoreThree(value, instance);
        }

        if (
            mOptions.showSolution &&
            question.audio.trim().length > 5 &&
            mOptions.audioFeedBach
        ) {
            $exeDevices.iDevice.gamification.media.playSound(
                question.audio.trim(),
                mOptions
            );
            $(`#seleccionaLinkAudio-${instance}`).show();
        }

        let timeShowSolution = mOptions.showSolution
            ? mOptions.timeShowSolution * 1000
            : 1000;
        const percentageHits = (mOptions.hits / mOptions.numberQuestions) * 100;

        $(`#seleccionaPHits-${instance}`).text(mOptions.hits);
        $(`#seleccionaPErrors-${instance}`).text(mOptions.errors);

        if (
            mOptions.itinerary.showClue &&
            percentageHits >= mOptions.itinerary.percentageClue &&
            !mOptions.obtainedClue
        ) {
            timeShowSolution = 5000;
            message += ` ${mOptions.msgs.msgUseFulInformation}`;
            $(`#seleccionaPShowClue-${instance}`)
                .text(
                    `${mOptions.msgs.msgInformation}: ${mOptions.itinerary.clueGame}`
                )
                .show();
            mOptions.obtainedClue = true;
        }

        if (
            mOptions.showSolution &&
            !$quickquestionsmultiplechoice.sameQuestion(value, instance)
        ) {
            if (question.typeSelect !== 2) {
                $quickquestionsmultiplechoice.drawSolution(instance);
            } else {
                const mType = value ? 2 : 1;
                $quickquestionsmultiplechoice.drawPhrase(
                    question.solutionQuestion,
                    question.quextion,
                    100,
                    mType,
                    false,
                    instance,
                    true
                );
            }
        }

        setTimeout(() => {
            $quickquestionsmultiplechoice.newQuestion(instance, value, false);
        }, timeShowSolution);
    },

    sameQuestion: function (correct, instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance],
            q = mOptions.selectsGame[mOptions.activeQuestion];
        if (!q) return false;
        return (
            (correct && q.hits === mOptions.activeQuestion) ||
            (!correct && q.error === mOptions.activeQuestion)
        );
    },

    updateScore: function (correctAnswer, instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance],
            question = mOptions.selectsGame[mOptions.activeQuestion];
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
            } else {
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
                    $quickquestionsmultiplechoice.updateLives(instance);
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

        $(`#seleccionaPScore-${instance}`).text(sscore);
        $(`#seleccionaPHits-${instance}`).text(mOptions.hits);
        $(`#seleccionaPErrors-${instance}`).text(mOptions.errors);

        message = $quickquestionsmultiplechoice.getMessageAnswer(
            correctAnswer,
            points,
            instance
        );
        $quickquestionsmultiplechoice.showMessage(type, message, instance);
    },

    updateScoreThree: function (correctAnswer, instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance],
            question = mOptions.selectsGame[mOptions.activeQuestion],
            answerScore = question.answerScore;

        let message = '',
            obtainedPoints = 0,
            type = 1,
            sscore = 0,
            points = 0;

        if (correctAnswer) {
            question.answerScore = question.customScore;
            if (answerScore === -1 || answerScore === 0) {
                if (answerScore === 0) {
                    mOptions.errors--;
                }
                mOptions.hits++;
                if (mOptions.gameMode === 0) {
                    const pointsTemp =
                        mOptions.counter < 60 ? mOptions.counter * 10 : 600;
                    obtainedPoints = 1000 + pointsTemp;
                    obtainedPoints *= question.customScore;
                    points = obtainedPoints;
                } else {
                    obtainedPoints = question.customScore;
                    points =
                        obtainedPoints % 1 === 0
                            ? obtainedPoints
                            : obtainedPoints.toFixed(2);
                }
                type = 2;
                mOptions.scoreGame += question.customScore;
            }

            mOptions.score = Math.max(mOptions.score + obtainedPoints, 0);
            sscore =
                mOptions.gameMode !== 0
                    ? mOptions.score % 1 === 0
                        ? mOptions.score
                        : mOptions.score.toFixed(2)
                    : mOptions.score;

            message = $quickquestionsmultiplechoice.getMessageAnswer(
                correctAnswer,
                points,
                instance
            );
        } else {
            question.answerScore = 0;
            if (answerScore === -1 || answerScore > 0) {
                if (answerScore > 0) {
                    mOptions.hits--;
                    mOptions.scoreGame -= question.customScore;
                }
                mOptions.errors++;
                if (mOptions.gameMode === 0) {
                    obtainedPoints = -330 * question.customScore;
                    points = obtainedPoints;
                    if (mOptions.useLives) {
                        mOptions.livesLeft--;
                        $quickquestionsmultiplechoice.updateLives(instance);
                    }
                }
                mOptions.score = Math.max(mOptions.score + obtainedPoints, 0);
                sscore =
                    mOptions.gameMode !== 0
                        ? mOptions.score % 1 === 0
                            ? mOptions.score
                            : mOptions.score.toFixed(2)
                        : mOptions.score;

                message = $quickquestionsmultiplechoice.getMessageAnswer(
                    correctAnswer,
                    points,
                    instance
                );
            } else {
                message =
                    $quickquestionsmultiplechoice.getMessageErrorAnswerRepeat(
                        instance
                    );
            }
        }

        $(`#seleccionaPScore-${instance}`).text(sscore);
        $(`#seleccionaPHits-${instance}`).text(mOptions.hits);
        $(`#seleccionaPErrors-${instance}`).text(mOptions.errors);

        $quickquestionsmultiplechoice.showMessage(type, message, instance);
    },

    getMessageAnswer: function (correctAnswer, npts, instance) {
        const mse = $quickquestionsmultiplechoice.getMessageErrorAnswer(
            npts,
            instance
        );
        const msc = $quickquestionsmultiplechoice.getMessageCorrectAnswer(
            npts,
            instance
        );
        return correctAnswer ? msc : mse;
    },

    getMessageCorrectAnswer: function (npts, instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance],
            messageCorrect = $quickquestionsmultiplechoice.getRetroFeedMessages(
                true,
                instance
            ),
            pts = mOptions.msgs.msgPoints || 'puntos';
        let message = '';

        if (
            mOptions.customMessages &&
            mOptions.selectsGame[mOptions.activeQuestion].msgHit.length > 0
        ) {
            message = mOptions.selectsGame[mOptions.activeQuestion].msgHit;
            if (mOptions.gameMode < 2) {
                message += `. ${npts} ${pts}`;
            }
        } else {
            message =
                mOptions.gameMode === 2
                    ? messageCorrect
                    : `${messageCorrect} ${npts} ${pts}`;
        }

        return message;
    },

    getMessageErrorAnswer: function (npts, instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance],
            messageError = $quickquestionsmultiplechoice.getRetroFeedMessages(
                false,
                instance
            ),
            pts = mOptions.msgs.msgPoints || 'puntos';
        let message = '';

        if (
            mOptions.customMessages &&
            mOptions.selectsGame[mOptions.activeQuestion].msgError.length > 0
        ) {
            message = mOptions.selectsGame[mOptions.activeQuestion].msgError;
            if (mOptions.gameMode !== 2) {
                message += mOptions.useLives
                    ? `. ${mOptions.msgs.msgLoseLive}`
                    : `. ${npts} ${pts}`;
            }
        } else {
            message = mOptions.useLives
                ? `${messageError} ${mOptions.msgs.msgLoseLive}`
                : `${messageError} ${npts} ${pts}`;
            if (mOptions.gameMode > 0) {
                message = messageError;
            }
        }

        return message;
    },

    getMessageErrorAnswerRepeat: function (instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance];
        let message = $quickquestionsmultiplechoice.getRetroFeedMessages(
            false,
            instance
        );

        if (
            mOptions.customMessages &&
            mOptions.selectsGame[mOptions.activeQuestion].msgError.length > 0
        ) {
            message = mOptions.selectsGame[mOptions.activeQuestion].msgError;
        }

        return message;
    },

    getMessageCorrectAnswerRepeat: function (instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance];
        let message = $quickquestionsmultiplechoice.getRetroFeedMessages(
            true,
            instance
        );

        if (
            mOptions.customMessages &&
            mOptions.selectsGame[mOptions.activeQuestion].msgHit.length > 0
        ) {
            message = mOptions.selectsGame[mOptions.activeQuestion].msgHit;
        }

        return message;
    },

    showMessage: function (type, message, instance) {
        const colors = [
                '#555555',
                $quickquestionsmultiplechoice.borderColors.red,
                $quickquestionsmultiplechoice.borderColors.green,
                $quickquestionsmultiplechoice.borderColors.blue,
                $quickquestionsmultiplechoice.borderColors.yellow,
            ],
            mcolor = colors[type],
            weight = type === 0 ? 'normal' : 'normal';

        $(`#seleccionaPAuthor-${instance}`).html(message).css({
            color: mcolor,
            'font-weight': weight,
        });

        $exeDevices.iDevice.gamification.math.updateLatex(
            `#seleccionaPAuthor-${instance}`
        );
    },

    ramdonOptions: function (instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance],
            letters = 'ABCD',
            question = mOptions.question;

        if (question.typeSelect === 1) return;

        let l = 0;
        const solutions = question.solution;
        question.options.forEach((option) => {
            if (option.trim() !== '') l++;
        });

        const respuestas = question.options.slice(0, l),
            respuestasNuevas =
                $exeDevices.iDevice.gamification.helpers.shuffleAds(respuestas),
            respuestaCorrectas = solutions
                .split('')
                .map((letter) => question.options[letters.indexOf(letter)]);

        let solucionesNuevas = '';
        respuestasNuevas.forEach((respuesta, index) => {
            if (respuestaCorrectas.includes(respuesta)) {
                solucionesNuevas += letters[index];
            }
        });

        question.options = [...respuestasNuevas, '', '', '', ''].slice(0, 4);
        question.solution = solucionesNuevas;
    },

    drawQuestions: function (instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance],
            borderColors = [
                $quickquestionsmultiplechoice.borderColors.red,
                $quickquestionsmultiplechoice.borderColors.blue,
                $quickquestionsmultiplechoice.borderColors.green,
                $quickquestionsmultiplechoice.borderColors.yellow,
            ];

        $(`#seleccionaQuestionDiv-${instance}`).show();
        $(`#seleccionaWordDiv-${instance}`).hide();
        $(`#seleccionaAnswerDiv-${instance}`).show();

        $(`#seleccionaOptionsDiv-${instance} > .SLCNP-Options`).each(
            function (index) {
                const option = mOptions.question.options[index];
                $(this)
                    .css({
                        'border-color': borderColors[index],
                        'background-color': 'transparent',
                        cursor: 'pointer',
                        color: $quickquestionsmultiplechoice.colors.black,
                    })
                    .html(option || '')
                    .toggle(!!option);
            }
        );

        const html = $(`#seleccionaQuestionDiv-${instance}`).html();
        if ($exeDevices.iDevice.gamification.math.hasLatex(html)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                `seleccionaQuestionDiv-${instance}`
            );
        }
    },

    drawSolution: function (instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance],
            question = mOptions.selectsGame[mOptions.activeQuestion],
            solution = question.solution,
            letters = 'ABCD';

        mOptions.gameActived = false;

        $(`#seleccionaOptionsDiv-${instance}`)
            .find('.SLCNP-Options')
            .each(function (i) {
                let css = {
                    'border-color':
                        $quickquestionsmultiplechoice.borderColors.incorrect,
                    'border-size': '1',
                    'background-color': 'transparent',
                    cursor: 'pointer',
                    color: $quickquestionsmultiplechoice.borderColors.grey,
                };

                if (question.typeSelect === 1) {
                    css = {
                        'border-color':
                            $quickquestionsmultiplechoice.borderColors.correct,
                        'background-color':
                            $quickquestionsmultiplechoice.colors.correct,
                        'border-size': '1',
                        cursor: 'pointer',
                        color: $quickquestionsmultiplechoice.borderColors.black,
                    };
                    const text = question.options[letters.indexOf(solution[i])];
                    $(this).text(text);
                } else if (solution.includes(letters[i])) {
                    css = {
                        'border-color':
                            $quickquestionsmultiplechoice.borderColors.correct,
                        'background-color':
                            $quickquestionsmultiplechoice.colors.correct,
                        'border-size': '1',
                        cursor: 'pointer',
                        color: $quickquestionsmultiplechoice.borderColors.black,
                    };
                }

                $(this).css(css);
            });
    },

    clearQuestions: function (instance) {
        const mOptions = $quickquestionsmultiplechoice.options[instance];
        mOptions.respuesta = '';

        $(`#seleccionaAnswers-${instance} > .SLCNP-AnswersOptions`).remove();

        const borderColors = [
            $quickquestionsmultiplechoice.borderColors.red,
            $quickquestionsmultiplechoice.borderColors.blue,
            $quickquestionsmultiplechoice.borderColors.green,
            $quickquestionsmultiplechoice.borderColors.yellow,
        ];

        $(`#seleccionaOptionsDiv-${instance} > .SLCNP-Options`).each(
            function (index) {
                $(this)
                    .css({
                        'border-color': borderColors[index],
                        'background-color': 'transparent',
                        cursor: 'pointer',
                    })
                    .text('');
            }
        );
    },
};
$(function () {
    $quickquestionsmultiplechoice.init();
});
