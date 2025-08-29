/**
 * Form iDevice
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: SDWEB - Innovative Digital Solutions
 *
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $text = {
    ideviceClass: "textIdeviceContent",
    working: false,
    durationId: "textInfoDurationInput",
    durationTextId: "textInfoDurationTextInput",
    participantsId: "textInfoParticipantsInput",
    participantsTextId: "textInfoParticipantsTextInput",
    mainContentId: "textTextarea",
    feedbackTitleId: "textFeedbackInput",
    feedbackContentId: "textFeedbackTextarea",

    defaultBtnFeedbackText: $exe_i18n.showFeedback,

    /**
     * Engine execution order: 1
     * Get the base html of the idevice view
     */
    renderView(data, accessibility, template) {
        const hmltdata = $text.getHTMLView(data)
        return template.replace("{content}", hmltdata);

    },

    getHTMLView(data, pathMedia) {
        const isInExe = eXe.app.isInExe();
        const durationText = isInExe
            ? c_(data[this.durationTextId])
            : data[this.durationTextId];
        const participantsText = isInExe
            ? c_(data[this.participantsTextId])
            : data[this.participantsTextId];

        const infoContentHTML = this.createInfoHTML(
            data[this.durationId] === "" ? "" : durationText,
            data[this.durationId],
            data[this.participantsId] === "" ? "" : participantsText,
            data[this.participantsId]
        );

        let contentHtml = data[this.mainContentId];
        if (!isInExe && pathMedia) contentHtml = this.replaceResourceDirectoryPaths(pathMedia, contentHtml);

        const temp = document.createElement('div');
        temp.innerHTML = contentHtml;

        const btnDiv = temp.querySelector('.feedback-button');
        let buttonFeedBackText = data[this.feedbackTitleId];
        if (btnDiv) {
            const inputEl = btnDiv.querySelector('input.feedbackbutton');
            if (inputEl) buttonFeedBackText = isInExe ? c_(inputEl.value) : inputEl.value;
            btnDiv.remove();
        }

        let feedBackHtml = data[this.feedbackContentId] || "";
        if (!isInExe && pathMedia) feedBackHtml = this.replaceResourceDirectoryPaths(pathMedia, feedBackHtml);
        const fbDiv = temp.querySelector('.feedback.js-feedback');
        if (fbDiv) {
            feedBackHtml = fbDiv.innerHTML;
            fbDiv.remove();
        }


        contentHtml = temp.innerHTML;
        if (feedBackHtml) {
            buttonFeedBackText = buttonFeedBackText === "" ? this.defaultBtnFeedbackText : buttonFeedBackText;
            if (isInExe) buttonFeedBackText = c_(buttonFeedBackText);
        }

        data["textInfoParticipantsTextInput"] = participantsText;
        data["textInfoDurationTextInput"] = durationText;
        data["textTextarea"] = contentHtml;
        data["textFeedbackInput"] = buttonFeedBackText;
        data["textFeedbackTextarea"] = feedBackHtml;

        const feedbackContentHTML = feedBackHtml === "" ? "" : this.createFeedbackHTML(buttonFeedBackText, feedBackHtml);
        const activityContent = infoContentHTML + contentHtml + feedbackContentHTML + `<p class="clearfix"></p>`;

        let htmlContent = `<div class="${this.ideviceClass}">`;
        htmlContent += this.createMainContent(activityContent);
        htmlContent += `</div>`;

        return htmlContent;
    },

    renderHtmlOldIdevice(data, $node) {
        // Defensive: ensure $node is a jQuery object
        if (!$node || !$node.length) return;

        if ($node.find('.pbl-task-description').length === 1 && (data[this.durationId] || data[this.participantsId])) {
            const durationText = data[this.durationTextId];
            const participantsText = data[this.participantsTextId];
            const infoContentHTML = this.createInfoHTML(
                data[this.durationId] === "" ? "" : durationText,
                data[this.durationId],
                data[this.participantsId] === "" ? "" : participantsText,
                data[this.participantsId]
            );

            const $activity = $node.find('.pbl-task-description');
            if ($activity.length) {
                $activity.prepend(infoContentHTML);
            } else {
                $node.prepend(infoContentHTML);
            }
        }

        let buttonFeedBackText = data[this.feedbackTitleId] || '';
        let feedBackHtml = data[this.feedbackContentId] || '';
        const hasFeedbackNode = $node.find('.feedback.js-feedback').length > 0;
        const hasFeedbackData = !!feedBackHtml;

        // Añadir feedback y botón solo si no existe ya un botón feedback
        const hasFeedbackButton = $node.find('.feedback-button').length > 0;
        if (!hasFeedbackNode && hasFeedbackData && !hasFeedbackButton) {
            const feedbackContentHTML = this.createFeedbackHTML(buttonFeedBackText || this.defaultBtnFeedbackText, feedBackHtml);
            const $activity = $node.find('.exe-text');
            if ($activity.length) {
                $activity.append(feedbackContentHTML);
            } else {
                $node.append(feedbackContentHTML);
            }
        }


        if ($node.find('.clearfix').length === 0) {
            const $activity = $node.find('.exe-text');
            if ($activity.length) {
                $activity.append('<p class="clearfix"></p>');
            } else {
                $node.append('<p class="clearfix"></p>');
            }
        }
    },

    /**
     * Engine execution order: 2
     * Add behavior and functionalities
     */
    renderBehaviour(data, accessibility, ideviceId) {
        const $node = $('#' + data.ideviceId);
        const isInExe = eXe.app.isInExe();

        // Only render html old idevice
        if (!isInExe && $node && $node.length === 1 && $node.find('.exe-text-template').length === 0) {
            const html = $node.html();
            const newHtml = this.renderHtmlOldIdevice(data, $node);

        }

        const $btn = $(`#${data.ideviceId} input.feedbackbutton, #${data.ideviceId} input.feedbacktooglebutton`);
        if ($btn.length !== 1) return;

        const [textA, textB = textA] = $btn.val().split('|');
        $btn.val(textA).attr('data-text-a', textA).attr('data-text-b', textB);
        $btn.off('click').closest('.feedback-button').removeClass('clearfix');

        $btn.on('click', function () {
            if ($text.working) return false;
            $text.working = true;
            const btn = $(this);
            const feedbackEl = btn.closest('.feedback-button').next('.feedback');

            if (feedbackEl.is(':visible')) {
                btn.val(btn.attr('data-text-a'));
                feedbackEl.fadeOut(() => { $text.working = false; });
            } else {
                btn.val(btn.attr('data-text-b'));
                feedbackEl.fadeIn(() => { $text.working = false; });
            }
            $exeDevices.iDevice.gamification.math.updateLatex('.form-IDevice');

        });
        const dataString = JSON.stringify(data)
        const hasLatex = $exeDevices.iDevice.gamification.math.hasLatex(dataString);

        if (!hasLatex) return;
        const mathjaxLoaded = (typeof window.MathJax !== 'undefined');

        if (!mathjaxLoaded) {
            $exeDevices.iDevice.gamification.math.loadMathJax();
        } else {
            $exeDevices.iDevice.gamification.math.updateLatex('.form-IDevice');
        }
    },

    replaceResourceDirectoryPaths(newDir, htmlString) {
        let dir = newDir.trim();
        if (!dir.endsWith('/')) dir += '/';
        const custom = $('html').is('#exe-index')
            ? 'custom/'
            : '../custom/';

        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        doc.querySelectorAll('img[src], video[src], audio[src], a[href]')
            .forEach(el => {
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

    init(data, accessibility) { },

    createMainContent(content) {
        return `
            <div class="exe-text-activity">
                <div>${content}</div>
            </div>`;
    },

    createInfoHTML(durationText, durationValue, participantsText, participantsValue) {
        return `
            <dl>
                <div class="inline"><dt><span title="${durationText}">${durationText}</span></dt><dd>${durationValue}</dd></div>
                <div class="inline"><dt><span title="${participantsText}">${participantsText}</span></dt><dd>${participantsValue}</dd></div>
            </dl>`;
    },

    createFeedbackHTML(title, content) {
        return `
            <div class="iDevice_buttons feedback-button js-required">
                <input type="button" class="feedbacktooglebutton" value="${title}" />
            </div>
            <div class="feedback js-feedback js-hidden">${content}</div>`;
    }
};