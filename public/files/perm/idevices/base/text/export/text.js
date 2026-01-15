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
     *
     * Note: If content already exists in the DOM (rendered server-side),
     * we preserve it to maintain processed content like code highlighting,
     * styled icons, etc. This prevents regeneration from raw textTextarea
     * which would lose post-processing done during export.
     */
    renderView(data, accessibility, template) {
        // Check if content already exists in the DOM (was rendered server-side)
        // If so, preserve it to maintain processed content (code highlighting, etc.)
        const ideviceNode = document.getElementById(data.ideviceId);
        if (ideviceNode) {
            const existingContent = ideviceNode.querySelector('.' + this.ideviceClass);
            if (existingContent && existingContent.innerHTML.trim()) {
                // Content already exists from server-side render
                // Return null to prevent innerHTML replacement in exe_export.js
                // which calls: if (htmlIdevice) ideviceNode.innerHTML = htmlIdevice;
                return null;
            }
        }

        // Generate from JSON only when needed (empty content or db-no-data)
        const hmltdata = $text.getHTMLView(data);
        return template.replace('{content}', hmltdata);
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
            const inputEl = btnDiv.querySelector('input.feedbackbutton');
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
            feedbackContentHTML +
            `<p class="clearfix"></p>`;

        let htmlContent = `<div class="${this.ideviceClass}">`;
        htmlContent += this.createMainContent(activityContent);
        htmlContent += `</div>`;

        return htmlContent;
    },

    renderHtmlOldIdevice(data, $node) {
        // Defensive: ensure $node is a jQuery object
        if (!$node || !$node.length) return;

        if (
            $node.find('.pbl-task-description').length === 1 &&
            (data[this.durationId] || data[this.participantsId])
        ) {
            const durationText = data[this.durationTextId];
            const participantsText = data[this.participantsTextId];
            const infoContentHTML = this.createInfoHTML(
                data[this.durationId] === '' ? '' : durationText,
                data[this.durationId],
                data[this.participantsId] === '' ? '' : participantsText,
                data[this.participantsId]
            );

            $node.prepend(infoContentHTML);
        }

        let buttonFeedBackText = data[this.feedbackTitleId] || '';
        let feedBackHtml = data[this.feedbackContentId] || '';
        const hasFeedbackNode = $node.find('.feedback.js-feedback').length > 0;
        const hasFeedbackData = !!feedBackHtml;
        const hasFeedbackButton = $node.find('.feedback-button').length > 0;

        if (hasFeedbackData || hasFeedbackNode) {
            const $btnDiv = $node.find('.feedback-button');
            const hasInput =
                $btnDiv.find('input.feedbacktooglebutton, input.feedbackbutton')
                    .length > 0;
            if ($btnDiv.length && !hasInput) {
                const btnText = buttonFeedBackText
                    ? buttonFeedBackText
                    : this.defaultBtnFeedbackText;
                $btnDiv.append(
                    `<input type="button" class="feedbacktooglebutton" value="${btnText}" />`
                );
            } else if (!hasFeedbackButton) {
                const feedbackButtonHTML = `
                    <div class="iDevice_buttons feedback-button js-required">
                        <input type="button" class="feedbacktooglebutton" value="${buttonFeedBackText || this.defaultBtnFeedbackText}" />
                    </div>`;
                const $activity = $node.find('.exe-text');
                if ($activity.length) {
                    $activity.append(feedbackButtonHTML);
                } else {
                    $node.append(feedbackButtonHTML);
                }
            }
        }

        if (hasFeedbackData && !hasFeedbackNode) {
            const feedbackContentHTML = `<div class="feedback js-feedback js-hidden">${feedBackHtml}</div>`;
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

    init(data, accessibility) {
        // Process exe-dl definition lists within this iDevice that haven't been initialized yet
        // This ensures icons are generated for exe-dl elements that were loaded after
        // the initial $exe.dl.init() call on page load
        if (typeof $exe !== 'undefined' && typeof $ !== 'undefined') {
            const $idevice = $('#' + data.ideviceId);
            const exeDlElements = $idevice.find('dl.exe-dl');
            exeDlElements.each(function (i) {
                const e = this;
                // Skip if already processed (has togglers already)
                // This is more reliable than checking the ID, which can vary
                // between $exe.dl.init() ('exe-dl-0') and this function
                if ($('a.exe-dd-toggler', e).length > 0) {
                    return;
                }
                // Process this uninitialized exe-dl
                const bg = $exe.rgb2hex($(e).css('color'));
                const tc = $exe.useBlackOrWhite(bg.replace('#', ''));
                const s = " style='text-decoration:none;background:" + bg + ";color:" + tc + "'";
                // Generate unique ID for this element
                e.id = 'exe-dl-' + data.ideviceId + '-' + i;
                $('dt', e).each(function () {
                    const t = this;
                    const h = $(t).html();
                    $(t).html("<a href='#' class='exe-dd-toggler exe-dd-toggler-closed " + e.id + "-a'><span class='icon'" + s + ">+ </span>" + h + "</a>");
                });
                // Attach click handlers to the newly created togglers
                $('a.exe-dd-toggler', e).click(function () {
                    const anchor = $(this);
                    const icon = $('span.icon', this);
                    const dd = anchor.parent().next('dd');
                    if (anchor.hasClass('exe-dd-toggler-closed')) {
                        anchor.removeClass('exe-dd-toggler-closed');
                        icon.html('- ');
                        dd.show();
                    } else {
                        anchor.addClass('exe-dd-toggler-closed');
                        icon.html('+ ');
                        dd.hide();
                    }
                    return false;
                });
            });
        }

        // Re-initialize exe-fx effects (accordion, tabs, paginated, carousel) within this iDevice
        // These may not have been initialized if the content was loaded after $exeFX.init() ran
        if (typeof $exeFX !== 'undefined' && typeof $ !== 'undefined') {
            const $idevice = $('#' + data.ideviceId);
            const k = $exeFX.baseClass || 'exe';

            // Find all exe-fx elements within this iDevice
            const exeFxElements = $idevice.find('.' + k + '-fx');

            // Get the current global index to continue numbering from
            let globalIndex = $('.' + k + '-fx').index(exeFxElements.first());
            if (globalIndex < 0) globalIndex = 0;

            exeFxElements.each(function (localIndex) {
                const e = this;
                const c = e.className;
                const i = globalIndex + localIndex;

                // Initialize based on effect type
                if (c.indexOf(' ' + k + '-accordion') !== -1) {
                    $exeFX.accordion.init(e, i);
                } else if (c.indexOf(' ' + k + '-tabs') !== -1) {
                    $exeFX.tabs.init(e, i);
                } else if (c.indexOf(' ' + k + '-paginated') !== -1) {
                    $exeFX.paginated.init(e, i);
                } else if (c.indexOf(' ' + k + '-carousel') !== -1) {
                    $exeFX.carousel.init(e, i);
                }
            });
        }
    },

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
