/* eslint-disable no-undef */
/**
 * Descubre activity (Export)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 *
 */
var $eXeDescubre = {
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
    id: false,
    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',
    mScorm: null,

    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            'Discover',
            'discover',
            'descubre-IDevice'
        );
    },

    enable: function () {
        $eXeDescubre.loadGame();
    },

    loadGame: function () {
        $eXeDescubre.options = [];
        $eXeDescubre.activities.each(function (i) {
            const dl = $('.descubre-DataGame', this),
                $imagesLink0 = $('.descubre-LinkImages-0', this),
                $audiosLink0 = $('.descubre-LinkAudios-0', this),
                $imagesLink1 = $('.descubre-LinkImages-1', this),
                $audiosLink1 = $('.descubre-LinkAudios-1', this),
                $imagesLink2 = $('.descubre-LinkImages-2', this),
                $audiosLink2 = $('.descubre-LinkAudios-2', this),
                $imagesLink3 = $('.descubre-LinkImages-3', this),
                $audiosLink3 = $('.descubre-LinkAudios-3', this),
                $imageBack = $('.descubre-ImageBack', this),
                mOption = $eXeDescubre.loadDataGame(
                    dl,
                    $imagesLink0,
                    $audiosLink0,
                    $imagesLink1,
                    $audiosLink1,
                    $imagesLink2,
                    $audiosLink2,
                    $imagesLink3,
                    $audiosLink3
                ),
                msg = mOption.msgs.msgPlayStart;

            mOption.imgCard = '';
            if ($imageBack.length == 1) {
                mOption.imgCard = $imageBack.attr('href') || '';
            }

            mOption.scorerp = 0;
            mOption.idevicePath = $eXeDescubre.idevicePath;
            mOption.main = 'descubreMainContainer-' + i;
            mOption.idevice = 'descubre-IDevice';

            $eXeDescubre.options.push(mOption);

            const descubre = $eXeDescubre.createInterfaceDescubre(i);

            dl.before(descubre).remove();
            $('#descubreGameMinimize-' + i)
                .css({
                    cursor: 'pointer',
                })
                .show();
            $('#descubreGameContainer-' + i).show();

            if (mOption.showMinimize) {
                $('#descubreGameContainer-' + i).hide();
            } else {
                $('#descubreGameMinimize-' + i).hide();
            }

            $('#descubreMessageMaximize-' + i).text(msg);
            $('#descubreDivFeedBack-' + i).prepend(
                $('.descubre-feedback-game', this)
            );

            $eXeDescubre.addCards(i, mOption.cardsGame);
            $eXeDescubre.addEvents(i);

            $('#descubreDivFeedBack-' + i).hide();
            $('#descubreMainContainer-' + i).show();
        });

        let node = document.querySelector('.page-content');
        if (this.isInExe) {
            node = document.getElementById('node-content');
        }
        if (node)
            $exeDevices.iDevice.gamification.observers.observeResize(
                $eXeDescubre,
                node
            );

        $exeDevices.iDevice.gamification.math.updateLatex('.descubre-IDevice');
    },

    getQuestionDefault() {
        const data = [];
        for (let i = 0; i < 4; i++) {
            data.push({
                type: 0,
                url: '',
                audio: '',
                x: 0,
                y: 0,
                author: '',
                alt: '',
                eText: '',
                color: '#000000',
                backcolor: '#ffffff',
            });
        }
        return {
            data,
            msgError: '',
            msgHit: '',
        };
    },

    loadDataGame: function (
        data,
        imgsLink0,
        audioLink0,
        imgsLink1,
        audioLink1,
        imgsLink2,
        audioLink2,
        imgsLink3,
        audioLink3
    ) {
        const json = $exeDevices.iDevice.gamification.helpers.decrypt(
            data.text()
        );
        const linkImages = [imgsLink0, imgsLink1, imgsLink2, imgsLink3],
            linkAudios = [audioLink0, audioLink1, audioLink2, audioLink3],
            mOptions =
                $exeDevices.iDevice.gamification.helpers.isJsonString(json);

        mOptions.percentajeQuestions =
            typeof mOptions.percentajeQuestions != 'undefined'
                ? mOptions.percentajeQuestions
                : 100;
        mOptions.playerAudio = '';
        mOptions.percentajeFB =
            typeof mOptions.percentajeFB != 'undefined'
                ? mOptions.percentajeFB
                : 100;
        mOptions.timeShowSolution =
            typeof mOptions.timeShowSolution != 'undefined'
                ? mOptions.timeShowSolution * 1000
                : 3000;
        mOptions.showSolution =
            typeof mOptions.showSolution != 'undefined'
                ? mOptions.showSolution
                : true;
        mOptions.author =
            typeof mOptions.author != 'undefined' ? mOptions.author : '';
        mOptions.gameMode =
            typeof mOptions.gameMode != 'undefined' ? mOptions.gameMode : 0;
        mOptions.gameLevels =
            typeof mOptions.gameLevels != 'undefined' ? mOptions.gameLevels : 1;
        mOptions.showCards =
            typeof mOptions.showCards != 'undefined'
                ? mOptions.showCards
                : false;
        mOptions.customMessages =
            typeof mOptions.customMessages != 'undefined'
                ? mOptions.customMessages
                : false;
        mOptions.timeShowSolution = mOptions.showCards
            ? 2000
            : mOptions.timeShowSolution;

        if (typeof mOptions.version == 'undefined' || mOptions.version < 1) {
            imgsLink0.each(function () {
                const iq = parseInt($(this).text());
                if (!isNaN(iq) && iq < mOptions.wordsGame.length) {
                    mOptions.wordsGame[iq].url0 = $(this).attr('href');
                    if (mOptions.wordsGame[iq].url0.length < 4) {
                        mOptions.wordsGame[iq].url0 = '';
                    }
                }
            });

            audioLink0.each(function () {
                const iq = parseInt($(this).text());
                if (!isNaN(iq) && iq < mOptions.wordsGame.length) {
                    mOptions.wordsGame[iq].audio0 = $(this).attr('href');
                    if (mOptions.wordsGame[iq].audio0.length < 4) {
                        mOptions.wordsGame[iq].audio0 = '';
                    }
                }
            });

            imgsLink1.each(function () {
                const iq = parseInt($(this).text());
                if (!isNaN(iq) && iq < mOptions.wordsGame.length) {
                    mOptions.wordsGame[iq].url1 = $(this).attr('href');
                    if (mOptions.wordsGame[iq].url1.length < 4) {
                        mOptions.wordsGame[iq].url1 = '';
                    }
                }
            });

            audioLink1.each(function () {
                const iq = parseInt($(this).text());
                if (!isNaN(iq) && iq < mOptions.wordsGame.length) {
                    mOptions.wordsGame[iq].audio1 = $(this).attr('href');
                    if (mOptions.wordsGame[iq].audio1.length < 4) {
                        mOptions.wordsGame[iq].audio1 = '';
                    }
                }
            });

            if (mOptions.gameMode > 0) {
                imgsLink2.each(function () {
                    const iq = parseInt($(this).text());
                    if (!isNaN(iq) && iq < mOptions.wordsGame.length) {
                        mOptions.wordsGame[iq].url2 = $(this).attr('href');
                        if (mOptions.wordsGame[iq].url2.length < 4) {
                            mOptions.wordsGame[iq].url2 = '';
                        }
                    }
                });
                audioLink2.each(function () {
                    const iq = parseInt($(this).text());
                    if (!isNaN(iq) && iq < mOptions.wordsGame.length) {
                        mOptions.wordsGame[iq].audio1 = $(this).attr('href');
                        if (mOptions.wordsGame[iq].audio2.length < 4) {
                            mOptions.wordsGame[iq].audio2 = '';
                        }
                    }
                });
            }

            let words = [];
            for (let j = 0; j < mOptions.wordsGame.length; j++) {
                const p = $eXeDescubre.getQuestionDefault();
                p.data[0].url = mOptions.wordsGame[j].url0 || '';
                p.data[1].url = mOptions.wordsGame[j].url1 || '';
                p.data[2].url = mOptions.wordsGame[j].url2 || '';
                p.data[3].url = '';
                p.data[0].audio = mOptions.wordsGame[j].audio0 || '';
                p.data[1].audio = mOptions.wordsGame[j].audio1 || '';
                p.data[2].audio = mOptions.wordsGame[j].audio2 || '';
                p.data[3].audio = '';
                p.data[0].x = mOptions.wordsGame[j].x0 || 0;
                p.data[1].x = mOptions.wordsGame[j].x1 || 0;
                p.data[2].x = mOptions.wordsGame[j].x2 || 0;
                p.data[3].x = 0;
                p.data[0].y = mOptions.wordsGame[j].y0 || 0;
                p.data[1].y = mOptions.wordsGame[j].y1 || 0;
                p.data[2].y = mOptions.wordsGame[j].y2 || 0;
                p.data[3].y = 0;
                p.data[0].author = mOptions.wordsGame[j].autmor0 || '';
                p.data[1].author = mOptions.wordsGame[j].autmor1 || '';
                p.data[2].author = mOptions.wordsGame[j].autmor2 || '';
                p.data[3].author = '';
                p.data[0].alt = mOptions.wordsGame[j].alt0 || '';
                p.data[1].alt = mOptions.wordsGame[j].alt1 || '';
                p.data[2].alt = mOptions.wordsGame[j].alt2 || '';
                p.data[3].alt = '';
                p.data[0].eText = mOptions.wordsGame[j].eText0 || '';
                p.data[1].eText = mOptions.wordsGame[j].eText1 || '';
                p.data[2].eText = mOptions.wordsGame[j].eText2 || '';
                p.data[3].eText = '';
                p.data[0].backcolor = '#ffffff';
                p.data[1].backcolor = '#ffffff';
                p.data[2].backcolor = '#ffffff';
                p.data[3].backcolor = '#ffffff';
                p.data[0].color = '#ffffff';
                p.data[1].color = '#ffffff';
                p.data[2].color = '#ffffff';
                p.data[3].color = '#ffffff';
                p.msgError = '';
                p.msgHit = '';
                words.push(p);
            }
            mOptions.wordsGame = words;
        } else {
            for (let k = 0; k < linkImages.length; k++) {
                const $linImg = linkImages[k];
                $linImg.each(function () {
                    const iq = parseInt($(this).text());
                    if (!isNaN(iq) && iq < mOptions.wordsGame.length) {
                        const p = mOptions.wordsGame[iq].data[k];
                        p.url = $(this).attr('href');
                        if (p.url.length < 4) {
                            p.url = '';
                        }
                    }
                });

                const $linkAudio = linkAudios[k];
                $linkAudio.each(function () {
                    const iq = parseInt($(this).text());
                    if (!isNaN(iq) && iq < mOptions.wordsGame.length) {
                        const p = mOptions.wordsGame[iq].data[k];
                        p.audio = $(this).attr('href');
                        if (p.audio.length < 4) {
                            p.audio = '';
                        }
                    }
                });
            }
        }

        mOptions.wordsGame =
            $exeDevices.iDevice.gamification.helpers.getQuestions(
                mOptions.wordsGame,
                mOptions.percentajeQuestions
            );
        mOptions.numberQuestions = mOptions.wordsGame.length;
        mOptions.wordsGameFix = mOptions.wordsGame;
        mOptions.cardsGame = $eXeDescubre.createCardsData(
            mOptions.wordsGame,
            mOptions.gameMode
        );
        mOptions.fullscreen = false;
        mOptions.evaluation =
            typeof mOptions.evaluation == 'undefined'
                ? false
                : mOptions.evaluation;
        mOptions.evaluationID =
            typeof mOptions.evaluationID == 'undefined'
                ? ''
                : mOptions.evaluationID;
        mOptions.id = typeof mOptions.id == 'undefined' ? false : mOptions.id;

        return mOptions;
    },

    createCardsData: function (wordsGame, gameMode) {
        let cardsGame = [],
            d = 0,
            j = 0;
        if (gameMode == 0) {
            while (j < wordsGame.length) {
                const p = {};
                if (d % 2 == 0) {
                    p.number = j;
                    p.url = wordsGame[j].data[0].url;
                    p.eText = wordsGame[j].data[0].eText;
                    p.audio = wordsGame[j].data[0].audio;
                    p.x = wordsGame[j].data[0].x;
                    p.y = wordsGame[j].data[0].y;
                    p.alt = wordsGame[j].data[0].alt;
                    p.color = wordsGame[j].data[0].color;
                    p.backcolor = wordsGame[j].data[0].backcolor;
                    p.correct = 0;
                } else {
                    p.number = j;
                    p.url = wordsGame[j].data[1].url;
                    p.eText = wordsGame[j].data[1].eText;
                    p.audio = wordsGame[j].data[1].audio;
                    p.x = wordsGame[j].data[1].x;
                    p.y = wordsGame[j].data[1].y;
                    p.alt = wordsGame[j].data[1].alt;
                    p.color = wordsGame[j].data[1].color;
                    p.backcolor = wordsGame[j].data[1].backcolor;
                    j++;
                }
                d++;
                cardsGame.push(p);
            }
        } else if (gameMode == 1) {
            while (j < wordsGame.length) {
                const p = {};
                if (d % 3 == 0) {
                    p.number = j;
                    p.url = wordsGame[j].data[0].url;
                    p.eText = wordsGame[j].data[0].eText;
                    p.audio = wordsGame[j].data[0].audio;
                    p.x = wordsGame[j].data[0].x;
                    p.y = wordsGame[j].data[0].y;
                    p.alt = wordsGame[j].data[0].alt;
                    p.color = wordsGame[j].data[0].color;
                    p.backcolor = wordsGame[j].data[0].backcolor;
                    p.correct = 0;
                } else if (d % 3 == 1) {
                    p.number = j;
                    p.url = wordsGame[j].data[1].url;
                    p.eText = wordsGame[j].data[1].eText;
                    p.audio = wordsGame[j].data[1].audio;
                    p.x = wordsGame[j].data[1].x;
                    p.y = wordsGame[j].data[1].y;
                    p.alt = wordsGame[j].data[1].alt;
                    p.color = wordsGame[j].data[1].color;
                    p.backcolor = wordsGame[j].data[1].backcolor;
                    p.correct = 0;
                } else if (d % 3 == 2) {
                    p.number = j;
                    p.url = wordsGame[j].data[2].url;
                    p.eText = wordsGame[j].data[2].eText;
                    p.audio = wordsGame[j].data[2].audio;
                    p.x = wordsGame[j].data[2].x;
                    p.y = wordsGame[j].data[2].y;
                    p.alt = wordsGame[j].data[2].alt;
                    p.color = wordsGame[j].data[2].color;
                    p.backcolor = wordsGame[j].data[2].backcolor;
                    p.correct = 0;
                    j++;
                }
                d++;
                cardsGame.push(p);
            }
        } else if (gameMode == 2) {
            while (j < wordsGame.length) {
                const p = {};
                if (d % 4 == 0) {
                    p.number = j;
                    p.url = wordsGame[j].data[0].url;
                    p.eText = wordsGame[j].data[0].eText;
                    p.audio = wordsGame[j].data[0].audio;
                    p.x = wordsGame[j].data[0].x;
                    p.y = wordsGame[j].data[0].y;
                    p.alt = wordsGame[j].data[0].alt;
                    p.color = wordsGame[j].data[0].color;
                    p.backcolor = wordsGame[j].data[0].backcolor;
                    p.correct = 0;
                } else if (d % 4 == 1) {
                    p.number = j;
                    p.url = wordsGame[j].data[1].url;
                    p.eText = wordsGame[j].data[1].eText;
                    p.audio = wordsGame[j].data[1].audio;
                    p.x = wordsGame[j].data[1].x;
                    p.y = wordsGame[j].data[1].y;
                    p.alt = wordsGame[j].data[1].alt;
                    p.color = wordsGame[j].data[1].color;
                    p.backcolor = wordsGame[j].data[1].backcolor;
                    p.correct = 0;
                } else if (d % 4 == 2) {
                    p.number = j;
                    p.url = wordsGame[j].data[2].url;
                    p.eText = wordsGame[j].data[2].eText;
                    p.audio = wordsGame[j].data[2].audio;
                    p.x = wordsGame[j].data[2].x;
                    p.y = wordsGame[j].data[2].y;
                    p.alt = wordsGame[j].data[2].alt;
                    p.color = wordsGame[j].data[2].color;
                    p.backcolor = wordsGame[j].data[2].backcolor;
                    p.correct = 0;
                } else if (d % 4 == 3) {
                    p.number = j;
                    p.url = wordsGame[j].data[3].url;
                    p.eText = wordsGame[j].data[3].eText;
                    p.audio = wordsGame[j].data[3].audio;
                    p.x = wordsGame[j].data[3].x;
                    p.y = wordsGame[j].data[3].y;
                    p.alt = wordsGame[j].data[3].alt;
                    p.color = wordsGame[j].data[3].color;
                    p.backcolor = wordsGame[j].data[3].backcolor;
                    p.correct = 0;
                    j++;
                }
                d++;
                cardsGame.push(p);
            }
        }
        return cardsGame;
    },

    setFontSize: function (instance) {
        const mOptions = $eXeDescubre.options[instance];
        if (!mOptions) return;
        const $discovers = $('#descubreMultimedia-' + instance).find(
            '.DescubreQP-CardContainer'
        );
        if (mOptions.refrescards) return;
        mOptions.refrescards = true;
        $discovers.each(function () {
            const $card = $(this),
                $textcontainer = $card.find('.DescubreQP-EText'),
                latex =
                    $textcontainer.find('mjx-container').length > 0 ||
                    $exeDevices.iDevice.gamification.math.hasLatex(
                        $textcontainer.text()
                    );

            if (!latex) {
                $eXeDescubre.adjustFontSize($textcontainer);
            } else {
                $eXeFlipeXeDescubreCards.setFontSizeMath(
                    $textcontainer,
                    instance
                );
            }
        });
        mOptions.refrescards = false;
    },

    adjustFontSize: function ($container) {
        const $text = $container.find('.DescubreQP-ETextDinamyc').eq(0),
            minFontSize = 8,
            maxFontSize = 20,
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

    setFontSizeMath: function ($text, instance) {
        const numCardsl = $eXeDescubre.getNumberCards(instance);
        let fontsz = '16px';
        if ($eXeDescubre.isFullScreen()) {
            fontsz = '16px';
            if (numCardsl > 34) {
                fontsz = '8px';
            } else if (numCardsl > 24) {
                fontsz = '10px';
            } else if (numCardsl > 18) {
                fontsz = '12px';
            } else if (numCardsl > 10) {
                fontsz = '14px';
            }
        } else {
            fontsz = '14px';
            if (numCardsl > 34) {
                fontsz = '6px';
            } else if (numCardsl > 24) {
                fontsz = '8px';
            } else if (numCardsl > 18) {
                fontsz = '10px';
            } else if (numCardsl > 10) {
                fontsz = '12px';
            }
        }
        $text.css({ 'font-size': fontsz });
    },

    getNumberCards: function (instance) {
        const mOptions = $eXeDescubre.options[instance];
        return mOptions.wordsGame.length * (mOptions.gameMode + 2);
    },

    createInterfaceDescubre: function (instance) {
        const path = $eXeDescubre.idevicePath,
            msgs = $eXeDescubre.options[instance].msgs,
            mOptions = $eXeDescubre.options[instance],
            html = `
        <div class="DescubreQP-MainContainer"  id="descubreMainContainer-${instance}">
            <div class="DescubreQP-GameMinimize" id="descubreGameMinimize-${instance}">
                <a href="#" class="DescubreQP-LinkMaximize" id="descubreLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                    <img src="${path}descubreIcon.png" class="DescubreQP-IconMinimize DescubreQP-Activo" alt="">
                    <div class="DescubreQP-MessageMaximize" id="descubreMessageMaximize-${instance}"></div>
                </a>
            </div>
            <div class="DescubreQP-GameContainer" id="descubreGameContainer-${instance}">
                <div class="DescubreQP-GameScoreBoard" id="descubreGameScoreBoard-${instance}">
                    <div class="DescubreQP-GameScores">
                        <div class="exeQuextIcons exeQuextIcons-Number" id="descubrePNumberIcon-${instance}" title="${msgs.msgNumbersAttemps}"></div>
                        <p><span class="sr-av">${msgs.msgNumQuestions}: </span><span id="descubrePNumber-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Number" title="${msgs.msgNumbersAttemps}"></div>
                        <p><span class="sr-av">${msgs.msgErrors}: </span><span id="descubrePErrors-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                        <p><span class="sr-av">${msgs.msgHits}: </span><span id="descubrePHits-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Score" id="descubrePScoreIcon-${instance}" title="${msgs.msgScore}"></div>
                        <p><span class="sr-av">${msgs.msgScore}: </span><span id="descubrePScore-${instance}">0</span></p>
                    </div>
                    <div class="Descubrebre-Info" id="descubreInfo-${instance}">${msgs.msgSelectLevel}</div>
                    <div class="DescubreQP-TimeNumber">
                        <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                        <div class="exeQuextIcons exeQuextIcons-Time" id="descubreImgTime-${instance}" title="${msgs.msgTime}"></div>
                        <p id="descubrePTime-${instance}" class="DescubreQP-PTime">00:00</p>
                        <a href="#" class="DescubreQP-LinkFullScreen" id="descubreLinkReboot-${instance}" title="${msgs.msgReboot}">
                            <strong><span class="sr-av">${msgs.msgReboot}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-IconReboot DescubreQP-Activo" id="descubreReboot-${instance}"></div>
                        </a>
                        <a href="#" class="DescubreQP-LinkMinimize" id="descubreLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                            <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Minimize DescubreQP-Activo"></div>
                        </a>
                        <a href="#" class="DescubreQP-LinkFullScreen" id="descubreLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                            <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-FullScreen DescubreQP-Activo" id="descubreFullScreen-${instance}"></div>
                        </a>
                    </div>
                </div>
                <div class="DescubreQP-Message" id="descubreMessage-${instance}"></div>
                <div class="DescubreQP-StartNivel" id="descubreStartLevels-${instance}">
                    <a href="#" id="descubreStartGame0-${instance}">${msgs.msgRookie}</a>
                    <a href="#" id="descubreStartGame1-${instance}">${msgs.msgExpert}</a>
                    <a href="#" id="descubreStartGame2-${instance}">${msgs.msgMaster}</a>
                </div>
                <div class="DescubreQP-Multimedia" id="descubreMultimedia-${instance}"></div>               
                <div class="DescubreQP-DivFeedBack" id="descubreDivFeedBack-${instance}">
                    <input type="button" id="descubreFeedBackClose-${instance}" value="${msgs.msgClose}" class="feedbackbutton" />
                </div>
                <div class="DescubreQP-AuthorGame" id="descubreAuthorGame-${instance}"></div>
            </div>
             <div class="DescubreQP-Cubierta" id="descubreCubierta-${instance}">
                    <div class="DescubreQP-GameOverExt" id="descubreGameOver-${instance}">
                        <div class="DescubreQP-StartGame" id="descubreMesasgeEnd-${instance}"></div>
                        <div class="DescubreQP-GameOver">
                            <div class="DescubreQP-DataImage">
                                <img src="${path}exequextwon.png" class="DescubreQP-HistGGame" id="descubreHistGame-${instance}" alt="${msgs.msgAllQuestions}" />
                                <img src="${path}exequextlost.png" class="DescubreQP-LostGGame" id="descubreLostGame-${instance}" alt="${msgs.msgTimeOver}" />
                            </div>
                            <div class="DescubreQP-DataScore">
                                <p id="descubreOverNumCards-${instance}"></p>
                                <p id="descubreOverAttemps-${instance}"></p>
                                <p id="descubreOverHits-${instance}"></p>
                            </div>
                        </div>
                        <div class="DescubreQP-StartGame"><a href="#" id="descubreShowSolution-${instance}">Mostrar soluciones</a></div>
                        <div class="DescubreQP-StartGame"><a href="#" id="descubreStartGameEnd-${instance}">${msgs.msgPlayAgain}</a></div>
                    </div>
                    <div class="DescubreQP-CodeAccessDiv" id="descubreCodeAccessDiv-${instance}">
                        <div class="DescubreQP-MessageCodeAccessE" id="descubreMesajeAccesCodeE-${instance}"></div>
                        <div class="DescubreQP-DataCodeAccessE">
                            <label class="sr-av">${msgs.msgCodeAccess}:</label>
                            <input type="text" class="DescubreQP-CodeAccessE form-control" id="descubreCodeAccessE-${instance}" placeholder="${msgs.msgCodeAccess}">
                            <a href="#" id="descubreCodeAccessButton-${instance}" title="${msgs.msgSubmit}">
                                <strong><span class="sr-av">${msgs.msgSubmit}</span></strong>
                                <div class="exeQuextIcons-Submit DescubreQP-Activo"></div>
                            </a>
                        </div>
                    </div>
                    <div class="DescubreQP-ShowClue" id="descubreShowClue-${instance}">
                        <p class="sr-av">${msgs.msgClue}</p>
                        <p class="DescubreQP-PShowClue" id="descubrePShowClue-${instance}">Esta es la pista que necesitas</p>
                        <a href="#" class="DescubreQP-ClueBotton" id="descubreClueButton-${instance}" title="Continuar">Continuar </a>
                    </div>
                </div>
        </div>
       ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}
        `;
        return html;
    },

    saveEvaluation: function (instance) {
        const mOptions = $eXeDescubre.options[instance];

        mOptions.scorerp = (mOptions.hits * 10) / mOptions.wordsGame.length;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $eXeDescubre.isInExe
        );
    },

    sendScore: function (auto, instance) {
        const mOptions = $eXeDescubre.options[instance];

        mOptions.scorerp = (mOptions.hits * 10) / mOptions.wordsGame.length;
        mOptions.previousScore = $eXeDescubre.previousScore;
        mOptions.userName = $eXeDescubre.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $eXeDescubre.previousScore = mOptions.previousScore;
    },

    addCards: function (instance, cardsGame) {
        const mOptions = $eXeDescubre.options[instance];
        let cards = '';
        cardsGame =
            $exeDevices.iDevice.gamification.helpers.shuffleAds(cardsGame);
        $('#descubreMultimedia-' + instance)
            .find('.DescubreQP-CardContainer')
            .remove();
        for (let i = 0; i < cardsGame.length; i++) {
            const card = $eXeDescubre.createCard({
                index: cardsGame[i].number,
                url: cardsGame[i].url,
                text: cardsGame[i].eText,
                audio: cardsGame[i].audio,
                x: cardsGame[i].x,
                y: cardsGame[i].y,
                alt: cardsGame[i].alt,
                color: cardsGame[i].color,
                backcolor: cardsGame[i].backcolor,
                instance,
            });
            cards += card;
        }
        $('#descubreMultimedia-' + instance).append(cards);
        if (mOptions.imgCard.length > 4) {
            $('#descubreMultimedia-' + instance)
                .find('.DescubreQP-CardContainer')
                .each(function () {
                    $(this)
                        .find('.DescubreQP-CardFront')
                        .css({
                            'background-image': 'url(' + mOptions.imgCard + ')',
                            'background-size': 'cover',
                        });
                });
        }
        $eXeDescubre.refreshGame(instance);
    },

    createCard({
        index = 0,
        url = '',
        text = '',
        audio = '',
        x = 0,
        y = 0,
        alt = '',
        color = '#000',
        backcolor = '#fff',
        instance = 0,
    }) {
        const opts = $eXeDescubre.options[instance] || {};
        const msgs = opts.msgs || {};

        const fullImageLink = () => {
            if (!url) return '';
            return `
            <a href="#" class="DescubreQP-FullLinkImage" data-url="${url}"
               title="${msgs.msgFullScreen}" aria-label="${msgs.msgFullScreen}">
              <div class="exeQuextIcons exeQuextIcons-FullImage" ></div>
              <span class="sr-av">${msgs.msgFullScreen}</span>
            </a>`;
        };

        const audioLink = () => {
            const hasContent = url.trim() || text.trim();
            const cls = hasContent
                ? 'DescubreQP-LinkAudio'
                : 'DescubreQP-LinkAudioBig';
            return `
            <a href="#" data-audio="${audio}" class="${cls}" title="${msgs.msgAudio || 'Audio'}">
              <img src="${$eXeDescubre.idevicePath}exequextplayaudio.svg"
                   class="DescubreQP-Audio"
                   alt="${msgs.msgAudio || 'Audio'}">
            </a>`;
        };

        return `
            <div class="DescubreQP-CardContainer"
                data-number="${index}"
                data-state="-1">
                <div class="DescubreQP-Card1" data-state="-1" data-valid="0">
                <div class="DescubreQP-CardFront"></div>
                <div class="DescubreQP-CardBack">
                    <div class="DescubreQP-ImageContain">
                    <img src="" class="DescubreQP-Image"
                        data-url="${url}"
                        data-x="${x}"
                        data-y="${y}"
                        alt="${alt}">
                    <img class="DescubreQP-Cursor"
                        src="${$eXeDescubre.idevicePath}exequextcursor.gif"
                        alt="">
                    </div>
                    <div class="DescubreQP-EText"
                        data-color="${color}"
                        data-backcolor="${backcolor}">
                    <div class="DescubreQP-ETextDinamyc">${text}</div>
                    </div>
                    ${fullImageLink()}
                    ${audioLink()}
                </div>
            </div>
        </div>`;
    },

    clear: function (phrase) {
        return phrase.replace(/[&\s\n\r]+/g, ' ').trim();
    },

    hexToRgba: function (hex) {
        hex = hex.replace(/^#/, '');
        if (!/^[\da-f]{3}([\da-f]{3})?$/i.test(hex))
            throw new Error('Color hexadecimal inválido');
        if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
        const [r, g, b] = [
            hex.slice(0, 2),
            hex.slice(2, 4),
            hex.slice(4, 6),
        ].map((v) => parseInt(v, 16));
        return `rgba(${r}, ${g}, ${b}, 0.7)`;
    },

    isFullScreen: function () {
        return (
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement != null
        );
    },
    removeEvents: function (instance) {
        const $descubreGameContainer = $('#descubreGameContainer-' + instance);
        const $mainContainer = $('#descubreMainContainer-' + instance).closest(
            '.idevice_node'
        );
        const $container = $('#descubreMultimedia-' + instance);
        $('#descubreLinkMaximize-' + instance).off(
            'click.eXeDescubre touchstart.eXeDescubre'
        );
        $('#descubreLinkMinimize-' + instance).off(
            'click.eXeDescubre touchstart.eXeDescubre'
        );
        $('#descubreLinkFullScreen-' + instance).off(
            'click.eXeDescubre touchstart.eXeDescubre'
        );
        $('#descubreFeedBackClose-' + instance).off('click.eXeDescubre');
        $('#descubreCodeAccessButton-' + instance).off(
            'click.eXeDescubre touchstart.eXeDescubre'
        );
        $('#descubreCodeAccessE-' + instance).off('keydown.eXeDescubre');
        $(window).off('unload.eXeDescubre beforeunload.eXeDescubre');
        $mainContainer.off('click.eXeDescubre', '.Games-SendScore');
        $('#descubreStartGame0-' + instance).off('click.eXeDescubre');
        $('#descubreStartGame1-' + instance).off('click.eXeDescubre');
        $('#descubreStartGame2-' + instance).off('click.eXeDescubre');
        $('#descubreStartGameEnd-' + instance).off('click.eXeDescubre');
        $('#descubreReboot-' + instance).off('click.eXeDescubre');
        $('#descubreShowSolution-' + instance).off('click.eXeDescubre');
        $('#descubreClueButton-' + instance).off('click.eXeDescubre');
        $('#descubreMultimedia-' + instance).off(
            'click.eXeDescubre',
            '.DescubreQP-CardContainer'
        );
        $container.off('click.eXeDescubre', 'a[data-audio]');
        $descubreGameContainer.off(
            'click.eXeDescubre',
            '.DescubreQP-FullLinkImage'
        );
    },

    addEvents: function (instance) {
        const mOptions = $eXeDescubre.options[instance];
        $eXeDescubre.removeEvents(instance);
        const $descubreGameContainer = $('#descubreGameContainer-' + instance);

        $('#descubreLinkMaximize-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $descubreGameContainer.show();
                $('#descubreGameMinimize-' + instance).hide();
            }
        );

        $('#descubreLinkMinimize-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $descubreGameContainer.hide();
                $('#descubreGameMinimize-' + instance)
                    .css('visibility', 'visible')
                    .show();
            }
        );

        $('#descubreCubierta-' + instance).hide();
        $('#descubreGameOver-' + instance).hide();
        $('#descubreCodeAccessDiv-' + instance).hide();
        $('#descubrePScore-' + instance).hide();
        $('#descubrePScoreIcon-' + instance).hide();
        $('#descubrePNumber-' + instance).hide();
        $('#descubrePNumberIcon-' + instance).hide();

        $eXeDescubre.showStartGame(instance, true);

        $('#descubreStartLevels-' + instance).show();

        $('#descubreLinkFullScreen-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                const element = document.getElementById(
                    'descubreGameContainer-' + instance
                );
                $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                    element
                );
                setTimeout(function () {
                    $eXeDescubre.refreshGame(instance);
                }, 100);
            }
        );

        $('#descubreFeedBackClose-' + instance).on('click', function () {
            $('#descubreDivFeedBack-' + instance).hide();
            $('#descubreGameOver-' + instance).show();
        });

        if (mOptions.itinerary.showCodeAccess) {
            $('#descubreMesajeAccesCodeE-' + instance).text(
                mOptions.itinerary.messageCodeAccess
            );
            $('#descubreCodeAccessDiv-' + instance).show();
            $('#descubreStartLevels-' + instance).hide();
            $('#descubreCubierta-' + instance).show();
        }

        $('#descubreCodeAccessButton-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $eXeDescubre.enterCodeAccess(instance);
            }
        );

        $('#descubreCodeAccessE-' + instance).on('keydown', function (event) {
            if (event.which == 13 || event.keyCode == 13) {
                $eXeDescubre.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        $('#descubrePNumber-' + instance).text(mOptions.numberQuestions);
        $(window).on(
            'unload.eXeDescubre beforeunload.eXeDescubre',
            function () {
                if (typeof $eXeDescubre.mScorm != 'undefined') {
                    $exeDevices.iDevice.gamification.scorm.endScorm(
                        $eXeDescubre.mScorm
                    );
                }
            }
        );

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        $('#descubreMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $eXeDescubre.sendScore(false, instance);
                $eXeDescubre.saveEvaluation(instance);
            });
        $('#descubreImage-' + instance).hide();

        $('#descubreStartGame0-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeDescubre.startGame(instance, 0);
        });

        $('#descubreStartGame1-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeDescubre.startGame(instance, 1);
        });

        $('#descubreStartGame2-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeDescubre.startGame(instance, 2);
        });

        $('#descubreStartGameEnd-' + instance).on('click', function (e) {
            e.preventDefault();
            if (mOptions.gameLevels == 1) {
                $eXeDescubre.startGame(instance, 0);
                return;
            }
            $('#descubreCubierta-' + instance).hide();
            $('#descubreStartLevels-' + instance).show();
            $('#descubreMultimedia-' + instance)
                .find('.DescubreQP-Card1')
                .removeClass('flipped');
        });

        $('#descubreReboot-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeDescubre.rebootGame(instance);
        });

        $('#descubreShowSolution-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeDescubre.showSolutions(instance);
        });

        $('#descubreClueButton-' + instance).on('click', function (e) {
            e.preventDefault();
            $('#descubreShowClue-' + instance).hide();
            $('#descubreCubierta-' + instance).fadeOut();
        });

        $('#descubreMultimedia-' + instance).on(
            'click',
            '.DescubreQP-CardContainer',
            function () {
                $eXeDescubre.cardClick(this, instance);
            }
        );

        const $container = $('#descubreMultimedia-' + instance);

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

        $('#descubrePErrors-' + instance).text(mOptions.attempts);
        if (mOptions.time == 0) {
            $('#descubrePTime-' + instance).hide();
            $('#descubreImgTime-' + instance).hide();
            $eXeDescubre.uptateTime(mOptions.time * 60, instance);
        } else {
            $eXeDescubre.uptateTime(mOptions.time * 60, instance);
        }

        if (mOptions.author.trim().length > 0 && !mOptions.fullscreen) {
            $('#descubreAuthorGame-' + instance).html(
                mOptions.msgs.msgAuthor + '; ' + mOptions.author
            );
            $('#descubreAuthorGame-' + instance).show();
        }
        if (!mOptions.showSolution) {
            $('#descubreShowSolution-' + instance).hide();
        }

        $descubreGameContainer.off('click', '.DescubreQP-FullLinkImage');
        $descubreGameContainer.on(
            'click',
            '.DescubreQP-FullLinkImage',
            function (e) {
                e.preventDefault();
                const largeImageSrc = $(this).data('url');
                if (largeImageSrc && largeImageSrc.length > 3) {
                    $exeDevices.iDevice.gamification.helpers.showFullscreenImage(
                        largeImageSrc,
                        $descubreGameContainer
                    );
                }
            }
        );

        setTimeout(function () {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                this.isInExe
            );
        }, 500);
    },

    showStartGame: function (instance, show) {
        const mOptions = $eXeDescubre.options[instance];
        $('#descubreStartGame0-' + instance).hide();
        $('#descubreStartGame1-' + instance).hide();
        $('#descubreStartGame2-' + instance).hide();
        $('#descubreInfo-' + instance).show();

        if (show) {
            if (mOptions.gameLevels == 1) {
                $('#descubreStartGame2-' + instance).show();
                $('#descubreStartGame2-' + instance).text(
                    mOptions.msgs.msgPlayStart
                );
                $('#descubreInfo-' + instance).hide();
            } else if (mOptions.gameLevels == 2) {
                $('#descubreStartGame0-' + instance).show();
                $('#descubreStartGame2-' + instance).show();
            }
            if (mOptions.gameLevels == 3) {
                $('#descubreStartGame0-' + instance).show();
                $('#descubreStartGame1-' + instance).show();
                $('#descubreStartGame2-' + instance).show();
            }
        }
    },

    cardClick: function (cc, instance) {
        const mOptions = $eXeDescubre.options[instance],
            $cc = $(cc);
        let maxsel = 1;

        if (mOptions.gameMode == 1) {
            maxsel = 2;
        } else if (mOptions.gameMode == 2) {
            maxsel = 3;
        }
        $exeDevices.iDevice.gamification.media.stopSound(mOptions);

        if (
            !mOptions.gameActived ||
            !mOptions.gameStarted ||
            mOptions.selecteds.length > maxsel
        )
            return;

        const state = parseInt($cc.data('state'));
        if (state != 0) return;
        const $card = $cc.find('.DescubreQP-Card1').eq(0);
        if (!$card.hasClass('flipped') && !mOptions.showCards) {
            $card.addClass('flipped');
        }
        mOptions.gameActived = false;
        $cc.data('state', '1');
        const num = parseInt($cc.data('number'));

        mOptions.selecteds.push(num);

        if (mOptions.selecteds.length <= maxsel) {
            const message = mOptions.msgs.msgSelectCard;
            $eXeDescubre.showMessage(3, message, instance, false);
        }
        const sound =
            $cc.find('.DescubreQP-LinkAudio').data('audio') ||
            $cc.find('.DescubreQP-LinkAudioBig').data('audio') ||
            '';

        if (sound.length > 3) {
            $exeDevices.iDevice.gamification.media.playSound(sound, mOptions);
        }

        $card.addClass('DescubreQP-CardActive');
        const $marcados = $('#descubreMultimedia-' + instance).find(
            '.DescubreQP-Card1'
        );

        mOptions.gameActived = true;
        if (mOptions.gameMode == 0) {
            if (mOptions.selecteds.length == 2) {
                if (mOptions.selecteds[0] == mOptions.selecteds[1]) {
                    $eXeDescubre.correctPair(mOptions.selecteds[0], instance);
                    $marcados.each(function () {
                        const valid = parseInt($(this).data('valid'));
                        if (valid == 1 && !mOptions.showCards) {
                            $(this)
                                .find('.DescubreQP-CardBack')
                                .css('opacity', 0.6);
                        }
                    });
                } else {
                    $eXeDescubre.uncorrectPair(instance);
                }
            }
        } else if (mOptions.gameMode == 1) {
            if (mOptions.selecteds.length == 3) {
                if (
                    mOptions.selecteds[0] == mOptions.selecteds[1] &&
                    mOptions.selecteds[0] == mOptions.selecteds[2]
                ) {
                    $eXeDescubre.correctPair(mOptions.selecteds[0], instance);
                    $marcados.each(function () {
                        const valid = parseInt($(this).data('valid'));
                        if (valid == 1 && !mOptions.showCards) {
                            $(this)
                                .find('.DescubreQP-CardBack')
                                .css('opacity', 0.6);
                        }
                    });
                } else {
                    $eXeDescubre.uncorrectPair(instance);
                }
            }
        } else if (mOptions.gameMode == 2) {
            if (mOptions.selecteds.length == 4) {
                if (
                    mOptions.selecteds[0] == mOptions.selecteds[1] &&
                    mOptions.selecteds[0] == mOptions.selecteds[2] &&
                    mOptions.selecteds[0] == mOptions.selecteds[3]
                ) {
                    $eXeDescubre.correctPair(mOptions.selecteds[0], instance);
                    $marcados.each(function () {
                        const valid = parseInt($(this).data('valid'));
                        if (valid == 1 && !mOptions.showCards) {
                            $(this)
                                .find('.DescubreQP-CardBack')
                                .css('opacity', 0.6);
                        }
                    });
                } else {
                    $eXeDescubre.uncorrectPair(instance);
                }
            }
        }
    },

    showSolutions: function (instance) {
        const mOptions = $eXeDescubre.options[instance],
            colors = $eXeDescubre.getColors(mOptions.wordsGame.length);
        mOptions.gameOver = true;
        $('#descubreGameOver-' + instance).hide();

        const $cards = $('#descubreMultimedia-' + instance).find(
            '.DescubreQP-CardContainer'
        );
        $cards.each(function () {
            const $card = $(this).find('.DescubreQP-Card1').eq(0),
                number = parseInt($(this).data('number'));
            $card.removeClass('DescubreQP-CardOK DescubreQP-CardKO');
            if (!$card.hasClass('flipped')) {
                if (!mOptions.showCard) {
                    $card.addClass('flipped');
                }
                $card.addClass('DescubreQP-CardKO');
            } else {
                $card.addClass('DescubreQP-CardOK');
            }
            if (!isNaN(number) && number < colors.length) {
                const color = colors[number];
                $card.css({
                    'border-color': color,
                });
                $('#descubreCubierta-' + instance).hide();
                $('#descubreStartGame-' + instance).show();
            }
        });

        $('#descubreStartLevels-' + instance).show();
    },

    getColors: function (number) {
        const colors = [];
        for (let i = 0; i < number; i++) {
            const color = $eXeDescubre.colorRGB();
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

    uncorrectPair: function (instance) {
        const mOptions = $eXeDescubre.options[instance];
        $eXeDescubre.updateScore(false, instance);

        const $marcados = $('#descubreMultimedia-' + instance).find(
            '.DescubreQP-CardActive'
        );

        $marcados.each(function () {
            $(this).data('valid', '1');
            var $el = $(this).css('position', 'relative');
            for (var i = 0; i < 2; i++) {
                $el.animate({ left: '-2px' }, 'fast').animate(
                    { left: '2px' },
                    'fast'
                );
            }
            $el.animate({ left: '0' }, 'fast');
        });

        setTimeout(function () {
            $eXeDescubre.updateCovers(instance, false);
            mOptions.selecteds = [];
            mOptions.gameActived = true;
            $eXeDescubre.showMessage(
                3,
                mOptions.msgs.msgSelectCardOne,
                instance
            );
        }, mOptions.timeShowSolution);
    },

    correctPair: function (number, instance) {
        const mOptions = $eXeDescubre.options[instance];
        mOptions.activeQuestion = mOptions.selecteds[0];
        mOptions.selecteds = [];
        $eXeDescubre.updateCovers(instance, true);
        $eXeDescubre.updateScore(true, instance);
        const percentageHits =
            (mOptions.hits / mOptions.wordsGame.length) * 100;
        if (
            mOptions.itinerary.showClue &&
            percentageHits >= mOptions.itinerary.percentageClue
        ) {
            if (!mOptions.obtainedClue) {
                mOptions.obtainedClue = true;
                $('#descubrePShowClue-' + instance).text(
                    mOptions.itinerary.clueGame
                );
                $('#descubreCubierta-' + instance).show();
                $('#descubreShowClue-' + instance).fadeIn();
            }
        }
        if (mOptions.isScorm == 1) {
            const score = (
                (mOptions.hits * 10) /
                mOptions.numberQuestions
            ).toFixed(2);
            $eXeDescubre.sendScore(true, instance);
            $eXeDescubre.initialScore = score;
        }

        $eXeDescubre.saveEvaluation(instance);

        const $marcados = $('#descubreMultimedia-' + instance)
            .find('.DescubreQP-CardContainer[data-number="' + number + '"]')
            .find('.DescubreQP-Card1');

        $marcados.each(function () {
            $(this).data('valid', '1');
            var $el = $(this).css('position', 'relative');
            for (var i = 0; i < 2; i++) {
                $el.animate({ top: '-2px' }, 'fast').animate(
                    { top: '2px' },
                    'fast'
                );
            }
            $el.animate({ top: '0' }, 'fast');
        });

        const opacity = mOptions.showCards ? 0.6 : 0.7;
        if (mOptions.showCards) {
            $marcados.find('.DescubreQP-CardBack').css('opacity', opacity);
        }

        if (mOptions.hits >= mOptions.wordsGame.length) {
            let message =
                mOptions.msgs.msgCool + ' ' + mOptions.msgs.mgsAllCards;
            if (mOptions.gameMode == 1) {
                message =
                    mOptions.msgs.msgCool + ' ' + mOptions.msgs.mgsAllTrios;
            } else if (mOptions.gameMode == 2) {
                message =
                    mOptions.msgs.msgCool + ' ' + mOptions.msgs.mgsAllQuartets;
            }
            $eXeDescubre.showMessage(3, message, instance);
            setTimeout(function () {
                $marcados.find('.DescubreQP-CardBack').css('opacity', opacity);
                $eXeDescubre.gameOver(0, instance);
                mOptions.gameActived = true;
            }, mOptions.timeShowSolution);
        } else {
            mOptions.gameActived = true;
        }
    },

    updateCovers: function (instance, answers) {
        const mOptions = $eXeDescubre.options[instance],
            $cardContainers = $('#descubreMultimedia-' + instance).find(
                '.DescubreQP-CardContainer'
            );

        $cardContainers.each(function () {
            let state = $(this).data('state');
            const $card = $(this).find('.DescubreQP-Card1').eq(0);
            $card.removeClass('DescubreQP-CardActive');
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

    showCard: function (card, instance) {
        const mOptions = $eXeDescubre.options[instance],
            $card = card,
            $noImage = $card.find('.DescubreQP-Cover').eq(0),
            $text = $card.find('.DescubreQP-EText').eq(0),
            $textdinamic = $card.find('.DescubreQP-ETextDinamyc').eq(0),
            $image = $card.find('.DescubreQP-Image').eq(0),
            $cursor = $card.find('.DescubreQP-Cursor').eq(0),
            $audio = $card.find('.DescubreQP-LinkAudio').eq(0),
            state = $noImage.data('state'),
            x = parseFloat($image.data('x')),
            y = parseFloat($image.data('y')),
            url = $image.data('url'),
            alt = $image.attr('alt') || 'No disponibLe',
            audio = $audio.data('audio') || '',
            stxt = $textdinamic.text() || '',
            color = $text.data('color'),
            backcolor = $text.data('backcolor');

        $text.hide();
        $image.hide();
        $cursor.hide();
        $audio.hide();
        $noImage.hide();

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
                        $noImage.show();
                    } else {
                        $image.show();
                        $cursor.hide();
                        $eXeDescubre.positionPointerCard($cursor, x, y);
                        return true;
                    }
                })
                .on('error', function () {
                    $cursor.hide();
                    $noImage.show();
                });
        }
        if (stxt.length > 0) {
            $text.show();
            const bk =
                url.length > 5 ? $eXeDescubre.hexToRgba(backcolor) : backcolor;
            $text.css({
                color: color,
                'background-color': bk,
            });
            $textdinamic.css({
                color: color,
            });
        }

        $audio.removeClass('DescubreQP-LinkAudioBig');
        $audio.removeClass('DescubreQP-LinkAudio');

        if (audio.length > 0) {
            if (url.length < 5 && stxt.length == 0) {
                $audio.addClass('DescubreQP-LinkAudioBig');
            } else {
                $audio.addClass('DescubreQP-LinkAudio');
            }
            $audio.show();
        }
        if (state > 0) {
            $noImage.hide();
        }
    },

    positionPointerCard: function ($cursor, x, y) {
        $cursor.hide();
        if (x > 0 || y > 0) {
            const parentClass = '.DescubreQP-ImageContain',
                siblingClass = '.DescubreQP-Image',
                containerElement = $cursor.parents(parentClass).eq(0),
                imgElement = $cursor.siblings(siblingClass).eq(0),
                containerPos = containerElement.offset(),
                imgPos = imgElement.offset(),
                marginTop = imgPos.top - containerPos.top,
                marginLeft = imgPos.left - containerPos.left,
                mx = marginLeft + x * imgElement.width(),
                my = marginTop + y * imgElement.height();
            $cursor.css({ left: mx, top: my, 'z-index': 14 });
            $cursor.show();
        }
    },

    refreshGame: function (instance) {
        const mOptions = $eXeDescubre.options[instance],
            $discovers = $('#descubreMultimedia-' + instance).find(
                '.DescubreQP-CardContainer'
            );

        if (!mOptions || mOptions.refreshCard) return;

        mOptions.refreshCard = true;

        mOptions.fullscreen = !(
            !document.fullscreenElement &&
            !document.mozFullScreenElement &&
            !document.webkitFullscreenElement &&
            !document.msFullscreenElement
        );
        $eXeDescubre.setSize(instance);

        $discovers.each(function () {
            const $card = $(this),
                $imageF = $card.find('.DescubreQP-Image').eq(0),
                $cursorF = $card.find('.DescubreQP-Cursor').eq(0),
                xF = parseFloat($imageF.data('x')) || 0,
                yF = parseFloat($imageF.data('y')) || 0;
            $eXeDescubre.positionPointerCard($cursorF, xF, yF);
        });
        $eXeDescubre.setFontSize(instance);

        mOptions.refreshCard = false;
    },

    setSize: function (instance) {
        const mOptions = $eXeDescubre.options[instance],
            numCards = mOptions.cardsGame.length,
            sizes = [],
            puntos = [],
            $scoreBoard = $(`#descubreGameScoreBoard-${instance}`),
            $startGame0 = $(`#descubreStartGame0-${instance}`),
            $cardContainers = $(`#descubreMultimedia-${instance}`).find(
                '.DescubreQP-CardContainer'
            ),
            h = screen.height - $scoreBoard.height() - 2 * $startGame0.height();
        let size = '12%',
            msize = '12%';

        for (let i = 2; i < 20; i++) {
            const w = Math.floor((screen.width - i * 24) / i),
                nf = Math.floor(h / w);
            puntos.push(i * nf);
            sizes.push(`${w}px`);
        }

        const index = puntos.findIndex((punto) => numCards < punto);
        if (index !== -1) {
            msize = sizes[index];
        }

        if (mOptions.fullscreen) {
            size = msize;
        } else {
            const sizeMap = [
                { max: 12, size: '18%' },
                { max: 18, size: '16%' },
                { max: 34, size: '14%' },
                { max: 48, size: '11%' },
                { max: 62, size: '10%' },
                { max: 69, size: '9%' },
                { max: 80, size: '8%' },
            ];

            for (const { max, size: mappedSize } of sizeMap) {
                if (numCards < max) {
                    size = mappedSize;
                    break;
                }
            }
        }

        $cardContainers.css('width', size);
    },

    enterCodeAccess: function (instance) {
        const mOptions = $eXeDescubre.options[instance];
        if (
            mOptions.itinerary.codeAccess.toLowerCase() ==
            $('#descubreCodeAccessE-' + instance)
                .val()
                .toLowerCase()
        ) {
            $('#descubreCodeAccessDiv-' + instance).hide();
            $('#descubreCubierta-' + instance).hide();
            $('#descubreStartLevels-' + instance).show();
            $('#descubreLinkMaximize-' + instance).trigger('click');
        } else {
            $('#descubreMesajeAccesCodeE-' + instance)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $('#descubreCodeAccessE-' + instance).val('');
        }
    },

    activeHover: function ($card, instance) {
        const mOptions = $eXeDescubre.options[instance];
        let state = $card.data('state');

        $card.off('mouseenter mouseleave');
        $card.removeClass('DescubreQP-Hover');
        if (state == 0) {
            $card.hover(
                function () {
                    state = $card.data('state');
                    $card.css('cursor', 'default');
                    if (mOptions.gameActived && state == 0) {
                        $card.addClass('DescubreQP-Hover');
                        $card.css('cursor', 'pointer');
                    }
                },
                function () {
                    $card.removeClass('DescubreQP-Hover');
                }
            );
        }
    },

    initCards: function (instance) {
        const $cards = $('#descubreMultimedia-' + instance).find(
            '.DescubreQP-CardContainer'
        );
        $cards.each(function () {
            $(this).data('state', '0');
            $eXeDescubre.activeHover($(this), instance);
            $eXeDescubre.showCard($(this), instance);
        });
        $exeDevices.iDevice.gamification.math.updateLatex(
            '#descubreMultimedia-' + instance
        );
    },

    getCardsLevels: function (nivel, instance) {
        const mOptions = $eXeDescubre.options[instance];
        let num = mOptions.wordsGameFix.length,
            snivel = mOptions.msgs.msgRookie;
        if (mOptions.gameLevels == 2) {
            if (nivel == 0) {
                num = Math.floor(mOptions.wordsGameFix.length / 2);
            }
        } else if (mOptions.gameLevels == 3) {
            if (nivel == 0) {
                num = Math.floor(mOptions.wordsGameFix.length / 3);
            } else if (nivel == 1) {
                num = Math.floor((mOptions.wordsGameFix.length * 2) / 3);
            }
        }
        num == num > 0 ? num : mOptions.wordsGameFix.length;

        mOptions.wordsGame = mOptions.wordsGameFix.slice(0, num);
        mOptions.numberQuestions = mOptions.wordsGame.length;

        if (nivel == 1) {
            snivel = mOptions.msgs.msgExpert;
        } else if (nivel == 2) {
            snivel = mOptions.msgs.msgMaster;
        }

        $('#descubreInfo-' + instance).text(
            mOptions.msgs.msgLevel + ': ' + snivel
        );
        const cardsGame = $eXeDescubre.createCardsData(
            mOptions.wordsGame,
            mOptions.gameMode
        );
        return cardsGame;
    },
    startGame: function (instance, nivel) {
        const mOptions = $eXeDescubre.options[instance];

        if (mOptions.gameStarted) return;

        mOptions.cardsGame = $eXeDescubre.getCardsLevels(nivel, instance);
        $eXeDescubre.addCards(instance, mOptions.cardsGame);
        mOptions.solveds = [];
        mOptions.selecteds = [];

        let msgstar = mOptions.msgs.mgsGameStart;
        if (mOptions.gameMode == 1) {
            msgstar = mOptions.msgs.mgsGameStart3;
        } else if (mOptions.gameMode == 2) {
            msgstar = mOptions.msgs.mgsGameStart4;
        }

        $eXeDescubre.showMessage(3, msgstar, instance, false);

        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.gameActived = true;
        mOptions.counter = mOptions.time * 60;
        mOptions.gameOver = false;
        mOptions.gameStarted = false;
        mOptions.obtainedClue = false;
        mOptions.nattempts = mOptions.attempts > 0 ? mOptions.attempts : 0;

        $('#descubrePShowClue-' + instance).text('');
        $('#descubreShowClue-' + instance).hide();
        $('#descubrePHits-' + instance).text(mOptions.hits);
        $('#descubrePErrors-' + instance).text(mOptions.nattempts);
        $('#descubreCubierta-' + instance).hide();
        $('#descubreGameOver-' + instance).hide();
        $('#descubreStartLevels-' + instance).hide();
        $('#descubreMessage-' + instance).show();
        $eXeDescubre.initCards(instance);

        if (mOptions.time == 0) {
            $('#descubrePTime-' + instance).hide();
            $('#descubreImgTime-' + instance).hide();
        }

        if (mOptions.time > 0) {
            mOptions.counterClock = setInterval(function () {
                let $node = $('#descubreMainContainer-' + instance);
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
                        $eXeDescubre.gameOver(2, instance);
                        return;
                    }
                }
                $eXeDescubre.uptateTime(mOptions.counter, instance);
            }, 1000);
            $eXeDescubre.uptateTime(mOptions.time * 60, instance);
        }
        if (mOptions.showCards) {
            $('#descubreMultimedia-' + instance)
                .find('.DescubreQP-Card1')
                .addClass('flipped');
        }
        mOptions.gameStarted = true;
    },

    uptateTime: function (tiempo, instance) {
        const mOptions = $eXeDescubre.options[instance];

        if (mOptions.time == 0) return;

        const mTime =
            $exeDevices.iDevice.gamification.helpers.getTimeToString(tiempo);
        $('#descubrePTime-' + instance).text(mTime);
    },

    gameOver: function (type, instance) {
        const mOptions = $eXeDescubre.options[instance];

        if (!mOptions.gameStarted) return;

        mOptions.gameStarted = false;
        mOptions.gameActived = false;
        mOptions.gameOver = true;
        $exeDevices.iDevice.gamification.media.stopSound(mOptions);
        $('#descubreCubierta-' + instance).show();
        $eXeDescubre.showScoreGame(type, instance);
        if (mOptions.isScorm == 1) {
            const score = (
                (mOptions.hits * 10) /
                mOptions.numberQuestions
            ).toFixed(2);
            $eXeDescubre.sendScore(true, instance);
            $eXeDescubre.initialScore = score;
        }
        $eXeDescubre.saveEvaluation(instance);
        $eXeDescubre.showFeedBack(instance);
    },

    rebootGame: function (instance) {
        const mOptions = $eXeDescubre.options[instance];

        if (!mOptions.gameStarted) return;

        mOptions.gameActived = mOptions.gameStarted = false;
        $('#descubreCubierta-' + instance).hide();
        $('#descubreStartLevels-' + instance).show();
        $('#descubreMultimedia-' + instance)
            .find('.DescubreQP-Card1')
            .removeClass('flipped DescubreQP-CardActive');
        mOptions.gameStarted = false;
        mOptions.solveds = [];
        mOptions.selecteds = [];
        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.counter = mOptions.time * 60;
        mOptions.obtainedClue = false;
        $eXeDescubre.uptateTime(mOptions.counter, instance);
        mOptions.nattempts = mOptions.attempts > 0 ? mOptions.attempts : 0;
        $('#descubrePShowClue-' + instance).text('');
        $('#descubreShowClue-' + instance).hide();
        $('#descubrePHits-' + instance).text(mOptions.hits);
        $('#descubrePErrors-' + instance).text(mOptions.nattempts);
        $('#descubreCubierta-' + instance).hide();
        $('#descubreGameOver-' + instance).hide();
        $('#descubreStartLevels-' + instance).hide();
        $('#descubreMessage-' + instance).hide();
        clearInterval(mOptions.counterClock);
        $exeDevices.iDevice.gamification.media.stopSound(mOptions);
        $('#descubreStartLevels-' + instance).show();
        $('#descubreCubierta-' + instance).hide();
        $('#descubreInfo-' + instance).text(mOptions.msgs.msgSelectLevel);
    },

    showFeedBack: function (instance) {
        const mOptions = $eXeDescubre.options[instance],
            puntos = (mOptions.hits * 100) / mOptions.wordsGame.length;
        if (mOptions.feedBack) {
            if (puntos >= mOptions.percentajeFB) {
                $('#descubreGameOver-' + instance).hide();
                $('#descubreDivFeedBack-' + instance)
                    .find('.descubre-feedback-game')
                    .show();
                $('#descubreDivFeedBack-' + instance).show();
            } else {
                $eXeDescubre.showMessage(
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

    showScoreGame: function (type, instance) {
        const mOptions = $eXeDescubre.options[instance],
            msgs = mOptions.msgs,
            $descubreHistGame = $('#descubreHistGame-' + instance),
            $descubreLostGame = $('#descubreLostGame-' + instance),
            $descubreOverNumCards = $('#descubreOverNumCards-' + instance),
            $descubreOverHits = $('#descubreOverHits-' + instance),
            $descubreOverAttemps = $('#descubreOverAttemps-' + instance),
            $descubreCubierta = $('#descubreCubierta-' + instance),
            $descubreGameOver = $('#descubreGameOver-' + instance);
        let message = '',
            messageColor = 1;

        $descubreHistGame.hide();
        $descubreLostGame.hide();
        $descubreOverNumCards.show();
        $descubreOverHits.show();
        $descubreOverAttemps.show();

        let mclue = '';
        switch (parseInt(type)) {
            case 0:
                message = msgs.msgCool + ' ' + msgs.mgsAllCards;
                if (mOptions.gameMode == 1) {
                    message =
                        mOptions.msgs.msgCool + ' ' + mOptions.msgs.mgsAllTrios;
                } else if (mOptions.gameMode == 2) {
                    message =
                        mOptions.msgs.msgCool +
                        ' ' +
                        mOptions.msgs.mgsAllQuartets;
                }
                messageColor = 2;
                $descubreHistGame.show();
                if (mOptions.itinerary.showClue) {
                    const text = $('#descubrePShowClue-' + instance).text();
                    if (mOptions.obtainedClue) {
                        mclue = text;
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
                $descubreLostGame.show();
                if (mOptions.itinerary.showClue) {
                    const text = $('#descubrePShowClue-' + instance).text();
                    if (mOptions.obtainedClue) {
                        mclue = text;
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
                $descubreLostGame.show();
                if (mOptions.itinerary.showClue) {
                    const text = $('#descubrePShowClue-' + instance).text();
                    if (mOptions.obtainedClue) {
                        mclue = text;
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
                $descubreLostGame.show();
                if (mOptions.itinerary.showClue) {
                    const text = $('#descubrePShowClue-' + instance).text();
                    if (mOptions.obtainedClue) {
                        mclue = text;
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

        $eXeDescubre.showMessage(messageColor, message, instance, true);

        let game = msgs.msgPairs;
        if (mOptions.gameMode == 1) {
            game = msgs.msgTrios;
        } else if (mOptions.gameMode == 2) {
            game = msgs.msgQuarts;
        }

        $descubreOverNumCards.html(game + ': ' + mOptions.wordsGame.length);
        $descubreOverHits.html(msgs.msgHits + ': ' + mOptions.hits);
        $descubreOverAttemps.html(msgs.msgAttempts + ': ' + attemps);
        $descubreGameOver.show();
        $descubreCubierta.show();
        $('#descubreShowClue-' + instance).hide();
        if (mOptions.itinerary.showClue) {
            $eXeDescubre.showMessage(3, mclue, instance, true);
        }
    },

    getRetroFeedMessages: function (iHit, instance) {
        const mOptions = $eXeDescubre.options[instance];
        let sMessages = iHit
            ? mOptions.msgs.msgSuccesses
            : mOptions.msgs.msgFailures;
        sMessages = sMessages.split('|');
        return sMessages[Math.floor(Math.random() * sMessages.length)];
    },

    updateScore: function (correctAnswer, instance) {
        const mOptions = $eXeDescubre.options[instance];
        let message = '',
            obtainedPoints = 0,
            type = 1,
            sscore = 0;

        if (correctAnswer) {
            mOptions.hits++;
            obtainedPoints = 10 / mOptions.wordsGame.length;
            type = 2;
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

        $('#descubrePErrors-' + instance).text(mOptions.nattempts);
        $('#descubrePScore-' + instance).text(sscore);
        $('#descubrePHits-' + instance).text(mOptions.hits);

        message = $eXeDescubre.getMessageAnswer(correctAnswer, instance);
        $eXeDescubre.showMessage(type, message, instance, false);
        if (
            mOptions.attempts > 0 &&
            mOptions.nattempts == 0 &&
            mOptions.hits < mOptions.wordsGame.length
        ) {
            mOptions.gameActived = false;
            setTimeout(function () {
                $eXeDescubre.gameOver(3, instance);
            }, mOptions.timeShowSolution);
        }
    },

    getMessageAnswer: function (correctAnswer, instance) {
        let message = '';
        if (correctAnswer) {
            message = $eXeDescubre.getMessageCorrectAnswer(instance);
        } else {
            message = $eXeDescubre.getMessageErrorAnswer(instance);
        }
        return message;
    },

    getMessageCorrectAnswer: function (instance) {
        const mOptions = $eXeDescubre.options[instance],
            messageCorrect = $eXeDescubre.getRetroFeedMessages(true, instance);
        let message = messageCorrect + ' ' + mOptions.msgs.msgCompletedPair;

        if (mOptions.gameMode == 1) {
            message = messageCorrect + ' ' + mOptions.msgs.msgCompletedTrio;
        } else if (mOptions.gameMode == 2) {
            message = messageCorrect + ' ' + mOptions.msgs.msgCompletedQuartet;
        }

        if (
            mOptions.customMessages &&
            mOptions.wordsGame[mOptions.activeQuestion].msgHit.length > 0
        ) {
            message = mOptions.wordsGame[mOptions.activeQuestion].msgHit;
        }

        return message;
    },

    getMessageErrorAnswer: function (instance) {
        return $eXeDescubre.getRetroFeedMessages(false, instance);
    },

    showMessage: function (type, message, instance, end) {
        const colors = [
                '#555555',
                $eXeDescubre.borderColors.red,
                $eXeDescubre.borderColors.green,
                $eXeDescubre.borderColors.blue,
                $eXeDescubre.borderColors.yellow,
            ],
            color = colors[type];
        $('#descubreMessage-' + instance).text(message);
        $('#descubreMessage-' + instance).css({
            color: color,
        });
        if (end) {
            $('#descubreMessage-' + instance).hide();
            $('#descubreMesasgeEnd-' + instance).text(message);
            $('#descubreMesasgeEnd-' + instance).css({
                color: color,
            });
        }
    },
    debounce: function (func, wait) {
        let timeout;
        return function (...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
};
$(function () {
    $eXeDescubre.init();
});
