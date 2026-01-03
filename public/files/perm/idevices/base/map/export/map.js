/* eslint-disable no-undef */
/**
 * Mapa activity (Export)
 * Version: 1
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 *
 */
var $eXeMapa = {
    idevicePath: '',
    borderColors: {
        black: '#0E1625',
        blue: '#0089E5',
        green: '#3DA75A',
        red: '#F22420',
        white: '#ffffff',
        yellow: '#F2CB00',
        grey: '#777777',
        incorrect: '#F22420',
        correct: '#3DA75A',
    },
    colors: {
        black: '#0E1625',
        blue: '#0089E5',
        green: '#3DA75A',
        red: '#F22420',
        white: '#ffffff',
        yellow: '#F2CB00',
        grey: '#777777',
        incorrect: '#F22420',
        correct: '#3DA75A',
        game: 'rgba(0, 255, 0, 0.3)',
    },
    options: [],
    hasSCORMbutton: false,
    isInExe: false,
    userName: '',
    scorm: '',
    previousScore: '',
    initialScore: '',
    hasVideo: false,
    hasAreas: false,
    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',
    mScorm: null,

    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            'Map',
            'map',
            'mapa-IDevice'
        );
    },

    enable: function () {
        $eXeMapa.loadGame();
    },

    loadGame: function () {
        $eXeMapa.options = [];
        $eXeMapa.activities.each(function (i) {
            const dl = $('.mapa-DataGame', this),
                $imagesLink = $('.mapa-LinkImagesPoints', this),
                $audiosLink = $('.mapa-LinkAudiosPoints', this),
                $textLink = $('.mapa-LinkTextsPoints', this),
                $toolTips = $('.mapa-LinkToolTipPoints', this),
                $imagesMap = $('.mapa-LinkImagesMapas', this),
                $imagesSlides = $('.mapa-LinkImagesSlides', this),
                $audiosIdentifyLink = $('.mapa-LinkAudiosIdentify', this);

            let $urlmap = $('.mapa-ImageMap', this).eq(0).attr('src');

            $urlmap =
                typeof $urlmap == 'undefined'
                    ? $('.mapa-ImageMap', this).eq(0).attr('href')
                    : $urlmap;

            const mOption = $eXeMapa.loadDataGame(
                dl,
                $imagesLink,
                $textLink,
                $audiosLink,
                $imagesMap,
                $audiosIdentifyLink,
                $imagesSlides,
                $urlmap,
                $toolTips
            );

            mOption.scorerp = 0;
            mOption.idevicePath = $eXeMapa.idevicePath;
            mOption.main = 'mapaMainContainer-' + i;
            mOption.idevice = 'mapa-IDevice';

            $eXeMapa.options.push(mOption);

            const mapa = $eXeMapa.createInterfaceMapa(i);
            dl.before(mapa).remove();

            $eXeMapa.initElements(i);

            mOption.canvas = $('#mapaCanvas-' + i)[0];
            mOption.ctx = mOption.canvas.getContext('2d');

            $eXeMapa.addEvents(i);
            $eXeMapa.addPoints(i, mOption.activeMap.pts);
            $eXeMapa.showButtonAreas(mOption.activeMap.pts, i);

            if (mOption.evaluationG == 1) {
                $eXeMapa.showImageTest(mOption.url, mOption.altImage, i);
            }
            $eXeMapa.showImage(mOption.url, mOption.altImage, i);
            if (
                mOption.evaluationG == 1 ||
                mOption.evaluationG == 2 ||
                mOption.evaluationG == 3
            ) {
                $eXeMapa.startFinds(i);
            }
            mOption.localPlayer = document.getElementById(
                'mapaVideoLocal-' + i
            );
        });

        let node = document.querySelector('.page-content');
        if (this.isInExe) {
            node = document.getElementById('node-content');
        }
        if (node)
            $exeDevices.iDevice.gamification.observers.observeResize(
                $eXeMapa,
                node
            );

        $exeDevices.iDevice.gamification.math.updateLatex('.mapa-IDevice');
        if ($eXeMapa.hasVideo) $eXeMapa.loadApiPlayer();
    },

    loadApiPlayer: function () {
        if (!this.hasVideo) return;

        $exeDevices.iDevice.gamification.media.YouTubeAPILoader.load()
            .then(() => this.activatePlayer())
            .catch(() => this.showStartedButton());
    },

    activatePlayer: function () {
        $eXeMapa.options.forEach((option, i) => {
            if (
                $eXeMapa.hasVideo &&
                (option.player === null || option.playerIntro == null)
            ) {
                option.player = new YT.Player(`mapaVideoPoint-${i}`, {
                    width: '100%',
                    height: '100%',
                    videoId: '',
                    playerVars: {
                        color: 'white',
                        autoplay: 0,
                        controls: 0,
                    },
                    events: {
                        onReady: $eXeMapa.onPlayerReady.bind(this),
                    },
                });
            }
        });
    },

    youTubeReady: function () {
        this.activatePlayer();
    },

    showStartedButton: function () {
        $eXeMapa.options.forEach((option, i) => {
            if (
                (option && option.evaluationG == 1) ||
                option.evaluationG == 2 ||
                option.evaluationG == 3 ||
                option.evaluationG == 5
            ) {
                if (!option.gameStarted && !option.gameOver) {
                    $(`#mapaStartGame-${i}`).show();
                    $quickquestionsmultiplechoice.showMessage(1, '', i);
                }
            }
        });
    },

    onPlayerReady: function (event) {
        const iframe = event.target.getIframe();
        if (iframe && iframe.id) {
            const [prefix, instanceStr] = iframe.id.split('-');
            if (prefix === 'mapaVideoPoint') {
                const instance = parseInt(instanceStr, 10);
                if (!isNaN(instance)) {
                    const mOptions = $eXeMapa.options
                        ? $eXeMapa.options[instance]
                        : false;
                    if (
                        (mOptions && mOptions.evaluationG == 1) ||
                        mOptions.evaluationG == 2 ||
                        mOptions.evaluationG == 3 ||
                        mOptions.evaluationG == 5
                    ) {
                        $(`#mapaStartGame-${instance}`).show();
                    }
                    $eXeMapa.showMessage(1, '', instance);
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

    showImageTest(url, alt, instance) {
        const $Image = $('#mapaImageRect-' + instance);
        $Image.prop('src', url);
        $Image.attr('alt', alt);
    },

    addPoints: function (instance, points) {
        const mOptions = $eXeMapa.options[instance];
        let spoints = '',
            options = '',
            pts = [];

        $('#mapaMultimedia-' + instance)
            .find('.MQP-Point')
            .remove();
        $('#mapaMultimedia-' + instance)
            .find('.MQP-TextLink')
            .remove();
        $('#mapaOptionsTest-' + instance)
            .find('.MPQ-OptionTest')
            .remove();

        let numpoints =
            mOptions.evaluationG == 6 &&
            mOptions.numLevel == 0 &&
            mOptions.activeGame <= points.length
                ? mOptions.activeGame + 1
                : points.length;
        for (let i = 0; i < numpoints; i++) {
            const p = points[i],
                title =
                    mOptions.evaluationG != 1 &&
                    mOptions.evaluationG != 2 &&
                    mOptions.evaluationG != 3
                        ? p.title
                        : '';
            let point =
                    '<a href="#" class="MQP-PointActive MQP-Point MQP-Activo" data-number="' +
                    i +
                    '"   data-id="' +
                    p.id +
                    '" title="' +
                    title +
                    '"><span>' +
                    p.title +
                    '</span></a>',
                pt = {
                    number: i,
                    title: p.title,
                };
            p.number = i;
            pts.push(pt);
            if (p.iconType == 1 && mOptions.evaluationG != 1) {
                point = '';
            }
            if (p.iconType == 84 && mOptions.evaluationG != 1) {
                let font = $eXeMapa.adjustFontSize(p.fontSize);
                point =
                    '<a href="#" class="MQP-PointActive MQP-TextLink" style="color:' +
                    p.color +
                    ';font-size:' +
                    font.fontsize +
                    ';line-height:' +
                    font.lineheight +
                    ';max-width:' +
                    font.maxwidth +
                    ';"  data-number="' +
                    i +
                    '"  data-id="' +
                    p.id +
                    '" title="">' +
                    p.title +
                    '</a>';
            }
            spoints += point;
        }

        if (mOptions.evaluationG == 1) {
            pts.sort(function (a, b) {
                let nameA = a.title.toUpperCase();
                let nameB = b.title.toUpperCase();
                if (nameA < nameB) {
                    return -1;
                }
                if (nameA > nameB) {
                    return 1;
                }
                return 0;
            });

            for (let j = 0; j < pts.length; j++) {
                let option =
                    '<a href="#"class="MQP-PointActive MPQ-OptionTest"  data-id="' +
                    pts[j].id +
                    '" data-number="' +
                    pts[j].number +
                    '">' +
                    pts[j].title +
                    '</a>';
                options += option;
            }
        }
        $('#mapaMultimedia-' + instance).append(spoints);
        $('#mapaOptionsTest-' + instance).append(options);
        if (mOptions.evaluationG == 6 && mOptions.numLevel == 0) {
            $eXeMapa.paintAreas(instance, $eXeMapa.colors.game);
            if (
                mOptions.activeGame < mOptions.activeMap.pts.length &&
                !mOptions.gameOver
            ) {
                let lastElement = $(
                    '#mapaMultimedia-' +
                        instance +
                        ' .MQP-Point, #mapaOptionsTest-' +
                        instance +
                        ' .MPQ-OptionTest'
                ).last();
                lastElement.addClass('MQP-AnimatePulse');
            }
        }
    },
    paintPoints: function (instance) {
        let mOptions = $eXeMapa.options[instance];
        $('#mapaMultimedia-' + instance)
            .find('.MQP-Point')
            .each(function () {
                const number = parseInt($(this).data('number')),
                    icon =
                        mOptions.evaluationG == 1
                            ? 19
                            : mOptions.activeMap.pts[number].iconType;
                $eXeMapa.paintPoint(
                    $('#mapaImage-' + instance),
                    $(this),
                    mOptions.activeMap.pts[number].x,
                    mOptions.activeMap.pts[number].y,
                    icon,
                    instance
                );
            });
        if (mOptions.evaluationG == 1 || mOptions.evaluationG == -2) return;
        $('#mapaMultimedia-' + instance)
            .find('.MQP-TextLink')
            .each(function () {
                const number = parseInt($(this).data('number')),
                    fonstize = mOptions.activeMap.pts[number].fontSize;
                $eXeMapa.paintTextLink(
                    $('#mapaImage-' + instance),
                    $(this),
                    mOptions.activeMap.pts[number].x,
                    mOptions.activeMap.pts[number].y,
                    fonstize
                );
            });

        if (mOptions.evaluationG == 6 && mOptions.numLevel == 0) {
            $eXeMapa.paintAreas(instance, $eXeMapa.colors.game);
        } else {
            $eXeMapa.paintAreas(instance);
        }
    },
    paintPoint: function (image, cursor, x, y, icon, instance) {
        const mOptions = $eXeMapa.options[instance];
        let mI =
                icon == 19 || icon == 39 || icon == 59 || icon == 79
                    ? `${$eXeMapa.idevicePath}mapam${icon}.png`
                    : `${$eXeMapa.idevicePath}mapam${icon}.svg`,
            number = $(cursor).data('number');
        if (mOptions.evaluationG == 1 || mOptions.evaluationG == -2) {
            mI = `${$eXeMapa.idevicePath}mapam19.png`;
            if (mOptions.activeMap.pts[number].state == 1) {
                mI = `${$eXeMapa.idevicePath}mapaerror.png`;
            } else if (mOptions.activeMap.pts[number].state == 2) {
                mI = `${$eXeMapa.idevicePath}mapahit.png`;
            }
        }
        const icon1 = `url(${mI})`;

        $(cursor).css({
            'background-image': icon1,
        });

        const p = $eXeMapa.getIconPos(icon),
            w = Math.round($(cursor).width() * p.x),
            h = Math.round($(cursor).height() * p.y);
        $(cursor).hide();
        if (x > 0 || y > 0) {
            let wI = $(image).width() > 0 ? $(image).width() : 1,
                hI = $(image).height() > 0 ? $(image).height() : 1,
                lI = Math.round(
                    $(image).position().left + Math.round(wI * x) - w
                ),
                tI = Math.round(
                    $(image).position().top + Math.round(hI * y) - h
                );

            $(cursor).css({
                left: lI + 'px',
                top: tI + 'px',
                'z-index': 300,
            });
            $(cursor).show();
        }
    },

    getIconPos: function (icon) {
        let iconX = 0,
            iconY = 0;
        const c = [
                0, 1, 2, 3, 4, 5, 6, 10, 19, 20, 21, 22, 23, 24, 25, 26, 30, 39,
                40, 41, 42, 43, 44, 45, 46, 50, 59, 60, 61, 62, 63, 64, 65, 66,
                70, 79, 80, 81, 82, 83, 85, 86, 87, 88, 89, 90, 91, 95, 104,
                105, 106, 107, 108, 109, 100, 111, 115, 105, 124,
            ],
            uc = [18, 38, 58, 78, 84, 103, 123],
            dc = [
                7, 9, 15, 27, 29, 35, 47, 49, 55, 67, 69, 75, 92, 94, 100, 112,
                114, 120,
            ],
            lu = [11, 31, 51, 71, 96, 116],
            lc = [16, 36, 56, 76, 101, 121],
            ld = [8, 14, 28, 34, 48, 54, 68, 74, 93, 99, 113, 119],
            ru = [12, 32, 52, 72, 97, 117],
            rc = [17, 37, 57, 77, 102, 122],
            rd = [13, 33, 53, 73, 98, 118];
        if (c.indexOf(icon) != -1) {
            iconX = 0.5;
            iconY = 0.5;
        } else if (uc.indexOf(icon) != -1) {
            iconX = 0.5;
            iconY = 0;
        } else if (dc.indexOf(icon) != -1) {
            iconX = 0.5;
            iconY = 1;
        } else if (lu.indexOf(icon) != -1) {
            iconX = 0;
            iconY = 0;
        } else if (lc.indexOf(icon) != -1) {
            iconX = 0;
            iconY = 0.5;
        } else if (ld.indexOf(icon) != -1) {
            iconX = 0;
            iconY = 1;
        } else if (ru.indexOf(icon) != -1) {
            iconX = 1;
            iconY = 0;
        } else if (rc.indexOf(icon) != -1) {
            iconX = 1;
            iconY = 0.5;
        } else if (rd.indexOf(icon) != -1) {
            iconX = 1;
            iconY = 1;
        }
        return {
            x: iconX,
            y: iconY,
        };
    },
    paintTextLink: function (image, textlink, x, y, fonstize) {
        const $textLink = $(textlink),
            font = $eXeMapa.adjustFontSize(fonstize);

        $textLink.css({
            'font-size': font.fontsize,
            'line-height': font.lineheight,
            'max-width': font.maxwidth,
        });

        const wl = $textLink.width() / 2;
        $textLink.show();
        if (x > 0 || y > 0) {
            let wI = $(image).width() > 0 ? $(image).width() : 1,
                hI = $(image).height() > 0 ? $(image).height() : 1,
                lI = Math.round(
                    $(image).position().left + Math.round(wI * x) - wl
                ),
                tI = Math.round($(image).position().top + Math.round(hI * y));
            $textLink.css({
                left: lI + 'px',
                top: tI + 'px',
                'font-size': font.fontsize,
                'z-index': 300,
            });
            $textLink.show();
        }
    },
    paintAreas: function (instance, color = 'rgba(0, 0, 255, 0.001)') {
        const mOptions = $eXeMapa.options[instance];
        mOptions.ctx.clearRect(
            0,
            0,
            mOptions.canvas.width,
            mOptions.canvas.height
        );
        mOptions.hasAreas = false;
        mOptions.areas = [];

        const numpoints =
            mOptions.evaluationG == 6 &&
            mOptions.numLevel == 0 &&
            mOptions.activeGame <= mOptions.activeMap.pts.length
                ? mOptions.activeGame + 1
                : mOptions.activeMap.pts.length;
        for (let i = 0; i < numpoints; i++) {
            if (
                mOptions.activeMap.pts[i].iconType == 1 &&
                mOptions.evaluationG != 1
            ) {
                if (
                    mOptions.activeMap.pts[i].points &&
                    mOptions.activeMap.pts[i].points.length > 0
                ) {
                    $eXeMapa.paintArea(
                        instance,
                        mOptions.activeMap.pts[i].points,
                        color
                    );
                    mOptions.areas.push(mOptions.activeMap.pts[i]);
                    mOptions.hasAreas = true;
                }
            }
        }
    },

    isCursorInsidePolygon: function (instance, x, y) {
        const mOptions = $eXeMapa.options[instance];
        const rect = $('#mapaCanvas-' + instance)[0].getBoundingClientRect();
        for (let i = 0; i < mOptions.areas.length; i++) {
            const area = mOptions.areas[i],
                points = area.points;
            mOptions.ctx.beginPath();
            mOptions.ctx.moveTo(
                points[0].x * rect.width,
                points[0].y * rect.height
            );
            points.forEach(function (punto) {
                mOptions.ctx.lineTo(
                    rect.width * punto.x,
                    punto.y * rect.height
                );
            });
            mOptions.ctx.closePath();
            if (mOptions.ctx.isPointInPath(x, y)) {
                return area;
            }
        }
        return false;
    },

    paintArea: function (instance, points, color) {
        const mOptions = $eXeMapa.options[instance],
            ctx = mOptions.ctx,
            rect = $('#mapaCanvas-' + instance)[0].getBoundingClientRect();
        if (points.length < 3) return;
        ctx.beginPath();
        ctx.moveTo(
            Math.round(points[0].x * rect.width),
            Math.round(points[0].y * rect.height)
        );
        points.forEach((point) =>
            ctx.lineTo(
                Math.round(rect.width * point.x),
                Math.round(point.y * rect.height)
            )
        );
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    },

    updateSoundVideo: function (instance) {
        const mOptions = $eXeMapa.options[instance];
        if (mOptions.activeSilent) {
            if (
                mOptions.player &&
                typeof mOptions.player.getCurrentTime === 'function'
            ) {
                const time = Math.round(mOptions.player.getCurrentTime());
                if (time == mOptions.question.silentVideo) {
                    mOptions.player.mute(instance);
                } else if (time == mOptions.endSilent) {
                    mOptions.player.unMute(instance);
                }
            }
        }
    },

    loadDataGame: function (
        data,
        $imagesLink,
        $textLink,
        $audiosLink,
        $imagesMap,
        $audiosIdentifyLink,
        $imagesSlides,
        url,
        $toolTips
    ) {
        const json = data.text(),
            mOptions =
                $exeDevices.iDevice.gamification.helpers.isJsonString(json);

        mOptions.url = url;
        mOptions.optionsNumber =
            typeof mOptions.optionsNumber == 'undefined'
                ? 0
                : mOptions.optionsNumber;
        mOptions.hasAreas = false;
        mOptions.areas = [];
        mOptions.waitPlayVideo = false;
        mOptions.gameOver = false;
        mOptions.activeSlide = 0;
        mOptions.activeGame = 0;
        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.gameActived = false;
        mOptions.showData = false;
        mOptions.counter = 0;
        mOptions.gameStarted = false;
        mOptions.questionaireStarted = false;
        mOptions.activeQuestion = 0;
        mOptions.obtainedClue = false;
        mOptions.title = {};
        mOptions.activeTitle = 0;
        mOptions.showDetail = false;
        mOptions.visiteds = [];
        mOptions.levels = [];
        mOptions.numLevel = 0;
        mOptions.activeArea = null;
        mOptions.currentArea = null;
        mOptions.hasYoutube = $eXeMapa.setMedias(
            mOptions.points,
            $imagesLink,
            $textLink,
            $audiosLink,
            $imagesMap,
            $audiosIdentifyLink,
            $imagesSlides,
            false,
            mOptions.evaluationG,
            $toolTips
        );
        mOptions.titles = $eXeMapa.getDataGame1(
            mOptions.points,
            mOptions.evaluationG
        );
        const na = Math.floor(
            mOptions.selectsGame.length * (mOptions.percentajeQuestions / 100)
        );
        const nb = Math.floor(
            mOptions.titles.length * (mOptions.percentajeIdentify / 100)
        );
        mOptions.numberQuestions = mOptions.evaluationG == 4 ? na : nb;
        mOptions.numberQuestions =
            mOptions.evaluationG == 1
                ? mOptions.points.length
                : mOptions.numberQuestions;
        mOptions.numberPoints = $eXeMapa.getNumberPoints(mOptions.points);
        mOptions.activeMap = {};
        mOptions.activeMap.pts = Object.values(
            $.extend(true, {}, mOptions.points)
        );
        mOptions.activeMap.url = mOptions.url;
        mOptions.activeMap.author = mOptions.authorImage;
        mOptions.activeMap.alt = mOptions.altImage;
        mOptions.activeMap.active = 0;
        if (mOptions.hasYoutube) {
            $eXeMapa.hasVideo = true;
        }

        if (mOptions.version < 3) {
            mOptions.evaluationG = mOptions.evaluation;
            mOptions.evaluation = mOptions.evaluationF;
            mOptions.evaluationID = mOptions.evaluationIDF;
        }
        mOptions.evaluation =
            typeof mOptions.evaluation == 'undefined'
                ? false
                : mOptions.evaluation;
        mOptions.evaluationID =
            typeof mOptions.evaluationID == 'undefined'
                ? ''
                : mOptions.evaluationID;

        if (mOptions.evaluationG == 0 || mOptions.evaluationG == 6) {
            mOptions.gameStarted = true;
        } else if (mOptions.evaluationG == 4) {
            mOptions.selectsGame =
                $exeDevices.iDevice.gamification.helpers.shuffleAds(
                    mOptions.selectsGame
                );
            mOptions.gameStarted = true;
        } else if (mOptions.evaluationG == 5) {
            for (let i = 0; i < mOptions.activeMap.pts.length; i++) {
                mOptions.activeMap.pts[i].order = i + 1;
            }
        }

        mOptions.levels = [];
        mOptions.levels.push($.extend(true, {}, mOptions.activeMap));
        mOptions.level = 0;
        mOptions.playerAudio = '';
        mOptions.loadingURL = false;
        mOptions.topBBTop = false;
        mOptions.evaluation =
            typeof mOptions.evaluation == 'undefined'
                ? false
                : mOptions.evaluation;
        mOptions.evaluationID =
            typeof mOptions.evaluationID == 'undefined'
                ? ''
                : mOptions.evaluationID;
        mOptions.id = typeof mOptions.id == 'undefined' ? false : mOptions.id;
        mOptions.autoShow =
            typeof mOptions.autoShow == 'undefined' ? false : mOptions.autoShow;
        mOptions.autoAudio =
            typeof mOptions.autoAudio == 'undefined'
                ? true
                : mOptions.autoAudio;
        mOptions.order =
            typeof mOptions.order == 'undefined'
                ? []
                : $eXeMapa.stringToArrayOfIntegers(mOptions.order);
        mOptions.orderResponse = [];
        mOptions.hideScoreBar = mOptions.hideScoreBar ?? false;
        mOptions.hideAreas = mOptions.hideAreas ?? false;
        return mOptions;
    },

    stringToArrayOfIntegers: function (str) {
        if (str.trim().length == 0) {
            return [];
        }

        return str.split(',').map(Number);
    },

    checkOrder: function (instance) {
        const mOptions = $eXeMapa.options[instance];
        let hits = 0;
        const solutionLength = mOptions.order.length,
            responseLength = mOptions.orderResponse.length;
        for (let i = 0; i < solutionLength; i++) {
            if (
                i < responseLength &&
                mOptions.order[i] == mOptions.orderResponse[i]
            ) {
                hits++;
            }
        }
        mOptions.hits = hits;
        mOptions.errors = solutionLength - hits;
        $eXeMapa.gameOver(instance);
    },

    getDataGame1: function (pts, evaluationG) {
        let data = [];
        for (let i = 0; i < pts.length; i++) {
            let p = pts[i];
            p.state = -1;
            if (p.type != 5 || p.map.pts.length == 0) {
                data.push({
                    title: p.title,
                    question: p.question,
                    id: p.id,
                    audio: p.question_audio,
                });

                if (
                    p.type == 6 &&
                    evaluationG == 1 &&
                    typeof p.slides != 'undefined' &&
                    p.slides.length > 0
                ) {
                    p.type = 0;
                    p.url = p.slides[0].url;
                }
            } else {
                if (evaluationG == 1) {
                    p.type = 0;
                    p.url = p.map.url;
                }
                let rdata = $eXeMapa.getDataGame1(p.map.pts, evaluationG);
                data = data.concat(rdata);
            }
        }
        return data;
    },

    updateAreaPoints: function (x, y, x1, y1) {
        const topLeft = { x: Math.min(x, x1), y: Math.min(y, y1) },
            bottomRight = { x: Math.max(x, x1), y: Math.max(y, y1) },
            topRight = { x: bottomRight.x, y: topLeft.y },
            bottomLeft = { x: topLeft.x, y: bottomRight.y },
            vertices = [topLeft, topRight, bottomRight, bottomLeft];
        return vertices;
    },

    setMedias: function (
        pts,
        $images,
        $texts,
        $audios,
        $imgmpas,
        $audiosIdentifyLink,
        $imagesSlides,
        hasYoutube,
        evaluationG,
        $tooltips
    ) {
        let hasYB = hasYoutube;
        for (let i = 0; i < pts.length; i++) {
            const p = pts[i];
            p.color = typeof p.color == 'undefined' ? '#000000' : p.color;
            p.points =
                typeof p.points == 'undefined'
                    ? $eXeMapa.updateAreaPoints(p.x, p.y, p.x1, p.y1)
                    : p.points;
            p.fontSize = typeof p.fontSize == 'undefined' ? '14' : p.fontSize;
            p.tests = typeof p.tests == 'undefined' ? [] : p.tests;
            p.activeTest = 0;
            p.score = 0;
            p.errors = 0;
            p.hits = 0;
            p.numbertests = p.tests.length;
            p.respuesta = '';

            if (p.type != 5) {
                if (
                    p.type == 0 &&
                    typeof p.url != 'undefined' &&
                    p.url.indexOf('http') != 0 &&
                    p.url.length > 4
                ) {
                    $eXeMapa.setImage(p, $images);
                } else if (
                    p.type == 0 &&
                    typeof p.url != 'undefined' &&
                    p.url.indexOf('http') == 0
                ) {
                    p.url = $exeDevices.iDevice.gamification.media.extractURLGD(
                        p.url
                    );
                } else if (
                    p.type == 2 &&
                    typeof p.eText != 'undefined' &&
                    p.eText.trim().length > 0
                ) {
                    $eXeMapa.setText(p, $texts);
                } else if (
                    p.type == 7 &&
                    typeof p.toolTip != 'undefined' &&
                    p.toolTip.trim().length > 0
                ) {
                    $eXeMapa.setToolTip(p, $tooltips);
                }
                if (
                    p.type != 1 &&
                    typeof p.audio != 'undefined' &&
                    p.audio.indexOf('http') != 0 &&
                    p.audio.length > 4
                ) {
                    $eXeMapa.setAudio(p, $audios);
                }
                if (p.type == 1 && p.video.length > 4) {
                    hasYB = true;
                }
                if (
                    typeof p.question_audio != 'undefined' &&
                    p.question_audio.indexOf('http') != 0 &&
                    p.question_audio.length > 4
                ) {
                    $eXeMapa.setAudioIdentefy(p, $audiosIdentifyLink);
                }
                if (
                    p.type == 6 &&
                    typeof p.slides != 'undefined' &&
                    p.slides.length > 0
                ) {
                    for (let j = 0; j < p.slides.length; j++) {
                        let s = p.slides[j];
                        $eXeMapa.setImageSlide(s, $imagesSlides);
                    }
                } else if (
                    p.type != 6 &&
                    (typeof p.slides == 'undefined' || p.slides.length == 0)
                ) {
                    p.slides = [];
                    p.slides.push($eXeMapa.getDefaultSlide());
                    p.activeSlide = 0;
                }
                if (
                    (p.type == 9 && typeof p.tests == 'undefined') ||
                    p.tests.length == 0
                ) {
                    p.tests = [];
                    p.slides.push($eXeMapa.getDefaultQuestion());
                    p.activeTest = 0;
                }
            } else {
                if (
                    typeof p.map.url != 'undefined' &&
                    p.map.url.indexOf('http') != 0 &&
                    p.map.url.length > 4
                ) {
                    $eXeMapa.setImgMap(p, $imgmpas);
                }
                hasYB = $eXeMapa.setMedias(
                    p.map.pts,
                    $images,
                    $texts,
                    $audios,
                    $imgmpas,
                    $audiosIdentifyLink,
                    $imagesSlides,
                    hasYB,
                    evaluationG,
                    $tooltips
                );
            }
        }

        return hasYB;
    },

    getDefaultQuestion: function () {
        return {
            typeSelect: 0,
            numberOptions: 4,
            quextion: '',
            options: ['', '', '', ''],
            solution: '',
            solutionWord: '',
            percentageShow: 35,
            msgError: '',
            msgHit: '',
            tests: [],
            respuesta: '',
            numbertests: 0,
        };
    },

    getDefaultSlide: function () {
        return {
            id: 's' + $eXeMapa.getID(),
            title: '',
            url: '',
            author: '',
            alt: '',
            footer: '',
        };
    },

    getID: function () {
        return Math.floor(Math.random() * Date.now());
    },

    setImageSlide: function (s, $images) {
        $images.each(function () {
            let id = $(this).data('id'),
                type = true;
            if (typeof id == 'undefined') {
                type = false;
                id = $(this).text();
            }
            if (
                typeof s.id != 'undefined' &&
                typeof id != 'undefined' &&
                s.id == id
            ) {
                s.url = type ? $(this).attr('src') : $(this).attr('href');
                return;
            }
        });
    },

    setImage: function (p, $images) {
        $images.each(function () {
            let id = $(this).data('id'),
                type = true;
            if (typeof id == 'undefined') {
                type = false;
                id = $(this).text();
            }
            if (
                typeof p.id != 'undefined' &&
                typeof id != 'undefined' &&
                p.id == id
            ) {
                p.url = type ? $(this).attr('src') : $(this).attr('href');
                return;
            }
        });
    },

    setAudio: function (p, $audios) {
        $audios.each(function () {
            let id = $(this).data('id'),
                type = true;
            if (typeof id == 'undefined') {
                type = false;
                id = $(this).text();
            }
            if (
                typeof p.id != 'undefined' &&
                typeof id != 'undefined' &&
                p.id == id
            ) {
                p.audio = type ? $(this).attr('src') : $(this).attr('href');
                return;
            }
        });
    },

    setText: function (p, $texts) {
        $texts.each(function () {
            const id = $(this).data('id');
            if (
                typeof p.id != 'undefined' &&
                typeof id != 'undefined' &&
                p.id == id
            ) {
                p.eText = $(this).html();
                return;
            }
        });
    },

    setToolTip: function (p, $tt) {
        $tt.each(function () {
            const id = $(this).data('id');
            if (
                typeof p.id != 'undefined' &&
                typeof id != 'undefined' &&
                p.id == id
            ) {
                p.toolTip = $(this).html();
                return;
            }
        });
    },

    setImgMap: function (p, $imgmap) {
        $imgmap.each(function () {
            let id = $(this).data('id'),
                type = true;
            if (typeof id == 'undefined') {
                type = false;
                id = $(this).text();
            }
            if (
                typeof p.id != 'undefined' &&
                typeof id != 'undefined' &&
                p.id == id
            ) {
                p.map.url = type ? $(this).attr('src') : $(this).attr('href');
                return;
            }
        });
    },

    setAudioIdentefy: function (p, $audios) {
        $audios.each(function () {
            let id = $(this).data('id'),
                type = true;
            if (typeof id == 'undefined') {
                type = false;
                id = $(this).text();
            }
            if (
                typeof p.id != 'undefined' &&
                typeof id != 'undefined' &&
                p.id == id
            ) {
                p.question_audio = type
                    ? $(this).attr('src')
                    : $(this).attr('href');

                return;
            }
        });
    },

    getNumberIdentify: function (pts) {
        let m = 0;
        for (let i = 0; i < pts.length; i++) {
            const p = pts[i];
            if (p.type != 5) {
                m++;
            } else {
                m += $eXeMapa.getNumberIdentify(p.map.pts);
            }
        }
        return m;
    },

    rebootGame: function (instance) {
        const mOptions = $eXeMapa.options[instance];
        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.gameActived = true;
        mOptions.evaluationG = 4;
        mOptions.questionaireStarted = true;
        mOptions.gameOver = false;
        mOptions.activeQuestion = 0;
        mOptions.activeTitle = 0;
        mOptions.obtainedClue = false;
        mOptions.selectsGame =
            $exeDevices.iDevice.gamification.helpers.shuffleAds(
                mOptions.selectsGame
            );

        $('#mapaPNumber-' + instance).text(mOptions.numberQuestions);
        $('#mapaPScore-' + instance).text(0);
        $('#mapaPHits-' + instance).text(0);
        $('#mapaPErrors-' + instance).text(0);
        $('#mapaShowClue-' + instance).hide();
        $('#mapaGameClue-' + instance).hide();

        $eXeMapa.showQuestionaire(instance);
    },

    ramdonOptions: function (instance) {
        const mOptions = $eXeMapa.options[instance];
        let l = 0,
            letras = 'ABCD';

        if (mOptions.question.typeSelect == 1) return;

        let soluciones = mOptions.question.solution;
        for (let j = 0; j < mOptions.question.options.length; j++) {
            if (mOptions.question.options[j].trim().length > 0) {
                l++;
            }
        }

        let respuestas = mOptions.question.options;
        let respuestasNuevas = [];
        let respuestaCorrectas = [];

        for (let i = 0; i < soluciones.length; i++) {
            let sol = soluciones.charCodeAt(i) - 65;
            respuestaCorrectas.push(respuestas[sol]);
        }

        respuestasNuevas = mOptions.question.options.slice(0, l);
        respuestasNuevas =
            $exeDevices.iDevice.gamification.helpers.shuffleAds(
                respuestasNuevas
            );

        let solucionesNuevas = '';
        for (let k = 0; k < respuestasNuevas.length; k++) {
            for (let z = 0; z < respuestaCorrectas.length; z++) {
                if (respuestasNuevas[k] == respuestaCorrectas[z]) {
                    solucionesNuevas = solucionesNuevas.concat(letras[k]);
                    break;
                }
            }
        }
        mOptions.question.options = [];
        for (let d = 0; d < 4; d++) {
            if (d < respuestasNuevas.length) {
                mOptions.question.options.push(respuestasNuevas[d]);
            } else {
                mOptions.question.options.push('');
            }
        }
        mOptions.question.solution = solucionesNuevas;
    },

    ramdonTPOptions: function (instance) {
        const mOptions = $eXeMapa.options[instance],
            p = mOptions.activeMap.pts[mOptions.activeMap.active];

        let q = p.tests[p.activeTest],
            l = 0,
            letras = 'ABCD';

        if (q.typeSelect == 1) return q;

        let soluciones = q.solution;
        for (let j = 0; j < q.options.length; j++) {
            if (q.options[j].trim().length > 0) {
                l++;
            }
        }

        let respuestas = q.options,
            respuestasNuevas = [],
            respuestaCorrectas = [];
        for (let i = 0; i < soluciones.length; i++) {
            let sol = soluciones.charCodeAt(i) - 65;
            respuestaCorrectas.push(respuestas[sol]);
        }

        respuestasNuevas = q.options.slice(0, l);
        respuestasNuevas =
            $exeDevices.iDevice.gamification.helpers.shuffleAds(
                respuestasNuevas
            );
        let solucionesNuevas = '';

        for (let k = 0; k < respuestasNuevas.length; k++) {
            for (let z = 0; z < respuestaCorrectas.length; z++) {
                if (respuestasNuevas[k] == respuestaCorrectas[z]) {
                    solucionesNuevas = solucionesNuevas.concat(letras[k]);
                    break;
                }
            }
        }

        q.options = [];
        for (let d = 0; d < 4; d++) {
            if (d < respuestasNuevas.length) {
                q.options.push(respuestasNuevas[d]);
            } else {
                q.options.push('');
            }
        }

        q.solution = solucionesNuevas;
        return q;
    },

    clearTPQuestions: function (instance) {
        $('#mapaAnswers1-' + instance).empty();
        let bordeColors = [
            $eXeMapa.borderColors.red,
            $eXeMapa.borderColors.blue,
            $eXeMapa.borderColors.green,
            $eXeMapa.borderColors.yellow,
        ];
        $('#mapaOptionsDiv1-' + instance + '>.MQP-Options').each(
            function (index) {
                $(this)
                    .css({
                        'border-color': bordeColors[index],
                        'background-color': 'transparent',
                        cursor: 'pointer',
                    })
                    .text('');
            }
        );
    },

    clearQuestions: function (instance) {
        $('#mapaAnswers-' + instance).empty();
        const bordeColors = [
            $eXeMapa.borderColors.red,
            $eXeMapa.borderColors.blue,
            $eXeMapa.borderColors.green,
            $eXeMapa.borderColors.yellow,
        ];
        $('#mapaOptionsDiv-' + instance + '>.MQP-Options').each(
            function (index) {
                $(this)
                    .css({
                        'border-color': bordeColors[index],
                        'background-color': 'transparent',
                        cursor: 'pointer',
                    })
                    .text('');
            }
        );
    },
    drawQuestions: function (instance) {
        const mOptions = $eXeMapa.options[instance],
            bordeColors = [
                $eXeMapa.borderColors.red,
                $eXeMapa.borderColors.blue,
                $eXeMapa.borderColors.green,
                $eXeMapa.borderColors.yellow,
            ];
        $('#mapaQuestionDiv-' + instance).show();
        $('#mapaWordDiv-' + instance).hide();
        $('#mapaAnswerDiv-' + instance).show();
        $('#mapaOptionsDiv-' + instance + '>.MQP-Options').each(
            function (index) {
                let option = mOptions.question.options[index];
                $(this)
                    .css({
                        'border-color': bordeColors[index],
                        'background-color': 'transparent',
                        cursor: 'pointer',
                        color: $eXeMapa.colors.black,
                    })
                    .html(option);
                if (option) {
                    $(this).show();
                } else {
                    $(this).hide();
                }
            }
        );
        let html = $('#mapaQuestionDiv-' + instance).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);
        if (latex) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '#mapaFTests-' + instance
            );
        }
    },

    drawTPQuestions: function (instance) {
        const mOptions = $eXeMapa.options[instance],
            p = mOptions.activeMap.pts[mOptions.activeMap.active],
            q = p.tests[p.activeTest],
            bordeColors = [
                $eXeMapa.borderColors.red,
                $eXeMapa.borderColors.blue,
                $eXeMapa.borderColors.green,
                $eXeMapa.borderColors.yellow,
            ];

        $('#mapaQuestionDiv1-' + instance).show();
        $('#mapaWordDiv1-' + instance).hide();
        $('#mapaAnswerDiv1-' + instance).show();

        $('#mapaOptionsDiv1-' + instance + '>.MQP-Options').each(
            function (index) {
                const option = q.options[index];
                $(this)
                    .css({
                        'border-color': bordeColors[index],
                        'background-color': 'transparent',
                        cursor: 'pointer',
                        color: $eXeMapa.colors.black,
                    })
                    .html(option);
                if (option) {
                    $(this).show();
                } else {
                    $(this).hide();
                }
            }
        );

        const html = $('#mapaQuestionDiv1-' + instance).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);

        if (latex)
            $exeDevices.iDevice.gamification.math.updateLatex(
                '#mapaFTests-' + instance
            );
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
        $('#mapaEPhrase-' + instance)
            .find('.MQP-Word')
            .remove();
        $('#mapaBtnReply-' + instance).prop('disabled', true);
        $('#mapaBtnMoveOn-' + instance).prop('disabled', true);
        $('#mapaEdAnswer-' + instance).prop('disabled', true);
        $('#mapaQuestionDiv-' + instance).hide();
        $('#mapaWordDiv-' + instance).show();
        $('#mapaAnswerDiv-' + instance).hide();

        if (!casesensitive) {
            phrase = phrase.toUpperCase();
        }

        let cPhrase = $eXeMapa.clear(phrase),
            letterShow = $eXeMapa.getShowLetter(cPhrase, nivel),
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
                $('<div class="MQP-Word"></div>').appendTo(
                    '#mapaEPhrase-' + instance
                );
                for (let j = 0; j < cleanWord.length; j++) {
                    let letter =
                        '<div class="MQP-Letter blue">' +
                        cleanWord[j] +
                        '</div>';
                    if (type == 1) {
                        letter =
                            '<div class="MQP-Letter red">' +
                            cleanWord[j] +
                            '</div>';
                    } else if (type == 2) {
                        letter =
                            '<div class="MQP-Letter green">' +
                            cleanWord[j] +
                            '</div>';
                    }
                    $('#mapaEPhrase-' + instance)
                        .find('.MQP-Word')
                        .last()
                        .append(letter);
                }
            }
        }

        if (!solution) $('#mapaDefinition-' + instance).html(definition);

        const html = $('#mapaWordDiv-' + instance).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);
        if (latex)
            $exeDevices.iDevice.gamification.math.updateLatex(
                '#mapaWordDiv-' + instance
            );

        return cPhrase;
    },
    drawTPPhrase: function (
        phrase,
        definition,
        nivel,
        type,
        casesensitive,
        instance,
        solution
    ) {
        const $mapaEPhrase = $('#mapaEPhrase1-' + instance),
            $mapaBtnReply = $('#mapaBtnReply1-' + instance),
            $mapaBtnMoveOn = $('#mapaBtnMoveOn1-' + instance),
            $mapaEdAnswer = $('#mapaEdAnswer1-' + instance),
            $mapaQuestionDiv = $('#mapaQuestionDiv1-' + instance),
            $mapaWordDiv = $('#mapaWordDiv1-' + instance),
            $mapaAnswerDiv = $('#mapaAnswerDiv1-' + instance),
            $mapaDefinition = $('#mapaDefinition1-' + instance);

        $mapaEPhrase.find('.MQP-Word').remove();
        $mapaEPhrase.find('.MQP-PLetter').remove();
        $mapaBtnReply.prop('disabled', true);
        $mapaBtnMoveOn.prop('disabled', true);
        $mapaEdAnswer.prop('disabled', true);
        $mapaQuestionDiv.hide();
        $mapaWordDiv.show();

        $mapaAnswerDiv.hide();
        if (!casesensitive) {
            phrase = phrase.toUpperCase();
        }
        let cPhrase = $eXeMapa.clear(phrase),
            letterShow = $eXeMapa.getShowLetter(cPhrase, nivel),
            nPhrase = cPhrase
                .replace(/\s/g, '&')
                .split('')
                .map((char, index) => {
                    return char === '&' || letterShow.includes(index)
                        ? char
                        : ' ';
                })
                .join('');

        let phraseArray = nPhrase.split('&');
        let colorClasses = ['blue', 'red', 'green'],
            selectedClass = colorClasses[type] || 'blue';

        phraseArray.forEach((word) => {
            if (word.trim()) {
                let $wordDiv = $('<div class="MQP-PWord"></div>').appendTo(
                    $mapaEPhrase
                );
                word.split('').forEach((letter) => {
                    $(
                        '<div class="MQP-PLetter ' +
                            selectedClass +
                            '">' +
                            letter +
                            '</div>'
                    ).appendTo($wordDiv);
                });
            }
        });

        if (!solution) {
            $mapaDefinition.html(definition);
        }

        if (
            $exeDevices.iDevice.gamification.math.hasLatex($mapaWordDiv.html())
        ) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '#mapaWordDiv1-' + instance
            );
        }
        return cPhrase;
    },

    drawSolution: function (instance) {
        const mOptions = $eXeMapa.options[instance],
            mQuextion = mOptions.selectsGame[mOptions.activeQuestion],
            solution = mQuextion.solution,
            letters = 'ABCD';

        mOptions.gameActived = false;
        $('#mapaOptionsDiv-' + instance)
            .find('.MQP-Options')
            .each(function (i) {
                let css = {};
                if (mQuextion.typeSelect === 1) {
                    css = {
                        'border-color': $eXeMapa.borderColors.correct,
                        'background-color': $eXeMapa.colors.correct,
                        'border-size': '1',
                        cursor: 'pointer',
                        color: $eXeMapa.borderColors.black,
                    };
                    let text = '';
                    if (solution[i] === 'A') {
                        text = mQuextion.options[0];
                    } else if (solution[i] === 'B') {
                        text = mQuextion.options[1];
                    } else if (solution[i] === 'C') {
                        text = mQuextion.options[2];
                    } else if (solution[i] === 'D') {
                        text = mQuextion.options[3];
                    }
                    $(this).text(text);
                } else {
                    css = {
                        'border-color': $eXeMapa.borderColors.incorrect,
                        'border-size': '1',
                        'background-color': 'transparent',
                        cursor: 'pointer',
                        color: $eXeMapa.borderColors.grey,
                    };
                    if (solution.indexOf(letters[i]) !== -1) {
                        css = {
                            'border-color': $eXeMapa.borderColors.correct,
                            'background-color': $eXeMapa.colors.correct,
                            'border-size': '1',
                            cursor: 'pointer',
                            color: $eXeMapa.borderColors.black,
                        };
                    }
                }
                $(this).css(css);
            });
    },

    drawTPSolution: function (instance) {
        const mOptions = $eXeMapa.options[instance],
            p = mOptions.activeMap.pts[mOptions.activeMap.active],
            q = p.tests[p.activeTest],
            solution = q.solution,
            letters = 'ABCD';

        mOptions.gameActived = false;

        $('#mapaOptionsDiv1-' + instance)
            .find('.MQP-Options')
            .each(function (i) {
                let css = {};
                if (q.typeSelect === 1) {
                    css = {
                        'border-color': $eXeMapa.borderColors.correct,
                        'background-color': $eXeMapa.colors.correct,
                        'border-size': '1',
                        cursor: 'pointer',
                        color: $eXeMapa.borderColors.black,
                    };
                    let text = '';
                    if (solution[i] === 'A') {
                        text = q.options[0];
                    } else if (solution[i] === 'B') {
                        text = q.options[1];
                    } else if (solution[i] === 'C') {
                        text = q.options[2];
                    } else if (solution[i] === 'D') {
                        text = q.options[3];
                    }
                    $(this).text(text);
                } else {
                    css = {
                        'border-color': $eXeMapa.borderColors.incorrect,
                        'border-size': '1',
                        'background-color': 'transparent',
                        cursor: 'pointer',
                        color: $eXeMapa.borderColors.grey,
                    };
                    if (solution.indexOf(letters[i]) !== -1) {
                        css = {
                            'border-color': $eXeMapa.borderColors.correct,
                            'background-color': $eXeMapa.colors.correct,
                            'border-size': '1',
                            cursor: 'pointer',
                            color: $eXeMapa.borderColors.black,
                        };
                    }
                }
                $(this).css(css);
            });
    },

    showQuestion: function (i, instance) {
        const mOptions = $eXeMapa.options[instance],
            mQuextion = mOptions.selectsGame[i];

        $eXeMapa.clearQuestions(instance);

        mOptions.gameActived = true;
        mOptions.question = mQuextion;
        mOptions.respuesta = '';
        $('#mapaQuestion-' + instance).html(mQuextion.quextion);
        $eXeMapa.ramdonOptions(instance);

        if (mQuextion.typeSelect == 0) {
            $eXeMapa.drawQuestions(instance);
            $eXeMapa.showMessage(0, mOptions.msgs.msgSelectAnswers, instance);
        } else if (mQuextion.typeSelect == 1) {
            $eXeMapa.showMessage(0, mOptions.msgs.msgCheksOptions, instance);
            $eXeMapa.drawQuestions(instance);
        } else {
            $eXeMapa.showMessage(0, mOptions.msgs.msgWriteAnswer, instance);
            $eXeMapa.drawPhrase(
                mQuextion.solutionQuestion,
                mQuextion.quextion,
                mQuextion.percentageShow,
                0,
                false,
                instance,
                false
            );
            $('#mapaBtnReply-' + instance).prop('disabled', false);
            $('#mapaEdAnswer-' + instance).prop('disabled', false);
            $('#mapaEdAnswer-' + instance).focus();
            $('#mapaEdAnswer-' + instance).val('');
        }

        if (mOptions.evaluationG == 4 && mOptions.isScorm === 1) {
            let score = (
                (mOptions.hits * 10) /
                mOptions.numberQuestions
            ).toFixed(2);
            $eXeMapa.sendScore(true, instance);
            $('#mapaRepeatActivity-' + instance).text(
                mOptions.msgs.msgYouScore + ': ' + score
            );
        }
        $eXeMapa.saveEvaluation(instance);
    },

    showTPQuestion: function (instance) {
        const mOptions = $eXeMapa.options[instance],
            p = mOptions.activeMap.pts[mOptions.activeMap.active];
        if (p.activeTest < p.numbertests) {
            $('#mapaPNumber1-' + instance).text(p.numbertests - p.activeTest);
            let q = p.tests[p.activeTest];
            $eXeMapa.clearTPQuestions(instance);
            mOptions.gameActived = true;
            p.respuesta = '';
            $('#mapaQuestion1-' + instance).html(q.quextion);
            q = $eXeMapa.ramdonTPOptions(instance);
            if (q.typeSelect == 0) {
                $eXeMapa.drawTPQuestions(instance);
                $eXeMapa.showTPMessage(
                    0,
                    mOptions.msgs.msgSelectAnswers,
                    instance
                );
            } else if (q.typeSelect == 1) {
                $eXeMapa.showTPMessage(
                    0,
                    mOptions.msgs.msgCheksOptions,
                    instance
                );
                $eXeMapa.drawTPQuestions(instance);
            } else {
                $eXeMapa.showTPMessage(
                    0,
                    mOptions.msgs.msgWriteAnswer,
                    instance
                );
                $eXeMapa.drawTPPhrase(
                    q.solutionQuestion,
                    q.quextion,
                    q.percentageShow,
                    0,
                    false,
                    instance,
                    false
                );
                $('#mapaBtnReply1-' + instance).prop('disabled', false);
                $('#mapaEdAnswer1-' + instance).prop('disabled', false);
                $('#mapaEdAnswer1-' + instance).focus();
                $('#mapaEdAnswer1-' + instance).val('');
            }

            const html = $('#mapaTPQuestions-' + instance).html(),
                latex = $exeDevices.iDevice.gamification.math.hasLatex(html);
            if (latex)
                $exeDevices.iDevice.gamification.math.updateLatex(
                    '#mapaTPQuestions-' + instance
                );

            let sscore = p.score % 1 == 0 ? p.score : p.score.toFixed(2);
            $('#mapaPScore1-' + instance).text(sscore);
            $('#mapaPHits1-' + instance).text(p.hits);
            $('#mapaPErrors1-' + instance).text(p.errors);
            $('#mapaPNumber1-' + instance).text(
                p.numbertests - p.hits - p.errors
            );

            if (p.numbertests > 0) {
                $('#mapaBottonContainer1-' + instance).css({
                    'justify-content': 'flex-end',
                });
                $('#mapaTestReloadDiv1-' + instance).hide();
                return;
            }

            $('#mapaBottonContainer1-' + instance).css({
                'justify-content': 'space-between',
            });
            $('#mapaTestReloadDiv1-' + instance).css({ display: 'flex' });
        }
    },

    saveEvaluation: function (instance) {
        const mOptions = $eXeMapa.options[instance],
            numq =
                mOptions.evaluationG != 5
                    ? mOptions.numberQuestions
                    : mOptions.order.length || 1;
        let score = 0;

        if (mOptions.evaluationG == 0) {
            score = $eXeMapa.getScoreVisited(instance);
        } else {
            score = (mOptions.hits * 10) / numq;
        }

        mOptions.scorerp = score;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $eXeMapa.isInExe
        );
    },

    sendScore: function (auto, instance) {
        const mOptions = $eXeMapa.options[instance],
            numq =
                mOptions.evaluationG != 5
                    ? mOptions.numberQuestions
                    : mOptions.order.length || 1;
        let score = 0;

        if (mOptions.evaluationG == 0) {
            score = $eXeMapa.getScoreVisited(instance);
        } else {
            score = (mOptions.hits * 10) / numq;
        }

        mOptions.scorerp = score;
        mOptions.previousScore = $eXeMapa.previousScore;
        mOptions.userName = $eXeMapa.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $eXeMapa.previousScore = mOptions.previousScore;
    },

    createInterfaceMapa: function (instance) {
        const path = $eXeMapa.idevicePath,
            msgs = $eXeMapa.options[instance].msgs,
            mOptions = $eXeMapa.options[instance],
            html = `
            <div class="MQP-MainContainer" id="mapaMainContainer-${instance}">
                <div class="MQP-GameMinimize" id="mapaGameMinimize-${instance}">
                    <a href="#" class="MQP-LinkMaximize" id="mapaLinkMaximize-${instance}" title="${msgs.msgGoActivity}">
                        <img src="${path}mapaIcon.svg" class="MQP-IconMinimize MQP-Activo" alt="${msgs.msgGoActivity}">
                        <div class="MQP-MessageMaximize" id="mapaMessageMaximize-${instance}"></div>
                    </a>
                </div>
                <div class="MQP-GameContainer" id="mapaGameContainer-${instance}">
                    ${this.getToolBar(instance)}
                    <div class="MQP-ShowClue MQP-Parpadea" id="mapaGameClue-${instance}">
                        <div class="sr-av">${msgs.msgClue}:</div>
                        <p class="MQP-PShowClue" id="mapaPGameClue-${instance}"></p>
                    </div>
                    <div class="MQP-MessageFindDiv" id="mapaMessageFind-${instance}">
                        <a href="#" class="MQP-MessageFind" id="mapaStartGame-${instance}">${msgs.msgPlayStart}</a>
                        <a href="#" class="MQP-MessageFind" id="mapaCheckOrder-${instance}" style="display:none">${msgs.msgCheck}</a>
                        <span class="MQP-MessageFind" id="mapaMessageFindP-${instance}"></span>
                        <a href="#" id="mapaPlayAudioIdenty-${instance}" title="${msgs.msgAudio}">
                            <span class="sr-av">${msgs.msgAudio}:</span>
                            <div class="MQP-IconPlayIdentify MQP-Activo" id="-${instance}"></div>
                        </a>
                    </div>
                    <div class="MQP-Multimedia" id="mapaMultimedia-${instance}">
                        <img src="" id="mapaImage-${instance}" class="MQP-ImageMain" alt="">
                        <canvas id="mapaCanvas-${instance}" class="MQP-Canvas"></canvas>
                        <a href="#" class="MQP-LinkCloseDetail" id="mapaLinkCloseDetail-${instance}" title="${msgs.msgReturn}">
                            <strong class="sr-av">${msgs.msgReturn}:</strong>
                            <div class="MQP-IconsToolBar exeQuextIcons-CReturn MQP-Activo"></div>
                        </a>
                        <div id="mapaTooltipA-${instance}" class="MQP-AreaToolTip"></div>
                        <a href="#" class="MQP-LinkCloseHome" id="mapaLinkCloseHome-${instance}" title="${msgs.msgHome}">
                            <strong class="sr-av">${msgs.msgHome}:</strong>
                            <div class="MQP-IconsToolBar exeQuextIcons-CHome MQP-Activo"></div>
                        </a>
                        ${this.getDetailSound(instance)}
                        ${this.getToolTip(instance)}
                        ${this.getDetailMedia(instance)}
                        ${this.getModalMessage(instance)}
                        ${this.getTPQuestions(instance)}
                    </div>
                    ${this.getDetailTest(instance)}
                    <div class="MQP-AuthorLicence" id="mapaAutorLicence-${instance}"></div>
                    <div class="MQP-Cubierta" id="mapaCubierta-${instance}">
                        ${this.getTestGame(instance)}
                    </div>
                </div>
               ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}
            </div>
        `;

        return html;
    },

    getToolTip: function (instance) {
        const msgs = $eXeMapa.options[instance].msgs,
            html = `
            <div class="MQP-ToolTip" id="mapaToolTip-${instance}">
                <div class="MQP-ToolTipTitle" id="mapaToolTipTitle-${instance}"></div>
                <a href="#" class="MQP-ToolTipClose" id="mapaToolTipClose-${instance}" title="${msgs.msgClose}">
                    <strong class="sr-av">${msgs.msgClose}:</strong>
                    <div class="MQP-IconsToolBar exeQuextIcons-CWGame MQP-Activo"></div>
                </a>
                <div class="MQP-ToolTipText" id="mapaToolTipText-${instance}"></div>
            </div>
        `;

        return html;
    },

    getToolBar: function (instance) {
        const msgs = $eXeMapa.options[instance].msgs,
            html = `
            <div class="MQP-ToolBar" id="mapaToolBar-${instance}">
                <div class="MQP-ToolBarR" id="mapaToolBarL-${instance}">
                    <div class="MQP-IconsToolBar exeQuextIcons-Number" title="${msgs.msgNumQuestions}"></div>
                    <p><span class="sr-av">${msgs.msgNumQuestions}: </span><span id="mapaPNumberF-${instance}">0</span></p>
                    <div class="MQP-IconsToolBar exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                    <p><span class="sr-av">${msgs.msgHits}: </span><span id="mapaPHitsF-${instance}">0</span></p>
                    <div id="mapaIconErrorA-${instance}" class="MQP-IconsToolBar exeQuextIcons-Error" title="${msgs.msgErrors}"></div>
                    <p id="mapaIconErrorB-${instance}"><span class="sr-av">${msgs.msgErrors}: </span><span id="mapaPErrorsF-${instance}">0</span></p>
                    <div class="MQP-IconsToolBar exeQuextIcons-Score" title="${msgs.msgScore}"></div>
                    <p><span class="sr-av">${msgs.msgScore}: </span><span id="mapaPScoreF-${instance}">0</span></p>
                </div>
                <span class="MQP-MesageToolBar" id="mapaMessageToolBar-${instance}"></span>
                <div class="MQP-ToolBarL">
                    <a href="#" class="MQP-LinkTest" id="mapaLinkTest-${instance}" title="${msgs.msgShowTest}">
                        <strong><span class="sr-av">${msgs.msgShowTest}:</span></strong>
                        <div class="MQP-IconsToolBar exeQuextIcons-TXGame MQP-Activo"></div>
                    </a>
                    <a href="#" class="MQP-LinkAreas" id="mapaLinkAreas-${instance}" title="${msgs.msgShowAreas}">
                        <strong><span class="sr-av">${msgs.msgShowAreas}:</span></strong>
                        <div class="MQP-IconsToolBar exeQuextIcons-Areas MQP-Activo"></div>
                    </a>
                    <a href="#" class="MQP-LinkMinimize" id="mapaLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                        <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                        <div class="MQP-IconsToolBar exeQuextIcons-MZGame MQP-Activo"></div>
                    </a>
                    <a href="#" class="MQP-LinkFullScreen" id="mapaLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                        <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                        <div class="MQP-IconsToolBar exeQuextIcons-FSGame MQP-Activo" id="mapaFullScreen-${instance}"></div>
                    </a>
                </div>
            </div>
        `;
        return html;
    },

    getModalMessage: function (instance) {
        const msgs = $eXeMapa.options[instance].msgs,
            html = `
            <div id="mapaFMessages-${instance}" class="MQP-MessageModal">
                <div class="MQP-FMessageInfo" id="mapaFMessageInfo-${instance}">
                    <div class="MQP-MessageGOScore">
                        <div class="MQP-MessageGOContent">
                            <div class="MQP-MessageModalIcono"></div>
                            <div class="MQP-MessageMoScoreData">
                                <p id="mapaMessageInfoText-${instance}"></p>
                            </div>
                        </div>
                        <a href="#" class="MQP-ToolTipClose" id="mapaFMessageInfoAccept-${instance}" title="${msgs.msgClose}">
                            <strong class="sr-av">${msgs.msgClose}:</strong>
                            <div class="MQP-IconsToolBar exeQuextIcons-CWGame MQP-Activo"></div>
                        </a>
                    </div>
                </div>
                <div id="mapaFMessageOver-${instance}" class="MQP-MessageGOScore MQP-FOver">
                    <div class="MQP-MessageGOContent">
                        <div class="MQP-MessageModalIcono"></div>
                        <div class="MQP-MessageGOScoreData">
                            <div class="MQP-Flex">
                                <span class="sr-av">${msgs.msgScore}: </span>
                                <div class="exeQuextIcons exeQuextIcons-Score" title="${msgs.msgScore}"></div>
                                <span id="mapaGoScore-${instance}"></span>
                            </div>
                            <div class="MQP-Flex">
                                <span class="sr-av">${msgs.msgNumQuestions}: </span>
                                <div class="exeQuextIcons exeQuextIcons-Number" title="${msgs.msgNumQuestions}"></div>
                                <span id="mapaGONumber-${instance}"></span>
                            </div>
                            <div class="MQP-Flex">
                                <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                                <span class="sr-av">${msgs.msgHits}: </span>
                                <span id="mapaGOHits-${instance}"></span>
                            </div>
                            <div class="MQP-Flex" id="mapaErrorScore-${instance}">
                                <span class="sr-av">${msgs.msgErrors}: </span>
                                <div class="exeQuextIcons exeQuextIcons-Error" title="${msgs.msgErrors}"></div>
                                <span id="mapaGOErrors-${instance}"></span>
                            </div>
                        </div>
                    </div>
                    <p id="mapaGOMessage-${instance}"></p>
                    <div class="MQP-GOScoreButtons">
                        <a href="#" id="mapaMessageGOYes-${instance}" title="${msgs.msgYes}">${msgs.msgYes}</a>
                        <a href="#" id="mapaMessageGONo-${instance}" title="${msgs.msgNo}">${msgs.msgNo}</a>
                    </div>
                </div>
                <div id="mapaFMessageAccess-${instance}" class="MQP-MessageGOScore">
                    <div class="MQP-MessageGOContent">
                        <div class="MQP-MessageModalIcono"></div>
                        <div class="MQP-MessageMoScoreData">
                            <p id="mapaAccessMessage-${instance}"></p>
                            <div class="MQP-DataCodeAccessE">
                                <input type="text" class="MQP-CodeAccessE form-control" id="mapaCodeAccessE-${instance}">
                                <a href="#" id="mapaCodeAccessButton-${instance}" title="${msgs.msgSubmit}">
                                    <strong><span class="sr-av">${msgs.msgSubmit}</span></strong>
                                    <div class="exeQuextIcons-Submit MQP-Activo"></div>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        return html;
    },

    getTestGame: function (instance) {
        const msgs = $eXeMapa.options[instance].msgs,
            html = `
            <div class="MQP-TestContainer" id="mapaFTests-${instance}">
                <div class="MQP-GameScoreBoard">
                    <div class="MQP-GameScores">
                        <div class="exeQuextIcons exeQuextIcons-Number" title="${msgs.msgNumQuestions}"></div>
                        <p><span class="sr-av">${msgs.msgNumQuestions}: </span><span id="mapaPNumber-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                        <p><span class="sr-av">${msgs.msgHits}: </span><span id="mapaPHits-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Error" title="${msgs.msgErrors}"></div>
                        <p><span class="sr-av">${msgs.msgErrors}: </span><span id="mapaPErrors-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Score" title="${msgs.msgScore}"></div>
                        <p><span class="sr-av">${msgs.msgScore}: </span><span id="mapaPScore-${instance}">0</span></p>
                    </div>
                    <div class="MQP-Close">
                        <a href="#" class="MQP-LinkClose" id="mapaLinkClose-${instance}" title="${msgs.msgClose}">
                            <strong class="sr-av">${msgs.msgClose}:</strong>
                            <div class="MQP-IconsToolBar exeQuextIcons-CWGame MQP-Activo"></div>
                        </a>
                    </div>
                </div>
                <div class="MQP-ShowClue MQP-Parpadea" id="mapaShowClue-${instance}">
                    <div class="sr-av">${msgs.msgClue}:</div>
                    <p class="MQP-PShowClue" id="mapaPShowClue-${instance}"></p>
                </div>
                <div class="MQP-Message" id="mapaMessage-${instance}"></div>
                <div class="MQP-QuestionDiv" id="mapaQuestionDiv-${instance}">
                    <div class="sr-av">${msgs.msgQuestion}:</div>
                    <div class="MQP-Question" id="mapaQuestion-${instance}"></div>
                    <div class="MQP-OptionsDiv" id="mapaOptionsDiv-${instance}">
                        <div class="sr-av">${msgs.msgOption} A:</div>
                        <a href="#" class="MQP-Option1 MQP-Options" id="mapaOption1-${instance}" data-number="0"></a>
                        <div class="sr-av">${msgs.msgOption} B:</div>
                        <a href="#" class="MQP-Option2 MQP-Options" id="mapaOption2-${instance}" data-number="1"></a>
                        <div class="sr-av">${msgs.msgOption} C:</div>
                        <a href="#" class="MQP-Option3 MQP-Options" id="mapaOption3-${instance}" data-number="2"></a>
                        <div class="sr-av">${msgs.msgOption} D:</div>
                        <a href="#" class="MQP-Option4 MQP-Options" id="mapaOption4-${instance}" data-number="3"></a>
                    </div>
                </div>
                <div class="MQP-WordsDiv" id="mapaWordDiv-${instance}">
                    <div class="sr-av">${msgs.msgAnswer}:</div>
                    <div class="MQP-Prhase" id="mapaEPhrase-${instance}"></div>
                    <div class="sr-av">${msgs.msgQuestion}:</div>
                    <div class="MQP-Definition" id="mapaDefinition-${instance}"></div>
                    <div class="MQP-DivReply" id="mapaDivResponder-${instance}">
                        <input type="text" value="" class="MQP-EdReply form-control" id="mapaEdAnswer-${instance}" autocomplete="off">
                        <a href="#" id="mapaBtnReply-${instance}" title="${msgs.msgAnswer}">
                            <strong class="sr-av">${msgs.msgAnswer}</strong>
                            <div class="exeQuextIcons-Submit MQP-Activo"></div>
                        </a>
                    </div>
                </div>
                <div class="MQP-BottonContainerTestDiv" id="mapaBottonContainer-${instance}">
                    <div class="MQP-AnswersDiv" id="mapaAnswerDiv-${instance}">
                        <div class="MQP-Answers" id="mapaAnswers-${instance}"></div>
                        <a href="#" id="mapaButtonAnswer-${instance}" title="${msgs.msgAnswer}">
                            <strong class="sr-av">${msgs.msgAnswer}</strong>
                            <div class="exeQuextIcons-Submit MQP-Activo"></div>
                        </a>
                    </div>
                </div>
            </div>
        `;

        return html;
    },

    getTPQuestions: function (instance) {
        const msgs = $eXeMapa.options[instance].msgs,
            html = `
            <div class="MQP-DetailTP" id="mapaTPQuestions-${instance}">
                <div class="MQP-GameScoreBoard">
                    <div class="MQP-GameScores">
                        <div class="exeQuextIcons exeQuextIcons-Number" title="${msgs.msgNumQuestions}"></div>
                        <p><span class="sr-av">${msgs.msgNumQuestions}: </span><span id="mapaPNumber1-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                        <p><span class="sr-av">${msgs.msgHits}: </span><span id="mapaPHits1-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Error" title="${msgs.msgErrors}"></div>
                        <p><span class="sr-av">${msgs.msgErrors}: </span><span id="mapaPErrors1-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Score" title="${msgs.msgScore}"></div>
                        <p><span class="sr-av">${msgs.msgScore}: </span><span id="mapaPScore1-${instance}">0</span></p>
                    </div>
                    <div class="MQP-Close">
                        <a href="#" class="MQP-LinkClose" id="mapaTPClose-${instance}" title="${msgs.msgClose}">
                            <strong class="sr-av">${msgs.msgClose}:</strong>
                            <div class="MQP-IconsToolBar exeQuextIcons-CWGame MQP-Activo"></div>
                        </a>
                    </div>
                </div>
                <div class="MQP-ShowClue MQP-Parpadea" id="mapaShowClue-${instance}">
                    <div class="sr-av">${msgs.msgClue}:</div>
                    <p class="MQP-PShowClue" id="mapaPShowClue1-${instance}"></p>
                </div>
                <div class="MQP-Message" id="mapaMessage1-${instance}"></div>
                <div class="MQP-QuestionDiv" id="mapaQuestionDiv1-${instance}">
                    <div class="sr-av">${msgs.msgQuestion}:</div>
                    <div class="MQP-Question" id="mapaQuestion1-${instance}"></div>
                    <div class="MQP-OptionsDiv" id="mapaOptionsDiv1-${instance}">
                        <div class="sr-av">${msgs.msgOption} A:</div>
                        <a href="#" class="MQP-Option1 MQP-Options" id="mapaOption11-${instance}" data-number="0"></a>
                        <div class="sr-av">${msgs.msgOption} B:</div>
                        <a href="#" class="MQP-Option2 MQP-Options" id="mapaOption21-${instance}" data-number="1"></a>
                        <div class="sr-av">${msgs.msgOption} C:</div>
                        <a href="#" class="MQP-Option3 MQP-Options" id="mapaOption31-${instance}" data-number="2"></a>
                        <div class="sr-av">${msgs.msgOption} D:</div>
                        <a href="#" class="MQP-Option4 MQP-Options" id="mapaOption41-${instance}" data-number="3"></a>
                    </div>
                </div>
                <div class="MQP-WordsDiv" id="mapaWordDiv1-${instance}">
                    <div class="sr-av">${msgs.msgAnswer}:</div>
                    <div class="MQP-Prhase" id="mapaEPhrase1-${instance}"></div>
                    <div class="sr-av">${msgs.msgQuestion}:</div>
                    <div class="MQP-Definition" id="mapaDefinition1-${instance}"></div>
                    <div class="MQP-DivReply" id="mapaDivResponder1-${instance}">
                        <input type="text" value="" class="MQP-EdReply form-control" id="mapaEdAnswer1-${instance}" autocomplete="off">
                        <a href="#" id="mapaBtnReply1-${instance}" title="${msgs.msgAnswer}">
                            <strong class="sr-av">${msgs.msgAnswer}</strong>
                            <div class="exeQuextIcons-Submit MQP-Activo"></div>
                        </a>
                    </div>
                </div>
                <div class="MQP-BottonContainerDiv" id="mapaBottonContainer1-${instance}">
                   <div class="MQP-TestReloadDiv" id="mapaTestReloadDiv1-${instance}">
                        <a href="#" id="mapaButtonReload1-${instance}" title="${msgs.msgNotCorrect3}">
                            <div class="exeQuextIcons-Reload MQP-Activo"></div>
                        </a>
                        <a href="#" id="mapaButtonReload2-${instance}"> ${msgs.msgNotCorrect3}</a>
                    </div> 
                   <div class="MQP-AnswersDiv" id="mapaAnswerDiv1-${instance}">
                        <div class="MQP-Answers" id="mapaAnswers1-${instance}"></div>
                        <a href="#" id="mapaButtonAnswer1-${instance}" title="${msgs.msgAnswer}">
                            <strong class="sr-av">${msgs.msgAnswer}</strong>
                            <div class="exeQuextIcons-Submit MQP-Activo"></div>
                        </a>
                    </div>
                </div>
            </div>
        `;

        return html;
    },
    getDetailMedia: function (instance) {
        const path = $eXeMapa.idevicePath,
            msgs = $eXeMapa.options[instance].msgs,
            html = `
            <div class="MQP-Detail" id="mapaFDetails-${instance}">
                <p class="MQP-MessageDetail" id="mapaMessageDetail-${instance}"></p>
                <div class="MQP-Flex">
                    <div class="MQP-TitlePoint" id="mapaTitlePoint-${instance}"></div>
                </div>
                <div class="MQP-MultimediaPoint" id="mapaMultimediaPoint-${instance}">
                    <img src="" class="MQP-Images" id="mapaImagePoint-${instance}" alt="${msgs.msgNoImage}" />
                    <img src="${path}mapaHome.png" class="MQP-Cover" id="mapaCoverPoint-${instance}" alt="${msgs.msgNoImage}" />
                    <div class="MQP-Video" id="mapaVideoPoint-${instance}"></div>
                    <video controls class="MQP-VideoLocal" id="mapaVideoLocal-${instance}"></video>
                    <a href="#" class="MQP-LinkAudio MQP-Activo" id="mapaLinkAudio-${instance}" title="${msgs.msgAudio}"></a>
                    <a href="#" class="MQP-LinkSlideLeft MQP-Activo" id="mapaLinkSlideLeft-${instance}" title="${msgs.msgAudio}"></a>
                    <a href="#" class="MQP-LinkSlideRight MQP-Activo" id="mapaLinkSlideRight-${instance}" title="${msgs.msgAudio}"></a>
                    <a href="#" id="mapaFullLinkImage-${instance}" class="MQP-FullLinkImage" title="${msgs.msgFullScreen}">
                        <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                        <div  class="exeQuextIcons exeQuextIcons-FullImage MQP-Activo"></div>
                    </a>
                </div>
                <div class="MQP-EText" id="mapaTextPoint-${instance}"></div>
                <div class="MQP-AuthorPoint" id="mapaAuthorPoint-${instance}"></div>
                <div class="MQP-Footer" id="mapaFooterPoint-${instance}"></div>
                <a href="#" class="MQP-LinkDetailClose" id="mapaLinkClose1-${instance}" title="${msgs.msgClose}">
                    <strong class="sr-av">${msgs.msgClose}:</strong>
                    <div class="MQP-IconsToolBar exeQuextIcons-CWGame MQP-Activo"></div>
                </a>
            </div>
        `;

        return html;
    },

    getDetailSound: function (instance) {
        const path = $eXeMapa.idevicePath,
            msgs = $eXeMapa.options[instance].msgs,
            html = `
            <div class="MQP-DetailsSound" id="mapaFDetailsSound-${instance}">
                <p class="MQP-MessageDetail" id="mapaMessageDetailSound-${instance}"></p>
                <div class="MQP-ToolTipTitle" id="mapaTitlePointSound-${instance}"></div>
                <a href="#" class="MQP-ToolTipClose" id="mapaLinkCloseSound-${instance}" title="${msgs.msgClose}">
                    <strong class="sr-av">${msgs.msgClose}:</strong>
                    <div class="MQP-IconsToolBar exeQuextIcons-CWGame MQP-Activo"></div>
                </a>
                <div class="MQP-MultimediaPointSound">
                    <a href="#" class="MQP-LinkSound MQP-Activo" id="mapaLinkAudio1-${instance}" title="${msgs.msgAudio}">
                        <img src="${path}mapam2.svg" class="MQP-Images" alt="${msgs.msgAudio}" />
                    </a>
                </div>
                <div class="MQP-FooterSound" id="mapaFooterPointSound-${instance}"></div>
            </div>
        `;

        return html;
    },

    getDetailTest: function (instance) {
        const path = $eXeMapa.idevicePath,
            msgs = $eXeMapa.options[instance].msgs,
            html = `
            <div class="MQP-Test" id="mapaTest-${instance}">
                <div class="MQP-MessageFindDiv" id="mapaMessageRect-${instance}">
                    <a href="#" id="mapaPlayAudioRect-${instance}" title="${msgs.msgAudio}">
                        <span class="sr-av">${msgs.msgAudio}:</span>
                        <div class="MQP-IconPlayIdentify MQP-Activo" id="-${instance}"></div>
                    </a>
                    <span class="MQP-MessageFind" id="mapaMessageRectP-${instance}"></span>
                </div>
                <div class="MQP-ContentRect" id="mapaContainerRect-${instance}">
                    <img src="${path}mapaHome.png" id="mapaImageRect-${instance}" class="MQP-ImageRect" alt="" />
                    <div class="MPQ-CursorRect"></div>
                </div>
                <div class="MPQ-OptionsTest" id="mapaOptionsTest-${instance}"></div>
                <a href="#" class="MQP-LinkCloseOptions" id="mapaLinkCloseOptions-${instance}" title="${msgs.msgClose}">
                    <strong class="sr-av">${msgs.msgClose}:</strong>
                    <div class="MQP-IconsToolBar exeQuextIcons-CWGame MQP-Activo"></div>
                </a>
            </div>
        `;

        return html;
    },

    clear: function (phrase) {
        return phrase.replace(/[&\s\n\r]+/g, ' ').trim();
    },

    showImagePoint: function (url, author, alt, instance) {
        const $noImage = $('#mapaCoverPoint-' + instance),
            $Image = $('#mapaImagePoint-' + instance),
            $Author = $('#mapaAuthorPoint-' + instance);
        if ($.trim(url).length == 0) {
            $Image.hide();
            $noImage.show();
            return false;
        }

        $Author.html(author);
        $Image
            .prop('src', url)
            .on('load', function () {
                if (
                    !this.complete ||
                    typeof this.naturalWidth == 'undefined' ||
                    this.naturalWidth == 0
                ) {
                    $Image.hide();
                    $Image.attr(
                        'alt',
                        $eXeMapa.options[instance].msgs.msgNoImage
                    );
                    $noImage.show();
                    return false;
                } else {
                    let mData = $eXeMapa.placeImageWindows(
                        this,
                        this.naturalWidth,
                        this.naturalHeight
                    );
                    $eXeMapa.drawImage(this, mData);
                    $Image.show();
                    $noImage.hide();
                    $Image.attr('alt', alt);
                    return true;
                }
            })
            .on('error', function () {
                $Image.hide();
                $Image.attr('alt', $eXeMapa.options[instance].msgs.msgNoImage);
                $noImage.show();
                return false;
            });
    },

    getNumberPoints: function (pts) {
        let number = 0;
        for (let i = 0; i < pts.length; i++) {
            let p = pts[i];
            p.state = -1;
            number++;
            if (p.type == 5 && p.map.pts.length != 0) {
                let rnumber = $eXeMapa.getNumberPoints(p.map.pts);
                number += rnumber;
            }
        }
        return number;
    },

    resetPoints: function (pts) {
        for (let i = 0; i < pts.length; i++) {
            let p = pts[i];
            p.state = -1;
            if (p.type == 5 && p.map.pts.length != 0) {
                $eXeMapa.resetPoints(p.map.pts);
            }
        }
    },

    startFinds: function (instance) {
        const mOptions = $eXeMapa.options[instance];

        $eXeMapa.resetPoints(mOptions.activeMap.pts);
        $eXeMapa.paintPoints(instance);

        mOptions.titles = $exeDevices.iDevice.gamification.helpers.shuffleAds(
            mOptions.titles
        );
        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.gameOver = false;
        mOptions.activeTitle = 0;
        mOptions.obtainedClue = false;
        mOptions.gameActived = false;
        mOptions.gameOver = false;
        mOptions.activeQuestion = 0;
        mOptions.titleRect = '';

        $('#mapaPScoreF-' + instance).text(0);
        $('#mapaPHitsF-' + instance).text(0);
        $('#mapaPErrorsF-' + instance).text(0);
        $('#mapaPScoreF-' + instance).text(0);
        $('#mapaPNumberF-' + instance).text(mOptions.numberQuestions);
        $('#mapaGameClue-' + instance).hide();
    },

    showFind: function (instance, num) {
        const mOptions = $eXeMapa.options[instance],
            msg =
                mOptions.evaluationG == 2
                    ? mOptions.msgs.msgIdentify
                    : mOptions.msgs.msgSearch;
        mOptions.title = mOptions.titles[num];

        let mt = mOptions.msgs.msgClickOn + ' ' + mOptions.title.title;
        if (
            typeof mOptions.titles[num].question != 'undefined' &&
            mOptions.titles[num].question.length > 0
        ) {
            mt =
                mOptions.msgs.msgClickOn +
                ' "' +
                mOptions.titles[num].question +
                '"';
        }

        $('#mapaGameContainer-' + instance)
            .find('a.MQP-Point')
            .attr('title', mt);
        let mq = msg + ': ' + mOptions.title.title;
        if (
            typeof mOptions.titles[num].question != 'undefined' &&
            mOptions.titles[num].question.length > 0
        ) {
            mq = mOptions.titles[num].question;
        }

        $('#mapaMessageFindP-' + instance).text(mq);
        $('#mapaPlayAudioIdenty-' + instance).hide();
        $exeDevices.iDevice.gamification.media.stopSound(mOptions);
        if (
            typeof mOptions.title.audio != 'undefined' &&
            mOptions.title.audio.length > 4
        ) {
            $exeDevices.iDevice.gamification.media.playSound(
                mOptions.title.audio,
                mOptions
            );
            $('#mapaPlayAudioIdenty-' + instance).show();
        }

        mOptions.showDetail = false;
        let html = $('#mapaMainContainer-' + instance).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);
        if (latex)
            $exeDevices.iDevice.gamification.math.updateLatex(
                '#mapaMainContainer-' + instance
            );
    },
    initElements: function (instance) {
        const mOptions = $eXeMapa.options[instance];

        $eXeMapa.hideModalWindows(instance);

        $('#mapaGameMinimize-' + instance).hide();
        $('#mapaGameContainer-' + instance).hide();
        $('#mapaFDetails-' + instance).hide();
        $('#mapaFDetailsSound-' + instance).hide();
        $('#mapaFTests-' + instance).hide();
        $('#mapaToolBarL-' + instance).hide();
        $('#mapaMessageMaximize-' + instance).text(mOptions.msgs.msgPlayStart);
        $('#mapaVideoPoint-' + instance).hide();
        $('#mapaVideoLocal-' + instance).hide();
        $('#mapaGamerOver-' + instance).hide();
        $('#mapaLinkTest-' + instance).hide();
        $('#mapaFMessages-' + instance).hide();
        $('#mapaFMessageAccess-' + instance).hide();
        $('#mapaFMessageOver-' + instance).hide();
        $('#mapaFMessageInfo-' + instance).hide();
        $('#mapaInstructions-' + instance).text(mOptions.instructions);
        $('#mapaShowClue-' + instance).hide();
        $('#mapaGameClue-' + instance).hide();
        $('#mapaPlayAudioIdenty-' + instance).hide();
        $('#mapaPlayAudioRect-' + instance).hide();
        $('#mapaStartGame-' + instance).text(mOptions.msgs.msgPlayStart);
        $('#mapaMessageFindP-' + instance).hide();
        $('#mapaStartGame-' + instance).hide();
        $('#mapaTPQuestions-' + instance).hide();
        $('#mapaCubierta-' + instance).hide();

        if (
            mOptions.evaluationG == 1 ||
            mOptions.evaluationG == 2 ||
            mOptions.evaluationG == 3 ||
            mOptions.evaluationG == 5
        ) {
            $('#mapaStartGame-' + instance).show();
        }
        if (mOptions.showMinimize) {
            $('#mapaGameMinimize-' + instance)
                .css({
                    cursor: 'pointer',
                })
                .show();
        } else {
            $('#mapaGameContainer-' + instance).show();
        }

        if (mOptions.evaluationG == 1) {
            $('#mapaToolBarL-' + instance).show();
        } else if (mOptions.evaluationG == 2) {
            $('#mapaToolBarL-' + instance).show();
        } else if (mOptions.evaluationG == 3) {
            $('#mapaIconErrorA-' + instance).hide();
            $('#mapaIconErrorB-' + instance).hide();
            $('#mapaToolBarL-' + instance).show();
        } else if (mOptions.evaluationG == 4) {
            $('#mapaLinkTest-' + instance).show();
        }

        if (mOptions.itinerary.showCodeAccess) {
            $('#mapaAccessMessage-' + instance).text(
                mOptions.itinerary.messageCodeAccess
            );
            $('#mapaFMessageAccess-' + instance).show();
            $('#mapaCubierta' + instance).show();
            mOptions.showData = true;
            setTimeout(function () {
                $eXeMapa.placePointInWindow(
                    $('#mapaFMessages-' + instance),
                    -1,
                    instance
                );
            }, 500);
        }

        if (
            !mOptions.hasAreas ||
            !mOptions.showActiveAreas ||
            mOptions.evaluationG == 1
        ) {
            $('#mapaLinkAreas-' + instance).hide();
        }

        $('#mapaAutorLicence-' + instance).html(mOptions.authorImage);
        $('#mapaWordDiv-' + instance).hide();

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }
        if (mOptions.hideAreas) {
            $('#mapaLinkAreas-' + instance).hide();
            $('#mapaMainContainer-' + instance)
                .find('a.MQP-Area')
                .css('cursor', 'default');
            $('#mapaMainContainer-' + instance)
                .find('a.MQP-Area')
                .on('mouseenter', function () {
                    $(this)
                        .data('title', $(this).attr('title'))
                        .removeAttr('title');
                })
                .on('mouseleave', function () {
                    $(this).attr('title', $(this).data('title'));
                });
        }
    },
    addEvents: function (instance) {
        const mOptions = $eXeMapa.options[instance];
        if (mOptions.hideScoreBar) {
            $('#mapaToolBar-' + instance).hide();
        }
        $eXeMapa.refreshGame(instance);
        $eXeMapa.removeEvents(instance);

        $('#mapaLinkMaximize-' + instance).on('click touchstart', function (e) {
            e.preventDefault();
            $('#mapaGameContainer-' + instance).show();
            $('#mapaGameMinimize-' + instance).hide();
            $eXeMapa.refreshGame(instance);
        });

        $('#mapaLinkMinimize-' + instance).on('click touchstart', function (e) {
            e.preventDefault();
            if (mOptions.showData) return;
            $('#mapaGameContainer-' + instance).hide();
            $('#mapaGameMinimize-' + instance)
                .css('visibility', 'visible')
                .show();
            $('#mapaMainContainer-' + instance)
                .css('height', 'auto')
                .show();
        });

        document.onfullscreenchange = function (event) {
            let id = event.target.id.split('-')[1];
            $eXeMapa.refreshGame(id);
        };

        $('#mapaLinkFullScreen-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                if (mOptions.showData) return;
                let element = document.getElementById(
                    'mapaGameContainer-' + instance
                );
                $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                    element,
                    instance
                );
            }
        );

        $('#mapaCodeAccessButton-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $eXeMapa.enterCodeAccess(instance);
            }
        );

        $('#mapaCodeAccessE-' + instance).on('keydown', function (event) {
            if (event.which == 13 || event.keyCode == 13) {
                $eXeMapa.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        $(window).on('unload.eXeMapa beforeunload.eXeMapa', function () {
            if ($eXeMapa.mScorm && typeof $eXeMapa.mScorm != 'undefined') {
                $exeDevices.iDevice.gamification.scorm.endScorm(
                    $eXeMapa.mScorm
                );
            }
        });

        $('#mapaMultimedia-' + instance).on(
            'mouseenter',
            '.MQP-Point',
            function (e) {
                e.preventDefault();
                if (mOptions.showData || !mOptions.gameStarted) {
                    return;
                }
                const n = $(this).data('number'),
                    id = $(this).data('id');
                if (
                    mOptions.autoAudio &&
                    mOptions.evaluationG != 1 &&
                    mOptions.evaluationG != 5 &&
                    mOptions.evaluationG != 2 &&
                    mOptions.evaluationG != 3 &&
                    typeof mOptions.activeMap.pts[n].audio != 'undefined' &&
                    mOptions.activeMap.pts[n].audio.length > 4
                ) {
                    $exeDevices.iDevice.gamification.media.playSound(
                        mOptions.activeMap.pts[n].audio,
                        mOptions
                    );
                    if (mOptions.activeMap.pts[n].type == 3) {
                        mOptions.visiteds.push(id);
                    }
                }
                if (
                    mOptions.evaluationG != 5 &&
                    mOptions.autoShow &&
                    (mOptions.evaluationG == 0 || mOptions.evaluationG == 4)
                ) {
                    mOptions.showData = true;
                    $eXeMapa.showPoint(n, instance);
                }
            }
        );

        $('#mapaLinkAudio-' + instance).on('click', function (e) {
            e.preventDefault();
            if (
                typeof mOptions.activeMap.pts[mOptions.activeMap.active]
                    .audio != 'undefined' &&
                mOptions.activeMap.pts[mOptions.activeMap.active].audio.length >
                    4
            ) {
                $exeDevices.iDevice.gamification.media.playSound(
                    mOptions.activeMap.pts[mOptions.activeMap.active].audio,
                    mOptions
                );
            }
        });

        $('#mapaLinkAudio1-' + instance).on('click', function (e) {
            e.preventDefault();
            if (
                typeof mOptions.activeMap.pts[mOptions.activeMap.active]
                    .audio != 'undefined' &&
                mOptions.activeMap.pts[mOptions.activeMap.active].audio.length >
                    4
            ) {
                $exeDevices.iDevice.gamification.media.playSound(
                    mOptions.activeMap.pts[mOptions.activeMap.active].audio,
                    mOptions
                );
            }
        });

        $('#mapaPlayAudioIdenty-' + instance).on('click', function (e) {
            e.preventDefault();
            if (
                typeof mOptions.title.audio != 'undefined' &&
                mOptions.title.audio.length > 4
            ) {
                $exeDevices.iDevice.gamification.media.playSound(
                    mOptions.title.audio,
                    mOptions
                );
            }
        });

        $('#mapaPlayAudioRect-' + instance).on('click', function (e) {
            e.preventDefault();
            if (
                typeof mOptions.activeMap.pts[mOptions.activeMap.active] !=
                    'undefined' &&
                typeof mOptions.activeMap.pts[mOptions.activeMap.active]
                    .question_audio != 'undefined' &&
                mOptions.activeMap.pts[mOptions.activeMap.active].question_audio
                    .length > 4
            ) {
                $exeDevices.iDevice.gamification.media.playSound(
                    mOptions.activeMap.pts[mOptions.activeMap.active]
                        .question_audio,
                    mOptions
                );
            }
        });

        $('#mapaCanvas-' + instance).mousemove(function (event) {
            if (
                !mOptions.hasAreas ||
                mOptions.showData ||
                !mOptions.gameStarted
            ) {
                return;
            }
            let rect = this.getBoundingClientRect();
            let x = event.clientX - rect.left;
            let y = event.clientY - rect.top;
            let newArea = $eXeMapa.isCursorInsidePolygon(instance, x, y);
            this.style.cursor = 'default';
            if (newArea && mOptions.currentArea !== newArea) {
                $eXeMapa.enterArea(instance, newArea.number, newArea.id);
                let mt = newArea.title;
                if (mOptions.evaluationG == 2 || mOptions.evaluationG == 3) {
                    mt = mOptions.msgs.msgClickOn + ' ' + mOptions.title.title;
                    if (
                        typeof mOptions.title.question != 'undefined' &&
                        mOptions.title.question.length > 0
                    ) {
                        mt =
                            mOptions.msgs.msgClickOn +
                            ' "' +
                            mOptions.title.question +
                            '"';
                    }
                }
                let contenedorOffset = $(
                    '#mapaMultimedia-' + instance
                ).offset();
                let posX = event.pageX - contenedorOffset.left;
                let posY = event.pageY - contenedorOffset.top;
                $('#mapaTooltipA-' + instance).text(mt);
                if (!mOptions.hideAreas) {
                    $('#mapaTooltipA-' + instance).css({
                        top: posY + 20 + 'px',
                        left: posX + 3 + 'px',
                        display: 'block',
                    });
                    this.style.cursor = 'pointer';
                }
                mOptions.activeArea = newArea;
            } else if (!newArea) {
                if (mOptions.currentArea) {
                    mOptions.currentArea = null;
                }
                this.style.cursor = 'default';
                $('#mapaTooltipA-' + instance).hide();
            }
        });

        $('#mapaLinkAreas-' + instance).on('mouseenter click', function (e) {
            e.preventDefault();
            $eXeMapa.paintAreas(instance, 'rgba(59, 123, 84, 0.6)');
        });

        $('#mapaLinkAreas-' + instance).on('mouseleave', function (e) {
            e.preventDefault();
            $eXeMapa.paintAreas(instance, 'rgba(59, 123, 84, 0.001)');
            if (mOptions.evaluationG == 6 && mOptions.numLevel == 0) {
                $eXeMapa.paintAreas(instance, $eXeMapa.colors.game);
            }
        });

        $('#mapaLinkTest-' + instance).on('click', function (e) {
            e.preventDefault();
            if (mOptions.showData) return;
            if (
                !mOptions.gameOver &&
                mOptions.activeQuestion < mOptions.numberQuestions
            ) {
                $eXeMapa.showQuestionaire(instance);
            } else {
                $eXeMapa.gameOver(instance);
            }
        });

        $('#mapaFMessageInfoAccept-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeMapa.closePoint(instance);
        });

        $('#mapaMessageGONo-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeMapa.hideCover(instance);
            if (mOptions.evaluationG == 5) {
                $('#mapaCheckOrder-' + instance).hide();
                $('#mapaGameContainer-' + instance).css('height', 'auto');
                return;
            }
            if (mOptions.evaluationG != 0) {
                $eXeMapa.endFind(instance);
            } else {
                mOptions.gameOver = false;
            }
            $('#mapaTest-' + instance).fadeOut(100);
            $('#mapaGameContainer-' + instance).css('height', 'auto');
        });

        $('#mapaMessageGOYes-' + instance).on('click', function (e) {
            e.preventDefault();
            if (mOptions.evaluationG == 5) {
                $eXeMapa.hideCover(instance);
                mOptions.hits = 0;
                mOptions.errors = 0;
                mOptions.score = 0;
                mOptions.gameActived = true;
                mOptions.gameOver = false;
                mOptions.orderResponse = [];
                mOptions.gameStarted = true;
                $('#mapaGameContainer-' + instance).css('height', 'auto');
                $('#mapaCheckOrder-' + instance).show();
                return;
            }
            if (
                mOptions.evaluationG == 1 ||
                mOptions.evaluationG == 2 ||
                mOptions.evaluationG == 3
            ) {
                $eXeMapa.startFinds(instance);
                $eXeMapa.hideCover(instance);
                if (mOptions.evaluationG == 2 || mOptions.evaluationG == 3) {
                    $eXeMapa.showFind(instance, 0);
                }
            } else if (
                mOptions.evaluationG == 4 ||
                mOptions.evaluationG == -4
            ) {
                $eXeMapa.hideCover(instance);
                $eXeMapa.rebootGame(instance);
            }
            mOptions.gameStarted = true;
            $('#mapaTest-' + instance).fadeOut(100);
            $('#mapaGameContainer-' + instance).css('height', 'auto');
        });

        $('#mapaLinkClose-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeMapa.stopVideo(instance);
            $exeDevices.iDevice.gamification.media.stopSound(mOptions);
            $eXeMapa.hideCover(instance);
        });

        $('#mapaTPClose-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeMapa.closePoint(instance);
        });

        $('#mapaLinkClose1-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeMapa.closePoint(instance);
        });

        $('#mapaLinkCloseSound-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeMapa.closePoint(instance);
        });

        $('#mapaLinkCloseOptions-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeMapa.closeOptions(instance);
        });

        $('#mapaButtonAnswer-' + instance).on('click touchstart', function (e) {
            e.preventDefault();
            $eXeMapa.answerQuestion(instance);
        });

        $('#mapaOptionsDiv-' + instance)
            .find('.MQP-Options')
            .on('click', function (e) {
                e.preventDefault();
                $eXeMapa.changeQuextion(instance, this);
            });

        $('#mapaBtnReply-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeMapa.answerQuestion(instance);
        });

        $('#mapaEdAnswer-' + instance).on('keydown', function (event) {
            if (event.which == 13 || event.keyCode == 13) {
                $eXeMapa.answerQuestion(instance);
                return false;
            }
            return true;
        });

        $('#mapaButtonAnswer1-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $eXeMapa.answerTPQuestion(instance);
            }
        );

        $('#mapaOptionsDiv1-' + instance)
            .find('.MQP-Options')
            .on('click', function (e) {
                e.preventDefault();
                $eXeMapa.changeTPQuextion(instance, this);
            });

        $('#mapaBtnReply1-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeMapa.answerTPQuestion(instance);
        });

        $('#mapaEdAnswer1-' + instance).on('keydown', function (event) {
            if (event.which == 13 || event.keyCode == 13) {
                $eXeMapa.answerTPQuestion(instance);
                return false;
            }
            return true;
        });

        $('#mapaMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $eXeMapa.sendScore(false, instance);
                $eXeMapa.saveEvaluation(instance);
                return true;
            });

        $('#mapaMultimedia-' + instance).on(
            'click',
            '.MQP-Point, .MQP-TextLink',
            function (e) {
                e.preventDefault();
                if (mOptions.showData || !mOptions.gameStarted) {
                    return;
                }
                mOptions.showData = true;
                const n = $(this).data('number'),
                    id = $(this).data('id');
                if (
                    !mOptions.gameOver &&
                    (mOptions.evaluationG == 1 ||
                        mOptions.evaluationG == 2 ||
                        mOptions.evaluationG == 3)
                ) {
                    if (mOptions.evaluationG == 1) {
                        $eXeMapa.showOptionsRect(instance, n);
                    } else if (
                        mOptions.evaluationG == 2 ||
                        mOptions.evaluationG == 3
                    ) {
                        if (
                            mOptions.activeMap.pts[n].type == 5 &&
                            mOptions.activeMap.pts[n].map.pts.length > 0
                        ) {
                            $eXeMapa.showMapDetail(instance, n);
                        } else {
                            $eXeMapa.answerFind(n, id, instance);
                        }
                    }
                } else {
                    $eXeMapa.showPoint(n, instance);
                }
            }
        );

        $('#mapaCanvas-' + instance).on('click', function (e) {
            e.preventDefault();
            if (
                !mOptions.hasAreas ||
                mOptions.showData ||
                !mOptions.gameStarted
            ) {
                return;
            }
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            let pointm = $eXeMapa.isCursorInsidePolygon(instance, x, y);
            if (!pointm) return;
            mOptions.showData = true;
            let n = pointm.number,
                id = pointm.id;

            if (
                !mOptions.gameOver &&
                (mOptions.evaluationG == 1 ||
                    mOptions.evaluationG == 2 ||
                    mOptions.evaluationG == 3)
            ) {
                if (mOptions.evaluationG == 1) {
                    $eXeMapa.showOptionsRect(instance, n);
                } else if (
                    mOptions.evaluationG == 2 ||
                    mOptions.evaluationG == 3
                ) {
                    if (
                        mOptions.activeMap.pts[n].type == 5 &&
                        mOptions.activeMap.pts[n].map.pts.length > 0
                    ) {
                        $eXeMapa.showMapDetail(instance, n);
                    } else {
                        $eXeMapa.answerFind(n, id, instance);
                    }
                }
            } else {
                $eXeMapa.showPoint(n, instance);
            }
        });

        $('#mapaToolTip-' + instance).on('mouseleave', function (e) {
            e.preventDefault();
            if (
                mOptions.autoShow &&
                (mOptions.evaluationG == 0 || mOptions.evaluationG == 4)
            ) {
                $eXeMapa.closeToolTip(instance);
            }
        });

        $('#mapaFDetails-' + instance).on('mouseleave', function (e) {
            e.preventDefault();
            if (
                mOptions.autoShow &&
                (mOptions.evaluationG == 0 || mOptions.evaluationG == 4)
            ) {
                $eXeMapa.closePoint(instance);
            }
        });

        $('#mapaFDetailsSound-' + instance).on('mouseleave', function (e) {
            e.preventDefault();
            if (
                mOptions.autoShow &&
                (mOptions.evaluationG == 0 || mOptions.evaluationG == 4)
            ) {
                $eXeMapa.closePoint(instance);
            }
        });

        $('#mapaFMessages-' + instance).on('mouseleave', function (e) {
            e.preventDefault();
            if (
                mOptions.autoShow &&
                (mOptions.evaluationG == 0 || mOptions.evaluationG == 4)
            ) {
                $eXeMapa.closePoint(instance);
            }
        });

        $('#mapaTest-' + instance).on('click', '.MPQ-OptionTest', function (e) {
            e.preventDefault();
            let text = $(this).text(),
                num = $(this).data('number');
            if (mOptions.showData) {
                return;
            }
            $eXeMapa.answerRect(instance, text, num);
        });

        $('#mapaLinkCloseDetail-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeMapa.hideMapDetail(instance, false);
        });

        $('#mapaLinkCloseHome-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeMapa.hideMapDetail(instance, true);
            $('#mapaLinkCloseDetail-' + instance).hide();
            $('#mapaLinkCloseHome-' + instance).hide();
        });

        $('#mapaStartGame-' + instance).on('click', function (e) {
            e.preventDefault();
            if ($('#mapaFMessageAccess-' + instance).is(':visible')) {
                return;
            }
            $eXeMapa.startGame(instance);
        });

        $('#mapaCheckOrder-' + instance).on('click', function (e) {
            e.preventDefault();
            $(this).hide();
            $eXeMapa.checkOrder(instance);
        });

        $('#mapaLinkSlideLeft-' + instance).on('click', function (e) {
            e.preventDefault();
            mOptions.activeSlide =
                mOptions.activeSlide > 0 ? mOptions.activeSlide - 1 : 0;
            if (mOptions.activeSlide == 0) {
                $('#mapaLinkSlideLeft-' + instance).hide();
            }
            if (
                mOptions.activeMap.pts[mOptions.activeMap.active].slides
                    .length > 0
            ) {
                $('#mapaLinkSlideRight-' + instance).show();
            }
            $eXeMapa.showSlide(mOptions.activeSlide, instance);
        });

        $('#mapaLinkSlideRight-' + instance).on('click', function (e) {
            e.preventDefault();
            mOptions.activeSlide++;
            if (
                mOptions.activeSlide >=
                mOptions.activeMap.pts[mOptions.activeMap.active].slides
                    .length -
                    1
            ) {
                mOptions.activeSlide =
                    mOptions.activeMap.pts[mOptions.activeMap.active].slides
                        .length - 1;
                $('#mapaLinkSlideRight-' + instance).hide();
            }
            if (
                mOptions.activeMap.pts[mOptions.activeMap.active].slides
                    .length > 0
            ) {
                $('#mapaLinkSlideLeft-' + instance).show();
            }
            $eXeMapa.showSlide(mOptions.activeSlide, instance);
        });

        $('#mapaToolTipClose-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeMapa.closeToolTip(instance);
        });
        const text = $('#mapaMainContainer-' + instance)
            .parent('.mapa-IDevice')
            .html();
        $('#mapaButtonReload1-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeMapa.reloadTPQuestionnaire(instance);
        });

        $('#mapaButtonReload2-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeMapa.reloadTPQuestionnaire(instance);
        });

        if (mOptions.hasYoutube) {
            $('#mapaStartGame-' + instance).hide();
            $eXeMapa.showMessage(0, 'Cargando. Por favor, espere', instance);
        }

        $('#mapaFullLinkImage-' + instance).on('click', function (e) {
            e.preventDefault();
            const $image = $(this)
                    .closest('.MQP-MultimediaPoint')
                    .find('.MQP-Images'),
                largeImageSrc = $image.attr('src');
            if (largeImageSrc && largeImageSrc.length > 3) {
                $exeDevices.iDevice.gamification.helpers.showFullscreenImage(
                    largeImageSrc,
                    $('#mapaGameContainer-' + instance)
                );
            }
        });

        $('#mapaMainContainer-' + instance)
            .closest('article')
            .on('click', '.box-toggle-on', function (e) {
                $eXeMapa.refreshGame(instance);
            });

        setTimeout(() => {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                this.isInExe
            );
        }, 500);
    },
    removeEvents: function (instance) {
        const $multimedia = $('#mapaMultimedia-' + instance);
        const $linkAreas = $('#mapaLinkAreas-' + instance);
        const $linkTest = $('#mapaLinkTest-' + instance);

        $('#mapaLinkMaximize-' + instance).off('click');
        $('#mapaLinkMinimize-' + instance).off('click');

        $(document).off('fullscreenchange');
        $('#mapaLinkFullScreen-' + instance).off('click');

        $('#mapaCodeAccessButton-' + instance).off('click');
        $('#mapaCodeAccessE-' + instance).off('click');

        $(window).off('unload.eXeMapa beforeunload.eXeMapa');

        $multimedia.off('click');

        $('#mapaLinkAudio-' + instance).off('click');
        $('#mapaLinkAudio1-' + instance).off('click');
        $('#mapaPlayAudioIdenty-' + instance).off('click');
        $('#mapaPlayAudioRect-' + instance).off('click');

        $('#mapaCanvas-' + instance).off('click');
        $linkAreas.off('click');

        $linkTest.off('click');

        $('#mapaFMessageInfoAccept-' + instance).off('click');
        $('#mapaMessageGONo-' + instance).off('click');
        $('#mapaMessageGOYes-' + instance).off('click');

        $('#mapaLinkClose-' + instance).off('click');
        $('#mapaTPClose-' + instance).off('click');
        $('#mapaLinkClose1-' + instance).off('click');
        $('#mapaLinkCloseSound-' + instance).off('click');
        $('#mapaLinkCloseOptions-' + instance).off('click');

        $('#mapaButtonAnswer-' + instance).off('click');
        $('#mapaButtonAnswer1-' + instance).off('click');
        $('#mapaEdAnswer-' + instance).off('click');
        $('#mapaEdAnswer1-' + instance).off('click');

        $('#mapaMainContainer-' + instance)
            .closest('.idevice_node')
            .off('click', '.Games-SendScore');

        $('#mapaOptionsDiv-' + instance)
            .find('.MQP-Options')
            .off('click');
        $('#mapaOptionsDiv1-' + instance)
            .find('.MQP-Options')
            .off('click');

        $('#mapaButtonReload1-' + instance).off('click');
        $('#mapaButtonReload2-' + instance).off('click');

        $('#mapaStartGame-' + instance).off('click');
        $('#mapaCheckOrder-' + instance).off('click');
        $('#mapaLinkSlideLeft-' + instance).off('click');
        $('#mapaLinkSlideRight-' + instance).off('click');
        $('#mapaToolTip-' + instance).off('click');
        $('#mapaFDetails-' + instance).off('click');
        $('#mapaFDetailsSound-' + instance).off('click');
        $('#mapaFMessages-' + instance).off('click');
        $('#mapaTest-' + instance).off('click');
        $('#mapaLinkCloseDetail-' + instance).off('.click');
        $('#mapaLinkCloseHome-' + instance).off('click');
    },

    enterArea(instance, n, id) {
        const mOptions = $eXeMapa.options[instance];
        if (
            mOptions.autoAudio &&
            mOptions.evaluationG != 5 &&
            mOptions.evaluationG != 1 &&
            mOptions.evaluationG != 2 &&
            mOptions.evaluationG != 3 &&
            typeof mOptions.activeMap.pts[n].audio != 'undefined' &&
            mOptions.activeMap.pts[n].audio.length > 4
        ) {
            $exeDevices.iDevice.gamification.media.playSound(
                mOptions.activeMap.pts[n].audio,
                mOptions
            );
            if (mOptions.activeMap.pts[n].type == 3) {
                mOptions.visiteds.push(id);
            }
        }
        if (
            mOptions.evaluationG != 5 &&
            mOptions.autoShow &&
            (mOptions.evaluationG == 0 || mOptions.evaluationG == 4)
        ) {
            mOptions.showData = true;
            $eXeMapa.showPoint(n, instance);
        }
    },
    adjustFontSize: function (fsize) {
        const baseFontSize = parseInt(fsize);
        if (!baseFontSize) '14px';
        let screenWidth = $(window).width();
        let fontSize, lineHeight, maxwidth;

        if (screenWidth <= 480) {
            fontSize = baseFontSize * 0.7;
            lineHeight = fontSize * 1.1;
            maxwidth = 126;
        } else if (screenWidth <= 768) {
            fontSize = baseFontSize * 0.8;
            lineHeight = fontSize * 1.2;
            maxwidth = 144;
        } else {
            fontSize = baseFontSize;
            lineHeight = fontSize * 1.2;
            maxwidth = 180;
        }
        let font = {
            fontsize: fontSize + 'px',
            lineheight: lineHeight + 'px',
            maxwidth: maxwidth + 'px',
        };
        return font;
    },

    showSlide: function (i, instance) {
        const mOptions = $eXeMapa.options[instance],
            q = mOptions.activeMap.pts[mOptions.activeMap.active];
        $eXeMapa.showImagePoint(
            q.slides[i].url,
            q.slides[i].author,
            q.slides[i].alt,
            instance
        );
        $('#mapaAuthorPoint-' + instance).html(q.slides[i].author);
        $('#mapaTitlePoint-' + instance).text(q.slides[i].title);
        $('#mapaFooterPoint-' + instance).text(q.slides[i].footer);
        $('#mapaMultimediaPoint-' + instance).show();
        if (q.slides[0].author > 0) {
            $('#mapaAuthorPoint-' + instance).show();
        }
        $('#mapaFooterPoint-' + instance).hide();
        if (q.slides[0].footer.length > 0) {
            $('#mapaFooterPoint-' + instance).show();
        }
        $eXeMapa.placePointInWindow(
            $('#mapaFDetails-' + instance),
            mOptions.activeMap.active,
            instance
        );
    },

    showPointLink: function (num, instance) {
        const mOptions = $eXeMapa.options[instance],
            q = mOptions.activeMap.pts[num];
        if (!mOptions.loadingURL) {
            mOptions.loadingURL = true;
            let win = window.open(q.link, '_blank');
            if (win) {
                win.focus();
            } else {
                alert('Permita las ventanas emergentes en este sitio');
            }
            setTimeout(function () {
                mOptions.showData = false;
                mOptions.loadingURL = false;
            }, 1000);
        }
    },

    showToolTip: function (num, instance) {
        const mOptions = $eXeMapa.options[instance],
            q = mOptions.activeMap.pts[num],
            $divText = $('#mapaMainContainer-' + instance)
                .parent('.mapa-IDevice')
                .find('.mapa-LinkToolTipPoints[data-id="' + q.id + '"]')
                .eq(0);
        $('#mapaToolTipText-' + instance).empty();

        if ($divText.length == 1) {
            $divText.removeClass('js-hidden');
            $('#mapaToolTipText-' + instance).append($divText);
        }

        const html = $('#mapaToolTipText-' + instance).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);
        if (latex)
            $exeDevices.iDevice.gamification.math.updateLatex(
                '#mapaToolTipText-' + instance
            );

        $('#mapaToolTipTitle-' + instance).text(q.title);
        $('#mapaToolTipText-' + instance).show();
        $('#mapaFooterPoint-' + instance).hide();
        $('#mapaMultimediaPoint-' + instance).hide();

        $eXeMapa.placePointInWindow(
            $('#mapaToolTip-' + instance),
            num,
            instance
        );
    },

    showPointNone: function (num, instance) {
        const mOptions = $eXeMapa.options[instance],
            q = mOptions.activeMap.pts[num];
        if (
            mOptions.evaluationG == 1 ||
            mOptions.evaluationG == 2 ||
            mOptions.evaluationG == 3
        ) {
            mOptions.activeTitle++;
            if (mOptions.activeTitle > mOptions.numberQuestions) {
                $eXeMapa.gameOver(instance);
            } else if (mOptions.evaluationG == 2 || mOptions.evaluationG == 3) {
                $eXeMapa.showFind(instance, mOptions.activeTitle);
            }
        } else {
            $eXeMapa.showMessageModal(instance, q.title, 1, 0, num);
        }
        mOptions.visiteds.push(q.id);
        if (
            mOptions.isScorm == 1 &&
            mOptions.evaluationG != 4 &&
            mOptions.evaluationG > -1
        ) {
            const score =
                mOptions.evaluationG === 0
                    ? $eXeMapa.getScoreVisited(instance)
                    : $eXeMapa.getScoreFind(instance);
            $eXeMapa.sendScore(true, instance);
            $('#mapaRepeatActivity-' + instance).text(
                mOptions.msgs.msgYouScore + ': ' + score
            );
        }
        $eXeMapa.saveEvaluation(instance);
        $eXeMapa.messageAllVisited(instance);
    },

    showPointImage: function (num, instance) {
        const mOptions = $eXeMapa.options[instance],
            q = mOptions.activeMap.pts[num];
        $eXeMapa.showImagePoint(q.url, q.author, q.alt, instance);
        $('#mapaMultimediaPoint-' + instance).show();
        $('#mapaFullLinkImage-' + instance).show();
        if (q.author.length > 0) {
            $('#mapaAuthorPoint-' + instance).show();
        }
        $eXeMapa.placePointInWindow(
            $('#mapaFDetails-' + instance),
            num,
            instance
        );
    },

    showPointSound: function (num, instance) {
        const mOptions = $eXeMapa.options[instance];
        if (mOptions.evaluationG != 5 && mOptions.autoAudio) {
            $eXeMapa.placePointInWindow(
                $('#mapaFDetailsSound-' + instance),
                num,
                instance
            );
        } else {
            mOptions.showData = false;
        }
    },
    showPointVideo: function (num, instance) {
        let mOptions = $eXeMapa.options[instance];
        mOptions.waitPlayVideo = true;
        $eXeMapa.playVideo(instance);
        $eXeMapa.placePointInWindow(
            $('#mapaFDetails-' + instance),
            num,
            instance
        );
    },
    showPointText: function (num, instance) {
        let mOptions = $eXeMapa.options[instance],
            q = mOptions.activeMap.pts[num],
            $divText = $('#mapaMainContainer-' + instance)
                .parent('.mapa-IDevice')
                .find('.mapa-LinkTextsPoints[data-id="' + q.id + '"]')
                .eq(0);
        $('#mapaTextPoint-' + instance).empty();
        $('#mapaTextPoint-' + instance).show();
        $('#mapaFooterPoint-' + instance).hide();
        $('#mapaMultimediaPoint-' + instance).hide();
        if ($divText.length == 1) {
            $divText.removeClass('js-hidden');
            $('#mapaTextPoint-' + instance).append($divText);
        }
        let html = $('#mapaTextPoint-' + instance).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);
        if (latex) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '#mapaTextPoint-' + instance
            );
        }
        $eXeMapa.placePointInWindow(
            $('#mapaFDetails-' + instance),
            num,
            instance
        );
    },
    showTPQuestionnaire: function (num, instance) {
        $eXeMapa.showTPQuestion(instance);
        $eXeMapa.placePointInWindow(
            $('#mapaTPQuestions-' + instance),
            num,
            instance
        );
        $('#mapaTPQuestions-' + instance).show();
        $('#mapaBottonContainer1-' + instance).css({
            'justify-content': 'flex-end',
        });
    },
    reloadTPQuestionnaire: function (instance) {
        let mOptions = $eXeMapa.options[instance],
            p = mOptions.activeMap.pts[mOptions.activeMap.active];
        p.score = 0;
        p.hits = 0;
        p.errors = 0;
        p.activeTest = 0;
        $('#mapaPScore1-' + instance).text(p.score);
        $('#mapaPHits1-' + instance).text(p.hits);
        $('#mapaPErrors1-' + instance).text(p.errors);
        $('#mapaBottonContainer1-' + instance).css({
            'justify-content': 'flex-end',
        });
        $('#mapaTestReloadDiv1-' + instance).hide();
        $('#mapaPNumber1-' + instance).text(p.numbertests);
        $eXeMapa.showTPQuestion(instance);
    },

    placePointInWindow: function ($window, num, instance) {
        const mOptions = $eXeMapa.options[instance],
            $gameContainer = $('#mapaGameContainer-' + instance),
            $mainContainer = $('#mapaMainContainer-' + instance),
            $multimediaContainer = $('#mapaMultimedia-' + instance),
            isFullScreen = $eXeMapa.isFullScreen(),
            $toolbar = $('#mapaToolBar-' + instance),
            $messageFind = $('#mapaMessageFindP-' + instance),
            $gameClue = $('#mapaGameClue-' + instance);

        const htb = $toolbar.is(':visible') ? $toolbar.outerHeight(true) : 0,
            hmf = $messageFind.is(':visible')
                ? $messageFind.outerHeight(true)
                : 0,
            hgc = $gameClue.is(':visible') ? $gameClue.outerHeight(true) : 0,
            mtMulti = parseInt($multimediaContainer.css('marginTop')),
            tMulti = htb + hmf + hgc + mtMulti,
            wMain = $gameContainer.innerWidth(),
            hWindow = $window.outerHeight(true),
            wWindow = $window.outerWidth(true);

        let hMain = $gameContainer.innerHeight(),
            lWindow = ($multimediaContainer.innerWidth() - wWindow) / 2,
            tWindow = -tMulti + 15;

        if (hWindow >= hMain) {
            hMain = hWindow + 15;
            $gameContainer.innerHeight(hMain);
            $mainContainer.innerHeight($gameContainer.outerHeight(true) + 35);
        }

        if (
            mOptions.gameOver ||
            num === undefined ||
            num < 0 ||
            mOptions.evaluation == 1 ||
            wMain < 650
        ) {
            if (num < 1) {
                tWindow = -tMulti + 70;
            }
        } else {
            const $button = $multimediaContainer
                .find(".MQP-PointActive[data-number='" + num + "']")
                .eq(0);
            if ($button.length > 0) {
                lWindow = Math.round(
                    $button.position().left -
                        (wWindow - $button.innerWidth()) / 2
                );
                tWindow = Math.round(
                    $button.position().top -
                        (hWindow - $button.innerHeight()) / 2
                );
            } else {
                const posarea = $eXeMapa.areaCenter(
                    mOptions.activeMap.pts[num].points,
                    instance
                );
                lWindow = Math.round(posarea.xc - wWindow / 2);
                tWindow = Math.round(posarea.yc - hWindow / 2);
            }

            const lMulti = isFullScreen
                ? 0
                : parseInt($multimediaContainer.css('marginLeft'));

            tWindow = Math.max(tWindow, -tMulti);
            if (tMulti + tWindow + hWindow > hMain) {
                const overflowHeight = tMulti + tWindow + hWindow - hMain;
                tWindow -= overflowHeight + 15;
            }

            lWindow = Math.max(lWindow, -lMulti);
            if (lMulti + lWindow + wWindow > wMain) {
                const overflowWidth = lMulti + lWindow + wWindow - wMain;
                lWindow -= overflowWidth + 15;
            }
        }

        $window.css({
            top: tWindow + 'px',
            left: lWindow + 'px',
        });
        $window.fadeIn();
    },

    placePointInWindow1($window, num, instance) {
        const mOptions = $eXeMapa.options[instance],
            $gameContainer = $('#mapaGameContainer-' + instance),
            $mainContainer = $('#mapaMainContainer-' + instance),
            $multimediaContainer = $('#mapaMultimedia-' + instance),
            isFullScreen = $eXeMapa.isFullScreen(),
            $toolbar = $('#mapaToolBar-' + instance),
            $messageFind = $('#mapaMessageFindP-' + instance),
            $gameClue = $('#mapaGameClue-' + instance);

        let htb = $toolbar.is(':visible') ? $toolbar.outerHeight(true) : 0,
            hmf = $messageFind.is(':visible')
                ? $messageFind.outerHeight(true)
                : 0,
            hgc = $gameClue.is(':visible') ? $gameClue.outerHeight(true) : 0,
            mtMulti = parseInt($multimediaContainer.css('marginTop')),
            tMulti = htb + hmf + hgc + mtMulti,
            hMain = $gameContainer.innerHeight(),
            wMain = $gameContainer.innerWidth(),
            hWindow = $window.outerHeight(true),
            wWindow = $window.outerWidth(true),
            lWindow = ($multimediaContainer.innerWidth() - wWindow) / 2,
            tWindow = -tMulti + 15;

        if (hWindow >= hMain) {
            hMain = hWindow + 15;
            $gameContainer.innerHeight(hMain);
            $mainContainer.innerHeight($gameContainer.outerHeight(true) + 35);
        }
        if (
            mOptions.gameOver ||
            typeof num == 'undefined' ||
            num < 0 ||
            mOptions.evaluation == 1 ||
            $gameContainer.innerWidth() < 650
        ) {
            if (num < 1) {
                tWindow = -tMulti + 70;
            }
        } else {
            let $button = $multimediaContainer
                .find(".MQP-PointActive[data-number='" + num + "']")
                .eq(0);
            if ($button.length > 0) {
                lWindow = Math.round(
                    $button.position().left -
                        (wWindow - $button.innerWidth()) / 2
                );
                tWindow = Math.round(
                    $button.position().top -
                        (hWindow - $button.innerHeight()) / 2
                );
            } else {
                const posarea = $eXeMapa.areaCenter(
                    mOptions.activeMap.pts[num].points,
                    instance
                );
                lWindow = Math.round(posarea.xc - wWindow / 2);
                tWindow = Math.round(posarea.yc - hWindow / 2);
            }
            const lMulti = isFullScreen
                ? 0
                : parseInt($multimediaContainer.css('marginLeft'));
            tWindow = tWindow < -tMulti ? -tMulti : tWindow;
            tWindow = tWindow < -tMulti ? -tMulti : tWindow;
            if (tMulti + tWindow + hWindow > hMain) {
                const hsobra = tMulti + tWindow + hWindow - hMain;
                tWindow = tWindow - hsobra - 15;
            }
            lWindow = lWindow < -lMulti ? -lMulti : lWindow;
            if (lMulti + lWindow + wWindow > wMain) {
                const hsobra = lMulti + lWindow + wWindow - wMain;
                lWindow = lWindow - hsobra - 15;
            }
        }
        $window.css({
            top: tWindow + 'px',
            left: lWindow + 'px',
        });
        $window.fadeIn();
    },

    areaCenter: function (area, instance) {
        let minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity,
            rect = $('#mapaCanvas-' + instance)[0].getBoundingClientRect();

        area.forEach((punto) => {
            if (punto.x < minX) minX = punto.x;
            if (punto.x > maxX) maxX = punto.x;
            if (punto.y < minY) minY = punto.y;
            if (punto.y > maxY) maxY = punto.y;
        });

        return {
            x: Math.round(minX * rect.width),
            y: Math.round(minY * rect.height),
            xc: Math.round(((maxX + minX) * rect.width) / 2),
            yc: Math.round(((maxY + minY) * rect.height) / 2),
        };
    },

    closeToolTip: function (instance) {
        const mOptions = $eXeMapa.options[instance],
            q = mOptions.activeMap.pts[mOptions.activeMap.active];

        $('#mapaGameContainer-' + instance).css('height', 'auto');
        $('#mapaTest-' + instance).hide();

        $('#mapaToolTip-' + instance).fadeOut(function () {
            $eXeMapa.hideModalWindows(instance);
            mOptions.showData = false;
            const $divTool = $('#mapaToolTip-' + instance)
                .find('.mapa-LinkToolTipPoints[data-id="' + q.id + '"]')
                .eq(0);
            if ($divTool.length == 1) {
                $divTool.addClass('js-hidden');
                $('#mapaMainContainer-' + instance)
                    .parent('.mapa-IDevice')
                    .append($divTool);
            }

            if (mOptions.evaluationG == 2 || mOptions.evaluationG == 3) {
                $eXeMapa.hideMapDetail(instance, true);
            }

            $eXeMapa.hideCover(instance);
            if (mOptions.evaluationG == 1) {
                $eXeMapa.showMessage(0, '', instance);
                if (
                    mOptions.activeMap.pts.length -
                        mOptions.hits -
                        mOptions.errors <=
                    0
                ) {
                    $eXeMapa.gameOver(instance);
                }
            } else if (mOptions.evaluationG == 2) {
                mOptions.activeTitle++;
                if (mOptions.activeTitle >= mOptions.numberQuestions) {
                    $eXeMapa.gameOver(instance);
                } else {
                    $eXeMapa.showFind(instance, mOptions.activeTitle);
                }
            } else if (mOptions.evaluationG == 3) {
                mOptions.activeTitle++;
                if (mOptions.hits >= mOptions.numberQuestions) {
                    $eXeMapa.gameOver(instance);
                } else {
                    $eXeMapa.showFind(instance, mOptions.activeTitle);
                }
            }
            $eXeMapa.showClue(instance);
            $eXeMapa.messageAllVisited(instance);
        });
    },

    startGame: function (instance) {
        const mOptions = $eXeMapa.options[instance];
        if (mOptions.evaluationG == 5) {
            $('#mapaCheckOrder-' + instance).show();
        }

        if (mOptions.evaluationG != 5) {
            $('#mapaMessageFindP-' + instance).show();
        }

        $('#mapaStartGame-' + instance).hide();

        if (mOptions.evaluationG == 2 || mOptions.evaluationG == 3) {
            $eXeMapa.showFind(instance, 0);
        }

        mOptions.gameStarted = true;
    },

    showMapDetail: function (instance, num) {
        const mOptions = $eXeMapa.options[instance];
        mOptions.levels[mOptions.levels.length - 1] = $.extend(
            true,
            {},
            mOptions.activeMap
        );

        const nlevel = $.extend(true, {}, mOptions.activeMap.pts[num].map);
        mOptions.activeMap = $.extend(true, {}, nlevel);

        mOptions.levels.push(nlevel);
        mOptions.showData = false;
        mOptions.showDetail = true;
        mOptions.numLevel++;

        $eXeMapa.addPoints(instance, mOptions.activeMap.pts);
        $eXeMapa.showImage(
            mOptions.activeMap.url,
            mOptions.activeMap.alt,
            instance
        );
        $eXeMapa.showButtonAreas(mOptions.activeMap.pts, instance);

        $('#mapaLinkCloseDetail-' + instance).show();
        if (mOptions.levels.length > 2) {
            $('#mapaLinkCloseHome-' + instance).show();
        }
    },

    showButtonAreas: function (pts, instance) {
        const mOptions = $eXeMapa.options[instance];
        $('#mapaLinkAreas-' + instance).hide();
        for (let i = 0; i < pts.length; i++) {
            if (pts[i].iconType == 1 && !mOptions.hideAreas) {
                $('#mapaLinkAreas-' + instance).show();
            }
        }
    },

    endFind: function (instance) {
        let mOptions = $eXeMapa.options[instance];
        $('#mapaMessageFindP-' + instance).text('');
        $('#mapaMessageDetail-' + instance).hide();
        $('#mapaMessageDetailsSound-' + instance).hide();
        $('#mapaMultimedia-' + instance)
            .find('.MQP-Point')
            .each(function () {
                $(this).attr('title', $(this).text());
            });

        mOptions.gameOver = false;
        mOptions.gameStarted = true;
        if (mOptions.evaluationG == 1) {
            mOptions.evaluationG = -2;
        } else if (mOptions.evaluationG == 4) {
            mOptions.evaluationG = -4;
        } else {
            mOptions.evaluationG = -1;
        }
        $exeDevices.iDevice.gamification.media.stopSound(mOptions);
    },
    closePoint: function (instance) {
        const mOptions = $eXeMapa.options[instance],
            p = mOptions.activeMap.pts[mOptions.activeMap.active];

        $eXeMapa.hideModalWindows(instance);
        $eXeMapa.stopVideo(instance);
        $eXeMapa.stopVideoText(instance);
        $exeDevices.iDevice.gamification.media.stopSound(mOptions);

        $('#mapaFDetailsSound-' + instance).hide();
        $('#mapaFDetails-' + instance).hide();
        $('#mapaFMessages-' + instance).hide();
        $('#mapaTest-' + instance).hide();
        $('#mapaGameContainer-' + instance).css('height', 'auto');
        $('#mapaText-' + instance).css('height', 'auto');

        if (mOptions.evaluationG == 2 || mOptions.evaluationG == 3) {
            $eXeMapa.hideMapDetail(instance, true);
        }

        $eXeMapa.hideCover(instance);
        if (mOptions.evaluationG == 1) {
            $eXeMapa.showMessage(0, '', instance);
            if (
                mOptions.activeMap.pts.length -
                    mOptions.hits -
                    mOptions.errors <=
                0
            ) {
                $eXeMapa.gameOver(instance);
            }
        } else if (mOptions.evaluationG == 2) {
            mOptions.activeTitle++;
            if (mOptions.activeTitle >= mOptions.numberQuestions) {
                $eXeMapa.gameOver(instance);
            } else {
                $eXeMapa.showFind(instance, mOptions.activeTitle);
            }
        } else if (mOptions.evaluationG == 3) {
            mOptions.activeTitle++;
            if (mOptions.hits >= mOptions.numberQuestions) {
                $eXeMapa.gameOver(instance);
            } else {
                $eXeMapa.showFind(instance, mOptions.activeTitle);
            }
        } else if (mOptions.evaluationG == 6) {
            if (mOptions.numLevel == 0) {
                if (
                    (p.type !== 9 || p.score >= 5) &&
                    mOptions.activeMap.active == mOptions.activeGame
                ) {
                    mOptions.activeGame++;
                    if (mOptions.activeGame < mOptions.activeMap.pts.length) {
                        $eXeMapa.addPoints(instance, mOptions.activeMap.pts);
                        $eXeMapa.refreshGame(instance);
                    } else {
                        mOptions.gameOver = true;
                        $eXeMapa.gameOver(instance);
                    }
                }
            }
        }

        $eXeMapa.showClue(instance);
        $eXeMapa.messageAllVisited(instance);
        mOptions.showData = false;
    },

    changeQuextion: function (instance, button) {
        const mOptions = $eXeMapa.options[instance];

        if (!mOptions.gameActived) return;

        let numberButton = parseInt($(button).data('number')),
            letters = 'ABCD',
            letter = letters[numberButton],
            type = false;

        if (mOptions.respuesta.indexOf(letter) === -1) {
            mOptions.respuesta = mOptions.respuesta + letter;
            type = true;
        } else {
            mOptions.respuesta = mOptions.respuesta.replace(letter, '');
        }
        let bordeColors = [
                $eXeMapa.borderColors.red,
                $eXeMapa.borderColors.blue,
                $eXeMapa.borderColors.green,
                $eXeMapa.borderColors.yellow,
            ],
            css = {
                'border-size': 1,
                'border-color': bordeColors[numberButton],
                'background-color': 'transparent',
                cursor: 'default',
                color: $eXeMapa.colors.black,
            };
        if (type) {
            css = {
                'border-size': 1,
                'border-color': bordeColors[numberButton],
                'background-color': bordeColors[numberButton],
                cursor: 'pointer',
                color: '#ffffff',
            };
        }

        $(button).css(css);
        $('#mapaAnswers-' + instance).empty();

        for (let i = 0; i < mOptions.respuesta.length; i++) {
            if (mOptions.respuesta[i] === 'A') {
                $('#mapaAnswers-' + instance).append(
                    '<div class="MQP-AnswersOptions MQP-Answer1"></div>'
                );
            } else if (mOptions.respuesta[i] === 'B') {
                $('#mapaAnswers-' + instance).append(
                    '<div class="MQP-AnswersOptions MQP-Answer2"></div>'
                );
            } else if (mOptions.respuesta[i] === 'C') {
                $('#mapaAnswers-' + instance).append(
                    '<div class="MQP-AnswersOptions MQP-Answer3"></div>'
                );
            } else if (mOptions.respuesta[i] === 'D') {
                $('#mapaAnswers-' + instance).append(
                    '<div class="MQP-AnswersOptions MQP-Answer4"></div>'
                );
            }
        }
    },

    changeTPQuextion: function (instance, button) {
        const mOptions = $eXeMapa.options[instance],
            p = mOptions.activeMap.pts[mOptions.activeMap.active];

        if (!mOptions.gameActived) return;

        let numberButton = parseInt($(button).data('number')),
            letters = 'ABCD',
            letter = letters[numberButton],
            type = false;

        if (p.respuesta.indexOf(letter) === -1) {
            p.respuesta = p.respuesta + letter;
            type = true;
        } else {
            p.respuesta = p.respuesta.replace(letter, '');
        }

        let bordeColors = [
                $eXeMapa.borderColors.red,
                $eXeMapa.borderColors.blue,
                $eXeMapa.borderColors.green,
                $eXeMapa.borderColors.yellow,
            ],
            css = {
                'border-size': 1,
                'border-color': bordeColors[numberButton],
                'background-color': 'transparent',
                cursor: 'default',
                color: $eXeMapa.colors.black,
            };

        if (type) {
            css = {
                'border-size': 1,
                'border-color': bordeColors[numberButton],
                'background-color': bordeColors[numberButton],
                cursor: 'pointer',
                color: '#ffffff',
            };
        }

        $(button).css(css);
        $('#mapaAnswers1-' + instance).empty();
        for (let i = 0; i < p.respuesta.length; i++) {
            if (p.respuesta[i] === 'A') {
                $('#mapaAnswers1-' + instance).append(
                    '<div class="MQP-AnswersOptions MQP-Answer1"></div>'
                );
            } else if (p.respuesta[i] === 'B') {
                $('#mapaAnswers1-' + instance).append(
                    '<div class="MQP-AnswersOptions MQP-Answer2"></div>'
                );
            } else if (p.respuesta[i] === 'C') {
                $('#mapaAnswers1-' + instance).append(
                    '<div class="MQP-AnswersOptions MQP-Answer3"></div>'
                );
            } else if (p.respuesta[i] === 'D') {
                $('#mapaAnswers1-' + instance).append(
                    '<div class="MQP-AnswersOptions MQP-Answer4"></div>'
                );
            }
        }
    },

    showQuestionaire: function (instance) {
        const mOptions = $eXeMapa.options[instance];
        if (
            $eXeMapa.getNumberVisited(mOptions.visiteds) <
            Math.floor(mOptions.numberPoints * (mOptions.percentajeShowQ / 100))
        ) {
            let msg = mOptions.msgs.msgReviewContents.replace(
                '%s',
                mOptions.percentajeShowQ
            );
            $eXeMapa.showMessageModal(instance, msg, 0, 0, -1);
            return;
        }

        mOptions.questionaireStarted = true;
        $eXeMapa.stopVideo(instance);
        $eXeMapa.showQuestion(mOptions.activeQuestion, instance);

        $('#mapaFDetailsSound-' + instance).hide();
        $('#mapaFDetails-' + instance).hide();
        $('#mapaFMessages-' + instance).hide();
        $('#mapaFTests-' + instance).show();
        $('#mapaCubierta-' + instance).show();
        $('#mapaPNumber-' + instance).text(mOptions.numberQuestions);
    },

    showMessageModal: function (instance, message, type, color1, num) {
        const mOptions = $eXeMapa.options[instance],
            colors = [
                $eXeMapa.borderColors.black,
                $eXeMapa.borderColors.red,
                $eXeMapa.borderColors.green,
                $eXeMapa.borderColors.blue,
                $eXeMapa.borderColors.yellow,
            ],
            color = colors[color1];

        mOptions.showData = true;
        $('#mapaFDetails-' + instance).hide();
        $('#mapaFDetailsSound-' + instance).hide();
        $('#mapaFTests-' + instance).hide();
        $('#mapaFMessages-' + instance).show();
        $('#mapaFMessageInfo-' + instance).show();
        $('#mapaFMessageAccess-' + instance).hide();
        $('#mapaFMessageOver-' + instance).hide();
        $('#mapaMessageInfoText-' + instance).text(message);
        $('#mapaFMessageInfo-' + instance).css({
            color: color,
            'font-size': '1em',
        });
        $('#mapaFMessageInfo-' + instance)
            .find('.MQP-GOScoreButtons')
            .hide();
        $('#mapaFMessageInfoAccept-' + instance).hide();
        if (type != 2) {
            $('#mapaFMessageInfo-' + instance)
                .find('.MQP-GOScoreButtons')
                .show();
            $('#mapaFMessageInfoAccept-' + instance).show();
        }

        $eXeMapa.placePointInWindow(
            $('#mapaFMessages-' + instance),
            num,
            instance
        );
    },

    answerQuestion: function (instance) {
        const mOptions = $eXeMapa.options[instance],
            quextion = mOptions.selectsGame[mOptions.activeQuestion];

        $exeDevices.iDevice.gamification.media.stopSound(mOptions);
        if (!mOptions.gameActived) return;

        mOptions.gameActived = false;
        let solution = quextion.solution,
            answer = mOptions.respuesta.toUpperCase(),
            correct = true;
        if (quextion.typeSelect === 2) {
            solution = quextion.solutionQuestion.toUpperCase();
            answer = $.trim($('#mapaEdAnswer-' + instance).val()).toUpperCase();
            correct = solution == answer;
            if (answer.length == 0) {
                $eXeMapa.showMessage(
                    1,
                    mOptions.msgs.msgIndicateWord,
                    instance
                );
                mOptions.gameActived = true;
                return;
            }
        } else if (quextion.typeSelect === 1) {
            if (answer.length !== solution.length) {
                $eXeMapa.showMessage(1, mOptions.msgs.msgOrders, instance);
                mOptions.gameActived = true;
                return;
            }
            if (solution !== answer) {
                correct = false;
            }
        } else {
            if (answer.length !== solution.length) {
                correct = false;
            } else {
                for (let i = 0; i < answer.length; i++) {
                    let letter = answer[i];
                    if (solution.indexOf(letter) === -1) {
                        correct = false;
                        break;
                    }
                }
            }
        }

        let message = $eXeMapa.updateScore(correct, instance),
            timeShowSolution = 3000,
            type = correct ? 2 : 1;
        if (mOptions.showSolution) {
            timeShowSolution = mOptions.timeShowSolution * 1000;
            if (quextion.typeSelect != 2) {
                $eXeMapa.drawSolution(instance);
            } else {
                let mtipe = correct ? 2 : 1;
                $eXeMapa.drawPhrase(
                    quextion.solutionQuestion,
                    quextion.quextion,
                    100,
                    mtipe,
                    false,
                    instance,
                    true
                );
            }
        }

        $eXeMapa.showClue(instance);
        $eXeMapa.showMessage(type, message, instance);
        if (mOptions.evaluationG == 4 && mOptions.isScorm === 1) {
            let score = (
                (mOptions.hits * 10) /
                mOptions.numberQuestions
            ).toFixed(2);
            $eXeMapa.sendScore(true, instance);
            $('#mapaRepeatActivity-' + instance).text(
                mOptions.msgs.msgYouScore + ': ' + score
            );
        }

        $eXeMapa.saveEvaluation(instance);

        setTimeout(function () {
            $eXeMapa.newQuestion(instance, correct, false);
        }, timeShowSolution);
    },

    answerTPQuestion: function (instance) {
        const mOptions = $eXeMapa.options[instance],
            p = mOptions.activeMap.pts[mOptions.activeMap.active],
            q = p.tests[p.activeTest];

        $exeDevices.iDevice.gamification.media.stopSound(mOptions);

        if (!mOptions.gameActived) return;

        mOptions.gameActived = false;

        let solution = q.solution,
            answer = p.respuesta.toUpperCase(),
            correct = true;
        if (q.typeSelect === 2) {
            solution = q.solutionQuestion.toUpperCase();
            answer = $.trim(
                $('#mapaEdAnswer1-' + instance).val()
            ).toUpperCase();
            correct = solution == answer;
            if (answer.length == 0) {
                $eXeMapa.showTPMessage(
                    1,
                    mOptions.msgs.msgIndicateWord,
                    instance
                );
                mOptions.gameActived = true;
                return;
            }
        } else if (q.typeSelect === 1) {
            if (answer.length !== solution.length) {
                $eXeMapa.showTPMessage(1, mOptions.msgs.msgOrders, instance);
                mOptions.gameActived = true;
                return;
            }
            if (solution !== answer) {
                correct = false;
            }
        } else {
            if (answer.length !== solution.length) {
                correct = false;
            } else {
                for (let i = 0; i < answer.length; i++) {
                    let letter = answer[i];
                    if (solution.indexOf(letter) === -1) {
                        correct = false;
                        break;
                    }
                }
            }
        }

        let message = $eXeMapa.updateTPScore(correct, instance),
            timeShowSolution = 4000,
            type = correct ? 2 : 1;
        if (q.typeSelect != 2) {
            $eXeMapa.drawTPSolution(instance);
        } else {
            let mtipe = correct ? 2 : 1;
            $eXeMapa.drawTPPhrase(
                q.solutionQuestion,
                q.quextion,
                100,
                mtipe,
                false,
                instance,
                true
            );
        }

        $eXeMapa.showTPMessage(type, message, instance);
        setTimeout(function () {
            $eXeMapa.newTPQuestion(instance, correct, false);
        }, timeShowSolution);
    },

    showClue: function (instance) {
        const mOptions = $eXeMapa.options[instance];
        let percentageHits = 0;

        if (mOptions.evaluationG < 0 || mOptions.gameOver) return;

        if (mOptions.evaluationG == 0) {
            percentageHits = $eXeMapa.getScoreVisited(instance) * 10;
        } else if (
            mOptions.evaluationG == 1 ||
            mOptions.evaluationG == 2 ||
            mOptions.evaluationG == 3
        ) {
            percentageHits = (mOptions.hits / mOptions.numberQuestions) * 100;
        } else if (mOptions.evaluationG == 4) {
            percentageHits = (mOptions.hits / mOptions.numberQuestions) * 100;
        }

        if (mOptions.itinerary.showClue) {
            if (percentageHits >= mOptions.itinerary.percentageClue) {
                if (!mOptions.obtainedClue) {
                    const msg =
                        mOptions.msgs.msgInformation +
                        ': ' +
                        mOptions.itinerary.clueGame;
                    if (mOptions.evaluationG == 4) {
                        $('#mapaPShowClue-' + instance).text(msg);
                        $('#mapaShowClue-' + instance).show();
                    }
                    mOptions.obtainedClue = true;
                    $('#mapaPGameClue-' + instance).text(msg);
                    $('#mapaGameClue-' + instance).show();
                    $eXeMapa.refreshGame(instance);
                }
            }
        }
    },

    sameQuestion: function (correct, instance) {
        const mOptions = $eXeMapa.options[instance],
            q = mOptions.selectsGame[mOptions.activeQuestion];
        return (
            (correct && q.hits == mOptions.activeQuestion) ||
            (!correct && q.error == mOptions.activeQuestion)
        );
    },

    updateScore: function (correctAnswer, instance) {
        const mOptions = $eXeMapa.options[instance];
        let message = '',
            obtainedPoints = 0,
            sscore = 0;

        if (correctAnswer) {
            mOptions.hits++;
            obtainedPoints = 10 / mOptions.numberQuestions;
        } else {
            mOptions.errors++;
        }

        mOptions.score =
            mOptions.score + obtainedPoints > 0
                ? mOptions.score + obtainedPoints
                : 0;
        sscore = mOptions.score;
        sscore =
            mOptions.score % 1 == 0
                ? mOptions.score
                : mOptions.score.toFixed(2);
        $('#mapaPScore-' + instance).text(sscore);
        $('#mapaPHits-' + instance).text(mOptions.hits);
        $('#mapaPErrors-' + instance).text(mOptions.errors);
        message = $eXeMapa.getMessageAnswer(
            correctAnswer,
            obtainedPoints.toFixed(2),
            instance
        );
        return message;
    },

    updateTPScore: function (correctAnswer, instance) {
        const mOptions = $eXeMapa.options[instance],
            p = mOptions.activeMap.pts[mOptions.activeMap.active];

        let message = '',
            obtainedPoints = 0,
            sscore = 0;
        if (correctAnswer) {
            p.hits++;
            obtainedPoints = 10 / p.numbertests;
        } else {
            p.errors++;
        }

        p.score = p.score + obtainedPoints > 0 ? p.score + obtainedPoints : 0;
        sscore = p.score;
        sscore = p.score % 1 == 0 ? p.score : p.score.toFixed(2);

        $('#mapaPScore1-' + instance).text(sscore);
        $('#mapaPHits1-' + instance).text(p.hits);
        $('#mapaPErrors1-' + instance).text(p.errors);
        $('#mapaPNumber1-' + instance).text(p.numbertests - p.hits - p.errors);
        message = $eXeMapa.getMessageAnswer(
            correctAnswer,
            obtainedPoints.toFixed(2),
            instance
        );
        return message;
    },

    getRetroFeedMessages: function (iHit, instance) {
        const msgs = $eXeMapa.options[instance].msgs;
        let sMessages = iHit ? msgs.msgSuccesses : msgs.msgFailures;
        sMessages = sMessages.split('|');
        return sMessages[Math.floor(Math.random() * sMessages.length)];
    },

    newQuestion: function (instance) {
        const mOptions = $eXeMapa.options[instance];
        mOptions.activeQuestion++;

        if (mOptions.activeQuestion >= mOptions.numberQuestions) {
            $eXeMapa.gameOver(instance);
            return;
        } else {
            $eXeMapa.showQuestion(mOptions.activeQuestion, instance);
            let numQ = mOptions.numberQuestions - mOptions.activeQuestion;
            $('#mapaPNumber-' + instance).text(numQ);
        }
    },

    newTPQuestion: function (instance) {
        const mOptions = $eXeMapa.options[instance],
            p = mOptions.activeMap.pts[mOptions.activeMap.active];

        p.activeTest++;

        if (p.activeTest >= p.numbertests) {
            $eXeMapa.gameTPOver(instance);
            return;
        } else {
            $eXeMapa.showTPQuestion(instance);
            let numQ = p.numbertests - p.activeTest;
            $('#mapaPNumber1-' + instance).text(numQ);
        }
    },

    gameOver: function (instance) {
        const mOptions = $eXeMapa.options[instance];
        let puntuacion = 0,
            msg = mOptions.msgs.msgScore10,
            numq = mOptions.numberQuestions;

        mOptions.gameStarted = false;
        mOptions.questionaireStarted = false;
        mOptions.gameActived = false;
        mOptions.gameOver = true;

        if (mOptions.evaluationG == 5) {
            numq = mOptions.order.length || 1;
            mOptions.orderResponse = [];
        }

        puntuacion = ((mOptions.hits * 10) / numq).toFixed(2);

        if (puntuacion < 5) {
            msg = mOptions.msgs.msgScore4;
        } else if (puntuacion < 7) {
            msg = mOptions.msgs.msgScore6;
        } else if (puntuacion < 10) {
            msg = mOptions.msgs.msgScore8;
        }

        $('#mapaFDetails-' + instance).hide();
        $('#mapaFDetailsSound-' + instance).hide();
        $('#mapaFTests-' + instance).hide();
        $('#mapaFMessages-' + instance).fadeIn();
        $('#mapaFMessageInfo-' + instance).hide();
        $('#mapaFMessageAccess-' + instance).hide();
        $('#mapaFMessageOver-' + instance).show();
        $('#mapaGOMessage-' + instance).text(msg);
        $('#mapaGONumber-' + instance).text(
            mOptions.msgs.msgQuestions + ': ' + numq
        );
        $('#mapaGoScore-' + instance).text(
            mOptions.msgs.msgScore + ': ' + puntuacion
        );
        if (mOptions.evaluationG == 5) {
            $('#mapaGONumber-' + instance).text(
                mOptions.msgs.msgPointsA + ': ' + numq
            );
        }
        $('#mapaGOHits-' + instance).text(
            mOptions.msgs.msgHits + ': ' + mOptions.hits
        );
        $('#mapaGOErrors-' + instance).text(
            mOptions.msgs.msgErrors + ': ' + mOptions.errors
        );
        if (mOptions.evaluationG == 3) {
            $('#mapaErrorScore-' + instance).hide();
        }

        mOptions.gameOver = true;
        if (
            (mOptions.evaluationG == 5 ||
                mOptions.evaluationG == 1 ||
                mOptions.evaluationG == 2 ||
                mOptions.evaluationG == 3 ||
                mOptions.evaluationG == 4) &&
            mOptions.isScorm === 1
        ) {
            let score = ((mOptions.hits * 10) / numq).toFixed(2);
            $eXeMapa.sendScore(true, instance);
            $eXeMapa.initialScore = score;
        }

        $eXeMapa.saveEvaluation(instance);
        $eXeMapa.hideCover(instance);

        $('#mapaFMessageOver-' + instance).show();
        setTimeout(function () {
            $eXeMapa.placePointInWindow(
                $('#mapaFMessages-' + instance),
                -1,
                instance
            );
        }, 500);
    },

    gameTPOver: function (instance) {
        const mOptions = $eXeMapa.options[instance],
            p = mOptions.activeMap.pts[mOptions.activeMap.active],
            color = p.score >= 5 ? 2 : 1,
            lm = mOptions.msgs.msgSuccessfulActivity.replace(
                '%s',
                p.score.toFixed(2)
            ),
            rm = mOptions.msgs.msgUnsuccessfulActivity.replace(
                '%s',
                p.score.toFixed(2)
            ),
            message = p.score >= 5 ? lm : rm;
        $('#mapaBottonContainer1-' + instance).css({
            'justify-content': 'space-between',
        });
        $('#mapaTestReloadDiv1-' + instance).css({ display: 'flex' });
        $eXeMapa.showTPMessage(color, message, instance);
    },

    getMessageAnswer: function (correctAnswer, npts, instance) {
        let message = '';
        if (correctAnswer) {
            message = $eXeMapa.getMessageCorrectAnswer(npts, instance);
        } else {
            message = $eXeMapa.getMessageErrorAnswer(instance);
        }
        return message;
    },

    getMessageCorrectAnswer: function (npts, instance) {
        const mOptions = $eXeMapa.options[instance],
            messageCorrect = $eXeMapa.getRetroFeedMessages(true, instance);
        let message = '';
        if (mOptions.selectsGame[mOptions.activeQuestion].msgHit.length > 0) {
            message = mOptions.selectsGame[mOptions.activeQuestion].msgHit;
        } else {
            message = messageCorrect;
        }
        message = message + ' ' + npts + ' ' + mOptions.msgs.msgPoints;
        return message;
    },

    getMessageErrorAnswer: function (instance) {
        const mOptions = $eXeMapa.options[instance],
            messageError = $eXeMapa.getRetroFeedMessages(false, instance);
        let message = '';
        if (mOptions.selectsGame[mOptions.activeQuestion].msgError.length > 0) {
            message = mOptions.selectsGame[mOptions.activeQuestion].msgError;
        } else {
            message = messageError;
        }
        return message;
    },

    closeOptions: function (instance) {
        const mOptions = $eXeMapa.options[instance],
            p = mOptions.activeMap.pts[mOptions.activeMap.active];

        if (p.state != 0) return;

        $('#mapaTest-' + instance).fadeOut(100, function () {
            p.state = -1;
            mOptions.showData = false;
        });
        $exeDevices.iDevice.gamification.media.stopSound(mOptions);
    },
    randomSubset: function (num, k, sol) {
        let copy = [],
            result = [];
        for (let i = 0; i < num; i++) {
            copy.push(i);
        }
        copy.splice(sol, 1);
        k = k - 1;
        k = k > copy.length ? copy.length : k;
        while (result.length < k) {
            let index = Math.floor(Math.random() * copy.length);
            result.push(copy[index]);
            copy.splice(index, 1);
        }
        result.push(sol);
        return result;
    },

    showOptionsRect: function (instance, num) {
        const mOptions = $eXeMapa.options[instance],
            p = mOptions.activeMap.pts[num],
            wI = $('#mapaImageRect-' + instance).width(),
            hI = $('#mapaImageRect-' + instance).height(),
            wC = $('#mapaContainerRect-' + instance).width(),
            hC = $('#mapaContainerRect-' + instance).height(),
            lp = Math.round(p.x * wI - wC / 2),
            tp = Math.round(p.y * hI - hC / 2),
            msg =
                typeof p.question != 'undefined' && p.question.length > 0
                    ? p.question
                    : '';

        if (p.state != -1) {
            mOptions.showData = false;
            return;
        }

        if (
            typeof mOptions.optionsNumber != 'undefined' &&
            mOptions.optionsNumber > 1
        ) {
            let mostrar = $eXeMapa.randomSubset(
                mOptions.activeMap.pts.length,
                mOptions.optionsNumber,
                num
            );
            $('#mapaOptionsTest-' + instance)
                .find('.MPQ-OptionTest')
                .hide();
            for (let i = 0; i < mostrar.length; i++) {
                $('#mapaOptionsTest-' + instance)
                    .find('.MPQ-OptionTest')
                    .filter('[data-number="' + mostrar[i] + '"]')
                    .show();
            }
        }

        mOptions.activeMap.active = num;
        $('#mapaMessageRectP-' + instance).text(msg);
        $('#mapaMessageRect-' + instance).show();
        $('#mapaImageRect-' + instance).css({
            left: -lp + 'px',
            top: -tp + 'px',
        });

        $exeDevices.iDevice.gamification.media.stopSound(mOptions);

        $('#mapaPlayAudioRect-' + instance).hide();
        if (
            typeof p.question_audio != 'undefined' &&
            p.question_audio.length > 4
        ) {
            $exeDevices.iDevice.gamification.media.playSound(
                p.question_audio,
                mOptions
            );
            $('#mapaPlayAudioRect-' + instance).show();
        }

        $('#mapaTest-' + instance).fadeIn(100);
        mOptions.tilteRect = p.title;
        mOptions.activeMap.active = num;

        p.state = 0;

        let htb = $('#mapaToolBar-' + instance).height(),
            hg = $('#mapaGameContainer-' + instance).height() - htb;

        $('#mapaTest-' + instance).height(hg);
        $('#mapaTest-' + instance).css({
            top: htb + 'px',
        });
        mOptions.showData = false;
    },

    answerRect: function (instance, answer) {
        const mOptions = $eXeMapa.options[instance];
        let solution = mOptions.tilteRect,
            correct = solution == answer,
            message = $eXeMapa.updateScoreFind(correct, instance);

        $('#mapaFMessages-' + instance).hide();
        $('#mapaFDetails-' + instance).hide();
        $('#mapaFDetailsSound-' + instance).hide();
        if (mOptions.activeMap.pts[mOptions.activeMap.active].type == 5) {
            mOptions.activeMap.pts[mOptions.activeMap.active].type = 0;
            mOptions.activeMap.pts[mOptions.activeMap.active].url =
                mOptions.activeMap.pts[mOptions.activeMap.active].map.url;
        }
        if (correct) {
            mOptions.activeMap.pts[mOptions.activeMap.active].state = 2;
            if (
                mOptions.activeMap.pts[mOptions.activeMap.active].type < 4 ||
                mOptions.activeMap.pts[mOptions.activeMap.active].type == 6 ||
                mOptions.activeMap.pts[mOptions.activeMap.active].type == 7
            ) {
                $eXeMapa.hideCover(instance);
                $eXeMapa.showMessageDetail(instance, message, 2);
                $eXeMapa.showPoint(mOptions.activeMap.active, instance);
            } else {
                let num = mOptions.activeMap.active;
                if (mOptions.activeMap.pts[num].type == 8) {
                    $eXeMapa.showPointLink(num, instance);
                } else {
                    $eXeMapa.showMessageModal(
                        instance,
                        message +
                            ': ' +
                            mOptions.activeMap.pts[mOptions.activeMap.active]
                                .title,
                        2,
                        2,
                        -1
                    );
                }
                setTimeout(function () {
                    if (
                        mOptions.activeMap.pts.length -
                            mOptions.hits -
                            mOptions.errors <=
                        0
                    ) {
                        $eXeMapa.gameOver(instance);
                    } else {
                        $('#mapaTest-' + instance).hide();
                    }
                    $eXeMapa.hideCover(instance);
                    mOptions.showData = false;
                }, mOptions.timeShowSolution * 1000);
            }
        } else {
            mOptions.activeMap.pts[mOptions.activeMap.active].state = 1;
            message = mOptions.msgs.msgNotCorrect1 + ' "' + solution + '"';
            $eXeMapa.showMessageModal(instance, message, 2, 0, -1);
            setTimeout(function () {
                $eXeMapa.hideCover(instance);
                if (
                    mOptions.numberQuestions -
                        mOptions.hits -
                        mOptions.errors <=
                    0
                ) {
                    $eXeMapa.gameOver(instance);
                } else {
                    $('#mapaTest-' + instance).hide();
                }
                $exeDevices.iDevice.gamification.media.stopSound(mOptions);
                mOptions.showData = false;
            }, mOptions.timeShowSolution * 1000);
        }
        $eXeMapa.showClue(instance);
        $eXeMapa.paintPoints(instance);

        const $activ = $('#mapaMultimedia-' + instance)
            .find('.MQP-Point[data-number="' + mOptions.activeMap.active + '"]')
            .eq(0);

        $activ.attr('title', solution);
        if (
            mOptions.isScorm == 1 &&
            mOptions.evaluationG != 4 &&
            mOptions.evaluationG > -1
        ) {
            $eXeMapa.sendScore(true, instance);
        }
        $eXeMapa.saveEvaluation(instance);
    },

    answerFind: function (num, id, instance) {
        const mOptions = $eXeMapa.options[instance],
            solution = mOptions.title.id,
            answer = id,
            question = mOptions.activeMap.pts[num].question,
            answert = mOptions.activeMap.pts[num].title,
            correct = solution == answer;

        let message = $eXeMapa.updateScoreFind(correct, instance);

        $eXeMapa.showClue(instance);
        $('#mapaFMessages-' + instance).hide();
        $('#mapaFDetails-' + instance).hide();
        $('#mapaFDetailsSound-' + instance).hide();
        $('#mapaLinkCloseDetail-' + instance).hide();
        $('#mapaLinkCloseHome-' + instance).hide();

        if (correct) {
            if (
                mOptions.activeMap.pts[num].type < 4 ||
                mOptions.activeMap.pts[num].type == 6
            ) {
                $eXeMapa.showMessageDetail(instance, message, 2);
                $eXeMapa.showPoint(num, instance);
            } else if (mOptions.activeMap.pts[num].type == 7) {
                $eXeMapa.showToolTip(num, instance);
            } else {
                if (mOptions.activeMap.pts[num].type == 8) {
                    $eXeMapa.showPointLink(num, instance);
                    setTimeout(function () {
                        if (
                            mOptions.evaluationG == 2 ||
                            mOptions.evaluationG == 3
                        ) {
                            mOptions.activeTitle++;
                        }
                        $eXeMapa.hideMapDetail(instance, true);
                        if (
                            mOptions.activeTitle >= mOptions.numberQuestions ||
                            (mOptions.evaluationG == 3 &&
                                mOptions.hits >= mOptions.numberQuestions)
                        ) {
                            $eXeMapa.gameOver(instance);
                        } else {
                            $eXeMapa.showFind(instance, mOptions.activeTitle);
                        }
                        $eXeMapa.hideCover(instance);
                        $eXeMapa.hideMapDetail(instance, true);
                        mOptions.showData = false;
                    }, mOptions.timeShowSolution * 1000);
                } else {
                    $eXeMapa.showMessageModal(
                        instance,
                        message + ': ' + mOptions.title.title,
                        1,
                        2,
                        num
                    );
                }
            }
        } else {
            message = mOptions.msgs.msgNotCorrect + ' "' + answert + '"';
            if (mOptions.evaluationG == 2 && question.length > 0) {
                message =
                    mOptions.msgs.msgNotCorrect +
                    ' "' +
                    answert +
                    '" ' +
                    mOptions.msgs.msgNotCorrect2 +
                    ' "' +
                    mOptions.title.title +
                    '"';
            }
            if (mOptions.evaluationG == 3) {
                message += ' ' + mOptions.msgs.msgNotCorrect3;
            }
            $eXeMapa.showMessageModal(instance, message, 2, 0, num);
            setTimeout(function () {
                if (mOptions.evaluationG == 2) {
                    mOptions.activeTitle++;
                }
                $eXeMapa.hideMapDetail(instance, true);
                if (mOptions.activeTitle >= mOptions.numberQuestions) {
                    $eXeMapa.gameOver(instance);
                } else {
                    if (mOptions.evaluationG == 2) {
                        $eXeMapa.showFind(instance, mOptions.activeTitle);
                    }
                }
                $eXeMapa.hideCover(instance);
                mOptions.showData = false;
            }, mOptions.timeShowSolution * 1000);
        }

        if (
            mOptions.isScorm == 1 &&
            mOptions.evaluationG != 4 &&
            mOptions.evaluationG > -1
        ) {
            let score =
                mOptions.evaluationG === 0
                    ? $eXeMapa.getScoreVisited(instance)
                    : $eXeMapa.getScoreFind(instance);
            $eXeMapa.sendScore(true, instance);
            $('#mapaRepeatActivity-' + instance).text(
                mOptions.msgs.msgYouScore + ': ' + score
            );
        }

        $eXeMapa.saveEvaluation(instance);
    },

    updateScoreFind: function (correctAnswer, instance) {
        const mOptions = $eXeMapa.options[instance];
        let message = '',
            obtainedPoints = 0,
            sscore = 0;

        if (correctAnswer) {
            mOptions.hits++;
            obtainedPoints = 10 / mOptions.numberQuestions;
        } else {
            mOptions.errors++;
        }

        mOptions.score =
            mOptions.score + obtainedPoints > 0
                ? mOptions.score + obtainedPoints
                : 0;

        sscore = mOptions.score;
        sscore =
            mOptions.score % 1 == 0
                ? mOptions.score
                : mOptions.score.toFixed(2);

        $('#mapaPScoreF-' + instance).text(sscore);
        $('#mapaPHitsF-' + instance).text(mOptions.hits);
        $('#mapaPErrorsF-' + instance).text(mOptions.errors);

        const nump =
            mOptions.evaluationG == 1 || mOptions.evaluationG == 2
                ? mOptions.numberQuestions - mOptions.hits - mOptions.errors
                : mOptions.numberQuestions - mOptions.hits;

        $('#mapaPNumberF-' + instance).text(nump);
        message = $eXeMapa.getMessageAnswer(
            correctAnswer,
            obtainedPoints.toFixed(2),
            instance
        );
        return message;
    },

    showMessageDetail: function (instance, message, type) {
        const colors = [
                $eXeMapa.borderColors.black,
                $eXeMapa.borderColors.red,
                $eXeMapa.borderColors.green,
                $eXeMapa.borderColors.blue,
                $eXeMapa.borderColors.yellow,
            ],
            color = colors[type];
        $('#mapaMessageDetail-' + instance).text(message);
        $('#mapaMessageDetail-' + instance).css({
            color: color,
        });
        $('#mapaMessageDetail-' + instance).show();

        $('#mapaMessageDetailsSound-' + instance).text(message);
        $('#mapaMessageDetailsSound-' + instance).css({
            color: color,
        });
        $('#mapaMessageDetailsSound-' + instance).show();
    },

    showPoint: function (i, instance) {
        const mOptions = $eXeMapa.options[instance],
            q = mOptions.activeMap.pts[i],
            urllv = $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                q.video
            ),
            type = urllv ? 1 : 0;

        mOptions.activeMap.active = i;

        if (q.type == 1) {
            $exeDevices.iDevice.gamification.media.stopSound(mOptions);
        }

        $('#mapaTooltipA-' + instance).hide();
        $eXeMapa.showClue(instance);
        $eXeMapa.hideModalWindows(instance);

        if (mOptions.evaluationG == 5) {
            mOptions.orderResponse.push(i + 1);
        }

        if (q.type == 4) {
            $eXeMapa.showPointNone(i, instance);
            return;
        }

        mOptions.waitPlayVideo = false;

        if (type == 0) {
            $eXeMapa.startVideo('', 0, 0, instance, type);
        }

        $eXeMapa.stopVideo(instance);
        $eXeMapa.hideModalMessages(instance);

        if (q.type != 5) {
            mOptions.visiteds.push(q.id);
        }

        $('#mapaMultimediaPoint-' + instance).show();
        $('#mapaAuthorPoint-' + instance).html(q.author);
        $('#mapaTitlePoint-' + instance).text(q.title);
        $('#mapaTitlePointSound-' + instance).text(q.title);
        $('#mapaFooterPoint-' + instance).text(q.footer);
        $('#mapaFooterPointSound-' + instance).text(q.footer);
        $('#mapaFooterPoint-' + instance).show();
        $('#mapaTextPoint-' + instance).text(q.title);

        if (q.footer.length > 0 && q.type == 2 && q.type == 7) {
            $('#mapaFooterPoint-' + instance).show();
        }

        if (q.type === 0) {
            $eXeMapa.showPointImage(i, instance);
        } else if (q.type === 1) {
            $eXeMapa.showPointVideo(i, instance);
        } else if (q.type === 2) {
            $eXeMapa.showPointText(i, instance);
        } else if (q.type == 7) {
            $eXeMapa.showToolTip(i, instance);
        } else if (q.type == 8) {
            $eXeMapa.showPointLink(i, instance);
        } else if (q.type === 3) {
            $eXeMapa.showPointSound(i, instance);
        } else if (q.type == 5) {
            $eXeMapa.showMapDetail(instance, i);
        } else if (q.type == 6) {
            mOptions.activeSlide = 0;
            $('#mapaLinkSlideRight-' + instance).show();
            $eXeMapa.showSlide(mOptions.activeSlide, instance, i);
        } else if (q.type == 9) {
            $eXeMapa.showTPQuestionnaire(i, instance);
        }
        if (typeof q.audio != 'undefined' && q.audio.length > 4) {
            $exeDevices.iDevice.gamification.media.playSound(q.audio, mOptions);
        }

        if (
            mOptions.isScorm == 1 &&
            mOptions.evaluationG != 4 &&
            mOptions.evaluationG > -1
        ) {
            $eXeMapa.sendScore(true, instance);
        }
        $eXeMapa.saveEvaluation(instance);
        let html = $('#mapaFDetails-' + instance).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);
        if (latex)
            $exeDevices.iDevice.gamification.math.updateLatex(
                '#mapaFDetails-' + instance
            );
    },

    setFontModalMessage: function (size, instance) {
        $('#mapaMessageInfoText-' + instance).css({
            'font-size': size + 'em',
        });
    },

    hideModalWindows(instance) {
        $('#mapaFMessages-' + instance).hide();
        $('#mapaFTests-' + instance).hide();
        $('#mapaFDetails-' + instance).hide();
        $('#mapaToolTip-' + instance).hide();
        $('#mapaFDetailsSound-' + instance).hide();
        $('#mapaTPQuestions-' + instance).hide();
    },

    hideModalMessages: function (instance) {
        $('#mapaFMessages-' + instance).hide();
        $('#mapaFTests-' + instance).hide();
        $('#mapaFMessageAccess-' + instance).hide();
        $('#mapaVideoPoint-' + instance).hide();
        $('#mapaVideoLocal-' + instance).hide();
        $('#mapaTextPoint-' + instance).hide();
        $('#mapaImagePoint-' + instance).hide();
        $('#mapaCoverPoint-' + instance).hide();
        $('#mapaFooterPoint-' + instance).hide();
        $('#mapaLinkAudio-' + instance).hide();
        $('#mapaLinkSlideLeft-' + instance).hide();
        $('#mapaLinkSlideRight-' + instance).hide();
        $('#mapaAuthorPoint-' + instance).hide();
        $('#mapaTPQuestions-' + instance).hide();
        $('#mapaFullLinkImage-' + instance).hide();
    },

    getScoreVisited: function (instance) {
        const mOptions = $eXeMapa.options[instance],
            num = $eXeMapa.getNumberVisited(mOptions.visiteds),
            score = ((num * 10) / mOptions.numberQuestions).toFixed(2);
        return score;
    },

    getNumberVisited: function (a) {
        let visiteds = Object.values($.extend(true, {}, a));
        for (let i = visiteds.length - 1; i >= 0; i--) {
            if (visiteds.indexOf(visiteds[i]) !== i) visiteds.splice(i, 1);
        }
        return visiteds.length;
    },

    messageAllVisited: function (instance) {
        const mOptions = $eXeMapa.options[instance];
        if (mOptions.evaluationG == 0) {
            if ($eXeMapa.getScoreVisited(instance) == 10.0) {
                $('#mapaPShowClue-' + instance).text(
                    mOptions.msgs.msgAllVisited
                );
                $('#mapaShowClue-' + instance).show();
            }
        } else if (mOptions.evaluationG == 4) {
            if (
                mOptions.percentajeShowQ > 0 &&
                $eXeMapa.getNumberVisited(mOptions.visiteds) >=
                    mOptions.numberPoints * (mOptions.percentajeShowQ / 100)
            ) {
                $('#mapaMessageFindP-' + instance).text(
                    mOptions.msgs.msgAllVisited +
                        ' ' +
                        mOptions.msgs.msgCompleteTest
                );
                $('#mapaMessageFindP-' + instance).show();
            }
        }
    },

    getScoreFind: function (instance) {
        const mOptions = $eXeMapa.options[instance],
            score = ((mOptions.hits * 10) / mOptions.numberQuestions).toFixed(
                2
            );
        return score;
    },

    hideCover: function (instance) {
        const mOptions = $eXeMapa.options[instance],
            q = mOptions.activeMap.pts[mOptions.activeMap.active];
        $('#mapaFDetails-' + instance).hide();
        $('#mapaFMessages-' + instance).hide();
        $('#mapaFDetailsSound-' + instance).hide();
        if (q.type == 2) {
            let $divText = $('#mapaTextPoint-' + instance)
                .find('.mapa-LinkTextsPoints[data-id="' + q.id + '"]')
                .eq(0);
            if ($divText.length == 1) {
                $divText.addClass('js-hidden');
                $('#mapaMainContainer-' + instance)
                    .parent('.mapa-IDevice')
                    .append($divText);
                $('#mapaTextPoint-' + instance).empty();
            }
        } else if (q.type == 7) {
            let $divTool = $('#mapaToolTip-' + instance)
                .find('.mapa-LinkToolTipPoints[data-id="' + q.id + '"]')
                .eq(0);
            if ($divTool.length == 1) {
                $divTool.addClass('js-hidden');
                $('#mapaMainContainer-' + instance)
                    .parent('.mapa-IDevice')
                    .append($divTool);
                $('#mapaToolTip-' + instance).empty();
            }
        }
        $('#mapaFTests-' + instance).hide();
    },

    hideMapDetail: function (instance, start) {
        const mOptions = $eXeMapa.options[instance];
        if (mOptions.levels.length > 1) {
            let parent = mOptions.levels[mOptions.levels.length - 2];
            if (start) {
                mOptions.levels = mOptions.levels.slice(0, 1);
                parent = mOptions.levels[0];
                mOptions.numLevel = 0;
            } else {
                mOptions.numLevel--;
                mOptions.levels.pop();
            }
            mOptions.activeMap = $.extend(true, {}, parent);
            $exeDevices.iDevice.gamification.media.stopSound(mOptions);
            $eXeMapa.addPoints(instance, mOptions.activeMap.pts);
            $eXeMapa.showImage(
                mOptions.activeMap.url,
                mOptions.activeMap.alt,
                instance
            );
            $eXeMapa.showButtonAreas(mOptions.activeMap.pts, instance);
            $eXeMapa.messageAllVisited(instance);
            mOptions.showData = false;
            if (mOptions.levels.length == 1) {
                mOptions.numLevel = 0;
                mOptions.showDetail = false;
                $('#mapaLinkCloseDetail-' + instance).hide();
            }
            if (mOptions.levels.length < 3) {
                $('#mapaLinkCloseHome-' + instance).hide();
            }
        }
    },

    refreshGame: function (instance) {
        const mOptions = $eXeMapa.options[instance];

        if (!mOptions || !mOptions.activeMap || !mOptions.activeMap.url) return;

        $eXeMapa.showImage(
            mOptions.activeMap.url,
            mOptions.activeMap.alt,
            instance
        );
    },

    enterCodeAccess: function (instance) {
        const mOptions = $eXeMapa.options[instance];
        if (
            mOptions.itinerary.codeAccess.toLowerCase() ===
            $('#mapaCodeAccessE-' + instance)
                .val()
                .toLowerCase()
        ) {
            $eXeMapa.hideCover(instance);
            mOptions.showData = false;
        } else {
            $('#mapaMesajeAccesCodeE-' + instance)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $('#mapaCodeAccessE-' + instance).val('');
        }
    },

    uptateTime: function (tiempo, instance) {
        const mTime =
            $exeDevices.iDevice.gamification.helpers.getTimeToString(tiempo);
        $('#mapaPTime-' + instance).text(mTime);
    },

    startVideo: function (id, start, end, instance, type) {
        const mOptions = $eXeMapa.options[instance],
            mstart = start < 1 ? 0.1 : start;

        $('#mapaVideoPoint-' + instance).hide();
        $('#mapaVideoLocal-' + instance).hide();

        if (typeof type != 'undefined' && type > 0) {
            if (mOptions.localPlayer) {
                mOptions.pointEnd = end;
                mOptions.localPlayer.src = id;
                mOptions.localPlayer.currentTime = parseFloat(start);
                if (typeof mOptions.localPlayer.play == 'function') {
                    mOptions.localPlayer.play();
                }
            }
            clearInterval(mOptions.timeUpdateInterval);
            mOptions.timeUpdateInterval = setInterval(function () {
                let $node = $('#mapaMainContainer-' + instance);
                let $content = $('#node-content');
                if (
                    !$node.length ||
                    ($content.length && $content.attr('mode') === 'edition')
                ) {
                    clearInterval(mOptions.timeUpdateInterval);
                    return;
                }
                $eXeMapa.updateTimerDisplayLocal(instance);
            }, 1000);
            $('#mapaVideoLocal-' + instance).show();
            return;
        }

        if (mOptions.player) {
            if (typeof mOptions.player.loadVideoById == 'function') {
                mOptions.player.loadVideoById({
                    videoId: id,
                    startSeconds: mstart,
                    endSeconds: end,
                });
            }
        }
        $('#mapaVideoPoint-' + instance).show();
    },

    updateTimerDisplayLocal: function (instance) {
        const mOptions = $eXeMapa.options[instance];
        if (mOptions.localPlayer) {
            let currentTime = mOptions.localPlayer.currentTime;
            if (currentTime) {
                if (
                    Math.ceil(currentTime) == mOptions.pointEnd ||
                    Math.ceil(currentTime) == mOptions.durationVideo
                ) {
                    mOptions.localPlayer.pause();
                    mOptions.pointEnd = 100000;
                }
            }
        }
    },

    playVideo: function (instance) {
        const mOptions = $eXeMapa.options[instance],
            point = mOptions.activeMap.pts[mOptions.activeMap.active],
            urllv = $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                point.video
            ),
            type = urllv ? 1 : 0;

        if (type > 0) {
            $eXeMapa.startVideo(
                urllv,
                point.iVideo,
                point.fVideo,
                instance,
                type
            );
            return;
        }
        const id = $exeDevices.iDevice.gamification.media.getIDYoutube(
            point.video
        );
        if (id) {
            $eXeMapa.startVideo(id, point.iVideo, point.fVideo, instance, type);
        }
    },

    updateTimerDisplay: function () {},
    updateProgressBar: function () {},
    stopVideo: function (i) {
        const mOptions = $eXeMapa.options[i];
        if (mOptions.localPlayer) {
            if (typeof mOptions.localPlayer.pause == 'function') {
                mOptions.localPlayer.pause();
            }
        }
        if (mOptions.player) {
            if (typeof mOptions.player.pauseVideo == 'function') {
                mOptions.player.pauseVideo();
            }
        }
    },

    stopVideoText: function (i) {
        $('#mapaTextPoint-' + i)
            .find('iframe')
            .each(function () {
                const attr = $(this).attr('src');
                $(this).attr('src', '').attr('src', attr);
            });
        $('#mapaTextPoint-' + i)
            .find('audio')
            .each(function () {
                const atts = $(this).attr('src');
                $(this).attr('src', '').attr('src', atts);
            });
    },

    showImage: function (url, alt, instance) {
        const $Image = $('#mapaImage-' + instance);

        $('#mapaMultimedia-' + instance)
            .find('.MQP-Point')
            .hide();
        $('#mapaMultimedia-' + instance)
            .find('.MQP-TextLink')
            .hide();
        if (url.trim().length == 0) {
            $Image.hide();
            return false;
        }

        $Image
            .prop('src', url)
            .off('load error')
            .on('load', function () {
                if (
                    !this.complete ||
                    typeof this.naturalWidth == 'undefined' ||
                    this.naturalWidth == 0
                ) {
                    $Image.hide();
                    $Image.attr(
                        'alt',
                        $eXeMapa.options[instance].msgs.msgNoImage
                    );
                    return false;
                } else {
                    $eXeMapa.placeImageWindows1(
                        this,
                        this.naturalWidth,
                        this.naturalHeight,
                        instance
                    );
                    $Image.show();
                    $Image.attr('alt', alt);
                    $eXeMapa.paintPoints(instance);
                    $('#mapaMultimedia-' + instance).height(
                        $Image.height() + 30
                    );
                    return true;
                }
            })
            .on('error', function () {
                $Image.hide();
                $Image.attr('alt', $eXeMapa.options[instance].msgs.msgNoImage);
                return false;
            });
    },

    placeImageWindows1: function (
        image,
        naturalWidth,
        naturalHeight,
        instance
    ) {
        const mOptions = $eXeMapa.options[instance],
            $multimedia = $('#mapaMultimedia-' + instance);

        $multimedia.css('height', 'auto');

        let wp = Math.max($multimedia.width(), 200),
            top =
                $('#mapaToolBar-' + instance).height() +
                parseInt($multimedia.css('marginTop')) * 2,
            wI = wp,
            hI = Math.round((wI / naturalWidth) * naturalHeight);

        const elementsToCheck = [
            '#mapaMessageFind-',
            '#mapaAutorLicence-',
            '#mapaGameClue-',
        ];
        elementsToCheck.forEach(function (selector) {
            const $element = $(selector + instance);
            if ($element.is(':visible')) {
                top +=
                    $element.height() + parseInt($element.css('marginTop')) * 2;
            }
        });

        if ($eXeMapa.isFullScreen()) {
            $multimedia.css('max-width', window.innerWidth - 30 + 'px');
            wp = window.innerWidth - 30;

            const varW = naturalWidth / window.innerWidth,
                varH = naturalHeight / (window.innerHeight - top);

            if (varW > varH) {
                wI = window.innerWidth - 30;
                hI = naturalHeight / varW;
            } else {
                wI = naturalWidth / varH;
                hI = window.innerHeight - top;
            }
            $multimedia.css('height', hI + 'px');
        } else {
            $multimedia.css('max-width', '700px');
            let wp = Math.min(Math.max($multimedia.width(), 200), 700);
            let wI = wp;
            let hI = Math.round((wI / naturalWidth) * naturalHeight);
            if (window.innerWidth > window.innerHeight && hI > wp) {
                let s1 = hI / wp;
                wI = Math.round(wI / s1);
                hI = wp;
            }
            $multimedia.height(hI);
        }

        const lf = Math.round((wp - wI) / 2);
        $(image).css({
            top: '0',
            left: lf + 'px',
            width: Math.round(wI) + 'px',
            height: Math.round(hI) + 'px',
        });

        mOptions.canvas.width = Math.round(wI);
        mOptions.canvas.height = Math.round(hI);
        mOptions.canvas.left = lf;
        mOptions.canvas.top = 0;

        $('#mapaCanvas-' + instance).css({
            top: '0',
            left: lf + 'px',
            width: Math.round(wI) + 'px',
            height: Math.round(hI) + 'px',
        });

        if (mOptions.evaluationG === 1) {
            $('#mapaImageRect-' + instance).css({
                width: Math.round(wI) + 'px',
                height: Math.round(hI) + 'px',
            });
        }
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

    showMessage: function (type, message, instance) {
        const colors = [
                $eXeMapa.borderColors.black,
                $eXeMapa.borderColors.red,
                $eXeMapa.borderColors.green,
                $eXeMapa.borderColors.blue,
                $eXeMapa.borderColors.yellow,
            ],
            color = colors[type];
        $('#mapaMessage-' + instance).html(message);
        $('#mapaMessage-' + instance).css({
            color: color,
        });
    },

    showTPMessage: function (type, message, instance) {
        const colors = [
                $eXeMapa.borderColors.black,
                $eXeMapa.borderColors.red,
                $eXeMapa.borderColors.green,
                $eXeMapa.borderColors.blue,
                $eXeMapa.borderColors.yellow,
            ],
            color = colors[type];
        $('#mapaMessage1-' + instance).html(message);
        $('#mapaMessage1-' + instance).css({
            color: color,
        });
    },

    drawImage: function (image, mData) {
        $(image).css({
            left: mData.x + 'px',
            top: 0,
            width: mData.w + 'px',
            height: mData.h + 'px',
        });
    },

    getShowLetter: function (phrase, nivel) {
        const numberLetter = parseInt((phrase.length * nivel) / 100);
        let arrayRandom = [];
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

    isFullScreen: function () {
        const isFull = !(
            !document.fullscreenElement &&
            !document.mozFullScreenElement &&
            !document.webkitFullscreenElement &&
            !document.msFullscreenElement
        );
        return isFull;
    },
};
$(function () {
    $eXeMapa.init();
});
