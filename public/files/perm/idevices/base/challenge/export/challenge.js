/* eslint-disable no-undef */
/**
 * QuExt Activity iDevice (export code)
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno, Francisco Javier Pulido
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $eXeDesafio = {
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
    widthImage: 0,
    heightImage: 0,
    options: {},
    msgs: '',
    fontSize: '1em',
    isInExe: false,
    userName: '',
    hasSCORMbutton: false,
    previousScore: '',
    initialScore: '',
    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',
    mScorm: null,

    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            'Challenge',
            'challenge',
            'desafio-IDevice'
        );
    },

    saveEvaluation: function (instance) {
        const mOptions = $eXeDesafio.options[instance],
            points = mOptions.desafioSolved
                ? mOptions.solvedsChallenges.length + 1
                : mOptions.solvedsChallenges.length,
            score = 10 * (points / (mOptions.challengesGame.length + 1));

        mOptions.scorerp = score;

        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $eXeDesafio.isInExe
        );
    },

    sendScore: function (auto, instance) {
        const mOptions = $eXeDesafio.options[instance],
            points = mOptions.desafioSolved
                ? mOptions.solvedsChallenges.length + 1
                : mOptions.solvedsChallenges.length,
            score = 10 * (points / (mOptions.challengesGame.length + 1));

        mOptions.scorerp = score;
        mOptions.previousScore = $eXeDesafio.previousScore;
        mOptions.userName = $eXeDesafio.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $eXeDesafio.previousScore = mOptions.previousScore;
    },

    enable: function () {
        $eXeDesafio.loadGame();
    },

    loadGame: function () {
        $eXeDesafio.options = [];

        $eXeDesafio.activities.each(function (i) {
            const version = $('.desafio-version', this).eq(0).text(),
                dl = $('.desafio-DataGame', this),
                mOption = $eXeDesafio.loadDataGame(dl, version),
                msg = mOption.msgs.msgPlayStart;

            mOption.scorerp = 0;
            mOption.idevicePath = $eXeDesafio.idevicePath;
            mOption.main = 'desafioMainContainer-' + i;
            mOption.idevice = 'desafio-IDevice';

            $eXeDesafio.options.push(mOption);

            const desafio = $eXeDesafio.createInterfaceChallenger(i);

            dl.before(desafio).remove();
            $('#desafioGameMinimize-' + i).show();
            $('#desafioGameContainer-' + i).show();
            if (mOption.showMinimize) {
                $('#desafioGameContainer-' + i).hide();
            } else {
                $('#desafioGameMinimize-' + i).hide();
            }

            $('#desafioMessageMaximize-' + i).text(msg);
            $('#desafioDescription-' + i).append(
                $('.desafio-EDescription', this)
            );
            $('.desafio-ChallengeDescription', this).each(function () {
                $('#desafioFeedBacks-' + i).append($(this));
            });
            $('#desafioDescription-' + i).hide();
            $('#desafioFeedBacks-' + i).hide();

            $eXeDesafio.addEvents(i);
        });

        let node = document.querySelector('.page-content');
        if (this.isInExe) {
            node = document.getElementById('node-content');
        }
        if (node)
            $exeDevices.iDevice.gamification.observers.observeResize(
                $eXeDesafio,
                node
            );

        const html = $('.desafio-IDevice').html();
        if ($exeDevices.iDevice.gamification.math.hasLatex(html)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '.desafio-IDevice'
            );
        }
    },

    createInterfaceChallenger: function (instance) {
        const path = $eXeDesafio.idevicePath,
            mOptions = $eXeDesafio.options[instance],
            msgs = $eXeDesafio.options[instance].msgs,
            html = `
        <div class="desafio-MainContainer" id="desafioMainContainer-${instance}">
            <div class="desafio-GameMinimize" id="desafioGameMinimize-${instance}">
                <a href="#" class="desafio-LinkMaximize" id="desafioLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                    <img src="${path}desafioicon.png" class="desafio-Icons desafio-IconMinimize desafio-Activo" alt="Mostrar actividad">
                    <div class="desafio-MessageMaximize" id="desafioMessageMaximize-${instance}"></div>
                </a>
            </div>
            <div class="desafio-GameContainer" id="desafioGameContainer-${instance}">
                <div class="desafio-GameScoreBoard">
                    <div class="desafio-GameChallenges" id="desafioGameChallenges-${instance}">
                        <a href="#" class="desafio-LinkDesafio" id="desafioDesafio-${instance}" title="${msgs.msgDesafio}">
                            <strong><span class="sr-av">${msgs.msgDesafio}:</span></strong>
                            <div class="desafio-GameDesafio desafio-Activo"></div>
                        </a>
                        ${$eXeDesafio.createDesafiosLink(msgs, instance)}
                    </div>
                    <div class="desafio-TimeNumber">
                        <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                        <div class="exeQuextIcons34 exeQuextIcons34-Time"></div>
                        <p id="desafioPTime-${instance}" class="desafio-PTime">00:00:00</p>
                        <a href="#" class="desafio-LinkMinimize" id="desafioLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                            <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                            <div class="exeQuextIcons34 exeQuextIcons34-Minimize desafio-Activo"></div>
                        </a>
                    </div>
                </div>
                <div class="desafio-Multimedia" id="desafioMultimedia-${instance}">
                    <img src="" class="desafio-Images" id="desafioImagen-${instance}" alt="${msgs.msgNoImage}" />
                    <img src="${path}desafioHome.png" class="desafio-Images" id="desafioCover-${instance}" alt="${msgs.msImage}" />
                    <div class="desafio-GameOver" id="desafioGamerOver-${instance}">
                        <div class="desafio-SolvedChallenges">
                            <p id="desafioOverScore-${instance}">Score: 0</p>
                        </div>
                        <div class="desafio-DataImageGameOver">
                            <div class="desafio-HistGGame" id="desafioHistGGame-${instance}"></div>
                            <div class="desafio-LostGGame" id="desafioLostGGame-${instance}"></div>
                        </div>
                    </div>
                </div>
                <div class="desafio-Title" id="desafioTitle-${instance}"></div>
                <div class="desafio-Description" id="desafioDescription-${instance}"></div>
                <div class="desafio-FeedBacks" id="desafioFeedBacks-${instance}"></div>
                <div class="desafio-MessageInfo" id="desafioMessageInfo-${instance}">
                    <div class="sr-av">Information</div>
                    <p id="desafioPInformation-${instance}"></p>
                </div>
                <div class="desafio-SolutionDiv" id="desafioSolutionDiv-${instance}">
                    <label for="desafioSolution-${instance}">${msgs.mgsSolution}:</label>
                    <input type="text" class="desafio-Solution form-control" id="desafioSolution-${instance}">
                    <a href="#" id="desafioSolutionButton-${instance}" title="${msgs.msgSubmit}">
                        <strong><span class="sr-av">${msgs.msgSubmit}</span></strong>
                        <div class="exeQuextIcons-Submit desafio-Activo"></div>
                    </a>
                </div>
                <div class="desafio-StartGameDiv" id="desafioStartGameDiv-${instance}">
                    <a href="#" class="desafio-StartGame" id="desafioStartGame-${instance}" title="${msgs.Play}">${msgs.msgStartGame}</a>
                </div>
                <div class="desafio-Clues" id="desafioClues-${instance}"></div>
                <div class="desafio-DateDiv" id="desafioDateDiv-${instance}">
                    <p class="desafio-Date" id="desafioDate-${instance}">${msgs.msgDate}:</p>
                    <a href="#" class="desafio-LinkReboot" id="desafioRebootButton-${instance}" title="${msgs.msgReboot}">
                        <strong><span class="sr-av">${msgs.msgReboot}:</span></strong>
                        <div class="exeDesafio-IconReboot desafio-Activo"></div>
                    </a>
                </div>
            </div>
        </div>
        ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}
        `;

        return html;
    },

    createDesafiosLink: function (msgs, instance) {
        const options = [...Array(10).keys()]
            .map(
                (i) => `
        <a href="#" class="desafio-LinkChallenge" data-number="${i}" id="desafioLink${i}-${instance}" title="${msgs.msgChallenge} ${i + 1}">
            <strong><span class="sr-av">${msgs.msgChallenge}:</span></strong>
            <div class="exeQuextRetos exeQuextRetos-C${i} desafio-Activo"></div>
        </a>`
            )
            .join('');
        return options;
    },

    createArrayStateChallenges: function (type, mlength) {
        let chs = [];
        for (let i = 0; i < mlength; i++) {
            let state = 0;
            if (i === 0) {
                state = 3;
            } else if (type === 1) {
                state = 1;
            }
            const p = {
                solved: 0,
                state: state,
            };
            chs.push(p);
        }
        return chs;
    },

    checkWord: function (word, answord) {
        let sWord = word
                .trim()
                .replace(/\s+/g, ' ')
                .toUpperCase()
                .replace(/\.$/, '')
                .replace(/,$/, '')
                .replace(/;$/, ''),
            sAnsWord = answord
                .trim()
                .replace(/\s+/g, ' ')
                .toUpperCase()
                .replace(/\.$/, '')
                .replace(/,$/, '')
                .replace(/;$/, '');

        sWord = sWord.trim();
        sAnsWord = sAnsWord.trim();

        if (sWord.indexOf('|') === -1) return sWord === sAnsWord;

        const words = sWord.split('|');
        for (let i = 0; i < words.length; i++) {
            const mword = words[i]
                .trim()
                .replace(/\.$/, '')
                .replace(/,$/, '')
                .replace(/;$/, '');
            if (mword === sAnsWord) {
                return true;
            }
        }
        return false;
    },

    loadDataGame: function (data, version) {
        let json = data.text();

        if (version === 1 || !json.startsWith('{')) {
            json = $exeDevices.iDevice.gamification.helpers.decrypt(json);
        }

        const mOptions =
            $exeDevices.iDevice.gamification.helpers.isJsonString(json);

        mOptions.gameOver = false;
        mOptions.numberQuestions = mOptions.challengesGame.length;
        mOptions.typeQuestion = 0;
        mOptions.activeChallenge = 0;
        mOptions.desafioDate = '';
        mOptions.started = false;
        mOptions.counter = 0;
        mOptions.endGame = false;
        mOptions.desafioSolved = false;
        mOptions.solvedsChallenges = [];
        mOptions.timesShow = [];
        mOptions.stateChallenges = $eXeDesafio.createArrayStateChallenges(
            mOptions.desafioType,
            mOptions.challengesGame.length
        );
        mOptions.clueTimes = [];
        mOptions.desafioID =
            typeof mOptions.desafioID === 'undefined' ? 0 : mOptions.desafioID;
        mOptions.evaluation =
            typeof mOptions.evaluation === 'undefined'
                ? false
                : mOptions.evaluation;
        mOptions.evaluationID =
            typeof mOptions.evaluationID === 'undefined'
                ? ''
                : mOptions.evaluationID;
        mOptions.id = typeof mOptions.id === 'undefined' ? false : mOptions.id;

        for (let i = 0; i < mOptions.challengesGame.length; i++) {
            mOptions.challengesGame[i].clueTimes = [];
            mOptions.challengesGame[i].clueTexts = [];
            mOptions.timesShow.push(10000000);
            if (typeof mOptions.challengesGame[i].clues !== 'undefined') {
                for (
                    let z = 0;
                    z < mOptions.challengesGame[i].clues.length;
                    z++
                ) {
                    if (mOptions.challengesGame[i].clues[z].clue.length > 0) {
                        mOptions.challengesGame[i].clueTimes.push(
                            mOptions.challengesGame[i].clues[z].time * 60
                        );
                        mOptions.challengesGame[i].clueTexts.push(
                            mOptions.challengesGame[i].clues[z].clue
                        );
                    }
                }
            }
        }

        return mOptions;
    },

    changeImageButtonState: function (instance, type) {
        const mOptions = $eXeDesafio.options[instance];

        let imgDesafio = 'desafioicon0.png';

        if (type === 0) imgDesafio = 'desafioicon1.png';

        imgDesafio = `url(${$eXeDesafio.idevicePath}${imgDesafio}) no-repeat`;
        $(`#desafioDesafio-${instance}`).find('.desafio-GameDesafio').css({
            background: imgDesafio,
            'background-size': '100% 100%',
        });

        const $buttonChalleng = $(`#desafioGameChallenges-${instance}`).find(
                '.desafio-LinkChallenge'
            ),
            l = 24,
            t = 24,
            file = 'exequextretosicos.png';

        $(`#desafioDesafio-${instance}`)
            .find('.desafio-GameDesafio')
            .css({
                background: imgDesafio,
                'background-size': '100% 100%',
                width: `${l}px`,
                height: `${t}px`,
            });

        $buttonChalleng.each(function (i) {
            if (i < mOptions.stateChallenges.length) {
                const state = mOptions.stateChallenges[i].state;
                const left = `${-l * i}px`;
                const top = `${-t * state}px`;
                const mcss = `url(${$eXeDesafio.idevicePath}${file}) no-repeat ${left} ${top}`;
                $(this)
                    .find('.exeQuextRetos')
                    .css({
                        background: mcss,
                        width: `${l}px`,
                        height: `${t}px`,
                        'flex-grow': 0,
                    });
            }
        });
    },

    addZero: function (i) {
        return i < 10 ? `0${i}` : i.toString();
    },

    getActualFullDate: function () {
        const d = new Date(),
            day = $eXeDesafio.addZero(d.getDate()),
            month = $eXeDesafio.addZero(d.getMonth() + 1),
            year = $eXeDesafio.addZero(d.getFullYear()),
            h = $eXeDesafio.addZero(d.getHours()),
            m = $eXeDesafio.addZero(d.getMinutes()),
            s = $eXeDesafio.addZero(d.getSeconds());
        return `${day}/${month}/${year} (${h}:${m}:${s})`;
    },

    addEvents: function (instance) {
        const mOptions = $eXeDesafio.options[instance];

        $eXeDesafio.removeEvents(instance);

        $(window).on('unload.eXeChallenger beforeunload.eXeChallenger', () => {
            if (mOptions.gameStarted || mOptions.gameOver) {
                $eXeDesafio.saveDataStorage(instance);
                $exeDevices.iDevice.gamification.scorm.endScorm(
                    $eXeDesafio.mScorm
                );
            }
        });
        $(`#desafioSolutionDiv-${instance}`).hide();

        const $buttonChalleng = $(`#desafioGameChallenges-${instance}`).find(
            '.desafio-LinkChallenge'
        );

        $buttonChalleng.each(function (i) {
            $(this).hide();
            if (i < mOptions.challengesGame.length) {
                $(this).show();
            }
        });

        $(`#desafioGamerOver-${instance}`).css('display', 'flex');

        $(`#desafioLinkMaximize-${instance}`).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $(`#desafioGameContainer-${instance}`).show();
                $(`#desafioGameMinimize-${instance}`).hide();
            }
        );

        $(`#desafioLinkMinimize-${instance}`).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $(`#desafioGameContainer-${instance}`).hide();
                $(`#desafioGameMinimize-${instance}`)
                    .css('visibility', 'visible')
                    .show();
            }
        );

        $(`#desafioGamerOver-${instance}`).hide();
        $(`#desafioVideo-${instance}`).hide();
        $(`#desafioImagen-${instance}`).hide();
        $(`#desafioCursor-${instance}`).hide();
        $(`#desafioCover-${instance}`).show();

        $(`#desafioSolution-${instance}`).on('keydown', function (event) {
            const dstate = $(`#desafioSolution-${instance}`).prop('readonly');
            if (dstate) return;
            if (event.which === 13 || event.keyCode === 13) {
                $eXeDesafio.answerChallenge(instance);
                return false;
            }
            return true;
        });

        $(`#desafioGameChallenges-${instance}`).on(
            'click touchstart',
            '.desafio-LinkChallenge',
            function (e) {
                e.preventDefault();
                if (!mOptions.gameStarted) {
                    return;
                }
                const number = parseInt($(this).data('number'));
                $eXeDesafio.showChallenge(number, instance);
            }
        );

        $(`#desafioDesafio-${instance}`).on('click touchstart', function (e) {
            e.preventDefault();
            if (mOptions.gameStarted) {
                $eXeDesafio.showDesafio(instance);
            }
        });

        $(`#desafioRebootButton-${instance}`).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                if (window.confirm(mOptions.msgs.msgDesafioReboot)) {
                    $eXeDesafio.rebootGame(instance);
                }
            }
        );

        $(`#desafioStartGame-${instance}`).text(mOptions.msgs.msgPlayStart);

        $(`#desafioStartGame-${instance}`).on('click', function (e) {
            e.preventDefault();
            $eXeDesafio.startGame(instance, 0);
        });

        $(`#desafioSolutionButton-${instance}`).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                const dstate = $(`#desafioSolution-${instance}`).prop(
                    'readonly'
                );
                if (dstate) return;
                $eXeDesafio.answerChallenge(instance);
            }
        );

        $(`#desafioInstructions-${instance}`).text(mOptions.instructions);
        $(`#desafioPNumber-${instance}`).text(mOptions.numberQuestions);
        $(`#desafioInstruction-${instance}`).text(mOptions.instructions);

        document.title = mOptions.title;

        $('meta[name=author]').attr('content', mOptions.author);

        mOptions.gameOver = false;
        mOptions.counter = parseInt(mOptions.desafioTime) * 60;
        mOptions.activeChallenge = 0;

        if (typeof mOptions.desafioID !== 'undefined') {
            const dataDesafio = $eXeDesafio.getDesafioStorage(
                mOptions.desafioID
            );
            if (dataDesafio) {
                if (
                    mOptions.desafioType !== dataDesafio.desafioType ||
                    dataDesafio.numberChallenges !==
                        mOptions.challengesGame.length ||
                    dataDesafio.desafioTime !== mOptions.desafioTime
                ) {
                    localStorage.removeItem(
                        `dataDesafio-${mOptions.desafioID}`
                    );
                } else {
                    $eXeDesafio.reloadGame(instance, dataDesafio);
                }
            }
        }

        $eXeDesafio.changeImageButtonState(instance, mOptions.typeQuestion);

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        $('#desafioMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $eXeDesafio.sendScore(false, instance);
                $eXeDesafio.saveEvaluation(instance);
            });

        setTimeout(() => {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                this.isInExe
            );
        }, 500);
    },

    refreshGame: function (instance) {
        const mOptions = $eXeDesafio.options[instance];

        if (!mOptions) return;

        $eXeDesafio.changeImageButtonState(instance, mOptions.typeQuestion);
    },

    removeEvents: function (instance) {
        $(window).off('unload.eXeChallenger beforeunload.eXeChallenger');
        $(`#desafioLinkMaximize-${instance}`).off('click touchstart');
        $(`#desafioLinkMinimize-${instance}`).off('click touchstart');
        $(`#desafioSolution-${instance}`).off('keydown');
        $(`#desafioGameChallenges-${instance}`).off(
            'click touchstart',
            '.desafio-LinkChallenge'
        );
        $(`#desafioDesafio-${instance}`).off('click touchstart');
        $(`#desafioRebootButton-${instance}`).off('click touchstart');
        $(`#desafioStartGame-${instance}`).off('click');
        $(`#desafioSolutionButton-${instance}`).off('click touchstart');
        $('#desafioMainContainer-' + instance)
            .closest('.idevice_node')
            .off('click', '.Games-SendScore');
    },

    rebootGame: function (instance) {
        const mOptions = $eXeDesafio.options[instance];

        clearInterval(mOptions.counterClock);

        localStorage.removeItem('dataDesafio-' + mOptions.desafioID);
        mOptions.stateChallenges = $eXeDesafio.createArrayStateChallenges(
            mOptions.desafioType,
            mOptions.challengesGame.length
        );

        mOptions.gameOver = false;
        mOptions.counter = parseInt(mOptions.desafioTime, 10) * 60;
        mOptions.activeChallenge = 0;

        localStorage.removeItem('dataEvaluation-' + instance);

        mOptions.gameStarted = false;
        mOptions.started = false;
        mOptions.endGame = false;
        mOptions.desafioDate = '';
        mOptions.desafioSolved = false;
        mOptions.typeQuestion = 0;
        mOptions.solvedsChallenges = [];
        mOptions.timesShow = [];

        for (let i = 0; i < mOptions.challengesGame.length; i++) {
            mOptions.timesShow.push(10000000);
        }
        $eXeDesafio.startGame(
            instance,
            mOptions.typeQuestion,
            mOptions.activeChallenge
        );
    },

    showDesafio: function (instance) {
        const mOptions = $eXeDesafio.options[instance];
        let message = mOptions.msgs.msgChallengesAllCompleted,
            type = 2;

        mOptions.typeQuestion = 0;
        mOptions.activeChallenge = 0;

        $('#desafioSolution-' + instance)
            .prop('readonly', false)
            .val('');
        $('#desafioSolutionDiv-' + instance).show();
        $('#desafioTitle-' + instance).text(mOptions.desafioTitle);
        $('#desafioDescription-' + instance).show();
        $('#desafioFeedBacks-' + instance).hide();

        for (let i = 0; i < mOptions.stateChallenges.length; i++) {
            if (i < mOptions.challengesGame.length) {
                const mc = mOptions.stateChallenges[i];
                if (mc.state > 0) {
                    if (mc.solved === 0) {
                        mc.state = 1;
                        type = 1;
                        $('#desafioSolution-' + instance).prop(
                            'readonly',
                            true
                        );
                        $('#desafioSolutionDiv-' + instance).hide();
                        message = mOptions.msgs.msgCompleteAllChallenged;
                    } else {
                        mc.state = 2;
                    }
                }
            }
        }

        $eXeDesafio.showMessage(type, message, instance);
        $eXeDesafio.changeImageButtonState(instance, mOptions.typeQuestion);
        $('#desafioClues-' + instance).html('');
        const desafioHtml = $('.desafio-IDevice').html();
        if ($exeDevices.iDevice.gamification.math.hasLatex(desafioHtml)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '.desafio-IDevice'
            );
        }
    },

    showChallenge: function (number, instance) {
        const mOptions = $eXeDesafio.options[instance],
            solution = mOptions.challengesGame[number].solution,
            title = mOptions.challengesGame[number].title,
            solved = mOptions.stateChallenges[number].solved;

        let type = 0,
            message = mOptions.msgs.msgWriteChallenge;

        if (mOptions.stateChallenges[number].state === 0) {
            return;
        }
        if (mOptions.timesShow[number] === 10000000) {
            mOptions.timesShow[number] = mOptions.counter;
        }
        $eXeDesafio.changeStateButton(instance);
        $('#desafioSolutionDiv-' + instance).show();

        mOptions.typeQuestion = 1;
        mOptions.activeChallenge = number;
        mOptions.stateChallenges[number].state = 3;

        $('#desafioSolution-' + instance)
            .prop('readonly', false)
            .val('');
        $('#desafioTitle-' + instance).text(title);
        $('#desafioFeedBacks-' + instance).show();

        const $chs = $('#desafioFeedBacks-' + instance).children('div');
        $chs.hide();
        $chs.eq(number).show();
        $('#desafioDescription-' + instance).hide();

        if (solved === 1) {
            $('#desafioSolution-' + instance)
                .val(solution)
                .prop('readonly', true);
            type = 1;
            message = mOptions.msgs.msgSolvedChallenge;
        }

        $eXeDesafio.showMessage(type, message, instance);
        $eXeDesafio.changeImageButtonState(instance, mOptions.typeQuestion);
        $eXeDesafio.showClues(number, instance);
        const desafioHtml = $('.desafio-IDevice').html();
        if ($exeDevices.iDevice.gamification.math.hasLatex(desafioHtml)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '.desafio-IDevice'
            );
        }
    },

    showClues(number, instance) {
        const mOptions = $eXeDesafio.options[instance];
        let text = '';

        if (typeof mOptions.challengesGame[number].clueTimes !== 'undefined') {
            const tmp = mOptions.timesShow[number] - mOptions.counter;
            for (
                let i = 0;
                i < mOptions.challengesGame[number].clueTimes.length;
                i++
            ) {
                if (mOptions.challengesGame[number].clueTimes[i] <= tmp) {
                    text += `<p><strong>${mOptions.msgs.msgHelp} ${i + 1}:</strong> ${mOptions.challengesGame[number].clueTexts[i]}</p>`;
                }
            }
        }

        $('#desafioClues-' + instance).html(text);
        if ($exeDevices.iDevice.gamification.math.hasLatex(text)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '.desafio-IDevice'
            );
        }
    },

    saveDataStorage: function (instance) {
        const mOptions = $eXeDesafio.options[instance];
        if (typeof mOptions.desafioID === 'undefined') return;

        if (mOptions.desafioDate === '') {
            mOptions.desafioDate = $eXeDesafio.getActualFullDate();
            $('#desafioDate-' + instance).text(
                `${mOptions.msgs.msgStartTime}: ${mOptions.desafioDate}`
            );
        }

        const data = {
            desafioID: mOptions.desafioID,
            started: mOptions.gameStarted || mOptions.gameOver,
            endGame: mOptions.endGame,
            desafioSolved: mOptions.desafioSolved,
            counter: mOptions.counter,
            desafioDate: mOptions.desafioDate,
            desafioTime: mOptions.desafioTime,
            activeChallenge: mOptions.activeChallenge,
            desafioType: mOptions.desafioType,
            numberChallenges: mOptions.challengesGame.length,
            typeQuestion: mOptions.typeQuestion,
            solvedsChallenges: mOptions.solvedsChallenges,
            stateChallenges: mOptions.stateChallenges,
            timesShow: mOptions.timesShow,
        };

        if (mOptions.isScorm === 1) {
            const points = mOptions.desafioSolved
                ? mOptions.solvedsChallenges.length + 1
                : mOptions.solvedsChallenges.length;
            let score = (
                10 *
                (points / (mOptions.challengesGame.length + 1))
            ).toFixed(2);
            $eXeDesafio.sendScore(true, instance);
            $('#desafioRepeatActivity-' + instance).text(
                `${mOptions.msgs.msgYouScore}: ${score}`
            );
        }
        localStorage.setItem(
            'dataDesafio-' + mOptions.desafioID,
            JSON.stringify(data)
        );
    },

    changeStateButton: function (instance) {
        const mOptions = $eXeDesafio.options[instance];
        for (let i = 0; i < mOptions.stateChallenges.length; i++) {
            if (mOptions.desafioType === 0) {
                if (i < mOptions.solvedsChallenges.length) {
                    mOptions.stateChallenges[i].state = 2;
                } else if (
                    mOptions.solvedsChallenges.length <
                    mOptions.stateChallenges.length
                ) {
                    mOptions.stateChallenges[
                        mOptions.solvedsChallenges.length
                    ].state = 1;
                }
            } else {
                if (mOptions.stateChallenges[i].state > 0) {
                    mOptions.stateChallenges[i].state = 1;
                    if (mOptions.stateChallenges[i].solved === 1) {
                        mOptions.stateChallenges[i].state = 2;
                    }
                }
            }
        }
    },

    getDesafioStorage: function (id) {
        return $exeDevices.iDevice.gamification.helpers.isJsonString(
            localStorage.getItem('dataDesafio-' + id)
        );
    },

    showScoreGame: function (type, instance) {
        const mOptions = $eXeDesafio.options[instance],
            msgs = mOptions.msgs,
            $desafioHistGGame = $('#desafioHistGGame-' + instance),
            $desafioLostGGame = $('#desafioLostGGame-' + instance),
            $desafioOverPoint = $('#desafioOverScore-' + instance),
            $desafioGamerOver = $('#desafioGamerOver-' + instance);

        let message = '',
            mtype = 2;

        $desafioHistGGame.hide();
        $desafioLostGGame.hide();
        $desafioOverPoint.show();

        switch (parseInt(type, 10)) {
            case 0:
                message = `${$eXeDesafio.getRetroFeedMessages(true, instance)} ${msgs.msgDesafioSolved}`;
                $desafioHistGGame.show();
                break;
            case 1:
                mtype = 1;
                message = msgs.msgEndTimeRestart;
                $desafioLostGGame.show();
                break;
            case 2:
                message = msgs.msgInformationLooking;
                $desafioOverPoint.hide();
                break;
            default:
                break;
        }

        $eXeDesafio.showMessage(mtype, message, instance);
        $desafioOverPoint.text(
            `${msgs.msgChallengesCompleted}: ${mOptions.solvedsChallenges.length}`
        );
        $desafioGamerOver.show();
        $('#desafioDescription-' + instance).hide();
    },

    reloadGame: function (instance, dataDesafio) {
        const mOptions = $eXeDesafio.options[instance];
        let colorMessage = 1;

        mOptions.started = dataDesafio.started;
        mOptions.counter = dataDesafio.counter;
        mOptions.activeChallenge = dataDesafio.activeChallenge;
        mOptions.desafioDate = dataDesafio.desafioDate;
        mOptions.typeQuestion = dataDesafio.typeQuestion;
        mOptions.endGame = dataDesafio.endGame;
        mOptions.desafioSolved = dataDesafio.desafioSolved;
        mOptions.stateChallenges = dataDesafio.stateChallenges;
        mOptions.solvedsChallenges = dataDesafio.solvedsChallenges;

        if (typeof dataDesafio.timesShow !== 'undefined') {
            mOptions.timesShow = dataDesafio.timesShow;
        }

        $('#desafioDate-' + instance).text(
            `${mOptions.msgs.msgStartTime}: ${dataDesafio.desafioDate}`
        );

        const ds = dataDesafio.desafioSolved ? 0 : 1;

        if (mOptions.endGame) {
            let message = mOptions.msgs.msgDesafioSolved;
            colorMessage = 2;

            if (!dataDesafio.desafioSolved) {
                message = mOptions.msgs.msgEndTimeRestart;
                colorMessage = 1;
            }
            $eXeDesafio.gameOver(ds, instance);
            $('#desafioStartGameDiv-' + instance).hide();
            $eXeDesafio.showMessage(colorMessage, message, instance);
        } else {
            $eXeDesafio.startGame(
                instance,
                mOptions.typeQuestion,
                mOptions.activeChallenge
            );
        }
    },

    startGame: function (instance, type, numberButton) {
        const mOptions = $eXeDesafio.options[instance];

        if (mOptions.gameStarted) {
            return;
        }

        let imgDesafio = 'desafioicon0.png';
        imgDesafio = `url(${$eXeDesafio.idevicePath}${imgDesafio}) no-repeat`;

        $(`desafioDesafio-${instance}`).css({
            background: imgDesafio,
            'background-size': 'cover',
        });

        $(`#desafioDescription-${instance}`).show();
        $(`#desafioTitle-${instance}`).show();
        $(`#desafioMultimedia-${instance}`).hide();
        $(`#desafioStartGameDiv-${instance}`).hide();

        mOptions.gameActived = false;
        mOptions.gameStarted = false;
        $eXeDesafio.updateTime(0, instance);

        $(`#desafioGamerOver-${instance}`).hide();
        let message = mOptions.msgs.msgReadTime;

        if (type === 0) {
            if (
                mOptions.solvedsChallenges.length >=
                mOptions.challengesGame.length
            ) {
                message = mOptions.msgs.msgChallengesAllCompleted;
            }
            $eXeDesafio.showDesafio(instance);
            $eXeDesafio.showMessage(2, message, instance);
        } else if (type === 1) {
            $eXeDesafio.showChallenge(numberButton, instance);
        }

        mOptions.counterClock = setInterval(() => {
            if (mOptions.gameStarted) {
                let $node = $('#desafioMainContainer-' + instance);
                let $content = $('#node-content');
                if (
                    !$node.length ||
                    ($content.length && $content.attr('mode') === 'edition')
                ) {
                    clearInterval(mOptions.counterClock);
                    return;
                }
                mOptions.counter--;
                $eXeDesafio.updateTime(mOptions.counter, instance);
                if (mOptions.counter <= 0) {
                    $eXeDesafio.gameOver(1, instance);
                }
                if (mOptions.typeQuestion === 1) {
                    const tmp =
                        mOptions.timesShow[mOptions.activeChallenge] -
                        mOptions.counter;
                    if (
                        mOptions.challengesGame[
                            mOptions.activeChallenge
                        ].clueTimes.indexOf(tmp) !== -1
                    ) {
                        $eXeDesafio.showClues(
                            mOptions.activeChallenge,
                            instance
                        );
                    }
                }
            }
        }, 1000);

        mOptions.gameStarted = true;
        mOptions.gameActived = true;
        $eXeDesafio.saveDataStorage(instance);
    },

    updateTime: function (tiempo, instance) {
        const mTime = $eXeDesafio.getTimeToString(tiempo);
        $('#desafioPTime-' + instance).text(mTime);
    },

    getTimeToString: function (iTime) {
        let mHours = Math.floor(parseInt(iTime) / 3600);
        let mMinutes = parseInt(iTime / 60) % 60;
        let mSeconds = iTime % 60;
        return (
            (mHours < 10 ? '0' + mHours : mHours) +
            ':' +
            (mMinutes < 10 ? '0' + mMinutes : mMinutes) +
            ':' +
            (mSeconds < 10 ? '0' + mSeconds : mSeconds)
        );
    },

    gameOver: function (type, instance) {
        const mOptions = $eXeDesafio.options[instance];

        mOptions.gameStarted = false;
        mOptions.gameActived = false;

        clearInterval(mOptions.counterClock);

        $(`#desafioTitle-${instance}`).hide();
        $(`#desafioDescription-${instance}`).hide();
        $(`#desafioSolutionDiv-${instance}`).hide();
        $(`#desafioMultimedia-${instance}`).show();
        $(`#desafioCover-${instance}`).hide();
        $(`#desafioImagen-${instance}`).hide();
        $(`#desafioFeedBacks-${instance}`).hide();
        $(`#desafioClues-${instance}`).html('');

        const message =
            type === 0
                ? mOptions.msgs.msgDesafioSolved
                : mOptions.msgs.msgEndTime;
        $eXeDesafio.showMessage(2, message, instance);
        $eXeDesafio.showScoreGame(type, instance);
        mOptions.gameOver = true;
        mOptions.endGame = true;
    },

    getRetroFeedMessages: function (iHit, instance) {
        const msgs = $eXeDesafio.options[instance].msgs;
        let sMessages = iHit ? msgs.msgSuccesses : msgs.msgFailures;

        sMessages = sMessages.split('|');
        return sMessages[Math.floor(Math.random() * sMessages.length)];
    },

    answerChallenge: function (instance) {
        const mOptions = $eXeDesafio.options[instance],
            challengeGame = mOptions.challengesGame[mOptions.activeChallenge],
            active = mOptions.activeChallenge;

        let answord = $(`#desafioSolution-${instance}`).val().toUpperCase(),
            message = '',
            typeMessage = 0;

        answord = answord.replace(/\s+/g, ' ').trim();

        if (!mOptions.gameStarted) {
            return;
        }

        if (answord.length === 0) {
            $eXeDesafio.showMessage(1, mOptions.msgs.msgIndicateWord, instance);
            return;
        }

        if (mOptions.typeQuestion === 0) {
            if ($eXeDesafio.checkWord(mOptions.desafioSolution, answord)) {
                message = `${$eXeDesafio.getRetroFeedMessages(true, instance)}${mOptions.msgs.msgDesafioSolved}`;
                typeMessage = 1;
                mOptions.desafioSolved = true;
                $eXeDesafio.saveDataStorage(instance);
                $eXeDesafio.saveEvaluation(instance);
                $eXeDesafio.gameOver(0, instance);
                return;
            } else {
                message = `${$eXeDesafio.getRetroFeedMessages(false, instance)}${mOptions.msgs.msgSolutionError}`;
                $(`#desafioSolution-${instance}`).val('');
                typeMessage = 0;
            }
        } else {
            if ($eXeDesafio.checkWord(challengeGame.solution, answord)) {
                typeMessage = 2;
                mOptions.stateChallenges[active].solved = 1;
                mOptions.solvedsChallenges.push(active);
                if (mOptions.desafioType === 0) {
                    if (active < mOptions.challengesGame.length - 1) {
                        message = `${$eXeDesafio.getRetroFeedMessages(true, instance)}${mOptions.msgs.msgChallengeSolved}`;
                        $eXeDesafio.showChallenge(active, instance);
                    } else {
                        $eXeDesafio.showDesafio(instance);
                        message = `${$eXeDesafio.getRetroFeedMessages(true, instance)}${mOptions.msgs.msgChallengesAllCompleted}`;
                        $(`#desafioSolution-${instance}`).val('');
                    }
                } else if (mOptions.desafioType === 1) {
                    if (
                        mOptions.solvedsChallenges.length >=
                        mOptions.challengesGame.length
                    ) {
                        $eXeDesafio.showDesafio(instance);
                        message = `${$eXeDesafio.getRetroFeedMessages(true, instance)}${mOptions.msgs.msgChallengesAllCompleted}`;
                        $(`#desafioSolution-${instance}`).val('');
                    } else {
                        $eXeDesafio.showChallenge(active, instance);
                        message = `${$eXeDesafio.getRetroFeedMessages(true, instance)}${mOptions.msgs.msgChallengeSolved}`;
                    }
                }
                $eXeDesafio.saveDataStorage(instance);
                $eXeDesafio.saveEvaluation(instance);
            } else {
                message = `${$eXeDesafio.getRetroFeedMessages(false, instance)}${mOptions.msgs.msgSolutionCError}`;
                typeMessage = 1;
                $(`#desafioSolution-${instance}`).val('');
            }
        }

        $eXeDesafio.showMessage(typeMessage, message, instance);
    },

    showMessageAlert: function (tmsg) {
        window.alert(tmsg);
    },

    showMessage: function (type, message, instance) {
        const colors = [
                '#555555',
                $eXeDesafio.borderColors.red,
                $eXeDesafio.borderColors.green,
                $eXeDesafio.borderColors.blue,
                $eXeDesafio.borderColors.yellow,
            ],
            color = colors[type];

        $(`#desafioPInformation-${instance}`).text(message).css({
            color: color,
            'font-weight': 'normal',
            'font-size': $eXeDesafio.fontSize,
        });
    },
};
$(function () {
    $eXeDesafio.init();
});
