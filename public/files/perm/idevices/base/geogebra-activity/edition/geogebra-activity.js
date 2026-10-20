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

    /**
     * This iDevice has no JSON options block: it persists everything as CSS
     * classes on its own markup and parses them back on edition. The pass score
     * follows the same rule -- one class, written only when the author
     * customised the mark, so that "global" costs nothing and older content
     * reads as global for free.
     *
     * A property rather than a module-level const: the editor re-injects this
     * file with a <script> tag every time an iDevice is edited, and a top-level
     * `const` throws "Identifier has already been declared" on the second
     * edition. `var $exeDevice` is redeclarable, which is why it is the shape
     * every iDevice uses.
     */
    passScoreClass: 'auto-geogebra-pass-score-',
    activityURLbase: 'https://www.geogebra.org/m/',

    idevicePath: '',
    ideviceID: '',
    classIdevice: 'geogebra-activity',
    // True/false options: label, default value and the explanation of its help
    trueFalseOptions: {
        showMenuBar: [_('Show menu bar'), false, _('Show the GeoGebra menu bar above the activity.')],
        showAlgebraInput: [_('Algebra input field'), false, _('Show the input bar where the learners can type commands and expressions.')],
        showToolBar: [_('Toolbar'), false, _('Show the toolbar with the construction tools.')],
        showToolBarHelp: [_('Toolbar help'), false, _('Show the help of the selected tool next to the toolbar.')],
        showResetIcon: [_('Reset icon'), false, _('Show a button that brings the activity back to how it started.')],
        enableShiftDragZoom: [_('Zoom'), false, _('Let the learners move the view by dragging it and zoom it with the mouse wheel.')],
        enableRightClick: [_('Enable right click'), false, _('Let the learners open the context menu of the objects with the right mouse button.')],
        errorDialogsActive: [_('Error dialogs'), false, _('Show a message when a command typed by the learners is wrong.')],
        preventFocus: [_('Prevent focus'), false, _('Do not move the keyboard focus to the activity when the page loads.')],
        showFullscreenButton: [_('Fullscreen button'), true, _('Show a button that opens the activity in full screen.')],
        disableAutoScale: [_('Disable auto-scale'), false, _('Keep the activity at its own size instead of fitting it to the width of the page.')],
        showSuggestionButtons: [_('Suggestion buttons'), true, _('Show the suggestion buttons of the algebra view, such as the one for special points.')],
        playButton: [_('Play button'), false, _('Load the activity when the learners press a play button, instead of with the page.')],
        ShowTitle: [_('Title'), true, _('Show the title of the activity below it.')],
        ShowAuthor: [_('Authorship'), true, _('Show the authorship of the activity below it.')],
    },

    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.createForm();
    },

    // Create the form to insert HTML in the TEXTAREA
    createForm: function () {
        const instructions = _(
            'Insert a GeoGebra activity from www.geogebra.org. It requires an Internet connection.'
        ).replace(
            ' www.geogebra.org',
            ' <a href="https://www.geogebra.org/" target="_blank" rel="noopener noreferrer">www.geogebra.org</a>'
        );
        const edition = $exeIDevicesEdition.iDevice,
            options = `
                <div id="eXeAutoGeogebraOptions">
                    <div id="geogebraActivityLangWrapper" class="d-flex flex-nowrap align-items-center gap-2 mb-3">
                        <label for="geogebraActivityLang" class="mb-0">${_('Language')}:</label>
                        <input type="text" maxlength="2" name="geogebraActivityLang" id="geogebraActivityLang" class="form-control" style="max-width:6ch" />
                        <span class="input-instructions">es, en, fr, de, ca, eu, gl...</span>
                        ${edition.common.getHelpTooltip(_('Language of the GeoGebra menus and messages, as a two-letter code.'))}
                    </div>
                    <div class="d-flex flex-nowrap align-items-center gap-2 mb-3">
                        <label for="geogebraActivityBorderColor" class="mb-0">${_('Border color')}:</label>
                        <input type="text" maxlength="6" name="geogebraActivityBorderColor" id="geogebraActivityBorderColor" class="exe-color-picker form-control" style="max-width:12ch" />
                        ${edition.common.getHelpTooltip(_('Color of the border around the activity.'))}
                    </div>
                    <div class="d-flex flex-nowrap align-items-center gap-2 mb-3">
                        <label for="geogebraActivityScale" class="mb-0">${_('Size')} (%):</label>
                        <input type="number" name="geogebraActivityScale" id="geogebraActivityScale" value="100" min="1" max="100" step="1" class="form-control" />
                        ${edition.common.getHelpTooltip(_('Size of the activity, as a percentage of its width and height.'))}
                    </div>
                    <div id="eXeAutoGeogebraCheckOptions">${this.getTrueFalseOptions()}</div>
                </div>`,
            contents = `
                <div id="eXeAutoGeogebraActivity">
                    <div id="geogebraActivityURLS" class="d-flex flex-nowrap align-items-center gap-2 mb-3">
                        <label for="geogebraActivityURL" class="mb-0">${_('URL or identifier (ID)')}:</label>
                        <input type="text" name="geogebraActivityURL" id="geogebraActivityURL" class="form-control w-100" />
                        <a href="#" id="geogebraActivityPlayButton" title="${_('Load data')}" class="flex-shrink-0"><span class="sr-av">${_('Load data')}</span></a>
                    </div>
                    <div class="d-flex flex-nowrap align-items-center gap-2 mb-3">
                        <label for="geogebraActivityURLexample" class="mb-0">${_('Example')}:</label>
                        <input type="text" id="geogebraActivityURLexample" name="geogebraActivityURLexample" readonly value="${this.activityURLbase}VgHhQXCC" class="form-control w-100" />
                    </div>
                    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                        <span class="mb-0">${_('Title')}:</span>
                        <span id="geogebraActivityTitle">&hellip;</span>
                    </div>
                    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                        <span class="mb-0">${_('Authorship')}:</span>
                        <span id="geogebraActivityAuthorURL">&hellip;</span>
                    </div>
                    <div id="geogebraActivitySize" class="d-flex flex-wrap align-items-center gap-2 mb-0">
                        <label for="geogebraActivityWidth" class="mb-0">${_('Width')}:</label>
                        <input type="text" maxlength="4" placeholder="800" name="geogebraActivityWidth" id="geogebraActivityWidth" class="form-control me-0" /><span class="text-muted me-2">px</span>
                        <label for="geogebraActivityHeight" class="ps-3 mb-0">${_('Height')}:</label>
                        <input type="text" maxlength="4" placeholder="600" name="geogebraActivityHeight" id="geogebraActivityHeight" class="form-control me-0" /><span class="text-muted">px</span>
                    </div>
                </div>`;
        const html = `
        <div id="eXeAutoGeogebraForm">
            ${edition.common.getIdeviceDescription(
                instructions,
                'https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe40/html/geogebra.html',
            )}
            ${edition.tabs.getHtml('eXeAutoGeogebraForm', {
                path: $exeDevice.idevicePath,
                instructions: '',
                options: options,
                contents: contents,
                after: true,
                grading: { hideautosave: true },
                share: false,
                info: {
                    options: _('Choose how the GeoGebra activity looks and what the learners can do in it.'),
                    contents: _('Paste the address or the identifier of a GeoGebra activity and load its data.'),
                },
            })}
        </div>
    `;
        this.ideviceBody.innerHTML = html;
        edition.tabs.bind('eXeAutoGeogebraForm');
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
            }
        );
        $('#geogebraActivityLang').on('keyup', function () {
            this.value = this.value.replace(/[^A-Za-z]/g, '').substring(0, 2);
        });
        $('#geogebraActivityScale').on('keyup', function () {
            let v = this.value.replace(/\D/g, '');
            this.value = Math.min(Math.max(v, 1), 100);
        });
        edition.gamification.scorm.init();
        this.loadPreviousValues();
        edition.gamification.progressBar.addEvents();
        edition.gamification.passScore.addEvents();
    },

    loadData: function (id, lurl) {
        if (id == '') return;
        const lifecycle = this.$lifecycle;
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

        // The GeoGebra lookup can answer long after the editor is gone: the
        // request is aborted with the edition and both callbacks are bound to
        // it, so a late answer never writes into another iDevice's form.
        const request = $.ajax({
            type: 'POST',
            url: 'https://www.geogebra.org/api/json.php',
            data: JSON.stringify(data),
            success: lifecycle.bind(function (res) {
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
                    $('#geogebraActivityTitle').html(
                        '<a href="' + murl + '">' + title + '</a>'
                    );
                } else {
                    this.errorMessage(false);
                }
            }),
            error: lifecycle.bind(function () {
                this.errorMessage(false);
            }),
        });
        lifecycle.ownInstance(request, 'abort');
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
            const checked = opts[i][1] ? ' checked="checked"' : '';
            html += `
                <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                    <span class="toggle-item">
                        <span class="toggle-control">
                            <input type="checkbox" id="geogebraActivity${i}" class="toggle-input"${checked} />
                            <span class="toggle-visual" aria-hidden="true"></span>
                        </span>
                        <label class="toggle-label mb-0" for="geogebraActivity${i}">${opts[i][0]}</label>
                    </span>
                    ${$exeIDevicesEdition.iDevice.common.getHelpTooltip(opts[i][2])}
                </div>
            `;
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

            // Only two modes are reachable here: this activity has no end of
            // its own, so it can only report when the learner presses the
            // button. The class means "button"; its absence means "do not save".
            let scormMode = 0;
            let scormButtonText = c_('Save score');
            let scormWeight = 100;

            if (div.hasClass('auto-geogebra-scorm')) {
                scormMode = 2;
                // scorm-button-text
                let btn = $('.scorm-button-text', div);
                if (btn.length == 1) {
                    btn = btn.html();
                    btn = btn.replace(' (', '');
                    btn = btn.slice(0, -1);
                    scormButtonText = btn;
                }
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
                        part.replace('language-', '')
                    );
                } else if (part.indexOf('auto-geogebra-border-') > -1) {
                    $('#geogebraActivityBorderColor').val(
                        part.replace('auto-geogebra-border-', '')
                    );
                } else if (part.indexOf('auto-geogebra-scale-') > -1) {
                    $('#geogebraActivityScale').val(
                        part.replace('auto-geogebra-scale-', '')
                    );
                } else if (part.indexOf('auto-geogebra-weight-') > -1) {
                    scormWeight = part.replace('auto-geogebra-weight-', '');
                } else if (part.indexOf('auto-geogebra-evaluation-id-') > -1) {
                    let evid = part.replace('auto-geogebra-evaluation-id-', '');
                    if (evid != '0') {
                        $exeIDevicesEdition.iDevice.gamification.progressBar.setValues(
                            { evaluation: true, evaluationID: evid }
                        );
                    }
                } else if (part.indexOf($exeDevice.passScoreClass) > -1) {
                    // Only written when the author customised the mark, so
                    // finding the class IS the custom mode. Content saved
                    // before this option existed has no class and stays global,
                    // which is what setValues() defaults to.
                    $exeIDevicesEdition.iDevice.gamification.passScore.setValues({
                        passScoreMode: 'custom',
                        passScoreCustom: part.replace($exeDevice.passScoreClass, ''),
                    });
                } else if (part.indexOf('auto-geogebra-ideviceid-') > -1) {
                    $exeDevice.ideviceID = part.replace(
                        'auto-geogebra-ideviceid-',
                        ''
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

            $exeIDevicesEdition.iDevice.gamification.scorm.setValues(
                scormMode,
                scormButtonText,
                true,
                scormWeight
            );

            // Instructions
            const instructions = $('.auto-geogebra-instructions', wrapper);
            if (instructions.length == 1)
                $('#eXeGameInstructions').val(instructions.html());
            const textAfter = $('.auto-geogebra-extra-content', wrapper);
            if (textAfter.length == 1)
                $('#eXeIdeviceTextAfter').val(textAfter.html());

            const author = $('.auto-geogebra-author', wrapper);
            if (author.length == 1) {
                let alt = author.text().split(',');
                if (alt.length == 5 || alt.length == 7) {
                    $('#geogebraActivityAuthorURL').text(unescape(alt[0]));
                    const titleText = unescape(alt[2]);
                    const titleUrl = unescape(alt[1]);
                    if (titleText !== '') {
                        $('#geogebraActivityTitle').html(
                            '<a href="' +
                                titleUrl +
                                '" target="_blank" rel="noopener noreferrer">' +
                                titleText +
                                '</a>'
                        );
                    } else {
                        $('#geogebraActivityTitle').text('');
                    }
                    if (alt.length == 7) {
                        $('#geogebraActivityShowTitle').prop(
                            'checked',
                            alt[5] == '1'
                        );
                    }
                }
            }
        }
    },

    save: function () {
        const urlBase = this.activityURLbase;

        // URL
        let url = $('#geogebraActivityURL').val(),
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
        const progressBar =
            $exeIDevicesEdition.iDevice.gamification.progressBar.getValues();
        if (!progressBar) return false;
        const evaluation = progressBar.evaluation;
        const evaluationID = evaluation ? progressBar.evaluationID : '0';
        const passScore =
            $exeIDevicesEdition.iDevice.gamification.passScore.getValues();

        let divContent = '';
        // Instructions
        const instructionsEditor = tinymce.get('eXeGameInstructions');
        let instructions = instructionsEditor
            ? instructionsEditor.getContent()
            : $('#eXeGameInstructions').val() || '';
        if (instructions != '')
            divContent =
                '<div class="auto-geogebra-instructions">' +
                instructions +
                '</div>';
        divContent += `<div class="game-evaluation-ids js-hidden" data-id="${ideviceID}" data-evaluationb="${evaluation}" data-evaluationid="${evaluationID}"></div>`;
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

        const scorm = $exeIDevicesEdition.iDevice.gamification.scorm.getValues();
        if (scorm.isScorm > 0) {
            let buttonText = scorm.textButtonScorm;
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
        let weight = scorm.weighted || 100;
        css += ' auto-geogebra-scale-' + scl;
        css += ' auto-geogebra-evaluation-id-' + evaluationID;
        css += ' auto-geogebra-ideviceid-' + ideviceID;
        css += ' auto-geogebra-weight-' + weight;
        // Absence means "follow the project", so nothing is written for the
        // global mode -- that is what keeps an activity inheriting live.
        if (passScore.passScoreMode === 'custom') {
            css += ' ' + $exeDevice.passScoreClass + passScore.passScoreCustom;
        }

        let author = $('#geogebraActivityAuthorURL').text() || '';
        let titleNode = $('#geogebraActivityTitle').find('a').first();
        let title = titleNode.text() || $('#geogebraActivityTitle').text() || '';
        let murl = titleNode.prop('href') || urlBase + url;
        if (author != '') {
            let ath = c_('Authorship');
            let ttl = c_('Title');
            let show = $('#geogebraActivityShowAuthor').prop('checked')
                ? '1'
                : '0';
            let showTitle = $('#geogebraActivityShowTitle').prop('checked')
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
                ',' +
                showTitle +
                ',' +
                escape(ttl) +
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
            ',' +
            // Last, so content saved before it keeps its positions.
            escape(c_('Minimum score needed to pass this activity: %s')) +
            '</div>';
        divContent +=
            '<div class="auto-geogebra-messages-scorm">' +
            escape(
                c_(
                    "The score can't be saved because this page is not part of a SCORM package"
                )
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

        const afterEditor = tinymce.get('eXeIdeviceTextAfter');
        let textAfter = afterEditor
            ? afterEditor.getContent()
            : $('#eXeIdeviceTextAfter').val() || '';
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
