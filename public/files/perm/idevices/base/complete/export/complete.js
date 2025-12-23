/* eslint-disable no-undef */
/**
 * Complete iDevice (export code)
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
        $exeDevices.iDevice.gamification.initGame(
            this,
            'Complete',
            'complete',
            'completa-IDevice'
        );
    },

    enable: function () {
        $eXeCompleta.loadGame();
    },

    loadGame: function () {
        $eXeCompleta.options = [];

        $eXeCompleta.activities.each(function (i) {
            const dl = $('.completa-DataGame', this),
                $imageBack = $('.completa-LinkBack', this),
                mOption = $eXeCompleta.loadDataGame(dl),
                msg = mOption.msgs.msgPlayStart;

            mOption.scorerp = 0;
            mOption.idevicePath = $eXeCompleta.idevicePath;
            mOption.main = 'cmptMainContainer-' + i;
            mOption.idevice = 'completa-IDevice';

            if ($imageBack.length == 1) {
                mOption.urlBack = $imageBack.attr('href') || '';
            }
            mOption.urlBack =
                mOption.urlBack.length < 4
                    ? `${mOption.idevicePath}cmptbackground.png`
                    : mOption.urlBack;

            $eXeCompleta.options.push(mOption);
            const completa = $eXeCompleta.createInterfaceCompleta(i);
            dl.before(completa).remove();
            $('#cmptGameMinimize-' + i).hide();
            $('#cmptGameContainer-' + i).hide();

            $('#cmptMessageMaximize-' + i).text(msg);
            $('#cmptMultimedia-' + i).prepend($('.completa-text-game', this));
            $('#cmptDivFeedBack-' + i).prepend(
                $('.completa-feedback-game', this)
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

        $exeDevices.iDevice.gamification.math.updateLatex('.completa-IDevice');
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
        mOptions.hasBack =
            typeof mOptions.hasBack === 'undefined' ? false : mOptions.hasBack;
        mOptions.urlBack =
            typeof mOptions.urlBack === 'undefined' ? '' : mOptions.urlBack;
        mOptions.authorBackImage =
            typeof mOptions.authorBackImage === 'undefined'
                ? ''
                : mOptions.authorBackImage;
        mOptions.fontColor =
            typeof mOptions.fontColor === 'undefined' ? '' : mOptions.fontColor;

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
                <div id="cmptAuthorBackImage-${instance}" class="CMPT-AuthorBackImage"></div>
            </div>
            <div class="CMPT-Cubierta" id="cmptCubierta-${instance}">
                <div class="CMPT-CodeAccessDiv" id="cmptCodeAccessDiv${instance}">
                    <div class="CMPT-MessageCodeAccessE" id="cmptMesajeAccesCodeE-${instance}"></div>
                    <div class="CMPT-DataCodeAccessE">
                        <label class="sr-av">${msgs.msgCodeAccess}:</label>
                        <input type="text" class="CMPT-CodeAccessE form-control" id="cmptCodeAccessE-${instance}">
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
            `#cmptGameContainer-${instance}`
        );

        if (gameContainer) {
            if (mOptions.touchMoveHandler) {
                gameContainer.removeEventListener(
                    'touchmove',
                    mOptions.touchMoveHandler,
                    { passive: false }
                );
                mOptions.touchMoveHandler = null;
            }

            if (mOptions.touchEndHandler) {
                gameContainer.removeEventListener(
                    'touchend',
                    mOptions.touchEndHandler
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
                `cmptGameContainer-${instance}`
            );
            $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                element,
                instance
            );
        });

        const html = $(`#cmptGameContainer-${instance}`).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        if (latex)
            $exeDevices.iDevice.gamification.math.updateLatex(
                `cmptGameContainer-${instance}`
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
                mOptions.itinerary.messageCodeAccess
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

        $(window).on(
            'unload.eXeCompleta beforeunload.eXeCompleta',
            function () {
                if (typeof $eXeCompleta.mScorm !== 'undefined') {
                    $exeDevices.iDevice.gamification.scorm.endScorm(
                        $eXeCompleta.mScorm
                    );
                }
            }
        );

        setTimeout(() => {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                this.isInExe
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
                { passive: false }
            );

        $(document).on('mouseup.eXeCompleta', () => {
            $eXeCompleta.isDragging = false;
        });

        document
            .querySelector(`#cmptGameContainer-${instance}`)
            .addEventListener('touchend', () => {
                $eXeCompleta.isDragging = false;
            });

        if (mOptions.hasBack) {
            const backgroundUrl =
                mOptions.urlBack.length < 4
                    ? `${mOptions.idevicePath}cmptbackground.png`
                    : mOptions.urlBack;

            const $container = $(`#cmptGameContainer-${instance}`);
            $container.addClass('has-background');

            const style = document.createElement('style');
            style.textContent = `
                #cmptGameContainer-${instance}.has-background::before {
                    background-image: url(${backgroundUrl});
                }
            `;
            document.head.appendChild(style);

            if (mOptions.fontColor && mOptions.fontColor.length > 0) {
                $(`#cmptMultimedia-${instance} p`).css(
                    'color',
                    mOptions.fontColor
                );
            }

            if (mOptions.authorBackImage.length > 0) {
                $(`#cmptAuthorBackImage-${instance}`)
                    .text(mOptions.authorBackImage)
                    .show();
            }
        }
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
            if (
                !$node.length ||
                ($content.length && $content.attr('mode') === 'edition')
            ) {
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
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);

        if (latex) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                `cmptGameContainer-${instance}`
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
                    mOptions.itinerary.percentageClue
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
                `${mOptions.msgs.msgYouScore}: ${score}`
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
                        `${mOptions.msgs.msgInformation}: ${mOptions.itinerary.clueGame}`
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
            const button = `<div class="CMPT-WordsButton" data-word="${key}" data-number="${value}">${key}
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
                10
            );
            if (v === 1) {
                $(this).find('.CMPT-WordsButtonNumber').eq(0).hide();
            }
        });
        $cc.css('cursor', 'pointer');
        $cc.draggable({
            helper: 'clone',
            appendTo: 'body',
            zIndex: 10000,
            revert: 'invalid',
            start: function () {
                $eXeCompleta.isDragging = true;
            },
            stop: function () {
                $eXeCompleta.isDragging = false;
            },
        });

        $(`#cmptMultimedia-${instance}`)
            .find('.CMPT-Input.CMPT-Drag')
            .droppable({
                accept: function (draggable) {
                    return (
                        draggable.hasClass('CMPT-WordsButton') ||
                        draggable.is('input.CMPT-Input')
                    );
                },
                tolerance: 'pointer',
                hoverClass: 'hovering',
                drop: function (event, ui) {
                    const $target = $(this);
                    if (
                        ui.draggable.is('input.CMPT-Input') &&
                        ui.draggable[0] === $target[0]
                    )
                        return;
                    $eXeCompleta.moveCard(ui.draggable, $target, instance);
                },
            });
        $buttonsDiv.show();
    },

    moveCard: function ($item, $destino, instance) {
        const mOptions = $eXeCompleta.options[instance];
        if (!mOptions.gameStarted || mOptions.gameOver) return;
        if ($destino.is(':disabled')) return;

        const fromInput = $item.is('input.CMPT-Input');

        let incoming = '';
        if (fromInput) {
            incoming = $.trim($item.val());
            if (!incoming) return;
        } else {
            const $clone = $item.clone();
            $clone.find('.CMPT-WordsButtonNumber').remove();
            incoming = $.trim($clone.text());
        }

        const prev = $.trim($destino.val());

        if (prev) {
            const $buttonsDiv = $(`#cmptButonsDiv-${instance}`);
            let $btn = $buttonsDiv
                .find(
                    `.CMPT-WordsButton[data-word="${prev.replace(/"/g, '\\"')}"]`
                )
                .first();
            if ($btn.length === 0) {
                $btn = $buttonsDiv
                    .find('.CMPT-WordsButton')
                    .filter(function () {
                        const $c = $(this).clone();
                        $c.find('.CMPT-WordsButtonNumber').remove();
                        return $.trim($c.text()) === prev;
                    })
                    .first();
            }
            if ($btn.length) {
                let $num = $btn.find('.CMPT-WordsButtonNumber').eq(0);
                if ($num.length) {
                    const n = parseInt($num.text(), 10) + 1;
                    $num.text(n);
                    if (n === 1) {
                        $num.hide();
                    } else {
                        $num.show();
                    }
                } else {
                    $btn.each(function () {
                        this.style.removeProperty('text-decoration');
                    });
                    $btn.append(`<div class="CMPT-WordsButtonNumber">1</div>`);
                    $btn.find('.CMPT-WordsButtonNumber').eq(0).hide();
                    try {
                        $btn.draggable('destroy');
                    } catch (e) {}
                    $btn.draggable({
                        helper: 'clone',
                        appendTo: 'body',
                        zIndex: 10000,
                        revert: 'invalid',
                        start: function () {
                            $eXeCompleta.isDragging = true;
                        },
                        stop: function () {
                            $eXeCompleta.isDragging = false;
                        },
                    });
                }
            }
        }

        $destino.val(incoming);
        $destino.prop('readonly', true).addClass('CMPT-Drag');
        $destino.addClass('CMPT-Filled');
        try {
            $destino.draggable('destroy');
        } catch (e) {}
        $destino.draggable({
            helper: 'clone',
            appendTo: 'body',
            zIndex: 10000,
            revert: 'invalid',
            cancel: '',
            start: function () {
                $eXeCompleta.isDragging = true;
            },
            stop: function () {
                $eXeCompleta.isDragging = false;
            },
        });

        if (fromInput) {
            $item.val('');
            $item.prop('readonly', false).removeClass('CMPT-Filled');
            setTimeout(function () {
                $item.val('');
                $item.prop('readonly', false).removeClass('CMPT-Filled');
                try {
                    $item.draggable('destroy');
                } catch (e) {}
                $item.trigger('change');
            }, 0);
            try {
                $item.draggable('destroy');
            } catch (e) {}
        } else {
            const $numIn = $item.find('.CMPT-WordsButtonNumber').eq(0);
            if ($numIn.length) {
                let count = parseInt($numIn.text(), 10) - 1;
                $numIn.text(count);
                if (count <= 0) {
                    $numIn.remove();
                    $item.each(function () {
                        this.style.setProperty(
                            'text-decoration',
                            'line-through',
                            'important'
                        );
                    });
                    try {
                        $item.draggable('destroy');
                    } catch (e) {}
                } else if (count === 1) {
                    $numIn.hide();
                } else {
                    $numIn.show();
                }
            }
        }
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
                        mOptions.percentajeFB
                    )
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
                '|'
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
            $eXeCompleta.isInExe
        );
    },
};
$(function () {
    $eXeCompleta.init();
});
