/* eslint-disable no-undef */
/**
 * Rosco Activity iDevice (Export)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 *
 * Author: Manuel Narváez Martínez
 * Author: Ricardo Málaga Floriano
 * Author: Ignacio Gros
 * Iconos: Ana María Zamora Moreno y Francisco Javier Pulido
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 *
 */

var $azquizgame = {
    idevicePath: '',
    mcanvas: {
        width: 360,
        height: 360,
    },
    colors: {
        black: '#f9f9f9',
        blue: '#5877c6',
        green: '#00a300',
        red: '#b3092f',
        white: '#ffffff',
        yellow: '#f3d55a',
        blackl: '#333333',
    },
    letters: '',
    angleSize: '',
    radiusLetter: 16,
    options: [],
    msgs: {},
    hasSCORMbutton: false,
    isInExe: false,
    userName: '',
    previousScore: '',
    initialScore: '',
    started: false,
    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',
    mScorm: null,
    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            'A-Z quiz',
            'az-quiz-game',
            'rosco-IDevice'
        );
    },

    enable: function () {
        $azquizgame.loadGame();
    },

    loadGame: function () {
        $azquizgame.options = [];

        $('.rosco-IDevice').each(function (i) {
            const version = $('.rosco-version', this).eq(0).text(),
                dl = $('.rosco-DataGame', this),
                imagesLink = $('.rosco-LinkImages', this),
                audiosLink = $('.rosco-LinkAudios', this),
                option = $azquizgame.loadDataGame(
                    dl,
                    imagesLink,
                    audiosLink,
                    version
                );

            option.radiusLetter =
                16 + Math.floor((27 - option.letters.length) / 3);
            option.angleSize = (2 * Math.PI) / option.letters.length;

            option.scorerp = 0;
            option.idevicePath = $azquizgame.idevicePath;
            option.main = 'roscoMainContainer-' + i;
            option.idevice = 'rosco-IDevice';

            $azquizgame.options.push(option);

            const rosco = $azquizgame.createInterfaceRosco(i);
            dl.before(rosco).remove();

            const msg = $azquizgame.options[i].msgs.msgPlayStart;

            $('#roscoGameMinimize-' + i).hide();
            $('#roscoGameContainer-' + i).hide();
            $('#roscoGame-' + i).hide();

            $azquizgame.addEvents(i);

            if ($azquizgame.options[i].showMinimize) {
                $('#roscoGameMinimize-' + i)
                    .css('cursor', 'pointer')
                    .show();
            } else {
                $('#roscoGameContainer-' + i).show();
                $('#roscoGame-' + i).show();
            }

            $('#roscoMessageMaximize-' + i).text(msg);
            $('#roscoMainContainer-' + i)
                .css('display', 'flex')
                .show();
        });

        let node = document.querySelector('.page-content');
        if (this.isInExe) {
            node = document.getElementById('node-content');
        }
        if (node)
            $exeDevices.iDevice.gamification.observers.observeResize(
                $azquizgame,
                node
            );

        $exeDevices.iDevice.gamification.math.updateLatex('.rosco-IDevice');
    },

    loadDataGame: function (data, imgsLink, audiosLink, version) {
        let json = data.text();
        version =
            typeof version === 'undefined' || version === ''
                ? 0
                : parseInt(version, 10);
        if (version > 0)
            json = $exeDevices.iDevice.gamification.helpers.decrypt(json);
        let mOptions =
            $exeDevices.iDevice.gamification.helpers.isJsonString(json);

        mOptions.playerAudio = '';
        mOptions.gameOver = false;
        mOptions.modeBoard = mOptions.modeBoard ?? false;
        mOptions.evaluation = mOptions.evaluation ?? false;
        mOptions.evaluationID = mOptions.evaluationID ?? '';

        imgsLink.each(function (index) {
            const url = $(this).attr('href');
            mOptions.wordsGame[index].url = url && url.length >= 4 ? url : '';
        });

        audiosLink.each(function (index) {
            const audio = $(this).attr('href');
            mOptions.wordsGame[index].audio =
                audio && audio.length >= 4 ? audio : '';
        });

        mOptions.wordsGame.forEach((wordGame) => {
            if (version < 2) {
                wordGame.audio = wordGame.audio ?? '';
            }
            wordGame.url = $exeDevices.iDevice.gamification.media.extractURLGD(
                wordGame.url
            );
        });

        return mOptions;
    },

    createInterfaceRosco: function (instance) {
        const aLetters = this.getLettersRosco(instance),
            mOptions = this.options[instance],
            sTime = $exeDevices.iDevice.gamification.helpers.getTimeToString(
                mOptions.durationGame
            ),
            msgs = mOptions.msgs,
            path = $azquizgame.idevicePath,
            html = `
            <div class="rosco-IdeviceForm">
                <div class="rosco-Main" id="roscoMain-${instance}">
                    <div class="rosco-MainContainer" id="roscoMainContainer-${instance}">
             
                    <div class="rosco-GameMinimize" id="roscoGameMinimize-${instance}">
                            <a href="#" class="rosco-LinkMaximize" id="roscoLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                                <img src="${path}rosco-icon.png" class="rosco-IconMinimize" id="roscoIcon-${instance}" alt="">
                                <div class="rosco-MessageMaximize" id="roscoMessageMaximize-${instance}">${msgs.msgPlayStart}</div>
                            </a>
                        </div>
                        <div class="rosco-GameContainer" id="roscoGameContainer-${instance}">
                            <div class="rosco-GameScoreBoard">
                                <div class="rosco-GameScores">
                                    <strong class="sr-av">${msgs.msgHits}:</strong>
                                    <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                                    <p id="roscotPHits-${instance}">0</p>
                                    <strong class="sr-av">${msgs.msgErrors}:</strong>
                                    <div class="exeQuextIcons exeQuextIcons-Error" title="${msgs.msgErrors}"></div>
                                    <p id="roscotPErrors-${instance}">0</p>
                                </div>
                                <div class="rosco-TimeNumber">
                                    <strong class="sr-av">${msgs.msgTime}:</strong>
                                    <div class="exeQuextIcons exeQuextIcons-Time" title="${msgs.msgTime}"></div>
                                    <p class="rosco-PTime" id="roscoPTime-${instance}">${sTime}</p>
                                    <div class="exeQuextIcons exeQuextIcons-OneRound" id="roscoNumberRounds-${instance}" title="${msgs.msgOneRound}"></div>
                                    <strong class="sr-av" id="roscoNumberRoundsSpan-${instance}">${msgs.msgOneRound}:</strong>
                                    <a href="#" class="rosco-LinkTypeGame" id="roscoLinkTypeGame-${instance}" title="${msgs.msgHideRoulette}">
                                        <strong class="sr-av">${msgs.msgHideRoulette}:</strong>
                                        <div class="exeQuextIcons exeQuextIcons-RoscoRows" id="roscoTypeGame-${instance}"></div>
                                    </a>
                                    <a href="#" class="rosco-LinkArrowMinimize" id="roscoLinkArrowMinimize-${instance}" title="${msgs.msgMinimize}">
                                        <strong class="sr-av">${msgs.msgMinimize}:</strong>
                                        <div class="exeQuextIcons exeQuextIcons-Minimize"></div>
                                    </a>
                                    <a href="#" class="rosco-LinkFullScreen" id="roscoLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                                        <strong class="sr-av">${msgs.msgFullScreen}:</strong>
                                        <div class="exeQuextIcons exeQuextIcons-FullScreen" id="roscoFullScreen-${instance}"></div>
                                    </a>
                                </div>
                            </div>
                            <div class="rosco-Letters" id="roscoLetters-${instance}">${aLetters}</div>
                            <div class="rosco-ShowClue" id="roscoShowClue-${instance}">
                                <div class="sr-av">${msgs.msgClue}:</div>
                                <p class="rosco-PShowClue rosco-parpadea" id="roscoPShowClue-${instance}"></p>
                            </div>
                            <div class="rosco-MultimediaNeo" id="roscoMultimedia-${instance}">
                                <div class="rosco-Protector" id="roscoProtector-${instance}"></div>
                                <img src="${path}exequextcursor.gif" class="rosco-Cursor" alt="" id="roscoCursor-${instance}"/> 
                                <img src="" class="rosco-ImageNeo" alt="${msgs.msgNoImage}" id="roscoImage-${instance}"/> 
                                <img src="${path}roscoHome.png" class="rosco-NoImage" alt="${msgs.msgNoImage}" id="roscoNoImage-${instance}"/> 
                                <a href="#" class="rosco-LinkAudio" id="roscoLinkAudio-${instance}" title="${msgs.msgAudio}"><img src="${path}exequextaudio.png" alt="${msgs.msgAudio}"></a>
                                <a href="#" class="rosco-FullLinkImage" id="roscoFullLinkImage-${instance}" title="${mOptions.msgs.msgFullScreen}">
                                    <strong><span class="sr-av">${mOptions.msgs.msgFullScreen}:</span></strong>
                                    <div  class="exeQuextIcons exeQuextIcons-FullImage rosco-Activo"></div>
                                </a>
                            </div>
                            <div class="rosco-AuthorLicence" id="roscoAutorLicence-${instance}">
                                <div class="sr-av">${msgs.msgAuthor}:</div>
                                <p id="roscoAuthor-${instance}"></p>
                            </div>
                            <div class="rosco-Messages" id="roscoMessages-${instance}">
                                <p id="roscoPMessages-${instance}">${msgs.msgReady}</p>
                            </div>
                            <div class="sr-av" id="roscoStartGameSRAV-${instance}">${msgs.msgPlayStart}:</div>
                            <div class="rosco-StartGame"><a href="#" id="roscoStartGame-${instance}"></a></div>
                            <div class="rosco-StartGame"><a href="#" id="roscoShowWords-${instance}" style="display:none">${msgs.msgShowWords}</a></div>
                            <div class="rosco-QuestionDiv" id="roscoQuestionDiv-${instance}">
                                <div class="rosco-TypeDefinition" id="roscoTypeDefinition-${instance}">
                                    <p id="roscoPStartWith-${instance}">${msgs.msgStartWith}</p>
                                </div>
                                <div class="rosco-Definition" id="roscoDefinition-${instance}">
                                    <h3 class="sr-av">${msgs.msgQuestion}:</h3>
                                    <p id="roscoPDefinition-${instance}"></p>
                                </div>
                                <div class="rosco-DivReply" id="roscoDivReply-${instance}">
                                    <a href="#" id="roscoBtnMoveOn-${instance}" title="${msgs.msgMoveOne}">
                                        <strong class="sr-av">${msgs.msgMoveOne}</strong>
                                        <div class="exeQuextIcons-MoveOne"></div>
                                    </a>
                                    <label for="roscoEdReply-${instance}" class="sr-av">${msgs.msgReply}</label>
                                    <input type="text" value="" class="rosco-EdReply form-control" id="roscoEdReply-${instance}" autocomplete="off">
                                    <a href="#" id="roscoBtnReply-${instance}" title="${msgs.msgReply}">
                                        <strong class="sr-av">${msgs.msgReply}</strong>
                                        <div class="exeQuextIcons-Submit"></div>
                                    </a>
                                </div>
                            </div>
                            <div class="rosco-DivModeBoard" id="roscoDivModeBoard-${instance}">
                                <a href="#" class="rosco-ModeBoard" id="roscoModeBoardOK-${instance}" title="">${msgs.msgCorrect}</a>
                                <a href="#" class="rosco-ModeBoard" id="roscoModeBoardMoveOn-${instance}" title="">${msgs.msgMoveOne}</a>
                                <a href="#" class="rosco-ModeBoard" id="roscoModeBoardKO-${instance}" title="">${msgs.msgIncorrect}</a>
                            </div>
                            <div class="rosco-DivInstructions" id="roscoDivInstructions-${instance}">${msgs.msgWrote}</div>
                        </div>
                        <div id="roscoGame-${instance}" class="rosco-Game">
                            <canvas class="rosco-Canvas" id="roscoCanvas-${instance}" width="360px" height="360px">
                                Your browser does not support the HTML5 canvas tag
                            </canvas>
                        </div>
                        <div class="rosco-Cubierta" id="roscoCubierta-${instance}" style="display:none">
                            <div class="rosco-CodeAccessDiv" id="roscoCodeAccessDiv-${instance}">
                                <div class="rosco-MessageCodeAccessE" id="roscoMesajeAccesCodeE-${instance}"></div>
                                <div class="rosco-DataCodeAccessE">
                                    <label for="roscoEdCodeAccess-${instance}" class="sr-av">${msgs.msgCodeAccess}:</label>
                                    <input type="text" class="rosco-CodeAccessE form-control" id="roscoEdCodeAccess-${instance}" placeholder="${msgs.msgCodeAccess}">
                                    <a href="#" id="roscoCodeAccessButton-${instance}" title="${msgs.msgReply}">
                                    <strong class="sr-av">${msgs.msgReply}</strong>
                                    <div class="exeQuextIcons-Submit"></div>
                                    </a>
                                </div>
                            </div>
                            <div class="rosco-ShowWordsDiv" id="roscoShowWordsDiv-${instance}">
                                <div class="rosco-ShowAnswerDiv">
                                    <a href="#" id="roscoShowAll-${instance}">${msgs.msgAll}</a>
                                    <a href="#" id="roscoShowHits-${instance}">${msgs.msgHits}</a>
                                    <a href="#" id="roscoShowErrors-${instance}">${msgs.msgErrors}</a>
                                    <a href="#" id="roscoShowUnanswered-${instance}">${msgs.msgUnanswered}</a>
                                </div>
                                <div class="rosco-Words" id="roscoWords-${instance}"></div>
                                <a href="#" class="rosco-WordsClose" id="roscoWordsClose-${instance}" title=""><strong>${msgs.msgClose}</strong></a>
                            </div>
                        </div>
                    </div>
                </div>
                ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}
            </div>
        `;
        return html;
    },

    showCubiertaOptions: function (mode, instance) {
        if (mode === false) $('#roscoCubierta-' + instance).fadeOut();
        else $('#roscoCubierta-' + instance).fadeIn();
    },

    renderWords: function (instance, type, mode) {
        const mOptions = $azquizgame.options[instance],
            words = mOptions.wordsGame;

        if (!type) {
            $('#roscoCubierta-' + instance).slideUp();
            $('#roscoShowWordsDiv-' + instance).slideUp();
            $('#roscoShowWords-' + instance).show();
            return;
        }

        const $links = $('#roscoCubierta-' + instance)
            .find('.rosco-ShowAnswerDiv')
            .find('a');
        $links.removeClass('rosco-ModeShow');
        $links.eq(mode).addClass('rosco-ModeShow');

        const $wordsDiv = $('#roscoWords-' + instance);
        $wordsDiv.empty();

        let j = 0;

        $.each(words, function (index, wordObj) {
            if (wordObj.word && wordObj.word.trim().length > 0) {
                if (mode == 1 && wordObj.correct != 1) return;
                if (mode == 2 && wordObj.correct != 2) return;
                if (mode == 3 && wordObj.correct != 0) return;

                let className = 'rosco-unanswered';
                if (wordObj.correct == 1) className = 'rosco-correct';
                else if (wordObj.correct == 2) className = 'rosco-incorrect';

                let typeText =
                    wordObj.type === 0
                        ? mOptions.msgs.msgStartWith
                        : mOptions.msgs.msgContaint;
                typeText = typeText.replace('%1', wordObj.letter);

                const bgColorClass =
                    j % 2 === 0 ? 'rosco-bg-gray-1' : 'rosco-bg-gray-2';
                let paragraph = `<p class="${className} ${bgColorClass}"><span>${typeText}. ${wordObj.word}</span>: ${wordObj.definition}`;

                if (wordObj.audio) {
                    paragraph += `<img src="${$azquizgame.idevicePath}exequextaudio.png" class="rosco-audioicon" data-audio="${wordObj.audio}" alt="${mOptions.msgs.msgAudio}" />`;
                }

                paragraph += '</p>';
                $wordsDiv.append(paragraph);
                j++;
            }
        });

        $('#roscoShowWords-' + instance).hide();
        $('#roscoCodeAccessDiv-' + instance).hide();
        $('#roscoCubierta-' + instance).show();
        $('#roscoShowWordsDiv-' + instance).slideDown();
    },

    getLettersRosco: function (instance) {
        const mOptions = $azquizgame.options[instance],
            letras = mOptions.letters,
            mLetters = [];

        for (let i = 0; i < mOptions.wordsGame.length; i++) {
            let letter = `<div class="rosco-Letter rosco-LetterBlack" id="letterR${letras[i]}-${instance}">${letras[i]}</div>`;
            const word = $.trim(mOptions.wordsGame[i].word);
            if (word.length > 0) {
                letter = `<div class="rosco-Letter" id="letterR${letras[i]}-${instance}">${$azquizgame.getRealLetter(letras[i])}</div>`;
            }
            mLetters.push(letter);
        }

        return mLetters.join('');
    },

    removeEvents: function (instance) {
        $('#roscoCodeAccessButton-' + instance).off('click');
        $('#roscoStartGame-' + instance).off('click');
        $('#roscoLinkMaximize-' + instance).off('click touchstart');
        $('#roscoLinkArrowMinimize-' + instance).off('click touchstart');
        $('#roscoEdCodeAccess-' + instance).off('keydown');
        $('#roscoBtnMoveOn-' + instance).off('click');
        $('#roscoBtnReply-' + instance).off('click');
        $('#roscoEdReply-' + instance).off('keydown');
        $('#roscoLinkTypeGame-' + instance).off('click');
        $('#roscoLinkAudio-' + instance).off('click');
        $('#roscoMainContainer-' + instance)
            .closest('.idevice_node')
            .off('click', '.Games-SendScore');
        $('#roscoLinkFullScreen-' + instance).off('click touchstart');
        $('#roscoModeBoardOK-' + instance).off('click');
        $('#roscoModeBoardKO-' + instance).off('click');
        $('#roscoModeBoardMoveOn-' + instance).off('click');
        $('#roscoShowWords-' + instance).off('click');
        $('#roscoWordsClose-' + instance).off('click');
        $('#roscoShowAll-' + instance).off('click');
        $('#roscoShowHits-' + instance).off('click');
        $('#roscoShowErrors-' + instance).off('click');
        $('#roscoShowUnanswered-' + instance).off('click');
        $('#roscoCubierta-' + instance).off('click', '.rosco-audioicon');

        $(window).off('unload.eXeRosco beforeunload.eXeRosco');
    },

    addEvents: function (instance) {
        const mOptions = $azquizgame.options[instance],
            $roscoMainContainer = $('#roscoMainContainer-' + instance),
            $roscoTypeGame = $('#roscoTypeGame-' + instance);

        $azquizgame.removeEvents(instance);

        $('#roscoImage-' + instance).hide();
        $('#roscoCursor-' + instance).hide();
        $('#roscoQuestionDiv-' + instance).hide();
        $('#roscoStartGame-' + instance).show();
        $('#roscoPShowClue-' + instance).hide();

        $('#roscoCodeAccessButton-' + instance).on('click', function (e) {
            e.preventDefault();
            const keyIntroduced = $.trim(
                    $('#roscoEdCodeAccess-' + instance).val()
                ).toUpperCase(),
                correctKey = $.trim(
                    mOptions.itinerary.codeAccess
                ).toUpperCase();
            if (keyIntroduced === correctKey) {
                $azquizgame.showCubiertaOptions(false, instance);
                $('#roscoLinkMaximize-' + instance).trigger('click');
                $azquizgame.startGame(instance);
            } else {
                $('#roscoMesajeAccesCodeE-' + instance)
                    .fadeOut(300)
                    .fadeIn(200)
                    .fadeOut(300)
                    .fadeIn(200);
                $('#roscoEdCodeAccess-' + instance).val('');
            }
        });

        $('#roscoStartGame-' + instance)
            .text(mOptions.msgs.msgStartGame)
            .on('click', function (e) {
                e.preventDefault();
                $azquizgame.startGame(instance);
            });

        $('#roscoLinkMaximize-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $('#roscoGameContainer-' + instance).show();
                $('#roscoGame-' + instance).show();
                $('#roscoGameMinimize-' + instance).hide();
                $roscoTypeGame
                    .removeClass('exeQuextIcons-RoscoRows')
                    .addClass('exeQuextIcons-RoscoCanvas');
                $('#roscoLinkTypeGame-' + instance)
                    .find('span')
                    .text(mOptions.msgs.msgHideRoulette)
                    .attr('title', mOptions.msgs.msgHideRoulette);
            }
        );

        $('#roscoLinkArrowMinimize-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $('#roscoGame-' + instance).hide();
                $('#roscoLetters-' + instance).hide();
                $('#roscoGameContainer-' + instance).hide();
                $('#roscoGameMinimize-' + instance)
                    .css('visibility', 'visible')
                    .show();
            }
        );

        $('#roscoEdCodeAccess-' + instance).on('keydown', function (event) {
            if (event.which === 13 || event.keyCode === 13) {
                $('#roscoCodeAccessButton-' + instance).trigger('click');
                return false;
            }
            return true;
        });

        const mTime = mOptions.durationGame,
            sTime =
                $exeDevices.iDevice.gamification.helpers.getTimeToString(mTime),
            altTurn =
                mOptions.numberTurns === 1
                    ? mOptions.msgOneRound
                    : mOptions.msgTowRounds;

        if (mOptions.numberTurns === 0) {
            $('#roscoNumberRounds-' + instance).hide();
            $('#roscoNumberRoundsSpan-' + instance).hide();
        } else if (mOptions.numberTurns === 1) {
            $('#roscoNumberRounds-' + instance)
                .addClass('exeQuextIcons-OneRound')
                .removeClass('exeQuextIcons-TwoRounds')
                .attr('alt', 'One turn');
        } else if (mOptions.numberTurns === 2) {
            $('#roscoNumberRounds-' + instance)
                .addClass('exeQuextIcons-TwoRounds')
                .removeClass('exeQuextIcons-OneRound')
                .attr('alt', 'Two turns');
        }

        $('#roscoNumberRoundsSpan-' + instance).text(altTurn);
        $('#roscoPTime-' + instance).text(sTime);

        $('#roscoBtnMoveOn-' + instance).on('click', function (e) {
            e.preventDefault();
            $azquizgame.passWord(instance);
        });

        $('#roscoBtnReply-' + instance).on('click', function (e) {
            e.preventDefault();
            $azquizgame.answerQuetion(instance);
        });

        $('#roscoEdReply-' + instance).on('keydown', function (event) {
            if (event.which === 13 || event.keyCode === 13) {
                $azquizgame.answerQuetion(instance);
                return false;
            }
            return true;
        });

        const id = 'roscoCanvas-' + instance,
            rosco = document.getElementById(id);

        mOptions.ctxt = rosco.getContext('2d');
        $azquizgame.drawRosco(instance);

        $('#roscoLetters-' + instance).hide();
        $('#roscoMessages-' + instance).hide();
        $roscoTypeGame
            .removeClass('exeQuextIcons-RoscoRows')
            .addClass('exeQuextIcons-RoscoCanvas');

        $('#roscoLinkTypeGame-' + instance).on('click', function (e) {
            e.preventDefault();
            let alt = mOptions.msgs.msgHideRoulette;
            if ($roscoTypeGame.hasClass('exeQuextIcons-RoscoCanvas')) {
                $roscoTypeGame
                    .addClass('exeQuextIcons-RoscoRows')
                    .removeClass('exeQuextIcons-RoscoCanvas');
                $('#roscoLetters-' + instance).show();
                $('#roscoMessages-' + instance).show();
                $('#roscoGame-' + instance).hide();
                alt = mOptions.msgs.msgShowRoulette;
            } else {
                $roscoTypeGame
                    .addClass('exeQuextIcons-RoscoCanvas')
                    .removeClass('exeQuextIcons-RoscoRows');
                $('#roscoLetters-' + instance).hide();
                $('#roscoMessages-' + instance).hide();
                $('#roscoGame-' + instance).show();
            }
            $('#roscoLinkTypeGame-' + instance)
                .attr('title', alt)
                .find('span')
                .text(alt);
        });

        $azquizgame.drawText(
            mOptions.msgs.msgReady,
            $azquizgame.colors.blue,
            instance
        );
        $('#roscoPMessages-' + instance).css(
            'color',
            $azquizgame.colors.blackl
        );
        $azquizgame.drawRows(instance);

        $('#roscoMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $azquizgame.sendScore(false, instance);
                $azquizgame.saveEvaluation(instance);
            });

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        $(window).on('unload.eXeRosco beforeunload.eXeRosco', function () {
            if (typeof $azquizgame.mScorm !== 'undefined') {
                $exeDevices.iDevice.gamification.scorm.endScorm(
                    $azquizgame.mScorm
                );
                $azquizgame.gameOver(1, instance);
            }
        });

        $roscoTypeGame.show();

        if ($roscoMainContainer.width() < 670) {
            $roscoTypeGame
                .addClass('exeQuextIcons-RoscoRows')
                .removeClass('exeQuextIcons-RoscoCanvas');
            $('#roscoLetters-' + instance).show();
            $('#roscoMessages-' + instance).show();
            $('#roscoGame-' + instance).hide();
            $roscoTypeGame.hide();
        }

        $('#roscoLinkAudio-' + instance).on('click', function (e) {
            e.preventDefault();
            const audio = mOptions.wordsGame[mOptions.activeWord].audio;
            $exeDevices.iDevice.gamification.media.stopSound(mOptions);
            $exeDevices.iDevice.gamification.media.playSound(audio, mOptions);
        });

        $('#roscoLinkFullScreen-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                const element = document.getElementById(
                    'roscoMainContainer-' + instance
                );
                $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                    element
                );
            }
        );

        $('#roscoModeBoardOK-' + instance).on('click', function (e) {
            e.preventDefault();
            $azquizgame.answerQuetionBoard(true, instance);
        });

        $('#roscoModeBoardKO-' + instance).on('click', function (e) {
            e.preventDefault();
            $azquizgame.answerQuetionBoard(false, instance);
        });

        $('#roscoModeBoardMoveOn-' + instance).on('click', function (e) {
            e.preventDefault();
            $azquizgame.passWord(instance);
        });

        $('#roscoShowWords-' + instance).on('click', function (e) {
            e.preventDefault();
            $azquizgame.renderWords(instance, true, 0);
        });

        $('#roscoWordsClose-' + instance).on('click', function (e) {
            e.preventDefault();
            $azquizgame.renderWords(instance, false, 0);
        });

        $('#roscoShowAll-' + instance).click(function (e) {
            e.preventDefault();
            $azquizgame.renderWords(instance, true, 0);
        });

        $('#roscoShowHits-' + instance).click(function (e) {
            e.preventDefault();
            $azquizgame.renderWords(instance, true, 1);
        });

        $('#roscoShowErrors-' + instance).click(function (e) {
            e.preventDefault();
            $azquizgame.renderWords(instance, true, 2);
        });

        $('#roscoShowUnanswered-' + instance).click(function (e) {
            e.preventDefault();
            $azquizgame.renderWords(instance, true, 3);
        });

        $('#roscoCubierta-' + instance).on(
            'click',
            '.rosco-audioicon',
            function (e) {
                e.preventDefault();
                const audioSrc = $(this).data('audio');
                new Audio(audioSrc).play();
            }
        );
        if (mOptions.itinerary.showCodeAccess) {
            $('#roscoMesajeAccesCodeE-' + instance).text(
                mOptions.itinerary.messageCodeAccess
            );
            $('#roscoCodeAccessDiv-' + instance).show();
            if (mOptions.showMinimize) {
                $('#roscoCodeAccessDiv-' + instance).css({
                    'margin-top': '-3em',
                });
            }
            $('#roscoStartGame-' + instance).hide();
            $('#roscoDivInstructions-' + instance).hide();
            $azquizgame.showCubiertaOptions(true, instance);
        }

        setTimeout(function () {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                this.isInExe
            );
        }, 500);

        $('#roscoFullLinkImage-' + instance).on('click', function (e) {
            e.preventDefault();
            const largeImageSrc = $('#roscoImage-' + instance).attr('src');
            if (largeImageSrc && largeImageSrc.length > 3) {
                $exeDevices.iDevice.gamification.helpers.showFullscreenImage(
                    largeImageSrc,
                    $('#roscoGameContainer-' + instance)
                );
            }
        });
    },

    refreshGame: function (instance) {
        const mOptions = $azquizgame.options[instance];

        if (!mOptions) return;

        const $roscoMainContainer = $('#roscoMainContainer-' + instance);
        $roscoTypeGame = $('#roscoTypeGame-' + instance);

        if (!$roscoMainContainer.is(':visible ')) return;

        $roscoTypeGame.show();
        if ($roscoMainContainer.width() < 650) {
            $roscoTypeGame
                .addClass('exeQuextIcons-RoscoRows')
                .removeClass('exeQuextIcons-RoscoCanvas');
            $('#roscoLetters-' + instance).show();
            $('#roscoMessages-' + instance).show();
            $('#roscoGame-' + instance).hide();
            $roscoTypeGame.hide();
        }
        $azquizgame.refreshImageActiveNeo(instance);
    },

    startGame: function (instance) {
        const mOptions = $azquizgame.options[instance];

        if (mOptions.gameStarted) return;

        $('#roscoStartGame-' + instance).hide();
        $('#roscoCodeAccessDiv-' + instance).hide();
        $('#roscoQuestionDiv-' + instance).show();
        $('#roscoDivInstructions-' + instance).hide();
        $('#roscoShowWords-' + instance).hide();

        mOptions.obtainedClue = false;
        mOptions.hits = 0;
        mOptions.solucion = '';
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.counter = mOptions.durationGame;
        mOptions.gameActived = false;
        mOptions.gameOver = false;
        mOptions.activeGameSpin = 1;
        mOptions.validWords = 0;
        mOptions.answeredWords = 0;
        mOptions.activeWord = -1;

        for (let i = 0; i < mOptions.wordsGame.length; i++) {
            const word = mOptions.wordsGame[i];
            word.state = word.word.trim().length === 0 ? 0 : 1;
            word.correct = 0;

            let mBackColor = $azquizgame.colors.black;
            if (word.state === 1) {
                mOptions.validWords++;
                mBackColor = $azquizgame.colors.blue;
            }

            const letter = `#letterR${mOptions.letters.charAt(i)}-${instance}`;
            $(letter).css({
                'background-color': mBackColor,
                color: $azquizgame.colors.white,
            });
        }

        $azquizgame.updateTime(mOptions.durationGame, instance);
        $azquizgame.drawRosco(instance);

        mOptions.counterClock = setInterval(function () {
            let $node = $('#roscoMainContainer-' + instance);
            let $content = $('#node-content');
            if (
                !$node.length ||
                ($content.length && $content.attr('mode') === 'edition')
            ) {
                clearInterval(mOptions.counterClock);
                return;
            }
            $azquizgame.updateTime(mOptions.counter, instance);
            mOptions.counter--;
            if (mOptions.counter <= 0) {
                clearInterval(mOptions.counterClock);
                $azquizgame.gameOver(1, instance);
                return;
            }
        }, 1000);

        $('#roscoPShowClue-' + instance)
            .text('')
            .hide();
        $('#roscotPHits-' + instance).text(mOptions.hits);
        $('#roscotPErrors-' + instance).text(mOptions.errors);
        $('#roscoBtnReply-' + instance).prop('disabled', false);
        $('#roscoBtnMoveOn-' + instance).prop('disabled', false);
        $('#roscoEdReply-' + instance)
            .prop('disabled', false)
            .focus();

        const mTime = mOptions.durationGame,
            sTime =
                $exeDevices.iDevice.gamification.helpers.getTimeToString(mTime),
            altTurn =
                mOptions.numberTurns === 1
                    ? mOptions.msgOneRound
                    : mOptions.msgTowRounds;

        if (mOptions.numberTurns === 0) {
            $('#roscoNumberRounds-' + instance).hide();
            $('#roscoNumberRoundsSpan-' + instance).hide();
        } else if (mOptions.numberTurns === 1) {
            $('#roscoNumberRounds-' + instance)
                .addClass('exeQuextIcons-OneRound')
                .removeClass('exeQuextIcons-TwoRounds')
                .attr('alt', 'One turn');
        } else if (mOptions.numberTurns === 2) {
            $('#roscoNumberRounds-' + instance)
                .addClass('exeQuextIcons-TwoRounds')
                .removeClass('exeQuextIcons-OneRound')
                .attr('alt', 'Two turns');
        }

        $('#roscoNumberRoundsSpan-' + instance).text(altTurn);
        $('#roscoPTime-' + instance).text(sTime);

        mOptions.gameActived = true;
        mOptions.gameStarted = true;
        $azquizgame.newWord(instance);
    },

    updateTime: function (tiempo, instance) {
        const mTime =
                $exeDevices.iDevice.gamification.helpers.getTimeToString(
                    tiempo
                ),
            mOptions = $azquizgame.options[instance];

        $('#roscoPTime-' + instance).text(mTime);

        if (mOptions.gameActived && mOptions.activeWord !== -1) {
            $azquizgame.drawLetterActive(mOptions.activeWord, instance);
        }
    },

    getRetroFeedMessages: function (iHit, instance) {
        const mOptions = $azquizgame.options[instance],
            msgs = mOptions.msgs,
            sMessages = iHit
                ? msgs.msgSuccesses.split('|')
                : msgs.msgFailures.split('|');
        return sMessages[Math.floor(Math.random() * sMessages.length)];
    },

    gameOver: function (type, instance) {
        const mOptions = $azquizgame.options[instance],
            msgs = mOptions.msgs;

        clearInterval(mOptions.counterClock);
        $azquizgame.updateTime(mOptions.counter, instance);

        $('#roscoDivModeBoard-' + instance).hide();
        $('#roscoMessages-' + instance).show();
        $('#roscoStartGame-' + instance).show();
        $('#roscoQuestionDiv-' + instance).hide();
        $('#roscoDivInstructions-' + instance).show();

        let msg = msgs.msgYouHas
            .replace('%1', mOptions.hits)
            .replace('%2', mOptions.errors);

        mOptions.activeWord = 0;
        mOptions.answeredWords = 0;
        mOptions.gameOver = true;

        $azquizgame.drawRosco(instance);
        $azquizgame.drawText(
            msgs.msgGameOver,
            $azquizgame.colors.red,
            instance
        );

        $('#roscoEdReply-' + instance).val('');
        $azquizgame.showImageNeo('', instance);

        mOptions.gameStarted = false;

        if (mOptions.isScorm === 1) {
            const score = ((mOptions.hits * 10) / mOptions.validWords).toFixed(
                2
            );
            $azquizgame.sendScore(true, instance);
            $('#roscoRepeatActivity-' + instance).text(
                mOptions.msgs.msgYouScore + ': ' + score
            );
            $azquizgame.initialScore = score;
        }

        $azquizgame.saveEvaluation(instance);
        $('#roscoPMessages-' + instance)
            .text(msg)
            .css('color', $azquizgame.colors.blackl);
        $exeDevices.iDevice.gamification.media.stopSound(mOptions);
        $('#roscoLinkAudio-' + instance).hide();
        $('#roscoShowWords-' + instance).show();
    },

    drawText: function (texto, color, instance) {
        const ctxt = $azquizgame.options[instance].ctxt,
            mOptions = $azquizgame.options[instance],
            whidthCtxt = $azquizgame.mcanvas.width,
            heightCtxt = $azquizgame.mcanvas.height,
            radiusLetter = mOptions.radiusLetter,
            xCenter = whidthCtxt / 2,
            yCenter = heightCtxt / 2,
            wText = whidthCtxt - 7 * radiusLetter,
            xMessage = xCenter - wText / 2,
            yMessage = yCenter,
            font = 'bold 18px sans-serif';

        ctxt.font = font;
        const whidthText = ctxt.measureText(texto).width,
            xText = xCenter - whidthText / 2,
            yText = yMessage;

        ctxt.fillStyle = 'transparent';
        ctxt.fillRect(xMessage, yMessage, wText, 30);
        ctxt.textAlig = 'center';
        ctxt.textBaseline = 'top';
        ctxt.fillStyle = color;
        ctxt.fillText(texto, xText, yText + 3);
        ctxt.closePath();
        $('#roscoPMessages-' + instance)
            .css('color', color)
            .text(texto);
    },

    getRandomDefinition: function (definition) {
        const array = definition.split('|');

        if (array.length > 1) {
            const index = Math.floor(Math.random() * array.length);
            return array[index].trim();
        }

        return definition;
    },

    showWord: function (activeLetter, instance) {
        const mOptions = $azquizgame.options[instance],
            msgs = mOptions.msgs,
            mWord = mOptions.wordsGame[activeLetter],
            definition = $azquizgame.getRandomDefinition(mWord.definition),
            letter = $azquizgame.getRealLetter(
                mOptions.letters.charAt(activeLetter)
            ),
            start = (
                mWord.type === 0 ? msgs.msgStartWith : msgs.msgContaint
            ).replace('%1', letter);

        $('#roscoPDefinition-' + instance).html(definition);
        $('#roscoPStartWith-' + instance).text(start);
        $('#roscoEdReply-' + instance).val('');
        $('#roscoPMessages-' + instance).val('');
        $('#roscoLinkAudio-' + instance).hide();

        $azquizgame.drawRosco(instance);
        $azquizgame.drawText('', $azquizgame.colors.blue, instance);

        mOptions.gameActived = true;

        $('#roscoBtnReply-' + instance).prop('disabled', false);
        $('#roscoBtnMoveOn-' + instance).prop('disabled', false);
        $azquizgame.showImageNeo(mWord.url, instance);
        $('#roscoEdReply-' + instance)
            .prop('disabled', false)
            .focus();

        if (mOptions.isScorm === 1) {
            const score = ((mOptions.hits * 10) / mOptions.validWords).toFixed(
                2
            );
            $azquizgame.sendScore(true, instance);
            $('#roscoRepeatActivity-' + instance).text(
                mOptions.msgs.msgYouScore + ': ' + score
            );
        }

        $azquizgame.saveEvaluation(instance);

        if (mWord.audio.length > 4) $('#roscoLinkAudio-' + instance).show();

        $exeDevices.iDevice.gamification.media.stopSound(mOptions);

        if (mWord.audio.trim().length > 4)
            $exeDevices.iDevice.gamification.media.playSound(
                mWord.audio.trim(),
                mOptions
            );

        if (mOptions.modeBoard)
            $('#roscoDivModeBoard-' + instance)
                .css('display', 'flex')
                .fadeIn();

        const html = $('#roscoPDefinition-' + instance).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);

        if (latex)
            $exeDevices.iDevice.gamification.math.updateLatex(
                '#roscoPDefinition-' + instance
            );
    },

    showImageNeo: function (url, instance) {
        const mOptions = $azquizgame.options[instance],
            mWord = mOptions.wordsGame[mOptions.activeWord],
            $cursor = $('#roscoCursor-' + instance),
            $noImage = $('#roscoNoImage-' + instance),
            $Image = $('#roscoImage-' + instance),
            $Author = $('#roscoAuthor-' + instance),
            $FullImage = $('#roscoFullLinkImage-' + instance).hide();

        $Image.attr('alt', 'No image');
        $cursor.hide();
        $Image.hide();
        $noImage.hide();
        $FullImage.hide();

        if (!$.trim(url).length) {
            $cursor.hide();
            $Image.hide();
            $noImage.show();
            $Author.text('');
            return false;
        }

        $Image
            .attr('src', '')
            .attr('src', url)
            .on('load', function () {
                if (
                    !this.complete ||
                    typeof this.naturalWidth === 'undefined' ||
                    this.naturalWidth === 0
                ) {
                    $cursor.hide();
                    $Image.hide();
                    $noImage.show();
                    $Author.text('');
                } else {
                    $Image.show();
                    $cursor.show();
                    $noImage.hide();
                    $Author.text(mWord.author);
                    $Image.attr('alt', mWord.alt);
                    $FullImage.show();
                    $azquizgame.positionPointer(instance);
                }
            })
            .on('error', function () {
                $cursor.hide();
                $Image.hide();
                $noImage.show();
                $Author.text('');
            });
    },

    positionPointer: function (instance) {
        const mOptions = $azquizgame.options[instance],
            mWord = mOptions.wordsGame[mOptions.activeWord],
            x = parseFloat(mWord.x) || 0,
            y = parseFloat(mWord.y) || 0,
            $cursor = $('#roscoCursor-' + instance);

        $cursor.hide();

        if (x > 0 || y > 0) {
            const containerElement = document.getElementById(
                    'roscoMultimedia-' + instance
                ),
                containerPos = containerElement.getBoundingClientRect(),
                imgElement = document.getElementById('roscoImage-' + instance),
                imgPos = imgElement.getBoundingClientRect(),
                marginTop = imgPos.top - containerPos.top,
                marginLeft = imgPos.left - containerPos.left,
                cursorX = marginLeft + x * imgPos.width,
                cursorY = marginTop + y * imgPos.height;

            $cursor.show();
            $cursor.css({ left: cursorX, top: cursorY, 'z-index': 30 });
        }
    },

    newWord: function (instance) {
        const mOptions = $azquizgame.options[instance];

        if (mOptions.gameOver) return;

        const mActiveWord = $azquizgame.updateNumberWord(
            mOptions.activeWord,
            instance
        );

        if (mActiveWord === null) {
            $azquizgame.gameOver(0, instance);
        } else {
            mOptions.activeWord = mActiveWord;
            $azquizgame.showWord(mActiveWord, instance);
        }
    },

    refreshImageActiveNeo: function (instance) {
        if (typeof $azquizgame.options[instance] == 'undefined') return;
        const mOptions = $azquizgame.options[instance],
            mWord = mOptions.wordsGame[mOptions.activeWord],
            imgElement = document.querySelector('img#roscoImage-' + instance);

        if (mWord && mWord.url && mWord.url.length > 3) {
            if (
                imgElement &&
                !imgElement.complete &&
                (!imgElement.src || imgElement.src === '')
            ) {
                $azquizgame.showImageNeo(mWord.url, instance);
            } else {
                $('#roscoCursor-' + instance).hide();
                setTimeout(() => $azquizgame.positionPointer(instance), 1000);
            }
        }
    },

    updateNumberWord: function (quextion, instance) {
        let numActiveWord = quextion;
        const mOptions = $azquizgame.options[instance];

        while (true) {
            numActiveWord++;

            if (numActiveWord > mOptions.letters.length - 1) {
                if (
                    mOptions.numberTurns === 0 ||
                    mOptions.activeGameSpin < mOptions.numberTurns
                ) {
                    if (mOptions.answeredWords >= mOptions.validWords)
                        return null;

                    if (mOptions.numberTurns > 0) {
                        mOptions.activeGameSpin++;
                        $('#roscoNumberRounds-' + instance)
                            .addClass('exeQuextIcons-OneRound')
                            .removeClass('exeQuextIcons-TwoRounds')
                            .attr('alt', 'Two turns');
                        $('#roscoNumberRoundsSpan-' + instance).text(
                            mOptions.msgOneRound
                        );
                    }

                    numActiveWord = 0;
                } else {
                    return null;
                }
            }

            const state = mOptions.wordsGame[numActiveWord].state;
            if (state === 1) return numActiveWord;
        }
    },

    passWord: function (instance) {
        const mOptions = $azquizgame.options[instance],
            letter =
                '#letterR' +
                mOptions.letters.charAt(mOptions.activeWord) +
                '-' +
                instance;

        mOptions.gameActived = false;

        $(letter).css({
            'background-color': $azquizgame.colors.blue,
            color: $azquizgame.colors.white,
        });

        $azquizgame.newWord(instance);

        if (mOptions.gameStarted) {
            $azquizgame.drawText('', $azquizgame.colors.blue, instance);
            $('#roscoEdReply-' + instance).focus();
        }

        $azquizgame.drawRosco(instance);
    },

    answerQuetion: function (instance) {
        const mOptions = $azquizgame.options[instance],
            msgs = mOptions.msgs;

        if (!mOptions.gameActived) return;

        mOptions.gameActived = false;

        const letter = mOptions.letters[mOptions.activeWord],
            answord = $('#roscoEdReply-' + instance)
                .val()
                .trim();

        if (answord === '') {
            mOptions.gameActived = true;
            $azquizgame.drawText(
                msgs.msgIndicateWord,
                $azquizgame.colors.red,
                instance
            );
            return;
        }

        const word = $.trim(mOptions.wordsGame[mOptions.activeWord].word);
        let Hit = true,
            mFontColor = $azquizgame.colors.white,
            mBackColor = $azquizgame.colors.blue;

        $('#roscoBtnReply-' + instance).prop('disabled', true);
        $('#roscoBtnMoveOn-' + instance).prop('disabled', true);
        $('#roscoEdReply-' + instance).prop('disabled', true);

        const checkWord = mOptions.caseSensitive ? word : word.toUpperCase(),
            checkAnsword = mOptions.caseSensitive
                ? answord
                : answord.toUpperCase();

        if ($azquizgame.checkWord(checkWord, checkAnsword)) {
            mOptions.hits++;
            mOptions.wordsGame[mOptions.activeWord].state = 2;
            mBackColor = $azquizgame.colors.green;
        } else {
            mOptions.wordsGame[mOptions.activeWord].state = 3;
            mOptions.errors++;
            Hit = false;
            mBackColor = $azquizgame.colors.red;
        }

        mOptions.wordsGame[mOptions.activeWord].correct = Hit ? 1 : 2;
        const percentageHits = (mOptions.hits / mOptions.validWords) * 100;

        mOptions.answeredWords++;

        $('#roscotPHits-' + instance).text(mOptions.hits);
        $('#roscotPErrors-' + instance).text(mOptions.errors);

        let timeShowSolution = mOptions.showSolution
                ? mOptions.timeShowSolution * 1000
                : 1000,
            clue = false;

        if (
            mOptions.itinerary.showClue &&
            percentageHits >= mOptions.itinerary.percentageClue &&
            !mOptions.obtainedClue
        ) {
            mOptions.obtainedClue = true;
            timeShowSolution = 4000;
            clue = true;
            $('#roscoPShowClue-' + instance)
                .show()
                .text(
                    mOptions.msgs.msgInformation +
                        ': ' +
                        mOptions.itinerary.clueGame
                );
        }

        const letterSelector = '#letterR' + letter + '-' + instance;
        $(letterSelector).css({
            'background-color': mBackColor,
            color: mFontColor,
        });

        $azquizgame.drawRosco(instance);

        setTimeout(() => {
            $azquizgame.newWord(instance);
        }, timeShowSolution);

        $azquizgame.drawMessage(Hit, word, clue, instance);
    },

    answerQuetionBoard: function (value, instance) {
        const mOptions = $azquizgame.options[instance];
        if (!mOptions.gameActived) return;

        mOptions.gameActived = false;

        $('#roscoBtnReply-' + instance).prop('disabled', true);
        $('#roscoBtnMoveOn-' + instance).prop('disabled', true);
        $('#roscoEdReply-' + instance).prop('disabled', true);

        let Hit = true,
            word = $.trim(mOptions.wordsGame[mOptions.activeWord].word),
            mFontColor = $azquizgame.colors.white,
            mBackColor = $azquizgame.colors.blue;

        word = mOptions.caseSensitive ? word : word.toUpperCase();

        if (value) {
            mOptions.hits++;
            mOptions.wordsGame[mOptions.activeWord].state = 2;
            mBackColor = $azquizgame.colors.green;
        } else {
            mOptions.wordsGame[mOptions.activeWord].state = 3;
            mOptions.errors++;
            Hit = false;
            mBackColor = $azquizgame.colors.red;
        }

        const percentageHits = (mOptions.hits / mOptions.validWords) * 100;

        mOptions.answeredWords++;
        mOptions.wordsGame[mOptions.activeWord].correct = Hit ? 1 : 2;

        $('#roscotPHits-' + instance).text(mOptions.hits);
        $('#roscotPErrors-' + instance).text(mOptions.errors);

        let timeShowSolution = mOptions.showSolution
            ? mOptions.timeShowSolution * 1000
            : 1000;
        let clue = false;

        if (
            mOptions.itinerary.showClue &&
            percentageHits >= mOptions.itinerary.percentageClue &&
            !mOptions.obtainedClue
        ) {
            mOptions.obtainedClue = true;
            timeShowSolution = 4000;
            clue = true;
            $('#roscoPShowClue-' + instance)
                .show()
                .text(
                    mOptions.msgs.msgInformation +
                        ': ' +
                        mOptions.itinerary.clueGame
                );
        }

        const letterSelector =
            '#letterR' + mOptions.letters[mOptions.activeWord] + '-' + instance;

        $(letterSelector).css({
            'background-color': mBackColor,
            color: mFontColor,
        });

        $azquizgame.drawRosco(instance);

        setTimeout(() => {
            $azquizgame.newWord(instance);
        }, timeShowSolution);

        $azquizgame.drawMessage(Hit, word, clue, instance);
    },

    checkWord: function (word, answord) {
        const cleanWord = (str) =>
                $.trim(str)
                    .replace(/\s+/g, ' ')
                    .replace(/[.,;]$/, ''),
            sWord = cleanWord(word),
            sAnsWord = cleanWord(answord);

        if (sWord.indexOf('|') === -1) {
            return sWord === sAnsWord;
        }

        const words = sWord.split('|');

        for (let i = 0; i < words.length; i++) {
            const mword = cleanWord(words[i]);
            if (mword === sAnsWord) {
                return true;
            }
        }

        return false;
    },

    wrapText: function (context, text, x, y, maxWidth, lineHeight) {
        let mx = x,
            words = text.split(' '),
            my = words.length < 12 ? y + 20 : y,
            line = '',
            testWidth = 0;

        for (let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ',
                metrics = context.measureText(testLine);
            testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                const lineWidth = context.measureText(line).width;
                mx = x + (maxWidth - lineWidth) / 2 + 5;
                context.fillText(line, mx, my);
                line = words[n] + ' ';
                my += lineHeight;
            } else {
                line = testLine;
            }
        }
        mx = x + (maxWidth - context.measureText(line).width) / 2 + 5;
        context.fillText(line, mx, my);
    },

    roundRect: function (x, y, width, height, radius, fill, stroke, ctxt) {
        if (typeof stroke == 'undefined') stroke = true;

        if (typeof radius === 'undefined') radius = 5;

        if (typeof radius === 'number') {
            radius = {
                tl: radius,
                tr: radius,
                br: radius,
                bl: radius,
            };
        } else {
            let defaultRadius = {
                tl: 0,
                tr: 0,
                br: 0,
                bl: 0,
            };
            for (let side in defaultRadius) {
                radius[side] = radius[side] || defaultRadius[side];
            }
        }

        ctxt.beginPath();
        ctxt.moveTo(x + radius.tl, y);
        ctxt.lineTo(x + width - radius.tr, y);
        ctxt.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
        ctxt.lineTo(x + width, y + height - radius.br);
        ctxt.quadraticCurveTo(
            x + width,
            y + height,
            x + width - radius.br,
            y + height
        );
        ctxt.lineTo(x + radius.bl, y + height);
        ctxt.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
        ctxt.lineTo(x, y + radius.tl);
        ctxt.quadraticCurveTo(x, y, x + radius.tl, y);
        ctxt.closePath();
        $azquizgame.setShadow(ctxt, 'rgba(100, 100, 100, 0.5)', 3, 3, 4);

        if (stroke) ctxt.stroke();
        if (fill) ctxt.fill();

        $azquizgame.setShadow(ctxt, 'white', 0, 0, 0);
    },

    drawRosco: function (instance) {
        let ctxt = $azquizgame.options[instance].ctxt,
            whidthCtxt = $azquizgame.mcanvas.width,
            heightCtxt = $azquizgame.mcanvas.height,
            mOptions = $azquizgame.options[instance];

        ctxt.clearRect(0, 0, whidthCtxt, heightCtxt);

        let radiusLetter = mOptions.radiusLetter,
            xCenter = Math.round(whidthCtxt / 2),
            yCenter = Math.round(heightCtxt / 2),
            radius = whidthCtxt / 2 - radiusLetter * 2,
            letter = '';

        for (let i = 0; i < mOptions.letters.length; i++) {
            letter = $azquizgame.getRealLetter(mOptions.letters.charAt(i));
            let angle =
                    (mOptions.angleSize * (i + mOptions.letters.length - 6)) %
                    mOptions.letters.length,
                yPoint = yCenter + radius * Math.sin(angle),
                xPoint = xCenter + radius * Math.cos(angle),
                font = $azquizgame.getFontSizeLetters(instance);
            ctxt.beginPath();
            ctxt.lineWidth = 0;
            ctxt.strokeStyle = $azquizgame.colors.black;
            ctxt.arc(xPoint, yPoint, radiusLetter, 0, 2 * Math.PI);
            let state = $azquizgame.options[instance].wordsGame[i].state,
                color = $azquizgame.getColorState(state);
            $azquizgame.setShadow(ctxt, 'rgba(0, 0, 0, 0.5)', 3, 3, 4);
            ctxt.fillStyle = color;
            ctxt.fill();
            $azquizgame.setShadow(ctxt, 'white', 0, 0, 0);
            ctxt.font = font;
            let whidthLetter = ctxt.measureText(letter).width;
            ctxt.textAlig = 'center';
            ctxt.textBaseline = 'middle';
            ctxt.fillStyle = $azquizgame.colors.white;
            ctxt.fillText(letter, xPoint - whidthLetter / 2, yPoint + 2);
            ctxt.closePath();
        }
    },

    drawLetterActive: function (iNumber, instance) {
        const mOptions = $azquizgame.options[instance];

        if (mOptions.gameActived) {
            let activeWord = mOptions.activeWord,
                word = mOptions.wordsGame[activeWord],
                mFontColor = $azquizgame.colors.white,
                mBackColor = $azquizgame.colors.blue;
            if (word.state == 2) {
                mFontColor = $azquizgame.colors.white;
                mBackColor = $azquizgame.colors.green;
            } else if (word.state == 3) {
                mFontColor = $azquizgame.colors.white;
                mBackColor = $azquizgame.colors.red;
            } else if (mOptions.activaLetra) {
                mFontColor = $azquizgame.colors.black;
                mBackColor = $azquizgame.colors.yellow;
            }

            if (iNumber == activeWord) {
                let letter = '',
                    mLetter = mOptions.letters.charAt(iNumber);
                letter = '#letterR' + mLetter + '-' + instance;
                mLetter = $azquizgame.getRealLetter(
                    mOptions.letters.charAt(iNumber)
                );
                $(letter).css({
                    'background-color': mBackColor,
                    color: mFontColor,
                });
                let ctxt = mOptions.ctxt,
                    angle =
                        (mOptions.angleSize *
                            (iNumber + mOptions.letters.length - 6)) %
                        mOptions.letters.length,
                    radiusLetter = mOptions.radiusLetter,
                    xCenter = $azquizgame.mcanvas.width / 2,
                    yCenter = $azquizgame.mcanvas.height / 2,
                    radius = $azquizgame.mcanvas.width / 2 - radiusLetter * 2,
                    yPoint = yCenter + radius * Math.sin(angle),
                    xPoint = xCenter + radius * Math.cos(angle),
                    font = $azquizgame.getFontSizeLetters(instance);
                ctxt.beginPath();
                ctxt.strokeStyle = $azquizgame.colors.white;
                ctxt.arc(xPoint, yPoint, radiusLetter, 0, 2 * Math.PI);
                ctxt.fillStyle = mBackColor;
                ctxt.fill();
                ctxt.font = font;
                ctxt.lineWidth = 2;
                const whidthLetter = ctxt.measureText(mLetter).width;
                ctxt.textAlig = 'center';
                ctxt.textBaseline = 'middle';
                ctxt.fillStyle = mFontColor;
                ctxt.fillText(mLetter, xPoint - whidthLetter / 2, yPoint + 2);
                ctxt.closePath();
            }
            mOptions.activaLetra = mOptions.activaLetra ? false : true;
        }
    },

    drawMessage: function (Hit, word, pista, instance) {
        let mOptions = $azquizgame.options[instance],
            mAnimo = $azquizgame.getRetroFeedMessages(Hit, instance),
            ctxt = mOptions.ctxt,
            whidthCtxt = $azquizgame.mcanvas.width,
            heightCtxt = $azquizgame.mcanvas.height,
            wCuadro = whidthCtxt - 70,
            xMessage = whidthCtxt / 2 - wCuadro / 2,
            yMessage = heightCtxt / 2,
            xCenter = whidthCtxt / 2,
            font = 'bold 18px sans-serif';

        ctxt.font = font;

        let anchoTextoAnimo = ctxt.measureText(mAnimo).width,
            posTextoAnimoX = xCenter - anchoTextoAnimo / 2,
            posTextoAnimoY = mOptions.showSolution ? yMessage - 10 : yMessage;

        ctxt.fillStyle = $azquizgame.colors.white;

        let lColor = Hit ? $azquizgame.colors.green : $azquizgame.colors.red;
        ctxt.strokeStyle = '#DDDDDD';
        ctxt.lineWidth = 2;

        $azquizgame.roundRect(xMessage + 5, 130, 277, 120, 8, true, true, ctxt);
        ctxt.textAlig = 'center';
        ctxt.textBaseline = 'top';
        ctxt.fillStyle = lColor;

        if (pista) {
            mAnimo = mOptions.msgs.msgInformation;
            posTextoAnimoY = yMessage - 15;
            posTextoAnimoX = xCenter - ctxt.measureText(mAnimo).width / 2;
            $azquizgame.wrapText(
                ctxt,
                mAnimo + ': ' + mOptions.itinerary.clueGame,
                xMessage + 13,
                yMessage - 32,
                257,
                24
            );
            $('#roscoPMessages-' + instance)
                .css('color', lColor)
                .text(mAnimo + ': ' + mOptions.itinerary.clueGame);
            return;
        }

        ctxt.fillText(mAnimo, posTextoAnimoX, posTextoAnimoY);
        $('#roscoPMessages-' + instance).text(mAnimo);
        if (mOptions.showSolution) {
            $('#roscoPMessages-' + instance).text(mAnimo + ' ' + word);
            ctxt.fillText(mAnimo, posTextoAnimoX, posTextoAnimoY);
            $azquizgame.wrapText(
                ctxt,
                word,
                xMessage + 10,
                posTextoAnimoY + 10,
                257,
                24
            );
        }
        $('#roscoPMessages-' + instance).css('color', lColor);
        $('#roscoEdReply-' + instance).focus();
    },

    getRealLetter: function (letter) {
        const lettersMap = {
            0: 'L·L',
            1: 'SS',
        };
        return lettersMap[letter] || letter;
    },

    getCaracterLetter: function (letter) {
        const caracterMap = {
            'L·L': '0',
            SS: '1',
        };
        return caracterMap[letter] || letter;
    },

    getFontSizeLetters: function (instance) {
        const mOptions = $azquizgame.options[instance];
        let mFont = '20px';

        if (mOptions.letters.length < 18) {
            mFont = '24px';
        } else if (mOptions.letters.length < 24) {
            mFont = '22px';
        } else if (mOptions.letters.length < 32) {
            mFont = '20px';
        } else if (mOptions.letters.length < 36) {
            mFont = '16px';
        } else if (mOptions.letters.length < 40) {
            mFont = '14px';
        } else if (mOptions.letters.length < 44) {
            mFont = '12px';
        } else if (mOptions.letters.length < 50) {
            mFont = '10px';
        } else if (mOptions.letters.length < 100) {
            mFont = '8px';
        }

        return `bold ${mFont} sans-serif`;
    },

    drawRows: function (instance) {
        const mOptions = $azquizgame.options[instance],
            mFontColor = $azquizgame.colors.white;

        mOptions.wordsGame.forEach((word, i) => {
            const mBackColor =
                word.word.trim().length === 0
                    ? $azquizgame.colors.black
                    : $azquizgame.colors.blue;
            const letterSelector = `#letterR${mOptions.letters.charAt(i)}-${instance}`;

            $(letterSelector).css({
                'background-color': mBackColor,
                color: mFontColor,
            });
        });
    },

    setShadow: function (ctx, color, ox, oy, blur) {
        ctx.shadowColor = color;
        ctx.shadowOffsetX = ox;
        ctx.shadowOffsetY = oy;
        ctx.shadowBlur = blur;
    },

    getColorState: function (state) {
        switch (state) {
            case 0:
                return $azquizgame.colors.black;
            case 1:
                return $azquizgame.colors.blue;
            case 2:
                return $azquizgame.colors.green;
            case 3:
                return $azquizgame.colors.red;
            default:
                return $azquizgame.colors.blue;
        }
    },

    saveEvaluation: function (instance) {
        const mOptions = $azquizgame.options[instance];
        mOptions.scorerp = (mOptions.hits * 10) / mOptions.validWords;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $azquizgame.isInExe
        );
    },

    sendScore: function (auto, instance) {
        const mOptions = $azquizgame.options[instance];

        mOptions.scorerp = (mOptions.hits * 10) / mOptions.validWords;

        mOptions.previousScore = $azquizgame.previousScore;
        mOptions.userName = $azquizgame.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $azquizgame.previousScore = mOptions.previousScore;
    },
};

$(function () {
    $azquizgame.init();
});
