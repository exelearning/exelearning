/* eslint-disable no-undef */
/**
 * Periodic table activity (Export)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Author: Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 *
 */
var $periodicTable = {
    idevicePath: '',
    borderColors: {
        black: '#0e1625',
        blue: '#00008B',
        green: '#006400',
        red: '#8B0000',
        white: '#FFF',
        deepblue: '#3A75C4',
    },
    colors: {
        black: '#0e1625',
        blue: '00008B',
        green: '#006400',
        red: '#8B0000',
        white: '#ffffff',
        deepblue: '#3A75C4',
        grey: '#A9A9A9',
        incorrect: '#F22420',
        correct: '#3DA75A',
        game: 'rgba(0, 255, 0, 0.3)',
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
    colorsClass: {},

    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            'Periodic table',
            'periodic-table',
            'periodic-table-IDevice'
        );
    },

    repeatActivity: function () {
        //const mOptions = $periodicTable.options[instance];
    },

    showSolutions: function () {
        mOptions.solutionsShow = true;
    },

    enable: function () {
        $periodicTable.loadGame();
    },

    setTableData: function (instance) {
        const mOptions = $periodicTable.options[instance];
        $(`#ptTable-${instance}`)
            .find('.PTP-element')
            .each(function () {
                let number = parseInt($(this).data('number')) - 1;
                $(this).data('attempts', mOptions.attempts);
                $(this).data('state', '-1');
                const elements_data = $periodicTable.elements_dataf(instance);
                let data = elements_data[number];
                $(this).find('.PTP-atomic-mass').text(data.mass);
                $(this).find('.PTP-element-number').text(data.number);
                $(this).find('.PTP-element-name').text(data.name);
                $(this).find('.PTP-element-symbol').text(data.symbol);
            });
    },

    loadGame: function () {
        $periodicTable.options = [];

        $periodicTable.activities.each(function (i) {
            let dl = $('.periodic-table-DataGame', this),
                mOption = $periodicTable.loadDataGame(dl),
                msg = mOption.msgs.msgPlayStart;

            mOption.scorerp = 0;
            mOption.idevicePath = $periodicTable.idevicePath;
            mOption.main = 'ptMainContainer-' + i;
            mOption.idevice = 'periodic-table-IDevice';

            $periodicTable.options.push(mOption);

            const pt = $periodicTable.createInterfacePT(i);

            dl.before(pt).remove();

            $('#ptGameMinimize-' + i).hide();
            $('#ptGameContainer-' + i).hide();

            if (mOption.showMinimize) {
                $('#ptGameMinimize-' + i)
                    .css({
                        cursor: 'pointer',
                    })
                    .show();
            } else {
                $('#ptGameContainer-' + i).show();
            }

            $('#ptMessageMaximize-' + i).text(msg);
            $('#ptDivFeedBack-' + i).prepend(
                $('.periodic-table-feedback-game', this)
            );
            $('#ptDivFeedBack-' + i).hide();
            $periodicTable.setTableData(i);
            $periodicTable.addEvents(i);

            const $main = $('#ptMainContainer-' + i);
            const mainEL = $main.get(0);

            if (mainEL) {
                const resizeObs = new ResizeObserver(() => {
                    $periodicTable.adjustAllElementsFontSize(i);
                });
                resizeObs.observe(mainEL);
                $periodicTable.adjustAllElementsFontSize(i);
            }
        });

        const tableHtml = $('.periodic-table-IDevice').html();
        if ($exeDevices.iDevice.gamification.math.hasLatex(tableHtml)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '.periodic-table-IDevice'
            );
        }
    },

    loadDataGame: function (data) {
        let json = data.text();

        const mOptions =
            $exeDevices.iDevice.gamification.helpers.isJsonString(json);

        mOptions.groups = $periodicTable.getActiveGroups(mOptions.groups);
        mOptions.elements = $periodicTable.getActiveElements(mOptions.groups);
        mOptions.scorerp = 0;
        mOptions.hits = 0;
        mOptions.score = 0;
        mOptions.errors = 0;
        mOptions.modeGame = true;
        mOptions.activeQuestion = -1;
        mOptions.gameStarted = false;
        mOptions.solutionsShow = false;
        mOptions.evaluation =
            typeof mOptions.evaluation == 'undefined'
                ? false
                : mOptions.evaluation;
        mOptions.evaluationID =
            typeof mOptions.evaluationID == 'undefined'
                ? ''
                : mOptions.evaluationID;
        mOptions.id = typeof mOptions.id == 'undefined' ? false : mOptions.id;
        mOptions.gameOver = false;
        return mOptions;
    },

    getRandomElements: function (array, count) {
        if (array.length <= count) {
            const sfarray = array.sort(() => Math.random() - 0.5);
            return sfarray;
        }
        const shuffledArray = array.sort(() => Math.random() - 0.5);
        return shuffledArray.slice(0, count);
    },

    createInterfacePT: function (instance) {
        const mOptions = $periodicTable.options[instance];
        const path = $periodicTable.idevicePath,
            msgs = $periodicTable.options[instance].msgs,
            html = `
            <div class="PTP-MainContainer" id="ptMainContainer-${instance}">
                <div class="PTP-GameMinimize" id="ptGameMinimize-${instance}">
                    <a href="#" class="PTP-LinkMaximize" id="ptLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                        <img src="${path}periodic-table-icon.png" class="PTP-IconMinimize PTP-Activo" alt="">
                        <div class="PTP-MessageMaximize" id="ptMessageMaximize-${instance}"></div>
                    </a>
                </div>
                <div class="PTP-GameContainer" id="ptGameContainer-${instance}">                   
                    <div class="PTP-GameScoreBoard">
                        <div class="PTP-GameScores">
                            <div class="exeQuextIcons exeQuextIcons-Number" title="${msgs.msgNumQuestions}"></div>
                            <p><span class="sr-av">${msgs.msgNumQuestions}: </span><span id="ptNumber-${instance}">0</span></p>
                            <div class="exeQuextIcons exeQuextIcons-Hit" title="${msgs.msgHits}"></div>
                            <p><span class="sr-av">${msgs.msgHits}: </span><span id="ptHits-${instance}">0</span></p>
                            <div class="exeQuextIcons exeQuextIcons-Error" title="${msgs.msgErrors}"></div>
                            <p><span class="sr-av">${msgs.msgErrors}: </span><span id="ptErrors-${instance}">0</span></p>
                            <div class="exeQuextIcons exeQuextIcons-Score" title="${msgs.msgScore}"></div>
                            <p><span class="sr-av">${msgs.msgScore}: </span><span id="ptScore-${instance}">0</span></p>
                             <div class="exeQuextIcons exeQuextIcons-Life" title="${msgs.msgAttempts}"></div>
                            <p><span class="sr-av">${msgs.msgAttempts}: </span><span id="ptAttempts-${instance}">1</span></p>  
                        </div>
                        <div id="ptInfo"></div>
                        <div class="PTP-TimeNumber">                                         
                            <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Time" title="${msgs.msgTime}"></div>
                            <p id="ptPTime-${instance}" class="PTP-PTime">00:00</p>
                            <a href="#" class="PTP-LinkMinimize" id="ptLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                                <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                                <div class="exeQuextIcons exeQuextIcons-Minimize PTP-Activo"></div>
                            </a>
                            <a href="#" class="PTP-LinkFullScreen" id="ptLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                                <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                                <div class="exeQuextIcons exeQuextIcons-FullScreen PTP-Activo" id="ptFullScreen-${instance}"></div>
                            </a>
                        </div>
                    </div>                  
                    <div class="PTP-PShowClue" id="ptShowClue-${instance}">
                        <div class="sr-av">${msgs.msgClue}</div>
                        <p class="PTP-parpadea" id="ptPShowClue-${instance}"></p>
                    </div> 
                     <div class="PTP-Message" id="ptMessageDiv-${instance}">
                        <p id="ptMessage-${instance}"></p>
                    </div>                    
                    <div class="PTP-MultimediaDiv" id="ptMultimediaDiv-${instance}">
                        <div class="PTP-table-container">
                            ${$periodicTable.getPeriodicTable(instance)}                      
                        </div>
                    </div>              
                    <div class="PTP-Buttons">                   
                        <a href="#" id="ptReboot-${instance}" class="PTP-Boton">${msgs.msgReboot}</a>
                    </div>           
                    <div class="PTP-Cubierta" id="ptCubierta-${instance}" style="display:none">
                        <div class="PTP-CodeAccessDiv" id="ptCodeAccessDiv-${instance}">
                            <div class="PTP-MessageCodeAccessE" id="ptMesajeAccesCodeE-${instance}"></div>
                            <div class="PTP-DataCodeAccessE">
                                <label for="ptCodeAccessE-${instance}" class="sr-av">${msgs.msgCodeAccess}:</label>
                                <input type="text" class="PTP-CodeAccessE form-control" id="ptCodeAccessE-${instance}" placeholder="${msgs.msgCodeAccess}">
                                <a href="#" id="ptCodeAccessButton-${instance}" title="${msgs.msgReply}">
                                    <strong><span class="sr-av">${msgs.msgReply}</span></strong>
                                    <div class="exeQuextIcons-Submit PTP-Activo"></div>
                                </a>
                            </div>                          
                        </div>
                         <div class="PTP-DivFeedBack" id="ptDivFeedBack-${instance}">
                            <input type="button" id="ptFeedBackClose-${instance}" value="${msgs.msgClose}" class="feedbackbutton" style="cursor:pointer;" />
                        </div>
                    </div>
                </div>
            </div>
            ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}
        `;
        return html;
    },

    updateGameBoard: function (instance) {
        const mOptions = $periodicTable.options[instance];
        const score = (mOptions.hits * 10) / mOptions.number;
        $(`#ptHits-${instance}`).text(mOptions.hits);
        $(`#ptErrors-${instance}`).text(mOptions.errors);
        $(`#ptNumber-${instance}`).text(
            mOptions.number - mOptions.hits - mOptions.errors
        );
        $(`#ptScore-${instance}`).text(score.toFixed(2));
        $(`#ptAttempts-${instance}`).text(mOptions.attemptsGame);
        if (mOptions.gameStarted) {
            $periodicTable.saveEvaluation(instance);
            if (mOptions.isScorm == 1) {
                $periodicTable.sendScore(true, instance);
            }
        }
    },

    adjustAllElementsFontSize: function (instance) {
        $(`#ptMainContainer-${instance}`)
            .find('.PTP-element')
            .each(function () {
                const $el = $(this);
                const w = $el.width();
                const h = $el.height();
                const minDimension = Math.min(w, h);
                const fontSizeLimits = {
                    'PTP-element-number': { min: 0.5, max: 1.5 },
                    'PTP-element-symbol': { min: 0.9, max: 2.5 },
                    'PTP-element-name': { min: 0.5, max: 1.5 },
                };

                $el.find('span').each(function () {
                    const $span = $(this);
                    const className = $span.attr('class');

                    if (fontSizeLimits[className]) {
                        const limits = fontSizeLimits[className];

                        let sizeFactor;
                        switch (className) {
                            case 'PTP-element-number':
                                sizeFactor = 0.25;
                                break;
                            case 'PTP-element-symbol':
                                sizeFactor = 0.4;
                                break;
                            case 'PTP-element-name':
                                sizeFactor = 0.2;
                                break;
                            default:
                                sizeFactor = 0.2;
                        }
                        let newSize = (minDimension * sizeFactor) / 16;
                        newSize = Math.max(
                            limits.min,
                            Math.min(newSize, limits.max)
                        );
                        $span.css('font-size', `${newSize}em`);
                    }
                });
            });
    },

    saveEvaluation: function (instance) {
        const mOptions = $periodicTable.options[instance];
        mOptions.scorerp = (mOptions.hits * 10) / mOptions.number;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $periodicTable.isInExe
        );
    },

    sendScore: function (auto, instance) {
        const mOptions = $periodicTable.options[instance];

        mOptions.scorerp = (mOptions.hits * 10) / mOptions.number;
        mOptions.previousScore = $periodicTable.previousScore;
        mOptions.userName = $periodicTable.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $periodicTable.previousScore = mOptions.previousScore;
    },

    removeEvents: function (instance) {
        $('#ptReboot-' + instance).off('click');
        $('#ptLinkMaximize-' + instance).off('click');
        $('#ptLinkMinimize-' + instance).off('click');
        $('#ptLinkFullScreen-' + instance).off('click');
        $('#ptFeedBackClose-' + instance).off('click');
        $('#ptCodeAccessButton-' + instance).off('click');
        $('#ptCodeAccessE-' + instance).off('keydown');
        $('#ptMainContainer-' + instance)
            .closest('.idevice_node')
            .off('click', '.Games-SendScore');
        $('#ptStartGame-' + instance).off('click');
        $('#ptStartGameMobile-' + instance).off('click');
        $(window).off('unload.PeriodicTable beforeunload.PeriodicTable');
    },

    addEvents: function (instance) {
        $periodicTable.removeEvents(instance);

        const mOptions = $periodicTable.options[instance],
            $mainContainer = $('#ptMainContainer-' + instance);

        $('#ptReboot-' + instance).hide();

        $('#ptReboot-' + instance).on('click', function (e) {
            e.preventDefault();
            $('#ptReboot-' + instance).hide();
            $periodicTable.repeatActivity(instance);
        });

        $('#ptLinkMaximize-' + instance).on('click touchstart', function (e) {
            e.preventDefault();
            $('#ptGameContainer-' + instance).show();
            $('#ptGameMinimize-' + instance).hide();
        });

        $('#ptLinkMinimize-' + instance).on('click touchstart', function (e) {
            e.preventDefault();
            $('#ptGameContainer-' + instance).hide();
            $('#ptGameMinimize-' + instance)
                .css('visibility', 'visible')
                .show();
        });

        $('#ptGamerOver-' + instance).hide();
        $('#ptCodeAccessDiv-' + instance).hide();

        $('#ptLinkFullScreen-' + instance).on('click touchstart', function (e) {
            e.preventDefault();
            const element = document.getElementById(
                'ptGameContainer-' + instance
            );
            $exeDevices.iDevice.gamification.helpers.toggleFullscreen(element);
        });

        $('#ptFeedBackClose-' + instance).on('click', function (e) {
            e.preventDefault();
            $periodicTable.showCubiertaOptions(instance, false);
        });

        $('#ptShowClue-' + instance).hide();
        if (mOptions.itinerary.showCodeAccess) {
            $('#ptMesajeAccesCodeE-' + instance).text(
                mOptions.itinerary.messageCodeAccess
            );
            $('#ptCodeAccessDiv-' + instance).show();
            $periodicTable.showCubiertaOptions(instance, 0);
        }

        $('#ptCodeAccessButton-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $periodicTable.enterCodeAccess(instance);
            }
        );

        $('#ptCodeAccessE-' + instance).on('keydown', function (event) {
            if (event.which == 13 || event.keyCode == 13) {
                $periodicTable.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        $('#ptPNumber-' + instance).text(mOptions.number);

        $(window).on(
            'unload.PeriodicTable beforeunload.PeriodicTable',
            function () {
                if ($periodicTable.mScorm) {
                    $exeDevices.iDevice.gamification.scorm.endScorm(
                        $periodicTable.mScorm
                    );
                }
            }
        );

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        $('#ptMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $periodicTable.sendScore(false, instance);
                $periodicTable.saveEvaluation(instance);
            });

        $('#ptStartGame-' + instance).on('click', function (e) {
            e.preventDefault();
            $periodicTable.startGame(instance);
        });

        $('#ptStartGameMobile-' + instance).on('click', function (e) {
            e.preventDefault();
            $periodicTable.startGame(instance);
        });

        $('#ptStartGameMobile-' + instance).show();

        $('#ptStartGame-' + instance).show();
        $('#ptShowDefinitions-' + instance).hide();

        $mainContainer.find('.exeQuextIcons-Time').hide();
        $('#ptPTime-' + instance).hide();

        $(`#ptNumberInput-${instance}`).on('input', function () {
            this.value = this.value.replace(/[^0-9]/g, '');
            $(`#ptNumberBig-${instance}`).text(this.value);
            $(`#ptNumberBig-${instance}`).css({ color: '' });
        });

        $(`#ptNameInput-${instance}`).on('input', function () {
            this.value = this.value.replace(/[^A-Za-záéíóúÁÉÍÓÚñÑ\s]/g, '');
            $(`#ptNameBig-${instance}`).text(this.value);
            $(`#ptNameBig-${instance}`).css({ color: '' });
        });

        $(`#ptSymbolInput-${instance}`).on('input', function () {
            this.value = this.value.replace(/[^A-Za-z]/g, '').substring(0, 2);
            if (this.value.length > 0)
                this.value =
                    this.value[0].toUpperCase() +
                    this.value.slice(1).toLowerCase();
            $(`#ptSymbolBig-${instance}`).text(this.value);
            $(`#ptSymbolBig-${instance}`).css({ color: '' });
        });
        $(`#ptConfigurationInput-${instance}`).on('input', function () {
            this.value = this.value.replace(/[^0-9spdf\s]/gi, '');
            $(`#ptConfigurationBig-${instance}`).text(this.value);
        });

        $(`#pOxidationInput-${instance}`).on('input', function () {
            this.value = this.value.replace(/[^0-9,+-]/g, '');
            $(`#ptOxitationBig-${instance}`).text(this.value);
        });

        $(`#ptGroupsSelect-${instance}`).on('change', function () {
            const selectedText = $(this).find('option:selected').text();
            $(`#ptGroupBig-${instance}`).text(selectedText);
        });

        $(`#ptAcceptButton-${instance}`)
            .off('click')
            .on('click', function () {
                $periodicTable.setCompleteScore(instance);
            });
        $(`#ptAcceptButtonMobile-${instance}`)
            .off('click')
            .on('click', function () {
                $periodicTable.setMobileScore(instance);
            });

        $(`#ptCancelButton-${instance}`)
            .off('click')
            .on('click', function () {
                $periodicTable.showMessage(
                    4,
                    mOptions.msgs.msgOneElement,
                    instance
                );
                $(`#ptlLightbox-${instance}`).fadeOut();
            });

        $('#ptMainContainer-' + instance).on(
            'click',
            '.PTP-game-mode',
            function () {
                if (
                    !mOptions.gameStarted ||
                    mOptions.gameOver ||
                    mOptions.activateGame
                )
                    return;
                $periodicTable.setScore(instance, $(this));
            }
        );

        $('#ptMainContainer-' + instance).on(
            'click',
            '.PTP-complete-mode',
            function () {
                if (
                    !mOptions.gameStarted ||
                    mOptions.gameOver ||
                    mOptions.activateGame
                )
                    return;
                $periodicTable.showElementBigComplete(instance, $(this));
            }
        );

        if (mOptions.attempts < 2) {
            $('#ptAttempts-' + instance).hide();
            $('#ptMainContainer-' + instance)
                .find('.exeQuextIcons-Life')
                .hide();
        }
        mOptions.colorsClass = $periodicTable.getClassColor(instance);
        $periodicTable.updateTime(mOptions.time * 60, instance);
        $periodicTable.updateGameBoard(instance);

        setTimeout(function () {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                this.isInExe
            );
        }, 500);
    },

    showElementBigMobile: function (instance) {
        const mOptions = $periodicTable.options[instance];
        mOptions.activeQuestion = mOptions.gameElements[mOptions.active];
        const number = mOptions.activeQuestion.number;
        $(`#ptAcceptButtonMobile-${instance}`).prop('disabled', false);
        $(`#ptNumberInput-${instance}`).prop('disabled', false);
        $(`#ptNameInput-${instance}`).prop('disabled', false);
        $(`#ptSymbolInput-${instance}`).prop('disabled', false);

        const elements_data = $periodicTable.elements_dataf(instance);
        const dataelement = elements_data[parseInt(number) - 1];

        $(`#ptGroupBig-${instance}`).text(dataelement.group);
        let $elment = $(`#ptNumberBig-${instance}`);
        if (mOptions.gameType === 1) {
            $elment = $(`#ptNameBig-${instance}`);
        } else if (mOptions.gameType === 2) {
            $elment = $(`#ptSymbolBig-${instance}`);
        }

        $elment.css({ color: '' });

        $(`#ptNumberBig-${instance}`).text(
            mOptions.gameType !== 0 ? dataelement.number : ''
        );
        $(`#ptNameBig-${instance}`).text(
            mOptions.gameType !== 1 ? dataelement.name : ''
        );
        $(`#ptSymbolBig-${instance}`).text(
            mOptions.gameType !== 2 ? dataelement.symbol : ''
        );
        $(`#ptConfigurationBig-${instance}`).text(dataelement.configuration);
        $(`#ptMassBig-${instance}`).text(dataelement.mass);
        $(`#ptEletroNegatyvityBig-${instance}`).text(
            dataelement.electronegativity
        );
        $(`#ptNumberInputDiv-${instance}`).hide();
        $(`#ptSymbolInputDiv-${instance}`).hide();
        $(`#ptNameInputDiv-${instance}`).hide();
        $(`#ptGroupSelectDiv-${instance}`).hide();

        if (mOptions.gameType === 0) {
            $(`#ptNumberInput-${instance}`).val('');
            $(`#ptNumberInputDiv-${instance}`).show();
        }
        if (mOptions.gameType === 1) {
            $(`#ptNameInput-${instance}`).val('');
            $(`#ptNameInputDiv-${instance}`).show();
        }
        if (mOptions.gameType === 2) {
            $(`#ptSymbolInput-${instance}`).val('');
            $(`#ptSymbolInputDiv-${instance}`).show();
        }
        $(`#ptOxitationBig-${instance}`).empty();

        const oxidations = dataelement.oxidation.split(',');
        for (let i = 0; i < oxidations.length; i++) {
            let span = `<span class="PTP-oxidation-big">${oxidations[i]}</span>`;
            $(`#ptOxitationBig-${instance}`).append(span);
        }
        const bkcolor = mOptions.colorsClass[dataelement.group];
        $(`#ptElementBoxBix-${instance}`)
            .removeClass()
            .addClass('PTP-element-box-big ' + bkcolor);
        $(`#ptlLightboxMobile-${instance}`).css('display', 'flex');
    },

    showElementBigComplete: function (instance, $element) {
        const mOptions = $periodicTable.options[instance];
        const number = $element.data('number');
        const state = $element.data('state');

        $(`#ptNumberDiv-${instance}`).prop('disabled', state != -1);
        $(`#ptNameInput-${instance}`).prop('disabled', state != -1);
        $(`#ptSymbolInput-${instance}`).prop('disabled', state != -1);
        $(`#ptGroupsSelect-${instance}`).prop('disabled', state != -1);
        $(`#ptAcceptButton-${instance}`).prop('disabled', false);

        const elements_data = $periodicTable.elements_dataf(instance);
        const dataelement = elements_data[parseInt(number) - 1];
        mOptions.dataSearchElement = dataelement;
        mOptions.clickedElement = $element;

        $(`#ptGroupBig-${instance}`).text(
            !mOptions.types[3] ? dataelement.group : ''
        );
        $(`#ptNumberBig-${instance}`).text(
            !mOptions.types[0] ? dataelement.number : ''
        );
        $(`#ptNameBig-${instance}`).text(
            !mOptions.types[1] ? dataelement.name : ''
        );
        $(`#ptSymbolBig-${instance}`).text(
            !mOptions.types[2] ? dataelement.symbol : ''
        );
        $(`#ptConfigurationBig-${instance}`).text(
            !mOptions.types[4] ? dataelement.configuration : ''
        );
        $(`#ptMassBig-${instance}`).text(dataelement.mass);
        $(`#ptEletroNegatyvityBig-${instance}`).text(
            dataelement.electronegativity
        );
        $(`#ptNumberInputDiv-${instance}`).hide();
        $(`#ptSymbolInputDiv-${instance}`).hide();
        $(`#ptNameInputDiv-${instance}`).hide();
        $(`#ptGroupSelectDiv-${instance}`).hide();

        //$(`#ptConfigurationInputDiv-${instance}`).hide();
        //$(`#ptOxidationsInputDiv-${instance}`).hide();

        if (mOptions.types[0]) {
            $(`#ptNumberInput-${instance}`).val('');
            $(`#ptNumberInputDiv-${instance}`).show();
        }
        if (mOptions.types[1]) {
            $(`#ptNameInput-${instance}`).val('');
            $(`#ptNameInputDiv-${instance}`).show();
        }
        if (mOptions.types[2]) {
            $(`#ptSymbolInput-${instance}`).val('');
            $(`#ptSymbolInputDiv-${instance}`).show();
        }
        if (mOptions.types[3]) {
            $(`#ptGroupsSelect-${instance}`).val('-1');
            $(`#ptGroupSelectDiv-${instance}`).show();
        }
        $(`#ptOxitationBig-${instance}`).empty();
        if (!mOptions.types[5]) {
            const oxidations = dataelement.oxidation.split(',');
            for (let i = 0; i < oxidations.length; i++) {
                let span = `<span class="PTP-oxidation-big">${oxidations[i]}</span>`;
                $(`#ptOxitationBig-${instance}`).append(span);
            }
        }

        let bkcolor = window.getComputedStyle(
            mOptions.clickedElement.closest('td')[0]
        ).backgroundColor;
        $(`#ptElementBoxBix-${instance}`).css({ 'background-color': bkcolor });
        $(`#ptlLightbox-${instance}`).css('display', 'flex');

        if (state != -1) {
            $periodicTable.showMessage(
                3,
                'Ya has completado los datos de elemento',
                instance
            );
            $periodicTable.desactivateBigElement(instance, number);
        }
    },
    desactivateBigElement: function (instance, number) {
        const mOptions = $periodicTable.options[instance];
        const completedData = $periodicTable.getCompletedData(instance, number);
        const elements_data = $periodicTable.elements_dataf(instance);
        const dataelement = elements_data[parseInt(number) - 1];

        $(`#ptAcceptButton-${instance}`).prop('disabled', true);
        $(`#ptNumberInput-${instance}`).val(completedData.number);
        $(`#ptNameInput-${instance}`).val(completedData.name);
        $(`#ptSymbolInput-${instance}`).val(completedData.symbol);
        $(`#ptGroupsSelect-${instance}`).val(completedData.group);

        $(`#ptNumberBig-${instance}`).text(
            !mOptions.types[0] ? dataelement.number : completedData.number
        );
        $(`#ptNameBig-${instance}`).text(
            !mOptions.types[1] ? dataelement.name : completedData.name
        );
        $(`#ptSymbolBig-${instance}`).text(
            !mOptions.types[2] ? dataelement.symbol : completedData.symbol
        );
        $(`#ptGroupBig-${instance}`).text(
            !mOptions.types[3] ? dataelement.group : ''
        );

        let scolor = '';
        $(`#ptNumberInput-${instance}`).css('color', scolor);
        $(`#ptNumberBig-${instance}`).css('color', scolor);
        $(`#ptNameInput-${instance}`).css('color', scolor);
        $(`#ptNameBig-${instance}`).css('color', scolor);
        $(`#ptSymbolInput-${instance}`).css('color', scolor);
        $(`#ptSymbolBig-${instance}`).css('color', scolor);
        $(`#ptSymbolInput-${instance}`).css('color', scolor);
        $(`#ptSymbolBig-${instance}`).css('color', scolor);
        if (mOptions.types[0]) {
            scolor =
                dataelement.number == completedData.number
                    ? $periodicTable.colors.green
                    : $periodicTable.colors.red;
            $(`#ptNumberInput-${instance}`).css('color', scolor);
            $(`#ptNumberBig-${instance}`).css('color', scolor);
        }
        if (mOptions.types[1]) {
            scolor =
                dataelement.name == completedData.name
                    ? $periodicTable.colors.green
                    : $periodicTable.colors.red;
            $(`#ptNameInput-${instance}`).css('color', scolor);
            $(`#ptNameBig-${instance}`).css('color', scolor);
        }

        if (mOptions.types[2]) {
            scolor =
                dataelement.symbol == completedData.symbol
                    ? $periodicTable.colors.green
                    : $periodicTable.colors.red;
            $(`#ptSymbolInput-${instance}`).css('color', scolor);
            $(`#ptSymbolBig-${instance}`).css('color', scolor);
        }

        if (mOptions.types[3]) {
            tgroupt = $(
                `#ptGroupsSelect-${instance} option[value="${completedData.group}"]`
            ).text();
            scolor =
                tgroupt == dataelement.group
                    ? $periodicTable.colors.green
                    : $periodicTable.colors.red;
            $(`#ptGroupsSelect-${instance}`).css('color', scolor);
            $(`#ptGroupBig-${instance}`).css('color', scolor);
            $(`#ptGroupBig-${instance}`).text(tgroupt);
        }

        $(`#ptNameInput-${instance}`).val(completedData.number);
        $(`#ptNameInput-${instance}`).val(completedData.name);
        $(`#ptSymbolInput-${instance}`).val(completedData.symbol);
        $(`#ptGroupsSelect-${instance}`).val(completedData.group);

        $(`#ptNumberBig-${instance}`).text(
            !mOptions.types[0] ? dataelement.number : completedData.number
        );
        $(`#ptNameBig-${instance}`).text(
            !mOptions.types[1] ? dataelement.name : completedData.name
        );
        $(`#ptSymbolBig-${instance}`).text(
            !mOptions.types[2] ? dataelement.symbol : completedData.symbol
        );
        $(`#ptGroupBig-${instance}`).text(
            !mOptions.types[3] ? dataelement.group : tgroupt
        );
    },

    setCompleteScore: function (instance) {
        const mOptions = $periodicTable.options[instance];
        const msgs = mOptions.msgs;
        const numberValue = $(`#ptNumberInput-${instance}`).val().trim();
        const nameValue = $(`#ptNameInput-${instance}`).val().trim();
        const symbolValue = $(`#ptSymbolInput-${instance}`).val().trim();
        const groupValue = $(`#ptGroupsSelect-${instance}`).val();
        const groupText = $(
            `#ptGroupsSelect-${instance} option:selected`
        ).text();
        let attempts = mOptions.attempts
            ? parseInt(mOptions.clickedElement.data('attempts'))
            : 10000;
        let correct = [true, true, true, true];

        if (mOptions.types[0]) {
            if (!/^(1[0-1][0-8]|[1-9][0-9]?|0)$/.test(numberValue)) {
                $periodicTable.showMessage(1, msgs.msgNumberValid, instance);
                return;
            }
            correct[0] = numberValue == mOptions.dataSearchElement.number;
        }
        if (mOptions.types[1]) {
            if (!/^[A-Za-záéíóúÁÉÍÓÚñÑ]+$/.test(nameValue)) {
                $periodicTable.showMessage(1, msgs.msgNameValid, instance);
                return;
            }
            correct[1] = nameValue == mOptions.dataSearchElement.name;
        }
        if (mOptions.types[2]) {
            if (!/^[A-Z][a-z]?$/.test(symbolValue)) {
                $periodicTable.showMessage(1, msgs.msgSymbolValid, instance);
                return;
            }
            correct[2] = symbolValue == mOptions.dataSearchElement.symbol;
        }
        if (mOptions.types[3]) {
            if (groupValue == -1) {
                $periodicTable.showMessage(1, msgs.msgGroupValid, instance);
                return;
            }
            correct[3] = groupText == mOptions.dataSearchElement.group;
        }

        if (correct.every((elemento) => elemento === true)) {
            mOptions.hits++;
            mOptions.clickedElement.data('state', 1);
            mOptions.active++;
            $periodicTable.showMessage(
                2,
                mOptions.msgs.msgOtherElement,
                instance
            );
            if (mOptions.active >= mOptions.number) {
                $periodicTable.gameOver(instance);
            }
        } else {
            attempts--;
            mOptions.clickedElement.data('attempts', attempts);
            if (attempts > 0) {
                let msgattemps =
                    mOptions.attempts > 1 ? mOptions.msgs.msgNotOK : '';
                $periodicTable.showMessage(1, msgattemps, instance);
                return;
            }
            mOptions.errors++;
            mOptions.active++;
            mOptions.clickedElement.data('state', 0);
            if (mOptions.active < mOptions.number) {
                let msgattemps1 =
                    mOptions.attempts > 1
                        ? mOptions.msgs.msgNotAttempts
                        : mOptions.msgs.msgOtherEQ;
                $periodicTable.showMessage(1, msgattemps1, instance);
            } else {
                $periodicTable.gameOver(instance);
            }
        }
        let color = correct[0]
            ? $periodicTable.colors.green
            : $periodicTable.colors.red;
        mOptions.clickedElement.find('.PTP-element-number').css('color', color);
        color = correct[1]
            ? $periodicTable.colors.green
            : $periodicTable.colors.red;
        mOptions.clickedElement.find('.PTP-element-name').css('color', color);
        color = correct[2]
            ? $periodicTable.colors.green
            : $periodicTable.colors.red;
        mOptions.clickedElement.find('.PTP-element-symbol').css('color', color);
        mOptions.clickedElement
            .find('.PTP-element-number')
            .text(mOptions.dataSearchElement.number);
        mOptions.clickedElement
            .find('.PTP-element-name')
            .text(mOptions.dataSearchElement.name);
        mOptions.clickedElement
            .find('.PTP-element-symbol')
            .text(mOptions.dataSearchElement.symbol);
        $periodicTable.updateGameBoard(instance);
        $periodicTable.completed(
            instance,
            mOptions.dataSearchElement.number,
            numberValue,
            nameValue,
            symbolValue,
            groupValue
        );
        $periodicTable.desactivateBigElement(
            instance,
            mOptions.dataSearchElement.number
        );
        $(`#ptCancelButton-${instance}`).prop('disabled', true);
        setTimeout(function () {
            $(`#ptlLightbox-${instance}`).fadeOut();
            $(`#ptCancelButton-${instance}`).prop('disabled', false);
        }, 3000);
    },

    setMobileScore: function (instance) {
        const mOptions = $periodicTable.options[instance];
        const msgs = mOptions.msgs;
        const $number = $(`#ptNumberInput-${instance}`);
        const $name = $(`#ptNameInput-${instance}`);
        const $symbol = $(`#ptSymbolInput-${instance}`);
        const $accept = $(`#ptAcceptButtonMobile-${instance}`);

        const numberValue = $number.val().trim();
        const nameValue = $name.val().trim();
        const symbolValue = $symbol.val().trim();

        let correct = false;
        let $elment = $(`#ptNumberBig-${instance}`);
        if (mOptions.gameType === 1) {
            $elment = $(`#ptNameBig-${instance}`);
        } else if (mOptions.gameType === 2) {
            $elment = $(`#ptSymbolBig-${instance}`);
        }
        if (mOptions.gameType == 0) {
            if (!/^(1[0-1][0-8]|[1-9][0-9]?|0)$/.test(numberValue)) {
                $periodicTable.showMessage(1, msgs.msgNumberValid, instance);
                return false;
            }
            correct = numberValue == mOptions.activeQuestion.number;
        } else if (mOptions.gameType == 1) {
            if (!/^[A-Za-záéíóúÁÉÍÓÚñÑ]+$/.test(nameValue)) {
                $periodicTable.showMessage(1, msgs.msgNameValid, instance);
                return;
            }
            correct = nameValue == mOptions.activeQuestion.name;
        } else if (mOptions.gameType == 2) {
            if (!/^[A-Z][a-z]?$/.test(symbolValue)) {
                $periodicTable.showMessage(1, msgs.msgSymbolValid, instance);
                return;
            }
            correct = symbolValue == mOptions.activeQuestion.symbol;
        }

        if (correct) {
            mOptions.hits++;
            mOptions.active++;
            $elment.css({ color: '#157347' });
            let msg = $periodicTable.getRetroFeedMessages(true, instance);
            $periodicTable.showMessage(2, msg, instance);
            $accept.prop('disabled', true);
            $number.prop('disabled', true);
            $name.prop('disabled', true);
            $symbol.prop('disabled', true);
            setTimeout(function () {
                if (mOptions.active >= mOptions.number) {
                    $periodicTable.gameMobileOver(instance);
                } else {
                    $periodicTable.showMobileQuestion(instance);
                }
            }, 5000);
        } else {
            mOptions.attemptsGame--;
            $elment.css({ color: '#ff0000' });
            if (mOptions.attemptsGame > 0) {
                let msg = `${$periodicTable.getRetroFeedMessages(false, instance)} ${mOptions.msgs.msgNewTry}`;
                $periodicTable.showMessage(1, msg, instance);
                $number.val('');
                $name.val('');
                $symbol.val('');
            } else {
                let msgattemps1 =
                    mOptions.attempts > 1
                        ? mOptions.msgs.msgNotAttempts
                        : mOptions.msgs.msgNotAttemptsEQ;
                let msg = `${$periodicTable.getRetroFeedMessages(false, instance)} ${msgattemps1}`;
                $periodicTable.showMessage(1, msg, instance);
                mOptions.errors++;
                mOptions.active++;
                $accept.prop('disabled', true);
                $number.prop('disabled', true);
                $name.prop('disabled', true);
                $symbol.prop('disabled', true);
                setTimeout(function () {
                    if (mOptions.active >= mOptions.number) {
                        $periodicTable.gameMobileOver(instance);
                    } else {
                        $periodicTable.showMobileQuestion(instance);
                    }
                }, 5000);
            }
        }

        $periodicTable.updateGameBoard(instance);
    },

    completed: function (instance, id, number, name, symbol, group) {
        const mOptions = $periodicTable.options[instance];
        const element = {
            id: id,
            number: number,
            name: name,
            symbol: symbol,
            group: group,
        };
        mOptions.completedElements.push(element);
    },

    getCompletedData: function (instance, id) {
        const mOptions = $periodicTable.options[instance];
        const search = mOptions.completedElements.find((item) => item.id == id);
        if (search) {
            return search;
        }
        return {
            id: number,
            number: '',
            name: '',
            symbol: '',
            group: '-1',
        };
    },

    setScore: function (instance, $element) {
        const mOptions = $periodicTable.options[instance];
        const num = mOptions.elements[mOptions.active];
        const elements_data = $periodicTable.elements_dataf(instance);
        const element_data = elements_data[num - 1];
        const $number = $element.find('.PTP-element-number');
        const $name = $element.find('.PTP-element-name');
        const $symbol = $element.find('.PTP-element-symbol');
        const $solution_element = $(`#ptMainContainer-${instance}`)
            .find(`.PTP-element[data-number="${num}"]`)
            .eq(0);
        const $symbols = $solution_element.find('.PTP-element-symbol');
        const $numbers = $solution_element.find('.PTP-element-number');
        const $names = $solution_element.find('.PTP-element-name');

        const number = $element.data('number');

        mOptions.activateGame = true;
        if (num == number) {
            mOptions.hits++;

            if (mOptions.gameType == 0) {
                $periodicTable.showElement($number, element_data.number, true);
            } else if (mOptions.gameType == 1) {
                $periodicTable.showElement($name, element_data.name, true);
            } else if (mOptions.gameType == 2) {
                $periodicTable.showElement($symbol, element_data.symbol, true);
            }
            mOptions.active++;
            $periodicTable.showMessage(2, mOptions.msgs.msgIsOKEQ, instance);
            if (mOptions.active >= mOptions.number) {
                setTimeout(function () {
                    $periodicTable.gameOver(instance);
                }, 3000);
            } else {
                setTimeout(function () {
                    $periodicTable.showQuestion(instance);
                }, 3000);
            }
        } else {
            const clicked_element = elements_data[parseInt(number) - 1];
            let dataclicked = '';
            if (mOptions.gameType == 0) {
                dataclicked = clicked_element.number;
            } else if (mOptions.gameType == 1) {
                dataclicked = clicked_element.name;
            } else if (mOptions.gameType == 2) {
                dataclicked = clicked_element.symbol;
            }
            mOptions.attemptsGame--;
            let msAtp = mOptions.msgs.msgIsErrorAt
                .replace('%s', dataclicked)
                .replace('%d', mOptions.attemptsGame);

            let msgattemps = mOptions.attempts > 1 ? msAtp : '';

            $periodicTable.showMessage(1, msgattemps, instance);
            mOptions.activateGame = false;
            if (mOptions.attemptsGame === 0) {
                mOptions.errors++;
                mOptions.active++;
                mOptions.activateGame = true;
                if (mOptions.gameType == 0) {
                    $solution_element.cc;
                    $periodicTable.showElement(
                        $numbers,
                        element_data.number,
                        false
                    );
                } else if (mOptions.gameType == 1) {
                    $periodicTable.showElement(
                        $names,
                        element_data.name,
                        false
                    );
                } else if (mOptions.gameType == 2) {
                    $periodicTable.showElement(
                        $symbols,
                        element_data.symbol,
                        false
                    );
                }
                if (mOptions.active < mOptions.number) {
                    let msgattemps1 =
                        mOptions.attempts > 1
                            ? mOptions.msgs.msgIsEndAttempts
                            : '';
                    let msgattemps2 = mOptions.msgs.mgsNotOkClick.replace(
                        '%s',
                        dataclicked
                    );
                    let msg2 = msgattemps2 + ' ' + msgattemps1;
                    $periodicTable.showMessage(1, msg2, instance);
                    setTimeout(function () {
                        $periodicTable.showQuestion(instance);
                    }, 3000);
                } else {
                    let msg3 = mOptions.msgs.mgsNotOkClick.replace(
                        '%s',
                        dataclicked
                    );
                    $periodicTable.showMessage(1, msg3);
                    setTimeout(function () {
                        $periodicTable.gameOver(instance);
                    }, 3000);
                }
            }
        }

        $periodicTable.updateGameBoard(instance);
    },

    showElement: function ($elemento, texto, correct = true) {
        let color = correct ? '#006400' : '#8B0000';
        $elemento.text(texto);
        $elemento.css({
            visibility: 'visible',
            color: color,
        });
    },

    showMobileQuestion: function (instance) {
        const mOptions = $periodicTable.options[instance];
        mOptions.activeQuestion = mOptions.gameElements[mOptions.active];
        mOptions.attemptsGame =
            mOptions.attempts === 0 ? 100000 : mOptions.attempts;

        mOptions.activateGame = false;
        $periodicTable.showElementBigMobile(instance);
        $periodicTable.updateGameBoard(instance);
        $periodicTable.showMessage(3, mOptions.msgs.mgsCompleteEQ, instance);
    },
    getRetroFeedMessages: function (iHit, instance) {
        const mOptions = $periodicTable.options[instance],
            msgs = mOptions.msgs,
            sMessages = iHit
                ? msgs.msgSuccesses.split('|')
                : msgs.msgFailures.split('|');
        return sMessages[Math.floor(Math.random() * sMessages.length)];
    },

    showQuestion: function (instance) {
        const mOptions = $periodicTable.options[instance];
        mOptions.activeQuestion = mOptions.gameElements[mOptions.active];
        mOptions.attemptsGame =
            mOptions.attempts === 0 ? 100000 : mOptions.attempts;
        let label = '',
            data = '';
        if (mOptions.gameType == 0) {
            label = mOptions.msgs.msgNumberClick;
            data = mOptions.activeQuestion.number;
        } else if (mOptions.gameType == 1) {
            label = mOptions.msgs.msgNameClick;
            data = mOptions.activeQuestion.name;
        } else if (mOptions.gameType == 2) {
            label = mOptions.msgs.msgSymbolClick;
            data = mOptions.activeQuestion.symbol;
        }

        mOptions.activateGame = false;

        $(`#ptQuestionLabel-${instance}`).text(label);
        $(`#ptQuestionData-${instance}`).text(data);
        $(`#ptQuestionP-${instance}`).show();
        $periodicTable.updateGameBoard(instance);
        $periodicTable.showMessage(0, '', instance);
    },

    getActiveGroups: function (arr) {
        if (arr[0] === 1) {
            return Array(arr.length - 1).fill(1);
        } else {
            return arr.slice(1);
        }
    },

    getGroupsElements: function () {
        const elementGroups = [
            {
                name: 'Alkali Metals',
                elements: [
                    { number: 3, symbol: 'Li' },
                    { number: 11, symbol: 'Na' },
                    { number: 19, symbol: 'K' },
                    { number: 37, symbol: 'Rb' },
                    { number: 55, symbol: 'Cs' },
                    { number: 87, symbol: 'Fr' },
                ],
            },
            {
                name: 'Alkaline Earth Metals',
                elements: [
                    { number: 4, symbol: 'Be' },
                    { number: 12, symbol: 'Mg' },
                    { number: 20, symbol: 'Ca' },
                    { number: 38, symbol: 'Sr' },
                    { number: 56, symbol: 'Ba' },
                    { number: 88, symbol: 'Ra' },
                ],
            },
            {
                name: 'Transition Metals',
                elements: [
                    { number: 21, symbol: 'Sc' },
                    { number: 22, symbol: 'Ti' },
                    { number: 23, symbol: 'V' },
                    { number: 24, symbol: 'Cr' },
                    { number: 25, symbol: 'Mn' },
                    { number: 26, symbol: 'Fe' },
                    { number: 27, symbol: 'Co' },
                    { number: 28, symbol: 'Ni' },
                    { number: 29, symbol: 'Cu' },
                    { number: 30, symbol: 'Zn' },
                    { number: 39, symbol: 'Y' },
                    { number: 40, symbol: 'Zr' },
                    { number: 41, symbol: 'Nb' },
                    { number: 42, symbol: 'Mo' },
                    { number: 43, symbol: 'Tc' },
                    { number: 44, symbol: 'Ru' },
                    { number: 45, symbol: 'Rh' },
                    { number: 46, symbol: 'Pd' },
                    { number: 47, symbol: 'Ag' },
                    { number: 48, symbol: 'Cd' },
                    { number: 72, symbol: 'Hf' },
                    { number: 73, symbol: 'Ta' },
                    { number: 74, symbol: 'W' },
                    { number: 75, symbol: 'Re' },
                    { number: 76, symbol: 'Os' },
                    { number: 77, symbol: 'Ir' },
                    { number: 78, symbol: 'Pt' },
                    { number: 79, symbol: 'Au' },
                    { number: 80, symbol: 'Hg' },
                    { number: 104, symbol: 'Rf' },
                    { number: 105, symbol: 'Db' },
                    { number: 106, symbol: 'Sg' },
                    { number: 107, symbol: 'Bh' },
                    { number: 108, symbol: 'Hs' },
                    { number: 109, symbol: 'Mt' },
                    { number: 110, symbol: 'Ds' },
                    { number: 111, symbol: 'Rg' },
                    { number: 112, symbol: 'Cn' },
                ],
            },
            {
                name: 'Post-Transition Metals',
                elements: [
                    { number: 13, symbol: 'Al' },
                    { number: 31, symbol: 'Ga' },
                    { number: 49, symbol: 'In' },
                    { number: 50, symbol: 'Sn' },
                    { number: 81, symbol: 'Tl' },
                    { number: 82, symbol: 'Pb' },
                    { number: 83, symbol: 'Bi' },
                    { number: 113, symbol: 'Nh' },
                    { number: 114, symbol: 'Fi' },
                    { number: 115, symbol: 'Mc' },
                    { number: 116, symbol: 'Lv' },
                ],
            },
            {
                name: 'Metalloids',
                elements: [
                    { number: 5, symbol: 'B' },
                    { number: 14, symbol: 'Si' },
                    { number: 32, symbol: 'Ge' },
                    { number: 33, symbol: 'As' },
                    { number: 51, symbol: 'Sb' },
                    { number: 52, symbol: 'Te' },
                    { number: 84, symbol: 'Po' },
                ],
            },
            {
                name: 'Non-Metals',
                elements: [
                    { number: 1, symbol: 'H' },
                    { number: 6, symbol: 'C' },
                    { number: 7, symbol: 'N' },
                    { number: 8, symbol: 'O' },
                    { number: 15, symbol: 'P' },
                    { number: 16, symbol: 'S' },
                    { number: 34, symbol: 'Se' },
                ],
            },
            {
                name: 'Halogens',
                elements: [
                    { number: 9, symbol: 'F' },
                    { number: 17, symbol: 'Cl' },
                    { number: 35, symbol: 'Br' },
                    { number: 53, symbol: 'I' },
                    { number: 85, symbol: 'At' },
                    { number: 117, symbol: 'Ts' },
                ],
            },
            {
                name: 'Noble Gases',
                elements: [
                    { number: 2, symbol: 'He' },
                    { number: 10, symbol: 'Ne' },
                    { number: 18, symbol: 'Ar' },
                    { number: 36, symbol: 'Kr' },
                    { number: 54, symbol: 'Xe' },
                    { number: 86, symbol: 'Rn' },
                    { number: 118, symbol: 'Og' },
                ],
            },
            {
                name: 'Lanthanides',
                elements: [
                    { number: 57, symbol: 'La' },
                    { number: 58, symbol: 'Ce' },
                    { number: 59, symbol: 'Pr' },
                    { number: 60, symbol: 'Nd' },
                    { number: 61, symbol: 'Pm' },
                    { number: 62, symbol: 'Sm' },
                    { number: 63, symbol: 'Eu' },
                    { number: 64, symbol: 'Gd' },
                    { number: 65, symbol: 'Tb' },
                    { number: 66, symbol: 'Dy' },
                    { number: 67, symbol: 'Ho' },
                    { number: 68, symbol: 'Er' },
                    { number: 69, symbol: 'Tm' },
                    { number: 70, symbol: 'Yb' },
                    { number: 71, symbol: 'Lu' },
                ],
            },
            {
                name: 'Actinides',
                elements: [
                    { number: 89, symbol: 'Ac' },
                    { number: 90, symbol: 'Th' },
                    { number: 91, symbol: 'Pa' },
                    { number: 92, symbol: 'U' },
                    { number: 93, symbol: 'Np' },
                    { number: 94, symbol: 'Pu' },
                    { number: 95, symbol: 'Am' },
                    { number: 96, symbol: 'Cm' },
                    { number: 97, symbol: 'Bk' },
                    { number: 98, symbol: 'Cf' },
                    { number: 99, symbol: 'Es' },
                    { number: 100, symbol: 'Fm' },
                    { number: 101, symbol: 'Md' },
                    { number: 102, symbol: 'No' },
                    { number: 103, symbol: 'Lr' },
                ],
            },
        ];

        return elementGroups;
    },

    getActiveElements: function (selectionArray) {
        const elementGroups = $periodicTable.getGroupsElements();
        const activeNumbers = [];
        selectionArray.forEach((isActive, index) => {
            if (isActive === 1 && elementGroups[index]) {
                const groupNumbers = elementGroups[index].elements.map(
                    (element) => element.number
                );
                activeNumbers.push(...groupNumbers);
            }
        });
        return activeNumbers;
    },

    getGroupName: function (number) {
        const elementGroups = $periodicTable.getGroupsElements();
        for (const group of elementGroups) {
            if (group.elements.some((element) => element.number === number)) {
                return group.name;
            }
        }
        return 'Group not found';
    },

    completeMode: function (instance) {
        const mOptions = $periodicTable.options[instance];
        const $allElements = $('#ptMainContainer-' + instance).find(
            '.PTP-element'
        );
        mOptions.elementsRandow.forEach((number) => {
            const $element = $allElements.filter(`[data-number="${number}"]`);

            const $number = $element.find('.PTP-element-number');
            const $name = $element.find('.PTP-element-name');
            const $symbol = $element.find('.PTP-element-symbol');

            if (mOptions.types[0]) {
                $number.text('');
            }
            if (mOptions.types[1]) {
                $name.text('');
            }
            if (mOptions.types[2]) {
                $symbol.text('');
            }

            $element.addClass('PTP-complete-mode');
        });
        if (mOptions.types[3]) {
            $(`#ptGroupBig-${instance}`).text('');
        }
        $periodicTable.showMessage(3, mOptions.msgs.mgsSelectEQ, instance);
    },

    MobileMode: function (instance) {
        const mOptions = $periodicTable.options[instance];
        mOptions.gameElements = [];
        const elements_data = $periodicTable.elements_dataf(instance);

        for (let i = 0; i < mOptions.elementsRandow.length; i++) {
            const element = elements_data[mOptions.elements[i] - 1];
            mOptions.gameElements.push(element);
        }
        $periodicTable.showMobileQuestion(instance);
    },
    gameMode: function (instance) {
        const mOptions = $periodicTable.options[instance];
        const $allElements = $('#ptMainContainer-' + instance).find(
            '.PTP-element'
        );

        mOptions.selectedIndexes = new Set();

        $allElements.each(function () {
            const $element = $(this);
            const dataNumber = parseInt($element.data('number'));
            if (mOptions.elements.includes(dataNumber)) {
                mOptions.selectedIndexes.add(dataNumber);
            }
        });

        mOptions.selectedIndexes.forEach((number) => {
            const $element = $allElements.filter(`[data-number="${number}"]`);
            if (mOptions.gameType === 0) {
                const $number = $element.find('.PTP-element-number');
                $number.css('visibility', 'hidden');
            } else if (mOptions.gameType === 1) {
                const $name = $element.find('.PTP-element-name');
                $name.css('visibility', 'hidden');
            } else if (mOptions.gameType === 2) {
                const $symbol = $element.find('.PTP-element-symbol');
                $symbol.css('visibility', 'hidden');
            }
            $element.addClass('PTP-game-mode');
        });

        mOptions.gameElements = [];
        const elements_data = $periodicTable.elements_dataf(instance);

        for (let i = 0; i < mOptions.elementsRandow.length; i++) {
            const element = elements_data[mOptions.elements[i] - 1];
            mOptions.gameElements.push(element);
        }
        $periodicTable.showQuestion(instance);
    },

    isMobile: function () {
        const userAgent =
                navigator.userAgent || navigator.vendor || window.opera,
            mobileDeviceRegex =
                /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone|Kindle|Silk|PlayBook|BB10|Mobile|Tablet|Nintendo|Switch|PSP|PlayStation/i,
            isTouchDevice =
                'ontouchstart' in window || navigator.maxTouchPoints > 0,
            isSmallScreen = window.innerWidth <= 768;
        return (
            mobileDeviceRegex.test(userAgent) || isTouchDevice || isSmallScreen
        );
    },

    startGame: function (instance) {
        const mOptions = $periodicTable.options[instance];

        if (mOptions.gameStarted) return;

        $('#ptShowClue-' + instance).hide();
        $('#ptStartGameDiv-' + instance).hide();
        $('#ptStartGameMobileDiv-' + instance).hide();
        $('#ptImageMobile-' + instance).hide();

        $('#ptPShowClue-' + instance).text('');
        $('#ptMessageDiv-' + instance).hide();
        mOptions.errors = 0;
        mOptions.hits = 0;
        mOptions.score = 0;
        mOptions.counter = 0;
        mOptions.gameOver = false;
        mOptions.obtainedClue = false;
        mOptions.solutionsShow = false;
        mOptions.active = 0;
        mOptions.activateGame = false;
        mOptions.completedElements = [];
        mOptions.elementsRandow = $periodicTable.getRandomElements(
            mOptions.elements,
            mOptions.number
        );
        mOptions.number =
            mOptions.number < mOptions.elementsRandow.length
                ? mOptions.elementsRandow.length
                : mOptions.number;
        mOptions.attemptsGame =
            mOptions.attempts === 0 ? 100000 : mOptions.attempts;

        if (mOptions.time > 0) {
            $('#ptGameContainer-' + instance)
                .find('.exeQuextIcons-Time')
                .show();
            $('#ptPTime-' + instance).show();
            mOptions.counter = mOptions.time * 60;
            mOptions.counterClock = setInterval(function () {
                let $node = $('#ptMainContainer-' + instance);
                let $content = $('#node-content');
                if (
                    !$node.length ||
                    ($content.length && $content.attr('mode') === 'edition')
                ) {
                    clearInterval(mOptions.counterClock);
                    return;
                }
                if (mOptions.gameStarted) {
                    mOptions.counter--;
                    $periodicTable.updateTime(mOptions.counter, instance);
                    if (mOptions.counter <= 0) {
                        clearInterval(mOptions.counterClock);
                        $periodicTable.checkAnswers(instance);
                        return;
                    }
                }
            }, 1000);
            $periodicTable.updateTime(mOptions.time * 60, instance);
        }
        if ($periodicTable.isMobileDevice()) {
            $periodicTable.MobileMode(instance);
        } else {
            if (mOptions.mode === 0) {
                $periodicTable.gameMode(instance);
            } else {
                $periodicTable.completeMode(instance);
            }
        }

        $periodicTable.updateGameBoard(instance);

        mOptions.gameStarted = true;
    },

    enterCodeAccess: function (instance) {
        const mOptions = $periodicTable.options[instance];

        if (
            mOptions.itinerary.codeAccess.toLowerCase() ==
            $('#ptCodeAccessE-' + instance)
                .val()
                .toLowerCase()
        ) {
            $periodicTable.showCubiertaOptions(instance, false);
            $periodicTable.startGame(instance);
        } else {
            $('#ptMesajeAccesCodeE-' + instance)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $('#ptCodeAccessE-' + instance).val('');
        }
    },

    updateTime: function (tiempo, instance) {
        let mTime =
            $exeDevices.iDevice.gamification.helpers.getTimeToString(tiempo);
        $('#ptPTime-' + instance).text(mTime);
    },

    gameOver: function (instance) {
        const mOptions = $periodicTable.options[instance],
            score = ((mOptions.hits * 10) / mOptions.number).toFixed(2),
            message = mOptions.msgs.msgGameOver
                .replace('%s', score)
                .replace('%s', mOptions.hits)
                .replace('%s', mOptions.number),
            type = score < 5 ? 1 : 2;
        $('#ptQuestionP-' + instance).hide();

        $periodicTable.showMessage(type, message, instance);

        clearInterval(mOptions.counterClock);
        mOptions.gameStarted = false;
        mOptions.gameOver = true;

        if (mOptions.isScorm == 1) {
            $periodicTable.sendScore(true, instance);
            $('#ptRepeatActivity-' + instance).text(
                mOptions.msgs.msgYouScore + ': ' + score
            );
            $periodicTable.initialScore = score;
        }

        if (mOptions.itinerary.showClue) {
            if (
                (mOptions.hits * 100) / mOptions.number >=
                mOptions.itinerary.percentageClue
            ) {
                $('#ptPShowClue-' + instance).text(
                    mOptions.msgs.msgInformation +
                        ': ' +
                        mOptions.itinerary.clueGame
                );
            } else {
                $('#ptPShowClue-' + instance).text(
                    mOptions.msgs.msgTryAgain.replace(
                        '%s',
                        mOptions.itinerary.percentageClue
                    )
                );
            }
            $('#ptShowClue-' + instance).show();
        }

        $periodicTable.saveEvaluation(instance);
        $periodicTable.showFeedBack(instance);
    },

    gameMobileOver: function (instance) {
        const mOptions = $periodicTable.options[instance],
            score = ((mOptions.hits * 10) / mOptions.number).toFixed(2),
            message = mOptions.msgs.msgGameOver
                .replace('%s', score)
                .replace('%s', mOptions.hits)
                .replace('%s', mOptions.number),
            type = score < 5 ? 1 : 2;

        $periodicTable.showMessage(type, message, instance);

        mOptions.gameStarted = false;
        mOptions.gameOver = true;

        if (mOptions.isScorm == 1) {
            $periodicTable.sendScore(true, instance);
            $('#ptRepeatActivity-' + instance).text(
                mOptions.msgs.msgYouScore + ': ' + score
            );
            $periodicTable.initialScore = score;
        }
        $('#ptlLightboxMobile-' + instance).fadeOut();

        $('#ptStartGameMobileDiv-' + instance).show();

        if (mOptions.itinerary.showClue) {
            if (
                (mOptions.hits * 100) / mOptions.number >=
                mOptions.itinerary.percentageClue
            ) {
                $('#ptPShowClue-' + instance).text(
                    mOptions.msgs.msgInformation +
                        ': ' +
                        mOptions.itinerary.clueGame
                );
            } else {
                $('#ptPShowClue-' + instance).text(
                    mOptions.msgs.msgTryAgain.replace(
                        '%s',
                        mOptions.itinerary.percentageClue
                    )
                );
            }
            $('#ptShowClue-' + instance).show();
        }

        $periodicTable.saveEvaluation(instance);
        $periodicTable.showFeedBack(instance);
    },

    showFeedBack: function (instance) {
        const mOptions = $periodicTable.options[instance],
            puntos = (mOptions.hits * 100) / mOptions.number;

        if (mOptions.feedBack) {
            if (puntos >= mOptions.percentajeFB) {
                $periodicTable.showCubiertaOptions(instance, 1);
            } else {
                let message = $('#ptMessage-' + instance).text();
                message +=
                    ' ' +
                    mOptions.msgs.msgTryAgain.replace(
                        '%s',
                        mOptions.percentajeFB
                    );
                $periodicTable.showMessage(1, message, instance);
            }
        }
    },
    showCubiertaOptions(instance, mode) {
        const $cubierta = $('#ptCubierta-' + instance),
            $access = $('#ptCodeAccessDiv-' + instance),
            $feeeback = $('#ptDivFeedBack-' + instance);

        if (mode === false) {
            $cubierta.fadeOut(400, function () {
                $access.hide();
                $feeeback.hide();
            });
            return;
        }

        $access.hide();
        $feeeback.hide();
        $cubierta.hide();

        switch (mode) {
            case 0:
                $access.show();
                $cubierta.show();
                break;
            case 1:
                $feeeback.find('.periodic-table-feedback-game').show();
                $feeeback.fadeIn();
                $cubierta.show();
                break;
            default:
                break;
        }
    },

    showMessage: function (type, message, instance) {
        let colors = [
                '#555555',
                $periodicTable.borderColors.red,
                $periodicTable.borderColors.green,
                $periodicTable.borderColors.blue,
                $periodicTable.borderColors.deepblue,
            ],
            color = colors[type];
        $('#ptMessage-' + instance).text(message);
        $('#ptMessage-' + instance).css('color', color);
        $('#ptMessage-' + instance).show();
        $('#ptMessageDiv-' + instance).show();
    },

    getActiveGame: function (instance) {
        const msgs = $periodicTable.options[instance].msgs;
        let ligthbox = `
            <div class="PTP-lightbox" id="ptlLightbox-${instance}">
                <div class="PTP-lightbox-content">
                    <div class="PTP-GroupBigDiv" id="ptGroupDiv-${instance}">
                        <span>${msgs.msgGroup}: </span><span id="ptGroupBig-${instance}">Metals</span>
                    </div>
                    <div class="PTP-element-box-big" id="ptElementBoxBix-${instance}">
                        <div id="ptNumberBig-${instance}" class="PTP-element-number-big"></div>
                        <div id="ptSymbolBig-${instance}" class="PTP-element-symbol-big"></div>
                        <div id="ptNameBig-${instance}" class="PTP-name-big"></div>
                        <div id="ptMassBig-${instance}" class="PTP-mass-big"></div>
                        <div class="PTP-ionic-big">
                            <div id="ptIonizationBig-${instance}" class="PTP-ionization-energy-big"></div>
                            <div id="ptEletroNegatyvityBig-${instance}" class="PTP-electronegativity-big"></div>
                        </div>                   
                        <div id="ptOxitationBig-${instance}" class="PTP-oxidation-states-big"></div>
                        <div id="ptConfigurationBig-${instance}" class="PTP-configuration-big"></div>
                    </div>
                    <div class="PTP-inputdata" id="ptNumberInputDiv-${instance}">
                        <label class="sr-av" for="ptNumberInput-${instance}">${msgs.msgNumber}:</label>
                        <input type="text" class="form-control" id="ptNumberInput-${instance}" maxlength="3"  placeholder="${msgs.msgNumber}" />
                    </div>
                    <div class="PTP-inputdata" id="ptNameInputDiv-${instance}">
                        <label  class="sr-av"  for="ptNameInput-${instance}">${msgs.msgName}:</label>
                        <input type="text" class="form-control" id="ptNameInput-${instance}" maxlength="20"  placeholder="${msgs.msgName}" />
                    </div>
                    <div class="PTP-inputdata" id="ptSymbolInputDiv-${instance}">
                        <label  class="sr-av"  for="ptSymbolInput-${instance}">${msgs.msgSymbol}:</label>
                        <input type="text" class="form-control" id="ptSymbolInput-${instance}" maxlength="2"   placeholder="${msgs.msgSymbol}"/>
                    </div>                
                    <div class="PTP-inputdata" id="ptGroupSelectDiv-${instance}">
                        <label for="ptGroupsSelect-${instance}">${msgs.msgGroup}: </label>
                          <select id="ptGroupsSelect-${instance}" class="PTP-inputdata">
                            <option value="-1"></option>
                            <option value="0">${msgs.msgAlkaliMetal}</option>
                            <option value="1">${msgs.msgAlkalineEarthMetal}</option>
                            <option value="2">${msgs.msgTransitionMetal}</option>
                            <option value="3">${msgs.msgPostTransitionMetal}</option>
                            <option value="4">${msgs.msgMetalloid}</option>
                            <option value="5">${msgs.msgNonMetal}</option>
                            <option value="6">${msgs.msgHalogen}</option>
                            <option value="7">${msgs.msgNobleGas}</option>
                            <option value="8">${msgs.msgLanthanide}</option>
                            <option value="9">${msgs.msgActinide}</option>
                        </select>
                    </div>      
                    <button class="btn btn-primary" id="ptAcceptButton-${instance}">${msgs.msgAccept}</button>
                    <button class="btn btn-primary" id="ptCancelButton-${instance}">${msgs.msgCancel}</button>
                </div>
            </div>
        `;

        return ligthbox;
    },
    getClassColor: function (instance) {
        const mOptions = $periodicTable.options[instance];
        const elementClassMapping = {
            [mOptions.msgs.msgAlkaliMetal]: 'PTP-alkali-metal',
            [mOptions.msgs.msgAlkalineEarthMetal]: 'PTP-alkaline-earth',
            [mOptions.msgs.msgTransitionMetal]: 'PTP-transition-metal',
            [mOptions.msgs.msgPostTransitionMetal]: 'PTP-post-transition-metal',
            [mOptions.msgs.msgMetalloid]: 'PTP-metalloid',
            [mOptions.msgs.msgNonMetal]: 'PTP-non-metal',
            [mOptions.msgs.msgHalogen]: 'PTP-halogen',
            [mOptions.msgs.msgNobleGas]: 'PTP-noble-gas',
            [mOptions.msgs.msgLanthanide]: 'PTP-lanthanoid',
            [mOptions.msgs.msgActinide]: 'PTP-actinoid',
        };
        return elementClassMapping;
    },
    getMobileActive: function (instance) {
        const msgs = $periodicTable.options[instance].msgs;
        let ligthbox = `
            <div class="PTP-lightboxMobile" id="ptlLightboxMobile-${instance}">
                <div class="PTP-lightbox-content">
                    <div class="PTP-GroupBigDiv" id="ptGroupDiv-${instance}">
                        <span>${msgs.msgGroup}: </span><span id="ptGroupBig-${instance}">Metals</span>
                    </div>
                    <div class="PTP-element-box-big" id="ptElementBoxBix-${instance}">
                        <div id="ptNumberBig-${instance}" class="PTP-element-number-big"></div>
                        <div id="ptSymbolBig-${instance}" class="PTP-element-symbol-big"></div>
                        <div id="ptNameBig-${instance}" class="PTP-name-big"></div>
                        <div id="ptMassBig-${instance}" class="PTP-mass-big"></div>
                        <div class="PTP-ionic-big">
                            <div id="ptIonizationBig-${instance}" class="PTP-ionization-energy-big"></div>
                            <div id="ptEletroNegatyvityBig-${instance}" class="PTP-electronegativity-big"></div>
                        </div>                   
                        <div id="ptOxitationBig-${instance}" class="PTP-oxidation-states-big"></div>
                        <div id="ptConfigurationBig-${instance}" class="PTP-configuration-big"></div>
                    </div>
                    <div class="PTP-inputdataMobile" id="ptNumberInputDiv-${instance}">
                        <label class="sr-av" for="ptNumberInput-${instance}">${msgs.msgNumber}:</label>
                        <input type="text" id="ptNumberInput-${instance}" maxlength="3" placeholder="${msgs.msgNumber}" />
                    </div>
                    <div class="PTP-inputdataMobile" id="ptNameInputDiv-${instance}">
                        <label class="sr-av" for="ptNameInput-${instance}">${msgs.msgName}:</label>
                        <input type="text" id="ptNameInput-${instance}" maxlength="20" placeholder="${msgs.msgName}"/>
                    </div>
                    <div class="PTP-inputdataMobile" id="ptSymbolInputDiv-${instance}">
                        <label class="sr-av" for="ptSymbolInput-${instance}">${msgs.msgSymbol}:</label>
                        <input type="text" id="ptSymbolInput-${instance}" maxlength="2" placeholder="${msgs.msgSymbol}" />
                    </div>
                    <div class="PTP-inputdataMobile" id="ptGroupSelectDiv-${instance}">
                        <label for="ptGroupsSelect-${instance}">${msgs.msgGroup}: </label>
                          <select id="ptGroupsSelect-${instance}" class="PTP-inputdataMobile">
                            <option value="-1"></option>
                            <option value="0">${msgs.msgAlkaliMetal}</option>
                            <option value="1">${msgs.msgAlkalineEarthMetal}</option>
                            <option value="2">${msgs.msgTransitionMetal}</option>
                            <option value="3">${msgs.msgPostTransitionMetal}</option>
                            <option value="4">${msgs.msgMetalloid}</option>
                            <option value="5">${msgs.msgNonMetal}</option>
                            <option value="6">${msgs.msgHalogen}</option>
                            <option value="7">${msgs.msgNobleGas}</option>
                            <option value="8">${msgs.msgLanthanide}</option>
                            <option value="9">${msgs.msgActinide}</option>
                        </select>
                    </div>      
                    <button class="btn btn-success" id="ptAcceptButtonMobile-${instance}">${msgs.msgAccept}</button>
                  </div>
            </div>
        `;

        return ligthbox;
    },

    getGroupClass: function (groupNumber) {
        const groupClasses = [
            'PTP-alkali-metal',
            'PTP-alkaline-earth',
            'PTP-transition-metal',
            'PTP-post-transition-metal',
            'PTP-metalloid',
            'PTP-non-metal',
            'PTP-halogen',
            'PTP-noble-gas',
            'PTP-lanthanoid',
            'PTP-actinoid',
        ];

        return (
            'PTP-element-box-big ' + groupClasses[groupNumber] ||
            'PTP-element-box-big'
        );
    },
    isMobileDevice: function () {
        if (window.matchMedia) {
            return window.matchMedia('(max-width: 900px)').matches;
        } else {
            return window.innerWidth < 900;
        }
    },

    getPeriodicTable: function (instance) {
        if ($periodicTable.isMobileDevice()) {
            return $periodicTable.getPeriodicTableMobile(instance);
        }
        return $periodicTable.getPeriodicTableDesktop(instance);
    },
    getPeriodicTableMobile: function (instance) {
        let msgs = $periodicTable.options[instance].msgs;
        return `<div class="PTP-periodic-table-Mobile" id="ptTableMobile-${instance}">
                    <div class="PTP-StartGame" id="ptStartGameMobileDiv-${instance}">
                        <a href="#" id="ptStartGameMobile-${instance}">${msgs.msgPlayStart}</a>                     
                    </div>
                    <div  id="ptImageMobile-${instance}"  style="text-align: center; padding-top:0.6em">
                        <img src="${$periodicTable.idevicePath}periodic-table-icon.png" width="230"  alt="Imagen" />
                    </div>      
                </div>
                ${$periodicTable.getMobileActive(instance)}
                `;
    },

    getPeriodicTableDesktop: function (instance) {
        let msgs = $periodicTable.options[instance].msgs;
        let table = `
        <table class="PTP-periodic-table" id="ptTable-${instance}">
            <tr>                
                <td class="PTP-non-metal">
                    <div class="PTP-element" data-number="1">
                        <span class="PTP-atomic-mass">1.008</span>
                        <span class="PTP-element-number">1</span>
                        <span class="PTP-element-symbol">H</span>
                        <span class="PTP-element-name">${msgs.Hydrogen}</span>
                    </div>
                </td>
                <td colspan="16">
                    <div class="PTP-StartGame" id="ptStartGameDiv-${instance}">
                        <a href="#" id="ptStartGame-${instance}">${msgs.msgPlayStart}</a>
                    </div>                   
                    <div class="PTP-QuestionP" id="ptQuestionP-${instance}">
                        <span id="ptQuestionLabel-${instance}" class="PTP-QuestionLabel">${msgs.msgIdentify}</span>: <span class="PTP-QuestionData" id="ptQuestionData-${instance}">H</span>
                    </div>
                </td>                
                <td class="PTP-noble-gas">
                    <div class="PTP-element" data-number="2">
                        <span class="PTP-atomic-mass">4.0026</span>
                        <span class="PTP-element-number">2</span>
                        <span class="PTP-element-symbol">He</span>
                        <span class="PTP-element-name">${msgs.Helium}</span>
                    </div>
                </td>
            </tr>
            <tr>                
                <td class="PTP-alkali-metal">
                    <div class="PTP-element" data-number="3">
                        <span class="PTP-atomic-mass">6.94</span>
                        <span class="PTP-element-number">3</span>
                        <span class="PTP-element-symbol">Li</span>
                        <span class="PTP-element-name">${msgs.Lithium}</span>
                    </div>
                </td>                
                <td class="PTP-alkaline-earth">
                    <div class="PTP-element" data-number="4">
                        <span class="PTP-atomic-mass">9.0122</span>
                        <span class="PTP-element-number">4</span>
                        <span class="PTP-element-symbol">Be</span>
                        <span class="PTP-element-name">${msgs.Beryllium}</span>
                    </div>
                </td>
                <td colspan="10"></td>                
                <td class="PTP-metalloid">
                    <div class="PTP-element" data-number="5">
                        <span class="PTP-atomic-mass">10.81</span>
                        <span class="PTP-element-number">5</span>
                        <span class="PTP-element-symbol">B</span>
                        <span class="PTP-element-name">${msgs.Boron}</span>
                    </div>
                </td>                
                <td class="PTP-non-metal">
                    <div class="PTP-element" data-number="6">
                        <span class="PTP-atomic-mass">12.011</span>
                        <span class="PTP-element-number">6</span>
                        <span class="PTP-element-symbol">C</span>
                        <span class="PTP-element-name">${msgs.Carbon}</span>
                    </div>
                </td>                
                <td class="PTP-non-metal">
                    <div class="PTP-element" data-number="7">
                        <span class="PTP-atomic-mass">14.007</span>
                        <span class="PTP-element-number">7</span>
                        <span class="PTP-element-symbol">N</span>
                        <span class="PTP-element-name">${msgs.Nitrogen}</span>
                    </div>
                </td>                
                <td class="PTP-non-metal">
                    <div class="PTP-element" data-number="8">
                        <span class="PTP-atomic-mass">15.999</span>
                        <span class="PTP-element-number">8</span>
                        <span class="PTP-element-symbol">O</span>
                        <span class="PTP-element-name">${msgs.Oxygen}</span>
                    </div>
                </td>                
                <td class="PTP-halogen">
                    <div class="PTP-element" data-number="9">
                        <span class="PTP-atomic-mass">18.998</span>
                        <span class="PTP-element-number">9</span>
                        <span class="PTP-element-symbol">F</span>
                        <span class="PTP-element-name">${msgs.Fluorine}</span>
                    </div>
                </td>
                <td class="PTP-noble-gas">
                    <div class="PTP-element" data-number="10">
                        <span class="PTP-atomic-mass">20.180</span>
                        <span class="PTP-element-number">10</span>
                        <span class="PTP-element-symbol">Ne</span>
                        <span class="PTP-element-name">${msgs.Neon}</span>
                    </div>
                </td>
            </tr>
            <tr>
                <td class="PTP-alkali-metal">
                    <div class="PTP-element" data-number="11">
                        <span class="PTP-atomic-mass">22.990</span>
                        <span class="PTP-element-number">11</span>
                        <span class="PTP-element-symbol">Na</span>
                        <span class="PTP-element-name">${msgs.Sodium}</span>
                    </div>
                </td>                
                <td class="PTP-alkaline-earth">
                    <div class="PTP-element" data-number="12">
                        <span class="PTP-atomic-mass">24.305</span>
                        <span class="PTP-element-number">12</span>
                        <span class="PTP-element-symbol">Mg</span>
                        <span class="PTP-element-name">${msgs.Magnesium}</span>
                    </div>
                </td>
                <td colspan="10"></td>                
                <td class="PTP-post-transition-metal">
                    <div class="PTP-element" data-number="13">
                        <span class="PTP-atomic-mass">26.982</span>
                        <span class="PTP-element-number">13</span>
                        <span class="PTP-element-symbol">Al</span>
                        <span class="PTP-element-name">${msgs.Aluminum}</span>
                    </div>
                </td>                
                <td class="PTP-metalloid">
                    <div class="PTP-element" data-number="14">
                        <span class="PTP-atomic-mass">28.085</span>
                        <span class="PTP-element-number">14</span>
                        <span class="PTP-element-symbol">Si</span>
                        <span class="PTP-element-name">${msgs.Silicon}</span>
                    </div>
                </td>                
                <td class="PTP-non-metal">
                    <div class="PTP-element" data-number="15">
                        <span class="PTP-atomic-mass">30.974</span>
                        <span class="PTP-element-number">15</span>
                        <span class="PTP-element-symbol">P</span>
                        <span class="PTP-element-name">${msgs.Phosphorus}</span>
                    </div>
                </td>                
                <td class="PTP-non-metal">
                    <div class="PTP-element" data-number="16">
                        <span class="PTP-atomic-mass">32.06</span>
                        <span class="PTP-element-number">16</span>
                        <span class="PTP-element-symbol">S</span>
                        <span class="PTP-element-name">${msgs.Sulfur}</span>
                    </div>
                </td>                
                <td class="PTP-halogen">
                    <div class="PTP-element" data-number="17">
                        <span class="PTP-atomic-mass">35.45</span>
                        <span class="PTP-element-number">17</span>
                        <span class="PTP-element-symbol">Cl</span>
                        <span class="PTP-element-name">${msgs.Chlorine}</span>
                    </div>
                </td>                
                <td class="PTP-noble-gas">
                    <div class="PTP-element" data-number="18">
                        <span class="PTP-atomic-mass">39.948</span>
                        <span class="PTP-element-number">18</span>
                        <span class="PTP-element-symbol">Ar</span>
                        <span class="PTP-element-name">${msgs.Argon}</span>
                    </div>
                </td>
            </tr>
            <tr>                
                <td class="PTP-alkali-metal">
                    <div class="PTP-element" data-number="19">
                        <span class="PTP-atomic-mass">39.098</span>
                        <span class="PTP-element-number">19</span>
                        <span class="PTP-element-symbol">K</span>
                        <span class="PTP-element-name">${msgs.Potassium}</span>
                    </div>
                </td>                
                <td class="PTP-alkaline-earth">
                    <div class="PTP-element" data-number="20">
                        <span class="PTP-atomic-mass">40.078</span>
                        <span class="PTP-element-number">20</span>
                        <span class="PTP-element-symbol">Ca</span>
                        <span class="PTP-element-name">${msgs.Calcium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="21">
                        <span class="PTP-atomic-mass">44.956</span>
                        <span class="PTP-element-number">21</span>
                        <span class="PTP-element-symbol">Sc</span>
                        <span class="PTP-element-name">${msgs.Scandium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="22">
                        <span class="PTP-atomic-mass">47.867</span>
                        <span class="PTP-element-number">22</span>
                        <span class="PTP-element-symbol">Ti</span>
                        <span class="PTP-element-name">${msgs.Titanium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="23">
                        <span class="PTP-atomic-mass">50.942</span>
                        <span class="PTP-element-number">23</span>
                        <span class="PTP-element-symbol">V</span>
                        <span class="PTP-element-name">${msgs.Vanadium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="24">
                        <span class="PTP-atomic-mass">52.00</span>
                        <span class="PTP-element-number">24</span>
                        <span class="PTP-element-symbol">Cr</span>
                        <span class="PTP-element-name">${msgs.Chromium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="25">
                        <span class="PTP-atomic-mass">54.938</span>
                        <span class="PTP-element-number">25</span>
                        <span class="PTP-element-symbol">Mn</span>
                        <span class="PTP-element-name">${msgs.Manganese}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="26">
                        <span class="PTP-atomic-mass">55.845</span>
                        <span class="PTP-element-number">26</span>
                        <span class="PTP-element-symbol">Fe</span>
                        <span class="PTP-element-name">${msgs.Iron}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="27">
                        <span class="PTP-atomic-mass">58.933</span>
                        <span class="PTP-element-number">27</span>
                        <span class="PTP-element-symbol">Co</span>
                        <span class="PTP-element-name">${msgs.Cobalt}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="28">
                        <span class="PTP-atomic-mass">58.693</span>
                        <span class="PTP-element-number">28</span>
                        <span class="PTP-element-symbol">Ni</span>
                        <span class="PTP-element-name">${msgs.Nickel}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="29">
                        <span class="PTP-atomic-mass">63.546</span>
                        <span class="PTP-element-number">29</span>
                        <span class="PTP-element-symbol">Cu</span>
                        <span class="PTP-element-name">${msgs.Copper}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="30">
                        <span class="PTP-atomic-mass">65.38</span>
                        <span class="PTP-element-number">30</span>
                        <span class="PTP-element-symbol">Zn</span>
                        <span class="PTP-element-name">${msgs.Zinc}</span>
                    </div>
                </td>                
                <td class="PTP-post-transition-metal">
                    <div class="PTP-element" data-number="31">
                        <span class="PTP-atomic-mass">69.723</span>
                        <span class="PTP-element-number">31</span>
                        <span class="PTP-element-symbol">Ga</span>
                        <span class="PTP-element-name">${msgs.Gallium}</span>
                    </div>
                </td>                
                <td class="PTP-metalloid">
                    <div class="PTP-element" data-number="32">
                        <span class="PTP-atomic-mass">72.63</span>
                        <span class="PTP-element-number">32</span>
                        <span class="PTP-element-symbol">Ge</span>
                        <span class="PTP-element-name">${msgs.Germanium}</span>
                    </div>
                </td>                
                <td class="PTP-metalloid">
                    <div class="PTP-element" data-number="33">
                        <span class="PTP-atomic-mass">74.922</span>
                        <span class="PTP-element-number">33</span>
                        <span class="PTP-element-symbol">As</span>
                        <span class="PTP-element-name">${msgs.Arsenic}</span>
                    </div>
                </td>                
                <td class="PTP-non-metal">
                    <div class="PTP-element" data-number="34">
                        <span class="PTP-atomic-mass">78.971</span>
                        <span class="PTP-element-number">34</span>
                        <span class="PTP-element-symbol">Se</span>
                        <span class="PTP-element-name">${msgs.Selenium}</span>
                    </div>
                </td>                
                <td class="PTP-halogen">
                    <div class="PTP-element" data-number="35">
                        <span class="PTP-atomic-mass">79.904</span>
                        <span class="PTP-element-number">35</span>
                        <span class="PTP-element-symbol">Br</span>
                        <span class="PTP-element-name">${msgs.Bromine}</span>
                    </div>
                </td>                
                <td class="PTP-noble-gas">
                    <div class="PTP-element" data-number="36">
                        <span class="PTP-atomic-mass">83.798</span>
                        <span class="PTP-element-number">36</span>
                        <span class="PTP-element-symbol">Kr</span>
                        <span class="PTP-element-name">${msgs.Krypton}</span>
                    </div>
                </td>
            </tr>
            <tr>                
                <td class="PTP-alkali-metal">
                    <div class="PTP-element" data-number="37">
                        <span class="PTP-atomic-mass">85.468</span>
                        <span class="PTP-element-number">37</span>
                        <span class="PTP-element-symbol">Rb</span>
                        <span class="PTP-element-name">${msgs.Rubidium}</span>
                    </div>
                </td>                
                <td class="PTP-alkaline-earth">
                    <div class="PTP-element" data-number="38">
                        <span class="PTP-atomic-mass">87.62</span>
                        <span class="PTP-element-number">38</span>
                        <span class="PTP-element-symbol">Sr</span>
                        <span class="PTP-element-name">${msgs.Strontium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="39">
                        <span class="PTP-atomic-mass">88.906</span>
                        <span class="PTP-element-number">39</span>
                        <span class="PTP-element-symbol">Y</span>
                        <span class="PTP-element-name">${msgs.Yttrium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="40">
                        <span class="PTP-atomic-mass">91.224</span>
                        <span class="PTP-element-number">40</span>
                        <span class="PTP-element-symbol">Zr</span>
                        <span class="PTP-element-name">${msgs.Zirconium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="41">
                        <span class="PTP-atomic-mass">92.906</span>
                        <span class="PTP-element-number">41</span>
                        <span class="PTP-element-symbol">Nb</span>
                        <span class="PTP-element-name">${msgs.Niobium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="42">
                        <span class="PTP-atomic-mass">95.95</span>
                        <span class="PTP-element-number">42</span>
                        <span class="PTP-element-symbol">Mo</span>
                        <span class="PTP-element-name">${msgs.Molybdenum}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="43">
                        <span class="PTP-atomic-mass">98</span>
                        <span class="PTP-element-number">43</span>
                        <span class="PTP-element-symbol">Tc</span>
                        <span class="PTP-element-name">${msgs.Technetium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="44">
                        <span class="PTP-atomic-mass">101.07</span>
                        <span class="PTP-element-number">44</span>
                        <span class="PTP-element-symbol">Ru</span>
                        <span class="PTP-element-name">${msgs.Ruthenium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="45">
                        <span class="PTP-atomic-mass">102.91</span>
                        <span class="PTP-element-number">45</span>
                        <span class="PTP-element-symbol">Rh</span>
                        <span class="PTP-element-name">${msgs.Rhodium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="46">
                        <span class="PTP-atomic-mass">106.42</span>
                        <span class="PTP-element-number">46</span>
                        <span class="PTP-element-symbol">Pd</span>
                        <span class="PTP-element-name">${msgs.Palladium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="47">
                        <span class="PTP-atomic-mass">107.87</span>
                        <span class="PTP-element-number">47</span>
                        <span class="PTP-element-symbol">Ag</span>
                        <span class="PTP-element-name">${msgs.Silver}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="48">
                        <span class="PTP-atomic-mass">112.41</span>
                        <span class="PTP-element-number">48</span>
                        <span class="PTP-element-symbol">Cd</span>
                        <span class="PTP-element-name">${msgs.Cadmium}</span>
                    </div>
                </td>                
                <td class="PTP-post-transition-metal">
                    <div class="PTP-element" data-number="49">
                        <span class="PTP-atomic-mass">114.82</span>
                        <span class="PTP-element-number">49</span>
                        <span class="PTP-element-symbol">In</span>
                        <span class="PTP-element-name">${msgs.Indium}</span>
                    </div>
                </td>                
                <td class="PTP-post-transition-metal">
                    <div class="PTP-element" data-number="50">
                        <span class="PTP-atomic-mass">118.71</span>
                        <span class="PTP-element-number">50</span>
                        <span class="PTP-element-symbol">Sn</span>
                        <span class="PTP-element-name">${msgs.Tin}</span>
                    </div>
                </td>                
                <td class="PTP-metalloid">
                    <div class="PTP-element" data-number="51">
                        <span class="PTP-atomic-mass">121.76</span>
                        <span class="PTP-element-number">51</span>
                        <span class="PTP-element-symbol">Sb</span>
                        <span class="PTP-element-name">${msgs.Antimony}</span>
                    </div>
                </td>                
                <td class="PTP-metalloid">
                    <div class="PTP-element" data-number="52">
                        <span class="PTP-atomic-mass">127.60</span>
                        <span class="PTP-element-number">52</span>
                        <span class="PTP-element-symbol">Te</span>
                        <span class="PTP-element-name">${msgs.Tellurium}</span>
                    </div>
                </td>                
                <td class="PTP-halogen">
                    <div class="PTP-element" data-number="53">
                        <span class="PTP-atomic-mass">126.90</span>
                        <span class="PTP-element-number">53</span>
                        <span class="PTP-element-symbol">I</span>
                        <span class="PTP-element-name">${msgs.Iodine}</span>
                    </div>
                </td>                
                <td class="PTP-noble-gas">
                    <div class="PTP-element" data-number="54">
                        <span class="PTP-atomic-mass">131.29</span>
                        <span class="PTP-element-number">54</span>
                        <span class="PTP-element-symbol">Xe</span>
                        <span class="PTP-element-name">${msgs.Xenon}</span>
                    </div>
                </td>
            </tr>
            <tr>                
                <td class="PTP-alkali-metal">
                    <div class="PTP-element" data-number="55">
                        <span class="PTP-atomic-mass">132.91</span>
                        <span class="PTP-element-number">55</span>
                        <span class="PTP-element-symbol">Cs</span>
                        <span class="PTP-element-name">${msgs.Cesium}</span>
                    </div>
                </td>                
                <td class="PTP-alkaline-earth">
                    <div class="PTP-element" data-number="56">
                        <span class="PTP-atomic-mass">137.33</span>
                        <span class="PTP-element-number">56</span>
                        <span class="PTP-element-symbol">Ba</span>
                        <span class="PTP-element-name">${msgs.Barium}</span>
                    </div>
                </td>                
                <td style="text-align:center;" class="PTP-lanthanoid">
                    <span class="PTP-element-name">${msgs.msgLanthanide}</span>
                </td>
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="72">
                        <span class="PTP-atomic-mass">178.49</span>
                        <span class="PTP-element-number">72</span>
                        <span class="PTP-element-symbol">Hf</span>
                        <span class="PTP-element-name">${msgs.Hafnium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="73">
                        <span class="PTP-atomic-mass">180.95</span>
                        <span class="PTP-element-number">73</span>
                        <span class="PTP-element-symbol">Ta</span>
                        <span class="PTP-element-name">${msgs.Tantalum}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="74">
                        <span class="PTP-atomic-mass">183.84</span>
                        <span class="PTP-element-number">74</span>
                        <span class="PTP-element-symbol">W</span>
                        <span class="PTP-element-name">${msgs.Tungsten}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="75">
                        <span class="PTP-atomic-mass">186.21</span>
                        <span class="PTP-element-number">75</span>
                        <span class="PTP-element-symbol">Re</span>
                        <span class="PTP-element-name">${msgs.Rhenium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="76">
                        <span class="PTP-atomic-mass">190.23</span>
                        <span class="PTP-element-number">76</span>
                        <span class="PTP-element-symbol">Os</span>
                        <span class="PTP-element-name">${msgs.Osmium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="77">
                        <span class="PTP-atomic-mass">192.22</span>
                        <span class="PTP-element-number">77</span>
                        <span class="PTP-element-symbol">Ir</span>
                        <span class="PTP-element-name">${msgs.Iridium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="78">
                        <span class="PTP-atomic-mass">195.08</span>
                        <span class="PTP-element-number">78</span>
                        <span class="PTP-element-symbol">Pt</span>
                        <span class="PTP-element-name">${msgs.Platinum}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="79">
                        <span class="PTP-atomic-mass">196.97</span>
                        <span class="PTP-element-number">79</span>
                        <span class="PTP-element-symbol">Au</span>
                        <span class="PTP-element-name">${msgs.Gold}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="80">
                        <span class="PTP-atomic-mass">200.59</span>
                        <span class="PTP-element-number">80</span>
                        <span class="PTP-element-symbol">Hg</span>
                        <span class="PTP-element-name">${msgs.Mercury}</span>
                    </div>
                </td>                
                <td class="PTP-post-transition-metal">
                    <div class="PTP-element" data-number="81">
                        <span class="PTP-atomic-mass">204.38</span>
                        <span class="PTP-element-number">81</span>
                        <span class="PTP-element-symbol">Tl</span>
                        <span class="PTP-element-name">${msgs.Thallium}</span>
                    </div>
                </td>                
                <td class="PTP-post-transition-metal">
                    <div class="PTP-element" data-number="82">
                        <span class="PTP-atomic-mass">207.2</span>
                        <span class="PTP-element-number">82</span>
                        <span class="PTP-element-symbol">Pb</span>
                        <span class="PTP-element-name">${msgs.Lead}</span>
                    </div>
                </td>                
                <td class="PTP-post-transition-metal">
                    <div class="PTP-element" data-number="83">
                        <span class="PTP-atomic-mass">208.98</span>
                        <span class="PTP-element-number">83</span>
                        <span class="PTP-element-symbol">Bi</span>
                        <span class="PTP-element-name">${msgs.Bismuth}</span>
                    </div>
                </td>                
                <td class="PTP-metalloid">
                    <div class="PTP-element" data-number="84">
                        <span class="PTP-atomic-mass">209</span>
                        <span class="PTP-element-number">84</span>
                        <span class="PTP-element-symbol">Po</span>
                        <span class="PTP-element-name">${msgs.Polonium}</span>
                    </div>
                </td>                
                <td class="PTP-halogen">
                    <div class="PTP-element" data-number="85">
                        <span class="PTP-atomic-mass">210</span>
                        <span class="PTP-element-number">85</span>
                        <span class="PTP-element-symbol">At</span>
                        <span class="PTP-element-name">${msgs.Astatine}</span>
                    </div>
                </td>                
                <td class="PTP-noble-gas">
                    <div class="PTP-element" data-number="86">
                        <span class="PTP-atomic-mass">222</span>
                        <span class="PTP-element-number">86</span>
                        <span class="PTP-element-symbol">Rn</span>
                        <span class="PTP-element-name">${msgs.Radon}</span>
                    </div>
                </td>
            </tr>
            <tr>                
                <td class="PTP-alkali-metal">
                    <div class="PTP-element" data-number="87">
                        <span class="PTP-atomic-mass">223</span>
                        <span class="PTP-element-number">87</span>
                        <span class="PTP-element-symbol">Fr</span>
                        <span class="PTP-element-name">${msgs.Francium}</span>
                    </div>
                </td>                
                <td class="PTP-alkaline-earth">
                    <div class="PTP-element" data-number="88">
                        <span class="PTP-atomic-mass">226</span>
                        <span class="PTP-element-number">88</span>
                        <span class="PTP-element-symbol">Ra</span>
                        <span class="PTP-element-name">${msgs.Radium}</span>
                    </div>
                </td>                
                <td style="text-align:center;"  class="PTP-actinoid">
                    <span class="PTP-element-name">${msgs.msgActinide}</span>
                </td>
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="104">
                        <span class="PTP-atomic-mass">267</span>
                        <span class="PTP-element-number">104</span>
                        <span class="PTP-element-symbol">Rf</span>
                        <span class="PTP-element-name">${msgs.Rutherfordium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="105">
                        <span class="PTP-atomic-mass">268</span>
                        <span class="PTP-element-number">105</span>
                        <span class="PTP-element-symbol">Db</span>
                        <span class="PTP-element-name">${msgs.Dubnium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="106">
                        <span class="PTP-atomic-mass">269</span>
                        <span class="PTP-element-number">106</span>
                        <span class="PTP-element-symbol">Sg</span>
                        <span class="PTP-element-name">${msgs.Seaborgium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="107">
                        <span class="PTP-atomic-mass">270</span>
                        <span class="PTP-element-number">107</span>
                        <span class="PTP-element-symbol">Bh</span>
                        <span class="PTP-element-name">${msgs.Bohrium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="108">
                        <span class="PTP-atomic-mass">269</span>
                        <span class="PTP-element-number">108</span>
                        <span class="PTP-element-symbol">Hs</span>
                        <span class="PTP-element-name">${msgs.Hassium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="109">
                        <span class="PTP-atomic-mass">278</span>
                        <span class="PTP-element-number">109</span>
                        <span class="PTP-element-symbol">Mt</span>
                        <span class="PTP-element-name">${msgs.Meitnerium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="110">
                        <span class="PTP-atomic-mass">281</span>
                        <span class="PTP-element-number">110</span>
                        <span class="PTP-element-symbol">Ds</span>
                        <span class="PTP-element-name">${msgs.Darmstadtium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="111">
                        <span class="PTP-atomic-mass">282</span>
                        <span class="PTP-element-number">111</span>
                        <span class="PTP-element-symbol">Rg</span>
                        <span class="PTP-element-name">${msgs.Roentgenium}</span>
                    </div>
                </td>                
                <td class="PTP-transition-metal">
                    <div class="PTP-element" data-number="112">
                        <span class="PTP-atomic-mass">285</span>
                        <span class="PTP-element-number">112</span>
                        <span class="PTP-element-symbol">Cn</span>
                        <span class="PTP-element-name">${msgs.Copernicium}</span>
                    </div>
                </td>                
                <td class="PTP-post-transition-metal">
                    <div class="PTP-element" data-number="113">
                        <span class="PTP-atomic-mass">286</span>
                        <span class="PTP-element-number">113</span>
                        <span class="PTP-element-symbol">Nh</span>
                        <span class="PTP-element-name">${msgs.Nihonium}</span>
                    </div>
                </td>                
                <td class="PTP-post-transition-metal">
                    <div class="PTP-element" data-number="114">
                        <span class="PTP-atomic-mass">289</span>
                        <span class="PTP-element-number">114</span>
                        <span class="PTP-element-symbol">Fl</span>
                        <span class="PTP-element-name">${msgs.Flerovium}</span>
                    </div>
                </td>                
                <td class="PTP-post-transition-metal">
                    <div class="PTP-element" data-number="115">
                        <span class="PTP-atomic-mass">290</span>
                        <span class="PTP-element-number">115</span>
                        <span class="PTP-element-symbol">Mc</span>
                        <span class="PTP-element-name">${msgs.Moscovium}</span>
                    </div>
                </td>                
                <td class="PTP-post-transition-metal">
                    <div class="PTP-element" data-number="116">
                        <span class="PTP-atomic-mass">293</span>
                        <span class="PTP-element-number">116</span>
                        <span class="PTP-element-symbol">Lv</span>
                        <span class="PTP-element-name">${msgs.Livermorium}</span>
                    </div>
                </td>                
                <td class="PTP-halogen">
                    <div class="PTP-element" data-number="117">
                        <span class="PTP-atomic-mass">294</span>
                        <span class="PTP-element-number">117</span>
                        <span class="PTP-element-symbol">Ts</span>
                        <span class="PTP-element-name">${msgs.Tennessine}</span>
                    </div>
                </td>                
                <td class="PTP-noble-gas">
                    <div class="PTP-element" data-number="118">
                        <span class="PTP-atomic-mass">294</span>
                        <span class="PTP-element-number">118</span>
                        <span class="PTP-element-symbol">Og</span>
                        <span class="PTP-element-name">${msgs.Oganesson}</span>
                    </div>
                </td>
            </tr>
        </table>
        <table class="PTP-separate-row">
            <tr>
                <td class="PTP-lanthanoid">
                    <div class="PTP-element" data-number="57">
                        <span class="PTP-atomic-mass">138.91</span>
                        <span class="PTP-element-number">57</span>
                        <span class="PTP-element-symbol">La</span>
                        <span class="PTP-element-name">${msgs.Lanthanum}</span>
                    </div>
                </td>
                <td class="PTP-lanthanoid">
                    <div class="PTP-element" data-number="58">
                        <span class="PTP-atomic-mass">140.12</span>
                        <span class="PTP-element-number">58</span>
                        <span class="PTP-element-symbol">Ce</span>
                        <span class="PTP-element-name">${msgs.Cerium}</span>
                    </div>
                </td>
                <td class="PTP-lanthanoid">
                    <div class="PTP-element" data-number="59">
                        <span class="PTP-atomic-mass">140.91</span>
                        <span class="PTP-element-number">59</span>
                        <span class="PTP-element-symbol">Pr</span>
                        <span class="PTP-element-name">${msgs.Praseodymium}</span>
                    </div>
                </td>
                <td class="PTP-lanthanoid">
                    <div class="PTP-element" data-number="60">
                        <span class="PTP-atomic-mass">144.24</span>
                        <span class="PTP-element-number">60</span>
                        <span class="PTP-element-symbol">Nd</span>
                        <span class="PTP-element-name">${msgs.Neodymium}</span>
                    </div>
                </td>
                <td class="PTP-lanthanoid">
                    <div class="PTP-element" data-number="61">
                        <span class="PTP-atomic-mass">(145)</span>
                        <span class="PTP-element-number">61</span>
                        <span class="PTP-element-symbol">Pm</span>
                        <span class="PTP-element-name">${msgs.Promethium}</span>
                    </div>
                </td>
                <td class="PTP-lanthanoid">
                    <div class="PTP-element" data-number="62">
                        <span class="PTP-atomic-mass">150.36</span>
                        <span class="PTP-element-number">62</span>
                        <span class="PTP-element-symbol">Sm</span>
                        <span class="PTP-element-name">${msgs.Samarium}</span>
                    </div>
                </td>
                <td class="PTP-lanthanoid">
                    <div class="PTP-element" data-number="63">
                        <span class="PTP-atomic-mass">151.96</span>
                        <span class="PTP-element-number">63</span>
                        <span class="PTP-element-symbol">Eu</span>
                        <span class="PTP-element-name">${msgs.Europium}</span>
                    </div>
                </td>
                <td class="PTP-lanthanoid">
                    <div class="PTP-element" data-number="64">
                        <span class="PTP-atomic-mass">157.25</span>
                        <span class="PTP-element-number">64</span>
                        <span class="PTP-element-symbol">Gd</span>
                        <span class="PTP-element-name">${msgs.Gadolinium}</span>
                    </div>
                </td>
                <td class="PTP-lanthanoid">
                    <div class="PTP-element" data-number="65">
                        <span class="PTP-atomic-mass">158.93</span>
                        <span class="PTP-element-number">65</span>
                        <span class="PTP-element-symbol">Tb</span>
                        <span class="PTP-element-name">${msgs.Terbium}</span>
                    </div>
                </td>
                <td class="PTP-lanthanoid">
                    <div class="PTP-element" data-number="66">
                        <span class="PTP-atomic-mass">162.50</span>
                        <span class="PTP-element-number">66</span>
                        <span class="PTP-element-symbol">Dy</span>
                        <span class="PTP-element-name">${msgs.Dysprosium}</span>
                    </div>
                </td>
                <td class="PTP-lanthanoid">
                    <div class="PTP-element" data-number="67">
                        <span class="PTP-atomic-mass">164.93</span>
                        <span class="PTP-element-number">67</span>
                        <span class="PTP-element-symbol">Ho</span>
                        <span class="PTP-element-name">${msgs.Holmium}</span>
                    </div>
                </td>
                <td class="PTP-lanthanoid">
                    <div class="PTP-element" data-number="68">
                        <span class="PTP-atomic-mass">167.26</span>
                        <span class="PTP-element-number">68</span>
                        <span class="PTP-element-symbol">Er</span>
                        <span class="PTP-element-name">${msgs.Erbium}</span>
                    </div>
                </td>
                <td class="PTP-lanthanoid">
                    <div class="PTP-element" data-number="69">
                        <span class="PTP-atomic-mass">168.93</span>
                        <span class="PTP-element-number">69</span>
                        <span class="PTP-element-symbol">Tm</span>
                        <span class="PTP-element-name">${msgs.Thulium}</span>
                    </div>
                </td>
                <td class="PTP-lanthanoid">
                    <div class="PTP-element" data-number="70">
                        <span class="PTP-atomic-mass">173.04</span>
                        <span class="PTP-element-number">70</span>
                        <span class="PTP-element-symbol">Yb</span>
                        <span class="PTP-element-name">${msgs.Ytterbium}</span>
                    </div>
                </td>
                <td class="PTP-lanthanoid">
                    <div class="PTP-element" data-number="71">
                        <span class="PTP-atomic-mass">174.97</span>
                        <span class="PTP-element-number">71</span>
                        <span class="PTP-element-symbol">Lu</span>
                        <span class="PTP-element-name">${msgs.Lutetium}</span>
                    </div>
                </td>
            </tr>
        </table>        
        <table class="PTP-separate-row">
            <tr>
                <td class="PTP-actinoid">
                    <div class="PTP-element" data-number="89">
                        <span class="PTP-atomic-mass">227</span>
                        <span class="PTP-element-number">89</span>
                        <span class="PTP-element-symbol">Ac</span>
                        <span class="PTP-element-name">${msgs.Actinium}</span>
                    </div>
                </td>
                <td class="PTP-actinoid">
                    <div class="PTP-element" data-number="90">
                        <span class="PTP-atomic-mass">232.04</span>
                        <span class="PTP-element-number">90</span>
                        <span class="PTP-element-symbol">Th</span>
                        <span class="PTP-element-name">${msgs.Thorium}</span>
                    </div>
                </td>
                <td class="PTP-actinoid">
                    <div class="PTP-element" data-number="91">
                        <span class="PTP-atomic-mass">231.04</span>
                        <span class="PTP-element-number">91</span>
                        <span class="PTP-element-symbol">Pa</span>
                        <span class="PTP-element-name">${msgs.Protactinium}</span>
                    </div>
                </td>
                <td class="PTP-actinoid">
                    <div class="PTP-element" data-number="92">
                        <span class="PTP-atomic-mass">238.03</span>
                        <span class="PTP-element-number">92</span>
                        <span class="PTP-element-symbol">U</span>
                        <span class="PTP-element-name">${msgs.Uranium}</span>
                    </div>
                </td>
                <td class="PTP-actinoid">
                    <div class="PTP-element" data-number="93">
                        <span class="PTP-atomic-mass">237</span>
                        <span class="PTP-element-number">93</span>
                        <span class="PTP-element-symbol">Np</span>
                        <span class="PTP-element-name">${msgs.Neptunium}</span>
                    </div>
                </td>
                <td class="PTP-actinoid">
                    <div class="PTP-element" data-number="94">
                        <span class="PTP-atomic-mass">244</span>
                        <span class="PTP-element-number">94</span>
                        <span class="PTP-element-symbol">Pu</span>
                        <span class="PTP-element-name">${msgs.Plutonium}</span>
                    </div>
                </td>
                <td class="PTP-actinoid">
                    <div class="PTP-element" data-number="95">
                        <span class="PTP-atomic-mass">243</span>
                        <span class="PTP-element-number">95</span>
                        <span class="PTP-element-symbol">Am</span>
                        <span class="PTP-element-name">${msgs.Americium}</span>
                    </div>
                </td>
                <td class="PTP-actinoid">
                    <div class="PTP-element" data-number="96">
                        <span class="PTP-atomic-mass">247</span>
                        <span class="PTP-element-number">96</span>
                        <span class="PTP-element-symbol">Cm</span>
                        <span class="PTP-element-name">${msgs.Curium}</span>
                    </div>
                </td>
                <td class="PTP-actinoid">
                    <div class="PTP-element" data-number="97">
                        <span class="PTP-atomic-mass">247</span>
                        <span class="PTP-element-number">97</span>
                        <span class="PTP-element-symbol">Bk</span>
                        <span class="PTP-element-name">${msgs.Berkelium}</span>
                    </div>
                </td>
                <td class="PTP-actinoid">
                    <div class="PTP-element" data-number="98">
                        <span class="PTP-atomic-mass">251</span>
                        <span class="PTP-element-number">98</span>
                        <span class="PTP-element-symbol">Cf</span>
                        <span class="PTP-element-name">${msgs.Californium}</span>
                    </div>
                </td>
                <td class="PTP-actinoid">
                    <div class="PTP-element" data-number="99">
                        <span class="PTP-atomic-mass">252</span>
                        <span class="PTP-element-number">99</span>
                        <span class="PTP-element-symbol">Es</span>
                        <span class="PTP-element-name">${msgs.Einsteinium}</span>
                    </div>
                </td>
                <td class="PTP-actinoid">
                    <div class="PTP-element" data-number="100">
                        <span class="PTP-atomic-mass">257</span>
                        <span class="PTP-element-number">100</span>
                        <span class="PTP-element-symbol">Fm</span>
                        <span class="PTP-element-name">${msgs.Fermium}</span>
                    </div>
                </td>
                <td class="PTP-actinoid">
                    <div class="PTP-element" data-number="101">
                        <span class="PTP-atomic-mass">258</span>
                        <span class="PTP-element-number">101</span>
                        <span class="PTP-element-symbol">Md</span>
                        <span class="PTP-element-name">${msgs.Mendelevium}</span>
                    </div>
                </td>
                <td class="PTP-actinoid">
                    <div class="PTP-element" data-number="102">
                        <span class="PTP-atomic-mass">259</span>
                        <span class="PTP-element-number">102</span>
                        <span class="PTP-element-symbol">No</span>
                        <span class="PTP-element-name">${msgs.Nobelium}</span>
                    </div>
                </td>
                <td class="PTP-actinoid">
                    <div class="PTP-element" data-number="103">
                        <span class="PTP-atomic-mass">266</span>
                        <span class="PTP-element-number">103</span>
                        <span class="PTP-element-symbol">Lr</span>
                        <span class="PTP-element-name">${msgs.Lawrencium}</span>
                    </div>
                </td>
            </tr>
        </table>
        ${$periodicTable.getActiveGame(instance)}      
        `;
        return table;
    },
    elements_dataf: function (instance) {
        const msgs = $periodicTable.options[instance].msgs;
        const elements_data = [
            {
                number: 1,
                symbol: 'H',
                name: msgs.Hydrogen,
                group: msgs.msgNonMetal,
                mass: 1.00794,
                electronegativity: 2.2,
                oxidation: '+1,-1',
                configuration: '1s1',
            },
            {
                number: 2,
                symbol: 'He',
                name: msgs.Helium,
                group: msgs.msgNobleGas,
                mass: 4.0026,
                electronegativity: null,
                oxidation: '0',
                configuration: '1s2',
            },
            {
                number: 3,
                symbol: 'Li',
                name: msgs.Lithium,
                group: msgs.msgAlkaliMetal,
                mass: 6.941,
                electronegativity: 0.98,
                oxidation: '+1',
                configuration: '1s2 2s1',
            },
            {
                number: 4,
                symbol: 'Be',
                name: msgs.Beryllium,
                group: msgs.msgAlkalineEarthMetal,
                mass: 9.0122,
                electronegativity: 1.57,
                oxidation: '+2',
                configuration: '1s2 2s2',
            },
            {
                number: 5,
                symbol: 'B',
                name: msgs.Boron,
                group: msgs.msgMetalloid,
                mass: 10.81,
                electronegativity: 2.04,
                oxidation: '+3',
                configuration: '1s2 2s2 2p1',
            },
            {
                number: 6,
                symbol: 'C',
                name: msgs.Carbon,
                group: msgs.msgNonMetal,
                mass: 12.011,
                electronegativity: 2.55,
                oxidation: '+4,-4',
                configuration: '1s2 2s2 2p2',
            },
            {
                number: 7,
                symbol: 'N',
                name: msgs.Nitrogen,
                group: msgs.msgNonMetal,
                mass: 14.007,
                electronegativity: 3.04,
                oxidation: '+3,-3',
                configuration: '1s2 2s2 2p3',
            },
            {
                number: 8,
                symbol: 'O',
                name: msgs.Oxygen,
                group: msgs.msgNonMetal,
                mass: 15.999,
                electronegativity: 3.44,
                oxidation: '-2',
                configuration: '1s2 2s2 2p4',
            },
            {
                number: 9,
                symbol: 'F',
                name: msgs.Fluorine,
                group: msgs.msgHalogen,
                mass: 18.998,
                electronegativity: 3.98,
                oxidation: '-1',
                configuration: '1s2 2s2 2p5',
            },
            {
                number: 10,
                symbol: 'Ne',
                name: msgs.Neon,
                group: msgs.msgNobleGas,
                mass: 20.18,
                electronegativity: null,
                oxidation: '0',
                configuration: '1s2 2s2 2p6',
            },
            {
                number: 11,
                symbol: 'Na',
                name: msgs.Sodium,
                group: msgs.msgAlkaliMetal,
                mass: 22.99,
                electronegativity: 0.93,
                oxidation: '+1',
                configuration: '1s2 2s2 2p6 3s1',
            },
            {
                number: 12,
                symbol: 'Mg',
                name: msgs.Magnesium,
                group: msgs.msgAlkalineEarthMetal,
                mass: 24.305,
                electronegativity: 1.31,
                oxidation: '+2',
                configuration: '1s2 2s2 2p6 3s2',
            },
            {
                number: 13,
                symbol: 'Al',
                name: msgs.Aluminum,
                group: msgs.msgPostTransitionMetal,
                mass: 26.982,
                electronegativity: 1.61,
                oxidation: '+3',
                configuration: '1s2 2s2 2p6 3s2 3p1',
            },
            {
                number: 14,
                symbol: 'Si',
                name: msgs.Silicon,
                group: msgs.msgMetalloid,
                mass: 28.085,
                electronegativity: 1.9,
                oxidation: '+4,-4',
                configuration: '1s2 2s2 2p6 3s2 3p2',
            },
            {
                number: 15,
                symbol: 'P',
                name: msgs.Phosphorus,
                group: msgs.msgNonMetal,
                mass: 30.974,
                electronegativity: 2.19,
                oxidation: '+5,-3',
                configuration: '1s2 2s2 2p6 3s2 3p3',
            },
            {
                number: 16,
                symbol: 'S',
                name: msgs.Sulfur,
                group: msgs.msgNonMetal,
                mass: 32.065,
                electronegativity: 2.58,
                oxidation: '+6,-2',
                configuration: '1s2 2s2 2p6 3s2 3p4',
            },
            {
                number: 17,
                symbol: 'Cl',
                name: msgs.Chlorine,
                group: msgs.msgHalogen,
                mass: 35.45,
                electronegativity: 3.16,
                oxidation: '-1',
                configuration: '1s2 2s2 2p6 3s2 3p5',
            },
            {
                number: 18,
                symbol: 'Ar',
                name: msgs.Argon,
                group: msgs.msgNobleGas,
                mass: 39.948,
                electronegativity: null,
                oxidation: '0',
                configuration: '1s2 2s2 2p6 3s2 3p6',
            },
            {
                number: 19,
                symbol: 'K',
                name: msgs.Potassium,
                group: msgs.msgAlkaliMetal,
                mass: 39.098,
                electronegativity: 0.82,
                oxidation: '+1',
                configuration: '1s2 2s2 2p6 3s2 3p6 4s1',
            },
            {
                number: 20,
                symbol: 'Ca',
                name: msgs.Calcium,
                group: msgs.msgAlkalineEarthMetal,
                mass: 40.078,
                electronegativity: 1.0,
                oxidation: '+2',
                configuration: '1s2 2s2 2p6 3s2 3p6 4s2',
            },
            {
                number: 21,
                symbol: 'Sc',
                name: msgs.Scandium,
                group: msgs.msgTransitionMetal,
                mass: 44.956,
                electronegativity: 1.36,
                oxidation: '+3',
                configuration: '1s2 2s2 2p6 3s2 3p6 4s2 3d1',
            },
            {
                number: 22,
                symbol: 'Ti',
                name: msgs.Titanium,
                group: msgs.msgTransitionMetal,
                mass: 47.867,
                electronegativity: 1.54,
                oxidation: '+4,+3',
                configuration: '1s2 2s2 2p6 3s2 3p6 4s2 3d2',
            },
            {
                number: 23,
                symbol: 'V',
                name: msgs.Vanadium,
                group: msgs.msgTransitionMetal,
                mass: 50.9415,
                electronegativity: 1.63,
                oxidation: '+5, +4, +3, +2',
                configuration: '[Ar] 3d3 4s2',
            },
            {
                number: 24,
                symbol: 'Cr',
                name: msgs.Chromium,
                group: msgs.msgTransitionMetal,
                mass: 51.9961,
                electronegativity: 1.66,
                oxidation: '+6, +3, +2',
                configuration: '[Ar] 3d5 4s1',
            },
            {
                number: 25,
                symbol: 'Mn',
                name: msgs.Manganese,
                group: msgs.msgTransitionMetal,
                mass: 54.938,
                electronegativity: 1.55,
                oxidation: '+7, +6, +4, +3, +2',
                configuration: '[Ar] 3d5 4s2',
            },
            {
                number: 26,
                symbol: 'Fe',
                name: msgs.Iron,
                group: msgs.msgTransitionMetal,
                mass: 55.845,
                electronegativity: 1.83,
                oxidation: '+3,+2',
                configuration: '[Ar] 3d6 4s2',
            },
            {
                number: 27,
                symbol: 'Co',
                name: msgs.Cobalt,
                group: msgs.msgTransitionMetal,
                mass: 58.933,
                electronegativity: 1.88,
                oxidation: '+3,+2',
                configuration: '[Ar] 3d7 4s2',
            },
            {
                number: 28,
                symbol: 'Ni',
                name: msgs.Nickel,
                group: msgs.msgTransitionMetal,
                mass: 58.693,
                electronegativity: 1.91,
                oxidation: '+2,+3',
                configuration: '[Ar] 3d8 4s2',
            },
            {
                number: 29,
                symbol: 'Cu',
                name: msgs.Copper,
                group: msgs.msgTransitionMetal,
                mass: 63.546,
                electronegativity: 1.9,
                oxidation: '+2,+1',
                configuration: '[Ar] 3d10 4s1',
            },
            {
                number: 30,
                symbol: 'Zn',
                name: msgs.Zinc,
                group: msgs.msgTransitionMetal,
                mass: 65.38,
                electronegativity: 1.65,
                oxidation: '+2',
                configuration: '[Ar] 3d10 4s2',
            },
            {
                number: 31,
                symbol: 'Ga',
                name: msgs.Galium,
                group: msgs.msgPostTransitionMetal,
                mass: 69.723,
                electronegativity: 1.81,
                oxidation: '+3',
                configuration: '[Ar] 3d10 4s2 4p1',
            },
            {
                number: 32,
                symbol: 'Ge',
                name: msgs.Germanium,
                group: msgs.msgMetalloid,
                mass: 72.64,
                electronegativity: 2.01,
                oxidation: '+4,+2',
                configuration: '[Ar] 3d10 4s2 4p2',
            },
            {
                number: 33,
                symbol: 'As',
                name: msgs.Arsenic,
                group: msgs.msgMetalloid,
                mass: 74.922,
                electronegativity: 2.18,
                oxidation: '+3,-3',
                configuration: '[Ar] 3d10 4s2 4p3',
            },
            {
                number: 34,
                symbol: 'Se',
                name: msgs.Selenium,
                group: msgs.msgNonMetal,
                mass: 78.971,
                electronegativity: 2.55,
                oxidation: '-2,+4,+6',
                configuration: '[Ar] 3d10 4s2 4p4',
            },
            {
                number: 35,
                symbol: 'Br',
                name: msgs.Bromine,
                group: msgs.msgHalogen,
                mass: 79.904,
                electronegativity: 2.96,
                oxidation: '-1,+1,+3,+5,+7',
                configuration: '[Ar] 3d10 4s2 4p5',
            },
            {
                number: 36,
                symbol: 'Kr',
                name: msgs.Krypton,
                group: msgs.msgNobleGas,
                mass: 83.798,
                electronegativity: 3.0,
                oxidation: '0',
                configuration: '[Ar] 3d10 4s2 4p6',
            },
            {
                number: 37,
                symbol: 'Rb',
                name: msgs.Rubidium,
                group: msgs.msgAlkaliMetal,
                mass: 85.468,
                electronegativity: 0.82,
                oxidation: '+1',
                configuration: '[Kr] 5s1',
            },
            {
                number: 38,
                symbol: 'Sr',
                name: msgs.Strontium,
                group: msgs.msgAlkalineEarthMetal,
                mass: 87.62,
                electronegativity: 0.95,
                oxidation: '+2',
                configuration: '[Kr] 5s2',
            },
            {
                number: 39,
                symbol: 'Y',
                name: msgs.Yttrium,
                group: msgs.msgTransitionMetal,
                mass: 88.906,
                electronegativity: 1.22,
                oxidation: '+3',
                configuration: '[Kr] 5s2 4d1',
            },
            {
                number: 40,
                symbol: 'Zr',
                name: msgs.Zirconium,
                group: msgs.msgTransitionMetal,
                mass: 91.224,
                electronegativity: 1.33,
                oxidation: '+4',
                configuration: '[Kr] 5s2 4d2',
            },
            {
                number: 41,
                symbol: 'Nb',
                name: msgs.Niobium,
                group: msgs.msgTransitionMetal,
                mass: 92.906,
                electronegativity: 1.6,
                oxidation: '+5,+3',
                configuration: '[Kr] 5s1 4d4',
            },
            {
                number: 42,
                symbol: 'Mo',
                name: msgs.Molybdenum,
                group: msgs.msgTransitionMetal,
                mass: 95.95,
                electronegativity: 2.16,
                oxidation: '+6,+4,+3',
                configuration: '[Kr] 5s1 4d5',
            },
            {
                number: 43,
                symbol: 'Tc',
                name: msgs.Technetium,
                group: msgs.msgTransitionMetal,
                mass: 98,
                electronegativity: 1.9,
                oxidation: '+7,+4,+3',
                configuration: '[Kr] 5s2 4d5',
            },
            {
                number: 44,
                symbol: 'Ru',
                name: msgs.Ruthenium,
                group: msgs.msgTransitionMetal,
                mass: 101.07,
                electronegativity: 2.2,
                oxidation: '+8,+4,+3',
                configuration: '[Kr] 5s1 4d7',
            },
            {
                number: 45,
                symbol: 'Rh',
                name: msgs.Rhodium,
                group: msgs.msgTransitionMetal,
                mass: 102.91,
                electronegativity: 2.28,
                oxidation: '+3,+1',
                configuration: '[Kr] 5s1 4d8',
            },
            {
                number: 46,
                symbol: 'Pd',
                name: msgs.Palladium,
                group: msgs.msgTransitionMetal,
                mass: 106.42,
                electronegativity: 2.2,
                oxidation: '+2,+4',
                configuration: '[Kr] 5s0 4d10',
            },
            {
                number: 47,
                symbol: 'Ag',
                name: msgs.Silver,
                group: msgs.msgTransitionMetal,
                mass: 107.8682,
                electronegativity: 1.93,
                oxidation: '+1',
                configuration: '[Kr] 4d10 5s1',
            },
            {
                number: 48,
                symbol: 'Cd',
                name: msgs.Cadmium,
                group: msgs.msgTransitionMetal,
                mass: 112.411,
                electronegativity: 1.69,
                oxidation: '+2',
                configuration: '[Kr] 4d10 5s2',
            },
            {
                number: 49,
                symbol: 'In',
                name: msgs.Indium,
                group: msgs.msgPostTransitionMetal,
                mass: 114.818,
                electronegativity: 1.78,
                oxidation: '+3',
                configuration: '[Kr] 4d10 5s2 5p1',
            },
            {
                number: 50,
                symbol: 'Sn',
                name: msgs.Tin,
                group: msgs.msgPostTransitionMetal,
                mass: 118.71,
                electronegativity: 1.96,
                oxidation: '+4, +2',
                configuration: '[Kr] 4d10 5s2 5p2',
            },
            {
                number: 51,
                symbol: 'Sb',
                name: msgs.Antimony,
                group: msgs.msgMetalloid,
                mass: 121.76,
                electronegativity: 2.05,
                oxidation: '+3,-3',
                configuration: '[Kr] 5s2 4d10 5p3',
            },
            {
                number: 52,
                symbol: 'Te',
                name: msgs.Tellurium,
                group: msgs.msgMetalloid,
                mass: 127.6,
                electronegativity: 2.01,
                oxidation: '-2,+4,+6',
                configuration: '[Kr] 5s2 4d10 5p4',
            },
            {
                number: 53,
                symbol: 'I',
                name: msgs.Iodine,
                group: msgs.msgHalogen,
                mass: 126.904,
                electronegativity: 2.66,
                oxidation: '-1,+1,+3,+5,+7',
                configuration: '[Kr] 5s2 4d10 5p5',
            },
            {
                number: 54,
                symbol: 'Xe',
                name: msgs.Xenon,
                group: msgs.msgNobleGas,
                mass: 131.293,
                electronegativity: 2.6,
                oxidation: '0',
                configuration: '[Kr] 5s2 4d10 5p6',
            },
            {
                number: 55,
                symbol: 'Cs',
                name: msgs.Cesium,
                group: msgs.msgAlkaliMetal,
                mass: 132.91,
                electronegativity: 0.79,
                oxidation: '+1',
                configuration: '[Xe] 6s1',
            },
            {
                number: 56,
                symbol: 'Ba',
                name: msgs.Barium,
                group: msgs.msgAlkalineEarthMetal,
                mass: 137.33,
                electronegativity: 0.89,
                oxidation: '+2',
                configuration: '[Xe] 6s2',
            },
            {
                number: 57,
                symbol: 'La',
                name: msgs.Lanthanum,
                group: msgs.msgLanthanide,
                mass: 138.905,
                electronegativity: 1.1,
                oxidation: '+3',
                configuration: '[Xe] 5d1 6s2',
            },
            {
                number: 58,
                symbol: 'Ce',
                name: msgs.Cerium,
                group: msgs.msgLanthanide,
                mass: 140.12,
                electronegativity: 1.12,
                oxidation: '+4,+3',
                configuration: '[Xe] 4f1 5d1 6s2',
            },
            {
                number: 59,
                symbol: 'Pr',
                name: msgs.Praseodymium,
                group: msgs.msgLanthanide,
                mass: 140.907,
                electronegativity: 1.13,
                oxidation: '+3',
                configuration: '[Xe] 4f3 6s2',
            },
            {
                number: 60,
                symbol: 'Nd',
                name: msgs.Neodymium,
                group: msgs.msgLanthanide,
                mass: 144.24,
                electronegativity: 1.14,
                oxidation: '+3',
                configuration: '[Xe] 4f4 6s2',
            },
            {
                number: 61,
                symbol: 'Pm',
                name: msgs.Promethium,
                group: msgs.msgLanthanide,
                mass: 145,
                electronegativity: 1.13,
                oxidation: '+3',
                configuration: '[Xe] 4f5 6s2',
            },
            {
                number: 62,
                symbol: 'Sm',
                name: msgs.Samarium,
                group: msgs.msgLanthanide,
                mass: 150.36,
                electronegativity: 1.17,
                oxidation: '+3',
                configuration: '[Xe] 4f6 6s2',
            },
            {
                number: 63,
                symbol: 'Eu',
                name: msgs.Europium,
                group: msgs.msgLanthanide,
                mass: 151.98,
                electronegativity: 1.2,
                oxidation: '+3',
                configuration: '[Xe] 4f7 6s2',
            },
            {
                number: 64,
                symbol: 'Gd',
                name: msgs.Gadolinium,
                group: msgs.msgLanthanide,
                mass: 157.25,
                electronegativity: 1.2,
                oxidation: '+3',
                configuration: '[Xe] 4f7 5d1 6s2',
            },
            {
                number: 65,
                symbol: 'Tb',
                name: msgs.Terbium,
                group: msgs.msgLanthanide,
                mass: 158.93,
                electronegativity: 1.1,
                oxidation: '+3',
                configuration: '[Xe] 4f9 6s2',
            },
            {
                number: 66,
                symbol: 'Dy',
                name: msgs.Dysprosium,
                group: msgs.msgLanthanide,
                mass: 162.5,
                electronegativity: 1.22,
                oxidation: '+3',
                configuration: '[Xe] 4f10 6s2',
            },
            {
                number: 67,
                symbol: 'Ho',
                name: msgs.Holmium,
                group: msgs.msgLanthanide,
                mass: 164.93,
                electronegativity: 1.23,
                oxidation: '+3',
                configuration: '[Xe] 4f11 6s2',
            },
            {
                number: 68,
                symbol: 'Er',
                name: msgs.Erbium,
                group: msgs.msgLanthanide,
                mass: 167.26,
                electronegativity: 1.24,
                oxidation: '+3',
                configuration: '[Xe] 4f12 6s2',
            },
            {
                number: 69,
                symbol: 'Tm',
                name: msgs.Thulium,
                group: msgs.msgLanthanide,
                mass: 168.93,
                electronegativity: 1.25,
                oxidation: '+3',
                configuration: '[Xe] 4f13 6s2',
            },
            {
                number: 70,
                symbol: 'Yb',
                name: msgs.Ytterbium,
                group: msgs.msgLanthanide,
                mass: 173.04,
                electronegativity: 1.1,
                oxidation: '+3',
                configuration: '[Xe] 4f14 6s2',
            },
            {
                number: 71,
                symbol: 'Lu',
                name: msgs.Lutetium,
                group: msgs.msgLanthanide,
                mass: 175.0,
                electronegativity: 1.27,
                oxidation: '+3',
                configuration: '[Xe] 4f14 5d1 6s2',
            },
            {
                number: 72,
                symbol: 'Hf',
                name: msgs.Hafnium,
                group: msgs.msgTransitionMetal,
                mass: 178.49,
                electronegativity: 1.3,
                oxidation: '+4',
                configuration: '[Xe] 4f14 5d2 6s2',
            },
            {
                number: 73,
                symbol: 'Ta',
                name: msgs.Tantalum,
                group: msgs.msgTransitionMetal,
                mass: 180.95,
                electronegativity: 1.5,
                oxidation: '+5,+3',
                configuration: '[Xe] 4f14 5d3 6s2',
            },
            {
                number: 74,
                symbol: 'W',
                name: msgs.Tungsten,
                group: msgs.msgTransitionMetal,
                mass: 183.84,
                electronegativity: 2.36,
                oxidation: '+6, +5, +4, +3, +2, 0',
                configuration: '[Xe] 4f14 5d4 6s2',
            },
            {
                number: 75,
                symbol: 'Re',
                name: msgs.Rhenium,
                group: msgs.msgTransitionMetal,
                mass: 186.207,
                electronegativity: 1.9,
                oxidation: '+7, +6, +4, +2, -1',
                configuration: '[Xe] 4f14 5d5 6s2',
            },
            {
                number: 76,
                symbol: 'Os',
                name: msgs.Osmium,
                group: msgs.msgTransitionMetal,
                mass: 190.23,
                electronegativity: 2.2,
                oxidation: '+4,+3',
                configuration: '[Xe] 4f14 5d6 6s2',
            },
            {
                number: 77,
                symbol: 'Ir',
                name: msgs.Iridium,
                group: msgs.msgTransitionMetal,
                mass: 192.22,
                electronegativity: 2.2,
                oxidation: '+4,+3,+2',
                configuration: '[Xe] 4f14 5d7 6s2',
            },
            {
                number: 78,
                symbol: 'Pt',
                name: msgs.Platinum,
                group: msgs.msgTransitionMetal,
                mass: 195.08,
                electronegativity: 2.28,
                oxidation: '+4,+2',
                configuration: '[Xe] 4f14 5d9 6s1',
            },
            {
                number: 79,
                symbol: 'Au',
                name: msgs.Gold,
                group: msgs.msgTransitionMetal,
                mass: 196.967,
                electronegativity: 2.54,
                oxidation: '+3,+1',
                configuration: '[Xe] 4f14 5d10 6s1',
            },
            {
                number: 80,
                symbol: 'Hg',
                name: msgs.Mercury,
                group: msgs.msgTransitionMetal,
                mass: 200.59,
                electronegativity: 2.0,
                oxidation: '+2',
                configuration: '[Xe] 4f14 5d10 6s2',
            },
            {
                number: 81,
                symbol: 'Tl',
                name: msgs.Thallium,
                group: msgs.msgPostTransitionMetal,
                mass: 204.38,
                electronegativity: 1.62,
                oxidation: '+3,+1',
                configuration: '[Xe] 4f14 5d10 6s2 6p1',
            },
            {
                number: 82,
                symbol: 'Pb',
                name: msgs.Lead,
                group: msgs.msgPostTransitionMetal,
                mass: 207.2,
                electronegativity: 2.33,
                oxidation: '+4,+2',
                configuration: '[Xe] 4f14 5d10 6s2 6p2',
            },
            {
                number: 83,
                symbol: 'Bi',
                name: msgs.Bismuth,
                group: msgs.msgPostTransitionMetal,
                mass: 208.98,
                electronegativity: 2.02,
                oxidation: '+3,+5',
                configuration: '[Xe] 4f14 5d10 6s2 6p3',
            },
            {
                number: 84,
                symbol: 'Po',
                name: msgs.Polonium,
                group: msgs.msgMetalloid,
                mass: 209,
                electronegativity: 2.0,
                oxidation: '+2,+4',
                configuration: '[Xe] 4f14 5d10 6s2 6p4',
            },
            {
                number: 85,
                symbol: 'At',
                name: msgs.Astatine,
                group: msgs.msgHalogen,
                mass: 210,
                electronegativity: 2.2,
                oxidation: '+1,-1',
                configuration: '[Xe] 4f14 5d10 6s2 6p5',
            },
            {
                number: 86,
                symbol: 'Rn',
                name: msgs.Radon,
                group: msgs.msgNobleGas,
                mass: 222,
                electronegativity: null,
                oxidation: '0',
                configuration: '[Xe] 4f14 5d10 6s2 6p6',
            },
            {
                number: 87,
                symbol: 'Fr',
                name: msgs.Francium,
                group: msgs.msgAlkaliMetal,
                mass: 223,
                electronegativity: 0.7,
                oxidation: '+1',
                configuration: '[Rn] 7s1',
            },
            {
                number: 88,
                symbol: 'Ra',
                name: msgs.Radium,
                group: msgs.msgAlkalineEarthMetal,
                mass: 226,
                electronegativity: 0.9,
                oxidation: '+2',
                configuration: '[Rn] 7s2',
            },
            {
                number: 89,
                symbol: 'Ac',
                name: msgs.Actinium,
                group: msgs.msgActinide,
                mass: 227,
                electronegativity: 1.1,
                oxidation: '+3',
                configuration: '[Rn] 6d1 7s2',
            },
            {
                number: 90,
                symbol: 'Th',
                name: msgs.Thorium,
                group: msgs.msgActinide,
                mass: 232.04,
                electronegativity: 1.3,
                oxidation: '+4',
                configuration: '[Rn] 6d2 7s2',
            },
            {
                number: 91,
                symbol: 'Pa',
                name: msgs.Protactinium,
                group: msgs.msgActinide,
                mass: 231.04,
                electronegativity: 1.5,
                oxidation: '+5',
                configuration: '[Rn] 5f2 6d1 7s2',
            },
            {
                number: 92,
                symbol: 'U',
                name: msgs.Uranium,
                group: msgs.msgActinide,
                mass: 238.03,
                electronegativity: 1.38,
                oxidation: '+6,+4,+3',
                configuration: '[Rn] 5f3 6d1 7s2',
            },
            {
                number: 93,
                symbol: 'Np',
                name: msgs.Neptunium,
                group: msgs.msgActinide,
                mass: 237,
                electronegativity: 1.36,
                oxidation: '+5',
                configuration: '[Rn] 5f4 6d1 7s2',
            },
            {
                number: 94,
                symbol: 'Pu',
                name: msgs.Plutonium,
                group: msgs.msgActinide,
                mass: 244,
                electronegativity: 1.38,
                oxidation: '+6,+4',
                configuration: '[Rn] 5f6 6d1 7s2',
            },
            {
                number: 95,
                symbol: 'Am',
                name: msgs.Americium,
                group: msgs.msgActinide,
                mass: 243,
                electronegativity: 1.3,
                oxidation: '+3,+6',
                configuration: '[Rn] 5f7 6d1 7s2',
            },
            {
                number: 96,
                symbol: 'Cm',
                name: msgs.Curium,
                group: msgs.msgActinide,
                mass: 247,
                electronegativity: 1.3,
                oxidation: '+3',
                configuration: '[Rn] 5f7 6d1 7s2',
            },
            {
                number: 97,
                symbol: 'Bk',
                name: msgs.Berkelium,
                group: msgs.msgActinide,
                mass: 247,
                electronegativity: 1.3,
                oxidation: '+4, +3',
                configuration: '[Rn] 5f9 7s2',
            },
            {
                number: 98,
                symbol: 'Cf',
                name: msgs.Californium,
                group: msgs.msgActinide,
                mass: 251,
                electronegativity: 1.3,
                oxidation: '+3, +2',
                configuration: '[Rn] 5f10 7s2',
            },
            {
                number: 99,
                symbol: 'Es',
                name: msgs.Einsteinium,
                group: msgs.msgActinide,
                mass: 252,
                electronegativity: 1.3,
                oxidation: '+3, +2',
                configuration: '[Rn] 5f11 7s2',
            },
            {
                number: 100,
                symbol: 'Fm',
                name: msgs.Fermium,
                group: msgs.msgActinide,
                mass: 257,
                electronegativity: 1.3,
                oxidation: '+3, +2',
                configuration: '[Rn] 5f12 7s2',
            },
            {
                number: 101,
                symbol: 'Md',
                name: msgs.Mendelevium,
                group: msgs.msgActinide,
                mass: 258,
                electronegativity: 1.3,
                oxidation: '+3, +2',
                configuration: '[Rn] 5f13 7s2',
            },
            {
                number: 102,
                symbol: 'No',
                name: msgs.Nobelium,
                group: msgs.msgActinide,
                mass: 259,
                electronegativity: 1.3,
                oxidation: '+3',
                configuration: '[Rn] 5f14 6d1 7s2',
            },
            {
                number: 103,
                symbol: 'Lr',
                name: msgs.Lawrencium,
                group: msgs.msgActinide,
                mass: 262,
                electronegativity: 1.3,
                oxidation: '+3',
                configuration: '[Rn] 5f14 6d1 7s2',
            },
            {
                number: 104,
                symbol: 'Rf',
                name: msgs.Rutherfordium,
                group: msgs.msgTransitionMetal,
                mass: 267,
                electronegativity: 1.3,
                oxidation: '+4',
                configuration: '[Rn] 5f14 6d2 7s2',
            },
            {
                number: 105,
                symbol: 'Db',
                name: msgs.Dubnium,
                group: msgs.msgTransitionMetal,
                mass: 270,
                electronegativity: 1.3,
                oxidation: '+5',
                configuration: '[Rn] 5f14 6d3 7s2',
            },
            {
                number: 106,
                symbol: 'Sg',
                name: msgs.Seaborgium,
                group: msgs.msgTransitionMetal,
                mass: 271,
                electronegativity: 1.3,
                oxidation: '+6',
                configuration: '[Rn] 5f14 6d4 7s2',
            },
            {
                number: 107,
                symbol: 'Bh',
                name: msgs.Bohrium,
                group: msgs.msgTransitionMetal,
                mass: 270,
                electronegativity: 1.3,
                oxidation: '+7',
                configuration: '[Rn] 5f14 6d5 7s2',
            },
            {
                number: 108,
                symbol: 'Hs',
                name: msgs.Hassium,
                group: msgs.msgTransitionMetal,
                mass: 277,
                electronegativity: 1.3,
                oxidation: '+7',
                configuration: '[Rn] 5f14 6d6 7s2',
            },
            {
                number: 109,
                symbol: 'Mt',
                name: msgs.Meitnerium,
                group: msgs.msgTransitionMetal,
                mass: 278,
                electronegativity: 1.3,
                oxidation: '+7',
                configuration: '[Rn] 5f14 6d7 7s2',
            },
            {
                number: 110,
                symbol: 'Ds',
                name: msgs.Darmstadtium,
                group: msgs.msgTransitionMetal,
                mass: 281,
                electronegativity: 1.3,
                oxidation: '+8',
                configuration: '[Rn] 5f14 6d8 7s2',
            },
            {
                number: 111,
                symbol: 'Rg',
                name: msgs.Roentgenium,
                group: msgs.msgTransitionMetal,
                mass: 280,
                electronegativity: 1.3,
                oxidation: '+1',
                configuration: '[Rn] 5f14 6d9 7s2',
            },
            {
                number: 112,
                symbol: 'Cn',
                name: msgs.Copernicium,
                group: msgs.msgTransitionMetal,
                mass: 285,
                electronegativity: 1.3,
                oxidation: '+2',
                configuration: '[Rn] 5f14 6d10 7s2',
            },
            {
                number: 113,
                symbol: 'Nh',
                name: msgs.Nihonium,
                group: msgs.msgPostTransitionMetal,
                mass: 284,
                electronegativity: 1.3,
                oxidation: '+3',
                configuration: '[Rn] 5f14 6d10 7p1',
            },
            {
                number: 114,
                symbol: 'Fl',
                name: msgs.Flerovium,
                group: msgs.msgPostTransitionMetal,
                mass: 289,
                electronegativity: 1.3,
                oxidation: '+4',
                configuration: '[Rn] 5f14 6d10 7p2',
            },
            {
                number: 115,
                symbol: 'Mc',
                name: msgs.Moscovium,
                group: msgs.msgPostTransitionMetal,
                mass: 288,
                electronegativity: 1.3,
                oxidation: '+3',
                configuration: '[Rn] 5f14 6d10 7p3',
            },
            {
                number: 116,
                symbol: 'Lv',
                name: msgs.Livermorium,
                group: msgs.msgPostTransitionMetal,
                mass: 293,
                electronegativity: 1.3,
                oxidation: '+3',
                configuration: '[Rn] 5f14 6d10 7p4',
            },
            {
                number: 117,
                symbol: 'Ts',
                name: msgs.Tennessine,
                group: msgs.msgHalogen,
                mass: 294,
                electronegativity: 1.3,
                oxidation: '+1',
                configuration: '[Rn] 5f14 6d10 7p5',
            },
            {
                number: 118,
                symbol: 'Og',
                name: msgs.Oganesson,
                group: msgs.msgNobleGas,
                mass: 294,
                electronegativity: 1.3,
                oxidation: '0',
                configuration: '[Rn] 5f14 6d10 7p6',
            },
        ];
        return elements_data;
    },
};
$(function () {
    $periodicTable.init();
});
