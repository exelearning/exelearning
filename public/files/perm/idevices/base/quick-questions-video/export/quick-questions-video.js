/* eslint-disable no-undef */
/**
 * VideoQuExt iDevice (export code)
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno, Francisco Javier Pulido
 * Testers: Ricardo Málaga Floriano, Francisco Muñoz de la Peña
 * Translator: Antonio Juan Delgado García
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $quickquestionsvideo = {
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
    userName: '',
    previousScore: '',
    initialScore: '',
    msgs: '',
    youtubeLoaded: false,
    hasSCORMbutton: false,
    isInExe: false,
    hasVideo: false,
    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',
    mScorm: null,

    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            'VideoQuExt',
            'quick-questions-video',
            'vquext-IDevice'
        );
    },

    enable: function () {
        $quickquestionsvideo.loadGame();
    },

    saveEvaluation: function (instance) {
        const mOptions = $quickquestionsvideo.options[instance];
        mOptions.scorerp = (10 * mOptions.scoreGame) / mOptions.scoreTotal;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $quickquestionsvideo.isInExe
        );
    },

    sendScore: function (auto, instance) {
        const mOptions = $quickquestionsvideo.options[instance];

        mOptions.scorerp = (10 * mOptions.scoreGame) / mOptions.scoreTotal;
        mOptions.previousScore = $quickquestionsvideo.previousScore;
        mOptions.userName = $quickquestionsvideo.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $quickquestionsvideo.previousScore = mOptions.previousScore;
    },

    loadGame: function () {
        $quickquestionsvideo.options = [];

        $quickquestionsvideo.activities.each(function (i) {
            const version = $('.vquext-version', this).eq(0).text(),
                dl = $('.vquext-DataGame', this),
                videoLocal = $('.vquext-LinkLocalVideo', this)
                    .eq(0)
                    .attr('href'),
                mOption = $quickquestionsvideo.loadDataGame(
                    dl,
                    version,
                    videoLocal
                ),
                msg = mOption.msgs.msgPlayStart;

            mOption.scorerp = 0;
            mOption.idevicePath = $quickquestionsvideo.idevicePath;
            mOption.main = 'vquextMainContainer-' + i;
            mOption.idevice = 'vquext-IDevice';

            $quickquestionsvideo.options.push(mOption);

            const vquext = $quickquestionsvideo.createInterfaceVideoQuExt(i);
            dl.before(vquext).remove();
            $('#vquextGameMinimize-' + i).hide();
            $('#vquextGameContainer-' + i).hide();

            if (mOption.showMinimize) {
                $('#vquextGameMinimize-' + i).show();
            } else {
                $('#vquextGameContainer-' + i).show();
            }
            $('#vquextMessageMaximize-' + i).text(msg);
            $('#vquextOptionsDiv-' + i).hide();
            $('#vquextDivReply-' + i).hide();
            $('#vquextDivFeedBack-' + i).prepend(
                $('.vquext-feedback-game', this)
            );
            $('#vquextDivFeedBack-' + i).hide();
            mOption.localPlayer = document.getElementById(
                'vquextVideoLocal-' + i
            );
            $quickquestionsvideo.addEvents(i);
        });

        let node = document.querySelector('.page-content');
        if (node)
            $exeDevices.iDevice.gamification.observers.observeResize(
                $quickquestionsvideo,
                node
            );

        $exeDevices.iDevice.gamification.math.updateLatex('.vquext-IDevice');

        if ($quickquestionsvideo.hasVideo) $quickquestionsvideo.loadApiPlayer();
    },

    loadApiPlayer: function () {
        if (!this.hasVideo) return;

        $exeDevices.iDevice.gamification.media.YouTubeAPILoader.load()
            .then(() => this.activatePlayer())
            .catch(() => this.showStartedButton());
    },

    activatePlayer: function () {
        $quickquestionsvideo.options.forEach((option, i) => {
            if ($quickquestionsvideo.hasVideo && option.player === null) {
                option.player = new YT.Player(`vquextVideo-${i}`, {
                    width: '100%',
                    height: '100%',
                    videoId: '',
                    playerVars: {
                        color: 'white',
                        autoplay: 0,
                        controls: 0,
                    },
                    events: {
                        onReady: $quickquestionsvideo.onPlayerReady.bind(this),
                        onError: $quickquestionsvideo.onPlayerError,
                        onStateChange:
                            $quickquestionsvideo.onPlayerStateChange.bind(this),
                    },
                });
            }
        });
    },

    youTubeReady: function () {
        this.activatePlayer();
    },

    showStartedButton: function () {
        $quickquestionsvideo.options.forEach((option, i) => {
            if (!option.gameStarted && !option.gameOver) {
                $(`#vquextStartGame-${i}`).show();
                $quickquestionsvideo.showMessage(1, '', i);
            }
        });
    },

    onPlayerReady: function (event) {
        const iframe = event.target.getIframe();
        if (iframe && iframe.id) {
            const [prefix, instanceStr] = iframe.id.split('-');
            if (prefix === 'vquextVideo') {
                const instance = parseInt(instanceStr, 10);
                if (!isNaN(instance)) {
                    $(`#vquextStartGame-${instance}`).show();
                    $quickquestionsvideo.showMessage(1, '', instance);
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

    onPlayerStateChange: function (event) {
        if (event.data == YT.PlayerState.ENDED) {
            const iframe = event.target.getIframe();
            if (iframe && iframe.id) {
                const [prefix, instanceStr] = iframe.id.split('-');
                if (prefix === 'vquextVideo') {
                    const instance = parseInt(instanceStr, 10);
                    if (!isNaN(instance)) {
                        let mOptions = $quickquestionsvideo.options[instance];
                        mOptions.stateReproduction = -1;
                        $quickquestionsvideo.gameOver(0, instance);
                    } else {
                        console.warn(
                            `Número de instancia inválido para ${iframe.id}`
                        );
                    }
                }
            } else {
                console.warn(
                    'No se pudo identificar el iframe del reproductor'
                );
            }
        }
    },

    createPointsVideo: function (instance) {
        const mOptions = $quickquestionsvideo.options[instance],
            $progressBar = $(`#vquextProgressBar-${instance}`),
            widthBar = $progressBar.width(),
            durationVideo = mOptions.endVideoQuExt - mOptions.startVideoQuExt;
        let widthIntBar = 0;

        $progressBar.find('a.VQXTP-PointBar').remove();

        mOptions.questionsGame.forEach((question, i) => {
            widthIntBar =
                ((question.pointVideo - mOptions.startVideoQuExt) * widthBar) /
                durationVideo;
            let borderColor = $quickquestionsvideo.borderColors.blue;

            switch (question.answerScore) {
                case 0:
                    borderColor = $quickquestionsvideo.borderColors.red;
                    break;
                case 1:
                    borderColor = $quickquestionsvideo.borderColors.green;
                    break;
                default:
                    break;
            }

            $progressBar
                .append(
                    `<a href="#" class="VQXTP-PointBar" title="${i + 1}"><strong class="sr-av">${i + 1}</strong></a>`
                )
                .find('a.VQXTP-PointBar')
                .last()
                .css({
                    left: `${widthIntBar - 3}px`,
                    cursor: mOptions.isNavigable ? 'pointer' : 'default',
                    'background-color': borderColor,
                    border: `solid 1px ${$quickquestionsvideo.colors.black}`,
                })
                .data('number', i);
        });

        $progressBar.css(
            'cursor',
            mOptions.isNavigable ? 'pointer' : 'default'
        );
    },

    createInterfaceVideoQuExt: function (instance) {
        const path = $quickquestionsvideo.idevicePath,
            msgs = $quickquestionsvideo.options[instance].msgs,
            mOptions = $quickquestionsvideo.options[instance];
        msgs.msgFirstQuestion = msgs.msgFirstQuestion || 'First question';
        msgs.msgPreviousQuestion =
            msgs.msgPreviousQuestion || 'Previous question';
        msgs.msgNextQuestion = msgs.msgNextQuestion || 'Next question';
        msgs.msgLastQuestion = msgs.msgLastQuestion || 'Last question';
        msgs.msgQuestionNumber = msgs.msgQuestionNumber || 'Question number';

        const html = `
            <div class="VQXTP-MainContainer" id="vquextMainContainer-${instance}">
                <div class="VQXTP-GameMinimize" id="vquextGameMinimize-${instance}">
                    <a href="#" class="VQXTP-LinkMaximize" id="vquextLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                        <img src="${path}vquextIcon.png" class="VQXTP-IconMinimize VQXTP-Activo" alt="${msgs.msgMaximize}">
                        <div class="VQXTP-MessageMaximize" id="vquextMessageMaximize-${instance}"></div>
                    </a>
                </div>
                <div class="VQXTP-GameContainer" id="vquextGameContainer-${instance}">
                    <div class="VQXTP-GameScoreBoard">
                        <div class="VQXTP-GameScores">
                            <strong><span class="sr-av">${msgs.msgNumQuestions}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Number"></div>
                            <p id="vquextPNumber-${instance}">0</p>
                            <strong><span class="sr-av">${msgs.msgHits}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Hit"></div>
                            <p id="vquextPHits-${instance}">0</p>
                            <strong><span class="sr-av">${msgs.msgErrors}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Error"></div>
                            <p id="vquextPErrors-${instance}">0</p>
                            <strong><span class="sr-av">${msgs.msgScore}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Score"></div>
                            <p id="vquextPScore-${instance}">0</p>
                        </div>
                        <div class="VQXTP-LifesGame" id="vquextLifesGame-${instance}">
                            <strong><span class="sr-av">${msgs.msgLive}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Life"></div>
                            <strong><span class="sr-av">${msgs.msgLive}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Life"></div>
                            <strong><span class="sr-av">${msgs.msgLive}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Life"></div>
                            <strong><span class="sr-av">${msgs.msgLive}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Life"></div>
                            <strong><span class="sr-av">${msgs.msgLive}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Life"></div>
                        </div>
                        <div class="VQXTP-NumberLifesGame" id="vquextNumberLivesGame-${instance}">
                            <strong><span class="sr-av">${msgs.msgLive}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Life"></div>
                            <p id="vquextPLifes-${instance}">0</p>
                        </div>
                        <div class="VQXTP-TimeNumber">
                            <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Time"></div>
                            <p id="vquextPTime-${instance}" class="VQXTP-PTime">00:00</p>
                            <a href="#" class="VQXTP-LinkMinimize" id="vquextLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                                <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                                <div class="exeQuextIcons exeQuextIcons-Minimize VQXTP-Activo"></div>
                            </a>
                            <a href="#" class="VQXTP-LinkFullScreen" id="vquextLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                                <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                                <div class="exeQuextIcons exeQuextIcons-FullScreen VQXTP-Activo" id="quextFullScreen-${instance}"></div>
                            </a>
                        </div>
                    </div>
                    <div class="VQXTP-ShowClue" id="vquextShowClue-${instance}">
                        <div class="sr-av">${msgs.msgClue}:</div>
                        <p class="VQXTP-PShowClue VQXTP-parpadea" id="vquextPShowClue-${instance}"></p>
                    </div>
                    <div class="VQXTP-Multimedia" id="vquextMultimedia-${instance}">
                        <img src="${path}quextImageVideo.png" class="VQXTP-Image" id="vquextImagen-${instance}" alt="${msgs.msgNoImage}" />
                        <img src="${path}vquextHome.png" class="VQXTP-Image" id="vquextCover-${instance}" alt="${msgs.msImage}" />
                        <div class="gameQP-VideoContainer" id="localVideoContainer-QQV-${instance}">
                            <video class="VQXTP-Video" id="vquextVideoLocal-${instance}"></video>
                        </div>
                        <div class="VQXTP-VideoContainer" id="ytVideoContainer-QQV-${instance}">
                            <div class="VQXTP-Video" id="vquextVideo-${instance}"></div>
                        </div>
                        <div class="VQXTP-Protector" id="vquextProtector-${instance}"></div>
                        <div class="VQXTP-GameOver" id="vquextGamerOver-${instance}">
                            <div class="VQXTP-DataImage">
                                <img src="${path}exequextwon.png" class="VQXTP-HistGGame" id="vquextHistGame-${instance}" alt="${msgs.msgAllQuestions}" />
                                <img src="${path}exequextlost.png" class="VQXTP-LostGGame" id="vquextLostGame-${instance}" alt="${msgs.msgLostLives}" />
                            </div>
                            <div class="VQXTP-DataScore">
                                <p id="vquextOverNumber-${instance}">Score: 0</p>
                                <p id="vquextOverHits-${instance}">Hits: 0</p>
                                <p id="vquextOverErrors-${instance}">Errors: 0</p>
                                <p id="vquextOverScore-${instance}">Score: 0</p>
                            </div>
                        </div>
                    </div>
                    <div class="VQXTP-ProgressBar" id="vquextProgressBar-${instance}">
                        <div class="VQXTP-InterBar" id="vquextInterBar-${instance}"></div>
                    </div>
                    <div class="VQXTP-AuthorLicence" id="vquextAuthorLicence-${instance}">
                        <div class="sr-av">${msgs.msgAuthor}:</div>
                        <p id="vquextPAuthor-${instance}"></p>
                    </div>
                    <div class="sr-av">${msgs.msgPlayStart}</div>
                    <div class="VQXTP-StartGame"><a href="#" id="vquextStartGame-${instance}">${msgs.msgPlayStart}</a></div>
                    <div class="VQXTP-QuestionDiv" id="vquextQuestionDiv-${instance}">
                        <div class="sr-av">${msgs.msgQuestions}:</div>
                        <div class="VQXTP-Question" id="vquextQuestion-${instance}"></div>
                        <div class="VQXTP-DivReply" id="vquextDivReply-${instance}">
                            <label class="sr-av">${msgs.msgIndicateSolution}:</label><input type="text" value="" class="VQXTP-EdReply form-control" id="vquextEdAnswer-${instance}" autocomplete="off">
                            <a href="#" id="vquextBtnReply-${instance}" title="${msgs.msgReply}">
                                <strong><span class="sr-av">${msgs.msgReply}</span></strong>
                                <div class="exeQuextIcons-Submit"></div>
                            </a>
                        </div>
                        <div class="VQXTP-DivModeBoard" id="vquextDivModeBoard-${instance}">
                            <a class="VQXTP-ModeBoard" href="#" id="vquextModeBoardOK-${instance}" title="${msgs.msgCorrect}">${msgs.msgCorrect}</a>
                            <a class="VQXTP-ModeBoard" href="#" id="vquextModeBoardKO-${instance}" title="${msgs.msgIncorrect}">${msgs.msgIncorrect}</a>
                        </div>
                        <div class="VQXTP-OptionsDiv" id="vquextOptionsDiv-${instance}">
                            <div class="sr-av">${msgs.msgOption} A:</div>
                            <a href="#" class="VQXTP-Option1 VQXTP-Options" id="vquextOption1-${instance}" data-number="0"></a>
                            <div class="sr-av">${msgs.msgOption} B:</div>
                            <a href="#" class="VQXTP-Option2 VQXTP-Options" id="vquextOption2-${instance}" data-number="1"></a>
                            <div class="sr-av">${msgs.msgOption} C:</div>
                            <a href="#" class="VQXTP-Option3 VQXTP-Options" id="vquextOption3-${instance}" data-number="2"></a>
                            <div class="sr-av">${msgs.msgOption} D:</div>
                            <a href="#" class="VQXTP-Option4 VQXTP-Options" id="vquextOption4-${instance}" data-number="3"></a>
                        </div>
                    </div>
                    <div class="VQXTP-ReloadContainer" id="vquextVideoReloadContainer-${instance}">
                        <a href="#" class="VQXTP-LinkReload" id="vquextReeload-${instance}" title="${msgs.msgReloadVideo}">
                            <strong><span class="sr-av">${msgs.msgReloadVideo}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Reload VQXTP-Activo"></div>
                        </a>
                        <a href="#" id="vquextFirst-${instance}" title="${msgs.msgFirstQuestion}">
                            <strong><span class="sr-av">${msgs.msgFirstQuestion}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-First VQXTP-Activo"></div>
                        </a>
                        <a href="#" id="vquextPrevious-${instance}" title="${msgs.msgPreviousQuestion}">
                            <strong><span class="sr-av">${msgs.msgPreviousQuestion}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Previous VQXTP-Activo"></div>
                        </a>
                        <span class="sr-av">${msgs.msgQuestionNumber}</span><span class="VQXTP-NumberQuestion" id="vquextNumberQuestion-${instance}">1</span>
                        <a href="#" id="vquextPauseVideo-${instance}" title="${msgs.msgPauseVideo}">
                            <strong><span class="sr-av">${msgs.msgPauseVideo}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-PauseVideo VQXTP-Activo"></div>
                        </a>
                        <a href="#" id="vquextNext-${instance}" title="${msgs.msgNextQuestion}">
                            <strong><span class="sr-av">${msgs.msgNextQuestion}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Next VQXTP-Activo"></div>
                        </a>
                        <a href="#" id="vquextLast-${instance}" title="${msgs.msgLastQuestion}">
                            <strong><span class="sr-av">${msgs.msgLastQuestion}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Last VQXTP-Activo"></div>
                        </a>
                        <a href="#" id="vquextPreview-${instance}" title="${msgs.msgPreviewQuestions}">
                            <strong><span class="sr-av">${msgs.msgPreviewQuestions}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Preview VQXTP-Activo"></div>
                        </a>
                    </div>
                    <div class="VQXTP-previewQuestionsDiv" id="vquextpreviewQuestionsDiv-${instance}">
                        <p class="VQXTP-PreviewQuestionsTitle">${msgs.msgQuestions}</p>
                        <strong><span class="sr-av">${msgs.msgQuestions}:</span></strong>
                        <input type="button" class="feedbackbutton VQXTP-previewQuestionsClose" id="vquextpreviewQuestionsClose-${instance}" value="${msgs.msgClose}" />
                    </div>
                    <div class="VQXTP-DivFeedBack" id="vquextDivFeedBack-${instance}">
                        <input type="button" id="vquextFeedBackClose-${instance}" value="${msgs.msgClose}" class="feedbackbutton" />
                    </div>
                </div>
                <div class="VQXTP-Cubierta" id="vquextCubierta-${instance}" style="display:none">
                    <div class="VQXTP-CodeAccessDiv" id="vquextCodeAccessDiv-${instance}">
                        <p class="VQXTP-MessageCodeAccessE" id="vquextMesajeAccesCodeE-${instance}"></p>
                        <div class="VQXTP-DataCodeAccessE">
                            <label for="vquextCodeAccessE-${instance}" class="sr-av">${msgs.msgCodeAccess}:</label>
                            <input type="text" class="VQXTP-CodeAccessE form-control" id="vquextCodeAccessE-${instance}" placeholder="${msgs.msgCodeAccess}">
                            <a href="#" id="vquextCodeAccessButton-${instance}" title="${msgs.msgSubmit}">
                                <strong><span class="sr-av">${msgs.msgSubmit}</span></strong>
                                <div class="exeQuextIcons-Submit VQXTP-Activo"></div>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
           ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}
        `;
        return html;
    },

    showCubiertaOptions(mode, instance) {
        if (mode === false) {
            $('#vquextCubierta-' + instance).fadeOut();
            return;
        }
        $('#vquextCubierta-' + instance).fadeIn();
    },

    loadDataGame: function (data, version, videoLocal) {
        let json = data.text();

        version =
            typeof version == 'undefined' || version == ''
                ? 0
                : parseInt(version);
        if (version > 0)
            json = $exeDevices.iDevice.gamification.helpers.decrypt(json);

        let mOptions =
            $exeDevices.iDevice.gamification.helpers.isJsonString(json);

        mOptions.player = null;
        mOptions.waitStart = false;
        mOptions.videoLocal = videoLocal;
        mOptions.questionAnswer = false;
        mOptions.percentajeQuestions =
            typeof mOptions.percentajeQuestions != 'undefined'
                ? mOptions.percentajeQuestions
                : 100;
        mOptions.gameMode =
            typeof mOptions.gameMode != 'undefined' ? mOptions.gameMode : 0;
        mOptions.authorVideo =
            typeof mOptions.authorVideo != 'undefined'
                ? mOptions.authorVideo
                : '';
        mOptions.percentajeFB =
            typeof mOptions.percentajeFB != 'undefined'
                ? mOptions.percentajeFB
                : 100;
        mOptions.isNavigable =
            typeof mOptions.isNavigable != 'undefined'
                ? mOptions.isNavigable
                : false;
        mOptions.repeatQuestion =
            typeof mOptions.repeatQuestion != 'undefined'
                ? mOptions.repeatQuestion
                : false;
        mOptions.customMessages =
            typeof mOptions.customMessages != 'undefined'
                ? mOptions.customMessages
                : false;
        mOptions.useLives = mOptions.gameMode != 0 ? false : mOptions.useLives;
        mOptions.gameOver = false;
        mOptions.gameStarted = false;
        mOptions.scoreGame = 0;
        mOptions.scoreTotal = 0;
        mOptions.questionsGame =
            $exeDevices.iDevice.gamification.helpers.getQuestions(
                mOptions.questionsGame,
                mOptions.percentajeQuestions
            );
        mOptions.numberQuestions = mOptions.questionsGame.length;
        mOptions.modeBoard =
            typeof mOptions.modeBoard == 'undefined'
                ? false
                : mOptions.modeBoard;
        mOptions.evaluation =
            typeof mOptions.evaluation == 'undefined'
                ? false
                : mOptions.evaluation;
        mOptions.evaluationID =
            typeof mOptions.evaluationID == 'undefined'
                ? ''
                : mOptions.evaluationID;
        mOptions.id = typeof mOptions.id == 'undefined' ? false : mOptions.id;

        if (mOptions.videoType == 1 || mOptions.videoType == 2) {
            mOptions.idVideoQuExt = mOptions.videoLocal;
        } else if (mOptions.videoType == 3) {
            mOptions.idVideoQuExt = $quickquestionsvideo.getIDMediaTeca(
                mOptions.videoLocal
            );
        } else {
            mOptions.idVideoQuExt =
                $exeDevices.iDevice.gamification.media.getIDYoutube(
                    mOptions.idVideoQuExt
                );
            $quickquestionsvideo.hasVideo = true;
        }

        for (let i = 0; i < mOptions.questionsGame.length; i++) {
            if (mOptions.customScore) {
                mOptions.scoreTotal += mOptions.questionsGame[i].customScore;
            } else {
                mOptions.questionsGame[i].customScore = 1;
                mOptions.scoreTotal += mOptions.questionsGame[i].customScore;
            }
        }

        return mOptions;
    },

    getIDMediaTeca: function (url) {
        if (url) {
            const matc =
                url.indexOf('https://mediateca.educa.madrid.org/video/') != -1;
            if (matc) {
                let id = url
                    .split('https://mediateca.educa.madrid.org/video/')[1]
                    .split('?')[0];
                id = 'http://mediateca.educa.madrid.org/streaming.php?id=' + id;
                return id;
            } else {
                return '';
            }
        } else {
            return '';
        }
    },

    updateTimerDisplay: function () {},

    updateProgressBar: function () {},

    onPlayerError: function () {},

    startVideo: function (id, start, end, instance) {
        const mOptions = $quickquestionsvideo.options[instance],
            mstart = start < 1 ? 0.1 : start;
        if (mOptions.videoType > 0 && mOptions.localPlayer) {
            mOptions.localPlayer.src =
                $exeDevices.iDevice.gamification.media.extractURLGD(id);
            mOptions.localPlayer.currentTime = mstart;
            mOptions.localPlayer.play();
            return;
        }
        if (
            mOptions.player &&
            typeof mOptions.player.loadVideoById == 'function'
        ) {
            mOptions.player.loadVideoById({
                videoId: id,
                startSeconds: mstart,
                endSeconds: end,
            });
        }
    },

    playVideo: function (instance) {
        const mOptions = $quickquestionsvideo.options[instance];
        if (mOptions.videoType > 0 && mOptions.localPlayer) {
            mOptions.localPlayer.play();
            return;
        }
        if (mOptions.player && typeof mOptions.player.playVideo == 'function') {
            mOptions.player.playVideo();
        }
    },

    stopVideo: function (instance) {
        const mOptions = $quickquestionsvideo.options[instance];
        if (mOptions.videoType > 0 && mOptions.localPlayer) {
            mOptions.localPlayer.pause();
            return;
        }
        if (
            mOptions.player &&
            typeof mOptions.player.pauseVideo == 'function'
        ) {
            mOptions.player.pauseVideo();
        }
    },

    endVideoYoutube: function (instance) {
        const mOptions = $quickquestionsvideo.options[instance];
        if (mOptions.player && typeof mOptions.player.stopVideo == 'function') {
            mOptions.player.stopVideo();
        }
    },

    muteVideo: function (mute, instance) {
        const mOptions = $quickquestionsvideo.options[instance];
        mute = mOptions.videoType == 2 ? false : mute;
        if (mOptions.videoType > 0 && mOptions.localPlayer) {
            mOptions.localPlayer.muted = mute;
            return;
        }
        if (mOptions.player) {
            if (mute) {
                if (typeof mOptions.player.mute == 'function') {
                    mOptions.player.mute();
                }
            } else {
                if (typeof mOptions.player.unMute == 'function') {
                    mOptions.player.unMute();
                }
            }
        }
    },

    addEvents: function (instance) {
        const mOptions = $quickquestionsvideo.options[instance];
        $quickquestionsvideo.removeEvents(instance);
        $(window).on(
            'unload.eXeVideoQuext beforeunload.eXeVideoQuext',
            function () {
                $exeDevices.iDevice.gamification.scorm.endScorm(
                    $quickquestionsvideo.mScorm
                );
            }
        );

        $(`videovquextGamerOver-${instance}`).css('display', 'flex');

        $(`#vquextLinkMaximize-${instance}`).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $(`#vquextGameContainer-${instance}`).show();
                $(`#vquextGameMinimize-${instance}`).hide();
                $quickquestionsvideo.refreshGame(instance);
            }
        );

        $(`#vquextLinkMinimize-${instance}`).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $(`#vquextGameContainer-${instance}`).hide();
                $(`#vquextGameMinimize-${instance}`)
                    .css('visibility', 'visible')
                    .show();
            }
        );

        $('#vquextMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $quickquestionsvideo.sendScore(false, instance);
                $quickquestionsvideo.saveEvaluation(instance);
            });

        $(`#vquextReeload-${instance}`).on('click', function (e) {
            e.preventDefault();
            $quickquestionsvideo.reloadQuestion(instance, false, false);
        });

        $(`#vquextPreview-${instance}`).on('click', function (e) {
            e.preventDefault();
            $quickquestionsvideo.previewQuestions(instance);
        });

        $(`#vquextEdAnswer-${instance}`).on('keydown', function (event) {
            if (event.which === 13 || event.keyCode === 13) {
                const answer = $(this).val();
                $quickquestionsvideo.answerQuestion(answer, instance);
                return false;
            }
            return true;
        });

        $(`#vquextBtnReply-${instance}`).on('click', function (e) {
            e.preventDefault();
            const answer = $(`#vquextEdAnswer-${instance}`).val();
            $quickquestionsvideo.answerQuestion(answer, instance);
        });

        $(`#vquextPauseVideo-${instance}`).on('click', function (e) {
            e.preventDefault();
            const pause = $(`#vquextPauseVideo-${instance}`)
                .find('div')
                .hasClass('exeQuextIcons-PauseVideo');
            $quickquestionsvideo.pauseVideoQuestion(instance, pause);
        });

        $(`#vquextpreviewQuestionsClose-${instance}`).on('click', function (e) {
            e.preventDefault();
            $(`#vquextpreviewQuestionsDiv-${instance}`).slideUp();
        });

        $(
            `#vquextGamerOver-${instance}, #vquextCodeAccessDiv-${instance}, #vquextVideo-${instance}, #vquextVideoLocal-${instance}, #vquextImagen-${instance}, #vquextCursor-${instance}`
        ).hide();
        $(`#vquextCover-${instance}`).show();

        $(`#vquextCodeAccessButton-${instance}`).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $quickquestionsvideo.enterCodeAccess(instance);
            }
        );

        $(`#vquextCodeAccessE-${instance}`).on('keydown', function (event) {
            if (event.which === 13 || event.keyCode === 13) {
                $quickquestionsvideo.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        mOptions.livesLeft = mOptions.numberLives;
        $(`#vquextStartGame-${instance}`).text(mOptions.msgs.msgPlayStart);

        $(`#vquextStartGame-${instance}`).on('click', function (e) {
            e.preventDefault();
            if (mOptions.videoType > 0) {
                const localVideoContainer = document.getElementById(
                    `localVideoContainer-QQV-${instance}`
                );
                localVideoContainer.classList.add(
                    'VQXTP-VideoContainer-padding'
                );
            } else {
                const ytVideoContainer = document.getElementById(
                    `ytVideoContainer-QQV-${instance}`
                );
                ytVideoContainer.classList.add('VQXTP-VideoContainer-padding');
            }
            $quickquestionsvideo.startGame(instance);
        });

        $(`#vquextOptionsDiv-${instance}`).on(
            'click touchstart',
            '.VQXTP-Options',
            function (e) {
                e.preventDefault();
                const answer = $(this).data('number');
                $quickquestionsvideo.answerQuestion(answer, instance);
            }
        );

        $(`#vquextLinkFullScreen-${instance}`).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                const element = document.getElementById(
                    `vquextGameContainer-${instance}`
                );
                $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                    element,
                    instance
                );
            }
        );

        $quickquestionsvideo.updateLives(instance);

        $(`#vquextInstructions-${instance}`).text(mOptions.instructions);
        $(`#vquextPNumber-${instance}`).text(mOptions.numberQuestions);
        $(`#vquextGameContainer-${instance} .VQXTP-StartGame`).show();
        $(`#vquextQuestionDiv-${instance}`).hide();

        if (mOptions.itinerary.showCodeAccess) {
            $(`#vquextMesajeAccesCodeE-${instance}`).text(
                mOptions.itinerary.messageCodeAccess
            );
            $(`#vquextCodeAccessDiv-${instance}`).show();
            $(`#vquextGameContainer-${instance} .VQXTP-StartGame`).hide();
            $(`#vquextQuestionDiv-${instance}`).hide();
            $quickquestionsvideo.showCubiertaOptions(true, instance);
        }

        $(`#vquextInstruction-${instance}`).text(mOptions.instructions);
        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        document.title = mOptions.title;
        $('meta[name=author]').attr('content', mOptions.author);
        $(`#vquextPShowClue-${instance}`).hide();
        mOptions.gameOver = false;

        if (mOptions.gameMode === 2) {
            $(`#vquextGameContainer-${instance}`)
                .find(
                    '.exeQuextIcons-Hit, .exeQuextIcons-Error, .exeQuextIcons-Score'
                )
                .hide();
            $(
                `#vquextPErrors-${instance}, #vquextPHits-${instance}, #vquextPScore-${instance}`
            ).hide();
        }

        $(`#vquextFeedBackClose-${instance}`).on('click', function () {
            $(`#vquextDivFeedBack-${instance}`).hide();
        });

        $(
            `#vquextFirst-${instance}, #vquextPrevious-${instance}, #vquextNext-${instance}, #vquextLast-${instance}`
        ).on('click', function (e) {
            e.preventDefault();
            const action = $(this)
                .attr('id')
                .split('-')[0]
                .replace('vquext', '')
                .toLowerCase();
            const actions = { first: 0, previous: 1, next: 2, last: 3 };
            $quickquestionsvideo.goQuestion(
                instance,
                actions[action],
                0,
                false
            );
        });

        $(`#vquextProgressBar-${instance}`).on(
            'click',
            'a.VQXTP-PointBar',
            function () {
                if (mOptions.isNavigable) {
                    const number = $(this).data('number');
                    $quickquestionsvideo.goQuestion(instance, 4, number);
                }
            }
        );

        $(`#vquextProgressBar-${instance}`).on(
            'mouseenter',
            'a.VQXTP-PointBar',
            function (e) {
                e.preventDefault();
                if (mOptions.isNavigable || mOptions.previewQuestions) {
                    const number = $(this).data('number');
                    const textoTooltip =
                        mOptions.questionsGame[number].quextion;
                    if (textoTooltip.length > 0) {
                        $(this).append(
                            `<div class="VQXTP-Tooltip">${textoTooltip}</div>`
                        );
                        $(this).find('div.VQXTP-Tooltip').css('left', '-121px');
                        const html = $(`#vquextProgressBar-${instance}`).html();
                        const latex =
                            $exeDevices.iDevice.gamification.math.hasLatex(
                                html
                            );
                        if (latex) {
                            $exeDevices.iDevice.gamification.math.updateLatex(
                                `vquextProgressBar-${instance}`
                            );
                        }
                        $(this).find('div.VQXTP-Tooltip').fadeIn(300);
                    }
                }
            }
        );

        $(`#vquextProgressBar-${instance}`).on(
            'mouseleave',
            'a.VQXTP-PointBar',
            function (e) {
                e.preventDefault();
                if (mOptions.isNavigable || mOptions.previewQuestions) {
                    $('.VQXTP-PointBar > div.VQXTP-Tooltip')
                        .fadeOut(300)
                        .delay(300)
                        .queue(function () {
                            $(this).remove();
                            $(this).dequeue();
                        });
                }
            }
        );

        $(`#vquextProgressBar-${instance}`).on('click', function (e) {
            e.preventDefault();
            if (
                mOptions.isNavigable &&
                !$(e.target).hasClass('VQXTP-PointBar')
            ) {
                const mx = Math.floor(e.pageX - $(this).offset().left);
                const widthBar = $(this).width();
                const durationVideo =
                    mOptions.endVideoQuExt - mOptions.startVideoQuExt;
                let active = 0;
                const ctime =
                    Math.floor((mx * durationVideo) / widthBar) +
                    mOptions.startVideoQuExt;
                for (let i = mOptions.questionsGame.length - 1; i >= 0; i--) {
                    if (ctime > mOptions.questionsGame[i].pointVideo) {
                        active = i + 1;
                        break;
                    }
                }
                if (active < mOptions.questionsGame.length) {
                    $quickquestionsvideo.goQuestion(instance, 4, active, ctime);
                } else {
                    $quickquestionsvideo.goEnd(instance, ctime);
                }
            }
        });

        $(`#vquextModeBoardOK-${instance}`).on('click', function (e) {
            e.preventDefault();
            $quickquestionsvideo.answerQuestionBoard(true, instance);
        });

        $(`#vquextModeBoardKO-${instance}`).on('click', function (e) {
            e.preventDefault();
            $quickquestionsvideo.answerQuestionBoard(false, instance);
        });
        if (mOptions.videoType === 0) {
            $(`#vquextStartGame-${instance}`).hide();
            $quickquestionsvideo.showMessage(
                0,
                'Cargando. Por favor, espere',
                instance
            );
        }

        $quickquestionsvideo.showNavigationButtons(instance, 0);
        $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
            mOptions,
            this.isInExe
        );
    },

    removeEvents: function (instance) {
        $(`#vquextLinkMaximize-${instance}`).off('click touchstart');
        $(`#vquextLinkMinimize-${instance}`).off('click touchstart');
        $('#vquextMainContainer-' + instance)
            .closest('.idevice_node')
            .off('click', '.Games-SendScore');
        $(`#vquextReeload-${instance}`).off('click');
        $(`#vquextPreview-${instance}`).off('click');
        $(`#vquextEdAnswer-${instance}`).off('keydown');
        $(`#vquextBtnReply-${instance}`).off('click');
        $(`#vquextPauseVideo-${instance}`).off('click');
        $(`#vquextpreviewQuestionsClose-${instance}`).off('click');
        $(`#vquextCodeAccessButton-${instance}`).off('click touchstart');
        $(`#vquextCodeAccessE-${instance}`).off('keydown');
        $(`#vquextStartGame-${instance}`).off('click');
        $(`#vquextOptionsDiv-${instance}`).off(
            'click touchstart',
            '.VQXTP-Options'
        );
        $(`#vquextLinkFullScreen-${instance}`).off('click touchstart');
        $(`#vquextFeedBackClose-${instance}`).off('click');
        $(
            `#vquextFirst-${instance}, #vquextPrevious-${instance}, #vquextNext-${instance}, #vquextLast-${instance}`
        ).off('click');
        $(`#vquextProgressBar-${instance}`).off('click', 'a.VQXTP-PointBar');
        $(`#vquextProgressBar-${instance}`).off(
            'mouseenter',
            'a.VQXTP-PointBar'
        );
        $(`#vquextProgressBar-${instance}`).off(
            'mouseleave',
            'a.VQXTP-PointBar'
        );
        $(`#vquextProgressBar-${instance}`).off('click');
        $(`#vquextModeBoardOK-${instance}, #vquextModeBoardKO-${instance}`).off(
            'click'
        );
        $(window).off('unload.eXeVideoQuext beforeunload.eXeVideoQuext');
    },

    goEnd: function (instance, time) {
        const mOptions = $quickquestionsvideo.options[instance];

        mOptions.activeQuestion = mOptions.questionsGame.length;
        mOptions.stateReproduction = 4;

        if (mOptions.videoType > 0) {
            mOptions.localPlayer.currentTime = parseFloat(time);
            $('#vquextVideoLocal-' + instance).show();
        } else {
            mOptions.player.seekTo(time);
            $('#vquextVideo-' + instance).show();
        }
    },

    goQuestion: function (instance, type, number, time) {
        const mOptions = $quickquestionsvideo.options[instance];
        switch (type) {
            case 0:
                mOptions.activeQuestion = 0;
                break;
            case 1:
                mOptions.activeQuestion =
                    mOptions.activeQuestion > 0
                        ? mOptions.activeQuestion - 1
                        : 0;
                break;
            case 2:
                mOptions.activeQuestion =
                    mOptions.activeQuestion < mOptions.questionsGame.length - 1
                        ? mOptions.activeQuestion + 1
                        : mOptions.questionsGame.length - 1;
                break;
            case 3:
                mOptions.activeQuestion = mOptions.questionsGame.length - 1;
                break;
            case 4:
                mOptions.activeQuestion = number;
                break;
            default:
                break;
        }

        mOptions.stateReproduction = 0;

        $quickquestionsvideo.reloadQuestion(instance, type == 4, time);
        $quickquestionsvideo.showNumbersQuestions(instance);
    },

    pauseVideoQuestion: function (instance, pause) {
        const mOptions = $quickquestionsvideo.options[instance];

        if (mOptions.stateReproduction > 0) return;

        const $this = $('#vquextPauseVideo-' + instance).find('div');
        if (pause) {
            $this.removeClass('exeQuextIcons-PauseVideo');
            $this.addClass('exeQuextIcons-PlayVideo');
            $quickquestionsvideo.stopVideo(instance);
        } else {
            $this.addClass('exeQuextIcons-PauseVideo');
            $this.removeClass('exeQuextIcons-PlayVideo');
            $quickquestionsvideo.playVideo(instance);
        }
    },

    previewQuestions: function (instance) {
        const mOptions = $quickquestionsvideo.options[instance];
        $('#vquextpreviewQuestionsDiv-' + instance)
            .find('.VQXTP-prevQuestP')
            .remove();

        for (let i = 0; i < mOptions.questionsGame.length; i++) {
            $('#vquextpreviewQuestionsDiv-' + instance).append(
                '<p class="VQXTP-prevQuestP">' +
                    (i + 1) +
                    '.- ' +
                    mOptions.questionsGame[i].quextion +
                    '</p>'
            );
        }

        $('#vquextpreviewQuestionsDiv-' + instance).slideToggle();

        const html = $('#vquextpreviewQuestionsDiv-' + instance).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);
        if (latex) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '#vquextpreviewQuestionsDiv-' + instance
            );
        }
    },

    reloadQuestion: function (instance, free, time) {
        const mOptions = $quickquestionsvideo.options[instance];

        if (mOptions.stateReproduction > 1) return;
        $quickquestionsvideo.pauseVideoQuestion(instance, false);

        let pointVideo =
            mOptions.activeQuestion > 0
                ? mOptions.questionsGame[mOptions.activeQuestion - 1].pointVideo
                : mOptions.startVideoQuExt;
        if (free) {
            pointVideo =
                mOptions.questionsGame[mOptions.activeQuestion].pointVideo - 1;
        }

        if (time) {
            if (mOptions.videoType > 0) {
                mOptions.localPlayer.currentTime = parseFloat(time);
            } else {
                mOptions.player.seekTo(time);
            }
        } else {
            if (mOptions.videoType > 0) {
                mOptions.localPlayer.currentTime = parseFloat(pointVideo + 1);
            } else {
                mOptions.player.seekTo(pointVideo + 1);
            }
        }

        mOptions.stateReproduction = 0;
        $quickquestionsvideo.clearQuestions(instance);

        if (mOptions.activeQuestion < mOptions.questionsGame.length) {
            $quickquestionsvideo.showQuestion(
                mOptions.activeQuestion,
                instance
            );
        } else {
            if (mOptions.videoType > 0) {
                $('#vquextVideoLocal-' + instance).show();
            } else {
                $('#vquextVideo-' + instance).show();
            }
            $('#vquextCover-' + instance).hide();
            $quickquestionsvideo.muteVideo(false, instance);
        }

        $quickquestionsvideo.playVideo(instance);
        mOptions.counter =
            $exeDevices.iDevice.gamification.helpers.getTimeSeconds(
                mOptions.questionsGame[mOptions.activeQuestion].time
            );
        $quickquestionsvideo.uptateTime(0, instance);
    },

    refreshGame: function (instance) {
        const mOptions = $quickquestionsvideo.options[instance];

        if (!mOptions) return;

        $('#vquextProgressBar-' + instance).width(
            $('#vquextVideo-' + instance).width()
        );
        $quickquestionsvideo.createPointsVideo(instance);
    },

    enterCodeAccess: function (instance) {
        const mOptions = $quickquestionsvideo.options[instance];

        if (
            mOptions.itinerary.codeAccess.toLowerCase() ===
            $('#vquextCodeAccessE-' + instance)
                .val()
                .toLowerCase()
        ) {
            $('#vquextCodeAccessDiv-' + instance).hide();
            $quickquestionsvideo.showCubiertaOptions(false, instance);
            $quickquestionsvideo.startGame(instance);
        } else {
            $('#vquextMesajeAccesCodeE-' + instance)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $('#vquextCodeAccessE-' + instance).val('');
        }
    },

    showScoreGame: function (type, instance) {
        let localVideoContainer = document.getElementById(
            `localVideoContainer-QQV-${instance}`
        );
        if (localVideoContainer !== null) {
            localVideoContainer.classList.remove(
                'VQXTP-VideoContainer-padding'
            );
        }

        let ytVideoContainer = document.getElementById(
            `ytVideoContainer-QQV-${instance}`
        );
        if (ytVideoContainer !== null) {
            ytVideoContainer.classList.remove('VQXTP-VideoContainer-padding');
        }
        const mOptions = $quickquestionsvideo.options[instance],
            msgs = mOptions.msgs,
            $quextHistGame = $('#vquextHistGame-' + instance),
            $quextLostGame = $('#vquextLostGame-' + instance),
            $quextOverPoint = $('#vquextOverScore-' + instance),
            $quextOverHits = $('#vquextOverHits-' + instance),
            $quextOverErrors = $('#vquextOverErrors-' + instance),
            $quextPShowClue = $('#vuextPShowClue-' + instance),
            $quextGamerOver = $('#vquextGamerOver-' + instance),
            $quextOverNumber = $('#vquextOverNumber-' + instance);
        let message = '',
            messageColor = 2;

        $quextHistGame.hide();
        $quextLostGame.hide();
        $quextOverPoint.show();
        $quextOverHits.show();
        $quextOverErrors.show();
        $quextPShowClue.hide();

        switch (parseInt(type)) {
            case 0:
                message = msgs.msgCool + ' ' + msgs.msgAllQuestions;
                $quextHistGame.show();
                if (mOptions.itinerary.showClue) {
                    if (mOptions.obtainedClue) {
                        message = msgs.msgAllQuestions;
                        $quextPShowClue.text(
                            msgs.msgInformation +
                                ': ' +
                                mOptions.itinerary.clueGame
                        );
                        $quextPShowClue.show();
                    } else {
                        $quextPShowClue.text(
                            msgs.msgTryAgain.replace(
                                '%s',
                                mOptions.itinerary.percentageClue
                            )
                        );
                        $quextPShowClue.show();
                    }
                }
                break;
            case 1:
                message = msgs.msgLostLives;
                messageColor = 1;
                $quextLostGame.show();
                if (mOptions.itinerary.showClue) {
                    if (mOptions.obtainedClue) {
                        $quextPShowClue.text(
                            msgs.msgInformation +
                                ': ' +
                                mOptions.itinerary.clueGame
                        );
                        $quextPShowClue.show();
                    } else {
                        $quextPShowClue.text(
                            msgs.msgTryAgain.replace(
                                '%s',
                                mOptions.itinerary.percentageClue
                            )
                        );
                        $quextPShowClue.show();
                    }
                }
                break;
            case 2:
                message = msgs.msgInformationLooking;
                $quextOverPoint.hide();
                $quextOverHits.hide();
                $quextOverErrors.hide();
                $quextPShowClue.text(mOptions.itinerary.clueGame);
                $quextPShowClue.show();
                break;
            default:
                break;
        }

        $quickquestionsvideo.showMessage(messageColor, message, instance);

        let msscore =
            mOptions.gameMode == 0
                ? msgs.msgScore + ': ' + mOptions.score
                : msgs.msgScore + ': ' + mOptions.score.toFixed(2);

        $quextOverPoint.text(msscore);
        $quextOverHits.text(msgs.msgHits + ': ' + mOptions.hits);
        $quextOverErrors.text(msgs.msgErrors + ': ' + mOptions.errors);
        $quextOverNumber.text(
            msgs.msgNumQuestions + ': ' + mOptions.questionsGame.length
        );

        if (mOptions.gameMode == 2) {
            $('#vquextGameContainer-' + instance)
                .find('.VQXTP-DataGameScore')
                .hide();
        }
        $quextGamerOver.show();
    },

    showNavigationButtons(instance, time) {
        const mOptions = $quickquestionsvideo.options[instance];

        $('#vquextFirst-' + instance).hide();
        $('#vquextPrevious-' + instance).hide();
        $('#vquextPauseVideo-' + instance).hide();
        $('#vquextNumberQuestion-' + instance).hide();
        $('#vquextNext-' + instance).hide();
        $('#vquextLast-' + instance).hide();
        $('#vquextPreview-' + instance).hide();
        $('#vquextReeload-' + instance).hide();
        $('#vquextVideoReloadContainer-' + instance).hide();
        if (
            mOptions.reloadQuestion ||
            mOptions.previewQuestions ||
            mOptions.pauseVideo ||
            mOptions.isNavigable
        ) {
            $('#vquextVideoReloadContainer-' + instance).show();
        }

        if (time == 0) {
            if (mOptions.previewQuestions) {
                $('#vquextPreview-' + instance).show();
            }
        } else if (time == 1) {
            if (mOptions.previewQuestions) {
                $('#vquextPreview-' + instance).show();
            }
            if (mOptions.reloadQuestion && !mOptions.isNavigable) {
                $('#vquextReeload-' + instance).show();
            }
            if (mOptions.pauseVideo) {
                $('#vquextPauseVideo-' + instance).show();
            }
            if (mOptions.isNavigable) {
                $('#vquextFirst-' + instance).show();
                $('#vquextPrevious-' + instance).show();
                $('#vquextPauseVideo-' + instance).show();
                $('#vquextNumberQuestion-' + instance).show();
                $('#vquextNext-' + instance).show();
                $('#vquextLast-' + instance).show();
            }
        }
    },

    startGame: function (instance) {
        const mOptions = $quickquestionsvideo.options[instance];

        if (mOptions.gameStarted) return;

        mOptions.obtainedClue = false;
        for (let i = 0; i < mOptions.questionsGame.length; i++) {
            mOptions.questionsGame[i].answerScore = -1;
        }

        $('#vquextGameMinimize-' + instance).hide();
        $('#vquextGameContainer-' + instance).show();
        $('#vquextProgressBar-' + instance).width(
            $('#vquextVideo-' + instance).width()
        );

        $quickquestionsvideo.createPointsVideo(instance);

        $('#vquextPShowClue-' + instance).hide();
        $('#vquextPShowClue-' + instance).text('');
        $('#vquextGameContainer-' + instance + ' .VQXTP-StartGame').hide();
        $('#vquextQuestionDiv-' + instance).show();
        $('#vquextQuestion-' + instance).text('');
        $('#vquextProgressBar-' + instance).show();

        $quickquestionsvideo.showNavigationButtons(instance, 1);

        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.scoreGame = 0;
        mOptions.gameActived = false;
        mOptions.validQuestions = mOptions.numberQuestions;
        mOptions.counter = 0;
        mOptions.gameStarted = false;
        mOptions.livesLeft = mOptions.numberLives;
        $quickquestionsvideo.updateLives(instance);
        mOptions.stateReproduction = 0;
        mOptions.activeQuestion = 0;
        $quickquestionsvideo.showQuestion(mOptions.activeQuestion, instance);
        $quickquestionsvideo.startVideo(
            mOptions.idVideoQuExt,
            mOptions.startVideoQuExt,
            mOptions.endVideoQuExt,
            instance
        );
        //
        //$quickquestionsvideo.showNumbersQuestions(instance);
        $('#vquextPNumber-' + instance).text(mOptions.numberQuestions);
        for (let i = 0; i < mOptions.questionsGame.length; i++) {
            mOptions.questionsGame[i].answerScore = -1;
        }

        mOptions.counterClock = setInterval(function () {
            let $node = $('#vquextMainContainer-' + instance);
            let $content = $('#node-content');
            if (
                !$node.length ||
                ($content.length && $content.attr('mode') === 'edition')
            ) {
                clearInterval(mOptions.counterClock);
                return;
            }
            let timeVideo = 0;
            let pointVideo = timeVideo + 2;
            switch (mOptions.stateReproduction) {
                case 0:
                    mOptions.gameActived = false;
                    timeVideo = 0;
                    if (mOptions.videoType > 0) {
                        if (mOptions.localPlayer) {
                            timeVideo = mOptions.localPlayer.currentTime;
                        }
                    } else {
                        if (
                            mOptions.player &&
                            typeof mOptions.player.getCurrentTime == 'function'
                        ) {
                            timeVideo = mOptions.player.getCurrentTime();
                        }
                    }
                    pointVideo = timeVideo + 2;
                    $quickquestionsvideo.updataProgressBar(timeVideo, instance);
                    if (
                        mOptions.activeQuestion < mOptions.questionsGame.length
                    ) {
                        pointVideo =
                            mOptions.questionsGame[mOptions.activeQuestion]
                                .pointVideo;
                    }
                    if (timeVideo >= mOptions.endVideoQuExt) {
                        mOptions.stateReproduction = -1;
                        $quickquestionsvideo.gameOver(0, instance);
                        return;
                    }
                    if (timeVideo >= pointVideo) {
                        let sSolution = false;
                        if (mOptions.isNavigable) {
                            if (
                                !mOptions.repeatQuestion &&
                                mOptions.questionsGame[mOptions.activeQuestion]
                                    .answerScore != -1
                            ) {
                                sSolution = true;
                            }
                        }
                        if (sSolution) {
                            mOptions.gameActived = false;
                            $quickquestionsvideo.drawQuestions(instance);
                            $quickquestionsvideo.stopVideo(instance);
                            mOptions.counter = 0;
                            mOptions.stateReproduction = 1;
                            mOptions.gameActived = false;
                        } else {
                            $quickquestionsvideo.drawQuestions(instance);
                            mOptions.counter =
                                $exeDevices.iDevice.gamification.helpers.getTimeSeconds(
                                    mOptions.questionsGame[
                                        mOptions.activeQuestion
                                    ].time
                                );
                            mOptions.stateReproduction = 1;
                            $quickquestionsvideo.stopVideo(instance);
                            $quickquestionsvideo.updataProgressBar(
                                mOptions.questionsGame[mOptions.activeQuestion]
                                    .pointVideo,
                                instance
                            );
                            mOptions.gameActived = true;
                        }
                    }
                    break;
                case 1:
                    mOptions.gameActived = true;
                    mOptions.counter--;
                    $quickquestionsvideo.uptateTime(mOptions.counter, instance);
                    if (mOptions.counter <= 0) {
                        mOptions.gameActived = false;
                        if (mOptions.showSolution) {
                            mOptions.counter = mOptions.timeShowSolution;
                            $quickquestionsvideo.drawSolution(instance);
                            mOptions.stateReproduction = 2;
                        } else {
                            mOptions.stateReproduction = 3;
                        }
                    }
                    break;
                case 2:
                    mOptions.counter--;
                    if (mOptions.counter <= 0) {
                        mOptions.stateReproduction = 3;
                    }
                    break;
                case 3:
                    $quickquestionsvideo.clearQuestions(instance);
                    mOptions.activeQuestion++;
                    if (
                        mOptions.activeQuestion < mOptions.questionsGame.length
                    ) {
                        $quickquestionsvideo.showQuestion(
                            mOptions.activeQuestion,
                            instance
                        );
                    } else {
                        if (mOptions.videoType > 0) {
                            $('#vquextVideoLocal-' + instance).show();
                        } else {
                            $('#vquextVideo-' + instance).show();
                        }
                        $('#vquextCover-' + instance).hide();
                        $quickquestionsvideo.muteVideo(false, instance);
                        const mesaut =
                            mOptions.authorVideo.length > 0
                                ? mOptions.msgs.msgAuthor +
                                  ': ' +
                                  mOptions.authorVideo
                                : '';
                        $quickquestionsvideo.showMessage(0, mesaut, instance);
                    }
                    mOptions.stateReproduction = 0;
                    $quickquestionsvideo.playVideo(instance);
                    break;
                case 4:
                    $quickquestionsvideo.clearQuestions(instance);
                    if (
                        mOptions.activeQuestion < mOptions.questionsGame.length
                    ) {
                        $quickquestionsvideo.showQuestion(
                            mOptions.activeQuestion,
                            instance
                        );
                    } else {
                        if (mOptions.videoType > 0) {
                            $('#vquextVideoLocal-' + instance).show();
                        } else {
                            $('#vquextVideo-' + instance).show();
                        }
                        $('#vquextCover-' + instance).hide();
                        $quickquestionsvideo.muteVideo(false, instance);
                        const mesaut =
                            mOptions.authorVideo.length > 0
                                ? mOptions.msgs.msgAuthor +
                                  ': ' +
                                  mOptions.authorVideo
                                : '';
                        $quickquestionsvideo.showMessage(0, mesaut, instance);
                    }
                    mOptions.stateReproduction = 0;
                    $quickquestionsvideo.playVideo(instance);
                    break;
                default:
                    break;
            }
        }, 1000);

        $quickquestionsvideo.uptateTime(0, instance);

        $('#vquextGamerOver-' + instance).hide();
        $('#vquextPHits-' + instance).text(mOptions.hits);
        $('#vquextPErrors-' + instance).text(mOptions.errors);
        $('#vquextPScore-' + instance).text(mOptions.score);
        /*if (mOptions.isNavigable) {
            $('#vquextNavigationButtons-' + instance).css('display', 'flex');
            $('#vquextNavigationButtons-' + instance).show();
        }*/
        mOptions.gameStarted = true;
    },

    updataProgressBar: function (ntime, instance) {
        let mOptions = $quickquestionsvideo.options[instance],
            widthBar = $('#vquextProgressBar-' + instance).width(),
            duratioVideo = mOptions.endVideoQuExt - mOptions.startVideoQuExt,
            timeRelative = ntime - mOptions.startVideoQuExt,
            widthIntBar = (timeRelative * widthBar) / duratioVideo;
        $('#vquextInterBar-' + instance).css('width', widthIntBar + 'px');
    },

    uptateTime: function (tiempo, instance) {
        const mTime =
            $exeDevices.iDevice.gamification.helpers.getTimeToString(tiempo);
        $('#vquextPTime-' + instance).text(mTime);
    },

    getTimeToString: function (iTime) {
        const mMinutes = Math.floor(iTime / 60) % 60,
            mSeconds = iTime % 60,
            minutesStr = mMinutes < 10 ? '0' + mMinutes : mMinutes.toString(),
            secondsStr = mSeconds < 10 ? '0' + mSeconds : mSeconds.toString();
        return `${minutesStr}:${secondsStr}`;
    },

    gameOver: function (type, instance) {
        const mOptions = $quickquestionsvideo.options[instance];

        mOptions.gameStarted = false;
        mOptions.gameActived = false;

        clearInterval(mOptions.counterClock);

        $('#vquextDivModeBoard-' + instance).hide();
        $('#vquextVideo-' + instance).hide();
        $('#vquextVideoLocal-' + instance).hide();
        $('#vquextProgressBar-' + instance).hide();
        $('#vquextCursor-' + instance).hide();
        $('#vquextCover-' + instance).hide();
        $('#vquextImagen-' + instance).hide();

        let message =
            type === 0
                ? mOptions.msgs.msgAllQuestions
                : mOptions.msgs.msgLostLives;

        $quickquestionsvideo.showMessage(0, message, instance);
        $quickquestionsvideo.showScoreGame(type, instance);
        $quickquestionsvideo.clearQuestions(instance);
        $quickquestionsvideo.uptateTime(0, instance);
        $quickquestionsvideo.stopVideo(instance);

        if (mOptions.videoType == 0)
            $quickquestionsvideo.endVideoYoutube(instance);

        $quickquestionsvideo.showNumbersQuestions(instance);

        $('#vquextStartGame-' + instance).text(mOptions.msgs.msgNewGame);
        $('#vquextGameContainer-' + instance + ' .VQXTP-StartGame').show();
        $('#vquextQuestionDiv-' + instance).hide();

        $quickquestionsvideo.showNavigationButtons(instance, 0);

        mOptions.gameOver = true;
        if (mOptions.isScorm === 1) {
            if (
                mOptions.repeatActivity ||
                $quickquestionsvideo.initialScore === ''
            ) {
                let score = (
                    (mOptions.hits * 10) /
                    mOptions.numberQuestions
                ).toFixed(2);
                $quickquestionsvideo.sendScore(true, instance);
                $('#vquextRepeatActivity-' + instance).text(
                    mOptions.msgs.msgYouScore + ': ' + score
                );
                $quickquestionsvideo.initialScore = score;
            }
        }
        $quickquestionsvideo.saveEvaluation(instance);
        $quickquestionsvideo.showFeedBack(instance);
    },

    showFeedBack: function (instance) {
        const mOptions = $quickquestionsvideo.options[instance],
            puntos = (mOptions.hits * 100) / mOptions.questionsGame.length;

        if (mOptions.gameMode == 2 || mOptions.feedBack) {
            if (puntos >= mOptions.percentajeFB) {
                $('#vquextDivFeedBack-' + instance)
                    .find('.vquext-feedback-game')
                    .show();
                $('#vquextDivFeedBack-' + instance).show();
            } else {
                $quickquestionsvideo.showMessage(
                    1,
                    mOptions.msgs.msgTryAgain.replace(
                        '%s',
                        mOptions.percentajeFB
                    ),
                    instance
                );
            }
        }
        if (mOptions.gameMode == 2) {
            $('#vquextGamerOver-' + instance)
                .find('.VQXTP-DataScore')
                .hide();
        }
    },

    showNumbersQuestions: function (instance) {
        const mOptions = $quickquestionsvideo.options[instance];

        $('#vquextNumberQuestion-' + instance).text(
            mOptions.activeQuestion + 1
        );
        $('#vquextPNumber-' + instance).text(
            mOptions.numberQuestions - mOptions.activeQuestion
        );

        if (mOptions.isNavigable) {
            let numleft = 0;
            for (let i = 0; i < mOptions.questionsGame.length; i++) {
                if (mOptions.questionsGame[i].answerScore != -1) {
                    numleft++;
                }
            }
            $('#vquextPNumber-' + instance).text(
                mOptions.numberQuestions - numleft
            );
        }
    },

    showQuestion: function (i, instance) {
        let mOptions = $quickquestionsvideo.options[instance],
            mQuextion = mOptions.questionsGame[i];

        mOptions.questionAnswer = false;
        $quickquestionsvideo.showNumbersQuestions(instance);
        mOptions.question = mQuextion;

        if (mOptions.answersRamdon) {
            $quickquestionsvideo.ramdonOptions(instance);
        }

        $('#vquextImagen-' + instance).hide();
        if (mQuextion.imageVideo == 0) {
            $('#vquextVideo-' + instance).hide();
            $('#vquextCover-' + instance).show();
            $('#vquextVideoLocal-' + instance).hide();
        } else {
            if (mOptions.videoType == 1 || mOptions.videoType == 3) {
                $('#vquextVideoLocal-' + instance).show();
                $('#vquextCover-' + instance).hide();
            } else if (mOptions.videoType == 2) {
                $('#vquextVideoLocal-' + instance).hide();
                $('#vquextCover-' + instance).hide();
                $('#vquextImagen-' + instance).show();
            } else {
                $('#vquextVideo-' + instance).show();
                $('#vquextCover-' + instance).hide();
            }
        }

        const mesaut =
            mOptions.authorVideo.length > 0
                ? mOptions.msgs.msgAuthor + ': ' + mOptions.authorVideo
                : '';
        $quickquestionsvideo.showMessage(0, mesaut, instance);

        if (mQuextion.soundVideo === 0) {
            $quickquestionsvideo.muteVideo(true, instance);
        } else {
            $quickquestionsvideo.muteVideo(false, instance);
        }

        if (mOptions.isScorm === 1) {
            if (
                mOptions.repeatActivity ||
                $quickquestionsvideo.initialScore === ''
            ) {
                let score = (
                    (mOptions.hits * 10) /
                    mOptions.numberQuestions
                ).toFixed(2);
                if (mOptions.isNavigable) {
                    score = 0;
                    for (let i = 0; i < mOptions.questionsGame.length; i++) {
                        score =
                            mOptions.questionsGame[i].answerScore > 0
                                ? score + 1
                                : score;
                    }
                    score = ((score * 10) / mOptions.numberQuestions).toFixed(
                        2
                    );
                }
                $quickquestionsvideo.sendScore(true, instance);
                $('#vquextRepeatActivity-' + instance).text(
                    mOptions.msgs.msgYouScore + ': ' + score
                );
            }
        }
        $quickquestionsvideo.saveEvaluation(instance);
    },

    updateLives: function (instance) {
        const mOptions = $quickquestionsvideo.options[instance];
        $('#vquextPLifes-' + instance).text(mOptions.livesLeft);

        $('#vquextLifesGame-' + instance)
            .find('.exeQuextIcons-Life')
            .each(function (index) {
                $(this).hide();
                if (mOptions.useLives) {
                    $(this).show();
                    if (index >= mOptions.livesLeft) {
                        $(this).hide();
                    }
                }
            });

        if (!mOptions.useLives) {
            $('#vquextNumberLivesGame-' + instance).hide();
        }
    },

    getTimeSeconds: function (iT) {
        const times = [15, 30, 60, 180, 300, 600];
        return times[iT];
    },

    getRetroFeedMessages: function (iHit, instance) {
        const msgs = $quickquestionsvideo.options[instance].msgs;
        let sMessages = iHit ? msgs.msgSuccesses : msgs.msgFailures;
        sMessages = sMessages.split('|');
        return sMessages[Math.floor(Math.random() * sMessages.length)];
    },

    answerQuestion: function (answer, instance) {
        const mOptions = $quickquestionsvideo.options[instance];
        if (!mOptions.gameActived) return;

        if (mOptions.question.typeQuestion == 1 && $.trim(answer).length == 0) {
            $quickquestionsvideo.showMessage(
                1,
                mOptions.msgs.msgIndicateSolution,
                instance
            );
            r;
            eturn;
        }
        mOptions.gameActived = false;

        let valid = false;

        if (mOptions.question.typeQuestion == 1) {
            valid = $quickquestionsvideo.checkWord(
                mOptions.question.solutionQuestion,
                answer
            );
        } else {
            valid = answer === mOptions.question.solution;
        }

        mOptions.questionAnswer = true;
        mOptions.questionsGame[mOptions.activeQuestion].answerScore = valid
            ? 1
            : 0;

        if (mOptions.showSolution) $quickquestionsvideo.drawSolution(instance);

        $quickquestionsvideo.updateScore(valid, instance);

        let percentageHits = (mOptions.hits / mOptions.numberQuestions) * 100,
            color = valid
                ? $quickquestionsvideo.borderColors.green
                : $quickquestionsvideo.borderColors.red;

        $('#vquextPHits-' + instance).text(mOptions.hits);
        $('#vquextPErrors-' + instance).text(mOptions.errors);
        $('#vquextProgressBar-' + instance + ' .VQXTP-PointBar')
            .eq(mOptions.activeQuestion)
            .css({
                'background-color': color,
            });

        if (
            mOptions.itinerary.showClue &&
            percentageHits >= mOptions.itinerary.percentageClue
        ) {
            if (!mOptions.obtainedClue) {
                mOptions.obtainedClue = true;
                $('#vquextPShowClue-' + instance).show();
                $('#vquextPShowClue-' + instance).text(
                    mOptions.msgs.msgInformation +
                        ': ' +
                        mOptions.itinerary.clueGame
                );
            }
        }

        mOptions.counter = 1;
        if (mOptions.useLives && mOptions.livesLeft <= 0) {
            $quickquestionsvideo.gameOver(1, instance);
            return;
        }
        if (mOptions.isScorm === 1) {
            if (
                mOptions.repeatActivity ||
                $quickquestionsvideo.initialScore === ''
            ) {
                const score = (
                    (mOptions.hits * 10) /
                    mOptions.numberQuestions
                ).toFixed(2);
                $quickquestionsvideo.sendScore(true, instance);
                $('#vquextRepeatActivity-' + instance).text(
                    mOptions.msgs.msgYouScore + ': ' + score
                );
            }
        }

        $quickquestionsvideo.saveEvaluation(instance);
    },

    answerQuestionBoard: function (value, instance) {
        const mOptions = $quickquestionsvideo.options[instance];

        if (!mOptions.gameActived) return;

        mOptions.gameActived = false;

        let valid = value;

        mOptions.questionAnswer = true;
        mOptions.questionsGame[mOptions.activeQuestion].answerScore = valid
            ? 1
            : 0;

        if (mOptions.showSolution) $quickquestionsvideo.drawSolution(instance);

        $quickquestionsvideo.updateScore(valid, instance);

        let percentageHits = (mOptions.hits / mOptions.numberQuestions) * 100,
            color = valid
                ? $quickquestionsvideo.borderColors.green
                : $quickquestionsvideo.borderColors.red;

        $('#vquextPHits-' + instance).text(mOptions.hits);
        $('#vquextPErrors-' + instance).text(mOptions.errors);
        $('#vquextProgressBar-' + instance + ' .VQXTP-PointBar')
            .eq(mOptions.activeQuestion)
            .css({
                'background-color': color,
            });

        if (
            mOptions.itinerary.showClue &&
            percentageHits >= mOptions.itinerary.percentageClue
        ) {
            if (!mOptions.obtainedClue) {
                mOptions.obtainedClue = true;
                $('#vquextPShowClue-' + instance).show();
                $('#vquextPShowClue-' + instance).text(
                    mOptions.msgs.msgInformation +
                        ': ' +
                        mOptions.itinerary.clueGame
                );
            }
        }

        mOptions.counter = 1;

        if (mOptions.useLives && mOptions.livesLeft <= 0) {
            $quickquestionsvideo.gameOver(1, instance);
            return;
        }

        if (mOptions.isScorm === 1) {
            if (
                mOptions.repeatActivity ||
                $quickquestionsvideo.initialScore === ''
            ) {
                const score = (
                    (mOptions.hits * 10) /
                    mOptions.numberQuestions
                ).toFixed(2);
                $quickquestionsvideo.sendScore(true, instance);
                $('#vquextRepeatActivity-' + instance).text(
                    mOptions.msgs.msgYouScore + ': ' + score
                );
            }
        }

        $quickquestionsvideo.saveEvaluation(instance);
    },

    preloadGame: function (instance) {
        const mOptions = $quickquestionsvideo.options[instance];
        if (mOptions.waitStart) {
            mOptions.waitStart = false;
            $quickquestionsvideo.startGame(instance);
        }
    },

    updateScore: function (correctAnswer, instance) {
        const mOptions = $quickquestionsvideo.options[instance],
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
                obtainedPoints = (1000 + pointsTemp) * question.customScore;
                points = obtainedPoints;
            } else {
                obtainedPoints =
                    (10 * question.customScore) / mOptions.scoreTotal;
                if (mOptions.order === 2) {
                    obtainedPoints = question.customScore / 10;
                }
                points = Number.isInteger(obtainedPoints)
                    ? obtainedPoints
                    : obtainedPoints.toFixed(2);
            }
            type = 2;
            mOptions.scoreGame += question.customScore;
        } else {
            mOptions.errors++;
            if (mOptions.gameMode === 0) {
                obtainedPoints = -330 * question.customScore;
                points = obtainedPoints;
                if (mOptions.useLives) {
                    mOptions.livesLeft--;
                    $quickquestionsvideo.updateLives(instance);
                }
            }
        }

        mOptions.score = Math.max(mOptions.score + obtainedPoints, 0);
        sscore =
            mOptions.gameMode !== 0
                ? Number.isInteger(mOptions.score)
                    ? mOptions.score
                    : mOptions.score.toFixed(2)
                : mOptions.score;

        $(`#vquextPScore-${instance}`).text(sscore);
        $(`#vquextPHits-${instance}`).text(mOptions.hits);
        $(`#vquextPErrors-${instance}`).text(mOptions.errors);

        message = $quickquestionsvideo.getMessageAnswer(
            correctAnswer,
            points,
            instance
        );
        $quickquestionsvideo.showMessage(type, message, instance);
    },

    getMessageAnswer: function (correctAnswer, npts, instance) {
        const mOptions = $quickquestionsvideo.options[instance],
            question = mOptions.questionsGame[mOptions.activeQuestion];
        let message = correctAnswer
            ? $quickquestionsvideo.getMessageCorrectAnswer(npts, instance)
            : $quickquestionsvideo.getMessageErrorAnswer(npts, instance);

        if (mOptions.showSolution && question.typeQuestion === 1) {
            message += `: ${question.solutionQuestion}`;
        }
        return message;
    },

    getMessageCorrectAnswer: function (npts, instance) {
        const mOptions = $quickquestionsvideo.options[instance],
            messageCorrect = $quickquestionsvideo.getRetroFeedMessages(
                true,
                instance
            ),
            pts = mOptions.msgs.msgPoints || 'puntos';
        let message = '';

        const customMessage =
            mOptions.questionsGame[mOptions.activeQuestion].msgHit;
        if (mOptions.customMessages && customMessage.length > 0) {
            message =
                mOptions.gameMode < 2
                    ? `${customMessage}. ${npts} ${pts}`
                    : customMessage;
        } else {
            message =
                mOptions.gameMode === 2
                    ? messageCorrect
                    : `${messageCorrect} ${npts} ${pts}`;
        }
        return message;
    },

    getMessageErrorAnswer: function (npts, instance) {
        const mOptions = $quickquestionsvideo.options[instance],
            messageError = $quickquestionsvideo.getRetroFeedMessages(
                false,
                instance
            ),
            pts = mOptions.msgs.msgPoints || 'puntos';
        let message = '';

        const customMessage =
            mOptions.questionsGame[mOptions.activeQuestion].msgError;
        if (mOptions.customMessages && customMessage.length > 0) {
            message = customMessage;
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

    checkWord: function (word, answord) {
        const cleanString = (str) =>
                $.trim(str)
                    .replace(/\s+/g, ' ')
                    .toUpperCase()
                    .replace(/[.,;]$/, ''),
            sWord = cleanString(word),
            sAnsWord = cleanString(answord);

        if (!sWord.includes('|')) {
            return sWord === sAnsWord;
        }

        return sWord.split('|').some((w) => cleanString(w) === sAnsWord);
    },

    showMessage: function (type, message, instance) {
        const colors = [
                '#555555',
                $quickquestionsvideo.borderColors.red,
                $quickquestionsvideo.borderColors.green,
                $quickquestionsvideo.borderColors.blue,
                $quickquestionsvideo.borderColors.yellow,
            ],
            color = colors[type];

        $(`#vquextPAuthor-${instance}`).html(message).css({
            color: color,
        });
        $exeDevices.iDevice.gamification.math.updateLatex(
            `vquextPAuthor-${instance}`
        );
    },

    ramdonOptions: function (instance) {
        const mOptions = $quickquestionsvideo.options[instance],
            question = mOptions.question,
            arrayRandom = question.options.slice(0, question.numberOptions),
            sSolution = question.options[question.solution];

        question.options =
            $exeDevices.iDevice.gamification.helpers.shuffleAds(arrayRandom);

        for (let i = 0; i < 4; i++) {
            if (i >= question.options.length) {
                question.options.push('');
            }
            if (question.options[i] === sSolution) {
                question.solution = i;
            }
        }
    },

    drawQuestions: function (instance) {
        const mOptions = $quickquestionsvideo.options[instance],
            mQuestion = mOptions.questionsGame[mOptions.activeQuestion],
            ntime = $exeDevices.iDevice.gamification.helpers.getTimeToString(
                $exeDevices.iDevice.gamification.helpers.getTimeSeconds(
                    mQuestion.time
                )
            );

        $(`#vquextQuestion-${instance}`).html(mQuestion.quextion).show();
        $(`#vquextPTime-${instance}`).text(ntime);
        $(`#vquextDivModeBoard-${instance}`).hide();

        if (mQuestion.typeQuestion === 1) {
            $(`#vquextDivReply-${instance}`).show();
            $(`#vquextOptionsDiv-${instance}`).hide();
            $('#vquextSolutionWord').focus();
            if (mOptions.modeBoard) {
                $(`#vquextDivModeBoard-${instance}`)
                    .css('display', 'flex')
                    .fadeIn();
            }
        } else {
            $(`#vquextOptionsDiv-${instance} > .VQXTP-Options`).each(
                function (index) {
                    const option = mQuestion.options[index];
                    $(this)
                        .css({
                            'border-color':
                                $quickquestionsvideo.borderColors.grey,
                            'background-color': 'transparent',
                            cursor: 'pointer',
                            'text-align': 'center',
                        })
                        .html(option || '')
                        .toggle(!!option);
                }
            );
            $(`#vquextOptionsDiv-${instance}`).show();
            $(`#vquextDivReply-${instance}`).hide();
        }

        const html = $(`#vquextQuestionDiv-${instance}`).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);
        if (latex) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                `vquextQuestionDiv-${instance}`
            );
        }
    },

    drawSolution: function (instance) {
        const mOptions = $quickquestionsvideo.options[instance],
            question = mOptions.question;
        let message = '';

        if (question.typeQuestion === 1 && mOptions.questionAnswer === false) {
            message = `${mOptions.msgs.msgSolution}: ${question.solutionQuestion}`;
            $quickquestionsvideo.showMessage(1, message, instance);
            $(
                `#vquextDivReply-${instance}, #vquextDivModeBoard-${instance}`
            ).hide();
        } else {
            $(`#vquextOptionsDiv-${instance} > .VQXTP-Options`).each(
                function (index) {
                    const isCorrect = index === question.solution;
                    $(this).css({
                        'border-color': isCorrect
                            ? $quickquestionsvideo.borderColors.correct
                            : $quickquestionsvideo.borderColors.incorrect,
                        'background-color': isCorrect
                            ? $quickquestionsvideo.colors.correct
                            : 'transparent',
                        cursor: 'default',
                        'text-align': 'center',
                    });
                }
            );
        }

        const html = $(`#vquextQuestionDiv-${instance}`).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);
        if (latex) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                `vquextQuestionDiv-${instance}`
            );
        }
    },

    clearQuestions: function (instance) {
        $(`#vquextOptionsDiv-${instance} > .VQXTP-Options`).each(function () {
            $(this)
                .css({
                    'border-color': $quickquestionsvideo.borderColors.grey,
                    'background-color': 'transparent',
                    cursor: 'default',
                    'text-align': 'center',
                })
                .text('');
        });
        $(`#vquextQuestion-${instance}`).text('');
        $(`#vquextPTime--${instance}`).text('00:00');
        $(
            `#vquextOptionsDiv-${instance}, #vquextDivReply-${instance}, #vquextDivModeBoard-${instance}`
        ).hide();
        $(`#vquextEdAnswer-${instance}`).val('');
    },
};
$(function () {
    $quickquestionsvideo.init();
});
