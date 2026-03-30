/* eslint-disable no-undef */
/**
 * Chemical Structure iDevice (edition code)
 * Allows educators to embed interactive 2D chemical structures
 * in both quiz (test) and presentation (show) modes.
 *
 * Structure data saved as KET (canonical), SVG (display), SMILES and MOL/RXN.
 * Ketcher standalone is used for 2D editing (iframe + postMessage bridge).
 * Export / preview renders only the persisted SVG — Ketcher is NOT loaded.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {

    // ── i18n ────────────────────────────────────────────────────
    i18n: {
        name: _('Chemical Structure'),
        alt:  _('Chemical Structure'),
    },

    // ── State ───────────────────────────────────────────────────
    idevicePath: '',
    msgs: {},
    classIdevice: 'cheme',
    active: 0,
    selectsGame: [],
    typeEdit: -1,
    numberCutQuestion: -1,
    clipBoard: '',
    id: false,
    ci18n: {},
    version: 1.0,

    // Ketcher bridge state
    ketcherReady: false,
    ketcherPendingLoad: null,
    pendingExportPromise: null,
    pendingExportResolver: null,
    pendingExportRejecter: null,
    pendingExportTimeoutId: null,
    exportRequestedWhilePending: false,
    boundMessageHandler: null,
    _dirtyTimer: null,

    // ────────────────────────────────────────────────────────────
    // Lifecycle
    // ────────────────────────────────────────────────────────────

    init: function (element, previousData, path) {
        this.ideviceBody      = element;
        this.idevicePreviousData = previousData;
        this.idevicePath      = path;
        this.refreshTranslations();
        this.setMessagesInfo();
        this.createForm();
    },

    enableForm: function () {
        $exeDevice.initQuestions();
        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
        var currentMode = $('input[name="slcchemactivitymode"]:checked').val() || 'test';
        $exeDevice.toggleActivityMode(currentMode);
        $exeDevice.showQuestion($exeDevice.active);
    },

    // ────────────────────────────────────────────────────────────
    // i18n
    // ────────────────────────────────────────────────────────────

    refreshTranslations: function () {
        this.ci18n = {
            msgSubmit:               c_('Submit'),
            msgClue:                 c_('Cool! The clue is:'),
            msgNewGame:              c_('Click here for a new game'),
            msgCodeAccess:           c_('Access code'),
            msgPlayStart:            c_('Click here to play'),
            msgErrors:               c_('Errors'),
            msgHits:                 c_('Hits'),
            msgScore:                c_('Score'),
            msgMinimize:             c_('Minimize'),
            msgMaximize:             c_('Maximize'),
            msgTime:                 c_('Time per question'),
            msgLive:                 c_('Life'),
            msgFullScreen:           c_('Full Screen'),
            msgNumQuestions:         c_('Number of questions'),
            msgNoStructure:          c_('No chemical structure'),
            msgCool:                 c_('Cool!'),
            msgLoseLive:             c_('You lost one life'),
            msgLostLives:            c_('You lost all your lives!'),
            msgAllQuestions:         c_('You answered all the questions.'),
            msgSuccesses:            c_('Right! | Excellent! | Great! | Very good! | Perfect!'),
            msgFailures:             c_('It was not that! | Incorrect! | Not correct! | Sorry! | Error!'),
            msgYouScore:             c_('Your score'),
            msgTryAgain:             c_('You need at least &percnt;s&percnt; of correct answers to get the information. Please try again.'),
            msgQuestion:             c_('Question'),
            msgAnswer:               c_('Check'),
            msgInformation:          c_('Information'),
            msgAuthor:               c_('Authorship'),
            msgClose:                c_('Close'),
            msgOption:               c_('Option'),
            msgOrders:               c_('Please order the answers'),
            msgIndicateWord:         c_('Provide a word or phrase'),
            msgMoveOne:              c_('Move on'),
            msgPoints:               c_('points'),
            msgCorrect:              c_('Correct'),
            msgIncorrect:            c_('Incorrect'),
            msgPrevious:             c_('Previous'),
            msgNext:                 c_('Next'),
            msgWeight:               c_('Weight'),
            msgScoreScorm:           c_('The score can not be saved because this page is not part of a SCORM package.'),
            msgOnlySaveScore:        c_('You can only save the score once'),
            msgOnlySaveAuto:         c_('Your score will be saved after each question. You can only play once.'),
            msgSeveralScore:         c_('You can save the score as many times as you want'),
            msgYouLastScore:         c_('The last score saved is'),
            msgEndGameScore:         c_('Please start the activity before saving your score.'),
            msgSaveAuto:             c_('Your score will be automatically saved after each question.'),
            msgActityComply:         c_('You have already done this activity.'),
            msgPlaySeveralTimes:     c_('You can do this activity as many times as you want'),
            msgUncompletedActivity:  c_('Incomplete activity'),
            msgSuccessfulActivity:   c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgTypeGame:             c_('Chemical Structure Quiz'),
            msgComposition:          c_('Chemical composition'),
            msgInformationLooking:   c_('Cool! The information you were looking for'),
            msgUpdatePreview:        c_('Update preview'),
            msgClearStructure:       c_('Clear'),
            msgEditorNotReady:       c_('The chemical editor is loading...'),
        };
    },

    setMessagesInfo: function () {
        var msgs = $exeDevice.msgs;
        msgs.msgEOneQuestion        = _('Please provide at least one question');
        msgs.msgTypeChoose          = _('Please select the correct answer for each option');
        msgs.msgECompleteQuestion   = _('Please write the question');
        msgs.msgECompleteAllOptions = _('Please complete all options');
        msgs.msgProvideSolution     = _('Please write the word/phrase');
        msgs.msgEProvideWord        = _('Please provide the word or phrase');
        msgs.msgEDefintion          = _('Please provide the definition of the word or phrase');
        msgs.msgProvideFB           = _('Message to display when passing the game');
        msgs.msgNoSuportBrowser     = _('Your browser is not compatible with this tool.');
        msgs.msgIDLenght            = _('The report identifier must have at least 5 characters');
        msgs.msgESelectStructure    = _('Please draw or load a chemical structure');
        msgs.msgEProvideTimeSolution = _('Please indicate the time to display the solution');
        msgs.msgNotHitQuestion      = _('The question marked as next in case of success does not exist.');
        msgs.msgNotErrorQuestion    = _('The question marked as next in case of error does not exist.');
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    // ────────────────────────────────────────────────────────────
    // Question CRUD
    // ────────────────────────────────────────────────────────────

    getCuestionDefault: function () {
        return {
            ket:              '',
            svg:              '',
            smiles:           '',
            molfile:          '',
            rxn:              '',
            structureType:    'molecule',
            description:      '',
            quextion:         '',
            options:          ['', '', '', ''],
            solution:         '',
            solutionQuestion: '',
            percentageShow:   35,
            typeSelect:       0,
            numberOptions:    4,
            time:             0,
            hit:              0,
            error:            0,
            msgHit:           '',
            msgError:         '',
        };
    },

    initQuestions: function () {
        var defaultQuestion = {
            ket:              '',
            svg:              '',
            smiles:           'CN1C=NC2=C1C(=O)N(C(=O)N2C)C',
            molfile:          '',
            rxn:              '',
            structureType:    'molecule',
            description:      c_('Caffeine is a natural stimulant found in coffee, tea and many soft drinks.'),
            quextion:         c_('What molecule is shown in the structure?'),
            options:          [c_('Caffeine'), c_('Aspirin'), c_('Glucose'), c_('Dopamine')],
            solution:         'A',
            solutionQuestion: '',
            percentageShow:   35,
            typeSelect:       0,
            numberOptions:    4,
            time:             0,
            hit:              0,
            error:            0,
            msgHit:           '',
            msgError:         '',
        };
        if ($exeDevice.selectsGame.length === 0) {
            $exeDevice.selectsGame.push(defaultQuestion);
        }
    },

    addQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.clearQuestion(false);
            $exeDevice.selectsGame.push($exeDevice.getCuestionDefault());
            $exeDevice.active = $exeDevice.selectsGame.length - 1;
            $exeDevice.typeEdit = -1;
            $('#chemPaste').hide();
            $exeDevice.updateQuestionsNumber();
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    removeQuestion: function () {
        if ($exeDevice.selectsGame.length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
            return;
        }
        $exeDevice.selectsGame.splice($exeDevice.active, 1);
        if ($exeDevice.active >= $exeDevice.selectsGame.length) {
            $exeDevice.active = $exeDevice.selectsGame.length - 1;
        }
        $exeDevice.typeEdit = -1;
        $('#chemPaste').hide();
        $('#chemNumQuestions').text($exeDevice.selectsGame.length);
        $exeDevice.updateQuestionsNumber();
        $exeDevice.showQuestion($exeDevice.active);
    },

    copyQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.typeEdit = 0;
            $exeDevice.clipBoard = JSON.parse(JSON.stringify($exeDevice.selectsGame[$exeDevice.active]));
            $('#chemPaste').show();
        }
    },

    cutQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.numberCutQuestion = $exeDevice.active;
            $exeDevice.typeEdit = 1;
            $('#chemPaste').show();
        }
    },

    pasteQuestion: function () {
        if ($exeDevice.typeEdit === 0) {
            $exeDevice.active++;
            var pastedQuestion = JSON.parse(JSON.stringify($exeDevice.clipBoard || $exeDevice.getCuestionDefault()));
            $exeDevice.selectsGame.splice($exeDevice.active, 0, pastedQuestion);
            $exeDevice.showQuestion($exeDevice.active);
        } else if ($exeDevice.typeEdit === 1) {
            $('#chemPaste').hide();
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                $exeDevice.selectsGame,
                $exeDevice.numberCutQuestion,
                $exeDevice.active
            );
            $exeDevice.showQuestion($exeDevice.active);
        }
        $exeDevice.updateQuestionsNumber();
    },

    nextQuestion: function () {
        if ($exeDevice.validateQuestion() && $exeDevice.active < $exeDevice.selectsGame.length - 1) {
            $exeDevice.active++;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    lastQuestion: function () {
        if ($exeDevice.validateQuestion() && $exeDevice.active < $exeDevice.selectsGame.length - 1) {
            $exeDevice.active = $exeDevice.selectsGame.length - 1;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    previousQuestion: function () {
        if ($exeDevice.validateQuestion() && $exeDevice.active > 0) {
            $exeDevice.active--;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    firstQuestion: function () {
        if ($exeDevice.validateQuestion() && $exeDevice.active > 0) {
            $exeDevice.active = 0;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    updateQuestionsNumber: function () {
        var pct = parseInt($exeDevice.removeTags($('#chemPercentajeQuestionsValue').val()), 10);
        if (isNaN(pct)) return;
        pct = Math.max(1, Math.min(pct, 100));
        var total = $exeDevice.selectsGame.length,
            num   = Math.max(1, Math.round((pct * total) / 100));
        $('#chemNumeroPercentaje').text(num + '/' + total);
    },

    // ────────────────────────────────────────────────────────────
    // Show / clear question in form
    // ────────────────────────────────────────────────────────────

    showQuestion: function (i) {
        $exeDevice.clearQuestion(false);
        var total = $exeDevice.selectsGame.length,
            num   = Math.max(0, Math.min(i, total - 1));
        var p     = $exeDevice.selectsGame[num];
        var activityMode = $('input[name="slcchemactivitymode"]:checked').val() || 'test';

        $('#chemNumberQuestion').val(num + 1);
        $('#chemNumQuestions').text(total);

        // Load structure into Ketcher; restore textarea from saved data
        $exeDevice.loadStructureIntoKetcher(p);
        var structureText = p.smiles || p.molfile || p.rxn || '';
        $('#chemCodeInput').val(structureText);

        // Fill text fields
        $('#chemQuestion').val(p.quextion || '');
        $('#chemDescription').val(p.description || '');
        $('#chemSolutionWord').val(p.solutionQuestion || '');
        $('#chemDefinitionWord').val(p.quextion || '');
        $('#chemPercentageShow').val(p.percentageShow || 35);

        // Options
        $('.CHEME-EOptionInput').each(function (j) {
            $(this).val(p.options[j] || '');
        });

        $exeDevice.showOptions(p.numberOptions || 4);
        $exeDevice.checkQuestions(p.solution || 'A');

        var hasCustomMessages = !!(p.msgHit || p.msgError);
        $('#chemHasCustomMessages').prop('checked', hasCustomMessages);
        $('#chemCustomMessages').toggle(hasCustomMessages);
        $('#chemMessageOK').val(p.msgHit || '');
        $('#chemMessageKO').val(p.msgError || '');

        $("input.CHEME-Times[name='slcchemtime'][value='" + (p.time || 0) + "']").prop('checked', true);
        $("input.CHEME-Number[name='slcchemnumber'][value='" + (p.numberOptions || 4) + "']").prop('checked', true);
        $("input.CHEME-TypeSelect[name='slcchemtypeselect'][value='" + (p.typeSelect || 0) + "']").prop('checked', true);
        $exeDevice.showTypeQuestion(p.typeSelect || 0);

        if (activityMode === 'show') {
            $('#chemQuestionDiv').removeClass('d-flex').addClass('d-none');
            $('#chemDescriptionDiv').removeClass('d-none').addClass('d-flex');
        }
    },

    clearQuestion: function (clearEditor) {
        clearTimeout($exeDevice._dirtyTimer);
        $exeDevice._dirtyTimer = null;
        $exeDevice.showOptions(4);
        $exeDevice.checkQuestions('');
        $('.CHEME-Times').first().prop('checked', true);
        $('.CHEME-Number').eq(2).prop('checked', true);
        $('#chemQuestion').val('');
        $('#chemDescription').val('');
        $('#chemSolutionWord').val('');
        $('#chemDefinitionWord').val('');
        $('.CHEME-EOptionInput').each(function () { $(this).val(''); });
        $('#chemHasCustomMessages').prop('checked', false);
        $('#chemCustomMessages').hide();
        $('#chemMessageOK').val('');
        $('#chemMessageKO').val('');
        $('#chemCodeInput').val('');
        if (clearEditor !== false) {
            $exeDevice.postToKetcher('CS_CLEAR');
        }
    },

    showOptions: function (number) {
        $('.CHEME-EOptionDiv').each(function (i) {
            if (i < number) {
                $(this).show();
            } else {
                $(this).hide();
                $($('.CHEME-EOptionInput')[i]).val('');
            }
        });
    },

    checkQuestions: function (solution) {
        $("input.CHEME-ESolution[name='slcchemsolution']").prop('checked', false);
        for (var i = 0; i < solution.length; i++) {
            $("input.CHEME-ESolution[name='slcchemsolution'][value='" + solution[i] + "']").prop('checked', true);
        }
        $('#chemSolutionSelect').text(solution);
    },

    showTypeQuestion: function (type) {
        var t = parseInt(type, 10);
        if (t === 0) {
            // Select
            $('#chemAnswers').show();
            $('#chemWordDiv').hide();
            $('#chemSolitionOptions').removeClass('d-none').addClass('d-flex').show();
            $('#chemInputNumbers').removeClass('d-none').addClass('d-flex');
            $('#chemPercentageSpan').hide();
            $('#chemQuestionDiv').removeClass('d-none').addClass('d-flex');
        } else if (t === 1) {
            // Order
            $('#chemAnswers').show();
            $('#chemWordDiv').hide();
            $('#chemSolitionOptions').removeClass('d-none').addClass('d-flex').show();
            $('#chemInputNumbers').removeClass('d-none').addClass('d-flex');
            $('#chemPercentageSpan').hide();
            $('#chemQuestionDiv').removeClass('d-none').addClass('d-flex');
        } else {
            // Word — only word/phrase + definition fields
            $('#chemAnswers').hide();
            $('#chemWordDiv').show();
            $('#chemSolitionOptions').removeClass('d-flex').addClass('d-none').hide();
            $('#chemInputNumbers').removeClass('d-flex').addClass('d-none');
            $('#chemPercentageSpan').show();
            $('#chemQuestionDiv').removeClass('d-flex').addClass('d-none');
        }
    },

    toggleActivityMode: function (mode) {
        var isShow = mode === 'show';
        var ids = [
            'chemTypeDiv', 'chemInputNumbers', 'chemPercentageSpan',
            'chemTimeDiv',
            'chemShowSolutionDiv', 'chemGlobalTimeDiv',
            'chemAnswersRamdonDiv', 'chemModeBoardDiv'
        ];
        ids.forEach(function (id) {
            var $el = $('#' + id);
            if (isShow) $el.addClass('d-none');
            else        $el.removeClass('d-none');
        });

        var $panel = $('#chemPanel');
        if (isShow) {
            $panel.addClass('CHEME-ShowMode');
            $('#chemAnswers, #chemWordDiv').addClass('d-none');
            $('#chemSolitionOptions').removeClass('d-flex').addClass('d-none');
            $('#chemQuestionDiv').removeClass('d-flex').addClass('d-none');
            $('#chemDescriptionDiv').removeClass('d-none').addClass('d-flex');
        } else {
            $panel.removeClass('CHEME-ShowMode');
            $('#chemAnswers, #chemWordDiv').removeClass('d-none');
            $('#chemSolitionOptions').removeClass('d-none').addClass('d-flex');
            $('#chemDescriptionDiv').removeClass('d-flex').addClass('d-none');
            $('#chemQuestionDiv').removeClass('d-none').addClass('d-flex');
            var currentType = parseInt($('input[name="slcchemtypeselect"]:checked').val(), 10);
            $exeDevice.showTypeQuestion(isNaN(currentType) ? 0 : currentType);
        }
    },

    // ────────────────────────────────────────────────────────────
    // Ketcher bridge
    // ────────────────────────────────────────────────────────────

    postToKetcher: function (type, payload) {
        var iframe = document.getElementById('chemEditorFrame');
        if (!iframe || !iframe.contentWindow) return;
        iframe.contentWindow.postMessage({ type: type, payload: payload || {} }, window.location.origin);
    },

    requestExport: function () {
        var self = $exeDevice;
        if (self.pendingExportPromise) {
            // Coalesce rapid calls into the in-flight export and request one follow-up run.
            self.exportRequestedWhilePending = true;
            return self.pendingExportPromise;
        }

        self.pendingExportPromise = new Promise(function (resolve, reject) {
            self.pendingExportResolver = resolve;
            self.pendingExportRejecter = reject;

            if (self.pendingExportTimeoutId) {
                clearTimeout(self.pendingExportTimeoutId);
            }
            self.pendingExportTimeoutId = setTimeout(function () {
                var timeoutRejecter = self.pendingExportRejecter;
                self.pendingExportResolver = null;
                self.pendingExportRejecter = null;
                self.pendingExportPromise = null;
                self.pendingExportTimeoutId = null;
                self.exportRequestedWhilePending = false;
                if (timeoutRejecter) {
                    timeoutRejecter(new Error('Export timeout'));
                }
            }, 8000);

            self.postToKetcher('CS_REQUEST_EXPORT');
        });

        return self.pendingExportPromise;
    },

    handleKetcherMessage: function (event) {
        var data = event.data || {};
        var type    = data.type;
        var payload = data.payload || {};

        if (type === 'CS_READY') {
            $exeDevice.ketcherReady = true;
            $('#chemEditorStatus').text('');
            if ($exeDevice.ketcherPendingLoad) {
                $exeDevice.postToKetcher('CS_LOAD_STRUCTURE', $exeDevice.ketcherPendingLoad);
                $exeDevice.ketcherPendingLoad = null;
            }
            return;
        }

        if (type === 'CS_DIRTY') {
            // Auto-export after drawing — debounced so rapid strokes don't flood
            clearTimeout($exeDevice._dirtyTimer);
            var fromTextarea = !!$exeDevice._loadingFromTextarea;
            var fromClear    = !!$exeDevice._clearingStructure;
            $exeDevice._loadingFromTextarea = false;
            $exeDevice._clearingStructure   = false;
            $exeDevice._dirtyTimer = setTimeout(function () {
                // When the user explicitly cleared the editor the structure is already
                // reset to empty — skip the export so the textarea isn't overwritten
                // with the empty MOL V3000 stub that Ketcher emits for blank canvases.
                if (fromClear) return;
                $exeDevice.requestExport().then(function (exported) {
                    if (!exported.isEmpty) $exeDevice.applyExportToCurrentQuestion(exported);
                    if (fromTextarea) $('#chemEditorStatus').text('');
                }).catch(function () {
                    if (fromTextarea) $('#chemEditorStatus').text('');
                });
            }, 600);
            return;
        }

        if (type === 'CS_EXPORT_RESULT') {
            if ($exeDevice.pendingExportTimeoutId) {
                clearTimeout($exeDevice.pendingExportTimeoutId);
                $exeDevice.pendingExportTimeoutId = null;
            }
            if ($exeDevice.pendingExportResolver) {
                $exeDevice.pendingExportResolver(payload);
                $exeDevice.pendingExportResolver = null;
                $exeDevice.pendingExportRejecter = null;
            }
            $exeDevice.pendingExportPromise = null;

            if ($exeDevice.exportRequestedWhilePending) {
                $exeDevice.exportRequestedWhilePending = false;
                $exeDevice.requestExport().then(function (exported) {
                    if (!exported.isEmpty) $exeDevice.applyExportToCurrentQuestion(exported);
                }).catch(function () {});
            }
            return;
        }

        if (type === 'CS_ERROR') {
            var message = (payload && payload.message) || 'Chemical editor error';
            if ($exeDevice.pendingExportTimeoutId) {
                clearTimeout($exeDevice.pendingExportTimeoutId);
                $exeDevice.pendingExportTimeoutId = null;
            }
            if ($exeDevice.pendingExportRejecter) {
                $exeDevice.pendingExportRejecter(new Error(message));
                $exeDevice.pendingExportResolver = null;
                $exeDevice.pendingExportRejecter = null;
            }
            $exeDevice.pendingExportPromise = null;
            $exeDevice.exportRequestedWhilePending = false;
        }
    },

    loadStructureIntoKetcher: function (question) {
        var payload = {
            ket:     question.ket    || '',
            smiles:  question.smiles || '',
            molfile: question.molfile || '',
            rxn:     question.rxn    || '',
        };
        if ($exeDevice.ketcherReady) {
            $exeDevice.postToKetcher('CS_LOAD_STRUCTURE', payload);
        } else {
            $exeDevice.ketcherPendingLoad = payload;
        }
    },

    // Sync current state → question data, then run action
    syncThenDo: function (action) {
        var self = $exeDevice;
        clearTimeout(self._dirtyTimer);
        self._dirtyTimer = null;
        var $status = $('#chemEditorStatus');
        $status.text(_('Saving…'));
        self.requestExport().then(function (exported) {
            if (!exported.isEmpty) self.applyExportToCurrentQuestion(exported);
            $status.text('');
            action();
        }).catch(function () {
            $status.text('');
            action();
        });
    },

    applyExportToCurrentQuestion: function (exported) {
        var q = $exeDevice.selectsGame[$exeDevice.active];
        if (!q) return;
        q.ket           = exported.ket           || '';
        q.svg           = exported.svg           || '';
        q.smiles        = exported.smiles        || '';
        q.molfile       = exported.molfile       || '';
        q.rxn           = exported.rxn           || '';
        q.structureType = exported.structureType || 'molecule';
        // Keep textarea in sync with the current structure
        $('#chemCodeInput').val(q.smiles || q.molfile || q.rxn || '');
    },

    showPreviewModal: function (svg) {
        var safe = $exeDevice.sanitizeSvg(svg || '');
        $('#chemPreviewModalSvg').html(safe || '<p>' + _('No chemical structure') + '</p>');
        $exeDevice._previewModalFocusOrigin = document.activeElement || null;
        $('#chemPreviewModal').show();
        var $closeBtn = $('#chemPreviewModalClose');
        $closeBtn.focus();
        // Trap focus inside the modal and close on Escape.
        // The only focusable element is the close button, so Tab simply stays there.
        $('#chemPreviewModal').on('keydown.chemPreviewTrap', function (e) {
            var key = e.key || '';
            var code = e.keyCode || e.which;
            if (key === 'Escape' || code === 27) {
                $exeDevice.hidePreviewModal();
            } else if (key === 'Tab' || code === 9) {
                e.preventDefault();
                $closeBtn.focus();
            }
        });
    },

    hidePreviewModal: function () {
        $('#chemPreviewModal').off('keydown.chemPreviewTrap').hide();
        if ($exeDevice._previewModalFocusOrigin) {
            $exeDevice._previewModalFocusOrigin.focus();
            $exeDevice._previewModalFocusOrigin = null;
        }
    },

    // Load SMILES / MOL text from textarea into Ketcher, then export and persist.
    // Waits for Ketcher's CS_DIRTY signal (the editor finished rendering) before exporting.
    loadStructureFromTextarea: function () {
        var text = ($('#chemCodeInput').val() || '').trim();
        if (!text) return;
        var self = $exeDevice;
        var $status = $('#chemEditorStatus');
        self.loadStructureIntoKetcher({ smiles: text });
        $status.text(_('Loading…'));
        // Ketcher fires CS_DIRTY once it finishes rendering the loaded structure.
        // The CS_DIRTY handler already debounces at 600ms and calls requestExport.
        // We just set a flag so that handler exports AND clears the status text.
        self._loadingFromTextarea = true;
    },

    clearStructureTextarea: function () {
        $('#chemCodeInput').val('');
        $exeDevice._clearingStructure = true;
        $exeDevice.postToKetcher('CS_CLEAR');
        var q = $exeDevice.selectsGame[$exeDevice.active];
        if (q) {
            q.ket = '';
            q.svg = '';
            q.smiles = '';
            q.molfile = '';
            q.rxn = '';
        }
    },

    updatePreview: function () {
        var $status = $('#chemEditorStatus');
        $status.text(_('Exporting…'));
        $exeDevice.requestExport().then(function (exported) {
            if (exported.isEmpty) {
                $status.text(_('No structure'));
                setTimeout(function () { $status.text(''); }, 2000);
                return;
            }
            $exeDevice.applyExportToCurrentQuestion(exported);
            $status.text('');
            if (exported.svg) {
                $exeDevice.showPreviewModal(exported.svg);
            } else {
                $status.text(_('Structure saved (SVG unavailable)'));
                setTimeout(function () { $status.text(''); }, 2500);
            }
        }).catch(function (err) {
            $status.text(_('Export error'));
            console.warn('Preview update failed:', err);
            setTimeout(function () { $status.text(''); }, 3000);
        });
    },

    sanitizeSvg: function (svg) {
        if (!svg || typeof svg !== 'string') return '';
        // Remove script elements
        svg = svg.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
        // Remove foreignObject elements (can inject arbitrary HTML)
        svg = svg.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
        // Remove inline event handlers (on*)
        svg = svg.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');
        // Remove javascript: URIs
        svg = svg.replace(/javascript:/gi, '');
        // Replace data:text/html URIs in href and xlink:href
        svg = svg.replace(/(href\s*=\s*")data:text\/html[^"]*"/gi, '$1#"');
        svg = svg.replace(/(href\s*=\s*')data:text\/html[^']*'/gi, "$1#'");
        svg = svg.replace(/(xlink:href\s*=\s*")data:text\/html[^"]*"/gi, '$1#"');
        svg = svg.replace(/(xlink:href\s*=\s*')data:text\/html[^']*'/gi, "$1#'");
        return svg;
    },

    // ────────────────────────────────────────────────────────────
    // Form building
    // ────────────────────────────────────────────────────────────

    createForm: function () {
        var path = $exeDevice.idevicePath;
        var html = `<div id="chemIdeviceForm">
<p class="exe-block-info exe-block-dismissible" style="position:relative">
    ${_('Create activities based on 2D chemical structures. Draw molecules or reactions and add questions or descriptions.')}
    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>\xD7</a>
</p>

<!-- Tab 1: General settings -->
<div class="exe-form-tab" title="${_('General settings')}">
    ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Observe the chemical structure and answer the questions.'))}
    <fieldset class="exe-fieldset exe-fieldset-closed">
        <legend><a href="#">${_('Options')}</a></legend>
        <div id="chemOptions">

            <!-- Mode -->
            <div class="d-flex align-items-center gap-3 mb-3" id="chemActivityMode">
                <span>${_('Mode')}:</span>
                <div class="form-check form-check-inline m-0">
                    <input class="form-check-input" type="radio" name="slcchemactivitymode" id="chemModeTest" value="test" checked />
                    <label class="form-check-label" for="chemModeTest">${_('Test')}</label>
                </div>
                <div class="form-check form-check-inline m-0">
                    <input class="form-check-input" type="radio" name="slcchemactivitymode" id="chemModeShow" value="show" />
                    <label class="form-check-label" for="chemModeShow">${_('Presentation')}</label>
                </div>
            </div>

            <!-- Show minimized -->
            <div class="toggle-item mb-3" data-target="chemShowMinimize">
                <span class="toggle-control"><input type="checkbox" class="toggle-input" id="chemShowMinimize" /><span class="toggle-visual"></span></span>
                <label class="toggle-label" for="chemShowMinimize">${_('Show minimized.')}</label>
            </div>

            <!-- Answers random -->
            <div class="toggle-item mb-3" data-target="chemAnswersRamdon" id="chemAnswersRamdonDiv">
                <span class="toggle-control"><input type="checkbox" class="toggle-input" id="chemAnswersRamdon" /><span class="toggle-visual"></span></span>
                <label class="toggle-label" for="chemAnswersRamdon">${_('Random options')}</label>
            </div>

            <!-- Questions random -->
            <div class="toggle-item mb-3" data-target="chemQuestionsRandom">
                <span class="toggle-control"><input type="checkbox" class="toggle-input" id="chemQuestionsRandom" /><span class="toggle-visual"></span></span>
                <label class="toggle-label" for="chemQuestionsRandom">${_('Random questions')}</label>
            </div>

            <!-- Show solutions -->
            <div class="d-flex align-items-center flex-wrap gap-2 mb-3" id="chemShowSolutionDiv">
                <div class="toggle-item toggle-related" data-target="chemShowSolution">
                    <span class="toggle-control"><input type="checkbox" class="toggle-input" id="chemShowSolution" checked /><span class="toggle-visual"></span></span>
                    <label class="toggle-label" for="chemShowSolution">${_('Show solutions')}.</label>
                </div>
                <div class="mb-0 d-flex align-items-center gap-2">
                    <input type="number" name="chemTimeShowSolution" id="chemTimeShowSolution" value="3" min="1" max="9" class="form-control" />
                    <label for="chemTimeShowSolution">${_('Show solution time (seconds)')}</label>
                </div>
            </div>

            <!-- Feedback -->
            <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                <div class="toggle-item toggle-related" data-target="chemHasFeedBack">
                    <span class="toggle-control"><input type="checkbox" class="toggle-input" id="chemHasFeedBack" /><span class="toggle-visual"></span></span>
                    <label class="toggle-label" for="chemHasFeedBack">${_('Feedback')}.</label>
                </div>
                <div class="mb-0 d-flex align-items-center gap-2">
                    <input type="number" name="chemPercentajeFB" id="chemPercentajeFB" value="100" min="5" max="100" step="5" disabled class="form-control" />
                    <label for="chemPercentajeFB">${_('&percnt; right to see the feedback')}</label>
                </div>
            </div>
            <div id="chemFeedbackP" class="CHEME-EFeedbackP mb-3">
                <textarea id="chemFeedBackEditor" class="exe-html-editor form-control" rows="4"></textarea>
            </div>

            <!-- % Questions -->
            <div class="d-flex align-items-center flex-wrap mb-3 gap-2" id="chemInputPercentajeQuestions">
                <label for="chemPercentajeQuestionsValue">%${_('Questions')}:</label>
                <input type="number" name="chemPercentajeQuestionsValue" id="chemPercentajeQuestionsValue" value="100" min="1" max="100" class="form-control" />
                <span id="chemNumeroPercentaje" class="ms-2">1/1</span>
            </div>

            <!-- Whiteboard mode -->
            <div class="toggle-item mb-3" data-target="chemModeBoard" id="chemModeBoardDiv">
                <span class="toggle-control"><input type="checkbox" class="toggle-input" id="chemModeBoard" /><span class="toggle-visual"></span></span>
                <label class="toggle-label" for="chemModeBoard">${_('Digital whiteboard mode')}</label>
            </div>

            <!-- Global time -->
            <div class="d-flex align-items-center gap-2 mb-3" id="chemGlobalTimeDiv">
                <label for="chemGlobalTimes">${_('Time per question')}:</label>
                <select id="chemGlobalTimes" class="form-select form-select-sm" style="max-width:10ch">
                    <option value="0" selected>15s</option>
                    <option value="1">30s</option>
                    <option value="2">1m</option>
                    <option value="3">3m</option>
                    <option value="4">5m</option>
                    <option value="5">10m</option>
                </select>
                <button id="chemGlobalTimeButton" class="btn btn-primary" type="button">${_('Accept')}</button>
            </div>

            <!-- Custom messages per question (hidden by default) -->
            <div class="toggle-item mb-3" data-target="chemCustomMessages">
                <span class="toggle-control"><input type="checkbox" class="toggle-input" id="chemHasCustomMessages" /><span class="toggle-visual"></span></span>
                <label class="toggle-label" for="chemHasCustomMessages">${_('Custom messages')}</label>
            </div>

            <!-- Progress report -->
            <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                <div class="toggle-item" data-target="chemEvaluation">
                    <span class="toggle-control"><input type="checkbox" id="chemEvaluation" class="toggle-input" aria-label="${_('Progress report')}"><span class="toggle-visual"></span></span>
                    <label class="toggle-label" for="chemEvaluation">${_('Progress report')}.</label>
                </div>
                <div class="d-flex align-items-center flex-nowrap gap-2 ms-2 CHEME-EEvaluationFields">
                    <label for="chemEvaluationID" class="mb-0">${_('Identifier')}:</label>
                    <input type="text" class="form-control" id="chemEvaluationID" disabled value="${eXeLearning.app.project.odeId || ''}" />
                    <a href="#chemEvaluationHelp" id="chemEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                        <img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}"/>
                    </a>
                </div>
            </div>
            <p id="chemEvaluationHelp" class="CHEME-EEvaluationHelp exe-block-info">
                ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
            </p>
            

        </div><!-- /chemOptions -->
    </fieldset>

    <!-- Questions fieldset -->
    <fieldset class="exe-fieldset">
        <legend><a href="#">${_('Questions')}</a></legend>
        <div class="CHEME-EPanel" id="chemPanel">

            <!-- Two-column layout -->
            <div class="CHEME-EColumns mb-3">

                <!-- Left: Ketcher iframe + toolbar -->
                <div class="CHEME-EEditorColumn">
                    <div class="CHEME-EIframeWrap mb-2">
                        <iframe id="chemEditorFrame" class="CHEME-EIframe" src="${path}chemical-structure-editor.html"
                            title="${_('Chemical structure editor')}" allowfullscreen></iframe>
                    </div>
                    <div class="CHEME-EToolbar">
                        <button type="button" id="chemBtnUpdatePreview" class="CHEME-EToolbarBtn btn btn-primary">${_('Preview')}</button>
                        <span id="chemEditorStatus" class="CHEME-EStatus"></span>
                    </div>
                </div><!-- /EEditorColumn -->

                <!-- Preview modal (hidden) -->
                <div id="chemPreviewModal" class="CHEME-EPreviewModal" style="display:none" role="dialog" aria-modal="true">
                    <div class="CHEME-EPreviewModalInner">
                        <button type="button" id="chemPreviewModalClose" class="CHEME-EPreviewModalClose" aria-label="${_('Close')}">\u00D7</button>
                        <div id="chemPreviewModalSvg" class="CHEME-EPreviewModalSvg"></div>
                    </div>
                </div>

                <!-- Right: Options -->
                <div class="CHEME-EOptionsColumn">

                    <!-- SMILES / MOL quick-loader -->
                    <span class="mb-0">${_('Load from file (.mol, .sdf, .rxn, .smi)')}: </span>
                    <div class="d-flex flex-nowrap align-items-center gap-2 mb-3">
                        <input type="text" class="exe-file-picker form-control me-0" id="chemLoadMol" data-accept="chemical"/>
                    </div>
                    <div class="CHEME-ECodeInjector mb-3">
                        <label for="chemCodeInput" class="form-label">SMILES / MOL</label>
                        <textarea id="chemCodeInput" class="form-control CHEME-ECodeTextarea" rows="6"
                            placeholder="${_('Paste SMILES or MOL code to load into the editor\u2026')}"
                            data-default="CN1C=NC2=C1C(=O)N(C(=O)N2C)C">CN1C=NC2=C1C(=O)N(C(=O)N2C)C</textarea>
                        <div class="d-flex gap-2 mt-3">
                            <button type="button" id="chemBtnLoad" class="btn btn-sm btn-primary flex-grow-1">${_('Show')}</button>
                            <button type="button" id="chemBtnClearCode" class="btn btn-sm btn-secondary">${_('Clear')}</button>
                        </div>
                    </div>                    
                    <!-- Type selector (test only) -->
                    <div class="d-flex flex-wrap align-items-center gap-2 mb-3" id="chemTypeDiv">
                        <span>${_('Type')}:</span>
                        <div class="form-check form-check-inline m-0"><input class="CHEME-TypeSelect form-check-input" checked id="chemTypeChoose" type="radio" name="slcchemtypeselect" value="0"/><label class="form-check-label" for="chemTypeChoose">${_('Select')}</label></div>
                        <div class="form-check form-check-inline m-0"><input class="CHEME-TypeSelect form-check-input" id="chemTypeOrders" type="radio" name="slcchemtypeselect" value="1"/><label class="form-check-label" for="chemTypeOrders">${_('Order')}</label></div>
                        <div class="form-check form-check-inline m-0"><input class="CHEME-TypeSelect form-check-input" id="chemTypeWord" type="radio" name="slcchemtypeselect" value="2"/><label class="form-check-label" for="chemTypeWord">${_('Word')}</label></div>
                    </div>

                    <!-- Options count -->
                    <div class="d-flex flex-wrap align-items-center gap-2 mb-3" id="chemInputNumbers">
                        <span>${_('Options Number')}:</span>
                        <div class="form-check form-check-inline m-0"><input class="CHEME-Number form-check-input" id="chemNumQ2" type="radio" name="slcchemnumber" value="2" /><label class="form-check-label" for="chemNumQ2">2</label></div>
                        <div class="form-check form-check-inline m-0"><input class="CHEME-Number form-check-input" id="chemNumQ3" type="radio" name="slcchemnumber" value="3" /><label class="form-check-label" for="chemNumQ3">3</label></div>
                        <div class="form-check form-check-inline m-0"><input class="CHEME-Number form-check-input" id="chemNumQ4" type="radio" name="slcchemnumber" value="4" checked /><label class="form-check-label" for="chemNumQ4">4</label></div>
                    </div>

                    <!-- Word percentage -->
                    <div id="chemPercentageSpan" class="d-none flex-wrap align-items-center gap-2 mb-3">
                        <span>${_('Percentage of letters to show (%)')}:</span>
                        <input type="number" class="form-control form-control-sm" name="chemPercentageShow" id="chemPercentageShow" value="35" min="0" max="100" step="5" />
                    </div>

                    <!-- Time per question -->
                    <div class="d-flex flex-wrap align-items-center gap-2 mb-3" id="chemTimeDiv">
                        <span>${_('Time per question')}:</span>
                        <div class="form-check form-check-inline m-0"><input class="CHEME-Times form-check-input" checked id="cq15s" type="radio" name="slcchemtime" value="0" /><label class="form-check-label" for="cq15s">15s</label></div>
                        <div class="form-check form-check-inline m-0"><input class="CHEME-Times form-check-input" id="cq30s" type="radio" name="slcchemtime" value="1" /><label class="form-check-label" for="cq30s">30s</label></div>
                        <div class="form-check form-check-inline m-0"><input class="CHEME-Times form-check-input" id="cq1m" type="radio" name="slcchemtime" value="2" /><label class="form-check-label" for="cq1m">1m</label></div>
                        <div class="form-check form-check-inline m-0"><input class="CHEME-Times form-check-input" id="cq3m" type="radio" name="slcchemtime" value="3" /><label class="form-check-label" for="cq3m">3m</label></div>
                        <div class="form-check form-check-inline m-0"><input class="CHEME-Times form-check-input" id="cq5m" type="radio" name="slcchemtime" value="4" /><label class="form-check-label" for="cq5m">5m</label></div>
                        <div class="form-check form-check-inline m-0"><input class="CHEME-Times form-check-input" id="cq10m" type="radio" name="slcchemtime" value="5" /><label class="form-check-label" for="cq10m">10m</label></div>
                    </div>

                </div><!-- /EOptionsColumn -->
            </div><!-- /EColumns -->

            <!-- Question + answers + messages -->
            <div class="CHEME-EContents" id="chemContents">

                <!-- Solution display -->
                <div id="chemSolitionOptions" class="CHEME-SolitionOptionsDiv d-flex justify-content-between">
                    <span>${_('Question')}:</span>
                    <span><span>${_('Solution')}: </span><span id="chemSolutionSelect">A</span></span>
                </div>

                <!-- Question (test) -->
                <div class="CHEME-EQuestionDiv d-flex mb-3" id="chemQuestionDiv">
                    <label class="sr-av" for="chemQuestion">${_('Question')}:</label>
                    <input type="text" id="chemQuestion" class="CHEME-EQuestion form-control me-0" />
                </div>

                <!-- Description (show) -->
                <div class="CHEME-EQuestionDiv d-none align-items-center gap-2 mb-3" id="chemDescriptionDiv">
                    <label for="chemDescription" class="mb-0">${_('Description')}:</label>
                    <input type="text" id="chemDescription" class="CHEME-EQuestion form-control me-0" />
                </div>

                <!-- Answers grid -->
                <div class="CHEME-EAnswers" id="chemAnswers">
                    ${$exeDevice.createAnswerOptions()}
                </div>

                <!-- Custom messages -->

                <div id="chemCustomMessages" style="display:none">
                        <div class="d-flex align-items-center gap-2 mb-2">
                            <label for="chemMessageOK" class="form-label mb-0">${_('Correct')}:</label>
                            <input type="text" id="chemMessageOK" class="form-control" />
                        </div>
                        <div class="d-flex align-items-center gap-2 mb-2">
                            <label for="chemMessageKO" class="form-label mb-0">${_('Incorrect')}:</label>
                            <input type="text" id="chemMessageKO" class="form-control" />
                        </div>
                    </div>

                <!-- Word type fields -->
                <div class="CHEME-EWordDiv CHEME-DP" id="chemWordDiv" style="display:none">
                    <div class="CHEME-ESolutionWord">
                        <label for="chemSolutionWord">${_('Word / phrase')}:</label>
                        <input type="text" id="chemSolutionWord" class="form-control" />
                    </div>
                    <div class="CHEME-ESolutionWord">
                        <label for="chemDefinitionWord">${_('Definition')}:</label>
                        <input type="text" id="chemDefinitionWord" class="form-control" />
                    </div>
                </div>

            </div><!-- /CHEME-EContents -->

            <!-- Navigation buttons -->
            <div class="CHEME-ENavigationButtons gap-2">
                <a href="#" role="button" id="chemAdd"    class="CHEME-ENavigationButton" title="${_('Add')}"><img src="${path}quextIEAdd.png"    alt="${_('Add')}"      class="CHEME-ENavigationButton" /></a>
                <a href="#" role="button" id="chemFirst"  class="CHEME-ENavigationButton" title="${_('First')}"><img src="${path}quextIEFirst.png"  alt="${_('First')}"    class="CHEME-ENavigationButton" /></a>
                <a href="#" role="button" id="chemPrev"   class="CHEME-ENavigationButton" title="${_('Previous')}"><img src="${path}quextIEPrev.png"   alt="${_('Previous')}" class="CHEME-ENavigationButton" /></a>
                <label class="sr-av" for="chemNumberQuestion">${_('Question number')}:</label>
                <input type="text" id="chemNumberQuestion" class="CHEME-ENumQuestions form-control" value="1" />
                <a href="#" role="button" id="chemNext"   class="CHEME-ENavigationButton" title="${_('Next')}"><img src="${path}quextIENext.png"   alt="${_('Next')}"     class="CHEME-ENavigationButton" /></a>
                <a href="#" role="button" id="chemLast"   class="CHEME-ENavigationButton" title="${_('Last')}"><img src="${path}quextIELast.png"   alt="${_('Last')}"     class="CHEME-ENavigationButton" /></a>
                <a href="#" role="button" id="chemDelete" class="CHEME-ENavigationButton" title="${_('Delete')}"><img src="${path}quextIEDelete.png" alt="${_('Delete')}"   class="CHEME-ENavigationButton" /></a>
                <a href="#" role="button" id="chemCopy"   class="CHEME-ENavigationButton" title="${_('Copy')}"><img src="${path}quextIECopy.png"   alt="${_('Copy')}"     class="CHEME-ENavigationButton" /></a>
                <a href="#" role="button" id="chemCut"    class="CHEME-ENavigationButton" title="${_('Cut')}"><img src="${path}quextIECut.png"    alt="${_('Cut')}"      class="CHEME-ENavigationButton" /></a>
                <a href="#" role="button" id="chemPaste"  class="CHEME-ENavigationButton" title="${_('Paste')}" style="display:none"><img src="${path}quextIEPaste.png"  alt="${_('Paste')}"    class="CHEME-ENavigationButton" /></a>
            </div>
            <div class="CHEME-ENumQuestionDiv" id="chemNumQuestionDiv">
                <div class="CHEME-ENumQ"><span class="sr-av">${_('Number of questions')}:</span></div>
                <span class="CHEME-ENumQuestions" id="chemNumQuestions">1</span>
            </div>

        </div><!-- /chemPanel -->
    </fieldset>
</div><!-- /Tab 1 -->

<!-- Tab 2: Itinerary -->
${$exeDevicesEdition.iDevice.gamification.itinerary.getTab()}

<!-- Tab 3: SCORM -->
${$exeDevicesEdition.iDevice.gamification.scorm.getTab()}

<!-- Tab 4: Language -->
${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab($exeDevice.ci18n)}

<!-- Tab 5: Text after -->
${$exeDevicesEdition.iDevice.common.getTextFieldset('after')}

</div>`; // chemIdeviceForm

        $(this.ideviceBody).html(html);
        $exeDevicesEdition.iDevice.tabs.init('chemIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();

        // Register window message handler for Ketcher bridge
        if ($exeDevice.boundMessageHandler) {
            window.removeEventListener('message', $exeDevice.boundMessageHandler);
        }
        $exeDevice.boundMessageHandler = function (event) {
            $exeDevice.handleKetcherMessage(event);
        };
        window.addEventListener('message', $exeDevice.boundMessageHandler);

        // Show loading status until Ketcher reports ready
        $('#chemEditorStatus').text($exeDevice.ci18n.msgEditorNotReady);

        $exeDevice.enableForm();
    },

    createAnswerOptions: function () {
        var letters = ['A', 'B', 'C', 'D'];
        return letters.map(function (letter) {
            return '<div class="CHEME-EOptionDiv gap-2">'
                + '<label class="sr-av" for="chemSol' + letter + '">' + _('Solution') + ' ' + letter + ':</label>'
                + '<input type="checkbox" class="CHEME-ESolution form-check-input me-0" name="slcchemsolution" value="' + letter + '" id="chemSol' + letter + '" />'
                + '<label for="chemOption' + letter + '">' + letter + '</label>'
                + '<input type="text" class="CHEME-EOptionInput form-control" id="chemOption' + letter + '" />'
                + '</div>';
        }).join('');
    },

    // ────────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────────

    addEvents: function () {
        // Dismissible info
        $('.exe-block-dismissible .exe-block-close').on('click', function (e) {
            e.preventDefault();
            $(this).closest('.exe-block-info').remove();
        });

        // Mode toggle
        $('input[name="slcchemactivitymode"]').on('change', function () {
            $exeDevice.toggleActivityMode($(this).val());
        });

        // Question navigation — all sync Ketcher before acting
        $('#chemAdd').on('click',    function (e) { e.preventDefault(); $exeDevice.syncThenDo(function () { $exeDevice.addQuestion(); }); });
        $('#chemDelete').on('click', function (e) { e.preventDefault(); $exeDevice.syncThenDo(function () { $exeDevice.removeQuestion(); }); });
        $('#chemCopy').on('click',   function (e) { e.preventDefault(); $exeDevice.syncThenDo(function () { $exeDevice.copyQuestion(); }); });
        $('#chemCut').on('click',    function (e) { e.preventDefault(); $exeDevice.syncThenDo(function () { $exeDevice.cutQuestion(); }); });
        $('#chemPaste').on('click',  function (e) { e.preventDefault(); $exeDevice.syncThenDo(function () { $exeDevice.pasteQuestion(); }); });
        $('#chemFirst').on('click',  function (e) { e.preventDefault(); $exeDevice.syncThenDo(function () { $exeDevice.firstQuestion(); }); });
        $('#chemPrev').on('click',   function (e) { e.preventDefault(); $exeDevice.syncThenDo(function () { $exeDevice.previousQuestion(); }); });
        $('#chemNext').on('click',   function (e) { e.preventDefault(); $exeDevice.syncThenDo(function () { $exeDevice.nextQuestion(); }); });
        $('#chemLast').on('click',   function (e) { e.preventDefault(); $exeDevice.syncThenDo(function () { $exeDevice.lastQuestion(); }); });

        // Go to numbered question
        $('#chemNumberQuestion').on('change', function () {
            var n = parseInt($(this).val(), 10) - 1;
            if (isNaN(n)) return;
            n = Math.max(0, Math.min(n, $exeDevice.selectsGame.length - 1));
            $exeDevice.syncThenDo(function () {
                if ($exeDevice.validateQuestion()) {
                    $exeDevice.active = n;
                    $exeDevice.showQuestion($exeDevice.active);
                }
            });
        });

        // Ketcher toolbar
        $('#chemBtnUpdatePreview').on('click', function () {
            $exeDevice.updatePreview();
        });

        // Load SMILES/MOL from textarea into Ketcher
        $('#chemBtnLoad').on('click', function () {
            $exeDevice.loadStructureFromTextarea();
        });

        $('#chemBtnClearCode').on('click', function () {
            $exeDevice.clearStructureTextarea();
        });

        // File manager picker — read .mol/.sdf/.rxn/.smi content from blobUrl
        $('#chemLoadMol').on('change', function () {
            var blobUrl = $(this).data('blobUrl');
            if (!blobUrl) return;
            fetch(blobUrl)
                .then(function (r) { return r.text(); })
                .then(function (text) {
                    text = (text || '').trim();
                    if (text) {
                        $('#chemCodeInput').val(text);
                        $exeDevice.loadStructureFromTextarea();
                    }
                })
                .catch(function (err) {
                    console.warn('Failed to read chemical file:', err);
                });
        });

        // Preview modal close
        $('#chemPreviewModalClose').on('click', function () {
            $exeDevice.hidePreviewModal();
        });
        $('#chemPreviewModal').on('click', function (e) {
            if (e.target === this) $exeDevice.hidePreviewModal();
        });

        // Question type toggle
        $('input.CHEME-TypeSelect[name="slcchemtypeselect"]').on('change', function () {
            $exeDevice.showTypeQuestion(parseInt($(this).val(), 10));
        });

        // Solution radio buttons
        $('input.CHEME-ESolution[name="slcchemsolution"]').on('change', function () {
            var solutions = [];
            $('input.CHEME-ESolution[name="slcchemsolution"]:checked').each(function () {
                solutions.push($(this).val());
            });
            $('#chemSolutionSelect').text(solutions.join(''));
        });

        // Custom messages toggle
        $('#chemHasCustomMessages').on('change', function () {
            $('#chemCustomMessages').toggle($(this).is(':checked'));
        });

        // Feedback toggle
        $('#chemHasFeedBack').on('change', function () {
            var checked = $(this).is(':checked');
            $('#chemFeedbackP').toggle(checked);
            $('#chemPercentajeFB').prop('disabled', !checked);
        });

        // Show solutions toggle
        $('#chemShowSolution').on('change', function () {
            $('#chemTimeShowSolution').prop('disabled', !$(this).is(':checked'));
        });

        // Global time button
        $('#chemGlobalTimeButton').on('click', function () {
            var val = $('#chemGlobalTimes').val();
            $('input.CHEME-Times[value="' + val + '"]').prop('checked', true);
        });

        // Options count
        $('input.CHEME-Number[name="slcchemnumber"]').on('change', function () {
            $exeDevice.showOptions(parseInt($(this).val(), 10));
        });

        // Evaluation toggle
        $('#chemEvaluation').on('change', function () {
            $('#chemEvaluationID').prop('disabled', !$(this).is(':checked'));
        });

        $('#chemEvaluationHelpLnk').on('click', function (e) {
            e.preventDefault();
            $('#chemEvaluationHelp').toggle();
        });

        // % Questions
        $('#chemPercentajeQuestionsValue').on('input change', function () {
            $exeDevice.updateQuestionsNumber();
        });

        // Intercept save button: export Ketcher state before the synchronous save
        var $saveBtn = $('#exe-submitButton');
        if ($saveBtn.length) {
            var _origSaveOnclick = $saveBtn[0].onclick;
            $saveBtn[0].onclick = function () {
                var btn = this;
                $exeDevice.syncThenDo(function () {
                    if (_origSaveOnclick) _origSaveOnclick.call(btn);
                });
            };
        }

        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();
        $exeDevicesEdition.iDevice.gamification.share.addEvents(2);
    },

    // ────────────────────────────────────────────────────────────
    // Load previous data
    // ────────────────────────────────────────────────────────────

    loadPreviousValues: function () {
        var originalHTML = this.idevicePreviousData;
        if (!originalHTML || !Object.keys(originalHTML).length) return;

        $exeDevice.active = 0;
        var wrapper  = $('<div></div>').html(originalHTML);
        var json     = $exeDevices.iDevice.gamification.helpers.decrypt($('.cheme-DataGame', wrapper).text());
        var dataGame = $exeDevices.iDevice.gamification.helpers.isJsonString(json);

        if (!dataGame) return;

        $exeDevice.updateFieldGame(dataGame);

        if (dataGame.instructionsExe || dataGame.instructions) {
            $exeDevice.setEditorContent('eXeGameInstructions', unescape(dataGame.instructionsExe || dataGame.instructions));
        }
        if (dataGame.textAfter) {
            $exeDevice.setEditorContent('eXeIdeviceTextAfter', unescape(dataGame.textAfter));
        }
        if (dataGame.textFeedBack) {
            $exeDevice.setEditorContent('chemFeedBackEditor', unescape(dataGame.textFeedBack));
        }
    },

    updateFieldGame: function (game) {
        var activityMode = game.activityMode || 'test';

        $('input[name="slcchemactivitymode"][value="' + activityMode + '"]').prop('checked', true);
        $('#chemShowMinimize').prop('checked',    !!game.showMinimize);
        $('#chemAnswersRamdon').prop('checked',   !!game.answersRamdon);
        $('#chemQuestionsRandom').prop('checked', !!game.questionsRandom);
        $('#chemShowSolution').prop('checked',    game.showSolution !== false);
        $('#chemTimeShowSolution').val(game.timeShowSolution || 3).prop('disabled', !$('#chemShowSolution').is(':checked'));
        $('#chemHasFeedBack').prop('checked', !!game.feedBack);
        $('#chemPercentajeFB').val(game.percentajeFB || 100).prop('disabled', !game.feedBack);
        if (game.feedBack) $('#chemFeedbackP').show();
        $('#chemPercentajeQuestionsValue').val(game.percentajeQuestions || 100);
        $('#chemModeBoard').prop('checked', !!game.modeBoard);
        $('#chemGlobalTimes').val(game.globalTime || 0);
        $('#chemEvaluation').prop('checked', !!game.evaluation);
        $('#chemEvaluationID').val(game.evaluationID || '').prop('disabled', !game.evaluation);

        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm, game.textButtonScorm, game.repeatActivity, game.weighted
        );

        // Migrate question fields
        for (var i = 0; i < (game.selectsGame || []).length; i++) {
            var q = game.selectsGame[i];
            if (typeof q.ket           === 'undefined') q.ket           = '';
            if (typeof q.svg           === 'undefined') q.svg           = '';
            if (typeof q.smiles        === 'undefined') q.smiles        = '';
            if (typeof q.molfile       === 'undefined') q.molfile       = '';
            if (typeof q.rxn           === 'undefined') q.rxn           = '';
            if (typeof q.description   === 'undefined') q.description   = '';
            if (typeof q.structureType === 'undefined') q.structureType = 'molecule';
        }

        $exeDevice.selectsGame = game.selectsGame || [];
        $exeDevice.updateQuestionsNumber();
        $exeDevice.showQuestion($exeDevice.active);
    },

    // ────────────────────────────────────────────────────────────
    // Validation & save
    // ────────────────────────────────────────────────────────────

    validateQuestion: function () {
        var msgs = $exeDevice.msgs;
        var activityMode = $('input[name="slcchemactivitymode"]:checked').val() || 'test';
        var p = {};
        var message = '';

        p.typeSelect       = parseInt($('input[name=slcchemtypeselect]:checked').val(), 10);
        p.numberOptions    = parseInt($('input[name=slcchemnumber]:checked').val(), 10);
        p.time             = parseInt($('input[name=slcchemtime]:checked').val(), 10);
        p.description      = ($('#chemDescription').val() || '').trim();
        p.percentageShow   = parseInt($('#chemPercentageShow').val(), 10) || 35;

        // Read cached structure from selectsGame
        var cached  = $exeDevice.selectsGame[$exeDevice.active] || {};
        p.ket       = cached.ket    || '';
        p.svg       = cached.svg    || '';
        p.smiles    = cached.smiles || '';
        p.molfile   = cached.molfile || '';
        p.rxn       = cached.rxn    || '';
        p.structureType = cached.structureType || 'molecule';

        p.quextion = ($('#chemQuestion').val() || '').trim();
        p.options  = [];
        p.solution = ($('#chemSolutionSelect').text() || '').trim();
        p.solutionQuestion = '';
        p.msgHit   = ($('#chemMessageOK').val() || '').trim();
        p.msgError = ($('#chemMessageKO').val() || '').trim();

        if (p.typeSelect === 2) {
            p.quextion         = ($('#chemDefinitionWord').val() || '').trim();
            p.solution         = '';
            p.solutionQuestion = ($('#chemSolutionWord').val() || '').trim();
        }

        var optionEmpty = false;
        $('.CHEME-EOptionInput').each(function (i) {
            var val = ($(this).val() || '').trim();
            if (i < p.numberOptions && val.length === 0) optionEmpty = true;
            p.options.push(p.typeSelect === 2 ? '' : val);
        });

        if (activityMode === 'test') {
            var hasStructure = !!(p.ket || p.smiles || p.molfile);
            if (!hasStructure) {
                message = msgs.msgESelectStructure;
            } else if (p.typeSelect !== 2 && p.quextion.length === 0) {
                message = msgs.msgECompleteQuestion;
            } else if (p.typeSelect !== 2 && optionEmpty) {
                message = msgs.msgECompleteAllOptions;
            } else if (p.typeSelect !== 2 && !p.solution) {
                message = msgs.msgTypeChoose;
            } else if (p.typeSelect === 2 && p.solutionQuestion.trim().length === 0) {
                message = msgs.msgEProvideWord;
            } else if (p.typeSelect === 2 && p.quextion.trim().length === 0) {
                message = msgs.msgEDefintion;
            }
        }

        if (message.length === 0) {
            $exeDevice.selectsGame[$exeDevice.active] = $.extend($exeDevice.selectsGame[$exeDevice.active] || {}, p);
            return true;
        }

        $exeDevice.showMessage(message);
        return false;
    },

    validateData: function () {
        var activityMode = $('input[name="slcchemactivitymode"]:checked').val() || 'test';
        var itinerary    = $exeDevicesEdition.iDevice.gamification.itinerary.getValues();
        if (!itinerary) return false;

        var instructions    = escape($exeDevice.getEditorContent('eXeGameInstructions'));
        var textAfter       = escape($exeDevice.getEditorContent('eXeIdeviceTextAfter'));
        var textFeedBack    = escape($exeDevice.getEditorContent('chemFeedBackEditor'));
        var showMinimize    = $('#chemShowMinimize').is(':checked');
        var answersRamdon   = $('#chemAnswersRamdon').is(':checked');
        var questionsRandom = $('#chemQuestionsRandom').is(':checked');
        var showSolution    = $('#chemShowSolution').is(':checked');
        var timeShowSolution = parseInt($exeDevice.removeTags($('#chemTimeShowSolution').val()), 10);
        var modeBoard       = $('#chemModeBoard').is(':checked');
        var feedBack        = $('#chemHasFeedBack').is(':checked');
        var percentajeFB    = parseInt($exeDevice.removeTags($('#chemPercentajeFB').val()), 10);
        var percentajeQuestions = parseInt($exeDevice.removeTags($('#chemPercentajeQuestionsValue').val()), 10);
        var evaluation      = $('#chemEvaluation').is(':checked');
        var evaluationID    = ($('#chemEvaluationID').val() || '').trim();
        var globalTime      = parseInt($('#chemGlobalTimes').val(), 10);

        if (activityMode === 'test') {
            if (feedBack && textFeedBack.trim().length === 0) {
                eXe.app.alert($exeDevice.msgs.msgProvideFB);
                return false;
            }
            if (evaluation && evaluationID.length < 5) {
                eXe.app.alert($exeDevice.msgs.msgIDLenght);
                return false;
            }
        }

        // Every slide must have a structure and valid answers in test mode
        if (activityMode === 'test') {
            for (var i = 0; i < $exeDevice.selectsGame.length; i++) {
                var q = $exeDevice.selectsGame[i];
                var qHasStructure = !!(q.ket || q.smiles || q.molfile);
                if (!qHasStructure) {
                    $exeDevice.showMessage($exeDevice.msgs.msgESelectStructure);
                    return false;
                }
                var qType = q.typeSelect || 0;
                if (qType === 2) {
                    if (!(q.solutionQuestion || '').trim()) {
                        $exeDevice.showMessage($exeDevice.msgs.msgEProvideWord);
                        return false;
                    }
                    if (!(q.quextion || '').trim()) {
                        $exeDevice.showMessage($exeDevice.msgs.msgEDefintion);
                        return false;
                    }
                } else {
                    if (!(q.quextion || '').trim()) {
                        $exeDevice.showMessage($exeDevice.msgs.msgECompleteQuestion);
                        return false;
                    }
                    if (!(q.solution || '').trim()) {
                        $exeDevice.showMessage($exeDevice.msgs.msgTypeChoose);
                        return false;
                    }
                    var numOpts = q.numberOptions || 4;
                    for (var j = 0; j < numOpts; j++) {
                        if (!(q.options[j] || '').trim()) {
                            $exeDevice.showMessage($exeDevice.msgs.msgECompleteAllOptions);
                            return false;
                        }
                    }
                }
            }
        }

        var id = $exeDevice.getIdeviceID();

        return {
            selectsGame:         $exeDevice.selectsGame,
            activityMode:        activityMode,
            showMinimize:        showMinimize,
            answersRamdon:       answersRamdon,
            questionsRandom:     questionsRandom,
            showSolution:        showSolution,
            timeShowSolution:    timeShowSolution,
            modeBoard:           modeBoard,
            feedBack:            feedBack,
            percentajeFB:        percentajeFB,
            percentajeQuestions: percentajeQuestions,
            evaluation:          evaluation,
            evaluationID:        evaluationID,
            globalTime:          globalTime,
            itinerary:           itinerary,
            id:                  id,
            instructionsExe:     instructions,
            textAfter:           textAfter,
            textFeedBack:        textFeedBack,
        };
    },

    save: function () {
        if (!$exeDevice.validateQuestion()) return false;

        var dataGame = this.validateData();
        if (!dataGame) return false;

        $exeDevicesEdition.iDevice.gamification.helpers.stopSound();

        // Build i18n block (allow user overrides from language tab)
        var fields = this.ci18n;
        var i18n   = $.extend({}, fields);
        for (var key in fields) {
            var fVal = $('#ci18n_' + key).val();
            if (fVal !== '') i18n[key] = fVal;
        }
        dataGame.msgs = i18n;

        var json         = JSON.stringify(dataGame);
        var instructions = $exeDevice.getEditorContent('eXeGameInstructions');
        var textFeedBack = $exeDevice.getEditorContent('chemFeedBackEditor');
        var ideviceID    = $exeDevice.getIdeviceID();

        var html = '<div class="cheme-IDevice">';
        html += '<div class="game-evaluation-ids js-hidden" data-id="' + ideviceID
              + '" data-evaluationb="' + dataGame.evaluation
              + '" data-evaluationid="' + dataGame.evaluationID + '"></div>';

        if (instructions !== '') {
            html += '<div class="cheme-instructions">' + instructions + '</div>';
        }

        html += '<div class="cheme-version js-hidden">' + $exeDevice.version + '</div>';
        html += '<div class="cheme-feedback-game">' + textFeedBack + '</div>';
        html += '<div class="cheme-DataGame js-hidden">'
              + $exeDevices.iDevice.gamification.helpers.encrypt(json)
              + '</div>';

        var textAfter = $exeDevice.getEditorContent('eXeIdeviceTextAfter');
        if (textAfter !== '') {
            html += '<div class="cheme-extra-content">' + textAfter + '</div>';
        }

        html += '<div class="cheme-bns js-hidden">' + $exeDevice.msgs.msgNoSuportBrowser + '</div>';
        html += '</div>';

        return html;
    },

    // ────────────────────────────────────────────────────────────
    // Utilities
    // ────────────────────────────────────────────────────────────

    getIdeviceID: function () {
        return $('#chemIdeviceForm').closest('div.idevice_node').attr('id') || '';
    },

    removeTags: function (html) {
        return (html || '').replace(/<[^>]+>/g, '');
    },

    escapeHtml: function (s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    getEditorContent: function (id) {
        var editor = tinyMCE.get(id);
        if (editor) return editor.getContent();
        return $('#' + id).val() || '';
    },

    setEditorContent: function (id, content) {
        var editor = tinyMCE.get(id);
        if (editor) { editor.setContent(content); }
        else        { $('#' + id).val(content); }
    },
};
