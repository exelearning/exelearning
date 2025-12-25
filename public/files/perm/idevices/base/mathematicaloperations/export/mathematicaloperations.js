/* eslint-disable no-undef */
/**
 * Mathematical Operations activity (Export)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Ignacio Gros
 * Author: Manuel Narváez
 * Graphic design: Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 *
 */
var $eXeMathOperations = {
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
        type: 'result', // result, operator, operandA, operandB, random (to guess)
        number: 10, // Number or operations
        operations: '1111', // Add, subtract, multiply, divide,
        min: -1000, // Smallest number included
        max: 1000, // Highest number included
        decimalsInOperands: 0, // Allow decimals
        decimalsInResults: 1, // Allow decimals in results
        negative: 1, // Allow negative results
        zero: 1, // Allow zero in results
        mode: 0,
        solution: 1,
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
            'Math operations',
            'mathematicaloperations',
            'mathoperations-IDevice'
        );
    },

    enable: function () {
        $eXeMathOperations.loadGame();
    },

    loadGame: function () {
        $eXeMathOperations.options = [];
        $eXeMathOperations.activities.each(function (i) {
            const dl = $('.mathoperations-DataGame', this),
                mOption = $eXeMathOperations.loadDataGame(dl, i),
                msg = mOption.msgs.msgPlayStart;

            mOption.scorerp = 0;
            mOption.idevicePath = $eXeMathOperations.idevicePath;
            mOption.main = 'mthoMainContainer-' + i;
            mOption.idevice = 'mathoperations-IDevice';

            $eXeMathOperations.options.push(mOption);

            const matho = $eXeMathOperations.createInterfaceMathO(i);
            dl.before(matho).remove();

            $('#mthoGameMinimize-' + i).hide();
            $('#mthoGameContainer-' + i).hide();
            if (mOption.showMinimize) {
                $('#mthoGameMinimize-' + i)
                    .css({
                        cursor: 'pointer',
                    })
                    .show();
            } else {
                $('#mthoGameContainer-' + i).show();
            }

            $('#mthoMessageMaximize-' + i).text(msg);
            $('#mthoDivFeedBack-' + i).prepend(
                $('.mathoperations-feedback-game', this)
            );
            $eXeMathOperations.addEvents(i);
            $('#mthoDivFeedBack-' + i).hide();
            $eXeMathOperations.createQuestions(i);
        });

        let node = document.querySelector('.page-content');
        if (node)
            $exeDevices.iDevice.gamification.observers.observeResize(
                $eXeMathOperations,
                node
            );

        $exeDevices.iDevice.gamification.math.updateLatex(
            '.mathoperations-IDevice'
        );
    },

    loadDataGame: function (data, instance) {
        let json = data.text(),
            options =
                $exeDevices.iDevice.gamification.helpers.isJsonString(json);

        options.hits = 0;
        options.errors = 0;
        options.score = 0;
        options.counter = 0;
        options.gameOver = false;
        options.gameStarted = false;
        options.obtainedClue = false;
        options.solution =
            typeof options.solution == 'undefined' ? true : options.solution;
        options.mode = typeof options.mode == 'undefined' ? 0 : options.mode;
        options.negativeFractions =
            typeof options.negativeFractions == 'undefined'
                ? false
                : options.negativeFractions;
        options.msgs.msgFracctionNoValid =
            typeof options.msgs.msgFracctionNoValid == 'undefined'
                ? 'Escribe una fracción válida'
                : options.msgs.msgFracctionNoValid;
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
        options = $eXeMathOperations.loadQuestions(options, instance);
        options.evaluation =
            typeof options.evaluation == 'undefined'
                ? false
                : options.evaluation;
        options.evaluationID =
            typeof options.evaluationID == 'undefined'
                ? ''
                : options.evaluationID;
        options.id = typeof options.id == 'undefined' ? false : options.id;

        return options;
    },

    reloadGame: function (instance) {
        let options = $eXeMathOperations.options[instance];
        options.hits = 0;
        options.errors = 0;
        options.score = 0;
        options.counter = 0;
        options.gameOver = false;
        options.gameStarted = false;
        options.obtainedClue = false;
        options.solution =
            typeof options.solution == 'undefined' ? true : options.solution;
        options.mode = typeof options.mode == 'undefined' ? 0 : options.mode;
        options.negativeFractions =
            typeof options.negativeFractions == 'undefined'
                ? false
                : options.negativeFractions;
        options.msgs.msgFracctionNoValid =
            typeof options.msgs.msgFracctionNoValid == 'undefined'
                ? 'Escribe una fracción válida'
                : options.msgs.msgFracctionNoValid;
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
        options = $eXeMathOperations.loadQuestions(options, instance);

        $('#mthoDivFeedBack-' + instance).hide();
        $('#mthoStartGame-' + instance).hide();
        $('#mthoPShowClue-' + instance).hide();

        $eXeMathOperations.createQuestions(instance);
    },
    createQuestions: function (instance) {
        const mOptions = $eXeMathOperations.options[instance];

        let html = '';
        for (let i = 0; i < mOptions.number; i++) {
            html += $eXeMathOperations.getQuestion(
                instance,
                mOptions.type,
                i,
                mOptions.components[i][0],
                mOptions.components[i][1],
                mOptions.components[i][2],
                mOptions.components[i][3],
                mOptions.decimalsInOperands
            );
        }
        html += '<p class="MTHO-pagination">';
        html +=
            '<a id="MTHO-' +
            instance +
            '-prevLink" style="visibility:hidden" href="#" onclick="$mathoQuestions.goTo(-1,' +
            mOptions.number +
            ',' +
            instance +
            ');return false">' +
            mOptions.msgs.msgPrevious +
            '</a>';
        html +=
            '<span id="mathoPage-' + instance + '">1</span>/' + mOptions.number;
        html += ' <a id="MTHO-' + instance + '-nextLink" href="#"';
        if (mOptions.number == 1) html += ' style="visibility:hidden"';
        html +=
            ' onclick="$eXeMathOperations.goTo(1,' +
            mOptions.number +
            ',' +
            instance +
            ');return false">' +
            mOptions.msgs.msgNext +
            '</a> ';
        html += '</p>';
        html += '<table id="mathoResults-' + instance + '">';
        html += '<thead>';
        html += '<tr>';
        html += '<th>' + mOptions.msgs.msgQuestion + ' </th>';
        html += '<th>' + mOptions.msgs.msgCorrect + ' </th>';
        html += '<th>' + mOptions.msgs.msgSolution + ' </th>';
        html += '</tr>';
        html += '</thead>';
        html += '<tbody>';

        for (let c = 0; c < mOptions.number; c++) {
            html += '<tr>';
            html +=
                '<td><a href="#" onclick="$eXeMathOperations.goTo(' +
                c +
                ',' +
                mOptions.number +
                ',' +
                instance +
                ');return false">' +
                (c + 1) +
                '</a> </td>';
            html += '<td> </td>';
            html += '<td> </td>';
            html += '</tr>';
        }

        html += '</tbody>';
        html += '<table>';
        html += '<div class="MTHO-Summary">';
        html += '<ul>';
        html +=
            '<li><strong>' +
            mOptions.msgs.msgWithoutAnswer +
            ': </strong><span id="mathoResults-' +
            instance +
            '-total">' +
            mOptions.number +
            '</span></li>';
        html +=
            '<li><strong>' +
            mOptions.msgs.msgReplied +
            ': </strong><span id="mathoResults-' +
            instance +
            '-answered">0</span></li>';
        html +=
            '<li><strong>' +
            mOptions.msgs.msgCorrects +
            ': </strong><span id="mathoResults-' +
            instance +
            '-right-answered">0</span></li>';
        html +=
            '<li><strong>' +
            mOptions.msgs.msgIncorrects +
            ': </strong><span id="mathoResults-' +
            instance +
            '-wrong-answered">0</span></li>';
        html +=
            '<li><strong>' +
            mOptions.msgs.msgScore +
            ': </strong><span id="mathoResults-' +
            instance +
            '-result">0</span>%</li>';
        html += '</ul>';
        html += '</div>';
        $('#mthoMultimedia-' + instance).empty();
        $('#mthoMultimedia-' + instance).append(html);
    },

    createInterfaceMathO: function (instance) {
        const path = $eXeMathOperations.idevicePath,
            msgs = $eXeMathOperations.options[instance].msgs,
            mOptions = $eXeMathOperations.options[instance],
            html = `
            <div class="MTHO-MainContainer" id="mthoMainContainer-${instance}">
                <div class="MTHO-GameMinimize" id="mthoGameMinimize-${instance}">
                    <a href="#" class="MTHO-LinkMaximize" id="mthoLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                        <img src="${path}mthoIcon.png" class="MTHO-IconMinimize MTHO-Activo" alt="">
                        <div class="MTHO-MessageMaximize" id="mthoMessageMaximize-${instance}"></div>
                    </a>
                </div>
                <div class="MTHO-GameContainer" id="mthoGameContainer-${instance}">
                    <div class="MTHO-GameScoreBoard">
                        <div class="MTHO-GameScores">
                            <div class="exeQuextIcons exeQuextIcons-Number" title="${msgs.msgNumQuestions}"></div>
                            <p>
                                <span class="sr-av">${msgs.msgNumQuestions}: </span>
                                <span id="mthoPNumber-${instance}">0</span>
                            </p>
                            <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                            <p>
                                <span class="sr-av">${msgs.msgHits}: </span>
                                <span id="mthoPHits-${instance}">0</span>
                            </p>
                            <div class="exeQuextIcons exeQuextIcons-Error" title="${msgs.msgErrors}"></div>
                            <p>
                                <span class="sr-av">${msgs.msgErrors}: </span>
                                <span id="mthoPErrors-${instance}">0</span>
                            </p>
                            <div class="exeQuextIcons exeQuextIcons-Score" title="${msgs.msgScore}"></div>
                            <p>
                                <span class="sr-av">${msgs.msgScore}: </span>
                                <span id="mthoPScore-${instance}">0</span>
                            </p>
                        </div>
                        <div class="MTHO-LifesGame" id="mthoLifesAdivina-${instance}">
                        </div>
                        <div class="MTHO-TimeNumber">
                            <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Time" title="${msgs.msgTime}"></div>
                            <p id="mthoPTime-${instance}" class="MTHO-PTime">00:00</p>
                            <a href="#" class="MTHO-LinkMinimize" id="mthoLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                                <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                                <div class="exeQuextIcons exeQuextIcons-Minimize MTHO-Activo"></div>
                            </a>
                            <a href="#" class="MTHO-LinkFullScreen" id="mthoLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                                <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                                <div class="exeQuextIcons exeQuextIcons-FullScreen MTHO-Activo" id="mthoFullScreen-${instance}"></div>
                            </a>
                        </div>
                    </div>
                    <div class="MTHO-ShowClue" id="mthoShowClue-${instance}">
                        <div class="sr-av">${msgs.msgClue}</div>
                        <p class="MTHO-PShowClue MTHO-parpadea" id="mthoPShowClue-${instance}"></p>
                    </div>
                    <div class="MTHO-Flex" id="mthoDivImgHome-${instance}">
                        <img src="${path}mthoHome.svg" class="MTHO-ImagesHome" id="mthoPHome-${instance}" alt="${msgs.msgNoImage}" />
                    </div>
                    <div class="MTHO-StartGame">
                        <a href="#" id="mthoStartGame-${instance}" style="display:none"></a>
                    </div>
                    <div class="MTHO-Multimedia" id="mthoMultimedia-${instance}">
                    </div>                   
                </div>
                 <div class="MTHO-Cubierta" id="mthoCubierta-${instance}">
                        <div class="MTHO-CodeAccessDiv" id="mthoCodeAccessDiv-${instance}">
                            <p class="MTHO-MessageCodeAccessE" id="mthoMesajeAccesCodeE-${instance}"></p>
                            <div class="MTHO-DataCodeAccessE">
                                <label class="sr-av">${msgs.msgCodeAccess}:</label>
                                <input type="text" class="MTHO-CodeAccessE form-control" id="mthoCodeAccessE-${instance}">
                                <a href="#" id="mthoCodeAccessButton-${instance}" title="${msgs.msgSubmit}">
                                    <strong><span class="sr-av">${msgs.msgSubmit}</span></strong>
                                    <div class="exeQuextIcons-Submit MTHO-Activo"></div>
                                </a>
                            </div>
                        </div>
                        <div class="MTHO-DivFeedBack" id="mthoDivFeedBack-${instance}">
                            <input type="button" id="mthoFeedBackClose-${instance}" value="${msgs.msgClose}" class="feedbackbutton" />
                        </div>
                    </div>
            </div>
           ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}
        `;

        return html;
    },

    loadQuestionsNumbers: function (dataGame) {
        const mOptions = dataGame;

        mOptions.components = [];
        let min = $eXeMathOperations.defaultSettings.min;
        if (!isNaN(mOptions.min)) min = parseFloat(mOptions.min);

        mOptions.min = min;

        let max = $eXeMathOperations.defaultSettings.max;
        if (!isNaN(mOptions.max)) max = parseFloat(mOptions.max);
        mOptions.max = max;

        for (let i = 0; i < mOptions.number; i++) {
            function getOperation() {
                // Get random operation
                let operators = '+-*/';
                let operationsToDo = '';
                for (let z = 0; z < mOptions.operations.length; z++) {
                    if (mOptions.operations[z] != 0)
                        operationsToDo += operators[z];
                }
                let operation =
                    operationsToDo[
                        $eXeMathOperations.getRandomNo(
                            0,
                            operationsToDo.length,
                            0
                        )
                    ];
                let operandA = $eXeMathOperations.getRandomNo(
                    mOptions.min,
                    mOptions.max,
                    mOptions.decimalsInOperands
                );
                let operandB = $eXeMathOperations.getRandomNo(
                    mOptions.min,
                    mOptions.max,
                    mOptions.decimalsInOperands
                );
                let result;
                if (operation == '+') result = operandA + operandB;
                else if (operation == '-') result = operandA - operandB;
                else if (operation == '*') result = operandA * operandB;
                else result = operandA / operandB;

                result = result.toFixed(2);
                result = result.toString().replace('.00', '');
                result = parseFloat(result);
                return [operandA, operation, operandB, result];
            }
            let components = getOperation(mOptions.min, mOptions.max);
            // No decimals, negative results or zero
            if (
                mOptions.decimalsInResults == false &&
                mOptions.negative == false &&
                mOptions.zero == false
            ) {
                while (
                    components[3] !== parseInt(components[3]) ||
                    components[3] <= 0
                ) {
                    components = getOperation(mOptions.min, mOptions.max);
                }
            }
            // No decimals or negative results
            else if (
                mOptions.decimalsInResults == false &&
                mOptions.negative == false
            ) {
                while (
                    components[3] !== parseInt(components[3]) ||
                    components[3] < 0
                ) {
                    components = getOperation(mOptions.min, mOptions.max);
                }
            }
            // No decimals or zero
            else if (
                mOptions.decimalsInResults == false &&
                mOptions.zero == false
            ) {
                while (
                    components[3] !== parseInt(components[3]) ||
                    components[3] == 0
                ) {
                    components = getOperation(mOptions.min, mOptions.max);
                }
            }

            // No negative results or zero
            else if (mOptions.negative == false && mOptions.zero == false) {
                while (components[3] <= 0) {
                    components = getOperation(mOptions.min, mOptions.max);
                }
            }

            // No decimals
            else if (mOptions.decimalsInResults == false) {
                while (components[3] !== parseInt(components[3])) {
                    components = getOperation(mOptions.min, mOptions.max);
                }
            }

            // No negative results
            else if (mOptions.negative == false) {
                while (components[3] < 0) {
                    components = getOperation(mOptions.min, mOptions.max);
                }
            }

            // No zero
            else if (mOptions.zero == false) {
                while (components[3] == 0) {
                    components = getOperation(mOptions.min, mOptions.max);
                }
            }

            // instance, i, operandA, operation, operandB, result
            if (mOptions.type == 'random') {
                let options = ['operator', 'result', 'operandA', 'operandB'];
                mOptions.type = options[this.getRandomNo(0, 4, 0)];
            }
            mOptions.components.push(components);
        }
        return mOptions;
    },

    loadQuestions: function (dataGame) {
        let mOptions = {};
        if (dataGame.mode == 1) {
            mOptions = $eXeMathOperations.loadQuestionFractions(dataGame);
        } else {
            mOptions = $eXeMathOperations.loadQuestionsNumbers(dataGame);
        }
        return mOptions;
    },

    showCubiertaOptions(mode, instance) {
        if (mode === false) {
            $('#mthoCubierta-' + instance).fadeOut();
            return;
        }
        $('#mthoCodeAccessDiv-' + instance).hide();
        $('#mthoDivFeedBack-' + instance).hide();
        switch (mode) {
            case 0:
                $('#mthoCodeAccessDiv-' + instance).show();
                break;
            case 1:
                $('#mthoDivFeedBack-' + instance)
                    .find('.identifica-feedback-game')
                    .show();
                $('#mthoDivFeedBack-' + instance).css('display', 'flex');
                $('#mthoDivFeedBack-' + instance).show();
                break;
            default:
                break;
        }
        $('#mthoCubierta-' + instance).fadeIn();
    },

    goTo: function (target, total, instance) {
        $('form.mathoQuestion-' + instance).hide();
        $('#mathoQuestion-' + instance + '-' + target).fadeIn(
            'normal',
            function () {
                $('input[type=text]', this).focus();
            }
        );
        // Update the links
        let counter = target + 1;
        $('#mathoPage-' + instance).html(counter);
        let visibility = 'visible';
        let nextLink = document.getElementById(
            'MTHO-' + instance + '-nextLink'
        );
        if (nextLink) {
            if (counter == total) visibility = 'hidden';
            nextLink.style.visibility = visibility;
            nextLink.onclick = function () {
                $eXeMathOperations.goTo(counter, total, instance);
                return false;
            };
        }
        visibility = 'visible';

        let prevLink = document.getElementById(
            'MTHO-' + instance + '-prevLink'
        );
        if (prevLink) {
            if (counter == 1) visibility = 'hidden';
            prevLink.style.visibility = visibility;
            prevLink.onclick = function () {
                $eXeMathOperations.goTo(target - 1, total, instance);
                return false;
            };
        }

        let html = $('#mthoMultimedia-' + instance).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);
        if (latex)
            $exeDevices.iDevice.gamification.math.updateLatex(
                '#mthoMultimedia-' + instance
            );
    },

    getRandomNo: function (from, to, allowDecimals) {
        if (allowDecimals != 0)
            return parseFloat(
                (Math.random() * to + from).toFixed(allowDecimals)
            );
        else return Math.floor(Math.random() * to) + from;
    },
    paginate: function (e, currPos, total, instance, action) {
        // mathoPage-X
        // mathoQuestion-instance-i
        let formToShow;
        let counter = currPos + 1;
        let currentForm = $('#mathoQuestion-' + instance + '-' + currPos);
        if (action == 'next') {
            formToShow = $('#mathoQuestion-' + instance + '-' + (currPos + 1));
            counter = counter + 1;
        } else {
            formToShow = $('#mathoQuestion-' + instance + '-' + (currPos - 1));
            counter = counter - 1;
        }

        currentForm.hide();
        formToShow.fadeIn();
        $('#mathoPage-' + instance).html(counter);

        // Update the links
        let visibility = 'visible';
        let nextLink = document.getElementById(
            'MTHO-' + instance + '-nextLink'
        );
        if (nextLink) {
            if (counter == total) visibility = 'hidden';
            nextLink.style.visibility = visibility;
            nextLink.onclick = function () {
                $eXeMathOperations.paginate(
                    this,
                    counter - 1,
                    total,
                    instance,
                    'next'
                );
                return false;
            };
        }

        visibility = 'visible';
        let prevLink = document.getElementById(
            'MTHO-' + instance + '-prevLink'
        );
        if (prevLink) {
            if (counter == 1) visibility = 'hidden';
            prevLink.style.visibility = visibility;
            prevLink.onclick = function () {
                $eXeMathOperations.paginate(
                    this,
                    counter - 1,
                    total,
                    instance,
                    'prev'
                );
                return false;
            };
        }
    },

    checkInputContent: function (e, type, mode) {
        let str = e.value;
        let lastCharacter = str.slice(-1);
        if (type == 'operator') {
            if (
                lastCharacter != '+' &&
                lastCharacter != '-' &&
                lastCharacter != '*' &&
                lastCharacter != 'x' &&
                lastCharacter != '/' &&
                lastCharacter != ':'
            ) {
                e.value = str.substring(0, str.length - 1);
            } else if (lastCharacter == '*') {
                e.value = str.substring(0, str.length - 1) + 'x';
            }
        } else {
            if (mode == 1) {
                if (lastCharacter == '/' || lastCharacter == '-') {
                    //
                } else {
                    if (isNaN(parseInt(lastCharacter))) {
                        e.value = str.substring(0, str.length - 1);
                    }
                }
                return;
            }
            if (lastCharacter == ',' || lastCharacter == '.') {
                e.value = str.substring(0, str.length - 1);
                if (e.value.indexOf('.') == -1) {
                    if (e.value == '') e.value = 0;
                    e.value = e.value + '.';
                }
            } else if (str.slice(0) == '-') {
                //
            } else {
                if (isNaN(parseFloat(lastCharacter))) {
                    e.value = str.substring(0, str.length - 1);
                }
            }
        }
    },

    getQuestion: function (
        instance,
        type,
        i,
        operandA,
        operation,
        operandB,
        result,
        numberOfDecimals
    ) {
        let mOptions = $eXeMathOperations.options[instance];
        if (operation == '*') operation = 'x';
        if (type == 'result')
            result =
                '<input type="text" autocomplete="off" id="mathoQuestion-' +
                instance +
                '-' +
                i +
                '-answer" style="width:5em" onkeyup="$eXeMathOperations.checkInputContent(this,\'number\',' +
                mOptions.mode +
                ')" />';
        else if (type == 'operator')
            operation =
                '<input class="operator" type="text" autocomplete="off" id="mathoQuestion-' +
                instance +
                '-' +
                i +
                '-answer" style="width:1em" onkeyup="$eXeMathOperations.checkInputContent(this,\'operator\',' +
                mOptions.mode +
                ')" />';
        else if (type == 'operandA')
            operandA =
                '<input type="text" autocomplete="off" id="mathoQuestion-' +
                instance +
                '-' +
                i +
                '-answer" style="width:5em" onkeyup="$eXeMathOperations.checkInputContent(this,\'number\',' +
                mOptions.mode +
                ')" />';
        else if (type == 'operandB')
            operandB =
                '<input type="text" autocomplete="off" id="mathoQuestion-' +
                instance +
                '-' +
                i +
                '-answer" style="width:5em" onkeyup="$eXeMathOperations.checkInputContent(this,\'number\',' +
                mOptions.mode +
                ')" />';
        let css = ' style="display:none"';
        if (i == 0) css = '';
        let html =
            '<form class="MTHO-Form mathoQuestion-' +
            instance +
            '" id="mathoQuestion-' +
            instance +
            '-' +
            i +
            '" onsubmit="return $eXeMathOperations.checkAnswer(this,\'' +
            type +
            "','" +
            numberOfDecimals +
            "'," +
            mOptions.mode +
            ')"' +
            css +
            '>';
        html += '<p>';
        html += '<label for="mathoQuestion-' + instance + '-' + i + '-answer">';
        html += '<span class="operandA">' + operandA + '</span>';
        html += '<span class="operation">' + operation + '</span>';
        html += '<span class="operandB">' + operandB + '</span>';
        html += '=';
        html += '<span class="operationResult">' + result + '</span>';
        html += '</label>';
        html +=
            ' <input type="submit" value="' +
            mOptions.msgs.msgCheck +
            '" id="mathoQuestion-' +
            instance +
            '-' +
            i +
            '-submit" /> <span id="mathoQuestion-' +
            instance +
            '-' +
            i +
            '-warning"></span>';
        html += '</p>';
        html += '</form>';
        return html;
    },

    reduceDecimals: function (value) {
        if (typeof value === 'string' || value instanceof String) {
            // Convierte la cadena en un número de coma flotante
            value = parseFloat(value);
        } else if (typeof value !== 'number' || isNaN(value)) {
            // Devuelve NaN si value no es una cadena ni un número válido
            return NaN;
        }

        // Redondea el número a 2 decimales y elimina los ceros finales
        let result = value.toFixed(2).replace(/\.?0+$/, '');

        // Si el resultado es un número entero, elimina el punto y los ceros finales adicionales
        if (result.indexOf('.') === result.length - 1) {
            result = result.slice(0, result.indexOf('.'));
        }

        // Devuelve el resultado como una cadena
        return String(result);
    },

    removeUnnecessaryDecimals: function (num, fix) {
        let res = num;
        if (fix != false) res = res.toFixed(2);
        res = res.toString().replace('.00', '');
        let lastCharacter = res.slice(-1);
        if (lastCharacter == '0' && res.indexOf('.') != -1) {
            res = res.substring(0, res.length - 1);
        }
        return res;
    },

    checkAnswer: function (e, type, numberOfDecimals, mode) {
        let result = false;
        if (mode == 1) {
            result = $eXeMathOperations.checkAnswerFranctions(e, type);
        } else {
            result = $eXeMathOperations.checkAnswerNumbers(
                e,
                type,
                numberOfDecimals
            );
        }
        return result;
    },

    checkAnswerFranctions: function (e, type) {
        let id = e.id.replace('mathoQuestion-', '').split('-');
        let instance = parseInt(id[0]);
        let mOptions = $eXeMathOperations.options[instance];
        let numf = parseInt(id[1]);
        let opA = mOptions.fractions[numf][0];
        let opB = mOptions.fractions[numf][2];
        let opR = mOptions.fractions[numf][3];
        let operandA = $('.operandA', e);
        let operandA_input = $('INPUT', operandA);
        let operandB = $('.operandB', e);
        let operandB_input = $('INPUT', operandB);
        let operation = $('.operation', e);
        let operation_input = $('INPUT', operation);
        let operationResult = $('.operationResult', e);
        let operationResult_input = $('INPUT', operationResult);
        // Not answered
        if ($('INPUT[type=text]', e).val() == '') {
            let msg = $('#' + e.id + '-warning');
            msg.html(mOptions.msgs.msgIncomplete);
            setTimeout(function () {
                msg.html(mOptions.msgs.msgIncomplete);
            }, 2000);
            return false;
        }
        if (operandA_input.length == 1) {
            if (!$eXeMathOperations.isFraction(operandA_input.val())) {
                let msg = $('#' + e.id + '-warning');
                msg.html(mOptions.msgs.msgFracctionNoValid);
                setTimeout(function () {
                    msg.html(mOptions.msgs.msgFracctionNoValid);
                }, 2000);
                return false;
            }
        } else if (operandB_input.length == 1) {
            if (!$eXeMathOperations.isFraction(operandB_input.val())) {
                let msg = $('#' + e.id + '-warning');
                msg.html(mOptions.msgs.msgFracctionNoValid);
                setTimeout(function () {
                    msg.html(mOptions.msgs.msgFracctionNoValid);
                }, 2000);
                return false;
            }
        } else if (operation_input.length == 1) {
            let ops = '+-/*x:';
            let op = operation_input.val().trim().toLowerCase();
            if (ops.indexOf(op) == -1) {
                let msg = $('#' + e.id + '-warning');
                msg.html(mOptions.msgs.msgOperatNotValid);
                setTimeout(function () {
                    msg.html(mOptions.msgs.msgOperatNotValid);
                }, 2000);
                return false;
            }
        } else if (operationResult_input.length == 1) {
            if (!$eXeMathOperations.isFraction(operationResult_input.val())) {
                let msg = $('#' + e.id + '-warning');
                msg.html(mOptions.msgs.msgFracctionNoValid);
                setTimeout(function () {
                    msg.html(mOptions.msgs.msgFracctionNoValid);
                }, 2000);
                return false;
            }
        }
        let table = $('#mathoResults-' + instance);
        let trs = $('tbody tr', table);
        let tr = trs.eq(id[1]);
        if (operandA_input.length == 1) operandA = operandA_input.val();
        else operandA = opA;

        if (operation_input.length == 1) operation = operation_input.val();
        else operation = operation.text();

        if (operandB_input.length == 1) operandB = operandB_input.val();
        else operandB = opB;

        operationResult = $('.operationResult', e);
        operationResult_input = $('INPUT', operationResult);
        if (operationResult_input.length == 1)
            operationResult = operationResult_input.val();
        else operationResult = opR;

        let right = false;
        let rightResult = $eXeMathOperations.operateFractions(
            operandA,
            operandB,
            operation,
            true
        );
        if (
            $eXeMathOperations.compareFractions(
                operationResult,
                rightResult,
                mOptions.solution
            )
        )
            right = true;
        // Include the results in the table
        let tds = $('td', tr);
        let rightTD = tds.eq(1);
        let solutionTD = tds.eq(2);
        let base = 'mathoResults-' + instance + '-';

        $('#' + e.id + '-submit').hide();
        e.onsubmit = function () {
            return false;
        };
        $('#' + e.id + '-answer').attr('disabled', 'disabled');
        // Go to the next page
        let nextFormId =
            parseFloat(e.id.replace('mathoQuestion-' + instance + '-', '')) + 1;
        let nextForm = document.getElementById(
            'mathoQuestion-' + instance + '-' + nextFormId
        );
        if (nextForm) {
            $eXeMathOperations.goTo(
                nextFormId,
                $('form.mathoQuestion-' + instance).length,
                instance
            );
        }
        // Summary
        let total = $('#' + base + 'total');
        total.html(parseFloat(total.html()) - 1);
        let answered = $('#' + base + 'answered');
        answered.html(parseFloat(answered.html()) + 1);
        let rightAnswered = $('#' + base + 'right-answered');

        if (right) {
            tr.attr('class', 'MTHO-tr-right');
            rightTD.html('<span class="MTHO-right">1</span> ');
            rightAnswered.html(parseFloat(rightAnswered.html()) + 1);
        } else {
            tr.attr('class', 'MTHO-tr-wrong');
            rightTD.html('<span class="MTHO-wrong">0</span> ');
            let wrongAnswered = $('#' + base + 'wrong-answered');
            wrongAnswered.html(parseFloat(wrongAnswered.html()) + 1);
        }
        if (type == 'operator') {
            rightResult = '';
            if (
                $eXeMathOperations.operateFractions(
                    operandA,
                    operandB,
                    '+',
                    mOptions.solution
                ) == opR
            )
                rightResult += '+ ';
            if (
                $eXeMathOperations.operateFractions(
                    operandA,
                    operandB,
                    '-',
                    mOptions.solution
                ) == opR
            )
                rightResult += '- ';
            if (
                $eXeMathOperations.operateFractions(
                    operandA,
                    operandB,
                    '*',
                    mOptions.solution
                ) == opR
            )
                rightResult += 'x ';
            if (
                $eXeMathOperations.operateFractions(
                    operandA,
                    operandB,
                    ':',
                    mOptions.solution
                ) == opR
            )
                rightResult += ': ';
        }
        if (type == 'operandA') {
            if (right) rightResult = opA;
            else {
                if (operation == '+') rightResult = opR - opB;
                else if (operation == '-')
                    rightResult = $eXeMathOperations.operateFractions(
                        opR,
                        opB,
                        '+',
                        mOptions.solution
                    );
                else if (operation == '*' || operation == 'x')
                    rightResult = $eXeMathOperations.operateFractions(
                        opR,
                        opB,
                        ':',
                        mOptions.solution
                    );
                else
                    rightResult = $eXeMathOperations.operateFractions(
                        opR,
                        opB,
                        '*',
                        mOptions.solution
                    );
            }
        }
        // Type = operandB
        if (type == 'operandB') {
            if (right) rightResult = opB;
            else {
                if (operation == '+')
                    rightResult = $eXeMathOperations.operateFractions(
                        opR,
                        opA,
                        '-',
                        mOptions.solution
                    );
                else if (operation == '-')
                    rightResult = $eXeMathOperations.operateFractions(
                        opR,
                        opA,
                        '-',
                        mOptions.solution
                    );
                else if (operation == '*' || operation == 'x')
                    rightResult = $eXeMathOperations.operateFractions(
                        opR,
                        opA,
                        ':',
                        mOptions.solution
                    );
                else
                    rightResult = $eXeMathOperations.operateFractions(
                        opR,
                        opA,
                        '*',
                        mOptions.solution
                    );
            }
        }
        if (type != 'operator') {
            rightResult = $eXeMathOperations.createLatex(rightResult);
        }
        solutionTD.html(rightResult);
        // Qualification
        let qualification = this.removeUnnecessaryDecimals(
            (100 * parseFloat(rightAnswered.html())) / trs.length
        );
        $('#' + base + 'result').html(qualification);
        $eXeMathOperations.exe.games.math.updateLatex(
            '#mthoMultimedia-' + instance
        );
        $eXeMathOperations.updateScore(right, instance);
        return false;
    },
    createLatex: function (fraction) {
        let [numerator, denominator] = fraction.split('/');
        if (typeof denominator == 'undefined' || denominator == 'undefined')
            denominator = 1;
        let signoDenominador = denominator < 0 ? '-' : '';
        if (denominator == '1') {
            return `\\(${numerator}\\)`;
        } else if (denominator == '-1') {
            numerator = -parseInt(numerator);
            return `\\(${numerator}\\)`;
        } else {
            return `\\(\\dfrac{${numerator}}{${signoDenominador}${Math.abs(denominator)}}\\)`;
        }
    },
    checkAnswerNumbers: function (e, type) {
        let id = e.id.replace('mathoQuestion-', '').split('-');
        let instance = id[0];
        let mOptions = $eXeMathOperations.options[instance];
        let pOperationResult = 0;
        let pRightResult = 0;
        // Not answered
        if ($('INPUT[type=text]', e).val() == '') {
            let msg = $('#' + e.id + '-warning');
            msg.html(mOptions.msgs.msgIncomplete);
            setTimeout(function () {
                msg.html(mOptions.msgs.msgIncomplete);
            }, 2000);
            return false;
        }

        let table = $('#mathoResults-' + instance);
        let trs = $('tbody tr', table);
        let tr = trs.eq(id[1]);

        let operandA = $('.operandA', e);
        let operandA_input = $('INPUT', operandA);
        if (operandA_input.length == 1) operandA = operandA_input.val();
        else operandA = operandA.text();
        operandA = parseFloat(operandA);

        let operation = $('.operation', e);
        let operation_input = $('INPUT', operation);
        if (operation_input.length == 1) {
            operation = operation_input.val();
            operation.toLowerCase();
            let operators_a = 'x*+-/:';
            if (operation.length > 1 || operators_a.indexOf(operation) == -1) {
                let msg = $('#' + e.id + '-warning');
                msg.html(mOptions.msgs.msgOperatNotValid);
                setTimeout(function () {
                    msg.html(mOptions.msgs.msgOperatNotValid);
                }, 2000);
                return false;
            }
        } else {
            operation = operation.text();
        }

        let operandB = $('.operandB', e);
        let operandB_input = $('INPUT', operandB);
        if (operandB_input.length == 1) operandB = operandB_input.val();
        else operandB = operandB.text();
        operandB = parseFloat(operandB);

        let operationResult = $('.operationResult', e);
        let operationResult_input = $('INPUT', operationResult);
        if (operationResult_input.length == 1)
            operationResult = operationResult_input.val();
        else operationResult = operationResult.text();
        operationResult = parseFloat(operationResult);
        // operationResult = operationResult.toFixed(numberOfDecimals);

        operationResult = operationResult.toFixed(2);
        operationResult = parseFloat(operationResult);
        pOperationResult = operationResult;

        // Check
        let right = false;
        let rightResult = 0;
        if (operation == '+') rightResult = operandA + operandB;
        else if (operation == '-') rightResult = operandA - operandB;
        else if (operation == 'x' || operation == '*')
            rightResult = operandA * operandB;
        else if (operation == '/' || operation == ':')
            rightResult = operandA / operandB;

        // rightResult = rightResult.toFixed(numberOfDecimals);
        pRightResult = rightResult;
        rightResult = rightResult.toFixed(2);
        if (rightResult == operationResult) right = true;
        if (mOptions.errorType > 0) {
            let ep =
                mOptions.errorType == 1
                    ? pRightResult * mOptions.errorRelative
                    : mOptions.errorAbsolute;
            let errormin = pRightResult - ep;
            errormin = errormin.toFixed(2);
            errormin = parseFloat(errormin);

            let errormax = pRightResult + ep;
            errormax = errormax.toFixed(2);
            errormax = parseFloat(errormax);
            right =
                pOperationResult >= errormin && pOperationResult <= errormax;
        }
        // Include the results in the table
        let tds = $('td', tr);
        let rightTD = tds.eq(1);
        let solutionTD = tds.eq(2);
        let base = 'mathoResults-' + instance + '-';

        // Hide the submit button and disable the form
        $('#' + e.id + '-submit').hide();
        e.onsubmit = function () {
            return false;
        };
        $('#' + e.id + '-answer').attr('disabled', 'disabled');

        // Go to the next page
        let nextFormId =
            parseFloat(e.id.replace('mathoQuestion-' + instance + '-', '')) + 1;
        let nextForm = document.getElementById(
            'mathoQuestion-' + instance + '-' + nextFormId
        );
        if (nextForm) {
            $eXeMathOperations.goTo(
                nextFormId,
                $('form.mathoQuestion-' + instance).length,
                instance
            );
        }

        // Summary
        let total = $('#' + base + 'total');
        total.html(parseFloat(total.html()) - 1);
        let answered = $('#' + base + 'answered');
        answered.html(parseFloat(answered.html()) + 1);
        let rightAnswered = $('#' + base + 'right-answered');

        if (right) {
            tr.attr('class', 'MTHO-tr-right');
            rightTD.html('<span class="MTHO-right">1</span> ');
            rightAnswered.html(parseFloat(rightAnswered.html()) + 1);
        } else {
            tr.attr('class', 'MTHO-tr-wrong');
            rightTD.html('<span class="MTHO-wrong">0</span> ');
            let wrongAnswered = $('#' + base + 'wrong-answered');
            wrongAnswered.html(parseFloat(wrongAnswered.html()) + 1);
        }

        // Type = operator
        if (type == 'operator') {
            rightResult = $eXeMathOperations.getOperatorString(
                operandA,
                operandB,
                operationResult,
                mOptions.errorType,
                mOptions.errorRelative,
                mOptions.errorAbsolute
            );
        }

        // Type = operandA
        if (type == 'operandA') {
            if (right) rightResult = operandA;
            else {
                if (operation == '+') rightResult = operationResult - operandB;
                else if (operation == '-')
                    rightResult = operationResult + operandB;
                else if (operation == '*' || operation == 'x')
                    rightResult = operationResult / operandB;
                else rightResult = operationResult * operandB;
            }
        }

        // Type = operandB
        if (type == 'operandB') {
            if (right) rightResult = operandB;
            else {
                if (operation == '+') rightResult = operationResult - operandA;
                else if (operation == '-')
                    rightResult = Math.abs(operationResult - operandA);
                else if (operation == '*' || operation == 'x')
                    rightResult = operationResult / operandA;
                else rightResult = operationResult * operandA;
            }
        }
        if (type !== 'operator') {
            rightResult = $eXeMathOperations.reduceDecimals(rightResult);
        }

        solutionTD.html(rightResult);
        // Qualification
        let qualification = this.removeUnnecessaryDecimals(
            (100 * parseFloat(rightAnswered.html())) / trs.length
        );
        $('#' + base + 'result').html(qualification);
        $eXeMathOperations.updateScore(right, instance);

        return false;
    },

    getOperatorString: function (oA, oB, oR, etype, er, ea) {
        let soperator = '';
        if (etype == 0) {
            if ((oA + oB).toFixed(2) == oR.toFixed(2)) soperator += '+ ';
            if ((oA - oB).toFixed(2) == oR.toFixed(2)) soperator += '- ';
            if ((oA * oB).toFixed(2) == oR.toFixed(2)) soperator += 'x ';
            if ((oA / oB).toFixed(2) == oR.toFixed(2)) soperator += '/ ';
        } else {
            let ep = etype == 1 ? oR * er : ea;
            let errormin = oR - ep;
            let errormax = oR + ep;
            if (oA + oB >= errormin && oA + oB <= errormax) soperator += '+ ';
            if (oA - oB >= errormin && oA - oB <= errormax) soperator += '- ';
            if (oA * oB >= errormin && oA * oB <= errormax) soperator += 'x ';
            if (oA / oB >= errormin && oA / oB <= errormax) soperator += '/ ';
        }
        return soperator;
    },

    checkAnswerNumbers2: function (e, numberOfDecimals, type) {
        let id = e.id.replace('mathoQuestion-', '').split('-');
        let instance = id[0];
        let mOptions = $eXeMathOperations.options[instance];
        let pOperationResult = 0;
        let pRightResult = 0; // Not answered

        if ($('INPUT[type=text]', e).val() == '') {
            let msg = $('#' + e.id + '-warning');
            msg.html(mOptions.msgs.msgIncomplete);
            setTimeout(function () {
                msg.html(mOptions.msgs.msgIncomplete);
            }, 2000);
            return false;
        }

        let table = $('#mathoResults-' + instance);
        let trs = $('tbody tr', table);
        let tr = trs.eq(id[1]);

        let operandA = $('.operandA', e);
        let operandA_input = $('INPUT', operandA);
        if (operandA_input.length == 1) operandA = operandA_input.val();
        else operandA = operandA.text();
        operandA = parseFloat(operandA);

        let operation = $('.operation', e);
        let operation_input = $('INPUT', operation);
        if (operation_input.length == 1) operation = operation_input.val();
        else {
            let operadores = 'x*+-/:';
            operation = operation.text();
            operation = operation.toLowerCase();
            if (operation.length > 1 || operadores.indexOf(operation) == -1) {
                let msg = $('#' + e.id + '-warning');
                msg.html(mOptions.msgs.msgOperatNotValid);
                setTimeout(function () {
                    msg.html(mOptions.msgs.msgOperatNotValid);
                }, 2000);
                return false;
            }
        }

        let operandB = $('.operandB', e);
        let operandB_input = $('INPUT', operandB);
        if (operandB_input.length == 1) operandB = operandB_input.val();
        else operandB = operandB.text();
        operandB = parseFloat(operandB);

        let operationResult = $('.operationResult', e);
        let operationResult_input = $('INPUT', operationResult);
        if (operationResult_input.length == 1)
            operationResult = operationResult_input.val();
        else operationResult = operationResult.text();
        operationResult = parseFloat(operationResult);

        operationResult = operationResult.toFixed(2);
        operationResult = parseFloat(operationResult);
        pOperationResult = operationResult;

        // Check
        let right = false;
        let rightResult;
        if (operation == '+') rightResult = operandA + operandB;
        else if (operation == '-') rightResult = operandA - operandB;
        else if (operation == 'x' || operation == '*')
            rightResult = operandA * operandB;
        else if (operation == '/' || operation == ':')
            rightResult = operandA / operandB;
        // rightResult = rightResult.toFixed(numberOfDecimals);
        pRightResult = rightResult;
        rightResult = rightResult.toFixed(2);
        if (rightResult == operationResult) right = true;
        if (mOptions.errorType > 0) {
            let ep =
                mOptions.errorType == 1
                    ? pRightResult * mOptions.errorRelative
                    : mOptions.errorAbsolute;
            let errormin = pRightResult - ep;
            errormin = errormin.toFixed(2);
            errormin = parseFloat(errormin);
            let errormax = pRightResult + ep;
            errormax = errormax.toFixed(2);
            errormax = parseFloat(errormax);
            right =
                pOperationResult >= errormin && pOperationResult <= errormax;
        }
        // Include the results in the table
        let tds = $('td', tr);
        let rightTD = tds.eq(1);
        let solutionTD = tds.eq(2);
        let base = 'mathoResults-' + instance + '-';

        // Hide the submit button and disable the form
        $('#' + e.id + '-submit').hide();
        e.onsubmit = function () {
            return false;
        };
        $('#' + e.id + '-answer').attr('disabled', 'disabled');

        // Go to the next page
        let nextFormId =
            parseFloat(e.id.replace('mathoQuestion-' + instance + '-', '')) + 1;
        let nextForm = document.getElementById(
            'mathoQuestion-' + instance + '-' + nextFormId
        );
        if (nextForm) {
            $eXeMathOperations.goTo(
                nextFormId,
                $('form.mathoQuestion-' + instance).length,
                instance
            );
        }
        // Summary
        let total = $('#' + base + 'total');
        total.html(parseFloat(total.html()) - 1);
        let answered = $('#' + base + 'answered');
        answered.html(parseFloat(answered.html()) + 1);
        let rightAnswered = $('#' + base + 'right-answered');

        if (right) {
            tr.attr('class', 'MTHO-tr-right');
            rightTD.html('<span class="MTHO-right">1</span> ');
            rightAnswered.html(parseFloat(rightAnswered.html()) + 1);
        } else {
            tr.attr('class', 'MTHO-tr-wrong');
            rightTD.html('<span class="MTHO-wrong">0</span> ');
            let wrongAnswered = $('#' + base + 'wrong-answered');
            wrongAnswered.html(parseFloat(wrongAnswered.html()) + 1);
        }
        // Type = operator
        if (type == 'operator') {
            // if (right) rightResult = operation;
            // else {
            rightResult = '';
            if (operandA + operandB == operationResult) rightResult += '+ ';
            if (operandA - operandB == operationResult) rightResult += '- ';
            if (operandA * operandB == operationResult) rightResult += 'x ';
            if (operandA / operandB == operationResult) rightResult += '/ ';
            // }
        }
        // Type = operandA
        if (type == 'operandA') {
            if (right) rightResult = operandA;
            else {
                if (operation == '+') rightResult = operationResult - operandB;
                else if (operation == '-')
                    rightResult = operationResult + operandB;
                else if (operation == '*' || operation == 'x')
                    rightResult = operationResult / operandB;
                else rightResult = operationResult * operandB;
            }
        }
        // Type = operandB
        if (type == 'operandB') {
            if (right) rightResult = operandB;
            else {
                if (operation == '+') rightResult = operationResult - operandA;
                else if (operation == '-')
                    rightResult = Math.abs(operationResult - operandA);
                else if (operation == '*' || operation == 'x')
                    rightResult = operationResult / operandA;
                else rightResult = operationResult * operandA;
            }
        }

        rightResult = this.removeUnnecessaryDecimals(rightResult, false);
        solutionTD.html(rightResult);
        // Qualification
        let qualification = this.removeUnnecessaryDecimals(
            (100 * parseFloat(rightAnswered.html())) / trs.length
        );
        $('#' + base + 'result').html(qualification);
        $eXeMathOperations.updateScore(right, instance);
        return false;
    },
    checkClue: function (instance) {
        let mOptions = $eXeMathOperations.options[instance],
            percentageHits = (mOptions.hits / mOptions.number) * 100,
            message = '';
        if (mOptions.number - mOptions.hits - mOptions.errors <= 0) {
            message += mOptions.msgs.msgAllOperations;
        } else if (mOptions.gameOver && mOptions.time > 0) {
            message += mOptions.msgs.msgAllOperations;
        }
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
            }
        }
        $('#mthoPShowClue-' + instance).text(message);
        $('#mthoPShowClue-' + instance).show();
    },

    saveEvaluation: function (instance) {
        const mOptions = $eXeMathOperations.options[instance];
        mOptions.scorerp = (10 * mOptions.hits) / mOptions.number;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $eXeMathOperations.isInExe
        );
    },

    sendScore: function (auto, instance) {
        const mOptions = $eXeMathOperations.options[instance];

        mOptions.scorerp = (10 * mOptions.hits) / mOptions.number;
        mOptions.previousScore = $eXeMathOperations.previousScore;
        mOptions.userName = $eXeMathOperations.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $eXeMathOperations.previousScore = mOptions.previousScore;
    },

    addEvents: function (instance) {
        const mOptions = $eXeMathOperations.options[instance];
        $('#mthoLinkMaximize-' + instance).on('click touchstart', function (e) {
            e.preventDefault();
            $('#mthoGameContainer-' + instance).show();
            $('#mthoGameMinimize-' + instance).hide();
        });

        $('#mthoLinkMinimize-' + instance).on('click touchstart', function (e) {
            e.preventDefault();
            $('#mthoGameContainer-' + instance).hide();
            $('#mthoGameMinimize-' + instance)
                .css('visibility', 'visible')
                .show();
        });

        $('#mthoLinkFullScreen-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                const element = document.getElementById(
                    'mthoGameContainer-' + instance
                );
                $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                    element
                );
            }
        );

        $('#mthoFeedBackClose-' + instance).on('click', function () {
            $eXeMathOperations.showCubiertaOptions(false, instance);
        });
        $('#mthoStartGame-' + instance).show();
        $('#mthoPShowClue-' + instance).hide();
        if (mOptions.itinerary.showCodeAccess) {
            $('#mthoMesajeAccesCodeE-' + instance).text(
                mOptions.itinerary.messageCodeAccess
            );
            $eXeMathOperations.showCubiertaOptions(0, instance);
        }
        $('#mthoCodeAccessButton-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $eXeMathOperations.enterCodeAccess(instance);
            }
        );

        $('#mthoCodeAccessE-' + instance).on('keydown', function (event) {
            if (event.which == 13 || event.keyCode == 13) {
                $eXeMathOperations.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        $('#mthoPNumber-' + instance).text(mOptions.number);
        $(window).on('unload', function () {
            if (typeof $eXeMathOperations.mScorm != 'undefined') {
                $exeDevices.iDevice.gamification.scorm.endScorm(
                    $eXeMathOperations.mScorm
                );
            }
        });

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        $('#mthoInstructions-' + instance).text(mOptions.instructions);

        $('#mthoMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $eXeMathOperations.sendScore(false, instance);
                $eXeMathOperations.saveEvaluation(instance);
            });

        $('#mthoStartGame-' + instance).on('click', function (e) {
            e.preventDefault();
            if (mOptions.gameOver) {
                $eXeMathOperations.reloadGame(instance);
                if (mOptions.time > 0) {
                    mOptions.gameStarted = false;
                    $eXeMathOperations.startGame(instance);
                }
                $exeDevices.iDevice.gamification.math.updateLatex(
                    'mthoMultimedia-' + instance
                );
            } else {
                $eXeMathOperations.startGame(instance);
            }
        });
        if (mOptions.time > 0) {
            mOptions.gameStarted = false;
            $('#mthoGameContainer-' + instance)
                .find('.exeQuextIcons-Time')
                .show();
            $('#mthoPTime-' + instance).show();
            $('#mthoStartGame-' + instance).show();
            $('#mthoMultimedia-' + instance).hide();
            $('#mthoDivImgHome-' + instance).show();
            $('#mthoStartGame-' + instance).text(mOptions.msgs.msgPlayStart);
        } else {
            $('#mthoMultimedia-' + instance).show();
            $('#mthoDivImgHome-' + instance).hide();
            $('#mthoStartGame-' + instance).hide();
            $('#mthoGameContainer-' + instance)
                .find('.exeQuextIcons-Time')
                .hide();
            $('#mthoPTime-' + instance).hide();
            mOptions.gameStarted = true;
        }
        setTimeout(() => {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                this.isInExe
            );
        }, 500);
    },

    startGame: function (instance) {
        const mOptions = $eXeMathOperations.options[instance];
        if (mOptions.gameStarted) return;

        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.counter = 0;
        mOptions.gameOver = false;
        mOptions.gameStarted = false;
        mOptions.obtainedClue = false;
        mOptions.activeCounter = true;
        mOptions.counter = mOptions.time * 60;
        $eXeMathOperations.updateGameBoard(instance);
        if (mOptions.time > 0) {
            $('#mthoMultimedia-' + instance).show();
            $('#mthoDivImgHome-' + instance).hide();
            $('#mthoStartGame-' + instance).hide();
            mOptions.counterClock = setInterval(function () {
                if (mOptions.gameStarted && mOptions.activeCounter) {
                    let $node = $('#mthoMainContainer-' + instance);
                    let $content = $('#node-content');
                    if (
                        !$node.length ||
                        ($content.length && $content.attr('mode') === 'edition')
                    ) {
                        clearInterval(mOptions.counterClock);
                        return;
                    }
                    mOptions.counter--;
                    $eXeMathOperations.uptateTime(mOptions.counter, instance);
                    if (mOptions.counter <= 0) {
                        mOptions.activeCounter = false;
                        $eXeMathOperations.gameOver(0, instance);
                        return;
                    }
                }
            }, 1000);
            $eXeMathOperations.uptateTime(mOptions.time * 60, instance);
        }
        mOptions.gameStarted = true;
    },

    enterCodeAccess: function (instance) {
        const mOptions = $eXeMathOperations.options[instance];
        if (
            mOptions.itinerary.codeAccess.toLowerCase() ==
            $('#mthoCodeAccessE-' + instance)
                .val()
                .toLowerCase()
        ) {
            $eXeMathOperations.showCubiertaOptions(false, instance);
            if (mOptions.time > 0) {
                mOptions.gameStarted = false;
                $eXeMathOperations.startGame(instance);
            }
            $('#mthoLinkMaximize-' + instance).trigger('click');
        } else {
            $('#mthoMesajeAccesCodeE-' + instance)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $('#mthoCodeAccessE-' + instance).val('');
        }
    },

    uptateTime: function (tiempo, instance) {
        const mTime =
            $exeDevices.iDevice.gamification.helpers.getTimeToString(tiempo);
        $('#mthoPTime-' + instance).text(mTime);
    },

    gameOver: function (type, instance) {
        const mOptions = $eXeMathOperations.options[instance];

        mOptions.gameStarted = false;
        mOptions.gameOver = true;
        mOptions.activeCounter = false;

        if (mOptions.time > 0) {
            clearInterval(mOptions.counterClock);
            $eXeMathOperations.uptateTime(0, instance);
        }

        $('#mthoGameContainer-' + instance)
            .find('.MTHO-Form')
            .find('input')
            .attr('disabled', 'disabled');
        $('#mthoGameContainer-' + instance)
            .find('.MTHO-Form')
            .find('input[type="submit"]')
            .hide();

        if (mOptions.isScorm == 1) {
            if (
                mOptions.repeatActivity ||
                $eXeMathOperations.initialScore === ''
            ) {
                const score = ((mOptions.hits * 10) / mOptions.number).toFixed(
                    2
                );
                $eXeMathOperations.sendScore(true, instance);
                $eXeMathOperations.initialScore = score;
            }
        }

        $eXeMathOperations.saveEvaluation(instance);
        $eXeMathOperations.checkClue(instance);
        $('#mthoStartGame-' + instance).text(mOptions.msgs.msgNewGame);
        $('#mthoStartGame-' + instance).show();
        $eXeMathOperations.showFeedBack(instance);
    },

    showFeedBack: function (instance) {
        const mOptions = $eXeMathOperations.options[instance],
            puntos = (mOptions.hits * 100) / parseInt(mOptions.number);
        if (mOptions.feedBack) {
            if (puntos >= mOptions.percentajeFB) {
                $('#mthoDivFeedBack-' + instance)
                    .find('.mathoperations-feedback-game')
                    .show();
                $eXeMathOperations.showCubiertaOptions(1, instance);
            } else {
                $eXeMathOperations.showMessage(
                    1,
                    mOptions.msgs.msgTryAgain.replace(
                        '%s',
                        mOptions.percentajeFB
                    ),
                    instance
                );
            }
        }
    },

    updateScore: function (correctAnswer, instance) {
        const mOptions = $eXeMathOperations.options[instance];
        let pendientes = 0;

        if (correctAnswer) {
            mOptions.hits++;
            type = 2;
        } else {
            mOptions.errors++;
        }

        pendientes = mOptions.number - mOptions.errors - mOptions.hits;
        mOptions.score = (mOptions.hits / mOptions.number) * 10;
        if (mOptions.isScorm === 1) {
            if (
                mOptions.repeatActivity ||
                $eXeMathOperations.initialScore === ''
            ) {
                $eXeMathOperations.sendScore(true, instance);
            }
        }

        $eXeMathOperations.saveEvaluation(instance);
        $eXeMathOperations.checkClue(instance);
        $eXeMathOperations.updateGameBoard(instance);

        if (pendientes == 0) $eXeMathOperations.gameOver(1, instance);
    },

    updateGameBoard(instance) {
        const mOptions = $eXeMathOperations.options[instance],
            pendientes = mOptions.number - mOptions.errors - mOptions.hits,
            sscore =
                mOptions.score % 1 == 0
                    ? mOptions.score
                    : mOptions.score.toFixed(2);

        $('#mthoPHits-' + instance).text(mOptions.hits);
        $('#mthoPErrors-' + instance).text(mOptions.errors);
        $('#mthoPNumber-' + instance).text(pendientes);
        $('#mthoPScore-' + instance).text(sscore);
    },

    showMessage: function (type, message, instance) {
        const colors = [
                '#555555',
                $eXeMathOperations.borderColors.red,
                $eXeMathOperations.borderColors.green,
                $eXeMathOperations.borderColors.blue,
                $eXeMathOperations.borderColors.yellow,
            ],
            color = colors[type];
        $('#mthoPShowClue-' + instance).text(message);
        $('#mthoPShowClue-' + instance).css({
            color: color,
        });
    },

    operateFractions: function (f1, f2, operation, type) {
        let fraction1 = $eXeMathOperations.parsearFraccion(f1);
        let fraction2 = $eXeMathOperations.parsearFraccion(f2);
        let resultado;
        operation = typeof operation == 'undefined' ? 'x' : operation;
        operation = operation.toLowerCase().trim();
        switch (operation) {
            case '+':
                resultado = $eXeMathOperations.addFractions(
                    fraction1,
                    fraction2,
                    type
                );
                break;
            case '-':
                resultado = $eXeMathOperations.subtractFractions(
                    fraction1,
                    fraction2,
                    type
                );
                break;
            case '*':
                resultado = $eXeMathOperations.multiplyFractions(
                    fraction1,
                    fraction2,
                    type
                );
                break;
            case '/':
                resultado = $eXeMathOperations.divideFractions(
                    fraction1,
                    fraction2,
                    type
                );
                break;
            case ':':
                resultado = $eXeMathOperations.divideFractions(
                    fraction1,
                    fraction2,
                    type
                );
                break;
            case 'x':
                resultado = $eXeMathOperations.multiplyFractions(
                    fraction1,
                    fraction2,
                    type
                );
                break;
            default:
                throw new Error('Operación no soportada');
        }
        let result = $eXeMathOperations.simplifyFraction(
            resultado.numerator,
            resultado.denominator,
            type
        );
        return $eXeMathOperations.formatFraction(
            result.numerator,
            result.denominator
        );
    },

    parsearFraccion: function (fraction) {
        let [numerator, denominator] = fraction.split('/').map(Number);
        denominator = typeof denominator == 'undefined' ? 1 : denominator;
        return {
            numerator,
            denominator,
        };
    },

    addFractions: function (f1, f2, type) {
        const commonDenominator = f1.denominator * f2.denominator;
        const numerator =
            f1.numerator * f2.denominator + f2.numerator * f1.denominator;
        return $eXeMathOperations.simplifyFraction(
            numerator,
            commonDenominator,
            type
        );
    },

    subtractFractions: function (f1, f2, type) {
        const commonDenominator = f1.denominator * f2.denominator;
        const numerator =
            f1.numerator * f2.denominator - f2.numerator * f1.denominator;
        return $eXeMathOperations.simplifyFraction(
            numerator,
            commonDenominator,
            type
        );
    },
    multiplyFractions: function (f1, f2, type) {
        const numerator = f1.numerator * f2.numerator;
        const denominator = f1.denominator * f2.denominator;
        return $eXeMathOperations.simplifyFraction(
            numerator,
            denominator,
            type
        );
    },

    divideFractions: function (f1, f2, type) {
        const numerator = f1.numerator * f2.denominator;
        const denominator = f1.denominator * f2.numerator;
        return $eXeMathOperations.simplifyFraction(
            numerator,
            denominator,
            type
        );
    },

    simplifyFraction: function (numerator, denominator, type) {
        const mcd = $eXeMathOperations.getLMC(numerator, denominator);
        if (type && denominator < 0) {
            numerator *= -1;
            denominator *= -1;
        }
        return {
            numerator: numerator / mcd,
            denominator: denominator / mcd,
        };
    },

    getLMC: function (a, b) {
        // Utilizar el algoritmo de Euclides para calcular el MCD
        a = Math.abs(a);
        b = Math.abs(b);
        while (b !== 0) {
            let t = b;
            b = a % b;
            a = t;
        }
        return a;
    },

    isFraction: function (schain) {
        if (typeof schain !== 'string' || schain.length === 0) {
            return false;
        }
        const parts = schain.split('/');
        if (parts.length == 1) {
            parts.push('1');
        } else if (parts.length !== 2) {
            return false;
        }
        const numerator = parts[0].trim();
        const denominator = parts[1].trim();
        const numeratorIsInteger = /^-?\s?\d+$/.test(numerator);
        const denominatorIsInteger = /^-?\s?\d+$/.test(denominator);
        if (!numeratorIsInteger || !denominatorIsInteger) {
            return false;
        }
        if (denominator === '0') {
            return false;
        }
        return true;
    },

    compareFractions: function (fraction1, fraction2, strict) {
        if (
            !$eXeMathOperations.isFraction(fraction1) ||
            !$eXeMathOperations.isFraction(fraction1)
        ) {
            return;
        }
        if (strict) {
            return (
                fraction1.replace(/\s/g, '').toLowerCase() ==
                fraction2.replace(/\s/g, '').toLowerCase()
            );
        }
        let [num1, den1] = fraction1.replace(/\s/g, '').split('/').map(Number);
        let [num2, den2] = fraction2.replace(/\s/g, '').split('/').map(Number);

        if (den1 == 0 || den2 == 0) {
            throw new Error('Los denominadores deben ser distintos de 0');
        }
        den1 = typeof den1 == 'undefined' ? 1 : den1;
        den2 = typeof den2 == 'undefined' ? 1 : den2;
        //const absNum1 = Math.abs(num1);
        //const absDen1 = Math.abs(den1);
        //const absNum2 = Math.abs(num2);
        //const absDen2 = Math.abs(den2);
        return (
            parseInt(num1) / parseInt(den1) === parseInt(num2) / parseInt(den2)
        );
    },

    formatFraction: function (numerator, denominator) {
        if (denominator == 1) {
            return `${numerator}`;
        }
        return `${numerator}/${denominator}`;
    },

    loadQuestionFractions: function (dataGame) {
        const mOptions = dataGame;
        mOptions.components = [];
        mOptions.fractions = [];
        let min = $eXeMathOperations.defaultSettings.min;

        if (!isNaN(mOptions.min)) min = parseInt(mOptions.min);
        mOptions.min = Math.round(min);
        let max = $eXeMathOperations.defaultSettings.max;
        if (!isNaN(mOptions.max)) max = parseInt(mOptions.max);
        mOptions.max = Math.round(max);
        for (let i = 0; i < mOptions.number; i++) {
            function getOperation() {
                let operators = '+-*:';
                let operationsToDo = '';
                for (let z = 0; z < mOptions.operations.length; z++) {
                    if (mOptions.operations[z] != 0)
                        operationsToDo += operators[z];
                }
                let operation =
                    operationsToDo[
                        $eXeMathOperations.getRandomNo(
                            0,
                            operationsToDo.length,
                            0
                        )
                    ];
                let operandA = $eXeMathOperations.generateFraction(
                    mOptions.min,
                    mOptions.max,
                    mOptions.negativeFractions,
                    mOptions.solution
                );
                let operandB = $eXeMathOperations.generateFraction(
                    mOptions.min,
                    mOptions.max,
                    mOptions.negativeFractions,
                    mOptions.solution
                );
                if (operation == '-' && !mOptions.negativeFractions) {
                    if ($eXeMathOperations.is_minor(operandA, operandB)) {
                        let aux = operandA;
                        operandA = operandB;
                        operandB = aux;
                    }
                }
                let result = $eXeMathOperations.operateFractions(
                    operandA,
                    operandB,
                    operation,
                    true
                );
                let oA = $eXeMathOperations.createLatex(operandA);
                let oB = $eXeMathOperations.createLatex(operandB);
                let lresult = $eXeMathOperations.createLatex(result);
                return [
                    [oA, operation, oB, lresult],
                    [operandA, operation, operandB, result],
                ];
            }

            let datos = getOperation(mOptions.min, mOptions.max);
            if (mOptions.type == 'random') {
                let options = ['operator', 'result', 'operandA', 'operandB'];
                mOptions.type = options[this.getRandomNo(0, 4, 0)];
            }
            mOptions.components.push(datos[0]);
            mOptions.fractions.push(datos[1]);
        }
        return mOptions;
    },

    is_minor: function (fraction1, fraction2) {
        let [num1, den1] = fraction1.split('/').map(Number);
        let [num2, den2] = fraction2.split('/').map(Number);
        den1 = typeof den1 == 'undefined' ? 1 : den1;
        den2 = typeof den2 == 'undefined' ? 1 : den2;
        const frac1 = num1 / den1;
        const frac2 = num2 / den2;
        return frac2 > frac1;
    },

    generateFraction: function (maximo, minimo, signo, type) {
        if (typeof maximo !== 'number' || typeof minimo !== 'number') {
            throw new Error('Los valores máximo y mínimo deben ser números');
        }
        let numerator =
            Math.floor(Math.random() * (maximo - minimo + 1)) + minimo;
        let denominator =
            Math.floor(Math.random() * (maximo - minimo + 1)) + minimo;
        if (denominator === 0) {
            denominator = 1;
        }
        if (signo) {
            let aleatorio1 = Math.random();
            if (aleatorio1 < 0.5) {
                numerator *= -1;
            }
            aleatorio1 = Math.random();
            if (aleatorio1 < 0.3) {
                denominator *= -1;
            }
        }
        let fc = $eXeMathOperations.simplifyFraction(
            numerator,
            denominator,
            type
        );
        if (fc.denominator == 1) {
            return `${fc.numerator}`;
        }
        return `${fc.numerator}/${fc.denominator}`;
    },
};
$(function () {
    $eXeMathOperations.init();
});
