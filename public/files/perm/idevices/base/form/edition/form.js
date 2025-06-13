/**
 * Form iDevice
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: SDWEB - Innovative Digital Solutions
 *
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {

    scorm: "",
    iDeviceId: "formIdevice",
    questionsIds: ["dropdown", "selection", "true-false", "fill"],
    i18n: {},
    dataIds: [],

    // ::: String Ids :::
    formPreviewId: "formPreview",

    msgNoQuestionsId: "msgNoQuestions",

    btnQuestionsTop: "buttonHideShowQuestionsTop",
    btnAddTrueFalseTop: "buttonAddTrueFalseQuestionTop",
    btnAddFillTop: "buttonAddFillQuestionTop",
    btnAddDropdownTop: "buttonAddDropdownQuestionTop",
    btnAddSelectionTop: "buttonAddSelectionQuestionTop",

    btnQuestionsBottom: "buttonHideShowQuestionsBottom",
    btnAddTrueFalseBottom: "buttonAddTrueFalseQuestionBottom",
    btnAddFillBottom: "buttonAddFillQuestionBottom",
    btnAddDropdownBottom: "buttonAddDropdownQuestionBottom",
    btnAddSelectionBottom: "buttonAddSelectionQuestionBottom",

    passRateId: "passRateMessage",
    dropdownPassRateId: "dropdownPassRate",
    checkCapitalizationId: "checkCapitalization",
    checkStrictQualificationId: "checkStrictQualification",
    checkAddBtnAnswersId: "checkAddBtnAnswers",

    questionTopBarId: "questionTopBar",
    iconActivityId: "iconActivity",

    langDropdownHelpId: "langDropdownHelp",
    langMultipleSelectionHelpId: "langMultipleSelectionHelp",
    langSingleSelectionHelpId: "langSingleSelectionHelp",
    langFillHelpId: "langFillHelp",
    langTrueFalseHelpId: "langTrueFalseHelp",
    langCheckId: "langChekButton",
    langResetId: "langResetButton",
    langSolutionsId: "langSolutionsButton",

    // ::: Strings for icons :::
    iconSelectOne: "rule",
    iconSelectMultiple: "checklist_rtl",
    iconTrueFalse: "rule",
    iconDropdown: "expand_more", // arrow_drop_down
    iconFill: "horizontal_rule",

    // ::: Reference to drag quesitons :::
    indexDraggingItem: null,
    indexOverItem: null,

    // ::: Outer HTML edit question :::
    dataIdQuestionBeforeEdit: "",

    ideviceBody: '',
    idevicePreviousData: null,
    idevicePreviousData: '',

    id: null,

    questions: [],

    ci18n: {
        "msgScoreScorm": c_("The score can't be saved because this page is not part of a SCORM package."),
        "msgYouScore": c_("You scores is"),
        "msgScore": c_("Score"),
        "msgWeight": c_("Weight"),
        "msgYouLastScore": c_("The last score saved is"),
        "msgOnlySaveScore": c_("You can only save the score once!"),
        "msgOnlySave": c_("You can only save once"),
        "msgOnlySaveAuto": c_("Your score will be saved after each question. You can only play once."),
        "msgSaveAuto": c_("Your score will be automatically saved after each question."),
        "msgSeveralScore": c_("You can save the score as many times as you want"),
        "msgPlaySeveralTimes": c_("You can do this activity as many times as you want"),
        "msgActityComply": c_("You have already done this activity."),
        "msgUncompletedActivity": c_("Incomplete activity"),
        "msgSuccessfulActivity": c_("Activity: Passed. Score: %s"),
        "msgUnsuccessfulActivity": c_("Activity: Not passed. Score: %s"),
        "msgTypeGame": c_('Form'),
        "msgStartGame": c_("Click here to start"),
        "msgTime": c_("Time per question"),
        "msgSaveScore": c_('Save score'),
        'msgResult': c_("Result"),
        'msgCheck': c_("Check"),
        'msgReset': c_("Reset"),
        'msgShowAnswers': c_("Show answers"),
        'msgWeight': ("Weight"),
        'msgTestResultPass': c_("Congratulations! You passed the test"),
        'msgTestResultNotPass': c_("Sorry. You failed the test"),
        'msgTrueFalseHelp': c_("Select whether the statement is true or false"),
        'msgDropdownHelp': c_("Choose the correct answer among the options proposed"),
        'msgFillHelp': c_("Fill in the blanks with the appropriate word"),
        'msgSingleSelectionHelp': c_("Multiple choice with only one correct answer"),
        'msgMultipleSelectionHelp': c_("Multiple choice with multiple corrects answers"),
        'msgPlayStart': c_("Click here to start"),
        'msgTrue': c_("True"),
        'msgFalse': c_("False"),
        'msgNext': c_("Next"),
        'msgPrevious': c_("Previous"),

    },



    /**
     * Init required eXe function
     */
    init: function (element, previousData, path) {
        //** eXeLearning idevice engine data ***************************
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.id = $(element).attr('idevice-id');
        //**************************************************************
        this.msgs = new this.Msgs(this);
        this.questions = this.msgs.generateStringsQuestions(this.questionsIds);
        this.form = new this.Form(this, this.questions);
        this.form.createForm(this.ideviceBody);
        this.form.setBehaviour();
        // this.form.setDefaultValues();
        this.loadPreviousValues();
        this.setBehaviourFormView();
        this.form.hideQuestionsPanel("questionsContainerTop");
        this.form.hideQuestionsPanel("questionsContainerBottom");

    },

    /**
     * loadPreviousValues required eXe function
     */
    loadPreviousValues: function () {
        let previousData = this.idevicePreviousData;
        if (Object.keys(previousData).length === 0) return;

        let instructionsTextarea = $exeDevice.ideviceBody.querySelector("#eXeGameInstructions");
        if (previousData.eXeFormInstructions !== undefined) {
            instructionsTextarea.innerHTML = previousData.eXeFormInstructions;
        }

        let textAfter = $exeDevice.ideviceBody.querySelector("#eXeIdeviceTextAfter");

        if (previousData.eXeIdeviceTextAfter !== undefined) {
            textAfter.innerHTML = previousData.eXeIdeviceTextAfter;
        }

        let formPreview = $exeDevice.ideviceBody.querySelector(`#${$exeDevice.formPreviewId}`);
        if (previousData.questionsData !== undefined) {
            let htmlForm = '<ul id="formPreview">';
            let form = new $exeDevice.Form($exeDevice, $exeDevice.questions);

            previousData.questionsData.forEach(question => {
                let newId = form.generateRandomId();

                if (question.activityType !== $exeDevice.questionsIds[1]) {
                    htmlForm += `<li class="FormView_${question.activityType} FormView_question" data-id="${newId}" activity-type="${question.activityType}" draggable="true">
                            <div id="questionTopBar_${newId}">
                                <label class="activity-title">Activity ${question.activityType}</label>
                                <div class="inline QuestionLabel_ButtonsContainer">
                                <button class="QuestionLabel_moveUp QuestionLabel_actionButton">arrow_upward</button>
                                <button class="QuestionLabel_moveDown QuestionLabel_actionButton">arrow_downward</button>
                                <button class="QuestionLabel_edit QuestionLabel_actionButton">edit</button>
                                <button class="QuestionLabel_remove QuestionLabel_actionButton">close</button>
                                </div>
                            </div>
                            <div id="QuestionElement_${newId}" class="FormViewContainer_${question.activityType} FormViewContainer">`;
                } else {
                    htmlForm += `<li class="FormView_selection FormView_question" data-id="${newId}" activity-type="selection" selection-type="${question.selectionType}" draggable="true">
                            <div id="questionTopBar_${newId}">
                            <label class="activity-title">Activity ${question.selectionType} selection</label>
                            <div class="inline QuestionLabel_ButtonsContainer">
                                <button class="QuestionLabel_moveUp QuestionLabel_actionButton">arrow_upward</button>
                                <button class="QuestionLabel_moveDown QuestionLabel_actionButton">arrow_downward</button>
                                <button class="QuestionLabel_edit QuestionLabel_actionButton">edit</button>
                                <button class="QuestionLabel_remove QuestionLabel_actionButton">close</button>
                            </div>
                            </div>
                            <div id="QuestionElement_${newId}" class="FormViewContainer_selection FormViewContainer">`;
                }
                let texclear = '';
                switch (question.activityType) {
                    case $exeDevice.questionsIds[0]: // dropdown.
                        htmlForm += form.getProcessTextDropdownQuestion(question.baseText, question.wrongAnswersValue);
                        htmlForm += `</div></li>`;
                        break;
                    case $exeDevice.questionsIds[1]: // selection
                        let radioOrCheckbox = "radio";
                        if (question.selectionType === "multiple") {
                            radioOrCheckbox = "checkbox";
                        }
                        htmlForm += form.getProcessTextSelectionQuestion(question.baseText, radioOrCheckbox, question.answers);
                        htmlForm += `</div></li>`;
                        break;
                    case $exeDevice.questionsIds[2]: // true-false
                        htmlForm += form.getProcessTextTrueFalseQuestion(question.baseText, question.answer);
                        htmlForm += `</div></li>`;
                        break;
                    case $exeDevice.questionsIds[3]: // fill
                        htmlForm += form.getProcessTextFillQuestion(question.baseText, question.capitalization, question.strict);
                        htmlForm += `</div></li>`;
                        break;
                    default:
                        break;
                }
            })

            htmlForm += "</u>";
            formPreview.outerHTML = htmlForm;
        }

        formPreview = $exeDevice.ideviceBody.querySelector(`#${$exeDevice.formPreviewId}`);
        if (formPreview.children.length > 0) {
            $exeDevice.ideviceBody.querySelector(`#${$exeDevice.msgNoQuestionsId}`).style.display = "none";
        }

        let dropdownPassRate = $exeDevice.ideviceBody.querySelector(`[id^="${$exeDevice.dropdownPassRateId}"]`);
        if (previousData[$exeDevice.dropdownPassRateId] !== undefined) {
            dropdownPassRate.value = previousData[$exeDevice.dropdownPassRateId];
        }

        let checkAddBtnAnswers = $exeDevice.ideviceBody.querySelector(`#${$exeDevice.checkAddBtnAnswersId}`);
        if (previousData[$exeDevice.checkAddBtnAnswersId] !== undefined) {
            checkAddBtnAnswers.checked = previousData[$exeDevice.checkAddBtnAnswersId];
        }
        this.ideviceBody.querySelector("#checkAddBtnAnswers").checked = previousData.addBtnAnswers ?? true;
        this.ideviceBody.querySelector("#evaluationCheckBox").checked = previousData.evaluation ?? false;
        this.ideviceBody.querySelector("#evaluationIDInput").value = previousData.evaluationID ?? '';
        this.ideviceBody.querySelector("#evaluationIDInput").disabled = !previousData.evaluation;
        this.ideviceBody.querySelector('#eXeGameSCORMRepeatActivity').checked = previousData.repeatActivity ?? true;

        this.ideviceBody.querySelector("#frmEQuestionsRandom").checked = previousData.questionsRandom || false;
        this.ideviceBody.querySelector("#frmEPercentageQuestions").value = previousData.percentageQuestions || 100;
        this.ideviceBody.querySelector("#frmETime").value = previousData.time ?? 0;

        previousData.showSlider = typeof previousData.showSlider !== 'undefined' ? previousData.showSlider : false;
        this.ideviceBody.querySelector("#frmEShowSlider").checked = previousData.showSlider;

        previousData.weighted = previousData.weighted ?? 100;
        previousData.repeatActivity = previousData.repeatActivity ?? false;

        let isscore = previousData.exportScorm && previousData.exportScorm.saveScore ? 1 : 0;
        previousData.isScorm = previousData.isScorm ?? isscore;

        let textscorm = previousData.exportScorm && previousData.exportScorm.buttonTextSave ? previousData.exportScorm.buttonTextSave : _('Save score');
        previousData.textButtonScorm = previousData.textButtonScorm ?? textscorm;

        $exeDevices.iDevice.gamification.scorm.setValues(previousData.isScorm, previousData.textButtonScorm, previousData.repeatActivity, previousData.weighted);
        $exeDevices.iDevice.gamification.common.setLanguageTabValues(previousData.msgs);
        $exeDevice.updateQuestionsNumber();

    },

    /**
    * eXe idevice engine
    * Idevice api function
    *
    * It returns the HTML to save. Return false if you find any error
    *
    * @return {String}
    */
    save: function () {
        let form = new $exeDevice.Form($exeDevice, $exeDevice.questions);
        form.saveInEditionQuestion();

        let scorm = $exeDevices.iDevice.gamification.scorm.getValues();
        this.isScorm = scorm.isScorm;
        this.textButtonScorm = scorm.textButtonScorm;
        this.repeatActivity = scorm.repeatActivity;
        this.weighted = scorm.weighted;

        this.evaluation = this.ideviceBody.querySelector("#evaluationCheckBox").checked;
        this.evaluationID = this.ideviceBody.querySelector("#evaluationIDInput").value;

        this.repeatActivity = this.ideviceBody.querySelector("#eXeGameSCORMRepeatActivity").checked;

        this.eXeFormInstructions = this.getEditorTinyMCEValue("eXeGameInstructions");
        this.eXeIdeviceTextAfter = this.getEditorTinyMCEValue("eXeIdeviceTextAfter");

        this.questionsData = $exeDevice.getQuestionsData();

        this[$exeDevice.dropdownPassRateId] = $exeDevice.ideviceBody.querySelector(`[id^="${$exeDevice.dropdownPassRateId}"]`).value;
        this[$exeDevice.checkAddBtnAnswersId] = $exeDevice.ideviceBody.querySelector(`#${$exeDevice.checkAddBtnAnswersId}`).checked;

        this.showSlider = this.ideviceBody.querySelector("#frmEShowSlider").checked;

        this.passRate = 50
        this.addBtnAnswers = $exeDevice.ideviceBody.querySelector(`#checkAddBtnAnswers`).checked;
        this.questionsRandom = this.ideviceBody.querySelector("#frmEQuestionsRandom").checked;
        this.percentageQuestions = this.ideviceBody.querySelector("#frmEPercentageQuestions").value;
        this.time = this.ideviceBody.querySelector("#frmETime").value;

        this.dataIds.push("eXeFormInstructions");
        this.dataIds.push("questionsData");
        this.dataIds.push($exeDevice.dropdownPassRateId);
        this.dataIds.push($exeDevice.checkAddBtnAnswersId);
        this.dataIds.push("eXeIdeviceTextAfter");

        const fields = this.ci18n,
            i18n = fields;
        for (const i in fields) {
            const fVal = $("#ci18n_" + i).val();
            if (fVal !== "") i18n[i] = fVal;
        }
        this.datamsg = i18n;

        // Check if the values ​​are valid
        if (this.checkFormValues()) {
            return this.getDataJson();
        } else {
            return false;
        }
    },

    importActivity: function (content, filetype) {
        $('#eXeGameExportImport .exe-field-instructions').eq(0).text(`${_("Supported formats")}: txt, xml(Moodle)`);
        $('#eXeGameExportImport').show();
        $('#eXeGameImportGame').attr('accept', '.txt, .xml');
        if (content && content.includes('\u0000')) {
            eXe.app.alert(msg);
            return;
        } else if (content) {
            if (filetype.match('text/plain')) {
                $exeDevice.importText(content);
            } else if (filetype.match('application/xml') || filetype.match('text/xml')) {
                $exeDevice.importCuestionaryXML(content);
            }

        }
    },

    importCuestionaryXML: function (xmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const msg = _("Sorry, the selected file does not contain any questions that are compatible with this activity.")

        if (xmlDoc.querySelector("parsererror")) return false;

        const quiz = xmlDoc.querySelector("quiz");
        if (!quiz) return false;

        const questionsArray = [];

        quiz.querySelectorAll("question").forEach(question => {
            const type = question.getAttribute("type");
            const questionTextElement = question.querySelector("questiontext > text");
            const questionText = questionTextElement ? questionTextElement.textContent.trim() : "";
            if (!questionText) return;
            if (type === "multichoice") {
                const answerElements = question.querySelectorAll("answer");
                const answers = [];
                let correctCount = 0;

                answerElements.forEach(answer => {
                    const fraction = parseFloat(answer.getAttribute("fraction"));
                    const isCorrect = fraction > 0;
                    if (isCorrect) correctCount++;

                    const ansTextElement = answer.querySelector("text");
                    const ansText = ansTextElement ? ansTextElement.textContent.trim() : "";
                    const clearText = $exeDevice.clearText(ansText)
                    answers.push([isCorrect, clearText]);
                });

                const selectionType = (correctCount > 1) ? "multiple" : "single";

                questionsArray.push({
                    activityType: "selection",
                    selectionType: selectionType,
                    baseText: `<p>${$exeDevice.clearText(questionText)}<p>`,
                    answers: answers
                });
            }

            else if (type === "truefalse") {
                const answerElements = question.querySelectorAll("answer");
                let correctAnswer = null;


                answerElements.forEach(answer => {
                    const fraction = parseFloat(answer.getAttribute("fraction"));
                    if (fraction > 0) {
                        const ansTextElement = answer.querySelector("text");
                        const ansText = ansTextElement ? ansTextElement.textContent.trim().toLowerCase() : "";
                        correctAnswer = (ansText === "true") ? "1" : "0";
                    }
                });


                if (correctAnswer !== null) {
                    questionsArray.push({
                        activityType: "true-false",
                        baseText: `<p>${$exeDevice.clearText(questionText)}<p>`,
                        answer: correctAnswer
                    });
                }
            }

        });

        if (questionsArray.length) {
            $exeDevice.addQuestions(questionsArray)
        } else {
            eXe.app.alert(msg);
        }

    },

    clearText(text) {
        let sinCdata = text.replace(/<!\[CDATA\[/, "").replace(/]]$/, "");
        const container = document.createElement("div");
        container.innerHTML = sinCdata;
        let cleartext = container.textContent || container.innerText || "";
        return cleartext.replace(/\n/g, " ").trim();
    },


    importText: function (content) {
        const lines = content.split('\n');
        $exeDevice.insertQuestions(lines)
    },

    checkQuestions: function (lines) {
        if (Array.isArray(lines) && lines.length > 0) {
            return lines;
        }
        if (typeof lines === 'string') {
            try {
                lines = JSON.parse(lines);
            } catch (error) {
                return false;
            }
        }
        if (typeof lines === 'object' && lines !== null) {
            lines = Object.values(lines);
        }
        if (Array.isArray(lines) && lines.length > 0) {
            return lines;
        }
        return false;
    },



    insertQuestions: function (lines) {
        const msg = _("Sorry, the selected file does not contain any questions that are compatible with this activity.")

        const slines = $exeDevice.checkQuestions(lines)
        if (!slines) {
            eXe.app.alert(msg);
            return;
        }

        const lineFormat = /^[01]#[^#]+$/,
            lineFormat0 = /^v-f#[^\s#].*?#(0|1)#.*?#.*?$/,
            lineFormat1 = /^[0-5]#[^#]+(?:#[^#]+){2,6}$/,
            lineFormat2 = /^[[A-F]{1,6}#[^#]+(?:#[^#]+){2,6}$/,
            lineFormat3 = /^[^\s#].*?#(0|1)#.*?#.*?$/;
        let questions = [];

        slines.forEach(lined => {
            let line = $exeDevice.clearText(lined);

            if (lineFormat.test(line)) {
                const question = $exeDevice.getTrueFalseQuestion(line);
                questions.push(question)
            } else if (lineFormat0.test(line)) {
                const question = $exeDevice.getTrueFalseQuestionExe(line);
                questions.push(question)
            } else if (lineFormat1.test(line)) {
                const question = $exeDevice.getTestQuestion(line);
                questions.push(question)
            } else if (lineFormat2.test(line)) {
                const question = $exeDevice.getTestMutiple(line);
                questions.push(question)
            } else if (lineFormat3.test(line)) {
                const question = $exeDevice.getTrueFalseQuestionExeSv(line);
                questions.push(question)
            }
        });
        if (questions.length) {
            $exeDevice.addQuestions(questions)
        } else {
            eXe.app.alert(msg);
        }
    },

    getTrueFalseQuestion: function (line) {
        const linarray = line.trim().split("#");
        if (linarray.length < 2) return ''
        const solution = parseInt(linarray[0]);
        return {
            activityType: "true-false",
            baseText: `<p>${$exeDevice.clearText(linarray[1])}<p>`,
            answer: solution
        }
    },

    getTrueFalseQuestionExe: function (line) {
        const linarray = line.trim().split("#");
        if (linarray.length < 4) return ''
        const solution = parseInt(linarray[2]);

        return {
            activityType: "true-false",
            baseText: `<p>${$exeDevice.clearText(linarray[1])}<p>`,
            answer: solution
        }
    },



    getTrueFalseQuestionExeSv: function (line) {
        const linarray = line.trim().split("#");
        if (linarray.length < 4) return ''
        const solution = parseInt(linarray[1]) ? 1 : 0;
        return {
            activityType: "true-false",
            baseText: `<p>${$exeDevice.clearText(linarray[0])}<p>`,
            answer: solution
        }
    },


    getTestQuestion: function (line) {
        const parts = line.trim().split("#");

        if (parts.length < 4) return false;

        const solutionIndex = parseInt(parts[0], 10);
        const questionText = parts[1].trim();
        const answerOptions = parts.slice(2);
        const answers = answerOptions.map((option, index) => {
            const isCorrect = (index === solutionIndex);
            return [isCorrect, option.trim()];
        });

        let question = {
            activityType: "selection",
            selectionType: "single",
            baseText: `<p>${$exeDevice.clearText(questionText)}<p>`,
            answers: answers
        };
        return question;
    },


    getTestMutiple: function (line) {
        const parts = line.trim().split("#");

        if (parts.length < 3) {
            return null;
        }

        const solutionLetters = parts[0].trim().toUpperCase();
        const questionText = parts[1].trim();
        const options = parts.slice(2);
        const answers = options.map((option, index) => {
            const letter = String.fromCharCode("A".charCodeAt(0) + index);
            const isCorrect = solutionLetters.includes(letter);
            return [isCorrect, option.trim()];
        });

        return {
            activityType: "selection",
            selectionType: "multiple",
            baseText: `<p>${$exeDevice.clearText(questionText)}</p>`,
            answers: answers
        };
    },

    addQuestions: function (newData) {
        let formPreview = $exeDevice.ideviceBody.querySelector(`#${$exeDevice.formPreviewId}`);
        let questionsData = $exeDevice.getQuestionsData();
        if (questionsData !== undefined && newData !== undefined) {
            questionsData.push(...newData);

            let htmlForm = '<ul id="formPreview">';
            let form = new $exeDevice.Form($exeDevice, $exeDevice.questions);

            questionsData.forEach(question => {
                let newId = form.generateRandomId();

                if (question.activityType !== $exeDevice.questionsIds[1]) {
                    htmlForm += `<li class="FormView_${question.activityType} FormView_question" data-id="${newId}" activity-type="${question.activityType}" draggable="true">
                            <div id="questionTopBar_${newId}">
                                <label class="activity-title">Activity ${question.activityType}</label>
                                <div class="inline QuestionLabel_ButtonsContainer">
                                    <button class="QuestionLabel_moveUp QuestionLabel_actionButton">arrow_upward</button>
                                    <button class="QuestionLabel_moveDown QuestionLabel_actionButton">arrow_downward</button>
                                    <button class="QuestionLabel_edit QuestionLabel_actionButton">edit</button>
                                    <button class="QuestionLabel_remove QuestionLabel_actionButton">close</button>
                                </div>
                            </div>
                            <div id="QuestionElement_${newId}" class="FormViewContainer_${question.activityType} FormViewContainer">`;
                } else {
                    htmlForm += `<li class="FormView_selection FormView_question" data-id="${newId}" activity-type="selection" selection-type="${question.selectionType}" draggable="true">
                            <div id="questionTopBar_${newId}">
                            <label class="activity-title">Activity ${question.selectionType} selection</label>
                            <div class="inline QuestionLabel_ButtonsContainer">
                                <button class="QuestionLabel_moveUp QuestionLabel_actionButton">arrow_upward</button>
                                <button class="QuestionLabel_moveDown QuestionLabel_actionButton">arrow_downward</button>
                                <button class="QuestionLabel_edit QuestionLabel_actionButton">edit</button>
                                <button class="QuestionLabel_remove QuestionLabel_actionButton">close</button>
                            </div>
                            </div>
                            <div id="QuestionElement_${newId}" class="FormViewContainer_selection FormViewContainer">`;
                }
                switch (question.activityType) {
                    case $exeDevice.questionsIds[0]: // dropdown.
                        htmlForm += form.getProcessTextDropdownQuestion(question.baseText, question.wrongAnswersValue);
                        htmlForm += `</div></li>`;
                        break;
                    case $exeDevice.questionsIds[1]: // selection
                        let radioOrCheckbox = "radio";
                        if (question.selectionType === "multiple") {
                            radioOrCheckbox = "checkbox";
                        }
                        htmlForm += form.getProcessTextSelectionQuestion(question.baseText, radioOrCheckbox, question.answers);
                        htmlForm += `</div></li>`;
                        break;
                    case $exeDevice.questionsIds[2]: // true-false
                        htmlForm += form.getProcessTextTrueFalseQuestion(question.baseText, question.answer);
                        htmlForm += `</div></li>`;
                        break;
                    case $exeDevice.questionsIds[3]: // fill
                        htmlForm += form.getProcessTextFillQuestion(question.baseText, question.capitalization, question.strict);
                        htmlForm += `</div></li>`;
                        break;
                    default:
                        break;
                }
            })

            htmlForm += "</u>";
            formPreview.outerHTML = htmlForm;
        }
        this.setBehaviourFormView();
        this.form.hideQuestionsPanel("questionsContainerTop");
        this.form.hideQuestionsPanel("questionsContainerBottom");
        $exeDevice.updateQuestionsNumber();
        $('.exe-form-tabs li:first-child a').click();
    },

    /**
     * Check if the form values ​​are correct
     *
     * @returns {Boolean}
     */
    checkFormValues: function () {
        if (this.evaluation && this.evaluationID.length < 5) {
            eXe.app.alert(_("The report identifier must have at least 5 characters"));
            return false;
        }

        if (this.questionsData.length < 1) {
            eXe.app.alert(_("Please add at least one question"));
            return false;
        }
        return true;
    },

    /**
     * Get a JSON with the idevice data
     *
     * @returns {}
     */
    getDataJson: function () {
        let data = {};
        data.ideviceId = this.ideviceBody.getAttribute("idevice-id");
        data.evaluation = this.evaluation;
        data.evaluationID = this.evaluationID;
        data.repeatActivity = this.repeatActivity;
        data.isScorm = this.isScorm;
        data.textButtonScorm = this.textButtonScorm;
        data.weighted = this.weighted;
        data.msgs = this.datamsg;
        data.id = data.ideviceId;
        data.questionsRandom = this.questionsRandom;
        data.percentageQuestions = this.percentageQuestions;
        data.time = this.time;
        data.eXeFormInstructions = this.eXeFormInstructions;
        data.questionsData = this.questionsData;
        data.passRate = 5;
        data.addBtnAnswers = this.addBtnAnswers;
        data.eXeIdeviceTextAfter = this.eXeIdeviceTextAfter;
        data.showSlider = this.showSlider;


        return data;
    },

    /**
     * SET Behaviour to elements of loaded form view elements
     */
    setBehaviourFormView: function () {
        this.form.behaviourButtonsQuestionInFormViewAll(`ul#${$exeDevice.formPreviewId} .FormView_question .QuestionLabel_actionButton`);
        this.form.addSortableBehaviour();
        this.form.disableArrowUpDown();
    },

    /**
     * GET value content editor
     * @auxiliar
     *
     * @param {*} id
     *
     * @return string
     */
    getEditorTinyMCEValue: function (id) {
        if (tinyMCE.editors[id].getContent() === "<p>undefined</p>") {
            return "";
        } else {
            return tinyMCE.editors[id].getContent();
        }
    },

    /**
     *
     * @returns {object}
     */
    getQuestionsData() {
        let htmlFormQuestions = this.ideviceBody.querySelector(`#${this.formPreviewId}`).children;
        let formQuestions = [];

        [...htmlFormQuestions].forEach(htmlQuestion => {
            if (htmlQuestion.getAttribute("activity-type") === this.questionsIds[0]) {
                let values = []
                let htmlAnswers = htmlQuestion.querySelectorAll("[id^='dropdownAnswer_'");
                [...htmlAnswers].forEach(answer => {
                    values.push(answer.textContent);
                })

                let dropdownData = {
                    activityType: htmlQuestion.getAttribute("activity-type"),
                    baseText: htmlQuestion.querySelector("[id^='dropdownBaseText_'").innerHTML,
                    wrongAnswersValue: htmlQuestion.querySelector("[id^='dropdownWrongAnswer_'").textContent,
                }
                formQuestions.push(dropdownData);
            }
            else if (htmlQuestion.getAttribute("activity-type") === this.questionsIds[1]) {
                let values = []

                let inputs = htmlQuestion.querySelector("[id^='SelectionQuestion_'").querySelectorAll("INPUT");
                let checkedOptions = htmlQuestion.querySelector("[id^='SelectionAnswer_'").textContent.split(",");

                [...inputs].forEach((input, index) => {
                    let checked = false;
                    if (checkedOptions.includes(index.toString())) {
                        checked = true;
                    }
                    let value = [checked, input.value];
                    values.push(value);
                })

                let html = htmlQuestion.querySelector("[id^='QuestionElement_'").innerHTML;
                let htmlOptions = htmlQuestion.querySelector("[id^='SelectionQuestion_'").outerHTML;
                let questionHtml = html.replace(htmlOptions, "");

                let selectionData = {
                    activityType: htmlQuestion.getAttribute("activity-type"),
                    selectionType: htmlQuestion.getAttribute("selection-type"),
                    baseText: questionHtml,
                    answers: values
                }
                formQuestions.push(selectionData);

            }
            else if (htmlQuestion.getAttribute("activity-type") === this.questionsIds[2]) {
                let html = htmlQuestion.querySelector("[id^='QuestionElement_'").innerHTML;
                let htmlOptions = htmlQuestion.querySelector("[id^='TrueFalseQuestion_'").outerHTML;
                let questionHtml = html.replace(htmlOptions, "");
                let trueFalseData = {
                    activityType: htmlQuestion.getAttribute("activity-type"),
                    baseText: questionHtml,
                    answer: htmlQuestion.querySelector("[id^='TrueFalseAnswer_'").textContent,
                }
                formQuestions.push(trueFalseData);
            }
            else if (htmlQuestion.getAttribute("activity-type") === this.questionsIds[3]) {
                let fillData = {
                    activityType: htmlQuestion.getAttribute("activity-type"),
                    baseText: htmlQuestion.querySelector("[id^='fillBaseText_'").innerHTML,
                    capitalization: htmlQuestion.querySelector("[id^='fillCapitalization_'").textContent,
                    strict: htmlQuestion.querySelector("[id^='fillStrictQualification_'").textContent,
                }
                formQuestions.push(fillData);
            }
        })
        return formQuestions;
    },


    updateQuestionsNumber: function () {
        let percentage = parseInt($exeDevice.removeTags($('#frmEPercentageQuestions').val()));
        if (isNaN(percentage)) return;

        percentage = Math.min(Math.max(percentage, 1), 100);
        let numq = $exeDevice.getQuestionsData().length;
        const totalQuestions = numq || 1;
        let num = Math.max(Math.round((percentage * totalQuestions) / 100), 1);

        $('#frmENumeroPercentaje').text(`${num}/${totalQuestions}`);
    },

    removeTags: function (str) {
        const wrapper = $("<div></div>");
        wrapper.html(str);
        return wrapper.text();
    },

    /**
     * Message management class
     */
    Msgs: class {

        constructor(parent) {
            this.parent = parent;
            this.strings = {};
            this.setMessagesInfo();
        }

        setMessagesInfo() {
            this.strings.msgEGeneralSettings = _("General settings");
            this.strings.msgESCORM = _("SCORM");
            this.strings.msgELanguageSettings = _("Language settings");
            this.strings.msgELanguageShare = _("Share");
            this.strings.msgEInstructions = _("Instructions");
            this.strings.msgEActivity = _("Activity");
            this.strings.msgEQuestion = _("Question");
            this.strings.msgEAddDropdownQuestion = _("Add a dropdown question to form");
            this.strings.msgEAddFillQuestion = _("Add a fill question to form");
            this.strings.msgEAddTrueFalseQuestion = _("Add a true-false question to form");
            this.strings.msgEAddSelectionQuestion = _("Add a selection question to form");
            this.strings.msgEAddQuestion = _("Add this question to form");
            this.strings.msgESaveQuestion = _("Save");
            this.strings.msgECancelQuestion = _("Cancel");
            this.strings.msgERemoveQuestion = _("Remove");
            this.strings.msgEFormView = _("Form preview");
            this.strings.msgEText = _("Text");
            this.strings.msgEQuestionType = _("Question type");
            this.strings.msgEShowHideWord = _("Show/Hide word");
            this.strings.msgEAddOption = _("Add new option");
            this.strings.msgOtherWords = _("Other words");
            this.strings.msgExampleOtherWords = _("cat|dog|fish");
            this.strings.msgCheck = _("Check");
            this.strings.msgETrue = _("True");
            this.strings.msgEFalse = _("False");
            this.strings.msgNoQuestions = _("No questions in the form");
            this.strings.msgPassRate = _("Set the pass mark");
            this.strings.msgAddBtnAnswers = _("Include a button to display the answers");
            this.strings.msgCapitalization = _("Check capitalization");
            this.strings.msgStrictQualification = _("Strict qualification");
            this.strings.msgInstructionsQuestion = _("The question should be clear and unambiguous. Avoid negative premises as they tend to be ambiguous.");
            this.strings.msgInstructionsSelection = _(`Click the toggle button to switch between questions with one correct answer and questions with many possible correct answers.`) + ' ' + this.strings.msgInstructionsQuestion;
            this.strings.msgInstructionsDropdown = _(`Enter the text for the drop-down activity in the drop-down field either by pasting the text from another source or by typing it directly into the field. To select which words to choose, double-click on a word to select it and click on the "Show/Hide" button below.`);
            this.strings.msgInstructionsDropdownOtherWords = _("Optional: You can type other words to complete the drop-down activity. Use the vertical bar to separate the words. This field can be left blank.");
            this.strings.msgInstructionsFill = _(`Type or paste the text for the fill-in-the-blank activity into the field. Select the words and use the button below to hide them. You can define more than one possible answer using vertical bars to surround and separate them. E.g.: |dog|cat|bird|`);
            this.strings.msgInstructionsFillCapitalization = _("If this option is checked, submitted answers with different capitalization will be marked as incorrect");
            this.strings.msgInstructionsFillStrictQualification = _(`If unchecked, a small number of spelling and capitalization errors will be accepted. If checked, no spelling or capitalization errors will be accepted. Example: If the correct answer is Elephant and it says elephant or Eliphant, both will be considered as "close enough" by the algorithm, as there is only one spelling error, even if "Check capitalization" is checked. If the case check is disabled in this example, the lowercase letter e is not considered an error and eliphant will also be accepted. If "Strict qualification" and "Check capitalization" are enabled, the only correct answer is "Elephant". If only "Strict qualification" is enabled and "Check capitalization" is not, "elephant" will also be accepted.`);
            this.strings.msgInstructionsFillCapitalize = _(`If this option is checked, answers submitted with case differences will be marked as incorrect.`)
            this.strings.msgConfirmRemoveQuestion = _("Are you sure you want to delete this question? This can't be undone.");
            this.strings.msgConfirmCancelEdit = _("Are you sure you want to discard the changes? This can't be undone.");
            this.strings.questDropdown = _("Dropdown");
            this.strings.questSelection = _("Selection");
            this.strings.questTrueFalse = _("True-False");
            this.strings.questFill = _("Fill");
            this.strings.msgLangTrueFalseHelp = _("Select whether the statement is true or false");
            this.strings.msgLangDropdownHelp = _("Choose the correct answer among the options proposed");
            this.strings.msgLangFillHelp = _("Fill in the blanks with the appropriate word");
            this.strings.msgLangSingleSelectionHelp = _("Multiple choice with only one correct answer");
            this.strings.msgLangMultipleSelectionHelp = _("Multiple choice with multiple corrects answers");
            this.strings.msgLangCheck = _("Check");
            this.strings.msgLangResetId = _("Reset");
            this.strings.msgLangSolutionsId = _("Show Solutions");

            this.strings.questionsStringsByID = {
                "dropdown": this.strings.questDropdown,
                "selection": this.strings.questSelection,
                "true-false": this.strings.questTrueFalse,
                "fill": this.strings.questFill
            }
        }

        generateStringsQuestions(questions) {
            let qStrings = {};
            questions.forEach(question => {
                if (this.strings.questionsStringsByID[question]) {
                    qStrings[question] = this.strings.questionsStringsByID[question];
                }
            });

            return qStrings;
        }

    },

    /**
     * Form management class
     */
    Form: class {

        constructor(parent, questions) {
            this.parent = parent;
            this.strings = parent.msgs.strings;
            this.questionsString = questions;
        }
        /**
         * Creates the main form structure.
         * Called by exeDevice.init.
         *
         * @param {HTMLElement} ideviceBody - The container where the form will be rendered.
         */
        createForm(ideviceBody) {
            const html = `<div id="formIdeviceForm">
                <p class="exe-block-info exe-block-dismissible">${_("Create quizzes with multiple-choice, true/false and fill-in-the-blank questions.")} <a style="display:none;" href="https://youtu.be/xHhrBZ_66To" hreflang="es" target="_blank">${_("Usage Instructions")}</a></p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevices.iDevice.gamification.instructions.getFieldset(c_("Complete the questions in the following quiz"))}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_("Options")}</a></legend>
                        <div>
                            <p>
                                <label for="frmEShowSlider"><input type="checkbox" name="frmEShowSlider" id="frmEShowSlider"/>${_('Slides list')}</label>
                            </p>
                            <p>
                                <label for="frmEQuestionsRandom"><input type="checkbox" id="frmEQuestionsRandom">${_("Random questions")}.</label>
                            </p>
                            <p id="frmETimeDiv">
                                    <label for="frmETime">${_("Time (minutes)")}: <input type="number" name="frmETime" id="frmETime" value="0" min="0" max="59" /></label>
                            </p>                     
                            <p>
                                <label for="frmEPercentageQuestions">%${_("Questions")}:<input type="number" name="frmEPercentageQuestions" id="frmEPercentageQuestions" value="100" min="1" max="100" /></label><span id="frmENumeroPercentaje">1/1</span>.
                            </p>
                            <!-- Pass Rate Dropdown -->
                            <p class="question-button inline" style="display:none;">
                                <span id="${$exeDevice.passRateId}">${this.strings.msgPassRate}</span>
                                ${this.createPassRateDropdown('formIdevice')}
                            </p>            
                                <!-- Show Answers Checkbox -->
                            <p id="${$exeDevice.checkAddBtnAnswersId}_container" class="question-button inline">
                                <label for="${$exeDevice.checkAddBtnAnswersId}">
                                    <input type="checkbox" name="checkShowAnswers" id="${$exeDevice.checkAddBtnAnswersId}" checked>
                                    ${this.strings.msgAddBtnAnswers}
                                </label>
                            </p>
                                <!-- Evaluation -->
                            <div>
                                <div class="Games-Reportdiv">
                                    <strong class="GameModeLabel"><a href="" id="helpLinkButton" class="GameModeHelpLink" title="${_("Help")}"><img src="${$exeDevice.idevicePath}quextIEHelp.gif" width="16" height="16" alt="${_("Help")}"/></a></strong>
                                    <label for="evaluationCheckBox"><input type="checkbox" id="evaluationCheckBox">${_("Progress report")}. </label>
                                    <label for="evaluationIDInput">${_("Identifier")}: </label><input type="text" id="evaluationIDInput" disabled/>
                                </div>
                                <div id="evaluationHelp" style="display:none">
                                     <p class="exe-block-info exe-block-dismissible">${_("You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.")}</p>
                                </div>
                            </div> 
                        </div>
                    </fieldset>
                    <fieldset class="exe-fieldset">
                        <legend><a href="#" >${_("Questions")}</a></legend>
                            <div>                
                                <!-- Top Questions Container -->
                                <div class="container-add-questions">
                                    ${this.createIconHTML($exeDevice.btnQuestionsTop, "add", _("Show questions"), "show-questions")}
                                    <div id="questionsContainerTop" class="dropdown-popup">
                                        ${this.createButtonHTML($exeDevice.btnAddTrueFalseTop, this.strings.questTrueFalse, this.strings.msgEAddTrueFalseQuestion, "add-question-button")}
                                        ${this.createButtonHTML($exeDevice.btnAddFillTop, this.strings.questFill, this.strings.msgEAddFillQuestion, "add-question-button")}
                                        ${this.createButtonHTML($exeDevice.btnAddDropdownTop, this.strings.questDropdown, this.strings.msgEAddDropdownQuestion, "add-question-button")}
                                        ${this.createButtonHTML($exeDevice.btnAddSelectionTop, this.strings.questSelection, this.strings.msgEAddSelectionQuestion, "add-question-button")}
                                    </div>
                                </div>
                                <!-- No Questions Message -->
                                <div id="${$exeDevice.msgNoQuestionsId}" class="container">${this.strings.msgNoQuestions}</div>
                                <!-- Form Preview -->
                                <div class="container">
                                    <ul id="${$exeDevice.formPreviewId}"></ul>
                                </div>
                                <!-- Bottom Questions Container -->
                                <div class="container-add-questions">
                                ${this.createIconHTML($exeDevice.btnQuestionsBottom, "add", _("Show questions"), "show-questions")}
                                <div id="questionsContainerBottom" class="dropup-popup">
                                    ${this.createButtonHTML($exeDevice.btnAddTrueFalseBottom, this.strings.questTrueFalse, this.strings.msgEAddTrueFalseQuestion, "add-question-button")}
                                    ${this.createButtonHTML($exeDevice.btnAddFillBottom, this.strings.questFill, this.strings.msgEAddFillQuestion, "add-question-button")}
                                    ${this.createButtonHTML($exeDevice.btnAddDropdownBottom, this.strings.questDropdown, this.strings.msgEAddDropdownQuestion, "add-question-button")}
                                    ${this.createButtonHTML($exeDevice.btnAddSelectionBottom, this.strings.questSelection, this.strings.msgEAddSelectionQuestion, "add-question-button")}
                                </div>
                            </div>
                        </div>
                    </fieldset>
                    ${$exeDevices.iDevice.common.getTextFieldset("after")}
                </div>
                ${$exeDevices.iDevice.gamification.scorm.getTab(true)}
                ${$exeDevices.iDevice.gamification.common.getLanguageTab($exeDevice.ci18n)}
                ${$exeDevices.iDevice.gamification.share.getTab(true, 7, false)}
            </div>            
            `;
            ideviceBody.innerHTML = html;
            $exeDevices.iDevice.tabs.init("formIdeviceForm");
            $exeDevices.iDevice.gamification.scorm.init();
        }

        /**
         * SET ALL behaviours to elements
         * @called by exeDevice.init
         *
         */
        setBehaviour() {
            this.behaviourExeTabs();
            this.behaviourButtonHideShowQuestions($exeDevice.btnQuestionsTop);
            this.behaviourButtonAddTrueFalseQuestion($exeDevice.btnAddTrueFalseTop, "afterbegin");
            this.behaviourButtonAddFillQuestion($exeDevice.btnAddFillTop, "afterbegin");
            this.behaviourButtonAddDropdownQuestion($exeDevice.btnAddDropdownTop, "afterbegin");
            this.behaviourButtonAddSelectionQuestion($exeDevice.btnAddSelectionTop, "afterbegin");
            this.behaviourButtonHideShowQuestions($exeDevice.btnQuestionsBottom);
            this.behaviourButtonAddTrueFalseQuestion($exeDevice.btnAddTrueFalseBottom, "beforeend");
            this.behaviourButtonAddFillQuestion($exeDevice.btnAddFillBottom, "beforeend");
            this.behaviourButtonAddDropdownQuestion($exeDevice.btnAddDropdownBottom, "beforeend");
            this.behaviourButtonAddSelectionQuestion($exeDevice.btnAddSelectionBottom, "beforeend");
            this.behaviourEvaluation();
            $exeDevices.iDevice.gamification.share.addEvents(7, $exeDevice.insertQuestions);
            if (window.File && window.FileReader && window.FileList && window.Blob) {
                $('#eXeGameExportImport .exe-field-instructions').eq(0).text(`${_("Supported formats")}: txt, xml(Moodle)`);
                $('#eXeGameExportImport').show();
                $('#eXeGameImportGame').attr('accept', '.txt, .xml');
                $('#eXeGameExportImport').show();
                $('#eXeGameImportGame').on('change', function (e) {
                    const file = e.target.files[0];
                    if (!file) {
                        return;
                    }
                    if (!file.type ||
                        !(file.type.match('text/plain') ||
                            file.type.match('application/xml') ||
                            file.type.match('text/xml'))
                    ) {
                        eXe.app.alert(_('Please select a text file (.txt) or a Moodle XML file (.xml)'));
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        $exeDevice.importActivity(e.target.result, file.type);
                    };
                    reader.readAsText(file);
                });
            } else {
                $('#eXeGameExportImport').hide();
            }
        }

        /**
         *
         * @returns
         */
        getDefaultLangValues() {
            let defaultLang = {};
            defaultLang[_("True/False Help Text:")] = [$exeDevice.langTrueFalseHelpId, this.strings.msgLangTrueFalseHelp];
            defaultLang[_("Fill Help Text:")] = [$exeDevice.langFillHelpId, this.strings.msgLangFillHelp];
            defaultLang[_("Dropdown Help Text:")] = [$exeDevice.langDropdownHelpId, this.strings.msgLangDropdownHelp];
            defaultLang[_("Single Selection Help Text:")] = [$exeDevice.langSingleSelectionHelpId, this.strings.msgLangSingleSelectionHelp];
            defaultLang[_("Multiple Selection Help Text:")] = [$exeDevice.langMultipleSelectionHelpId, this.strings.msgLangMultipleSelectionHelp];
            defaultLang[_("Text for the button to check the answers:")] = [$exeDevice.langCheckId, this.strings.msgLangCheck];
            defaultLang[_("Text for the button to reset the answers:")] = [$exeDevice.langResetId, this.strings.msgLangResetId];
            defaultLang[_("Text for the button to show the solutions:")] = [$exeDevice.langSolutionsId, this.strings.msgLangSolutionsId];

            return defaultLang;
        }

        /**
         *
         * @returns
         */
        getCustomizableLangFields() {
            let langValues = this.getDefaultLangValues();
            let html = "";
            html += `<div class="grid-container">`;
            Object.entries(langValues).forEach(([key, value]) => {
                html += `<div class="lang-option">`;
                html += `<label for="${value[0]}">${key}</label>`;
                html += this.createInputText(value[0], value[1]);
                html += `</div>`;
            });
            html += `</div>`;
            return html;
        }


        /**
         * Generates HTML for the instructions fieldset.
         *
         * @returns {String} - HTML string for the instructions fieldset.
         */
        createInstructionsFieldset() {
            return `<fieldset class="exe-fieldset exe-fieldset-closed">
                    <legend><a href="#">${this.strings.msgEInstructions}</a></legend>
                    <div>
                    <p id="IdeviceForm_Instructions">
                        ${this.createTextArea("eXeFormInstructions")}
                    </p>
                    </div>
                </fieldset>`;
        }

        /**
         * Icon
         * Function to create HTML icon
         *
         * @param {String} id
         * @param {String} text
         *
         * @returns {String}
         */
        createIconHTML(id, text, title, extraClass) {
            let titleText = title ? title : "";
            let iconClass = extraClass ? extraClass : "";
            return `<button id="${id}" class="exe-icon ${iconClass}" title="${titleText}">
                    ${text}
                </button>`;
        }

        /**
         * Button
         * Function to create HTML button
         *
         * @param {String} id
         * @param {String} text
         *
         * @returns {String}
         */
        createButtonHTML(id, text, title, extraClass) {
            let titleText = title ? title : "";
            let buttonClass = extraClass ? extraClass : "";
            return `<button id="${id}" class="exe-button ${buttonClass}" title="${titleText}">
                    ${text}
                    </button>`;
        }

        /**
         * Toggles visibility of questions when the button is clicked.
         *
         * @param {String} selectorId - ID of the button selector.
         */
        behaviourButtonHideShowQuestions(selectorId) {
            const button = $exeDevice.ideviceBody.querySelector(`#${selectorId}`);
            const questionButtonsContainer = button.nextElementSibling;

            button.addEventListener("click", function () {
                const allQuestionsContainers = $exeDevice.ideviceBody.querySelectorAll('[id^="questionsContainer"]');
                const btnsShowQuestions = $exeDevice.ideviceBody.querySelectorAll(`[id^="buttonHideShowQuestions"]`);

                if (this.classList.contains("hide-questions")) {
                    // Hide questions
                    questionButtonsContainer.style.display = "none";
                    this.classList.replace("hide-questions", "show-questions");
                    this.classList.remove("exe-icon-clicked");
                    this.title = _("Show questions");
                } else {
                    // Hide all other questions first
                    allQuestionsContainers.forEach(container => {
                        container.style.display = "none";
                        container.previousElementSibling.classList.replace("hide-questions", "show-questions");
                        container.previousElementSibling.title = _("Show questions");
                    });

                    btnsShowQuestions.forEach(btn => btn.classList.remove("exe-icon-clicked"));

                    // Show selected question
                    questionButtonsContainer.style.display = "";
                    this.classList.replace("show-questions", "hide-questions");
                    this.classList.add("exe-icon-clicked");
                    this.title = _("Hide questions");
                }
            });
        }

        /**
         *
         * @param {*} id
         */
        hideQuestionsPanel(id) {
            $exeDevice.ideviceBody.querySelector(`#${id}`).style.display = "none";
        }

        /**
         * Adds behavior to the 'Add True-False Question' button.
         *
         * @param {String} selectorId - ID of the button selector.
         * @param {String} relativePosition - Position to insert the question ('beforeend', etc.).
         */
        behaviourButtonAddTrueFalseQuestion(selectorId, relativePosition) {
            const form = new $exeDevice.Form($exeDevice, $exeDevice.questions);
            $exeDevice.ideviceBody.querySelector(`#${selectorId}`).addEventListener("click", function () {
                form.saveInEditionQuestion();

                // Create and insert True-False question
                const trueFalseQuestion = form.createTrueFalseQuestion();
                const formPreview = $exeDevice.ideviceBody.querySelector(`#${$exeDevice.formPreviewId}`);
                formPreview.insertAdjacentHTML(relativePosition, `<li class="FormView_question">${trueFalseQuestion}</li>`);

                $exeTinyMCE.init("multiple-visible", ".exe-html-editor");
                form.behaviourButtonSaveQuestion("true-false");
                form.behaviourButtonRemoveQuestion();

                // Add instructions
                const questionTitleContainer = $exeDevice.ideviceBody.querySelector("#formPreviewTextareaContainer div");
                const questionTitle = $exeDevice.ideviceBody.querySelector("#formPreviewTextareaContainer label");
                questionTitle.classList.add("instructions");
                form.showQuestionInstructions(questionTitleContainer, form.strings.msgInstructionsQuestion);

                $exeDevice.ideviceBody.querySelector(`#${$exeDevice.msgNoQuestionsId}`).style.display = "none";
                this.parentElement.previousElementSibling.click();
                form.disableArrowUpDown();
            });
        }

        /**
         * Creates HTML for a True-False question.
         *
         * @param {Boolean} [edit=false] - Whether the question is being edited.
         * @returns {String} - HTML string for the True-False question.
         */
        createTrueFalseQuestion(edit = false) {
            const textareaId = `${$exeDevice.formPreviewId}Textarea_${this.generateRandomId()}`;

            return `<div id="${$exeDevice.formPreviewId}TextareaContainer" class="questionTextarea">
                        <div class="inline instructions">
                        <span id="${$exeDevice.iconActivityId}_${this.generateRandomId}" class="inline-icon">${$exeDevice.iconTrueFalse}</span>
                        ${this.createActivityTitle("true-false")}
                        <button class="inline-icon help-icon">help_center</button>
                        </div>
                        ${this.createTextArea(textareaId)}
                        ${this.showTrueFalseRadioButtons(`${$exeDevice.formPreviewId}TrueFalseRadioButtons`)}
                        <div class="inline footer-buttons-container">
                        ${this.createSaveQuestionButton()}
                        ${edit ? this.createCancelQuestionButton() : ""}
                        ${this.createRemoveQuestionButton()}
                        </div>
                    </div>`;
        }

        /**
         * Adds behavior to the 'Add Selection Question' button.
         *
         * @param {String} selectorId - ID of the button selector.
         * @param {String} relativePosition - Position to insert the question.
         */
        behaviourButtonAddSelectionQuestion(selectorId, relativePosition) {
            const form = new $exeDevice.Form($exeDevice, $exeDevice.questions);
            $exeDevice.ideviceBody.querySelector(`#${selectorId}`).addEventListener("click", function () {
                form.saveInEditionQuestion();

                // Create and insert selection question
                const selectionQuestion = form.createSelectionQuestion();
                const formPreview = $exeDevice.ideviceBody.querySelector(`#${$exeDevice.formPreviewId}`);
                formPreview.insertAdjacentHTML(relativePosition, `<li class="FormView_question">${selectionQuestion}</li>`);

                //$exeTinyMCE.init("multiple-visible", ".exe-html-editor");
                $exeTinyMCE.init("multiple-visible", ".exe-html-editor", {
                    forced_root_block: "",
                    forced_br_newlines: true,
                    force_p_newlines: false
                });


                form.behaviourToggleOneMultipleAnswer("buttonRadioCheckboxToggle");
                form.behaviourButtonAddOption(`${$exeDevice.formPreviewId}_buttonAddOption`);
                form.behaviourButtonSaveQuestion("selection");
                form.behaviourButtonRemoveQuestion();

                // Add instructions
                const questionTitleContainer = $exeDevice.ideviceBody.querySelector("#formPreviewTextareaContainer div");
                const questionTitle = $exeDevice.ideviceBody.querySelector("#formPreviewTextareaContainer label");
                questionTitle.classList.add("instructions");
                form.showQuestionInstructions(questionTitleContainer, form.strings.msgInstructionsSelection);

                $exeDevice.ideviceBody.querySelector(`#${$exeDevice.msgNoQuestionsId}`).style.display = "none";
                this.parentElement.previousElementSibling.click();
                form.disableArrowUpDown();
            });
        }

        /**
         * Creates HTML for a selection question.
         *
         * @param {Boolean} [edit=false] - Whether the question is being edited.
         * @returns {String} - HTML string for the selection question.
         */
        createSelectionQuestion(edit = false) {
            const textareaId = `${$exeDevice.formPreviewId}Textarea_${this.generateRandomId()}`;

            return `<div id="${$exeDevice.formPreviewId}TextareaContainer" class="questionTextarea">
                    <div class="inline instructions">
                    <span id="${$exeDevice.iconActivityId}_${this.generateRandomId}" class="inline-icon">${$exeDevice.iconSelectOne}</span>
                    ${this.createActivityTitle("selection")}
                    <button class="inline-icon help-icon">help_center</button>
                    </div>
                    <div class="inline">
                    <button id="buttonRadioCheckboxToggle" class="inline-icon toggle-icon" 
                            aria-labelledby="toggle_single_multiple" selection-type="single">toggle_off</button>
                    <span id="toggle_single_multiple">Answer type: Single</span>
                    </div>
                    ${this.createTextArea(textareaId)}
                    <input type="button" id="${$exeDevice.formPreviewId}_buttonAddOption" 
                        value="${this.strings.msgEAddOption}" class="question-button"/>
                    <div class="inline footer-buttons-container">
                    ${this.createSaveQuestionButton()}
                    ${edit ? this.createCancelQuestionButton() : ""}
                    ${this.createRemoveQuestionButton()}
                    </div>
                </div>`;
        }

        /**
         *
         * @param {*} selectorId
         */
        behaviourToggleOneMultipleAnswer(selectorId) {
            let form = new $exeDevice.Form($exeDevice, $exeDevice.questions);
            $exeDevice.ideviceBody.querySelector(`#${selectorId}`).addEventListener("click", function () {
                let actualOptions = $exeDevice.ideviceBody.querySelectorAll(`INPUT[id^=option_]`);
                let labelTypeAnswer = $exeDevice.ideviceBody.querySelector(`#buttonRadioCheckboxToggle`).nextElementSibling;
                let iconQuestion = $exeDevice.ideviceBody.querySelector(`[id^="${$exeDevice.iconActivityId}"]`);

                if (this.innerHTML == "toggle_off") {
                    this.innerHTML = "toggle_on";
                    this.setAttribute("selection-type", "multiple");
                    if (actualOptions.length > 0) {
                        actualOptions.forEach(option => {
                            option.type = "checkbox";
                        });
                    }
                    labelTypeAnswer.innerHTML = "Answer type: Multiple";
                    iconQuestion.innerHTML = $exeDevice.iconSelectMultiple;
                }
                else {
                    this.innerHTML = "toggle_off";
                    this.setAttribute("selection-type", "single");
                    if (actualOptions.length > 0) {
                        actualOptions.forEach(option => {
                            option.type = "radio";
                        });
                    }
                    labelTypeAnswer.innerHTML = "Answer type: Single";
                    iconQuestion.innerHTML = $exeDevice.iconSelectOne;
                }
            });
        }

        /**
         *
         * @param {*} selectorId
         */

        behaviourButtonAddOption(selectorId) {
            let form = new $exeDevice.Form($exeDevice, $exeDevice.questions);
            let ideviceBody = $exeDevice.ideviceBody;

            ideviceBody.querySelector(`#${selectorId}`).addEventListener("click", function () {
                let optionCount = ideviceBody.querySelectorAll(`INPUT[id^=option_]`).length + 1;
                let checked = optionCount > 1 ? "" : "checked";

                let toggleButton = ideviceBody.querySelector("#buttonRadioCheckboxToggle");
                let optionType = toggleButton.innerHTML === "toggle_off" ? "radio" : "checkbox";

                let randomId = form.generateRandomId();

                let newOptionHTML = `<div id="option_${optionCount}_container" class="question-button inline">
                  <label for="option_${optionCount}">
                    <input type="${optionType}" name="options" id="option_${optionCount}" ${checked}>
                    Option ${optionCount}
                  </label>
                  <button id="remove_option_${optionCount}" class="exe-icon exe-icon-remove remove-option">close</button>
                </div>
                ${form.createTextArea(`${$exeDevice.formPreviewId}Textarea_${randomId}`, "small-textarea")}`;

                this.insertAdjacentHTML("beforebegin", newOptionHTML);

                //$exeTinyMCE.init("multiple-visible", ".exe-html-editor");
                $exeTinyMCE.init("multiple-visible", ".exe-html-editor", {
                    forced_root_block: "",
                    forced_br_newlines: true,
                    force_p_newlines: false
                });

                form.behaviourButtonRemoveOption(`remove_option_${optionCount}`);
            });
        }

        /**
         *
         * @param {*} selectorId
         */
        behaviourButtonRemoveOption(selectorId) {
            let form = new $exeDevice.Form($exeDevice, $exeDevice.questions);
            $exeDevice.ideviceBody.querySelector(`#${selectorId}`).addEventListener("click", function () {
                this.parentElement.nextElementSibling.remove();
                this.parentElement.remove();
                form.updateOptionNumbers();
            });
        }

        /**
         *
         */
        updateOptionNumbers() {
            let options = $exeDevice.ideviceBody.querySelectorAll(`INPUT[id^=option_]`);
            if (options.length > 0) {
                options.forEach((option, index) => {
                    option.id = `option_${index + 1}`
                    if (option.nextElementSibling) {
                        option.nextElementSibling.innerHTML = `Option ${index + 1}`;
                        if (option.nextElementSibling.nextElementSibling) {
                            option.nextElementSibling.nextElementSibling.id = `remove_option_${index + 1}`;
                        }
                    }


                });
            }
        }

        /**
         * Adds behavior to the 'Add Fill Question' button.
         *
         * @param {String} selectorId - ID of the button selector.
         * @param {String} relativePosition - Position where the question will be added (e.g., 'beforeend').
         */
        behaviourButtonAddFillQuestion(selectorId, relativePosition) {
            const form = new $exeDevice.Form($exeDevice, $exeDevice.questions);
            const button = $exeDevice.ideviceBody.querySelector(`#${selectorId}`);

            button.addEventListener("click", function () {
                form.saveInEditionQuestion();

                // Create and insert fill question
                const fillQuestion = form.createFillQuestion();
                const formPreview = $exeDevice.ideviceBody.querySelector(`#${$exeDevice.formPreviewId}`);
                formPreview.insertAdjacentHTML(relativePosition, `<li class="FormView_question">${fillQuestion}</li>`);

                $exeTinyMCE.init("multiple-visible", ".exe-html-editor");
                form.behaviourButtonSaveQuestion("fill");
                form.behaviourButtonRemoveQuestion();

                // Add instructions and tooltips
                const questionTitleContainer = formPreview.querySelector("#formPreviewTextareaContainer div");
                const questionTitle = formPreview.querySelector("#formPreviewTextareaContainer label");
                questionTitle.classList.add("instructions");
                questionTitleContainer.classList.add("instructions");
                form.showQuestionInstructions(questionTitleContainer, form.strings.msgInstructionsFill);

                // Handle capitalization and strict qualification
                const capitalization = formPreview.querySelector(`#${$exeDevice.checkCapitalizationId}_container .help-icon`);
                form.showQuestionInstructions(capitalization, form.strings.msgInstructionsFillCapitalization);

                const strictQualification = formPreview.querySelector(`#${$exeDevice.checkStrictQualificationId}_container .help-icon`);
                form.showQuestionInstructions(strictQualification, form.strings.msgInstructionsFillStrictQualification);

                $exeDevice.ideviceBody.querySelector(`#${$exeDevice.msgNoQuestionsId}`).style.display = "none";
                this.parentElement.previousElementSibling.click(); // Focus on the new question
                form.disableArrowUpDown();
            });
        }

        /**
         * Creates a fill-in-the-blank question form.
         *
         * @param {boolean} edit - Indicates whether the question is being edited.
         * @returns {string} HTML structure for the fill question.
         */
        createFillQuestion(edit = false) {
            // Generate unique ID for the textarea
            const textareaId = `${$exeDevice.formPreviewId}Textarea_${this.generateRandomId()}`;

            // Create helper functions for reusable elements
            const createInlineIcon = (id, icon) => `<span id="${id}" class="inline-icon">${icon}</span>`;
            const createCheckbox = (id, name, label) => `<label for="${id}">
                <input type="checkbox" name="${name}" id="${id}" checked> ${label}
                </label>`;
            const createHelpButton = () => '<button class="inline-icon help-icon">help_center</button>';

            // Start building the HTML structure
            let html = `<div id="${$exeDevice.formPreviewId}TextareaContainer" class="questionTextarea">
            <div class="inline instructions">
                ${createInlineIcon(`${$exeDevice.iconActivityId}_${this.generateRandomId()}`, $exeDevice.iconFill)}
                ${this.createActivityTitle("fill")}
                ${createHelpButton()}
            </div>
            <div id="options_container" class="inline">
                <div id="${$exeDevice.checkCapitalizationId}_container" class="inline check-options">
                ${createCheckbox(`${$exeDevice.checkCapitalizationId}_${textareaId}`, "capitalization", this.strings.msgCapitalization)}
                ${createHelpButton()}
                </div>
                <div id="${$exeDevice.checkStrictQualificationId}_container" class="inline check-options">
                ${createCheckbox(`${$exeDevice.checkStrictQualificationId}_${textareaId}`, "strict-qualification", this.strings.msgStrictQualification)}
                ${createHelpButton()}
                </div>
            </div>
            ${this.createTextArea(textareaId)}
            ${this.showHideWordButton(textareaId)}
            <div class="inline footer-buttons-container">
                ${this.createSaveQuestionButton()}
                ${edit ? this.createCancelQuestionButton() : ""}
                ${this.createRemoveQuestionButton()}
            </div>
            </div>`;

            return html;
        }

        /**
         * SET Behaviour on click add dropdown question
         *
         * @param {*} selectorId
         */
        behaviourButtonAddDropdownQuestion(selectorId, relativePosition) {
            let form = new $exeDevice.Form($exeDevice, $exeDevice.questions);
            $exeDevice.ideviceBody.querySelector(`#${selectorId}`).addEventListener("click", function () {
                form.saveInEditionQuestion();
                let dropdownQuestion = form.createDropdownQuestion();
                let formPreview = $exeDevice.ideviceBody.querySelector(`#${$exeDevice.formPreviewId}`);
                let liQuestion = `<li class="FormView_question">${dropdownQuestion}</li>`;
                formPreview.insertAdjacentHTML(relativePosition, liQuestion);
                $exeTinyMCE.init("multiple-visible", ".exe-html-editor");
                form.behaviourButtonSaveQuestion("dropdown");
                form.behaviourButtonRemoveQuestion();
                let questionTitleContainer = $exeDevice.ideviceBody.querySelector("#formPreviewTextareaContainer").querySelector("DIV");
                let questionTitle = $exeDevice.ideviceBody.querySelector("#formPreviewTextareaContainer").querySelector("LABEL");
                questionTitle.classList.add("instructions");
                form.showQuestionInstructions(questionTitleContainer, form.strings.msgInstructionsDropdown);
                let otherWords = $exeDevice.ideviceBody.querySelector(`#${$exeDevice.formPreviewId}InputTextContainer`).querySelector("DIV");
                form.showQuestionInstructions(otherWords, form.strings.msgInstructionsDropdownOtherWords);
                $exeDevice.ideviceBody.querySelector(`#${$exeDevice.msgNoQuestionsId}`).style.display = "none";
                this.parentElement.previousElementSibling.click();
                form.disableArrowUpDown();
            });
        }

        /**
         * Creates a dropdown question form.
         *
         * @param {boolean} edit - Indicates whether the question is being edited.
         * @returns {string} HTML structure for the dropdown question.
         */
        createDropdownQuestion(edit = false) {
            const textareaId = `${$exeDevice.formPreviewId}Textarea_${this.generateRandomId()}`;
            const createInlineIcon = (id, icon) => `<span id="${id}" class="inline-icon">${icon}</span>`;
            const createHelpButton = () => '<button class="inline-icon help-icon">help_center</button>';

            let html = `<div id="${$exeDevice.formPreviewId}TextareaContainer" class="questionTextarea">
                        <div class="inline instructions">
                            ${createInlineIcon(`${$exeDevice.iconActivityId}_${this.generateRandomId()}`, $exeDevice.iconDropdown)}
                            ${this.createActivityTitle("dropdown")}
                            ${createHelpButton()}
                        </div>
                        ${this.createTextArea(textareaId)}
                        ${this.showHideWordButton(textareaId)}
                        <div id="${$exeDevice.formPreviewId}InputTextContainer" class="question-input-text">
                            <div class="inline instructions">
                                <div class="instructions">${this.strings.msgOtherWords}</div>
                                ${createHelpButton()}
                            </div>
                            ${this.createInputText(`${$exeDevice.formPreviewId}InputText`, "", "", "", this.strings.msgExampleOtherWords)}
                        </div>
                        <div class="inline footer-buttons-container">
                            ${this.createSaveQuestionButton()}
                            ${edit ? this.createCancelQuestionButton() : ""}
                            ${this.createRemoveQuestionButton()}
                        </div>
                    </div>`;

            return html;
        }


        /**
         * Generates HTML for the Remove Question button.
         *
         * @returns {String} - HTML string for the remove question button.
         */
        createRemoveQuestionButton() {
            return `<div id="removeQuestionContainer" class="formAddQuestionsContainer">
                    <input type="button" id="removeQuestion" 
                        value="${this.strings.msgERemoveQuestion}" 
                        class="question-button"/>
                </div>`;
        }

        /**
         * Generates HTML for the Cancel Question button.
         *
         * @returns {String} - HTML string for the cancel question button.
         */
        createCancelQuestionButton() {
            return `
                <div id="cancelQuestionContainer" class="formAddQuestionsContainer">
                    <input type="button" id="cancelQuestion" 
                        value="${this.strings.msgECancelQuestion}" 
                        class="question-button"/>
                </div>
                `;
        }


        /**
         * Generates HTML for the Save Question button.
         *
         * @returns {String} - HTML string for the save question button.
         */
        createSaveQuestionButton() {
            return `<div id="saveQuestionContainer" class="formAddQuestionsContainer">
                    <input type="button" id="saveQuestion" 
                        value="${this.strings.msgESaveQuestion}" 
                        class="question-button"/>
                </div>`;
        }

        /**
         * Adds behavior to the Remove Question button.
         */
        behaviourButtonRemoveQuestion() {
            const form = new $exeDevice.Form($exeDevice, $exeDevice.questions);
            $exeDevice.ideviceBody.querySelector("#removeQuestionContainer")
                .addEventListener("click", () => {
                    eXe.app.confirm(_("Attention"), form.strings.msgConfirmRemoveQuestion, () => {
                        form.manageHideQuestion("remove");
                        $exeDevice.ideviceBody.querySelector(`#${$exeDevice.formPreviewId}TextareaContainer`).parentElement.remove();
                        form.disableArrowUpDown();
                        $exeDevice.updateQuestionsNumber();
                    });
                });
        }

        /**
         * Adds behavior to the Cancel Question button.
         */
        behaviourButtonCancelQuestion() {
            const form = new $exeDevice.Form($exeDevice, $exeDevice.questions);
            $exeDevice.ideviceBody.querySelector("#cancelQuestionContainer")
                .addEventListener("click", () => {
                    eXe.app.confirm(_("Attention"), form.strings.msgConfirmCancelEdit, () => {
                        const actualElementQuestion = $exeDevice.ideviceBody
                            .querySelector(`#${$exeDevice.formPreviewId}TextareaContainer`).parentElement;
                        form.manageHideQuestion();
                        actualElementQuestion.remove();
                        form.disableArrowUpDown();

                    });
                });
        }

        /**
         * Adds behavior to the Save Question button.
         *
         * @param {String} questionType - Type of the question being saved.
         */
        behaviourButtonSaveQuestion(questionType) {
            const form = new $exeDevice.Form($exeDevice, $exeDevice.questions);
            $exeDevice.ideviceBody.querySelector("#saveQuestionContainer")
                .addEventListener("click", () => {
                    form.manageHideQuestion("remove");
                    form.addQuestionfrmorm($exeDevice.formPreviewId, questionType);
                    $exeDevice.ideviceBody.querySelector(`#${$exeDevice.formPreviewId}TextareaContainer`).parentElement.remove();
                    form.disableArrowUpDown();
                    $exeDevice.updateQuestionsNumber();
                });

        }

        /**
         * Displays instructions when an element is clicked.
         *
         * @param {HTMLElement} element - The element to attach the event to.
         * @param {String} msgInstructions - Instruction message to display.
         */
        showQuestionInstructions(element, msgInstructions) {
            const form = new $exeDevice.Form($exeDevice, $exeDevice.questions);
            element.addEventListener("click", () => {
                eXe.app.alert(msgInstructions, form.strings.msgEInstructions);
            });
        }

        /**
         * Saves the question currently being edited.
         */
        saveInEditionQuestion() {
            const inEditionTextarea = $exeDevice.ideviceBody.querySelector("#formPreview textarea");
            if (inEditionTextarea) {
                inEditionTextarea.parentElement.querySelector("#saveQuestion").click();
            }
        }

        /**
         * Manages the visibility or removal of a question.
         *
         * @param {String} [action="show"] - Action to perform ('show' or 'remove').
         */
        manageHideQuestion(action = "show") {
            const hideQuestion = $exeDevice.ideviceBody
                .querySelector(`[data-id="${$exeDevice.dataIdQuestionBeforeEdit}"]`);

            if (hideQuestion) {
                if (action === "remove") hideQuestion.remove();
                else if (action === "show") hideQuestion.style.display = "";
            }
            $exeDevice.dataIdQuestionBeforeEdit = "";
        }

        /**
         * Generates HTML for the Form View fieldset container.
         *
         * @returns {String} - HTML string for the form view fieldset.
         */
        createFormViewFieldset() {
            return `<fieldset class="exe-fieldset exe-fieldset-closed">
                    <legend><a href="#">${this.strings.msgEFormView}</a></legend>
                    <div>
                        <ul id="${$exeDevice.formPreviewId}"></ul>
                    </div>
                </fieldset>`;
        }

        /**
         * Adds a question element to the form.
         *
         * @param {String} containerId - ID of the container where the question will be added.
         * @param {String} questionType - Type of the question (e.g., 'selection', 'dropdown', 'true-false').
         */
        addQuestionfrmorm(containerId, questionType) {
            const formIdElement = this.generateRandomId();

            // Create question container
            const questionElement = document.createElement("div");
            questionElement.id = `QuestionElement_${formIdElement}`;
            questionElement.classList.add(`FormViewContainer_${questionType}`, "FormViewContainer");
            questionElement.innerHTML = this.generateElementQuestionForm(containerId, questionType);

            // Set selection type for 'selection' questions
            let selectionType = "";
            if (questionType === "selection") {
                selectionType = $exeDevice.ideviceBody
                    .querySelector("#buttonRadioCheckboxToggle")
                    .getAttribute("selection-type");
            }

            // Create label for the question
            const labelElementQuestion = document.createElement("label");
            labelElementQuestion.innerHTML = `${this.strings.msgEActivity} ${selectionType || ""} ${questionType}`;

            // Create buttons for question actions
            const buttons = [
                { class: "QuestionLabel_moveUp", text: "arrow_upward", action: "behaviourButtonMoveUpQuestionInFormView" },
                { class: "QuestionLabel_moveDown", text: "arrow_downward", action: "behaviourButtonMoveDownQuestionInFormView" },
                { class: "QuestionLabel_edit", text: "edit", action: "behaviourButtonEditQuestionInFormView" },
                { class: "QuestionLabel_remove", text: "close", action: "behaviourButtonCloseQuestionInFormView" }
            ];

            const buttonsContainer = document.createElement("div");
            buttonsContainer.classList.add("inline", "QuestionLabel_ButtonsContainer");

            buttons.forEach(btn => {
                const button = document.createElement("button");
                button.classList.add(btn.class, "QuestionLabel_actionButton");
                button.innerHTML = btn.text;
                this[btn.action](button); // Attach behavior dynamically
                buttonsContainer.appendChild(button);
            });

            // Create top bar with label and buttons
            const topBarContainer = document.createElement("div");
            topBarContainer.id = `${$exeDevice.questionTopBarId}_${formIdElement}`;
            topBarContainer.appendChild(labelElementQuestion);
            topBarContainer.appendChild(buttonsContainer);

            // Create the question container element
            const elementQuestionContainer = document.createElement("li");
            elementQuestionContainer.classList.add(`FormView_${questionType}`, "FormView_question");
            elementQuestionContainer.dataset.id = formIdElement;
            elementQuestionContainer.setAttribute("activity-type", questionType);
            if (questionType === "selection") elementQuestionContainer.setAttribute("selection-type", selectionType);
            elementQuestionContainer.appendChild(topBarContainer);
            elementQuestionContainer.appendChild(questionElement);

            // Insert the question before the one currently being edited
            const inEditionQuestion = $exeDevice.ideviceBody.querySelector("#saveQuestion").closest("LI");
            inEditionQuestion.before(elementQuestionContainer);

            // Enable sortable behavior for the new question
            this.addSortableBehaviour(elementQuestionContainer);
        }

        /**
         * GET HTML view question
         *
         * @param {*} questionId
         *
         * @return string
         */
        generateElementQuestionForm(containerId, questionId) {
            let html = ``;
            let valueText = ``;
            let valueInputText = ``;
            let valueAnswer = ``;
            let container = $exeDevice.ideviceBody.querySelector(`#${containerId}`);
            let tinyTextareaId = container.querySelector("TEXTAREA").id;
            switch (questionId) {
                case "dropdown":
                    valueText = this.parent.getEditorTinyMCEValue(tinyTextareaId);
                    valueInputText = container.querySelector(`INPUT[name="${$exeDevice.formPreviewId}InputText"]`).value;
                    html += this.getProcessTextDropdownQuestion(valueText, valueInputText);
                    break;
                case "selection":
                    let valueQuestionText = this.parent.getEditorTinyMCEValue(tinyTextareaId);
                    let options = $exeDevice.ideviceBody.querySelectorAll(`INPUT[id^=option_]`);
                    valueAnswer = [];
                    options.forEach(option => {
                        valueAnswer.push([option.checked, option.parentElement.parentElement.nextElementSibling.value]);
                    });
                    let optionType = "";
                    if (options.length > 0) {
                        optionType = options[0].type;
                    }
                    html += this.getProcessTextSelectionQuestion(valueQuestionText, optionType, valueAnswer);
                    break;
                case "true-false":
                    valueText = this.parent.getEditorTinyMCEValue(tinyTextareaId);
                    valueAnswer = this.capitalizar(document.querySelector('input[name="TrueFalseQuestion"]').checked.toString()) == "True" ? 1 : 0;
                    html += this.getProcessTextTrueFalseQuestion(valueText, valueAnswer);
                    break;
                case "fill":
                    let checkCapitalization = $exeDevice.ideviceBody.querySelector(`#${$exeDevice.checkCapitalizationId}_${tinyTextareaId}`).checked;
                    let strictQualification = $exeDevice.ideviceBody.querySelector(`#${$exeDevice.checkStrictQualificationId}_${tinyTextareaId}`).checked;
                    valueText = this.parent.getEditorTinyMCEValue(tinyTextareaId);
                    html += this.getProcessTextFillQuestion(valueText, checkCapitalization, strictQualification);
                    break;
                default:
                    break;
            }
            return html;
        }

        /**
         * Generates HTML for a dropdown question form.
         *
         * @param {Boolean} visible - Whether the dropdown form should be initially visible.
         * @returns {String} - HTML string for the dropdown question form.
         */
        getHtmlFormQuestionDropdown(visible) {
            const style = visible ? 'style="display:none;"' : "";

            return `<div id="dropdownQuestionFormCreation" 
                question="dropdown" 
                class="questionCreationForm" 
                ${style}>
                ${this.createQuestionTextareaFieldset("dropdownQuestionTextarea_0", this.strings.msgEText, true, false)}
                ${this.createQuestionInputTextFieldset("dropdownQuestionInputText_0", this.strings.msgOtherWords)}
            </div>`;
        }


        removeOrAddUnderline(editorId) {
            const editor = tinyMCE.get(editorId);
            if (!editor) return;
            editor.focus();
            editor.execCommand('Underline');
            const body = editor.getBody();
            const spans = body.querySelectorAll('span[style*="text-decoration: underline"]');

            spans.forEach(span => {
                const u = body.ownerDocument.createElement('u');
                while (span.firstChild) {
                    u.appendChild(span.firstChild);
                }
                span.parentNode.replaceChild(u, span);
            });
        }

        /**
         *  GET HTML of question container input text
         *
         * @param {*} id
         * @param {*} label
         *
         * @return string
         */
        createQuestionInputTextFieldset(id, label) {
            let html = ``;
            html += `<fieldset class="exe-fieldset exe-fieldset-closed">`;
            html += `<legend><a href="#">${label}</a></legend>`;
            html += `<div><p>`;
            html += `<div id="${id}InputTextContainer" class="question-input-text">`;
            html += this.createInputText(`${id}InputText`, "");
            html += `</div>`
            html += `</p></div>`;
            html += `</fieldset>`;

            return html;
        }
        /**
         * Generates HTML for a selection question form.
         *
         * @param {Boolean} visible - Whether the selection form should be initially visible.
         * @returns {String} - HTML string for the selection question form.
         */
        getHtmlFormQuestionSelection(visible) {
            const style = visible ? 'style="display:none;"' : "";

            return `<div id="selectionQuestionFormCreation" 
                    question="selection" 
                    class="questionCreationForm" 
                    ${style}>
                    ${this.createQuestionTextareaFieldset("selectionQuestionTextarea_0", this.strings.msgEQuestion, false, false)}
                </div>`;
        }

        /**
         * Generates HTML for a question container with textarea.
         *
         * @param {string} id - Unique identifier for the question textarea.
         * @param {string} label - Label for the fieldset.
         * @param {boolean} buttonShowHide - Whether to include a show/hide button.
         * @param {boolean} radioTrueFalse - Whether to include true/false radio buttons.
         * @returns {string} HTML structure for the question container.
         */
        createQuestionTextareaFieldset(id, label, buttonShowHide = false, radioTrueFalse = false) {
            let html = `<fieldset class="exe-fieldset exe-fieldset-closed">
                <legend><a href="#">${label}</a></legend>
                <div><p>
                <div id="${id}TextareaContainer" class="questionTextarea">
                    ${this.createTextArea(`${id}Textarea`)}
                </div>`;

            if (buttonShowHide) html += this.showHideWordButton(`${id}Textarea`);
            if (radioTrueFalse) html += this.showTrueFalseRadioButtons(`${id}TrueFalseRadioButtons`);

            html += `</p></div>
            </fieldset>`;

            return html;
        }


        /**
         * Generates HTML for a true/false question form.
         *
         * @param {Boolean} visible - Whether the true/false form should be initially visible.
         * @returns {String} - HTML string for the true/false question form.
         */
        getHtmlFormQuestionTrueFalse(visible) {
            const style = visible ? 'style="display:none;"' : "";

            return `<div id="trueFalseQuestionFormCreation" 
                    question="true-false" 
                    class="questionCreationForm" 
                    ${style}>
                    ${this.createQuestionTextareaFieldset("trueFalseQuestionTextarea_0", this.strings.msgEQuestion, false, true)}
                </div>`;
        }


        /**
         * GET HTML view question fill
         *
         * @param {*} visible
         *
         * @return string
         */
        getHtmlFormQuestionFill(visible) {
            let html = ``;
            let style = (visible) ? `style="display:none;"` : "";
            html += `<div id="fillQuestionFormCreation" question="fill" class="questionCreationForm" ${style}>`;
            html += this.createQuestionTextareaFieldset("fillQuestionTextarea_0", this.strings.msgEText, true, false);
            html += `</div>`;

            return html;
        }

        showHideWordButton(editorId) {
            const btnId = `buttonShowHide_${editorId}`;
            const html = `
            <input
                type="button"
                id="${btnId}"
                value="${this.strings.msgEShowHideWord}"
                class="question-button"
            />
            `;

            setTimeout(() => {
                document
                    .getElementById(btnId)
                    ?.addEventListener('click', () => {
                        this.removeOrAddUnderline(editorId);
                    });
            }, 0);

            return html;
        }

        /**
         *
         * @param {*} id
         * @returns
         */
        showTrueFalseRadioButtons(id) {
            let html = ``;
            html += `<div id="${id}" class="true-false-radio-buttons-container inline">`;
            html += `<p>`;

            html += `<label for="InputTrue">`;
            html += `<input type="radio" name="TrueFalseQuestion" id="InputTrue" value="${this.strings.msgETrue}" checked>`;
            html += this.strings.msgETrue;
            html += `</label>`
            html += `</p>`;
            html += `<p>`;
            html += `<label for="InputFalse">`;
            html += `<input type="radio" name="TrueFalseQuestion" id="InputFalse" value="${this.strings.msgEFalse}">`;
            html += this.strings.msgEFalse;
            html += `</label>`
            html += `</p>`;
            html += `</div>`;

            return html;
        }

        /**
         *
         */
        behaviourExeTabs() {
            let exeTabs = document.querySelectorAll(".exe-form-tabs .exe-tab");
            [].forEach.call(exeTabs, (function (tab) {
                tab.addEventListener("click", function (event) {
                    document.querySelectorAll(".exe-form-content").forEach(content => {
                        content.style.display = "none";
                    });
                    document.querySelectorAll(".exe-form-tabs .exe-tab").forEach(content => {
                        content.classList.remove("exe-form-active-tab");
                    });
                    tab.classList.add("exe-form-active-tab");
                    document.getElementById(tab.getAttribute("tab")).style.display = "block";
                });
            }));
        }

        behaviourEvaluation() {
            const { ideviceBody } = $exeDevice;

            const evaluation = ideviceBody.querySelector("#evaluationCheckBox");
            const evaluationHelpLink = ideviceBody.querySelector("#helpLinkButton");
            const evaluationInput = ideviceBody.querySelector("#evaluationIDInput");
            const evaluationHelp = ideviceBody.querySelector("#evaluationHelp");
            const divTime = ideviceBody.querySelector("#frmETimeDiv");
            const percentageQuestions = ideviceBody.querySelector("#frmEPercentageQuestions");
            const time = ideviceBody.querySelector("#frmETime");

            if (evaluation) {
                evaluation.addEventListener('change', function () {
                    evaluationInput.disabled = !this.checked;
                });
            }

            if (evaluationHelpLink) {
                evaluationHelpLink.addEventListener('click', (event) => {
                    event.preventDefault();
                    if (evaluationHelp) {
                        evaluationHelp.style.display = evaluationHelp.style.display === 'none' ? 'block' : 'none';
                    }
                });
            }

            if (percentageQuestions) {
                percentageQuestions.addEventListener('keyup', updateValue);
                percentageQuestions.addEventListener('click', updateValue);
                percentageQuestions.addEventListener('blur', function () {
                    let value = percentageQuestions.value.trim() === '' ? 100 : parseInt(percentageQuestions.value, 10);
                    value = Math.max(1, Math.min(value, 100));
                    percentageQuestions.value = value;
                    $exeDevice.updateQuestionsNumber();
                });

            }

            function updateValue() {
                percentageQuestions.value = percentageQuestions.value.replace(/\D/g, '').substring(0, 3);
                if (percentageQuestions.value > 0 && percentageQuestions.value <= 100) {
                    $exeDevice.updateQuestionsNumber();
                }
            }
            if (time) {
                time.addEventListener('keyup', updateValueTime);
                time.addEventListener('click', updateValueTime);
                time.addEventListener('blur', function () {
                    let value = time.value.trim() === '' ? 0 : parseInt(time.value, 10);
                    value = Math.max(0, Math.min(value, 100));
                    time.value = value;
                });
            }
            function updateValueTime() {
                time.value = time.value.replace(/\D/g, '').substring(0, 3);
            }

        }

        // --------------------------------------
        // ::: Behaviour form preview buttons :::
        // --------------------------------------

        /**
         * SET Behaviour on click move down question
         *
         * @param {*} element
         */
        behaviourButtonMoveDownQuestionInFormView(element) {
            let form = new $exeDevice.Form($exeDevice, $exeDevice.questions);
            element.addEventListener("click", function (event) {
                let question = element.closest("LI");
                if (question.nextElementSibling) {
                    if (question.nextElementSibling.querySelector("#formPreviewTextareaContainer") !== null && question.nextElementSibling.nextElementSibling !== null) {
                        question.nextElementSibling.nextElementSibling.after(question);
                    } else {
                        question.nextElementSibling.after(question);
                    }
                }
                form.disableArrowUpDown();
            })
        }

        /**
         * SET Behaviour on click move up question
         *
         * @param {*} element
         */
        behaviourButtonMoveUpQuestionInFormView(element) {
            let form = new $exeDevice.Form($exeDevice, $exeDevice.questions);
            element.addEventListener("click", function (event) {
                let question = element.closest("LI");
                if (question.previousElementSibling) {
                    if (question.previousElementSibling.style.display === "none") {
                        question.previousElementSibling.previousElementSibling.before(question);
                    } else {
                        question.previousElementSibling.before(question);
                    }
                }
                form.disableArrowUpDown();
            })
        }

        /**
         * SET Behaviour on click edit question
         *
         * @param {*} element
         */
        behaviourButtonEditQuestionInFormView(element) {
            let form = new $exeDevice.Form($exeDevice, $exeDevice.questions);
            element.addEventListener("click", function (event) {
                form.saveInEditionQuestion();
                let question = element.closest("LI");
                let editQuestionHTML = "";
                let liQuestion = "";
                let questionTitle = null;
                let questionTitleContainer = null;
                $exeDevice.dataIdQuestionBeforeEdit = question.getAttribute("data-id");
                switch (question.getAttribute("activity-type")) {
                    case "true-false":
                        editQuestionHTML = form.createTrueFalseQuestion(true);
                        liQuestion = `<li class="FormView_question">${editQuestionHTML}</li>`;
                        question.insertAdjacentHTML("beforebegin", liQuestion);
                        form.setDataFromTrueFalseQuestion(question);
                        $exeTinyMCE.init("multiple-visible", ".exe-html-editor");
                        form.behaviourButtonSaveQuestion("true-false");
                        form.behaviourButtonRemoveQuestion();
                        form.behaviourButtonCancelQuestion();
                        questionTitleContainer = $exeDevice.ideviceBody.querySelector("#formPreviewTextareaContainer").querySelector("DIV");
                        questionTitle = $exeDevice.ideviceBody.querySelector("#formPreviewTextareaContainer").querySelector("LABEL");
                        questionTitle.classList.add("instructions");
                        form.showQuestionInstructions(questionTitleContainer, form.strings.msgInstructionsQuestion);
                        break;
                    case "fill":
                        editQuestionHTML = form.createFillQuestion(true);
                        liQuestion = `<li class="FormView_question">${editQuestionHTML}</li>`;
                        question.insertAdjacentHTML("beforebegin", liQuestion);
                        form.setDataFromFillQuestion(question);
                        $exeTinyMCE.init("multiple-visible", ".exe-html-editor");
                        form.behaviourButtonSaveQuestion("fill");
                        form.behaviourButtonRemoveQuestion();
                        form.behaviourButtonCancelQuestion();
                        questionTitleContainer = $exeDevice.ideviceBody.querySelector("#formPreviewTextareaContainer").querySelector("DIV");
                        questionTitle = $exeDevice.ideviceBody.querySelector("#formPreviewTextareaContainer").querySelector("LABEL");
                        questionTitle.classList.add("instructions");
                        form.showQuestionInstructions(questionTitleContainer, form.strings.msgInstructionsFill);
                        let capitalization = $exeDevice.ideviceBody.querySelector(`#${$exeDevice.checkCapitalizationId}_container`).querySelector(".help-icon");
                        form.showQuestionInstructions(capitalization, form.strings.msgInstructionsFillCapitalization);
                        let strictQualification = $exeDevice.ideviceBody.querySelector(`#${$exeDevice.checkStrictQualificationId}_container`).querySelector(".help-icon");
                        form.showQuestionInstructions(strictQualification, form.strings.msgInstructionsFillStrictQualification);
                        break;
                    case "selection":
                        editQuestionHTML = form.createSelectionQuestion(true);
                        liQuestion = `<li class="FormView_question">${editQuestionHTML}</li>`;
                        question.insertAdjacentHTML("beforebegin", liQuestion);
                        form.behaviourToggleOneMultipleAnswer("buttonRadioCheckboxToggle");
                        form.behaviourButtonAddOption(`${$exeDevice.formPreviewId}_buttonAddOption`);
                        form.setDataFromSelectionQuestion(question);
                        // $exeTinyMCE.init("multiple-visible", ".exe-html-editor");
                        $exeTinyMCE.init("multiple-visible", ".exe-html-editor", {
                            forced_root_block: "",
                            forced_br_newlines: true,
                            force_p_newlines: false
                        });

                        form.behaviourButtonSaveQuestion("selection");
                        form.behaviourButtonRemoveQuestion();
                        form.behaviourButtonCancelQuestion();
                        questionTitleContainer = $exeDevice.ideviceBody.querySelector("#formPreviewTextareaContainer").querySelector("DIV");
                        questionTitle = $exeDevice.ideviceBody.querySelector("#formPreviewTextareaContainer").querySelector("LABEL");
                        questionTitle.classList.add("instructions");
                        form.showQuestionInstructions(questionTitleContainer, form.strings.msgInstructionsSelection);
                        break;
                    case "dropdown":
                        editQuestionHTML = form.createDropdownQuestion(true);
                        liQuestion = `<li class="FormView_question">${editQuestionHTML}</li>`;
                        question.insertAdjacentHTML("beforebegin", liQuestion);
                        form.setDataFromDropdownQuestion(question);
                        $exeTinyMCE.init("multiple-visible", ".exe-html-editor");
                        form.behaviourButtonSaveQuestion("dropdown");
                        form.behaviourButtonRemoveQuestion();
                        form.behaviourButtonCancelQuestion();
                        questionTitleContainer = $exeDevice.ideviceBody.querySelector("#formPreviewTextareaContainer").querySelector("DIV");
                        questionTitle = $exeDevice.ideviceBody.querySelector("#formPreviewTextareaContainer").querySelector("LABEL");
                        questionTitle.classList.add("instructions");
                        form.showQuestionInstructions(questionTitleContainer, form.strings.msgInstructionsDropdown);
                        let otherWords = $exeDevice.ideviceBody.querySelector(`#${$exeDevice.formPreviewId}InputTextContainer`).querySelector("DIV");
                        form.showQuestionInstructions(otherWords, form.strings.msgInstructionsDropdownOtherWords);
                        break;
                    default:
                        break;
                }
                if (question) {
                    question.style.display = "none";
                }
            })
        }

        /**
         * SET Behaviour on click remove question
         *
         * @param {*} element
         */
        behaviourButtonCloseQuestionInFormView(element) {
            let form = new $exeDevice.Form($exeDevice, $exeDevice.questions);
            element.addEventListener("click", function (event) {
                eXe.app.confirm(_("Attention"), form.strings.msgConfirmRemoveQuestion, function () {
                    element.closest("LI").remove();
                    if ($exeDevice.ideviceBody.querySelector(`#${$exeDevice.formPreviewId}`).children.length === 0) {
                        $exeDevice.ideviceBody.querySelector(`#${$exeDevice.msgNoQuestionsId}`).style.display = "";
                    }
                });
            })
        }

        /**
         * SET Behaviour all buttons of all questions
         *
         * @param {String} selector
         */
        behaviourButtonsQuestionInFormViewAll(selector) {
            let buttons = $exeDevice.ideviceBody.querySelectorAll(selector);
            buttons.forEach(button => {
                let buttonType = button.classList[0];
                switch (buttonType) {
                    case "QuestionLabel_remove":
                        this.behaviourButtonCloseQuestionInFormView(button);
                        break;
                    case "QuestionLabel_edit":
                        this.behaviourButtonEditQuestionInFormView(button);
                        break;
                    case "QuestionLabel_moveUp":
                        this.behaviourButtonMoveUpQuestionInFormView(button);
                        break;
                    case "QuestionLabel_moveDown":
                        this.behaviourButtonMoveDownQuestionInFormView(button);
                        break;
                    default:
                        break;
                }
            });
        }

        /**
         *
         * @param {*} question
         */
        setDataFromTrueFalseQuestion(question) {
            let bodyQuestion = question.querySelector("[id^=QuestionElement]");
            let questionText = "";
            let checkedOption = bodyQuestion.querySelector('span[id^="TrueFalseAnswer"]').innerHTML;

            let bodyChilds = bodyQuestion.children;
            Object.entries(bodyChilds).forEach(([key, value]) => {
                if (key !== (bodyChilds.length - 1).toString()) {
                    questionText += value.outerHTML;
                }
            });

            let newTextarea = $exeDevice.ideviceBody.querySelector(`TEXTAREA[id^=${$exeDevice.formPreviewId}`);
            newTextarea.innerHTML = questionText.replace(/<p>\s*(<br\s*\/?>)?\s*<\/p>/gi, '');

            let falseBtn = $exeDevice.ideviceBody.querySelector("#InputFalse");
            if (checkedOption === "False") {
                falseBtn.checked = true;
            }
        }

        /**
         *
         * @param {*} question
         */
        setDataFromSelectionQuestion(question) {
            let questionName = question.querySelector("LABEL").innerHTML;
            if (questionName.includes("multiple")) {
                $exeDevice.ideviceBody.querySelector("#buttonRadioCheckboxToggle").click();
            }
            let bodyQuestion = question.querySelector("[id^=QuestionElement]");
            let questionText = "";

            let bodyChilds = bodyQuestion.children;
            Object.entries(bodyChilds).forEach(([key, value]) => {
                if (key !== (bodyChilds.length - 1).toString()) {
                    questionText += value.outerHTML;
                }
            });

            let questionTextarea = $exeDevice.ideviceBody.querySelector(`TEXTAREA[id^=${$exeDevice.formPreviewId}`);
            questionTextarea.innerHTML = questionText.replace(/<p>\s*(<br\s*\/?>)?\s*<\/p>/gi, '');

            let bodyOptions = bodyQuestion.querySelector("DIV[id^=SelectionQuestion]");
            let options = bodyOptions.children;
            let buttonAddOption = $exeDevice.ideviceBody.querySelector(`INPUT#${$exeDevice.formPreviewId}_buttonAddOption`)
            Object.entries(options).forEach(([key, value]) => {
                if (key !== (options.length - 1).toString()) {
                    buttonAddOption.click();
                }
            })
            let optionsTextareas = $exeDevice.ideviceBody.querySelectorAll(`TEXTAREA[id^=${$exeDevice.formPreviewId}]`);

            let checkedOptions = bodyQuestion.querySelector('span[id^="SelectionAnswer"]').innerHTML;
            // Array of index checked option (Strings)
            checkedOptions = checkedOptions.split(",");

            // Remove checked default value of first option
            if ($exeDevice.ideviceBody.querySelector(`#option_1_container`) !== null) {
                $exeDevice.ideviceBody.querySelector(`#option_1_container`).querySelector("INPUT").checked = false;
            }

            Object.entries(options).forEach(([key, valuePreview]) => {
                if (key !== (options.length - 1).toString()) {
                    // First textarea is the question
                    optionsTextareas[parseInt(key) + 1].value = valuePreview.querySelector("LABEL").textContent;

                    if (checkedOptions.includes(key)) {
                        $exeDevice.ideviceBody.querySelector(`#option_${parseInt(key) + 1}_container`).querySelector("INPUT").checked = true;
                    }
                }
            })

        }

        /**
         *
         * @param {*} question
         */
        setDataFromFillQuestion(question) {
            const bodyQuestion = question.querySelector('[id^="QuestionElement"]');
            if (!bodyQuestion) {
                console.error('No element with an id starting with "QuestionElement" was found.');
                return;
            }
            const clone = bodyQuestion.cloneNode(true);
            clone.querySelectorAll('input.fillInput').forEach(input => {
                input.remove();
            });
            clone.querySelectorAll('span[id^="fillAnswer"]').forEach(span => {
                const u = document.createElement('u');
                u.innerHTML = span.innerHTML;
                span.replaceWith(u);
            });

            const capSpan = bodyQuestion.querySelector('span[id^="fillCapitalization"]');
            const strictSpan = bodyQuestion.querySelector('span[id^="fillStrictQualification"]');

            const checkCapitalization = capSpan ? capSpan.innerHTML.trim() : '';
            console.log(checkCapitalization)
            const strictQualification = strictSpan ? strictSpan.innerHTML.trim() : '';
            console.log(checkCapitalization)

            const questionHTML = clone.innerHTML;

            const textarea = $exeDevice.ideviceBody.querySelector(
                `textarea[id^="${$exeDevice.formPreviewId}"]`
            );
            if (textarea) {
                textarea.value = questionHTML.replace(/<p>\s*(<br\s*\/?>)?\s*<\/p>/gi, '');
            } else {
                console.warn(`No <textarea> with an id starting with "${$exeDevice.formPreviewId}" was found.`);
            }

            const capInput = $exeDevice.ideviceBody.querySelector(
                `input[type="checkbox"][id^="checkCapitalization_${$exeDevice.formPreviewId}"]`
            );

            if (capInput) {
                capInput.checked = checkCapitalization == 'true';
            } else {
                console.warn(`No <input> with the id "#checkCapitalization_${$exeDevice.formPreviewId}" was found.`);
            }

            const strictInput = $exeDevice.ideviceBody.querySelector(
                `input[type="checkbox"][id^="checkStrictQualification_${$exeDevice.formPreviewId}"]`
            );
            console.log(`input[type="checkbox"][id^="checkStrictQualification_${$exeDevice.formPreviewId}"]`)
            if (strictInput) {
                strictInput.checked = strictQualification == "true";
            } else {
                console.warn(`No <input> with the id "checkStrictQualification_${$exeDevice.formPreviewId}S" was found.`);
            }
        }

        setDataFromDropdownQuestion(question) {
            const bodyQuestion = question.querySelector('[id^="QuestionElement"]');
            if (!bodyQuestion) {
                console.error('No element with an id that starts with "QuestionElement" was found.');
                return;
            }

            const clone = bodyQuestion.cloneNode(true);

            clone.querySelectorAll('select').forEach(select => {
                select.remove();
            });
            clone.querySelectorAll('span[id^="dropdownAnswer"]').forEach(span => {
                const u = document.createElement('u');
                u.innerHTML = span.innerHTML;
                span.replaceWith(u);
            });


            const questionHTML = clone.innerHTML;
            const wrongSpan = bodyQuestion.querySelector('span[id^="dropdownWrongAnswer"]');
            const otherWordsText = wrongSpan ? wrongSpan.innerHTML : '';

            const textarea = $exeDevice.ideviceBody.querySelector(`textarea[id^="${$exeDevice.formPreviewId}"]`);
            if (textarea) {
                textarea.value = questionHTML.replace(/<p>\s*(<br\s*\/?>)?\s*<\/p>/gi, '');
            } else {
                console.warn(`No <textarea> with an id starting with "${$exeDevice.formPreviewId}" was found.`);
            }

            const otherInput = $exeDevice.ideviceBody.querySelector(`#${$exeDevice.formPreviewId}InputText`);
            if (otherInput) {
                otherInput.value = otherWordsText;
            } else {
                console.warn(`No <input> with the id "${$exeDevice.formPreviewId}InputText" was found.`);
            }
        }

        /**
         * GET HTML of question container textarea
         *
         * @param {*} id
         *
         * @return string
         */
        createQuestionTextareaFieldset(id, label, buttonShowHide = false, radioTrueFalse = false) {
            let html = ``;
            html += `<fieldset class="exe-fieldset exe-fieldset-closed">`;
            html += `<legend><a href="#">${label}</a></legend>`;
            html += `<div><p>`;
            html += `<div id="${id}TextareaContainer" class="questionTextarea">`;
            html += this.createTextArea(`${id}Textarea`);
            html += `</div>`
            if (buttonShowHide) html += this.showHideWordButton(`${id}Textarea`);
            if (radioTrueFalse) html += this.showTrueFalseRadioButtons(`${id}TrueFalseRadioButtons`);
            html += `</p></div>`;
            html += `</fieldset>`;

            return html;
        }

        /**
        *
        * @param {*} baseText
        * @param {*} otherWordsText
        * @returns
        */
        getProcessTextDropdownQuestion(baseText, otherWordsText) {
            let $wrapper = $('<div>').append(baseText);
            let $dropdownBaseText = $wrapper.find('div.dropdownBaseText');
            if ($dropdownBaseText.length) {
                $dropdownBaseText.remove();
            }

            let $dropdownWrongAnswer = $wrapper.find('span.dropdownWrongAnswer');
            let wrongAnswer = '';
            if ($dropdownWrongAnswer.length) {
                wrongAnswer = $dropdownWrongAnswer.html().trim();
                $dropdownWrongAnswer.remove();
            }
            var textBase = $wrapper.html().trim();

            let regexReplace = /(<u>).*?(<\/u>)/;
            let regexElement = /(?<=<u>).*?(?=<\/u>)/;
            let regexElementsAll = /(?<=<u>).*?(?=<\/u>)/g;
            let otherWords = otherWordsText ? otherWordsText.split("|") : [];

            let allMatchs = [...textBase.matchAll(regexElementsAll)];
            let allOptions = allMatchs.map(m => m[0]).concat(otherWords);
            let allOptionsShuffle = this.shuffle(allOptions);

            let selectId = this.generateRandomId();
            let htmlDropdown = textBase;
            while (htmlDropdown.search(regexReplace) >= 0) {
                selectId = this.generateRandomId();
                let answerString = htmlDropdown.match(regexElement)[0];
                htmlDropdown = htmlDropdown.replace(
                    regexReplace,
                    this.getSelectDropdownQuestion(selectId, allOptionsShuffle, answerString)
                );
            }
            selectId = this.generateRandomId();
            let wrongSpan = `<span id="dropdownWrongAnswer_${selectId}" class="dropdownWrongAnswer" style="display:none">${otherWordsText || wrongAnswer}</span>`;
            if (!htmlDropdown.includes("dropdownWrongAnswer")) {
                htmlDropdown += wrongSpan;
            } else {
                let oldWrongAnswers = /<span id="dropdownWrongAnswer[^>]*>[\s\S]*?<\/span>/;
                htmlDropdown = htmlDropdown.replace(oldWrongAnswers, wrongSpan);
            }

            selectId = this.generateRandomId();
            let baseDiv = `<div id="dropdownBaseText_${selectId}" class="dropdownBaseText" style="display:none">${textBase}</div>`;
            if (!htmlDropdown.includes("dropdownBaseText")) {
                htmlDropdown += baseDiv;
            } else {
                let oldBaseText = /<div id="dropdownBaseText[^>]*>[\s\S]*?<\/div>/;
                htmlDropdown = htmlDropdown.replace(oldBaseText, baseDiv);
            }
            return htmlDropdown;
        }

        /**
        *
        * @param {*} baseText
        * @param {*} optionType
        * @param {*} answer
        * @returns
        */
        getProcessTextSelectionQuestion(baseText, optionType, answer) {
            let id = this.generateRandomId();
            let htmlSelection = baseText.replace(/<p>\s*(<br\s*\/?>)?\s*<\/p>/gi, '');;
            let rightAnswer = [];

            htmlSelection += `<div id="SelectionQuestion_${id}" data-id="${id}" class="selection-buttons-container">`;
            answer.forEach((option, index) => {
                htmlSelection += `<div class="inline">`;
                htmlSelection += `<label for="${id}_option_${index + 1}">`;
                htmlSelection += `<input type="${optionType}" name="${id}_SelectionQuestion" id="${id}_option_${index + 1}" value="${option[1]}">`;
                htmlSelection += option[1];
                htmlSelection += `</label>`
                htmlSelection += `</div>`;
                if (option[0]) {
                    rightAnswer.push(index);
                }
            });
            htmlSelection += `<span id="SelectionAnswer_${id}" class="selectionAnswer" style="display:none;">${rightAnswer}</span>`;
            htmlSelection += `</div>`;

            return htmlSelection;
        }

        /**
        *
        * @param {*} baseText
        * @param {*} answer
        * @returns
        */
        getProcessTextTrueFalseQuestion(baseText, answer) {
            let id = this.generateRandomId();
            let htmlTrueFalse = baseText.replace(/<p>\s*(<br\s*\/?>)?\s*<\/p>/gi, '');;
            htmlTrueFalse += `<div id="TrueFalseQuestion_${id}" data-id="${id}" class="true-false-radio-buttons-container inline">`;
            htmlTrueFalse += `<div>`;
            htmlTrueFalse += `<label for="${id}_true">`;
            htmlTrueFalse += `<input type="radio" name="${id}_TrueFalseQuestion" id="${id}_true" value="1">`;
            htmlTrueFalse += this.strings.msgETrue;
            htmlTrueFalse += `</label>`
            htmlTrueFalse += `</div>`;
            htmlTrueFalse += `<div>`;
            htmlTrueFalse += `<label for="${id}_false">`;
            htmlTrueFalse += `<input type="radio" name="${id}_TrueFalseQuestion" id="${id}_false" value="0">`;
            htmlTrueFalse += this.strings.msgEFalse;
            htmlTrueFalse += `</label>`
            htmlTrueFalse += `</div>`;
            htmlTrueFalse += `<span id="TrueFalseAnswer_${id}" class="trueFalseAnswer" style="display:none;">${answer}</span>`;
            htmlTrueFalse += `</div>`;

            return htmlTrueFalse;
        }

        /**
         *
         * @param {*} baseText
         * @param {*} checkCapitalization
         * @param {*} strictQualification
         * @returns
         */
        getProcessTextFillQuestion(baseText, checkCapitalization, strictQualification) {
            let $wrapper = $('<div>').append(baseText);
            let $fillBaseText = $wrapper.find('div.fillBaseText');
            if ($fillBaseText.length) {
                $fillBaseText.remove();
            }

            let $capSpan = $wrapper.find('span[id^="fillCapitalization"]');
            if ($capSpan.length) {
                $capSpan.remove();
            }

            let $strictSpan = $wrapper.find('span[id^="fillStrictQualification"]');
            if ($strictSpan.length) {
                $strictSpan.remove();
            }

            let textBase = $wrapper.html().trim();

            let regexReplace = /(<u>).*?(<\/u>)/;
            let regexElement = /(?<=<u>).*?(?=<\/u>)/;

            let htmlFill = textBase;
            while (htmlFill.search(regexReplace) >= 0) {
                let answerString = htmlFill.match(regexElement)[0].toString().trim();
                let inputId = this.generateRandomId();
                htmlFill = htmlFill.replace(
                    regexReplace,
                    `<input id="fillInput_${inputId}" type="text" data-id="${inputId}" class="fillInput" /> <span id="fillAnswer_${inputId}" class="fillAnswer" style="display:none;">${answerString}</span>`
                );
            }

            let capSpanHTML = `<span id="fillCapitalization_${this.generateRandomId()}" style="display:none;">${checkCapitalization}</span>`;
            if (!htmlFill.includes("fillCapitalization")) {
                htmlFill += capSpanHTML;
            } else {
                let oldCap = /<span id="fillCapitalization[^>]*>[\s\S]*?<\/span>/;
                htmlFill = htmlFill.replace(oldCap, capSpanHTML);
            }

            let strictSpanHTML = `<span id="fillStrictQualification_${this.generateRandomId()}" style="display:none;">${strictQualification}</span>`;
            if (!htmlFill.includes("fillStrictQualification")) {
                htmlFill += strictSpanHTML;
            } else {
                let oldStrict = /<span id="fillStrictQualification[^>]*>[\s\S]*?<\/span>/;
                htmlFill = htmlFill.replace(oldStrict, strictSpanHTML);
            }

            let baseDiv = `<div id="fillBaseText_${this.generateRandomId()}" class="fillBaseText" style="display:none">${textBase}</div>`;
            if (!htmlFill.includes("fillBaseText")) {
                htmlFill += baseDiv;
            } else {
                let oldBase = /<div id="fillBaseText[^>]*>[\s\S]*?<\/div>/;
                htmlFill = htmlFill.replace(oldBase, baseDiv);
            }

            return htmlFill;
        }

        /**
         *
         * @param {*} id
         * @param {*} options
         * @param {*} answer
         * @returns
         */
        getSelectDropdownQuestion(id, options, answer) {
            let selectDropdown = ``;
            selectDropdown += `<select id="dropdownSelect_${id}" class="dropdownSelect" data-id="${id}" name="dropdownSelector">`;
            selectDropdown += `<option value="" selected></option>`;
            options.forEach(option => {
                selectDropdown += `<option value="${option}">${option}</option>`;
            })
            selectDropdown += `</select>`;
            selectDropdown += `<span id="dropdownAnswer_${id}" class="dropdownAnswer" style="display:none">${answer}</span>`;
            return selectDropdown;
        }


        /**
         *
         * @param {*} id
         * @returns
         */
        createPassRateDropdown(id) {
            let options = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
            let selectDropdown = ``;
            selectDropdown += `<select id="${$exeDevice.dropdownPassRateId}_${id}" class="dropdownPassRate" aria-labelledby="${$exeDevice.passRateId}" data-id="${id}">`;
            selectDropdown += `<option value="" selected></option>`;
            options.forEach(option => {
                selectDropdown += `<option value="${option}">${option}%</option>`;
            })
            selectDropdown += `</select>`;

            return selectDropdown;
        }


        createActivityTitle(questionType) {
            let labelElementQuestion = document.createElement("label");

            labelElementQuestion.classList.add("activity-title");
            labelElementQuestion.innerHTML = `${this.strings.msgEActivity} ${questionType}`;

            return labelElementQuestion.outerHTML;
        }

        /**
         * GET HTML of textarea
         * @auxiliar
         *
         * @param {*} id
         * @param {*} defaultText
         */
        createTextArea(id, extraClass = "exe-html-editor", defaultText = "") {
            let html = ``;
            html += `<textarea id="${id}" class="${extraClass}">`;
            html += defaultText;
            html += `</textarea>`;

            return html;
        }

        /**
         * GET HTML of input
         * @auxiliar
         *
         * @param {*} id
         * @param {*} defaultText
         */
        createInputText(id, defaultText, size = "80", extraClass = "", placeholder = "") {
            let html = ``;
            html += `<input type="text" name="${id}" id="${id}" value="${defaultText}"`;
            if (size != "") html += ` size="${size}"`;
            if (extraClass != "") html += ` class="${extraClass}"`;
            if (placeholder != "") html += ` placeholder="${placeholder}"`;
            html += `>`;

            return html;
        }


        /**
         * GET random id
         *
         * @return string
         */
        generateRandomId() {
            const letters = Math.random().toString(36).substring(2, 7).toUpperCase();
            return `${Date.now()}-${letters}`;
        }

        /**
         * Shuffles array in place.
         *
         * @param {Array} a items An array containing the items.
         *
         * @return array
         */
        shuffle(a) {
            let j, x, i;
            for (i = a.length - 1; i > 0; i--) {
                j = Math.floor(Math.random() * (i + 1));
                x = a[i];
                a[i] = a[j];
                a[j] = x;
            }
            return a;
        }

        /**
         * Add sortable behaviour to questions in the preview form
         *
         * @param {elemet} question - can be null. If null search all childs of the form preview
         *
         */
        addSortableBehaviour(question) {
            let sortables = $exeDevice.ideviceBody.querySelectorAll(".FormView_question");
            if (question === undefined || question === null) {
                sortables.forEach(question => {
                    this.questionsDragEvents(question);
                });
            } else {
                this.questionsDragEvents(question);
            }
        }

        /**
         * Add events to quesitons
         *
         * @param {Element} question
         */
        questionsDragEvents(question) {
            question.setAttribute("draggable", true);

            // Events reference target image
            ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
                question.addEventListener(eventName, this.preventDefaults, false);
            });
            ["dragenter", "dragover"].forEach(eventName => {
                question.addEventListener(eventName, this.copyQuestionToDestination, false);
            });

            //Events dragged image
            question.addEventListener("dragstart", this.handleDragStart, false);
            question.addEventListener("dragend", this.handleDragEnd, false);
        }

        /**
         *
         * @param {*} e
         */
        preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        /**
         * Add style to drop area items
         *
         */
        copyQuestionToDestination(e) {
            let overQuestion = e.currentTarget;
            let draggingQuestion = $exeDevice.ideviceBody.querySelector(".dragging");
            let questions = $exeDevice.ideviceBody.querySelectorAll(".FormView_question");
            questions.forEach((question, index) => {
                if (question === overQuestion) {
                    $exeDevice.indexOverItem = index;
                }
                if (question === draggingQuestion) {
                    $exeDevice.indexDraggingItem = index;
                }
            });
            let middleReference = overQuestion.getBoundingClientRect().top + overQuestion.getBoundingClientRect().height / 2;
            if ($exeDevice.indexDraggingItem != $exeDevice.indexOverItem) {

                if (e.pageY < middleReference) {
                    overQuestion.before(draggingQuestion);
                }
                else {
                    overQuestion.after(draggingQuestion);
                }
            }
        }

        /**
         * Add class to the actual dragging element
         *
         */
        handleDragStart(e) {
            e.currentTarget.classList.add("dragging");
        }

        /**
         * Handle actions required after finishing dragging the element
         *
         */
        handleDragEnd(e) {
            e.currentTarget.classList.remove("dragging");

            let form = new $exeDevice.Form($exeDevice, $exeDevice.questions);
            form.disableArrowUpDown();
        }

        disableArrowUpDown() {
            let formPreview = $exeDevice.ideviceBody.querySelector(`#${$exeDevice.formPreviewId}`);
            let questions = formPreview.children;
            Object.entries(questions).forEach(([index, question]) => {
                // Enable up arrow
                if (question.querySelector(".QuestionLabel_moveUp") !== null) {
                    question.querySelector(".QuestionLabel_moveUp").removeAttribute("disabled");
                }

                // Enable down arrow
                if (question.querySelector(".QuestionLabel_moveDown") !== null) {
                    question.querySelector(".QuestionLabel_moveDown").removeAttribute("disabled");
                }

            });
            Object.entries(questions).forEach(([index, question]) => {
                if (index == 0) {
                    // Disable up arrow
                    if (question.querySelector(".QuestionLabel_moveUp") !== null) {
                        question.querySelector(".QuestionLabel_moveUp").setAttribute("disabled", true);
                    }
                    if (questions.length === 1) {
                        // Disable down arrow
                        if (question.querySelector(".QuestionLabel_moveDown") !== null) {
                            question.querySelector(".QuestionLabel_moveDown").setAttribute("disabled", true);
                        }
                    }
                } else if (index == questions.length - 1) {
                    // Disable down arrow
                    if (question.querySelector(".QuestionLabel_moveDown") !== null) {
                        question.querySelector(".QuestionLabel_moveDown").setAttribute("disabled", true);
                    }

                }
            });
        }

        /**
         *
         * @param String str Cadena de texto a capitalizar
         * @returns String con primera letra en mayúsculas
         */
        capitalizar(str) {
            return str.charAt(0).toUpperCase() + str.slice(1);
        }

    },

}
