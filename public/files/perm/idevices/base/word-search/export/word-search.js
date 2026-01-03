/* eslint-disable no-undef */
/**
 * Sopa activity (Export)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 *
 */

var $eXeSopa = {
    idevicePath: '',
    borderColors: {
        black: '#1c1b1b',
        blue: '#3a518b',
        green: '#036354',
        red: '#660101',
        white: '#ffffff',
        yellow: '#f3d55a',
    },
    colors: {
        black: '#1c1b1b',
        blue: '#dfe3f1',
        green: '#caede8',
        red: '#fbd2d6',
        white: '#ffffff',
        yellow: '#fcf4d3',
    },
    instances: [],
    hasSCORMbutton: false,
    isInExe: false,
    userName: '',
    previousScore: '',
    initialScore: '',
    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',
    mScorm: null,

    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            'Word search',
            'word-search',
            'sopa-IDevice'
        );
    },

    enable: function () {
        $eXeSopa.loadGame();
    },

    loadGame: function () {
        $eXeSopa.activities.each(function (i) {
            let version = $('.sopa-version', this).eq(0).text(),
                dl = $('.sopa-DataGame', this),
                imagesLink = $('.sopa-LinkImages', this),
                audioLink = $('.sopa-LinkAudios', this),
                mOption = $eXeSopa.loadDataGame(
                    dl,
                    imagesLink,
                    audioLink,
                    version
                ),
                msg = mOption.msgs.msgPlayStart;

            mOption.scorerp = 0;
            mOption.idevicePath = $eXeSopa.idevicePath;
            mOption.instanceId = i;
            mOption.main = 'sopaMainContainer-' + i;
            mOption.idevice = 'sopa-IDevice';
            mOption.hits = 0;
            mOption.score = 0;
            mOption.game = null;
            mOption.optionsPuzzle = {};

            // Configurar orientaciones del puzzle
            let ors = ['horizontal', 'vertical'];
            if (mOption.reverses && mOption.diagonals) {
                ors = [
                    'horizontal',
                    'vertical',
                    'horizontalBack',
                    'verticalUp',
                    'diagonal',
                    'diagonalUp',
                    'diagonalBack',
                    'diagonalUpBack',
                ];
            } else if (mOption.diagonals) {
                ors = ['horizontal', 'vertical', 'diagonal', 'diagonalUp'];
            } else if (mOption.reverses) {
                ors = [
                    'horizontal',
                    'vertical',
                    'horizontalBack',
                    'verticalUp',
                ];
            }
            mOption.optionsPuzzle.orientations = ors;

            // Guardar instancia
            $eXeSopa.instances[i] = mOption;

            const sopa = $eXeSopa.createInterfaceSopa(i);

            dl.before(sopa).remove();

            const $container = $('#sopaMainContainer-' + i);
            $container.find('#sopaGameMinimize-' + i).hide();
            $container.find('#sopaGameContainer-' + i).hide();
            if (mOption.showMinimize) {
                $container
                    .find('#sopaGameMinimize-' + i)
                    .css({
                        cursor: 'pointer',
                    })
                    .show();
            } else {
                $container.find('#sopaGameContainer-' + i).show();
            }
            $container.find('#sopaDivFeedBack-' + i).hide();
            $container.find('#sopaMessageMaximize-' + i).text(msg);
            $container
                .find('#sopaDivFeedBack-' + i)
                .prepend($('.sopa-feedback-game', this));

            $eXeSopa.addEvents(i);

            // Agregar palabras
            for (let j = 0; j < mOption.wordsGame.length; j++) {
                let word = mOption.wordsGame[j].word,
                    definition = mOption.wordsGame[j].definition,
                    image = mOption.wordsGame[j].url.length > 4,
                    audio = mOption.wordsGame[j].audio.length > 4;
                WordFindGame.append(
                    $container.find('#sopaWords-' + i),
                    word,
                    definition,
                    j,
                    image,
                    audio
                );
            }

            $eXeSopa.recreatePuzzle(i);

            $container.show();
        });

        var sopaHtml = $('.sopa-IDevice').html();
        if ($exeDevices.iDevice.gamification.math.hasLatex(sopaHtml)) {
            $exeDevices.iDevice.gamification.math.updateLatex('.sopa-IDevice');
        }
    },

    recreatePuzzle: function (instanceId) {
        const mOptions = $eXeSopa.instances[instanceId];
        const puzzleSelector = '#sopaPuzzle-' + instanceId;
        const $container = $('#sopaMainContainer-' + instanceId);

        let attempts = 0;
        const maxRetries = 3; // Número de palabras a eliminar si es necesario

        while (attempts <= maxRetries) {
            try {
                mOptions.game = new WordFindGame(puzzleSelector, {
                    maxGridGrowth: 10,
                    maxAttempts: 100,
                    orientations: mOptions.optionsPuzzle,
                    instanceId: instanceId,
                });

                // Si tiene éxito, salir del bucle
                if (window.game) window.game = mOptions.game;

                // Si se eliminaron palabras, solo mostrar en consola (no en pantalla)
                if (attempts > 0) {
                    console.info(
                        `Sopa de letras generada exitosamente después de eliminar ${attempts} palabra(s).`
                    );
                }
                return;
            } catch (error) {
                attempts++;

                if (attempts > maxRetries) {
                    // Ya no hay más intentos, mostrar error
                    $container
                        .find('#sopaMessage-' + instanceId)
                        .text(
                            mOptions.msgs.msgManyWord ||
                                'No se pudo generar la sopa de letras. Intenta con menos palabras o palabras más cortas.'
                        )
                        .css({
                            color: 'red',
                        });
                    $container.find('#sopaMultimedia-' + instanceId).hide();
                    $container.find('#sopaResolve-' + instanceId).hide();
                    console.error(
                        'Error al generar sopa de letras después de ' +
                            maxRetries +
                            ' intentos:',
                        error
                    );
                    return;
                }

                // Encontrar y eliminar la palabra más larga del wordsGame
                const longestWordIndex = mOptions.wordsGame.reduce(
                    (maxIdx, word, idx, arr) =>
                        word.word.length > arr[maxIdx].word.length
                            ? idx
                            : maxIdx,
                    0
                );

                const removedWord = mOptions.wordsGame[longestWordIndex].word;
                mOptions.wordsGame.splice(longestWordIndex, 1);

                console.warn(
                    `Intento ${attempts}: Eliminada palabra "${removedWord}" (${removedWord.length} letras). Quedan ${mOptions.wordsGame.length} palabras. Reintentando...`
                );

                // Actualizar la lista de palabras en el DOM antes de reintentar
                $container.find('#sopaWords-' + instanceId).empty();
                for (let j = 0; j < mOptions.wordsGame.length; j++) {
                    let word = mOptions.wordsGame[j].word,
                        definition = mOptions.wordsGame[j].definition,
                        image = mOptions.wordsGame[j].url.length > 4,
                        audio = mOptions.wordsGame[j].audio.length > 4;
                    WordFindGame.append(
                        $container.find('#sopaWords-' + instanceId),
                        word,
                        definition,
                        j,
                        image,
                        audio
                    );
                }
            }
        }
    },

    loadDataGame: function (data, imgsLink, audioLink, version) {
        let json = data.text();
        version =
            typeof version == 'undefined' || version == ''
                ? 0
                : parseInt(version);

        if (version > 0)
            json = $exeDevices.iDevice.gamification.helpers.decrypt(json);

        let mOptions =
            $exeDevices.iDevice.gamification.helpers.isJsonString(json);

        mOptions.percentajeQuestions =
            typeof mOptions.percentajeQuestions != 'undefined'
                ? mOptions.percentajeQuestions
                : 100;
        for (let i = 0; i < mOptions.wordsGame.length; i++) {
            let p = mOptions.wordsGame[i];
            p.url = $exeDevices.iDevice.gamification.media.extractURLGD(p.url);
        }

        mOptions.playerAudio = '';
        mOptions.percentajeFB =
            typeof mOptions.percentajeFB != 'undefined'
                ? mOptions.percentajeFB
                : 100;
        mOptions.gameOver = false;
        mOptions.obtainedClue = false;
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
            if (!isNaN(iq) && iq < mOptions.wordsGame.length) {
                mOptions.wordsGame[iq].url = $(this).attr('href');
                if (mOptions.wordsGame[iq].url.length < 4) {
                    mOptions.wordsGame[iq].url = '';
                }
            }
        });

        audioLink.each(function () {
            const iq = parseInt($(this).text());
            if (!isNaN(iq) && iq < mOptions.wordsGame.length) {
                mOptions.wordsGame[iq].audio = $(this).attr('href');
                if (mOptions.wordsGame[iq].audio.length < 4) {
                    mOptions.wordsGame[iq].audio = '';
                }
            }
        });

        mOptions.wordsGame =
            $exeDevices.iDevice.gamification.helpers.getQuestions(
                mOptions.wordsGame,
                mOptions.percentajeQuestions
            );
        mOptions.numberQuestions = mOptions.wordsGame.length;

        return mOptions;
    },

    createInterfaceSopa: function (instanceId) {
        const path = $eXeSopa.idevicePath,
            mOptions = $eXeSopa.instances[instanceId],
            msgs = mOptions.msgs,
            html = `
        <div class="SPP-MainContainer" id="sopaMainContainer-${instanceId}" data-instance="${instanceId}">
            <div class="SPP-GameMinimize" id="sopaGameMinimize-${instanceId}">
                <a href="#" class="SPP-LinkMaximize" id="sopaLinkMaximize-${instanceId}" title="${msgs.msgMaximize}">
                    <img src="${path}sopaIcon.png" class="SPP-IconMinimize SPP-Activo" alt="">
                    <div class="SPP-MessageMaximize" id="sopaMessageMaximize-${instanceId}"></div>
                </a>
            </div>
            <div class="SPP-GameContainer" id="sopaGameContainer-${instanceId}">
                <div class="SPP-GameScoreBoard" id="sopaGameScoreBoard-${instanceId}">
                    <div class="SPP-GameScores">
                        <div class="exeQuextIcons exeQuextIcons-Number" title="${msgs.msgNumQuestions}"></div>
                        <p><span class="sr-av">${msgs.msgNumQuestions}: </span><span id="sopaPNumber-${instanceId}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                        <p><span class="sr-av">${msgs.msgHits}: </span><span id="sopaPHits-${instanceId}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Score" title="${msgs.msgScore}"></div>
                        <p><span class="sr-av">${msgs.msgScore}: </span><span id="sopaPScore-${instanceId}">0</span></p>
                    </div>
                    <div class="SPP-LifesGame" id="sopaLifesSopa-${instanceId}"></div>
                    <div class="SPP-TimeNumber">
                        <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                        <div class="exeQuextIcons exeQuextIcons-Time" title="${msgs.msgTime}"></div>
                        <p id="sopaPTime-${instanceId}" class="SPP-PTime">00:00</p>
                        <a href="#" class="SPP-LinkMinimize" id="sopaLinkMinimize-${instanceId}" title="${msgs.msgMinimize}">
                            <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Minimize SPP-Activo"></div>
                        </a>
                        <a href="#" class="SPP-LinkFullScreen" id="sopaLinkFullScreen-${instanceId}" title="${msgs.msgFullScreen}">
                            <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-FullScreen SPP-Activo" id="sopaFullScreen-${instanceId}"></div>
                        </a>
                    </div>
                </div>
                <div class="SPP-ShowClue" id="sopaShowClue-${instanceId}">
                    <div class="sr-av">${msgs.msgClue}</div>
                    <p class="SPP-PShowClue SPP-parpadea" id="sopaPShowClue-${instanceId}"></p>
                </div>
                <div class="SPP-Flex" id="sopaDivImgHome-${instanceId}">
                    <img src="${path}sopaIcon.png" class="SPP-ImagesHome" id="sopaPHome-${instanceId}" alt="${msgs.msgNoImage}" />
                </div>
                <div class="SPP-StartGame"><a href="#" id="sopaStartGame-${instanceId}">${msgs.msgPlayStart}</a></div>
                <div class="SPP-Message" id="sopaMessage-${instanceId}"></div>
                <div class="SPP-Multimedia" id="sopaMultimedia-${instanceId}">
                    <div id="sopaPuzzle-${instanceId}" class="SPP-Puzzle"></div>
                    <ul id="sopaWords-${instanceId}" class="SPP-Words"></ul>
                </div>
                 <div class="SPP-ResolveDiv ">
                    <button class="btn btn-primary" id="sopaResolve-${instanceId}">${msgs.msgEnd}</button>
                 </div>
                <div class="SPP-Cubierta" id="sopaCubierta-${instanceId}">
                    <div class="SPP-CodeAccessDiv" id="sopaCodeAccessDiv-${instanceId}">
                        <div class="SPP-MessageCodeAccessE" id="sopaMesajeAccesCodeE-${instanceId}"></div>
                        <div class="SPP-DataCodeAccessE">
                            <label class="sr-av">${msgs.msgCodeAccess}:</label>
                            <input type="text" class="SPP-CodeAccessE form-control" id="sopaCodeAccessE-${instanceId}">
                            <a href="#" id="sopaCodeAccessButton-${instanceId}" title="${msgs.msgReply}">
                                <strong><span class="sr-av">${msgs.msgReply}</span></strong>
                                <div class="exeQuextIcons exeQuextIcons-Submit SPP-Activo"></div>
                            </a>
                        </div>
                        </div>
                    <div class="SPP-DivFeedBack" id="sopaDivFeedBack-${instanceId}">
                        <input type="button" id="sopaFeedBackClose-${instanceId}" value="${msgs.msgClose}" class="feedbackbutton" />
                    </div>
                        ${this.getDetailMedia(instanceId)}
                </div>
            </div>
        </div>
       ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}`;
        return html;
    },

    showCubiertaOptions(mode, instanceId) {
        const $container = $('#sopaMainContainer-' + instanceId);
        const $cubierta = $container.find('#sopaCubierta-' + instanceId);
        const $gameContainer = $container.find(
            '#sopaGameContainer-' + instanceId
        );

        if (mode === false) {
            $cubierta.fadeOut(function () {
                $gameContainer.css('height', 'auto');
                $container.css('height', 'auto');
            });
            return;
        }

        $container.find('#sopaCodeAccessDiv-' + instanceId).hide();
        $container.find('#sopaDivFeedBack-' + instanceId).hide();
        $container.find('#sopaMFDetails-' + instanceId).hide();
        switch (mode) {
            case 0:
                $container.find('#sopaCodeAccessDiv-' + instanceId).show();
                break;
            case 1:
                $container
                    .find('#sopaDivFeedBack-' + instanceId)
                    .find('.sopa-feedback-game')
                    .show();
                $container.find('#sopaDivFeedBack-' + instanceId).show();
                break;
            case 2:
                $container.find('#sopaMFDetails-' + instanceId).show();
                setTimeout(function () {
                    const max = Math.max(
                        $container
                            .find('#sopaMFDetails-' + instanceId)
                            .innerHeight() + 50,
                        $gameContainer.innerHeight() + 50
                    );
                    $cubierta.height(max);
                }, 0);
                break;
            default:
                break;
        }
        $cubierta.fadeIn(function () {
            const max = Math.max(
                $cubierta.innerHeight(),
                $gameContainer.innerHeight()
            );
            $gameContainer.height(max);
            $container.height(
                max +
                    $container.find('.SSP-GameScoreBoard').eq(0).innerHeight() +
                    $container.find('.SSP-ShowClue').eq(0).innerHeight() +
                    30
            );
        });
    },

    getDetailMedia: function (instanceId) {
        const msgs = $eXeSopa.instances[instanceId].msgs,
            html = `
            <div class="SPP-Detail" id="sopaMFDetails-${instanceId}">
                <div class="SPP-Flex">
                    <a href="#" class="SPP-LinkClose" id="sopaMLinkClose1-${instanceId}" title="${msgs.msgClose}">
                        <strong class="sr-av">${msgs.msgClose}:</strong>
                        <div class="SPP-IconsToolBar exeQuextIcons-CWGame SPP-Activo"></div>
                    </a>
                </div>
                <div class="SPP-MultimediaPoint" id="sopaMMultimediaPoint-${instanceId}">
                    <img class="SPP-Images" id="sopaMImagePoint-${instanceId}" alt="${msgs.msgNoImage}" />
                    <img class="SPP-Cursor" id="sopaMCursor-${instanceId}" src="${$eXeSopa.idevicePath}exequextcursor.gif" alt="" />
                    <a href="#" class="SPP-FullLinkImage" id="sopaFullLinkImage-${instanceId}" title="${msgs.msgFullScreen}">
                        <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                        <div class="exeQuextIcons exeQuextIcons-FullImage SPP-Activo"></div>
                    </a>
                </div>
                <div class="SPP-AuthorPoint" id="sopaMAuthorPoint-${instanceId}"></div>
                <div class="SPP-Footer" id="sopaMFooterPoint-${instanceId}"></div>
            </div>
        `;
        return html;
    },

    startGame: function (instanceId) {
        let mOptions = $eXeSopa.instances[instanceId];
        const $container = $('#sopaMainContainer-' + instanceId);

        if (mOptions.gameStarted) return;
        if (mOptions.showResolve) {
            $container.find('#sopaResolve-' + instanceId).show();
        }
        $container.find('#sopaMessage-' + instanceId).fadeIn();
        $container.find('#sopaMultimedia-' + instanceId).fadeIn();
        $container.find('#sopaDivImgHome-' + instanceId).hide();
        $container.find('#sopaPHits-' + instanceId).text(mOptions.hits);
        $container.find('#sopaPScore-' + instanceId).text(mOptions.score);
        $container.find('#sopaStartGame-' + instanceId).hide();

        mOptions.hits = 0;
        mOptions.score = 0;
        mOptions.counter = 0;
        mOptions.gameOver = false;
        mOptions.obtainedClue = false;
        mOptions.counter = mOptions.time * 60;
        mOptions.activeCounter = true;
        mOptions.gameStarted = true;

        $eXeSopa.uptateTime(mOptions.counter, instanceId);
        mOptions.counterClock = setInterval(function () {
            let $node = $('#sopaMainContainer-' + instanceId);
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
                $eXeSopa.uptateTime(mOptions.counter, instanceId);
                if (mOptions.counter <= 0) {
                    mOptions.activeCounter = false;
                    mOptions.game.solve();
                    $eXeSopa.gameOver(2, instanceId);
                }
            }
        }, 1000);
    },

    uptateTime: function (time, instanceId) {
        $('#sopaPTime-' + instanceId).text(
            $exeDevices.iDevice.gamification.helpers.getTimeToString(time)
        );
    },

    showMessage: function (type, message, instanceId) {
        let colors = [
                '#555555',
                $eXeSopa.borderColors.red,
                $eXeSopa.borderColors.green,
                $eXeSopa.borderColors.blue,
                $eXeSopa.borderColors.yellow,
            ],
            color = colors[type];
        $('#sopaMessage-' + instanceId).text(message);
        $('#sopaMessage-' + instanceId).css({
            color: color,
        });
    },

    showPoint: function (num, instanceId) {
        let mOptions = $eXeSopa.instances[instanceId],
            q = mOptions.wordsGame[num];
        const $container = $('#sopaMainContainer-' + instanceId);

        $container.find('#sopaMFDetails-' + instanceId).show();
        $container.find('#sopaMAuthorPoint-' + instanceId).html(q.author);
        $container.find('#sopaMFooterPoint-' + instanceId).html(q.definition);

        if (q.definition.length > 0) {
            $container.find('#sopaMFooterPoint-' + instanceId).show();
        }

        $eXeSopa.showImagePoint(q.url, q.x, q.y, q.author, q.alt, instanceId);

        if (q.author.length > 0) {
            $container.find('#sopaMAuthorPoint-' + instanceId).show();
        }

        var html = $container.find('#sopaFDetails-' + instanceId).html();
        if ($exeDevices.iDevice.gamification.math.hasLatex(html)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '#sopaFDetails-' + instanceId
            );
        }
    },

    positionPointerCard: function ($cursor, x, y) {
        $cursor.hide();
        if (x > 0 || y > 0) {
            const parentClass = '.SPP-MultimediaPoint',
                siblingClass = '.SPP-Images',
                containerElement = $cursor.parents(parentClass).eq(0),
                imgElement = $cursor.siblings(siblingClass).eq(0),
                containerPos = containerElement.offset(),
                imgPos = imgElement.offset(),
                marginTop = imgPos.top - containerPos.top,
                marginLeft = imgPos.left - containerPos.left,
                mx = marginLeft + x * imgElement.width(),
                my = marginTop + y * imgElement.height();
            $cursor.css({ left: mx, top: my, 'z-index': 20 });
            $cursor.show();
        }
    },

    showImagePoint: function (url, x, y, author, alt, instanceId) {
        const mOptions = $eXeSopa.instances[instanceId];
        const $container = $('#sopaMainContainer-' + instanceId);
        const $Image = $container.find('#sopaMImagePoint-' + instanceId),
            $cursor = $container.find('#sopaMCursor-' + instanceId),
            $Author = $container.find('#sopaMAuthorPoint-' + instanceId);

        $Author.html(author);
        $Image
            .prop('src', url)
            .on('load', function () {
                if (
                    !this.complete ||
                    typeof this.naturalWidth == 'undefined' ||
                    this.naturalWidth == 0
                ) {
                    $Image.hide();
                    $Image.attr('alt', mOptions.msgs.msgNoImage);
                    $eXeSopa.showCubiertaOptions(2, instanceId);
                    return false;
                } else {
                    $Image.show();
                    $Image.attr('alt', alt);
                    $eXeSopa.showCubiertaOptions(2, instanceId);
                    $eXeSopa.positionPointerCard($cursor, x, y);
                    return true;
                }
            })
            .on('error', function () {
                $Image.hide();
                $Image.attr('alt', mOptions.msgs.msgNoImage);
                $eXeSopa.showCubiertaOptions(2, instanceId);
                return false;
            });
        $container.find('#sopaMMultimediaPoint-' + instanceId).show();
    },

    saveEvaluation: function (instanceId) {
        const mOptions = $eXeSopa.instances[instanceId];
        mOptions.scorerp = (10 * mOptions.hits) / mOptions.wordsGame.length;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $eXeSopa.isInExe
        );
    },

    sendScore: function (auto, instanceId) {
        const mOptions = $eXeSopa.instances[instanceId];

        mOptions.scorerp = (10 * mOptions.hits) / mOptions.wordsGame.length;
        mOptions.previousScore = $eXeSopa.previousScore;
        mOptions.userName = $eXeSopa.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $eXeSopa.previousScore = mOptions.previousScore;
    },

    clear: function (phrase) {
        return phrase.replace(/[&\s\n\r]+/g, ' ').trim();
    },

    removeEvents: function (instanceId) {
        const $container = $('#sopaMainContainer-' + instanceId);

        $(window).off(
            'unload.eXeSopa' + instanceId + ' beforeunload.eXeSopa' + instanceId
        );

        $container
            .find('#sopaLinkMaximize-' + instanceId)
            .off('click touchstart');
        $container
            .find('#sopaLinkMinimize-' + instanceId)
            .off('click touchstart');
        $container
            .find('#sopaLinkFullScreen-' + instanceId)
            .off('click touchstart');
        $container.find('#sopaFeedBackClose-' + instanceId).off('click');
        $container.find('#sopaLinkAudio-' + instanceId).off('click');
        $container
            .find('#sopaCodeAccessButton-' + instanceId)
            .off('click touchstart');
        $container.find('#sopaCodeAccessE-' + instanceId).off('keydown');
        $container.find('#sopaSendScore-' + instanceId).off('click');
        $container.closest('.idevice_node').off('click', '.Games-SendScore');
        $container.find('#sopaResolve-' + instanceId).off('click');
        $container
            .find('#sopaWords-' + instanceId)
            .off('click', '.SPP-LinkSound');
        $container
            .find('#sopaWords-' + instanceId)
            .off('click', '.SPP-LinkImage');
        $container.find('#sopaMLinkClose1-' + instanceId).off('click');
        $container.find('#sopaStartGame-' + instanceId).off('click');
        $container.find('#sopaFullLinkImage-' + instanceId).off('click');
    },

    addEvents: function (instanceId) {
        const mOptions = $eXeSopa.instances[instanceId];
        const $container = $('#sopaMainContainer-' + instanceId);

        $eXeSopa.removeEvents(instanceId);

        $container
            .find('#sopaLinkMaximize-' + instanceId)
            .on('click touchstart', (e) => {
                e.preventDefault();
                $container.find('#sopaGameContainer-' + instanceId).show();
                $container.find('#sopaGameMinimize-' + instanceId).hide();
            });

        $container
            .find('#sopaLinkMinimize-' + instanceId)
            .on('click touchstart', (e) => {
                e.preventDefault();
                $container.find('#sopaGameContainer-' + instanceId).hide();
                $container
                    .find('#sopaGameMinimize-' + instanceId)
                    .css('visibility', 'visible')
                    .show();
            });

        $container
            .find('#sopaLinkFullScreen-' + instanceId)
            .on('click touchstart', (e) => {
                e.preventDefault();
                $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                    document.getElementById('sopaGameContainer-' + instanceId)
                );
            });

        $container
            .find('#sopaFeedBackClose-' + instanceId)
            .on('click', () => $eXeSopa.showCubiertaOptions(false, instanceId));

        $container.find('#sopaLinkAudio-' + instanceId).on('click', (e) => {
            e.preventDefault(mOptions);
            $exeDevices.iDevice.gamification.media.stopSound(mOptions);
            $exeDevices.iDevice.gamification.media.playSound(
                mOptions.wordsGame[mOptions.activeQuestion].audio,
                mOptions
            );
        });

        if (mOptions.itinerary.showCodeAccess) {
            $container
                .find('#sopaMesajeAccesCodeE-' + instanceId)
                .text(mOptions.itinerary.messageCodeAccess);
            $eXeSopa.showCubiertaOptions(0, instanceId);
        }

        $container
            .find('#sopaCodeAccessButton-' + instanceId)
            .on('click touchstart', (e) => {
                e.preventDefault();
                $eXeSopa.enterCodeAccess(instanceId);
            });

        $container
            .find('#sopaCodeAccessE-' + instanceId)
            .on('keydown', (event) => {
                if (event.which === 13) {
                    $eXeSopa.enterCodeAccess(instanceId);
                    return false;
                }
                return true;
            });

        $container
            .find('#sopaPNumber-' + instanceId)
            .text(mOptions.numberQuestions);

        $(window).on(
            'unload.eXeSopa' +
                instanceId +
                ' beforeunload.eXeSopa' +
                instanceId,
            () => {
                if ($eXeSopa.mScorm)
                    $exeDevices.iDevice.gamification.scorm.endScorm(
                        $eXeSopa.mScorm
                    );
            }
        );

        if (mOptions.instructions) {
            $container
                .find('#sopaInstructions-' + instanceId)
                .text(mOptions.instructions);
        }

        $container
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $eXeSopa.sendScore(false, instanceId);
                $eXeSopa.saveEvaluation(instanceId);
            });

        $container.find('#sopaResolve-' + instanceId).on('click', (e) => {
            e.preventDefault();
            mOptions.game.solve();
            $eXeSopa.gameOver(1, instanceId);
        });

        $container
            .find('#sopaWords-' + instanceId)
            .on('click', '.SPP-LinkSound', function (e) {
                e.preventDefault();
                $exeDevices.iDevice.gamification.media.playSound(
                    mOptions.wordsGame[$(this).data('mnumber')].audio,
                    mOptions
                );
            });

        $container
            .find('#sopaWords-' + instanceId)
            .on('click', '.SPP-LinkImage', function (e) {
                e.preventDefault();
                $eXeSopa.showPoint($(this).data('mnumber'), instanceId);
            });

        $container.find('#sopaMLinkClose1-' + instanceId).on('click', (e) => {
            e.preventDefault();
            $eXeSopa.showCubiertaOptions(false, instanceId);
        });

        $eXeSopa.showMessage(3, mOptions.msgs.mgsGameStart, instanceId);

        $container.find('#sopaStartGame-' + instanceId).on('click', (e) => {
            e.preventDefault();
            $eXeSopa.startGame(instanceId);
        });

        $container
            .find(
                '#sopaPTimeTitle-' +
                    instanceId +
                    ', #sopaPTime-' +
                    instanceId +
                    ', #sopaStartGame-' +
                    instanceId +
                    ', #sopaDivImgHome-' +
                    instanceId +
                    ', #sopaPShowClue-' +
                    instanceId
            )
            .hide();

        if (mOptions.showResolve)
            $container.find('#sopaResolve-' + instanceId).show();

        mOptions.gameStarted = true;

        if (mOptions.time > 0) {
            mOptions.gameStarted = false;
            $container
                .find(
                    '#sopaResolve-' +
                        instanceId +
                        ', #sopaMessage-' +
                        instanceId +
                        ', #sopaMultimedia-' +
                        instanceId
                )
                .hide();
            $container
                .find(
                    '#sopaDivImgHome-' +
                        instanceId +
                        ', #sopaPTimeTitle-' +
                        instanceId +
                        ', #sopaPTime-' +
                        instanceId +
                        ', #sopaStartGame-' +
                        instanceId
                )
                .show();
            $container.find('.exeQuextIcons-Time').show();
        }

        $container
            .find('#sopaFullLinkImage-' + instanceId)
            .on('click', function (e) {
                e.preventDefault();
                const largeImageSrc = $container
                    .find('#sopaMImagePoint-' + instanceId)
                    .attr('src');
                if (largeImageSrc && largeImageSrc.length > 3) {
                    $exeDevices.iDevice.gamification.helpers.showFullscreenImage(
                        largeImageSrc,
                        $container.find('#sopaGameContainer-' + instanceId)
                    );
                }
            });

        $container
            .find('#sopaPShowClue-' + instanceId)
            .text(
                `${mOptions.msgs.msgInformation}: ${mOptions.itinerary.clueGame}`
            );

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        setTimeout(() => {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                $eXeSopa.isInExe
            );
        }, 500);
    },

    refreshGame: function (instanceId) {
        const mOptions = $eXeSopa.instances[instanceId];
        if (!mOptions || mOptions.gameOver || !mOptions.gameStarted) return;

        const q = mOptions.wordsGame[mOptions.activeQuestion];
        if (typeof q != 'undefined') {
            const $cursor = $('#sopaMCursor-' + instanceId);
            $eXeSopa.positionPointerCard($cursor, q.x, q.y);
        }
    },

    enterCodeAccess: function (instanceId) {
        const mOptions = $eXeSopa.instances[instanceId];
        const $container = $('#sopaMainContainer-' + instanceId);

        if (
            mOptions.itinerary.codeAccess.toLowerCase() ==
            $container
                .find('#sopaCodeAccessE-' + instanceId)
                .val()
                .toLowerCase()
        ) {
            $eXeSopa.showCubiertaOptions(false, instanceId);
            $container.find('#sopaLinkMaximize-' + instanceId).trigger('click');
        } else {
            $container
                .find('#sopaMesajeAccesCodeE-' + instanceId)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $container.find('#sopaCodeAccessE-' + instanceId).val('');
        }
    },

    gameOver: function (mode, instanceId) {
        const mOptions = $eXeSopa.instances[instanceId];
        const $container = $('#sopaMainContainer-' + instanceId);

        mOptions.gameStarted = false;
        mOptions.gameOver = true;

        $exeDevices.iDevice.gamification.media.stopSound(mOptions);

        clearInterval(mOptions.counterClock);
        mOptions.activeCounter = false;

        const score = ((mOptions.hits * 10) / mOptions.numberQuestions).toFixed(
            2
        );

        if (mOptions.isScorm === 1) {
            $eXeSopa.sendScore(true, instanceId);
            $container
                .find('#sopaRepeatActivity-' + instanceId)
                .text(`${mOptions.msgs.msgYouScore}: ${score}`);
            $eXeSopa.initialScore = score;
        }

        $eXeSopa.saveEvaluation(instanceId);

        if (mOptions.itinerary.showClue) {
            const text = $container.find('#sopaPShowClue-' + instanceId).text(),
                pc = mOptions.msgs.msgTryAgain.replace(
                    '%s',
                    mOptions.itinerary.percentageClue
                );
            mclue = mOptions.obtainedClue ? text : pc;
            $container
                .find('#sopaPShowClue-' + instanceId)
                .text(mclue)
                .show();
        }

        let message = `${$eXeSopa.getRetroFeedMessages(true, instanceId)} ${mOptions.msgs.msgWordsFind.replace('%s', score)}`;
        if (mode === 1) {
            message = mOptions.msgs.msgEndGameM.replace('%s', score);
        } else if (mode === 2) {
            message = mOptions.msgs.msgEndTime.replace('%s', score);
        }

        const type =
            (mOptions.hits * 10) / mOptions.numberQuestions >= 5 ? 2 : 1;
        $eXeSopa.showMessage(type, message, instanceId);
        $eXeSopa.showFeedBack(instanceId);
    },

    showFeedBack: function (instanceId) {
        const mOptions = $eXeSopa.instances[instanceId],
            puntos = (mOptions.hits * 100) / mOptions.wordsGame.length;
        if (mOptions.feedBack) {
            if (puntos >= mOptions.percentajeFB) {
                $eXeSopa.showCubiertaOptions(1, instanceId);
            } else {
                $eXeSopa.showMessage(
                    1,
                    mOptions.msgs.msgTryAgain.replace(
                        '%s',
                        mOptions.percentajeFB
                    ),
                    instanceId
                );
            }
        }
    },

    paintMouse: function (image, cursor, x, y) {
        x = parseFloat(x) || 0;
        y = parseFloat(y) || 0;
        $(cursor).hide();
        if (x > 0 || y > 0) {
            const wI = $(image).width() > 0 ? $(image).width() : 1,
                hI = $(image).height() > 0 ? $(image).height() : 1,
                lI = $(image).position().left + wI * x,
                tI = $(image).position().top + hI * y;
            $(cursor).css({
                left: lI + 'px',
                top: tI + 'px',
                'z-index': 20,
            });
            $(cursor).show();
        }
    },

    updateScore: function (num, mCurWord, number, instanceId) {
        const mOptions = $eXeSopa.instances[instanceId];
        const $container = $('#sopaMainContainer-' + instanceId);

        let message = '',
            obtainedPoints = 0,
            sscore = 0,
            points = 0;

        if (mOptions.gameOver) return;

        mOptions.hits = num + 1;
        obtainedPoints = 10 / mOptions.wordsGame.length || 0;
        points =
            obtainedPoints % 1 == 0
                ? obtainedPoints
                : obtainedPoints.toFixed(2);

        mOptions.score =
            mOptions.score + obtainedPoints > 0
                ? mOptions.score + obtainedPoints
                : 0;

        sscore = mOptions.score;
        sscore =
            mOptions.score % 1 == 0
                ? mOptions.score
                : mOptions.score.toFixed(2);
        $container.find('#sopaPScore-' + instanceId).text(sscore);
        $container.find('#sopaPHits-' + instanceId).text(mOptions.hits);
        $container
            .find('input.SSP-Word[value="' + mCurWord + '"]')
            .siblings('span')
            .css('color', '#de1111');
        $container
            .find('input.SSP-Word[value="' + mCurWord + '"]')
            .addClass('SPP-WordFound');

        message = $eXeSopa.getMessageAnswer(true, points, instanceId);
        $eXeSopa.showMessage(2, message, instanceId);
        if (mOptions.wordsGame[number].audio.length > 4) {
            $exeDevices.iDevice.gamification.media.playSound(
                mOptions.wordsGame[number].audio,
                mOptions
            );
        }

        const percentageHits =
            (mOptions.hits / mOptions.wordsGame.length) * 100;
        if (
            mOptions.itinerary.showClue &&
            percentageHits >= mOptions.itinerary.percentageClue
        ) {
            if (!mOptions.obtainedClue) {
                mOptions.obtainedClue = true;
                $container.find('#sopaPShowClue-' + instanceId).show();
            }
        }

        const score = (percentageHits / 10).toFixed(2);
        if (mOptions.isScorm == 1) {
            $eXeSopa.sendScore(true, instanceId);
            $container
                .find('#sopaRepeatActivity-' + instanceId)
                .text(mOptions.msgs.msgYouScore + ': ' + score);
            $eXeSopa.initialScore = score;
        }
        $eXeSopa.saveEvaluation(instanceId);
    },

    getRetroFeedMessages: function (iHit, instanceId) {
        const mOptions = $eXeSopa.instances[instanceId];

        let sMessages = iHit
            ? mOptions.msgs.msgSuccesses
            : mOptions.msgs.msgFailures;
        sMessages = sMessages.split('|');
        return sMessages[Math.floor(Math.random() * sMessages.length)];
    },

    getMessageAnswer: function (correctAnswer, npts, instanceId) {
        let message = '';

        if (correctAnswer) {
            message = $eXeSopa.getMessageCorrectAnswer(npts, instanceId);
        } else {
            message = $eXeSopa.getMessageErrorAnswer(instanceId);
        }
        return message;
    },

    getMessageCorrectAnswer: function (npts, instanceId) {
        const mOptions = $eXeSopa.instances[instanceId],
            messageCorrect = $eXeSopa.getRetroFeedMessages(true, instanceId),
            message =
                messageCorrect + ' ' + npts + ' ' + mOptions.msgs.msgPoints;
        return message;
    },

    getMessageErrorAnswer: function (instanceId) {
        return $eXeSopa.getRetroFeedMessages(false, instanceId);
    },

    drawImage: function (image, mData) {
        $(image).css({
            left: mData.x + 'px',
            top: mData.y + 'px',
            width: mData.w + 'px',
            height: mData.h + 'px',
        });
    },

    placeImageWindows: function (image, naturalWidth, naturalHeight) {
        const wDiv =
                $(image).parent().width() > 0 ? $(image).parent().width() : 1,
            hDiv =
                $(image).parent().height() > 0 ? $(image).parent().height() : 1,
            varW = naturalWidth / wDiv,
            varH = naturalHeight / hDiv;

        let wImage = wDiv,
            hImage = hDiv,
            xImagen = 0,
            yImagen = 0;

        if (varW > varH) {
            wImage = parseInt(wDiv);
            hImage = parseInt(naturalHeight / varW);
            yImagen = parseInt((hDiv - hImage) / 2);
        } else {
            wImage = parseInt(naturalWidth / varH);
            hImage = parseInt(hDiv);
            xImagen = parseInt((wDiv - wImage) / 2);
        }
        return {
            w: wImage,
            h: hImage,
            x: xImagen,
            y: yImagen,
        };
    },
};
$(function () {
    $eXeSopa.init();
});

