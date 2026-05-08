/* eslint-disable no-undef */
/**
 * Electrical Circuits iDevice (export code)
 *
 * Questions are paired with TikZ circuit diagrams rendered via TikZJax.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $eXeEC = {
    idevicePath: '',
    borderColors: $exeDevices.iDevice.gamification.colors.borderColors,
    colors: $exeDevices.iDevice.gamification.colors.backColor,
    options: {},
    userName: '',
    previousScore: '',
    initialScore: '',
    msgs: '',
    hasSCORMbutton: false,
    isInExe: false,
    started: false,
    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',
    mScorm: null,

    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            'Electrical Circuits',
            'electrical-circuits',
            'electrical-circuits-IDevice'
        );
    },

    enable: function () {
        $eXeEC.loadTikzJax();
        $eXeEC.loadGame();
    },

    /**
     * Load the TikZJax library from the iDevice export path.
     * tikzjax.js uses a MutationObserver to detect <script type="text/tikz">
     * elements and render them automatically.
     */
    loadTikzJax: function () {
        if (document.querySelector('script[src*="tikzjax"]')) return;
        const script = document.createElement('script');
        script.src = $eXeEC.idevicePath + 'tikzjax.js';
        document.head.appendChild(script);
    },

    sendScore: function (auto, instance) {
        const mOptions = $eXeEC.options[instance];

        mOptions.scorerp = $eXeEC.getScoreRP(instance);
        mOptions.previousScore = $eXeEC.previousScore;
        mOptions.userName = $eXeEC.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $eXeEC.previousScore = mOptions.previousScore;
    },

    getShowScoreRP: function (instance) {
        const mOptions = $eXeEC.options[instance];
        const total = mOptions.selectsGame.length;
        return Math.min(((mOptions.visiteds + 1) * 10) / total, 10);
    },

    getScoreRP: function (instance) {
        const mOptions = $eXeEC.options[instance];

        if (mOptions.activityMode === 'show') {
            return $eXeEC.getShowScoreRP(instance);
        }

        return (mOptions.scoreGame * 10) / mOptions.scoreTotal;
    },

    loadGame: function () {
        $eXeEC.options = [];
        $eXeEC.activities.each(function (i) {
            const dl = $('.electrical-circuits-DataGame', this);
            if (dl.length === 0) return; // Skip already initialized activities
            const version = $('.electrical-circuits-version', this).eq(0).text(),
                mOption = $eXeEC.loadDataGame(dl, version),
                msg = mOption.msgs.msgPlayStart;

            mOption.scorerp = 0;
            mOption.idevicePath = $eXeEC.idevicePath;
            mOption.main = 'elcpMainContainer-' + i;
            mOption.idevice = 'electrical-circuits-IDevice';

            $eXeEC.options.push(mOption);
            const interfaceHtml = $eXeEC.createInterface(i);
            dl.before(interfaceHtml).remove();

            $('#elcpGameMinimize-' + i).hide();
            $('#elcpGameContainer-' + i).hide();
            if (mOption.showMinimize) {
                $('#elcpGameMinimize-' + i)
                    .css({ cursor: 'pointer' })
                    .show();
            } else {
                $('#elcpGameContainer-' + i).show();
            }
            $('#elcpMessageMaximize-' + i).text(msg);
            $('#elcpDivFeedBack-' + i).prepend(
                $('.electrical-circuits-feedback-game', this)
            );

            $('#elcpDivFeedBack-' + i).hide();
            $('#elcpMainContainer-' + i).show();

            $eXeEC.addEvents(i);
        });

        let node = document.querySelector('.page-content');
        if (this.isInExe) {
            node = document.getElementById('node-content');
        }
        if (node)
            $exeDevices.iDevice.gamification.observers.observeResize(
                $eXeEC,
                node
            );

        $exeDevices.iDevice.gamification.math.updateLatex(
            '.electrical-circuits-IDevice'
        );
    },

    createInterface: function (instance) {
        const path = $eXeEC.idevicePath,
            msgs = $eXeEC.options[instance].msgs,
            mOptions = $eXeEC.options[instance],
            html = `
        <div class="ELCP-MainContainer" id="elcpMainContainer-${instance}">
            <div class="ELCP-GameMinimize" id="elcpGameMinimize-${instance}">
                <a href="#" class="ELCP-LinkMaximize" id="elcpLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                    <img src="${path}elcIcon.png" class="ELCP-IconMinimize ELCP-Activo" alt="">
                    <div class="ELCP-MessageMaximize" id="elcpMessageMaximize-${instance}"></div>
                </a>
            </div>
            <div class="ELCP-GameContainer" id="elcpGameContainer-${instance}">
                <div class="ELCP-GameScoreBoard">
                    <div class="ELCP-GameScores">
                        <div class="exeQuextIcons exeQuextIcons-Number" title="${msgs.msgNumQuestions}"></div>
                        <p><span class="sr-av">${msgs.msgNumQuestions}: </span><span id="elcpPNumber-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                        <p><span class="sr-av">${msgs.msgHits}: </span><span id="elcpPHits-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Error" title="${msgs.msgErrors}"></div>
                        <p><span class="sr-av">${msgs.msgErrors}: </span><span id="elcpPErrors-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Score" title="${msgs.msgScore}"></div>
                        <p><span class="sr-av">${msgs.msgScore}: </span><span id="elcpPScore-${instance}">0</span></p>
                    </div>
                    <div class="ELCP-LifesGame" id="elcpLifesGame-${instance}">
                        ${$eXeEC.createLives(msgs)}
                    </div>
                    <div class="ELCP-NumberLifesGame" id="elcpNumberLivesGame-${instance}">
                        <strong class="sr-av">${msgs.msgLive}:</strong>
                        <div class="exeQuextIcons exeQuextIcons-Life"></div>
                        <p id="elcpPLifes-${instance}">0</p>
                    </div>
                    <div class="ELCP-TimeNumber">
                        <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                        <div class="exeQuextIcons exeQuextIcons-Time" title="${msgs.msgTime}"></div>
                        <p id="elcpPTime-${instance}" class="ELCP-PTime">00:00</p>
                        <a href="#" class="ELCP-LinkMinimize" id="elcpLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                            <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Minimize ELCP-Activo"></div>
                        </a>
                        <a href="#" class="ELCP-LinkFullScreen" id="elcpLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                            <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-FullScreen ELCP-Activo" id="elcpFullScreen-${instance}"></div>
                        </a>
                    </div>
                </div>
                <div class="ELCP-ShowFullScreenRow" id="elcpShowFullScreenRow-${instance}">
                    <a href="#" class="ELCP-ShowFullScreenBtn" id="elcpShowFullScreen-${instance}" title="${msgs.msgFullScreen}">
                        <div class="exeQuextIcons exeQuextIcons-FullScreen" aria-hidden="true"></div>
                        <span class="sr-av">${msgs.msgFullScreen}</span>
                    </a>
                </div>
                <div class="ELCP-ShowClue" id="elcpShowClue-${instance}">
                    <div class="sr-av">${msgs.msgClue}:</div>
                    <p class="ELCP-PShowClue ELCP-parpadea" id="elcpPShowClue-${instance}"></p>
                </div>
                <div class="ELCP-ShowDescription" id="elcpDescription-${instance}"></div>
                <div class="ELCP-Multimedia" id="elcpMultimedia-${instance}">
                    <div class="ELCP-TikzPreview" id="elcpTikzPreview-${instance}"></div>
                    <img src="${path}elcHome.png" class="ELCP-Cover" id="elcpCover-${instance}" alt="${msgs.msgNoImage}" />
                    <div class="ELCP-GameOver" id="elcpGamerOver-${instance}">
                        <div class="ELCP-DataImage">
                            <img src="${path}exequextwon.png" class="ELCP-HistGGame" id="elcpHistGame-${instance}" alt="${msgs.msgAllQuestions}" />
                            <img src="${path}exequextlost.png" class="ELCP-LostGGame" id="elcpLostGame-${instance}" alt="${msgs.msgLostLives}" />
                        </div>
                        <div class="ELCP-DataScore">
                            <p id="elcpOverScore-${instance}">Score: 0</p>
                            <p id="elcpOverHits-${instance}">Hits 0</p>
                            <p id="elcpOverErrors-${instance}">Errors: 0</p>
                        </div>
                    </div>
                </div>
                <div class="ELCP-ShowNavigation" id="elcpShowNavigation-${instance}">
                    <a href="#" class="ELCP-ShowNavBtn" id="elcpShowPrev-${instance}" title="${msgs.msgPrevious || ''}">
                        <img src="${path}bfafprevious.png" class="ELCP-ShowNavImg" alt="${msgs.msgPrevious || ''}" />
                    </a>
                    <span class="ELCP-ShowCounter" id="elcpShowCounter-${instance}">1 / 1</span>
                    <a href="#" class="ELCP-ShowNavBtn" id="elcpShowNext-${instance}" title="${msgs.msgNext || ''}">
                        <img src="${path}bfafnext.png" class="ELCP-ShowNavImg" alt="${msgs.msgNext || ''}" />
                    </a>
                </div>                
                <div class="ELCP-AuthorLicence" id="elcpAuthorLicence-${instance}">
                    <div class="sr-av">${msgs.msgAuthor}:</div>
                    <p id="elcpPAuthor-${instance}"></p>
                </div>
                <div class="sr-av" id="elcpStartGameSRAV-${instance}">${msgs.msgPlayStart}:</div>
                <div class="ELCP-StartGame"><a href="#" id="elcpStartGame-${instance}"></a></div>
                <div class="ELCP-QuestionDiv" id="elcpQuestionDiv-${instance}">
                    <div class="sr-av">${msgs.msgQuestion}:</div>
                    <div class="ELCP-Question" id="elcpQuestion-${instance}"></div>
                    <div class="ELCP-OptionsDiv" id="elcpOptionsDiv-${instance}">
                        ${$eXeEC.createOptions(msgs, instance)}
                    </div>
                </div>
                <div class="ELCP-WordsDiv" id="elcpWordDiv-${instance}">
                    <div class="sr-av">${msgs.msgAnswer}:</div>
                    <div class="ELCP-Prhase" id="elcpEPhrase-${instance}"></div>
                    <div class="sr-av">${msgs.msgQuestion}:</div>
                    <div class="ELCP-Definition" id="elcpDefinition-${instance}"></div>
                    <div class="ELCP-DivReply" id="elcpDivResponder-${instance}">
                        <input type="text" value="" class="ELCP-EdReply form-control" id="elcpEdAnswer-${instance}" autocomplete="off">
                        <a href="#" id="elcpBtnReply-${instance}" title="${msgs.msgAnswer}">
                            <strong class="sr-av">${msgs.msgAnswer}</strong>
                            <div class="exeQuextIcons-Submit ELCP-Activo"></div>
                        </a>
                    </div>
                </div>
                <div class="ELCP-BottonContainerDiv" id="elcpBottonContainer-${instance}">
                    <div class="ELCP-AnswersDiv" id="elcpAnswerDiv-${instance}">
                        <div class="ELCP-Answers" id="elcpAnswers-${instance}"></div>
                        <a href="#" id="elcpButtonAnswer-${instance}" title="${msgs.msgAnswer}">
                            <strong class="sr-av">${msgs.msgAnswer}</strong>
                            <div class="exeQuextIcons-Submit ELCP-Activo"></div>
                        </a>
                    </div>
                </div>
                <div class="ELCP-DivFeedBack" id="elcpDivFeedBack-${instance}">
                    <input type="button" id="elcpFeedBackClose-${instance}" value="${msgs.msgClose}" class="feedbackbutton" />
                </div>
                <div class="ELCP-DivModeBoard" id="elcpDivModeBoard-${instance}">
                    <a class="ELCP-ModeBoard" href="#" id="elcpModeBoardOK-${instance}" title="${msgs.msgCorrect}">${msgs.msgCorrect}</a>
                    <a class="ELCP-ModeBoard" href="#" id="elcpModeBoardMoveOn-${instance}" title="${msgs.msgMoveOne}">${msgs.msgMoveOne}</a>
                    <a class="ELCP-ModeBoard" href="#" id="elcpModeBoardKO-${instance}" title="${msgs.msgIncorrect}">${msgs.msgIncorrect}</a>
                </div>
            </div>
            <div class="ELCP-Cubierta" id="elcpCubierta-${instance}" style="display:none">
                    <div class="ELCP-CodeAccessDiv" id="elcpCodeAccessDiv-${instance}">
                        <p class="ELCP-MessageCodeAccessE" id="elcpMesajeAccesCodeE-${instance}"></p>
                        <div class="ELCP-DataCodeAccessE">
                            <label for="elcpCodeAccessE-${instance}" class="sr-av">${msgs.msgCodeAccess}:</label>
                            <input type="text" class="ELCP-CodeAccessE form-control" id="elcpCodeAccessE-${instance}" placeholder="${msgs.msgCodeAccess}">
                            <a href="#" id="elcpCodeAccessButton-${instance}" title="${msgs.msgSubmit}">
                                <strong class="sr-av">${msgs.msgSubmit}</strong>
                                <div class="exeQuextIcons exeQuextIcons-Submit ELCP-Activo"></div>
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
            <a href="#" class="ELCP-Option${index + 1} ELCP-Options" id="elcpOption${index + 1}-${instance}" data-number="${index}"></a>
        `
            )
            .join('');

        return optionss;
    },

    showCubiertaOptions(mode, instance) {
        if (mode === false) {
            $('#elcpCubierta-' + instance).fadeOut();
            return;
        }
        $('#elcpCubierta-' + instance).fadeIn();
    },

    loadDataGame: function (data) {
        let json = $exeDevices.iDevice.gamification.helpers.decrypt(
                data.text()
            ),
            mOptions =
                $exeDevices.iDevice.gamification.helpers.isJsonString(json);
        mOptions.gameOver = false;
        mOptions.gameStarted = false;
        mOptions.scoreGame = 0;
        mOptions.percentajeQuestions =
            typeof mOptions.percentajeQuestions != 'undefined'
                ? mOptions.percentajeQuestions
                : 100;
        mOptions.modeBoard =
            typeof mOptions.modeBoard == 'undefined'
                ? false
                : mOptions.modeBoard;

        for (let i = 0; i < mOptions.selectsGame.length; i++) {
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
            mOptions.selectsGame[i].tikzCode =
                typeof mOptions.selectsGame[i].tikzCode == 'undefined'
                    ? ''
                    : mOptions.selectsGame[i].tikzCode;
            mOptions.selectsGame[i].description =
                typeof mOptions.selectsGame[i].description == 'undefined'
                    ? ''
                    : mOptions.selectsGame[i].description;
        }

        mOptions.scoreGame = 0;
        mOptions.scoreTotal = 0;
        mOptions.gameMode =
            typeof mOptions.gameMode != 'undefined' ? mOptions.gameMode : 1;
        mOptions.percentajeFB =
            typeof mOptions.percentajeFB != 'undefined'
                ? mOptions.percentajeFB
                : 100;
        mOptions.useLives = mOptions.gameMode != 0 ? false : mOptions.useLives;
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
        mOptions.activityMode =
            typeof mOptions.activityMode == 'undefined'
                ? 'test'
                : mOptions.activityMode;
        mOptions.questionsRandom = mOptions.questionsRandom ?? false;

        mOptions.selectsGame =
            $exeDevices.iDevice.gamification.helpers.getQuestions(
                mOptions.selectsGame,
                mOptions.percentajeQuestions,
                mOptions.questionsRandom
            );

        for (let i = 0; i < mOptions.selectsGame.length; i++) {
            if (mOptions.customScore) {
                mOptions.scoreTotal += mOptions.selectsGame[i].customScore;
            } else {
                mOptions.selectsGame[i].customScore = 1;
                mOptions.scoreTotal += mOptions.selectsGame[i].customScore;
            }
        }
        mOptions.numberQuestions = mOptions.selectsGame.length;
        return mOptions;
    },

    removeEvents: function (instance) {
        $(window).off('unload.exeEC beforeunload.exeEC');
        $(`#elcpLinkMaximize-${instance}`).off('click touchstart');
        $(`#elcpLinkMinimize-${instance}`).off('click touchstart');
        $('#elcpMainContainer-' + instance)
            .closest('.idevice_node')
            .off('click', '.Games-SendScore');
        $(`#elcpCodeAccessButton-${instance}`).off('click touchstart');
        $(`#elcpCodeAccessE-${instance}`).off('keydown');
        $(`#elcpBtnMoveOn-${instance}`).off('click');
        $(`#elcpBtnReply-${instance}`).off('click');
        $(`#elcpEdAnswer-${instance}`).off('keydown');
        $(`#elcpOptionsDiv-${instance}`)
            .find('.ELCP-Options')
            .off('click');
        $(document).off(`fullscreenchange.exeEC${instance}`);
        $(document).off(`webkitfullscreenchange.exeEC${instance}`);
        $(document).off(`mozfullscreenchange.exeEC${instance}`);
        $(document).off(`MSFullscreenChange.exeEC${instance}`);
        $(`#elcpGameContainer-${instance}`).removeClass('ELCP-IsFullscreen');
        $(`#elcpShowFullScreen-${instance}`).off('click');
        $(`#elcpShowFullScreenRow-${instance}`).hide();
        $(`#elcpLinkFullScreen-${instance}`).off('click touchstart');
        $(`#elcpButtonAnswer-${instance}`).off('click touchstart');
        $(`#elcpStartGame-${instance}`).off('click');
        $(`#elcpFeedBackClose-${instance}`).off('click');
        $(`#elcpModeBoardOK-${instance}`).off('click');
        $(`#elcpModeBoardKO-${instance}`).off('click');
        $(`#elcpModeBoardMoveOn-${instance}`).off('click');
        $(`#elcpShowPrev-${instance}`).off('click');
        $(`#elcpShowNext-${instance}`).off('click');
    },

    addEvents: function (instance) {
        const mOptions = $eXeEC.options[instance];

        mOptions.respuesta = '';

        $eXeEC.removeEvents(instance);
        $(window).on('unload.exeEC beforeunload.exeEC', () => {
            $exeDevices.iDevice.gamification.scorm.endScorm(
                $eXeEC.mScorm
            );
        });

        $(`#elcpGamerOver-${instance}`).css('display', 'flex');

        $(`#elcpLinkMaximize-${instance}`).on('click touchstart', (e) => {
            e.preventDefault();
            $(`#elcpGameContainer-${instance}`).show();
            $(`#elcpGameMinimize-${instance}`).hide();
        });

        $(`#elcpLinkMinimize-${instance}`).on('click touchstart', (e) => {
            e.preventDefault();
            $(`#elcpGameContainer-${instance}`).hide();
            $(`#elcpGameMinimize-${instance}`)
                .css('visibility', 'visible')
                .show();
            return true;
        });

        $('#elcpMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $eXeEC.sendScore(false, instance);
                $eXeEC.saveEvaluation(instance);
                return true;
            });

        $(
            `#elcpGamerOver-${instance}, #elcpCodeAccessDiv-${instance}, #elcpAnswerDiv-${instance}`
        ).hide();
        $(`#elcpCover-${instance}`).show();

        $(`#elcpCodeAccessButton-${instance}`).on(
            'click touchstart',
            (e) => {
                e.preventDefault();
                $eXeEC.enterCodeAccess(instance);
            }
        );

        $(`#elcpCodeAccessE-${instance}`).on('keydown', (event) => {
            if (event.which === 13 || event.keyCode === 13) {
                $eXeEC.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        $(`#elcpBtnMoveOn-${instance}`).on('click', (e) => {
            e.preventDefault();
            $eXeEC.newQuestion(instance);
        });

        $(`#elcpBtnReply-${instance}`).on('click', (e) => {
            e.preventDefault();
            $eXeEC.answerQuestion(instance);
        });

        $(`#elcpEdAnswer-${instance}`).on('keydown', (event) => {
            if (event.which === 13 || event.keyCode === 13) {
                $eXeEC.answerQuestion(instance);
                return false;
            }
            return true;
        });

        mOptions.livesLeft = mOptions.numberLives;

        $(`#elcpOptionsDiv-${instance}`)
            .find('.ELCP-Options')
            .on('click', function (e) {
                e.preventDefault();
                $eXeEC.changeQuextion(instance, this);
            });

        const fullscreenHandler = () => {
            $eXeEC.updateFullscreenLayout(instance);
        };
        $(document).on(`fullscreenchange.exeEC${instance}`, fullscreenHandler);
        $(document).on(`webkitfullscreenchange.exeEC${instance}`, fullscreenHandler);
        $(document).on(`mozfullscreenchange.exeEC${instance}`, fullscreenHandler);
        $(document).on(`MSFullscreenChange.exeEC${instance}`, fullscreenHandler);

        $(`#elcpLinkFullScreen-${instance}`).on(
            'click touchstart',
            (e) => {
                e.preventDefault();
                const element = document.getElementById(
                    `elcpGameContainer-${instance}`
                );
                $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                    element
                );
            }
        );

        $eXeEC.updateFullscreenLayout(instance);
        $eXeEC.updateLives(instance);
        $(`#elcpInstructions-${instance}`).text(mOptions.instructions);
        $(`#elcpPNumber-${instance}`).text(mOptions.numberQuestions);
        $(`#elcpGameContainer-${instance} .ELCP-StartGame`).show();
        $(`#elcpQuestionDiv-${instance}`).hide();
        $(`#elcpBottonContainer-${instance}`).addClass(
            'ELCP-BottonContainerDivEnd'
        );

        if (mOptions.itinerary.showCodeAccess) {
            $(`#elcpAnswerDiv-${instance}`).hide();
            $(`#elcpMesajeAccesCodeE-${instance}`).text(
                mOptions.itinerary.messageCodeAccess
            );
            $(`#elcpCodeAccessDiv-${instance}`).show();
            $(`#elcpGameContainer-${instance} .ELCP-StartGame`).hide();
            $eXeEC.showCubiertaOptions(true, instance);
        }

        $(`#elcpInstruction-${instance}`).text(mOptions.instructions);
        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        document.title = mOptions.title;
        $('meta[name=author]').attr('content', mOptions.author);
        $(`#elcpShowClue-${instance}`).hide();
        mOptions.gameOver = false;

        $(`#elcpButtonAnswer-${instance}`).on('click touchstart', (e) => {
            e.preventDefault();
            $eXeEC.answerQuestion(instance);
        });

        $(`#elcpStartGame-${instance}`)
            .text(mOptions.msgs.msgPlayStart)
            .on('click', (e) => {
                e.preventDefault();
                $eXeEC.startGame(instance);
            });

        $(`#elcpFeedBackClose-${instance}`).on('click', () => {
            $(`#elcpDivFeedBack-${instance}`).hide();
        });

        if (mOptions.gameMode === 2) {
            const $gameContainer = $(`#elcpGameContainer-${instance}`);
            $gameContainer
                .find(
                    '.exeQuextIcons-Hit, .exeQuextIcons-Error, .exeQuextIcons-Score'
                )
                .hide();
            $(
                `#elcpPErrors-${instance}, #elcpPHits-${instance}, #elcpPScore-${instance}`
            ).hide();
        }

        $(`#elcpWordDiv-${instance}`).hide();

        $(`#elcpModeBoardOK-${instance}`).on('click', (e) => {
            e.preventDefault();
            $eXeEC.answerQuestionBoard(true, instance);
        });

        $(`#elcpModeBoardKO-${instance}`).on('click', (e) => {
            e.preventDefault();
            $eXeEC.answerQuestionBoard(false, instance);
        });

        $(`#elcpModeBoardMoveOn-${instance}`).on('click', (e) => {
            e.preventDefault();
            $eXeEC.newQuestion(instance);
        });

        setTimeout(() => {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                this.isInExe
            );
        }, 500);

        if (mOptions.activityMode === 'show') {
            $eXeEC.initShowMode(instance);
        }
    },

    initShowMode: function (instance) {
        const mOptions = $eXeEC.options[instance];

        // Hide all game-related elements
        $(`#elcpGameContainer-${instance} .ELCP-GameScoreBoard`).hide();
        $(`#elcpGameContainer-${instance} .ELCP-StartGame`).hide();
        $(`#elcpStartGameSRAV-${instance}`).hide();
        $(`#elcpQuestionDiv-${instance}`).hide();
        $(`#elcpBottonContainer-${instance}`).hide();
        $(`#elcpWordDiv-${instance}`).hide();
        $(`#elcpDivFeedBack-${instance}`).hide();
        $(`#elcpDivModeBoard-${instance}`).hide();
        $(`#elcpShowClue-${instance}`).hide();
        $(`#elcpGamerOver-${instance}`).hide();
        $(`#elcpAuthorLicence-${instance}`).hide();

        // Show fullscreen row and wire its button
        $(`#elcpShowFullScreenRow-${instance}`).css('display', 'flex');
        $(`#elcpShowFullScreen-${instance}`).on('click', (e) => {
            e.preventDefault();
            const element = document.getElementById(`elcpGameContainer-${instance}`);
            $exeDevices.iDevice.gamification.helpers.toggleFullscreen(element);
        });

        // Keep show-mode top bars ordered: fullscreen button row, then navigation
        $(`#elcpShowNavigation-${instance}`)
            .insertBefore(`#elcpMultimedia-${instance}`)
            .css('display', 'flex');
        $(`#elcpShowFullScreenRow-${instance}`)
            .insertBefore(`#elcpShowNavigation-${instance}`)
            .css('display', 'flex');
        $(`#elcpDescription-${instance}`).insertAfter(`#elcpMultimedia-${instance}`);

        // Apply Show mode layout
        $(`#elcpGameContainer-${instance}`).addClass('ELCP-ShowMode');
        $(`#elcpMultimedia-${instance}`).addClass('ELCP-ShowMultimedia');
        $(`#elcpDescription-${instance}`).addClass('ELCP-ShowDescriptionActive');

        // Set up state
        mOptions.showCurrentIndex = 0;
        mOptions.visiteds = 0;
        mOptions.gameStarted = true;
        mOptions.feedbackShown = false;
        mOptions.obtainedClue = false;

        // Show first circuit
        $eXeEC.showCircuitAtIndex(0, instance);

        // Save initial score only if previous > 0 and below minimum
        const previous = parseFloat($eXeEC.previousScore) || 0;
        const minScore = (1 * 10) / mOptions.selectsGame.length;
        if (previous > 0 && previous < minScore) {
            mOptions.scorerp = minScore;
            if (mOptions.isScorm > 0) {
                $eXeEC.sendScore(true, instance);
            }
            $eXeEC.saveEvaluation(instance);
        }

        // Navigation events
        $(`#elcpShowPrev-${instance}`).on('click', (e) => {
            e.preventDefault();
            if (mOptions.showCurrentIndex > 0) {
                mOptions.showCurrentIndex--;
                $eXeEC.showCircuitAtIndex(mOptions.showCurrentIndex, instance);
            }
        });

        $(`#elcpShowNext-${instance}`).on('click', (e) => {
            e.preventDefault();
            if (mOptions.showCurrentIndex < mOptions.selectsGame.length - 1) {
                mOptions.showCurrentIndex++;
                mOptions.visiteds++;
                $eXeEC.showCircuitAtIndex(mOptions.showCurrentIndex, instance);
                if (mOptions.isScorm > 0) {
                    $eXeEC.sendScore(true, instance);
                }
                $eXeEC.saveEvaluation(instance);
            }
        });
    },

    showCircuitAtIndex: function (index, instance) {
        const mOptions = $eXeEC.options[instance],
            total = mOptions.selectsGame.length,
            question = mOptions.selectsGame[index],
            path = $eXeEC.idevicePath;

        // Update counter
        $(`#elcpShowCounter-${instance}`).text((index + 1) + ' / ' + total);

        // Update navigation button states
        const $prev = $(`#elcpShowPrev-${instance} img`);
        const $next = $(`#elcpShowNext-${instance} img`);
        $prev.attr('src', index === 0 ? path + 'bfafpreviousd.png' : path + 'bfafprevious.png');
        $next.attr('src', index >= total - 1 ? path + 'bfafnextd.png' : path + 'bfafnext.png');

        // Show TikZ circuit
        $(`#elcpCover-${instance}`).hide();
        $(`#elcpTikzPreview-${instance}`).empty().show();

        if (question.tikzCode && question.tikzCode.trim().length > 0) {
            $eXeEC.showTikzCircuit(question.tikzCode, instance);
        }

        // Show description
        const desc = question.description || '';
        const $desc = $(`#elcpDescription-${instance}`);
        $desc.text(desc);
        if (desc.length > 0) {
            $desc.addClass('ELCP-ShowDescriptionActive');
        } else {
            $desc.removeClass('ELCP-ShowDescriptionActive');
        }

        $eXeEC.checkShowModeFeedback(instance);
        $eXeEC.checkShowModeClue(instance);
    },

    checkShowModeFeedback: function (instance) {
        const mOptions = $eXeEC.options[instance];
        if (!mOptions.feedBack || mOptions.feedbackShown) return;
        const total = mOptions.selectsGame.length;
        const visitedPct = ((mOptions.visiteds + 1) * 100) / total;
        if (visitedPct >= mOptions.percentajeFB) {
            mOptions.feedbackShown = true;
            $(`#elcpDivFeedBack-${instance}`)
                .find('.electrical-circuits-feedback-game')
                .show();
            $(`#elcpDivFeedBack-${instance}`).show();
        }
    },

    checkShowModeClue: function (instance) {
        const mOptions = $eXeEC.options[instance];
        if (!mOptions.itinerary.showClue || mOptions.obtainedClue) return;
        const total = mOptions.selectsGame.length;
        const visitedPct = ((mOptions.visiteds + 1) * 100) / total;
        if (visitedPct >= mOptions.itinerary.percentageClue) {
            mOptions.obtainedClue = true;
            $(`#elcpShowClue-${instance}`)
                .text(`${mOptions.msgs.msgInformation}: ${mOptions.itinerary.clueGame}`)
                .show();
        }
    },

    saveEvaluation: function (instance) {
        const mOptions = $eXeEC.options[instance];
        mOptions.scorerp = $eXeEC.getScoreRP(instance);

        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $eXeEC.isInExe
        );
    },

    changeQuextion: function (instance, button) {
        const mOptions = $eXeEC.options[instance],
            numberButton = parseInt($(button).data('number'), 10),
            letters = 'ABCD',
            letter = letters[numberButton],
            bordeColors = [
                $eXeEC.borderColors.red,
                $eXeEC.borderColors.blue,
                $eXeEC.borderColors.green,
                $eXeEC.borderColors.yellow,
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
            color: $eXeEC.colors.black,
        };

        const css = type ? obj1 : obj2;

        $(button).css(css);
        $(`#elcpAnswers-${instance} .ELCP-AnswersOptions`).remove();

        for (let i = 0; i < mOptions.respuesta.length; i++) {
            const answerClass = `ELCP-Answer${letters.indexOf(mOptions.respuesta[i]) + 1}`;
            $(`#elcpAnswers-${instance}`).append(
                `<div class="ELCP-AnswersOptions ${answerClass}"></div>`
            );
        }
    },

    /**
     * Render a TikZ circuit diagram in the multimedia area.
     * Uses TikZJax's MutationObserver to auto-render <script type="text/tikz">.
     */
    showTikzCircuit: function (tikzCode, instance) {
        const $preview = $(`#elcpTikzPreview-${instance}`),
            $cover = $(`#elcpCover-${instance}`);

        $preview.empty().hide();
        $cover.hide();

        if (!tikzCode || tikzCode.trim().length === 0) {
            $cover.show();
            return;
        }

        // Create <script type="text/tikz"> via DOM so MutationObserver detects it
        const tikzScript = document.createElement('script');
        tikzScript.type = 'text/tikz';
        tikzScript.dataset.texPackages = JSON.stringify({ 'circuitikz': '', 'amsmath': '', 'amssymb': '' });
        tikzScript.dataset.showConsole = 'true';
        tikzScript.textContent = '\\begin{document}' + tikzCode + '\\end{document}';

        $preview.show();
        $preview[0].appendChild(tikzScript);

        // Observe when TikZJax replaces the <script> with an <svg>.
        // Remove inline width/height so CSS can scale it to fill the container.
        const observer = new MutationObserver(() => {
            const svg = $preview[0].querySelector('svg');
            if (svg) {
                svg.removeAttribute('width');
                svg.removeAttribute('height');
                observer.disconnect();
            }
        });
        observer.observe($preview[0], { childList: true, subtree: true });
    },

    enterCodeAccess: function (instance) {
        const mOptions = $eXeEC.options[instance],
            codeEntered = $(`#elcpCodeAccessE-${instance}`)
                .val()
                .toLowerCase(),
            correctCode = mOptions.itinerary.codeAccess.toLowerCase();

        if (codeEntered === correctCode) {
            $eXeEC.showCubiertaOptions(false, instance);
            $eXeEC.startGame(instance);
            $(`#elcpLinkMaximize-${instance}`).trigger('click');
        } else {
            $(`#elcpMesajeAccesCodeE-${instance}`)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $(`#elcpCodeAccessE-${instance}`).val('');
        }
    },

    showScoreGame: function (type, instance) {
        const mOptions = $eXeEC.options[instance],
            msgs = mOptions.msgs,
            $histGame = $(`#elcpHistGame-${instance}`),
            $lostGame = $(`#elcpLostGame-${instance}`),
            $overPoint = $(`#elcpOverScore-${instance}`),
            $overHits = $(`#elcpOverHits-${instance}`),
            $overErrors = $(`#elcpOverErrors-${instance}`),
            $showClue = $(`#elcpShowClue-${instance}`),
            $gamerOver = $(`#elcpGamerOver-${instance}`);

        let message = '',
            messageColor = 2;

        $histGame.hide();
        $lostGame.hide();
        $overPoint.show();
        $overHits.show();
        $overErrors.show();
        $showClue.hide();

        switch (parseInt(type, 10)) {
            case 0:
                message = `${msgs.msgCool} ${msgs.msgAllQuestions}`;
                $histGame.show();
                if (mOptions.itinerary.showClue) {
                    if (mOptions.obtainedClue) {
                        message = msgs.msgAllQuestions;
                        $showClue
                            .text(
                                `${msgs.msgInformation}: ${mOptions.itinerary.clueGame}`
                            )
                            .show();
                    } else {
                        $showClue
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
                $lostGame.show();
                if (mOptions.itinerary.showClue) {
                    if (mOptions.obtainedClue) {
                        $showClue
                            .text(
                                `${msgs.msgInformation}: ${mOptions.itinerary.clueGame}`
                            )
                            .show();
                    } else {
                        $showClue
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
                $overPoint.hide();
                $overHits.hide();
                $overErrors.hide();
                $showClue.text(mOptions.itinerary.clueGame).show();
                break;
            default:
                break;
        }

        $eXeEC.showMessage(messageColor, message, instance);

        const scoreText =
            mOptions.gameMode === 0
                ? `${msgs.msgScore}: ${mOptions.score}`
                : `${msgs.msgScore}: ${mOptions.score.toFixed(2)}`;

        $overPoint.html(scoreText);
        $overHits.html(`${msgs.msgHits}: ${mOptions.hits}`);
        $overErrors.html(`${msgs.msgErrors}: ${mOptions.errors}`);

        if (mOptions.gameMode === 2) {
            $(`#elcpGameContainer-${instance}`)
                .find('.ELCP-DataGameScore')
                .hide();
        }

        $gamerOver.show();
    },

    startGame: function (instance) {
        const mOptions = $eXeEC.options[instance];
        if (mOptions.gameStarted) return;

        if (mOptions.questionsRandom) {
            mOptions.selectsGame =
                $exeDevices.iDevice.gamification.helpers.shuffleAds(
                    mOptions.selectsGame
                );
        }

        mOptions.scoreGame = 0;
        mOptions.obtainedClue = false;

        $(`#elcpShowClue-${instance}`).hide();
        $(`#elcpGameContainer-${instance} .ELCP-StartGame`).hide();
        $(`#elcpQuestion-${instance}`).text('');
        $(`#elcpQuestionDiv-${instance}`).show();
        $(`#elcpWordDiv-${instance}`).hide();

        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.gameActived = false;
        mOptions.activeQuestion = -1;
        mOptions.validQuestions = mOptions.numberQuestions;
        mOptions.counter = 0;
        mOptions.gameStarted = false;
        mOptions.livesLeft = mOptions.numberLives;

        $eXeEC.updateLives(instance);
        $(`#elcpPNumber-${instance}`).text(mOptions.numberQuestions);

        mOptions.selectsGame.forEach((question) => {
            question.answerScore = -1;
        });

        mOptions.counterClock = setInterval(() => {
            if (mOptions.gameStarted && mOptions.activeCounter) {
                let $node = $('#elcpMainContainer-' + instance);
                let $content = $('#node-content');
                if (
                    !$node.length ||
                    ($content.length && $content.attr('mode') === 'edition')
                ) {
                    clearInterval(mOptions.counterClock);
                    return;
                }
                mOptions.counter--;
                $eXeEC.updateTime(mOptions.counter, instance);

                if (mOptions.counter <= 0) {
                    mOptions.activeCounter = false;
                    let timeShowSolution = 1000;
                    if (mOptions.showSolution) {
                        timeShowSolution = mOptions.timeShowSolution * 1000;
                        if (
                            !$eXeEC.sameQuestion(false, instance)
                        ) {
                            const currentQuestion =
                                mOptions.selectsGame[mOptions.activeQuestion];
                            if (currentQuestion && currentQuestion.typeSelect !== 2) {
                                $eXeEC.drawSolution(instance);
                            } else if (currentQuestion) {
                                $eXeEC.drawPhrase(
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
                        $eXeEC.newQuestion(instance);
                    }, timeShowSolution);
                    return;
                }
            }
        }, 1000);

        $eXeEC.updateTime(0, instance);
        $(`#elcpGamerOver-${instance}`).hide();
        $(`#elcpPHits-${instance}`).text(mOptions.hits);
        $(`#elcpPErrors-${instance}`).text(mOptions.errors);
        $(`#elcpPScore-${instance}`).text(mOptions.score);

        mOptions.gameStarted = true;
        $eXeEC.newQuestion(instance);
    },

    updateTime: function (tiempo, instance) {
        const mTime =
            $exeDevices.iDevice.gamification.helpers.getTimeToString(tiempo);
        $(`#elcpPTime-${instance}`).text(mTime);
    },

    gameOver: function (type, instance) {
        const mOptions = $eXeEC.options[instance];
        mOptions.gameStarted = false;
        mOptions.gameActived = false;
        clearInterval(mOptions.counterClock);

        // Hide circuit preview and cover
        $(`#elcpTikzPreview-${instance}`).empty().hide();
        $(
            `#elcpDivModeBoard-${instance}, #elcpCover-${instance}`
        ).hide();

        $exeDevices.iDevice.gamification.media.stopSound();

        const message =
            type === 0
                ? mOptions.msgs.msgAllQuestions
                : mOptions.msgs.msgLostLives;
        $eXeEC.showMessage(2, message, instance);
        $eXeEC.showScoreGame(type, instance);
        $eXeEC.clearQuestions(instance);
        $eXeEC.updateTime(0, instance);

        $(`#elcpPNumber-${instance}`).text('0');
        $(`#elcpStartGame-${instance}`).text(mOptions.msgs.msgNewGame);
        $(`#elcpGameContainer-${instance} .ELCP-StartGame`).show();
        $(
            `#elcpQuestionDiv-${instance}, #elcpAnswerDiv-${instance}, #elcpWordDiv-${instance}`
        ).hide();

        mOptions.gameOver = true;

        if (mOptions.isScorm === 1) {
            if (
                mOptions.repeatActivity ||
                $eXeEC.initialScore === ''
            ) {
                const score = (
                    (mOptions.scoreGame * 10) /
                    mOptions.scoreTotal
                ).toFixed(2);
                $eXeEC.sendScore(true, instance);
                $(`#elcpRepeatActivity-${instance}`).text(
                    `${mOptions.msgs.msgYouScore}: ${score}`
                );
                $eXeEC.initialScore = score;
            }
        }
        $eXeEC.saveEvaluation(instance);
        $eXeEC.showFeedBack(instance);

        clearInterval(mOptions.timeUpdateInterval);
        clearInterval(mOptions.timeUpdateIntervalIntro);
    },

    showFeedBack: function (instance) {
        const mOptions = $eXeEC.options[instance];
        let puntos = (mOptions.hits * 100) / mOptions.selectsGame.length;
        if (mOptions.gameMode === 2 || mOptions.feedBack) {
            if (puntos >= mOptions.percentajeFB) {
                $(`#elcpDivFeedBack-${instance}`)
                    .find('.electrical-circuits-feedback-game')
                    .show();
                $(`#elcpDivFeedBack-${instance}`).show();
            } else {
                $eXeEC.showMessage(
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
        const $phraseContainer = $(`#elcpEPhrase-${instance}`);
        $phraseContainer.find('.ELCP-Word').remove();

        $(
            `#elcpBtnReply-${instance}, #elcpBtnMoveOn-${instance}, #elcpEdAnswer-${instance}`
        ).prop('disabled', true);
        $(`#elcpQuestionDiv-${instance}`).hide();
        $(`#elcpWordDiv-${instance}`).show();
        $(`#elcpAnswerDiv-${instance}`).hide();

        if (!casesensitive) {
            phrase = phrase.toUpperCase();
        }

        const cPhrase = $eXeEC.clear(phrase),
            letterShow = $eXeEC.getShowLetter(cPhrase, nivel),
            h = cPhrase.replace(/\s/g, '&');
        let nPhrase = [];

        for (let z = 0; z < h.length; z++) {
            nPhrase.push(h[z] !== '&' && !letterShow.includes(z) ? ' ' : h[z]);
        }

        nPhrase = nPhrase.join('');
        const phraseArray = nPhrase.split('&');

        phraseArray.forEach((cleanWord) => {
            if (cleanWord !== '') {
                const $wordDiv = $('<div class="ELCP-Word"></div>').appendTo(
                    $phraseContainer
                );
                for (let char of cleanWord) {
                    let letterClass = 'blue';
                    if (type === 1) letterClass = 'red';
                    if (type === 2) letterClass = 'green';
                    $wordDiv.append(
                        `<div class="ELCP-Letter ${letterClass}">${char}</div>`
                    );
                }
            }
        });

        if (!solution) {
            $(`#elcpDefinition-${instance}`).html(definition);
        }

        const htmlContent = $(`#elcpWordDiv-${instance}`).html();
        if ($exeDevices.iDevice.gamification.math.hasLatex(htmlContent)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                `elcpWordDiv-${instance}`
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
        const mOptions = $eXeEC.options[instance],
            mQuestion = mOptions.selectsGame[i];

        $eXeEC.clearQuestions(instance);
        mOptions.gameActived = true;
        mOptions.question = mQuestion;
        mOptions.respuesta = '';

        const time = $exeDevices.iDevice.gamification.helpers.getTimeToString(
            $exeDevices.iDevice.gamification.helpers.getTimeSeconds(
                mQuestion.time
            )
        );
        $(`#elcpPTime-${instance}`).text(time);
        $(`#elcpQuestion-${instance}`).html(mQuestion.quextion);

        // Hide cover, show TikZ circuit if available
        $(`#elcpCover-${instance}`).show();
        $(`#elcpTikzPreview-${instance}`).empty().hide();

        $eXeEC.showMessage(0, '', instance);

        if (mOptions.answersRamdon) {
            $eXeEC.ramdonOptions(instance);
        }

        $(`#elcpPAuthor-${instance}`).text('');

        // Render TikZ circuit diagram for this question
        if (mQuestion.tikzCode && mQuestion.tikzCode.trim().length > 0) {
            $eXeEC.showTikzCircuit(mQuestion.tikzCode, instance);
        }

        $(`#elcpDivModeBoard-${instance}`).hide();

        if (mQuestion.typeSelect !== 2) {
            $eXeEC.drawQuestions(instance);
        } else {
            $eXeEC.drawPhrase(
                mQuestion.solutionQuestion,
                mQuestion.quextion,
                mQuestion.percentageShow,
                mQuestion.typeSelect,
                false,
                instance,
                false
            );
            $(
                `#elcpBtnReply-${instance}, #elcpBtnMoveOn-${instance}, #elcpEdAnswer-${instance}`
            ).prop('disabled', false);
            $(`#elcpEdAnswer-${instance}`).focus().val('');

            if (mOptions.modeBoard) {
                $(`#elcpDivModeBoard-${instance}`)
                    .css('display', 'flex')
                    .fadeIn();
            }
        }

        if (mOptions.isScorm === 1) {
            if (
                mOptions.repeatActivity ||
                $eXeEC.initialScore === ''
            ) {
                const score = (
                    (mOptions.scoreGame * 10) /
                    mOptions.scoreTotal
                ).toFixed(2);
                $eXeEC.sendScore(true, instance);
                $(`#elcpRepeatActivity-${instance}`).text(
                    `${mOptions.msgs.msgYouScore}: ${score}`
                );
            }
        }


        $eXeEC.saveEvaluation(instance);
    },

    updateLives: function (instance) {
        const mOptions = $eXeEC.options[instance];
        $(`#elcpPLifes-${instance}`).text(mOptions.livesLeft);
        const $livesIcons = $(`#elcpLifesGame-${instance}`).find(
            '.exeQuextIcons-Life'
        );

        if (mOptions.useLives) {
            $livesIcons.each((index, element) => {
                $(element).toggle(index < mOptions.livesLeft);
            });
        } else {
            $livesIcons.hide();
            $(`#elcpNumberLivesGame-${instance}`).hide();
        }
    },

    newQuestion: function (instance) {
        const mOptions = $eXeEC.options[instance];

        if (mOptions.useLives && mOptions.livesLeft <= 0) {
            $eXeEC.gameOver(1, instance);
            return;
        }

        const mActiveQuestion =
            $eXeEC.updateNumberQuestion(
                mOptions.activeQuestion,
                instance
            );

        if (mActiveQuestion === null || !mOptions.selectsGame[mActiveQuestion]) {
            $(`#elcpPNumber-${instance}`).text('0');
            $eXeEC.gameOver(0, instance);
        } else {
            mOptions.counter =
                $exeDevices.iDevice.gamification.helpers.getTimeSeconds(
                    mOptions.selectsGame[mActiveQuestion].time
                );
            $eXeEC.showQuestion(mActiveQuestion, instance);
            mOptions.activeCounter = true;
            const numQ = mOptions.numberQuestions - mActiveQuestion;
            $(`#elcpPNumber-${instance}`).text(numQ);
        }
    },

    updateNumberQuestion: function (numq, instance) {
        const mOptions = $eXeEC.options[instance];
        let numActiveQuestion = numq;

        numActiveQuestion++;
        if (numActiveQuestion >= mOptions.numberQuestions) {
            return null;
        }

        mOptions.activeQuestion = numActiveQuestion;
        return numActiveQuestion;
    },

    getRetroFeedMessages: function (iHit, instance) {
        const msgs = $eXeEC.options[instance].msgs,
            sMessages = iHit
                ? (msgs.msgSuccesses || 'Right! | Excellent! | Great! | Very good! | Perfect!')
                : (msgs.msgFailures || 'It was not that! | Incorrect! | Not correct! | Sorry! | Error!'),
            messagesArray = sMessages.split('|');
        return messagesArray[Math.floor(Math.random() * messagesArray.length)];
    },

    answerQuestion: function (instance) {
        const mOptions = $eXeEC.options[instance],
            question = mOptions.selectsGame[mOptions.activeQuestion];

        if (!mOptions.gameActived || !question) return;

        mOptions.gameActived = false;
        let correct = true,
            solution = question.solution,
            answer = mOptions.respuesta.toUpperCase();

        if (question.typeSelect === 2) {
            solution = question.solutionQuestion.toUpperCase();
            answer = $.trim(
                $(`#elcpEdAnswer-${instance}`).val()
            ).toUpperCase();
            if (answer.length === 0) {
                $eXeEC.showMessage(
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
                $eXeEC.showMessage(
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

        $eXeEC.updateScore(correct, instance);

        let timeShowSolution = mOptions.showSolution
            ? mOptions.timeShowSolution * 1000
            : 1000;
        const percentageHits = (mOptions.hits / mOptions.numberQuestions) * 100;

        $(`#elcpPHits-${instance}`).text(mOptions.hits);
        $(`#elcpPErrors-${instance}`).text(mOptions.errors);

        if (
            mOptions.itinerary.showClue &&
            percentageHits >= mOptions.itinerary.percentageClue &&
            !mOptions.obtainedClue
        ) {
            timeShowSolution = 5000;
            $(`#elcpShowClue-${instance}`)
                .text(
                    `${mOptions.msgs.msgInformation}: ${mOptions.itinerary.clueGame}`
                )
                .show();
            mOptions.obtainedClue = true;
        }

        if (
            mOptions.showSolution &&
            !$eXeEC.sameQuestion(correct, instance)
        ) {
            if (question.typeSelect !== 2) {
                $eXeEC.drawSolution(instance);
            } else {
                const mType = correct ? 2 : 1;
                $eXeEC.drawPhrase(
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
            $eXeEC.newQuestion(instance);
        }, timeShowSolution);
    },

    answerQuestionBoard: function (value, instance) {
        const mOptions = $eXeEC.options[instance],
            question = mOptions.selectsGame[mOptions.activeQuestion];

        if (!mOptions.gameActived || !question) return;

        mOptions.gameActived = false;
        mOptions.activeCounter = false;

        $eXeEC.updateScore(value, instance);

         let timeShowSolution = mOptions.showSolution
            ? mOptions.timeShowSolution * 1000
            : 1000;
        const percentageHits = (mOptions.hits / mOptions.numberQuestions) * 100;

        $(`#elcpPHits-${instance}`).text(mOptions.hits);
        $(`#elcpPErrors-${instance}`).text(mOptions.errors);

        if (
            mOptions.itinerary.showClue &&
            percentageHits >= mOptions.itinerary.percentageClue &&
            !mOptions.obtainedClue
        ) {
            timeShowSolution = 5000;
            $(`#elcpShowClue-${instance}`)
                .text(
                    `${mOptions.msgs.msgInformation}: ${mOptions.itinerary.clueGame}`
                )
                .show();
            mOptions.obtainedClue = true;
        }

        if (
            mOptions.showSolution &&
            !$eXeEC.sameQuestion(value, instance)
        ) {
            if (question.typeSelect !== 2) {
                $eXeEC.drawSolution(instance);
            } else {
                const mType = value ? 2 : 1;
                $eXeEC.drawPhrase(
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
            $eXeEC.newQuestion(instance);
        }, timeShowSolution);
    },

    sameQuestion: function (correct, instance) {
        const mOptions = $eXeEC.options[instance],
            q = mOptions.selectsGame[mOptions.activeQuestion];
        if (!q) return false;
        return (
            (correct && q.hits === mOptions.activeQuestion) ||
            (!correct && q.error === mOptions.activeQuestion)
        );
    },

    updateScore: function (correctAnswer, instance) {
        const mOptions = $eXeEC.options[instance],
            question = mOptions.selectsGame[mOptions.activeQuestion];

        if (!question) return;

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
                    $eXeEC.updateLives(instance);
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

        $(`#elcpPScore-${instance}`).text(sscore);
        $(`#elcpPHits-${instance}`).text(mOptions.hits);
        $(`#elcpPErrors-${instance}`).text(mOptions.errors);

        message = $eXeEC.getMessageAnswer(correctAnswer, points, instance);
        $eXeEC.showMessage(type, message, instance);
    },

    getMessageAnswer: function (correctAnswer, npts, instance) {
        const mse = $eXeEC.getMessageErrorAnswer(npts, instance);
        const msc = $eXeEC.getMessageCorrectAnswer(npts, instance);
        return correctAnswer ? msc : mse;
    },

    getMessageCorrectAnswer: function (npts, instance) {
        const mOptions = $eXeEC.options[instance],
            messageCorrect = $eXeEC.getRetroFeedMessages(true, instance),
            pts = mOptions.msgs.msgPoints || 'puntos';
        const message =
                mOptions.gameMode === 2
                    ? messageCorrect
                    : `${messageCorrect} ${npts} ${pts}`;

        return message;
    },

    getMessageErrorAnswer: function (npts, instance) {
        const mOptions = $eXeEC.options[instance],
            messageError = $eXeEC.getRetroFeedMessages(false, instance),
            pts = mOptions.msgs.msgPoints || 'puntos',
            question = mOptions.selectsGame[mOptions.activeQuestion];
        let message = '';

        message = mOptions.useLives
                ? `${messageError} ${mOptions.msgs.msgLoseLive}`
                : `${messageError} ${npts} ${pts}`;
            if (mOptions.gameMode > 0) {
                message = messageError;
            }

        return message;
    },

    showMessage: function (type, message, instance) {
        const colors = [
                '#555555',
                $eXeEC.borderColors.red,
                $eXeEC.borderColors.green,
                $eXeEC.borderColors.blue,
                $eXeEC.borderColors.yellow,
            ],
            mcolor = colors[type],
            weight = type === 0 ? 'normal' : 'normal';

        $(`#elcpPAuthor-${instance}`).html(message).css({
            color: mcolor,
            'font-weight': weight,
        });

        $exeDevices.iDevice.gamification.math.updateLatex(
            `#elcpPAuthor-${instance}`
        );
    },

    ramdonOptions: function (instance) {
        const mOptions = $eXeEC.options[instance],
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
        const mOptions = $eXeEC.options[instance],
            borderColors = [
                $eXeEC.borderColors.red,
                $eXeEC.borderColors.blue,
                $eXeEC.borderColors.green,
                $eXeEC.borderColors.yellow,
            ];

        $(`#elcpQuestionDiv-${instance}`).show();
        $(`#elcpWordDiv-${instance}`).hide();
        $(`#elcpAnswerDiv-${instance}`).show();

        $(`#elcpOptionsDiv-${instance} > .ELCP-Options`).each(
            function (index) {
                const option = mOptions.question.options[index];
                $(this)
                    .css({
                        'border-color': borderColors[index],
                        'background-color': 'transparent',
                        cursor: 'pointer',
                        color: $eXeEC.colors.black,
                    })
                    .html(option || '')
                    .toggle(!!option);
            }
        );

        const html = $(`#elcpQuestionDiv-${instance}`).html();
        if ($exeDevices.iDevice.gamification.math.hasLatex(html)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                `elcpQuestionDiv-${instance}`
            );
        }
    },

    drawSolution: function (instance) {
        const mOptions = $eXeEC.options[instance],
            question = mOptions.selectsGame[mOptions.activeQuestion];

        if (!question) return;

        const solution = question.solution,
            letters = 'ABCD';

        mOptions.gameActived = false;

        $(`#elcpOptionsDiv-${instance}`)
            .find('.ELCP-Options')
            .each(function (i) {
                let css = {
                    'border-color': $eXeEC.borderColors.incorrect,
                    'border-size': '1',
                    'background-color': 'transparent',
                    cursor: 'pointer',
                    color: $eXeEC.borderColors.grey,
                };

                if (question.typeSelect === 1) {
                    css = {
                        'border-color': $eXeEC.borderColors.correct,
                        'background-color': $eXeEC.colors.correct,
                        'border-size': '1',
                        cursor: 'pointer',
                        color: $eXeEC.borderColors.black,
                    };
                    const text = question.options[letters.indexOf(solution[i])];
                    $(this).text(text);
                } else if (solution.includes(letters[i])) {
                    css = {
                        'border-color': $eXeEC.borderColors.correct,
                        'background-color': $eXeEC.colors.correct,
                        'border-size': '1',
                        cursor: 'pointer',
                        color: $eXeEC.borderColors.black,
                    };
                }

                $(this).css(css);
            });
    },

    isContainerFullscreen: function (container) {
        if (!container) return false;
        const fsElement =
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement;
        if (!fsElement) return false;
        return fsElement === container || container.contains(fsElement);
    },

    updateFullscreenLayout: function (instance) {
        const container = document.getElementById(
            `elcpGameContainer-${instance}`
        );
        if (!container) return;
        const isFullscreen = $eXeEC.isContainerFullscreen(container);
        $(container).toggleClass('ELCP-IsFullscreen', isFullscreen);
    },

    clearQuestions: function (instance) {
        const mOptions = $eXeEC.options[instance];
        mOptions.respuesta = '';

        $(`#elcpAnswers-${instance} > .ELCP-AnswersOptions`).remove();

        const borderColors = [
            $eXeEC.borderColors.red,
            $eXeEC.borderColors.blue,
            $eXeEC.borderColors.green,
            $eXeEC.borderColors.yellow,
        ];

        $(`#elcpOptionsDiv-${instance} > .ELCP-Options`).each(
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
    $eXeEC.init();
});
