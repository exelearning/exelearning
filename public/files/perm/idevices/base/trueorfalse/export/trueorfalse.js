/* eslint-disable no-undef */
/**
 * True or false iDevice (export code)
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $trueorfalse = {
    borderColors: {
        black: '#1c1b1b',
        blue: '#5877c6',
        green: '#00a300',
        red: '#ff0000',
        white: '#f9f9f9',
        yellow: '#f3d55a',
        grey: '#777777',
        incorrect: '#d9d9d9',
        correct: '#00ff00',
    },
    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',
    userName: '',
    previousScore: '',
    initialScore: '',
    mScorm: null,

    init: function () {},

    renderView: function (data, accesibility, template, ideviceId) {
        if (!data || typeof data !== 'object' || Object.keys(data).length === 0)
            return false;
        const ldata = $trueorfalse.updateConfig(data, ideviceId);
        const medias = $trueorfalse.extractMediaElements(data.questionsGame);
        const htmlContent = $trueorfalse.createInterfaceTrueOrFalse(ldata);
        const content = htmlContent + medias;

        const html = template.replace('{content}', content);
        $exeDevices.iDevice.gamification.math.updateLatex(
            '.exe-trueorfalse-container'
        );

        return html;
    },

    extractMediaElements: function (items) {
        if (!Array.isArray(items)) return '';

        const tmp = document.createElement('div');
        const set = new Set();

        for (const {
            question = '',
            feedback = '',
            suggestion = '',
            baseText = '',
        } of items) {
            tmp.innerHTML = `${question} ${feedback} ${suggestion} ${baseText}`;
            tmp.querySelectorAll('img, audio, video').forEach((el) =>
                set.add(el.outerHTML)
            );
            tmp.innerHTML = '';
        }
        return `<div class="questionsMedia" style="display:none">${[...set].join('')}</div>`;
    },

    renderBehaviour(data, accesibility, ideviceId) {
        if (!data || typeof data !== 'object' || Object.keys(data).length === 0)
            return false;
        const ldata = $trueorfalse.updateConfig(data, ideviceId);

        const questionsHtml = $trueorfalse.generateTrueFalseQuizHtml(ldata);

        $('#tofPMultimedia-' + ldata.id).empty();
        $('#tofPMultimedia-' + ldata.id).append(questionsHtml);

        if (!$('html').is('#exe-index')) {
            this.scormAPIwrapper = '../libs/SCORM_API_wrapper.js';
            this.scormFunctions = '../libs/SCOFunctions.js';
        }
        if (
            document.body.classList.contains('exe-scorm') &&
            ldata.isScorm > 0
        ) {
            if (typeof window.scorm !== 'undefined' && window.scorm.init()) {
                this.initScormData(ldata);
            } else {
                this.loadSCORM_API_wrapper(ldata);
            }
        } else if (ldata.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(ldata);
        }

        $trueorfalse.addEvents(ldata);

        const dataString = JSON.stringify(ldata);
        if ($exeDevices.iDevice.gamification.math.hasLatex(dataString)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '#tofPMainContainer-' + ldata.id
            );
        }
    },

    initScormData: function (ldata) {
        $trueorfalse.mScorm = window.scorm;
        $trueorfalse.userName =
            $exeDevices.iDevice.gamification.scorm.getUserName(
                $trueorfalse.mScorm
            );
        $trueorfalse.previousScore =
            $exeDevices.iDevice.gamification.scorm.getPreviousScore(
                $trueorfalse.mScorm
            );

        if (typeof $trueorfalse.mScorm.SetScoreMax === 'function') {
            $trueorfalse.mScorm.SetScoreMax(100);
        } else {
            $trueorfalse.mScorm.SetScoreMax(100);
        }

        if (typeof $trueorfalse.mScorm.SetScoreMin === 'function') {
            $trueorfalse.mScorm.SetScoreMin(0);
        } else {
            $trueorfalse.mScorm.SetScoreMin(0);
        }
        $trueorfalse.initialScore = $trueorfalse.previousScore;
        $exeDevices.iDevice.gamification.scorm.registerActivity(ldata);
    },

    updateConfig: function (odata, ideviceId) {
        const data = JSON.parse(JSON.stringify(odata));

        data.isInExe = eXe.app.isInExe() ?? false;
        data.idevicePath = data.isInExe
            ? eXe.app.getIdeviceInstalledExportPath('trueorfalse')
            : $('.idevice_node.trueorfalse').eq(0).attr('data-idevice-path');
        data.id = ideviceId ?? data.ideviceId;
        data.main = 'tofPMainContainer-' + data.id;
        data.idevice = 'idevice_node';
        data.title = 'Verdadero o falso';

        const $idevice = $('#' + data.id);
        if ($idevice.length) {
            data.title = $idevice
                .closest('article')
                .find('header .box-title')
                .text();
        }
        data.repeatActivity = true;
        data.isScorm = data.isScorm ?? 0;

        const $idevices = $('.idevice_node');
        data.ideviceNumber = $idevices.index($('#' + data.id)) + 1;

        data.isTest = typeof data.isTest === 'undefined' ? false : data.isTest;

        data.hits = 0;
        data.errors = 0;
        data.scorerp = 0;
        data.numberQuestions = data.questionsGame
            ? data.questionsGame.length
            : 0;

        data.gameStarted = false;
        data.gameOver = false;
        data.hasSCORMbutton = false;
        data.counter = 0;

        data.questionsRandom = data.questionsRandom ?? false;

        data.weighted = data.weighted ?? 100;
        data.percentageQuestions = data.percentageQuestions ?? 100;

        if (typeof data.typeGame === 'undefined') {
            data.typeGame = 'TrueOrFalse';
            data.eXeGameInstructions = data.eXeFormInstructions ?? '';
            data.eXeIdeviceTextAfter = '';
            data.msgs = $trueorfalse.msgsdefault;
            data.questionsGame = data.questionsData.map((q) => ({
                question: q.baseText || '',
                answer: q.answer || '',
                feedback: q.feedback || '',
                suggestion: q.hint || '',
                solution: q.answer === 'True' ? 1 : 0,
            }));
            data.gameStarted = true;
            data.showSlider = false;
        }
        if (data.percentageQuestions < 100) {
            data.questionsGame =
                $exeDevices.iDevice.gamification.helpers.getQuestions(
                    data.questionsGame,
                    data.percentageQuestions
                );
        } else if (data.questionsRandom) {
            data.questionsGame =
                $exeDevices.iDevice.gamification.helpers.shuffleAds(
                    data.questionsGame
                );
        }
        data.numberQuestions = data.questionsGame.length;
        data.current = 0;

        return data;
    },

    replaceDirPath(htmlString, ideviceId) {
        const node = document.getElementById(ideviceId);
        if (!node || eXe.app.isInExe() || !htmlString) return htmlString;

        const idRes = ideviceId;
        if (!idRes) return htmlString;

        const basePath =
            document.documentElement.id === 'exe-index'
                ? `content/resources/${idRes}/`
                : `../content/resources/${idRes}/`;

        const custom =
            document.documentElement.id === 'exe-index'
                ? 'custom/'
                : '../custom/';

        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        doc.querySelectorAll(
            'img[src], video[src], audio[src], a[href], source[src]'
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
                    el.setAttribute(attr, basePath + filename);
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

    loadSCORM_API_wrapper: function (data) {
        let parsedData = typeof data === 'string' ? JSON.parse(data) : data;
        if (typeof pipwerks === 'undefined') {
            const escapedData = $trueorfalse.escapeForCallback(parsedData);
            eXe.app.loadScript(
                this.scormAPIwrapper,
                '$trueorfalse.loadSCOFunctions("' + escapedData + '")'
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
            const escapedData = $trueorfalse.escapeForCallback(parsedData);
            eXe.app.loadScript(
                this.scormFunctions,
                '$trueorfalse.initSCORM("' + escapedData + '")'
            );
        } else {
            this.initSCORM(parsedData);
        }
    },

    initSCORM: function (ldata) {
        let parsedData = typeof ldata === 'string' ? JSON.parse(ldata) : ldata;
        $trueorfalse.mScorm = scorm;
        if ($trueorfalse.mScorm.init());
        {
            $trueorfalse.initScormData(parsedData);
        }
    },

    escapeForCallback: function (obj) {
        let json = JSON.stringify(obj);
        json = json.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return json;
    },

    saveEvaluation: function (data) {
        const mOptions = data;
        const score = (10 * mOptions.hits) / mOptions.numberQuestions;
        mOptions.scorerp = score;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            mOptions.isInExe
        );
    },

    sendScore: function (auto, data) {
        const mOptions = data;
        mOptions.scorerp = (mOptions.hits * 10) / mOptions.questionsGame.length;
        mOptions.previousScore = $trueorfalse.previousScore;
        mOptions.userName = $trueorfalse.userName;
        mOptions.repeatActivity = true;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $trueorfalse.previousScore = mOptions.previousScore;
    },

    createInterfaceTrueOrFalse: function (data) {
        const mOptions = data;
        const msgs = mOptions.msgs;
        const instance = mOptions.id;
        const timeClass =
            mOptions.isTest && mOptions.time > 0 ? '' : 'TOFP-EHidden';
        const questionsClass =
            mOptions.isTest && mOptions.time > 0 ? 'TOFP-EHidden' : '';
        const checkClass =
            !mOptions.isTest || (mOptions.isTest && mOptions.time > 0)
                ? 'TOFP-EHidden'
                : '';
        const display = mOptions.isScorm == 2 ? 'block' : 'none';
        const html = `
    <div class="game-evaluation-ids js-hidden" data-id="${mOptions.id}" data-evaluationb="${mOptions.evaluation}" data-evaluationid="${mOptions.evaluationID}"></div>
        <div class="TOFP-instructions">${mOptions.eXeGameInstructions}</div>
        <div class="TOFP-MainContainer" data-instance="${instance}" id="tofPMainContainer-${instance}">
            <div class="TOFP-GameContainer" id="tofPGameContainer-${instance}">
                <div class="TOFP-GameScoreBoard ${timeClass}">
                    <div class="TOFP-TimeNumber">
                        <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                        <p id="tofPPTime-${instance}" class="TOFP-PTime">00:00:</p>
                    </div>
                </div>
                <div class="TOFP-MessgeDiv" id="tofPMessageDiv-${instance}">
                    <div class="TOFP-Message" id="tofPMessage-${instance}"></div>
                </div>
                <div class="TOFP-StartGameDiv ${timeClass}" id="tofPStartGameDiv-${instance}">
                    <button  id="tofPStartGame-${instance}" type="button" class="btn btn-primary">${msgs.msgStartGame}</button>
                </div>
                <div class="TOFP-Multimedia ${questionsClass}" id="tofPMultimedia-${instance}">
                </div>
                <div class="TOFP-CheckTestDiv ${checkClass}" id="tofPCheckTestDiv-${instance}">
                    <button id="tofPCheckTest-${instance}" type="button" class="btn btn-primary">${msgs.msgCheck}</button>
                    <button id="tofRebootTest-${instance}" type="button" class="btn btn-primary TOFP-EHidden">${msgs.msgReboot}</button>
                </div>
        </div> 
        <div class="Games-BottonContainer">
            <div class="Games-GetScore">
                <input id="tofPSendScore-${instance}" type="button" value="${mOptions.textButtonScorm}" class="feedbackbutton Games-SendScore" style="display:${display}"/> <span class="Games-RepeatActivity"></span>
            </div>
        </div>
        <div class="TOFP-After">${mOptions.eXeIdeviceTextAfter}</div>
        `;
        return html;
    },

    generateRandomId() {
        return Date.now() + Math.floor(Math.random() * 100);
    },

    generateTrueFalseQuizHtml: function (data) {
        const html = data.showSlider
            ? $trueorfalse.generateSlideshow(data)
            : $trueorfalse.generatePage(data);
        return html;
    },

    generatePage: function (data) {
        const mOptions = data;
        const questionsGame = mOptions.questionsGame;
        const instance = mOptions.id;
        const msgs = mOptions.msgs;

        let html = questionsGame
            .map(
                (question, index) => `
            <div class="TOFP-QuestionDiv ${index % 2 ? 'TOFP-QuestionDivBlack' : ''} " data-number="${index}">
               <div class="TOFP-Question">${$trueorfalse.replaceDirPath(question.question, instance)}</div> 
               <a href="#" class="TOFP-ShowSuggestion ${!question.suggestion.trim() ? 'TOFP-EHidden' : ''}">
                    <img src="${mOptions.idevicePath}tofshowsuggestion.png" alt="${msgs.msgSuggestion}" class="TOFP-SuggestionIcon">
                    <span>${msgs.msgSuggestion}</span>
                </a>
                <div class="TOFP-Suggestion TOFP-EHidden">
                    ${$trueorfalse.replaceDirPath(question.suggestion, instance)}                    
                </div>         
                <p class="TOFP-Answers">
                    <label>
                        <input class="TOFP-Answer" type="radio" name="tofanswer-${instance}-${index}" value="1"> ${msgs.msgTrue}
                    </label>
                    <label>
                        <input class="TOFP-Answer" type="radio" name="tofanswer-${instance}-${index}" value="0"> ${msgs.msgFalse}
                    </label>
                </p>
               <div class="TOFP-Feedback TOFP-EHidden">
                    <strong><span class="TOFP-SolutionMessage"></span></strong>
                    ${$trueorfalse.replaceDirPath(question.feedback, instance)}
                </div>            
            </div>
        `
            )
            .join('');

        return `
            <div class="TOFP-Quiz">
                ${html}
            </div>
        `;
    },

    generateSlideshow: function (data) {
        const itemsPerSlide = data.showSlider ? 1 : 0;
        const mOptions = data;
        const questionsGame = mOptions.questionsGame;
        const instance = mOptions.id;
        const msgs = mOptions.msgs;

        if (typeof itemsPerSlide !== 'number' || itemsPerSlide < 1) {
            return $trueorfalse.generatePage(data);
        }

        const grouped = [];
        for (let i = 0; i < questionsGame.length; i += itemsPerSlide) {
            grouped.push(questionsGame.slice(i, i + itemsPerSlide));
        }

        const slidesHtml = grouped
            .map((group, slideIdx) => {
                const questionsHtml = group
                    .map((question, idx) => {
                        const index = slideIdx * itemsPerSlide + idx;
                        return `
          <div class="TOFP-QuestionDiv" data-number="${index}">
            <div class="TOFP-Question">${$trueorfalse.replaceDirPath(question.question, instance)}</div>
            <a href="#" class="TOFP-ShowSuggestion ${!question.suggestion.trim() ? 'TOFP-EHidden' : ''}">
              <img src="${mOptions.idevicePath}tofshowsuggestion.png" alt="${msgs.msgSuggestion}" class="TOFP-SuggestionIcon">
              <span>${msgs.msgSuggestion}</span>
            </a>
            <div class="TOFP-Suggestion TOFP-EHidden">${$trueorfalse.replaceDirPath(question.suggestion, instance)}</div>
            <p class="TOFP-Answers">
              <label><input class="TOFP-Answer" type="radio" name="tofanswer-${instance}-${index}" value="1"> ${msgs.msgTrue}</label>
              <label><input class="TOFP-Answer" type="radio" name="tofanswer-${instance}-${index}" value="0"> ${msgs.msgFalse}</label>
            </p>
            <div class="TOFP-Feedback TOFP-EHidden">
              <strong><span class="TOFP-SolutionMessage"></span></strong>
              ${$trueorfalse.replaceDirPath(question.feedback, instance)}
            </div>
          </div>`;
                    })
                    .join('');

                return `<div class="TOFP-SlideshowSlide" data-slide="${slideIdx}">${questionsHtml}</div>`;
            })
            .join('');
        return `
      <div class="TOFP-SlideshowContainer" id="tofpSlideShow-${instance}">
        <div class="TOFP-SlideshowControls">
            <a href="#" class="TOFP-SlideshowPrev TOFP-SlideshowControl" id="tofpPrevious-${instance}" title="${msgs.msgPrevious}">
            <img src="${mOptions.idevicePath}tofprevious.png" alt="${msgs.msgPrevious}" />
            </a>
            <span class="TOFP-SlideNumber" id="tofpSlideNumber-${instance}">1/10</span>
            <a href="#" class="TOFP-SlideshowNext TOFP-SlideshowControl" id="tofpNext-${instance}" title="${msgs.msgNext}">
            <img src="${mOptions.idevicePath}tofnext.png" alt="${msgs.msgNext}" />
            </a>
        </div>
        <div class="TOFP-SlideshowWrapper">
          ${slidesHtml}
        </div>
      </div>
    `;
    },

    removeEvents: function (data) {
        const instance = data.id;
        $(window).off('unload.eXeTOF beforeunload.eXeTOF');

        $(`#tofPSendScore-${instance}`).off('click');
        $(`#tofPStartGame-${instance}`).off('click');
        $(`#tofPCheckTest-${instance}`).off('click');
        $(`#tofRebootTest-${instance}`).off('click');
        $(`#tofPGameContainer-${instance}`).off('click', '.TOFP-Answer');
        $(`#tofPGameContainer-${instance}`).off(
            'click',
            '.TOFP-ShowSuggestion'
        );
    },
    addEventsSlideShow: function (data) {
        const mOptions = data;
        const instance = data.id;
        mOptions.current = 0;
        if (mOptions.showSlider) {
            const $slideshow = $('#tofPMultimedia-' + instance).find(
                '.TOFP-SlideshowContainer'
            );
            const $wrapper = $slideshow.find('.TOFP-SlideshowWrapper');
            const $slides = $wrapper.children();
            const total = $slides.length;
            $slideshow
                .find('.TOFP-SlideNumber')
                .text(`${mOptions.current + 1}/${total}`);
            if (total > 1) {
                $slideshow
                    .find('.TOFP-SlideshowControl')
                    .removeClass('TOFP-EHidden');
                $wrapper.css({ position: 'relative' });
                let heights = $slides.map((i, el) => $(el).outerHeight()).get();
                let maxHeight = Math.max(...heights);
                const controlsHeight =
                    $slideshow
                        .find('.TOFP-SlideshowControl')
                        .outerHeight(true) + 30;
                $wrapper.css('height', maxHeight);
                $slideshow.css('height', maxHeight + controlsHeight);

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

                function goToNext() {
                    const next = (mOptions.current + 1) % total;
                    $slides
                        .eq(mOptions.current)
                        .animate({ left: '100%' }, 300, function () {
                            $(this).hide().css({ left: 0 });
                        });
                    $slides
                        .eq(next)
                        .css({ left: '-100%' })
                        .show()
                        .animate({ left: 0 }, 300, function () {
                            const h = $slides.eq(next).outerHeight();
                            $wrapper.animate({ height: h }, 300);
                            $slideshow.animate(
                                { height: h + controlsHeight },
                                300
                            );
                        });
                    mOptions.current = next;
                    $slideshow
                        .find('.TOFP-SlideNumber')
                        .text(`${mOptions.current + 1}/${total}`);
                }

                function goToPrev() {
                    const prev = (mOptions.current - 1 + total) % total;
                    $slides
                        .eq(mOptions.current)
                        .animate({ left: '-100%' }, 300, function () {
                            $(this).hide().css({ left: 0 });
                        });

                    $slides
                        .eq(prev)
                        .css({ left: '100%' })
                        .show()
                        .animate({ left: 0 }, 300, function () {
                            const h =
                                $slides.eq(prev).outerHeight() +
                                controlsHeight +
                                20;
                            $wrapper.animate({ height: h }, 300);
                            $slideshow.animate({ height: h }, 300);
                        });
                    mOptions.current = prev;
                    $slideshow
                        .find('.TOFP-SlideNumber')
                        .text(`${mOptions.current + 1}/${total}`);
                }
                $slideshow.find('.TOFP-SlideshowNext').off('click');
                $slideshow
                    .find('.TOFP-SlideshowNext')
                    .on('click', function (e) {
                        e.preventDefault();
                        goToNext();
                    });
                $slideshow.find('.TOFP-SlideshowPrev').off('click');
                $slideshow
                    .find('.TOFP-SlideshowPrev')
                    .on('click', function (e) {
                        e.preventDefault();
                        goToPrev();
                    });
            }
        }
    },
    resizeSlideShow: function (data) {
        const mOptions = data;
        const instance = data.id;
        if (mOptions.showSlider) {
            const $slideshow = $('#tofpSlideShow-' + instance);
            const $wrapper = $slideshow.find('.TOFP-SlideshowWrapper');
            const controlsHeight =
                $slideshow.find('.TOFP-SlideshowControls').outerHeight(true) +
                30;
            const maxHeight = $slideshow
                .find('.TOFP-SlideshowSlide')
                .eq(mOptions.current)
                .outerHeight();
            $wrapper.css('height', maxHeight);
            $slideshow.css('height', maxHeight + controlsHeight);
        }
    },
    addEvents: function (data) {
        $(document).on('questionsReady', function (e, questions) {
            //var container = $('#questionsContainer');
            //container.empty();
            //$.each(questions, function(index, question) {
            //$('<p/>').text(question).appendTo(container);
            //});
        });
        const mOptions = data;
        const idevicePath = mOptions.idevicePath;
        const instance = mOptions.id;
        const msgs = mOptions.msgs;
        $trueorfalse.removeEvents(data);

        $(window).on('unload.eXeTOF beforeunload.eXeTOF', () => {
            if (mOptions.gameStarted || mOptions.gameOver) {
                $trueorfalse.sendScore(true, mOptions);
                $exeDevices.iDevice.gamification.scorm.endScorm(
                    $trueorfalse.mScorm
                );
            }
        });

        mOptions.gameOver = false;
        mOptions.gameStarted = false;
        mOptions.counter = parseInt(mOptions.tofPTime) * 60;
        mOptions.active = 0;
        mOptions.scorep = 0;
        mOptions.main = `tofPMainContainer-${instance}`;
        mOptions.idevice = 'trueorfalse';

        $(`#tofPSendScore-${instance}`).attr('value', mOptions.textButtonScorm);
        $(`#tofPSendScore-${instance}`).hide();

        $(`#tofPSendScore-${instance}`).on('click', function (e) {
            e.preventDefault();
            $trueorfalse.sendScore(false, mOptions);
            return true;
        });

        $('#tofPGameContainer-' + instance).on(
            'click',
            '.TOFP-Answer',
            function () {
                if (mOptions.isTest) {
                    return;
                }
                const $parentDiv = $(this).closest('.TOFP-QuestionDiv');
                if (mOptions.showSlider) {
                    $trueorfalse.resizeSlideShow(mOptions);
                }

                const number = parseInt($parentDiv.data('number'));
                const correct =
                    mOptions.questionsGame[number].solution ==
                    parseInt($(this).val());
                const $feedbackDiv = $parentDiv.find('.TOFP-Feedback');
                const message = correct ? msgs.msgOk : msgs.msgKO;
                const bgcolor = correct ? '#d4edda' : '#f8d7da';
                const color = correct ? '#155724' : '#721c24';
                $feedbackDiv.find('.TOFP-SolutionMessage').text(message);
                $feedbackDiv
                    .css({ 'background-color': bgcolor, color: color })
                    .fadeIn('fast');
                if (mOptions.isScorm == 1) {
                    mOptions.initialScore =
                        typeof $trueorfalse.initialScore === 'undefined'
                            ? ''
                            : $trueorfalse.initialScore;
                    $trueorfalse.updateScoreData(mOptions);
                    $trueorfalse.sendScore(true, mOptions);
                    $trueorfalse.initialScore = score;
                }
            }
        );

        $('#tofPCheckTest-' + instance).on('click', function (e) {
            e.preventDefault();
            $trueorfalse.gameOver(mOptions);
            if (mOptions.showSlider) {
                $trueorfalse.resizeSlideShow(mOptions);
            }
        });

        $('#tofRebootTest-' + instance).on('click', function (e) {
            e.preventDefault();
            mOptions.gameStarted = false;
            mOptions.gameOver = false;

            if (
                mOptions.percentageQuestions < 100 ||
                mOptions.questionsRandom
            ) {
                mOptions.questionsGame =
                    $exeDevices.iDevice.gamification.helpers.shuffleAds(
                        mOptions.questionsGame
                    );
            }
            const questionsHtml =
                $trueorfalse.generateTrueFalseQuizHtml(mOptions);
            $('#tofPMultimedia-' + mOptions.id).empty();
            $('#tofPMultimedia-' + mOptions.id).append(questionsHtml);
            if (mOptions.showSlider) {
                $trueorfalse.addEventsSlideShow(mOptions);
            }
            $trueorfalse.startGame(mOptions);
        });

        $(`#tofPStartGame-${instance}`).val(msgs.tofPStartGame);
        $(`#tofPStartGame-${instance}`).on('click', function () {
            $trueorfalse.startGame(mOptions);
        });

        $('#tofPGameContainer-' + instance).on(
            'click',
            '.TOFP-ShowSuggestion',
            function (e) {
                e.preventDefault();
                const $question = $(this).closest('.TOFP-QuestionDiv');
                const $suggestion = $question.find('.TOFP-Suggestion');
                const $icon = $question.find('.TOFP-SuggestionIcon');
                const $parentDiv = $(this).closest('.TOFP-QuestionDiv');

                $suggestion.slideToggle('fast', function () {
                    const isVisible = $suggestion.is(':visible');
                    const newSrc = isVisible
                        ? `${idevicePath}tofhidesuggestion.png`
                        : `${idevicePath}tofshowsuggestion.png`;

                    const altText = isVisible ? msgs.msgHide : msgs.msgShow;

                    $icon.attr({
                        src: newSrc,
                        alt: altText,
                    });
                    if (mOptions.showSlider) {
                        $trueorfalse.resizeSlideShow(mOptions);
                    }
                });
            }
        );
        if (mOptions.showSlider) {
            $trueorfalse.addEventsSlideShow(mOptions);
        }

        if (mOptions.isTest && mOptions.time > 0) {
            $trueorfalse.updateTime(mOptions.time * 60, instance);
        }
        if (
            mOptions.isTest &&
            mOptions.evaluation &&
            mOptions.evaluationID &&
            mOptions.evaluationID.length > 3
        ) {
            mOptions.idevicePath = idevicePath;
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                mOptions.isInExe
            );
        }
    },

    gameOver: function (data) {
        const mOptions = data;
        const instance = mOptions.id;
        const questions = mOptions.questionsGame;
        const msgs = mOptions.msgs;
        mOptions.gameStarted = false;
        mOptions.gameOver = true;

        $('#tofPCheckTest-' + instance).hide();
        $trueorfalse.stopCounter(mOptions);
        let hits = 0;
        let errors = 0;

        $('#tofPGameContainer-' + instance)
            .find('.TOFP-QuestionDiv')
            .each(function (index) {
                const $questionDiv = $(this);
                const $selectedInput = $questionDiv.find(
                    '.TOFP-Answer:checked'
                );
                const $selectedFeedBack = $questionDiv.find('.TOFP-Feedback');

                $questionDiv.find('.TOFP-Answer').prop('disabled', true);

                let message = msgs.msgKO;
                let bgcolor = '#f8d7da';
                let color = '#721c24';

                const solution = questions[index].solution;
                if ($selectedInput.length) {
                    const selectedValue = parseInt($selectedInput.val(), 10);
                    const numericSolution = Number(solution);

                    if (selectedValue === numericSolution) {
                        hits++;
                        message = msgs.msgOk;
                        bgcolor = '#d4edda';
                        color = '#155724';
                    } else {
                        errors++;
                    }
                }
                if ($selectedFeedBack.length > 0) {
                    $selectedFeedBack
                        .find('.TOFP-SolutionMessage')
                        .text(message);
                    $selectedFeedBack
                        .css({
                            'background-color': bgcolor,
                            color: color,
                        })
                        .fadeIn('fast');
                }
            });

        mOptions.hits = hits;
        mOptions.errors = hits;
        score = (mOptions.hist * 10) / mOptions.numberQuestions;

        $('#tofPMultimedia').data('score', score);
        $('#tofPMultimedia').data('isscorm', mOptions.isScorm);
        $('#tofPMultimedia').data('evaluation', mOptions.evaluation);
        $('#tofPMultimedia').data('evaluationID', mOptions.evaluationID);

        mOptions.scorep = (10 * mOptions.hits) / mOptions.numberQuestions;
        const message =
            mOptions.msgs.msgYouScore + ': ' + mOptions.scorep.toFixed(2);
        const type = mOptions.scorep < 5 ? 1 : 2;

        $trueorfalse.showMessage(type, message, instance);
        $trueorfalse.saveEvaluation(mOptions);
        $('#tofRebootTest-' + instance).show();
        if (mOptions.isScorm == 1) {
            $trueorfalse.initialScore =
                typeof $trueorfalse.initialScore === 'undefined'
                    ? ''
                    : $trueorfalse.initialScore;
            $trueorfalse.sendScore(true, data);
            $trueorfalse.initialScore = score;
        }
    },

    updateScoreData: function (data) {
        const mOptions = data;
        const instance = mOptions.id;
        const questions = mOptions.questionsGame;
        let hits = 0,
            errors = 0;

        $('#tofPGameContainer-' + instance)
            .find('.TOFP-QuestionDiv')
            .each(function (index) {
                const $questionDiv = $(this);
                const $selectedInput = $questionDiv.find(
                    '.TOFP-Answer:checked'
                );
                const solution = questions[index].solution;
                if ($selectedInput.length) {
                    const selectedValue = parseInt($selectedInput.val(), 10);
                    if (selectedValue === solution) {
                        hits++;
                    } else {
                        errors++;
                    }
                }
            });
        mOptions.hits = hits;
        mOptions.errors = errors;
    },

    startGame: function (data) {
        const mOptions = data,
            instance = mOptions.id;

        if (mOptions.gameStarted) return;

        mOptions.gameStarted = false;
        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.scorerp = 0;

        $(`#tofPMultimedia-${instance}`).removeClass('TOFP-EHidden');
        $(`#tofPCheckTestDiv-${instance}`).removeClass('TOFP-EHidden');
        $(`#tofPStartGameDiv-${instance}`).addClass('TOFP-EHidden');
        $('#tofRebootTest-' + instance).hide();
        $('#tofPCheckTest-' + instance).show();
        $('#tofPGameContainer-' + instance)
            .find('.TOFP-Answer')
            .prop('checked', false);
        $('#tofPMultimedia-' + instance)
            .find('.TOFP-Suggestion')
            .fadeOut();
        $('#tofPMultimedia-' + instance)
            .find('.TOFP-Feedback')
            .fadeOut();
        $('#tofPGameContainer-' + instance)
            .find('.TOFP-Answer')
            .prop('disabled', false);
        $trueorfalse.showMessage(0, '', instance);

        mOptions.counter = mOptions.time * 60;
        if (mOptions.isTest && mOptions.time > 0 && !mOptions.gameOver) {
            data.clock = setInterval(() => {
                let $node = $('#tofPMainContainer-' + instance);
                let $content = $('#node-content');
                if (
                    !$node.length ||
                    ($content.length && $content.attr('mode') === 'edition')
                ) {
                    clearInterval(data.clock);
                    return;
                }
                if (mOptions && mOptions.isTest && mOptions.gameStarted) {
                    mOptions.counter--;
                    $trueorfalse.updateTime(mOptions.counter, instance);
                    if (mOptions.counter <= 0) {
                        $trueorfalse.gameOver(mOptions);
                    }
                }
            }, 1000);
        }
        $exeDevices.iDevice.gamification.math.updateLatex(
            '#tofPMainContainer-' + instance
        );
        mOptions.gameStarted = true;
    },

    stopCounter: function (data) {
        if (data.clock) {
            clearInterval(data.clock);
        }
    },

    updateTime: function (tiempo, instance) {
        $(`#tofPPTime-${instance}`).text(
            $exeDevices.iDevice.gamification.helpers.getTimeToString(tiempo)
        );
    },

    showMessage: function (type, message, instance) {
        const colors = [
                '#555555',
                $trueorfalse.borderColors.red,
                $trueorfalse.borderColors.green,
                $trueorfalse.borderColors.blue,
                $trueorfalse.borderColors.yellow,
            ],
            color = colors[type];

        $(`#tofPMessage-${instance}`).html(message).css({
            color: color,
            'font-size': '1.1em',
        });
        $exeDevices.iDevice.gamification.math.updateLatex(
            '#tofPMessage' + instance
        );
    },

    msgsdefault: {
        msgNoImage: 'Sin imagen',
        msgFeedback: 'Retroalimentación',
        msgSuggestion: 'Sugerencia',
        msgSolution: 'Respuesta',
        msgQuestion: 'Pregunta',
        msgTrue: 'Verdadero',
        msgFalse: 'Falso',
        msgOk: 'Correcto',
        msgKO: 'Incorrecto',
        msgShow: 'Mostrar',
        msgHide: 'Ocultar',
        msgReboot: 'Volver a intentar',
        msgCheck: 'Comprobar',
        msgStartGame: 'Haz clic aquí para comenzar',
        msgYouScore: 'Tu puntuación',
        textButtonScorm: 'Guardar puntuación',
        msgNext: 'Siguiente',
        msgPrevious: 'Anterior',
    },
};