/* eslint-disable */
/**
 * Wordfind.js 0.0.1
 * (c) 2012 Bill, BunKat LLC.
 * Wordfind is freely distributable under the MIT license.
 * For all details and documentation:
 *     http://github.com/bunkat/wordfind
 */
((function () {
    'use strict';
    ('undefined' != typeof exports && null !== exports
        ? exports
        : window
    ).wordfind = (function () {
        let t = 'abcdefghijklmnoprstuvwy';
        var n = [
                'horizontal',
                'horizontalBack',
                'vertical',
                'verticalUp',
                'diagonal',
                'diagonalUp',
                'diagonalBack',
                'diagonalUpBack',
            ],
            r = {
                horizontal: function (t, n, r) {
                    return {
                        x: t + r,
                        y: n,
                    };
                },
                horizontalBack: function (t, n, r) {
                    return {
                        x: t - r,
                        y: n,
                    };
                },
                vertical: function (t, n, r) {
                    return {
                        x: t,
                        y: n + r,
                    };
                },
                verticalUp: function (t, n, r) {
                    return {
                        x: t,
                        y: n - r,
                    };
                },
                diagonal: function (t, n, r) {
                    return {
                        x: t + r,
                        y: n + r,
                    };
                },
                diagonalBack: function (t, n, r) {
                    return {
                        x: t - r,
                        y: n + r,
                    };
                },
                diagonalUp: function (t, n, r) {
                    return {
                        x: t + r,
                        y: n - r,
                    };
                },
                diagonalUpBack: function (t, n, r) {
                    return {
                        x: t - r,
                        y: n - r,
                    };
                },
            },
            e = {
                horizontal: function (t, n, r, e, o) {
                    return e >= t + o;
                },
                horizontalBack: function (t, n, r, e, o) {
                    return t + 1 >= o;
                },
                vertical: function (t, n, r, e, o) {
                    return r >= n + o;
                },
                verticalUp: function (t, n, r, e, o) {
                    return n + 1 >= o;
                },
                diagonal: function (t, n, r, e, o) {
                    return e >= t + o && r >= n + o;
                },
                diagonalBack: function (t, n, r, e, o) {
                    return t + 1 >= o && r >= n + o;
                },
                diagonalUp: function (t, n, r, e, o) {
                    return e >= t + o && n + 1 >= o;
                },
                diagonalUpBack: function (t, n, r, e, o) {
                    return t + 1 >= o && n + 1 >= o;
                },
            },
            o = {
                horizontal: function (t, n, r) {
                    return {
                        x: 0,
                        y: n + 1,
                    };
                },
                horizontalBack: function (t, n, r) {
                    return {
                        x: r - 1,
                        y: n,
                    };
                },
                vertical: function (t, n, r) {
                    return {
                        x: 0,
                        y: n + 100,
                    };
                },
                verticalUp: function (t, n, r) {
                    return {
                        x: 0,
                        y: r - 1,
                    };
                },
                diagonal: function (t, n, r) {
                    return {
                        x: 0,
                        y: n + 1,
                    };
                },
                diagonalBack: function (t, n, r) {
                    return {
                        x: r - 1,
                        y: t >= r - 1 ? n + 1 : n,
                    };
                },
                diagonalUp: function (t, n, r) {
                    return {
                        x: 0,
                        y: n < r - 1 ? r - 1 : n + 1,
                    };
                },
                diagonalUpBack: function (t, n, r) {
                    return {
                        x: r - 1,
                        y: t >= r - 1 ? n + 1 : n,
                    };
                },
            },
            a = function (t, n) {
                var r,
                    e,
                    o,
                    a = [];
                for (r = 0; r < n.height; r++)
                    for (a.push([]), e = 0; e < n.width; e++) a[r].push('');
                for (r = 0, o = t.length; r < o; r++)
                    if (!i(a, n, t[r])) return null;
                return a;
            },
            i = function (t, n, e) {
                var o = l(t, n, e);
                if (0 === o.length) return !1;
                var a = o[Math.floor(Math.random() * o.length)];
                return (f(t, e, a.x, a.y, r[a.orientation]), !0);
            },
            l = function (t, n, a) {
                for (
                    var i = [],
                        l = n.height,
                        f = n.width,
                        d = a.length,
                        c = 0,
                        h = 0,
                        v = n.orientations.length;
                    h < v;
                    h++
                )
                    for (
                        var g = n.orientations[h],
                            p = e[g],
                            $ = r[g],
                            P = o[g],
                            S = 0,
                            x = 0;
                        x < l;
                    )
                        if (p(S, x, l, f, d)) {
                            var w = u(a, t, S, x, $);
                            ((w >= c || (!n.preferOverlap && w > -1)) &&
                                ((c = w),
                                i.push({
                                    x: S,
                                    y: x,
                                    orientation: g,
                                    overlap: w,
                                })),
                                ++S >= f && ((S = 0), x++));
                        } else {
                            var z = P(S, x, d);
                            ((S = z.x), (x = z.y));
                        }
                return n.preferOverlap ? s(i, c) : i;
            },
            u = function (t, n, r, e, o) {
                for (var a = 0, i = 0, l = t.length; i < l; i++) {
                    var u = o(r, e, i),
                        s = n[u.y][u.x];
                    if (s === t[i]) a++;
                    else if ('' !== s) return -1;
                }
                return a;
            },
            s = function (t, n) {
                for (var r = [], e = 0, o = t.length; e < o; e++)
                    t[e].overlap >= n && r.push(t[e]);
                return r;
            },
            f = function (t, n, r, e, o) {
                for (var a = 0, i = n.length; a < i; a++) {
                    var l = o(r, e, a);
                    t[l.y][l.x] = n[a];
                }
            };
        return {
            validOrientations: n,
            orientations: r,
            newPuzzle: function (r, e) {
                if (!r.length) throw Error('Zero words provided');
                for (
                    var o,
                        i,
                        l = 0,
                        u = 0,
                        s = e || {},
                        f = (o = r.slice(0).sort())[0].length,
                        d = {
                            height: s.height || f,
                            width: s.width || f,
                            orientations: s.orientations || n,
                            fillBlanks: void 0 === s.fillBlanks || s.fillBlanks,
                            allowExtraBlanks:
                                void 0 === s.allowExtraBlanks ||
                                s.allowExtraBlanks,
                            maxAttempts: s.maxAttempts || 3,
                            maxGridGrowth:
                                void 0 !== s.maxGridGrowth
                                    ? s.maxGridGrowth
                                    : 10,
                            preferOverlap:
                                void 0 === s.preferOverlap || s.preferOverlap,
                        };
                    !i;
                ) {
                    for (; !i && l++ < d.maxAttempts; ) i = a(o, d);
                    if (!i) {
                        if (++u > d.maxGridGrowth)
                            throw Error(
                                `No valid ${d.width}x${d.height} grid found and not allowed to grow more`
                            );
                        (console.log(
                            `No valid ${d.width}x${d.height} grid found after ${l - 1} attempts, trying with bigger grid`
                        ),
                            d.height++,
                            d.width++,
                            (l = 0));
                    }
                }
                if (d.fillBlanks) {
                    var c,
                        h,
                        v = 0;
                    'function' == typeof d.fillBlanks
                        ? (h = d.fillBlanks)
                        : 'string' == typeof d.fillBlanks
                          ? ((c = d.fillBlanks.toLowerCase().split('')),
                            (h = () => c.pop() || (v++ && '')))
                          : (h = () => t[Math.floor(Math.random() * t.length)]);
                    var g = this.fillBlanks({
                        puzzle: i,
                        extraLetterGenerator: h,
                    });
                    if (c && c.length)
                        throw Error(
                            `Some extra letters provided were not used: ${c}`
                        );
                    if (c && v && !d.allowExtraBlanks)
                        throw Error(
                            `${v} extra letters were missing to fill the grid`
                        );
                    var p = 100 * (1 - g / (d.width * d.height));
                }
                return i;
            },
            newPuzzleLax: function (t, n) {
                try {
                    return this.newPuzzle(t, n);
                } catch (r) {
                    if (!n.allowedMissingWords) throw r;
                    var n = Object.assign({}, n);
                    n.allowedMissingWords--;
                    for (var e = 0; e < t.length; e++) {
                        var o = t.slice(0);
                        o.splice(e, 1);
                        try {
                            return this.newPuzzleLax(o, n);
                        } catch (a) {}
                    }
                    throw r;
                }
            },
            fillBlanks: function ({ puzzle: t, extraLetterGenerator: n }) {
                for (var r = 0, e = 0, o = t.length; e < o; e++)
                    for (var a = t[e], i = 0, l = a.length; i < l; i++)
                        !t[e][i] && ((t[e][i] = n()), r++);
                return r;
            },
            solve: function (t, r) {
                for (
                    var e = {
                            height: t.length,
                            width: t[0].length,
                            orientations: n,
                            preferOverlap: !0,
                        },
                        o = [],
                        a = [],
                        i = 0,
                        u = r.length;
                    i < u;
                    i++
                ) {
                    var s = r[i],
                        f = l(t, e, s);
                    f.length > 0 && f[0].overlap === s.length
                        ? ((f[0].word = s), o.push(f[0]))
                        : a.push(s);
                }
                return {
                    found: o,
                    notFound: a,
                };
            },
            print: function (t) {
                for (var n = '', r = 0, e = t.length; r < e; r++) {
                    for (var o = t[r], a = 0, i = o.length; a < i; a++)
                        n += ('' === o[a] ? ' ' : o[a]) + ' ';
                    n += '\n';
                }
                return (console.log(n), n);
            },
        };
    })();
}).call(this),
    (function (t, n, r) {
        'use strict';
        var e = function (t, r) {
                for (var e = '', o = 0, a = r.length; o < a; o++) {
                    var i = r[o];
                    e += '<div>';
                    for (var l = 0, u = i.length; l < u; l++)
                        ((e +=
                            '<button class="SPP-PuzzleSquare" x="' +
                            l +
                            '" y="' +
                            o +
                            '">'),
                            (e += i[l] || '&nbsp;'),
                            (e += '</button>'));
                    e += '</div>';
                }
                n(t).html(e);
            },
            o = function (t, n, e, o) {
                for (var a in r.orientations) {
                    var i = (0, r.orientations[a])(t, n, 1);
                    if (i.x === e && i.y === o) return a;
                }
                return null;
            },
            a = function (a, i) {
                // Extraer instanceId de las opciones
                var instanceId = i.instanceId || 0;
                var $container = n('#sopaMainContainer-' + instanceId);

                var l,
                    u,
                    s,
                    f,
                    d,
                    c = [],
                    h = '',
                    v = function (t) {
                        (t.preventDefault(),
                            n(this).addClass('selected'),
                            (f = this),
                            c.push(this),
                            (h = n(this).text()));
                    },
                    g = function (r) {
                        r.preventDefault();
                        var e =
                                r.originalEvent.touches[0] ||
                                r.originalEvent.changedTouches[0],
                            o = e.clientX,
                            a = e.clientY;
                        $(t.elementFromPoint(o, a));
                    },
                    p = function (t) {
                        (t.preventDefault(), $(this));
                    },
                    $ = function (t) {
                        if (f) {
                            var r,
                                e = c[c.length - 1];
                            if (e != t) {
                                for (var a = 0, i = c.length; a < i; a++)
                                    if (c[a] == t) {
                                        r = a + 1;
                                        break;
                                    }
                                for (; r < c.length; )
                                    (n(c[c.length - 1]).removeClass('selected'),
                                        c.splice(r, 1),
                                        (h = h.substr(0, h.length - 1)));
                                var l = o(
                                    n(f).attr('x') - 0,
                                    n(f).attr('y') - 0,
                                    n(t).attr('x') - 0,
                                    n(t).attr('y') - 0
                                );
                                l &&
                                    ((c = [f]),
                                    (h = n(f).text()),
                                    e !== f &&
                                        (n(e).removeClass('selected'), (e = f)),
                                    (d = l));
                                var u = o(
                                    n(e).attr('x') - 0,
                                    n(e).attr('y') - 0,
                                    n(t).attr('x') - 0,
                                    n(t).attr('y') - 0
                                );
                                u && ((d && d !== u) || ((d = u), P(t)));
                            }
                        }
                    },
                    P = function (t) {
                        for (var r = 0, e = l.length; r < e; r++)
                            if (0 === l[r].indexOf(h + n(t).text())) {
                                (n(t).addClass('selected'),
                                    c.push(t),
                                    (h += n(t).text()));
                                break;
                            }
                    },
                    S = function (t) {
                        t.preventDefault();
                        for (
                            var r = '', e = 0, o = 0, a = l.length;
                            o < a;
                            o++
                        ) {
                            if (l[o] === h) {
                                for (var i = 0; i < s.length; i++)
                                    s[i].toLowerCase() == h &&
                                        ((r = s[i]), (e = i));
                                if (
                                    $eXeSopa &&
                                    typeof $eXeSopa.updateScore == 'function'
                                ) {
                                    ($container
                                        .find('.selected')
                                        .addClass('found'),
                                        $eXeSopa.updateScore(
                                            s.length - l.length,
                                            r,
                                            e,
                                            instanceId
                                        ),
                                        l.splice(o, 1));
                                }
                            }
                            0 === l.length &&
                                ($eXeSopa.gameOver(0, instanceId),
                                $container
                                    .find('.SPP-PuzzleSquare')
                                    .addClass('complete'));
                        }
                        ($container.find('.selected').removeClass('selected'),
                            (f = null),
                            (c = []),
                            (h = ''),
                            (d = null));
                    };
                ($container.find('input.SSP-Word').removeClass('SPP-WordFound'),
                    (l = $container
                        .find('input.SSP-Word')
                        .toArray()
                        .map((t) => t.value.toLowerCase())
                        .filter((t) => t)
                        .sort()),
                    (s = $container
                        .find('input.SSP-Word')
                        .toArray()
                        .map((t) => t.value)
                        .filter((t) => t)),
                    e(a, (u = r.newPuzzleLax(l, i.orientations))),
                    $container.find('.SPP-PuzzleSquare').click(function (t) {
                        t.preventDefault();
                    }),
                    window.navigator.msPointerEnabled
                        ? ($container
                              .find('.SPP-PuzzleSquare')
                              .on('MSPointerDown', v),
                          $container
                              .find('.SPP-PuzzleSquare')
                              .on('MSPointerOver', $),
                          $container
                              .find('.SPP-PuzzleSquare')
                              .on('MSPointerUp', S))
                        : ($container.find('.SPP-PuzzleSquare').mousedown(v),
                          $container.find('.SPP-PuzzleSquare').mouseenter(p),
                          $container.find('.SPP-PuzzleSquare').mouseup(S),
                          $container
                              .find('.SPP-PuzzleSquare')
                              .on('touchstart', v),
                          $container
                              .find('.SPP-PuzzleSquare')
                              .on('touchmove', g),
                          $container
                              .find('.SPP-PuzzleSquare')
                              .on('touchend', S)),
                    (this.solve = function () {
                        for (
                            var t = r.solve(u, l).found, e = 0, o = t.length;
                            e < o;
                            e++
                        ) {
                            var a = t[e].word,
                                i = t[e].orientation,
                                s = t[e].x,
                                f = t[e].y,
                                d = r.orientations[i],
                                c = $container.find(
                                    'input.SSP-Word[value="' + a + '"]'
                                );
                            if (!c.hasClass('SPP-WordFound')) {
                                for (var h = 0, v = a.length; h < v; h++) {
                                    var g = d(s, f, h);
                                    $container
                                        .find(
                                            '[x="' + g.x + '"][y="' + g.y + '"]'
                                        )
                                        .addClass('solved');
                                }
                                c.addClass('SPP-WordFound');
                            }
                        }
                    }));
            };
        ((a.emptySquaresCount = function () {
            var t = n('.SPP-PuzzleSquare').toArray();
            return t.length - t.filter((t) => t.textContent.trim()).length;
        }),
            (a.insertWordBefore = function (t, r) {
                n(
                    '<li><input class="SSP-Word" value="' +
                        (r || '') +
                        '"></li>'
                ).insertBefore(t);
            }),
            (a.append = function (t, r, e, o, a, i) {
                n(
                    '<li class="Sopa-Li"><span>' +
                        (o + 1) +
                        '.-  </span>' +
                        (a
                            ? '<a href="#" data-mnumber="' +
                              o +
                              '" class="SPP-LinkImage" title="">      <div class="SopaIcons SopaIcon-Image SPP-Activo"></div>      </a>'
                            : '') +
                        ' ' +
                        (i
                            ? '<a href="#" data-mnumber="' +
                              o +
                              '" class="SPP-LinkSound" title=""><div class="SopaIcons SopaIcon-Audio SPP-Activo"></div></a>'
                            : '') +
                        '<span>' +
                        (e || '') +
                        '</span><input class="SSP-Word SPP-WordsHide" value="' +
                        (r || '') +
                        '"></li>'
                ).appendTo(t);
            }),
            (window.WordFindGame = a));
    })(document, jQuery, wordfind));
