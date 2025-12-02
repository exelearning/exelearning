/* eslint-disable no-undef */
/**
 * ordena activity (Export)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 *
 */
var $eXeOrdena = {
    idevicePath: '',
    borderColors: {
        black: '#1c1b1b',
        blue: '#3334a1',
        green: '#006641',
        red: '#a2241a',
        white: '#ffffff',
        yellow: '#f3d55a',
    },
    colors: {
        black: '#1c1b1b',
        blue: '#3334a1',
        green: '#006641',
        red: '#a2241a',
        white: '#ffffff',
        yellow: '#fcf4d3',
    },
    options: [],
    hasSCORMbutton: false,
    isInExe: false,
    userName: '',
    previousScore: '',
    initialScore: '',
    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',
    mScorm: null,
    jqueryui: 1,

    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            'Sort',
            'sort',
            'ordena-IDevice'
        );
    },

    enable: function () {
        $eXeOrdena.loadGame();
    },

    loadGame: function () {
        $eXeOrdena.options = [];

        $eXeOrdena.activities.each(function (i) {
            const dl = $('.ordena-DataGame', this),
                mOption = $eXeOrdena.loadDataGame(dl, this);

            mOption.scorerp = 0;
            mOption.idevicePath = $eXeOrdena.idevicePath;
            mOption.main = 'ordenaMainContainer-' + i;
            mOption.idevice = 'ordena-IDevice';

            $eXeOrdena.options.push(mOption);

            const ordena = $eXeOrdena.createInterfaceOrdena(i);

            dl.before(ordena).remove();

            $('#ordenaGameMinimize-' + i).hide();
            $('#ordenaGameContainer-' + i).hide();
            if (mOption.showMinimize) {
                $('#ordenaGameMinimize-' + i)
                    .css({
                        cursor: 'pointer',
                    })
                    .show();
            } else {
                $('#ordenaGameContainer-' + i).show();
            }

            $('#ordenaDivFeedBack-' + i).prepend(
                $('.ordena-feedback-game', this)
            );

            $eXeOrdena.addEvents(i);

            $('#ordenaDivFeedBack-' + i).hide();

            if (mOption.type == 0) $('#ordenaPhrasesContainer-' + i).hide();
            if (
                !mOption.itinerary.showCodeAccess &&
                (mOption.startAutomatically ||
                    (mOption.type == 0 && mOption.time == 0))
            ) {
                $('#ordenaStartGame-' + i).click();
            }

            $('#ordenaMainContainer-' + i).show();

            $eXeOrdena.showPhrase(0, i);
        });

        $exeDevices.iDevice.gamification.math.updateLatex('.ordena-IDevice');
    },

    loadDataGame: function (data, sthis) {
        const json = $exeDevices.iDevice.gamification.helpers.decrypt(
            data.text()
        );

        const mOptions =
                $exeDevices.iDevice.gamification.helpers.isJsonString(json),
            $audiosDef = $('.ordena-LinkAudiosDef', sthis),
            $audiosError = $('.ordena-LinkAudiosError', sthis),
            $audiosHit = $('.ordena-LinkAudiosHit', sthis),
            $imageBack = $('.ordena-ImageBack', sthis);

        mOptions.imgCard = '';
        if ($imageBack.length == 1) {
            mOptions.imgCard = $imageBack.attr('href') || '';
        }

        mOptions.playerAudio = '';

        for (let i = 0; i < mOptions.phrasesGame.length; i++) {
            const $imagesLink = $('.ordena-LinkImages-' + i, sthis),
                $audiosLink = $('.ordena-LinkAudios-' + i, sthis),
                cards = mOptions.phrasesGame[i].cards;

            $imagesLink.each(function () {
                const iq = parseInt($(this).text());
                if (!isNaN(iq) && iq < cards.length) {
                    cards[iq].url = $(this).attr('href');
                    if (cards[iq].url < 4) {
                        cards[iq].url = '';
                    }
                }
            });
            $audiosLink.each(function () {
                const iqa = parseInt($(this).text());
                if (!isNaN(iqa) && iqa < cards.length) {
                    cards[iqa].audio = $(this).attr('href');
                    if (cards[iqa].audio.length < 4) {
                        cards[iqa].audio = '';
                    }
                }
            });
            mOptions.phrasesGame[i].phrase =
                typeof mOptions.phrasesGame[i].phrase == 'undefined'
                    ? ''
                    : mOptions.phrasesGame[i].phrase;

            for (let j = 0; j < cards.length; j++) {
                cards[j].type = 0;
                if (
                    cards[j].url.length > 4 &&
                    cards[j].eText.trim().length > 0
                ) {
                    cards[j].type = 2;
                } else if (cards[j].url.length > 4) {
                    cards[j].type = 0;
                } else if (cards[j].eText.trim().length > 0) {
                    cards[j].type = 1;
                }
                cards[j].order = j;
            }
        }

        $audiosDef.each(function () {
            const iqa = parseInt($(this).text());
            if (!isNaN(iqa) && iqa < mOptions.phrasesGame.length) {
                mOptions.phrasesGame[iqa].audioDefinition =
                    $(this).attr('href');
                if (mOptions.phrasesGame[iqa].audioDefinition.length < 4) {
                    mOptions.phrasesGame[iqa].audioDefinition = '';
                }
            }
        });

        $audiosError.each(function () {
            const iqa = parseInt($(this).text());
            if (!isNaN(iqa) && iqa < mOptions.phrasesGame.length) {
                mOptions.phrasesGame[iqa].audioError = $(this).attr('href');
                if (mOptions.phrasesGame[iqa].audioError.length < 4) {
                    mOptions.phrasesGame[iqa].audioError = '';
                }
            }
        });

        $audiosHit.each(function () {
            const iqa = parseInt($(this).text());
            if (!isNaN(iqa) && iqa < mOptions.phrasesGame.length) {
                mOptions.phrasesGame[iqa].audioHit = $(this).attr('href');
                if (mOptions.phrasesGame[iqa].audioHit.length < 4) {
                    mOptions.phrasesGame[iqa].audioHit = '';
                }
            }
        });

        mOptions.active = 0;
        mOptions.evaluation =
            typeof mOptions.evaluation == 'undefined'
                ? false
                : mOptions.evaluation;
        mOptions.evaluationID =
            typeof mOptions.evaluationID == 'undefined'
                ? ''
                : mOptions.evaluationID;
        mOptions.id = typeof mOptions.id == 'undefined' ? false : mOptions.id;
        mOptions.type = typeof mOptions.type == 'undefined' ? 1 : mOptions.type;
        mOptions.allPhrases = $.extend(true, {}, mOptions.phrasesGame);
        mOptions.phrasesGame =
            $exeDevices.iDevice.gamification.helpers.getQuestions(
                mOptions.phrasesGame,
                mOptions.percentajeQuestions
            );
        mOptions.phrasesGame =
            $exeDevices.iDevice.gamification.helpers.shuffleAds(
                mOptions.phrasesGame
            );
        mOptions.numberQuestions = mOptions.phrasesGame.length;
        mOptions.gameColumns =
            typeof mOptions.startAutomatically == 'undefined'
                ? false
                : mOptions.gameColumns;
        mOptions.maxWidth =
            typeof mOptions.maxWidth == 'undefined' ? false : mOptions.maxWidth;
        mOptions.cardHeight =
            typeof mOptions.cardHeight == 'undefined'
                ? 100
                : mOptions.cardHeight;
        mOptions.startAutomatically =
            typeof mOptions.startAutomatically == 'undefined'
                ? false
                : mOptions.startAutomatically;
        mOptions.orderedColumns =
            typeof mOptions.orderedColumns == 'undefined'
                ? false
                : mOptions.orderedColumns;
        mOptions.orderedColumns =
            mOptions.gameColumns < 2 ? false : mOptions.orderedColumns;
        mOptions.fullscreen = false;
        mOptions.numberQuestions = mOptions.phrasesGame.length;
        mOptions.wordBorder = mOptions.wordBorder ?? true;
        mOptions.hits = 0;

        return mOptions;
    },

    getFixedOrder: function (columns, cards) {
        let arraynum = [];
        if (cards > 0) {
            const max = cards - columns;
            arraynum = Array.from({ length: max }, function (_, i) {
                return i;
            });
            arraynum =
                $exeDevices.iDevice.gamification.helpers.shuffleAds(arraynum);
            arraynum = arraynum.map(function (num) {
                return num + columns;
            });
        }
        const arraybas = Array.from({ length: columns }, function (_, i) {
                return i;
            }),
            array = arraybas.concat(arraynum);
        return array;
    },

    showPhrase: function (num, instance) {
        const mOptions = $eXeOrdena.options[instance];

        mOptions.active = num;

        mOptions.phrase = mOptions.phrasesGame[num];
        if (mOptions.type === 0) {
            $eXeOrdena.showPhraseText(num, instance);
            return;
        }

        $eXeOrdena.randomPhrase(instance);
        $exeDevices.iDevice.gamification.media.stopSound(mOptions);
        $eXeOrdena.addCards(mOptions.phrase.cards, instance);
        $eXeOrdena.initCards(instance);

        $eXeOrdena.initializeDragAndDrop(instance, num);
    },

    waitForJQueryUI: function (callback) {
        const interval = setInterval(() => {
            if (window.jQuery && $.ui && $.ui.draggable && $.ui.droppable) {
                clearInterval(interval);
                callback();
            }
        }, 100);
    },

    initializeDragAndDrop: function (instance, num) {
        if (!$.ui || !$.ui.draggable || !$.ui.droppable) return;
        const mOptions = $eXeOrdena.options[instance],
            $ordenaMultimedia = $('#ordenaMultimedia-' + instance);

        let $cards = $ordenaMultimedia.find('.ODNP-NewCard');
        $cards.css('cursor', 'default');
        let $activeCard = $cards;

        if (mOptions.orderedColumns) {
            $activeCard = $cards.filter(function () {
                const child = $(this).find('.ODNP-CardDraw');
                return (
                    child.length > 0 &&
                    parseInt(child.data('order'), 10) >= mOptions.gameColumns
                );
            });
            let $header = $cards.filter(function () {
                const child = $(this).find('.ODNP-CardDraw');
                return (
                    child.length > 0 &&
                    parseInt(child.data('order'), 10) < mOptions.gameColumns
                );
            });
            $header.css({ border: '2px solid #555555' });
        }
        $activeCard.css('cursor', 'pointer');
        if (num > 0) {
            $ordenaMultimedia.find('.ODNP-Card1').addClass('flipped');
            $eXeOrdena.showMessage(0, mOptions.phrase.definition, instance);
            if (
                typeof mOptions.phrase.audioDefinition !== 'undefined' &&
                mOptions.phrase.audioDefinition.length > 4
            ) {
                $exeDevices.iDevice.gamification.media.playSound(
                    mOptions.phrase.audioDefinition,
                    mOptions
                );
            }
        }

        $activeCard.draggable({
            revert: 'invalid',
            cursor: 'move',
            containment: 'document',
            helper: 'clone',
            appendTo: '.ODNP-GameContainer-' + instance,
            cancel: '.ODNP-FullLinkImage',
            start: function (event, ui) {
                $(this).addClass('dragging');
                if (ui.helper) {
                    ui.helper.css({
                        width: $(this).width() + 'px',
                        height: $(this).height() + 'px',
                        'z-index': 1000,
                    });
                }
            },
            stop: function (event, ui) {
                $(this).removeClass('dragging');
                if (ui.helper) {
                    ui.helper.css('z-index', 5);
                }
            },
        });

        $activeCard.droppable({
            accept: '.ODNP-NewCard',
            over: function (event, ui) {
                const ord = parseInt(
                    $(this).find('.ODNP-CardDraw').data('order')
                );
                if (
                    mOptions.orderedColumns ||
                    (ord && ord >= mOptions.gameColumns)
                ) {
                    $(this).addClass('ODNP-Over');
                }

                ui.draggable.css('z-index', 1000);
            },
            out: function () {
                $(this).removeClass('ODNP-Over');
            },
            drop: function (_e, ui) {
                $(this).removeClass('ODNP-Over');
                const $dragged = $(ui.draggable);
                const $target = $(this);
                $eXeOrdena.moveCard($dragged, $target, instance);
            },
        });

        $ordenaMultimedia.off('click', '.ODNP-FullLinkImage');
        $ordenaMultimedia.on('click', '.ODNP-FullLinkImage', function (e) {
            e.stopPropagation();
            const $image = $(this)
                    .closest('.ODNP-CardContainer')
                    .find('.ODNP-Image'),
                largeImageSrc = $image.attr('src');
            if (largeImageSrc && largeImageSrc.length > 3) {
                $exeDevices.iDevice.gamification.helpers.showFullscreenImage(
                    largeImageSrc,
                    $('#ordenaGameContainer-' + instance)
                );
            }
        });

        $ordenaMultimedia.off('mousedown touchstart', '.ODNP-Card1');
        $ordenaMultimedia.on(
            'mousedown touchstart',
            '.ODNP-Card1',
            function (event) {
                event.preventDefault();
                if (mOptions.gameStarted) {
                    $eXeOrdena.checkAudio(this, instance);
                }
            }
        );

        $ordenaMultimedia.off('click', '.ODNP-LinkAudio');
        $ordenaMultimedia.on('click', '.ODNP-LinkAudio', function (e) {
            e.preventDefault();
            const audio = $(this).data('audio');
            if (audio && audio.length > 3) {
                $exeDevices.iDevice.gamification.media.playSound(
                    audio,
                    mOptions
                );
            }
        });
    },

    randomPhrase: function (instance) {
        const mOptions = $eXeOrdena.options[instance];

        if (mOptions.orderedColumns) {
            const order = $eXeOrdena.getFixedOrder(
                    mOptions.gameColumns,
                    mOptions.phrase.cards.length
                ),
                pcards = [];
            for (let i = 0; i < mOptions.phrase.cards.length; i++) {
                pcards.push(mOptions.phrase.cards[order[i]]);
            }
            mOptions.phrase.cards = pcards;
        } else {
            mOptions.phrase.cards =
                $exeDevices.iDevice.gamification.helpers.shuffleAds(
                    mOptions.phrase.cards
                );
        }
    },

    checkPhrase: function (instance) {
        let correct = true,
            valids = [];
        $('#ordenaMultimedia-' + instance)
            .find('.ODNP-CardDraw')
            .each(function (i) {
                const order = parseInt($(this).data('order'));
                if (i !== order) {
                    correct = false;
                } else {
                    valids.push(i);
                }
            });
        return {
            correct: correct,
            valids: valids,
        };
    },

    checkPhraseColumns: function (instance) {
        const mOptions = $eXeOrdena.options[instance],
            valids = [],
            validsPos = $eXeOrdena.getPostionsColumns(
                mOptions.gameColumns,
                mOptions.phrase.cards.length
            );

        let correct = true;
        $('#ordenaMultimedia-' + instance)
            .find('.ODNP-CardDraw')
            .each(function (i) {
                if (i >= mOptions.gameColumns) {
                    const order = parseInt($(this).data('order')),
                        number = i,
                        col = number % mOptions.gameColumns;
                    if (!validsPos[col].includes(order)) {
                        correct = false;
                    } else {
                        valids.push(order);
                    }
                }
            });
        return {
            correct: correct,
            valids: valids,
        };
    },

    getPostionsColumns: function (columns, nuncards) {
        const positions = [],
            rows = Math.floor(nuncards / columns);

        for (let i = 0; i < columns; i++) {
            const column = [];
            for (let j = 0; j < rows; j++) {
                column.push(i + j * columns);
            }
            positions.push(column);
        }
        return positions;
    },

    createInterfaceOrdena: function (instance) {
        const path = $eXeOrdena.idevicePath,
            msgs = $eXeOrdena.options[instance].msgs,
            mOptions = $eXeOrdena.options[instance],
            html = `
            <div class="ODNP-MainContainer" id="ordenaMainContainer-${instance}">
                <div class="ODNP-GameMinimize" id="ordenaGameMinimize-${instance}">
                    <a href="#" class="ODNP-LinkMaximize" id="ordenaLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                        <img src="${path}ordenaIcon.png" class="ODNP-IconMinimize ODNP-Activo" alt="">
                        <div class="ODNP-MessageMaximize" id="ordenaMessageMaximize-${instance}">${msgs.msgPlayStart}</div>
                    </a>
                </div>
                <div class="ODNP-GameContainer ODNP-GameContainer-${instance}" id="ordenaGameContainer-${instance}">
                    <div class="ODNP-GameScoreBoard" id="ordenaGameScoreBoard-${instance}">
                        <div class="ODNP-GameScores">
                            <div class="exeQuextIcons exeQuextIcons-Number" id="ordenaPNumberIcon-${instance}" title="${msgs.msgNumbersAttemps}"></div>
                            <p><span class="sr-av">${msgs.msgNumbersAttemps}: </span><span id="ordenaPNumber-${instance}">0</span></p>
                            <div class="exeQuextIcons exeQuextIcons-Number" title="${msgs.msgNumbersAttemps}"></div>
                            <p><span class="sr-av">${msgs.msgErrors}: </span><span id="ordenaPErrors-${instance}">0</span></p>
                            <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                            <p><span class="sr-av">${msgs.msgHits}: </span><span id="ordenaPHits-${instance}">0</span></p>
                            <div class="exeQuextIcons exeQuextIcons-Score" id="ordenaPScoreIcon-${instance}" title="${msgs.msgScore}"></div>
                            <p><span class="sr-av">${msgs.msgScore}: </span><span id="ordenaPScore-${instance}">0</span></p>
                        </div>
                        <div class="Ordenabre-Info" id="ordenaInfo-${instance}"></div>
                        <div class="ODNP-TimeNumber">
                            <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Time" id="ordenaImgTime-${instance}" title="${msgs.msgTime}"></div>
                            <p id="ordenaPTime-${instance}" class="ODNP-PTime">00:00</p>
                            <a href="#" class="ODNP-LinkMinimize" id="ordenaLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                                <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                                <div class="exeQuextIcons exeQuextIcons-Minimize ODNP-Activo"></div>
                            </a>
                            <a href="#" class="ODNP-LinkFullScreen" id="ordenaLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                                <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                                <div class="exeQuextIcons exeQuextIcons-FullScreen ODNP-Activo" id="ordenaFullScreen-${instance}"></div>
                            </a>
                        </div>
                    </div>
                    <div class="ODNP-Information">
                        <p class="ODNP-Message" id="ordenaMessage-${instance}"></p>
                        <a href="#" id="ordenaStartGame-${instance}">${msgs.msgPlayStart}</a>
                    </div>
                    <div class="ODNP-GameButton" id="ordenaGameButtons-${instance}">
                        <p class="ODNP-MessageDonw" id="ordenaHistsGame-${instance}"></p>
                        <a href="#" id="ordenaValidatePhrase-${instance}" title="${msgs.msgCheck}">${msgs.msgCheck}</a>
                        <a href="#" id="ordenaNextPhrase-${instance}" title="${msgs.msgNextPhrase}">${msgs.msgNextPhrase}</a>
                    </div>
                    <div class="ODNP-Multimedia" id="ordenaMultimedia-${instance}"></div>
                    <div class="ODNP-Target" id="ordenaPhrasesContainer-${instance}"></div>                    
                    <div class="ODNP-AuthorGame" id="ordenaAuthorGame-${instance}"></div>
                </div>
                <div class="ODNP-Cubierta" id="ordenaCubierta-${instance}">
                    <div class="ODNP-GameOverExt" id="ordenaGameOver-${instance}">
                        <div class="ODNP-StartGame" id="ordenaMesasgeEnd-${instance}"></div>
                        <div class="ODNP-GameOver">
                            <div class="ODNP-DataImage">
                                <img src="${path}exequextwon.png" class="ODNP-HistGGame" id="ordenaHistGame-${instance}" alt="${msgs.msgAllQuestions}" />
                                <img src="${path}exequextlost.png" class="ODNP-LostGGame" id="ordenaLostGame-${instance}" alt="${msgs.msgTimeOver}" />
                            </div>
                            <div class="ODNP-DataScore">
                                <p id="ordenaOverNumCards-${instance}"></p>
                                <p id="ordenaOverAttemps-${instance}"></p>
                                <p id="ordenaOverHits-${instance}"></p>
                            </div>
                        </div>
                        <div class="ODNP-StartGame">
                            <a href="#" id="ordenaStartGameEnd-${instance}">${msgs.msgPlayAgain}</a>
                        </div>
                    </div>
                    <div class="ODNP-CodeAccessDiv" id="ordenaCodeAccessDiv-${instance}">
                        <div class="ODNP-MessageCodeAccessE" id="ordenaMesajeAccesCodeE-${instance}"></div>
                        <div class="ODNP-DataCodeAccessE">
                            <label class="sr-av">${msgs.msgCodeAccess}:</label>
                            <input type="text" class="ODNP-CodeAccessE form-control" id="ordenaCodeAccessE-${instance}" placeholder="${msgs.msgCodeAccess}">
                            <a href="#" id="ordenaCodeAccessButton-${instance}" title="${msgs.msgSubmit}">
                                <strong><span class="sr-av">${msgs.msgSubmit}</span></strong>
                                <div class="exeQuextIcons-Submit ODNP-Activo"></div>
                            </a>
                        </div>
                    </div>
                    <div class="ODNP-ShowClue" id="ordenaShowClue-${instance}">
                        <p class="sr-av">${msgs.msgClue}</p>
                        <p class="ODNP-PShowClue" id="ordenaPShowClue-${instance}"></p>
                        <a href="#" class="ODNP-ClueBotton" id="ordenaClueButton-${instance}" title="${msgs.msgContinue}">${msgs.msgContinue}</a>
                    </div>
                </div>
                <div class="ODNP-DivFeedBack" id="ordenaDivFeedBack-${instance}">
                    <input type="button" id="ordenaFeedBackClose-${instance}" value="${msgs.msgClose}" class="feedbackbutton" />
                </div>
            </div>
           ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}
        `;
        return html;
    },

    saveEvaluation: function (instance) {
        const mOptions = $eXeOrdena.options[instance];
        mOptions.scorerp = (mOptions.hits * 10) / mOptions.numberQuestions;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $eXeOrdena.isInExe
        );
    },

    sendScore: function (auto, instance) {
        const mOptions = $eXeOrdena.options[instance];

        mOptions.scorerp = (mOptions.hits * 10) / mOptions.numberQuestions;
        mOptions.previousScore = $eXeOrdena.previousScore;
        mOptions.userName = $eXeOrdena.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $eXeOrdena.previousScore = mOptions.previousScore;
    },

    addCards: function (cardsGame, instance) {
        const mOptions = $eXeOrdena.options[instance];
        let cards = '';
        $('#ordenaMultimedia-' + instance)
            .find('.ODNP-NewCard')
            .remove();

        for (let i = 0; i < cardsGame.length; i++) {
            const card = $eXeOrdena.createCard(
                i,
                cardsGame[i].type,
                cardsGame[i].url,
                cardsGame[i].eText,
                cardsGame[i].audio,
                cardsGame[i].x,
                cardsGame[i].y,
                cardsGame[i].alt,
                cardsGame[i].color,
                cardsGame[i].backcolor,
                cardsGame[i].order,
                instance
            );
            cards += card;
        }

        $('#ordenaMultimedia-' + instance).append(cards);
        if (mOptions.imgCard.length > 4) {
            $('#ordenaMultimedia-' + instance)
                .find('.ODNP-CardContainer')
                .each(function () {
                    $(this)
                        .find('.ODNP-CardFront')
                        .css({
                            'background-image': 'url(' + mOptions.imgCard + ')',
                            'background-size': 'cover',
                        });
                });
        }
    },

    showPhraseText: function (num, instance) {
        const mOptions = $eXeOrdena.options[instance];
        if (!mOptions) return;
        mOptions.phrase = mOptions.phrasesGame[num] || { phrase: '' };
        // normalize whitespace and avoid empty words
        mOptions.correctOrder = $eXeOrdena
            .clear(mOptions.phrase.phrase || '')
            .split(' ')
            .filter(function (w) {
                return w && w.length > 0;
            });

        let words = [];
        for (let i = 0; i < mOptions.correctOrder.length; i++) {
            const word = {
                text: mOptions.correctOrder[i],
                order: i,
            };
            words.push(word);
        }
        const shuffledWords = [...words].sort(() => Math.random() - 0.5);

        $exeDevices.iDevice.gamification.media.stopSound(mOptions);
        $eXeOrdena.addCardsPhrase(shuffledWords, instance);

        const html = $('#ordenaPhrasesContainer-' + instance).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);

        if (latex)
            $exeDevices.iDevice.gamification.math.updateLatex(
                `ordenaPhrasesContainer-${instance}`
            );

        // pass num to allow initializePhraseDragAndDrop to react to "num>0" cases
        $eXeOrdena.initializePhraseDragAndDrop(instance, num);
    },

    addCardsPhrase: function (words, instance) {
        const mOptions = $eXeOrdena.options[instance];
        let cards = '';
        $('#ordenaPhrasesContainer-' + instance)
            .find('.ODNP-Word')
            .remove();
        for (let i = 0; i < words.length; i++) {
            const card = $eXeOrdena.createCardPhrase(
                i,
                words[i].text,
                words[i].order,
                instance
            );
            cards += card;
        }
        $('#ordenaPhrasesContainer-' + instance).append(cards);
    },

    createCard: function (
        j,
        type,
        url,
        text,
        audio,
        x,
        y,
        alt,
        color,
        backcolor,
        order,
        instance
    ) {
        const mOptions = $eXeOrdena.options[instance],
            malt = alt || '',
            fullimage =
                url.length > 3
                    ? `<a href="#" class="ODNP-FullLinkImage" title="${mOptions.msgs.msgFullScreen}">
                <strong><span class="sr-av">${mOptions.msgs.msgFullScreen}:</span></strong>
                <div  class="exeQuextIcons exeQuextIcons-FullImage ODNP-Activo"></div>
            </a>`
                    : '',
            saudio = `
            <a href="#" data-audio="${audio}" class="ODNP-LinkAudio" title="Audio">
                <img src="${$eXeOrdena.idevicePath}exequextplayaudio.svg" class="ODNP-Audio" alt="Audio">
            </a>
        `;
        const card = `<div class ="ODNP-NewCard">
            <div id="ordenaCardDraw-${instance}-${j}" class="ODNP-CardDraw ODNP-CC-${j}" data-number="${j}" data-order="${order}" data-type="${type}" data-state="-1">
                <div class="ODNP-CardContainer">
                    <div class="ODNP-Card1" data-type="${type}" data-state="-1" data-valid="0">
                        <div class="ODNP-CardFront"></div>
                        <div class="ODNP-CardBack">
                            <div class="ODNP-ImageContain">
                                <img src="" class="ODNP-Image" data-url="${url}" data-x="${x}" data-y="${y}" alt="${malt}" />
                                <img class="ODNP-Cursor" src="${$eXeOrdena.idevicePath}exequextcursor.gif" alt="" />
                                ${fullimage}
                            </div>
                            <div class="ODNP-EText" data-color="${color}" data-backcolor="${backcolor}">
                                <div class="ODNP-ETextDinamyc">${text}</div>
                            </div>
                            ${saudio}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
        return card;
    },

    setFontSize: function ($card, instance) {
        const $text = $card.find('.ODNP-EText'),
            latex =
                $text.find('mjx-container').length > 0 ||
                $exeDevices.iDevice.gamification.math.hasLatex($text.text());
        if (!latex) {
            $eXeOrdena.adjustFontSize($card);
        } else {
            $eXeOrdena.setFontSizeMath($text, instance);
        }
    },
    getNumberCards: function (instance) {
        const mOptions = $eXeOrdena.options[instance];
        return mOptions.phrasesGame[mOptions.active].cards.length;
    },

    setFontSizeMath($text, instance) {
        const numCards = $eXeOrdena.getNumberCards(instance),
            isFullScreen = $eXeOrdena.isFullScreen();
        let fontSize;

        const fontSizeSettings = [
            { threshold: 34, fullScreenSize: 10, normalSize: 8 },
            { threshold: 24, fullScreenSize: 12, normalSize: 10 },
            { threshold: 18, fullScreenSize: 16, normalSize: 14 },
            { threshold: 10, fullScreenSize: 18, normalSize: 16 },
        ];

        fontSize = isFullScreen ? 20 : 18;

        for (const setting of fontSizeSettings) {
            if (numCards > setting.threshold) {
                fontSize = isFullScreen
                    ? setting.fullScreenSize
                    : setting.normalSize;
                break;
            }
        }

        $text.css({ 'font-size': `${fontSize}px` });
    },
    adjustFontSize: function ($card) {
        const $container = $card.find('.ODNP-EText'),
            $text = $container.find('.ODNP-ETextDinamyc').eq(0),
            minFontSize = 10,
            maxFontSize = 26,
            widthc = $container.innerWidth(),
            heightc = $container.innerHeight();

        let fontSize = maxFontSize;

        $text.css('font-size', fontSize + 'px');

        while (
            ($text.outerWidth() > widthc || $text.outerHeight() > heightc) &&
            fontSize > minFontSize
        ) {
            fontSize--;
            $text.css('font-size', fontSize + 'px');
        }

        while (
            $text.outerWidth() < widthc &&
            $text.outerHeight() < heightc &&
            fontSize < maxFontSize
        ) {
            fontSize++;
            $text.css('font-size', fontSize + 'px');

            if ($text.outerWidth() > widthc || $text.outerHeight() > heightc) {
                fontSize--;
                $text.css('font-size', fontSize + 'px');
                break;
            }
        }
    },

    isFullScreen: function () {
        return (
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement != null
        );
    },

    clear: function (phrase) {
        return phrase.replace(/[&\s\n\r]+/g, ' ').trim();
    },

    addEvents: function (instance) {
        const mOptions = $eXeOrdena.options[instance];
        $eXeOrdena.removeEvents(instance);

        $(`#ordenaLinkMaximize-${instance}`).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $(`#ordenaGameContainer-${instance}`).show();
                $(`#ordenaGameMinimize-${instance}`).hide();
                if (!mOptions.gameStarted && !mOptions.gameOver) {
                    $eXeOrdena.refreshCards(instance);
                    $eXeOrdena.startGame(instance);
                    $(`#ordenaStartGame-${instance}`).hide();
                }
            }
        );

        $(`#ordenaLinkMinimize-${instance}`).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $(`#ordenaGameContainer-${instance}`).hide();
                $(`#ordenaGameMinimize-${instance}`)
                    .css('visibility', 'visible')
                    .show();
            }
        );

        $(
            `#ordenaCubierta-${instance}, #ordenaGameOver-${instance}, #ordenaCodeAccessDiv-${instance}, #ordenaPScore-${instance}, #ordenaPScoreIcon-${instance}, #ordenaPNumber-${instance}, #ordenaPNumberIcon-${instance}`
        ).hide();

        $(`#ordenaLinkFullScreen-${instance}`).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                const element = document.getElementById(
                    `ordenaGameContainer-${instance}`
                );
                $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                    element,
                    instance
                );
            }
        );

        $(`#ordenaFeedBackClose-${instance}`).on('click', function () {
            $(`#ordenaDivFeedBack-${instance}`).hide();
            $(`#ordenaGameOver-${instance}`).show();
        });

        if (mOptions.itinerary.showCodeAccess) {
            $(`#ordenaMesajeAccesCodeE-${instance}`).text(
                mOptions.itinerary.messageCodeAccess
            );
            $(`#ordenaCodeAccessDiv-${instance}`).show();
            $(`#ordenaStartLevels-${instance}`).hide();
            $(`#ordenaCubierta-${instance}`).show();
        }

        $(`#ordenaCodeAccessButton-${instance}`).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $eXeOrdena.enterCodeAccess(instance);
            }
        );

        $(`#ordenaCodeAccessE-${instance}`).on('keydown', function (event) {
            if (event.which === 13 || event.keyCode === 13) {
                $eXeOrdena.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        $(`#ordenaPNumber-${instance}`).text(mOptions.numberQuestions);

        $(window).on('unload.eXeOrdena beforeunload.eXeOrdena', function () {
            $exeDevices.iDevice.gamification.scorm.endScorm($eXeOrdena.mScorm);
        });

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        $('#ordenaMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $eXeOrdena.sendScore(false, instance);
                $eXeOrdena.saveEvaluation(instance);
            });

        $(`#ordenaImage-${instance}`).hide();

        $(`#ordenaStartGame-${instance}`).on('click', function (e) {
            e.preventDefault();
            $eXeOrdena.startGame(instance);
            $(this).hide();
        });

        $(`#ordenaStartGameEnd-${instance}`).on('click', function (e) {
            e.preventDefault();
            mOptions.phrasesGame =
                $exeDevices.iDevice.gamification.helpers.shuffleAds(
                    mOptions.phrasesGame
                );
            $eXeOrdena.showPhrase(0, instance);
            $eXeOrdena.startGame(instance);
            $(`#ordenaCubierta-${instance}`).hide();
            $(`#ordenaMultimedia-${instance}`)
                .find('.ODNP-NewCard')
                .removeClass('ODNP-CardOK ODNP-CardKO');
            $(`#ordenaMultimedia-${instance}`)
                .find('.ODNP-Card1')
                .addClass('flipped');
        });

        $(`#ordenaClueButton-${instance}`).on('click', function (e) {
            e.preventDefault();
            $(`#ordenaShowClue-${instance}`).hide();
            $(`#ordenaCubierta-${instance}`).fadeOut();
        });

        $(`#ordenaPErrors-${instance}`).text(
            mOptions.numberQuestions - mOptions.hits
        );

        if (mOptions.time === 0) {
            $(`#ordenaPTime-${instance}, #ordenaImgTime-${instance}`).hide();
            $eXeOrdena.uptateTime(mOptions.time * 60, instance);
        } else {
            $eXeOrdena.uptateTime(mOptions.time * 60, instance);
        }

        if (mOptions.author.trim().length > 0 && !mOptions.fullscreen) {
            $(`#ordenaAuthorGame-${instance}`)
                .html(`${mOptions.msgs.msgAuthor}; ${mOptions.author}`)
                .show();
        }

        $(
            `#ordenaNextPhrase-${instance}, #ordenaGameButtons-${instance}`
        ).hide();

        $(`#ordenaValidatePhrase-${instance}`).on('click', function (e) {
            e.preventDefault();
            let response = {};
            if (mOptions.type === 0) {
                response = $eXeOrdena.checkPhraseText(instance);
            } else {
                response =
                    mOptions.columns > 1 && mOptions.orderedColumns
                        ? $eXeOrdena.checkPhraseColumns(instance)
                        : $eXeOrdena.checkPhrase(instance);
            }
            const valids =
                mOptions.type > 0 && mOptions.orderedColumns
                    ? response.valids.length - mOptions.gameColumns
                    : response.valids.length;
            let msg = `${$eXeOrdena.updateScore(response.correct, instance)} ${mOptions.msgs.msgPositions}: ${valids}. `;
            let color = $eXeOrdena.borderColors.red;
            if (response.correct) {
                msg = mOptions.customMessages
                    ? mOptions.phrasesGame[mOptions.active].msgHit
                    : mOptions.msgs.msgAllOK;
                color = $eXeOrdena.borderColors.green;
                if (
                    mOptions.phrase.audioHit &&
                    mOptions.phrase.audioHit.length > 4
                ) {
                    $exeDevices.iDevice.gamification.media.playSound(
                        mOptions.phrase.audioHit,
                        mOptions
                    );
                }
                $eXeOrdena.nextPhrase(instance);
            } else {
                msg = mOptions.customMessages
                    ? mOptions.phrasesGame[mOptions.active].msgError
                    : msg;
                if (
                    mOptions.phrase.audioError &&
                    mOptions.phrase.audioError.length > 4
                ) {
                    $exeDevices.iDevice.gamification.media.playSound(
                        mOptions.phrase.audioError,
                        mOptions
                    );
                }
            }
            $(`#ordenaHistsGame-${instance}`).html(msg).css('color', color);
            if (mOptions.type === 1 && mOptions.showSolution) {
                $eXeOrdena.activeCorrects(instance, response.valids);
            }
            $(`#ordenaValidatePhrase-${instance}`).hide();
            $eXeOrdena.saveEvaluation(instance);
            if (mOptions.isScorm == 1) {
                $eXeOrdena.sendScore(true, instance);
            }
        });

        $('#ordenaMainContainer-' + instance)
            .closest('article')
            .on('click', '.box-toggle-on', function (e) {
                $eXeOrdena.refreshGame(instance);
            });

        $('#descubreEURLImgCard').on('change', () =>
            $exeDevice.loadImageCard()
        );

        $('#descubreEPlayCard').on('click', (e) => {
            e.preventDefault();
            $exeDevice.loadImageCard();
        });

        setTimeout(function () {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                this.isInExe
            );
        }, 500);

        mOptions.refreshCard = false;
    },

    removeEvents: function (instance) {
        $(`#ordenaLinkMaximize-${instance}`).off('click touchstart');
        $(`#ordenaLinkMinimize-${instance}`).off('click touchstart');
        $(`#ordenaLinkFullScreen-${instance}`).off('click touchstart');
        $(`#ordenaFeedBackClose-${instance}`).off('click');
        $(`#ordenaCodeAccessButton-${instance}`).off('click touchstart');
        $(`#ordenaCodeAccessE-${instance}`).off('keydown');
        $('#ordenaMainContainer-' + instance)
            .closest('.idevice_node')
            .off('click', '.Games-SendScore');
        $(`#ordenaStartGame-${instance}`).off('click');
        $(`#ordenaStartGameEnd-${instance}`).off('click');
        $(`#ordenaClueButton-${instance}`).off('click');
        $(`#ordenaValidatePhrase-${instance}`).off('click');

        $(window).off('unload.eXeOrdena beforeunload.eXeOrdena');
    },

    moveCard: function ($dragged, $target, instance) {
        const mOptions = $eXeOrdena.options[instance];

        if (!mOptions.gameStarted || mOptions.gameOver) return;

        if (mOptions.orderedColumns) {
            const ord = parseInt($target.find('.ODNP-CardDraw').data('order'));
            if (ord < mOptions.gameColumns) return;
        }

        const $multimedia = $('#ordenaMultimedia-' + instance),
            draggedContent = $dragged.html(),
            targetContent = $target.html();

        $dragged.html(targetContent);
        $target.html(draggedContent);

        $multimedia
            .find('.ODNP-NewCard')
            .removeClass('ODNP-CardOK ODNP-CardKO');
        $('#ordenaValidatePhrase-' + instance).show();
        $('#ordenaHistsGame-' + instance).text('');

        const html = $multimedia.html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);
        if (latex)
            $exeDevices.iDevice.gamification.math.updateLatex(
                '#ordenaMultimedia-' + instance
            );
    },

    initializePhraseDragAndDrop: function (instance, num) {
        if (!$.ui || !$.ui.draggable || !$.ui.droppable) return;

        const mOptions = $eXeOrdena.options[instance];
        const $ordenaPhrasesContainer = $(
            '#ordenaPhrasesContainer-' + instance
        );
        // multimedia container is used below when num>0
        const $ordenaMultimedia = $('#ordenaMultimedia-' + instance);
        // ensure local variable for cards (avoid implicit global)
        let $cards = null;
        const $sources = $ordenaPhrasesContainer.find('.ODNP-Word');
        const $targets = $('#ordenaPhrasesContainer-' + instance).find(
            '.ODNP-WordTarget'
        );

        $sources.css('cursor', 'pointer');

        if (mOptions.orderedColumns) {
            $cards = $('.ODNP-NewCard').filter(function () {
                const child = $(this).find('.ODNP-CardDraw');
                return (
                    child.length > 0 &&
                    parseInt(child.data('order'), 10) < mOptions.gameColumns
                );
            });
        }

        if (num > 0) {
            $ordenaMultimedia.find('.ODNP-Card1').addClass('flipped');
            $eXeOrdena.showMessage(0, mOptions.phrase.definition, instance);
            if (
                typeof mOptions.phrase.audioDefinition !== 'undefined' &&
                mOptions.phrase.audioDefinition.length > 4
            ) {
                $exeDevices.iDevice.gamification.media.playSound(
                    mOptions.phrase.audioDefinition,
                    mOptions
                );
            }
        }

        $sources.draggable({
            revert: 'invalid',
            cursor: 'move',
            containment: 'document',
            helper: 'clone',
            appendTo: '.ODNP-GameContainer-' + instance,
            start: function (event, ui) {
                $(this).addClass('ODPN-WordDragging');
                if (ui.helper) {
                    ui.helper.css({
                        width: $(this).width() + 12 + 'px',
                        height: $(this).height() + 4 + 'px',
                        'z-index': 1000,
                        'background-color': 'white',
                        display: 'flex',
                        'align-items': 'center',
                        'justify-content': 'center',
                        'box-shadow':
                            '0 2px 4px 0 rgba(0, 0, 0, 0.20), 0 3px 6px 0 rgba(0, 0, 0, 0.19)',
                    });
                }
            },
            stop: function (event, ui) {
                $(this).removeClass('ODPN-WordDragging');
                if (ui.helper) {
                    ui.helper.css('z-index', 1);
                }
            },
        });

        $targets.droppable({
            accept: '.ODNP-Word',
            over: function (_event, ui) {
                $(this).addClass('ODNP-WordOver');
                ui.draggable.css('z-index', 1000);
            },
            out: function () {
                $(this).removeClass('ODNP-WordOver');
            },
            drop: function (event, ui) {
                $(this).removeClass('ODNP-WordOver');
                const $dragged = $(ui.draggable);
                const $target = $(this);
                $eXeOrdena.moveCard($dragged, $target, instance);
            },
        });
    },

    moveCardPharse: function ($dragged, $target, instance) {
        const mOptions = $eXeOrdena.options[instance];

        if (!mOptions.gameStarted || mOptions.gameOver) return;

        const draggedContent = $dragged.html(),
            targetContent = $target.html();

        $dragged.html(targetContent);
        $target.html(draggedContent);

        $(`#ordenaValidatePhrase-${instance}`).show();
        $(`#ordenaHistsGame-${instance}`).text('');
    },

    checkPhraseText: function (instance) {
        const mOptions = $eXeOrdena.options[instance],
            valids = [];
        let correct = true;

        const wordsInTargetContainer = $(`#ordenaPhrasesContainer-${instance}`)
            .find('.ODNP-Word')
            .map(function () {
                return $(this).text();
            })
            .get();
        for (let i = 0; i < mOptions.correctOrder.length; i++) {
            if (mOptions.correctOrder[i] !== wordsInTargetContainer[i]) {
                correct = false;
            } else {
                if (mOptions.showSolution) {
                    $(`#ordenaPhrasesContainer-${instance}`)
                        .find('.ODNP-Word')
                        .eq(i)
                        .addClass('ODNP-WordCorrect');
                }
                valids.push(i);
            }
        }
        return {
            correct: correct,
            valids: valids,
        };
    },

    checkAudio: function (card, instance) {
        const audio = $(card).find('.ODNP-LinkAudio').data('audio'),
            mOptions = $eXeOrdena.options[instance];
        if (audio && audio.length > 3) {
            $exeDevices.iDevice.gamification.media.playSound(audio, mOptions);
        }
    },

    createCardPhrase: function (j, text, order, instance) {
        const mOptions = $eXeOrdena.options[instance];
        const wordBorder = mOptions.wordBorder ? 'ODNP-WordBorder' : '';
        return `<div class="ODNP-Word ODNP-WordTarget ${wordBorder}" data-number="${j}" data-order="${order}">${text}</div>`;
    },

    nextPhrase: function (instance) {
        const mOptions = $eXeOrdena.options[instance];
        $exeDevices.iDevice.gamification.media.stopSound(mOptions);
        setTimeout(() => {
            const $histsGame = $(`#ordenaHistsGame-${instance}`);
            $histsGame.html('');
            mOptions.active++;
            if (mOptions.active < mOptions.phrasesGame.length) {
                if (mOptions.type === 0) {
                    $eXeOrdena.showPhraseText(mOptions.active, instance);
                } else {
                    $eXeOrdena.showPhrase(mOptions.active, instance);
                }
                $(`#ordenaValidatePhrase-${instance}`).show();
            } else {
                $eXeOrdena.gameOver(0, instance);
            }
        }, mOptions.timeShowSolution * 1000);
    },

    activeCorrects: function (instance, valids) {
        const mOptions = $eXeOrdena.options[instance],
            $cardDraws = $(`#ordenaMultimedia-${instance}`).find(
                '.ODNP-NewCard'
            );

        $cardDraws.each(function () {
            const order = parseInt(
                $(this).find('.ODNP-CardDraw').data('order'),
                10
            );
            $(this).removeClass('ODNP-CardOK ODNP-CardKO');
            if (
                valids.includes(order) &&
                (!mOptions.orderedColumns || order >= mOptions.gameColumns)
            ) {
                $(this).addClass('ODNP-CardOK');
            }
        });
    },

    getColors: function (number) {
        const colors = [];
        for (let i = 0; i < number; i++) {
            colors.push($eXeOrdena.colorRGB());
        }
        return colors;
    },

    colorRGB: function () {
        const r = Math.floor(Math.random() * 255),
            g = Math.floor(Math.random() * 255),
            b = Math.floor(Math.random() * 255);
        return `rgb(${r},${g},${b})`;
    },

    updateCovers: function (instance) {
        const $cardContainers = $(`#ordenaMultimedia-${instance}`).find(
            '.ODNP-CardDraw'
        );
        $cardContainers.each(function () {
            const $card = $(this).find('.ODNP-Card1').eq(0);
            $card.removeClass('ODNP-CardActive flipped');
        });
    },

    showCard: function (card) {
        const $card = $(card),
            $noImage = $card.find('.ODNP-Cover').eq(0),
            $text = $card.find('.ODNP-EText').eq(0),
            $textdinamic = $card.find('.ODNP-ETextDinamyc').eq(0),
            $image = $card.find('.ODNP-Image').eq(0),
            $cursor = $card.find('.ODNP-Cursor').eq(0),
            $audio = $card.find('.ODNP-LinkAudio').eq(0),
            type = parseInt($card.data('type'), 10),
            x = parseFloat($image.data('x')),
            y = parseFloat($image.data('y')),
            url = $image.data('url'),
            alt = $image.attr('alt') || 'No disponible',
            audioData = $audio.data('audio') || '',
            textContent = $text.html() || '',
            color = $text.data('color'),
            backcolor = $text.data('backcolor');

        $text.hide();
        $image.hide();
        $cursor.hide();
        $audio.hide();
        $noImage.show();

        if (type === 1) {
            $text.show().css({
                color: color,
                'background-color': backcolor,
            });
            $textdinamic.css({
                color: color,
            });
        } else if (type === 0 && url.length > 3) {
            $image
                .attr('alt', alt)
                .show()
                .prop('src', url)
                .on('load', function () {
                    if (
                        !this.complete ||
                        typeof this.naturalWidth === 'undefined' ||
                        this.naturalWidth === 0
                    ) {
                        $cursor.hide();
                    } else {
                        $image.show();
                        $cursor.hide();
                        $eXeOrdena.positionPointerCard($cursor, x, y);
                    }
                })
                .on('error', function () {
                    $cursor.hide();
                });
        } else if (type === 2) {
            if (url.length > 3) {
                $image
                    .attr('alt', alt)
                    .show()
                    .prop('src', url)
                    .on('load', function () {
                        if (
                            !this.complete ||
                            typeof this.naturalWidth === 'undefined' ||
                            this.naturalWidth === 0
                        ) {
                            $cursor.hide();
                        } else {
                            $image.show();
                            $cursor.hide();
                            $eXeOrdena.positionPointerCard($cursor, x, y);
                        }
                    })
                    .on('error', function () {
                        $cursor.hide();
                    });
                $text.show().css({
                    color: '#000',
                    'background-color': 'rgba(255, 255, 255, 0.7)',
                });
            } else {
                $image.attr('alt', 'No image').hide();
                $text.show().css({
                    color: '#000',
                    'background-color': 'white',
                });
                $textdinamic.css({
                    color: '#000',
                });
            }
            if (textContent.length === 0) {
                $text.hide();
            }
        }

        $audio.removeClass('ODNP-LinkAudioBig');
        if (audioData.length > 0) {
            if (url.trim().length === 0 && textContent.trim().length === 0) {
                $audio.addClass('ODNP-LinkAudioBig');
            }
            $audio.show();
        }
        $noImage.hide();
    },

    positionPointerCard: function ($cursor, x, y) {
        $cursor.hide();
        if (x > 0 || y > 0) {
            const parentClass = '.ODNP-ImageContain',
                siblingClass = '.ODNP-Image',
                $containerElement = $cursor.parents(parentClass).eq(0),
                $imgElement = $cursor.siblings(siblingClass).eq(0),
                containerPos = $containerElement.offset(),
                imgPos = $imgElement.offset(),
                marginTop = imgPos.top - containerPos.top,
                marginLeft = imgPos.left - containerPos.left,
                mx = marginLeft + x * $imgElement.width(),
                my = marginTop + y * $imgElement.height();

            $cursor.css({ left: mx, top: my, 'z-index': 30 }).show();
        }
    },

    alfaBColor: function (bcolor) {
        return bcolor.replace('rgb', 'rgba').replace(')', ',.8)');
    },

    refreshGame: function (instance) {
        const mOptions = $eXeOrdena.options[instance];
        if (!mOptions) return;

        mOptions.fullscreen = !!(
            document.fullscreenElement ||
            document.mozFullScreenElement ||
            document.webkitFullscreenElement ||
            document.msFullscreenElement
        );

        if (!mOptions.refreshCard) $eXeOrdena.refreshCards(instance);
    },

    refreshCards: function (instance) {
        const mOptions = $eXeOrdena.options[instance],
            $flcds = $(`#ordenaMultimedia-${instance}`).find('.ODNP-CardDraw');

        mOptions.refreshCard = true;
        $eXeOrdena.setSize(instance);
        $flcds.each(function () {
            const $card = $(this),
                $imageF = $card.find('.ODNP-Image').eq(0),
                $cursorF = $card.find('.ODNP-Cursor').eq(0),
                xF = parseFloat($imageF.data('x')) || 0,
                yF = parseFloat($imageF.data('y')) || 0;
            $eXeOrdena.positionPointerCard($cursorF, xF, yF);
            $eXeOrdena.setFontSize($card, instance);
        });
        mOptions.refreshCard = false;
    },

    enterCodeAccess: function (instance) {
        const mOptions = $eXeOrdena.options[instance],
            enteredCode = $(`#ordenaCodeAccessE-${instance}`).val();
        if (mOptions.itinerary.codeAccess === enteredCode) {
            $('#ordenaStartGame-' + instance).click();
            $(
                `#ordenaCodeAccessDiv-${instance}, #ordenaCubierta-${instance}`
            ).hide();
            $(`#ordenaStartLevels-${instance}`).show();
        } else {
            const $message = $(`#ordenaMesajeAccesCodeE-${instance}`);
            $message.fadeOut(300).fadeIn(200).fadeOut(300).fadeIn(200);
            $(`#ordenaCodeAccessE-${instance}`).val('');
        }
    },

    setSize: function (instance) {
        const mOptions = $eXeOrdena.options[instance];

        if (mOptions.type == 0) return;

        const numCards = mOptions.phrase.cards.length,
            $ordenaGameScoreBoard = $(`#ordenaGameScoreBoard-${instance}`),
            $ordenaStartGame0 = $(`#ordenaStartGame0-${instance}`),
            h =
                screen.height -
                $ordenaGameScoreBoard.height() -
                2 * $ordenaStartGame0.height();

        let size = '12%',
            msize = '12%',
            sizes = [],
            puntos = [];

        for (let i = 2; i < 20; i++) {
            const w = Math.floor((screen.width - i * 24) / i),
                nf = Math.floor(h / w);
            puntos.push(i * nf);
            sizes.push(`${w}px`);
        }

        for (let i = 0; i < puntos.length; i++) {
            if (numCards < puntos[i]) {
                msize = sizes[i];
                break;
            }
        }

        if (window.innerWidth < 550) {
            size = '36%';
        } else if (window.innerWidth < 800) {
            size = '24%';
        } else if (mOptions.fullscreen) {
            size = parseInt(msize, 10) <= 300 ? msize : '300px';
        } else if (numCards < 13) {
            size = '18%';
        } else if (numCards < 19) {
            size = '16%';
        } else if (numCards < 35) {
            size = '14%';
        } else if (numCards < 49) {
            size = '11%';
        } else if (numCards < 63) {
            size = '10%';
        } else if (numCards < 70) {
            size = '9%';
        } else if (numCards <= 80) {
            size = '8%';
        }

        if (mOptions.gameColumns > 0) {
            $eXeOrdena.gameColumns(instance);
            return;
        }

        const $ordenaMultimedia = $(`#ordenaMultimedia-${instance}`);
        $ordenaMultimedia.find('.ODNP-NewCard').each(function () {
            $(this).css({
                width: size,
            });
            $eXeOrdena.setFontSize($(this), instance);
        });
    },

    gameColumns: function (instance) {
        const mOptions = $eXeOrdena.options[instance],
            wIdevice = $('#ordenaMultimedia-' + instance).width();
        let wCard = 250,
            hCard = 200,
            columns = '1fr',
            fsize = '1em';

        if (mOptions.gameColumns == 'undefined' || mOptions.gameColumns == 0)
            return;

        if (mOptions.gameColumns == 1) {
            wCard = wIdevice * 0.9 > 250 ? 250 : wIdevice / 2;
            columns = '1fr';
            fsize = '1.5em';
        } else if (mOptions.gameColumns == 2) {
            wCard = wIdevice * 0.42 > 250 ? 250 : wIdevice * 0.42;
            columns = '1fr 1fr';
            fsize = '1.4em';
        } else if (mOptions.gameColumns == 3) {
            wCard = wIdevice * 0.28 > 250 ? 250 : wIdevice * 0.28;
            columns = '1fr 1fr 1fr';
            fsize = '1.3em';
        } else if (mOptions.gameColumns == 4) {
            wCard = wIdevice * 0.2 > 250 ? 250 : wIdevice * 0.2;
            columns = '1fr 1fr 1fr 1fr';
            fsize = '1.1em';
        } else if (mOptions.gameColumns == 5) {
            wCard = wIdevice * 0.16 > 250 ? 250 : wIdevice * 0.16;
            columns = '1fr 1fr 1fr 1fr 1fr';
        }

        let wCard1 =
            mOptions.maxWidth && mOptions.gameColumns > 0
                ? '100%'
                : wCard + 'px';

        hCard =
            mOptions.maxWidth &&
            mOptions.gameColumns > 0 &&
            mOptions.cardHeight > 0
                ? mOptions.cardHeight + 'px'
                : 'auto';
        if (
            window.innerWidth < 640 &&
            hCard != 'auto' &&
            parseInt(hCard) > wCard
        ) {
            fsize = '0.8em';
            hCard = wCard + 50 + 'px';
        }

        $('#ordenaMultimedia-' + instance).css({
            padding: '0 1em',
            display: 'grid',
            'grid-template-columns': columns,
            'grid-template-rows': 'auto',
        });

        $('#ordenaMultimedia-' + instance)
            .find('.ODNP-NewCard ')
            .each(function () {
                $(this).css({
                    width: wCard1,
                    'max-width': wCard1,
                    'justify-self': 'center',
                    height: hCard,
                    margin: 0,
                });
            });

        $('#ordenaMultimedia-' + instance)
            .find('.ODNP-EText')
            .css({
                'font-size': fsize,
            });

        if (
            mOptions.maxWidth &&
            mOptions.gameColumns > 0 &&
            mOptions.cardHeight > 0
        ) {
            if (mOptions.maxWidth && mOptions.cardHeight > 0) {
                $('#ordenaMultimedia-' + instance)
                    .find('div.ODNP-CardContainer')
                    .addClass('ODNP-Before');
            }
            setTimeout(function () {
                const wOne = $('#ordenaMultimedia-' + instance)
                    .find('.ODNP-NewCard ')
                    .eq(0)
                    .width();
                $('#ordenaMultimedia-' + instance)
                    .find('.ODNP-NewCard ')
                    .width(wOne);
            }, 1000);
        }
    },

    initCards: function (instance) {
        const $cards = $('#ordenaMultimedia-' + instance).find(
            '.ODNP-CardDraw'
        );
        $cards.each(function () {
            $eXeOrdena.showCard($(this));
        });
        const html = $('#ordenaMultimedia-' + instance).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);
        if (latex)
            $exeDevices.iDevice.gamification.math.updateLatex(
                '#ordenaMultimedia-' + instance
            );

        $eXeOrdena.setSize(instance);
    },

    startGame: function (instance) {
        const mOptions = $eXeOrdena.options[instance];

        if (mOptions.gameStarted) return;
        if (mOptions.type == 0) $('#ordenaPhrasesContainer-' + instance).show();
        if (mOptions.type == 1)
            $eXeOrdena.showMessage(3, mOptions.phrase.definition, instance);

        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.scorerp = 0;
        mOptions.gameActived = true;
        mOptions.counter = mOptions.time * 60;
        mOptions.gameOver = false;
        mOptions.gameStarted = false;
        mOptions.obtainedClue = false;
        mOptions.nattempts = mOptions.attempts > 0 ? mOptions.attempts : 0;

        $('#ordenaGameButtons-' + instance).css('display', 'flex');
        $('#ordenaGameButtons-' + instance).show();
        $('#ordenaPShowClue-' + instance).text('');
        $('#ordenaShowClue-' + instance).hide();
        $('#ordenaPHits-' + instance).text(mOptions.hits);
        $('#ordenaPErrors-' + instance).text(
            mOptions.numberQuestions - mOptions.hits
        );
        $('#ordenaCubierta-' + instance).hide();
        $('#ordenaGameOver-' + instance).hide();

        $eXeOrdena.initCards(instance);

        if (mOptions.time == 0) {
            $('#ordenaPTime-' + instance).hide();
            $('#ordenaImgTime-' + instance).hide();
        }

        if (mOptions.time > 0) {
            mOptions.counterClock = setInterval(function () {
                let $node = $('#ordenaMainContainer-' + instance);
                let $content = $('#node-content');
                if (
                    !$node.length ||
                    ($content.length && $content.attr('mode') === 'edition')
                ) {
                    clearInterval(mOptions.counterClock);
                    return;
                }
                if (mOptions.gameStarted) {
                    mOptions.counter--;
                    if (mOptions.counter <= 0) {
                        $eXeOrdena.gameOver(2, instance);
                        return;
                    }
                }
                $eXeOrdena.uptateTime(mOptions.counter, instance);
            }, 1000);
            $eXeOrdena.uptateTime(mOptions.time * 60, instance);
        }
        if (mOptions.type === 1) {
            $('#ordenaMultimedia-' + instance)
                .find('.ODNP-Card1')
                .each(function () {
                    $(this).addClass('flipped');
                    $eXeOrdena.setFontSize($(this), instance);
                });

            if (
                typeof mOptions.phrase.audioDefinition != 'undefined' &&
                mOptions.phrase.audioDefinition.length > 4
            ) {
                $exeDevices.iDevice.gamification.media.playSound(
                    mOptions.phrase.audioDefinition,
                    mOptions
                );
            }
        }

        mOptions.gameStarted = true;
    },

    uptateTime: function (tiempo, instance) {
        const mOptions = $eXeOrdena.options[instance];
        if (mOptions.time == 0) return;
        $('#ordenaPTime-' + instance).text(
            $exeDevices.iDevice.gamification.helpers.getTimeToString(tiempo)
        );
    },

    showScoreGame: function (type, instance) {
        const mOptions = $eXeOrdena.options[instance],
            msgs = mOptions.msgs,
            $ordenaHistGame = $('#ordenaHistGame-' + instance),
            $ordenaLostGame = $('#ordenaLostGame-' + instance),
            $ordenaOverNumCards = $('#ordenaOverNumCards-' + instance),
            $ordenaOverHits = $('#ordenaOverHits-' + instance),
            $ordenaOverAttemps = $('#ordenaOverAttemps-' + instance),
            $ordenaCubierta = $('#ordenaCubierta-' + instance),
            $ordenaGameOver = $('#ordenaGameOver-' + instance);

        let message = '',
            messageColor = 1,
            mclue = '';

        $ordenaHistGame.hide();
        $ordenaLostGame.hide();
        $ordenaOverNumCards.show();
        $ordenaOverHits.show();
        $ordenaOverAttemps.show();

        switch (parseInt(type)) {
            case 0:
                message = msgs.msgCool + ' ' + msgs.mgsAllPhrases;
                messageColor = 2;
                $ordenaHistGame.show();
                if (mOptions.itinerary.showClue) {
                    if (mOptions.obtainedClue) {
                        mclue = mOptions.itinerary.clueGame;
                    } else {
                        mclue = msgs.msgTryAgain.replace(
                            '%s',
                            mOptions.itinerary.percentageClue
                        );
                    }
                }
                break;
            case 1:
                messageColor = 3;
                $ordenaLostGame.show();
                if (mOptions.itinerary.showClue) {
                    if (mOptions.obtainedClue) {
                        mclue = mOptions.itinerary.clueGame;
                    } else {
                        mclue = msgs.msgTryAgain.replace(
                            '%s',
                            mOptions.itinerary.percentageClue
                        );
                    }
                }
                break;
            case 2:
                messageColor = 3;
                message = msgs.msgTimeOver;
                $ordenaLostGame.show();
                if (mOptions.itinerary.showClue) {
                    if (mOptions.obtainedClue) {
                        mclue = mOptions.itinerary.clueGame;
                    } else {
                        mclue = msgs.msgTryAgain.replace(
                            '%s',
                            mOptions.itinerary.percentageClue
                        );
                    }
                }
                break;
            case 3:
                messageColor = 3;
                message = msgs.msgAllAttemps;
                $ordenaLostGame.show();
                if (mOptions.itinerary.showClue) {
                    if (mOptions.obtainedClue) {
                        mclue = mOptions.itinerary.clueGame;
                    } else {
                        mclue = msgs.msgTryAgain.replace(
                            '%s',
                            mOptions.itinerary.percentageClue
                        );
                    }
                }
                break;
            default:
                break;
        }

        const attemps =
            mOptions.attempts > 0
                ? mOptions.attempts - mOptions.nattempts
                : mOptions.nattempts;

        $eXeOrdena.showMessage(messageColor, message, instance, true);

        $ordenaOverNumCards.html(
            msgs.msgActivities + ': ' + mOptions.phrasesGame.length
        );

        if (mOptions.type == 0)
            $ordenaOverNumCards.html(
                msgs.msgPhrases + ': ' + mOptions.phrasesGame.length
            );

        $ordenaOverHits.html(msgs.msgHits + ': ' + mOptions.hits);
        $ordenaOverAttemps.html(msgs.msgAttempts + ': ' + attemps);
        $ordenaGameOver.show();
        $ordenaCubierta.show();
        $ordenaOverAttemps.hide();
        $('#ordenaShowClue-' + instance).hide();
        if (mOptions.itinerary.showClue)
            $eXeOrdena.showMessage(3, mclue, instance, true);
    },

    gameOver: function (type, instance) {
        const mOptions = $eXeOrdena.options[instance];

        if (!mOptions.gameStarted) return;

        mOptions.gameStarted = false;
        mOptions.gameActived = false;
        mOptions.gameOver = true;
        let points = mOptions.hits / mOptions.numberQuestions;
        if (points * 100 >= mOptions.itinerary.percentageClue) {
            mOptions.obtainedClue = true;
        }
        clearInterval(mOptions.counterClock);
        $exeDevices.iDevice.gamification.media.stopSound(mOptions);
        $('#ordenaCubierta-' + instance).show();
        $('#ordenaPhrasesContainer-' + instance).hide();
        $eXeOrdena.showScoreGame(type, instance);
        $eXeOrdena.saveEvaluation(instance);
        if (mOptions.isScorm == 1) {
            const score = (
                (mOptions.hits * 10) /
                mOptions.numberQuestions
            ).toFixed(2);
            $eXeOrdena.sendScore(true, instance);
            $('#ordenaRepeatActivity-' + instance).text(
                mOptions.msgs.msgYouScore + ': ' + score
            );
            $eXeOrdena.initialScore = score;
        }
        $eXeOrdena.showFeedBack(instance);
    },

    showFeedBack: function (instance) {
        const mOptions = $eXeOrdena.options[instance],
            puntos = (mOptions.hits * 100) / mOptions.phrasesGame.length;
        if (mOptions.feedBack) {
            if (puntos >= mOptions.percentajeFB) {
                $('#ordenaGameOver-' + instance).hide();
                $('#ordenaDivFeedBack-' + instance)
                    .find('.ordena-feedback-game')
                    .show();
                $('#ordenaDivFeedBack-' + instance).show();
            } else {
                $eXeOrdena.showMessage(
                    1,
                    mOptions.msgs.msgTryAgain.replace(
                        '%s',
                        mOptions.percentajeFB
                    ),
                    instance,
                    false
                );
            }
        }
    },

    isMobile: function () {
        return (
            navigator.userAgent.match(/Android/i) ||
            navigator.userAgent.match(/BlackBerry/i) ||
            navigator.userAgent.match(/iPhone|iPad|iPod/i) ||
            navigator.userAgent.match(/Opera Mini/i) ||
            navigator.userAgent.match(/IEMobile/i)
        );
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
                'z-index': 23,
            });
            $(cursor).show();
        }
    },

    getRetroFeedMessages: function (iHit, instance) {
        const mOptions = $eXeOrdena.options[instance];
        let sMessages = iHit
            ? mOptions.msgs.msgSuccesses
            : mOptions.msgs.msgFailures;
        sMessages = sMessages.split('|');
        return sMessages[Math.floor(Math.random() * sMessages.length)];
    },

    updateScore: function (correctAnswer, instance) {
        const mOptions = $eXeOrdena.options[instance];

        let message = '',
            obtainedPoints = 0,
            sscore = 0;

        if (correctAnswer) {
            mOptions.hits++;
            obtainedPoints = 10 / mOptions.phrasesGame.length;
        }

        if (mOptions.attempts > 0) {
            mOptions.nattempts--;
        } else {
            mOptions.nattempts++;
        }

        mOptions.score = mOptions.score + obtainedPoints;
        sscore =
            mOptions.score % 1 == 0
                ? mOptions.score
                : mOptions.score.toFixed(2);

        $('#ordenaPErrors-' + instance).text(
            mOptions.numberQuestions - mOptions.hits
        );
        $('#ordenaPScore-' + instance).text(sscore);
        $('#ordenaPHits-' + instance).text(mOptions.hits);

        if (
            mOptions.attempts > 0 &&
            mOptions.nattempts == 0 &&
            mOptions.hits < mOptions.phrasesGame.length
        ) {
            mOptions.gameActived = false;
            setTimeout(function () {
                $eXeOrdena.gameOver(3, instance);
            }, mOptions.timeShowSolution);
        }

        message = $eXeOrdena.getMessageAnswer(correctAnswer, instance);
        return message;
    },

    getMessageAnswer: function (correctAnswer, instance) {
        return correctAnswer
            ? $eXeOrdena.getMessageCorrectAnswer(instance)
            : $eXeOrdena.getMessageErrorAnswer(instance);
    },

    getMessageCorrectAnswer: function (instance) {
        const mOptions = $eXeOrdena.options[instance],
            messageCorrect = $eXeOrdena.getRetroFeedMessages(true, instance);

        let message = messageCorrect + ' ' + mOptions.msgs.msgCompletedPair;
        if (
            mOptions.customMessages &&
            mOptions.phrasesGame[mOptions.active].msgHit.length > 0
        ) {
            message = mOptions.phrasesGame[mOptions.active].msgHit;
        }
        return message;
    },

    getMessageErrorAnswer: function (instance) {
        return $eXeOrdena.getRetroFeedMessages(false, instance);
    },

    showMessage: function (type, message, instance, end) {
        const colors = [
                '#555555',
                $eXeOrdena.borderColors.red,
                $eXeOrdena.borderColors.green,
                $eXeOrdena.borderColors.blue,
                $eXeOrdena.borderColors.yellow,
            ],
            color = colors[type],
            $ordenaMessage = $('#ordenaMessage-' + instance);

        $ordenaMessage.html(message);
        $ordenaMessage.css({
            color: color,
            'font-style': 'bold',
        });
        $ordenaMessage.show();

        if (end) {
            $ordenaMessage.hide();
            $('#ordenaMesasgeEnd-' + instance).text(message);
            $('#ordenaMesasgeEnd-' + instance).css({
                color: color,
            });
        }
    },
};
$(function () {
    $eXeOrdena.init();
});
