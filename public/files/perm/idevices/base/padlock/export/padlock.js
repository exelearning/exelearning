/* eslint-disable no-undef */
/**
 * Lock iDevice (export code)
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno, Francisco Javier Pulido
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $padlock = {
    idevicePath: '',
    borderColors: {
        black: '#1c1b1b',
        blue: '#5877c6',
        green: '#2a9315',
        red: '#ff0000',
        white: '#ffffff',
        yellow: '#f3d55a',
    },
    colors: {
        black: '#1c1b1b',
        blue: '#d5dcec',
        green: '#cce1c8',
        red: '#f7c4c4',
        white: '#ffffff',
        yellow: '#f5efd6',
    },
    image: '',
    options: {},
    msgs: '',
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
            'Padlock',
            'padlock',
            'candado-IDevice'
        );
    },

    enable: function () {
        $padlock.loadGame();
    },

    loadGame: function () {
        $padlock.options = [];
        $padlock.activities.each(function (i) {
            const version = $('.candado-version', this).eq(0).text(),
                dl = $('.candado-DataGame', this),
                mOption = $padlock.loadDataGame(dl, version),
                msg = mOption.msgs.msgPlayStart;

            mOption.candadoInstructions = $('.candado-instructions', this)
                .eq(0)
                .html();
            mOption.counter = mOption.candadoTime * 60;
            mOption.candadoStarted = false;
            mOption.candadoSolved = false;
            mOption.candadoErrors = 0;

            mOption.id = typeof mOption.id === 'undefined' ? i : mOption.id;
            $padlock.options.push(mOption);

            mOption.scorerp = 0;
            mOption.idevicePath = $padlock.idevicePath;
            mOption.main = 'candadoMainContainer-' + i;
            mOption.idevice = 'candado-IDevice';
            +i;

            const candado = $padlock.createInterfaceCandado(i);
            dl.before(candado).remove();

            $('#candadoGameMinimize-' + i).hide();
            $('#candadoGameContainer-' + i).hide();

            if (mOption.candadoShowMinimize) {
                $('#candadoGameMinimize-' + i)
                    .css('cursor', 'pointer')
                    .show();
            } else {
                $('#candadoGameContainer-' + i).show();
            }

            $('#candadoMessageMaximize-' + i).text(msg);

            $('#candadoInstructions-' + i).append(
                $('.candado-instructions', this)
            );
            $('#candadoFeedRetro-' + i).append($('.candado-retro', this));
            $('#candadoMainContainer-' + i)
                .find('.candado-instructions')
                .removeClass('js-hidden');
            $('#candadoMainContainer-' + i)
                .find('.candado-retro')
                .removeClass('js-hidden');
            $padlock.addEvents(i);
            $('#candadoMainContainer-' + i).show();
        });
        const candadoHtml = $('.candado-IDevice').html();
        if ($exeDevices.iDevice.gamification.math.hasLatex(candadoHtml)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '.candado-IDevice'
            );
        }
    },

    createInterfaceCandado: function (instance) {
        const path = $padlock.idevicePath,
            msgs = $padlock.options[instance].msgs,
            mOptions = $padlock.options[instance],
            html = `
        <div class="candado-MainContainer" id="candadoMainContainer-${instance}">
            <div class="candado-GameMinimize" id="candadoGameMinimize-${instance}">
                <a href="#" class="candado-LinkMaximize" id="candadoLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                    <img src="${path}candadoIcon.png" class="candado-Icons candado-IconMinimize candado-Activo" alt="">
                    <span class="candado-MessageMaximize" id="candadoMessageMaximize-${instance}">${msgs.msgEShowActivity}</span>
                </a>
            </div>
            <div class="candado-GameContainer" id="candadoGameContainer-${instance}">
                <div class="candado-GameScoreBoard">
                    <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                    <div class="exeQuextIcons34-Time" title="${msgs.msgTime}"></div>
                    <p id="candadoPTime-${instance}" class="candado-PTime">00:00</p>
                    <a href="#" class="candado-LinkMinimize candado-Activo" id="candadoLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                        <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                        <div class="exeQuextIcons34-Minimize"></div>
                    </a>
                </div>
                <div class="candado-Instructiones exe-text" id="candadoInstructions-${instance}"></div>
                <div class="candado-FeedRetro exe-text" id="candadoFeedRetro-${instance}"></div>
                <div class="candado-MessageInfo" id="candadoMessageInfo-${instance}">
                    <div class="sr-av">${msgs.msgInstructions}</div>
                    <p id="candadoPInformation-${instance}"></p>
                </div>
                <div class="candado-SolutionDiv" id="candadoSolutionDiv-${instance}">
                    <label for="candadoSolution-${instance}" class="labelSolution">${msgs.msgCodeAccess}:</label>
                    <input type="password" class="candado-Solution form-control" id="candadoSolution-${instance}">
                    <a href="#" id="candadoSolutionButton-${instance}" title="${msgs.msgSubmit}" class="candado-SolutionButton candado-Activo">
                        <strong><span class="sr-av">${msgs.msgSubmit}</span></strong>
                        <div class="exeQuextIcons-Submit"></div>
                    </a>
                </div>
                <div class="candado-SolutionDiv" id="candadoNavigator-${instance}">
                    <input type="button" class="btn btn-primary" id="candadoShowIntro-${instance}" style="margin-right:8px;" value="${msgs.msgInstructions}">
                    <input type="button" class="btn btn-primary" id="candadoShowRetro-${instance}" value="${msgs.msgFeedback}">
                </div>
            </div>
        </div>
       ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}
        `;

        return html;
    },

    loadDataGame: function (data, version) {
        let json = data.text();
        if (version == 1 || !json.startsWith('{')) {
            json = $exeDevices.iDevice.gamification.helpers.decrypt(json);
        }
        const mOptions =
            $exeDevices.iDevice.gamification.helpers.isJsonString(json);
        mOptions.score = 0;
        mOptions.gameStarted = true;
        return mOptions;
    },

    addZero: function (i) {
        return i < 10 ? '0' + i : i;
    },

    saveCandadoData: function (instance) {
        const mOptions = $padlock.options[instance],
            tiempo = mOptions.counter < 0 ? 0 : mOptions.counter,
            data = {
                candadoStarted: mOptions.candadoStarted,
                candadoSolved: mOptions.candadoSolved,
                counter: tiempo,
                candadoTime: mOptions.candadoTime,
                candadoReboot: mOptions.candadoReboot,
                candadoErrors: mOptions.candadoErrors,
                candadoScore: mOptions.score,
            };
        localStorage.setItem(
            'dataCandado-' + mOptions.id,
            JSON.stringify(data)
        );
    },

    getCandadoData: function (instance) {
        const mOptions = $padlock.options[instance];
        return $exeDevices.iDevice.gamification.helpers.isJsonString(
            localStorage.getItem('dataCandado-' + mOptions.id)
        );
    },

    addEvents: function (instance) {
        const mOptions = $padlock.options[instance];
        $padlock.removeEvents(instance);

        $(`#candadoLinkMaximize-${instance}`).on('click', (e) => {
            e.preventDefault();
            $(`#candadoGameContainer-${instance}`).show();
            $(`#candadoGameMinimize-${instance}`).hide();
            if (!mOptions.candadoStarted) {
                $padlock.startGame(instance);
            }
            $(`#candadoSolution-${instance}`).focus();
        });

        $(`#candadoLinkMinimize-${instance}`).on('click', (e) => {
            e.preventDefault();
            $(`#candadoGameContainer-${instance}`).hide();
            $(`#candadoGameMinimize-${instance}`)
                .css('visibility', 'visible')
                .show();
        });

        $(`#candadoSolution-${instance}`).on('keydown', (event) => {
            if (event.which === 13 || event.keyCode === 13) {
                $padlock.answerActivity(instance);
                return false;
            }
            return true;
        });

        $(`#candadoSolutionButton-${instance}`).on('click', (e) => {
            e.preventDefault();
            $padlock.answerActivity(instance);
        });

        $(`#candadoShowIntro-${instance}`).on('click', () => {
            $(`#candadoInstructions-${instance}`).show();
            $(`#candadoFeedRetro-${instance}`).hide();
            $(`#candadoSolutionDiv-${instance}`).hide();
        });

        $(`#candadoShowRetro-${instance}`).on('click', () => {
            $(`#candadoInstructions-${instance}`).hide();
            $(`#candadoFeedRetro-${instance}`).show();
            $(`#candadoSolutionDiv-${instance}`).hide();
        });

        $(`#candadoMessageInfo-${instance}`).show();
        $(`#candadoNavigator-${instance}`).hide();

        if (mOptions.candadoShowMinimize) {
            $(`#candadoGameContainer-${instance}`).hide();
            $(`#candadoGameMinimize-${instance}`)
                .css('visibility', 'visible')
                .show();
        }

        if (mOptions.candadoTime === 0) {
            $(`#candadoTimeQuestion-${instance}`).hide();
            $(`#candadoTimeNumber-${instance}`).css('width', '32px');
        }

        const dataCandado = $padlock.getCandadoData(instance);
        mOptions.candadoSolved = false;
        mOptions.counter = mOptions.candadoTime * 60;

        if (dataCandado) {
            if (
                mOptions.candadoTime !== dataCandado.candadoTime ||
                mOptions.candadoReboot !== dataCandado.candadoReboot ||
                (mOptions.candadoReboot && dataCandado.candadoSolved)
            ) {
                mOptions.score = 0;
                localStorage.removeItem(`dataCandado-${mOptions.id}`);
            } else {
                mOptions.candadoSolved = dataCandado.candadoSolved;
                mOptions.counter = dataCandado.counter;
                mOptions.score = mOptions.candadoScore
                    ? mOptions.candadoScore
                    : 0;
            }
        }
        $(window).on('unload.eXeCandado beforeunload.eXeCandado', function () {
            const mOptions = $padlock.options[instance];
            if (mOptions.candadoStarted) {
                $padlock.saveCandadoData(instance);
            }
        });

        $('#candadoMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function () {
                $padlock.sendScore(false, instance);
            });

        if (mOptions.isScorm === 1) {
            $padlock.sendScore(true, instance);
        }

        if (!mOptions.candadoShowMinimize) {
            $padlock.startGame(instance);
        }
        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        setTimeout(() => {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                this.isInExe
            );
        }, 500);
    },

    removeEvents: function (instance) {
        $(`#candadoLinkMaximize-${instance}`).off('click');
        $(`#candadoLinkMinimize-${instance}`).off('click');
        $(`#candadoSolution-${instance}`).off('keydown');
        $(`#candadoSolutionButton-${instance}`).off('click');
        $(`#candadoShowIntro-${instance}`).off('click');
        $(`#candadoShowRetro-${instance}`).off('click');
        $(`#candadoSendScore`).off('click');

        $(window).off('unload.eXeCandado beforeunload.eXeCandado');
    },

    startGame: function (instance) {
        const mOptions = $padlock.options[instance];
        mOptions.candadoStarted = true;

        if (mOptions.candadoSolved && !mOptions.candadoReboot) {
            $padlock.showFeedback(instance);
            return;
        }

        if (mOptions.candadoTime === 0) {
            return;
        }

        $padlock.uptateTime(0, instance);

        mOptions.counterClock = setInterval(() => {
            let $node = $('#candadoMainContainer-' + instance);
            let $content = $('#node-content');
            if (
                !$node.length ||
                ($content.length && $content.attr('mode') === 'edition')
            ) {
                clearInterval(mOptions.counterClock);
                return;
            }
            mOptions.counter--;

            $padlock.uptateTime(mOptions.counter, instance);
            if (mOptions.counter <= 0 || mOptions.candadoSolved) {
                clearInterval(mOptions.counterClock);
                $padlock.showFeedback(instance);
            }
        }, 1000);
    },

    showFeedback: function (instance) {
        const mOptions = $padlock.options[instance];

        if (mOptions.isScorm > 0) {
            $padlock.sendScore(true, instance);
        }

        $padlock.saveEvaluation(instance);
        clearInterval(mOptions.counterClock);

        mOptions.candadoSolved = true;

        $padlock.uptateTime(mOptions.counter, instance);

        $('#candadoInstructions-' + instance)
            .hide()
            .attr('aria-labelledby', 'candadoShowIntro-' + instance);
        $('#candadoFeedRetro-' + instance)
            .show()
            .attr('aria-labelledby', 'candadoShowRetro-' + instance);
        $('#candadoSolutionDiv-' + instance).hide();
        $('#candadoNavigator-' + instance).show();
        $('#candadoMessageInfo-' + instance).hide();
        $('#candadoShowRetro-' + instance).focus();

        const containerHtml = $('#candadoMainContainer-' + instance).html();
        if ($exeDevices.iDevice.gamification.math.hasLatex(containerHtml)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '#candadoMainContainer-' + instance
            );
        }
    },

    uptateTime: function (tiempo, instance) {
        const adjustedTime = tiempo < 0 ? 0 : tiempo;
        $('#candadoPTime-' + instance).text(
            $exeDevices.iDevice.gamification.helpers.getTimeToString(
                adjustedTime
            )
        );
    },

    getTimeToString: function (iTime) {
        const mMinutes = parseInt(iTime / 60) % 60,
            mSeconds = iTime % 60;
        return `${mMinutes < 10 ? '0' + mMinutes : mMinutes}:${mSeconds < 10 ? '0' + mSeconds : mSeconds}`;
    },

    answerActivity: function (instance) {
        const mOptions = $padlock.options[instance],
            answord = $('#candadoSolution-' + instance)
                .val()
                .trim(),
            msgs = mOptions.msgs;

        let message = '',
            typeMessage = 0;

        if (answord.length === 0) {
            $padlock.showMessage(1, msgs.msgEnterCode, instance);
            return;
        }

        if ($padlock.checkWord(answord, mOptions.candadoSolution)) {
            mOptions.score = 10;
            $padlock.saveEvaluation(instance);
            $padlock.showFeedback(instance);
        } else {
            message = `${$padlock.getRetroFeedMessages(false, instance)} ${msgs.msgErrorCode}`;
            typeMessage = 1;
            mOptions.candadoErrors++;
            if (
                mOptions.candadoAttemps > 0 &&
                mOptions.candadoErrorMessage.length > 0 &&
                mOptions.candadoErrors >= mOptions.candadoAttemps
            ) {
                typeMessage = 0;
                message = mOptions.candadoErrorMessage;
            }
            $('#candadoSolution-' + instance).val('');
        }

        $padlock.showMessage(typeMessage, message, instance);
    },

    checkWord: function (answord, word) {
        const normalize = (str) =>
                str
                    .trim()
                    .replace(/\s+/g, ' ')
                    .toUpperCase()
                    .replace(/[.,;]$/, ''),
            sWord = normalize(word),
            sAnsWord = normalize(answord);

        if (!sWord.includes('|')) {
            return sWord === sAnsWord;
        }

        const words = sWord.split('|').map((w) => normalize(w));
        return words.includes(sAnsWord);
    },

    getRetroFeedMessages: function (isCorrect, instance) {
        const msgs = $padlock.options[instance].msgs,
            messages = isCorrect ? msgs.msgSuccesses : msgs.msgFailures,
            messagesArray = messages.split('|');
        return messagesArray[Math.floor(Math.random() * messagesArray.length)];
    },

    showMessageAlert: function (tmsg) {
        window.alert(tmsg);
    },

    showMessage: function (type, message, instance) {
        const colors = {
            0: '#555555',
            1: $padlock.borderColors.red,
            2: $padlock.borderColors.green,
            3: $padlock.borderColors.blue,
            4: $padlock.borderColors.yellow,
        };

        const color = colors[type];
        $('#candadoPInformation-' + instance)
            .text(message)
            .css({
                color: color,
                'font-weight': 'bold',
            });
    },

    saveEvaluation: function (instance) {
        const mOptions = $padlock.options[instance];
        mOptions.scorerp = 10;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $padlock.isInExe
        );
    },

    sendScore: function (auto, instance) {
        const mOptions = $padlock.options[instance];

        mOptions.scorerp = mOptions.score;
        mOptions.previousScore = $padlock.previousScore;
        mOptions.userName = $padlock.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $padlock.previousScore = mOptions.previousScore;
    },
};
$(function () {
    $padlock.init();
});
