/* eslint-disable no-undef */
/**
 * Puzzle activity (Export)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 *
 */
var $eXePuzzle = {
    idevicePath: '',
    borderColors: {
        black: '#1c1b1b',
        blue: '#0056b3',
        green: '#006641',
        red: '#a2241a',
        white: '#ffffff',
        yellow: '#f3d55a',
    },
    colors: {
        black: '#1c1b1b',
        blue: '#0056b3',
        green: '#006641',
        red: '#a2241a',
        white: '#ffffff',
        yellow: '#fcf4d3',
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
            'Puzzle',
            'puzzle',
            'puzzle-IDevice'
        );
    },

    enable: function () {
        $eXePuzzle.loadGame();
    },

    stopAllSounds: function (instance) {
        const mOptions = $eXePuzzle.options[instance];
        if (
            mOptions &&
            $exeDevices &&
            $exeDevices.iDevice &&
            $exeDevices.iDevice.gamification &&
            $exeDevices.iDevice.gamification.media
        ) {
            try {
                $exeDevices.iDevice.gamification.media.stopSound(mOptions);
            } catch (e) {
                /* noop */
            }
        }
        const $container = $('#pzlMainContainer-' + instance);
        $container.find('audio, video').each(function () {
            try {
                if (typeof this.pause === 'function') this.pause();
                if (!isNaN(this.currentTime)) this.currentTime = 0;
            } catch (e) {
                /* noop */
            }
        });
    },

    bindFullscreenEvents: function (instance) {
        const mOptions = $eXePuzzle.options[instance];
        if (!mOptions) return;
        const container = document.getElementById(
            'pzlGameContainer-' + instance
        );
        if (!container) return;

        if (mOptions._fsBound) return;

        const handler = function () {
            const el =
                document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement;
            const isFS = el === container;
            if (isFS) {
                container.classList.add('PZLP-IsFull');
            } else {
                container.classList.remove('PZLP-IsFull');
            }
            try {
                setTimeout(function () {
                    $eXePuzzle.resizePuzzlePieces(instance);
                }, 50);
            } catch (e) {}
        };

        [
            'fullscreenchange',
            'webkitfullscreenchange',
            'mozfullscreenchange',
            'MSFullscreenChange',
        ].forEach(function (evt) {
            document.addEventListener(evt, handler);
        });

        mOptions._fsBound = true;
        mOptions._fsHandler = handler;

        setTimeout(handler, 0);
    },

    loadGame: function () {
        $eXePuzzle.options = [];
        $eXePuzzle.activities.each(function (i) {
            const dl = $('.puzzle-DataGame', this),
                mOption = $eXePuzzle.loadDataGame(dl, this);

            mOption.scorerp = 0;
            mOption.idevicePath = $eXePuzzle.idevicePath;
            mOption.main = 'pzlMainContainer-' + i;
            mOption.idevice = 'puzzle-IDevice';

            $eXePuzzle.options.push(mOption);

            const pzl = $eXePuzzle.createInterfacePuzzle(i);
            dl.before(pzl).remove();
            $('#pzlGameMinimize-' + i).hide();
            $('#pzlGameContainer-' + i).hide();
            if (mOption.showMinimize) {
                $('#pzlGameMinimize-' + i)
                    .css({
                        cursor: 'pointer',
                    })
                    .show();
            } else {
                $('#pzlGameContainer-' + i).show();
            }
            $('#pzlDivFeedBack-' + i).prepend($('.puzzle-feedback-game', this));
            $eXePuzzle.addEvents(i);
            $eXePuzzle.showPuzzle(0, i);
            $('#pzlDivFeedBack-' + i).hide();
            $('#pzlMainContainer-' + i).show();
        });

        let node = document.querySelector('.page-content');
        if (this.isInExe) {
            node = document.getElementById('node-content');
        }
        if (node)
            $exeDevices.iDevice.gamification.observers.observeResize(
                $eXePuzzle,
                node
            );

        const puzzleHtml = $('.puzzle-IDevice').html();
        if ($exeDevices.iDevice.gamification.math.hasLatex(puzzleHtml)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '.puzzle-IDevice'
            );
        }
    },

    getPhraseDefault: function () {
        return {
            cards: [],
            msgError: '',
            msgHit: '',
            definition: '',
            puzzle: '',
        };
    },

    loadDataGame: function (data, sthis) {
        let json = $exeDevices.iDevice.gamification.helpers.decrypt(
            data.text()
        );

        const mOptions =
                $exeDevices.iDevice.gamification.helpers.isJsonString(json),
            $audiosDef = $('.puzzle-LinkAudiosDef', sthis),
            $imagesDef = $('.puzzle-LinkImagesDef', sthis),
            $audiosClue = $('.puzzle-LinkAudiosClue', sthis);

        mOptions.playerAudio = '';
        mOptions.solutionShown = false;
        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.gameActived = true;
        mOptions.counter = 0;
        mOptions.gameOver = false;
        mOptions.gameStarted = false;
        mOptions.obtainedClue = false;
        mOptions.hits = 0;
        mOptions.active = 0;
        mOptions.selectedTile = null;
        mOptions.loading = false;

        for (let i = 0; i < mOptions.puzzlesGame.length; i++) {
            const q = mOptions.puzzlesGame[i];
            q.type = typeof q.type == 'undefined' ? 1 : q.type;
        }
        $imagesDef.each(function () {
            const iqb = parseInt($(this).text());
            if (!isNaN(iqb) && iqb < mOptions.puzzlesGame.length) {
                mOptions.puzzlesGame[iqb].url = $(this).attr('href');
                if (mOptions.puzzlesGame[iqb].url.length < 4) {
                    mOptions.puzzlesGame[iqb].url = '';
                }
            }
        });

        $audiosDef.each(function () {
            const iqa = parseInt($(this).text());
            if (!isNaN(iqa) && iqa < mOptions.puzzlesGame.length) {
                mOptions.puzzlesGame[iqa].audioDefinition =
                    $(this).attr('href');
                if (mOptions.puzzlesGame[iqa].audioDefinition.length < 4) {
                    mOptions.puzzlesGame[iqa].audioDefinition = '';
                }
            }
        });

        $audiosClue.each(function () {
            const iqa = parseInt($(this).text());
            if (!isNaN(iqa) && iqa < mOptions.puzzlesGame.length) {
                mOptions.puzzlesGame[iqa].audioClue = $(this).attr('href');
                if (mOptions.puzzlesGame[iqa].audioClue.length < 4) {
                    mOptions.puzzlesGame[iqa].audioClue = '';
                }
            }
        });

        mOptions.evaluation =
            typeof mOptions.evaluation == 'undefined'
                ? false
                : mOptions.evaluation;
        mOptions.evaluationID =
            typeof mOptions.evaluationID == 'undefined'
                ? ''
                : mOptions.evaluationID;
        mOptions.id = typeof mOptions.id == 'undefined' ? false : mOptions.id;
        mOptions.puzzlesGame =
            $exeDevices.iDevice.gamification.helpers.getQuestions(
                mOptions.puzzlesGame,
                mOptions.percentajeQuestions
            );

        if (mOptions.randomPuzzles)
            mOptions.puzzlesGame =
                $exeDevices.iDevice.gamification.helpers.shuffleAds(
                    mOptions.puzzlesGame
                );

        mOptions.numberQuestions = mOptions.puzzlesGame.length;

        return mOptions;
    },

    showPuzzle: function (num, instance) {
        const mOptions = $eXePuzzle.options[instance];

        mOptions.active = num;
        mOptions.puzzle = mOptions.puzzlesGame[num];
        mOptions.attemps = 0;
        mOptions.loading = num === 0 && mOptions.puzzle.showTime;
        mOptions.audiofirst =
            num === 0 && mOptions.puzzle.audioDefinition.length > 3;

        $eXePuzzle.stopAllSounds(instance);
        $eXePuzzle.showMessage(
            3,
            mOptions.puzzlesGame[num].definition,
            instance
        );

        [
            '#pzlImage-',
            '#pzlShowImage-',
            '#pzlShowNumber-',
            '#pzlTime-',
            '#pzlImgTime-',
            '#pzlAttemps-',
            '#pzlImgAttemps-',
        ].forEach((selector) => {
            $(selector + instance).hide();
        });

        $('#pzlAttemps-' + instance).text('0');
        $('#pzlAuthor-' + instance).html(mOptions.puzzle.author);
        $('#pzlImage-' + instance).attr(
            'alt',
            mOptions.puzzle.atl || mOptions.msgs.msgNoImage
        );

        ['PZLP-Tile', 'PZLP-TileChang', 'PZLP-Completed'].forEach((cls) => {
            $('#pzlImagePuzzle-' + instance)
                .find(`.${cls}`)
                .remove();
        });

        $eXePuzzle.showImagePuzzle(num, instance);
        $('#pzlAudioDef-' + instance).hide();
        $('#pzlAudioClue-' + instance).hide();

        const container = document.getElementById(
            'pzlGameContainer-' + instance
        );
        if (
            container &&
            (container === document.fullscreenElement ||
                container.classList.contains('PZLP-IsFull'))
        ) {
            $eXePuzzle.bindFullscreenEvents(instance);
            setTimeout(function () {
                $eXePuzzle.resizePuzzlePieces(instance);
            }, 50);
        }
    },

    createInterfacePuzzle: function (instance) {
        const path = $eXePuzzle.idevicePath,
            msgs = $eXePuzzle.options[instance].msgs,
            mOptions = $eXePuzzle.options[instance],
            html = `
        <div class="PZLP-MainContainer" id="pzlMainContainer-${instance}">
            <div class="PZLP-GameMinimize" id="pzlGameMinimize-${instance}">
                <a href="#" class="PZLP-LinkMaximize" id="pzlLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                    <img src="${path}puzzleIcon.png" class="PZLP-IconMinimize PZLP-Activo" alt="">
                    <div class="PZLP-MessageMaximize" id="pzlMessageMaximize-${instance}">${msgs.msgPlayStart}</div>
                </a>
            </div>
            <div class="PZLP-GameContainer" id="pzlGameContainer-${instance}">
                <div class="PZLP-GameScoreBoard" id="pzlGameScoreBoard-${instance}">
                    <div class="PZLP-GameScores">
                        <div class="exeQuextIcons exeQuextIcons-Number" id="pzlPNumberIcon-${instance}" title="${msgs.msgNumQuestions}"></div>
                        <p><span class="sr-av">${msgs.msgNumQuestions}: </span><span id="pzlPNumber-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                        <p><span class="sr-av">${msgs.msgHits}: </span><span id="pzlPHits-${instance}">0</span></p>
                        <div style="display:none;" class="exeQuextIcons exeQuextIcons-Error" title="${msgs.msgErrors}"></div>
                        <p style="display:none;"><span class="sr-av">${msgs.msgErrors}: </span><span id="pzlPErrors-${instance}">0</span></p>
                        <div class="exeQuextIcons exeQuextIcons-Score" id="pzlPScoreIcon-${instance}" title="${msgs.msgScore}"></div>
                        <p><span class="sr-av">${msgs.msgScore}: </span><span id="pzlPScore-${instance}">0</span></p>
                    </div>
                    <div class="PZLP-Info" id="pzlInfo-${instance}"></div>
                    <div class="PZLP-TimeNumber">
                        <strong><span class="sr-av">${msgs.msgTimePuzzle}:</span></strong>
                        <div class="exeQuextIcons exeQuextIcons-Time" id="pzlImgTime-${instance}" title="${msgs.msgTimePuzzle}"></div>
                        <p id="pzlTime-${instance}" class="PZLP-PTime">00:00</p>
                        <strong><span class="sr-av">${msgs.msgAttempsNumbers}:</span></strong>
                        <div class="exeQuextIcons exeQuextIcons-Number" id="pzlImgAttemps-${instance}" title="${msgs.msgAttempsNumbers}"></div>
                        <p id="pzlAttemps-${instance}" class="PZLP-PAttemps">0</p>
                        <a href="#" id="pzlShowImage-${instance}" title="${msgs.msgShowImage}">
                            <strong><span class="sr-av">${msgs.msgShowImage}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-ShowImage PZLP-Activo"></div>
                        </a>
                        <a href="#" id="pzlShowNumber-${instance}" title="${msgs.msgShowNumbers}">
                            <strong><span class="sr-av">${msgs.msgShowNumbers}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Numbers PZLP-Activo"></div>
                        </a>
                        <a href="#" class="PZLP-LinkMinimize" id="pzlLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                            <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Minimize PZLP-Activo"></div>
                        </a>
                        <a href="#" class="PZLP-LinkFullScreen" id="pzlLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                            <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-FullScreen PZLP-Activo" id="pzlFullScreen-${instance}"></div>
                        </a>
                    </div>
                </div>
                <div class="PZLP-Multimedia" id="pzlMultimedia-${instance}">
                    <div class="PZLP-QuestionDiv" id="pzlQuestionDiv-${instance}">
                        <div class="PZLP-Message" id="pzlMessage-${instance}"></div>
                        <a href="#" id="pzlAudioDef-${instance}" class="PZLP-LinkAudioDef">
                            <img src="${$eXePuzzle.idevicePath}exequextplayaudio.svg">
                        </a>
                        <a href="#" id="pzlAudioClue-${instance}" class="PZLP-LinkAudioDef">
                            <img src="${$eXePuzzle.idevicePath}exequextplayaudio.svg">
                        </a>
                    </div>
                    <div class="PZLP-ImageDiv" id="pzlImageDiv-${instance}">
                        <img class="PZLP-ImageDef" id="pzlImage-${instance}" src="${path}puzzle-Image.png" alt="${msgs.msgNoImage}" />
                        <div class="PZLP-ImagePuzzle" id="pzlImagePuzzle-${instance}"></div>
                    </div>
                    <div class="PZLP-Author" id="pzlAuthor-${instance}"></div>                                   
                </div>
                <div class="PZLP-AuthorGame" id="pzlAuthorGame-${instance}"></div>
            </div>
            <div class="PZLP-Cubierta" id="pzlCubierta-${instance}">
                <div class="PZLP-GameOverExt" id="pzlGameOver-${instance}">
                    <div class="PZLP-StartGameEnd" id="pzlMesasgeEnd-${instance}"></div>
                    <div class="PZLP-GameOver">
                        <div class="PZLP-DataImage">
                            <img src="${path}exequextwon.png" class="PZLP-HistGGame" id="pzlHistGame-${instance}" alt="${msgs.msgAllQuestions}" />
                            <img src="${path}exequextlost.png" class="PZLP-LostGGame" id="pzlLostGame-${instance}" alt="${msgs.msgTimeOver}" />
                        </div>
                            <div class="PZLP-DataScore">
                                <p id="pzlOverNumCards-${instance}"></p>
                                <p id="pzlOverHits-${instance}"></p>
                                <p style="display:none;" id="pzlOverErrors-${instance}"></p>
                                <p id="pzlOverScore-${instance}"></p>
                            </div>
                        </div>
                        <div class="PZLP-StartGameEnd">
                                <a href="#" id="pzlStartGameEnd-${instance}">${msgs.msgPlayAgain}</a>
                        </div>
                    </div>
                    <div class="PZLP-CodeAccessDiv" id="pzlCodeAccessDiv-${instance}">
                        <div class="PZLP-MessageCodeAccessE" id="pzlMesajeAccesCodeE-${instance}"></div>
                        <div class="PZLP-DataCodeAccessE">
                            <label class="sr-av">${msgs.msgCodeAccess}:</label>
                            <input type="text" class="PZLP-CodeAccessE form-control" id="pzlCodeAccessE-${instance}" placeholder="${msgs.msgCodeAccess}">
                            <a href="#" id="pzlCodeAccessButton-${instance}" title="${msgs.msgSubmit}">
                                <strong><span class="sr-av">${msgs.msgSubmit}</span></strong>
                                    <div class="exeQuextIcons-Submit PZLP-Activo"></div>
                            </a>
                        </div>
                    </div>
                    <div class="PZLP-ShowClue" id="pzlShowClue-${instance}">
                        <p class="sr-av">${msgs.msgClue}</p>
                        <p class="PZLP-PShowClue" id="pzlPShowClue-${instance}"></p>
                        <a href="#" class="PZLP-ClueBotton" id="pzlClueButton-${instance}" title="${msgs.msgContinue}">${msgs.msgContinue}</a>
                    </div>
                </div>    
                <div class="PZLP-DivFeedBack" id="pzlDivFeedBack-${instance}">
                    <input type="button" id="pzlFeedBackClose-${instance}" value="${msgs.msgClose}" class="feedbackbutton" />
                </div>                
            </div>
           ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}
        </div>`;
        return html;
    },

    showImagePuzzle: function (num, instance) {
        const mOptions = $eXePuzzle.options[instance],
            q = mOptions.puzzlesGame[num],
            $image = $('#pzlImage-' + instance),
            $author = $('#pzlAuthor-' + instance);

        $author.hide();
        if (q.url.length < 4) return false;

        $image.hide();
        $('#pzlShowNumber-' + instance).hide();
        $('#pzlShowImage-' + instance).hide();

        $image.attr('alt', q.alt);
        $image.off('load');
        $image.off('error');
        $image
            .prop('src', q.url)
            .on('load', function () {
                $eXePuzzle.handleImageLoad(this, instance, q);
                if (q.showImage) $('#pzlShowImage-' + instance).show();
                if (q.showNumber) $('#pzlShowNumber-' + instance).show();
            })
            .on('error', function () {
                return false;
            });
    },

    handleImageLoad: function (image, instance, q) {
        const mOptions = $eXePuzzle.options[instance];

        if (
            !image.complete ||
            typeof image.naturalWidth == 'undefined' ||
            image.naturalWidth == 0
        )
            return false;

        const mData = $eXePuzzle.placeImageWindows(
            image.naturalWidth,
            image.naturalHeight,
            instance
        );
        q.data = mData;

        $eXePuzzle.drawImage('#pzlImagePuzzle-' + instance, image, mData);

        $eXePuzzle.placePuzzlePieces(mData, instance);

        const $author = $('#pzlAuthor-' + instance);
        if (q.audioDefinition && q.audioDefinition.length > 4) {
            if (!mOptions.audiofirst)
                $exeDevices.iDevice.gamification.media.playSound(
                    q.audioDefinition,
                    mOptions
                );
            $('#pzlAudioDef-' + instance).css('display', 'block');
        }

        if (q.author.length > 0) {
            $author.show();
        }
        if (q.alt.length > 0) {
            $(image).prop('alt', q.alt);
        }

        $(image).hide();

        return true;
    },

    placePuzzlePieces: function (mData, instance) {
        const mOptions = $eXePuzzle.options[instance],
            q = mOptions.puzzlesGame[mOptions.active],
            width = mData.w,
            height = mData.h,
            cols = q.columns,
            rows = q.rows,
            classPiece = q.type == 0 ? 'PZLP-Tile' : 'PZLP-TileChange';

        q.parts = [];
        q.tileSizeX = Math.round(width / cols);
        q.tileSizeY = Math.round(height / rows);
        q.emptyX = cols - 1;
        q.emptyY = rows - 1;

        let z = 0;
        $('#pzlImagePuzzle-' + instance)
            .find('.PZLP-Tile')
            .remove();
        $('#pzlImagePuzzle-' + instance)
            .find('.PZLP-TileChange')
            .remove();
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                const x = j * q.tileSizeX,
                    y = i * q.tileSizeY;
                if (q.type == 0 && i === rows - 1 && j === cols - 1) {
                    q.parts.push(null);
                    continue;
                }
                $('#pzlImagePuzzle-' + instance).append(`
                <div id="pzlTile${instance}-${z}" class="${classPiece}" data-index="${z}" data-x="${j}" data-y="${i}" data-x1="${j}" data-y1="${i}" style="
                  left: ${x}px; 
                  top: ${y}px; 
                  background-image: url('${q.url}');
                  background-size: ${width}px ${height}px;
                  width: ${q.tileSizeX}px; 
                  height: ${q.tileSizeY}px;
                  background-position: -${x}px -${y}px;"><span class="PZLP-NumberShow">${z + 1}</span>
                </div>
            `);
                q.parts.push({ x: j, y: i, id: z });
                z++;
            }
        }

        $eXePuzzle.shuffle(instance, cols);

        const correct = $eXePuzzle.checkCorrectPlaces(instance);
        if (correct) {
            $eXePuzzle.showPuzzle(mOptions.active, instance);
            return;
        }

        if (q.showTime > 0) {
            $('#pzlTime-' + instance).show();
            if (!$eXePuzzle.isMobile()) $('#pzlImgTime-' + instance).show();
            mOptions.counter = 0;
            clearInterval(mOptions.counterClock);
            mOptions.counterClock = setInterval(function () {
                let $node = $('#pzlMainContainer-' + instance);
                let $content = $('#node-content');
                if (
                    !$node.length ||
                    ($content.length && $content.attr('mode') === 'edition')
                ) {
                    clearInterval(mOptions.counterClock);
                    return;
                }
                const isvisible = $('#pzlCubierta-' + instance).is(':visible');
                if (mOptions.gameStarted && !isvisible && !mOptions.loading) {
                    mOptions.counter++;
                    $eXePuzzle.uptateTime(mOptions.counter, instance);
                }
            }, 1000);
        }

        if (q.showAttemps) {
            $('#pzlAttemps-' + instance).show();
            $('#pzlImgAttemps-' + instance).show();
        }

        mOptions.lastwidth = 0;
        mOptions.gameStarted = true;
        mOptions.gameActived = false;
    },

    debounce: function (func, wait) {
        let timeout;
        return function (...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    onContainerResize(instance, entries) {
        const mOptions = $eXePuzzle.options[instance];
        for (let entry of entries) {
            if (entry.target.id === 'pzlGameContainer-' + instance) {
                const isvisible = $('#pzlGameContainer-' + instance).is(
                    ':visible'
                );
                if (
                    typeof mOptions == 'undefined' ||
                    !mOptions.gameStarted ||
                    !isvisible
                )
                    return;
                $eXePuzzle.resizePuzzlePieces(instance);
            }
        }
    },

    showCompletedWindows: function (instance) {
        const mOptions = $eXePuzzle.options[instance],
            q = mOptions.puzzlesGame[mOptions.active],
            ms = q.clue && q.clue.length > 0 ? q.clue : '',
            mr =
                mOptions.active == mOptions.puzzlesGame.length - 1
                    ? mOptions.msgs.msgsTerminate
                    : mOptions.msgs.msgsNext,
            wd = `<div class="PZLP-Completed">
        <div class="PZLP-CompletedLeft">
            <img src="${$eXePuzzle.idevicePath}exequextlost.png" alt="${mOptions.msgs.msgsCompletedPuzzle}">
        </div>
        <div class="PZLP-CompletedRight">
            <div class="PZLP-CompletedText">
                <p>${mOptions.msgs.msgsCompletedPuzzle}</p>
                <p>${ms}</p>
            </div>
            <div class="PZLP-CompletedButtons">
                <button type="button" class="PZLP-RepeatPuzzle btn btn-primary">${mOptions.msgs.msgsRepeat}</button>
                <button type="button" class="PZLP-NextPuzzle btn btn-primary">${mr}</button>
            </div>
        </div>
    </div>`;

        $('#pzlImagePuzzle-' + instance)
            .find('.PZLP-Completed')
            .remove();
        $('#pzlImagePuzzle-' + instance).append(wd);
        $('#pzlImagePuzzle-' + instance)
            .find('.PZLP-Completed')
            .hide();
        $('#pzlImagePuzzle-' + instance)
            .find('.PZLP-Completed')
            .fadeIn();
        $eXePuzzle.updateScore(true, instance);
    },

    resizePuzzlePieces: function (instance) {
        const mOptions = $eXePuzzle.options[instance],
            q = mOptions.puzzlesGame[mOptions.active];

        if (typeof q == 'undefined' || typeof q.data == 'undefined') return;

        mOptions.lastwidth =
            mOptions.lastwidth === 0 ? q.data.wm : mOptions.lastwidth;
        if ($eXePuzzle.isMobile()) {
            mOptions.lastwidth = $('#pzlMultimedia-' + instance).width();
        }

        let cols = q.columns,
            wid = $('#pzlImagePuzzle-' + instance).width(),
            hid = $('#pzlImagePuzzle-' + instance).height(),
            wm = $('#pzlMultimedia-' + instance).width(),
            xp = wm / mOptions.lastwidth,
            width = xp * wid,
            height = xp * hid,
            rows = q.rows,
            newWidth = Math.round(width / cols),
            newHeight = Math.round(height / rows),
            left = Math.round((wm - width) / 2),
            pieceClass = q.type == 0 ? '.PZLP-Tile' : '.PZLP-TileChange';

        mOptions.lastwidth = $('#pzlMultimedia-' + instance).width();

        $('#pzlImagePuzzle-' + instance).css({
            width: Math.round(xp * wid) + 'px',
            height: Math.round(xp * hid) + 'px',
            top: 0,
            left: left + 'px',
        });

        $('#pzlImage-' + instance).css({
            width: Math.round(xp * wid) + 'px',
            height: Math.round(xp * hid) + 'px',
            top: 0,
            left: left + 'px',
        });

        q.tileSizeX = newWidth;
        q.tileSizeY = newHeight;
        $('#pzlImagePuzzle-' + instance)
            .find(pieceClass)
            .each(function () {
                const $piece = $(this),
                    colIndex = $piece.data('x1'),
                    rowIndex = $piece.data('y1'),
                    x = $piece.data('x') * newWidth,
                    y = $piece.data('y') * newHeight,
                    backgroundPositionX = -colIndex * newWidth + 'px',
                    backgroundPositionY = -rowIndex * newHeight + 'px';

                $piece.css({
                    left: x + 'px',
                    top: y + 'px',
                    'background-image': `url("${q.url}")`,
                    'background-position':
                        backgroundPositionX + ' ' + backgroundPositionY,
                    'background-size': `${width}px ${height}px`,
                    width: newWidth + 'px',
                    height: newHeight + 'px',
                });
            });
    },

    adjustImageDivHeight: function (instance) {
        const $imageDiv = $('#pzlImageDiv-' + instance);
        const $imagePuzzle = $('#pzlImagePuzzle-' + instance);
        const $image = $('#pzlImage-' + instance);

        if ($imagePuzzle.length && $image.length) {
            const puzzleWidth = $imagePuzzle.width();
            const puzzleHeight = $imagePuzzle.height();

            if (puzzleWidth > 0 && puzzleHeight > 0) {
                const containerWidth = $imageDiv.width();
                const aspectRatio = puzzleHeight / puzzleWidth;
                const calculatedHeight = containerWidth * aspectRatio;

                $imageDiv.css({
                    height: calculatedHeight + 'px',
                    'padding-top': '0',
                });
            }
        }
    },

    showSholution: function (instance) {
        const mOptions = $eXePuzzle.options[instance],
            q = mOptions.puzzlesGame[mOptions.active],
            $pzlImagePuzzle = $('#pzlImagePuzzle-' + instance),
            cols = q.columns,
            rows = q.rows,
            pieceClass = q.type == 0 ? 'PZLP-Tile' : 'PZLP-TileChange',
            url = q.url;

        let tileSizeX =
            q && !isNaN(q.tileSizeX) && q.tileSizeX > 0
                ? Math.round(q.tileSizeX)
                : q.data && q.data.w
                  ? Math.round(q.data.w / cols)
                  : Math.round(($pzlImagePuzzle.width() || 0) / cols);
        let tileSizeY =
            q && !isNaN(q.tileSizeY) && q.tileSizeY > 0
                ? Math.round(q.tileSizeY)
                : q.data && q.data.h
                  ? Math.round(q.data.h / rows)
                  : Math.round(($pzlImagePuzzle.height() || 0) / rows);

        if (!tileSizeX || tileSizeX <= 0) tileSizeX = 1;
        if (!tileSizeY || tileSizeY <= 0) tileSizeY = 1;

        let width = tileSizeX * cols;
        let height = tileSizeY * rows;

        $pzlImagePuzzle.css({ width: width + 'px', height: height + 'px' });

        let z = 0;

        $('#pzlImage-' + instance).css({ opacity: '0.2', display: 'block' });
        $pzlImagePuzzle.find('.' + pieceClass).remove();

        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                const x = j * tileSizeX,
                    y = i * tileSizeY,
                    bgPosX = -j * tileSizeX,
                    bgPosY = -i * tileSizeY;

                $pzlImagePuzzle.append(`
                <div id="pzlTile${instance}-${z}" class="${pieceClass}" data-index="${z}" data-x="${j}" data-y="${i}" data-x1="${j}" data-y1="${i}" style="
                  left: ${x}px; 
                  top: ${y}px; 
                  background-image: url('${url}');
                  background-size: ${width}px ${height}px;
                  width: ${tileSizeX}px; 
                  height: ${tileSizeY}px;
                  background-position: ${bgPosX}px ${bgPosY}px;
                  opacity: 0;
                  z-index: 12;
                  transition: opacity 0.3s ease;">
                  <span class="PZLP-NumberShow">${z + 1}</span>
                </div>`);
                z++;
            }
        }

        const ns = $eXePuzzle.generateRandomArray(z);
        let counter = 0;
        const counterClock = setInterval(() => {
            let $node = $('#pzlMainContainer-' + instance);
            let $content = $('#node-content');
            if (
                !$node.length ||
                ($content.length && $content.attr('mode') === 'edition')
            ) {
                clearInterval(counterClock);
                return;
            }

            if (counter < z)
                $(`#pzlTile${instance}-${ns[counter]}`).css({ opacity: 1 });
            else {
                clearInterval(counterClock);
                $('#pzlImage-' + instance).css({
                    opacity: '1',
                    display: 'none',
                });
                setTimeout(function () {
                    $eXePuzzle.showCompletedWindows(instance);
                }, 300);
            }
            counter++;
        }, 300);
    },

    generateRandomArray: function (num) {
        const array = Array.from({ length: num }, (_, i) => i);
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },

    shuffle: function (instance, columns) {
        const mOptions = $eXePuzzle.options[instance],
            q = mOptions.puzzlesGame[mOptions.active];

        for (let i = q.parts.length - 2; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [q.parts[i], q.parts[j]] = [q.parts[j], q.parts[i]];
        }

        if (q.type == 0 && !$eXePuzzle.isSolvable(q.parts, columns)) {
            for (let i = 0; i < q.parts.length - 1; i++) {
                if (
                    q.parts[i] &&
                    q.parts[i + 1] &&
                    q.parts[i].id > q.parts[i + 1].id
                ) {
                    [q.parts[i], q.parts[i + 1]] = [q.parts[i + 1], q.parts[i]];
                    break;
                }
            }
        }

        q.parts.forEach((part, index) => {
            if (part) {
                const tile = $(`#pzlTile${instance}-${index}`),
                    x = part.x,
                    y = part.y;
                tile.data({ x: x, y: y }).css({
                    left: `${x * q.tileSizeX}px`,
                    top: `${y * q.tileSizeY}px`,
                });
            }
        });
    },

    isSolvable: function (parts, columns) {
        let inversions = 0,
            emptyRow = 0;

        parts.forEach((currentPart, index) => {
            if (currentPart && currentPart.id !== null) {
                for (let j = index + 1; j < parts.length; j++) {
                    if (
                        parts[j] &&
                        parts[j].id !== null &&
                        currentPart.id > parts[j].id
                    )
                        inversions++;
                }
            }
        });

        return columns % 2 === 0
            ? (inversions + emptyRow) % 2 === 0
            : inversions % 2 === 0;
    },

    checkCorrectPlaces: function (instance) {
        const mOptions = $eXePuzzle.options[instance],
            q = mOptions.puzzlesGame[mOptions.active],
            cols = q.columns,
            classPieee = q.type == 0 ? '.PZLP-Tile' : '.PZLP-TileChange';
        let isSolved = true;

        $('#pzlGameContainer-' + instance)
            .find(classPieee)
            .each(function () {
                const $tile = $(this),
                    index = $tile.data('index'),
                    expectedX = index % cols,
                    expectedY = Math.floor(index / cols),
                    currentX = $tile.data('x'),
                    currentY = $tile.data('y');
                if (expectedX !== currentX || expectedY !== currentY) {
                    isSolved = false;
                    return false;
                }
            });

        return isSolved;
    },

    checkIfSolved: function (instance) {
        const mOptions = $eXePuzzle.options[instance],
            q = mOptions.puzzlesGame[mOptions.active],
            isSolved = $eXePuzzle.checkCorrectPlaces(instance);

        mOptions.loading = false;
        if (
            mOptions.attemps == 0 &&
            q.audioDefinition.length > 4 &&
            mOptions.audiofirst
        )
            $exeDevices.iDevice.gamification.media.playSound(
                q.audioDefinition,
                mOptions
            );

        mOptions.attemps++;
        $('#pzlAttemps-' + instance).text(mOptions.attemps);

        if (isSolved) {
            mOptions.gameActived = true;
            if (q.audioClue && q.audioClue.length > 4) {
                $eXePuzzle.stopAllSounds(instance);
                $('#pzlAudioClue-' + instance).css('display', 'block');
                $exeDevices.iDevice.gamification.media.playSound(
                    q.audioClue,
                    mOptions
                );
            }
            $eXePuzzle.showSholution(instance);
            if (mOptions.isScorm == 1) {
                const score = (
                    (mOptions.hits * 10) /
                    mOptions.puzzlesGame.length
                ).toFixed(2);
                $eXePuzzle.sendScore(true, instance);
                $('#pzlRepeatActivity-' + instance).text(
                    `${mOptions.msgs.msgYouScore}: ${score}`
                );
                $eXePuzzle.initialScore = score;
            }
            clearInterval(mOptions.counterClock);
        }
    },

    drawImage: function (div, image, mData) {
        $(image).css({
            position: 'absolute',
            left: `${mData.x}px`,
            top: 0,
            width: `${mData.w}px`,
            height: `${mData.h}px`,
        });
        $(div).css({
            position: 'absolute',
            left: `${mData.x}px`,
            top: 0,
            width: `${mData.w}px`,
            height: `${mData.h}px`,
        });
    },

    saveEvaluation: function (instance) {
        const mOptions = $eXePuzzle.options[instance];
        mOptions.scorerp = (mOptions.hits * 10) / mOptions.numberQuestions;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $eXePuzzle.isInExe
        );
    },

    sendScore: function (auto, instance) {
        const mOptions = $eXePuzzle.options[instance];

        mOptions.scorerp = (mOptions.hits * 10) / mOptions.numberQuestions;
        mOptions.previousScore = $eXePuzzle.previousScore;
        mOptions.userName = $eXePuzzle.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $eXePuzzle.previousScore = mOptions.previousScore;
    },

    clear: function (puzzle) {
        return puzzle.replace(/[&\s\n\r]+/g, ' ').trim();
    },

    removeEvents: function (instance) {
        const mOptions = $eXePuzzle.options[instance];

        $('#pzlLinkMaximize-' + instance).off('click touchstart');
        $('#pzlLinkMinimize-' + instance).off('click touchstart');
        $('#pzlLinkFullScreen-' + instance).off('click touchstart');
        $('#pzlFeedBackClose-' + instance).off('click');
        $('#pzlCodeAccessButton-' + instance).off('click touchstart');
        $('#pzlCodeAccessE-' + instance).off('keydown');
        $('#pzlStartGameEnd-' + instance).off('click');
        $('#pzlMainContainer-' + instance)
            .closest('.idevice_node')
            .off('click', '.Games-SendScore');
        $('#pzlClueButton-' + instance).off('click');
        $('#pzlAudioDef-' + instance).off('click');
        $('#pzlAudioClue-' + instance).off('click');
        $('#pzlMultimedia-' + instance).off('click', '.PZLP-Tile');
        $('#pzlImagePuzzle-' + instance).off('click', '.PZLP-TileChange');
        $('#pzlShowImage-' + instance).off(
            'mouseenter click touchstart mouseleave touchend'
        );
        $('#pzlShowNumber-' + instance).off('click touchstart');
        $('#pzlImagePuzzle-' + instance).off('click', '.PZLP-NextPuzzle');
        $('#pzlImagePuzzle-' + instance).off('click', '.PZLP-RepeatPuzzle');

        $(window).off('unload.eXePuzzle beforeunload.eXePuzzle');

        let container = document.getElementById('pzlGameContainer-' + instance);
        if (container && mOptions.resizeObserver) {
            mOptions.resizeObserver.unobserve(container);
        }

        if (mOptions._fsBound && mOptions._fsHandler) {
            [
                'fullscreenchange',
                'webkitfullscreenchange',
                'mozfullscreenchange',
                'MSFullscreenChange',
            ].forEach(function (evt) {
                document.removeEventListener(evt, mOptions._fsHandler);
            });
            mOptions._fsBound = false;
            mOptions._fsHandler = null;
        }
    },

    addEvents: function (instance) {
        const mOptions = $eXePuzzle.options[instance];

        $('#pzlAudioDef-' + instance).hide();
        $('#pzlAudioClue-' + instance).hide();
        $('#pzlShowClue-' + instance).hide();
        $('#pzlPHits-' + instance).text(mOptions.hits);
        $('#pzlPNumber-' + instance).text(mOptions.numberQuestions);
        $('#pzlPScore-' + instance).text(mOptions.score);
        $('#pzlPErrors-' + instance).text(mOptions.errors);
        $('#pzlCubierta-' + instance).hide();
        $('#pzlGameOver-' + instance).hide();
        $('#pzlTime-' + instance).hide();
        $('#pzlImgTime-' + instance).hide();
        $('#pzlAttemps-' + instance).hide();
        $('#pzlImgAttemps-' + instance).hide();
        $('#pzlCubierta-' + instance).hide();
        $('#pzlGameOver-' + instance).hide();
        $('#pzlCodeAccessDiv-' + instance).hide();

        $('#pzlLinkMaximize-' + instance).on('click touchstart', function (e) {
            e.preventDefault();
            $('#pzlGameContainer-' + instance).show();
            $('#pzlGameMinimize-' + instance).hide();
        });

        $('#pzlLinkMinimize-' + instance).on('click touchstart', function (e) {
            e.preventDefault();
            $('#pzlGameContainer-' + instance).hide();
            $('#pzlGameMinimize-' + instance)
                .css('visibility', 'visible')
                .show();
        });

        $('#pzlLinkFullScreen-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                const element = document.getElementById(
                    'pzlGameContainer-' + instance
                );
                $eXePuzzle.bindFullscreenEvents(instance);
                $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                    element,
                    instance
                );
            }
        );

        $('#pzlFeedBackClose-' + instance).on('click', function () {
            $('#pzlDivFeedBack-' + instance).hide();
            $('#pzlGameOver-' + instance).show();
        });

        if (mOptions.itinerary.showCodeAccess) {
            $('#pzlMesajeAccesCodeE-' + instance).text(
                mOptions.itinerary.messageCodeAccess
            );
            $('#pzlCodeAccessDiv-' + instance).show();
            $('#pzlCubierta-' + instance).show();
        }

        $('#pzlCodeAccessButton-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $eXePuzzle.enterCodeAccess(instance);
            }
        );

        $('#pzlCodeAccessE-' + instance).on('keydown', function (event) {
            if (event.which == 13 || event.keyCode == 13) {
                $eXePuzzle.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        $('#pzlPNumber-' + instance).text(mOptions.numberQuestions);

        $(window).on('unload.eXePuzzle beforeunload.eXePuzzle', function () {
            if (typeof $eXePuzzle.mScorm != 'undefined') {
                $exeDevices.iDevice.gamification.scorm.endScorm(
                    $eXePuzzle.mScorm
                );
            }
        });

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        $('#pzlMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $eXePuzzle.sendScore(false, instance);
                $eXePuzzle.saveEvaluation(instance);
            });

        $('#pzlStartGameEnd-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXePuzzle.showPuzzle(0, instance);
            $eXePuzzle.startGame(instance);
            $('#pzlCubierta-' + instance).hide();
        });

        $('#pzlClueButton-' + instance).on('click', function (e) {
            e.preventDefault();
            $('#pzlShowClue-' + instance).hide();
            $('#pzlCubierta-' + instance).fadeOut();
        });
        if (mOptions.time == 0) {
            $('#pzlTime-' + instance).hide();
            $('#pzlImgTime-' + instance).hide();
            $eXePuzzle.uptateTime(0, instance);
        } else {
            $eXePuzzle.uptateTime(0 * 60, instance);
        }

        if (mOptions.author.trim().length > 0 && !mOptions.fullscreen) {
            $('#pzlAuthorGame-' + instance).html(
                mOptions.msgs.msgAuthor + ': ' + mOptions.author
            );
            $('#pzlAuthorGame-' + instance).show();
        }

        $('#pzlnextPuzzle-' + instance).hide();
        $('#pzlShowImage-' + instance).hide();
        $('#pzlShowNumber-' + instance).hide();

        setTimeout(function () {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                $eXePuzzle.isInExe
            );
        }, 500);

        $('#pzlAudioDef-' + instance).on('click', function (e) {
            e.preventDefault();
            mOptions.loading = false;
            const sound = mOptions.puzzlesGame[mOptions.active].audioDefinition;
            if (sound && sound.length > 4) {
                $exeDevices.iDevice.gamification.media.playSound(
                    sound,
                    mOptions
                );
            }
        });

        $('#pzlAudioClue-' + instance).on('click', function (e) {
            e.preventDefault();
            const sound = mOptions.puzzlesGame[mOptions.active].audioClue;
            if (sound && sound.length > 4) {
                $exeDevices.iDevice.gamification.media.playSound(
                    sound,
                    mOptions
                );
            }
        });

        $('#pzlMultimedia-' + instance).on('click', '.PZLP-Tile', function () {
            let q = mOptions.puzzlesGame[mOptions.active];
            if (
                mOptions.gameActived ||
                mOptions.gameOver ||
                !mOptions.gameStarted
            )
                return;
            let $tile = $(this),
                tileX = $tile.data('x'),
                tileY = $tile.data('y');
            if (
                (Math.abs(q.emptyX - tileX) === 1 && q.emptyY === tileY) ||
                (Math.abs(q.emptyY - tileY) === 1 && q.emptyX === tileX)
            ) {
                mOptions.gameActived = true;
                $tile.animate(
                    {
                        left: q.emptyX * q.tileSizeX,
                        top: q.emptyY * q.tileSizeY,
                    },
                    300,
                    function () {
                        $tile.data('x', q.emptyX);
                        $tile.data('y', q.emptyY);
                        q.emptyX = tileX;
                        q.emptyY = tileY;
                        mOptions.gameActived = false;
                        $eXePuzzle.checkIfSolved(instance);
                    }
                );
            }
        });

        $('#pzlImagePuzzle-' + instance).on(
            'click',
            '.PZLP-TileChange',
            function () {
                if (
                    mOptions.gameActived ||
                    mOptions.gameOver ||
                    !mOptions.gameStarted
                )
                    return;
                let $tile = $(this);
                if (!mOptions.selectedTile) {
                    mOptions.selectedTile = $tile;
                    $tile.css('border', '3px solid #fb0000');
                } else if ($tile.is(mOptions.selectedTile)) {
                    mOptions.selectedTile.css('border', '1px solid white');
                    mOptions.selectedTile = null;
                } else {
                    const selectedX = $tile.data('x'),
                        selectedY = $tile.data('y');
                    $tile.data('x', mOptions.selectedTile.data('x'));
                    $tile.data('y', mOptions.selectedTile.data('y'));
                    mOptions.selectedTile.data('x', selectedX);
                    mOptions.selectedTile.data('y', selectedY);

                    const selectedTileX = mOptions.selectedTile.css('left'),
                        selectedTileY = mOptions.selectedTile.css('top');
                    mOptions.selectedTile.css({
                        'z-index': '20',
                        border: '1px solid white',
                    });
                    $tile.css({ 'z-index': '20', border: '1px solid white' });
                    mOptions.gameActived = true;

                    mOptions.selectedTile.animate(
                        {
                            left: $tile.css('left'),
                            top: $tile.css('top'),
                        },
                        300
                    );
                    $tile.animate(
                        {
                            left: selectedTileX,
                            top: selectedTileY,
                        },
                        300,
                        function () {
                            mOptions.selectedTile.css({ 'z-index': '1' });
                            $tile.css({ 'z-index': '1' });
                            mOptions.selectedTile = null;
                            mOptions.gameActived = false;
                            $eXePuzzle.checkIfSolved(instance);
                        }
                    );
                }
            }
        );

        $('#pzlShowImage-' + instance).on(
            'mouseenter click touchstart',
            function (e) {
                e.preventDefault();
                $('#pzlImage-' + instance).css({
                    'z-index': '10',
                    display: 'block',
                });
            }
        );

        $('#pzlShowImage-' + instance).on('mouseleave touchend', function (e) {
            e.preventDefault();
            $('#pzlImage-' + instance).hide();
        });

        $('#pzlShowNumber-' + instance).on('click touchstart', function (e) {
            e.preventDefault();
            const $numbers = $('#pzlImagePuzzle-' + instance).find(
                '.PZLP-NumberShow'
            );
            $numbers.each(function () {
                let $number = $(this);
                if ($number.css('display') === 'none') {
                    $number.css({
                        display: 'flex',
                        'z-index': 11,
                    });
                } else {
                    $number.css('display', 'none');
                }
            });
        });

        $('#pzlImagePuzzle-' + instance).on(
            'click',
            '.PZLP-NextPuzzle',
            function (e) {
                e.preventDefault();
                $eXePuzzle.nextPuzzle(instance);
            }
        );

        $('#pzlImagePuzzle-' + instance).on(
            'click',
            '.PZLP-RepeatPuzzle',
            function (e) {
                e.preventDefault();
                mOptions.hits--;
                $eXePuzzle.updateScoreRepeat(instance);
                $eXePuzzle.showPuzzle(mOptions.active, instance);
                $eXePuzzle.bindFullscreenEvents(instance);
                setTimeout(function () {
                    $eXePuzzle.resizePuzzlePieces(instance);
                }, 50);
            }
        );

        let resizeObserver = new ResizeObserver(
            $eXePuzzle.debounce(function (entries) {
                $eXePuzzle.onContainerResize(instance, entries);
            }, 100)
        );

        const container = document.getElementById(
            'pzlGameContainer-' + instance
        );
        if (container) {
            resizeObserver.observe(container);
        }

        $('#pzlMainContainer-' + instance)
            .closest('article')
            .on('click', '.box-toggle-on', function (e) {
                $eXePuzzle.resizePuzzlePieces(instance);
            });
    },

    placeImageWindows: function (naturalWidth, naturalHeight, instance) {
        let $parent = $('#pzlMainContainer-' + instance);
        if (
            $eXePuzzle.isInExe &&
            ($parent.length === 0 || !$parent.is(':visible'))
        ) {
            $parent = $('#node-content-container');
        }

        const container = document.getElementById(
            'pzlGameContainer-' + instance
        );
        const isFS = !!(
            container &&
            (container.classList.contains('PZLP-IsFull') ||
                document.fullscreenElement === container ||
                document.webkitFullscreenElement === container ||
                document.mozFullScreenElement === container ||
                document.msFullscreenElement === container)
        );

        const isMobile = $eXePuzzle.isMobile();
        const parentWidth = $parent.width() || 900;

        // En móviles, usar el ancho completo disponible
        // En desktop, limitar a 900px
        let baseWidth;
        if (isFS) {
            baseWidth =
                $('#pzlMultimedia-' + instance).width() || parentWidth || 900;
        } else if (isMobile) {
            // En móviles, usar el ancho completo del contenedor, con un mínimo de 280px
            baseWidth = Math.max(280, parentWidth);
        } else {
            // En desktop, limitar a 900px
            baseWidth = parentWidth > 900 ? 900 : parentWidth;
        }

        if (!baseWidth || baseWidth <= 0) baseWidth = 900;

        const wDiv = baseWidth,
            hDiv = (wDiv * 9) / 16,
            wM = wDiv,
            hM = hDiv,
            varW = naturalWidth / wDiv,
            varH = naturalHeight / hDiv;

        let wImage = wDiv,
            hImage = hDiv,
            xImagen = 0,
            yImagen = 0;

        if (varW > varH) {
            wImage = parseInt(wDiv);
            hImage = parseInt(naturalHeight / varW);
            yImagen = parseInt((hDiv - hImage) / 2);
        } else {
            wImage = parseInt(naturalWidth / varH);
            hImage = parseInt(hDiv);
            xImagen = parseInt((wDiv - wImage) / 2);
        }

        return { w: wImage, h: hImage, x: xImagen, y: yImagen, wm: wM, hm: hM };
    },

    placeImageWindows1: function (naturalWidth, naturalHeight, instance) {
        const wDiv =
                $('#pzlImageDiv-' + instance).width() > 200
                    ? $('#pzlImageDiv-' + instance).width()
                    : 900,
            hDiv =
                $('#pzlImageDiv-' + instance).height() > 112
                    ? $('#pzlImageDiv-' + instance).height()
                    : 504,
            wM =
                $('#pzlMultimeda-' + instance).width() > 200
                    ? $('#pzlMultimeda-' + instance).width()
                    : 900,
            hM =
                $('#pzlMultimeda-' + instance).height() > 112
                    ? $('#pzlMultimeda-' + instance).height()
                    : 504,
            varW = naturalWidth / wDiv,
            varH = naturalHeight / hDiv;

        let wImage = wDiv,
            hImage = hDiv,
            xImagen = 0,
            yImagen = 0;

        if (varW > varH) {
            wImage = parseInt(wDiv);
            hImage = parseInt(naturalHeight / varW);
            yImagen = parseInt((hDiv - hImage) / 2);
        } else {
            wImage = parseInt(naturalWidth / varH);
            hImage = parseInt(hDiv);
            xImagen = parseInt((wDiv - wImage) / 2);
        }
        return {
            w: wImage,
            h: hImage,
            x: xImagen,
            y: yImagen,
            wm: wM,
            hm: hM,
        };
    },

    nextPuzzle: function (instance) {
        const mOptions = $eXePuzzle.options[instance];
        $eXePuzzle.stopAllSounds(instance);

        mOptions.active++;
        if (mOptions.active < mOptions.puzzlesGame.length) {
            $eXePuzzle.showPuzzle(mOptions.active, instance);
            setTimeout(function () {
                $eXePuzzle.resizePuzzlePieces(instance);
            }, 300);
        } else {
            $eXePuzzle.gameOver(1, instance);
        }
    },

    enterCodeAccess: function (instance) {
        const mOptions = $eXePuzzle.options[instance];

        if (
            mOptions.itinerary.codeAccess ===
            $(`#pzlCodeAccessE-${instance}`).val()
        ) {
            $(`#pzlLinkMaximize-${instance}`).trigger('click');
            $(`#pzlCodeAccessDiv-${instance}`).hide();
            $(`#pzlCubierta-${instance}`).hide();
        } else {
            $(`#pzlMesajeAccesCodeE-${instance}`)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $(`#pzlCodeAccessE-${instance}`).val('');
        }
    },

    startGame: function (instance) {
        const mOptions = $eXePuzzle.options[instance];

        if (mOptions.gameStarted) return;

        mOptions.hits = 0;
        mOptions.errors = 0;
        mOptions.score = 0;
        mOptions.gameActived = false;
        mOptions.counter = 0;
        mOptions.gameOver = false;
        mOptions.gameStarted = false;
        mOptions.obtainedClue = false;

        $(`#pzlShowClue-${instance}`).hide();
        $(`#pzlPHits-${instance}`).text(mOptions.hits);
        $(`#pzlPNumber-${instance}`).text(mOptions.numberQuestions);
        $(`#pzlPScore-${instance}`).text(mOptions.score);
        $(`#pzlPErrors-${instance}`).text(mOptions.errors);
        $(`#pzlCubierta-${instance}`).hide();
        $(`#pzlGameOver-${instance}`).hide();
    },

    uptateTime: function (time, instance) {
        const mtime =
            $exeDevices.iDevice.gamification.helpers.getTimeToString(time);
        $(`#pzlTime-${instance}`).text(mtime);
    },

    isMobile: function () {
        return (
            navigator.userAgent.match(/Android/i) ||
            navigator.userAgent.match(/BlackBerry/i) ||
            navigator.userAgent.match(/iPhone|iPad|iPod/i) ||
            navigator.userAgent.match(/Opera Mini/i) ||
            navigator.userAgent.match(/IEMobile/i)
        );
    },

    showScoreGame: function (type, instance) {
        const mOptions = $eXePuzzle.options[instance],
            msgs = mOptions.msgs,
            $pzlHistGame = $('#pzlHistGame-' + instance),
            $pzlLostGame = $('#pzlLostGame-' + instance),
            $pzlOverNumCards = $('#pzlOverNumCards-' + instance),
            $pzlOverHits = $('#pzlOverHits-' + instance),
            $pzlOverErrors = $('#pzlOverErrors-' + instance),
            $pzlOverScore = $('#pzlOverScore-' + instance),
            $pzlCubierta = $('#pzlCubierta-' + instance),
            $pzlGameOver = $('#pzlGameOver-' + instance);

        let message = '',
            messageColor = 1;

        $pzlHistGame.hide();
        $pzlLostGame.hide();
        $pzlOverNumCards.show();
        $pzlOverHits.show();
        let mclue = '';
        switch (type) {
            case 0:
                message = msgs.mgsAllPhrases;
                messageColor = 2;
                $pzlHistGame.show();
                if (mOptions.itinerary.showClue) {
                    const text =
                        mOptions.msgs.msgClue +
                        ' ' +
                        mOptions.itinerary.clueGame;
                    if (mOptions.obtainedClue) {
                        mclue = text;
                    } else {
                        mclue = msgs.msgTryAgain.replace(
                            '%s',
                            mOptions.itinerary.percentageClue
                        );
                    }
                }
                break;
            case 1:
                messageColor = 3;
                message = msgs.mgsAllPhrases;
                $pzlLostGame.show();
                if (mOptions.itinerary.showClue) {
                    const text =
                        mOptions.msgs.msgClue +
                        ' ' +
                        mOptions.itinerary.clueGame;
                    if (mOptions.obtainedClue) {
                        mclue = text;
                    } else {
                        mclue = msgs.msgTryAgain.replace(
                            '%s',
                            mOptions.itinerary.percentageClue
                        );
                    }
                }
                break;
            case 2:
                messageColor = 3;
                message = msgs.msgTimeOver;
                $pzlLostGame.show();
                if (mOptions.itinerary.showClue) {
                    const text =
                        mOptions.msgs.msgClue +
                        ' ' +
                        mOptions.itinerary.clueGame;
                    if (mOptions.obtainedClue) {
                        mclue = text;
                    } else {
                        mclue = msgs.msgTryAgain.replace(
                            '%s',
                            mOptions.itinerary.percentageClue
                        );
                    }
                }
                break;
            case 3:
                messageColor = 3;
                message = msgs.mgsAllPhrases;
                $pzlLostGame.show();
                if (mOptions.itinerary.showClue) {
                    const text =
                        mOptions.msgs.msgClue +
                        ' ' +
                        mOptions.itinerary.clueGame;
                    if (mOptions.obtainedClue) {
                        mclue = text;
                    } else {
                        mclue = msgs.msgTryAgain.replace(
                            '%s',
                            mOptions.itinerary.percentageClue
                        );
                    }
                }
                break;
            default:
                break;
        }

        $eXePuzzle.showMessage(messageColor, message, instance, true);

        $pzlOverNumCards.html(
            msgs.msgActivities + ': ' + mOptions.puzzlesGame.length
        );
        $pzlOverHits.html(msgs.msgHits + ': ' + mOptions.hits);
        $pzlOverErrors.html(msgs.msgErrors + ': ' + mOptions.errors);
        $pzlOverScore.html(
            msgs.msgScore +
                ': ' +
                ((mOptions.hits / mOptions.numberQuestions) * 10).toFixed(2)
        );
        $pzlGameOver.show();
        $pzlCubierta.show();

        $('#pzlShowClue-' + instance).hide();
        if (mOptions.itinerary.showClue)
            $eXePuzzle.showMessage(3, mclue, instance, true);
    },

    gameOver: function (type, instance) {
        const mOptions = $eXePuzzle.options[instance];

        if (!mOptions.gameStarted) return;

        $(`#pzlImagePuzzle-${instance}`).find('.PZLP-Completed').remove();

        mOptions.gameStarted = false;
        mOptions.gameActived = true;
        mOptions.gameOver = true;

        clearInterval(mOptions.counterClock);

        $eXePuzzle.stopAllSounds(instance);
        $(`#pzlCubierta-${instance}`).show();
        $eXePuzzle.showScoreGame(type, instance);
        $eXePuzzle.saveEvaluation(instance);

        if (mOptions.isScorm === 1) {
            const score = (
                (mOptions.hits * 10) /
                mOptions.puzzlesGame.length
            ).toFixed(2);
            $eXePuzzle.sendScore(true, instance);
            $(`#pzlRepeatActivity-${instance}`).text(
                `${mOptions.msgs.msgYouScore}: ${score}`
            );
            $eXePuzzle.initialScore = score;
        }

        $eXePuzzle.showFeedBack(instance);
        $(`#pzlCodeAccessDiv-${instance}`).hide();
    },

    showFeedBack: function (instance) {
        const mOptions = $eXePuzzle.options[instance],
            puntos = (mOptions.hits * 100) / mOptions.puzzlesGame.length;

        if (mOptions.feedBack) {
            if (puntos >= mOptions.percentajeFB) {
                $(`#pzlGameOver-${instance}`).hide();
                $(`#pzlDivFeedBack-${instance}`)
                    .find('.puzzle-feedback-game')
                    .show()
                    .parent()
                    .show();
            } else {
                $eXePuzzle.showMessage(
                    1,
                    mOptions.msgs.msgTryAgain.replace(
                        '%s',
                        mOptions.percentajeFB
                    ),
                    instance,
                    false
                );
            }
        }
    },

    getRetroFeedMessages: function (iHit, instance) {
        const mOptions = $eXePuzzle.options[instance],
            sMessages = iHit
                ? mOptions.msgs.msgSuccesses
                : mOptions.msgs.msgFailures,
            messages = sMessages.split('|');

        return messages[Math.floor(Math.random() * messages.length)];
    },

    updateScore: function (correctAnswer, instance) {
        const mOptions = $eXePuzzle.options[instance],
            obtainedPoints = correctAnswer
                ? 10 / mOptions.puzzlesGame.length
                : 0;

        if (correctAnswer) mOptions.hits++;
        else mOptions.errors++;

        mOptions.score += obtainedPoints;
        const sscore =
            mOptions.score % 1 === 0
                ? mOptions.score
                : mOptions.score.toFixed(2);

        $('#pzlPNumber-' + instance).text(
            mOptions.puzzlesGame.length - mOptions.hits - mOptions.errors
        );
        $('#pzlPErrors-' + instance).text(mOptions.errors);
        $('#pzlPScore-' + instance).text(sscore);
        $('#pzlPHits-' + instance).text(mOptions.hits);

        if (
            (mOptions.score / mOptions.puzzlesGame.length) * 100 >
            mOptions.itinerary.percentageClue
        ) {
            mOptions.obtainedClue = true;
        }
        if (mOptions.isScorm === 1) {
            const score = (
                (mOptions.hits * 10) /
                mOptions.puzzlesGame.length
            ).toFixed(2);
            $eXePuzzle.sendScore(true, instance);
            $(`#pzlRepeatActivity-${instance}`).text(
                `${mOptions.msgs.msgYouScore}: ${score}`
            );
        }
        $eXePuzzle.saveEvaluation(instance);
    },

    updateScoreRepeat: function (instance) {
        const mOptions = $eXePuzzle.options[instance],
            obtainedPoints = 10 / mOptions.puzzlesGame.length;

        mOptions.score -= obtainedPoints;
        const sscore =
            mOptions.score % 1 === 0
                ? mOptions.score
                : mOptions.score.toFixed(2);

        $('#pzlPNumber-' + instance).text(
            mOptions.puzzlesGame.length - mOptions.hits - mOptions.errors
        );
        $('#pzlPErrors-' + instance).text(mOptions.errors);
        $('#pzlPScore-' + instance).text(sscore);
        $('#pzlPHits-' + instance).text(mOptions.hits);

        if (
            (mOptions.score / mOptions.puzzlesGame.length) * 100 >
            mOptions.itinerary.percentageClue
        ) {
            mOptions.obtainedClue = true;
        }

        $eXePuzzle.saveEvaluation(instance);
    },

    getMessageErrorAnswer: function (instance) {
        return $eXePuzzle.getRetroFeedMessages(false, instance);
    },

    showMessage: function (type, message, instance, end) {
        const mOptions = $eXePuzzle.options[instance],
            colors = [
                '#555555',
                $eXePuzzle.borderColors.red,
                $eXePuzzle.borderColors.green,
                $eXePuzzle.borderColors.blue,
                $eXePuzzle.borderColors.yellow,
            ],
            color = colors[type],
            $pzlMessage = $('#pzlMessage-' + instance);

        $pzlMessage.html(message).css({ color, 'font-style': 'bold' }).show();

        if (end) {
            $pzlMessage.hide();
            let endColor = mOptions.score >= 6 ? 2 : 1;
            $('#pzlMesasgeEnd-' + instance)
                .html(message)
                .css({ color: colors[endColor] });
            $eXePuzzle.showMessage(message);
        }
    },
};
$(function () {
    $eXePuzzle.init();
});
