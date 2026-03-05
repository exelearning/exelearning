/**
 * Web Component iDevice (edition code)
 * Version: 1
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narvaez Martinez
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */

var $exeDevice = {
    name: 'webcomponent',
    title: _('Web Component'),
    msgs: {},
    classIdevice: 'webcomponent',
    version: 1.0,
    id: false,
    ci18n: {},

    init: function (element, previousData, path) {
        if (!element) return;
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.id = '';
        this.refreshTranslations();
        this.setMessagesInfo();
        this.createForm();
    },

    refreshTranslations: function () {
        this.ci18n = {
            msgSubmit: c_('Submit'),
            msgPlayStart: c_('Click here to play'),
            msgMinimize: c_('Minimize'),
            msgMaximize: c_('Maximize'),
            msgFullScreen: c_('Full Screen'),
            msgExitFullScreen: c_('Exit Full Screen'),
            msgScoreScorm: c_("The score can't be saved because this page is not part of a SCORM package."),
            msgOnlySaveScore: c_('You can only save the score once!'),
            msgOnlySave: c_('You can only save once'),
            msgOnlySaveAuto: c_('Your score will be saved after each question. You can only play once.'),
            msgSaveAuto: c_('Your score will be automatically saved after each question.'),
            msgYouScore: c_('Your score'),
            msgSeveralScore: c_('You can save the score as many times as you want'),
            msgYouLastScore: c_('The last score saved is'),
            msgActityComply: c_('You have already done this activity.'),
            msgPlaySeveralTimes: c_('You can do this activity as many times as you want'),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgTypeGame: c_('Web Component'),
            msgClue: c_('Cool! The clue is:'),
            msgCodeAccess: c_('Access code'),
            msgInformation: c_('Information'),
        };
    },

    setMessagesInfo: function () {
        const msgs = this.msgs;
        msgs.msgIDLength = _('The report identifier must have at least 5 characters');
        msgs.msgNoSupportBrowser = _('Your browser is not compatible with this tool.');
    },

    createForm: function () {
        const path = $exeDevice.idevicePath;
        const html = `
            <div id="wcQIdeviceForm">
                <p class="exe-block-info exe-block-dismissible" style="position:relative">
                    ${_('Create a custom web component by writing HTML and JavaScript code.')}
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">                   
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">API</a></legend>
<div>
<p>${_('Use the following API in your web component JavaScript to communicate results to the iDevice:')}</p>
<pre class="wc-api-doc">// ${_('Get the API reference (call once when the component initializes):')}
const api = this.closest('.WCP-MainContainer').exeAPI;

// ${_('Notify that the activity has started (call when the user begins):')}
api.start();

// ${_('Send a partial or final score:')}
// hits:   ${_('number of correct answers')}
// misses: ${_('number of incorrect answers')}
// total:  ${_('total number of evaluable items (0 if there is no fixed total)')}
//         ${_('score is then calculated as: hits / (hits + misses) × 10 at the end')}
// isEnd:  ${_('true for the final submission, false for intermediate updates')}
api.sendScore(hits, misses, total, isEnd);

// ${_('Shorthand for the final submission (equivalent to sendScore with isEnd=true):')}
api.end(hits, misses, total);

// ─────────────────────────────────────────────
// ${_('USE CASE 1 — Quiz / questionnaire (known total)')}
// ${_('Score = (hits × 10) / total. Partial sends update the score progressively.')}
// ─────────────────────────────────────────────
// ${_('On each correct answer:')}
api.sendScore(numHits, numMisses, totalQuestions, false);
// ${_('When the quiz ends:')}
api.end(numHits, numMisses, totalQuestions);

// ─────────────────────────────────────────────
// ${_('USE CASE 2 — Time-based game (no fixed total)')}
// ${_('Score = (hits × 10) / (hits + misses), calculated only at the end.')}
// ${_('Intermediate sendScore calls with total=0 are ignored.')}
// ─────────────────────────────────────────────
// ${_('When the time runs out or the game ends:')}
api.end(numHits, numMisses, 0);

// ─────────────────────────────────────────────
// ${_('USE CASE 3 — Sequential levels (known maximum)')}
// ${_('Score = (levelsCompleted × 10) / totalLevels.')}
// ─────────────────────────────────────────────
// ${_('After completing each level (partial update):')}
api.sendScore(levelsCompleted, 0, totalLevels, false);
// ${_('When the game ends (victory or defeat):')}
api.end(levelsCompleted, 0, totalLevels);

// ─────────────────────────────────────────────
// ${_('USE CASE 4 — Open simulator (no score)')}
// ${_('Just notify that the user interacted with the component.')}
// ─────────────────────────────────────────────
api.start();
// ${_('No sendScore needed if there is nothing to evaluate.')}</pre>
</div>
                    </fieldset>
                    <fieldset class="exe-fieldset">
                        <legend><a href="#">${_('Build your web component with this editor')}</a></legend>
                        <div>
                            <p>
                                <label for="eXeGameInstructions" class="sr-av">${_('Build your web component with this editor')}:</label>
                                <textarea id="eXeGameInstructions" class="exe-html-editor form-control exe-instructions-textarea" rows="4"></textarea>
                            </p>
                            <div class="d-flex align-items-center gap-2 mb-3 flex-wrap">
                                <span class="toggle-item mb-0" data-target="wcEEvaluationIDWrapper" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" class="toggle-input" id="wcEEvaluation" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="wcEEvaluation">${_('Progress report')}.</label>
                                </span>
                                <span id="wcEEvaluationIDWrapper" class="d-flex align-items-center gap-1">
                                    <label for="wcEEvaluationID" class="mb-0">${_('Identifier')}:</label>
                                    <input type="text" id="wcEEvaluationID" disabled class="form-control" value="${eXeLearning.app.project.odeId || ''}" />
                                </span>
                                <strong class="GameModeLabel">
                                    <a href="#wcEEvaluationHelp" id="wcEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                        <img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}" />
                                    </a>
                                </strong>
                            </div>
                            <p id="wcEEvaluationHelp" class="WCE-TypeGameHelp exe-block-info">
                                ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                            </p>
                        </div>
                    </fieldset>
                    ${$exeDevicesEdition.iDevice.common.getTextFieldset('after')}
                </div>
                ${$exeDevicesEdition.iDevice.gamification.itinerary.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.scorm.getTab(true, true, true)}
                ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
            </div>
        `;
        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('wcQIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();
        this.enableForm();
    },

    enableForm: function () {
        $('.exe-block-dismissible .exe-block-close').on('click', function () {
            $(this).parent().fadeOut();
            return false;
        });
        $('#wcEEvaluation').on('change', function () {
            $('#wcEEvaluationID').prop('disabled', !this.checked);
        });
        $('#wcEEvaluationHelpLnk').on('click', function () {
            $('#wcEEvaluationHelp').toggle();
            return false;
        });
        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();
        $exeDevice.loadPreviousValues();
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;
        if (!originalHTML || !Object.keys(originalHTML).length) return;
        const wrapper = $('<div></div>').html(originalHTML);
        const json = $('.webcomponent-DataGame', wrapper).text();
        const dataGame =
            $exeDevices.iDevice.gamification.helpers.isJsonString(json);
        const evaluationNode = $('.game-evaluation-ids', wrapper).eq(0);
        const previousId = evaluationNode.attr('data-id') || '';
        if (previousId) {
            $exeDevice.id = previousId;
        }
        const instructions = $('.webcomponent-instructions', wrapper);
        if (instructions.length === 1)
            $('#eXeGameInstructions').val(instructions.html());
        const textAfter = $('.webcomponent-extra-content', wrapper);
        if (textAfter.length === 1)
            $('#eXeIdeviceTextAfter').val(textAfter.html());

        if (dataGame) {
            if (dataGame.id) {
                $exeDevice.id = dataGame.id;
            }
 
            $exeDevicesEdition.iDevice.gamification.scorm.setValues(
                dataGame.isScorm,
                dataGame.textButtonScorm,
                dataGame.repeatActivity,
                dataGame.weighted
            );
            $('#wcEEvaluation').prop('checked', !!dataGame.evaluation);
            $('#wcEEvaluationID').val(dataGame.evaluationID || '');
            $('#wcEEvaluationID').prop('disabled', !dataGame.evaluation);
            $exeDevicesEdition.iDevice.gamification.itinerary.setValues(dataGame.itinerary);
            $exeDevicesEdition.iDevice.gamification.common.setLanguageTabValues(dataGame.msgs);
        }
    },

    save: function () {
        const dataGame = $exeDevice.validateData();
        if (!dataGame) return false;
        const ideviceId =
            $exeDevice.getIdeviceID() || $exeDevice.id || dataGame.id || '';
        dataGame.id = ideviceId;
        $exeDevice.id = ideviceId;

        const i18n = { ...this.ci18n };
        Object.keys(this.ci18n).forEach((key) => {
            const val = $('#ci18n_' + key).val();
            if (val) i18n[key] = val;
        });
        dataGame.msgs = i18n;

        const instructions = $exeDevice.sanitizeHtml(
            tinyMCE.get('eXeGameInstructions')?.getContent() || ''
        );
        const textAfter = tinyMCE.get('eXeIdeviceTextAfter')?.getContent() || '';

        dataGame.instructions = instructions ? encodeURIComponent(instructions) : '';
        dataGame.textAfter = textAfter ? encodeURIComponent(textAfter) : '';

        const json = JSON.stringify(dataGame);
        let divContent = instructions
            ? `<div class="webcomponent-instructions">${instructions}</div>`
            : '';

        divContent += `<div class="webcomponent-DataGame js-hidden">${json}</div>`;
        divContent += `<div class="game-evaluation-ids js-hidden" data-id="${ideviceId}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;

        if (textAfter) {
            divContent += `<div class="webcomponent-extra-content">${textAfter}</div>`;
        }
        return `<div class="webcomponent-IDevice">${divContent}</div>`;
    },

    getIdeviceID: function () {
        const $form = $('#wcQIdeviceForm');
        const byClass =
            $form.closest(`div.idevice_node.${$exeDevice.classIdevice}`).attr('id') ||
            '';
        if (byClass) return byClass;
        const byNode = $form.closest('div.idevice_node').attr('id') || '';
        if (byNode) return byNode;
        return $exeDevice.id || '';
    },

    validateData: function () {
        const id = $exeDevice.getIdeviceID() || $exeDevice.id || '',
            itinerary = $exeDevicesEdition.iDevice.gamification.itinerary.getValues(),
            scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues(),
            evaluation = $('#wcEEvaluation').is(':checked'),
            evaluationID = $('#wcEEvaluationID').val();

        if (evaluation && evaluationID.length < 5) {
            eXe.app.alert($exeDevice.msgs.msgIDLength);
            return false;
        }
        if (!itinerary) return false;

        return {
            typeGame: 'Web Component',
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: true,
            itinerary,
            weighted: scorm.weighted ?? 100,
            version: $exeDevice.version,
            evaluation,
            evaluationID,
            id,
        };
    },

    sanitizeHtml: function (html) {
        if (!html) return html;
        const tpl = document.createElement('template');
        tpl.innerHTML = html;
        tpl.content.querySelectorAll('[src], [href]').forEach(el => {
            ['src', 'href'].forEach(attr => {
                const val = el.getAttribute(attr);
                if (val && /^["']/.test(val)) {
                    el.setAttribute(attr, val.replace(/^["']+|["']+$/g, ''));
                }
            });
        });
        const div = document.createElement('div');
        div.appendChild(tpl.content.cloneNode(true));
        return div.innerHTML;
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },
};
