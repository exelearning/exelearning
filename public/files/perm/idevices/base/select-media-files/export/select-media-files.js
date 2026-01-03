/* eslint-disable no-undef */
/**
 * Selecciona Medias activity (Export)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 *
 */
var $eXeSeleccionaMedias = {
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
    mScorm: null,
    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',

    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            'Select media files',
            'select-media-files',
            'seleccionamedias-IDevice'
        );
    },

    enable: function () {
        $eXeSeleccionaMedias.loadGame();
    },

    getFixedOrder: function (columns, cards) {
        if (cards > 0) {
            let rept = 0,
                end = 0,
                arraynum = [],
                max = cards - columns;
            while (rept != -1) {
                for (let i = 0; i <= max; i++) {
                    const numaleatorio = Math.floor(Math.random() * max);
                    if (arraynum.indexOf(numaleatorio) < 0) {
                        arraynum.push(numaleatorio);
                        end++;
                    }
                    end == max ? (rept = -1) : false;
                }
            }
        }
        let arraybas = [];
        for (let i = 0; i < columns; i++) {
            arraybas.push(i);
        }
        for (let j = 0; j < arraynum.length; j++) {
            arraynum[j] += columns;
        }
        let array = arraybas.concat(arraynum);
        return array;
    },

    loadGame: function () {
        $eXeSeleccionaMedias.options = [];

        $eXeSeleccionaMedias.activities.each(function (i) {
            const dl = $('.seleccionamedias-DataGame', this),
                mOption = $eXeSeleccionaMedias.loadDataGame(dl, this);

            mOption.scorerp = 0;
            mOption.idevicePath = $eXeSeleccionaMedias.idevicePath;
            mOption.main = 'slcmpMainContainer-' + i;
            mOption.idevice = 'seleccionamedias-IDevice';

            $eXeSeleccionaMedias.options.push(mOption);

            const slcmp = $eXeSeleccionaMedias.createInterfaceSelecciona(i);

            dl.before(slcmp).remove();

            $('#slcmpGameMinimize-' + i).show();
            $('#slcmpGameContainer-' + i).show();

            if (mOption.showMinimize) {
                $('#slcmpGameContainer-' + i).hide();
            } else {
                $('#slcmpGameMinimize-' + i).hide();
            }

            $('#slcmpDivFeedBack-' + i).prepend(
                $('.seleccionamedias-feedback-game', this)
            );

            $eXeSeleccionaMedias.showPhrase(0, i);
            $eXeSeleccionaMedias.addEvents(i);

            $('#slcmpDivFeedBack-' + i).hide();
        });

        const mediasHtml = $('.seleccionamedias-IDevice').html();
        if ($exeDevices.iDevice.gamification.math.hasLatex(mediasHtml)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '.seleccionamedias-IDevice'
            );
        }
    },

    getPhraseDefault: function () {
        return {
            cards: [],
            msgError: '',
            msgHit: '',
            definition: '',
            phrase: '',
        };
    },
    getCardDefault() {
        return {
            id: '',
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
        };
    },

    loadDataGame(data, sthis) {
        let json = data.text();
        json = $exeDevices.iDevice.gamification.helpers.decrypt(json);
        let mOptions =
            $exeDevices.iDevice.gamification.helpers.isJsonString(json);

        const $audiosDef = $('.seleccionamedias-LinkAudiosDef', sthis),
            $imagesDef = $('.seleccionamedias-LinkImagesDef', sthis),
            $audiosError = $('.seleccionamedias-LinkAudiosError', sthis),
            $audiosHit = $('.seleccionamedias-LinkAudiosHit', sthis);

        mOptions.playerAudio = '';

        mOptions.phrasesGame.forEach((phrase, i) => {
            phrase.url = phrase.url || '';
            phrase.alt = phrase.alt || '';
            phrase.author = phrase.author || '';

            const $imagesLink = $(`.seleccionamedias-LinkImages-${i}`, sthis),
                $audiosLink = $(`.seleccionamedias-LinkAudios-${i}`, sthis),
                { cards } = phrase;

            $imagesLink.each(function () {
                const iq = parseInt($(this).text(), 10);
                if (!isNaN(iq) && iq < cards.length) {
                    cards[iq].url = $(this).attr('href');
                    if (cards[iq].url.length < 4) {
                        cards[iq].url = '';
                    }
                }
            });

            $audiosLink.each(function () {
                const iqa = parseInt($(this).text(), 10);
                if (!isNaN(iqa) && iqa < cards.length) {
                    cards[iqa].audio = $(this).attr('href');
                    if (cards[iqa].audio.length < 4) {
                        cards[iqa].audio = '';
                    }
                }
            });

            phrase.phrase = phrase.phrase || '';

            cards.forEach((card, j) => {
                if (card.url.length > 4 && card.eText.trim().length > 0) {
                    card.type = 2;
                } else if (card.url.length > 4) {
                    card.type = 0;
                } else if (card.eText.trim().length > 0) {
                    card.type = 1;
                } else {
                    card.type = 0;
                }
                card.order = j;
            });
        });

        $imagesDef.each(function () {
            const iqb = parseInt($(this).text(), 10);
            if (!isNaN(iqb) && iqb < mOptions.phrasesGame.length) {
                mOptions.phrasesGame[iqb].url = $(this).attr('href');
                if (mOptions.phrasesGame[iqb].url.length < 4) {
                    mOptions.phrasesGame[iqb].url = '';
                }
            }
        });

        $audiosDef.each(function () {
            const iqa = parseInt($(this).text(), 10);
            if (!isNaN(iqa) && iqa < mOptions.phrasesGame.length) {
                mOptions.phrasesGame[iqa].audioDefinition =
                    $(this).attr('href');
                if (mOptions.phrasesGame[iqa].audioDefinition.length < 4) {
                    mOptions.phrasesGame[iqa].audioDefinition = '';
                }
            }
        });

        $audiosError.each(function () {
            const iqa = parseInt($(this).text(), 10);
            if (!isNaN(iqa) && iqa < mOptions.phrasesGame.length) {
                mOptions.phrasesGame[iqa].audioError = $(this).attr('href');
                if (mOptions.phrasesGame[iqa].audioError.length < 4) {
                    mOptions.phrasesGame[iqa].audioError = '';
                }
            }
        });

        $audiosHit.each(function () {
            const iqa = parseInt($(this).text(), 10);
            if (!isNaN(iqa) && iqa < mOptions.phrasesGame.length) {
                mOptions.phrasesGame[iqa].audioHit = $(this).attr('href');
                if (mOptions.phrasesGame[iqa].audioHit.length < 4) {
                    mOptions.phrasesGame[iqa].audioHit = '';
                }
            }
        });

        mOptions.modeTable =
            mOptions.numberMaxCards <= 4 ? 1 : mOptions.modeTable;
        mOptions.active = 0;
        mOptions.evaluation = mOptions.evaluation || false;
        mOptions.evaluationID = mOptions.evaluationID || '';
        mOptions.id = mOptions.id || false;
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
        mOptions.fullscreen = false;
        mOptions.hits = 0;

        mOptions.phrasesGame.forEach((phrase) => {
            phrase.cards = $eXeSeleccionaMedias.getCardsPart(
                phrase.cards,
                mOptions.numberMaxCards
            );
        });

        return mOptions;
    },

    showPhrase(num, instance) {
        const mOptions = $eXeSeleccionaMedias.options[instance];
        mOptions.active = num;
        mOptions.intentos = mOptions.attempsNumber;
        mOptions.phrase = mOptions.phrasesGame[num];

        $exeDevices.iDevice.gamification.media.stopSound(mOptions);
        $eXeSeleccionaMedias.addCards(mOptions.phrase.cards, instance);
        $eXeSeleccionaMedias.showMessage(1, '', instance);

        $(`#slcmpAudioDef-${instance}`).hide();
        $(`#slcmpQuestion-${instance}`).html(mOptions.phrase.definition).show();

        if (num > 0) {
            if (
                mOptions.phrase.audioDefinition &&
                mOptions.phrase.audioDefinition.length > 4
            ) {
                $exeDevices.iDevice.gamification.media.playSound(
                    mOptions.phrase.audioDefinition,
                    mOptions
                );
                $(`#slcmpAudioDef-${instance}`).css('display', 'block');
            }
        }
        $eXeSeleccionaMedias.showImage(num, instance);
    },

    getCardsPart(questions, number) {
        if (number > 30) return questions;

        let num = Math.max(number, 1);

        if (num >= questions.length) return questions;

        const indices = Array.from({ length: questions.length }, (_, i) => i),
            selectedIndices = $exeDevices.iDevice.gamification.helpers
                .shuffleAds(indices)
                .slice(0, num)
                .sort((a, b) => a - b);

        return selectedIndices.map((index) => questions[index]);
    },

    createInterfaceSelecciona: function (instance) {
        const path = $eXeSeleccionaMedias.idevicePath,
            mOptions = $eXeSeleccionaMedias.options[instance],
            msgs = $eXeSeleccionaMedias.options[instance].msgs,
            html = `<div class="SLCMP-MainContainer" id="slcmpMainContainer-${instance}">
            <div class="SLCMP-GameMinimize" id="slcmpGameMinimize-${instance}">
                <a href="#" class="SLCMP-LinkMaximize" id="slcmpLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                    <img src="${path}slcmpIcon.png"  class="SLCMP-IconMinimize SLCMP-Activo"  alt="">
                    <div class="SLCMP-MessageMaximize" id="slcmpMessageMaximize-${instance}">${msgs.msgPlayStart}</div>
                </a>
            </div>
            <div class="SLCMP-GameContainer" id="slcmpGameContainer-${instance}">
                <div class="SLCMP-GameScoreBoard" id="slcmpGameScoreBoard-${instance}">
                    <div class="SLCMP-GameScores">
                        <div class="exeQuextIcons  exeQuextIcons-Number"  id="slcmpPNumberIcon-${instance}" title="${msgs.msgNumQuestions}"></div>
                        <p><span class="sr-av">${msgs.msgNumQuestions}: </span><span id="slcmpPNumber-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                        <p><span class="sr-av">${msgs.msgHits}: </span><span id="slcmpPHits-${instance}">0</span></p>
                        <div class="exeQuextIcons  exeQuextIcons-Error" title="${msgs.msgNumbersAttemps}"></div>
                        <p><span class="sr-av">${msgs.msgErrors}: </span><span id="slcmpPErrors-${instance}">0</span></p>
                        <div class="exeQuextIcons  exeQuextIcons-Score" id="slcmpPScoreIcon-${instance}" title="${msgs.msgScore}"></div>
                        <p><span class="sr-av">${msgs.msgScore}: </span><span id="slcmpPScore-${instance}">0</span></p>
                    </div>
                    <div class="SLCMP-Info" id="slcmpInfo-${instance}"></div>
                    <div class="SLCMP-TimeNumber">
                        <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                        <div class="exeQuextIcons  exeQuextIcons-Time" id="slcmpImgTime-${instance}" title="${msgs.msgTime}"></div>
                        <p id="slcmpPTime-${instance}" class="SLCMP-PTime">00:00</p>
                        <a href="#" class="SLCMP-LinkMansory" id="slcViewMode-${instance}" title="${msgs.msgChangeMode}">
                            <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-ModeTable SLCMP-Activo"></div>
                        </a>
                        <a href="#" class="SLCMP-LinkMinimize" id="slcmpLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                            <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Minimize  SLCMP-Activo"></div>
                        </a>
                        <a href="#" class="SLCMP-LinkFullScreen" id="slcmpLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                            <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-FullScreen  SLCMP-Activo" id="slcmpFullScreen-${instance}"></div>
                        </a>
                    </div>
                </div>
                <div class="SLCMP-ImageDiv" id="slcmpImageDiv-${instance}">
                    <img class="SLCMP-ImageDef" id="slcmpImageDefinition-${instance}" src="${path}slcmImage.png" alt="${msgs.msgNoImage}" />
                </div>
                <div class="SLCMP-Author" id="slcmpAuthor-${instance}">Probando</div>
                <div class="SLCMP-Information">
                    <p class="SLCMP-Message" id="slcmpMessage-${instance}"></p>
                    <a href="#" id="slcmpStartGame-${instance}">${msgs.msgPlayStart}</a>
                </div>
                <div class="SLCMP-GameButton" id="slcmpGameButtons-${instance}">
                    <a href="#" id="slcmpCheck-${instance}" title="">${msgs.msgCheck}</a>
                    <a href="#" id="slcmpReboot-${instance}" title="" style="display:none">${msgs.msgAgain}</a>
                </div>
                <div class="SLCMP-QuestionDiv" id="slcmpQuestionDiv-${instance}">
                    <div class="SLCMP-Question" id="slcmpQuestion-${instance}"></div>
                    <a href="#" id="slcmpAudioDef-${instance}" class="SLCMP-LinkAudioDef">
                        <img src="${$eXeSeleccionaMedias.idevicePath}exequextplayaudio.svg">
                    </a>
                </div>
                <div class="SLCMP-Multimedia" id="slcmpMultimedia-${instance}"></div>               
                <div class="SLCMP-AuthorGame" id="slcmpAuthorGame-${instance}"></div>
            </div>
             <div class="SLCMP-Cubierta" id="slcmpCubierta-${instance}">
                <div class="SLCMP-GameOverExt" id="slcmpGameOver-${instance}">
                    <div class="SLCMP-StartGameEnd" id="slcmpMesasgeEnd-${instance}"></div>
                     <div class="SLCMP-GameOver">
                        <div class="SLCMP-DataImage">
                            <img src="${path}exequextwon.png" class="SLCMP-HistGGame" id="slcmpHistGame-${instance}" alt="${msgs.msgAllQuestions}" />
                            <img src="${path}exequextlost.png" class="SLCMP-LostGGame" id="slcmpLostGame-${instance}" alt="${msgs.msgTimeOver}" />
                        </div>
                        <div class="SLCMP-DataScore">
                            <p id="slcmpOverNumCards-${instance}"></p>
                            <p id="slcmpOverHits-${instance}"></p>
                            <p id="slcmpOverErrors-${instance}"></p>
                            <p id="slcmpOverScore-${instance}"></p>
                        </div>
                    </div>
                    <div class="SLCMP-StartGameEnd"><a href="#" id="slcmpStartGameEnd-${instance}">${msgs.msgPlayAgain}</a></div>
                </div>
                <div class="SLCMP-CodeAccessDiv" id="slcmpCodeAccessDiv-${instance}">
                    <div class="SLCMP-MessageCodeAccessE" id="slcmpMesajeAccesCodeE-${instance}"></div>
                    <div class="SLCMP-DataCodeAccessE">
                        <label class="sr-av">${msgs.msgCodeAccess}:</label><input type="text" class="SLCMP-CodeAccessE form-control" id="slcmpCodeAccessE-${instance}" placeholder="${msgs.msgCodeAccess}">
                        <a href="#" id="slcmpCodeAccessButton-${instance}" title="${msgs.msgSubmit}">
                            <strong><span class="sr-av">${msgs.msgSubmit}</span></strong>
                            <div class="exeQuextIcons-Submit SLCMP-Activo"></div>
                        </a>
                     </div>
                </div>
                <div class="SLCMP-ShowClue" id="slcmpShowClue-${instance}">
                    <p class="sr-av">${msgs.msgClue}</p>
                    <p class="SLCMP-PShowClue" id="slcmpPShowClue-${instance}"></p>
                    <a href="#" class="SLCMP-ClueBotton" id="slcmpClueButton-${instance}" title="${msgs.msgContinue}">${msgs.msgContinue}</a>
                </div>
            </div>
            <div class="SLCMP-DivFeedBack" id="slcmpDivFeedBack-${instance}">
                <input type="button" id="slcmpFeedBackClose-${instance}" value="${msgs.msgClose}" class="feedbackbutton" />
            </div>
        </div>
        ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}
        `;
        return html;
    },

    showImage: function (num, instance) {
        const mOptions = $eXeSeleccionaMedias.options[instance],
            q = mOptions.phrasesGame[num],
            $image = $('#slcmpImageDefinition-' + instance),
            $imageDiv = $('#slcmpImageDiv-' + instance),
            $author = $('#slcmpAuthor-' + instance);

        $imageDiv.hide();
        $author.hide();

        if (q.url.length < 4) return false;
        $imageDiv.show();
        $image.attr('alt', q.alt);
        $image
            .prop('src', q.url)
            .on('load', function () {
                if (
                    !this.complete ||
                    typeof this.naturalWidth == 'undefined' ||
                    this.naturalWidth == 0
                ) {
                    return false;
                } else {
                    const mData = $eXeSeleccionaMedias.placeImageWindows(
                        this,
                        this.naturalWidth,
                        this.naturalHeight
                    );
                    $eXeSeleccionaMedias.drawImage(this, mData);
                    $imageDiv.show();
                    if (q.author.length > 0) {
                        $author.show();
                    }
                    if (q.alt.length > 0) {
                        $image.prop('alt', q.alt);
                    }
                    return true;
                }
            })
            .on('error', function () {
                $imageDiv.hide();
                return false;
            });
    },

    drawImage: function (image, mData) {
        $(image).css({
            position: 'absolute',
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

    saveEvaluation: function (instance) {
        const mOptions = $eXeSeleccionaMedias.options[instance];
        mOptions.scorerp = (mOptions.hits * 10) / mOptions.numberQuestions;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $eXeSeleccionaMedias.isInExe
        );
    },

    sendScore: function (auto, instance) {
        const mOptions = $eXeSeleccionaMedias.options[instance];

        mOptions.scorerp = (mOptions.hits * 10) / mOptions.numberQuestions;
        mOptions.previousScore = $eXeSeleccionaMedias.previousScore;
        mOptions.userName = $eXeSeleccionaMedias.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $eXeSeleccionaMedias.previousScore = mOptions.previousScore;
    },

    addCards(cardsGame, instance) {
        const mOptions = $eXeSeleccionaMedias.options[instance];

        for (let i = cardsGame.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cardsGame[i], cardsGame[j]] = [cardsGame[j], cardsGame[i]];
        }

        $(`#slcmpCheck-${instance}`).show();
        $(`#slcmpReboot-${instance}`).hide();
        const $multimedia = $(`#slcmpMultimedia-${instance}`).empty();

        cardsGame.forEach((card) => {
            const $divImage = $('<div>', {
                class: 'SLCMP-Card SLCMP-GridItem SLCMP-NoHover',
            });

            if (card.url && card.url.trim() !== '') {
                const $img = $('<img>', {
                    class: 'SLCMP-Image',
                    src: card.url,
                    alt: card.alt,
                });
                $divImage.append($img);

                if (card.author && card.author.trim() !== '') {
                    const $authorImg = $('<img>', {
                        class: 'SLCMP-Author',
                        src: `${$eXeSeleccionaMedias.idevicePath}quextauthor.png`,
                        alt: `${mOptions.msgs.msgAuthor}: ${card.author}`,
                        title: `${mOptions.msgs.msgAuthor}: ${card.author}`,
                    });
                    $divImage.append($authorImg);
                }
            }

            if (card.eText && card.eText.trim() !== '') {
                const $divText = $('<div>', {
                    class: 'SLCMP-TextCard',
                    text: card.eText,
                });

                if (card.color && card.color.trim() !== '') {
                    $divText.css('color', card.color);
                }
                if (card.backcolor && card.backcolor.trim() !== '') {
                    $divText.css('background-color', card.backcolor);
                }
                if (!card.url || card.url.trim() === '') {
                    $divText.addClass('SLCMP-NoImage');
                }
                $divImage.append($divText);
            }

            let $sonidoEnlace;
            if (card.audio && card.audio.trim() !== '') {
                $sonidoEnlace = $('<a>', {
                    href: '#',
                    class: 'SLCMP-LinkAudio',
                }).append(
                    $('<img>', {
                        src: `${$eXeSeleccionaMedias.idevicePath}exequextplayaudio.svg`,
                    })
                );
                $sonidoEnlace.on('click', (e) => {
                    e.preventDefault();
                    $exeDevices.iDevice.gamification.media.playSound(
                        card.audio,
                        mOptions
                    );
                });
                $divImage.append($sonidoEnlace);
            }

            if (
                (!card.url || card.url.trim() === '') &&
                (!card.eText || card.eText.trim() === '') &&
                $sonidoEnlace
            ) {
                $divImage.addClass('SLCMP-OnlyAudio');
            }

            $divImage.data('state', card.state);
            $multimedia.append($divImage);
        });

        let imagesLoaded = 0;
        const totalImages = cardsGame.filter(
            (t) => t.url && t.url.trim() !== ''
        ).length;

        const $viewModeIcon = $(`#slcViewMode-${instance}`).find(
            'div.exeQuextIcons'
        );
        if (mOptions.modeTable) {
            $viewModeIcon
                .removeClass('exeQuextIcons-ModeTable')
                .addClass('exeQuextIcons-ModeMansory');
        }

        const $gameContainer = $(`#slcmpGameContainer-${instance}`).find(
            '.SLCMP-Multimedia'
        );
        if (totalImages === 0) {
            if (mOptions.modeTable) {
                $viewModeIcon
                    .removeClass('exeQuextIcons-ModeTable')
                    .addClass('exeQuextIcons-ModeMansory');
                $gameContainer.addClass('SLCMP-ModeTable');
            } else {
                $eXeSeleccionaMedias.initializeMasonry(instance);
            }
        } else {
            $multimedia.find('img.SLCMP-Image').on('load error', () => {
                imagesLoaded++;
                if (imagesLoaded === totalImages) {
                    if (mOptions.modeTable) {
                        $gameContainer.addClass('SLCMP-ModeTable');
                    } else {
                        $eXeSeleccionaMedias.initializeMasonry(instance);
                    }
                }
            });
        }
    },

    checkQuestion(instance) {
        const mOptions = $eXeSeleccionaMedias.options[instance];
        let todasCorrectas = true,
            seleccionadasCorrectamente = true;

        $(`#slcmpCheck-${instance}`).hide();
        $eXeSeleccionaMedias.desactivateHover(instance);
        mOptions.intentos--;

        $(`#slcmpMultimedia-${instance}`)
            .find('.SLCMP-GridItem')
            .each(function () {
                const $this = $(this);
                const esCorrecta = $this.data('state');
                const estaSeleccionada = $this.hasClass('SLCMP-Select');

                if (estaSeleccionada) {
                    $this.addClass(esCorrecta ? 'SLCMP-OK' : 'SLCMP-KO');
                    if (!esCorrecta) seleccionadasCorrectamente = false;
                } else {
                    if (esCorrecta) todasCorrectas = false;
                    $this.removeClass('SLCMP-OK SLCMP-KO SLCMP-Select');
                }
            });

        if (todasCorrectas && seleccionadasCorrectamente) {
            $eXeSeleccionaMedias.updateScore(true, instance);
            const phraseGame = mOptions.phrasesGame[mOptions.active];
            const msg =
                mOptions.customMessages &&
                phraseGame.msgHit &&
                phraseGame.msgHit.length > 0
                    ? phraseGame.msgHit
                    : mOptions.msgs.msgAllOK;
            $eXeSeleccionaMedias.showMessage(2, msg, instance);

            if (
                mOptions.isScorm === 1 &&
                (mOptions.repeatActivity ||
                    $eXeSeleccionaMedias.initialScore === '')
            ) {
                const score = (
                    (mOptions.hits * 10) /
                    mOptions.phrasesGame.length
                ).toFixed(2);
                $eXeSeleccionaMedias.sendScore(true, instance);
                $eXeSeleccionaMedias.initialScore = score;
            }
        } else {
            let msg = $eXeSeleccionaMedias.getMessageErrorAnswer(instance);
            const phraseGame = mOptions.phrasesGame[mOptions.active];
            msg =
                mOptions.customMessages &&
                phraseGame.msgError &&
                phraseGame.msgError.length > 0
                    ? phraseGame.msgError
                    : msg;
            $eXeSeleccionaMedias.showMessage(1, msg, instance);

            const mtxt =
                mOptions.intentos > 0
                    ? `${mOptions.msgs.msgAgain} (${mOptions.intentos})`
                    : mOptions.msgs.msgAgain;
            $(`#slcmpReboot-${instance}`).html(mtxt);

            if (mOptions.intentos > 0) {
                $(`#slcmpReboot-${instance}`).show();
            } else {
                $eXeSeleccionaMedias.updateScore(false, instance);
                if (
                    mOptions.isScorm === 1 &&
                    (mOptions.repeatActivity ||
                        $eXeSeleccionaMedias.initialScore === '')
                ) {
                    const score = (
                        (mOptions.hits * 10) /
                        mOptions.phrasesGame.length
                    ).toFixed(2);
                    $eXeSeleccionaMedias.sendScore(true, instance);
                    $eXeSeleccionaMedias.initialScore = score;
                }
            }
        }
    },

    desactivateHover: function (instance) {
        $('#slcmpMultimedia-' + instance)
            .find('.SLCMP-Card')
            .addClass('SLCMP-NoHover');
        $('#slcmpMultimedia-' + instance).off('click', '.SLCMP-Card');
    },

    activateHover: function (instance) {
        $('#slcmpMultimedia-' + instance)
            .find('.SLCMP-Card')
            .removeClass('SLCMP-NoHover');
        $('#slcmpMultimedia-' + instance).off('click', '.SLCMP-Card');
        $('#slcmpMultimedia-' + instance).on(
            'click',
            '.SLCMP-Card',
            function (e) {
                e.preventDefault();
                $(this).toggleClass('SLCMP-Select');
            }
        );
    },

    clear: function (phrase) {
        return phrase.replace(/[&\s\n\r]+/g, ' ').trim();
    },

    addEvents: function (instance) {
        const mOptions = $eXeSeleccionaMedias.options[instance];
        $eXeSeleccionaMedias.removeEvents(instance);
        $('#slcmpLinkMaximize-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $('#slcmpGameContainer-' + instance).show();
                $('#slcmpGameMinimize-' + instance).hide();
                if (!mOptions.gameStarted && !mOptions.gameOver) {
                    $eXeSeleccionaMedias.startGame(instance);
                    $('#slcmpStartGame-' + instance).hide();
                }
                if (mOptions.active >= 0) {
                    $eXeSeleccionaMedias.showImage(mOptions.active, instance);
                }
            }
        );

        $('#slcmpLinkMinimize-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $('#slcmpGameContainer-' + instance).hide();
                $('#slcmpGameMinimize-' + instance)
                    .css('visibility', 'visible')
                    .show();
            }
        );

        $('#slcmpCubierta-' + instance).hide();
        $('#slcmpGameOver-' + instance).hide();
        $('#slcmpCodeAccessDiv-' + instance).hide();

        $('#slcmpLinkFullScreen-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                const element = document.getElementById(
                    'slcmpGameContainer-' + instance
                );
                $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                    element,
                    instance
                );
            }
        );

        $('#slcmpFeedBackClose-' + instance).on('click', function () {
            $('#slcmpDivFeedBack-' + instance).hide();
            $('#slcmpGameOver-' + instance).show();
        });

        if (mOptions.itinerary.showCodeAccess) {
            $('#slcmpMesajeAccesCodeE-' + instance).text(
                mOptions.itinerary.messageCodeAccess
            );
            $('#slcmpCodeAccessDiv-' + instance).show();
            $('#slcmpCubierta-' + instance).show();
        }

        $('#slcmpCodeAccessButton-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $eXeSeleccionaMedias.enterCodeAccess(instance);
            }
        );

        $('#slcmpCodeAccessE-' + instance).on('keydown', function (event) {
            if (event.which == 13 || event.keyCode == 13) {
                $eXeSeleccionaMedias.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        $('#slcmpPNumber-' + instance).text(mOptions.numberQuestions);

        $(window).on(
            'unload.eXeSeleccionaMedias beforeunload.eXeSeleccionaMedias',
            function () {
                if (typeof $eXeSeleccionaMedias.mScorm != 'undefined') {
                    $exeDevices.iDevice.gamification.scorm.endScorm(
                        $eXeSeleccionaMedias.mScorm
                    );
                }
            }
        );

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        $('#slcmpMainContainer-' + instance)
            .closest('.seleccionamedias-IDevice')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $eXeSeleccionaMedias.sendScore(false, instance);
                $eXeSeleccionaMedias.saveEvaluation(instance);
            });

        $('#slcmpStartGame-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeSeleccionaMedias.startGame(instance);
            $(this).hide();
        });

        $('#slcmpStartGameEnd-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeSeleccionaMedias.showPhrase(0, instance);
            $eXeSeleccionaMedias.startGame(instance);
            $('#slcmpCubierta-' + instance).hide();
        });

        $('#slcmpClueButton-' + instance).on('click', function (e) {
            e.preventDefault();
            $('#slcmpShowClue-' + instance).hide();
            $('#slcmpCubierta-' + instance).fadeOut();
        });

        if (mOptions.time == 0) {
            $('#slcmpPTime-' + instance).hide();
            $('#slcmpImgTime-' + instance).hide();
            $eXeSeleccionaMedias.uptateTime(mOptions.time * 60, instance);
        } else {
            $eXeSeleccionaMedias.uptateTime(mOptions.time * 60, instance);
        }

        if (mOptions.author.trim().length > 0 && !mOptions.fullscreen) {
            $('#slcmpAuthorGame-' + instance).html(
                mOptions.msgs.msgAuthor + '; ' + mOptions.author
            );
            $('#slcmpAuthorGame-' + instance).show();
        }

        $('#slcmpNextPhrase-' + instance).hide();
        $('#slcmpGameButtons-' + instance).hide();

        if (mOptions.time == 0 && !mOptions.itinerary.showCodeAccess) {
            $eXeSeleccionaMedias.startGame(instance);
        }

        $('#slcmpCheck-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeSeleccionaMedias.checkQuestion(instance);
        });

        $('#slcmpReboot-' + instance).on('click', function (e) {
            e.preventDefault();
            $('#slcmpMultimedia-' + instance)
                .find('.SLCMP-Card ')
                .removeClass('SLCMP-OK SLCMP-KO SLCMP-Select');
            $('#slcmpCheck-' + instance).show();
            $(this).hide();
            $eXeSeleccionaMedias.showMessage(1, '', instance);
            $eXeSeleccionaMedias.activateHover(instance);
        });

        $('#slcViewMode-' + instance).click(function (e) {
            e.preventDefault();
            $('#slcViewMode-' + instance)
                .find('div.exeQuextIcons')
                .removeClass(
                    'exeQuextIcons-ModeMansory exeQuextIcons-ModeTable'
                );
            const $multimediaContainer = $('#slcmpMultimedia-' + instance);
            if ($multimediaContainer.hasClass('SLCMP-ModeTable')) {
                $multimediaContainer.removeClass('SLCMP-ModeTable');
                $eXeSeleccionaMedias.initializeMasonry(instance);
                $('#slcViewMode-' + instance)
                    .find('div.exeQuextIcons')
                    .addClass('exeQuextIcons-ModeTable');
                mOptions.modeTable = false;
            } else {
                $multimediaContainer.addClass('SLCMP-ModeTable');
                $eXeSeleccionaMedias.destroyMasonry(instance);
                $('#slcViewMode-' + instance)
                    .find('div.exeQuextIcons')
                    .addClass('exeQuextIcons-ModeMansory');
                mOptions.modeTable = true;
            }
        });

        $('#slcmpMainContainer-' + instance)
            .closest('article')
            .on('click', '.box-toggle-on', function (e) {
                if (
                    !$('#slcmpMultimedia-' + instance).hasClass(
                        'SLCMP-ModeTable'
                    )
                ) {
                    $eXeSeleccionaMedias.destroyMasonry(instance);
                    $eXeSeleccionaMedias.initializeMasonry(instance);
                }
            });

        setTimeout(() => {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                this.isInExe
            );
        }, 500);

        $('#slcmpAudioDef-' + instance).on('click', function (e) {
            e.preventDefault();
            const sound = mOptions.phrasesGame[mOptions.active].audioDefinition;
            $exeDevices.iDevice.gamification.media.playSound(sound, mOptions);
        });

        const config = {
            attributes: true,
            attributeFilter: ['style', 'class'],
            subtree: true,
        };
        const observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                if (mutation.target.classList.contains('iDevice_inner')) {
                    const $grid = $(mutation.target).find('.SLCMP-Multimedia');
                    if ($grid.is(':visible') && $grid.data('masonry')) {
                        $grid.masonry('layout');
                    }
                }
            });
        });

        $('#slcmpMainContainer-' + instance)
            .closest('.iDevice_inner')
            .each(function () {
                observer.observe(this, config);
            });
    },

    removeEvents: function (instance) {
        $('#slcmpLinkMaximize-' + instance).off('click touchstart');
        $('#slcmpLinkMinimize-' + instance).off('click touchstart');
        $('#slcmpLinkFullScreen-' + instance).off('click touchstart');
        $('#slcmpFeedBackClose-' + instance).off('click');
        $('#slcmpCodeAccessButton-' + instance).off('click touchstart');
        $('#slcmpCodeAccessE-' + instance).off('keydown');
        $(window).off(
            'unload.eXeSeleccionaMedias beforeunload.eXeSeleccionaMedias'
        );
        $('#slcmpMainContainer-' + instance)
            .closest('.seleccionamedias-IDevice')
            .off('click', '.Games-SendScore');
        $('#slcmpStartGame-' + instance).off('click');
        $('#slcmpStartGameEnd-' + instance).off('click');
        $('#slcmpClueButton-' + instance).off('click');
        $('#slcmpCheck-' + instance).off('click');
        $('#slcmpReboot-' + instance).off('click');
        $('#slcViewMode-' + instance).off('click');
        $('#slcmpAudioDef-' + instance).off('click');
    },

    refreshGames: function (instance) {
        const mOptions = $eXeSeleccionaMedias.options[instance];
        if (!mOptions) return;

        mOptions.fullscreen = !(
            !document.fullscreenElement &&
            !document.mozFullScreenElement &&
            !document.webkitFullscreenElement &&
            !document.msFullscreenElement
        );
    },

    initializeMasonry: function (instance) {
        const $grid = $('#slcmpMainContainer-' + instance).find(
            '.SLCMP-Multimedia'
        );
        $grid.masonry({
            itemSelector: '.SLCMP-GridItem',
            columnWidth: '.SLCMP-GridItem',
            gutter: 10,
        });
        $grid.masonry('reloadItems');
        $grid.masonry('layout');
    },

    destroyMasonry: function () {
        const $grid = $('.SLCMP-Multimedia');
        $grid.masonry('destroy');
    },

    checkAudio: function (card) {
        const audio = $(card).find('.SLCMP-LinkAudio').data('audio');
        if (typeof audio != 'undefined' && audio.length > 3) {
            $exeDevices.iDevice.gamification.media.playSound(audio, mOptions);
        }
    },

    nextPhrase: function (instance) {
        const mOptions = $eXeSeleccionaMedias.options[instance];
        $exeDevices.iDevice.gamification.media.stopSound(mOptions);
        setTimeout(function () {
            mOptions.active++;
            if (mOptions.active < mOptions.phrasesGame.length) {
                $eXeSeleccionaMedias.showPhrase(mOptions.active, instance);
                $eXeSeleccionaMedias.activateHover(instance);
                const mediasHtml = $('.seleccionamedias-IDevice').html();
                if (
                    $exeDevices.iDevice.gamification.math.hasLatex(mediasHtml)
                ) {
                    $exeDevices.iDevice.gamification.math.updateLatex(
                        '.seleccionamedias-IDevice'
                    );
                }
            } else {
                $eXeSeleccionaMedias.gameOver(0, instance);
            }
        }, mOptions.timeShowSolution * 1000);
    },

    enterCodeAccess: function (instance) {
        const mOptions = $eXeSeleccionaMedias.options[instance];
        if (
            mOptions.itinerary.codeAccess ==
            $('#slcmpCodeAccessE-' + instance).val()
        ) {
            $('#slcmpCodeAccessDiv-' + instance).hide();
            $('#slcmpCubierta-' + instance).hide();
            $('#slcmpLinkMaximize-' + instance).trigger('click');
            if (mOptions.time > 0) {
                $eXeSeleccionaMedias.startGame(instance);
            }
        } else {
            $('#slcmpMesajeAccesCodeE-' + instance)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $('#slcmpCodeAccessE-' + instance).val('');
        }
    },

    startGame: function (instance) {
        const mOptions = $eXeSeleccionaMedias.options[instance];

        if (mOptions.gameStarted) return;

        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.gameActived = true;
        mOptions.counter = mOptions.time * 60;
        mOptions.gameOver = false;
        mOptions.gameStarted = false;
        mOptions.obtainedClue = false;
        mOptions.nattempts = mOptions.attempts > 0 ? mOptions.attempts : 0;

        $('#slcmpQuestion-' + instance).html(
            mOptions.phrasesGame[0].definition
        );
        $('#slcmpQuestion-' + instance).show();
        $('#slcmpGameButtons-' + instance).css('display', 'flex');
        $('#slcmpGameButtons-' + instance).show();
        $('#slcmpShowClue-' + instance).hide();
        $('#slcmpPHits-' + instance).text(mOptions.hits);
        $('#slcmpPNumber-' + instance).text(mOptions.numberQuestions);
        $('#slcmpPScore-' + instance).text(mOptions.score);
        $('#slcmpPErrors-' + instance).text(mOptions.errors);
        $('#slcmpCubierta-' + instance).hide();
        $('#slcmpGameOver-' + instance).hide();
        $('#slcmpStartGame-' + instance).hide();
        $('#slcmpCheck-' + instance).show();

        if (mOptions.time == 0) {
            $('#slcmpPTime-' + instance).hide();
            $('#slcmpImgTime-' + instance).hide();
        }
        clearInterval(mOptions.counterClock);
        if (mOptions.time > 0) {
            mOptions.counterClock = setInterval(function () {
                let $node = $('#slcmpMainContainer-' + instance);
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
                        $eXeSeleccionaMedias.gameOver(2, instance);
                        return;
                    }
                }
                $eXeSeleccionaMedias.uptateTime(mOptions.counter, instance);
            }, 1000);
            $eXeSeleccionaMedias.uptateTime(mOptions.time * 60, instance);
        }

        if (
            typeof mOptions.phrase.audioDefinition != 'undefined' &&
            mOptions.phrase.audioDefinition.length > 4
        ) {
            $exeDevices.iDevice.gamification.media.playSound(
                mOptions.phrase.audioDefinition,
                mOptions
            );
        }

        mOptions.gameStarted = true;
        $eXeSeleccionaMedias.activateHover(instance);
    },

    uptateTime: function (tiempo, instance) {
        const mOptions = $eXeSeleccionaMedias.options[instance];
        if (mOptions.time == 0) return;
        const mTime =
            $exeDevices.iDevice.gamification.helpers.getTimeToString(tiempo);
        $('#slcmpPTime-' + instance).text(mTime);
    },

    gameOver: function (type, instance) {
        const mOptions = $eXeSeleccionaMedias.options[instance];

        if (!mOptions.gameStarted) return;

        $eXeSeleccionaMedias.desactivateHover(instance);

        mOptions.gameStarted = false;
        mOptions.gameActived = false;
        mOptions.gameOver = true;
        clearInterval(mOptions.counterClock);

        $exeDevices.iDevice.gamification.media.stopSound(mOptions);

        $('#slcmpCubierta-' + instance).show();
        $eXeSeleccionaMedias.showScoreGame(type, instance);
        $eXeSeleccionaMedias.saveEvaluation(instance);
        if (mOptions.isScorm == 1) {
            const score = (
                (mOptions.hits * 10) /
                mOptions.phrasesGame.length
            ).toFixed(2);
            $eXeSeleccionaMedias.sendScore(true, instance);
            $eXeSeleccionaMedias.initialScore = score;
        }
        $eXeSeleccionaMedias.showFeedBack(instance);
        $('#slcmpCodeAccessDiv-' + instance).hide();
    },

    showFeedBack: function (instance) {
        const mOptions = $eXeSeleccionaMedias.options[instance],
            puntos = (mOptions.hits * 100) / mOptions.phrasesGame.length;
        if (mOptions.feedBack) {
            if (puntos >= mOptions.percentajeFB) {
                $('#slcmpGameOver-' + instance).hide();
                $('#slcmpDivFeedBack-' + instance)
                    .find('.seleccionamedias-feedback-game')
                    .show();
                $('#slcmpDivFeedBack-' + instance).show();
            } else {
                $eXeSeleccionaMedias.showMessage(
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
        const mOptions = $eXeSeleccionaMedias.options[instance],
            msgs = mOptions.msgs,
            $slcmpHistGame = $('#slcmpHistGame-' + instance),
            $slcmpLostGame = $('#slcmpLostGame-' + instance),
            $slcmpOverNumCards = $('#slcmpOverNumCards-' + instance),
            $slcmpOverHits = $('#slcmpOverHits-' + instance),
            $slcmpOverErrors = $('#slcmpOverErrors-' + instance),
            $slcmpOverScore = $('#slcmpOverScore-' + instance),
            $slcmpCubierta = $('#slcmpCubierta-' + instance),
            $slcmpGameOver = $('#slcmpGameOver-' + instance);
        let message = '',
            messageColor = 1;

        $slcmpHistGame.hide();
        $slcmpLostGame.hide();
        $slcmpOverNumCards.show();
        $slcmpOverHits.show();
        $slcmpOverErrors.show();
        let mclue = '';
        switch (type) {
            case 0:
                message = msgs.mgsAllPhrases;
                messageColor = 2;
                $slcmpHistGame.show();
                if (mOptions.itinerary.showClue) {
                    const text =
                        mOptions.msgs.msgClue +
                        ' ' +
                        mOptions.itinerary.clueGame;
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
                message = msgs.mgsAllPhrases;
                $slcmpLostGame.show();
                if (mOptions.itinerary.showClue) {
                    const text =
                        mOptions.msgs.msgClue +
                        ' ' +
                        mOptions.itinerary.clueGame;
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
                $slcmpLostGame.show();
                if (mOptions.itinerary.showClue) {
                    const text =
                        mOptions.msgs.msgClue +
                        ' ' +
                        mOptions.itinerary.clueGame;
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
                message = msgs.mgsAllPhrases;
                $slcmpLostGame.show();
                if (mOptions.itinerary.showClue) {
                    const text =
                        mOptions.msgs.msgClue +
                        ' ' +
                        mOptions.itinerary.clueGame;
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

        $eXeSeleccionaMedias.showMessage(messageColor, message, instance, true);
        $slcmpOverNumCards.html(
            msgs.msgActivities + ': ' + mOptions.phrasesGame.length
        );
        $slcmpOverHits.html(msgs.msgHits + ': ' + mOptions.hits);
        $slcmpOverErrors.html(msgs.msgErrors + ': ' + mOptions.errors);
        $slcmpOverScore.html(
            msgs.msgScore +
                ': ' +
                ((mOptions.hits / mOptions.numberQuestions) * 10).toFixed(2)
        );
        $slcmpGameOver.show();
        $slcmpCubierta.show();

        $('#slcmpShowClue-' + instance).hide();

        if (mOptions.itinerary.showClue) {
            $eXeSeleccionaMedias.showMessage(3, mclue, instance, true);
        }
    },

    getRetroFeedMessages: function (iHit, instance) {
        const mOptions = $eXeSeleccionaMedias.options[instance];
        let sMessages = iHit
            ? mOptions.msgs.msgSuccesses
            : mOptions.msgs.msgFailures;
        sMessages = sMessages.split('|');
        return sMessages[Math.floor(Math.random() * sMessages.length)];
    },

    updateScore: function (correctAnswer, instance) {
        const mOptions = $eXeSeleccionaMedias.options[instance];
        let obtainedPoints = 0,
            sscore = 0;
        if (correctAnswer) {
            mOptions.hits++;
            obtainedPoints = 10 / mOptions.phrasesGame.length;
        } else {
            mOptions.errors++;
        }

        mOptions.score = mOptions.score + obtainedPoints;
        sscore =
            mOptions.score % 1 == 0
                ? mOptions.score
                : mOptions.score.toFixed(2);

        $('#slcmpPNumber-' + instance).text(
            mOptions.phrasesGame.length - mOptions.hits - mOptions.errors
        );
        $('#slcmpPErrors-' + instance).text(mOptions.errors);
        $('#slcmpPScore-' + instance).text(sscore);
        $('#slcmpPHits-' + instance).text(mOptions.hits);

        if (
            (mOptions.score / mOptions.phrasesGame.length) * 100 >
            mOptions.itinerary.percentageClue
        ) {
            mOptions.obtainedClue = true;
        }

        if (mOptions.showSolution) {
            $('#slcmpMultimedia-' + instance)
                .find('.SLCMP-GridItem')
                .each(function () {
                    const $this = $(this);
                    if ($this.data('state')) {
                        $this.addClass('SLCMP-Solutions');
                    }
                });
        }

        $eXeSeleccionaMedias.saveEvaluation(instance);

        if (mOptions.numberQuestions - mOptions.hits - mOptions.errors <= 0) {
            mOptions.gameActived = false;
            setTimeout(function () {
                $eXeSeleccionaMedias.gameOver(1, instance);
            }, mOptions.timeShowSolution * 1000);
        } else {
            $eXeSeleccionaMedias.nextPhrase(instance);
        }
    },

    getMessageErrorAnswer: function (instance) {
        return $eXeSeleccionaMedias.getRetroFeedMessages(false, instance);
    },

    showMessage: function (type, message, instance, end) {
        const mOptions = $eXeSeleccionaMedias.options[instance],
            colors = [
                '#555555',
                $eXeSeleccionaMedias.borderColors.red,
                $eXeSeleccionaMedias.borderColors.green,
                $eXeSeleccionaMedias.borderColors.blue,
                $eXeSeleccionaMedias.borderColors.yellow,
            ];
        let color = colors[type],
            $slcmpMessage = $('#slcmpMessage-' + instance);
        $slcmpMessage.html(message);
        $slcmpMessage.css({
            color: color,
            'font-style': 'bold',
        });
        $slcmpMessage.show();
        if (end) {
            $slcmpMessage.hide();
            color = 1;
            if (mOptions.score >= 6) {
                color = 2;
            }
            $('#slcmpMesasgeEnd-' + instance).html(message);
            $('#slcmpMesasgeEnd-' + instance).css({
                color: color,
            });
            $eXeSeleccionaMedias.showMessage(message);
        }
    },
};
$(function () {
    $eXeSeleccionaMedias.init();
});
