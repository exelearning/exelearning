/* eslint-disable no-undef */
/**
 * Electrical Circuits Quiz iDevice (edition code)
 * Based on Select Activity (quick-questions-multiple-choice).
 * Questions are paired with SVG circuit diagrams rendered from TikZJax in edition.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    // i18n
    i18n: {
        name: _('Electrical Circuits'),
        alt: _('Electrical Circuits'),
    },
    idevicePath: '',
    msgs: {},
    classIdevice: 'electrical-circuits',
    active: 0,
    selectsGame: [],
    typeEdit: -1,
    numberCutCuestion: -1,
    clipBoard: '',
    id: false,
    ci18n: {},
    version: 3.1,
    renderedTikzPreview: null,
    tikzFinishedHandler: null,
    tikzCapturePromise: null,

    // Per-circuit TikZJax compile budget for the AI save flow. The very first
    // circuit also pays TikZJax's one-time WebAssembly cold start, which on a
    // slow browser (e.g. Firefox CI) easily exceeds the warm budget, so give it
    // a much longer window before treating a valid circuit as un-renderable;
    // every later circuit renders on the warm engine and uses the normal budget.
    tikzRenderTimeoutMs: 15000,
    tikzColdStartTimeoutMs: 60000,

    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.refreshTranslations();
        this.ci18n.msgTryAgain = this.ci18n.msgTryAgain.replace(
            '&percnt;',
            '%'
        );

        this.setMessagesInfo();
        this.createForm();
    },

    getEditorContent: function (id) {
        const editor = tinyMCE.get(id);
        if (editor) return editor.getContent();
        return $('#' + id).val() || '';
    },

    setEditorContent: function (id, content) {
        const editor = tinyMCE.get(id);
        if (editor) {
            editor.setContent(content);
        } else {
            $('#' + id).val(content);
        }
    },

    enableForm: function () {
        $exeDevice.initQuestions();
        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
        // Ensure correct layout for current mode
        var currentMode = $('input[name="slcactivitymode"]:checked').val() || 'test';
        $exeDevice.toggleActivityMode(currentMode);
        // Show first question and render circuit preview
        $exeDevice.showQuestion($exeDevice.active);
    },

    toggleActivityMode: function (mode) {
        const isShow = mode === 'show';
        const ids = [
            'elceTypeDiv', 'elceInputNumbers', 'elcePercentageSpan',
            'elceTimeDiv', 'elceScoreQuestionDiv',
            'elceContents', 'elceShowSolutionDiv', 'elceGlobalTimeDiv',
            'elceAnswersRamdonDiv', 'elceModeBoardDiv'
        ];
        ids.forEach(function (id) {
            const $el = $('#' + id);
            if (isShow) {
                $el.addClass('d-none');
            } else {
                $el.removeClass('d-none');
            }
        });
        // Description: visible only in Show mode
        if (isShow) {
            $('#elceDescriptionDiv').removeClass('d-none');
        } else {
            $('#elceDescriptionDiv').addClass('d-none');
        }
        // Show mode layout: centered full-width preview
        var $panel = $('#elcePanel');
        if (isShow) {
            $panel.addClass('ELCE-ShowMode');
            // Move tikz code group below preview in multimedia column
            $('#elceTikzCodeGroup').insertAfter('#elceMultimedia');
        } else {
            $panel.removeClass('ELCE-ShowMode');
            // Move tikz code group to options column, before Type
            $('#elceTikzCodeGroup').insertBefore('#elceTypeDiv');
        }
    },

    refreshTranslations: function () {
        this.ci18n = {
            // Used in export/electrical-circuits.js
            msgSubmit: c_('Submit'),
            msgClue: c_('Cool! The clue is:'),
            msgNewGame: c_('Click here for a new game'),
            msgCodeAccess: c_('Access code'),
            msgInformationLooking: c_(
                'Cool! The information you were looking for'
            ),
            msgPlayStart: c_('Click here to play'),
            msgErrors: c_('Errors'),
            msgHits: c_('Hits'),
            msgScore: c_('Score'),
            msgMinimize: c_('Minimize'),
            msgMaximize: c_('Maximize'),
            msgTime: c_('Time per question'),
            msgLive: c_('Life'),
            msgFullScreen: c_('Full Screen'),
            msgNumQuestions: c_('Number of questions'),
            msgNoImage: c_('No picture question'),
            msgCool: c_('Cool!'),
            msgLoseLive: c_('You lost one life'),
            msgLostLives: c_('You lost all your lives!'),
            msgAllQuestions: c_('You answered all the questions.'),
            msgSuccesses: c_(
                'Right! | Excellent! | Great! | Very good! | Perfect!'
            ),
            msgFailures: c_(
                'It was not that! | Incorrect! | Not correct! | Sorry! | Error!'
            ),
            msgYouScore: c_('Your score'),
            msgTryAgain: c_('You need at least &percnt;s&percnt; of correct answers to get the information. Please try again.'),
            msgQuestion: c_('Question'),
            msgAnswer: c_('Check'),
            msgInformation: c_('Information'),
            msgAuthor: c_('Authorship'),
            msgClose: c_('Close'),
            msgOption: c_('Option'),
            msgOrders: c_('Please order the answers'),
            msgIndicateWord: c_('Provide a word or phrase'),
            msgMoveOne: c_('Move on'),
            msgPoints: c_('points'),
            msgCorrect: c_('Correct'),
            msgIncorrect: c_('Incorrect'),
            msgPrevious: c_('Previous'),
            msgNext: c_('Next'),
            msgWeight: c_('Weight'),
            msgScoreScorm: c_('The score can not be saved because this page is not part of a SCORM package.'),
            msgOnlySaveScore: c_('You can only save the score once'),
            msgOnlySaveAuto: c_('Your score will be saved after each question. You can only play once.'),
            msgSeveralScore: c_('You can save the score as many times as you want'),
            msgYouLastScore: c_('The last score saved is'),
            msgEndGameScore: c_('Please start the activity before saving your score.'),
            msgSaveAuto: c_('Your score will be automatically saved after each question.'),
            msgActityComply: c_('You have already done this activity.'),
            msgPlaySeveralTimes: c_('You can do this activity as many times as you want'),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgTypeGame: c_('Electrical Circuits Quiz'),
        };
    },

    setMessagesInfo: function () {
        const msgs = $exeDevice.msgs;
        msgs.msgEOneQuestion = _('Please provide at least one question');
        msgs.msgTypeChoose = _(
            'Please select the correct answer for each question'
        );
        msgs.msgECompleteQuestion = _('Please write the question');
        msgs.msgECompleteAllOptions = _('Please complete all options');
        msgs.msgTimeFormat = _('Please check the time format: hh:mm:ss');
        msgs.msgProvideSolution = _('Please write the word/phrase');
        msgs.msgESelectFile = _('The selected file is not a valid game');
        msgs.msgEProvideTimeSolution = _(
            'Please indicate the time to display the solution'
        );
        msgs.msgEProvideWord = _('Please provide the word or phrase');
        msgs.msgEDefintion = _(
            'Please provide the definition of the word or phrase'
        );
        msgs.msgProvideFB = _('Message to display when passing the game');
        msgs.msgNotHitCuestion = _(
            'The question marked as next in case of success does not exist.'
        );
        msgs.msgNotErrorCuestion = _(
            'The question marked as next in case of error does not exist.'
        );
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.'
        );
        msgs.msgERenderCircuitPreview = _(
            'Please render the circuit preview before saving.'
        );
        msgs.msgIDLenght = _(
            'The report identifier must have at least 5 characters'
        );
        msgs.msgGeneratingCircuitsTitle = _('Please wait');
        msgs.msgGeneratingCircuits = _(
            'Generating the circuit images, this may take a few minutes, please wait…'
        );
        msgs.msgQuestionsAdded = _('The questions have been added successfully');
        msgs.msgEQuestionsNotAdded = _(
            'Some questions could not be added because their circuit could not be generated. They have been kept in the text box so you can correct them and try again.'
        );
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    addQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.clearQuestion();
            $exeDevice.selectsGame.push($exeDevice.getCuestionDefault());
            $exeDevice.active = $exeDevice.selectsGame.length - 1;
            $exeDevice.typeEdit = -1;
            $('#elcePaste').hide();
            $('#elceNumQuestions').text($exeDevice.selectsGame.length);
            $('#elceNumberQuestion').val($exeDevice.selectsGame.length);
            $exeDevice.updateSelectOrder();
        }
    },

    removeQuestion: function () {
        if ($exeDevice.selectsGame.length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
            return;
        } else {
            $exeDevice.selectsGame.splice($exeDevice.active, 1);
            if ($exeDevice.active >= $exeDevice.selectsGame.length - 1) {
                $exeDevice.active = $exeDevice.selectsGame.length - 1;
            }
            $exeDevice.showQuestion($exeDevice.active);
            $exeDevice.typeEdit = -1;
            $('#elcePaste').hide();
            $('#elceNumQuestions').text($exeDevice.selectsGame.length);
            $('#elceNumberQuestion').val($exeDevice.active + 1);
            $exeDevice.updateSelectOrder();
        }
    },

    copyQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.typeEdit = 0;
            $exeDevice.clipBoard = JSON.parse(
                JSON.stringify($exeDevice.selectsGame[$exeDevice.active])
            );
            $('#elcePaste').show();
        }
    },

    cutQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.numberCutCuestion = $exeDevice.active;
            $exeDevice.typeEdit = 1;
            $('#elcePaste').show();
        }
    },

    pasteQuestion: function () {
        if ($exeDevice.typeEdit == 0) {
            $exeDevice.active++;
            $exeDevice.selectsGame.splice(
                $exeDevice.active,
                0,
                $exeDevice.clipBoard
            );
            $exeDevice.showQuestion($exeDevice.active);
        } else if ($exeDevice.typeEdit == 1) {
            $('#elcePaste').hide();
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                $exeDevice.selectsGame,
                $exeDevice.numberCutCuestion,
                $exeDevice.active
            );
            $exeDevice.showQuestion($exeDevice.active);
            $('#elceNumQuestions').text($exeDevice.selectsGame.length);
        }
        $exeDevice.updateSelectOrder();
    },

    nextQuestion: function () {
        if (
            $exeDevice.validateQuestion() &&
            $exeDevice.active < $exeDevice.selectsGame.length - 1
        ) {
            $exeDevice.active++;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    lastQuestion: function () {
        if (
            $exeDevice.validateQuestion() &&
            $exeDevice.active < $exeDevice.selectsGame.length - 1
        ) {
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

    updateSelectOrder: function () {
        const activeGame = $exeDevice.selectsGame[$exeDevice.active];

        function updateSelectOptions(selectId, valueToSet) {
            const $select = $(selectId);
            $select
                .empty()
                .append(
                    $('<option>', { value: -2, text: _('End') }),
                    $('<option>', { value: -1, text: _('Next') })
                );

            $.each($exeDevice.selectsGame, function (index) {
                $select.append(
                    $('<option>', {
                        value: index,
                        text: (index + 1).toString(),
                    })
                );
            });

            $select.val(valueToSet);
        }
        $exeDevice.updateQuestionsNumber();
    },

    updateQuestionsNumber: function () {
        let percentaje = parseInt(
            $exeDevice.removeTags(
                $('#elcePercentajeQuestionsValue').val()
            ),
            10
        );
        if (isNaN(percentaje)) return;

        percentaje = Math.max(1, Math.min(percentaje, 100));
        const totalQuestions = $exeDevice.selectsGame.length,
            num = Math.max(1, Math.round((percentaje * totalQuestions) / 100));
        $('#elceNumeroPercentaje').text(num + '/' + totalQuestions);
    },

    showQuestion: function (i) {
        $exeDevice.clearQuestion();
        const totalQuestions = $exeDevice.selectsGame.length,
            num = Math.max(0, Math.min(i, totalQuestions - 1));
        let p = $exeDevice.selectsGame[num];
        const activityMode = $('input[name="slcactivitymode"]:checked').val() || 'test';

        $('#elceNumQuestions').text(totalQuestions);
        $('#elceNumberQuestion').val(num + 1);

        // Load TikZ code, description and render preview
        const tikzCode = (p.tikzCode || '').trim();
        $('#elceTikzCode').val(tikzCode);
        $('#elceDescription').val(p.description || '');
        if (!tikzCode || !$exeDevice.showStoredTikzSvg(tikzCode, p.tikzSvg)) {
            $exeDevice.renderTikzPreview();
        }

        if (activityMode === 'show') return;

        if (p.typeSelect !== 2) {
            let numOptions = 0;
            $('.ELCE-EAnwersOptions').each(function (j) {
                numOptions++;
                if (p.options[j].trim() !== '') {
                    p.numOptions = numOptions;
                }
                $(this).val(p.options[j]);
            });
        } else {
            $('#elceSolutionWord').val(p.solutionQuestion);
            $('#elcePercentageShow').val(p.percentageShow);
            $('#elceDefinitionWord').val(p.quextion);
        }

        $exeDevice.showTypeQuestion(p.typeSelect);
        $exeDevice.showOptions(p.numberOptions);
        $('#elceQuestion').val(p.quextion);

        $('.ELCE-EAnwersOptions').each(function (j) {
            $(this).val(p.options[j] || '');
        });

        $exeDevicesEdition.iDevice.gamification.helpers.stopSound();

        $(
            "input.ELCE-Number[name='slcnumber'][value='" +
                p.numberOptions +
                "']"
        ).prop('checked', true);
        $exeDevice.checkQuestions(p.solution);
        $("input.ELCE-Times[name='slctime'][value='" + p.time + "']").prop(
            'checked',
            true
        );
        $(
            "input.ELCE-TypeSelect[name='slctypeselect'][value='" +
                p.typeSelect +
                "']"
        ).prop('checked', true);
    },

    checkQuestions: function (solution) {
        $("input.ELCE-ESolution[name='slcsolution']").prop('checked', false);
        for (let i = 0; i < solution.length; i++) {
            let sol = solution[i];
            $(
                "input.ELCE-ESolution[name='slcsolution'][value='" + sol + "']"
            ).prop('checked', true);
        }
        $('#elceSolutionSelect').text(solution);
    },

    sanitizeTikzSvg: function (svg) {
        if (!svg) return '';

        const parser = new DOMParser();
        let parsedSvg = null;

        if (typeof svg === 'string') {
            const parsed = parser.parseFromString(svg, 'image/svg+xml');
            if (parsed.querySelector('parsererror')) return '';
            parsedSvg = parsed.querySelector('svg');
        } else if (svg.nodeType === 1) {
            parsedSvg =
                svg.tagName.toLowerCase() === 'svg'
                    ? svg.cloneNode(true)
                    : svg.querySelector('svg')?.cloneNode(true);
        }

        if (!parsedSvg || parsedSvg.tagName.toLowerCase() !== 'svg') return '';

        parsedSvg.querySelectorAll('script, foreignObject').forEach((node) => {
            node.remove();
        });

        [parsedSvg, ...parsedSvg.querySelectorAll('*')].forEach((node) => {
            [...node.attributes].forEach((attribute) => {
                const name = attribute.name.toLowerCase(),
                    value = attribute.value.replace(/\s+/g, '').toLowerCase();

                if (name.startsWith('on') || value.includes('javascript:')) {
                    node.removeAttribute(attribute.name);
                }
            });
        });

        parsedSvg.removeAttribute('width');
        parsedSvg.removeAttribute('height');

        return new XMLSerializer().serializeToString(parsedSvg);
    },

    // Unicode symbols TikZJax's bundled LaTeX cannot parse (its inputenc is not
    // set up for utf8), mapped to their LaTeX commands. Authors routinely type
    // these glyphs directly — e.g. the ohm sign Ω in "R=1 kΩ" or micro µ in
    // "1 µF" — which otherwise aborts compilation with
    // "Unicode character ... not set up for use with LaTeX" and leaves the
    // circuit unrendered.
    tikzUnicodeReplacements: {
        // Uppercase Greek letters
        Ω: '\\Omega',
        Γ: '\\Gamma',
        Δ: '\\Delta',
        Θ: '\\Theta',
        Λ: '\\Lambda',
        Π: '\\Pi',
        Σ: '\\Sigma',
        Φ: '\\Phi',
        Ψ: '\\Psi',
        // Lowercase Greek letters
        α: '\\alpha',
        β: '\\beta',
        γ: '\\gamma',
        δ: '\\delta',
        ε: '\\varepsilon',
        η: '\\eta',
        θ: '\\theta',
        λ: '\\lambda',
        µ: '\\mu', // U+00B5 micro sign
        μ: '\\mu', // U+03BC greek small letter mu
        ν: '\\nu',
        π: '\\pi',
        ρ: '\\rho',
        σ: '\\sigma',
        τ: '\\tau',
        φ: '\\varphi',
        χ: '\\chi',
        ψ: '\\psi',
        ω: '\\omega',
        // Operators and units
        '×': '\\times',
        '÷': '\\div',
        '±': '\\pm',
        '∓': '\\mp',
        '·': '\\cdot',
        '≤': '\\leq',
        '≥': '\\geq',
        '≠': '\\neq',
        '≈': '\\approx',
        '∞': '\\infty',
        '√': '\\surd',
        '∝': '\\propto',
        '∠': '\\angle',
        '°': '^\\circ',
        // Arrows
        '→': '\\rightarrow',
        '←': '\\leftarrow',
        '↔': '\\leftrightarrow',
        '⇒': '\\Rightarrow',
    },

    // siunitx/gensymb unit and SI-prefix macros the AI emits but TikZJax's loaded
    // packages (circuitikz, amsmath, amssymb) do NOT define, so they abort the
    // compile with "Undefined control sequence" (e.g. \ohm, \volt, \kilo). Mapped
    // to plain-text/Unicode equivalents: \ohm/\micro flow into the Ω/µ handling
    // (the Unicode net above and the R=/C= label rules below); the rest are ASCII
    // unit letters that are always valid inside a label.
    tikzUnitMacroReplacements: {
        ohm: 'Ω',
        kohm: 'kΩ',
        megohm: 'MΩ',
        volt: 'V',
        millivolt: 'mV',
        kilovolt: 'kV',
        ampere: 'A',
        milliampere: 'mA',
        microampere: 'µA',
        watt: 'W',
        milliwatt: 'mW',
        kilowatt: 'kW',
        farad: 'F',
        microfarad: 'µF',
        nanofarad: 'nF',
        picofarad: 'pF',
        henry: 'H',
        millihenry: 'mH',
        microhenry: 'µH',
        hertz: 'Hz',
        kilohertz: 'kHz',
        megahertz: 'MHz',
        siemens: 'S',
        coulomb: 'C',
        joule: 'J',
        kelvin: 'K',
        newton: 'N',
        pascal: 'Pa',
        tesla: 'T',
        weber: 'Wb',
        second: 's',
        metre: 'm',
        meter: 'm',
        gram: 'g',
        // SI prefixes
        kilo: 'k',
        milli: 'm',
        micro: 'µ',
        mega: 'M',
        giga: 'G',
        nano: 'n',
        pico: 'p',
        centi: 'c',
        deci: 'd',
    },

    /**
     * Replace bare Unicode symbols with their LaTeX equivalents wrapped in
     * \ensuremath{} so they compile under TikZJax regardless of whether they
     * appear in text or math context. Pure helper consumed by normalizeTikzCode
     * (the single source of truth), so the rendered LaTeX, the cache key and the
     * saved code all stay LaTeX-safe.
     */
    sanitizeTikzUnicode: function (code) {
        if (!code) {
            return '';
        }

        let result = '';
        for (const char of code) {
            const replacement = $exeDevice.tikzUnicodeReplacements[char];
            result += replacement ? '\\ensuremath{' + replacement + '}' : char;
        }
        return result;
    },

    sanitizeTikzRendererSyntax: function (code) {
        if (!code) {
            return '';
        }

        const formatNumber = (value) =>
            String(value).trim().replace(/(\d),(\d)/g, '$1{,}$2');

        return code
            .replace(/\\\\,/g, '\\,')
            // Drop angle brackets the AI wraps around a unit macro (<\ohm> -> \ohm)
            // and replace siunitx/gensymb unit/prefix macros TikZJax cannot compile
            // with plain-text/Unicode equivalents, so the label rules below (and the
            // Unicode net) render them instead of aborting with "Undefined control
            // sequence".
            .replace(/<\s*(\\[a-zA-Z]+)\s*>/g, '$1')
            .replace(/\\([a-zA-Z]+)\b/g, (match, name) =>
                Object.hasOwn($exeDevice.tikzUnitMacroReplacements, name)
                    ? $exeDevice.tikzUnitMacroReplacements[name]
                    : match
            )
            .replace(/\bto\s*\[\s*lD\b/g, 'to[leD')
            // Repair clear circuitikz component-name mistakes the AI makes: the
            // symbol is unambiguous, only the key is wrong. "open switch" /
            // "closed switch" are not valid keys (pgfkeys "I do not know the key"
            // → abort); circuitikz uses "opening switch" / "closing switch". Only
            // rewrite right after to[ so a {label} mentioning the words is untouched.
            .replace(/\bto\s*\[\s*open\s+switch\b/gi, 'to[opening switch')
            .replace(/\bto\s*\[\s*closed\s+switch\b/gi, 'to[closing switch')
            .replace(
                /\bto\s*\[\s*(battery1|battery2)\s*,\s*l\s*=\s*([0-9]+(?:\{,\}[0-9]+|[.,][0-9]+)?)\s*V\s*\]/g,
                (_match, component, value) =>
                    `to[${component},l={$${formatNumber(value)}\\,\\mathrm{V}$}]`
            )
            .replace(
                /\bto\s*\[\s*R\s*=\s*([0-9]+(?:\{,\}[0-9]+|[.,][0-9]+)?)\s*(k?)\s*(?:Ω|\\Omega)\s*\]/g,
                (_match, value, prefix) => {
                    const unit = prefix ? '\\mathrm{k}\\Omega' : '\\Omega';
                    return `to[R,l={$${formatNumber(value)}\\,${unit}$}]`;
                }
            )
            .replace(
                /\bto\s*\[\s*C\s*=\s*([0-9]+(?:\{,\}[0-9]+|[.,][0-9]+)?)\s*(?:\\mu|µ|μ|u)\s*F\s*\]/g,
                (_match, value) =>
                    `to[C,l={$${formatNumber(value)}\\,\\mu\\mathrm{F}$}]`
            )
            .replace(/(^|[^\\]),\s*(?=\\(?:mathrm|Omega|mu)\b)/g, '$1\\,')
            // Brace any math label that still holds a *bare* comma so TikZ's
            // `to[...]` parser stops reading it as an option separator
            // (e.g. l=$9,V$ -> l={$9\,V$}; otherwise it errors with an unknown
            // key like '/tikz/V$'). The \, thin space is left alone; a
            // digit,digit comma stays a {,} thousands separator and any other
            // bare comma becomes a thin space.
            .replace(/=\s*\$([^$]*)\$/g, (match, content) => {
                if (!/(^|[^\\]),/.test(content)) return match;
                const fixed = content.replace(/\s*,\s*/g, (comma, offset, str) => {
                    const prev = str[offset - 1];
                    const next = str[offset + comma.length];
                    if (prev === '\\') return comma;
                    if (prev === '{' && next === '}') return comma;
                    return /\d/.test(prev) && /\d/.test(next) ? '{,}' : '\\,';
                });
                return `={$${fixed}$}`;
            })
            // Repair logic-gate syntax: the AI emits pgf's shapes.gates.logic
            // names (node[and gate], anchors .input/.output) from a library that
            // is not loaded here, while circuitikz uses `... port` shapes with
            // .in/.out anchors. Rewrite the shape only inside [...] and the
            // anchors only inside (...), so node labels ({...}), transistor .gate
            // anchors and any other code are left untouched.
            .replace(/\[([^\]]*)\]/g, (_match, options) =>
                '[' +
                options.replace(
                    /\b(and|or|not|nand|nor|xnor|xor|buffer)\s+gate\b/g,
                    '$1 port'
                ) +
                ']'
            )
            .replace(/\(([^)]*)\)/g, (_match, reference) =>
                '(' + reference.replace(/\.input\b/g, '.in').replace(/\.output\b/g, '.out') + ')'
            );
    },

    normalizeTikzCode: function (code) {
        // Single source of truth: collapse line breaks (and the surrounding
        // indentation), repair known AI-generated CircuiTikZ patterns, then
        // replace Unicode symbols TikZJax cannot parse. TikZJax fails on
        // multi-line input, and using this everywhere keeps the rendered-SVG
        // cache key aligned with what validateQuestion/save look up.
        const collapsed = (code || '').trim().replace(/\s*\r?\n\s*/g, ' ');
        return $exeDevice.sanitizeTikzUnicode(
            $exeDevice.sanitizeTikzRendererSyntax(collapsed)
        );
    },

    normalizeVisibleCircuitText: function (text) {
        if (!text) {
            return '';
        }

        return String(text)
            .trim()
            .replace(/^\\\((.*)\\\)$/g, '$1')
            .replace(/^\{\$(.*)\$\}$/g, '$1')
            .replace(/^\$(.*)\$$/g, '$1')
            .replace(/\{,\}/g, ',')
            .replace(/(^|[^\\]),\s*(?=\\(?:mathrm|Omega|mu)\b)/g, '$1 ')
            .replace(/\\mathrm\{([^{}]*)\}/g, '$1')
            .replace(/\\\\,/g, ' ')
            .replace(/\\,/g, ' ')
            .replace(/\\Omega/g, 'Ω')
            .replace(/\\mu/g, 'µ')
            .replace(/\\times\b/g, '×')
            .replace(/\\cdot\b/g, '·')
            .replace(/\\pm\b/g, '±')
            .replace(/\^\{?\\circ\}?/g, '°')
            .replace(/\\degree\b/g, '°')
            .replace(/[{}$]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    },

    setRenderedTikzSvg: function (code, svg) {
        const normalizedCode = $exeDevice.normalizeTikzCode(code),
            sanitizedSvg = $exeDevice.sanitizeTikzSvg(svg);

        if (!normalizedCode || !sanitizedSvg) {
            $exeDevice.renderedTikzPreview = null;
            return '';
        }

        $exeDevice.renderedTikzPreview = {
            code: normalizedCode,
            svg: sanitizedSvg,
        };
        return sanitizedSvg;
    },

    getRenderedTikzSvgForCode: function (code) {
        const normalizedCode = $exeDevice.normalizeTikzCode(code);

        if (
            !normalizedCode ||
            !$exeDevice.renderedTikzPreview ||
            $exeDevice.renderedTikzPreview.code !== normalizedCode
        ) {
            return '';
        }

        return $exeDevice.renderedTikzPreview.svg;
    },

    invalidateTikzSvgPreview: function () {
        $exeDevice.renderedTikzPreview = null;
    },

    // Parsed Computer Modern fonts, keyed by font-family, reused across renders.
    tikzFontCache: {},

    // TikZJax emits one Unicode code point per glyph from its own font-encoding
    // table. That mapping for the operators-font uppercase Omega is off by one:
    // it emits U+00AC (¬) although the Computer Modern fonts carry the Omega
    // glyph at U+00AD. Correct it before looking the glyph up — otherwise the
    // ohm sign is the not-sign, the code point the browser also refuses to draw.
    tikzGlyphCodepointFixups: new Map([[0x00ac, 0x00ad]]),

    /**
     * Minimal big-endian TrueType reader: just enough to turn the Computer
     * Modern glyphs TikZJax references into vector outlines. Returns a font
     * object exposing unitsPerEm, a code-point -> glyph-index Map, per-glyph
     * advance widths and the contours of a glyph, or null when a required table
     * is missing or the buffer is not a recognizable font.
     */
    parseTikzFont: function (buffer) {
        const view = new DataView(
            buffer instanceof ArrayBuffer ? buffer : buffer.buffer
        );
        if (view.byteLength < 12) return null;

        const u8 = (offset) => view.getUint8(offset);
        const u16 = (offset) => view.getUint16(offset);
        const i16 = (offset) => view.getInt16(offset);
        const u32 = (offset) => view.getUint32(offset);

        const tables = {};
        const numTables = u16(4);
        for (let i = 0; i < numTables; i++) {
            const record = 12 + i * 16;
            const tag = String.fromCharCode(
                u8(record),
                u8(record + 1),
                u8(record + 2),
                u8(record + 3)
            );
            tables[tag] = u32(record + 8);
        }

        if (
            tables.head == null ||
            tables.maxp == null ||
            tables.loca == null ||
            tables.glyf == null ||
            tables.cmap == null
        ) {
            return null;
        }

        const cmap = $exeDevice.parseTikzCmap(view, tables.cmap);
        if (!cmap) return null;

        const unitsPerEm = u16(tables.head + 18);
        const longLoca = i16(tables.head + 50) === 1;
        const numGlyphs = u16(tables.maxp + 4);
        const numberOfHMetrics =
            tables.hhea != null ? u16(tables.hhea + 34) : 0;

        const glyphOffsets = new Array(numGlyphs + 1);
        for (let i = 0; i <= numGlyphs; i++) {
            glyphOffsets[i] = longLoca
                ? u32(tables.loca + i * 4)
                : u16(tables.loca + i * 2) * 2;
        }

        const advanceWidth = (glyphIndex) => {
            if (tables.hmtx == null || numberOfHMetrics === 0) return 0;
            const index =
                glyphIndex < numberOfHMetrics
                    ? glyphIndex
                    : numberOfHMetrics - 1;
            return u16(tables.hmtx + index * 4);
        };

        const glyphContours = (glyphIndex) => {
            if (glyphIndex < 0 || glyphIndex >= numGlyphs) return [];
            if (glyphOffsets[glyphIndex] === glyphOffsets[glyphIndex + 1]) {
                return [];
            }

            const start = tables.glyf + glyphOffsets[glyphIndex];
            const numberOfContours = i16(start);
            // The shipped Computer Modern fonts use only simple glyphs; composite
            // glyphs (negative contour count) never occur, so leave them empty.
            if (numberOfContours < 0) return [];

            let pointer = start + 10;
            const endPoints = [];
            for (let i = 0; i < numberOfContours; i++) {
                endPoints.push(u16(pointer));
                pointer += 2;
            }
            const pointCount = numberOfContours
                ? endPoints[numberOfContours - 1] + 1
                : 0;
            pointer += 2 + u16(pointer); // skip hinting instructions

            const flags = [];
            while (flags.length < pointCount) {
                const flag = u8(pointer++);
                flags.push(flag);
                if (flag & 0x08) {
                    let repeat = u8(pointer++);
                    while (repeat-- > 0) flags.push(flag);
                }
            }

            const readDeltas = (shortBit, sameBit) => {
                const values = [];
                let value = 0;
                for (let i = 0; i < pointCount; i++) {
                    const flag = flags[i];
                    if (flag & shortBit) {
                        const delta = u8(pointer++);
                        value += flag & sameBit ? delta : -delta;
                    } else if (!(flag & sameBit)) {
                        value += i16(pointer);
                        pointer += 2;
                    }
                    values.push(value);
                }
                return values;
            };
            const xs = readDeltas(0x02, 0x10);
            const ys = readDeltas(0x04, 0x20);

            const contours = [];
            let from = 0;
            for (let c = 0; c < numberOfContours; c++) {
                const to = endPoints[c];
                const points = [];
                for (let i = from; i <= to; i++) {
                    points.push({
                        x: xs[i],
                        y: ys[i],
                        on: !!(flags[i] & 0x01),
                    });
                }
                contours.push(points);
                from = to + 1;
            }
            return contours;
        };

        return {
            unitsPerEm: unitsPerEm,
            cmap: cmap,
            advanceWidth: advanceWidth,
            glyphContours: glyphContours,
        };
    },

    // Parse a TrueType `cmap` table, returning a code-point -> glyph-index Map.
    // Only the Windows Unicode BMP subtable (platform 3, encoding 1, format 4)
    // is needed for the bundled Computer Modern fonts.
    parseTikzCmap: function (view, cmapOffset) {
        const u16 = (offset) => view.getUint16(offset);
        const u32 = (offset) => view.getUint32(offset);

        const subtableCount = u16(cmapOffset + 2);
        let subtable = -1;
        for (let i = 0; i < subtableCount; i++) {
            const record = cmapOffset + 4 + i * 8;
            if (u16(record) === 3 && u16(record + 2) === 1) {
                subtable = cmapOffset + u32(record + 4);
                break;
            }
        }
        if (subtable < 0 || u16(subtable) !== 4) return null;

        const map = new Map();
        const segCount = u16(subtable + 6) / 2;
        const endCodes = subtable + 14;
        const startCodes = endCodes + segCount * 2 + 2;
        const deltas = startCodes + segCount * 2;
        const ranges = deltas + segCount * 2;
        for (let s = 0; s < segCount; s++) {
            const end = u16(endCodes + s * 2);
            const start = u16(startCodes + s * 2);
            const delta = u16(deltas + s * 2);
            const rangeOffset = u16(ranges + s * 2);
            for (let code = start; code <= end && code !== 0xffff; code++) {
                let glyph;
                if (rangeOffset === 0) {
                    glyph = (code + delta) & 0xffff;
                } else {
                    glyph = u16(ranges + s * 2 + rangeOffset + (code - start) * 2);
                    if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
                }
                if (glyph) map.set(code, glyph);
            }
        }
        return map;
    },

    // Turn a glyph's TrueType contours (quadratic on/off-curve points, font
    // units, Y axis up) into SVG path data placed at the baseline origin
    // (penX, baselineY), matching how the original <text> element sat.
    tikzContoursToPathData: function (contours, penX, baselineY, scale) {
        const tx = (value) => Number((penX + value * scale).toFixed(2));
        const ty = (value) => Number((baselineY - value * scale).toFixed(2));
        let data = '';

        for (const contour of contours) {
            const count = contour.length;
            if (count === 0) continue;

            let current = contour[count - 1];
            let next = contour[0];
            if (current.on) {
                data += 'M' + tx(current.x) + ' ' + ty(current.y);
            } else if (next.on) {
                data += 'M' + tx(next.x) + ' ' + ty(next.y);
            } else {
                data +=
                    'M' +
                    tx((current.x + next.x) / 2) +
                    ' ' +
                    ty((current.y + next.y) / 2);
            }

            for (let i = 0; i < count; i++) {
                current = next;
                next = contour[(i + 1) % count];
                if (current.on) {
                    data += 'L' + tx(current.x) + ' ' + ty(current.y);
                    continue;
                }
                let endX = next.x;
                let endY = next.y;
                if (!next.on) {
                    endX = (current.x + next.x) / 2;
                    endY = (current.y + next.y) / 2;
                }
                data +=
                    'Q' +
                    tx(current.x) +
                    ' ' +
                    ty(current.y) +
                    ' ' +
                    tx(endX) +
                    ' ' +
                    ty(endY);
            }
            data += 'Z';
        }
        return data;
    },

    // Build the SVG path data for `text` rendered with `font` at baseline origin
    // (x, y) and the given font size, advancing the pen per glyph.
    tikzGlyphStringToPath: function (font, text, x, y, fontSize) {
        const scale = fontSize / font.unitsPerEm;
        let penX = x;
        let data = '';
        for (const character of text) {
            const codePoint = character.codePointAt(0);
            const fixedCodePoint =
                $exeDevice.tikzGlyphCodepointFixups.get(codePoint) ?? codePoint;
            const glyphIndex = font.cmap.get(fixedCodePoint);
            if (glyphIndex) {
                data += $exeDevice.tikzContoursToPathData(
                    font.glyphContours(glyphIndex),
                    penX,
                    y,
                    scale
                );
                penX += font.advanceWidth(glyphIndex) * scale;
            }
        }
        return data;
    },

    // Fetch and parse a Computer Modern font shipped next to this iDevice,
    // caching the (promise of the) result. Overridable in tests.
    loadTikzFont: function (family) {
        if (!$exeDevice.tikzFontCache[family]) {
            const url = ($exeDevice.idevicePath || '') + 'fonts/' + family + '.ttf';
            $exeDevice.tikzFontCache[family] = fetch(url)
                .then((response) => (response.ok ? response.arrayBuffer() : null))
                .then((buffer) =>
                    buffer ? $exeDevice.parseTikzFont(buffer) : null
                )
                .catch(() => null);
        }
        return $exeDevice.tikzFontCache[family];
    },

    /**
     * Replace every <text> TikZJax produced with a self-contained <path> built
     * from the real glyph outlines. This makes the stored/exported SVG render
     * correctly without the Computer Modern web fonts (which are never
     * registered as @font-face) and draws the ohm sign — whose code point the
     * browser otherwise refuses to render. Falls back to leaving a <text>
     * untouched when its font cannot be loaded.
     */
    convertTikzTextToPaths: function (svg) {
        if (!svg) return Promise.resolve();
        const texts = [...svg.querySelectorAll('text')];
        if (texts.length === 0) return Promise.resolve();

        const families = [
            ...new Set(
                texts.map((text) => text.getAttribute('font-family')).filter(Boolean)
            ),
        ];

        return Promise.all(
            families.map((family) =>
                $exeDevice
                    .loadTikzFont(family)
                    .then((font) => [family, font])
            )
        ).then((entries) => {
            const fonts = Object.fromEntries(entries);
            texts.forEach((text) => {
                const font = fonts[text.getAttribute('font-family')];
                if (!font) return;

                const x = parseFloat(text.getAttribute('x')) || 0;
                const y = parseFloat(text.getAttribute('y')) || 0;
                const fontSize = parseFloat(text.getAttribute('font-size')) || 10;
                const data = $exeDevice.tikzGlyphStringToPath(
                    font,
                    text.textContent,
                    x,
                    y,
                    fontSize
                );
                if (!data) return;

                const path = document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    'path'
                );
                path.setAttribute('d', data);
                const fill = text.getAttribute('fill');
                if (fill) path.setAttribute('fill', fill);
                text.replaceWith(path);
            });
        });
    },

    captureRenderedTikzPreview: function (code, preview) {
        const svg = preview.querySelector('svg');
        if (!svg) return '';

        const sanitizedSvg = $exeDevice.setRenderedTikzSvg(code, svg);
        if (sanitizedSvg) {
            preview.innerHTML = sanitizedSvg;
        }
        return sanitizedSvg;
    },

    showStoredTikzSvg: function (code, svg) {
        const preview = document.getElementById('elceTikzPreview'),
            $noCircuit = $('#elceNoCircuit'),
            sanitizedSvg = $exeDevice.setRenderedTikzSvg(code, svg);

        if (!preview || !sanitizedSvg) return false;

        preview.innerHTML = sanitizedSvg;
        $noCircuit.hide();
        return true;
    },

    /**
     * Render TikZ code in the preview area using TikZJax
     */
    renderTikzPreview: function () {
        const code = $exeDevice.normalizeTikzCode($('#elceTikzCode').val());
        const preview = document.getElementById('elceTikzPreview');
        const $noCircuit = $('#elceNoCircuit');

        $exeDevice.invalidateTikzSvgPreview();

        if (!code) {
            preview.innerHTML = '';
            $noCircuit.show();
            return;
        }

        // Drop any listener still pending from a previous render.
        if ($exeDevice.tikzFinishedHandler) {
            preview.removeEventListener(
                'tikzjax-load-finished',
                $exeDevice.tikzFinishedHandler
            );
            $exeDevice.tikzFinishedHandler = null;
        }

        $noCircuit.hide();
        preview.innerHTML = '';

        // Insert <script type="text/tikz"> so TikZJax (which observes <body>)
        // picks it up.
        const tikzScript = document.createElement('script');
        tikzScript.type = 'text/tikz';
        tikzScript.dataset.texPackages = JSON.stringify({'circuitikz': '', 'amsmath': '', 'amssymb': ''});
        // Keep TikZJax quiet in production: 'true' makes it console.log the raw
        // TikZ source on every render, which is debug noise for end users.
        tikzScript.dataset.showConsole = 'false';
        tikzScript.textContent = '\\begin{document}' + code + '\\end{document}';

        // While compiling, TikZJax inserts a loading-spinner <svg> placeholder
        // and only fires `tikzjax-load-finished` on the FINAL circuit <svg>
        // (both for cached and freshly compiled results). Grabbing any <svg>
        // captured the spinner by mistake and required a second click, so wait
        // for that event and then capture the real circuit.
        const onFinished = () => {
            preview.removeEventListener('tikzjax-load-finished', onFinished);
            $exeDevice.tikzFinishedHandler = null;
            // TikZJax renders glyphs as <text> referencing Computer Modern fonts
            // that are never registered, so convert them to self-contained
            // <path>s before capturing. Conversion is async (it fetches fonts);
            // expose the promise so the rest of the flow (and tests) can await.
            const renderedSvg = preview.querySelector('svg');
            $exeDevice.tikzCapturePromise = Promise.resolve(
                renderedSvg ? $exeDevice.convertTikzTextToPaths(renderedSvg) : null
            )
                .catch(() => {})
                .then(() => $exeDevice.captureRenderedTikzPreview(code, preview));
        };
        $exeDevice.tikzFinishedHandler = onFinished;
        preview.addEventListener('tikzjax-load-finished', onFinished);

        preview.appendChild(tikzScript);
    },

    /**
     * Compile a single TikZ circuit to a sanitized SVG string and resolve with
     * it (or '' on failure/timeout).
     *
     * Used by the AI save flow to pre-render every circuit before inserting its
     * question. It renders through the exact same proven path as the manual
     * preview — the persistent #elceTikzPreview element that TikZJax already
     * compiles reliably — instead of a throwaway container, which TikZJax did
     * not always finish for back-to-back renders. It does NOT touch the
     * single-slot SVG cache; addQuestions() re-renders the active question
     * afterwards, restoring the preview. Resolves '' when the code is empty,
     * when TikZJax produces no <svg>, or when it does not finish within the
     * timeout — callers treat an empty result as "this circuit could not be
     * generated". TikZJax gives no reliable error event, so a circuit that never
     * compiles relies on that timeout.
     */
    renderTikzCodeToSvg: function (code, timeoutMs = $exeDevice.tikzRenderTimeoutMs) {
        const normalized = $exeDevice.normalizeTikzCode(code);
        const preview = document.getElementById('elceTikzPreview');
        if (!normalized || !preview) {
            return Promise.resolve('');
        }

        // Drop any listener still pending from a manual preview render so it
        // does not also fire on our script.
        if ($exeDevice.tikzFinishedHandler) {
            preview.removeEventListener(
                'tikzjax-load-finished',
                $exeDevice.tikzFinishedHandler
            );
            $exeDevice.tikzFinishedHandler = null;
        }

        return new Promise((resolve) => {
            let settled = false;
            const finish = (svg) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                preview.removeEventListener('tikzjax-load-finished', onFinished);
                resolve(svg || '');
            };

            const timer = setTimeout(() => finish(''), timeoutMs);

            const onFinished = () => {
                const renderedSvg = preview.querySelector('svg');
                Promise.resolve(
                    renderedSvg
                        ? $exeDevice.convertTikzTextToPaths(renderedSvg)
                        : null
                )
                    .catch(() => {})
                    .then(() => {
                        const finalSvg = preview.querySelector('svg');
                        finish(
                            finalSvg ? $exeDevice.sanitizeTikzSvg(finalSvg) : ''
                        );
                    });
            };

            preview.innerHTML = '';
            preview.addEventListener('tikzjax-load-finished', onFinished);

            const tikzScript = document.createElement('script');
            tikzScript.type = 'text/tikz';
            tikzScript.dataset.texPackages = JSON.stringify({
                circuitikz: '',
                amsmath: '',
                amssymb: '',
            });
            tikzScript.dataset.showConsole = 'false';
            tikzScript.textContent =
                '\\begin{document}' + normalized + '\\end{document}';
            preview.appendChild(tikzScript);
        });
    },

    clearQuestion: function () {
        $exeDevice.invalidateTikzSvgPreview();
        $exeDevice.showOptions(4);
        $exeDevice.showSolution('');
        $('.ELCE-Times')[0].checked = true;
        $('.ELCE-Number')[2].checked = true;
        $('#elceTikzCode').val('');
        $('#elceDescription').val('');
        $('#elceTikzPreview').empty();
        $('#elceNoCircuit').show();
        $("input.ELCE-ESolution[name='slcsolution']").prop('checked', false);
        $('#elceSolutionSelect').text('');
        $('#elceQuestion').val('');
        $('#elceSolutionWord').val('');
        $('#elceDefinitionWord').val('');
        $('.ELCE-EAnwersOptions').each(function () {
            $(this).val('');
        });
        $('#elceMessageOK').val('');
        $('#elceMessageKO').val('');
    },

    showOptions: function (number) {
        $('.ELCE-EOptionDiv').each(function (i) {
            $(this).show();
            if (i >= number) {
                $(this).hide();
                $exeDevice.showSolution('');
            }
        });

        $('.ELCE-EAnwersOptions').each(function (j) {
            if (j >= number) {
                $(this).val('');
            }
        });
    },

    showSolution: function (solution) {
        $("input.ELCE-ESolution[name='slcsolution']").prop('checked', false);

        for (let i = 0; i < solution.length; i++) {
            const sol = solution[i];
            $('.ELCE-ESolution')[solution].checked = true;
            $(
                "input.ELCE-ESolution[name='slcsolution'][value='" + sol + "']"
            ).prop('checked', true);
        }
    },

    createForm: function () {
        const path = $exeDevice.idevicePath,
            html = `
            <div id="electricalCircuitsIdeviceForm">
                <p class="exe-block-info exe-block-dismissible" style="position:relative">
                    ${_('Create quiz activities based on electrical circuit diagrams drawn with TikZ.')}
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Observe the electrical circuit and answer the questions.'))}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_('Options')}</a></legend>
                        <div id="elceOptions">
                            <div class="d-flex align-items-center gap-3 mb-3" id="elceActivityMode">
                                <span>${_('Mode')}:</span>
                                <div class="form-check form-check-inline m-0">
                                    <input class="form-check-input" type="radio" name="slcactivitymode" id="elceModeTest" value="test" checked />
                                    <label class="form-check-label" for="elceModeTest">${_('Test')}</label>
                                </div>
                                <div class="form-check form-check-inline m-0">
                                    <input class="form-check-input" type="radio" name="slcactivitymode" id="elceModeShow" value="show" />
                                    <label class="form-check-label" for="elceModeShow">${_('Presentation')}</label>
                                </div>
                            </div>
                            <div class="toggle-item mb-3" data-target="elceShowMinimize">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="elceShowMinimize" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="elceShowMinimize">${_('Show minimized.')} </label>
                            </div>
                            <div class="toggle-item mb-3" data-target="elceAnswersRamdon" id="elceAnswersRamdonDiv">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="elceAnswersRamdon" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="elceAnswersRamdon">${_('Random options')}</label>
                            </div>
                            <div class="toggle-item mb-3" id="elceQuestionsRandomDiv">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="elceQuestionsRandom" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="elceQuestionsRandom">${_('Random questions')}</label>
                            </div>
                            <div class="d-flex align-items-center flex-wrap gap-2 mb-3" id="elceShowSolutionDiv">
                                <div class="toggle-item toggle-related" data-target="elceShowSolution">
                                    <span class="toggle-control">
                                        <input type="checkbox" class="toggle-input" id="elceShowSolution" checked />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="elceShowSolution">${_('Show solutions')}.</label>
                                </div>
                                <div class="mb-0 d-flex align-items-center gap-2">
                                    <input type="number" name="elceTimeShowSolution" id="elceTimeShowSolution" value="3" min="1" max="9" class="form-control" />
                                    <label for="elceTimeShowSolution">${_('Show solution time (seconds)')}</label>
                                </div>
                            </div>
                            <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                                <div class="toggle-item toggle-related" data-target="elceHasFeedBack">
                                    <span class="toggle-control">
                                        <input type="checkbox" class="toggle-input" id="elceHasFeedBack" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="elceHasFeedBack">${_('Feedback')}.</label>
                                </div>
                                <div class="mb-0 d-flex align-items-center gap-2">
                                    <input type="number" name="elcePercentajeFB" id="elcePercentajeFB" value="100" min="5" max="100" step="5" disabled class="form-control" />
                                    <label for="elcePercentajeFB">${_('&percnt; right to see the feedback')}</label>
                                </div>
                            </div>
                            <div id="elceFeedbackP" class="ELCE-EFeedbackP mb-3">
                                <textarea id="elceFeedBackEditor" class="exe-html-editor form-control" rows="4"></textarea>
                            </div>
                            <div class="d-flex align-items-center flex-wrap mb-3 gap-2">
                                <label for="elcePercentajeQuestionsValue">${_('% Questions')}:</label>
                                <input type="number" name="elcePercentajeQuestionsValue" id="elcePercentajeQuestionsValue" value="100" min="1" max="100" class="form-control" />
                                <span id="elceNumeroPercentaje" class="ms-2">1/1</span>
                            </div>
                            <div class="toggle-item mb-3" data-target="elceModeBoard" id="elceModeBoardDiv">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="elceModeBoard" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="elceModeBoard">${_('Digital whiteboard mode')}</label>
                            </div>
                            <div class="d-flex align-items-center gap-2 mb-3" id="elceGlobalTimeDiv">
                                <label for="elceGlobalTimes">${_('Time per question')}:</label>
                                <select id="elceGlobalTimes" class="form-select form-select-sm" style="max-width:10ch">
                                    <option value="0" selected>15s</option>
                                    <option value="1">30s</option>
                                    <option value="2">1m</option>
                                    <option value="3">3m</option>
                                    <option value="4">5m</option>
                                    <option value="5">10m</option>
                                </select>
                                <button id="elceGlobalTimeButton" class="btn btn-primary" type="button">${_('Accept')}</button>
                            </div>
                            <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                                <div class="toggle-item" data-target="elceEvaluation">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="elceEvaluation" class="toggle-input" aria-label="${_('Progress report')}">
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="elceEvaluation">${_('Progress report')}.</label>
                                </div>
                                <div class="d-flex align-items-center flex-nowrap gap-2 ms-2 ELCE-EEvaluationFields">
                                    <label for="elceEvaluationID" class="mb-0">${_('Identifier')}:</label>
                                    <input type="text" class="form-control" id="elceEvaluationID" disabled value="${eXeLearning.app.project.odeId || ''}" />
                                    <a href="#elceEvaluationHelp" id="elceEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                        <img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}" />
                                    </a>
                                </div>
                            </div>
                            <p id="elceEvaluationHelp" class="exe-block-info ELCE-TypeGameHelp">
                                ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                            </p>
                        </div>
                    </fieldset>
                    <fieldset class="exe-fieldset">
                        <legend><a href="#">${_('Questions')}</a></legend>
                        <div class="ELCE-EPanel" id="elcePanel">
                            <div class="ELCE-EOptionsMedia d-flex flex-nowrap align-items-center gap-2 mb-3">
                                <div class="ELCE-EOptionsGame">
                                    <div class="d-flex flex-wrap align-items-center gap-2 mb-3" id="elceTypeDiv">
                                        <span>${_('Type')}:</span>
                                        <span class="d-flex align-items-center gap-2 flex-nowrap">
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-TypeSelect form-check-input" checked id="elceTypeChoose" type="radio" name="slctypeselect" value="0"/>
                                                <label class="form-check-label" for="elceTypeChoose">${_('Select')}</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-TypeSelect form-check-input" id="elceTypeOrders" type="radio" name="slctypeselect" value="1"/>
                                                <label class="form-check-label" for="elceTypeOrders">${_('Order')}</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-TypeSelect form-check-input" id="elceTypeWord" type="radio" name="slctypeselect" value="2"/>
                                                <label class="form-check-label" for="elceTypeWord">${_('Word')}</label>
                                            </div>
                                        </span>
                                    </div>
                                    <div class="d-flex flex-wrap align-items-center gap-2 mb-3" id="elceInputNumbers">
                                        <span>${_('Options Number')}:</span>
                                        <span class="d-flex align-items-center gap-2 flex-nowrap">
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-Number form-check-input" id="numQ2" type="radio" name="slcnumber" value="2" />
                                                <label class="form-check-label" for="numQ2">2</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-Number form-check-input" id="numQ3" type="radio" name="slcnumber" value="3" />
                                                <label class="form-check-label" for="numQ3">3</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-Number form-check-input" id="numQ4" type="radio" name="slcnumber" value="4" checked="checked" />
                                                <label class="form-check-label" for="numQ4">4</label>
                                            </div>
                                         </span>
                                    </div>
                                    <div id="elcePercentageSpan" class="d-none flex-wrap align-items-center gap-2 mb-3">
                                        <span >${_('Percentage of letters to show (%)')}:</span>
                                        <span class="ELCE-EPercentage" id="elcePercentage">
                                            <input type="number" class="form-control form-control-sm"  name="elcePercentageShow" id="elcePercentageShow" value="35" min="0" max="100" step="5" />
                                        </span>
                                    </div>
                                    <div class="d-flex flex-wrap align-items-center gap-2 mb-3" id="elceTimeDiv">
                                        <span>${_('Time per question')}:</span>
                                        <span class="d-flex align-items-center gap-2 flex-nowrap">
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-Times form-check-input" checked="checked" id="q15s" type="radio" name="slctime" value="0" />
                                                <label class="form-check-label" for="q15s">15s</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-Times form-check-input" id="q30s" type="radio" name="slctime" value="1" />
                                                <label class="form-check-label" for="q30s">30s</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-Times form-check-input" id="q1m" type="radio" name="slctime" value="2" />
                                                <label class="form-check-label" for="q1m">1m</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-Times form-check-input" id="q3m" type="radio" name="slctime" value="3" />
                                                <label class="form-check-label" for="q3m">3m</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-Times form-check-input" id="q5m" type="radio" name="slctime" value="4" />
                                                <label class="form-check-label" for="q5m">5m</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-Times form-check-input" id="q10m" type="radio" name="slctime" value="5" />
                                                <label class="form-check-label" for="q10m">10m</label>
                                            </div>
                                        </span>
                                    </div>
                                    <div id="elceScoreQuestionDiv" class="ELCE-ScoreQuestionDiv align-items-center gap-2 mb-3 d-none">
                                        <label for="elceScoreQuestion">${_('Score')}:</label>
                                        <input type="number" name="elceScoreQuestion" id="elceScoreQuestion" value="1" min="0" max="100" step="0.05" class="form-control"/>
                                    </div>
                                </div>
                                <div class="ELCE-EMultiMediaOption ">
                                    <div class="ELCE-EMultimedia" id="elceMultimedia">
                                        <div id="elceTikzPreview" class="ELCE-ETikzPreview"></div>
                                        <img class="ELCE-EMedia" src="${path}quextIELCBack.png" id="elceNoCircuit" alt="${_('No circuit')}" />
                                    </div>
                                    <div id="elceTikzCodeGroup">
                                        <span id="elceTitleTikz">${_('Circuit code (TikZ)')}:</span>
                                        <div class="ELCE-ETikzInput d-flex flex-nowrap align-items-start gap-2 mb-3">
                                            <textarea id="elceTikzCode" class="form-control" rows="4" placeholder="${_('Enter TikZ circuit code…')}"></textarea>
                                            <a href="#" id="elcePreviewTikz" class="ELCE-ENavigationButton" title="${_('Preview circuit')}">
                                                <img src="${path}quextIEPlay.png" alt="${_('Preview')}" class="ELCE-ENavigationButton" />
                                            </a>
                                        </div>
                                    </div>
                                     <div class="mb-3 d-none" id="elceDescriptionDiv">
                                        <label for="elceDescription">${_('Description')}:</label>
                                        <input type="text" class="form-control" id="elceDescription" value="" />
                                    </div>
                                </div>
                            </div>
                            <div class="ELCE-EContents" id="elceContents">
                                <div id="elceSolitionOptions" class="ELCE-SolitionOptionsDiv"><span>${_('Question')}:</span><span><span>${_('Solution')}: </span><span id="elceSolutionSelect">A</span></span></div>
                                <div class="ELCE-EQuestionDiv" id="elceQuestionDiv">
                                    <label class="sr-av" for="elceQuestion">${_('Question')}:</label>
                                    <input type="text" class="ELCE-EQuestion form-control" id="elceQuestion" value="${c_('What type of circuit is shown?')}">
                                </div>
                                <div class="ELCE-EAnswers" id="elceAnswers">
                                    <div class="ELCE-EOptionDiv gap-2">
                                        <label class="sr-av" for="elceSolution0">${_('Solution')} A:</label>
                                        <input type="checkbox" class="ELCE-ESolution form-check-input me-0" name="slcsolution" id="elceSolution0" value="A" checked />
                                        <label for="elceOption0">A</label>
                                        <input type="text" class="ELCE-EOption0 ELCE-EAnwersOptions form-control" id="elceOption0" value="${c_('Series circuit')}">
                                    </div>
                                    <div class="ELCE-EOptionDiv gap-2">
                                        <label class="sr-av" for="elceSolution1">${_('Solution')} B:</label>
                                        <input type="checkbox" class="ELCE-ESolution form-check-input me-0" name="slcsolution" id="elceSolution1" value="B" />
                                        <label for="elceOption1">B</label>
                                        <input type="text" class="ELCE-EOption1 ELCE-EAnwersOptions form-control" id="elceOption1" value="${c_('Parallel circuit')}">
                                    </div>
                                    <div class="ELCE-EOptionDiv gap-2">
                                        <label class="sr-av" for="elceSolution2">${_('Solution')} C:</label>
                                        <input type="checkbox" class="ELCE-ESolution form-check-input me-0" name="slcsolution" id="elceSolution2" value="C" />
                                        <label for="elceOption2">C</label>
                                        <input type="text" class="ELCE-EOption2 ELCE-EAnwersOptions form-control" id="elceOption2" value="${c_('Mixed circuit')}">
                                    </div>
                                    <div class="ELCE-EOptionDiv gap-2">
                                        <label class="sr-av" for="elceSolution3">${_('Solution')} D:</label>
                                        <input type="checkbox" class="ELCE-ESolution form-check-input me-0" name="slcsolution" id="elceSolution3" value="D" />
                                        <label for="elceOption3">D</label>
                                        <input type="text" class="ELCE-EOption3 ELCE-EAnwersOptions form-control" id="elceOption3" value="${c_('Open circuit')}">
                                    </div>
                                </div>
                                <div class="ELCE-EWordDiv ELCE-DP" id="elceWordDiv">
                                    <div class="ELCE-ESolutionWord"><label for="elceSolutionWord">${_('Word/Phrase')}:</label><input type="text" id="elceSolutionWord" class="form-control"/></div>
                                    <div class="ELCE-ESolutionWord"><label for="elceDefinitionWord">${_('Definition')}:</label><input type="text" id="elceDefinitionWord" class="form-control"/></div>
                                </div>
                            </div>
                            <div class="ELCE-ENavigationButtons gap-2">
                                <a href="#" id="elceAdd" class="ELCE-ENavigationButton" title="${_('Add question')}"><img src="${path}quextIEAdd.png" alt="${_('Add question')}" class="ELCE-ENavigationButton" /></a>
                                <a href="#" id="elceFirst" class="ELCE-ENavigationButton" title="${_('First question')}"><img src="${path}quextIEFirst.png" alt="${_('First question')}" class="ELCE-ENavigationButton" /></a>
                                <a href="#" id="elcePrevious" class="ELCE-ENavigationButton" title="${_('Previous question')}"><img src="${path}quextIEPrev.png" alt="${_('Previous question')}" class="ELCE-ENavigationButton" /></a>
                                <label class="sr-av" for="elceNumberQuestion">${_('Question number:')}</label><input type="text" class="ELCE-NumberQuestion form-control" id="elceNumberQuestion" value="1"/>
                                <a href="#" id="elceNext" class="ELCE-ENavigationButton" title="${_('Next question')}"><img src="${path}quextIENext.png" alt="${_('Next question')}" class="ELCE-ENavigationButton" /></a>
                                <a href="#" id="elceLast" class="ELCE-ENavigationButton" title="${_('Last question')}"><img src="${path}quextIELast.png" alt="${_('Last question')}" class="ELCE-ENavigationButton" /></a>
                                <a href="#" id="elceDelete" class="ELCE-ENavigationButton" title="${_('Delete question')}"><img src="${path}quextIEDelete.png" alt="${_('Delete question')}" class="ELCE-ENavigationButton" /></a>
                                <a href="#" id="elceCopy" class="ELCE-ENavigationButton" title="${_('Copy question')}"><img src="${path}quextIECopy.png" alt="${_('Copy question')}" class="ELCE-ENavigationButton" /></a>
                                <a href="#" id="elceCut" class="ELCE-ENavigationButton" title="${_('Cut question')}"><img src="${path}quextIECut.png" alt="${_('Cut question')}" class="ELCE-ENavigationButton" /></a>
                                <a href="#" id="elcePaste" class="ELCE-ENavigationButton" title="${_('Paste question')}"><img src="${path}quextIEPaste.png" alt="${_('Paste question')}" class="ELCE-ENavigationButton" /></a>
                            </div>
                            <div class="ELCE-ENumQuestionDiv" id="elceNumQuestionDiv">
                                <div class="ELCE-ENumQ"><span class="sr-av">${_('Number of questions:')}</span></div> <span class="ELCE-ENumQuestions" id="elceNumQuestions">0</span>
                            </div>
                        </div>
                    </fieldset>
                    ${$exeDevicesEdition.iDevice.common.getTextFieldset('after')}
                 </div>
                ${$exeDevicesEdition.iDevice.gamification.itinerary.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.scorm.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
                ${$exeDevicesEdition.iDevice.gamification.share.getTabIA(11)}

            </div>`;

        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('electricalCircuitsIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();

        $exeDevice.enableForm();
    },

    initQuestions: function () {


        if ($exeDevice.selectsGame.length == 0) {
            const question = $exeDevice.getCuestionDefault();
            $exeDevice.selectsGame.push(question);
            this.showOptions(4);
            this.showSolution('');
        }
        $exeDevice.showTypeQuestion(0);
        this.active = 0;
    },

    defaultTikzCode: '\\begin{circuitikz}\\draw  (0,0) to[battery1, l=$V$] (0,3) to[short] (3,3) to[R, l=$R_1$] (3,1.5)  to[R, l=$R_2$] (3,0)  to[short] (0,0); \\end{circuitikz}',

    getCuestionDefault: function () {
        const p = {
            typeSelect: 0,
            time: 0,
            numberOptions: 4,
            tikzCode: $exeDevice.defaultTikzCode,
            tikzSvg: '',
            quextion: c_('What type of circuit is shown?'),
            options: [c_('Series circuit'), c_('Parallel circuit'), c_('Mixed circuit'), c_('Open circuit')],
            solution: 'A',
            solutionQuestion: '',
            percentageShow: 35,
            description: c_('Circuit with a battery connected in series with two resistors')
        };
        return p;
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            $exeDevice.active = 0;

            const wrapper = $('<div></div>').html(originalHTML),
                json = $exeDevices.iDevice.gamification.helpers.decrypt(
                    $('.electrical-circuits-DataGame', wrapper).text()
                ),
                dataGame =
                    $exeDevices.iDevice.gamification.helpers.isJsonString(json);
            if (dataGame) {
                $exeDevice.updateFieldGame(dataGame);

                const instructions =
                    dataGame.instructionsExe || dataGame.instructions;
                if (instructions) {
                    $exeDevice.setEditorContent('eXeGameInstructions', unescape(instructions));
                }
                const textAfter = dataGame.textAfter || '';
                if (textAfter) {
                    $exeDevice.setEditorContent('eXeIdeviceTextAfter', unescape(textAfter));
                }
                const textFeedBack = dataGame.textFeedBack || '';
                if (textFeedBack) {
                    $exeDevice.setEditorContent('elceFeedBackEditor', unescape(textFeedBack));
                }
            }
        }
    },

    updateFieldGame: function (game) {
        $exeDevicesEdition.iDevice.gamification.itinerary.setValues(
            game.itinerary
        );
        game.answersRamdon = game.answersRamdon || false;
        game.questionsRandom = game.questionsRandom || false;
        game.percentajeFB =
            typeof game.percentajeFB != 'undefined' ? game.percentajeFB : 100;
        game.feedBack =
            typeof game.feedBack != 'undefined' ? game.feedBack : false;
        game.percentajeQuestions =
            typeof game.percentajeQuestions == 'undefined'
                ? 100
                : game.percentajeQuestions;
        game.evaluation =
            typeof game.evaluation != 'undefined' ? game.evaluation : false;
        game.evaluationID =
            typeof game.evaluationID != 'undefined' ? game.evaluationID : '';
        game.weighted =
            typeof game.weighted != 'undefined' ? game.weighted : 100;
        game.globalTime =
            typeof game.globalTime != 'undefined' ? game.globalTime : 0;
        game.activityMode =
            typeof game.activityMode != 'undefined' ? game.activityMode : 'test';

        $('input[name="slcactivitymode"][value="' + game.activityMode + '"]').prop('checked', true);
        $exeDevice.toggleActivityMode(game.activityMode);

        $exeDevice.id =
            typeof game.id !== 'undefined'
                ? game.id
                : $exeDevice.getIdeviceID();

        $('#elceShowMinimize').prop('checked', game.showMinimize);
        $('#elceAnswersRamdon').prop('checked', game.answersRamdon);
        $('#elceQuestionsRandom').prop('checked', game.questionsRandom);
        $('#elceShowSolution').prop('checked', game.showSolution);
        $('#elceTimeShowSolution').prop('disabled', !game.showSolution);
        $('#elceTimeShowSolution').val(game.timeShowSolution);
        $('#elceModeBoard').prop('checked', game.modeBoard);
        $('#elceScoreQuestionDiv')
            .addClass('d-none')
            .removeClass('d-flex');
        $('#elceHasFeedBack').prop('checked', game.feedBack);
        $('#elcePercentajeFB').val(game.percentajeFB);
        $('#elcePercentajeQuestionsValue').val(game.percentajeQuestions);
        $('#elceEvaluation').prop('checked', game.evaluation);
        $('#elceEvaluationID').val(game.evaluationID);
        $('#elceGlobalTimes').val(game.globalTime);

        $('#elceEvaluationID').prop('disabled', !game.evaluation);

        for (let i = 0; i < game.selectsGame.length; i++) {
            game.selectsGame[i].typeSelect =
                typeof game.selectsGame[i].typeSelect == 'undefined'
                    ? ''
                    : game.selectsGame[i].typeSelect;
            game.selectsGame[i].solutionQuestion =
                typeof game.selectsGame[i].solutionQuestion == 'undefined'
                    ? ''
                    : game.selectsGame[i].solutionQuestion;
            game.selectsGame[i].tikzCode =
                typeof game.selectsGame[i].tikzCode == 'undefined'
                    ? ''
                    : game.selectsGame[i].tikzCode;
            game.selectsGame[i].tikzSvg =
                typeof game.selectsGame[i].tikzSvg == 'undefined'
                    ? ''
                    : game.selectsGame[i].tikzSvg;
            game.selectsGame[i].description =
                typeof game.selectsGame[i].description == 'undefined'
                    ? ''
                    : game.selectsGame[i].description;
        }
        if (game.feedBack) {
            $('#elceFeedbackP').show();
        } else {
            $('#elceFeedbackP').hide();
        }
        $('#elcePercentajeFB').prop('disabled', !game.feedBack);
        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted
        );
        $exeDevice.selectsGame = game.selectsGame;
        $exeDevice.updateSelectOrder();
        $exeDevice.showQuestion($exeDevice.active);
    },

    escapeHtml: function (string) {
        return String(string)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    save: function () {
        if (!$exeDevice.validateQuestion()) {
            return false;
        }

        const dataGame = this.validateData();
        if (!dataGame) {
            return false;
        }

        $exeDevicesEdition.iDevice.gamification.helpers.stopSound();

        const fields = this.ci18n;
        const i18n = { ...fields };

        for (let key in fields) {
            const fVal = $('#ci18n_' + key).val();
            if (fVal !== '') {
                i18n[key] = fVal;
            }
        }

        dataGame.msgs = i18n;

        const json = JSON.stringify(dataGame),
            instructions = $exeDevice.getEditorContent('eXeGameInstructions');

        let divContent = '';
        if (instructions !== '') {
            divContent = `<div class="electrical-circuits-instructions SLCNP-instructions">${instructions}</div>`;
        }

        const textFeedBack = $exeDevice.getEditorContent('elceFeedBackEditor');

        let html = '<div class="electrical-circuits-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html += divContent;
        html += `<div class="electrical-circuits-version js-hidden">${$exeDevice.version}</div>`;
        html += `<div class="electrical-circuits-feedback-game">${textFeedBack}</div>`;
        html += `<div class="electrical-circuits-DataGame js-hidden">${$exeDevices.iDevice.gamification.helpers.encrypt(json)}</div>`;

        const textAfter = $exeDevice.getEditorContent('eXeIdeviceTextAfter');
        if (textAfter !== '') {
            html += `<div class="electrical-circuits-extra-content">${textAfter}</div>`;
        }

        html += `<div class="electrical-circuits-bns js-hidden">${$exeDevice.msgs.msgNoSuportBrowser}</div>`;
        html += '</div>';

        return html;
    },

    validateQuestion: function () {
        const msgs = $exeDevice.msgs;
        const activityMode = $('input[name="slcactivitymode"]:checked').val() || 'test';
        let p = {},
            message = '';

        p.time = parseInt($('input[name=slctime]:checked').val());
        p.numberOptions = parseInt($('input[name=slcnumber]:checked').val());
        p.typeSelect = parseInt($('input[name=slctypeselect]:checked').val());
        p.customScore = parseFloat($('#elceScoreQuestion').val()) || 1;
        p.tikzCode = $exeDevice.normalizeTikzCode($('#elceTikzCode').val());
        p.tikzSvg = $exeDevice.getRenderedTikzSvgForCode(p.tikzCode);
        p.description = $('#elceDescription').val().trim();

        $exeDevicesEdition.iDevice.gamification.helpers.stopSound();

        p.quextion = $('#elceQuestion').val().trim();
        p.options = [];
        p.solution = $('#elceSolutionSelect').text().trim();
        p.solutionQuestion = '';

        if (p.typeSelect == 2) {
            p.quextion = $('#elceDefinitionWord').val().trim();
            p.solution = '';
            p.solutionQuestion = $('#elceSolutionWord').val();
        }

        p.percentageShow = parseInt($('#elcePercentageShow').val());

        let optionEmpy = false;
        $('.ELCE-EAnwersOptions').each(function (i) {
            let option = $(this).val().trim();
            if (i < p.numberOptions && option.length == 0) {
                optionEmpy = true;
            }
            if (p.typeSelect == 2) {
                option = '';
            }
            p.options.push(option);
        });

        if (p.tikzCode.length > 0 && p.tikzSvg.length == 0) {
            message = msgs.msgERenderCircuitPreview;
        } else if (activityMode === 'test') {
            if (p.typeSelect == 1 && p.solution.length != p.numberOptions) {
                message = msgs.msgTypeChoose;
            } else if (p.typeSelect != 2 && p.quextion.length == 0) {
                message = msgs.msgECompleteQuestion;
            } else if (p.typeSelect != 2 && optionEmpy) {
                message = msgs.msgECompleteAllOptions;
            } else if (p.typeSelect == 2 && p.solutionQuestion.trim().length == 0) {
                message = $exeDevice.msgs.msgEProvideWord;
            } else if (p.typeSelect == 2 && p.quextion.trim().length == 0) {
                message = $exeDevice.msgs.msgEDefintion;
            }
        }

        if (message.length == 0) {
            $exeDevice.selectsGame[$exeDevice.active] = p;
            message = true;
        } else {
            $exeDevice.showMessage(message);
            message = false;
        }

        return message;
    },



    getIdeviceID: function () {
        const ideviceid =
            $('#electricalCircuitsIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';

        return ideviceid;
    },

    exportQuestions: function () {
        const dataGame = this.validateData();
        if (!dataGame) return false;

        const lines = this.getLinesQuestions(dataGame.selectsGame);
        const fileContent = lines.join('\n');
        const newBlob = new Blob([fileContent], { type: 'text/plain' });
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveOrOpenBlob(newBlob);
            return;
        }
        const data = window.URL.createObjectURL(newBlob);
        const link = document.createElement('a');
        link.href = data;
        link.download = `${_('test')}.txt`;

        document.getElementById('electricalCircuitsIdeviceForm').appendChild(link);
        link.click();
        setTimeout(() => {
            document
                .getElementById('electricalCircuitsIdeviceForm')
                .removeChild(link);
            window.URL.revokeObjectURL(data);
        }, 100);
    },

    getLinesQuestions: function (questions) {
        let linequestions = [];
        for (let i = 0; i < questions.length; i++) {
            let q = questions[i];
            let question = '';
            if (q.typeSelect !== 2) {
                question = `${q.solution}#${q.quextion}`;
                for (let j = 0; j < q.options.length; j++) {
                    if (q.options[j]) {
                        question += `#${q.options[j]}`;
                    }
                }
            } else {
                question = `${q.solutionQuestion}#${q.quextion}`;
            }

            linequestions.push(question);
        }
        return linequestions;
    },

    validateData: function () {
        const clear = $exeDevice.removeTags,
            activityMode = $('input[name="slcactivitymode"]:checked').val() || 'test',
            instructions = $('#eXeGameInstructions').text(),
            instructionsExe = escape(
                $exeDevice.getEditorContent('eXeGameInstructions')
            ),
            textAfter = escape($exeDevice.getEditorContent('eXeIdeviceTextAfter')),
            textFeedBack = escape(
                $exeDevice.getEditorContent('elceFeedBackEditor')
            ),
            showMinimize = $('#elceShowMinimize').is(':checked'),
            modeBoard = $('#elceModeBoard').is(':checked'),
            answersRamdon = $('#elceAnswersRamdon').is(':checked'),
            questionsRandom = $('#elceQuestionsRandom').is(':checked'),
            showSolution = $('#elceShowSolution').is(':checked'),
            timeShowSolution = parseInt(
                clear($('#elceTimeShowSolution').val())
            ),
            itinerary =
                $exeDevicesEdition.iDevice.gamification.itinerary.getValues(),
            feedBack = $('#elceHasFeedBack').is(':checked'),
            percentajeFB = parseInt(clear($('#elcePercentajeFB').val())),
            percentajeQuestions = parseInt(
                clear($('#elcePercentajeQuestionsValue').val())
            ),
            evaluation = $('#elceEvaluation').is(':checked'),
            evaluationID = $('#elceEvaluationID').val(),
            id = $exeDevice.getIdeviceID(),
            globalTime = parseInt($('#elceGlobalTimes').val(), 10);

        if (!itinerary) return false;

        if (activityMode === 'test') {
            if (feedBack && textFeedBack.trim().length == 0) {
                eXe.app.alert($exeDevice.msgs.msgProvideFB);
                return false;
            }
            if (showSolution && timeShowSolution.length == 0) {
                $exeDevice.showMessage($exeDevice.msgs.msgEProvideTimeSolution);
                return false;
            }
            if (evaluation && evaluationID.length < 5) {
                eXe.app.alert($exeDevice.msgs.msgIDLenght);
                return false;
            }
        }
        const selectsGame = $exeDevice.selectsGame;

        for (let i = 0; i < selectsGame.length; i++) {
            const mquestion = selectsGame[i],
                tikzCode = (mquestion.tikzCode || '').trim(),
                tikzSvg = (mquestion.tikzSvg || '').trim();

            if (tikzCode.length > 0 && tikzSvg.length == 0) {
                $exeDevice.showMessage($exeDevice.msgs.msgERenderCircuitPreview);
                return false;
            }
        }

        if (activityMode === 'test') {
            for (let i = 0; i < selectsGame.length; i++) {
                let mquestion = selectsGame[i];
                mquestion.customScore =
                    typeof mquestion.customScore == 'undefined'
                        ? 1
                        : mquestion.customScore;
                if (mquestion.quextion.length == 0) {
                    $exeDevice.showMessage($exeDevice.msgs.msgECompleteQuestion);
                    return false;
                }
                if (mquestion.typeSelect == 2) {
                    if (mquestion.solutionQuestion.length == 0) {
                        $exeDevice.showMessage($exeDevice.msgs.msgProvideSolution);
                        return false;
                    }
                } else {
                    let completAnswer = true;
                    for (let j = 0; j < mquestion.numberOptions; j++) {
                        if (mquestion.options[j].length == 0) {
                            completAnswer = false;
                        }
                    }
                    if (!completAnswer) {
                        $exeDevice.showMessage(
                            $exeDevice.msgs.msgECompleteAllOptions
                        );
                        return false;
                    }
                }
            }
        }

        const scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();
        return {
            asignatura: '',
            author: '',
            typeGame: 'ElectricalCircuits',
            activityMode: activityMode,
            instructionsExe: instructionsExe,
            instructions: instructions,
            showMinimize: showMinimize,
            answersRamdon: answersRamdon,
            questionsRandom: questionsRandom,
            showSolution: showSolution,
            timeShowSolution: timeShowSolution,
            useLives: false,
            numberLives: 3,
            itinerary: itinerary,
            selectsGame: selectsGame,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted || 100,
            title: '',
            customScore: false,
            textAfter: textAfter,
            textFeedBack: textFeedBack,
            gameMode: 1,
            feedBack: feedBack,
            percentajeFB: percentajeFB,
            version: 3.1,
            percentajeQuestions: percentajeQuestions,
            modeBoard: modeBoard,
            evaluation: evaluation,
            evaluationID: evaluationID,
            id: id,
            globalTime: globalTime,
        };
    },

    removeTags: function (str) {
        return $('<div></div>').html(str).text();
    },

    showTypeQuestion: function (type) {
        if (type == 2) {
            $('#elceAnswers').hide();
            $('#elceQuestionDiv')
                .removeClass('d-flax')
                .addClass('d-none');
            $('#electricalCircuitsIdeviceForm .ELCE-ESolutionSelect').hide();
            $('#elceInputNumbers')
                .removeClass('d-flax')
                .addClass('d-none');
            $('#elceSolitionOptions')
                .removeClass('d-flax')
                .addClass('d-none');
            $('#elcePercentageSpan')
                .removeClass('d-none')
                .addClass('d-flex');
            $('#elcePercentage').removeClass('d-none').addClass('d-flex');
            $('#elceWordDiv').show();
        } else {
            $('#elceAnswers').show();
            $('#elceQuestionDiv')
                .removeClass('d-none')
                .addClass('d-flex');
            $('#electricalCircuitsIdeviceForm .ELCE-ESolutionSelect').show();
            $('#elceInputNumbers')
                .removeClass('d-none')
                .addClass('d-flex');
            $('#elceSolitionOptions')
                .removeClass('d-none')
                .addClass('d-flex');
            $('#elcePercentageSpan')
                .removeClass('d-flax')
                .addClass('d-none');
            $('#elcePercentage').removeClass('d-flax').addClass('d-none');
            $('#elceWordDiv').hide();
        }
    },

    addEvents: function () {
        const $elcePaste = $('#elcePaste'),
            $elceTimeShowSolution = $('#elceTimeShowSolution'),
            $elceShowSolution = $('#elceShowSolution'),
            $elcePercentajeQuestions = $(
                '#elcePercentajeQuestionsValue'
            ),
            $elceNumberQuestion = $('#elceNumberQuestion'),
            $electricalCircuitsForm = $('#electricalCircuitsIdeviceForm');

        $elcePaste.hide();

        // Activity mode (Test / Show)
        $('#elceModeTest, #elceModeShow').on('click', function () {
            $exeDevice.toggleActivityMode($(this).val());
        });

        // Toggle switch delegation
        $electricalCircuitsForm.on(
            'click.qq.toggle',
            '.toggle-item',
            function (e) {
                if (
                    $(e.target).is(
                        'input.toggle-input, label[for], input[type=number], input[type=text], select, textarea, button'
                    )
                )
                    return;
                if (
                    $(e.target).is('#elceEvaluationID') ||
                    $(e.target).closest('#elceEvaluationHelpLnk').length
                )
                    return;
                const $input = $(this).find('input.toggle-input').first();
                if ($input.length) {
                    const newVal = !$input.prop('checked');
                    $input.prop('checked', newVal).trigger('change');
                }
            }
        );

        $electricalCircuitsForm.on(
            'click',
            '#elceEvaluationID',
            function (e) {
                e.stopPropagation();
            }
        );
        $electricalCircuitsForm.on(
            'click',
            '#elceEvaluationHelpLnk, #elceEvaluationHelpLnk *',
            function (e) {
                e.stopPropagation();
            }
        );

        $('#elceShowCodeAccess').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#elceCodeAccess, #elceMessageCodeAccess').prop(
                'disabled',
                !marcado
            );
        });

        $('.ELCE-EPanel').on('click', 'input.ELCE-TypeSelect', function () {
            const type = parseInt($(this).val(), 10);
            $exeDevice.showTypeQuestion(type);
        });

        $('.ELCE-EPanel').on('click', 'input.ELCE-Number', function () {
            const number = parseInt($(this).val(), 10);
            $exeDevice.showOptions(number);
        });

        $('#elceAdd').on('click', (e) => {
            e.preventDefault();
            $exeDevice.addQuestion();
        });

        $('#elceFirst').on('click', (e) => {
            e.preventDefault();
            $exeDevice.firstQuestion();
        });

        $('#elcePrevious').on('click', (e) => {
            e.preventDefault();
            $exeDevice.previousQuestion();
        });

        $('#elceNext').on('click', (e) => {
            e.preventDefault();
            $exeDevice.nextQuestion();
        });

        $('#elceLast').on('click', (e) => {
            e.preventDefault();
            $exeDevice.lastQuestion();
        });

        $('#elceDelete').on('click', (e) => {
            e.preventDefault();
            $exeDevice.removeQuestion();
        });

        $('#elceCopy').on('click', (e) => {
            e.preventDefault();
            $exeDevice.copyQuestion();
        });

        $('#elceCut').on('click', (e) => {
            e.preventDefault();
            $exeDevice.cutQuestion();
        });

        $('#elcePaste').on('click', (e) => {
            e.preventDefault();
            $exeDevice.pasteQuestion();
        });

        $('#elceGlobalTimeButton').on('click', (e) => {
            e.preventDefault();
            const selectedTime = parseInt(
                $('#elceGlobalTimes').val(),
                10
            );
            for (let i = 0; i < $exeDevice.selectsGame.length; i++) {
                $exeDevice.selectsGame[i].time = selectedTime;
            }
            $(
                `input.ELCE-Times[name='slctime'][value='${selectedTime}']`
            ).prop('checked', true);
        });

        // TikZ preview button
        $('#elcePreviewTikz').on('click', (e) => {
            e.preventDefault();
            $exeDevice.renderTikzPreview();
        });
        $('#elceTikzCode').on('input', () => {
            $exeDevice.invalidateTikzSvgPreview();
        });

        $elceTimeShowSolution
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 1);
                this.value = v;
            })
            .on('focusout', function () {
                let val = parseInt(this.value.trim() || 3, 10);
                val = Math.max(1, Math.min(val, 9));
                this.value = val;
            });

        $('#elcePercentageShow')
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 3);
                this.value = v;
            })
            .on('focusout', function () {
                let val = parseInt(this.value.trim() || 35, 10);
                val = Math.max(0, Math.min(val, 100));
                this.value = val;
            });

        $('#elceScoreQuestion').on('focusout', function () {
            if (!$exeDevice.validateScoreQuestion($(this).val())) {
                $(this).val(1);
            }
        });

        if (
            window.File &&
            window.FileReader &&
            window.FileList &&
            window.Blob
        ) {
            $('#eXeGameExportImport .exe-field-instructions')
                .eq(0)
                .text(`${_('Supported formats')}: txt, xml(Moodle)`);
            $('#eXeGameExportImport').show();
            $('#eXeGameImportGame')
                .attr('accept', '.txt, .xml')
                .on('change', function (e) {
                    const file = e.target.files[0];
                    if (!file) {
                        $exeDevice.showMessage(
                            `${_('Select a file')} (txt, xml(Moodle))`
                        );
                        return;
                    }
                    if (
                        !file.type ||
                        !(
                            file.type.match('text/plain') ||
                            file.type.match('application/json') ||
                            file.type.match('application/xml') ||
                            file.type.match('text/xml')
                        )
                    ) {
                        $exeDevice.showMessage(
                            `${_('Select a file')} (txt, xml(Moodle))`
                        );
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        $exeDevice.importGame(e.target.result, file.type);
                    };
                    reader.readAsText(file);
                });
            $('#eXeGameExportQuestions').on('click', () => {
                $exeDevice.exportQuestions();
            });
        } else {
            $('#eXeGameExportImport').hide();
        }


        $elceShowSolution.on('change', function () {
            const marcado = $(this).is(':checked');
            $elceTimeShowSolution.prop('disabled', !marcado);
        });

        $('.ELCE-ESolution').on('change', function () {
            const marcado = $(this).is(':checked'),
                value = $(this).val();
            $exeDevice.clickSolution(marcado, value);
        });

        $('#elceHasFeedBack').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#elceFeedbackP').slideToggle(marcado);
            $('#elcePercentajeFB').prop('disabled', !marcado);
        });

        $elcePercentajeQuestions
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 3);
                this.value = v;
                if (this.value > 0 && this.value <= 100) {
                    $exeDevice.updateQuestionsNumber();
                }
            })
            .on('click', function () {
                $exeDevice.updateQuestionsNumber();
            })
            .on('focusout', function () {
                let val = parseInt(this.value.trim() || 100, 10);
                val = Math.max(1, Math.min(val, 100));
                this.value = val;
                $exeDevice.updateQuestionsNumber();
            });

        $elceNumberQuestion.on('keyup', function (e) {
            if (e.keyCode === 13) {
                const num = parseInt($(this).val(), 10);
                if (!isNaN(num) && num > 0) {
                    if ($exeDevice.validateQuestion()) {
                        $exeDevice.active = Math.min(
                            num - 1,
                            $exeDevice.selectsGame.length - 1
                        );
                        $exeDevice.showQuestion($exeDevice.active);
                    } else {
                        $(this).val($exeDevice.active + 1);
                    }
                } else {
                    $(this).val($exeDevice.active + 1);
                }
            }
        });

        $('#elceEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#elceEvaluationID').prop('disabled', !marcado);
        });

        $('#elceEvaluationHelpLnk').on('click', function () {
            $('#elceEvaluationHelp').toggle();
            return false;
        });

        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();
        $exeDevicesEdition.iDevice.gamification.share.addEvents(
            11,
            $exeDevice.insertAIQuestions
        );

        //eXe 3.0 Dismissible messages
        $('.exe-block-dismissible .exe-block-close').on('click', function () {
            $(this).parent().fadeOut();
            return false;
        });
    },



    clickSolution: function (checked, value) {
        let solutions = $('#elceSolutionSelect').text();
        if (checked) {
            if (solutions.indexOf(value) == -1) {
                solutions += value;
            }
        } else {
            solutions = solutions.split(value).join('');
        }
        $('#elceSolutionSelect').text(solutions);
    },

    validateScoreQuestion: function (text) {
        const isValid =
            text.length > 0 &&
            text !== '.' &&
            text !== ',' &&
            /^-?\d*[.,]?\d*$/.test(text);
        return isValid;
    },


    importMoodle(xmlString) {
        const xmlDoc = $.parseXML(xmlString),
            $xml = $(xmlDoc);
        if ($xml.find('GLOSSARY').length > 0) {
            $exeDevice.importGlosary(xmlString);
        } else if ($xml.find('quiz').length > 0) {
            $exeDevice.importCuestionaryXML(xmlString);
        } else {
            eXe.app.alert(_('Sorry, wrong file format'));
        }
    },

    importGame: function (content, filetype) {
        const game =
            $exeDevices.iDevice.gamification.helpers.isJsonString(content);

        if (content && content.includes('\u0000')) {
            $exeDevice.showMessage(_('Sorry, wrong file format'));
            return;
        } else if (!game && content) {
            if (filetype.match('text/plain')) {
                $exeDevice.importText(content);
            } else if (
                filetype.match('application/xml') ||
                filetype.match('text/xml')
            ) {
                $exeDevice.importMoodle(content);
            } else {
                eXe.app.alert(_('Sorry, wrong file format'));
            }
            return;
        } else if (!game || typeof game.typeGame === 'undefined') {
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
            return;
        } else if (game.typeGame === 'ElectricalCircuits' || game.typeGame === 'Selecciona') {
            game.id = $exeDevice.getIdeviceID();
            $exeDevice.active = 0;
            $exeDevice.updateFieldGame(game);
            const instructions = game.instructionsExe || game.instructions,
                tAfter = game.textAfter || '',
                textFeedBack = game.textFeedBack || '';
            $exeDevice.setEditorContent('eXeGameInstructions', unescape(instructions));
            $exeDevice.setEditorContent('eXeIdeviceTextAfter', unescape(tAfter));
            $exeDevice.setEditorContent('elceFeedBackEditor', unescape(textFeedBack));
        } else if (game.typeGame === 'QuExt') {
            $exeDevice.selectsGame = $exeDevice.importQuExt(game);
        } else if (game.typeGame === 'Rosco' || game.typeGame === 'Adivina') {
            $exeDevice.selectsGame = $exeDevice.importRosco(game);
        } else {
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
            return;
        }

        $exeDevice.active = 0;
        $exeDevice.showQuestion($exeDevice.active);
        $exeDevice.deleteEmptyQuestion();
        $exeDevice.updateQuestionsNumber();
        $exeDevice.updateSelectOrder();
    },

    importCuestionaryXML: function (xmlText) {
        const parser = new DOMParser(),
            xmlDoc = parser.parseFromString(xmlText, 'text/xml');

        if ($(xmlDoc).find('parsererror').length > 0) {
            return false;
        }

        const quiz = $(xmlDoc).find('quiz').first();
        if (quiz.length === 0) {
            return false;
        }

        const questions = quiz.find('question'),
            questionsJson = [];
        for (let i = 0; i < questions.length; i++) {
            const question = questions[i],
                type = $(question).attr('type');

            if (
                ![
                    'multichoice',
                    'truefalse',
                    'numerical',
                    'shortanswer',
                ].includes(type)
            ) {
                continue;
            }

            const typeSelect = type === 'shortanswer' ? 2 : 0,
                questionText = $(question).find('questiontext').first().text(),
                answers = $(question).find('answer');
            let options = [],
                solution = '',
                solutionQuestion = '';

            if (typeSelect === 0) {
                for (let j = 0; j < answers.length; j++) {
                    const answer = answers[j],
                        answerHtml = $exeDevice.removeTags(
                            $(answer).find('text').eq(0).text().trim()
                        ),
                        answerText = answerHtml.split('\n')[0].trim();
                    options.push(answerText);
                    if (parseFloat($(answer).attr('fraction')) > 0) {
                        solution += String.fromCharCode(65 + j);
                    }
                }
            } else if (typeSelect === 2) {
                let maxFraction = -1;
                for (let j = 0; j < answers.length; j++) {
                    const answer = answers[j],
                        answerHtml = $(answer).find('text').eq(0).text().trim(),
                        answerText = answerHtml.split('\n')[0].trim(),
                        currentFraction = parseFloat(
                            $(answer).attr('fraction')
                        );
                    if (currentFraction > maxFraction) {
                        maxFraction = currentFraction;
                        solutionQuestion = answerText;
                    }
                }
            }

            questionsJson.push({
                typeSelect,
                question: $exeDevice.removeTags(questionText.trim()),
                options,
                solution,
                solutionQuestion,
            });
        }

        let questionsj = [];
        questionsJson.forEach((question) => {
            const p = $exeDevice.getCuestionDefault();
            p.typeSelect = question.typeSelect;
            if (p.typeSelect === 0) {
                p.quextion = question.question;
                p.options[0] = question.options[0] || '';
                p.options[1] = question.options[1] || '';
                p.options[2] = question.options[2] || '';
                p.options[3] = question.options[3] || '';
                p.solution = question.solution;
                p.numberOptions = question.options.length;
                if (p.numberOptions === 2) {
                    p.options[0] =
                        p.options[0] === 'true' ? _('True') : p.options[0];
                    p.options[0] =
                        p.options[0] === 'false' ? _('False') : p.options[0];
                    p.options[1] =
                        p.options[1] === 'true' ? _('True') : p.options[1];
                    p.options[1] =
                        p.options[1] === 'false' ? _('False') : p.options[1];
                }
                if (question.question && question.options.length > 1) {
                    questionsj.push(p);
                }
            } else if (p.typeSelect === 2) {
                p.quextion = question.question;
                p.solutionQuestion = question.solutionQuestion;
                p.percentageShow = 35;
                if (question.question && question.solutionQuestion) {
                    questionsj.push(p);
                }
            }
        });

        $exeDevice.addQuestions(questionsj);
    },

    importGlosary: function (xmlText) {
        const parser = new DOMParser(),
            xmlDoc = parser.parseFromString(xmlText, 'text/xml'),
            $xml = $(xmlDoc);

        if ($xml.find('parsererror').length > 0) {
            return false;
        }

        const $entries = $xml.find('ENTRIES').first();
        if ($entries.length === 0) {
            return false;
        }

        const questionsJson = [];
        $entries.find('ENTRY').each(function () {
            const $this = $(this),
                concept = $this.find('CONCEPT').text(),
                definition = $this
                    .find('DEFINITION')
                    .text()
                    .replace(/<[^>]*>/g, '');
            if (concept && definition) {
                questionsJson.push({
                    solution: concept,
                    question: definition,
                });
            }
        });

        let questionsj = [];
        questionsJson.forEach((question) => {
            const p = $exeDevice.getCuestionDefault();
            p.typeSelect = 2;
            p.quextion = question.question;
            p.solutionQuestion = question.solution;
            p.percentageShow = 35;
            if (p.quextion.length > 0 && p.solutionQuestion.length > 0) {
                questionsj.push(p);
            }
        });

        $exeDevice.addQuestions(questionsj);
    },

    importText: function (content) {
        const lines = content.split('\n');
        $exeDevice.insertQuestions(lines);
    },

    // Pure parser shared by the file-import path (insertQuestions) and the AI
    // save path (insertAIQuestions). Returns the parsed question objects, the
    // source line each one came from (parallel to `questions`, so a question
    // that later fails to render can be put back verbatim for the user to fix),
    // and the lines that matched no supported format.
    parseAIQuestions: function (lines) {
        // Format: Description#TikzCode#Solution#Question#OptionA#OptionB[#OptionC][#OptionD]
        const lineFormat =
                /^([^#]+)#([^#]+)#([0-3]|[ABCD]{1,4})#([^#]+)#([^#]+)#([^#]+)(#([^#]*))?(#([^#]*))?$/i,
            lineFormat1 = /^([^#]+)#([^#]+)$/;
        const questions = [],
            sourceLines = [],
            invalidLines = [];

        (lines || []).forEach((line) => {
            if (typeof line !== 'string' || line.trim().length === 0) {
                return;
            }
            const trimmed = line.trim();
            const p = $exeDevice.getCuestionDefault();
            if (lineFormat.test(line)) {
                const linarray = trimmed.split('#'),
                    description = linarray[0],
                    tikzCode = linarray[1],
                    solution = linarray[2];
                let solutionChar = solution;
                if (!isNaN(solution)) {
                    const index = parseInt(solution, 10),
                        letters = 'ABCD';
                    if (index >= 0 && index < letters.length) {
                        solutionChar = letters.charAt(index);
                    }
                }
                p.description = $exeDevice.normalizeVisibleCircuitText(description);
                p.tikzCode = $exeDevice.normalizeTikzCode(tikzCode);
                p.solution = solutionChar;
                p.quextion = $exeDevice.normalizeVisibleCircuitText(linarray[3]);
                p.options[0] = $exeDevice.normalizeVisibleCircuitText(linarray[4]);
                p.options[1] = $exeDevice.normalizeVisibleCircuitText(linarray[5]);
                p.options[2] = $exeDevice.normalizeVisibleCircuitText(linarray[6]);
                p.options[3] = $exeDevice.normalizeVisibleCircuitText(linarray[7]);
                p.numberOptions = linarray.length - 4;
                questions.push(p);
                sourceLines.push(trimmed);
            } else if (lineFormat1.test(line)) {
                const linarray1 = trimmed.split('#');
                p.typeSelect = 2;
                p.solutionQuestion = linarray1[0];
                p.quextion = linarray1[1];
                p.percentageShow = 35;
                if (p.quextion && p.solutionQuestion) {
                    questions.push(p);
                    sourceLines.push(trimmed);
                } else {
                    invalidLines.push(trimmed);
                }
            } else {
                invalidLines.push(trimmed);
            }
        });

        return { questions, lines: sourceLines, invalidLines };
    },

    insertQuestions: function (lines) {
        const { questions } = $exeDevice.parseAIQuestions(lines);
        $exeDevice.addQuestions(questions);
    },

    // Callback for the AI "save questions" button. Unlike insertQuestions (used
    // by file import), it renders every circuit before inserting: a blocking
    // "please wait" modal is shown while each TikZ code is compiled to SVG, and a
    // question whose circuit cannot be generated is discarded. The rejected lines
    // (verbatim, plus any that had an invalid format) are returned as
    // `remainingLines` so the shared handler can put them back in the text box
    // for the user to fix and try again. Returns { handledMessaging: true } so
    // the shared handler skips its generic alert.
    insertAIQuestions: async function (validLines, invalidLines = []) {
        const parsed = $exeDevice.parseAIQuestions(validLines);
        const remainingLines = [...(invalidLines || []), ...parsed.invalidLines];

        $exeDevice.showCircuitGenerationModal();
        try {
            const validQuestions = [];
            let isFirstRender = true;
            for (let i = 0; i < parsed.questions.length; i++) {
                const question = parsed.questions[i];
                const code = (question.tikzCode || '').trim();
                if (!code) {
                    // Word/phrase questions carry no circuit; nothing to render.
                    validQuestions.push(question);
                    continue;
                }
                // Absorb TikZJax's one-time WASM cold start on the first compiled
                // circuit so a valid circuit is not wrongly discarded on a slow
                // browser; the engine is warm for the rest.
                const timeoutMs = isFirstRender
                    ? $exeDevice.tikzColdStartTimeoutMs
                    : $exeDevice.tikzRenderTimeoutMs;
                isFirstRender = false;
                const svg = await $exeDevice.renderTikzCodeToSvg(code, timeoutMs);
                if (svg) {
                    question.tikzSvg = svg;
                    validQuestions.push(question);
                } else {
                    remainingLines.push(parsed.lines[i]);
                }
            }

            if (validQuestions.length > 0) {
                $exeDevice.addQuestions(validQuestions);
            }
        } finally {
            $exeDevice.hideCircuitGenerationModal();
        }

        if (remainingLines.length > 0) {
            $exeDevice.showMessage($exeDevice.msgs.msgEQuestionsNotAdded);
        } else {
            $exeDevice.showMessage($exeDevice.msgs.msgQuestionsAdded);
        }

        return { handledMessaging: true, remainingLines };
    },

    showCircuitGenerationModal: function () {
        const modals = window.eXeLearning?.app?.modals;
        if (modals && modals.info && typeof modals.info.show === 'function') {
            modals.info.show({
                title: $exeDevice.msgs.msgGeneratingCircuitsTitle,
                body: $exeDevice.msgs.msgGeneratingCircuits,
            });
        }
    },

    hideCircuitGenerationModal: function () {
        const modals = window.eXeLearning?.app?.modals;
        if (modals && modals.info && typeof modals.info.close === 'function') {
            modals.info.close();
        }
    },

    addQuestions: function (questions) {
        if (!questions || questions.length == 0) {
            eXe.app.alert(
                _('Sorry, there are no questions for this type of activity.')
            );
            return;
        }
        for (let i = 0; i < questions.length; i++) {
            $exeDevice.selectsGame.push(questions[i]);
        }
        $exeDevice.active = 0;
        $exeDevice.showQuestion($exeDevice.active);
        $exeDevice.deleteEmptyQuestion();
        $exeDevice.updateQuestionsNumber();
    },

    importQuExt: function (data) {
        data.questionsGame.forEach((cuestion) => {
            const p = $exeDevice.getCuestionDefault();
            p.typeSelect = 0;
            p.time = cuestion.time;
            p.numberOptions = cuestion.numberOptions;
            p.quextion = cuestion.quextion;
            p.options = [...cuestion.options];

            let numOpt = 0;
            for (let j = 0; j < p.options.length; j++) {
                if (p.options[j].trim().length === 0) {
                    p.numberOptions = numOpt;
                    break;
                }
                numOpt++;
            }

            const solution = 'ABCD';
            p.solution = solution.charAt(cuestion.solution);
            p.solutionQuestion = '';
            p.percentageShow = 35;
            $exeDevice.selectsGame.push(p);
        });
        return $exeDevice.selectsGame;
    },

    deleteEmptyQuestion: function () {
        if ($exeDevice.selectsGame.length > 1) {
            const quextion = $('#elceQuestion').val().trim(),
                typeSelect = parseInt(
                    $('input[name=slctypeselect]:checked').val(),
                    10
                ),
                solutionQuestion =
                    typeSelect === 2 ? $('#elceSolutionWord').val() : '';
            let shouldRemove = false;

            if (typeSelect === 2) {
                const definition = $('#elceDefinitionWord').val().trim();
                if (definition.length === 0 && solutionQuestion.length === 0) {
                    shouldRemove = true;
                }
            } else {
                let empty = true;
                $('.ELCE-EAnwersOptions').each(function () {
                    if ($(this).val().trim().length > 0) {
                        empty = false;
                    }
                });
                if (quextion.length === 0 && empty) {
                    shouldRemove = true;
                }
            }

            if (shouldRemove) {
                $exeDevice.removeQuestion();
            }
        }
    },

    importRosco: function (data) {
        for (let i = 0; i < data.wordsGame.length; i++) {
            const p = $exeDevice.getCuestionDefault();
            const cuestion = data.wordsGame[i];
            const msc = $exeDevice.msgs.msgContaint.replace(
                '%1',
                cuestion.letter
            );
            const mss = $exeDevice.msgs.msgStartWith.replace(
                '%1',
                cuestion.letter
            );
            const start = cuestion.type == 1 ? msc : mss;
            p.typeSelect = 2;
            p.time =
                cuestion.time || $exeDevice.getIndexTime(data.timeQuestion);
            p.numberOptions = 4;
            p.quextion = start + ': ' + cuestion.definition;
            p.options = ['', '', '', ''];
            p.solution = '';
            p.solutionQuestion = cuestion.word;
            p.percentageShow = cuestion.percentageShow || data.percentageShow;
            if (p.solutionQuestion.trim().length > 0) {
                $exeDevice.selectsGame.push(p);
            }
        }
        return $exeDevice.selectsGame;
    },

    getIndexTime: function (tm) {
        const tms = [15, 30, 60, 180, 300, 600, 900];
        let itm = tms.indexOf(tm);
        itm = itm < 0 ? 1 : itm;
        return itm;
    },
};
