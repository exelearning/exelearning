/* eslint-disable no-undef */
/**
 * Case study (export code)
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $casestudy = {
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

    userName: '',
    previousScore: '',
    initialScore: '',
    mScorm: null,

    msgs: {
        msgNoImage: 'Sin imagen',
        msgFeedback: 'Mostrar retroalimentación',
        msgCaseStudy: 'Caso práctico',
    },

    init: function () {
    },

    renderView: function (data, accesibility, template, ideviceId) {
        data.msgs = typeof data.msgs == "undefined" ? $casestudy.msgs : data.msgs
        const htmlContent = this.createInterfaceCaseStudy(data);
        return template.replace('{content}', htmlContent);
    },

    renderBehaviour: function (data, accesibility, ideviceId) {
        data.msgs = typeof data.msgs == "undefined" ? $casestudy.msgs : data.msgs
        const $title = $('#' + data.ideviceId).closest('article').find('header h1.box-title');
        if (data.title && data.title == 'Case Study' && $title.text() == 'Case Study') {
            $title.text(data.msgs.msgCaseStudy)
        }
        this.addEvents(data);
    },

    createInterfaceCaseStudy: function (data) {
        const infoContentHTML = $casestudy.createInfoHTML(
            data.textInfoDurationInput === "" ? "" : data.textInfoDurationTextInput,
            data.textInfoDurationInput,
            data.textInfoParticipantsInput === "" ? "" : data.textInfoParticipantsTextInput,
            data.textInfoParticipantsInput
        );
        const history = $casestudy.replaceDirPath(data.history, data.ideviceId);
        return `
        <div class="caseStudyContent">            
            <div class="CSP-Info mb-3">
                ${infoContentHTML}
            </div>
            <div class="CSP-History mb-3" >
                ${history}
            </div>
            <div class="CSP-Activities mb-3">
                ${this.generateActivities(data)}
            </div>
        </div>
    `;
    },

    replaceDirPath(htmlString, ideviceId) {
        const node = document.getElementById(ideviceId);
        if (!node || eXe.app.isInExe() || !htmlString) return htmlString;

        const idRes = node.getAttribute('id-resource') || '';
        if (!idRes) return htmlString;

        const basePath = document.documentElement.id === 'exe-index'
            ? `content/resources/${idRes}/`
            : `../content/resources/${idRes}/`;

        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        doc.querySelectorAll('img[src], video[src], audio[src], a[href], source[src]')
            .forEach(el => {
                const attr = el.hasAttribute('src') ? 'src' : 'href';
                let val = el.getAttribute(attr).trim();
                try {
                    const u = new URL(val, window.location.origin);
                    if (/^\/?files\//.test(u.pathname)) {
                        const filename = u.pathname.split('/').pop() || '';
                        el.setAttribute(attr, basePath + filename);
                    }
                } catch {
                    // 
                }
            });

        return doc.body.innerHTML;
    },

    generateActivities: function (data) {
        return data.activities
            .map((activity, index) => {
                const activity1 = $casestudy.replaceDirPath(activity.activity, data.ideviceId);
                const feedback = $casestudy.replaceDirPath(activity.feedback, data.ideviceId);
                const button = activity.buttonCaption || data.msgs.msgFeedback;
                const bgClass = index % 2 ? 'CSP-ActivityDivBlack' : '';
                const hasFeedback = feedback.trim().length > 0;

                return `
                <div class="CSP-ActivityDiv ${bgClass}">
                    <div class="CSP-Activity mb-3">
                        ${activity1}
                    </div>
                    ${hasFeedback ? `
                    <button type="button" class="CSP-FeedbackBtn btn btn-primary mb-3">
                        ${button}
                    </button>` : ''}
                    <div class="CSP-FeedbackText" style="display: none;">
                        ${feedback}
                    </div>
                </div>
            `;
            })
            .join('');
    },

    createInfoHTML(durationText, durationValue, participantsText, participantsValue) {
        return `
            <dl>
                <div class="inline"><dt><span title="${durationText}">${durationText}</span></dt><dd>${durationValue}</dd></div>
                <div class="inline"><dt><span title="${participantsText}">${participantsText}</span></dt><dd>${participantsValue}</dd></div>
            </dl>`;
    },

    addEvents: function (data) {
        $(`.CSP-Activities`)
            .off('click', '.CSP-FeedbackBtn');
        $(`.CSP-Activities`)
            .on('click', '.CSP-FeedbackBtn', function () {
                const $activityDiv = $(this).closest('.CSP-ActivityDiv');
                const $fb = $activityDiv.find('.CSP-FeedbackText');
                $fb.slideToggle(200);
            });
    },

};
