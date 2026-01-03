/**
 * Select Activity iDevice (export code)
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 * Version 2.0
 */
var $eXeTrivial = {
    idevicePath: '',
    borderColors: {
        black: '#1c1b1b',
        blue: '#5877c6',
        green: '#00a300',
        red: '#b3092f',
        white: '#f9f9f9',
        yellow: '#f3d55a',
        grey: '#777777',
        incorrect: '#d9d9d9',
        correct: '#00ff00',
    },
    colors: {
        black: '#1c1b1b',
        blue: '#dfe3f1',
        green: '#caede8',
        red: '#fbd2d6',
        white: '#f9f9f9',
        yellow: '#fcf4d3',
        correct: '#dcffdc',
    },
    colorQuesos: [
        '#f05565',
        '#94e578',
        '#9ebcec',
        '#f1f370',
        '#e2b9ee',
        '#fbbd5d',
    ],
    colorsDado: ['#f44336', '#04458f', '#00af80', '#ffce00'],
    image: '',
    widthImage: 0,
    heightImage: 0,
    options: [],
    videos: [],
    video: {
        player: '',
        duration: 0,
        id: '',
    },
    player: '',
    userName: '',
    scorm: '',
    previousScore: '',
    initialScore: '',
    hasSCORMbutton: false,
    isInExe: false,
    tirada: 0,
    hasVideo: false,
    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',
    mScorm: null,
    version: 3,

    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            'TriviExt',
            'trivial',
            'trivial-IDevice'
        );
    },

    enable: function () {
        $eXeTrivial.loadGame();
    },

    saveDataStorage: function (instance) {
        const mOptions = $eXeTrivial.options[instance];

        if (typeof mOptions.trivialID == 'undefined') return;

        const data = {
            trivialID: mOptions.trivialID,
            gameStarted: mOptions.gameStarted,
            gameOver: mOptions.gameOver,
            gamers: mOptions.gamers,
            activePlayer: mOptions.activePlayer,
            activesQuestions: mOptions.activesQuestions,
            scoreGame: mOptions.scoreGame,
            obtainedClue: mOptions.obtainedClue,
            direccion: mOptions.direccion,
            contadorJuego: mOptions.contadorJuego,
        };
        localStorage.setItem(
            'dataTrivial-' + mOptions.trivialID,
            JSON.stringify(data)
        );
    },

    reloadGame: function (dataTrivial, instance) {
        const mOptions = $eXeTrivial.options[instance];
        let colorMessge = 1;

        mOptions.gameStarted = dataTrivial.gameStarted;
        mOptions.gameOver = dataTrivial.gameOver;
        mOptions.gamers = dataTrivial.gamers;
        mOptions.activePlayer = dataTrivial.activePlayer;
        mOptions.activesQuestions = dataTrivial.activesQuestions;
        mOptions.obtainedClue = dataTrivial.obtainedClue;
        mOptions.scoreGame = dataTrivial.activesQuestions;
        mOptions.direccion = dataTrivial.direccion;
        mOptions.contadorJuego = dataTrivial.contadorJuego;

        if (mOptions.gameOver) {
            const message = mOptions.msgs.msgDesafioSolved;
            colorMessge = 2;
            $eXeTrivial.gameOver(instance);
            $eXeTrivial.showMessage(colorMessge, message, instance);
        } else {
            $eXeTrivial.continueGame(instance);
        }
    },

    loadGame: function () {
        $eXeTrivial.options = [];
        $eXeTrivial.activities.each(function (i) {
            const dl = $('.trivial-DataGame', this);
            let mOption = $eXeTrivial.loadDataGame(dl),
                msg = mOption.msgs.msgPlayStart;

            mOption = $eXeTrivial.loadMedias(mOption, this);
            mOption.scorerp = 0;
            mOption.idevicePath = $eXeTrivial.idevicePath;
            mOption.main = 'trivialMainContainer-' + i;
            mOption.idevice = 'trivial-IDevice';

            for (let j = 0; j < mOption.numeroTemas; j++) {
                mOption.activesQuestions.push(-1);
                let cuestions = mOption.temas[j];
                cuestions =
                    $exeDevices.iDevice.gamification.helpers.shuffleAds(
                        cuestions
                    );
                mOption.temas[j] = cuestions;
            }
            $eXeTrivial.options.push(mOption);

            const trivial = $eXeTrivial.createInterfaceTrivial(i);
            dl.before(trivial).remove();

            $('#trivialGameMinimize-' + i).hide();
            $('#trivialGameContainer-' + i)
                .find('.trivial-Message')
                .hide();
            $('#trivialGameContainer-' + i).hide();
            $('#trivialMessageModal-' + i).hide();
            if (mOption.showMinimize) {
                $('#trivialGameMinimize-' + i)
                    .css({
                        cursor: 'pointer',
                    })
                    .show();
            } else {
                $('#trivialGameContainer-' + i).show();
            }
            $('#trivialMessageMaximize-' + i).text(msg);
            $eXeTrivial.addEvents(i);
            $('#trivialMainContainer-' + i).show();
        });

        let node = document.querySelector('.page-content');
        if (this.isInExe) {
            node = document.getElementById('node-content');
        }
        if (node)
            $exeDevices.iDevice.gamification.observers.observeResize(
                $eXeTrivial,
                node
            );

        $exeDevices.iDevice.gamification.math.updateLatex('.trivial-IDevice');

        if ($eXeTrivial.hasVideo) $eXeTrivial.loadApiPlayer();
    },

    loadMedias: function (game, sgame) {
        for (let j = 0; j < game.numeroTemas; j++) {
            const $imagesLink = $('.trivial-LinkImages-' + j, sgame),
                $audiosLink = $('.trivial-LinkAudios-' + j, sgame),
                tema = game.temas[j];

            for (let i = 0; i < tema.length; i++) {
                tema[i].audio =
                    typeof tema[i].audio == 'undefined' ? '' : tema[i].audio;
            }

            $imagesLink.each(function () {
                const iq = parseInt($(this).text());
                if (!isNaN(iq) && iq < tema.length) {
                    tema[iq].url = $(this).prop('href');
                    if (tema[iq].url.length < 4 && tema[iq].type == 1) {
                        tema[iq].url = '';
                    }
                }
            });
            $audiosLink.each(function () {
                const iq = parseInt($(this).text());
                if (!isNaN(iq) && iq < tema.length) {
                    tema[iq].audio = $(this).prop('href');
                    if (tema[iq].audio.length < 4) {
                        tema[iq].audio = '';
                    }
                }
            });
        }
        return game;
    },

    testPositions: function (instance) {
        const mOptions = $eXeTrivial.options[instance],
            numasi = mOptions.numeroTemas < 5 ? 4 : mOptions.numeroTemas;
        for (let i = 0; i < mOptions.pT.length; i++) {
            for (let j = 1; j < numasi + 1; j++) {
                let sitiosActivos = [];
                if (mOptions.numeroTemas == 2) {
                    sitiosActivos = $eXeTrivial.getNextPositions2(
                        j,
                        i,
                        instance
                    );
                } else if (mOptions.numeroTemas == 3) {
                    sitiosActivos = $eXeTrivial.getNextPositions3(
                        j,
                        i,
                        instance
                    );
                } else if (mOptions.numeroTemas == 4) {
                    sitiosActivos = $eXeTrivial.getNextPositions4(
                        j,
                        i,
                        instance
                    );
                } else if (mOptions.numeroTemas == 5) {
                    sitiosActivos = $eXeTrivial.getNextPositions5(
                        j,
                        i,
                        instance
                    );
                } else if (mOptions.numeroTemas == 6) {
                    sitiosActivos = $eXeTrivial.getNextPositions6(
                        j,
                        i,
                        instance
                    );
                }
            }
        }
    },

    createInterfaceTrivial: function (instance) {
        const path = $eXeTrivial.idevicePath,
            msgs = $eXeTrivial.options[instance].msgs,
            mOptions = $eXeTrivial.options[instance],
            html = `
            <div class="trivial-MainContainer" id="trivialMainContainer-${instance}">
                <div class="trivial-GameMinimize" id="trivialGameMinimize-${instance}">
                    <a href="#" class="trivial-LinkMaximize" id="trivialLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                        <img src="${path}trivialIcon.png" class="trivial-Icons trivial-IconMinimize trivial-Activo" alt="${msgs.msgMaximize}">
                        <div class="trivial-MessageMaximize" id="trivialMessageMaximize-${instance}">${msgs.msgMaximize}</div>
                    </a>
                </div>
                <div class="trivial-botones">
                    <div class="trivial-prueba">1</div>
                    <div class="trivial-prueba">2</div>
                    <div class="trivial-prueba">3</div>
                    <div class="trivial-prueba">4</div>
                    <div class="trivial-prueba">5</div>
                    <div class="trivial-prueba">6</div>
                </div>
                <div class="trivial-GameContainer" id="trivialGameContainer-${instance}">
                    <div class="trivial-Tablero" id="trivialTablero-${instance}">
                        <div class="trivial-Tiempo">
                            <p class="trivial-PTiempo" id="trivialTiempo-${instance}">00:00</p>
                        </div>
                        <img class="trivial-ImageTablero" id="trivialImageTablero-${instance}" src="${path}tvltv6.png" alt="Tablero">
                        <a href="#" class="trivial-LinkFullScreen" id="trivialLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                            <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-FullScreen trivial-Activo" id="trivialFullScreen-${instance}"></div>
                        </a>
                        <a href="#" class="trivial-LinkMinimize" id="trivialLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                            <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Minimize trivial-Activo"></div>
                        </a>
                        <a href="#" class="trivial-LinkReboot" id="trivialLinkReboot-${instance}" title="${msgs.msgRestart}">
                            <strong><span class="sr-av">${msgs.msgRestart}:</span></strong>
                            <div class="exeQuextIcons-Reboot trivial-Activo" id="trivialReboot-${instance}"></div>
                        </a>
                        <div class="trivial-Protector"></div>
                        <div class="trivial-Ficha trivial-JugadorRojo"></div>
                        <div class="trivial-Ficha trivial-JugadorAzul"></div>
                        <div class="trivial-Ficha trivial-JugadorVerde"></div>
                        <div class="trivial-Ficha trivial-JugadorAmarillo"></div>
                        <div class="trivial-CasillaDestino" data-number="0" data-position="0"></div>
                        <div class="trivial-CasillaDestino" data-number="1" data-position="0"></div>
                        <div class="trivial-CasillaDestino" data-number="2" data-position="0"></div>
                        <div class="trivial-CasillaDestino" data-number="3" data-position="0"></div>
                        <div class="trivial-CasillaDestino" data-number="4" data-position="0"></div>
                        <div class="trivial-CasillaDestino" data-number="5" data-position="0"></div>
                        <div class="trivial-CasillaDestino" data-number="6" data-position="0"></div>
                        <div class="trivial-SelectsGamers" id="trivialSelectsGamers-${instance}">
                            <div class="trivial-NumberGamers" id="trivialNumberGamers-${instance}">
                                <p>Jugadores:</p>
                                <a href="#" class="trivial-NumberIcon trivial-Activo" data-number="1">
                                    <img src="${path}tvlcr1.png" alt="1" width="28px">
                                </a>
                                <a href="#" class="trivial-NumberIcon trivial-Activo" data-number="2">
                                    <img src="${path}tvlcb2.png" alt="2" width="28">
                                </a>
                                <a href="#" class="trivial-NumberIcon trivial-Activo" data-number="3">
                                    <img src="${path}tvlcb3.png" alt="3" width="28">
                                </a>
                                <a href="#" class="trivial-NumberIcon trivial-Activo" data-number="4">
                                    <img src="${path}tvlcb4.png" alt="4" width="28">
                                </a>
                            </div>
                            <div class="trivial-NameGamers" id="trivialNameGamers-${instance}">
                                <div class="trivial-JugadorData">
                                    <div class="trivial-FichaJugador trivial-JugadorRojo"></div>
                                    <label for="inputjugador0"></label>
                                    <input type="text" name="inputjugador0" class="trivial-NameGamer form-control" id="inputjugador0" autocomplete="off">
                                </div>
                                <div class="trivial-JugadorData">
                                    <div class="trivial-FichaJugador trivial-JugadorAzul"></div>
                                    <label for="inputjugador1"></label>
                                    <input type="text" name="inputjugador1" class="trivial-NameGamer form-control" id="inputjugador1" autocomplete="off">
                                </div>
                                <div class="trivial-JugadorData">
                                    <div class="trivial-FichaJugador trivial-JugadorVerde"></div>
                                    <label for="inputjugador2"></label>
                                    <input type="text" name="inputjugador2" class="trivial-NameGamer form-control" id="inputjugador2" autocomplete="off">
                                </div>
                                <div class="trivial-JugadorData">
                                    <div class="trivial-FichaJugador trivial-JugadorAmarillo"></div>
                                    <label for="inputjugador3"></label>
                                    <input type="text" name="inputjugador3" class="trivial-NameGamer form-control" id="inputjugador3" autocomplete="off">
                                </div>
                            </div>
                            <a href="#" id="trivialStartGame-${instance}" class="trivial-StartGame">Iniciar partida</a>
                        </div>
                        <div class="trivial-Message" id="trivialMessage-${instance}">
                            <img class="trivial-MessageImage" id="trivialMessageImage-${instance}" src="${path}trivialIcon.png" alt="Image">
                            <p id="trivialPMessage-${instance}"></p>
                        </div>
                        <div class="trivial-Dado" id="trivialDado-${instance}">
                            <div class="trivial-FondoDado" id="trivialFondoDado-${instance}"></div>
                            <div class="trivial-PuntosDado" id="trivialPuntosDado-${instance}"></div>
                            <a href="#" class="trivialClick" id="trivialClickDado-${instance}">
                                <div class="trivial-ManoDado trivial-Activo"></div>
                            </a>
                        </div>
                        <div class="trivial-MessageModal" id="trivialMessageModal-${instance}">
                            <div class="trivial-MessageModalIcono"></div>
                            <div class="trivial-MessageModalTexto" id="trivialMessageModalTexto-${instance}">
                                <p id="trivialPMessageModal-${instance}">${msgs.msgReboot}</p>
                                <div class="trivial-MessageButtons">
                                    <a href="#" id="trivialMessageAceptar-${instance}" title="${msgs.msgSubmit}">
                                        <strong><span class="sr-av">${msgs.msgSubmit}</span></strong>
                                        <div class="trivial-AcceptButton trivial-Activo"></div>
                                    </a>
                                    <a href="#" id="trivialMessageCancelar-${instance}" title="${msgs.msgSubmit}">
                                        <strong><span class="sr-av">${msgs.msgSubmit}</span></strong>
                                        <div class="trivial-CancelButton trivial-Activo"></div>
                                    </a>
                                </div>
                            </div>
                            <div class="trivial-CodeAccessDiv" id="trivialCodeAccessDiv-${instance}">
                                <div class="trivial-MessageCodeAccessE" id="trivialMesajeAccesCodeE-${instance}"></div>
                                <div class="trivial-DataCodeAccessE">
                                    <input type="text" class="trivial-CodeAccessE form-control" id="trivialCodeAccessE-${instance}">
                                    <a href="#" id="trivialCodeAccessButton-${instance}" title="${msgs.msgSubmit}">
                                        <strong><span class="sr-av">${msgs.msgSubmit}</span></strong>
                                        <div class="exeQuextIcons-Submit trivial-Activo"></div>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="trivial-PanelLateral">
                        <div class="trivial-Jugadores" id="trivialJugadores-${instance}">
                            <div class="trivial-Jugador trivialj0">
                                <div class="trivial-JugadorRojo trivial-JugadoresMochila"></div>
                                <div class="trivial-Q1 trivial-Queso"></div>
                                <div class="trivial-Q2 trivial-Queso"></div>
                                <div class="trivial-Q3 trivial-Queso"></div>
                                <div class="trivial-Q4 trivial-Queso"></div>
                                <div class="trivial-Q5 trivial-Queso"></div>
                                <div class="trivial-Q6 trivial-Queso"></div>
                                <div class="trivial-Puntos">0</div>
                            </div>
                            <div class="trivial-Jugador trivialj1">
                                <div class="trivial-JugadorAzul trivial-JugadoresMochila"></div>
                                <div class="trivial-Q1 trivial-Queso"></div>
                                <div class="trivial-Q2 trivial-Queso"></div>
                                <div class="trivial-Q3 trivial-Queso"></div>
                                <div class="trivial-Q4 trivial-Queso"></div>
                                <div class="trivial-Q5 trivial-Queso"></div>
                                <div class="trivial-Q6 trivial-Queso"></div>
                                <div class="trivial-Puntos">0</div>
                            </div>
                            <div class="trivial-Jugador trivialj2">
                                <div class="trivial-JugadorVerde trivial-JugadoresMochila"></div>
                                <div class="trivial-Q1 trivial-Queso"></div>
                                <div class="trivial-Q2 trivial-Queso"></div>
                                <div class="trivial-Q3 trivial-Queso"></div>
                                <div class="trivial-Q4 trivial-Queso"></div>
                                <div class="trivial-Q5 trivial-Queso"></div>
                                <div class="trivial-Q6 trivial-Queso"></div>
                                <div class="trivial-Puntos">0</div>
                            </div>
                            <div class="trivial-Jugador trivialj3">
                                <div class="trivial-JugadorAmarillo trivial-JugadoresMochila"></div>
                                <div class="trivial-Q1 trivial-Queso"></div>
                                <div class="trivial-Q2 trivial-Queso"></div>
                                <div class="trivial-Q3 trivial-Queso"></div>
                                <div class="trivial-Q4 trivial-Queso"></div>
                                <div class="trivial-Q5 trivial-Queso"></div>
                                <div class="trivial-Q6 trivial-Queso"></div>
                                <div class="trivial-Puntos">0</div>
                            </div>
                        </div>
                        <div class="trivial-Materias" id="trivialMaterias-${instance}">
                            <div class="trivial-Materia">
                                <div class="trivial-M1 trivial-MateriaColor"></div>
                                <div class="trivial-MateriaNombre"></div>
                            </div>
                            <div class="trivial-Materia">
                                <div class="trivial-M2 trivial-MateriaColor"></div>
                                <div class="trivial-MateriaNombre"></div>
                            </div>
                            <div class="trivial-Materia">
                                <div class="trivial-M3 trivial-MateriaColor"></div>
                                <div class="trivial-MateriaNombre"></div>
                            </div>
                            <div class="trivial-Materia">
                                <div class="trivial-M4 trivial-MateriaColor"></div>
                                <div class="trivial-MateriaNombre"></div>
                            </div>
                            <div class="trivial-Materia">
                                <div class="trivial-M5 trivial-MateriaColor"></div>
                                <div class="trivial-MateriaNombre"></div>
                            </div>
                            <div class="trivial-Materia">
                                <div class="trivial-M6 trivial-MateriaColor"></div>
                                <div class="trivial-MateriaNombre"></div>
                            </div>
                        </div>
                    </div>
                </div>
                ${this.createInterfaceQuestion(instance)}
            </div>
            ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}

        `;
        return html;
    },

    createInterfaceQuestion: function (instance) {
        const path = $eXeTrivial.idevicePath,
            msgs = $eXeTrivial.options[instance].msgs,
            html = `
            <div class="trivial-GameQuestion" id="trivialGameQuestion-${instance}">
                <div class="trivial-TimeNumber">
                    <p id="trivialPTime-${instance}" class="trivial-PTime">
                        <strong><span class="sr-av">${msgs.msgTime}:</span></strong>00:00
                    </p>
                    <p id="trivialPNombreTema-${instance}" class="trivial-PNombreTema">
                        <strong><span class="sr-av">Tema: </span></strong>Tema
                    </p>
                </div>
                <div class="trivial-Multimedia" id="trivialMultimedia-${instance}">
                    <img class="trivial-Cursor" id="trivialCursor-${instance}" src="${path}trivialCursor.gif" alt="" />
                    <img src="" class="trivial-Image" id="trivialImagen-${instance}" alt="${msgs.msgNoImage}" />
                    <div class="trivial-EText" id="trivialEText-${instance}"></div>
                    <img src="${path}trivialHome.png" class="trivial-Cover" id="trivialCover-${instance}" alt="${msgs.msImage}" />
                    <div class="trivial-Video" id="trivialVideo-${instance}"></div>
                    <video class="trivial-Video" id="trivialVideoLocal-${instance}" preload="auto" controls></video>
                    <div class="trivial-Protector1" id="trivialProtector-${instance}"></div>
                    <a href="#" class="trivial-LinkAudio" id="trivialLinkAudio-${instance}" title="${msgs.msgAudio}">
                        <img src="${path}exequextaudio.png" class="trivial-Activo" alt="${msgs.msgAudio}">
                    </a>
                </div>
                <div class="trivial-AuthorLicence" id="trivialAutorLicence-${instance}">
                    <div class="sr-av">${msgs.msgAuthor}:</div>
                    <p id="trivialPAuthor-${instance}"></p>
                </div>
                <div class="trivial-QuestionDiv" id="trivialQuestionDiv-${instance}">
                    <div class="sr-av">${msgs.msgQuestion}:</div>
                    <div class="trivial-Question" id="trivialQuestion-${instance}"></div>
                    <div class="trivial-OptionsDiv" id="trivialOptionsDiv-${instance}">
                        <div class="sr-av">${msgs.msgOption} A:</div>
                        <a href="#" class="trivial-Option1 trivial-Options" id="trivialOption1-${instance}" data-number="0"></a>
                        <div class="sr-av">${msgs.msgOption} B:</div>
                        <a href="#" class="trivial-Option2 trivial-Options" id="trivialOption2-${instance}" data-number="1"></a>
                        <div class="sr-av">${msgs.msgOption} C:</div>
                        <a href="#" class="trivial-Option3 trivial-Options" id="trivialOption3-${instance}" data-number="2"></a>
                        <div class="sr-av">${msgs.msgOption} D:</div>
                        <a href="#" class="trivial-Option4 trivial-Options" id="trivialOption4-${instance}" data-number="3"></a>
                    </div>
                </div>
                <div class="trivial-WordsDiv" id="trivialWordDiv-${instance}">
                    <div class="sr-av">${msgs.msgAnswer}:</div>
                    <div class="trivial-Prhase" id="trivialEPhrase-${instance}"></div>
                    <div class="sr-av">${msgs.msgQuestion}:</div>
                    <div class="trivial-Definition" id="trivialDefinition-${instance}"></div>
                    <div class="trivial-DivReply" id="trivialDivResponder-${instance}">
                        <input type="text" value="" class="trivial-EdReply form-control" id="trivialEdAnswer-${instance}" autocomplete="off">
                        <a href="#" id="trivialBtnReply-${instance}" title="${msgs.msgReply}">
                            <strong><span class="sr-av">${msgs.msgReply}</span></strong>
                            <div class="exeQuextIcons-Submit trivial-Activo"></div>
                        </a>
                    </div>
                </div>
                <div class="trivial-BottonContainerDiv" id="trivialBottonContainer-${instance}">
                    <div class="trivial-AnswersDiv" id="trivialAnswerDiv-${instance}">
                        <div class="trivial-Answers" id="trivialAnswers-${instance}"></div>
                        <a href="#" id="trivialButtonAnswer-${instance}" title="${msgs.msgAnswer}">
                            <strong><span class="sr-av">${msgs.msgAnswer}</span></strong>
                            <div class="exeQuextIcons-Submit trivial-Activo"></div>
                        </a>
                    </div>
                </div>
                <div class="trivial-DivModeBoard" id="trivialDivModeBoard-${instance}">
                    <a class="trivial-ModeBoard" href="#" id="trivialModeBoardOK-${instance}" title="${msgs.msgCorrect}">${msgs.msgCorrect}</a>
                    <a class="trivial-ModeBoard" href="#" id="trivialModeBoardKO-${instance}" title="${msgs.msgIncorrect}">${msgs.msgIncorrect}</a>
                </div>
            </div>
        `;
        return html;
    },

    saveEvaluation: function (instance) {
        const mOptions = $eXeTrivial.options[instance];
        mOptions.scorerp = 10;
        let points = mOptions.gamers[0].score;
        if (mOptions.gamers[0].quesos.length < mOptions.numeroTemas) {
            score =
                (points * 10) /
                (mOptions.numeroTemas * 10 + mOptions.numeroTemas);
            score = score > 10 ? 10.0 : score;
        }
        mOptions.scorerp = score;
        if (mOptions.numeroJugadores === 1) {
            $exeDevices.iDevice.gamification.report.saveEvaluation(
                mOptions,
                $eXeTrivial.isInExe
            );
        }
    },

    sendScore: function (auto, instance) {
        let mOptions = $eXeTrivial.options[instance],
            score = 10,
            points = mOptions.gamers[0].score;

        if (mOptions.gamers[0].quesos.length < mOptions.numeroTemas) {
            score =
                (points * 10) /
                (mOptions.numeroTemas * 10 + mOptions.numeroTemas);
            score = score > 10 ? 10 : score;
        }

        mOptions.scorerp = score;
        mOptions.previousScore = $eXeTrivial.previousScore;
        mOptions.userName = $eXeTrivial.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $eXeTrivial.previousScore = mOptions.previousScore;
    },

    isVideoQuestion: function (temas) {
        for (let j = 0; j < temas.length; j++) {
            let questions = temas[j];
            for (let i = 0; i < questions.length; i++) {
                if (questions[i].type == 2) {
                    return true;
                }
            }
        }
        return false;
    },

    randomArray: function (length, max) {
        return Array.apply(null, Array(length)).map(function () {
            return Math.round(Math.random() * max) + 1;
        });
    },

    loadPlayers: function (instance) {
        const mOptions = $eXeTrivial.options[instance];
        let gamers = [],
            validNames = true;
        $('#trivialNameGamers-' + instance)
            .find('input')
            .each(function (i) {
                if (i < mOptions.numeroJugadores) {
                    let gamer = {};
                    gamer.name = $(this).val().trim();
                    gamer.score = 0;
                    gamer.casilla = mOptions.pT.length - 1;
                    gamer.number = i;
                    gamer.quesos = [];
                    gamer.cheeses = [];
                    gamers.push(gamer);
                    if (gamer.name.length == 0) {
                        $('#trivialNameGamers-' + instance)
                            .find('input')
                            .eq(i)
                            .focus();
                        validNames = false;
                        return false;
                    }
                }
            });
        if (validNames) {
            mOptions.gamers = gamers;
            $('#trivialJugadores-' + instance)
                .find('.trivial-Jugador')
                .show();
            $('#trivialJugadores-' + instance)
                .find('.trivial-Jugador')
                .each(function (i) {
                    if (i >= mOptions.numeroJugadores) {
                        $(this).hide();
                    }
                });
        }
        return validNames;
    },

    initCheeses: function (instance) {
        const mOptions = $eXeTrivial.options[instance];
        for (let j = 0; j < 4; j++) {
            $('#trivialJugadores-' + instance + ' > .trivialj' + j)
                .find('.trivial-Queso')
                .hide();
            $('#trivialJugadores-' + instance + ' > .trivialj' + j)
                .find('.trivial-Queso')
                .each(function (i) {
                    if (i < mOptions.numeroTemas) {
                        $(this)
                            .css({
                                'background-color': '#ffffff',
                            })
                            .show();
                    }
                });
        }
    },

    updateCheeses: function (instance) {
        let mOptions = $eXeTrivial.options[instance];
        for (let j = 0; j < mOptions.gamers.length; j++) {
            $('#trivialJugadores-' + instance + ' > .trivialj' + j)
                .find('.trivial-Queso')
                .hide();
            $('#trivialJugadores-' + instance + ' > .trivialj' + j)
                .find('.trivial-Queso')
                .each(function (i) {
                    if (i < mOptions.numeroTemas) {
                        $(this)
                            .css({
                                'background-color': '#ffffff',
                            })
                            .show();
                    }
                    if (mOptions.gamers[j].cheeses.indexOf(i) != -1) {
                        $(this)
                            .css({
                                'background-color': $eXeTrivial.colorQuesos[i],
                            })
                            .show();
                    }
                });
        }
    },

    rebootGame: function (instance) {
        const mOptions = $eXeTrivial.options[instance];
        localStorage.removeItem('dataTrivial-' + mOptions.trivialID);

        mOptions.contadorJuego = 0;

        $eXeTrivial.updateTimeGame(0, instance);

        $('#trivialSelectsGamers-' + instance).show();
        $('#trivialDado-' + instance).hide();

        $eXeTrivial.saveEvaluation(instance);
        $eXeTrivial.sendScore(true, instance);
        $eXeTrivial.initialScore = (
            ((mOptions.gamers[0].casilla + 1) * 10) /
            mOptions.numeroCasillas
        ).toFixed(2);
        mOptions.gameStarted = false;
        mOptions.activePlayer = 0;
        mOptions.gameOver = false;

        for (let i = 0; i < mOptions.numeroJugadores; i++) {
            mOptions.gamers[i].casilla = mOptions.pT.length - 1;
            $eXeTrivial.placePlayerToken(i, instance);
            $('#trivialJugadores-' + instance + ' > .trivialj' + i)
                .find('.trivial-Puntos')
                .text('0');
        }
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 6; j++) {
                $eXeTrivial.activeCheese(i, j, false, instance);
            }
        }
        $eXeTrivial.loadGameBoard(instance);
    },
    continueGame: function (instance) {
        const mOptions = $eXeTrivial.options[instance];
        mOptions.numeroJugadores = mOptions.gamers.length;

        $eXeTrivial.loadGameBoard(instance);
        $eXeTrivial.updateCheeses(instance);

        for (let i = 0; i < mOptions.numeroJugadores; i++) {
            $eXeTrivial.placePlayerToken(i, instance);
            $('#trivialJugadores-' + instance + ' > .trivialj' + i)
                .find('.trivial-Puntos')
                .text(mOptions.gamers[i].score);
        }

        $('#trivialJugadores-' + instance)
            .find('.trivial-Jugador')
            .show();
        $('#trivialJugadores-' + instance)
            .find('.trivial-Jugador')
            .each(function (i) {
                if (i >= mOptions.numeroJugadores) {
                    $(this).hide();
                }
            });
        $('#trivialSelectsGamers-' + instance).hide();
        $('#trivialDado-' + instance).show();
        $eXeTrivial.changePlayer(instance, true);

        mOptions.relojJuego = setInterval(function () {
            mOptions.contadorJuego++;
            $eXeTrivial.updateTimeGame(mOptions.contadorJuego, instance);
        }, 1000);
        setTimeout(function () {
            if (mOptions.numeroJugadores === 1) {
                $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                    mOptions,
                    this.isInExe
                );
            }
        }, 500);
    },

    startGame: function (instance) {
        const mOptions = $eXeTrivial.options[instance];
        $eXeTrivial.loadGameBoard(instance);
        if (mOptions.gameStarted) {
            $eXeTrivial.showGameMessage(
                mOptions.msgs.msgGameStarted,
                4000,
                4,
                instance
            );
            return;
        }

        if (!$eXeTrivial.loadPlayers(instance)) {
            $eXeTrivial.showGameMessage(
                mOptions.msgs.msgPlayersName,
                4000,
                4,
                instance
            );
            return;
        }

        $eXeTrivial.initCheeses(instance);
        $('trivialJugadores-' + instance)
            .find('.trivial-Puntos')
            .text(0);
        $('#trivialSelectsGamers-' + instance).hide();
        $('#trivialDado-' + instance).show();

        mOptions.scoreGame = 0;
        mOptions.obtainedClue = false;
        mOptions.direccion = 1;
        mOptions.contadorJuego = 0;
        mOptions.activePlayer = Math.floor(
            Math.random() * mOptions.numeroJugadores
        );
        $eXeTrivial.changePlayer(instance, false);

        mOptions.relojJuego = setInterval(function () {
            mOptions.contadorJuego++;
            $eXeTrivial.updateTimeGame(mOptions.contadorJuego, instance);
        }, 1000);

        mOptions.gameStarted = true;
        $eXeTrivial.saveDataStorage(instance);
        setTimeout(function () {
            if (mOptions.numeroJugadores === 1) {
                $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                    mOptions,
                    this.isInExe
                );
            }
        }, 500);
    },

    changePlayer: function (instance, continueg) {
        const mOptions = $eXeTrivial.options[instance];

        if (!continueg) {
            mOptions.activePlayer++;
        }

        mOptions.activePlayer =
            mOptions.activePlayer >= mOptions.numeroJugadores
                ? 0
                : mOptions.activePlayer;
        $('#trivialFondoDado-' + instance).css(
            'background-color',
            $eXeTrivial.colorsDado[mOptions.activePlayer]
        );
        $('#trivialClickDado-' + instance).show();

        $eXeTrivial.showGameMessage(
            mOptions.gamers[mOptions.activePlayer].name +
                ', ' +
                mOptions.msgs.msgsYouPlay,
            3000,
            mOptions.activePlayer,
            instance
        );

        $('#trivialTablero-' + instance)
            .find('.trivial-Ficha')
            .hide();
        $('#trivialTablero-' + instance)
            .find('.trivial-CasillaDestino')
            .hide();
        $('#trivialTablero-' + instance)
            .find('.trivial-Ficha')
            .eq(mOptions.activePlayer)
            .show();

        $eXeTrivial.placePlayerToken(mOptions.activePlayer, instance);
    },
    movePlayerToken: function (jugador, x, y, instance) {
        const mOptions = $eXeTrivial.options[instance],
            mjugador = '#trivialFicha' + jugador + '-' + instance,
            $Jugador = $(mjugador);

        $Jugador.css({
            left: x + 'px',
            top: y + 'px',
            width: mOptions.wt,
            height: mOptions.wt,
        });
    },

    placePlayerToken: function (jugador, instance) {
        const mOptions = $eXeTrivial.options[instance],
            gamer = mOptions.gamers[jugador];
        if (!gamer) return;

        const numCasilla = gamer.casilla,
            casilla = mOptions.pT[numCasilla];

        if (!casilla) return;

        const { x, y } = casilla;
        let wd = Math.max(16, Math.min(casilla.w, 42));

        $(`#trivialTablero-${instance} .trivial-Ficha`)
            .eq(jugador)
            .css({
                left: `${x}px`,
                top: `${y}px`,
                width: `${wd}px`,
                height: `${wd}px`,
            });
    },

    placeDie: function (kw, kh, instance) {
        const mOptions = $eXeTrivial.options[instance],
            positions = {
                2: { x: 200 * kw, y: 150 * kh, w: 80 * kw },
                3: { x: 550 * kw, y: 100 * kh, w: 64 * kw },
                4: { x: 330 * kw, y: 132 * kh, w: 80 * kw },
                5: { x: 430 * kw, y: 185 * kh, w: 80 * kw },
                6: { x: 333 * kw, y: 93 * kh, w: 80 * kw },
            };

        const pos = positions[mOptions.numeroTemas] || { x: 0, y: 0, w: 64 },
            h = pos.w;

        $(`#trivialDado-${instance}`).css({
            left: `${pos.x}px`,
            top: `${pos.y}px`,
            width: `${pos.w}px`,
            height: `${h}px`,
        });
    },

    questionAnswer: function (respuesta, instance) {
        const mOptions = $eXeTrivial.options[instance];

        $('#trivialGameQuestion-' + instance).hide();
        $('#trivialGameContainer-' + instance).show();

        if (!respuesta) {
            $eXeTrivial.changePlayer(instance, false);
            $eXeTrivial.activeDice(instance);
            $eXeTrivial.loadGameBoard(instance);
        } else {
            $eXeTrivial.correctAnswer(instance);
        }

        $exeDevices.iDevice.gamification.media.stopSound(mOptions);
        $eXeTrivial.saveEvaluation(instance);
        $eXeTrivial.saveDataStorage(instance);
    },

    correctAnswer: function (instance) {
        const mOptions = $eXeTrivial.options[instance];
        let ganas = false,
            puntos = mOptions.gamers[mOptions.activePlayer].score,
            quesosJugador = mOptions.gamers[mOptions.activePlayer].quesos,
            quesosJuego = mOptions.quesos,
            casilla = mOptions.gamers[mOptions.activePlayer].casilla,
            mensaje =
                mOptions.gamers[mOptions.activePlayer].name +
                ', ' +
                $eXeTrivial.getRetroFeedMessages(true, instance) +
                ' ';

        if (quesosJuego.includes(casilla)) {
            if (quesosJugador.includes(casilla)) {
                puntos++;
                mensaje += mOptions.msgs.msgRightAnswre;
            } else {
                let numqueso = mOptions.activeTema;
                quesosJugador.push(casilla);
                $eXeTrivial.activeCheese(
                    mOptions.activePlayer,
                    numqueso,
                    true,
                    instance
                );
                if (quesosJugador.length == quesosJuego.length) {
                    puntos = puntos + 100;
                    ganas = true;
                    mensaje += mOptions.msgs.msgWin;
                } else {
                    mensaje +=
                        mOptions.msgs.msgGetQueso +
                        ' ' +
                        mOptions.nombresTemas[mOptions.activeTema];
                    puntos = puntos + 10;
                }
                if (
                    !mOptions.gamers[mOptions.activePlayer].cheeses.includes(
                        mOptions.activeTema
                    )
                ) {
                    mOptions.gamers[mOptions.activePlayer].cheeses.push(
                        mOptions.activeTema
                    );
                }
            }
        } else {
            mensaje += mOptions.msgs.msgRightAnswre;
            puntos++;
        }

        mOptions.gamers[mOptions.activePlayer].quesos = quesosJugador;
        mOptions.gamers[mOptions.activePlayer].score = puntos;
        $(
            '#trivialJugadores-' +
                instance +
                ' > .trivialj' +
                mOptions.activePlayer
        )
            .find('.trivial-Puntos')
            .text(puntos);
        $('#trivialTablero-' + instance)
            .find('.trivial-CasillaDestino')
            .hide();
        $('#trivialTablero-' + instance)
            .find('.trivial-Ficha')
            .eq(mOptions.activePlayer)
            .show();
        $eXeTrivial.showGameMessage(
            mensaje,
            3000,
            mOptions.activePlayer,
            instance
        );

        if (ganas) {
            $eXeTrivial.winGame(instance);
        } else {
            setTimeout(function () {
                $eXeTrivial.changePlayer(instance, false);
                $eXeTrivial.activeDice(instance);
                $eXeTrivial.loadGameBoard(instance);
            }, 3000);
        }
        $eXeTrivial.sendScore(true, instance);
    },

    cheesePositions: function (numasi) {
        let pos = [];
        if (numasi == 2) {
            pos = [0, 12];
        } else if (numasi == 3) {
            pos = [0, 7, 14];
        } else if (numasi == 4) {
            pos = [0, 6, 12, 18];
        } else if (numasi == 5) {
            pos = [0, 6, 12, 18, 24];
        } else if (numasi == 6) {
            pos = [0, 7, 14, 21, 28, 35];
        }
        return pos;
    },

    loadGameBoard: function (instance) {
        const mOptions = $eXeTrivial.options[instance];

        mOptions.kw = $('#trivialTablero-' + instance).width() / 745;
        mOptions.kh = $('#trivialTablero-' + instance).height() / 668;

        if (mOptions.numeroTemas == 2) {
            mOptions.pT = $eXeTrivial.loadPositions2(
                mOptions.kw,
                mOptions.kh,
                instance
            );
        } else if (mOptions.numeroTemas == 3) {
            mOptions.pT = $eXeTrivial.loadPositions3(
                mOptions.kw,
                mOptions.kh,
                instance
            );
        } else if (mOptions.numeroTemas == 4) {
            mOptions.pT = $eXeTrivial.loadPositions4(
                mOptions.kw,
                mOptions.kh,
                instance
            );
        } else if (mOptions.numeroTemas == 5) {
            mOptions.pT = $eXeTrivial.loadPositions5(
                mOptions.kw,
                mOptions.kh,
                instance
            );
        } else if (mOptions.numeroTemas == 6) {
            mOptions.pT = $eXeTrivial.loadPositions6(
                mOptions.kw,
                mOptions.kh,
                instance
            );
        }

        $eXeTrivial.placeDie(mOptions.kw, mOptions.kw, instance);

        for (let i = 0; i < mOptions.numeroJugadores; i++) {
            $eXeTrivial.placePlayerToken(i, instance);
        }

        $('#trivialTablero-' + instance)
            .find('.trivial-CasillaDestino')
            .each(function (i) {
                let position = parseInt($(this).data('position')),
                    x = mOptions.pT[position].x,
                    y = mOptions.pT[position].y,
                    wd = mOptions.pT[position].w;
                if (wd < 16) {
                    wd = 16;
                }
                if (wd > 42) {
                    wd = 42;
                }
                $(this).css({
                    left: x + 'px',
                    top: y + 'px',
                    width: wd + 'px',
                    height: wd + 'px',
                    'z-index': 21,
                });
            });

        $eXeTrivial.placeElements(instance);
    },
    winGame: function (instance) {
        $eXeTrivial.gameOver(instance);
    },

    throwDice: function (instance) {
        const mOptions = $eXeTrivial.options[instance],
            numasi = mOptions.numeroTemas < 5 ? 4 : mOptions.numeroTemas,
            pos = $eXeTrivial.randomArray(15, numasi - 1),
            valor = pos[pos.length - 1];
        let image = $eXeTrivial.idevicePath + 'tvlpt' + valor + '.png',
            contador = 0;

        mOptions.valorDado = valor;
        mOptions.contadorDado = setInterval(function () {
            if (mOptions.gameStarted && contador < pos.length) {
                contador++;
                image =
                    $eXeTrivial.idevicePath + 'tvlpt' + pos[contador] + '.png';
                if (contador == pos.length - 1) {
                    clearInterval(mOptions.contadorDado);
                    $eXeTrivial.showTargetPositions(
                        mOptions.valorDado,
                        instance
                    );
                    image = $eXeTrivial.idevicePath + 'tvlpt' + valor + '.png';
                    $eXeTrivial.tirada++;
                }
                $('#trivialPuntosDado-' + instance).css({
                    background: 'url(' + image + ')',
                    'background-size': '100% 100%',
                });
            }
        }, 150);
    },

    showTargetPositions: function (vd, instance) {
        const mOptions = $eXeTrivial.options[instance],
            jugador = mOptions.gamers[mOptions.activePlayer],
            $Jugador = $(
                '#trivialFicha' + mOptions.activePlayer + '-' + instance
            ),
            posJugador = jugador.casilla,
            x = mOptions.pT[posJugador].x,
            y = mOptions.pT[posJugador].y,
            w = mOptions.pT[posJugador].w,
            h = mOptions.pT[posJugador].h;
        let sitiosActivos = [];

        if (mOptions.numeroTemas == 2) {
            sitiosActivos = $eXeTrivial.getNextPositions2(
                vd,
                posJugador,
                instance
            );
        } else if (mOptions.numeroTemas == 3) {
            sitiosActivos = $eXeTrivial.getNextPositions3(
                vd,
                posJugador,
                instance
            );
        } else if (mOptions.numeroTemas == 4) {
            sitiosActivos = $eXeTrivial.getNextPositions4(
                vd,
                posJugador,
                instance
            );
        } else if (mOptions.numeroTemas == 5) {
            sitiosActivos = $eXeTrivial.getNextPositions5(
                vd,
                posJugador,
                instance
            );
        } else if (mOptions.numeroTemas == 6) {
            sitiosActivos = $eXeTrivial.getNextPositions6(
                vd,
                posJugador,
                instance
            );
        }

        $Jugador
            .css({
                left: x + 'px',
                top: y + 'px',
                width: w,
                height: h,
                'z-index': 21,
            })
            .show();

        $eXeTrivial.showActiveButtons(sitiosActivos, instance);
    },

    showActiveButtons: function (sitiosActivos, instance) {
        const mOptions = $eXeTrivial.options[instance];
        $('#trivialTablero-' + instance)
            .find('.trivial-CasillaDestino')
            .hide();
        for (let i = 0; i < sitiosActivos.length; i++) {
            let j = sitiosActivos[i],
                wd = mOptions.pT[j].w,
                x = mOptions.pT[j].x,
                y = mOptions.pT[j].y;
            if (wd < 16) {
                wd = 16;
            }
            if (wd > 42) {
                wd = 42;
            }
            $('#trivialTablero-' + instance)
                .find('.trivial-CasillaDestino')
                .eq(i)
                .css({
                    left: x + 'px',
                    top: y + 'px',
                    width: wd + 'px',
                    height: wd + 'px',
                    'z-index': 21,
                })
                .show();
            $('#trivialTablero-' + instance)
                .find('.trivial-CasillaDestino')
                .eq(i)
                .data('position', j);
        }
    },

    activeCheese: function (activePlayer, queso, value, instance) {
        const color = value
            ? $eXeTrivial.colorQuesos[queso]
            : $eXeTrivial.colors.white;
        $('#trivialJugadores-' + instance + ' > .trivialj' + activePlayer)
            .find('.trivial-Queso')
            .eq(queso)
            .css({
                'background-color': color,
            });
    },

    activeDice: function (instance) {
        const mOptions = $eXeTrivial.options[instance];
        $('#trivialFondoDado-' + instance).css(
            'background-color',
            $eXeTrivial.colorsDado[mOptions.activePlayer]
        );
        $('#trivialClickDado-' + instance).show();
    },

    showGameQuestion: function (ntema, instance) {
        const mOptions = $eXeTrivial.options[instance],
            squestions = mOptions.temas[ntema];
        mOptions.activeCounter = true;
        mOptions.activesQuestions[ntema]++;
        mOptions.activeTema = ntema;

        if (mOptions.activesQuestions[ntema] >= squestions.length) {
            mOptions.activesQuestions[ntema] = 0;
        }

        const active = mOptions.activesQuestions[ntema];
        mOptions.counter =
            $exeDevices.iDevice.gamification.helpers.getTimeSeconds(
                squestions[active].time
            );
        if (squestions[active].type === 2) {
            const durationVideo =
                squestions[active].fVideo - squestions[active].iVideo;
            mOptions.counter += durationVideo;
        }

        $('#trivialGameContainer-' + instance).hide();
        $('#trivialGameQuestion-' + instance).show();
        $('#trivialPNombreTema-' + instance).text(
            mOptions.nombresTemas[mOptions.activeTema]
        );

        $eXeTrivial.showQuestion(ntema, active, instance);

        mOptions.counterClock = setInterval(function () {
            let $node = $('#trivialMainContainer-' + instance);
            let $content = $('#node-content');
            if (
                !$node.length ||
                ($content.length && $content.attr('mode') === 'edition')
            ) {
                clearInterval(mOptions.counterClock);
                return;
            }
            if (mOptions.activeCounter) {
                mOptions.counter--;
                $eXeTrivial.updateTime(mOptions.counter, instance);
                $eXeTrivial.updateSoundVideo(instance);
                if (mOptions.counter <= 0) {
                    mOptions.activeCounter = false;
                    if (mOptions.showSolution) {
                        if (squestions[active].typeSelect < 2) {
                            $eXeTrivial.drawSolution(instance);
                        } else {
                            $eXeTrivial.drawPhrase(
                                squestions[active].solutionQuestion,
                                squestions[active].quextion,
                                100,
                                1,
                                false,
                                instance,
                                true,
                                squestions[active].typeSelect
                            );
                        }
                    }
                    $exeDevices.iDevice.gamification.media.stopVideo(instance);
                    const ts = mOptions.showSolution
                        ? mOptions.timeShowSolution * 1000
                        : 3000;
                    clearInterval(mOptions.counterClock);
                    setTimeout(function () {
                        $eXeTrivial.questionAnswer(false, instance);
                    }, ts);
                    return;
                }
            }
        }, 1000);
    },

    showGameMessage: function (mensaje, time, type, instance) {
        const messageSelector = $(`#trivialMessage-${instance}`);
        $(`#trivialPMessage-${instance}`).text(mensaje);

        messageSelector
            .hide()
            .slideDown(100)
            .delay(time)
            .slideUp(100)
            .css('visibility', 'visible');

        const imgNames = {
            0: 'tvlfr.png',
            1: 'tvlfb.png',
            2: 'tvlfg.png',
            3: 'tvlfy.png',
            4: 'trivialIcon.png',
        };

        const imgName = imgNames[type] || 'triviallanza.png';
        const imgSrc = $eXeTrivial.idevicePath + imgName;

        messageSelector.find('img').attr('src', imgSrc);
    },

    createGameTokeTesting: function (instance) {
        const mOptions = $eXeTrivial.options[instance];

        $('#trivialTablero-' + instance)
            .find('.trivial-Testeo')
            .remove();

        for (let i = 0; i < mOptions.pT.length; i++) {
            const casilla = '<div class="trivial-Testeo">' + i + '</div>';

            $(casilla).appendTo('#trivialTablero-' + instance);
        }
        $('#trivialTablero-' + instance)
            .find('.trivial-Testeo')
            .each(function (i) {
                const x = mOptions.pT[i].x,
                    y = mOptions.pT[i].y,
                    w = mOptions.pT[i].w,
                    h = mOptions.pT[i].h;
                $(this)
                    .css({
                        left: x + 'px',
                        top: y + 'px',
                        width: w + 'px',
                        height: h + 'px',
                    })
                    .show();
            });
    },

    placePlayerTokensSkare: function (casilla, instance) {
        const mOptions = $eXeTrivial.options[instance];
        let listaOcupantes = [];

        if (mOptions.numeroJugadores == 1) return;
        for (let i = 0; i < mOptions.gamers.length; i++) {
            if (mOptions.gamers[i].casilla == casilla) {
                listaOcupantes.push(i);
            }
        }
        $eXeTrivial.setPositionPlayers(casilla, listaOcupantes, instance);
    },
    setPositionPlayers: function (casilla, listaOcupantes, instance) {
        let mOptions = $eXeTrivial.options,
            posiconesHorizontales = [
                0, 1, 2, 3, 4, 5, 6, 37, 38, 39, 40, 41, 42, 50, 51, 52, 53, 54,
                19, 20, 21, 22, 23, 24, 25, 26, 51, 62, 61, 7, 8, 43, 44, 35,
                36, 59, 60, 18,
            ],
            posiconesVerticales = [
                9, 10, 11, 12, 13, 14, 15, 16, 17, 29, 30, 31, 32, 33, 34, 35,
                45, 46, 46, 47, 48, 57, 58, 17, 49, 10, 35, 27, 28, 55, 56,
            ];
        if (posiconesVerticales.includes(casilla)) {
            for (let i = 0; i < listaOcupantes.length; i++) {
                let j = listaOcupantes[i],
                    sposicion = mOptions.gamers[j].casilla,
                    nposX = mOptions.pT[sposicion].x,
                    nposY = mOptions.pT[sposicion].y,
                    nposW = mOptions.wt,
                    nposH = mOptions.wt;
                if (i == 0) {
                    if (listaOcupantes.length > 1) {
                        nposX = nposX - nposW / 2;
                    }
                    if (listaOcupantes.length > 2) {
                        nposY = nposY - nposH / 2;
                    }
                } else if (i == 1) {
                    if (listaOcupantes.length > 2) {
                        nposY = nposY - nposH / 2;
                    }
                    nposX = nposX + nposW / 2;
                } else if (i == 2) {
                    if (listaOcupantes.length == 4) {
                        nposX = nposX - nposW / 2;
                    }
                    nposY = nposY + nposH / 2;
                } else if (i == 3) {
                    nposX = nposX + nposW / 2;
                    nposY = nposY + nposH / 2;
                }
                nposX = Math.round(nposX);
                nposY = Math.round(nposY);
                $eXeTrivial.movePlayerToken(j, nposX, nposY, instance);
            }
        } else if (posiconesHorizontales.includes(casilla)) {
            for (let i = 0; i < listaOcupantes.length; i++) {
                let j = listaOcupantes[i],
                    sposicion = mOptions.gamers[j].casilla,
                    nposX = mOptions.pT[sposicion].x,
                    nposY = mOptions.pT[sposicion].y,
                    nposW = mOptions.wt,
                    nposH = mOptions.wt;
                if (i == 0) {
                    if (listaOcupantes.length > 1) {
                        nposY = nposY + nposH / 2;
                    }
                    if (listaOcupantes.length > 2) {
                        nposX = nposX + nposW / 2;
                    }
                } else if (i == 1) {
                    if (listaOcupantes.length > 2) {
                        nposX = nposX + nposW / 2;
                    }
                    nposY = nposY - nposH / 2;
                } else if (i == 2) {
                    if (listaOcupantes.length == 4) {
                        nposY = nposY + nposH / 2;
                    }
                    nposX = nposX - nposW / 2;
                } else if (i == 3) {
                    nposX = nposX - nposW / 2;
                    nposY = nposY - nposH / 2;
                }
                $eXeTrivial.movePlayerToken(j, nposX, nposY, instance);
            }
        }
    },
    escapeParens: function (str) {
        return str
            .replace(/\\\(/g, '\\\\(')
            .replace(/\\\)/g, '\\\\)')
            .replace(/\\\]/g, '\\\\]')
            .replace(/\\\[/g, '\\\\[');
    },
    loadDataGame: function (data) {
        let json = $eXeTrivial.escapeParens(data.text());

        let mOptions = $eXeTrivial.isJsonString(json);
        mOptions = $eXeTrivial.Decrypt(mOptions);

        let myJSON = JSON.stringify(mOptions),
            youtubeRegex =
                /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
            hasvideo = youtubeRegex.test(myJSON);

        if (hasvideo) $eXeTrivial.hasVideo = true;

        mOptions.gameOver = false;
        mOptions.scoreGame = 0;
        mOptions.velocidad = 300;
        mOptions.numeroJugadores = 1;
        mOptions.activeTema = 0;
        mOptions.quesos = $eXeTrivial.cheesePositions(mOptions.numeroTemas);

        let gamers = [],
            gamer = {};

        gamer.name = '';
        gamer.score = 0;
        gamer.state = 0;
        gamer.casilla = 0;
        gamer.number = 0;
        gamer.quesos = [];
        gamers.push(gamer);

        mOptions.player = null;
        mOptions.useLiks = true;
        mOptions.gamers = gamers;
        mOptions.activeGamer = 0;
        mOptions.gameStarted = false;
        mOptions.gameActived = false;
        mOptions.activesQuestions = [];
        mOptions.scoreTotal = 0;
        mOptions.evaluation =
            typeof mOptions.evaluation == 'undefined'
                ? false
                : mOptions.evaluation;
        mOptions.evaluationID =
            typeof mOptions.evaluationID == 'undefined'
                ? ''
                : mOptions.evaluationID;
        mOptions.id = typeof mOptions.id == 'undefined' ? false : mOptions.id;
        mOptions.modeBoard =
            typeof mOptions.modeBoard == 'undefined'
                ? false
                : mOptions.modeBoard;
        return mOptions;
    },

    isJsonString: function (str) {
        try {
            var o = JSON.parse(str, null, 2);
            if (o && typeof o === 'object') {
                return o;
            }
        } catch (e) {}
        return false;
    },

    loadApiPlayer: function () {
        if (!this.hasVideo) return;

        $exeDevices.iDevice.gamification.media.YouTubeAPILoader.load()
            .then(() => this.activatePlayer())
            .catch(() => this.showStartedButton());
    },

    activatePlayer: function () {
        $eXeTrivial.options.forEach((option, i) => {
            if ($eXeTrivial.hasVideo && option.player == null) {
                option.player = new YT.Player(`trivialVideo-${i}`, {
                    width: '100%',
                    height: '100%',
                    videoId: '',
                    playerVars: {
                        color: 'white',
                        autoplay: 0,
                        controls: 0,
                    },
                    events: {
                        onReady: $eXeTrivial.onPlayerReady.bind(this),
                    },
                });
            }
        });
    },

    youTubeReady: function () {
        this.activatePlayer();
    },

    showStartedButton: function () {
        $eXeTrivial.options.forEach((option, i) => {
            if (!option.gameStarted && !option.gameOver) {
                $(`#trivialStartGame-${ì}`).show();
                $eXeTrivial.showMessage(1, '', i);
            }
        });
    },

    onPlayerReady: function (event) {
        const iframe = event.target.getIframe();
        if (iframe && iframe.id) {
            const [prefix, instanceStr] = iframe.id.split('-');
            if (prefix === 'trivialVideo') {
                const instance = parseInt(instanceStr, 10);
                if (!isNaN(instance)) {
                    if (
                        $eXeTrivial.options &&
                        $eXeTrivial.options[instance] &&
                        !$eXeTrivial.options[instance].gameStarted
                    ) {
                        $(`#trivialStartGame-${instance}`).show();
                        $eXeTrivial.showMessage(1, '', instance);
                    }
                } else {
                    console.warn(
                        `Número de instancia inválido para ${iframe.id}`
                    );
                }
            }
        } else {
            console.warn('No se pudo identificar el iframe del reproductor');
        }
    },

    Decrypt: function (game) {
        let temas = [];
        for (let z = 0; z < game.numeroTemas; z++) {
            let tema = game.temas[z],
                ntema = [];
            for (let i = 0; i < tema.length; i++) {
                const mquestion = $eXeTrivial.getDecrytepQuestion(tema[i]);
                ntema.push(mquestion);
            }
            temas.push(ntema);
        }
        game.temas = temas;
        return game;
    },

    getDecrytepQuestion: function (q) {
        const qsDecoded = unescape(window.atob(q.s)),
            lenLength = q.q.length.toString().length,
            solution = qsDecoded.slice(lenLength);
        return {
            alt: q.a,
            silentVideo: q.b,
            typeSelect: q.c,
            tSilentVideo: q.d,
            iVideo: q.f,
            percentageShow: q.g,
            author: q.h,
            imageVideo: q.i,
            soundVideo: q.j,
            time: q.m,
            numberOptions: q.n,
            options: q.o.slice(0, 4),
            type: q.p,
            quextion: q.q,
            solutionQuestion: $eXeTrivial.fixIfNeeded(
                unescape(window.atob(q.r))
            ),
            solution: solution,
            eText: q.t,
            url: q.u,
            x: q.x,
            y: q.y,
            fVideo: q.z,
            audio: q.ad,
        };
    },

    fixIfNeeded: function (str) {
        const misencodedSequences = [
            'Ã¡',
            'Ã©',
            'Ã­',
            'Ã³',
            'Ãº',
            'Ã±',
            'Ã',
            'Ã‰',
            'Ã',
            'Ã“',
            'Ãš',
            'Ã‘',
            'Ã¼',
            'Ãœ',
            'Ã§',
            'Ã‡',
            'Â¿',
            'Â¡',
            'Âº',
            'Âª',
            'Â',
        ];
        const found = misencodedSequences.some((seq) => str.includes(seq));
        if (found) {
            try {
                return decodeURIComponent(escape(str));
            } catch (e) {
                return str;
            }
        }
        return str;
    },

    updateSoundVideoLocal: function (instance) {
        const mOptions = $eXeTrivial.options[instance];
        if (
            mOptions.activeSilent &&
            mOptions.localPlayer &&
            mOptions.localPlayer.currentTime
        ) {
            const time = Math.round(mOptions.localPlayer.currentTime);
            if (time === mOptions.question.silentVideo) {
                mOptions.localPlayer.muted = true;
            } else if (time === mOptions.endSilent) {
                mOptions.localPlayer.muted = false;
            }
        }
    },

    updateTimerDisplayLocal: function (instance) {
        const mOptions = $eXeTrivial.options[instance];
        if (mOptions.localPlayer && mOptions.localPlayer.currentTime) {
            const currentTime = mOptions.localPlayer.currentTime;
            $eXeTrivial.updateSoundVideoLocal(instance);
            if (
                Math.ceil(currentTime) === mOptions.pointEnd ||
                Math.ceil(currentTime) === mOptions.durationVideo
            ) {
                mOptions.localPlayer.pause();
                mOptions.pointEnd = 100000;
            }
        }
    },

    updateTimerDisplay: function () {},
    updateProgressBar: function () {},
    onPlayerError: function (event) {},

    startVideo: function (id, start, end, instance, type) {
        const mOptions = $eXeTrivial.options[instance];
        if (type == 1) {
            if (mOptions.localPlayer) {
                mOptions.pointEnd = end;
                mOptions.localPlayer.src = id;
                mOptions.localPlayer.currentTime = parseFloat(start);
                if (typeof mOptions.localPlayer.play == 'function') {
                    mOptions.localPlayer.play();
                }
            }
            clearInterval(mOptions.timeUpdateInterval);
            mOptions.timeUpdateInterval = setInterval(function () {
                $eXeTrivial.updateTimerDisplayLocal(instance);
            }, 1000);
            return;
        }
        if (
            mOptions.player &&
            typeof mOptions.player.loadVideoById == 'function'
        ) {
            mOptions.player.loadVideoById({
                videoId: id,
                startSeconds: start,
                endSeconds: end,
            });
        }
    },

    playVideo: function (instance) {
        const mOptions = $eXeTrivial.options[instance];
        if (mOptions.player && typeof mOptions.player.playVideo == 'function') {
            mOptions.player.playVideo();
        }
    },

    stopVideo: function (instance) {
        const mOptions = $eXeTrivial.options[instance];
        if (
            mOptions.localPlayer &&
            typeof mOptions.localPlayer.pause == 'function'
        ) {
            mOptions.localPlayer.pause();
        }
        if (
            mOptions.player &&
            typeof mOptions.player.pauseVideo == 'function'
        ) {
            mOptions.player.pauseVideo();
        }
    },

    muteVideo: function (mute, instance) {
        const mOptions = $eXeTrivial.options[instance];
        if (mOptions.localPlayer) {
            if (mute) {
                mOptions.localPlayer.muted = true;
            } else {
                mOptions.localPlayer.muted = false;
            }
        }
        if (
            mOptions.player &&
            typeof mOptions.player.mute == 'function' &&
            typeof mOptions.player.unMute == 'function'
        ) {
            if (mute) {
                mOptions.player.mute();
            } else {
                mOptions.player.unMute();
            }
        }
    },

    placeElements: function (instance) {
        const anchoTablero = $('#trivialTablero-' + instance).width(),
            anchoIdevice = $('#trivialGameContainer-' + instance).width();

        if (anchoIdevice < 750) {
            $('#trivialJugadores-' + instance).css({
                'min-width': anchoIdevice + 'px',
                width: anchoIdevice + 'px',
                'justify-content': 'space-around',
                'margin-left': 'auto',
            });
            $('#trivialGameContainer-' + instance).css({
                'flex-direction': 'column',
                'align-items': 'center',
            });
            $('#trivialMaterias-' + instance).hide();
        } else {
            $('#trivialGameContainer-' + instance).css({
                'flex-direction': 'row',
                'align-items': 'flex-start',
            });
            $('#trivialJugadores-' + instance).css({
                'min-width': '15em',
                width: '15em',
                'justify-content': 'flex-start',
                'margin-left': '0em',
            });
            $('#trivialMaterias-' + instance).show();
        }

        if (screen.width >= 750) {
            if ($('#trivialGameContainer-' + instance).width() < 750) {
                $('#trivialMaterias-' + instance).hide();
                $('#trivialGameContainer-' + instance)
                    .find('div.trivial-PanelLateral')
                    .addClass('trivial-PanelLateralMin');
                $('#trivialGameContainer-' + instance)
                    .find('div.trivial-Jugador')
                    .addClass('trivial-JugadorMin');
            } else {
                $('#trivialMaterias-' + instance).show();
                $('#trivialGameContainer-' + instance)
                    .find('div.trivial-PanelLateral')
                    .removeClass('trivial-PanelLateralMin');
                $('#trivialGameContainer-' + instance)
                    .find('div.trivial-Jugador')
                    .removeClass('trivial-JugadorMin');
            }
        }

        $('.trivial-NumberGamers')
            .find('p')
            .css({
                'font-size': $eXeTrivial.getSize(1, instance),
                'line-height': $eXeTrivial.getSize(1.5, instance),
                height: $eXeTrivial.getSize(1.5, instance),
            });

        $('.trivial-NumberGamers').css({
            'padding-bottom': $eXeTrivial.getSize(1.5, instance),
            padding: $eXeTrivial.getSize(1.5, instance),
        });

        let fsize =
                parseFloat($eXeTrivial.getSize(1, instance), 10) < 0.7
                    ? '.7rem'
                    : $eXeTrivial.getSize(1, instance),
            fheight =
                parseFloat($eXeTrivial.getSize(1.6, instance), 10) < 1
                    ? '1rem'
                    : $eXeTrivial.getSize(1.6, instance),
            fradiuos = '0.25rem',
            fleft = '0.4rem',
            fpadding = '0.4rem';

        if (fsize == '.7rem') {
            fradiuos = '0.125rem';
            fleft = '0.3rem';
            fpadding = '0.3rem';
        }

        $('.trivial-NameGamer').css({
            'font-size': fsize,
            height: fheight,
            'line-height': fheight,
            'border-radius': fradiuos,
        });

        $('.trivial-NameGamer').css({
            'font-size': fsize,
            height: fheight,
            'line-height': fheight,
            'border-radius': fradiuos,
        });

        $('.trivial-StartGame').css({
            'font-size': fsize,
            padding: fpadding,
        });

        $('.trivial-FichaJugador').css({
            width: fheight,
            height: fheight,
        });

        $('.trivial-MessageImage').css({
            width: $eXeTrivial.getSize(3.5, instance),
            height: $eXeTrivial.getSize(3.5, instance),
            'margin-left': $eXeTrivial.getSize(1, instance),
        });

        $('.trivial-NumberIcon').css({
            width: fheight,
            height: fheight,
            'margin-left': fleft,
        });

        let sizeFont =
            parseFloat($eXeTrivial.getSize(1.2, instance), 10) < 0.8
                ? '.8rem'
                : $eXeTrivial.getSize(1.1, instance);
        $('.trivial-Message')
            .find('p')
            .css({
                'font-size': sizeFont,
                padding: $eXeTrivial.getSize(0.3, instance),
            });

        $('.trivial-MessageModalTexto').find('p').css({
            'font-size': sizeFont,
        });

        $('.trivial-AcceptButton').css({
            width: $eXeTrivial.getSize(1.7, instance),
            height: $eXeTrivial.getSize(1.7, instance),
        });

        $('.trivial-CancelButton').css({
            width: $eXeTrivial.getSize(1.7, instance),
            height: $eXeTrivial.getSize(1.7, instance),
        });

        $('.trivial-Tiempo').css({
            width: $eXeTrivial.getSize(4, instance),
            'padding-top': $eXeTrivial.getSize(0.2, instance),
            'padding-bottom': $eXeTrivial.getSize(0.2, instance),
            'padding-left': $eXeTrivial.getSize(0.1, instance),
            'padding-right': $eXeTrivial.getSize(0.1, instance),
            'font-size': $eXeTrivial.getSize(1.2),
        });

        $('.trivial-PTiempo').css({
            height: $eXeTrivial.getSize(1.5, instance),
            'line-height': $eXeTrivial.getSize(1.5, instance),
        });
    },

    getSize: function (size, instance) {
        let facTamano =
                $('#trivialTabllero-' + instance).width() >= 550
                    ? 1
                    : $('#trivialTablero-' + instance).width() / 550,
            fs = parseFloat(size * facTamano, 10).toFixed(2);
        return fs + 'rem';
    },

    addEvents: function (instance) {
        const mOptions = $eXeTrivial.options[instance],
            image =
                $eXeTrivial.idevicePath +
                'tvltv' +
                mOptions.numeroTemas +
                '.png';

        $('#trivialImageTablero-' + instance).prop('src', image);
        $('#trivialMessageModal-' + instance).hide();
        $('#trivialMessageModal-' + instance).css('visibility', 'visible');
        $('#trivialMessage-' + instance).hide();

        mOptions.localPlayer = document.getElementById(
            'trivialVideoLocal-' + instance
        );

        $eXeTrivial.loadGameBoard(instance);

        $('#trivialMaterias-' + instance)
            .find('.trivial-Materia')
            .each(function (i) {
                $(this).hide();
                if (i < mOptions.numeroTemas) {
                    $(this)
                        .find('.trivial-MateriaNombre')
                        .text(mOptions.nombresTemas[i]);
                    $(this).show();
                }
            });

        mOptions.respuesta = '';

        $(window).on('unload.eXeTrivial beforeunload.eXeTrivial', function () {
            $eXeTrivial.sendScore(true, instance);
            $exeDevices.iDevice.gamification.scorm.endScorm($eXeTrivial.mScorm);
        });

        $('#trivialClickDado-' + instance).on('click touchstart', function (e) {
            e.preventDefault();
            $(this).hide();
            $eXeTrivial.throwDice(instance);
        });

        $('#trivialSelectsGamers-' + instance).show();
        $('#trivialTablero-' + instance).on(
            'click touchstart',
            '.trivial-CasillaDestino ',
            function (e) {
                e.preventDefault();
                let position = parseInt($(this).data('position')),
                    tema = mOptions.pT[position].s;
                tema =
                    tema != 0
                        ? tema - 1
                        : Math.floor(Math.random() * mOptions.numeroTemas);
                mOptions.gamers[mOptions.activePlayer].casilla = position;
                $eXeTrivial.showGameQuestion(tema, instance);
                $eXeTrivial.placePlayerToken(mOptions.activePlayer, instance);
            }
        );

        $('#trivialLinkReboot-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                if (!mOptions.gameStarted && !mOptions.gameOver) return;

                $('#trivialMessage-' + instance).hide();
                $('#trivialMessageModal-' + instance).show();
                $('#trivialMessageModalTexto-' + instance).css(
                    'display',
                    'flex'
                );
                $('#trivialMessageModalTexto-' + instance).show();
                $eXeTrivial.loadGameBoard(instance);
            }
        );

        $('#trivialMessageAceptar-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                mOptions.kw = $('#trivialTablero-' + instance).width() / 745;
                mOptions.kh = $('#trivialTablero-' + instance).height() / 668;
                $eXeTrivial.rebootGame(instance);
                $('#trivialMessageModal-' + instance).hide();
            }
        );

        $('#trivialMessageCancelar-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $('#trivialMessageModal-' + instance).hide();
                $eXeTrivial.loadGameBoard(instance);
            }
        );

        $('#trivialNameGamers-' + instance)
            .find('.trivial-JugadorData')
            .hide();
        $('#trivialNameGamers-' + instance)
            .find('.trivial-JugadorData')
            .first()
            .show();
        $('#trivialNumberGamers-' + instance).on(
            'click touchstart',
            '.trivial-NumberIcon',
            function (e) {
                e.preventDefault();
                const number = $(this).data('number');
                $('#trivialNameGamers-' + instance)
                    .find('.trivial-JugadorData')
                    .hide();
                $('#trivialNameGamers-' + instance)
                    .find('.trivial-JugadorData')
                    .each(function (i) {
                        if (i < number) $(this).show();
                    });
                $('#trivialNumberGamers-' + instance)
                    .find('.trivial-NumberIcon')
                    .each(function (i) {
                        $(this)
                            .find('img')
                            .attr(
                                'src',
                                $eXeTrivial.idevicePath +
                                    'tvlcb' +
                                    (i + 1) +
                                    '.png'
                            );
                    });
                $(this)
                    .find('img')
                    .attr(
                        'src',
                        $eXeTrivial.idevicePath + 'tvlcr' + number + '.png'
                    );
                mOptions.numeroJugadores = number;
            }
        );

        $('videotrivialGamerOver-' + instance).css('display', 'flex');
        $('#trivialLinkMaximize-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $('#trivialGameContainer-' + instance).show();
                $('#trivialGameMinimize-' + instance).hide();
                $eXeTrivial.refreshGame(instance);
            }
        );

        $('#trivialLinkMinimize-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $('#trivialGameContainer-' + instance).hide();
                $('#trivialGameMinimize-' + instance)
                    .css('visibility', 'visible')
                    .show();
                return true;
            }
        );

        $('#trivialCodeAccessDiv-' + instance).hide();
        $('#trivialVideo-' + instance).hide();
        $('#trivialVideoLocal-' + instance).hide();
        $('#trivialVideoLocal-' + instance).hide();
        $('#trivialImagen-' + instance).hide();
        $('#trivialCursor-' + instance).hide();
        $('#trivialCover-' + instance).show();
        $('#trivialAnswerDiv-' + instance).hide();
        $('#trivialCodeAccessButton-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $eXeTrivial.enterCodeAccess(instance);
            }
        );
        $('#trivialCodeAccessE-' + instance).on('keydown', function (event) {
            if (event.which === 13 || event.keyCode === 13) {
                $eXeTrivial.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        $('#trivialBtnReply-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeTrivial.answerQuestion(instance);
        });

        $('#trivialEdAnswer-' + instance).on('keydown', function (event) {
            if (event.which == 13 || event.keyCode == 13) {
                $eXeTrivial.answerQuestion(instance);
                return false;
            }
            return true;
        });

        mOptions.livesLeft = mOptions.numberLives;

        $('#trivialStartGame-' + instance).text(mOptions.msgs.msgStartGame);
        $('#trivialStartGame-' + instance).on('click touchstart', function (e) {
            e.preventDefault();
            $eXeTrivial.startGame(instance);
        });

        $('#trivialOptionsDiv-' + instance)
            .find('.trivial-Options')
            .on('click', function (e) {
                e.preventDefault();
                $eXeTrivial.changeQuextion(this, instance);
            });

        $('#trivialLinkFullScreen-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                let element = document.getElementById(
                    'trivialMainContainer-' + instance
                );
                $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                    element,
                    instance
                );
                $eXeTrivial.loadGameBoard(instance);
            }
        );

        $('#trivialInstructions-' + instance).text(mOptions.instructions);
        $('#trivialBottonContainer-' + instance).addClass(
            'trivial-BottonContainerDivEnd'
        );
        if (mOptions.itinerary.showCodeAccess) {
            $('#trivialMessageModal-' + instance).show();
            $('#trivialMesajeAccesCodeE-' + instance).text(
                mOptions.itinerary.messageCodeAccess
            );
            $('#trivialCodeAccessDiv-' + instance).show();
            $('#trivialSelectsGamers-' + instance).hide();
            $('#trivialMessageModalTexto-' + instance).hide();
            $('#trivialAnswerDiv-' + instance).hide();
        }

        $('#trivialInstruction-' + instance).text(mOptions.instructions);
        $('#trivialSendScore-' + instance).attr(
            'value',
            mOptions.textButtonScorm
        );
        $('#trivialSendScore-' + instance).hide();

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        document.title = mOptions.title;

        $('meta[name=author]').attr('content', mOptions.author);
        $('#trivialButtonAnswer-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $eXeTrivial.answerQuestion(instance);
            }
        );

        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 6; j++) {
                $eXeTrivial.activeCheese(i, j, false, instance);
            }
        }

        $('#trivialStartGame-' + instance).text(mOptions.msgs.msgStartGame);
        $('#trivialCodeAccessE-' + instance).prop('readonly', false);

        $('.trivial-prueba').on('click touchstart', function (e) {
            e.preventDefault();
            let num = parseInt($(this).text()),
                valor = num < 7 ? num : 6,
                image = $eXeTrivial.idevicePath + 'tvlpt' + valor + '.png';
            $('#trivialPuntosDado-' + instance).css({
                background: 'url(' + image + ')',
                'background-size': '100% 100%',
            });
            mOptions.valorDado = num;
            $eXeTrivial.showTargetPositions(mOptions.valorDado, instance);
        });

        $('#trivialLinkAudio-' + instance).on('click', function (e) {
            e.preventDefault();
            const mq =
                mOptions.temas[mOptions.activeTema][
                    mOptions.activesQuestions[mOptions.activeTema]
                ];
            const audio = mq.audio;
            $exeDevices.iDevice.gamification.media.stopSound(mOptions);
            $exeDevices.iDevice.gamification.media.playSound(audio, mOptions);
        });

        if (typeof mOptions.trivialID != 'undefined') {
            const dataTrivial = $eXeTrivial.getDataStorage(mOptions.trivialID);
            if (dataTrivial) {
                if (dataTrivial) {
                    if (
                        dataTrivial.activesQuestions.length ==
                        mOptions.numeroTemas
                    ) {
                        $eXeTrivial.reloadGame(dataTrivial, instance);
                    } else {
                        $eXeTrivial.rebootGame(instance);
                    }
                }
            }
        }

        $('#trivialModeBoardOK-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeTrivial.answerQuestionBoard(true, instance);
        });

        $('#trivialModeBoardKO-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeTrivial.answerQuestionBoard(false, instance);
        });

        if (mOptions.hasVideo && !mOptions.gameStarted) {
            $(`#trivialStartGame-${instance}`).hide();
            $eXeTrivial.showMessage(0, 'Cargando. Por favor, espere', instance);
        }
    },

    getDataStorage: function (id) {
        return $exeDevices.iDevice.gamification.helpers.isJsonString(
            localStorage.getItem('dataTrivial-' + id)
        );
    },

    changeQuextion: function (button, instance) {
        const mOptions = $eXeTrivial.options[instance];
        let numberButton = parseInt($(button).data('number')),
            letters = 'ABCD',
            letter = letters[numberButton],
            type = false;

        if (mOptions.respuesta.indexOf(letter) === -1) {
            mOptions.respuesta = mOptions.respuesta + letter;
            type = true;
        } else {
            mOptions.respuesta = mOptions.respuesta.replace(letter, '');
        }

        let colors = [
                $eXeTrivial.colors.red,
                $eXeTrivial.colors.blue,
                $eXeTrivial.colors.green,
                $eXeTrivial.colors.yellow,
            ],
            bordeColors = [
                $eXeTrivial.borderColors.red,
                $eXeTrivial.borderColors.blue,
                $eXeTrivial.borderColors.green,
                $eXeTrivial.borderColors.yellow,
            ],
            css = {
                'border-size': 2,
                'border-color': bordeColors[numberButton],
                'background-color': colors[numberButton],
                cursor: 'default',
                color: $eXeTrivial.colors.black,
            };

        if (type) {
            css = {
                'border-size': 2,
                'border-color': $eXeTrivial.colors.black,
                'background-color': bordeColors[numberButton],
                cursor: 'point',
                color: '#ffffff',
            };
        }

        $(button).css(css);
        $('#trivialAnswers-' + instance + ' .trivial-AnswersOptions').remove();

        for (let i = 0; i < mOptions.respuesta.length; i++) {
            if (mOptions.respuesta[i] === 'A') {
                $('#trivialAnswers-' + instance).append(
                    '<div class="trivial-AnswersOptions trivial-Answer1"></div>'
                );
            } else if (mOptions.respuesta[i] === 'B') {
                $('#trivialAnswers-' + instance).append(
                    '<div class="trivial-AnswersOptions trivial-Answer2"></div>'
                );
            } else if (mOptions.respuesta[i] === 'C') {
                $('#trivialAnswers-' + instance).append(
                    '<div class="trivial-AnswersOptions trivial-Answer3"></div>'
                );
            } else if (mOptions.respuesta[i] === 'D') {
                $('#trivialAnswers-' + instance).append(
                    '<div class="trivial-AnswersOptions trivial-Answer4"></div>'
                );
            }
        }

        $('#trivialNameGamers-' + instance)
            .find('input')
            .eq(0)
            .focus();
        $(window).on('unload.eXeTrivial beforeunload.eXeTrivial', function () {
            if (mOptions.gameStarted || mOptions.gameOver) {
                $eXeTrivial.saveDataStorage(instance);
            }
        });
    },

    positionPointer: function (instance) {
        let mOptions = $eXeTrivial.options[instance],
            mQuextion =
                mOptions.temas[mOptions.activeTema][
                    mOptions.activesQuestions[mOptions.activeTema]
                ],
            x = parseFloat(mQuextion.x) || 0,
            y = parseFloat(mQuextion.y) || 0,
            $cursor = $('#trivialCursor-' + instance);

        if (!$cursor.left) return;

        $cursor.hide();
        if (x > 0 || y > 0) {
            let containerElement = document.getElementById(
                'trivialMultimedia-' + instance
            );
            if (!containerElement) return;
            let containerPos = containerElement.getBoundingClientRect(),
                imgElement = document.getElementById(
                    'trivialImagen-' + instance
                );
            if (!imgElement) return;

            let imgPos = imgElement.getBoundingClientRect(),
                marginTop = imgPos.top - containerPos.top,
                marginLeft = imgPos.left - containerPos.left,
                x = marginLeft + x * imgPos.width,
                y = marginTop + y * imgPos.height;
            $cursor.show();
            $cursor.css({ left: x, top: y, 'z-index': 30 });
        }
    },

    showImage: function (url, instance) {
        const mOptions = $eXeTrivial.options[instance],
            mQuextion =
                mOptions.temas[mOptions.activeTema][
                    mOptions.activesQuestions[mOptions.activeTema]
                ],
            $cursor = $('#trivialCursor-' + instance),
            $noImage = $('#trivialCover-' + instance),
            $Image = $('#trivialImagen-' + instance),
            $Author = $('#trivialAuthor-' + instance),
            $Protect = $('#trivialProtector-' + instance);

        $Image.attr('alt', 'No image');
        $cursor.hide();
        $Image.hide();
        $noImage.hide();
        $Protect.hide();

        if ($.trim(url).length == 0) {
            $cursor.hide();
            $Image.hide();
            $noImage.show();
            $Author.text('');
            return false;
        }

        $Image.attr('src', '');
        $Image
            .attr('src', url)
            .on('load', function () {
                if (
                    !this.complete ||
                    typeof this.naturalWidth == 'undefined' ||
                    this.naturalWidth == 0
                ) {
                    $cursor.hide();
                    $Image.hide();
                    $noImage.show();
                    $Author.text('');
                } else {
                    $Image.show();
                    $cursor.show();
                    $noImage.hide();
                    $Author.text(mQuextion.author);
                    $Image.attr('alt', mQuextion.alt);
                    $eXeTrivial.positionPointer(instance);
                }
            })
            .on('error', function () {
                $cursor.hide();
                $Image.hide();
                $noImage.show();
                $Author.text('');
                return false;
            });

        $eXeTrivial.showMessage(0, mQuextion.author, instance);
    },
    refreshGame: function (instance) {
        const mOptions = $eXeTrivial.options[instance];
        if (!mOptions) return;
        $eXeTrivial.refreshImageActive(instance);
        $eXeTrivial.loadGameBoard(instance);
    },

    refreshImageActive: function (instance) {
        const mOptions = $eXeTrivial.options[instance];
        if (!mOptions) return;

        const mQuextion =
                mOptions.temas[mOptions.activeTema][
                    mOptions.activesQuestions[mOptions.activeTema]
                ],
            imgElement = $('img#trivialImagen-' + instance)[0];

        if (typeof mQuextion == 'undefined' || !imgElement) return;

        if (mQuextion.type === 1) {
            if (mQuextion.url && mQuextion.url.length > 3) {
                if (
                    !imgElement.complete &&
                    (!imgElement.src || imgElement.src === '')
                ) {
                    $eXeTrivial.showImage(mQuextion.url, instance);
                } else {
                    $('#trivialCursor-' + instance).hide();
                    setTimeout(function () {
                        $eXeTrivial.positionPointer(instance);
                    }, 1000);
                }
            }
        }
    },

    enterCodeAccess: function (instance) {
        const mOptions = $eXeTrivial.options[instance];
        if (
            mOptions.itinerary.codeAccess.toLowerCase() ===
            $('#trivialCodeAccessE-' + instance)
                .val()
                .toLowerCase()
        ) {
            $('#trivialSelectsGamers-' + instance).show();
            $('#trivialMessageModal-' + instance).hide();
            $('#trivialCodeAccessDiv-' + instance).hide();
            $('#trivialAnswerDiv-' + instance).show();
            $eXeTrivial.loadGameBoard(instance);
        } else {
            $('#trivialMesajeAccesCodeE-' + instance)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $('#trivialCodeAccessE-' + instance).val('');
        }
    },

    updateSoundVideo: function (instance) {
        const mOptions = $eXeTrivial.options[instance];
        if (mOptions.activeSilent) {
            if (
                mOptions.player &&
                typeof mOptions.player.getCurrentTime === 'function'
            ) {
                const time = Math.round(mOptions.player.getCurrentTime());
                if (time == mOptions.question.silentVideo) {
                    mOptions.player.mute();
                } else if (time == mOptions.endSilent) {
                    mOptions.player.unMute();
                }
            }
        }
    },

    updateTime: function (tiempo, instance) {
        const mTime =
            $exeDevices.iDevice.gamification.helpers.getTimeToString(tiempo);
        $('#trivialPTime-' + instance).text(mTime);
    },

    updateTimeGame: function (time, instance) {
        const mTime =
            $exeDevices.iDevice.gamification.helpers.getTimeToString(time);
        $('#trivialTiempo-' + instance).text(mTime);
    },

    gameOver: function (instance) {
        const mOptions = $eXeTrivial.options[instance];

        mOptions.gameStarted = false;
        mOptions.gameActived = false;

        clearInterval(mOptions.relojJuego);

        $('#trivialVideo-' + instance).hide();
        $('#trivialVideoLocal-' + instance).hide();

        $eXeTrivial.startVideo('', 0, 0, instance);
        $exeDevices.iDevice.gamification.media.stopVideo(instance);
        $exeDevices.iDevice.gamification.media.stopSound(mOptions);

        $('#trivialDivModeBoard-' + instance).hide();
        $('#trivialImagen-' + instance).hide();
        $('#trivialEText-' + instance).hide();
        $('#trivialCursor-' + instance).hide();
        $('#trivialCover-' + instance).hide();

        $eXeTrivial.clearQuestions(instance);
        $eXeTrivial.updateTime(0, instance);

        $('#trivialStartGame-' + instance).text(mOptions.msgs.msgNewGame);
        $('#trivialAnswerDiv-' + instance).hide();
        $('#trivialWordDiv-' + instance).hide();

        mOptions.gameOver = true;

        $('#trivialMessage-' + instance).hide();
        $('#trivialMessageModal-' + instance).show();
        $('#trivialMessageModalTexto-' + instance).css('display', 'flex');
        $('#trivialMessageModalTexto-' + instance).show();

        let winner = mOptions.msgs.msgsWinner.replace(
            '%1',
            mOptions.gamers[mOptions.activePlayer].name
        );

        $('#trivialPMessageModal-' + instance).text(winner);
        $('#trivialDado-' + instance).hide();

        if (mOptions.itinerary.showClue) {
            $eXeTrivial.showGameMessage(
                mOptions.msgs.msgInformation +
                    ': ' +
                    mOptions.itinerary.clueGame,
                10000,
                4,
                instance
            );
        } else {
            const mesaje_victoria = ', ' + mOptions.msgs.msgWinGame;
            $eXeTrivial.showGameMessage(
                mOptions.gamers[mOptions.activePlayer].name + mesaje_victoria,
                10000,
                4,
                instance
            );
        }

        $('#trivialLinkAudio-' + instance).hide();
        $eXeTrivial.sendScore(true, instance);
        $eXeTrivial.saveEvaluation(instance);
        $eXeTrivial.initialScore = (
            ((mOptions.gamers[0].casilla + 1) * 10) /
            mOptions.numeroCasillas
        ).toFixed(2);
        $eXeTrivial.saveDataStorage(instance);
    },

    drawPhrase: function (
        phrase,
        definition,
        nivel,
        type,
        casesensitive,
        instance,
        solution,
        open
    ) {
        const mOptions = $eXeTrivial.options[instance];

        $('#trivialEPhrase-' + instance)
            .find('.trivial-Word')
            .remove();
        $('#trivialBtnReply-' + instance).prop('disabled', true);
        $('#trivialBtnMoveOn-' + instance).prop('disabled', true);
        $('#trivialEdAnswer-' + instance).prop('disabled', true);
        $('#trivialQuestionDiv-' + instance).hide();
        $('#trivialWordDiv-' + instance).show();
        $('#trivialEPhrase-' + instance).show();
        $('#trivialDivResponder-' + instance).show();
        $('#trivialAnswerDiv-' + instance).hide();
        $('#trivialDivModeBoard-' + instance).hide();

        if (mOptions.modeBoard) {
            $('#trivialDivModeBoard-' + instance).css('display', 'flex');
            $('#trivialDivModeBoard-' + instance).fadeIn();
        }

        if (!casesensitive) {
            phrase = phrase.toUpperCase();
        }

        let cPhrase = $eXeTrivial.clear(phrase),
            letterShow = $eXeTrivial.getShowLetter(cPhrase, nivel),
            h = cPhrase.replace(/\s/g, '&'),
            nPhrase = [];
        for (let z = 0; z < h.length; z++) {
            if (h[z] != '&' && letterShow.indexOf(z) == -1) {
                nPhrase.push(' ');
            } else {
                nPhrase.push(h[z]);
            }
        }

        nPhrase = nPhrase.join('');
        let phrase_array = nPhrase.split('&');
        for (let i = 0; i < phrase_array.length; i++) {
            let cleanWord = phrase_array[i];
            if (cleanWord != '') {
                $('<div class="trivial-Word"></div>').appendTo(
                    '#trivialEPhrase-' + instance
                );
                for (let j = 0; j < cleanWord.length; j++) {
                    let letter =
                        '<div class="trivial-Letter blue">' +
                        cleanWord[j] +
                        '</div>';
                    if (type == 1) {
                        letter =
                            '<div class="trivial-Letter red">' +
                            cleanWord[j] +
                            '</div>';
                    } else if (type == 2) {
                        letter =
                            '<div class="trivial-Letter green">' +
                            cleanWord[j] +
                            '</div>';
                    }
                    $('#trivialEPhrase-' + instance)
                        .find('.trivial-Word')
                        .last()
                        .append(letter);
                }
            }
        }

        if (!solution) {
            $('#trivialDefinition-' + instance).html(definition);
        }
        const html = $('#trivialWordDiv-' + instance).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);

        if (latex)
            $exeDevices.iDevice.gamification.math.updateLatex(
                '.trivial-IDevice'
            );
        return cPhrase;
    },

    clear: function (phrase) {
        return phrase.replace(/[&\s\n\r]+/g, ' ').trim();
    },

    getShowLetter: function (phrase, nivel) {
        let numberLetter = parseInt((phrase.length * nivel) / 100);
        let arrayRandom = [];
        while (arrayRandom.length < numberLetter) {
            let numberRandow = parseInt(Math.random() * phrase.length);
            if (arrayRandom.indexOf(numberRandow) != -1) {
                continue;
            } else {
                arrayRandom.push(numberRandow);
            }
        }
        return arrayRandom.sort();
    },

    drawText: function (texto, color) {},

    showQuestion: function (ntema, i, instance) {
        const mOptions = $eXeTrivial.options[instance],
            mQuextion = mOptions.temas[ntema][i],
            q = mQuextion;

        $eXeTrivial.clearQuestions(instance);

        mOptions.question = mQuextion;
        mOptions.respuesta = '';

        let tiempo = $exeDevices.iDevice.gamification.helpers.getTimeToString(
                $exeDevices.iDevice.gamification.helpers.getTimeSeconds(
                    mQuextion.time
                )
            ),
            author = '',
            alt = '';

        $('#trivialDivModeBoard-' + instance).hide();
        $('#trivialPTime-' + instance).text(tiempo);
        $('#trivialQuestion-' + instance).html(mQuextion.quextion);
        $('#trivialImagen-' + instance).hide();
        $('#trivialCover-' + instance).show();
        $('#trivialEText-' + instance).hide();
        $('#trivialVideo-' + instance).hide();
        $('#trivialVideoLocal-' + instance).hide();
        $('#trivialLinkAudio-' + instance).hide();

        $eXeTrivial.startVideo('', 0, 0, instance);
        $exeDevices.iDevice.gamification.media.stopVideo(instance);

        $('#trivialCursor-' + instance).hide();

        $eXeTrivial.showMessage(0, '', instance);
        $eXeTrivial.ramdonOptions(instance);

        mOptions.activeSilent =
            q.type == 2 &&
            q.soundVideo == 1 &&
            q.tSilentVideo > 0 &&
            q.silentVideo >= q.iVideo &&
            q.iVideo < q.fVideo;
        let endSonido = parseInt(q.silentVideo) + parseInt(q.tSilentVideo);

        mOptions.endSilent = endSonido > q.fVideo ? q.fVideo : endSonido;

        let url = $exeDevices.iDevice.gamification.media.extractURLGD(
            mQuextion.url
        );

        $('#trivialAuthor-' + instance).text('');

        if (mQuextion.type === 1) {
            $('#trivialImagen-' + instance)
                .attr('src', url)
                .on('load', function () {
                    if (
                        !this.complete ||
                        typeof this.naturalWidth == 'undefined' ||
                        this.naturalWidth === 0
                    ) {
                        alt = mOptions.msgNoImage;
                        $('#trivialAuthor-' + instance).text('');
                    } else {
                        $('#trivialImagen-' + instance).show();
                        $('#trivialCover-' + instance).hide();
                        $('#trivialCursor-' + instance).hide();
                        $eXeTrivial.positionPointer(instance);
                    }
                    $eXeTrivial.showMessage(0, author, instance);
                });
            $('#trivialImagen-' + instance).prop('alt', alt);
        } else if (mQuextion.type === 3) {
            let text = mQuextion.eText;
            $('#trivialEText-' + instance).html(text);
            $('#trivialCover-' + instance).hide();
            $('#trivialEText-' + instance).show();

            $eXeTrivial.showMessage(0, '', instance);
        } else if (mQuextion.type === 2) {
            let idVideo = $exeDevices.iDevice.gamification.media.getIDYoutube(
                    mQuextion.url
                ),
                urllv =
                    $exeDevices.iDevice.gamification.media.getURLVideoMediaTeca(
                        mQuextion.url
                    ),
                type = urllv ? 1 : 0,
                id = type == 0 ? idVideo : urllv;
            $eXeTrivial.startVideo(
                id,
                mQuextion.iVideo,
                mQuextion.fVideo,
                instance,
                type
            );
            $eXeTrivial.showMessage(0, '', instance);
            $('#trivialVideoLocal-' + instance).hide();
            $('#trivialVideo-' + instance).hide();
            $('#trivialCover-' + instance).hide();
            if (mQuextion.imageVideo === 0) {
                $('#trivialCover-' + instance).show();
            } else {
                if (type == 1) {
                    $('#trivialVideoLocal-' + instance).show();
                } else {
                    $('#trivialVideo-' + instance).show();
                }
            }
            if (mQuextion.soundVideo === 0) {
                $exeDevices.iDevice.gamification.media.muteVideo(
                    true,
                    instance
                );
            } else {
                $exeDevices.iDevice.gamification.media.muteVideo(
                    false,
                    instance
                );
            }
        }

        if (mQuextion.typeSelect < 2) {
            $eXeTrivial.drawQuestions(instance);
        } else {
            $eXeTrivial.drawPhrase(
                mQuextion.solutionQuestion,
                mQuextion.quextion,
                mQuextion.percentageShow,
                0,
                false,
                instance,
                false,
                mQuextion.typeSelect
            );
            $('#trivialBtnReply-' + instance).prop('disabled', false);
            $('#trivialBtnMoveOn-' + instance).prop('disabled', false);
            $('#trivialEdAnswer-' + instance).prop('disabled', false);
            $('#trivialEdAnswer-' + instance).focus();
            $('#trivialEdAnswer-' + instance).val('');
            if (mQuextion.typeSelect == 3) {
                $('#trivialDivModeBoard-' + instance).css('display', 'flex');
                $('#trivialDivResponder-' + instance).hide();
                $('#trivialEPhrase-' + instance).hide();
            }
        }

        if (q.audio.length > 4 && q.type != 2) {
            $('#trivialLinkAudio-' + instance).show();
        }

        $exeDevices.iDevice.gamification.media.stopSound(mOptions);
        if (q.type != 2 && q.audio.trim().length > 5) {
            $exeDevices.iDevice.gamification.media.playSound(
                q.audio.trim(),
                mOptions
            );
        }
        $('#trivialEdAnswer-' + instance).focus();
    },

    getRetroFeedMessages: function (iHit, instance) {
        const msgs = $eXeTrivial.options[instance].msgs;
        let sMessages = iHit ? msgs.msgSuccesses : msgs.msgFailures;
        sMessages = sMessages.split('|');
        return sMessages[Math.floor(Math.random() * sMessages.length)];
    },

    answerQuestion: function (instance) {
        const mOptions = $eXeTrivial.options[instance],
            active = mOptions.activesQuestions[mOptions.activeTema],
            quextion = mOptions.temas[mOptions.activeTema][active];

        let message = '',
            solution = quextion.solution,
            answer = mOptions.respuesta.toUpperCase(),
            correct = true,
            type = 1;

        if (mOptions.activeCounter == false) return;
        if (quextion.typeSelect === 2) {
            solution = $.trim(quextion.solutionQuestion.toUpperCase()).replace(
                /\s+/g,
                ' '
            );
            answer = $.trim($('#trivialEdAnswer-' + instance).val())
                .toUpperCase()
                .replace(/\s+/g, ' ');
            correct = solution == answer;
            if (answer.length == 0) {
                $eXeTrivial.showMessage(
                    1,
                    mOptions.msgs.msgIndicateWord,
                    instance
                );
                return;
            }
        } else if (quextion.typeSelect === 1) {
            if (answer.length !== solution.length) {
                $eXeTrivial.showMessage(1, mOptions.msgs.mgsOrders, instance);
                mOptions.gameActived = true;
                return;
            }
            if (solution !== answer) {
                correct = false;
            }
        } else {
            if (answer.length !== solution.length) {
                correct = false;
            } else {
                for (let i = 0; i < answer.length; i++) {
                    let letter = answer[i];
                    if (solution.indexOf(letter) === -1) {
                        correct = false;
                        break;
                    }
                }
            }
        }
        mOptions.activeCounter = false;
        if (correct) {
            message = $eXeTrivial.getRetroFeedMessages(true, instance);
            type = 2;
        } else {
            message = $eXeTrivial.getRetroFeedMessages(false, instance);
        }

        if (mOptions.showSolution) {
            if (quextion.typeSelect < 2) {
                $eXeTrivial.drawSolution(instance);
            } else {
                $eXeTrivial.drawPhrase(
                    quextion.solutionQuestion,
                    quextion.quextion,
                    100,
                    type,
                    false,
                    instance,
                    true,
                    quextion.typeSelect
                );
            }
        }

        $exeDevices.iDevice.gamification.media.stopVideo(instance);
        $eXeTrivial.showMessage(type, message, instance);

        clearInterval(mOptions.counterClock);
        const ts = mOptions.showSolution
            ? mOptions.timeShowSolution * 1000
            : 3000;
        setTimeout(function () {
            $eXeTrivial.questionAnswer(correct, instance);
        }, ts);
        $eXeTrivial.saveDataStorage(instance);
    },

    answerQuestionBoard: function (value, instance) {
        const mOptions = $eXeTrivial.options[instance],
            active = mOptions.activesQuestions[mOptions.activeTema],
            quextion = mOptions.temas[mOptions.activeTema][active];
        let message = '',
            type = 1;

        if (mOptions.activeCounter == false) return;

        mOptions.activeCounter = false;

        if (value) {
            message = $eXeTrivial.getRetroFeedMessages(true, instance);
            type = 2;
        } else {
            message = $eXeTrivial.getRetroFeedMessages(false, instance);
        }

        if (mOptions.showSolution && quextion.typeSelect !== 3) {
            if (quextion.typeSelect < 2) {
                $eXeTrivial.drawSolution(instance);
            } else {
                $eXeTrivial.drawPhrase(
                    quextion.solutionQuestion,
                    quextion.quextion,
                    100,
                    type,
                    false,
                    instance,
                    true,
                    quextion.typeSelect
                );
            }
        }

        $exeDevices.iDevice.gamification.media.stopVideo(instance);
        $eXeTrivial.showMessage(type, message, instance);
        clearInterval(mOptions.counterClock);

        const ts = mOptions.showSolution
            ? mOptions.timeShowSolution * 1000
            : 3000;
        setTimeout(function () {
            $eXeTrivial.questionAnswer(value, instance);
        }, ts);
        $eXeTrivial.saveDataStorage(instance);
    },

    showMessage: function (type, message, instance) {
        const colors = [
                '#555555',
                $eXeTrivial.borderColors.red,
                $eXeTrivial.borderColors.green,
                $eXeTrivial.borderColors.blue,
                $eXeTrivial.borderColors.yellow,
            ],
            color = colors[type],
            weight = type == 0 ? 'normal' : 'normal';
        $('#trivialPAuthor-' + instance).text(message);
        $('#trivialPAuthor-' + instance).css({
            color: color,
            'font-weight': weight,
        });
        $('#trivialAutorLicence-' + instance).show();
    },

    ramdonOptions: function (instance) {
        let mOptions = $eXeTrivial.options[instance],
            l = 0,
            letras = 'ABCD';

        if (mOptions.question.typeSelect == 1) return;

        let soluciones = mOptions.question.solution;
        for (let j = 0; j < mOptions.question.options.length; j++) {
            if (!(mOptions.question.options[j].trim() == '')) {
                l++;
            }
        }

        let respuestas = mOptions.question.options,
            respuestasNuevas = [],
            correctAnswers = [];
        for (let i = 0; i < soluciones.length; i++) {
            let sol = soluciones.charCodeAt(i) - 65;
            correctAnswers.push(respuestas[sol]);
        }

        respuestasNuevas = mOptions.question.options.slice(0, l);
        respuestasNuevas =
            $exeDevices.iDevice.gamification.helpers.shuffleAds(
                respuestasNuevas
            );
        let solucionesNuevas = '';
        for (let j = 0; j < respuestasNuevas.length; j++) {
            for (let z = 0; z < correctAnswers.length; z++) {
                if (respuestasNuevas[j] == correctAnswers[z]) {
                    solucionesNuevas = solucionesNuevas.concat(letras[j]);
                    break;
                }
            }
        }

        mOptions.question.options = [];
        for (let i = 0; i < 4; i++) {
            if (i < respuestasNuevas.length) {
                mOptions.question.options.push(respuestasNuevas[i]);
            } else {
                mOptions.question.options.push('');
            }
        }
        mOptions.question.solution = solucionesNuevas;
    },

    drawQuestions: function (instance) {
        const mOptions = $eXeTrivial.options[instance],
            bordeColors = [
                $eXeTrivial.borderColors.red,
                $eXeTrivial.borderColors.blue,
                $eXeTrivial.borderColors.green,
                $eXeTrivial.borderColors.yellow,
            ];

        $('#trivialQuestionDiv-' + instance).show();
        $('#trivialWordDiv-' + instance).hide();
        $('#trivialAnswerDiv-' + instance).show();
        $('#trivialOptionsDiv-' + instance)
            .find('.trivial-Options')
            .each(function (index) {
                const option = mOptions.question.options[index];
                $(this)
                    .css({
                        'border-color': bordeColors[index],
                        'background-color': 'transparent',
                        cursor: 'pointer',
                        color: $eXeTrivial.colors.black,
                    })
                    .html(option);
                if (option) {
                    $(this).show();
                } else {
                    $(this).hide();
                }
            });

        const html = $('#trivialQuestionDiv-' + instance).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);
        if (latex)
            $exeDevices.iDevice.gamification.math.updateLatex(
                '.trivial-IDevice'
            );
    },

    drawSolution: function (instance) {
        const mOptions = $eXeTrivial.options[instance],
            active = mOptions.activesQuestions[mOptions.activeTema],
            mQuextion = mOptions.temas[mOptions.activeTema][active],
            solution = mQuextion.solution,
            letters = 'ABCD';

        mOptions.gameActived = false;
        $('#trivialOptionsDiv-' + instance)
            .find('.trivial-Options')
            .each(function (i) {
                let css = {};
                if (mQuextion.typeSelect === 1) {
                    css = {
                        'border-color': $eXeTrivial.borderColors.correct,
                        'background-color': $eXeTrivial.colors.correct,
                        'border-size': '1',
                        cursor: 'pointer',
                        color: $eXeTrivial.borderColors.black,
                    };
                    let text = '';
                    if (solution[i] === 'A') {
                        text = mQuextion.options[0];
                    } else if (solution[i] === 'B') {
                        text = mQuextion.options[1];
                    } else if (solution[i] === 'C') {
                        text = mQuextion.options[2];
                    } else if (solution[i] === 'D') {
                        text = mQuextion.options[3];
                    }
                    $(this).text(text);
                } else {
                    css = {
                        'border-color': $eXeTrivial.borderColors.incorrect,
                        'border-size': '1',
                        'background-color': 'transparent',
                        cursor: 'pointer',
                        color: $eXeTrivial.borderColors.grey,
                    };
                    if (solution.indexOf(letters[i]) !== -1) {
                        css = {
                            'border-color': $eXeTrivial.borderColors.correct,
                            'background-color': $eXeTrivial.colors.correct,
                            'border-size': '1',
                            cursor: 'pointer',
                            color: $eXeTrivial.borderColors.black,
                        };
                    }
                }
                $(this).css(css);
            });
    },

    clearQuestions: function (instance) {
        const mOptions = $eXeTrivial.options[instance];
        mOptions.respuesta = '';

        $('#trivialAnswers-' + instance + '> .trivial-AnswersOptions').remove();
        const bordeColors = [
            $eXeTrivial.borderColors.red,
            $eXeTrivial.borderColors.blue,
            $eXeTrivial.borderColors.green,
            $eXeTrivial.borderColors.yellow,
        ];

        $('#trivialOptionsDiv-' + instance)
            .find('.trivial-Options')
            .each(function (index) {
                $(this)
                    .css({
                        'border-color': bordeColors[index],
                        'background-color': 'transparent',
                        cursor: 'pointer',
                    })
                    .text('');
            });
    },

    loadPositions2: function (kw, kh, instance) {
        const mOptions = $eXeTrivial.options[instance];

        let pT = [];
        mOptions.wt = Math.round(64 * kw);
        mOptions.ht = Math.round(64 * kw);
        for (let i = 0; i < 31; i++) {
            let posicion = new Object();
            pT.push(posicion);
            pT[i].x = 0;
            pT[i].y = 0;
            pT[i].w = mOptions.wt;
            pT[i].h = mOptions.ht;
            pT[i].s = 1;
            pT[i].p = 1;
        }
        pT[0].s = 1;
        pT[0].p = 0;
        pT[1].s = 2;
        pT[1].p = 1;
        pT[2].s = 0;
        pT[2].p = 2;
        pT[3].s = 1;
        pT[3].p = 3;
        pT[4].s = 0;
        pT[4].p = 4;
        pT[5].s = 2;
        pT[5].p = 5;
        pT[6].s = 0;
        pT[6].p = 6;
        pT[7].s = 1;
        pT[7].p = 7;
        pT[8].s = 0;
        pT[8].p = 8;
        pT[9].s = 2;
        pT[9].p = 9;
        pT[10].s = 0;
        pT[10].p = 10;
        pT[11].s = 1;
        pT[11].p = 11;
        pT[12].s = 2;
        pT[12].p = 12;
        pT[13].s = 1;
        pT[13].p = 13;
        pT[14].s = 0;
        pT[14].p = 14;
        pT[15].s = 2;
        pT[15].p = 15;
        pT[16].s = 0;
        pT[16].p = 16;
        pT[17].s = 1;
        pT[17].p = 17;
        pT[18].s = 0;
        pT[18].p = 18;
        pT[19].s = 2;
        pT[19].p = 19;
        pT[20].s = 0;
        pT[20].p = 20;
        pT[21].s = 1;
        pT[21].p = 21;
        pT[22].s = 0;
        pT[22].p = 22;
        pT[23].s = 2;
        pT[23].p = 23;
        pT[24].s = 0;
        pT[24].p = 24;
        pT[25].s = 2;
        pT[25].p = 25;
        pT[26].s = 1;
        pT[26].p = 26;
        pT[27].s = 0;
        pT[27].p = 27;
        pT[28].s = 1;
        pT[28].p = 28;
        pT[29].s = 2;
        pT[29].p = 29;
        pT[30].s = 0;
        pT[30].p = 30;
        pT[0].x = 106;
        pT[0].y = 66;
        pT[1].x = 213;
        pT[1].y = 64;
        pT[2].x = 282;
        pT[2].y = 64;
        pT[3].x = 349;
        pT[3].y = 64;
        pT[4].x = 419;
        pT[4].y = 64;
        pT[5].x = 487;
        pT[5].y = 64;
        pT[6].x = 598;
        pT[6].y = 66;
        pT[7].x = 603;
        pT[7].y = 173;
        pT[8].x = 603;
        pT[8].y = 243;
        pT[9].x = 603;
        pT[9].y = 311;
        pT[10].x = 603;
        pT[10].y = 382;
        pT[11].x = 603;
        pT[11].y = 452;
        pT[12].x = 595;
        pT[12].y = 560;
        pT[13].x = 485;
        pT[13].y = 564;
        pT[14].x = 418;
        pT[14].y = 564;
        pT[15].x = 350;
        pT[15].y = 564;
        pT[16].x = 282;
        pT[16].y = 564;
        pT[17].x = 213;
        pT[17].y = 564;
        pT[18].x = 105;
        pT[18].y = 560;
        pT[19].x = 101;
        pT[19].y = 451;
        pT[20].x = 101;
        pT[20].y = 382;
        pT[21].x = 101;
        pT[21].y = 312;
        pT[22].x = 101;
        pT[22].y = 242;
        pT[23].x = 101;
        pT[23].y = 172;
        pT[24].x = 501;
        pT[24].y = 171;
        pT[25].x = 461;
        pT[25].y = 210;
        pT[26].x = 421;
        pT[26].y = 248;
        pT[27].x = 206;
        pT[27].y = 461;
        pT[28].x = 246;
        pT[28].y = 421;
        pT[29].x = 286;
        pT[29].y = 381;
        pT[30].x = 350;
        pT[30].y = 313;
        pT[0].r = 4;
        pT[1].r = 4;
        pT[2].r = 4;
        pT[3].r = 4;
        pT[4].r = 4;
        pT[5].r = 4;
        pT[6].r = 3;
        pT[7].r = 3;
        pT[8].r = 3;
        pT[9].r = 3;
        pT[10].r = 3;
        pT[11].r = 3;
        pT[12].r = 3;
        pT[13].r = 3;
        pT[14].r = 3;
        pT[15].r = 3;
        pT[16].r = 3;
        pT[17].r = 3;
        pT[18].r = 4;
        pT[19].r = 4;
        pT[20].r = 4;
        pT[21].r = 4;
        pT[22].r = 4;
        pT[23].r = 4;
        pT[24].r = 1;
        pT[25].r = 1;
        pT[26].r = 1;
        pT[27].r = 2;
        pT[28].r = 2;
        pT[29].r = 2;
        pT[30].r = 0;
        for (let i = 0; i < pT.length; i++) {
            let nx = Math.round(pT[i].x * kw),
                ny = Math.round(pT[i].y * kh),
                nw = Math.round(pT[i].w * kw),
                nh = Math.round(pT[i].h * kh);
            pT[i].x = nx;
            pT[i].y = ny;
            pT[i].w = nw;
            pT[i].h = nh;
        }
        return pT;
    },
    loadPositions3: function (kw, kh, instance) {
        let mOptions = $eXeTrivial.options[instance],
            pT = [];
        mOptions.wt = Math.round(60 * kw);
        mOptions.ht = Math.round(60 * kw);
        for (let i = 0; i < 31; i++) {
            let posicion = new Object();
            pT.push(posicion);
            pT[i].x = 0;
            pT[i].y = 0;
            pT[i].w = mOptions.wt;
            pT[i].h = mOptions.ht;
            pT[i].s = 1;
            pT[i].p = 1;
        }
        pT[0].s = 1;
        pT[0].p = 0;
        pT[1].s = 3;
        pT[1].p = 1;
        pT[2].s = 0;
        pT[2].p = 2;
        pT[3].s = 2;
        pT[3].p = 3;
        pT[4].s = 3;
        pT[4].p = 4;
        pT[5].s = 0;
        pT[5].p = 5;
        pT[6].s = 1;
        pT[6].p = 6;
        pT[7].s = 2;
        pT[7].p = 7;
        pT[8].s = 1;
        pT[8].p = 8;
        pT[9].s = 0;
        pT[9].p = 9;
        pT[10].s = 3;
        pT[10].p = 10;
        pT[11].s = 1;
        pT[11].p = 11;
        pT[12].s = 0;
        pT[12].p = 12;
        pT[13].s = 2;
        pT[13].p = 13;
        pT[14].s = 3;
        pT[14].p = 14;
        pT[15].s = 2;
        pT[15].p = 15;
        pT[16].s = 0;
        pT[16].p = 16;
        pT[17].s = 1;
        pT[17].p = 17;
        pT[18].s = 2;
        pT[18].p = 18;
        pT[19].s = 0;
        pT[19].p = 19;
        pT[20].s = 3;
        pT[20].p = 20;
        pT[21].s = 3;
        pT[21].p = 21;
        pT[22].s = 2;
        pT[22].p = 22;
        pT[23].s = 1;
        pT[23].p = 23;
        pT[24].s = 1;
        pT[24].p = 24;
        pT[25].s = 3;
        pT[25].p = 25;
        pT[26].s = 2;
        pT[26].p = 26;
        pT[27].s = 2;
        pT[27].p = 27;
        pT[28].s = 1;
        pT[28].p = 28;
        pT[29].s = 3;
        pT[29].p = 29;
        pT[30].s = 0;
        pT[30].p = 30;
        pT[0].x = 350;
        pT[0].y = 119;
        pT[1].x = 446;
        pT[1].y = 177;
        pT[2].x = 476;
        pT[2].y = 222;
        pT[3].x = 501;
        pT[3].y = 268;
        pT[4].x = 526;
        pT[4].y = 308;
        pT[5].x = 555;
        pT[5].y = 353;
        pT[6].x = 583;
        pT[6].y = 396;
        pT[7].x = 584;
        pT[7].y = 498;
        pT[8].x = 485;
        pT[8].y = 555;
        pT[9].x = 434;
        pT[9].y = 555;
        pT[10].x = 380;
        pT[10].y = 555;
        pT[11].x = 328;
        pT[11].y = 555;
        pT[12].x = 277;
        pT[12].y = 555;
        pT[13].x = 218;
        pT[13].y = 553;
        pT[14].x = 115;
        pT[14].y = 504;
        pT[15].x = 128;
        pT[15].y = 400;
        pT[16].x = 157;
        pT[16].y = 356;
        pT[17].x = 186;
        pT[17].y = 312;
        pT[18].x = 211;
        pT[18].y = 270;
        pT[19].x = 236;
        pT[19].y = 227;
        pT[20].x = 263;
        pT[20].y = 183;
        pT[21].x = 355;
        pT[21].y = 205;
        pT[22].x = 355;
        pT[22].y = 256;
        pT[23].x = 355;
        pT[23].y = 307;
        pT[24].x = 510;
        pT[24].y = 464;
        pT[25].x = 468;
        pT[25].y = 438;
        pT[26].x = 423;
        pT[26].y = 414;
        pT[27].x = 196;
        pT[27].y = 470;
        pT[28].x = 243;
        pT[28].y = 445;
        pT[29].x = 291;
        pT[29].y = 419;
        pT[30].x = 353;
        pT[30].y = 383;
        pT[0].r = 4;
        pT[1].r = 4;
        pT[2].r = 4;
        pT[3].r = 4;
        pT[4].r = 4;
        pT[5].r = 4;
        pT[6].r = 4;
        pT[7].r = 5;
        pT[8].r = 5;
        pT[9].r = 5;
        pT[10].r = 5;
        pT[11].r = 5;
        pT[12].r = 5;
        pT[13].r = 5;
        pT[14].r = 6;
        pT[15].r = 6;
        pT[16].r = 6;
        pT[17].r = 6;
        pT[18].r = 6;
        pT[19].r = 6;
        pT[20].r = 6;
        pT[21].r = 1;
        pT[22].r = 1;
        pT[23].r = 1;
        pT[24].r = 2;
        pT[25].r = 2;
        pT[26].r = 2;
        pT[27].r = 3;
        pT[28].r = 3;
        pT[29].r = 3;
        pT[30].r = 0;
        for (let i = 0; i < pT.length; i++) {
            let nx = Math.round(pT[i].x * kw),
                ny = Math.round(pT[i].y * kh),
                nw = Math.round(pT[i].w * kw),
                nh = Math.round(pT[i].h * kh);
            pT[i].x = nx;
            pT[i].y = ny;
            pT[i].w = nw;
            pT[i].h = nh;
        }
        return pT;
    },
    loadPositions4: function (kw, kh, instance) {
        let mOptions = $eXeTrivial.options[instance],
            pT = [];
        mOptions.wt = Math.round(64 * kw);
        mOptions.ht = Math.round(64 * kw);
        for (let i = 0; i < 37; i++) {
            let posicion = {};
            pT.push(posicion);
            pT[i].x = 0;
            pT[i].y = 0;
            pT[i].w = mOptions.wt;
            pT[i].h = mOptions.ht;
            pT[i].s = 1;
            pT[i].p = 1;
        }
        pT[0].s = 1;
        pT[0].p = 0;
        pT[1].s = 3;
        pT[1].p = 1;
        pT[2].s = 0;
        pT[2].p = 2;
        pT[3].s = 1;
        pT[3].p = 3;
        pT[4].s = 0;
        pT[4].p = 4;
        pT[5].s = 4;
        pT[5].p = 5;
        pT[6].s = 2;
        pT[6].p = 6;
        pT[7].s = 4;
        pT[7].p = 7;
        pT[8].s = 0;
        pT[8].p = 8;
        pT[9].s = 2;
        pT[9].p = 9;
        pT[10].s = 0;
        pT[10].p = 10;
        pT[11].s = 1;
        pT[11].p = 11;
        pT[12].s = 3;
        pT[12].p = 12;
        pT[13].s = 1;
        pT[13].p = 13;
        pT[14].s = 0;
        pT[14].p = 14;
        pT[15].s = 3;
        pT[15].p = 15;
        pT[16].s = 0;
        pT[16].p = 16;
        pT[17].s = 2;
        pT[17].p = 17;
        pT[18].s = 4;
        pT[18].p = 18;
        pT[19].s = 2;
        pT[19].p = 19;
        pT[20].s = 0;
        pT[20].p = 20;
        pT[21].s = 4;
        pT[21].p = 21;
        pT[22].s = 0;
        pT[22].p = 22;
        pT[23].s = 3;
        pT[23].p = 23;
        pT[24].s = 3;
        pT[24].p = 24;
        pT[25].s = 2;
        pT[25].p = 25;
        pT[26].s = 1;
        pT[26].p = 26;
        pT[27].s = 4;
        pT[27].p = 27;
        pT[28].s = 3;
        pT[28].p = 28;
        pT[29].s = 2;
        pT[29].p = 29;
        pT[30].s = 1;
        pT[30].p = 30;
        pT[31].s = 4;
        pT[31].p = 31;
        pT[32].s = 3;
        pT[32].p = 32;
        pT[33].s = 2;
        pT[33].p = 33;
        pT[34].s = 1;
        pT[34].p = 34;
        pT[35].s = 4;
        pT[35].p = 35;
        pT[36].s = 0;
        pT[36].p = 36;
        pT[0].x = 103;
        pT[0].y = 68;
        pT[1].x = 214;
        pT[1].y = 61;
        pT[2].x = 284;
        pT[2].y = 61;
        pT[3].x = 352;
        pT[3].y = 61;
        pT[4].x = 421;
        pT[4].y = 61;
        pT[5].x = 491;
        pT[5].y = 61;
        pT[6].x = 596;
        pT[6].y = 66;
        pT[7].x = 601;
        pT[7].y = 171;
        pT[8].x = 601;
        pT[8].y = 238;
        pT[9].x = 601;
        pT[9].y = 310;
        pT[10].x = 601;
        pT[10].y = 380;
        pT[11].x = 601;
        pT[11].y = 452;
        pT[12].x = 596;
        pT[12].y = 558;
        pT[13].x = 491;
        pT[13].y = 560;
        pT[14].x = 418;
        pT[14].y = 560;
        pT[15].x = 351;
        pT[15].y = 560;
        pT[16].x = 284;
        pT[16].y = 560;
        pT[17].x = 214;
        pT[17].y = 560;
        pT[18].x = 103;
        pT[18].y = 558;
        pT[19].x = 100;
        pT[19].y = 451;
        pT[20].x = 100;
        pT[20].y = 380;
        pT[21].x = 100;
        pT[21].y = 311;
        pT[22].x = 100;
        pT[22].y = 239;
        pT[23].x = 100;
        pT[23].y = 171;
        pT[24].x = 204;
        pT[24].y = 163;
        pT[25].x = 244;
        pT[25].y = 207;
        pT[26].x = 287;
        pT[26].y = 240;
        pT[27].x = 504;
        pT[27].y = 166;
        pT[28].x = 465;
        pT[28].y = 206;
        pT[29].x = 421;
        pT[29].y = 246;
        pT[30].x = 501;
        pT[30].y = 457;
        pT[31].x = 457;
        pT[31].y = 421;
        pT[32].x = 416;
        pT[32].y = 378;
        pT[33].x = 205;
        pT[33].y = 462;
        pT[34].x = 246;
        pT[34].y = 420;
        pT[35].x = 283;
        pT[35].y = 378;
        pT[36].x = 344;
        pT[36].y = 309;
        pT[0].r = 5;
        pT[1].r = 5;
        pT[2].r = 5;
        pT[3].r = 5;
        pT[4].r = 5;
        pT[5].r = 5;
        pT[6].r = 6;
        pT[7].r = 6;
        pT[8].r = 6;
        pT[9].r = 6;
        pT[10].r = 6;
        pT[11].r = 6;
        pT[12].r = 7;
        pT[13].r = 7;
        pT[14].r = 7;
        pT[15].r = 7;
        pT[16].r = 7;
        pT[17].r = 7;
        pT[18].r = 8;
        pT[19].r = 8;
        pT[20].r = 8;
        pT[21].r = 8;
        pT[22].r = 8;
        pT[23].r = 8;
        pT[24].r = 1;
        pT[25].r = 1;
        pT[26].r = 1;
        pT[27].r = 2;
        pT[28].r = 2;
        pT[29].r = 2;
        pT[30].r = 3;
        pT[31].r = 3;
        pT[32].r = 3;
        pT[33].r = 4;
        pT[34].r = 4;
        pT[35].r = 4;
        pT[36].r = 0;
        for (let i = 0; i < pT.length; i++) {
            let nx = Math.round(pT[i].x * kw),
                ny = Math.round(pT[i].y * kh),
                nw = Math.round(pT[i].w * kw),
                nh = Math.round(pT[i].h * kh);
            pT[i].x = nx;
            pT[i].y = ny;
            pT[i].w = nw;
            pT[i].h = nh;
        }
        return pT;
    },
    loadPositions5: function (kw, kh, instance) {
        let mOptions = $eXeTrivial.options[instance],
            pT = [];
        mOptions.wt = Math.round(64 * kw);
        mOptions.ht = Math.round(64 * kw);
        for (let i = 0; i < 51; i++) {
            let posicion = {};
            pT.push(posicion);
            pT[i].x = 0;
            pT[i].y = 0;
            pT[i].w = mOptions.wt;
            pT[i].h = mOptions.ht;
            pT[i].s = 1;
            pT[i].p = 1;
        }
        pT[0].p = 0;
        pT[1].p = 1;
        pT[2].p = 2;
        pT[3].p = 3;
        pT[4].p = 4;
        pT[5].p = 5;
        pT[6].p = 6;
        pT[7].p = 7;
        pT[8].p = 8;
        pT[9].p = 9;
        pT[10].p = 10;
        pT[11].p = 11;
        pT[12].p = 12;
        pT[13].p = 13;
        pT[14].p = 14;
        pT[15].p = 15;
        pT[16].p = 16;
        pT[17].p = 17;
        pT[18].p = 18;
        pT[19].p = 19;
        pT[20].p = 20;
        pT[21].p = 21;
        pT[22].p = 22;
        pT[23].p = 23;
        pT[24].p = 24;
        pT[25].p = 25;
        pT[26].p = 26;
        pT[27].p = 27;
        pT[28].p = 28;
        pT[29].p = 29;
        pT[30].p = 30;
        pT[31].p = 31;
        pT[32].p = 32;
        pT[33].p = 33;
        pT[34].p = 34;
        pT[35].p = 35;
        pT[36].p = 36;
        pT[37].p = 37;
        pT[38].p = 38;
        pT[39].p = 39;
        pT[40].p = 40;
        pT[41].p = 41;
        pT[42].p = 42;
        pT[43].p = 43;
        pT[44].p = 44;
        pT[45].p = 45;
        pT[46].p = 46;
        pT[47].p = 47;
        pT[48].p = 48;
        pT[49].p = 49;
        pT[50].p = 50;
        pT[0].s = 1;
        pT[1].s = 4;
        pT[2].s = 0;
        pT[3].s = 3;
        pT[4].s = 0;
        pT[5].s = 5;
        pT[6].s = 2;
        pT[7].s = 5;
        pT[8].s = 0;
        pT[9].s = 4;
        pT[10].s = 0;
        pT[11].s = 1;
        pT[12].s = 3;
        pT[13].s = 1;
        pT[14].s = 0;
        pT[15].s = 5;
        pT[16].s = 0;
        pT[17].s = 2;
        pT[18].s = 4;
        pT[19].s = 2;
        pT[20].s = 0;
        pT[21].s = 1;
        pT[22].s = 0;
        pT[23].s = 3;
        pT[24].s = 5;
        pT[25].s = 3;
        pT[26].s = 0;
        pT[27].s = 2;
        pT[28].s = 0;
        pT[29].s = 4;
        pT[30].s = 4;
        pT[31].s = 3;
        pT[32].s = 2;
        pT[33].s = 5;
        pT[34].s = 5;
        pT[35].s = 1;
        pT[36].s = 3;
        pT[37].s = 4;
        pT[38].s = 1;
        pT[39].s = 4;
        pT[40].s = 5;
        pT[41].s = 2;
        pT[42].s = 2;
        pT[43].s = 5;
        pT[44].s = 1;
        pT[45].s = 3;
        pT[46].s = 3;
        pT[47].s = 2;
        pT[48].s = 4;
        pT[49].s = 1;
        pT[50].s = 0;
        pT[0].x = 352;
        pT[0].y = 40;
        pT[1].x = 431;
        pT[1].y = 71;
        pT[2].x = 475;
        pT[2].y = 98;
        pT[3].x = 518;
        pT[3].y = 129;
        pT[4].x = 561;
        pT[4].y = 157;
        pT[5].x = 604;
        pT[5].y = 187;
        pT[6].x = 663;
        pT[6].y = 250;
        pT[7].x = 659;
        pT[7].y = 332;
        pT[8].x = 640;
        pT[8].y = 381;
        pT[9].x = 625;
        pT[9].y = 429;
        pT[10].x = 607;
        pT[10].y = 476;
        pT[11].x = 592;
        pT[11].y = 522;
        pT[12].x = 545;
        pT[12].y = 595;
        pT[13].x = 458;
        pT[13].y = 608;
        pT[14].x = 406;
        pT[14].y = 608;
        pT[15].x = 352;
        pT[15].y = 608;
        pT[16].x = 299;
        pT[16].y = 608;
        pT[17].x = 245;
        pT[17].y = 608;
        pT[18].x = 162;
        pT[18].y = 595;
        pT[19].x = 113;
        pT[19].y = 522;
        pT[20].x = 98;
        pT[20].y = 474;
        pT[21].x = 82;
        pT[21].y = 426;
        pT[22].x = 66;
        pT[22].y = 378;
        pT[23].x = 50;
        pT[23].y = 332;
        pT[24].x = 40;
        pT[24].y = 252;
        pT[25].x = 98;
        pT[25].y = 187;
        pT[26].x = 140;
        pT[26].y = 157;
        pT[27].x = 184;
        pT[27].y = 128;
        pT[28].x = 227;
        pT[28].y = 98;
        pT[29].x = 271;
        pT[29].y = 69;
        pT[30].x = 353;
        pT[30].y = 112;
        pT[31].x = 353;
        pT[31].y = 165;
        pT[32].x = 353;
        pT[32].y = 215;
        pT[33].x = 353;
        pT[33].y = 267;
        pT[34].x = 586;
        pT[34].y = 276;
        pT[35].x = 533;
        pT[35].y = 291;
        pT[36].x = 482;
        pT[36].y = 305;
        pT[37].x = 430;
        pT[37].y = 322;
        pT[38].x = 497;
        pT[38].y = 529;
        pT[39].x = 464;
        pT[39].y = 488;
        pT[40].x = 432;
        pT[40].y = 446;
        pT[41].x = 400;
        pT[41].y = 403;
        pT[42].x = 211;
        pT[42].y = 533;
        pT[43].x = 243;
        pT[43].y = 490;
        pT[44].x = 273;
        pT[44].y = 448;
        pT[45].x = 304;
        pT[45].y = 406;
        pT[46].x = 116;
        pT[46].y = 275;
        pT[47].x = 169;
        pT[47].y = 291;
        pT[48].x = 222;
        pT[48].y = 306;
        pT[49].x = 275;
        pT[49].y = 322;
        pT[50].x = 351;
        pT[50].y = 343;
        pT[0].r = 6;
        pT[1].r = 6;
        pT[2].r = 6;
        pT[3].r = 6;
        pT[4].r = 6;
        pT[5].r = 6;
        pT[6].r = 7;
        pT[7].r = 7;
        pT[8].r = 7;
        pT[9].r = 7;
        pT[10].r = 7;
        pT[11].r = 7;
        pT[12].r = 8;
        pT[13].r = 8;
        pT[14].r = 8;
        pT[15].r = 8;
        pT[16].r = 8;
        pT[17].r = 8;
        pT[18].r = 9;
        pT[19].r = 9;
        pT[20].r = 9;
        pT[21].r = 9;
        pT[22].r = 9;
        pT[23].r = 9;
        pT[24].r = 10;
        pT[25].r = 10;
        pT[26].r = 10;
        pT[27].r = 10;
        pT[28].r = 10;
        pT[29].r = 10;
        pT[30].r = 1;
        pT[31].r = 1;
        pT[32].r = 1;
        pT[33].r = 1;
        pT[34].r = 2;
        pT[35].r = 2;
        pT[36].r = 2;
        pT[37].r = 2;
        pT[38].r = 3;
        pT[39].r = 3;
        pT[40].r = 3;
        pT[41].r = 3;
        pT[42].r = 4;
        pT[43].r = 4;
        pT[44].r = 4;
        pT[45].r = 4;
        pT[46].r = 5;
        pT[47].r = 5;
        pT[48].r = 5;
        pT[49].r = 5;
        pT[50].r = 0;
        for (let i = 0; i < pT.length; i++) {
            let nx = Math.round(pT[i].x * kw),
                ny = Math.round(pT[i].y * kh),
                nw = Math.round(pT[i].w * kw),
                nh = Math.round(pT[i].h * kh);
            pT[i].x = nx;
            pT[i].y = ny;
            pT[i].w = nw;
            pT[i].h = nh;
        }
        return pT;
    },
    loadPositions6: function (kw, kh, instance) {
        let mOptions = $eXeTrivial.options[instance],
            pT = [];
        mOptions.wt = Math.round(64 * kw);
        mOptions.ht = Math.round(64 * kh);
        for (let i = 0; i < 73; i++) {
            let posicion = {};
            pT.push(posicion);
            pT[i].x = 0;
            pT[i].y = 0;
            pT[i].w = mOptions.wt;
            pT[i].h = mOptions.ht;
            pT[i].s = 1;
            pT[i].p = 1;
        }
        pT[0].r = 7;
        pT[0].p = 0;
        pT[1].r = 7;
        pT[1].p = 1;
        pT[2].r = 7;
        pT[2].p = 2;
        pT[3].r = 7;
        pT[3].p = 3;
        pT[4].r = 7;
        pT[4].p = 4;
        pT[5].r = 7;
        pT[5].p = 5;
        pT[6].r = 7;
        pT[6].p = 6;
        pT[7].r = 8;
        pT[7].p = 7;
        pT[8].r = 8;
        pT[8].p = 8;
        pT[9].r = 8;
        pT[9].p = 9;
        pT[10].r = 8;
        pT[10].p = 10;
        pT[11].r = 8;
        pT[11].p = 11;
        pT[12].r = 8;
        pT[12].p = 12;
        pT[13].r = 8;
        pT[13].p = 13;
        pT[14].r = 9;
        pT[14].p = 14;
        pT[15].r = 9;
        pT[15].p = 15;
        pT[16].r = 9;
        pT[16].p = 16;
        pT[17].r = 9;
        pT[17].p = 17;
        pT[18].r = 9;
        pT[18].p = 18;
        pT[19].r = 9;
        pT[19].p = 19;
        pT[20].r = 9;
        pT[20].p = 20;
        pT[21].r = 10;
        pT[21].p = 21;
        pT[22].r = 10;
        pT[22].p = 22;
        pT[23].r = 10;
        pT[23].p = 23;
        pT[24].r = 10;
        pT[24].p = 24;
        pT[25].r = 10;
        pT[25].p = 25;
        pT[26].r = 10;
        pT[26].p = 26;
        pT[27].r = 10;
        pT[27].p = 27;
        pT[28].r = 11;
        pT[28].p = 28;
        pT[29].r = 11;
        pT[29].p = 29;
        pT[30].r = 11;
        pT[30].p = 30;
        pT[31].r = 11;
        pT[31].p = 31;
        pT[32].r = 11;
        pT[32].p = 32;
        pT[33].r = 11;
        pT[33].p = 33;
        pT[34].r = 11;
        pT[34].p = 34;
        pT[35].r = 12;
        pT[35].p = 35;
        pT[36].r = 12;
        pT[36].p = 36;
        pT[37].r = 12;
        pT[37].p = 37;
        pT[38].r = 12;
        pT[38].p = 38;
        pT[39].r = 12;
        pT[39].p = 39;
        pT[40].r = 12;
        pT[40].p = 40;
        pT[41].r = 12;
        pT[41].p = 41;
        pT[42].r = 1;
        pT[42].p = 42;
        pT[43].r = 1;
        pT[43].p = 43;
        pT[44].r = 1;
        pT[44].p = 44;
        pT[45].r = 1;
        pT[45].p = 45;
        pT[46].r = 1;
        pT[46].p = 46;
        pT[47].r = 2;
        pT[47].p = 47;
        pT[48].r = 2;
        pT[48].p = 48;
        pT[49].r = 2;
        pT[49].p = 49;
        pT[50].r = 2;
        pT[50].p = 50;
        pT[51].r = 2;
        pT[51].p = 51;
        pT[52].r = 3;
        pT[52].p = 52;
        pT[53].r = 3;
        pT[53].p = 53;
        pT[54].r = 3;
        pT[54].p = 54;
        pT[55].r = 3;
        pT[55].p = 55;
        pT[56].r = 3;
        pT[56].p = 56;
        pT[57].r = 4;
        pT[57].p = 57;
        pT[58].r = 4;
        pT[58].p = 58;
        pT[59].r = 4;
        pT[59].p = 59;
        pT[60].r = 4;
        pT[60].p = 60;
        pT[61].r = 4;
        pT[61].p = 61;
        pT[62].r = 5;
        pT[62].p = 62;
        pT[63].r = 5;
        pT[63].p = 63;
        pT[64].r = 5;
        pT[64].p = 64;
        pT[65].r = 5;
        pT[65].p = 65;
        pT[66].r = 5;
        pT[66].p = 66;
        pT[67].r = 6;
        pT[67].p = 67;
        pT[68].r = 6;
        pT[68].p = 68;
        pT[69].r = 6;
        pT[69].p = 69;
        pT[70].r = 6;
        pT[70].p = 70;
        pT[71].r = 6;
        pT[71].p = 71;
        pT[72].r = 0;
        pT[72].p = 72;
        pT[0].s = 1;
        pT[1].s = 4;
        pT[2].s = 0;
        pT[3].s = 3;
        pT[4].s = 6;
        pT[5].s = 0;
        pT[6].s = 5;
        pT[7].s = 2;
        pT[8].s = 5;
        pT[9].s = 0;
        pT[10].s = 4;
        pT[11].s = 1;
        pT[12].s = 0;
        pT[13].s = 6;
        pT[14].s = 3;
        pT[15].s = 6;
        pT[16].s = 0;
        pT[17].s = 2;
        pT[18].s = 5;
        pT[19].s = 0;
        pT[20].s = 1;
        pT[21].s = 4;
        pT[22].s = 1;
        pT[23].s = 0;
        pT[24].s = 6;
        pT[25].s = 3;
        pT[26].s = 0;
        pT[27].s = 2;
        pT[28].s = 5;
        pT[29].s = 2;
        pT[30].s = 0;
        pT[31].s = 1;
        pT[32].s = 4;
        pT[33].s = 0;
        pT[34].s = 3;
        pT[35].s = 6;
        pT[36].s = 3;
        pT[37].s = 0;
        pT[38].s = 2;
        pT[39].s = 5;
        pT[40].s = 0;
        pT[41].s = 4;
        pT[42].s = 4;
        pT[43].s = 5;
        pT[44].s = 3;
        pT[45].s = 2;
        pT[46].s = 6;
        pT[47].s = 5;
        pT[48].s = 6;
        pT[49].s = 4;
        pT[50].s = 3;
        pT[51].s = 1;
        pT[52].s = 6;
        pT[53].s = 1;
        pT[54].s = 5;
        pT[55].s = 4;
        pT[56].s = 2;
        pT[57].s = 1;
        pT[58].s = 2;
        pT[59].s = 6;
        pT[60].s = 5;
        pT[61].s = 3;
        pT[62].s = 2;
        pT[63].s = 3;
        pT[64].s = 1;
        pT[65].s = 6;
        pT[66].s = 4;
        pT[67].s = 3;
        pT[68].s = 4;
        pT[69].s = 2;
        pT[70].s = 1;
        pT[71].s = 5;
        pT[72].s = 0;
        pT[0].x = 186;
        pT[0].y = 27;
        pT[1].x = 257;
        pT[1].y = 18;
        pT[2].x = 295;
        pT[2].y = 18;
        pT[3].x = 333;
        pT[3].y = 18;
        pT[4].x = 371;
        pT[4].y = 18;
        pT[5].x = 409;
        pT[5].y = 18;
        pT[6].x = 447;
        pT[6].y = 18;
        pT[7].x = 516;
        pT[7].y = 28;
        pT[8].x = 562;
        pT[8].y = 83;
        pT[9].x = 581;
        pT[9].y = 117;
        pT[10].x = 597;
        pT[10].y = 147;
        pT[11].x = 617;
        pT[11].y = 181;
        pT[12].x = 635;
        pT[12].y = 213;
        pT[13].x = 654;
        pT[13].y = 245;
        pT[14].x = 684;
        pT[14].y = 314;
        pT[15].x = 657;
        pT[15].y = 377;
        pT[16].x = 639;
        pT[16].y = 410;
        pT[17].x = 620;
        pT[17].y = 440;
        pT[18].x = 602;
        pT[18].y = 475;
        pT[19].x = 582;
        pT[19].y = 507;
        pT[20].x = 563;
        pT[20].y = 539;
        pT[21].x = 519;
        pT[21].y = 600;
        pT[22].x = 447;
        pT[22].y = 607;
        pT[23].x = 410;
        pT[23].y = 607;
        pT[24].x = 373;
        pT[24].y = 607;
        pT[25].x = 336;
        pT[25].y = 607;
        pT[26].x = 296;
        pT[26].y = 607;
        pT[27].x = 260;
        pT[27].y = 607;
        pT[28].x = 185;
        pT[28].y = 600;
        pT[29].x = 144;
        pT[29].y = 541;
        pT[30].x = 126;
        pT[30].y = 509;
        pT[31].x = 107;
        pT[31].y = 476;
        pT[32].x = 88;
        pT[32].y = 445;
        pT[33].x = 70;
        pT[33].y = 410;
        pT[34].x = 51;
        pT[34].y = 379;
        pT[35].x = 20;
        pT[35].y = 314;
        pT[36].x = 48;
        pT[36].y = 246;
        pT[37].x = 68;
        pT[37].y = 212;
        pT[38].x = 87;
        pT[38].y = 180;
        pT[39].x = 106;
        pT[39].y = 148;
        pT[40].x = 125;
        pT[40].y = 116;
        pT[41].x = 144;
        pT[41].y = 84;
        pT[42].x = 225;
        pT[42].y = 91;
        pT[43].x = 247;
        pT[43].y = 128;
        pT[44].x = 269;
        pT[44].y = 166;
        pT[45].x = 292;
        pT[45].y = 204;
        pT[46].x = 313;
        pT[46].y = 241;
        pT[47].x = 481;
        pT[47].y = 92;
        pT[48].x = 460;
        pT[48].y = 128;
        pT[49].x = 437;
        pT[49].y = 167;
        pT[50].x = 416;
        pT[50].y = 206;
        pT[51].x = 394;
        pT[51].y = 244;
        pT[52].x = 609;
        pT[52].y = 313;
        pT[53].x = 565;
        pT[53].y = 313;
        pT[54].x = 521;
        pT[54].y = 313;
        pT[55].x = 477;
        pT[55].y = 313;
        pT[56].x = 433;
        pT[56].y = 313;
        pT[57].x = 482;
        pT[57].y = 532;
        pT[58].x = 460;
        pT[58].y = 494;
        pT[59].x = 437;
        pT[59].y = 457;
        pT[60].x = 415;
        pT[60].y = 419;
        pT[61].x = 392;
        pT[61].y = 380;
        pT[62].x = 225;
        pT[62].y = 536;
        pT[63].x = 248;
        pT[63].y = 498;
        pT[64].x = 268;
        pT[64].y = 459;
        pT[65].x = 289;
        pT[65].y = 421;
        pT[66].x = 309;
        pT[66].y = 382;
        pT[67].x = 97;
        pT[67].y = 313;
        pT[68].x = 140;
        pT[68].y = 313;
        pT[69].x = 184;
        pT[69].y = 313;
        pT[70].x = 228;
        pT[70].y = 313;
        pT[71].x = 273;
        pT[71].y = 313;
        pT[72].x = 350;
        pT[72].y = 313;
        for (let i = 0; i < pT.length; i++) {
            let nx = Math.round(pT[i].x * kw),
                ny = Math.round(pT[i].y * kh),
                nw = Math.round(pT[i].w * kw),
                nh = Math.round(pT[i].h * kh);
            pT[i].x = nx;
            pT[i].y = ny;
            pT[i].w = nw;
            pT[i].h = nh;
        }
        return pT;
    },
    getNextPositions2: function (vd, pA, instance) {
        let pT = $eXeTrivial.options[instance].pT,
            nI = 0,
            nS = 0,
            node = 0,
            px1 = 0,
            px2 = 0,
            nts = [],
            posCI = [],
            posCS = [];
        if (pT[pA].r == 1) {
            px1 = 24;
            px2 = 26;
            node = 6;
        } else if (pT[pA].r == 2) {
            px1 = 27;
            px2 = 29;
            node = 18;
        } else if (pT[pA].r == 3) {
            px1 = 6;
            px2 = 18;
            nI = 24;
            nS = 27;
        } else if (pT[pA].r == 4) {
            px1 = 18;
            px2 = 6;
            nI = 27;
            nS = 24;
        }
        switch (pT[pA].r) {
            case 3:
            case 4:
                posCI = $eXeTrivial.posCI2(pA, vd, px1, nI);
                posCS = $eXeTrivial.posCS2(pA, vd, px2, nS);
                break;
            case 1:
            case 2:
                posCI = $eXeTrivial.posDI2(pA, px1, node, vd);
                posCS = $eXeTrivial.posDS2(pA, px2, vd);
                break;
            case 0:
                posCI = $eXeTrivial.posR2(vd);
                break;
        }
        for (let i = 0; i < posCI.length; i++) {
            nts.push(posCI[i]);
        }
        for (let i = 0; i < posCS.length; i++) {
            nts.push(posCS[i]);
        }
        return nts;
    },
    getNextPositions3: function (vd, pA, instance) {
        let pT = $eXeTrivial.options[instance].pT,
            nI = 0,
            nS = 0,
            node = 0,
            px1 = 0,
            px2 = 0,
            nts = [],
            posCI = [],
            posCS = [];
        if (pT[pA].r == 1) {
            px1 = 21;
            px2 = 23;
            node = 0;
        } else if (pT[pA].r == 2) {
            px1 = 24;
            px2 = 26;
            node = 7;
        } else if (pT[pA].r == 3) {
            px1 = 27;
            px2 = 29;
            node = 14;
        } else if (pT[pA].r == 4) {
            px1 = 0;
            px2 = 7;
            nI = 21;
            nS = 24;
        } else if (pT[pA].r == 5) {
            px1 = 7;
            px2 = 14;
            nI = 24;
            nS = 27;
        } else if (pT[pA].r === 6) {
            px1 = 14;
            px2 = 0;
            nI = 27;
            nS = 21;
        }
        switch (pT[pA].r) {
            case 4:
            case 5:
            case 6:
                posCI = $eXeTrivial.posCI3(pA, vd, px1, nI);
                posCS = $eXeTrivial.posCS3(pA, vd, px2, nS, instance);
                break;
            case 1:
            case 2:
            case 3:
                posCI = $eXeTrivial.posDI3(pA, px1, node, vd);
                posCS = $eXeTrivial.posDS3(pA, px2, vd);
                break;
            case 0:
                posCI = $eXeTrivial.posR3(vd);
                break;
            default:
                break;
        }
        for (let i = 0; i < posCI.length; i++) {
            nts.push(posCI[i]);
        }
        for (let i = 0; i < posCS.length; i++) {
            nts.push(posCS[i]);
        }
        return nts;
    },
    getNextPositions4: function (vd, pA, instance) {
        let pT = $eXeTrivial.options[instance].pT,
            nI = 0,
            nS = 0,
            node = 0,
            px1 = 0,
            px2 = 0,
            nts = [],
            posCI = [],
            posCS = [];
        if (pT[pA].r == 1) {
            px1 = 24;
            px2 = 26;
            node = 0;
        } else if (pT[pA].r == 2) {
            px1 = 27;
            px2 = 29;
            node = 6;
        } else if (pT[pA].r == 3) {
            px1 = 30;
            px2 = 32;
            node = 12;
        } else if (pT[pA].r == 4) {
            px1 = 33;
            px2 = 35;
            node = 18;
        } else if (pT[pA].r == 5) {
            px1 = 0;
            px2 = 6;
            nI = 24;
            nS = 27;
        } else if (pT[pA].r == 6) {
            px1 = 6;
            px2 = 12;
            nI = 27;
            nS = 30;
        } else if (pT[pA].r == 7) {
            px1 = 12;
            px2 = 18;
            nI = 30;
            nS = 33;
        } else if (pT[pA].r == 8) {
            px1 = 18;
            px2 = 0;
            nI = 33;
            nS = 24;
        }
        switch (pT[pA].r) {
            case 5:
            case 6:
            case 7:
            case 8:
                posCI = $eXeTrivial.posCI4(pA, vd, px1, nI);
                posCS = $eXeTrivial.posCS4(pA, vd, px2, nS, instance);
                break;
            case 1:
            case 2:
            case 3:
            case 4:
                posCI = $eXeTrivial.posDI4(pA, px1, node, vd);
                posCS = $eXeTrivial.posDS4(pA, px2, vd);
                break;
            case 0:
                posCI = $eXeTrivial.posDesdeR4(vd);
                break;
            default:
                break;
        }
        for (let i = 0; i < posCI.length; i++) {
            nts.push(posCI[i]);
        }
        for (let i = 0; i < posCS.length; i++) {
            nts.push(posCS[i]);
        }
        return nts;
    },
    getNextPositions5: function (vd, pA, instance) {
        let pT = $eXeTrivial.options[instance].pT,
            nI = 0,
            nS = 0,
            node = 0,
            px1 = 0,
            px2 = 0,
            nts = [],
            posCI = [],
            posCS = [];
        if (pT[pA].r == 1) {
            px1 = 30;
            px2 = 33;
            node = 0;
        } else if (pT[pA].r == 2) {
            px1 = 34;
            px2 = 37;
            node = 6;
        } else if (pT[pA].r == 3) {
            px1 = 38;
            px2 = 41;
            node = 12;
        } else if (pT[pA].r == 4) {
            px1 = 42;
            px2 = 45;
            node = 18;
        } else if (pT[pA].r == 5) {
            px1 = 46;
            px2 = 49;
            node = 24;
        } else if (pT[pA].r == 6) {
            px1 = 0;
            px2 = 6;
            nI = 30;
            nS = 34;
        } else if (pT[pA].r == 7) {
            px1 = 6;
            px2 = 12;
            nI = 34;
            nS = 38;
        } else if (pT[pA].r == 8) {
            px1 = 12;
            px2 = 18;
            nI = 38;
            nS = 42;
        } else if (pT[pA].r == 9) {
            px1 = 18;
            px2 = 24;
            nI = 42;
            nS = 46;
        } else if (pT[pA].r == 10) {
            px1 = 24;
            px2 = 0;
            nI = 46;
            nS = 30;
        }
        switch (pT[pA].r) {
            case 6:
            case 7:
            case 8:
            case 9:
            case 10:
                posCI = $eXeTrivial.posCI5(pA, vd, px1, nI);
                posCS = $eXeTrivial.posCS5(pA, vd, px2, nS, instance);
                break;
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
                posCI = $eXeTrivial.posDI5(pA, px1, node, vd);
                posCS = $eXeTrivial.posDS5(pA, px2, vd);
                break;
            case 0:
                posCI = $eXeTrivial.posR5(vd);
                break;
            default:
                break;
        }
        for (let i = 0; i < posCI.length; i++) {
            nts.push(posCI[i]);
        }
        for (let i = 0; i < posCS.length; i++) {
            nts.push(posCS[i]);
        }
        return nts;
    },
    getNextPositions6: function (vd, pA, instance) {
        let pT = $eXeTrivial.options[instance].pT,
            nI = 0,
            nS = 0,
            node = 0,
            px1 = 0,
            px2 = 0,
            nts = [],
            posCI = [],
            posCS = [];
        if (pT[pA].r == 1) {
            px1 = 42;
            px2 = 46;
            node = 0;
        } else if (pT[pA].r == 2) {
            px1 = 47;
            px2 = 51;
            node = 7;
        } else if (pT[pA].r == 3) {
            px1 = 52;
            px2 = 56;
            node = 14;
        } else if (pT[pA].r == 4) {
            px1 = 57;
            px2 = 61;
            node = 21;
        } else if (pT[pA].r == 5) {
            px1 = 62;
            px2 = 66;
            node = 28;
        } else if (pT[pA].r == 6) {
            px1 = 67;
            px2 = 71;
            node = 35;
        } else if (pT[pA].r == 7) {
            px1 = 0;
            px2 = 7;
            nI = 42;
            nS = 47;
        } else if (pT[pA].r == 8) {
            px1 = 7;
            px2 = 14;
            nI = 47;
            nS = 52;
        } else if (pT[pA].r == 9) {
            px1 = 14;
            px2 = 21;
            nI = 52;
            nS = 57;
        } else if (pT[pA].r == 10) {
            px1 = 21;
            px2 = 28;
            nI = 57;
            nS = 62;
        } else if (pT[pA].r == 11) {
            px1 = 28;
            px2 = 35;
            nI = 62;
            nS = 67;
        } else if (pT[pA].r == 12) {
            px1 = 35;
            px2 = 0;
            nI = 67;
            nS = 42;
        }
        switch (pT[pA].r) {
            case 7:
            case 8:
            case 9:
            case 10:
            case 11:
            case 12:
                posCI = $eXeTrivial.posCI6(pA, vd, px1, nI);
                posCS = $eXeTrivial.posCS6(pA, vd, px2, nS, instance);
                break;
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
                posCI = $eXeTrivial.posDI6(pA, px1, node, vd);
                posCS = $eXeTrivial.posDS6(pA, px2, vd);
                break;
            case 0:
                posCI = $eXeTrivial.posR6(vd);
                break;
            default:
                break;
        }
        for (let i = 0; i < posCI.length; i++) {
            nts.push(posCI[i]);
        }
        for (let i = 0; i < posCS.length; i++) {
            nts.push(posCS[i]);
        }
        return nts;
    },
    posR2: function (vd) {
        let pos = [];
        pos.push(27 - vd);
        pos.push(30 - vd);
        if (vd == 4) {
            pos = [];
            pos.push(6);
            pos.push(18);
        }
        return pos;
    },
    posCS2: function (pA, vd, nU, ndU) {
        let rd = vd - (nU - pA),
            pos = [],
            tg = pA + vd,
            posicion = tg < 24 ? tg : tg - 24;
        if (rd <= 0) {
            pos.push(posicion);
        } else {
            if (pA < 6) {
                let pos2 = tg - 7 + 24;
                pos.push(pos2);
            } else if (pA < 18) {
                let pos2 = tg - 19 + 27;
                pos.push(pos2);
            }
            pos.push(posicion);
        }
        return pos;
    },
    posCI2: function (pA, vd, nB, ndB) {
        let rd = vd - (pA - nB),
            pos = [];
        if (pA - vd == 0) {
            pos.push(0);
        } else if (pA - vd < 0) {
            pos.push(24 - (vd - pA));
        } else if (pA < 6) {
            pos.push(pA - vd);
        } else if (pA - vd >= nB) {
            pos.push(pA - vd);
        } else {
            pos.push(pA - vd);
            pos.push(ndB - 1 + rd);
            if (pA == nB && vd == 4) {
                pos[1] = 30;
            }
        }
        return pos;
    },
    posDS2: function (pA, nU, vd) {
        let nodos = 0,
            rD = vd - (nU - pA),
            pos = [],
            num = [0, -4, -3, -2, -1];
        if (num.indexOf(rD) != -1) {
            pos.push(pA + vd);
        } else if (rD == 1) {
            pos.push(30);
        } else {
            for (let j = 1; j < 3; j++) {
                nodos = 26 + 3 * (j - 1);
                if (nodos != nU) {
                    pos.push(nodos - (rD - 2));
                }
            }
        }
        return pos;
    },
    posDI2: function (pA, nB, ndB, vd) {
        let rD = vd - (pA - nB),
            pos = [],
            num = [0, -4, -3, -2, -1];
        if (num.indexOf(rD) != -1) {
            pos.push(pA - vd);
        } else if (rD == 1) {
            pos.push(ndB);
        } else {
            pos.push(ndB + (rD - 1));
            pos.push(ndB - (rD - 1));
            if (ndB == 0) {
                pos[1] = 24 - (rD - 1);
            }
        }
        return pos;
    },
    posR3: function (vd) {
        let pos = [];
        pos.push(24 - vd);
        pos.push(27 - vd);
        pos.push(30 - vd);
        if (vd == 4) {
            pos = [];
            pos.push(0);
            pos.push(7);
            pos.push(14);
        }
        return pos;
    },
    posCI3: function (pA, vd, nB, ndB) {
        let rd = vd - (pA - nB),
            pos = [],
            num = [0, -6, -5, -4, -3, -2, -1];
        if (num.indexOf(rd) != -1) {
            pos.push(pA - vd);
        } else {
            pos.push(Math.abs(pA - vd));
            pos.push(ndB - 1 + rd);
            if (nB == 0) {
                pos[0] = 21 - rd;
            }
            if (pA == nB && vd == 4) {
                pos[1] = 30;
            }
        }
        return pos;
    },
    posCS3: function (pA, vd, nU, ndU, instance) {
        let mOptions = $eXeTrivial.options[instance],
            Ls = nU;
        if (nU == 0) Ls = 21;
        let rd = vd - (Ls - pA),
            pos = [],
            num = [0, -6, -5, -4, -3, -2, -1];
        if (num.indexOf(rd) != -1) {
            pos.push(pA + vd);
            if (mOptions.pT[pA].r == 6 && rd == 0) {
                pos[0] = 0;
            }
        } else {
            pos.push(pA + vd);
            pos.push(ndU - 1 + rd);
            if (nU == 0) pos[1] = rd;
            if (nU == 0) pos[0] = pA + vd - 1;
        }
        return pos;
    },
    posDS3: function (pA, nU, vd) {
        let nodos = 0,
            rD = vd - (nU - pA),
            pos = [],
            num = [0, -6, -5, -4, -3, -2, -1];
        if (num.indexOf(rD) != -1) {
            pos.push(pA + vd);
        } else if (rD == 1) {
            pos.push(30);
        } else {
            for (let j = 1; j < 4; j++) {
                nodos = 23 + 3 * (j - 1);
                if (nodos != nU) {
                    pos.push(nodos - (rD - 2));
                }
            }
        }
        return pos;
    },
    posDI3: function (pA, nB, ndB, vd) {
        let rD = vd - (pA - nB),
            pos = [],
            num = [0, -6, -5, -4, -3, -2, -1];
        if (num.indexOf(rD) != -1) {
            pos.push(pA - vd);
        } else if (rD == 1) {
            pos.push(ndB);
        } else {
            pos.push(ndB + (rD - 1));
            pos.push(ndB - (rD - 1));
            if (ndB == 0) {
                pos[1] = 21 - (rD - 1);
            }
        }
        return pos;
    },
    posDesdeR4: function (vd) {
        let pos = [];
        pos.push(27 - vd);
        pos.push(30 - vd);
        pos.push(33 - vd);
        pos.push(36 - vd);
        if (vd == 4) {
            pos = [];
            pos.push(0);
            pos.push(6);
            pos.push(12);
            pos.push(18);
        }
        return pos;
    },
    posCS4: function (pA, vd, nU, ndU, instance) {
        let mOptions = $eXeTrivial.options[instance],
            Ls = nU;
        if (nU == 0) Ls = 24;
        let rd = vd - (Ls - pA),
            pos = [],
            num = [0, -5, -4, -3, -2, -1];
        if (num.indexOf(rd) != -1) {
            pos.push(pA + vd);
            if (mOptions.pT[pA].r == 8 && rd == 0) {
                pos[0] = 0;
            }
        } else {
            pos.push(pA + vd);
            pos.push(ndU - 1 + rd);
            if (nU == 0) pos[1] = rd;
        }
        return pos;
    },
    posCI4: function (pA, vd, nB, ndB) {
        let rd = vd - (pA - nB),
            pos = [],
            num = [0, -5, -4, -3, -2, -1];
        if (num.indexOf(rd) != -1) {
            pos.push(pA - vd);
        } else {
            pos.push(Math.abs(pA - vd));
            pos.push(ndB - 1 + rd);
            if (nB == 0) {
                pos[0] = 24 - rd;
            }
            if (pA == nB && vd == 4) {
                pos[1] = 36;
            }
        }
        return pos;
    },
    posDS4: function (pA, nU, vd) {
        let nodos = 0,
            rD = vd - (nU - pA),
            pos = [],
            num = [0, -4, -3, -2, -1];
        if (num.indexOf(rD) != -1) {
            pos.push(pA + vd);
        } else if (rD == 1) {
            pos.push(36);
        } else {
            for (let j = 1; j < 5; j++) {
                nodos = 26 + 3 * (j - 1);
                if (nodos != nU) {
                    pos.push(nodos - (rD - 2));
                }
            }
        }
        return pos;
    },
    posDI4: function (pA, nB, ndB, vd) {
        let rD = vd - (pA - nB),
            pos = [],
            num = [0, -4, -3, -2, -1];
        if (num.indexOf(rD) != -1) {
            pos.push(pA - vd);
        } else if (rD == 1) {
            pos.push(ndB);
        } else {
            pos.push(ndB + (rD - 1));
            pos.push(ndB - (rD - 1));
            if (ndB == 0) {
                pos[1] = 24 - (rD - 1);
            }
        }
        return pos;
    },
    posR5: function (vd) {
        let pos = [];
        pos.push(34 - vd);
        pos.push(38 - vd);
        pos.push(42 - vd);
        pos.push(46 - vd);
        pos.push(50 - vd);
        if (vd == 5) {
            pos = [];
            pos.push(0);
            pos.push(6);
            pos.push(12);
            pos.push(18);
            pos.push(24);
        }
        return pos;
    },
    posCS5: function (pA, vd, nU, ndU, instance) {
        let mOptions = $eXeTrivial.options[instance],
            Ls = nU;
        if (nU == 0) Ls = 30;
        let rd = vd - (Ls - pA),
            pos = [],
            num = [0, -5, -4, -3, -2, -1];
        if (num.indexOf(rd) != -1) {
            pos.push(pA + vd);
            if (mOptions.pT[pA].r == 10 && rd == 0) {
                pos[0] = 0;
            }
        } else {
            pos.push(pA + vd);
            pos.push(ndU - 1 + rd);
            if (nU == 0) pos[1] = rd;
        }
        return pos;
    },
    posCI5: function (pA, vd, nB, ndB) {
        let rd = vd - (pA - nB),
            pos = [],
            num = [0, -5, -4, -3, -2, -1];
        if (num.indexOf(rd) != -1) {
            pos.push(pA - vd);
        } else {
            pos.push(Math.abs(pA - vd));
            pos.push(ndB - 1 + rd);
            if (nB == 0) {
                pos[0] = 30 - rd;
            }
            if (pA == nB && vd == 5) {
                pos[1] = 50;
            }
        }
        return pos;
    },
    posDI5: function (pA, nB, ndB, vd) {
        let rD = vd - (pA - nB),
            pos = [],
            num = [0, -5, -4, -3, -2, -1];
        if (num.indexOf(rD) != -1) {
            pos.push(pA - vd);
        } else if (rD == 1) {
            pos.push(ndB);
        } else {
            pos.push(ndB + (rD - 1));
            pos.push(ndB - (rD - 1));
            if (ndB == 0) {
                pos[1] = 30 - (rD - 1);
            }
        }
        return pos;
    },
    posDS5: function (pA, nU, vd) {
        let nodos = 0,
            rD = vd - (nU - pA),
            pos = [],
            num = [0, -5, -4, -3, -2, -1];
        if (num.indexOf(rD) != -1) {
            pos.push(pA + vd);
        } else if (rD == 1) {
            pos.push(50);
        } else {
            for (let j = 1; j < 6; j++) {
                nodos = 33 + 4 * (j - 1);
                if (nodos != nU) {
                    pos.push(nodos - (rD - 2));
                }
            }
        }
        return pos;
    },
    posR6: function (vd) {
        let pos = [];
        pos.push(47 - vd);
        pos.push(52 - vd);
        pos.push(57 - vd);
        pos.push(62 - vd);
        pos.push(67 - vd);
        pos.push(72 - vd);
        if (vd == 6) {
            pos = [];
            pos.push(0);
            pos.push(7);
            pos.push(14);
            pos.push(21);
            pos.push(28);
            pos.push(35);
        }
        return pos;
    },
    posCS6: function (pA, vd, nU, ndU, instance) {
        let mOptions = $eXeTrivial.options[instance],
            Ls = nU;
        if (nU == 0) Ls = 42;
        let rd = vd - (Ls - pA),
            pos = [],
            num = [0, -6, -5, -4, -3, -2, -1];
        if (num.indexOf(rd) != -1) {
            pos.push(pA + vd);
            if (mOptions.pT[pA].r == 12 && rd == 0) {
                pos[0] = 0;
            }
        } else {
            pos.push(pA + vd);
            pos.push(ndU - 1 + rd);
            if (nU == 0) pos[1] = rd;
        }
        return pos;
    },
    posCI6: function (pA, vd, nB, ndB) {
        let rd = vd - (pA - nB),
            pos = [],
            num = [0, -6, -5, -4, -3, -2, -1];
        if (num.indexOf(rd) != -1) {
            pos.push(pA - vd);
        } else {
            pos.push(Math.abs(pA - vd));
            pos.push(ndB - 1 + rd);
            if (nB == 0) {
                pos[0] = 42 - rd;
            }
            if (pA == nB && vd == 6) {
                pos[1] = 72;
            }
        }
        return pos;
    },
    posDS6: function (pacS, proS, daS) {
        let nodos = 0,
            rD = daS - (proS - pacS),
            pos = [],
            num = [0, -6, -5, -4, -3, -2, -1];
        if (num.indexOf(rD) != -1) {
            pos.push(pacS + daS);
        } else if (rD == 1) {
            pos.push(72);
        } else {
            for (let j = 1; j < 7; j++) {
                nodos = 46 + 5 * (j - 1);
                if (nodos != proS) {
                    pos.push(nodos - (rD - 2));
                }
            }
        }
        return pos;
    },
    posDI6: function (pA, nB, ndB, vd) {
        let rD = vd - (pA - nB),
            pos = [],
            num = [0, -6, -5, -4, -3, -2, -1];
        if (num.indexOf(rD) != -1) {
            pos.push(pA - vd);
        } else if (rD == 1) {
            pos.push(ndB);
        } else {
            pos.push(ndB + (rD - 1));
            pos.push(ndB - (rD - 1));
            if (ndB == 0) {
                pos[1] = 42 - (rD - 1);
            }
        }
        return pos;
    },
};
$(function () {
    $eXeTrivial.init();
});
