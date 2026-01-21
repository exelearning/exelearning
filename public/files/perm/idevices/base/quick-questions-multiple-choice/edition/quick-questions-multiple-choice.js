/* eslint-disable no-undef */
/**
 * Select Activity iDevice (edition code)
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno, Francisco Javier Pulido
 * Testers: Ricardo Málaga Floriano, Francisco Muñoz de la Peña
 * Translator: Antonio Juan Delgado García
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 * Versión: 3.1
 */
var $exeDevice = {
    // i18n
    i18n: {
        name: _('Multiple Choice Quiz'),
        alt: _('Multiple Choice Quiz'),
    },
    idevicePath: '',
    msgs: {},
    classIdevice: 'quick-questions-multiple-choice',
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
    isVideoType: false,
    isVideoIntro: 0,
    localPlayer: null,
    localPlayerIntro: null,
    id: false,
    ci18n: {},
    checkAltImage: true,

    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.refreshTranslations();
        this.ci18n.msgTryAgain = this.ci18n.msgTryAgain.replace(
            '&percnt;',
            '%'
        );

        this.setMessagesInfo();
        this.createForm();
    },

    enableForm: function () {
        $exeDevice.initQuestions();

        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
        $exeDevice.loadYoutubeApi();
    },

    refreshTranslations: function () {
        this.ci18n = {
            msgReady: c_('Ready?'),
            msgStartGame: c_('Click here to start'),
            msgSubmit: c_('Submit'),
            msgEnterCode: c_('Enter the access code'),
            msgErrorCode: c_('The access code is not correct'),
            msgGameOver: c_('Game Over!'),
            msgClue: c_('Cool! The clue is:'),
            msgNewGame: c_('Click here for a new game'),
            msgYouHas: c_('You have got %1 hits and %2 misses'),
            msgCodeAccess: c_('Access code'),
            msgPlayAgain: c_('Play Again'),
            msgRequiredAccessKey: c_('Access code required'),
            msgInformationLooking: c_(
                'Cool! The information you were looking for'
            ),
            msgPlayStart: c_('Click here to play'),
            msgErrors: c_('Errors'),
            msgHits: c_('Hits'),
            msgScore: c_('Score'),
            msgWeight: c_('Weight'),
            msgMinimize: c_('Minimize'),
            msgMaximize: c_('Maximize'),
            msgTime: c_('Time per question'),
            msgLive: c_('Life'),
            msgFullScreen: c_('Full Screen'),
            msgExitFullScreen: c_('Exit Full Screen'),
            msgNumQuestions: c_('Number of questions'),
            msgNoImage: c_('No picture question'),
            msgCool: c_('Cool!'),
            msgLoseT: c_('You lost 330 points'),
            msgLoseLive: c_('You lost one life'),
            msgLostLives: c_('You lost all your lives!'),
            msgAllQuestions: c_('Questions completed!'),
            msgSuccesses: c_(
                'Right! | Excellent! | Great! | Very good! | Perfect!'
            ),
            msgFailures: c_(
                'It was not that! | Incorrect! | Not correct! | Sorry! | Error!'
            ),
            msgNotNetwork: c_(
                'You can only play this game with internet connection.'
            ),
            msgEndGameScore: c_(
                'Please start the game before saving your score.'
            ),
            msgScoreScorm: c_(
                "The score can't be saved because this page is not part of a SCORM package."
            ),
            msgQuestion: c_('Question'),
            msgAnswer: c_('Check'),
            msgOnlySaveScore: c_('You can only save the score once!'),
            msgOnlySave: c_('You can only save once'),
            msgInformation: c_('Information'),
            msgYouScore: c_('Your score'),
            msgAuthor: c_('Authorship'),
            msgOnlySaveAuto: c_(
                'Your score will be saved after each question. You can only play once.'
            ),
            msgSaveAuto: c_(
                'Your score will be automatically saved after each question.'
            ),
            msgSeveralScore: c_(
                'You can save the score as many times as you want'
            ),
            msgYouLastScore: c_('The last score saved is'),
            msgActityComply: c_('You have already done this activity.'),
            msgPlaySeveralTimes: c_(
                'You can do this activity as many times as you want'
            ),
            msgTryAgain: c_(
                'You need at least %s&percnt; of correct answers to get the information. Please try again.'
            ),
            msgVideoIntro: c_('Video Intro'),
            msgClose: c_('Close'),
            msgOption: c_('Option'),
            msgRickText: c_('Rich Text'),
            msgUseFulInformation: c_(
                'and information that will be very useful'
            ),
            msgLoading: c_('Loading. Please wait...'),
            msgOrders: c_('Please order the answers'),
            msgIndicateWord: c_('Provide a word or phrase'),
            msgMoveOne: c_('Move on'),
            msgPoints: c_('points'),
            msgAudio: c_('Audio'),
            msgCorrect: c_('Correct'),
            msgIncorrect: c_('Incorrect'),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgTypeGame: c_('Multiple Choice Quiz'),
        };
    },

    setMessagesInfo: function () {
        const msgs = this.msgs;
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
        msgs.msgStartWith = _('Starts with %1');
        msgs.msgContaint = _('Contains letter %1');
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
        msgs.msgSilentPoint = _(
            'The silence time is wrong. Check the video duration.'
        );
        msgs.msgTypeChoose = _(
            'Please check all the answers in the right order'
        );
        msgs.msgTimeFormat = _('Please check the time format: hh:mm:ss');
        msgs.msgProvideSolution = _('Please write the solution');
        msgs.msgEDefintion = _(
            'Please provide the definition of the word or phrase'
        );
        msgs.msgProvideFB = _('Message to display when passing the game');
        msgs.msgNotHitCuestion = _(
            'The question marked as next in case of success does not exist.'
        );
        msgs.msgNotErrorCuestion = _(
            'The question marked as next in case of error does not exist.'
        );
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.'
        );
        msgs.msgIDLenght = _(
            'The report identifier must have at least 5 characters'
        );
        msgs.msgTitleAltImageWarning = _('Accessibility warning');
        msgs.msgAltImageWarning = _(
            'Are you sure you want to continue without including an image description? Without it the image may not be accessible to some users with disabilities, or to those using a text browser, or browsing the Web with images turned off.'
        );
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

    loadPlayerYoutube: function () {
        $exeDevice.player = new YT.Player('seleccionaEVideo', {
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
        $exeDevice.playerIntro = new YT.Player('seleccionaEVI', {
            width: '100%',
            height: '100%',
            videoId: '',
            playerVars: {
                color: 'white',
                autoplay: 0,
                controls: 1,
            },
        });
    },

    clickPlay: function () {
        const ulrvideo = $('#seleccionaEURLYoutube');
        if (
            !ulrvideo ||
            ulrvideo.length === 0 ||
            ulrvideo.val().trim().length < 3
        )
            return;
        if (
            $exeDevices.iDevice.gamification.media.getIDYoutube(
                $('#seleccionaEURLYoutube').val().trim()
            )
        ) {
            $exeDevice.showVideoQuestion();
        } else if (
            $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                $('#seleccionaEURLYoutube').val().trim()
            )
        ) {
            $exeDevice.showVideoQuestion();
        }
    },

    playVideoQuestion: function () {
        if (
            $exeDevices.iDevice.gamification.media.getIDYoutube(
                $('#seleccionaEURLYoutube').val().trim()
            )
        ) {
            $exeDevice.showVideoQuestion();
        } else if (
            $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                $('#seleccionaEURLYoutube').val().trim()
            )
        ) {
            $exeDevice.showVideoQuestion();
        } else {
            $exeDevice.showMessage($exeDevice.msgs.msgECompleteURLYoutube);
        }
    },

    showVideoQuestion: function () {
        let fVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
            $('#seleccionaEEndVideo').val()
        );
        const url = $('#seleccionaEURLYoutube').val().trim(),
            iVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                $('#seleccionaEInitVideo').val()
            ),
            id = $exeDevices.iDevice.gamification.media.getIDYoutube(url),
            idLocal =
                $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                    url
                ),
            type = id ? 0 : 1,
            soundVideo = $('#seleccionaECheckSoundVideo').is(':checked')
                ? 1
                : 0,
            imageVideo = $('#seleccionaECheckImageVideo').is(':checked')
                ? 1
                : 0;

        $exeDevice.silentVideo =
            $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                $('#seleccionaESilenceVideo').val().trim()
            );
        $exeDevice.tSilentVideo = parseInt(
            $('#seleccionaETimeSilence').val(),
            10
        );
        $exeDevice.activeSilent =
            soundVideo === 1 &&
            $exeDevice.tSilentVideo > 0 &&
            $exeDevice.silentVideo >= iVideo &&
            iVideo < fVideo;
        $exeDevice.endSilent = $exeDevice.silentVideo + $exeDevice.tSilentVideo;

        if (fVideo <= iVideo) fVideo = 36000;

        $(
            '#seleccionaENoImageVideo, #seleccionaEVideo, #seleccionaEVideoLocal'
        ).hide();
        $('#seleccionaENoVideo').show();

        if (id || idLocal) {
            $exeDevice.startVideo(id || idLocal, iVideo, fVideo, type);
            $('#seleccionaENoVideo').hide();

            if (imageVideo === 0) {
                $('#seleccionaENoImageVideo').show();
            } else {
                if (type === 0) {
                    $('#seleccionaEVideo').show();
                } else {
                    $('#seleccionaEVideoLocal').show();
                }
            }

            $exeDevice.muteVideo(soundVideo === 0);
        } else {
            $exeDevice.showMessage($exeDevice.msgs.msgEUnavailableVideo);
        }
    },

    youTubeReady: function () {
        $exeDevice.player = new YT.Player('seleccionaEVideo', {
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
        $exeDevice.playerIntro = new YT.Player('seleccionaEVI', {
            width: '100%',
            height: '100%',
            videoId: '',
            playerVars: {
                color: 'white',
                autoplay: 0,
                controls: 1,
            },
            events: {
                onReady: $exeDevice.onPlayerReady,
                onError: $exeDevice.onPlayerError,
            },
        });
    },

    onPlayerReady: function () {
        if ($exeDevice.isVideoType) {
            $exeDevice.showVideoQuestion();
        }
    },

    startVideo: function (id, start, end, type) {
        let mstart = start < 1 ? 0.1 : start;
        if (type > 0) {
            if ($exeDevice.localPlayer) {
                $exeDevice.pointEnd = end;
                $exeDevice.localPlayer.src = id;
                $exeDevice.localPlayer.currentTime = parseFloat(start);
                $exeDevice.localPlayer.play();
                $exeDevice.clockVideo.start('local');
            }
            $('#adivinaEVideoTime').show();
            return;
        }

        if ($exeDevice.player) {
            if (typeof $exeDevice.player.loadVideoById === 'function') {
                $exeDevice.player.loadVideoById({
                    videoId: id,
                    startSeconds: mstart,
                    endSeconds: end,
                });
                $exeDevice.clockVideo.start('remote');
            }
        }
    },

    clockVideo: {
        start: function (type) {
            this.stop();
            this.type = type;
            this.intervalID = setInterval(this.update.bind(this), 1000);
        },
        update: function () {
            if (typeof $exeDevice === 'undefined') {
                clearInterval(this.intervalID);
            } else {
                if (this.type === 'local') {
                    $exeDevice.updateTimerDisplayLocal();
                } else if (this.type === 'remote') {
                    $exeDevice.updateTimerDisplay();
                } else if (this.type === 'vlocal') {
                    $exeDevice.updateTimerDisplayVILocal();
                } else if (this.type === 'viremote') {
                    $exeDevice.updateTimerVIDisplay();
                }
            }
        },
        stop: function () {
            if (this.intervalID) {
                clearInterval(this.intervalID);
                this.intervalID = null;
            }
        },
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
            $('#seleccionaEVideoTime').text(time);
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

    updateTimerDisplay: function () {
        if (
            $exeDevice.player &&
            typeof $exeDevice.player.getCurrentTime === 'function'
        ) {
            const time = $exeDevices.iDevice.gamification.helpers.secondsToHour(
                $exeDevice.player.getCurrentTime()
            );
            $('#seleccionaEVideoTime').text(time);
            $exeDevice.updateSoundVideo();
        }
    },

    updateTimerDisplayVILocal: function () {
        if (
            $exeDevice.localPlayerIntro &&
            $exeDevice.localPlayerIntro.currentTime
        ) {
            const currentTime = $exeDevice.localPlayerIntro.currentTime,
                time = $exeDevices.iDevice.gamification.helpers.secondsToHour(
                    Math.floor(currentTime)
                );
            $('#seleccionaEVITime').text(time);
            if (
                Math.ceil(currentTime) == $exeDevice.pointEndIntro ||
                Math.ceil(currentTime) == $exeDevice.durationVideo
            ) {
                $exeDevice.localPlayerIntro.pause();
                $exeDevice.pointEndIntro = 100000;
            }
        }
    },

    updateTimerVIDisplay: function () {
        if (
            $exeDevice.playerIntro &&
            typeof $exeDevice.playerIntro.getCurrentTime === 'function'
        ) {
            const time = $exeDevices.iDevice.gamification.helpers.secondsToHour(
                $exeDevice.playerIntro.getCurrentTime()
            );
            $('#seleccionaEVITime').text(time);
        }
    },

    updateProgressBar: function () {
        //$('#progress-bar').val((player.getCurrentTime() / player.getDuration()) * 100);
    },

    onPlayerError: function () {
        //$exeDevice.showMessage("El video seleccionado no está disponible")
    },

    startVideoIntro: function (id, start, end, type) {
        const mstart = start < 1 ? 0.1 : start;

        $('#seleccionaEVI').hide();
        $('#seleccionaEVILocal').hide();

        if (type > 0) {
            if ($exeDevice.localPlayerIntro) {
                $exeDevice.pointEndIntro = end;
                $exeDevice.localPlayerIntro.src = id;
                $exeDevice.localPlayerIntro.currentTime = parseFloat(mstart);
                $exeDevice.localPlayerIntro.play();
                $exeDevice.clockVideo.start('vilocal');
            }
            $('#seleccionaEVILocal').show();
            return;
        }

        if ($exeDevice.playerIntro) {
            if (typeof $exeDevice.playerIntro.loadVideoById === 'function') {
                $exeDevice.playerIntro.loadVideoById({
                    videoId: id,
                    startSeconds: mstart,
                    endSeconds: end,
                });
                $exeDevice.clockVideo.start('viremote');
            }
            $('#seleccionaEVI').show();
        }
    },
    stopVideoIntro: function () {
        if ($exeDevice.localPlayerIntro) {
            clearInterval($exeDevice.timeUpdateInterval);
            if (typeof $exeDevice.localPlayerIntro.pause == 'function') {
                $exeDevice.localPlayerIntro.pause();
            }
        }
        if (
            $exeDevice.playerIntro &&
            typeof $exeDevice.playerIntro.pauseVideo === 'function'
        ) {
            $exeDevice.playerIntro.pauseVideo();
        }
        $exeDevice.clockVideo.stop();
    },

    playVideoIntro1: function () {
        const idv = $exeDevices.iDevice.gamification.media.getIDYoutube(
            $('#seleccionaEVideoIntro').val()
        );
        const idmt =
            $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                $('#seleccionaEVideoIntro').val()
            );
        const iVI = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
            $('#seleccionaEVIStart').val()
        );
        const tms = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
            $('#seleccionaEVIEnd').val()
        );
        const fVI = tms > 0 ? tms : 9000;

        if (idv || idmt) {
            if (fVI <= iVI) {
                $exeDevice.showMessage($exeDevice.msgs.msgEStartEndIncorrect);
                return;
            }

            if (idv) {
                if (typeof YT == 'undefined') {
                    $exeDevice.isVideoIntro = 1;
                    $exeDevice.loadYoutubeApi();
                    return;
                } else {
                    $('#seleccionaEVI').show();
                    $exeDevice.startVideoIntro(idv, iVI, fVI, 0);
                }
            } else {
                $exeDevice.startVideoIntro(idmt, iVI, fVI, 1);
            }

            $('#seleccionaEVIURL').val($('#seleccionaEVideoIntro').val());
            $('#seleccionaEVIDiv').show();
            $('#seleccionaEVINo').hide();
            $('#seleccionaENumQuestionDiv').hide();
        } else {
            $('#seleccionaEVINo').show();
            $('#seleccionaEVI').hide();
            $exeDevice.showMessage($exeDevice.msgs.msgECompleteURLYoutube);
        }
    },

    playVideoIntro2: function () {
        const idv = $exeDevices.iDevice.gamification.media.getIDYoutube(
            $('#seleccionaEVIURL').val()
        );
        const idmt =
            $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                $('#seleccionaEVIURL').val()
            );
        const iVI = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
            $('#seleccionaEVIStart').val()
        );
        const ts = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
            $('#seleccionaEVIEnd').val()
        );
        const fVI = ts > 0 ? ts : 9000;

        if (idv || idmt) {
            if (fVI <= iVI) {
                $exeDevice.showMessage($exeDevice.msgs.msgEStartEndIncorrect);
                return;
            }
            if (idv) {
                if (typeof YT == 'undefined') {
                    $exeDevice.isVideoIntro = 1;
                    $exeDevice.loadYoutubeApi();
                    return;
                } else {
                    $exeDevice.startVideoIntro(idv, iVI, fVI, 0);
                }
            } else {
                $exeDevice.startVideoIntro(idmt, iVI, fVI, 1);
            }
        } else {
            $exeDevice.showMessage($exeDevice.msgs.msgECompleteURLYoutube);
        }
    },

    stopVideo: function () {
        if ($exeDevice.localPlayer) {
            if (typeof $exeDevice.localPlayer.pause == 'function') {
                $exeDevice.localPlayer.pause();
            }
        }

        if ($exeDevice.player) {
            if (typeof $exeDevice.player.pauseVideo === 'function') {
                $exeDevice.player.pauseVideo();
            }
        }
        $exeDevice.clockVideo.stop();
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

    playSound: function (selectedFile) {
        const selectFile =
            $exeDevices.iDevice.gamification.media.extractURLGD(selectedFile);
        $exeDevice.playerAudio = new Audio(selectFile);
        $exeDevice.playerAudio.addEventListener('canplaythrough', function () {
            $exeDevice.playerAudio.play();
        });
    },

    stopSound() {
        if (
            $exeDevice.playerAudio &&
            typeof $exeDevice.playerAudio.pause == 'function'
        ) {
            $exeDevice.playerAudio.pause();
        }
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    addQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.clearQuestion();
            $exeDevice.selectsGame.push($exeDevice.getCuestionDefault());
            $exeDevice.active = $exeDevice.selectsGame.length - 1;
            $exeDevice.typeEdit = -1;
            $('#seleccionaEPaste').hide();
            $('#seleccionaENumQuestions').text($exeDevice.selectsGame.length);
            $('#seleccionaENumberQuestion').val($exeDevice.selectsGame.length);
            $exeDevice.updateSelectOrder();
        }
    },

    removeQuestion: function () {
        if ($exeDevice.selectsGame.length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
            return;
        } else {
            $exeDevice.selectsGame.splice($exeDevice.active, 1);
            if ($exeDevice.active >= $exeDevice.selectsGame.length - 1) {
                $exeDevice.active = $exeDevice.selectsGame.length - 1;
            }
            $exeDevice.showQuestion($exeDevice.active);
            $exeDevice.typeEdit = -1;
            $('#seleccionaEPaste').hide();
            $('#seleccionaENumQuestions').text($exeDevice.selectsGame.length);
            $('#seleccionaENumberQuestion').val($exeDevice.active + 1);
            $exeDevice.updateSelectOrder();
        }
    },

    copyQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.typeEdit = 0;
            $exeDevice.clipBoard = JSON.parse(
                JSON.stringify($exeDevice.selectsGame[$exeDevice.active])
            );
            $('#seleccionaEPaste').show();
        }
    },

    cutQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.numberCutCuestion = $exeDevice.active;
            $exeDevice.typeEdit = 1;
            $('#seleccionaEPaste').show();
        }
    },

    pasteQuestion: function () {
        if ($exeDevice.typeEdit == 0) {
            $exeDevice.active++;
            $exeDevice.selectsGame.splice(
                $exeDevice.active,
                0,
                $exeDevice.clipBoard
            );
            $exeDevice.showQuestion($exeDevice.active);
        } else if ($exeDevice.typeEdit == 1) {
            $('#seleccionaEPaste').hide();
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                $exeDevice.selectsGame,
                $exeDevice.numberCutCuestion,
                $exeDevice.active
            );
            $exeDevice.showQuestion($exeDevice.active);
            $('#seleccionaENumQuestions').text($exeDevice.selectsGame.length);
        }
        $exeDevice.updateSelectOrder();
    },

    nextQuestion: function () {
        if (
            $exeDevice.validateQuestion() &&
            $exeDevice.active < $exeDevice.selectsGame.length - 1
        ) {
            $exeDevice.active++;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    lastQuestion: function () {
        if (
            $exeDevice.validateQuestion() &&
            $exeDevice.active < $exeDevice.selectsGame.length - 1
        ) {
            $exeDevice.active = $exeDevice.selectsGame.length - 1;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    previousQuestion: function () {
        if ($exeDevice.validateQuestion() && $exeDevice.active > 0) {
            $exeDevice.active--;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    firstQuestion: function () {
        if ($exeDevice.validateQuestion() && $exeDevice.active > 0) {
            $exeDevice.active = 0;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    updateSelectOrder: function () {
        const activeGame = $exeDevice.selectsGame[$exeDevice.active];

        function updateSelectOptions(selectId, valueToSet) {
            const $select = $(selectId);
            $select
                .empty()
                .append(
                    $('<option>', { value: -2, text: _('End') }),
                    $('<option>', { value: -1, text: _('Next') })
                );

            $.each($exeDevice.selectsGame, function (index) {
                $select.append(
                    $('<option>', {
                        value: index,
                        text: (index + 1).toString(),
                    })
                );
            });

            $select.val(valueToSet);
        }
        updateSelectOptions('#seleccionaGotoCorrect', activeGame.hit);
        updateSelectOptions('#seleccionaGotoIncorrect', activeGame.error);
        $exeDevice.updateQuestionsNumber();
    },

    updateQuestionsNumber: function () {
        let percentaje = parseInt(
            $exeDevice.removeTags(
                $('#seleccionaEPercentajeQuestionsValue').val()
            ),
            10
        );
        if (isNaN(percentaje)) return;

        percentaje = Math.max(1, Math.min(percentaje, 100));
        const totalQuestions = $exeDevice.selectsGame.length,
            num = Math.max(1, Math.round((percentaje * totalQuestions) / 100));
        $('#seleccionaENumeroPercentaje').text(num + '/' + totalQuestions);
    },

    showQuestion: function (i) {
        $exeDevice.clearQuestion();
        const totalQuestions = $exeDevice.selectsGame.length,
            num = Math.max(0, Math.min(i, totalQuestions - 1));
        let p = $exeDevice.selectsGame[num];

        if (p.typeSelect !== 2) {
            let numOptions = 0;
            $('.SLCNE-EAnwersOptions').each(function (j) {
                numOptions++;
                if (p.options[j].trim() !== '') {
                    p.numOptions = numOptions;
                }
                $(this).val(p.options[j]);
            });
        } else {
            $('#seleccionaESolutionWord').val(p.solutionQuestion);
            $('#seleccionaPercentageShow').val(p.percentageShow);
            $('#seleccionaEDefinitionWord').val(p.quextion);
        }

        $exeDevice.stopVideo();
        $exeDevice.showTypeQuestion(p.typeSelect);
        $exeDevice.changeTypeQuestion(p.type);
        $exeDevice.showOptions(p.numberOptions);
        $('#seleccionaEQuestion').val(p.quextion);
        $('#seleccionaENumQuestions').text(totalQuestions);

        if (p.type === 1) {
            $('#seleccionaEURLImage').val(p.url);
            $('#seleccionaEXImage').val(p.x);
            $('#seleccionaEYImage').val(p.y);
            $('#seleccionaEAuthor').val(p.author);
            $('#seleccionaEAlt').val(p.alt);
            $exeDevice.showImage(p.url, p.x, p.y, p.alt);
        } else if (p.type === 2) {
            $('#seleccionaECheckSoundVideo').prop(
                'checked',
                p.soundVideo === 1
            );
            $('#seleccionaECheckImageVideo').prop(
                'checked',
                p.imageVideo === 1
            );
            $('#seleccionaEURLYoutube').val(p.url);
            $('#seleccionaEInitVideo').val(
                $exeDevices.iDevice.gamification.helpers.secondsToHour(p.iVideo)
            );
            $('#seleccionaEEndVideo').val(
                $exeDevices.iDevice.gamification.helpers.secondsToHour(p.fVideo)
            );
            $('#seleccionaESilenceVideo').val(
                $exeDevices.iDevice.gamification.helpers.secondsToHour(
                    p.silentVideo
                )
            );
            $('#seleccionaETimeSilence').val(p.tSilentVideo);
            $exeDevice.silentVideo = p.silentVideo;
            $exeDevice.tSilentVideo = p.tSilentVideo;
            $exeDevice.activeSilent =
                p.soundVideo === 1 &&
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
                if (typeof YT === 'undefined') {
                    $exeDevice.isVideoType = true;
                    $exeDevice.loadYoutubeApi();
                } else {
                    $exeDevice.showVideoQuestion();
                }
            }
        } else if (p.type === 3) {
            tinyMCE.get('seleccionaEText').setContent(unescape(p.eText));
        }

        $('.SLCNE-EAnwersOptions').each(function (j) {
            $(this).val(p.options[j] || '');
        });

        p.audio = p.audio && p.audio !== 'undefined' ? p.audio : '';
        $exeDevice.stopSound();
        if (p.type !== 2 && p.audio.trim().length > 4) {
            $exeDevice.playSound(p.audio.trim());
        }

        $('#seleccionaEURLAudio').val(p.audio);
        $('#seleccionaGotoCorrect').val(p.hit);
        $('#seleccionaGotoIncorrect').val(p.error);
        $('#seleccionaEMessageOK').val(p.msgHit);
        $('#seleccionaEMessageKO').val(p.msgError);
        $('#seleccionaENumberQuestion').val(num + 1);
        $('#seleccionaEScoreQuestion').val(p.customScore || 1);

        $(
            "input.SLCNE-Number[name='slcnumber'][value='" +
                p.numberOptions +
                "']"
        ).prop('checked', true);
        $("input.SLCNE-Type[name='slcmediatype'][value='" + p.type + "']").prop(
            'checked',
            true
        );
        $exeDevice.checkQuestions(p.solution);
        $("input.SLCNE-Times[name='slctime'][value='" + p.time + "']").prop(
            'checked',
            true
        );
        $(
            "input.SLCNE-TypeSelect[name='slctypeselect'][value='" +
                p.typeSelect +
                "']"
        ).prop('checked', true);
    },

    checkQuestions: function (solution) {
        $("input.SLCNE-ESolution[name='slcsolution']").prop('checked', false);
        for (let i = 0; i < solution.length; i++) {
            let sol = solution[i];
            $(
                "input.SLCNE-ESolution[name='slcsolution'][value='" + sol + "']"
            ).prop('checked', true);
        }
        $('#selecionaESolutionSelect').text(solution);
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
        const $image = $('#seleccionaEImage'),
            $cursor = $('#seleccionaECursor');
        $image.hide();
        $cursor.hide();
        $image.attr('alt', alt);
        $('#seleccionaENoImage').show();
        url = $exeDevices.iDevice.gamification.media.extractURLGD(url);
        $image
            .prop('src', url)
            .on('load', function () {
                if (
                    !this.complete ||
                    typeof this.naturalWidth == 'undefined' ||
                    this.naturalWidth == 0
                ) {
                    if (type == 1) {
                        $exeDevice.showMessage($exeDevice.msgs.msgEURLValid);
                    }
                    return false;
                } else {
                    const mData = $exeDevice.placeImageWindows(
                        this,
                        this.naturalWidth,
                        this.naturalHeight
                    );
                    $exeDevice.drawImage(this, mData);
                    $image.show();
                    $('#seleccionaENoImage').hide();
                    $exeDevice.paintMouse(this, $cursor, x, y);
                    return true;
                }
            })
            .on('error', function () {
                if (type == 1) {
                    $exeDevice.showMessage($exeDevice.msgs.msgEURLValid);
                }
                return false;
            });
    },

    paintMouse: function (image, cursor, x, y) {
        $(cursor).hide();
        if (x > 0 || y > 0) {
            const wI = $(image).width() > 0 ? $(image).width() : 1,
                hI = $(image).height() > 0 ? $(image).height() : 1,
                lI = $(image).position().left + wI * x,
                tI = $(image).position().top + hI * y;
            $(cursor).css({
                left: lI + 'px',
                top: tI + 'px',
                'z-index': 300,
            });
            $(cursor).show();
        }
    },

    clearQuestion: function () {
        $exeDevice.changeTypeQuestion(0);
        $exeDevice.showOptions(4);
        $exeDevice.showSolution('');
        $('.SLCNE-Type')[0].checked = true;
        $('.SLCNE-Times')[0].checked = true;
        $('.SLCNE-Number')[2].checked = true;
        $('#seleccionaEURLImage').val('');
        $('#seleccionaEXImage').val('0');
        $('#seleccionaEYImage').val('0');
        $('#seleccionaEAuthor').val('');
        $('#seleccionaEAlt').val('');
        $('#seleccionaEURLAudio').val('');
        $('#seleccionaEURLYoutube').val('');
        $('#seleccionaEInitVideo').val('00:00:00');
        $('#seleccionaEEndVideo').val('00:00:00');
        $('#seleccionaECheckSoundVideo').prop('checked', true);
        $('#seleccionaECheckImageVideo').prop('checked', true);
        $("input.SLCNE-ESolution[name='slcsolution']").prop('checked', false);
        $('#selecionaESolutionSelect').text('');
        tinyMCE.get('seleccionaEText').setContent('');
        $('#seleccionaEQuestion').val('');
        $('#seleccionaESolutionWord').val('');
        $('#seleccionaEDefinitionWord').val('');
        $('.SLCNE-EAnwersOptions').each(function () {
            $(this).val('');
        });
        $('#seleccionaEMessageOK').val('');
        $('#seleccionaEMessageKO').val('');
    },

    changeTypeQuestion: function (type) {
        $('#seleccionaETitleAltImage').hide();
        $('#seleccionaEAuthorAlt').removeClass('d-flex').addClass('d-none');
        $('#seleccionaETitleImage').hide();
        $('#seleccionaEInputImage').hide();
        $('#seleccionaETitleVideo').hide();
        $('#seleccionaEInputVideo').hide();
        $('#seleccionaEInputAudio').removeClass('d-none').addClass('d-flex');
        $('#seleccionaETitleAudio').show();
        $('#seleccionaEInputOptionsVideo').hide();
        $('#seleccionaInputOptionsImage').hide();

        if (tinyMCE.get('seleccionaEText')) {
            tinyMCE.get('seleccionaEText').hide();
        }

        $('#seleccionaEText').hide();
        $('#seleccionaEVideo').hide();
        $('#seleccionaEVideoLocal').hide();
        $('#seleccionaEImage').hide();
        $('#seleccionaENoImage').hide();
        $('#seleccionaECover').hide();
        $('#seleccionaECursor').hide();
        $('#seleccionaENoImageVideo').hide();
        $('#seleccionaENoVideo').hide();

        switch (type) {
            case 0:
                $('#seleccionaECover').show();
                break;
            case 1:
                $('#seleccionaENoImage').show();
                $('#seleccionaETitleImage').show();
                $('#seleccionaEInputImage').show();
                $('#seleccionaEAuthorAlt')
                    .removeClass('d-none')
                    .addClass('d-flex');
                $('#seleccionaECursor').show();
                $('#seleccionaInputOptionsImage').show();
                $exeDevice.showImage(
                    $('#seleccionaEURLImage').val(),
                    $('#seleccionaEXImage').val(),
                    $('#seleccionaEYImage').val(),
                    $('#seleccionaEAlt').val(),
                    0
                );
                break;
            case 2:
                $('#seleccionaEImageVideo').show();
                $('#seleccionaETitleVideo').show();
                $('#seleccionaEInputVideo').show();
                $('#seleccionaENoVideo').show();
                $('#seleccionaEVideo').show();
                $('#seleccionaEInputOptionsVideo').show();
                $('#seleccionaEInputAudio')
                    .removeClass('d-flex')
                    .addClass('d-none');
                $('#seleccionaETitleAudio').hide();
                break;
            case 3:
                $('#seleccionaEText').show();
                if (tinyMCE.get('seleccionaEText')) {
                    tinyMCE.get('seleccionaEText').show();
                }
                break;
            default:
                break;
        }
    },

    showOptions: function (number) {
        $('.SLCNE-EOptionDiv').each(function (i) {
            $(this).show();
            if (i >= number) {
                $(this).hide();
                $exeDevice.showSolution('');
            }
        });

        $('.SLCNE-EAnwersOptions').each(function (j) {
            if (j >= number) {
                $(this).val('');
            }
        });
    },
    showSolution: function (solution) {
        $("input.SLCNE-ESolution[name='slcsolution']").prop('checked', false);

        for (let i = 0; i < solution.length; i++) {
            const sol = solution[i];
            $('.SLCNE-ESolution')[solution].checked = true;
            $(
                "input.SLCNE-ESolution[name='slcsolution'][value='" + sol + "']"
            ).prop('checked', true);
        }

        $('#selecionaESolutionSelect').text(solution);
    },

    createForm: function () {
        const path = $exeDevice.idevicePath,
            html = `
            <div id="quickMultipleQEIdeviceForm">
                <p class="exe-block-info exe-block-dismissible" style="position:relative">
                    ${_('Create activities with multiple choice questions or questions in which you have to put the answers in the right order.')}
                    <a href="https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe29/selecciona.html" hreflang="es" target="_blank">${_('Usage Instructions')}</a>
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Choose the right answers and click on the Check button.'))}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_('Options')}</a></legend>
                        <div id="seleccionaEOptions">
                            <div class="toggle-item mb-3" data-target="seleccionaEShowMinimize">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="seleccionaEShowMinimize" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="seleccionaEShowMinimize">${_('Show minimized.')} </label>
                            </div>
                            <div class="d-flex align-items-center gap-2 mb-3" data-target="seleccionaEOrderLinear">
                                <span>${_('Questions order')}:</span>
                                <span class="d-flex align-items-center gap-2 flex-nowrap">
                                    <div class="form-check form-check-inline m-0">
                                        <input class="form-check-input SLCNE-TypeOrder" checked="checked" id="seleccionaEOrderLinear" type="radio" name="slcgameorder" value="0" />
                                        <label class="form-check-label" for="seleccionaEOrderLinear">${_('Default')}</label>
                                    </div>
                                    <div class="form-check form-check-inline m-0">
                                        <input class="form-check-input SLCNE-TypeOrder" id="seleccionaEOrderRamdon" type="radio" name="slcgameorder" value="1" />
                                        <label class="form-check-label" for="seleccionaEOrderRamdon">${_('Random')}</label>
                                    </div>
                                    <div class="form-check form-check-inline m-0">
                                        <input class="form-check-input SLCNE-TypeOrder" id="seleccionaEOrderThree" type="radio" name="slcgameorder" value="2" />
                                        <label class="form-check-label" for="seleccionaEOrderThree">${_('Tree')}</label>
                                    </div>
                                </span>
                                <div class="GameModeLabel d-inline-flex align-items-center gap-2">
                                    <a href="#seleccionaEOrderHelp" id="seleccionaEOrderHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                        <img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}"/>
                                    </a>
                                </div>
                            </div>
                            <div id="seleccionaEOrderHelp" class="exe-block-info SLCNE-TypeGameHelp pt-3">
                                <ul>
                                    <li><strong>${_('Default')}: </strong>${_('Order defined by the author.')}</li>
                                    <li><strong>${_('Random')}: </strong>${_('Different order each time you run the game.')}</li>
                                    <li><strong>${_('Tree')}: </strong>${_('The questions will change depending on the answers.')}</li>
                                </ul>
                            </div>
                            <div class="toggle-item mb-3" data-target="seleccionaECustomMessages">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="seleccionaECustomMessages" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="seleccionaECustomMessages">${_('Custom messages')}.</label>
                            </div>
                            <div class="toggle-item mb-3" data-target="seleccionaEAnswersRamdon">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="seleccionaEAnswersRamdon" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="seleccionaEAnswersRamdon">${_('Random options')}</label>
                            </div>
                            <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                                <div class="toggle-item toggle-related" data-target="seleccionaEShowSolution">
                                    <span class="toggle-control">
                                        <input type="checkbox" class="toggle-input" id="seleccionaEShowSolution" checked />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="seleccionaEShowSolution">${_('Show solutions')}.</label>
                                </div>
                                <div class="mb-0 d-flex align-items-center gap-2">
                                    <input type="number" name="seleccionaETimeShowSolution" id="seleccionaETimeShowSolution" value="3" min="1" max="9" class="form-control" />
                                    <label for="seleccionaETimeShowSolution">${_('Show solution time (seconds)')}</label>
                                </div>
                            </div>
                            <div class="toggle-item mb-3" data-target="seleccionaEAudioFeedBack">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="seleccionaEAudioFeedBack" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="seleccionaEAudioFeedBack">${_('Play audio when displaying the solution')}.</label>
                            </div>
                            <div class="toggle-item  mb-3" data-target="seleccionaECustomScore">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="seleccionaECustomScore" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="seleccionaECustomScore">${_('Custom score')}.</label>
                            </div>
                            <div class="d-flex align-items-center gap-2 mb-3" data-target="seleccionaETypeActivity">
                                <span> ${_('Score')}:</span> 
                                <span class="d-flex align-items-center gap-2 flex-nowrap">
                                    <div class="form-check form-check-inline m-0">                               
                                        <input class="form-check-input SLCNE-TypeGame" checked="checked" id="seleccionaETypeActivity" type="radio" name="slcgamemode" value="1" />
                                        <label class="form-check-label" for="seleccionaETypeActivity">${_('From 0 to 10')}</label>
                                    </div>
                                    <div class="form-check form-check-inline m-0">
                                        <input class="form-check-input SLCNE-TypeGame" id="seleccionaEGameMode" type="radio" name="slcgamemode" value="0" />
                                        <label class="form-check-label" for="seleccionaEGameMode">${_('Points and lives')}</label>
                                    </div>
                                    <div class="form-check form-check-inline m-0">
                                        <input class="form-check-input SLCNE-TypeGame" id="seleccionaETypeReto" type="radio" name="slcgamemode" value="2" />
                                        <label class="form-check-label" for="seleccionaETypeReto">${_('No score')}</label>
                                    </div>
                                </span> 
                                <span class="GameModeLabel">
                                    <a href="#seleccionaEGameModeHelp" id="seleccionaEGameModeHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                        <img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}"/>
                                    </a>
                                </span>
                            </div>
                            <div id="seleccionaEGameModeHelp" class="exe-block-info SLCNE-TypeGameHelp pt-3">
                                <ul>
                                    <li><strong>${_('From 0 to 10')}: </strong>${_('No lives, 0 to 10 score, right/wrong answers counter... A more educational context.')}</li>
                                    <li><strong>${_('Points and lives')}: </strong>${_('Just like a game: Aim for a high score (thousands of points) and try not to lose your lives.')}</li>
                                    <li><strong>${_('No score')}: </strong>${_('No score and no lives. You have to answer right to get some information (a feedback).')}</li>
                                </ul>
                            </div>
                            <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                                <div class="toggle-item toggle-related" data-target="seleccionaEUseLives">
                                    <span class="toggle-control">
                                        <input type="checkbox" class="toggle-input" id="seleccionaEUseLives" checked />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="seleccionaEUseLives">${_('Use lives')}.</label>
                                </div>
                                <div class="mb-0 d-flex align-items-center gap-2 SLCNE-ELivesNumber">
                                    <input type="number" name="seleccionaENumberLives" id="seleccionaENumberLives" value="3" min="1" max="5" class="form-control" />
                                    <label for="seleccionaENumberLives">${_('Number of lives')}:</label>
                                </div>
                            </div>
                            <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                                <div class="toggle-item toggle-related" data-target="seleccionaEHasFeedBack">
                                    <span class="toggle-control">
                                        <input type="checkbox" class="toggle-input" id="seleccionaEHasFeedBack" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="seleccionaEHasFeedBack">${_('Feedback')}.</label>
                                </div>
                                <div class="mb-0 d-flex align-items-center gap-2">
                                    <input type="number" name="seleccionaEPercentajeFB" id="seleccionaEPercentajeFB" value="100" min="5" max="100" step="5" disabled class="form-control" />
                                    <label for="seleccionaEPercentajeFB">${_('&percnt; right to see the feedback')}</label>
                                </div>
                            </div>
                            <div id="seleccionaEFeedbackP" class="SLCNE-EFeedbackP mb-3">
                                <textarea id="seleccionaEFeedBackEditor" class="exe-html-editor form-control" rows="4"></textarea>
                            </div>
                            <div class="d-flex align-items-center flex-nowrap gap-2 mb-3">
                                <label for="seleccionaEVideoIntro" class="mb-0">${_('Video Intro')}:</label>
                                <input type="text" id="seleccionaEVideoIntro" class="form-control" style="max-width:250px" />
                                <a href="#" class="SLCNE-ButtonLink" id="seleccionaEVideoIntroPlay" title="${_('Play the introduction video')}">
                                    <img src="${path}quextIEPlay.png" alt="${_('Play')}" class="SLCNE-ENavigationButton" />
                                </a>
                            </div>
                            <div class="d-flex align-items-center flex-wrap mb-3 gap-2">
                                <div class="toggle-item toggle-related m-0" data-target="seleccionaEPercentajeQuestions">
                                    <span class="toggle-control">
                                        <input type="checkbox" class="toggle-input" id="seleccionaEPercentajeQuestions" checked>
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="seleccionaEPercentajeQuestions">%${_('Questions')}:</label>
                                </div>
                                <input type="number" name="seleccionaEPercentajeQuestionsValue" id="seleccionaEPercentajeQuestionsValue" value="100" min="1" max="100" class="form-control" />
                                <span id="seleccionaENumeroPercentaje" class="ms-2">1/1</span>
                            </div>
                            <div class="toggle-item mb-3" data-target="seleccionaModeBoard">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="seleccionaModeBoard" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="seleccionaModeBoard">${_('Digital whiteboard mode')}</label>
                            </div>
                            <div class="d-flex align-items-center gap-2 mb-3">
                                <label for="seleccionaEGlobalTimes">${_('Time per question')}:</label>
                                <select id="seleccionaEGlobalTimes" class="form-select form-select-sm" style="max-width:10ch">
                                    <option value="0" selected>15s</option>
                                    <option value="1">30s</option>
                                    <option value="2">1m</option>
                                    <option value="3">3m</option>
                                    <option value="4">5m</option>
                                    <option value="5">10m</option>
                                </select>
                                <button id="seleccionaGlobalTimeButton" class="btn btn-primary" type="button">${_('Accept')}</button> 
                            </div>
                            <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                                <div class="toggle-item" data-target="seleccionaEEvaluation">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="seleccionaEEvaluation" class="toggle-input" aria-label="${_('Progress report')}">
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="seleccionaEEvaluation">${_('Progress report')}.</label>
                                </div>
                                <div class="d-flex align-items-center flex-nowrap gap-2 ms-2 SLCNE-EEvaluationFields">
                                    <label for="seleccionaEEvaluationID" class="mb-0">${_('Identifier')}:</label>
                                    <input type="text" class="form-control" id="seleccionaEEvaluationID" disabled value="${eXeLearning.app.project.odeId || ''}" />
                                    <a href="#seleccionaEEvaluationHelp" id="seleccionaEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                        <img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}" />
                                    </a>
                                </div>
                            </div>
                            <p id="seleccionaEEvaluationHelp" class="exe-block-info SLCNE-TypeGameHelp">
                                ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                            </p>
                        </div>
                    </fieldset>
                    <fieldset class="exe-fieldset">
                        <legend><a href="#">${_('Questions')}</a></legend>
                        <div class="SLCNE-EPanel" id="seleccionaEPanel">
                            <div class="SLCNE-EOptionsMedia d-flex flex-nowrap align-items-center gap-2 mb-3">
                                <div class="SLCNE-EOptionsGame">
                                    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                                        <span>${_('Type')}:</span>
                                        <span class="d-flex align-items-center gap-2 flex-nowrap">
                                            <div class="form-check form-check-inline m-0">
                                                <input class="SLCNE-TypeSelect form-check-input" checked id="seleccionaTypeChoose" type="radio" name="slctypeselect" value="0"/>
                                                <label class="form-check-label" for="seleccionaTypeChoose">${_('Select')}</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="SLCNE-TypeSelect form-check-input" id="seleccionaTypeOrders" type="radio" name="slctypeselect" value="1"/>
                                                <label class="form-check-label" for="seleccionaTypeOrders">${_('Order')}</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="SLCNE-TypeSelect form-check-input" id="seleccionaTypeWord" type="radio" name="slctypeselect" value="2"/>
                                                <label class="form-check-label" for="seleccionaTypeWord">${_('Word')}</label>
                                            </div>
                                        </span>
                                    </div>
                                    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                                        <span>${_('Multimedia Type')}:</span>
                                        <span class="d-flex align-items-center gap-2 flex-nowrap">
                                            <div class="form-check form-check-inline m-0">
                                                <input class="SLCNE-Type form-check-input" checked="checked" id="seleccionaMediaNormal" type="radio" name="slcmediatype" value="0" disabled />
                                                <label class="form-check-label" for="seleccionaMediaNormal">${_('None')}</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="SLCNE-Type form-check-input" id="seleccionaMediaImage" type="radio" name="slcmediatype" value="1" disabled />
                                                <label class="form-check-label" for="seleccionaMediaImage">${_('Image')}</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="SLCNE-Type form-check-input" id="seleccionaMediaVideo" type="radio" name="slcmediatype" value="2" disabled />
                                             <label class="form-check-label" for="seleccionaMediaVideo">${_('Video')}</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="SLCNE-Type form-check-input" id="seleccionaMediaText" type="radio" name="slcmediatype" value="3" disabled />
                                                <label class="form-check-label" for="seleccionaMediaText">${_('Text')}</label>
                                            </div>
                                        </span>
                                    </div>
                                    <div class="d-flex flex-wrap align-items-center gap-2 mb-3" id="seleccionaEInputNumbers">
                                        <span>${_('Options Number')}:</span>
                                        <span class="d-flex align-items-center gap-2 flex-nowrap">
                                            <div class="form-check form-check-inline m-0">
                                                <input class="SLCNE-Number form-check-input" id="numQ2" type="radio" name="slcnumber" value="2" />
                                                <label class="form-check-label" for="numQ2">2</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="SLCNE-Number form-check-input" id="numQ3" type="radio" name="slcnumber" value="3" />
                                                <label class="form-check-label" for="numQ3">3</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="SLCNE-Number form-check-input" id="numQ4" type="radio" name="slcnumber" value="4" checked="checked" />
                                                <label class="form-check-label" for="numQ4">4</label>
                                            </div>
                                         </span>
                                    </div>
                                    <div id="seleccionaPercentageSpan" class="d-none flex-wrap align-items-center gap-2 mb-3">
                                        <span >${_('Percentage of letters to show (%)')}:</span>
                                        <span class="SLCNE-EPercentage" id="seleccionaPercentage">
                                            <input type="number" class="form-control form-control-sm"  name="seleccionaPercentageShow" id="seleccionaPercentageShow" value="35" min="0" max="100" step="5" />
                                        </span>
                                    </div>
                                    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                                        <span>${_('Time per question')}:</span>
                                        <span class="d-flex align-items-center gap-2 flex-nowrap">
                                            <div class="form-check form-check-inline m-0">
                                                <input class="SLCNE-Times form-check-input" checked="checked" id="q15s" type="radio" name="slctime" value="0" />
                                                <label class="form-check-label" for="q15s">15s</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="SLCNE-Times form-check-input" id="q30s" type="radio" name="slctime" value="1" />
                                                <label class="form-check-label" for="q30s">30s</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="SLCNE-Times form-check-input" id="q1m" type="radio" name="slctime" value="2" />
                                                <label class="form-check-label" for="q1m">1m</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="SLCNE-Times form-check-input" id="q3m" type="radio" name="slctime" value="3" />
                                                <label class="form-check-label" for="q3m">3m</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="SLCNE-Times form-check-input" id="q5m" type="radio" name="slctime" value="4" />
                                                <label class="form-check-label" for="q5m">5m</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="SLCNE-Times form-check-input" id="q10m" type="radio" name="slctime" value="5" />
                                                <label class="form-check-label" for="q10m">10m</label>
                                            </div>
                                        </span>
                                    </div>
                                    <div id="seleccionaEScoreQuestionDiv" class="SLCNE-ScoreQuestionDiv align-items-center gap-2 mb-3 d-none">
                                        <label for="seleccionaEScoreQuestion">${_('Score')}:</label>
                                        <input type="number" name="seleccionaEScoreQuestion" id="seleccionaEScoreQuestion" value="1" min="0" max="100" step="0.05" class="form-control"/>
                                    </div>
                                    <span class="SLCNE-ETitleImage" id="seleccionaETitleImage">${_('Image URL')}:</span>
                                    <div class="SLCNE-EInputImage SLCNE-Flex mb-3 gap-2" id="seleccionaEInputImage">
                                        <label class="sr-av" for="seleccionaEURLImage">${_('Image URL')}</label>
                                        <input type="text" class="exe-file-picker form-control w-100 me-0" id="seleccionaEURLImage"/>
                                        <a href="#" id="seleccionaEPlayImage" class="SLCNE-ENavigationButton" title="${_('Show')}"><img src="${path}quextIEPlay.png" alt="${_('Show')}" class="SLCNE-ENavigationButton " /></a>
                                    </div>
                                    <div class="SLCNE-EInputOptionsImage mb-3" id="seleccionaInputOptionsImage">
                                        <div class="SLCNE-ECoord">
                                            <label for="seleccionaEXImage">X:</label>
                                            <input id="seleccionaEXImage" type="text" value="0" class="form-control" />
                                            <label for="seleccionaEYImage">Y:</label>
                                            <input id="seleccionaEYImage" type="text" value="0" class="form-control" />
                                        </div>
                                    </div>
                                    <span class="SLCNE-ETitleVideo" id="seleccionaETitleVideo">${_('URL')}:</span>
                                    <div class="SLCNE-EInputVideo SLCNE-Flex mb-3 gap-2" id="seleccionaEInputVideo">
                                        <label class="sr-av" for="seleccionaEURLYoutube">${_('URL')}</label>
                                        <input id="seleccionaEURLYoutube" type="text" class="form-control" />
                                        <a href="#" id="seleccionaEPlayVideo" class="SLCNE-ENavigationButton" title="${_('Play video')}">
                                        <img src="${path}quextIEPlay.png" alt="${_('Play video')}" class="SLCNE-ENavigationButton " /></a>
                                    </div>
                                    <div id="seleccionaEInputOptionsVideo">
                                        <div class="d-flex align-items-center flex-nowrap gap-2 mb-3">
                                            <label for="seleccionaEInitVideo" class="mb-0">${_('Start')}:</label>
                                            <input id="seleccionaEInitVideo" type="text" value="00:00:00" maxlength="8" class="form-control" style="width: 13ch !important; text-align: center;" />
                                            <label for="seleccionaEEndVideo" class="mb-0 ms-2">${_('End')}:</label>
                                            <input id="seleccionaEEndVideo" type="text" value="00:00:00" maxlength="8" class="form-control" style="width: 13ch !important; text-align: center;" />
                                            <button class="btn btn-primary" id="seleccionaEVideoTime">00:00:00</button>
                                        </div>
                                        <div class="d-flex align-items-center flex-nowrap gap-2 mb-3">
                                            <label for="seleccionaESilenceVideo" class="mb-0">${_('Silence')}:</label>
                                            <input id="seleccionaESilenceVideo" type="text" value="00:00:00" maxlength="8" class="form-control" style="width: 13ch !important; text-align: center;" />
                                            <label for="seleccionaETimeSilence" class="mb-0 ms-2">${_('Time (s)')}</label>
                                            <input type="number" name="seleccionaETimeSilence" id="seleccionaETimeSilence" value="0" min="0" max="120" class="form-control" />
                                        </div>
                                        <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                                            <div class="toggle-item d-flex align-items-center gap-2" data-target="seleccionaECheckSoundVideo">
                                                <span class="toggle-control">
                                                    <input id="seleccionaECheckSoundVideo" type="checkbox" class="toggle-input" checked />
                                                    <span class="toggle-visual"></span>
                                                </span>
                                                <label for="seleccionaECheckSoundVideo" class="toggle-label mb-0">${_('Audio')}</label>
                                            </div>
                                            <div class="toggle-item d-flex align-items-center gap-2" data-target="seleccionaECheckImageVideo">
                                                <span class="toggle-control">
                                                    <input id="seleccionaECheckImageVideo" type="checkbox" class="toggle-input" checked />
                                                    <span class="toggle-visual"></span>
                                                </span>
                                                <label for="seleccionaECheckImageVideo" class="toggle-label mb-0">${_('Image')}</label>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="d-none flex-nowrap align-items-center gap-2 mb-3" id="seleccionaEAuthorAlt">
                                        <div class="SLCNE-EInputAuthor w-50" id="seleccionaInputAuthor">
                                            <label for="seleccionaEAuthor">${_('Authorship')}:</label>
                                            <input id="seleccionaEAuthor" type="text" class="form-control w-100" />
                                        </div>
                                        <div class="SLCNE-EInputAlt w-50" id="seleccionaInputAlt">
                                            <label for="seleccionaEAlt">${_('Alternative text')}:</label>
                                            <input id="seleccionaEAlt" type="text" class="form-control w-100" />
                                        </div>
                                    </div>
                                    <span id="seleccionaETitleAudio">${_('Audio')}:</span>
                                    <div class="d-flex flex-nowrap align-items-center gap-2 mb-3" id="seleccionaEInputAudio">
                                        <label class="sr-av" for="seleccionaEURLAudio">${_('URL')}</label>
                                        <input type="text" class="exe-file-picker w-100 form-control me-0" id="seleccionaEURLAudio"/>
                                        <a href="#" id="seleccionaEPlayAudio" class="SLCNE-ENavigationButton" title="${_('Play audio')}">
                                            <img src="${path}quextIEPlay.png" alt="${_('Play audio')}" class="SLCNE-ENavigationButton " />
                                        </a>
                                    </div>
                                </div>
                                <div class="SLCNE-EMultiMediaOption ">
                                    <div class="SLCNE-EMultimedia" id="seleccionaEMultimedia">
                                        <textarea id="seleccionaEText" class="form-control" style="display:none"></textarea>
                                        <img class="SLCNE-EMedia" src="${path}quextIEImage.png" id="seleccionaEImage" alt="${_('Image')}" />
                                        <img class="SLCNE-EMedia" src="${path}quextIEImage.png" id="seleccionaENoImage" alt="${_('No image')}" />
                                        <div class="SLCNE-EMedia" id="seleccionaEVideo" style="display:none"></div>
                                        <video class="SLCNE-EMedia" id="seleccionaEVideoLocal" preload="auto" controls style="display:none"></video>
                                        <img class="SLCNE-EMedia" src="${path}quextIENoImageVideo.png" id="seleccionaENoImageVideo" alt="" style="display:none" />
                                        <img class="SLCNE-EMedia" src="${path}quextIENoVideo.png" id="seleccionaENoVideo" alt="" style="display:none"/>
                                        <img class="SLCNE-ECursor" src="${path}quextIECursor.gif" id="seleccionaECursor" alt="" style="display:none"/>
                                        <img class="SLCNE-EMedia" src="${path}quextIECoverSelecciona.png" id="seleccionaECover" alt="${_('No image')}" />
                                    </div>
                                </div>
                            </div>
                            <div class="SLCNE-EContents">
                                <div id="seleccionaESolitionOptions" class="SLCNE-SolitionOptionsDiv"><span>${_('Question')}:</span><span><span>${_('Solution')}: </span><span id="selecionaESolutionSelect"></span></span></div>
                                <div class="SLCNE-EQuestionDiv" id="seleccionaEQuestionDiv">
                                    <label class="sr-av" for="seleccionaEQuestion">${_('Question')}:</label>
                                    <input type="text" class="SLCNE-EQuestion form-control" id="seleccionaEQuestion">
                                </div>
                                <div class="SLCNE-EAnswers" id="seleccionaEAnswers">
                                    <div class="SLCNE-EOptionDiv gap-2">
                                        <label class="sr-av" for="seleccionaESolution0">${_('Solution')} A:</label>
                                        <input type="checkbox" class="SLCNE-ESolution form-check-input me-0" name="slcsolution" id="seleccionaESolution0" value="A" />
                                        <label for="seleccionaEOption0">A</label>
                                        <input type="text" class="SLCNE-EOption0 SLCNE-EAnwersOptions form-control" id="seleccionaEOption0">
                                    </div>
                                    <div class="SLCNE-EOptionDiv gap-2">
                                        <label class="sr-av" for="seleccionaESolution1">${_('Solution')} B:</label>
                                        <input type="checkbox" class="SLCNE-ESolution form-check-input me-0" name="slcsolution" id="seleccionaESolution1" value="B" />
                                        <label for="seleccionaEOption1">B</label>
                                        <input type="text" class="SLCNE-EOption1 SLCNE-EAnwersOptions form-control" id="seleccionaEOption1">
                                    </div>
                                    <div class="SLCNE-EOptionDiv gap-2">
                                        <label class="sr-av" for="seleccionaESolution2">${_('Solution')} C:</label>
                                        <input type="checkbox" class="SLCNE-ESolution form-check-input me-0" name="slcsolution" id="seleccionaESolution2" value="C" />
                                        <label for="seleccionaEOption2">C</label>
                                        <input type="text" class="SLCNE-EOption2 SLCNE-EAnwersOptions form-control" id="seleccionaEOption2">
                                    </div>
                                    <div class="SLCNE-EOptionDiv gap-2">
                                        <label class="sr-av" for="seleccionaESolution3">${_('Solution')} D:</label>
                                        <input type="checkbox" class="SLCNE-ESolution form-check-input me-0" name="slcsolution" id="seleccionaESolution3" value="D" />
                                        <label for="seleccionaEOption3">D</label>
                                        <input type="text" class="SLCNE-EOption3 SLCNE-EAnwersOptions form-control" id="seleccionaEOption3">
                                    </div>
                                </div>
                                <div class="SLCNE-EWordDiv SLCNE-DP" id="selecionaEWordDiv">
                                    <div class="SLCNE-ESolutionWord"><label for="seleccionaESolutionWord">${_('Word/Phrase')}:</label><input type="text" id="seleccionaESolutionWord" class="form-control"/></div>
                                    <div class="SLCNE-ESolutionWord"><label for="seleccionaEDefinitionWord">${_('Definition')}:</label><input type="text" id="seleccionaEDefinitionWord" class="form-control"/></div>
                                </div>
                            </div>
                            <div class="SLCNE-EOrders" id="seleccionaEOrder">
                                <div class="SLCNE-ECustomMessage">
                                    <span class="sr-av">${_('Hit')}</span><span class="SLCNE-EHit"></span>
                                    <label for="seleccionaEMessageOK">${_('Message')}:</label>
                                    <input type="text" class="form-control" id="seleccionaEMessageOK">
                                    <label for="seleccionaGotoCorrect">${_('Go to')}:</label>
                                    <select name="seleccionaGotoCorrect" id="seleccionaGotoCorrect" class="form-select form-select-sm">
                                        <option value="-2">${_('End')}</option>
                                        <option value="-1" selected>${_('Next')}</option>
                                        <option value="0">${1}</option>
                                    </select>
                                </div>
                                <div class="SLCNE-ECustomMessage">
                                    <span class="sr-av">${_('Error')}</span><span class="SLCNE-EError"></span>
                                    <label for="seleccionaEMessageKO">${_('Message')}:</label>
                                    <input type="text" class="form-control" id="seleccionaEMessageKO">
                                    <label for="seleccionaGotoIncorrect">${_('Go to')}:</label>
                                    <select name="seleccionaGotoIncorrect" id="seleccionaGotoIncorrect" class="form-select form-select-sm">
                                        <option value="-2">${_('End')}</option>
                                        <option value="-1" selected>${_('Next')}</option>
                                        <option value="0">${1}</option>
                                    </select>
                                </div>
                            </div>
                            <div class="SLCNE-ENavigationButtons gap-2">
                                <a href="#" id="seleccionaEAdd" class="SLCNE-ENavigationButton" title="${_('Add question')}"><img src="${path}quextIEAdd.png" alt="${_('Add question')}" class="SLCNE-ENavigationButton" /></a>
                                <a href="#" id="seleccionaEFirst" class="SLCNE-ENavigationButton" title="${_('First question')}"><img src="${path}quextIEFirst.png" alt="${_('First question')}" class="SLCNE-ENavigationButton" /></a>
                                <a href="#" id="seleccionaEPrevious" class="SLCNE-ENavigationButton" title="${_('Previous question')}"><img src="${path}quextIEPrev.png" alt="${_('Previous question')}" class="SLCNE-ENavigationButton" /></a>
                                <label class="sr-av" for="seleccionaENumberQuestion">${_('Question number:')}</label><input type="text" class="SLCNE-NumberQuestion form-control" id="seleccionaENumberQuestion" value="1"/>
                                <a href="#" id="seleccionaENext" class="SLCNE-ENavigationButton" title="${_('Next question')}"><img src="${path}quextIENext.png" alt="${_('Next question')}" class="SLCNE-ENavigationButton" /></a>
                                <a href="#" id="seleccionaELast" class="SLCNE-ENavigationButton" title="${_('Last question')}"><img src="${path}quextIELast.png" alt="${_('Last question')}" class="SLCNE-ENavigationButton" /></a>
                                <a href="#" id="seleccionaEDelete" class="SLCNE-ENavigationButton" title="${_('Delete question')}"><img src="${path}quextIEDelete.png" alt="${_('Delete question')}" class="SLCNE-ENavigationButton" /></a>
                                <a href="#" id="seleccionaECopy" class="SLCNE-ENavigationButton" title="${_('Copy question')}"><img src="${path}quextIECopy.png" alt="${_('Copy question')}" class="SLCNE-ENavigationButton" /></a>
                                <a href="#" id="seleccionaECut" class="SLCNE-ENavigationButton" title="${_('Cut question')}"><img src="${path}quextIECut.png" alt="${_('Cut question')}" class="SLCNE-ENavigationButton" /></a>
                                <a href="#" id="seleccionaEPaste" class="SLCNE-ENavigationButton" title="${_('Paste question')}"><img src="${path}quextIEPaste.png" alt="${_('Paste question')}" class="SLCNE-ENavigationButton" /></a>
                            </div>
                            <div class="SLCNE-EVIDiv" id="seleccionaEVIDiv">
                                <div class="SLCNE-EVIV">
                                    <div class="SLCNE-EMVI">
                                        <div class="SLCNE-EVI" id="seleccionaEVI"></div>
                                        <video class="SLCNE-EVI" id="seleccionaEVILocal" preload="auto" controls></video>
                                        <img class="SLCNE-ENoVI" src="${path}quextIENoVideo.png" id="seleccionaEVINo" alt="" />
                                    </div>
                                </div>
                                <div class="SLCNE-EVIOptions d-flex align-items-center flex-wrap gap-2">
                                    <label for="seleccionaEVIURL" class="mb-0">${_('URL')}:</label>
                                    <input id="seleccionaEVIURL" type="text" class="form-control me-0" />
                                    <a href="#" id="seleccionaEVIPlayI" class="SLCNE-ENavigationButton " title="${_('Play the introduction video')}"><img src="${path}quextIEPlay.png" alt="${_('Play the introduction video')}" class="SLCNE-ENavigationButton intro" /></a>
                                    <label for="seleccionaEVIStart" class="mb-0">${_('Start')}:</label>
                                    <input id="seleccionaEVIStart" type="text" value="00:00:00" readonly class="form-control me-0" style="width: 13ch !important; text-align: center;" />
                                    <label for="seleccionaEVIEnd" class="mb-0">${_('End')}:</label>
                                    <input id="seleccionaEVIEnd" type="text" value="00:00:00" readonly class="form-control me-0"  style="width: 13ch !important; text-align: center;" />
                                    <button class="SLCNE-EVideoTime btn btn-primary" id="seleccionaEVITime" type="button">00:00:00</button>
                                </div>
                                <input type="button" class="SLCNE-EVIClose btn btn-primary mt-2" id="seleccionaEVIClose" value="${_('Close')}" />
                            </div>
                            <div class="SLCNE-ENumQuestionDiv" id="seleccionaENumQuestionDiv">
                                <div class="SLCNE-ENumQ"><span class="sr-av">${_('Number of questions:')}</span></div> <span class="SLCNE-ENumQuestions" id="seleccionaENumQuestions">0</span>
                            </div>
                        </div>
                    </fieldset>
                    ${$exeDevicesEdition.iDevice.common.getTextFieldset('after')}
                 </div>
                ${$exeDevicesEdition.iDevice.gamification.itinerary.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.scorm.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
                ${$exeDevicesEdition.iDevice.gamification.share.getTab(true, 3, true)}
                ${$exeDevicesEdition.iDevice.gamification.share.getTabIA(3)}

            </div>`;

        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('quickMultipleQEIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();

        tinymce.init({
            selector: '#seleccionaEText',
            height: 220,
            language: 'all',
            width: 400,
            plugins: ['code paste textcolor link'],
            paste_as_text: true,
            entity_encoding: 'raw',
            toolbar:
                'undo redo | removeformat | fontselect | formatselect | fontsizeselect | bold italic underline | alignleft aligncenter alignright alignjustify | forecolor backcolor | link ',
            fontsize_formats: '8pt 10pt 12pt 14pt 18pt 24pt 36pt',
            menubar: false,
            statusbar: false,
            setup: function (ed) {
                ed.on('init', function () {
                    $exeDevice.enableForm();
                });
            },
        });
    },

    initQuestions: function () {
        $('#seleccionaEInputImage').css('display', 'flex');
        $('#seleccionaEInputVideo').css('display', 'flex');
        $('#seleccionaMediaNormal').prop('disabled', false);
        $('#seleccionaMediaImage').prop('disabled', false);
        $('#seleccionaMediaText').prop('disabled', false);
        $('#seleccionaMediaVideo').prop('disabled', false);
        $('#seleccionaGotoCorrect').hide();
        $('#seleccionaGotoIncorrect').hide();
        $('label[for="seleccionaGotoCorrect"]').hide();
        $('label[for="seleccionaGotoIncorrect"]').hide();

        if ($exeDevice.selectsGame.length == 0) {
            const question = $exeDevice.getCuestionDefault();
            $exeDevice.selectsGame.push(question);
            this.changeTypeQuestion(0);
            this.showOptions(4);
            this.showSolution('');
        }
        $exeDevice.showTypeQuestion(0);
        this.active = 0;
        this.localPlayer = document.getElementById('seleccionaEVideoLocal');
        this.localPlayerIntro = document.getElementById('seleccionaEVILocal');
    },

    getCuestionDefault: function () {
        const p = {
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
            solutionWord: '',
            audio: '',
            hit: -1,
            error: -1,
            msgHit: '',
            msgError: '',
        };
        return p;
    },

    validTime: function (time) {
        const reg = /^(?:(?:([01]?\d|2[0-3]):)?([0-5]?\d):)?([0-5]?\d)$/;
        return time.length == 8 && reg.test(time);
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            $exeDevice.active = 0;

            const wrapper = $('<div></div>').html(originalHTML),
                json = $exeDevices.iDevice.gamification.helpers.decrypt(
                    $('.selecciona-DataGame', wrapper).text()
                ),
                dataGame =
                    $exeDevices.iDevice.gamification.helpers.isJsonString(json),
                $imagesLink = $('.selecciona-LinkImages', wrapper),
                $audiosLink = $('.selecciona-LinkAudios', wrapper);

            dataGame.modeBoard =
                dataGame.modeBoard === undefined ? false : dataGame.modeBoard;

            $imagesLink.each(function () {
                const iq = parseInt($(this).text(), 10);
                if (!isNaN(iq) && iq < dataGame.selectsGame.length) {
                    const selectGameItem = dataGame.selectsGame[iq];
                    selectGameItem.url = $(this).attr('href');
                    if (
                        selectGameItem.url.length < 4 &&
                        selectGameItem.type === 1
                    ) {
                        selectGameItem.url = '';
                    }
                }
            });

            dataGame.selectsGame.forEach(function (gameItem, index) {
                gameItem.audio =
                    gameItem.audio === undefined ? '' : gameItem.audio;
            });

            $audiosLink.each(function () {
                const iq = parseInt($(this).text(), 10);
                if (!isNaN(iq) && iq < dataGame.selectsGame.length) {
                    const selectGameItem = dataGame.selectsGame[iq];
                    selectGameItem.audio = $(this).attr('href');
                    if (selectGameItem.audio.length < 4) {
                        selectGameItem.audio = '';
                    }
                }
            });

            const instructions = $('.selecciona-instructions', wrapper);
            if (instructions.length === 1)
                $('#eXeGameInstructions').val(instructions.html());

            const textAfter = $('.selecciona-extra-content', wrapper);
            if (textAfter.length === 1)
                $('#eXeIdeviceTextAfter').val(textAfter.html());

            const textFeedBack = $('.selecciona-feedback-game', wrapper);
            if (textFeedBack.length === 1)
                $('#seleccionaEFeedBackEditor').val(textFeedBack.html());

            $exeDevicesEdition.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs
            );
            $exeDevice.updateFieldGame(dataGame);
        }
    },

    updateGameMode: function (gamemode, feedback, useLives) {
        $('#seleccionaEUseLives, #seleccionaENumberLives').prop(
            'disabled',
            true
        );
        $('#seleccionaEPercentajeFB').prop(
            'disabled',
            !feedback && gamemode !== 2
        );
        $('#seleccionaEHasFeedBack')
            .prop('disabled', gamemode === 2)
            .prop('checked', feedback);

        if (gamemode === 2 || feedback) {
            $('#seleccionaEFeedbackP').slideDown();
        } else {
            $('#seleccionaEFeedbackP').slideUp();
        }

        if (gamemode === 0) {
            $('#seleccionaEUseLives').prop('disabled', false);
            $('#seleccionaENumberLives').prop('disabled', !useLives);
        }
    },

    updateFieldGame: function (game) {
        $exeDevicesEdition.iDevice.gamification.itinerary.setValues(
            game.itinerary
        );
        game.answersRamdon = game.answersRamdon || false;
        game.percentajeFB =
            typeof game.percentajeFB != 'undefined' ? game.percentajeFB : 100;
        game.gameMode = typeof game.gameMode != 'undefined' ? game.gameMode : 0;
        game.feedBack =
            typeof game.feedBack != 'undefined' ? game.feedBack : false;
        game.customScore =
            typeof game.customScore == 'undefined' ? false : game.customScore;
        game.audioFeedBach =
            typeof game.audioFeedBach == 'undefined'
                ? false
                : game.audioFeedBach;
        game.customMessages =
            typeof game.customMessages == 'undefined'
                ? false
                : game.customMessages;
        game.percentajeQuestions =
            typeof game.percentajeQuestions == 'undefined'
                ? 100
                : game.percentajeQuestions;
        game.evaluation =
            typeof game.evaluation != 'undefined' ? game.evaluation : false;
        game.evaluationID =
            typeof game.evaluationID != 'undefined' ? game.evaluationID : '';
        game.weighted =
            typeof game.weighted != 'undefined' ? game.weighted : 100;
        game.globalTime =
            typeof game.globalTime != 'undefined' ? game.globalTime : 0;

        $exeDevice.id =
            typeof game.id !== 'undefined'
                ? game.id
                : $exeDevice.getIdeviceID();

        if (typeof game.order == 'undefined') {
            game.order = game.optionsRamdon ? 1 : 0;
        }

        $('#seleccionaEShowMinimize').prop('checked', game.showMinimize);
        $('#seleccionaEAnswersRamdon').prop('checked', game.answersRamdon);
        $('#seleccionaEUseLives').prop('checked', game.useLives);
        $('#seleccionaENumberLives').val(game.numberLives);
        $('#seleccionaEVideoIntro').val(game.idVideo);
        $('#seleccionaEShowSolution').prop('checked', game.showSolution);
        $('#seleccionaETimeShowSolution').prop('disabled', !game.showSolution);
        $('#seleccionaETimeShowSolution').val(game.timeShowSolution);
        $('#seleccionaModeBoard').prop('checked', game.modeBoard);
        $('#seleccionaENumberLives').prop('disabled', !game.useLives);
        $('#seleccionaEVIURL').val(game.idVideo);
        $('#seleccionaEVIEnd').val(
            $exeDevices.iDevice.gamification.helpers.secondsToHour(
                game.endVideo
            )
        );
        $('#seleccionaEVIStart').val(
            $exeDevices.iDevice.gamification.helpers.secondsToHour(
                game.startVideo
            )
        );
        $('#seleccionaECustomScore').prop('checked', game.customScore);
        $('#seleccionaECustomScore').prop('disabled', game.order == 2);
        $('#seleccionaEPercentajeQuestionsValue').prop(
            'disabled',
            game.order == 2
        );
        $('#seleccionaECustomMessages').prop('checked', game.customMessages);
        $('#seleccionaECustomMessages').prop('disabled', game.order == 2);
        $('#seleccionaEAudioFeedBack').prop('checked', game.audioFeedBach);
        $('#seleccionaEScoreQuestionDiv')
            .addClass('d-none')
            .removeClass('d-flex');
        $('#seleccionaEHasFeedBack').prop('checked', game.feedBack);
        $('#seleccionaEPercentajeFB').val(game.percentajeFB);
        $(
            `input.SLCNE-TypeGame[name='slcgamemode'][value="${game.gameMode}"]`
        ).prop('checked', true);
        $(
            "input.SLCNE-TypeOrder[name='slcgameorder'][value='" +
                game.order +
                "']"
        ).prop('checked', true);
        $('#seleccionaEUseLives').prop('disabled', game.gameMode == 0);
        $('#seleccionaENumberLives').prop(
            'disabled',
            game.gameMode == 0 && game.useLives
        );
        $('#seleccionaEPercentajeQuestionsValue').val(game.percentajeQuestions);
        $('#seleccionaEEvaluation').prop('checked', game.evaluation);
        $('#seleccionaEEvaluationID').val(game.evaluationID);
        $('#seleccionaEGlobalTimes').val(game.globalTime);

        $('#seleccionaEEvaluationID').prop('disabled', !game.evaluation);
        $exeDevice.updateGameMode(game.gameMode, game.feedBack, game.useLives);
        $exeDevice.showSelectOrder(
            game.order,
            game.customMessages,
            game.customScore
        );

        for (let i = 0; i < game.selectsGame.length; i++) {
            game.selectsGame[i].audio =
                typeof game.selectsGame[i].audio == 'undefined'
                    ? ''
                    : game.selectsGame[i].audio;
            game.selectsGame[i].hit =
                typeof game.selectsGame[i].hit == 'undefined'
                    ? -1
                    : game.selectsGame[i].hit;
            game.selectsGame[i].error =
                typeof game.selectsGame[i].error == 'undefined'
                    ? -1
                    : game.selectsGame[i].error;
            game.selectsGame[i].msgHit =
                typeof game.selectsGame[i].msgHit == 'undefined'
                    ? ''
                    : game.selectsGame[i].msgHit;
            game.selectsGame[i].msgError =
                typeof game.selectsGame[i].msgError == 'undefined'
                    ? ''
                    : game.selectsGame[i].msgError;
            game.selectsGame[i].typeSelect =
                typeof game.selectsGame[i].typeSelect == 'undefined'
                    ? ''
                    : game.selectsGame[i].typeSelect;
            game.selectsGame[i].solutionQuestion =
                typeof game.selectsGame[i].solutionQuestion == 'undefined'
                    ? ''
                    : game.selectsGame[i].solutionQuestion;
        }
        if (game.feedBack || game.gameMode == 2) {
            $('#seleccionaEFeedbackP').show();
        } else {
            $('#seleccionaEFeedbackP').hide();
        }
        $('#seleccionaEPercentajeFB').prop('disabled', !game.feedBack);
        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted
        );
        $exeDevice.selectsGame = game.selectsGame;
        $exeDevice.updateSelectOrder();
        $exeDevice.showQuestion($exeDevice.active);
    },

    getMediaType: function () {
        const ele = document.getElementsByName('slcmediatype');
        for (let i = 0; i < ele.length; i++) {
            if (ele[i].checked) {
                return ele[i].value;
            }
        }
    },

    escapeHtml: function (string) {
        return String(string)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    save: function () {
        if (!$exeDevice.validateQuestion()) {
            return false;
        }

        const dataGame = this.validateData();
        if (!dataGame) {
            return false;
        }

        $exeDevice.stopSound();
        $exeDevice.stopVideo();
        $exeDevice.stopVideoIntro();

        const fields = this.ci18n;
        const i18n = { ...fields };

        for (let key in fields) {
            const fVal = $('#ci18n_' + key).val();
            if (fVal !== '') {
                i18n[key] = fVal;
            }
        }

        dataGame.msgs = i18n;

        const json = JSON.stringify(dataGame),
            instructions = tinyMCE.get('eXeGameInstructions').getContent();

        let divContent = '';
        if (instructions !== '') {
            divContent = `<div class="selecciona-instructions SLCNP-instructions">${instructions}</div>`;
        }

        const textFeedBack = tinyMCE
            .get('seleccionaEFeedBackEditor')
            .getContent();
        const linksImages = $exeDevice.createlinksImage(dataGame.selectsGame),
            linksAudios = $exeDevice.createlinksAudio(dataGame.selectsGame);

        let html = '<div class="selecciona-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html += divContent;
        html += `<div class="selecciona-version js-hidden">${$exeDevice.version}</div>`;
        html += `<div class="selecciona-feedback-game">${textFeedBack}</div>`;
        html += `<div class="selecciona-DataGame js-hidden">${$exeDevices.iDevice.gamification.helpers.encrypt(json)}</div>`;

        html += linksImages;
        html += linksAudios;

        const textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();
        if (textAfter !== '') {
            html += `<div class="selecciona-extra-content">${textAfter}</div>`;
        }

        html += `<div class="selecciona-bns js-hidden">${$exeDevice.msgs.msgNoSuportBrowser}</div>`;
        html += '</div>';

        return html;
    },

    validateAlt: function () {
        // eXe 3.0
        const altImage = $('#seleccionaEAlt').val();
        if (!$exeDevice.checkAltImage) {
            return true;
        }
        if (altImage !== '') {
            return true;
        }
        eXe.app.confirm(
            $exeDevice.msgs.msgTitleAltImageWarning,
            $exeDevice.msgs.msgAltImageWarning,
            () => {
                $exeDevice.checkAltImage = false;
                const saveButton = document.getElementsByClassName(
                    'button-save-idevice'
                )[0];
                saveButton.click();
            }
        );
        return false;
    },

    validateQuestion: function () {
        const msgs = $exeDevice.msgs;
        let p = {},
            message = '';

        p.type = parseInt($('input[name=slcmediatype]:checked').val());
        p.time = parseInt($('input[name=slctime]:checked').val());
        p.numberOptions = parseInt($('input[name=slcnumber]:checked').val());
        p.typeSelect = parseInt($('input[name=slctypeselect]:checked').val());
        p.x = parseFloat($('#seleccionaEXImage').val());
        p.y = parseFloat($('#seleccionaEYImage').val());
        p.author = $('#seleccionaEAuthor').val();
        p.alt = $('#seleccionaEAlt').val();
        p.customScore = parseFloat($('#seleccionaEScoreQuestion').val());
        p.url = $('#seleccionaEURLImage').val();
        p.audio = $('#seleccionaEURLAudio').val();
        p.hit = parseInt($('#seleccionaGotoCorrect').val());
        p.error = parseInt($('#seleccionaGotoIncorrect').val());
        p.msgHit = $('#seleccionaEMessageOK').val();
        p.msgError = $('#seleccionaEMessageKO').val();

        $exeDevice.stopSound();
        $exeDevice.stopVideo();

        if (p.type == 2) {
            p.url = $exeDevices.iDevice.gamification.media.getIDYoutube(
                $('#seleccionaEURLYoutube').val().trim()
            )
                ? $('#seleccionaEURLYoutube').val()
                : '';
            if (p.url == '') {
                p.url =
                    $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                        $('#seleccionaEURLYoutube').val().trim()
                    )
                        ? $('#seleccionaEURLYoutube').val()
                        : '';
            }
        }

        p.soundVideo = $('#seleccionaECheckSoundVideo').is(':checked') ? 1 : 0;
        p.imageVideo = $('#seleccionaECheckImageVideo').is(':checked') ? 1 : 0;

        let isVideo =
            $('#seleccionaEInitVideo').length == 1
                ? $('#seleccionaEInitVideo').val().trim()
                : '00:00:00';
        p.iVideo =
            $exeDevices.iDevice.gamification.helpers.hourToSeconds(isVideo);

        let fsVideo =
            $('#seleccionaEEndVideo').length == 1
                ? $('#seleccionaEEndVideo').val().trim()
                : '00:00:00';
        p.fVideo =
            $exeDevices.iDevice.gamification.helpers.hourToSeconds(fsVideo);

        let ssVideo =
            $('#seleccionaESilenceVideo').length == 1
                ? $('#seleccionaESilenceVideo').val().trim()
                : '00:00:00';
        p.silentVideo =
            $exeDevices.iDevice.gamification.helpers.hourToSeconds(ssVideo);

        let stVideo =
            $('#seleccionaESilenceVideo').length == 1
                ? $('#seleccionaESilenceVideo').val()
                : 0;
        p.tSilentVideo = parseInt(stVideo);

        p.eText = tinyMCE.get('seleccionaEText').getContent() || '';
        p.quextion = $('#seleccionaEQuestion').val().trim();
        p.options = [];
        p.solution = $('#selecionaESolutionSelect').text().trim();
        p.solutionQuestion = '';

        if (p.typeSelect == 2) {
            p.quextion = $('#seleccionaEDefinitionWord').val().trim();
            p.solution = '';
            p.solutionQuestion = $('#seleccionaESolutionWord').val();
        }

        p.percentageShow = parseInt($('#seleccionaPercentageShow').val());

        let optionEmpy = false;
        $('.SLCNE-EAnwersOptions').each(function (i) {
            let option = $(this).val().trim();
            if (i < p.numberOptions && option.length == 0) {
                optionEmpy = true;
            }
            if (p.typeSelect == 2) {
                option = '';
            }
            p.options.push(option);
        });

        if (p.typeSelect == 1 && p.solution.length != p.numberOptions) {
            message = msgs.msgTypeChoose;
        } else if (p.typeSelect != 2 && p.quextion.length == 0) {
            message = msgs.msgECompleteQuestion;
        } else if (p.typeSelect != 2 && optionEmpy) {
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
                !$exeDevice.validTime($('#seleccionaEInitVideo').val())) ||
            !$exeDevice.validTime($('#seleccionaEEndVideo').val())
        ) {
            message = $exeDevice.msgs.msgTimeFormat;
        } else if (
            p.type == 2 &&
            p.tSilentVideo > 0 &&
            !$exeDevice.validTime($('#seleccionaESilenceVideo').val())
        ) {
            message = msgs.msgTimeFormat;
        } else if (
            p.type == 2 &&
            p.tSilentVideo > 0 &&
            (p.silentVideo < p.iVideo || p.silentVideo >= p.fVideo)
        ) {
            message = msgs.msgSilentPoint;
        } else if (p.typeSelect == 2 && p.solutionQuestion.trim().length == 0) {
            message = $exeDevice.msgs.msgEProvideWord;
        } else if (p.typeSelect == 2 && p.quextion.trim().length == 0) {
            message = $exeDevice.msgs.msgEDefintion;
        }

        const order = parseInt($('input[name=slcgameorder]:checked').val());

        if (order == 2) {
            if (p.hit >= $exeDevice.selectsGame.length) {
                message = $exeDevice.msgs.msgNotHitCuestion;
            }
            if (p.error >= $exeDevice.selectsGame.length) {
                message = $exeDevice.msgs.msgNotErrorCuestion;
            }
        }

        if (message.length == 0) {
            $exeDevice.selectsGame[$exeDevice.active] = p;
            message = true;
        } else {
            $exeDevice.showMessage(message);
            message = false;
        }

        return message;
    },

    createlinksImage: function (selectsGame) {
        let html = '';
        selectsGame.forEach((gameItem, index) => {
            if (gameItem.type === 1 && gameItem.url.indexOf('http') !== 0) {
                html += `<a href="${gameItem.url}" class="js-hidden selecciona-LinkImages">${index}</a>`;
            }
        });
        return html;
    },

    createlinksAudio: function (selectsGame) {
        let html = '';
        selectsGame.forEach((gameItem, index) => {
            if (
                gameItem.type !== 2 &&
                gameItem.audio.indexOf('http') !== 0 &&
                gameItem.audio.length > 4
            ) {
                html += `<a href="${gameItem.audio}" class="js-hidden selecciona-LinkAudios">${index}</a>`;
            }
        });
        return html;
    },

    getIdeviceID: function () {
        const ideviceid =
            $('#quickMultipleQEIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';

        return ideviceid;
    },

    exportQuestions: function () {
        const dataGame = this.validateData();
        if (!dataGame) return false;

        const lines = this.getLinesQuestions(dataGame.selectsGame);
        const fileContent = lines.join('\n');
        const newBlob = new Blob([fileContent], { type: 'text/plain' });
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveOrOpenBlob(newBlob);
            return;
        }
        const data = window.URL.createObjectURL(newBlob);
        const link = document.createElement('a');
        link.href = data;
        link.download = `${_('test')}.txt`;

        document.getElementById('quickMultipleQEIdeviceForm').appendChild(link);
        link.click();
        setTimeout(() => {
            document
                .getElementById('quickMultipleQEIdeviceForm')
                .removeChild(link);
            window.URL.revokeObjectURL(data);
        }, 100);
    },

    getLinesQuestions: function (questions) {
        let linequestions = [];
        for (let i = 0; i < questions.length; i++) {
            let q = questions[i];
            let question = '';
            if (q.typeSelect !== 2) {
                question = `${q.solution}#${q.quextion}`;
                for (let j = 0; j < q.options.length; j++) {
                    if (q.options[j]) {
                        question += `#${q.options[j]}`;
                    }
                }
            } else {
                question = `${q.solutionQuestion}#${q.quextion}`;
            }

            linequestions.push(question);
        }
        return linequestions;
    },

    validateData: function () {
        const clear = $exeDevice.removeTags,
            instructions = $('#eXeGameInstructions').text(),
            instructionsExe = escape(
                tinyMCE.get('eXeGameInstructions').getContent()
            ),
            textAfter = escape(tinyMCE.get('eXeIdeviceTextAfter').getContent()),
            textFeedBack = escape(
                tinyMCE.get('seleccionaEFeedBackEditor').getContent()
            ),
            showMinimize = $('#seleccionaEShowMinimize').is(':checked'),
            modeBoard = $('#seleccionaModeBoard').is(':checked'),
            optionsRamdon = false,
            answersRamdon = $('#seleccionaEAnswersRamdon').is(':checked'),
            showSolution = $('#seleccionaEShowSolution').is(':checked'),
            timeShowSolution = parseInt(
                clear($('#seleccionaETimeShowSolution').val())
            ),
            useLives = $('#seleccionaEUseLives').is(':checked'),
            numberLives = parseInt(clear($('#seleccionaENumberLives').val())),
            idVideo = $('#seleccionaEVideoIntro').val(),
            endVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                $('#seleccionaEVIEnd').val()
            ),
            startVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                $('#seleccionaEVIStart').val()
            ),
            itinerary =
                $exeDevicesEdition.iDevice.gamification.itinerary.getValues(),
            customScore = $('#seleccionaECustomScore').is(':checked'),
            customMessages = $('#seleccionaECustomMessages').is(':checked'),
            feedBack = $('#seleccionaEHasFeedBack').is(':checked'),
            percentajeFB = parseInt(clear($('#seleccionaEPercentajeFB').val())),
            gameMode = parseInt($('input[name=slcgamemode]:checked').val()),
            order = parseInt($('input[name=slcgameorder]:checked').val()),
            audioFeedBach = $('#seleccionaEAudioFeedBack').is(':checked'),
            percentajeQuestions = parseInt(
                clear($('#seleccionaEPercentajeQuestionsValue').val())
            ),
            evaluation = $('#seleccionaEEvaluation').is(':checked'),
            evaluationID = $('#seleccionaEEvaluationID').val(),
            id = $exeDevice.getIdeviceID(),
            globalTime = parseInt($('#seleccionaEGlobalTimes').val(), 10);

        if (!itinerary) return false;

        if ((gameMode == 2 || feedBack) && textFeedBack.trim().length == 0) {
            eXe.app.alert($exeDevice.msgs.msgProvideFB);
            return false;
        }
        if (showSolution && timeShowSolution.length == 0) {
            $exeDevice.showMessage($exeDevice.msgs.msgEProvideTimeSolution);
            return false;
        }
        if (evaluation && evaluationID.length < 5) {
            eXe.app.alert($exeDevice.msgs.msgIDLenght);
            return false;
        }
        const selectsGame = $exeDevice.selectsGame;

        for (let i = 0; i < selectsGame.length; i++) {
            let mquestion = selectsGame[i];
            mquestion.customScore =
                typeof mquestion.customScore == 'undefined'
                    ? 1
                    : mquestion.customScore;
            if (mquestion.quextion.length == 0) {
                $exeDevice.showMessage($exeDevice.msgs.msgECompleteQuestion);
                return false;
            } else if (mquestion.type == 1 && mquestion.url.length < 10) {
                $exeDevice.showMessage($exeDevice.msgs.msgEURLValid);
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
                $exeDevice.showMessage($exeDevice.msgs.msgECompleteURLYoutube);
                return false;
            }
            if (mquestion.typeSelect == 2) {
                if (mquestion.solutionQuestion.length == 0) {
                    $exeDevice.showMessage($exeDevice.msgs.msgProvideSolution);
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
                        $exeDevice.msgs.msgECompleteAllOptions
                    );
                    return false;
                }
            }
        }

        selectsGame.forEach((qt) => {
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
            }
        });

        const scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();
        return {
            asignatura: '',
            author: '',
            authorVideo: '',
            typeGame: 'Selecciona',
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
            selectsGame: selectsGame,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted || 100,
            title: '',
            customScore: customScore,
            textAfter: textAfter,
            textFeedBack: textFeedBack,
            gameMode: gameMode,
            feedBack: feedBack,
            percentajeFB: percentajeFB,
            order: order,
            customMessages: customMessages,
            version: 3.1,
            percentajeQuestions: percentajeQuestions,
            audioFeedBach: audioFeedBach,
            modeBoard: modeBoard,
            evaluation: evaluation,
            evaluationID: evaluationID,
            id: id,
            globalTime: globalTime,
        };
    },

    removeTags: function (str) {
        return $('<div></div>').html(str).text();
    },

    showTypeQuestion: function (type) {
        if (type == 2) {
            $('#seleccionaEAnswers').hide();
            $('#seleccionaEQuestionDiv')
                .removeClass('d-flax')
                .addClass('d-none');
            $('#quickMultipleQEIdeviceForm .SLCNE-ESolutionSelect').hide();
            $('#seleccionaEInputNumbers')
                .removeClass('d-flax')
                .addClass('d-none');
            $('#seleccionaESolitionOptions')
                .removeClass('d-flax')
                .addClass('d-none');
            $('#seleccionaPercentageSpan')
                .removeClass('d-none')
                .addClass('d-flex');
            $('#seleccionaPercentage').removeClass('d-none').addClass('d-flex');
            $('#selecionaEWordDiv').show();
        } else {
            $('#seleccionaEAnswers').show();
            $('#seleccionaEQuestionDiv')
                .removeClass('d-none')
                .addClass('d-flex');
            $('#quickMultipleQEIdeviceForm .SLCNE-ESolutionSelect').show();
            $('#seleccionaEInputNumbers')
                .removeClass('d-none')
                .addClass('d-flex');
            $('#seleccionaESolitionOptions')
                .removeClass('d-none')
                .addClass('d-flex');
            $('#seleccionaPercentageSpan')
                .removeClass('d-flax')
                .addClass('d-none');
            $('#seleccionaPercentage').removeClass('d-flax').addClass('d-none');
            $('#selecionaEWordDiv').hide();
        }
    },
    addEvents: function () {
        const $seleccionaEPaste = $('#seleccionaEPaste'),
            $seleccionaEUseLives = $('#seleccionaEUseLives'),
            $seleccionaENumberLives = $('#seleccionaENumberLives'),
            $seleccionaETimeShowSolution = $('#seleccionaETimeShowSolution'),
            $seleccionaEShowSolution = $('#seleccionaEShowSolution'),
            $seleccionaEPercentajeQuestions = $(
                '#seleccionaEPercentajeQuestionsValue'
            ),
            $seleccionaENumberQuestion = $('#seleccionaENumberQuestion'),
            $quickMultipleQEIdeviceForm = $('#quickMultipleQEIdeviceForm'),
            $seleccionaEInitVideo = $('#seleccionaEInitVideo'),
            $seleccionaEEndVideo = $('#seleccionaEEndVideo'),
            $seleccionaESilenceVideo = $('#seleccionaESilenceVideo');

        $seleccionaEPaste.hide();

        // Delegación genérica para toggles estilo switch (paridad con guess.js)
        $quickMultipleQEIdeviceForm.on(
            'click.qq.toggle',
            '.toggle-item',
            function (e) {
                // Evita doble cambio si el clic es directamente sobre el input, label asociado
                // o sobre controles interactivos internos (números, textos, selects, botones)
                if (
                    $(e.target).is(
                        'input.toggle-input, label[for], input[type=number], input[type=text], select, textarea, button'
                    )
                )
                    return;
                // No alternar si el clic proviene del campo identificador de evaluación o su enlace de ayuda
                if (
                    $(e.target).is('#seleccionaEEvaluationID') ||
                    $(e.target).closest('#seleccionaEEvaluationHelpLnk').length
                )
                    return;
                const $input = $(this).find('input.toggle-input').first();
                if ($input.length) {
                    const newVal = !$input.prop('checked');
                    $input.prop('checked', newVal).trigger('change');
                }
            }
        );

        // Evitar que el clic dentro del campo de evaluación dispare el toggle del contenedor
        $quickMultipleQEIdeviceForm.on(
            'click',
            '#seleccionaEEvaluationID',
            function (e) {
                e.stopPropagation();
            }
        );
        $quickMultipleQEIdeviceForm.on(
            'click',
            '#seleccionaEEvaluationHelpLnk, #seleccionaEEvaluationHelpLnk *',
            function (e) {
                e.stopPropagation();
            }
        );

        $seleccionaEUseLives.on('change', function () {
            const marcado = $(this).is(':checked');
            $seleccionaENumberLives.prop('disabled', !marcado);
        });

        $seleccionaEInitVideo
            .add($seleccionaEEndVideo)
            .add($seleccionaESilenceVideo)
            .on('focusout', function () {
                if (!$exeDevice.validTime(this.value)) {
                    $(this).css({
                        'background-color': 'red',
                        color: 'white',
                    });
                }
            })
            .on('click', function () {
                $(this).css({
                    'background-color': 'white',
                    color: '#2c6d2c',
                });
            });

        $('#seleccionaShowCodeAccess').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#seleccionaCodeAccess, #seleccionaMessageCodeAccess').prop(
                'disabled',
                !marcado
            );
        });

        $('.SLCNE-EPanel').on('click', 'input.SLCNE-Type', function () {
            const type = parseInt($(this).val(), 10);
            $exeDevice.changeTypeQuestion(type);
        });

        $('.SLCNE-EPanel').on('click', 'input.SLCNE-TypeSelect', function () {
            const type = parseInt($(this).val(), 10);
            $exeDevice.showTypeQuestion(type);
        });

        $('.SLCNE-EPanel').on('click', 'input.SLCNE-Number', function () {
            const number = parseInt($(this).val(), 10);
            $exeDevice.showOptions(number);
        });

        $('#seleccionaEAdd').on('click', (e) => {
            e.preventDefault();
            $exeDevice.addQuestion();
        });

        $('#seleccionaEFirst').on('click', (e) => {
            e.preventDefault();
            $exeDevice.firstQuestion();
        });

        $('#seleccionaEPrevious').on('click', (e) => {
            e.preventDefault();
            $exeDevice.previousQuestion();
        });

        $('#seleccionaENext').on('click', (e) => {
            e.preventDefault();
            $exeDevice.nextQuestion();
        });

        $('#seleccionaELast').on('click', (e) => {
            e.preventDefault();
            $exeDevice.lastQuestion();
        });

        $('#seleccionaEDelete').on('click', (e) => {
            e.preventDefault();
            $exeDevice.removeQuestion();
        });

        $('#seleccionaECopy').on('click', (e) => {
            e.preventDefault();
            $exeDevice.copyQuestion();
        });

        $('#seleccionaECut').on('click', (e) => {
            e.preventDefault();
            $exeDevice.cutQuestion();
        });

        $('#seleccionaEPaste').on('click', (e) => {
            e.preventDefault();
            $exeDevice.pasteQuestion();
        });

        $('#seleccionaGlobalTimeButton').on('click', (e) => {
            e.preventDefault();
            const selectedTime = parseInt(
                $('#seleccionaEGlobalTimes').val(),
                10
            );
            for (let i = 0; i < $exeDevice.selectsGame.length; i++) {
                $exeDevice.selectsGame[i].time = selectedTime;
            }
            $(
                `input.SLCNE-Times[name='slctime'][value='${selectedTime}']`
            ).prop('checked', true);
        });

        $('#seleccionaEPlayVideo').on('click', (e) => {
            e.preventDefault();
            $exeDevice.playVideoQuestion();
        });

        $('#seleccionaECheckSoundVideo, #seleccionaECheckImageVideo').on(
            'change',
            () => {
                $exeDevice.playVideoQuestion();
            }
        );

        $seleccionaENumberLives
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 1);
                this.value = v;
            })
            .on('focusout', function () {
                let val = parseInt(this.value.trim() || 3, 10);
                val = Math.max(1, Math.min(val, 5));
                this.value = val;
            });

        $seleccionaETimeShowSolution
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 1);
                this.value = v;
            })
            .on('focusout', function () {
                let val = parseInt(this.value.trim() || 3, 10);
                val = Math.max(1, Math.min(val, 9));
                this.value = val;
            });

        $('#seleccionaETimeSilence').on('keyup', function () {
            let v = this.value.replace(/\D/g, '').substring(0, 1);
            this.value = v;
        });

        $('#seleccionaPercentageShow')
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 3);
                this.value = v;
            })
            .on('focusout', function () {
                let val = parseInt(this.value.trim() || 35, 10);
                val = Math.max(0, Math.min(val, 100));
                this.value = val;
            });

        $('#seleccionaEScoreQuestion').on('focusout', function () {
            if (!$exeDevice.validateScoreQuestion($(this).val())) {
                $(this).val(1);
            }
        });

        $quickMultipleQEIdeviceForm.on(
            'dblclick',
            '#seleccionaEImage',
            function () {
                $('#seleccionaECursor').hide();
                $('#seleccionaEXImage, #seleccionaEYImage').val(0);
            }
        );

        if (
            window.File &&
            window.FileReader &&
            window.FileList &&
            window.Blob
        ) {
            $('#eXeGameExportImport .exe-field-instructions')
                .eq(0)
                .text(`${_('Supported formats')}: txt, xml(Moodle)`);
            $('#eXeGameExportImport').show();
            $('#eXeGameImportGame')
                .attr('accept', '.txt, .xml')
                .on('change', function (e) {
                    const file = e.target.files[0];
                    if (!file) {
                        $exeDevice.showMessage(
                            `${_('Select a file')} (txt, xml(Moodle))`
                        );
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
                        $exeDevice.showMessage(
                            `${_('Select a file')} (txt, xml(Moodle))`
                        );
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        $exeDevice.importGame(e.target.result, file.type);
                    };
                    reader.readAsText(file);
                });
            $('#eXeGameExportQuestions').on('click', () => {
                $exeDevice.exportQuestions();
            });
        } else {
            $('#eXeGameExportImport').hide();
        }

        $seleccionaEInitVideo.css('color', '#2c6d2c').on('click', (e) => {
            e.preventDefault();
            $exeDevice.timeVideoFocus = 0;
            $seleccionaEInitVideo.css('color', '#2c6d2c');
            $seleccionaEEndVideo
                .add($seleccionaESilenceVideo)
                .css('color', '#000000');
        });

        $seleccionaEEndVideo.on('click', (e) => {
            e.preventDefault();
            $exeDevice.timeVideoFocus = 1;
            $seleccionaEEndVideo.css('color', '#2c6d2c');
            $seleccionaEInitVideo
                .add($seleccionaESilenceVideo)
                .css('color', '#000000');
        });

        $seleccionaESilenceVideo.on('click', (e) => {
            e.preventDefault();
            $exeDevice.timeVideoFocus = 2;
            $seleccionaESilenceVideo.css('color', '#2c6d2c');
            $seleccionaEInitVideo
                .add($seleccionaEEndVideo)
                .css('color', '#000000');
        });

        $('#seleccionaEVideoTime').on('click', (e) => {
            e.preventDefault();
            let $timeV;
            switch ($exeDevice.timeVideoFocus) {
                case 0:
                    $timeV = $seleccionaEInitVideo;
                    break;
                case 1:
                    $timeV = $seleccionaEEndVideo;
                    break;
                case 2:
                    $timeV = $seleccionaESilenceVideo;
                    break;
                default:
                    return;
            }
            $timeV.val($('#seleccionaEVideoTime').text()).css({
                'background-color': 'white',
                color: '#2c6d2c',
            });
        });

        $('#seleccionaEVIStart')
            .css('color', '#2c6d2c')
            .on('click', (e) => {
                e.preventDefault();
                $exeDevice.timeVIFocus = true;
                $('#seleccionaEVIStart').css('color', '#2c6d2c');
                $('#seleccionaEVIEnd').css('color', '#000000');
            });

        $('#seleccionaEVIEnd').on('click', (e) => {
            e.preventDefault();
            $exeDevice.timeVIFocus = false;
            $('#seleccionaEVIEnd').css('color', '#2c6d2c');
            $('#seleccionaEVIStart').css('color', '#000000');
        });

        $('#seleccionaEVITime').on('click', (e) => {
            e.preventDefault();
            const $timeV = $exeDevice.timeVIFocus
                ? $('#seleccionaEVIStart')
                : $('#seleccionaEVIEnd');
            $timeV.val($('#seleccionaEVITime').text());
        });

        $seleccionaEShowSolution.on('change', function () {
            const marcado = $(this).is(':checked');
            $seleccionaETimeShowSolution.prop('disabled', !marcado);
        });

        $('.SLCNE-ESolution').on('change', function () {
            const marcado = $(this).is(':checked'),
                value = $(this).val();
            $exeDevice.clickSolution(marcado, value);
        });

        $('#seleccionaECustomScore').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#seleccionaEScoreQuestionDiv')
                .toggleClass('d-none', !marcado)
                .toggleClass('d-flex', marcado);
        });

        $('#seleccionaEURLImage').on('change', function () {
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $(this).val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (selectedFile.startsWith('files') && !validExt.includes(ext)) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: jpg, jpeg, gif, png, svg, webp`
                );
                return false;
            }
            const url = selectedFile.trim(),
                alt = $('#seleccionaEAlt').val(),
                x = parseFloat($('#seleccionaEXImage').val()),
                y = parseFloat($('#seleccionaEYImage').val());
            $exeDevice.showImage(url, x, y, alt);
        });

        $('#seleccionaEPlayImage').on('click', (e) => {
            e.preventDefault();
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $('#seleccionaEURLImage').val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (selectedFile.startsWith('files') && !validExt.includes(ext)) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: jpg, jpeg, gif, png, svg, webp`
                );
                return false;
            }
            const url = selectedFile.trim(),
                alt = $('#seleccionaEAlt').val(),
                x = parseFloat($('#seleccionaEXImage').val()),
                y = parseFloat($('#seleccionaEYImage').val());
            $exeDevice.showImage(url, x, y, alt);
        });

        $('#seleccionaEImage').on('click', function (e) {
            $exeDevice.clickImage(this, e.pageX, e.pageY);
        });

        $('#seleccionaEVideoIntroPlay').on('click', (e) => {
            e.preventDefault();
            $exeDevice.playVideoIntro1();
        });

        $('#seleccionaEVIPlayI').on('click', (e) => {
            e.preventDefault();
            $exeDevice.playVideoIntro2();
        });

        $('#seleccionaEVIClose').on('click', (e) => {
            e.preventDefault();
            $('#seleccionaEVideoIntro').val($('#seleccionaEVIURL').val());
            $('#seleccionaEVIDiv').hide();
            $('#seleccionaENumQuestionDiv').show();
            $exeDevice.stopVideoIntro();
        });

        $('#seleccionaECursor').on('click', () => {
            $('#seleccionaECursor').hide();
            $('#seleccionaEXImage, #seleccionaEYImage').val(0);
        });

        $('#seleccionaEPlayAudio').on('click', (e) => {
            e.preventDefault();
            const selectedFile = $('#seleccionaEURLAudio').val().trim();
            if (selectedFile.length > 4) {
                $exeDevice.stopSound();
                $exeDevice.playSound(selectedFile);
            }
        });

        $('#seleccionaEURLAudio').on('change', function () {
            const selectedFile = $(this).val().trim();
            if (selectedFile.length === 0) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: mp3, ogg, wav`
                );
            } else if (selectedFile.length > 4) {
                $exeDevice.stopSound();
                $exeDevice.playSound(selectedFile);
            }
        });

        $('#seleccionaEHasFeedBack').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#seleccionaEFeedbackP').slideToggle(marcado);
            $('#seleccionaEPercentajeFB').prop('disabled', !marcado);
        });

        $quickMultipleQEIdeviceForm.on(
            'click',
            'input.SLCNE-TypeGame',
            function () {
                const gm = parseInt($(this).val(), 10),
                    fb = $('#seleccionaEHasFeedBack').is(':checked'),
                    ul = $seleccionaEUseLives.is(':checked');
                $exeDevice.updateGameMode(gm, fb, ul);
            }
        );

        $('.SLCNE-TypeOrder').on('click', function () {
            const type = parseInt($(this).val(), 10),
                messages = $('#seleccionaECustomMessages').is(':checked'),
                customS = $('#seleccionaECustomScore').is(':checked');
            $exeDevice.showSelectOrder(type, messages, customS);
        });

        $('#seleccionaECustomMessages').on('change', function () {
            const messages = $(this).is(':checked'),
                type = parseInt(
                    $('input[name=slcgameorder]:checked').val(),
                    10
                ),
                customS = $('#seleccionaECustomScore').is(':checked');
            $exeDevice.showSelectOrder(type, messages, customS);
        });

        $('#seleccionaEGameModeHelpLnk').on('click', function () {
            $('#seleccionaEGameModeHelp').toggle();
            return false;
        });

        $('#seleccionaEOrderHelpLnk').on('click', function () {
            $('#seleccionaEOrderHelp').toggle();
            return false;
        });

        $seleccionaEPercentajeQuestions
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 3);
                this.value = v;
                if (this.value > 0 && this.value <= 100) {
                    $exeDevice.updateQuestionsNumber();
                }
            })
            .on('click', function () {
                $exeDevice.updateQuestionsNumber();
            })
            .on('focusout', function () {
                let val = parseInt(this.value.trim() || 100, 10);
                val = Math.max(1, Math.min(val, 100));
                this.value = val;
                $exeDevice.updateQuestionsNumber();
            });

        $seleccionaENumberQuestion.on('keyup', function (e) {
            if (e.keyCode === 13) {
                const num = parseInt($(this).val(), 10);
                if (!isNaN(num) && num > 0) {
                    if ($exeDevice.validateQuestion()) {
                        $exeDevice.active = Math.min(
                            num - 1,
                            $exeDevice.selectsGame.length - 1
                        );
                        $exeDevice.showQuestion($exeDevice.active);
                    } else {
                        $(this).val($exeDevice.active + 1);
                    }
                } else {
                    $(this).val($exeDevice.active + 1);
                }
            }
        });

        $('#seleccionaEEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#seleccionaEEvaluationID').prop('disabled', !marcado);
        });

        $('#seleccionaEEvaluationHelpLnk').on('click', function () {
            $('#seleccionaEEvaluationHelp').toggle();
            return false;
        });

        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();
        $exeDevicesEdition.iDevice.gamification.share.addEvents(
            3,
            $exeDevice.insertQuestions
        );

        //eXe 3.0 Dismissible messages
        $('.exe-block-dismissible .exe-block-close').on('click', function () {
            $(this).parent().fadeOut();
            return false;
        });
    },

    showSelectOrder: function (type, messages, custonmScore) {
        if (type == 2 || messages) {
            $('.SLCNE-EOrders').slideDown();
        } else {
            $('.SLCNE-EOrders').slideUp();
        }

        $('#seleccionaECustomMessages').prop('disabled', type == 2);
        $('#seleccionaEPercentajeQuestionsValue').prop('disabled', type == 2);

        if (type == 2) {
            $('#seleccionaGotoCorrect').show();
            $('#seleccionaGotoIncorrect').show();
            $('label[for="seleccionaGotoCorrect"]').show();
            $('label[for="seleccionaGotoIncorrect"]').show();
        } else {
            $('#seleccionaGotoCorrect').hide();
            $('#seleccionaGotoIncorrect').hide();
            $('label[for="seleccionaGotoCorrect"]').hide();
            $('label[for="seleccionaGotoIncorrect"]').hide();
        }

        $('#seleccionaEScoreQuestionDiv')
            .addClass('d-none')
            .removeClass('d-flex');

        if (type == 2 || custonmScore) {
            $('#seleccionaEScoreQuestionDiv')
                .addClass('d-flex')
                .removeClass('d-none');
        }
    },

    clickSolution: function (checked, value) {
        let solutions = $('#selecionaESolutionSelect').text();
        if (checked) {
            if (solutions.indexOf(value) == -1) {
                solutions += value;
            }
        } else {
            solutions = solutions.split(value).join('');
        }
        $('#selecionaESolutionSelect').text(solutions);
    },

    clickImage: function (img, epx, epy) {
        const $cursor = $('#seleccionaECursor'),
            $x = $('#seleccionaEXImage'),
            $y = $('#seleccionaEYImage'),
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
            'z-index': 300,
        });
        $cursor.show();
    },

    placeImageWindows: function (image, naturalWidth, naturalHeight) {
        let wDiv =
                $(image).parent().width() > 0 ? $(image).parent().width() : 1,
            hDiv =
                $(image).parent().height() > 0 ? $(image).parent().height() : 1,
            varW = naturalWidth / wDiv,
            varH = naturalHeight / hDiv,
            wImage = wDiv,
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

    validateScoreQuestion: function (text) {
        const isValid =
            text.length > 0 &&
            text !== '.' &&
            text !== ',' &&
            /^-?\d*[.,]?\d*$/.test(text);
        return isValid;
    },

    importMoodle(xmlString) {
        const xmlDoc = $.parseXML(xmlString),
            $xml = $(xmlDoc);
        if ($xml.find('GLOSSARY').length > 0) {
            $exeDevice.importGlosary(xmlString);
        } else if ($xml.find('quiz').length > 0) {
            $exeDevice.importCuestionaryXML(xmlString);
        } else {
            eXe.app.alert(_('Sorry, wrong file format'));
        }
    },

    importGame: function (content, filetype) {
        const game =
            $exeDevices.iDevice.gamification.helpers.isJsonString(content);

        if (content && content.includes('\u0000')) {
            $exeDevice.showMessage(_('Sorry, wrong file format'));
            return;
        } else if (!game && content) {
            if (filetype.match('text/plain')) {
                $exeDevice.importText(content);
            } else if (
                filetype.match('application/xml') ||
                filetype.match('text/xml')
            ) {
                $exeDevice.importMoodle(content);
            } else {
                eXe.app.alert(_('Sorry, wrong file format'));
            }
            return;
        } else if (!game || typeof game.typeGame === 'undefined') {
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
            return;
        } else if (game.typeGame === 'Selecciona') {
            game.id = $exeDevice.getIdeviceID();
            $exeDevice.active = 0;
            $exeDevice.updateFieldGame(game);
            const instructions = game.instructionsExe || game.instructions,
                tAfter = game.textAfter || '',
                textFeedBack = game.textFeedBack || '';
            tinyMCE
                .get('eXeGameInstructions')
                .setContent(unescape(instructions));
            tinyMCE.get('eXeIdeviceTextAfter').setContent(unescape(tAfter));
            tinyMCE
                .get('seleccionaEFeedBackEditor')
                .setContent(unescape(textFeedBack));
        } else if (game.typeGame === 'Oca') {
            $exeDevice.selectsGame = $exeDevice.importSelecciona(game);
        } else if (game.typeGame === 'QuExt') {
            $exeDevice.selectsGame = $exeDevice.importQuExt(game);
        } else if (game.typeGame === 'Rosco' || game.typeGame === 'Adivina') {
            $exeDevice.selectsGame = $exeDevice.importRosco(game);
        } else {
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
            return;
        }

        $exeDevice.active = 0;
        $exeDevice.showQuestion($exeDevice.active);
        $exeDevice.deleteEmptyQuestion();
        $exeDevice.updateQuestionsNumber();
        $exeDevice.updateSelectOrder();
        //$('.exe-form-tabs li:first-child a').click();
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

        const questions = quiz.find('question'),
            questionsJson = [];
        for (let i = 0; i < questions.length; i++) {
            const question = questions[i],
                type = $(question).attr('type');

            if (
                ![
                    'multichoice',
                    'truefalse',
                    'numerical',
                    'shortanswer',
                ].includes(type)
            ) {
                continue;
            }

            const typeSelect = type === 'shortanswer' ? 2 : 0,
                questionText = $(question).find('questiontext').first().text(),
                answers = $(question).find('answer');
            let options = [],
                solution = '',
                solutionQuestion = '';

            if (typeSelect === 0) {
                for (let j = 0; j < answers.length; j++) {
                    const answer = answers[j],
                        answerHtml = $exeDevice.removeTags(
                            $(answer).find('text').eq(0).text().trim()
                        ),
                        answerText = answerHtml.split('\n')[0].trim();
                    options.push(answerText);
                    if (parseFloat($(answer).attr('fraction')) > 0) {
                        solution += String.fromCharCode(65 + j);
                    }
                }
            } else if (typeSelect === 2) {
                let maxFraction = -1;
                for (let j = 0; j < answers.length; j++) {
                    const answer = answers[j],
                        answerHtml = $(answer).find('text').eq(0).text().trim(),
                        answerText = answerHtml.split('\n')[0].trim(),
                        currentFraction = parseFloat(
                            $(answer).attr('fraction')
                        );
                    if (currentFraction > maxFraction) {
                        maxFraction = currentFraction;
                        solutionQuestion = answerText;
                    }
                }
            }

            questionsJson.push({
                typeSelect,
                question: $exeDevice.removeTags(questionText.trim()),
                options,
                solution,
                solutionQuestion,
            });
        }

        let questionsj = [];
        questionsJson.forEach((question) => {
            const p = $exeDevice.getCuestionDefault();
            p.typeSelect = question.typeSelect;
            if (p.typeSelect === 0) {
                p.quextion = question.question;
                p.options[0] = question.options[0] || '';
                p.options[1] = question.options[1] || '';
                p.options[2] = question.options[2] || '';
                p.options[3] = question.options[3] || '';
                p.solution = question.solution;
                p.numberOptions = question.options.length;
                if (p.numberOptions === 2) {
                    p.options[0] =
                        p.options[0] === 'true' ? _('True') : p.options[0];
                    p.options[0] =
                        p.options[0] === 'false' ? _('False') : p.options[0];
                    p.options[1] =
                        p.options[1] === 'true' ? _('True') : p.options[1];
                    p.options[1] =
                        p.options[1] === 'false' ? _('False') : p.options[1];
                }
                if (question.question && question.options.length > 1) {
                    questionsj.push(p);
                }
            } else if (p.typeSelect === 2) {
                p.quextion = question.question;
                p.solutionQuestion = question.solutionQuestion;
                p.percentageShow = 35;
                if (question.question && question.solutionQuestion) {
                    questionsj.push(p);
                }
            }
        });

        $exeDevice.addQuestions(questionsj);
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

        const questionsJson = [];
        $entries.find('ENTRY').each(function () {
            const $this = $(this),
                concept = $this.find('CONCEPT').text(),
                definition = $this
                    .find('DEFINITION')
                    .text()
                    .replace(/<[^>]*>/g, '');
            if (concept && definition) {
                questionsJson.push({
                    solution: concept,
                    question: definition,
                });
            }
        });

        let questionsj = [];
        questionsJson.forEach((question) => {
            const p = $exeDevice.getCuestionDefault();
            p.typeSelect = 2;
            p.quextion = question.question;
            p.solutionQuestion = question.solution;
            p.percentageShow = 35;
            if (p.quextion.length > 0 && p.solutionQuestion.length > 0) {
                questionsj.push(p);
            }
        });

        $exeDevice.addQuestions(questionsj);
    },

    importText: function (content) {
        const lines = content.split('\n');
        $exeDevice.insertQuestions(lines);
    },

    insertQuestions: function (lines) {
        const lineFormat =
                /^([0-3]|[ABCD]{0,4})#([^#]+)#([^#]+)#([^#]*)(#([^#]*))?(#([^#]*))?$/i,
            lineFormat1 = /^([^#]+)#([^#]+)(#([^#]+))?(#([^#]+))?$/;
        let questions = [];

        lines.forEach((line) => {
            const p = $exeDevice.getCuestionDefault();
            if (lineFormat.test(line)) {
                const linarray = line.trim().split('#'),
                    solution = linarray[0];
                let solutionChar = solution;
                if (!isNaN(solution)) {
                    const index = parseInt(solution, 10),
                        letters = 'ABCD';
                    if (index >= 0 && index < letters.length) {
                        solutionChar = letters.charAt(index);
                    }
                }
                p.solution = solutionChar;
                p.quextion = linarray[1];
                p.options[0] = linarray[2] || '';
                p.options[1] = linarray[3] || '';
                p.options[2] = linarray[4] || '';
                p.options[3] = linarray[5] || '';
                p.numberOptions = linarray.length - 2;
                questions.push(p);
            } else if (lineFormat1.test(line)) {
                const linarray1 = line.trim().split('#');
                p.typeSelect = 2;
                p.solutionQuestion = linarray1[0];
                p.quextion = linarray1[1];
                p.percentageShow = 35;
                if (p.quextion && p.solutionQuestion) {
                    questions.push(p);
                }
            }
        });

        $exeDevice.addQuestions(questions);
    },

    addQuestions: function (questions) {
        if (!questions || questions.length == 0) {
            eXe.app.alert(
                _('Sorry, there are no questions for this type of activity.')
            );
            return;
        }
        for (let i = 0; i < questions.length; i++) {
            $exeDevice.selectsGame.push(questions[i]);
        }
        $exeDevice.active = 0;
        $exeDevice.showQuestion($exeDevice.active);
        $exeDevice.deleteEmptyQuestion();
        $exeDevice.updateQuestionsNumber();
        //$('.exe-form-tabs li:first-child a').click();
    },

    importQuExt: function (data) {
        data.questionsGame.forEach((cuestion) => {
            const p = $exeDevice.getCuestionDefault(),
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
            p.quextion = cuestion.quextion;
            p.options = [...cuestion.options];

            let numOpt = 0;
            for (let j = 0; j < p.options.length; j++) {
                if (p.options[j].trim().length === 0) {
                    p.numberOptions = numOpt;
                    break;
                }
                numOpt++;
            }

            if (p.type === 3) {
                p.eText = unescape(p.eText);
            }

            p.audio = cuestion.audio || '';
            p.hit = cuestion.hit === undefined ? -1 : cuestion.hit;
            p.error = cuestion.error === undefined ? -1 : cuestion.error;
            p.msgHit = cuestion.msgHit || '';
            p.msgError = cuestion.msgError || '';
            p.solution = solution.charAt(cuestion.solution);
            p.silentVideo = cuestion.silentVideo;
            p.tSilentVideo = cuestion.tSilentVideo;
            p.solutionQuestion = '';
            p.percentageShow = 35;
            $exeDevice.selectsGame.push(p);
        });
        return $exeDevice.selectsGame;
    },

    deleteEmptyQuestion: function () {
        if ($exeDevice.selectsGame.length > 1) {
            const quextion = $('#seleccionaEQuestion').val().trim(),
                typeSelect = parseInt(
                    $('input[name=slctypeselect]:checked').val(),
                    10
                ),
                solutionQuestion =
                    typeSelect === 2 ? $('#seleccionaESolutionWord').val() : '';
            let shouldRemove = false;

            if (typeSelect === 2) {
                const definition = $('#seleccionaEDefinitionWord').val().trim();
                if (definition.length === 0 && solutionQuestion.length === 0) {
                    shouldRemove = true;
                }
            } else {
                let empty = true;
                $('.SLCNE-EAnwersOptions').each(function () {
                    if ($(this).val().trim().length > 0) {
                        empty = false;
                    }
                });
                if (quextion.length === 0 && empty) {
                    shouldRemove = true;
                }
            }

            if (shouldRemove) {
                $exeDevice.removeQuestion();
            }
        }
    },

    importselecciona: function (data) {
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
            p.hit = typeof cuestion.hit == 'undefined' ? -1 : cuestion.hit;
            p.error =
                typeof cuestion.error == 'undefined' ? -1 : cuestion.error;
            p.msgHit =
                typeof cuestion.msgHit == 'undefined' ? '' : cuestion.msgHit;
            p.msgError =
                typeof cuestion.msgError == 'undefined'
                    ? ''
                    : cuestion.msgError;
            p.solution = '';
            p.silentVideo = 0;
            p.tSilentVideo = 0;
            p.solutionQuestion = cuestion.word;
            p.percentageShow = cuestion.percentageShow || data.percentageShow;
            $exeDevice.selectsGame.push(p);
        }
        return $exeDevice.selectsGame;
    },

    importRosco: function (data) {
        for (let i = 0; i < data.wordsGame.length; i++) {
            const p = $exeDevice.getCuestionDefault();
            const cuestion = data.wordsGame[i];
            const msc = $exeDevice.msgs.msgContaint.replace(
                '%1',
                cuestion.letter
            );
            const mss = $exeDevice.msgs.msgStartWith.replace(
                '%1',
                cuestion.letter
            );
            const start = cuestion.type == 1 ? msc : mss;
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
            p.hit = typeof cuestion.hit == 'undefined' ? -1 : cuestion.hit;
            p.error =
                typeof cuestion.error == 'undefined' ? -1 : cuestion.error;
            p.msgHit =
                typeof cuestion.msgHit == 'undefined' ? '' : cuestion.msgHit;
            p.msgError =
                typeof cuestion.msgError == 'undefined'
                    ? ''
                    : cuestion.msgError;
            p.solution = '';
            p.silentVideo = 0;
            p.tSilentVideo = 0;
            p.solutionQuestion = cuestion.word;
            p.percentageShow = cuestion.percentageShow || data.percentageShow;
            if (p.solutionQuestion.trim().length > 0) {
                $exeDevice.selectsGame.push(p);
            }
        }
        return $exeDevice.selectsGame;
    },

    getIndexTime: function (tm) {
        const tms = [15, 30, 60, 180, 300, 600, 900];
        let itm = tms.indexOf(tm);
        itm = itm < 0 ? 1 : itm;
        return itm;
    },
};
