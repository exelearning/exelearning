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

    init: function () {},

    renderView: function (data, accesibility, template, ideviceId) {
        data.msgs =
            typeof data.msgs == 'undefined' ? $casestudy.msgs : data.msgs;
        const htmlContent = this.createInterfaceCaseStudy(data);
        return template.replace('{content}', htmlContent);
    },

    renderBehaviour: function (data, accesibility, ideviceId) {
        data.msgs =
            typeof data.msgs == 'undefined' ? $casestudy.msgs : data.msgs;
        const $title = $('#' + data.ideviceId)
            .closest('article')
            .find('header h1.box-title');
        if (
            data.title &&
            data.title == 'Case Study' &&
            $title.text() == 'Case Study'
        ) {
            $title.text(data.msgs.msgCaseStudy);
        }
        this.addEvents(data);
        const dataString = JSON.stringify(data);
        if ($exeDevices.iDevice.gamification.math.hasLatex(dataString)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '.exe-casestudy-container'
            );
        }
    },

    createInterfaceCaseStudy: function (data) {
        const infoContentHTML = $casestudy.createInfoHTML(
            data.textInfoDurationInput === ''
                ? ''
                : data.textInfoDurationTextInput,
            data.textInfoDurationInput,
            data.textInfoParticipantsInput === ''
                ? ''
                : data.textInfoParticipantsTextInput,
            data.textInfoParticipantsInput
        );
        const history = data.history;
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

    generateActivities: function (data) {
        return data.activities
            .map((activity, index) => {
                const activity1 = activity.activity;
                const feedback = activity.feedback;
                const button = activity.buttonCaption || data.msgs.msgFeedback;
                const bgClass = index % 2 ? 'CSP-ActivityDivBlack' : '';
                const hasFeedback = feedback.trim().length > 0;

                return `
                <div class="CSP-ActivityDiv ${bgClass}">
                    <div class="CSP-Activity mb-3">
                        ${activity1}
                    </div>
                    ${
                        hasFeedback
                            ? `
                    <div class="iDevice_buttons feedback-button">
                        <button type="button" class="CSP-FeedbackBtn feedbacktooglebutton">
                            ${button}
                        </button>
                    </div>`
                            : ''
                    }
                    <div class="CSP-FeedbackText" style="display: none;">
                        ${feedback}
                    </div>
                </div>
            `;
            })
            .join('');
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

    addEvents: function (data) {
        $(`.CSP-Activities`).off('click', '.CSP-FeedbackBtn');
        $(`.CSP-Activities`).on('click', '.CSP-FeedbackBtn', function () {
            const $activityDiv = $(this).closest('.CSP-ActivityDiv');
            const $fb = $activityDiv.find('.CSP-FeedbackText');
            $fb.slideToggle(200, function () {
                $exeDevices.iDevice.gamification.math.updateLatex(
                    '.CSP-FeedbackText'
                );
            });
        });
    },
};
