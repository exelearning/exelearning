/**
 * Select Activity iDevice (edition code)
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno, Francisco Javier Pulido
 * Testers: Ricardo Málaga Floriano, Francisco Muñoz de la Peña
 * Translator: Antonio Juan Delgado García
 * Versión: 2.0
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    idevicePath: '',
    checkAltImage: true,
    msgs: {},
    classIdevice: 'trivial',
    active: 0,
    selectsGame: [],
    youtubeLoaded: false,
    player: '',
    playerIntro: '',
    timeUpdateInterval: '',
    timeUpdateVIInterval: '',
    timeVideoFocus: 0,
    timeVIFocus: true,
    typeEdit: -1,
    numberCutCuestion: -1,
    clipBoard: '',
    activeSilent: false,
    silentVideo: 0,
    tSilentVideo: 0,
    endSilent: 0,
    numeroTemas: 2,
    nombresTemas: ['Tema 1', 'Tema 2', 'Tema 3', 'Tema 4', 'Tema 5', 'Tema 6'],
    temas: [],
    temasJson: [],
    activeTema: 0,
    activesQuestions: [0, 0, 0, 0, 0, 0],
    trivialID: 0,
    localPlayer: null,
    id: false,
    ci18n: {},

    getId: function () {
        return Math.round(new Date().getTime() + Math.random() * 100);
    },
    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;

        this.refreshTranslations();
        this.setMessagesInfo();
        this.createForm();
    },

    enableForm: function () {
        $exeDevice.trivialID = $exeDevice.getId();
        $exeDevice.initQuestions();
        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
        $exeDevice.loadYoutubeApi();
    },

    refreshTranslations: function () {
        this.ci18n = {
            msgStartGame: c_('Click here to start'),
            msgSubmit: c_('Submit'),
            msgEnterCode: c_('Enter the access code'),
            msgErrorCode: c_('The access code is not correct'),
            msgGameOver: c_('Game Over!'),
            msgClue: c_('Cool! The clue is:'),
            msgNewGame: c_('Click here for a new game'),
            msgCodeAccess: c_('Access code'),
            msgPlayStart: c_('Click here to play'),
            msgMinimize: c_('Minimize'),
            msgMaximize: c_('Maximize'),
            msgTime: c_('Time per question'),
            msgFullScreen: c_('Full Screen'),
            msgExitFullScreen: c_('Exit Full Screen'),
            msgNoImage: c_('No picture question'),
            msgSuccesses: c_(
                'Right! | Excellent! | Great! | Very good! | Perfect!'
            ),
            msgFailures: c_(
                'It was not that! | Incorrect! | Not correct! | Sorry! | Error!'
            ),
            msgNotNetwork: c_(
                'You can only play this game with internet connection.'
            ),
            msgQuestion: c_('Question'),
            msgAnswer: c_('Check'),
            msgInformation: c_('Information'),
            msgAuthor: c_('Authorship'),
            msgActityComply: c_('You have already done this activity.'),
            msgPlaySeveralTimes: c_(
                'You can do this activity as many times as you want'
            ),
            msgYouLastScore: c_('The last score saved is'),
            msgOption: c_('Option'),
            msgImage: c_('Image'),
            msgOrders: c_('Please order the answers'),
            msgIndicateWord: c_('Provide a word or phrase'),
            msgGameStarted: c_('The game has already started.'),
            msgPlayersName: c_(
                'You must indicate a name for all the selected players.'
            ),
            msgReboot: c_('Do you want to restart the game?'),
            msgRoolDice: c_('roll the dice.'),
            msgsWinner: c_(
                'The game has finished. The winner is %1. Do you want to play again?'
            ),
            msgWinGame: c_('Cool! You won the game.'),
            msgsYouPlay: c_('you play. Roll the dice.'),
            msgSaveDiceAuto: c_(
                'Your score will be automatically saved after each throw.'
            ),
            msgSaveAuto: c_(
                'Your score will be automatically saved after each question.'
            ),
            msgOnlyFirstGame: c_('You can only play once.'),
            msgGamers: c_('Players'),
            msgReply: c_('Answer'),
            msgErrorQuestion: c_('you have failed.'),
            msgsYouPlay: c_('you play. Roll the dice.'),
            msgGetQueso: c_('you get the cheese of'),
            msgRightAnswre: c_('One more point.'),
            msgAudio: c_('Audio'),
            msgCorrect: c_('Correct'),
            msgIncorrect: c_('Incorrect'),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgNext: c_('Next'),
            msgTypeGame: c_('TriviExt'),
            msgRestart: c_('Restart'),
            msgYouScore: c_('Your score'),
        };
    },

    setMessagesInfo: function () {
        var msgs = this.msgs;
        msgs.msgEProvideDefinition = _(
            'Please provide the word definition or the valid URL of an image'
        );
        msgs.msgESelectFile = _(
            'The selected file does not contain a valid game'
        );
        msgs.msgEURLValid = _(
            'You must upload or indicate the valid URL of an image'
        );
        msgs.msgEProvideWord = _('Please provide one word or phrase');
        msgs.msgEOneQuestion = _('Please provide at least one question');
        msgs.msgEUnavailableVideo = _('This video is not currently available');
        msgs.msgECompleteQuestion = _('You have to complete the question');
        msgs.msgECompleteAllOptions = _(
            'You have to complete all the selected options'
        );
        msgs.msgESelectSolution = _('Choose the right answer');
        msgs.msgECompleteURLYoutube = _('Please type or paste a valid URL.');
        msgs.msgEStartEndVideo = _(
            'You have to indicate the start and the end of the video that you want to show'
        );
        msgs.msgEStartEndIncorrect = _(
            'The video end value must be higher than the start one'
        );
        msgs.msgWriteText = _('You have to type a text in the editor');
        msgs.msgStartWith = _('Starts with %1');
        msgs.msgContaint = _('Contains letter %1');
        msgs.msgVideoNotAvailable = _('This video is not currently available');
        msgs.msgSilentPoint = _(
            'The silence time is wrong. Check the video duration.'
        );
        msgs.msgTypeChoose = _(
            'Please check all the answers in the right order'
        );
        msgs.msgTimeFormat = _('Please check the time format: hh:mm:ss');
        msgs.msgProvideSolution = _('Please write the solution');
        msgs.msgNameThemes = _(
            'You must indicate a name for all the selected topics.'
        );
        msgs.msgCmpleteAllQuestions = _(
            'You must complete all the questions of all the selected topics correctly.'
        );
        msgs.msgGameIntrunctions = _(
            'Roll the dice and answer the question until you get all the cheeses.'
        );
        msgs.tooManyQuestions = _(
            'Too many questions! The game can have a maximum of about 800 and 1200 questions. This number can vary a lot depending on the type of questions and the length of the questions, the answers, the URLs and the enriched text.'
        );
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.'
        );
        msgs.msgIDLenght = _(
            'The report identifier must have at least 5 characters'
        );
        msgs.msgTitleAltImageWarning = _('Accessibility warning');
        msgs.msgAltImageWarning = _(
            'At least one image has no description, are you sure you want to continue without including it? Without it the image may not be accessible to some users with disabilities, or to those using a text browser, or browsing the Web with images turned off.'
        ); //eXe 3.0
    },

    loadYoutubeApi: function () {
        if (typeof YT == 'undefined') {
            onYouTubeIframeAPIReady = $exeDevice.youTubeReady;
            let tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            tag.async = true;
            let firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else {
            $exeDevice.loadPlayerYoutube();
        }
    },
    youTubeReady: function () {
        $('#trivialMediaVideo').prop('disabled', false);
        $exeDevice.player = new YT.Player('trivialEVideo', {
            width: '100%',
            height: '100%',
            videoId: '',
            playerVars: {
                color: 'white',
                autoplay: 1,
                controls: 1,
            },
            events: {
                onReady: $exeDevice.onPlayerReady,
                onError: $exeDevice.onPlayerError,
            },
        });
    },

    loadPlayerYoutube: function () {
        $('#trivialMediaVideo').prop('disabled', false);
        $exeDevice.player = new YT.Player('trivialEVideo', {
            width: '100%',
            height: '100%',
            videoId: '',
            playerVars: {
                color: 'white',
                autoplay: 1,
                controls: 1,
            },
            events: {
                onReady: $exeDevice.clickPlay,
                onError: $exeDevice.onPlayerError,
            },
        });
    },

    clickPlay: function () {
        const ulrvideo = $('#trivialEURLYoutube');
        if (ulrvideo.length == 0 || ulrvideo.val().trim().length === 0) return;
        if (
            $exeDevices.iDevice.gamification.media.getIDYoutube(
                $('#trivialEURLYoutube').val().trim()
            ) ||
            $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                $('#trivialEURLYoutube').val().trim()
            )
        ) {
            $exeDevice.showVideoQuestion();
        }
    },

    onPlayerReady: function (event) {
        $exeDevice.clickPlay();
    },

    updateSoundVideo: function () {
        if ($exeDevice.activeSilent) {
            if (
                $exeDevice.player &&
                typeof $exeDevice.player.getCurrentTime === 'function'
            ) {
                const time = Math.round($exeDevice.player.getCurrentTime());
                if (time == $exeDevice.silentVideo) {
                    $exeDevice.player.mute();
                } else if (time == $exeDevice.endSilent) {
                    $exeDevice.player.unMute();
                }
            }
        }
    },

    updateTimerDisplay: function () {
        if ($exeDevice.player) {
            if (typeof $exeDevice.player.getCurrentTime === 'function') {
                const time =
                    $exeDevices.iDevice.gamification.helpers.secondsToHour(
                        $exeDevice.player.getCurrentTime()
                    );
                $('#trivialEVideoTime').text(time);
                $exeDevice.updateSoundVideo();
            }
        }
    },

    updateProgressBar: function () {
        $('#progress-bar').val(
            (player.getCurrentTime() / player.getDuration()) * 100
        );
    },

    onPlayerError: function (event) {
        //$exeDevice.showMessage("El video  no está disponible")
    },

    updateSoundVideoLocal: function () {
        if (
            $exeDevice.activeSilent &&
            $exeDevice.localPlayer &&
            $exeDevice.localPlayer.currentTime
        ) {
            const time = Math.round($exeDevice.localPlayer.currentTime);
            if (time == $exeDevice.silentVideo) {
                $exeDevice.localPlayer.muted = true;
            } else if (time == $exeDevice.endSilent) {
                $exeDevice.localPlayer.muted = false;
            }
        }
    },

    updateTimerDisplayLocal: function () {
        if ($exeDevice.localPlayer && $exeDevice.localPlayer.currentTime) {
            const currentTime = $exeDevice.localPlayer.currentTime,
                time = $exeDevices.iDevice.gamification.helpers.secondsToHour(
                    Math.floor(currentTime)
                );
            $('#trivialEVideoTime').text(time);
            $exeDevice.updateSoundVideoLocal();
            if (
                Math.ceil(currentTime) == $exeDevice.pointEnd ||
                Math.ceil(currentTime) == $exeDevice.durationVideo
            ) {
                $exeDevice.localPlayer.pause();
                $exeDevice.pointEnd = 100000;
            }
        }
    },

    startVideo: function (id, start, end, type) {
        var mstart = start < 1 ? 0.1 : start;
        if (type > 0) {
            if ($exeDevice.localPlayer) {
                $exeDevice.pointEnd = end;
                $exeDevice.localPlayer.src = id;
                $exeDevice.localPlayer.currentTime = parseFloat(mstart);
                $exeDevice.localPlayer.play();
            }
            clearInterval($exeDevice.timeUpdateInterval);
            $exeDevice.timeUpdateInterval = setInterval(function () {
                $exeDevice.updateTimerDisplayLocal();
            }, 1000);
            return;
        }
        if ($exeDevice.player) {
            if (typeof $exeDevice.player.loadVideoById === 'function') {
                $exeDevice.player.loadVideoById({
                    videoId: id,
                    startSeconds: mstart,
                    endSeconds: end,
                });
            }
            clearInterval($exeDevice.timeUpdateInterval);
            $exeDevice.timeUpdateInterval = setInterval(function () {
                $exeDevice.updateTimerDisplay();
            }, 1000);
        }
    },

    playVideo: function () {
        if ($exeDevice.player) {
            clearInterval($exeDevice.timeUpdateInterval);
            if (typeof $exeDevice.player.playVideo === 'function') {
                $exeDevice.player.playVideo();
            }
            $exeDevice.timeUpdateInterval = setInterval(function () {
                $exeDevice.updateTimerDisplay();
            }, 1000);
        }
    },

    stopVideo: function () {
        if ($exeDevice.player) {
            clearInterval($exeDevice.timeUpdateInterval);
            if (typeof $exeDevice.player.pauseVideo === 'function') {
                $exeDevice.player.pauseVideo();
            }
        }
    },

    muteVideo: function (mute) {
        if ($exeDevice.localPlayer) {
            if (mute) {
                $exeDevice.localPlayer.muted = true;
            } else {
                $exeDevice.localPlayer.muted = false;
            }
        }
        if ($exeDevice.player) {
            if (mute) {
                if (typeof $exeDevice.player.mute === 'function') {
                    $exeDevice.player.mute();
                }
            } else {
                if (typeof $exeDevice.player.unMute === 'function') {
                    $exeDevice.player.unMute();
                }
            }
        }
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    addQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.clearQuestion();
            $exeDevice.temas[$exeDevice.activeTema].push(
                $exeDevice.getCuestionDefault()
            );
            $exeDevice.activesQuestions[$exeDevice.activeTema] =
                $exeDevice.temas[$exeDevice.activeTema].length - 1;
            $('#trivialNumberQuestion').val(
                $exeDevice.temas[$exeDevice.activeTema].length
            );
            $exeDevice.typeEdit = -1;
            $exeDevice.hideFlex($('#trivialEPaste'));
            $('#trivialENumQuestions').val(
                $exeDevice.temas[$exeDevice.activeTema].length
            );
        }
    },

    removeQuestion: function (num) {
        if ($exeDevice.temas[$exeDevice.activeTema].length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
            return;
        } else {
            $exeDevice.temas[$exeDevice.activeTema].splice(
                $exeDevice.activesQuestions[$exeDevice.activeTema],
                1
            );
            if (
                $exeDevice.activesQuestions[$exeDevice.activeTema] >=
                $exeDevice.temas[$exeDevice.activeTema].length - 1
            ) {
                $exeDevice.activesQuestions[$exeDevice.activeTema] =
                    $exeDevice.temas[$exeDevice.activeTema].length - 1;
            }
            $exeDevice.showQuestion(
                $exeDevice.activesQuestions[$exeDevice.activeTema]
            );
            $exeDevice.typeEdit = -1;
            $exeDevice.hideFlex($('#trivialEPaste'));
            $('#trivialENumQuestions').text(
                $exeDevice.temas[$exeDevice.activeTema].length
            );
            $('#trivialNumberQuestion').text(
                $exeDevice.activesQuestions[$exeDevice.activeTema] + 1
            );
        }
    },

    copyQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.typeEdit = 0;
            var active = $exeDevice.activesQuestions[$exeDevice.activeTema];
            $exeDevice.clipBoard = JSON.parse(
                JSON.stringify($exeDevice.temas[$exeDevice.activeTema][active])
            );
            $exeDevice.showFlex($('#trivialEPaste'));
        }
    },

    cutQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.numberCutCuestion =
                $exeDevice.activesQuestions[$exeDevice.activeTema];
            $exeDevice.typeEdit = 1;
            $exeDevice.showFlex($('#trivialEPaste'));
        }
    },

    pasteQuestion: function () {
        if ($exeDevice.typeEdit == 0) {
            $exeDevice.activesQuestions[$exeDevice.activeTema]++;
            $exeDevice.temas[$exeDevice.activeTema].splice(
                $exeDevice.activesQuestions[$exeDevice.activeTema],
                0,
                $exeDevice.clipBoard
            );
            $exeDevice.showQuestion(
                $exeDevice.activesQuestions[$exeDevice.activeTema]
            );
        } else if ($exeDevice.typeEdit == 1) {
            $exeDevice.hideFlex($('#trivialEPaste'));
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                $exeDevice.temas[$exeDevice.activeTema],
                $exeDevice.numberCutCuestion,
                $exeDevice.activesQuestions[$exeDevice.activeTema]
            );
            $exeDevice.showQuestion(
                $exeDevice.activesQuestions[$exeDevice.activeTema]
            );
            $('#trivialENumQuestions').text(
                $exeDevice.temas[$exeDevice.activeTema].length
            );
        }
    },

    nextQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            if (
                $exeDevice.activesQuestions[$exeDevice.activeTema] <
                $exeDevice.temas[$exeDevice.activeTema].length - 1
            ) {
                $exeDevice.activesQuestions[$exeDevice.activeTema]++;
                $exeDevice.showQuestion(
                    $exeDevice.activesQuestions[$exeDevice.activeTema]
                );
            }
        }
    },

    lastQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            if (
                $exeDevice.activesQuestions[$exeDevice.activeTema] <
                $exeDevice.temas[$exeDevice.activeTema].length - 1
            ) {
                $exeDevice.activesQuestions[$exeDevice.activeTema] =
                    $exeDevice.temas[$exeDevice.activeTema].length - 1;
                $exeDevice.showQuestion(
                    $exeDevice.activesQuestions[$exeDevice.activeTema]
                );
            }
        }
    },

    previousQuestion: function () {
        if ($exeDevice.validateQuestion() != false) {
            if ($exeDevice.activesQuestions[$exeDevice.activeTema] > 0) {
                $exeDevice.activesQuestions[$exeDevice.activeTema]--;
                $exeDevice.showQuestion(
                    $exeDevice.activesQuestions[$exeDevice.activeTema]
                );
            }
        }
    },

    firstQuestion: function () {
        if ($exeDevice.validateQuestion() != false) {
            if ($exeDevice.activesQuestions[$exeDevice.activeTema] > 0) {
                $exeDevice.activesQuestions[$exeDevice.activeTema] = 0;
                $exeDevice.showQuestion(
                    $exeDevice.activesQuestions[$exeDevice.activeTema]
                );
            }
        }
    },

    validarTemas: function () {
        for (let j = 0; j < $exeDevice.numeroTemas; j++) {
            for (let i = 0; i < $exeDevice.temas[j].length; i++) {
                const cuestion = $exeDevice.temas[j][i];
                if (cuestion.pregunta.length == 0) {
                    return false;
                }
                if (cuestion.typeSelect == 0) {
                    for (let z = 0; z < cuestion.numberOptions; z++) {
                        if (cuestion.options[z].length == 0) {
                            return false;
                        }
                    }
                } else if (cuestion.typeSelect == 1) {
                    if (cuestion.solution.length != cuestion.numberOptions) {
                        return false;
                    }
                } else if (cuestion.typeSelect == 2) {
                    if (cuestion.solutionQuestion.length == 0) {
                        return false;
                    }
                } else if (cuestion.typeSelect == 3) {
                    if (cuestion.solutionQuestion.length == 0) {
                        cuestion.solutionQuestion = 'open';
                    }
                }
            }
        }
        return true;
    },

    showQuestion: function (i) {
        let num = i < 0 ? 0 : i;
        num =
            num >= $exeDevice.temas[$exeDevice.activeTema].length
                ? $exeDevice.temas[$exeDevice.activeTema].length - 1
                : num;
        const p = $exeDevice.temas[$exeDevice.activeTema][num];
        let numOptions = 0;

        p.typeSelect = p.typeSelect ? p.typeSelect : 0;
        p.solutionQuestion = p.solutionQuestion ? p.solutionQuestion : '';
        p.percentageShow = p.percentageShow ? p.percentageShow : 35;

        if (p.typeSelect < 2) {
            $('.TRVLE-EAnwersOptions').each(function (j) {
                numOptions++;
                if (p.options[j].trim() !== '') {
                    p.numOptions = numOptions;
                }
                $(this).val(p.options[j]);
            });
        } else {
            $('#trivialESolutionWord').val(p.solutionQuestion);
            $('#trivialPercentageShow').val(p.percentageShow);
            $('#trivialEDefinitionWord').val(p.quextion);
        }

        $exeDevice.stopVideo();
        $exeDevice.showTypeQuestion(p.typeSelect);
        $exeDevice.changeTypeQuestion(p.type);
        $exeDevice.showOptions(p.numberOptions);

        $('#trivialEQuestion').val(p.quextion);
        $('#trivialENumQuestions').text(
            $exeDevice.temas[$exeDevice.activeTema].length
        );
        if (p.type == 1) {
            $('#trivialEURLImage').val(p.url);
            $('#trivialEXImage').val(p.x);
            $('#trivialEYImage').val(p.y);
            $('#trivialEAuthor').val(p.author);
            $('#trivialEAlt').val(p.alt);
            $exeDevice.showImage(p.url, p.x, p.y, p.alt);
        } else if (p.type == 2) {
            $('#trivialECheckSoundVideo').prop('checked', p.soundVideo == 1);
            $('#trivialECheckImageVideo').prop('checked', p.imageVideo == 1);
            $('#trivialEURLYoutube').val(p.url);
            $('#trivialEInitVideo').val(
                $exeDevices.iDevice.gamification.helpers.secondsToHour(p.iVideo)
            );
            $('#trivialEEndVideo').val(
                $exeDevices.iDevice.gamification.helpers.secondsToHour(p.fVideo)
            );
            $('#trivialESilenceVideo').val(
                $exeDevices.iDevice.gamification.helpers.secondsToHour(
                    p.silentVideo
                )
            );
            $('#trivialETimeSilence').val(p.tSilentVideo);
            $exeDevice.silentVideo = p.silentVideo;
            $exeDevice.tSilentVideo = p.tSilentVideo;
            $exeDevice.activeSilent =
                p.soundVideo == 1 &&
                p.tSilentVideo > 0 &&
                p.silentVideo >= p.iVideo &&
                p.iVideo < p.fVideo;
            $exeDevice.endSilent = p.silentVideo + p.tSilentVideo;
            if (
                $exeDevices.iDevice.gamification.media.getIDYoutube(p.url) ||
                $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                    p.url
                )
            ) {
                $exeDevice.showVideoQuestion();
            }
        } else if (p.type == 3) {
            tinyMCE.get('trivialEText').setContent(p.eText);
        }

        $('.TRVLE-EAnwersOptions').each(function (j) {
            var option = j < p.numOptions ? p.options[j] : '';
            $(this).val(option);
        });

        p.audio = p.audio && p.audio != 'undefined' ? p.audio : '';
        $exeDevice.stopSound();
        if (p.type != 2 && p.audio.trim().length > 4) {
            $exeDevice.playSound(p.audio.trim());
        }

        $('#trivialEURLAudio').val(p.audio);
        $('#trivialNumberQuestion').val(i + 1);
        $(
            "input.TRVLE-Number[name='tvlnumber'][value='" +
                p.numberOptions +
                "']"
        ).prop('checked', true);
        $("input.TRVLE-Type[name='tvlmediatype'][value='" + p.type + "']").prop(
            'checked',
            true
        );
        $exeDevice.checkQuestions(p.solution);
        $("input.TRVLE-Times[name='tvltime'][value='" + p.time + "']").prop(
            'checked',
            true
        );
        $(
            "input.TRVLE-TypeSelect[name='tvltypeselect'][value='" +
                p.typeSelect +
                "']"
        ).prop('checked', true);
    },

    checkQuestions: function (solution) {
        $("input.TRVLE-ESolution[name='tvlsolution']").prop('checked', false);
        for (var i = 0; i < solution.length; i++) {
            var sol = solution[i];
            $(
                "input.TRVLE-ESolution[name='tvlsolution'][value='" + sol + "']"
            ).prop('checked', true);
        }
        $('#trivialESolutionSelect').text(solution);
    },

    showVideoQuestion: function () {
        const soundVideo = $('#trivialECheckSoundVideo').is(':checked') ? 1 : 0,
            imageVideo = $('#trivialECheckImageVideo').is(':checked') ? 1 : 0,
            url = $('#trivialEURLYoutube').val().trim();
        ((id = $exeDevices.iDevice.gamification.media.getIDYoutube(url)),
            (idLocal =
                $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                    url
                )));

        let iVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                $('#trivialEInitVideo').val()
            ),
            fVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                $('#trivialEEndVideo').val()
            ),
            type = id ? 0 : 1;

        $exeDevice.silentVideo =
            $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                $('#trivialESilenceVideo').val().trim()
            );
        $exeDevice.tSilentVideo = parseInt($('#trivialETimeSilence').val());
        $exeDevice.activeSilent =
            soundVideo == 1 &&
            $exeDevice.tSilentVideo > 0 &&
            $exeDevice.silentVideo >= iVideo &&
            iVideo < fVideo;
        $exeDevice.endSilent = $exeDevice.silentVideo + $exeDevice.tSilentVideo;
        if (fVideo <= iVideo) fVideo = 36000;

        $exeDevice.hideFlex($('#trivialENoImageVideo'));
        $exeDevice.showFlex($('#trivialENoVideo'));
        $exeDevice.hideFlex($('#trivialEVideo'));
        $exeDevice.hideFlex($('#trivialEVideoLocal'));

        if (id || idLocal) {
            if (id) {
                $exeDevice.startVideo(id, iVideo, fVideo, 0);
            } else {
                $exeDevice.startVideo(idLocal, iVideo, fVideo, 1);
            }
            $exeDevice.hideFlex($('#trivialENoVideo'));
            if (imageVideo == 0) {
                $exeDevice.showFlex($('#trivialENoImageVideo'));
            } else {
                if (type == 0) {
                    $exeDevice.showFlex($('#trivialEVideo'));
                } else {
                    $exeDevice.showFlex($('#trivialEVideoLocal'));
                }
            }
            if (soundVideo == 0) {
                $exeDevices.iDevice.gamification.media.muteVideo(true);
            } else {
                $exeDevices.iDevice.gamification.media.muteVideo(false);
            }
        } else {
            $exeDevice.showMessage($exeDevice.msgs.msgVideoNotAvailable);
            $exeDevice.showFlex($('#trivialENoVideo'));
        }
    },

    drawImage: function (image, mData) {
        $(image).css({
            left: mData.x + 'px',
            top: mData.y + 'px',
            width: mData.w + 'px',
            height: mData.h + 'px',
        });
    },

    showImage: function (url, x, y, alt, type) {
        const $image = $('#trivialEImage'),
            $cursor = $('#trivialECursor');
        $exeDevice.hideFlex($image);
        $exeDevice.hideFlex($cursor);
        $image.attr('alt', alt);
        $exeDevice.showFlex($('#trivialENoImage'));
        url = $exeDevices.iDevice.gamification.media.extractURLGD(url);
        $image
            .attr('src', url)
            .on('load', function () {
                if (
                    !this.complete ||
                    typeof this.naturalWidth == 'undefined' ||
                    this.naturalWidth == 0
                ) {
                    if (type == 1) {
                        $exeDevice.showMessage(msgs.msgEURLValid);
                    }
                    return false;
                } else {
                    var mData = $exeDevice.placeImageWindows(
                        this,
                        this.naturalWidth,
                        this.naturalHeight
                    );
                    $exeDevice.drawImage(this, mData);
                    $exeDevice.showFlex($image);
                    $exeDevice.hideFlex($('#trivialENoImage'));
                    $exeDevice.paintMouse(this, $cursor, x, y);
                    return true;
                }
            })
            .on('error', function () {
                if (type == 1) {
                    $exeDevice.showMessage(msgs.msgEURLValid);
                }
                return false;
            });
    },

    paintMouse: function (image, cursor, x, y) {
        $exeDevice.hideFlex($(cursor));
        if (x > 0 || y > 0) {
            var wI = $(image).width() > 0 ? $(image).width() : 1,
                hI = $(image).height() > 0 ? $(image).height() : 1,
                lI = $(image).position().left + wI * x,
                tI = $(image).position().top + hI * y;
            $(cursor).css({
                left: lI + 'px',
                top: tI + 'px',
                'z-index': 30,
            });
            $exeDevice.showFlex($(cursor));
        }
    },

    clearQuestion: function () {
        $exeDevice.changeTypeQuestion(0);
        $exeDevice.showOptions(4);
        $exeDevice.showSolution('');

        $('.TRVLE-Type')[0].checked = true;
        $('.TRVLE-Times')[0].checked = true;
        $('.TRVLE-Number')[2].checked = true;
        $('#trivialEURLImage').val('');
        $('#trivialEXImage').val('0');
        $('#trivialEYImage').val('0');
        $('#trivialEAuthor').val('');
        $('#trivialEAlt').val('');
        $('#trivialEURLYoutube').val('');
        $('#trivialEInitVideo').val('00:00:00');
        $('#trivialEEndVideo').val('00:00:00');
        $('#trivialECheckSoundVideo').prop('checked', true);
        $('#trivialECheckImageVideo').prop('checked', true);
        $('#trivialESolutionSelect').text('');
        tinyMCE.get('trivialEText').setContent('');
        $('#trivialEQuestion').val('');
        $('#trivialESolutionWord').val('');
        $('#trivialESolutionWord').val('');
        $('#trivialEDefinitionWord').val('');
        $('.TRVLE-EAnwersOptions').each(function () {
            $(this).val('');
        });
    },

    changeNumberTemas: function (numt) {
        const value = $('#trivialNumberTema').val();
        $('#trivialNumberTema').prop('max', numt);
        if (value > numt) {
            $exeDevice.showTema(numt - 1);
        }
    },

    showTema: function (tema) {
        $exeDevice.activeTema = tema;
        $('#trivialNumberTema').val(tema + 1);
        $('#trivialNameTema').val($exeDevice.nombresTemas[tema]);
        $('#trivialLoadGame').val('');
        $exeDevice.showQuestion(
            $exeDevice.activesQuestions[$exeDevice.activeTema]
        );
    },

    changeTypeQuestion: function (type) {
        $exeDevice.hideFlex($('#trivialETitleAltImage'));
        $exeDevice.hideFlex($('#trivialEAuthorAlt'));
        $exeDevice.hideFlex($('#trivialETitleImage'));
        $exeDevice.hideFlex($('#trivialEInputImage'));
        $exeDevice.hideFlex($('#trivialETitleVideo'));
        $exeDevice.hideFlex($('#trivialEInputVideo'));
        $exeDevice.hideFlex($('#trivialEInputOptionsVideo'));
        $exeDevice.hideFlex($('#trivialInputOptionsImage'));
        $exeDevice.showFlex($('#trivialEInputAudio'));
        $exeDevice.showFlex($('#trivialETitleAudio'));
        if (tinyMCE.get('trivialEText')) {
            tinyMCE.get('trivialEText').hide();
        }
        $('#trivialEText').hide();
        $exeDevice.hideFlex($('#trivialEVideo'));
        $exeDevice.hideFlex($('#trivialEVideoLocal'));
        $exeDevice.hideFlex($('#trivialEImage'));
        $exeDevice.hideFlex($('#trivialENoImage'));
        $exeDevice.hideFlex($('#trivialECover'));
        $exeDevice.hideFlex($('#trivialECursor'));
        $exeDevice.hideFlex($('#trivialENoImageVideo'));
        $exeDevice.hideFlex($('#trivialENoVideo'));
        switch (type) {
            case 0:
                $exeDevice.showFlex($('#trivialECover'));
                break;
            case 1:
                $exeDevice.showFlex($('#trivialENoImage'));
                $exeDevice.showFlex($('#trivialETitleImage'));
                $exeDevice.showFlex($('#trivialEInputImage'));
                $exeDevice.showFlex($('#trivialEAuthorAlt'));
                $exeDevice.showFlex($('#trivialECursor'));
                $exeDevice.showFlex($('#trivialInputOptionsImage'));
                $exeDevice.showImage(
                    $('#trivialEURLImage').val(),
                    $('#trivialEXImage').val(),
                    $('#trivialEYImage').val(),
                    $('#trivialEAlt').val(),
                    0
                );
                break;
            case 2:
                $exeDevice.showFlex($('#trivialEImageVideo'));
                $exeDevice.showFlex($('#trivialETitleVideo'));
                $exeDevice.showFlex($('#trivialEInputVideo'));
                $exeDevice.showFlex($('#trivialENoVideo'));
                $exeDevice.showFlex($('#trivialEVideo'));
                $exeDevice.showFlex($('#trivialEInputOptionsVideo'));
                $exeDevice.hideFlex($('#trivialEInputAudio'));
                $exeDevice.hideFlex($('#trivialETitleAudio'));
                break;
            case 3:
                $('#trivialEText').show();
                if (tinyMCE.get('trivialEText')) {
                    tinyMCE.get('trivialEText').show();
                }
                break;
            default:
                break;
        }
    },

    showOptions: function (number) {
        $('.TRVLE-EOptionDiv').each(function (i) {
            $exeDevice.showFlex($(this));
            if (i >= number) {
                $exeDevice.hideFlex($(this));
                $exeDevice.showSolution('');
            }
        });
        $('.TRVLE-EAnwersOptions').each(function (j) {
            if (j >= number) {
                $(this).val('');
            }
        });
    },

    showSolution: function (solution) {
        $("input.TRVLE-ESolution[name='tvlsolution']").prop('checked', false);
        for (var i = 0; i < solution.length; i++) {
            var sol = solution[i];
            $('.TRVLE-ESolution')[solution].checked = true;
            $(
                "input.TRVLE-ESolution[name='tvlsolution'][value='" + sol + "']"
            ).prop('checked', true);
        }
        $('#trivialESolutionSelect').text(solution);
    },
    createForm: function () {
        const path = $exeDevice.idevicePath,
            html = `
            <div id="gameQEIdeviceForm">
                <p class="exe-block-info exe-block-dismissible" style="position:relative">
                    ${_('Create an educational board game with different question types (test, order, definition) of different categories. From 1 to 4 players or teams.')} 
                    <a href="https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe29/triviext.html" hreflang="es" target="_blank">${_('Usage Instructions')}</a>
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset($exeDevice.msgs.msgGameIntrunctions)}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_('Options')}</a></legend>
                        <div>
                            <div class="d-flex align-items-center flex-wrap mb-3 gap-2">
                                <span class="mb-0">${_('Number of topics')}: </span>
                                <div class="form-check form-check-inline mb-0">
                                    <input class="TRVLE-NumeroTemas form-check-input" checked id="trivialNG2" type="radio" name="tvlnt" value="2" />
                                    <label for="trivialNG2" class="form-check-label mb-0">2</label>
                                </div>
                                <div class="form-check form-check-inline mb-0">
                                    <input class="TRVLE-NumeroTemas form-check-input" type="radio" name="tvlnt" value="3" id="trivialNG3" />
                                    <label for="trivialNG3" class="form-check-label mb-0">3</label>
                                </div>
                                <div class="form-check form-check-inline mb-0">
                                    <input class="TRVLE-NumeroTemas form-check-input" type="radio" name="tvlnt" value="4" id="trivialNG4" />
                                    <label for="trivialNG4" class="form-check-label mb-0">4</label>
                                </div>
                                <div class="form-check form-check-inline mb-0">
                                    <input class="TRVLE-NumeroTemas form-check-input" type="radio" name="tvlnt" value="5" id="trivialNG5" />
                                    <label for="trivialNG5" class="form-check-label mb-0">5</label>
                                </div>
                                <div class="form-check form-check-inline mb-0">
                                    <input class="TRVLE-NumeroTemas form-check-input" type="radio" name="tvlnt" value="6" id="trivialNG6" />
                                    <label for="trivialNG6" class="form-check-label mb-0">6</label>
                                </div>
                            </div>
                            <div class="toggle-item mb-3">
                                <span class="toggle-control">
                                    <input type="checkbox" id="trivialEShowMinimize" class="toggle-input" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label mb-0" for="trivialEShowMinimize">${_('Show minimized.')}</label>
                            </div>
                            <div class="d-flex align-items-center flex-nowrap mb-3 gap-2 flex-wrap">
                                <div class="toggle-item mb-0">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="trivialEShowSolution" class="toggle-input" checked />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label mb-0" for="trivialEShowSolution">${_('Show solutions')}.</label>
                                </div>
                                <label for="trivialETimeShowSolution" class="mb-0">${_('Show solution time (seconds)')}</label>
                                <input type="number" name="trivialETimeShowSolution" id="trivialETimeShowSolution" value="3" min="1" max="9" class="form-control" style="width:6ch" />
                            </div>
                            <div class="toggle-item mb-3">
                                <span class="toggle-control">
                                    <input type="checkbox" id="trivialModeBoard" class="toggle-input" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label mb-0" for="trivialModeBoard">${_('Digital whiteboard mode')}</label>
                            </div>
                            <div class="d-flex align-items-center gap-2 mb-3">
                                <label for="trivialEGlobalTimes">${_('Time per question')}:</label>
                                <select id="trivialEGlobalTimes" class="form-select form-select-sm" style="max-width:10ch">
                                    <option value="0" selected>15s</option>
                                    <option value="1">30s</option>
                                    <option value="2">1m</option>
                                    <option value="3">3m</option>
                                    <option value="4">5m</option>
                                    <option value="5">10m</option>
                                </select>
                                <button id="trivialGlobalTimeButton" class="btn btn-primary" type="button">${_('Accept')}</button> 
                            </div>
                            <div class="Games-Reportdiv d-flex align-items-center flex-nowrap gap-2 mb-3 flex-wrap">
                                <div class="toggle-item mb-0">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="trivialEEvaluation" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label mb-0" for="trivialEEvaluation">${_('Progress report')}.</label>
                                </div>
                                <div class="d-flex align-items-center flex-nowrap gap-2" id="trivialEEvaluationIDWrapper">
                                    <label for="trivialEEvaluationID" class="mb-0">${_('Identifier')}:</label>
                                    <input type="text" id="trivialEEvaluationID" disabled value="${eXeLearning.app.project.odeId || ''}" class="form-control" />
                                </div>
                                <strong class="GameModeLabel">
                                    <a href="#trivialEEvaluationHelp" id="trivialEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                        <img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}" />
                                    </a>
                                </strong>
                            </div>
                            <p id="trivialEEvaluationHelp" class="TRVLE-TypeGameHelp exe-block-info">
                                ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                            </p>
                        </div>
                    </fieldset>
                    <fieldset class="exe-fieldset">
                        <legend><a href="#">${_('Questions')}</a></legend>
                        <div class="TRVLE-EPanel" id="trivialEPanel">
                            <div class="TRVLE-EOptionsMedia">
                                <div class="TRVLE-EOptionsGame">                                    
                                    <div class="TRVLE-ENameTema d-flex align-items-center flex-nowrap gap-2 mb-3">
                                        <span>${_('Topic')}:</span>
                                        <label class="sr-av" for="trivialNumberTema">${_('Topic number')}</label>
                                         <input type="number" class="form-control me-0" name="trivialNumberTema" id="trivialNumberTema" value="1" min="1" max="2" step="1" style="width:6ch" /> 
                                        <label class="sr-av" for="trivialNameTema">${_('Topic number')}</label>
                                        <input type="text" id="trivialNameTema" class="form-control w-100" />
                                    </div>
                                    <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                                        <span>${_('Load')}:</span><input type="file" name="trivialLoadGame" id="trivialLoadGame" accept=".json" />
                                    </div>                                    
                                    <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                                        <span>${_('Type')}:</span>
                                        <div class="form-check form-check-inline mb-0">
                                            <input class="TRVLE-TypeSelect form-check-input" checked id="trivialTypeChoose" type="radio" name="tvltypeselect" value="0"/>
                                            <label for="trivialTypeChoose" class="form-check-label">${_('Select')}</label>
                                        </div>
                                        <div class="form-check form-check-inline mb-0">
                                            <input class="TRVLE-TypeSelect form-check-input" id="trivialTypeOrders" type="radio" name="tvltypeselect" value="1"/>
                                            <label for="trivialTypeOrders" class="form-check-label">${_('Order')}</label>
                                        </div>
                                        <div class="form-check form-check-inline mb-0">
                                            <input class="TRVLE-TypeSelect form-check-input" id="trivialTypeWord" type="radio" name="tvltypeselect" value="2"/>
                                            <label for="trivialTypeWord" class="form-check-label">${_('Word')}</label>
                                        </div>
                                        <div class="form-check form-check-inline mb-0">
                                            <input class="TRVLE-TypeSelect form-check-input" id="trivialTypeOpen" type="radio" name="tvltypeselect" value="3"/>
                                            <label for="trivialTypeOpen" class="form-check-label">${_('Free response')}</label>
                                        </div>
                                    </div>                                    
                                    <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                                        <span>${_('Multimedia Type')}:</span>
                                        <div class="form-check form-check-inline mb-0">
                                            <input class="TRVLE-Type form-check-input" checked id="trivialMediaNormal" type="radio" name="tvlmediatype" value="0" disabled />
                                            <label for="trivialMediaNormal" class="form-check-label">${_('None')}</label>
                                        </div>
                                        <div class="form-check form-check-inline mb-0">
                                            <input class="TRVLE-Type form-check-input" id="trivialMediaImage" type="radio" name="tvlmediatype" value="1" disabled />
                                            <label for="trivialMediaImage" class="form-check-label">${_('Image')}</label>
                                        </div>
                                        <div class="form-check form-check-inline mb-0">
                                            <input class="TRVLE-Type form-check-input" id="trivialMediaVideo" type="radio" name="tvlmediatype" value="2" disabled />
                                            <label for="trivialMediaVideo" class="form-check-label">${_('Video')}</label>
                                        </div>
                                        <div class="form-check form-check-inline mb-0">
                                            <input class="TRVLE-Type form-check-input" id="trivialMediaText" type="radio" name="tvlmediatype" value="3" disabled />
                                            <label for="trivialMediaText" class="form-check-label">${_('Text')}</label>
                                        </div>
                                    </div>
                                    <div class="d-flex align-items-center flex-wrap gap-2 mb-3" id="trivialEInputNumbers">
                                        <span id="trivialOptionsNumberSpan">${_('Options Number')}:</span>    
                                        <div class="form-check form-check-inline mb-0">
                                            <input class="TRVLE-Number form-check-input" id="numQ2" type="radio" name="tvlnumber" value="2" />
                                            <label for="numQ2" class="form-check-label">2</label>
                                        </div>
                                        <div class="form-check form-check-inline mb-0">
                                            <input class="TRVLE-Number form-check-input" id="numQ3" type="radio" name="tvlnumber" value="3" />
                                            <label for="numQ3" class="form-check-label">3</label>
                                        </div>
                                        <div class="form-check form-check-inline mb-0">
                                            <input class="TRVLE-Number form-check-input" id="numQ4" type="radio" name="tvlnumber" value="4" checked />
                                            <label for="numQ4" class="form-check-label">4</label>
                                        </div>
                                    </div>                                    
                                    <div class="d-none align-items-center flex-wrap gap-2 mb-3" id="trivialPercentage">
                                        <span id="trivialPercentageSpan">${_('Percentage of letters to show (%)')}:</span>
                                        <input type="number" name="trivialPercentageShow" id="trivialPercentageShow" value="35" min="0" max="100" step="5" />
                                    </div>                                    
                                    <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                                        <span>${_('Time per question')}:</span>
                                        <div class="form-check form-check-inline mb-0">
                                            <input class="TRVLE-Times form-check-input" checked id="q15s" type="radio" name="tvltime" value="0" />
                                            <label for="q15s" class="form-check-label">15s</label>
                                        </div>
                                        <div class="form-check form-check-inline mb-0">
                                            <input class="TRVLE-Times form-check-input" id="q30s" type="radio" name="tvltime" value="1" />
                                            <label for="q30s" class="form-check-label">30s</label>
                                        </div>
                                        <div class="form-check form-check-inline mb-0">
                                            <input class="TRVLE-Times form-check-input" id="q1m" type="radio" name="tvltime" value="2" />
                                            <label for="q1m" class="form-check-label">1m</label>
                                        </div>
                                        <div class="form-check form-check-inline mb-0">
                                            <input class="TRVLE-Times form-check-input" id="q3m" type="radio" name="tvltime" value="3" />
                                            <label for="q3m" class="form-check-label">3m</label>
                                        </div>
                                        <div class="form-check form-check-inline mb-0">
                                            <input class="TRVLE-Times form-check-input" id="q5m" type="radio" name="tvltime" value="4" />
                                            <label for="q5m" class="form-check-label">5m</label>
                                        </div>
                                        <div class="form-check form-check-inline mb-0">
                                            <input class="TRVLE-Times form-check-input" id="q10m" type="radio" name="tvltime" value="5" />
                                            <label for="q10m" class="form-check-label">10m</label>
                                        </div>
                                    </div>
                                    
                                    <div class="d-none align-items-center flex-nowrap gap-2 mb-3" id="trivialEInputImage">
                                        <span class="text-nowrap" id="trivialETitleImage">${_('URL')}</span>
                                        <label class="sr-av" for="trivialEURLImage">${_('Image URL')}</label>
                                        <input type="text" class="exe-file-picker TRVLE-EURLImage form-control me-0 w-100" id="trivialEURLImage"/>
                                        <a href="#" id="trivialEPlayImage" class="TRVLE-ENavigationButton TRVLE-EPlayVideo" title="${_('Play')}">
                                            <img src="${path}quextIEPlay.png" alt="${_('Play')}" class="TRVLE-EButtonImage " />
                                        </a>
                                    </div>
                                    <div class="d-none"  id="trivialInputOptionsImage">
                                        <div class="TRVLE-ECoord">
                                            <label for="trivialEXImage">X:</label>
                                            <input id="trivialEXImage" type="text" value="0" class="form-control" style="width:6ch" />
                                            <label for="trivialEYImage">Y:</label>
                                            <input id="trivialEYImage" type="text" value="0" class="form-control" style="width:6ch" />
                                        </div>
                                    </div>                                    
                                    <div class="d-none align-items-center flex-nowrap gap-2 mb-3" id="trivialEInputVideo">
                                        <span class="text-nowrap" id="trivialETitleVideo">${_('URL')}</span>    
                                        <label class="sr-av" for="trivialEURLYoutube">${_('URL')}</label>
                                        <input id="trivialEURLYoutube" type="text" class="form-control me-0 w-100" />
                                        <a href="#" id="trivialEPlayVideo" class="TRVLE-ENavigationButton TRVLE-EPlayVideo" title="${_('Play video')}">
                                            <img src="${path}quextIEPlay.png" alt="${_('Play')}" class="TRVLE-EButtonImage" />
                                        </a>
                                    </div>
                                    <div class="TRVLE-EInputOptionsVideo" id="trivialEInputOptionsVideo">
                                        <div class="d-flex align-items-center flex-nowrap gap-2 mb-3">
                                            <label for="trivialEInitVideo">${_('Start')}:</label>
                                            <input id="trivialEInitVideo" type="text" value="00:00:00" maxlength="8" class="form-control w-auto" style="min-width:10ch; max-width:10ch;" />
                                            <label for="trivialEEndVideo">${_('End')}:</label>
                                            <input id="trivialEEndVideo" type="text" value="00:00:00" maxlength="8" class="form-control w-auto" style="min-width:10ch; max-width:10ch";" />
                                            <button class="btn btn-primary" id="trivialEVideoTime" type="button">00:00:00</button>
                                        </div>
                                        <div class="d-flex align-items-center flex-nowrap gap-2 mb-3">
                                            <label for="trivialESilenceVideo">${_('Silence')}:</label>
                                            <input id="trivialESilenceVideo" type="text" value="00:00:00" maxlength="8" class="form-control" style="min-width:10ch; max-width:10ch"/>
                                            <label for="trivialETimeSilence">${_('Time (s)')}:</label>
                                            <input type="number" name="trivialETimeSilence" id="trivialETimeSilence" value="0" min="0" max="120" class="form-control" />
                                        </div>
                                        <div class="d-flex align-items-center flex-nowrap gap-2 mb-3">
                                            <div class="toggle-item mb-0">
                                                <span class="toggle-control">
                                                    <input id="trivialECheckSoundVideo" class="toggle-input" type="checkbox" checked="checked" />
                                                    <span class="toggle-visual"></span>
                                                </span>
                                                <label class="toggle-label mb-0" for="trivialECheckSoundVideo">${_('Audio')}</label>
                                            </div>
                                            <div class="toggle-item mb-0">
                                                <span class="toggle-control">
                                                    <input id="trivialECheckImageVideo" class="toggle-input" type="checkbox" checked="checked" />
                                                    <span class="toggle-visual"></span>
                                                </span>
                                                <label class="toggle-label mb-0" for="trivialECheckImageVideo">${_('Image')}</label>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="d-none align-items-center flex-nowrap gap-2 mb-3" id="trivialEAuthorAlt">
                                        <div class="TRVLE-EInputAuthor w-50" id="trivialInputAuthor">
                                            <label for="trivialEAuthor">${_('Authorship')}</label>
                                            <input id="trivialEAuthor" type="text" class="form-control w-100" />
                                        </div>
                                        <div class="TRVLE-EInputAlt w-50" id="trivialInputAlt">
                                            <label for="trivialEAlt">${_('Alternative text')}</label>
                                            <input id="trivialEAlt" type="text" class="form-control w-100" />
                                        </div>
                                    </div>                                    
                                    <div class="d-flex align-items-center flex-nowrap gap-2 mb-3" id="trivialEInputAudio">
                                        <span id="trivialETitleAudio">${_('Audio')}:</span>
                                        <label class="sr-av" for="trivialEURLAudio">${_('URL')}</label>
                                        <input type="text" class="exe-file-picker TRVLE-EURLAudio form-control w-100 me-0" id="trivialEURLAudio"/>
                                        <a href="#" id="trivialEPlayAudio" class="TRVLE-ENavigationButton TRVLE-EPlayVideo" title="${_('Audio')}">
                                            <img src="${path}quextIEPlay.png" alt="${_('Play')}" class="TRVLE-EButtonImage " />
                                        </a>
                                    </div>
                                </div>
                                <div class="TRVLE-EMultiMediaOption">
                                    <div class="TRVLE-EMultimedia" id="trivialEMultimedia">
                                        <textarea id="trivialEText"></textarea>
                                        <img class="TRVLE-EMedia" src="${path}quextIEImage.png" id="trivialEImage" alt="${_('Image')}" />
                                        <img class="TRVLE-EMedia" src="${path}quextIEImage.png" id="trivialENoImage" alt="${_('No image')}" />
                                        <div class="TRVLE-EMedia" id="trivialEVideo"></div>
                                        <video class="TRVLE-EMedia" id="trivialEVideoLocal" preload="auto" controls></video>
                                        <img class="TRVLE-EMedia" src="${path}quextIENoImageVideo.png" id="trivialENoImageVideo" alt="" />
                                        <img class="TRVLE-EMedia" src="${path}quextIENoVideo.png" id="trivialENoVideo" alt="" />
                                        <img class="TRVLE-ECursor" src="${path}quextIECursor.gif" id="trivialECursor" alt="" />
                                        <img class="TRVLE-EMedia" src="${path}quextIECoverTrivial.png" id="trivialECover" alt="${_('No image')}" />
                                    </div>
                                </div>
                            </div>
                            <div class="TRVLE-EContents">
                                <div id="trivialESolitionOptions" class="TRVLE-SolitionOptionsDiv">
                                    <span>${_('Question')}:</span>
                                    <span>
                                        <span>${_('Solution')}: </span>
                                        <span id="trivialESolutionSelect"></span>
                                    </span>
                                </div>
                                <div class="TRVLE-EQuestionDiv" id="trivialEQuestionDiv">
                                    <label for="trivialEQuestion" class="sr-av">${_('Question')}:</label>
                                    <input type="text" class="TRVLE-EQuestion form-control" id="trivialEQuestion">
                                </div>
                                <div class="TRVLE-EAnswers" id="trivialEAnswers">
                                    <div class="TRVLE-EOptionDiv">
                                        <label for="trivialESolution0" class="sr-av">${_('Solution')} A:</label>
                                        <input type="checkbox" class="TRVLE-ESolution me-1" name="tvlsolution" id="trivialESolution0" value="A" />
                                        <label for="trivialEOption0" >A</label>
                                        <input type="text" class="TRVLE-EOption0 TRVLE-EAnwersOptions form-control" id="trivialEOption0">
                                    </div>
                                    <div class="TRVLE-EOptionDiv">
                                        <label for="trivialESolution1" class="sr-av">${_('Solution')} B:</label>
                                        <input type="checkbox" class="TRVLE-ESolution me-1" name="tvlsolution" id="trivialESolution1" value="B" />
                                        <label for="trivialEOption1" >B</label>
                                        <input type="text" class="TRVLE-EOption1 TRVLE-EAnwersOptions form-control" id="trivialEOption1">
                                    </div>
                                    <div class="TRVLE-EOptionDiv">
                                        <label for="trivialESolution2" class="sr-av">${_('Solution')} C:</label>
                                        <input type="checkbox" class="TRVLE-ESolution me-1" name="tvlsolution" id="trivialESolution2" value="C" />
                                        <label for="trivialEOption2" >C</label>
                                        <input type="text" class="TRVLE-EOption2 TRVLE-EAnwersOptions form-control" id="trivialEOption2">
                                    </div>
                                    <div class="TRVLE-EOptionDiv">
                                        <label for="trivialESolution3" class="sr-av">${_('Solution')} D:</label>
                                        <input type="checkbox" class="TRVLE-ESolution me-1" name="tvlsolution" id="trivialESolution3" value="D" />
                                        <label for="trivialEOption3" >D</label>
                                        <input type="text" class="TRVLE-EOption3 TRVLE-EAnwersOptions form-control" id="trivialEOption3">
                                    </div>
                                </div>
                                <div class="TRVLE-EWordDiv TRVLE-DP" id="trivialEWordDiv">
                                    <div class="TRVLE-ESolutionWord">
                                        <label for="trivialESolutionWord">${_('Word/Phrase')}: </label>
                                        <input type="text" id="trivialESolutionWord" class="form-control"/>
                                    </div>
                                    <div class="TRVLE-ESolutionWord">
                                        <label for="trivialEDefinitionWord">${_('Definition')}: </label>
                                        <input type="text" id="trivialEDefinitionWord" class="form-control"/>
                                    </div>
                                </div>
                            </div>
                            <div class="TRVLE-ENavigationButtons gap-2">
                                <a href="#" id="trivialEAdd" class="TRVLE-ENavigationButton" title="${_('Add question')}">
                                    <img src="${path}quextIEAdd.png" alt="${_('Add question')}" class="TRVLE-EButtonImage b-add" />
                                </a>
                                <a href="#" id="trivialEFirst" class="TRVLE-ENavigationButton" title="${_('First question')}">
                                    <img src="${path}quextIEFirst.png" alt="${_('First question')}" class="TRVLE-EButtonImage b-first" />
                                </a>
                                <a href="#" id="trivialEPrevious" class="TRVLE-ENavigationButton" title="${_('Previous question')}">
                                    <img src="${path}quextIEPrev.png" alt="${_('Previous question')}" class="TRVLE-EButtonImage b-prev" />
                                </a>
                                <label class="sr-av" for="trivialNumberQuestion">${_('Question number:')}:</label>
                                <input type="text" class="TRVLE-NumberQuestion form-control" id="trivialNumberQuestion" value="1" style="width:6ch"/>
                                <a href="#" id="trivialENext" class="TRVLE-ENavigationButton" title="${_('Next question')}">
                                    <img src="${path}quextIENext.png" alt="${_('Next question')}" class="TRVLE-EButtonImage b-next" />
                                </a>
                                <a href="#" id="trivialELast" class="TRVLE-ENavigationButton" title="${_('Last question')}">
                                    <img src="${path}quextIELast.png" alt="${_('Last question')}" class="TRVLE-EButtonImage b-last" />
                                </a>
                                <a href="#" id="trivialEDelete" class="TRVLE-ENavigationButton" title="${_('Delete question')}">
                                    <img src="${path}quextIEDelete.png" alt="${_('Delete question')}" class="TRVLE-EButtonImage b-delete" />
                                </a>
                                <a href="#" id="trivialECopy" class="TRVLE-ENavigationButton" title="${_('Copy question')}">
                                    <img src="${path}quextIECopy.png" alt="${_('Copy question')}" class="TRVLE-EButtonImage b-copy" />
                                </a>
                                <a href="#" id="trivialECut" class="TRVLE-ENavigationButton" title="${_('Cut question')}">
                                    <img src="${path}quextIECut.png" alt="${_('Cut question')}" class="TRVLE-EButtonImage b-cut" />
                                </a>
                                <a href="#" id="trivialEPaste" class="TRVLE-ENavigationButton" title="${_('Paste question')}">
                                    <img src="${path}quextIEPaste.png" alt="${_('Paste question')}" class="TRVLE-EButtonImage b-paste" />
                                </a>
                            </div>
                            <div class="TRVLE-ENumQuestionDiv" id="trivialENumQuestionDiv">
                                <div class="TRVLE-ENumQ">
                                    <span class="sr-av">${_('Number of questions:')}</span>
                                </div>
                                <span class="TRVLE-ENumQuestions" id="trivialENumQuestions">0</span>
                            </div>
                        </div>
                    </fieldset>
                        ${$exeDevicesEdition.iDevice.common.getTextFieldset('after')}
                </div>
                    ${$exeDevicesEdition.iDevice.gamification.itinerary.getTab()}
                    ${$exeDevicesEdition.iDevice.gamification.scorm.getTab()}
                    ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
                    <p class="exe-block-warning exe-block-dismissible" style="position:relative">
                        ${_('This game may present accessibility problems for some users. You should provide an accessible alternative if the users need it.')}
                        <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>x</a>
                    </p>
                </div>
            </div>
        `;

        this.ideviceBody.innerHTML = html;

        $exeDevicesEdition.iDevice.tabs.init('gameQEIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();
        tinymce.init({
            selector: '#trivialEText',
            height: 220,
            language: 'all',
            width: 400,
            plugins: ['code paste textcolor'],
            paste_as_text: true,
            entity_encoding: 'raw',
            toolbar:
                'undo redo | removeformat | fontselect | formatselect | fontsizeselect |  bold italic underline |  alignleft aligncenter alignright alignjustify | forecolor backcolor ',
            fontsize_formats: '8pt 10pt 12pt 14pt 18pt 24pt 36pt',
            menubar: false,
            statusbar: false,
            setup: function (ed) {
                ed.on('init', function (e) {
                    $exeDevice.enableForm();
                });
            },
        });

        $('#eXeGamePercentajeClue option[value=100]').attr(
            'selected',
            'selected'
        );
        $('#labelPercentajeClue').hide();
        $('#eXeGamePercentajeClue').hide();
        $('#eXeGameSCORMButtonSave').hide();
        $('label[for="eXeGameSCORMButtonSave"]').hide();
    },

    validTime: function (time) {
        const reg = /^(?:(?:([01]?\d|2[0-3]):)?([0-5]?\d):)?([0-5]?\d)$/;
        return time.length == 8 && reg.test(time);
    },

    initQuestions: function () {
        $('#trivialEInputVideo').css('display', 'flex');
        $('#trivialEInputImage').css('display', 'flex');
        $('#trivialMediaNormal').prop('disabled', false);
        $('#trivialMediaImage').prop('disabled', false);
        $('#trivialMediaText').prop('disabled', false);

        let temas = [];
        for (let i = 0; i < 6; i++) {
            let tema = [];
            const question = this.getCuestionDefault();
            tema.push(question);
            temas.push(tema);
        }

        $exeDevice.temas = temas;
        $exeDevice.activeTema = 0;
        $exeDevice.activesQuestions = [0, 0, 0, 0, 0, 0];
        $exeDevice.numeroTemas = 2;
        $exeDevice.showTema(0);
        $exeDevice.changeTypeQuestion(0);
        $exeDevice.showOptions(4);
        $exeDevice.showSolution('');
        $exeDevice.showTypeQuestion(0);
        this.localPlayer = document.getElementById('trivialEVideoLocal');
    },

    getCuestionDefault: function () {
        return {
            typeSelect: 0,
            type: 0,
            time: 0,
            numberOptions: 4,
            url: '',
            x: 0,
            y: 0,
            author: '',
            alt: '',
            soundVideo: 1,
            imageVideo: 1,
            iVideo: 0,
            fVideo: 0,
            eText: '',
            quextion: '',
            options: ['', '', '', ''],
            solution: '',
            silentVideo: 0,
            tSilentVideo: 0,
            solutionQuestion: '',
            percentageShow: 35,
            audio: '',
        };
    },

    getCuestionEncriptada: function (q) {
        return {
            a: q.alt,
            b: q.silentVideo,
            c: q.typeSelect,
            d: q.tSilentVideo,
            f: q.iVideo,
            g: q.percentageShow,
            h: q.author,
            i: q.imageVideo,
            j: q.soundVideo,
            m: q.time,
            n: q.numberOptions,
            o: q.options.slice(0, 4),
            p: q.type,
            q: q.quextion,
            r: window.btoa(encodeURIComponent(q.solutionQuestion)),
            s: window.btoa(
                encodeURIComponent(q.quextion.length.toString() + q.solution)
            ),
            t: q.eText,
            u: q.url,
            x: q.x,
            y: q.y,
            z: q.fVideo,
            ad: q.audio,
        };
    },

    getCuestionDesEncriptada: function (q) {
        const qsDecoded = unescape(window.atob(q.s)),
            len = q.q.length.toString().length,
            solution = qsDecoded.slice(len);

        return {
            alt: q.a,
            silentVideo: q.b,
            typeSelect: q.c,
            tSilentVideo: q.d,
            iVideo: q.f,
            percentageShow: q.g,
            author: q.h,
            imageVideo: q.i,
            soundVideo: q.j,
            time: q.m,
            numberOptions: q.n,
            options: q.o.slice(0, 4),
            type: q.p,
            quextion: q.q,
            solutionQuestion: $exeDevice.fixIfNeeded(
                unescape(window.atob(q.r))
            ),
            solution: $exeDevice.fixIfNeeded(solution),
            eText: q.t,
            url: q.u,
            x: q.x,
            y: q.y,
            fVideo: q.z,
            audio: q.ad,
        };
    },

    fixIfNeeded: function (str) {
        const misencodedSequences = [
            'Ã¡',
            'Ã©',
            'Ã­',
            'Ã³',
            'Ãº',
            'Ã±',
            'Ã',
            'Ã‰',
            'Ã',
            'Ã“',
            'Ãš',
            'Ã‘',
            'Ã¼',
            'Ãœ',
            'Ã§',
            'Ã‡',
            'Â¿',
            'Â¡',
            'Âº',
            'Âª',
            'Â',
            'Ã',
        ];
        const found = misencodedSequences.some((seq) => str.includes(seq));
        if (found) {
            try {
                return decodeURIComponent(escape(str));
            } catch (e) {
                return str;
            }
        }
        return str;
    },

    isJsonString: function (str) {
        try {
            var o = JSON.parse(str, null, 2);
            if (o && typeof o === 'object') {
                return o;
            }
        } catch (e) {}
        return false;
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            $exeDevice.activesQuestions = [0, 0, 0, 0, 0, 0];

            const wrapper = $('<div></div>');
            wrapper.html(originalHTML);
            let json = $('.trivial-DataGame', wrapper).text(),
                dataGame =
                    $exeDevices.iDevice.gamification.helpers.isJsonString(json);

            dataGame = $exeDevice.Decrypt(dataGame);
            dataGame.modeBoard =
                typeof dataGame.modeBoard == 'undefined'
                    ? false
                    : dataGame.modeBoard;

            for (let i = 0; i < dataGame.numeroTemas; i++) {
                let tema = dataGame.temas[i];
                for (let j = 0; j < tema.length; j++) {
                    tema[j].audio =
                        typeof tema[j].audio == 'undefined'
                            ? ''
                            : tema[j].audio;
                }

                for (let j = 0; j < tema.length; j++) {
                    if (tema[j].type == 3) {
                        tema[j].eText = tema[j].eText;
                    }
                }

                const iq = parseInt($(this).text());
                (($imagesLink = $('.trivial-LinkImages-' + i, wrapper)),
                    ($audiosLink = $('.trivial-LinkAudios-' + i, wrapper)));
                $imagesLink.each(function () {
                    const iq = parseInt($(this).text());
                    if (!isNaN(iq) && iq < tema.length) {
                        tema[iq].url = $(this).attr('href');
                        if (tema[iq].url.length < 4 && tema[iq].type == 1) {
                            tema[iq].url = '';
                        }
                    }
                });

                $audiosLink.each(function () {
                    const iq = parseInt($(this).text());
                    if (!isNaN(iq) && iq < tema.length) {
                        tema[iq].audio = $(this).attr('href');
                        if (tema[iq].audio.length < 4) {
                            tema[iq].audio = '';
                        }
                    }
                });
                $exeDevice.temas[i] = tema;
            }

            dataGame.temas = $exeDevice.temas;
            $exeDevice.numeroTemas = dataGame.numeroTemas;

            let instructions = $('.trivial-instructions', wrapper);
            if (instructions.length == 1) {
                instructions = instructions.html() || '';
                $('#eXeGameInstructions').val(instructions);
            }

            let textAfter = $('.trivial-extra-content', wrapper);
            if (textAfter.length == 1) {
                textAfter = textAfter.html() || '';
                $('#eXeIdeviceTextAfter').val(textAfter);
            }

            // i18n
            $exeDevicesEdition.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs
            );
            $exeDevice.changeNumberTemas(dataGame.numeroTemas);
            $exeDevice.updateFieldGame(dataGame);
        }
    },

    updateFieldGame: function (game) {
        $exeDevice.activeTema = 0;
        $exeDevice.activesQuestions = [0, 0, 0, 0, 0, 0];
        $exeDevice.temas = game.temas;
        $exeDevice.nombresTemas = game.nombresTemas;
        $exeDevicesEdition.iDevice.gamification.itinerary.setValues(
            game.itinerary
        );
        game.evaluation =
            typeof game.evaluation != 'undefined' ? game.evaluation : false;
        game.evaluationID =
            typeof game.evaluationID != 'undefined' ? game.evaluationID : '';
        $exeDevice.trivialID =
            typeof game.trivialID == 'undefined'
                ? $exeDevice.trivialID
                : game.trivialID;
        game.answersRamdon = game.answersRamdon || false;
        $exeDevice.id =
            typeof game.id !== 'undefined'
                ? game.id
                : $exeDevice.getIdeviceID();
        game.globalTime =
            typeof game.globalTime != 'undefined' ? game.globalTime : 0;
        game.weighted =
            typeof game.weighted != 'undefined' ? game.weighted : 100;
        $('#eXeGamePercentajeClue option[value=100]').attr(
            'selected',
            'selected'
        );
        $('#eXeGamePercentajeClue').val(100);
        $(
            "input.TRVLE-NumeroTemas[name='tvlnt'][value='" +
                game.numeroTemas +
                "']"
        ).prop('checked', true);
        $('#trivialEShowMinimize').prop('checked', game.showMinimize);
        $('#trivialEShowSolution').prop('checked', game.showSolution);
        $('#trivialETimeShowSolution').prop('disabled', !game.showSolution);
        $('#trivialETimeShowSolution').val(game.timeShowSolution);
        $('#trivialModeBoard').prop('checked', game.modeBoard);
        $('#trivialNumberTema').val(1);
        $('#trivialLoadGame').val('');
        $('#trivialNameTema').val(game.nombresTemas[0]);
        $('#trivialEEvaluation').prop('checked', game.evaluation);
        $('#trivialEEvaluationID').val(game.evaluationID);
        $('#trivialEEvaluationID').prop('disabled', !game.evaluation);
        $('#trivialEGlobalTimes').val(game.globalTime);

        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted
        );
        $exeDevice.showQuestion(
            $exeDevice.activesQuestions[$exeDevice.activeTema]
        );
    },

    save: function () {
        if (!$exeDevice.validateQuestion()) return false;

        var dataGame = this.validateData();

        if (!dataGame) return false;

        let fields = this.ci18n,
            i18n = fields;
        for (let i in fields) {
            let fVal = $('#ci18n_' + i).val();
            if (fVal != '') i18n[i] = fVal;
        }

        dataGame.msgs = i18n;

        let instructions = tinyMCE.get('eXeGameInstructions').getContent(),
            divIntrunstion =
                instructions != ''
                    ? '<div class="trivial-instructions">' +
                      instructions +
                      '</div>'
                    : '',
            linksImages = $exeDevice.createlinksImage(dataGame),
            linksAudios = $exeDevice.createlinksAudio(dataGame);

        let html = '<div class="trivial-IDevice">';
        html += divIntrunstion;
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html +=
            '<div class="trivial-DataGame js-hidden">' +
            $exeDevice.Encrypt(dataGame) +
            '</div>';
        html += linksImages;
        html += linksAudios;

        const textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();
        if (textAfter != '') {
            html +=
                '<div class="trivial-extra-content">' + textAfter + '</div>';
        }
        html +=
            '<div class="trivial-bns js-hidden">' +
            $exeDevice.msgs.msgNoSuportBrowser +
            '</div>';
        html += '</div>';
        if (html.length > 650000) {
            $exeDevice.showMessage($exeDevice.msgs.tooManyQuestions);
            return false;
        }
        return html;
    },

    validateAlt: function () {
        let altImage = $('#trivialEAlt').val();
        if (!$exeDevice.checkAltImage || altImage !== '') return true;
        if (altImage !== '') return true;

        eXe.app.confirm(
            $exeDevice.msgs.msgTitleAltImageWarning,
            $exeDevice.msgs.msgAltImageWarning,
            function () {
                $exeDevice.checkAltImage = false;
                let saveButton = document.getElementsByClassName(
                    'button-save-idevice'
                )[0];
                saveButton.click();
            }
        );
        return false;
    },

    Encrypt: function (game) {
        let nombres = [],
            temas = [];

        for (let z = 0; z < game.numeroTemas; z++) {
            nombres.push(game.nombresTemas[z]);
            let tema = game.temas[z],
                ntema = [];
            for (let i = 0; i < tema.length; i++) {
                const mquestion = $exeDevice.getCuestionEncriptada(tema[i]);
                ntema.push(mquestion);
            }
            temas.push(ntema);
        }

        const data = {
            asignatura: '',
            author: '',
            authorVideo: '',
            typeGame: 'Trivial',
            endVideo: game.endVideo,
            idVideo: game.idVideo,
            startVideo: game.idVideo,
            instructionsExe: game.instructionsExe,
            instructions: game.instructions,
            showMinimize: game.showMinimize,
            optionsRamdon: game.optionsRamdon,
            answersRamdon: game.answersRamdon,
            showSolution: game.showSolution,
            timeShowSolution: game.timeShowSolution,
            useLives: game.useLives,
            numberLives: game.numberLives,
            itinerary: game.itinerary,
            numeroTemas: game.numeroTemas,
            nombresTemas: game.nombresTemas,
            temas: temas,
            isScorm: game.isScorm,
            textButtonScorm: game.textButtonScorm,
            repeatActivity: game.repeatActivity,
            weighted: game.weighted || 100,
            title: '',
            customScore: game.customScore,
            textAfter: game.textAfter,
            msgs: game.msgs,
            trivialID: game.trivialID,
            version: game.version,
            modeBoard: game.modeBoard,
            evaluation: game.evaluation,
            evaluationID: game.evaluationID,
            id: game.id,
        };
        return JSON.stringify(data);
    },

    Decrypt: function (game) {
        let nombres = [],
            temas = [];

        for (let z = 0; z < game.numeroTemas; z++) {
            nombres.push(game.nombresTemas[z]);
            let tema = game.temas[z],
                ntema = [];
            for (let i = 0; i < tema.length; i++) {
                const mquestion = $exeDevice.getCuestionDesEncriptada(tema[i]);
                ntema.push(mquestion);
            }
            temas.push(ntema);
        }

        var data = {
            asignatura: '',
            author: '',
            authorVideo: '',
            typeGame: 'Trivial',
            endVideo: game.endVideo,
            idVideo: game.idVideo,
            startVideo: game.idVideo,
            instructionsExe: game.instructionsExe,
            instructions: game.instructions,
            showMinimize: game.showMinimize,
            optionsRamdon: game.optionsRamdon,
            answersRamdon: game.answersRamdon,
            showSolution: game.showSolution,
            timeShowSolution: game.timeShowSolution,
            useLives: game.useLives,
            numberLives: game.numberLives,
            itinerary: game.itinerary,
            numeroTemas: game.numeroTemas,
            nombresTemas: game.nombresTemas,
            temas: temas,
            isScorm: game.isScorm,
            textButtonScorm: game.textButtonScorm,
            repeatActivity: game.repeatActivity,
            weighted: game.weighted || 100,
            title: '',
            customScore: game.customScore,
            textAfter: game.textAfter,
            msgs: game.msgs,
            trivialID: game.trivialID,
            version: game.version,
            modeBoard: game.modeBoard,
            evaluation: game.evaluation,
            evaluationID: game.evaluationID,
            id: game.id,
        };
        return data;
    },

    insertSpace: function (encr, index, space) {
        if (index > 0) {
            return encr.substring(0, index) + space + encr.substr(index);
        }
        return encr;
    },

    borrarCuestion: function () {
        const numberOptions = parseInt(
                $('input[name=tvlnumber]:checked').val()
            ),
            typeSelect = parseInt($('input[name=tvltypeselect]:checked').val()),
            quextion = $('#trivialEQuestion').val().trim();
        let options = [],
            optionEmpy = false;

        $('.TRVLE-EAnwersOptions').each(function (i) {
            const option = $(this).val().trim();
            if (i < numberOptions && option.length == 0) {
                optionEmpy = true;
            }
            options.push(option);
        });

        if (quextion.length > 0) {
            return false;
        } else if (typeSelect < 2 && !optionEmpy) {
            return false;
        }

        return true;
    },

    validateQuestion: function () {
        let message = '',
            msgs = $exeDevice.msgs,
            p = {},
            nombreTema = $('#trivialNameTema').val();

        if (nombreTema.length == 0) {
            message = _('You must provide a name for this topic.');
        }
        p.type = parseInt($('input[name=tvlmediatype]:checked').val());
        p.time = parseInt($('input[name=tvltime]:checked').val());
        p.numberOptions = parseInt($('input[name=tvlnumber]:checked').val());
        p.typeSelect = parseInt($('input[name=tvltypeselect]:checked').val());
        p.x = parseFloat($('#trivialEXImage').val());
        p.y = parseFloat($('#trivialEYImage').val());
        p.author = $('#trivialEAuthor').val();
        p.alt = $('#trivialEAlt').val();
        p.customScore = 1;
        p.url = $('#trivialEURLImage').val().trim();

        if (p.type == 2) {
            p.url = $exeDevices.iDevice.gamification.media.getIDYoutube(
                $('#trivialEURLYoutube').val().trim()
            )
                ? $('#trivialEURLYoutube').val()
                : '';
            if (p.url == '') {
                p.url =
                    $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                        $('#trivialEURLYoutube').val().trim()
                    )
                        ? $('#trivialEURLYoutube').val()
                        : '';
            }
        }

        p.audio = $('#trivialEURLAudio').val();
        $exeDevice.stopSound();
        $exeDevice.stopVideo();
        p.soundVideo = $('#trivialECheckSoundVideo').is(':checked') ? 1 : 0;
        p.imageVideo = $('#trivialECheckImageVideo').is(':checked') ? 1 : 0;
        p.iVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
            $('#trivialEInitVideo').val().trim()
        );
        p.fVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
            $('#trivialEEndVideo').val().trim()
        );
        p.silentVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
            $('#trivialESilenceVideo').val().trim()
        );
        p.tSilentVideo = parseInt($('#trivialETimeSilence').val());
        p.eText = tinyMCE.get('trivialEText').getContent();
        p.quextion = $('#trivialEQuestion').val().trim();
        p.options = [];
        p.solution = $('#trivialESolutionSelect').text().trim();
        p.solutionQuestion = $('#trivialESolutionWord').val();
        p.percentageShow = parseInt($('#trivialPercentageShow').val());
        var optionEmpy = false;

        $('.TRVLE-EAnwersOptions').each(function (i) {
            const option = $(this).val().trim();
            if (i < p.numberOptions && option.length == 0) {
                optionEmpy = true;
            }
            p.options.push(option);
        });

        p.solutionQuestion = '';
        if (p.typeSelect >= 2) {
            p.quextion = $('#trivialEDefinitionWord').val().trim();
            p.solution = '';
            p.solutionQuestion = $('#trivialESolutionWord').val();
        }
        if (p.typeSelect == 3) {
            p.solutionQuestion = 'open';
        }
        if (p.typeSelect == 1 && p.solution.length != p.numberOptions) {
            message = msgs.msgTypeChoose;
        } else if (p.quextion.length == 0) {
            message = msgs.msgECompleteQuestion;
        } else if (p.typeSelect < 2 && optionEmpy) {
            message = msgs.msgECompleteAllOptions;
        } else if (p.type == 1 && p.url.length < 5) {
            message = msgs.msgEURLValid;
        } else if (p.type == 2 && p.url.length == 0) {
            message = msgs.msgECompleteURLYoutube;
        } else if (
            p.type == 2 &&
            (p.iVideo.length == 0 || p.fVideo.length == 0)
        ) {
            message = msgs.msgEStartEndVideo;
        } else if (p.type == 2 && p.iVideo >= p.fVideo) {
            message = msgs.msgEStartEndIncorrect;
        } else if (p.type == 3 && p.eText.length == 0) {
            message = msgs.msgWriteText;
        } else if (
            (p.type == 2 &&
                !$exeDevice.validTime($('#trivialEInitVideo').val())) ||
            !$exeDevice.validTime($('#trivialEEndVideo').val())
        ) {
            message = $exeDevice.msgs.msgTimeFormat;
        } else if (
            p.type == 2 &&
            p.tSilentVideo > 0 &&
            !$exeDevice.validTime($('#trivialESilenceVideo').val())
        ) {
            message = msgs.msgTimeFormat;
        } else if (
            p.type == 2 &&
            p.tSilentVideo > 0 &&
            (p.silentVideo < p.iVideo || p.silentVideo >= p.fVideo)
        ) {
            message = msgs.msgSilentPoint;
        } else if (p.typeSelect == 2 && p.solutionQuestion.trim().length == 0) {
            message = $exeDevice.msgs.msgProvideSolution;
        } else if (p.typeSelect >= 2 && p.quextion.trim().length == 0) {
            message = $exeDevice.msgs.msgEProvideWord;
        }

        if (message.length == 0) {
            var active = $exeDevice.activesQuestions[$exeDevice.activeTema];
            $exeDevice.temas[$exeDevice.activeTema][active] = p;
            $exeDevice.nombresTemas[$exeDevice.activeTema] = nombreTema;
            message = true;
        } else {
            $exeDevice.showMessage(message);
            message = false;
        }
        return message;
    },

    stopSound: function () {
        if (
            $exeDevice.playerAudio &&
            typeof $exeDevice.playerAudio.pause == 'function'
        ) {
            $exeDevice.playerAudio.pause();
        }
    },

    createlinksImage: function (dataGame) {
        let html = '';
        for (let j = 0; j < dataGame.numeroTemas; j++) {
            const selectsGame = $exeDevice.temas[j];
            for (var i = 0; i < selectsGame.length; i++) {
                const quextion = selectsGame[i];
                if (quextion.type == 1 && quextion.url.indexOf('http') != 0) {
                    const linkImage =
                        '<a href="' +
                        quextion.url +
                        '" class="js-hidden trivial-LinkImages-' +
                        j +
                        '">' +
                        i +
                        '</a>';
                    html += linkImage;
                }
            }
        }
        return html;
    },
    createlinksAudio: function (dataGame) {
        let html = '';
        for (let j = 0; j < dataGame.numeroTemas; j++) {
            const selectsGame = $exeDevice.temas[j];
            for (let i = 0; i < selectsGame.length; i++) {
                const quextion = selectsGame[i];
                if (
                    typeof quextion.audio != 'undefined' &&
                    quextion.audio.length > 4 &&
                    quextion.audio.indexOf('http') != 0
                ) {
                    const linkAudio =
                        '<a href="' +
                        quextion.audio +
                        '" class="js-hidden trivial-LinkAudios-' +
                        j +
                        '">' +
                        i +
                        '</a>';
                    html += linkAudio;
                }
            }
        }
        return html;
    },
    exportGame: function () {
        if (!$exeDevice.validateQuestion()) return;

        const dataGame = this.validateData();
        if (!dataGame) return false;

        const blob = JSON.stringify(dataGame),
            newBlob = new Blob([blob], {
                type: 'text/plain',
            });
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveOrOpenBlob(newBlob);
            return;
        }
        const data = window.URL.createObjectURL(newBlob);

        let link = document.createElement('a');
        link.href = data;
        link.download = _('Activity') + '-TriviEx.json';
        document.getElementById('gameQEIdeviceForm').appendChild(link);
        link.click();
        setTimeout(function () {
            document.getElementById('gameQEIdeviceForm').removeChild(link);
            window.URL.revokeObjectURL(data);
        }, 100);
    },
    importQuExt: function (data) {
        for (let i = 0; i < data.questionsGame.length; i++) {
            const p = $exeDevice.getCuestionDefault(),
                cuestion = data.questionsGame[i],
                solution = 'ABCD';

            p.typeSelect = 0;
            p.type = cuestion.type;
            p.time = cuestion.time;
            p.numberOptions = cuestion.numberOptions;
            p.url = cuestion.url;
            p.x = cuestion.x;
            p.y = cuestion.y;
            p.author = cuestion.author;
            p.alt = cuestion.alt;
            p.soundVideo = cuestion.soundVideo;
            p.imageVideo = cuestion.imageVideo;
            p.iVideo = cuestion.iVideo;
            p.fVideo = cuestion.fVideo;
            p.eText = cuestion.eText;

            if (p.type == 3) {
                p.eText = p.eText;
            }

            p.quextion = cuestion.quextion;
            p.options = [];

            for (var j = 0; j < cuestion.options.length; j++) {
                p.options.push(cuestion.options[j]);
            }

            let numOpt = 0;
            for (let j = 0; j < p.options.length; j++) {
                if (p.options[j].trim().length == 0) {
                    p.numberOptions = numOpt;
                    break;
                }
                numOpt++;
            }
            if (p.type == 3) {
                p.eText = p.eText;
            }

            p.audio =
                typeof cuestion.audio == 'undefined' ? '' : cuestion.audio;
            p.options = cuestion.options;
            p.solution = solution.charAt(cuestion.solution);
            p.silentVideo = cuestion.silentVideo;
            p.tSilentVideo = cuestion.tSilentVideo;
            p.solutionQuestion = '';
            p.percentageShow = 35;
            $exeDevice.temas[$exeDevice.activeTema].push(p);
        }
    },

    importSelecciona: function (data) {
        for (let i = 0; i < data.selectsGame.length; i++) {
            const p = $exeDevice.getCuestionDefault(),
                cuestion = data.selectsGame[i];
            p.typeSelect = cuestion.typeSelect;
            p.type = cuestion.type;
            p.time = cuestion.time;
            p.numberOptions = cuestion.numberOptions;
            p.url = cuestion.url;
            p.x = cuestion.x;
            p.y = cuestion.y;
            p.author = cuestion.author;
            p.alt = cuestion.alt;
            p.soundVideo = cuestion.soundVideo;
            p.imageVideo = cuestion.imageVideo;
            p.iVideo = cuestion.iVideo;
            p.fVideo = cuestion.fVideo;
            p.eText = cuestion.eText;
            p.quextion = cuestion.quextion;
            p.options = [];

            for (let j = 0; j < cuestion.options.length; j++) {
                p.options.push(cuestion.options[j]);
            }
            let numOpt = 0;
            for (let j = 0; j < p.options.length; j++) {
                if (p.options[j].trim().length == 0) {
                    p.numberOptions = numOpt;
                    break;
                }
                numOpt++;
            }
            if (p.type == 3) {
                p.eText = p.eText;
            }
            p.audio =
                typeof cuestion.audio == 'undefined' ? '' : cuestion.audio;
            p.options = cuestion.options;
            p.solution = cuestion.solution;
            p.silentVideo = cuestion.silentVideo;
            p.tSilentVideo = cuestion.tSilentVideo;
            p.solutionQuestion = cuestion.solutionQuestion;
            p.percentageShow = cuestion.percentageShow;
            $exeDevice.temas[$exeDevice.activeTema].push(p);
        }
    },

    importGame: function (content) {
        const game =
            $exeDevices.iDevice.gamification.helpers.isJsonString(content);
        if (!game || typeof game.typeGame == 'undefined') {
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
        } else if (game.typeGame == 'Trivial') {
            game.trivialID = $exeDevice.getId();
            game.id = $exeDevice.getIdeviceID();
            let temas = [];
            for (let i = 0; i < 6; i++) {
                let tema = [];
                const question = $exeDevice.getCuestionDefault();
                tema.push(question);
                if (i < game.numeroTemas) {
                    let ntema = game.temas[i];
                    for (let j = 0; j < ntema.length; j++) {
                        let numOpt = 0;
                        let p = ntema[j];
                        for (let z = 0; z < p.options.length; z++) {
                            if (p.options[z].trim().indexOf('<' == 0)) {
                                p.options[z] = p.options[z].replace('<', ' ');
                            }
                            if (p.options[z].trim().length == 0) {
                                p.numberOptions = numOpt;
                                break;
                            }
                            numOpt++;
                        }
                        if (p.type == 3) {
                            p.eText = p.eText;
                        }
                        ntema[j] = p;
                    }
                    tema = ntema;
                }
                temas.push(tema);
            }

            $exeDevice.temas = temas;
            game.temas = $exeDevice.temas;
            $exeDevice.numeroTemas = game.numeroTemas;
            $exeDevice.nombresTemas = game.nombresTemas;
            $exeDevice.updateFieldGame(game);
            $exeDevice.changeNumberTemas(game.numeroTemas);
            const instructions = game.instructionsExe || game.instructions;
            tinymce.editors[0].setContent(unescape(instructions));
            //$('.exe-form-tabs li:first-child a').click();
        } else {
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
        }
    },

    updateNumberTema: function (tema) {
        for (let i = 0; i < tema.length; i++) {
            let numOpt = 0;
            for (let j = 0; j < tema[i].length; j++) {
                if (tema[i].options[j].trim().length == 0) {
                    tema[i].numberOptions = numOpt;
                    break;
                }
                numOpt++;
            }
        }
        return tema;
    },

    importAdivina: function (data) {
        for (let i = 0; i < data.wordsGame.length; i++) {
            const p = $exeDevice.getCuestionDefault(),
                cuestion = data.wordsGame[i];
            p.typeSelect = 2;
            p.type = cuestion.url.length > 10 ? 1 : 0;
            p.time =
                cuestion.time || $exeDevice.getIndexTime(data.timeQuestion);
            p.numberOptions = 4;
            p.url = cuestion.url;
            p.x = cuestion.x;
            p.y = cuestion.y;
            p.author = cuestion.author;
            p.alt = cuestion.alt;
            p.soundVideo = 1;
            p.imageVideo = 1;
            p.iVideo = 0;
            p.fVideo = 0;
            p.eText = '';
            p.quextion = cuestion.definition;
            p.options = [];
            p.options.push('');
            p.options.push('');
            p.options.push('');
            p.options.push('');
            p.audio =
                typeof cuestion.audio == 'undefined' ? '' : cuestion.audio;
            p.solution = '';
            p.silentVideo = 0;
            p.tSilentVideo = 0;
            p.solutionQuestion = cuestion.word;
            p.percentageShow = cuestion.percentageShow || data.percentageShow;
            $exeDevice.temas[$exeDevice.activeTema].push(p);
        }
    },
    getIndexTime: function (time) {
        const timeIndexMap = {
            15: 0,
            30: 1,
            60: 2,
            180: 3,
            300: 4,
            600: 5,
            900: 6,
        };
        return timeIndexMap.hasOwnProperty(time) ? timeIndexMap[time] : time;
    },

    importRosco: function (data) {
        for (let i = 0; i < data.wordsGame.length; i++) {
            const p = $exeDevice.getCuestionDefault(),
                cuestion = data.wordsGame[i],
                start = (cuestion.type = 1
                    ? $exeDevice.msgs.msgContaint.replace('%1', cuestion.letter)
                    : $exeDevice.msgs.msgStartWith.replace(
                          '%1',
                          cuestion.letter
                      ));

            p.typeSelect = 2;
            p.type = cuestion.url.length > 10 ? 1 : 0;
            p.time =
                cuestion.time || $exeDevice.getIndexTime(data.timeQuestion);
            p.numberOptions = 4;
            p.url = cuestion.url;
            p.x = cuestion.x;
            p.y = cuestion.y;
            p.author = cuestion.author;
            p.alt = cuestion.alt;
            p.soundVideo = 1;
            p.imageVideo = 1;
            p.iVideo = 0;
            p.fVideo = 0;
            p.eText = '';
            p.quextion = start + ': ' + cuestion.definition;
            p.options = [];
            p.options.push('');
            p.options.push('');
            p.options.push('');
            p.options.push('');
            p.audio =
                typeof cuestion.audio == 'undefined' ? '' : cuestion.audio;
            p.solution = '';
            p.silentVideo = 0;
            p.tSilentVideo = 0;
            p.solutionQuestion = cuestion.word;
            p.percentageShow = cuestion.percentageShow || data.percentageShow;
            if (p.solutionQuestion.trim().length > 0) {
                $exeDevice.temas[$exeDevice.activeTema].push(p);
            }
        }
    },

    getIdeviceID: function () {
        const ideviceid =
            $('#gameQEIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';
        return ideviceid;
    },

    validateData: function () {
        $exeDevice.numeroTemas = parseInt($('input[name=tvlnt]:checked').val());

        const clear = $exeDevice.removeTags,
            instructions = $('#eXeGameInstructions').text(),
            instructionsExe = tinyMCE.get('eXeGameInstructions').getContent(),
            textAfter = '',
            showMinimize = $('#trivialEShowMinimize').is(':checked'),
            optionsRamdon = true,
            answersRamdon = true,
            showSolution = $('#trivialEShowSolution').is(':checked'),
            modeBoard = $('#trivialModeBoard').is(':checked'),
            timeShowSolution = parseInt(
                clear($('#trivialETimeShowSolution').val())
            ),
            useLives = false,
            numberLives = 3,
            numeroTemas = $exeDevice.numeroTemas,
            nombresTemas = $exeDevice.nombresTemas,
            idVideo = '',
            endVideo = 0,
            startVideo = 0,
            itinerary =
                $exeDevicesEdition.iDevice.gamification.itinerary.getValues(),
            customScore = false,
            temas = [],
            evaluation = $('#trivialEEvaluation').is(':checked'),
            evaluationID = $('#trivialEEvaluationID').val(),
            globalTime = parseInt($('#trivialEGlobalTimes').val(), 10),
            id = $exeDevice.getIdeviceID();

        if (!itinerary) return false;

        if (showSolution && timeShowSolution.length == 0) {
            $exeDevice.showMessage($exeDevice.msgs.msgEProvideTimeSolution);
            return false;
        }
        if (evaluation && evaluationID.length < 5) {
            eXe.app.alert($exeDevice.msgs.msgIDLenght);
            return false;
        }

        for (let z = 0; z < numeroTemas; z++) {
            if (nombresTemas.length == 0) {
                $exeDevice.showMessage($exeDevice.msgs.msgNameThemes);
                return false;
            }
            const tema = $exeDevice.temas[z];
            for (let i = 0; i < tema.length; i++) {
                const mquestion = tema[i];
                mquestion.customScore =
                    typeof mquestion.customScore == 'undefined'
                        ? 1
                        : mquestion.customScore;
                if (mquestion.quextion.length == 0) {
                    $exeDevice.showMessage(
                        $exeDevice.msgs.msgCmpleteAllQuestions
                    );
                    return false;
                } else if (mquestion.type == 1 && mquestion.url.length < 10) {
                    $exeDevice.showMessage(
                        $exeDevice.msgs.msgCmpleteAllQuestions
                    );
                    return false;
                } else if (
                    mquestion.type == 2 &&
                    !$exeDevices.iDevice.gamification.media.getIDYoutube(
                        mquestion.url
                    ) &&
                    !$exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                        mquestion.url
                    )
                ) {
                    $exeDevice.showMessage(
                        $exeDevice.msgs.msgCmpleteAllQuestions
                    );
                    return false;
                }
                if (mquestion.typeSelect >= 2) {
                    if (mquestion.solutionQuestion.length == 0) {
                        $exeDevice.showMessage(
                            $exeDevice.msgs.msgCmpleteAllQuestions
                        );
                        return false;
                    }
                } else {
                    let completAnswer = true;
                    for (let j = 0; j < mquestion.numberOptions; j++) {
                        if (mquestion.options[j].length == 0) {
                            completAnswer = false;
                        }
                    }
                    if (!completAnswer) {
                        $exeDevice.showMessage(
                            $exeDevice.msgs.msgCmpleteAllQuestions
                        );
                        return false;
                    }
                }
            }
            for (let i = 0; i < tema.length; i++) {
                const qt = tema[i];
                if (qt.type == 1 && qt.url.length < 4) {
                    qt.x = 0;
                    qt.y = 0;
                    qt.author = '';
                    qt.alt = '';
                } else if (qt.type == 2 && qt.url.length < 4) {
                    qt.iVideo = 0;
                    qt.fVideo = 0;
                    qt.author = '';
                    qt.alt = '';
                } else if (qt.type == 3) {
                    qt.eText = qt.eText;
                }
            }
            temas.push(tema);
        }

        const scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();

        return {
            asignatura: '',
            author: '',
            authorVideo: '',
            typeGame: 'Trivial',
            endVideo: endVideo,
            idVideo: idVideo,
            startVideo: startVideo,
            instructionsExe: instructionsExe,
            instructions: instructions,
            showMinimize: showMinimize,
            optionsRamdon: optionsRamdon,
            answersRamdon: answersRamdon,
            showSolution: showSolution,
            timeShowSolution: timeShowSolution,
            useLives: useLives,
            numberLives: numberLives,
            itinerary: itinerary,
            numeroTemas: numeroTemas,
            nombresTemas: nombresTemas,
            temas: temas,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted ?? 100,
            title: '',
            customScore: customScore,
            textAfter: textAfter,
            trivialID: $exeDevice.trivialID,
            version: 3,
            modeBoard: modeBoard,
            evaluation: evaluation,
            evaluationID: evaluationID,
            globalTime: globalTime,
            id: id,
        };
    },

    removeTags: function (str) {
        let wrapper = $('<div></div>');
        wrapper.html(str);
        return wrapper.text();
    },

    showTypeQuestion: function (type) {
        if (type >= 2) {
            $exeDevice.hideFlex($('#trivialEAnswers'));
            $exeDevice.hideFlex($('#trivialEQuestionDiv'));
            $exeDevice.hideFlex($('#gameQEIdeviceForm .TRVLE-ESolutionSelect'));
            $exeDevice.hideFlex($('#trivialOptionsNumberSpan'));
            $exeDevice.hideFlex($('#trivialEInputNumbers'));
            $exeDevice.showFlex($('#trivialPercentageSpan'));
            $exeDevice.showFlex($('#trivialPercentage'));
            $exeDevice.showFlex($('#trivialESolutionWord'));
            $exeDevice.showFlex($('#trivialEWordDiv'));
            $('label[for=trivialEDefinitionWord]').text(_('Definition'));
            $exeDevice.showFlex($('label[for=trivialESolutionWord]'));
            $exeDevice.hideFlex($('#trivialESolitionOptions'));
            $('label[for=trivialEDefinitionWord]').css({ width: '11em' });
            if (type == 3) {
                $('label[for=trivialEDefinitionWord]').text(_('Question'));
                $exeDevice.hideFlex($('label[for=trivialESolutionWord]'));
                $('label[for=trivialEDefinitionWord]').css({ width: 'auto' });
                $exeDevice.hideFlex($('#trivialESolutionWord'));
            }
        } else {
            $exeDevice.showFlex($('#trivialEAnswers'));
            $exeDevice.showFlex($('#trivialEQuestionDiv'));
            $exeDevice.showFlex($('#gameQEIdeviceForm .TRVLE-ESolutionSelect'));
            $exeDevice.showFlex($('#trivialOptionsNumberSpan'));
            $exeDevice.showFlex($('#trivialEInputNumbers'));
            $exeDevice.hideFlex($('#trivialPercentageSpan'));
            $exeDevice.hideFlex($('#trivialPercentage'));
            $exeDevice.hideFlex($('#trivialEWordDiv'));
            $exeDevice.showFlex($('#trivialESolitionOptions'));
        }
    },

    addEvents: function () {
        $exeDevice.hideFlex($('#trivialEPaste'));

        $('#trivialEInitVideo,#trivialEEndVideo,#trivialESilenceVideo').on(
            'focusout',
            function () {
                if (!$exeDevice.validTime(this.value)) {
                    $(this).css({
                        'background-color': 'red',
                        color: 'white',
                    });
                }
            }
        );

        $('#trivialEInitVideo,#trivialEEndVideo,#trivialESilenceVideo').on(
            'click',
            function () {
                $(this).css({
                    'background-color': 'white',
                    color: '#2c6d2c',
                });
            }
        );

        $('#trivialShowCodeAccess').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#trivialCodeAccess').prop('disabled', !marcado);
            $('#trivialMessageCodeAccess').prop('disabled', !marcado);
        });

        $('.TRVLE-EPanel').on('click', 'input.TRVLE-Type', function (e) {
            const type = parseInt($(this).val());
            $exeDevice.changeTypeQuestion(type);
        });

        $('#gameQEIdeviceForm').on(
            'click',
            'input.TRVLE-NumeroTemas',
            function (e) {
                const numt = parseInt($(this).val());
                $exeDevice.numeroTemas = numt;
                $exeDevice.changeNumberTemas(numt);
            }
        );

        $('.TRVLE-EPanel').on('click', 'input.TRVLE-TypeSelect', function (e) {
            const type = parseInt($(this).val());
            $exeDevice.showTypeQuestion(type);
        });

        $('.TRVLE-EPanel').on('click', 'input.TRVLE-Number', function (e) {
            const number = parseInt($(this).val());
            $exeDevice.showOptions(number);
        });

        $('#trivialEAdd').on('click', function (e) {
            e.preventDefault();
            $exeDevice.addQuestion();
        });

        $('#trivialEFirst').on('click', function (e) {
            e.preventDefault();
            $exeDevice.firstQuestion();
        });

        $('#trivialEPrevious').on('click', function (e) {
            e.preventDefault();
            $exeDevice.previousQuestion();
        });

        $('#trivialENext').on('click', function (e) {
            e.preventDefault();
            $exeDevice.nextQuestion();
        });

        $('#trivialELast').on('click', function (e) {
            e.preventDefault();
            $exeDevice.lastQuestion();
        });

        $('#trivialEDelete').on('click', function (e) {
            e.preventDefault();
            $exeDevice.removeQuestion();
        });

        $('#trivialECopy').on('click', function (e) {
            e.preventDefault();
            $exeDevice.copyQuestion();
        });

        $('#trivialECut').on('click', function (e) {
            e.preventDefault();
            $exeDevice.cutQuestion();
        });

        $('#trivialEPaste').on('click', function (e) {
            e.preventDefault();
            $exeDevice.pasteQuestion();
        });

        $('#trivialEPlayVideo').on('click', function (e) {
            e.preventDefault();
            $exeDevice.showVideoQuestion();
        });

        $('#trivialECheckSoundVideo').on('change', function () {
            $exeDevice.showVideoQuestion();
        });

        $('#trivialECheckImageVideo').on('change', function () {
            $exeDevice.showVideoQuestion();
        });

        $('#trivialETimeShowSolution').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 1);
            this.value = v;
        });

        $('#trivialETimeShowSolution').on('focusout', function () {
            this.value = this.value.trim() == '' ? 3 : this.value;
            this.value = this.value > 9 ? 9 : this.value;
            this.value = this.value < 1 ? 1 : this.value;
        });

        $('#trivialETimeSilence').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 1);
            this.value = v;
        });

        $('#trivialPercentageShow').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 3);
            this.value = v;
        });

        $('#trivialPercentageShow').on('focusout', function () {
            this.value = this.value.trim() == '' ? 35 : this.value;
            this.value = this.value > 100 ? 100 : this.value;
            this.value = this.value < 0 ? 0 : this.value;
        });

        $('#trivialNumberTema').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 1);
            this.value = v;
        });

        $('#trivialNumberTema').on('focusout click', function () {
            let v = this.value;
            v = v.trim() == '' ? 1 : v;
            v = v > $exeDevice.numeroTemas ? $exeDevice.numeroTemas : v;
            v = v < 1 ? 1 : v;
            this.value = v;
            if (!$exeDevice.validateQuestion()) {
                this.value = $exeDevice.activeTema + 1;
            } else {
                $exeDevice.showTema(this.value - 1);
            }
        });

        if (
            window.File &&
            window.FileReader &&
            window.FileList &&
            window.Blob
        ) {
            $('#eXeGameExportImport').show();
            $('#eXeGameImportGame').on('change', function (e) {
                const file = e.target.files[0];
                if (!file) {
                    return;
                }
                const reader = new FileReader();
                reader.onload = function (e) {
                    $exeDevice.importGame(e.target.result);
                };
                reader.readAsText(file);
            });

            $('#trivialLoadGame').attr('accept', '.txt, .json, .xml');
            $('#trivialLoadGame').on('change', function (e) {
                const file = e.target.files[0];
                if (!file) {
                    eXe.app.alert(_('Select a file') + ' (txt, json)');
                    return;
                }
                if (
                    !file.type ||
                    !(
                        file.type.match('text/plain') ||
                        file.type.match('application/json') ||
                        file.type.match('application/xml') ||
                        file.type.match('text/xml')
                    )
                ) {
                    eXe.app.alert(_('Select a file') + ' (txt, json)');
                    return;
                }
                const reader = new FileReader();
                reader.onload = function (e) {
                    $exeDevice.gameAdd(e.target.result, file.type);
                };
                reader.readAsText(file);
            });
            $('#eXeGameExportGame').on('click', function () {
                $exeDevice.exportGame();
            });
        } else {
            $('#eXeGameExportImport').hide();
        }

        $('#trivialEInitVideo').css('color', '#2c6d2c');
        $('#trivialEInitVideo').on('click', function (e) {
            e.preventDefault();
            $exeDevice.timeVideoFocus = 0;
            $('#trivialEInitVideo').css('color', '#2c6d2c');
            $('#trivialEEndVideo').css('color', '#000000');
            $('#trivialESilenceVideo').css('color', '#000000');
        });

        $('#trivialEEndVideo').on('click', function (e) {
            e.preventDefault();
            $exeDevice.timeVideoFocus = 1;
            $('#trivialEEndVideo').css('color', '#2c6d2c');
            $('#trivialEInitVideo').css('color', '#000000');
            $('#trivialESilenceVideo').css('color', '#000000');
        });

        $('#trivialESilenceVideo').on('click', function (e) {
            e.preventDefault();
            $exeDevice.timeVideoFocus = 2;
            $('#trivialESilenceVideo').css('color', '#2c6d2c');
            $('#trivialEEndVideo').css('color', '#000000');
            $('#trivialEInitVideo').css('color', '#000000');
        });

        $('#trivialEVideoTime').on('click', function (e) {
            e.preventDefault();
            var $timeV = '';
            switch ($exeDevice.timeVideoFocus) {
                case 0:
                    $timeV = $('#trivialEInitVideo');
                    break;
                case 1:
                    $timeV = $('#trivialEEndVideo');
                    break;
                case 2:
                    $timeV = $('#trivialESilenceVideo');
                    break;
                default:
                    break;
            }
            $timeV.val($('#trivialEVideoTime').text());
            $timeV.css({
                'background-color': 'white',
                color: '#2c6d2c',
            });
        });

        $('#trivialUseLives').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#trivialNumberLives').prop('disabled', !marcado);
        });
        $('#trivialEShowSolution').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#trivialETimeShowSolution').prop('disabled', !marcado);
        });
        $('.TRVLE-ESolution').on('change', function (e) {
            const marcado = $(this).is(':checked'),
                value = $(this).val();
            $exeDevice.clickSolution(marcado, value);
        });

        $('#trivialEURLImage').on('change', function () {
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $(this).val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (selectedFile.startsWith('files') && !validExt.includes(ext)) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
                return false;
            }
            const url = selectedFile,
                alt = $('#trivialEAlt').val(),
                x = parseFloat($('#trivialEXImage').val()),
                y = parseFloat($('#trivialEYImage').val());
            $exeDevice.showImage(url, x, y, alt);
        });

        $('#trivialEPlayImage').on('click', function (e) {
            e.preventDefault();
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $('#trivialEURLImage').val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (selectedFile.startsWith('files') && !validExt.includes(ext)) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
                return false;
            }
            const url = selectedFile,
                alt = $('#trivialEAlt').val(),
                x = parseFloat($('#trivialEXImage').val()),
                y = parseFloat($('#trivialEYImage').val());
            $exeDevice.showImage(url, x, y, alt);
        });

        $('#trivialEImage').on('click', function (e) {
            $exeDevice.clickImage(this, e.pageX, e.pageY);
        });

        $('#trivialECursor').on('click', function (e) {
            $(this).hide();
            $('#trivialEXImage').val(0);
            $('#trivialEYImage').val(0);
        });

        $('#trivialEPlayAudio').on('click', function (e) {
            e.preventDefault();
            const selectedFile = $('#trivialEURLAudio').val().trim();
            if (selectedFile.length > 4) {
                $exeDevice.stopSound();
                $exeDevice.playSound(selectedFile);
            }
        });

        $('#trivialEURLAudio').on('change', function () {
            const selectedFile = $(this).val().trim();
            if (selectedFile.length > 4) {
                $exeDevice.stopSound();
                $exeDevice.playSound(selectedFile);
            }
        });

        $('#trivialNumberQuestion').keyup(function (e) {
            if (e.keyCode == 13) {
                const num = parseInt($(this).val());
                if (!isNaN(num) && num > 0) {
                    if ($exeDevice.validateQuestion()) {
                        $exeDevice.activesQuestions[$exeDevice.activeTema] =
                            num < $exeDevice.temas[$exeDevice.activeTema].length
                                ? num - 1
                                : $exeDevice.temas[$exeDevice.activeTema]
                                      .length - 1;
                        $exeDevice.showQuestion(
                            $exeDevice.activesQuestions[$exeDevice.activeTema]
                        );
                    } else {
                        $(this).val(
                            $exeDevice.activesQuestions[$exeDevice.activeTema] +
                                1
                        );
                    }
                } else {
                    $(this).val(
                        $exeDevice.activesQuestions[$exeDevice.activeTema] + 1
                    );
                }
            }
        });

        $('#trivialEEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#trivialEEvaluationID').prop('disabled', !marcado);
        });
        $('#trivialEEvaluationHelpLnk').click(function () {
            $exeDevice.toggleFlex($('#trivialEEvaluationHelp'));
            return false;
        });

        $('#trivialGlobalTimeButton').on('click', function (e) {
            e.preventDefault();
            const selectedTime = parseInt($('#trivialEGlobalTimes').val(), 10);
            const activeTema = $exeDevice.activeTema;
            for (let i = 0; i < $exeDevice.temas[activeTema].length; i++) {
                $exeDevice.temas[activeTema][i].time = selectedTime;
            }
            $(
                'input.TRVLE-Times[name="tvltime"][value="' +
                    selectedTime +
                    '"]'
            ).prop('checked', true);
        });

        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();

        $('.exe-block-dismissible .exe-block-close').click(function () {
            $(this).parent().fadeOut();
            return false;
        });
    },

    showModeOpen: function (open) {
        $exeDevice.showFlex($('#trivialTypeChoose'));
        $exeDevice.showFlex($('#trivialTypeOrders'));
        $exeDevice.showFlex($('label[for=trivialTypeChoose]'));
        $exeDevice.showFlex($('label[for=trivialTypeOrders]'));
        if (open) {
            $('#trivialTypeWord').prop('checked', open);
            $exeDevice.hideFlex($('#trivialTypeChoose'));
            $exeDevice.hideFlex($('#trivialTypeOrders'));
            $exeDevice.hideFlex($('label[for=trivialTypeChoose]'));
            $exeDevice.hideFlex($('label[for=trivialTypeOrders]'));
        }
    },

    importMoodle(xmlString) {
        const xmlDoc = $.parseXML(xmlString),
            $xml = $(xmlDoc);
        if ($xml.find('GLOSSARY').length > 0) {
            return $exeDevice.importGlosary(xmlString);
        } else if ($xml.find('quiz').length > 0) {
            return $exeDevice.importCuestionaryXML(xmlString);
        } else {
            return false;
        }
    },
    importCuestionaryXML: function (xmlText) {
        const parser = new DOMParser(),
            xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        if ($(xmlDoc).find('parsererror').length > 0) {
            return false;
        }

        const quiz = $(xmlDoc).find('quiz').first();
        if (quiz.length === 0) {
            return false;
        }

        let questions = quiz.find('question'),
            questionsJson = [];
        for (var i = 0; i < questions.length; i++) {
            let question = questions[i],
                type = $(question).attr('type');
            if (
                type !== 'multichoice' &&
                type !== 'truefalse' &&
                type !== 'numerical' &&
                type !== 'shortanswer'
            ) {
                continue;
            }
            let typeSelect = $(question).attr('type') === 'shortanswer' ? 2 : 0,
                questionText = $(question).find('questiontext').first().text(),
                answers = $(question).find('answer'),
                options = [],
                solution = '',
                solutionQuestion = '';
            if (typeSelect == 0) {
                for (let j = 0; j < answers.length; j++) {
                    let answer = answers[j],
                        answerHtml = $exeDevice.removeTags(
                            $(answer).find('text').eq(0).text().trim()
                        ),
                        answerTextParts = answerHtml.split('\n'),
                        answerText = answerTextParts[0].trim();
                    options.push(answerText);
                    if ($(answer).attr('fraction') > 0) {
                        solution += String.fromCharCode(65 + j);
                    }
                }
            } else if (typeSelect == 2) {
                let maxFraction = -1;
                for (let j = 0; j < answers.length; j++) {
                    var answer = answers[j],
                        answerHtml = $(answer).find('text').eq(0).text().trim(),
                        answerTextParts = answerHtml.split('\n');
                    ((answerText = answerTextParts[0].trim()),
                        (currentFraction = parseInt(
                            $(answer).attr('fraction')
                        )));
                    if (currentFraction > maxFraction) {
                        maxFraction = currentFraction;
                        solutionQuestion = answerText;
                    }
                }
            }
            questionsJson.push({
                typeSelect: typeSelect,
                question: $exeDevice.removeTags(questionText.trim()),
                options: options,
                solution: solution,
                solutionQuestion: solutionQuestion,
            });
        }

        let valids = 0;
        for (let i = 0; i < questionsJson.length; i++) {
            const question = questionsJson[i],
                p = $exeDevice.getCuestionDefault();
            p.typeSelect = question.typeSelect;
            if (p.typeSelect == 0) {
                p.quextion = question.question;
                p.options[0] =
                    question.options.length > 0 ? question.options[0] : '';
                p.options[1] =
                    question.options.length > 1 ? question.options[1] : '';
                p.options[2] =
                    question.options.length > 2 ? question.options[2] : '';
                p.options[3] =
                    question.options.length > 3 ? question.options[3] : '';
                p.solution = question.solution;
                p.numberOptions = question.options.length;
                if (p.numberOptions == 2) {
                    p.options[0] =
                        p.options[0] === 'true' ? _('True') : p.options[0];
                    p.options[0] =
                        p.options[0] === 'false' ? _('False') : p.options[0];
                    p.options[1] =
                        p.options[1] === 'true' ? _('True') : p.options[1];
                    p.options[1] =
                        p.options[1] === 'false' ? _('False') : p.options[1];
                }
                if (
                    question.question &&
                    question.options &&
                    question.options.length > 1
                ) {
                    $exeDevice.selectsGame.push(p);
                    valids++;
                }
            } else if (p.typeSelect == 2) {
                p.quextion = question.question;
                p.solutionQuestion = question.solutionQuestion;
                p.percentageShow = 35;
                if (
                    question.question &&
                    question.question.length > 0 &&
                    question.solutionQuestion &&
                    question.solutionQuestion.length > 0
                ) {
                    $exeDevice.selectsGame.push(p);
                    valids++;
                }
            }
        }
        return valids > 0 ? $exeDevice.selectsGame : false;
    },

    importGlosary: function (xmlText) {
        const parser = new DOMParser(),
            xmlDoc = parser.parseFromString(xmlText, 'text/xml'),
            $xml = $(xmlDoc);
        if ($xml.find('parsererror').length > 0) {
            return false;
        }
        const $entries = $xml.find('ENTRIES').first();
        if ($entries.length === 0) {
            return false;
        }
        let questionsJson = [];
        $entries.find('ENTRY').each(function () {
            var $this = $(this),
                concept = $this.find('CONCEPT').text(),
                definition = $this
                    .find('DEFINITION')
                    .text()
                    .replace(/<[^>]*>/g, ''); // Elimina HTML
            if (concept && definition) {
                questionsJson.push({
                    solution: concept,
                    question: definition,
                });
            }
        });
        let valids = 0;
        questionsJson.forEach(function (question) {
            const p = $exeDevice.getCuestionDefault();
            p.typeSelect = 2;
            p.quextion = question.question;
            p.solutionQuestion = question.solution;
            p.percentageShow = 35;
            if (p.quextion.length > 0 && p.solutionQuestion.length > 0) {
                $exeDevice.selectsGame.push(p);
                valids++;
            }
        });
        return valids > 0 ? $exeDevice.selectsGame : false;
    },

    gameAdd: function (content, filetype) {
        const game =
            $exeDevices.iDevice.gamification.helpers.isJsonString(content);

        if (content && content.includes('\u0000')) {
            $exeDevice.showMessage(_('Sorry, wrong file format'));
            return;
        } else if (!game && content) {
            var questions = false;
            if (filetype.match('text/plain')) {
                questions = $exeDevice.importText(content);
            } else if (
                filetype.match('application/xml') ||
                filetype.match('text/xml')
            ) {
                questions = $exeDevice.importMoodle(content);
            }
            if (questions && questions.length > 0) {
                $exeDevice.temas[$exeDevice.activeTema] = questions;
                $exeDevice.selectsGame =
                    $exeDevice.temas[$exeDevice.activeTema];
            } else {
                $exeDevice.showMessage(_('Sorry, wrong file format'));
                return;
            }
        } else if (!game || typeof game.typeGame == 'undefined') {
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
            $('#trivialLoadGame').val('');
            return;
        } else if (game.typeGame == 'Selecciona') {
            $exeDevice.importSelecciona(game);
        } else if (game.typeGame == 'QuExt') {
            $exeDevice.importQuExt(game);
        } else if (game.typeGame == 'Adivina') {
            $exeDevice.importAdivina(game);
        } else if (game.typeGame == 'Rosco') {
            $exeDevice.importRosco(game);
        } else {
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
            $('#trivialLoadGame').val('');
            return;
        }

        if ($exeDevice.borrarCuestion()) {
            $exeDevice.removeQuestion(
                $exeDevice.activesQuestions[$exeDevice.activeTema]
            );
        }

        $exeDevice.typeEdit = -1;
        $('#trivialEPaste').hide();
        $('#trivialENumQuestions').text(
            $exeDevice.temas[$exeDevice.activeTema].length
        );
        $('#trivialNumberQuestion').val(
            $exeDevice.activesQuestions[$exeDevice.activeTema] + 1
        );
    },

    importText: function (content) {
        let lines = content.split('\n'),
            lineFormat =
                /^([0-3]|[ABCD]{0,4})#([^#]+)#([^#]+)#([^#]*)(#([^#]*))?(#([^#]*))?$/i,
            lineFormat1 = /^([^#]+)#([^#]+)(#([^#]+))?(#([^#]+))?$/,
            valids = 0,
            questions = JSON.parse(
                JSON.stringify($exeDevice.temas[$exeDevice.activeTema])
            );

        lines.forEach(function (line) {
            const p = $exeDevice.getCuestionDefault();
            if (lineFormat.test(line)) {
                let linarray = line.trim().split('#'),
                    solution = linarray[0];
                if (!isNaN(solution)) {
                    let index = parseInt(solution),
                        letters = 'ABCD';
                    if (index >= 0 && index < letters.length) {
                        solution = letters.charAt(index);
                    }
                }
                p.solution = solution;
                p.quextion = linarray[1];
                p.options[0] = linarray[2] || '';
                p.options[1] = linarray[3] || '';
                p.options[2] = linarray.length > 4 ? linarray[4] : '';
                p.options[3] = linarray.length > 5 ? linarray[5] : '';
                p.numberOptions = linarray.length - 2;
                questions.push(p);
                valids++;
            } else if (lineFormat1.test(line)) {
                var linarray1 = line.trim().split('#');
                p.typeSelect = 2;
                p.solutionQuestion = linarray1[0];
                p.quextion = linarray1[1];
                p.percentageShow = 35;
                if (p.quextion && p.solutionQuestion) {
                    questions.push(p);
                    valids++;
                }
            }
        });
        return valids > 0 ? questions : false;
    },

    setInputFilter: function (textbox, inputFilter) {
        [
            'input',
            'keydown',
            'keyup',
            'mousedown',
            'mouseup',
            'select',
            'contextmenu',
            'drop',
        ].forEach(function (event) {
            textbox.addEventListener(event, function () {
                if (inputFilter(this.value)) {
                    this.oldValue = this.value;
                    this.oldSelectionStart = this.selectionStart;
                    this.oldSelectionEnd = this.selectionEnd;
                } else if (this.hasOwnProperty('oldValue')) {
                    this.value = this.oldValue;
                    this.setSelectionRange(
                        this.oldSelectionStart,
                        this.oldSelectionEnd
                    );
                } else {
                    this.value = '';
                }
            });
        });
    },

    validateScoreQuestion: function (text) {
        const isValid =
            text.length > 0 &&
            text !== '.' &&
            text !== ',' &&
            /^-?\d*[.,]?\d*$/.test(text);
        return isValid;
    },

    validateHhMm: function (text) {
        const isValid =
            text.length > 0 &&
            /^([0-1]?[0-9]|2[0-4]):([0-5][0-9])(:[0-5][0-9])?$/.test(text);
        return isValid;
    },

    clickSolution: function (checked, value) {
        let solutions = $('#trivialESolutionSelect').text();
        if (checked) {
            if (solutions.indexOf(value) == -1) {
                solutions += value;
            }
        } else {
            solutions = solutions.split(value).join('');
        }
        $('#trivialESolutionSelect').text(solutions);
    },

    clickImage: function (img, epx, epy) {
        const $cursor = $('#trivialECursor'),
            $x = $('#trivialEXImage'),
            $y = $('#trivialEYImage'),
            $img = $(img),
            posX = epx - $img.offset().left,
            posY = epy - $img.offset().top,
            wI = $img.width() > 0 ? $img.width() : 1,
            hI = $img.height() > 0 ? $img.height() : 1,
            lI = $img.position().left,
            tI = $img.position().top;

        $x.val(posX / wI);
        $y.val(posY / hI);
        $cursor.css({
            left: posX + lI,
            top: posY + tI,
            'z-index': 30,
        });
        $cursor.show();
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

    drawImage: function (image, mData) {
        $(image).css({
            left: mData.x + 'px',
            top: mData.y + 'px',
            width: mData.w + 'px',
            height: mData.h + 'px',
        });
    },

    showFlex: function ($el) {
        if ($el && $el.length) {
            if ($el.hasClass('d-none')) {
                $el.removeClass('d-none').addClass('d-flex');
            } else if (!$el.hasClass('d-flex') && !$el.hasClass('d-none')) {
                $el.show();
            }
        }
    },
    hideFlex: function ($el) {
        if ($el && $el.length) {
            if ($el.hasClass('d-flex')) {
                $el.removeClass('d-flex').addClass('d-none');
            } else if (!$el.hasClass('d-flex') && !$el.hasClass('d-none')) {
                $el.hide();
            }
        }
    },
    toggleFlex: function ($el) {
        if ($el && $el.length) {
            if ($el.hasClass('d-none')) {
                $el.removeClass('d-none').addClass('d-flex');
            } else if ($el.hasClass('d-flex')) {
                $el.removeClass('d-flex').addClass('d-none');
            } else {
                if ($el.is(':visible')) {
                    $el.hide();
                } else {
                    $el.show();
                }
            }
        }
    },
};
