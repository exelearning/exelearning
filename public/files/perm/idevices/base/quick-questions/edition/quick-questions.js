/* eslint-disable no-undef */
/**
 * QuExt Activity iDevice (edition code)
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno, Francisco Javier Pulido
 * Testers: Ricardo Málaga Floriano, Francisco Muñoz de la Peña
 * Translator: Antonio Juan Delgado García
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    // i18n
    idevicePath: '',
    msgs: {},
    classIdevice: 'quick-questions',
    active: 0,
    questionsGame: [],
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
    version: 2,
    isVideoType: false,
    isVideoIntro: 0,
    localPlayer: null,
    localPlayerIntro: null,
    id: false,
    checkAltImage: true,
    accesibilityIsOk: true,
    i18n: {
        name: _('Quick questions'),
    },
    ci18n: {
        msgStartGame: c_('Click here to start'),
        msgSubmit: c_('Submit'),
        msgClue: c_('Cool! The clue is:'),
        msgNewGame: c_('Click here for a new game'),
        msgCodeAccess: c_('Access code'),
        msgInformationLooking: c_('Cool! The information you were looking for'),
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
        msgSuccesses: c_('Right! | Excellent! | Great! | Very good! | Perfect!'),
        msgFailures: c_('It was not that! | Incorrect! | Not correct! | Sorry! | Error!'),
        msgScoreScorm: c_("The score can't be saved because this page is not part of a SCORM package."),
        msgQuestion: c_('Question'),
        msgOnlySaveScore: c_('You can only save the score once!'),
        msgOnlySave: c_('You can only save once'),
        msgInformation: c_('Information'),
        msgAuthor: c_('Authorship'),
        msgOnlySaveAuto: c_('Your score will be saved after each question. You can only play once.'),
        msgSaveAuto: c_('Your score will be automatically saved after each question.'),
        msgYouScore: c_('Your score'),
        msgSeveralScore: c_('You can save the score as many times as you want'),
        msgYouLastScore: c_('The last score saved is'),
        msgActityComply: c_('You have already done this activity.'),
        msgPlaySeveralTimes: c_('You can do this activity as many times as you want'),
        msgTryAgain: c_('You need at least %s&percnt; of correct answers to get the information. Please try again.'),
        msgVideoIntro: c_('Video Intro'),
        msgClose: c_('Close'),
        msgOption: c_('Option'),
        msgUseFulInformation: c_('and information that will be very useful'),
        msgLoading: c_('Loading. Please wait...'),
        msgPoints: c_('points'),
        msgAudio: c_('Audio'),
        msgEndGameScore: c_('Please start playing first...'),
        msgUncompletedActivity: c_('Incomplete activity'),
        msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
        msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
        msgTypeGame: c_('Quick questions'),
    },
    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.ci18n.msgTryAgain = this.ci18n.msgTryAgain.replace(
            '&percnt;',
            '%',
        );

        this.setMessagesInfo();
        this.createForm();
    },

    enableForm: function () {
        $exeDevice.initQuestions();

        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
    },

    setMessagesInfo: function () {
        const msgs = this.msgs;
        msgs.msgEProvideDefinition = _(
            'Please provide the word definition or the valid URL of an image',
        );
        msgs.msgESelectFile = _(
            'The selected file does not contain a valid game',
        );
        msgs.msgEURLValid = _(
            'You must upload or indicate the valid URL of an image',
        );
        msgs.msgEProvideWord = _('Please provide one word or phrase');
        msgs.msgEOneQuestion = _('Please provide at least one question');
        msgs.msgEUnavailableVideo = _('This video is not currently available');
        msgs.msgECompleteQuestion = _('You have to complete the question');
        msgs.msgECompleteAllOptions = _(
            'You have to complete all the selected options',
        );
        msgs.msgESelectSolution = _('Choose the right answer');
        msgs.msgECompleteURLYoutube = _('Please type or paste a valid URL.');
        msgs.msgEStartEndVideo = _(
            'You have to indicate the start and the end of the video that you want to show',
        );
        msgs.msgEStartEndIncorrect = _(
            'The video end value must be higher than the start one',
        );
        msgs.msgWriteText = _('You have to type a text in the editor');
        msgs.msgSilentPoint = _(
            'The silence time is wrong. Check the video duration.',
        );
        msgs.msgTimeFormat = _('Please check the time format: hh:mm:ss');
        msgs.msgProvideFB = _('Message to display when passing the game');
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.',
        );
        msgs.msgTitleAltImageWarning = _('Accessibility warning');
        msgs.msgAltImageWarning = _(
            'Are you sure you want to continue without including an image description? Without it the image may not be accessible to some users with disabilities, or to those using a text browser, or browsing the Web with images turned off.',
        );
        msgs.msgIDLenght = _(
            'The report identifier must have at least 5 characters',
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
        $exeDevice.player = new YT.Player('quextEVideo', {
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
        $exeDevice.playerIntro = new YT.Player('quextEVI', {
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

    clockVideo: {
        start: function (type) {
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
                } else if (this.type === 'localintro') {
                    $exeDevice.updateTimerDisplayVILocal();
                } else if (this.type === 'remoteintro') {
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

    clickPlay: function () {
        const urlvideo = $('#quextEURLYoutube');
        if (urlvideo.length === 0 || urlvideo.val().trim().length < 3) return;
        if (
            $exeDevices.iDevice.gamification.media.getIDYoutube(
                $('#quextEURLYoutube').val().trim(),
            ) ||
            $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                $('#quextEURLYoutube').val().trim(),
            )
        ) {
            $exeDevice.showVideoQuestion();
        }
    },

    playVideoQuestion: function () {
        const urlvideo = $('#quextEURLYoutube').val().trim();
        if (!urlvideo) return;
        if (
            $exeDevices.iDevice.gamification.media.getIDYoutube(urlvideo.trim())
        ) {
            $exeDevice.showVideoQuestion();
        } else if (
            $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                urlvideo.trim(),
            )
        ) {
            $exeDevice.showVideoQuestion();
        } else {
            $exeDevice.showMessage($exeDevice.msgs.msgECompleteURLYoutube);
        }
    },

    onPlayerReady: function () {
        if ($exeDevice.isVideoType) {
            $exeDevice.showVideoQuestion();
        }
    },

    updateTimerDisplayVILocal: function () {
        if ($exeDevice.localPlayerIntro) {
            const currentTime = $exeDevice.localPlayerIntro.currentTime;
            if (currentTime) {
                const time =
                    $exeDevices.iDevice.gamification.helpers.secondsToHour(
                        Math.floor(currentTime),
                    );
                $('#quextEVITime').text(time);
                if (
                    Math.ceil(currentTime) === $exeDevice.pointEndIntro ||
                    Math.ceil(currentTime) === $exeDevice.durationVideo
                ) {
                    $exeDevice.localPlayerIntro.pause();
                    $exeDevice.pointEndIntro = 100000;
                }
            }
        }
    },

    updateTimerDisplayLocal: function () {
        if ($exeDevice.localPlayer) {
            const currentTime = $exeDevice.localPlayer.currentTime;
            if (currentTime) {
                const time =
                    $exeDevices.iDevice.gamification.helpers.secondsToHour(
                        Math.floor(currentTime),
                    );
                $('#quextEVideoTime').text(time);
                $exeDevice.updateSoundVideoLocal();
                if (
                    Math.ceil(currentTime) === $exeDevice.pointEnd ||
                    Math.ceil(currentTime) === $exeDevice.durationVideo
                ) {
                    $exeDevice.localPlayer.pause();
                    $exeDevice.pointEnd = 100000;
                }
            }
        }
    },

    updateTimerDisplay: function () {
        if (
            $exeDevice.player &&
            typeof $exeDevice.player.getCurrentTime === 'function'
        ) {
            const time = $exeDevices.iDevice.gamification.helpers.secondsToHour(
                $exeDevice.player.getCurrentTime(),
            );
            $('#quextEVideoTime').text(time);
            $exeDevice.updateSoundVideo();
        }
    },

    updateTimerVIDisplay: function () {
        if (
            $exeDevice.playerIntro &&
            typeof $exeDevice.playerIntro.getCurrentTime === 'function'
        ) {
            const time = $exeDevices.iDevice.gamification.helpers.secondsToHour(
                $exeDevice.playerIntro.getCurrentTime(),
            );
            $('#quextEVITime').text(time);
        }
    },

    updateSoundVideo: function () {
        if (
            $exeDevice.activeSilent &&
            $exeDevice.player &&
            typeof $exeDevice.player.getCurrentTime === 'function'
        ) {
            const time = Math.round($exeDevice.player.getCurrentTime());
            if (time === $exeDevice.silentVideo) {
                $exeDevice.player.mute();
            } else if (time === $exeDevice.endSilent) {
                $exeDevice.player.unMute();
            }
        }
    },

    updateSoundVideoLocal: function () {
        if ($exeDevice.activeSilent) {
            if ($exeDevice.localPlayer) {
                if ($exeDevice.localPlayer.currentTime) {
                    const time = Math.round($exeDevice.localPlayer.currentTime);
                    if (time === $exeDevice.silentVideo) {
                        $exeDevice.localPlayer.muted = true;
                    } else if (time === $exeDevice.endSilent) {
                        $exeDevice.localPlayer.muted = false;
                    }
                }
            }
        }
    },

    updateProgressBar: function () {
        $('#progress-bar').val(
            (player.getCurrentTime() / player.getDuration()) * 100,
        );
    },

    onPlayerError: function () {
        // $exeDevice.showMessage("El video no está disponible");
    },

    startVideo: function (id, start, end, type) {
        const mstart = start < 1 ? 0.1 : start;
        if (type > 0) {
            if ($exeDevice.localPlayer) {
                $exeDevice.pointEnd = end;
                $exeDevice.localPlayer.src = id;
                $exeDevice.localPlayer.currentTime = parseFloat(start);
                $exeDevice.localPlayer.play();
            }
            $('#quextEVideoTime').show();
            $exeDevice.clockVideo.stop();
            $exeDevice.clockVideo.start('local');
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
            $exeDevice.clockVideo.stop();
            $exeDevice.clockVideo.start('remote');
        }
    },

    startVideoIntro: function (id, start, end, type) {
        const mstart = start < 1 ? 0.1 : start;
        $('#quextEVI').hide();
        $('#quextEVILocal').hide();
        if (type > 0) {
            if ($exeDevice.localPlayerIntro) {
                $exeDevice.pointEndIntro = end;
                $exeDevice.localPlayerIntro.src = id;
                $exeDevice.localPlayerIntro.currentTime = parseFloat(start);
                $exeDevice.localPlayerIntro.play();
            }
            $exeDevice.clockVideo.stop();
            $exeDevice.clockVideo.start('localintro');
            $('#quextEVILocal').show();
            return;
        }
        if ($exeDevice.playerIntro) {
            if (typeof $exeDevice.playerIntro.loadVideoById === 'function') {
                $exeDevice.playerIntro.loadVideoById({
                    videoId: id,
                    startSeconds: mstart,
                    endSeconds: end,
                });
            }
            $exeDevice.clockVideo.stop();
            $exeDevice.clockVideo.start('remoteintro');
            $('#quextEVI').show();
        }
    },

    stopVideoIntro: function () {
        $exeDevice.clockVideo.stop();
        if ($exeDevice.localPlayerIntro) {
            if (typeof $exeDevice.localPlayerIntro.pause === 'function') {
                $exeDevice.localPlayerIntro.pause();
            }
        }
        if ($exeDevice.playerIntro) {
            if (typeof $exeDevice.playerIntro.pauseVideo === 'function') {
                $exeDevice.playerIntro.pauseVideo();
            }
        }
    },

    stopVideo: function () {
        $exeDevice.clockVideo.stop();
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

    stopSound: function () {
        if (
            $exeDevice.playerAudio &&
            typeof $exeDevice.playerAudio.pause === 'function'
        ) {
            $exeDevice.playerAudio.pause();
        }
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    addQuestion: function () {
        if ($exeDevice.validateQuestion() !== false) {
            $exeDevice.clearQuestion();
            $exeDevice.questionsGame.push($exeDevice.getCuestionDefault());
            $exeDevice.active = $exeDevice.questionsGame.length - 1;
            $exeDevice.typeEdit = -1;
            $('#quextEPaste').hide();
            $('#quextENumQuestions').text($exeDevice.questionsGame.length);
            $('#quextENumberQuestion').val($exeDevice.questionsGame.length);
            $exeDevice.updateQuestionsNumber();
        }
    },

    removeQuestion: function () {
        if ($exeDevice.questionsGame.length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
            return;
        }
        $exeDevice.questionsGame.splice($exeDevice.active, 1);
        if ($exeDevice.active >= $exeDevice.questionsGame.length - 1) {
            $exeDevice.active = $exeDevice.questionsGame.length - 1;
        }
        $exeDevice.showQuestion($exeDevice.active);
        $exeDevice.typeEdit = -1;
        $('#quextEPaste').hide();
        $('#quextENumQuestions').text($exeDevice.questionsGame.length);
        $('#quextENumberQuestion').val($exeDevice.active + 1);
        $exeDevice.updateQuestionsNumber();
    },

    copyQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.typeEdit = 0;
            $exeDevice.clipBoard = JSON.parse(
                JSON.stringify($exeDevice.questionsGame[$exeDevice.active]),
            );
            $('#quextEPaste').show();
        }
    },

    cutQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.numberCutCuestion = $exeDevice.active;
            $exeDevice.typeEdit = 1;
            $('#quextEPaste').show();
        }
    },

    pasteQuestion: function () {
        if ($exeDevice.typeEdit === 0) {
            $exeDevice.active++;
            $exeDevice.questionsGame.splice(
                $exeDevice.active,
                0,
                $exeDevice.clipBoard,
            );
            $exeDevice.showQuestion($exeDevice.active);
        } else if ($exeDevice.typeEdit === 1) {
            $('#quextEPaste').hide();
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                $exeDevice.questionsGame,
                $exeDevice.numberCutCuestion,
                $exeDevice.active,
            );
            $exeDevice.showQuestion($exeDevice.active);
            $('#quextENumQuestions').text($exeDevice.questionsGame.length);
            $exeDevice.updateQuestionsNumber();
        }
    },

    nextQuestion: function () {
        if (
            $exeDevice.validateQuestion() &&
            $exeDevice.active < $exeDevice.questionsGame.length - 1
        ) {
            $exeDevice.active++;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    lastQuestion: function () {
        if (
            $exeDevice.validateQuestion() &&
            $exeDevice.active < $exeDevice.questionsGame.length - 1
        ) {
            $exeDevice.active = $exeDevice.questionsGame.length - 1;
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

    updateQuestionsNumber: function () {
        let percentage = parseInt(
            $exeDevice.removeTags($('#quextEPercentajeQuestions').val()),
        );
        if (isNaN(percentage)) return;

        percentage = Math.min(Math.max(percentage, 1), 100);
        const totalQuestions = $exeDevice.questionsGame.length;
        let num = Math.max(Math.round((percentage * totalQuestions) / 100), 1);

        $('#quextENumeroPercentaje').text(`${num}/${totalQuestions}`);
    },

    showQuestion: function (i) {
        let num = i < 0 ? 0 : i;
        num =
            num >= $exeDevice.questionsGame.length
                ? $exeDevice.questionsGame.length - 1
                : num;
        const p = $exeDevice.questionsGame[num];
        let numOptions = 0;

        $('.QXTE-EAnwersOptions').each(function (j) {
            numOptions++;
            if (p.options[j].trim() !== '') {
                p.numOptions = numOptions;
            }
            $(this).val(p.options[j]);
        });

        $exeDevice.stopVideo();
        $exeDevice.changeTypeQuestion(p.type);
        $exeDevice.showOptions(p.numberOptions);
        $('#quextEQuestion').val(p.quextion);
        $('#quextENumQuestions').text($exeDevice.questionsGame.length);

        if (p.type === 1) {
            $('#quextEURLImage').val(p.url);
            $('#quextEXImage').val(p.x);
            $('#quextEYImage').val(p.y);
            $('#quextEAuthor').val(p.author);
            $('#quextEAlt').val(p.alt);
            $exeDevice.showImage(p.url, p.x, p.y, p.alt);
        } else if (p.type === 2) {
            $('#quextECheckSoundVideo').prop('checked', p.soundVideo === 1);
            $('#quextECheckImageVideo').prop('checked', p.imageVideo === 1);
            $('#quextEURLYoutube').val(p.url);
            $('#quextEInitVideo').val(
                $exeDevices.iDevice.gamification.helpers.secondsToHour(
                    p.iVideo,
                ),
            );
            $('#quextEEndVideo').val(
                $exeDevices.iDevice.gamification.helpers.secondsToHour(
                    p.fVideo,
                ),
            );
            $('#quextESilenceVideo').val(
                $exeDevices.iDevice.gamification.helpers.secondsToHour(
                    p.silentVideo,
                ),
            );
            $('#quextETimeSilence').val(p.tSilentVideo);
            $exeDevice.silentVideo = p.silentVideo;
            $exeDevice.tSilentVideo = p.tSilentVideo;
            $exeDevice.activeSilent =
                p.soundVideo === 1 &&
                $exeDevice.tSilentVideo > 0 &&
                p.silentVideo >= p.iVideo &&
                p.iVideo < p.fVideo;

            $exeDevice.endSilent = p.silentVideo + p.tSilentVideo;
            $exeDevice.playVideoQuestion();
        } else if (p.type === 3) {
            tinyMCE.get('quextEText').setContent(unescape(p.eText));
        }

        $('.QXTE-EAnwersOptions').each(function (j) {
            const option = j < p.numOptions ? p.options[j] : '';
            $(this).val(option);
        });

        $exeDevice.stopSound();
        p.audio = p.audio && p.audio !== 'undefined' ? p.audio : '';
        if (p.type !== 2 && p.audio.trim().length > 4)
            $exeDevice.playSound(p.audio.trim());

        $('#quextEURLAudio').val(p.audio);
        $('#quextENumberQuestion').val(i + 1);
        $('#quextEScoreQuestion').val(1);
        if (typeof p.customScore !== 'undefined') {
            $('#quextEScoreQuestion').val(p.customScore);
        }
        $('#quextEMessageKO').val(p.msgError);
        $('#quextEMessageOK').val(p.msgHit);
        $(
            `input.QXTE-Number[name='qxtnumber'][value='${p.numberOptions}']`,
        ).prop('checked', true);
        $(`input.QXTE-Type[name='qxtype'][value='${p.type}']`).prop(
            'checked',
            true,
        );
        $(
            `input.QXTE-ESolution[name='qxsolution'][value='${p.solution}']`,
        ).prop('checked', true);
        $(`input.QXTE-Times[name='qxttime'][value='${p.time}']`).prop(
            'checked',
            true,
        );
    },

    showVideoQuestion: function () {
        const soundVideo = $('#quextECheckSoundVideo').is(':checked') ? 1 : 0,
            imageVideo = $('#quextECheckImageVideo').is(':checked') ? 1 : 0,
            iVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                $('#quextEInitVideo').val(),
            ),
            fVideoInput =
                $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                    $('#quextEEndVideo').val(),
                ),
            url = $('#quextEURLYoutube').val().trim(),
            id = $exeDevices.iDevice.gamification.media.getIDYoutube(url),
            idLocal =
                $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                    url,
                ),
            type = id ? 0 : 1;

        let fVideo = fVideoInput;

        $exeDevice.silentVideo =
            $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                $('#quextESilenceVideo').val().trim(),
            );
        $exeDevice.tSilentVideo = parseInt($('#quextETimeSilence').val());
        $exeDevice.activeSilent =
            soundVideo === 1 &&
            $exeDevice.tSilentVideo > 0 &&
            $exeDevice.silentVideo >= iVideo &&
            iVideo < fVideo;
        $exeDevice.endSilent = $exeDevice.silentVideo + $exeDevice.tSilentVideo;

        if (fVideo <= iVideo) fVideo = 36000;

        $('#quextENoImageVideo').hide();
        $('#quextENoVideo').show();
        $('#quextEVideo').hide();
        $('#quextEVideoLocal').hide();

        if (id || idLocal) {
            if (id) {
                $exeDevice.startVideo(id, iVideo, fVideo, 0);
            } else {
                $exeDevice.startVideo(idLocal, iVideo, fVideo, 1);
            }
            $('#quextENoVideo').hide();

            if (imageVideo === 0) {
                $('#quextENoImageVideo').show();
            } else {
                if (type === 0) {
                    $('#quextEVideo').show();
                } else {
                    $('#quextEVideoLocal').show();
                }
            }

            if (soundVideo === 0) {
                $exeDevice.muteVideo(true);
            } else {
                $exeDevice.muteVideo(false);
            }
        } else {
            $exeDevice.showMessage($exeDevice.msgs.msgEUnavailableVideo);
            $('#quextENoVideo').show();
        }
    },

    showImage: function (url, x, y, alt) {
        const $image = $('#quextEImage'),
            $cursor = $('#quextECursor');
        $image.hide();
        $cursor.hide();
        $image.attr('alt', alt);
        $('#quextENoImage').show();
        url = $exeDevices.iDevice.gamification.media.extractURLGD(url);
        $image
            .prop('src', url)
            .on('load', function () {
                if (
                    !this.complete ||
                    typeof this.naturalWidth === 'undefined' ||
                    this.naturalWidth === 0
                ) {
                    return false;
                } else {
                    const mData = $exeDevice.placeImageWindows(
                        this,
                        this.naturalWidth,
                        this.naturalHeight,
                    );
                    $exeDevice.drawImage(this, mData);
                    $image.show();
                    $('#quextENoImage').hide();
                    $exeDevice.paintMouse(this, $cursor, x, y);
                    return true;
                }
            })
            .on('error', function () {
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
                'z-index': 30,
            });
            $(cursor).show();
        }
    },

    clearQuestion: function () {
        $exeDevice.changeTypeQuestion(0);
        $exeDevice.showOptions(4);
        $exeDevice.showSolution(0);
        $('.QXTE-Type')[0].checked = true;
        $('.QXTE-Times')[0].checked = true;
        $('.QXTE-Number')[2].checked = true;
        $('#quextEURLImage').val('');
        $('#quextEXImage').val('0');
        $('#quextEYImage').val('0');
        $('#quextEAuthor').val('');
        $('#quextEAlt').val('');
        $('#quextEURLYoutube').val('');
        $('#quextEURLAudio').val('');
        $('#quextEInitVideo').val('00:00:00');
        $('#quextEEndVideo').val('00:00:00');
        $('#quextECheckSoundVideo').prop('checked', true);
        $('#quextECheckImageVideo').prop('checked', true);
        tinyMCE.get('quextEText').setContent('');
        $('#quextEQuestion').val('');
        $('.QXTE-EAnwersOptions').each(function () {
            $(this).val('');
        });
        $('#quextEMessageOK').val('');
        $('#quextEMessageKO').val('');
    },

    changeTypeQuestion: function (type) {
        $('#quextETitleAltImage').hide();
        $('#quextEAuthorAlt').hide();
        $('#quextETitleImage').hide();
        $('#quextEInputImage').hide();
        $('#quextETitleVideo').hide();
        $('#quextEInputVideo').hide();
        $('#quextEInputAudio').show();
        $('#quextETitleAudio').show();
        $('#quextEInputOptionsVideo').hide();
        $('#quextInputOptionsImage').hide();
        if (tinyMCE.get('quextEText')) {
            tinyMCE.get('quextEText').hide();
        }
        $('#quextEText').hide();
        $('#quextEVideo').hide();
        $('#quextEVideoLocal').hide();
        $('#quextEImage').hide();
        $('#quextENoImage').hide();
        $('#quextECover').hide();
        $('#quextECursor').hide();
        $('#quextENoImageVideo').hide();
        $('#quextENoVideo').hide();
        switch (type) {
            case 0:
                $('#quextECover').show();
                break;
            case 1:
                $('#quextENoImage').show();
                $('#quextETitleImage').show();
                $('#quextEInputImage').show();
                $('#quextEAuthorAlt').show();
                $('#quextECursor').show();
                $('#quextInputOptionsImage').show();
                $exeDevice.showImage(
                    $('#quextEURLImage').val(),
                    $('#quextEXImage').val(),
                    $('#quextEYImage').val(),
                    $('#quextEAlt').val(),
                    0,
                );
                break;
            case 2:
                $('#quextEImageVideo').show();
                $('#quextETitleVideo').show();
                $('#quextEInputVideo').show();
                $('#quextENoVideo').show();
                $('#quextEVideo').show();
                $('#quextEInputOptionsVideo').show();
                $('#quextEInputAudio').hide();
                $('#quextETitleAudio').hide();
                break;
            case 3:
                $('#quextEText').show();
                if (tinyMCE.get('quextEText')) {
                    tinyMCE.get('quextEText').show();
                }
                break;
            default:
                break;
        }
    },

    showOptions: function (number) {
        $('.QXTE-EOptionDiv').each(function (i) {
            $(this).show();
            if (i >= number) {
                $(this).hide();
                $exeDevice.showSolution(0);
            }
        });
        $('.QXTE-EAnwersOptions').each(function (j) {
            if (j >= number) {
                $(this).val('');
            }
        });
    },

    showSolution: function (solution) {
        $('.QXTE-ESolution')[solution].checked = true;
    },

    createForm: function () {
        let path = $exeDevice.idevicePath,
            html = `
            <div id="gameQEIdeviceForm">
                <p class="exe-block-info exe-block-dismissible" style="position:relative">
                    ${_('Create activities in which students see a video, image or text and they have to choose the right answer.')} <a href="https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe29/quext.html" hreflang="es" target="_blank">${_('Usage Instructions')}</a>
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevices.iDevice.gamification.instructions.getFieldset(c_('Choose the right answer'))}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_('Options')}</a></legend>
                        <div>
                            <p><label for="quextEShowMinimize"><input type="checkbox" id="quextEShowMinimize">${_('Show minimized.')}</label></p>
                            <p>
                                <label for="quextEQuestionsRamdon"><input type="checkbox" id="quextEQuestionsRamdon">${_('Random questions')}</label>
                                <label for="quextEAnswersRamdon" class="QXTE-inlineOption"><input type="checkbox" id="quextEAnswersRamdon">${_('Random options')}</label>
                            </p>
                            <p><label for="quextECustomMessages"><input type="checkbox" id="quextECustomMessages">${_('Custom messages')}.</label></p>
                            <p>
                                <label for="quextEShowSolution"><input type="checkbox" checked id="quextEShowSolution">${_('Show solutions')}.</label>
                                <label for="quextETimeShowSolution">${_('Show solution time (seconds)')} <input type="number" name="quextETimeShowSolution" id="quextETimeShowSolution" value="3" min="1" max="9" /></label>
                            </p>
                            <p><label for="quextECustomScore"><input type="checkbox" id="quextECustomScore">${_('Custom score')}.</label></p>
                            <p>
                                <strong class="GameModeLabel"><a href="#quextEGameModeHelp" id="quextEGameModeHelpLnk" class="GameModeHelpLink" title="${_('Help')}"><img src="${path}quextIEHelp.gif" width="16" height="16" alt="${_('Help')}"/></a>${_('Score')}:</strong>
                                <input class="QXTE-TypeGame" checked="checked" id="quextETypeActivity" type="radio" name="qxtgamemode" value="1" />
                                <label for="quextETypeActivity">${_('From 0 to 10')}</label>
                                <input class="QXTE-TypeGame" id="quextEGameMode" type="radio" name="qxtgamemode" value="0" />
                                <label for="quextEGameMode">${_('Points and lives')}</label>
                                <input class="QXTE-TypeGame" id="quextETypeReto" type="radio" name="qxtgamemode" value="2" />
                                <label for="quextETypeReto">${_('No score')}</label>
                            </p>
                            <div id="quextEGameModeHelp" class="QXTE-TypeGameHelp exe-block-info">
                                <p>
                                    <ul>
                                        <li><strong>${_('From 0 to 10')}: </strong>${_('No lives, 0 to 10 score, right/wrong answers counter... A more educational context.')}</li>
                                        <li><strong>${_('Points and lives')}: </strong>${_('Just like a game: Aim for a high score (thousands of points) and try not to lose your lives.')}</li>
                                        <li><strong>${_('No score')}: </strong>${_('No score and no lives. You have to answer right to get some information (a feedback).')}</li>
                                    </ul>
                                </p>
                            </div>
                            <p>
                                <input type="checkbox" checked id="quextEUseLives"> <label for="quextEUseLives"><label for="quextEHasFeedBack">${_('Use lives')}.</label>
                                <label for="quextENumberLives">${_('Number of lives')}:</label><input type="number" name="quextENumberLives" id="quextENumberLives" value="3" min="1" max="5" />
                            </p>
                            <p>
                                <input type="checkbox" id="quextEHasFeedBack">${_('Feedback')}.</label>
                               <input type="number" name="quextEPercentajeFB" id="quextEPercentajeFB" value="100" min="5" max="100" step="5" disabled /> <label for="quextEPercentajeFB">${_('% right to see the feedback')}</label>
                            </p>
                            <p id="quextEFeedbackP" class="QXTE-EFeedbackP"><textarea id="quextEFeedBackEditor" class="exe-html-editor"></textarea></p>
                            <p class="QXTE-Flex"><label>${_('Video Intro')}:</label><input type="text" id="quextEVideoIntro" /><a href="#" class="QXTE-ButtonLink" id="quextEVideoIntroPlay" title="${_('Play the introduction video')}"><img src="${path}quextIEPlay.png" alt="Play" class="QXTE-EButtonImage" /></a></p>
                            <p><label for="quextEPercentajeQuestions">%${_('Questions')}:</label><input type="number" name="quextEPercentajeQuestions" id="quextEPercentajeQuestions" value="100" min="1" max="100" /><span id="quextENumeroPercentaje">1/1</span></p>
                            <p class="Games-Reportdiv">
                                <strong class="GameModeLabel"><a href="#quextEEvaluationHelp" id="quextEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}"><img src="${path}quextIEHelp.gif" width="16" height="16" alt="${_('Help')}"/></a></strong>
                                <input type="checkbox" id="quextEEvaluation"><label for="quextEEvaluation">${_('Progress report')}.</label>
                                <label for="quextEEvaluationID">${_('Identifier')}:</label><input type="text" id="quextEEvaluationID" disabled/>
                            </p>
                            <div id="quextEEvaluationHelp" class="QXTE-TypeGameHelp exe-block-info">
                                <p>${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}</p>
                            </div>
                        </div>
                    </fieldset>
                    <fieldset class="exe-fieldset">
                        <legend><a href="#">${_('Questions')}</a></legend>
                        <div class="QXTE-EPanel" id="quextEPanel">
                            <div class="QXTE-EOptionsMedia">
                                <div class="QXTE-EOptionsGame">
                                    <p>
                                        <span>${_('Multimedia Type')}:</span>
                                        <span class="QXTE-EInputMedias">
                                            <input class="QXTE-Type" checked="checked" id="quextMediaNormal" type="radio" name="qxtype" value="0" disabled />
                                            <label for="quextMediaNormal">${_('None')}</label>
                                            <input class="QXTE-Type" id="quextMediaImage" type="radio" name="qxtype" value="1" disabled />
                                            <label for="quextMediaImage">${_('Image')}</label>
                                            <input class="QXTE-Type" id="quextMediaVideo" type="radio" name="qxtype" value="2" disabled />
                                            <label for="quextMediaVideo">${_('Video')}</label>
                                            <input class="QXTE-Type" id="quextMediaText" type="radio" name="qxtype" value="3" disabled />
                                            <label for="quextMediaText">${_('Text')}</label>
                                        </span>
                                    </p>
                                    <p>
                                        <span>${_('Options Number')}:</span>
                                        <span class="QXTE-EInputNumbers">
                                            <input class="QXTE-Number" id="numQ2" type="radio" name="qxtnumber" value="2" />
                                            <label for="numQ2">2</label>
                                            <input class="QXTE-Number" id="numQ3" type="radio" name="qxtnumber" value="3" />
                                            <label for="numQ3">3</label>
                                            <input class="QXTE-Number" id="numQ4" type="radio" name="qxtnumber" value="4" checked="checked" />
                                            <label for="numQ4">4</label>
                                        </span>
                                    </p>
                                    <p>
                                        <span>${_('Time per question')}:</span>
                                        <span class="QXTE-EInputTimes">
                                            <input class="QXTE-Times" checked="checked" id="q15s" type="radio" name="qxttime" value="0" />
                                            <label for="q15s">15s</label>
                                            <input class="QXTE-Times" id="q30s" type="radio" name="qxttime" value="1" />
                                            <label for="q30s">30s</label>
                                            <input class="QXTE-Times" id="q1m" type="radio" name="qxttime" value="2" />
                                            <label for="q1m">1m</label>
                                            <input class="QXTE-Times" id="q3m" type="radio" name="qxttime" value="3" />
                                            <label for="q3m">3m</label>
                                            <input class="QXTE-Times" id="q5m" type="radio" name="qxttime" value="4" />
                                            <label for="q5m">5m</label>
                                            <input class="QXTE-Times" id="q10m" type="radio" name="qxttime" value="5" />
                                            <label for="q10m">10m</label>
                                        </span>
                                    </p>
                                    <p id="quextEScoreQuestionDiv" class="QXTE-ScoreQuestionDiv">
                                        <label for="quextEScoreQuestion">${_('Score')}:</label>
                                        <input type="number" name="quextEScoreQuestion" id="quextEScoreQuestion" value="1" min="0" max="100" step="0.05"/>
                                    </p>
                                    <span class="QXTE-ETitleImage" id="quextETitleImage">${_('Image URL')}</span>
                                    <div class="QXTE-Flex QXTE-EInputImage" id="quextEInputImage">
                                        <label class="sr-av" for="quextEURLImage">${_('Image URL')}</label>
                                        <input type="text" class="exe-file-picker QXTE-EURLImage" id="quextEURLImage"/>
                                        <a href="#" id="quextEPlayImage" class="QXTE-ENavigationButton QXTE-EPlayVideo" title="${_('Show')}"><img src="${path}quextIEPlay.png" alt="${_('Show')}" class="QXTE-EButtonImage b-play" /></a>
                                    </div>
                                    <div class="QXTE-EInputOptionsImage" id="quextInputOptionsImage">
                                        <div class="QXTE-ECoord">
                                            <label for="quextEXImage">X:</label>
                                            <input id="quextEXImage" type="text" value="0" />
                                            <label for="quextEXImage">Y:</label>
                                            <input id="quextEYImage" type="text" value="0" />
                                        </div>
                                    </div>
                                    <span class="QXTE-ETitleVideo" id="quextETitleVideo">${_('URL')}</span>
                                    <div class="QXTE-Flex QXTE-EInputVideo" id="quextEInputVideo">
                                        <label class="sr-av" for="quextEURLYoutube">${_('YouTube URL')}</label>
                                        <input id="quextEURLYoutube" type="text" />
                                        <a href="#" id="quextEPlayVideo" class="QXTE-ENavigationButton QXTE-EPlayVideo" title="${_('Play video')}"><img src="${path}quextIEPlay.png" alt="${_('Play video')}" class="QXTE-EButtonImage" /></a>
                                    </div>
                                    <div class="QXTE-EInputOptionsVideo" id="quextEInputOptionsVideo">
                                        <div>
                                            <label for="quextEInitVideo">${_('Start')}:</label>
                                            <input id="quextEInitVideo" type="text" value="00:00:00" maxlength="8" />
                                            <label for="quextEEndVideo">${_('End')}:</label>
                                            <input id="quextEEndVideo" type="text" value="00:00:00" maxlength="8" />
                                            <button class="QXTE-EVideoTime" id="quextEVideoTime" type="button">00:00:00</button>
                                        </div>
                                        <div>
                                            <label for="quextESilenceVideo">${_('Silence')}:</label>
                                            <input id="quextESilenceVideo" type="text" value="00:00:00" required="required" maxlength="8" />
                                            <label for="quextETimeSilence">${_('Time (s)')}:</label>
                                            <input type="number" name="quextETimeSilence" id="quextETimeSilence" value="0" min="0" max="120" />
                                        </div>
                                        <div>
                                            <label for="quextECheckSoundVideo">${_('Audio')}:</label>
                                            <input id="quextECheckSoundVideo" type="checkbox" checked="checked" />
                                            <label for="quextECheckImageVideo">${_('Image')}:</label>
                                            <input id="quextECheckImageVideo" type="checkbox" checked="checked" />
                                        </div>
                                    </div>
                                    <div class="QXTE-EAuthorAlt" id="quextEAuthorAlt">
                                        <div class="QXTE-EInputAuthor" id="quextInputAuthor">
                                            <label for="quextEAuthor">${_('Authorship')}</label>
                                            <input id="quextEAuthor" type="text" />
                                        </div>
                                        <div class="QXTE-EInputAlt" id="quextInputAlt">
                                            <label for="quextEAlt">${_('Alternative text')}</label>
                                            <input id="quextEAlt" type="text" />
                                        </div>
                                    </div>
                                    <span id="quextETitleAudio">${_('Audio')}</span>
                                    <div class="QXTE-EInputAudio" id="quextEInputAudio">
                                        <label class="sr-av" for="quextEURLAudio">${_('URL')}</label>
                                        <input type="text" class="exe-file-picker QXTE-EURLAudio" id="quextEURLAudio"/>
                                        <a href="#" id="quextEPlayAudio" class="QXTE-ENavigationButton QXTE-EPlayVideo" title="${_('Play audio')}"><img src="${path}quextIEPlay.png" alt="${_('Play audio')}" class="QXTE-EButtonImage b-play" /></a>
                                    </div>
                                </div>
                                <div class="QXTE-EMultiMediaOption">
                                    <div class="QXTE-EMultimedia" id="quextEMultimedia">
                                        <textarea id="quextEText"></textarea>
                                        <img class="QXTE-EMedia" src="${path}quextIEImage.png" id="quextEImage" alt="${_('Image')}" />
                                        <img class="QXTE-EMedia" src="${path}quextIEImage.png" id="quextENoImage" alt="${_('No image')}" />
                                        <div class="QXTE-EMedia" id="quextEVideo"></div>
                                        <video class="QXTE-EMedia" id="quextEVideoLocal" preload="auto" controls></video>
                                        <img class="QXTE-EMedia" src="${path}quextIENoImageVideo.png" id="quextENoImageVideo" alt="" />
                                        <img class="QXTE-EMedia" src="${path}quextIENoVideo.png" id="quextENoVideo" alt="" />
                                        <img class="QXTE-ECursor" src="${path}quextIECursor.gif" id="quextECursor" alt="" />
                                        <img class="QXTE-EMedia" src="${path}quextIECoverQuExt.png" id="quextECover" alt="${_('No image')}" />
                                    </div>
                                </div>
                            </div>
                            <div class="QXTE-EContents">
                                <span>${_('Question')}</span>
                                <div class="QXTE-EQuestionDiv">
                                    <label class="sr-av">${_('Question')}:</label>
                                    <input type="text" class="QXTE-EQuestion" id="quextEQuestion">
                                </div>
                                <div class="QXTE-EAnswers">
                                    <div class="QXTE-EOptionDiv">
                                        <label class="sr-av">${_('Solution')} A:</label>
                                        <input type="radio" class="QXTE-ESolution" name="qxsolution" id="quextESolution0" value="0" checked="checked" />
                                        <label class="sr-av">${_('Option')} A:</label>
                                        <input type="text" class="QXTE-EOption0 QXTE-EAnwersOptions" id="quextEOption0">
                                    </div>
                                    <div class="QXTE-EOptionDiv">
                                        <label class="sr-av">${_('Solution')} B:</label>
                                        <input type="radio" class="QXTE-ESolution" name="qxsolution" id="quextESolution1" value="1" />
                                        <label class="sr-av">${_('Option')} B:</label>
                                        <input type="text" class="QXTE-EOption1 QXTE-EAnwersOptions" id="quextEOption1">
                                    </div>
                                    <div class="QXTE-EOptionDiv">
                                        <label class="sr-av">${_('Solution')} C:</label>
                                        <input type="radio" class="QXTE-ESolution" name="qxsolution" id="quextESolution2" value="2" />
                                        <label class="sr-av">${_('Option')} C:</label>
                                        <input type="text" class="QXTE-EOption2 QXTE-EAnwersOptions" id="quextEOption2">
                                    </div>
                                    <div class="QXTE-EOptionDiv">
                                        <label class="sr-av">${_('Solution')} D:</label>
                                        <input type="radio" class="QXTE-ESolution" name="qxsolution" id="quextESolution3" value="3" />
                                        <label class="sr-av">${_('Option')} D:</label>
                                        <input type="text" class="QXTE-EOption3 QXTE-EAnwersOptions" id="quextEOption3">
                                    </div>
                                </div>
                            </div>
                            <div class="QXTE-EOrders" id="quextEOrder">
                                <div class="QXTE-ECustomMessage">
                                    <span class="sr-av">${_('Hit')}</span><span class="QXTE-EHit"></span>
                                    <label for="quextEMessageOK">${_('Message')}:</label>
                                    <input type="text" id="quextEMessageOK">
                                </div>
                                <div class="QXTE-ECustomMessage">
                                    <span class="sr-av">${_('Error')}</span><span class="QXTE-EError"></span>
                                    <label for="quextEMessageKO">${_('Message')}:</label>
                                    <input type="text" id="quextEMessageKO">
                                </div>
                            </div>
                            <div class="QXTE-ENavigationButtons">
                                <a href="#" id="quextEAdd" class="QXTE-ENavigationButton" title="${_('Add question')}"><img src="${path}quextIEAdd.png" alt="${_('Add question')}" class="QXTE-EButtonImage" /></a>
                                <a href="#" id="quextEFirst" class="QXTE-ENavigationButton" title="${_('First question')}"><img src="${path}quextIEFirst.png" alt="${_('First question')}" class="QXTE-EButtonImage" /></a>
                                <a href="#" id="quextEPrevious" class="QXTE-ENavigationButton" title="${_('Previous question')}"><img src="${path}quextIEPrev.png" alt="${_('Previous question')}" class="QXTE-EButtonImage" /></a>
                                <label class="sr-av" for="quextENumberQuestion">${_('Question number:')}:</label><input type="text" class="QXTE-NumberQuestion" id="quextENumberQuestion" value="1"/>
                                <a href="#" id="quextENext" class="QXTE-ENavigationButton" title="${_('Next question')}"><img src="${path}quextIENext.png" alt="${_('Next question')}" class="QXTE-EButtonImage" /></a>
                                <a href="#" id="quextELast" class="QXTE-ENavigationButton" title="${_('Last question')}"><img src="${path}quextIELast.png" alt="${_('Last question')}" class="QXTE-EButtonImage" /></a>
                                <a href="#" id="quextEDelete" class="QXTE-ENavigationButton" title="${_('Delete question')}"><img src="${path}quextIEDelete.png" alt="${_('Delete question')}" class="QXTE-EButtonImage" /></a>
                                <a href="#" id="quextECopy" class="QXTE-ENavigationButton" title="${_('Copy question')}"><img src="${path}quextIECopy.png" alt="${_('Copy question')}" class="QXTE-EButtonImage" /></a>
                                <a href="#" id="quextECut" class="QXTE-ENavigationButton" title="${_('Cut question')}"><img src="${path}quextIECut.png" alt="${_('Cut question')}" class="QXTE-EButtonImage" /></a>
                                <a href="#" id="quextEPaste" class="QXTE-ENavigationButton" title="${_('Paste question')}"><img src="${path}quextIEPaste.png" alt="${_('Paste question')}" class="QXTE-EButtonImage" /></a>
                            </div>
                            <div class="QXTE-EVIDiv" id="quextEVIDiv">
                                <div class="QXTE-EVIV">
                                    <div class="QXTE-EMVI">
                                        <div class="QXTE-EVI" id="quextEVI"></div>
                                        <video class="QXTE-EVI" id="quextEVILocal" preload="auto" controls></video>
                                        <img class="QXTE-ENoVI" src="${path}quextIENoVideo.png" id="quextEVINo" alt="" />
                                    </div>
                                </div>
                                <div class="QXTE-EVIOptions">
                                    <label for="quextEVIURL">${_('URL')}:</label>
                                    <input id="quextEVIURL" type="text" />
                                    <a href="#" id="quextEVIPlayI" class="QXTE-ENavigationButton QXTE-EPlayVideo" title="${_('Play the introduction video')}"><img src="${path}quextIEPlay.png" alt="${_('Play')}" class="QXTE-EButtonImage b-playintro" /></a>
                                    <label for="quextEVIStart">${_('Start')}:</label>
                                    <input id="quextEVIStart" type="text" value="00:00:00" readonly />
                                    <label for="quextEVIEnd">${_('End')}:</label>
                                    <input id="quextEVIEnd" type="text" value="00:00:00" readonly />
                                    <button class="QXTE-EVideoTime" id="quextEVITime" type="button">00:00:00</button>
                                </div>
                                <input type="button" class="QXTE-EVIClose" id="quextEVIClose" value="${_('Close')}" />
                            </div>
                            <div class="QXTE-ENumQuestionDiv" id="quextENumQuestionDiv">
                                <div class="QXTE-ENumQ"><span class="sr-av">${_('Number of questions:')}</span></div>
                                <span class="QXTE-ENumQuestions" id="quextENumQuestions">0</span>
                            </div>
                        </div>
                    </fieldset>
                    ${$exeDevices.iDevice.common.getTextFieldset('after')}
                </div>
                ${$exeDevices.iDevice.gamification.itinerary.getTab()}
                ${$exeDevices.iDevice.gamification.scorm.getTab()}
                ${$exeDevices.iDevice.gamification.common.getLanguageTab(this.ci18n)}
                ${$exeDevices.iDevice.gamification.share.getTab(true, 2, true)}
            </div>
        `;
        this.ideviceBody.innerHTML = html; //eXe 3.0
        $exeDevices.iDevice.tabs.init('gameQEIdeviceForm');
        $exeDevices.iDevice.gamification.scorm.init();
        tinymce.init({
            selector: '#quextEText',
            height: 200,
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
        $('#quextEInputVideo, #quextEInputImage').css('display', 'flex');
        $(
            '#quextMediaNormal, #quextMediaImage, #quextMediaText, #quextMediaVideo',
        ).prop('disabled', false);

        if ($exeDevice.questionsGame.length === 0) {
            const question = $exeDevice.getCuestionDefault();
            $exeDevice.questionsGame.push(question);
            this.changeTypeQuestion(0);
            this.showOptions(4);
            this.showSolution(0);
        }

        this.active = 0;
        this.localPlayer = document.getElementById('quextEVideoLocal');
        this.localPlayerIntro = document.getElementById('quextEVILocal');
    },

    getCuestionDefault: function () {
        const p = {
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
            solution: 0,
            silentVideo: 0,
            tSilentVideo: 0,
            audio: '',
            msgHit: '',
            msgError: '',
        };
        return p;
    },

    validTime: function (time) {
        const reg = /^(?:(?:([01]?\d|2[0-3]):)?([0-5]?\d):)?([0-5]?\d)$/;
        return time.length === 8 && reg.test(time);
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            $exeDevice.active = 0;
            const wrapper = $('<div></div>');
            wrapper.html(originalHTML);

            let json = $('.quext-DataGame', wrapper).text();
            const version = $('.quext-version', wrapper).text();

            if (version.length === 1) {
                json = $exeDevices.iDevice.gamification.helpers.decrypt(json);
            }

            const dataGame =
                $exeDevices.iDevice.gamification.helpers.isJsonString(json),
                $imagesLink = $('.quext-LinkImages', wrapper),
                $audiosLink = $('.quext-LinkAudios', wrapper);

            $imagesLink.each(function () {
                const iq = parseInt($(this).text());
                if (!isNaN(iq) && iq < dataGame.questionsGame.length) {
                    dataGame.questionsGame[iq].url = $(this).attr('href');
                    if (
                        dataGame.questionsGame[iq].url.length < 4 &&
                        dataGame.questionsGame[iq].type === 1
                    ) {
                        dataGame.questionsGame[iq].url = '';
                    }
                }
            });

            dataGame.questionsGame.forEach(function (question, index) {
                question.audio =
                    typeof question.audio === 'undefined' ? '' : question.audio;
            });

            $audiosLink.each(function () {
                const iq = parseInt($(this).text());
                if (!isNaN(iq) && iq < dataGame.questionsGame.length) {
                    dataGame.questionsGame[iq].audio = $(this).attr('href');
                    if (dataGame.questionsGame[iq].audio.length < 4) {
                        dataGame.questionsGame[iq].audio = '';
                    }
                }
            });

            $exeDevice.active = 0;
            dataGame.questionsGame.forEach(function (question) {
                if (question.type === 3) {
                    question.eText = unescape(question.eText);
                }
            });

            const instructions = $('.quext-instructions', wrapper);
            if (instructions.length === 1) {
                $('#eXeGameInstructions').val(instructions.html());
            }

            const textAfter = $('.quext-extra-content', wrapper);
            if (textAfter.length === 1) {
                $('#eXeIdeviceTextAfter').val(textAfter.html());
            }

            const textFeedBack = $('.quext-feedback-game', wrapper);
            if (textFeedBack.length === 1) {
                $('#quextEFeedBackEditor').val(textFeedBack.html());
            }

            $exeDevices.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs,
            );
            $exeDevice.updateFieldGame(dataGame);
        }
    },

    updateGameMode: function (gamemode, feedback, useLives) {
        $('#quextEUseLives').prop('disabled', true);
        $('#quextENumberLives').prop('disabled', true);
        $('#quextEPercentajeFB').prop('disabled', !feedback && gamemode !== 2);
        $('#quextEHasFeedBack').prop('disabled', gamemode === 2);
        $('#quextEHasFeedBack').prop('checked', feedback);
        if (gamemode === 2 || feedback) {
            $('#quextEFeedbackP').slideDown();
        }
        if (gamemode !== 2 && !feedback) {
            $('#quextEFeedbackP').slideUp();
        }
        if (gamemode === 0) {
            $('#quextEUseLives').prop('disabled', false);
            $('#quextENumberLives').prop('disabled', !useLives);
        }
    },

    updateFieldGame: function (game) {
        $exeDevices.iDevice.gamification.itinerary.setValues(game.itinerary);
        game.answersRamdon = game.answersRamdon || false;
        game.percentajeFB =
            typeof game.percentajeFB !== 'undefined' ? game.percentajeFB : 100;
        game.gameMode =
            typeof game.gameMode !== 'undefined' ? game.gameMode : 0;
        game.feedBack =
            typeof game.feedBack !== 'undefined' ? game.feedBack : false;
        game.customMessages =
            typeof game.customMessages === 'undefined'
                ? false
                : game.customMessages;
        game.percentajeQuestions =
            typeof game.percentajeQuestions === 'undefined'
                ? 100
                : game.percentajeQuestions;
        game.evaluation =
            typeof game.evaluation !== 'undefined' ? game.evaluation : false;
        game.evaluationID =
            typeof game.evaluationID !== 'undefined' ? game.evaluationID : '';
        game.weighted =
            typeof game.weighted !== 'undefined' ? game.weighted : 100;
        $exeDevice.id = $exeDevice.getIdeviceID();

        $('#quextEShowMinimize').prop('checked', game.showMinimize);
        $('#quextEQuestionsRamdon').prop('checked', game.optionsRamdon);
        $('#quextEAnswersRamdon').prop('checked', game.answersRamdon);
        $('#quextEVideoIntro').val(game.idVideo);
        $('#quextEShowSolution').prop('checked', game.showSolution);
        $('#quextETimeShowSolution').val(game.timeShowSolution);
        $('#quextETimeShowSolution').prop('disabled', !game.showSolution);
        $('#quextENumberLives').prop('disabled', !game.useLives);
        $('#quextEVIURL').val(game.idVideo);
        $('#quextEVIEnd').val(
            $exeDevices.iDevice.gamification.helpers.secondsToHour(
                game.endVideo,
            ),
        );
        $('#quextEVIStart').val(
            $exeDevices.iDevice.gamification.helpers.secondsToHour(
                game.startVideo,
            ),
        );
        $('#quextECustomScore').prop('checked', game.customScore);
        $('#quextEScoreQuestionDiv').hide();
        $('#quextEHasFeedBack').prop('checked', game.feedBack);
        $('#quextEPercentajeFB').val(game.percentajeFB);
        $(
            `input.QXTE-TypeGame[name='qxtgamemode'][value='${game.gameMode}']`,
        ).prop('checked', true);
        $('#quextEUseLives').prop('disabled', game.gameMode === 0);
        $('#quextENumberLives').prop(
            'disabled',
            game.gameMode === 0 && game.useLives,
        );
        $('#quextECustomMessages').prop('checked', game.customMessages);
        $('#quextEPercentajeQuestions').val(game.percentajeQuestions);
        $('#quextEEvaluation').prop('checked', game.evaluation);
        $('#quextEEvaluationID').val(game.evaluationID);
        $('#quextEEvaluationID').prop('disabled', !game.evaluation);

        $exeDevice.updateGameMode(game.gameMode, game.feedBack, game.useLives);
        $exeDevice.showSelectOrder(game.customMessages);

        game.questionsGame.forEach(function (question) {
            question.audio =
                typeof question.audio === 'undefined' ? '' : question.audio;
            question.msgHit =
                typeof question.msgHit === 'undefined' ? '' : question.msgHit;
            question.msgError =
                typeof question.msgError === 'undefined'
                    ? ''
                    : question.msgError;
        });

        if (game.customScore) {
            $('#quextEScoreQuestionDiv').show();
        }

        $exeDevices.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted,
        );

        if (game.feedBack || game.gameMode === 2) {
            $('#quextEFeedbackP').show();
        } else {
            $('#quextEFeedbackP').hide();
        }

        $('#quextEPercentajeFB').prop('disabled', !game.feedBack);
        $exeDevice.questionsGame = game.questionsGame;
        $exeDevice.updateQuestionsNumber();
        $exeDevice.showQuestion($exeDevice.active);
    },

    showSelectOrder: function (messages) {
        if (messages) {
            $('.QXTE-EOrders').slideDown();
        } else {
            $('.QXTE-EOrders').slideUp();
        }
    },

    getMediaType: function () {
        const ele = document.getElementsByName('qxtype');
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
        if (!$exeDevice.validateQuestion()) return false;

        const dataGame = this.validateData();
        if (!dataGame) return false;

        $exeDevice.clockVideo.stop();

        const fields = this.ci18n,
            i18n = Object.assign({}, fields);
        for (const key in fields) {
            const fVal = $('#ci18n_' + key).val();
            if (fVal !== '') {
                i18n[key] = fVal;
            }
        }

        dataGame.msgs = i18n;
        const json = JSON.stringify(dataGame);
        let divContent = '';


        const instructions = tinyMCE.get('eXeGameInstructions').getContent();

        if (instructions !== '') {
            divContent = `<div class="quext-instructions QXTP-instructions">${instructions}</div>`;
        }

        const textFeedBack = tinyMCE.get('quextEFeedBackEditor').getContent(),
            linksImages = $exeDevice.createlinksImage(dataGame.questionsGame),
            linksAudios = $exeDevice.createlinksAudio(dataGame.questionsGame);

        let html = '<div class="quext-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html += divContent;
        html += `<div class="quext-version js-hidden">${$exeDevice.version}</div>`;
        html += `<div class="quext-feedback-game">${textFeedBack}</div>`;
        html += `<div class="quext-DataGame js-hidden">${$exeDevices.iDevice.gamification.helpers.encrypt(json)}</div>`;

        html += linksImages;
        html += linksAudios;
        const textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();
        if (textAfter !== '') {
            html += `<div class="quext-extra-content">${textAfter}</div>`;
        }
        html += `<div class="quext-bns js-hidden">${$exeDevice.msgs.msgNoSuportBrowser}</div>`;
        html += '</div>';
        return html;
    },

    validateAlt: function () {
        const altImage = $('#quextEAlt').val();
        if (!$exeDevice.checkAltImage) {
            return true;
        }
        if (altImage !== '') {
            return true;
        }
        eXe.app.confirm(
            $exeDevice.msgs.msgTitleAltImageWarning,
            $exeDevice.msgs.msgAltImageWarning,
            function () {
                $exeDevice.checkAltImage = false;
                const saveButton = document.getElementsByClassName(
                    'button-save-idevice',
                )[0];
                saveButton.click();
            },
        );
        return false;
    },

    validateQuestion: function () {
        let message = '',
            optionEmpy = false,
            p = {};
        const msgs = $exeDevice.msgs;

        p.type = parseInt($('input[name=qxtype]:checked').val());
        p.time = parseInt($('input[name=qxttime]:checked').val());
        p.numberOptions = parseInt($('input[name=qxtnumber]:checked').val());
        p.x = parseFloat($('#quextEXImage').val());
        p.y = parseFloat($('#quextEYImage').val());
        p.author = $('#quextEAuthor').val();
        p.alt = $('#quextEAlt').val();
        p.customScore = parseFloat($('#quextEScoreQuestion').val());
        p.url = $('#quextEURLImage').val().trim();
        p.audio = $('#quextEURLAudio').val();

        $exeDevice.stopSound();
        $exeDevice.stopVideo();

        if (p.type === 2) {
            const youtubeUrl = $('#quextEURLYoutube').val().trim();
            p.url = $exeDevices.iDevice.gamification.media.getIDYoutube(
                youtubeUrl,
            )
                ? youtubeUrl
                : '';
            if (p.url === '') {
                p.url =
                    $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                        youtubeUrl,
                    )
                        ? youtubeUrl
                        : '';
            }
        }

        p.soundVideo = $('#quextECheckSoundVideo').is(':checked') ? 1 : 0;
        p.imageVideo = $('#quextECheckImageVideo').is(':checked') ? 1 : 0;
        p.iVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
            $('#quextEInitVideo').val().trim(),
        );
        p.fVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
            $('#quextEEndVideo').val().trim(),
        );
        p.silentVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
            $('#quextESilenceVideo').val().trim(),
        );
        p.tSilentVideo = parseInt($('#quextETimeSilence').val());
        p.eText = tinyMCE.get('quextEText').getContent();
        p.quextion = $('#quextEQuestion').val().trim();
        p.options = [];
        p.solution = parseInt($('input[name=qxsolution]:checked').val());
        p.msgHit = $('#quextEMessageOK').val();
        p.msgError = $('#quextEMessageKO').val();

        $('.QXTE-EAnwersOptions').each(function (i) {
            const option = $(this).val().trim();
            if (i < p.numberOptions && option.length === 0) {
                optionEmpy = true;
            }
            p.options.push(option);
        });

        if (p.quextion.length === 0) {
            message = msgs.msgECompleteQuestion;
        } else if (optionEmpy) {
            message = msgs.msgECompleteAllOptions;
        } else if (p.type === 1 && p.url.length < 5) {
            message = msgs.msgEURLValid;
        } else if (p.type === 2 && p.url.length === 0) {
            message = msgs.msgECompleteURLYoutube;
        } else if (p.type === 2 && (!p.iVideo || !p.fVideo)) {
            message = msgs.msgEStartEndVideo;
        } else if (p.type === 2 && p.iVideo >= p.fVideo) {
            message = msgs.msgEStartEndIncorrect;
        } else if (p.type === 3 && p.eText.length === 0) {
            message = msgs.msgWriteText;
        } else if (
            p.type === 2 &&
            (!$exeDevice.validTime($('#quextEInitVideo').val()) ||
                !$exeDevice.validTime($('#quextEEndVideo').val()))
        ) {
            message = msgs.msgTimeFormat;
        } else if (
            p.type === 2 &&
            p.tSilentVideo > 0 &&
            !$exeDevice.validTime($('#quextESilenceVideo').val())
        ) {
            message = msgs.msgTimeFormat;
        } else if (
            p.type === 2 &&
            p.tSilentVideo > 0 &&
            (p.silentVideo < p.iVideo || p.silentVideo >= p.fVideo)
        ) {
            message = msgs.msgSilentPoint;
        }

        if (message.length === 0) {
            $exeDevice.questionsGame[$exeDevice.active] = p;
            message = true;
        } else {
            $exeDevice.showMessage(message);
            message = false;
        }

        return message;
    },

    createlinksImage: function (questionsGame) {
        let html = '';
        for (let i = 0; i < questionsGame.length; i++) {
            const question = questionsGame[i];
            let linkImage = '';
            if (question.type === 1 && !question.url.startsWith('http')) {
                linkImage = `<a href="${question.url}" class="js-hidden quext-LinkImages">${i}</a>`;
            }
            html += linkImage;
        }
        return html;
    },

    createlinksAudio: function (questionsGame) {
        let html = '';
        for (let i = 0; i < questionsGame.length; i++) {
            const question = questionsGame[i];
            let linkAudio = '';
            if (
                question.type !== 2 &&
                !question.audio.startsWith('http') &&
                question.audio.length > 4
            ) {
                linkAudio = `<a href="${question.audio}" class="js-hidden quext-LinkAudios">${i}</a>`;
            }
            html += linkAudio;
        }
        return html;
    },

    exportQuestions: function () {
        const dataGame = this.validateData();
        if (!dataGame) return false;

        const lines = this.getLinesQuestions(dataGame.questionsGame);
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

        document.getElementById('gameQEIdeviceForm').appendChild(link);
        link.click();
        setTimeout(() => {
            document.getElementById('gameQEIdeviceForm').removeChild(link);
            window.URL.revokeObjectURL(data);
        }, 100);
    },

    getLinesQuestions: function (questions) {
        let linequestions = [];
        for (let i = 0; i < questions.length; i++) {
            let q = questions[i];
            let question = `${q.solution}#${q.quextion}`;
            for (let j = 0; j < q.options.length; j++) {
                if (q.options[j]) {
                    question += `#${q.options[j]}`;
                }
            }
            linequestions.push(question);
        }
        return linequestions;
    },

    insertQuestions: function (lines) {
        const lineFormat =
            /^(0|1|2|3)#([^#]+)#([^#]+)#([^#]+)(#([^#]+))?(#([^#]+))?$/;
        let questions = [];

        lines.forEach(function (line) {
            if (lineFormat.test(line)) {
                const linarray = line.trim().split('#'),
                    solution = parseInt(linarray[0], 10);

                let p = $exeDevice.getCuestionDefault();
                p.quextion = linarray[1] || '';
                p.options[0] = linarray[2] || '';
                p.options[1] = linarray[3] || '';
                p.options[2] = linarray.length > 4 ? linarray[4] : '';
                p.options[3] = linarray.length > 5 ? linarray[5] : '';
                p.numberOptions = linarray.length - 2;
                p.solution = solution > p.numberOptions - 1 ? 0 : solution;

                questions.push(p);
            }
        });

        $exeDevice.addQuestions(questions);
    },

    importText: function (content) {
        const lines = content.split('\n');
        $exeDevice.insertQuestions(lines);
    },

    addQuestions: function (questions) {
        if (!questions || questions.length == 0) {
            eXe.app.alert(
                _('Sorry, there are no questions for this type of activity.'),
            );
            return;
        }
        for (let i = 0; i < questions.length; i++) {
            $exeDevice.questionsGame.push(questions[i]);
        }
        $exeDevice.active = 0;
        $exeDevice.showQuestion($exeDevice.active);
        $exeDevice.deleteEmptyQuestion();
        $exeDevice.updateQuestionsNumber();
        $('.exe-form-tabs li:first-child a').click();
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
        questions.each(function () {
            const question = $(this),
                type = question.attr('type');
            if (
                type !== 'multichoice' &&
                type !== 'truefalse' &&
                type !== 'numerical'
            ) {
                return;
            }
            const questionText = question.find('questiontext').first().text(),
                answers = question.find('answer'),
                options = [];
            let solution = 0;
            answers.each(function (index) {
                const answer = $(this),
                    answerHtml = $exeDevice.removeTags(answer.text().trim()),
                    answerText = answerHtml.split('\n')[0].trim();
                options.push(answerText);
                if (parseInt(answer.attr('fraction')) === 100) {
                    solution = index;
                }
            });
            questionsJson.push({
                question: $exeDevice.removeTags(questionText.trim()),
                options: options,
                solution: solution,
            });
        });
        let questionj = [];
        questionsJson.forEach(function (question) {
            let p = $exeDevice.getCuestionDefault();
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
            if (p.quextion && p.options.length > 1) {
                questionj.push(p);
            }
        });
        $exeDevice.addQuestions(questionj);
    },

    deleteEmptyQuestion: function () {
        if ($exeDevice.questionsGame.length > 1) {
            const quextion = $('#quextEQuestion').val().trim();
            if (quextion.length === 0) {
                $exeDevice.removeQuestion();
            }
        }
    },

    importMoodle: function (xmlString) {
        const xmlDoc = $.parseXML(xmlString),
            $xml = $(xmlDoc);
        if ($xml.find('quiz').length > 0) {
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
        } else if (game.typeGame === 'QuExt') {
            $exeDevice.questionsGame = game.questionsGame;
            game.id = $exeDevice.getIdeviceID();
            for (let i = 0; i < $exeDevice.questionsGame.length; i++) {
                if (game.questionsGame[i].type === 3) {
                    game.questionsGame[i].eText = unescape(
                        game.questionsGame[i].eText,
                    );
                }
                let numOpt = 0;
                const options = $exeDevice.questionsGame[i].options;
                for (let j = 0; j < options.length; j++) {
                    if (options[j].trim().length === 0) {
                        $exeDevice.questionsGame[i].numberOptions = numOpt;
                        break;
                    }
                    numOpt++;
                }
            }
            $exeDevice.updateFieldGame(game);
            const instructions = game.instructionsExe || game.instructions,
                tAfter = game.textAfter || '',
                textFeedBack = game.textFeedBack || '';
            tinyMCE
                .get('eXeGameInstructions')
                .setContent(unescape(instructions));
            tinyMCE.get('eXeIdeviceTextAfter').setContent(unescape(tAfter));
            tinyMCE
                .get('quextEFeedBackEditor')
                .setContent(unescape(textFeedBack));
        } else if (game.typeGame !== 'QuExt') {
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
            return;
        }
        $exeDevice.active = 0;
        $exeDevice.showQuestion($exeDevice.active);
        $exeDevice.deleteEmptyQuestion();
        $exeDevice.updateQuestionsNumber();
        $('.exe-form-tabs li:first-child a').click();
    },

    getIdeviceID: function () {
        const ideviceid =
            $('#gameQEIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';

        return ideviceid;
    },

    validateData: function () {
        const clear = $exeDevice.removeTags,
            instructions = $('#eXeGameInstructions').text(),
            instructionsExe = escape(
                tinyMCE.get('eXeGameInstructions').getContent(),
            ),
            textAfter = escape(tinyMCE.get('eXeIdeviceTextAfter').getContent()),
            textFeedBack = escape(
                tinyMCE.get('quextEFeedBackEditor').getContent(),
            ),
            showMinimize = $('#quextEShowMinimize').is(':checked'),
            optionsRamdon = $('#quextEQuestionsRamdon').is(':checked'),
            answersRamdon = $('#quextEAnswersRamdon').is(':checked'),
            showSolution = $('#quextEShowSolution').is(':checked'),
            timeShowSolution = parseInt(
                clear($('#quextETimeShowSolution').val()),
            ),
            useLives = $('#quextEUseLives').is(':checked'),
            numberLives = parseInt(clear($('#quextENumberLives').val())),
            idVideo = $('#quextEVideoIntro').val(),
            endVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                $('#quextEVIEnd').val(),
            ),
            startVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                $('#quextEVIStart').val(),
            ),
            itinerary = $exeDevices.iDevice.gamification.itinerary.getValues(),
            customScore = $('#quextECustomScore').is(':checked'),
            feedBack = $('#quextEHasFeedBack').is(':checked'),
            percentajeFB = parseInt(clear($('#quextEPercentajeFB').val())),
            gameMode = parseInt($('input[name=qxtgamemode]:checked').val()),
            customMessages = $('#quextECustomMessages').is(':checked'),
            percentajeQuestions = parseInt(
                clear($('#quextEPercentajeQuestions').val()),
            ),
            evaluation = $('#quextEEvaluation').is(':checked'),
            evaluationID = $('#quextEEvaluationID').val(),
            id = $exeDevice.getIdeviceID(),
            questionsGame = $exeDevice.questionsGame,
            scorm = $exeDevices.iDevice.gamification.scorm.getValues();

        if (!itinerary) return false;

        if ((gameMode === 2 || feedBack) && textFeedBack.trim().length === 0) {
            eXe.app.alert($exeDevice.msgs.msgProvideFB);
            return false;
        }
        if (showSolution && timeShowSolution.toString().length === 0) {
            $exeDevice.showMessage($exeDevice.msgs.msgEProvideTimeSolution);
            return false;
        }
        if (evaluation && evaluationID.length < 5) {
            eXe.app.alert($exeDevice.msgs.msgIDLenght);
            return false;
        }
        for (let i = 0; i < questionsGame.length; i++) {
            const mquestion = questionsGame[i];
            mquestion.customScore =
                typeof mquestion.customScore === 'undefined'
                    ? 1
                    : mquestion.customScore;
            if (mquestion.quextion.length === 0) {
                $exeDevice.showMessage($exeDevice.msgs.msgECompleteQuestion);
                return false;
            } else if (mquestion.type === 1 && mquestion.url.length < 10) {
                $exeDevice.showMessage($exeDevice.msgs.msgEURLValid);
                return false;
            } else if (
                mquestion.type === 2 &&
                !$exeDevices.iDevice.gamification.media.getIDYoutube(
                    mquestion.url,
                ) &&
                !$exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                    mquestion.url,
                )
            ) {
                $exeDevice.showMessage($exeDevice.msgs.msgECompleteURLYoutube);
                return false;
            }
            let completAnswer = true;
            for (let j = 0; j < mquestion.numberOptions; j++) {
                if (mquestion.options[j].length === 0) {
                    completAnswer = false;
                }
            }
            if (!completAnswer) {
                $exeDevice.showMessage($exeDevice.msgs.msgECompleteAllOptions);
                return false;
            }
        }
        for (let i = 0; i < questionsGame.length; i++) {
            const qt = questionsGame[i];
            if (qt.type === 1 && qt.url.length < 8) {
                qt.x = 0;
                qt.y = 0;
                qt.author = '';
                qt.alt = '';
            } else if (qt.type === 2 && qt.url.length < 8) {
                qt.iVideo = 0;
                qt.fVideo = 0;
                qt.author = '';
                qt.alt = '';
            }
        }
        const data = {
            asignatura: '',
            author: '',
            authorVideo: '',
            typeGame: 'QuExt',
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
            questionsGame: questionsGame,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted,
            title: '',
            customScore: customScore,
            textAfter: textAfter,
            textFeedBack: textFeedBack,
            gameMode: gameMode,
            feedBack: feedBack,
            percentajeFB: percentajeFB,
            version: 2,
            customMessages: customMessages,
            percentajeQuestions: percentajeQuestions,
            evaluation: evaluation,
            evaluationID: evaluationID,
            id: id,
        };
        return data;
    },

    removeTags: function (str) {
        const wrapper = $('<div></div>');
        wrapper.html(str);
        return wrapper.text();
    },

    addEvents: function () {
        $('#quextEPaste').hide();

        $('#quextEUseLives').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#quextENumberLives').prop('disabled', !marcado);
        });

        $('#quextEInitVideo, #quextEEndVideo, #quextESilenceVideo').on(
            'focusout',
            function () {
                if (!$exeDevice.validTime(this.value)) {
                    $(this).css({
                        'background-color': 'red',
                        color: 'white',
                    });
                }
            },
        );

        $('#quextEInitVideo, #quextEEndVideo, #quextESilenceVideo').on(
            'click',
            function () {
                $(this).css({
                    'background-color': 'white',
                    color: '#2c6d2c',
                });
            },
        );

        $('#quextShowCodeAccess').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#quextCodeAccess, #quextMessageCodeAccess').prop(
                'disabled',
                !marcado,
            );
        });

        $('.QXTE-EPanel').on('click', 'input.QXTE-Type', (e) => {
            const type = parseInt($(e.target).val());
            $exeDevice.changeTypeQuestion(type);
        });

        $('.QXTE-EPanel').on('click', 'input.QXTE-Number', (e) => {
            const number = parseInt($(e.target).val());
            $exeDevice.showOptions(number);
        });

        $('#quextEAdd').on('click', (e) => {
            e.preventDefault();
            $exeDevice.addQuestion();
        });

        $('#quextEFirst').on('click', (e) => {
            e.preventDefault();
            $exeDevice.firstQuestion();
        });

        $('#quextEPrevious').on('click', (e) => {
            e.preventDefault();
            $exeDevice.previousQuestion();
        });

        $('#quextENext').on('click', (e) => {
            e.preventDefault();
            $exeDevice.nextQuestion();
        });

        $('#quextELast').on('click', (e) => {
            e.preventDefault();
            $exeDevice.lastQuestion();
        });

        $('#quextEDelete').on('click', (e) => {
            e.preventDefault();
            $exeDevice.removeQuestion();
        });

        $('#quextECopy').on('click', (e) => {
            e.preventDefault();
            $exeDevice.copyQuestion();
        });

        $('#quextECut').on('click', (e) => {
            e.preventDefault();
            $exeDevice.cutQuestion();
        });

        $('#quextEPaste').on('click', (e) => {
            e.preventDefault();
            $exeDevice.pasteQuestion();
        });

        $('#quextEPlayVideo').on('click', (e) => {
            e.preventDefault();
            const youtubeUrl = $('#quextEURLYoutube').val().trim();
            if (
                $exeDevices.iDevice.gamification.media.getIDYoutube(youtubeUrl)
            ) {
                if (typeof YT === 'undefined') {
                    $exeDevice.isVideoType = true;
                    $exeDevice.loadYoutubeApi();
                } else {
                    $exeDevice.showVideoQuestion();
                }
            } else if (
                $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                    youtubeUrl,
                )
            ) {
                $exeDevice.showVideoQuestion();
            } else {
                $exeDevice.showMessage($exeDevice.msgs.msgECompleteURLYoutube);
            }
        });

        $('#quextECheckSoundVideo, #quextECheckImageVideo').on('change', () => {
            $exeDevice.playVideoQuestion();
        });

        $('#gameQEIdeviceForm').on('dblclick', '#quextEImage', () => {
            $('#quextECursor').hide();
            $('#quextEXImage, #quextEYImage').val(0);
        });

        $('#quextENumberLives')
            .on('keyup', function () {
                this.value = this.value.replace(/\D/g, '').substring(0, 1);
            })
            .on('focusout', function () {
                let value =
                    this.value.trim() === '' ? 3 : parseInt(this.value, 10);
                value = Math.max(1, Math.min(value, 5));
                this.value = value;
            });

        $('#quextETimeShowSolution')
            .on('keyup', function () {
                this.value = this.value.replace(/\D/g, '').substring(0, 1);
            })
            .on('focusout', function () {
                let value =
                    this.value.trim() === '' ? 3 : parseInt(this.value, 10);
                value = Math.max(1, Math.min(value, 9));
                this.value = value;
            });

        $('#quextEScoreQuestion').on('focusout', function () {
            if (!$exeDevice.validateScoreQuestion($(this).val())) {
                $(this).val(1);
            }
        });

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
            $('#eXeGameImportGame').attr('accept', '.txt, .xml');

            $('#eXeGameImportGame').on('change', (e) => {
                const file = e.target.files[0];
                if (!file) {
                    $exeDevice.showMessage(
                        `${_('Please select a text file (.txt) or a Moodle XML file (.xml)')}`,
                    );
                    return;
                }
                if (
                    !file.type ||
                    !file.type.match(
                        /text\/plain|application\/json|application\/xml|text\/xml/,
                    )
                ) {
                    $exeDevice.showMessage(
                        `${_('Please select a text file (.txt) or a Moodle XML file (.xml)')}`,
                    );
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
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

        $('#quextEInitVideo')
            .css('color', '#2c6d2c')
            .on('click', (e) => {
                e.preventDefault();
                $exeDevice.timeVideoFocus = 0;
                $('#quextEInitVideo').css('color', '#2c6d2c');
                $('#quextEEndVideo, #quextESilenceVideo').css(
                    'color',
                    '#000000',
                );
            });

        $('#quextEEndVideo').on('click', (e) => {
            e.preventDefault();
            $exeDevice.timeVideoFocus = 1;
            $('#quextEEndVideo').css('color', '#2c6d2c');
            $('#quextEInitVideo, #quextESilenceVideo').css('color', '#000000');
        });

        $('#quextESilenceVideo').on('click', (e) => {
            e.preventDefault();
            $exeDevice.timeVideoFocus = 2;
            $('#quextESilenceVideo').css('color', '#2c6d2c');
            $('#quextEInitVideo, #quextEEndVideo').css('color', '#000000');
        });

        $('#quextETimeSilence').on('keyup', function () {
            this.value = this.value.replace(/\D/g, '').substring(0, 1);
        });

        $('#quextEVideoTime').on('click', (e) => {
            e.preventDefault();
            let $timeV;
            switch ($exeDevice.timeVideoFocus) {
                case 0:
                    $timeV = $('#quextEInitVideo');
                    break;
                case 1:
                    $timeV = $('#quextEEndVideo');
                    break;
                case 2:
                    $timeV = $('#quextESilenceVideo');
                    break;
                default:
                    return;
            }
            $timeV.val($('#quextEVideoTime').text()).css({
                'background-color': 'white',
                color: '#2c6d2c',
            });
        });

        $('#quextEVIStart')
            .css('color', '#2c6d2c')
            .on('click', (e) => {
                e.preventDefault();
                $exeDevice.timeVIFocus = true;
                $('#quextEVIStart').css('color', '#2c6d2c');
                $('#quextEVIEnd').css('color', '#000000');
            });

        $('#quextEVIEnd').on('click', (e) => {
            e.preventDefault();
            $exeDevice.timeVIFocus = false;
            $('#quextEVIEnd').css('color', '#2c6d2c');
            $('#quextEVIStart').css('color', '#000000');
        });

        $('#quextEVITime').on('click', (e) => {
            e.preventDefault();
            const $timeV = $exeDevice.timeVIFocus
                ? $('#quextEVIStart')
                : $('#quextEVIEnd');
            $timeV.val($('#quextEVITime').text());
        });

        $('#quextUseLives').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#quextNumberLives').prop('disabled', !marcado);
        });

        $('#quextEShowSolution').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#quextETimeShowSolution').prop('disabled', !marcado);
        });

        $('#quextECustomScore').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#quextEScoreQuestionDiv').toggle(marcado);
        });

        $('#quextEURLImage').on('change', function () {
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'web`'],
                selectedFile = $(this).val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (
                selectedFile.startsWith('files') && !validExt.includes(ext)
            ) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: jpg, jpeg, gif, png, svg, webp `,
                );
                return false;
            }
            const url = selectedFile,
                alt = $('#quextEAlt').val(),
                x = parseFloat($('#quextEXImage').val()),
                y = parseFloat($('#quextEYImage').val());
            $exeDevice.showImage(url, x, y, alt);
        });

        $('#quextEPlayImage').on('click', (e) => {
            e.preventDefault();
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'web`'],
                selectedFile = $('#quextEURLImage').val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (
                selectedFile.startsWith('files') && !validExt.includes(ext)
            ) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: jpg, jpeg, gif, png, svg, webp`,
                );
                return false;
            }
            const url = selectedFile,
                alt = $('#quextEAlt').val(),
                x = parseFloat($('#quextEXImage').val()),
                y = parseFloat($('#quextEYImage').val());
            $exeDevice.showImage(url, x, y, alt);
        });

        $('#quextEImage').on('click', (e) => {
            $exeDevice.clickImage(e.currentTarget, e.pageX, e.pageY);
        });

        $('#quextEVideoIntroPlay').on('click', (e) => {
            e.preventDefault();
            $exeDevice.playVideoIntro1();
        });

        $('#quextEVIPlayI').on('click', (e) => {
            e.preventDefault();
            $exeDevice.playVideoIntro2();
        });

        $('#quextEVIClose').on('click', (e) => {
            e.preventDefault();
            $('#quextEVideoIntro').val($('#quextEVIURL').val());
            $('#quextEVIDiv').hide();
            $('#quextENumQuestionDiv').show();
            $exeDevice.stopVideoIntro();
        });

        $('#quextECursor').on('click', () => {
            $('#quextECursor').hide();
            $('#quextEXImage, #quextEYImage').val(0);
        });

        $('#quextEPlayAudio').on('click', (e) => {
            e.preventDefault();
            const selectedFile = $('#quextEURLAudio').val().trim();
            if (selectedFile.length > 4) {
                $exeDevice.stopSound();
                $exeDevice.playSound(selectedFile);
            }
        });

        $('#quextEURLAudio').on('change', function () {
            const selectedFile = $(this).val().trim();
            if (selectedFile.length === 0) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: mp3, ogg, wav`,
                );
            } else if (selectedFile.length > 4) {
                $exeDevice.stopSound();
                $exeDevice.playSound(selectedFile);
            }
        });

        $('#quextEHasFeedBack').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#quextEFeedbackP').slideToggle(marcado);
            $('#quextEPercentajeFB').prop('disabled', !marcado);
        });

        $('#gameQEIdeviceForm').on('click', 'input.QXTE-TypeGame', function () {
            const gm = parseInt($(this).val(), 10),
                fb = $('#quextEHasFeedBack').is(':checked'),
                ul = $('#quextEUseLives').is(':checked');
            $exeDevice.updateGameMode(gm, fb, ul);
        });

        $('#quextEGameModeHelpLnk').on('click', function () {
            $('#quextEGameModeHelp').toggle();
            return false;
        });

        $('#quextECustomMessages').on('change', function () {
            const messages = $(this).is(':checked');
            $exeDevice.showSelectOrder(messages);
        });

        $('#quextEPercentajeQuestions')
            .on('keyup click', function () {
                this.value = this.value.replace(/\D/g, '').substring(0, 3);
                if (this.value > 0 && this.value <= 100) {
                    $exeDevice.updateQuestionsNumber();
                }
            })
            .on('focusout', function () {
                let value =
                    this.value.trim() === '' ? 100 : parseInt(this.value, 10);
                value = Math.max(1, Math.min(value, 100));
                this.value = value;
                $exeDevice.updateQuestionsNumber();
            });

        $('#quextENumberQuestion').on('keyup', function (e) {
            if (e.keyCode === 13) {
                const num = parseInt($(this).val(), 10);
                if (!isNaN(num) && num > 0) {
                    if ($exeDevice.validateQuestion() !== false) {
                        $exeDevice.active =
                            num < $exeDevice.questionsGame.length
                                ? num - 1
                                : $exeDevice.questionsGame.length - 1;
                        $exeDevice.showQuestion($exeDevice.active);
                    } else {
                        $(this).val($exeDevice.active + 1);
                    }
                } else {
                    $(this).val($exeDevice.active + 1);
                }
            }
        });

        $('#quextEEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#quextEEvaluationID').prop('disabled', !marcado);
        });

        $('#quextEEvaluationHelpLnk').on('click', function () {
            $('#quextEEvaluationHelp').toggle();
            return false;
        });

        $exeDevices.iDevice.gamification.itinerary.addEvents();
        $exeDevices.iDevice.gamification.share.addEvents(
            2,
            $exeDevice.insertQuestions,
        );

        $exeDevice.loadYoutubeApi();

        //eXe 3.0 Dismissible messages
        $('.exe-block-dismissible .exe-block-close').on('click', function () {
            $(this).parent().fadeOut();
            return false;
        });
    },

    playVideoIntro1: function () {
        const idv = $exeDevices.iDevice.gamification.media.getIDYoutube(
            $('#quextEVideoIntro').val(),
        ),
            idmt = $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                $('#quextEVideoIntro').val(),
            ),
            iVI = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                $('#quextEVIStart').val(),
            ),
            endVI = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                $('#quextEVIEnd').val(),
            ),
            fVI = endVI > 0 ? endVI : 9000;

        if (idv || idmt) {
            if (fVI <= iVI) {
                $exeDevice.showMessage($exeDevice.msgs.msgEStartEndIncorrect);
                return;
            }
            if (idv) {
                if (typeof YT === 'undefined') {
                    $exeDevice.isVideoIntro = 1;
                    $exeDevice.loadYoutubeApi();
                    return;
                } else {
                    $('#quextEVI').show();
                    $exeDevice.startVideoIntro(idv, iVI, fVI, 0);
                }
            } else {
                $exeDevice.startVideoIntro(idmt, iVI, fVI, 1);
            }
            $('#quextEVIURL').val($('#quextEVideoIntro').val());
            $('#quextEVIDiv').show();
            $('#quextEVINo').hide();
            $('#quextENumQuestionDiv').hide();
        } else {
            $('#quextEVINo').show();
            $('#quextEVI').hide();
            $exeDevice.showMessage($exeDevice.msgs.msgECompleteURLYoutube);
        }
    },

    playVideoIntro2: function () {
        const idv = $exeDevices.iDevice.gamification.media.getIDYoutube(
            $('#quextEVIURL').val(),
        ),
            idmt = $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                $('#quextEVIURL').val(),
            ),
            iVI = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                $('#quextEVIStart').val(),
            ),
            endVI = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                $('#quextEVIEnd').val(),
            ),
            fVI = endVI > 0 ? endVI : 9000;

        if (idv || idmt) {
            if (fVI <= iVI) {
                $exeDevice.showMessage($exeDevice.msgs.msgEStartEndIncorrect);
                return;
            }
            if (idv) {
                if (typeof YT === 'undefined') {
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

    clickImage: function (img, epx, epy) {
        const $cursor = $('#quextECursor'),
            $x = $('#quextEXImage'),
            $y = $('#quextEYImage'),
            $img = $(img),
            offset = $img.offset(),
            posX = epx - offset.left,
            posY = epy - offset.top,
            wI = Math.max($img.width(), 1),
            hI = Math.max($img.height(), 1),
            position = $img.position(),
            lI = position.left,
            tI = position.top;

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
        const $parent = $(image).parent(),
            wDiv = Math.max($parent.width(), 1),
            hDiv = Math.max($parent.height(), 1),
            varW = naturalWidth / wDiv,
            varH = naturalHeight / hDiv;

        let wImage = wDiv,
            hImage = hDiv,
            xImage = 0,
            yImage = 0;

        if (varW > varH) {
            wImage = Math.round(wDiv);
            hImage = Math.round(naturalHeight / varW);
            yImage = Math.round((hDiv - hImage) / 2);
        } else {
            wImage = Math.round(naturalWidth / varH);
            hImage = Math.round(hDiv);
            xImage = Math.round((wDiv - wImage) / 2);
        }

        return {
            w: wImage,
            h: hImage,
            x: xImage,
            y: yImage,
        };
    },

    drawImage: function (image, mData) {
        $(image).css({
            left: `${mData.x}px`,
            top: `${mData.y}px`,
            width: `${mData.w}px`,
            height: `${mData.h}px`,
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
};
