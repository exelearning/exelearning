/**
 * Form iDevice
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: SDWEB - Innovative Digital Solutions
 *
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $text = {
    ideviceClass: 'textIdeviceContent',
    working: false,
    durationId: 'textInfoDurationInput',
    durationTextId: 'textInfoDurationTextInput',
    participantsId: 'textInfoParticipantsInput',
    participantsTextId: 'textInfoParticipantsTextInput',
    mainContentId: 'textTextarea',
    feedbackTitleId: 'textFeedbackInput',
    feedbackContentId: 'textFeedbackTextarea',

    defaultBtnFeedbackText: $exe_i18n.showFeedback,
    emptyInfoClass: 'exe-text-info-empty',

    /**
     * Engine execution order: 1
     * Get the base html of the idevice view
     */
    renderView(data, accessibility, template) {
        let content = data.textTextarea || '';
        const feedbackContent = data[this.feedbackContentId] || '';

        // Add feedback from jsonProperties only if content doesn't already have it
        if (feedbackContent) {
            const temp = document.createElement('div');
            temp.innerHTML = content;
            const hasFeedback = temp.querySelector('.feedback-button')
                || temp.querySelector('.feedbacktooglebutton')
                || temp.querySelector('.feedbackbutton')
                || temp.querySelector('.feedback.js-feedback')
                || temp.querySelector('div.feedback');

            if (!hasFeedback) {
                const btnText = c_(data[this.feedbackTitleId]) || this.defaultBtnFeedbackText;
                content += this.createFeedbackHTML(btnText, feedbackContent);
            }
        }

        return template.replace('{content}', content);
    },

    getHTMLView(data, pathMedia) {
        const isInExe = eXe.app.isInExe();
        const durationText = isInExe
            ? c_(data[this.durationTextId])
            : data[this.durationTextId];
        const participantsText = isInExe
            ? c_(data[this.participantsTextId])
            : data[this.participantsTextId];

        let infoContentHTML = '';
        if (data[this.durationId] || data[this.participantsId]) {
            infoContentHTML = this.createInfoHTML(
                data[this.durationId] === '' ? '' : durationText,
                data[this.durationId],
                data[this.participantsId] === '' ? '' : participantsText,
                data[this.participantsId]
            );
        }

        let contentHtml = data[this.mainContentId];

        const temp = document.createElement('div');
        temp.innerHTML = contentHtml;

        const btnDiv = temp.querySelector('.feedback-button');
        let buttonFeedBackText = data[this.feedbackTitleId];
        if (btnDiv) {
            // Support both legacy eXe 2.9 (feedbackbutton) and modern (feedbacktooglebutton) formats
            const inputEl = btnDiv.querySelector('input.feedbackbutton, input.feedbacktooglebutton');
            if (inputEl)
                buttonFeedBackText = isInExe
                    ? c_(inputEl.value)
                    : inputEl.value;
            btnDiv.remove();
        }

        let feedBackHtml = data[this.feedbackContentId] || '';
        const fbDiv = temp.querySelector('.feedback.js-feedback');
        if (fbDiv) {
            feedBackHtml = fbDiv.innerHTML;
            fbDiv.remove();
        }

        contentHtml = temp.innerHTML;
        if (feedBackHtml) {
            buttonFeedBackText =
                buttonFeedBackText === ''
                    ? this.defaultBtnFeedbackText
                    : buttonFeedBackText;
            if (isInExe) buttonFeedBackText = c_(buttonFeedBackText);
        }

        data['textInfoParticipantsTextInput'] = participantsText;
        data['textInfoDurationTextInput'] = durationText;
        data['textTextarea'] = contentHtml;
        data['textFeedbackInput'] = buttonFeedBackText;
        data['textFeedbackTextarea'] = feedBackHtml;

        const feedbackContentHTML =
            feedBackHtml === ''
                ? ''
                : this.createFeedbackHTML(buttonFeedBackText, feedBackHtml);
        const activityContent =
            infoContentHTML +
            contentHtml +
            feedbackContentHTML;

        let htmlContent = `<div class="${this.ideviceClass}">`;
        htmlContent += this.createMainContent(activityContent);
        htmlContent += `</div>`;

        return htmlContent;
    },

    /**
     * Engine execution order: 2
     * Add behavior and functionalities
     */
    renderBehaviour(data, accessibility, ideviceId) {
        const $node = $('#' + data.ideviceId);
        const isInExe = eXe.app.isInExe();

        const $btn = $(
            `#${data.ideviceId} input.feedbackbutton, #${data.ideviceId} input.feedbacktooglebutton`
        );
        if ($btn.length === 1) {
            const [textA, textB = textA] = $btn.val().split('|');
            $btn.val(textA)
                .attr('data-text-a', textA)
                .attr('data-text-b', textB);
            $btn.off('click')
                .closest('.feedback-button')
                .removeClass('clearfix');

            $btn.on('click', function () {
                if ($text.working) return false;
                $text.working = true;
                const btn = $(this);
                const feedbackEl = btn
                    .closest('.feedback-button')
                    .next('.feedback');

                if (feedbackEl.is(':visible')) {
                    btn.val(btn.attr('data-text-a'));
                    feedbackEl.fadeOut(() => {
                        $text.working = false;
                    });
                } else {
                    btn.val(btn.attr('data-text-b'));
                    feedbackEl.fadeIn(() => {
                        $text.working = false;
                    });
                }
                $exeDevices.iDevice.gamification.math.updateLatex(
                    '.exe-text-template'
                );
            });
        }
        this.hideEmptyTaskInfo($node[0]);
        const dataString = $node.html() || '';
        if ($exeDevices.iDevice.gamification.math.hasLatex(dataString)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '.exe-text-template'
            );
        }
    },

    replaceResourceDirectoryPaths(newDir, htmlString) {
        let dir = newDir.trim();
        if (!dir.endsWith('/')) dir += '/';
        const custom = $('html').is('#exe-index') ? 'custom/' : '../custom/';

        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        doc.querySelectorAll(
            'img[src], video[src], audio[src], a[href]'
        ).forEach((el) => {
            const attr = el.hasAttribute('src') ? 'src' : 'href';
            const val = el.getAttribute(attr).trim();

            if (/^\/?files\//.test(val)) {
                const filename = val.split('/').pop() || '';
                if (val.indexOf('file_manager') === -1) {
                    el.setAttribute(attr, dir + filename);
                } else {
                    el.setAttribute(attr, custom + filename);
                }
            }
        });
        return doc.body.innerHTML;
    },

    init(data, accessibility) {},

    createMainContent(content) {
        return `
            <div class="exe-text-activity">
                <div>${content}</div>
            </div>`;
    },

    /**
     * Hide the task information rows (Duration / Grouping) that have no value,
     * and the whole list when both are empty.
     * The rows stay in the HTML because the editor reads them by position
     * (first row: duration, second row: grouping); they are only hidden.
     * Only the task information list is touched (see getTaskInfoList), never
     * definition lists written by the author. It also covers older content,
     * which may hold whitespace in an empty <dd>, without saving it again.
     * @param {HTMLElement} node - The iDevice node
     */
    hideEmptyTaskInfo(node) {
        if (!node || !node.querySelectorAll) return;
        node.querySelectorAll('.exe-text-activity').forEach((activity) => {
            const list = this.getTaskInfoList(activity);
            if (!list) return;
            const rows = Array.from(list.children);
            let allEmpty = true;
            rows.forEach((row) => {
                const empty = this.isEmptyTaskInfoValue(row.querySelector(':scope > dd'));
                row.classList.toggle(this.emptyInfoClass, empty);
                if (!empty) allEmpty = false;
            });
            list.classList.toggle(this.emptyInfoClass, allEmpty);
        });
    },

    /**
     * The task information list of a Text iDevice activity, or null.
     * It is the first element of .exe-text-activity, or of its inner wrapper
     * <div> (older content and getHTMLView), and it only holds one or two
     * <div class="inline"> rows, each with a <dt> and a <dd>.
     * @param {HTMLElement} activity - The .exe-text-activity element
     * @returns {HTMLElement|null}
     */
    getTaskInfoList(activity) {
        const first = activity.firstElementChild;
        const candidates = [first, first && first.tagName === 'DIV' ? first.firstElementChild : null];
        return (
            candidates.find((el) => el && el.tagName === 'DL' && this.isTaskInfoList(el)) || null
        );
    },

    /**
     * Whether a <dl> has the task information structure.
     * @param {HTMLElement} dl
     * @returns {boolean}
     */
    isTaskInfoList(dl) {
        const rows = Array.from(dl.children);
        if (rows.length < 1 || rows.length > 2) return false;
        return rows.every(
            (row) =>
                row.tagName === 'DIV' &&
                row.classList.contains('inline') &&
                !!row.querySelector(':scope > dt') &&
                !!row.querySelector(':scope > dd')
        );
    },

    /**
     * Whether a task information value is empty: no text and no elements
     * (an image or any other element counts as content).
     * @param {HTMLElement|null} dd
     * @returns {boolean}
     */
    isEmptyTaskInfoValue(dd) {
        return !!dd && dd.children.length === 0 && dd.textContent.trim() === '';
    },

    createInfoHTML(
        durationText,
        durationValue,
        participantsText,
        participantsValue
    ) {
        return `
            <dl>
                <div class="inline"><dt><span title="${durationText}">${durationText}</span></dt><dd>${durationValue}</dd></div>
                <div class="inline"><dt><span title="${participantsText}">${participantsText}</span></dt><dd>${participantsValue}</dd></div>
            </dl>`;
    },

    createFeedbackHTML(title, content) {
        return `
            <div class="iDevice_buttons feedback-button js-required">
                <input type="button" class="feedbacktooglebutton" value="${title}">
            </div>
            <div class="feedback js-feedback js-hidden">${content}</div>`;
    },
};
