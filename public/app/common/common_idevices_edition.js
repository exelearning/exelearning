/*
    See #91
    This is where $exeIDevicesEdition or a similar object should be
    Include here the code that should not be exported
    This code is required to edit the iDevices
*/
var $exeIDevicesEdition = {
    iDevice: {
        /**
         * Lifecycle of the edition currently open, if any.
         *
         * These helpers are shared by every edition script and run outside the
         * `$exeDevice` object, so they have no `this.$lifecycle`; `IdeviceNode`
         * publishes the same object as `window.$exeEditionLifecycle`. It is
         * null whenever no editor is open — and in tests that exercise the
         * helpers directly — in which case every helper must keep behaving
         * exactly as it did before.
         *
         * @returns {Object|null} The active lifecycle, or null.
         */
        getLifecycle: function () {
            var lifecycle = typeof window !== 'undefined' ? window.$exeEditionLifecycle : null;
            if (!lifecycle || typeof lifecycle.isActive !== 'function') return null;
            return lifecycle.isActive() ? lifecycle : null;
        },
        // Common
        common: {
            /**
             * Escape a value for HTML text or a quoted attribute value.
             *
             * @param {*} value
             * @returns {string}
             */
            escapeHtml: function (value) {
                return String(value ?? '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            },
            helpTooltipId: 0,
            /**
             * Inline information button: a short hover label and a persistent
             * explanation on click, using the editor's help window styling.
             * Pass localized text, e.g. getHelpTooltip(_('Explain this option.')).
             * tabs.bind initializes it automatically; forms without shared tabs
             * call initHelpTooltips after inserting their HTML.
             *
             * @param {string} text Localized explanation, rendered as plain text.
             * @returns {string}
             */
            getHelpTooltip: function (text) {
                const common = $exeIDevicesEdition.iDevice.common;
                const description = common.escapeHtml(text);
                const label = common.escapeHtml(_('Information'));
                const id = `exe-idevice-help-${++common.helpTooltipId}`;
                return `<span class="exe-form-help exe-idevice-help-container">
                            <button type="button" class="exe-app-tooltip exe-idevice-help" title="${label}" aria-label="${label}" aria-expanded="false" aria-controls="${id}">
                                <span class="info-icon-solid-green" aria-hidden="true"></span>
                            </button>
                            <span id="${id}" class="help-content help-hidden" role="note">${description}</span>
                        </span>`;
            },
            /**
             * Initialize help once and release it when its edition closes.
             * Returns a disposer for callers without an active edition lifecycle.
             */
            initHelpTooltips: function (element) {
                const buttons = Array.from(element?.querySelectorAll('.exe-idevice-help') || []);
                if (!buttons.length) return;
                const pending = buttons.filter((button) => !bootstrap.Tooltip.getInstance(button));
                eXeLearning.app.common.initTooltips(element);
                const lifecycle = $exeIDevicesEdition.iDevice.getLifecycle();
                const disposers = pending.map((button) => {
                    const tooltip = bootstrap.Tooltip.getInstance(button);
                    const content = document.getElementById(button.getAttribute('aria-controls'));
                    const fitContent = function () {
                        const panel = button.closest('.tab-pane') || element;
                        let right = Math.min(
                            document.documentElement.clientWidth || window.innerWidth,
                            panel.getBoundingClientRect().right,
                        );
                        // A scrollable editor can clip the panel before its own edge.
                        for (let parent = panel.parentElement; parent; parent = parent.parentElement) {
                            if (/auto|scroll|hidden|clip/.test(getComputedStyle(parent).overflowX)) {
                                right = Math.min(right, parent.getBoundingClientRect().right);
                            }
                        }
                        const left = button.parentElement.getBoundingClientRect().left;
                        content.style.maxWidth = `${Math.max(0, right - left - 8)}px`;
                    };
                    const hide = function () {
                        content.classList.add('help-hidden');
                        button.setAttribute('aria-expanded', 'false');
                        window.removeEventListener('resize', fitContent);
                        document.removeEventListener('scroll', fitContent, true);
                    };
                    // Capture also sees clicks whose own handlers stop propagation.
                    const outsideClick = function (event) {
                        if (!button.contains(event.target)) hide();
                    };
                    document.addEventListener('click', outsideClick, true);
                    $(button).on('click.exeHelpTooltip', function (event) {
                        event.stopPropagation();
                        tooltip.hide();
                        content.classList.remove('help-hidden');
                        button.setAttribute('aria-expanded', 'true');
                        fitContent();
                        window.addEventListener('resize', fitContent);
                        document.addEventListener('scroll', fitContent, true);
                    }).on('keydown.exeHelpTooltip', function (event) {
                        if (event.key === 'Escape') {
                            tooltip.hide();
                            hide();
                        }
                    });
                    const dispose = function () {
                        hide();
                        $(button).off('.exeHelpTooltip');
                        document.removeEventListener('click', outsideClick, true);
                        tooltip.dispose();
                    };
                    return lifecycle ? lifecycle.own(dispose) : dispose;
                });
                return () => disposers.forEach((dispose) => dispose());
            },
            getIdeviceDescription: function (text, url) {
                if (typeof text != "string") return "";

                var textHtml = _(text);
                var linkHtml = "";
                if (typeof url === "string" && url.length > 0) {
                    linkHtml = ` <a href="${url}" target="_blank" hreflang="es" class="alert-link">${_('Usage Instructions')}</a>`;
                }

                var closeBtnHtml = ` <button type="button" class="btn-close btn-close-sm" data-bs-dismiss="alert" aria-label="${_('Hide')}"></button>`;

                return `<p class="alert alert-info alert-dismissible fade show mb-3" role="alert">${textHtml}${linkHtml}${closeBtnHtml}</p>`;
            },
            /**
             * The "Content after" or "Content before" editor. The form tabs
             * give it a pane and a title of its own, so it has no fieldset;
             * the textarea keeps the id the iDevices load and save.
             *
             * @param {string} position "after" or "before".
             * @returns {string}
             */
            getTextEditor: function (position) {
                if (position !== 'after' && position !== 'before') return '';
                const title = position === 'before' ? _('Content before') : _('Content after');
                const id = position === 'before' ? 'eXeIdeviceTextBefore' : 'eXeIdeviceTextAfter';
                return `<label for="${id}" class="visually-hidden">${title}</label>
                        <textarea id="${id}" class="exe-html-editor"></textarea>`;
            }
        },
        // Gamification
        gamification: {
            common: {
                /**
                 * The custom texts for the Texts tab, in two columns of
                 * Bootstrap's grid. A field is either a string, used as both
                 * label and default value, or [label, value]. Each input is
                 * `ci18n_<key>`, the id setLanguageTabValues fills.
                 *
                 * @param {Object|Array} fields The iDevice's ci18n texts.
                 * @returns {string}
                 */
                getLanguageContents: function (fields) {
                    const escape = $exeIDevicesEdition.iDevice.common.escapeHtml;
                    let html = '';
                    for (const key in fields) {
                        const field = fields[key];
                        const label = typeof field === 'string' ? field : field[0];
                        const text = typeof field === 'string' || field.length !== 2 ? label : field[1];
                        const id = escape('ci18n_' + key);
                        html += `<div class="col ci18n">
                                <label for="${id}" class="form-label">${escape(label)}</label>
                                <input type="text" class="form-control" name="${id}" id="${id}" value="${escape(text)}" />
                            </div>`;
                    }
                    return `<div class="row row-cols-1 row-cols-md-2 g-3">${html}</div>`;
                },
                setLanguageTabValues: function (obj) {
                    if (typeof obj == "object") {
                        for (var i in obj) {
                            var v = obj[i];
                            if (v != "") $("#ci18n_" + i).val(v);
                        }
                    }
                },
            },
            instructions: {
                /**
                 * The instructions editor for the Instructions tab.
                 *
                 * @param {string} [str] Default instructions (HTML).
                 * @returns {string}
                 */
                getEditor: function (str) {
                    const text = $exeIDevicesEdition.iDevice.common.escapeHtml(typeof str === 'string' ? str : '');
                    return `<label for="eXeGameInstructions" class="visually-hidden">${_('Instructions')}</label>
                        <textarea id="eXeGameInstructions" class="exe-html-editor form-control exe-instructions-textarea" rows="4">${text}</textarea>`;
                }
            },
            progressBar: {
                getContents: function (path) {
                    return `<div class="exe-progress-report-wrapper" style="flex-basis:100%;width:100%">
                                <div class="d-flex align-items-center flex-wrap gap-2 mb-2">
                                    <div class="toggle-item m-0" idevice-id="eXeProgressReport">
                                        <span class="toggle-control">
                                            <input type="checkbox" id="eXeProgressReport" class="toggle-input" aria-label="${_('Progress report')}">
                                            <span class="toggle-visual"></span>
                                        </span>
                                        <label class="toggle-label" for="eXeProgressReport">${_('Progress report')}.</label>
                                    </div>
                                    <div class="d-flex align-items-center flex-nowrap gap-2">
                                        <label for="eXeProgressReportID" class="mb-0">${_('Identifier')}:</label>
                                        <input type="text" class="form-control form-control-sm" id="eXeProgressReportID" disabled value="${window.eXeLearning?.app?.project?.odeId || ''}"/>
                                        <a href="#eXeProgressReportHelp" id="eXeProgressReportHelpLnk" title="${_('Help')}">
                                            <img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}" style="width:18px;height:18px;min-width:18px;min-height:18px;max-width:18px;max-height:18px"/>
                                        </a>
                                    </div>
                                </div>
                                <div id="eXeProgressReportHelp" class="alert alert-info d-none">
                                    ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                                </div>
                            </div>`;
                },
                setValues: function (data) {
                    var evaluation = !!(data && data.evaluation);
                    var evaluationID = data && typeof data.evaluationID !== 'undefined' ? data.evaluationID : '';
                    $('#eXeProgressReport').prop('checked', evaluation);
                    $('#eXeProgressReportID').val(evaluationID);
                    $('#eXeProgressReportID').prop('disabled', !evaluation);
                },
                getValues: function () {
                    var evaluation = $('#eXeProgressReport').is(':checked');
                    var evaluationID = $.trim($('#eXeProgressReportID').val());
                    if (evaluation && evaluationID.length < 5) {
                        eXe.app.alert(_('The report identifier must have at least 5 characters'));
                        return false;
                    }
                    return {
                        evaluation: evaluation,
                        evaluationID: evaluationID
                    };
                },
                addEvents: function () {
                    $('#eXeProgressReport').on('change', function () {
                        var checked = $(this).is(':checked');
                        $('#eXeProgressReportID').prop('disabled', !checked);
                    });
                    var toggleHelp = function (e) {
                        e.preventDefault();
                        $('#eXeProgressReportHelp').toggleClass('d-none');
                    };
                    // Delegated on `document`, so it outlives the edition form.
                    // The legacy namespace still de-duplicates repeated calls;
                    // the edition owns the registration when one is open, which
                    // is what removes it on close.
                    $(document).off('click.exeProgressReportHelp', '#eXeProgressReportHelpLnk');
                    var lifecycle = $exeIDevicesEdition.iDevice.getLifecycle();
                    if (lifecycle) {
                        lifecycle.on(document, 'click.exeProgressReportHelp', '#eXeProgressReportHelpLnk', toggleHelp);
                    } else {
                        $(document).on('click.exeProgressReportHelp', '#eXeProgressReportHelpLnk', toggleHelp);
                    }
                }
            },
            /**
             * Collapsible help notes, the pattern the progress report has always
             * used: a small icon that toggles a note below the control.
             *
             * The Grading tab needs six of them, and the alternative was six
             * copies of the same anchor, the same inline sizing and the same
             * delegated handler.
             */
            help: {

                /**
                 * @param {string} id Identifier of the note this opens.
                 * @param {string} [path] The iDevice's asset path. Without it
                 * no icon is rendered, rather than one pointing at nothing.
                 * @returns {string} The icon markup, or '' when there is no path.
                 */
                icon: function (id, path) {
                    if (!path) return '';
                    return `<a href="#${id}" id="${id}Lnk" title="${_('Help')}">
                                <img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}" style="width:18px;height:18px;min-width:18px;min-height:18px;max-width:18px;max-height:18px"/>
                            </a>`;
                },

                /**
                 * @param {string} id Identifier the icon points at.
                 * @param {string[]} paragraphs Text of the note.
                 * @returns {string} The note markup, closed.
                 */
                note: function (id, paragraphs) {
                    const body = paragraphs
                        .map((text, index) => `<p class="${index === paragraphs.length - 1 ? 'mb-0' : 'mb-2'}">${text}</p>`)
                        .join('');
                    return `<div id="${id}" class="alert alert-info d-none mt-2">${body}</div>`;
                },

                /**
                 * Wire an icon to its note.
                 *
                 * Delegated and namespaced because addEvents runs again on
                 * every re-render: a direct handler would stack up one copy per
                 * render, and the note would flip once per copy -- i.e. appear
                 * not to toggle at all.
                 *
                 * @param {string} id Identifier of the note.
                 */
                bind: function (id) {
                    const event = `click.${id}`;
                    const selector = `#${id}Lnk`;
                    const toggleHelp = function (e) {
                        e.preventDefault();
                        $(`#${id}`).toggleClass('d-none');
                    };
                    // De-duplicate re-renders and release the document handler when the edition closes.
                    $(document).off(event, selector);
                    const lifecycle = $exeIDevicesEdition.iDevice.getLifecycle();
                    if (lifecycle) {
                        lifecycle.on(document, event, selector, toggleHelp);
                    } else {
                        $(document).on(event, selector, toggleHelp);
                    }
                }
            },
            /**
             * Minimum score an activity needs to be passed.
             *
             * Every iDevice offers the same choice: follow the project-wide value
             * or override it here. Only the choice and the override are saved --
             * the project value is read live from $exe.passScore every time the
             * iDevice is edited, so an iDevice left on "global" keeps following
             * the project even after the author changes it.
             *
             * Shared block, like progressBar above: one implementation, added to
             * each iDevice's form one at a time.
             */
            passScore: {

                MODE_GLOBAL: 'global',
                MODE_CUSTOM: 'custom',

                /**
                 * The project-wide value, or 5 when $exe is not around.
                 * @returns {number} A mark in [0, 10].
                 */
                getGlobalValue: function () {
                    if (typeof $exe != "undefined" && $exe.passScore) return $exe.passScore.get();
                    return 5;
                },

                /**
                 * Clamp a value to the same 0-10 one-decimal domain the project
                 * property uses, so a custom mark and a global one compare.
                 * @param {*} value
                 * @returns {number}
                 */
                normalize: function (value) {
                    if (typeof $exe != "undefined" && $exe.passScore) return $exe.passScore.normalize(value);
                    var parsed = parseFloat(value);
                    return isFinite(parsed) ? Math.round(Math.min(10, Math.max(0, parsed)) * 10) / 10 : 5;
                },

                /**
                 * @param {string} [path] The iDevice's own asset path, for the
                 * help icon. Without it the icon is left out rather than
                 * pointing at nothing.
                 */
                getContents: function (path) {
                    var global = $exeIDevicesEdition.iDevice.gamification.passScore.getGlobalValue();
                    return `<div class="exe-pass-score-wrapper" style="flex-basis:100%;width:100%">
                                <h3 class="exe-evaluation-section-title" id="eXePassScoreLabel">${_('Minimum score to pass the activity')}</h3>
                                <div class="d-flex align-items-center flex-wrap gap-3" role="radiogroup" aria-labelledby="eXePassScoreLabel">
                                    <div class="d-flex align-items-center gap-1">
                                        <input class="form-check-input" type="radio" name="eXePassScoreMode" id="eXePassScoreGlobal" value="global" checked />
                                        <label class="form-check-label mb-0" for="eXePassScoreGlobal">${_('Global value')} (<span id="eXePassScoreGlobalValue">${global}</span>)</label>
                                    </div>
                                    <div class="d-flex align-items-center gap-1">
                                        <input class="form-check-input" type="radio" name="eXePassScoreMode" id="eXePassScoreCustom" value="custom" />
                                        <label class="form-check-label mb-0" for="eXePassScoreCustom">${_('Customize')}</label>
                                    </div>
                                    <div id="eXePassScoreCustomOptions" class="d-flex align-items-center gap-2 d-none">
                                        <label for="eXePassScoreValue" class="sr-av">${_('Minimum score to pass the activity')}</label>
                                        <input type="number" id="eXePassScoreValue" name="eXePassScoreValue" class="form-control form-control-sm" min="0" max="10" step="0.1" value="${global}" style="width:9ch !important;max-width:9ch !important" />
                                    </div>
                                    ${$exeIDevicesEdition.iDevice.gamification.help.icon('eXePassScoreHelp', path)}
                                </div>
                                ${$exeIDevicesEdition.iDevice.gamification.help.note('eXePassScoreHelp', [
                                    _('Global value: the activity uses the mark set in the project properties. If you change it there, this activity follows.'),
                                    _('Customize: the activity uses its own mark and ignores the project one.'),
                                ])}
                            </div>`;
                },

                /**
                 * Repaint the number shown next to the "Global value" radio from
                 * the project. Called on every edition so the author never reads
                 * a figure the project has since moved on from.
                 */
                refreshGlobalValue: function () {
                    $('#eXePassScoreGlobalValue').text(
                        $exeIDevicesEdition.iDevice.gamification.passScore.getGlobalValue()
                    );
                },

                setValues: function (data) {
                    var passScore = $exeIDevicesEdition.iDevice.gamification.passScore;
                    var custom = data && data.passScoreMode === passScore.MODE_CUSTOM;

                    passScore.refreshGlobalValue();

                    // An iDevice that has never been customised starts the input
                    // at the project value, so switching to "Customize" offers a
                    // sensible mark instead of an empty box.
                    var value = data && typeof data.passScoreCustom !== 'undefined' && data.passScoreCustom !== ''
                        ? passScore.normalize(data.passScoreCustom)
                        : passScore.getGlobalValue();
                    $('#eXePassScoreValue').val(value);

                    $('#eXePassScoreCustom').prop('checked', custom);
                    $('#eXePassScoreGlobal').prop('checked', !custom);
                    $('#eXePassScoreCustomOptions').toggleClass('d-none', !custom);
                },

                getValues: function () {
                    var passScore = $exeIDevicesEdition.iDevice.gamification.passScore;
                    var custom = $('#eXePassScoreCustom').is(':checked');
                    return {
                        passScoreMode: custom ? passScore.MODE_CUSTOM : passScore.MODE_GLOBAL,
                        passScoreCustom: passScore.normalize($('#eXePassScoreValue').val())
                    };
                },

                addEvents: function () {
                    var passScore = $exeIDevicesEdition.iDevice.gamification.passScore;

                    $('input[type=radio][name="eXePassScoreMode"]').on('change', function () {
                        $('#eXePassScoreCustomOptions').toggleClass(
                            'd-none',
                            $(this).val() !== passScore.MODE_CUSTOM
                        );
                    });

                    // Repaint on blur so a field left empty or out of range shows
                    // the mark that will actually be saved.
                    $('#eXePassScoreValue').on('blur', function () {
                        $(this).val(passScore.normalize($(this).val()));
                    });

                    $exeIDevicesEdition.iDevice.gamification.help.bind('eXePassScoreHelp');
                }
            },
            itinerary: {
                getContents: function () {
                    return `
                        <div class="toggle-item mb-3" data-target="eXeGameShowCodeAccessOptions">
                            <span class="toggle-control">
                                <input type="checkbox" class="toggle-input" id="eXeGameShowCodeAccess" />
                                <span class="toggle-visual"></span>
                            </span>
                            <label class="toggle-label" for="eXeGameShowCodeAccess">${_("Access code is required")}</label>
                        </div>
                        <div id="eXeGameShowCodeAccessOptions" class="gap-3 mb-3" style="display:none; flex-wrap: nowrap;margin-left:1.4em;">
                            <div class="d-flex flex-column flex-grow-1" style="min-width:220px;max-width:300px;">
                                <label for="eXeGameCodeAccess" id="labelCodeAccess" class="mb-1">${_("Access code")}:</label>
                                <input type="text" name="eXeGameCodeAccess" id="eXeGameCodeAccess" class="form-control" maxlength="40" disabled />
                            </div>
                            <div class="d-flex flex-column flex-grow-1" style="min-width:260px">
                                <label for="eXeGameMessageCodeAccess" id="labelMessageAccess" class="mb-1">${_("Question")}:</label>
                                <input type="text" name="eXeGameMessageCodeAccess" id="eXeGameMessageCodeAccess" class="form-control" maxlength="200" disabled />
                            </div>
                        </div>
                        <div class="toggle-item mb-3" data-target="eXeGameShowClueOptions">
                            <span class="toggle-control">
                                <input type="checkbox" class="toggle-input" id="eXeGameShowClue" />
                                <span class="toggle-visual"></span>
                            </span>
                            <label class="toggle-label" for="eXeGameShowClue">${_("Display a message or password upon reaching the defined objective")}</label>
                        </div>
                        <div id="eXeGameShowClueOptions" class="gap-3 mb-3" style="margin-left:1.4em;display:none">
                            <div class="d-flex gap-1 mb-3 align-items-center">
                                <label for="eXeGameClue" class="mb-1">${_("Message")}:</label>
                                <input type="text" name="eXeGameClue" id="eXeGameClue" class="form-control" maxlength="50" disabled />
                            </div>
                            <div class="d-flex gap-1 align-items-center mb-3">
                                <label for="eXeGamePercentajeClue" id="labelPercentajeClue" class="mb-1">${_("Percentage of correct answers required to display the message")}:</label>
                                <select id="eXeGamePercentajeClue" class="form-select" disabled style="max-width:10ch;width:10ch;">
                                    <option value="10">10%</option>
                                    <option value="20">20%</option>
                                    <option value="30">30%</option>
                                    <option value="40" selected>40%</option>
                                    <option value="50">50%</option>
                                    <option value="60">60%</option>
                                    <option value="70">70%</option>
                                    <option value="80">80%</option>
                                    <option value="90">90%</option>
                                    <option value="100">100%</option>
                                </select>
                            </div>
                        </div>
                    `;
                },

                getValues: function () {
                    var showClue = $('#eXeGameShowClue').is(':checked'),
                        clueGame = $.trim($('#eXeGameClue').val()),
                        percentageClue = parseInt($('#eXeGamePercentajeClue').children("option:selected").val()),
                        showCodeAccess = $('#eXeGameShowCodeAccess').is(':checked'),
                        codeAccess = $.trim($('#eXeGameCodeAccess').val()),
                        messageCodeAccess = $.trim($('#eXeGameMessageCodeAccess').val());

                    if (showClue && clueGame.length == 0) {
                        eXe.app.alert(_("You must write a clue"));
                        return false;
                    }
                    if (showCodeAccess && codeAccess.length == 0) {
                        eXe.app.alert(_("You must provide the code to play this game"));
                        return false;
                    }
                    if (showCodeAccess && messageCodeAccess.length == 0) {
                        eXe.app.alert(_("Please explain how to obtain the code to play this game"));
                        return false;
                    }
                    var a = {
                        'showClue': showClue,
                        'clueGame': clueGame,
                        'percentageClue': percentageClue,
                        'showCodeAccess': showCodeAccess,
                        'codeAccess': codeAccess,
                        'messageCodeAccess': messageCodeAccess
                    }
                    return a;
                },
                setValues: function (a) {
                    $('#eXeGameShowClue').prop('checked', a.showClue);
                    if (a.showClue) $("#eXeGameShowClueOptions").show();
                    $('#eXeGameClue').val(a.clueGame);
                    $('#eXeGamePercentajeClue').val(a.percentageClue);
                    $('#eXeGameShowCodeAccess').prop('checked', a.showCodeAccess);
                    if (a.showCodeAccess) $("#eXeGameShowCodeAccessOptions").css("display", "flex");
                    $('#eXeGameCodeAccess').val(a.codeAccess);
                    $('#eXeGameMessageCodeAccess').val(a.messageCodeAccess);
                    $('#eXeGameClue').prop('disabled', !a.showClue);
                    $('#eXeGamePercentajeClue').prop('disabled', !a.showClue);
                    $('#eXeGameCodeAccess').prop('disabled', !a.showCodeAccess);
                    $('#eXeGameMessageCodeAccess').prop('disabled', !a.showCodeAccess);
                },
                addEvents: function () {
                    $('#eXeGameShowClue').on('change', function () {
                        var mark = $(this).is(':checked');
                        if (mark) $("#eXeGameShowClueOptions").show();
                        else $("#eXeGameShowClueOptions").hide();
                        $('#eXeGameClue').prop('disabled', !mark);
                        $('#eXeGamePercentajeClue').prop('disabled', !mark);
                    });
                    $('#eXeGameShowCodeAccess').on('change', function () {
                        var mark = $(this).is(':checked');
                        if (mark) $("#eXeGameShowCodeAccessOptions").css("display", "flex");
                        else $("#eXeGameShowCodeAccessOptions").hide();
                        $('#eXeGameCodeAccess').prop('disabled', !mark);
                        $('#eXeGameMessageCodeAccess').prop('disabled', !mark);
                    });
                    $('#eXeGameItineraryOptionsLnk').click(function () {
                        $("#eXeGameItineraryOptionsLnk").remove();
                        $("#eXeGameItineraryOptions").fadeIn();
                        return false;
                    });
                }
            },
            /**
             * Feedback: a message the learner sees on reaching a percentage of
             * correct answers. Every game and interactive activity offers it,
             * with the same controls and the same data the games already save:
             * `feedBack` (on/off), `percentajeFB` (5-100) and the message.
             * Where the message is stored in the exported HTML stays up to
             * each iDevice.
             */
            feedback: {
                getContents: function () {
                    return `
                        <div class="d-flex flex-wrap align-items-center gap-3 mb-3">
                            <div class="toggle-item">
                                <span class="toggle-control">
                                    <input type="checkbox" id="eXeGameHasFeedBack" class="toggle-input" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label for="eXeGameHasFeedBack" class="toggle-label">${_('Feedback')}</label>
                            </div>
                            <div class="d-flex align-items-center gap-2">
                                <input type="number" id="eXeGamePercentajeFB" name="eXeGamePercentajeFB" class="form-control" value="100" min="5" max="100" step="5" disabled style="width: 9.5ch !important; max-width: 9.5ch !important;" />
                                <label for="eXeGamePercentajeFB" class="mb-0">${_('% right to see the feedback')}</label>
                            </div>
                        </div>
                        <div id="eXeGameFeedbackP" class="mb-3 d-none">
                            <label for="eXeGameFeedBackEditor" class="visually-hidden">${_('Feedback')}</label>
                            <textarea id="eXeGameFeedBackEditor" class="exe-html-editor"></textarea>
                        </div>`;
                },

                /**
                 * @param {*} value
                 * @returns {number} A whole percentage between 5 and 100;
                 * 100 when the value is not a number.
                 */
                normalizePercentage: function (value) {
                    const percentage = parseInt(value, 10);
                    if (isNaN(percentage)) return 100;
                    return Math.max(5, Math.min(percentage, 100));
                },

                /**
                 * @returns {Object|null} The message's TinyMCE editor, once it
                 * has finished starting. An editor still starting is left out:
                 * it loads its textarea when it is ready, so content given to
                 * it before then would be lost.
                 */
                getEditor: function () {
                    if (typeof tinymce === 'undefined' || typeof tinymce.get !== 'function') return null;
                    const editor = tinymce.get('eXeGameFeedBackEditor');
                    return editor && editor.initialized ? editor : null;
                },

                /**
                 * @returns {string} The message (HTML), from TinyMCE once it
                 * has started and from its textarea before.
                 */
                getText: function () {
                    const editor = $exeIDevicesEdition.iDevice.gamification.feedback.getEditor();
                    return editor ? editor.getContent() : $('#eXeGameFeedBackEditor').val() || '';
                },

                /**
                 * @param {string} html The message. Before TinyMCE starts, the
                 * textarea is what it will load.
                 */
                setText: function (html) {
                    const editor = $exeIDevicesEdition.iDevice.gamification.feedback.getEditor();
                    if (editor) editor.setContent(html);
                    else $('#eXeGameFeedBackEditor').val(html);
                },

                /**
                 * Show the editor and enable the percentage while the switch
                 * is on.
                 */
                refresh: function () {
                    const enabled = $('#eXeGameHasFeedBack').is(':checked');
                    $('#eXeGameFeedbackP').toggleClass('d-none', !enabled);
                    $('#eXeGamePercentajeFB').prop('disabled', !enabled);
                },

                /**
                 * @returns {boolean} Whether the iDevice made the feedback
                 * compulsory with setRequired.
                 */
                isRequired: function () {
                    return $('#eXeGameHasFeedBack').data('required') === true;
                },

                /**
                 * Make the feedback compulsory, or optional again. Some game
                 * modes are nothing but the feedback -- "No score": answer
                 * right to get the information -- so while one is chosen the
                 * switch stays on and locked, and the message has to be
                 * written. The author's own choice is kept, and comes back
                 * when the feedback is optional again.
                 *
                 * @param {boolean} required
                 */
                setRequired: function (required) {
                    const feedback = $exeIDevicesEdition.iDevice.gamification.feedback;
                    const $switch = $('#eXeGameHasFeedBack');
                    if (required === feedback.isRequired()) return;
                    if (required) {
                        $switch.data('authorChoice', $switch.is(':checked'));
                        $switch.data('required', true).prop({ checked: true, disabled: true });
                    } else {
                        $switch
                            .data('required', false)
                            .prop({ checked: $switch.data('authorChoice') === true, disabled: false });
                    }
                    feedback.refresh();
                },

                /**
                 * @param {Object} [data]
                 * @param {boolean} [data.feedBack]
                 * @param {number} [data.percentajeFB]
                 * @param {string} [data.textFeedBack] The message (HTML). Left
                 * untouched when omitted.
                 */
                setValues: function (data) {
                    const feedback = $exeIDevicesEdition.iDevice.gamification.feedback;
                    const values = data || {};
                    const enabled = values.feedBack === true || values.feedBack === 'true';
                    const $switch = $('#eXeGameHasFeedBack');
                    // While compulsory the switch stays on: the value is the
                    // author's choice, for when it is optional again.
                    if (feedback.isRequired()) $switch.data('authorChoice', enabled);
                    else $switch.prop('checked', enabled);
                    $('#eXeGamePercentajeFB').val(feedback.normalizePercentage(values.percentajeFB));
                    feedback.refresh();
                    if (typeof values.textFeedBack === 'string') feedback.setText(values.textFeedBack);
                },

                /**
                 * @returns {Object|false} { feedBack, percentajeFB, textFeedBack },
                 * or false (after telling the author) when the feedback is on
                 * or compulsory but has no message. While compulsory, feedBack
                 * is the author's own choice.
                 */
                getValues: function () {
                    const feedback = $exeIDevicesEdition.iDevice.gamification.feedback;
                    const $switch = $('#eXeGameHasFeedBack');
                    const required = feedback.isRequired();
                    const feedBack = required ? $switch.data('authorChoice') === true : $switch.is(':checked');
                    const textFeedBack = feedback.getText();
                    if ((feedBack || required) && textFeedBack.trim().length === 0) {
                        eXe.app.alert(_('Message to display when passing the game'));
                        return false;
                    }
                    return {
                        feedBack: feedBack,
                        percentajeFB: feedback.normalizePercentage($('#eXeGamePercentajeFB').val()),
                        textFeedBack: textFeedBack,
                    };
                },

                addEvents: function () {
                    const feedback = $exeIDevicesEdition.iDevice.gamification.feedback;
                    $('#eXeGameHasFeedBack').on('change', function () {
                        feedback.refresh();
                    });
                    $('#eXeGamePercentajeFB').on('focusout', function () {
                        this.value = feedback.normalizePercentage(this.value);
                    });
                }
            },
            scorm: {
                init: function () {
                    $exeIDevicesEdition.iDevice.gamification.scorm.setValues(0, _("Save score"), false)
                    $exeIDevicesEdition.iDevice.gamification.scorm.addEvents();
                },

                /**
                 * The contents of the Grading tab: everything that decides
                 * whether a learner passed, in one place.
                 *
                 * It used to be the SCORM tab, and the other two evaluative
                 * controls -- the pass score and the progress report -- sat
                 * loose in each iDevice's general options, which meant the
                 * author had to look in two places to answer one question. The
                 * tab now composes all three, so every iDevice gets the same
                 * layout for free and none of them lays it out by hand.
                 *
                 * @param {string} [path] The iDevice's own asset path, needed
                 * by the progress report for its help icon. Omit it and the
                 * report is left out -- which is what an iDevice that scores
                 * without publishing a report wants.
                 * @param {Object} [options]
                 * @param {boolean} [options.hidebutton=false]
                 * @param {boolean} [options.onlybutton=false]
                 * @param {boolean} [options.hideautosave=false] Hide the
                 * automatic mode. For an activity with no end of its own --
                 * geogebra-activity, where the learner may keep dragging the
                 * construction forever -- there is no moment at which to report
                 * on its own, so offering the mode would offer nothing.
                 * @returns {string}
                 */
                getContents: function (path, options = {}) {
                    const { hidebutton = false, onlybutton = false, hideautosave = false } = options;
                    const autoSaveClass = hideautosave ? 'd-none' : 'd-flex';
                    const help = $exeIDevicesEdition.iDevice.gamification.help;
                    const buttonClass = hidebutton ? 'd-none' : 'd-flex';
                    const buttonLiClass = hidebutton ? 'd-none' : '';
                    const message = onlybutton ? _("Save the score") : _("Automatically save the score");
                    const passScoreContents =
                        $exeIDevicesEdition.iDevice.gamification.passScore.getContents(path);
                    const progressReport = path
                        ? $exeIDevicesEdition.iDevice.gamification.progressBar.getContents(path)
                        : '';
                    return `
                            <h3 class="exe-evaluation-section-title">${_('SCORM')}</h3>
                            <div class="d-flex align-items-center gap-1 mb-3 ml-1">
                                <input class="form-check-input" type="radio" name="eXeGameSCORM" id="eXeGameSCORMNoSave" value="0" checked />
                                <label class="form-check-label" for="eXeGameSCORMNoSave">${_("Do not save the score")}</label>
                                ${help.icon('eXeGameSCORMNoSaveHelp', path)}
                            </div>
                            ${help.note('eXeGameSCORMNoSaveHelp', [
                                _('The activity sends no score to the LMS, not even when exported as SCORM. Learners can do it and see their own result, but nothing is recorded on the platform.'),
                                _('The progress report is not affected: it is kept in the learner\'s own browser and works whatever you choose here.'),
                            ])}
                            <div class="${autoSaveClass} align-items-center gap-1 mb-3 ml-1" id="eXeGameSCORMAutomatically">
                                <input class="form-check-input" type="radio" name="eXeGameSCORM" id="eXeGameSCORMAutoSave" value="1" />
                                <label class="form-check-label" for="eXeGameSCORMAutoSave">${message}</label>
                                <span id="eXeGameSCORgameAuto" class="ms-3 d-none"></span>
                                ${help.icon('eXeGameSCORMAutoSaveHelp', path)}
                            </div>
                            ${hideautosave ? '' : help.note('eXeGameSCORMAutoSaveHelp', [
                                _('The activity reports its score by itself, as the learner answers and again when it ends. There is nothing for the learner to press.'),
                                _('A learner who leaves halfway still has the work done so far recorded, because the score was already sent.'),
                            ])}
                            <div class="${buttonClass} align-items-center gap-1 mb-3 ml-1" id="eXeGameSCORMblock">
                                <input class="form-check-input" type="radio" name="eXeGameSCORM" id="eXeGameSCORMButtonSave" value="2" />
                                <label class="form-check-label" for="eXeGameSCORMButtonSave">${_("Show a button to save the score")}</label>
                                <span id="eXeGameSCORgame" class="d-inline-flex align-items-center flex-wrap gap-2 ms-3 d-none">
                                    <label for="eXeGameSCORMbuttonText" class="form-label mb-0">${_("Button text")}: </label>
                                    <input type="text" max="100" name="eXeGameSCORMbuttonText" id="eXeGameSCORMbuttonText" value="${_("Save score")}" class="form-control " style="width: auto; min-width: 140px;" />
                                </span>
                                ${help.icon('eXeGameSCORMButtonSaveHelp', path)}
                            </div>
                            ${help.note('eXeGameSCORMButtonSaveHelp', [
                                _('Nothing reaches the LMS until the learner presses the button. They decide when -- or whether -- their score is recorded, so an activity done without pressing it leaves no trace on the platform.'),
                                _('Pressing the button publishes the score so far, but does not close the activity: the learner can carry on and save again.'),
                            ])}
                            <div id="eXeGameSCORMinstructionsAuto" class="mb-3 ml-2 d-none">
                                <ul class="mb-3">
                                    <li>${_("This will only work when exported as SCORM")}</li>
                                    <li class="${buttonLiClass}">${_("The score will be automatically saved after answering each question and at the end of the game.")}</li>
                                </ul>
                            </div>
                            <div id="eXeGameSCORMinstructionsButton" class="mb-3 ml-2 d-none">
                                <ul class="mb-3">
                                    <li>${_("The button will only be displayed when exported as SCORM.")}</li>
                                </ul>
                            </div>
                            <div id="eXeGameSCORMPercentaje" class="d-flex align-items-center gap-2 d-none">
                                <label for="eXeGameSCORMWeight" class="form-label mb-0">${_("Weighted")}: </label>
                                <input type="number" id="eXeGameSCORMWeight" name="eXeGameSCORMWeight" value="100" min="1" max="100" class="form-control" style="width: 9.5ch !important; max-width:9.5ch  !important;" />
                                <span>%</span>
                                ${help.icon('eXeGameSCORMWeightHelp', path)}
                            </div>
                            ${help.note('eXeGameSCORMWeightHelp', [
                                _('The weight decides how much this activity counts towards the page score, compared with the other activities on the same page.'),
                                _('What matters is the proportion between the weights, not the number itself. If a page has a single activity, the weight makes no difference: it is worth the whole score.'),
                                _('For example, three activities weighing 100, 100 and 50 count 40%, 40% and 20% of the page score. Activities that do not save their score are left out of the calculation.'),
                            ])}
                            ${progressReport ? `<h3 class="exe-evaluation-section-title">${_('Progress report')}</h3>${progressReport}` : ''}
                            ${passScoreContents}`;
                },

                setValues: function (isScorm, textButtonScorm, repeatActivity = true, weighted = 100) {
                    // The weight help note is hidden with the row it explains
                    // (see addEvents), and starts closed on every load.
                    $("#eXeGameSCORgame,#eXeGameSCORgameAuto,#eXeGameSCORMPercentaje,#eXeGameSCORMinstructionsButton,#eXeGameSCORMinstructionsAuto,#eXeGameSCORMWeightHelp").addClass('d-none');

                    $('#eXeGameSCORMWeight').val(weighted);

                    if (isScorm == 0) {
                        $('#eXeGameSCORMNoSave').prop('checked', true);
                    } else if (isScorm == 1) {
                        $('#eXeGameSCORMAutoSave').prop('checked', true);
                        $('#eXeGameSCORgameAuto').removeClass('d-none');
                        $('#eXeGameSCORMinstructionsAuto').removeClass('d-none');
                        $('#eXeGameSCORMPercentaje').removeClass('d-none');
                    } else if (isScorm == 2) {
                        $('#eXeGameSCORMButtonSave').prop('checked', true);
                        $('#eXeGameSCORMbuttonText').val(textButtonScorm);
                        $('#eXeGameSCORgame').removeClass('d-none');
                        $('#eXeGameSCORMinstructionsButton').removeClass('d-none');
                        $('#eXeGameSCORMPercentaje').removeClass('d-none');
                    }
                },

                getValues: function () {
                    var isScorm = parseInt($("input[type=radio][name='eXeGameSCORM']:checked").val()),
                        textButtonScorm = $("#eXeGameSCORMbuttonText").val(),
                        weighted = $('#eXeGameSCORMWeight').val() === '' ? -1 : parseFloat($('#eXeGameSCORMWeight').val());
                    return {
                        'isScorm': isScorm,
                        'textButtonScorm': textButtonScorm,
                        'repeatActivity': true,
                        'weighted': weighted,
                    };
                },

                addEvents: function () {
                    const showWithFade = function (selector) {
                        $(selector).stop(true, true).removeClass('d-none').css({
                            opacity: 0,
                        }).animate({
                            opacity: 1,
                        }, 500);
                    };

                    $('input[type=radio][name="eXeGameSCORM"]').on('change', function () {
                        // The weight help note sits outside #eXeGameSCORMPercentaje
                        // (an alert inside that flex row would squeeze the field),
                        // so hiding the row has to take the note with it --
                        // otherwise an open note outlives the control it explains.
                        $("#eXeGameSCORgame,#eXeGameSCORgameAuto,#eXeGameSCORMinstructionsButton,#eXeGameSCORMinstructionsAuto,#eXeGameSCORMPercentaje,#eXeGameSCORMWeightHelp").addClass('d-none').css('opacity', '');
                        switch ($(this).val()) {
                            case '0':
                                break;
                            case '1':
                                showWithFade('#eXeGameSCORgameAuto');
                                showWithFade('#eXeGameSCORMinstructionsAuto');
                                showWithFade('#eXeGameSCORMPercentaje');
                                break;
                            case '2':
                                showWithFade('#eXeGameSCORgame');
                                showWithFade('#eXeGameSCORMinstructionsButton');
                                showWithFade('#eXeGameSCORMPercentaje');
                                break;
                        }
                    });
                    $('#eXeGameSCORMWeight').on('keyup click', function () {
                        this.value = this.value.replace(/\D/g, '').substring(0, 3);
                    }).on('focusout', function () {
                        let value = this.value.trim() === '' ? 100 : parseInt(this.value, 10);
                        value = Math.max(1, Math.min(value, 100));
                        this.value = value;
                    });

                    // The three mode notes stay available whichever mode is
                    // selected -- the author is comparing them. Only the weight
                    // note is tied to a control that comes and goes.
                    [
                        'eXeGameSCORMNoSaveHelp',
                        'eXeGameSCORMAutoSaveHelp',
                        'eXeGameSCORMButtonSaveHelp',
                        'eXeGameSCORMWeightHelp',
                    ].forEach(function (id) {
                        $exeIDevicesEdition.iDevice.gamification.help.bind(id);
                    });
                },

            },

            share: {
                /**
                 * The windows the Questions tab opens, in the order of its
                 * links.
                 */
                windows: ['import', 'export', 'ai'],

                /**
                 * @param {string} name A name in `windows`.
                 * @returns {string} The id of its modal.
                 */
                getModalId: function (name) {
                    return `eXeShareModal-${name}`;
                },

                /**
                 * Text of the AI link and window. The catalog entry is shared
                 * with EdiCuaTeX, and some of its translations open with a ✨;
                 * here every link takes its icon from the icon font instead.
                 *
                 * @returns {string}
                 */
                getAILabel: function () {
                    return _('Create with AI').replace(/^✨\s*/u, '');
                },

                /**
                 * The question import control. The iDevice reads the chosen
                 * file: it binds `change` on #eXeGameImportGame.
                 *
                 * @returns {string}
                 */
                getImportContents: function () {
                    return `<div id="eXeGameExportImport">
                            <form method="POST">
                                <div class="exe-file-upload" data-exe-upload>
                                    <label for="eXeGameImportGame" class="form-label mb-1">${_('Import')}: </label>
                                    <input type="file" name="eXeGameImportGame" id="eXeGameImportGame" accept=".txt, .xml" class="exe-file-input d-none" />
                                    <button type="button" class="btn btn-primary exe-file-btn" data-exe-file-trigger>${_('Choose')}</button>
                                    <span class="exe-file-name" data-exe-file-name>${_('No file selected')}</span>
                                    <span class="exe-field-instructions d-block mt-1">${_('Supported formats')}: txt, xml</span>
                                </div>
                            </form>
                        </div>`;
                },

                /**
                 * The question export button. The iDevice writes the file: it
                 * binds `click` on #eXeGameExportQuestions.
                 *
                 * @returns {string}
                 */
                getExportContents: function () {
                    return `<p class="m-0">
                            <input type="button" class="btn btn-primary" name="eXeGameExportQuestions" id="eXeGameExportQuestions" value="${_('Export questions')}" />
                        </p>`;
                },

                /**
                 * The Import, Export and Create with AI links of the Questions
                 * tab, and the windows they open: each one an informative
                 * message and the controls of its process.
                 *
                 * @param {boolean|Object} [settings] The `share` setting of
                 * tabs.getHtml.
                 * @param {boolean} [settings.importQuestions=true] Offer Import.
                 * @param {boolean} [settings.exportQuestions=true] Offer Export.
                 * @param {number} [settings.type=0] The game, for the AI prompt.
                 * @param {Object} [settings.options] Prompt options of the game.
                 * @returns {{toolbar: string, modals: string}}
                 */
                getTools: function (settings) {
                    const share = $exeIDevicesEdition.iDevice.gamification.share;
                    const tabs = $exeIDevicesEdition.iDevice.tabs;
                    const options = settings !== null && typeof settings === 'object' ? settings : {};
                    const windows = [];
                    if (options.importQuestions !== false) {
                        windows.push({
                            name: 'import',
                            icon: 'upload',
                            title: _('Import'),
                            info: _('You can import questions compatible with this activity from txt or xml (Moodle) files.'),
                            content: share.getImportContents(),
                        });
                    }
                    if (options.exportQuestions !== false) {
                        windows.push({
                            name: 'export',
                            icon: 'download',
                            title: _('Export'),
                            info: _('You can export its questions in txt format to integrate them into other compatible activities.'),
                            content: share.getExportContents(),
                        });
                    }
                    windows.push({
                        name: 'ai',
                        icon: 'auto_awesome',
                        title: share.getAILabel(),
                        info: `${_('You can easily generate multiple questions for the activity using AI.')} ${_('Send the prompt to an AI, paste the questions it returns in Questions and save them.')}`,
                        content: share.getIAContents(options.type || 0, options.options || {}),
                        dialog: 'modal-dialog-scrollable',
                    });

                    const links = windows
                        .map(
                            (win) => `
                            <button type="button" class="btn btn-link btn-sm d-inline-flex align-items-center gap-1" data-exe-share="${win.name}" aria-haspopup="dialog" aria-controls="${share.getModalId(win.name)}">
                                <span class="auto-icon" aria-hidden="true">${win.icon}</span>${win.title}
                            </button>`
                        )
                        .join('');
                    // No `fade`: the edition closing hides and disposes a
                    // window at once, with no transition still to run. No
                    // size either: the application gives all its centered
                    // modals the same width.
                    const modals = windows
                        .map((win) => {
                            const id = share.getModalId(win.name);
                            return `
                            <div class="modal exe-share-modal" id="${id}" tabindex="-1" aria-labelledby="${id}-title" aria-hidden="true">
                                <div class="modal-dialog modal-dialog-centered ${win.dialog || ''}">
                                    <div class="modal-content">
                                        <div class="modal-header">
                                            <h2 class="modal-title fs-5 d-flex align-items-center gap-2" id="${id}-title">
                                                <span class="auto-icon" aria-hidden="true">${win.icon}</span>${win.title}
                                            </h2>
                                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="${_('Close')}"></button>
                                        </div>
                                        <div class="modal-body">${tabs.getInfo(win.info)}${win.content}</div>
                                    </div>
                                </div>
                            </div>`;
                        })
                        .join('');
                    return {
                        toolbar: `<div class="d-flex justify-content-end flex-wrap gap-2 mb-2" role="toolbar" aria-label="${_('Questions')}">${links}</div>`,
                        modals: modals,
                    };
                },

                /**
                 * Move the windows of getTools to <body> -- inside the iDevice's
                 * box a modal can open under Bootstrap's backdrop -- and make
                 * the links open them. The edition's lifecycle removes them
                 * when it closes; a window left by an edition that had none is
                 * removed here.
                 */
                mount: function () {
                    const share = $exeIDevicesEdition.iDevice.gamification.share;
                    const mounted = [];
                    share.windows.forEach(function (name) {
                        const copies = Array.from(document.querySelectorAll(`[id="${share.getModalId(name)}"]`));
                        const fresh = copies.find((el) => el.parentElement !== document.body);
                        if (!fresh) return;
                        copies.filter((el) => el !== fresh).forEach((el) => share.removeModal(el));
                        document.body.appendChild(fresh);
                        mounted.push(fresh);
                    });
                    if (mounted.length === 0) return;

                    mounted.forEach(function (el) {
                        // Focus goes back to the link that opened the window,
                        // unless the window only stepped aside (see yieldTo).
                        el.addEventListener('hidden.bs.modal', function () {
                            if ($(el).data('exeShareSuspended')) return;
                            const trigger = $(el).data('exeShareTrigger');
                            if (trigger && document.body.contains(trigger)) trigger.focus();
                        });
                    });
                    $('[data-exe-share]')
                        .off('click.exeShare')
                        .on('click.exeShare', function () {
                            share.open(this.getAttribute('data-exe-share'), this);
                        });
                    // Each process closes its window; the iDevice then reports
                    // the result in its own messages.
                    $('#eXeGameImportGame')
                        .off('change.exeShare')
                        .on('change.exeShare', function () {
                            share.close('import');
                        });
                    $('#eXeGameExportQuestions')
                        .off('click.exeShare')
                        .on('click.exeShare', function () {
                            share.close('export');
                        });

                    const lifecycle = $exeIDevicesEdition.iDevice.getLifecycle();
                    if (share.onModalShow) document.removeEventListener('show.bs.modal', share.onModalShow);
                    share.onModalShow = function (event) {
                        share.yieldTo(event.target);
                    };
                    if (lifecycle) {
                        lifecycle.addEventListener(document, 'show.bs.modal', share.onModalShow);
                        lifecycle.own(function () {
                            mounted.forEach((el) => share.removeModal(el));
                        });
                    } else {
                        document.addEventListener('show.bs.modal', share.onModalShow);
                    }
                },

                /**
                 * Open a window of the Questions tab. Focus goes back to the
                 * link that opened it when it closes.
                 *
                 * @param {string} name A name in `windows`.
                 * @param {HTMLElement} [trigger] The link that opens it.
                 * @returns {boolean} false when there is no such window or no
                 * Bootstrap to open it with.
                 */
                open: function (name, trigger) {
                    const el = document.getElementById($exeIDevicesEdition.iDevice.gamification.share.getModalId(name));
                    const Modal = window.bootstrap && window.bootstrap.Modal;
                    if (!el || !Modal) return false;
                    $(el).data('exeShareTrigger', trigger || null);
                    Modal.getOrCreateInstance(el).show();
                    return true;
                },

                /**
                 * Bootstrap shows one modal at a time. When the application
                 * opens one of its own over an open window -- the alert about
                 * the questions just pasted, say -- the window steps aside, so
                 * that alert is not left behind it, and comes back once the
                 * alert is closed.
                 *
                 * @param {HTMLElement} other The modal being shown.
                 */
                yieldTo: function (other) {
                    const share = $exeIDevicesEdition.iDevice.gamification.share;
                    const Modal = window.bootstrap && window.bootstrap.Modal;
                    if (!Modal || !other || !other.classList || other.classList.contains('exe-share-modal')) return;
                    share.windows.forEach(function (name) {
                        const el = document.getElementById(share.getModalId(name));
                        if (!el || !el.classList.contains('show')) return;
                        $(el).data('exeShareSuspended', true);
                        Modal.getOrCreateInstance(el).hide();
                        other.addEventListener(
                            'hidden.bs.modal',
                            function () {
                                $(el).data('exeShareSuspended', false);
                                if (document.body.contains(el)) Modal.getOrCreateInstance(el).show();
                            },
                            { once: true }
                        );
                    });
                },

                /**
                 * @param {string} name A name in `windows`.
                 */
                close: function (name) {
                    const el = document.getElementById($exeIDevicesEdition.iDevice.gamification.share.getModalId(name));
                    const Modal = window.bootstrap && window.bootstrap.Modal;
                    const instance = el && Modal ? Modal.getInstance(el) : null;
                    if (instance) instance.hide();
                },

                /**
                 * Close a window, release its Bootstrap instance and remove it
                 * with the handlers on its controls.
                 *
                 * @param {HTMLElement} el
                 */
                removeModal: function (el) {
                    const Modal = window.bootstrap && window.bootstrap.Modal;
                    const instance = Modal ? Modal.getInstance(el) : null;
                    if (instance) {
                        instance.hide();
                        instance.dispose();
                    }
                    $(el).remove();
                },

                /**
                 * The controls to generate questions with AI, for the Create
                 * with AI window. Its message is the window's.
                 *
                 * @param {number} [type=0] The game, for the prompt.
                 * @param {Object} [options] Prompt options of the game.
                 * @returns {string}
                 */
                getIAContents: function (type = 0, options = {}) {
                    const promptText = $exeIDevicesEdition.iDevice.gamification.share.buildIAPromptText(type, options);
                    const tab = `
                            <p style="display:none"><input type="button" class="btn btn-primary ms-2"  name="eXeGameAddQuestions" id="eXeGameAddQuestion" value="${_('Add questions')}" /></p>
                            <div class="bg-white rounded w-100 position-relative" style="max-width: 1400px;" id="eXeEAddArea">
                                <ul class="nav nav-tabs">
                                    <li class="nav-item">
                                        <a id="eXeETabPrompt" class="nav-link bg-light border-end active" href="#">
                                        ${_('Prompt')}
                                        </a>
                                    </li>
                                    <li class="nav-item">
                                        <a id="eXeETabQuestions" class="nav-link bg-light border-end"  href="#">
                                         ${_('Questions')}
                                        </a>
                                    </li>
                                    <li class="nav-item" style="display:none">
                                        <a id="eXeETabIA" class="nav-link bg-light border-end" href="#">
                                        ${_('Generate')}
                                        </a>
                                    </li>
                                </ul>
                                <div class="eXeE-LightboxContent p-2">
                                    <textarea class="form-control font-monospace fs-6" style="min-height:350px;" id="eXeEPromptArea">${promptText}</textarea>
                                    <textarea id="eXeEQuestionsArea" class="form-control font-monospace fs-6" style="min-height:350px;display:none"></textarea>
                                    <div  class="form-control font-monospace fs-6" id="eXeEIADiv"  style="display:none">
                                        ${$exeIDevicesEdition.iDevice.gamification.share.createIAButtonsHtml()}
                                    </div>
                                </div>
                                <div class="d-flex justify-content-end  border-secondary p-2">
                                   <button type="button" id="eXeESaveButton" class="btn btn-primary ms-2">${_('Save')}</button>
                                   <button type="button" id="eXeECopyButton" class="btn btn-primary ms-2">${_('Copy')}</button>
                                   <select id="eXeEIASelect" name="eXeEIASelect" class="form-select form-select-sm w-auto ms-2">
                                        <option selected value="https://chatgpt.com/?q=">ChatGPT</option>
                                        <option value="https://claude.ai/new?q=">Claude</option>
                                        <option value="https://www.perplexity.ai/search?q=">Perplexity</option>
                                        <option value="https://chat.mistral.ai/chat/?q=">Le Chat (Mistral)</option>
                                        <option value="https://grok.com/?q=">Grok</option>
                                        <option value="https://chat.qwen.ai/?text=">Qwen</option>
                                    </select>
                                   <button type="button" id="eXeEOpenChatGPTButton" class="btn btn-primary ms-2">${_('Send to AI')}</button>
                                </div>
                            </div>`;
                    return tab.replace(/[ \t]+/g, ' ').trim();
                },

                createIAButtonsHtml: function () {
                    return `<div id="eXeFormIAContainer">
                        <div class="dd-flex gap-2 mt-3 mb-3">
                            <label for="eXeSpecialtyIA">${_('Specialty')}:
                                <input list="specialtyList" id="eXeSpecialtyIA" name="specialty" value="${_('Biology')}" style="width: 150px;">
                                <datalist id="specialtyList">
                                    <option value="${_('Biology')}">
                                    <option value="${_('Law')}">
                                    <option value="${_('Economy')}">
                                    <option value="${_('Education')}">
                                    <option value="${_('Geology')}">
                                    <option value="${_('History')}">
                                    <option value="${_('Computer Science')}">
                                    <option value="${_('Mathematics')}">
                                    <option value="${_('Medicine')}">
                                    <option value="${_('Psychology')}">
                                    <option value="${_('Chemistry')}">
                                </datalist>
                            </label>
                            <label for="eXeCourseIA">${_('Course')}:
                                <input list="courseList" id="eXeCourseIA" name="course" value="${_('3rd ESO')}" style="width: 130px;">
                                <datalist id="courseList">
                                    <option value="${_('1st Primary')}">
                                    <option value="${_('2nd Primary')}">
                                    <option value="${_('3rd Primary')}">
                                    <option value="${_('4th Primary')}">
                                    <option value="${_('5th Primary')}">
                                    <option value="${_('6th Primary')}">
                                    <option value="${_('1st ESO')}">
                                    <option value="${_('2nd ESO')}">
                                    <option value="${_('3rd ESO')}">
                                    <option value="${_('4th ESO')}">
                                    <option value="${_('1st Baccalaureate')}">
                                    <option value="${_('2nd Baccalaureate')}">
                                    <option value="${_('Intermediate Vocational Training')}">
                                    <option value="${_('Higher Vocational Training')}">
                                </datalist>
                            </label>
                            <label for="eXeNumberOfQuestionsIA">${_('Number of Questions')}:
                                <input id="eXeNumberOfQuestionsIA" type="number" min="1" max="30" value="10" class="form-control form-control-sm" style="width:6ch;">
                            </label>
                            <label for="eXeThemeIA">${_('Topic')}:
                                <input id="eXeThemeIA" type="text" style="width: 300px;">
                            </label>
                             <button id="eXeIAButton" class="btn btn-success ms-2">${_('Create')}</button>
                        </div>
                        <p id="eXeIAMessage" class="dp-none"></p>
                    </div>`;
                },


                getAllowedFormats: function (gameId, options = {}) {
                    const gameFormats = {
                        0: { // Word/Definition
                            format: [`${c_('Word')}#${c_('Definition')}`],
                            explanation: `${c_('Neither the word nor the definition must contain #')}`,
                            examples: [`${c_('Heart')}#${c_('A muscular organ that pumps blood through the body')}`],
                            allowRegex: /^([^#]+)#([^#]+)(#([^#]+))?(#([^#]+))?$/,
                            prompt: c_(`Generate 10 words followed by their definitions, separated by #. Do not include the # character in either the word or the definition.`)
                        },
                        1: { // A-Z Quiz
                            format: [
                                `${c_('Word')}#${c_('Definition')}`,
                                `${c_('Word')}#${c_('Definition')}#${c_('Type')}#${c_('Letter')}`
                            ],
                            explanation: `${c_('The type will be 0 if the word starts with the letter and 1 if the word contains the letter')}`,
                            examples: [
                                `${c_('Atom')}#${c_('The basic unit of a chemical element')}`,
                                `${c_('Biology')}#${c_('The study of living organisms')}#0#${c_('B')}`
                            ],
                            allowRegex: /^([^#]+)#([^#]+)(#(0|1)(#[^#]+)?)?$/,
                            prompt: c_(`Generate 30 words and their definitions separated by #.`)
                        },
                        2: { // Test
                            format: [
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}#${c_('OptionC')}#${c_('OptionD')}`,
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}#${c_('OptionC')}`,
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}`
                            ],
                            explanation: `${c_('Solution: 0, 1, 2 or 3')}`,
                            examples: [
                                `1#${c_('What is the largest planet in the solar system?')}#${c_('Earth')}#${c_('Jupiter')}#${c_('Mars')}#${c_('Venus')}`,
                                `0#${c_('What process do plants use to produce energy?')}#${c_('Photosynthesis')}#${c_('Respiration')}#${c_('Digestion')}`
                            ],
                            allowRegex: /^(0|1|2|3)#([^#]+)#([^#]+)#([^#]+)(#[^#]+){0,2}$/,
                            prompt: c_(`Create 10 multiple-choice questions with 2 to 4 options. Start with the correct solution (0, 1, 2, or 3), followed by the question and each option, all separated by #.`)
                        },
                        3: { // Select
                            format: [
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}#${c_('OptionC')}#${c_('OptionD')}`,
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}#${c_('OptionC')}`,
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}`
                            ],
                            explanation: `${c_('Solution: Any combination of A,B,C and D: A, AC, CD...')}
                            `,
                            examples: [
                                `${c_('A')}#${c_('Which of the following are mammals?')}#${c_('Dog')}#${c_('Frog')}#${c_('Eagle')}#${c_('Lizard')}`,
                                `${c_('AB')}#${c_('Which gases are involved in photosynthesis?')}#${c_('Oxygen')}#${c_('Carbon dioxide')}#${c_('Nitrogen')}`
                            ],
                            allowRegex: /^(([0-3]|[A-D]{1,4})#[^#]+#[^#]+(?:#[^#]*){0,3}|[^#]+#[^#]+)$/,
                            prompt: c_(`Generate 10 multiple-choice questions. Provide the correct answer as letters (e.g., A, AB), followed by the question and the options, all separated by #.`)
                        },
                        4: { // Identify
                            prompt: c_(`Create 5 solution words followed by 3 to 9 clues that describe each one. Separate each clue with #.`),
                            format: [`${c_('Solution')}#${c_('Clue1')}#${c_('Clue2')}#${c_('Clue3')}#${c_('Clue4')}#${c_('Clue5')}...`],
                            explanation: `${c_('You must provide between 3 and 9 clues')}`,
                            examples: [
                                `${c_('Mercury')}#${c_('Closest planet to the Sun')}#${c_('Smallest planet')}#${c_('Named after a Roman god')}`
                            ],
                            allowRegex: /^([^#]+)(#([^#]+)){3,9}$/,
                        },
                        5: { // Classify
                            format: [`${c_('Group')}#${c_('Question')}`],
                            explanation: `${c_('Group: 0, 1, 2 or 3')}`,
                            examples: [
                                `0#${c_('Lion')}`,
                                `1#${c_('Rabbit')}`,
                                `0#${c_('Tiger')}`
                            ],
                            allowRegex: /^(0|1|2|3)#[^#]+$/,
                            prompt: c_(`Provide 4 elements for each of these groups: carnivores, 0, and herbivores, 1. Separate the group number and the element using the symbol #.`),
                        },
                        6: { // True or false
                            prompt: c_(`Generate 10 true or false questions. Each question must include the solution (0 = false, 1 = true), a suggestion, and feedback, all separated by #. Additionally, the feedback must not explicitly indicate whether the response is correct or incorrect`),
                            format: [`${c_('question')}#${c_('solution')}#${c_('suggestion')}#${c_('feedback')}`],
                            explanation: `${c_('The format requires a question (non-empty string), a solution (0 or 1), a suggestion (mandatory, can be empty), and feedback (mandatory, can be empty).')}`,
                            examples: [
                                `${c_('Is the Earth round?')}#1#${c_('Think about the horizon.')}#${c_('The Earth is not flat.')}`,
                                `${c_('Does water boil at 100 degrees Celsius?')}#0##${c_('It depends on the altitude.')}`
                            ],
                            allowRegex: /^vof#[^\s#].*?#(0|1)#.*?#.*?|[^\s#].*?#(0|1)#.*?#.*?|[01]#[^#]+$/,
                        },
                        7: { // form
                            prompt: c_(`Generate 10 questions. The 'Solution' can be 0/1 for True/False, 0-3 for single-choice, or A-D (or combinations) for multiple-choice. Then provide the question and the answer options (2 to 4), all separated by '#'.`),
                            format: [
                                `${c_('Solution')}#${c_('Question')}`,
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}#${c_('OptionC')}#${c_('OptionD')}`,
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}#${c_('OptionC')}`,
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}`,
                            ],
                            explanation: `${c_('The solution can be:')} 
                              - ${c_('0 or 1 for True/False')}. Format: ${c_('Solution')}#${c_('Question')}
                              - ${c_('any digit from 0 to 3 for single-choice (up to 4 options)')} 
                              - ${c_('any combination of A-D for multiple-choice (up to 4 options).')}
                              ${c_('Provide a similar number of questions for each type.')}`,
                            examples: [
                                `1#${c_('Is the Earth round?')}`,
                                `3#${c_('Which number is prime?')}#4#6#11#12#14#15`,
                                `AB#${c_('Which of the following are mammals?')}#${c_("Dog")}#${c_("Frog")}#${c_("Eagle")}#${c_("Cat")}`
                            ],
                            allowRegex: /^(?:[01]#[^#]+|[0-5]#[^#]+(?:#[^#]+){2,6}|[A-F]{1,6}#[^#]+(?:#[^#]+){2,6})$/,
                        },
                        8: { // scrabled list
                            prompt: c_(`Provide only one ordered list of steps or items, each separated by '#'.`),
                            format: [`${c_('first element')}#${c_('second element')}#${c_('third element')}#${c_('fourth element')}#${c_('fourth element')}...`],
                            explanation: `Ensure the list includes at least five elements.`,
                            examples: [
                                `${c_("Wake up")}#${c_("Have breakfast")}#${c_("Go to work")}`,
                            ],
                            allowRegex: /^[^#]+(?:#[^#]+){2,}$/,

                        },
                        9: { // crosswords
                            prompt: c_(`Generate 10 words followed by their definitions, separated by #. Do not include the # character in either the word or the definition`),
                            format: [`${c_('Word')}#${c_('Definition')}`],
                            explanation: `${c_('Neither the word nor the definition must contain #. The word must have a maximum of 14 letters and must not contain spaces.')}`,
                            examples: [`${c_('Heart')}#${c_('A muscular organ that pumps blood through the body')}`],
                            allowRegex: /^([^#]+)#([^#]+)(#([^#]+))?(#([^#]+))?$/
                        },
                        10: (() => { // adaptative quiz (mixed: select / sort / word)
                            const requestedLevels = parseInt(options.numLevels, 10);
                            const numLevels = requestedLevels === 5 ? 5 : requestedLevels === 4 ? 4 : 3;
                            const lvlClass = numLevels === 5 ? '[0-4]' : numLevels === 4 ? '[0-3]' : '[0-2]';
                            const lvlList = numLevels === 5
                                ? '0, 1, 2, 3 or 4'
                                : numLevels === 4
                                    ? '0, 1, 2 or 3'
                                    : '0, 1 or 2';
                            const lvlDescr = numLevels === 5
                                ? c_('Level: 0 (low), 1 (medium), 2 (high), 3 (expert) or 4 (master).')
                                : numLevels === 4
                                    ? c_('Level: 0 (low), 1 (medium), 2 (high) or 3 (expert).')
                                    : c_('Level: 0 (low), 1 (medium) or 2 (high).');

                            const format = [
                                // Type 0: Select (multiple-choice)
                                `0@${c_('Level')}#${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}[#${c_('OptionC')}][#${c_('OptionD')}][#${c_('OptionE')}][#${c_('OptionF')}]`,
                                // Type 1: Sort / order
                                `1@${c_('Level')}#${c_('Question')}#Item1#Item2#Item3[#Item4][#Item5][#Item6]`,
                                // Type 2: Word / definition
                                `2@${c_('Level')}#${c_('Word')}#${c_('Definition')}`
                            ];

                            const examples = [
                                // Type 0: single correct answer (letter B = OptionB)
                                `0@0#B#${c_('What is the largest planet in the solar system?')}#${c_('Earth')}#${c_('Jupiter')}#${c_('Mars')}#${c_('Venus')}`,
                                // Type 0: multiple correct answers (A and C)
                                `0@1#AC#${c_('Which of the following are prime numbers?')}#2#4#5#9`,
                                // Type 1: sort
                                `1@2#${c_('Sort from largest to smallest')}#${c_('Elephant')}#${c_('Tiger')}#${c_('Cat')}#${c_('Mouse')}`,
                                // Type 2: word/definition
                                `2@0#${c_('Heart')}#${c_('A muscular organ that pumps blood through the body')}`
                            ];
                            if (numLevels >= 4) {
                                examples.push(`0@3#ABCD#${c_('Which of these are transcendental numbers?')}#π#e#${c_('Liouville constant')}#${c_('Champernowne constant')}`);
                            }
                            if (numLevels === 5) {
                                examples.push(`1@4#${c_('Sort these chemical elements from lowest to highest atomic number')}#${c_('Hydrogen')}#${c_('Carbon')}#${c_('Iron')}#${c_('Gold')}#${c_('Uranium')}`);
                            }

                            const explanation = [
                                lvlDescr,
                                c_('Three question types are accepted. Every line must start with the type number, followed by @, the level, and the rest of the fields separated with #:'),
                                c_('Type 0 (multiple-choice): 0@Level#Solution#Question#OptionA#OptionB[#OptionC][#OptionD][#OptionE][#OptionF]. Solution is an uppercase combination of A, B, C, D, E, F matching the correct options (e.g. A, AB, ACD, ABCDEF). Use up to 6 letters and never more than the number of options. Leave Solution empty if no option is correct.'),
                                c_('Type 1 (sort/order): 1@Level#Question#Item1#Item2#Item3[#Item4][#Item5][#Item6]. Provide between 3 and 6 items already listed in the correct order according to the question criterion.'),
                                c_('Type 2 (word/definition): 2@Level#Word#Definition.'),
                                c_('Do not include the # character inside any field.')
                            ].join(' ');

                            // Type 0 (Select): 0..6 uppercase or lowercase letters A-F as solution; 2-6 options.
                            const selectRe = `0@${lvlClass}#[A-Fa-f]{0,6}#[^#]+#[^#]+#[^#]+(#[^#]+){0,4}`;
                            // Type 1 (Sort): question + 3 to 6 items already in correct order.
                            const sortRe = `1@${lvlClass}#[^#]+#[^#]+#[^#]+#[^#]+(#[^#]+){0,3}`;
                            // Type 2 (Word): word + definition.
                            const wordRe = `2@${lvlClass}#[^#]+#[^#]+`;
                            const allowRegex = new RegExp(`^(${selectRe}|${sortRe}|${wordRe})$`);

                            const distribution = numLevels === 5
                                ? c_('balanced across the 5 levels (0=low, 1=medium, 2=high, 3=expert, 4=master)')
                                : numLevels === 4
                                    ? c_('balanced across the 4 levels (0=low, 1=medium, 2=high, 3=expert)')
                                    : c_('balanced across the 3 levels (0=low, 1=medium, 2=high)');
                            const perLevelCount = numLevels === 5 ? 12 : numLevels === 4 ? 15 : 20;
                            const totalQuestions = perLevelCount * numLevels;
                            const difficultyLadder = numLevels === 5
                                ? c_('Level 0 must contain the easiest questions (basic facts and simple recall); each subsequent level must be strictly more challenging than the previous one (more reasoning, longer or trickier options, more abstract vocabulary), and level 4 (master) must contain the hardest questions.')
                                : numLevels === 4
                                    ? c_('Level 0 must contain the easiest questions (basic facts and simple recall); each subsequent level must be strictly more challenging than the previous one (more reasoning, longer or trickier options, more abstract vocabulary), and level 3 (expert) must contain the hardest questions.')
                                    : c_('Level 0 must contain the easiest questions (basic facts and simple recall); each subsequent level must be strictly more challenging than the previous one (more reasoning, longer or trickier options, more abstract vocabulary), and level 2 (high) must contain the hardest questions.');

                            // The prompt is a single static translation key with %placeholders%
                            // so it can be extracted and translated. We must NOT wrap a template
                            // literal containing ${...} in c_(): the extractor skips dynamic keys
                            // (translations.ts) and the catalogue lookup would never match, leaving
                            // the whole sentence in English. Translate first, then substitute.
                            const prompt = c_('Create %total% mixed adaptative-quiz questions %distribution% and across the three supported question types. Every line must start with the type number followed by @, then the level, then the remaining fields separated with #. Never put # inside a field. The three accepted line shapes are: Type 0 (multiple-choice): 0@Level#Solution#Question#OptionA#OptionB[#OptionC][#OptionD][#OptionE][#OptionF] — Solution is an uppercase combination of the letters A, B, C, D, E, F identifying the correct options (e.g. A, AB, ACD, ABCDEF); use up to 6 letters and never more than the number of options; leave Solution empty if no option is correct. Type 1 (sort/order): 1@Level#Question#Item1#Item2#Item3[#Item4][#Item5][#Item6] — provide between 3 and 6 items already listed in the correct order according to the question criterion. Type 2 (word/definition): 2@Level#Word#Definition. Difficulty must increase with the level: %ladder% Inside every single level you must include questions of all three types (Type 0, Type 1 and Type 2): produce around %perLevel% questions per level and make sure each level mixes select/multiple-choice (Type 0), sort/order (Type 1) and word/definition (Type 2). Do not put all the same type together; interleave the three types within each level.')
                                .replace('%total%', totalQuestions)
                                .replace('%distribution%', distribution)
                                .replace('%ladder%', difficultyLadder)
                                .replace('%perLevel%', perLevelCount);

                            return { format, explanation, examples, allowRegex, prompt, _meta: { numLevels, lvlList } };
                        })(),
                        11: { // Electric circuits
                            format: [
                                `${c_('Description')}#${c_('TikZ code')}#${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}#${c_('OptionC')}#${c_('OptionD')}`,
                                `${c_('Description')}#${c_('TikZ code')}#${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}#${c_('OptionC')}`,
                                `${c_('Description')}#${c_('TikZ code')}#${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}`
                            ],
                            explanation: `${c_('One question per line. Fields separated by #. Description: short text describing the circuit. TikZ code: circuitikz code for the diagram. Solution: any combination of A, B, C and D (e.g. A, AC, BD). Question: the question text. Then 2 to 4 answer options.')}`,
                            examples: [
                                `${c_('Simple resistor circuit')}#\\begin{circuitikz}\\draw (0,0) to[R=1k] (2,0);\\end{circuitikz}#${c_('A')}#${c_('What is the resistance value?')}#1 kΩ#2 kΩ#500 Ω#10 kΩ`,
                                `${c_('Battery and lamp circuit')}#\\begin{circuitikz}\\draw (0,0) to[battery1] (2,0) to[lamp] (2,2) -- (0,2) to[switch] (0,0);\\end{circuitikz}#${c_('B')}#${c_('What happens when the switch is closed?')}#${c_('Nothing')}#${c_('The lamp turns on')}#${c_('The battery drains')}`
                            ],
                            allowRegex: /^([^#]+#[^#]+#([0-3]|[A-D]{1,4})#[^#]+#[^#]+(?:#[^#]*){1,3}|[^#]+#[^#]+)$/,
                            prompt: c_(`Generate 5 multiple-choice questions about electrical circuits. One question per line. Each line must contain all fields separated by #: a short description, TikZ code (using circuitikz) for the circuit diagram, the correct answer as letters (e.g., A, AB), the question, and 2 to 4 answer options. Do not use the # character inside any field. Do not add line breaks within a question. IMPORTANT: The TikZ code must be compatible with circuitikz version 0.9.6. Only use components available in this version: R, C, L, V, I, battery1, battery2, lamp, fuse, switch, closing switch, opening switch, D (diode), lD (LED), zD (Zener), npn, pnp, nmos, pmos, op amp, ground, rground, short, open, rmeter (with t=A for ammeter, t=V for voltmeter), and gate, or gate, not gate, nand gate, nor gate. Do NOT use components from circuitikz 1.0 or later such as dipchip, qfpchip, muxdemux, flipflop, latch, or 7-segment displays. The diagram is rendered by TikZJax, which only loads the LaTeX packages circuitikz, amsmath and amssymb; do NOT use commands from any other package. Write units as plain text or Unicode (for example Ω, µ, V, A, W, F, H, Hz, kΩ, µF), never as siunitx or gensymb macros such as \\ohm, \\volt, \\ampere, \\micro, \\si{...}, \\SI{...}{...} or \\qty{...}{...}, and never wrap a unit in angle brackets (write 100 Ω, not 100<\\ohm>).`)
                        },
                    };

                    const game = gameFormats[gameId];

                    if (!game || !Array.isArray(game.format)) {
                        return { format: [], explanation: "", examples: [], allowRegex: '', prompt: '' };
                    }

                    return {
                        format: game.format,
                        explanation: game.explanation || "",
                        examples: game.examples || [],
                        allowRegex: game.allowRegex || '',
                        prompt: game.prompt || ''
                    };
                },

                buildIAPromptText: function (gameId, options = {}) {
                    const fprompt = $exeIDevicesEdition.iDevice.gamification.share.getAllowedFormats(gameId, options);
                    const lines = [
                        c_('Act as a highly experienced teacher.'),
                        fprompt.prompt,
                        `${c_('Formats')}:`,
                        fprompt.format.join('\n'),
                        fprompt.explanation,
                        `${c_('Examples')}:`,
                        fprompt.examples.join('\n'),
                        `${c_('You must return only the questions without numbering, categorization or bullet points, inside a code block, and do not include any additional HTML elements such as buttons.')},`
                    ];
                    return lines.filter((line) => line !== undefined && line !== '').join('\n');
                },

                refreshIAPrompt: function (gameId, options = {}) {
                    const $prompt = $('#eXeEPromptArea');
                    if (!$prompt.length) return;
                    $prompt.val($exeIDevicesEdition.iDevice.gamification.share.buildIAPromptText(gameId, options));
                },

                addEvents: function (type, saveQuestions, getOptions) {
                    const resolveOptions = typeof getOptions === 'function'
                        ? getOptions
                        : () => (getOptions && typeof getOptions === 'object' ? getOptions : {});
                    const $textQuestionsArea = $('#eXeEQuestionsArea');
                    const $textPrompt = $('#eXeEPromptArea');
                    const $divEIA = $('#eXeEIADiv');

                    const $tabQuestions = $('#eXeETabQuestions');
                    const $tabPrompt = $('#eXeETabPrompt');
                    const $tabIA = $('#eXeETabIA');

                    const $copyButton = $('#eXeECopyButton');
                    const $openChatGPTButton = $('#eXeEOpenChatGPTButton');
                    const $saveButton = $('#eXeESaveButton');
                    const $iaSelect = $('#eXeEIASelect');

                    const $eXeGameAddQuestion = $('#eXeGameAddQuestion');
                    const $eXeEAddArea = $('#eXeEAddArea');

                    // Load user's default AI preference and select it
                    if (window.eXeLearning?.app?.user?.preferences?.preferences?.defaultAI?.value) {
                        const defaultAI = eXeLearning.app.user.preferences.preferences.defaultAI.value;
                        if ($iaSelect.find(`option[value="${defaultAI}"]`).length) {
                            $iaSelect.val(defaultAI);
                        } else {
                            // Fallback to the first option when the saved value is invalid
                            $iaSelect.val($iaSelect.find('option').first().val());
                        }
                    }

                    // Do not persist changes here; preferences are managed in the user preferences UI.
                    $iaSelect.off('change.defaultAI');

                    $saveButton.hide();
                    $textQuestionsArea.hide();

                    $textPrompt.show()
                    $copyButton.show();
                    $openChatGPTButton.show();
                    $iaSelect.show()
                    $divEIA.hide();                   

                    // File input custom UI events.
                    // Delegated on `document`, so they outlive the edition form:
                    // the edition owns them when one is open, and the legacy
                    // namespaces keep de-duplicating repeated calls.
                    const lifecycle = $exeIDevicesEdition.iDevice.getLifecycle();
                    const onFileTrigger = function (e) {
                        const $wrap = $(e.currentTarget).closest('[data-exe-upload]');
                        $wrap.find('.exe-file-input').trigger('click');
                    };
                    const onFileInputChange = function (e) {
                        const input = e.currentTarget;
                        const file = input.files && input.files[0];
                        const $wrap = $(input).closest('[data-exe-upload]');
                        const $name = $wrap.find('[data-exe-file-name]');
                        if (file) {
                            $wrap.attr('data-has-file', 'true');
                            $name.text(file.name);
                        } else {
                            $wrap.removeAttr('data-has-file');
                            $name.text(_("No file selected"));
                        }
                    };
                    $(document).off('click.exeFileTrigger');
                    $(document).off('change.exeFileInput');
                    if (lifecycle) {
                        lifecycle.on(document, 'click.exeFileTrigger', '[data-exe-file-trigger]', onFileTrigger);
                        lifecycle.on(document, 'change.exeFileInput', '.exe-file-input', onFileInputChange);
                    } else {
                        $(document).on('click.exeFileTrigger', '[data-exe-file-trigger]', onFileTrigger);
                        $(document).on('change.exeFileInput', '.exe-file-input', onFileInputChange);
                    }

                    $tabQuestions.on('click', function (e) {
                        e.preventDefault();
                        $tabQuestions.addClass('active');
                        $tabPrompt.removeClass('active');
                        $tabIA.removeClass('active');
                        $textQuestionsArea.show();
                        $divEIA.hide();
                        $textPrompt.hide()
                        $saveButton.show();
                        $copyButton.hide();
                        $openChatGPTButton.hide();
                        $iaSelect.hide()
                    });

                    $tabPrompt.on('click', function (e) {
                        e.preventDefault();
                        $tabQuestions.removeClass('active');
                        $tabPrompt.addClass('active');
                        $tabIA.removeClass('active');
                        $textQuestionsArea.hide();
                        $divEIA.hide();
                        $textPrompt.show()
                        $saveButton.hide();
                        $copyButton.show();
                        $openChatGPTButton.show();
                        $iaSelect.show();
                    });

                    $tabIA.on('click', function (e) {
                        e.preventDefault();
                        $tabQuestions.removeClass('active');
                        $tabPrompt.removeClass('active');
                        $tabIA.addClass('active');

                        $textQuestionsArea.hide();
                        $textPrompt.hide();
                        $divEIA.show();

                        $saveButton.hide();
                        $copyButton.hide();
                        $openChatGPTButton.hide();
                        $iaSelect.hide();
                    });

                    $openChatGPTButton.on('click', function () {
                        $tabQuestions.trigger('click');
                        let prompt = $textPrompt.val();
                        if (!prompt || !prompt.trim()) {
                            eXe.app.alert(_('There is no query to send to the assistant.'));
                            return;
                        }
                        const encodedPrompt = encodeURIComponent(prompt.trim());
                        const baseUrl = $iaSelect.val();
                        if (!baseUrl) {
                            eXe.app.alert(_('Please select an AI assistant.'));
                            return;
                        }
                        const url = `${baseUrl}${encodedPrompt}`;
                        window.open(url, '_blank');
                    });

                    $saveButton.on('click', async function () {
                        const content = $textQuestionsArea.val().trim();
                        if (!content) {
                            eXe.app.alert(_("Please enter at least one question."));
                            return;
                        }
                        const questions = $exeIDevicesEdition.iDevice.gamification.share.validateAndSave(type, $textQuestionsArea, resolveOptions());

                        // saveQuestions may be async and may own the result messaging
                        // (e.g. electrical-circuits renders each circuit image before
                        // inserting). When it returns { handledMessaging: true } the
                        // callback already informed the user, so skip the generic alert.
                        // It may also return `remainingLines` (questions it could not
                        // add): refill the textarea with them, cleared, so the user can
                        // correct them and save again.
                        const result = await saveQuestions(questions.validLines, questions.invalidLines);
                        if (result && result.handledMessaging) {
                            if (Array.isArray(result.remainingLines)) {
                                $textQuestionsArea.val(result.remainingLines.join('\n'));
                            }
                            return;
                        }
                        if (questions.invalidLines.length > 0) {
                            eXe.app.alert(_('The following lines are invalid:') + '\n\n' + questions.invalidLines.join('\n'));
                        } else {
                            // The window has done its job: the questions are in the form.
                            $exeIDevicesEdition.iDevice.gamification.share.close('ai');
                            eXe.app.alert(_('The questions have been added successfully'));
                        }
                    });
                    $copyButton.on('click', function () {
                        const content = $textPrompt.val();
                        navigator.clipboard.writeText(content)
                            .then(() => console.log('Content copied to clipboard'))
                            .catch(err => console.error('Error copying content:', err));
                    });
                    $eXeGameAddQuestion.on('click', function () {
                        const currentDisplay = $eXeEAddArea.css('display');
                        if (currentDisplay === 'none') {
                            $eXeEAddArea.css('display', 'block');
                        } else if (currentDisplay === 'none') {
                            $eXeEAddArea.css('display', 'none');
                        }
                    });
                    $textQuestionsArea.on('paste', function (e) {
                        e.preventDefault();
                        const text = (e.originalEvent || e).clipboardData.getData('text/plain');
                        const textarea = this;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
                        textarea.selectionStart = textarea.selectionEnd = start + text.length;
                    });

                    $('#eXeIAButton').on('click', function () {
                        $('#eXeIAMessage').text(_('Generating questions. Please wait...')).show();
                        $exeIDevicesEdition.iDevice.gamification.share.genarateIAQuestons(type, saveQuestions, resolveOptions());
                    });

                },
                genarateIAQuestons: async function (type, saveQuestions, options = {}) {
                    // The request outlives the form, so the edition that asked
                    // for the questions is captured here: a response arriving
                    // after the editor closed must not reach the iDevice that
                    // replaced it.
                    const lifecycle = $exeIDevicesEdition.iDevice.getLifecycle();
                    $('#eXeFormIAContainer').find('input, textarea, button, select').prop('disabled', true);
                    const $specialty = $('#eXeSpecialtyIA');
                    const $course = $('#eXeCourseIA');
                    const $numQuestions = $('#eXeNumberOfQuestionsIA');
                    const $theme = $('#eXeThemeIA');
                    let promptText = `${_("Act as a highly experienced teacher.")}`;

                    if ($specialty.length) {
                        const sp = $specialty.val().trim();
                        if (sp.length) {
                            promptText += ` ${_('Specialty')}: ${sp}.`;
                        }
                    }
                    if ($course.length) {
                        const cp = $course.val().trim();
                        if (cp.length) {
                            promptText += ` ${_('For students of')} ${cp}.`;
                        }
                    }
                    if ($theme.length) {
                        const tm = $theme.val().trim();
                        if (tm) {
                            promptText += ` ${_('on the following topic')}: ${tm}.`;
                        }
                    }
                    if ($numQuestions.length) {
                        let np = $numQuestions.val();
                        np = np ?? 10;
                        promptText += `${_('Generate')} ${np} ${_('questions')}`;
                    }
                    if ($numQuestions.length) {
                        let np = $numQuestions.val();
                        np = np ?? 10;
                        promptText += `${_('With the following formats:')}`;
                    }

                    const fprompt = $exeIDevicesEdition.iDevice.gamification.share.getAllowedFormats(type, options);
                    let prompt = `
                        ${promptText}
                        ${fprompt.format.join('\n')}
                        ${fprompt.explanation}
                        ${_('Examples')}:
                        ${fprompt.examples.join('\n')}
                        ${_('You must return only the questions without numbering and without classification or bullet points')},
                    `;

                    let sdata = '';
                    prompt = prompt.replace(/[ \t]+/g, ' ').trim();

                    try {
                        const data = await eXeLearning.app.api.getGenerateQuestions(prompt);
                        if (lifecycle && !lifecycle.isActive()) return;

                        if (data.questions) {
                            let questions = $exeIDevicesEdition.iDevice.gamification.share.checkQuestions(data.questions);
                            if (questions) {
                                const correctsQuestions = $exeIDevicesEdition.iDevice.gamification.share.validateQuesionsIA(type, questions, options);
                                saveQuestions(correctsQuestions);
                            } else {
                                sdata = _('The questions could not be generated');
                                $('#eXeIAMessage').text(_(sdata)).show();
                            }
                        } else {
                            sdata = _('The questions could not be generated. Incorrect format');
                            $('#eXeIAMessage').text(_(sdata)).show();
                        }
                        $('#eXeFormIAContainer').find('input, textarea, button, select').prop('disabled', false);
                    } catch (error) {
                        // The selectors below are global: once this edition is
                        // gone they would reach the form of the next one.
                        if (lifecycle && !lifecycle.isActive()) return;
                        sdata = _('An error occurred while retrieving the questions. Please try again.');
                        $('#eXeIAMessage').text(_(sdata)).show();
                        $('#eXeFormIAContainer').find('input, textarea, button, select').prop('disabled', false);
                    }
                },

                cleanText: function (input) {
                    const lines = input.split(/\r?\n/);
                    const cleanedLines = lines.map(line => {
                        line = line.trim();
                        line = line.replace(/\s+/g, ' ');
                        return line;
                    });
                    return cleanedLines.join('\n');
                },
                checkQuestions: function (lines) {
                    if (Array.isArray(lines) && lines.length > 0) {
                        return lines;
                    }
                    if (typeof lines === 'string') {
                        try {
                            lines = JSON.parse(lines);
                        } catch (error) {
                            return false;
                        }
                    }
                    if (typeof lines === 'object' && lines !== null) {
                        lines = Object.values(lines);
                    }
                    if (Array.isArray(lines) && lines.length > 0) {
                        return lines;
                    }

                    return false;
                },


                validateAndSave: function (gameId, $textQuestionsArea, options = {}) {
                    const lines = $textQuestionsArea.val().trim().split('\n');
                    const validLines = [];
                    const invalidLines = [];
                    const regex = $exeIDevicesEdition.iDevice.gamification.share.getAllowedFormats(gameId, options).allowRegex;

                    lines.forEach((line) => {
                        const cleanLine = line.trim();

                        if (regex.test(cleanLine)) {
                            validLines.push(cleanLine);
                        } else if (cleanLine.length > 0) {
                            invalidLines.push(cleanLine);
                        }
                    });
                    $textQuestionsArea.val(invalidLines.join('\n'));
                    return {
                        validLines: validLines,
                        invalidLines: invalidLines
                    }
                },

                validateQuesionsIA: function (gameId, lines, options = {}) {
                    const validLines = [];
                    const invalidLines = [];
                    const regex = $exeIDevicesEdition.iDevice.gamification.share.getAllowedFormats(gameId, options).allowRegex;

                    lines.forEach((line) => {
                        const cleanLine = line.trim();
                        if (regex.test(cleanLine)) {
                            validLines.push(cleanLine);
                        } else if (cleanLine.length > 0) {
                            invalidLines.push(cleanLine);
                        }
                    });

                    return validLines;
                },

                /**
                 * Get Electron API from current window or parent (for iframe contexts).
                 * Returns null when not running inside Electron.
                 */
                getElectronAPI: function () {
                    if (typeof window === 'undefined') return null;
                    try {
                        if (window.electronAPI) return window.electronAPI;
                        if (window.parent && window.parent !== window && window.parent.electronAPI) {
                            return window.parent.electronAPI;
                        }
                    } catch (_e) {
                        // Cross-origin access blocked
                    }
                    return null;
                },

                /**
                 * Download a Blob as a file from the editor UI.
                 *
                 * Centralizes the "anchor + click + revoke" pattern used by
                 * every gamification iDevice to export game data and/or
                 * questions. When running inside Electron (see PR #1595 and
                 * the double-dialog regression on `#eXeGameExportQuestions`),
                 * invoking `link.click()` on an `<a download>` with a
                 * `blob:` URL triggers Electron's `will-download` event. The
                 * main-process handler in `app/main.js` is async and shows
                 * a custom `promptSave()` dialog before calling
                 * `item.setSavePath()`. Because Electron does not await the
                 * handler's Promise, it also shows its own default Save
                 * dialog, resulting in two dialogs appearing at the same
                 * time. Routing the save through `window.electronAPI.saveBufferAs`
                 * bypasses the `will-download` path entirely and keeps a
                 * single native dialog per user action.
                 *
                 * @param {Blob} blob - The file contents.
                 * @param {string} fileName - Suggested file name.
                 * @param {string} [containerId] - DOM id used as the anchor
                 *   parent in the browser fallback. Falls back to `document.body`.
                 * @returns {boolean} `true` if a save was initiated.
                 */
                downloadBlob: function (blob, fileName, containerId) {
                    if (!(blob instanceof Blob)) return false;

                    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
                        window.navigator.msSaveOrOpenBlob(blob);
                        return true;
                    }

                    // Electron bypass: use the IPC channel so `will-download`
                    // never fires and only our custom promptSave() shows up.
                    const electronAPI =
                        $exeIDevicesEdition.iDevice.gamification.share.getElectronAPI();
                    if (electronAPI && typeof electronAPI.saveBufferAs === 'function') {
                        const projectKey =
                            (typeof window !== 'undefined' && window.__currentProjectId) ||
                            'idevice-gamification-export';
                        Promise.resolve()
                            .then(() => blob.arrayBuffer())
                            .then((buf) =>
                                electronAPI.saveBufferAs(
                                    new Uint8Array(buf),
                                    projectKey,
                                    fileName
                                )
                            )
                            .catch((err) => {
                                // eslint-disable-next-line no-console
                                console.error(
                                    '[gamification.share.downloadBlob] Electron saveBufferAs failed:',
                                    err
                                );
                            });
                        return true;
                    }

                    // Browser fallback.
                    const data = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = data;
                    link.download = fileName;
                    const container =
                        (containerId && document.getElementById(containerId)) ||
                        document.body;
                    container.appendChild(link);
                    link.click();
                    const removeLink = function () {
                        if (link.parentNode) link.parentNode.removeChild(link);
                    };
                    // The anchor is appended outside the edition form and the
                    // object URL is only released 100 ms later. The edition owns
                    // both meanwhile, so closing the editor in that window frees
                    // them instead of leaking them.
                    const lifecycle =
                        $exeIDevicesEdition.iDevice.getLifecycle();
                    const releaseLink = lifecycle ? lifecycle.own(removeLink) : null;
                    const releaseUrl = lifecycle ? lifecycle.own(() => window.URL.revokeObjectURL(data)) : null;
                    const release = function () {
                        if (releaseUrl) releaseUrl();
                        else window.URL.revokeObjectURL(data);
                        if (releaseLink) releaseLink();
                        else removeLink();
                    };
                    if (lifecycle) lifecycle.setTimeout(release, 100);
                    else setTimeout(release, 100);
                    return true;
                },

                exportGame: function (dataGame, idevice, name) {
                    if (!dataGame) return false;
                    const blob = new Blob([JSON.stringify(dataGame)], {
                        type: 'text/plain',
                    });
                    return $exeIDevicesEdition.iDevice.gamification.share.downloadBlob(
                        blob,
                        `${_('Activity')}-${name}.json`,
                        idevice
                    );
                },
                import: {

                    text: function (content, addWords) {
                        const lines = content.split('\n');
                        $exeIDevicesEdition.iDevice.gamification.share.import.insertWords(lines, wordsgame);
                    },
                    insertWords: function (lines, addWords) {
                        const lineFormat = /^([^#]+)#([^#]+)(#([^#]+))?(#([^#]+))?$/;
                        let words = [];
                        lines.forEach((line) => {
                            if (lineFormat.test(line)) {
                                const p = $exeDevice.getCuestionDefault();
                                const parts = line.split('#');
                                p.word = parts[0];
                                p.definition = parts[1];
                                if (p.word && p.definition) {
                                    words.push(p);
                                }
                            }

                        });
                        $exeIDevicesEdition.iDevice.gamification.share.import.addWords(words, wordsgame)
                    },
                    moodle: function (xmlString, addWords) {
                        const xmlDoc = $.parseXML(xmlString),
                            $xml = $(xmlDoc);
                        if ($xml.find("GLOSSARY").length > 0) {
                            $exeIDevicesEdition.iDevice.gamification.share.import.glosary(xmlString, wordsgame);
                        } else if ($xml.find("quiz").length > 0) {
                            $exeIDevicesEdition.iDevice.gamification.share.import.cuestionaryxml(xmlString, wordsgame);
                        } else {
                            eXe.app.alert(_('Sorry, wrong file format'));
                        }
                    },
                    cuestionaryxml: function (xmlText, addWords) {
                        const parser = new DOMParser(),
                            xmlDoc = parser.parseFromString(xmlText, "text/xml"),
                            $xml = $(xmlDoc);

                        if ($xml.find("parsererror").length > 0) {
                            return false;
                        }

                        const $quiz = $xml.find("quiz").first();
                        if ($quiz.length === 0) {
                            return false;
                        }

                        const words = [];
                        $quiz.find("question").each(function () {
                            const $question = $(this),
                                type = $question.attr('type');
                            if (type !== 'shortanswer') {
                                return true;
                            }
                            const questionText = $question.find("questiontext").first().text().trim(),
                                $answers = $question.find("answer");
                            let word = '',
                                maxFraction = -1;

                            $answers.each(function () {
                                const $answer = $(this),
                                    answerText = $answer.find('text').eq(0).text(),
                                    currentFraction = parseInt($answer.attr('fraction'), 10);
                                if (currentFraction > maxFraction) {
                                    maxFraction = currentFraction;
                                    word = answerText;
                                }
                            });
                            if (word && questionText) {
                                let wd = {
                                    word: $exeDevice.removeTags(word),
                                    definition: $exeDevice.removeTags(questionText)
                                }
                                words.push(wd);
                            }
                        });
                        addWords(words)
                    },
                    glosary: function (xmlText, addWords) {
                        const parser = new DOMParser(),
                            xmlDoc = parser.parseFromString(xmlText, "text/xml"),
                            $xml = $(xmlDoc);

                        if ($xml.find("parsererror").length > 0) return false;

                        const $entries = $xml.find("ENTRIES").first();
                        if ($entries.length === 0) return false;

                        const words = [];
                        $entries.find("ENTRY").each(function () {
                            const concept = $(this).find("CONCEPT").text(),
                                definition = $(this).find("DEFINITION").text().replace(/<[^>]*>/g, '');
                            if (concept && definition) {
                                let wd = {
                                    word: concept,
                                    definition: definition
                                }
                                words.push(wd);
                            }
                        });
                        addWords(words);
                    },
                },
            },
            helpers: {
                playerAudio: null,
                currentAudioUrl: null,
                /** Disposer that stops the audio when the edition closes. */
                _releaseAudio: null,

                /**
                 * Play an audio file, supporting both regular URLs and asset:// URLs
                 * If the same audio is already playing, it will stop it (toggle behavior)
                 * @param {string} audio - URL of the audio file (can be asset:// or regular URL)
                 */
                playSound: async function (audio) {
                    if (!audio || typeof audio !== 'string') {
                        console.error('playSound: Invalid audio URL');
                        return;
                    }

                    // If the same audio is playing, stop it (toggle behavior)
                    if (
                        this.playerAudio &&
                        this.currentAudioUrl === audio &&
                        !this.playerAudio.paused
                    ) {
                        this.stopSound();
                        return;
                    }

                    // Stop any currently playing audio before playing new one
                    this.stopSound();
                    // stopSound() bumps the request counter, so it is read
                    // afterwards. Resolving an asset:// URL is async: requests
                    // can overlap, and only the latest one — not stopped in
                    // the meantime — may create a player. Otherwise each would
                    // create its own and only the last stays reachable by
                    // stopSound() and by the lifecycle.
                    const request = this._soundRequest;

                    const self = this;
                    // Captured before any await: the audio must belong to the
                    // edition that asked for it, never to a later one.
                    const lifecycle = $exeIDevicesEdition.iDevice.getLifecycle();
                    let audioUrl = audio;

                    // Check if it's an asset:// URL and resolve it
                    if (audio.startsWith('asset://')) {
                        // Use the global AssetResolver to convert asset:// to blob://
                        if (
                            window.eXeLearningAssetResolver &&
                            typeof window.eXeLearningAssetResolver.resolve === 'function'
                        ) {
                            try {
                                const resolvedUrl =
                                    await window.eXeLearningAssetResolver.resolve(audio);
                                if (resolvedUrl) {
                                    audioUrl = resolvedUrl;
                                } else {
                                    console.error('playSound: Could not resolve asset URL');
                                    return;
                                }
                            } catch (error) {
                                console.error('playSound: Error resolving asset URL:', error);
                                return;
                            }
                        } else {
                            console.error('playSound: AssetResolver not available');
                            return;
                        }
                    }

                    // Resolving an asset:// URL is asynchronous: give up if the
                    // editor was closed, or a later request or a stop superseded
                    // this one, while it was in flight.
                    if (lifecycle && !lifecycle.isActive()) return;
                    if (request !== this._soundRequest) return;

                    // Extract URL from Google Drive if applicable
                    if (
                        typeof $exeDevices !== 'undefined' &&
                        $exeDevices.iDevice?.gamification?.media?.extractURLGD
                    ) {
                        audioUrl = $exeDevices.iDevice.gamification.media.extractURLGD(audioUrl);
                    }

                    // Store the original URL for comparison
                    this.currentAudioUrl = audio;

                    // Create and play the audio
                    this.playerAudio = new Audio(audioUrl);
                    // Playback would otherwise carry on after the editor closes:
                    // let the edition stop it exactly as stopSound() does.
                    if (lifecycle) {
                        this._releaseAudio = lifecycle.own(function () {
                            self.stopSound();
                        });
                    }
                    this.playerAudio
                        .play()
                        .catch((error) => console.error('playSound: Error playing audio:', error));
                },

                /**
                 * Stop the currently playing audio
                 */
                stopSound: function () {
                    // Cancels any playSound() still resolving its URL.
                    this._soundRequest = (this._soundRequest || 0) + 1;
                    if (this.playerAudio && typeof this.playerAudio.pause === 'function') {
                        this.playerAudio.pause();
                        this.playerAudio = null;
                    }
                    this.currentAudioUrl = null;
                    var release = this._releaseAudio;
                    this._releaseAudio = null;
                    if (typeof release === 'function') release();
                }
            }
        },
        // / Gamification
        filePicker: {
            init: function () {
                var filemanager = window.eXeLearning?.app?.modals?.filemanager;

                // Create buttons for inputs that don't have one
                $(".exe-file-picker,.exe-image-picker").each(function () {
                    var $input = $(this);

                    // Skip if there's already a button after
                    if ($input.next('input[type="button"].exe-pick-image, input[type="button"].exe-pick-any-file').length) {
                        return;
                    }

                    var id = this.id;
                    var isImage = $input.hasClass("exe-image-picker");
                    var css = isImage ? 'exe-pick-image' : 'exe-pick-any-file';

                    var $button = $('<input>', {
                        type: 'button',
                        class: css,
                        value: _("Select a file"),
                        'data-filepicker': id
                    });
                    $input.after($button);
                });

                // EVENT DELEGATION - A single handler for ALL buttons
                var openFileManager = function (e) {
                    e.preventDefault();
                    e.stopImmediatePropagation();

                    if (!filemanager) return;

                    var $button = $(e.currentTarget);
                    var inputId = $button.attr('data-filepicker') || $button.prev('input[type="text"]').attr('id');
                    var $input = inputId ? $('#' + inputId) : $button.prev('input[type="text"]');

                    if (!$input.length) return;

                    var isImage = $input.hasClass("exe-image-picker") || $button.hasClass("exe-pick-image");
                    var accept = null;

                    if (isImage) {
                        accept = 'image';
                    } else if (inputId && inputId.toLowerCase().indexOf('audio') !== -1) {
                        accept = 'audio';
                    } else if (inputId && inputId.toLowerCase().indexOf('video') !== -1) {
                        accept = 'video';
                    }

                    filemanager.show({
                        accept: accept,
                        onSelect: function(result) {
                            $input.val(result.assetUrl);
                            $input.data('blobUrl', result.blobUrl);
                            $input.trigger('change');
                        }
                    });
                };

                // Delegated on `document`, so it outlives the edition form: the
                // edition owns it when one is open, and the legacy namespace
                // keeps de-duplicating repeated calls.
                $(document).off('click.filepicker');
                var lifecycle = $exeIDevicesEdition.iDevice.getLifecycle();
                if (lifecycle) {
                    lifecycle.on(document, 'click.filepicker', '.exe-pick-image, .exe-pick-any-file', openFileManager);
                } else {
                    $(document).on('click.filepicker', '.exe-pick-image, .exe-pick-any-file', openFileManager);
                }

                // Initialize recorder controls for fields marked with data-voice-recorder.
                $exeIDevicesEdition.iDevice.voiceRecorder.initVoiceRecorders(document);
            },
            openFilePicker: function (e) {
                // Legacy fallback - should not be called anymore
                var id = e.id.replace("_browseFor", "");
                var type = 'media';
                if ($(e).hasClass("exe-pick-image")) type = 'image';
                try {
                    exe_tinymce.chooseImage(id, "", type, window);
                } catch (e) {
                    eXe.app.alert(e);
                }
            }
        },
        voiceRecorder: {
            maxDurationMs: 120000,
            startDelayMs: 80,
            styleId: 'exe-voice-recorder-styles',
            instances: [],
            _cleanupBound: false,
            _detachObserver: null,
            isSupported: function () {
                return !!(
                    navigator?.mediaDevices?.getUserMedia &&
                    typeof window.MediaRecorder !== 'undefined'
                );
            },
            bindCleanupHandlers: function () {
                if (this._cleanupBound) return;
                this._cleanupBound = true;

                var self = this;
                var lifecycle = $exeIDevicesEdition.iDevice.getLifecycle();

                var releaseOnPageHide = function () {
                    self.cleanupAll();
                };

                // `window` and `document.body` both outlive the edition form, so
                // an edition owns these registrations and binds them again the
                // next time an editor is opened.
                if (lifecycle) {
                    lifecycle.addEventListener(window, 'beforeunload', releaseOnPageHide);
                    lifecycle.addEventListener(window, 'pagehide', releaseOnPageHide);
                } else {
                    window.addEventListener('beforeunload', releaseOnPageHide);
                    window.addEventListener('pagehide', releaseOnPageHide);
                }

                if (typeof MutationObserver !== 'undefined' && document.body) {
                    this._detachObserver = new MutationObserver(function () {
                        self.cleanupDetachedInstances();
                    });
                    this._detachObserver.observe(document.body, {
                        childList: true,
                        subtree: true,
                    });
                    if (lifecycle) lifecycle.ownInstance(this._detachObserver, 'disconnect');
                }

                if (lifecycle) {
                    lifecycle.own(function () {
                        self._cleanupBound = false;
                        self._detachObserver = null;
                    });
                }
            },
            registerInstance: function (entry) {
                this.instances.push(entry);
            },
            unregisterInstance: function (entry) {
                this.instances = this.instances.filter(function (current) {
                    return current !== entry;
                });
            },
            cleanupDetachedInstances: function () {
                var self = this;
                this.instances.slice().forEach(function (entry) {
                    var el = entry?.containerEl;
                    if (!el || !document.body.contains(el)) {
                        try {
                            entry.cleanup();
                        } catch (error) {
                            self.unregisterInstance(entry);
                        }
                    }
                });
            },
            cleanupAll: function () {
                this.instances.slice().forEach(function (entry) {
                    try {
                        entry.cleanup();
                    } catch (error) {
                        // Ignore cleanup errors during global shutdown.
                    }
                });
                this.instances = [];
            },
            getStrings: function () {
                return {
                    startRecording: _('Start voice recording'),
                    stopRecording: _('Stop'),
                    saveRecording: _('Save'),
                    discardRecording: _('Delete'),
                    fileName: _('File name'),
                    recordingTime: _('Recording time'),
                    reviewRecording: _('Review recording'),
                    recordingInProgress: _('Recording in progress'),
                    uploading: _('Uploading...'),
                    microphoneError: _('Microphone access was denied or unavailable.'),
                    uploadError: _('Failed to save recording.'),
                };
            },
            initVoiceRecorders: function (rootElement, assetManager) {
                if (!this.isSupported()) return;

                var $root = $(rootElement || document);
                if (!$root.length) return;

                this.ensureStyles();
                this.bindCleanupHandlers();

                var self = this;
                $root.find('[data-voice-recorder]').each(function () {
                    self.initRecorder($(this), assetManager);
                });
            },
            ensureStyles: function () {
                if (document.getElementById(this.styleId)) return;

                var style = document.createElement('style');
                style.id = this.styleId;
                style.textContent = `
                    .exe-voice-recorder-toggle.recording {
                        color: #fff;
                        background-color: #d9534f;
                        border-color: #d9534f;
                        animation: exeVoicePulse 1.2s infinite;
                    }
                    .exe-voice-recorder-toggle {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 2.25rem !important;
                        height: 2.25rem !important;
                        min-width: 2.25rem !important;
                        min-height: 2.25rem !important;
                        padding: 0 !important;
                        aspect-ratio: 1 / 1;
                        flex-shrink: 0;
                        line-height: 1;
                        color: var(--brand-primary, #0BA1A1);
                        border-color: var(--brand-primary, #0BA1A1);
                        background: #fff;
                    }
                    .exe-voice-recorder-toggle:hover,
                    .exe-voice-recorder-toggle:focus,
                    .exe-voice-recorder-toggle:active {
                        color: #087d7d;
                        border-color: #087d7d;
                        background: #e6f6f6;
                    }
                    .exe-voice-recorder-toggle svg {
                        width: 1rem;
                        height: 1rem;
                        fill: currentColor;
                    }
                    @keyframes exeVoicePulse {
                        0% { box-shadow: 0 0 0 0 rgba(217, 83, 79, 0.45); }
                        70% { box-shadow: 0 0 0 8px rgba(217, 83, 79, 0); }
                        100% { box-shadow: 0 0 0 0 rgba(217, 83, 79, 0); }
                    }
                    .exe-voice-recorder-panel {
                        border: 1px solid #ced4da;
                        border-radius: 0.375rem;
                        padding: 0.75rem;
                        margin-top: 0.5rem;
                        background: #fff;
                    }
                    .exe-voice-recorder-status {
                        font-size: 0.875rem;
                        color: #495057;
                    }
                    .exe-voice-recorder-error {
                        color: #b3092f;
                        font-size: 0.875rem;
                        margin-top: 0.5rem;
                    }
                    .exe-voice-recorder-fallback-modal {
                        position: fixed;
                        inset: 0;
                        background: rgba(0, 0, 0, 0.45);
                        z-index: 1070;
                        display: none;
                        align-items: center;
                        justify-content: center;
                        padding: 1rem;
                    }
                    .exe-voice-recorder-fallback-modal.show {
                        display: flex;
                    }
                    .exe-voice-recorder-fallback-dialog {
                        background: #fff;
                        border-radius: 0.5rem;
                        width: 560px !important;
                        max-width: 92vw !important;
                        box-shadow: 0 0.75rem 2rem rgba(0, 0, 0, 0.2);
                    }
                    .exe-voice-recorder-modal-dialog {
                        width: 560px !important;
                        max-width: 92vw !important;
                    }
                    .exe-voice-recorder-modal-dialog .modal-content,
                    .exe-voice-recorder-fallback-dialog {
                        width: 100%;
                    }
                    .exe-voice-recorder-stop,
                    .exe-voice-recorder-save,
                    .exe-voice-recorder-cancel {
                        min-width: 8rem;
                        min-height: 2.5rem;
                        padding: 0.5rem 0.9rem;
                        font-size: 0.95rem;
                        font-weight: 500;
                    }
                `;
                document.head.appendChild(style);
            },
            getPreferredMimeType: function () {
                if (typeof window.MediaRecorder === 'undefined' || typeof window.MediaRecorder.isTypeSupported !== 'function') {
                    return '';
                }
                if (window.MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                    return 'audio/webm;codecs=opus';
                }
                if (window.MediaRecorder.isTypeSupported('audio/mp4')) {
                    return 'audio/mp4';
                }
                if (window.MediaRecorder.isTypeSupported('audio/webm')) {
                    return 'audio/webm';
                }
                return '';
            },
            getExtensionForMimeType: function (mimeType) {
                var normalized = (mimeType || '').toLowerCase();
                if (normalized.indexOf('audio/mp4') === 0) return 'mp4';
                if (normalized.indexOf('audio/webm') === 0) return 'webm';
                return 'webm';
            },
            getDefaultRecordingName: function () {
                var date = new Date();
                var yyyy = String(date.getFullYear());
                var mm = String(date.getMonth() + 1).padStart(2, '0');
                var dd = String(date.getDate()).padStart(2, '0');
                var hh = String(date.getHours()).padStart(2, '0');
                var min = String(date.getMinutes()).padStart(2, '0');
                var ss = String(date.getSeconds()).padStart(2, '0');
                return 'audio-rec-' + yyyy + mm + dd + '-' + hh + min + ss;
            },
            stripAudioExtension: function (name) {
                var value = (name || '').toString().trim();
                return value.replace(/\.(mp3|wav|ogg|m4a|aac|flac|webm|mp4)$/i, '');
            },
            sanitizeFileNameBase: function (name) {
                var value = this.stripAudioExtension(name);
                if (!value) {
                    return this.getDefaultRecordingName();
                }
                value = value
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-zA-Z0-9_-]+/g, '-')
                    .replace(/-+/g, '-')
                    .replace(/^-|-$/g, '');
                return value || this.getDefaultRecordingName();
            },
            formatTime: function (seconds) {
                var mm = String(Math.floor(seconds / 60)).padStart(2, '0');
                var ss = String(seconds % 60).padStart(2, '0');
                return mm + ':' + ss;
            },
            resolveAssetManager: function (assetManager) {
                return (
                    assetManager ||
                    window.eXeLearning?.app?.project?._yjsBridge?.assetManager ||
                    null
                );
            },
            initRecorder: function ($container, assetManager) {
                if ($container.data('voiceRecorderInit')) return;

                var inputSelector = $container.attr('data-voice-input') || '';
                var previewSelector = $container.attr('data-voice-preview') || '';
                var $input = inputSelector
                    ? $(inputSelector).first()
                    : $container.find('input[type="text"]').first();
                if (!$input.length) return;

                var $preview = previewSelector ? $(previewSelector).first() : $();
                var strings = this.getStrings();

                var $anchor = $container
                    .find('.exe-pick-any-file, .exe-pick-image, input[type="button"], button')
                    .not('.exe-voice-recorder-toggle')
                    .first();
                if (!$anchor.length) {
                    $anchor = $input;
                }

                var $toggle = $('<button>', {
                    type: 'button',
                    class: 'btn btn-outline-secondary exe-voice-recorder-toggle',
                    'aria-label': strings.startRecording,
                    title: strings.startRecording,
                    html: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.92V21h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-3.08A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 1 0 10 0z"></path></svg><span class="sr-av">' + strings.startRecording + '</span>',
                });
                var $inlineError = $('<div class="exe-voice-recorder-error d-none" aria-live="polite"></div>');

                var modalId = 'exe-voice-recorder-modal-' + Date.now() + '-' + Math.round(Math.random() * 10000);
                var inputId = 'exe-voice-recorder-name-' + Date.now() + '-' + Math.round(Math.random() * 10000);

                var $modal = $(
                    '<div class="modal fade" id="' + modalId + '" tabindex="-1" aria-hidden="true">' +
                    '<div class="modal-dialog modal-dialog-centered exe-voice-recorder-modal-dialog">' +
                    '<div class="modal-content">' +
                    '<div class="modal-header">' +
                    '<h5 class="modal-title">' + strings.reviewRecording + '</h5>' +
                    '</div>' +
                    '<div class="modal-body">' +
                    '<div class="exe-voice-recorder-recording-view">' +
                    '<div class="exe-voice-recorder-status mb-3"><strong>' + _('Recording') + ':</strong> <span class="exe-voice-recorder-time">00:00</span></div>' +
                    '<div class="d-flex justify-content-end"><button type="button" class="btn btn-primary exe-voice-recorder-stop" aria-label="' + strings.stopRecording + '">' + strings.stopRecording + '</button></div>' +
                    '</div>' +
                    '<div class="exe-voice-recorder-confirmation-view d-none">' +
                    '<audio class="exe-voice-recorder-audio w-100 mb-2" controls></audio>' +
                    '<label class="mb-1" for="' + inputId + '">' + strings.fileName + '</label>' +
                    '<input type="text" class="form-control exe-voice-recorder-name" id="' + inputId + '" />' +
                    '</div>' +
                    '<div class="exe-voice-recorder-error d-none mt-2" aria-live="polite"></div>' +
                    '</div>' +
                    '<div class="modal-footer">' +
                    '<button type="button" class="btn btn-primary exe-voice-recorder-save" aria-label="' + strings.saveRecording + '">' + strings.saveRecording + '</button>' +
                    '<button type="button" class="btn btn-outline-secondary exe-voice-recorder-cancel" aria-label="' + _('Cancel') + '">' + _('Cancel') + '</button>' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '</div>'
                );

                var $fallbackModal = $(
                    '<div class="exe-voice-recorder-fallback-modal" id="' + modalId + '-fallback" aria-hidden="true">' +
                    '<div class="exe-voice-recorder-fallback-dialog">' +
                    '<div class="modal-header">' +
                    '<h5 class="modal-title">' + strings.reviewRecording + '</h5>' +
                    '</div>' +
                    '<div class="modal-body">' +
                    '<div class="exe-voice-recorder-recording-view">' +
                    '<div class="exe-voice-recorder-status mb-3"><strong>' + _('Recording') + ':</strong> <span class="exe-voice-recorder-time">00:00</span></div>' +
                    '<div class="d-flex justify-content-end"><button type="button" class="btn btn-primary exe-voice-recorder-stop" aria-label="' + strings.stopRecording + '">' + strings.stopRecording + '</button></div>' +
                    '</div>' +
                    '<div class="exe-voice-recorder-confirmation-view d-none">' +
                    '<audio class="exe-voice-recorder-audio w-100 mb-2" controls></audio>' +
                    '<label class="mb-1" for="' + inputId + '-fallback">' + strings.fileName + '</label>' +
                    '<input type="text" class="form-control exe-voice-recorder-name" id="' + inputId + '-fallback" />' +
                    '</div>' +
                    '<div class="exe-voice-recorder-error d-none mt-2" aria-live="polite"></div>' +
                    '</div>' +
                    '<div class="modal-footer">' +
                    '<button type="button" class="btn btn-primary exe-voice-recorder-save" aria-label="' + strings.saveRecording + '">' + strings.saveRecording + '</button>' +
                    '<button type="button" class="btn btn-outline-secondary exe-voice-recorder-cancel" aria-label="' + _('Cancel') + '">' + _('Cancel') + '</button>' +
                    '</div>' +
                    '</div>' +
                    '</div>'
                );

                $('body').append($modal);
                $('body').append($fallbackModal);

                $anchor.after($toggle);
                $toggle.after($inlineError);

                var state = {
                    recorder: null,
                    stream: null,
                    chunks: [],
                    blob: null,
                    blobUrl: '',
                    timerId: null,
                    maxTimerId: null,
                    startTimerId: null,
                    seconds: 0,
                    uploaded: false,
                    lastFocused: null,
                    mimeType: this.getPreferredMimeType(),
                    modalOpen: false,
                    recordingStarted: false,
                    suggestedName: '',
                    // Set by cleanup(). The microphone permission, the recorder's
                    // `stop` event and the upload all settle later, so each of
                    // them checks it before touching anything cleanup released.
                    destroyed: false,
                };

                var self = this;
                var modalApi = null;
                if (window.bootstrap && window.bootstrap.Modal) {
                    modalApi = new window.bootstrap.Modal($modal[0], {
                        backdrop: 'static',
                        keyboard: false,
                    });
                }

                function getActiveModal() {
                    return modalApi ? $modal : $fallbackModal;
                }

                function updateModalTime() {
                    getActiveModal().find('.exe-voice-recorder-time').text(self.formatTime(state.seconds));
                }

                function showRecordingView() {
                    var $activeModal = getActiveModal();
                    $activeModal.find('.exe-voice-recorder-recording-view').removeClass('d-none');
                    $activeModal.find('.exe-voice-recorder-confirmation-view').addClass('d-none');
                    $activeModal.find('.exe-voice-recorder-save').addClass('d-none');
                    $activeModal.find('.exe-voice-recorder-cancel').addClass('d-none');
                }

                function showConfirmationView() {
                    var $activeModal = getActiveModal();
                    $activeModal.find('.exe-voice-recorder-recording-view').addClass('d-none');
                    $activeModal.find('.exe-voice-recorder-confirmation-view').removeClass('d-none');
                    $activeModal.find('.exe-voice-recorder-save').removeClass('d-none');
                    $activeModal.find('.exe-voice-recorder-cancel').removeClass('d-none');
                }

                function openModal() {
                    if (modalApi) {
                        modalApi.show();
                    } else {
                        $fallbackModal.addClass('show').attr('aria-hidden', 'false');
                    }
                    state.modalOpen = true;
                }

                function openConfirmationModal() {
                    var $activeModal = getActiveModal();
                    state.suggestedName = self.getDefaultRecordingName();
                    $activeModal.find('.exe-voice-recorder-audio').attr('src', state.blobUrl);
                    $activeModal.find('.exe-voice-recorder-name').val('');
                    $activeModal
                        .find('.exe-voice-recorder-name')
                        .attr('placeholder', state.suggestedName);
                    showConfirmationView();
                    showError('', true);

                    openModal();
                    setTimeout(function () {
                        $activeModal.find('.exe-voice-recorder-name').trigger('focus');
                    }, 0);
                }

                function closeConfirmationModal() {
                    if (modalApi) {
                        modalApi.hide();
                    } else {
                        $fallbackModal.removeClass('show').attr('aria-hidden', 'true');
                    }
                    state.modalOpen = false;
                }

                function stopStream() {
                    if (!state.stream) return;
                    state.stream.getTracks().forEach(function (track) {
                        if (track && typeof track.stop === 'function') track.stop();
                    });
                    state.stream = null;
                }

                function clearTimers() {
                    if (state.timerId) clearInterval(state.timerId);
                    if (state.maxTimerId) clearTimeout(state.maxTimerId);
                    if (state.startTimerId) clearTimeout(state.startTimerId);
                    state.timerId = null;
                    state.maxTimerId = null;
                    state.startTimerId = null;
                }

                function showError(message, forModal) {
                    var $error;
                    if (forModal) {
                        $error = getActiveModal().find('.exe-voice-recorder-error');
                    } else {
                        $error = $inlineError;
                    }
                    if (!message) {
                        $error.addClass('d-none').text('');
                        return;
                    }
                    $error.removeClass('d-none').text(message);
                }

                function setIdleState() {
                    clearTimers();
                    state.recordingStarted = false;
                    state.seconds = 0;
                    updateModalTime();
                    $toggle.removeClass('recording').prop('disabled', false);
                    showError('', false);
                    if (state.lastFocused && typeof state.lastFocused.focus === 'function') {
                        state.lastFocused.focus();
                        state.lastFocused = null;
                    }
                }

                function setRecordingState() {
                    $toggle.addClass('recording').prop('disabled', false);
                    showRecordingView();
                    openModal();
                    updateModalTime();
                    showError('', false);
                }

                function beginRecording() {
                    if (!state.recorder || state.recordingStarted) return;
                    if (!state.modalOpen) return;

                    state.recordingStarted = true;
                    state.seconds = 0;
                    updateModalTime();

                    state.timerId = setInterval(function () {
                        state.seconds += 1;
                        updateModalTime();
                    }, 1000);

                    state.maxTimerId = setTimeout(function () {
                        stopRecording();
                    }, self.maxDurationMs);

                    state.recorder.start(200);
                }

                function scheduleRecordingStart() {
                    if (state.startTimerId) {
                        clearTimeout(state.startTimerId);
                        state.startTimerId = null;
                    }

                    if (modalApi) {
                        $modal.one('shown.bs.modal', function () {
                            beginRecording();
                        });
                    }

                    state.startTimerId = setTimeout(function () {
                        beginRecording();
                    }, self.startDelayMs);
                }

                function setUploadingState(uploading) {
                    var $activeModal = getActiveModal();
                    $activeModal.find('.exe-voice-recorder-save, .exe-voice-recorder-cancel').prop('disabled', uploading);
                    if (uploading) {
                        $activeModal.find('.exe-voice-recorder-save').text(strings.uploading);
                    } else {
                        $activeModal.find('.exe-voice-recorder-save').text(strings.saveRecording);
                    }
                }

                function resetBlob() {
                    if (state.blobUrl) {
                        URL.revokeObjectURL(state.blobUrl);
                    }
                    state.blob = null;
                    state.blobUrl = '';
                    state.uploaded = false;
                    $modal.find('.exe-voice-recorder-audio').attr('src', '');
                    $fallbackModal.find('.exe-voice-recorder-audio').attr('src', '');
                }

                async function startRecording() {
                    try {
                        resetBlob();
                        showError('', false);
                        state.lastFocused = document.activeElement;
                        var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        if (state.destroyed) {
                            // Granted too late: release the microphone at once
                            // instead of recording into a closed editor.
                            stream.getTracks().forEach(function (track) {
                                if (track && typeof track.stop === 'function') track.stop();
                            });
                            return;
                        }
                        state.stream = stream;
                        state.chunks = [];

                        var options = state.mimeType ? { mimeType: state.mimeType } : undefined;
                        state.recorder = options
                            ? new MediaRecorder(state.stream, options)
                            : new MediaRecorder(state.stream);

                        state.recorder.ondataavailable = function (event) {
                            if (event.data && event.data.size > 0) {
                                state.chunks.push(event.data);
                            }
                        };

                        state.recorder.onstop = function () {
                            // Delivered asynchronously after stop(), so it can
                            // arrive once cleanup disposed the modal.
                            if (state.destroyed) return;
                            clearTimers();
                            stopStream();
                            state.recordingStarted = false;
                            var outputType = state.recorder.mimeType || state.mimeType || 'audio/webm';
                            state.blob = new Blob(state.chunks, { type: outputType });
                            state.blobUrl = URL.createObjectURL(state.blob);
                            openConfirmationModal();
                        };

                        setRecordingState();
                        scheduleRecordingStart();
                    } catch (error) {
                        stopStream();
                        if (state.destroyed) return;
                        setIdleState();
                        showError(strings.microphoneError, false);
                    }
                }

                function stopRecording() {
                    if (!state.recorder) return;
                    if (state.recorder.state === 'recording') {
                        state.recorder.stop();
                    } else if (!state.recordingStarted && state.modalOpen) {
                        discardRecording(true);
                    }
                }

                function discardRecording(skipStop) {
                    if (!skipStop) {
                        stopRecording();
                    }
                    stopStream();
                    clearTimers();
                    closeConfirmationModal();
                    resetBlob();
                    setIdleState();
                }

                async function saveRecording() {
                    if (!state.blob) return;
                    var manager = self.resolveAssetManager(assetManager);
                    if (!manager || typeof manager.insertImage !== 'function') {
                        showError(strings.uploadError, true);
                        return;
                    }

                    try {
                        setUploadingState(true);
                        showError('', true);
                        var mimeType = state.blob.type || state.mimeType || 'audio/webm';
                        var extension = self.getExtensionForMimeType(mimeType);
                        var userName = getActiveModal().find('.exe-voice-recorder-name').val();
                        var baseCandidate = userName;
                        if (!baseCandidate || !baseCandidate.toString().trim()) {
                            baseCandidate = state.suggestedName;
                        }
                        var fileNameBase = self.sanitizeFileNameBase(baseCandidate);
                        var file = new File(
                            [state.blob],
                            fileNameBase + '.' + extension,
                            { type: mimeType }
                        );

                        var assetUrl = await manager.insertImage(file);
                        if (state.destroyed) return;
                        $input.val(assetUrl).trigger('change');

                        if ($preview.length && $preview.is('audio')) {
                            $preview.attr('src', state.blobUrl).removeClass('d-none').show();
                        }

                        state.uploaded = true;
                        discardRecording(true);
                    } catch (error) {
                        showError(strings.uploadError, true);
                    } finally {
                        setUploadingState(false);
                    }
                }

                var registryEntry = {
                    containerEl: $container.get(0),
                    cleanup: function () {
                        if ($container.data('voiceRecorderDestroyed')) return;
                        $container.data('voiceRecorderDestroyed', true);
                        state.destroyed = true;

                        try {
                            if (state.recorder && state.recorder.state === 'recording') {
                                state.recorder.stop();
                            }
                        } catch (error) {
                            // Ignore recorder stop errors during forced cleanup.
                        }

                        stopStream();
                        clearTimers();

                        if (state.blobUrl) {
                            try {
                                URL.revokeObjectURL(state.blobUrl);
                            } catch (error) {
                                // Ignore revoke errors.
                            }
                        }
                        state.blob = null;
                        state.blobUrl = '';

                        closeConfirmationModal();

                        $toggle.off();
                        $inlineError.remove();

                        if (modalApi) {
                            try {
                                modalApi.dispose();
                            } catch (error) {
                                // Ignore dispose errors.
                            }
                        }
                        $modal.remove();
                        $fallbackModal.remove();

                        self.unregisterInstance(registryEntry);
                    },
                };

                this.registerInstance(registryEntry);

                // A recorder holds a microphone stream, timers, an object URL and
                // two modals appended to <body> — none of them inside the edition
                // form. Closing the editor must release all of it, and above all
                // must stop the microphone. `cleanup()` is idempotent, so the
                // detach observer and this disposer can both reach it.
                var recorderLifecycle = $exeIDevicesEdition.iDevice.getLifecycle();
                if (recorderLifecycle) {
                    recorderLifecycle.own(function () {
                        registryEntry.cleanup();
                    });
                }

                $toggle.on('click', function (event) {
                    event.preventDefault();
                    if (state.modalOpen) return;
                    if ($toggle.hasClass('recording')) {
                        stopRecording();
                    } else {
                        startRecording();
                    }
                });

                $modal.find('.exe-voice-recorder-stop').on('click', function (event) {
                    event.preventDefault();
                    stopRecording();
                });

                $fallbackModal.find('.exe-voice-recorder-stop').on('click', function (event) {
                    event.preventDefault();
                    stopRecording();
                });

                $modal.find('.exe-voice-recorder-cancel').on('click', function (event) {
                    event.preventDefault();
                    discardRecording(true);
                });

                $fallbackModal.find('.exe-voice-recorder-cancel').on('click', function (event) {
                    event.preventDefault();
                    discardRecording(true);
                });

                $modal.find('.exe-voice-recorder-save').on('click', function (event) {
                    event.preventDefault();
                    saveRecording();
                });

                $fallbackModal.find('.exe-voice-recorder-save').on('click', function (event) {
                    event.preventDefault();
                    saveRecording();
                });

                $container.data('voiceRecorderInit', true);
                $container.data('voiceRecorderCleanup', function () {
                    registryEntry.cleanup();
                });
            },
        },
        // iDevice tabs
        tabs: {
            /**
             * The shared form tabs, in the order every iDevice shows them.
             */
            order: ['instructions', 'options', 'contents', 'passwords', 'feedback', 'after', 'grading', 'texts'],

            /**
             * The informative message that opens a tab: what is done there,
             * broadly. Same alert as the iDevice description, with an icon
             * from the application's icon font.
             *
             * @param {string} text The message (HTML).
             * @returns {string} '' when there is no text.
             */
            getInfo: function (text) {
                if (!text) return '';
                return `<div class="alert alert-info d-flex align-items-start gap-2 mb-3" role="note">
                        <span class="auto-icon fs-5 lh-1" aria-hidden="true">info</span>
                        <p class="m-0">${text}</p>
                    </div>`;
            },

            /**
             * Whether a value is usable as an element id or as part of one.
             *
             * @param {*} value
             * @returns {boolean}
             */
            isValidId: function (value) {
                return typeof value === 'string' && /^[A-Za-z][\w-]*$/.test(value);
            },

            /**
             * Title, informative message and contents of one of the shared
             * tabs.
             *
             * @param {string} name A name in `order`.
             * @param {*} value The value `config` gives that tab.
             * @param {Object} config The whole `getHtml` configuration.
             * @returns {{title: string, info: string, content: string}}
             */
            getDefinition: function (name, value, config) {
                const iDevice = $exeIDevicesEdition.iDevice;
                const gamification = iDevice.gamification;
                const settings = value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
                const html = typeof value === 'string' ? value : '';
                switch (name) {
                    case 'instructions':
                        return {
                            title: _('Instructions'),
                            info: _('Write the instructions the learners will read before they start the activity.'),
                            content: gamification.instructions.getEditor(html),
                        };
                    case 'options':
                        return {
                            title: _('Options'),
                            info: _('Choose how the activity works: its score, its time, its lives and the rest of its settings.'),
                            content: html,
                        };
                    case 'contents':
                        return {
                            title: _('Questions'),
                            info: _('Add the questions of the activity and edit them one by one.'),
                            content: html,
                        };
                    case 'passwords':
                        return {
                            title: _('Passwords'),
                            info: _("You might create a sequence of challenges where players won't be able to access a new game or challenge until they obtain a key from previous activity. For this purpose, you might set up an access code as well as a message that will be displayed to players when they reach a fixed percentage of correct answers, which they can use as a password for a new challenge or a following activity."),
                            content: gamification.itinerary.getContents(),
                        };
                    case 'feedback':
                        return {
                            title: _('Feedback'),
                            info: _('Show the learners a message when they reach a percentage of correct answers.'),
                            content: gamification.feedback.getContents(),
                        };
                    case 'after':
                        return {
                            title: _('After'),
                            info: _('Add the content that will be shown after the activity.'),
                            content: iDevice.common.getTextEditor('after'),
                        };
                    case 'grading':
                        return {
                            title: _('Grading'),
                            info: _('Decide whether the score is saved in the LMS, how much the activity counts and the minimum mark to pass it.'),
                            content: gamification.scorm.getContents(config.path, settings),
                        };
                    case 'texts':
                        return {
                            title: _('Texts'),
                            info: _('Type your own texts or use the default ones:'),
                            content: gamification.common.getLanguageContents(value),
                        };
                }
                return { title: name, info: '', content: '' };
            },

            /**
             * The horizontal tabs at the top of an iDevice form, styled with
             * Bootstrap's nav-tabs. Each key of `config` is a tab: it is shown
             * when the key is present and not false, and its value is its
             * contents. Tabs always come in the order of `tabs.order` and
             * keep their titles, so every iDevice lays out its form the same
             * way; each panel opens with a message saying what is done there.
             *
             * Call `tabs.bind(id)` once the HTML is in the document.
             *
             * @param {string} id Prefix for the ids of the tabs and panels
             * (`<id>-tab-<name>` and `<id>-panel-<name>`).
             * @param {Object} config
             * @param {string} [config.instructions] Default instructions
             * (HTML); '' for none.
             * @param {string} [config.options] The game options (HTML).
             * @param {string} [config.contents] The questions, cards,
             * words... of the activity (HTML), in the Questions tab.
             * @param {boolean} [config.passwords] Access code and message.
             * @param {boolean} [config.feedback] See gamification.feedback.
             * @param {boolean} [config.after] The "Content after" editor.
             * @param {boolean|Object} [config.grading] Options of
             * gamification.scorm.getContents.
             * @param {Object|Array} [config.texts] The iDevice's custom texts.
             * @param {boolean|Object} [config.share] The Import, Export and
             * Create with AI links of the Questions tab, there by default:
             * { importQuestions, exportQuestions, type, options }, see
             * gamification.share.getTools; false to leave them out.
             * @param {Object<string, string>} [config.info] The iDevice's own
             * message for some shared tabs, by tab name, in place of the
             * shared one (HTML): e.g. how its questions are written.
             * @param {Array<{name: string, title: string, info: string, content: string}>} [config.extra]
             * Tabs of this iDevice only, after the shared ones.
             * @param {string} [config.path] The iDevice's path, used by the
             * Grading tab (omit it to leave the progress report out).
             * @param {string} [config.active] Name of the tab shown first;
             * by default Questions, or the first tab when there is none.
             * @returns {string} '' when the id is not valid or no tab is shown.
             */
            getHtml: function (id, config) {
                const tabs = $exeIDevicesEdition.iDevice.tabs;
                const escape = $exeIDevicesEdition.iDevice.common.escapeHtml;
                if (!tabs.isValidId(id) || config === null || typeof config !== 'object') return '';

                const ownInfo = config.info !== null && typeof config.info === 'object' ? config.info : {};
                const list = [];
                tabs.order.forEach(function (name) {
                    const value = config[name];
                    if (value === undefined || value === null || value === false) return;
                    const definition = tabs.getDefinition(name, value, config);
                    if (typeof ownInfo[name] === 'string') definition.info = ownInfo[name];
                    list.push(Object.assign({ name: name }, definition));
                });
                (Array.isArray(config.extra) ? config.extra : []).forEach(function (tab) {
                    // The name ends up in the tab's ids, so it has to be valid and unique.
                    if (!tab || !tabs.isValidId(tab.name)) return;
                    if (list.some((item) => item.name === tab.name)) return;
                    list.push({
                        name: tab.name,
                        title: tab.title || tab.name,
                        info: tab.info || '',
                        content: tab.content || '',
                    });
                });
                if (list.length === 0) return '';

                // The questions are what an author spends the editing on.
                const shown = (name) => list.some((tab) => tab.name === name);
                let active = list[0].name;
                if (shown(config.active)) active = config.active;
                else if (shown('contents')) active = 'contents';
                const tools =
                    shown('contents') && config.share !== false
                        ? $exeIDevicesEdition.iDevice.gamification.share.getTools(config.share)
                        : { toolbar: '', modals: '' };
                let nav = '';
                let panels = '';
                list.forEach(function (tab) {
                    const isActive = tab.name === active;
                    const tabId = `${id}-tab-${tab.name}`;
                    const panelId = `${id}-panel-${tab.name}`;
                    // The links sit on the right, above the question form.
                    const toolbar = tab.name === 'contents' ? tools.toolbar : '';
                    nav += `
                        <li class="nav-item" role="presentation">
                            <button type="button" class="nav-link${isActive ? ' active' : ''}" id="${tabId}" data-exe-tab="${tab.name}" role="tab" aria-controls="${panelId}" aria-selected="${isActive}" tabindex="${isActive ? 0 : -1}">${escape(tab.title)}</button>
                        </li>`;
                    panels += `
                        <div class="tab-pane${isActive ? ' active show' : ''}" id="${panelId}" role="tabpanel" aria-labelledby="${tabId}" tabindex="0">${tabs.getInfo(tab.info)}${toolbar}${tab.content}</div>`;
                });
                // The windows wait here, hidden, until bind moves them to <body>.
                return `
                    <ul class="nav nav-tabs" id="${id}-tabs" role="tablist">${nav}</ul>
                    <div class="tab-content border border-top-0 rounded-bottom p-3 mb-3" id="${id}-panels">${panels}</div>${tools.modals}`;
            },

            /**
             * Make the tabs of `getHtml` work: click, and the arrow, Home and
             * End keys of the WAI-ARIA tabs pattern. Also mounts the windows
             * of the Questions tab (gamification.share.mount).
             *
             * Handled here rather than by Bootstrap's tab plugin: the plugin
             * keeps an instance per button that nothing would dispose of when
             * the editor closes. These handlers live on the form's own buttons,
             * which the edition teardown unbinds.
             *
             * Call it before the iDevice binds its own handlers: those of
             * Import, Export and AI look their controls up in the document.
             *
             * @param {string} id The id given to getHtml.
             */
            bind: function (id) {
                const tabs = $exeIDevicesEdition.iDevice.tabs;
                if (!tabs.isValidId(id)) return;
                $exeIDevicesEdition.iDevice.common.initHelpTooltips(document.getElementById(`${id}-panels`));
                $exeIDevicesEdition.iDevice.gamification.share.mount();
                const $buttons = $(`#${id}-tabs [data-exe-tab]`);
                $buttons
                    .off('.exeTabs')
                    .on('click.exeTabs', function () {
                        tabs.show(id, this.getAttribute('data-exe-tab'));
                    })
                    .on('keydown.exeTabs', function (e) {
                        const buttons = $buttons.toArray();
                        const index = buttons.indexOf(this);
                        let next;
                        switch (e.key) {
                            case 'ArrowRight':
                                next = (index + 1) % buttons.length;
                                break;
                            case 'ArrowLeft':
                                next = (index - 1 + buttons.length) % buttons.length;
                                break;
                            case 'Home':
                                next = 0;
                                break;
                            case 'End':
                                next = buttons.length - 1;
                                break;
                            default:
                                return;
                        }
                        e.preventDefault();
                        tabs.show(id, buttons[next].getAttribute('data-exe-tab'));
                        buttons[next].focus();
                    });
            },

            /**
             * Show one of the tabs of `getHtml`, e.g. the one holding a field
             * that failed validation.
             *
             * @param {string} id The id given to getHtml.
             * @param {string} name The tab to show.
             * @returns {boolean} false when there is no such tab.
             */
            show: function (id, name) {
                if (!$exeIDevicesEdition.iDevice.tabs.isValidId(id)) return false;
                const $buttons = $(`#${id}-tabs [data-exe-tab]`);
                const target = $buttons.toArray().find((button) => button.getAttribute('data-exe-tab') === name);
                if (!target) return false;
                $buttons.each(function () {
                    const isActive = this === target;
                    $(this)
                        .toggleClass('active', isActive)
                        .attr({ 'aria-selected': String(isActive), tabindex: isActive ? '0' : '-1' });
                    $(document.getElementById(this.getAttribute('aria-controls'))).toggleClass('active show', isActive);
                });
                return true;
            }
        }
    }
}

// Export for Node.js/CommonJS (tests)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = $exeIDevicesEdition;
}
