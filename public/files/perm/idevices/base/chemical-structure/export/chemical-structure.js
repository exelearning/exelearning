/* eslint-disable no-undef */
/**
 * Chemical Structure iDevice (export code)
 *
 * Questions are paired with interactive 2D chemical structures drawn with Ketcher.
 * Structures are stored as SVG and rendered inline — no external library required.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $eXeChemical = {
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
            'Chemical Structure',
            'chemical-structure',
            'cheme-IDevice'
        );
    },

    enable: function () {
        $eXeChemical.loadGame();
    },

    sendScore: function (auto, instance) {
        const mOptions = $eXeChemical.options[instance];

        mOptions.scorerp = $eXeChemical.getScoreRP(instance);
        mOptions.previousScore = $eXeChemical.previousScore;
        mOptions.userName = $eXeChemical.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $eXeChemical.previousScore = mOptions.previousScore;
    },

    getShowScoreRP: function (instance) {
        const mOptions = $eXeChemical.options[instance];
        const total = mOptions.selectsGame.length;
        return Math.min(((mOptions.visiteds + 1) * 10) / total, 10);
    },

    getScoreRP: function (instance) {
        const mOptions = $eXeChemical.options[instance];

        if (mOptions.activityMode === 'show') {
            return $eXeChemical.getShowScoreRP(instance);
        }

        if (mOptions.scoreTotal === 0) return 0;

        return (mOptions.scoreGame * 10) / mOptions.scoreTotal;
    },

    loadGame: function () {
        $eXeChemical.options = [];
        $eXeChemical.activities.each(function (i) {
            const dl = $('.cheme-DataGame', this);
            if (dl.length === 0) return;
            const version = $('.cheme-version', this).eq(0).text(),
                mOption = $eXeChemical.loadDataGame(dl, version),
                msg = mOption.msgs.msgPlayStart;

            mOption.scorerp = 0;
            mOption.idevicePath = $eXeChemical.idevicePath;
            mOption.main = 'chemepMainContainer-' + i;
            mOption.idevice = 'cheme-IDevice';

            $eXeChemical.options.push(mOption);
            const interfaceHtml = $eXeChemical.createInterface(i);
            dl.before(interfaceHtml).remove();

            $('#chemepGameMinimize-' + i).hide();
            $('#chemepGameContainer-' + i).hide();
            if (mOption.showMinimize) {
                $('#chemepGameMinimize-' + i)
                    .css({ cursor: 'pointer' })
                    .show();
            } else {
                $('#chemepGameContainer-' + i).show();
            }
            $('#chemepMessageMaximize-' + i).text(msg);
            $('#chemepDivFeedBack-' + i).prepend(
                $('.cheme-feedback-game', this)
            );

            $('#chemepDivFeedBack-' + i).hide();
            $('#chemepMainContainer-' + i).show();

            $eXeChemical.addEvents(i);
        });

        let node = document.querySelector('.page-content');
        if (this.isInExe) {
            node = document.getElementById('node-content');
        }
        if (node)
            $exeDevices.iDevice.gamification.observers.observeResize(
                $eXeChemical,
                node
            );

        $exeDevices.iDevice.gamification.math.updateLatex(
            '.cheme-IDevice'
        );
    },

    createInterface: function (instance) {
        const path = $eXeChemical.idevicePath,
            msgs = $eXeChemical.options[instance].msgs,
            mOptions = $eXeChemical.options[instance],
            html = `
        <div class="CHEMP-MainContainer" id="chemepMainContainer-${instance}">
            <div class="CHEMP-GameMinimize" id="chemepGameMinimize-${instance}">
                <a href="#" role="button" class="CHEMP-LinkMaximize" id="chemepLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                    <img src="${path}chemepIcon.svg" class="CHEMP-IconMinimize CHEMP-Activo" alt="">
                    <div class="CHEMP-MessageMaximize" id="chemepMessageMaximize-${instance}"></div>
                </a>
            </div>
            <div class="CHEMP-GameContainer" id="chemepGameContainer-${instance}">
                <div class="CHEMP-GameScoreBoard">
                    <div class="CHEMP-GameScores">
                        <div class="exeQuextIcons exeQuextIcons-Number" title="${msgs.msgNumQuestions}"></div>
                        <p><span class="sr-av">${msgs.msgNumQuestions}: </span><span id="chemepPNumber-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                        <p><span class="sr-av">${msgs.msgHits}: </span><span id="chemepPHits-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Error" title="${msgs.msgErrors}"></div>
                        <p><span class="sr-av">${msgs.msgErrors}: </span><span id="chemepPErrors-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Score" title="${msgs.msgScore}"></div>
                        <p><span class="sr-av">${msgs.msgScore}: </span><span id="chemepPScore-${instance}">0</span></p>
                    </div>
                    <div class="CHEMP-LifesGame" id="chemepLifesGame-${instance}">
                        ${$eXeChemical.createLives(msgs)}
                    </div>
                    <div class="CHEMP-NumberLifesGame" id="chemepNumberLivesGame-${instance}">
                        <strong class="sr-av">${msgs.msgLive}:</strong>
                        <div class="exeQuextIcons exeQuextIcons-Life"></div>
                        <p id="chemepPLifes-${instance}">0</p>
                    </div>
                    <div class="CHEMP-TimeNumber">
                        <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                        <div class="exeQuextIcons exeQuextIcons-Time" title="${msgs.msgTime}"></div>
                        <p id="chemepPTime-${instance}" class="CHEMP-PTime">00:00</p>
                        <a href="#" role="button" class="CHEMP-LinkMinimize" id="chemepLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                            <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Minimize CHEMP-Activo"></div>
                        </a>
                        <a href="#" role="button" class="CHEMP-LinkFullScreen" id="chemepLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                            <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-FullScreen CHEMP-Activo" id="chemepFullScreen-${instance}"></div>
                        </a>
                    </div>
                </div>
                <div class="CHEMP-ShowClue" id="chemepShowClue-${instance}">
                    <div class="sr-av">${msgs.msgClue}:</div>
                    <p class="CHEMP-PShowClue CHEMP-parpadea" id="chemepPShowClue-${instance}"></p>
                </div>
                <div class="CHEMP-StructureArea" id="chemepStructureArea-${instance}">
                    <img src="${path}chemepHome.svg" class="CHEMP-Cover" id="chemepCover-${instance}" alt="${msgs.msgNoImage}" />
                    <div class="CHEMP-StructureCanvas" id="chemepStructureCanvas-${instance}" role="img" aria-label="${msgs.msgNoImage}"></div>
                    <div class="CHEMP-GameOver" id="chemepGameOver-${instance}">
                        <div class="CHEMP-DataImage">
                            <img src="${path}exequextwon.png" class="CHEMP-HistGGame" id="chemepHistGame-${instance}" alt="${msgs.msgAllQuestions}" />
                            <img src="${path}exequextlost.png" class="CHEMP-LostGGame" id="chemepLostGame-${instance}" alt="${msgs.msgLostLives}" />
                        </div>
                        <div class="CHEMP-DataScore">
                            <p id="chemepOverScore-${instance}">Score: 0</p>
                            <p id="chemepOverHits-${instance}">Hits 0</p>
                            <p id="chemepOverErrors-${instance}">Errors: 0</p>
                        </div>
                    </div>
                </div>
                <div class="CHEMP-ShowFullScreenRow" id="chemepShowFullScreenRow-${instance}">
                    <a href="#" role="button" class="CHEMP-ShowFullScreenBtn" id="chemepShowFullScreen-${instance}" title="${msgs.msgFullScreen}">
                        <div class="exeQuextIcons exeQuextIcons-FullScreen" aria-hidden="true"></div>
                        <span class="sr-av">${msgs.msgFullScreen}</span>
                    </a>
                </div>
                <div class="CHEMP-Description" id="chemepDescription-${instance}" style="display:none"></div>
                <div class="CHEMP-ShowNavigation" id="chemepShowNavigation-${instance}">
                    <a href="#" role="button" class="CHEMP-ShowNavBtn" id="chemepShowPrev-${instance}" title="${msgs.msgPrevious || ''}">
                        <img src="${path}bfafprevious.png" class="CHEMP-ShowNavImg" alt="${msgs.msgPrevious || ''}" />
                    </a>
                    <span class="CHEMP-ShowCounter" id="chemepShowCounter-${instance}">1 / 1</span>
                    <a href="#" role="button" class="CHEMP-ShowNavBtn" id="chemepShowNext-${instance}" title="${msgs.msgNext || ''}">
                        <img src="${path}bfafnext.png" class="CHEMP-ShowNavImg" alt="${msgs.msgNext || ''}" />
                    </a>
                </div>
                <div class="CHEMP-AuthorLicence" id="chemepAuthorLicence-${instance}">
                    <div class="sr-av">${msgs.msgAuthor}:</div>
                    <p id="chemepPAuthor-${instance}"></p>
                </div>
                <div class="sr-av" id="chemepStartGameSRAV-${instance}">${msgs.msgPlayStart}:</div>
                <div class="CHEMP-StartGame"><a href="#" role="button" id="chemepStartGame-${instance}"></a></div>
                <div class="CHEMP-QuestionDiv" id="chemepQuestionDiv-${instance}">
                    <div class="sr-av">${msgs.msgQuestion}:</div>
                    <div class="CHEMP-Question" id="chemepQuestion-${instance}"></div>
                    <div class="CHEMP-OptionsDiv" id="chemepOptionsDiv-${instance}">
                        ${$eXeChemical.createOptions(msgs, instance)}
                    </div>
                </div>
                <div class="CHEMP-WordsDiv" id="chemepWordDiv-${instance}">
                    <div class="sr-av">${msgs.msgAnswer}:</div>
                    <div class="CHEMP-Phrase" id="chemepEPhrase-${instance}"></div>
                    <div class="sr-av">${msgs.msgQuestion}:</div>
                    <div class="CHEMP-Definition" id="chemepDefinition-${instance}"></div>
                    <div class="CHEMP-DivReply" id="chemepDivResponder-${instance}">
                        <input type="text" value="" class="CHEMP-EdReply form-control" id="chemepEdAnswer-${instance}" autocomplete="off">
                        <a href="#" role="button" id="chemepBtnReply-${instance}" title="${msgs.msgAnswer}">
                            <strong class="sr-av">${msgs.msgAnswer}</strong>
                            <div class="exeQuextIcons-Submit CHEMP-Activo"></div>
                        </a>
                    </div>
                </div>
                <div class="CHEMP-BottonContainerDiv" id="chemepBottonContainer-${instance}">
                    <div class="CHEMP-AnswersDiv" id="chemepAnswerDiv-${instance}">
                        <div class="CHEMP-Answers" id="chemepAnswers-${instance}"></div>
                        <a href="#" role="button" id="chemepButtonAnswer-${instance}" title="${msgs.msgAnswer}">
                            <strong class="sr-av">${msgs.msgAnswer}</strong>
                            <div class="exeQuextIcons-Submit CHEMP-Activo"></div>
                        </a>
                    </div>
                </div>
                <div class="CHEMP-DivFeedBack" id="chemepDivFeedBack-${instance}">
                    <input type="button" id="chemepFeedBackClose-${instance}" value="${msgs.msgClose}" class="feedbackbutton" />
                </div>
                <div class="CHEMP-DivModeBoard" id="chemepDivModeBoard-${instance}">
                    <a class="CHEMP-ModeBoard" href="#" role="button" id="chemepModeBoardOK-${instance}" title="${msgs.msgCorrect}">${msgs.msgCorrect}</a>
                    <a class="CHEMP-ModeBoard" href="#" role="button" id="chemepModeBoardMoveOn-${instance}" title="${msgs.msgMoveOne}">${msgs.msgMoveOne}</a>
                    <a class="CHEMP-ModeBoard" href="#" role="button" id="chemepModeBoardKO-${instance}" title="${msgs.msgIncorrect}">${msgs.msgIncorrect}</a>
                </div>
            </div>
            <div class="CHEMP-Cubierta" id="chemepCubierta-${instance}" style="display:none">
                <div class="CHEMP-CodeAccessDiv" id="chemepCodeAccessDiv-${instance}">
                    <p class="CHEMP-MessageCodeAccessE" id="chemepMesajeAccesCodeE-${instance}"></p>
                    <div class="CHEMP-DataCodeAccessE">
                        <label for="chemepCodeAccessE-${instance}" class="sr-av">${msgs.msgCodeAccess}:</label>
                        <input type="text" class="CHEMP-CodeAccessE form-control" id="chemepCodeAccessE-${instance}" placeholder="${msgs.msgCodeAccess}">
                        <a href="#" role="button" id="chemepCodeAccessButton-${instance}" title="${msgs.msgSubmit}">
                            <strong class="sr-av">${msgs.msgSubmit}</strong>
                            <div class="exeQuextIcons exeQuextIcons-Submit CHEMP-Activo"></div>
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
        return [...Array(5)]
            .map(
                () => `
                    <strong class="sr-av">${msgs.msgLive}:</strong>
                    <div class="exeQuextIcons exeQuextIcons-Life" title="${msgs.msgLive}"></div>
                `
            )
            .join('');
    },

    createOptions: function (msgs, instance) {
        return ['A', 'B', 'C', 'D']
            .map(
                (option, index) => `
            <a href="#" role="button" class="CHEMP-Option${index + 1} CHEMP-Options" id="chemepOption${index + 1}-${instance}" data-number="${index}" aria-label="${msgs.msgOption} ${option}"></a>
        `
            )
            .join('');
    },

    showCubiertaOptions: function (mode, instance) {
        if (mode === false) {
            $('#chemepCubierta-' + instance).fadeOut();
            return;
        }
        $('#chemepCubierta-' + instance).fadeIn();
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
            typeof mOptions.percentajeQuestions !== 'undefined'
                ? mOptions.percentajeQuestions
                : 100;
        mOptions.modeBoard =
            typeof mOptions.modeBoard === 'undefined'
                ? false
                : mOptions.modeBoard;

        for (let i = 0; i < mOptions.selectsGame.length; i++) {
            const q = mOptions.selectsGame[i];
            q.hit = typeof q.hit === 'undefined' ? 0 : q.hit;
            q.error = typeof q.error === 'undefined' ? 0 : q.error;
            q.msgHit = typeof q.msgHit === 'undefined' ? '' : q.msgHit;
            q.msgError = typeof q.msgError === 'undefined' ? '' : q.msgError;
            q.ket = typeof q.ket === 'undefined' ? '' : q.ket;
            q.svg = typeof q.svg === 'undefined' ? '' : q.svg;
            q.smiles = typeof q.smiles === 'undefined' ? '' : q.smiles;
            q.molfile = typeof q.molfile === 'undefined' ? '' : q.molfile;
            q.rxn = typeof q.rxn === 'undefined' ? '' : q.rxn;
            q.structureType = typeof q.structureType === 'undefined' ? 'molecule' : q.structureType;
            q.description = typeof q.description === 'undefined' ? '' : q.description;
        }

        mOptions.scoreGame = 0;
        mOptions.scoreTotal = 0;
        mOptions.gameMode =
            typeof mOptions.gameMode !== 'undefined' ? mOptions.gameMode : 1;
        mOptions.percentajeFB =
            typeof mOptions.percentajeFB !== 'undefined'
                ? mOptions.percentajeFB
                : 100;
        mOptions.useLives = mOptions.gameMode !== 0 ? false : mOptions.useLives;
        mOptions.gameOver = false;
        mOptions.evaluation =
            typeof mOptions.evaluation === 'undefined'
                ? false
                : mOptions.evaluation;
        mOptions.evaluationID =
            typeof mOptions.evaluationID === 'undefined'
                ? ''
                : mOptions.evaluationID;
        mOptions.id = typeof mOptions.id === 'undefined' ? false : mOptions.id;
        mOptions.activityMode =
            typeof mOptions.activityMode === 'undefined'
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
        $(window).off('unload.exeCS beforeunload.exeCS');
        $(document).off(`fullscreenchange.chemp${instance}`);
        $(document).off(`webkitfullscreenchange.chemp${instance}`);
        $(document).off(`mozfullscreenchange.chemp${instance}`);
        $(document).off(`MSFullscreenChange.chemp${instance}`);
        $(`#chemepLinkMaximize-${instance}`).off('click');
        $(`#chemepLinkMinimize-${instance}`).off('click');
        $('#chemepMainContainer-' + instance)
            .closest('.idevice_node')
            .off('click', '.Games-SendScore');
        $(`#chemepCodeAccessButton-${instance}`).off('click');
        $(`#chemepCodeAccessE-${instance}`).off('keydown');
        $(`#chemepBtnMoveOn-${instance}`).off('click');
        $(`#chemepBtnReply-${instance}`).off('click');
        $(`#chemepEdAnswer-${instance}`).off('keydown');
        $(`#chemepOptionsDiv-${instance}`)
            .find('.CHEMP-Options')
            .off('click');
        $(`#chemepLinkFullScreen-${instance}`).off('click');
        $(`#chemepButtonAnswer-${instance}`).off('click');
        $(`#chemepStartGame-${instance}`).off('click');
        $(`#chemepFeedBackClose-${instance}`).off('click');
        $(`#chemepModeBoardOK-${instance}`).off('click');
        $(`#chemepModeBoardKO-${instance}`).off('click');
        $(`#chemepModeBoardMoveOn-${instance}`).off('click');
        $(`#chemepShowPrev-${instance}`).off('click');
        $(`#chemepShowNext-${instance}`).off('click');
        $(`#chemepShowFullScreen-${instance}`).off('click');
    },

    addEvents: function (instance) {
        const mOptions = $eXeChemical.options[instance];

        mOptions.respuesta = '';

        $eXeChemical.removeEvents(instance);
        $(window).on('unload.exeCS beforeunload.exeCS', () => {
            $exeDevices.iDevice.gamification.scorm.endScorm(
                $eXeChemical.mScorm
            );
        });

        $(`#chemepGameOver-${instance}`).css('display', 'flex');

        $(`#chemepLinkMaximize-${instance}`).on('click', (e) => {
            e.preventDefault();
            $(`#chemepGameContainer-${instance}`).show();
            $(`#chemepGameMinimize-${instance}`).hide();
        });

        $(`#chemepLinkMinimize-${instance}`).on('click', (e) => {
            e.preventDefault();
            $(`#chemepGameContainer-${instance}`).hide();
            $(`#chemepGameMinimize-${instance}`)
                .css('visibility', 'visible')
                .show();
            return true;
        });

        $('#chemepMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $eXeChemical.sendScore(false, instance);
                $eXeChemical.saveEvaluation(instance);
                return true;
            });

        $(
            `#chemepGameOver-${instance}, #chemepCodeAccessDiv-${instance}, #chemepAnswerDiv-${instance}`
        ).hide();

        $(`#chemepShowFullScreenRow-${instance}`).hide();
        $(`#chemepCover-${instance}`).show();
        $(`#chemepStructureCanvas-${instance}`).hide();

        $(`#chemepCodeAccessButton-${instance}`).on('click', (e) => {
            e.preventDefault();
            $eXeChemical.enterCodeAccess(instance);
        });

        $(`#chemepCodeAccessE-${instance}`).on('keydown', (event) => {
            if (event.which === 13 || event.keyCode === 13) {
                $eXeChemical.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        $(`#chemepBtnMoveOn-${instance}`).on('click', (e) => {
            e.preventDefault();
            $eXeChemical.newQuestion(instance);
        });

        $(`#chemepBtnReply-${instance}`).on('click', (e) => {
            e.preventDefault();
            $eXeChemical.answerQuestion(instance);
        });

        $(`#chemepEdAnswer-${instance}`).on('keydown', (event) => {
            if (event.which === 13 || event.keyCode === 13) {
                $eXeChemical.answerQuestion(instance);
                return false;
            }
            return true;
        });

        const fullscreenHandler = () => {
            $eXeChemical.updateFullscreenLayout(instance);
        };
        mOptions.fullscreenHandler = fullscreenHandler;
        $(document).on(`fullscreenchange.chemp${instance}`, fullscreenHandler);
        $(document).on(`webkitfullscreenchange.chemp${instance}`, fullscreenHandler);
        $(document).on(`mozfullscreenchange.chemp${instance}`, fullscreenHandler);
        $(document).on(`MSFullscreenChange.chemp${instance}`, fullscreenHandler);

        $eXeChemical.updateFullscreenLayout(instance);

        mOptions.livesLeft = mOptions.numberLives;

        $(`#chemepOptionsDiv-${instance}`)
            .find('.CHEMP-Options')
            .on('click', function (e) {
                e.preventDefault();
                $eXeChemical.changeQuextion(instance, this);
            });

        $(`#chemepLinkFullScreen-${instance}`).on('click', (e) => {
            e.preventDefault();
            const element = document.getElementById(
                `chemepGameContainer-${instance}`
            );
            $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                element
            );
        });

        $(`#chemepShowFullScreen-${instance}`).on('click', (e) => {
            e.preventDefault();
            const element = document.getElementById(
                `chemepGameContainer-${instance}`
            );
            $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                element
            );
        });

        $eXeChemical.updateLives(instance);
        $(`#chemepPNumber-${instance}`).text(mOptions.numberQuestions);
        $(`#chemepGameContainer-${instance} .CHEMP-StartGame`).show();
        $(`#chemepQuestionDiv-${instance}`).hide();
        $(`#chemepBottonContainer-${instance}`).addClass(
            'CHEMP-BottonContainerDivEnd'
        );

        if (mOptions.itinerary.showCodeAccess) {
            $(`#chemepAnswerDiv-${instance}`).hide();
            $(`#chemepMesajeAccesCodeE-${instance}`).text(
                mOptions.itinerary.messageCodeAccess
            );
            $(`#chemepCodeAccessDiv-${instance}`).show();
            $(`#chemepGameContainer-${instance} .CHEMP-StartGame`).hide();
            $eXeChemical.showCubiertaOptions(true, instance);
        }

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        document.title = mOptions.title;
        $('meta[name=author]').attr('content', mOptions.author);
        $(`#chemepShowClue-${instance}`).hide();
        mOptions.gameOver = false;

        $(`#chemepButtonAnswer-${instance}`).on('click', (e) => {
            e.preventDefault();
            $eXeChemical.answerQuestion(instance);
        });

        $(`#chemepStartGame-${instance}`)
            .text(mOptions.msgs.msgPlayStart)
            .on('click', (e) => {
                e.preventDefault();
                $eXeChemical.startGame(instance);
            });

        $(`#chemepFeedBackClose-${instance}`).on('click', () => {
            $(`#chemepDivFeedBack-${instance}`).hide();
        });

        if (mOptions.gameMode === 2) {
            const $gameContainer = $(`#chemepGameContainer-${instance}`);
            $gameContainer
                .find(
                    '.exeQuextIcons-Hit, .exeQuextIcons-Error, .exeQuextIcons-Score'
                )
                .hide();
            $(
                `#chemepPErrors-${instance}, #chemepPHits-${instance}, #chemepPScore-${instance}`
            ).hide();
        }

        $(`#chemepWordDiv-${instance}`).hide();

        $(`#chemepModeBoardOK-${instance}`).on('click', (e) => {
            e.preventDefault();
            $eXeChemical.answerQuestionBoard(true, instance);
        });

        $(`#chemepModeBoardKO-${instance}`).on('click', (e) => {
            e.preventDefault();
            $eXeChemical.answerQuestionBoard(false, instance);
        });

        $(`#chemepModeBoardMoveOn-${instance}`).on('click', (e) => {
            e.preventDefault();
            $eXeChemical.newQuestion(instance);
        });

        setTimeout(() => {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                this.isInExe
            );
        }, 500);

        if (mOptions.activityMode === 'show') {
            $eXeChemical.initShowMode(instance);
        }
    },

    initShowMode: function (instance) {
        const mOptions = $eXeChemical.options[instance];
        const $gameContainer = $(`#chemepGameContainer-${instance}`);
        $gameContainer.addClass('CHEMP-ShowMode');

        $gameContainer.find('.CHEMP-GameScoreBoard').hide();
        $(`#chemepGameContainer-${instance} .CHEMP-StartGame`).hide();
        $(`#chemepStartGameSRAV-${instance}`).hide();
        $(`#chemepQuestionDiv-${instance}`).hide();
        $(`#chemepOptionsDiv-${instance}`).hide();
        $(`#chemepBottonContainer-${instance}`).hide();
        $(`#chemepWordDiv-${instance}`).hide();
        $(`#chemepDivFeedBack-${instance}`).hide();
        $(`#chemepDivModeBoard-${instance}`).hide();
        $(`#chemepGameOver-${instance}`).hide();
        $(`#chemepShowClue-${instance}`).hide();
        $(`#chemepAuthorLicence-${instance}`).hide();
        $(`#chemepAnswerDiv-${instance}`).hide();

        $(`#chemepShowNavigation-${instance}`)
            .insertBefore(`#chemepStructureArea-${instance}`)
            .css('display', 'flex');
        $(`#chemepShowFullScreenRow-${instance}`)
            .insertBefore(`#chemepShowNavigation-${instance}`)
            .css('display', 'flex');
        $(`#chemepShowClue-${instance}`).insertAfter(`#chemepShowFullScreenRow-${instance}`);

        mOptions.showCurrentIndex = 0;
        mOptions.visiteds = 0;
        mOptions.maxVisitedIndex = 0;
        mOptions.gameStarted = true;
        mOptions.feedbackShown = false;
        mOptions.obtainedClue = false;

        $eXeChemical.showStructureAtIndex(0, instance);

        const previous = parseFloat($eXeChemical.previousScore) || 0;
        const minScore = (1 * 10) / mOptions.selectsGame.length;
        if (previous > 0 && previous < minScore) {
            mOptions.scorerp = minScore;
            if (mOptions.isScorm > 0) {
                $eXeChemical.sendScore(true, instance);
            }
            $eXeChemical.saveEvaluation(instance);
        }

        $(`#chemepShowPrev-${instance}`).on('click', (e) => {
            e.preventDefault();
            if (mOptions.showCurrentIndex > 0) {
                mOptions.showCurrentIndex--;
                $eXeChemical.showStructureAtIndex(mOptions.showCurrentIndex, instance);
            }
        });

        $(`#chemepShowNext-${instance}`).on('click', (e) => {
            e.preventDefault();
            if (mOptions.showCurrentIndex < mOptions.selectsGame.length - 1) {
                mOptions.showCurrentIndex++;
                if (mOptions.showCurrentIndex > mOptions.maxVisitedIndex) {
                    mOptions.maxVisitedIndex = mOptions.showCurrentIndex;
                    mOptions.visiteds++;
                }
                if (
                    mOptions.itinerary.showClue &&
                    !mOptions.obtainedClue &&
                    (mOptions.visiteds / mOptions.selectsGame.length) * 100 >= mOptions.itinerary.percentageClue
                ) {
                    $(`#chemepShowClue-${instance}`)
                        .text(`${mOptions.msgs.msgInformation}: ${mOptions.itinerary.clueGame}`)
                        .show();
                    mOptions.obtainedClue = true;
                }
                if (mOptions.feedBack && !mOptions.feedbackShown) {
                    const visitedPct = (mOptions.visiteds / mOptions.selectsGame.length) * 100;
                    if (visitedPct >= mOptions.percentajeFB) {
                        mOptions.feedbackShown = true;
                        $(`#chemepDivFeedBack-${instance}`)
                            .find('.cheme-feedback-game')
                            .show();
                        $(`#chemepDivFeedBack-${instance}`).show();
                    }
                }
                $eXeChemical.showStructureAtIndex(mOptions.showCurrentIndex, instance);
                if (mOptions.isScorm > 0) {
                    $eXeChemical.sendScore(true, instance);
                }
                $eXeChemical.saveEvaluation(instance);
            }
        });
    },

    showStructureAtIndex: function (index, instance) {
        const mOptions = $eXeChemical.options[instance],
            total = mOptions.selectsGame.length,
            question = mOptions.selectsGame[index],
            path = $eXeChemical.idevicePath;

        $(`#chemepShowCounter-${instance}`).text((index + 1) + ' / ' + total);

        const $prev = $(`#chemepShowPrev-${instance} img`);
        const $next = $(`#chemepShowNext-${instance} img`);
        $prev.attr('src', index === 0 ? path + 'bfafpreviousd.png' : path + 'bfafprevious.png');
        $next.attr('src', index >= total - 1 ? path + 'bfafnextd.png' : path + 'bfafnext.png');

        $eXeChemical.renderStructure(question, instance);

        const description = (question.description || '').trim();
        const $desc = $(`#chemepDescription-${instance}`);
        if (description.length > 0) {
            $desc.html(description).css('order', 22).show();
            $exeDevices.iDevice.gamification.math.updateLatex(
                `#chemepDescription-${instance}`
            );
        } else {
            $desc.html('').hide();
        }
    },

    saveEvaluation: function (instance) {
        const mOptions = $eXeChemical.options[instance];
        mOptions.scorerp = $eXeChemical.getScoreRP(instance);

        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $eXeChemical.isInExe
        );
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
            `chemepGameContainer-${instance}`
        );
        if (!container) return;
        const isFullscreen = $eXeChemical.isContainerFullscreen(container);
        $(container).toggleClass('CHEMP-IsFullscreen', isFullscreen);
    },

    sanitizeSvg: function (svg) {
        if (!svg) return '';
        // Remove script elements
        svg = svg.replace(/<script[\s\S]*?<\/script>/gi, '');
        // Remove foreignObject elements (can inject arbitrary HTML)
        svg = svg.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
        // Remove inline event handlers (on*)
        svg = svg.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');
        // Replace javascript: URIs in href and xlink:href
        svg = svg.replace(/(href\s*=\s*")javascript:[^"]*"/gi, '$1#"');
        svg = svg.replace(/(href\s*=\s*')javascript:[^']*'/gi, "$1#'");
        svg = svg.replace(/(xlink:href\s*=\s*")javascript:[^"]*"/gi, '$1#"');
        svg = svg.replace(/(xlink:href\s*=\s*')javascript:[^']*'/gi, "$1#'");
        // Replace data: URIs that could contain executable content
        svg = svg.replace(/(href\s*=\s*")data:text\/html[^"]*"/gi, '$1#"');
        svg = svg.replace(/(href\s*=\s*')data:text\/html[^']*'/gi, "$1#'");
        svg = svg.replace(/(xlink:href\s*=\s*")data:text\/html[^"]*"/gi, '$1#"');
        svg = svg.replace(/(xlink:href\s*=\s*')data:text\/html[^']*'/gi, "$1#'");

        // Remove inline background style from root SVG so exported molecule can be transparent.
        svg = svg.replace(
            /<svg\b([^>]*)\sstyle=(["'])([\s\S]*?)\2([^>]*)>/i,
            function (match, pre, quote, styleValue, post) {
                var cleanedStyle = (styleValue || '')
                    .replace(/\s*background(?:-color)?\s*:\s*[^;"]+;?/gi, '')
                    .replace(/\s*;\s*/g, ';')
                    .replace(/^\s*;\s*|\s*;\s*$/g, '')
                    .trim();

                if (!cleanedStyle) {
                    return '<svg' + pre + post + '>';
                }

                return '<svg' + pre + ' style=' + quote + cleanedStyle + quote + post + '>';
            },
        );

        // Remove likely "canvas background" rects generated by chemical editors.
        svg = svg.replace(/<rect\b[^>]*(?:\/>|>[\s\S]*?<\/rect>)/gi, function (rectMarkup) {
            var openTagMatch = rectMarkup.match(/^<rect\b[^>]*>/i);
            if (!openTagMatch) return rectMarkup;

            var openTag = openTagMatch[0];
            var getAttr = function (tag, name) {
                var attrMatch = tag.match(new RegExp('\\b' + name + '\\s*=\\s*([\'"])(.*?)\\1', 'i'));
                return attrMatch ? (attrMatch[2] || '').trim() : '';
            };
            var normalize = function (value) {
                return (value || '').replace(/\s+/g, '').toLowerCase();
            };

            var fill = normalize(getAttr(openTag, 'fill'));
            var stroke = normalize(getAttr(openTag, 'stroke'));
            var width = normalize(getAttr(openTag, 'width'));
            var height = normalize(getAttr(openTag, 'height'));
            var x = normalize(getAttr(openTag, 'x') || '0');
            var y = normalize(getAttr(openTag, 'y') || '0');
            var idOrClass = normalize((getAttr(openTag, 'id') + ' ' + getAttr(openTag, 'class')).trim());

            var whiteFill = [
                '#fff',
                '#ffffff',
                'white',
                'rgb(255,255,255)',
                'rgba(255,255,255,1)',
            ].includes(fill);
            var noStroke = stroke === '' || stroke === 'none' || stroke === 'transparent' || stroke === 'rgba(0,0,0,0)';
            var fullSize = width === '100%' || height === '100%';
            var anchoredTopLeft = (x === '0' || x === '0px' || x === '0%')
                && (y === '0' || y === '0px' || y === '0%');
            var looksLikeBackground = idOrClass.includes('background') || idOrClass.includes('ketcher_bg');

            if (whiteFill && (looksLikeBackground || fullSize || (anchoredTopLeft && noStroke))) {
                return '';
            }

            return rectMarkup;
        });
        return svg;
    },

    renderStructure: function (question, instance) {
        const $canvas = $(`#chemepStructureCanvas-${instance}`);
        const $cover = $(`#chemepCover-${instance}`);
        const msgs = $eXeChemical.options[instance].msgs;

        const svg = (question.svg || '').trim();

        if (!svg) {
            $canvas.hide().empty();
            $canvas.attr('aria-label', msgs.msgNoImage || '');
            $cover.show();
            return;
        }

        const sanitized = $eXeChemical.sanitizeSvg(svg);
        $canvas.html(sanitized).show();
        $canvas.attr('aria-label', (question.smiles || question.structureType || '').trim() || msgs.msgTypeGame || '');
        $cover.hide();
    },

    enterCodeAccess: function (instance) {
        const mOptions = $eXeChemical.options[instance],
            codeEntered = $(`#chemepCodeAccessE-${instance}`)
                .val()
                .toLowerCase(),
            correctCode = mOptions.itinerary.codeAccess.toLowerCase();

        if (codeEntered === correctCode) {
            $eXeChemical.showCubiertaOptions(false, instance);
            $eXeChemical.startGame(instance);
            $(`#chemepLinkMaximize-${instance}`).trigger('click');
        } else {
            $(`#chemepMesajeAccesCodeE-${instance}`)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $(`#chemepCodeAccessE-${instance}`).val('');
        }
    },

    showFeedBack: function (instance) {
        const mOptions = $eXeChemical.options[instance];
        const puntos = (mOptions.hits * 100) / mOptions.numberQuestions;
        if (mOptions.gameMode === 2 || mOptions.feedBack) {
            if (puntos >= mOptions.percentajeFB) {
                $(`#chemepDivFeedBack-${instance}`)
                    .find('.cheme-feedback-game')
                    .show();
                $(`#chemepDivFeedBack-${instance}`).show();
            } else {
                $eXeChemical.showMessage(
                    1,
                    mOptions.msgs.msgTryAgain.replace('%s', mOptions.percentajeFB),
                    instance
                );
            }
        }
    },

    showScoreGame: function (type, instance) {
        const mOptions = $eXeChemical.options[instance],
            msgs = mOptions.msgs,
            $histGame = $(`#chemepHistGame-${instance}`),
            $lostGame = $(`#chemepLostGame-${instance}`),
            $overPoint = $(`#chemepOverScore-${instance}`),
            $overHits = $(`#chemepOverHits-${instance}`),
            $overErrors = $(`#chemepOverErrors-${instance}`),
            $showClue = $(`#chemepShowClue-${instance}`),
            $gamerOver = $(`#chemepGameOver-${instance}`);

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
                            .text(`${msgs.msgInformation}: ${mOptions.itinerary.clueGame}`)
                            .show();
                    } else {
                        $showClue
                            .text(msgs.msgTryAgain.replace('%s', mOptions.itinerary.percentageClue))
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
                            .text(`${msgs.msgInformation}: ${mOptions.itinerary.clueGame}`)
                            .show();
                    } else {
                        $showClue
                            .text(msgs.msgTryAgain.replace('%s', mOptions.itinerary.percentageClue))
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

        $eXeChemical.showMessage(messageColor, message, instance);

        const scoreText =
            mOptions.gameMode === 0
                ? `${msgs.msgScore}: ${mOptions.score}`
                : `${msgs.msgScore}: ${mOptions.score.toFixed(2)}`;

        $overPoint.html(scoreText);
        $overHits.html(`${msgs.msgHits}: ${mOptions.hits}`);
        $overErrors.html(`${msgs.msgErrors}: ${mOptions.errors}`);

        if (mOptions.gameMode === 2) {
            $(`#chemepGameContainer-${instance}`)
                .find('.CHEMP-DataGameScore')
                .hide();
        }

        $gamerOver.show();
    },

    startGame: function (instance) {
        const mOptions = $eXeChemical.options[instance];
        if (mOptions.gameStarted) return;

        clearInterval(mOptions.counterClock);

        $(`#chemepShowFullScreenRow-${instance}`).hide();

        if (mOptions.questionsRandom) {
            mOptions.selectsGame =
                $exeDevices.iDevice.gamification.helpers.shuffleAds(
                    mOptions.selectsGame
                );
        }

        mOptions.scoreGame = 0;
        mOptions.obtainedClue = false;

        $(`#chemepShowClue-${instance}`).hide();
        $(`#chemepGameContainer-${instance} .CHEMP-StartGame`).hide();
        $(`#chemepQuestion-${instance}`).text('');
        $(`#chemepQuestionDiv-${instance}`).show();
        $(`#chemepWordDiv-${instance}`).hide();

        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.gameActived = false;
        mOptions.activeQuestion = -1;
        mOptions.validQuestions = mOptions.numberQuestions;
        mOptions.counter = 0;
        mOptions.gameStarted = false;
        mOptions.livesLeft = mOptions.numberLives;

        $eXeChemical.updateLives(instance);
        $(`#chemepPNumber-${instance}`).text(mOptions.numberQuestions);

        mOptions.selectsGame.forEach((question) => {
            question.answerScore = -1;
        });

        mOptions.counterClock = setInterval(() => {
            if (mOptions.gameStarted && mOptions.activeCounter) {
                let $node = $('#chemepMainContainer-' + instance);
                let $content = $('#node-content');
                if (
                    !$node.length ||
                    ($content.length && $content.attr('mode') === 'edition')
                ) {
                    clearInterval(mOptions.counterClock);
                    return;
                }
                mOptions.counter--;
                $eXeChemical.updateTime(mOptions.counter, instance);

                if (mOptions.counter <= 0) {
                    mOptions.activeCounter = false;
                    let timeShowSolution = 1000;
                    if (mOptions.showSolution) {
                        timeShowSolution = mOptions.timeShowSolution * 1000;
                        if (!$eXeChemical.sameQuestion(false, instance)) {
                            const currentQuestion =
                                mOptions.selectsGame[mOptions.activeQuestion];
                            if (currentQuestion && currentQuestion.typeSelect !== 2) {
                                $eXeChemical.drawSolution(instance);
                            } else if (currentQuestion) {
                                $eXeChemical.drawPhrase(
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
                        $eXeChemical.newQuestion(instance);
                    }, timeShowSolution);
                    return;
                }
            }
        }, 1000);

        $eXeChemical.updateTime(0, instance);
        $(`#chemepGameOver-${instance}`).hide();
        $(`#chemepPHits-${instance}`).text(mOptions.hits);
        $(`#chemepPErrors-${instance}`).text(mOptions.errors);
        $(`#chemepPScore-${instance}`).text(mOptions.score);

        mOptions.gameStarted = true;
        $eXeChemical.newQuestion(instance);
    },

    updateTime: function (tiempo, instance) {
        const mTime =
            $exeDevices.iDevice.gamification.helpers.getTimeToString(tiempo);
        $(`#chemepPTime-${instance}`).text(mTime);
    },

    gameOver: function (type, instance) {
        const mOptions = $eXeChemical.options[instance];
        mOptions.gameStarted = false;
        mOptions.gameActived = false;
        $(`#chemepShowFullScreenRow-${instance}`).hide();
        clearInterval(mOptions.counterClock);

        $(`#chemepStructureCanvas-${instance}`).hide().empty();
        $(`#chemepCover-${instance}`).show();
        $(
            `#chemepDivModeBoard-${instance}, #chemepCover-${instance}`
        ).hide();

        $exeDevices.iDevice.gamification.media.stopSound();

        const message =
            type === 0
                ? mOptions.msgs.msgAllQuestions
                : mOptions.msgs.msgLostLives;
        $eXeChemical.showMessage(2, message, instance);
        $eXeChemical.showScoreGame(type, instance);
        $eXeChemical.clearQuestions(instance);
        $eXeChemical.updateTime(0, instance);

        $(`#chemepPNumber-${instance}`).text('0');
        $(`#chemepStartGame-${instance}`).text(mOptions.msgs.msgNewGame);
        $(`#chemepGameContainer-${instance} .CHEMP-StartGame`).show();
        $(
            `#chemepQuestionDiv-${instance}, #chemepAnswerDiv-${instance}, #chemepWordDiv-${instance}`
        ).hide();

        mOptions.gameOver = true;

        if (mOptions.isScorm === 1) {
            if (
                mOptions.repeatActivity ||
                $eXeChemical.initialScore === ''
            ) {
                const score = (
                    (mOptions.scoreGame * 10) /
                    mOptions.scoreTotal
                ).toFixed(2);
                $eXeChemical.sendScore(true, instance);
                $(`#chemepRepeatActivity-${instance}`).text(
                    `${mOptions.msgs.msgYouScore}: ${score}`
                );
                $eXeChemical.initialScore = score;
            }
        }
        $eXeChemical.saveEvaluation(instance);
        $eXeChemical.showFeedBack(instance);
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
        const $phraseContainer = $(`#chemepEPhrase-${instance}`);
        $phraseContainer.find('.CHEMP-Word').remove();

        $(
            `#chemepBtnReply-${instance}, #chemepBtnMoveOn-${instance}, #chemepEdAnswer-${instance}`
        ).prop('disabled', true);
        $(`#chemepQuestionDiv-${instance}`).hide();
        $(`#chemepWordDiv-${instance}`).show();
        $(`#chemepAnswerDiv-${instance}`).hide();

        if (!casesensitive) {
            phrase = phrase.toUpperCase();
        }

        const cPhrase = $eXeChemical.clear(phrase),
            letterShow = $eXeChemical.getShowLetter(cPhrase, nivel),
            h = cPhrase.replace(/\s/g, '&');
        let nPhrase = [];

        for (let z = 0; z < h.length; z++) {
            nPhrase.push(h[z] !== '&' && !letterShow.includes(z) ? ' ' : h[z]);
        }

        nPhrase = nPhrase.join('');
        const phraseArray = nPhrase.split('&');

        phraseArray.forEach((cleanWord) => {
            if (cleanWord !== '') {
                const $wordDiv = $('<div class="CHEMP-Word"></div>').appendTo(
                    $phraseContainer
                );
                for (let char of cleanWord) {
                    let letterClass = 'blue';
                    if (type === 1) letterClass = 'red';
                    if (type === 2) letterClass = 'green';
                    $wordDiv.append(
                        `<div class="CHEMP-Letter ${letterClass}">${char}</div>`
                    );
                }
            }
        });

        if (!solution) {
            $(`#chemepDefinition-${instance}`).html(definition);
        }

        const htmlContent = $(`#chemepWordDiv-${instance}`).html();
        if ($exeDevices.iDevice.gamification.math.hasLatex(htmlContent)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                `chemepWordDiv-${instance}`
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
        const mOptions = $eXeChemical.options[instance],
            mQuestion = mOptions.selectsGame[i];

        $eXeChemical.clearQuestions(instance);
        mOptions.gameActived = true;
        mOptions.question = mQuestion;
        mOptions.respuesta = '';

        const time = $exeDevices.iDevice.gamification.helpers.getTimeToString(
            $exeDevices.iDevice.gamification.helpers.getTimeSeconds(
                mQuestion.time
            )
        );
        $(`#chemepPTime-${instance}`).text(time);
        $(`#chemepQuestion-${instance}`).html(mQuestion.quextion);

        $(`#chemepCover-${instance}`).show();
        $(`#chemepStructureCanvas-${instance}`).hide().empty();

        $eXeChemical.showMessage(0, '', instance);

        if (mOptions.answersRamdon) {
            $eXeChemical.ramdonOptions(instance);
        }

        $(`#chemepPAuthor-${instance}`).text('');

        $eXeChemical.renderStructure(mQuestion, instance);

        $(`#chemepDivModeBoard-${instance}`).hide();

        if (mQuestion.typeSelect !== 2) {
            $eXeChemical.drawQuestions(instance);
        } else {
            $eXeChemical.drawPhrase(
                mQuestion.solutionQuestion,
                mQuestion.quextion,
                mQuestion.percentageShow,
                mQuestion.typeSelect,
                false,
                instance,
                false
            );
            $(
                `#chemepBtnReply-${instance}, #chemepBtnMoveOn-${instance}, #chemepEdAnswer-${instance}`
            ).prop('disabled', false);
            $(`#chemepEdAnswer-${instance}`).focus().val('');

            if (mOptions.modeBoard) {
                $(`#chemepDivModeBoard-${instance}`)
                    .css('display', 'flex')
                    .fadeIn();
            }
        }

        if (mOptions.isScorm === 1) {
            if (
                mOptions.repeatActivity ||
                $eXeChemical.initialScore === ''
            ) {
                const score = (
                    (mOptions.scoreGame * 10) /
                    mOptions.scoreTotal
                ).toFixed(2);
                $eXeChemical.sendScore(true, instance);
                $(`#chemepRepeatActivity-${instance}`).text(
                    `${mOptions.msgs.msgYouScore}: ${score}`
                );
            }
        }

        $eXeChemical.saveEvaluation(instance);
    },

    updateLives: function (instance) {
        const mOptions = $eXeChemical.options[instance];
        $(`#chemepPLifes-${instance}`).text(mOptions.livesLeft);
        const $livesIcons = $(`#chemepLifesGame-${instance}`).find(
            '.exeQuextIcons-Life'
        );

        if (mOptions.useLives) {
            $livesIcons.each((index, element) => {
                $(element).toggle(index < mOptions.livesLeft);
            });
        } else {
            $livesIcons.hide();
            $(`#chemepNumberLivesGame-${instance}`).hide();
        }
    },

    newQuestion: function (instance) {
        const mOptions = $eXeChemical.options[instance];

        if (mOptions.useLives && mOptions.livesLeft <= 0) {
            $eXeChemical.gameOver(1, instance);
            return;
        }

        const mActiveQuestion =
            $eXeChemical.updateNumberQuestion(
                mOptions.activeQuestion,
                instance
            );

        if (mActiveQuestion === null || !mOptions.selectsGame[mActiveQuestion]) {
            $(`#chemepPNumber-${instance}`).text('0');
            $eXeChemical.gameOver(0, instance);
        } else {
            mOptions.counter =
                $exeDevices.iDevice.gamification.helpers.getTimeSeconds(
                    mOptions.selectsGame[mActiveQuestion].time
                );
            $eXeChemical.showQuestion(mActiveQuestion, instance);
            mOptions.activeCounter = true;
            const numQ = mOptions.numberQuestions - mActiveQuestion;
            $(`#chemepPNumber-${instance}`).text(numQ);
        }
    },

    updateNumberQuestion: function (numq, instance) {
        const mOptions = $eXeChemical.options[instance];
        let numActiveQuestion = numq;

        numActiveQuestion++;
        if (numActiveQuestion >= mOptions.numberQuestions) {
            return null;
        }

        mOptions.activeQuestion = numActiveQuestion;
        return numActiveQuestion;
    },

    getRetroFeedMessages: function (iHit, instance) {
        const msgs = $eXeChemical.options[instance].msgs,
            sMessages = iHit
                ? (msgs.msgSuccesses || 'Right! | Excellent! | Great! | Very good! | Perfect!')
                : (msgs.msgFailures || 'It was not that! | Incorrect! | Not correct! | Sorry! | Error!'),
            messagesArray = sMessages.split('|');
        return messagesArray[Math.floor(Math.random() * messagesArray.length)];
    },

    answerQuestion: function (instance) {
        const mOptions = $eXeChemical.options[instance],
            question = mOptions.selectsGame[mOptions.activeQuestion];

        if (!mOptions.gameActived || !question) return;

        mOptions.gameActived = false;
        let correct = true,
            solution = question.solution,
            answer = mOptions.respuesta.toUpperCase();

        if (question.typeSelect === 2) {
            solution = question.solutionQuestion.toUpperCase();
            answer = $.trim(
                $(`#chemepEdAnswer-${instance}`).val()
            ).toUpperCase();
            if (answer.length === 0) {
                $eXeChemical.showMessage(
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
                $eXeChemical.showMessage(
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
        $eXeChemical.processAnswer(correct, instance);
    },

    answerQuestionBoard: function (value, instance) {
        const mOptions = $eXeChemical.options[instance],
            question = mOptions.selectsGame[mOptions.activeQuestion];

        if (!mOptions.gameActived || !question) return;

        mOptions.gameActived = false;
        mOptions.activeCounter = false;
        $eXeChemical.processAnswer(value, instance);
    },

    processAnswer: function (correct, instance) {
        const mOptions = $eXeChemical.options[instance],
            question = mOptions.selectsGame[mOptions.activeQuestion];

        $eXeChemical.updateScore(correct, instance);

        let timeShowSolution = mOptions.showSolution
            ? mOptions.timeShowSolution * 1000
            : 1000;
        const percentageHits = (mOptions.hits / mOptions.numberQuestions) * 100;

        $(`#chemepPHits-${instance}`).text(mOptions.hits);
        $(`#chemepPErrors-${instance}`).text(mOptions.errors);

        if (
            mOptions.itinerary.showClue &&
            percentageHits >= mOptions.itinerary.percentageClue &&
            !mOptions.obtainedClue
        ) {
            timeShowSolution = 5000;
            $(`#chemepShowClue-${instance}`)
                .text(
                    `${mOptions.msgs.msgInformation}: ${mOptions.itinerary.clueGame}`
                )
                .show();
            mOptions.obtainedClue = true;
        }

        if (
            mOptions.showSolution &&
            !$eXeChemical.sameQuestion(correct, instance)
        ) {
            if (question.typeSelect !== 2) {
                $eXeChemical.drawSolution(instance);
            } else {
                const mType = correct ? 2 : 1;
                $eXeChemical.drawPhrase(
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
            $eXeChemical.newQuestion(instance);
        }, timeShowSolution);
    },

    sameQuestion: function (correct, instance) {
        const mOptions = $eXeChemical.options[instance],
            q = mOptions.selectsGame[mOptions.activeQuestion];
        if (!q) return false;
        return (
            (correct && q.hit === mOptions.activeQuestion) ||
            (!correct && q.error === mOptions.activeQuestion)
        );
    },

    updateScore: function (correctAnswer, instance) {
        const mOptions = $eXeChemical.options[instance],
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
                    $eXeChemical.updateLives(instance);
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

        $(`#chemepPScore-${instance}`).text(sscore);
        $(`#chemepPHits-${instance}`).text(mOptions.hits);
        $(`#chemepPErrors-${instance}`).text(mOptions.errors);

        message = $eXeChemical.getMessageAnswer(correctAnswer, points, instance);
        $eXeChemical.showMessage(type, message, instance);
    },

    getMessageAnswer: function (correctAnswer, npts, instance) {
        const mse = $eXeChemical.getMessageErrorAnswer(npts, instance);
        const msc = $eXeChemical.getMessageCorrectAnswer(npts, instance);
        return correctAnswer ? msc : mse;
    },

    getMessageCorrectAnswer: function (npts, instance) {
        const mOptions = $eXeChemical.options[instance],
            messageCorrect = $eXeChemical.getRetroFeedMessages(true, instance),
            pts = mOptions.msgs.msgPoints || '';
        return mOptions.gameMode === 2
            ? messageCorrect
            : `${messageCorrect} ${npts} ${pts}`;
    },

    getMessageErrorAnswer: function (npts, instance) {
        const mOptions = $eXeChemical.options[instance],
            messageError = $eXeChemical.getRetroFeedMessages(false, instance),
            pts = mOptions.msgs.msgPoints || '';
        let message = mOptions.useLives
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
                $eXeChemical.borderColors.red,
                $eXeChemical.borderColors.green,
                $eXeChemical.borderColors.blue,
                $eXeChemical.borderColors.yellow,
            ],
            mcolor = colors[type];

        $(`#chemepPAuthor-${instance}`).html(message).css({
            color: mcolor,
            'font-weight': 'normal',
        });

        $exeDevices.iDevice.gamification.math.updateLatex(
            `#chemepPAuthor-${instance}`
        );
    },

    ramdonOptions: function (instance) {
        const mOptions = $eXeChemical.options[instance],
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
        const mOptions = $eXeChemical.options[instance],
            borderColors = [
                $eXeChemical.borderColors.red,
                $eXeChemical.borderColors.blue,
                $eXeChemical.borderColors.green,
                $eXeChemical.borderColors.yellow,
            ];

        $(`#chemepQuestionDiv-${instance}`).show();
        $(`#chemepWordDiv-${instance}`).hide();
        $(`#chemepAnswerDiv-${instance}`).show();

        $(`#chemepOptionsDiv-${instance} > .CHEMP-Options`).each(
            function (index) {
                const option = mOptions.question.options[index];
                $(this)
                    .css({
                        'border-color': borderColors[index],
                        'background-color': 'transparent',
                        cursor: 'pointer',
                        color: $eXeChemical.colors.black,
                    })
                    .html(option || '')
                    .toggle(!!option);
            }
        );

        const html = $(`#chemepQuestionDiv-${instance}`).html();
        if ($exeDevices.iDevice.gamification.math.hasLatex(html)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                `chemepQuestionDiv-${instance}`
            );
        }
    },

    drawSolution: function (instance) {
        const mOptions = $eXeChemical.options[instance],
            question = mOptions.selectsGame[mOptions.activeQuestion];

        if (!question) return;

        const solution = question.solution,
            letters = 'ABCD';

        mOptions.gameActived = false;

        $(`#chemepOptionsDiv-${instance}`)
            .find('.CHEMP-Options')
            .each(function (i) {
                let css = {
                    'border-color': $eXeChemical.borderColors.incorrect,
                    'border-width': '1px',
                    'background-color': 'transparent',
                    cursor: 'pointer',
                    color: $eXeChemical.borderColors.grey,
                };

                if (question.typeSelect === 1) {
                    css = {
                        'border-color': $eXeChemical.borderColors.correct,
                        'background-color': $eXeChemical.colors.correct,
                        'border-width': '1px',
                        cursor: 'pointer',
                        color: $eXeChemical.borderColors.black,
                    };
                    const text = question.options[letters.indexOf(solution[i])];
                    $(this).text(text);
                } else if (solution.includes(letters[i])) {
                    css = {
                        'border-color': $eXeChemical.borderColors.correct,
                        'background-color': $eXeChemical.colors.correct,
                        'border-width': '1px',
                        cursor: 'pointer',
                        color: $eXeChemical.borderColors.black,
                    };
                }

                $(this).css(css);
            });
    },

    changeQuextion: function (instance, button) {
        const mOptions = $eXeChemical.options[instance],
            numberButton = parseInt($(button).data('number'), 10),
            letters = 'ABCD',
            letter = letters[numberButton],
            bordeColors = [
                $eXeChemical.borderColors.red,
                $eXeChemical.borderColors.blue,
                $eXeChemical.borderColors.green,
                $eXeChemical.borderColors.yellow,
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
            'border-width': '1px',
            'border-color': bordeColors[numberButton],
            'background-color': bordeColors[numberButton],
            cursor: 'pointer',
            color: '#ffffff',
        };
        const obj2 = {
            'border-width': '1px',
            'border-color': bordeColors[numberButton],
            'background-color': 'transparent',
            cursor: 'default',
            color: $eXeChemical.colors.black,
        };

        const css = type ? obj1 : obj2;

        $(button).css(css);
        $(`#chemepAnswers-${instance} .CHEMP-AnswersOptions`).remove();

        for (let i = 0; i < mOptions.respuesta.length; i++) {
            const answerClass = `CHEMP-Answer${letters.indexOf(mOptions.respuesta[i]) + 1}`;
            $(`#chemepAnswers-${instance}`).append(
                `<div class="CHEMP-AnswersOptions ${answerClass}"></div>`
            );
        }
    },

    clearQuestions: function (instance) {
        const mOptions = $eXeChemical.options[instance];
        mOptions.respuesta = '';

        $(`#chemepAnswers-${instance} > .CHEMP-AnswersOptions`).remove();

        const borderColors = [
            $eXeChemical.borderColors.red,
            $eXeChemical.borderColors.blue,
            $eXeChemical.borderColors.green,
            $eXeChemical.borderColors.yellow,
        ];

        $(`#chemepOptionsDiv-${instance} > .CHEMP-Options`).each(
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
    $eXeChemical.init();
});
