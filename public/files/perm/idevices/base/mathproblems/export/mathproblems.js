/**
 * Math Problems (Export)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Ignacio Gros
 * Author: Manuel Narváez
 * Graphic design: Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 *
 */
/* eslint-disable no-undef */
var $eXeMathProblems = {
    idevicePath: '',
    borderColors: {
        black: '#1c1b1b',
        blue: '#5877c6',
        green: '#00a300',
        red: '#b3092f',
        white: '#ffffff',
        yellow: '#f3d55a',
    },
    colors: {
        black: '#1c1b1b',
        blue: '#dfe3f1',
        green: '#caede8',
        red: '#fbd2d6',
        white: '#ffffff',
        yellow: '#fcf4d3',
    },
    defaultSettings: {
        min: 1, // Smallest number included
        max: 100, // Highest number included
        decimals: 0, // Number of decimals
    },
    options: [],
    hasSCORMbutton: false,
    isInExe: false,
    userName: '',
    previousScore: '',
    initialScore: '',
    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',
    mScorm: null,

    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            'Math problems',
            'mathproblems',
            'mathproblems-IDevice'
        );
    },

    enable: function () {
        $eXeMathProblems.loadGame();
    },

    loadGame: function () {
        $eXeMathProblems.options = [];
        $eXeMathProblems.activities.each(function (i) {
            const dl = $('.mathproblems-DataGame', this),
                $wordings = $('.mathproblems-LinkWordings', this),
                $feedbacks = $('.mathproblems-LinkFeedBacks', this),
                mOption = $eXeMathProblems.loadDataGame(
                    dl,
                    $wordings,
                    $feedbacks
                ),
                msg = mOption.msgs.msgPlayStart;

            mOption.scorerp = 0;
            mOption.idevicePath = $eXeMathProblems.idevicePath;
            mOption.main = 'mthpMainContainer-' + i;
            mOption.idevice = 'mathproblems-IDevice';
            mOption.isScorm = mOption.scorm.isScorm;

            $eXeMathProblems.options.push(mOption);

            const mathp = $eXeMathProblems.createInterfaceMathP(i);

            dl.before(mathp).remove();

            $('#mthpGameMinimize-' + i).hide();
            $('#mthpGameContainer-' + i).hide();

            if (mOption.showMinimize) {
                $('#mthpGameMinimize-' + i)
                    .css({
                        cursor: 'pointer',
                    })
                    .show();
            } else {
                $('#mthpGameContainer-' + i).show();
            }

            $('#mthpMessageMaximize-' + i).text(msg);
            $('#mthpDivFeedBack-' + i).prepend(
                $('.mathproblems-feedback-game', this)
            );

            $eXeMathProblems.addEvents(i);

            $('#mthpDivFeedBack-' + i).hide();
            $('#mthpMainContainer-' + i).show();
        });

        let node = document.querySelector('.page-content');
        if (node)
            $exeDevices.iDevice.gamification.observers.observeResize(
                $eXeMathProblems,
                node
            );

        $exeDevices.iDevice.gamification.math.updateLatex(
            '.mathproblems-IDevice'
        );
    },

    loadDataGame: function (data, $wordings, $feedbacks) {
        const json = data.text(),
            djson = $exeDevices.iDevice.gamification.helpers.decrypt(json);

        let options =
            $exeDevices.iDevice.gamification.helpers.isJsonString(djson);

        options.hits = 0;
        options.errors = 0;
        options.score = 0;
        options.counter = 0;
        options.gameOver = false;
        options.gameStarted = false;
        options.obtainedClue = false;
        options.gameOver = false;
        if (options.version == 1) {
            for (let i = 0; i < options.questions.length; i++) {
                options.questions[i].time = options.questions[i].time * 60;
            }
        }
        options.sortAnswers =
            typeof options.sortAnswers == 'undefined' ? false : true;
        options.errorType =
            typeof options.errorType == 'undefined' ? 0 : options.errorType;
        options.errorRelative =
            typeof options.errorRelative == 'undefined'
                ? 0
                : options.errorRelative;
        options.errorAbsolute =
            typeof options.errorAbsolute == 'undefined'
                ? 0
                : options.errorAbsolute;
        options.errorRelative =
            options.version == 1 &&
            typeof options.percentajeError != 'undefined' &&
            options.percentajeError > 0
                ? options.percentajeError / 100
                : options.errorRelative;
        options.evaluation =
            typeof options.evaluation == 'undefined'
                ? false
                : options.evaluation;
        options.evaluationID =
            typeof options.evaluationID == 'undefined'
                ? ''
                : options.evaluationID;
        options.id = typeof options.id == 'undefined' ? false : options.id;
        $eXeMathProblems.setTexts(options.questions, $wordings, $feedbacks);
        $eXeMathProblems.loadProblems(options);
        options.questions =
            $exeDevices.iDevice.gamification.helpers.getQuestions(
                options.questions,
                options.percentajeQuestions
            );

        return options;
    },

    validateIntervals: function (domain) {
        const allowedCharactersRegex = /^[0-9\s\-!.]+$/;
        let dm = domain.replace(/\s+/g, ' ').trim();
        if (!allowedCharactersRegex.test(dm)) {
            return false;
        }
        const formatRegex = /^(!?-?\d+(?:\.\d+)?)(\s+-\s+!?-?\d+(?:\.\d+)?)?$/;
        let isValid = formatRegex.test(dm);
        if (isValid && dm.includes(' - ')) {
            let [start, end] = dm.split(' - ').map(Number);
            isValid = start <= end;
        }
        return isValid;
    },

    validateIntervalsWithHash: function (domain) {
        const regex =
            /^-?\d+(?:\.\d+)?\s+-\s*-?\d+(?:\.\d+)?\s*#\s*\d+(?:\.\d+)?$/;
        let dm = domain.replace(/\s+/g, ' ').trim();
        if (!regex.test(dm)) {
            return false;
        }
        if (!dm.includes(' - ')) {
            return false;
        }
        let [interval, hashNumber] = domain.split('#');
        let [start, end] = interval
            .split(' - ')
            .map((str) => Number(str.trim()));
        let hashNum = Number(hashNumber.trim());
        return start < end && hashNum > 0;
    },

    removeTrailingZeros: function (num) {
        let str = num.toString();
        if (str.includes('.')) {
            str = str.replace(/\.?0+$/, '');
        }
        return str === '' ? '0' : str;
    },

    getDecimalPlaces: function (numStr) {
        const parts = numStr.toString().split('.');
        return parts.length > 1 ? parts[1].length : 0;
    },

    processSimpleExpression: function (str) {
        const elements = str.split(/\s*,\s*/);
        let definedSet = new Set();
        let disallowed = new Set();
        elements.forEach((el) => {
            const exclude = el.startsWith('!');
            const value = exclude ? el.substring(1) : el;
            if (value.includes(' - ')) {
                if (value.includes('#')) {
                    this.processRangedExpression(value).forEach((item) =>
                        definedSet.add(item)
                    );
                } else {
                    let [startStr, endStr] = value
                        .split(' - ')
                        .map((s) => s.trim());
                    let start = Number(startStr);
                    let end = Number(endStr);

                    if (Number.isInteger(start) && Number.isInteger(end)) {
                        for (let i = start; i <= end; i++) {
                            exclude ? disallowed.add(i) : definedSet.add(i);
                        }
                    } else {
                        let decimalsStart = this.getDecimalPlaces(startStr);
                        let decimalsEnd = this.getDecimalPlaces(endStr);
                        let minDecimals = Math.max(decimalsStart, decimalsEnd);

                        let step = 1 / Math.pow(10, minDecimals);

                        for (let i = start; i <= end; i += step) {
                            let value = Number(i.toFixed(minDecimals));
                            if (value <= end) {
                                let cleanValue = Number(
                                    this.removeTrailingZeros(
                                        value.toFixed(minDecimals)
                                    )
                                );
                                exclude
                                    ? disallowed.add(cleanValue)
                                    : definedSet.add(cleanValue);
                            }
                        }
                    }
                }
            } else {
                exclude
                    ? disallowed.add(Number(value))
                    : definedSet.add(Number(value));
            }
        });
        let allowed = [...definedSet].filter((value) => !disallowed.has(value));
        if (!allowed.length) return [1];
        return allowed;
    },

    processRangedExpression: function (str) {
        let [range, stepStr] = str.split('#');
        let step = Number(stepStr);
        let [startStr, endStr] = range.split(' - ').map((s) => s.trim());
        let start = Number(startStr);
        let end = Number(endStr);
        let result = [];

        let decimalsInStep = this.getDecimalPlaces(stepStr);
        let decimalsInStart = this.getDecimalPlaces(startStr);
        let decimalsInEnd = this.getDecimalPlaces(endStr);
        let maxDecimals = Math.max(
            decimalsInStep,
            decimalsInStart,
            decimalsInEnd
        );

        for (let i = start; i <= end; i += step) {
            let value = Number(i.toFixed(maxDecimals));
            if (value <= end) {
                let cleanValue = Number(
                    this.removeTrailingZeros(value.toFixed(maxDecimals))
                );
                result.push(cleanValue);
            }
        }
        if (!result.length) return [1];
        return result;
    },

    getRandomAllowedValue: function (str) {
        const elements = str.split(/\s*,\s*/);
        let possibleValuesSet = new Set();
        let disallowedValuesSet = new Set();
        elements.forEach((element) => {
            const isDisallowed = element.startsWith('!');
            const value = isDisallowed ? element.substring(1) : element;
            if (value.includes('#')) {
                this.processRangedExpression(value).forEach((val) =>
                    isDisallowed
                        ? disallowedValuesSet.add(val)
                        : possibleValuesSet.add(val)
                );
            } else {
                this.processSimpleExpression(value).forEach((val) =>
                    isDisallowed
                        ? disallowedValuesSet.add(val)
                        : possibleValuesSet.add(val)
                );
            }
        });
        const possibleValues = [...possibleValuesSet].filter(
            (value) => !disallowedValuesSet.has(value)
        );
        if (!possibleValues.length) return 1;
        const randomIndex = Math.floor(Math.random() * possibleValues.length);
        return possibleValues[randomIndex];
    },

    loadProblems: function (options) {
        const expresion = /\{[a-zA-z]\}/g;
        for (let i = 0; i < options.questions.length; i++) {
            let text = options.questions[i].wordingseg,
                fms = options.questions[i].formula.split('|'),
                fm0 = fms[0],
                values = fm0.match(expresion),
                solutions = [],
                formula = options.questions[i].formula;

            values = $eXeMathProblems.getUniqueElements(values);

            if (values !== null && values.length > 0) {
                const data = $eXeMathProblems.checkValuesFormule(
                    formula,
                    text,
                    values,
                    options,
                    i
                );
                text = data.text;
                solutions = data.solutions;
            } else {
                let mformula = formula.split('|');
                for (let z = 0; z < mformula.length; z++) {
                    let solution = eval(mformula[z]) * 1.0;
                    solution = parseFloat(solution.toFixed(2));
                    solutions.push(solution);
                }
            }
            let wronganswer = [];
            if (solutions.length == 0) {
                solutions = '0';
            } else {
                for (let j = 0; j < solutions.length; j++) {
                    let option = $eXeMathProblems.getOptionsArray(
                        solutions[j],
                        4,
                        false
                    );
                    wronganswer.push(option);
                }
                solutions = solutions.join('|');
            }
            options.questions[i].wronganswer = wronganswer;
            options.questions[i].solution = solutions;
            options.questions[i].wording = text;
        }
    },

    getOptionsArray: function (num, numdatos) {
        let array = [num];
        let rango = Math.abs(num) * 0.3;
        while (array.length < numdatos) {
            let valor = Math.random() * (rango * 2) + num - rango;
            valor = parseFloat(valor.toFixed(2));
            if (valor !== num && !array.includes(valor)) {
                array.push(valor);
            }
        }
        let currentIndex = array.length,
            temporaryValue,
            randomIndex;
        while (0 !== currentIndex) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;
            temporaryValue = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = temporaryValue;
        }
        return array.slice(0, numdatos);
    },

    checkValuesFormule: function (formule, text, values, options, num) {
        let result = {
                formule: '',
                text: '',
                solutions: [],
            },
            solutions = [],
            mtext = text,
            nf = formule,
            isCorrectFormule = true;

        if (
            typeof options.questions[num].definedVariables != 'undefined' &&
            options.questions[num].definedVariables
        ) {
            for (let j = 0; j < values.length; j++) {
                let rg = new RegExp(values[j], 'g'),
                    number = $eXeMathProblems.getDefinidedValue(
                        values[j],
                        options.questions[num].domains
                    );
                mtext = mtext.replace(rg, number);
                nf = nf.replace(rg, number);
            }
        } else {
            for (let j = 0; j < values.length; j++) {
                let rg = new RegExp(values[j], 'g'),
                    number = $eXeMathProblems.getRandomNo(
                        options.questions[num].min,
                        options.questions[num].max,
                        options.questions[num].decimals
                    );
                mtext = mtext.replace(rg, number);
                nf = nf.replace(rg, number);
            }
        }

        let mformula = nf.split('|'),
            solution = 0;
        for (let z = 0; z < mformula.length; z++) {
            solution = eval(mformula[z]) * 1.0;
            if (isNaN(solution)) {
                isCorrectFormule = false;
                break;
            }
            solution = parseFloat(solution.toFixed(2));
            solutions.push(solution);
        }

        result.formule = formule;
        result.text = mtext;
        result.solutions = [];

        if (isCorrectFormule) {
            result.solutions = solutions;
        }

        return result;
    },
    getDefinidedValue: function (value, domains) {
        let sval = value.replace(/[{}]/g, '');
        let domain = '1';
        for (const domainObj of domains) {
            if (sval == domainObj.name) {
                domain = domainObj.value;
                break;
            }
        }
        let num = $eXeMathProblems.getRandomAllowedValue(domain);
        return num;
    },
    setTexts: function (questions, $wordings, $feedbacks) {
        for (let i = 0; i < questions.length; i++) {
            let p = questions[i];
            $eXeMathProblems.setWording(p, $wordings, i);
            $eXeMathProblems.setFeedBack(p, $feedbacks, i);
        }
    },
    setWording: function (p, $wordings, number) {
        $wordings.each(function () {
            let id = parseInt($(this).data('id'));
            if (id == number) {
                p.wording = $eXeMathProblems.clearTags($(this).html());
                p.wordingseg = p.wording;
                p.id = id;
                return;
            }
        });
    },
    setFeedBack: function (p, $feedbacks, number) {
        $feedbacks.each(function () {
            let id = parseInt($(this).data('id'));
            if (id == number) {
                p.textFeedBack = $eXeMathProblems.clearTags($(this).html());
                return;
            }
        });
    },
    clearTags: function (text) {
        let txt = text.replace(/\\"/g, '"');
        return txt;
    },
    createInterfaceMathP: function (instance) {
        const path = $eXeMathProblems.idevicePath,
            msgs = $eXeMathProblems.options[instance].msgs,
            mOptions = $eXeMathProblems.options[instance],
            html = `
            <div class="MTHP-MainContainer" id="mthpMainContainer-${instance}">
                <div class="MTHP-GameMinimize" id="mthpGameMinimize-${instance}">
                    <a href="#" class="MTHP-LinkMaximize" id="mthpLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                        <img src="${path}mthpIcon.png" class="MTHP-IconMinimize MTHP-Activo" alt="">
                        <div class="MTHP-MessageMaximize" id="mthpMessageMaximize-${instance}"></div>
                    </a>
                </div>
                <div class="MTHP-GameContainer" id="mthpGameContainer-${instance}">
                    <div class="MTHP-GameScoreBoard">
                        <div class="MTHP-GameScores">
                            <div class="exeQuextIcons exeQuextIcons-Number" title="${msgs.msgNumQuestions}"></div>
                            <p><span class="sr-av">${msgs.msgNumQuestions}: </span><span id="mthpPNumber-${instance}">0</span></p>
                            <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                            <p><span class="sr-av">${msgs.msgHits}: </span><span id="mthpPHits-${instance}">0</span></p>
                            <div class="exeQuextIcons exeQuextIcons-Error" title="${msgs.msgErrors}"></div>
                            <p><span class="sr-av">${msgs.msgErrors}: </span><span id="mthpPErrors-${instance}">0</span></p>
                            <div class="exeQuextIcons exeQuextIcons-Score" title="${msgs.msgScore}"></div>
                            <p><span class="sr-av">${msgs.msgScore}: </span><span id="mthpPScore-${instance}">0</span></p>
                        </div>
                        <div class="MTHP-LifesGame" id="mthpLifesAdivina-${instance}"></div>
                        <div class="MTHP-TimeNumber">
                            <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Time" title="${msgs.msgTime}"></div>
                            <p id="mthpPTime-${instance}" class="MTHP-PTime">00:00</p>
                            <a href="#" class="MTHP-LinkMinimize" id="mthpLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                                <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                                <div class="exeQuextIcons exeQuextIcons-Minimize MTHP-Activo"></div>
                            </a>
                            <a href="#" class="MTHP-LinkFullScreen" id="mthpLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                                <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                                <div class="exeQuextIcons exeQuextIcons-FullScreen MTHP-Activo" id="mthpFullScreen-${instance}"></div>
                            </a>
                        </div>
                    </div>
                    <div class="MTHP-ShowClue">
                        <div class="sr-av">${msgs.msgClue}</div>
                        <p class="MTHP-PShowClue MTHP-parpadea" id="mthpPShowClue-${instance}"></p>
                    </div>
                    <div class="MTHP-Multimedia" id="mthpMultimedia-${instance}"></div>
                    <div class="MTHP-Message" id="mthpMessageDiv-${instance}">
                        <div class="sr-av">${msgs.msgAuthor}:</div>
                        <p id="mthpMessage-${instance}"></p>
                    </div>
                    <div class="MTHP-DivReply" id="mthpDivReply-${instance}">
                        <a href="#" id="mthpBtnMoveOn-${instance}" title="${msgs.msgMoveOne}">
                            <strong><span class="sr-av">${msgs.msgMoveOne}</span></strong>
                            <div class="exeQuextIcons-MoveOne MTHP-Activo"></div>
                        </a>
                        <input type="text" value="" class="MTHP-EdReply form-control" id="mthpEdAnswer-${instance}" autocomplete="off">
                        <a href="#" id="mathBtnReply-${instance}" title="${msgs.msgReply}">
                            <strong><span class="sr-av">${msgs.msgReply}</span></strong>
                            <div class="exeQuextIcons-Submit MTHP-Activo"></div>
                        </a>
                    </div>
                    <div class="MTHP-DivFeedBackQ" id="mthpDivFeedBackQ-${instance}" style="display:none">
                        <input type="button" id="mthpFeedBackLink-${instance}" value="${msgs.msgFeedBack}" class="feedbackbutton">
                        <div id="mthpFeedBackMessage-${instance}" style="display:none"></div>
                    </div>
                    <div class="MTHP-Flex" id="mthpDivImgHome-${instance}">
                        <img src="${path}mthpHome.png" class="MTHP-ImagesHome" id="mthpPHome-${instance}" alt="${msgs.msgNoImage}">
                    </div>
                    <div class="MTHP-StartGame">
                        <a href="#" id="mthpStartGame-${instance}"></a>
                    </div>
                    <div class="MTHP-Cubierta" id="mthpCubierta-${instance}">
                        <div class="MTHP-CodeAccessDiv" id="mthpCodeAccessDiv-${instance}">
                            <p class="MTHP-MessageCodeAccessE" id="mthpMesajeAccesCodeE-${instance}"></p>
                            <div class="MTHP-DataCodeAccessE">
                                <label class="sr-av">${msgs.msgCodeAccess}:</label>
                                <input type="text" class="MTHP-CodeAccessE form-control" id="mthpCodeAccessE-${instance}">
                                <a href="#" id="mthpCodeAccessButton-${instance}" title="${msgs.msgSubmit}">
                                    <strong><span class="sr-av">${msgs.msgSubmit}</span></strong>
                                    <div class="exeQuextIcons-Submit MTHP-Activo"></div>
                                </a>
                            </div>
                        </div>
                        <div class="MTHP-DivFeedBack" id="mthpDivFeedBack-${instance}">
                            <input type="button" id="mthpFeedBackClose-${instance}" value="${msgs.msgClose}" class="feedbackbutton">
                        </div>
                    </div>
                </div>
            </div>
           ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}
        `;

        return html;
    },

    showQuestion: function (num, instance) {
        const mOptions = $eXeMathProblems.options[instance],
            q = mOptions.questions[num];

        $('#mthpMultimedia-' + instance).html(q.wording);
        $('#mthpFeedBackMessage-' + instance).html(q.textFeedBack);
        $('#mthpBtnReply-' + instance).prop('disabled', false);
        $('#mthpBtnMoveOn-' + instance).prop('disabled', false);
        $('#mthpEdAnswer-' + instance).prop('disabled', false);

        mOptions.counter = q.time;

        $('#mthpDivFeedBackQ-' + instance).hide();
        if (q.textFeedBack.length > 0) {
            $('#mthpDivFeedBackQ-' + instance).fadeToggle();
        }

        mOptions.activeQuestion = num;
        const html = $('#mthpMainContainer-' + instance).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);
        if (latex)
            $exeDevices.iDevice.gamification.math.updateLatex(
                '#mthpMainContainer-' + instance
            );

        mOptions.gameActived = true;
        $eXeMathProblems.showMessage(0, '', instance);
    },

    showCubiertaOptions(mode, instance) {
        if (mode === false) {
            $('#mthpCubierta-' + instance).fadeOut();
            return;
        }
        $('#mthpCodeAccessDiv-' + instance).hide();
        $('#mthpDivFeedBack-' + instance).hide();
        switch (mode) {
            case 0:
                $('#mthpCodeAccessDiv-' + instance).show();
                break;
            case 1:
                $('#mthpDivFeedBack-' + instance)
                    .find('.identifica-feedback-game')
                    .show();
                $('#mthpDivFeedBack-' + instance).css('display', 'flex');
                $('#mthpDivFeedBack-' + instance).show();
                break;
            default:
                break;
        }
        $('#mthpCubierta-' + instance).fadeIn();
    },

    hasDuplicates: function (array) {
        if (array.length == 1) return false;
        let seen = {};
        for (let i = 0; i < array.length; i++) {
            if (seen[array[i]]) {
                return true;
            }
            seen[array[i]] = true;
        }
        return false;
    },

    getUniqueElements: function (arr) {
        return Array.from(new Set(arr));
    },

    hasDuplicatesElements: function (arr) {
        return new Set(arr).size !== arr.length;
    },

    answerQuestion: function (instance) {
        let mOptions = $eXeMathProblems.options[instance],
            answord = $('#mthpEdAnswer-' + instance).val(),
            respuestas = [];

        if (answord.length == 0) {
            $eXeMathProblems.showMessage(
                1,
                mOptions.msgs.msgIndicateWord,
                instance
            );
            return;
        }

        if (!mOptions.gameActived || mOptions.gameOver) {
            return;
        }

        answord = answord.replace(',', '.');
        let answords = answord.split('|');
        for (let j = 0; j < answords.length; j++) {
            let answer = eval(answords[j]) * 1.0;
            answer = parseFloat(answer.toFixed(2));
            respuestas.push(answer);
        }

        if (
            respuestas.length > 1 &&
            $eXeMathProblems.hasDuplicatesElements(respuestas)
        ) {
            $eXeMathProblems.showMessage(
                1,
                mOptions.msgs.msgDuplicateAnswer,
                instance
            );
            return;
        }
        answord = respuestas.join('|');
        mOptions.gameActived = false;
        $('#mthpBtnReply-' + instance).prop('disabled', true);
        $('#mthpBtnMoveOn-' + instance).prop('disabled', true);
        $('#mthpEdAnswer-' + instance).prop('disabled', true);

        let correct = $eXeMathProblems.validateAnswers(answord, instance);
        $eXeMathProblems.updateScore(correct, instance);
        mOptions.activeCounter = false;
        let timeShowSolution = 1000;
        if (mOptions.showSolution) {
            timeShowSolution = mOptions.timeShowSolution * 1000;
        }

        setTimeout(function () {
            if (
                mOptions.numberQuestions - mOptions.hits - mOptions.errors <=
                0
            ) {
                $eXeMathProblems.gameOver(0, instance);
            } else {
                $eXeMathProblems.newQuestion(instance);
            }
        }, timeShowSolution);
    },

    validateAnswerUnsort: function (answords, instance) {
        let mOptions = $eXeMathProblems.options[instance],
            sSolutions =
                mOptions.questions[mOptions.activeQuestion].solution.split('|'),
            sAnswords = answords.split('|'),
            error = 0;
        for (let i = 0; i < sAnswords.length; i++) {
            let found = false;
            for (let j = 0; j < sSolutions.length; j++) {
                if (mOptions.errorType > 0) {
                    error =
                        mOptions.errorType == 1
                            ? sSolutions[j] * mOptions.errorRelative
                            : mOptions.errorAbsolute;
                }
                if (Math.abs(sAnswords[i] - sSolutions[j]) <= error) {
                    found = true;
                    sSolutions.splice(j, 1);
                    break;
                }
            }
            if (!found) {
                return false;
            }
        }
        return true;
    },

    validateAnswerSort: function (answords, instance) {
        let mOptions = $eXeMathProblems.options[instance],
            sAnswords = answords.split('|'),
            sSolutions =
                Options.questions[mOptions.activeQuestion].solution.split('|'),
            error = 0;
        for (let i = 0; i < sAnswords.length; i++) {
            if (mOptions.errorType > 0) {
                error =
                    mOptions.errorType == 1
                        ? sSolutions[i] * mOptions.errorRelative
                        : mOptions.errorAbsolute;
            }
            if (Math.abs(sAnswords[i] - sSolutions[i]) > error) {
                return false;
            }
        }
        return true;
    },

    validateAnswers: function (answords, instance) {
        let mOptions = $eXeMathProblems.options[instance];
        return mOptions.sortAnswers
            ? $eXeMathProblems.validateAnswerSort(answords, instance)
            : $eXeMathProblems.validateAnswerUnsort(answords, instance);
    },

    getRandomNo: function (from, to, decimals) {
        if (decimals != 0)
            return parseFloat((Math.random() * to + from).toFixed(decimals));
        else return Math.floor(Math.random() * to) + from;
    },

    checkClue: function (instance) {
        let mOptions = $eXeMathProblems.options[instance],
            percentageHits = (mOptions.hits / mOptions.numberQuestions) * 100,
            message = '';
        if (
            mOptions.itinerary.showClue &&
            percentageHits >= mOptions.itinerary.percentageClue
        ) {
            if (!mOptions.obtainedClue) {
                message +=
                    ' ' +
                    mOptions.msgs.msgInformation +
                    ': ' +
                    mOptions.itinerary.clueGame;
                mOptions.obtainedClue = true;
                $('#mthpPShowClue-' + instance).text(message);
            }
        }
    },

    saveEvaluation: function (instance) {
        const mOptions = $eXeMathProblems.options[instance];
        mOptions.scorerp = (10 * mOptions.hits) / mOptions.numberQuestions;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $eXeMathProblems.isInExe
        );
    },

    sendScore: function (auto, instance) {
        const mOptions = $eXeMathProblems.options[instance];

        mOptions.scorerp = (10 * mOptions.hits) / mOptions.numberQuestions;
        mOptions.previousScore = $eXeMathProblems.previousScore;
        mOptions.userName = $eXeMathProblems.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $eXeMathProblems.previousScore = mOptions.previousScore;
    },

    addEvents: function (instance) {
        const mOptions = $eXeMathProblems.options[instance];

        $('#mthpLinkMaximize-' + instance).on('click touchstart', function (e) {
            e.preventDefault();
            $('#mthpGameContainer-' + instance).show();
            $('#mthpGameMinimize-' + instance).hide();
        });

        $('#mthpLinkMinimize-' + instance).on('click touchstart', function (e) {
            e.preventDefault();
            $('#mthpGameContainer-' + instance).hide();
            $('#mthpGameMinimize-' + instance)
                .css('visibility', 'visible')
                .show();
        });

        $('#mthpLinkFullScreen-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                const element = document.getElementById(
                    'mthpGameContainer-' + instance
                );
                $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                    element,
                    instance
                );
            }
        );

        $('#mthpFeedBackClose-' + instance).on('click', function () {
            $eXeMathProblems.showCubiertaOptions(false, instance);
        });

        $('#mthpStartGame-' + instance).show();
        $('#mthpPShowClue-' + instance).text('');

        if (mOptions.itinerary.showCodeAccess) {
            $('#mthpMesajeAccesCodeE-' + instance).text(
                mOptions.itinerary.messageCodeAccess
            );
            $eXeMathProblems.showCubiertaOptions(0, instance);
        }

        $('#mthpCodeAccessButton-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $eXeMathProblems.enterCodeAccess(instance);
            }
        );

        $('#mthpCodeAccessE-' + instance).on('keydown', function (event) {
            if (event.which == 13 || event.keyCode == 13) {
                $eXeMathProblems.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        $('#mthpPNumber-' + instance).text(mOptions.numberQuestions);
        $(window).on('unload', function () {
            if (typeof $eXeMathProblems.mScorm != 'undefined') {
                $exeDevices.iDevice.gamification.scorm.endScorm(
                    $eXeMathProblems.mScorm
                );
            }
        });

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        $('#mthpInstructions-' + instance).text(mOptions.instructions);
        $('#mthpMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $eXeMathProblems.sendScore(false, instance);
                $eXeMathProblems.saveEvaluation(instance);
            });

        $('#mthpBtnMoveOn-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeMathProblems.newQuestion(instance);
        });

        $('#mathBtnReply-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeMathProblems.answerQuestion(instance);
        });

        $('#mthpEdAnswer-' + instance).on('keydown', function (event) {
            if (event.which == 13 || event.keyCode == 13) {
                $eXeMathProblems.answerQuestion(instance);
                return false;
            }
            return true;
        });

        $('#mthpStartGame-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeMathProblems.startGame(instance);
        });

        $('#mthpFeedBackLink-' + instance).on('click', function () {
            $('#mthpFeedBackMessage-' + instance).fadeToggle();
        });

        mOptions.gameStarted = false;
        $('#mthpGameContainer-' + instance)
            .find('.exeQuextIcons-Time')
            .show();
        $('#mthpPTime-' + instance).show();
        $('#mthpStartGame-' + instance).show();
        $('#mthpMultimedia-' + instance).hide();
        $('#mthpDivImgHome-' + instance).show();
        $('#mthpStartGame-' + instance).text(mOptions.msgs.msgPlayStart);
        $('#mthpDivReply-' + instance).hide();

        setTimeout(function () {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                this.isInExe
            );
        }, 500);
    },

    startGame: function (instance) {
        const mOptions = $eXeMathProblems.options[instance];

        if (mOptions.gameStarted) return;

        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.gameOver = false;
        mOptions.gameStarted = false;
        mOptions.obtainedClue = false;
        mOptions.activeCounter = true;
        mOptions.counter = 60;
        $eXeMathProblems.updateGameBoard(instance);
        $('#mthpMultimedia-' + instance).show();
        $('#mthpDivImgHome-' + instance).hide();
        $('#mthpStartGame-' + instance).hide();
        mOptions.numberQuestions = mOptions.questions.length;
        mOptions.activeQuestion = -1;
        mOptions.counter = 0;
        mOptions.gameStarted = false;
        $('#mthpPNumber-' + instance).text(mOptions.numberQuestions);
        $('#mthpDivReply-' + instance).show();

        mOptions.counterClock = setInterval(function () {
            if (mOptions.gameStarted && mOptions.activeCounter) {
                let $node = $('#mthpMainContainer-' + instance);
                let $content = $('#node-content');
                if (
                    !$node.length ||
                    ($content.length && $content.attr('mode') === 'edition')
                ) {
                    clearInterval(mOptions.counterClock);
                    return;
                }
                mOptions.counter--;
                $eXeMathProblems.uptateTime(mOptions.counter, instance);
                if (mOptions.counter <= 0) {
                    mOptions.activeCounter = false;
                    $eXeMathProblems.answerQuestion(instance);
                    let timeShowSolution = 1000;
                    if (mOptions.showSolution) {
                        timeShowSolution = mOptions.timeShowSolution * 1000;
                    }
                    setTimeout(function () {
                        if (
                            mOptions.numberQuestions -
                                mOptions.hits -
                                mOptions.errors <=
                            0
                        ) {
                            $eXeMathProblems.gameOver(0, instance);
                        } else {
                            $eXeMathProblems.newQuestion(instance);
                        }
                    }, timeShowSolution);
                    return;
                }
            }
        }, 1000);

        $eXeMathProblems.uptateTime(0, instance);
        mOptions.gameStarted = true;
        $eXeMathProblems.newQuestion(instance);
    },

    newQuestion: function (instance) {
        const mOptions = $eXeMathProblems.options[instance],
            mActiveQuestion = $eXeMathProblems.updateNumberQuestion(
                mOptions.activeQuestion,
                instance
            ),
            $mthpPNumber = $('#mthpPNumber-' + instance);

        $('#mthpEdAnswer-' + instance).val('');

        if (mActiveQuestion === null) {
            $mthpPNumber.text('0');
            $eXeMathProblems.gameOver(0, instance);
        } else {
            mOptions.counter = mOptions.questions[mActiveQuestion].time;
            $eXeMathProblems.showQuestion(mActiveQuestion, instance);
            mOptions.activeCounter = true;
            $mthpPNumber.text(mOptions.numberQuestions - mActiveQuestion);
        }

        if (mOptions.scorm.isScorm == 1) {
            if (
                mOptions.scorm.repeatActivity ||
                $eXeMathProblems.initialScore === ''
            ) {
                $eXeMathProblems.sendScore(true, instance);
            }
        }

        $eXeMathProblems.saveEvaluation(instance);
    },

    updateNumberQuestion: function (numq, instance) {
        const mOptions = $eXeMathProblems.options[instance];

        let numActiveQuestion = numq;
        numActiveQuestion++;
        if (numActiveQuestion >= mOptions.numberQuestions) return null;

        mOptions.activeQuestion = numActiveQuestion;
        return numActiveQuestion;
    },

    gameOver: function (type, instance) {
        const mOptions = $eXeMathProblems.options[instance];
        mOptions.gameStarted = false;
        mOptions.gameOver = true;

        $('#mthpDivModeBoard-' + instance).hide();
        $('#mthpDivFeedBackQ-' + instance).hide();
        $('#mthpDivReply-' + instance).hide();
        $('#mthpMultimedia-' + instance).hide();

        clearInterval(mOptions.counterClock);

        $eXeMathProblems.uptateTime(0, instance);
        if (mOptions.scorm.isScorm == 1) {
            if (
                mOptions.scorm.repeatActivity ||
                $eXeMathProblems.initialScore === ''
            ) {
                const score = (
                    (mOptions.hits * 10) /
                    mOptions.numberQuestions
                ).toFixed(2);
                $eXeMathProblems.sendScore(true, instance);
                $eXeMathProblems.initialScore = score;
            }
        }

        $eXeMathProblems.saveEvaluation(instance);
        $eXeMathProblems.showFeedBack(instance);

        $('#mthpStartGame-' + instance).show();

        let message = mOptions.msgs.msgEndGameM.replace(
            '%s',
            mOptions.score.toFixed(2)
        );
        type = mOptions.score >= 5 ? 2 : 1;

        $eXeMathProblems.showMessage(type, message, instance);
        const aa = $exeDevices.iDevice.gamification.helpers.shuffleAds(
            mOptions.questions
        );
        mOptions.questions = mOptions.optionsRamdon ? aa : mOptions.questions;
        $eXeMathProblems.loadProblems(mOptions);
    },

    enterCodeAccess: function (instance) {
        const mOptions = $eXeMathProblems.options[instance];
        if (
            mOptions.itinerary.codeAccess.toLowerCase() ==
            $('#mthpCodeAccessE-' + instance)
                .val()
                .toLowerCase()
        ) {
            $eXeMathProblems.showCubiertaOptions(false, instance);
            mOptions.gameStarted = false;
            $eXeMathProblems.startGame(instance);
        } else {
            $('#mthpMesajeAccesCodeE-' + instance)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $('#mthpCodeAccessE-' + instance).val('');
        }
    },

    uptateTime: function (tiempo, instance) {
        const mTime =
            $exeDevices.iDevice.gamification.helpers.getTimeToString(tiempo);
        $('#mthpPTime-' + instance).text(mTime);
    },

    showFeedBack: function (instance) {
        const mOptions = $eXeMathProblems.options[instance],
            puntos = (mOptions.hits * 100) / mOptions.numberQuestions;
        if (mOptions.feedBack) {
            if (puntos >= mOptions.percentajeFB) {
                $('#mthpDivFeedBack-' + instance)
                    .find('.mathproblems-feedback-game')
                    .show();
                $eXeMathProblems.showCubiertaOptions(1, instance);
            } else {
                $eXeMathProblems.showMessage(
                    1,
                    mOptions.msgs.msgTryAgain.replace(
                        '%s',
                        mOptions.percentajeFB
                    ),
                    instance
                );
            }
            if (
                $('#mthpGameContainer-' + instance).height() <
                $('#mthpCubierta-' + instance).height()
            ) {
                $('#mthpGameContainer-' + instance).height(
                    $('#mthpCubierta-' + instance).height() + 80
                );
            }
        }
    },
    updateScore: function (correctAnswer, instance) {
        const mOptions = $eXeMathProblems.options[instance];
        let message = '',
            type = 1;

        if (correctAnswer) {
            mOptions.hits++;
            type = 2;
        } else {
            mOptions.errors++;
        }

        pendientes = mOptions.numberQuestions - mOptions.errors - mOptions.hits;
        message = $eXeMathProblems.getMessageAnswer(correctAnswer, instance);
        mOptions.score = (mOptions.hits / mOptions.numberQuestions) * 10;

        if (mOptions.isScorm === 1) {
            if (
                mOptions.scorm.repeatActivity ||
                $eXeMathProblems.initialScore === ''
            ) {
                $eXeMathProblems.sendScore(true, instance);
            }
        }

        $eXeMathProblems.saveEvaluation(instance);
        $eXeMathProblems.checkClue(instance);
        $eXeMathProblems.updateGameBoard(instance);
        $eXeMathProblems.showMessage(type, message, instance);
    },

    getMessageAnswer: function (correctAnswer, instance) {
        const mOptions = $eXeMathProblems.options[instance];

        let message = $eXeMathProblems.getRetroFeedMessages(true, instance),
            q = mOptions.questions[mOptions.activeQuestion];
        if (!correctAnswer) {
            message = $eXeMathProblems.getRetroFeedMessages(false, instance);
        }
        if (mOptions.showSolution) {
            if (correctAnswer) {
                message += ' ' + mOptions.msgs.msgSolution + ': ' + q.solution;
            } else {
                message = ' ' + mOptions.msgs.msgNotCorrect + ' ' + q.solution;
            }
        }
        return message;
    },

    getRetroFeedMessages: function (iHit, instance) {
        const mOptions = $eXeMathProblems.options[instance];
        let sMessages = iHit
            ? mOptions.msgs.msgSuccesses
            : mOptions.msgs.msgFailures;
        sMessages = sMessages.split('|');
        return sMessages[Math.floor(Math.random() * sMessages.length)];
    },

    updateGameBoard(instance) {
        const mOptions = $eXeMathProblems.options[instance],
            pendientes =
                mOptions.numberQuestions - mOptions.errors - mOptions.hits,
            sscore =
                mOptions.score % 1 == 0
                    ? mOptions.score
                    : mOptions.score.toFixed(2);
        $('#mthpPHits-' + instance).text(mOptions.hits);
        $('#mthpPErrors-' + instance).text(mOptions.errors);
        $('#mthpPNumber-' + instance).text(pendientes);
        $('#mthpPScore-' + instance).text(sscore);
    },

    showMessage: function (type, message, instance) {
        const colors = [
                '#555555',
                $eXeMathProblems.borderColors.red,
                $eXeMathProblems.borderColors.green,
                $eXeMathProblems.borderColors.blue,
                $eXeMathProblems.borderColors.yellow,
            ],
            color = colors[type];
        $('#mthpMessage-' + instance).text(message);
        $('#mthpMessage-' + instance).css({
            color: color,
        });
    },
};
$(function () {
    $eXeMathProblems.init();
});
