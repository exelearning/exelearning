/**
 * Form iDevice
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: SDWEB - Innovative Digital Solutions
 *
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $form = {
    ideviceId: '',
    dropdownPassRateId: 'dropdownPassRate',
    checkAddBtnAnswersId: 'checkAddBtnAnswers',
    passRate: '',
    iconSingleSelection: 'rule',
    iconMultipleSelection: 'checklist_rtl',
    iconTrueFalse: 'rule',
    iconDropdown: 'expand_more',
    iconFill: 'horizontal_rule',
    msgs: {
        msgScoreScorm:
            'La puntuación no se puede guardar porque esta página no forma parte de un paquete SCORM.',
        msgYouScore: 'Tu puntuación es',
        msgScore: 'Puntuación',
        msgWeight: 'Peso',
        msgYouLastScore: 'La última puntuación guardada es',
        msgOnlySaveScore: '¡Solo puedes guardar la puntuación una vez!',
        msgOnlySave: 'Solo puedes guardar una vez',
        msgOnlySaveAuto:
            'Tu puntuación se guardará después de cada pregunta. Solo puedes jugar una vez.',
        msgSaveAuto:
            'Tu puntuación se guardará automáticamente después de cada pregunta.',
        msgSeveralScore:
            'Puedes guardar la puntuación tantas veces como quieras',
        msgPlaySeveralTimes:
            'Puedes realizar esta actividad tantas veces como quieras',
        msgActityComply: 'Ya has realizado esta actividad.',
        msgUncompletedActivity: 'Actividad incompleta',
        msgSuccessfulActivity: 'Actividad: Superada. Puntuación: %s',
        msgUnsuccessfulActivity: 'Actividad: No superada. Puntuación: %s',
        msgTypeGame: 'Formulario',
        msgStartGame: 'Haz clic aquí para empezar',
        msgTime: 'Tiempo por pregunta',
        msgSaveScore: 'Guardar puntuación',
        msgResult: 'Resultado',
        msgCheck: 'Comprobar',
        msgReset: 'Reiniciar',
        msgShowAnswers: 'Mostrar respuestas',
        msgTestResultPass: '¡Enhorabuena! Has superado la prueba',
        msgTestResultNotPass: 'Lo siento. No has superado la prueba',
        msgTrueFalseHelp: 'Selecciona si la afirmación es verdadera o falsa',
        msgDropdownHelp:
            'Elige la respuesta correcta entre las opciones propuestas',
        msgFillHelp: 'Rellena los espacios en blanco con la palabra adecuada',
        msgSingleSelectionHelp:
            'Opción múltiple con una sola respuesta correcta',
        msgMultipleSelectionHelp:
            'Opción múltiple con varias respuestas correctas',
        msgPlayStart: 'Pulse aquí para comenzar',
        msgTrue: 'Verdadero',
        msgFalse: 'Falso',
        msgOk: 'Correcto',
        msgKO: 'Incorrecto',
        msgSuggestion: 'Sugerencia',
    },

    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',
    renderView: function (data, accesibility, template, ideviceId) {
        const ldata = this.updateConfig(data, ideviceId);
        let display = $('body').hasClass('exe-export') ? 'none' : '';
        if ($('body').hasClass('exe-scorm') && ldata.isScorm > 0) {
            ldata.msgs.msgCheck = ldata.textButtonScorm;
        }

        const json = JSON.stringify({});
        const addBtnAnswers = ldata.addBtnAnswers;
        const timedisplay = ldata.time > 0 ? 'flex' : 'none';
        const timebody = ldata.time > 0 ? 'none' : 'block';
        const time = this.formatTime(ldata.time * 60);
        const htmlContent = `<div class="game-evaluation-ids js-hidden" data-id="${ldata.id}" data-evaluationb="${ldata.evaluation}" data-evaluationid="${ldata.evaluationID}"></div>
            <div id="frmMainContainer-${ldata.id}" class="form-IDevice" data-id="${ldata.id}">
                <div class="form-Data js-hidden">${json}</div>
                ${ldata.eXeFormInstructions ? `<div class="form-instructions">${ldata.eXeFormInstructions}</div>` : ''}
                <div class="FRMP-GameScoreBoard" style="display:${timedisplay};">
                    <div>
                        <strong><span class="sr-av">${ldata.msgs.msgTime}:</span></strong>
                        <span id="frmPTime-${ldata.id}">${time}</span>
                    </div>
                </div>
                <div class="FRMP-StartGame" id="frmStartGameDiv-${ldata.id}" style="display:${timedisplay};">
                      <button  id="frmStartGame-${ldata.id}" type="button" class="btn btn-primary">${ldata.msgs.msgPlayStart}</button>
                </div>
                <div class="form-body" id="frmBody-${ldata.id}" style="display:${timebody};">
                    <div class="FRMP-Questions">
                        <div id="form-questions-${ldata.id}" > </div>
                        <div id="frmCover-${ldata.id}" class="FRMP-Cover"> </div>
                    </div>
                    <div id="resultsContainer-${ldata.id}" class="form-results-container inline">
                        <div id="form-score-${ldata.id}" class="score-text">${ldata.msgs.msgScore}.</div>
                        <div id="form-result-test-${ldata.id}" class="score-text phrase-score"></div>
                    </div>
                    <div class="form-buttons-container inline">
                        <input id="form-button-check-${ldata.id}" class="btn btn-primary" type="button" value="${ldata.msgs.msgCheck}"
                            data-id="${ldata.id}" data-pass-rate="${this.passRate}" />
                        <input id="form-button-reset-${ldata.id}" type="button" value="${ldata.msgs.msgReset}"
                            data-id="${ldata.id}" class="btn btn-primary"  style="display:none" />
                        ${
                            addBtnAnswers
                                ? `<input id="form-button-show-answers-${ldata.id}" class="btn btn-primary" type="button" value="${ldata.msgs.msgShowAnswers}"
                            data-id="${ldata.id}" style="display: ${display}" />`
                                : ''
                        }

                    </div>
                </div>
                <div class="Games-BottonContainer">
                    <div class="Games-GetScore">
                        <input id="frmPSendScore-${ldata.id}" type="button" value="${ldata.textButtonScorm}" class="feedbackbutton Games-SendScore" style="display:none"/> <span class="Games-RepeatActivity"></span>
                    </div>
                </div>
                ${ldata.eXeIdeviceTextAfter ? `<div class="form-instructions">${ldata.eXeIdeviceTextAfter}</div>` : ''}
            </div>
            ${$form.extractMediaElements(data.questionsData)}
            `;
        return template.replace('{content}', htmlContent);
    },

    mergeFields(obj1, obj2) {
        if (!obj1) return obj2;
        Object.keys(obj2).forEach((key) => {
            if (!(key in obj1)) obj1[key] = obj2[key];
        });
        return obj1;
    },

    updateConfig: function (odata, ideviceId) {
        this.isInExe = eXe.app.isInExe();
        this.idevicePath = this.isInExe
            ? eXe.app.getIdeviceInstalledExportPath('form')
            : $('.idevice_node.form').eq(0).attr('data-idevice-path');
        const data = JSON.parse(JSON.stringify(odata));
        data.msgs = $form.mergeFields(data.msgs, $form.msgs);
        data.id = ideviceId || data.ideviceId || data.id;
        data.evaluation = data.evaluation || false;
        data.evaluationID = data.evaluationID || '';
        data.time = data.time || 0;
        data.repeatActivity = data.repeatActivity || false;
        data.textButtonScorm =
            data.scorm && data.scorm.buttonTextSave
                ? data.scorm.buttonTextSave
                : data.msgs.msgSaveScore;
        let lscorm = data.scorm && data.scorm.saveScore ? 1 : 0;
        data.isScorm = lscorm || data.isScorm ? 1 : 0;
        data.weighted = data.weighted ?? 100;
        const title =
            $('#' + data.id)
                .closest('article')
                .find('header .box-title')
                .text() || '';
        const $idevices = $('.idevice_node');
        const index = $idevices.index($('#' + data.id)) + 1;
        data.ideviceNumber = index;
        data.isInExe = this.isInExe;
        data.idevicePath = this.idevicePath;
        data.title = title;
        data.gameStarted = false;
        data.idevice = 'form-IDevice';
        data.numberQuestions = data.questionsData
            ? data.questionsData.length
            : 0;
        data.eXeIdeviceTextAfter = data.eXeIdeviceTextAfter ?? '';
        data.totalQuestions = 0;
        data.rightQuestions = 0;
        data.wrongQuestions = 0;
        data.showSlider = data.showSlider ?? false;
        data.passRate = data.passRate ?? 5;
        data.addBtnAnswers = data.addBtnAnswers ?? true;
        data.scorerp = 0;
        data.main = 'frmMainContainer-' + data.id;
        data.percentageQuestions = data.percentageQuestions ?? 100;
        data.questionsRandom = data.questionsRandom ?? false;
        if (data.percentageQuestions < 100) {
            data.questionsData =
                $exeDevices.iDevice.gamification.helpers.getQuestions(
                    data.questionsData,
                    data.percentageQuestions
                );
        } else if (data.questionsRandom) {
            data.questionsData =
                $exeDevices.iDevice.gamification.helpers.shuffleAds(
                    data.questionsData
                );
        }

        return data;
    },

    /**
     * Json idevice api function
     * Engine execution order: 2
     *
     * Add the behavior and other functionalities to idevice
     *
     * @param {Object} data
     * @param {Number} accesibility
     * @returns {Boolean}
     */
    renderBehaviour: function (data, accesibility, ideviceId) {
        console.log(data);
        const ldata = this.updateConfig(data, ideviceId);
        const addBtnAnswers = ldata.addBtnAnswers;
        if (!ldata.questionsData) return;
        const questionsHtml = $form.getHtmlFormView(ldata.questionsData, ldata);
        $('#form-questions-' + ldata.id).empty();
        $('#form-questions-' + ldata.id).append(questionsHtml);
        const interval = setInterval(() => {
            const $ideviceElement = $(`[id="${ldata.id}"]`);
            if ($ideviceElement.length) {
                $form.setBehaviourButtonResetQuestions(ldata);
                $form.setBehaviourButtonCheckQuestions(ldata);
                if (addBtnAnswers) $form.setBehaviourButtonShowAnswers(ldata);
                $form.setBehaviourOptions(ldata);
                $form.hideScore(ldata.id);
                $form.setBehaviourTest(ldata);
                clearInterval(interval);
                if (ldata.showSlider) {
                    $form.addEventsSlideShow(ldata);
                }
            }
        }, 200);
        const $ideviceReference = $(`[id="${ldata.id}"]`);
        if (!$ideviceReference.length) return;
        const $showAnswersButton = $('#form-button-show-answers-' + ldata.id);
        if ($showAnswersButton.length) $showAnswersButton.hide();
        $('#frmMainContainer-' + ldata.id)
            .find('LI.FormView_question')
            .each((_, question) => {
                const $question = $(question);
                $question.removeAttr('draggable');
                const questionType = $question.attr('activity-type');
                const helpTexts = {
                    selection:
                        $question.attr('selection-type') === 'single'
                            ? ldata.msgs.msgSingleSelectionHelp
                            : ldata.msgs.msgMultipleSelectionHelp,
                    dropdown: ldata.msgs.msgDropdownHelp,
                    'true-false': ldata.msgs.msgTrueFalseHelp,
                    fill: ldata.msgs.msgFillHelp,
                };
                const helptext = helpTexts[questionType] || '';
                if (helptext) {
                    $question.prepend(
                        `<span class="inline-icon help-icon" title="${helptext}"></span>`
                    );
                }
            });
        // Add event handler for suggestion toggle
        $('#frmMainContainer-' + ldata.id).on(
            'click',
            '.FRMP-ShowSuggestion',
            function (e) {
                e.preventDefault();
                const $link = $(this);
                const $question = $link.closest('.FormView_question');
                const $suggestion = $question.find('.FRMP-Suggestion');
                const $icon = $link.find('.FRMP-SuggestionIcon');
                $suggestion.slideToggle('fast', function () {
                    if ($suggestion.is(':visible')) {
                        $icon.attr(
                            'src',
                            $icon
                                .attr('src')
                                .replace('showsuggestion', 'hidesuggestion')
                        );
                        $icon.attr('alt', ldata.msgs.msgHide || 'Ocultar');
                    } else {
                        $icon.attr(
                            'src',
                            $icon
                                .attr('src')
                                .replace('hidesuggestion', 'showsuggestion')
                        );
                        $icon.attr('alt', ldata.msgs.msgSuggestion);
                    }

                    if (ldata.showSlider) {
                        $form.resizeSlideShow(ldata);
                    }
                });
            }
        );
        const $buttonsContainer = $('#frmMainContainer-' + ldata.id).find(
            '.form-buttons-container'
        );
        if (!$('body').hasClass('exe-export'))
            $buttonsContainer.css('display', '');
        if (!$('html').is('#exe-index')) {
            this.scormAPIwrapper = '../libs/SCORM_API_wrapper.js';
            this.scormFunctions = '../libs/SCOFunctions.js';
        }

        if (
            document.body.classList.contains('exe-scorm') &&
            ldata.isScorm > 0
        ) {
            if (typeof window.scorm !== 'undefined' && window.scorm.init()) {
                $form.initScormData(ldata);
            } else {
                this.loadSCORM_API_wrapper(ldata);
            }
        } else if (ldata.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(ldata);
        }

        if (
            ldata.evaluation &&
            ldata.evaluationID &&
            ldata.evaluationID.length > 4
        ) {
            ldata.idevicePath = this.idevicePath;
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                ldata,
                this.isInExe
            );
        }

        const dataString = JSON.stringify(ldata);
        if ($exeDevices.iDevice.gamification.math.hasLatex(dataString)) {
            $exeDevices.iDevice.gamification.math.updateLatex('.form-IDevice');
        }
    },
    extractMediaElements: function (items) {
        if (!Array.isArray(items)) return '';
        const tmp = document.createElement('div');
        const mediaUrls = new Set();
        const fullElements = new Set();
        const extractFromHTML = (htmlContent) => {
            if (!htmlContent || typeof htmlContent !== 'string') return;
            tmp.innerHTML = htmlContent;
            tmp.querySelectorAll('img').forEach((el) => {
                fullElements.add(el.outerHTML);
                const src = el.getAttribute('src');
                if (
                    src &&
                    !src.startsWith('http://') &&
                    !src.startsWith('https://') &&
                    !src.startsWith('data:')
                ) {
                    mediaUrls.add(JSON.stringify({ type: 'img', url: src }));
                }
            });
            tmp.querySelectorAll('audio, video').forEach((el) => {
                fullElements.add(el.outerHTML);
                const src = el.getAttribute('src');
                if (
                    src &&
                    !src.startsWith('http://') &&
                    !src.startsWith('https://')
                ) {
                    mediaUrls.add(
                        JSON.stringify({
                            type: el.tagName.toLowerCase(),
                            url: src,
                        })
                    );
                }

                el.querySelectorAll('source').forEach((source) => {
                    const srcSource = source.getAttribute('src');
                    if (
                        srcSource &&
                        !srcSource.startsWith('http://') &&
                        !srcSource.startsWith('https://')
                    ) {
                        mediaUrls.add(
                            JSON.stringify({
                                type: el.tagName.toLowerCase(),
                                url: srcSource,
                            })
                        );
                    }
                });
            });
            tmp.querySelectorAll('a[href]').forEach((el) => {
                const href = el.getAttribute('href');
                if (
                    href &&
                    !href.startsWith('http://') &&
                    !href.startsWith('https://') &&
                    !href.startsWith('#') &&
                    !href.startsWith('mailto:')
                ) {
                    if (/\.[a-zA-Z0-9]{2,4}$/.test(href)) {
                        mediaUrls.add(
                            JSON.stringify({ type: 'file', url: href })
                        );
                    }
                }
            });
            tmp.innerHTML = '';
        };
        for (const question of items) {
            // Extract from baseText (all question types have this)
            extractFromHTML(question.baseText);
            // Extract from answers (for selection type questions)
            // answers is array of [isCorrect:boolean, text:string]
            if (question.answers && Array.isArray(question.answers)) {
                question.answers.forEach((answer) => {
                    if (Array.isArray(answer) && answer.length > 1) {
                        // answer[1] is the text
                        extractFromHTML(answer[1]);
                    }
                });
            }

            // Extract from feedbackRight and feedbackWrong (all question types can have these)
            extractFromHTML(question.feedbackRight);
            extractFromHTML(question.feedbackWrong);
            // Note: Other fields like wrongAnswersValue (dropdown), answer (true-false),
            // capitalization/strict (fill) don't contain HTML, so we don't need to process them
        }

        let hiddenLinks = '';
        const urlsArray = Array.from(mediaUrls).map((json) => JSON.parse(json));
        urlsArray.forEach((media, index) => {
            hiddenLinks += `<a href="${media.url}" class="js-hidden form-media-${media.type}">${index}</a>`;
        });
        // Combine full elements and hidden links
        const mediaHtml = `<div class="questionsMedia" style="display:none">${[...fullElements].join('')}${hiddenLinks}</div>`;
        return mediaHtml;
    },

    replaceResourceDirectoryPaths(data, htmlString) {
        const $node = $('#' + data.ideviceId);
        const isInExe = eXe.app.isInExe();
        if (isInExe || $node.length == 0) return htmlString;
        let dir = $('html').is('#exe-index')
            ? 'content/resources/' + data.ideviceId + '/'
            : '../content/resources/' + data.ideviceId + '/';
        const custom = $('html').is('#exe-index') ? 'custom/' : '../custom/';
        if (!dir.endsWith('/')) dir += '/';
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        doc.querySelectorAll(
            'img[src], video[src], audio[src], a[href]'
        ).forEach((el) => {
            const attr = el.hasAttribute('src') ? 'src' : 'href';
            let val = el.getAttribute(attr).trim();
            val = val.replace(/\\/g, '/').replace(/\/+/g, '/');
            let pathname = val;
            try {
                const baseURL =
                    window.location.origin === 'null' ||
                    window.location.protocol === 'file:'
                        ? window.location.href
                        : window.location.origin;
                const u = new URL(val, baseURL);
                pathname = u.pathname;
            } catch {
                pathname = val;
            }

            pathname = pathname.replace(/\\/g, '/').replace(/\/+/g, '/');
            if (/^\/?files\//.test(pathname)) {
                if (pathname.indexOf('file_manager') === -1) {
                    const filename = pathname.split('/').pop() || '';
                    el.setAttribute(attr, dir + filename);
                } else {
                    const fileManagerIndex = pathname.indexOf('file_manager/');
                    if (fileManagerIndex !== -1) {
                        const relativePath = pathname.substring(
                            fileManagerIndex + 'file_manager/'.length
                        );
                        el.setAttribute(attr, custom + relativePath);
                    } else {
                        const filename = pathname.split('/').pop() || '';
                        el.setAttribute(attr, custom + filename);
                    }
                }
            }
        });
        return doc.body.innerHTML;
    },

    addEventsSlideShow: function (data) {
        const mOptions = data;
        const instance = data.id;
        mOptions.current = 0;
        function clearPreviousMathInWrapper(wrapperEl) {
            if (!wrapperEl || typeof MathJax === 'undefined') return;
            try {
                if (typeof MathJax.typesetClear === 'function') {
                    MathJax.typesetClear([wrapperEl]);
                    return;
                }
            } catch (e) {}

            try {
                wrapperEl
                    .querySelectorAll('mjx-container')
                    .forEach(function (n) {
                        n.remove();
                    });
                wrapperEl
                    .querySelectorAll('span.MathJax, div.MathJax')
                    .forEach(function (n) {
                        n.remove();
                    });
            } catch (e) {}
        }
        if (mOptions.showSlider) {
            const $slideshow = $('#frmMainContainer-' + instance).find(
                '.FRMP-SlideshowContainer'
            );
            const $wrapper = $slideshow.find('.FRMP-SlideshowWrapper');
            const $slides = $wrapper.children();
            const total = $slides.length;
            if (total > 1) {
                $wrapper.css({ position: 'relative', overflow: 'hidden' });
                const firstHeight = $slides.eq(0).outerHeight(true);
                $wrapper.css('height', firstHeight);
                $slideshow.css(
                    'height',
                    firstHeight +
                        $slideshow
                            .find('.FRMP-SlideshowControls')
                            .outerHeight(true)
                );
                $slides
                    .css({
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                    })
                    .hide()
                    .eq(0)
                    .show();
                function goTo(index, direction) {
                    const nextIndex = (index + total) % total;
                    const $currentSlide = $slides.eq(mOptions.current);
                    const $nextSlide = $slides.eq(nextIndex);
                    if (direction === 'next') {
                        $currentSlide.animate(
                            { left: '-100%' },
                            200,
                            function () {
                                $(this).hide().css({ left: 0 });
                            }
                        );
                        $nextSlide
                            .css({ left: '100%' })
                            .show()
                            .animate({ left: 0 }, 200, function () {
                                const newH = $nextSlide.outerHeight(true);
                                $wrapper.animate({ height: newH }, 200);
                                $slideshow.animate(
                                    {
                                        height:
                                            newH +
                                            $slideshow
                                                .find('.FRMP-SlideshowControls')
                                                .outerHeight(true),
                                    },

                                    300
                                );
                            });
                    } else {
                        $currentSlide.animate(
                            { left: '100%' },
                            200,
                            function () {
                                $(this).hide().css({ left: 0 });
                            }
                        );
                        $nextSlide
                            .css({ left: '-100%' })
                            .show()
                            .animate({ left: 0 }, 200, function () {
                                const newH = $nextSlide.outerHeight(true);
                                $wrapper.animate({ height: newH }, 200);
                                $slideshow.animate(
                                    {
                                        height:
                                            newH +
                                            $slideshow
                                                .find('.FRMP-SlideshowControls')
                                                .outerHeight(true),
                                    },

                                    300
                                );
                            });
                    }

                    mOptions.current = nextIndex;
                    $slideshow
                        .find('#frmSlideNumber-' + instance)
                        .text(mOptions.current + 1 + '/' + total);
                    clearPreviousMathInWrapper($wrapper.get(0));
                    setTimeout(function () {
                        if (
                            $exeDevices?.iDevice?.gamification?.math
                                ?.updateLatex
                        )
                            $exeDevices.iDevice.gamification.math.updateLatex(
                                '.FRMP-SlideshowWrapper'
                            );
                    }, 1000);
                }

                $slideshow
                    .find('#frmNext-' + instance)
                    .on('click', function (e) {
                        e.preventDefault();
                        goTo(mOptions.current + 1, 'next');
                    });
                $slideshow
                    .find('#frmPrev-' + instance)
                    .on('click', function (e) {
                        e.preventDefault();
                        goTo(mOptions.current - 1, 'prev');
                    });
            } else if (total === 1) {
                clearPreviousMathInWrapper($wrapper.get(0));
                setTimeout(function () {
                    if ($exeDevices?.iDevice?.gamification?.math?.updateLatex)
                        $exeDevices.iDevice.gamification.math.updateLatex(
                            '.FRMP-SlideshowWrapper'
                        );
                }, 1000);
            }
        }
    },

    initScormData: function (ldata) {
        $form.mScorm = window.scorm;
        $form.userName = $exeDevices.iDevice.gamification.scorm.getUserName(
            $form.mScorm
        );
        $form.previousScore =
            $exeDevices.iDevice.gamification.scorm.getPreviousScore(
                $form.mScorm
            );
        if (typeof $form.mScorm.SetScoreMax === 'function') {
            $form.mScorm.SetScoreMax(100);
        } else {
            $form.mScorm.SetScoreMax(100);
        }

        if (typeof $form.mScorm.SetScoreMin === 'function') {
            $form.mScorm.SetScoreMin(0);
        } else {
            $form.mScorm.SetScoreMin(0);
        }

        $form.initialScore = $form.previousScore;
        $exeDevices.iDevice.gamification.scorm.registerActivity(ldata);
    },

    init: function (data, accesibility) {},

    updateTime: function (time, ideviceid) {
        $('#frmPTime-' + ideviceid).text(this.formatTime(time));
    },

    formatTime: function (timeInSeconds) {
        const totalMinutes = Math.floor(timeInSeconds / 60);
        const leftoverSeconds = timeInSeconds % 60;
        if (totalMinutes < 60) {
            const mm = String(totalMinutes).padStart(2, '0');
            const ss = String(leftoverSeconds).padStart(2, '0');
            return `${mm}:${ss}`;
        }

        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const hh = String(hours).padStart(2, '0');
        const mm = String(minutes).padStart(2, '0');
        const ss = String(leftoverSeconds).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    },

    startGame: function (data) {
        if (data.gameStarted) return;
        const checkButton = document.querySelector(
            `#form-button-check-${data.id}`
        );
        const rebootButton = document.querySelector(
            `#form-button-reset-${data.id}`
        );
        const showAnswers = document.querySelector(
            `#form-button-show-answers-${data.id}`
        );
        const body = document.querySelector(`#frmBody-${data.id}`);
        const startGameDiv = document.querySelector(
            `#frmStartGameDiv-${data.id}`
        );
        if (startGameDiv) startGameDiv.style.display = 'none';
        if (rebootButton) rebootButton.style.display = 'none';
        if (showAnswers) showAnswers.style.display = 'none';
        if (checkButton) checkButton.style.display = 'block';
        if (body) body.style.display = 'block';
        $form.resetScore(data);
        data.counter = data.time * 60;
        data.clock = setInterval(() => {
            if (data.gameStarted) {
                let $node = $('#frmMainContainer-' + data.id);
                let $content = $('#node-content');
                if (
                    !$node.length ||
                    ($content.length && $content.attr('mode') === 'edition')
                ) {
                    clearInterval(data.clock);
                    return;
                }

                data.counter--;
                $form.updateTime(data.counter, data.id);
                gameStarted = false;
                if (data.counter <= 0) {
                    $form.gameOver(data);
                }
            }
        }, 1000);
        $exeDevices.iDevice.gamification.math.updateLatex(
            '#frmMainContainer-' + data.id
        );
        setTimeout(function () {
            $form.resizeSlideShow(data);
        }, 100);
        data.gameStarted = true;
    },

    gameOver: function (data) {
        const checkButton = $(`#form-button-check-${data.id}`);
        const rebootButton = $(`#form-button-reset-${data.id}`);
        const showAnswers = $(`#form-button-show-answers-${data.id}`);
        const cover = $(`#frmCover-${data.id}`);
        if (cover.length) cover.show();
        if (checkButton.length) checkButton.hide();
        if (rebootButton.length) rebootButton.show();
        if (data.addBtnAnswers & showAnswers.length) showAnswers.show();
        data.gameOver = true;
        $form.checkAllQuestions(data);
        $form.showScore(50, data);
        if ($('body').hasClass('exe-scorm') && data.isScorm > 0) {
            $form.sendScore(data);
        }

        $form.saveEvaluation(data);
        if (data.time > 0) {
            $form.stopCounter(data);
            if (checkButton.length) checkButton.hide();
            data.gameStarted = false;
            data.gameOver = true;
        }
    },
    stopCounter: function (data) {
        if (data.clock) {
            clearInterval(data.clock);
        }
    },
    rebootGame(data) {
        this.resetScore(data);
        const $checkButton = $(`#form-button-check-${data.id}`);
        const $resetButton = $(`#form-button-reset-${data.id}`);
        const $showAnswers = $(`#form-button-show-answers-${data.id}`);
        const $cover = $(`#frmCover-${data.id}`);
        const $formPreview = $(`#form-questions-${data.id}`);
        const toggle = ($el, show) => {
            if ($el.length) show ? $el.show() : $el.hide();
        };
        if ($cover.length) $cover.hide();
        toggle($checkButton, true);
        toggle($resetButton, false);
        toggle($showAnswers, false);
        $formPreview.find('input.fillInput').css('border-color', '').val('');
        $formPreview
            .find(
                '[id^=TrueFalseQuestion] input, [id^=SelectionQuestion] input'
            )
            .prop('checked', false)
            .parent()
            .css('color', '');
        $formPreview.find('select').css('border-color', '').val('');
        // Remove feedback messages
        $formPreview.find('.form-feedback-message').remove();
        // Hide all suggestions
        $formPreview.find('.FRMP-Suggestion').hide();
        // Reset suggestion icons to show state
        $formPreview.find('.FRMP-SuggestionIcon').each(function () {
            const $icon = $(this);
            const src = $icon.attr('src');
            if (src && src.includes('hidesuggestion')) {
                $icon.attr(
                    'src',
                    src.replace('hidesuggestion', 'showsuggestion')
                );
                $icon.attr('alt', data.msgs.msgSuggestion);
            }
        });
        $form.hideScore(data.id);
        data.gameStarted = false;
        data.gameOver = false;
        if (data.time > 0) {
            toggle($resetButton, false);
            toggle($showAnswers, false);
            $form.startGame(data);
        }
    },
    saveEvaluation: function (data) {
        data.scorerp = (data.rightQuestions * 10) / data.totalQuestions;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            data,
            data.isInExe
        );
    },

    sendScore: function (data) {
        data.scorerp = (data.rightQuestions * 10) / data.totalQuestions;
        data.previousScore = $form.previousScore;
        data.userName = $form.userName;
        $exeDevices.iDevice.gamification.scorm.sendScoreNew(true, data);
        $form.previousScore = data.previousScore;
    },

    generatePage(questionsData, data) {
        let form = `<ul id="formPreview-${data.id}" class="FRMP-PREVIEW">`;
        questionsData.forEach((question, index) => {
            switch (question.activityType) {
                case 'dropdown':
                    form += this.createDropdownQuestion(question, data, index);
                    break;
                case 'selection':
                    form += this.createSelectionQuestion(question, data, index);
                    break;
                case 'true-false':
                    form += this.createTrueFalseQuestion(question, data, index);
                    break;
                case 'fill':
                    form += this.createFillQuestion(question, data, index);
                    break;
                default:
                    break;
            }
        });
        form += '</ul>';
        return form;
    },

    getHtmlFormView: function (questionsData, data) {
        const html = data.showSlider
            ? $form.generateFormSlideshow(questionsData, data)
            : $form.generatePage(questionsData, data);
        return html;
    },

    generateFormSlideshow: function (questionsData, data) {
        const itemsPerSlide = data.showSlider ? 1 : 0;
        if (typeof itemsPerSlide !== 'number' || itemsPerSlide < 1) {
            return this.generatePage(questionsData, data);
        }

        const grouped = [];
        for (let i = 0; i < questionsData.length; i += itemsPerSlide) {
            grouped.push({
                questions: questionsData.slice(i, i + itemsPerSlide),
                startIndex: i,
            });
        }

        const slidesHtml = grouped
            .map((group, slideIdx) => {
                let questionsHtml = `<ul class="FRMP-PREVIEW">`;
                group.questions.forEach((question, relativeIndex) => {
                    const absoluteIndex = group.startIndex + relativeIndex;
                    switch (question.activityType) {
                        case 'dropdown':
                            questionsHtml += this.createDropdownQuestion(
                                question,
                                data,
                                absoluteIndex
                            );
                            break;
                        case 'selection':
                            questionsHtml += this.createSelectionQuestion(
                                question,
                                data,
                                absoluteIndex
                            );
                            break;
                        case 'true-false':
                            questionsHtml += this.createTrueFalseQuestion(
                                question,
                                data,
                                absoluteIndex
                            );
                            break;
                        case 'fill':
                            questionsHtml += this.createFillQuestion(
                                question,
                                data,
                                absoluteIndex
                            );
                            break;
                        default:
                            break;
                    }
                });
                questionsHtml += `</ul>`;
                return `
              <div class="FRMP-SlideshowSlide" data-slide="${slideIdx}">
                ${questionsHtml}
              </div>`;
            })
            .join('');
        const totalSlides = grouped.length;
        return `
            <div class="FRMP-SlideshowContainer" id="frmSlideShow-${data.id}">
                <div class="FRMP-SlideshowControls">
                    <a href="#" class="FRMP-SlideshowPrev FRMP-SlideshowControl" id="frmPrev-${data.id}" title="${data.msgs.msgPrevious}">
                        <img src="${data.idevicePath}formprevious.png" alt="${data.msgs.msgPrevious}" />
                    </a>
                    <span class="FRMP-SlideNumber" id="frmSlideNumber-${data.id}">1/${totalSlides}</span>
                    <a href="#" class="FRMP-SlideshowNext FRMP-SlideshowControl" id="frmNext-${data.id}" title="${data.msgs.msgNext}">
                        <img src="${data.idevicePath}formnext.png" alt="${data.msgs.msgNext}" />
                    </a>
                </div>
                <div class="FRMP-SlideshowWrapper">
                    ${slidesHtml}
                </div>
            </div>
        `;
    },

    resizeSlideShow: function (data) {
        const mOptions = data;
        const instance = data.id;
        if (mOptions.showSlider) {
            const $slideshow = $('#frmSlideShow-' + instance);
            const $wrapper = $slideshow.find('.FRMP-SlideshowWrapper');
            const controlsHeight =
                $slideshow.find('.FRMP-SlideshowControls').outerHeight(true) +
                30;
            const maxHeight = $slideshow
                .find('.FRMP-SlideshowSlide')
                .eq(mOptions.current)
                .outerHeight();
            $wrapper.css('height', maxHeight);
            $slideshow.css('height', maxHeight + controlsHeight);
        }
    },
    getSuggestionHtml(suggestion, data) {
        if (!suggestion || !suggestion.trim()) {
            return '';
        }

        const suggestionHtml = $form.replaceResourceDirectoryPaths(
            data,
            suggestion
        );
        return `
            <a href="#" class="FRMP-ShowSuggestion">
                <img src="${data.idevicePath}frmshowsuggestion.png" alt="${data.msgs.msgSuggestion}" class="FRMP-SuggestionIcon">
                <span>${data.msgs.msgSuggestion}</span>
            </a>
            <div class="FRMP-Suggestion FRMP-EHidden">${suggestionHtml}</div>
        `;
    },

    /**
     * Transform json data in html dropdown question
     *
     * @param {Object} question
     *
     * @returns {String}
     */
    createDropdownQuestion(question, data, questionIndex) {
        let newId = this.generateRandomId();
        let htmlQuestion = '';
        htmlQuestion += `<li class="FormView_dropdown FormView_question" data-id="${newId}" data-question-index="${questionIndex}" activity-type="dropdown" draggable="true">
        <div id="questionTopBar_${newId}">
          <label class="activity-title">Activity dropdown</label>
          <div class="inline QuestionLabel_ButtonsContainer">
            <button class="QuestionLabel_moveUp QuestionLabel_actionButton">arrow_upward</button>
            <button class="QuestionLabel_moveDown QuestionLabel_actionButton">arrow_downward</button>
            <button class="QuestionLabel_edit QuestionLabel_actionButton">edit</button>
            <button class="QuestionLabel_remove QuestionLabel_actionButton">close</button>
          </div>
        </div>
        <div id="QuestionElement_${newId}" class="FormViewContainer_dropdown FormViewContainer">`;
        htmlQuestion += this.getProcessTextDropdownQuestion(
            question.baseText,
            question.wrongAnswersValue,
            data
        );
        htmlQuestion += this.getSuggestionHtml(question.suggestion, data);
        htmlQuestion += ` </div> <hr class="form-question-separator" /> </li> `;
        return htmlQuestion;
    },

    /**
     * Transform json data in html fill question
     *
     * @param {Object} question
     *
     * @returns {String}
     */
    createFillQuestion(question, data, questionIndex) {
        let newId = this.generateRandomId();
        let htmlQuestion = '';
        htmlQuestion += `<li class="FormView_fill FormView_question" data-id="${newId}" data-question-index="${questionIndex}" activity-type="fill" draggable="true">
            <div id="questionTopBar_${newId}">
                <label class="activity-title">Activity fill</label>
                <div class="inline QuestionLabel_ButtonsContainer">
                <button class="QuestionLabel_moveUp QuestionLabel_actionButton">arrow_upward</button>
                <button class="QuestionLabel_moveDown QuestionLabel_actionButton">arrow_downward</button>
                <button class="QuestionLabel_edit QuestionLabel_actionButton">edit</button>
                <button class="QuestionLabel_remove QuestionLabel_actionButton">close</button>
                </div>
            </div>
            <div id="QuestionElement_${newId}" class="FormViewContainer_fill FormViewContainer">`;
        htmlQuestion += this.getProcessTextFillQuestion(
            question.baseText,
            question.capitalization,
            question.strict,
            data
        );
        htmlQuestion += this.getSuggestionHtml(question.suggestion, data);
        htmlQuestion += `</div> <hr class="form-question-separator" /> </li>`;
        return htmlQuestion;
    },

    /**
     * Transform json data in html true false question
     *
     * @param {Object} question
     *
     * @returns {String}
     */
    createTrueFalseQuestion(question, data, questionIndex) {
        const newId = this.generateRandomId();
        let htmlQuestion = '';
        htmlQuestion += `<li class="FormView_true-false FormView_question" data-id="${newId}" data-question-index="${questionIndex}" activity-type="true-false" draggable="true">
        <div id="questionTopBar_${newId}">
          <label class="activity-title">Activity true-false</label>
          <div class="inline QuestionLabel_ButtonsContainer">
            <button class="QuestionLabel_moveUp QuestionLabel_actionButton" disabled="true">arrow_upward</button>
            <button class="QuestionLabel_moveDown QuestionLabel_actionButton">arrow_downward</button>
            <button class="QuestionLabel_edit QuestionLabel_actionButton">edit</button>
            <button class="QuestionLabel_remove QuestionLabel_actionButton">close</button>
          </div>
        </div>
        <div id="QuestionElement_${newId}" class="FormViewContainer_true-false FormViewContainer"> `;
        htmlQuestion += this.getProcessTextTrueFalseQuestion(
            question.baseText,
            question.answer,
            data
        );
        htmlQuestion += this.getSuggestionHtml(question.suggestion, data);
        htmlQuestion += `</div> <hr class="form-question-separator" /> </li>`;
        return htmlQuestion;
    },

    /**
     * Transform json data in html selection question
     *
     * @param {Object} question
     *
     * @returns {String}
     */
    createSelectionQuestion(question, data, questionIndex) {
        const newId = this.generateRandomId();
        let htmlQuestion = '';
        let radioOrCheckbox = 'radio';
        if (question.selectionType === 'multiple') {
            radioOrCheckbox = 'checkbox';
        }

        htmlQuestion += `<li class="FormView_selection FormView_question" data-id="${newId}" data-question-index="${questionIndex}" activity-type="selection" selection-type="${question.selectionType}" draggable="true">
                <div id="questionTopBar_${newId}">
                <label class="activity-title">Activity ${question.selectionType} selection</label>
                <div class="inline QuestionLabel_ButtonsContainer">
                    <button class="QuestionLabel_moveUp QuestionLabel_actionButton">arrow_upward</button>
                    <button class="QuestionLabel_moveDown QuestionLabel_actionButton">arrow_downward</button>
                    <button class="QuestionLabel_edit QuestionLabel_actionButton">edit</button>
                    <button class="QuestionLabel_remove QuestionLabel_actionButton">close</button>
                </div>
                </div>
                <div id="QuestionElement_${newId}" class="FormViewContainer_selection FormViewContainer">`;
        htmlQuestion += this.getProcessTextSelectionQuestion(
            question.baseText,
            radioOrCheckbox,
            question.answers,
            data
        );
        htmlQuestion += this.getSuggestionHtml(question.suggestion, data);
        htmlQuestion += `</div> <hr class="form-question-separator" /> </li>`;
        return htmlQuestion;
    },

    getProcessTextDropdownQuestion(baseText, otherWordsText, data) {
        baseText = $form.replaceResourceDirectoryPaths(data, baseText);
        let regexReplace = /(<u>)((?:(?!<u>|<\/u>)[\s\S])*?)(<\/u>)/;
        let regexElement = /(?<=<u>)((?:(?!<u>|<\/u>)[\s\S])*?)(?=<\/u>)/;
        let regexElementsAll = /(?<=<u>)((?:(?!<u>|<\/u>)[\s\S])*?)(?=<\/u>)/g;
        let otherWords = otherWordsText ? otherWordsText.split('|') : [];
        let allMatchs = [...baseText.matchAll(regexElementsAll)];
        let allOptions = allMatchs.map((m) => m[0]).concat(otherWords);
        let allOptionsShuffle = this.shuffle(allOptions);
        let selectId = this.generateRandomId();
        let htmlDropdown = `<div title="${data.msgs.msgDropdownHelp}">`;
        htmlDropdown += baseText;
        htmlDropdown += `</div>`;
        while (htmlDropdown.search(regexReplace) >= 0) {
            selectId = this.generateRandomId();
            let answerString = htmlDropdown.match(regexElement);
            let answer = answerString ? answerString[0] : '';
            htmlDropdown = htmlDropdown.replace(
                regexReplace,
                this.getSelectDropdownQuestion(
                    selectId,
                    allOptionsShuffle,
                    answer
                )
            );
        }

        selectId = this.generateRandomId();
        if (!htmlDropdown.includes('dropdownWrongAnswer')) {
            htmlDropdown += `<span id="dropdownWrongAnswer_${selectId}" class="dropdownWrongAnswer" style="display:none">${otherWordsText}</span>`;
        } else {
            let oldWrongAnswers = new RegExp(
                '<span id="dropdownWrongAnswer[^>]*>[^<]+<\/span>'
            );
            let newWrongAnswers = `<span id="dropdownWrongAnswer_${selectId}" class="dropdownWrongAnswer" style="display:none">${otherWordsText}</span>`;
            htmlDropdown = htmlDropdown.replace(
                oldWrongAnswers,
                newWrongAnswers
            );
        }

        if (!htmlDropdown.includes('dropdownBaseText')) {
            htmlDropdown += `<div id="dropdownBaseText_${selectId}" class="dropdownBaseText" style="display:none">${baseText}</div>`;
        } else {
            let oldBaseText = new RegExp(
                '<div id="dropdownBaseText[^>]*>[^<]+<\/div>'
            );
            let newBaseText = `<div id="dropdownBaseText_${selectId}" class="dropdownBaseText" style="display:none">${baseText}</div>`;
            htmlDropdown = htmlDropdown.replace(oldBaseText, newBaseText);
        }

        return htmlDropdown;
    },

    getSelectDropdownQuestion(id, options, answer) {
        const optionsHtml = options
            .map((option) => `<option value="${option}">${option}</option>`)
            .join('');
        return ` <select id="dropdownSelect_${id}" class="dropdownSelect" data-id="${id}" name="dropdownSelector">
            <option value="" selected></option> ${optionsHtml}</select>
            <span id="dropdownAnswer_${id}" class="dropdownAnswer" style="display:none">${answer}</span>
        `;
    },

    /**
     * Processes text for fill-in-the-blank questions
     *
     * @param {*} baseText
     * @param {*} checkCapitalization
     * @param {*} strictQualification
     * @returns {String}
     */
    getProcessTextFillQuestion(
        baseText,
        checkCapitalization,
        strictQualification,
        data
    ) {
        baseText = $form.replaceResourceDirectoryPaths(data, baseText);
        const regexReplace = /(<u>).*?(<\/u>)/;
        const regexElement = /(?<=<u>).*?(?=<\/u>)/;
        let htmlFill = `<div title="${data.msgs.msgFillHelp}">${baseText}</div>`;
        while (htmlFill.search(regexReplace) >= 0) {
            const answerString =
                htmlFill.match(regexElement)?.[0]?.trim() || '';
            const inputId = this.generateRandomId();
            htmlFill = htmlFill.replace(
                regexReplace,
                `<input id="fillInput_${inputId}" type="text" data-id="${inputId}" class="fillInput" />
          <span id="fillAnswer_${inputId}" class="fillAnswer" style="display:none;">${answerString}</span>`
            );
        }

        const fillIds = `<span id="fillCapitalization_${this.generateRandomId()}" style="display:none;">${checkCapitalization}</span>
      <span id="fillStrictQualification_${this.generateRandomId()}" style="display:none;">${strictQualification}</span>`;
        if (!htmlFill.includes('fillBaseText')) {
            htmlFill += `<div id="fillBaseText_${this.generateRandomId()}" class="fillBaseText" style="display:none">${baseText}</div>`;
        } else {
            const newBaseText = ` <div id="fillBaseText_${this.generateRandomId()}" class="fillBaseText" style="display:none">${baseText}</div>`;
            htmlFill = htmlFill.replace(
                /<div id="fillBaseText[^>]*>[^<]+<\/div>/,
                newBaseText
            );
        }

        return htmlFill + fillIds;
    },

    /**
     * Processes text for selection questions
     *
     * @param {*} baseText
     * @param {*} optionType
     * @param {*} answer
     * @returns {String}
     */
    getProcessTextSelectionQuestion(baseText, optionType, answer, data) {
        baseText = $form.replaceResourceDirectoryPaths(data, baseText);
        let id = this.generateRandomId();
        let stringTitle;
        optionType === 'radio'
            ? (stringTitle = data.msgs.msgSingleSelectionHelp)
            : (stringTitle = data.msgs.msgMultipleSelectionHelp);
        let htmlSelection = `<div title="${stringTitle}">`;
        htmlSelection += baseText.replace(/<p>\s*(<br\s*\/?>)?\s*<\/p>/gi, '');
        htmlSelection += `</div>`;
        let rightAnswer = [];
        htmlSelection += `<div id="SelectionQuestion_${id}" data-id="${id}" class="selection-buttons-container">`;
        answer.forEach((option, index) => {
            htmlSelection += `<div class="inline button-response-form">`;
            htmlSelection += `<input type="${optionType}" name="${id}_SelectionQuestion" id="${id}_option_${index + 1}" value="${option[1]}">`;
            htmlSelection += `<label for="${id}_option_${index + 1}">`;
            htmlSelection += option[1];
            htmlSelection += `</label>`;
            htmlSelection += `</div>`;
            if (option[0]) {
                rightAnswer.push(index);
            }
        });
        htmlSelection += `<span id="SelectionAnswer_${id}" class="selectionAnswer" style="display:none;">${rightAnswer}</span>`;
        htmlSelection += `</div>`;
        return htmlSelection;
    },

    /**
     * Processes text for true/false questions
     *
     * @param {*} baseText
     * @param {*} answer
     * @param {*} data
     * @returns {String}
     */
    getProcessTextTrueFalseQuestion(baseText, answer, data) {
        baseText = $form.replaceResourceDirectoryPaths(data, baseText);
        let id = this.generateRandomId();
        let htmlTrueFalse = `<div title="${data.msgs.msgTrueFalseHelp}">`;
        htmlTrueFalse += baseText.replace(/<p>\s*(<br\s*\/?>)?\s*<\/p>/gi, '');
        htmlTrueFalse += `</div>`;
        htmlTrueFalse += `<div id="TrueFalseQuestion_${id}" data-id="${id}" class="true-false-radio-buttons-container inline" data-answer="${answer}" >`;
        htmlTrueFalse += `<div class="inline">`;
        htmlTrueFalse += `<input type="radio" name="${id}_TrueFalseQuestion" id="${id}_true" value="1">`;
        htmlTrueFalse += `<label for="${id}_true">`;
        htmlTrueFalse += data.msgs.msgTrue;
        htmlTrueFalse += `</label>`;
        htmlTrueFalse += `</div>`;
        htmlTrueFalse += `<div class="inline">`;
        htmlTrueFalse += `<input type="radio" name="${id}_TrueFalseQuestion" id="${id}_false" value="0">`;
        htmlTrueFalse += `<label for="${id}_false">`;
        htmlTrueFalse += data.msgs.msgFalse;
        htmlTrueFalse += `</label>`;
        htmlTrueFalse += `</div>`;
        htmlTrueFalse += `<span id="TrueFalseAnswer_${id}" class="trueFalseAnswer" style="display:none;">${answer}</span>`;
        htmlTrueFalse += `</div>`;
        return htmlTrueFalse;
    },

    shuffle(a) {
        let j, x, i;
        for (i = a.length - 1; i > 0; i--) {
            j = Math.floor(Math.random() * (i + 1));
            x = a[i];
            a[i] = a[j];
            a[j] = x;
        }

        return a;
    },

    generateRandomId: function () {
        const letters = Math.random()
            .toString(36)
            .substring(2, 7)
            .toUpperCase();
        return `${Date.now()}-${letters}`;
    },

    hideScore: function (ideviceId) {
        const $resultTest = $('#form-result-test-' + ideviceId);
        const $scoreText = $('#form-score-' + ideviceId);
        const $resultsContainer = $('#resultsContainer-' + ideviceId);
        if ($resultTest.length) {
            $resultTest.hide();
        }

        if ($scoreText.length) {
            $scoreText.hide();
        }

        if ($resultsContainer.length) {
            $resultsContainer.hide();
        }
    },
    showScore: function (passRate, data) {
        const $resultTest = $('#form-result-test-' + data.id);
        const $scoreTest = $('#form-score-' + data.id);
        const $resultsContainer = $('#resultsContainer-' + data.id);
        if (passRate) {
            $resultTest.show();
            $scoreTest.show();
            $scoreTest
                .removeClass('number-score-alone')
                .addClass('number-score');
            const isPass =
                (data.rightQuestions / data.totalQuestions) * 100 >=
                parseInt(passRate, 10);
            $resultTest
                .text(
                    isPass
                        ? data.msgs.msgTestResultPass
                        : data.msgs.msgTestResultNotPass
                )
                .toggleClass('pass-test', isPass)
                .toggleClass('fail-test', !isPass);
            $scoreTest
                .toggleClass('pass-test', isPass)
                .toggleClass('fail-test', !isPass);
        } else {
            $scoreTest.show();
            $scoreTest
                .removeClass('number-score')
                .addClass('number-score-alone');
        }

        const score = (data.rightQuestions * 10) / data.totalQuestions;
        let finalScore = score % 1 === 0 ? score : score.toFixed(2);
        const scoreText = `${data.msgs.msgYouScore} ${finalScore} (${data.rightQuestions}/${data.totalQuestions})`;
        $scoreTest.text(scoreText);
        $resultsContainer.show();
    },

    resetScore: function (data) {
        data.totalQuestions = 0;
        data.rightQuestions = 0;
        data.wrongQuestions = 0;
    },

    setBehaviourTest: function (data) {
        const $startGame = $('#frmStartGame-' + data.id);
        if (!$startGame.length) return;
        $startGame.on('click', function () {
            $form.startGame(data);
        });
    },

    setBehaviourOptions: function (data) {
        const $formPreview = $('#formPreview-' + data.id);
        if (!$formPreview.length) return;
        $formPreview.find('input').on('click', function () {
            const $input = $(this);
            if ($input.hasClass('fillInput')) {
                $input.css('backgroundColor', '');
            } else if ($input.attr('name').includes('TrueFalseQuestion')) {
                $input
                    .closest('[id^=TrueFalseQuestion]')
                    .find('input')
                    .each(function () {
                        $(this).parent().css('backgroundColor', '');
                    });
            } else if ($input.attr('name').includes('SelectionQuestion')) {
                $input
                    .closest('[id^=SelectionQuestion]')
                    .find('input')
                    .each(function () {
                        $(this).parent().css('backgroundColor', '');
                    });
            }

            $form.hideScore(data.id);
        });
        $formPreview.find('select').on('click', function () {
            $(this).css('backgroundColor', '');
            $form.hideScore(data.id);
        });
    },

    setBehaviourButtonResetQuestions: function (data) {
        const $resetButton = $('#form-button-reset-' + data.id);
        if (!$resetButton.length) return;
        $resetButton.on('click', function () {
            $resetButton.hide();
            $form.rebootGame(data);
            return;
        });
    },

    setBehaviourButtonShowAnswers(data) {
        const $btn = $(`#form-button-show-answers-${data.id}`);
        if (!$btn.length) return;
        const $formPreview = $(`#form-questions-${data.id}`);
        const showFillInput = ($input) => {
            $input.css('border-color', '').val($input.next().text());
        };
        const showTrueFalse = ($container) => {
            const answer = parseInt($container.data('answer'), 10);
            $container.find('input').each(function () {
                const $opt = $(this);
                const val = parseInt($opt.val(), 10);
                $opt.prop('checked', val === answer)
                    .parent()
                    .css('color', '');
            });
        };
        const showSelection = ($container) => {
            const answers = $container
                .find('[id^=SelectionAnswer]')
                .text()
                .split(',');
            $container.find('input').each(function (i) {
                const $opt = $(this);
                const checked = answers.includes(i.toString());
                $opt.prop('checked', checked).parent().css('color', '');
            });
        };
        $btn.on('click', () => {
            $formPreview.find('input').each(function () {
                const $inp = $(this);
                if ($inp.hasClass('fillInput')) {
                    showFillInput($inp);
                } else if ($inp.attr('name').includes('TrueFalseQuestion')) {
                    showTrueFalse($inp.closest('[id^=TrueFalseQuestion_]'));
                } else if ($inp.attr('name').includes('SelectionQuestion')) {
                    showSelection($inp.closest('[id^=SelectionQuestion]'));
                }
            });
            $formPreview.find('select.dropdownSelect').each(function () {
                const $sel = $(this);
                const selectId = $sel.data('id');
                const correctAnswer = $(
                    `#dropdownAnswer_${selectId}`,
                    $formPreview
                ).text();
                $sel.css('backgroundColor', '').val(correctAnswer);
            });
            // Ocultar puntuación si es necesario
            // this.hideScore(data.id);
        });
    },

    setBehaviourButtonCheckQuestions: function (data) {
        const $checkButton = $('#form-button-check-' + data.id);
        if (!$checkButton.length) return;
        $checkButton.on('click', function () {
            $form.gameOver(data);
        });
    },

    /*
     * @param {*} ideviceId
     */
    checkAllQuestions: function (data) {
        this.resetScore(data);
        $('#frmMainContainer-' + data.id)
            .find('.FormView_question')
            .each((_, question) => {
                $form.checkQuestion($(question), data);
            });
    },

    checkQuestion: function ($question, data) {
        const typeQuestion = $question.attr('activity-type');
        const questionIndex = parseInt(
            $question.attr('data-question-index'),
            10
        );
        const questionData =
            data.questionsData && data.questionsData[questionIndex];
        const checkFunctions = {
            dropdown: () =>
                $form.checkQuestionDropdown($question, data, questionData),
            selection: () =>
                $form.checkQuestionSelection($question, data, questionData),
            'true-false': () =>
                $form.checkQuestionTrueFalse($question, data, questionData),
            fill: () => $form.checkQuestionFill($question, data, questionData),
        };
        if (checkFunctions[typeQuestion]) {
            checkFunctions[typeQuestion]();
        }
    },
    /**
     *
     * @param {*} question
     */
    checkQuestionDropdown: function ($question, data, questionData) {
        data.totalQuestions++;
        let correctWords = 0;
        $question.find('.dropdownSelect').each((_, select) => {
            const $select = $(select);
            const questionId = $select.data('id');
            const answerValue = $(`#dropdownAnswer_${questionId}`, $question)
                .text()
                .trim();
            const selectedValue = $select.val() ? $select.val().trim() : '';
            if (selectedValue && selectedValue === answerValue) {
                correctWords++;
            }
        });
        const isCorrect =
            correctWords === $question.find('.dropdownSelect').length;
        if (isCorrect) {
            data.rightQuestions++;
        } else {
            data.wrongQuestions++;
        }

        // Show feedback
        if (questionData) {
            $form.showFeedback($question, isCorrect, questionData, data);
        }
    },
    /**
     *
     * @param {*} question
     */
    checkQuestionSelection: function ($question, data, questionData) {
        data.totalQuestions++;
        const questionId = $question
            .find('[id^=SelectionQuestion_]')
            .data('id');
        const answersValues = [];
        let somethingChecked = false;
        $question
            .find(`input[name="${questionId}_SelectionQuestion"]`)
            .each((_, answer) => {
                const $answer = $(answer);
                if ($answer.is(':checked')) {
                    answersValues.push(true);
                    somethingChecked = true;
                } else {
                    answersValues.push(false);
                }
            });
        const answerElement = $(`#SelectionAnswer_${questionId}`, $question)
            .text()
            .split(',');
        const results = answersValues.map((value, index) =>
            answerElement.includes(index.toString()) ? value : !value
        );
        const isCorrect = results.every((result) => result);
        if (isCorrect) {
            data.rightQuestions++;
        } else {
            data.wrongQuestions++;
        }

        // Show feedback
        if (questionData) {
            $form.showFeedback($question, isCorrect, questionData, data);
        }
    },
    /**
     *
     * @param {*} question
     */
    checkQuestionTrueFalse: function ($question, data, questionData) {
        data.totalQuestions++;
        const questionId = $question
            .find('[id^=TrueFalseQuestion_]')
            .data('id');
        const $answers = $question.find(
            `input[name="${questionId}_TrueFalseQuestion"]`
        );
        const $answerChecked = $question.find(
            `input[name="${questionId}_TrueFalseQuestion"]:checked`
        );
        const answerValueRaw = $question
            .find('[id^=TrueFalseQuestion_]')
            .data('answer');
        let isCorrect = false;
        if ($answerChecked.length) {
            const selectedBool = Boolean(parseInt($answerChecked.val(), 10));
            const correctBool = Boolean(Number(answerValueRaw));
            if (selectedBool === correctBool) {
                data.rightQuestions++;
                isCorrect = true;
            } else {
                data.wrongQuestions++;
            }
        } else {
            data.wrongQuestions++;
        }

        if (questionData) {
            $form.showFeedback($question, isCorrect, questionData, data);
        }
    },
    checkQuestionFill: function ($question, data, questionData) {
        data.totalQuestions++;
        const checkCapitalization =
            $question.find('[id^="fillCapitalization"]').text() === 'true';
        const strictQualification =
            $question.find('[id^="fillStrictQualification"]').text() === 'true';
        let correctWords = 0;
        function levenshtein(a, b) {
            const m = a.length;
            const n = b.length;
            const dp = Array.from({ length: m + 1 }, () => new Array(n + 1));
            for (let i = 0; i <= m; i++) {
                dp[i][0] = i;
            }

            for (let j = 0; j <= n; j++) {
                dp[0][j] = j;
            }

            for (let i = 1; i <= m; i++) {
                for (let j = 1; j <= n; j++) {
                    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                    dp[i][j] = Math.min(
                        dp[i - 1][j] + 1,
                        dp[i][j - 1] + 1,
                        dp[i - 1][j - 1] + cost
                    );
                }
            }
            return dp[m][n];
        }

        $question.find('.fillInput').each((_, input) => {
            const $input = $(input);
            const questionId = $input.data('id');
            const answerValues = $(`#fillAnswer_${questionId}`, $question)
                .text()
                .split('|');
            const userValueRaw = $input.val().trim();
            let isCorrect = false;
            for (let answerRaw of answerValues) {
                let answer = answerRaw;
                let userValue = userValueRaw;
                if (!checkCapitalization) {
                    answer = answer.toLowerCase();
                    userValue = userValue.toLowerCase();
                }

                if (strictQualification) {
                    if (answer === userValue) {
                        isCorrect = true;
                        break;
                    }
                } else {
                    if (levenshtein(answer, userValue) <= 1) {
                        isCorrect = true;
                        break;
                    }
                }
            }

            if (isCorrect) {
                correctWords++;
            }
        });
        const isAllCorrect =
            correctWords === $question.find('.fillInput').length;
        if (isAllCorrect) {
            data.rightQuestions++;
        } else {
            data.wrongQuestions++;
        }

        if (questionData) {
            $form.showFeedback($question, isAllCorrect, questionData, data);
        }
    },
    compare2Words: function (word1, word2) {
        if (word1.length !== word2.length) return false;
        const differences = [...word1].filter(
            (letter, index) => letter !== word2[index]
        ).length;
        return differences <= 1;
    },

    showFeedback: function ($question, isCorrect, questionData, data) {
        $question.find('.form-feedback-message').remove();
        let feedbackText = isCorrect
            ? questionData.feedbackRight
            : questionData.feedbackWrong;
        if (!feedbackText || feedbackText.trim() === '') {
            feedbackText = isCorrect ? data.msgs.msgOk : data.msgs.msgKO;
        }

        // Create the feedback div with appropriate styling
        const feedbackClass = isCorrect
            ? 'form-feedback-correct'
            : 'form-feedback-wrong';
        const feedbackHtml = `
            <div class="form-feedback-message ${feedbackClass}">
                ${feedbackText}
            </div>
        `;
        $question.find('.FormViewContainer').after(feedbackHtml);

        if (data.showSlider) {
            setTimeout(function () {
                $form.resizeSlideShow(data);
            }, 50);
        }
    },

    loadSCORM_API_wrapper: function (data) {
        let parsedData = typeof data === 'string' ? JSON.parse(data) : data;
        if (typeof pipwerks === 'undefined') {
            const escapedData = $form.escapeForCallback(parsedData);
            eXe.app.loadScript(
                this.scormAPIwrapper,
                '$form.loadSCOFunctions("' + escapedData + '")'
            );
        } else {
            this.loadSCOFunctions(parsedData);
        }
    },
    escapeForCallback: function (obj) {
        let json = JSON.stringify(obj);
        json = json.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return json;
    },

    loadSCOFunctions: function (data) {
        let parsedData = typeof data === 'string' ? JSON.parse(data) : data;
        if (typeof scorm === 'undefined') {
            const escapedData = $form.escapeForCallback(parsedData);
            eXe.app.loadScript(
                this.scormFunctions,
                '$form.initSCORM("' + escapedData + '")'
            );
        } else {
            this.initSCORM(parsedData);
        }
    },
    initSCORM: function (ldata) {
        let parsedData = typeof ldata === 'string' ? JSON.parse(ldata) : ldata;
        $form.mScorm = scorm;
        if ($form.mScorm.init()) {
            $form.initScormData(parsedData);
        }
    },
    endScorm: function () {
        if ($form.mScorm && typeof $form.mScorm.quit == 'function') {
        }
    },
};
