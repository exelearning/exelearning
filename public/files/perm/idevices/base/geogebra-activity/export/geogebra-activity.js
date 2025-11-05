/* eslint-disable no-undef */
/**
 * GeoGebra activity iDevice
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Authors: Ignacio Gros (http://gros.es/),  Javier Cayetano Rodríguez and Manuel Narváez Martínez for http://exelearning.net/
 *
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 *
 * Loading icon generated with http://www.ajaxload.info/
 */
var $geogebraactivity = {
    geogebraScript: 'https://cdn.geogebra.org/apps/deployggb.js',
    defaults: {
        width: 565,
        height: 363,
    },
    startTime: '',
    messages: ['', '', '', ''],
    messagesScorm: [],
    idevicePath: '',
    isInExe: false,
    optionsScorm: [],
    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',

    init: function () {
        this.isInExe = eXe.app.isInExe();
        const nx = $('.idevice_node.geogebra-activity')
            .eq(0)
            .attr('data-idevice-path');
        this.idevicePath = this.isInExe
            ? eXe.app.getIdeviceInstalledExportPath('geogebra-activity')
            : nx;

        this.activities = $('.auto-geogebra');

        if (this.activities.length == 0) return; // Nothing to do

        // Editing a iDevice
        if ($('#exe-submitButton').length > 0) {
            this.activities.hide();
            if (typeof _ != 'undefined')
                this.activities.before('<p>' + 'GeoGebra activity' + '</p>');
            return;
        }

        if (!navigator.onLine) {
            return;
        }
        if (!$('html').is('#exe-index')) {
            this.scormAPIwrapper = '../libs/SCORM_API_wrapper.js';
            this.scormFunctions = '../libs/SCOFunctions.js';
        }

        this.indicator.start();
        if ($('body').hasClass('exe-scorm')) {
            this.loadSCORM_API_wrapper();
        } else {
            this.loadGeogebraScript();
        }
    },

    loadSCORM_API_wrapper: function () {
        if (typeof pipwerks == 'undefined')
            eXe.app.loadScript(
                this.scormAPIwrapper,
                '$geogebraactivity.loadSCOFunctions()'
            );
        else this.loadSCOFunctions();
    },

    loadSCOFunctions: function () {
        if (typeof scorm == 'undefined')
            eXe.app.loadScript(
                this.scormFunctions,
                '$geogebraactivity.loadGeogebraScript()'
            );
        else this.loadGeogebraScript();
    },

    loadGeogebraScript: function () {
        if (typeof GGBApplet == 'undefined')
            eXe.app.loadScript(
                this.geogebraScript,
                '$geogebraactivity.enable()'
            );
        else this.enable();
    },

    indicator: {
        start: function () {
            $geogebraactivity.activities.each(function (i) {
                window['$geogebraactivityButtonText' + i] = '';
                let txt = $('.scorm-button-text', this);
                if (txt.length == 1) {
                    txt = txt.html().replace(' (', '');
                    txt = txt.slice(0, -1);
                    window['$geogebraactivityButtonText' + i] = txt;
                }
                let size = $geogebraactivity.indicator.getSize(this);
                let intro = '';
                let instructions = $('.auto-geogebra-instructions', this);
                if (instructions.length == 1 && instructions.text() != '') {
                    intro = instructions.wrap(
                        '<div class="auto-geogebra-instructions"></div>'
                    );
                }
                let aft = '';
                let after = $('.auto-geogebra-extra-content', this);
                if (after.length == 1 && after.text() != '') {
                    aft = after.wrap(
                        '<div class="auto-geogebra-extra-content"></div>'
                    );
                }
                let ath = '';
                let author = $('.auto-geogebra-author', this);
                if (author.length == 1 && author.text() != '') {
                    let math = author.text().split(',');
                    if (math.length == 5 && math[3] == '1') {
                        ath =
                            '<div class="auto-geogebra-author">' +
                            unescape(math[4]) +
                            ': <a href="' +
                            unescape(math[1]) +
                            '" target="_blank">' +
                            unescape(math[0]) +
                            '</a></div>';
                    }
                }
                let messages = $('.auto-geogebra-messages-evaluation', this);
                if (messages.length == 1 && messages.text() != '') {
                    $geogebraactivity.messages = messages.text().split(',');
                    for (
                        let z = 0;
                        z < $geogebraactivity.messages.length;
                        z++
                    ) {
                        $geogebraactivity.messages[z] = unescape(
                            $geogebraactivity.messages[z]
                        );
                    }
                }

                let messagesScorm = $('.auto-geogebra-messages-scorm', this);
                if (messagesScorm.length == 1 && messagesScorm.text() != '') {
                    $geogebraactivity.messagesScorm = messagesScorm
                        .text()
                        .split(',');
                    for (
                        let z = 0;
                        z < $geogebraactivity.messagesScorm.length;
                        z++
                    ) {
                        $geogebraactivity.messagesScorm[z] = unescape(
                            $geogebraactivity.messagesScorm[z]
                        );
                    }
                }
                $(this)
                    .before(intro)
                    .after(aft)
                    .after(ath)
                    .wrap('<div class="auto-geogebra-wrapper"></div>')
                    .addClass('auto-geogebra-loading')
                    .css({
                        width: size[0] + 'px',
                        height: size[1] + 'px',
                    })
                    .html('');
            });
        },

        getSize: function (e) {
            let w = $geogebraactivity.defaults.width;
            let h = $geogebraactivity.defaults.height;
            let c = e.className;
            c = c.split(' ');
            for (let i = 0; i < c.length; i++) {
                if (c[i].indexOf('auto-geogebra-width-') == 0)
                    w = c[i].replace('auto-geogebra-width-', '');
                else if (c[i].indexOf('auto-geogebra-height-') == 0)
                    h = c[i].replace('auto-geogebra-height-', '');
            }
            return [w, h];
        },

        getIDEvaluation: function (e) {
            let eid = '';
            let c = e.className;
            c = c.split(' ');
            for (let i = 0; i < c.length; i++) {
                if (c[i].indexOf('auto-geogebra-evaluation-id-') == 0)
                    eid = c[i].replace('auto-geogebra-evaluation-id', '');
            }
            return eid;
        },
        stop: function () {
            $geogebraactivity.activities
                .removeClass('auto-geogebra-loading')
                .css('min-height', 'auto');
        },
    },

    enable: function () {
        this.activities.each(function (i) {
            setTimeout(function () {
                $geogebraactivity.indicator.stop();
            }, 3000);
            let c = this.className;
            c = c.split(' ');
            if (c.length > 1) {
                let id = c[1].replace('auto-geogebra-', '');
                $geogebraactivity.addActivity(this, id, c, i);
            }
        });
        this.startTime = Date.now();
    },

    addActivity: function (e, id, c, inst) {
        let sfx = id + inst;
        $(e).html('').css('margin', '0 auto');
        e.id = 'auto-geogebra-' + sfx;
        let width = this.defaults.width;
        let height = this.defaults.height;
        let lang = 'en';
        let borderColor = '#FFFFFF';
        let scale = 1;
        let evaluationID = '';
        let ideviceID = '';
        let weighted = 100;
        for (let i = 0; i < c.length; i++) {
            let currentClass = c[i];
            if (currentClass.indexOf('auto-geogebra-width-') == 0) {
                currentClass = currentClass.replace('auto-geogebra-width-', '');
                currentClass = parseInt(currentClass);
                if (!isNaN(currentClass) && currentClass > 0)
                    width = currentClass;
            } else if (currentClass.indexOf('auto-geogebra-height-') == 0) {
                currentClass = currentClass.replace(
                    'auto-geogebra-height-',
                    ''
                );
                currentClass = parseInt(currentClass);
                if (!isNaN(currentClass) && currentClass > 0)
                    height = currentClass;
            } else if (currentClass.indexOf('language-') == 0) {
                lang = currentClass.replace('language-', '');
            } else if (currentClass.indexOf('auto-geogebra-border-') == 0) {
                currentClass = currentClass.replace(
                    'auto-geogebra-border-',
                    ''
                );
                borderColor = '#' + currentClass;
            } else if (currentClass.indexOf('auto-geogebra-scale-') == 0) {
                scale =
                    parseInt(currentClass.replace('auto-geogebra-scale-', '')) /
                    100;
            } else if (
                currentClass.indexOf('auto-geogebra-evaluation-id-') == 0
            ) {
                evaluationID = currentClass.replace(
                    'auto-geogebra-evaluation-id-',
                    ''
                );
                evaluationID = evaluationID == '0' ? '' : evaluationID;
            } else if (currentClass.indexOf('auto-geogebra-ideviceid-') == 0) {
                ideviceID = currentClass.replace(
                    'auto-geogebra-ideviceid-',
                    ''
                );
            } else if (currentClass.indexOf('auto-geogebra-weight-') == 0) {
                weighted = currentClass.replace('auto-geogebra-weight-', '');
                weighted = parseInt(weighted);
            }
        }

        let parameters = {
            id: 'auto-geogebra-' + sfx,
            width: width,
            height: height,
            showMenuBar: c.indexOf('showMenuBar') > -1 ? true : false,
            showAlgebraInput: c.indexOf('showAlgebraInput') > -1 ? true : false,
            showToolBar: c.indexOf('showToolBar') > -1 ? true : false,
            showToolBarHelp: c.indexOf('showToolBarHelp') > -1 ? true : false,
            showResetIcon: c.indexOf('showResetIcon') > -1 ? true : false,
            enableLabelDrags: false,
            enableShiftDragZoom:
                c.indexOf('enableShiftDragZoom') > -1 ? true : false,
            enableRightClick: c.indexOf('enableRightClick') > -1 ? true : false,
            errorDialogsActive:
                c.indexOf('errorDialogsActive') > -1 ? true : false,
            useBrowserForJS: false,
            preventFocus: c.indexOf('preventFocus') > -1 ? true : false,
            showZoomButtons: false,
            showFullscreenButton:
                c.indexOf('showFullscreenButton0') > -1 ? false : true,
            scale: scale,
            disableAutoScale: c.indexOf('disableAutoScale') > -1 ? true : false,
            clickToLoad: false,
            appName: 'classic',
            showSuggestionButtons:
                c.indexOf('showSuggestionButtons0') > -1 ? false : true,
            buttonRounding: 0.7,
            buttonShadows: c.indexOf('showMenuBar') > -1 ? true : false,
            playButton: c.indexOf('playButton') > -1 ? true : false,
            language: lang,
            borderColor: borderColor,
            // use this instead of ggbBase64 to load a material from geogebra.org
            material_id: id,
        };
        let views = {
            is3D: 0,
            AV: 1,
            SV: 0,
            CV: 0,
            EV2: 0,
            CP: 0,
            PC: 0,
            DA: 0,
            FI: 0,
            macro: 0,
        };
        window['applet' + sfx] = new GGBApplet(parameters, '5.0', views);
        window['applet' + sfx].inject('auto-geogebra-' + sfx);

        // Get score button
        let options = $geogebraactivity.getOptions(
            sfx,
            weighted,
            $geogebraactivity.messagesScorm,
            evaluationID
        );
        if (
            (c.length > 2 && c[2] == 'auto-geogebra-scorm') ||
            (ideviceID && evaluationID && evaluationID.length > 4)
        ) {
            options.textButtonScorm =
                window['$geogebraactivityButtonText' + inst] ||
                options.textButtonScorm;
            let fB =
                $exeDevices.iDevice.gamification.scorm.addButtonScoreNew(
                    options
                );
            $(e).after(fB);
            $(e)
                .closest('.idevice_node')
                .on('click', '.Games-SendScore', function (e) {
                    e.preventDefault();
                    $geogebraactivity.sendScore(options);
                    $geogebraactivity.saveEvaluation(options);
                });
            $(e)
                .closest('.idevice_node ')
                .find('.Games-registerActivity')
                .hide();
            $geogebraactivity.optionsScorm.push(options);
            if (c.length > 2 && c[2] == 'auto-geogebra-scorm') {
                $exeDevices.iDevice.gamification.scorm.registerActivity(
                    options
                );
                if (typeof pipwerks != 'undefined' && pipwerks.SCORM) {
                    $(e)
                        .closest('.idevice_node')
                        .find('.Games-registerActivity')
                        .show();
                }
            }
            const hasScorm12 = typeof window.API !== 'undefined';
            const hasScorm2004 = typeof window.API_1484_11 !== 'undefined';
            if (
                evaluationID &&
                evaluationID.length > 4 &&
                !hasScorm12 &&
                !hasScorm2004
            ) {
                $('#auto-geogebra-' + sfx)
                    .closest('.idevice_node')
                    .find('.Games-RepeatActivity')
                    .hide();
            }
        }

        setTimeout(function () {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                options,
                this.isInExe
            );
        }, 500);
    },
    getIdeviceID: function (sfx) {
        const ideviceid =
            $('#auto-geogebra-' + sfx)
                .closest(`div.idevice_node.geogebra-activity`)
                .attr('id') || '';

        return ideviceid;
    },

    getOptions: function (sfx, weighted, messagesScorm, evaluationID) {
        let messages = $geogebraactivity.messages;
        let messagesEval = [];
        for (let z = 0; z < messages.length; z++) {
            messagesEval.push(unescape(messages[z]));
        }

        let options = {
            id: $geogebraactivity.getIdeviceID(sfx),
            main: 'auto-geogebra-' + sfx,
            scorerp: 0,
            weighted: weighted ?? 100,
            evaluation: evaluationID.length !== 0,
            evaluationID: evaluationID,
            isInExe: this.isInExe,
            main: 'auto-geogebra-' + sfx,
            idevice: 'geogebra-activity',
            scorerp: 0,
            idevicePath: this.idevicePath,
            textButtonScorm: $geogebraactivity.messages[3],
            isScorm: 2,
            msgs: {
                msgScoreScorm:
                    typeof messagesScorm[0] != 'undefined'
                        ? messagesScorm[0]
                        : '',
                msgYouScore:
                    typeof messagesScorm[1] != 'undefined'
                        ? messagesScorm[1]
                        : '',
                msgScore:
                    typeof messagesScorm[2] != 'undefined'
                        ? messagesScorm[2]
                        : '',
                msgWeight:
                    typeof messagesScorm[3] != 'undefined'
                        ? messagesScorm[3]
                        : '',
                msgYouLastScore:
                    messagesScorm[4] != 'undefined' ? messagesScorm[4] : '',
                msgOnlySaveScore: 'You can only save the score once!',
                msgOnlySave: 'You can only save once',
                msgOnlySaveAuto:
                    'Your score will be saved after each question. You can only play once.',
                msgSaveAuto:
                    'Your score will be automatically saved after each question.',
                msgSeveralScore:
                    'You can save the score as many times as you want',
                msgPlaySeveralTimes:
                    'You can do this activity as many times as you want',
                msgOnlySaveAuto:
                    'Your score will be saved after each question. You can only play once.',
                msgSaveAuto:
                    'Your score will be automatically saved after each question.',
                msgSeveralScore:
                    'You can save the score as many times as you want',
                msgPlaySeveralTimes:
                    'You can do this activity as many times as you want',
                msgUncompletedActivity:
                    typeof messagesEval[0] != 'undefined'
                        ? messagesEval[0]
                        : '',
                msgUnsuccessfulActivity:
                    typeof messagesEval[1] != 'undefined'
                        ? messagesEval[1]
                        : 'Activity: Passed. Score: %s',
                msgSuccessfulActivity:
                    typeof messagesEval[2] != 'undefined'
                        ? messagesEval[2]
                        : 'Activity: Not passed. Score: %s',
                msgYouScore:
                    typeof messagesEval[3] != 'undefined'
                        ? messagesEval[3]
                        : 'You score',
            },
        };
        return options;
    },

    saveEvaluation: function (options) {
        const mOptions = JSON.parse(JSON.stringify(options));
        const SCORE_RAW = 'SCORMRawScore';
        const SCORE_MIN = 'SCORMMinScore';
        const SCORE_MAX = 'SCORMMaxScore';
        let score = ggbApplet.getValue(SCORE_RAW);
        score = score.toFixed(2);
        if (
            ggbApplet.exists(SCORE_RAW) &&
            ggbApplet.exists(SCORE_MIN) &&
            ggbApplet.exists(SCORE_MAX)
        ) {
            let score_raw = ggbApplet.getValue(SCORE_RAW),
                score_min = ggbApplet.getValue(SCORE_MIN),
                score_max = ggbApplet.getValue(SCORE_MAX),
                score_scaled =
                    (score_raw - score_min) / (score_max - score_min);
            score = (score_scaled * 10).toFixed(2);
        }

        mOptions.scorerp = score;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            mOptions.isInExe
        );
    },

    sendScore: function (options) {
        if (typeof pipwerks === 'undefined' || !pipwerks.SCORM) {
            return;
        }
        const mOptions = JSON.parse(JSON.stringify(options));
        mOptions.gameStarted = true;
        pipwerks.SCORM.SetScoreMax('100');
        pipwerks.SCORM.SetScoreMin('0');
        const SCORE_RAW = 'SCORMRawScore';
        const SCORE_MIN = 'SCORMMinScore';
        const SCORE_MAX = 'SCORMMaxScore';

        let score = 0;
        if (
            ggbApplet.exists(SCORE_RAW) &&
            ggbApplet.exists(SCORE_MIN) &&
            ggbApplet.exists(SCORE_MAX)
        ) {
            let score_raw = ggbApplet.getValue(SCORE_RAW),
                score_min = ggbApplet.getValue(SCORE_MIN),
                score_max = ggbApplet.getValue(SCORE_MAX),
                score_scaled =
                    (score_raw - score_min) / (score_max - score_min);
            score = (score_scaled * 10).toFixed(2);
        }

        mOptions.scorerp = score;

        mOptions.previousScore = $geogebraactivity.previousScore || '';
        mOptions.userName = $geogebraactivity.userName || '';

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(false, mOptions);

        $geogebraactivity.previousScore = mOptions.previousScore;
    },
};
$(function () {
    $geogebraactivity.init();
});
