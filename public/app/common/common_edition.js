/*
    See #91
    This is where $exeDevicesEdition or a similar object should be
    Include here the code that should not be exported
    This code is required to edit the iDevices
*/
var $exeDevicesEdition = {
    iDevice: {
        init: function () {

            var errorMsg = "";

            // Check if the object and the required methods are defined
            if (typeof ($exeDevice) == 'undefined') errorMsg += "$exeDevice";
            else if (typeof ($exeDevice.init) == 'undefined') errorMsg += "$exeDevice.init";
            else if (typeof ($exeDevice.save) == 'undefined') errorMsg += "$exeDevice.save";

            // Show a message if they are not defined
            if (errorMsg != "") {
                errorMsg = _("iDevice error") + ": " + errorMsg + " is not defined.";
                eXe.app.alert(errorMsg);
                return;
            }

            // Check if the submit image exists (it will unless renderEditButtons changes)
            var myLink = $("#exe-submitButton a").eq(0);
            if (myLink.length != 1) {
                eXe.app.alert(_("Report an Issue") + ": $exeDevicesEdition.iDevice.init (#exe-submitButton)");
                return;
            }

            // Execute $exeDevice.save onclick (to validate)
            var onclick = myLink.attr("onclick");
            myLink[0].onclick = function () {
                var html = $exeDevice.save();
                if (html) {
                    $("textarea.mceEditor, #node-content .idevice_node[mode=edition]").val(html);
                    // Execute the IMG default behavior if everything is OK
                    eval(onclick);
                }
            }

            // Replace the _ function (see locale.js)
            _ = function (str) {
                if (typeof ($exeDevice.i18n) != "undefined") {
                    var lang = $("HTML").attr("lang");
                    if (typeof ($exeDevice.i18n[lang]) != "undefined") {
                        return top.translations[str] || $exeDevice.i18n[lang][str] || str;
                    }
                }
                return top.translations[str] || str;
            }

            // Enable the iDevice
            $exeDevice.init();

            // Enable TinyMCE
            if (tinymce.majorVersion == 4) $exeTinyMCE.init("multiple-visible", ".exe-html-editor");
            else if (tinymce.majorVersion == 3) $exeTinyMCE.init("specific_textareas", "exe-html-editor");

            // Enable the FIELDSETs Toggler
            $(".exe-fieldset legend a").click(function () {
                $(this).parent().parent().toggleClass("exe-fieldset-closed");
                return false;
            });

            // Enable the iDevice instructions
            $(".exe-info").each(function () {
                var e = $(this);
                e.html('<p class="exe-block-info exe-block-dismissible">' + e.html() + ' <a href="#" class="exe-block-close" title="' + _("Hide") + '"><span class="sr-av">' + _("Hide") + ' </span>×</a></p>');
            });

            // Dismissible messages
            $(".exe-block-dismissible .exe-block-close").click(function () {
                $(this).parent().fadeOut();
                return false;
            });

            // Enable color pickers (provisional solution)
            // To review: 100 ms delay because the color picker won't work when combined with $exeTinyMCE.init
            setTimeout(function () {
                $exeDevicesEdition.iDevice.colorPicker.init();
            }, 100);

            // Enable file uploaders
            $exeDevicesEdition.iDevice.filePicker.init();

            // Enable shared voice recorder controls in marked audio fields
            $exeDevicesEdition.iDevice.voiceRecorder.initVoiceRecorders(document);
        },
        // Common
        common: {
            // Get the "Content after" or the "Content before" fieldset
            getTextFieldset: function (position) {
                if (typeof (position) != "string" || (position != "after" && position != "before")) return "";
                var tit = _('Content after');
                var id = "After";
                if (position == "before") {
                    tit = _('Content before');
                    id = "Before";
                }
                return "<fieldset class='exe-advanced exe-fieldset exe-feedback-fieldset exe-fieldset-closed'>\
                            <legend><a href='#'>"+ tit + " (" + _('Optional').toLowerCase() + ")</a></legend>\
                                <div>\
                                    <p>\
                                        <label for='eXeIdeviceText"+ id + "' class='sr-av'>" + tit + ":</label>\
                                            <textarea id='eXeIdeviceText"+ id + "' class='exe-html-editor'\></textarea>\
                                    </p>\
                                <div>\
                        </fieldset>";
            }
        },
        // Gamification
        gamification: {
            common: {
                getFieldsets: function () {
                    return "";
                },
                getLanguageTab: function (fields) {
                    var html = "";
                    var field, label, txt;
                    for (var i in fields) {
                        field = fields[i]
                        if (typeof field == "string") {
                            label = field
                            txt = field
                        } else {
                            if (field.length == 2) {
                                label = field[0]
                                txt = field[1]
                            } else {
                                label = field[0]
                                txt = field[0]
                            }
                        }
                        html += '<p class="ci18n"><label for="ci18n_' + i + '">' + label + '</label> <input type="text" class="form-control" name="ci18n_' + i + '" id="ci18n_' + i + '" value="' + txt + '" /></p>'
                    }
                    return '\
                            <div class="exe-form-tab" title="' + _('Custom texts') + '">\
                                <p>' + _("Type your own texts or use the default ones:") + '</p>\
                                ' + html + '\
                            </div>'
                },
                setLanguageTabValues: function (obj) {
                    if (typeof obj == "object") {
                        for (var i in obj) {
                            var v = obj[i];
                            if (v != "") $("#ci18n_" + i).val(v);
                        }
                    }
                },
                getGamificationTab: function () {
                    return '\
                            ' + $exeDevicesEdition.iDevice.gamification.itinerary.getItineraryTab() + '\
                            ' + $exeDevicesEdition.iDevice.gamification.scorm.getScormTab() + '\
                            ' + $exeDevicesEdition.iDevice.gamification.share.getShareTab();
                }
            },
            instructions: {
                getFieldset: function (str) {
                    return '<fieldset class="exe-fieldset exe-fieldset-closed">\
                        <legend><a href="#">' + _("Instructions") + '</a></legend>\
                        <div>\
                            <p>\
                                <label for="eXeGameInstructions" class="sr-av">' + _("Instructions") + ': </label>\
                                <textarea id="eXeGameInstructions" class="exe-html-editor form-control exe-instructions-textarea" rows="4">' + str + ' </textarea>\
                            </p>\
                        </div>\
                    </fieldset>';
                }
            },
            itinerary: {
                getContents: function () {
                    return `
                        <p class="exe-block-info">${_("You might create a sequence of challenges where players won't be able to access a new game or challenge until they obtain a key from previous activity. For this purpose, you might set up an access code as well as a message that will be displayed to players when they reach a fixed percentage of correct answers, which they can use as a password for a new challenge or a following activity.")}</p>
                        <div class="toggle-item mb-3" data-target="eXeGameShowCodeAccessOptions">
                            <span class="toggle-control">
                                <input type="checkbox" class="toggle-input" id="eXeGameShowCodeAccess" />
                                <span class="toggle-visual"></span>
                            </span>
                            <label class="toggle-label" for="eXeGameShowCodeAccess">${_("Access code is required")}</label>
                        </div>
                        <div id="eXeGameShowCodeAccessOptions" class="gap-3 mb-3" style="display:none; flex-wrap: nowrap;margin-left:1.4em;">
                            <div class="d-flex flex-column flex-grow-1" style="min-width:220px;max-width:300px;">
                                <label for="eXeGameCodeAccess" id="labelCodeAccess" class="mb-1">${_("Access code")}:</label>
                                <input type="text" name="eXeGameCodeAccess" id="eXeGameCodeAccess" class="form-control" maxlength="40" disabled />
                            </div>
                            <div class="d-flex flex-column flex-grow-1" style="min-width:260px">
                                <label for="eXeGameMessageCodeAccess" id="labelMessageAccess" class="mb-1">${_("Question")}:</label>
                                <input type="text" name="eXeGameMessageCodeAccess" id="eXeGameMessageCodeAccess" class="form-control" maxlength="200" disabled />
                            </div>
                        </div>
                        <div class="toggle-item mb-3" data-target="eXeGameShowClueOptions">
                            <span class="toggle-control">
                                <input type="checkbox" class="toggle-input" id="eXeGameShowClue" />
                                <span class="toggle-visual"></span>
                            </span>
                            <label class="toggle-label" for="eXeGameShowClue">${_("Display a message or password upon reaching the defined objective")}</label>
                        </div>
                        <div id="eXeGameShowClueOptions" class="gap-3 mb-3" style="margin-left:1.4em;display:none">
                            <div class="d-flex gap-1 mb-3 align-items-center">
                                <label for="eXeGameClue" class="mb-1">${_("Message")}:</label>
                                <input type="text" name="eXeGameClue" id="eXeGameClue" class="form-control" maxlength="50" disabled />
                            </div>
                            <div class="d-flex gap-1 align-items-center mb-3">
                                <label for="eXeGamePercentajeClue" id="labelPercentajeClue" class="mb-1">${_("Percentage of correct answers required to display the message")}:</label>
                                <select id="eXeGamePercentajeClue" class="form-select" disabled style="max-width:8ch;width:8ch;">
                                    <option value="10">10%</option>
                                    <option value="20">20%</option>
                                    <option value="30">30%</option>
                                    <option value="40" selected>40%</option>
                                    <option value="50">50%</option>
                                    <option value="60">60%</option>
                                    <option value="70">70%</option>
                                    <option value="80">80%</option>
                                    <option value="90">90%</option>
                                    <option value="100">100%</option>
                                </select>
                            </div>
                        </div>
                    `;
                },
                getTab: function () {
                    return `
                        <div class="exe-form-tab" title="${_('Passwords')}">
                            ${$exeDevicesEdition.iDevice.gamification.itinerary.getContents()}
                        </div>`;
                },

                getValues: function () {
                    var showClue = $('#eXeGameShowClue').is(':checked'),
                        clueGame = $.trim($('#eXeGameClue').val()),
                        percentageClue = parseInt($('#eXeGamePercentajeClue').children("option:selected").val()),
                        showCodeAccess = $('#eXeGameShowCodeAccess').is(':checked'),
                        codeAccess = $.trim($('#eXeGameCodeAccess').val()),
                        messageCodeAccess = $.trim($('#eXeGameMessageCodeAccess').val());

                    if (showClue && clueGame.length == 0) {
                        eXe.app.alert(_("You must write a clue"));
                        return false;
                    }
                    if (showCodeAccess && codeAccess.length == 0) {
                        eXe.app.alert(_("You must provide the code to play this game"));
                        return false;
                    }
                    if (showCodeAccess && messageCodeAccess.length == 0) {
                        eXe.app.alert(_("Please explain how to obtain the code to play this game"));
                        return false;
                    }
                    var a = {
                        'showClue': showClue,
                        'clueGame': clueGame,
                        'percentageClue': percentageClue,
                        'showCodeAccess': showCodeAccess,
                        'codeAccess': codeAccess,
                        'messageCodeAccess': messageCodeAccess
                    }
                    return a;
                },
                setValues: function (a) {
                    $('#eXeGameShowClue').prop('checked', a.showClue);
                    if (a.showClue) $("#eXeGameShowClueOptions").show();
                    $('#eXeGameClue').val(a.clueGame);
                    $('#eXeGamePercentajeClue').val(a.percentageClue);
                    $('#eXeGameShowCodeAccess').prop('checked', a.showCodeAccess);
                    if (a.showCodeAccess) $("#eXeGameShowCodeAccessOptions").css("display", "flex");
                    $('#eXeGameCodeAccess').val(a.codeAccess);
                    $('#eXeGameMessageCodeAccess').val(a.messageCodeAccess);
                    $('#eXeGameClue').prop('disabled', !a.showClue);
                    $('#eXeGamePercentajeClue').prop('disabled', !a.showClue);
                    $('#eXeGameCodeAccess').prop('disabled', !a.showCodeAccess);
                    $('#eXeGameMessageCodeAccess').prop('disabled', !a.showCodeAccess);
                },
                addEvents: function () {
                    $('#eXeGameShowClue').on('change', function () {
                        var mark = $(this).is(':checked');
                        if (mark) $("#eXeGameShowClueOptions").show();
                        else $("#eXeGameShowClueOptions").hide();
                        $('#eXeGameClue').prop('disabled', !mark);
                        $('#eXeGamePercentajeClue').prop('disabled', !mark);
                    });
                    $('#eXeGameShowCodeAccess').on('change', function () {
                        var mark = $(this).is(':checked');
                        if (mark) $("#eXeGameShowCodeAccessOptions").css("display", "flex");
                        else $("#eXeGameShowCodeAccessOptions").hide();
                        $('#eXeGameCodeAccess').prop('disabled', !mark);
                        $('#eXeGameMessageCodeAccess').prop('disabled', !mark);
                    });
                    $('#eXeGameItineraryOptionsLnk').click(function () {
                        $("#eXeGameItineraryOptionsLnk").remove();
                        $("#eXeGameItineraryOptions").fadeIn();
                        return false;
                    });
                }
            },
            scorm: {
                init: function () {
                    $exeDevicesEdition.iDevice.gamification.scorm.setValues(0, _("Save score"), false)
                    $exeDevicesEdition.iDevice.gamification.scorm.addEvents();
                },

                getTab: function (hidebutton = false, hiderepeat = false, onlybutton = false) {
                    const displaybutton = hidebutton ? `style="display:none;"` : '';
                    const displayrepeat = hiderepeat ? `style="display:none;"` : '';
                    const message = onlybutton ? _("Save the score") : _("Automatically save the score");
                    return `
                        <div class="exe-form-tab" title="${_('SCORM')}">
                            <div class="d-flex align-items-center gap-1 mb-3 ml-1">
                                <input class="form-check-input" type="radio" name="eXeGameSCORM" id="eXeGameSCORMNoSave" value="0" checked />
                                <label class="form-check-label" for="eXeGameSCORMNoSave">${_("Do not save the score")}</label>
                            </div>
                            <div class="d-flex align-items-center gap-1 mb-3 ml-1" id="eXeGameSCORMAutomatically">
                                <input class="form-check-input" type="radio" name="eXeGameSCORM" id="eXeGameSCORMAutoSave" value="1" />
                                <label class="form-check-label" for="eXeGameSCORMAutoSave">${message}</label>
                                <span id="eXeGameSCORgameAuto" class="ms-3" style="display:none;">
                                    <div class="form-check form-check-inline" ${displayrepeat}>
                                        <input class="form-check-input" type="checkbox" id="eXeGameSCORMRepeatActivityAuto" checked />
                                        <label class="form-check-label" for="eXeGameSCORMRepeatActivityAuto">${_("Repeat activity")}</label>
                                    </div>
                                </span>
                            </div>
                            <div class="d-flex align-items-center gap-1 mb-3 ml-1" id="eXeGameSCORMblock" ${displaybutton}>
                                <input class="form-check-input" type="radio" name="eXeGameSCORM" id="eXeGameSCORMButtonSave" value="2" />
                                <label class="form-check-label" for="eXeGameSCORMButtonSave">${_("Show a button to save the score")}</label>
                                <span id="eXeGameSCORgame" class="d-inline-flex align-items-center flex-wrap gap-2 ms-3" style="display:none;">
                                    <label for="eXeGameSCORMbuttonText" class="form-label mb-0">${_("Button text")}: </label>
                                    <input type="text" max="100" name="eXeGameSCORMbuttonText" id="eXeGameSCORMbuttonText" value="${_("Save score")}" class="form-control " style="width: auto; min-width: 140px;" />
                                    <div class="form-check" ${displayrepeat}>
                                        <input class="form-check-input" type="checkbox" id="eXeGameSCORMRepeatActivity" checked />
                                        <label class="form-check-label" for="eXeGameSCORMRepeatActivity">${_("Repeat activity")}</label>
                                    </div>
                                </span>
                            </div>
                            <div id="eXeGameSCORMinstructionsAuto" class="mb-3 ml-2">
                                <ul class="mb-3">
                                    <li>${_("This will only work when exported as SCORM")}</li>
                                    <li ${displaybutton}>${_("The score will be automatically saved after answering each question and at the end of the game.")}</li>
                                </ul>
                            </div>
                            <div id="eXeGameSCORMinstructionsButton" class="mb-3 ml-2">
                                <ul class="mb-3">
                                    <li>${_("The button will only be displayed when exported as SCORM.")}</li>
                                </ul>
                            </div>
                            <div id="eXeGameSCORMPercentaje" class="d-flex align-items-center gap-2" >
                                <label for="eXeGameSCORMWeight" class="form-label mb-0">${_("Weighted")}: </label>
                                <input type="number" id="eXeGameSCORMWeight" name="eXeGameSCORMWeight" value="100" min="1" max="100" class="form-control" style="width: 9.5ch !important; max-width:9.5ch  !important;" />
                                <span>%</span>   
                            </div>
                        </div>`;
                },

                setValues: function (isScorm, textButtonScorm, repeatActivity = true, weighted = 100) {
                    $("#eXeGameSCORgame").css("visibility", "hidden");
                    $("#eXeGameSCORgameAuto").css("visibility", "hidden");
                    $("#eXeGameSCORMPercentaje").css("visibility", "visible");
                    $("#eXeGameSCORMinstructionsButton").hide();
                    $("#eXeGameSCORMinstructionsAuto").hide();

                    $('#eXeGameSCORMWeight').val(weighted);

                    if (isScorm == 0) {
                        $('#eXeGameSCORMNoSave').prop('checked', true);
                        $("#eXeGameSCORMPercentaje").css("visibility", "hidden");
                    } else if (isScorm == 1) {
                        $('#eXeGameSCORMAutoSave').prop('checked', true);
                        $('#eXeGameSCORgameAuto').css("visibility", "visible");
                        $('#eXeGameSCORMRepeatActivityAuto').prop("checked", repeatActivity);
                        $('#eXeGameSCORMinstructionsAuto').show();
                    } else if (isScorm == 2) {
                        $('#eXeGameSCORMButtonSave').prop('checked', true);
                        $('#eXeGameSCORMbuttonText').val(textButtonScorm);
                        $('#eXeGameSCORgame').css("visibility", "visible");
                        $('#eXeGameSCORMinstructionsButton').show();
                        $('#eXeGameSCORMRepeatActivity').prop("checked", repeatActivity);
                    }
                },

                getValues: function () {
                    var isScorm = parseInt($("input[type=radio][name='eXeGameSCORM']:checked").val()),
                        textButtonScorm = $("#eXeGameSCORMbuttonText").val(),
                        weighted = $('#eXeGameSCORMWeight').val() === '' ? -1 : parseFloat($('#eXeGameSCORMWeight').val());
                    return {
                        'isScorm': isScorm,
                        'textButtonScorm': textButtonScorm,
                        'repeatActivity': true,
                        'weighted': weighted,
                    };
                },

                addEvents: function () {
                    $('input[type=radio][name="eXeGameSCORM"]').on('change', function () {
                        $("#eXeGameSCORgame,#eXeGameSCORgameAuto, #eXeGameSCORMinstructionsButton,#eXeGameSCORMinstructionsAuto").hide();
                        switch ($(this).val()) {
                            case '0':
                                $("#eXeGameSCORMPercentaje").css("visibility", "hidden");
                                break;
                            case '1':
                                $("#eXeGameSCORMinstructionsAuto").hide().css({
                                    opacity: 0,
                                    visibility: "visible"
                                }).show().animate({
                                    opacity: 1
                                }, 500);
                                $("#eXeGameSCORMPercentaje").hide().css({
                                    opacity: 0,
                                    visibility: "visible"
                                }).show().animate({
                                    opacity: 1
                                }, 500);
                                break;
                            case '2':
                                $("#eXeGameSCORMinstructionsButton").hide().css({
                                    opacity: 0,
                                    visibility: "visible"
                                }).show().animate({
                                    opacity: 1
                                }, 500);

                                $("#eXeGameSCORMPercentaje").hide().css({
                                    opacity: 0,
                                    visibility: "visible"
                                }).show().animate({
                                    opacity: 1
                                }, 500);
                                break;
                        }
                    });
                    $('#eXeGameSCORMWeight').on('keyup click', function () {
                        this.value = this.value.replace(/\D/g, '').substring(0, 3);
                    }).on('focusout', function () {
                        let value = this.value.trim() === '' ? 100 : parseInt(this.value, 10);
                        value = Math.max(1, Math.min(value, 100));
                        this.value = value;
                    });
                },

            },

            share: {
                getTab: function (allowtext = false, type = 0, exportquestion = false) {
                    const txt = allowtext ? ', .txt, .xml' : '';
                    const formtxt = allowtext ? ', txt, xml' : '';
                    const displayEQ = exportquestion ? 'block' : 'none';
                    const msgimport = _('You can import questions compatible with this activity from txt or xml (Moodle) files.');
                    const tab = `
                            <div class="exe-form-tab" title="${_('Import/Export')}">
                                <p class="exe-block-info">${msgimport}</p>
                                <div id="eXeGameExportImport">
                                    <div>
                                        <form method="POST">
                                            <div class="exe-file-upload" data-exe-upload>
                                                <label for="eXeGameImportGame" class="form-label mb-1">${_("Import")}: </label>
                                                <input type="file" name="eXeGameImportGame" id="eXeGameImportGame" accept="${txt}" class="exe-file-input" />
                                                <button type="button" class="btn btn-primary exe-file-btn" data-exe-file-trigger>${_("Choose")}</button>
                                                <span class="exe-file-name" data-exe-file-name>${_("No file selected")}</span>
                                                <span class="exe-field-instructions d-block mt-1">${_("Supported formats")}:${formtxt}</span>
                                            </div>
                                        </form>
                                    </div>
                                    <p class="exe-block-info" style="display:${displayEQ}" >${_('You can export its questions in txt format to integrate them into other compatible activities.')}</p>
                                    <p class ="d-flex align-items-center justify-content-start gap-1">
                                        <input type="button" class="btn btn-primary ms-2"  name="eXeGameExportGame" id="eXeGameExportQuestions" value="${_("Export questions")}" style="display:${displayEQ}" />
                                    </p>
                                </div>
                            </div>`;
                    return tab.replace(/[ \t]+/g, ' ').trim();
                },

                getTabIA: function (type = 0) {
                    const msgAddText = _("You can easily generate multiple questions for the activity using AI.");
                    const fprompt = $exeDevicesEdition.iDevice.gamification.share.getAllowedFormats(type);
                    const tab = `
                        <div class="exe-form-tab" title="${_('AI')}">
                            <p class="exe-block-info">${msgAddText}</p>
                            <p style="display:none"><input type="button" class="btn btn-primary ms-2"  name="eXeGameAddQuestions" id="eXeGameAddQuestion" value="${_('Add questions')}" /></p>
                            <div class="bg-white rounded w-100 position-relative" style="max-width: 1400px;" id="eXeEAddArea">
                                <ul class="nav nav-tabs">
                                    <li class="nav-item">
                                        <a id="eXeETabPrompt" class="nav-link bg-light border-end active" href="#">
                                        ${_('Prompt')}
                                        </a>
                                    </li>
                                    <li class="nav-item">
                                        <a id="eXeETabQuestions" class="nav-link bg-light border-end"  href="#">
                                         ${_('Questions')}
                                        </a>
                                    </li>
                                    <li class="nav-item" style="display:none">
                                        <a id="eXeETabIA" class="nav-link bg-light border-end" href="#">
                                        ${_('Generate')}
                                        </a>
                                    </li>
                                </ul>
                                <div class="eXeE-LightboxContent p-2">
                                    <textarea class="form-control font-monospace fs-6" style="min-height:350px;" id="eXeEPromptArea">
                                        ${c_('Act as a highly experienced teacher.')}
                                        ${fprompt.prompt}
                                        ${c_('Formats')}:
                                        ${fprompt.format.join('\\n')} 
                                        ${fprompt.explanation}
                                        ${c_('Examples')}:
                                        ${fprompt.examples.join('\\n')}
                                        ${c_('You must return only the questions without numbering, categorization or bullet points, inside a code block, and do not include any additional HTML elements such as buttons.')}, 
                                    </textarea>
                                    <textarea id="eXeEQuestionsArea" class="form-control font-monospace fs-6" style="min-height:350px;display:none"></textarea>
                                    <div  class="form-control font-monospace fs-6" id="eXeEIADiv"  style="display:none">
                                        ${$exeDevicesEdition.iDevice.gamification.share.createIAButtonsHtml()}
                                        <textarea class="form-control font-monospace fs-6" style="display:none" id="eXeEQuestionsIA"> </textarea>
                                    </div>
                                </div>
                                <div class="d-flex justify-content-end  border-secondary p-2">
                                   <button id="eXeESaveButton"  class="btn  btn-primary ms-2"/>${_('Save')}</button>
                                   <button id="eXeECopyButton"  class="btn btn-primary ms-2"/>${_('Copy')}</button>
                                   <select id="eXeEIASelect" name="eXeEIASelect" class="form-select form-select-sm w-auto ms-2">
                                        <option selected value="https://chatgpt.com/?q=">ChatGPT</option>
                                        <option value="https://claude.ai/new?q=">Claude</option>
                                        <option value="https://www.perplexity.ai/search?q=">Perplexity</option>
                                        <option value="https://chat.mistral.ai/chat/?q=">Le Chat (Mistral)</option>
                                        <option value="https://grok.com/?q=">Grok</option>
                                        <option value="https://chat.qwen.ai/?text=">Qwen</option>
                                    </select>
                                   <button id="eXeEOpenChatGPTButton"  class="btn btn-primary ms-2"/>${_('Send to AI')}</button>
                                   <button id="eXeEIAButton"  class="btn btn-primary"/>${_('Add questions')}</button>
                                </div>
                            </div>
                        </div>`;
                    return tab.replace(/[ \t]+/g, ' ').trim();
                },

                createIAButtonsHtml: function () {
                    return `<div id="eXeFormIAContainer">
                        <div class="dd-flex gap-2 mt-3 mb-3">
                            <label for="eXeSpecialtyIA">${_('Specialty')}:
                                <input list="specialtyList" id="eXeSpecialtyIA" name="specialty" value="${_('Biology')}" style="width: 150px;">
                                <datalist id="specialtyList">
                                    <option value="${_('Biology')}">
                                    <option value="${_('Law')}">
                                    <option value="${_('Economy')}">
                                    <option value="${_('Education')}">
                                    <option value="${_('Geology')}">
                                    <option value="${_('History')}">
                                    <option value="${_('Computer Science')}">
                                    <option value="${_('Mathematics')}">
                                    <option value="${_('Medicine')}">
                                    <option value="${_('Psychology')}">
                                    <option value="${_('Chemistry')}">
                                </datalist>
                            </label>
                            <label for="eXeCourseIA">${_('Course')}:
                                <input list="courseList" id="eXeCourseIA" name="course" value="${_('3rd ESO')}" style="width: 130px;">
                                <datalist id="courseList">
                                    <option value="${_('1st Primary')}">
                                    <option value="${_('2nd Primary')}">
                                    <option value="${_('3rd Primary')}">
                                    <option value="${_('4th Primary')}">
                                    <option value="${_('5th Primary')}">
                                    <option value="${_('6th Primary')}">
                                    <option value="${_('1st ESO')}">
                                    <option value="${_('2nd ESO')}">
                                    <option value="${_('3rd ESO')}">
                                    <option value="${_('4th ESO')}">
                                    <option value="${_('1st Baccalaureate')}">
                                    <option value="${_('2nd Baccalaureate')}">
                                    <option value="${_('Intermediate Vocational Training')}">
                                    <option value="${_('Higher Vocational Training')}">
                                </datalist>
                            </label>
                            <label for="eXeNumberOfQuestionsIA">${_('Number of Questions')}:
                                <input id="eXeNumberOfQuestionsIA" type="number" min="1" max="30" value="10" class="form-control form-control-sm" style="width:6ch;">
                            </label>
                            <label for="eXeThemeIA">${_('Topic')}:
                                <input id="eXeThemeIA" type="text" style="width: 300px;">
                            </label>
                             <button id="eXeIAButton" class="btn btn-success ms-2">${_('Create')}</button>
                        </div>
                        <p id="eXeIAMessage" class="dp-none"></p>
                    </div>`;
                },


                getAllowedFormats: function (gameId) {
                    const gameFormats = {
                        0: { // Word/Definition
                            format: [`${c_('Word')}#${c_('Definition')}`],
                            explanation: `${c_('Neither the word nor the definition must contain #')}`,
                            examples: [`${c_('Heart')}#${c_('A muscular organ that pumps blood through the body')}`],
                            allowRegex: /^([^#]+)#([^#]+)(#([^#]+))?(#([^#]+))?$/,
                            prompt: c_(`Generate 10 words followed by their definitions, separated by #. Do not include the # character in either the word or the definition.`)
                        },
                        1: { // A-Z Quiz
                            format: [
                                `${c_('Word')}#${c_('Definition')}`,
                                `${c_('Word')}#${c_('Definition')}#${c_('Type')}#${c_('Letter')}`
                            ],
                            explanation: `${c_('The type will be 0 if the word starts with the letter and 1 if the word contains the letter')}`,
                            examples: [
                                `${c_('Atom')}#${c_('The basic unit of a chemical element')}`,
                                `${c_('Biology')}#${c_('The study of living organisms')}#0#${c_('B')}`
                            ],
                            allowRegex: /^([^#]+)#([^#]+)(#(0|1)(#[^#]+)?)?$/,
                            prompt: c_(`Generate 30 words and their definitions separated by #.`)
                        },
                        2: { // Test
                            format: [
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}#${c_('OptionC')}#${c_('OptionD')}`,
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}#${c_('OptionC')}`,
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}`
                            ],
                            explanation: `${c_('Solution: 0, 1, 2 or 3')}`,
                            examples: [
                                `1#${c_('What is the largest planet in the solar system?')}#${c_('Earth')}#${c_('Jupiter')}#${c_('Mars')}#${c_('Venus')}`,
                                `0#${c_('What process do plants use to produce energy?')}#${c_('Photosynthesis')}#${c_('Respiration')}#${c_('Digestion')}`
                            ],
                            allowRegex: /^(0|1|2|3)#([^#]+)#([^#]+)#([^#]+)(#[^#]+){0,2}$/,
                            prompt: c_(`Create 10 multiple-choice questions with 2 to 4 options. Start with the correct solution (0, 1, 2, or 3), followed by the question and each option, all separated by #.`)
                        },
                        3: { // Select
                            format: [
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}#${c_('OptionC')}#${c_('OptionD')}`,
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}#${c_('OptionC')}`,
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}`
                            ],
                            explanation: `${c_('Solution: Any combination of A,B,C and D: A, AC, CD...')}
                            `,
                            examples: [
                                `${c_('A')}#${c_('Which of the following are mammals?')}#${c_('Dog')}#${c_('Frog')}#${c_('Eagle')}#${c_('Lizard')}`,
                                `${c_('AB')}#${c_('Which gases are involved in photosynthesis?')}#${c_('Oxygen')}#${c_('Carbon dioxide')}#${c_('Nitrogen')}`
                            ],
                            allowRegex: /^(([0-3]|[A-D]{1,4})#[^#]+#[^#]+(?:#[^#]*){0,3}|[^#]+#[^#]+)$/,
                            prompt: c_(`Generate 10 multiple-choice questions. Provide the correct answer as letters (e.g., A, AB), followed by the question and the options, all separated by #.`)
                        },
                        4: { // Identify
                            prompt: c_(`Create 5 solution words followed by 3 to 9 clues that describe each one. Separate each clue with #.`),
                            format: [`${c_('Solution')}#${c_('Clue1')}#${c_('Clue2')}#${c_('Clue3')}#${c_('Clue4')}#${c_('Clue5')}...`],
                            explanation: `${c_('You must provide between 3 and 9 clues')}`,
                            examples: [
                                `${c_('Mercury')}#${c_('Closest planet to the Sun')}#${c_('Smallest planet')}#${c_('Named after a Roman god')}`
                            ],
                            allowRegex: /^([^#]+)(#([^#]+)){3,9}$/,
                        },
                        5: { // Classify
                            format: [`${c_('Group')}#${c_('Question')}`],
                            explanation: `${c_('Group: 0, 1, 2 or 3')}`,
                            examples: [
                                `0#${c_('Lion')}`,
                                `1#${c_('Rabbit')}`,
                                `0#${c_('Tiger')}`
                            ],
                            allowRegex: /^(0|1|2|3)#[^#]+$/,
                            prompt: c_(`Provide 4 elements for each of these groups: carnivores, 0, and herbivores, 1. Separate the group number and the element using the symbol #.`),
                        },
                        6: { // True or false
                            prompt: c_(`Generate 10 true or false questions. Each question must include the solution (0 = false, 1 = true), a suggestion, and feedback, all separated by #. Additionally, the feedback must not explicitly indicate whether the response is correct or incorrect`),
                            format: [`${c_('question')}#${c_('solution')}#${c_('suggestion')}#${c_('feedback')}`],
                            explanation: `${c_('The format requires a question (non-empty string), a solution (0 or 1), a suggestion (mandatory, can be empty), and feedback (mandatory, can be empty).')}`,
                            examples: [
                                `${c_('Is the Earth round?')}#1#${c_('Think about the horizon.')}#${c_('The Earth is not flat.')}`,
                                `${c_('Does water boil at 100 degrees Celsius?')}#0##${c_('It depends on the altitude.')}`
                            ],
                            allowRegex: /^vof#[^\s#].*?#(0|1)#.*?#.*?|[^\s#].*?#(0|1)#.*?#.*?|[01]#[^#]+$/,
                        },
                        7: { // form
                            prompt: c_(`Generate 10 questions. The 'Solution' can be 0/1 for True/False, 0-3 for single-choice, or A-D (or combinations) for multiple-choice. Then provide the question and the answer options (2 to 4), all separated by '#'.`),
                            format: [
                                `${c_('Solution')}#${c_('Question')}`,
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}#${c_('OptionC')}#${c_('OptionD')}`,
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}#${c_('OptionC')}`,
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}`,
                            ],
                            explanation: `${c_('The solution can be:')} 
                              - ${c_('0 or 1 for True/False')}. Format: ${c_('Solution')}#${c_('Question')}
                              - ${c_('any digit from 0 to 3 for single-choice (up to 4 options)')} 
                              - ${c_('any combination of A-D for multiple-choice (up to 4 options).')}
                              ${c_('Provide a similar number of questions for each type.')}`,
                            examples: [
                                `1#${c_('Is the Earth round?')}`,
                                `3#${c_('Which number is prime?')}#4#6#11#12#14#15`,
                                `AB#${c_('Which of the following are mammals?')}#${c_("Dog")}#${c_("Frog")}#${c_("Eagle")}#${c_("Cat")}`
                            ],
                            allowRegex: /^(?:[01]#[^#]+|[0-5]#[^#]+(?:#[^#]+){2,6}|[A-F]{1,6}#[^#]+(?:#[^#]+){2,6})$/,
                        },
                        8: { // scrabled list
                            prompt: c_(`Provide only one ordered list of steps or items, each separated by '#'.`),
                            format: [`${c_('first element')}#${c_('second element')}#${c_('third element')}#${c_('fourth element')}#${c_('fourth element')}...`],
                            explanation: `Ensure the list includes at least five elements.`,
                            examples: [
                                `${c_("Wake up")}#${c_("Have breakfast")}#${c_("Go to work")}`,
                            ],
                            allowRegex: /^[^#]+(?:#[^#]+){2,}$/,

                        },
                        9: { // crosswords
                            prompt: c_(`Generate 10 words followed by their definitions, separated by #. Do not include the # character in either the word or the definition`),
                            format: [`${c_('Word')}#${c_('Definition')}`],
                            explanation: `${c_('Neither the word nor the definition must contain #. The word must have a maximum of 14 letters and must not contain spaces.')}`,
                            examples: [`${c_('Heart')}#${c_('A muscular organ that pumps blood through the body')}`],
                            allowRegex: /^([^#]+)#([^#]+)(#([^#]+))?(#([^#]+))?$/
                        },
                    };

                    const game = gameFormats[gameId];

                    if (!game || !Array.isArray(game.format)) {
                        return { format: [], explanation: "", examples: [], allowRegex: '', prompt: '' };
                    }

                    return {
                        format: game.format,
                        explanation: game.explanation || "",
                        examples: game.examples || [],
                        allowRegex: game.allowRegex || '',
                        prompt: game.prompt || ''
                    };
                },

                addEvents: function (type, saveQuestions) {
                    const $textQuestionsArea = $('#eXeEQuestionsArea');
                    const $textPrompt = $('#eXeEPromptArea');
                    const $textAreaIa = $('#eXeEQuestionsIA');
                    const $divEIA = $('#eXeEIADiv');

                    const $tabQuestions = $('#eXeETabQuestions');
                    const $tabPrompt = $('#eXeETabPrompt');
                    const $tabIA = $('#eXeETabIA');

                    const $copyButton = $('#eXeECopyButton');
                    const $openChatGPTButton = $('#eXeEOpenChatGPTButton');
                    const $saveButton = $('#eXeESaveButton');
                    const $iaButton = $('#eXeEIAButton');
                    const $iaSelect = $('#eXeEIASelect');

                    const $eXeGameAddQuestion = $('#eXeGameAddQuestion');
                    const $eXeEAddArea = $('#eXeEAddArea');

                    // Load user's default AI preference and select it
                    if (window.eXeLearning?.app?.user?.preferences?.preferences?.defaultAI?.value) {
                        const defaultAI = eXeLearning.app.user.preferences.preferences.defaultAI.value;
                        if ($iaSelect.find(`option[value="${defaultAI}"]`).length) {
                            $iaSelect.val(defaultAI);
                        } else {
                            // Fallback to the first option when the saved value is invalid
                            $iaSelect.val($iaSelect.find('option').first().val());
                        }
                    }

                    // Do not persist changes here; preferences are managed in the user preferences UI.
                    $iaSelect.off('change.defaultAI');

                    $saveButton.hide();
                    $textQuestionsArea.hide();

                    $textPrompt.show()
                    $copyButton.show();
                    $openChatGPTButton.show();
                    $iaButton.hide();
                    $iaSelect.show()
                    $divEIA.hide();                   

                    // File input custom UI events
                    $(document).off('click.exeFileTrigger').on('click.exeFileTrigger', '[data-exe-file-trigger]', function () {
                        const $wrap = $(this).closest('[data-exe-upload]');
                        $wrap.find('.exe-file-input').trigger('click');
                    });
                    $(document).off('change.exeFileInput').on('change.exeFileInput', '.exe-file-input', function () {
                        const file = this.files && this.files[0];
                        const $wrap = $(this).closest('[data-exe-upload]');
                        const $name = $wrap.find('[data-exe-file-name]');
                        if (file) {
                            $wrap.attr('data-has-file', 'true');
                            $name.text(file.name);
                        } else {
                            $wrap.removeAttr('data-has-file');
                            $name.text(_("No file selected"));
                        }
                    });

                    $tabQuestions.on('click', function (e) {
                        e.preventDefault();
                        $tabQuestions.addClass('active');
                        $tabPrompt.removeClass('active');
                        $tabIA.removeClass('active');
                        $textQuestionsArea.show();
                        $divEIA.hide();
                        $textPrompt.hide()
                        $saveButton.show();
                        $copyButton.hide();
                        $openChatGPTButton.hide();
                        $iaButton.hide();
                        $iaSelect.hide()
                    });

                    $tabPrompt.on('click', function (e) {
                        e.preventDefault();
                        $tabQuestions.removeClass('active');
                        $tabPrompt.addClass('active');
                        $tabIA.removeClass('active');
                        $textQuestionsArea.hide();
                        $divEIA.hide();
                        $textPrompt.show()
                        $saveButton.hide();
                        $copyButton.show();
                        $openChatGPTButton.show();
                        $iaSelect.show();
                        $iaButton.hide();
                    });

                    $tabIA.on('click', function (e) {
                        e.preventDefault();
                        $tabQuestions.removeClass('active');
                        $tabPrompt.removeClass('active');
                        $tabIA.addClass('active');

                        $textQuestionsArea.hide();
                        $textPrompt.hide();
                        $divEIA.show();

                        $saveButton.hide();
                        $copyButton.hide();
                        $openChatGPTButton.hide();
                        $iaButton.hide();
                        $iaSelect.hide();
                    });

                    $openChatGPTButton.on('click', function () {
                        $tabQuestions.trigger('click');
                        let prompt = $textPrompt.val();
                        if (!prompt || !prompt.trim()) {
                            eXe.app.alert(_('There is no query to send to the assistant.'));
                            return;
                        }
                        const encodedPrompt = encodeURIComponent(prompt.trim());
                        const baseUrl = $iaSelect.val();
                        if (!baseUrl) {
                            eXe.app.alert(_('Please select an AI assistant.'));
                            return;
                        }
                        const url = `${baseUrl}${encodedPrompt}`;
                        window.open(url, '_blank');
                    });

                    $saveButton.on('click', function () {
                        const content = $textQuestionsArea.val().trim();
                        if (!content) {
                            eXe.app.alert(_("Please enter at least one question."));
                            return;
                        }
                        const questions = $exeDevicesEdition.iDevice.gamification.share.validateAndSave(type, $textQuestionsArea);

                        saveQuestions(questions.validLines);
                        if (questions.invalidLines.length > 0) {
                            eXe.app.alert(_('The following lines are invalid:') + '\n\n' + questions.invalidLines.join('\n'));
                        } else {
                            eXe.app.alert(_('The questions have been added successfully'));
                            //$('.exe-form-tabs li:first-child a').trigger("click")
                        }
                    });
                    $iaButton.on('click', function () {
                        const content = $textAreaIa.val().trim();
                        if (!content) {
                            eXe.app.alert(_("Please enter at least one question."));
                            return;
                        }

                        const questions = $exeDevicesEdition.iDevice.gamification.share.validateAndSave(type, $textQuestionsArea);

                        saveQuestions(questions.validLines);
                        if (questions.invalidLines.length > 0) {
                            eXe.app.alert(_('The following lines are invalid:') + '\n\n' + questions.invalidLines.join('\n'));
                        } else {
                            eXe.app.alert(_('The questions have been added successfully'));
                            //$('.exe-form-tabs li:first-child a').click();
                        }
                    });
                    $copyButton.on('click', function () {
                        const content = $textPrompt.val();
                        navigator.clipboard.writeText(content)
                            .then(() => console.log('Content copied to clipboard'))
                            .catch(err => console.error('Error copying content:', err));
                    });
                    $eXeGameAddQuestion.on('click', function () {
                        const currentDisplay = $eXeEAddArea.css('display');
                        if (currentDisplay === 'none') {
                            $eXeEAddArea.css('display', 'block');
                        } else if (currentDisplay === 'none') {
                            $eXeEAddArea.css('display', 'none');
                        }
                    });
                    $textQuestionsArea.on('paste', function (e) {
                        e.preventDefault();
                        const text = (e.originalEvent || e).clipboardData.getData('text/plain');
                        const textarea = this;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
                        textarea.selectionStart = textarea.selectionEnd = start + text.length;
                    });

                    $('#eXeIAButton').on('click', function () {
                        $('#eXeIAMessage').text(_('Generating questions. Please wait...')).show();
                        $exeDevicesEdition.iDevice.gamification.share.genarateIAQuestons(type, saveQuestions);
                    });

                },
                genarateIAQuestons: async function (type, saveQuestions) {
                    $('#eXeFormIAContainer').find('input, textarea, button, select').prop('disabled', true);
                    const $specialty = $('#eXeSpecialtyIA');
                    const $course = $('#eXeCourseIA');
                    const $numQuestions = $('#eXeNumberOfQuestionsIA');
                    const $theme = $('#eXeThemeIA');
                    let promptText = `${_("Act as a highly experienced teacher.")}`;

                    if ($specialty.length) {
                        const sp = $specialty.val().trim();
                        if (sp.length) {
                            promptText += ` ${_('Specialty')}: ${sp}.`;
                        }
                    }
                    if ($course.length) {
                        const cp = $course.val().trim();
                        if (cp.length) {
                            promptText += ` ${_('For students of')} ${cp}.`;
                        }
                    }
                    if ($theme.length) {
                        const tm = $theme.val().trim();
                        if (tm) {
                            promptText += ` ${_('on the following topic')}: ${tm}.`;
                        }
                    }
                    if ($numQuestions.length) {
                        let np = $numQuestions.val();
                        np = np ?? 10;
                        promptText += `${_('Generate')} ${np} ${_('questions')}`;
                    }
                    if ($numQuestions.length) {
                        let np = $numQuestions.val();
                        np = np ?? 10;
                        promptText += `${_('With the following formats:')}`;
                    }

                    const fprompt = $exeDevicesEdition.iDevice.gamification.share.getAllowedFormats(type);
                    let prompt = `
                        ${promptText}
                        ${fprompt.format.join('\n')}
                        ${fprompt.explanation}
                        ${_('Examples')}:
                        ${fprompt.examples.join('\n')}  
                        ${_('You must return only the questions without numbering and without classification or bullet points')},                    
                    `;

                    let sdata = '';
                    prompt = prompt.replace(/[ \t]+/g, ' ').trim();

                    try {
                        const data = await eXeLearning.app.api.getGenerateQuestions(prompt);

                        if (data.questions) {
                            let questions = $exeDevicesEdition.iDevice.gamification.share.checkQuestions(data.questions);
                            if (questions) {
                                const correctsQuestions = $exeDevicesEdition.iDevice.gamification.share.validateQuesionsIA(type, questions);
                                saveQuestions(correctsQuestions);
                            } else {
                                sdata = _('The questions could not be generated');
                                $('#eXeIAMessage').text(_(sdata)).show();
                            }
                        } else {
                            sdata = _('The questions could not be generated. Incorrect format');
                            $('#eXeIAMessage').text(_(sdata)).show();
                        }
                        $('#eXeFormIAContainer').find('input, textarea, button, select').prop('disabled', false);
                    } catch (error) {
                        sdata = _('An error occurred while retrieving the questions. Please try again.');
                        $('#eXeIAMessage').text(_(sdata)).show();
                        $('#eXeFormIAContainer').find('input, textarea, button, select').prop('disabled', false);
                    }
                },

                cleanText: function (input) {
                    const lines = input.split(/\r?\n/);
                    const cleanedLines = lines.map(line => {
                        line = line.trim();
                        line = line.replace(/\s+/g, ' ');
                        return line;
                    });
                    return cleanedLines.join('\n');
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


                validateAndSave: function (gameId, $textQuestionsArea) {
                    const lines = $textQuestionsArea.val().trim().split('\n');
                    const validLines = [];
                    const invalidLines = [];
                    const regex = $exeDevicesEdition.iDevice.gamification.share.getAllowedFormats(gameId).allowRegex;

                    lines.forEach((line) => {
                        const cleanLine = line.trim();

                        if (regex.test(cleanLine)) {
                            validLines.push(cleanLine);
                        } else if (cleanLine.length > 0) {
                            invalidLines.push(cleanLine);
                        }
                    });
                    $textQuestionsArea.val(invalidLines.join('\n'));
                    return {
                        validLines: validLines,
                        invalidLines: invalidLines
                    }
                },

                validateQuesionsIA: function (gameId, lines) {
                    const validLines = [];
                    const invalidLines = [];
                    const regex = $exeDevicesEdition.iDevice.gamification.share.getAllowedFormats(gameId).allowRegex;

                    lines.forEach((line) => {
                        const cleanLine = line.trim();
                        if (regex.test(cleanLine)) {
                            validLines.push(cleanLine);
                        } else if (cleanLine.length > 0) {
                            invalidLines.push(cleanLine);
                        }
                    });

                    return validLines;
                },

                exportGame: function (dataGame, idevice, name) {

                    if (!dataGame) return false;

                    var blob = JSON.stringify(dataGame),
                        newBlob = new Blob([blob], {
                            type: "text/plain"
                        });

                    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
                        window.navigator.msSaveOrOpenBlob(newBlob);
                        return;
                    }

                    const data = window.URL.createObjectURL(newBlob);

                    var link = document.createElement('a');
                    link.href = data;

                    link.download = `${_("Activity")}-${name}.json`;
                    document.getElementById(idevice).appendChild(link);
                    link.click();

                    setTimeout(function () {
                        document.getElementById(idevice).removeChild(link);
                        window.URL.revokeObjectURL(data);
                    }, 100);
                },
                import: {

                    text: function (content, addWords) {
                        const lines = content.split('\n');
                        $exeDevicesEdition.iDevice.gamification.share.import.insertWords(lines, wordsgame);
                    },
                    insertWords: function (lines, addWords) {
                        const lineFormat = /^([^#]+)#([^#]+)(#([^#]+))?(#([^#]+))?$/;
                        let words = [];
                        lines.forEach((line) => {
                            if (lineFormat.test(line)) {
                                const p = $exeDevice.getCuestionDefault();
                                const parts = line.split('#');
                                p.word = parts[0];
                                p.definition = parts[1];
                                if (p.word && p.definition) {
                                    words.push(p);
                                }
                            }

                        });
                        $exeDevicesEdition.iDevice.gamification.share.import.addWords(words, wordsgame)
                    },
                    moodle: function (xmlString, addWords) {
                        const xmlDoc = $.parseXML(xmlString),
                            $xml = $(xmlDoc);
                        if ($xml.find("GLOSSARY").length > 0) {
                            $exeDevicesEdition.iDevice.gamification.share.import.glosary(xmlString, wordsgame);
                        } else if ($xml.find("quiz").length > 0) {
                            $exeDevicesEdition.iDevice.gamification.share.import.cuestionaryxml(xmlString, wordsgame);
                        } else {
                            eXe.app.alert(_('Sorry, wrong file format'));
                        }
                    },
                    cuestionaryxml: function (xmlText, addWords) {
                        const parser = new DOMParser(),
                            xmlDoc = parser.parseFromString(xmlText, "text/xml"),
                            $xml = $(xmlDoc);

                        if ($xml.find("parsererror").length > 0) {
                            return false;
                        }

                        const $quiz = $xml.find("quiz").first();
                        if ($quiz.length === 0) {
                            return false;
                        }

                        const words = [];
                        $quiz.find("question").each(function () {
                            const $question = $(this),
                                type = $question.attr('type');
                            if (type !== 'shortanswer') {
                                return true;
                            }
                            const questionText = $question.find("questiontext").first().text().trim(),
                                $answers = $question.find("answer");
                            let word = '',
                                maxFraction = -1;

                            $answers.each(function () {
                                const $answer = $(this),
                                    answerText = $answer.find('text').eq(0).text(),
                                    currentFraction = parseInt($answer.attr('fraction'), 10);
                                if (currentFraction > maxFraction) {
                                    maxFraction = currentFraction;
                                    word = answerText;
                                }
                            });
                            if (word && questionText) {
                                let wd = {
                                    word: $exeDevice.removeTags(word),
                                    definition: $exeDevice.removeTags(questionText)
                                }
                                words.push(wd);
                            }
                        });
                        addWords(words)
                    },

                    glosary: function (xmlText, addWords) {
                        const parser = new DOMParser(),
                            xmlDoc = parser.parseFromString(xmlText, "text/xml"),
                            $xml = $(xmlDoc);

                        if ($xml.find("parsererror").length > 0) return false;

                        const $entries = $xml.find("ENTRIES").first();
                        if ($entries.length === 0) return false;

                        const words = [];
                        $entries.find("ENTRY").each(function () {
                            const concept = $(this).find("CONCEPT").text(),
                                definition = $(this).find("DEFINITION").text().replace(/<[^>]*>/g, '');
                            if (concept && definition) {
                                let wd = {
                                    word: concept,
                                    definition: definition
                                }
                                words.push(wd);
                            }
                        });
                        addWords(words);
                    },
                },
            },
            helpers: {
                playerAudio: null,
                currentAudioUrl: null,

                /**
                 * Play an audio file, supporting both regular URLs and asset:// URLs
                 * If the same audio is already playing, it will stop it (toggle behavior)
                 * @param {string} audio - URL of the audio file (can be asset:// or regular URL)
                 */
                playSound: async function (audio) {
                    if (!audio || typeof audio !== 'string') {
                        console.error('playSound: Invalid audio URL');
                        return;
                    }

                    // If the same audio is playing, stop it (toggle behavior)
                    if (
                        this.playerAudio &&
                        this.currentAudioUrl === audio &&
                        !this.playerAudio.paused
                    ) {
                        this.stopSound();
                        return;
                    }

                    // Stop any currently playing audio before playing new one
                    this.stopSound();

                    let audioUrl = audio;

                    // Check if it's an asset:// URL and resolve it
                    if (audio.startsWith('asset://')) {
                        // Use the global AssetResolver to convert asset:// to blob://
                        if (
                            window.eXeLearningAssetResolver &&
                            typeof window.eXeLearningAssetResolver.resolve === 'function'
                        ) {
                            try {
                                const resolvedUrl =
                                    await window.eXeLearningAssetResolver.resolve(audio);
                                if (resolvedUrl) {
                                    audioUrl = resolvedUrl;
                                } else {
                                    console.error('playSound: Could not resolve asset URL');
                                    return;
                                }
                            } catch (error) {
                                console.error('playSound: Error resolving asset URL:', error);
                                return;
                            }
                        } else {
                            console.error('playSound: AssetResolver not available');
                            return;
                        }
                    }

                    // Extract URL from Google Drive if applicable
                    if (
                        typeof $exeDevices !== 'undefined' &&
                        $exeDevices.iDevice?.gamification?.media?.extractURLGD
                    ) {
                        audioUrl = $exeDevices.iDevice.gamification.media.extractURLGD(audioUrl);
                    }

                    // Store the original URL for comparison
                    this.currentAudioUrl = audio;

                    // Create and play the audio
                    this.playerAudio = new Audio(audioUrl);
                    this.playerAudio
                        .play()
                        .catch((error) => console.error('playSound: Error playing audio:', error));
                },

                /**
                 * Stop the currently playing audio
                 */
                stopSound: function () {
                    if (this.playerAudio && typeof this.playerAudio.pause === 'function') {
                        this.playerAudio.pause();
                        this.playerAudio = null;
                    }
                    this.currentAudioUrl = null;
                }
            }
        },
        // / Gamification
        filePicker: {
            init: function () {
                var filemanager = window.eXeLearning?.app?.modals?.filemanager;

                // Create buttons for inputs that don't have one
                $(".exe-file-picker,.exe-image-picker").each(function () {
                    var $input = $(this);

                    // Skip if there's already a button after
                    if ($input.next('input[type="button"].exe-pick-image, input[type="button"].exe-pick-any-file').length) {
                        return;
                    }

                    var id = this.id;
                    var isImage = $input.hasClass("exe-image-picker");
                    var css = isImage ? 'exe-pick-image' : 'exe-pick-any-file';

                    var $button = $('<input>', {
                        type: 'button',
                        class: css,
                        value: _("Select a file"),
                        'data-filepicker': id
                    });
                    $input.after($button);
                });

                // EVENT DELEGATION - A single handler for ALL buttons
                $(document).off('click.filepicker').on('click.filepicker', '.exe-pick-image, .exe-pick-any-file', function(e) {
                    e.preventDefault();
                    e.stopImmediatePropagation();

                    if (!filemanager) return;

                    var $button = $(this);
                    var inputId = $button.attr('data-filepicker') || $button.prev('input[type="text"]').attr('id');
                    var $input = inputId ? $('#' + inputId) : $button.prev('input[type="text"]');

                    if (!$input.length) return;

                    var isImage = $input.hasClass("exe-image-picker") || $button.hasClass("exe-pick-image");
                    var accept = null;

                    if (isImage) {
                        accept = 'image';
                    } else if (inputId && inputId.toLowerCase().indexOf('audio') !== -1) {
                        accept = 'audio';
                    } else if (inputId && inputId.toLowerCase().indexOf('video') !== -1) {
                        accept = 'video';
                    }

                    filemanager.show({
                        accept: accept,
                        onSelect: function(result) {
                            $input.val(result.assetUrl);
                            $input.data('blobUrl', result.blobUrl);
                            $input.trigger('change');
                        }
                    });
                });

                // Initialize recorder controls for fields marked with data-voice-recorder.
                $exeDevicesEdition.iDevice.voiceRecorder.initVoiceRecorders(document);
            },
            openFilePicker: function (e) {
                // Legacy fallback - should not be called anymore
                var id = e.id.replace("_browseFor", "");
                var type = 'media';
                if ($(e).hasClass("exe-pick-image")) type = 'image';
                try {
                    exe_tinymce.chooseImage(id, "", type, window);
                } catch (e) {
                    eXe.app.alert(e);
                }
            }
        },
        voiceRecorder: {
            maxDurationMs: 120000,
            startDelayMs: 80,
            styleId: 'exe-voice-recorder-styles',
            instances: [],
            _cleanupBound: false,
            _detachObserver: null,
            isSupported: function () {
                return !!(
                    navigator?.mediaDevices?.getUserMedia &&
                    typeof window.MediaRecorder !== 'undefined'
                );
            },
            bindCleanupHandlers: function () {
                if (this._cleanupBound) return;
                this._cleanupBound = true;

                var self = this;

                window.addEventListener('beforeunload', function () {
                    self.cleanupAll();
                });

                window.addEventListener('pagehide', function () {
                    self.cleanupAll();
                });

                if (typeof MutationObserver !== 'undefined' && document.body) {
                    this._detachObserver = new MutationObserver(function () {
                        self.cleanupDetachedInstances();
                    });
                    this._detachObserver.observe(document.body, {
                        childList: true,
                        subtree: true,
                    });
                }
            },
            registerInstance: function (entry) {
                this.instances.push(entry);
            },
            unregisterInstance: function (entry) {
                this.instances = this.instances.filter(function (current) {
                    return current !== entry;
                });
            },
            cleanupDetachedInstances: function () {
                var self = this;
                this.instances.slice().forEach(function (entry) {
                    var el = entry?.containerEl;
                    if (!el || !document.body.contains(el)) {
                        try {
                            entry.cleanup();
                        } catch (error) {
                            self.unregisterInstance(entry);
                        }
                    }
                });
            },
            cleanupAll: function () {
                this.instances.slice().forEach(function (entry) {
                    try {
                        entry.cleanup();
                    } catch (error) {
                        // Ignore cleanup errors during global shutdown.
                    }
                });
                this.instances = [];
            },
            getStrings: function () {
                return {
                    startRecording: _('Start voice recording'),
                    stopRecording: _('Stop'),
                    saveRecording: _('Save'),
                    discardRecording: _('Delete'),
                    fileName: _('File name'),
                    recordingTime: _('Recording time'),
                    reviewRecording: _('Review recording'),
                    recordingInProgress: _('Recording in progress'),
                    uploading: _('Uploading...'),
                    microphoneError: _('Microphone access was denied or unavailable.'),
                    uploadError: _('Failed to save recording.'),
                };
            },
            initVoiceRecorders: function (rootElement, assetManager) {
                if (!this.isSupported()) return;

                var $root = $(rootElement || document);
                if (!$root.length) return;

                this.ensureStyles();
                this.bindCleanupHandlers();

                var self = this;
                $root.find('[data-voice-recorder]').each(function () {
                    self.initRecorder($(this), assetManager);
                });
            },
            ensureStyles: function () {
                if (document.getElementById(this.styleId)) return;

                var style = document.createElement('style');
                style.id = this.styleId;
                style.textContent = `
                    .exe-voice-recorder-toggle.recording {
                        color: #fff;
                        background-color: #d9534f;
                        border-color: #d9534f;
                        animation: exeVoicePulse 1.2s infinite;
                    }
                    .exe-voice-recorder-toggle {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 2.25rem !important;
                        height: 2.25rem !important;
                        min-width: 2.25rem !important;
                        min-height: 2.25rem !important;
                        padding: 0 !important;
                        aspect-ratio: 1 / 1;
                        flex-shrink: 0;
                        line-height: 1;
                        color: var(--brand-primary, #0BA1A1);
                        border-color: var(--brand-primary, #0BA1A1);
                        background: #fff;
                    }
                    .exe-voice-recorder-toggle:hover,
                    .exe-voice-recorder-toggle:focus,
                    .exe-voice-recorder-toggle:active {
                        color: #087d7d;
                        border-color: #087d7d;
                        background: #e6f6f6;
                    }
                    .exe-voice-recorder-toggle svg {
                        width: 1rem;
                        height: 1rem;
                        fill: currentColor;
                    }
                    @keyframes exeVoicePulse {
                        0% { box-shadow: 0 0 0 0 rgba(217, 83, 79, 0.45); }
                        70% { box-shadow: 0 0 0 8px rgba(217, 83, 79, 0); }
                        100% { box-shadow: 0 0 0 0 rgba(217, 83, 79, 0); }
                    }
                    .exe-voice-recorder-panel {
                        border: 1px solid #ced4da;
                        border-radius: 0.375rem;
                        padding: 0.75rem;
                        margin-top: 0.5rem;
                        background: #fff;
                    }
                    .exe-voice-recorder-status {
                        font-size: 0.875rem;
                        color: #495057;
                    }
                    .exe-voice-recorder-error {
                        color: #b3092f;
                        font-size: 0.875rem;
                        margin-top: 0.5rem;
                    }
                    .exe-voice-recorder-fallback-modal {
                        position: fixed;
                        inset: 0;
                        background: rgba(0, 0, 0, 0.45);
                        z-index: 1070;
                        display: none;
                        align-items: center;
                        justify-content: center;
                        padding: 1rem;
                    }
                    .exe-voice-recorder-fallback-modal.show {
                        display: flex;
                    }
                    .exe-voice-recorder-fallback-dialog {
                        background: #fff;
                        border-radius: 0.5rem;
                        width: 560px !important;
                        max-width: 92vw !important;
                        box-shadow: 0 0.75rem 2rem rgba(0, 0, 0, 0.2);
                    }
                    .exe-voice-recorder-modal-dialog {
                        width: 560px !important;
                        max-width: 92vw !important;
                    }
                    .exe-voice-recorder-modal-dialog .modal-content,
                    .exe-voice-recorder-fallback-dialog {
                        width: 100%;
                    }
                    .exe-voice-recorder-stop,
                    .exe-voice-recorder-save,
                    .exe-voice-recorder-cancel {
                        min-width: 8rem;
                        min-height: 2.5rem;
                        padding: 0.5rem 0.9rem;
                        font-size: 0.95rem;
                        font-weight: 500;
                    }
                `;
                document.head.appendChild(style);
            },
            getPreferredMimeType: function () {
                if (typeof window.MediaRecorder === 'undefined' || typeof window.MediaRecorder.isTypeSupported !== 'function') {
                    return '';
                }
                if (window.MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                    return 'audio/webm;codecs=opus';
                }
                if (window.MediaRecorder.isTypeSupported('audio/mp4')) {
                    return 'audio/mp4';
                }
                if (window.MediaRecorder.isTypeSupported('audio/webm')) {
                    return 'audio/webm';
                }
                return '';
            },
            getExtensionForMimeType: function (mimeType) {
                var normalized = (mimeType || '').toLowerCase();
                if (normalized.indexOf('audio/mp4') === 0) return 'mp4';
                if (normalized.indexOf('audio/webm') === 0) return 'webm';
                return 'webm';
            },
            getDefaultRecordingName: function () {
                var date = new Date();
                var yyyy = String(date.getFullYear());
                var mm = String(date.getMonth() + 1).padStart(2, '0');
                var dd = String(date.getDate()).padStart(2, '0');
                var hh = String(date.getHours()).padStart(2, '0');
                var min = String(date.getMinutes()).padStart(2, '0');
                var ss = String(date.getSeconds()).padStart(2, '0');
                return 'audio-rec-' + yyyy + mm + dd + '-' + hh + min + ss;
            },
            stripAudioExtension: function (name) {
                var value = (name || '').toString().trim();
                return value.replace(/\.(mp3|wav|ogg|m4a|aac|flac|webm|mp4)$/i, '');
            },
            sanitizeFileNameBase: function (name) {
                var value = this.stripAudioExtension(name);
                if (!value) {
                    return this.getDefaultRecordingName();
                }
                value = value
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-zA-Z0-9_-]+/g, '-')
                    .replace(/-+/g, '-')
                    .replace(/^-|-$/g, '');
                return value || this.getDefaultRecordingName();
            },
            formatTime: function (seconds) {
                var mm = String(Math.floor(seconds / 60)).padStart(2, '0');
                var ss = String(seconds % 60).padStart(2, '0');
                return mm + ':' + ss;
            },
            resolveAssetManager: function (assetManager) {
                return (
                    assetManager ||
                    window.eXeLearning?.app?.project?._yjsBridge?.assetManager ||
                    null
                );
            },
            initRecorder: function ($container, assetManager) {
                if ($container.data('voiceRecorderInit')) return;

                var inputSelector = $container.attr('data-voice-input') || '';
                var previewSelector = $container.attr('data-voice-preview') || '';
                var $input = inputSelector
                    ? $(inputSelector).first()
                    : $container.find('input[type="text"]').first();
                if (!$input.length) return;

                var $preview = previewSelector ? $(previewSelector).first() : $();
                var strings = this.getStrings();

                var $anchor = $container
                    .find('.exe-pick-any-file, .exe-pick-image, input[type="button"], button')
                    .not('.exe-voice-recorder-toggle')
                    .first();
                if (!$anchor.length) {
                    $anchor = $input;
                }

                var $toggle = $('<button>', {
                    type: 'button',
                    class: 'btn btn-outline-secondary exe-voice-recorder-toggle',
                    'aria-label': strings.startRecording,
                    title: strings.startRecording,
                    html: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.92V21h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-3.08A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 1 0 10 0z"></path></svg><span class="sr-av">' + strings.startRecording + '</span>',
                });
                var $inlineError = $('<div class="exe-voice-recorder-error d-none" aria-live="polite"></div>');

                var modalId = 'exe-voice-recorder-modal-' + Date.now() + '-' + Math.round(Math.random() * 10000);
                var inputId = 'exe-voice-recorder-name-' + Date.now() + '-' + Math.round(Math.random() * 10000);

                var $modal = $(
                    '<div class="modal fade" id="' + modalId + '" tabindex="-1" aria-hidden="true">' +
                    '<div class="modal-dialog modal-dialog-centered exe-voice-recorder-modal-dialog">' +
                    '<div class="modal-content">' +
                    '<div class="modal-header">' +
                    '<h5 class="modal-title">' + strings.reviewRecording + '</h5>' +
                    '</div>' +
                    '<div class="modal-body">' +
                    '<div class="exe-voice-recorder-recording-view">' +
                    '<div class="exe-voice-recorder-status mb-3"><strong>' + _('Recording') + ':</strong> <span class="exe-voice-recorder-time">00:00</span></div>' +
                    '<div class="d-flex justify-content-end"><button type="button" class="btn btn-primary exe-voice-recorder-stop" aria-label="' + strings.stopRecording + '">' + strings.stopRecording + '</button></div>' +
                    '</div>' +
                    '<div class="exe-voice-recorder-confirmation-view d-none">' +
                    '<audio class="exe-voice-recorder-audio w-100 mb-2" controls></audio>' +
                    '<label class="mb-1" for="' + inputId + '">' + strings.fileName + '</label>' +
                    '<input type="text" class="form-control exe-voice-recorder-name" id="' + inputId + '" />' +
                    '</div>' +
                    '<div class="exe-voice-recorder-error d-none mt-2" aria-live="polite"></div>' +
                    '</div>' +
                    '<div class="modal-footer">' +
                    '<button type="button" class="btn btn-primary exe-voice-recorder-save" aria-label="' + strings.saveRecording + '">' + strings.saveRecording + '</button>' +
                    '<button type="button" class="btn btn-outline-secondary exe-voice-recorder-cancel" aria-label="' + _('Cancel') + '">' + _('Cancel') + '</button>' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '</div>'
                );

                var $fallbackModal = $(
                    '<div class="exe-voice-recorder-fallback-modal" id="' + modalId + '-fallback" aria-hidden="true">' +
                    '<div class="exe-voice-recorder-fallback-dialog">' +
                    '<div class="modal-header">' +
                    '<h5 class="modal-title">' + strings.reviewRecording + '</h5>' +
                    '</div>' +
                    '<div class="modal-body">' +
                    '<div class="exe-voice-recorder-recording-view">' +
                    '<div class="exe-voice-recorder-status mb-3"><strong>' + _('Recording') + ':</strong> <span class="exe-voice-recorder-time">00:00</span></div>' +
                    '<div class="d-flex justify-content-end"><button type="button" class="btn btn-primary exe-voice-recorder-stop" aria-label="' + strings.stopRecording + '">' + strings.stopRecording + '</button></div>' +
                    '</div>' +
                    '<div class="exe-voice-recorder-confirmation-view d-none">' +
                    '<audio class="exe-voice-recorder-audio w-100 mb-2" controls></audio>' +
                    '<label class="mb-1" for="' + inputId + '-fallback">' + strings.fileName + '</label>' +
                    '<input type="text" class="form-control exe-voice-recorder-name" id="' + inputId + '-fallback" />' +
                    '</div>' +
                    '<div class="exe-voice-recorder-error d-none mt-2" aria-live="polite"></div>' +
                    '</div>' +
                    '<div class="modal-footer">' +
                    '<button type="button" class="btn btn-primary exe-voice-recorder-save" aria-label="' + strings.saveRecording + '">' + strings.saveRecording + '</button>' +
                    '<button type="button" class="btn btn-outline-secondary exe-voice-recorder-cancel" aria-label="' + _('Cancel') + '">' + _('Cancel') + '</button>' +
                    '</div>' +
                    '</div>' +
                    '</div>'
                );

                $('body').append($modal);
                $('body').append($fallbackModal);

                $anchor.after($toggle);
                $toggle.after($inlineError);

                var state = {
                    recorder: null,
                    stream: null,
                    chunks: [],
                    blob: null,
                    blobUrl: '',
                    timerId: null,
                    maxTimerId: null,
                    startTimerId: null,
                    seconds: 0,
                    uploaded: false,
                    lastFocused: null,
                    mimeType: this.getPreferredMimeType(),
                    modalOpen: false,
                    recordingStarted: false,
                    suggestedName: '',
                };

                var self = this;
                var modalApi = null;
                if (window.bootstrap && window.bootstrap.Modal) {
                    modalApi = new window.bootstrap.Modal($modal[0], {
                        backdrop: 'static',
                        keyboard: false,
                    });
                }

                function getActiveModal() {
                    return modalApi ? $modal : $fallbackModal;
                }

                function updateModalTime() {
                    getActiveModal().find('.exe-voice-recorder-time').text(self.formatTime(state.seconds));
                }

                function showRecordingView() {
                    var $activeModal = getActiveModal();
                    $activeModal.find('.exe-voice-recorder-recording-view').removeClass('d-none');
                    $activeModal.find('.exe-voice-recorder-confirmation-view').addClass('d-none');
                    $activeModal.find('.exe-voice-recorder-save').addClass('d-none');
                    $activeModal.find('.exe-voice-recorder-cancel').addClass('d-none');
                }

                function showConfirmationView() {
                    var $activeModal = getActiveModal();
                    $activeModal.find('.exe-voice-recorder-recording-view').addClass('d-none');
                    $activeModal.find('.exe-voice-recorder-confirmation-view').removeClass('d-none');
                    $activeModal.find('.exe-voice-recorder-save').removeClass('d-none');
                    $activeModal.find('.exe-voice-recorder-cancel').removeClass('d-none');
                }

                function openModal() {
                    if (modalApi) {
                        modalApi.show();
                    } else {
                        $fallbackModal.addClass('show').attr('aria-hidden', 'false');
                    }
                    state.modalOpen = true;
                }

                function openConfirmationModal() {
                    var $activeModal = getActiveModal();
                    state.suggestedName = self.getDefaultRecordingName();
                    $activeModal.find('.exe-voice-recorder-audio').attr('src', state.blobUrl);
                    $activeModal.find('.exe-voice-recorder-name').val('');
                    $activeModal
                        .find('.exe-voice-recorder-name')
                        .attr('placeholder', state.suggestedName);
                    showConfirmationView();
                    showError('', true);

                    openModal();
                    setTimeout(function () {
                        $activeModal.find('.exe-voice-recorder-name').trigger('focus');
                    }, 0);
                }

                function closeConfirmationModal() {
                    if (modalApi) {
                        modalApi.hide();
                    } else {
                        $fallbackModal.removeClass('show').attr('aria-hidden', 'true');
                    }
                    state.modalOpen = false;
                }

                function stopStream() {
                    if (!state.stream) return;
                    state.stream.getTracks().forEach(function (track) {
                        if (track && typeof track.stop === 'function') track.stop();
                    });
                    state.stream = null;
                }

                function clearTimers() {
                    if (state.timerId) clearInterval(state.timerId);
                    if (state.maxTimerId) clearTimeout(state.maxTimerId);
                    if (state.startTimerId) clearTimeout(state.startTimerId);
                    state.timerId = null;
                    state.maxTimerId = null;
                    state.startTimerId = null;
                }

                function showError(message, forModal) {
                    var $error;
                    if (forModal) {
                        $error = getActiveModal().find('.exe-voice-recorder-error');
                    } else {
                        $error = $inlineError;
                    }
                    if (!message) {
                        $error.addClass('d-none').text('');
                        return;
                    }
                    $error.removeClass('d-none').text(message);
                }

                function setIdleState() {
                    clearTimers();
                    state.recordingStarted = false;
                    state.seconds = 0;
                    updateModalTime();
                    $toggle.removeClass('recording').prop('disabled', false);
                    showError('', false);
                    if (state.lastFocused && typeof state.lastFocused.focus === 'function') {
                        state.lastFocused.focus();
                        state.lastFocused = null;
                    }
                }

                function setRecordingState() {
                    $toggle.addClass('recording').prop('disabled', false);
                    showRecordingView();
                    openModal();
                    updateModalTime();
                    showError('', false);
                }

                function beginRecording() {
                    if (!state.recorder || state.recordingStarted) return;
                    if (!state.modalOpen) return;

                    state.recordingStarted = true;
                    state.seconds = 0;
                    updateModalTime();

                    state.timerId = setInterval(function () {
                        state.seconds += 1;
                        updateModalTime();
                    }, 1000);

                    state.maxTimerId = setTimeout(function () {
                        stopRecording();
                    }, self.maxDurationMs);

                    state.recorder.start(200);
                }

                function scheduleRecordingStart() {
                    if (state.startTimerId) {
                        clearTimeout(state.startTimerId);
                        state.startTimerId = null;
                    }

                    if (modalApi) {
                        $modal.one('shown.bs.modal', function () {
                            beginRecording();
                        });
                    }

                    state.startTimerId = setTimeout(function () {
                        beginRecording();
                    }, self.startDelayMs);
                }

                function setUploadingState(uploading) {
                    var $activeModal = getActiveModal();
                    $activeModal.find('.exe-voice-recorder-save, .exe-voice-recorder-cancel').prop('disabled', uploading);
                    if (uploading) {
                        $activeModal.find('.exe-voice-recorder-save').text(strings.uploading);
                    } else {
                        $activeModal.find('.exe-voice-recorder-save').text(strings.saveRecording);
                    }
                }

                function resetBlob() {
                    if (state.blobUrl) {
                        URL.revokeObjectURL(state.blobUrl);
                    }
                    state.blob = null;
                    state.blobUrl = '';
                    state.uploaded = false;
                    $modal.find('.exe-voice-recorder-audio').attr('src', '');
                    $fallbackModal.find('.exe-voice-recorder-audio').attr('src', '');
                }

                async function startRecording() {
                    try {
                        resetBlob();
                        showError('', false);
                        state.lastFocused = document.activeElement;
                        state.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        state.chunks = [];

                        var options = state.mimeType ? { mimeType: state.mimeType } : undefined;
                        state.recorder = options
                            ? new MediaRecorder(state.stream, options)
                            : new MediaRecorder(state.stream);

                        state.recorder.ondataavailable = function (event) {
                            if (event.data && event.data.size > 0) {
                                state.chunks.push(event.data);
                            }
                        };

                        state.recorder.onstop = function () {
                            clearTimers();
                            stopStream();
                            state.recordingStarted = false;
                            var outputType = state.recorder.mimeType || state.mimeType || 'audio/webm';
                            state.blob = new Blob(state.chunks, { type: outputType });
                            state.blobUrl = URL.createObjectURL(state.blob);
                            openConfirmationModal();
                        };

                        setRecordingState();
                        scheduleRecordingStart();
                    } catch (error) {
                        stopStream();
                        setIdleState();
                        showError(strings.microphoneError, false);
                    }
                }

                function stopRecording() {
                    if (!state.recorder) return;
                    if (state.recorder.state === 'recording') {
                        state.recorder.stop();
                    } else if (!state.recordingStarted && state.modalOpen) {
                        discardRecording(true);
                    }
                }

                function discardRecording(skipStop) {
                    if (!skipStop) {
                        stopRecording();
                    }
                    stopStream();
                    clearTimers();
                    closeConfirmationModal();
                    resetBlob();
                    setIdleState();
                }

                async function saveRecording() {
                    if (!state.blob) return;
                    var manager = self.resolveAssetManager(assetManager);
                    if (!manager || typeof manager.insertImage !== 'function') {
                        showError(strings.uploadError, true);
                        return;
                    }

                    try {
                        setUploadingState(true);
                        showError('', true);
                        var mimeType = state.blob.type || state.mimeType || 'audio/webm';
                        var extension = self.getExtensionForMimeType(mimeType);
                        var userName = getActiveModal().find('.exe-voice-recorder-name').val();
                        var baseCandidate = userName;
                        if (!baseCandidate || !baseCandidate.toString().trim()) {
                            baseCandidate = state.suggestedName;
                        }
                        var fileNameBase = self.sanitizeFileNameBase(baseCandidate);
                        var file = new File(
                            [state.blob],
                            fileNameBase + '.' + extension,
                            { type: mimeType }
                        );

                        var assetUrl = await manager.insertImage(file);
                        $input.val(assetUrl).trigger('change');

                        if ($preview.length && $preview.is('audio')) {
                            $preview.attr('src', state.blobUrl).removeClass('d-none').show();
                        }

                        state.uploaded = true;
                        discardRecording(true);
                    } catch (error) {
                        showError(strings.uploadError, true);
                    } finally {
                        setUploadingState(false);
                    }
                }

                var registryEntry = {
                    containerEl: $container.get(0),
                    cleanup: function () {
                        if ($container.data('voiceRecorderDestroyed')) return;
                        $container.data('voiceRecorderDestroyed', true);

                        try {
                            if (state.recorder && state.recorder.state === 'recording') {
                                state.recorder.stop();
                            }
                        } catch (error) {
                            // Ignore recorder stop errors during forced cleanup.
                        }

                        stopStream();
                        clearTimers();

                        if (state.blobUrl) {
                            try {
                                URL.revokeObjectURL(state.blobUrl);
                            } catch (error) {
                                // Ignore revoke errors.
                            }
                        }
                        state.blob = null;
                        state.blobUrl = '';

                        closeConfirmationModal();

                        $toggle.off();
                        $inlineError.remove();

                        if (modalApi) {
                            try {
                                modalApi.dispose();
                            } catch (error) {
                                // Ignore dispose errors.
                            }
                        }
                        $modal.remove();
                        $fallbackModal.remove();

                        self.unregisterInstance(registryEntry);
                    },
                };

                this.registerInstance(registryEntry);

                $toggle.on('click', function (event) {
                    event.preventDefault();
                    if (state.modalOpen) return;
                    if ($toggle.hasClass('recording')) {
                        stopRecording();
                    } else {
                        startRecording();
                    }
                });

                $modal.find('.exe-voice-recorder-stop').on('click', function (event) {
                    event.preventDefault();
                    stopRecording();
                });

                $fallbackModal.find('.exe-voice-recorder-stop').on('click', function (event) {
                    event.preventDefault();
                    stopRecording();
                });

                $modal.find('.exe-voice-recorder-cancel').on('click', function (event) {
                    event.preventDefault();
                    discardRecording(true);
                });

                $fallbackModal.find('.exe-voice-recorder-cancel').on('click', function (event) {
                    event.preventDefault();
                    discardRecording(true);
                });

                $modal.find('.exe-voice-recorder-save').on('click', function (event) {
                    event.preventDefault();
                    saveRecording();
                });

                $fallbackModal.find('.exe-voice-recorder-save').on('click', function (event) {
                    event.preventDefault();
                    saveRecording();
                });

                $container.data('voiceRecorderInit', true);
                $container.data('voiceRecorderCleanup', function () {
                    registryEntry.cleanup();
                });
            },
        },
        // Save the iDevice
        save: function () {
            // Check if the object and the required methods are defined
            if (typeof ($exeDevice) != 'undefined' && typeof ($exeDevice.init) != 'undefined' && typeof ($exeDevice.save) == 'function') {
                // Trigger the click event so the form is submitted
                var html = $exeDevice.save();
                if (html) {
                    $("textarea.mceEditor, #node-content .idevice_node[mode=edition]").val(html);
                }
            }
        },
        // iDevice tabs
        tabs: {
            init: function (id) {
                var tabs = $("#" + id + " .exe-form-tab");
                var list = '';
                var tabId;
                var e;
                var txt;
                tabs.each(function (i) {
                    var klass = "exe-form-active-tab";
                    tabId = id + "Tab" + i;
                    e = $(this);
                    e.attr("id", tabId);
                    txt = e.attr("title");
                    e.attr("title", "");
                    if (txt == '') txt = (i + 1);
                    if (i > 0) {
                        e.hide();
                        klass = "";
                    }
                    list += '<li><a href="#' + tabId + '" class="' + klass + '">' + txt + '</a></li>';
                });
                if (list != "") {
                    list = '<ul id="' + id + 'Tabs" class="exe-form-tabs exe-advanced">' + list + '</ul>';
                    tabs.eq(0).before(list);
                    var as = $("#" + id + "Tabs a");
                    as.click(function () {
                        as.attr("class", "");
                        $(this).addClass("exe-form-active-tab");
                        tabs.hide();
                        $($(this).attr("href")).show();
                        return false;
                    });
                }
            },
            restart: function () {
                $("#activeIdevice .exe-form-tabs a").eq(0).trigger("click");
            }
        }
    }
}

// Export for Node.js/CommonJS (tests)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = $exeDevicesEdition;
}
