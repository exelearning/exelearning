/* eslint-disable no-undef */
/**
 * flip cards activity (Export)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 *
 */
var $eXeFlipCards = {
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
    scorm: '',
    previousScore: '',
    initialScore: '',
    hasLATEX: false,
    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',
    mScorm: null,

    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            'Memory cards',
            'flipcards',
            'flipcards-IDevice'
        );
    },

    enable: function () {
        $eXeFlipCards.loadGame();
    },

    loadGame: function () {
        $eXeFlipCards.options = [];
        $eXeFlipCards.activities.each(function (i) {
            const dl = $('.flipcards-DataGame', this),
                $imageBack = $('.flipcard-ImageBack', this),
                mOption = $eXeFlipCards.loadDataGame(dl, this);

            mOption.scorerp = 0;
            mOption.idevicePath = $eXeFlipCards.idevicePath;
            mOption.main = 'flcdsMainContainer-' + i;
            mOption.idevice = 'flipcards-IDevice';
            mOption.imgCard = '';
            if ($imageBack.length == 1) {
                mOption.imgCard = $imageBack.attr('href') || '';
            }

            $eXeFlipCards.options.push(mOption);

            if (mOption.type == 3) {
                mOption.cardsGame = $eXeFlipCards.createCardsData(
                    mOption.cardsGame
                );
            }

            const flcds = $eXeFlipCards.createInterfaceCards(i);
            dl.before(flcds).remove();

            $('#flcdsGameMinimize-' + i).hide();
            $('#flcdsGameContainer-' + i).hide();
            $('#flcdsNavigation-' + i).hide();
            $('#flcdsCubierta-' + i).hide();

            if (mOption.showMinimize) {
                $('#flcdsGameMinimize-' + i)
                    .css({
                        cursor: 'pointer',
                    })
                    .show();
            } else {
                $('#flcdsGameContainer-' + i).show();
            }

            $eXeFlipCards.showActivity(i);
            $eXeFlipCards.addEvents(i);

            if (mOption.type < 2) {
                $('#flcdsGameContainer-' + i)
                    .find('.exeQuextIcons-Hit')
                    .hide();
                $('#flcdsGameContainer-' + i)
                    .find('.exeQuextIcons-Error')
                    .hide();
                $('#flcdsGameContainer-' + i)
                    .find('.exeQuextIcons-Score')
                    .hide();
                $('#flcdsPHits-' + i).hide();
                $('#flcdsPErrors-' + i).hide();
                $('#flcdsPScore-' + i).hide();
            }
            if (mOption.type == 3) {
                $('#flcdsGameContainer-' + i)
                    .find('.exeQuextIcons-Error')
                    .hide();
                $('#flcdsPErrors-' + i).hide();
            }
            $('#flcdsMainContainer-' + i).show();
        });

        let node = document.querySelector('.page-content');
        if (this.isInExe) {
            node = document.getElementById('node-content');
        }
        if (node)
            $exeDevices.iDevice.gamification.observers.observeResize(
                $eXeFlipCards,
                node
            );

        if (this.hasLATEX) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '.flipcards-IDevice'
            );
        }
    },

    getCardDefault: function () {
        return {
            id: '',
            type: 2,
            url: '',
            audio: '',
            x: 0,
            y: 0,
            author: '',
            alt: '',
            eText: '',
            color: '#000000',
            backcolor: '#ffffff',
            correct: 0,
            urlBk: '',
            audioBk: '',
            xBk: 0,
            yBk: 0,
            authorBk: '',
            altBk: '',
            eTextBk: '',
            colorBk: '#000000',
            backcolorBk: '#ffffff',
        };
    },

    loadDataGame: function (data, sthis) {
        const json = data.text(),
            mOptions =
                $exeDevices.iDevice.gamification.helpers.isJsonString(json),
            $imagesLink = $('.flipcards-LinkImages', sthis),
            $audiosLink = $('.flipcards-LinkAudios', sthis),
            $imagesLinkBack = $('.flipcards-LinkImagesBack', sthis),
            $audiosLinkBack = $('.flipcards-LinkAudiosBack', sthis);

        mOptions.playerAudio = '';
        mOptions.gameStarted = mOptions.type == 3 ? false : true;

        $imagesLink.each(function () {
            const iq = parseInt($(this).text());
            if (!isNaN(iq) && iq < mOptions.cardsGame.length) {
                const flipcard = mOptions.cardsGame[iq];
                flipcard.url = $(this).attr('href');
                if (flipcard.url.length < 4) {
                    flipcard.url = '';
                }
            }
        });

        $imagesLinkBack.each(function () {
            const iq = parseInt($(this).text());
            if (!isNaN(iq) && iq < mOptions.cardsGame.length) {
                const flipcard = mOptions.cardsGame[iq];
                flipcard.urlBk = $(this).attr('href');
                if (flipcard.urlBk.length < 4) {
                    flipcard.urlBk = '';
                }
            }
        });

        $audiosLink.each(function () {
            const iqa = parseInt($(this).text());
            if (!isNaN(iqa) && iqa < mOptions.cardsGame.length) {
                const flipcard = mOptions.cardsGame[iqa];
                flipcard.audio = $(this).attr('href');
                if (flipcard.audio.length < 4) {
                    flipcard.audio = '';
                }
            }
        });

        $audiosLinkBack.each(function () {
            const iqa = parseInt($(this).text());
            if (!isNaN(iqa) && iqa < mOptions.cardsGame.length) {
                const flipcard = mOptions.cardsGame[iqa];
                flipcard.audioBk = $(this).attr('href');
                if (flipcard.audioBk.length < 4) {
                    flipcard.audioBk = '';
                }
            }
        });

        mOptions.time = typeof mOptions.time == 'undefined' ? 0 : mOptions.time;
        mOptions.evaluation =
            typeof mOptions.evaluation == 'undefined'
                ? false
                : mOptions.evaluation;
        mOptions.evaluationID =
            typeof mOptions.evaluationID == 'undefined'
                ? ''
                : mOptions.evaluationID;
        mOptions.id = typeof mOptions.id == 'undefined' ? false : mOptions.id;
        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.active = 0;
        mOptions.activedGame = false;
        mOptions.visiteds = [];
        mOptions.obtainedClue = false;
        mOptions.refreshCard = false;
        mOptions.cardsGame =
            $exeDevices.iDevice.gamification.helpers.getQuestions(
                mOptions.cardsGame,
                mOptions.percentajeCards
            );
        const al = $exeDevices.iDevice.gamification.helpers.shuffleAds(
            mOptions.cardsGame
        );
        mOptions.cardsGame = mOptions.randomCards ? al : mOptions.cardsGame;
        mOptions.numberCards = mOptions.cardsGame.length;
        mOptions.realNumberCards = mOptions.numberCards;

        for (let i = 0; i < mOptions.cardsGame.length; i++) {
            mOptions.cardsGame[i].isCorrect = true;
            mOptions.cardsGame[i].eText = $eXeFlipCards.decodeURIComponentSafe(
                mOptions.cardsGame[i].eText
            );
            mOptions.cardsGame[i].eTextBk =
                $eXeFlipCards.decodeURIComponentSafe(
                    mOptions.cardsGame[i].eTextBk
                );
            if (
                $exeDevices.iDevice.gamification.math.hasLatex(
                    mOptions.cardsGame[i].eText
                ) ||
                $exeDevices.iDevice.gamification.math.hasLatex(
                    mOptions.cardsGame[i].eTextBk
                )
            ) {
                $eXeFlipCards.hasLATEX = true;
            }
        }

        mOptions.fullscreen = false;
        return mOptions;
    },

    decodeURIComponentSafe: function (s) {
        if (!s) return s;
        return decodeURIComponent(s).replace('&percnt;', '%');
    },

    activeGameMode: function (instance) {
        const mOptions = $eXeFlipCards.options[instance];

        for (let i = 0; i < mOptions.cardsGame.length; i++) {
            const card = mOptions.cardsGame[i],
                a = Math.random();
            if (a >= 0.5) {
                card.isCorrect = true;
            } else {
                card.isCorrect = false;
                let num = Math.floor(Math.random() * mOptions.cardsGame.length);
                if (num == i) {
                    num = num > 0 ? num - 1 : mOptions.cardsGame.length - 1;
                }
                const cb = mOptions.cardsGame[num];
                card.urlBk = cb.urlBk;
                card.audioBk = cb.audioBk;
                card.xBk = cb.xBk;
                card.yBk = cb.yBk;
                card.authorBk = cb.authorBk;
                card.altBk = cb.altBk;
                card.eTextBk = cb.eTextBk;
                card.colorBk = cb.colorBk;
                card.backcolorBk = cb.backcolorBk;
            }
        }

        return mOptions.cardsGame;
    },

    activeMemory(instance) {
        const mOptions = $eXeFlipCards.options[instance];
        for (let i = 0; i < mOptions.cardsGame.length; i++) {
            const card = mOptions.cardsGame[i],
                a = Math.random();
            if (a >= 0.5) {
                card.isCorrect = true;
            } else {
                card.isCorrect = false;
                let num = Math.floor(Math.random() * mOptions.cardsGame.length);
                if (num == i) {
                    num = num > 0 ? num - 1 : mOptions.cardsGame.length - 1;
                }
                const cb = mOptions.cardsGame[num];
                card.urlBk = cb.urlBk;
                card.audioBk = cb.audioBk;
                card.xBk = cb.xBk;
                card.yBk = cb.yBk;
                card.authorBk = cb.authorBk;
                card.altBk = cb.altBk;
                card.eTextBk = cb.eTextBk;
                card.colorBk = cb.colorBk;
                card.backcolorBk = cb.backcolorBk;
            }
        }
        return mOptions.cardsGame;
    },

    uncorrectPairMemory: function (instance) {
        const mOptions = $eXeFlipCards.options[instance];

        $eXeFlipCards.updateScoreMemory(false, instance);
        setTimeout(function () {
            $eXeFlipCards.updateCoversMemory(instance, false);
            mOptions.selecteds = [];
            mOptions.gameActived = true;
            $eXeFlipCards.showMessageMemory(
                3,
                mOptions.msgs.mgsClickCard,
                instance
            );
        }, 2000);
    },

    updateScoreMemory: function (correctAnswer, instance) {
        const mOptions = $eXeFlipCards.options[instance];

        let message = '',
            obtainedPoints = 0,
            type = 1,
            sscore = 0;
        if (correctAnswer) {
            mOptions.hits++;
            obtainedPoints = 10 / mOptions.realNumberCards;
            type = 2;
        }

        mOptions.score = mOptions.score + obtainedPoints;
        sscore =
            mOptions.score % 1 == 0
                ? mOptions.score
                : mOptions.score.toFixed(2);

        $('#flcdsPNumber-' + instance).text(
            mOptions.realNumberCards - mOptions.hits
        );
        $('#flcdsPScore-' + instance).text(sscore);
        $('#flcdsPHits-' + instance).text(mOptions.hits);
        message = $eXeFlipCards.getMessageAnswerMemory(correctAnswer, instance);
        $eXeFlipCards.showMessage(type, message, instance, false);
        if (mOptions.hits >= mOptions.realNumberCards) {
            mOptions.gameActived = false;
            setTimeout(function () {
                $eXeFlipCards.gameOverMemory(0, instance);
            }, 2000);
        }
    },

    createCardsData: function (cards) {
        let cardsGame = [],
            d = 0,
            j = 0,
            tp = 0;
        while (j < cards.length) {
            const p = {};
            if (d % 2 == 0) {
                p.number = j;
                p.url = cards[j].url;
                p.eText = cards[j].eText;
                p.audio = cards[j].audio;
                p.x = cards[j].x;
                p.y = cards[j].y;
                p.alt = cards[j].alt;
                p.author = cards[j].autor;
                p.color = cards[j].color;
                p.backcolor = cards[j].backcolor;
                tp = 0;
                if (p.url.trim().length > 0 && p.eText.trim().length > 0) {
                    tp = 2;
                } else if (p.eText.trim().length > 0) {
                    tp = 1;
                }
                p.type = tp;
            } else {
                p.number = j;
                p.url = cards[j].urlBk;
                p.eText = cards[j].eTextBk;
                p.audio = cards[j].audioBk;
                p.x = cards[j].xBk;
                p.y = cards[j].yBk;
                p.alt = cards[j].altBk;
                p.author = cards[j].authorBk;
                p.color = cards[j].colorBk;
                p.backcolor = cards[j].backcolorBk;
                tp = 0;
                if (p.url.trim().length > 0 && p.eText.trim().length > 0) {
                    tp = 2;
                } else if (p.eText.trim().length > 0) {
                    tp = 1;
                }
                p.type = tp;
                j++;
            }
            d++;
            cardsGame.push(p);
        }
        return cardsGame;
    },

    getMessageAnswerMemory: function (correctAnswer, instance) {
        const mOptions = $eXeFlipCards.options[instance];
        return correctAnswer ? mOptions.msgs.msgTrue : mOptions.msgs.msgTrue2;
    },

    getMessageCorrectAnswerMemory: function (instance) {
        return $eXeFlipCards.getRetroFeedMessagesMemory(true, instance);
    },
    getMessageErrorAnswerMemory: function (instance) {
        return $eXeFlipCards.getRetroFeedMessagesMemory(false, instance);
    },

    showMessageMemory: function (type, message, instance, end) {
        const colors = [
                '#555555',
                $eXeFlipCards.borderColors.red,
                $eXeFlipCards.borderColors.green,
                $eXeFlipCards.borderColors.blue,
                $eXeFlipCards.borderColors.yellow,
            ],
            color = colors[type];

        $('#flcdsMessage-' + instance).text(message);
        $('#flcdsMessage-' + instance).css({
            color: color,
        });
        if (end) {
            $('#flcdsMessage-' + instance).hide();
            $('#flcdsMesasgeEnd-' + instance).text(message);
            $('#flcdsMesasgeEnd-' + instance).css({
                color: color,
            });
        }
    },

    updateCoversMemory: function (instance, answers) {
        const mOptions = $eXeFlipCards.options[instance],
            $cardContainers = $('#flcdsMultimedia-' + instance).find(
                '.FLCDSP-CardContainerMemory'
            );

        $cardContainers.each(function () {
            let state = $(this).data('state');
            const $card = $(this).find('.FLCDSP-Card1Memory').eq(0);
            $card.removeClass('FLCDSP-CardActiveMemory');
            if (state == 1) {
                if (answers) {
                    state = 2;
                } else {
                    state = 0;
                }
                $(this).data('state', state);
            }
            if (state == 0) {
                $(this).css('cursor', 'pointer');
                if (!mOptions.showCards) {
                    $card.removeClass('flipped');
                }
            } else {
                $(this).css('cursor', 'default');
            }
        });
    },

    correctPairMemory: function (number, instance) {
        const mOptions = $eXeFlipCards.options[instance];
        mOptions.activeQuestion = mOptions.selecteds[0];
        mOptions.selecteds = [];

        $eXeFlipCards.updateCoversMemory(instance, true);
        $eXeFlipCards.updateScoreMemory(true, instance);

        const percentageHits =
            (mOptions.hits / mOptions.cardsGame.length) * 100;
        if (
            mOptions.itinerary.showClue &&
            percentageHits >= mOptions.itinerary.percentageClue
        ) {
            if (!mOptions.obtainedClue) {
                mOptions.obtainedClue = true;
                $('#flcdsPShowClue-' + instance).text(
                    mOptions.itinerary.clueGame
                );
                $('#flcdsCubierta-' + instance).show();
                $('#flcdsShowClue-' + instance).fadeIn();
            }
        }

        if (mOptions.isScorm == 1) {
            $eXeFlipCards.sendScore(true, instance);
        }

        $eXeFlipCards.saveEvaluation(instance);

        const $marcados = $('#flcdsMultimedia-' + instance)
            .find('.FLCDSP-CardContainerMemory[data-number="' + number + '"]')
            .find('.FLCDSP-Card1Memory');
        $marcados.each(function () {
            $(this).data('valid', '1');
            $(this).animate(
                {
                    zoom: '110%',
                },
                'slow'
            );
        });

        const opacity = mOptions.showCards ? 0.25 : 0.3;

        if (mOptions.showCards) {
            $marcados.find('.FLCDSP-CardBackMemory').css('opacity', opacity);
        }

        if (mOptions.hits >= mOptions.cardsGame.length) {
            let message =
                mOptions.msgs.msgCool + ' ' + mOptions.msgs.mgsAllCards;
            if (mOptions.gameMode == 1) {
                message =
                    mOptions.msgs.msgCool + ' ' + mOptions.msgs.mgsAllTrios;
            } else if (mOptions.gameMode == 2) {
                message =
                    mOptions.msgs.msgCool + ' ' + mOptions.msgs.mgsAllQuartets;
            }
            $eXeFlipCards.showMessageMemory(3, message, instance);
            setTimeout(function () {
                $marcados
                    .find('.FLCDSP-CardBackMemory')
                    .css('opacity', opacity);
                $eXeFlipCards.gameOverMemory(0, instance);
                mOptions.gameActived = true;
            }, 2000);
        } else {
            mOptions.gameActived = true;
        }
    },

    gameOverMemory: function (type, instance) {
        const mOptions = $eXeFlipCards.options[instance];

        if (!mOptions.gameStarted) return;

        clearInterval(mOptions.counterClock);

        mOptions.gameStarted = false;
        mOptions.gameActived = false;
        mOptions.gameOver = true;

        $exeDevices.iDevice.gamification.media.stopSound(mOptions);

        $('#flcdsCubierta-' + instance).show();
        $eXeFlipCards.showScoreGame(type, instance);
        if (mOptions.isScorm == 1) {
            const score = (
                (mOptions.hits * 10) /
                mOptions.realNumberCards
            ).toFixed(2);
            $eXeFlipCards.sendScore(true, instance);
            $eXeFlipCards.initialScore = score;
        }
        $eXeFlipCards.saveEvaluation(instance);

        $('#flcdsReboot-' + instance).show();
    },

    rebootGameMemory: function (instance) {
        const mOptions = $eXeFlipCards.options[instance];

        mOptions.gameActived = false;
        mOptions.gameStarted = false;

        $('#flcdsCubierta-' + instance).hide();
        $('#flcdsStartLevels-' + instance).show();
        $('#flcdsMultimedia-' + instance)
            .find('.FLCDSP-Card1Memory')
            .removeClass('flipped FLCDSP-CardActiveMemory');

        mOptions.gameStarted = false;
        mOptions.solveds = [];
        mOptions.selecteds = [];
        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.counter = mOptions.time * 60;
        mOptions.obtainedClue = false;

        $eXeFlipCards.updateTimeMemory(mOptions.counter, instance);
        $('#flcdsPShowClue-' + instance).text('');
        $('#flcdsShowClue-' + instance).hide();
        $('#flcdsPHits-' + instance).text(mOptions.hits);
        $('#flcdsPNumber-' + instance).text(mOptions.realNumberCards);
        $('#flcdsCubierta-' + instance).hide();
        $('#flcdsGameOver-' + instance).hide();
        $('#flcdsMessage-' + instance).hide();

        clearInterval(mOptions.counterClock);

        $exeDevices.iDevice.gamification.media.stopSound(mOptions);

        $('#flcdsStartLevels-' + instance).hide();
        $('#flcdsCubierta-' + instance).hide();
        $eXeFlipCards.startGameMemory(instance);
    },
    updateTimeMemory: function (tiempo, instance) {
        const mOptions = $eXeFlipCards.options[instance];
        if (mOptions.time == 0) return;
        const mTime = $eXeFlipCards.getTimeToStringMemory(tiempo);
        $('#flcdsPTime-' + instance).text(mTime);
    },

    getTimeToStringMemory: function (iTime) {
        const mMinutes = parseInt(iTime / 60) % 60,
            mSeconds = iTime % 60;
        return (
            (mMinutes < 10 ? '0' + mMinutes : mMinutes) +
            ':' +
            (mSeconds < 10 ? '0' + mSeconds : mSeconds)
        );
    },

    activeHoverMemory: function ($card, instance) {
        const mOptions = $eXeFlipCards.options[instance];
        let state = $card.data('state');
        $card.off('mouseenter mouseleave');
        $card.removeClass('FLCDSP-HoverMemory');
        if (state == 0) {
            $card.hover(
                function () {
                    state = $card.data('state');
                    $card.css('cursor', 'default');
                    if (mOptions.gameActived && state == 0) {
                        $card.addClass('FLCDSP-HoverMemory');
                        $card.css('cursor', 'pointer');
                    }
                },
                function () {
                    $card.removeClass('FLCDSP-HoverMemory');
                }
            );
        }
    },

    initCardsMemory: function (instance) {
        const $cards = $('#flcdsMultimedia-' + instance).find(
            '.FLCDSP-CardContainerMemory'
        );
        $cards.each(function () {
            $(this).data('state', '0');
            $eXeFlipCards.activeHoverMemory($(this), instance);
            $eXeFlipCards.showCardMemory($(this), instance);
        });
        $exeDevices.iDevice.gamification.math.updateLatex(
            '#flcdsMultimedia-' + instance
        );
    },

    showCardMemory: function (card, instance) {
        const mOptions = $eXeFlipCards.options[instance],
            $card = card,
            $noImage = $card.find('.FLCDSP-CoverMemory').eq(0),
            $text = $card.find('.FLCDSP-ETextMemory').find().eq(0),
            $image = $card.find('.FLCDSP-ImageMemory').eq(0),
            $cursor = $card.find('.FLCDSP-CursorMemory').eq(0),
            $audio = $card.find('.FLCDSP-LinkAudioMemory').eq(0),
            type = parseInt($card.data('type')),
            state = $noImage.data('state'),
            x = parseFloat($image.data('x')),
            y = parseFloat($image.data('y')),
            url = $image.data('url'),
            alt = $image.attr('alt') || 'No disponibLe',
            audio = $audio.data('audio') || '',
            text = $text.find('.FLCDSP-ETextDinamyc').html() || '',
            color = $text.data('color'),
            backcolor = $text.data('backcolor');

        $text.hide();
        $image.hide();
        $cursor.hide();
        $audio.hide();
        $noImage.show();
        if (type == 1) {
            $text.show();
            $text.css({
                color: color,
                'background-color': backcolor,
            });
        } else if (type == 0 && url.length > 3) {
            $image.attr('alt', alt);
            $image.show();
            $image
                .prop('src', url)
                .on('load', function () {
                    if (
                        !this.complete ||
                        typeof this.naturalWidth == 'undefined' ||
                        this.naturalWidth == 0
                    ) {
                        $cursor.hide();
                    } else {
                        $image.show();
                        $cursor.hide();
                        $eXeFlipCards.positionPointerCard(
                            $cursor,
                            x,
                            y,
                            1,
                            instance
                        );
                    }
                })
                .on('error', function () {
                    $cursor.hide();
                });
        } else if (type == 2 && url.length > 3) {
            $image.attr('alt', alt);
            $image.show();
            $image
                .prop('src', url)
                .on('load', function () {
                    if (
                        !this.complete ||
                        typeof this.naturalWidth == 'undefined' ||
                        this.naturalWidth == 0
                    ) {
                        $cursor.hide();
                    } else {
                        $image.show();
                        $cursor.hide();
                        $eXeFlipCards.positionPointerCard(
                            $cursor,
                            x,
                            y,
                            1,
                            instance
                        );
                    }
                })
                .on('error', function () {
                    $cursor.hide();
                });
            $text.show();
            $text.css({
                color: '#000',
                'background-color': 'rgba(255, 255, 255, 0.7)',
            });
        }

        if (audio.length > 0) {
            $audio.show();
        }
        if (state > 0) {
            $noImage.hide();
        }
    },
    startGameMemory: function (instance) {
        const mOptions = $eXeFlipCards.options[instance];
        if (mOptions.gameStarted) return;

        mOptions.gameStarted = true;
        $eXeFlipCards.addCardsMemory(instance, mOptions.cardsGame);
        mOptions.solveds = [];
        mOptions.selecteds = [];
        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.gameActived = true;
        mOptions.counter = mOptions.time * 60;
        mOptions.gameOver = false;
        mOptions.obtainedClue = false;
        mOptions.nattempts = mOptions.attempts > 0 ? mOptions.attempts : 0;

        $('#flcdsPShowClue-' + instance).text('');
        $('#flcdsShowClue-' + instance).hide();
        $('#flcdsPHits-' + instance).text(mOptions.hits);
        $('#flcdsPErrors-' + instance).text(mOptions.nattempts);
        $('#flcdsCubierta-' + instance).hide();
        $('#flcdsGameOver-' + instance).hide();
        $('#flcdsStartLevels-' + instance).hide();
        $('#flcdsMessage-' + instance).show();

        $eXeFlipCards.initCardsMemory(instance);

        if (mOptions.time > 0) {
            $('#flcdsPTime-' + instance).show();
            $('#flcdsImgTime-' + instance).show();
            mOptions.counterClock = setInterval(function () {
                let $node = $('#flcdsMainContainer-' + instance);
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
                        $eXeFlipCards.gameOverMemory(1, instance);
                        return;
                    }
                    $eXeFlipCards.updateTimeMemory(mOptions.counter, instance);
                }
            }, 1000);
            $eXeFlipCards.updateTimeMemory(mOptions.time * 60, instance);
        }

        if (mOptions.showCards) {
            $('#flcdsMultimedia-' + instance)
                .find('.FLCDSP-Card1Memory')
                .addClass('flipped');
        }

        $eXeFlipCards.showMessageMemory(
            3,
            mOptions.msgs.mgsClickCard,
            instance
        );
        $eXeFlipCards.refreshCards(instance);
        mOptions.gameStarted = true;
    },

    showActivity: function (instance) {
        const mOptions = $eXeFlipCards.options[instance];
        mOptions.active = 0;
        const al = $exeDevices.iDevice.gamification.helpers.shuffleAds(
            mOptions.cardsGame
        );
        mOptions.cardsGame = mOptions.randomCards ? al : mOptions.cardsGame;

        if (mOptions.type === 2)
            mOptions.cardsGame = $eXeFlipCards.activeGameMode(instance);
        else if (mOptions.type === 3)
            mOptions.cardsGame = $eXeFlipCards.activeMemory(instance);

        $exeDevices.iDevice.gamification.media.stopSound(mOptions);

        mOptions.type < 3
            ? $eXeFlipCards.addCards(mOptions.cardsGame, instance)
            : $eXeFlipCards.addCardsMemory(instance, mOptions.cardsGame);

        $eXeFlipCards.initCards(instance);

        const $cards = $('#flcdsMultimedia-' + instance).find(
            '.FLCDSP-CardDraw'
        );
        $cards
            .off()
            .css('cursor', 'pointer')
            .on('click touchstart', function (e) {
                e.preventDefault();
                let stargetFull = $(e.target).closest('.FLCDSP-FullLinkImage');
                if (stargetFull.length) {
                    const largeImageSrc = stargetFull.data('url');
                    if (largeImageSrc && largeImageSrc.length > 3) {
                        $exeDevices.iDevice.gamification.helpers.showFullscreenImage(
                            largeImageSrc,
                            $('#flcdsGameContainer-' + instance)
                        );
                    }
                    return;
                }
                if (
                    $(e.target).closest(
                        '.FLCDSP-LinkAudioFront, .FLCDSP-LinkAudioBack'
                    ).length
                ) {
                    $eXeFlipCards.checkAudio($(this), 1000, instance);
                    return;
                }
                $(this)
                    .find(
                        '.FLCDSP-FullLinkImage-Back, .FLCDSP-FullLinkImage-Front, .FLCDSP-LinkAudioFront, .FLCDSP-LinkAudioBack, .FLCDSP-CursorFront, .FLCDSP-Cursor-Back'
                    )
                    .hide();
                const $flipInner = $(this).find('.FLCDSP-FlipCardInner').eq(0);
                if (!$flipInner.hasClass('flipped')) {
                    if (mOptions.type === 2) {
                        $('#flcdsLinkV-' + instance).css(
                            'visibility',
                            'visible'
                        );
                        $('#flcdsLinkF-' + instance).css(
                            'visibility',
                            'visible'
                        );
                    }
                    $flipInner.addClass('flipped');
                    $eXeFlipCards.handleCardFlip(
                        $(this),
                        true,
                        mOptions,
                        instance
                    );
                } else {
                    $flipInner.removeClass('flipped');
                    $eXeFlipCards.handleCardFlip(
                        $(this),
                        false,
                        mOptions,
                        instance
                    );
                }
                $exeDevices.iDevice.gamification.media.stopSound(mOptions);
                $eXeFlipCards.checkAudio($(this), 1000, instance);
                $eXeFlipCards.checkFullImage($(this));
            });

        $cards.on('mouseenter', function () {
            if (!$eXeFlipCards.isMobile())
                $eXeFlipCards.checkAudio($(this), 50, instance);
        });

        $eXeFlipCards.handleNavigationControls(mOptions, instance);
        if (mOptions.type === 2 || mOptions.type === 1) {
            $('#flcdsMultimedia-' + instance)
                .find('.FLCDSP-CardDraw')
                .addClass('FLCDSP-BigCard');
        }
    },

    nextCard: function (instance) {
        const mOptions = $eXeFlipCards.options[instance];
        $exeDevices.iDevice.gamification.media.stopSound(mOptions);

        if (mOptions.active < mOptions.cardsGame.length - 1) {
            mOptions.active++;
            $eXeFlipCards.toggleActiveCardDisplay(mOptions, instance, true);
            $eXeFlipCards.handleCardAudio(mOptions.activeCard, instance);
            $('#flcdsCardNumber-' + instance).text(mOptions.active + 1);
            $eXeFlipCards.showNavigationButtons(instance);
        }
    },

    previousCard: function (instance) {
        const mOptions = $eXeFlipCards.options[instance];
        if (mOptions.active > 0) {
            mOptions.active--;
            $eXeFlipCards.toggleActiveCardDisplay(mOptions, instance, false);
            $eXeFlipCards.handleCardAudio(mOptions.activeCard, instance);
            $('#flcdsCardNumber-' + instance).text(mOptions.active + 1);
            $eXeFlipCards.showNavigationButtons(instance);
        }
    },

    showNavigationButtons: function (instance) {
        const mOptions = $eXeFlipCards.options[instance];
        $('#flcdsPreviousCard-' + instance).fadeTo(
            100,
            mOptions.active > 0 ? 1 : 0.2
        );
        $('#flcdsNextCard-' + instance).fadeTo(
            200,
            mOptions.active < mOptions.cardsGame.length - 1 ? 1 : 0.2
        );
    },

    handleCardFlip: function ($card, isFlipped, mOptions, instance) {
        const side = isFlipped ? 'Back' : 'Front';
        const audio = $card
            .find(`.FLCDSP - LinkAudio - ${side} `)
            .eq(0)
            .data('audio');
        const imageElement = $card.find(`.FLCDSP - Image - ${side} `);
        const cursorVisible =
            imageElement.data('url')?.length > 3 &&
            (imageElement.data('x') > 0 || imageElement.data('y') > 0);
        const image = imageElement?.data('url');

        if (image?.length > 3)
            $card.find(`.FLCDSP - FullLinkImage - ${side} `).show();
        if (audio?.length > 3)
            $card.find(`.FLCDSP - LinkAudio - ${side} `).show();
        if (cursorVisible) $card.find(`.FLCDSP - Cursor - ${side} `).show();

        if (isFlipped) {
            mOptions.visiteds.push($card.data('number'));
        }

        $exeDevices.iDevice.gamification.media.stopSound(mOptions);

        if (mOptions.isScorm === 1 && mOptions.type < 2) {
            $eXeFlipCards.sendScore(true, instance);
        }

        if (mOptions.type < 2) {
            $eXeFlipCards.saveEvaluation(instance);
        }

        if (mOptions.type !== 2) {
            $eXeFlipCards.showClue(instance);
        }
    },

    toggleActiveCardDisplay: function (mOptions, instance, isNext) {
        if (window.innerWidth < 700) {
            mOptions.activeCard.hide();
        } else {
            mOptions.activeCard.animate({ width: 'toggle' }, 400);
        }

        mOptions.activeCard = isNext
            ? mOptions.activeCard.next()
            : mOptions.activeCard.prev();
        $eXeFlipCards.showCard(mOptions.activeCard, instance);

        if (window.innerWidth < 700) {
            mOptions.activeCard.show();
        } else {
            mOptions.activeCard.animate({ width: 'toggle' }, 400);
        }
    },

    handleCardAudio: function ($card) {
        const audio = $card.find('.FLCDSP-LinkAudioFront').data('audio'),
            audioBK = $card.find('.FLCDSP-LinkAudioBack').data('audio');

        $card.find('.FLCDSP-LinkAudioFront, .FLCDSP-LinkAudioBack').hide();
        if (
            $card.find('.FLCDSP-FlipCardInner').eq(0).hasClass('flipped') &&
            audioBK?.length > 3
        ) {
            $card.find('.FLCDSP-LinkAudioBack').show();
        } else if (audio?.length > 3) {
            $card.find('.FLCDSP-LinkAudioFront').show();
        }
    },

    handleCardFullImage: function ($card) {
        const $image = $card
                .find('.FLCDSP-FlipCardInner')
                .find('.FLCDSP-FullLinkImage'),
            $imageback = $card
                .find('.flip-card.back')
                .find('.FLCDSP-FullLinkImage'),
            image = $image.length == 1 ? $image.data('url') : '',
            imageback = $imageback.length == 1 ? $imageback.data('url') : '';

        $image.hide();
        $imageback.hide();
        if (
            $card.find('.FLCDSP-FlipCardInner').eq(0).hasClass('flipped') &&
            imageback?.length > 3
        ) {
            $imageback.show();
        } else if (image?.length > 3) {
            $image.show();
        }
    },

    handleNavigationControls: function (mOptions, instance) {
        const $cards = $('#flcdsMultimedia-' + instance).find(
            '.FLCDSP-CardDraw'
        );
        if (
            mOptions.type === 2 ||
            (mOptions.type === 1 && mOptions.cardsGame.length > 1)
        ) {
            $cards.hide();
            mOptions.activeCard = $cards.eq(0).show();
            $('#flcdsCardNumber-' + instance).text(mOptions.active + 1);
            $('#flcdsNavigation-' + instance).toggle(mOptions.type !== 2);
            $eXeFlipCards.showNavigationButtons(instance);
        }
    },

    createInterfaceCards: function (instance) {
        const path = $eXeFlipCards.idevicePath,
            msgs = $eXeFlipCards.options[instance].msgs,
            mOptions = $eXeFlipCards.options[instance],
            html = `<div class="FLCDSP-MainContainer" id ="flcdsMainContainer-${instance}">
            <div class="FLCDSP-GameMinimize" id="flcdsGameMinimize-${instance}">
                <a href="#" class="FLCDSP-LinkMaximize" id="flcdsLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                    <img src="${path}flipcardsIcon.png" class="FLCDSP-IconMinimize FLCDSP-Activo" alt="">
                    <div class="FLCDSP-MessageMaximize" id="flcdsMessageMaximize-${instance}">${msgs.msgPlayStart}</div>
                </a>
            </div>
            <div class="FLCDSP-GameContainer" id="flcdsGameContainer-${instance}">
                <div class="FLCDSP-GameScoreBoard" id="flcdsGameScoreBoard-${instance}">
                    <div class="FLCDSP-GameScores">
                        <div class="exeQuextIcons exeQuextIcons-Number" id="flcdsPNumberIcon-${instance}" title="${msgs.msgNumQuestions}"></div>
                        <p><span class="sr-av">${msgs.msgNumQuestions}: </span><span id="flcdsPNumber-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                        <p><span class="sr-av">${msgs.msgHits}: </span><span id="flcdsPHits-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Error" title="${msgs.msgErrors}"></div>
                        <p><span class="sr-av">${msgs.msgErrors}: </span><span id="flcdsPErrors-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Score" title="${msgs.msgScore}"></div>
                        <p><span class="sr-av">${msgs.msgScore}: </span><span id="flcdsPScore-${instance}">0</span></p>
                    </div>
                    <div class="FLCDSP-Info" id="flcdsInfo-${instance}"></div>
                    <div class="FLCDSP-TimeNumber">
                        <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                        <div class="exeQuextIcons exeQuextIcons-Time" style="display:none;" id="flcdsImgTime-${instance}" title="${msgs.msgTime}"></div>
                        <p id="flcdsPTime-${instance}" class="FLCDSP-PTime"  style="display:none;">00:00</p>
                        <a href="#" class="FLCDSP-LinkMinimize" id="flcdsLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                            <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Minimize FLCDSP-Activo"></div>
                        </a>
                        <a href="#" class="FLCDSP-LinkFullScreen" id="flcdsLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                            <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-FullScreen FLCDSP-Activo" id="flcdsFullScreen-${instance}"></div>
                        </a>
                    </div>
                </div>
                <div class="FLCDSP-Information">
                    <p class="FLCDSP-Message" id="flcdsMessage-${instance}"></p>
                </div>
                <div class="FLCDSP-StartNivelMemory" id="flcdsStartLevels-${instance}">
                    <a href="#" id="flcdsStartGame-${instance}">${msgs.msgPlayStart}</a>
                </div>
                <div class="FLCDSP-Multimedia" id="flcdsMultimedia-${instance}">
                    <div class="FLCDSP-GameButtons" id="flcdsGameButtons-${instance}">
                        <div>
                            <a href="#" id="flcdsLinkV-${instance}" title="${msgs.msgTrue}">
                                <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                                <div class="exeQuextButtonsF exeQuextIcons-ButtonOk FLCDSP-Activo"></div>
                            </a>
                        </div>
                        <div>
                            <a href="#" id="flcdsLinkF-${instance}" title="${msgs.msgFalse}">
                                <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                                <div class="exeQuextButtonsF exeQuextIcons-ButtonKO FLCDSP-Activo"></div>
                            </a>
                        </div>
                    </div>
                </div>
                <div class="FLCDSP-Navigation" id="flcdsNavigation-${instance}">
                    <a href="#" id="flcdsPreviousCard-${instance}" title="${msgs.msgPreviousCard}">&laquo;&nbsp;${msgs.msgPreviousCard}</a>
                    <span class="sr-av">${msgs.msgNumQuestions}:</span><span class="FLCDSP-CardsNumber" id="flcdsCardNumber-${instance}">${msgs.msgNumQuestions}:</span>
                    <a href="#" id="flcdsNextCard-${instance}" title="${msgs.msgNextCard}">${msgs.msgNextCard}&nbsp;&raquo</a>
                </div>
                <div class="FLCDSP-AuthorGame" id="flcdsAuthorGame-${instance}"></div>
            </div>
            <div class="FLCDSP-Cover" id="flcdsCubierta-${instance}">
                <div class="FLCDSP-CodeAccessDiv" id="flcdsCodeAccessDiv-${instance}">
                    <div class="FLCDSP-MessageCodeAccessE" id="flcdsMesajeAccesCodeE-${instance}"></div>
                    <div class="FLCDSP-DataCodeAccessE">
                        <label class="sr-av">${msgs.msgCodeAccess}:</label>
                        <input type="text" class="FLCDSP-CodeAccessE form-control" id="flcdsCodeAccessE-${instance}" placeholder="${msgs.msgCodeAccess}">
                        <a href="#" id="flcdsCodeAccessButton-${instance}" title="${msgs.msgSubmit}">
                            <strong><span class="sr-av">${msgs.msgSubmit}</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Submit FLCDSP-Activo"></div>
                        </a>
                    </div>
                </div>
                <div class="FLCDSP-GameOverExt" id="flcdsGameOver-${instance}">
                    <div class="FLCDSP-StartGame" id="flcdsMesasgeEnd-${instance}"></div>
                    <div class="FLCDSP-GameOver">
                        <div class="FLCDSP-DataImage">
                            <img src="${path}exequextwon.png" class="FLCDSP-HistGGame" id="flcdsHistGame-${instance}" alt="${msgs.msgAllQuestions}" />
                            <img src="${path}exequextlost.png" class="FLCDSP-LostGGame" id="flcdsLostGame-${instance}" alt="${msgs.msgAllQuestions}" />
                        </div>
                        <div class="FLCDSP-DataScore">
                            <p id="flcdsOverNumCards-${instance}"></p>
                            <p id="flcdsOverErrors-${instance}"></p>
                            <p id="flcdsOverHits-${instance}"></p>
                            <p id="flcdsOverScore-${instance}"></p>
                        </div>
                    </div>
                    <div class="FLCDSP-StartGame"><a href="#" id="flcdsReboot-${instance}">${msgs.msgPlayAgain}</a></div>
                </div>
                <div class="FLCDSP-ShowClue" id="flcdsShowClue-${instance}">
                    <p class="sr-av">${msgs.msgClue}</p>
                    <p class="FLCDSP-PShowClue" id="flcdsPShowClue-${instance}"></p>
                    <a href="#" class="FLCDSP-ClueBotton" id="flcdsClueButton-${instance}" title="${msgs.msgClose}">${msgs.msgClose}</a>
                </div>
            </div>
        </div >
    ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}
`;
        return html;
    },

    gameOver: function (type, instance) {
        const mOptions = $eXeFlipCards.options[instance];
        mOptions.gameStarted = false;
        mOptions.gameOver = true;

        $exeDevices.iDevice.gamification.media.stopSound(mOptions);

        $('#flcdsPNumber-' + instance).text('0');

        $eXeFlipCards.showScoreGame(type, instance);

        if (mOptions.isScorm === 1) {
            $eXeFlipCards.sendScore(true, instance);
        }

        $eXeFlipCards.saveEvaluation(instance);

        $('#flcdsReboot-' + instance).show();
    },

    showScoreGame: function (type, instance) {
        const mOptions = $eXeFlipCards.options[instance],
            msgs = mOptions.msgs,
            $flcdsHistGame = $('#flcdsHistGame-' + instance),
            $flcdsLostGame = $('#flcdsLostGame-' + instance),
            $flcdsOverNumCards = $('#flcdsOverNumCards-' + instance),
            $flcdsOverHits = $('#flcdsOverHits-' + instance),
            $flcdsOverErrors = $('#flcdsOverErrors-' + instance),
            $flcdsOverScore = $('#flcdsOverScore-' + instance),
            $flcdsCubierta = $('#flcdsCubierta-' + instance),
            $flcdsGameOver = $('#flcdsGameOver-' + instance);

        let message = '',
            messageColor = 1;

        $flcdsHistGame.hide();
        $flcdsLostGame.hide();
        $flcdsOverNumCards.show();
        $flcdsOverHits.show();
        $flcdsOverErrors.show();
        $flcdsOverScore.show();

        if (mOptions.type == 3) {
            $flcdsOverErrors.hide();
        }

        let mclue = '';
        messageColor = 0;
        $flcdsHistGame.show();

        const numcards =
                mOptions.type == 3
                    ? mOptions.cardsGame.length / 2
                    : mOptions.cardsGame.length,
            score = ((mOptions.hits * 10) / numcards).toFixed(2);
        if (type == 1) {
            message = msgs.msgEndTime.replace('%s', score);
        } else if (type == 0) {
            message = msgs.msgEndGameM.replace('%s', score);
        }

        $eXeFlipCards.showMessage(messageColor, message, instance, true);
        $flcdsOverNumCards.html(msgs.msgNumQuestions + ': ' + numcards);
        $flcdsOverHits.html(msgs.msgHits + ': ' + mOptions.hits);
        $flcdsOverErrors.html(msgs.msgErrors + ': ' + mOptions.errors);
        $flcdsOverScore.html(msgs.msgScore + ': ' + score);
        $flcdsGameOver.show();
        $flcdsCubierta.show();

        if (mOptions.itinerary.showClue) {
            if (score * 100 > mOptions.itinerary.percentageClue) {
                mclue = mOptions.itinerary.clueGame;
            } else {
                mclue = msgs.msgTryAgain.replace(
                    '%s',
                    mOptions.itinerary.percentageClue
                );
            }
        }
        $('#flcdsShowClue-' + instance).hide();
        if (mOptions.itinerary.showClue) {
            $eXeFlipCards.showMessage(3, mclue, instance, true);
        }
    },

    rebootGame: function (instance) {
        const mOptions = $eXeFlipCards.options[instance];

        $('#flcdsMultimedia-' + instance)
            .find('.FLCDSP-FlipCardInner')
            .removeClass('flipped');
        $('#flcdsMultimedia-' + instance)
            .find('.FLCDSP-CardDraw')
            .hide();

        Object.assign(mOptions, {
            activeCard: $('#flcdsMultimedia-' + instance)
                .find('.FLCDSP-CardDraw')
                .eq(0)
                .show(),
            hits: 0,
            errors: 0,
            score: 0,
            active: 0,
            obtainedClue: false,
        });

        $('#flcdsPShowClue-' + instance).text('');
        $('#flcdsPNumber-' + instance).text(mOptions.realNumberCards);
        $('#flcdsShowClue-' + instance).hide();
        $('#flcdsPHits-' + instance).text(mOptions.hits);
        $('#flcdsPErrors-' + instance).text(mOptions.errors);
        $('#flcdsPScore-' + instance).text(0);
        $('#flcdsCubierta-' + instance).hide();
        $('#flcdsGameOver-' + instance).hide();
        $('#flcdsMessage-' + instance).hide();
        $('#flcdsLinkV-' + instance).css('opacity', 1);
        $('#flcdsLinkF-' + instance).css('opacity', 1);
        mOptions.gameStarted = true;
        mOptions.gameOver = false;
        $eXeFlipCards.refreshGame(instance);
    },

    addCards: function (cardsGame, instance) {
        let flcds = '';
        $('#flcdsMultimedia-' + instance)
            .find('.FLCDSP-CardDraw')
            .remove();
        for (let i = 0; i < cardsGame.length; i++) {
            const card = $eXeFlipCards.createCard(i, cardsGame[i], instance);
            flcds += card;
        }
        $('#flcdsMultimedia-' + instance).prepend(flcds);
    },

    addCardsMemory: function (instance, cardsGame) {
        const mOptions = $eXeFlipCards.options[instance];
        let cards = '';
        cardsGame =
            $exeDevices.iDevice.gamification.helpers.shuffleAds(cardsGame);
        $('#flcdsMultimedia-' + instance)
            .find('.FLCDSP-CardContainerMemory')
            .remove();
        for (let i = 0; i < cardsGame.length; i++) {
            const card = $eXeFlipCards.createCardMemory(
                cardsGame[i].number,
                cardsGame[i],
                instance
            );
            cards += card;
        }
        $('#flcdsMultimedia-' + instance).append(cards);
        if (mOptions.imgCard.length > 4) {
            $('#flcdsMultimedia-' + instance)
                .find('.FLCDSP-CardContainerMemory')
                .each(function () {
                    $(this)
                        .find('.FLCDSP-CardFrontMemory')
                        .css({
                            'background-image': 'url(' + mOptions.imgCard + ')',
                            'background-size': 'cover',
                        });
                });
        }
        $eXeFlipCards.refreshCardsMemory(instance);
    },

    showClue: function (instance) {
        const mOptions = $eXeFlipCards.options[instance],
            percentageHits =
                (mOptions.type == 2
                    ? (mOptions.hits * 10) / mOptions.cardsGame.length
                    : $eXeFlipCards.getScoreVisited(instance)) * 10;
        if (mOptions.itinerary.showClue) {
            if (percentageHits >= mOptions.itinerary.percentageClue) {
                if (!mOptions.obtainedClue) {
                    mOptions.obtainedClue = true;
                    const msg =
                        mOptions.msgs.msgInformation +
                        ': ' +
                        mOptions.itinerary.clueGame;
                    $('#flcdsPShowClue-' + instance).text(msg);
                    $('#flcdsShowClue-' + instance).show();
                    $('#flcdsCubierta-' + instance).show();
                    $('#flcdsGameOver-' + instance).hide();
                    $eXeFlipCards.refreshGame(instance);
                }
            }
        }
    },

    createCardMemory: function (j, card, instance) {
        const mOptions = $eXeFlipCards.options[instance],
            fullimageback =
                card.url.length > 3
                    ? `<a href = "#" class="FLCDSP-FullLinkImage FLCDSP-FullLinkImage-Memory" data-url="${card.url}" title = "${mOptions.msgs.msgFullScreen}" aria - label="${mOptions.msgs.msgFullScreen}" >
                        <div class="exeQuextIcons exeQuextIcons-FullImage FLCDSP-Activo" aria-hidden="true"></div>
                        <span class="sr-av">${mOptions.msgs.msgFullScreen}</span>
                    </a> `
                    : '',
            malt = card.alt || '',
            saudio =
                card.url.trim().length === 0 && card.eText.trim() === ''
                    ? `<a href = "#" data-audio="${card.audio}" class="FLCDSP-LinkAudioMemoryBig" title = "Audio" >
    <img src="${$eXeFlipCards.idevicePath}exequextplayaudio.svg" class="FLCDSP-Audio" alt="Audio">
    </a>`
                    : `<a href = "#" data-audio="${card.audio}" class="FLCDSP-LinkAudioMemory" title = "Audio" >
    <img src="${$eXeFlipCards.idevicePath}exequextplayaudio.svg" class="FLCDSP-Audio" alt="Audio">
    </a>`,
            scard = `
        <div class="FLCDSP-CardContainerMemory" data-number="${card.number}" data-type="${card.type}" data-state="-1" >
            <div class="FLCDSP-Card1Memory" data-type="${card.type}" data-state="-1" data-valid="0">
                <div class="FLCDSP-CardFrontMemory"></div>
                <div class="FLCDSP-CardBackMemory">
                    <div class="FLCDSP-ImageContainMemory">
                        <img src="" class="FLCDSP-ImageMemory" data-url="${card.url}" data-x="${card.x}" data-y="${card.y}" alt="${malt}" />
                        <img class="FLCDSP-CursorMemory" src="${$eXeFlipCards.idevicePath}exequextcursor.gif" alt="" />
                        ${fullimageback}
                    </div>
                    <div class="FLCDSP-ETextMemory" data-color="${card.color}" data-backcolor="${card.backcolor}">
                        <div class="FLCDSP-ETextDinamyc">${card.eText}</div>
                    </div>
                    ${saudio}
                </div>
            </div>
            </div > `;

        return scard;
    },

    createCard: function (j, card, instance) {
        const mOptions = $eXeFlipCards.options[instance],
            imgMsgClass = card.isCorrect
                ? 'FLCDSP-ImageMessageOK'
                : 'FLCDSP-ImageMessageKO',
            fullimagefront =
                card.url.length > 3
                    ? `<a href = "#" class="FLCDSP-FullLinkImage FLCDSP-FullLinkImage-Front" data-url="${card.url}" title = "${mOptions.msgs.msgFullScreen}" aria - label="${mOptions.msgs.msgFullScreen}" >
                        <div class="exeQuextIcons exeQuextIcons-FullImage FLCDSP-Activo" aria-hidden="true"></div>
                        <span class="sr-av">${mOptions.msgs.msgFullScreen}</span>
                    </a> `
                    : '',
            fullimageback =
                card.urlBk.length > 3
                    ? `<a href = "#" class="FLCDSP-FullLinkImage FLCDSP-FullLinkImage-Back" data-url="${card.urlBk}" title = "${mOptions.msgs.msgFullScreen}" aria - label="${mOptions.msgs.msgFullScreen}" >
                        <div class="exeQuextIcons exeQuextIcons-FullImage FLCDSP-Activo" aria-hidden="true"></div>
                        <span class="sr-av">${mOptions.msgs.msgFullScreen}</span>
                    </a> `
                    : '',
            scard = `<div id = "flcdsCardDraw-${j}" data-number="${j}" class="FLCDSP-CardDraw" >
                <div class="flip-card">
                    <div class="FLCDSP-FlipCardInner">
                        <div class="FLCDSP-FlipCardFront">
                            <div class="FLCDSP-ImageContain">
                                <img src="${card.url}" class="FLCDSP-Image FLCDSP-ImageFront" data-url="${card.url}" data-x="${card.x}" data-y="${card.y}" alt="${card.alt}" />
                                <img class="FLCDSP-Cursor FLCDSP-CursorFront" src="${$eXeFlipCards.idevicePath}exequextcursor.gif" alt="" />
                                ${fullimagefront}
                            </div>
                            <div class="FLCDSP-EText FLCDSP-ETextFront" data-color="${card.color}" data-backcolor="${card.backcolor}">
                                <div class="FLCDSP-ETextDinamyc">${card.eText}</div>
                            </div>
                            <a href="#" data-audio="${card.audio}" class="FLCDSP-LinkAudio FLCDSP-LinkAudioFront" title="Audio">
                                <img src="${$eXeFlipCards.idevicePath}exequextplayaudio.svg" class="FLCDSP-Audio" alt="Audio" />
                            </a>
                        </div>
                        <div class="FLCDSP-FlipCardBack">
                            <div class="FLCDSP-ImageContain">
                                <img src="${card.urlBk}" class="FLCDSP-Image FLCDSP-ImageBack" data-url="${card.urlBk}" data-x="${card.xBk}" data-y="${card.yBk}" alt="${card.altBk}" />
                                <img class="FLCDSP-Cursor FLCDSP-Cursor-Back" src="${$eXeFlipCards.idevicePath}exequextcursor.gif" alt="" />
                                ${fullimageback}
                            </div>
                            <div class="FLCDSP-EText FLCDSP-ETextBack" data-color="${card.colorBk}" data-backcolor="${card.backcolorBk}">
                                <div class="FLCDSP-ETextDinamyc">${card.eTextBk}</div>
                            </div>
                            <a href="#" data-audio="${card.audioBk}" class="FLCDSP-LinkAudio FLCDSP-LinkAudioBack" title="Audio">
                                <img src="${$eXeFlipCards.idevicePath}exequextplayaudio.svg" class="FLCDSP-Audio" alt="Audio" />
                            </a>
                        </div>
                    </div>
                </div>
                <div class="FLCDSP-ImageMessage ${imgMsgClass}"></div>
            </div >`;
        return scard;
    },

    addEvents: function (instance) {
        const mOptions = $eXeFlipCards.options[instance];
        $eXeFlipCards.removeEvents(instance);
        $('#flcdsLinkMaximize-' + instance).on('click touchstart', (e) => {
            e.preventDefault();
            $('#flcdsGameContainer-' + instance).show();
            $('#flcdsGameMinimize-' + instance).hide();
            $eXeFlipCards.refreshGame(instance);
        });

        $('#flcdsLinkMinimize-' + instance).on('click touchstart', (e) => {
            e.preventDefault();
            $('#flcdsGameContainer-' + instance).hide();
            $('#flcdsGameMinimize-' + instance)
                .css('visibility', 'visible')
                .show();
        });

        $('#flcdsLinkV-' + instance).on('click touchstart', (e) => {
            e.preventDefault();
            $eXeFlipCards.validateReponseGame(instance, true);
        });

        $('#flcdsLinkF-' + instance).on('click touchstart', (e) => {
            e.preventDefault();
            $eXeFlipCards.validateReponseGame(instance, false);
        });

        $('#flcdsReboot-' + instance).on('click', (e) => {
            e.preventDefault();
            mOptions.type === 2
                ? $eXeFlipCards.rebootGame(instance)
                : $eXeFlipCards.rebootGameMemory(instance);
        });

        $('#flcdsGameButtons-' + instance).toggle(mOptions.type === 2);
        $('#flcdsCubierta-' + instance).hide();
        $('#flcdsCodeAccessDiv-' + instance).toggle(
            mOptions.itinerary.showCodeAccess
        );
        $('#flcdsLinkV-' + instance + ', #flcdsLinkF-' + instance).css(
            'visibility',
            'hidden'
        );

        if (mOptions.itinerary.showCodeAccess) {
            $('#flcdsMesajeAccesCodeE-' + instance).text(
                mOptions.itinerary.messageCodeAccess
            );
            $('#flcdsCubierta-' + instance).show();
        }

        $('#flcdsCodeAccessButton-' + instance).on('click touchstart', (e) => {
            e.preventDefault();
            $eXeFlipCards.enterCodeAccess(instance);
        });

        $('#flcdsCodeAccessE-' + instance).on('keydown', (event) => {
            if (event.which === 13) {
                $eXeFlipCards.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        $('#flcdsPNumber-' + instance).text(mOptions.realNumberCards);

        $(window).on('unload.eXeFlipCards', () => {
            if ($eXeFlipCards.mScorm)
                $exeDevices.iDevice.gamification.scorm.endScorm(
                    $eXeFlipCards.mScorm
                );
        });

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        $('#flcdsMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $eXeFlipCards.sendScore(false, instance);
                $eXeFlipCards.saveEvaluation(instance);
            });

        $('#flcdsImage-' + instance).hide();

        $('#flcdsClueButton-' + instance).on('click', (e) => {
            e.preventDefault();
            $('#flcdsShowClue-' + instance).hide();
            $('#flcdsCubierta-' + instance).fadeOut();
            $eXeFlipCards.refreshGame(instance);
        });

        $('#flcdsPErrors-' + instance).text(mOptions.hits);
        if (mOptions.author.trim() && !mOptions.fullscreen) {
            $('#flcdsAuthorGame-' + instance)
                .html(`${mOptions.msgs.msgAuthor}: ${mOptions.author} `)
                .show();
        }

        $('#flcdsNextCard-' + instance).on('click', (e) => {
            e.preventDefault();
            $eXeFlipCards.nextCard(instance);
            if (mOptions.isScorm == 1) {
                $eXeFlipCards.sendScore(true, instance);
            }
        });

        $('#flcdsPreviousCard-' + instance).on('click', (e) => {
            e.preventDefault();
            $eXeFlipCards.previousCard(instance);
            if (mOptions.isScorm == 1) {
                $eXeFlipCards.sendScore(true, instance);
            }
        });

        $('#flcdsStartGame-' + instance).on('click', (e) => {
            e.preventDefault();
            $eXeFlipCards.startGameMemory(instance);
        });

        $('#flcdsGameOver-' + instance).hide();

        $('#flcdsMultimedia-' + instance).on(
            'click',
            '.FLCDSP-CardContainerMemory',
            function () {
                $eXeFlipCards.cardClick(this, instance);
            }
        );

        $('#flcdsStartLevels-' + instance).toggle(
            mOptions.type === 3 && mOptions.time > 0
        );

        if (mOptions.type === 3 && mOptions.time === 0) {
            $eXeFlipCards.startGameMemory(instance);
        } else if (mOptions.type === 3) {
            $('#flcdsStartLevels-' + instance).show();
        }

        $('#flcdsLinkFullScreen-' + instance).on('click touchstart', (e) => {
            e.preventDefault();
            const element = document.getElementById(
                'flcdsGameContainer-' + instance
            );
            $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                element,
                instance
            );
        });

        const $container = $('#flcdsGameContainer-' + instance);

        $container.off('click', 'a[data-audio]');

        $container.on('click', 'a[data-audio]', function (e) {
            e.stopPropagation();
            e.preventDefault();
            const audioId = this.dataset.audio;
            if (audioId && audioId.length > 3) {
                $exeDevices.iDevice.gamification.media.playSound(
                    audioId,
                    mOptions
                );
            } else {
                console.warn('Audio inválido en el enlace:', this);
            }
        });

        $('#flcdsGameContainer-' + instance).off(
            'click',
            '.FLCDSP-FullLinkImage-Memory'
        );
        $('#flcdsGameContainer-' + instance).on(
            'click',
            '.FLCDSP-FullLinkImage-Memory',
            function (e) {
                e.preventDefault();
                e.stopPropagation();
                const largeImageSrc = $(this).data('url');
                if (largeImageSrc && largeImageSrc.length > 3) {
                    $exeDevices.iDevice.gamification.helpers.showFullscreenImage(
                        largeImageSrc,
                        $('#flcdsGameContainer-' + instance)
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
        $eXeFlipCards.refreshGame(instance);
    },

    removeEvents: function (instance) {
        $('#flcdsLinkMaximize-' + instance).off('click touchstart');
        $('#flcdsLinkMinimize-' + instance).off('click touchstart');
        $('#flcdsLinkV-' + instance).off('click touchstart');
        $('#flcdsLinkF-' + instance).off('click touchstart');
        $('#flcdsReboot-' + instance).off('click');
        $('#flcdsCodeAccessButton-' + instance).off('click touchstart');
        $('#flcdsCodeAccessE-' + instance).off('keydown');
        $('#flcdsMainContainer-' + instance)
            .closest('.idevice_node')
            .off('click', '.Games-SendScore');
        $(window).off('unload.eXeFlipcard');
        $('#flcdsClueButton-' + instance).off('click');
        $('#flcdsNextCard-' + instance).off('click');
        $('#flcdsPreviousCard-' + instance).off('click');
        $('#flcdsStartGame-' + instance).off('click');
        $('#flcdsMultimedia-' + instance).off(
            'click',
            '.FLCDSP-CardContainerMemory'
        );
        $('#flcdsLinkFullScreen-' + instance).off('click touchstart');
    },

    cardClick: function (cc, instance) {
        const mOptions = $eXeFlipCards.options[instance],
            $cc = $(cc),
            maxsel = 1;

        $exeDevices.iDevice.gamification.media.stopSound(mOptions);
        if (
            !mOptions.gameActived ||
            !mOptions.gameStarted ||
            mOptions.selecteds.length > maxsel
        )
            return;

        const state = parseInt($cc.data('state'));
        if (state !== 0) return;

        const $card = $cc.find('.FLCDSP-Card1Memory').eq(0);
        if (!$card.hasClass('flipped') && !mOptions.showCards)
            $card.addClass('flipped');

        mOptions.gameActived = false;
        $cc.data('state', '1');
        mOptions.selecteds.push(parseInt($cc.data('number')));

        if (mOptions.selecteds.length <= maxsel) {
            $eXeFlipCards.showMessageMemory(
                3,
                mOptions.msgs.mgsClickCard,
                instance,
                false
            );
        }

        const sound =
            $cc.find('.FLCDSP-LinkAudioMemory').data('audio') ||
            $cc.find('.FLCDSP-LinkAudioMemoryBig').data('audio') ||
            '';
        if (sound.length > 3) {
            $exeDevices.iDevice.gamification.media.playSound(sound, mOptions);
        }

        $card.addClass('FLCDSP-CardActiveMemory');
        mOptions.gameActived = true;

        if (mOptions.selecteds.length === 2) {
            if (
                parseInt(mOptions.selecteds[0]) ===
                parseInt(mOptions.selecteds[1])
            ) {
                $eXeFlipCards.correctPairMemory(
                    mOptions.selecteds[0],
                    instance
                );
            } else {
                $eXeFlipCards.uncorrectPairMemory(instance);
            }
        } else {
            $('#flcdsMultimedia-' + instance)
                .find('.FLCDSP-Card1Memory')
                .each(function () {
                    if (
                        parseInt($(this).data('valid')) === 1 &&
                        !mOptions.showCards
                    ) {
                        $(this)
                            .find('.FLCDSP-CardBackMemory')
                            .css('opacity', 0.3);
                    }
                });
        }
    },

    getRetroFeedMessagesMemory: function (iHit, instance) {
        const msgs = $eXeFlipCards.options[instance].msgs;
        let sMessages = iHit ? msgs.msgSuccesses : msgs.msgFailures;
        sMessages = sMessages.split('|');
        return sMessages[Math.floor(Math.random() * sMessages.length)];
    },

    validateReponseGame: function (instance, response) {
        const mOptions = $eXeFlipCards.options[instance];
        let message = '',
            type = 2,
            correctAnswer = true;
        if (mOptions.activedGame) return;
        $('#flcdsLinkV-' + instance).css('opacity', 0.1);
        $('#flcdsLinkF-' + instance).css('opacity', 0.1);

        mOptions.activedGame = true;

        if (response)
            if (mOptions.cardsGame[mOptions.active].isCorrect) {
                message = mOptions.msgs.msgTrue1;
            } else {
                message = mOptions.msgs.msgTrue2;
                type = 1;
                correctAnswer = false;
            }
        else {
            if (mOptions.cardsGame[mOptions.active].isCorrect) {
                message = mOptions.msgs.msgFalse2;
                type = 1;
                correctAnswer = false;
            } else {
                message = mOptions.msgs.msgFalse1;
            }
        }

        $eXeFlipCards.updateScore(correctAnswer, instance);
        $eXeFlipCards.showMessage(type, message, instance);

        if (mOptions.isScorm == 1) {
            $eXeFlipCards.sendScore(true, instance);
        }

        $eXeFlipCards.saveEvaluation(instance);
        mOptions.activeCard
            .find('.FLCDSP-ImageMessage')
            .stop()
            .fadeIn(500)
            .delay(2000)
            .fadeOut(500, function () {
                if (mOptions.active < mOptions.cardsGame.length - 1) {
                    message = mOptions.msgs.mgsClickCard;
                    $('#flcdsLinkV-' + instance).css('opacity', 1);
                    $('#flcdsLinkF-' + instance).css('opacity', 1);
                    if (mOptions.type == 2) $eXeFlipCards.showClue(instance);
                    $eXeFlipCards.showMessage(0, message, instance);
                    $eXeFlipCards.nextCard(instance);
                } else {
                    $eXeFlipCards.gameOver(0, instance);
                }
                mOptions.activedGame = false;
            });
    },

    checkAudio: function (card, time, instance) {
        const mOptions = $eXeFlipCards.options[instance],
            audio = $(card).find('.FLCDSP-LinkAudioFront').data('audio'),
            audioBK = $(card).find('.FLCDSP-LinkAudioBack').data('audio');

        if ($(card).find('.FLCDSP-FlipCardInner').eq(0).hasClass('flipped')) {
            if (typeof audioBK != 'undefined' && audioBK.length > 3) {
                setTimeout(function () {
                    $exeDevices.iDevice.gamification.media.playSound(
                        audioBK,
                        mOptions
                    );
                }, time);
                $(card).find('.FLCDSP-LinkAudioBack').show();
            }
        } else {
            if (typeof audio != 'undefined' && audio.length > 3) {
                setTimeout(function () {
                    $exeDevices.iDevice.gamification.media.playSound(
                        audio,
                        mOptions
                    );
                }, time);
                $(card).find('.FLCDSP-LinkAudio').show();
            }
        }
    },

    checkFullImage: function (card) {
        const img = $(card).find('.FLCDSP-FullLinkImage-Front').data('url'),
            imgBak = $(card).find('.FLCDSP-FullLinkImage-Back').data('url');

        if ($(card).find('.FLCDSP-FlipCardInner').eq(0).hasClass('flipped')) {
            if (typeof imgBak != 'undefined' && imgBak.length > 3) {
                $(card).find('.FLCDSP-FullLinkImage-Back').show();
            }
        } else {
            if (typeof img != 'undefined' && img.length > 3) {
                $(card).find('.FLCDSP-FullLinkImage-Front').show();
            }
        }
    },

    getScoreVisited: function (instance) {
        const mOptions = $eXeFlipCards.options[instance],
            num = $eXeFlipCards.getNumberVisited(mOptions.visiteds),
            score = (num * 10) / mOptions.realNumberCards;
        return score;
    },

    getNumberVisited: function (visiteds) {
        const lvisiteds = visiteds.filter(function (valor, indice) {
            return visiteds.indexOf(valor) === indice;
        });

        return lvisiteds.length;
    },

    getColors: function (number) {
        const colors = [];
        for (let i = 0; i < number; i++) {
            let color = $eXeFlipCards.colorRGB();
            colors.push(color);
        }
        return colors;
    },

    colorRGB: function () {
        const color =
            '(' +
            (Math.random() * 255).toFixed(0) +
            ',' +
            (Math.random() * 255).toFixed(0) +
            ',' +
            (Math.random() * 255).toFixed(0) +
            ')';
        return 'rgb' + color;
    },

    positionPointerCard: function ($cursor, x, y, type, instance) {
        const mOptions = $eXeFlipCards.options[instance];

        $cursor.hide();
        if (x > 0 || y > 0) {
            const parentClass =
                    type == 0
                        ? '.FLCDSP-ImageContain'
                        : '.FLCDSP-ImageContainMemory',
                siblingClass =
                    type == 0 ? '.FLCDSP-Image' : '.FLCDSP-ImageMemory',
                containerElement = $cursor.parents(parentClass).eq(0),
                imgElement = $cursor.siblings(siblingClass).eq(0);

            if (containerElement.length == 0 || imgElement.length == 0) {
                return;
            }

            const containerPos = containerElement.offset(),
                imgPos = imgElement.offset(),
                marginTop = imgPos.top - containerPos.top,
                marginLeft = imgPos.left - containerPos.left,
                mx = marginLeft + x * imgElement.width(),
                my = marginTop + y * imgElement.height();

            $cursor.css({ left: mx, top: my, 'z-index': 10 });

            if (
                $cursor.parents('.FLCDSP-FlipCardInner').hasClass('flipped') &&
                $cursor.hasClass('FLCDSP-Cursor-Back')
            ) {
                $cursor.show();
            }
            if (
                !$cursor.parents('.FLCDSP-FlipCardInner').hasClass('flipped') &&
                $cursor.hasClass('FLCDSP-CursorFront')
            ) {
                $cursor.show();
            }
            if (mOptions.type == 3) {
                $cursor.show();
            }
        }
    },

    showFrontCard: function (card, instance) {
        const $card = card,
            $text = $card.find('.FLCDSP-ETextFront').eq(0),
            $image = $card.find('.FLCDSP-ImageFront').eq(0),
            $cursor = $card.find('.FLCDSP-CursorFront').eq(0),
            $audio = $card.find('.FLCDSP-LinkAudioFront').eq(0),
            x = parseFloat($image.data('x')) || 0,
            y = parseFloat($image.data('y')) || 0,
            url = $image.data('url') || '',
            alt = $image.attr('alt') || 'No disponible',
            audio = $audio.data('audio') || '',
            text = $text.find('.FLCDSP-ETextDinamyc').html() || '',
            color = $text.data('color') || '#000000',
            backcolor = $text.data('backcolor') || '#ffffff';

        $text.hide();
        $image.hide();
        $cursor.hide();
        $audio.hide();
        if (url.length > 3) {
            $image.attr('alt', alt);
            $image.show();
            $image
                .prop('src', url)
                .on('load', function () {
                    if (
                        !this.complete ||
                        typeof this.naturalWidth == 'undefined' ||
                        this.naturalWidth == 0
                    ) {
                        $cursor.hide();
                    } else {
                        $image.show();
                        $cursor.hide();
                        $eXeFlipCards.positionPointerCard(
                            $cursor,
                            x,
                            y,
                            0,
                            instance
                        );
                    }
                })
                .on('error', function () {
                    $cursor.hide();
                });
            if (text.length > 0) {
                $text.show();
                $text.css({
                    color: color,
                    'background-color': $eXeFlipCards.hexToRgba(backcolor, 0.7),
                });
            }
        } else if (text.length > 0) {
            $text.show();
            $text.css({
                color: color,
                'background-color': backcolor,
            });
        }
        $audio.removeClass('FLCDSP-LinkAudioBig');
        $audio.removeClass('FLCDSP-LinkAudio');
        if (audio.length > 0) {
            if (url.trim().length == 0 && text.trim().length == 0) {
                $audio.addClass('FLCDSP-LinkAudioBig');
            } else {
                $audio.addClass('FLCDSP-LinkAudio');
            }
            $audio.show();
        }
    },

    hexToRgba: function (hex, opacity) {
        return (
            'rgba(' +
            (hex = hex.replace('#', ''))
                .match(new RegExp('(.{' + hex.length / 3 + '})', 'g'))
                .map(function (l) {
                    return parseInt(hex.length % 2 ? l + l : l, 16);
                })
                .concat(isFinite(opacity) ? opacity : 1)
                .join(',') +
            ')'
        );
    },

    showBackCard: function (card, instance) {
        const $card = card,
            $text = $card.find('.FLCDSP-ETextBack').eq(0),
            $image = $card.find('.FLCDSP-ImageBack').eq(0),
            $audio = $card.find('.FLCDSP-LinkAudioBack').eq(0),
            $cursor = $card.find('.FLCDSP-Cursor-Back').eq(0),
            x = parseFloat($image.data('x')) || 0,
            y = parseFloat($image.data('y')) || 0,
            url = $image.data('url') || '',
            alt = $image.attr('alt') || 'No disponible',
            audio = $audio.data('audio') || '',
            text = $text.find('.FLCDSP-ETextDinamyc').text() || '',
            color = $text.data('color') || '#000000',
            backcolor = $text.data('backcolor') || '#ffffff';

        $text.hide();
        $image.hide();
        $audio.hide();
        if (url.length > 3) {
            $image.attr('alt', alt);
            $image.show();
            $image
                .prop('src', url)
                .on('load', function () {
                    if (
                        !this.complete ||
                        typeof this.naturalWidth == 'undefined' ||
                        this.naturalWidth == 0
                    ) {
                        $cursor.hide();
                    } else {
                        $image.show();
                        $cursor.hide();
                        $eXeFlipCards.positionPointerCard(
                            $cursor,
                            x,
                            y,
                            0,
                            instance
                        );
                    }
                })
                .on('error', function () {
                    $cursor.hide();
                });

            if (text.length > 0) {
                $text.show();
                $text.css({
                    color: color,
                    'background-color': $eXeFlipCards.hexToRgba(backcolor, 0.7),
                });
            }
        } else if (text.length > 0) {
            $text.show();
            $text.css({
                color: color,
                'background-color': backcolor,
            });
        }
        $audio.removeClass('FLCDSP-LinkAudioBig');
        $audio.removeClass('FLCDSP-LinkAudio');
        if (audio.length > 0) {
            if (url.trim().length == 0 && text.trim().length == 0) {
                $audio.addClass('FLCDSP-LinkAudioBig');
            } else {
                $audio.addClass('FLCDSP-LinkAudio');
            }
            $audio.show();
        }
    },

    showCard: function (card, instance) {
        $eXeFlipCards.showFrontCard(card, instance);
        $eXeFlipCards.showBackCard(card, instance);
    },

    alfaBColor: function (bcolor) {
        return bcolor.replace('rgb', 'rgba').replace(')', ',.8)');
    },

    refreshGame: function (instance) {
        const mOptions = $eXeFlipCards.options[instance];
        if (!mOptions || mOptions.refreshCard) return;

        if (mOptions.type === 3) {
            $eXeFlipCards.refreshCardsMemory(instance);
        } else {
            $eXeFlipCards.refreshCards(instance);
        }
    },

    refreshCardsMemory: function (instance) {
        const mOptions = $eXeFlipCards.options[instance],
            $flcds = $('#flcdsMultimedia-' + instance).find(
                '.FLCDSP-CardContainerMemory'
            );
        mOptions.refreshCard = true;

        $flcds.each(function () {
            const $card = $(this),
                $imageF = $card.find('.FLCDSP-ImageMemory').eq(0),
                $cursorF = $card.find('.FLCDSP-CursorMemory').eq(0),
                xF = parseFloat($imageF.data('x')) || 0,
                yF = parseFloat($imageF.data('y')) || 0;
            $eXeFlipCards.positionPointerCard($cursorF, xF, yF, 0, instance);
        });
        $eXeFlipCards.setFontSizeMemory(instance);
        mOptions.refreshCard = false;
    },

    refreshCards: function (instance) {
        const mOptions = $eXeFlipCards.options[instance],
            $flcds = $('#flcdsMultimedia-' + instance).find('.FLCDSP-CardDraw');

        mOptions.refreshCard = true;

        $flcds.each(function () {
            const $card = $(this),
                $imageF = $card.find('.FLCDSP-ImageFront').eq(0),
                $cursorF = $card.find('.FLCDSP-CursorFront').eq(0),
                xF = parseFloat($imageF.data('x')) || 0,
                yF = parseFloat($imageF.data('y')) || 0;
            $eXeFlipCards.positionPointerCard($cursorF, xF, yF, 0, instance);

            const $imageB = $card.find('.FLCDSP-ImageBack').eq(0),
                $cursorB = $card.find('.FLCDSP-Cursor-Back').eq(0),
                xB = parseFloat($imageB.data('x')) || 0,
                yB = parseFloat($imageB.data('y')) || 0;
            $eXeFlipCards.positionPointerCard($cursorB, xB, yB, 0, instance);
        });
        $eXeFlipCards.setFontSize(instance);
        mOptions.refreshCard = false;
    },

    enterCodeAccess: function (instance) {
        const mOptions = $eXeFlipCards.options[instance];
        if (
            mOptions.itinerary.codeAccess.toLowerCase() ==
            $('#flcdsCodeAccessE-' + instance)
                .val()
                .toLowerCase()
        ) {
            $('#flcdsCodeAccessDiv-' + instance).hide();
            $('#flcdsCubierta-' + instance).hide();
        } else {
            $('#flcdsMesajeAccesCodeE-' + instance)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $('#flcdsCodeAccessE-' + instance).val('');
        }
    },

    setFontSize: function (instance) {
        const $flcds = $('#flcdsMultimedia-' + instance).find(
            '.FLCDSP-CardDraw'
        );
        $flcds.each(function () {
            const $card = $(this),
                $text = $card
                    .find('.FLCDSP-FlipCardFront')
                    .find('.FLCDSP-EText'),
                latex =
                    $text.find('mjx-container').length > 0 ||
                    $exeDevices.iDevice.gamification.math.hasLatex(
                        $text.text()
                    );

            if (!latex) {
                $eXeFlipCards.adjustFontSize($text);
            } else {
                $eXeFlipCards.setFontSizeMath($text, instance);
            }

            const $textb = $card
                    .find('.FLCDSP-FlipCardBack')
                    .find('.FLCDSP-EText'),
                latexb =
                    $textb.find('mjx-container').length > 0 ||
                    $exeDevices.iDevice.gamification.math.hasLatex(
                        $text.text()
                    );
            if (!latexb) {
                $eXeFlipCards.adjustFontSize($textb);
            } else {
                $eXeFlipCards.setFontSizeMath($textb, instance);
            }
        });
    },

    setFontSizeMemory: function (instance) {
        const $flcds = $('#flcdsMultimedia-' + instance).find(
            '.FLCDSP-CardContainerMemory'
        );
        $flcds.each(function () {
            const $card = $(this),
                $text = $card.find('.FLCDSP-ETextMemory'),
                latex =
                    $text.find('mjx-container').length > 0 ||
                    $exeDevices.iDevice.gamification.math.hasLatex(
                        $text.text()
                    );
            if (!latex) {
                $eXeFlipCards.adjustFontSize($text);
            } else {
                $eXeFlipCards.setFontSizeMath($text, instance);
            }
        });
    },

    getNumberCards: function (instance) {
        const mOptions = $eXeFlipCards.options[instance];
        return mOptions.cardsGame.length;
    },

    setFontSizeMath($text, instance) {
        const numCards = $eXeFlipCards.getNumberCards(instance),
            isFullScreen = $eXeFlipCards.isFullScreen();
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
        $text.css({ 'font-size': `${fontSize} px` });
    },

    isFullScreen: function () {
        return (
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement != null
        );
    },

    adjustFontSize: function ($container) {
        const $text = $container.find('.FLCDSP-ETextDinamyc').eq(0),
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

    initCards: function (instance) {
        const $flcds = $('#flcdsMultimedia-' + instance).find(
            '.FLCDSP-CardDraw'
        );
        $flcds.each(function () {
            $eXeFlipCards.showCard($(this), instance);
        });

        $exeDevices.iDevice.gamification.math.updateLatex(
            '#flcdsMultimedia-' + instance
        );
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

    updateScore: function (correctAnswer, instance) {
        const mOptions = $eXeFlipCards.options[instance];
        let obtainedPoints = 0,
            sscore = 0;

        if (correctAnswer) {
            mOptions.hits++;
            obtainedPoints = 10 / mOptions.realNumberCards;
        } else {
            mOptions.errors++;
        }

        mOptions.score =
            mOptions.score + obtainedPoints > 0
                ? mOptions.score + obtainedPoints
                : 0;
        sscore = mOptions.score.toFixed(2);
        $('#flcdsPScore-' + instance).text(sscore);
        $('#flcdsPHits-' + instance).text(mOptions.hits);
        $('#flcdsPErrors-' + instance).text(mOptions.errors);
        $('#flcdsPNumber-' + instance).text(
            mOptions.realNumberCards - mOptions.hits - mOptions.errors
        );
    },

    showMessage: function (type, message, instance) {
        const colors = [
                '#555555',
                $eXeFlipCards.borderColors.red,
                $eXeFlipCards.borderColors.green,
                $eXeFlipCards.borderColors.blue,
                $eXeFlipCards.borderColors.yellow,
            ],
            color = colors[type],
            $flcdsMessage = $('#flcdsMessage-' + instance);
        $flcdsMessage.html(message);
        $flcdsMessage.css({
            color: color,
            'font-style': 'bold',
        });
        $flcdsMessage.show();
    },

    saveEvaluation: function (instance) {
        const mOptions = $eXeFlipCards.options[instance];
        mOptions.scorerp =
            mOptions.type > 1
                ? ((mOptions.hits * 10) / mOptions.realNumberCards).toFixed(2)
                : $eXeFlipCards.getScoreVisited(instance);
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $eXeFlipCards.isInExe
        );
    },

    sendScore: function (auto, instance) {
        const mOptions = $eXeFlipCards.options[instance];

        mOptions.scorerp =
            mOptions.type > 1
                ? ((mOptions.hits * 10) / mOptions.realNumberCards).toFixed(2)
                : $eXeFlipCards.getScoreVisited(instance);

        mOptions.previousScore = $eXeFlipCards.previousScore;
        mOptions.userName = $eXeFlipCards.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $eXeFlipCards.previousScore = mOptions.previousScore;
    },
};
$(function () {
    $eXeFlipCards.init();
});
