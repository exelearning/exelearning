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

    // Fullscreen: the same four-corner-arrows glyph as the Slide iDevice.
    // The button is added at runtime (renderBehaviour), so it is never saved
    // in the iDevice HTML and existing projects get it without re-editing.
    fullscreenWrapClass: 'text-fullscreen-wrap',
    fullscreenTargetClass: 'text-fullscreen-target',
    fullscreenBtnClass: 'text-fullscreen-btn',
    fullscreenActiveClass: 'text-fs-active',
    // In fullscreen the content is laid out at this width (CSS px) and zoomed
    // to fill the screen, up to fullscreenMaxZoom.
    fullscreenBaseWidth: 640,
    fullscreenMaxZoom: 2.75,
    // State of the CSS fallback (one target at a time), or null.
    cssFullscreen: null,
    fullscreenIcon:
        '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9"/></svg>',

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
        this.addFullscreenButton($node[0]);
    },

    /**
     * Label of the fullscreen button for the given state.
     * @param {boolean} expanded
     * @returns {string}
     */
    getFullscreenLabel(expanded) {
        const i18n = typeof $exe_i18n === 'object' && $exe_i18n ? $exe_i18n : {};
        return expanded
            ? i18n.exitFullScreen || 'Exit Full Screen'
            : i18n.fullScreen || 'Full screen';
    },

    /**
     * Add the fullscreen button to a rendered Text iDevice.
     * Idempotent: a node that already has the button is left unchanged.
     * @param {HTMLElement} node - The iDevice node (element with the iDevice id)
     * @returns {HTMLElement|null} The wrapper that holds the button, or null
     */
    addFullscreenButton(node) {
        if (!node || !node.querySelector) return null;
        // Editor preview: .exe-text-template or .idevice_body. Exported pages
        // render the content directly inside the iDevice node.
        const wrap =
            node.querySelector('.exe-text-template') ||
            node.querySelector('.idevice_body') ||
            node;
        if (this.getFullscreenButton(wrap)) return wrap;

        wrap.classList.add(this.fullscreenWrapClass);
        this.getFullscreenTarget(wrap).classList.add(this.fullscreenTargetClass);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = this.fullscreenBtnClass;
        btn.setAttribute('aria-label', this.getFullscreenLabel(false));
        btn.setAttribute('title', this.getFullscreenLabel(false));
        btn.innerHTML = this.fullscreenIcon;
        wrap.insertBefore(btn, wrap.firstChild);

        this.wireFullscreenEvents();
        return wrap;
    },

    /**
     * The fullscreen button that belongs to a wrapper (a direct child).
     * @param {HTMLElement} wrap
     * @returns {HTMLElement|undefined}
     */
    getFullscreenButton(wrap) {
        return Array.from(wrap.children).find((el) =>
            el.classList.contains(this.fullscreenBtnClass)
        );
    },

    /**
     * The element that goes fullscreen: in exported pages and preview, the
     * whole block (article.box), so its title is shown too. In the editor,
     * where the block also holds the editing controls, only the content.
     * @param {HTMLElement} wrap - The wrapper that holds the button
     * @returns {HTMLElement}
     */
    getFullscreenTarget(wrap) {
        const box = wrap.closest ? wrap.closest('article.box') : null;
        if (box && !box.closest('#node-content')) return box;
        return wrap;
    },

    /**
     * Whether a target is in fullscreen (native or CSS fallback).
     * @param {HTMLElement} target
     * @returns {boolean}
     */
    isFullscreen(target) {
        return (
            document.fullscreenElement === target ||
            target.classList.contains(this.fullscreenActiveClass)
        );
    },

    /**
     * Update the button label and the content zoom of a target to match its
     * state. The button keeps a single accessible name that says what it does
     * next ("Full screen" / "Exit Full Screen"), so no aria-pressed is used.
     * @param {HTMLElement} target
     */
    syncFullscreenButton(target) {
        const expanded = this.isFullscreen(target);
        const label = this.getFullscreenLabel(expanded);
        target.querySelectorAll('.' + this.fullscreenBtnClass).forEach((btn) => {
            btn.setAttribute('aria-label', label);
            btn.setAttribute('title', label);
        });
        if (expanded) this.updateFullscreenZoom(target);
        else target.style.removeProperty('--text-fs-zoom');
    },

    /**
     * Scale the content to the screen. The content is laid out at a fixed,
     * readable width (fullscreenBaseWidth) and then zoomed to fill the
     * available width, so everything grows in proportion: text in any unit
     * (em, rem, px, pt), images with the size the author gave them, tables
     * and embedded media. The zoom is capped so short lines stay readable.
     * @param {HTMLElement} target
     */
    updateFullscreenZoom(target) {
        const style = window.getComputedStyle(target);
        const available =
            target.clientWidth -
            (parseFloat(style.paddingLeft) || 0) -
            (parseFloat(style.paddingRight) || 0);
        let zoom = available > 0 ? available / this.fullscreenBaseWidth : 1;
        zoom = Math.min(this.fullscreenMaxZoom, Math.max(1, zoom));
        target.style.setProperty('--text-fs-zoom', String(Math.round(zoom * 100) / 100));
    },

    /**
     * Elements that can receive keyboard focus inside a container.
     * @param {HTMLElement} container
     * @returns {HTMLElement[]}
     */
    getFocusableElements(container) {
        const selector = [
            'a[href]',
            'area[href]',
            'button:not([disabled])',
            'input:not([disabled]):not([type="hidden"])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            'iframe',
            'audio[controls]',
            'video[controls]',
            '[contenteditable]:not([contenteditable="false"])',
            '[tabindex]:not([tabindex="-1"])',
        ].join(',');
        return Array.from(container.querySelectorAll(selector)).filter(
            (el) => !el.closest('[inert]') && this.isRendered(el, container)
        );
    },

    /**
     * Whether an element is rendered (not hidden by itself or by an ancestor
     * up to the container), so that it can actually take focus.
     * @param {HTMLElement} el
     * @param {HTMLElement} container
     * @returns {boolean}
     */
    isRendered(el, container) {
        for (let node = el; node && node !== container.parentNode; node = node.parentElement) {
            if (node.hidden) return false;
            const style = window.getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
        }
        return true;
    },

    /**
     * CSS-simulated fullscreen, used when the Fullscreen API is unavailable
     * or refused (e.g. inside an iframe without allowfullscreen).
     * Only one target uses it at a time. While it is active, the page behind
     * does not scroll (its previous overflow value is kept and restored),
     * keyboard focus stays inside the target, and focus goes back to where it
     * was on exit. If the target is removed from the page (e.g. re-rendered in
     * the editor), the fallback is cleaned up as well.
     * @param {HTMLElement} target
     * @param {boolean} active
     */
    setCssFullscreen(target, active) {
        const current = this.cssFullscreen;
        if (!active) {
            if (current && current.target === target) {
                this.endCssFullscreen();
            } else {
                target.classList.remove(this.fullscreenActiveClass);
                this.syncFullscreenButton(target);
            }
            return;
        }
        if (current && current.target === target) return;
        if (current) this.endCssFullscreen();

        const state = {
            target,
            returnFocus: document.activeElement,
            previousOverflow: document.body.style.overflow,
            observer: null,
        };
        this.cssFullscreen = state;
        target.classList.add(this.fullscreenActiveClass);
        document.body.style.overflow = 'hidden';
        if (typeof MutationObserver === 'function') {
            state.observer = new MutationObserver(() => {
                if (!target.isConnected) this.endCssFullscreen();
            });
            state.observer.observe(document.body, { childList: true, subtree: true });
        }
        this.syncFullscreenButton(target);
        const btn = target.querySelector('.' + this.fullscreenBtnClass);
        if (btn) btn.focus();
    },

    /**
     * Leave the CSS fallback and restore the page state it changed.
     */
    endCssFullscreen() {
        const state = this.cssFullscreen;
        if (!state) return;
        this.cssFullscreen = null;
        if (state.observer) state.observer.disconnect();
        const { target } = state;
        target.classList.remove(this.fullscreenActiveClass);
        document.body.style.overflow = state.previousOverflow;
        this.syncFullscreenButton(target);
        let back = state.returnFocus;
        if (!back || !back.isConnected || back === document.body) {
            back = target.isConnected
                ? target.querySelector('.' + this.fullscreenBtnClass)
                : null;
        }
        if (back && typeof back.focus === 'function') back.focus();
    },

    /**
     * Keep Tab / Shift+Tab inside the target while the CSS fallback is on.
     * @param {KeyboardEvent} e
     */
    trapFullscreenFocus(e) {
        const state = this.cssFullscreen;
        if (!state || e.key !== 'Tab') return;
        const items = this.getFocusableElements(state.target);
        if (!items.length) {
            e.preventDefault();
            return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const current = document.activeElement;
        const inside = state.target.contains(current);
        if (e.shiftKey && (!inside || current === first)) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && (!inside || current === last)) {
            e.preventDefault();
            first.focus();
        }
    },

    /**
     * Enter or leave fullscreen for a target.
     * @param {HTMLElement} target
     */
    toggleFullscreen(target) {
        if (document.fullscreenElement === target) {
            if (document.exitFullscreen) document.exitFullscreen();
            return;
        }
        if (target.classList.contains(this.fullscreenActiveClass)) {
            this.setCssFullscreen(target, false);
            return;
        }
        if (typeof target.requestFullscreen !== 'function') {
            this.setCssFullscreen(target, true);
            return;
        }
        try {
            const request = target.requestFullscreen();
            if (request && typeof request.catch === 'function') {
                request.catch(() => this.setCssFullscreen(target, true));
            }
        } catch (_e) {
            this.setCssFullscreen(target, true);
        }
    },

    /**
     * Document-level listeners, registered once for all Text iDevices.
     */
    wireFullscreenEvents() {
        if (document._textFullscreenWired) return;
        document._textFullscreenWired = true;
        const wrapSelector = '.' + this.fullscreenWrapClass;
        const targetSelector = '.' + this.fullscreenTargetClass;
        const syncAll = () => {
            document
                .querySelectorAll(targetSelector)
                .forEach((target) => this.syncFullscreenButton(target));
        };

        document.addEventListener('click', (e) => {
            const btn =
                e.target && e.target.closest
                    ? e.target.closest('.' + this.fullscreenBtnClass)
                    : null;
            if (!btn) return;
            const wrap = btn.closest(wrapSelector);
            if (wrap) this.toggleFullscreen(this.getFullscreenTarget(wrap));
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.endCssFullscreen();
                return;
            }
            this.trapFullscreenFocus(e);
        });

        document.addEventListener('fullscreenchange', syncAll);
        window.addEventListener('resize', () => {
            document
                .querySelectorAll(targetSelector)
                .forEach((target) => {
                    if (this.isFullscreen(target)) this.updateFullscreenZoom(target);
                });
        });
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
