/* eslint-disable no-undef */
/**
 * Case study (editon code)
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    i18n: {
        name: _('Case study'),
    },
    ideviceBody: null,
    idevicePath: '',
    idevicePreviousData: null,
    id: null,

    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.id = $(element).attr('idevice-id');
        this.createForm();
    },

    createForm: function () {
        const html = `
        <div id="caseStudyForm" class="container-fluid">
            <div id="textEditorGroup_parent" class="exe-parent">
                <fieldset id="textInfo" class="exe-advanced exe-fieldset exe-fieldset-closed mb-4 rounded">
                    <legend class="exe-text-legend h6 mb-3">
                        <a href="#" class="text-decoration-none">${_('Task information (optional)')}</a>
                    </legend>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="cseDurationValue" class="form-label">${_('Task information (optional)')}:</label>
                                <input type="text" id="cseDurationValue" name="textInfoDurationInput"
                                    class="form-control" placeholder="${_('00:00')}" value=""
                                    onfocus="this.select()">
                            </div>
                            <div class="mb-3">
                                <label for="cseDurationText" class="form-label">${_('Text to display')}:</label>
                                <input type="text" id="cseDurationText" name="textInfoDurationTextInput"
                                    class="form-control" value="${_('Duration')}"
                                    onfocus="this.select()">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="cseParticipantsvalue" class="form-label">${_('Participants')}:</label>
                                <input type="text" id="cseParticipantsvalue" name="textInfoParticipantsInput"
                                    class="form-control" placeholder="${_('Number or description')}" value=""
                                    onfocus="this.select()">
                            </div>
                            <div class="mb-3">
                                <label for="cseParticipantsText" class="form-label">${_('Text to display')}:</label>
                                <input type="text" id="cseParticipantsText" name="textInfoParticipantsTextInput"
                                    class="form-control" value="${_('Grouping')}"
                                    onfocus="this.select()">
                            </div>
                        </div>
                    </div>
                </fieldset>

                <fieldset id="textStory" class="exe-advanced exe-fieldset exe-fieldset-open mb-4 rounded">
                    <legend class="exe-text-legend h6 mb-3">
                        <a href="#" class="text-decoration-none">${_('History')}</a>
                    </legend>
                    <div class="mb-3">
                        <textarea id="textStoryTextarea" class="form-control exe-html-editor" rows="5" aria-hidden="true"></textarea>
                    </div>
                </fieldset>
                <fieldset id="textActivities" class="exe-advanced exe-fieldset exe-fieldset-open mb-4 rounded">
                    <legend class="exe-text-legend h6 mb-3">
                        <a href="#" class="text-decoration-none">${_('Activities')}</a>
                    </legend>
                    <div id="cseActivities" class="CSE-Activities mb-3">
                        ${this.getActivity()}
                    </div>
                    <div>
                        <button type="button" id="cseAddActivity" class="btn btn-primary">
                            ${_('Add activity')}
                        </button>
                    </div>
                </fieldset>

            </div>
        </div>
    `;

        this.ideviceBody.innerHTML = html;
        this.enable();
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

    getActivity: function () {
        const id = this.generateUniqueId('activity');
        return `
        <div class="CSE-Activity mb-4  rounded" data-activity-id="${id}">        
            <div class="mb-4">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <label for="activityTextarea-${id}" class="form-label mb-0">${_('Activity')}:</label>
                    <button type="button"
                            class="btn btn-danger btn-sm text-white rounded-pill px-3 py-1 CSE-DeleteActivity"
                            title="${_('Delete activity')}">
                     ${_('Delete')}
                    </button>
                </div>            
                <textarea id="activityTextarea-${id}"
                          class="form-control exe-html-editor"
                          aria-hidden="true"
                          rows="4">
                </textarea>
            </div>
            <div class="mb-4">
                <label for="activityButtonTextInput-${id}" class="form-label">${_('Button text')}:</label>
                <input type="text"
                    id="activityButtonTextInput-${id}"
                    class="form-control ideviceTextfield"
                    value="${_('Show Feedback')}"
                    onfocus="this.select()"
                    style="max-width:250px">
            </div>
            <div class="mb-0">
                <label for="activityFeedbackTextarea-${id}" class="form-label">${_('Feedback')}:</label>
                <textarea id="activityFeedbackTextarea-${id}"
                          class="form-control exe-html-editor"
                          aria-hidden="true"
                          rows="4"></textarea>
            </div>        
        </div>
    `;
    },

    enable: function () {
        this.loadPreviousValues();
        this.addEvents();
    },

    generateUniqueId: (function () {
        let counter = 0;
        return function (prefix = 'id') {
            counter++;
            return `${prefix}_${Date.now()}_${counter}`;
        };
    })(),

    enable: function () {
        this.loadPreviousValues();
        this.addEvents();
    },

    addEvents: function () {
        const self = this;
        $('#cseAddActivity').on('click', function () {
            $('#cseActivities').append(self.getActivity());
            $exeTinyMCE.init('multiple-visible', '.exe-html-editor');
        });

        $('#cseActivities').on('click', '.CSE-DeleteActivity', function () {
            const $activities = $('#cseActivities .CSE-Activity');
            if ($activities.length > 1) {
                eXe.app.confirm(
                    _('Attention'),
                    _('Do you want to delete this activity?'),
                    () => {
                        $(this).closest('.CSE-Activity').remove();
                    }
                );
            } else {
                eXe.app.alert(
                    _('The case study must have at least one activity')
                );
            }
        });
    },
    loadPreviousValues: function () {
        const data = this.idevicePreviousData;
        if (!data || Object.keys(data).length === 0) return;
        $('#cseDurationValue').val(data.textInfoDurationInput);
        $('#cseDurationText').val(data.textInfoDurationTextInput);
        $('#cseParticipantsvalue').val(data.textInfoParticipantsInput);
        $('#cseParticipantsText').val(data.textInfoParticipantsTextInput);
        $('#textStoryTextarea').val(data.history);

        const $container = $('#cseActivities').empty();

        data.activities.forEach((act) => {
            const $activity = $(this.getActivity());
            const txtId = $activity
                .find('textarea[id^="activityTextarea-"]')
                .attr('id');
            const fbId = $activity
                .find('textarea[id^="activityFeedbackTextarea-"]')
                .attr('id');
            const btnId = $activity
                .find('input[id^="activityButtonTextInput-"]')
                .attr('id');
            $activity.find(`#${txtId}`).val(act.activity);
            $activity.find(`#${fbId}`).val(act.feedback);
            $activity.find(`#${btnId}`).val(act.buttonCaption);
            $container.append($activity);
        });

        const $title = $('#' + $exeDevice.id)
            .closest('article')
            .find('header h1.box-title');
        if (
            data.title &&
            data.title == 'Case Study' &&
            $title.text() == 'Case Study'
        ) {
            $title.text(_('Case study'));
        }

        $exeTinyMCE.init('multiple-visible', '.exe-html-editor');
    },

    save: function () {
        const dataGame = this.validateData();
        return dataGame || false;
    },

    validateData: function () {
        const storyEditor = tinymce.get('textStoryTextarea');
        const history = storyEditor ? storyEditor.getContent() : '';
        let valid = true;

        if (!storyEditor.getContent().trim()) {
            eXe.app.alert(_('Please complete the history'));
            return false;
        }

        const activities = [];
        $('#cseActivities .CSE-Activity').each(function () {
            const $act = $(this);
            const textareaId = $act
                .find('textarea[id^="activityTextarea-"]')
                .attr('id');
            const fbareaId = $act
                .find('textarea[id^="activityFeedbackTextarea-"]')
                .attr('id');
            const btnInput = $act.find('input[id^="activityButtonTextInput-"]');

            const activityEditor = tinymce.get(textareaId);
            const feedbackEditor = tinymce.get(fbareaId);

            const actTextPlain = activityEditor
                .getContent({ format: 'text' })
                .trim();
            if (!actTextPlain) {
                eXe.app.alert(_('You must provide the text for each activity'));
                valid = false;
                return;
            }

            const activity = activityEditor.getContent();
            const feedback = feedbackEditor.getContent();
            const buttonCaption = btnInput.val().trim();

            activities.push({
                activity: activity,
                feedback: feedback,
                buttonCaption: buttonCaption,
            });
        });

        if (!valid) return false;

        const textInfoDurationInput = $('#cseDurationValue').val().trim();
        const textInfoDurationTextInput = $('#cseDurationText').val().trim();
        const textInfoParticipantsInput = $('#cseParticipantsvalue')
            .val()
            .trim();
        const textInfoParticipantsTextInput = $('#cseParticipantsText')
            .val()
            .trim();

        return {
            id: this.id,
            typeGame: 'Case study',
            history,
            textInfoDurationInput,
            textInfoDurationTextInput,
            textInfoParticipantsInput,
            textInfoParticipantsTextInput,
            activities: activities,
        };
    },
};
