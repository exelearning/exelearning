/* eslint-disable no-undef */
/**
 * Markdown Text iDevice (export code)
 */
var $markdowntext = {
    ideviceClass: 'markdownTextIdeviceContent',
    working: false,
    durationId: 'markdownInfoDurationInput',
    durationTextId: 'markdownInfoDurationTextInput',
    participantsId: 'markdownInfoParticipantsInput',
    participantsTextId: 'markdownInfoParticipantsTextInput',
    mainContentId: 'markdownTextarea',
    mainContentHtmlId: 'markdownTextareaHtml',
    feedbackTitleId: 'markdownFeedbackInput',
    feedbackContentId: 'markdownFeedbackTextarea',
    feedbackContentHtmlId: 'markdownFeedbackTextareaHtml',
    defaultBtnFeedbackText: $exe_i18n.showFeedback,

    renderView(data, accessibility, template, ideviceId, pathMedia) {
        const htmlData = this.getHTMLView(data, pathMedia);
        return template.replace('{content}', htmlData);
    },

    getHTMLView(data, pathMedia) {
        const isInExe = eXe.app.isInExe();
        const durationTextRaw = data[this.durationTextId] || '';
        const participantsTextRaw = data[this.participantsTextId] || '';
        const durationText = isInExe ? c_(durationTextRaw) : durationTextRaw;
        const participantsText = isInExe
            ? c_(participantsTextRaw)
            : participantsTextRaw;

        let infoContentHTML = '';
        if (data[this.durationId] || data[this.participantsId]) {
            infoContentHTML = this.createInfoHTML(
                data[this.durationId] === '' ? '' : durationText,
                data[this.durationId] || '',
                data[this.participantsId] === '' ? '' : participantsText,
                data[this.participantsId] || ''
            );
        }

        const remap = (rawKey, htmlKey) => {
            const html = this.extractMarkdownHtml(data, rawKey, htmlKey);
            return !isInExe && pathMedia
                ? this.replaceResourceDirectoryPaths(pathMedia, html)
                : html;
        };
        const contentHtml = remap(this.mainContentId, this.mainContentHtmlId);
        const feedbackHtml = remap(
            this.feedbackContentId,
            this.feedbackContentHtmlId
        );

        let buttonFeedbackText = data[this.feedbackTitleId] || '';
        if (feedbackHtml) {
            buttonFeedbackText =
                buttonFeedbackText === ''
                    ? this.defaultBtnFeedbackText
                    : buttonFeedbackText;
            if (isInExe) {
                buttonFeedbackText = c_(buttonFeedbackText);
            }
        }

        const feedbackContentHTML = feedbackHtml
            ? this.createFeedbackHTML(buttonFeedbackText, feedbackHtml)
            : '';
        const activityContent =
            infoContentHTML +
            contentHtml +
            feedbackContentHTML +
            '<p class="clearfix"></p>';

        let htmlContent = `<div class="${this.ideviceClass}">`;
        htmlContent += this.createMainContent(activityContent);
        htmlContent += `</div>`;

        return htmlContent;
    },

    renderBehaviour(data, accessibility, ideviceId) {
        const $node = $('#' + data.ideviceId);
        const $btn = $(
            `#${data.ideviceId} input.feedbackbutton, #${data.ideviceId} input.feedbacktooglebutton`
        );

        if ($btn.length === 1) {
            const [textA, textB = textA] = $btn.val().split('|');
            $btn.val(textA)
                .attr('data-text-a', textA)
                .attr('data-text-b', textB);
            $btn.off('click').closest('.feedback-button').removeClass('clearfix');

            $btn.on('click', (event) => {
                event.preventDefault();
                if ($markdowntext.working) {
                    return false;
                }
                $markdowntext.working = true;
                const btn = $(event.currentTarget);
                const feedbackEl = btn
                    .closest('.feedback-button')
                    .next('.feedback');

                if (feedbackEl.is(':visible')) {
                    btn.val(btn.attr('data-text-a'));
                    feedbackEl.fadeOut(() => {
                        $markdowntext.working = false;
                    });
                } else {
                    btn.val(btn.attr('data-text-b'));
                    feedbackEl.fadeIn(() => {
                        $markdowntext.working = false;
                    });
                }
                $exeDevices.iDevice.gamification.math.updateLatex(
                    '.exe-markdown-template'
                );
            });
        }

        const dataString = $node.html() || '';
        if (!$exeDevices.iDevice.gamification.math.hasLatex(dataString)) {
            return;
        }
        if (typeof window.MathJax === 'undefined') {
            $exeDevices.iDevice.gamification.math.loadMathJax();
        } else {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '.exe-markdown-template'
            );
        }
    },

    init(data, accessibility) {},

    extractMarkdownHtml(data, rawKey, htmlKey) {
        const html = data[htmlKey];
        if (html && typeof html === 'string' && html.trim() !== '') {
            return html;
        }
        // Fallback: if no pre-computed HTML, escape raw content
        const raw = data[rawKey] || '';
        return this.escapeHtml(raw);
    },

    escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    createMainContent(content) {
        return `
            <div class="exe-markdown-activity">
                <div class="markdown-body">${content}</div>
            </div>`;
    },

    createInfoHTML(
        durationText,
        durationValue,
        participantsText,
        participantsValue
    ) {
        const dt = this.escapeHtml(durationText);
        const dv = this.escapeHtml(durationValue);
        const pt = this.escapeHtml(participantsText);
        const pv = this.escapeHtml(participantsValue);
        return `
            <dl>
                <div class="inline"><dt><span title="${dt}">${dt}</span></dt><dd>${dv}</dd></div>
                <div class="inline"><dt><span title="${pt}">${pt}</span></dt><dd>${pv}</dd></div>
            </dl>`;
    },

    createFeedbackHTML(title, content) {
        return `
            <div class="iDevice_buttons feedback-button js-required">
                <input type="button" class="feedbacktooglebutton" value="${this.escapeHtml(title)}" />
            </div>
            <div class="feedback js-feedback js-hidden">${content}</div>`;
    },

    replaceResourceDirectoryPaths(newDir, htmlString) {
        let dir = newDir.trim();
        if (!dir.endsWith('/')) {
            dir += '/';
        }
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
};
