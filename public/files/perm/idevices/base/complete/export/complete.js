/* eslint-disable no-undef */
/**
 * Lock iDevice (export code)
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno, Francisco Javier Pulido
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $eXeCompleta = {
    idevicePath: '',
    borderColors: {
        black: '#1c1b1b',
        blue: '#5877c6',
        green: '#2a9315',
        red: '#ff0000',
        white: '#ffffff',
        yellow: '#f3d55a',
    },
    colors: {
        black: '#1c1b1b',
        blue: '#d5dcec',
        green: '#cce1c8',
        red: '#f7c4c4',
        white: '#ffffff',
        yellow: '#f5efd6',
    },
    image: '',
    options: {},
    msgs: '',
    hasSCORMbutton: false,
    isInExe: false,
    userName: '',
    previousScore: '',
    initialScore: '',
    isDragging: false,
    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',
    mScorm: null,
    init: function () {
        $exeDevices.iDevice.gamification.initGame(this, 'Complete', 'complete', 'completa-IDevice');
    },

    enable: function () {
        $eXeCompleta.loadGame();
    },

    loadGame: function () {
        $eXeCompleta.options = [];

        $eXeCompleta.activities.each(function (i) {
            const dl = $('.completa-DataGame', this),
                mOption = $eXeCompleta.loadDataGame(dl),
                msg = mOption.msgs.msgPlayStart;

            mOption.scorerp = 0;
            mOption.idevicePath = $eXeCompleta.idevicePath;
            mOption.main = 'cmptMainContainer-' + i;
            mOption.idevice = 'completa-IDevice';

            $eXeCompleta.options.push(mOption);
            const completa = $eXeCompleta.createInterfaceCompleta(i);
            dl.before(completa).remove();
            $('#cmptGameMinimize-' + i).hide();
            $('#cmptGameContainer-' + i).hide();

            $('#cmptMessageMaximize-' + i).text(msg);
            $('#cmptMultimedia-' + i).prepend($('.completa-text-game', this));
            $('#cmptDivFeedBack-' + i).prepend(
                $('.completa-feedback-game', this),
            );
            $('#cmptDivFeedBack-' + i).hide();
            mOption.text = $('.completa-text-game', this).html();

            $eXeCompleta.addEvents(i);

            if (mOption.showMinimize) {
                $('#cmptGameMinimize-' + i).show();
            } else {
                $('#cmptGameContainer-' + i).show();
            }
        });

        $exeDevices.iDevice.gamification.math.updateLatex(
            '.completa-IDevice',
        );
    },

    loadDataGame: function (data) {
        let json = data.text();
        json = $exeDevices.iDevice.gamification.helpers.decrypt(json);

        const mOptions =
            $exeDevices.iDevice.gamification.helpers.isJsonString(json);

        mOptions.wordsLimit =
            typeof mOptions.wordsLimit === 'undefined'
                ? false
                : mOptions.wordsLimit;
        mOptions.words = [];
        mOptions.wordsErrors = mOptions.wordsErrors || '';
        mOptions.oWords = {};
        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.obtainedClue = false;
        mOptions.gameActived = false;
        mOptions.validQuestions = mOptions.number;
        mOptions.counter = 0;
        mOptions.gameOver = false;
        mOptions.gameStarted = false;
        mOptions.evaluation =
            typeof mOptions.evaluation === 'undefined'
                ? false
                : mOptions.evaluation;
        mOptions.evaluationID =
            typeof mOptions.evaluationID === 'undefined'
                ? ''
                : mOptions.evaluationID;
        mOptions.id = typeof mOptions.id === 'undefined' ? false : mOptions.id;

        return mOptions;
    },

    createInterfaceCompleta: function (instance) {
        const path = $eXeCompleta.idevicePath,
            msgs = $eXeCompleta.options[instance].msgs,
            mOptions = $eXeCompleta.options[instance],
            html = `
        <div class="CMPT-MainContainer" id="cmptMainContainer-${instance}">
            <div class="CMPT-GameMinimize" id="cmptGameMinimize-${instance}">
                <a href="#" class="CMPT-LinkMaximize" id="cmptLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                    <img src="${path}completaIcon.png" class="CMPT-IconMinimize CMPT-Activo" alt="">
                    <div class="CMPT-MessageMaximize" id="cmptMessageMaximize-${instance}"></div>
                </a>
            </div>
            <div class="CMPT-GameContainer" id="cmptGameContainer-${instance}">
                <div class="CMPT-GameScoreBoard">
                    <div class="CMPT-GameScores">
                        <div class="exeQuextIcons exeQuextIcons-Number" title="${msgs.msgNumQuestions}"></div>
                        <p><span class="sr-av">${msgs.msgNumQuestions}: </span><span id="cmptPNumber-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                        <p><span class="sr-av">${msgs.msgHits}: </span><span id="cmptPHits-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Error" title="${msgs.msgErrors}"></div>
                        <p><span class="sr-av">${msgs.msgErrors}: </span><span id="cmptPErrors-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Score" title="${msgs.msgScore}"></div>
                        <p><span class="sr-av">${msgs.msgScore}: </span><span id="cmptPScore-${instance}">0</span></p>
                    </div>
                    <div class="CMPT-LifesGame" id="cmptLifescmpt-${instance}"></div>
                    <div class="CMPT-TimeNumber">
                        <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                        <div class="exeQuextIcons exeQuextIcons-Time" title="${msgs.msgTime}"></div>
                        <p id="cmptPTime-${instance}" class="CMPT-PTime">00:00</p>
                        <a href="#" class="CMPT-LinkMinimize" id="cmptLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                            <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Minimize CMPT-Activo"></div>
                        </a>
                        <a href="#" class="CMPT-LinkFullScreen" id="cmptLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                            <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-FullScreen CMPT-Activo" id="cmptFullScreen-${instance}"></div>
                        </a>
                    </div>
                </div>
                <div class="CMPT-ShowClue" id="cmptShowClue-${instance}">
                    <div class="sr-av">${msgs.msgClue}</div>
                    <p class="CMPT-PShowClue CMPT-parpadea" id="cmptPShowClue-${instance}"></p>
                </div>
                <div id="cmptButonsDiv-${instance}" class="CMPT-ButtonsDiv"></div>
                <div class="CMPT-Multimedia" id="cmptMultimedia-${instance}"></div>
                <div class="CMPT-Flex" id="cmptDivImgHome-${instance}">
                    <img src="${path}completaIcon.png" class="CMPT-ImagesHome" id="cmptPHome-${instance}" alt="${msgs.msgNoImage}" />
                </div>
                <div class="CMPT-StartGame"><a href="#" id="cmptStartGame-${instance}">${msgs.msgPlayStart}</a></div>
                <div id="cmptMensaje-${instance}" class="CMPT-Message"></div>
                <div class="CMPT-ButtonsDiv">
                    <button id="cmptCheckPhrase-${instance}" class="btn btn-primary" aria-label="${msgs.msgCheck}">${msgs.msgCheck}</button>
                    <button id="cmptReloadPhrase-${instance}" class="CMPT-Hide btn btn-primary" aria-label="${msgs.msgTry}">${msgs.msgTry}</button>
                </div>
                <div class="CMPT-Hide" id="cmptSolutionDiv-${instance}">
                    <p>${msgs.msgSolution}:</p>
                    <div id="cmptSolution-${instance}"></div>
                </div>                
            </div>
            <div class="CMPT-Cubierta" id="cmptCubierta-${instance}">
                <div class="CMPT-CodeAccessDiv" id="cmptCodeAccessDiv${instance}">
                    <div class="CMPT-MessageCodeAccessE" id="cmptMesajeAccesCodeE-${instance}"></div>
                    <div class="CMPT-DataCodeAccessE">
                        <label class="sr-av">${msgs.msgCodeAccess}:</label>
                        <input type="text" class="CMPT-CodeAccessE" id="cmptCodeAccessE-${instance}">
                        <a href="#" id="cmptCodeAccessButton-${instance}" title="${msgs.msgReply}">
                            <strong><span class="sr-av">${msgs.msgReply}</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Submit CMPT-Activo"></div>
                        </a>
                    </div>
                </div>
                <div class="CMPT-DivFeedBack" id="cmptDivFeedBack-${instance}">
                    <input type="button" id="cmptFeedBackClose-${instance}" value="${msgs.msgClose}" class="feedbackbutton" />
                </div>
            </div>
        </div>
        ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}
        `;
        return html;
    },

    removeEvents: function (instance) {
        const mOptions = $eXeCompleta.options[instance];

        $(`#cmptLinkMaximize-${instance}`).off('click touchstart');
        $(`#cmptLinkMinimize-${instance}`).off('click touchstart');
        $('#cmptMainContainer-' + instance)
            .closest('.idevice_node')
            .off('click', '.Games-SendScore');
        $(`#cmptCheckPhrase-${instance}`).off('click');
        $(`#cmptReloadPhrase-${instance}`).off('click');
        $(`#cmptLinkFullScreen-${instance}`).off('click touchstart');
        $(`#cmptStartGame-${instance}`).off('click');
        $(`#cmptCodeAccessButton-${instance}`).off('click touchstart');
        $(`#cmptCodeAccessE-${instance}`).off('keydown');
        $(`#cmptGameContainer-${instance}`).find('.CMPT-Input').off('keydown');
        $(`#cmptFeedBackClose-${instance}`).off('click');

        $(document).off('mousemove.eXeCompleta');
        $(document).off('mouseup.eXeCompleta');
        $(window).off('unload.eXeCompleta beforeunload.eXeCompleta');

        const gameContainer = document.querySelector(
            `#cmptGameContainer-${instance}`,
        );

        if (gameContainer) {
            if (mOptions.touchMoveHandler) {
                gameContainer.removeEventListener(
                    'touchmove',
                    mOptions.touchMoveHandler,
                    { passive: false },
                );
                mOptions.touchMoveHandler = null;
            }

            if (mOptions.touchEndHandler) {
                gameContainer.removeEventListener(
                    'touchend',
                    mOptions.touchEndHandler,
                );
                mOptions.touchEndHandler = null;
            }
        }

        $eXeCompleta.isDragging = false;
    },

    addEvents: function (instance) {
        const mOptions = $eXeCompleta.options[instance];

        $eXeCompleta.removeEvents(instance);

        $(`#cmptLinkMaximize-${instance}`).on('click touchstart', (e) => {
            e.preventDefault();
            $(`#cmptGameContainer-${instance}`).show();
            $(`#cmptGameMinimize-${instance}`).hide();
            if (!mOptions.cmptStarted) {
                $eXeCompleta.startGame(instance);
            }
            $(`#cmptSolution-${instance}`).focus();
        });

        $(`#cmptLinkMinimize-${instance}`).on('click touchstart', (e) => {
            e.preventDefault();
            $(`#cmptGameContainer-${instance}`).hide();
            $(`#cmptGameMinimize-${instance}`)
                .css('visibility', 'visible')
                .show();
        });

        $(`#cmptButonsDiv-${instance}`).hide();

        $('#cmptMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $eXeCompleta.sendScore(false, instance);
                $eXeCompleta.saveEvaluation(instance);
            });

        $eXeCompleta.loadText(instance);
        $eXeCompleta.updateGameBoard(instance);

        $(`#cmptCheckPhrase-${instance}`).on('click', (e) => {
            e.preventDefault();
            $eXeCompleta.checkPhrase(instance);
        });

        if (mOptions.time > 0) {
            $(`#cmptGameContainer-${instance}`)
                .find('.exeQuextIcons-Time')
                .show();
            $(`#cmptPTime-${instance}`).show();
        }

        $(`#cmptReloadPhrase-${instance}`).on('click', (e) => {
            e.preventDefault();
            $eXeCompleta.reloadGame(instance);
        });

        $(`#cmptLinkFullScreen-${instance}`).on('click touchstart', (e) => {
            e.preventDefault();
            const element = document.getElementById(
                `cmptGameContainer-${instance}`,
            );
            $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                element,
                instance,
            );
        });

        const html = $(`#cmptGameContainer-${instance}`).html(),
            latex = /(?:\\\(|\\\[|\\begin\{.*?})/.test(html);

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        if (latex)
            $exeDevices.iDevice.gamification.math.updateLatex(
                `cmptGameContainer-${instance}`,
            );

        $(`#cmptStartGame-${instance}`).on('click', (e) => {
            e.preventDefault();
            $eXeCompleta.startGame(instance);
        });

        $(`#cmptPTimeTitle-${instance}`).hide();
        $(`#cmptGameContainer-${instance}`).find('.exeQuextIcons-Time').hide();
        $(`#cmptPTime-${instance}`).hide();
        $(`#cmptStartGame-${instance}`).hide();
        $(`#cmptDivImgHome-${instance}`).hide();

        mOptions.gameStarted = true;

        if (mOptions.itinerary.showCodeAccess) {
            mOptions.gameStarted = false;
            $(`#cmptMesajeAccesCodeE-${instance}`).text(
                mOptions.itinerary.messageCodeAccess,
            );
            $eXeCompleta.showCubiertaOptions(0, instance);
        }

        $(`#cmptCodeAccessButton-${instance}`).on('click touchstart', (e) => {
            e.preventDefault();
            $eXeCompleta.enterCodeAccess(instance);
        });

        $(`#cmptCodeAccessE-${instance}`).on('keydown', (event) => {
            if (event.which === 13 || event.keyCode === 13) {
                $eXeCompleta.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        if (mOptions.time > 0) {
            mOptions.gameStarted = false;
            $(`#cmptGameContainer-${instance}`).find('.CMPT-ButtonsDiv').hide();
            $(`#cmptButonsDiv-${instance}`).hide();
            $(`#cmptDivImgHome-${instance}`).show();
            $(`#cmptMultimedia-${instance}`).hide();
            $(`#cmptPTimeTitle-${instance}`).show();
            $(`#cmptGameContainer-${instance}`)
                .find('.exeQuextIcons-Time')
                .show();
            $(`#cmptPTime-${instance}`).show();
            $(`#cmptStartGame-${instance}`).show();
        }

        $(`#cmptGameContainer-${instance}`)
            .find('.CMPT-Input')
            .on('keydown', (event) => {
                if (event.which === 13 || event.keyCode === 13) {
                    return false;
                }
                return true;
            });

        $(`#cmptFeedBackClose-${instance}`).on('click', () => {
            $eXeCompleta.showCubiertaOptions(false, instance);
        });

        $(`#cmptLinkMaximize-${instance}`).focus();
        $(`#cmptPShowClue-${instance}`).hide();

        $(window).on('unload.eXeCompleta beforeunload.eXeCompleta', function () {
            if (typeof $eXeCompleta.mScorm !== 'undefined') {
                $exeDevices.iDevice.gamification.scorm.endScorm(
                    $eXeCompleta.mScorm,
                );
            }
        });

        setTimeout(() => {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                this.isInExe,
            );
        }, 500);

        $(document).on('mousemove.eXeCompleta', (e) => {
            e.preventDefault();
            if (!mOptions.gameStarted || mOptions.gameOver) return;
            if (mOptions.type === 1 && $eXeCompleta.isDragging) {
                const buffer = 40,
                    scrollSpeed = 10,
                    clientY = e.clientY || (e.touches && e.touches[0].clientY);
                if (clientY < buffer) {
                    window.scrollBy(0, -scrollSpeed);
                } else if (window.innerHeight - clientY < buffer) {
                    window.scrollBy(0, scrollSpeed);
                }
            }
        });

        document
            .querySelector(`#cmptGameContainer-${instance}`)
            .addEventListener(
                'touchmove',
                (e) => {
                    if (!mOptions.gameStarted || mOptions.gameOver) return;
                    if (!e.touches || e.touches.length === 0) {
                        return;
                    }
                    const touch = e.touches[0];
                    if (mOptions.type === 1 && $eXeCompleta.isDragging) {
                        const buffer = 40,
                            scrollSpeed = 10;
                        if (touch.clientY < buffer) {
                            window.scrollBy(0, -scrollSpeed);
                        } else if (
                            window.innerHeight - touch.clientY <
                            buffer
                        ) {
                            window.scrollBy(0, scrollSpeed);
                        }
                    }
                },
                { passive: false },
            );

        $(document).on('mouseup.eXeCompleta', () => {
            $eXeCompleta.isDragging = false;
        });

        document
            .querySelector(`#cmptGameContainer-${instance}`)
            .addEventListener('touchend', () => {
                $eXeCompleta.isDragging = false;
            });
    },

    enterCodeAccess: function (instance) {
        const mOptions = $eXeCompleta.options[instance],
            codeInput = $(`#cmptCodeAccessE-${instance}`).val().toLowerCase();
        if (mOptions.itinerary.codeAccess.toLowerCase() === codeInput) {
            $eXeCompleta.showCubiertaOptions(false, instance);
            if (mOptions.time > 0) {
                $eXeCompleta.startGame(instance);
            } else {
                mOptions.gameStarted = true;
            }
            $(`#cmptLinkMaximize-${instance}`).trigger('click');
        } else {
            $(`#cmptMesajeAccesCodeE-${instance}`)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $(`#cmptCodeAccessE-${instance}`).val('');
        }
    },

    showCubiertaOptions: function (mode, instance) {
        if (mode === false) {
            $(`#cmptCubierta-${instance}`).fadeOut();
            return;
        }
        $(`#cmptCodeAccessDiv-${instance}`).hide();
        $(`#cmptDivFeedBack-${instance}`).hide();

        switch (mode) {
            case 0:
                $(`#cmptCodeAccessDiv-${instance}`).show();
                break;
            case 1:
                $(`#cmptDivFeedBack-${instance}`)
                    .find('.completa-feedback-game')
                    .show();
                $(`#cmptDivFeedBack-${instance}`).show();
                break;
            default:
                break;
        }
        $(`#cmptCubierta-${instance}`).fadeIn();
    },

    startGame: function (instance) {
        const mOptions = $eXeCompleta.options[instance];

        if (mOptions.gameStarted) return;

        $(`#cmptGameContainer-${instance}`).find('.CMPT-ButtonsDiv').fadeIn();
        $(`#cmptButonsDiv-${instance}`).hide();

        if (mOptions.type === 1) $(`#cmptButonsDiv-${instance}`).show();

        $(`#cmptMultimedia-${instance}`).fadeIn();
        $(`#cmptDivImgHome-${instance}`).hide();
        $(`#cmptPHits-${instance}`).text(mOptions.hits);
        $(`#cmptPScore-${instance}`).text(mOptions.score);
        $(`#cmptStartGame-${instance}`).hide();

        $eXeCompleta.hits = 0;
        $eXeCompleta.score = 0;

        mOptions.counter = mOptions.time * 60;
        mOptions.gameOver = false;
        mOptions.obtainedClue = false;
        mOptions.activeCounter = true;
        mOptions.gameStarted = true;

        $eXeCompleta.updateTime(mOptions.counter, instance);

        mOptions.counterClock = setInterval(function () {
            let $node = $('#cmptMainContainer-' + instance);
            let $content = $('#node-content');
            if (!$node.length || ($content.length && $content.attr('mode') === "edition")) {
                clearInterval(mOptions.counterClock);
                return;
            }
            if (mOptions.gameStarted && mOptions.activeCounter) {

                mOptions.counter--;
                $eXeCompleta.updateTime(mOptions.counter, instance);
                if (mOptions.counter <= 0) {
                    $eXeCompleta.checkPhrase(instance);
                    $eXeCompleta.gameOver(2, instance);
                }
            }
        }, 1000);
    },

    gameOver: function (type, instance) {
        const mOptions = $eXeCompleta.options[instance];
        let typem = mOptions.hits >= mOptions.errors ? 2 : 1;
        message = '';
        $(`#cmptButonsDiv-${instance}`).hide();

        clearInterval(mOptions.counterClock);

        mOptions.gameOver = true;
        mOptions.gameStarted = false;
        mOptions.activeCounter = false;
        mOptions.attempsNumber = 0;

        if (type === 2) {
            message = `${mOptions.msgs.msgEndTime}. ${mOptions.msgs.msgEndScore
                .replace('%s', mOptions.hits)
                .replace('%d', mOptions.errors)}`;
        } else if (type === 1) {
            message = `${mOptions.msgs.msgGameEnd}. ${mOptions.msgs.msgEndScore
                .replace('%s', mOptions.hits)
                .replace('%d', mOptions.errors)}`;
        }

        $eXeCompleta.showMessage(typem, message, instance);

        if (mOptions.showSolution) {
            $(`#cmptSolution-${instance}`).html(mOptions.solution);
            $(`#cmptSolutionDiv-${instance}`).show();
        }

        $eXeCompleta.showFeedBack(instance);

        const html = $(`#cmptGameContainer-${instance}`).html(),
            latex = /(?:\\\(|\\\[|\\begin\{.*?})/.test(html);

        if (latex) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                `cmptGameContainer-${instance}`,
            );
        }

        if (mOptions.itinerary.showClue) {
            const text = $(`#cmptPShowClue-${instance}`).text();
            let mclue;
            if (mOptions.obtainedClue) {
                mclue = text;
            } else {
                mclue = mOptions.msgs.msgTryAgain.replace(
                    '%s',
                    mOptions.itinerary.percentageClue,
                );
            }
            $(`#cmptPShowClue-${instance}`).text(mclue).show();
        }
    },

    reloadGame: function (instance) {
        let mOptions = $eXeCompleta.options[instance];

        $('#cmptReloadPhrase-' + instance).hide();

        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.blacks = 0;

        $eXeCompleta.showMessage(1, '', instance);
        $eXeCompleta.updateGameBoard(instance);

        $('#cmptMultimedia-' + instance)
            .find('.CMPT-Input')
            .val('');
        if (mOptions.type == 1) {
            $('#cmptMultimedia-' + instance)
                .find('.CMPT-Input')
                .addClass('CMPT-Drag');
            $eXeCompleta.createButtons(instance);
        }
        $('#cmptMultimedia-' + instance)
            .find('.CMPT-Input')
            .css({
                color: '#333333',
            });
        $('#cmptMultimedia-' + instance)
            .find('.CMPT-Input')
            .attr('disabled', false);
        $('#cmptMultimedia-' + instance)
            .find('.CMPT-Select')
            .attr('disabled', false);
        $('#cmptMultimedia-' + instance)
            .find('.CMPT-Select')
            .css({
                color: '#333333',
            });

        $('#cmptMultimedia-' + instance)
            .find('.CMPT-Select')
            .prop('selectedIndex', 0);
        if (mOptions.type == 1) {
            $eXeCompleta.getWordArrayJson(instance);
        }
        $('#cmptCheckPhrase-' + instance).show();
    },

    checkPhrase: function (instance) {
        const mOptions = $eXeCompleta.options[instance];
        if (!mOptions.gameStarted) return;

        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.blacks = 0;

        if (mOptions.type < 2) {
            $('#cmptMultimedia-' + instance)
                .find('.CMPT-Input')
                .each(function () {
                    $(this).css('color', '#000');
                    const number = parseInt($(this).data('number'), 10),
                        word = mOptions.words[number],
                        answord = $(this).val();

                    if (answord.length === 0) {
                        mOptions.errors++;
                    } else if (
                        $eXeCompleta.checkWord(word, answord, instance)
                    ) {
                        mOptions.hits++;
                        $(this).css('color', '#036354');
                    } else {
                        mOptions.errors++;
                        $(this).css('color', '#660101');
                    }
                });
        } else {
            $('#cmptMultimedia-' + instance)
                .find('.CMPT-Select')
                .each(function () {
                    $(this).css('color', '#000');
                    const number = parseInt($(this).data('number'), 10),
                        word = mOptions.words[number],
                        answord = $(this).find('option:selected').text();

                    if (answord.length === 0) {
                        mOptions.errors++;
                    } else if (
                        mOptions.wordsLimit &&
                        $eXeCompleta.checkWordLimit(word, answord, instance)
                    ) {
                        mOptions.hits++;
                        $(this).css('color', '#036354');
                    } else if (
                        !mOptions.wordsLimit &&
                        $eXeCompleta.checkWord(word, answord, instance)
                    ) {
                        mOptions.hits++;
                        $(this).css('color', '#036354');
                    } else {
                        mOptions.errors++;
                        $(this).css('color', '#660101');
                    }
                });
        }

        const type = mOptions.hits >= mOptions.errors ? 2 : 1,
            message = mOptions.msgs.msgEndScore
                .replace('%s', mOptions.hits)
                .replace('%d', mOptions.errors);

        $eXeCompleta.showMessage(type, message, instance);
        $eXeCompleta.updateGameBoard(instance);

        $('#cmptPNumber-' + instance).text(0);
        $('#cmptMultimedia-' + instance)
            .find('.CMPT-Input, .CMPT-Select')
            .attr('disabled', true);
        $('#cmptCheckPhrase-' + instance).hide();

        mOptions.attempsNumber--;
        const score = ((mOptions.hits * 10) / mOptions.number).toFixed(2);

        if (mOptions.isScorm === 1) {
            $eXeCompleta.sendScore(true, instance);
            $('#cmptRepeatActivity-' + instance).text(
                `${mOptions.msgs.msgYouScore}: ${score}`,
            );
            $eXeCompleta.initialScore = score;

        }

        const percentageHits = (mOptions.hits * 100) / mOptions.number;

        if (
            mOptions.itinerary.showClue &&
            percentageHits >= mOptions.itinerary.percentageClue
        ) {
            if (!mOptions.obtainedClue) {
                mOptions.obtainedClue = true;
                $('#cmptPShowClue-' + instance)
                    .text(
                        `${mOptions.msgs.msgInformation}: ${mOptions.itinerary.clueGame}`,
                    )
                    .show();
            }
        }

        $eXeCompleta.saveEvaluation(instance);

        if (mOptions.attempsNumber <= 0 || mOptions.hits === mOptions.number) {
            $eXeCompleta.gameOver(1, instance);
            return;
        }

        $('#cmptReloadPhrase-' + instance)
            .text(`${mOptions.msgs.msgTry} (${mOptions.attempsNumber})`)
            .show();
    },

    checkWordLimit: function (word, answord) {
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

        sWord = $.trim(sWord);
        sAnsWord = $.trim(sAnsWord);

        if (sWord.indexOf('|') === -1) {
            return sWord === sAnsWord;
        }

        const words = sWord.split('|'),
            mword = $.trim(words[0])
                .replace(/\.$/, '')
                .replace(/,$/, '')
                .replace(/;$/, '');

        return mword === sAnsWord;
    },

    checkWord: function (word, answord, instance) {
        const mOptions = $eXeCompleta.options[instance],
            proba = 1 - mOptions.percentajeError / 100;

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

        sWord = $.trim(sWord);
        sAnsWord = $.trim(sAnsWord);

        if (!mOptions.caseSensitive) {
            sWord = sWord.toLowerCase();
            sAnsWord = sAnsWord.toLowerCase();
        }

        if (sWord.indexOf('|') === -1) {
            return !mOptions.estrictCheck
                ? sWord === sAnsWord
                : $eXeCompleta.similarity(sWord, sAnsWord) >= proba;
        }

        const words = sWord.split('|');

        for (let i = 0; i < words.length; i++) {
            const mword = $.trim(words[i])
                .replace(/\.$/, '')
                .replace(/,$/, '')
                .replace(/;$/, '');

            if (
                (!mOptions.estrictCheck && mword === sAnsWord) ||
                (mOptions.estrictCheck &&
                    $eXeCompleta.similarity(mword, sAnsWord) >= proba)
            ) {
                return true;
            }
        }
        return false;
    },

    similarity: function (s1, s2) {
        let longer = s1,
            shorter = s2;

        if (s1.length < s2.length) {
            longer = s2;
            shorter = s1;
        }

        const longerLength = longer.length;

        if (longerLength === 0) {
            return 1.0;
        }

        return (
            (longerLength - $eXeCompleta.editDistance(longer, shorter)) /
            parseFloat(longerLength)
        );
    },

    editDistance: function (s1, s2) {
        s1 = s1.toLowerCase();
        s2 = s2.toLowerCase();

        const costs = [];

        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i === 0) {
                    costs[j] = j;
                } else if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                        newValue =
                            Math.min(Math.min(newValue, lastValue), costs[j]) +
                            1;
                    }
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
            if (i > 0) {
                costs[s2.length] = lastValue;
            }
        }
        return costs[s2.length];
    },

    loadText: function (instance) {
        const mOptions = $eXeCompleta.options[instance];
        let frase = mOptions.text,
            find = 0,
            inicio = true;

        mOptions.solution = frase.replace(/@@/g, '');

        while (find !== -1) {
            find = frase.indexOf('@@');
            if (find !== -1) {
                frase = inicio
                    ? frase.replace('@@', '@€')
                    : frase.replace('@@', '€@');
                inicio = !inicio;
            }
        }

        const reg = /@€([^€@]*)€@/gm;
        mOptions.text = frase.replace(reg, '#X#');

        const words = frase
            .match(reg)
            .map((word) => word.replace('@€', '').replace('€@', ''));

        mOptions.words = [...words];
        mOptions.number = mOptions.words.length;

        if (mOptions.type === 0 || mOptions.type === 1) {
            $eXeCompleta.replacePhrase(instance);
            if (mOptions.type === 1) {
                $eXeCompleta.getWordArrayJson(instance);
            }
        } else if (mOptions.type === 2) {
            $eXeCompleta.createInputSelect(instance);
        }

        $('#cmptPNumber-' + instance).text(mOptions.number);
        $('#cmptCheckPhrase-' + instance).show();
    },

    replacePhrase: function (instance) {
        const mOptions = $eXeCompleta.options[instance];
        let html = mOptions.text.trim();
        for (let i = 0; i < mOptions.words.length; i++) {
            const word = mOptions.words[i].split('|')[0].trim(),
                size = mOptions.wordsSize ? word.length : 10,
                input = `<input type="text" data-number="${i}" class="CMPT-Input CMPT-Drag" size="${size + 3}"/>`;
            html = html.replace('#X#', input);
        }
        $(`#cmptMultimedia-${instance}`).empty().append(html);
    },

    createInputSelect: function (instance) {
        const mOptions = $eXeCompleta.options[instance];
        let html = mOptions.text.trim(),
            solution = mOptions.text.trim();

        for (let i = 0; i < mOptions.words.length; i++) {
            const word = mOptions.words[i].split('|')[0].trim(),
                input = mOptions.wordsLimit
                    ? $eXeCompleta.createSelectLimit(i, instance)
                    : $eXeCompleta.createSelect(i, instance);
            solution = solution.replace('#X#', word);
            html = html.replace('#X#', input);
        }

        if (mOptions.wordsLimit) {
            mOptions.solution = solution;
        }
        $(`#cmptMultimedia-${instance}`).empty().append(html);
    },

    createSelectLimit: function (num, instance) {
        const mOptions = $eXeCompleta.options[instance],
            wordsL = mOptions.words[num].split('|');
        let wl = [];

        for (let i = 0; i < wordsL.length; i++) {
            const wd = wordsL[i].trim();
            wl.push(wd);
        }

        const unique = (value, index, self) => self.indexOf(value) === index;
        wl = wl.filter(unique);
        wl.sort();

        let s = `<select data-number="${num}" class="CMPT-Select">`;
        s += '<option val="0"></option>';
        for (let j = 0; j < wl.length; j++) {
            s += `<option val="${j + 1}">${wl[j]}</option>`;
        }
        s += '</select>';

        return s;
    },

    createSelect: function (num, instance) {
        const mOptions = $eXeCompleta.options[instance];
        let words = mOptions.wordsErrors,
            we = [],
            wp = [];

        for (let i = 0; i < mOptions.words.length; i++) {
            const wd = mOptions.words[i].split('|')[0].trim();
            wp.push(wd);
        }

        if (words.length > 0) {
            words = words.split(',');
            for (let i = 0; i < words.length; i++) {
                const p = words[i]
                    .trim()
                    .split('|')
                    .map((w) => w.trim());
                we = we.concat(p);
            }
            words = we.concat(wp);
        } else {
            words = [...wp];
        }

        const unique = (value, index, self) => self.indexOf(value) === index;
        words = words.filter(unique);
        words.sort();

        let s = `<select data-number="${num}" class="CMPT-Select">`;
        s += '<option val="0"></option>';
        for (let j = 0; j < words.length; j++) {
            s += `<option val="${j + 1}">${words[j]}</option>`;
        }
        s += '</select>';

        return s;
    },

    updateGameBoard: function (instance) {
        const mOptions = $eXeCompleta.options[instance];
        mOptions.score = (mOptions.hits * 10) / mOptions.words.length;
        const sscore =
            mOptions.score % 1 === 0
                ? mOptions.score
                : mOptions.score.toFixed(2);
        $(`#cmptPHits-${instance}`).text(mOptions.hits);
        $(`#cmptPErrors-${instance}`).text(mOptions.errors);
        $(`#cmptPNumber-${instance}`).text(mOptions.number);
        $(`#cmptPScore-${instance}`).text(sscore);
    },

    getWordArrayJson: function (instance) {
        const mOptions = $eXeCompleta.options[instance];
        let wordsa = [],
            wordsCorrect = [],
            wordsErrors = [];
        mOptions.oWords = {};

        $(`#cmptButonsDiv-${instance}`).empty();

        for (let i = 0; i < mOptions.words.length; i++) {
            const wd = mOptions.words[i].split('|')[0].trim();
            wordsCorrect.push(wd);
        }

        if (mOptions.wordsErrors.length > 0) {
            const we = mOptions.wordsErrors.split(',');
            for (let i = 0; i < we.length; i++) {
                const p = we[i]
                    .trim()
                    .split('|')
                    .map((w) => w.trim());
                wordsErrors = wordsErrors.concat(p);
            }
            wordsCorrect = wordsCorrect.concat(wordsErrors);
        }
        mOptions.oWords = {};
        wordsCorrect.sort();
        wordsa = [...wordsCorrect];
        if (mOptions.caseSensitive) {
            wordsa = wordsa.map((name) => name.toLowerCase());
        }
        wordsa.forEach((el) => {
            mOptions.oWords[el] = (mOptions.oWords[el] || 0) + 1;
        });
        $eXeCompleta.createButtons(instance);
    },

    createButtons: function (instance) {
        const mOptions = $eXeCompleta.options[instance];
        let html = '';
        for (const [key, value] of Object.entries(mOptions.oWords)) {
            const button = `<div class="CMPT-WordsButton" draggable="true" data-number="${value}">${key}
                                <div class="CMPT-WordsButtonNumber">${value}</div>
                            </div>`;
            html += button;
        }
        const $buttonsDiv = $(`#cmptButonsDiv-${instance}`);
        $buttonsDiv.empty().append(html);
        $buttonsDiv
            .find('.CMPT-WordsButton')
            .click((event) => event.preventDefault());

        const $cc = $buttonsDiv.find('.CMPT-WordsButton'),
            pc = '.CMPT-Drag';
        $cc.each(function () {
            const v = parseInt(
                $(this).find('.CMPT-WordsButtonNumber').eq(0).text(),
                10,
            );
            if (v === 1) {
                $(this).find('.CMPT-WordsButtonNumber').eq(0).hide();
            }
        });
        $cc.css('cursor', 'pointer');
        $cc.draggable({
            revert: true,
            placeholder: false,
            droptarget: pc,
            start: function () {
                if (!$(this).hasClass('CMPT-Drag')) {
                    return false;
                }
            },
            drop: function (evt, droptarget) {
                $(this).parent(pc).css('z-index', '1');
                $(this).css('z-index', '1');
                $eXeCompleta.isDragging = false;
                $eXeCompleta.moveCard($(this), droptarget, instance);
            },
        });
        $buttonsDiv.show();
    },

    moveCard: function ($item, destino) {
        if ($(destino).attr('disabled')) return;
        const $hijo = $item.find('.CMPT-WordsButtonNumber').eq(0),
            $clone = $item.clone();
        let number = parseInt($hijo.text(), 10);
        $clone.find('.CMPT-WordsButtonNumber').remove();
        const oword = $clone.text();
        $(destino).val(oword);
        number--;
        $hijo.text(number);
        if (number === 0) {
            $hijo.remove();
            $item.each(function () {
                this.style.setProperty('text-decoration', 'line-through', 'important');
            });
            $item.draggable('destroy');
        }
        $(destino).attr('disabled', true).removeClass('CMPT-Drag');
    },

    showFeedBack: function (instance) {
        const mOptions = $eXeCompleta.options[instance],
            puntos = (mOptions.hits * 100) / mOptions.number;
        if (mOptions.feedBack) {
            if (puntos >= mOptions.percentajeFB) {
                $eXeCompleta.showCubiertaOptions(1, instance);
            } else {
                $eXeCompleta.showMessage(
                    1,
                    mOptions.msgs.msgTryAgain.replace(
                        '%s',
                        mOptions.percentajeFB,
                    ),
                );
            }
        }
    },

    updateTime: function (tiempo, instance) {
        tiempo = tiempo < 0 ? 0 : tiempo;
        const mTime =
            $exeDevices.iDevice.gamification.helpers.getTimeToString(tiempo);
        $(`#cmptPTime-${instance}`).text(mTime);
    },

    getTimeToString: function (iTime) {
        const mMinutes = parseInt(iTime / 60, 10) % 60,
            mSeconds = iTime % 60,
            formattedTime = `${mMinutes < 10 ? '0' + mMinutes : mMinutes}:${mSeconds < 10 ? '0' + mSeconds : mSeconds}`;
        return formattedTime;
    },

    getRetroFeedMessages: function (iHit, instance) {
        const msgs = $eXeCompleta.options[instance].msgs,
            sMessages = (iHit ? msgs.msgSuccesses : msgs.msgFailures).split(
                '|',
            ),
            randomMessage =
                sMessages[Math.floor(Math.random() * sMessages.length)];
        return randomMessage;
    },

    showMessageAlert: function (tmsg) {
        window.alert(tmsg);
    },

    showMessage: function (type, message, instance) {
        const colors = [
            '#555555',
            $eXeCompleta.borderColors.red,
            $eXeCompleta.borderColors.green,
            $eXeCompleta.borderColors.blue,
            $eXeCompleta.borderColors.yellow,
        ],
            color = colors[type];
        $(`#cmptMensaje-${instance}`).text(message).css({
            color: color,
            'font-weight': '450',
        });
    },

    sendScore: function (auto, instance) {
        const mOptions = $eXeCompleta.options[instance];

        mOptions.scorerp = (mOptions.hits * 10) / mOptions.number;
        mOptions.previousScore = $eXeCompleta.previousScore;
        mOptions.userName = $eXeCompleta.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $eXeCompleta.previousScore = mOptions.previousScore;
    },

    saveEvaluation: function (instance) {
        const mOptions = $eXeCompleta.options[instance];
        mOptions.scorerp = (mOptions.hits * 10) / mOptions.number;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $eXeCompleta.isInExe,
        );
    },
};
$(function () {
    $eXeCompleta.init();
});

/* eslint-disable */
function factory(e) {
    'use strict';
    function t(t, o) {
        var r = this,
            n = e(t),
            a = n[0].nodeName,
            s = 'OL' == a || 'UL' == a ? 'LI' : 'DIV';
        (r.$sortable = n.data('sortable', r)),
            (r.options = e.extend(
                {},
                {
                    handle: !1,
                    container: a,
                    container_type: a,
                    same_depth: !1,
                    make_unselectable: !1,
                    nodes: s,
                    nodes_type: s,
                    placeholder_class: null,
                    auto_container_class: 'sortable_container',
                    autocreate: !1,
                    group: !1,
                    scroll: !1,
                    update: null,
                },
                o,
            )),
            r.init();
    }
    function o(t, o) {
        var r = this;
        (r.$draggable = e(t).data('draggable', r)),
            (r.options = e.extend(
                {},
                {
                    handle: !1,
                    delegate: !1,
                    revert: !1,
                    placeholder: !1,
                    droptarget: !1,
                    container: !1,
                    scroll: !1,
                    update: null,
                    drop: null,
                },
                o,
            )),
            r.init();
    }
    function r(t, o) {
        var r = this;
        (r.$droppable = e(t).data('droppable', r)),
            (r.options = e.extend(
                {},
                {
                    accept: !1,
                    drop: null,
                },
                o,
            )),
            r.init();
    }
    function n(t, o) {
        var r,
            n = e(t),
            a = null,
            s = null,
            i = null;
        function l(e) {
            return (
                'touch' ===
                (e = window.hasOwnProperty('event')
                    ? window.event
                    : e).type.substr(0, 5) &&
                (e = (e = e.hasOwnProperty('originalEvent')
                    ? e.originalEvent
                    : e).touches[0]),
                {
                    pageX: e.pageX,
                    pageY: e.pageY,
                    clientX: e.clientX,
                    clientY: e.clientY,
                    dX: s ? e.pageX - s.pageX : 0,
                    dY: s ? e.pageY - s.pageY : 0,
                }
            );
        }
        function d(e) {
            if (
                ((i = l(e)),
                    o.scroll &&
                    (function e(t) {
                        var a = n.scrollParent(),
                            s = {
                                x: t.pageX,
                                y: t.pageY,
                            },
                            i = a.offset(),
                            l = a.scrollLeft(),
                            d = a.scrollTop(),
                            c = a.width(),
                            p = a.height();
                        if ((window.clearTimeout(r), l > 0 && s.x < i.left))
                            a.scrollLeft(l - o.scrollspeed);
                        else if (
                            l < a.prop('scrollWidth') - c &&
                            s.x > i.left + c
                        )
                            a.scrollLeft(l + o.scrollspeed);
                        else if (d > 0 && s.y < i.top)
                            a.scrollTop(d - o.scrollspeed);
                        else {
                            if (
                                !(d < a.prop('scrollHeight') - p) ||
                                !(s.y > i.top + p)
                            )
                                return;
                            a.scrollTop(d + o.scrollspeed);
                        }
                        r = window.setTimeout(function () {
                            e(t);
                        }, o.scrolltimeout);
                    })(i),
                    a.trigger('dragging'),
                    o.drag)
            )
                return o.drag.call(a, e, i), !1;
        }
        function c(t) {
            return (
                window.clearTimeout(r),
                o.dragstop && o.dragstop.call(a, t, i),
                a.removeClass('dragging'),
                a.trigger('dragstop'),
                (s = !1),
                (i = !1),
                (a = !1),
                e(document).off('.dragaware'),
                !1
            );
        }
        (o = e.extend(
            {},
            {
                handle: null,
                delegate: null,
                scroll: !1,
                scrollspeed: 15,
                scrolltimeout: 50,
                dragstart: null,
                drag: null,
                dragstop: null,
            },
            o,
        )),
            n
                .addClass('dragaware')
                .on(
                    'touchstart.dragaware mousedown.dragaware',
                    o.delegate,
                    function t(r) {
                        var p = e(r.target);
                        if (
                            ((a = o.delegate ? p.closest(o.delegate) : n),
                                p.closest(o.handle || '*').length &&
                                ('touchstart' == r.type || 0 == r.button))
                        )
                            return (
                                (s = i = l(r)),
                                o.dragstart && o.dragstart.call(a, r, i),
                                a.addClass('dragging'),
                                a.trigger('dragstart'),
                                e(document)
                                    .on(
                                        'touchend.dragaware mouseup.dragaware click.dragaware',
                                        c,
                                    )
                                    .on(
                                        'touchmove.dragaware mousemove.dragaware',
                                        d,
                                    ),
                                !1
                            );
                    },
                ),
            n.on('destroy.dragaware', function () {
                n.removeClass('dragaware').off('.dragaware');
            });
    }
    function a(e) {
        this.origin = e;
    }
    return (
        (t.prototype.invoke = function (e) {
            return 'destroy' === e
                ? this.destroy()
                : 'serialize' === e
                    ? this.serialize(this.$sortable)
                    : void 0;
        }),
        (t.prototype.init = function () {
            var t,
                o,
                r,
                n = this;

            function s(r, a) {
                var s, i, l;
                if (a)
                    return (
                        (s = n.$sortable
                            .add(n.$sortable.find(n.options.container))
                            .not(r.find(n.options.container))
                            .not(t.find(n.options.container))
                            .not(n.find_nodes())),
                        n.options.same_depth &&
                        ((l = r.parent().nestingDepth('ul')),
                            (s = s.filter(function () {
                                return e(this).nestingDepth('ul') == l;
                            }))),
                        o.hide(),
                        s.each(function (t, o) {
                            var r,
                                s,
                                l,
                                d = e(n.create_placeholder()).appendTo(o),
                                c = e(o)
                                    .children(n.options.nodes)
                                    .not('.sortable_clone');
                            for (s = 0; s < c.length; s++)
                                (r = c.eq(s)),
                                    (l = n.square_dist(r.offset(), a)),
                                    (!i || i.dist > l) &&
                                    (i = {
                                        container: o,
                                        before: r[0],
                                        dist: l,
                                    });
                            d.remove();
                        }),
                        o.show(),
                        i
                    );
            }
            function i(t, o) {
                var r = e(o.container);
                o.before && o.before.closest('html')
                    ? t.insertBefore(o.before)
                    : t.appendTo(r);
            }
            n.options.make_unselectable && e('html').unselectable(),
                n.$sortable
                    .addClass('sortable')
                    .on('destroy.sortable', function () {
                        n.destroy();
                    }),
                n.$sortable.dragaware(
                    e.extend({}, n.options, {
                        delegate: n.options.nodes,
                        dragstart: function (s) {
                            var i = e(this);
                            (t = i
                                .clone()
                                .removeAttr('id')
                                .addClass('sortable_clone')
                                .css({
                                    position: 'absolute',
                                })
                                .insertAfter(i)
                                .offset(i.offset())),
                                (o = n
                                    .create_placeholder()
                                    .css({
                                        height: i.outerHeight(),
                                        width: i.outerWidth(),
                                    })
                                    .insertAfter(i)),
                                i.hide(),
                                (r = new a(t.offset())),
                                n.options.autocreate &&
                                n
                                    .find_nodes()
                                    .filter(function (t, o) {
                                        return (
                                            0 ==
                                            e(o).find(n.options.container)
                                                .length
                                        );
                                    })
                                    .append(
                                        '<' +
                                        n.options.container_type +
                                        ' class="' +
                                        n.options.auto_container_class +
                                        '"/>',
                                    );
                        },
                        drag: function (n, a) {
                            var l = e(this),
                                d = r.absolutize(a),
                                c = s(l, d);
                            t.offset(d), i(o, c);
                        },
                        dragstop: function (a, l) {
                            var d = e(this),
                                c = r.absolutize(l),
                                p = s(d, c);
                            p && i(d, p),
                                d.show(),
                                t && t.remove(),
                                o && o.remove(),
                                (t = null),
                                (o = null),
                                p &&
                                n.options.update &&
                                n.options.update.call(n.$sortable, a, n),
                                n.$sortable.trigger('update');
                        },
                    }),
                );
        }),
        (t.prototype.destroy = function () {
            this.options.make_unselectable && e('html').unselectable('destroy'),
                this.$sortable
                    .removeClass('sortable')
                    .off('.sortable')
                    .dragaware('destroy');
        }),
        (t.prototype.serialize = function (t) {
            var o = this;
            return t
                .children(o.options.nodes)
                .not(o.options.container)
                .map(function (t, r) {
                    var n = e(r),
                        a = n.clone().children().remove().end().text().trim(),
                        s = {
                            id: n.attr('id') || a,
                        };
                    return (
                        n.find(o.options.nodes).length &&
                        (s.children = o.serialize(
                            n.children(o.options.container),
                        )),
                        s
                    );
                })
                .get();
        }),
        (t.prototype.find_nodes = function () {
            return this.$sortable
                .find(this.options.nodes)
                .not(this.options.container);
        }),
        (t.prototype.create_placeholder = function () {
            return e('<' + this.options.nodes_type + '/>')
                .addClass('sortable_placeholder')
                .addClass(this.options.placeholder_class);
        }),
        (t.prototype.square_dist = function (e, t) {
            return Math.pow(t.left - e.left, 2) + Math.pow(t.top - e.top, 2);
        }),
        (o.prototype.init = function () {
            var t,
                o,
                r = this;
            function n(o) {
                var n;
                if (
                    (e('.hovering').removeClass('hovering'),
                        t.hide(),
                        (n = e(
                            document.elementFromPoint(o.clientX, o.clientY),
                        ).closest(r.options.droptarget)),
                        t.show(),
                        n.length)
                )
                    return n.addClass('hovering'), n;
            }
            r.$draggable
                .addClass('draggable')
                .on('destroy.draggable', function () {
                    r.destroy();
                }),
                r.$draggable.dragaware(
                    e.extend({}, r.options, {
                        dragstart: function (n) {
                            var s = e(this);
                            r.options.placeholder || r.options.revert
                                ? ((t = s
                                    .clone()
                                    .removeAttr('id')
                                    .addClass('draggable_clone')
                                    .css({
                                        position: 'absolute',
                                    })
                                    .appendTo(
                                        r.options.container || s.parent(),
                                    )
                                    .offset(s.offset())),
                                    r.options.placeholder || e(this).invisible())
                                : (t = s),
                                (o = new a(t.offset()));
                            $eXeCompleta.isDragging = true;
                        },
                        drag: function (e, r) {
                            n(r), t.offset(o.absolutize(r));
                        },
                        dragstop: function (a, s) {
                            $eXeCompleta.isDragging = false;
                            var i = e(this),
                                l = n(s);
                            (r.options.revert || r.options.placeholder) &&
                                (i.visible(),
                                    r.options.revert || i.offset(o.absolutize(s)),
                                    t.remove()),
                                (t = null),
                                r.options.update &&
                                r.options.update.call(i, a, r),
                                i.trigger('update'),
                                l
                                    ? (r.options.drop &&
                                        r.options.drop.call(i, a, l[0]),
                                        l.trigger('drop', [i]),
                                        l.removeClass('hovering'))
                                    : r.options.onrevert &&
                                    r.options.onrevert.call(i, a);
                        },
                    }),
                );
        }),
        (o.prototype.destroy = function () {
            this.$draggable
                .dragaware('destroy')
                .removeClass('draggable')
                .off('.draggable');
        }),
        (r.prototype.init = function () {
            var e = this;
            e.$droppable
                .addClass('droppable')
                .on('drop', function (t, o) {
                    (!e.options.accept || o.is(e.options.accept)) &&
                        e.options.drop &&
                        e.options.drop.call(e.$droppable, t, o);
                })
                .on('destroy.droppable', function () {
                    e.destroy();
                });
        }),
        (r.prototype.destroy = function () {
            this.$droppable.removeClass('droppable').off('.droppable');
        }),
        (a.prototype.absolutize = function (e) {
            return e
                ? {
                    top: this.origin.top + e.dY,
                    left: this.origin.left + e.dX,
                }
                : this.origin;
        }),
        (e.fn.sortable = function (o) {
            var r = this.not(function () {
                return (
                    e(this).is('.sortable') ||
                    e(this).closest('.sortable').length
                );
            });
            return this.data('sortable') && 'string' == typeof o
                ? this.data('sortable').invoke(o)
                : (r.length && o && o.group
                    ? new t(r, o)
                    : r.each(function (e, r) {
                        new t(r, o);
                    }),
                    this);
        }),
        (e.fn.draggable = function (e) {
            return (
                'destroy' === e
                    ? this.trigger('destroy.draggable')
                    : this.not('.draggable').each(function (t, r) {
                        new o(r, e);
                    }),
                this
            );
        }),
        (e.fn.droppable = function (e) {
            return (
                'destroy' === e
                    ? this.trigger('destroy.droppable')
                    : this.not('.droppable').each(function (t, o) {
                        new r(o, e);
                    }),
                this
            );
        }),
        (e.fn.dragaware = function (e) {
            return (
                'destroy' === e
                    ? this.trigger('destroy.dragaware')
                    : this.not('.dragaware').each(function (t, o) {
                        new n(o, e);
                    }),
                this
            );
        }),
        (e.fn.unselectable = function (e) {
            function t() {
                return !1;
            }
            return 'destroy' == e
                ? this.removeClass('unselectable')
                    .removeAttr('unselectable')
                    .off('selectstart.unselectable')
                : this.addClass('unselectable')
                    .attr('unselectable', 'on')
                    .on('selectstart.unselectable', t);
        }),
        (e.fn.invisible = function () {
            return this.css({
                visibility: 'hidden',
            });
        }),
        (e.fn.visible = function () {
            return this.css({
                visibility: 'visible',
            });
        }),
        (e.fn.scrollParent = function () {
            return this.parents()
                .addBack()
                .filter(function () {
                    var t = e(this);
                    return /(scroll|auto)/.test(
                        t.css('overflow-x') +
                        t.css('overflow-y') +
                        t.css('overflow'),
                    );
                });
        }),
        (e.fn.nestingDepth = function (e) {
            var t = this.parent().closest(e || '*');
            return t.length ? t.nestingDepth(e) + 1 : 0;
        }),
        {
            Sortable: t,
            Draggable: o,
            Droppable: r,
            Dragaware: n,
            PositionHelper: a,
        }
    );
}
'undefined' != typeof define
    ? define(['jquery'], factory)
    : factory(jQuery, factory);
