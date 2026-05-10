/* eslint-disable no-undef */
/**
 * 3Dmol iDevice (export code)
 *
 * Questions are paired with interactive 3D models.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $eXe3Dmol = {
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
    viewers: {},
    modelLibraryLoading: false,
    modelLibraryCallbacks: [],

    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            '3DMol',
            '3dmol',
            'dmole-IDevice'
        );
    },

    enable: function () {
        $eXe3Dmol.ensure3Dmol(function () {
            $eXe3Dmol.loadGame();
        });
    },

    ensure3Dmol: function (callback) {
        if (typeof $3Dmol !== 'undefined' && $3Dmol.createViewer) {
            callback();
            return;
        }

        $eXe3Dmol.modelLibraryCallbacks.push(callback);
        if ($eXe3Dmol.modelLibraryLoading) return;

        $eXe3Dmol.modelLibraryLoading = true;
        const script = document.createElement('script');
        script.src = $eXe3Dmol.idevicePath + '3Dmol-min.js';
        script.onload = function () {
            $eXe3Dmol.modelLibraryLoading = false;
            const callbacks = $eXe3Dmol.modelLibraryCallbacks.slice();
            $eXe3Dmol.modelLibraryCallbacks = [];
            callbacks.forEach(function (cb) {
                cb();
            });
        };
        script.onerror = function () {
            $eXe3Dmol.modelLibraryLoading = false;
            const callbacks = $eXe3Dmol.modelLibraryCallbacks.slice();
            $eXe3Dmol.modelLibraryCallbacks = [];
            callbacks.forEach(function (cb) {
                cb();
            });
        };
        document.head.appendChild(script);
    },

    sendScore: function (auto, instance) {
        const mOptions = $eXe3Dmol.options[instance];

        mOptions.scorerp = $eXe3Dmol.getScoreRP(instance);
        mOptions.previousScore = $eXe3Dmol.previousScore;
        mOptions.userName = $eXe3Dmol.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $eXe3Dmol.previousScore = mOptions.previousScore;
    },

    getShowScoreRP: function (instance) {
        const mOptions = $eXe3Dmol.options[instance];
        const total = mOptions.selectsGame.length;
        return Math.min(((mOptions.visiteds + 1) * 10) / total, 10);
    },

    getScoreRP: function (instance) {
        const mOptions = $eXe3Dmol.options[instance];

        if (mOptions.activityMode === 'show') {
            return $eXe3Dmol.getShowScoreRP(instance);
        }

        return (mOptions.scoreGame * 10) / mOptions.scoreTotal;
    },

    loadGame: function () {
        $eXe3Dmol.options = [];
        $eXe3Dmol.viewers = {};
        $eXe3Dmol.activities.each(function (i) {
            const dl = $('.dmole-DataGame', this);
            if (dl.length === 0) return; // Skip already initialized activities
            const version = $('.dmole-version', this).eq(0).text(),
                mOption = $eXe3Dmol.loadDataGame(dl, version),
                msg = mOption.msgs.msgPlayStart;

            mOption.scorerp = 0;
            mOption.idevicePath = $eXe3Dmol.idevicePath;
            mOption.main = 'dmolpMainContainer-' + i;
            mOption.idevice = 'dmole-IDevice';

            $eXe3Dmol.options.push(mOption);
            const interfaceHtml = $eXe3Dmol.createInterface(i);
            dl.before(interfaceHtml).remove();

            $('#dmolpGameMinimize-' + i).hide();
            $('#dmolpGameContainer-' + i).hide();
            if (mOption.showMinimize) {
                $('#dmolpGameMinimize-' + i)
                    .css({ cursor: 'pointer' })
                    .show();
            } else {
                $('#dmolpGameContainer-' + i).show();
            }
            $('#dmolpMessageMaximize-' + i).text(msg);
            $('#dmolpDivFeedBack-' + i).prepend(
                $('.dmole-feedback-game', this)
            );

            $('#dmolpDivFeedBack-' + i).hide();
            $('#dmolpMainContainer-' + i).show();

            $eXe3Dmol.addEvents(i);
        });

        let node = document.querySelector('.page-content');
        if (this.isInExe) {
            node = document.getElementById('node-content');
        }
        if (node)
            $exeDevices.iDevice.gamification.observers.observeResize(
                $eXe3Dmol,
                node
            );

        $exeDevices.iDevice.gamification.math.updateLatex(
            '.dmole-IDevice'
        );
    },

    createInterface: function (instance) {
        const path = $eXe3Dmol.idevicePath,
            msgs = $eXe3Dmol.options[instance].msgs,
            mOptions = $eXe3Dmol.options[instance],
            html = `
        <div class="DMOLP-MainContainer" id="dmolpMainContainer-${instance}">
            <div class="DMOLP-GameMinimize" id="dmolpGameMinimize-${instance}">
                <a href="#" class="DMOLP-LinkMaximize" id="dmolpLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                    <img src="${path}dmolpIcon.png" class="DMOLP-IconMinimize DMOLP-Activo" alt="">
                    <div class="DMOLP-MessageMaximize" id="dmolpMessageMaximize-${instance}"></div>
                </a>
            </div>
            <div class="DMOLP-GameContainer" id="dmolpGameContainer-${instance}">
                <div class="DMOLP-GameScoreBoard">
                    <div class="DMOLP-GameScores">
                        <div class="exeQuextIcons exeQuextIcons-Number" title="${msgs.msgNumQuestions}"></div>
                        <p><span class="sr-av">${msgs.msgNumQuestions}: </span><span id="dmolpPNumber-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                        <p><span class="sr-av">${msgs.msgHits}: </span><span id="dmolpPHits-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Error" title="${msgs.msgErrors}"></div>
                        <p><span class="sr-av">${msgs.msgErrors}: </span><span id="dmolpPErrors-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Score" title="${msgs.msgScore}"></div>
                        <p><span class="sr-av">${msgs.msgScore}: </span><span id="dmolpPScore-${instance}">0</span></p>
                    </div>
                    <div class="DMOLP-LifesGame" id="dmolpLifesGame-${instance}">
                        ${$eXe3Dmol.createLives(msgs)}
                    </div>
                    <div class="DMOLP-NumberLifesGame" id="dmolpNumberLivesGame-${instance}">
                        <strong class="sr-av">${msgs.msgLive}:</strong>
                        <div class="exeQuextIcons exeQuextIcons-Life"></div>
                        <p id="dmolpPLifes-${instance}">0</p>
                    </div>
                    <div class="DMOLP-TimeNumber">
                        <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                        <div class="exeQuextIcons exeQuextIcons-Time" title="${msgs.msgTime}"></div>
                        <p id="dmolpPTime-${instance}" class="DMOLP-PTime">00:00</p>
                        <a href="#" class="DMOLP-LinkMinimize" id="dmolpLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                            <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Minimize DMOLP-Activo"></div>
                        </a>
                        <a href="#" class="DMOLP-LinkFullScreen" id="dmolpLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                            <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-FullScreen DMOLP-Activo" id="dmolpFullScreen-${instance}"></div>
                        </a>
                    </div>
                </div>
                <div class="DMOLP-ShowClue" id="dmolpShowClue-${instance}">
                    <div class="sr-av">${msgs.msgClue}:</div>
                    <p class="DMOLP-PShowClue DMOLP-parpadea" id="dmolpPShowClue-${instance}"></p>
                </div>
                <div class="DMOLP-ModelWithLegend">
                <div class="DMOLP-Multimedia" id="dmolpMultimedia-${instance}">
                    <div class="DMOLP-ModelPreview" id="dmolpModelPreview-${instance}" tabindex="0" role="img" aria-label="${msgs.msgNoImage}"></div>
                    <span id="dmolpModelDesc-${instance}" class="sr-av">${msgs.msgNoImage}</span>
                    <img src="${path}dmolpHome.png" class="DMOLP-Cover" id="dmolpCover-${instance}" alt="${msgs.msgNoImage}" />
                    <div class="DMOLP-GameOver" id="dmolpGamerOver-${instance}">
                        <div class="DMOLP-DataImage">
                            <img src="${path}exequextwon.png" class="DMOLP-HistGGame" id="dmolpHistGame-${instance}" alt="${msgs.msgAllQuestions}" />
                            <img src="${path}exequextlost.png" class="DMOLP-LostGGame" id="dmolpLostGame-${instance}" alt="${msgs.msgLostLives}" />
                        </div>
                        <div class="DMOLP-DataScore">
                            <p id="dmolpOverScore-${instance}">Score: 0</p>
                            <p id="dmolpOverHits-${instance}">Hits 0</p>
                            <p id="dmolpOverErrors-${instance}">Errors: 0</p>
                        </div>
                    </div>
                </div>
                <div class="DMOLP-AtomLegend" id="dmolpAtomLegend-${instance}" aria-hidden="true"></div>
                </div>
                <div class="DMOLP-ShowFullScreenRow" id="dmolpShowFullScreenRow-${instance}">
                    <a href="#" class="DMOLP-ShowFullScreenBtn" id="dmolpShowFullScreen-${instance}" title="${msgs.msgFullScreen}">
                        <div class="exeQuextIcons exeQuextIcons-FullScreen" aria-hidden="true"></div>
                        <span class="sr-av">${msgs.msgFullScreen}</span>
                    </a>
                </div>
                <div class="DMOLP-ModelStyleControl" id="dmolpModelStyleControl-${instance}">
                    <label for="dmolpModelStyle-${instance}" class="DMOLP-ModelStyleLabel">${msgs.msgModelStyle || 'Molecule style'}:</label>
                    <div class="DMOLP-ModelStyleInputGroup">
                        <select id="dmolpModelStyle-${instance}" class="DMOLP-ModelStyleSelect form-select form-select-sm">
                            ${$eXe3Dmol.createModelStyleOptions(msgs, mOptions.modelStyle)}
                        </select>
                        <button type="button" id="dmolpModelSizeDown-${instance}" class="DMOLP-ModelSizeBtn" title="${msgs.msgModelSizeDown || 'Smaller'}">-</button>
                        <button type="button" id="dmolpModelSizeUp-${instance}" class="DMOLP-ModelSizeBtn" title="${msgs.msgModelSizeUp || 'Bigger'}">+</button>
                        <button type="button" id="dmolpResetCamera-${instance}" class="DMOLP-ModelSizeBtn" title="${msgs.msgResetCamera || 'Reset camera view'}">↺</button>
                        <button type="button" id="dmolpToggleBg-${instance}" class="DMOLP-ModelSizeBtn DMOLP-ToggleBgBtn" title="${msgs.msgToggleBg || 'Toggle background'}" aria-pressed="false">☀</button>
                        <button type="button" id="dmolpDownloadPng-${instance}" class="DMOLP-ModelSizeBtn" title="${msgs.msgDownloadPng || 'Download image'}">⬇</button>
                    </div>
                </div>
                <div class="DMOLP-Description" id="dmolpDescription-${instance}" style="display:none"></div>
                <div class="DMOLP-ShowNavigation" id="dmolpShowNavigation-${instance}">
                    <a href="#" class="DMOLP-ShowNavBtn" id="dmolpShowPrev-${instance}" title="${msgs.msgPrevious || ''}">
                        <img src="${path}bfafprevious.png" class="DMOLP-ShowNavImg" alt="${msgs.msgPrevious || ''}" />
                    </a>
                    <span class="DMOLP-ShowCounter" id="dmolpShowCounter-${instance}">1 / 1</span>
                    <a href="#" class="DMOLP-ShowNavBtn" id="dmolpShowNext-${instance}" title="${msgs.msgNext || ''}">
                        <img src="${path}bfafnext.png" class="DMOLP-ShowNavImg" alt="${msgs.msgNext || ''}" />
                    </a>
                </div>
                <div class="DMOLP-AuthorLicence" id="dmolpAuthorLicence-${instance}">
                    <div class="sr-av">${msgs.msgAuthor}:</div>
                    <p id="dmolpPAuthor-${instance}"></p>
                </div>
                <div class="sr-av" id="dmolpStartGameSRAV-${instance}">${msgs.msgPlayStart}:</div>
                <div class="DMOLP-StartGame"><a href="#" id="dmolpStartGame-${instance}"></a></div>
                <div class="DMOLP-QuestionDiv" id="dmolpQuestionDiv-${instance}">
                    <div class="sr-av">${msgs.msgQuestion}:</div>
                    <div class="DMOLP-Question" id="dmolpQuestion-${instance}"></div>
                    <div class="DMOLP-OptionsDiv" id="dmolpOptionsDiv-${instance}">
                        ${$eXe3Dmol.createOptions(msgs, instance)}
                    </div>
                </div>
                <div class="DMOLP-WordsDiv" id="dmolpWordDiv-${instance}">
                    <div class="sr-av">${msgs.msgAnswer}:</div>
                    <div class="DMOLP-Prhase" id="dmolpEPhrase-${instance}"></div>
                    <div class="sr-av">${msgs.msgQuestion}:</div>
                    <div class="DMOLP-Definition" id="dmolpDefinition-${instance}"></div>
                    <div class="DMOLP-DivReply" id="dmolpDivResponder-${instance}">
                        <input type="text" value="" class="DMOLP-EdReply form-control" id="dmolpEdAnswer-${instance}" autocomplete="off">
                        <a href="#" id="dmolpBtnReply-${instance}" title="${msgs.msgAnswer}">
                            <strong class="sr-av">${msgs.msgAnswer}</strong>
                            <div class="exeQuextIcons-Submit DMOLP-Activo"></div>
                        </a>
                    </div>
                </div>
                <div class="DMOLP-BottonContainerDiv" id="dmolpBottonContainer-${instance}">
                    <div class="DMOLP-AnswersDiv" id="dmolpAnswerDiv-${instance}">
                        <div class="DMOLP-Answers" id="dmolpAnswers-${instance}"></div>
                        <a href="#" id="dmolpButtonAnswer-${instance}" title="${msgs.msgAnswer}">
                            <strong class="sr-av">${msgs.msgAnswer}</strong>
                            <div class="exeQuextIcons-Submit DMOLP-Activo"></div>
                        </a>
                    </div>
                </div>
                <div class="DMOLP-DivFeedBack" id="dmolpDivFeedBack-${instance}">
                    <input type="button" id="dmolpFeedBackClose-${instance}" value="${msgs.msgClose}" class="feedbackbutton" />
                </div>
                <div class="DMOLP-DivModeBoard" id="dmolpDivModeBoard-${instance}">
                    <a class="DMOLP-ModeBoard" href="#" id="dmolpModeBoardOK-${instance}" title="${msgs.msgCorrect}">${msgs.msgCorrect}</a>
                    <a class="DMOLP-ModeBoard" href="#" id="dmolpModeBoardMoveOn-${instance}" title="${msgs.msgMoveOne}">${msgs.msgMoveOne}</a>
                    <a class="DMOLP-ModeBoard" href="#" id="dmolpModeBoardKO-${instance}" title="${msgs.msgIncorrect}">${msgs.msgIncorrect}</a>
                </div>
            </div>
            <div class="DMOLP-Cubierta" id="dmolpCubierta-${instance}" style="display:none">
                    <div class="DMOLP-CodeAccessDiv" id="dmolpCodeAccessDiv-${instance}">
                        <p class="DMOLP-MessageCodeAccessE" id="dmolpMesajeAccesCodeE-${instance}"></p>
                        <div class="DMOLP-DataCodeAccessE">
                            <label for="dmolpCodeAccessE-${instance}" class="sr-av">${msgs.msgCodeAccess}:</label>
                            <input type="text" class="DMOLP-CodeAccessE form-control" id="dmolpCodeAccessE-${instance}" placeholder="${msgs.msgCodeAccess}">
                            <a href="#" id="dmolpCodeAccessButton-${instance}" title="${msgs.msgSubmit}">
                                <strong class="sr-av">${msgs.msgSubmit}</strong>
                                <div class="exeQuextIcons exeQuextIcons-Submit DMOLP-Activo"></div>
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
            <a href="#" class="DMOLP-Option${index + 1} DMOLP-Options" id="dmolpOption${index + 1}-${instance}" data-number="${index}"></a>
        `
            )
            .join('');

        return optionss;
    },

    normalizeModelStyle: function (style) {
        const allowed = ['line', 'cross', 'stick', 'sphere', 'cartoon', 'surface'];
        const normalized = (style || '').toString().trim().toLowerCase();
        return allowed.includes(normalized) ? normalized : 'stick';
    },

    normalizeModelViewportScale: function (scale) {
        const parsed = parseInt(scale, 10);
        if (isNaN(parsed)) return 98;
        return Math.max(70, Math.min(parsed, 98));
    },

    getModelStyleChoices: function (msgs) {
        return [
            { value: 'line', label: msgs.msgModelStyleLine || 'Line' },
            { value: 'cross', label: msgs.msgModelStyleCross || 'Cross' },
            { value: 'stick', label: msgs.msgModelStyleStick || 'Stick' },
            { value: 'sphere', label: msgs.msgModelStyleSphere || 'Sphere' },
            { value: 'cartoon', label: msgs.msgModelStyleCartoon || 'Cartoon' },
            { value: 'surface', label: msgs.msgModelStyleSurface || 'Surface' },
        ];
    },

    createModelStyleOptions: function (msgs, selectedStyle) {
        const style = $eXe3Dmol.normalizeModelStyle(selectedStyle);
        return $eXe3Dmol
            .getModelStyleChoices(msgs)
            .map(function (item) {
                const selected = item.value === style ? ' selected' : '';
                return `<option value="${item.value}"${selected}>${item.label}</option>`;
            })
            .join('');
    },

    showCubiertaOptions(mode, instance) {
        if (mode === false) {
            $('#dmolpCubierta-' + instance).fadeOut();
            return;
        }
        $('#dmolpCubierta-' + instance).fadeIn();
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
        mOptions.disableCamera = !!mOptions.disableCamera;

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
            mOptions.selectsGame[i].modelData =
                typeof mOptions.selectsGame[i].modelData == 'undefined'
                    ? ''
                    : mOptions.selectsGame[i].modelData;
            mOptions.selectsGame[i].modelFormat =
                typeof mOptions.selectsGame[i].modelFormat == 'undefined'
                    ? ''
                    : mOptions.selectsGame[i].modelFormat;
            mOptions.selectsGame[i].modelName =
                typeof mOptions.selectsGame[i].modelName == 'undefined'
                    ? ''
                    : mOptions.selectsGame[i].modelName;
            mOptions.selectsGame[i].description =
                typeof mOptions.selectsGame[i].description == 'undefined'
                    ? ''
                    : mOptions.selectsGame[i].description;
            if (
                !mOptions.selectsGame[i].modelFormat &&
                mOptions.selectsGame[i].modelName
            ) {
                mOptions.selectsGame[i].modelFormat =
                    $eXe3Dmol.getModelFormatByName(
                        mOptions.selectsGame[i].modelName
                    );
            }
            // Migrate global disableCamera to per-question (backward compat)
            mOptions.selectsGame[i].disableCamera = typeof mOptions.selectsGame[i].disableCamera !== 'undefined'
                ? !!mOptions.selectsGame[i].disableCamera
                : !!mOptions.disableCamera;
            mOptions.selectsGame[i].showAtomLegend = !!mOptions.selectsGame[i].showAtomLegend;
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
        mOptions.modelStyle = $eXe3Dmol.normalizeModelStyle(
            mOptions.modelStyle
        );
        mOptions.modelViewportScale = $eXe3Dmol.normalizeModelViewportScale(
            mOptions.modelViewportScale
        );
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
        const mOptions = $eXe3Dmol.options[instance];
        $(window).off('unload.exeEC beforeunload.exeEC');
        $(document).off(`fullscreenchange.dmolp${instance}`);
        $(document).off(`webkitfullscreenchange.dmolp${instance}`);
        $(document).off(`mozfullscreenchange.dmolp${instance}`);
        $(document).off(`MSFullscreenChange.dmolp${instance}`);
        $(`#dmolpLinkMaximize-${instance}`).off('click touchstart');
        $(`#dmolpLinkMinimize-${instance}`).off('click touchstart');
        $('#dmolpMainContainer-' + instance)
            .closest('.idevice_node')
            .off('click', '.Games-SendScore');
        $(`#dmolpCodeAccessButton-${instance}`).off('click touchstart');
        $(`#dmolpCodeAccessE-${instance}`).off('keydown');
        $(`#dmolpBtnMoveOn-${instance}`).off('click');
        $(`#dmolpBtnReply-${instance}`).off('click');
        $(`#dmolpEdAnswer-${instance}`).off('keydown');
        $(`#dmolpOptionsDiv-${instance}`)
            .find('.DMOLP-Options')
            .off('click');
        $(`#dmolpLinkFullScreen-${instance}`).off('click touchstart');
        $(`#dmolpButtonAnswer-${instance}`).off('click touchstart');
        $(`#dmolpStartGame-${instance}`).off('click');
        $(`#dmolpFeedBackClose-${instance}`).off('click');
        $(`#dmolpModeBoardOK-${instance}`).off('click');
        $(`#dmolpModeBoardKO-${instance}`).off('click');
        $(`#dmolpModeBoardMoveOn-${instance}`).off('click');
        $(`#dmolpShowPrev-${instance}`).off('click');
        $(`#dmolpShowNext-${instance}`).off('click');
        $(`#dmolpShowFullScreen-${instance}`).off('click');
        $(`#dmolpModelStyle-${instance}`).off('change');
        $(`#dmolpModelSizeDown-${instance}`).off('click');
        $(`#dmolpModelSizeUp-${instance}`).off('click');
        $(`#dmolpResetCamera-${instance}`).off('click');
        $(`#dmolpToggleBg-${instance}`).off('click');
        $(`#dmolpDownloadPng-${instance}`).off('click');
        if (mOptions) {
            mOptions.fullscreenHandler = null;
        }
        $(`#dmolpGameContainer-${instance}`).removeClass('DMOLP-IsFullscreen');
        $eXe3Dmol.destroyViewer(instance);
    },

    addEvents: function (instance) {
        const mOptions = $eXe3Dmol.options[instance];

        mOptions.respuesta = '';

        // Only allow 3D viewer interaction when mouse is over the viewer
        $(`#dmolpModelPreview-${instance}`)
            .on('mouseenter', function () {
                const canvas = this.querySelector('canvas');
                if (canvas) canvas.style.pointerEvents = 'auto';
            })
            .on('mouseleave', function () {
                const canvas = this.querySelector('canvas');
                if (canvas) canvas.style.pointerEvents = 'none';
            });

        $eXe3Dmol.removeEvents(instance);
        $(window).on('unload.exeEC beforeunload.exeEC', () => {
            $exeDevices.iDevice.gamification.scorm.endScorm(
                $eXe3Dmol.mScorm
            );
        });

        $(`#dmolpGamerOver-${instance}`).css('display', 'flex');

        $(`#dmolpLinkMaximize-${instance}`).on('click touchstart', (e) => {
            e.preventDefault();
            $(`#dmolpGameContainer-${instance}`).show();
            $(`#dmolpGameMinimize-${instance}`).hide();
        });

        $(`#dmolpLinkMinimize-${instance}`).on('click touchstart', (e) => {
            e.preventDefault();
            $(`#dmolpGameContainer-${instance}`).hide();
            $(`#dmolpGameMinimize-${instance}`)
                .css('visibility', 'visible')
                .show();
            return true;
        });

        $('#dmolpMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $eXe3Dmol.sendScore(false, instance);
                $eXe3Dmol.saveEvaluation(instance);
                return true;
            });

        $(
            `#dmolpGamerOver-${instance}, #dmolpCodeAccessDiv-${instance}, #dmolpAnswerDiv-${instance}`
        ).hide();
        $eXe3Dmol.setModelStyleControlVisibility(instance, false);
        $(`#dmolpShowFullScreenRow-${instance}`).hide();
        $(`#dmolpCover-${instance}`).show();

        $(`#dmolpCodeAccessButton-${instance}`).on(
            'click touchstart',
            (e) => {
                e.preventDefault();
                $eXe3Dmol.enterCodeAccess(instance);
            }
        );

        $(`#dmolpCodeAccessE-${instance}`).on('keydown', (event) => {
            if (event.which === 13 || event.keyCode === 13) {
                $eXe3Dmol.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        $(`#dmolpBtnMoveOn-${instance}`).on('click', (e) => {
            e.preventDefault();
            $eXe3Dmol.newQuestion(instance);
        });

        $(`#dmolpBtnReply-${instance}`).on('click', (e) => {
            e.preventDefault();
            $eXe3Dmol.answerQuestion(instance);
        });

        $(`#dmolpEdAnswer-${instance}`).on('keydown', (event) => {
            if (event.which === 13 || event.keyCode === 13) {
                $eXe3Dmol.answerQuestion(instance);
                return false;
            }
            return true;
        });

        $(`#dmolpModelStyle-${instance}`)
            .val(mOptions.modelStyle)
            .on('change', function () {
                const newStyle = $eXe3Dmol.normalizeModelStyle(
                    $(this).val()
                );
                mOptions.modelStyle = newStyle;
                $(this).val(newStyle);
                // Also update the current question's modelStyle so renderModel picks it up
                const currentQ = $eXe3Dmol.getCurrentQuestion(instance);
                if (currentQ) {
                    currentQ.modelStyle = newStyle;
                }
                $eXe3Dmol.refreshCurrentModel(instance);
            });

        $(`#dmolpModelSizeDown-${instance}`).on('click', (e) => {
            e.preventDefault();
            const viewer = $eXe3Dmol.viewers[instance];
            if (viewer && viewer.zoom) {
                viewer.zoom(0.8);
                viewer.render();
            }
        });

        $(`#dmolpModelSizeUp-${instance}`).on('click', (e) => {
            e.preventDefault();
            const viewer = $eXe3Dmol.viewers[instance];
            if (viewer && viewer.zoom) {
                viewer.zoom(1.25);
                viewer.render();
            }
        });

        $(`#dmolpResetCamera-${instance}`).on('click', (e) => {
            e.preventDefault();
            const viewer = $eXe3Dmol.viewers[instance];
            if (viewer && viewer.zoomTo) {
                viewer.zoomTo();
                viewer.render();
            }
        });

        $(`#dmolpToggleBg-${instance}`).on('click', (e) => {
            e.preventDefault();
            const currentQ = $eXe3Dmol.getCurrentQuestion(instance);
            if (!currentQ) return;
            currentQ.bgDark = !currentQ.bgDark;
            const viewer = $eXe3Dmol.viewers[instance];
            if (viewer && viewer.setBackgroundColor) {
                viewer.setBackgroundColor(currentQ.bgDark ? 'black' : 'white');
                viewer.render();
            }
            $eXe3Dmol.syncToggleBgButton(currentQ, instance);
        });

        $(`#dmolpDownloadPng-${instance}`).on('click', (e) => {
            e.preventDefault();
            const viewer = $eXe3Dmol.viewers[instance];
            if (viewer && viewer.pngURI) {
                const a = document.createElement('a');
                a.href = viewer.pngURI();
                a.download = 'model.png';
                a.click();
            }
        });

        const fullscreenHandler = () => {
            $eXe3Dmol.updateFullscreenLayout(instance);
        };
        mOptions.fullscreenHandler = fullscreenHandler;
        $(document).on(
            `fullscreenchange.dmolp${instance}`,
            fullscreenHandler
        );
        $(document).on(
            `webkitfullscreenchange.dmolp${instance}`,
            fullscreenHandler
        );
        $(document).on(
            `mozfullscreenchange.dmolp${instance}`,
            fullscreenHandler
        );
        $(document).on(
            `MSFullscreenChange.dmolp${instance}`,
            fullscreenHandler
        );

        $eXe3Dmol.applyModelViewportScale(instance);
        $eXe3Dmol.updateFullscreenLayout(instance);

        mOptions.livesLeft = mOptions.numberLives;

        $(`#dmolpOptionsDiv-${instance}`)
            .find('.DMOLP-Options')
            .on('click', function (e) {
                e.preventDefault();
                $eXe3Dmol.changeQuextion(instance, this);
            });

        $(`#dmolpLinkFullScreen-${instance}`).on(
            'click touchstart',
            (e) => {
                e.preventDefault();
                const element = document.getElementById(
                    `dmolpGameContainer-${instance}`
                );
                $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                    element
                );
            }
        );

        $(`#dmolpShowFullScreen-${instance}`).on('click', (e) => {
            e.preventDefault();
            const element = document.getElementById(
                `dmolpGameContainer-${instance}`
            );
            $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                element
            );
        });

        $eXe3Dmol.updateLives(instance);
        $(`#dmolpPNumber-${instance}`).text(mOptions.numberQuestions);
        $(`#dmolpGameContainer-${instance} .DMOLP-StartGame`).show();
        $(`#dmolpQuestionDiv-${instance}`).hide();
        $(`#dmolpBottonContainer-${instance}`).addClass(
            'DMOLP-BottonContainerDivEnd'
        );

        if (mOptions.itinerary.showCodeAccess) {
            $(`#dmolpAnswerDiv-${instance}`).hide();
            $(`#dmolpMesajeAccesCodeE-${instance}`).text(
                mOptions.itinerary.messageCodeAccess
            );
            $(`#dmolpCodeAccessDiv-${instance}`).show();
            $(`#dmolpGameContainer-${instance} .DMOLP-StartGame`).hide();
            $eXe3Dmol.showCubiertaOptions(true, instance);
        }

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        document.title = mOptions.title;
        $('meta[name=author]').attr('content', mOptions.author);
        $(`#dmolpShowClue-${instance}`).hide();
        mOptions.gameOver = false;

        $(`#dmolpButtonAnswer-${instance}`).on('click touchstart', (e) => {
            e.preventDefault();
            $eXe3Dmol.answerQuestion(instance);
        });

        $(`#dmolpStartGame-${instance}`)
            .text(mOptions.msgs.msgPlayStart)
            .on('click', (e) => {
                e.preventDefault();
                $eXe3Dmol.startGame(instance);
            });

        $(`#dmolpFeedBackClose-${instance}`).on('click', () => {
            $(`#dmolpDivFeedBack-${instance}`).hide();
        });

        if (mOptions.gameMode === 2) {
            const $gameContainer = $(`#dmolpGameContainer-${instance}`);
            $gameContainer
                .find(
                    '.exeQuextIcons-Hit, .exeQuextIcons-Error, .exeQuextIcons-Score'
                )
                .hide();
            $(
                `#dmolpPErrors-${instance}, #dmolpPHits-${instance}, #dmolpPScore-${instance}`
            ).hide();
        }

        $(`#dmolpWordDiv-${instance}`).hide();

        $(`#dmolpModeBoardOK-${instance}`).on('click', (e) => {
            e.preventDefault();
            $eXe3Dmol.answerQuestionBoard(true, instance);
        });

        $(`#dmolpModeBoardKO-${instance}`).on('click', (e) => {
            e.preventDefault();
            $eXe3Dmol.answerQuestionBoard(false, instance);
        });

        $(`#dmolpModeBoardMoveOn-${instance}`).on('click', (e) => {
            e.preventDefault();
            $eXe3Dmol.newQuestion(instance);
        });

        setTimeout(() => {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                this.isInExe
            );
        }, 500);

        if (mOptions.activityMode === 'show') {
            $eXe3Dmol.initShowMode(instance);
        }
    },

    initShowMode: function (instance) {
        const mOptions = $eXe3Dmol.options[instance];
        const $gameContainer = $(`#dmolpGameContainer-${instance}`);
        $gameContainer.addClass('DMOLP-ShowMode');

        // Hide all game-related elements
        $gameContainer.find('.DMOLP-GameScoreBoard').hide();
        $(`#dmolpGameContainer-${instance} .DMOLP-StartGame`).hide();
        $(`#dmolpStartGameSRAV-${instance}`).hide();
        $(`#dmolpQuestionDiv-${instance}`).hide();
        $(`#dmolpOptionsDiv-${instance}`).hide();
        $(`#dmolpBottonContainer-${instance}`).hide();
        $(`#dmolpWordDiv-${instance}`).hide();
        $(`#dmolpDivFeedBack-${instance}`).hide();
        $(`#dmolpDivModeBoard-${instance}`).hide();
        $(`#dmolpGamerOver-${instance}`).hide();
        $(`#dmolpShowClue-${instance}`).hide();
        $(`#dmolpAuthorLicence-${instance}`).hide();
        $(`#dmolpAnswerDiv-${instance}`).hide();

        // Move navigation bar before multimedia, show it
        $(`#dmolpShowNavigation-${instance}`)
            .insertBefore(`#dmolpMultimedia-${instance}`)
            .css('display', 'flex');
        $(`#dmolpShowFullScreenRow-${instance}`)
            .insertBefore(`#dmolpShowNavigation-${instance}`)
            .css('display', 'flex');
        $(`#dmolpShowClue-${instance}`).insertAfter(`#dmolpShowFullScreenRow-${instance}`);

        // Apply Show mode layout
        $(`#dmolpMultimedia-${instance}`).addClass('DMOLP-ShowMultimedia');
        $eXe3Dmol.setModelStyleControlVisibility(instance, true);
        // Set up state
        mOptions.showCurrentIndex = 0;
        mOptions.visiteds = 0;
        mOptions.gameStarted = true;
        mOptions.feedbackShown = false;
        mOptions.obtainedClue = false;

        // Show first model and question
        $eXe3Dmol.showModelAtIndex(0, instance);

        // Save initial score only if previous > 0 and below minimum
        const previous = parseFloat($eXe3Dmol.previousScore) || 0;
        const minScore = (1 * 10) / mOptions.selectsGame.length;
        if (previous > 0 && previous < minScore) {
            mOptions.scorerp = minScore;
            if (mOptions.isScorm > 0) {
                $eXe3Dmol.sendScore(true, instance);
            }
            $eXe3Dmol.saveEvaluation(instance);
        }

        // Navigation events
        $(`#dmolpShowPrev-${instance}`).on('click', (e) => {
            e.preventDefault();
            if (mOptions.showCurrentIndex > 0) {
                mOptions.showCurrentIndex--;
                $eXe3Dmol.showModelAtIndex(mOptions.showCurrentIndex, instance);
            }
        });

        $(`#dmolpShowNext-${instance}`).on('click', (e) => {
            e.preventDefault();
            if (mOptions.showCurrentIndex < mOptions.selectsGame.length - 1) {
                mOptions.showCurrentIndex++;
                mOptions.visiteds++;
                if (
                    mOptions.itinerary.showClue &&
                    !mOptions.obtainedClue &&
                    (mOptions.visiteds / mOptions.selectsGame.length) * 100 >= mOptions.itinerary.percentageClue
                ) {
                    $(`#dmolpShowClue-${instance}`)
                        .text(`${mOptions.msgs.msgInformation}: ${mOptions.itinerary.clueGame}`)
                        .show();
                    mOptions.obtainedClue = true;
                }
                if (mOptions.feedBack && !mOptions.feedbackShown) {
                    const visitedPct = (mOptions.visiteds / mOptions.selectsGame.length) * 100;
                    if (visitedPct >= mOptions.percentajeFB) {
                        mOptions.feedbackShown = true;
                        $(`#dmolpDivFeedBack-${instance}`)
                            .find('.dmole-feedback-game')
                            .show();
                        $(`#dmolpDivFeedBack-${instance}`).show();
                    }
                }
                $eXe3Dmol.showModelAtIndex(mOptions.showCurrentIndex, instance);
                if (mOptions.isScorm > 0) {
                    $eXe3Dmol.sendScore(true, instance);
                }
                $eXe3Dmol.saveEvaluation(instance);
            }
        });
    },

    /**
     * Get the current question object for the given instance.
     */
    getCurrentQuestion: function (instance) {
        const mOptions = $eXe3Dmol.options[instance];
        if (!mOptions || !mOptions.selectsGame) return null;
        if (mOptions.activityMode === 'show') {
            const idx = typeof mOptions.showCurrentIndex === 'number' ? mOptions.showCurrentIndex : 0;
            return mOptions.selectsGame[idx] || null;
        }
        if (typeof mOptions.activeQuestion === 'number' && mOptions.activeQuestion >= 0) {
            return mOptions.selectsGame[mOptions.activeQuestion] || null;
        }
        return null;
    },

    /**
     * Sync the background toggle button icon/state with the question's bgDark value.
     */
    syncToggleBgButton: function (question, instance) {
        if (!question) return;
        const qBgDark = !!question.bgDark;
        const $btn = $(`#dmolpToggleBg-${instance}`);
        $btn.attr('aria-pressed', qBgDark ? 'true' : 'false');
        $btn.text(qBgDark ? '🌑' : '☀');
    },

    /**
     * Sync the model style <select> dropdown to match the given question's modelStyle.
     */
    syncModelStyleSelect: function (question, instance) {
        if (!question) return;
        const mOptions = $eXe3Dmol.options[instance];
        const qStyle = $eXe3Dmol.normalizeModelStyle(question.modelStyle || mOptions.modelStyle);
        mOptions.modelStyle = qStyle;
        $(`#dmolpModelStyle-${instance}`).val(qStyle);
    },

    refreshCurrentModel: function (instance) {
        const mOptions = $eXe3Dmol.options[instance];
        if (!mOptions || !mOptions.selectsGame || !mOptions.selectsGame.length) {
            return;
        }

        if (mOptions.activityMode === 'show') {
            const showIndex =
                typeof mOptions.showCurrentIndex === 'number'
                    ? mOptions.showCurrentIndex
                    : 0;
            const showQuestion = mOptions.selectsGame[showIndex];
            if (showQuestion) {
                $eXe3Dmol.renderModel(showQuestion, instance);
            }
            return;
        }

        if (
            typeof mOptions.activeQuestion === 'number' &&
            mOptions.activeQuestion >= 0 &&
            mOptions.selectsGame[mOptions.activeQuestion]
        ) {
            $eXe3Dmol.renderModel(
                mOptions.selectsGame[mOptions.activeQuestion],
                instance
            );
            return;
        }

        if (mOptions.question) {
            $eXe3Dmol.renderModel(mOptions.question, instance);
        }
    },

    setModelStyleControlVisibility: function (instance, visible) {
        const mOptions = $eXe3Dmol.options[instance];
        // Resolve the current question index depending on activity mode
        const currentIndex = (mOptions && mOptions.activityMode === 'show')
            ? (mOptions.showCurrentIndex || 0)
            : (typeof mOptions.activeQuestion === 'number' && mOptions.activeQuestion >= 0
                ? mOptions.activeQuestion
                : 0);
        const currentQ = mOptions && mOptions.selectsGame && mOptions.selectsGame[currentIndex];
        if (currentQ && currentQ.disableCamera) {
            $(`#dmolpModelStyleControl-${instance}`).css('display', 'none');
            return;
        }
        const $content = $('#node-content');
        const isEditionPreview =
            $content.length && $content.attr('mode') === 'edition';
        const display = visible || isEditionPreview ? 'flex' : 'none';
        $(`#dmolpModelStyleControl-${instance}`).css('display', display);
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
            `dmolpGameContainer-${instance}`
        );
        if (!container) return;
        const isFullscreen = $eXe3Dmol.isContainerFullscreen(container);
        $(container).toggleClass('DMOLP-IsFullscreen', isFullscreen);
        $eXe3Dmol.applyModelViewportScale(instance);
    },

    applyModelViewportScale: function (instance) {
        const mOptions = $eXe3Dmol.options[instance];
        if (!mOptions) return;

        const scale = $eXe3Dmol.normalizeModelViewportScale(
            mOptions.modelViewportScale
        );
        const inset = (100 - scale) / 2;

        $(`#dmolpModelPreview-${instance}`).css({
            width: `${scale}%`,
            height: `${scale}%`,
            top: `${inset}%`,
            left: `${inset}%`,
        });

        $(`#dmolpCover-${instance}`).css({
            width: `${scale}%`,
            height: `${scale}%`,
            top: `${inset}%`,
            right: `${inset}%`,
            bottom: `${inset}%`,
            left: `${inset}%`,
        });

        const viewer = $eXe3Dmol.viewers[instance];
        if (viewer && viewer.resize) {
            viewer.resize();
            viewer.render();
        }
    },

    showModelAtIndex: function (index, instance) {
        const mOptions = $eXe3Dmol.options[instance],
            total = mOptions.selectsGame.length,
            question = mOptions.selectsGame[index],
            path = $eXe3Dmol.idevicePath;

        // Update counter
        $(`#dmolpShowCounter-${instance}`).text((index + 1) + ' / ' + total);

        // Update navigation button states
        const $prev = $(`#dmolpShowPrev-${instance} img`);
        const $next = $(`#dmolpShowNext-${instance} img`);
        $prev.attr('src', index === 0 ? path + 'bfafpreviousd.png' : path + 'bfafprevious.png');
        $next.attr('src', index >= total - 1 ? path + 'bfafnextd.png' : path + 'bfafnext.png');

        // Sync the style select to the current question's model style
        $eXe3Dmol.syncModelStyleSelect(question, instance);

        $eXe3Dmol.renderModel(question, instance);

        // Show optional description in presentation mode
        const description = (question.description || '').trim();
        const $desc = $(`#dmolpDescription-${instance}`);
        if (description.length > 0) {
            $desc.html(description).css('order', 22).show();
            $exeDevices.iDevice.gamification.math.updateLatex(
                `#dmolpDescription-${instance}`
            );
        } else {
            $desc.html('').hide();
        }
    },

    saveEvaluation: function (instance) {
        const mOptions = $eXe3Dmol.options[instance];
        mOptions.scorerp = $eXe3Dmol.getScoreRP(instance);

        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $eXe3Dmol.isInExe
        );
    },

    changeQuextion: function (instance, button) {
        const mOptions = $eXe3Dmol.options[instance],
            numberButton = parseInt($(button).data('number'), 10),
            letters = 'ABCD',
            letter = letters[numberButton],
            bordeColors = [
                $eXe3Dmol.borderColors.red,
                $eXe3Dmol.borderColors.blue,
                $eXe3Dmol.borderColors.green,
                $eXe3Dmol.borderColors.yellow,
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
            color: $eXe3Dmol.colors.black,
        };

        const css = type ? obj1 : obj2;

        $(button).css(css);
        $(`#dmolpAnswers-${instance} .DMOLP-AnswersOptions`).remove();

        for (let i = 0; i < mOptions.respuesta.length; i++) {
            const answerClass = `DMOLP-Answer${letters.indexOf(mOptions.respuesta[i]) + 1}`;
            $(`#dmolpAnswers-${instance}`).append(
                `<div class="DMOLP-AnswersOptions ${answerClass}"></div>`
            );
        }
    },

    getModelFormatByName: function (fileName) {
        const name = (fileName || '').toLowerCase().trim();
        if (!name || name.indexOf('.') === -1) return '';
        const ext = name.split('.').pop();
        const map = {
            pdb: 'pdb',
            sdf: 'sdf',
            mol2: 'mol2',
            xyz: 'xyz',
            cif: 'cif',
            mmcif: 'cif',
        };
        return map[ext] || '';
    },

    isWebGLAvailable: function () {
        try {
            var canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch (e) {
            return false;
        }
    },

    updateModelA11y: function (modelName, instance) {
        const msgs = $eXe3Dmol.options[instance]
            ? $eXe3Dmol.options[instance].msgs
            : {};
        const noModel = msgs.msgNoImage || 'No 3D model';
        const desc = modelName
            ? (msgs.msgTypeGame || '3D Model') + ': ' + modelName
            : noModel;
        $(`#dmolpModelPreview-${instance}`).attr('aria-label', desc);
        $(`#dmolpModelDesc-${instance}`).text(desc);
    },

    getViewer: function (instance) {
        if (!$eXe3Dmol.isWebGLAvailable()) return null;
        if (typeof $3Dmol === 'undefined' || !$3Dmol.createViewer) return null;
        const container = document.getElementById(`dmolpModelPreview-${instance}`);
        if (!container) return null;
        if (!$eXe3Dmol.viewers[instance]) {
            $eXe3Dmol.viewers[instance] = $3Dmol.createViewer(container, {
                backgroundColor: 'white',
            });
        }
        return $eXe3Dmol.viewers[instance];
    },

    destroyViewer: function (instance) {
        const viewer = $eXe3Dmol.viewers[instance];
        if (viewer) {
            try {
                if (viewer.removeAllSurfaces) viewer.removeAllSurfaces();
                if (viewer.removeAllModels) viewer.removeAllModels();
                if (viewer.removeAllShapes) viewer.removeAllShapes();
                if (viewer.removeAllLabels) viewer.removeAllLabels();
                viewer.clear();
            } catch (e) {
                // Viewer may already be in a broken state
            }
            delete $eXe3Dmol.viewers[instance];
        }
    },

    applyModelStyle: function (viewer, styleName) {
        const style = $eXe3Dmol.normalizeModelStyle(styleName);

        if (viewer.removeAllSurfaces) {
            viewer.removeAllSurfaces();
        }

        if (style === 'surface') {
            viewer.setStyle({}, { stick: { radius: 0.12, opacity: 0.35 } });
            if (
                typeof $3Dmol !== 'undefined' &&
                $3Dmol.SurfaceType &&
                viewer.addSurface
            ) {
                viewer.addSurface($3Dmol.SurfaceType.VDW, {
                    opacity: 0.85,
                    color: 'white',
                });
            }
            return;
        }

        const styleMap = {
            line: { line: {} },
            cross: { cross: {} },
            stick: { stick: {} },
            sphere: { sphere: { scale: 0.3 } },
            cartoon: { cartoon: {} },
        };

        viewer.setStyle({}, styleMap[style] || styleMap.stick);
    },

    renderModel: function (question, instance) {
        const mOptions = $eXe3Dmol.options[instance],
            $preview = $(`#dmolpModelPreview-${instance}`),
            $cover = $(`#dmolpCover-${instance}`);

        let modelData = (question.modelData || '').trim();
        let modelFormat = (question.modelFormat || '').trim().toLowerCase();
        const modelName = (question.modelName || '').trim();

        if (!modelFormat && modelName) {
            modelFormat = $eXe3Dmol.getModelFormatByName(modelName);
        }

        if (!modelData || !modelFormat) {
            $preview.hide();
            $cover.show();
            $(`#dmolpAtomLegend-${instance}`).hide();
            $eXe3Dmol.updateModelA11y('', instance);
            return;
        }

        if (!$eXe3Dmol.isWebGLAvailable()) {
            $preview.hide();
            $cover.show();
            $(`#dmolpAtomLegend-${instance}`).hide();
            $eXe3Dmol.updateModelA11y(modelName, instance);
            return;
        }

        // Ensure the viewer container has dimensions before creating/rendering.
        $preview.show();

        const viewer = $eXe3Dmol.getViewer(instance);
        if (!viewer) {
            $preview.hide();
            $cover.show();
            $(`#dmolpAtomLegend-${instance}`).hide();
            $eXe3Dmol.updateModelA11y(modelName, instance);
            return;
        }

        try {
            const qStyle = $eXe3Dmol.normalizeModelStyle(question.modelStyle || mOptions.modelStyle);
            const qBgDark = typeof question.bgDark !== 'undefined' ? !!question.bgDark : false;
            const qCameraView = question.cameraView || null;

            if (viewer.setBackgroundColor) {
                viewer.setBackgroundColor(qBgDark ? 'black' : 'white');
            }
            viewer.clear();
            viewer.addModel(modelData, modelFormat, { keepH: true });
            $eXe3Dmol.applyModelStyle(viewer, qStyle);
            viewer.zoomTo();
            if (qCameraView) {
                viewer.setView(qCameraView);
            }
            viewer.render();
            if (viewer.resize) {
                viewer.resize();
                viewer.render();
            }
            $cover.hide();
            $eXe3Dmol.updateModelA11y(modelName, instance);
            $eXe3Dmol.renderAtomLegend(viewer, question, instance);

            // Sync toggle background button to match the question's bgDark
            $eXe3Dmol.syncToggleBgButton(question, instance);

            // Apply per-question disableCamera: block/allow mouse interaction
            if (question.disableCamera) {
                $preview.css('pointer-events', 'none');
                $(`#dmolpModelStyleControl-${instance}`).css('display', 'none');
            } else {
                $preview.css('pointer-events', '');
                $eXe3Dmol.setModelStyleControlVisibility(instance, true);
            }
        } catch (error) {
            console.error(error);
            $preview.hide();
            $cover.show();
            $(`#dmolpAtomLegend-${instance}`).hide();
            $eXe3Dmol.updateModelA11y(modelName, instance);
        }
    },

    renderAtomLegend: function (viewer, question, instance) {
        const $legend = $(`#dmolpAtomLegend-${instance}`);
        if (!question.showAtomLegend) {
            $legend.hide();
            return;
        }
        const cpk = ($3Dmol && $3Dmol.elementColors && ($3Dmol.elementColors.defaultColors || $3Dmol.elementColors.Jmol)) || {};
        const atoms = viewer.selectedAtoms ? viewer.selectedAtoms({}) : [];
        const seen = new Set();
        const elements = [];
        for (const atom of atoms) {
            const elem = atom.elem;
            if (elem && !seen.has(elem)) {
                seen.add(elem);
                elements.push(elem);
            }
        }
        // Heavy atoms first (non-H), then H, then alphabetical within each group
        elements.sort((a, b) => {
            if (a === 'H' && b !== 'H') return 1;
            if (b === 'H' && a !== 'H') return -1;
            return a.localeCompare(b);
        });
        if (elements.length === 0) {
            $legend.hide();
            return;
        }
        const mOptions = $eXe3Dmol.options[instance];
        const msgs = mOptions.msgs;
        const compositionLabel = msgs.msgComposition || 'Chemical composition';

        const badges = elements.map(function (elem) {
            const color = cpk[elem] !== undefined ? cpk[elem] : 0x808080;
            const colorHex = '#' + color.toString(16).padStart(6, '0');

            const r = (color >> 16) & 0xff;
            const g = (color >> 8) & 0xff;
            const b = color & 0xff;
            const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
            const bgColor = (yiq >= 128) ? '#333333' : '#ffffff';

            return '<span class="DMOLP-AtomBadge" style="color:' + colorHex + '; background-color:' + bgColor + '">' + elem + '</span>';
        }).join('');
        $legend.html('<span>' + compositionLabel + ': </span>' + badges).show();
    },

    enterCodeAccess: function (instance) {
        const mOptions = $eXe3Dmol.options[instance],
            codeEntered = $(`#dmolpCodeAccessE-${instance}`)
                .val()
                .toLowerCase(),
            correctCode = mOptions.itinerary.codeAccess.toLowerCase();

        if (codeEntered === correctCode) {
            $eXe3Dmol.showCubiertaOptions(false, instance);
            $eXe3Dmol.startGame(instance);
            $(`#dmolpLinkMaximize-${instance}`).trigger('click');
        } else {
            $(`#dmolpMesajeAccesCodeE-${instance}`)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $(`#dmolpCodeAccessE-${instance}`).val('');
        }
    },

    showFeedBack: function (instance) {
        const mOptions = $eXe3Dmol.options[instance];
        let puntos = (mOptions.hits * 100) / mOptions.numberQuestions;
        if (mOptions.gameMode === 2 || mOptions.feedBack) {
            if (puntos >= mOptions.percentajeFB) {
                $(`#dmolpDivFeedBack-${instance}`)
                    .find('.dmole-feedback-game')
                    .show();
                $(`#dmolpDivFeedBack-${instance}`).show();
            } else {
                $eXe3Dmol.showMessage(
                    1,
                    mOptions.msgs.msgTryAgain.replace('%s', mOptions.percentajeFB),
                    instance
                );
            }
        }
    },

    showScoreGame: function (type, instance) {
        const mOptions = $eXe3Dmol.options[instance],
            msgs = mOptions.msgs,
            $histGame = $(`#dmolpHistGame-${instance}`),
            $lostGame = $(`#dmolpLostGame-${instance}`),
            $overPoint = $(`#dmolpOverScore-${instance}`),
            $overHits = $(`#dmolpOverHits-${instance}`),
            $overErrors = $(`#dmolpOverErrors-${instance}`),
            $showClue = $(`#dmolpShowClue-${instance}`),
            $gamerOver = $(`#dmolpGamerOver-${instance}`);

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

        $eXe3Dmol.showMessage(messageColor, message, instance);

        const scoreText =
            mOptions.gameMode === 0
                ? `${msgs.msgScore}: ${mOptions.score}`
                : `${msgs.msgScore}: ${mOptions.score.toFixed(2)}`;

        $overPoint.html(scoreText);
        $overHits.html(`${msgs.msgHits}: ${mOptions.hits}`);
        $overErrors.html(`${msgs.msgErrors}: ${mOptions.errors}`);

        if (mOptions.gameMode === 2) {
            $(`#dmolpGameContainer-${instance}`)
                .find('.DMOLP-DataGameScore')
                .hide();
        }

        $gamerOver.show();
    },

    startGame: function (instance) {
        const mOptions = $eXe3Dmol.options[instance];
        if (mOptions.gameStarted) return;
        $eXe3Dmol.setModelStyleControlVisibility(instance, true);
        // Per-question disableCamera is applied in renderModel per question
        $(`#dmolpShowFullScreenRow-${instance}`).hide();

        if (mOptions.questionsRandom) {
            mOptions.selectsGame =
                $exeDevices.iDevice.gamification.helpers.shuffleAds(
                    mOptions.selectsGame
                );
        }

        mOptions.scoreGame = 0;
        mOptions.obtainedClue = false;

        $(`#dmolpShowClue-${instance}`).hide();
        $(`#dmolpGameContainer-${instance} .DMOLP-StartGame`).hide();
        $(`#dmolpQuestion-${instance}`).text('');
        $(`#dmolpQuestionDiv-${instance}`).show();
        $(`#dmolpWordDiv-${instance}`).hide();

        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.gameActived = false;
        mOptions.activeQuestion = -1;
        mOptions.validQuestions = mOptions.numberQuestions;
        mOptions.counter = 0;
        mOptions.gameStarted = false;
        mOptions.livesLeft = mOptions.numberLives;

        $eXe3Dmol.updateLives(instance);
        $(`#dmolpPNumber-${instance}`).text(mOptions.numberQuestions);

        mOptions.selectsGame.forEach((question) => {
            question.answerScore = -1;
        });

        mOptions.counterClock = setInterval(() => {
            if (mOptions.gameStarted && mOptions.activeCounter) {
                let $node = $('#dmolpMainContainer-' + instance);
                let $content = $('#node-content');
                if (
                    !$node.length ||
                    ($content.length && $content.attr('mode') === 'edition')
                ) {
                    clearInterval(mOptions.counterClock);
                    return;
                }
                mOptions.counter--;
                $eXe3Dmol.updateTime(mOptions.counter, instance);

                if (mOptions.counter <= 0) {
                    mOptions.activeCounter = false;
                    let timeShowSolution = 1000;
                    if (mOptions.showSolution) {
                        timeShowSolution = mOptions.timeShowSolution * 1000;
                        if (
                            !$eXe3Dmol.sameQuestion(false, instance)
                        ) {
                            const currentQuestion =
                                mOptions.selectsGame[mOptions.activeQuestion];
                            if (currentQuestion && currentQuestion.typeSelect !== 2) {
                                $eXe3Dmol.drawSolution(instance);
                            } else if (currentQuestion) {
                                $eXe3Dmol.drawPhrase(
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
                        $eXe3Dmol.newQuestion(instance);
                    }, timeShowSolution);
                    return;
                }
            }
        }, 1000);

        $eXe3Dmol.updateTime(0, instance);
        $(`#dmolpGamerOver-${instance}`).hide();
        $(`#dmolpPHits-${instance}`).text(mOptions.hits);
        $(`#dmolpPErrors-${instance}`).text(mOptions.errors);
        $(`#dmolpPScore-${instance}`).text(mOptions.score);

        mOptions.gameStarted = true;
        $eXe3Dmol.newQuestion(instance);
    },

    updateTime: function (tiempo, instance) {
        const mTime =
            $exeDevices.iDevice.gamification.helpers.getTimeToString(tiempo);
        $(`#dmolpPTime-${instance}`).text(mTime);
    },

    gameOver: function (type, instance) {
        const mOptions = $eXe3Dmol.options[instance];
        mOptions.gameStarted = false;
        mOptions.gameActived = false;
        $eXe3Dmol.setModelStyleControlVisibility(instance, false);
        $(`#dmolpShowFullScreenRow-${instance}`).hide();
        clearInterval(mOptions.counterClock);

        // Destroy viewer and hide model preview
        $eXe3Dmol.destroyViewer(instance);
        $(`#dmolpModelPreview-${instance}`).hide();
        $(
            `#dmolpDivModeBoard-${instance}, #dmolpCover-${instance}`
        ).hide();

        $exeDevices.iDevice.gamification.media.stopSound();

        const message =
            type === 0
                ? mOptions.msgs.msgAllQuestions
                : mOptions.msgs.msgLostLives;
        $eXe3Dmol.showMessage(2, message, instance);
        $eXe3Dmol.showScoreGame(type, instance);
        $eXe3Dmol.clearQuestions(instance);
        $eXe3Dmol.updateTime(0, instance);

        $(`#dmolpPNumber-${instance}`).text('0');
        $(`#dmolpStartGame-${instance}`).text(mOptions.msgs.msgNewGame);
        $(`#dmolpGameContainer-${instance} .DMOLP-StartGame`).show();
        $(
            `#dmolpQuestionDiv-${instance}, #dmolpAnswerDiv-${instance}, #dmolpWordDiv-${instance}`
        ).hide();

        mOptions.gameOver = true;

        if (mOptions.isScorm === 1) {
            if (
                mOptions.repeatActivity ||
                $eXe3Dmol.initialScore === ''
            ) {
                const score = (
                    (mOptions.scoreGame * 10) /
                    mOptions.scoreTotal
                ).toFixed(2);
                $eXe3Dmol.sendScore(true, instance);
                $(`#dmolpRepeatActivity-${instance}`).text(
                    `${mOptions.msgs.msgYouScore}: ${score}`
                );
                $eXe3Dmol.initialScore = score;
            }
        }
        $eXe3Dmol.saveEvaluation(instance);
        $eXe3Dmol.showFeedBack(instance);
    },

    showFeedBack: function (instance) {
        const mOptions = $eXe3Dmol.options[instance];
        let puntos = (mOptions.hits * 100) / mOptions.selectsGame.length;
        if (mOptions.gameMode === 2 || mOptions.feedBack) {
            if (puntos >= mOptions.percentajeFB) {
                $(`#dmolpDivFeedBack-${instance}`)
                    .find('.dmole-feedback-game')
                    .show();
                $(`#dmolpDivFeedBack-${instance}`).show();
            } else {
                $eXe3Dmol.showMessage(
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
        const $phraseContainer = $(`#dmolpEPhrase-${instance}`);
        $phraseContainer.find('.DMOLP-Word').remove();

        $(
            `#dmolpBtnReply-${instance}, #dmolpBtnMoveOn-${instance}, #dmolpEdAnswer-${instance}`
        ).prop('disabled', true);
        $(`#dmolpQuestionDiv-${instance}`).hide();
        $(`#dmolpWordDiv-${instance}`).show();
        $(`#dmolpAnswerDiv-${instance}`).hide();

        if (!casesensitive) {
            phrase = phrase.toUpperCase();
        }

        const cPhrase = $eXe3Dmol.clear(phrase),
            letterShow = $eXe3Dmol.getShowLetter(cPhrase, nivel),
            h = cPhrase.replace(/\s/g, '&');
        let nPhrase = [];

        for (let z = 0; z < h.length; z++) {
            nPhrase.push(h[z] !== '&' && !letterShow.includes(z) ? ' ' : h[z]);
        }

        nPhrase = nPhrase.join('');
        const phraseArray = nPhrase.split('&');

        phraseArray.forEach((cleanWord) => {
            if (cleanWord !== '') {
                const $wordDiv = $('<div class="DMOLP-Word"></div>').appendTo(
                    $phraseContainer
                );
                for (let char of cleanWord) {
                    let letterClass = 'blue';
                    if (type === 1) letterClass = 'red';
                    if (type === 2) letterClass = 'green';
                    $wordDiv.append(
                        `<div class="DMOLP-Letter ${letterClass}">${char}</div>`
                    );
                }
            }
        });

        if (!solution) {
            $(`#dmolpDefinition-${instance}`).html(definition);
        }

        const htmlContent = $(`#dmolpWordDiv-${instance}`).html();
        if ($exeDevices.iDevice.gamification.math.hasLatex(htmlContent)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                `dmolpWordDiv-${instance}`
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
        const mOptions = $eXe3Dmol.options[instance],
            mQuestion = mOptions.selectsGame[i];

        $eXe3Dmol.clearQuestions(instance);
        mOptions.gameActived = true;
        mOptions.question = mQuestion;
        mOptions.respuesta = '';

        const time = $exeDevices.iDevice.gamification.helpers.getTimeToString(
            $exeDevices.iDevice.gamification.helpers.getTimeSeconds(
                mQuestion.time
            )
        );
        $(`#dmolpPTime-${instance}`).text(time);
        $(`#dmolpQuestion-${instance}`).html(mQuestion.quextion);

        // Show model cover by default and render model if available
        $(`#dmolpCover-${instance}`).show();
        $(`#dmolpModelPreview-${instance}`).hide();

        $eXe3Dmol.showMessage(0, '', instance);

        if (mOptions.answersRamdon) {
            $eXe3Dmol.ramdonOptions(instance);
        }

        $(`#dmolpPAuthor-${instance}`).text('');

        // Sync the style select to the current question's model style
        $eXe3Dmol.syncModelStyleSelect(mQuestion, instance);

        $eXe3Dmol.renderModel(mQuestion, instance);

        $(`#dmolpDivModeBoard-${instance}`).hide();

        if (mQuestion.typeSelect !== 2) {
            $eXe3Dmol.drawQuestions(instance);
        } else {
            $eXe3Dmol.drawPhrase(
                mQuestion.solutionQuestion,
                mQuestion.quextion,
                mQuestion.percentageShow,
                mQuestion.typeSelect,
                false,
                instance,
                false
            );
            $(
                `#dmolpBtnReply-${instance}, #dmolpBtnMoveOn-${instance}, #dmolpEdAnswer-${instance}`
            ).prop('disabled', false);
            $(`#dmolpEdAnswer-${instance}`).focus().val('');

            if (mOptions.modeBoard) {
                $(`#dmolpDivModeBoard-${instance}`)
                    .css('display', 'flex')
                    .fadeIn();
            }
        }

        if (mOptions.isScorm === 1) {
            if (
                mOptions.repeatActivity ||
                $eXe3Dmol.initialScore === ''
            ) {
                const score = (
                    (mOptions.scoreGame * 10) /
                    mOptions.scoreTotal
                ).toFixed(2);
                $eXe3Dmol.sendScore(true, instance);
                $(`#dmolpRepeatActivity-${instance}`).text(
                    `${mOptions.msgs.msgYouScore}: ${score}`
                );
            }
        }


        $eXe3Dmol.saveEvaluation(instance);
    },

    updateLives: function (instance) {
        const mOptions = $eXe3Dmol.options[instance];
        $(`#dmolpPLifes-${instance}`).text(mOptions.livesLeft);
        const $livesIcons = $(`#dmolpLifesGame-${instance}`).find(
            '.exeQuextIcons-Life'
        );

        if (mOptions.useLives) {
            $livesIcons.each((index, element) => {
                $(element).toggle(index < mOptions.livesLeft);
            });
        } else {
            $livesIcons.hide();
            $(`#dmolpNumberLivesGame-${instance}`).hide();
        }
    },

    newQuestion: function (instance) {
        const mOptions = $eXe3Dmol.options[instance];

        if (mOptions.useLives && mOptions.livesLeft <= 0) {
            $eXe3Dmol.gameOver(1, instance);
            return;
        }

        const mActiveQuestion =
            $eXe3Dmol.updateNumberQuestion(
                mOptions.activeQuestion,
                instance
            );

        if (mActiveQuestion === null || !mOptions.selectsGame[mActiveQuestion]) {
            $(`#dmolpPNumber-${instance}`).text('0');
            $eXe3Dmol.gameOver(0, instance);
        } else {
            mOptions.counter =
                $exeDevices.iDevice.gamification.helpers.getTimeSeconds(
                    mOptions.selectsGame[mActiveQuestion].time
                );
            $eXe3Dmol.showQuestion(mActiveQuestion, instance);
            mOptions.activeCounter = true;
            const numQ = mOptions.numberQuestions - mActiveQuestion;
            $(`#dmolpPNumber-${instance}`).text(numQ);
        }
    },

    updateNumberQuestion: function (numq, instance) {
        const mOptions = $eXe3Dmol.options[instance];
        let numActiveQuestion = numq;

        numActiveQuestion++;
        if (numActiveQuestion >= mOptions.numberQuestions) {
            return null;
        }

        mOptions.activeQuestion = numActiveQuestion;
        return numActiveQuestion;
    },

    getRetroFeedMessages: function (iHit, instance) {
        const msgs = $eXe3Dmol.options[instance].msgs,
            sMessages = iHit
                ? (msgs.msgSuccesses || 'Right! | Excellent! | Great! | Very good! | Perfect!')
                : (msgs.msgFailures || 'It was not that! | Incorrect! | Not correct! | Sorry! | Error!'),
            messagesArray = sMessages.split('|');
        return messagesArray[Math.floor(Math.random() * messagesArray.length)];
    },

    answerQuestion: function (instance) {
        const mOptions = $eXe3Dmol.options[instance],
            question = mOptions.selectsGame[mOptions.activeQuestion];

        if (!mOptions.gameActived || !question) return;

        mOptions.gameActived = false;
        let correct = true,
            solution = question.solution,
            answer = mOptions.respuesta.toUpperCase();

        if (question.typeSelect === 2) {
            solution = question.solutionQuestion.toUpperCase();
            answer = $.trim(
                $(`#dmolpEdAnswer-${instance}`).val()
            ).toUpperCase();
            if (answer.length === 0) {
                $eXe3Dmol.showMessage(
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
                $eXe3Dmol.showMessage(
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

        $eXe3Dmol.updateScore(correct, instance);

        let timeShowSolution = mOptions.showSolution
            ? mOptions.timeShowSolution * 1000
            : 1000;
        const percentageHits = (mOptions.hits / mOptions.numberQuestions) * 100;

        $(`#dmolpPHits-${instance}`).text(mOptions.hits);
        $(`#dmolpPErrors-${instance}`).text(mOptions.errors);

        if (
            mOptions.itinerary.showClue &&
            percentageHits >= mOptions.itinerary.percentageClue &&
            !mOptions.obtainedClue
        ) {
            timeShowSolution = 5000;
            $(`#dmolpShowClue-${instance}`)
                .text(
                    `${mOptions.msgs.msgInformation}: ${mOptions.itinerary.clueGame}`
                )
                .show();
            mOptions.obtainedClue = true;
        }

        if (
            mOptions.showSolution &&
            !$eXe3Dmol.sameQuestion(correct, instance)
        ) {
            if (question.typeSelect !== 2) {
                $eXe3Dmol.drawSolution(instance);
            } else {
                const mType = correct ? 2 : 1;
                $eXe3Dmol.drawPhrase(
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
            $eXe3Dmol.newQuestion(instance);
        }, timeShowSolution);
    },

    answerQuestionBoard: function (value, instance) {
        const mOptions = $eXe3Dmol.options[instance],
            question = mOptions.selectsGame[mOptions.activeQuestion];

        if (!mOptions.gameActived || !question) return;

        mOptions.gameActived = false;
        mOptions.activeCounter = false;

        $eXe3Dmol.updateScore(value, instance);

         let timeShowSolution = mOptions.showSolution
            ? mOptions.timeShowSolution * 1000
            : 1000;
        const percentageHits = (mOptions.hits / mOptions.numberQuestions) * 100;

        $(`#dmolpPHits-${instance}`).text(mOptions.hits);
        $(`#dmolpPErrors-${instance}`).text(mOptions.errors);

        if (
            mOptions.itinerary.showClue &&
            percentageHits >= mOptions.itinerary.percentageClue &&
            !mOptions.obtainedClue
        ) {
            timeShowSolution = 5000;
            $(`#dmolpShowClue-${instance}`)
                .text(
                    `${mOptions.msgs.msgInformation}: ${mOptions.itinerary.clueGame}`
                )
                .show();
            mOptions.obtainedClue = true;
        }

        if (
            mOptions.showSolution &&
            !$eXe3Dmol.sameQuestion(value, instance)
        ) {
            if (question.typeSelect !== 2) {
                $eXe3Dmol.drawSolution(instance);
            } else {
                const mType = value ? 2 : 1;
                $eXe3Dmol.drawPhrase(
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
            $eXe3Dmol.newQuestion(instance);
        }, timeShowSolution);
    },

    sameQuestion: function (correct, instance) {
        const mOptions = $eXe3Dmol.options[instance],
            q = mOptions.selectsGame[mOptions.activeQuestion];
        if (!q) return false;
        return (
            (correct && q.hits === mOptions.activeQuestion) ||
            (!correct && q.error === mOptions.activeQuestion)
        );
    },

    updateScore: function (correctAnswer, instance) {
        const mOptions = $eXe3Dmol.options[instance],
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
                    $eXe3Dmol.updateLives(instance);
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

        $(`#dmolpPScore-${instance}`).text(sscore);
        $(`#dmolpPHits-${instance}`).text(mOptions.hits);
        $(`#dmolpPErrors-${instance}`).text(mOptions.errors);

        message = $eXe3Dmol.getMessageAnswer(correctAnswer, points, instance);
        $eXe3Dmol.showMessage(type, message, instance);
    },

    getMessageAnswer: function (correctAnswer, npts, instance) {
        const mse = $eXe3Dmol.getMessageErrorAnswer(npts, instance);
        const msc = $eXe3Dmol.getMessageCorrectAnswer(npts, instance);
        return correctAnswer ? msc : mse;
    },

    getMessageCorrectAnswer: function (npts, instance) {
        const mOptions = $eXe3Dmol.options[instance],
            messageCorrect = $eXe3Dmol.getRetroFeedMessages(true, instance),
            pts = mOptions.msgs.msgPoints || 'puntos';
        const message =
                mOptions.gameMode === 2
                    ? messageCorrect
                    : `${messageCorrect} ${npts} ${pts}`;

        return message;
    },

    getMessageErrorAnswer: function (npts, instance) {
        const mOptions = $eXe3Dmol.options[instance],
            messageError = $eXe3Dmol.getRetroFeedMessages(false, instance),
            pts = mOptions.msgs.msgPoints || 'puntos';
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
                $eXe3Dmol.borderColors.red,
                $eXe3Dmol.borderColors.green,
                $eXe3Dmol.borderColors.blue,
                $eXe3Dmol.borderColors.yellow,
            ],
            mcolor = colors[type],
            weight = type === 0 ? 'normal' : 'normal';

        $(`#dmolpPAuthor-${instance}`).html(message).css({
            color: mcolor,
            'font-weight': weight,
        });

        $exeDevices.iDevice.gamification.math.updateLatex(
            `#dmolpPAuthor-${instance}`
        );
    },

    ramdonOptions: function (instance) {
        const mOptions = $eXe3Dmol.options[instance],
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
        const mOptions = $eXe3Dmol.options[instance],
            borderColors = [
                $eXe3Dmol.borderColors.red,
                $eXe3Dmol.borderColors.blue,
                $eXe3Dmol.borderColors.green,
                $eXe3Dmol.borderColors.yellow,
            ];

        $(`#dmolpQuestionDiv-${instance}`).show();
        $(`#dmolpWordDiv-${instance}`).hide();
        $(`#dmolpAnswerDiv-${instance}`).show();

        $(`#dmolpOptionsDiv-${instance} > .DMOLP-Options`).each(
            function (index) {
                const option = mOptions.question.options[index];
                $(this)
                    .css({
                        'border-color': borderColors[index],
                        'background-color': 'transparent',
                        cursor: 'pointer',
                        color: $eXe3Dmol.colors.black,
                    })
                    .html(option || '')
                    .toggle(!!option);
            }
        );

        const html = $(`#dmolpQuestionDiv-${instance}`).html();
        if ($exeDevices.iDevice.gamification.math.hasLatex(html)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                `dmolpQuestionDiv-${instance}`
            );
        }
    },

    drawSolution: function (instance) {
        const mOptions = $eXe3Dmol.options[instance],
            question = mOptions.selectsGame[mOptions.activeQuestion];

        if (!question) return;

        const solution = question.solution,
            letters = 'ABCD';

        mOptions.gameActived = false;

        $(`#dmolpOptionsDiv-${instance}`)
            .find('.DMOLP-Options')
            .each(function (i) {
                let css = {
                    'border-color': $eXe3Dmol.borderColors.incorrect,
                    'border-size': '1',
                    'background-color': 'transparent',
                    cursor: 'pointer',
                    color: $eXe3Dmol.borderColors.grey,
                };

                if (question.typeSelect === 1) {
                    css = {
                        'border-color': $eXe3Dmol.borderColors.correct,
                        'background-color': $eXe3Dmol.colors.correct,
                        'border-size': '1',
                        cursor: 'pointer',
                        color: $eXe3Dmol.borderColors.black,
                    };
                    const text = question.options[letters.indexOf(solution[i])];
                    $(this).text(text);
                } else if (solution.includes(letters[i])) {
                    css = {
                        'border-color': $eXe3Dmol.borderColors.correct,
                        'background-color': $eXe3Dmol.colors.correct,
                        'border-size': '1',
                        cursor: 'pointer',
                        color: $eXe3Dmol.borderColors.black,
                    };
                }

                $(this).css(css);
            });
    },

    clearQuestions: function (instance) {
        const mOptions = $eXe3Dmol.options[instance];
        mOptions.respuesta = '';

        $(`#dmolpAnswers-${instance} > .DMOLP-AnswersOptions`).remove();

        const borderColors = [
            $eXe3Dmol.borderColors.red,
            $eXe3Dmol.borderColors.blue,
            $eXe3Dmol.borderColors.green,
            $eXe3Dmol.borderColors.yellow,
        ];

        $(`#dmolpOptionsDiv-${instance} > .DMOLP-Options`).each(
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
    $eXe3Dmol.init();
});
