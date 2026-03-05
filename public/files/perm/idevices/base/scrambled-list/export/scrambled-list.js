/* eslint-disable no-undef */
/**
 * Scrambled List iDevice
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Ignacio Gros (http://gros.es/) for http://exelearning.net/
 *
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 *
 * It includes the HTML5 Sortable jQuery Plugin, released under the MIT license (details below)
 */

var $scrambledlist = {
    _touchHandlers: {},

    borderColors: {
        black: '#1c1b1b',
        blue: '#5877c6',
        green: '#66FF66',
        red: '#FF6666',
        white: '#f9f9f9',
        yellow: '#f3d55a',
        grey: '#777777',
        incorrect: '#d9d9d9',
        correct: '#00ff00',
    },

    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',

    /**
     * eXe idevice engine
     * Json idevice api function
     * Engine execution order: 1
     *
     * Get the base html of the idevice view
     *
     * @param {Object} data
     * @param {Number} accesibility
     * @param {String} template
     * @returns {String}
     */
    renderView: function (data, accesibility, template, ideviceId) {
        const ldata = $scrambledlist.updateConfig(data, ideviceId);
        let optionsText = '';
        ldata.options.forEach((option) => {
            optionsText += `<li>${option}</li>`;
        });
        let html = template;
        if (
            typeof ldata.exportScorm !== 'undefined' &&
            typeof ldata.exportScorm.saveScore !== 'undefined'
        ) {
            html = html.replace('{scorm}', ldata.exportScorm.saveScore);
        } else {
            html = html.replace('{scorm}', false);
        }
        html = html.replace('{idList}', ideviceId);
        html = html.replace('{instructions}', ldata.instructions);
        html = html.replace('{optionsText}', optionsText);
        if (
            document.body.classList.contains('exe-scorm') &&
            typeof ldata.exportScorm !== 'undefined' &&
            typeof ldata.exportScorm.saveScore !== 'undefined' &&
            ldata.exportScorm.saveScore &&
            ldata.exportScorm.buttonTextSave !== ''
        ) {
            html = html.replace(
                '{buttonText}',
                ldata.exportScorm.buttonTextSave
            );
        } else {
            html = html.replace(
                '{buttonText}',
                this.removeTags(ldata.buttonText)
            );
        }
        html = html.replace('{rightText}', this.removeTags(ldata.rightText));
        html = html.replace(
            '{scormMessage}',
            $scrambledlist.getScormHtml(ldata)
        );
        html = html.replace('{wrongText}', this.removeTags(ldata.wrongText));
        html = html.replace('{afterElement}', ldata.afterElement);
        html = html.replace('{evaluationID}', ldata.evaluationID);
        html = html.replace('{ideviceID}', ideviceId);
        html = html.replace('{evaluation}', ldata.evaluation);
        return html;
    },

    updateConfig: function (odata, ideviceId) {
        const data = JSON.parse(JSON.stringify(odata));
        const isInExe = eXe.app.isInExe() ?? false;
        data.idevicePath = isInExe
            ? eXe.app.getIdeviceInstalledExportPath('scrambled-list')
            : $('.idevice_node.scrambled-list').eq(0).attr('data-idevice-path');

        data.id = ideviceId ?? data.ideviceId ?? data.id;
        data.msgs = data.msgs || this.getMessages();
        data.evaluation = data.evaluation || false;
        data.evaluationID = data.evaluationID || '';
        data.isScorm = data.isScorm || 0;
        data.time = data.time || 0;
        data.repeatActivity = true;
        data.showSolutions =
            typeof data.showSolutions !== 'undefined'
                ? data.showSolutions
                : true;
        data.attemptsNumber = $scrambledlist.getBoundedIntValue(
            data.attemptsNumber,
            1,
            9,
            1
        );
        data.pendingAttempts = $scrambledlist.getBoundedIntValue(
            data.pendingAttempts,
            0,
            9,
            data.attemptsNumber
        );

        data.textButtonScorm =
            data.escapedData && data.exportScorm.textButtonScorm
                ? data.exportScorm.textButtonScorm
                : data.textButtonScorm;
        data.textButtonScorm = data.textButtonScorm ?? data.msgs.msgSaveScore;

        data.isScorm =
            data.escapedData && data.exportScorm.saveScore ? 1 : data.isScorm;
        data.isScorm = data.isScorm ?? 0;

        data.weighted = data.weighted ?? 100;

        const title =
            $('#' + data.id)
                .closest('article')
                .find('header .box-title')
                .text() || '';
        const $idevices = $('.idevice_node');
        const index = $idevices.index($('#' + data.id)) + 1;
        data.ideviceNumber = index;
        data.title = title;
        data.gameStarted = true;
        data.scorerp = 0;
        data.main = 'sl' + data.id;

        data.idevice = 'idevice_node';

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
    renderBehaviour(data, accesibility, ideviceId) {
        const ldata = $scrambledlist.updateConfig(data, ideviceId);

        let $node = $('#' + ldata.id);
        if ($node.length == 1) {
            $node.attr('data-idevice-json-data', JSON.stringify(ldata));
        }

        $('.exe-sortableList').each(function (instance) {
            if ($('body').hasClass('exe-epub3')) {
                $(this).prepend(
                    '<p>' +
                        $exe_i18n.epubDisabled +
                        '</p><p><strong>' +
                        $exe_i18n.solution +
                        ':</strong></p>'
                );
            } else {
                $scrambledlist.enableList(this, instance);
            }
        });

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

        const listHtml = $('#sl' + ldata.id).html();
        if ($exeDevices.iDevice.gamification.math.hasLatex(listHtml)) {
            $exeDevices.iDevice.gamification.math.updateLatex('#sl' + ldata.id);
        }

        setTimeout(function () {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                ldata,
                ldata.isInExe
            );
        }, 500);
        return true;
    },

    loadSCORM_API_wrapper: function (data) {
        let parsedData = typeof data === 'string' ? JSON.parse(data) : data;

        if (typeof pipwerks === 'undefined') {
            const escapedData = $scrambledlist.escapeForCallback(parsedData);
            eXe.app.loadScript(
                this.scormAPIwrapper,
                '$scrambledlist.loadSCOFunctions("' + escapedData + '")'
            );
        } else {
            this.loadSCOFunctions(parsedData);
        }
    },

    initScormData: function (ldata) {
        $scrambledlist.mScorm = window.scorm;
        $scrambledlist.userName =
            $exeDevices.iDevice.gamification.scorm.getUserName(
                $scrambledlist.mScorm
            );
        $scrambledlist.previousScore =
            $exeDevices.iDevice.gamification.scorm.getPreviousScore(
                $scrambledlist.mScorm
            );

        if (typeof $scrambledlist.mScorm.SetScoreMax === 'function') {
            $scrambledlist.mScorm.SetScoreMax(100);
        } else {
            $scrambledlist.mScorm.SetScoreMax(100);
        }

        if (typeof $scrambledlist.mScorm.SetScoreMin === 'function') {
            $scrambledlist.mScorm.SetScoreMin(0);
        } else {
            $scrambledlist.mScorm.SetScoreMin(0);
        }
        $scrambledlist.initialScore = $scrambledlist.previousScore;
        $exeDevices.iDevice.gamification.scorm.registerActivity(ldata);
    },

    escapeForCallback: function (obj) {
        let json = JSON.stringify(obj);
        json = json.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return json;
    },

    loadSCOFunctions: function (data) {
        let parsedData = typeof data === 'string' ? JSON.parse(data) : data;

        if (typeof scorm === 'undefined') {
            const escapedData = $scrambledlist.escapeForCallback(parsedData);
            eXe.app.loadScript(
                this.scormFunctions,
                '$scrambledlist.initSCORM("' + escapedData + '")'
            );
        } else {
            this.initSCORM(parsedData);
        }
    },

    initSCORM: function (ldata) {
        let parsedData = typeof ldata === 'string' ? JSON.parse(ldata) : ldata;
        $scrambledlist.mScorm = window.scorm;
        if ($scrambledlist.mScorm.init()) {
            this.initScormData(parsedData);
        }
    },

    /**
     * Json idevice api function
     * Engine execution order: 3
     *
     * Initialize idevice parameters if necessary
     *
     * @param {Object} data
     * @param {Number} accesibility
     */
    init: function () {},

    enableList: function (activity, instance) {
        var lists = $('ul', activity);
        if (lists.length == 1) {
            lists.css('visibility', 'hidden');
            lists.each(function () {
                var lis = [];
                $('li', this).each(function () {
                    lis.push(this.innerHTML);
                });
                lis = $scrambledlist.randomizeArray(lis);
                $scrambledlist.getListHTML(activity, lis, this, instance);
            });
        }
    },

    getLinksHTML: function (i, listOrder) {
        return (
            '<span> <a href="#" class="up exe-sortableList-sorter exe-sortableList-sort-' +
            i +
            '_' +
            (i - 1) +
            '_' +
            listOrder +
            '" title="' +
            (i + 1) +
            ' &rarr; ' +
            i +
            '"><span class="sr-av"></span></a> <a href="#" class="down exe-sortableList-sorter exe-sortableList-sort-' +
            i +
            '_' +
            (i + 1) +
            '_' +
            listOrder +
            '" title="' +
            (i + 1) +
            ' &rarr; ' +
            (i + 2) +
            '"><span class="sr-av"></span></a></span>'
        );
    },

    getListLinks: function (listOrder) {
        var ul = $('#exe-sortableList-' + listOrder);
        var lis = $('li', ul);
        $('span', ul).remove();
        lis.each(function (i) {
            this.className = '';
            if (i == 0) this.className = 'first';
            if (i + 1 == lis.length) this.className = 'last';
            this.innerHTML += $scrambledlist.getLinksHTML(i, listOrder);
        });
        // No inline JavaScript (onclick, etc.)
        $('a.exe-sortableList-sorter', ul).each(function () {
            var c = this.className;
            c = c.split('exe-sortableList-sort-');
            if (c.length == 2) {
                c = c[1].split('_');
                if (c.length == 3) {
                    this.onclick = function () {
                        $scrambledlist.sortList(
                            this,
                            parseInt(c[0]),
                            parseInt(c[1]),
                            parseInt(c[2])
                        );
                        return false;
                    };
                }
            }
        });
    },

    sortList: function (e, a, b, listOrder) {
        // LI - FROM - TO
        var list = $('#exe-sortableList-' + listOrder);
        list.sortable('destroy');
        var lis = $('li', list);
        if (b < 0 || b > lis.length - 1) return false;
        var newList = [];
        var li, prev, current, next;
        for (var i = 0; i < lis.length; i++) {
            li = lis[i].innerHTML.split('<span>')[0].split('<span>')[0];
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
        list.html($scrambledlist.getULhtml(newList, listOrder)).sortable();
    },

    getULhtml: function (lis, listOrder) {
        html = '';
        for (var i = 0; i < lis.length; i++) {
            html += '<li>' + lis[i] + '</li>';
        }
        $('#exe-sortableList-' + listOrder)
            .html(html)
            .sortable();
        $scrambledlist.getListLinks(listOrder);
    },

    getScormHtml: function (data) {
        const mOptions = data;
        const instance = mOptions.id;
        return mOptions.isScorm > 0
            ? `<div class="Games-BottonContainer">
            <div class="Games-GetScore">
                <input id="tofPSendScore-${instance}" type="button" value="${mOptions.textButtonScorm}" class="feedbackbutton Games-SendScore" style="display:none"/> <span class="Games-RepeatActivity">${mOptions.msgScoreScorm}</span>
            </div>
        </div>`
            : '';
    },

    getListHTML: function (activity, lis, list, listOrder) {
        const listItems = lis.map((item) => `<li>${item}</li>`).join('');
        const html = `
          <ul class="exe-sortableList-options" id="exe-sortableList-${listOrder}">
            ${listItems}
          </ul>
          <p id="exe-sortableListButton-${listOrder}">
            <input type="button" class="btn btn-primary exe-sortableList-check-${listOrder}" 
                   value="${$('.exe-sortableList-buttonText', activity).eq(0).text()}" />
          </p>
          <div id="exe-sortableList-${listOrder}-feedback"></div>
                    <div id="exe-sortableList-${listOrder}-retry" class="d-none mt-2"></div>
        `;

        $(list)
            .hide()
            .attr('id', `exe-sortableListResults-${listOrder}`)
            .before(html);

        $(`#exe-sortableList-${listOrder}`)
            .sortable()
            .bind('sortupdate', function () {
                $scrambledlist.getListLinks(listOrder);
            });

        $scrambledlist.getListLinks(listOrder);
        $scrambledlist.setupTouchDrag(listOrder);

        $(`#exe-sortableListButton-${listOrder}`).on('click', function () {
            $scrambledlist.check(this, listOrder);
        });
    },

    check: function (e, listOrder) {
        // No more sorting
        $('#exe-sortableListButton-' + listOrder).hide();
        var list = $('#exe-sortableList-' + listOrder);
        $('a', list).hide();
        $scrambledlist.removeTouchDrag(listOrder);
        list.sortable('destroy');
        // Check the answers
        var activity = $(e).parents('.exe-sortableList');
        var right = true;
        var userList = $('#exe-sortableList-' + listOrder);
        var rightAnswers = $('#exe-sortableListResults-' + listOrder);
        var rightAnswersLis = $('li', rightAnswers);
        let nRightAnswers = 0;
        $('li', userList).each(function (i) {
            var currentText = $(this)
                .html()
                .split('<span>')[0]
                .split('<span>')[0];
            if (currentText != rightAnswersLis.eq(i).html()) {
                right = false;
                $(this).css({
                    'background-color': $scrambledlist.borderColors.red,
                    'font-weight': 600,
                });
            } else {
                $(this).css({
                    'background-color': $scrambledlist.borderColors.green,
                    'font-weight': 600,
                });
                nRightAnswers++;
            }
        });
        var feedback = $('#exe-sortableList-' + listOrder + '-feedback');

        var data = $(e).closest('.idevice_node').attr('data-idevice-json-data');

        data = JSON.parse(data);
        data.pendingAttempts = this.getBoundedIntValue(
            data.pendingAttempts,
            0,
            9,
            this.getBoundedIntValue(data.attemptsNumber, 1, 9, 1)
        );
        data.pendingAttempts = Math.max(data.pendingAttempts - 1, 0);
        $(e)
            .closest('.idevice_node')
            .attr('data-idevice-json-data', JSON.stringify(data));

        this.saveEvaluation(nRightAnswers, userList[0].children.length, data);

        const errors = userList[0].children.length - nRightAnswers;
        if (!right && data.pendingAttempts > 0) {
            const retryQuestion = this.getRetryMessage(data, errors);
            this.setListActiveState(listOrder, false);
            this.showRetryPrompt(
                listOrder,
                retryQuestion,
                data,
                () => {
                    // Re-enable game with randomized cards for the next attempt.
                    this.retryGame(listOrder);
                },
                () => {
                    this.showResultFeedback(
                        activity,
                        feedback,
                        right,
                        rightAnswers,
                        data,
                        nRightAnswers,
                        userList[0].children.length
                    );
                }
            );
            return;
        }

        this.showResultFeedback(
            activity,
            feedback,
            right,
            rightAnswers,
            data,
            nRightAnswers,
            userList[0].children.length
        );
        const listHtml = $('#sl' + data.id).html();
        if ($exeDevices.iDevice.gamification.math.hasLatex(listHtml)) {
            $exeDevices.iDevice.gamification.math.updateLatex('#sl' + data.id);
        }
    },

    showResultFeedback: function (
        activity,
        feedback,
        right,
        rightAnswers,
        data,
        nRightAnswers,
        totalOptions
    ) {
        if (document.body.classList.contains('exe-scorm') && data.isScorm > 0) {
            this.sendScore(nRightAnswers, totalOptions, data);
            return;
        }

        if (right) {
            feedback
                .html(
                    '<p>' +
                        $('.exe-sortableList-rightText', activity).text() +
                        '</p>'
                )
                .hide()
                .attr('class', 'feedback feedback-right')
                .fadeIn();
            return;
        }

        if (!data.showSolutions) {
            feedback
                .html('<p>' + data.msgs.msgTestFailed + '</p>')
                .hide()
                .attr('class', 'feedback feedback-wrong')
                .fadeIn();
            return;
        }

        feedback
            .html(
                '<p>' +
                    $('.exe-sortableList-wrongText', activity).text() +
                    '</p><ul>' +
                    rightAnswers.html() +
                    '</ul>'
            )
            .hide()
            .attr('class', 'feedback feedback-wrong')
            .fadeIn();
    },

    getRetryMessage: function (data, errors) {
        const hasCustomMsg =
            data.msgs && typeof data.msgs.msgRetryAttempts === 'string';
        const template = hasCustomMsg
            ? data.msgs.msgRetryAttempts
            : 'Has cometido %s errores. Te quedan %s intentos. ¿Quieres intentarlo de nuevo?';
        return template
            .replace('%s', errors)
            .replace('%s', data.pendingAttempts);
    },

    showRetryPrompt: function (listOrder, message, data, onAccept, onCancel) {
        const $retry = $('#exe-sortableList-' + listOrder + '-retry');
        if (!$retry.length) {
            if (typeof onCancel === 'function') onCancel();
            return;
        }

        const acceptLabel =
            (data.msgs &&
                typeof data.msgs.msgAcceptRetry === 'string' &&
                data.msgs.msgAcceptRetry) ||
            'Aceptar';
        const cancelLabel =
            (data.msgs &&
                typeof data.msgs.msgCancelRetry === 'string' &&
                data.msgs.msgCancelRetry) ||
            'Cancelar';
        const msg = this.removeTags(message || '');
        const html = `
            <div class="feedback feedback-wrong p-2">
                <p class="mb-2">${msg}</p>
                <div class="d-flex gap-2">
                    <button type="button" class="btn btn-primary exe-sortableList-retry-accept">${acceptLabel}</button>
                    <button type="button" class="btn btn-secondary exe-sortableList-retry-cancel">${cancelLabel}</button>
                </div>
            </div>
        `;

        $retry
            .html(html)
            .removeClass('d-none')
            .addClass('d-block')
            .off('click', '.exe-sortableList-retry-accept')
            .off('click', '.exe-sortableList-retry-cancel');

        $retry.on('click', '.exe-sortableList-retry-accept', () => {
            $retry.empty().removeClass('d-block').addClass('d-none');
            if (typeof onAccept === 'function') onAccept();
        });

        $retry.on('click', '.exe-sortableList-retry-cancel', () => {
            $retry.empty().removeClass('d-block').addClass('d-none');
            if (typeof onCancel === 'function') onCancel();
        });
    },

    setListActiveState: function (listOrder, isActive) {
        const $list = $('#exe-sortableList-' + listOrder);
        if (!$list.length) return;

        if (isActive) {
            $list.css({ 'pointer-events': '', opacity: '' }).removeAttr(
                'aria-disabled'
            );
            return;
        }

        $list
            .css({ 'pointer-events': 'none', opacity: 0.65 })
            .attr('aria-disabled', 'true');
    },

    retryGame: function (listOrder) {
        const $userList = $('#exe-sortableList-' + listOrder);
        const $rightAnswers = $('#exe-sortableListResults-' + listOrder);
        const $feedback = $('#exe-sortableList-' + listOrder + '-feedback');
        const $button = $('#exe-sortableListButton-' + listOrder);
        const $retry = $('#exe-sortableList-' + listOrder + '-retry');

        const baseList = [];
        $('li', $rightAnswers).each(function () {
            baseList.push($(this).html());
        });

        const randomizedList = this.randomizeArray(baseList.slice());
        let listHtml = '';
        randomizedList.forEach((item) => {
            listHtml += '<li>' + item + '</li>';
        });

        $userList
            .html(listHtml)
            .sortable()
            .bind('sortupdate', function () {
                $scrambledlist.getListLinks(listOrder);
            });

        this.getListLinks(listOrder);
        this.setupTouchDrag(listOrder);
        this.setListActiveState(listOrder, true);
        $feedback.empty().removeClass('feedback-right feedback-wrong');
        $retry.empty().removeClass('d-block').addClass('d-none');
        $button.show();
    },

    saveEvaluation: function (nRightAnswers, total, data) {
        data.scorerp = (nRightAnswers * 10) / total;
        $exeDevices.iDevice.gamification.report.saveEvaluation(data);
    },

    randomizeArray: function (o) {
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

    getBoundedIntValue: function (value, min, max, fallback) {
        const parsed = parseInt(value, 10);
        if (Number.isNaN(parsed)) return fallback;
        return Math.min(Math.max(parsed, min), max);
    },

    /**
     * Function to remove HTML tags
     *
     * @param {*} str
     * @returns string
     */
    removeTags: function (str) {
        var wrapper = $('<div></div>');
        wrapper.html(str);
        return wrapper.text();
    },

    /**
     *
     */
    endScorm: function () {
        if (
            $scrambledlist.mScorm &&
            typeof $scrambledlist.mScorm.quit == 'function'
        ) {
            //$scrambledlist.mScorm.quit();
        }
    },

    /**
     *
     */
    sendScore: function (rightAnswers, totalOptions, data) {
        data.scorerp = (rightAnswers * 10) / totalOptions;
        data.gameStarted = true;
        $exeDevices.iDevice.gamification.scorm.sendScoreNew(true, data);
    },
    /**
     * Set up native touch drag-and-drop for a sortable list instance.
     * Needed because the HTML5 Sortable plugin only handles mouse events.
     *
     * @param {number} listOrder - Instance identifier for the sortable list
     */
    setupTouchDrag: function (listOrder) {
        $scrambledlist.removeTouchDrag(listOrder);

        const ul = document.getElementById('exe-sortableList-' + listOrder);
        if (!ul) return;

        let touchedItem = null, touchHelper = null, offsetX = 0, offsetY = 0;

        const touchStartHandler = function (e) {
            const touch = e.touches[0];
            const element = document.elementFromPoint(touch.clientX, touch.clientY);
            const li = $(element).closest('#exe-sortableList-' + listOrder + ' li')[0];
            if (!li) return;

            e.preventDefault();
            touchedItem = li;
            const rect = li.getBoundingClientRect();
            offsetX = touch.clientX - rect.left;
            offsetY = touch.clientY - rect.top;

            touchHelper = $(li).clone()
                .addClass('SLP-TouchHelper')
                .css({
                    position: 'fixed',
                    left: rect.left + 'px',
                    top: rect.top + 'px',
                    width: rect.width + 'px',
                    'z-index': 1000,
                    'pointer-events': 'none',
                    margin: 0,
                })
                .appendTo('body');

            $(touchedItem).addClass('sortable-dragging');
        };

        const touchMoveHandler = function (e) {
            if (!touchedItem) return;
            e.preventDefault();
            const touch = e.touches[0];

            touchHelper.css({
                left: (touch.clientX - offsetX) + 'px',
                top: (touch.clientY - offsetY) + 'px',
            });

            // Detect the li beneath the finger (hide helper so elementFromPoint works)
            touchHelper.hide();
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            touchHelper.show();

            const targetLi = $(elementBelow).closest('#exe-sortableList-' + listOrder + ' li')[0];
            $('#exe-sortableList-' + listOrder + ' li').removeClass('sortable-over');
            if (targetLi && targetLi !== touchedItem) {
                $(targetLi).addClass('sortable-over');
            }
        };

        const touchEndHandler = function (e) {
            if (!touchedItem) return;

            const touch = e.changedTouches[0];
            touchHelper.remove();
            touchHelper = null;
            $(touchedItem).removeClass('sortable-dragging');
            $('#exe-sortableList-' + listOrder + ' li').removeClass('sortable-over');

            // Find the target li under the finger
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            const targetLi = $(elementBelow).closest('#exe-sortableList-' + listOrder + ' li')[0];

            if (targetLi && targetLi !== touchedItem) {
                const targetRect = targetLi.getBoundingClientRect();
                const midY = targetRect.top + targetRect.height / 2;

                // Insert before or after the target based on finger position relative to its midpoint
                if (touch.clientY < midY) {
                    $(targetLi).before($(touchedItem));
                } else {
                    $(targetLi).after($(touchedItem));
                }

                $scrambledlist.getListLinks(listOrder);
            }

            touchedItem = null;
        };

        ul.addEventListener('touchstart', touchStartHandler, { passive: false });
        ul.addEventListener('touchmove', touchMoveHandler, { passive: false });
        ul.addEventListener('touchend', touchEndHandler, { passive: false });

        $scrambledlist._touchHandlers[listOrder] = {
            touchstart: touchStartHandler,
            touchmove: touchMoveHandler,
            touchend: touchEndHandler,
            ul: ul,
        };
    },

    /**
     * Remove native touch event listeners for a sortable list instance.
     *
     * @param {number} listOrder - Instance identifier for the sortable list
     */
    removeTouchDrag: function (listOrder) {
        const handlers = $scrambledlist._touchHandlers && $scrambledlist._touchHandlers[listOrder];
        if (!handlers) return;

        handlers.ul.removeEventListener('touchstart', handlers.touchstart);
        handlers.ul.removeEventListener('touchmove', handlers.touchmove);
        handlers.ul.removeEventListener('touchend', handlers.touchend);

        delete $scrambledlist._touchHandlers[listOrder];
    },

    getMessages: function () {
        let msgs = {
            msgScoreScorm:
                'La puntuación no se puede guardar porque esta página no forma parte de un paquete SCORM.',
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
            msgUncompletedActivity: 'Actividad no completada',
            msgSuccessfulActivity: 'Actividad: Superada. Puntuación: %s',
            msgUnsuccessfulActivity: 'Actividad: No superada. Puntuación: %s',
            msgStartGame: 'Haz clic aquí para comenzar',
            msgSaveScore: 'Guardar puntuación',
            msgSubmit: 'Enviar',
            msgTime: 'Tiempo',
            msgCheck: 'Comprobar',
            msgTestFailed: 'No has superado la prueba. Inténtalo de nuevo.',
        };
        return msgs;
    },
};

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
/* eslint-disable */
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
                        // The New eXeLearning
                        // #305 (disable disableIEFix for IE11)
                        // Original code: disableIEFix:!1,
                        // / The New eXeLearning
                        disableIEFix:
                            (!!window.MSInputMethodContext &&
                                !!document.documentMode) == true
                                ? 1
                                : !1,
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
