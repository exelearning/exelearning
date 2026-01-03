/**
 * Relaciona activity (Export)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 *
 */
var $eXeRelaciona = {
    idevicePath: '',
    borderColors: $exeDevices.iDevice.gamification.colors.borderColors,
    colors: $exeDevices.iDevice.gamification.colors.backColor,
    options: [],
    hasSCORMbutton: false,
    isInExe: false,
    userName: '',
    previousScore: '',
    initialScore: '',
    version: 3,
    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',
    mScorm: null,
    jqueryui: 1,

    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            'Relate',
            'relate',
            'relaciona-IDevice'
        );
    },

    enable: function () {
        $eXeRelaciona.loadGame();
    },

    loadGame: function () {
        $eXeRelaciona.options = [];

        $eXeRelaciona.activities.each(function (i) {
            const dl = $('.relaciona-DataGame', this);
            const mOption = $eXeRelaciona.loadDataGame(dl, this);

            mOption.scorerp = 0;
            mOption.idevicePath = $eXeRelaciona.idevicePath;
            mOption.main = 'rlcMainContainer-' + i;
            mOption.idevice = 'relaciona-IDevice';

            $eXeRelaciona.options.push(mOption);

            const rlc = $eXeRelaciona.createInterfaceCards(i);

            dl.before(rlc).remove();
            $('#rlcGameMinimize-' + i).hide();
            $('#rlcGameContainer-' + i).hide();
            $('#rlcCubierta-' + i).hide();
            if (mOption.showMinimize) {
                $('#rlcGameMinimize-' + i)
                    .css({ cursor: 'pointer' })
                    .show();
            } else {
                $('#rlcGameContainer-' + i).show();
            }

            $eXeRelaciona.createCards(i);

            $eXeRelaciona.addEvents(i);
            if (mOption.type == 2 && mOption.time > 0) {
                $('#rlcImgTime-' + i).show();
                $('#rlcPTime-' + i).show();
                $('#rlcStartGame-' + i).show();
                $('#rlcMessage-' + i).hide();
                $eXeRelaciona.updateTime(mOption.time * 60, i);
            }
        });

        let node = document.querySelector('.page-content');
        if (this.isInExe) {
            node = document.getElementById('node-content');
        }
        if (node)
            $exeDevices.iDevice.gamification.observers.observeResize(
                $eXeRelaciona,
                node
            );

        const relateHtml = $('.relaciona-IDevice').html();
        if ($exeDevices.iDevice.gamification.math.hasLatex(relateHtml)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '.relaciona-IDevice'
            );
        }
    },

    loadDataGame: function (data, sthis) {
        const json = data.text(),
            mOptions =
                $exeDevices.iDevice.gamification.helpers.isJsonString(json),
            $imagesLink = $('.relaciona-LinkImages', sthis),
            $audiosLink = $('.relaciona-LinkAudios', sthis),
            $imagesLinkBack = $('.relaciona-LinkImagesBack', sthis),
            $audiosLinkBack = $('.relaciona-LinkAudiosBack', sthis);

        mOptions.playerAudio = '';
        mOptions.gameStarted = false;
        mOptions.typeDrag = 0;

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
        mOptions.currentWordDiv = null;
        mOptions.linesMap = new Map();
        mOptions.lines = [];
        mOptions.permitirErrores = mOptions.type > 0;
        mOptions.time =
            typeof mOptions.time === 'undefined' ? 0 : mOptions.time;
        mOptions.evaluation =
            typeof mOptions.evaluation === 'undefined'
                ? false
                : mOptions.evaluation;
        mOptions.evaluationID =
            typeof mOptions.evaluationID === 'undefined'
                ? ''
                : mOptions.evaluationID;
        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.active = 0;
        mOptions.obtainedClue = false;

        mOptions.cardsGame =
            $exeDevices.iDevice.gamification.helpers.getQuestions(
                mOptions.cardsGame,
                mOptions.percentajeCards
            );
        for (let i = 0; i < mOptions.cardsGame.length; i++) {
            mOptions.cardsGame[i].id = i;
            mOptions.cardsGame[i].eText = $eXeRelaciona.decodeURIComponentSafe(
                mOptions.cardsGame[i].eText
            );
            mOptions.cardsGame[i].eTextBk =
                $eXeRelaciona.decodeURIComponentSafe(
                    mOptions.cardsGame[i].eTextBk
                );
            const id = $eXeRelaciona.getID();
            mOptions.cardsGame[i].lineindex = id;
        }

        mOptions.numberCards = mOptions.cardsGame.length;
        mOptions.realNumberCards = mOptions.numberCards;
        mOptions.fullscreen = false;
        return mOptions;
    },

    decodeURIComponentSafe: function (s) {
        if (!s) return s;
        return decodeURIComponent(s).replace('&percnt;', '%');
    },

    updateTime: function (tiempo, instance) {
        const mOptions = $eXeRelaciona.options[instance],
            mTime =
                $exeDevices.iDevice.gamification.helpers.getTimeToString(
                    tiempo
                );
        if (mOptions.time < 0) return;
        $(`#rlcPTime-${instance}`).text(mTime);
    },

    clearHtml: function (htmlString) {
        const tempDiv = $('<div>').html(htmlString);
        return tempDiv.text();
    },

    createCards: function (instance) {
        const mOptions = $eXeRelaciona.options[instance],
            shuffledWords = $exeDevices.iDevice.gamification.helpers.shuffleAds(
                [...mOptions.cardsGame]
            ),
            shuffledDefinitions =
                $exeDevices.iDevice.gamification.helpers.shuffleAds([
                    ...mOptions.cardsGame,
                ]);

        $('#rlcContainerWords-' + instance).empty();
        $('#rlcContainerDefinitions-' + instance).empty();

        shuffledWords.forEach((card, index) => {
            let imgV = card.url.length > 3 ? 'block' : 'none';
            let txtV = card.eText.length > 0 ? 'flex' : 'none';
            let imgW = card.eText.length == 0 ? '100%' : '30%';

            imgW = card.url.length < 3 ? '0%' : imgW;

            let txtW = card.url.length < 3 ? '100%' : '70%';
            txtW = card.eText.length == 0 ? '0%' : txtW;
            let color = card.color.length > 2 ? card.color : 'inherit';
            let bkcolor =
                card.backcolor.length > 2 ? card.backcolor : 'trasparent';
            let audio = card.audio.length > 3 ? 'block' : 'none';
            let author = card.author.length > 3 ? 'block' : 'none';
            let audioCls =
                card.url.length < 3 && card.eText.length == 0
                    ? 'RLCP-LinkAudioBig'
                    : 'RLCP-LinkAudio';

            const fullimage =
                card.url.length > 3
                    ? `<a href="#" class="RLCP-FullLinkImage" data-url="${card.url}"" title="${mOptions.msgs.msgFullScreen}">
                    <strong><span class="sr-av">${mOptions.msgs.msgFullScreen}:</span></strong>
                    <div  class="exeQuextIcons exeQuextIcons-FullImage RLCP-Activo"></div>
                </a>`
                    : '';

            const wordDiv =
                $(`<div class="RLCP-Word RLCP-NoSelect" data-id="${card.id}" data-lineindex="${card.lineindex}">
                            <div class="RLCP-ContainerData">
                              <div class="RLCP-EText" style="display:${txtV}; width:${txtW}; color:${color}; background-color:${bkcolor};"><div class="RLCP-ETextDinamyc">${card.eText}</div></div>    
                              <div class="RLCP-ImageContain" style="display:${imgV}; width:${imgW};">
                                  <img src="${card.url}" class="RLCP-Image" data-url="${card.url}" data-x="${card.x}" data-y="${card.y}" alt="${card.alt}" />
                                  <div class="RLCP-Author RLCP-AuthorWord" data-author="${card.author}"  style="display: ${author};" alt="${card.author}" title="${mOptions.msgs.msgAuthor + ': ' + $eXeRelaciona.clearHtml(card.author)}"><img src="${$eXeRelaciona.idevicePath}exequextcopyright.png"  /></div>
                                  ${fullimage}
                                </div>
                            </div>
                            <div style="display:${audio}" data-audio="${card.audio}" class="RLCP-TAudio ${audioCls}"  title="Audio"><img src="${$eXeRelaciona.idevicePath}exequextplayaudio.svg" class="RLCP-Audio"  alt="Audio"></div>
                        </div>`);
            $('#rlcContainerWords-' + instance).append(wordDiv);
        });

        shuffledDefinitions.forEach((card, index) => {
            let imgV = card.urlBk.length > 3 ? 'block' : 'none';
            let txtV = card.eTextBk.length > 0 ? 'flex' : 'none';
            let imgW = card.eTextBk.length == 0 ? '100%' : '30%';
            imgW = card.urlBk.length < 3 ? '0%' : imgW;
            let txtW = card.urlBk.length < 3 ? '100%' : '70%';
            txtW = card.eTextBk.length == 0 ? '0%' : txtW;
            let color = card.colorBk.length > 2 ? card.colorBk : 'inherit';
            let bkcolor =
                card.backcolorBk.length > 2 ? card.backcolorBk : 'trasparent';
            let audio = card.audioBk.length > 3 ? 'block' : 'none';
            let author = card.authorBk.length > 0 ? 'block' : 'none';
            let audioCls =
                card.urlBk.length < 3 && card.eTextBk.length == 0
                    ? 'RLCP-LinkAudioBig'
                    : 'RLCP-LinkAudio';
            const fullimage =
                card.urlBk.length > 3
                    ? `<a href="#" class="RLCP-FullLinkImage" data-url="${card.urlBk}"" title="${mOptions.msgs.msgFullScreen}">
                <strong><span class="sr-av">${mOptions.msgs.msgFullScreen}:</span></strong>
                <div  class="exeQuextIcons exeQuextIcons-FullImage RLCP-Activo"></div>
            </a>`
                    : '';
            const definitionDiv =
                $(`<div class="RLCP-Definition RLCP-NoSelect" data-id="${card.id}"  data-lineindex="0" >
                                <div class="RLCP-ContainerData">
                                  <div class="RLCP-ImageContain" style="display:${imgV}; width:${imgW};">
                                    <img src="${card.urlBk}" class="RLCP-Image" data-url="${card.urlBk}" data-x="${card.x}" data-y="${card.y}" alt="${card.altBk}" />
                                    <div class="RLCP-Author RLCP-AuthorDef" style="display: ${author};" data-author="${card.authorBk}" alt="${card.authorBk}" title="${mOptions.msgs.msgAuthor + ': ' + $eXeRelaciona.clearHtml(card.authorBk)}"><img src="${$eXeRelaciona.idevicePath}exequextcopyright.png"  /></div>
                                    ${fullimage}
                                    </div>
                                  <div class="RLCP-EText" style="display:${txtV}; width:${txtW}; color:${color}; background-color:${bkcolor};"><div class="RLCP-ETextDinamyc">${card.eTextBk}</div></div>
                                </div>
                              <div data-audio="${card.audioBk}" style="display:${audio}" class="RLCP-TAudio ${audioCls}" title="Audio"><img src="${$eXeRelaciona.idevicePath}exequextplayaudio.svg" class="FLCDSP-RLCP"  alt="Audio"></div>
                            </div>`);
            $('#rlcContainerDefinitions-' + instance).append(definitionDiv);
        });
    },

    getID: function () {
        const randomNumber1 = Math.floor(1000 + Math.random() * 9000),
            randomNumber2 = Math.floor(1000 + Math.random() * 9000),
            timestamp = Date.now();
        return `${randomNumber1}${timestamp}${randomNumber2}`;
    },

    startGame: function (instance) {
        let mOptions = $eXeRelaciona.options[instance];

        if (mOptions.gameStarted) return;

        $('#rlcContainerGame-' + instance).show();

        // Fix: Adjust canvas dimensions after showing the container
        // Without this, the canvas has 0x0 dimensions and arrows don't render
        $eXeRelaciona.ajustarCanvas(instance);

        $(`#rlcImgTime-${instance}`).hide();
        $(`#rlcPTime-${instance}`).hide();
        $(`#rlcButtons-${instance}`).hide();
        $(`#rlcResetButton-${instance}`).hide();

        if (mOptions.type > 0) {
            $(`#rlcButtons-${instance}`).css('display', 'flex');
            $(`#rlcCheckButton-${instance}`).show();
        }
        mOptions.gameStarted = true;
        mOptions.solveds = [];
        mOptions.selecteds = [];
        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.counter = mOptions.time * 60;
        mOptions.gameOver = false;
        mOptions.gameStarted = false;
        mOptions.obtainedClue = false;

        $('#rlcPShowClue-' + instance).text('');
        $('#rlcShowClue-' + instance).hide();
        $('#rlcPHits-' + instance).text(mOptions.hits);
        $('#rlcPErrors-' + instance).text(mOptions.errors);
        $('#rlcCubierta-' + instance).hide();
        $('#rlcStartGame-' + instance).hide();
        $('#rlcMessage-' + instance).hide();

        if (
            typeof mOptions != 'undefined' &&
            mOptions.type == 2 &&
            mOptions.time > 0
        ) {
            $(`#rlcPTime-${instance}`).show();
            $(`#rlcImgTime-${instance}`).show();
            let $node = $('#rlcMainContainer-' + instance);
            let $content = $('#node-content');
            mOptions.counterClock = setInterval(function () {
                if (
                    !$node.length ||
                    ($content.length && $content.attr('mode') === 'edition')
                ) {
                    clearInterval(mOptions.counterClock);
                    return;
                }
                if (typeof mOptions != 'undefined' && mOptions.gameStarted) {
                    mOptions.counter--;
                    $eXeRelaciona.updateTime(mOptions.counter, instance);
                    if (mOptions.counter <= 0) {
                        $eXeRelaciona.gameOver(instance);
                        return;
                    }
                }
            }, 1000);
            $eXeRelaciona.updateTime(mOptions.time * 60, instance);
        }

        mOptions.gameStarted = true;
    },
    redibujarLineas: function (instance, isMoving) {
        const mOptions = $eXeRelaciona.options[instance];
        if (!mOptions) return;
        mOptions._moving = !!isMoving;
        $eXeRelaciona.requestRedraw(instance);
    },

    requestRedraw: function (instance) {
        const mOptions = $eXeRelaciona.options[instance];
        if (!mOptions || !mOptions.canvas || !mOptions.contexto) return;
        if (mOptions._rafPending) return;
        mOptions._rafPending = true;
        const raf =
            typeof requestAnimationFrame !== 'undefined'
                ? requestAnimationFrame
                : function (cb) {
                      return setTimeout(cb, 16);
                  };
        raf(() => {
            mOptions._rafPending = false;
            $eXeRelaciona._drawLines(instance);
        });
    },

    _drawLines: function (instance) {
        const mOptions = $eXeRelaciona.options[instance];
        if (!mOptions || !mOptions.canvas || !mOptions.contexto) return;
        const ctx = mOptions.contexto;
        const canvasRect = mOptions.canvas.getBoundingClientRect();
        const dpr = mOptions._dpr || Math.max(window.devicePixelRatio || 1, 1);
        const cssW = mOptions._cssW
            ? mOptions._cssW
            : mOptions.canvas.width / dpr;
        const cssH = mOptions._cssH
            ? mOptions._cssH
            : mOptions.canvas.height / dpr;
        ctx.clearRect(0, 0, cssW, cssH);

        ctx.lineWidth = $eXeRelaciona.isMobile() ? 3 : 5;

        mOptions.linesMap.forEach((line) => {
            const startRect = line.start[0].getBoundingClientRect();
            const endRect = line.end[0].getBoundingClientRect();
            const x1 = startRect.right - canvasRect.left;
            const y1 = startRect.top + startRect.height / 2 - canvasRect.top;
            const x2 = endRect.left - canvasRect.left;
            const y2 = endRect.top + endRect.height / 2 - canvasRect.top;
            $eXeRelaciona.dibujaLineaCurva(ctx, x1, y1, x2, y2, line.color);
        });

        if (mOptions._moving && mOptions.currentWordDiv) {
            const startRect =
                mOptions.currentWordDiv[0].getBoundingClientRect();
            const x1 = startRect.right - canvasRect.left;
            const y1 = startRect.top + startRect.height / 2 - canvasRect.top;
            const x2 =
                typeof mOptions._tempX === 'number'
                    ? mOptions._tempX - canvasRect.left
                    : x1;
            const y2 =
                typeof mOptions._tempY === 'number'
                    ? mOptions._tempY - canvasRect.top
                    : y1;
            $eXeRelaciona.dibujaLineaCurva(
                ctx,
                x1,
                y1,
                x2,
                y2,
                $eXeRelaciona.borderColors.blue
            );
        }
    },

    createInterfaceCards: function (instance) {
        const path = $eXeRelaciona.idevicePath,
            msgs = $eXeRelaciona.options[instance].msgs,
            mOptions = $eXeRelaciona.options[instance],
            html = `
        <div class="RLCP-MainContainer" id="rlcMainContainer-${instance}">
            <div class="RLCP-GameMinimize" id="rlcGameMinimize-${instance}">
                <a href="#" class="RLCP-LinkMaximize" id="rlcLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                    <img src="${path}relacionaIcon.png" class="RLCP-IconMinimize RLCP-Activo" alt="">
                    <div class="RLCP-MessageMaximize" id="rlcMessageMaximize-${instance}">${msgs.msgPlayStart}</div>
                </a>
            </div>
            <div class="RLCP-GameContainer" id="rlcGameContainer-${instance}">
                <div class="RLCP-GameScoreBoard" id="rlcGameScoreBoard-${instance}">
                    <div class="RLCP-GameScores" id="rlcGameScores-${instance}">
                        <div class="exeQuextIcons exeQuextIcons-Number" id="rlcPNumberIcon-${instance}" title="${msgs.msgNumQuestions}"></div>
                        <p><span class="sr-av">${msgs.msgNumQuestions}: </span><span id="rlcPNumber-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                        <p><span class="sr-av">${msgs.msgHits}: </span><span id="rlcPHits-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Error" title="${msgs.msgErrors}"></div>
                        <p><span class="sr-av">${msgs.msgErrors}: </span><span id="rlcPErrors-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Score" title="${msgs.msgScore}"></div>
                        <p><span class="sr-av">${msgs.msgScore}: </span><span id="rlcPScore-${instance}">0</span></p>
                    </div>
                    <div class="RLCP-Info" id="rlcInfo-${instance}"></div>
                    <div class="RLCP-TimeNumber">
                        <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                        <div class="exeQuextIcons exeQuextIcons-Time" style="display:none" id="rlcImgTime-${instance}" title="${msgs.msgTime}"></div>
                        <p id="rlcPTime-${instance}" style="display:none" class="RLCP-PTime">00:00</p>
                        <a href="#" class="RLCP-LinkMinimize" id="rlcLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                            <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Minimize RLCP-Activo"></div>
                        </a>
                        <a href="#" class="RLCP-LinkFullScreen" id="rlcLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                            <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-FullScreen RLCP-Activo" id="rlcFullScreen-${instance}"></div>
                        </a>
                    </div>
                </div>
                <div class="RLCP-Information">
                    <a href="#" style="display:none" id="rlcStartGame-${instance}">${msgs.msgPlayStart}</a>
                    <p class="RLCP-Message" id="rlcMessage-${instance}"></p>
                </div>
                <div id="rlcButtons-${instance}" class="RLCP-Buttons">
                    <a href="#" class="RLCP-ResetButton" id="rlcResetButton-${instance}">${msgs.msgRestart}</a>
                    <a href="#" class="RLCP-CheckButton" id="rlcCheckButton-${instance}">${msgs.msgCheck}</a>
                </div>
                <div class="RLCP-Multimedia" id="rlcMultimedia-${instance}">
                    ${$eXeRelaciona.getMainHtml(instance)}                        
                </div>
                <div class="RLCP-AuthorGame" id="rlcAuthorGame-${instance}"></div>
            </div>
            <div class="RLCP-Cover" id="rlcCubierta-${instance}">
                <div class="RLCP-CodeAccessDiv" id="rlcCodeAccessDiv-${instance}">
                    <div class="RLCP-MessageCodeAccessE" id="rlcMesajeAccesCodeE-${instance}"></div>
                    <div class="RLCP-DataCodeAccessE">
                        <label class="sr-av">${msgs.msgCodeAccess}:</label>
                        <input type="text" class="RLCP-CodeAccessE form-control" id="rlcCodeAccessE-${instance}" placeholder="${msgs.msgCodeAccess}">
                        <a href="#" id="rlcCodeAccessButton-${instance}" title="${msgs.msgSubmit}">
                            <strong><span class="sr-av">${msgs.msgSubmit}</span></strong>
                            <div class="exeQuextIcons-Submit RLCP-Activo"></div>
                        </a>
                    </div>
                </div>
                <div class="RLCP-ShowClue" id="rlcShowClue-${instance}">
                    <p class="sr-av">${msgs.msgClue}</p>
                    <p class="RLCP-PShowClue" id="rlcPShowClue-${instance}"></p>
                    <a href="#" class="RLCP-ClueBotton" id="rlcClueButton-${instance}" title="${msgs.msgClose}">${msgs.msgClose}</a>
                </div>
            </div>
        </div>
        ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}
    `;
        return html;
    },

    getMainHtml: function (instance) {
        let html = `<div class="RLCP-Main">
                <div id="rlcContainerGame-${instance}" class="RLCP-ContainerGame">
                    <div id="rlcContainerWords-${instance}" class="RLCP-ContainerWords"></div>
                    <div id="rlcContainerDefinitions-${instance}" class="RLCP-ContainerDefinitions"></div>
                </div>
                <canvas id="rlcCanvas-${instance}" width="800" height="600" class="RLCP-Canvas"></canvas>
            </div>`;
        return html;
    },

    hexToRgba: function (hex, opacity) {
        const r = parseInt(hex.slice(1, 3), 16),
            g = parseInt(hex.slice(3, 5), 16),
            b = parseInt(hex.slice(5, 7), 16),
            opacity1 = Math.min(Math.max(opacity, 0), 1);
        return `rgba(${r}, ${g}, ${b}, ${opacity1})`;
    },

    shuffleElements: function (parentElement) {
        const children = parentElement.children().get(),
            shuffledChildren =
                $exeDevices.iDevice.gamification.helpers.shuffleAds(children);
        parentElement.empty().append(shuffledChildren);
    },

    gameOver: function (instance) {
        $eXeRelaciona.checkState(instance);
    },

    showScoreFooter: function (instance) {
        const mOptions = $eXeRelaciona.options[instance],
            score = (mOptions.hits * 10) / mOptions.realNumberCards,
            formattedScore = Number(score).toFixed(2);

        $(`#rlcRepeatActivity-${instance}`).text(
            `${mOptions.msgs.msgYouScore}: ${formattedScore}`
        );

        return formattedScore;
    },

    showScoreGame: function (instance) {
        const mOptions = $eXeRelaciona.options[instance],
            msgs = mOptions.msgs,
            score = ((mOptions.hits * 10) / mOptions.numberCards).toFixed(2);
        let message = msgs.msgEndGameM.replace('%s', score),
            messageColor = 0,
            clueMessage = '';

        $eXeRelaciona.showMessage(messageColor, message, instance, true);

        if (mOptions.itinerary.showClue) {
            if (score * 100 > mOptions.itinerary.percentageClue) {
                clueMessage = mOptions.itinerary.clueGame;
            } else {
                clueMessage = msgs.msgTryAgain.replace(
                    '%s',
                    mOptions.itinerary.percentageClue
                );
            }
            $eXeRelaciona.showMessage(3, clueMessage, instance, true);
        }

        const sscore = (
            (mOptions.hits * 10) /
            mOptions.cardsGame.length
        ).toFixed(2);
        $(`#rlcPScore-${instance}`).text(sscore);
        $(`#rlcPHits-${instance}`).text(mOptions.hits);
        $(`#rlcPErrors-${instance}`).text(mOptions.errors);
        $(`#rlcPNumber-${instance}`).text(
            mOptions.realNumberCards - mOptions.hits - mOptions.errors
        );
    },

    showClue: function (instance) {
        const mOptions = $eXeRelaciona.options[instance],
            percentageHits = (mOptions.hits * 10) / mOptions.cardsGame.length;
        if (mOptions.itinerary.showClue) {
            if (percentageHits >= mOptions.itinerary.percentageClue) {
                if (!mOptions.obtainedClue) {
                    mOptions.obtainedClue = true;
                    const msg = `${mOptions.msgs.msgInformation}: ${mOptions.itinerary.clueGame}`;
                    $(`#rlcPShowClue-${instance}`).text(msg);
                    $(`#rlcShowClue-${instance}`).show();
                    $(`#rlcCubierta-${instance}`).show();
                }
            }
        }
    },

    reboot: function (instance) {
        const mOptions = $eXeRelaciona.options[instance];
        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.active = 0;
        mOptions.obtainedClue = false;
        $('#rlcButtons-' + instance).hide();
        $eXeRelaciona.rebootCards(instance);
        $eXeRelaciona.showScoreGame(instance);
        mOptions.gameStarted = true;
        mOptions.gameOver = false;

        $('#rlcMessage-' + instance).hide();
    },

    rebootCards: function (instance) {
        const mOptions = $eXeRelaciona.options[instance];

        const $container = $(`#rlcGameContainer-${instance}`);
        $container
            .find('.RLCP-Word, .RLCP-Definition')
            .removeClass('RLCP-Connected')
            .removeData('lineindex');

        mOptions.linesMap.clear();
        mOptions.currentWordDiv = null;
        if (mOptions.tempEnd) {
            mOptions.tempEnd.remove();
            mOptions.tempEnd = null;
        }

        $eXeRelaciona.ajustarCanvas(instance);
        $eXeRelaciona.redibujarLineas(instance, false);

        $eXeRelaciona.createCards(instance);
        $eXeRelaciona.showScoreGame(instance);

        if (mOptions.type == 2) {
            mOptions.counter = mOptions.time * 60;
            $eXeRelaciona.startGame(instance);
        }
    },

    checkState: function (instance) {
        const mOptions = $eXeRelaciona.options[instance];

        if (typeof mOptions === 'undefined') return;

        clearInterval(mOptions.counterClock);
        mOptions.gameOver = true;
        mOptions.gameStarted = false;
        $eXeRelaciona.checkStateArrows(instance);

        $(`#rlcCheckButton-${instance}`).hide();
        $(`#rlcButtons-${instance}`).css('display', 'flex');
        $(`#rlcResetButton-${instance}`).show();

        $exeDevices.iDevice.gamification.media.stopSound(mOptions);
        $eXeRelaciona.showScoreGame(instance);
        $eXeRelaciona.saveEvaluation(instance, true);

        if (mOptions.isScorm === 1) {
            $eXeRelaciona.sendScore(true, instance);
            $eXeRelaciona.initialScore =
                $eXeRelaciona.showScoreFooter(instance);
        }
    },

    checkStateArrows: function (instance) {
        const mOptions = $eXeRelaciona.options[instance];
        mOptions.hits = 0;
        mOptions.errors = 0;

        mOptions.linesMap.forEach((value, key) => {
            if (value.correct) {
                mOptions.hits++;
                value.color = $eXeRelaciona.borderColors.green;
            } else {
                value.color = $eXeRelaciona.borderColors.red;
                mOptions.errors++;
            }
        });
        $eXeRelaciona.redibujarLineas(instance, false);
    },

    removeEvents: function (instance) {
        $(`#rlcLinkMaximize-${instance}`).off('click touchstart');
        $(`#rlcLinkMinimize-${instance}`).off('click touchstart');
        $(`#rlcCodeAccessButton-${instance}`).off('click touchstart');
        $(`#rlcCodeAccessE-${instance}`).off('keydown');
        $(`#rlcSendScore-${instance}`).off('click');
        $('#rlcMainContainer-' + instance)
            .closest('.idevice_node')
            .off('click', '.Games-SendScore');

        $(window).off('unload.eXeRelaciona beforeunload.eXeRelaciona');

        $(document).off('mousemove.eXeRlc' + instance);
        $(document).off('mouseup.eXeRlc' + instance);

        $(`#rlcClueButton-${instance}`).off('click');
        $(`#rlcStartGame-${instance}`).off('click');
        $(`#rlcLinkFullScreen-${instance}`).off('click touchstart');
        $(`#rlcResetButton-${instance}`).off('click');
        $(`#rlcCheckButton-${instance}`).off('click');
        $(`#rlcGameContainer-${instance}`).off(
            'mouseenter touchstart',
            '.RLCP-Author'
        );
        $(`#rlcGameContainer-${instance}`).off(
            'mouseleave touchend touchcancel',
            '.RLCP-Author'
        );
        $(`#rlcGameContainer-${instance}`).off(
            'click touchstart',
            '.RLCP-TAudio'
        );
    },

    addEvents: function (instance) {
        const mOptions = $eXeRelaciona.options[instance];
        const $rlcGameContainer = $('#rlcGameContainer-' + instance);

        $eXeRelaciona.removeEvents(instance);

        $('#rlcMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $eXeRelaciona.sendScore(false, instance);
                $eXeRelaciona.saveEvaluation(instance);
            });

        $('#rlcLinkMaximize-' + instance).on('click touchstart', function (e) {
            e.preventDefault();
            $rlcGameContainer.show();
            $('#rlcGameMinimize-' + instance).hide();
        });

        $('#rlcLinkMinimize-' + instance).on('click touchstart', function (e) {
            e.preventDefault();
            $rlcGameContainer.hide();
            $('#rlcGameMinimize-' + instance)
                .css('visibility', 'visible')
                .show();
        });

        $('#rlcCubierta-' + instance).hide();
        $('#rlcCodeAccessDiv-' + instance).hide();

        $('#rlcCodeAccessButton-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $eXeRelaciona.enterCodeAccess(instance);
            }
        );

        $('#rlcCodeAccessE-' + instance).on('keydown', function (event) {
            if (event.which == 13 || event.keyCode == 13) {
                $eXeRelaciona.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        $('#rlcPNumber-' + instance).text(mOptions.realNumberCards);

        $(window).on(
            'unload.eXeRelaciona beforeunload.eXeRelaciona',
            function () {
                if ($eXeRelaciona.mScorm) {
                    $exeDevices.iDevice.gamification.scorm.endScorm(
                        $eXeRelaciona.mScorm
                    );
                }
            }
        );

        $('#rlcSendScore-' + instance).click(function (e) {
            e.preventDefault();
            $eXeRelaciona.sendScore(false, instance);
            $eXeRelaciona.saveEvaluation(instance, true);
        });

        $('#rlcClueButton-' + instance).on('click', function (e) {
            e.preventDefault();
            $('#rlcShowClue-' + instance).hide();
            $('#rlcCubierta-' + instance).fadeOut();
        });

        $('#rlcPErrors-' + instance).text(mOptions.errors);
        if (mOptions.author.trim().length > 0 && !mOptions.fullscreen) {
            $('#rlcAuthorGame-' + instance).html(
                mOptions.msgs.msgAuthor + ': ' + mOptions.author
            );
            $('#rlcAuthorGame-' + instance).show();
        }

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        $('#rlcStartGame-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeRelaciona.startGame(instance);
        });

        $('#rlcLinkFullScreen-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                const element = document.getElementById(
                    'rlcGameContainer-' + instance
                );
                $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                    element
                );
            }
        );

        $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
            mOptions,
            this.isInExe
        );

        $('#rlcResetButton-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeRelaciona.reboot(instance);
        });

        $('#rlcCheckButton-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeRelaciona.checkState(instance);
        });

        $eXeRelaciona.ajustarCanvas(instance);

        $rlcGameContainer.on(
            'mouseenter touchstart',
            '.RLCP-Author',
            function () {
                $eXeRelaciona.showAutorImage($(this), instance);
            }
        );

        $rlcGameContainer.on(
            'mouseleave touchend touchcancel',
            '.RLCP-Author',
            function () {
                $eXeRelaciona.hideAutorImage($(this), instance);
            }
        );

        $rlcGameContainer.on('click touchstart', '.RLCP-TAudio', function () {
            if (!mOptions.gameStarted || mOptions.gameOver) return;
            const audio = $(this).data('audio');
            if (audio && audio.length > 3)
                $exeDevices.iDevice.gamification.media.playSound(
                    audio,
                    mOptions
                );
        });

        $eXeRelaciona.setupEventHandlers(instance);
        $eXeRelaciona.setupEventHandlersMovil(instance);

        $rlcGameContainer.on('click', '.RLCP-FullLinkImage', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const largeImageSrc = $(this).data('url');
            if (largeImageSrc && largeImageSrc.length > 3) {
                $exeDevices.iDevice.gamification.helpers.showFullscreenImage(
                    largeImageSrc,
                    $rlcGameContainer
                );
            }
        });
        $eXeRelaciona.refreshGame(instance);
        $(`#rlcContainerGame-${instance}`).hide();
        if (mOptions.itinerary.showCodeAccess) {
            $('#rlcMesajeAccesCodeE-' + instance).text(
                mOptions.itinerary.messageCodeAccess
            );
            $('#rlcCodeAccessDiv-' + instance).show();
            $('#rlcShowClue-' + instance).hide();
            $('#rlcCubierta-' + instance).show();
        }
        mOptions.gameOver = false;
        if (mOptions.type < 2 && !mOptions.itinerary.showCodeAccess) {
            $eXeRelaciona.startGame(instance);
        }
    },

    setFontSize: function (instance) {
        const $words = $('#rlcGameContainer-' + instance).find('.RLCP-Word');
        $words.each(function () {
            const $card = $(this),
                $text = $card.find('.RLCP-EText');
            $eXeRelaciona.adjustFontSize($text);
        });

        const $definition = $('#rlcGameContainer-' + instance).find(
            '.RLCP-Definition'
        );
        $definition.each(function () {
            const $card = $(this),
                $text = $card.find('.RLCP-EText');
            $eXeRelaciona.adjustFontSize($text);
        });
    },

    refreshGame: function (instance) {
        const mOptions = $eXeRelaciona.options[instance];
        if (!mOptions) return;
        if (mOptions.refreshGame) return;
        mOptions.refreshGame = true;
        let element = document.getElementById('rlcGameContainer-' + instance);
        element = element || document.documentElement;
        mOptions.fullscreen = !(
            !document.fullscreenElement &&
            !document.mozFullScreenElement &&
            !document.webkitFullscreenElement &&
            !document.msFullscreenElement
        );
        $eXeRelaciona.setFontSize(instance);
        $eXeRelaciona.ajustarCanvas(instance);
        mOptions.refreshGame = false;
    },

    removeEventHandlers: function (instance) {
        const $gameContainer = $(`#rlcGameContainer-${instance}`);
        $gameContainer.off('mousedown', '.RLCP-Word');
    },

    setupEventHandlers: function (instance) {
        this.removeEventHandlers(instance);

        const mOptions = $eXeRelaciona.options[instance],
            dragThreshold = 5,
            $gameContainer = $(`#rlcContainerGame-${instance}`);
        let isDragging = false;

        $gameContainer.on('mousedown', '.RLCP-Word', function (e) {
            e.preventDefault();
            if (
                typeof mOptions == 'undefined' ||
                !mOptions.gameStarted ||
                mOptions.gameOver
            )
                return;

            const targetWord = $(e.target).closest('.RLCP-Word'),
                sound = $(this).find('.RLCP-TAudio').data('audio');

            if (targetWord.hasClass('RLCP-Connected')) {
                $eXeRelaciona.removeConnection(targetWord, instance);
            }

            $gameContainer.find('.RLCP-Word').removeClass('RLCP-Selected');
            targetWord.addClass('RLCP-Selected');
            mOptions.currentWordDiv = targetWord;
            mOptions.canvas = $(`#rlcCanvas-${instance}`)[0];
            mOptions.contexto = mOptions.canvas.getContext('2d');
            mOptions.canvasRect = mOptions.canvas.getBoundingClientRect();

            mOptions.tempEnd = $('<div>')
                .css({
                    position: 'absolute',
                    top: e.clientY - mOptions.canvasRect.top,
                    left: e.clientX - mOptions.canvasRect.left,
                    width: 0,
                    height: 0,
                    padding: 0,
                    margin: 0,
                    'border-radius': '50%',
                    'background-color': 'red',
                    'z-index': 9,
                })
                .appendTo(`#rlcContainerGame-${instance}`);

            mOptions.lineindex = mOptions.currentWordDiv.data('lineindex');
            mOptions.startX = e.clientX - mOptions.canvasRect.left;
            mOptions.startY = e.clientY - mOptions.canvasRect.top;
            isDragging = false;

            if (sound && sound.length > 4) {
                $exeDevices.iDevice.gamification.media.playSound(
                    sound,
                    mOptions
                );
            }
        });

        $(document).on('mousemove.eXeRlc' + instance, (e) => {
            if (
                typeof mOptions == 'undefined' ||
                !mOptions.gameStarted ||
                mOptions.gameOver ||
                !mOptions.currentWordDiv ||
                !mOptions.tempEnd
            )
                return;

            const dx = Math.abs(e.clientX - mOptions.startX),
                dy = Math.abs(e.clientY - mOptions.startY);

            if (dx > dragThreshold || dy > dragThreshold) {
                mOptions.canvasRect = mOptions.canvas.getBoundingClientRect();
                mOptions.tempEnd.css({
                    top: e.clientY - mOptions.canvasRect.top,
                    left: e.clientX - mOptions.canvasRect.left,
                });
                // Guardar coords absolutas para el repintado
                mOptions._tempX = e.clientX;
                mOptions._tempY = e.clientY;

                const buffer = 40,
                    scrollSpeed = 10;

                if (e.clientY < buffer) {
                    window.scrollBy(0, -scrollSpeed);
                } else if (window.innerHeight - e.clientY < buffer) {
                    window.scrollBy(0, scrollSpeed);
                }
                isDragging = true;
                $eXeRelaciona.redibujarLineas(instance, isDragging);
            }
        });

        $(document).on('mouseup.eXeRlc' + instance, (e) => {
            e.preventDefault();
            if (
                typeof mOptions == 'undefined' ||
                !mOptions.gameStarted ||
                mOptions.gameOver ||
                !mOptions.currentWordDiv
            )
                return;

            const definitionDiv = $(e.target).closest('.RLCP-Definition'),
                sound = definitionDiv.find('.RLCP-TAudio').data('audio');

            if (
                definitionDiv.length > 0 &&
                !definitionDiv.hasClass('RLCP-Connected')
            ) {
                if (
                    !(
                        mOptions.type === 0 &&
                        mOptions.currentWordDiv.data('id') !==
                            definitionDiv.data('id')
                    )
                ) {
                    if (isDragging || mOptions.currentWordDiv) {
                        $eXeRelaciona.addOrUpdateLine(
                            mOptions.lineindex,
                            mOptions.currentWordDiv,
                            definitionDiv,
                            $eXeRelaciona.borderColors.blue,
                            instance
                        );
                        $eXeRelaciona.checkAllConnected(instance);
                        mOptions.currentWordDiv = null;
                    }
                }
                if (sound && sound.length > 4) {
                    $exeDevices.iDevice.gamification.media.playSound(
                        sound,
                        mOptions
                    );
                }
            }
            mOptions._moving = false;
            $eXeRelaciona.requestRedraw(instance);
            isDragging = false;
            if (mOptions.tempEnd) {
                mOptions.tempEnd.remove();
                mOptions.tempEnd = null;
            }
            mOptions._tempX = undefined;
            mOptions._tempY = undefined;
        });
    },

    showAutorImage: function ($this, instance) {
        const mOptions = $eXeRelaciona.options[instance],
            author = $this.data('author'),
            $rlcAuthorGameSelector = `#rlcAuthorGame-${instance}`;
        if (author && author.length > 0) {
            $($rlcAuthorGameSelector)
                .html(`${mOptions.msgs.msgAuthor}: ${author}`)
                .show();
        }
    },

    hideAutorImage: function ($this, instance) {
        const mOptions = $eXeRelaciona.options[instance],
            author = $this.data('author'),
            $rlcAuthorGameSelector = `#rlcAuthorGame-${instance}`;
        if (mOptions.author && mOptions.author.length > 0) {
            $($rlcAuthorGameSelector)
                .html(`${mOptions.msgs.msgAuthor}: ${author}`)
                .show();
        } else {
            $($rlcAuthorGameSelector).hide();
        }
    },

    removeEventHandlersMovil: function (instance) {
        const containerGame = document.querySelector(
            `#rlcGameContainer-${instance}`
        );

        if (containerGame) {
            containerGame.removeEventListener(
                'touchstart',
                this.touchStartHandler,
                { passive: false }
            );
            containerGame.removeEventListener(
                'touchmove',
                this.touchMoveHandler,
                { passive: false }
            );
            containerGame.removeEventListener(
                'touchend',
                this.touchEndHandler,
                { passive: false }
            );
        }
    },

    setupEventHandlersMovil: function (instance) {
        $eXeRelaciona.removeEventHandlersMovil(instance);

        const mOptions = $eXeRelaciona.options[instance],
            $gameContainer = $(`#rlcGameContainer-${instance}`);

        let isDragging = false,
            dragThreshold = 5;

        this.touchStartHandler = function (e) {
            e.preventDefault();
            if (
                !mOptions.gameStarted ||
                mOptions.gameOver ||
                !e.touches ||
                e.touches.length === 0
            ) {
                return;
            }
            const touch = e.touches[0],
                target = touch.target,
                touchedWord = $(target).closest('.RLCP-Word');

            if (touchedWord.length === 0) return;

            mOptions.targetWord = touchedWord;

            if (mOptions.targetWord.hasClass('RLCP-Connected')) {
                $eXeRelaciona.removeConnection(mOptions.targetWord, instance);
            }

            $gameContainer.find('.RLCP-Word').removeClass('RLCP-Selected');
            mOptions.targetWord.addClass('RLCP-Selected');
            mOptions.currentWordDiv = mOptions.targetWord;
            mOptions.canvas = document.getElementById(`rlcCanvas-${instance}`);
            mOptions.contexto = mOptions.canvas.getContext('2d');
            mOptions.canvasRect = mOptions.canvas.getBoundingClientRect();
            mOptions.tempEnd = $('<div>')
                .css({
                    position: 'absolute',
                    top: touch.clientY - mOptions.canvasRect.top,
                    left: touch.clientX - mOptions.canvasRect.left,
                    width: 10,
                    height: 10,
                    padding: 0,
                    margin: 0,
                    'border-radius': '50%',
                    'background-color': 'red',
                    'z-index': 9,
                })
                .appendTo(`#rlcContainerGame-${instance}`);
            mOptions.lineindex = mOptions.currentWordDiv.data('lineindex');
            mOptions.startX = touch.clientX;
            mOptions.startY = touch.clientY;
            isDragging = false;
        };

        this.touchMoveHandler = function (e) {
            if (
                !mOptions.gameStarted ||
                mOptions.gameOver ||
                !mOptions.currentWordDiv ||
                !mOptions.tempEnd ||
                !e.touches ||
                e.touches.length === 0
            ) {
                return;
            }
            const touch = e.touches[0],
                dx = Math.abs(touch.clientX - mOptions.startX),
                dy = Math.abs(touch.clientY - mOptions.startY);

            if (dx > dragThreshold || dy > dragThreshold) {
                mOptions.tempEnd.css({
                    top: touch.clientY - mOptions.canvasRect.top,
                    left: touch.clientX - mOptions.canvasRect.left,
                });
                mOptions._tempX = touch.clientX;
                mOptions._tempY = touch.clientY;
                const buffer = 40,
                    scrollSpeed = 10;
                if (touch.clientY < buffer) {
                    window.scrollBy(0, -scrollSpeed);
                } else if (window.innerHeight - touch.clientY < buffer) {
                    window.scrollBy(0, scrollSpeed);
                }
                isDragging = true;
                $eXeRelaciona.redibujarLineas(instance, isDragging);
            }
        };

        this.touchEndHandler = function (e) {
            e.preventDefault();
            if (
                !mOptions.gameStarted ||
                mOptions.gameOver ||
                !e.changedTouches ||
                e.changedTouches.length === 0 ||
                !mOptions.currentWordDiv
            ) {
                return;
            }
            const touch = e.changedTouches[0],
                definitionDiv = $(
                    document.elementFromPoint(touch.clientX, touch.clientY)
                ).closest('.RLCP-Definition');

            if (
                definitionDiv.length > 0 &&
                !definitionDiv.hasClass('RLCP-Connected')
            ) {
                if (
                    !(
                        mOptions.type === 0 &&
                        mOptions.currentWordDiv.data('id') !==
                            definitionDiv.data('id')
                    )
                ) {
                    if (isDragging || mOptions.currentWordDiv) {
                        $eXeRelaciona.addOrUpdateLine(
                            mOptions.lineindex,
                            mOptions.currentWordDiv,
                            definitionDiv,
                            $eXeRelaciona.borderColors.blue,
                            instance
                        );
                        $eXeRelaciona.checkAllConnected(instance);
                        mOptions.currentWordDiv = null;
                    }
                }
            }
            mOptions._moving = false;
            $eXeRelaciona.requestRedraw(instance);
            isDragging = false;
            if (mOptions.tempEnd) {
                mOptions.tempEnd.remove();
                mOptions.tempEnd = null;
            }
            mOptions._tempX = undefined;
            mOptions._tempY = undefined;
        };

        const containerGame = document.querySelector(
            `#rlcGameContainer-${instance}`
        );
        if (containerGame) {
            containerGame.addEventListener(
                'touchstart',
                this.touchStartHandler,
                { passive: false }
            );
            containerGame.addEventListener('touchmove', this.touchMoveHandler, {
                passive: false,
            });
            containerGame.addEventListener('touchend', this.touchEndHandler, {
                passive: false,
            });
        }
    },

    removeLine: function (lineindex, instance) {
        const mOptions = $eXeRelaciona.options[instance];
        mOptions.linesMap.delete(lineindex);
    },

    updateColorLine: function (lineindex, color, instance) {
        const mOptions = $eXeRelaciona.options[instance];
        let line;
        if (mOptions.linesMap.has(lineindex)) {
            line = mOptions.linesMap.get(lineindex);
            line.color = color;
        }
    },

    dibujaLineaTemporal: function (instance) {
        const mOptions = $eXeRelaciona.options[instance],
            startRect = mOptions.currentWordDiv[0].getBoundingClientRect(),
            endRect = mOptions.tempEnd[0].getBoundingClientRect(),
            x1 = startRect.right - mOptions.canvasRect.left,
            y1 = startRect.top + startRect.height / 2 - mOptions.canvasRect.top,
            x2 = endRect.left - mOptions.canvasRect.left,
            y2 = endRect.top + endRect.height / 2 - mOptions.canvasRect.top;

        $eXeRelaciona.dibujaLineaCurva(
            mOptions.contexto,
            x1,
            y1,
            x2,
            y2,
            $eXeRelaciona.borderColors.blue
        );
    },

    addOrUpdateLine: function (lineindex, $word, $definition, color, instance) {
        const mOptions = $eXeRelaciona.options[instance];
        let line,
            correct = false;

        if ($word && $definition) {
            correct = $word.data('id') === $definition.data('id');
        }

        $word.removeClass('RLCP-Selected');
        $definition.data('lineindex', lineindex).addClass('RLCP-Connected');
        $word.addClass('RLCP-Connected');

        if (mOptions.linesMap.has(lineindex)) {
            line = mOptions.linesMap.get(lineindex);
            Object.assign(line, {
                start: $word,
                end: $definition,
                correct: correct,
                color: color,
            });
        } else {
            line = {
                start: $word,
                end: $definition,
                color: color,
                correct: correct,
            };
            mOptions.linesMap.set(lineindex, line);
        }
        return line;
    },

    adjustFontSize: function ($container) {
        const $text = $container.find('.RLCP-ETextDinamyc').eq(0),
            minFontSize = 10,
            maxFontSize = 22,
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

    getNumberCards: function (instance) {
        const mOptions = $eXeOrdena.options[instance];
        return mOptions.cardsGame[mOptions.active].cards.length;
    },

    ajustarCanvas: function (instance) {
        const mOptions = $eXeRelaciona.options[instance],
            $contenedor = $(`#rlcContainerGame-${instance}`),
            $canvas = $(`#rlcCanvas-${instance}`);

        const cssW = $contenedor.width();
        const cssH = $contenedor.height();
        const dpr = Math.max(window.devicePixelRatio || 1, 1);
        mOptions._dpr = dpr;
        mOptions._cssW = cssW;
        mOptions._cssH = cssH;

        $canvas.attr('width', Math.round(cssW * dpr));
        $canvas.attr('height', Math.round(cssH * dpr));
        $canvas.css({ width: cssW + 'px', height: cssH + 'px' });

        mOptions.canvas = $canvas[0];

        if (mOptions.canvas) {
            mOptions.contexto = mOptions.canvas.getContext('2d');
            mOptions.contexto.setTransform(dpr, 0, 0, dpr, 0, 0);
            mOptions.canvasRect = mOptions.canvas.getBoundingClientRect();
            $eXeRelaciona.requestRedraw(instance);
        }
    },

    redibujarLineas: function (instance, isMoving) {
        const mOptions = $eXeRelaciona.options[instance];
        if (!mOptions) return;
        mOptions._moving = !!isMoving;
        $eXeRelaciona.requestRedraw(instance);
    },

    dibujaLineaCurva: function (contexto, x0, y0, x1, y1, color) {
        const p0 = { x: x0, y: y0 },
            p1 = { x: x1, y: y1 },
            dx = p1.x - p0.x,
            dy = p1.y - p0.y,
            desplazamiento = Math.min(100, Math.abs(dx) / 2),
            pc1 = { x: p0.x + desplazamiento, y: p0.y },
            pc2 = { x: p1.x - desplazamiento, y: p1.y },
            tangente = { x: 3 * (p1.x - pc2.x), y: 3 * (p1.y - pc2.y) },
            angulo = Math.atan2(tangente.y, tangente.x);

        contexto.beginPath();
        contexto.strokeStyle = color;
        contexto.moveTo(p0.x, p0.y);
        contexto.bezierCurveTo(pc1.x, pc1.y, pc2.x, pc2.y, p1.x, p1.y);
        contexto.stroke();
        $eXeRelaciona.dibujaPuntaFlecha(contexto, p1, angulo, color);
    },

    dibujaPuntaFlecha: function (contexto, punto, angulo, color) {
        const tamañoFlecha = $eXeRelaciona.isMobile() ? 10 : 12,
            anguloFlecha = Math.PI / 6;

        contexto.fillStyle = color;
        contexto.beginPath();
        contexto.moveTo(punto.x, punto.y);

        contexto.lineTo(
            punto.x - tamañoFlecha * Math.cos(angulo - anguloFlecha),
            punto.y - tamañoFlecha * Math.sin(angulo - anguloFlecha)
        );

        contexto.lineTo(
            punto.x - tamañoFlecha * Math.cos(angulo + anguloFlecha),
            punto.y - tamañoFlecha * Math.sin(angulo + anguloFlecha)
        );

        contexto.closePath();
        contexto.fill();
    },

    removeConnection: function (element, instance) {
        const lineId = element.data('lineindex');

        if (lineId !== undefined) {
            $eXeRelaciona.removeLine(lineId, instance);
            $(`#rlcContainerWords-${instance} .RLCP-Word`).each(function () {
                if ($(this).data('lineindex') === lineId) {
                    $(this).removeClass('RLCP-Connected');
                }
            });

            $(`#rlcContainerDefinitions-${instance} .RLCP-Definition`).each(
                function () {
                    if ($(this).data('lineindex') === lineId) {
                        $(this)
                            .removeClass('RLCP-Connected')
                            .data('lineindex', 0);
                    }
                }
            );
        }
        $eXeRelaciona.redibujarLineas(instance, false);
    },

    checkAllConnected: function (instance) {
        const mOptions = $eXeRelaciona.options[instance],
            $constainerGame = $(`#rlcGameContainer-${instance}`);

        $(`#rlcCheckButton-${instance}`).hide();
        $(`#rlcResetButton-${instance}`).hide();
        $(`#rlcButtons-${instance}`).css('display', 'flex');

        if (
            $constainerGame.find('.RLCP-Word.RLCP-Connected').length ===
            $constainerGame.find('.RLCP-Word').length
        ) {
            if (mOptions.permitirErrores) {
                $(`#rlcCheckButton-${instance}`).show();
            } else {
                $eXeRelaciona.checkState(instance);
            }
        }
    },

    isMobile: function () {
        return /Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(
            navigator.userAgent
        );
    },

    enterCodeAccess: function (instance) {
        const mOptions = $eXeRelaciona.options[instance],
            codeInput = $(`#rlcCodeAccessE-${instance}`).val().toLowerCase(),
            codeAccess = mOptions.itinerary.codeAccess.toLowerCase();

        if (codeAccess === codeInput) {
            $(`#rlcCodeAccessDiv-${instance}, #rlcCubierta-${instance}`).hide();
            $(`#rlcContainerGame-${instance}`).show();
            $eXeRelaciona.refreshGame(instance);
            $eXeRelaciona.startGame(instance);
        } else {
            $(`#rlcMesajeAccesCodeE-${instance}`)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $(`#rlcCodeAccessE-${instance}`).val('');
        }
    },

    updateScore: function (correctAnswer, instance) {
        const mOptions = $eXeRelaciona.options[instance];
        let obtainedPoints = 0;

        if (correctAnswer) {
            mOptions.hits++;
            obtainedPoints = 10 / mOptions.realNumberCards;
        } else {
            mOptions.errors++;
        }
        mOptions.score = Math.max(mOptions.score + obtainedPoints, 0);
        const sscore = mOptions.score.toFixed(2);

        $(`#rlcPScore-${instance}`).text(sscore);
        $(`#rlcPHits-${instance}`).text(mOptions.hits);
        $(`#rlcPErrors-${instance}`).text(mOptions.errors);
        $(`#rlcPNumber-${instance}`).text(
            mOptions.realNumberCards - mOptions.hits - mOptions.errors
        );
    },

    showMessage: function (type, message, instance) {
        const colors = [
                '#555555',
                $eXeRelaciona.borderColors.red,
                $eXeRelaciona.borderColors.green,
                $eXeRelaciona.borderColors.blue,
                $eXeRelaciona.borderColors.yellow,
            ],
            color = colors[type],
            $rlcMessage = $(`#rlcMessage-${instance}`);
        $rlcMessage
            .html(message)
            .css({ color: color, 'font-style': 'bold' })
            .show();
    },

    saveEvaluation: function (instance) {
        const mOptions = $eXeRelaciona.options[instance];
        ((mOptions.scorerp = (mOptions.hits * 10) / mOptions.realNumberCards),
            $exeDevices.iDevice.gamification.report.saveEvaluation(
                mOptions,
                $eXeRelaciona.isInExe
            ));
    },

    sendScore: function (auto, instance) {
        const mOptions = $eXeRelaciona.options[instance];

        ((mOptions.scorerp = score =
            (mOptions.hits * 10) / mOptions.realNumberCards),
            (mOptions.previousScore = $eXeRelaciona.previousScore));
        mOptions.userName = $eXeRelaciona.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $eXeRelaciona.previousScore = mOptions.previousScore;
    },
};
$(function () {
    $eXeRelaciona.init();
});
