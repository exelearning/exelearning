/* eslint-disable no-undef */
/**
 * Dreg and Drog activity (Export)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Desing: Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 *
 */
var $eXeDragDrop = {
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
            'Drag and drop',
            'dragdrop',
            'dragdrop-IDevice'
        );
        this.isInExe = eXe.app.isInExe();
    },

    enable: function () {
        $eXeDragDrop.loadGame();
    },

    loadGame: function () {
        $eXeDragDrop.options = [];

        $eXeDragDrop.activities.each(function (i) {
            const dl = $('.dragdrop-DataGame', this),
                mOption = $eXeDragDrop.loadDataGame(dl, this);

            mOption.scorerp = 0;
            mOption.idevicePath = $eXeDragDrop.idevicePath;
            mOption.main = 'dadPMainContainer-' + i;
            mOption.idevice = 'dragdrop-IDevice';

            $eXeDragDrop.options.push(mOption);

            const dadP = $eXeDragDrop.createInterfaceCards(i);

            dl.before(dadP).remove();
            $('#dadPGameContainer-' + i).show();
            $('#dadPGameMinimize-' + i)
                .css({ cursor: 'pointer' })
                .show();
            $('#dadPCubierta-' + i).hide();

            $eXeDragDrop.createDrags(i);
            if (mOption.showMinimize) {
                $('#dadPGameContainer-' + i).hide();
            } else {
                $('#dadPGameMinimize-' + i).hide();
            }

            $eXeDragDrop.addEvents(i);
            if (mOption.type == 2 && mOption.time > 0) {
                $('#dadPImgTime-' + i).show();
                $('#dadPPTime-' + i).show();
                $('#dadPStartGame-' + i).show();
                $('#dadPMessage-' + i).hide();
                $eXeDragDrop.updateTime(mOption.time * 60, i);
            }
        });

        $exeDevices.iDevice.gamification.math.updateLatex('.dragdrop-IDevice');
    },

    loadDataGame: function (data, sthis) {
        const json = data.text(),
            mOptions =
                $exeDevices.iDevice.gamification.helpers.isJsonString(json),
            $imagesLink = $('.dragdrop-LinkImages', sthis),
            $audiosLink = $('.dragdrop-LinkAudios', sthis);

        mOptions.playerAudio = '';
        mOptions.gameStarted = false;
        mOptions.typeDrag =
            typeof mOptions.typeDrag === 'undefined' ? 0 : mOptions.typeDrag;

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
        mOptions.id = typeof mOptions.id === 'undefined' ? false : mOptions.id;
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
        const mOptions = $eXeDragDrop.options[instance],
            mTime =
                $exeDevices.iDevice.gamification.helpers.getTimeToString(
                    tiempo
                );
        if (mOptions.time < 0) return;
        $(`#dadPPTime-${instance}`).text(mTime);
    },

    clearHtml: function (htmlString) {
        const tempDiv = $('<div>').html(htmlString);
        return tempDiv.text();
    },

    createDrags: function (instance) {
        const mOptions = $eXeDragDrop.options[instance],
            shuffledDefintion =
                $exeDevices.iDevice.gamification.helpers.shuffleAds([
                    ...mOptions.cardsGame,
                ]),
            shuffledMedia = $exeDevices.iDevice.gamification.helpers.shuffleAds(
                [...mOptions.cardsGame]
            );

        $(`#dadPDragTargetsContainer-${instance}`).empty();
        shuffledDefintion.forEach((card) => {
            const imgDivShow = mOptions.typeDrag === 1 ? 'block' : 'none',
                textDivShow = mOptions.typeDrag === 1 ? 'none' : 'block',
                imgsrc = mOptions.typeDrag === 1 ? card.url : '',
                imgshow =
                    mOptions.typeDrag === 1 && imgsrc.length > 3
                        ? 'block'
                        : 'none',
                alt =
                    mOptions.typeDrag === 1 && card.alt.length > 0
                        ? card.alt
                        : 'No image',
                audiosrc = mOptions.typeDrag === 1 ? card.audio : '',
                audioshow =
                    mOptions.typeDrag === 1 && audiosrc.length > 3
                        ? 'block'
                        : 'none',
                definition = mOptions.typeDrag === 1 ? '' : card.definition,
                audioCls =
                    mOptions.typeDrag === 1 && imgsrc.length < 3
                        ? 'DADP-LinkAudioBig'
                        : 'DADP-LinkAudio',
                targetp = `DADP-PT-${instance}`,
                fullimage =
                    imgsrc.length > 3
                        ? `<a href="#" class="DADP-FullLinkImage" data-url="${imgsrc}" title="${mOptions.msgs.msgFullScreen}">
                    <strong><span class="sr-av">${mOptions.msgs.msgFullScreen}:</span></strong>
                    <div  class="exeQuextIcons exeQuextIcons-FullImage DADP-Activo"></div>
                </a>`
                        : '';

            const wordDiv = `
                <div class="DADP-DragTargetContainer DADP-PSC ${targetp} DADP-NoSelect" data-id="${card.id}">
                    <div class="DADP-TextTargetDiv" >
                        <div style="display:${textDivShow};" >
                                ${definition}
                        </div>
                    </div>
                    <div class="DADP-MediaTargetDiv">
                        <div style="display:${imgDivShow}">
                            <img src="${imgsrc}" alt="${alt}" style="display:${imgshow}" draggable="false" class="DADP-ImageTarget">
                            <div style="display:${audioshow}" data-audio="${audiosrc}" class="DADP-TAudio ${audioCls}" title="Audio">
                                <img src="${$eXeDragDrop.idevicePath}exequextplayaudio.svg" class="DADP-Audio" alt="Audio" draggable="false">
                            </div>
                            ${fullimage}
                        </div>
                    </div>
                </div>
            `;

            $(`#dadPDragTargetsContainer-${instance}`).append(wordDiv);
        });

        $(`#dadPDragSourcesContainer-${instance}`).empty();
        shuffledMedia.forEach((card) => {
            const imgDivShow = mOptions.typeDrag === 0 ? 'flex' : 'none',
                textDivShow = mOptions.typeDrag === 0 ? 'none' : 'flex',
                imgsrc = mOptions.typeDrag === 0 ? card.url : '',
                imgshow =
                    mOptions.typeDrag === 0 && imgsrc.length > 3
                        ? 'block'
                        : 'none',
                alt =
                    mOptions.typeDrag === 0 && card.alt.length > 0
                        ? card.alt
                        : 'No image',
                audiosrc = mOptions.typeDrag === 0 ? card.audio : '',
                audioshow =
                    mOptions.typeDrag === 0 && audiosrc.length > 3
                        ? 'block'
                        : 'none',
                definition = mOptions.typeDrag === 0 ? '' : card.definition,
                audioCls =
                    mOptions.typeDrag === 0 && imgsrc.length < 3
                        ? 'DADP-LinkAudioBig'
                        : 'DADP-LinkAudio',
                istext = mOptions.typeDrag === 0 ? '' : 'DADP-Text1',
                imgds = mOptions.typeDrag === 0 ? 'DADP-DS' : '',
                txtds = mOptions.typeDrag === 0 ? '' : 'DADP-DS',
                fullimage =
                    imgsrc.length > 3
                        ? `<a href="#" class="DADP-FullLinkImage" data-url="${imgsrc}" title="${mOptions.msgs.msgFullScreen}">
                    <strong><span class="sr-av">${mOptions.msgs.msgFullScreen}:</span></strong>
                    <div  class="exeQuextIcons exeQuextIcons-FullImage DADP-Activo"></div>
                </a>`
                        : '';

            const definitionDiv = `
                <div class="DADP-DragSourceContainer DADP-PSC ${istext} DADP-NoSelect" data-id="${card.id}">
                    <div class="DADP-TextSourceDiv" style="display:${textDivShow}"  data-id="${card.id}" >
                        <div class="${txtds} DADP-TextSource" data-id="${card.id}" data-state="2" >
                           ${definition}
                        </div>
                    </div>
                    <div class="DADP-MediaSourceDiv" style="display:${imgDivShow}"  data-id="${card.id}" >
                        <div class="${imgds} DADP-MediaSource" data-id="${card.id}" data-state="2">
                            <img src="${imgsrc}" alt="${alt}" style="display:${imgshow}" draggable="false" class="DADP-ImageSource">
                            <div style="display:${audioshow}" data-audio="${audiosrc}" class="DADP-TAudio ${audioCls}" title="Audio">
                                <img src="${$eXeDragDrop.idevicePath}exequextplayaudio.svg" class="DADP-Audio" alt="Audio" draggable="false">
                            </div>
                             ${fullimage}
                        </div>
                    </div>
                </div>
            `;

            $(`#dadPDragSourcesContainer-${instance}`).append(definitionDiv);
        });
    },

    getID: function () {
        const randomNumber1 = Math.floor(1000 + Math.random() * 9000),
            randomNumber2 = Math.floor(1000 + Math.random() * 9000),
            timestamp = Date.now();
        return `${randomNumber1}${timestamp}${randomNumber2}`;
    },

    startGame: function (instance) {
        let mOptions = $eXeDragDrop.options[instance];

        if (mOptions.gameStarted) return;

        $('#dadPContainerGame-' + instance).show();
        $(`#dadPImgTime-${instance}`).hide();
        $(`#dadPPTime-${instance}`).hide();
        $(`#dadPButtons-${instance}`).hide();
        $(`#dadPResetButton-${instance}`).hide();

        if (mOptions.type > 0) {
            $(`#dadPButtons-${instance}`).css('display', 'flex');
            $(`#dadPCheckButton-${instance}`).show();
        }
        mOptions.solveds = [];
        mOptions.selecteds = [];
        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.counter = mOptions.time * 60;
        mOptions.gameOver = false;
        mOptions.gameStarted = false;
        mOptions.obtainedClue = false;

        $('#dadPPShowClue-' + instance).text('');
        $('#dadPShowClue-' + instance).hide();
        $('#dadPPHits-' + instance).text(mOptions.hits);
        $('#dadPPErrors-' + instance).text(mOptions.errors);
        $('#dadPCubierta-' + instance).hide();
        $('#dadPStartGame-' + instance).hide();
        $('#dadPMessage-' + instance).hide();

        if (
            typeof mOptions != 'undefined' &&
            mOptions.type == 2 &&
            mOptions.time > 0
        ) {
            $('#dadPPTime-' + instance).show();
            $('#dadPImgTime-' + instance).show();
            mOptions.counterClock = setInterval(function () {
                let $node = $('#dadPMainContainer-' + instance);
                let $content = $('#node-content');
                if (
                    !$node.length ||
                    ($content.length && $content.attr('mode') === 'edition')
                ) {
                    clearInterval(mOptions.counterClock);
                    return;
                }
                if (typeof mOptions != 'undefined' && mOptions.gameStarted) {
                    mOptions.counter--;
                    $eXeDragDrop.updateTime(mOptions.counter, instance);
                    if (mOptions.counter <= 0) {
                        $eXeDragDrop.gameOver(instance);
                        return;
                    }
                }
            }, 1000);
            $eXeDragDrop.updateTime(mOptions.time * 60, instance);
        }
        setTimeout(function () {
            $eXeDragDrop.initializeDragAndDrop(instance);
            mOptions.gameStarted = true;
        }, 2000);
    },

    initializeDragAndDrop: function (instance) {
        const mOptions = $eXeDragDrop.options[instance];

        // Keep a retry counter to handle race conditions (jQuery UI or images not ready)
        mOptions._initRetries = mOptions._initRetries || 0;

        // If jQuery UI not ready yet, retry a few times
        if (!$.ui || !$.ui.draggable || !$.ui.droppable) {
            if (mOptions._initRetries < 10) {
                mOptions._initRetries++;
                setTimeout(function () {
                    $eXeDragDrop.initializeDragAndDrop(instance);
                }, 200);
            }
            return;
        }

        const $dadPGameContainer = $('#dadPGameContainer-' + instance);
        $dadPGameContainer.css('position', 'relative');

        // If images inside draggables aren't loaded yet, wait a bit and retry
        const $imgs = $dadPGameContainer.find('.DADP-DS img');
        if ($imgs.length > 0) {
            let anyNotLoaded = false;
            $imgs.each(function () {
                if (!this.complete) anyNotLoaded = true;
            });
            if (anyNotLoaded && mOptions._initRetries < 10) {
                mOptions._initRetries++;
                setTimeout(function () {
                    $eXeDragDrop.initializeDragAndDrop(instance);
                }, 200);
                return;
            }
        }

        // Reset retry counter on success
        mOptions._initRetries = 0;

        const $draggables = $dadPGameContainer.find('.DADP-DS'),
            $droppables = $dadPGameContainer.find('.DADP-DragTargetContainer');

        $draggables.draggable({
            revert: 'invalid',
            cursor: 'move',
            containment: 'document',
            helper: function () {
                // Use outerWidth/outerHeight to avoid zero-dimension helpers
                const w =
                    $(this).outerWidth() ||
                    this.getBoundingClientRect().width ||
                    40;
                const h =
                    $(this).outerHeight() ||
                    this.getBoundingClientRect().height ||
                    32;
                const $clone = $(this)
                    .clone()
                    .appendTo('.DADP-GameContainer-' + instance);
                $clone.css({
                    position: 'absolute',
                    width: w,
                    height: h,
                    'z-index': 1000,
                    border: '1px solid #ccc',
                    'min-height': '32px',
                });
                return $clone;
            },
            start: function (event, ui) {
                $(this).addClass('DADP-Dragging');
                if (ui.helper) {
                    const w =
                        $(this).outerWidth() ||
                        this.getBoundingClientRect().width ||
                        40;
                    const h =
                        $(this).outerHeight() ||
                        this.getBoundingClientRect().height ||
                        32;
                    ui.helper.css({
                        width: w,
                        height: h,
                    });
                }
                const $audio = $(this).find('.DADP-TAudio');
                if ($audio.length === 1) {
                    const audioData = $audio.data('audio');
                    if (audioData && audioData.length > 3) {
                        $exeDevices.iDevice.gamification.media.playSound(
                            audioData,
                            mOptions
                        );
                    }
                }
            },
            stop: function (event, ui) {
                $(this).removeClass('DADP-Dragging');
                if (ui.helper) {
                    ui.helper.css('z-index', 1);
                }
            },
        });

        $droppables.droppable({
            accept: '.DADP-DS',
            tolerance: 'intersect',
            over: function (_event, ui) {
                $(this).addClass('DADP-Over');
                ui.draggable.css('z-index', 1000);
            },
            out: function () {
                $(this).removeClass('DADP-Over');
            },
            drop: function (_e, ui) {
                $(this).removeClass('DADP-Over');
                const $dragged = $(ui.draggable);
                const $target = $(this);
                $eXeDragDrop.moveCard($dragged, $target, instance);
            },
        });

        $dadPGameContainer.on('click', '.DADP-TAudio', function (event) {
            event.preventDefault();
            event.stopPropagation();
            const data = $(this).data('audio');
            if (data && data.length > 3) {
                $exeDevices.iDevice.gamification.media.playSound(
                    data,
                    mOptions
                );
            }
        });
        $dadPGameContainer
            .find('.DADP-Card1')
            .on('mousedown touchstart', function (event) {
                event.preventDefault();
                if (mOptions.gameStarted) {
                    $eXeDragDrop.checkAudio(this, instance);
                }
            });
    },

    createInterfaceCards: function (instance) {
        const path = $eXeDragDrop.idevicePath,
            msgs = $eXeDragDrop.options[instance].msgs,
            mOptions = $eXeDragDrop.options[instance],
            html = `
        <div class="DADP-MainContainer" id="dadPMainContainer-${instance}">
            <div class="DADP-GameMinimize" id="dadPGameMinimize-${instance}">
                <a href="#" class="DADP-LinkMaximize" id="dadPLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                    <img src="${path}dragdropIcon.png" class="DADP-IconMinimize DADP-Activo" alt="">
                    <div class="DADP-MessageMaximize" id="dadPMessageMaximize-${instance}">${msgs.msgPlayStart}</div>
                </a>
            </div>
            <div class="DADP-GameContainer DADP-GameContainer-${instance}" id="dadPGameContainer-${instance}">
                <div class="DADP-GameScoreBoard" id="dadPGameScoreBoard-${instance}">
                    <div class="DADP-GameScores" id="dadPGameScores-${instance}">
                        <div class="exeQuextIcons exeQuextIcons-Number" id="dadPPNumberIcon-${instance}" title="${msgs.msgNumQuestions}"></div>
                        <p><span class="sr-av">${msgs.msgNumQuestions}: </span><span id="dadPPNumber-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                        <p><span class="sr-av">${msgs.msgHits}: </span><span id="dadPPHits-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Error" title="${msgs.msgErrors}"></div>
                        <p><span class="sr-av">${msgs.msgErrors}: </span><span id="dadPPErrors-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Score" title="${msgs.msgScore}"></div>
                        <p><span class="sr-av">${msgs.msgScore}: </span><span id="dadPPScore-${instance}">0</span></p>
                    </div>
                    <div class="DADP-Info" id="dadPInfo-${instance}"></div>
                    <div class="DADP-TimeNumber">
                        <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                        <div class="exeQuextIcons exeQuextIcons-Time" style="display:none" id="dadPImgTime-${instance}" title="${msgs.msgTime}"></div>
                        <p id="dadPPTime-${instance}" style="display:none" class="DADP-PTime">00:00</p>
                        <a href="#" class="DADP-LinkMinimize" id="dadPLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                            <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Minimize DADP-Activo"></div>
                        </a>
                        <a href="#" class="DADP-LinkFullScreen" id="dadPLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                            <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-FullScreen DADP-Activo" id="dadPFullScreen-${instance}"></div>
                        </a>
                    </div>
                </div>
                <div class="DADP-Information">
                    <a href="#" style="display:none" id="dadPStartGame-${instance}">${msgs.msgPlayStart}</a>
                    <p class="DADP-Message" id="dadPMessage-${instance}"></p>
                </div>
                <div id="dadPButtons-${instance}" class="DADP-Buttons">
                    <a href="#" class="DADP-ResetButton" id="dadPResetButton-${instance}">${msgs.msgRestart}</a>
                    <a href="#" class="DADP-CheckButton" id="dadPCheckButton-${instance}">${msgs.msgCheck}</a>
                </div>
                <div class="DADP-Multimedia" id="dadPMultimedia-${instance}">
                    <div class="DADP-Main">
                        <div id="dadPContainerGame-${instance}" class="DADP-ContainerGame" style="display:block">
                            <div id="dadPDragTargetsContainer-${instance}" class="DADP-ContainerDrags"></div>
                            <div id="dadPDragSourcesContainer-${instance}" class="DADP-ContainerDrags"></div>
                        </div>
                    </div>                        
                </div>
                <div class="DADP-AuthorGame" id="dadPAuthorGame-${instance}"></div>
            </div>
            <div class="DADP-Cover" id="dadPCubierta-${instance}">
                <div class="DADP-CodeAccessDiv" id="dadPCodeAccessDiv-${instance}">
                    <div class="DADP-MessageCodeAccessE" id="dadPMesajeAccesCodeE-${instance}"></div>
                    <div class="DADP-DataCodeAccessE">
                        <label class="sr-av">${msgs.msgCodeAccess}:</label>
                        <input type="text" class="DADP-CodeAccessE form-control" id="dadPCodeAccessE-${instance}" placeholder="${msgs.msgCodeAccess}">
                        <a href="#" id="dadPCodeAccessButton-${instance}" title="${msgs.msgSubmit}">
                            <strong><span class="sr-av">${msgs.msgSubmit}</span></strong>
                            <div class="exeQuextIcons-Submit DADP-Activo"></div>
                        </a>
                    </div>
                </div>
                <div class="DADP-ShowClue" id="dadPShowClue-${instance}">
                    <p class="sr-av">${msgs.msgClue}</p>
                    <p class="DADP-PShowClue" id="dadPPShowClue-${instance}"></p>
                    <a href="#" class="DADP-ClueBotton" id="dadPClueButton-${instance}" title="${msgs.msgClose}">${msgs.msgClose}</a>
                </div>
            </div>
        </div>
       ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}
    `;
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

    moveCard: function ($item, $container, instance) {
        let mOptions = $eXeDragDrop.options[instance],
            correctAnswer = false,
            isImageMode = mOptions.typeDrag === 0;

        const id = $item.data('id'),
            itemState = $item.data('state'),
            idt = $container.data('id');

        $container.css({
            'z-index': '1',
        });

        if (mOptions.type == 0 && (itemState !== 2 || id != idt)) return;

        $item.css({
            top: '',
            left: '',
            position: '',
            'z-index': '',
        });

        const $existingItem = $container.find('.DADP-DS'),
            existingCardId = $existingItem.data('id'),
            $parentSourceContainer = $(
                `#dadPDragSourcesContainer-${instance} .DADP-DragSourceContainer[data-id='${id}']`
            );

        $parentSourceContainer.hide();

        if ($existingItem.length > 0 && mOptions.type > 0) {
            const media = $(
                `#dadPDragSourcesContainer-${instance} .DADP-MediaSourceDiv[data-id='${existingCardId}']`
            );
            const text = $(
                `#dadPDragSourcesContainer-${instance} .DADP-TextSourceDiv[data-id='${existingCardId}']`
            );
            const $originalContainer = isImageMode ? media : text;
            $parentOriginalSourceContainer = $(
                `#dadPDragSourcesContainer-${instance} .DADP-DragSourceContainer[data-id='${existingCardId}']`
            );

            if ($originalContainer.length === 1) {
                $existingItem.data('state', '2');
                $originalContainer.append($existingItem);
                $parentOriginalSourceContainer.css({ display: 'flex' });
            }
        }

        let $target =
            mOptions.typeDrag == 0
                ? $container.find('.DADP-MediaTargetDiv').first()
                : $container.find('.DADP-TextTargetDiv').first();

        $target.append($item);
        $item.data('state', '1');

        if (mOptions.type === 0) {
            $item.draggable('destroy');
        }

        if (id === idt) {
            correctAnswer = true;
            type = 2;
            $item.data('state', '0');
        }

        if (mOptions.type == 0) {
            if (correctAnswer) {
                $item.addClass('DADP-CardOK');
            } else {
                $item.addClass('DADP-CardKO');
            }
        }

        const html = $('#dadPGameContainer-' + instance).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);
        if (latex) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '#dadPGameContainer-' + instance
            );
        }

        if (mOptions.type == 0) {
            mOptions.hits++;
            if (mOptions.hits >= mOptions.realNumberCards) {
                $eXeDragDrop.checkState(instance);
            }
            if (mOptions.typeDrag == 1 && correctAnswer) {
                const $existingAudio = $container
                    .closest('.DADP-DragTargetContainer')
                    .find('.DADP-TAudio');
                if ($existingAudio.length == 1) {
                    let data = $existingAudio.data('audio');
                    if (data && data.length > 3) {
                        $exeDevices.iDevice.gamification.media.playSound(
                            data,
                            mOptions
                        );
                    }
                }
            }
        }
    },

    gameOver: function (instance) {
        $eXeDragDrop.checkState(instance);
    },

    showScoreFooter: function (instance) {
        const mOptions = $eXeDragDrop.options[instance],
            score = (mOptions.hits * 10) / mOptions.realNumberCards,
            formattedScore = Number(score).toFixed(2);

        $(`#dadPRepeatActivity-${instance}`).text(
            `${mOptions.msgs.msgYouScore}: ${formattedScore}`
        );

        return formattedScore;
    },

    showScoreGame: function (instance) {
        const mOptions = $eXeDragDrop.options[instance],
            msgs = mOptions.msgs,
            score = ((mOptions.hits * 10) / mOptions.numberCards).toFixed(2);
        let message = msgs.msgEndGameM.replace('%s', score),
            messageColor = score >= 5 ? 2 : 1,
            clueMessage = '';

        $eXeDragDrop.showMessage(messageColor, message, instance, true);

        if (mOptions.itinerary.showClue) {
            if (score * 100 > mOptions.itinerary.percentageClue) {
                clueMessage = mOptions.itinerary.clueGame;
            } else {
                clueMessage = msgs.msgTryAgain.replace(
                    '%s',
                    mOptions.itinerary.percentageClue
                );
            }
            $eXeDragDrop.showMessage(3, clueMessage, instance, true);
        }

        const sscore = (
            (mOptions.hits * 10) /
            mOptions.cardsGame.length
        ).toFixed(2);
        $(`#dadPPScore-${instance}`).text(sscore);
        $(`#dadPPHits-${instance}`).text(mOptions.hits);
        $(`#dadPPErrors-${instance}`).text(mOptions.errors);
        $(`#dadPPNumber-${instance}`).text(
            mOptions.realNumberCards - mOptions.hits - mOptions.errors
        );
    },

    showClue: function (instance) {
        const mOptions = $eXeDragDrop.options[instance],
            percentageHits = (mOptions.hits * 10) / mOptions.cardsGame.length;
        if (mOptions.itinerary.showClue) {
            if (percentageHits >= mOptions.itinerary.percentageClue) {
                if (!mOptions.obtainedClue) {
                    mOptions.obtainedClue = true;
                    const msg = `${mOptions.msgs.msgInformation}: ${mOptions.itinerary.clueGame}`;
                    $(`#dadPPShowClue-${instance}`).text(msg);
                    $(`#dadPShowClue-${instance}`).show();
                    $(`#dadPCubierta-${instance}`).show();
                }
            }
        }
    },

    reboot: function (instance) {
        const mOptions = $eXeDragDrop.options[instance];
        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.active = 0;
        mOptions.obtainedClue = false;
        $eXeDragDrop.rebootDrags(instance);
        $eXeDragDrop.showScoreGame(instance);
        mOptions.gameStarted = true;
        mOptions.gameOver = false;

        $('#dadPMessage-' + instance).hide();
    },

    rebootDrags: function (instance) {
        const mOptions = $eXeDragDrop.options[instance];
        $eXeDragDrop.createDrags(instance);
        mOptions.counter = 0;
        if (mOptions.type == 2) {
            mOptions.counter = mOptions.time * 60;
        }
        $eXeDragDrop.startGame(instance);
    },

    checkState: function (instance) {
        const mOptions = $eXeDragDrop.options[instance];

        if (typeof mOptions === 'undefined') return;

        clearInterval(mOptions.counterClock);
        mOptions.gameOver = true;
        mOptions.gameStarted = false;
        if (mOptions.type !== 0) {
            $eXeDragDrop.checkStateDrags(instance);
        }

        $(`#dadPCheckButton-${instance}`).hide();
        $(`#dadPButtons-${instance}`).css('display', 'flex');
        $(`#dadPResetButton-${instance}`).show();

        $exeDevices.iDevice.gamification.media.stopSound(mOptions);
        $eXeDragDrop.showScoreGame(instance);
        $eXeDragDrop.saveEvaluation(instance, true);

        if (mOptions.isScorm === 1) {
            $eXeDragDrop.sendScore(true, instance);
        }
    },
    checkStateDrags: function (instance) {
        const mOptions = $eXeDragDrop.options[instance],
            $sc = $('#dadPGameContainer-' + instance).find('.DADP-DS');

        $sc.removeClass('DADP-CardOK DADP-CardKO');

        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;

        $sc.each(function () {
            let state = $(this).data('state');
            if (state == '0') {
                $(this).addClass('DADP-CardOK');
                mOptions.hits++;
            } else {
                mOptions.errors++;
                $(this).addClass('DADP-CardKO');
            }
            $sc.css({
                cursor: 'default',
            });
            $sc.find('img').css({
                cursor: 'default',
            });

            if ($(this).draggable('instance')) {
                $(this).draggable('destroy');
            }
        });
    },

    removeEvents: function (instance) {
        const $dadPGameContainer = $('#dadPGameContainer-' + instance);
        $('#dadPLinkMaximize-' + instance).off('click');
        $('#dadPLinkMinimize-' + instance).off('click');
        $('#dadPCodeAccessButton-' + instance).off('click');
        $('#dadPCodeAccessE-' + instance).off('keydown');
        $(window).off('unload.eXeDragDrop beforeunload.eXeDragDrop');
        $('#dadPMainContainer-' + instance)
            .closest('.idevice_node')
            .off('click', '.Games-SendScore');
        $('#dadPClueButton-' + instance).off('click');
        $('#dadPStartGame-' + instance).off('click');
        $('#dadPLinkFullScreen-' + instance).off('click');
        $('#dadPResetButton-' + instance).off('click');
        $('#dadPCheckButton-' + instance).off('click');

        $dadPGameContainer.off('click', '.DADP-TAudio');
        $dadPGameContainer.off('click', '.DADP-FullLinkImage');
    },

    addEvents: function (instance) {
        const mOptions = $eXeDragDrop.options[instance];
        const $dadPGameContainer = $('#dadPGameContainer-' + instance);

        $eXeDragDrop.removeEvents(instance);

        $('#dadPLinkMaximize-' + instance).on('click', function (e) {
            e.preventDefault();
            $dadPGameContainer.show();
            if (!mOptions.gameStarted && !mOptions.gameOver) {
                $eXeDragDrop.startGame(instance);
            }
            $('#dadPGameMinimize-' + instance).hide();
        });

        $('#dadPLinkMinimize-' + instance).on('click', function (e) {
            e.preventDefault();
            $dadPGameContainer.hide();
            $('#dadPGameMinimize-' + instance)
                .css('visibility', 'visible')
                .show();
        });

        $('#dadPCubierta-' + instance).hide();
        $('#dadPCodeAccessDiv-' + instance).hide();

        if (mOptions.itinerary.showCodeAccess) {
            $('#dadPMesajeAccesCodeE-' + instance).text(
                mOptions.itinerary.messageCodeAccess
            );
            $('#dadPCodeAccessDiv-' + instance).show();
            $('#dadPShowClue-' + instance).hide();
            $('#dadPCubierta-' + instance).show();
        }

        $('#dadPCodeAccessButton-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeDragDrop.enterCodeAccess(instance);
        });

        $('#dadPCodeAccessE-' + instance).on('keydown', function (event) {
            if (event.which == 13 || event.keyCode == 13) {
                $eXeDragDrop.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        $('#dadPPNumber-' + instance).text(mOptions.realNumberCards);

        $(window).on(
            'unload.eXeDragDrop beforeunload.eXeDragDrop',
            function () {
                if ($eXeDragDrop.mScorm) {
                    $exeDevices.iDevice.gamification.scorm.endScorm(
                        $eXeDragDrop.mScorm
                    );
                }
            }
        );

        $('#dadPMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $eXeDragDrop.sendScore(false, instance);
                $eXeDragDrop.saveEvaluation(instance);
            });

        $('#dadPClueButton-' + instance).on('click', function (e) {
            e.preventDefault();
            $('#dadPShowClue-' + instance).hide();
            $('#dadPCubierta-' + instance).fadeOut();
        });

        $('#dadPPErrors-' + instance).text(mOptions.errors);
        if (mOptions.author.trim().length > 0 && !mOptions.fullscreen) {
            $('#dadPAuthorGame-' + instance).html(
                mOptions.msgs.msgAuthor + ': ' + mOptions.author
            );
            $('#dadPAuthorGame-' + instance).show();
        }

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        $('#dadPStartGame-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeDragDrop.startGame(instance);
        });

        $('#dadPLinkFullScreen-' + instance).on('click', function (e) {
            e.preventDefault();
            const element = document.getElementById(
                'dadPGameContainer-' + instance
            );
            $exeDevices.iDevice.gamification.helpers.toggleFullscreen(element);
        });

        $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
            mOptions,
            this.isInExe
        );

        $('#dadPResetButton-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeDragDrop.reboot(instance);
        });

        $('#dadPCheckButton-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeDragDrop.checkState(instance);
        });

        $dadPGameContainer.on('click', '.DADP-TAudio', function () {
            if (!mOptions.gameStarted || mOptions.gameOver) return;
            const audio = $(this).data('audio');
            if (audio && audio.length > 3)
                $exeDevices.iDevice.gamification.media.playSound(
                    audio,
                    mOptions
                );
        });

        $(`#dadPContainerGame-${instance}`).hide();
        $dadPGameContainer.on('click', '.DADP-FullLinkImage', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const largeImageSrc = $(this).data('url');
            if (largeImageSrc && largeImageSrc.length > 3) {
                $exeDevices.iDevice.gamification.helpers.showFullscreenImage(
                    largeImageSrc,
                    $dadPGameContainer
                );
            }
        });

        mOptions.gameOver = false;
        if (mOptions.type < 2 && !mOptions.itinerary.showCodeAccess) {
            $eXeDragDrop.startGame(instance);
        }
    },

    refreshGame: function (instance) {
        const mOptions = $eXeDragDrop.options[instance];
        if (!mOptions) return;
        mOptions.fullscreen = !(
            !document.fullscreenElement &&
            !document.mozFullScreenElement &&
            !document.webkitFullscreenElement &&
            !document.msFullscreenElement
        );
    },

    showAutorImage: function ($this, instance) {
        const mOptions = $eXeDragDrop.options[instance],
            author = $this.data('author'),
            $dadPAuthorGameSelector = `#dadPAuthorGame-${instance}`;
        if (author && author.length > 0) {
            $($dadPAuthorGameSelector)
                .html(`${mOptions.msgs.msgAuthor}: ${author}`)
                .show();
        }
    },

    hideAutorImage: function ($this, instance) {
        const mOptions = $eXeDragDrop.options[instance],
            author = $this.data('author'),
            $dadPAuthorGameSelector = `#dadPAuthorGame-${instance}`;
        if (mOptions.author && mOptions.author.length > 0) {
            $($dadPAuthorGameSelector)
                .html(`${mOptions.msgs.msgAuthor}: ${author}`)
                .show();
        } else {
            $($dadPAuthorGameSelector).hide();
        }
    },

    isMobile: function () {
        return /Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(
            navigator.userAgent
        );
    },

    enterCodeAccess: function (instance) {
        const mOptions = $eXeDragDrop.options[instance],
            codeInput = $(`#dadPCodeAccessE-${instance}`).val().toLowerCase(),
            codeAccess = mOptions.itinerary.codeAccess.toLowerCase();

        if (codeAccess === codeInput) {
            $(
                `#dadPCodeAccessDiv-${instance}, #dadPCubierta-${instance}`
            ).hide();
            $(`#dadPLinkMaximize-${instance}`).trigger('click');
        } else {
            $(`#dadPMesajeAccesCodeE-${instance}`)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $(`#dadPCodeAccessE-${instance}`).val('');
        }
    },

    updateScore: function (correctAnswer, instance) {
        const mOptions = $eXeDragDrop.options[instance];
        let obtainedPoints = 0;

        if (correctAnswer) {
            mOptions.hits++;
            obtainedPoints = 10 / mOptions.realNumberCards;
        } else {
            mOptions.errors++;
        }
        mOptions.score = Math.max(mOptions.score + obtainedPoints, 0);
        const sscore = mOptions.score.toFixed(2);

        $(`#dadPPScore-${instance}`).text(sscore);
        $(`#dadPPHits-${instance}`).text(mOptions.hits);
        $(`#dadPPErrors-${instance}`).text(mOptions.errors);
        $(`#dadPPNumber-${instance}`).text(
            mOptions.realNumberCards - mOptions.hits - mOptions.errors
        );
    },

    showMessage: function (type, message, instance) {
        const colors = [
                '#555555',
                $eXeDragDrop.borderColors.red,
                $eXeDragDrop.borderColors.green,
                $eXeDragDrop.borderColors.blue,
                $eXeDragDrop.borderColors.yellow,
            ],
            color = colors[type],
            $dadPMessage = $(`#dadPMessage-${instance}`);
        $dadPMessage
            .html(message)
            .css({ color: color, 'font-style': 'bold' })
            .show();
    },

    saveEvaluation: function (instance) {
        const mOptions = $eXeDragDrop.options[instance];
        mOptions.scorerp = (mOptions.hits * 10) / mOptions.realNumberCards;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $eXeDragDrop.isInExe
        );
    },

    sendScore: function (auto, instance) {
        const mOptions = $eXeDragDrop.options[instance];
        mOptions.scorerp = score =
            (mOptions.hits * 10) / mOptions.realNumberCards;
        mOptions.previousScore = $eXeDragDrop.previousScore;
        mOptions.userName = $eXeDragDrop.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $eXeDragDrop.previousScore = mOptions.previousScore;
    },
};
$(function () {
    $eXeDragDrop.init();
});
