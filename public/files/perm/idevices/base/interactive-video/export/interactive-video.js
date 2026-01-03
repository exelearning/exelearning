/**
 * Interactive Video iDevice
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Ignacio Gros (http://gros.es/) for http://exelearning.net/
 *
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 *
 * Loading icon generated with http://www.ajaxload.info/
 */
var mejsFullScreen;

var InteractiveVideo = {};

var $interactivevideo = {
    isSeek: false,
    baseId: 'interactivevideo',
    isInExe: false,
    mediaElementReady: false,
    youtubeCounter: null,
    localCounter: null,
    mOptions: {},
    typeNames: {
        text: 'Texto',
        image: 'Imagen',
        singleChoice: 'Respuesta única',
        multipleChoice: 'Respuesta múltiple',
        dropdown: 'Desplegable',
        cloze: 'Rellenar huecos',
        matchElements: 'Emparejado',
        sortableList: 'Lista desordenada',
    },
    i18n: {
        start: 'Start',
        results: 'Results',
        slide: 'Slide',
        score: 'Score',
        seen: 'Seen',
        total: 'Total',
        seeAll: 'see all the slides and answer all the questions',
        noSlides: 'This video has no interactive elements.',
        goOn: 'Continue',
        error: 'Error',
        dataError: 'Incompatible code',
        onlyOne: 'Only one interactive video per page.',
        cover: 'Cover',
        fsWarning: 'Exit the fullscreen mode (Esc) to see the current slide',
        right: 'Right!',
        wrong: 'Wrong',
        sortableListInstructions: 'Drag and drop or use the arrows.',
        up: 'Move up',
        down: 'Move down',
        rightAnswer: 'Right answer:',
        notAnswered: 'Please finish the activity',
        check: 'Check',
        newWindow: 'New window',
        msgSaveAuto:
            'Your score will be automatically saved after each question.',
        msgYouScore: 'Your score',
        msgYouLastScore: 'The last score saved is',
        msgActityComply: 'You have already done this activity.',
        msgPlaySeveralTimes:
            'You can do this activity as many times as you want',
        msgScoreScorm:
            "The score can't be saved because this page is not part of a SCORM package.",
        msgEndGameScore: 'Please start the game before saving your score.',
        msgSeveralScore: 'You can save the score as many times as you want',
        msgOnlySaveScore: 'You can only save the score once!',
        msgOnlySave: 'You can only save once',
        msgOnlySaveAuto:
            'Your score will be saved after each question. You can only play once.',
        youtubePreviewNotice:
            'YouTube videos cannot be embedded in preview mode. ' +
            'They will work correctly when exported and served from a web server.',
    },
    scorm: {
        isScorm: 0,
        textButtonScorm: 'Save score',
        repeatActivity: false,
    },
    userName: '',
    previousScore: '',
    initialScore: '',
    hasSCORMbutton: false,
    score: 0,
    numSlides: 1000,
    scoreSlides: [],
    scoref: '0',
    gameStarted: false,
    mScorm: null,
    idevicePath: '',
    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',

    init: function () {
        this.isInExe = eXe.app.isInExe();

        if (!$('html').is('#exe-index')) {
            this.scormAPIwrapper = '../libs/SCORM_API_wrapper.js';
            this.scormFunctions = '../libs/SCOFunctions.js';
        }
        this.idevicePath = this.isInExe
            ? eXe.app.getIdeviceInstalledExportPath('interactive-video')
            : $('.idevice_node.interactive-video')
                  .eq(0)
                  .attr('data-idevice-path');
        if ($('body').hasClass('exe-scorm')) this.loadSCORM_API_wrapper();
        else this.enable();

        let node = document.querySelector('.page-content');
        if (this.isInExe) {
            node = document.getElementById('node-content');
            if (node) $interactivevideo.observeMutations(node);
        }
    },
    loadSCORM_API_wrapper: function () {
        if (typeof pipwerks == 'undefined')
            $exe.loadScript(
                this.scormAPIwrapper,
                '$interactivevideo.loadSCOFunctions()'
            );
        else this.loadSCOFunctions();
    },

    loadSCOFunctions: function () {
        if (typeof scorm === 'undefined') {
            eXe.app.loadScript(
                this.scormFunctions,
                '$interactivevideo.initSCORM()'
            );
            return;
        } else {
            this.initSCORM();
        }
    },

    initSCORM: function () {
        $interactivevideo.mScorm = scorm;
        const callSucceeded = $interactivevideo.mScorm.init();
        if (!callSucceeded) {
            this.enable();
            return;
        }

        $interactivevideo.userName =
            $exeDevices.iDevice.gamification.scorm.getUserName(
                $interactivevideo.mScorm
            );
        $interactivevideo.previousScore =
            $exeDevices.iDevice.gamification.scorm.getPreviousScore(
                $interactivevideo.mScorm
            );

        if (typeof $interactivevideo.mScorm.SetScoreMax === 'function') {
            $interactivevideo.mScorm.SetScoreMax(100);
        } else {
            $interactivevideo.mScorm.set('cmi.core.score.max', '100');
        }
        if (typeof $interactivevideo.mScorm.SetScoreMin === 'function') {
            $interactivevideo.mScorm.SetScoreMin(0);
        } else {
            $interactivevideo.mScorm.set('cmi.core.score.min', '0');
        }

        this.enable();
    },

    enable: function () {
        this.isInExe = eXe.app.isInExe();
        // Create the required HTML elements:
        var es = $('.exe-interactive-video');
        var text = $('.exe-interactive-video').eq(0).html();
        var showResults = true;
        if (es.hasClass('exe-interactive-video-no-results'))
            showResults = false;

        if (es.length == 0) return;

        if (es.length > 1) {
            var msg =
                $interactivevideo.i18n.error +
                ' - ' +
                InteractiveVideo.i18n.onlyOne;
            if (this.isInExe) eXe.app.alert(msg);
            else alert(msg);
            return false;
        }

        es = es.eq(0);

        // Default strings
        if (
            typeof InteractiveVideo != 'undefined' &&
            typeof InteractiveVideo.i18n != 'undefined'
        ) {
            for (var _i in InteractiveVideo.i18n) {
                $interactivevideo.i18n[_i] = InteractiveVideo.i18n[_i];
            }
        }
        var i18n = $interactivevideo.i18n;

        var html =
            '\
			 <div id="activity-wrapper">\
			 <div id="activity">\
				 <div id="player" style="width:448px;height:356px"></div>\
				 <div id="slide"></div>\
			 </div>\
		 ';

        if (showResults) {
            html +=
                '\
				 <div class="js-required">\
					 <h2 id="activity-results-toggler"><a href="#activity-results" onclick="$interactivevideo.resultsViewer.toggle(this);return false" class="show">' +
                i18n.results +
                '</a></h2>\
					 <div id="activity-results" style="display:none"></div>\
				 </div>\
			 ';
        }

        if (typeof InteractiveVideo != 'undefined') {
            $interactivevideo.scorm =
                typeof InteractiveVideo.scorm == 'undefined'
                    ? $interactivevideo.scorm
                    : InteractiveVideo.scorm;
            $interactivevideo.scoreNIA =
                typeof InteractiveVideo.scoreNIA == 'undefined'
                    ? true
                    : InteractiveVideo.scoreNIA;
            $interactivevideo.evaluation =
                typeof InteractiveVideo.evaluation == 'undefined'
                    ? false
                    : InteractiveVideo.evaluation;
            $interactivevideo.evaluationID =
                typeof InteractiveVideo.evaluationID == 'undefined'
                    ? ''
                    : InteractiveVideo.evaluationID;
            $interactivevideo.ideviceID =
                typeof InteractiveVideo.ideviceID == 'undefined'
                    ? ''
                    : InteractiveVideo.ideviceID;
            $interactivevideo.mOptions =
                $interactivevideo.getOptions(InteractiveVideo);
            var buttonScorm =
                $exeDevices.iDevice.gamification.scorm.addButtonScoreNew(
                    $interactivevideo.mOptions
                );
            html += buttonScorm;
        }

        // es.html(es.html()+html);
        es[0].innerHTML += html;

        // console.log(typeof top.interactiveVideoEditor.activityToSave);
        // Only show "no slides" message if there's truly no content at all
        // (no slides AND no cover title/description)
        var hasNoContent = (
            typeof InteractiveVideo == 'undefined' ||
            typeof InteractiveVideo.slides == 'undefined'
        );
        var hasNoSlides = !hasNoContent && InteractiveVideo.slides.length === 0;
        var hasCover = !hasNoContent && (InteractiveVideo.title || InteractiveVideo.description);

        if (hasNoContent || (hasNoSlides && !hasCover)) {
            $('#player').html(
                "<p style='text-align:center;margin:0;line-height:356px'>" +
                    i18n.noSlides +
                    '</p>'
            );
            $('#activity-results-toggler').hide();
            return false;
            // if (typeof (InteractiveVideo) == "undefined") {
            //   $("#player").html("<p style='text-align:center;margin:0;line-height:356px'>" + i18n.noSlides + "</p>");
            //   $("#activity-results-toggler").hide();
            //   return false;
        }

        try {
            document.createEvent('TouchEvent');
            $('BODY').addClass('is-mobile');
        } catch (e) {}

        if (this.inIframe()) $('body').removeClass('full-screen');

        this.getTypeAndId();

        // To review
        // Make sure that you delete all the results so you can save the new values
        for (var i = 0; i < InteractiveVideo.slides.length; i++) {
            InteractiveVideo.slides[i].results = null;
        }

        $('BODY').addClass('cover-on');
        var play = '<p id="start-activity">';
        var playContent =
            '<a href="#" onclick="$interactivevideo.cover.hide(true);return false" id="start-link">' +
            i18n.start +
            '</a>';

        play = play + playContent + '</p>';
        // var cover = "<h2>"+$("#activity-title").html()+"</h2>";
        var cover = '';
        var coverCSS = '';
        var videoTitle = '...';
        if (InteractiveVideo.title) videoTitle = InteractiveVideo.title;
        else {
            var iDeviceTitle = $('.interactive-videoIdevice .iDeviceTitle');
            if (iDeviceTitle.length > 0) {
                iDeviceTitle = iDeviceTitle.eq(0);
                if (
                    iDeviceTitle.html() != '&nbsp;' &&
                    iDeviceTitle.text().replace(/ /g, '') != ''
                ) {
                    videoTitle = iDeviceTitle.text();
                }
            }
        }
        if (!(InteractiveVideo.description && videoTitle == '...'))
            cover = '<h2>' + videoTitle + '</h2>';
        if (InteractiveVideo.description) cover += InteractiveVideo.description;

        // Cover (poster)
        if (
            InteractiveVideo.coverType &&
            InteractiveVideo.coverType == 'poster'
        ) {
            var img = $(
                '.interactive-videoIdevice .exe-interactive-video-poster'
            );
            if (img.length == 1) {
                img = img.eq(0);
                cover = "<h2 class='sr-av'>" + videoTitle + '</h2>';
                cover +=
                    "<span class='activity-cover-img-content'>" +
                    img.html() +
                    '</span>';
                coverCSS = ' class="activity-cover-img"';
            }
        }

        $('#activity').prepend(
            '<div id="activity-cover"><div id="activity-cover-logo"></div><div id="activity-cover-content">' +
                cover +
                '</div>' +
                play +
                '</div>'
        );

        const videoHtml = $('.exe-interactive-video').html();
        if ($exeDevices.iDevice.gamification.math.hasLatex(videoHtml)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '.exe-interactive-video'
            );
        }

        if (this.type == 'mediateca') {
            eXe.app.loadScript(
                'https://mediateca.educa.madrid.org/includes/player/exelearning/jwplayer.js',
                '$interactivevideo.ready()'
            );
            return;
        } else if (this.type == 'youtube') {
            // Check if we're in a context where YouTube embeds cannot work
            // YouTube requires HTTP/HTTPS origin - blob: and file: URLs are not supported
            var currentOrigin = window.location.origin || '';
            var isUnsupportedContext = currentOrigin.startsWith('blob:') ||
                                       currentOrigin.startsWith('file:') ||
                                       window.location.protocol === 'file:' ||
                                       window.location.href.startsWith('blob:');

            if (isUnsupportedContext) {
                // Use HTTP wrapper iframe to load YouTube (works from blob: context)
                $interactivevideo.loadYoutubeWrapper();
                return;
            }

            isYTready = setInterval(function () {
                if (typeof YT !== 'undefined') {
                    onYouTubeIframeAPIReady = $interactivevideo.ready();
                    clearInterval(isYTready);
                }
            }, 500);

            // Load the IFrame Player API code asynchronously
            var tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            var firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else if (this.type == 'local') {
            $('#player').html(
                '<video width="448" height="356" class="mejs__player" controls="controls"><source src="' +
                    this.file +
                    '" /></video>'
            );
        }
        // $interactivevideo.ready();
    },

    saveEvaluation: function () {
        let options = $interactivevideo.mOptions;
        options.gameStarted = true;
        options.scorerp =
            ($interactivevideo.score * 10) / $interactivevideo.numSlides;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            options,
            options.isInExe
        );
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

    sendScore: function (auto) {
        let options = $interactivevideo.mOptions;
        options.scorerp =
            ($interactivevideo.score * 10) / $interactivevideo.numSlides;
        options.gameStarted = true;
        options.userName = $interactivevideo.userName || '';

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, options);
        $interactivevideo.previousScore = options.previousScore;
    },

    updateScore: function (question, result) {
        if (question >= $interactivevideo.scoreSlides.length) return;
        var e = $interactivevideo.scoreSlides[question],
            point = InteractiveVideo.scoreNIA ? 1 : 0;
        if (
            e.type == 'singleChoice' ||
            e.type == 'multipleChoice' ||
            e.type == 'dropdown' ||
            e.type == 'matchElements' ||
            e.type == 'sortableList' ||
            e.type == 'cloze'
        ) {
            var spoint = parseFloat(result);
            if (!isNaN(spoint)) {
                point = spoint / 100;
            }
        }
        if (e.score == -1) {
            e.score = point;
            $interactivevideo.score += point;
        }
        if (InteractiveVideo.scorm.isScorm == 1) {
            var scoref = (
                ($interactivevideo.score * 10) /
                $interactivevideo.numSlides
            ).toFixed(2);
            $('#interactiveRepeatActivity').text(
                InteractiveVideo.i18n.msgYouScore + ': ' + scoref
            );
            $('#interactiveRepeatActivity').show();
            $interactivevideo.sendScore(true);
        }
        $interactivevideo.saveEvaluation();
    },

    inIframe: function () {
        try {
            return window.self !== window.top;
        } catch (e) {
            return true;
        }
    },

    cover: {
        hide: function (play) {
            $('BODY').removeClass('cover-on');
            if (
                InteractiveVideo &&
                InteractiveVideo.slides != undefined &&
                InteractiveVideo.slides.length > 0
            ) {
                if (
                    InteractiveVideo.ideviceID &&
                    InteractiveVideo.evaluation &&
                    InteractiveVideo.evaluationID.length > 0
                ) {
                    let goptions =
                        $interactivevideo.getOptions(InteractiveVideo);
                    $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                        goptions,
                        $interactivevideo.isInExe
                    );
                }
                if (
                    InteractiveVideo &&
                    InteractiveVideo.scorm &&
                    InteractiveVideo.scorm.isScorm > 0
                ) {
                    let goptions =
                        $interactivevideo.getOptions(InteractiveVideo);
                    $exeDevices.iDevice.gamification.scorm.registerActivity(
                        goptions
                    );
                }

                var activeSlide = 0;
                for (var i = 0; i < InteractiveVideo.slides.length; i++) {
                    var sr = {
                        type: InteractiveVideo.slides[i].type,
                        score: -1,
                    };
                    $interactivevideo.scoreSlides.push(sr);
                    if (
                        sr.type == 'singleChoice' ||
                        sr.type == 'multipleChoice' ||
                        sr.type == 'dropdown' ||
                        sr.type == 'matchElements' ||
                        sr.type == 'sortableList' ||
                        sr.type == 'cloze'
                    ) {
                        activeSlide++;
                    }
                }
                $interactivevideo.numSlides = InteractiveVideo.scoreNIA
                    ? $interactivevideo.scoreSlides.length
                    : activeSlide;
                $interactivevideo.gameStarted = true;
                $('#interactiveSendScore').off('click');
                $('#interactiveSendScore').on('click', function (e) {
                    e.preventDefault();
                    $interactivevideo.sendScore(false);
                    $interactivevideo.saveEvaluation();
                });
            }
            if (play) $interactivevideo.controls.play();
        },
        show: function (action) {
            var i18n = InteractiveVideo.i18n;
            $interactivevideo.controls.stop();
            $('BODY').addClass('cover-on');
            var txt = i18n.goOn;
            var play = false;
            if (action == 'restart') {
                txt = i18n.start;
                play = true;
            }
            $('#start-link')
                .text(txt)
                .click(function () {
                    $interactivevideo.cover.hide(play);
                    return false;
                });
        },
    },

    randomizeArray: function (o) {
        // Guard: arrays with 0 or 1 elements cannot be shuffled differently
        if (o.length <= 1) return o;
        var original = [];
        for (var w = 0; w < o.length; w++) original.push(o[w]);
        for (
            var j, x, i = o.length;
            i;
            j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x
        );
        var hasChanged = false;
        for (var y = 0; y < o.length; y++) {
            if (!hasChanged && original[y] != o[y]) hasChanged = true;
        }
        if (hasChanged) return o;
        else return this.randomizeArray(original);
    },

    controls: {
        play: function () {
            if ($interactivevideo.type == 'mediateca') {
                if (typeof jwplayer == 'undefined') return;
                jwplayer().play();
            } else if ($interactivevideo.type == 'youtube') {
                $interactivevideo.player.playVideo();
            } else if ($interactivevideo.type == 'local') {
                if ($interactivevideo.mediaElementReady == false) {
                    $interactivevideo.mediaElementVideo = $('#player video');
                    if (
                        $interactivevideo.mediaElementVideo.mediaelementplayer
                    ) {
                        $interactivevideo.mediaElementVideo.mediaelementplayer({
                            success: function (
                                mediaElement,
                                DOMElement,
                                player
                            ) {
                                mejsFullScreen = mediaElement.isFullScreen;
                                setInterval(function () {
                                    if (
                                        mediaElement.isFullScreen !=
                                        mejsFullScreen
                                    ) {
                                        if (mediaElement.isFullScreen) {
                                            mejsFullScreen =
                                                mediaElement.isFullScreen;
                                        } else {
                                            mejsFullScreen =
                                                mediaElement.isFullScreen;
                                        }
                                    }
                                }, 500);
                            },
                        });
                    }
                    $interactivevideo.mediaElementReady = true;
                    setTimeout(function () {
                        if ($interactivevideo.extension == 'flv')
                            $('.mejs-overlay-button').trigger('click');
                        else $interactivevideo.mediaElementVideo[0].play();
                        $interactivevideo.ready();
                        $interactivevideo.hasPlayed = true;
                        //$interactivevideo.mejs = mejs;
                    }, 500);
                } else {
                    if ($interactivevideo.extension == 'flv')
                        $('.mejs-overlay-button').trigger('click');
                    else $interactivevideo.mediaElementVideo[0].play();
                }
            }
        },
        stop: function () {
            if ($interactivevideo.type == 'mediateca') jwplayer().stop();
            else if ($interactivevideo.type == 'youtube')
                $interactivevideo.player.pauseVideo();
            else if ($interactivevideo.type == 'local') {
                if ($interactivevideo.extension == 'flv')
                    $('.mejs-pause button').trigger('click');
                else $interactivevideo.mediaElementVideo[0].pause();
            }
        },
        pause: function () {
            if ($interactivevideo.type == 'mediateca') jwplayer().pause(true);
            else if ($interactivevideo.type == 'youtube')
                $interactivevideo.player.pauseVideo();
            else if ($interactivevideo.type == 'local') {
                if ($interactivevideo.extension == 'flv')
                    $('.mejs-pause button').trigger('click');
                else $interactivevideo.mediaElementVideo[0].pause();
            }
        },
        seek: function (sec) {
            if ($interactivevideo.type == 'mediateca') {
                jwplayer().seek(sec);
            } else if ($interactivevideo.type == 'youtube') {
                $interactivevideo.player.seekTo(sec);
                $interactivevideo.player.pauseVideo();
                $interactivevideo.track(sec);
            } else if ($interactivevideo.type == 'local') {
                $interactivevideo.mediaElementVideo[0].setCurrentTime(sec);
            }
        },
    },

    restart: function () {
        if (confirm('\u00BFBorrar tus resultados y empezar de nuevo?')) {
            var questions = InteractiveVideo.slides;
            for (var i = 0; i < questions.length; i++) {
                questions[i].results = null;
            }
            $interactivevideo.resultsViewer.create();
            $('BODY').removeClass('activity-completed');
            // if (InteractiveVideo.cover)
            $interactivevideo.cover.show('restart');
        }
    },

    getTypeAndId: function () {
        var w = $('#exe-interactive-video-file');

        var as = $('a', w);

        if (as.length == 1) {
            var ref = as.eq(0).attr('href');
            // Mediateca (EducaMadrid)
            if (ref.indexOf('https://mediateca.educa.madrid.org/video/') == 0) {
                this.type = 'mediateca';
                this.id = ref
                    .split('https://mediateca.educa.madrid.org/video/')[1]
                    .split('?')[0];
                return;
            }
            // Youtube
            else if (
                ref.indexOf('//youtu.be/') > -1 ||
                ref.indexOf('//www.youtube.com') > -1
            ) {
                function youtube_parser(url) {
                    var match = url.match(regExp);
                    var regExp =
                        /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                    var match = url.match(regExp);
                    if (match && match[2].length == 11) {
                        return match[2];
                    } else {
                        return false;
                    }
                }
                var id = youtube_parser(ref);
                if (!id) {
                    alert(InteractiveVideo.i18n.error + ' - Youtube (ID)');
                    return false;
                }
                this.id = id;
                this.type = 'youtube';
                return;
            }
            // Local
            else if (
                ref.indexOf('resources/') == 0 ||
                (ref.indexOf('http') != 0 && ref.indexOf('//') != 0)
            ) {
                this.file = ref;
                this.type = 'local';
                this.extension = ref.split('.').pop().toLowerCase();
                return;
            }
            alert(
                InteractiveVideo.i18n.error +
                    ' - ' +
                    InteractiveVideo.i18n.dataError
            );
        }
    },

    enableJWPlayer: function (id, h, w) {
        var img =
            'http://mediateca.educa.madrid.org/imagen.php?id=' +
            id +
            '&type=1&m=0';
        jwplayer('player').setup({
            sources: [
                {
                    file:
                        'http://mediateca.educa.madrid.org/streaming.php?id=' +
                        id,
                    label: '480p',
                    type: 'mp4',
                    provider: 'http',
                    startparam: 'start',
                },
            ],
            image: img,
            logo: {
                file: 'http://mediateca.educa.madrid.org/images/player/educamadrid.png',
                link: 'http://mediateca.educa.madrid.org/video/' + id,
                hide: true,
            },
            abouttext: 'Mediateca',
            aboutlink: 'http://mediateca.educa.madrid.org/ayuda.php',
            // controls: false,
            height: h,
            width: w,
        });
    },

    /**
     * Load YouTube via HTTP wrapper iframe (works from blob:/file: contexts)
     *
     * YOUTUBE EMBEDDING RESTRICTION:
     * YouTube's IFrame Player API requires a valid HTTP/HTTPS origin to function.
     * When the preview is loaded via blob: URL (e.g., blob:http://localhost:8080/...),
     * YouTube rejects the embed with "Error 153: Video player configuration error"
     * because blob: URLs have a null origin that YouTube doesn't recognize.
     *
     * SOLUTION:
     * Instead of creating a YT.Player directly (which would fail in blob: context),
     * we create an iframe that loads youtube-preview.html from the HTTP server.
     * This wrapper has a valid HTTP origin, so YouTube works correctly inside it.
     *
     * COMMUNICATION:
     * Since the YouTube player is now inside a nested iframe, we use postMessage
     * to communicate between the interactive-video iDevice and the wrapper:
     * - Wrapper sends: youtube-ready, youtube-time, youtube-state, youtube-error
     * - Parent sends: youtube-play, youtube-pause, youtube-seek, youtube-stop
     *
     * The player object is replaced with a proxy that sends postMessage commands
     * to maintain compatibility with existing code that calls player.playVideo(), etc.
     *
     * @see public/app/common/youtube-preview.html - The HTTP wrapper
     * @see WebsitePreviewExporter.ts - Global transform for all YouTube embeds
     */
    loadYoutubeWrapper: function () {
        var videoId = this.id;
        var self = this;

        // Determine the base URL for the wrapper
        // In blob: context, we need to extract the real origin
        var wrapperBaseUrl = '';
        if (window.location.href.startsWith('blob:')) {
            // Extract origin from blob URL: blob:http://localhost:8080/... -> http://localhost:8080
            var blobUrl = window.location.href;
            var match = blobUrl.match(/^blob:(https?:\/\/[^/]+)/);
            if (match) {
                wrapperBaseUrl = match[1];
            }
        } else if (window.location.protocol === 'file:') {
            // For file: protocol, we can't determine the server URL
            // Fall back to showing the fallback UI
            this.showYoutubeFallback();
            return;
        }

        // If we couldn't determine a valid base URL, show fallback
        if (!wrapperBaseUrl) {
            this.showYoutubeFallback();
            return;
        }

        // Get basePath if set (for subdirectory installations)
        var basePath = (typeof eXe !== 'undefined' && eXe.basePath) ? eXe.basePath : '';

        // Build the wrapper URL
        var wrapperUrl = wrapperBaseUrl + basePath + '/app/common/youtube-preview.html?v=' + encodeURIComponent(videoId);

        // Create iframe for the wrapper
        var iframe = document.createElement('iframe');
        iframe.id = 'youtube-wrapper-iframe';
        iframe.src = wrapperUrl;
        iframe.width = '448';
        iframe.height = '356';
        iframe.frameBorder = '0';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.allowFullscreen = true;
        iframe.style.cssText = 'border:none;background:#000;';

        // Clear player container and add iframe
        var playerEl = document.getElementById('player');
        playerEl.innerHTML = '';
        playerEl.appendChild(iframe);

        // Track if wrapper is ready
        this.youtubeWrapperReady = false;
        this._lastYoutubeTime = 0;

        // Listen for messages from the wrapper
        var messageHandler = function(event) {
            // Validate origin
            if (event.origin !== wrapperBaseUrl) return;

            var data = event.data;
            if (!data || typeof data.type !== 'string') return;

            switch (data.type) {
                case 'youtube-ready':
                    self.youtubeWrapperReady = true;
                    self.complete();
                    break;

                case 'youtube-time':
                    self._lastYoutubeTime = data.time || 0;
                    self.track(data.time || 0);
                    break;

                case 'youtube-state':
                    // YT.PlayerState: -1=unstarted, 0=ended, 1=playing, 2=paused, 3=buffering, 5=cued
                    if (data.state === 1) { // playing
                        self.hasPlayed = true;
                        self.checkSlides();
                    }
                    break;

                case 'youtube-error':
                    console.error('[InteractiveVideo] YouTube wrapper error:', data.message);
                    // On error, show the static fallback
                    self.showYoutubeFallback();
                    break;
            }
        };

        window.addEventListener('message', messageHandler);

        // Store handler reference for cleanup
        this._youtubeWrapperMessageHandler = messageHandler;

        // Create a player-like interface for compatibility with existing code
        this.player = {
            getCurrentTime: function() {
                return self._lastYoutubeTime || 0;
            },
            playVideo: function() {
                var wrapperIframe = document.getElementById('youtube-wrapper-iframe');
                if (wrapperIframe && wrapperIframe.contentWindow) {
                    wrapperIframe.contentWindow.postMessage({ type: 'youtube-play' }, wrapperBaseUrl);
                }
            },
            pauseVideo: function() {
                var wrapperIframe = document.getElementById('youtube-wrapper-iframe');
                if (wrapperIframe && wrapperIframe.contentWindow) {
                    wrapperIframe.contentWindow.postMessage({ type: 'youtube-pause' }, wrapperBaseUrl);
                }
            },
            seekTo: function(time) {
                var wrapperIframe = document.getElementById('youtube-wrapper-iframe');
                if (wrapperIframe && wrapperIframe.contentWindow) {
                    wrapperIframe.contentWindow.postMessage({ type: 'youtube-seek', time: time }, wrapperBaseUrl);
                }
            },
            stopVideo: function() {
                var wrapperIframe = document.getElementById('youtube-wrapper-iframe');
                if (wrapperIframe && wrapperIframe.contentWindow) {
                    wrapperIframe.contentWindow.postMessage({ type: 'youtube-stop' }, wrapperBaseUrl);
                }
            }
        };
    },

    /**
     * Show fallback for YouTube when wrapper also fails (e.g., file: protocol)
     * Displays a thumbnail with a link to watch on YouTube
     */
    showYoutubeFallback: function () {
        var videoId = this.id;
        var i18n = this.i18n;
        var thumbnailUrl = 'https://img.youtube.com/vi/' + videoId + '/maxresdefault.jpg';
        var fallbackThumbnail = 'https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg';
        var youtubeUrl = 'https://www.youtube.com/watch?v=' + videoId;

        var html = '<div class="exe-youtube-fallback" style="' +
            'width:448px;height:356px;' +
            'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
            'background:#000;position:relative;border-radius:8px;overflow:hidden;">' +
            '<img src="' + thumbnailUrl + '" ' +
            'onerror="this.src=\'' + fallbackThumbnail + '\'" ' +
            'alt="YouTube video thumbnail" ' +
            'style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;opacity:0.7;">' +
            '<div style="position:relative;z-index:1;text-align:center;padding:20px;">' +
            '<div style="' +
            'width:68px;height:48px;margin:0 auto 16px;' +
            'background:#ff0000;border-radius:12px;' +
            'display:flex;align-items:center;justify-content:center;">' +
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="white">' +
            '<path d="M8 5v14l11-7z"/>' +
            '</svg>' +
            '</div>' +
            '<p style="color:#fff;font-size:14px;margin:0 0 12px;text-shadow:0 1px 3px rgba(0,0,0,0.8);">' +
            (i18n.newWindow || 'Open in new window') +
            '</p>' +
            '<a href="' + youtubeUrl + '" target="_blank" rel="noopener" ' +
            'style="' +
            'display:inline-block;padding:10px 24px;' +
            'background:#ff0000;color:#fff;text-decoration:none;' +
            'border-radius:4px;font-weight:bold;font-size:14px;' +
            'transition:background 0.2s;"' +
            'onmouseover="this.style.background=\'#cc0000\'" ' +
            'onmouseout="this.style.background=\'#ff0000\'">' +
            'YouTube' +
            '</a>' +
            '</div>' +
            '</div>';

        $('#player').html(html);

        // Show message explaining why the video can't be embedded
        var contextMsg = '<p class="exe-youtube-context-warning" style="' +
            'margin:8px 0;padding:8px 12px;' +
            'background:#fff3cd;border:1px solid #ffc107;border-radius:4px;' +
            'font-size:12px;color:#856404;text-align:center;">' +
            (i18n.youtubePreviewNotice ||
                'YouTube videos cannot be embedded in preview mode. ' +
                'They will work correctly when exported and served from a web server.') +
            '</p>';

        $('#player').after(contextMsg);

        // Still initialize the activity UI (results viewer, cover, etc.)
        $interactivevideo.complete();
    },

    checkSlides: function () {
        if ($interactivevideo.isSeek) {
            if ($('BODY').hasClass('active')) {
                // Check if it has endTime
                var slide = $('#slide');
                var c = slide.attr('class');
                if (c == 'image' || c == 'text') {
                    if (
                        !InteractiveVideo.slides[$interactivevideo.visibleSlide]
                            .endTime
                    ) {
                        // To review (error: It hides the slide): $interactivevideo.slide.hide('case 1');
                    }
                } else {
                    // setTimeout(function(){
                    // $interactivevideo.slide.hide('case 2');
                    // },100);
                }
            }
        }
        $interactivevideo.isSeek = false;
    },

    ready: function () {
        $interactivevideo.orderSlides();

        if (this.type == 'mediateca') {
            // Enlable the player and track the video
            $interactivevideo.enableJWPlayer(this.id, '356', '448');

            jwplayer().onTime(function (e) {
                $interactivevideo.track(e.position);
            });

            // If the video is playing, the slides should be hidden
            jwplayer().onPlay(function () {
                $interactivevideo.hasPlayed = true;
                $interactivevideo.checkSlides();
            });

            $interactivevideo.complete();
        } else if ($interactivevideo.type == 'youtube') {
            // Get the origin for YouTube API (must be HTTP/HTTPS)
            var origin = window.location.origin;
            // If origin is not valid (blob:, file:, etc.), use the page's base URL
            if (!origin || origin === 'null' || origin.startsWith('blob:') || origin.startsWith('file:')) {
                origin = 'https://exelearning.net'; // Fallback origin
            }

            $interactivevideo.player = new YT.Player('player', {
                height: '356',
                width: '448',
                videoId: $interactivevideo.id,
                host: 'https://www.youtube-nocookie.com', // Privacy-enhanced mode
                playerVars: {
                    origin: origin,
                    enablejsapi: 1,
                    rel: 0, // Don't show related videos at end
                    modestbranding: 1 // Minimal YouTube branding
                },
                events: {
                    onReady: function () {
                        $interactivevideo.complete();
                    },
                    onStateChange: function (e) {
                        $interactivevideo.hasPlayed = true;
                        $interactivevideo.youtubeCounter = setInterval(
                            function () {
                                if (
                                    $interactivevideo.player &&
                                    typeof $interactivevideo.player
                                        .getCurrentTime === 'function'
                                ) {
                                    $interactivevideo.track(
                                        $interactivevideo.player.getCurrentTime()
                                    );
                                } else {
                                    clearInterval(
                                        $interactivevideo.youtubeCounter
                                    );
                                }
                            },
                            500
                        );
                        $interactivevideo.checkSlides();
                    },
                    onError: function (e) {
                        // Handle YouTube errors gracefully
                        console.error('[InteractiveVideo] YouTube error:', e.data);
                        // Error codes: 2=invalid param, 5=HTML5 error, 100=not found,
                        // 101/150=embedding disabled, 153=playback restricted
                        if (e.data === 150 || e.data === 101 || e.data === 153) {
                            // Video cannot be embedded - show fallback
                            $interactivevideo.showYoutubeFallback();
                        }
                    },
                },
            });
        } else if ($interactivevideo.type == 'local') {
            $interactivevideo.complete();

            if ($interactivevideo.extension == 'flv') {
                $interactivevideo.localCounter = setInterval(function () {
                    if (
                        typeof $interactivevideo.hourToSeconds(
                            $('#player .mejs-currenttime')
                        ) !== 'undefined'
                    ) {
                        $interactivevideo.track(
                            $interactivevideo.hourToSeconds(
                                $('#player .mejs-currenttime').eq(0).text()
                            )
                        );
                    } else {
                        clearInterval($interactivevideo.localCounter);
                    }
                }, 500);
            } else {
                $interactivevideo.mediaElementVideo[0].addEventListener(
                    'playing',
                    function (e) {
                        $interactivevideo.localCounter = setInterval(
                            function () {
                                if (
                                    typeof $interactivevideo.mediaElementVideo !==
                                    'undefined'
                                ) {
                                    $interactivevideo.track(
                                        $interactivevideo.mediaElementVideo[0]
                                            .currentTime
                                    );
                                } else {
                                    clearInterval(
                                        $interactivevideo.localCounter
                                    );
                                }
                            },
                            500
                        );
                        $interactivevideo.checkSlides();
                    }
                );
            }
        }
    },

    complete: function () {
        // Create the results viewer
        $interactivevideo.resultsViewer.create();

        // Set the max-width
        // $(window).load(function () {
        $('#start-activity').show();
        $(document)
            .ready(function () {
                if ($interactivevideo.type === 'local') {
                    const ivStyle =
                        $interactivevideo.mediaElementVideo[0]?.getAttribute(
                            'style'
                        ) || '';
                    if (!ivStyle.includes('width: 448px; height: 356px;')) {
                        $interactivevideo.mediaElementVideo[0].setAttribute(
                            'style',
                            `${ivStyle} width: 448px; height: 356px;`.trim()
                        );
                    }
                }
                $interactivevideo.setMaxWidth();
            })
            .resize(function () {
                $interactivevideo.setMaxWidth();
            });
    },
    setMaxWidth: function () {
        var w = $('#activity-wrapper').width();
        $('#player').css('max-width', w / 2 + 'px');
    },
    orderSlides: function () {
        var sortable = [];
        for (var slide in InteractiveVideo.slides) {
            sortable.push([
                $interactivevideo.secondsToHour(
                    InteractiveVideo.slides[slide].startTime
                ),
                InteractiveVideo.slides[slide],
            ]);
        }
        sortable.sort();
        var sorted = [];
        for (var i in sortable) {
            sorted.push(sortable[i][1]);
        }
        InteractiveVideo.slides = sorted;
    },
    // hh:mm:ss to seconds
    hourToSeconds: function (str) {
        var i = str.split(':');
        if (i.length == 0) {
            return 0;
        } else if (i.length == 1) {
            i = '00:00:' + i[0];
            i = i.split(':');
        } else if (i.length == 2) {
            i = '00:' + i[0] + ':' + i[1];
            i = i.split(':');
        }
        return +i[0] * 60 * 60 + +i[1] * 60 + +i[2];
    },

    secondsToHour: function (totalSec) {
        var hours = parseInt(totalSec / 3600) % 24;
        var minutes = parseInt(totalSec / 60) % 60;
        var seconds = totalSec % 60;
        return (
            (hours < 10 ? '0' + hours : hours) +
            ':' +
            (minutes < 10 ? '0' + minutes : minutes) +
            ':' +
            (seconds < 10 ? '0' + seconds : seconds)
        );
    },

    resultsViewer: {
        create: function () {
            var html = '';
            var i18n = InteractiveVideo.i18n;
            // var cover = "";
            // if (InteractiveVideo.cover) {
            var cover =
                '\
					 <tr class="odd">\
						 <td>&nbsp;</td>\
						 <td><a href="#" onclick="$interactivevideo.cover.show();return false">' +
                i18n.cover +
                '</a> </td>\
						 <td>&nbsp;</td>\
					 </tr>';
            // }
            var questions = InteractiveVideo.slides;
            for (var i = 0; i < questions.length; i++) {
                var e = questions[i];
                var title = (title =
                    'Actividad - ' + $interactivevideo.typeNames[e.type]);
                if (e.type == 'image' || e.type == 'text')
                    title =
                        'Información - ' + $interactivevideo.typeNames[e.type];
                var result = '-';
                var k = 'odd';
                if (i % 2 == 0) k = 'even';
                if (
                    $interactivevideo.type == 'local' &&
                    $interactivevideo.extension == 'flv'
                ) {
                    html +=
                        '\
						 <tr class="' +
                        k +
                        '">\
							 <td class="order"><span>' +
                        (i + 1) +
                        '</span> </td>\
							 <td><span>' +
                        $interactivevideo.secondsToHour(e.startTime) +
                        '</span> </td>\
							 <td class="result"><span>' +
                        result +
                        '</span> </td>\
						 </tr>';
                } else {
                    html +=
                        '\
						 <tr class="' +
                        k +
                        '">\
							 <td class="order"><span>' +
                        (i + 1) +
                        '</span> </td>\
							 <td><a href="#" onclick="$interactivevideo.seek(' +
                        i +
                        ');return false">' +
                        $interactivevideo.secondsToHour(e.startTime) +
                        '</a> </td>\
							 <td class="result"><span>' +
                        result +
                        '</span> </td>\
						 </tr>';
                }
            }
            if (html != '') {
                html +=
                    '\
				 <tr>\
					 <th colspan="2" id="resultsSummaryTH"><span class="title">' +
                    i18n.total +
                    ' <em>(' +
                    i18n.seeAll +
                    ')</em></span> </th>\
					 <td id="resultsSummary"><span>-</span> </td>\
				 </tr>';
                html =
                    '\
				 <table>\
				 <colgroup>\
					 <col width="10%">\
					 <col width="60%">\
					 <col width="30%">\
				 </colgroup>\
				 <tr>\
					 <th><span class="title">&nbsp;</span></th>\
					 <th><span class="title">' +
                    i18n.slide +
                    '</span> </th>\
					 <th><span class="title">' +
                    i18n.score +
                    '</span> </th>\
				 </tr>' +
                    cover +
                    html +
                    '</table>';
                $('#activity-results').html(html);
                $interactivevideo.table = $('#activity-results');
                var tds = $('.result', $interactivevideo.table);
                $interactivevideo.resultsViewer.getFinalResult(tds);
            }
        },

        getFinalResult: function (tds) {
            var complete = true;
            var result = 0;
            var counter = 0;
            tds.each(function () {
                var t = $(this).text();
                if (t == '- ') complete = false;
                if (t.indexOf('%') != -1) {
                    result += parseFloat(t);
                    counter++;
                } else if (
                    t == InteractiveVideo.i18n.seen &&
                    InteractiveVideo.scoreNIA
                ) {
                    result += 100;
                    counter++;
                }
            });
            if (counter == 0) counter++;
            if (
                !InteractiveVideo.scoreNIA &&
                counter >= $interactivevideo.numSlides
            )
                complete = true;
            if (complete) {
                $('#resultsSummary').html(
                    '<span>' +
                        $interactivevideo.formatResult(
                            (result / counter).toFixed(2)
                        ) +
                        '%</span>'
                );
                $('BODY').addClass('activity-completed');
            }
        },
        toggle: function (e) {
            if ($interactivevideo.isWorking) return false;
            $interactivevideo.isWorking = true;
            var block = $('#activity-results');
            if (e.className == 'show') {
                block.fadeIn(500, function () {
                    e.className = 'hide';
                    $interactivevideo.isWorking = false;
                });
            } else {
                block.fadeOut(500, function () {
                    e.className = 'show';
                    $interactivevideo.isWorking = false;
                });
            }
        },
    },

    msg: function (type, txt, formId, rightAnswer) {
        var k = 'success';
        if (type == 'alert') k = 'alert';
        else if (type == 'error') k = 'danger';
        else if (type == 'info') k = 'info';
        k = 'exe-block-' + k;
        var msg =
            '<div class="exe-block-msg ' + k + '"><p>' + txt + '</p></div>';
        if (rightAnswer) msg += rightAnswer;
        $('#' + formId + 'Message').html(msg);
    },

    seek: function (order) {
        if (
            $interactivevideo.visibleSlide == order &&
            $('BODY').hasClass('active')
        ) {
            return false;
        }
        $interactivevideo.isSeek = true;
        if ($interactivevideo.hasPlayed != true) {
            $interactivevideo.controls.seek(
                InteractiveVideo.slides[order].startTime - 1
            );
        } else {
            $interactivevideo.controls.seek(
                InteractiveVideo.slides[order].startTime
            );
        }
    },

    isFullScreen: function () {
        if (this.type == 'mediateca' && jwplayer().getFullscreen()) return true;
        else if (
            this.type == 'youtube' &&
            $('iframe').width() == $(window).width()
        )
            return true;
        else if (
            this.type == 'local' &&
            typeof mejsFullScreen != 'undefined' &&
            mejsFullScreen == true
        )
            return true;
        return false;
    },

    slide: {
        enable: function (slide, e, order) {
            var html = '';
            var id = $interactivevideo.baseId;
            var i18n = InteractiveVideo.i18n;
            var i;

            // Text
            if (e.type == 'text') {
                slide.html(e.text);
                for (var i = 0; i < InteractiveVideo.slides.length; i++) {
                    if (e == InteractiveVideo.slides[i]) {
                        $interactivevideo.updateResult(i, i18n.seen);
                        e.results = {
                            viewed: true,
                        };
                    }
                }

                // Image
            } else if (e.type == 'image') {
                var img = new Image();
                img.src = $('#exe-interactive-video-img-' + e.url).attr('src');
                img.onload = function () {
                    slide.html(
                        $interactivevideo.getImage(
                            e,
                            img.width,
                            img.height,
                            img.src
                        )
                    );
                    for (var i = 0; i < InteractiveVideo.slides.length; i++) {
                        if (e == InteractiveVideo.slides[i]) {
                            $interactivevideo.updateResult(i, i18n.seen);
                            e.results = {
                                viewed: true,
                            };
                        }
                    }
                };

                // Single choice
            } else if (e.type == 'singleChoice') {
                $interactivevideo.singleChoice.create(slide, id, order, e);

                // Multiple choice
            } else if (e.type == 'multipleChoice') {
                $interactivevideo.multipleChoice.create(slide, id, order, e);

                // Dropdown
            } else if (e.type == 'dropdown') {
                $interactivevideo.dropdownActivity.create(slide, id, order, e);

                // Cloze
            } else if (e.type == 'cloze') {
                $interactivevideo.clozeActivity.create(slide, id, order, e);

                // Match elements
            } else if (e.type == 'matchElements') {
                $interactivevideo.matchElements.create(slide, id, order, e);

                // Unsorted list
            } else if (e.type == 'sortableList') {
                $interactivevideo.sortableList.create(slide, id, order, e);
            }

            $('BODY').addClass('active');
            $('#slide').before(
                '<a href="#slide" id="slide-link" class="sr-av">' +
                    InteractiveVideo.i18n.slide +
                    '</a>'
            );
            $('#slide-link').focus();
        },
        show: function (e, order) {
            // e = the object
            e.current = true;
            $interactivevideo.visibleSlide = order;
            if ($interactivevideo.isFullScreen()) {
                $interactivevideo.controls.pause();
                // Not displayed with MediaElement
                if ($interactivevideo.type != 'local')
                    alert(InteractiveVideo.i18n.fsWarning);
            }
            if (!e.endTime) $interactivevideo.controls.pause();

            var slide = $('#slide');
            slide.html('');
            slide.attr('class', e.type);

            if ($('BODY').hasClass('active') || $interactivevideo.isSeek) {
                $('#activity').css('width', '100%');
                $interactivevideo.slide.enable(slide, e, order);
            } else {
                $('#player').css('margin-left', 0);
                $('#activity').css('width', '100%');
                $interactivevideo.slide.enable(slide, e, order);
            }
        },
        hide: function (trigger) {
            $interactivevideo.visibleSlide = '';
            $('#activity').css('width', '50%');
            $('BODY').removeClass('active');
        },
    },

    formatResult: function (result) {
        return result.toString().replace('.00', '').replace('.', ',');
    },

    updateResult: function (question, result) {
        var tds = $('.result', $interactivevideo.table);
        tds.eq(question).html('<span>' + result + '</span>');
        $interactivevideo.resultsViewer.getFinalResult(tds);
        $interactivevideo.updateScore(question, result);
    },

    dropdownActivity: {
        create: function (slide, id, order, e) {
            var html = $interactivevideo.getForm.header(
                id,
                order,
                'dropdownActivity'
            );
            html += '<p class="question">' + e.text + '</p>';
            html += '<p class="actions">';
            html += $interactivevideo.getForm.sendButton(
                id,
                order,
                'dropdownActivity'
            );
            html += '</p>';
            html += '<div id="' + id + 'dropdownActivityFormMessage">';
            html += '</div>';
            html += $interactivevideo.getForm.footer();
            slide.html(html);
            // Options
            var opts = [];
            var spans = $('SPAN', '#' + id + 'dropdownActivityForm');
            var rightAnswers = [];
            spans.each(function (i) {
                if (this.style.textDecoration == 'line-through') {
                    var t = $(this).text();
                    opts.push(t);
                    rightAnswers.push(t);
                    $(this)
                        .hide()
                        .attr('id', 'right-answer-' + id + '-' + i);
                }
            });
            // Add more words
            if (e.additionalWords) {
                for (var z = 0; z < e.additionalWords.length; z++) {
                    opts.push(e.additionalWords[z]);
                }
            }
            //Create the select:
            var newV = $interactivevideo.randomizeArray(opts);
            var newOptions = '<option value=""> </option>';
            for (var x = 0; x < newV.length; x++) {
                var val = newV[x];
                var h = '<option value="' + val + '">' + val + '</option>';
                newOptions += h;
            }
            //Add the selects:
            spans.each(function (i) {
                if (this.style.textDecoration == 'line-through') {
                    var sel = $(
                        '<select id="answer-' +
                            id +
                            '-' +
                            i +
                            '" name="answer-' +
                            id +
                            '-' +
                            i +
                            '">' +
                            newOptions +
                            '</select>'
                    );
                    $(this).before(sel);
                }
            });
            var activityForm = $('#' + id + 'dropdownActivityForm');
            activityForm.show();

            //Show the previous results
            var currentQuestion = InteractiveVideo.slides[order];
            if (currentQuestion.results) {
                var i18n = InteractiveVideo.i18n;
                activityForm.addClass('disabled');
                if (currentQuestion.results.score == 100) {
                    $interactivevideo.msg(
                        'success',
                        i18n.right,
                        id + 'dropdownActivityForm'
                    );
                } else {
                    $interactivevideo.msg(
                        'error',
                        i18n.wrong,
                        id + 'dropdownActivityForm',
                        $interactivevideo.dropdownActivity.getRightAnswer(
                            rightAnswers
                        )
                    );
                }
                var selectedValues = currentQuestion.results.selectedValues;
                var selectFields = $('SELECT', activityForm);
                for (var w = 0; w < selectedValues.length; w++) {
                    selectFields
                        .eq(w)
                        .val(selectedValues[w])
                        .attr('disabled', 'disabled');
                    if (selectedValues[w] != spans.eq(w).text())
                        selectFields.eq(w).attr('class', 'field-with-error');
                }
            }
        },
        saveResults: function (question, result, slide, selectedValues) {
            var currentQuestion = InteractiveVideo.slides[question];
            if (!currentQuestion.results) {
                currentQuestion.results = {
                    score: result,
                    selectedValues: selectedValues,
                };
            }
            result = $interactivevideo.formatResult(result);
            $interactivevideo.updateResult(question, result + '%');
        },
        getRightAnswer: function (rightAnswers) {
            var rightAnswer = '';
            for (var i = 0; i < rightAnswers.length; i++) {
                rightAnswer += '<li>' + rightAnswers[i] + '</li>';
            }
            if (rightAnswer != '') rightAnswer = '<ul>' + rightAnswer + '</ul>';
            return (
                '<p><strong>Respuesta correcta: </strong>' +
                rightAnswer +
                '</p>'
            );
        },
        validate: function (question, id) {
            var e = document.getElementById(id);

            var answers = e.getElementsByTagName('SELECT');
            var answered = true;
            var errors = false;
            var rightAnswers = [];
            var rightAnswered = 0;
            for (i = 0; i < answers.length; i++) {
                if (typeof answers[i].options != 'undefined') {
                    var currFieldValue = answers[i].value;
                    // Fill-in all the fields
                    if (currFieldValue == '') answered = false;
                    var currFieldId = answers[i].id;
                    var rightAnswer = $('#right-' + currFieldId).text();
                    var css = '';
                    if (rightAnswer != currFieldValue) {
                        css = 'field-with-error';
                        errors = true;
                    } else rightAnswered++;
                    answers[i].className = css;
                }
            }
            // Get the right answers
            $('SPAN', e).each(function (i) {
                if (this.style.textDecoration == 'line-through') {
                    rightAnswers.push($(this).text());
                }
            });

            if (!answered) {
                $interactivevideo.msg(
                    'info',
                    'Aún no has completado la actividad',
                    e.id
                );
                return false;
            }

            var slide = $('#' + id);
            var selectedValues = [];
            slide.addClass('disabled');
            $('SELECT', slide)
                .each(function () {
                    selectedValues.push(this.value);
                })
                .attr('disabled', 'disabled');

            var i18n = InteractiveVideo.i18n;

            if (errors) {
                var result = (
                    (rightAnswered * 100) /
                    rightAnswers.length
                ).toFixed(2);
                var extra =
                    $interactivevideo.dropdownActivity.getRightAnswer(
                        rightAnswers
                    );
                $interactivevideo.msg('error', i18n.wrong, id, extra);
                $interactivevideo.dropdownActivity.saveResults(
                    question,
                    result,
                    slide,
                    selectedValues
                );
            } else {
                $interactivevideo.msg('success', i18n.right, id);
                $interactivevideo.dropdownActivity.saveResults(
                    question,
                    100,
                    slide,
                    selectedValues
                );
            }
        },
    },

    sortableList: {
        create: function (slide, id, order, e) {
            var i18n = InteractiveVideo.i18n;
            var currentQuestion = InteractiveVideo.slides[order];
            var html = $interactivevideo.getForm.header(
                id,
                order,
                'sortableList'
            );
            if (e.text && e.text != '') html += '<div>' + e.text + '</div>';
            html += '<ul id="' + id + 'sortableList" class="sortable">';
            if (!currentQuestion.results) {
                var toSort = [];
                for (w = 0; w < e.items.length; w++) {
                    toSort.push(e.items[w]);
                }
                var lis = $interactivevideo.randomizeArray(toSort);
                html += $interactivevideo.sortableList.getListHTML(lis, id);
            } else {
                var userAnswers = '';
                var selectedValues = currentQuestion.results.selectedValues;
                for (var h = 0; h < selectedValues.length; h++) {
                    html += '<li>' + e.items[selectedValues[h]] + '</li>';
                }
            }
            html += '</ul>';
            html +=
                '<p class="instructions" id="' +
                id +
                'sortableListInstructions">' +
                i18n.sortableListInstructions +
                '</p>';
            html += '<p class="actions">';
            html += $interactivevideo.getForm.sendButton(
                id,
                order,
                'sortableList'
            );
            html += '</p>';
            html += '<div id="' + id + 'sortableListFormMessage">';
            html += '</div>';
            html += $interactivevideo.getForm.footer();

            slide.html(html);

            //Show the previous results
            if (currentQuestion.results) {
                $('#' + id + 'sortableListForm').addClass('disabled');
                if (currentQuestion.results.score == 100) {
                    $interactivevideo.msg(
                        'success',
                        i18n.right,
                        id + 'sortableListForm'
                    );
                } else {
                    $interactivevideo.msg(
                        'error',
                        i18n.wrong,
                        id + 'sortableListForm',
                        $interactivevideo.sortableList.getRightAnswer(e.items)
                    );
                }
            } else {
                $('#' + id + 'sortableList')
                    .sortable()
                    .bind('sortupdate', function (e, ui) {
                        $('#' + id + 'sortableListInstructions').hide();
                        $interactivevideo.sortableList.updateLinks(id);
                    });
            }

            $('#' + id + 'sortableListForm').show();
        },
        getLinksHTML: function (i, id) {
            var i18n = InteractiveVideo.i18n;
            return (
                '<span> <a href="#" class="up" onclick="$interactivevideo.sortableList.sortList(this,' +
                i +
                ',' +
                (i - 1) +
                ",'" +
                id +
                '\');return false" title="' +
                i18n.up +
                ': ' +
                (i + 1) +
                ' → ' +
                i +
                '"><span class="sr-av">' +
                i18n.up +
                '</span></a> <a href="#" class="down" onclick="$interactivevideo.sortableList.sortList(this,' +
                i +
                ',' +
                (i + 1) +
                ",'" +
                id +
                '\');return false" title="' +
                i18n.down +
                ': ' +
                (i + 1) +
                ' → ' +
                (i + 2) +
                '"><span class="sr-av">' +
                i18n.down +
                '</span></a></span>'
            );
        },
        updateLinks: function (id) {
            var ul = $('#' + id + 'sortableList');
            var lis = $('li', ul);
            $('SPAN', ul).remove();
            lis.each(function (i) {
                this.className = '';
                if (i == 0) this.className = 'first';
                if (i + 1 == lis.length) this.className = 'last';
                this.innerHTML += $interactivevideo.sortableList.getLinksHTML(
                    i,
                    id
                );
            });
        },
        getListHTML: function (lis, id) {
            var html = '';
            for (var i = 0; i < lis.length; i++) {
                html += '<li';
                if (i == 0) html += ' class="first"';
                if (i + 1 == lis.length) html += ' class="last"';
                html +=
                    '>' +
                    lis[i] +
                    $interactivevideo.sortableList.getLinksHTML(i, id) +
                    '</li>';
            }
            return html;
        },
        sortList: function (e, a, b, id) {
            // LI - FROM - TO
            $('#' + id + 'sortableListInstructions').hide();
            var list = $('#' + id + 'sortableList');
            list.sortable('destroy');
            var lis = $('LI', list);
            if (b < 0 || b > lis.length - 1) return false;
            var newList = [];
            var li, prev, current, next;
            for (var i = 0; i < lis.length; i++) {
                li = lis[i].innerHTML.split('<span>')[0].split('<SPAN>')[0];
                newList.push(li);
                if (i == a - 1) prev = li;
                else if (i == a) current = li;
                else if (i == a + 1) next = li;
            }
            newList[b] = current;
            if (b < a) {
                // Up
                newList[a] = prev;
            } else {
                // Down
                newList[a] = next;
            }
            list.html(
                $interactivevideo.sortableList.getListHTML(newList, id)
            ).sortable();
        },
        saveResults: function (question, result, slide, selectedValues) {
            var currentQuestion = InteractiveVideo.slides[question];
            if (!currentQuestion.results) {
                currentQuestion.results = {
                    score: result,
                    selectedValues: selectedValues,
                };
            }
            result = $interactivevideo.formatResult(result);
            $interactivevideo.updateResult(question, result + '%');
        },
        getRightAnswer: function (rightAnswers) {
            var rightAnswer = '';
            for (var i = 0; i < rightAnswers.length; i++) {
                rightAnswer += '<li>' + rightAnswers[i] + '</li>';
            }
            if (rightAnswer != '') rightAnswer = '<ul>' + rightAnswer + '</ul>';
            return (
                '<p><strong>' +
                InteractiveVideo.i18n.rightAnswer +
                ' </strong>' +
                rightAnswer +
                '</p>'
            );
        },
        validate: function (question, id) {
            var i18n = InteractiveVideo.i18n;
            var slide = $('#' + id);
            var lis = InteractiveVideo.slides[question].items;
            var error = false;
            var selectedValues = [];
            var answer;
            var answers = $('.sortable LI').each(function (i) {
                answer = $(this).html().split('<span>')[0];
                answer = answer.split('<SPAN>')[0];
                if (answer != lis[i]) error = true;
                selectedValues.push(lis.indexOf(answer));
            });
            slide.addClass('disabled');
            $('#' + id.replace('Form', '')).sortable('destroy');
            if (error) {
                var extra = $interactivevideo.sortableList.getRightAnswer(lis);
                $interactivevideo.msg('error', i18n.wrong, id, extra);
                $interactivevideo.sortableList.saveResults(
                    question,
                    0,
                    slide,
                    selectedValues
                );
            } else {
                $interactivevideo.msg('success', i18n.right, id);
                $interactivevideo.sortableList.saveResults(
                    question,
                    100,
                    slide,
                    selectedValues
                );
            }
        },
    },
    clozeActivity: {
        create: function (slide, id, order, e) {
            var i18n = InteractiveVideo.i18n;
            var html = $interactivevideo.getForm.header(
                id,
                order,
                'clozeActivity'
            );
            html += '<p class="question">' + e.text + '</p>';
            html += '<p class="actions">';
            html += $interactivevideo.getForm.sendButton(
                id,
                order,
                'clozeActivity'
            );
            html += '</p>';
            html += '<div id="' + id + 'clozeActivityFormMessage">';
            html += '</div>';
            html += $interactivevideo.getForm.footer();
            slide.html(html);
            // Options
            var opts = new Array();
            var spans = $('SPAN', '#' + id + 'clozeActivityForm');
            var rightAnswers = [];
            spans.each(function (i) {
                var l = this.innerHTML.length;
                if (this.style.textDecoration == 'line-through') {
                    var f = $(
                        '<input type="text" name="answer-' +
                            id +
                            '-' +
                            i +
                            '" id="answer-' +
                            id +
                            '-' +
                            i +
                            '" style="width:' +
                            l +
                            'em" />'
                    );
                    rightAnswers.push($(this).text());
                    $(this)
                        .hide()
                        .attr('id', 'right-answer-' + id + '-' + i)
                        .before(f);
                }
            });

            var activityForm = $('#' + id + 'clozeActivityForm');
            activityForm.show();

            //Show the previous results
            var currentQuestion = InteractiveVideo.slides[order];
            if (currentQuestion.results) {
                var myForm = $('#' + id + 'clozeActivityForm');
                myForm.addClass('disabled');
                if (currentQuestion.results.score == 100) {
                    $interactivevideo.msg(
                        'success',
                        i18n.right,
                        id + 'clozeActivityForm'
                    );
                } else {
                    $interactivevideo.msg(
                        'error',
                        i18n.wrong,
                        id + 'clozeActivityForm',
                        $interactivevideo.clozeActivity.getRightAnswer(
                            rightAnswers
                        )
                    );
                }
                var selectedValues = currentQuestion.results.selectedValues;
                var selectFields = $('INPUT[type=text]', activityForm);
                for (var w = 0; w < selectedValues.length; w++) {
                    selectFields
                        .eq(w)
                        .val(selectedValues[w])
                        .attr('disabled', 'disabled');
                    if (selectedValues[w] != spans.eq(w).text())
                        selectFields.eq(w).attr('class', 'field-with-error');
                }
            }
        },
        saveResults: function (question, result, slide, selectedValues) {
            var currentQuestion = InteractiveVideo.slides[question];
            if (!currentQuestion.results) {
                currentQuestion.results = {
                    score: result,
                    selectedValues: selectedValues,
                };
            }
            result = $interactivevideo.formatResult(result);
            $interactivevideo.updateResult(question, result + '%');
        },
        getRightAnswer: function (rightAnswers) {
            var rightAnswer = '';
            for (var i = 0; i < rightAnswers.length; i++) {
                rightAnswer += '<li>' + rightAnswers[i] + '</li>';
            }
            if (rightAnswer != '') rightAnswer = '<ul>' + rightAnswer + '</ul>';
            return (
                '<p><strong>' +
                InteractiveVideo.i18n.rightAnswer +
                ' </strong>' +
                rightAnswer +
                '</p>'
            );
        },
        validate: function (question, id) {
            var i18n = InteractiveVideo.i18n;
            var e = document.getElementById(id);
            var answers = e.getElementsByTagName('INPUT');
            var answered = true;
            var errors = false;
            var rightAnswers = [];
            var rightAnswered = 0;
            for (i = 0; i < answers.length; i++) {
                if (answers[i].type == 'text') {
                    var currFieldValue = answers[i].value;
                    if (currFieldValue == '') answered = false;
                    var currFieldId = answers[i].id;
                    var rightAnswer = $('#right-' + currFieldId).text();
                    rightAnswers.push(rightAnswer);
                    var css = '';
                    if (rightAnswer != currFieldValue) {
                        css = 'field-with-error';
                        errors = true;
                    } else rightAnswered++;
                    answers[i].className = css;
                }
            }

            if (!answered) {
                $interactivevideo.msg('info', i18n.notAnswered, e.id);
                return false;
            }

            var slide = $('#' + id);
            var selectedValues = [];
            $('INPUT[type=text]', slide)
                .each(function () {
                    selectedValues.push(this.value);
                })
                .attr('disabled', 'disabled');
            slide.addClass('disabled');
            if (errors) {
                var result = (
                    (rightAnswered * 100) /
                    rightAnswers.length
                ).toFixed(2);
                var extra =
                    $interactivevideo.clozeActivity.getRightAnswer(
                        rightAnswers
                    );
                $interactivevideo.msg('error', i18n.wrong, id, extra);
                $interactivevideo.clozeActivity.saveResults(
                    question,
                    result,
                    slide,
                    selectedValues
                );
            } else {
                $interactivevideo.msg('success', i18n.right, id);
                $interactivevideo.clozeActivity.saveResults(
                    question,
                    100,
                    slide,
                    selectedValues
                );
            }
        },
    },
    matchElements: {
        create: function (slide, id, order, e) {
            var i18n = InteractiveVideo.i18n;
            var html = $interactivevideo.getForm.header(
                id,
                order,
                'matchElements'
            );
            if (e.text && e.text != '') html += '<div>' + e.text + '</div>';
            html += '<div class="pairs">';
            var pairs = e.pairs;
            var pairsB = [];
            for (var i = 0; i < pairs.length; i++) {
                pairsB.push(pairs[i][1]);
            }

            var newPairs;
            for (var z = 0; z < pairs.length; z++) {
                newPairs = $interactivevideo.randomizeArray(pairsB);
                var pairsBhtml = '';
                for (var w = 0; w < newPairs.length; w++) {
                    pairsBhtml +=
                        '<option value="' +
                        newPairs[w] +
                        '">' +
                        newPairs[w] +
                        '</option>';
                }
                html +=
                    '\
				 <p class="pair">\
					 <label for="a-' +
                    order +
                    '-' +
                    z +
                    '" class="sr-av">' +
                    (z + 1) +
                    '. </label>\
					 <select name="a-' +
                    order +
                    '-' +
                    z +
                    '" id="a-' +
                    order +
                    '-' +
                    z +
                    '" disabled="disabled" class="random-a">\
						 <option value="' +
                    pairs[z][0] +
                    '">' +
                    pairs[z][0] +
                    '</option>\
					 </select>\
					  - <label for="b-' +
                    order +
                    '-' +
                    z +
                    '" class="sr-av">' +
                    (z + 1) +
                    'B. </label>\
					 <select name="b-' +
                    order +
                    '-' +
                    z +
                    '" id="b-' +
                    order +
                    '-' +
                    z +
                    '" class="random-b">\
						 <option value=""></option>\
						 ' +
                    pairsBhtml +
                    '\
					 </select>\
				 </p>';
            }
            html += '</div>';
            html += '<p class="actions">';
            html += $interactivevideo.getForm.sendButton(
                id,
                order,
                'matchElements'
            );
            html += '</p>';
            html += '<div id="' + id + 'matchElementsFormMessage">';
            html += '</div>';
            html += $interactivevideo.getForm.footer();
            slide.html(html);

            var activityForm = $('#' + id + 'matchElementsForm');
            activityForm.show();

            //Show the previous results
            var currentQuestion = InteractiveVideo.slides[order];
            if (currentQuestion.results) {
                activityForm.addClass('disabled');
                if (currentQuestion.results.score == 100) {
                    $interactivevideo.msg(
                        'success',
                        i18n.right,
                        id + 'matchElementsForm'
                    );
                } else {
                    $interactivevideo.msg(
                        'error',
                        i18n.wrong,
                        id + 'matchElementsForm',
                        $interactivevideo.matchElements.getRightAnswer(pairs)
                    );
                }
                var selectedValues = currentQuestion.results.selectedValues;
                var questionFields = $('SELECT.random-a', activityForm);
                var selectFields = $('SELECT.random-b', activityForm);
                for (var w = 0; w < selectedValues.length; w++) {
                    var selectedValue = selectedValues[w];
                    selectFields
                        .eq(w)
                        .val(selectedValue)
                        .attr('disabled', 'disabled');
                    // Get the right value
                    var question = questionFields.eq(w).val();
                    var rightValue;
                    for (var x = 0; x < pairs.length; x++) {
                        var pair = pairs[x];
                        if (pair[0] == question) rightValue = pair[1];
                    }
                    if (selectedValue != rightValue)
                        selectFields.eq(w).attr('class', 'field-with-error');
                }
            }
        },
        saveResults: function (question, result, slide, selectedValues) {
            var currentQuestion = InteractiveVideo.slides[question];
            if (!currentQuestion.results) {
                currentQuestion.results = {
                    score: result,
                    selectedValues: selectedValues,
                };
            }
            result = $interactivevideo.formatResult(result);
            $interactivevideo.updateResult(question, result + '%');
        },
        getRightAnswer: function (rightAnswers) {
            var rightAnswer = '';
            for (var i = 0; i < rightAnswers.length; i++) {
                rightAnswer +=
                    '<li>' +
                    rightAnswers[i][0] +
                    ' - ' +
                    rightAnswers[i][1] +
                    '</li>';
            }
            if (rightAnswer != '') rightAnswer = '<ul>' + rightAnswer + '</ul>';
            return (
                '<p><strong>' +
                InteractiveVideo.i18n.rightAnswer +
                ' </strong>' +
                rightAnswer +
                '</p>'
            );
        },
        validate: function (question, id) {
            var i18n = InteractiveVideo.i18n;
            var slide = $('#' + id);
            var pairs = InteractiveVideo.slides[question].pairs;
            var answered = true;
            var selects = $('SELECT.random-b', slide);
            var selectedValue;
            // var rightAnswers = [];
            var selectedValues = [];
            var rightAnswered = 0;
            for (var i = 0; i < pairs.length; i++) {
                selectedValue = selects.eq(i).val();
                selectedValues.push(selectedValue);
                if (selectedValue == '') answered = false;
                selects.eq(i).removeClass('field-with-error');
                if (selectedValue != pairs[i][1])
                    selects.eq(i).addClass('field-with-error');
                else rightAnswered++;
            }
            // Not 100% answered
            if (!answered) {
                $interactivevideo.msg('info', i18n.notAnswered, id);
                return false;
            }
            slide.addClass('disabled');
            $('select', slide).attr('disabled', 'disabled');
            if (rightAnswered == pairs.length) {
                // 100% right
                $interactivevideo.msg('success', i18n.right, id);
                $interactivevideo.matchElements.saveResults(
                    question,
                    100,
                    slide,
                    selectedValues
                );
            } else {
                // < 100%;
                var extra =
                    $interactivevideo.matchElements.getRightAnswer(pairs);
                $interactivevideo.msg('error', i18n.wrong, id, extra);
                // %
                var result = ((rightAnswered * 100) / pairs.length).toFixed(2);
                $interactivevideo.matchElements.saveResults(
                    question,
                    result,
                    slide,
                    selectedValues
                );
            }
        },
    },
    getForm: {
        header: function (id, order, name) {
            if ($interactivevideo.isInExe)
                return '<div id="' + id + name + 'Form">';
            return (
                '<form id="' +
                id +
                name +
                'Form" action="#" onsubmit="$interactivevideo[\'' +
                name +
                "'].validate(" +
                order +
                ',this.id);return false">'
            );
        },
        footer: function () {
            if ($interactivevideo.isInExe) return '</div>';
            return '</form>';
        },
        sendButton: function (id, order, name) {
            var i18n = InteractiveVideo.i18n;
            if ($interactivevideo.isInExe)
                return (
                    '<input type="button" name="' +
                    id +
                    name +
                    'FormSubmit" id="' +
                    id +
                    name +
                    'FormSubmit" value="' +
                    i18n.check +
                    '" onclick="$interactivevideo[\'' +
                    name +
                    "'].validate(" +
                    order +
                    ",'" +
                    id +
                    name +
                    'Form\');return false" />'
                );
            return (
                '<input type="submit" name="' +
                id +
                name +
                'FormSubmit" id="' +
                id +
                name +
                'FormSubmit" value="' +
                i18n.check +
                '" />'
            );
        },
    },
    singleChoice: {
        create: function (slide, id, order, e) {
            var i18n = InteractiveVideo.i18n;
            var html = $interactivevideo.getForm.header(
                id,
                order,
                'singleChoice'
            );
            html += '<p class="question">' + e.question + '</p>';
            html += '<div class="answers">';
            for (var i = 0; i < e.answers.length; i++) {
                html += '<p>';
                html +=
                    '<label for="' + id + 'singleChoiceFormAnswer' + i + '">';
                html +=
                    '<input type="radio" name="' +
                    id +
                    'singleChoiceFormAnswer" id="' +
                    id +
                    'singleChoiceFormAnswer' +
                    i +
                    '" value="' +
                    i +
                    '" /> ';
                html += e.answers[i][0];
                html += '</label>';
                html += '</p>';
            }
            html += '</div>';
            html += '<p class="actions">';
            html += $interactivevideo.getForm.sendButton(
                id,
                order,
                'singleChoice'
            );
            html += '</p>';
            html += '<div id="' + id + 'singleChoiceFormMessage">';
            html += '</div>';
            html += $interactivevideo.getForm.footer();
            slide.html(html);

            //Show the previous results
            var currentQuestion = InteractiveVideo.slides[order];
            if (currentQuestion.results) {
                var myForm = $('#' + id + 'singleChoiceForm');
                myForm.addClass('disabled');
                $("input[type='radio']", myForm)
                    .each(function () {
                        if (this.value == currentQuestion.results.selectedValue)
                            this.checked = true;
                    })
                    .attr('disabled', 'disabled');
                if (currentQuestion.results.score == 100) {
                    $interactivevideo.msg(
                        'success',
                        i18n.right,
                        id + 'singleChoiceForm'
                    );
                } else {
                    $interactivevideo.msg(
                        'error',
                        i18n.wrong,
                        id + 'singleChoiceForm',
                        $interactivevideo.singleChoice.getRightAnswer(
                            currentQuestion.answers
                        )
                    );
                }
            }
        },
        saveResults: function (question, result, slide, selectedValue) {
            var currentQuestion = InteractiveVideo.slides[question];
            if (!currentQuestion.results) {
                currentQuestion.results = {
                    score: result,
                    selectedValue: selectedValue,
                };
            }
            $interactivevideo.updateResult(question, result + '%');
        },
        getRightAnswer: function (questions) {
            var rightAnswer = '';
            for (var i = 0; i < questions.length; i++) {
                if (questions[i][1] == 1) rightAnswer = questions[i][0];
            }
            return (
                '<p><strong>' +
                InteractiveVideo.i18n.rightAnswer +
                ' </strong>' +
                rightAnswer +
                '</p>'
            );
        },
        validate: function (question, id) {
            var i18n = InteractiveVideo.i18n;
            var slide = $('#' + id);
            var selected = $("input[type='radio']:checked", slide);
            if (selected.length == 0) {
                $interactivevideo.msg('info', i18n.notAnswered, id);
            } else {
                var selectedValue = selected.val();
                var questions = InteractiveVideo.slides[question].answers;
                slide.addClass('disabled');
                $("input[type='radio']", slide).attr('disabled', 'disabled');
                if (questions[selectedValue][1] == 1) {
                    $interactivevideo.msg('success', i18n.right, id);
                    $interactivevideo.singleChoice.saveResults(
                        question,
                        100,
                        slide,
                        selectedValue
                    );
                } else {
                    var extra =
                        $interactivevideo.singleChoice.getRightAnswer(
                            questions
                        );
                    $interactivevideo.msg('error', i18n.wrong, id, extra);
                    $interactivevideo.singleChoice.saveResults(
                        question,
                        0,
                        slide,
                        selectedValue
                    );
                }
            }
        },
    },
    multipleChoice: {
        create: function (slide, id, order, e) {
            var i18n = InteractiveVideo.i18n;
            var html = $interactivevideo.getForm.header(
                id,
                order,
                'multipleChoice'
            );
            html += '<p class="question">' + e.question + '</p>';
            html += '<div class="answers">';
            for (var i = 0; i < e.answers.length; i++) {
                html += '<p>';
                html +=
                    '<label for="' + id + 'multipleChoiceFormAnswer' + i + '">';
                html +=
                    '<input type="checkbox" name="' +
                    id +
                    'multipleChoiceFormAnswer" id="' +
                    id +
                    'multipleChoiceFormAnswer' +
                    i +
                    '" value="' +
                    i +
                    '" /> ';
                html += e.answers[i][0];
                html += '</label>';
                html += '</p>';
            }
            html += '</div>';
            html += '<p class="actions">';
            html += $interactivevideo.getForm.sendButton(
                id,
                order,
                'multipleChoice'
            );
            html += '</p>';
            html += '<div id="' + id + 'multipleChoiceFormMessage">';
            html += '</div>';
            html += $interactivevideo.getForm.footer();
            slide.html(html);
            var currentQuestion = InteractiveVideo.slides[order];
            if (currentQuestion.results) {
                var myForm = $('#' + id + 'multipleChoiceForm');
                myForm.addClass('disabled');
                $("input[type='checkbox']", myForm)
                    .each(function () {
                        var selectedValues =
                            currentQuestion.results.selectedValues;
                        for (var z = 0; z < selectedValues.length; z++) {
                            if (selectedValues[z] == this.value)
                                this.checked = true;
                        }
                    })
                    .attr('disabled', 'disabled');
                if (currentQuestion.results.score == 100) {
                    $interactivevideo.msg(
                        'success',
                        i18n.right,
                        id + 'multipleChoiceForm'
                    );
                } else {
                    $interactivevideo.msg(
                        'error',
                        i18n.wrong,
                        id + 'multipleChoiceForm',
                        $interactivevideo.multipleChoice.getRightAnswer(
                            currentQuestion.answers
                        )
                    );
                }
            }
        },
        saveResults: function (question, result, slide, selectedValues) {
            var currentQuestion = InteractiveVideo.slides[question];
            if (!currentQuestion.results) {
                currentQuestion.results = {
                    score: result,
                    selectedValues: selectedValues,
                };
            }
            result = $interactivevideo.formatResult(result);
            $interactivevideo.updateResult(question, result + '%');
        },
        getRightAnswer: function (questions) {
            var rightAnswers = [];
            for (var i = 0; i < questions.length; i++) {
                if (questions[i][1] == 1) rightAnswers.push(questions[i][0]);
            }
            var rightAnswer = '<ul>';
            for (var z = 0; z < rightAnswers.length; z++) {
                rightAnswer += '<li>' + rightAnswers[z] + '</li>';
            }
            rightAnswer += '</ul>';
            return (
                '<p><strong>' +
                InteractiveVideo.i18n.rightAnswer +
                ' </strong></p>' +
                rightAnswer
            );
        },
        validate: function (question, id) {
            var i18n = InteractiveVideo.i18n;
            var slide = $('#' + id);
            var selected = $("input[type='checkbox']:checked", slide);
            if (selected.length == 0) {
                $interactivevideo.msg('info', i18n.notAnswered, id);
            } else {
                slide.addClass('disabled');
                $("input[type='checkbox']", slide).attr('disabled', 'disabled');
                var questions = InteractiveVideo.slides[question].answers;
                // Check if it has errors
                var error = false;
                var selectedValues = [];
                var rightAnswered = 0;
                // 1/2 Check if the selected ones are right
                selected.each(function () {
                    var selectedValue = this.value;
                    selectedValues.push(selectedValue);
                    if (questions[selectedValue][1] != 1) error = true;
                    else rightAnswered++;
                });
                // 2/2 Check if those which are not selected should have been selected
                // Right answers
                var rightAnswers = 0;
                for (var i = 0; i < questions.length; i++) {
                    if (questions[i][1] == 1) {
                        rightAnswers++;
                    }
                }
                if (selected.length > rightAnswers) {
                    error = true;
                    rightAnswered = 0;
                }
                if (rightAnswers > rightAnswered) error = true;
                if (error) {
                    var extra =
                        $interactivevideo.multipleChoice.getRightAnswer(
                            questions
                        );
                    $interactivevideo.msg('error', i18n.wrong, id, extra);
                    // %
                    var result = ((rightAnswered * 100) / rightAnswers).toFixed(
                        2
                    );
                    $interactivevideo.multipleChoice.saveResults(
                        question,
                        result,
                        slide,
                        selectedValues
                    );
                } else {
                    $interactivevideo.msg('success', i18n.right, id);
                    // To do: save more than one selected option
                    $interactivevideo.multipleChoice.saveResults(
                        question,
                        100,
                        slide,
                        selectedValues
                    );
                }
            }
        },
    },
    track: function (position) {
        if (
            typeof InteractiveVideo === 'undefined' ||
            typeof InteractiveVideo.slides == 'undefined'
        )
            return;
        var position = Math.round(position).toString();
        var slides = InteractiveVideo.slides;
        var i = slides.length;
        var e;
        while (i--) {
            e = slides[i];
            if (e.startTime.toString() == position) {
                if (e.current == false) {
                    this.slide.show(e, i);
                } else {
                }
            } else if (e.endTime && e.endTime.toString() == position) {
                this.slide.hide('case 3');
            } else {
                e.current = false;
            }
        }
    },
    getImage: function (e, w, h, src) {
        var maxW = 448;
        var maxH = 356;

        if ($('#activity').css('height') == '478px') {
            maxW = 640;
            maxH = 478;
        }

        var newW = w;
        var newH = h;
        var css = 'square';

        if (w == h) {
            // Square
            if (w > maxW || h > maxW) {
                newW = maxW;
                newH = maxW;
            }
        } else if (w > h) {
            // Horizontal
            css = 'horizontal';
            if (w > maxW || h > maxW) {
                newW = maxW;
                newH = Math.round((h * newW) / w);
            }
        } else {
            // Vertical
            css = 'vertical';
            if (w > maxW || h > maxW) {
                newH = maxW;
                newW = Math.round((h * newH) / h);
            }
        }
        if (newH > maxH) {
            newW = Math.round((maxH * newW) / newH);
            newH = maxH;
        }
        return (
            '<img src="' +
            src +
            '" alt="' +
            e.description +
            '" class="' +
            css +
            '" width="' +
            newW +
            '" height="' +
            newH +
            '" style="display:block;margin-top:' +
            (maxH - newH) / 2 +
            'px" /><a href="' +
            src +
            '" target="_blank">' +
            InteractiveVideo.i18n.newWindow +
            '</a>'
        );
    },

    observeMutations: function (element) {
        if (!element) return;

        if (!$interactivevideo.observers)
            $interactivevideo.observers = new Map();

        if ($interactivevideo.observers.has(element))
            return $interactivevideo.observers.get(element);

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                const mode = element.getAttribute('mode');
                if (
                    (mutation.attributeName === 'mode' && mode === 'edition') ||
                    (mutation.attributeName === 'node-selected' &&
                        mode === 'view')
                ) {
                    $interactivevideo.observersDisconnect();
                }
            });
        });

        observer.observe(element, {
            attributes: true,
            attributeFilter: ['mode', 'node-selected'],
        });

        $interactivevideo.observers.set(element, observer);

        return observer;
    },

    observersDisconnect: function () {
        if (!$interactivevideo || !InteractiveVideo) return;

        if ($interactivevideo.youtubeCounter) {
            clearInterval($interactivevideo.youtubeCounter);
            $interactivevideo.youtubeCounter = null;
        }
        if ($interactivevideo.localCounter) {
            clearInterval($interactivevideo.localCounter);
            $interactivevideo.localCounter = null;
        }

        $('.interactive-video').find('.Games-ReportIconDiv').remove();

        if ($interactivevideo.observers) {
            $interactivevideo.observers.forEach((observer) => {
                observer.disconnect();
            });
            $interactivevideo.observers.clear();
        }
    },

    getOptions: function (IV) {
        const $idevices = $('.idevice_node'),
            $video = $('.exe-interactive-video').eq(0),
            deviceId = $video.closest('.idevice_node').attr('id'),
            index = $idevices.index($('#' + deviceId));

        let title =
            $video.closest('article').find('header .box-title').text() || '';
        title = title.replace(/"/g, ' ');

        if (!IV.scorm) IV.scorm = {};
        if (IV.scorm.isScorm == null) IV.scorm.isScorm = 0;
        if (!IV.scorm.textButtonScorm)
            IV.scorm.textButtonScorm = 'Guardar puntuación';

        return {
            id: IV.ideviceID,
            scorerp: 0,
            weighted: IV.weighted != null ? IV.weighted : 100,
            evaluation: !!(IV.evaluationID && IV.evaluationID.length),
            evaluationID: IV.evaluationID || '',
            isInExe: this.isInExe,
            main: '.exe-interactive-video',
            idevice: 'exe-interactive-video',
            idevicePath: this.idevicePath,
            textButtonScorm: IV.scorm.textButtonScorm,
            isScorm: IV.scorm.isScorm,
            repeatActivity: true,
            msgs: IV.i18n,
            ideviceNumber: index + 1,
            title: title,
        };
    },
};

