/**
 * Interactive Video iDevice (edition code)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Ignacio Gros (http://gros.es/) for http://exelearning.net/
 *
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */

// To review:
// Do not allow Flash?
var InteractiveVideo = {};

var stringToHTML = function (str) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(str, 'text/html');
    return doc.body;
}
var $exeDevice = {

    // We use eXe's _ function
    i18n: {
        name: _('Interactive video')
    },

    init: function (element, previousData, path) {
        //** eXeLearning idevice engine data ***************************
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        //**************************************************************
        this.createForm();
    },

    ci18n: {
        "start": c_("Start"),
        "results": c_("Results"),
        "slide": c_("Slide (frame)"),
        "score": c_("Score"),
        "seen": c_("Seen"),
        "total": c_("Total"),
        "seeAll": c_("see all the slides and answer all the questions"),
        "noSlides": c_("This video has no interactive elements."),
        "goOn": c_("Continue"),
        "error": c_("Error"),
        "dataError": c_("Incompatible code"),
        "onlyOne": c_("Only one interactive video per page."),
        "cover": c_("Cover"),
        "fsWarning": c_("Exit the fullscreen mode (Esc) to see the current slide"),
        "right": c_("Right!"),
        "wrong": c_("Wrong"),
        "sortableListInstructions": c_("Drag and drop or use the arrows."),
        "up": c_("Move up"),
        "down": c_("Move down"),
        "rightAnswer": c_("Right answer:"),
        "notAnswered": c_("Please finish the activity"),
        "check": c_("Check"),
        "newWindow": c_("New Window"),
        "msgOnlySaveAuto": c_("Your score will be saved after each question. You can only play once."),
        "msgSaveAuto": c_("Your score will be automatically saved after each question."),
        "msgYouScore": c_("Your score"),
        "msgScoreScorm": c_("The score can't be saved because this page is not part of a SCORM package."),
        "msgYouLastScore": c_("The last score saved is"),
        "msgActityComply": c_("You have already done this activity."),
        "msgPlaySeveralTimes": c_("You can do this activity as many times as you want"),
        "msgScoreScorm": c_("The score can't be saved because this page is not part of a SCORM package."),
        "msgEndGameScore": c_("Please start the game before saving your score."),
        "msgSeveralScore": c_("You can save the score as many times as you want"),
        "msgOnlySaveScore": c_("You can only save the score once!"),
        "msgOnlySave": c_("You can only save once"),
        "msgOnlySaveAuto": c_("Your score will be saved after each question. You can only play once."),
        "msgUncompletedActivity": c_("Incomplete activity"),
        "msgSuccessfulActivity": c_("Activity: Passed. Score: %s"),
        "msgUnsuccessfulActivity": c_("Activity: Not passed. Score: %s"),
        "msgTypeGame": c_('Interactive video')
    },
    scorm: {
        'isScorm': 0,
        'textButtonScorm': c_('Save score'),
        'repeatActivity': false
    },
    scoreNIA: true,
    evaluation: false,
    evaluationID: '',
    ideviceID: false,

    testIfVideoExists: function (url, type) {
        if (!top.interactiveVideoEditor) {
            eXe.app.alert(_("Could not retrieve data (Core error)") + " - 001");
        } else {
            top.interactiveVideoEditor.videoURL = url;
            top.interactiveVideoEditor.videoType = type;
            top.interactiveVideoEditor.imageList = [];
        }
    },
    // Create the form to insert HTML in the TEXTAREA
    createForm: function () {
        var html = '';
        var field = $("textarea.jsContentEditor").eq(0);
        // Only one Interactive Video iDevice per page
        if ($(".iDevice_wrapper.interactive-videoIdevice").length > 0) {
            html = '<p>' + _('You can only add one Interactive Video iDevice per page.') + '</p>';
            field.before(html);
            return;
        }
        html = `
			<div id="interactiveVideoIdeviceForm">
				<div class="exe-form-tab" title="${_('General settings')}">
					${$exeDevices.iDevice.common.getTextFieldset("before")}
					<p>
						<strong>${_('Type')}:</strong>
						<label for="interactiveVideoType-local">
							<input type="radio" name="interactiveVideoType" id="interactiveVideoType-local" value="local" checked="checked" /> 
							${_('Local file')}
						</label>
						<label for="interactiveVideoType-youtube">
							<input type="radio" name="interactiveVideoType" id="interactiveVideoType-youtube" value="youtube" /> 
							YouTube
						</label>
						<label for="interactiveVideoType-mediateca">
							<input type="radio" name="interactiveVideoType" id="interactiveVideoType-mediateca" value="mediateca" /> 
							${_('Mediateca')}
						</label>
					</p>
					<p id="interactiveVideo-local" class="interactiveVideoType flexDisplay">
                        <label for="interactiveVideoFile">${_("File")}:</label>
						<input type="text" id="interactiveVideoFile" class="exe-file-picker" />						
					</p>
                    <p>
                        <span class="info"><strong>${_("Supported formats")}:</strong> OGV/OGG, webm, mp4, flv</span>
                    </p>
					<p id="interactiveVideo-youtube" class="interactiveVideoType">
						<label for="interactiveVideoYoutubeURL">${_("URL")}:</label>
						<input type="text" id="interactiveVideoYoutubeURL" />
						<span class="info">
							<strong>${_("Example")}:</strong> 
							<a href="https://www.youtube.com/watch?v=v_rGjOBtvhI" target="_blank">https://www.youtube.com/watch?v=v_rGjOBtvhI</a>
						</span>
					</p>
					<p id="interactiveVideo-mediateca" class="interactiveVideoType">
						<label for="interactiveVideoMediatecaURL">${_("URL")}:</label>
						<input type="text" id="interactiveVideoMediatecaURL" />
						<span class="info">
							<strong>${_("Example")}:</strong> 
							<a href="https://mediateca.educa.madrid.org/video/3vmgyeluy8c35xzj" target="_blank">https://mediateca.educa.madrid.org/video/3vmgyeluy8c35xzj</a>
						</span>
					</p>
					<p>
						<label for="interactiveVideoShowResults">
							<input type="checkbox" name="interactiveVideoShowResults" id="interactiveVideoShowResults" checked="checked" /> 
							${_("Show results")}
						</label>
					</p>
					<p>
						<label for="interactiveVideoScoreNIA">
							<input type="checkbox" name="interactiveVideoScoreNIA" id="interactiveVideoScoreNIA" /> 
							${_("Score non-interactive activities")}
						</label>
					</p>
					<p>
						<label for="interactiveVideoEvaluation">
							<input type="checkbox" id="interactiveVideoEvaluation"> 
							${_("Progress report")}.
						</label>
						<label for="interactiveVideoEvaluationID">
							${_("Identifier")}: 
							<input type="text" id="interactiveVideoEvaluationID" disabled /> 
						</label>
					</p>
					<p class="exe-block-success flexDisplay">
						${_("Open the editor and start adding interaction...")} 
						<input type="button" id="interactiveVideoOpenEditor" onclick="$exeDevice.editor.start()" value="${_("Editor")}" />
					</p>
					${$exeDevices.iDevice.common.getTextFieldset("after")}
				</div>
				${$exeDevices.iDevice.gamification.common.getLanguageTab(this.ci18n)}
				${$exeDevices.iDevice.gamification.scorm.getTab()}
			</div>
		`;

        this.ideviceBody.innerHTML = html;

        $exeDevices.iDevice.tabs.init("interactiveVideoIdeviceForm");
        $exeDevices.iDevice.gamification.scorm.init();

        $("input[name=interactiveVideoType]").change(function () {
            $exeDevice.toggleType(this.value);
        });

        $('#interactiveVideoEvaluation').on('change', function () {
            var marcado = $(this).is(':checked');
            $('#interactiveVideoEvaluationID').prop('disabled', !marcado);
        });

        $("#interactiveVideoFile").change(function () {
            var e = $("#interactiveVideoEditorOpener");
            if (this.value.indexOf("files/tmp/") == 0) {
                $exeDevice.testIfVideoExists(this.value, "local");
                // $exeDevice.interactiveVideoEditorOpenerHTML = e.html();
                // var saveNowMsg = '<p class="exe-block-info">' + _("Please save your iDevice now (click on %s now) and edit it to add interaction.") + '</p>';
                // saveNowMsg = saveNowMsg.replace('%s', '<img style="vertical-align:top" src="' + $exeDevice.idevicePath + 'images/stock-apply.png" alt="' + _("Done") + '" />');
                // var extension = this.value.split('.').pop().toLowerCase();
                // if (extension == "flv") {
                //   eXe.app.alert(_("Format") + ": flv - " + _("Recommended type") + ": ogv/ogg, webm, mp4");
                // }
                // e.html(saveNowMsg).fadeIn();
                e.fadeIn();
            }
            else {
                e.hide();
            }
        }).keyup(function () {
            var e = $("#interactiveVideoEditorOpener");
            if (this.value.indexOf("files/tmp/") == 0) {
                $exeDevice.testIfVideoExists(this.value, "local");
                e.fadeIn();
            } else {
                e.hide();
            }
        });
        $("#interactiveVideoYoutubeURL").change(function () {
            // Allow youtu.be:
            this.value = this.value.replace("https://youtu.be/", "https://www.youtube.com/watch?v=");
            var e = $("#interactiveVideoEditorOpener");
            if (this.value.indexOf("https://www.youtube.com/watch?v=") == 0) {
                $exeDevice.testIfVideoExists(this.value, "youtube");
                e.fadeIn();
            } else {
                e.hide();
            }
        }).keyup(function () {
            // Allow youtu.be:
            this.value = this.value.replace("https://youtu.be/", "https://www.youtube.com/watch?v=");
            var e = $("#interactiveVideoEditorOpener");
            if (this.value.indexOf("https://www.youtube.com/watch?v=") == 0) {
                $exeDevice.testIfVideoExists(this.value, "youtube");
                e.fadeIn();
            } else {
                e.hide();
            }
        });
        $("#interactiveVideoMediatecaURL").change(function () {
            var e = $("#interactiveVideoEditorOpener");
            if (this.value.indexOf("https://mediateca.educa.madrid.org/video/") == 0) {
                $exeDevice.testIfVideoExists(this.value, "mediateca");
                e.fadeIn();
            } else {
                e.hide();
            }
        }).keyup(function () {
            var e = $("#interactiveVideoEditorOpener");
            if (this.value.indexOf("https://mediateca.educa.madrid.org/video/") == 0) {
                $exeDevice.testIfVideoExists(this.value, "mediateca");
                e.fadeIn();
            } else {
                e.hide();
            }
        });
        // Create the object to contain all data
        top.interactiveVideoEditor = {
            ask: true,
            activityToSave: {
                slides: []
            },
            videoURL: "",
            videoType: "",
            i18n: {}
        };
        this.loadPreviousValues();
        // To do now this.addExtjsScript();
    },

    // Load the saved values in the form fields
    loadPreviousValues: function () {
        var originalHTML = this.idevicePreviousData;
        if (originalHTML != '') {
            var wrapper = $("<div id='interactiveVideoTmpWrapper'></div>");
            wrapper.html(originalHTML);
            // Check the CSS class (Show/Hide results)
            if ($("div", wrapper).eq(0).hasClass("exe-interactive-video-no-results")) {
                $("#interactiveVideoShowResults").prop("checked", false);
            }
            // Get the file
            var videoWrapper = $("#exe-interactive-video-file a", wrapper);
            var type = "local";
            if (videoWrapper.length == 1) {
                var videoURL = videoWrapper.attr("href");
                var n = "File";
                var disabled = "disabled";
                if (videoURL.indexOf("https://mediateca.educa.madrid.org/") == 0) {
                    n = "MediatecaURL";
                    disabled = false;
                    type = "mediateca";
                } else if (videoURL.indexOf("www.youtube.com") > -1) {
                    n = "YoutubeURL";
                    disabled = false;
                    type = "youtube";
                }
                $("#interactiveVideoType-" + type).prop("checked", "checked").trigger("change");
                $("#interactiveVideo" + n).val(videoURL).prop("disabled", disabled);
                $("#interactiveVideoEditorOpener").fadeIn();
                // Get the video URL and type
                top.interactiveVideoEditor.videoURL = videoURL;
                top.interactiveVideoEditor.videoType = type;
                // Text before
                var textBefore = $(".exe-interactive-video-content-before", wrapper);
                if (textBefore.length == 1) {
                    textBefore = textBefore.html();
                    $("#eXeIdeviceTextBefore").val(textBefore);
                }
                // Text after
                var textAfter = $(".exe-interactive-video-content-after", wrapper);
                if (textAfter.length == 1) {
                    textAfter = textAfter.html();
                    $("#eXeIdeviceTextAfter").val(textAfter);
                }
            }
            $('body').append(wrapper);

            // Get the data
            let previousData = stringToHTML(originalHTML);
            var jsonParse = previousData.querySelector("#exe-interactive-video-contents").innerHTML;
            var regexp = new RegExp('(style=".+?)">', 'g');
            var results = jsonParse.match(regexp);
            if (results) {
                results.forEach(function (match) {
                    results = match;
                    var matchReplace = results.replace(/"/g, "");
                    jsonParse = jsonParse.replace(results, matchReplace);
                })
                jsonParse = jsonParse.replace(/\\=/g, '\'');
                jsonParse = jsonParse.replace(/\\&quot;/g, '\'');
            }
            InteractiveVideo = JSON.parse(jsonParse);
            if (typeof (InteractiveVideo) == 'object' && typeof (InteractiveVideo.slides) == 'object') {
                top.interactiveVideoEditor.activityToSave = InteractiveVideo;
                // i18n
                InteractiveVideo.scorm =  InteractiveVideo.scorm ?? $exeDevice.scorm;
                $exeDevices.iDevice.gamification.common.setLanguageTabValues(InteractiveVideo.i18n);
                $exeDevices.iDevice.gamification.scorm.setValues(InteractiveVideo.scorm.isScorm, InteractiveVideo.scorm.textButtonScorm, InteractiveVideo.scorm.repeatActivity);
                InteractiveVideo.scoreNIA = typeof InteractiveVideo.scoreNIA == "undefined" ? true : InteractiveVideo.scoreNIA;
                InteractiveVideo.evaluation = typeof InteractiveVideo.evaluation == "undefined" ? false : InteractiveVideo.evaluation;
                InteractiveVideo.evaluationID = typeof InteractiveVideo.evaluationID == "undefined" ? '' : InteractiveVideo.evaluationID;
                InteractiveVideo.ideviceID = typeof InteractiveVideo.ideviceID != "undefined" ? InteractiveVideo.ideviceID : false;
                $exeDevice.ideviceID = $exeDevice.getIdeviceID();
                $("#interactiveVideoEvaluation").prop("checked", InteractiveVideo.evaluation);
                $("#interactiveVideoEvaluationID").val(InteractiveVideo.evaluationID);
                $("#interactiveVideoEvaluationID").prop('disabled', !InteractiveVideo.evaluation);
            }
            // Save the list of images and remove the wrapper
            top.interactiveVideoEditor.imageList = $(".exe-interactive-video-img img", wrapper);
            top.interactiveVideoEditor.activityToSave.poster = $(".exe-interactive-video-poster img", wrapper).attr("src");
            $('#interactiveVideoTmpWrapper').remove();
        }

    },

    toggleType: function (v) {

        var btn = $("#interactiveVideoEditorOpener");
        // To review: btn.hide();
        $(".interactiveVideoType").hide();
        $("#interactiveVideo-" + v).fadeIn();
        // Hide the "Please save your iDevice now and edit it to add interaction." message.
        if (typeof ($exeDevice.interactiveVideoEditorOpenerHTML) != 'undefined') {
            btn.html($exeDevice.interactiveVideoEditorOpenerHTML);
        }
        // $("#interactiveVideoFile,#interactiveVideoYoutubeURL,#interactiveVideoMediatecaURL").val("");
        // if (top.interactiveVideoEditor.videoType)
        // Change the video type
        top.interactiveVideoEditor.videoType = v;
        if ($exeDevice.interactiveVideoEditorOpenerHTML) {
            // Keep displaying the "Save now" text if needed
            if (v == "local") $("#interactiveVideoFile").trigger("change");
            else $("#interactiveVideoEditorOpener").html($exeDevice.interactiveVideoEditorOpenerHTML);
        }

    },

    editor: {
        start: function () {
            var f1 = $("#interactiveVideoFile").val();
            var f2 = $("#interactiveVideoYoutubeURL").val();
            var f3 = $("#interactiveVideoMediatecaURL").val();
            if (f1=='' && f2=='' && f3=='') {
                eXe.app.alert(_("Please select a file or provide a valid video URL."));
                return false;
            }
            //var myCSS=document.querySelector("link[href*='6.0.1']")
            var win = null;
            // Get file path
            var filePath = $exeDevice.idevicePath.replace(eXeLearning.symfony.baseURL + eXeLearning.symfony.basePath + "/files/", "");

            $("#modalGenericIframeContainer,#modalGenericIframeContainerCSS").remove();
            const editorURL = eXeLearning.symfony.baseURL + eXeLearning.symfony.basePath + "/api/idevice-management/idevices/download/file/resources?resource=" + filePath + "editor/index.html";
            var css = `
    	<style id="modalGenericIframeContainerCSS">
          .modal-fullscreen .modal-header,
          .modal-fullscreen .modal-content{border-radius:0}
          .modal-fullscreen .modal-content{width:100vw}
          .modal-fullscreen .modal-content{width:100vw}
          #modalGenericIframeContainer .modal-header,
          #modalGenericIframeContainer .modal-footer{display:none}  
          #modalGenericIframeContainer .modal-body{padding:0}    		
          #modalGenericIframeContainer iframe{width:100vw;height:100vh}
    	</style>
    	`;
            $("head").append(css);
            var html = `
    	<div class="modal" id="modalGenericIframeContainer">
    	  <div class="modal-dialog modal-fullscreen">
    		<div class="modal-content">
    		  <div class="modal-header">
    			<h4 class="modal-title">Modal Heading</h4>
    			<button type="button" class="btn-close" data-bs-dismiss="modal"></button>
    		  </div>
    		  <div class="modal-body">
    			<iframe src="${editorURL}" width="420" height="315" frameborder="0" scrolling="no" style="border:0;overflow:hidden" allowfullscreen></iframe>
    		  </div>
    		  <div class="modal-footer">
    			<button type="button" class="btn btn-danger" data-bs-dismiss="modal">Close</button>
    		  </div>
    		</div>
    	  </div>
    	</div>	
    	`;
            $("body").append(html);
            win = new bootstrap.Modal(document.getElementById('modalGenericIframeContainer'));
            win.show();
            // Save the status (with or without changes)
            top.interactiveVideoEditor.hasChanged = false;
        },
        close: function () {
            $(document.getElementById('modalGenericIframeContainer')).modal("hide");
        }
    },

    getIdeviceID: function () {
        const ideviceid = $('#interactiveVideoIdeviceForm').closest(`div.idevice_node.interactive-video`).attr('id') || '';

        return ideviceid;
    },

    save: function () {

        var myVideo = "";

        var type = $('input[name=interactiveVideoType]:checked').val();

        if (type == 'local') {

            myVideo = $("#interactiveVideoFile").val();
            if (myVideo == "") {
                eXe.app.alert(_("Required") + ": " + _("File"));
                return false;
            }
            var extension = myVideo.split('.').pop().toLowerCase();
            if (extension != "ogg" && extension != "ogv" && extension != "mp4" && extension != "webm" && extension != "flv") {
                eXe.app.alert(_("Supported formats") + ": ogv/ogg, webm, mp4, flv");
                return false;
            }

        }

        else if (type == 'youtube') {

            myVideo = $("#interactiveVideoYoutubeURL").val();
            if (myVideo.indexOf("https://www.youtube.com/watch?v=") != 0) {
                eXe.app.alert(_("Wrong URL. Expected format:") + " https://www.youtube.com/watch?v=v_rGjOBtvhI");
                return false;
            }

        }

        else if (type == 'mediateca') {

            myVideo = $("#interactiveVideoMediatecaURL").val();
            if (myVideo.indexOf("https://mediateca.educa.madrid.org/video/") != 0) {
                eXe.app.alert(_("Wrong URL. Expected format:") + " https://mediateca.educa.madrid.org/video/3vmgyeluy8c35xzj");
                return false;
            }

        }

        var seval = $('#interactiveVideoEvaluation').is(':checked'),
            sevalid = seval ? $('#interactiveVideoEvaluationID').val() : '';
        if (seval && sevalid.length < 5) {
            eXe.app.alert(_('The report identifier must have at least 5 characters'));
            return false;
        }

        var ideviceID = $exeDevice.getIdeviceID();

        var contents = '{}';
        if (typeof (top.interactiveVideoEditor) != 'undefined') {

            var imgsHTML = "";
            var activity = top.interactiveVideoEditor.activityToSave;

            // Check for images:
            if (activity.coverType && activity.coverType == "poster") {
                imgsHTML += '<p class="exe-interactive-video-poster sr-av"><img src="' + activity.poster + '" alt="' + activity.posterDescription + '" /></p>';
            }
            var slides = activity.slides;

            if (slides) {
                for (var i = 0; i < slides.length; i++) {
                    var slide = slides[i];
                    if (slide.type == "image") {
                        if (typeof (slide.url) == "string") {
                            var check = slide.url.split("/resources/");
                            // Updated image: The URL is something like http://localhost:51235/videos-interactivos-001/resources/my_file.jpg
                            // So you have to remove anything before "resources/"
                            if (check.length == 2) {
                                slide.url = "resources/" + check[1];
                            }
                        } else {
                            // It's a number, so the image must be in the original HTML code
                            // slide.url = imgs.eq(i).attr("src");
                            var imgs = top.interactiveVideoEditor.imageList;
                            for (var z = 0; z < imgs.length; z++) {
                                var img = $(imgs[z]);
                                if (img.attr("id") == "exe-interactive-video-img-" + i) {
                                    slide.url = img.attr("src");
                                }
                            }
                        }
                        imgsHTML += '<p class="exe-interactive-video-img sr-av"><img src="' + slide.url + '" id="exe-interactive-video-img-' + i + '" alt="" /></p>';
                        slide.url = i;
                    }
                }
            }

            var fields = this.ci18n;
            // Default value
            var i18n = fields;
            // Overwrite custom values
            for (var i in fields) {
                var fVal = $("#ci18n_" + i).val();
                if (fVal != "") i18n[i] = fVal;
                else i18n[i] = fields[1];
            }

            top.interactiveVideoEditor.activityToSave.i18n = i18n;
            top.interactiveVideoEditor.activityToSave.scorm = $exeDevices.iDevice.gamification.scorm.getValues();;
            top.interactiveVideoEditor.activityToSave.scoreNIA = $("#interactiveVideoScoreNIA").is(":checked");
            top.interactiveVideoEditor.activityToSave.evaluation = seval;
            top.interactiveVideoEditor.activityToSave.evaluationID = sevalid;
            top.interactiveVideoEditor.activityToSave.ideviceID = ideviceID;

            contents = JSON.stringify(top.interactiveVideoEditor.activityToSave);

        }

        var extraCSS = "";
        if ($("#interactiveVideoShowResults").is(":checked") == false) extraCSS = " exe-interactive-video-no-results";

        // Content before
        var contentBefore = "";
        var contentBefore = tinymce.editors[0].getContent();
        if (contentBefore != "") {
            contentBefore = '<div class="exe-interactive-video-content-before">' + contentBefore + '</div>';
        }

        // Content after
        var contentAfter = "";
        var contentAfter = tinymce.editors[1].getContent();
        if (contentAfter != "") {
            contentAfter = '<div class="exe-interactive-video-content-after">' + contentAfter + '</div>';
        }

        var html = contentBefore;
        html += `<div class="game-evaluation-ids js-hidden" data-id="${ideviceID}" data-evaluationid="${sevalid}"></div>`;

        html += '\
			<div class="exe-interactive-video'+ extraCSS + '">\
				<p id="exe-interactive-video-file" class="js-hidden">\
					<a href="'+ myVideo + '">' + myVideo.split('.').pop() + '</a>\
				</p>\
				<div id="exe-interactive-video-contents" style="display: none">\
					\n' + contents + '\
				</div>\
			</div>';

        html += contentAfter;

        // Return the HTML to save
        if (type == "local") {
            html += '<p class="sr-av"><video width="320" height="240" controls="controls" class="mediaelement"><source src="' + myVideo + '" /></video></p>';
        }

        // Add the images at the end of the code
        html += imgsHTML;

        return html;
    }
}