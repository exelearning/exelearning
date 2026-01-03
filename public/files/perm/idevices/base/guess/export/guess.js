/* eslint-disable no-undef */
/**
 * Adivina activity (Export)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Author: Ignacio Gros
 * Ricardo Málaga Floriano
 * Ana María Zamora Moreno
 * Iconos_: Francisco Javier Pulido
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 *
 */
var $guess = {
    idevicePath: '',
    borderColors: $exeDevices.iDevice.gamification.colors.borderColors,
    colors: $exeDevices.iDevice.gamification.colors.backColor,
    options: [],
    hasSCORMbutton: false,
    isInExe: false,
    userName: '',
    previousScore: '',
    initialScore: '',
    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',
    mScorm: null,
    hasVideo: false,
    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            'Guess',
            'guess',
            'adivina-IDevice'
        );
    },

    enable: function () {
        $guess.loadGame();
    },

    loadGame: function () {
        $guess.options = [];
        $guess.activities.each(function (i) {
            const id = $(this).closest('.idevice_node').attr('id');

            const version = $('.adivina-version', this).eq(0).text(),
                dl = $('.adivina-DataGame', this),
                imagesLink = $('.adivina-LinkImages', this),
                audioLink = $('.adivina-LinkAudios', this),
                mOption = $guess.loadDataGame(
                    dl,
                    imagesLink,
                    audioLink,
                    version
                ),
                msg = mOption.msgs.msgPlayStart;

            mOption.id = id;
            mOption.scorerp = 0;
            mOption.idevicePath = $guess.idevicePath;
            mOption.main = 'adivinaMainContainer-' + i;
            mOption.idevice = 'adivina-IDevice';

            $guess.options.push(mOption);

            const adivina = $guess.createInterfaceAdivina(i);
            dl.before(adivina).remove();

            $('#adivinaGameMinimize-' + i).hide();
            $('#adivinaGameContainer-' + i).hide();
            if (mOption.showMinimize) {
                $('#adivinaGameMinimize-' + i)
                    .css({
                        cursor: 'pointer',
                    })
                    .show();
            } else {
                $('#adivinaGameContainer-' + i).show();
            }
            $('#adivinaMessageMaximize-' + i).text(msg);
            $('#adivinaDivFeedBack-' + i).prepend(
                $('.adivina-feedback-game', this)
            );
            $guess.addEvents(i);
            $('#adivinaDivFeedBack-' + i).hide();
            $('#adivinaDivFeedBack-' + i).hide();
        });

        let node = document.querySelector('.page-content');
        if (this.isInExe) {
            node = document.getElementById('node-content');
        }
        if (node)
            $exeDevices.iDevice.gamification.observers.observeResize(
                $guess,
                node
            );

        $exeDevices.iDevice.gamification.math.updateLatex('.adivina-IDevice');

        if ($guess.hasVideo) $guess.loadApiPlayer();
    },
    loadApiPlayer: function () {
        if (!this.hasVideo) return;

        $exeDevices.iDevice.gamification.media.YouTubeAPILoader.load()
            .then(() => this.activatePlayer())
            .catch(() => this.showStartedButton());
    },

    activatePlayer: function () {
        this.options.forEach((mOptions, i) => {
            if (mOptions.hasVideo && mOptions.player === null) {
                mOptions.player = new YT.Player(`adivinaVideo-${i}`, {
                    width: '100%',
                    height: '100%',
                    videoId: '',
                    playerVars: {
                        color: 'white',
                        autoplay: 0,
                        controls: 0,
                    },
                    events: {
                        onReady: $guess.onPlayerReady,
                    },
                });
                const $videoElement = $(`adivinaVideo-${i}`);
                if ($videoElement.length === 1) {
                    $videoElement.hide();
                }
            }
        });
    },

    youTubeReady: function () {
        this.activatePlayer();
    },

    showStartedButton: function () {
        $guess.options.forEach((option, i) => {
            if (!option.gameStarted && !option.gameOver) {
                $(`#adivinaStartGame-${i}`).show();
                $guess.showMessage(1, '', i);
            }
        });
    },

    onPlayerReady: function (event) {
        const iframe = event.target.getIframe();
        if (iframe && iframe.id) {
            const [prefix, instanceStr] = iframe.id.split('-');
            if (prefix === 'adivinaVideo') {
                const instance = parseInt(instanceStr, 10);
                if (!isNaN(instance)) {
                    $(`#adivinaStartGame-${instance}`).show();
                    $guess.showMessage(1, '', instance);
                } else {
                    console.warn(
                        `Número de instancia inválido para ${iframe.id}`
                    );
                }
            }
        } else {
            console.warn('No se pudo identificar el iframe del reproductor');
        }
    },

    updateSoundVideo: function (instance) {
        const mOptions = $guess.options[instance];
        if (
            mOptions.activeSilent &&
            mOptions.player &&
            typeof mOptions.player.getCurrentTime === 'function'
        ) {
            const time = Math.round(mOptions.player.getCurrentTime());
            if (time == mOptions.question.silentVideo) {
                mOptions.player.mute();
            } else if (time == mOptions.endSilent) {
                mOptions.player.unMute();
            }
        }
    },

    loadDataGame: function (data, imgsLink, audioLink, version) {
        let json = data.text();
        version =
            typeof version === 'undefined' || version === ''
                ? 0
                : parseInt(version, 10);

        if (version > 0)
            json = $exeDevices.iDevice.gamification.helpers.decrypt(json);

        const mOptions =
            $exeDevices.iDevice.gamification.helpers.isJsonString(json);

        Object.assign(mOptions, {
            hasVideo: false,
            waitStart: false,
            player: null,
            percentajeQuestions:
                mOptions.percentajeQuestions !== undefined
                    ? mOptions.percentajeQuestions
                    : 100,
            modeBoard:
                mOptions.modeBoard !== undefined ? mOptions.modeBoard : false,
            evaluation:
                mOptions.evaluation !== undefined ? mOptions.evaluation : false,
            evaluationID:
                mOptions.evaluationID !== undefined
                    ? mOptions.evaluationID
                    : '',
            id: mOptions.id !== undefined ? mOptions.id : false,
            playerAudio: '',
            gameMode: mOptions.gameMode !== undefined ? mOptions.gameMode : 0,
            percentajeFB:
                mOptions.percentajeFB !== undefined
                    ? mOptions.percentajeFB
                    : 100,
            customMessages:
                mOptions.customMessages !== undefined
                    ? mOptions.customMessages
                    : false,
            gameOver: false,
        });

        mOptions.useLives = mOptions.gameMode !== 0 ? false : mOptions.useLives;

        for (let i = 0; i < mOptions.wordsGame.length; i++) {
            let p = mOptions.wordsGame[i];

            if (p.type !== 2) {
                p.url = $exeDevices.iDevice.gamification.media.extractURLGD(
                    p.url
                );
            }

            if (version < 2) {
                if (p.type === 2) {
                    p.type = 1;
                }
                Object.assign(p, {
                    iVideo: 0,
                    fVideo: 0,
                    eText: '',
                    silentVideo: 0,
                    tSilentVideo: 0,
                    audio: '',
                    soundVideo: 1,
                    imageVideo: 1,
                    percentageShow:
                        mOptions.percentageShow !== undefined
                            ? mOptions.percentageShow
                            : 35,
                    time:
                        mOptions.timeQuestion !== undefined
                            ? mOptions.timeQuestion
                            : 1,
                });
            }

            const idyt = $exeDevices.iDevice.gamification.media.getIDYoutube(
                p.url
            );
            if (p.type === 2 && idyt) {
                mOptions.hasVideo = true;
                $guess.hasVideo = true;
            }

            p.time = Math.max(0, p.time);
        }

        if (
            $exeDevices.iDevice.gamification.media.getIDYoutube(
                mOptions.idVideo
            )
        ) {
            mOptions.hasVideo = true;
            $guess.hasVideo = true;
        }

        imgsLink.each(function () {
            const iq = parseInt($(this).text(), 10);
            if (!isNaN(iq) && iq < mOptions.wordsGame.length) {
                const wordGame = mOptions.wordsGame[iq];
                wordGame.url = $(this).attr('href');
                if (wordGame.url.length < 4 && wordGame.type === 1) {
                    wordGame.url = '';
                }
            }
        });

        audioLink.each(function () {
            const iq = parseInt($(this).text(), 10);
            if (!isNaN(iq) && iq < mOptions.wordsGame.length) {
                const wordGame = mOptions.wordsGame[iq];
                wordGame.audio = $(this).attr('href');
                if (wordGame.audio.length < 4) {
                    wordGame.audio = '';
                }
            }
        });

        mOptions.wordsGame =
            $exeDevices.iDevice.gamification.helpers.getQuestions(
                mOptions.wordsGame,
                mOptions.percentajeQuestions
            );
        mOptions.wordsGame =
            mOptions.optionsRamdon && mOptions.percentajeQuestions === 100
                ? $exeDevices.iDevice.gamification.helpers.shuffleAds(
                      mOptions.wordsGame
                  )
                : mOptions.wordsGame;
        mOptions.numberQuestions = mOptions.wordsGame.length;

        return mOptions;
    },

    createInterfaceAdivina: function (instance) {
        const path = $guess.idevicePath,
            msgs = $guess.options[instance].msgs,
            mOptions = $guess.options[instance],
            html = `
        <div class="ADVNP-MainContainer" id="adivinaMainContainer-${instance}">
            <div class="ADVNP-GameMinimize" id="adivinaGameMinimize-${instance}">
                <a href="#" class="ADVNP-LinkMaximize" id="adivinaLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                    <img src="${path}adivinaIcon.png" class="ADVNP-IconMinimize ADVNP-Activo" alt="">
                    <div class="ADVNP-MessageMaximize" id="adivinaMessageMaximize-${instance}"></div>
                </a>
            </div>
            <div class="ADVNP-GameContainer" id="adivinaGameContainer-${instance}">
                <div class="ADVNP-GameScoreBoard">
                    <div class="ADVNP-GameScores">
                        <div class="exeQuextIcons exeQuextIcons-Number" title="${msgs.msgNumQuestions}"></div>
                        <p><span class="sr-av">${msgs.msgNumQuestions}: </span><span id="adivinaPNumber-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                        <p><span class="sr-av">${msgs.msgHits}: </span><span id="adivinaPHits-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Error" title="${msgs.msgErrors}"></div>
                        <p><span class="sr-av">${msgs.msgErrors}: </span><span id="adivinaPErrors-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Score" title="${msgs.msgScore}"></div>
                        <p><span class="sr-av">${msgs.msgScore}: </span><span id="adivinaPScore-${instance}">0</span></p>
                    </div>
                    <div class="ADVNP-LifesGame" id="adivinaLifesAdivina-${instance}">
                        <strong class="sr-av">${msgs.msgLive}</strong>
                        <div class="exeQuextIcons exeQuextIcons-Life" title="${msgs.msgLive}"></div>
                        <strong class="sr-av">${msgs.msgLive}</strong>
                        <div class="exeQuextIcons exeQuextIcons-Life" title="${msgs.msgLive}"></div>
                        <strong class="sr-av">${msgs.msgLive}</strong>
                        <div class="exeQuextIcons exeQuextIcons-Life" title="${msgs.msgLive}"></div>
                        <strong class="sr-av">${msgs.msgLive}</strong>
                        <div class="exeQuextIcons exeQuextIcons-Life" title="${msgs.msgLive}"></div>
                        <strong class="sr-av">${msgs.msgLive}</strong>
                        <div class="exeQuextIcons exeQuextIcons-Life" title="${msgs.msgLive}"></div>
                    </div>
                    <div class="ADVNP-NumberLifesGame" id="adivinaNumberLivesAdivina-${instance}">
                        <strong class="sr-av">${msgs.msgLive}</strong>
                        <div class="exeQuextIcons exeQuextIcons-Life"></div>
                        <p id="adivinaPLifes-${instance}">0</p>
                    </div>
                    <div class="ADVNP-TimeNumber">
                        <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                        <div class="exeQuextIcons exeQuextIcons-Time" title="${msgs.msgTime}"></div>
                        <p id="adivinaPTime-${instance}" class="ADVNP-PTime">00:00</p>
                        <a href="#" class="ADVNP-LinkMinimize" id="adivinaLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                            <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Minimize ADVNP-Activo"></div>
                        </a>
                        <a href="#" class="ADVNP-LinkFullScreen" id="adivinaLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                            <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-FullScreen ADVNP-Activo" id="adivinaFullScreen-${instance}"></div>
                        </a>
                    </div>
                </div>
                <div class="ADVNP-ShowClue">
                    <div class="sr-av">${msgs.msgClue}</div>
                    <p class="ADVNP-PShowClue ADVNP-parpadea" id="adivinaPShowClue-${instance}"></p>
                </div>
                <div class="ADVNP-Multimedia" id="adivinaMultimedia-${instance}">
                    <img class="ADVNP-Cursor" id="adivinaCursor-${instance}" src="${path}exequextcursor.gif" alt="" />
                    <img src="" class="ADVNP-Images" id="adivinaImage-${instance}" alt="${msgs.msgNoImage}" />
                    <div class="ADVNP-EText" id="adivinaEText-${instance}"></div>
                    <img src="${path}adivinaHome.png" class="ADVNP-Cover" id="adivinaCover-${instance}" alt="${msgs.msgNoImage}" />
                    <div class="ADVNP-Video" id="adivinaVideo-${instance}"></div>
                    <video class="ADVNP-Video" id="adivinaVideoLocal-${instance}" preload="auto" controls></video>
                    <div class="ADVNP-Protector" id="adivinaProtector-${instance}"></div>
                    <a href="#" class="ADVNP-LinkAudio" id="adivinaLinkAudio-${instance}" title="${msgs.msgAudio}">
                        <img src="${path}exequextaudio.png" class="ADVNP-Activo" alt="${msgs.msgAudio}" />
                    </a>
                    <div class="ADVNP-GameOver" id="adivinaGamerOver-${instance}">
                        <div class="ADVNP-DataImage">
                            <img src="${path}exequextwon.png" class="ADVNP-HistGGame" id="adivinaHistGame-${instance}" alt="${msgs.msgAllQuestions}" />
                            <img src="${path}exequextlost.png" class="ADVNP-LostGGame" id="adivinaLostGame-${instance}" alt="${msgs.msgLostLives}" />
                        </div>
                        <div class="ADVNP-DataScore">
                            <p id="adivinaOverScore-${instance}">Score: 0</p>
                            <p id="adivinaOverHits-${instance}">Hits: 0</p>
                            <p id="adivinaOverErrors-${instance}">Errors: 0</p>
                        </div>
                    </div>
                </div>
                <div class="ADVNP-AuthorLicence" id="adivinaAutorLicence-${instance}">
                    <div class="sr-av">${msgs.msgAuthor}:</div>
                    <p id="adivinaPAuthor-${instance}"></p>
                </div>
                <div class="sr-av" id="adivinaStartGameSRAV-${instance}">${msgs.msgPlayStart}:</div>
                <div class="ADVNP-StartGame">
                    <a href="#" id="adivinaStartGame-${instance}"></a>
                </div>
                <div class="ADVNP-QuestionDiv" id="adivinaQuestion-${instance}">
                    <div class="sr-av">${msgs.msgAnswer}:</div>
                    <div class="ADVNP-Prhase" id="adivinaEPhrase-${instance}"></div>
                    <div class="sr-av">${msgs.msgQuestion}:</div>
                    <div class="ADVNP-Question" id="adivinaDefinition-${instance}"></div>
                    <div class="ADVNP-DivReply" id="adivinaDivReply-${instance}">
                        <a href="#" id="adivinaBtnMoveOn-${instance}" title="${msgs.msgMoveOne}">
                            <strong><span class="sr-av">${msgs.msgMoveOne}</span></strong>
                            <div class="exeQuextIcons-MoveOne ADVNP-Activo"></div>
                        </a>
                        <input type="text" value="" class="ADVNP-EdReply form-control" id="adivinaEdAnswer-${instance}" autocomplete="off">
                        <a href="#" id="adivinaBtnReply-${instance}" title="${msgs.msgReply}">
                            <strong><span class="sr-av">${msgs.msgReply}</span></strong>
                            <div class="exeQuextIcons-Submit ADVNP-Activo"></div>
                        </a>
                    </div>
                </div>
                <div class="ADVNP-DivInstructions" id="adivinaDivInstructions-${instance}">${msgs.msgWrote}</div>
                <div class="ADVNP-DivFeedBack" id="adivinaDivFeedBack-${instance}">
                    <input type="button" id="adivinaFeedBackClose-${instance}" value="${msgs.msgClose}" class="feedbackbutton" />
                </div>
                <div class="ADVNP-DivModeBoard" id="adivinaDivModeBoard-${instance}">
                    <a class="ADVNP-ModeBoard" href="#" id="adivinaModeBoardOK-${instance}" title="${msgs.msgCorrect}">${msgs.msgCorrect}</a>
                    <a class="ADVNP-ModeBoard" href="#" id="adivinaModeBoardMoveOn-${instance}" title="${msgs.msgMoveOne}">${msgs.msgMoveOne}</a>
                    <a class="ADVNP-ModeBoard" href="#" id="adivinaModeBoardKO-${instance}" title="${msgs.msgIncorrect}">${msgs.msgIncorrect}</a>
                </div>               
            </div>
             <div class="ADVNP-Cubierta" id="adivinaCubierta-${instance}" style="display:none">
                <div class="ADVNP-CodeAccessDiv" id="adivinaCodeAccessDiv-${instance}">
                    <div class="ADVNP-MessageCodeAccessE" id="adivinaMesajeAccesCodeE-${instance}"></div>
                    <div class="ADVNP-DataCodeAccessE">
                        <label for="adivinaCodeAccessE-${instance}" class="sr-av">${msgs.msgCodeAccess}:</label>
                        <input type="text" class="ADVNP-CodeAccessE form-control" id="adivinaCodeAccessE-${instance}" placeholder="${msgs.msgCodeAccess}">
                        <a href="#" id="adivinaCodeAccessButton-${instance}" title="${msgs.msgReply}">
                            <strong><span class="sr-av">${msgs.msgReply}</span></strong>
                            <div class="exeQuextIcons-Submit ADVNP-Activo"></div>
                        </a>
                    </div>
                </div>
            </div>
        </div>
        ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}
        `;
        return html;
    },

    showCubiertaOptions(mode, instance) {
        if (mode === false) {
            $('#adivinaCubierta-' + instance).fadeOut();
            return;
        }
        $('#adivinaCubierta-' + instance).fadeIn();
    },

    saveEvaluation: function (instance) {
        const mOptions = $guess.options[instance];
        mOptions.scorerp = (mOptions.hits * 10) / mOptions.numberQuestions;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $guess.isInExe
        );
    },

    sendScore: function (auto, instance) {
        const mOptions = $guess.options[instance];

        mOptions.scorerp = (mOptions.hits * 10) / mOptions.numberQuestions;
        mOptions.previousScore = $guess.previousScore;
        mOptions.userName = $guess.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $guess.previousScore = mOptions.previousScore;
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
        $('#adivinaEPhrase-' + instance)
            .find('.ADVNP-Word')
            .remove();
        $('#adivinaBtnReply-' + instance).prop('disabled', true);
        $('#adivinaBtnMoveOn-' + instance).prop('disabled', true);
        $('#adivinaEdAnswer-' + instance).prop('disabled', true);

        if (!casesensitive) phrase = phrase.toUpperCase();

        let cPhrase = $guess.clear(phrase),
            letterShow = $guess.getShowLetter(cPhrase, nivel),
            h = cPhrase.replace(/\s/g, '&'),
            nPhrase = [];
        for (let z = 0; z < h.length; z++) {
            if (h[z] != '&' && letterShow.indexOf(z) == -1) {
                nPhrase.push(' ');
            } else {
                nPhrase.push(h[z]);
            }
        }
        nPhrase = nPhrase.join('');

        let phrase_array = nPhrase.split('&');

        for (let i = 0; i < phrase_array.length; i++) {
            let cleanWord = phrase_array[i];
            if (cleanWord != '') {
                $('<div class="ADVNP-Word"></div>').appendTo(
                    '#adivinaEPhrase-' + instance
                );
                for (let j = 0; j < cleanWord.length; j++) {
                    let letter =
                        '<div class="ADVNP-Letter blue">' +
                        cleanWord[j] +
                        '</div>';
                    if (type == 1) {
                        letter =
                            '<div class="ADVNP-Letter red">' +
                            cleanWord[j] +
                            '</div>';
                    } else if (type == 2) {
                        letter =
                            '<div class="ADVNP-Letter green">' +
                            cleanWord[j] +
                            '</div>';
                    }
                    $('#adivinaEPhrase-' + instance)
                        .find('.ADVNP-Word')
                        .last()
                        .append(letter);
                }
            }
        }

        if (!solution) {
            $('#adivinaDefinition-' + instance).html(definition);
        }

        const html = $('#adivinaDefinition-' + instance).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);
        if (latex) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '#adivinaDefinition-' + instance
            );
        }
        return cPhrase;
    },

    clear: function (phrase) {
        return phrase.replace(/[&\s\n\r]+/g, ' ').trim();
    },

    getShowLetter: function (phrase, nivel) {
        const numberLetter = parseInt((phrase.length * nivel) / 100),
            arrayRandom = [];
        while (arrayRandom.length < numberLetter) {
            let numberRandow = parseInt(Math.random() * phrase.length);
            if (arrayRandom.indexOf(numberRandow) != -1) {
                continue;
            } else {
                arrayRandom.push(numberRandow);
            }
        }
        return arrayRandom.sort();
    },

    addEvents: function (instance) {
        $guess.removeEvents(instance);

        const mOptions = $guess.options[instance],
            $gameContainer = $(`#adivinaGameContainer-${instance}`),
            $gameMinimize = $(`#adivinaGameMinimize-${instance}`),
            $btnReply = $(`#adivinaBtnReply-${instance}`),
            $btnMoveOn = $(`#adivinaBtnMoveOn-${instance}`),
            $edAnswer = $(`#adivinaEdAnswer-${instance}`),
            $definition = $(`#adivinaDefinition-${instance}`),
            $video = $(`#adivinaVideo-${instance}`),
            $videoLocal = $(`#adivinaVideoLocal-${instance}`),
            $gamerOver = $(`#adivinaGamerOver-${instance}`),
            $codeAccessDiv = $(`#adivinaCodeAccessDiv-${instance}`),
            $linkMaximize = $(`#adivinaLinkMaximize-${instance}`),
            $linkMinimize = $(`#adivinaLinkMinimize-${instance}`),
            $phrase = $(`#adivinaEPhrase-${instance}`),
            $startGame = $(`#adivinaStartGame-${instance}`),
            $linkFullScreen = $(`#adivinaLinkFullScreen-${instance}`),
            $feedBackClose = $(`#adivinaFeedBackClose-${instance}`),
            $linkAudio = $(`#adivinaLinkAudio-${instance}`),
            $image = $(`#adivinaImage-${instance}`),
            $divFeedBack = $(`#adivinaDivFeedBack-${instance}`),
            $numberLives = $(`#adivinaNumberLivesAdivina-${instance}`),
            $lifesAdivina = $(`#adivinaLifesAdivina-${instance}`),
            $pNumber = $(`#adivinaPNumber-${instance}`),
            $modeBoardOK = $(`#adivinaModeBoardOK-${instance}`),
            $modeBoardKO = $(`#adivinaModeBoardKO-${instance}`),
            $modeBoardMoveOn = $(`#adivinaModeBoardMoveOn-${instance}`),
            $codeAccessButton = $(`#adivinaCodeAccessButton-${instance}`),
            $codeAccessE = $(`#adivinaCodeAccessE-${instance}`),
            $pShowClue = $(`#adivinaPShowClue-${instance}`),
            $instructions = $(`#adivinaInstructions-${instance}`);

        $linkMaximize.on('click', function (e) {
            e.preventDefault();
            $gameContainer.show();
            $gameMinimize.hide();
        });

        $linkMinimize.on('click', function (e) {
            e.preventDefault();
            $gameContainer.hide();
            $gameMinimize.css('visibility', 'visible').show();
        });

        mOptions.localPlayer = document.getElementById(
            `adivinaVideoLocal-${instance}`
        );

        $phrase.hide();
        $btnReply.hide().prop('disabled', true);
        $btnMoveOn.hide().prop('disabled', true);
        $edAnswer.hide().val('').prop('disabled', true);
        $definition.hide();
        $video.hide();
        $videoLocal.hide();
        $gamerOver.hide();
        $codeAccessDiv.hide();
        $pShowClue.hide();
        $image.hide();

        if (mOptions.gameMode === 2) {
            const $gameContainerIcons = $gameContainer.find(
                '.exeQuextIcons-Hit, .exeQuextIcons-Error, .exeQuextIcons-Score'
            );
            $gameContainerIcons.hide();
            $(
                `#adivinaPErrors-${instance}, #adivinaPHits-${instance}, #adivinaPScore-${instance}`
            ).hide();
        }

        $btnMoveOn.on('click', (e) => {
            e.preventDefault();
            $guess.newQuestion(instance);
        });

        $btnReply.on('click', (e) => {
            e.preventDefault();
            $guess.answerQuestion(instance);
        });

        $linkFullScreen.on('click', (e) => {
            e.preventDefault();
            const element = document.getElementById(
                `adivinaGameContainer-${instance}`
            );
            $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                element,
                instance
            );
        });

        $edAnswer.on('keydown', function (event) {
            if (event.which === 13 || event.keyCode === 13) {
                $guess.answerQuestion(instance);
                return false;
            }
            return true;
        });

        $feedBackClose.on('click', () => {
            $divFeedBack.hide();
        });

        $linkAudio.on('click', (e) => {
            e.preventDefault();
            const audio = mOptions.wordsGame[mOptions.activeQuestion].audio;
            $exeDevices.iDevice.gamification.media.stopSound(mOptions);
            $exeDevices.iDevice.gamification.media.playSound(audio, mOptions);
        });

        $startGame
            .show()
            .text(mOptions.msgs.msgPlayStart)
            .on('click', (e) => {
                e.preventDefault();
                $guess.startGame(instance);
            });

        mOptions.livesLeft = mOptions.numberLives;
        $guess.updateLives(instance);

        if (mOptions.itinerary.showCodeAccess) {
            $(`#adivinaMesajeAccesCodeE-${instance}`).text(
                mOptions.itinerary.messageCodeAccess
            );
            $codeAccessDiv.show();
            $startGame.hide();
            $(
                `#adivinaQuestion-${instance}, #adivinaDefinition-${instance}, #adivinaDivInstructions-${instance}`
            ).hide();
            $guess.showCubiertaOptions(true, instance);
        }

        if (!mOptions.useLives) {
            $lifesAdivina.hide();
            $numberLives.hide();
        }

        $codeAccessButton.on('click', (e) => {
            e.preventDefault();
            $guess.enterCodeAccess(instance);
        });

        $codeAccessE.on('keydown', function (event) {
            if (event.which === 13 || event.keyCode === 13) {
                $guess.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        $pNumber.text(mOptions.numberQuestions);

        $(window).on('unload.eXeAdivina beforeunload.eXeAdivina', function () {
            if (typeof $guess.mScorm !== 'undefined') {
                $exeDevices.iDevice.gamification.scorm.endScorm($guess.mScorm);
            }
        });

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        $instructions.text(mOptions.instructions);

        $('#adivinaMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $guess.sendScore(false, instance);
                $guess.saveEvaluation(instance);
            });

        $modeBoardOK.on('click', (e) => {
            e.preventDefault();
            $guess.answerQuestionBoard(true, instance);
        });

        $modeBoardKO.on('click', (e) => {
            e.preventDefault();
            $guess.answerQuestionBoard(false, instance);
        });

        $modeBoardMoveOn.on('click', (e) => {
            e.preventDefault();
            $guess.newQuestion(instance);
        });
        if (mOptions.hasVideo) {
            $(`#adivinaStartGame-${instance}`).hide();
            $guess.showMessage(1, 'Cargando. Por favor, espere', instance);
        }
        setTimeout(() => {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                this.isInExe
            );
        }, 500);
    },

    removeEvents: function (instance) {
        $(`#adivinaLinkMaximize-${instance}`).off('click');
        $(`#adivinaLinkMinimize-${instance}`).off('click');
        $(`#adivinaBtnMoveOn-${instance}`).off('click');
        $(`#adivinaBtnReply-${instance}`).off('click');
        $(`#adivinaLinkFullScreen-${instance}`).off('click');
        $(`#adivinaEdAnswer-${instance}`).off('keydown');
        $(`#adivinaFeedBackClose-${instance}`).off('click');
        $(`#adivinaLinkAudio-${instance}`).off('click');
        $(`#adivinaStartGame-${instance}`).off('click');
        $(`#adivinaCodeAccessButton-${instance}`).off('click');
        $(`#adivinaCodeAccessE-${instance}`).off('keydown');
        $('#adivinaMainContainer-' + instance)
            .closest('.idevice_node')
            .off('click', '.Games-SendScore');
        $(`#adivinaModeBoardOK-${instance}`).off('click');
        $(`#adivinaModeBoardKO-${instance}`).off('click');
        $(`#adivinaModeBoardMoveOn-${instance}`).off('click');

        $(window).off('unload.eXeAdivina beforeunload.eXeAdivina');
    },

    enterCodeAccess: function (instance) {
        const mOptions = $guess.options[instance];
        if (
            mOptions.itinerary.codeAccess.toLowerCase() ==
            $('#adivinaCodeAccessE-' + instance)
                .val()
                .toLowerCase()
        ) {
            $('#adivinaLinkMaximize-' + instance).trigger('click');
            $guess.showCubiertaOptions(false, instance);
            $guess.startGame(instance);
        } else {
            $('#adivinaMesajeAccesCodeE-' + instance)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $('#adivinaCodeAccessE-' + instance).val('');
        }
    },

    startGame: function (instance) {
        const mOptions = $guess.options[instance],
            $divReply = $(`#adivinaDivReply-${instance}`),
            $divInstructions = $(`#adivinaDivInstructions-${instance}`),
            $startGame = $(`#adivinaStartGame-${instance}`),
            $pShowClue = $(`#adivinaPShowClue-${instance}`),
            $gamerOver = $(`#adivinaGamerOver-${instance}`),
            $pNumber = $(`#adivinaPNumber-${instance}`),
            $pHits = $(`#adivinaPHits-${instance}`),
            $pErrors = $(`#adivinaPErrors-${instance}`),
            $pScore = $(`#adivinaPScore-${instance}`),
            $definition = $(`#adivinaDefinition-${instance}`),
            $btnReply = $(`#adivinaBtnReply-${instance}`),
            $btnMoveOn = $(`#adivinaBtnMoveOn-${instance}`),
            $edAnswer = $(`#adivinaEdAnswer-${instance}`),
            $phrase = $(`#adivinaEPhrase-${instance}`),
            $question = $(`#adivinaQuestion-${instance}`);

        if (mOptions.gameStarted) return;

        $divReply.show();
        $divInstructions.hide();
        $startGame.hide().text(mOptions.msgs.msgPlayStart);

        Object.assign(mOptions, {
            hits: 0,
            errors: 0,
            score: 0,
            gameActived: false,
            activeQuestion: -1,
            validQuestions: mOptions.numberQuestions,
            counter: 0,
            gameOver: false,
            gameStarted: false,
            livesLeft: mOptions.numberLives,
            obtainedClue: false,
        });

        $guess.updateLives(instance);
        $pShowClue.text('');
        $gamerOver.hide();
        $pNumber.text(mOptions.numberQuestions);
        $pHits.text(mOptions.hits);
        $pErrors.text(mOptions.errors);
        $pScore.text(mOptions.score);

        mOptions.counter =
            $exeDevices.iDevice.gamification.helpers.getTimeSeconds(
                mOptions.wordsGame[0].time
            );

        if (mOptions.wordsGame[0].type === 2) {
            const durationVideo =
                mOptions.wordsGame[0].fVideo - mOptions.wordsGame[0].iVideo;
            mOptions.counter += durationVideo;
        }

        mOptions.counterClock = setInterval(() => {
            if (mOptions.gameStarted && mOptions.activeCounter) {
                let $node = $('#adivinaMainContainer-' + instance);
                let $content = $('#node-content');
                if (
                    !$node.length ||
                    ($content.length && $content.attr('mode') === 'edition')
                ) {
                    clearInterval(mOptions.counterClock);
                    return;
                }
                mOptions.counter--;
                $guess.updateTime(mOptions.counter, instance);
                $guess.updateSoundVideo(instance);
                if (mOptions.counter <= 0) {
                    mOptions.activeCounter = false;
                    let timeShowSolution = 1000;
                    if (mOptions.showSolution) {
                        timeShowSolution = mOptions.timeShowSolution * 1000;
                        const question =
                            mOptions.wordsGame[mOptions.activeQuestion];
                        $guess.drawPhrase(
                            question.word,
                            question.definition,
                            100,
                            1,
                            mOptions.caseSensitive,
                            instance,
                            true
                        );
                    }
                    setTimeout(() => {
                        $guess.newQuestion(instance);
                    }, timeShowSolution);
                    return;
                }
            }
        }, 1000);

        $guess.updateTime(mOptions.counter, instance);
        mOptions.gameStarted = true;

        $definition.show();
        $btnReply.show();
        $btnMoveOn.show();
        $edAnswer.show();
        $phrase.show();
        $question.show();

        $guess.newQuestion(instance);
    },

    updateTime: function (tiempo, instance) {
        $('#adivinaPTime-' + instance).text(
            $exeDevices.iDevice.gamification.helpers.getTimeToString(tiempo)
        );
    },

    gameOver: function (type, instance) {
        const mOptions = $guess.options[instance];

        clearInterval(mOptions.counterClock);

        mOptions.gameStarted = false;
        mOptions.gameActived = false;
        mOptions.gameOver = true;

        $guess.showImage('', instance);
        $exeDevices.iDevice.gamification.media.stopSound(mOptions);
        $guess.showScoreGame(type, instance);
        $guess.startVideo('', 0, 0, instance, 0);
        $guess.stopVideo(mOptions);
        $guess.updateTime(0, instance);

        $('#adivinaLinkAudio-' + instance).hide();
        $('#adivinaDivModeBoard-' + instance).hide();
        $('#adivinaEPhrase-' + instance)
            .find('.ADVNP-Word')
            .hide();
        $('#adivinaEdAnswer-' + instance).val('');
        $('#adivinaEdAnswer-' + instance).hide();
        $('#adivinaImage-' + instance).hide();
        $('#adivinaCover-' + instance).hide();
        $('#adivinaVideo-' + instance).hide();
        $('#adivinaVideoLocal-' + instance).hide();
        $('#adivinaStartGame-' + instance).show();
        $('#adivinaBtnReply-' + instance).hide();
        $('#adivinaBtnMoveOn-' + instance).hide();
        $('#adivinaEdAnswer-' + instance).hide();
        $('#adivinaDefinition-' + instance).hide();
        $('#adivinaQuestion-' + instance).hide();

        if (mOptions.isScorm == 1) {
            const score = (
                (mOptions.hits * 10) /
                mOptions.numberQuestions
            ).toFixed(2);
            $guess.sendScore(true, instance);
            $guess.initialScore = score;
        }
        $guess.saveEvaluation(instance);
        $guess.showFeedBack(instance);
    },

    showFeedBack: function (instance) {
        const mOptions = $guess.options[instance],
            points = (mOptions.hits * 100) / mOptions.wordsGame.length;
        if (mOptions.gameMode == 2 || mOptions.feedBack) {
            if (points >= mOptions.percentajeFB) {
                $('#adivinaDivFeedBack-' + instance)
                    .find('.adivina-feedback-game')
                    .show();
                $('#adivinaDivFeedBack-' + instance).show();
            } else {
                $guess.showMessage(
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

    showScoreGame: function (type, instance) {
        const mOptions = $guess.options[instance],
            msgs = mOptions.msgs,
            $adivinaHistGame = $('#adivinaHistGame-' + instance),
            $adivinaLostGame = $('#adivinaLostGame-' + instance),
            $adivinaOverPoint = $('#adivinaOverScore-' + instance),
            $adivinaOverHits = $('#adivinaOverHits-' + instance),
            $adivinaOverErrors = $('#adivinaOverErrors-' + instance),
            $adivinaGamerOver = $('#adivinaGamerOver-' + instance),
            $adivinaPShowClue = $('#adivinaPShowClue-' + instance);

        let message = '',
            messageColor = 1;

        $adivinaHistGame.hide();
        $adivinaLostGame.hide();
        $adivinaOverPoint.show();
        $adivinaOverHits.show();
        $adivinaOverErrors.show();

        let mclue = '';
        switch (parseInt(type)) {
            case 0:
                message = msgs.msgCool + ' ' + msgs.mgsAllQuestions;
                messageColor = 2;
                $adivinaHistGame.show();
                if (mOptions.itinerary.showClue) {
                    const text = $('#adivinaPShowClue-' + instance).text();
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
                message = msgs.msgLostLives;
                $adivinaLostGame.show();
                if (mOptions.itinerary.showClue) {
                    const text = $('#adivinaPShowClue-' + instance).text();
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

        $guess.showMessage(messageColor, message, instance);

        const msscore =
            mOptions.gameMode == 0
                ? msgs.msgScore + ': ' + mOptions.score
                : msgs.msgScore + ': ' + mOptions.score.toFixed(2);
        $adivinaOverPoint.html(msscore);
        $adivinaOverHits.html(msgs.msgHits + ': ' + mOptions.hits);
        $adivinaOverErrors.html(msgs.msgErrors + ': ' + mOptions.errors);

        if (mOptions.gameMode == 2) {
            $('#adivinaGameContainer-' + instance)
                .find('.ADVNP-DataScore')
                .hide();
        }

        $adivinaGamerOver.show();
        $adivinaPShowClue.hide();

        if (mOptions.itinerary.showClue) {
            $adivinaPShowClue.text(mclue);
            $adivinaPShowClue.show();
        }
    },

    showQuestion: function (i, instance) {
        const mOptions = $guess.options[instance],
            q = mOptions.wordsGame[i],
            tiempo = $exeDevices.iDevice.gamification.helpers.getTimeToString(
                $exeDevices.iDevice.gamification.helpers.getTimeSeconds(q.time)
            );

        mOptions.gameActived = true;
        mOptions.question = q;
        $guess.showMessage(0, '', instance);

        $('#adivinaEPhrase-' + instance)
            .find('.ADVNP-Letter')
            .css('color', $guess.borderColors.blue);

        $guess.drawPhrase(
            q.word,
            q.definition,
            q.percentageShow,
            0,
            $guess.options[instance].caseSensitive,
            instance,
            false
        );

        $('#adivinaEdAnswer-' + instance).val('');
        $('#adivinaBtnReply-' + instance).prop('disabled', false);
        $('#adivinaBtnMoveOn-' + instance).prop('disabled', false);
        $('#adivinaEdAnswer-' + instance).prop('disabled', false);
        $('#adivinaPTime-' + instance).text(tiempo);
        $('#adivinaImage-' + instance).hide();
        $('#adivinaCover-' + instance).show();
        $('#adivinaEText-' + instance).hide();
        $('#adivinaVideo-' + instance).hide();
        $('#adivinaVideoLocal-' + instance).hide();
        $('#adivinaLinkAudio-' + instance).hide();
        $('#adivinaCursor-' + instance).hide();
        $('#adivinaAuthor-' + instance).text('');

        $guess.startVideo('', 0, 0, instance, 0);
        $guess.stopVideo(mOptions);
        $guess.showMessage(0, '', instance);

        mOptions.activeSilent =
            q.type == 2 &&
            q.soundVideo == 1 &&
            q.tSilentVideo > 0 &&
            q.silentVideo >= q.iVideo &&
            q.iVideo < q.fVideo;
        const endSonido = parseInt(q.silentVideo) + parseInt(q.tSilentVideo);
        mOptions.endSilent = endSonido > q.fVideo ? q.fVideo : endSonido;

        if (q.type === 1) {
            $guess.showImage(q.url, instance);
            $('#adivinaPAuthor-' + instance).text(q.author);
        } else if (q.type === 3) {
            let text = unescape(q.eText);
            $('#adivinaEText-' + instance).html(text);
            $('#adivinaCover-' + instance).hide();
            $('#adivinaEText-' + instance).show();
            $guess.showMessage(0, '', instance);
        } else if (q.type === 2) {
            let urllv =
                    $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                        q.url
                    ),
                idVideo = $exeDevices.iDevice.gamification.media.getIDYoutube(
                    q.url
                ),
                type = urllv ? 1 : 0,
                id = type === 0 ? idVideo : urllv;

            $guess.startVideo(id, q.iVideo, q.fVideo, instance, type);

            if (type === 0) {
                $('#adivinaVideo-' + instance).show();
            } else {
                $('#adivinaVideoLocal-' + instance).show();
            }

            $guess.showMessage(0, '', instance);
            $('#adivinaVideo-' + instance).hide();
            $('#adivinaVideoLocal-' + instance).hide();

            if (q.imageVideo === 0) {
                $('#adivinaCover-' + instance).show();
            } else {
                if (type == 1) {
                    $('#adivinaVideoLocal-' + instance).show();
                } else {
                    $('#adivinaVideo-' + instance).show();
                }
                $('#adivinaCover-' + instance).hide();
            }

            if (q.soundVideo === 0) {
                $exeDevices.iDevice.gamification.media.muteVideo(
                    true,
                    mOptions
                );
            } else {
                $exeDevices.iDevice.gamification.media.muteVideo(
                    false,
                    mOptions
                );
            }
        }

        if (q.audio.length > 4 && q.type != 2) {
            $('#adivinaLinkAudio-' + instance).show();
        }

        $exeDevices.iDevice.gamification.media.stopSound(mOptions);

        if (q.type != 2 && q.audio.trim().length > 5) {
            $exeDevices.iDevice.gamification.media.playSound(
                q.audio.trim(),
                mOptions
            );
        }

        $('#adivinaBtnReply-' + instance).prop('disabled', false);
        $('#adivinaBtnMoveOn-' + instance).prop('disabled', false);
        $('#adivinaEdAnswer-' + instance).prop('disabled', false);
        $('#adivinaEdAnswer-' + instance).val('');

        if (q.isScorm === 1) {
            $guess.sendScore(true, instance);
        }

        if (mOptions.modeBoard) {
            $('#adivinaDivModeBoard-' + instance).css('display', 'flex');
            $('#adivinaDivModeBoard-' + instance).fadeIn();
        }
        $guess.saveEvaluation(instance);
    },

    startVideo: function (id, start, end, instance) {
        const mOptions = $guess.options[instance],
            mstart = start < 1 ? 0.1 : start;
        if (
            mOptions.player &&
            typeof mOptions.player.loadVideoById == 'function'
        ) {
            mOptions.player.loadVideoById({
                videoId: id,
                startSeconds: mstart,
                endSeconds: end,
            });
        }
    },

    stopVideo: function (game) {
        if (
            game &&
            game.localPlayer &&
            typeof game.localPlayer.pause === 'function'
        ) {
            game.localPlayer.pause();
        }
        if (
            game &&
            game.player &&
            typeof game.player.pauseVideo === 'function'
        ) {
            game.player.pauseVideo();
        }
    },

    updateTimerDisplayLocal: function (instance) {
        const mOptions = $guess.options[instance];
        if (mOptions.localPlayer && mOptions.localPlayer.currentTime) {
            const currentTime = mOptions.localPlayer.currentTime;
            $guess.updateSoundVideoLocal(instance);
            if (
                Math.ceil(currentTime) == mOptions.pointEnd ||
                Math.ceil(currentTime) == mOptions.durationVideo
            ) {
                mOptions.localPlayer.pause();
                mOptions.pointEnd = 100000;
            }
        }
    },

    updateSoundVideoLocal: function (instance) {
        const mOptions = $guess.options[instance];
        if (
            mOptions.activeSilent &&
            mOptions.localPlayer &&
            mOptions.localPlayer.currentTime
        ) {
            const time = Math.round(mOptions.localPlayer.currentTime);
            if (time == mOptions.question.silentVideo) {
                mOptions.localPlayer.muted = true;
            } else if (time == mOptions.endSilent) {
                mOptions.localPlayer.muted = false;
            }
        }
    },

    preloadGame: function (instance) {
        const mOptions = $guess.options[instance];
        if (mOptions.waitStart) {
            mOptions.waitStart = false;
            setTimeout(function () {
                $guess.startGame(instance);
            }, 1000);
        }
    },

    updateTimerDisplay: function () {},
    updateProgressBar: function () {},

    showImage: function (url, instance) {
        const mOptions = $guess.options[instance],
            mQuestion = mOptions.wordsGame[mOptions.activeQuestion],
            $cursor = $(`#adivinaCursor-${instance}`),
            $noImage = $(`#adivinaCover-${instance}`),
            $image = $(`#adivinaImage-${instance}`),
            $author = $(`#adivinaAuthor-${instance}`),
            $protect = $(`#adivinaProtector-${instance}`);

        $image.attr('alt', 'No image');
        $cursor.hide();
        $image.hide();
        $noImage.hide();
        $protect.hide();

        if ($.trim(url).length === 0) {
            $cursor.hide();
            $image.hide();
            $noImage.show();
            $author.html('');
            return false;
        }

        $image.attr('src', '');
        $image
            .attr('src', url)
            .on('load', function () {
                if (
                    !this.complete ||
                    typeof this.naturalWidth === 'undefined' ||
                    this.naturalWidth === 0
                ) {
                    $cursor.hide();
                    $image.hide();
                    $noImage.show();
                    $author.html('');
                } else {
                    $image.show();
                    $cursor.show();
                    $noImage.hide();
                    $author.html(mQuestion.author);
                    $image.attr('alt', mQuestion.alt);
                    $guess.centerImage(instance);
                }
            })
            .on('error', function () {
                $cursor.hide();
                $image.hide();
                $noImage.show();
                $author.html('');
                return false;
            });

        $guess.showMessage(0, mQuestion.author, instance);
    },

    refreshGame: function (instance) {
        const mOptions = $guess.options[instance];
        if (!mOptions) return;

        const mQuestion = mOptions.wordsGame[mOptions.activeQuestion];

        if (!mQuestion) return;

        if (mQuestion.type === 1 && mQuestion.url && mQuestion.url.length > 3) {
            $guess.centerImage(instance);
        }
    },

    centerImage: function (instance) {
        const $image = $(`#adivinaImage-${instance}`);

        if ($image.length === 0) return;

        const $parent = $image.parent(),
            wDiv = $parent.width() || 1,
            hDiv = $parent.height() || 1,
            naturalWidth = $image[0].naturalWidth,
            naturalHeight = $image[0].naturalHeight;

        let varW = naturalWidth / wDiv,
            varH = naturalHeight / hDiv,
            wImage = wDiv,
            hImage = hDiv,
            xImage = 0,
            yImage = 0;

        if (varW > varH) {
            wImage = parseInt(wDiv, 10);
            hImage = parseInt(naturalHeight / varW, 10);
            yImage = parseInt((hDiv - hImage) / 2, 10);
        } else {
            wImage = parseInt(naturalWidth / varH, 10);
            hImage = parseInt(hDiv, 10);
            xImage = parseInt((wDiv - wImage) / 2, 10);
        }

        $image.css({
            width: wImage,
            height: hImage,
            position: 'absolute',
            left: xImage,
            top: yImage,
        });
        $guess.positionPointer(instance);
    },

    positionPointer: function (instance) {
        const mOptions = $guess.options[instance],
            mQuestion = mOptions.wordsGame[mOptions.activeQuestion],
            $cursor = $(`#adivinaCursor-${instance}`);

        let x = parseFloat(mQuestion.x) || 0,
            y = parseFloat(mQuestion.y) || 0;

        $cursor.hide();

        if (x > 0 || y > 0) {
            const containerElement = document.getElementById(
                    `adivinaMultimedia-${instance}`
                ),
                containerPos = containerElement.getBoundingClientRect(),
                imgElement = document.getElementById(
                    `adivinaImage-${instance}`
                ),
                imgPos = imgElement.getBoundingClientRect(),
                marginTop = imgPos.top - containerPos.top,
                marginLeft = imgPos.left - containerPos.left;

            x = marginLeft + x * imgPos.width;
            y = marginTop + y * imgPos.height;

            $cursor.show();
            $cursor.css({ left: x, top: y, 'z-index': 10 });
        }
    },

    updateLives: function (instance) {
        const mOptions = $guess.options[instance],
            classIconLife = '.exeQuextIcons-Life',
            $livesContainer = $(`#adivinaLifesAdivina-${instance}`),
            $numberLives = $(`#adivinaNumberLivesAdivina-${instance}`);

        $(`#adivinaPLifes-${instance}`).text(mOptions.livesLeft);
        $livesContainer.find(classIconLife).each(function (index) {
            $(this).hide();
            if (mOptions.useLives) {
                $(this).show();
                if (index >= mOptions.livesLeft) {
                    $(this).hide();
                }
            }
        });

        if (!mOptions.useLives) {
            $livesContainer.hide();
            $numberLives.hide();
        }
    },

    newQuestion: function (instance) {
        const mOptions = $guess.options[instance],
            $adivinaPNumber = $(`#adivinaPNumber-${instance}`);

        if (mOptions.livesLeft <= 0 && mOptions.useLives) {
            $guess.gameOver(1, instance);
            return;
        }

        const mActiveQuestion = $guess.updateNumberQuestion(
            mOptions.activeQuestion,
            instance
        );

        if (mActiveQuestion === null) {
            $adivinaPNumber.text('0');
            $guess.gameOver(0, instance);
            return;
        } else {
            mOptions.counter =
                $exeDevices.iDevice.gamification.helpers.getTimeSeconds(
                    mOptions.wordsGame[mActiveQuestion].time
                );
            if (mOptions.wordsGame[mActiveQuestion].type === 2) {
                const durationVideo =
                    mOptions.wordsGame[mActiveQuestion].fVideo -
                    mOptions.wordsGame[mActiveQuestion].iVideo;
                mOptions.counter += durationVideo;
            }
            $guess.showQuestion(mActiveQuestion, instance);
            mOptions.activeCounter = true;
            $adivinaPNumber.text(mOptions.numberQuestions - mActiveQuestion);
        }

        if (mOptions.isScorm === 1) {
            const score = (
                (mOptions.hits * 10) /
                mOptions.numberQuestions
            ).toFixed(2);
            $guess.sendScore(true, instance);
            $(`#adivinaRepeatActivity-${instance}`).text(
                `${mOptions.msgs.msgYouScore}: ${score}`
            );
        }
        $guess.saveEvaluation(instance);
    },

    updateNumberQuestion: function (numq, instance) {
        const mOptions = $guess.options[instance];
        let numActiveQuestion = numq + 1;

        if (numActiveQuestion >= mOptions.numberQuestions) return null;

        mOptions.activeQuestion = numActiveQuestion;
        return numActiveQuestion;
    },

    getRetroFeedMessages: function (iHit, instance) {
        const mOptions = $guess.options[instance];
        let sMessages = iHit
            ? mOptions.msgs.msgSuccesses
            : mOptions.msgs.msgFailures;
        sMessages = sMessages.split('|');
        return sMessages[Math.floor(Math.random() * sMessages.length)];
    },

    answerQuestion: function (instance) {
        const mOptions = $guess.options[instance],
            question = mOptions.wordsGame[mOptions.activeQuestion],
            $edAnswer = $(`#adivinaEdAnswer-${instance}`),
            answord = $.trim($edAnswer.val()),
            solution = $.trim(question.word);

        if (!mOptions.gameActived) return;

        if (answord.length === 0) {
            $guess.showMessage(1, mOptions.msgs.msgIndicateWord, instance);
            return;
        }

        mOptions.gameActived = false;
        $(
            `#adivinaBtnReply-${instance}, #adivinaBtnMoveOn-${instance}, #adivinaEdAnswer-${instance}`
        ).prop('disabled', true);

        const userAnswer = mOptions.caseSensitive
                ? answord
                : answord.toUpperCase(),
            correctSolution = mOptions.caseSensitive
                ? solution
                : solution.toUpperCase(),
            isCorrect = userAnswer === correctSolution,
            type = $guess.updateScore(isCorrect, instance),
            percentageHits = (mOptions.hits / mOptions.numberQuestions) * 100;

        mOptions.activeCounter = false;
        let timeShowSolution = 1000;

        if (
            mOptions.itinerary.showClue &&
            percentageHits >= mOptions.itinerary.percentageClue &&
            !mOptions.obtainedClue
        ) {
            mOptions.obtainedClue = true;
            timeShowSolution = 3000;
            const $pShowClue = $(`#adivinaPShowClue-${instance}`);
            $pShowClue.show();
            $pShowClue.text(
                `${mOptions.msgs.msgInformation}: ${mOptions.itinerary.clueGame}`
            );
        }

        if (mOptions.showSolution) {
            timeShowSolution = mOptions.timeShowSolution * 1000;
            $guess.drawPhrase(
                question.word,
                question.definition,
                100,
                type,
                mOptions.caseSensitive,
                instance,
                true
            );
        }

        setTimeout(() => {
            $guess.newQuestion(instance);
        }, timeShowSolution);
    },

    answerQuestionBoard: function (value, instance) {
        const mOptions = $guess.options[instance],
            question = mOptions.wordsGame[mOptions.activeQuestion];

        if (!mOptions.gameActived) return;

        mOptions.gameActived = false;
        $(
            `#adivinaBtnReply-${instance}, #adivinaBtnMoveOn-${instance}, #adivinaEdAnswer-${instance}`
        ).prop('disabled', true);

        const type = $guess.updateScore(value, instance),
            percentageHits = (mOptions.hits / mOptions.numberQuestions) * 100;

        mOptions.activeCounter = false;
        let timeShowSolution = 1000;

        if (
            mOptions.itinerary.showClue &&
            percentageHits >= mOptions.itinerary.percentageClue &&
            !mOptions.obtainedClue
        ) {
            mOptions.obtainedClue = true;
            timeShowSolution = 3000;
            const $pShowClue = $(`#adivinaPShowClue-${instance}`);
            $pShowClue.show();
            $pShowClue.text(
                `${mOptions.msgs.msgInformation}: ${mOptions.itinerary.clueGame}`
            );
        }

        if (mOptions.showSolution) {
            timeShowSolution = mOptions.timeShowSolution * 1000;
            $guess.drawPhrase(
                question.word,
                question.definition,
                100,
                type,
                mOptions.caseSensitive,
                instance,
                true
            );
        }

        setTimeout(() => {
            $guess.newQuestion(instance);
        }, timeShowSolution);
    },

    updateScore: function (correctAnswer, instance) {
        const mOptions = $guess.options[instance];
        let message = '',
            obtainedPoints = 0,
            type = 1,
            sscore = 0,
            points = 0;

        if (correctAnswer) {
            mOptions.hits++;
            if (mOptions.gameMode == 0) {
                let pointsTemp =
                    mOptions.counter < 60 ? mOptions.counter * 10 : 600;
                obtainedPoints = 1000 + pointsTemp;
                points = obtainedPoints;
            } else if (mOptions.gameMode == 1) {
                obtainedPoints = 10 / mOptions.wordsGame.length;
                points =
                    obtainedPoints % 1 == 0
                        ? obtainedPoints
                        : obtainedPoints.toFixed(2);
            } else if (mOptions.gameMode == 2) {
                obtainedPoints = 10 / mOptions.wordsGame.length;
                points =
                    obtainedPoints % 1 == 0
                        ? obtainedPoints
                        : obtainedPoints.toFixed(2);
            }
            type = 2;
        } else {
            mOptions.errors++;
            if (mOptions.gameMode != 0) {
                message = '';
            } else {
                obtainedPoints = -330;
                points = obtainedPoints;
                if (mOptions.useLives) {
                    mOptions.livesLeft--;
                    $guess.updateLives(instance);
                }
            }
        }
        mOptions.score =
            mOptions.score + obtainedPoints > 0
                ? mOptions.score + obtainedPoints
                : 0;
        sscore = mOptions.score;
        if (mOptions.gameMode != 0) {
            sscore =
                mOptions.score % 1 == 0
                    ? mOptions.score
                    : mOptions.score.toFixed(2);
        }
        $('#adivinaPScore-' + instance).text(sscore);
        $('#adivinaPHits-' + instance).text(mOptions.hits);
        $('#adivinaPErrors-' + instance).text(mOptions.errors);
        message = $guess.getMessageAnswer(correctAnswer, points, instance);
        $guess.showMessage(type, message, instance);
    },

    getMessageAnswer: function (correctAnswer, npts, instance) {
        const mOptions = $guess.options[instance],
            q = mOptions.wordsGame[mOptions.activeQuestion];
        let message = '';

        if (correctAnswer) {
            message = $guess.getMessageCorrectAnswer(npts, instance);
        } else {
            message = $guess.getMessageErrorAnswer(npts, instance);
        }
        if (mOptions.showSolution && q.typeQuestion == 1) {
            message += ': ' + q.solutionQuestion;
        }
        return message;
    },

    getMessageCorrectAnswer: function (npts, instance) {
        const mOptions = $guess.options[instance],
            pts =
                typeof mOptions.msgs.msgPoints == 'undefined'
                    ? 'puntos'
                    : mOptions.msgs.msgPoints,
            messageCorrect = $guess.getRetroFeedMessages(true, instance);
        let message = '';

        if (
            mOptions.customMessages &&
            mOptions.wordsGame[mOptions.activeQuestion].msgHit.length > 0
        ) {
            message = mOptions.wordsGame[mOptions.activeQuestion].msgHit;
            message =
                mOptions.gameMode < 2
                    ? message + '. ' + npts + ' ' + pts
                    : message;
        } else {
            message =
                mOptions.gameMode == 2
                    ? messageCorrect
                    : messageCorrect + ' ' + npts + ' ' + pts;
        }
        return message;
    },

    getMessageErrorAnswer: function (npts, instance) {
        let mOptions = $guess.options[instance],
            messageError = $guess.getRetroFeedMessages(false, instance),
            pts =
                typeof mOptions.msgs.msgPoints == 'undefined'
                    ? 'points'
                    : mOptions.msgs.msgPoints;
        let message = '';

        if (
            mOptions.customMessages &&
            mOptions.wordsGame[mOptions.activeQuestion].msgError.length > 0
        ) {
            message = mOptions.wordsGame[mOptions.activeQuestion].msgError;
            if (mOptions.gameMode != 2) {
                message = mOptions.useLives
                    ? message + '. ' + mOptions.msgs.msgLoseLive
                    : message + '. ' + npts + ' ' + pts;
            }
        } else {
            message = mOptions.useLives
                ? messageError + ' ' + mOptions.msgs.msgLoseLive
                : messageError + ' ' + npts + ' ' + pts;
            message = mOptions.gameMode > 0 ? messageError : message;
        }
        return message;
    },

    showMessage: function (type, message, instance) {
        const colors = [
                '#555555',
                $guess.borderColors.red,
                $guess.borderColors.green,
                $guess.borderColors.blue,
                $guess.borderColors.yellow,
            ],
            color = colors[type];

        $('#adivinaPAuthor-' + instance).html(message);
        $('#adivinaPAuthor-' + instance).css({
            color: color,
        });

        $exeDevices.iDevice.gamification.math.updateLatex(
            '#adivinaPAuthor-' + instance
        );
    },
};
$(function () {
    $guess.init();
});