$(function () {
    var contentElement = document.getElementById(
        'exe-interactive-video-contents'
    );

    if (contentElement) {
        try {
            var jsonContent =
                contentElement.textContent || contentElement.innerHTML;
            jsonContent = jsonContent.trim();

            InteractiveVideo = JSON.parse(jsonContent);
        } catch (error) {
            console.error('Interactive Video: Error parsing JSON', error);
            InteractiveVideo = { slides: [], i18n: $interactivevideo.i18n };
        }
    }

    $interactivevideo.init();
});

/*
 * HTML5 Sortable jQuery Plugin
 * https://github.com/voidberg/html5sortable
 *
 * Original code copyright 2012 Ali Farhadi.
 * This version is mantained by Alexandru Badiu <andu@ctrlz.ro> & Lukas Oppermann <lukas@vea.re>
 *
 *
 * Released under the MIT license.
 */
!(function (e, t) {
    'function' == typeof define && define.amd
        ? define(['jquery'], t)
        : 'object' == typeof exports
          ? (module.exports = t(require('jquery')))
          : (e.sortable = t(e.jQuery));
})(this, function (e) {
    'use strict';
    var t,
        a,
        r = e(),
        n = [],
        i = function (e) {
            (e.off('dragstart.h5s'),
                e.off('dragend.h5s'),
                e.off('selectstart.h5s'),
                e.off('dragover.h5s'),
                e.off('dragenter.h5s'),
                e.off('drop.h5s'));
        },
        o = function (e) {
            (e.off('dragover.h5s'), e.off('dragenter.h5s'), e.off('drop.h5s'));
        },
        d = function (e, t) {
            ((e.dataTransfer.effectAllowed = 'move'),
                e.dataTransfer.setData('text', ''),
                e.dataTransfer.setDragImage &&
                    e.dataTransfer.setDragImage(t.item, t.x, t.y));
        },
        s = function (e, t) {
            return (
                t.x || (t.x = parseInt(e.pageX - t.draggedItem.offset().left)),
                t.y || (t.y = parseInt(e.pageY - t.draggedItem.offset().top)),
                t
            );
        },
        l = function (e) {
            return { item: e[0], draggedItem: e };
        },
        f = function (e, t) {
            var a = l(t);
            ((a = s(e, a)), d(e, a));
        },
        h = function (e, t) {
            return 'undefined' == typeof e ? t : e;
        },
        g = function (e) {
            (e.removeData('opts'),
                e.removeData('connectWith'),
                e.removeData('items'),
                e.removeAttr('aria-dropeffect'));
        },
        c = function (e) {
            (e.removeAttr('aria-grabbed'),
                e.removeAttr('draggable'),
                e.removeAttr('role'));
        },
        u = function (e, t) {
            return e[0] === t[0]
                ? !0
                : void 0 !== e.data('connectWith')
                  ? e.data('connectWith') === t.data('connectWith')
                  : !1;
        },
        p = function (e) {
            var t = e.data('opts') || {},
                a = e.children(t.items),
                r = t.handle ? a.find(t.handle) : a;
            (o(e), g(e), r.off('mousedown.h5s'), i(a), c(a));
        },
        m = function (t) {
            var a = t.data('opts'),
                r = t.children(a.items),
                n = a.handle ? r.find(a.handle) : r;
            (t.attr('aria-dropeffect', 'move'), n.attr('draggable', 'true'));
            var i = (document || window.document).createElement('span');
            'function' != typeof i.dragDrop ||
                a.disableIEFix ||
                n.on('mousedown.h5s', function () {
                    -1 !== r.index(this)
                        ? this.dragDrop()
                        : e(this).parents(a.items)[0].dragDrop();
                });
        },
        v = function (e) {
            var t = e.data('opts'),
                a = e.children(t.items),
                r = t.handle ? a.find(t.handle) : a;
            (e.attr('aria-dropeffect', 'none'),
                r.attr('draggable', !1),
                r.off('mousedown.h5s'));
        },
        b = function (e) {
            var t = e.data('opts'),
                a = e.children(t.items),
                r = t.handle ? a.find(t.handle) : a;
            (i(a), r.off('mousedown.h5s'), o(e));
        },
        x = function (i, o) {
            var s = e(i),
                l = String(o);
            return (
                (o = e.extend(
                    {
                        connectWith: !1,
                        placeholder: null,
                        dragImage: null,
                        disableIEFix: !1,
                        placeholderClass: 'sortable-placeholder',
                        draggingClass: 'sortable-dragging',
                        hoverClass: !1,
                    },
                    o
                )),
                s.each(function () {
                    var i = e(this);
                    if (/enable|disable|destroy/.test(l)) return void x[l](i);
                    ((o = h(i.data('opts'), o)), i.data('opts', o), b(i));
                    var s,
                        g,
                        c,
                        p = i.children(o.items),
                        v =
                            null === o.placeholder
                                ? e(
                                      '<' +
                                          (/^ul|ol$/i.test(this.tagName)
                                              ? 'li'
                                              : 'div') +
                                          ' class="' +
                                          o.placeholderClass +
                                          '"/>'
                                  )
                                : e(o.placeholder).addClass(o.placeholderClass);
                    if (!i.attr('data-sortable-id')) {
                        var I = n.length;
                        ((n[I] = i),
                            i.attr('data-sortable-id', I),
                            p.attr('data-item-sortable-id', I));
                    }
                    if (
                        (i.data('items', o.items),
                        (r = r.add(v)),
                        o.connectWith && i.data('connectWith', o.connectWith),
                        m(i),
                        p.attr('role', 'option'),
                        p.attr('aria-grabbed', 'false'),
                        o.hoverClass)
                    ) {
                        var C = 'sortable-over';
                        ('string' == typeof o.hoverClass && (C = o.hoverClass),
                            p.hover(
                                function () {
                                    e(this).addClass(C);
                                },
                                function () {
                                    e(this).removeClass(C);
                                }
                            ));
                    }
                    (p.on('dragstart.h5s', function (r) {
                        (r.stopImmediatePropagation(),
                            o.dragImage
                                ? (d(r.originalEvent, {
                                      item: o.dragImage,
                                      x: 0,
                                      y: 0,
                                  }),
                                  console.log(
                                      'WARNING: dragImage option is deprecated and will be removed in the future!'
                                  ))
                                : f(r.originalEvent, e(this), o.dragImage),
                            (t = e(this)),
                            t.addClass(o.draggingClass),
                            t.attr('aria-grabbed', 'true'),
                            (s = t.index()),
                            (a = t.height()),
                            (g = e(this).parent()),
                            t.parent().triggerHandler('sortstart', {
                                item: t,
                                placeholder: v,
                                startparent: g,
                            }));
                    }),
                        p.on('dragend.h5s', function () {
                            t &&
                                (t.removeClass(o.draggingClass),
                                t.attr('aria-grabbed', 'false'),
                                t.show(),
                                r.detach(),
                                (c = e(this).parent()),
                                t.parent().triggerHandler('sortstop', {
                                    item: t,
                                    startparent: g,
                                }),
                                (s !== t.index() || g.get(0) !== c.get(0)) &&
                                    t.parent().triggerHandler('sortupdate', {
                                        item: t,
                                        index: c
                                            .children(c.data('items'))
                                            .index(t),
                                        oldindex: p.index(t),
                                        elementIndex: t.index(),
                                        oldElementIndex: s,
                                        startparent: g,
                                        endparent: c,
                                    }),
                                (t = null),
                                (a = null));
                        }),
                        e(this)
                            .add([v])
                            .on('drop.h5s', function (a) {
                                return u(i, e(t).parent())
                                    ? (a.stopPropagation(),
                                      r.filter(':visible').after(t),
                                      t.trigger('dragend.h5s'),
                                      !1)
                                    : void 0;
                            }),
                        p
                            .add([this])
                            .on('dragover.h5s dragenter.h5s', function (n) {
                                if (u(i, e(t).parent())) {
                                    if (
                                        (n.preventDefault(),
                                        (n.originalEvent.dataTransfer.dropEffect =
                                            'move'),
                                        p.is(this))
                                    ) {
                                        var d = e(this).height();
                                        if (
                                            (o.forcePlaceholderSize &&
                                                v.height(a),
                                            d > a)
                                        ) {
                                            var s = d - a,
                                                l = e(this).offset().top;
                                            if (
                                                v.index() < e(this).index() &&
                                                n.originalEvent.pageY < l + s
                                            )
                                                return !1;
                                            if (
                                                v.index() > e(this).index() &&
                                                n.originalEvent.pageY >
                                                    l + d - s
                                            )
                                                return !1;
                                        }
                                        (t.hide(),
                                            v.index() < e(this).index()
                                                ? e(this).after(v)
                                                : e(this).before(v),
                                            r.not(v).detach());
                                    } else
                                        r.is(this) ||
                                            e(this).children(o.items).length ||
                                            (r.detach(), e(this).append(v));
                                    return !1;
                                }
                            }));
                })
            );
        };
    return (
        (x.destroy = function (e) {
            p(e);
        }),
        (x.enable = function (e) {
            m(e);
        }),
        (x.disable = function (e) {
            v(e);
        }),
        (e.fn.sortable = function (e) {
            return x(this, e);
        }),
        x
    );
});
