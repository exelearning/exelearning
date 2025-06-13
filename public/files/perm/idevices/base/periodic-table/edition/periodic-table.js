/* eslint-disable no-undef */
/**
/**
 * Periodic table Activity iDevice (edition code)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narvaez Martinez
 * Author: Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */

var $exeDevice = {
    i18n: {
        category: _('Games'),
        name: _('Crossword'),
    },
    msgs: {},
    classIdevice: 'periodic-table',
    version: 1,
    id: false,
    idevicePath: '',
    ci18n: {
        msgReply: c_('Reply'),
        msgEnterCode: c_('Enter the access code'),
        msgErrorCode: c_('The access code is not correct'),
        msgIndicateWord: c_('Provide a word or phrase'),
        msgClue: c_('Cool! The clue is:'),
        msgCodeAccess: c_('Access code'),
        msgRequiredAccessKey: c_('Access code required'),
        msgInformationLooking: c_('Cool! The information you were looking for'),
        msgPlayStart: c_('Click here to play'),
        msgErrors: c_('Errors'),
        msgHits: c_('Hits'),
        msgScore: c_('Score'),
        msgWeight: c_('Weight'),
        msgMinimize: c_('Minimize'),
        msgMaximize: c_('Maximize'),
        msgTime: c_('Time Limit (mm:ss)'),
        msgFullScreen: c_('Full Screen'),
        msgExitFullScreen: c_('Exit Full Screen'),
        msgNumQuestions: c_('Number of questions'),
        msgAttempts: c_('Number of attempts'),
        msgNoImage: c_('No picture question'),
        msgCool: c_('Cool!'),
        mgsAllQuestions: c_('Questions completed!'),
        msgSuccesses: c_('Right! | Excellent! | Great! | Very good! | Perfect!'),
        msgFailures: c_('It was not that! | Incorrect! | Not correct! | Sorry! | Error!'),
        msgTryAgain: c_('You need at least %s&percnt; of correct answers to get the information. Please try again.'),
        msgEndGameScore: c_('Please start the game before saving your score.'),
        msgScoreScorm: c_("The score can't be saved because this page is not part of a SCORM package."),
        msgOnlySaveScore: c_('You can only save the score once!'),
        msgOnlySave: c_('You can only save once'),
        msgInformation: c_('Information'),
        msgYouScore: c_('Your score'),
        msgOnlySaveAuto: c_('Your score will be saved after each question. You can only play once.'),
        msgSaveAuto: c_('Your score will be automatically saved after each question.'),
        msgSeveralScore: c_('You can save the score as many times as you want'),
        msgYouLastScore: c_('The last score saved is'),
        msgActityComply: c_('You have already done this activity.'),
        msgPlaySeveralTimes: c_('You can do this activity as many times as you want'),
        msgClose: c_('Close'),
        msgLoading: c_('Loading. Please wait...'),
        msgCorrect: c_('Correct'),
        msgIncorrect: c_('Incorrect'),
        msgUncompletedActivity: c_('Incomplete activity'),
        msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
        msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
        msgAtomicNumber: c_('Atomic number'),
        msgNumberClick: c_('Find the element with the number'),
        msgSymbolClick: c_('Click on this chemical element'),
        msgNameClick: c_('Click on this chemical element'),
        msgTypeGame: c_('Periodic table'),
        msgCheck: c_('Verify'),
        msgShowSolution: c_('Show solutions'),
        msgReboot: c_('Play again'),
        msgIdentify: c_('Identify'),
        msgGameOver: c_('The game is over. Your score is %s. Correct answers: %s out of %s.'),
        msgNumberValid: c_('Enter a valid atomic number'),
        msgNameValid: c_('The element name must contain only letters'),
        msgSymbolValid: c_('The symbol must contain one or two letters, starting with an uppercase letter'),
        msgGroupValid: c_('Select a group of chemical elements'),
        msgConfigurationValid: c_('Write a valid configuration based, if applicable, on the preceding noble gas'),
        msgOxitacionValid: c_('Enter the oxidation states of this element, separated by commas'),
        msgAtomicNumber: c_('Atomic number'),
        msgNumberClick: c_('Find the element with the number'),
        msgSymbolClick: c_('Click on this chemical element'),
        msgNameClick: c_('Click on this chemical element'),        
        msgOneElement : c_('Click on a chemical element'),
        msgOtherElement : c_('Correct. Click on another element'),
        msgNotOK : c_('That is not correct. Try again'),
        msgNotAttempts : c_('You have used all your attempts. Try another element'),
        msgNotAttemptsEQ : c_('Try another element'),
        msgOtherEQ : c_('That is not correct. Next element'),
        msgIsOKEQ : c_('Correct. This is the chemical element we are looking for'),
        msgIsErrorAt : c_('That is not correct. You clicked on: %s. Number of attempts: %d. Try again'),
        msgIsEndAttempts : c_('You have used all your attempts'),
        mgsNotOkClick :c_('That is not correct. You clicked on: %s.'),
        mgsCompleteEQ : c_('Complete the missing information in this element'),
        mgsSelectEQ :c_('Click on one of the marked chemical elements.'),
        msgNumber: c_('Number'),
        msgGroup: c_('Group'),
        msgNewTry: c_('Try again!'),
        msgSymbol: c_('Symbol'),
        msgName: c_('Name'),
        msgConfiguration: c_('Configuration'),
        msgCOxidationos: c_('Oxidations'),
        msgAccept: c_('Accept'),
        msgCancel: c_('Cancel'),
        msgAlkaliMetal: c_('Alkali metal'),
        msgAlkalineEarthMetal: c_('Alkaline earth metal'),
        msgTransitionMetal: c_('Transition metal'),
        msgPostTransitionMetal: c_('Post-transition metal'),
        msgMetalloid: c_('Metalloid'),
        msgNonMetal: c_('Non-metal'),
        msgHalogen: c_('Halogen'),
        msgNobleGas: c_('Noble gas'),
        msgLanthanide: c_('Lanthanide'),
        msgActinide: c_('Actinide'),
        Hydrogen: c_('Hydrogen'),
        Helium: c_('Helium'),
        Lithium: c_('Lithium'),
        Beryllium: c_('Beryllium'),
        Boron: c_('Boron'),
        Carbon: c_('Carbon'),
        Nitrogen: c_('Nitrogen'),
        Oxygen: c_('Oxygen'),
        Fluorine: c_('Fluorine'),
        Neon: c_('Neon'),
        Sodium: c_('Sodium'),
        Magnesium: c_('Magnesium'),
        Aluminum: c_('Aluminum'),
        Silicon: c_('Silicon'),
        Phosphorus: c_('Phosphorus'),
        Sulfur: c_('Sulfur'),
        Chlorine: c_('Chlorine'),
        Argon: c_('Argon'),
        Potassium: c_('Potassium'),
        Calcium: c_('Calcium'),
        Scandium: c_('Scandium'),
        Titanium: c_('Titanium'),
        Vanadium: c_('Vanadium'),
        Chromium: c_('Chromium'),
        Manganese: c_('Manganese'),
        Iron: c_('Iron'),
        Cobalt: c_('Cobalt'),
        Nickel: c_('Nickel'),
        Copper: c_('Copper'),
        Zinc: c_('Zinc'),
        Gallium: c_('Gallium'),
        Germanium: c_('Germanium'),
        Arsenic: c_('Arsenic'),
        Selenium: c_('Selenium'),
        Bromine: c_('Bromine'),
        Krypton: c_('Krypton'),
        Rubidium: c_('Rubidium'),
        Strontium: c_('Strontium'),
        Yttrium: c_('Yttrium'),
        Zirconium: c_('Zirconium'),
        Niobium: c_('Niobium'),
        Molybdenum: c_('Molybdenum'),
        Technetium: c_('Technetium'),
        Ruthenium: c_('Ruthenium'),
        Rhodium: c_('Rhodium'),
        Palladium: c_('Palladium'),
        Silver: c_('Silver'),
        Cadmium: c_('Cadmium'),
        Indium: c_('Indium'),
        Tin: c_('Tin'),
        Antimony: c_('Antimony'),
        Tellurium: c_('Tellurium'),
        Iodine: c_('Iodine'),
        Xenon: c_('Xenon'),
        Cesium: c_('Cesium'),
        Barium: c_('Barium'),
        Lanthanum: c_('Lanthanum'),
        Cerium: c_('Cerium'),
        Praseodymium: c_('Praseodymium'),
        Neodymium: c_('Neodymium'),
        Promethium: c_('Promethium'),
        Samarium: c_('Samarium'),
        Europium: c_('Europium'),
        Gadolinium: c_('Gadolinium'),
        Terbium: c_('Terbium'),
        Dysprosium: c_('Dysprosium'),
        Holmium: c_('Holmium'),
        Erbium: c_('Erbium'),
        Thulium: c_('Thulium'),
        Ytterbium: c_('Ytterbium'),
        Lutetium: c_('Lutetium'),
        Hafnium: c_('Hafnium'),
        Tantalum: c_('Tantalum'),
        Tungsten: c_('Tungsten'),
        Rhenium: c_('Rhenium'),
        Osmium: c_('Osmium'),
        Iridium: c_('Iridium'),
        Platinum: c_('Platinum'),
        Gold: c_('Gold'),
        Mercury: c_('Mercury'),
        Thallium: c_('Thallium'),
        Lead: c_('Lead'),
        Bismuth: c_('Bismuth'),
        Polonium: c_('Polonium'),
        Astatine: c_('Astatine'),
        Radon: c_('Radon'),
        Francium: c_('Francium'),
        Radium: c_('Radium'),
        Actinium: c_('Actinium'),
        Thorium: c_('Thorium'),
        Protactinium: c_('Protactinium'),
        Uranium: c_('Uranium'),
        Neptunium: c_('Neptunium'),
        Plutonium: c_('Plutonium'),
        Americium: c_('Americium'),
        Curium: c_('Curium'),
        Berkelium: c_('Berkelium'),
        Californium: c_('Californium'),
        Einsteinium: c_('Einsteinium'),
        Fermium: c_('Fermium'),
        Mendelevium: c_('Mendelevium'),
        Nobelium: c_('Nobelium'),
        Lawrencium: c_('Lawrencium'),
        Rutherfordium: c_('Rutherfordium'),
        Dubnium: c_('Dubnium'),
        Seaborgium: c_('Seaborgium'),
        Bohrium: c_('Bohrium'),
        Hassium: c_('Hassium'),
        Meitnerium: c_('Meitnerium'),
        Darmstadtium: c_('Darmstadtium'),
        Roentgenium: c_('Roentgenium'),
        Copernicium: c_('Copernicium'),
        Nihonium: c_('Nihonium'),
        Flerovium: c_('Flerovium'),
        Moscovium: c_('Moscovium'),
        Livermorium: c_('Livermorium'),
        Tennessine: c_('Tennessine'),
        Oganesson: c_('Oganesson'),
    },

    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.ci18n.msgTryAgain = this.ci18n.msgTryAgain.replace(
            '&percnt;',
            '%',
        ); 

        this.setMessagesInfo();
        this.createForm();
    },

    setMessagesInfo: function () {
        const msgs = this.msgs;
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.',
        );
        msgs.msgIDLenght = _(
            'The report identifier must have at least 5 characters',
        );
        msgs.msgMaximeSize = _(
            'The word cannot contain more than fourteen characters or white spaces',
        );
        msgs.msgSeletOneType = _(
            'You must select at least one type of data to complet',
        );
        msgs.msgSeletOneGroup = _(
            'You must select at least one group of elements',
        );
    },

    createForm: function () {
        const path = $exeDevice.idevicePath,
            html = `
        <div id="ptQEIdeviceForm">
            <p class="exe-block-info exe-block-dismissible">
                ${_('Create interactive activities for the periodic table')} 
                <a style="display:none;" href="https://youtu.be/br6S9kcuJI8" hreflang="es" target="_blank">${_('Usage Instructions')}</a>
                <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
            </p>
            <div class="exe-form-tab" title="${_('General settings')}">
                ${$exeDevices.iDevice.gamification.instructions.getFieldset(c_('Complete the following questions about the periodic table.'))}
                <fieldset class="exe-fieldset">
                    <legend><a href="#">${_('Options')}</a></legend>
                        <div>
                            <p>
                                <span>${_('Mode')}: </span>
                                <label for="ptETypeGame"><input class="PTP-Mode"  id="ptEGame" type="radio" name="ptmode" value="0" checked="checked" />${_('Game')}</label>
                                <label for="ptETypeComplete"><input class="PTP-Mode" id="ptEComplete" type="radio" name="ptmode" value="1" />${_('Complete')}</label>
                                <label for="ptETypeMobile"><input class="PTP-Mode" id="ptEMobile" type="radio" name="ptmode" value="2" />${_('Mobile')}</label>
                            </p>                    
                            <p id="ptCompleteData" style="display:none">
                                <span>${_('Data to complete')}: </span>
                                <label for="ptEnumber"><input type="checkbox" id="ptEnumber"/>${_('Number')}</label>
                                <label for="ptEname"><input type="checkbox" id="ptEname"/>${_('Name')}</label>
                                <label for="ptEsymbol"><input type="checkbox" id="ptEsymbol" checked="checked"/>${_('Symbol')}</label>
                                <label for="ptEgroup"><input type="checkbox" id="ptEgroup" />${_('Group')}</label>
                                <label for="ptEelectronicConfig" style="display:none"><input type="checkbox" id="ptEelectronicConfig" />${_('Electronic configuration')}</label>
                                <label for="ptEoxidations"style="display:none"><input type="checkbox" id="ptEoxidations" />${_('Oxidation states')}</label>
                            </p>
                            <p id="ptGameType">
                                <span>${_('Type')}: </span>
                                <label for="ptETypeNumber"><input class="PTP-TypeGame" id="ptETypeNumber" type="radio" name="ptgametype" value="0" /> ${_('Number')}</label>
                                <label for="ptETypeName"><input class="PTP-TypeGame" id="ptETypeName" type="radio" name="ptgametype" value="1" />${_('Name')}</label>
                                <label for="ptETypeSymbol"><input class="PTP-TypeGame" id="ptETypeSymbol" type="radio" name="ptgametype" value="2"  checked="checked"/>${_('Symbol')}</label>
                            </p>
                            <p class="PTP-periodic-table-groups" id="ptCheckBoxesGroups">
                                ${$exeDevice.generateGroupCheckboxes()}
                            </p>                        
                            <p>
                                <label for="ptEQuestionNumber">${_('Number of questions')}: <input type="number" id="ptEQuestionNumber" value="5" min="1" max="99" /></label>
                            </p> 
                             <p>
                                <label for="ptEAttemptsNumber">${_('Number of attempts')}: <input type="number" id="ptEAttemptsNumber" value="1" min="0" max="99" /></label>
                            </p>                         
                            <p>
                                <label for="ptEShowSolution">
                                    <input type="checkbox" checked id="ptEShowSolution">${_('Show solutions')}.</label> 
                            </p>
                            <p>
                                <label for="ptEShowMinimize"><input type="checkbox" id="ptEShowMinimize">${_('Show minimized.')}</label>
                            </p> 
                            <p>
                                <label for="ptEHasFeedBack">
                                    <input type="checkbox" id="ptEHasFeedBack">${_('Feedback')}.</label> 
                                <label for="ptEPercentajeFB">
                                    <input type="number" name="ptEPercentajeFB" id="ptEPercentajeFB" value="100" min="5" max="100" step="5" disabled />${_('&percnt; right to see the feedback')}</label>
                            </p>
                            <p id="ptEFeedbackP" class="PTE-EFeedbackP">
                                <textarea id="ptEFeedBackEditor" class="exe-html-editor"></textarea>
                            </p>
                            <p class="Games-Reportdiv">
                                <strong class="GameModeLabel">
                                    <a href="#ptEEvaluationHelp" id="ptEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                        <img src="${path}quextIEHelp.gif" width="16" height="16" alt="${_('Help')}"/>
                                    </a>
                                </strong>
                                <input type="checkbox" id="ptEEvaluation">  <label for="ptEEvaluation">${_('Progress report')}. </label>                        
                                <label for="ptEEvaluationID">${_('Identifier')}: </label><input type="text" id="ptEEvaluationID" disabled/> 
                            </p>
                            <div id="ptEEvaluationHelp" class="PTE-TypeGameHelp" style="display:none;">
                                <p class="exe-block-info exe-block-dismissible" >${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}</p>
                            </div>
                     </div>
                </fieldset>                
                ${$exeDevices.iDevice.common.getTextFieldset('after')}
            </div>
            ${$exeDevices.iDevice.gamification.itinerary.getTab()}
            ${$exeDevices.iDevice.gamification.scorm.getTab()}
            ${$exeDevices.iDevice.gamification.common.getLanguageTab(this.ci18n)}
        </div>
    `;
        this.ideviceBody.innerHTML = html;
        $exeDevices.iDevice.tabs.init('ptQEIdeviceForm');
        $exeDevices.iDevice.gamification.scorm.init();
        $exeDevice.enableForm();
    },

    enableForm: function () {
        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
    },

    getIdeviceID: function () {
        const ideviceid =
            $('#ptQEIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';
        return ideviceid;
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            const wrapper = $('<div></div>').html(originalHTML),
                json = $('.periodic-table-DataGame', wrapper).text();

            let dataJson = json;

            const dataGame =
                $exeDevices.iDevice.gamification.helpers.isJsonString(dataJson);

            $exeDevice.updateFieldGame(dataGame);

            let instructions = $('.periodic-table-instructions', wrapper);
            if (instructions.length === 1) {
                instructions = instructions.html() || '';
                $('#eXeGameInstructions').val(instructions);
            }

            let textFeedBack = $('.periodic-table-feedback-game', wrapper);
            if (textFeedBack.length === 1) {
                textFeedBack = textFeedBack.html() || '';
                $('#ptEFeedBackEditor').val(textFeedBack);
            }

            let textAfter = $('.periodic-table-extra-content', wrapper);
            if (textAfter.length === 1) {
                textAfter = textAfter.html() || '';
                $('#eXeIdeviceTextAfter').val(textAfter);
            }

            $exeDevices.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs,
            );
        }
    },

    save: function () {
        const dataGame = $exeDevice.validateData();

        if (!dataGame) return false;

        const fields = this.ci18n,
            i18n = fields;
        for (const i in fields) {
            const fVal = $(`#ci18n_${i}`).val();
            if (fVal !== '') i18n[i] = fVal;
        }

        dataGame.msgs = i18n;
        let json = JSON.stringify(dataGame);

        const textFeedBack = tinyMCE.get('ptEFeedBackEditor').getContent();

        let divInstructions = '';
        if (dataGame.instructions !== '') {
            divInstructions = `<div class="periodic-table-instructions">${dataGame.instructions}</div>`;
        }

        let textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();
        if (textAfter !== '') {
            textAfter = `<div class="periodic-table-extra-content">${textAfter}</div>`;
        }
        const html = `<div class="periodic-table-IDevice">
           <div class="game-evaluation-ids js-hidden" data-id="${dataGame.id}" data-evaluationid="${dataGame.evaluationID}"></div>
            <div class="periodic-table-version js-hidden">${$exeDevice.version}</div>
            <div class="periodic-table-feedback-game">${textFeedBack}</div>
            ${divInstructions}
            <div class="periodic-table-DataGame js-hidden">${json}</div>
            ${textAfter}
            <div class="periodic-table-bns js-hidden">${$exeDevice.msgs.msgNoSuportBrowser}</div>
        </div>`;

        return html;
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    checkCheckboxesStatus: function () {
        const checkboxes = [
            '#ptEnumber',
            '#ptEname',
            '#ptEsymbol',
            '#ptEgroup',
            '#ptEelectronicConfig',
            'ptEoxidations',
        ];
        const statusArray = checkboxes.map((selector) =>
            $(selector).is(':checked') ? 1 : 0,
        );
        const anyChecked = statusArray.some((status) => status === 1);

        return anyChecked ? statusArray : false;
    },

    setCheckboxesStatus: function (types) {
        const checkboxes = [
            '#ptEnumber',
            '#ptEname',
            '#ptEsymbol',
            '#ptEgroup',
            '#ptEelectronicConfig',
            'ptEoxidations',
        ];
        if (types.length !== checkboxes.length) {
            console.error(
                'The status array length must match the number of checkboxes.',
            );
            return;
        }
        checkboxes.forEach((selector, index) => {
            $(selector).prop('checked', parseInt(types[index]) === 1);
        });
    },

    generateGroupCheckboxes: function () {
        const groups = [
            'Alkali Metals',
            'Alkaline Earth Metals',
            'Transition Metals',
            'Post-Transition Metals',
            'Metalloids',
            'Non-Metals',
            'Halogens',
            'Noble Gases',
            'Lanthanides',
            'Actinides',
        ];

        let html = '';
        html += `<span>${_('Element Groups')}:</span>`;
        html += `<label><input type="checkbox" checked value="0" />${_('All')}</label>`;
        groups.forEach((group, index) => {
            html += `<label><input type="checkbox" value="${index + 1}" />${_(group)}</label>`;
        });
        return html;
    },

    getCheckboxGroupsStates: function () {
        const checkboxes = document.querySelectorAll(
            ".PTP-periodic-table-groups input[type='checkbox']",
        );
        const states = Array.from(checkboxes).map((checkbox) =>
            checkbox.checked ? 1 : 0,
        );
        const anyChecked = states.some((status) => status === 1);
        return anyChecked ? states : false;
    },

    setCheckboxGroupStates: function (statesArray) {
        const checkboxes = document.querySelectorAll(
            ".PTP-periodic-table-groups input[type='checkbox']",
        );
        checkboxes.forEach((checkbox, index) => {
            checkbox.checked = statesArray[index] === 1;
        });
    },

    validateData: function() {
        const instructions = tinyMCE.get('eXeGameInstructions').getContent(),
            textFeedBack = tinyMCE.get('ptEFeedBackEditor').getContent(),
            textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent(),
            time = $('#ptETime').val(),
            showMinimize = $('#ptEShowMinimize').is(':checked'),
            showSolution = $('#ptEShowSolution').is(':checked'),
            itinerary = $exeDevices.iDevice.gamification.itinerary.getValues(),
            feedBack = $('#ptEHasFeedBack').is(':checked'),
            percentajeFB = parseInt($('#ptEPercentajeFB').val()),
            evaluation = $('#ptEEvaluation').is(':checked'),
            evaluationID = $('#ptEEvaluationID').val(),
            number = $('#ptEQuestionNumber').val(),
            attempts = $('#ptEAttemptsNumber').val(),
            id = $exeDevice.getIdeviceID(),
            types = $exeDevice.checkCheckboxesStatus(),
            groups = $exeDevice.getCheckboxGroupsStates(),
            scorm = $exeDevices.iDevice.gamification.scorm.getValues(),
            mode = parseInt($('input[name=ptmode]:checked').val(), 10),
            gameType = parseInt($('input[name=ptgametype]:checked').val(), 10);

        if (!types) {
            eXe.app.alert($exeDevice.msgs.msgSeletOneType);
            return;
        }
        if (!groups & !mode) {
            eXe.app.alert($exeDevice.msgs.msgSeletOneGroup);
            return;
        }

        if (!itinerary) return false;

        if (feedBack && textFeedBack.trim().length === 0) {
            eXe.app.alert($exeDevice.msgs.msgProvideFB);
            return false;
        }
        if (evaluation && evaluationID.length < 5) {
            eXe.app.alert($exeDevice.msgs.msgIDLenght);
            return false;
        }
        if (itinerary.showClue && itinerary.clueGame.length == '') {
            return false;
        }

        if (
            itinerary.showCodeAccess &&
            (itinerary.codeAccess.length == '' ||
                itinerary.messageCodeAccess.length == '')
        ) {
            return false;
        }
        return {
            typeGame: 'Periodic table',
            types,
            groups,
            instructions,
            showMinimize,
            showSolution,
            itinerary,
            number,
            attempts,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted || 100,
            textFeedBack: escape(textFeedBack),
            textAfter: escape(textAfter),
            feedBack,
            percentajeFB,
            version: $exeDevice.version,
            evaluation,
            evaluationID,
            time,
            mode,
            gameType,
            id,
        };
    },

    addEvents: function () {
        $('#ptEHasFeedBack').on('change', function () {
            const checked = $(this).is(':checked');
            if (checked) {
                $('#ptEFeedbackP').slideDown();
            } else {
                $('#ptEFeedbackP').slideUp();
            }
            $('#ptEPercentajeFB').prop('disabled', !checked);
        });

        $('#ptEEvaluation').on('change', function () {
            const checked = $(this).is(':checked');
            $('#ptEEvaluationID').prop('disabled', !checked);
        });

        $('#ptEEvaluationHelpLnk').on('click', function () {
            $('#ptEEvaluationHelp').toggle();
            return false;
        });

        $('#ptETime')
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 3);
                this.value = v;
            })
            .on('focusout', function () {
                this.value = this.value.trim() === '' ? 0 : this.value;
                this.value = Math.min(Math.max(this.value, 0), 59);
            });

        $('input[name="ptmode"]').on('change', function () {
            var selectedValue = $(this).val();
            if (selectedValue === '1') {
                $('#ptCompleteData').show();
                $('#ptGameType').hide();
            } else if (selectedValue === '0') {
                $('#ptGameType').show();
                $('#ptCompleteData').hide();
            } else if (selectedValue === '2') {
                $('#ptGameType').show();
                $('#ptCompleteData').hide();
            }
        });

        $('#ptCheckBoxesGroups input[type="checkbox"]').on(
            'change',
            function () {
                var selectedValue = $(this).val();

                if (selectedValue === '0') {
                    if ($(this).is(':checked')) {
                        $(
                            '#ptCheckBoxesGroups input[type="checkbox"]:not([value="0"])',
                        ).prop('checked', false);
                    }
                } else {
                    if ($(this).is(':checked') || !$(this).is(':checked')) {
                        $(
                            '#ptCheckBoxesGroups input[type="checkbox"][value="0"]',
                        ).prop('checked', false);
                    }
                }
            },
        );

        $exeDevices.iDevice.gamification.itinerary.addEvents();

        //eXe 3.0 Dismissible messages
        $('.exe-block-dismissible .exe-block-close').on('click', function () {
            $(this).parent().fadeOut();
            return false;
        });
    },

    updateFieldGame: function (game) {
        $exeDevice.active = 0;
        $exeDevices.iDevice.gamification.itinerary.setValues(game.itinerary);
        game.weighted =
            typeof game.weighted !== 'undefined' ? game.weighted : 100;
        $exeDevice.id = $exeDevice.getIdeviceID();

        $exeDevice.setCheckboxesStatus(game.types);
        $exeDevice.setCheckboxGroupStates(game.groups);
        $('#ptEQuestionNumber').val(game.number);
        $('#ptEShowMinimize').prop('checked', game.showMinimize);
        $('#ptETime').val(game.time);
        $('#ptEShowSolution').prop('checked', game.showSolution);
        $('#ptEHasFeedBack').prop('checked', game.feedBack);
        $('#ptEPercentajeFB').val(game.percentajeFB);
        $('#ptEEvaluation').prop('checked', game.evaluation);
        $('#ptEEvaluationID').val(game.evaluationID);
        $('#ptEEvaluationID').prop('disabled', !game.evaluation);
        $('#ptEAttemptsNumber').val(game.attempts);

        $("input[name='ptmode'][value='" + game.mode + "']").prop(
            'checked',
            true,
        );
        $("input[name='ptgametype'][value='" + game.gameType + "']").prop(
            'checked',
            true,
        );
        if (game.mode == 1) {
            $('#ptCompleteData').show();
            $('#ptGameType').hide();
        } else if (game.mode == 0) {
            $('#ptGameType').show();
            $('#ptCompleteData').hide();
        }else if (game.mode == 2) {
            $('#ptCompleteData').hide();
            $('#ptGameType').show();
        } 

        $exeDevices.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted,
        );

        if (game.feedBack) {
            $('#ptEFeedbackP').show();
        } else {
            $('#ptEFeedbackP').hide();
        }

        $('#ptEPercentajeFB').prop('disabled', !game.feedBack);
    },

    validTime: function (time) {
        const reg = /^(?:(?:([01]?\d|2[0-3]):)?([0-5]?\d):)?([0-5]?\d)$/;
        return time.length == 8 && reg.test(time);
    },
};
