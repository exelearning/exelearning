/* eslint-disable no-undef */
/**
 * VideoQuExt iDevice (edition code)
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno, Francisco Javier Pulido
 * Testers: Ricardo Málaga Floriano, Francisco Muñoz de la Peña
 * Translator: Antonio Juan Delgado García
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    // i18n
    i18n: {
        name: _('Video test'),
    },
    idevicePath: '',
    msgs: {},
    classIdevice: 'quick-questions-video',
    active: 0,
    questionsGame: [],
    youtubeLoaded: false,
    player: '',
    localPlayer: '',
    timeUpdateInterval: '',
    timeVideoFocus: 0,
    durationVideo: 0,
    timeVIFocus: 0,
    changesSaved: false,
    inEdition: true,
    quextVersion: 2,
    videoType: 0,
    idVideoQuExt: '',
    startVideoQuExt: 0,
    endVideoQuExt: 0,
    pointStart: 0,
    pointEnd: 100000,
    videoLoading: false,
    id: false,
    ci18n: {},

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
    },

    refreshTranslations: function () {
        this.ci18n = {
            msgPlayStart: c_('Click here to play'),
            msgSubmit: c_('Submit'),
            msgGameOver: c_('Game Over!'),
            msgClue: c_('Cool! The clue is:'),
            msgNewGame: c_('Click here for a new game'),
            msgYouHas: c_('You have got %1 hits and %2 misses'),
            msgCodeAccess: c_('Access code'),
            msgInformationLooking: c_(
                'Cool! The information you were looking for'
            ),
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
            msgAnswer: c_('Answer'),
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
            msgClose: c_('Close'),
            msgOption: c_('Option'),
            msgRickText: c_('Rich Text'),
            msgUseFulInformation: c_(
                'and information that will be very useful'
            ),
            msgLoading: c_('Loading. Please wait...'),
            msgPoints: c_('points'),
            msgIndicateWord: c_('Provide a word or phrase'),
            msgReply: c_('Reply'),
            msgPauseVideo: c_('Pause video'),
            msgPreviewQuestions: c_('Preview questions'),
            msgReloadVideo: c_('Reload video'),
            msgQuestions: c_('Questions'),
            msgIndicateSolution: c_('Please write the solution'),
            msgSolution: c_('Solution'),
            msgFirstQuestion: c_('First question'),
            msgNextQuestion: c_('Next question'),
            msgPreviousQuestion: c_('Previous question'),
            msgLastQuestion: c_('Last question'),
            msgQuestionNumber: c_('Question number'),
            msgCorrect: c_('Correct'),
            msgIncorrect: c_('Incorrect'),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgTypeGame: c_('Video test'),
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
        msgs.msgEPoiIncorrect = _(
            'That second is not part of the video. Please check the video duration.'
        );
        msgs.msgEPointExist = _('There is already a question in that second.');
        msgs.msgTimeFormat = _('Please check the time format: hh:mm:ss');
        msgs.msgProvideSolution = _('Please write the solution');
        msgs.msgEDefintion = _(
            'Please provide the definition of the word or phrase'
        );
        msgs.msgProvideFB = _(
            'Write the message to be displayed when passing the game'
        );
        msgs.msgDuration = _(
            "The video's end time must be shorter than its total duration"
        );
        msgs.msgFormatVideo = _(
            'Use a YouTube URL or select a file (mp4, ogg, webm, mp3, wav)'
        );
        msgs.msgExportFileError = _(
            "Games with local videos or audios can't be exported"
        );
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.'
        );
        msgs.msgIDLenght = _(
            'The report identifier must have at least 5 characters'
        );
    },

    getId: function () {
        return Math.random().toString(36).slice(-8);
    },

    randomizeQuestions: function (id) {
        let active = 0;
        if ($exeDevice.questionsGame.length > 1) {
            $exeDevice.questionsGame.sort(function (a, b) {
                return parseFloat(a.pointVideo) - parseFloat(b.pointVideo);
            });
            for (let i = 0; i < $exeDevice.questionsGame.length; i++) {
                if ($exeDevice.questionsGame[i].id == id) {
                    active = i;
                }
            }
        }
        return active;
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
        $exeDevice.player = new YT.Player('vquextEVideo', {
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
        const $player = $('#vquextEVIURL');
        if ($player.length == 1) {
            const idv = $player.val().trim();
            if (idv !== '') $exeDevice.loadVideo(idv);
        }
    },

    youTubeReady: function () {
        if (typeof YT == 'undefined') return false;
        $('#vquextMediaVideo').prop('disabled', false);
        $exeDevice.player = new YT.Player('vquextEVideo', {
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
                onStateChange: $exeDevice.onPlayerStateChange,
            },
        });
    },

    onPlayerStateChange() {
        if ($exeDevice.videoType > 0) return;
        const lduration = Math.floor($exeDevice.player.getDuration());
        if (!isNaN(lduration) && lduration > 0) {
            $exeDevice.durationVideo = lduration;
            if (
                $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                    $('#vquextEVIEnd').val()
                ) == 0
            ) {
                const duration =
                    $exeDevices.iDevice.gamification.helpers.secondsToHour(
                        lduration
                    );
                $('#vquextEVIEnd').val(duration);
            }
        }
    },

    onPlayerReady: function () {
        if ($exeDevice.videoType > 0) return;

        $exeDevice.youtubeLoaded = true;
        const url = $('#vquextEVIURL').val(),
            idV = $exeDevices.iDevice.gamification.media.getIDYoutube(url);
        if (idV) {
            $exeDevice.initClock(0);
            $exeDevice.startVideo(
                url,
                $exeDevice.startVideoQuExt,
                $exeDevice.endVideoQuExt
            );
            $exeDevice.showPlayer();
            // Si no hay fin establecido y ya tenemos duración, fijarlo
            if (typeof $exeDevice.player.getDuration === 'function') {
                const lduration = Math.floor($exeDevice.player.getDuration());
                const currentEnd =
                    $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                        $('#vquextEVIEnd').val() || '00:00:00'
                    );
                if (!isNaN(lduration) && lduration > 0 && currentEnd === 0) {
                    const durationStr =
                        $exeDevices.iDevice.gamification.helpers.secondsToHour(
                            lduration
                        );
                    $('#vquextEVIEnd').val(durationStr);
                    $exeDevice.durationVideo = lduration;
                    $exeDevice.endVideoQuExt = lduration;
                }
            }
        }
    },

    updateProgressBar: function () {
        if ($exeDevice.videoType > 0) {
            $exeDevice.updateProgressBarLocal();
        } else {
            $exeDevice.updateProgressBarYT();
        }
    },

    onPlayerError: function () {
        //$exeDevice.showMessage("El video vquextdo no está disponible")
    },

    startVideo: function (url, start, end) {
        const mstart = start < 1 ? 0.1 : start;

        if ($exeDevice.videoType == 1) {
            $exeDevice.stopVideoYT();
            $exeDevice.startVideoLocal(url, mstart, end);
        } else if ($exeDevice.videoType == 2) {
            url = $exeDevice.extractURLGD(url);
            $exeDevice.stopVideoYT();
            $exeDevice.startVideoLocal(url, mstart, end);
        } else if ($exeDevice.videoType == 3) {
            url = $exeDevice.extractURLGD(url);
            $exeDevice.stopVideoYT();
            $exeDevice.startVideoLocal(url, mstart, end);
        } else {
            const id = $exeDevices.iDevice.gamification.media.getIDYoutube(url);
            $exeDevice.stopVideoLocal();
            $exeDevice.startVideoYT(id, mstart, end);
        }
    },

    stopVideo: function () {
        if ($exeDevice.videoType > 0) {
            $exeDevice.stopVideoLocal();
        } else {
            $exeDevice.stopVideoYT();
        }
    },

    muteVideo: function (mute) {
        mute = $exeDevice.videoType == 2 ? false : mute;
        if ($exeDevice.videoType > 0) {
            $exeDevice.muteVideoLocal(mute);
        } else {
            $exeDevice.muteVideoYT(mute);
        }
    },

    startVideoYT: function (id, start, end) {
        if ($exeDevice.player) {
            if (typeof $exeDevice.player.loadVideoById === 'function') {
                $exeDevice.player.loadVideoById({
                    videoId: id,
                    startSeconds: start,
                    endSeconds: end,
                });
            }
            $('#vquextEVITime').show();
        }
    },

    stopVideoYT: function () {
        if ($exeDevice.player) {
            if (typeof $exeDevice.player.pauseVideo === 'function')
                $exeDevice.player.stopVideo();
            if (typeof $exeDevice.player.clearVideo === 'function')
                $exeDevice.player.clearVideo();
        }
    },

    muteVideoYT: function (mute) {
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

    updateTimerDisplayYT: function () {
        if ($exeDevice.videoType == 0 && $exeDevice.player) {
            if (typeof $exeDevice.player.getCurrentTime === 'function') {
                const time =
                    $exeDevices.iDevice.gamification.helpers.secondsToHour(
                        $exeDevice.player.getCurrentTime()
                    );
                $('#vquextEVITime').text(time);
            }
            if (typeof $exeDevice.player.getDuration === 'function') {
                const lduration = Math.floor($exeDevice.player.getDuration());
                if (!isNaN(lduration) && lduration > 0) {
                    $exeDevice.durationVideo = lduration;
                    if ($exeDevice.endVideoQuExt < 1) {
                        $exeDevice.endVideoQuExt = $exeDevice.durationVideo;
                        const currentEnd =
                            $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                                $('#vquextEVIEnd').val() || '00:00:00'
                            );
                        if (currentEnd === 0) {
                            $('#vquextEVIEnd').val(
                                $exeDevices.iDevice.gamification.helpers.secondsToHour(
                                    $exeDevice.durationVideo
                                )
                            );
                        }
                    }
                }
            }
        }
    },

    updateProgressBarYT: function () {
        $('#progress-bar').val(
            ($eXeDevice.player.getCurrentTime() /
                $eXeDevice.player.getDuration()) *
                100
        );
    },

    startVideoLocal: function (url, start, end) {
        if ($exeDevice.localPlayer) {
            $exeDevice.pointEnd = end;
            $exeDevice.localPlayer.src = url;
            $exeDevice.localPlayer.currentTime = parseFloat(start);
            $exeDevice.localPlayer.play();
            $('#vquextEVITime').show();
        }
    },

    stopVideoLocal: function () {
        if (
            $exeDevice.localPlayer &&
            typeof $exeDevice.localPlayer.pause == 'function'
        ) {
            $exeDevice.localPlayer.pause();
        }
    },

    muteVideoLocal: function (mute) {
        if ($exeDevice.localPlayer) {
            $exeDevice.localPlayer.muted = mute;
        }
    },

    getDataVideoLocal: function () {
        if ($exeDevice.videoType > 0 && this.duration > 0) {
            $exeDevice.durationVideo = Math.floor(this.duration);
            const endVideo =
                $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                    $('#vquextEVIEnd').val()
                ) || 0;
            if (endVideo < 1) {
                const endStr =
                    $exeDevices.iDevice.gamification.helpers.secondsToHour(
                        $exeDevice.durationVideo
                    );
                $('#vquextEVIEnd').val(endStr);
                $exeDevice.endVideoQuExt = $exeDevice.durationVideo;
            }
        }
    },

    updateTimerDisplayLocal: function () {
        if (
            $exeDevice.videoType > 0 &&
            $exeDevice.localPlayer &&
            $exeDevice.localPlayer.currentTime
        ) {
            const currentTime = $exeDevice.localPlayer.currentTime,
                time = $exeDevices.iDevice.gamification.helpers.secondsToHour(
                    Math.floor(currentTime)
                );
            $('#vquextEVITime').text(time);
            if (
                Math.ceil(currentTime) == $exeDevice.pointEnd ||
                Math.ceil(currentTime) == $exeDevice.durationVideo
            ) {
                $exeDevice.localPlayer.pause();
                $exeDevice.pointEnd = 100000;
            }
        }
    },

    updateProgressBarLocal: function () {
        if ($exeDevice.localPlayer) {
            $('#progress-bar').val(
                (Math.round($exeDevice.localPlayer.currentTime) /
                    Math.round($exeDevice.localPlayer.duration)) *
                    100
            );
        }
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    addQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.clearQuestion();
            $exeDevice.questionsGame.push($exeDevice.getCuestionDefault());
            $exeDevice.active = $exeDevice.questionsGame.length - 1;
            $exeDevice.showPlayer();
            $('#vquextNumberQuestion').val($exeDevice.questionsGame.length);
            $('#vquextENumQuestions').text($exeDevice.questionsGame.length);
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

        $('#vquextENumQuestions').text($exeDevice.questionsGame.length);
        $('#vquextNumberQuestion').val($exeDevice.active + 1);
        $exeDevice.updateQuestionsNumber();
    },

    nextQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            const id = $exeDevice.questionsGame[$exeDevice.active].id,
                active = $exeDevice.randomizeQuestions(id);
            $exeDevice.active =
                active < $exeDevice.questionsGame.length - 1
                    ? active + 1
                    : $exeDevice.questionsGame.length - 1;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    lastQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            const id = $exeDevice.questionsGame[$exeDevice.active].id;
            $exeDevice.randomizeQuestions(id);
            $exeDevice.active = $exeDevice.questionsGame.length - 1;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    previousQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            const id = $exeDevice.questionsGame[$exeDevice.active].id,
                active = $exeDevice.randomizeQuestions(id);
            $exeDevice.active = active > 0 ? active - 1 : 0;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    firstQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            const id = $exeDevice.questionsGame[$exeDevice.active].id;
            $exeDevice.randomizeQuestions(id);
            $exeDevice.active = 0;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },
    updateQuestionsNumber: function () {
        let percentaje = parseInt(
            $exeDevice.removeTags($('#vquextEPercentajeQuestions').val())
        );
        if (isNaN(percentaje)) return;
        percentaje = Math.min(Math.max(percentaje, 1), 100);
        let num = Math.max(
            Math.round((percentaje * $exeDevice.questionsGame.length) / 100),
            1
        );
        $('#vquextENumeroPercentaje').text(
            `${num}/${$exeDevice.questionsGame.length}`
        );
    },

    showQuestion: function (i) {
        const {
            questionsGame,
            showTypeQuestion,
            showPlayer,
            stopVideo,
            showOptions,
            secondsToHour,
        } = $exeDevice;
        let num = Math.min(Math.max(i, 0), questionsGame.length - 1),
            p = questionsGame[num],
            numOptions = 0;

        p.typeQuestion = p.typeQuestion || 0;

        if (p.typeQuestion === 0) {
            $('.VDQXTE-EAnwersOptions').each(function (j) {
                numOptions++;
                if (p.options[j].trim()) {
                    p.numOptions = numOptions;
                }
                $(this).val(p.options[j]);
            });
            $('#vquextEQuestion').val(p.quextion);
            $('.VDQXTE-EAnwersOptions').each(function (j) {
                $(this).val(j < p.numOptions ? p.options[j] : '');
            });
        } else {
            $('#vquextESolutionWord').val(p.solutionQuestion);
            $('#vquextEDefinitionWord').val(p.quextion);
        }

        showTypeQuestion(p.typeQuestion);
        showPlayer();
        stopVideo();
        showOptions(p.numberOptions);

        $('#vquextENumQuestions').text(questionsGame.length);
        $('#vquextECheckSoundVideo').prop('checked', p.soundVideo === 1);
        $('#vquextECheckImageVideo').prop('checked', p.imageVideo === 1);
        $('#vquextEMessageKO').val(p.msgError);
        $('#vquextEMessageOK').val(p.msgHit);
        $('#vquextPoint').val(secondsToHour(p.pointVideo));
        $('#vquextNumberQuestion').val(i + 1);

        $(
            "input.VDQXTE-Number[name='vqxnumber'][value='" +
                p.numberOptions +
                "']"
        ).prop('checked', true);
        $(
            "input.VDQXTE-ESolution[name='vqxsolution'][value='" +
                p.solution +
                "']"
        ).prop('checked', true);
        $("input.VDQXTE-Times[name='vqxtime'][value='" + p.time + "']").prop(
            'checked',
            true
        );
        $(
            "input.VDQXTE-TypeQuestion[name='vquexttypequestion'][value='" +
                p.typeQuestion +
                "']"
        ).prop('checked', true);
    },

    playQuestionVideo: function () {
        if (!$exeDevice.validateQuestion()) {
            return;
        }

        $exeDevice.showPlayer();

        let pointStart = $exeDevice.hourToSeconds($('#vquextEVIStart').val()),
            pointEnd = $exeDevice.hourToSeconds($('#vquextPoint').val()),
            url = $('#vquextEVIURL').val(),
            id = $exeDevice.questionsGame[$exeDevice.active].id,
            active = $exeDevice.randomizeQuestions(id);

        $exeDevice.active = active;
        if (active > 0) {
            pointStart = $exeDevice.questionsGame[active - 1].pointVideo;
        }

        $exeDevice.showQuestion(active);
        $exeDevice.startVideo(url, pointStart, pointEnd);

        let imageVideo = $('#vquextECheckImageVideo').is(':checked'),
            soundVideo = $('#vquextECheckSoundVideo').is(':checked');

        if ($exeDevice.videoType !== 2) {
            $('#vquextENoImageVideo').toggle(!imageVideo);
            $exeDevice.muteVideo(!soundVideo);
        }
    },

    showPlayer: function () {
        const videoType = $exeDevice.videoType;

        $('.VDQXTE-EVIAudioLabel').toggle(videoType !== 2);
        $('#vquextENoImageVideo, #vquextECover, #vquextENoVideo').hide();

        if (videoType === 1 || videoType === 3) {
            $('#vquextEVideoLocal').show();
            $('#vquextEVideo').hide();
        } else if (videoType === 2) {
            $('#vquextEVideoLocal').show();
            $('#vquextEVideo, .VDQXTE-EVIAudioLabel').hide();
            $('#vquextENoImageVideo').show();
        } else {
            $('#vquextEVideoLocal').hide();
            $('#vquextEVideo').show();
        }
    },

    clearQuestion: function () {
        $exeDevice.showOptions(4);
        $exeDevice.showSolution(0);

        $('.VDQXTE-Times')[0].checked = true;
        $('.VDQXTE-Number')[2].checked = true;

        $('#vquextPoint, #vquextEInitVideo, #vquextEEndVideo').val('00:00:00');
        $('#vquextECheckSoundVideo, #vquextECheckImageVideo').prop(
            'checked',
            true
        );

        $(
            '#vquextEQuestion, #vquextESolutionWord, #vquextEDefinitionWord, #vquextEMessageOK, #vquextEMessageKO'
        ).val('');

        $('.VDQXTE-EAnwersOptions').val('');
    },

    hourToSeconds: function (str) {
        const parts = str.split(':').map(Number);
        return parts.length === 1
            ? parts[0]
            : parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
    },

    secondsToHour: function (totalSec) {
        totalSec = Math.round(totalSec);
        const hours = String(Math.floor(totalSec / 3600)).padStart(2, '0'),
            minutes = String(Math.floor((totalSec % 3600) / 60)).padStart(
                2,
                '0'
            ),
            seconds = String(totalSec % 60).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    },

    showOptions: function (number) {
        $('.VDQXTE-EOptionDiv').each(function (i) {
            $(this).toggle(i < number);
            if (i >= number) $exeDevice.showSolution(0);
        });
        $('.VDQXTE-EAnwersOptions').each(function (j) {
            $(this).val(j < number ? $(this).val() : '');
        });
    },

    showTypeQuestion: function (type) {
        $('input.VDQXTE-Number').prop('disabled', type === 1);
        $('#vquextEAnswers, #vquextEQuestionDiv').toggle(type === 0);
        $('#vquextEWordDiv').toggle(type === 1);
        $('#vquextSolutionWordDiv').toggle(type !== 0);
    },

    showSolution: function (solution) {
        $('.VDQXTE-ESolution').eq(solution).prop('checked', true);
    },

    createForm: function () {
        const path = $exeDevice.idevicePath,
            html = `
                <div id="vquextQEIdeviceForm">
                    <p class="exe-block-info exe-block-dismissible" style="position:relative">
                        ${_('Create activities consisting on a video with interactive questions.')} 
                        <a href="https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe29/vdeoquext.html" hreflang="es" target="_blank">${_('Usage Instructions')}</a>
                        <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                    </p>
                    <div class="exe-form-tab" title="${_('General settings')}">
                        ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Choose the right answer'))}
                        <fieldset class="exe-fieldset exe-fieldset-closed">
                            <legend><a href="#">${_('Options')}</a></legend>
                            <div>
                                <div class="toggle-item mb-3">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="vquextEShowMinimize" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="vquextEShowMinimize">${_('Show minimized.')}</label>
                                </div>
                                <div class="toggle-item mb-3">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="vquextEAnswersRamdon" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="vquextEAnswersRamdon">${_('Random options')}</label>
                                </div>
                                <div class="toggle-item mb-3">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="vquextECustomMessages" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="vquextECustomMessages">${_('Custom messages')}.</label>
                                </div>
                                <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                                    <div class="toggle-item">
                                        <span class="toggle-control">
                                            <input type="checkbox" id="vquextEShowSolution" class="toggle-input" checked />
                                            <span class="toggle-visual"></span>
                                        </span>
                                        <label class="toggle-label" for="vquextEShowSolution">${_('Show solutions')}.</label>
                                    </div>
                                    <label for="vquextETimeShowSolution" class="mb-0">${_('Show solution time (seconds)')}</label><input class="form-control" type="number" name="vquextETimeShowSolution" id="vquextETimeShowSolution" value="3" min="1" max="9" />
                                </div>
                                <div class="mb-3 d-flex align-items-center gap-2 flex-nowrap">
                                    <span>${_('Score')}:</span>
                                    <div class="d-flex align-items-center gap-2 flex-nowrap">
                                        <div class="form-check form-check-inline m-0">                                        
                                            <input class="form-check-input VDQXTE-TypeGame" checked="checked" id="vquextETypeActivity" type="radio" name="vqxtgamemode" value="1" />
                                            <label for="vquextETypeActivity">${_('From 0 to 10')}</label>
                                        </div>
                                        <div class="form-check form-check-inline m-0">
                                            <input class="form-check-input VDQXTE-TypeGame" id="vquextEGameMode" type="radio" name="vqxtgamemode" value="0" />
                                            <label for="vquextEGameMode">${_('Points and lives')}</label>
                                        </div>
                                        <div class="form-check form-check-inline m-0">
                                            <input class="form-check-input VDQXTE-TypeGame" id="vquextETypeReto" type="radio" name="vqxtgamemode" value="2" />
                                            <label for="vquextETypeReto">${_('No score')}</label>
                                        </div>
                                    </div>
                                    <a href="#vquextEGameModeHelp" id="vquextEGameModeHelpLnk" class="GameModeHelpLink" title="${_('Help')}"><img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}"/></a>
                                </div>
                                <div id="vquextEGameModeHelp" class="VDQXTE-TypeGameHelp exe-block-info pt-3">
                                    <ul>
                                        <li><strong>${_('From 0 to 10')}: </strong>${_('No lives, 0 to 10 score, right/wrong answers counter... A more educational context.')}</li>
                                        <li><strong>${_('Points and lives')}: </strong>${_('Just like a game: Aim for a high score (thousands of points) and try not to lose your lives.')}</li>
                                        <li><strong>${_('No score')}: </strong>${_('No score and no lives. You have to answer right to get some information (a feedback).')}</li>
                                    </ul>
                                </div>
                                <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                                    <div class="toggle-item mb-0">
                                        <span class="toggle-control">
                                            <input type="checkbox" id="vquextEUseLives" class="toggle-input" checked />
                                            <span class="toggle-visual"></span>
                                        </span>
                                        <label class="toggle-label" for="vquextEUseLives">${_('Use lives')}.</label>
                                    </div>
                                    <label for="vquextENumberLives" >${_('Number of lives')}:</label>
                                    <input class="form-control" type="number" name="vquextENumberLives" id="vquextENumberLives" value="3" min="1" max="5" />
                                </div>
                                <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                                    <div class="toggle-item mb-0">
                                        <span class="toggle-control">
                                            <input type="checkbox" id="vquextEHasFeedBack" class="toggle-input" />
                                            <span class="toggle-visual"></span>
                                        </span>
                                        <label class="toggle-label" for="vquextEHasFeedBack">${_('Feedback')}.</label>
                                    </div>
                                    <input class="form-control" type="number" name="vquextEPercentajeFB" id="vquextEPercentajeFB" value="100" min="5" max="100" step="5" disabled style="width: 9.5ch !important; max-width:9.5ch !important;"/>
                                    <label for="vquextEPercentajeFB" class="mb-0">${_('&percnt; right to see the feedback')}</label>
                                </div>
                                <div id="vquextEFeedbackP" class="VDQXTE-EFeedbackP mb-3">
                                    <textarea id="vquextEFeedBackEditor" class="exe-html-editor"></textarea>
                                </div>
                                <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                                    <div class="toggle-item mb-0">
                                        <span class="toggle-control">
                                            <input type="checkbox" id="vquextENavigable" class="toggle-input" />
                                            <span class="toggle-visual"></span>
                                        </span>
                                        <label class="toggle-label" for="vquextENavigable">${_('Navigable')}.</label>
                                    </div>
                                    <div class="toggle-item mb-0 d-none">
                                        <span class="toggle-control">
                                            <input type="checkbox" id="vquextERepeatQuestion" class="toggle-input" disabled />
                                            <span class="toggle-visual"></span>
                                        </span>
                                        <label class="toggle-label" for="vquextERepeatQuestion">${_('Repeat question')}.</label>
                                    </div>
                                </div>
                                <div class="VDQXTE-Flex mb-3 gap-3">
                                    <div class="toggle-item mb-0">
                                        <span class="toggle-control">
                                            <input type="checkbox" id="vquextEReloadQuestion" class="toggle-input" />
                                            <span class="toggle-visual"></span>
                                        </span>
                                        <label class="toggle-label" for="vquextEReloadQuestion">${_('Reload video')}.</label>
                                    </div>
                                    <div class="toggle-item mb-0">
                                        <span class="toggle-control">
                                            <input type="checkbox" id="vquextEPreviewQuestions" class="toggle-input" />
                                            <span class="toggle-visual"></span>
                                        </span>
                                        <label class="toggle-label" for="vquextEPreviewQuestions">${_('Preview questions')}.</label>
                                    </div>
                                    <div class="toggle-item mb-0">
                                        <span class="toggle-control">
                                            <input type="checkbox" id="vquextEPauseVideo" class="toggle-input" />
                                            <span class="toggle-visual"></span>
                                        </span>
                                        <label class="toggle-label" for="vquextEPauseVideo">${_('Pause video')}.</label>
                                    </div>
                                </div>
                                <div class="mb-3 d-none align-items-center gap-2 flex-nowrap">
                                    <label for="vquextEAuthor">${_('Authorship')}: </label><input id="vquextEAuthor" class="form-control" type="text" />
                                </div>
                                <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                                    <label for="vquextEPercentajeQuestions" class="mb-0">%${_('Questions')}:</label><input class="form-control" type="number" name="vquextEPercentajeQuestions" id="vquextEPercentajeQuestions" value="100" min="1" max="100" style="width: 9.5ch !important; max-width:9.5ch !important;"/>
                                    <span id="vquextENumeroPercentaje">1/1</span>
                                </div>
                                <div class="toggle-item mb-3">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="vquextEModeBoard" class="toggle-input" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="vquextEModeBoard">${_('Digital whiteboard mode')}</label>
                                </div>
                                <div class="d-flex align-items-center gap-2 mb-3">
                                    <label for="vquextEGlobalTimes">${_('Time per question')}:</label>
                                    <select id="vquextEGlobalTimes" class="form-select form-select-sm" style="max-width:10ch">
                                        <option value="0" selected>15s</option>
                                        <option value="1">30s</option>
                                        <option value="2">1m</option>
                                        <option value="3">3m</option>
                                        <option value="4">5m</option>
                                        <option value="5">10m</option>
                                    </select>
                                    <button id="vquextGlobalTimeButton" class="btn btn-primary" type="button">${_('Accept')}</button> 
                                </div>
                                <div class="d-flex align-items-center gap-2 mb-3 flex-nowrap">
                                    <div class="toggle-item mb-0">
                                        <span class="toggle-control">
                                            <input type="checkbox" id="vquextEEvaluation" class="toggle-input" />
                                            <span class="toggle-visual"></span>
                                        </span>
                                        <label class="toggle-label" for="vquextEEvaluation">${_('Progress report')}.</label>
                                    </div>
                                    <div class="d-flex align-items-center flex-nowrap gap-2">
                                           <label for="vquextEEvaluationID">${_('Identifier')}:</label>
                                           <input type="text" class="form-control" id="vquextEEvaluationID" disabled value="${eXeLearning.app.project.odeId || ''}"/>
                                    </div>
                                    <a href="#vquextEEvaluationHelp" id="vquextEEvaluationHelpLnk" title="${_('Help')}">
                                        <img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}"/>
                                    </a>  
                                </div>
                                <p id="vquextEEvaluationHelp" class="VDQXTE-TypeGameHelp exe-block-info">
                                    ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                                </p>
                            </div>
                        </fieldset>
                        <fieldset class="exe-fieldset">
                            <legend><a href="#">${_('Questions')}</a></legend>
                                <div class="VDQXTE-EPanel" id="vquextEPanel">
                                    <div class="d-flex align-items-center mb-0 flex-nowrap gap-2">                                    
                                        <label for="vquextEVIURL">URL:</label>
                                        <input type="text" id="vquextEVIURL" class="exe-file-picker w-100 form-control me-0"  mt-3/>
                                        <a href="#" id="vquextEPlayStart" class="VDQXTE-ENavigationButton VDQXTE-EPlayVideo" title="${_('Play video')}"><img src="${path}quextIEPlay.png" alt="${_('Play')}" class="VDQXTE-EButtonImage" /></a>
                                        <label for="vquextEVIStart">${_('Start')}:</label>
                                        <input id="vquextEVIStart" class="form-control VDQXTE-EVideoX " type="text" value="00:00:00" maxlength="8" />
                                        <label for="vquextEVIEnd">${_('End')}:</label>
                                        <input id="vquextEVIEnd" class="form-control VDQXTE-EVideoX " type="text" value="00:00:00" maxlength="8"/>
                                    </div>
                                    <div class="VDQXTE-EOptionsMedia">
                                        <div class="VDQXTE-EOptionsGame">
                                            <div class="d-flex align-items-center mb-3 flex-nowrap gap-2">
                                                <span>${_('Type')}:</span>
                                                <div class="d-flex align-items-center gap-2 flex-nowrap">
                                                    <div class="form-check form-check-inline m-0">
                                                        <input class="VDQXTE-TypeQuestion form-check-input" checked id="vquextTypeTest" type="radio" name="vquexttypequestion" value="0"/>
                                                        <label for="vquextTypeTest">${_('Test')}</label>
                                                    </div>
                                                    <div class="form-check form-check-inline m-0">
                                                        <input class="VDQXTE-TypeQuestion form-check-input" id="vquextTypeWord" type="radio" name="vquexttypequestion" value="1"/>
                                                        <label for="vquextTypeWord">${_('Word')}</label>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="d-flex align-items-center mb-3 flex-nowrap gap-2">
                                                <span>${_('Question point')}:</span>

                                                <div class="d-flex align-items-center flex-nowrap gap-2">
                                                    <label class="sr-av" for="vquextPoint">${_('Question point')}</label>
                                                    <input id="vquextPoint" class="form-control" type="text" value="00:00:00" maxlength="8" style="width:12ch; max-width:12ch; text-align:center"/>
                                                </div>
                                            </div>
                                            <div class="d-flex align-items-center mb-3 flex-nowrap gap-2">   
                                                <span>${_('Options Number')}:</span>
                                                <div class="d-flex align-items-center gap-2 flex-nowrap">
                                                    <div class="form-check form-check-inline m-0">
                                                        <input class="VDQXTE-Number form-check-input" id="numQ2" type="radio" name="vqxnumber" value="2"/>
                                                        <label for="numQ2">2</label>
                                                    </div>
                                                    <div class="form-check form-check-inline m-0">
                                                        <input class="VDQXTE-Number form-check-input" id="numQ3" type="radio" name="vqxnumber" value="3"/>
                                                        <label for="numQ3">3</label>
                                                    </div>
                                                    <div class="form-check form-check-inline m-0">
                                                        <input class="VDQXTE-Number form-check-input" id="numQ4" type="radio" name="vqxnumber" value="4" checked="checked"/>
                                                        <label for="numQ4">4</label>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="d-flex align-items-center mb-3 flex-nowrap gap-2">
                                                <span>${_('Time per question')}:</span>
                                                <div class="d-flex align-items-center gap-2 flex-nowrap">
                                                    <div class="form-check form-check-inline m-0">
                                                        <input class="VDQXTE-Times form-check-input" checked="checked" id="q15s" type="radio" name="vqxtime" value="0"/>
                                                        <label for="q15s">15s</label>
                                                    </div>
                                                    <div class="form-check form-check-inline m-0">
                                                        <input class="VDQXTE-Times form-check-input" id="q30s" type="radio" name="vqxtime" value="1"/>
                                                        <label for="q30s">30s</label>
                                                    </div>
                                                    <div class="form-check form-check-inline m-0">
                                                        <input class="VDQXTE-Times form-check-input" id="q1m" type="radio" name="vqxtime" value="2"/>
                                                        <label for="q1m">1m</label>
                                                    </div>
                                                    <div class="form-check form-check-inline m-0">                                            
                                                        <input class="VDQXTE-Times form-check-input" id="q3m" type="radio" name="vqxtime" value="3"/>
                                                        <label for="q3m">3m</label>
                                                    </div>
                                                    <div class="form-check form-check-inline m-0">
                                                        <input class="VDQXTE-Times form-check-input" id="q5m" type="radio" name="vqxtime" value="4"/>
                                                        <label for="q5m">5m</label>
                                                    </div>
                                                    <div class="form-check form-check-inline m-0">
                                                        <input class="VDQXTE-Times form-check-input" id="q10m" type="radio" name="vqxtime" value="5"/>
                                                        <label for="q10m">10m</label>
                                                    </div>
                                                </div>                                           
                                            </div>
                                            <div class="toggle-item mb-3">
                                                <span class="toggle-control">
                                                    <input id="vquextECheckSoundVideo" type="checkbox" class="toggle-input" checked="checked" />
                                                    <span class="toggle-visual"></span>
                                                </span>
                                                <label class="toggle-label" for="vquextECheckSoundVideo">${_('Audio')}</label>
                                            </div>
                                            <div class="toggle-item mb-3">
                                                <span class="toggle-control">
                                                    <input id="vquextECheckImageVideo" type="checkbox" class="toggle-input" checked="checked" />
                                                    <span class="toggle-visual"></span>
                                                </span>
                                                <label class="toggle-label" for="vquextECheckImageVideo">${_('Image')}</label>
                                            </div>
                                            <div class="d-flex align-items-center mb-3 flex-nowrap gap-2">
                                                <label>${_('Preview question')}:</label>
                                                <a href="#" id="vquextEPlayVideo" class="VDQXTE-ENavigationButton VDQXTE-EPlayVideo" title="${_('Play video')}"><img src="${path}quextIEPlay.png" alt="${_('Play')}" class="VDQXTE-EButtonImage"/></a>
                                            </div>
                                        </div>
                                        <div class="VDQXTE-EMultiMediaOption">
                                            <div class="VDQXTE-EProgressBar" id="vquextEProgressBar">
                                                <div class="VDQXTE-EInterBar" id="vquextEInterBar"></div>
                                            </div>
                                            <div class="VDQXTE-EMultiVideoQuExt VDQXTE-Flex mb-1" id="vquextEMultimedia">
                                                <img class="VDQXTE-EMedia" src="${path}quextIENoImageVideo.png" id="vquextENoImageVideo" alt="" />
                                                <div class="VDQXTE-EMedia" id="vquextEVideo"></div>
                                                <video class="VDQXTE-EMedia" id="vquextEVideoLocal" preload="auto" controls></video>
                                                <img class="VDQXTE-EMedia" src="${path}quextIENoVideo.png" id="vquextENoVideo" alt="" />
                                                <img class="VDQXTE-EMedia" src="${path}quextECoverVideoQuExt.png" id="vquextECover" alt="${_('No image')}" />
                                            </div>
                                            <div class="VDQXTE-EMultimediaData" id="vquextEMultimediaData">
                                                <button class="btn btn-primary" id="vquextEVITime" type="button">00:00:00</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="VDQXTE-EContents mb-3">
                                        <div class="VDQXTE-EQuestionDiv" id="vquextEQuestionDiv">
                                            <label class="sr-av" for="vquextEQuestion">${_('Question')}:</label>
                                            <input type="text" class="VDQXTE-EQuestion form-control" id="vquextEQuestion">
                                        </div>
                                        <div class="VDQXTE-EAnswers" id="vquextEAnswers">
                                            <div class="VDQXTE-EOptionDiv gap-2">
                                                <label class="sr-av" for="vquextESolution0">${_('Solution')} A:</label><input type="radio" class="VDQXTE-ESolution form-check-input" name="vqxsolution" id="vquextESolution0" value="0" checked="checked"/>
                                                <label class="sr-av" for="vquextEOption0">${_('Option')} A:</label><input type="text" class="VDQXTE-EOption0 VDQXTE-EAnwersOptions form-control" id="vquextEOption0">
                                            </div>
                                            <div class="VDQXTE-EOptionDiv gap-2">
                                                <label class="sr-av" for="vquextESolution1">${_('Solution')} B:</label><input type="radio" class="VDQXTE-ESolution form-check-input" name="vqxsolution" id="vquextESolution1" value="1"/>
                                                <label class="sr-av" for="vquextEOption1">${_('Option')} B:</label><input type="text" class="VDQXTE-EOption1 VDQXTE-EAnwersOptions form-control" id="vquextEOption1">
                                            </div>
                                            <div class="VDQXTE-EOptionDiv gap-2">
                                                <label class="sr-av" for="vquextESolution2">${_('Solution')} C:</label><input type="radio" class="VDQXTE-ESolution form-check-input" name="vqxsolution" id="vquextESolution2" value="2"/>
                                                <label class="sr-av" for="vquextEOption2">${_('Option')} C:</label><input type="text" class="VDQXTE-EOption2 VDQXTE-EAnwersOptions form-control" id="vquextEOption2">
                                            </div>
                                            <div class="VDQXTE-EOptionDiv gap-2">
                                                <label class="sr-av" for="vquextESolution3">${_('Solution')} D:</label><input type="radio" class="VDQXTE-ESolution form-check-input" name="vqxsolution" id="vquextESolution3" value="3"/>
                                                <label class="sr-av" for="vquextEOption3">${_('Option')} D:</label><input type="text" class="VDQXTE-EOption3 VDQXTE-EAnwersOptions form-control" id="vquextEOption3">
                                            </div>
                                        </div>
                                        <div class="VDQXTE-EWordDiv mb-3" id="vquextEWordDiv">
                                            <div class="VDQXTE-ESolutionWord d-flex align-items-center flex-nowrap gap-2 mb-3">
                                                <label for="vquextESolutionWord">${_('Word/Phrase')}:</label>
                                                <input type="text" class="form-control" id="vquextESolutionWord"/>
                                            </div>
                                            <div class="VDQXTE-ESolutionWord d-flex align-items-center flex-nowrap gap-2 mb-3">
                                                <label for="vquextEDefinitionWord">${_('Definition')}:</label>
                                                <input type="text" class="form-control" id="vquextEDefinitionWord"/>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="VDQXTE-EOrders" id="vquextEOrder">
                                        <div class="VDQXTE-ECustomMessage">
                                            <span class="sr-av">${_('Hit')}</span><span class="VDQXTE-EHit"></span>
                                            <label for="vquextEMessageOK">${_('Message')}:</label>
                                            <input type="text" class="form-control" id="vquextEMessageOK">
                                        </div>
                                        <div class="VDQXTE-ECustomMessage">
                                            <span class="sr-av">${_('Error')}</span><span class="VDQXTE-EError"></span>
                                            <label for="vquextEMessageKO">${_('Message')}:</label>
                                            <input type="text" class="form-control" id="vquextEMessageKO">
                                        </div>
                                    </div>
                                    <div class="VDQXTE-ENavigationButtons gap-1">
                                        <a href="#" id="vquextEAdd" class="VDQXTE-ENavigationButton" title="${_('Add question')}"><img src="${path}quextIEAdd.png" alt="${_('Add question')}" class="VDQXTE-EButtonImage"/></a>
                                        <a href="#" id="vquextEFirst" class="VDQXTE-ENavigationButton" title="${_('First question')}"><img src="${path}quextIEFirst.png" alt="${_('First question')}" class="VDQXTE-EButtonImage"/></a>
                                        <a href="#" id="vquextEPrevious" class="VDQXTE-ENavigationButton" title="${_('Previous question')}"><img src="${path}quextIEPrev.png" alt="${_('Previous question')}" class="VDQXTE-EButtonImage"/></a>
                                        <label class="sr-av" for="vquextNumberQuestion">${_('Question number:')}:</label><input type="text" class="VDQXTE-NumberQuestion form-control" id="vquextNumberQuestion" value="1"/>
                                        <a href="#" id="vquextENext" class="VDQXTE-ENavigationButton" title="${_('Next question')}"><img src="${path}quextIENext.png" alt="${_('Next question')}" class="VDQXTE-EButtonImage"/></a>
                                        <a href="#" id="vquextELast" class="VDQXTE-ENavigationButton" title="${_('Last question')}"><img src="${path}quextIELast.png" alt="${_('Last question')}" class="VDQXTE-EButtonImage"/></a>
                                        <a href="#" id="vquextEDelete" class="VDQXTE-ENavigationButton" title="${_('Delete question')}"><img src="${path}quextIEDelete.png" alt="${_('Delete question')}" class="VDQXTE-EButtonImage"/></a>
                                    </div>
                                    <div class="VDQXTE-ENumQuestionDiv" id="vquextENumQuestionDiv">
                                        <div class="VDQXTE-ENumQ"><span class="sr-av">${_('Number of questions:')}</span></div> <span class="VDQXTE-ENumQuestions" id="vquextENumQuestions">0</span>
                                    </div>
                                </div>
                        </fieldset>
                         ${$exeDevicesEdition.iDevice.common.getTextFieldset('after')}
                    </div>
                    ${$exeDevicesEdition.iDevice.gamification.itinerary.getTab()}
                    ${$exeDevicesEdition.iDevice.gamification.scorm.getTab()}
                    ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
                </div>
            `;
        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('vquextQEIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();
        $exeDevice.enableForm();
    },

    initQuestions: function () {
        $('#vquextEInputOptionsImage').css('display', 'flex');
        $('#vquextEInputVideo').css('display', 'flex');
        $('#vquextMediaNormal').prop('disabled', false);
        $('#vquextMediaImage').prop('disabled', false);
        $('#vquextMediaText').prop('disabled', false);
        $('#vquextSolutionWordDiv').hide();
        $('#vquextERepeatQuestion').hide();
        $('label[for="vquextERepeatQuestion"]').hide();

        if ($exeDevice.questionsGame.length == 0) {
            const question = $exeDevice.getCuestionDefault();
            $exeDevice.questionsGame.push(question);
            this.showOptions(4);
            this.showSolution(0);
        }
        $exeDevice.localPlayer = document.getElementById('vquextEVideoLocal');
        $exeDevice.showTypeQuestion(0);
        this.active = 0;
    },

    getCuestionDefault: function () {
        return {
            id: $exeDevice.getId(),
            typeQuestion: 0,
            type: 3,
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
            solutionWord: '',
            hit: -1,
            error: -1,
            msgHit: '',
            msgError: '',
        };
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;
        if (originalHTML && Object.keys(originalHTML).length > 0) {
            $exeDevice.active = 0;

            const wrapper = $('<div></div>').html(originalHTML);
            let json = $('.vquext-DataGame', wrapper).text(),
                version = $('.vquext-version', wrapper).text(),
                videoLink = $('.vquext-LinkLocalVideo', wrapper).attr('href');

            if (version.length === 1) {
                json = $exeDevices.iDevice.gamification.helpers.decrypt(json);
            }

            const dataGame =
                $exeDevices.iDevice.gamification.helpers.isJsonString(json);
            dataGame.modeBoard = dataGame.modeBoard ?? false;
            $exeDevice.active = 0;
            $exeDevice.questionsGame = dataGame.questionsGame;

            $exeDevice.questionsGame.forEach((question) => {
                question.id = $exeDevice.getId();
            });

            if (dataGame.videoType > 0) {
                dataGame.idVideoQuExt = videoLink;
            }

            let instructions = $('.vquext-instructions', wrapper);
            if (instructions.length === 1) {
                instructions = instructions.html() || '';
                $('#eXeGameInstructions').val(instructions);
            }

            let textFeedBack = $('.vquext-feedback-game', wrapper);
            if (textFeedBack.length === 1) {
                textFeedBack = textFeedBack.html() || '';
                $('#vquextEFeedBackEditor').val(textFeedBack);
            }

            let textAfter = $('.vquext-extra-content', wrapper);
            if (textAfter.length === 1) {
                textAfter = textAfter.html() || '';
                $('#eXeIdeviceTextAfter').val(textAfter);
            }

            $exeDevicesEdition.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs
            );
            $exeDevice.updateFieldGame(dataGame);

            if ($exeDevice.videoType > 0) {
                $exeDevice.initClock(dataGame.videoType);
                $exeDevice.showPlayer();
            } else {
                $exeDevice.loadYoutubeApi();
            }
        }
    },

    validTime: function (time) {
        const reg = /^([01]?\d|2[0-3]):([0-5]?\d):([0-5]?\d)$/;
        return reg.test(time);
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
        game.authorVideo =
            typeof game.authorVideo != 'undefined' ? game.authorVideo : '';
        game.customMessages =
            typeof game.customMessages == 'undefined'
                ? false
                : game.customMessages;
        game.videoType =
            typeof game.videoType == 'undefined' ? 0 : game.videoType;
        game.isNavigable =
            typeof game.isNavigable == 'undefined' ? false : game.isNavigable;
        game.repeatQuestion =
            typeof game.repeatQuestion == 'undefined'
                ? false
                : game.repeatQuestion;
        game.percentajeQuestions =
            typeof game.percentajeQuestions == 'undefined'
                ? 100
                : game.percentajeQuestions;
        game.evaluation =
            typeof game.evaluation != 'undefined' ? game.evaluation : false;
        game.evaluationID =
            typeof game.evaluationID != 'undefined' ? game.evaluationID : '';
        game.globalTime =
            typeof game.globalTime != 'undefined' ? game.globalTime : 0;
        game.weighted =
            typeof game.weighted !== 'undefined' ? game.weighted : 100;
        $exeDevice.id = $exeDevice.getIdeviceID();

        $('#vquextEShowMinimize').prop('checked', game.showMinimize);
        $('#vquextEAnswersRamdon').prop('checked', game.answersRamdon);
        $('#vquextEReloadQuestion').prop('checked', game.reloadQuestion);
        $('#vquextEPreviewQuestions').prop('checked', game.previewQuestions);
        $('#vquextEPauseVideo').prop('checked', game.pauseVideo);
        $('#vquextEUseLives').prop('checked', game.useLives);
        $('#vquextENumberLives').val(game.numberLives);
        $('#vquextEPercentajeQuestions').val(game.percentajeQuestions || 100);
        $('#vquextEVideoIntro').val(game.idVideoQuExt);
        $('#vquextEShowSolution').prop('checked', game.showSolution);
        $('#vquextETimeShowSolution').val(game.timeShowSolution);
        $('#vquextETimeShowSolution').prop('disabled', !game.showSolution);
        $('#vquextENumberLives').prop('disabled', !game.useLives);
        $('#vquextEVIURL').val(game.idVideoQuExt);
        $('#vquextEVIEnd').val(
            $exeDevices.iDevice.gamification.helpers.secondsToHour(
                game.endVideoQuExt
            )
        );
        $('#vquextEVIStart').val(
            $exeDevices.iDevice.gamification.helpers.secondsToHour(
                game.startVideoQuExt
            )
        );
        $('#vquextEHasFeedBack').prop('checked', game.feedBack);
        $('#vquextEPercentajeFB').val(game.percentajeFB);
        $(
            "input.VDQXTE-TypeGame[name='vqxtgamemode'][value='" +
                game.gameMode +
                "']"
        ).prop('checked', true);
        $('#vquextEUseLives').prop('disabled', game.gameMode != 0);
        $('#vquextENumberLives').prop(
            'disabled',
            game.gameMode != 0 && !game.useLives
        );
        $('#vquextECustomMessages').prop('checked', game.customMessages);
        $('#vquextEAuthor').val(game.authorVideo);
        $('#vquextENavigable').prop('checked', game.isNavigable);
        $('#vquextERepeatQuestion').prop('checked', game.repeatQuestion);
        $('#vquextERepeatQuestion').prop('disabled', !game.isNavigable);
        $('#vquextEModeBoard').prop('checked', game.modeBoard);
        $('#vquextEEvaluation').prop('checked', game.evaluation);
        $('#vquextEEvaluationID').val(game.evaluationID);
        $('#vquextEEvaluationID').prop('disabled', !game.evaluation);
        $('#vquextEGlobalTimes').val(game.globalTime);

        $exeDevice.updateGameMode(game.gameMode, game.feedBack, game.useLives);
        $exeDevice.showSelectOrder(game.customMessages);
        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity
        );
        $exeDevice.showQuestion($exeDevice.active);
        $exeDevice.videoType =
            typeof game.videoType == 'undefined' ? 0 : game.videoType;
        $exeDevice.idVideoQuExt = game.idVideoQuExt;
        $exeDevice.endVideoQuExt = game.endVideoQuExt;
        $exeDevice.startVideoQuExt = game.startVideoQuExt;
        $exeDevice.pointStart = game.startVideoQuExt;
        $exeDevice.pointEnd = game.endVideoQuExt;
        $exeDevice.videoType = game.videoType;

        for (let i = 0; i < game.questionsGame.length; i++) {
            game.questionsGame[i].msgHit =
                typeof game.questionsGame[i].msgHit == 'undefined'
                    ? ''
                    : game.questionsGame[i].msgHit;
            game.questionsGame[i].msgError =
                typeof game.questionsGame[i].msgError == 'undefined'
                    ? ''
                    : game.questionsGame[i].msgError;
        }
        $('#vquextENumQuestions').text($exeDevice.questionsGame.length);
        $('#vquextNumberQuestion').val($exeDevice.active + 1);
        if (game.videoType > 0) {
            $('#vquextEVideo').hide();
            $('#vquextEVideoLocal').show();
        } else {
            $('#vquextEVideo').show();
            $('#vquextEVideoLocal').hide();
        }
        $exeDevice.updateQuestionsNumber();
    },

    updateGameMode: function (gamemode, feedback, useLives) {
        $('#vquextEUseLives, #vquextENumberLives, #vquextEPercentajeFB').prop(
            'disabled',
            true
        );
        $('#vquextEHasFeedBack')
            .prop('disabled', gamemode === 2)
            .prop('checked', feedback);

        if (gamemode === 2 || feedback) {
            $('#vquextEFeedbackP').slideDown();
            $('#vquextEPercentajeFB').prop('disabled', false);
        } else {
            $('#vquextEFeedbackP').slideUp();
        }

        if (gamemode === 0) {
            $('#vquextEUseLives').prop('disabled', false);
            $('#vquextENumberLives').prop('disabled', !useLives);
        }
    },

    getIDMediaTeca: function (url) {
        if (url) {
            let matc =
                url.indexOf('https://mediateca.educa.madrid.org/video/') != -1;
            if (matc) {
                let id = url
                    .split('https://mediateca.educa.madrid.org/video/')[1]
                    .split('?')[0];
                return id;
            } else {
                return false;
            }
        } else {
            return false;
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

        clearInterval($exeDevice.timeUpdateInterval);
        $exeDevice.timeUpdateInterval = null;
        $exeDevice.localPlayer.removeEventListener(
            'timeupdate',
            $exeDevice.timeUpdateVideoLocal,
            false
        );
        $exeDevice.localPlayer.removeEventListener(
            'loadedmetadata',
            $exeDevice.getDataVideoLocal
        );

        $exeDevice.changesSaved = true;

        const i18n = { ...this.ci18n };
        for (const i in i18n) {
            const fVal = $(`#ci18n_${i}`).val();
            if (fVal !== '') i18n[i] = fVal;
        }
        dataGame.msgs = i18n;

        const json = JSON.stringify(dataGame),
            linkVideo = $exeDevice.createLinkVideoLocal(),
            instructions =
                tinyMCE.get('eXeGameInstructions').getContent() || '',
            textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent() || '',
            textFeedBack =
                tinyMCE.get('vquextEFeedBackEditor').getContent() || '';

        let html = '<div class="vquext-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        if (instructions)
            html += `<div class="vquext-instructions">${instructions}</div>`;
        html += `<div class="vquext-version js-hidden">${$exeDevice.quextVersion}</div>`;
        html += `<div class="vquext-DataGame js-hidden">${$exeDevices.iDevice.gamification.helpers.encrypt(json)}</div>`;
        if (textAfter)
            html += `<div class="vquext-extra-content">${textAfter}</div>`;
        if (textFeedBack)
            html += `<div class="vquext-feedback-game">${textFeedBack}</div>`;

        html += linkVideo;
        html += `<div class="vquext-bns js-hidden">${$exeDevice.msgs.msgNoSuportBrowser}</div>`;
        html += '</div>';

        return html;
    },

    createLinkVideoLocal: function () {
        const url =
            $exeDevice.videoType > 0 ? $('#vquextEVIURL').val().trim() : '#';
        return `<a href="${url}" class="js-hidden vquext-LinkLocalVideo">0</a>`;
    },

    validateQuestion: function () {
        let message = '',
            msgs = $exeDevice.msgs,
            videoType = $exeDevice.videoType,
            questionsGame = $exeDevice.questionsGame,
            active = $exeDevice.active,
            p = {},
            idVideoQuExt = $('#vquextEVIURL').val().trim(),
            startVideoQuExt =
                $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                    $('#vquextEVIStart').val()
                ),
            endVideoQuExt =
                $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                    $('#vquextEVIEnd').val()
                ),
            validExtAudio = ['mp3', 'wav'],
            validExt = ['mp4', 'ogg', 'webm', 'ogv'],
            extension = idVideoQuExt.split('.').pop().toLowerCase(),
            isVideoLocal =
                validExt.includes(extension) ||
                idVideoQuExt.toLowerCase().includes('google.com/videoplayback'),
            isAudio =
                validExtAudio.includes(extension) ||
                (idVideoQuExt
                    .toLowerCase()
                    .startsWith('https://drive.google.com') &&
                    idVideoQuExt.toLowerCase().includes('sharing')),
            isMediaTeca = idVideoQuExt.startsWith(
                'https://mediateca.educa.madrid.org/'
            );

        if (
            (videoType === 0 &&
                !$exeDevices.iDevice.gamification.media.getIDYoutube(
                    idVideoQuExt
                )) ||
            (videoType === 1 && !isVideoLocal) ||
            (videoType === 2 && !isAudio) ||
            (videoType === 3 && !isMediaTeca)
        ) {
            $exeDevice.showMessage(msgs.msgFormatVideo);
            return false;
        } else if (
            !$exeDevice.validTime($('#vquextEVIStart').val()) ||
            !$exeDevice.validTime($('#vquextEVIEnd').val())
        ) {
            $exeDevice.showMessage(msgs.msgTimeFormat);
            return false;
        } else if (startVideoQuExt >= endVideoQuExt) {
            $exeDevice.showMessage(msgs.msgEStartEndIncorrect);
            return false;
        }

        p.id = questionsGame[active].id;
        p.type = 3;
        p.pointVideo = $exeDevices.iDevice.gamification.helpers.hourToSeconds(
            $('#vquextPoint').val()
        );
        p.time = parseInt($('input[name=vqxtime]:checked').val());
        p.numberOptions = parseInt($('input[name=vqxnumber]:checked').val());
        p.x = 0;
        p.y = 0;
        p.author = '';
        p.alt = '';
        p.url = '';
        p.msgHit = $('#vquextEMessageOK').val();
        p.msgError = $('#vquextEMessageKO').val();
        p.soundVideo = $('#vquextECheckSoundVideo').is(':checked') ? 1 : 0;
        p.imageVideo = $('#vquextECheckImageVideo').is(':checked') ? 1 : 0;
        p.iVideo = 0;
        p.fVideo = 0;
        p.eText = '';
        p.typeQuestion = parseInt(
            $('input[name=vquexttypequestion]:checked').val()
        );
        p.quextion =
            p.typeQuestion === 1
                ? $('#vquextEDefinitionWord').val().trim()
                : $('#vquextEQuestion').val().trim();
        p.options = [];
        p.solution = parseInt($('input[name=vqxsolution]:checked').val());
        p.solutionQuestion = $('#vquextESolutionWord').val();

        let optionEmpty = false;
        $('.VDQXTE-EAnwersOptions').each(function (i) {
            const option = $(this).val().trim();
            if (i < p.numberOptions && option.length === 0) {
                optionEmpty = true;
            }
            p.options.push(option);
        });

        if (!$exeDevice.validTime($('#vquextPoint').val())) {
            message = msgs.msgTimeFormat;
        } else if (
            p.pointVideo <= startVideoQuExt ||
            p.pointVideo >= endVideoQuExt
        ) {
            message = msgs.msgEPoiIncorrect;
        } else if (
            p.typeQuestion === 1 &&
            p.solutionQuestion.trim().length === 0
        ) {
            message = msgs.msgEProvideWord;
        } else if (p.quextion.length === 0) {
            message =
                p.typeQuestion === 1
                    ? msgs.msgEDefintion
                    : msgs.msgECompleteQuestion;
        } else if (p.typeQuestion === 0 && optionEmpty) {
            message = msgs.msgECompleteAllOptions;
        }

        if (message.length === 0) {
            questionsGame[active] = p;
            return true;
        } else {
            $exeDevice.showMessage(message);
            return false;
        }
    },

    getIdeviceID: function () {
        const ideviceid =
            $('#vquextQEIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';

        return ideviceid;
    },

    validateData: function () {
        const clear = $exeDevice.removeTags,
            instructionsExe = escape(
                tinyMCE.get('eXeGameInstructions').getContent()
            ),
            textAfter = escape(tinyMCE.get('eXeIdeviceTextAfter').getContent()),
            textFeedBack = escape(
                tinyMCE.get('vquextEFeedBackEditor').getContent()
            ),
            showMinimize = $('#vquextEShowMinimize').is(':checked'),
            answersRamdon = $('#vquextEAnswersRamdon').is(':checked'),
            reloadQuestion = $('#vquextEReloadQuestion').is(':checked'),
            previewQuestions = $('#vquextEPreviewQuestions').is(':checked'),
            pauseVideo = $('#vquextEPauseVideo').is(':checked'),
            showSolution = $('#vquextEShowSolution').is(':checked'),
            timeShowSolution = parseInt(
                clear($('#vquextETimeShowSolution').val())
            ),
            useLives = $('#vquextEUseLives').is(':checked'),
            numberLives = parseInt(clear($('#vquextENumberLives').val())),
            idVideoQuExt = $('#vquextEVIURL').val().trim(),
            endVideoQuExt =
                $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                    $('#vquextEVIEnd').val()
                ),
            startVideoQuExt =
                $exeDevices.iDevice.gamification.helpers.hourToSeconds(
                    $('#vquextEVIStart').val()
                ),
            itinerary =
                $exeDevicesEdition.iDevice.gamification.itinerary.getValues(),
            feedBack = $('#vquextEHasFeedBack').is(':checked'),
            percentajeFB = parseInt(clear($('#vquextEPercentajeFB').val())),
            gameMode = parseInt($('input[name=vqxtgamemode]:checked').val()),
            validExtAudio = ['mp3', 'wav'],
            validExt = ['mp4', 'ogg', 'webm', 'ogv'],
            extension = idVideoQuExt.split('.').pop().toLowerCase(),
            durationVideo =
                $exeDevice.videoType > 0
                    ? $exeDevice.localPlayer.duration
                    : $exeDevice.durationVideo,
            customMessages = $('#vquextECustomMessages').is(':checked'),
            isVideoLocal =
                validExt.includes(extension) ||
                idVideoQuExt.toLowerCase().includes('google.com/videoplayback'),
            isAudio =
                validExtAudio.includes(extension) ||
                (idVideoQuExt
                    .toLowerCase()
                    .startsWith('https://drive.google.com') &&
                    idVideoQuExt.toLowerCase().includes('sharing')),
            isMediaTeca = idVideoQuExt.startsWith(
                'https://mediateca.educa.madrid.org/videos'
            ),
            authorVideo = $('#vquextEAuthor').val(),
            isNavigable = $('#vquextENavigable').is(':checked'),
            repeatQuestion = $('#vquextERepeatQuestion').is(':checked'),
            percentajeQuestions = parseInt(
                clear($('#vquextEPercentajeQuestions').val())
            ),
            modeBoard = $('#vquextEModeBoard').is(':checked'),
            evaluation = $('#vquextEEvaluation').is(':checked'),
            evaluationID = $('#vquextEEvaluationID').val(),
            globalTime = parseInt($('#vquextEGlobalTimes').val(), 10),
            id = $exeDevice.getIdeviceID();

        if (!itinerary) return false;
        if ((gameMode === 2 || feedBack) && textFeedBack.trim().length === 0) {
            $exeDevice.showMessage($exeDevice.msgs.msgProvideFB);
            return false;
        }

        if (
            ($exeDevice.videoType === 0 &&
                !$exeDevices.iDevice.gamification.media.getIDYoutube(
                    idVideoQuExt
                )) ||
            ($exeDevice.videoType === 1 && !isVideoLocal) ||
            ($exeDevice.videoType === 2 && !isAudio) ||
            ($exeDevice.videoType === 3 && !isMediaTeca) ||
            (showSolution && isNaN(timeShowSolution)) ||
            !$exeDevice.validTime($('#vquextEVIStart').val()) ||
            !$exeDevice.validTime($('#vquextEVIEnd').val()) ||
            startVideoQuExt >= endVideoQuExt ||
            endVideoQuExt > durationVideo + 1
        ) {
            $exeDevice.showMessage($exeDevice.msgs.msgEStartEndIncorrect);

            return false;
        }

        if (evaluation && evaluationID.length < 5) {
            $exeDevice.showMessage($exeDevice.msgs.msgIDLenght);
            return false;
        }

        const questionsGame = $exeDevice.questionsGame;
        for (const mquestion of questionsGame) {
            if (mquestion.quextion.length === 0) {
                $exeDevice.showMessage($exeDevice.msgs.msgECompleteQuestion);
                return false;
            }
            if (
                mquestion.pointVideo < startVideoQuExt ||
                mquestion.pointVideo > endVideoQuExt
            ) {
                $exeDevice.showMessage($exeDevice.msgs.msgEPoiIncorrect);
                return false;
            }
            if (
                mquestion.typeQuestion === 1 &&
                mquestion.solutionQuestion.length === 0
            ) {
                $exeDevice.showMessage($exeDevice.msgs.msgProvideSolution);
                return false;
            }
            if (mquestion.typeQuestion === 0) {
                const completAnswer = mquestion.options
                    .slice(0, mquestion.numberOptions)
                    .every((opt) => opt.length > 0);
                if (!completAnswer) {
                    $exeDevice.showMessage(
                        $exeDevice.msgs.msgECompleteAllOptions
                    );
                    return false;
                }
            }
        }

        const scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();

        return {
            asignatura: '',
            author: '',
            typeGame: 'VideoQuExt',
            endVideoQuExt,
            idVideoQuExt,
            startVideoQuExt,
            instructionsExe,
            instructions: $('#eXeGameInstructions').text(),
            showMinimize,
            optionsRamdon: false,
            answersRamdon,
            showSolution,
            timeShowSolution,
            useLives,
            numberLives,
            itinerary,
            questionsGame,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted || 100,
            title: '',
            reloadQuestion,
            previewQuestions,
            pauseVideo,
            textAfter,
            textFeedBack,
            gameMode,
            feedBack,
            percentajeFB,
            videoType: $exeDevice.videoType,
            customMessages,
            version: 2,
            authorVideo,
            isNavigable,
            repeatQuestion,
            percentajeQuestions,
            modeBoard,
            evaluation,
            evaluationID,
            globalTime,
            id,
        };
    },

    showSelectOrder: function (messages) {
        if (messages) {
            $('.VDQXTE-EOrders').slideDown();
        } else {
            $('.VDQXTE-EOrders').slideUp();
        }
    },

    removeTags: function (str) {
        return $('<div>').html(str).text();
    },

    addEvents: function () {
        $('#vquextEUseLives').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#vquextENumberLives').prop('disabled', !marcado);
        });

        $('#vquextEShowSolution').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#vquextETimeShowSolution').prop('disabled', !marcado);
        });

        $('#vquextShowCodeAccess').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#vquextCodeAccess').prop('disabled', !marcado);
            $('#vquextMessageCodeAccess').prop('disabled', !marcado);
        });

        $('.VDQXTE-EPanel').on('click', 'input.VDQXTE-Number', function () {
            const number = parseInt($(this).val());
            $exeDevice.showOptions(number);
        });

        $('.VDQXTE-EPanel').on(
            'click',
            'input.VDQXTE-TypeQuestion',
            function () {
                const type = parseInt($(this).val());
                $exeDevice.showTypeQuestion(type);
            }
        );

        $('#vquextEAdd').on('click', function (e) {
            e.preventDefault();
            $exeDevice.addQuestion();
        });

        $('#vquextEFirst').on('click', function (e) {
            e.preventDefault();
            $exeDevice.firstQuestion();
        });

        $('#vquextEPrevious').on('click', function (e) {
            e.preventDefault();
            $exeDevice.previousQuestion();
        });

        $('#vquextENext').on('click', function (e) {
            e.preventDefault();
            $exeDevice.nextQuestion();
        });

        $('#vquextELast').on('click', function (e) {
            e.preventDefault();
            $exeDevice.lastQuestion();
        });

        $('#vquextEDelete').on('click', function (e) {
            e.preventDefault();
            $exeDevice.removeQuestion();
        });

        $('#vquextEPlayVideo').on('click', function (e) {
            e.preventDefault();
            $exeDevice.playQuestionVideo();
        });

        $('#vquextENumberLives').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 1);
            this.value = v;
        });

        $('#vquextENumberLives').on('focusout', function () {
            this.value = this.value.trim() == '' ? 3 : this.value;
            this.value = this.value > 5 ? 5 : this.value;
            this.value = this.value < 1 ? 1 : this.value;
        });

        $('#vquextEPercentajeQuestions').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 3);
            this.value = v;
            if (this.value > 0 && this.value < 101) {
                $exeDevice.updateQuestionsNumber();
            }
        });

        $('#vquextEPercentajeQuestions').on('click', function () {
            $exeDevice.updateQuestionsNumber();
        });

        $('#vquextEPercentajeQuestions').on('focusout', function () {
            this.value = this.value.trim() == '' ? 100 : this.value;
            this.value = this.value > 100 ? 100 : this.value;
            this.value = this.value < 1 ? 1 : this.value;
            $exeDevice.updateQuestionsNumber();
        });

        $('#vquextETimeShowSolution').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 1);
            this.value = v;
        });

        $('#vquextETimeShowSolution').on('focusout', function () {
            this.value = this.value.trim() == '' ? 3 : this.value;
            this.value = this.value > 9 ? 9 : this.value;
            this.value = this.value < 1 ? 1 : this.value;
        });

        $('#vquextPoint, #vquextEVIStart, #vquextEVIEnd').on(
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

        $('#vquextPoint, #vquextEVIStart, #vquextEVIEnd').on(
            'click',
            function () {
                $(this).css({
                    'background-color': 'white',
                    color: '#2c6d2c',
                });
            }
        );

        $('#vquextPoint').css('color', '#2c6d2c');

        $('#vquextPoint').on('click', function (e) {
            e.preventDefault();
            $exeDevice.timeVIFocus = 0;
            $('#vquextPoint').css('color', '#2c6d2c');
            $('#vquextEVIStart').css('color', '#000000');
            $('#vquextEVIEnd').css('color', '#000000');
        });

        $('#vquextEVIStart').on('click', function (e) {
            e.preventDefault();
            $exeDevice.timeVIFocus = 1;
            $('#vquextPoint').css('color', '#000000');
            $('#vquextEVIStart').css('color', '#2c6d2c');
            $('#vquextEVIEnd').css('color', '#000000');
        });

        $('#vquextEVIEnd').on('click', function (e) {
            e.preventDefault();
            $exeDevice.timeVIFocus = 2;
            $('#vquextEVIEnd').css('color', '#2c6d2c');
            $('#vquextEVIStart').css('color', '#000000');
            $('#vquextPoint').css('color', '#000000');
        });

        $('#vquextEVITime').on('click', function (e) {
            e.preventDefault();
            if ($exeDevice.timeVIFocus == 0) {
                $('#vquextPoint').val($('#vquextEVITime').text());
                $('#vquextPoint').css({
                    'background-color': 'white',
                    color: '#2c6d2c',
                });
            } else if ($exeDevice.timeVIFocus == 1) {
                $('#vquextEVIStart').val($('#vquextEVITime').text());
                $('#vquextEVIStart').css({
                    'background-color': 'white',
                    color: '#2c6d2c',
                });
            } else if ($exeDevice.timeVIFocus == 2) {
                $('#vquextEVIEnd').val($('#vquextEVITime').text());
                $('#vquextEVIEnd').css({
                    'background-color': 'white',
                    color: '#2c6d2c',
                });
            }
        });

        $('#vquextUseLives').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#vquextENumberLives').prop('disabled', !marcado);
        });

        $('#vquextEShowSolution').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#vquextETimeShowSolution').prop('disabled', !marcado);
        });

        $('#vquextEVIURL').change(function () {
            const url = $(this).val().trim(),
                id = $exeDevices.iDevice.gamification.media.getIDYoutube(url);
            $('#vquextEVIEnd').val('00:00:00');

            if (id) {
                $exeDevice.loadYoutubeApi();
            } else {
                $exeDevice.loadVideo(url);
            }
        });

        $('#vquextEPlayStart').on('click', function (e) {
            e.preventDefault();
            const url = $('#vquextEVIURL').val().trim(),
                id = $exeDevices.iDevice.gamification.media.getIDYoutube(url);
            if (typeof YT == 'undefined' && id) {
                $exeDevice.loadYoutubeApi();
            } else {
                $exeDevice.loadVideo(url);
            }
        });

        $('#vquextEHasFeedBack').on('change', function () {
            const marcado = $(this).is(':checked');
            if (marcado) {
                $('#vquextEFeedbackP').slideDown();
            } else {
                $('#vquextEFeedbackP').slideUp();
            }
            $('#vquextEPercentajeFB').prop('disabled', !marcado);
        });

        $('#vquextQEIdeviceForm').on(
            'click',
            'input.VDQXTE-TypeGame',
            function () {
                const gm = parseInt($(this).val()),
                    fb = $('#vquextEHasFeedBack').is(':checked'),
                    ul = $('#vquextEUseLives').is(':checked');
                $exeDevice.updateGameMode(gm, fb, ul);
            }
        );

        $('#vquextEGameModeHelpLnk').click(function () {
            $('#vquextEGameModeHelp').toggle();
            return false;
        });

        if ($exeDevice.videoType > 0) {
            $exeDevice.startVideo(
                $exeDevice.idVideoQuExt,
                $exeDevice.pointStart,
                $exeDevice.pointEnd
            );
            $exeDevice.showPlayer();
        }

        $('#vquextECustomMessages').on('change', function () {
            const messages = $(this).is(':checked');
            $exeDevice.showSelectOrder(messages);
        });

        $('#vquextENavigable').on('change', function () {
            const disable = $(this).is(':checked');
            $('#vquextERepeatQuestion').prop('disabled', !disable);
        });

        $('#vquextNumberQuestion').keyup(function (e) {
            if (e.keyCode == 13) {
                const num = parseInt($(this).val());
                if (!isNaN(num) && num > 0) {
                    if ($exeDevice.validateQuestion()) {
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
        $('#vquextEEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#vquextEEvaluationID').prop('disabled', !marcado);
        });

        $('#vquextEEvaluationHelpLnk').click(function () {
            $('#vquextEEvaluationHelp').toggle();
            return false;
        });

        $('#vquextGlobalTimeButton').on('click', function (e) {
            e.preventDefault();
            const selectedTime = parseInt($('#vquextEGlobalTimes').val(), 10);
            for (let i = 0; i < $exeDevice.questionsGame.length; i++) {
                $exeDevice.questionsGame[i].time = selectedTime;
            }
            $(
                'input.VDQXTE-Times[name="vqxtime"][value="' +
                    selectedTime +
                    '"]'
            ).prop('checked', true);
        });

        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();

        //eXe 3.0 Dismissible messages
        $('.exe-block-dismissible .exe-block-close').click(function () {
            $(this).parent().fadeOut();
            return false;
        });
    },

    initClock: function (type) {
        $exeDevice.endVideoQuExt = 0;
        const { localPlayer, timeUpdateVideoLocal, getDataVideoLocal } =
            $exeDevice;

        localPlayer.removeEventListener(
            'timeupdate',
            timeUpdateVideoLocal,
            false
        );
        localPlayer.removeEventListener('loadedmetadata', getDataVideoLocal);

        clearInterval($exeDevice.timeUpdateInterval);

        if (type > 0) {
            localPlayer.addEventListener('loadedmetadata', getDataVideoLocal);
            localPlayer.addEventListener(
                'timeupdate',
                timeUpdateVideoLocal,
                false
            );
        } else {
            $exeDevice.timeUpdateInterval = setInterval(() => {
                if ($exeDevice?.videoType === 0) {
                    $exeDevice.updateTimerDisplayYT();
                }
            }, 1000);
        }
    },

    timeUpdateVideoLocal: function () {
        if ($exeDevice?.videoType > 0) {
            $exeDevice.updateTimerDisplayLocal();
        }
    },

    placeImageWindows: function (img, naturalWidth, naturalHeight) {
        const $parent = $(img).parent(),
            wDiv = $parent.width() || 1,
            hDiv = $parent.height() || 1,
            varW = naturalWidth / wDiv,
            varH = naturalHeight / hDiv;
        let wImage,
            hImage,
            xImagen = 0,
            yImagen = 0;

        if (varW > varH) {
            wImage = wDiv;
            hImage = naturalHeight / varW;
            yImagen = (hDiv - hImage) / 2;
        } else {
            wImage = naturalWidth / varH;
            hImage = hDiv;
            xImagen = (wDiv - wImage) / 2;
        }

        return {
            w: Math.round(wImage),
            h: Math.round(hImage),
            x: Math.round(xImagen),
            y: Math.round(yImagen),
        };
    },

    loadVideo: function (url) {
        if (!url.trim() || $exeDevice.videoLoading) return;

        $exeDevice.videoLoading = true;
        const id = $exeDevices.iDevice.gamification.media.getIDYoutube(url),
            validExtAudio = ['mp3', 'wav'],
            validExt = ['mp4', 'ogg', 'webm'],
            extension = url.split('.').pop().toLowerCase(),
            urlLower = url.toLowerCase(),
            isVideoLocal =
                validExt.includes(extension) ||
                urlLower.includes('google.com/videoplayback'),
            isAudio =
                validExtAudio.includes(extension) ||
                (urlLower.startsWith('https://drive.google.com') &&
                    urlLower.includes('sharing')),
            isMediaTeca = $exeDevice.getIDMediaTeca(url);

        if (
            !id &&
            !validExt.includes(extension) &&
            !isVideoLocal &&
            !validExtAudio.includes(extension) &&
            !isAudio &&
            !isMediaTeca
        ) {
            $exeDevice.showMessage($exeDevice.msgs.msgFormatVideo);
            $exeDevice.videoLoading = false;
            return;
        }

        if (isVideoLocal) {
            $exeDevice.videoType = 1;
            $exeDevice.localPlayer.pause();
        } else if (isAudio) {
            $exeDevice.videoType = 2;
            $exeDevice.localPlayer.pause();
        } else if (isMediaTeca) {
            $exeDevice.videoType = 3;
            $exeDevice.localPlayer.pause();
        } else {
            $exeDevice.videoType = 0;
            $exeDevice.localPlayer.src = '';
        }

        $exeDevice.initClock($exeDevice.videoType);
        $exeDevice.startVideo(url, $exeDevice.pointStart, $exeDevice.pointEnd);
        $exeDevice.showPlayer();
        $exeDevice.videoLoading = false;
    },
};
