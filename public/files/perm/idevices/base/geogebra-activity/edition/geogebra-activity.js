/* eslint-disable no-undef */
/**
 * GeoGebra activity iDevice (edition code)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Authors: Ignacio Gros (http://gros.es/), Javier Cayetano Rodríguez and Manuel Narváez Martínez for http://exelearning.net/
 *
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */

var $exeDevice = {
    // We use eXe's _ function
    i18n: {
        name: _('GeoGebra activity'),
    },
    activityURLbase: 'https://www.geogebra.org/m/',

    idevicePath: '',
    ideviceID: '',
    classIdevice: 'geogebra-activity',
    // True/false options
    trueFalseOptions: {
        showMenuBar: [_('Show menu bar'), false],
        showAlgebraInput: [_('Algebra input field'), false],
        showToolBar: [_('Toolbar'), false],
        showToolBarHelp: [_('Toolbar help'), false],
        showResetIcon: [_('Reset icon'), false],
        enableShiftDragZoom: [_('Zoom'), false],
        enableRightClick: [_('Enable right click'), false],
        errorDialogsActive: [_('Error dialogs'), false],
        preventFocus: [_('Prevent focus'), false],
        showFullscreenButton: [_('Fullscreen button'), true],
        disableAutoScale: [_('Disable auto-scale'), false],
        showSuggestionButtons: [_('Suggestion buttons'), true],
        playButton: [_('Play button'), false],
        ShowAuthor: [_('Authorship'), true],
    },

    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.createForm();
    },

    // Create the form to insert HTML in the TEXTAREA
    createForm: function () {
        const str1 = _('Save score');
        const instructions = _(
            'Insert a GeoGebra activity from www.geogebra.org. It requires an Internet connection.',
        ).replace(
            ' www.geogebra.org',
            ' <a href="https://www.geogebra.org/" target="_blank" rel="noopener noreferrer">www.geogebra.org</a>',
        );

        const html = `
			<div id="eXeAutoGeogebraForm">
				<p class="exe-idevice-description exe-block-info exe-block-dismissible"  style="position:relative">
                    ${instructions}
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
				<fieldset class="exe-fieldset">
					<legend><a href="#">${_('Instructions')}</a></legend>
					<div class="exe-textarea-field">
						<label for="geogebraActivityInstructions" class="sr-av">${_('Instructions')}: </label>
						<textarea id="geogebraActivityInstructions" class="exe-html-editor"></textarea>
					</div>
				</fieldset>
				<fieldset class="exe-fieldset">
					<legend><a href="#">${_('General Settings')}</a></legend>
					<div>
						<p id="geogebraActivityURLS">
							<label for="geogebraActivityURL">${_('URL or identifier (ID)')}: </label>
							<input type="text" name="geogebraActivityURL" id="geogebraActivityURL" />
							<a href="#" id="geogebraActivityPlayButton" title="${_('Load data')}">
								<span class="sr-av">${_('Load data')}</span>
							</a>
							<label for="geogebraActivityURLexample">${_('Example')}: </label>
							<input type="text" id="geogebraActivityURLexample" name="geogebraActivityURLexample" readonly value="${this.activityURLbase}VgHhQXCC" />
						</p>
						<p>
							<span>${_('Title')}: </span>
							<span id="geogebraActivityTitle">&hellip;</span>
						</p>
						<p>
							<span>${_('Authorship')}: </span>
							<span id="geogebraActivityAuthorURL">&hellip;</span>
						</p>
						<p id="geogebraActivitySize">
							<label for="geogebraActivityWidth">${_('Width')}: </label>
							<input type="text" max="1500" name="geogebraActivityWidth" id="geogebraActivityWidth" /><span> px</span>
							<label for="geogebraActivityHeight">${_('Height')}: </label>
							<input type="text" max="1500" name="geogebraActivityHeight" id="geogebraActivityHeight" /><span> px</span>
						</p>
					</div>
				</fieldset>
				<fieldset id="eXeAutoGeogebraAdvancedOptions" class="exe-fieldset exe-fieldset-closed exe-feedback-fieldset">
					<legend><a href="#">${_('Advanced Options')}</a></legend>
					<div>
						<p id="geogebraActivityLangWrapper">
							<label for="geogebraActivityLang">${_('Language')}: </label>
							<input type="text" max="2" name="geogebraActivityLang" id="geogebraActivityLang" />
							<span class="input-instructions">es, en, fr, de, ca, eu, gl...</span>
							<label for="geogebraActivityBorderColor">${_('Border color')}: </label>
							<input type="text" max="6" name="geogebraActivityBorderColor" id="geogebraActivityBorderColor" class="exe-color-picker" />
							<label for="geogebraActivityScale">${_('Size')} (%): 
								<input type="number" name="geogebraActivityScale" id="geogebraActivityScale" value="100" min="1" max="100" step="1" />
							</label>
						</p>
						<div id="eXeAutoGeogebraCheckOptions">${this.getTrueFalseOptions()}</div>
						<p id="geogebraActivitySCORMblock">
							<label for="geogebraActivitySCORM">
								<input type="checkbox" name="geogebraActivitySCORM" id="geogebraActivitySCORM" /> ${_('Save score button')}
							</label>
							<span id="geogebraActivitySCORMoptions">
								<label for="geogebraActivitySCORMbuttonText">${_('Button text')}: </label>
								<input type="text" max="100" name="geogebraActivitySCORMbuttonText" id="geogebraActivitySCORMbuttonText" value="${str1}" />
							</span>
						</p>
						<div id="geogebraActivitySCORMinstructions">
							<ul>
								<li>${_('The button will only be displayed when exporting as SCORM and while editing in eXeLearning.')}</li>
							</ul>
						</div>
						<p id="geogebraActivityWeightDiv" style="display:none">
							<label for="geogebraActivityWeight">${_('Weight')} (%): 
								<input type="number" name="geogebraActivityWeight" id="geogebraActivityWeight" value="100" min="1" max="100" step="1" />
							</label>
						</p>
						<p>
							<strong style="display:none" class="geogebractivityModeLabel">
								<a href="#geogebraActivityEvaluationHelp" id="geogebraActivityEvaluationHelpLnk" class="geogebractivityModeHelpLink" title="${_('Help')}">
									<img src="${$exeDevice.idevicePath}quextIEHelp.gif" width="16" height="16" alt="${_('Help')}" />
								</a>
							</strong>
							<label for="geogebraActivityEvaluation">
								<input type="checkbox" id="geogebraActivityEvaluation"> ${_('Progress report')}.
							</label>
							<label for="geogebraActivityEvaluationID">${_('Identifier')}: 
								<input type="text" id="geogebraActivityEvaluationID" disabled />
							</label>
						</p>
						<div id="geogebraActivityEvaluationHelp" class="geogebractivityTypeGameHelp">
							<p>${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}</p>
						</div>
					</div>
				</fieldset>
				${$exeDevices.iDevice.common.getTextFieldset('after')}
			</div>
		`;

        this.ideviceBody.innerHTML = html;

        // Attach event listeners
        $('#geogebraActivityURLexample').focus(function () {
            this.select();
        });

        $('#geogebraActivityPlayButton').on('click', (e) => {
            e.preventDefault();
            const urlBase = this.activityURLbase,
                url = $('#geogebraActivityURL').val(),
                murl = url.replace('https://ggbm.at/', urlBase),
                id = $exeDevice.getId(murl);
            if (!url || !id) {
                $exeDevice.errorMessage(true);
                return;
            }
            $exeDevice.loadData(id, murl);
        });

        $('#geogebraActivityWidth, #geogebraActivityHeight').on(
            'keyup',
            function () {
                this.value = this.value.replace(/\D/g, '').substring(0, 4);
            },
        );

        $('#geogebraActivityLang').on('keyup', function () {
            this.value = this.value.replace(/[^A-Za-z]/g, '').substring(0, 2);
        });

        $('#geogebraActivityScale').on('keyup', function () {
            let v = this.value.replace(/\D/g, '');
            this.value = Math.min(Math.max(v, 1), 100);
        });

        $('#geogebraActivityWeight').on('keyup', function () {
            let v = this.value.replace(/\D/g, '');
            this.value = Math.min(Math.max(v, 1), 100);
        });

        $('#geogebraActivitySCORM').change(function () {
            const options = $(
                '#geogebraActivitySCORMoptions, #geogebraActivitySCORMinstructions',
            );
            this.checked ? options.fadeIn() : options.hide();
            this.checked
                ? $('#geogebraActivityWeightDiv').fadeIn()
                : $('#geogebraActivityWeightDiv').hide();
        });

        $('#geogebraActivityEvaluation').change(function () {
            $('#geogebraActivityEvaluationID').prop('disabled', !this.checked);
        });

        $('#geogebraActivityEvaluationHelpLnk').click(function () {
            $('#geogebraActivityEvaluationHelp').toggle();
            return false;
        });

         //eXe 3.0 Dismissible messages
         $('.exe-block-dismissible .exe-block-close').click(function () {
            $(this).parent().fadeOut();
            return false;
        });

        this.loadPreviousValues();
    },

    loadData: function (id, lurl) {
        if (id == '') return;
        let data = {
            request: {
                '-api': '1.0.0',
                task: {
                    '-type': 'fetch',
                    fields: {
                        field: [
                            {
                                '-name': 'width',
                            },
                            {
                                '-name': 'height',
                            },
                            {
                                '-name': 'author',
                            },
                            {
                                '-name': 'url',
                            },
                            {
                                '-name': 'title',
                            },
                            {
                                '-name': 'visibility',
                            },
                        ],
                    },
                    filters: {
                        field: [
                            {
                                '-name': 'id',
                                '#text': id,
                            },
                        ],
                    },
                    order: {
                        '-by': 'timestamp',
                        '-type': 'desc',
                    },
                    limit: {
                        '-num': '1',
                    },
                },
            },
        };
        $('#geogebraActivityURL').addClass('loading');
        $('#geogebraActivityURL').css('color', '#228B22');

        $.ajax({
            type: 'POST',
            url: 'https://www.geogebra.org/api/json.php',
            data: JSON.stringify(data),
            success: function (res) {
                if (
                    res &&
                    res.responses &&
                    res.responses.response &&
                    res.responses.response.item
                ) {
                    res = res.responses.response.item;
                    let w = '';
                    let h = '';
                    if (res.width) w = res.width;
                    if (res.height) h = res.height;
                    $('#geogebraActivityURL').removeClass('loading');
                    if (w != '' && h != '') {
                        $('#geogebraActivityWidth').val(w);
                        $('#geogebraActivityHeight').val(h);
                    }
                    let author = res.author ? res.author : '',
                        murl = res.url ? res.url : '',
                        title = res.title ? res.title : '',
                        visibility = res.visibility ? res.visibility : '';
                    if (visibility.toLowerCase() != 'o') {
                        murl =
                            lurl.indexOf('http') == 0
                                ? lurl
                                : 'https://ggbm.at/' + id;
                    }
                    $('#geogebraActivityAuthorURL').text(author);
                    $('#geogebraActivityTitle').html('<a href="'+murl+'">'+title+'</a>');
                } else {
                    $exeDevice.errorMessage(false);
                }
            },
            error: function () {
                $exeDevice.errorMessage(false);
            },
        });
    },

    errorMessage: function (tipo) {
        $('#geogebraActivityAuthorURL').text('');
        $('#geogebraActivityTitle').find('a').text('');
        $('#geogebraActivityTitle').find('a').prop('href', '#');
        $('#geogebraActivityURL').css('color', '#DC143C');
        $('#geogebraActivityURL').focus();
        $('#geogebraActivityURL').removeClass('loading');
        if (tipo) {
            eXe.app.alert(_('Provide a valid GeoGebra URL or activity ID.'));
        }
    },

    getId: function (url) {
        let id = '';
        const urlBase = $exeDevice.activityURLbase;
        const urlRegex =
            /^https?:\/\/www\.geogebra\.org\/m\/[a-zA-Z0-9]{2,20}#material\/[a-zA-Z0-9]{2,20}/;

        const urlRegex2 = /^[a-zA-Z0-9]{2,20}$/;

        if (url.match(urlRegex)) {
            id = url.replace(urlBase, '');
            id = id.split('/');
            id = id[id.length - 1];
        } else if (url.indexOf(urlBase) == 0) {
            id = url.replace(urlBase, '');
            id = id.split('/');
            id = id[0];
        } else if (url.match(urlRegex2)) {
            id = url;
        }
        id = id.replace(/ /g, '');
        return id;
    },

    getTrueFalseOptions: function () {
        let html = '';
        const opts = this.trueFalseOptions;
        for (let i in opts) {
            let checked = '';
            html += '<p>';
            html += '<label for="geogebraActivity' + i + '">';
            if (opts[i][1] == true) checked = ' checked="checked"';
            html +=
                '<input type="checkbox" id="geogebraActivity' +
                i +
                '"' +
                checked +
                ' /> ';
            html += opts[i][0];
            html += '</label>';
            html += '</p>';
        }

        return html;
    },

    getIdeviceID: function () {
        const ideviceid =
            $('#eXeAutoGeogebraForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';
        return ideviceid;
    },

    // Load the saved values in the form fields
    loadPreviousValues: function () {
        // Set default language
        let defaultLang = 'en';
        const langs = ['es', 'en', 'fr', 'de', 'ca', 'eu'];
        const docLang = $('html').eq(0).attr('lang');
        if (langs.indexOf(docLang) > -1)
            defaultLang = langs[langs.indexOf(docLang)];
        let langField = $('#geogebraActivityLang');
        langField.val(defaultLang);

        originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            let wrapper = $('<div></div>');
            wrapper.html(originalHTML);

            let div = $('div', wrapper);

            if (div.length == 0) return;
            div = div.eq(0);
            if (!div.hasClass('auto-geogebra')) return;

            let css = div.attr('class');

            // URL
            let id = css.replace('auto-geogebra auto-geogebra-', '');
            id = id.split(' ');
            id = id[0];
            if (id != '') {
                $('#geogebraActivityURL').val(this.activityURLbase + id);
            }

            if (div.hasClass('auto-geogebra-scorm')) {
                $('#geogebraActivitySCORM').prop('checked', true);
                // scorm-button-text
                let btn = $('.scorm-button-text', div);
                if (btn.length == 1) {
                    btn = btn.html();
                    btn = btn.replace(' (', '');
                    btn = btn.slice(0, -1);
                    $('#geogebraActivitySCORMbuttonText').val(btn);
                }
                $('#geogebraActivitySCORMoptions').show();
                $('#geogebraActivitySCORMinstructions').show();
            }

            let parts = css.split(' ');

            for (let i = 0; i < parts.length; i++) {
                let part = parts[i];
                let part0 = part;
                if (part.indexOf('auto-geogebra-height-') > -1) {
                    part = parseInt(part.replace('auto-geogebra-height-', ''));
                    $('#geogebraActivityHeight').val(part);
                } else if (part.indexOf('auto-geogebra-width-') > -1) {
                    part = parseInt(part.replace('auto-geogebra-width-', ''));
                    $('#geogebraActivityWidth').val(part);
                } else if (part.indexOf('language-') > -1) {
                    $('#geogebraActivityLang').val(
                        part.replace('language-', ''),
                    );
                } else if (part.indexOf('auto-geogebra-border-') > -1) {
                    $('#geogebraActivityBorderColor').val(
                        part.replace('auto-geogebra-border-', ''),
                    );
                } else if (part.indexOf('auto-geogebra-scale-') > -1) {
                    $('#geogebraActivityScale').val(
                        part.replace('auto-geogebra-scale-', ''),
                    );
                } else if (part.indexOf('auto-geogebra-weight-') > -1) {
                    $('#geogebraActivityWeight').val(
                        part.replace('auto-geogebra-weight-', ''),
                    );
                } else if (part.indexOf('auto-geogebra-evaluation-id-') > -1) {
                    let evid = part.replace('auto-geogebra-evaluation-id-', '');
                    if (evid != '0') {
                        $('#geogebraActivityEvaluation').prop('checked', true);
                        $('#geogebraActivityEvaluationID').val(evid);
                        $('#geogebraActivityEvaluationID').prop(
                            'disabled',
                            false,
                        );
                    }
                } else if (part.indexOf('auto-geogebra-ideviceid-') > -1) {
                    $exeDevice.ideviceID = part.replace(
                        'auto-geogebra-ideviceid-',
                        '',
                    );
                }
                let opts = this.trueFalseOptions;
                for (let p in opts) {
                    if (part == p) {
                        if (opts[p][1] == false)
                            $('#geogebraActivity' + p).prop('checked', true);
                    } else {
                        if (part0.slice(0, -1) == p)
                            $('#geogebraActivity' + p).prop('checked', false);
                    }
                }
            }

            if ($('#geogebraActivitySCORM').is(':checked')) {
                $('#geogebraActivityWeightDiv').show();
            } else {
                $('#geogebraActivityWeightDiv').hide();
            }

            // Instructions
            const instructions = $('.auto-geogebra-instructions', wrapper);
            if (instructions.length == 1)
                $('#geogebraActivityInstructions').val(instructions.html());
            const textAfter = $('.auto-geogebra-extra-content', wrapper);
            if (textAfter.length == 1)
                $('#eXeIdeviceTextAfter').val(textAfter.html());

            const author = $('.auto-geogebra-author', wrapper);
            if (author.length == 1) {
                let alt = author.text().split(',');
                if (alt.length == 5) {
                    $('#geogebraActivityAuthorURL').text(unescape(alt[0]));
                    $('#geogebraActivityTitle')
                        .find('a')
                        .text(unescape(alt[2]));
                    $('#geogebraActivityTitle')
                        .find('a')
                        .prop('href', unescape(alt[1]));
                }
            }
        }
    },

    save: function () {
        const urlBase = this.activityURLbase;

        // URL
        let url = $('#geogebraActivityURL').val(),
            evaluation = $('#geogebraActivityEvaluation').is(':checked'),
            evaluationID = $('#geogebraActivityEvaluationID').val(),
            ideviceID = $exeDevice.getIdeviceID();

        url = url.replace('https://ggbm.at/', urlBase);

        if (url == '') {
            eXe.app.alert(_('Provide a valid GeoGebra URL or activity ID.'));
            return false;
        }
        url = $exeDevice.getId(url);
        if (url == '') {
            $exeDevice.errorMessage(true);
            return false;
        }
        if (evaluation && evaluationID.length < 5) {
            eXe.app.alert(
                _('The report identifier must have at least 5 characters'),
            );
            return false;
        }
        evaluationID = evaluation ? evaluationID : '0';

        let divContent = '';
        // Instructions
        let instructions = tinymce.editors[0].getContent();
        if (instructions != '')
            divContent =
                '<div class="auto-geogebra-instructions">' +
                instructions +
                '</div>';
        divContent += `<div class="game-evaluation-ids js-hidden" data-id="${ideviceID}" data-evaluationid="${evaluationID}"></div>`;
        divContent +=
            '<p><a href="' +
            urlBase +
            url +
            '" target="_blank">' +
            urlBase +
            url +
            ' (' +
            _('New Window') +
            ')</a></p>';
        let css = 'auto-geogebra auto-geogebra-' + url;

        if (document.getElementById('geogebraActivitySCORM').checked) {
            let buttonText = $('#geogebraActivitySCORMbuttonText').val();
            if (buttonText == '') {
                eXe.app.alert(_('Please write the button text.'));
                return false;
            }
            css += ' auto-geogebra-scorm';
            divContent +=
                '<span class="scorm-button-text"> (' + buttonText + ')</span>';
        }

        let width = $('#geogebraActivityWidth').val();
        if (!isNaN(width) && width != '') {
            css += ' auto-geogebra-width-' + width;
        }

        let height = $('#geogebraActivityHeight').val();
        if (!isNaN(height) && height != '') {
            css += ' auto-geogebra-height-' + height;
        }

        // Border color
        let borderColor = $('#geogebraActivityBorderColor').val();
        if (borderColor != '' && borderColor != 'ffffff')
            css += ' auto-geogebra-border-' + borderColor;

        // Advanced options
        let lang = $('#geogebraActivityLang').val();
        if (lang.length == 2 && lang != 'en') css += ' language-' + lang;

        let opts = this.trueFalseOptions;
        for (let i in opts) {
            let opt = $('#geogebraActivity' + i);
            if (opt.is(':checked')) {
                if (opts[i][1] == false) css += ' ' + i;
            } else {
                if (opts[i][1] == true) css += ' ' + i + '0';
            }
        }
        let scl = $('#geogebraActivityScale').val();
        let weight = $('#geogebraActivityWeight').val();
        css += ' auto-geogebra-scale-' + scl;
        css += ' auto-geogebra-evaluation-id-' + evaluationID;
        css += ' auto-geogebra-ideviceid-' + ideviceID;
        css += ' auto-geogebra-weight-' + weight;

        let author = $('#geogebraActivityAuthorURL').text() || '';
        let title = $('#geogebraActivityTitle').find('a').text() || '',
            murl = $('#geogebraActivityTitle').find('a').prop('href') || '';
        if (author != '') {
            let ath = c_('Authorship');
            let show = $('#geogebraActivityShowAuthor').prop('checked')
                ? '1'
                : '0';
            divContent +=
                '<div class="auto-geogebra-author js-hidden">' +
                escape(author) +
                ',' +
                escape(murl) +
                ',' +
                escape(title) +
                ',' +
                show +
                ',' +
                escape(ath) +
                '</div>';
        }
        divContent +=
            '<div class="auto-geogebra-messages-evaluation">' +
            escape(c_('Incomplete activity')) +
            ',' +
            escape(c_('Activity: Passed. Score: %s')) +
            ',' +
            escape(c_('Activity: Not passed. Score: %s')) +
            ',' +
            escape(c_('Save score')) +
            '</div>';
        divContent +=
            '<div class="auto-geogebra-messages-scorm">' +
            escape(
                c_(
                    "The score can't be saved because this page is not part of a SCORM package",
                ),
            ) +
            ',' +
            escape(c_('Your score')) +
            ',' +
            escape(c_('Score')) +
            ',' +
            escape(c_('Weight')) +
            ',' +
            escape(c_('The last score saved is')) +
            '</div>';

        let textAfter = tinymce.editors[1].getContent();
        if (textAfter != '') {
            divContent +=
                '<div class="auto-geogebra-extra-content">' +
                textAfter +
                '</div>';
        }
        let html = '<div class="' + css + '">' + divContent + '</div>';
        return html;
    },
};
