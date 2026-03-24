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
