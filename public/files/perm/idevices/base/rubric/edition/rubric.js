/**
 * Rubrics iDevice (edition code)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Ignacio Gros (http://gros.es/) for http://exelearning.net/
 *
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */

var $exeDevice = {
    // i18n
    title: _('Rubric'),
    category_name: _('Assessment and tracking'),

    // Editable strings ("Language settings tab")
    // See $rubricsIdevice.ci18n too
    ci18n: {
        activity: c_('Activity'),
        name: c_('Name'),
        date: c_('Date'),
        score: c_('Score'),
        notes: c_('Notes'),
        reset: c_('Reset'),
        print: c_('Print'),
        apply: c_('Apply'),
        newWindow: c_('New Window'),
    },

    // Default rubrics (just one for the moment)
    rubrics: [
        {
            title: 'Example rubric (4x4)',
            categories: [
                'Criteria 1',
                'Criteria 2',
                'Criteria 3',
                'Criteria 4',
            ],
            scores: ['Level 1', 'Level 2', 'Level 3', 'Level 4'],
            descriptions: [
                [
                    {
                        weight: '2.5',
                        text: 'Descriptor (1.1)',
                    },
                    {
                        weight: '1.75',
                        text: 'Descriptor (1.2)',
                    },
                    {
                        weight: '1.50',
                        text: 'Descriptor (1.3)',
                    },
                    {
                        weight: '1.25',
                        text: 'Descriptor (1.4)',
                    },
                ],
                [
                    {
                        weight: '2.5',
                        text: 'Descriptor (2.1)',
                    },
                    {
                        weight: '1.75',
                        text: 'Descriptor (2.2)',
                    },
                    {
                        weight: '1.50',
                        text: 'Descriptor (2.3)',
                    },
                    {
                        weight: '1.25',
                        text: 'Descriptor (2.4)',
                    },
                ],
                [
                    {
                        weight: '2.5',
                        text: 'Descriptor (3.1)',
                    },
                    {
                        weight: '1.75',
                        text: 'Descriptor (3.2)',
                    },
                    {
                        weight: '1.50',
                        text: 'Descriptor (3.3)',
                    },
                    {
                        weight: '1.25',
                        text: 'Descriptor (3.4)',
                    },
                ],
                [
                    {
                        weight: '2.5',
                        text: 'Descriptor (4.1)',
                    },
                    {
                        weight: '1.75',
                        text: 'Descriptor (4.2)',
                    },
                    {
                        weight: '1.50',
                        text: 'Descriptor (4.3)',
                    },
                    {
                        weight: '1.25',
                        text: 'Descriptor (4.4)',
                    },
                ],
            ],
        },
    ],

    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.createForm();
    },

    createForm: function () {
        const html = `
            <div id="ri_IdeviceForm">
                <p class="exe-block-info exe-block-dismissible">
                    ${_('Complete the table to define a scoring guide. Define the score or value of each descriptor.')}
                    <a href="https://youtu.be/T_QtGkH68EY?t=92" target="_blank" hreflang="es" rel="lightbox">${_('Learn how to apply a rubric')}</a>.
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Complete the table to define a scoring guide. Define the score or value of each descriptor.'))}
                    <fieldset class="exe-fieldset ">
                        <legend><a href="#">${_('Rubric')}</a></legend>
                        <div>
                            <div id="ri_RubricsEditor"></div>
                            <div id="ri_TableEditor"></div>
                            <div id="ri_PreviousContent"></div>
                        </div>
                    </fieldset>
                    ${$exeDevicesEdition.iDevice.common.getTextFieldset('after')}
                </div>
                ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
                ${$exeDevicesEdition.iDevice.gamification.share.getTab(true, 0, false)}
            </div>
        `;
        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('ri_IdeviceForm');
        this.resetForm();
        this.loadPreviousValues();
    },

    loadPreviousValues: function () {
        var originalHTML = this.idevicePreviousData;
        if (!originalHTML) return;

        $('#ri_PreviousContent').html(originalHTML);
        var data = this.tableToJSON('ri_PreviousContent');
        if (!data) return;

        var block, tmp;
        var div = $('#ri_PreviousContent');

        // Rubric instructions
        block = $('.exe-rubrics-instructions', div);
        if (block.length == 1) data.instructions = block.html();

        // Text after
        block = $('.exe-rubrics-text-after', div);
        if (block.length == 1) data.textAfter = block.html();

        // New format (preferred): hidden escaped HTML payload for robust recovery
        block = $('.exe-rubrics-richtext-data', div);
        if (block.length == 1) {
            var instructionsData = $('.exe-rubrics-instructions-data', block)
                .first()
                .text();
            if (instructionsData !== '') {
                data.instructions = this.decodeEscapedHTML(instructionsData);
            }

            var textAfterData = $('.exe-rubrics-text-after-data', block)
                .first()
                .text();
            if (textAfterData !== '') {
                data.textAfter = this.decodeEscapedHTML(textAfterData);
            }
        }

        // Rubric information
        var author = '', authorURL = '', license = '', visibleInfo = true;
        block = $('.exe-rubrics-authorship', div);
        if (block.length == 1) {
            if (block.hasClass('sr-av')) visibleInfo = false;
            // Author
            tmp = $('span.author', block);
            if (tmp.length == 1) {
                author = tmp.eq(0).text();
            } else {
                tmp = $('a.author', block);
                if (tmp.length == 1) {
                    tmp = tmp.eq(0);
                    authorURL = tmp.attr('href');
                    author = tmp.text();
                }
            }
            // License
            tmp = $('span.license a', block);
            if (tmp.length == 1) {
                tmp = tmp.eq(0).text();
                if (tmp.indexOf('CC ') == 0) license = tmp.replace('CC ', 'CC-');
            } else {
                tmp = $('span.license', block);
                if (tmp.length == 1) {
                    tmp = tmp.eq(0).text();
                    if (tmp == 'GNU/GPL') license = 'gnu-gpl';
                    else if (tmp == _('All Rights Reserved')) license = 'copyright';
                    else if (tmp == _('Public Domain')) license = 'pd';
                }
            }
        }
        data.author = author;
        data['author-url'] = authorURL;
        data.license = license;
        data['visible-info'] = visibleInfo;

        // Custom texts
        block = $('.exe-rubrics-strings', div);
        if (block.length == 1) {
            data.i18n = {};
            $('li', block).each(function () {
                var e = $(this);
                data.i18n[e.attr('class')] = e.text();
            });
        }

        this.jsonToTable(data, 'edition');

        // Load instructions and text-after into the editors defined in createForm()
        if (data.instructions) {
            var instrEd = tinyMCE.get('eXeGameInstructions');
            if (instrEd) instrEd.setContent(data.instructions);
            else $('#eXeGameInstructions').val(data.instructions);
        }
        if (data.textAfter) {
            var afterEd = tinyMCE.get('eXeIdeviceTextAfter');
            if (afterEd) afterEd.setContent(data.textAfter);
            else $('#eXeIdeviceTextAfter').val(data.textAfter);
        }

        this.originalData = data;
    },

    // Translate the default rubrics (CECED's won't be translated)
    translateRubric: function (data) {
        data = JSON.stringify(data);
        data = data.replace(/Example rubric/g, _('Example rubric'));
        data = data.replace(/Level/g, _('Level'));
        data = data.replace(/Criteria/g, _('Criteria'));
        data = data.replace(/Descriptor/g, _('Descriptor'));
        data = JSON.parse(data);
        return data;
    },

    // Re-attach fieldset toggle handlers after a dynamic rebuild of #ri_TableEditor
    enableFieldsetToggle: function () {
        $('#ri_TableEditor .exe-fieldset legend a').off('click.rubric').on('click.rubric', function () {
            $(this).closest('fieldset').toggleClass('exe-fieldset-closed');
            return false;
        });
    },

    // Rebuild the top controls in #ri_RubricsEditor (called on init and after loading CEDEC rubrics)
    resetForm: function () {
        // Get the available rubrics (a list)
        if (typeof $exeDevice.options == 'undefined')
            $exeDevice.options = $exeDevice.getRubricModels();

        // Create the "Create rubric" top form
        // The SELECT will be hidden until CEDEC's rubrics are loaded
        var toReview = _("Load CEDEC's rubrics (in Spanish)"); // To review (unused string)
        var appLang = $('html').eq(0).attr('lang');
        var lang = _('Spanish ');
        lang = lang.trim();
        lang = ' (' + lang + ')';
        if (
            appLang == 'es' ||
            appLang == 'eu' ||
            appLang == 'ca' ||
            appLang == 'gl' ||
            appLang == 'ca_ES@valencia'
        )
            lang = '';
        var html =
            '\
      <p>\
        <input type="button" value="' +
            _('New rubric') +
            '" id="ri_CreateNewRubric" /> \
        <span id="ri_NewTableOptions">\
          <label for="ri_NewTable" class="visually-hidden">' +
            _('New rubric: ') +
            '</label>\
          <select id="ri_NewTable" class="form-select">\
            <option value=""></option>\
            ' +
            $exeDevice.options +
            '\
          </select>\
        </span>\
        <input type="button" value="' +
            _('Example rubrics') +
            lang +
            '" id="ri_LoadCEDECRubrics" /> \
      </p>\
    ';

        // Insert the form in the rubric editor
        var ed = $('#ri_RubricsEditor');
        ed.html(html);

        // Events
        $('#ri_CreateNewRubric').click(function () {
            var data = $exeDevice.translateRubric($exeDevice.rubrics[0]);
            $exeDevice.jsonToTable(data, 'edition');
            $exeDevice.enableFieldsetToggle();
            $exeDevice.setEditionFocus();
            return false;
        });
        $('#ri_NewTable').change(function () {
            var rubric = this.value;
            if (rubric == '') {
                $exeDevice.alert(_('Please select a template'));
                return;
            }
            var data;
            if (rubric.indexOf('cedec') == 0) {
                rubric = rubric.replace('cedec', '');
                rubric = parseInt(rubric);
                data = $exeDevice.cedecRubrics.rubrics[rubric];
            } else {
                data = $exeDevice.translateRubric($exeDevice.rubrics[rubric]);
            }
            $exeDevice.jsonToTable(data, 'edition');
            $exeDevice.enableFieldsetToggle();
            $exeDevice.setEditionFocus();
        });

        // Link to load CEDEC's rubrics if onLine and if those rubrics are not loaded yet
        // if (navigator && navigator.onLine && typeof($exeDevice.cedecRubrics)=='undefined') {
        if (typeof $exeDevice.cedecRubrics == 'undefined') {
            var lnk = $('#ri_LoadCEDECRubrics');
            $('#ri_LoadCEDECRubrics')
                .click(function () {
                    $('#ri_RubricsEditor').addClass('loading');
                    var timestamp = '';
                    try {
                        timestamp = Date.now();
                    } catch (e) {}
                    $.ajax({
                        url:
                            $exeDevice.idevicePath +
                            'cedec.json?version' +
                            timestamp,
                        dataType: 'json',
                        success: function (res) {
                            $('#ri_RubricsEditor').removeClass('loading');
                            $exeDevice.cedecRubrics = res;
                            $exeDevice.completeRubricModels();
                        },
                        error: function () {
                            $exeDevice.alert(
                                _('Could not retrieve data (Core error)')
                            );
                            $('#ri_RubricsEditor').removeClass('loading');
                        },
                    });
                    return false;
                })
                .show();
        }

    },

    // Use eXe's alert messages
    alert: function (str) {
        eXe.app.alert(str);
    },

    // Get translated string at runtime (when translations are loaded)
    // This is needed because ci18n is initialized at load time when translations may not be ready
    // Uses _() (GUI translations) instead of c_() because c_strings may not be loaded yet
    getTranslatedString: function (key) {
        var strings = {
            activity: 'Activity',
            name: 'Name',
            date: 'Date',
            score: 'Score',
            notes: 'Notes',
            reset: 'Reset',
            print: 'Print',
            apply: 'Apply',
            newWindow: 'New Window',
        };
        if (strings[key]) {
            return _(strings[key]);
        }
        return key;
    },

    encodeEscapedHTML: function (html) {
        if (typeof html !== 'string') return '';
        return escape(html);
    },

    decodeEscapedHTML: function (encoded) {
        if (typeof encoded !== 'string' || encoded === '') return '';
        try {
            return unescape(encoded);
        } catch (e) {
            return encoded;
        }
    },

    // Get a list of the available rubrics (only one for the moment, that's why there's just a "New rubric" button)
    getRubricModels: function () {
        var html = '';
        var rubrics = $exeDevice.rubrics;
        var rubric, title;
        for (var i = 0; i < rubrics.length; i++) {
            rubric = rubrics[i];
            title = rubric['title'];
            title = title.replace(/Example rubric/g, _('Example rubric'));
            html += '<option value="' + i + '">' + title + '</option>';
        }
        return html;
    },

    // Update the list of rubrics to include CEDEC's, then show the SELECT and remove the "Load CEDEC's rubrics" button
    completeRubricModels: function () {
        // Default rubrics
        var rubrics = $exeDevice.rubrics;
        var rubric, title, i;
        var html = '<optgroup label="' + _('Example rubrics') + '">';
        for (i = 0; i < rubrics.length; i++) {
            rubric = rubrics[i];
            title = rubric['title'];
            title = title.replace(/Example rubric/g, _('Example rubric'));
            html += '<option value="' + i + '">' + title + '</option>';
        }
        html += '</optgroup>';

        // CEDEC's rubrics
        rubrics = $exeDevice.cedecRubrics.rubrics;
        html += '<optgroup label="' + _("CEDEC's rubrics") + '">';
        for (i = 0; i < rubrics.length; i++) {
            rubric = rubrics[i];
            title = rubric['title'];
            title = title.replace(/Example rubric/g, _('Example rubric'));
            html += '<option value="cedec' + i + '">' + title + '</option>';
        }
        html += '</optgroup>';

        $exeDevice.options = html;

        $exeDevice.resetForm();

        $('#ri_LoadCEDECRubrics').remove();
        $('#ri_NewTableOptions').show();
    },

    // After adding a new table, change the focus to the first visible INPUT so the user knows what to do
    setEditionFocus: function () {
        $('#ri_Cell-2').select();
    },

    // Get the table of #id and return it as a JSON object
    tableToJSON: function (id) {
        var i,
            z,
            t = $('#' + id + ' table');
        if (t.length != 1) return;
        var data = {};
        data.title = $('caption', t).html();
        data.categories = [];
        data.scores = [];
        data.descriptions = [];
        var trs = $('tbody tr', t);
        for (i = 0; i < trs.length; i++) {
            var tdH = $('th', trs[i]);
            if (tdH.length == 1) {
                data.categories.push(tdH.html());
            }
            var tds = $('td', trs[i]);
            var description = [];
            var tdContent;
            for (z = 0; z < tds.length; z++) {
                tdContent = tds[z].innerHTML;
                tdContent = tdContent.split(' <span');
                var txt = tdContent[0];
                var weight = '';
                if (tdContent.length == 2) {
                    // Get text between two rounded brackets
                    try {
                        weight = tdContent[1].match(/\(([^)]+)\)/)[1];
                    } catch (e) {
                        weight = '';
                    }
                }
                tdContent = {
                    weight: weight,
                    text: txt,
                };
                description.push(tdContent);
            }
            data.descriptions.push(description);
        }
        var ths = $('thead th', t);
        for (i = 0; i < ths.length; i++) {
            if (i != 0) data.scores.push(ths[i].innerHTML);
        }
        if (data.categories.length == 0) delete data.categories;
        return data;
    },

    // Add the scores of the first level and show the result in #ri_MaxScore
    setMaxScore: function () {
        var trs = $('#ri_TableEditor tbody tr');
        var nums = [];
        trs.each(function () {
            var val = $('td input', this).eq(1).val();
            val = val.replace(/[^0-9.,]/g, '');
            val = val.replace(/,/g, '.');
            var isNumeric = true;
            if (val == '' || isNaN(val)) isNumeric = false;
            if (isNumeric) nums.push(val);
        });
        var res = 0;
        for (var i = 0; i < nums.length; i++) {
            res += parseFloat(nums[i]);
        }
        res = Math.round(res * 10) / 10;
        $('#ri_MaxScore').val(res);
    },

    // Transform a JSON object into an HTML table
    getTableHTML: function (data) {
        var html = "<table class='exe-table'>";
        html += '<caption>' + data.title + '</caption>';
        html += '<thead>';
        html += '<tr>';
        html += '<th>&nbsp;</th>';
        for (i = 0; i < data.scores.length; i++) {
            html += '<th>' + data.scores[i] + '</th>';
        }
        html += '</tr>';
        html += '</thead>';
        html += '<tbody>';
        for (i = 0; i < data.descriptions.length; i++) {
            c = data.descriptions[i];
            html += '<tr>';
            html += '<th>' + data.categories[i] + '</th>';
            for (z = 0; z < data.scores.length; z++) {
                html += '<td>' + c[z].text;
                if (c[z].weight != '')
                    html += ' <span>(' + c[z].weight + ')</span>';
                html += '</td>';
            }
            html += '</tr>';
            html += '';
        }
        html += '';
        html += '</tbody>';
        html += '</table>';
        return html;
    },

    // Tranform the JSON data into:
    // If mode is "normal":  Instructions (optional) + A table + the rubric footer (authorship, license...) + Custom strings
    // If mode is "edition": Instructions (fieldset) + A table + The max score input + The buttons to reset and add rows and columns + The "Rubric information" fieldset + The i18n tab
    jsonToTable: function (data, mode) {
        var table = $exeDevice.getTableHTML(data);

        // Create the iDevice content
        if (mode == 'normal') {
            var intro = '';
            var instrEditor = tinyMCE.get('eXeGameInstructions');
            var instructions = instrEditor ? instrEditor.getContent() : ($('#eXeGameInstructions').val() || '');
            if (instructions.trim() !== '')
                intro = '<div class="exe-rubrics-instructions">' + instructions + '</div>';

            var info = '';
            var author = $('#ri_RubricAuthor').val();
            var authorURL = $('#ri_RubricAuthorURL').val();
            var license = $('#ri_RubricLicense').val();

            var visibility = ' sr-av';
            if ($('#ri_ShowRubricInfo').prop('checked')) visibility = '';
            if (author != '' || authorURL != '' || license != '') {
                var info =
                    '<p class="exe-rubrics-authorship' + visibility + '">';
                if (author != '') {
                    if (authorURL != '')
                        info +=
                            '<a href="' +
                            authorURL +
                            '" target="_blank" class="author" rel="noopener">' +
                            author +
                            '</a>. ';
                    else info += '<span class="author">' + author + '</span>. ';
                }
                info +=
                    '<span class="title"><em>' + data.title + '</em></span> ';
                if (license != '') {
                    info += '<span class="license">(';
                    if (license.indexOf('CC') == 0)
                        info +=
                            '<a href="https://creativecommons.org/licenses/" rel="license nofollow noopener" target="_blank" title="Creative Commons ' +
                            license +
                            '">' +
                            license.replace('CC-', 'CC ') +
                            '</a>';
                    else if (license == 'gnu-gpl') info += 'GNU/GPL';
                    else if (license == 'copyright')
                        info += _('All Rights Reserved');
                    else if (license == 'pd') info += _('Public Domain');
                    info += ')</span>';
                }
                info += '</p>';
            }

            // Custom texts - get fresh translations or custom values from form
            // English defaults (for comparison to detect customization)
            var englishDefaults = {
                activity: 'Activity',
                name: 'Name',
                date: 'Date',
                score: 'Score',
                notes: 'Notes',
                reset: 'Reset',
                print: 'Print',
                apply: 'Apply',
                newWindow: 'New Window',
            };
            var lang = '<ul class="exe-rubrics-strings">';
            for (var i in $exeDevice.ci18n) {
                var customField = $('#ci18n_' + i);
                var translatedValue = $exeDevice.getTranslatedString(i);
                var value;
                if (customField.length === 1 && customField.val() !== '') {
                    var fieldValue = customField.val();
                    // Use custom value only if it differs from both English default AND current translation
                    // This ensures we use translated values when user hasn't customized
                    if (fieldValue !== englishDefaults[i] && fieldValue !== translatedValue) {
                        value = fieldValue;
                    } else {
                        value = translatedValue;
                    }
                } else {
                    value = translatedValue;
                }
                lang +=
                    '<li class="' + i + '">' + value + '</li>';
            }
            lang += '</ul>';

            var textAfterEditor = tinyMCE.get('eXeIdeviceTextAfter');
            var textAfter = textAfterEditor ? textAfterEditor.getContent() : ($('#eXeIdeviceTextAfter').val() || '');
            var textAfterHTML = textAfter.trim() !== ''
                ? '<div class="exe-rubrics-text-after">' + textAfter + '</div>'
                : '';

            // New format: keep escaped copies for backward/forward-compatible recovery
            var richTextData =
                '<div class="exe-rubrics-richtext-data sr-av">' +
                '<span class="exe-rubrics-instructions-data">' +
                $exeDevice.encodeEscapedHTML(instructions) +
                '</span>' +
                '<span class="exe-rubrics-text-after-data">' +
                $exeDevice.encodeEscapedHTML(textAfter) +
                '</span>' +
                '</div>';

            return intro + table + info + lang + textAfterHTML + richTextData;
        }

        var html = '';

        html += table;

        // Max score + Buttons (reset, add row, add column)
                html +=
                        '<div id="ri_TableControls">\
                <div class="ri-table-controls-left">\
                    <label for="ri_MaxScore">' +
                        _('Maximum score:') +
                        '</label> <input type="text" id="ri_MaxScore" readonly="readonly" value="" /> <span id="ri_MaxScoreInstructions">' +
                        _('The result of adding the scores of the first level.') +
                        '</span>\
                </div>\
                <div class="ri-table-controls-right">\
                    <input type="button" id="ri_AppendCol" class="btn btn-primary" value="' +
                        _('New column') +
                        '" />\
                    <input type="button" id="ri_AppendRow" class="btn btn-primary" value="' +
                        _('New row') +
                        '" />\
                    <input type="button" id="ri_Reset" class="btn btn-primary" value="' +
                        _('Reset') +
                        '" />\
                </div>\
            </div>';

                // Rubric information
        var author = '';
        var authorLink = '';
        var license = '';
        if (data.author) author = data.author;
        if (data['author-url']) authorLink = data['author-url'];
        if (data.license) license = data.license;
        html +=
                        '\
                <div id="ri_RubricInformation" class="exe-rubric-information">\
                    <div class="toggle-item ri-toggle-item" idevice-id="ri_ShowRubricInfo">\
                        <div class="toggle-control">\
                            <input type="checkbox" id="ri_ShowRubricInfo" class="toggle-input" />\
                            <span class="toggle-visual"></span>\
                        </div>\
                        <label class="toggle-label" for="ri_ShowRubricInfo">' +
            _('Show rubric information') +
                        '</label>\
                    </div>\
                    <div id="ri_RubricInfoFields">\
            <p>\
              <label for="ri_RubricAuthor">' +
            _('Source/Author') +
            ':</label> <input type="text" id="ri_RubricAuthor" value="' +
            author +
            '" /> \
            </p>\
            <p>\
              <label for="ri_RubricAuthorURL">' +
            _('Source/Author Link') +
            ':</label> <input type="text" id="ri_RubricAuthorURL" value="' +
            authorLink +
            '" /> \
            </p>\
            <p>\
              <label for="ri_RubricLicense">' +
            _('License') +
            ':</label>\
              <select id="ri_RubricLicense">\
                <option value="">&nbsp;</option>\
                <option value="pd">' +
            _('Public Domain') +
            '</option>\
                <option value="gnu-gpl">GNU/GPL</option>\
                <option value="CC-BY">Creative Commons BY</option>\
                <option value="CC-BY-SA">Creative Commons BY-SA</option>\
                <option value="CC-BY-ND">Creative Commons BY-ND</option>\
                <option value="CC-BY-NC">Creative Commons BY-NC</option>\
                <option value="CC-BY-NC-SA">Creative Commons BY-NC-SA</option>\
                <option value="CC-BY-NC-ND">Creative Commons BY-NC-ND</option>\
                <option value="copyright">Copyright (' +
            _('All Rights Reserved') +
            ')</option>\
              </select>\
            </p>\
                    </div>\
                </div>';

        var ed = $('#ri_TableEditor');
        this.editor = ed;

        ed.html(html);

        // Init (or reinit) TinyMCE on the new editors inside #ri_TableEditor
        $exeTinyMCE.init('multiple-visible', '.exe-html-editor');

        // Set the custom strings
        if (data.i18n) {
            var strings = data.i18n;
            for (var z in strings) {
                $('#ci18n_' + z).val(strings[z]);
            }
        }

        // Buttons (events)
        $('#ri_Reset').click(function () {
            eXe.app.confirm(
                _('Attention'),
                _("Revert all changes? This can't be undone."),
                function () {
                    if (typeof $exeDevice.originalData != 'undefined') {
                        $exeDevice.jsonToTable(
                            $exeDevice.originalData,
                            'edition'
                        );
                        $exeDevice.enableFieldsetToggle();
                    } else {
                        $('#ri_TableEditor').html('');
                    }
                }
            );
        });
        $('#ri_AppendRow').click(function () {
            $exeDevice.dom.addRow('end');
        });
        $('#ri_AppendCol').click(function () {
            $exeDevice.dom.addCol();
        });

        // Default is hidden unless explicitly enabled in saved data
        var showRubricInfo = false;
        if (data['visible-info'] == true) showRubricInfo = true;
        $('#ri_ShowRubricInfo').prop('checked', showRubricInfo);
        this.updateRubricInfoFieldsVisibility();
        $('#ri_ShowRubricInfo').off('change.rubric').on('change.rubric', function () {
            $exeDevice.updateRubricInfoFieldsVisibility();
        });

        $('#ri_RubricInformation')
            .off('click.rubricToggle', '.ri-toggle-item')
            .on('click.rubricToggle', '.ri-toggle-item', function (e) {
                if ($(e.target).is('input, label, a, button')) return;
                var id = $(this).attr('idevice-id');
                if (!id) return;
                var input = $('#' + id);
                if (!input.length) return;
                input.prop('checked', !input.is(':checked')).trigger('change');
            });

        // Select the right license
        $('#ri_RubricLicense').val(license);

        // Add an ID to the table
        $('table', ed).attr('id', 'ri_Table');

        // Make the table editable
        this.makeEditable();
    },

    // DOM methods to add a row or a column to the table
    dom: {
        addRow: function (position) {
            // We always add the row at the end, but you could add it at the beggining too.
            $exeDevice.makeNormal();
            var trs = $('#ri_Table tbody tr');
            // Copy the last row and paste it at the end with no data
            var tr = trs.eq(trs.length - 1);
            var newTR = tr.clone();
            var tmp = $('<div></div>');
            tmp.html(newTR);
            $('th,td', tmp).each(function () {
                var html = this.innerHTML;
                if (html.indexOf('<span') == -1) this.innerHTML = 'X';
                else this.innerHTML = 'X <span>(X)</span>';
            });
            if (position == 'end') tr.after(tmp.html());
            else if (position == 'start')
                $('#ri_Table tbody').prepend(tmp.html());
            $exeDevice.makeEditable();
        },
        addCol: function () {
            $exeDevice.makeNormal();
            $('#ri_Table tr').each(function (i) {
                var td, newTD;
                if (i == 0) {
                    td = $('th', this);
                    newTD = '<th>X</th>';
                } else {
                    td = $('td', this);
                    newTD = '<td>X</td>';
                }
                td = td.eq(td.length - 1);
                td.after(newTD);
            });
            $exeDevice.makeEditable();
        },
    },

    setFieldError: function (field) {
        field.addClass('exe-rubrics-required').focus(function () {
            $(this).removeClass('exe-rubrics-required');
        });
    },

    updateRubricInfoFieldsVisibility: function () {
        var isVisible = $('#ri_ShowRubricInfo').prop('checked');
        $('#ri_RubricInfoFields').toggle(isVisible);
    },

    save: function () {
        // Validate (and remove any HTML tags)

        var table = $('#ri_TableEditor table');

        // No rubric
        if (table.length == 0) {
            this.alert(_('The rubric is empty...'));
            return false;
        }

        // Caption
        var c0 = $('#ri_Cell-0', table);
        c0.val($exeDevice.removeTags(c0.val()));
        if (c0.val() == '') {
            this.alert(_('Please write the rubric title.'));
            this.setFieldError(c0);
            return false;
        }

        // Levels
        var levels = $("thead th input[type='text']", table);
        var levelErrors = false;
        levels.each(function () {
            this.value = $exeDevice.removeTags(this.value);
            if (this.value == '') {
                $exeDevice.setFieldError($(this));
                if (levelErrors == false)
                    $exeDevice.alert(
                        _('Please write the level name in each column.')
                    );
                levelErrors = true;
            }
        });
        if (levelErrors) return false;

        // Criteria
        var criteria = $("tbody th input[type='text']", table);
        var criteriaErrors = false;
        criteria.each(function () {
            this.value = $exeDevice.removeTags(this.value);
            if (this.value == '') {
                $exeDevice.setFieldError($(this));
                if (criteriaErrors == false)
                    $exeDevice.alert(
                        _('Please write the criteria name in each row.')
                    );
                criteriaErrors = true;
            }
        });
        if (criteriaErrors) return false;

        // Descriptions
        var descriptions = $("tbody td input[type='text']", table);
        var descriptionErrors = false;
        descriptions.each(function () {
            this.value = $exeDevice.removeTags(this.value);
            // The score field can be empty...
            if (this.id.indexOf('-weight') == -1 && this.value == '') {
                $exeDevice.setFieldError($(this));
                if (descriptionErrors == false)
                    $exeDevice.alert(
                        _('Please write all the criteria descriptors.')
                    );
                descriptionErrors = true;
            }
        });
        if (descriptionErrors) return false;

        // Make the table normal
        this.makeNormal();

        var data = this.tableToJSON('ri_TableEditor');

        // Get the rubric instructions and add them to the data
        var instrEditor = tinyMCE.get('eXeGameInstructions');
        var instructions = instrEditor ? instrEditor.getContent() : ($('#eXeGameInstructions').val() || '');
        if (instructions.trim() !== '') data.instructions = instructions;

        // Get the rubric information and add it to data
        data['visible-info'] = $('#ri_ShowRubricInfo').prop('checked');
        var author = $('#ri_RubricAuthor').val();
        if (author != '') data.author = author;
        var authorURL = $('#ri_RubricAuthorURL').val();
        if (authorURL != '') data['author-url'] = authorURL;
        var license = $('#ri_RubricLicense').val();
        if (license != '') data.license = license;

        // Note: Custom strings (i18n) are now handled directly in jsonToTable('normal')
        // by reading from the form fields at save time

        // Return the HTML to save
        return this.jsonToTable(data, 'normal');
    },

    // Make the table editable
    makeEditable: function () {
        var cells = $('caption,td,th', this.editor);
        this.cells = cells;
        cells.each(function (i) {
            var html = this.innerHTML;
            var isTopCell = false;
            if (html == '&nbsp;') isTopCell = true;
            html = html.split(' <span');
            var extra = '';
            // The text INPUT of the first cell should be hidden
            if (isTopCell) extra = 'style="visibility:hidden" ';
            this.innerHTML =
                '<input type="text" ' +
                extra +
                'id="ri_Cell-' +
                i +
                '" value="' +
                html[0] +
                '" />';
            if ($(this).prop('tagName') == 'TD') {
                if (html.length == '2') {
                    try {
                        // Try to get anything between ()
                        html = html[1].match(/\(([^)]+)\)/)[1];
                    } catch (e) {
                        html = '';
                    }
                } else {
                    html = '';
                }
                this.innerHTML +=
                    '<span><label>' +
                    _('Score') +
                    ': </label><input type="text" id="ri_Cell-' +
                    i +
                    '-weight" class="ri_Weight" value="' +
                    html +
                    '" title="' +
                    _('Score (include a number)') +
                    '" /></span>';

                this.innerHTML +=
                    '<a href="#" class="ri_EditTD" title="' +
                    _('Edit') +
                    '" aria-label="' +
                    _('Edit') +
                    '"><span class="ri_EditTDIcon" aria-hidden="true">&#9998;</span><span class="sr-av">' +
                    _('Edit') +
                    '</span></a>';
            }
        });

        this.ensureCellEditModal();

        // Add row buttons (move up, move down, edit row, delete row)
        var trActions =
            '<span class="ri_Actions ri_RowActions">\
        <a href="#" class="ri_MoveTRUp" title="' +
            _('Up') +
            '"><span class="sr-av">&#8593;</span></a> \
        <a href="#" class="ri_MoveTRDown" title="' +
            _('Down') +
            '"><span class="sr-av">&#8595;</span></a> \
        <a href="#" class="ri_EditTR" title="' +
            _('Edit') +
            '"><span aria-hidden="true">&#9998;</span><span class="sr-av">' +
            _('Edit') +
            '</span></a> \
        <a href="#" class="ri_DeleteTR" title="' +
            _('Delete') +
            '"><span class="sr-av">&#120;</span></a> \
      </span>';
        $('tbody tr', this.editor).each(function () {
            $(this.firstChild).append(trActions);
        });
        // Events:
        // Move up or down
        $('.ri_MoveTRUp,.ri_MoveTRDown').click(function () {
            var row = $(this).parents('tr:first');
            if ($(this).is('.ri_MoveTRUp')) {
                row.insertBefore(row.prev());
            } else {
                row.insertAfter(row.next());
            }
            return false;
        });
        // Delete row
        $('.ri_DeleteTR').click(function () {
            $exeDevice.tmp = $(this).parents('tr:first');
            eXe.app.confirm(_('Row'), _('Delete the row?'), function () {
                $exeDevice.tmp.remove();
            });
            return false;
        });

        // Edit row via modal (save all row changes on accept)
        $('.ri_EditTR').click(function () {
            var row = $(this).parents('tr:first');
            $exeDevice.openRowEditModal(row);
            return false;
        });

        // Edit cell via modal
        $('.ri_EditTD').click(function () {
            var td = $(this).closest('td');
            $exeDevice.openCellEditModal(td);
            return false;
        });

        // Add column buttons (move left, move right, edit, delete)
        var thActions =
            '<span class="ri_Actions ri_ColActions">\
        <a href="#" class="ri_MoveTRToTheLeft" title="' +
            _('Left') +
            '"><span class="sr-av">&#8592;</span></a> \
        <a href="#" class="ri_MoveTRToTheRight" title="' +
            _('Right') +
            '"><span class="sr-av">&#8594;</span></a> \
        <a href="#" class="ri_EditColumn d-none" title="' +
            _('Edit') +
            '"><span aria-hidden="true">&#9998;</span><span class="sr-av">' +
            _('Edit') +
            '</span></a> \
        <a href="#" class="ri_DeleteColumn" title="' +
            _('Delete') +
            '"><span class="sr-av">&#120;</span></a> \
      </span>';
        $('thead th', this.editor).each(function () {
            $(this).prepend(thActions);
        });
        // Events:
        // Move left
        $('.ri_MoveTRToTheLeft').click(function () {
            var colnum = $(this).closest('th').prevAll('th').length;
            jQuery.each($('#ri_Table tr'), function () {
                $(this)
                    .children(':eq(' + colnum + ')')
                    .after($(this).children(':eq(' + (colnum - 1) + ')'));
            });
            return false;
        });
        // Move right
        $('.ri_MoveTRToTheRight').click(function () {
            var colnum = $(this).closest('th').prevAll('th').length;
            jQuery.each($('#ri_Table tr'), function () {
                $(this)
                    .children(':eq(' + (colnum + 1) + ')')
                    .after($(this).children(':eq(' + colnum + ')'));
            });
            return false;
        });
        // Edit column via modal (save all column changes on accept)
        $('.ri_EditColumn').click(function () {
            var th = $(this).closest('th');
            $exeDevice.openColumnEditModal(th);
            return false;
        });
        // Delete column
        $('.ri_DeleteColumn').click(function () {
            if ($('#ri_Table thead th').length == 2) {
                $exeDevice.alert(_('There should be at least one level.'));
                return false;
            }
            $exeDevice.tmp = $(this).closest('th').prevAll('th').length;
            eXe.app.confirm(_('Column'), _('Delete the column?'), function () {
                $('#ri_Table tr').each(function () {
                    $('th,td', this).each(function (i) {
                        if (i == $exeDevice.tmp) $(this).remove();
                    });
                });
            });
            return false;
        });

        // Set the maximum score
        $('.ri_Weight')
            .keyup(function () {
                $exeDevice.setMaxScore();
            })
            .blur(function () {
                $exeDevice.setMaxScore();
            });
        $exeDevice.setMaxScore();
    },

    ensureCellEditModal: function () {
        var modal = $('#ri_CellEditModal');
        if (modal.length === 1) return;

        var html =
            '<div id="ri_CellEditModal" class="modal" tabindex="-1" aria-hidden="true">' +
            '<div class="modal-dialog modal-dialog-centered">' +
            '<div class="modal-content">' +
            '<div class="modal-header">' +
            '<h5 id="ri_CellEditModalTitle" class="modal-title">' +
            _('Edit cell') +
            '</h5>' +
            '<button type="button" id="ri_CellEditClose" class="btn-close" aria-label="' +
            _('Close') +
            '"></button>' +
            '</div>' +
            '<div class="modal-body">' +
            '<div class="mb-3">' +
            '<label for="ri_CellEditContent" class="form-label">' +
            _('Descriptor') +
            ':</label>' +
            '<textarea id="ri_CellEditContent" rows="3" class="form-control"></textarea>' +
            '</div>' +
            '<div class="mb-3">' +
            '<label for="ri_CellEditScore" class="form-label">' +
            _('Score') +
            ':</label>' +
            '<input type="text" id="ri_CellEditScore" class="form-control" />' +
            '</div>' +
            '</div>' +
            '<div class="modal-footer">' +
            '<button type="button" id="ri_CellEditAccept" class="btn btn-primary">' +
            _('Accept') +
            '</button>' +
            '<button type="button" id="ri_CellEditCancel" class="btn btn-secondary">' +
            _('Cancel') +
            '</button>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>';

        $('#ri_TableEditor').append(html);

        $('#ri_CellEditAccept').off('click').on('click', function () {
            $exeDevice.applyCellEditModal();
            return false;
        });
        $('#ri_CellEditCancel').off('click').on('click', function () {
            $exeDevice.closeCellEditModal();
            return false;
        });
        $('#ri_CellEditClose').off('click').on('click', function () {
            $exeDevice.closeCellEditModal();
            return false;
        });
    },

    openCellEditModal: function (td) {
        if (!td || td.length !== 1) return;

        this.cellEditTarget = td;
        var contentInput = td.find('input[type="text"]').not('.ri_Weight').first();
        var scoreInput = td.find('input.ri_Weight').first();

        $('#ri_CellEditContent').val(contentInput.val() || '');
        $('#ri_CellEditScore').val(scoreInput.val() || '');

        $('#ri_CellEditModal').addClass('show').attr('aria-hidden', 'false').css('display', 'block');
        $('body').addClass('modal-open');
        if ($('#ri_CellEditModalBackdrop').length === 0) {
            $('body').append('<div id="ri_CellEditModalBackdrop" class="modal-backdrop fade show"></div>');
        }
        $('#ri_CellEditContent').focus();
    },

    closeCellEditModal: function () {
        $('#ri_CellEditModal').removeClass('show').attr('aria-hidden', 'true').css('display', 'none');
        $('body').removeClass('modal-open');
        $('#ri_CellEditModalBackdrop').remove();
        this.cellEditTarget = null;
    },

    applyCellEditModal: function () {
        if (!this.cellEditTarget || this.cellEditTarget.length !== 1) {
            this.closeCellEditModal();
            return;
        }

        var contentValue = $('#ri_CellEditContent').val();
        var scoreValue = $('#ri_CellEditScore').val();
        var contentInput = this.cellEditTarget
            .find('input[type="text"]')
            .not('.ri_Weight')
            .first();
        var scoreInput = this.cellEditTarget.find('input.ri_Weight').first();

        contentInput.val(contentValue);
        scoreInput.val(scoreValue);
        this.setMaxScore();
        this.closeCellEditModal();
    },

    ensureRowEditModal: function () {
        var modal = $('#ri_RowEditModal');
        if (modal.length === 1) return;

        var html =
            '<div id="ri_RowEditModal" class="modal" tabindex="-1" aria-hidden="true">' +
            '<div class="modal-dialog modal-dialog-centered">' +
            '<div class="modal-content">' +
            '<div class="modal-header">' +
            '<h5 id="ri_RowEditModalTitle" class="modal-title"></h5>' +
            '<button type="button" id="ri_RowEditClose" class="btn-close" aria-label="' +
            _('Close') +
            '"></button>' +
            '</div>' +
            '<div class="modal-body">' +
            '<p id="ri_RowEditFirstCellInfo" class="form-text"></p>' +
            '<div class="ri-row-edit-layout">' +
            '<div class="ri-row-edit-fields">' +
            '<div class="ri-row-edit-topbar">' +
            '<button type="button" id="ri_RowEditPrev" class="btn btn-outline-secondary btn-sm ri-row-nav-btn" title="' +
            _('Previous') +
            '" aria-label="' +
            _('Previous') +
            '"><span aria-hidden="true">&#8592;</span><span class="sr-av">' +
            _('Previous') +
            '</span></button>' +
            '<p class="ri-row-edit-position-wrap"><span id="ri_RowEditPosition" class="ri-row-edit-position"></span></p>' +
            '<button type="button" id="ri_RowEditNext" class="btn btn-outline-secondary btn-sm ri-row-nav-btn" title="' +
            _('Next') +
            '" aria-label="' +
            _('Next') +
            '"><span aria-hidden="true">&#8594;</span><span class="sr-av">' +
            _('Next') +
            '</span></button>' +
            '</div>' +
            '<div class="mb-3">' +
            '<label for="ri_RowEditContent" class="form-label">' +
            _('Descriptor') +
            ':</label>' +
            '<textarea id="ri_RowEditContent" rows="3" class="form-control"></textarea>' +
            '</div>' +
            '<div class="mb-3">' +
            '<label for="ri_RowEditScore" class="form-label">' +
            _('Score') +
            ':</label>' +
            '<input type="text" id="ri_RowEditScore" class="form-control" />' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '<div class="modal-footer">' +
            '<button type="button" id="ri_RowEditAccept" class="btn btn-primary">' +
            _('Save') +
            '</button>' +
            '<button type="button" id="ri_RowEditCancel" class="btn btn-secondary">' +
            _('Close') +
            '</button>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>';

        $('#ri_TableEditor').append(html);

        $('#ri_RowEditAccept').off('click').on('click', function () {
            $exeDevice.applyRowEditModal();
            return false;
        });
        $('#ri_RowEditCancel').off('click').on('click', function () {
            $exeDevice.requestCloseRowEditModal();
            return false;
        });
        $('#ri_RowEditClose').off('click').on('click', function () {
            $exeDevice.requestCloseRowEditModal();
            return false;
        });
        $('#ri_RowEditPrev').off('click').on('click', function () {
            $exeDevice.navigateRowEditModal(-1);
            return false;
        });
        $('#ri_RowEditNext').off('click').on('click', function () {
            $exeDevice.navigateRowEditModal(1);
            return false;
        });
        $('#ri_RowEditContent,#ri_RowEditScore')
            .off('input')
            .on('input', function () {
                $exeDevice.syncActiveRowEditDraft();
            });
    },

    openRowEditModal: function (row) {
        if (!row || row.length !== 1) return;

        this.ensureRowEditModal();

        var titleInput = row.find('th input[type="text"]').first();
        var cells = row.find('td');
        if (cells.length === 0) return;

        var columnTitles = [];
        $('#ri_Table thead th').each(function (i) {
            if (i === 0) return;
            var input = $('input[type="text"]', this).first();
            columnTitles.push(input.val() || '');
        });

        var drafts = [];
        cells.each(function () {
            var td = $(this);
            drafts.push({
                td: td,
                content: td.find('input[type="text"]').not('.ri_Weight').first().val() || '',
                score: td.find('input.ri_Weight').first().val() || '',
            });
        });

        this.rowEditState = {
            row: row,
            title: titleInput.val() || '',
            drafts: drafts,
            columnTitles: columnTitles,
            originals: drafts.map(function (item) {
                return {
                    content: item.content,
                    score: item.score,
                };
            }),
            activeIndex: 0,
        };

        var criterionTitle = this.rowEditState.title || '';
        $('#ri_RowEditModalTitle').text(_('Assessment criteria') + (criterionTitle ? ': ' + criterionTitle : ''));
        this.renderRowEditModalFields();

        $('#ri_RowEditModal').addClass('show').attr('aria-hidden', 'false').css('display', 'block');
        $('body').addClass('modal-open');
        if ($('#ri_RowEditModalBackdrop').length === 0) {
            $('body').append('<div id="ri_RowEditModalBackdrop" class="modal-backdrop fade show"></div>');
        }
        $('#ri_RowEditContent').focus();
    },

    renderRowEditModalFields: function () {
        if (!this.rowEditState || !this.rowEditState.drafts || this.rowEditState.drafts.length === 0) return;

        var index = this.rowEditState.activeIndex;
        var total = this.rowEditState.drafts.length;
        var active = this.rowEditState.drafts[index];
        var activeColumnTitle =
            (this.rowEditState.columnTitles && this.rowEditState.columnTitles[index]) ||
            _('Column') +
                ' ' +
                (index + 1);
        $('#ri_RowEditContent').val(active.content || '');
        $('#ri_RowEditScore').val(active.score || '');

        $('#ri_RowEditFirstCellInfo').text(
            _('Performance level') +
                ': ' +
                activeColumnTitle
        );
        $('#ri_RowEditPosition').text(index + 1 + ' / ' + total);
        $('#ri_RowEditPrev').prop('disabled', index === 0);
        $('#ri_RowEditNext').prop('disabled', index === total - 1);
    },

    syncActiveRowEditDraft: function () {
        if (!this.rowEditState || !this.rowEditState.drafts || this.rowEditState.drafts.length === 0) return;

        var index = this.rowEditState.activeIndex;
        this.rowEditState.drafts[index].content = $('#ri_RowEditContent').val() || '';
        this.rowEditState.drafts[index].score = $('#ri_RowEditScore').val() || '';

        // Keep first-column summary in sync if editing first cell
        this.renderRowEditModalFields();
    },

    navigateRowEditModal: function (delta) {
        if (!this.rowEditState || !this.rowEditState.drafts || this.rowEditState.drafts.length === 0) return;

        this.syncActiveRowEditDraft();

        var nextIndex = this.rowEditState.activeIndex + delta;
        if (nextIndex < 0 || nextIndex >= this.rowEditState.drafts.length) return;

        this.rowEditState.activeIndex = nextIndex;
        this.renderRowEditModalFields();
    },

    closeRowEditModal: function () {
        $('#ri_RowEditModal').removeClass('show').attr('aria-hidden', 'true').css('display', 'none');
        $('body').removeClass('modal-open');
        $('#ri_RowEditModalBackdrop').remove();
        this.rowEditState = null;
    },

    hasUnsavedRowEditChanges: function () {
        if (!this.rowEditState || !this.rowEditState.drafts || !this.rowEditState.originals) return false;

        var drafts = this.rowEditState.drafts;
        var originals = this.rowEditState.originals;
        if (drafts.length !== originals.length) return true;

        for (var i = 0; i < drafts.length; i++) {
            if (drafts[i].content !== originals[i].content || drafts[i].score !== originals[i].score) {
                return true;
            }
        }

        return false;
    },

    requestCloseRowEditModal: function () {
        if (!this.rowEditState) {
            this.closeRowEditModal();
            return;
        }

        this.syncActiveRowEditDraft();

        if (!this.hasUnsavedRowEditChanges()) {
            this.closeRowEditModal();
            return;
        }

        eXe.app.confirm(
            _('Attention'),
            _('There are unsaved changes in this row. Close and lose them?'),
            function () {
                $exeDevice.closeRowEditModal();
            }
        );
    },

    applyRowEditModal: function () {
        if (!this.rowEditState || !this.rowEditState.drafts || this.rowEditState.drafts.length === 0) {
            this.closeRowEditModal();
            return;
        }

        this.syncActiveRowEditDraft();

        for (var i = 0; i < this.rowEditState.drafts.length; i++) {
            var draft = this.rowEditState.drafts[i];
            draft.td.find('input[type="text"]').not('.ri_Weight').first().val(draft.content);
            draft.td.find('input.ri_Weight').first().val(draft.score);
        }

        // Mark current drafts as saved baseline so close won't warn unless new edits are made.
        this.rowEditState.originals = this.rowEditState.drafts.map(function (item) {
            return {
                content: item.content,
                score: item.score,
            };
        });

        this.setMaxScore();
    },

    ensureColumnEditModal: function () {
        var modal = $('#ri_ColumnEditModal');
        if (modal.length === 1) return;

        var html =
            '<div id="ri_ColumnEditModal" class="modal" tabindex="-1" aria-hidden="true">' +
            '<div class="modal-dialog modal-dialog-centered">' +
            '<div class="modal-content">' +
            '<div class="modal-header">' +
            '<h5 id="ri_ColumnEditModalTitle" class="modal-title"></h5>' +
            '<button type="button" id="ri_ColumnEditClose" class="btn-close" aria-label="' +
            _('Close') +
            '"></button>' +
            '</div>' +
            '<div class="modal-body">' +
            '<p id="ri_ColumnEditFirstCellInfo" class="form-text"></p>' +
            '<div class="ri-column-edit-layout">' +
            '<div class="ri-column-edit-fields">' +
            '<p class="ri-column-edit-position-wrap"><span id="ri_ColumnEditPosition" class="ri-column-edit-position"></span></p>' +
            '<div class="mb-3">' +
            '<label for="ri_ColumnEditContent" class="form-label">' +
            _('Descriptor') +
            ':</label>' +
            '<textarea id="ri_ColumnEditContent" rows="3" class="form-control"></textarea>' +
            '</div>' +
            '<div class="mb-3">' +
            '<label for="ri_ColumnEditScore" class="form-label">' +
            _('Score') +
            ':</label>' +
            '<input type="text" id="ri_ColumnEditScore" class="form-control" />' +
            '</div>' +
            '</div>' +
            '<div class="ri-column-edit-nav">' +
            '<button type="button" id="ri_ColumnEditUp" class="btn btn-outline-secondary btn-sm ri-column-nav-btn" title="' +
            _('Up') +
            '" aria-label="' +
            _('Up') +
            '"><span aria-hidden="true">&#8593;</span><span class="sr-av">' +
            _('Up') +
            '</span></button>' +
            '<button type="button" id="ri_ColumnEditDown" class="btn btn-outline-secondary btn-sm ri-column-nav-btn" title="' +
            _('Down') +
            '" aria-label="' +
            _('Down') +
            '"><span aria-hidden="true">&#8595;</span><span class="sr-av">' +
            _('Down') +
            '</span></button>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '<div class="modal-footer">' +
            '<button type="button" id="ri_ColumnEditAccept" class="btn btn-primary">' +
            _('Save') +
            '</button>' +
            '<button type="button" id="ri_ColumnEditCancel" class="btn btn-secondary">' +
            _('Close') +
            '</button>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>';

        $('#ri_TableEditor').append(html);

        $('#ri_ColumnEditAccept').off('click').on('click', function () {
            $exeDevice.applyColumnEditModal();
            return false;
        });
        $('#ri_ColumnEditCancel').off('click').on('click', function () {
            $exeDevice.requestCloseColumnEditModal();
            return false;
        });
        $('#ri_ColumnEditClose').off('click').on('click', function () {
            $exeDevice.requestCloseColumnEditModal();
            return false;
        });
        $('#ri_ColumnEditUp').off('click').on('click', function () {
            $exeDevice.navigateColumnEditModal(-1);
            return false;
        });
        $('#ri_ColumnEditDown').off('click').on('click', function () {
            $exeDevice.navigateColumnEditModal(1);
            return false;
        });
        $('#ri_ColumnEditContent,#ri_ColumnEditScore')
            .off('input')
            .on('input', function () {
                $exeDevice.syncActiveColumnEditDraft();
            });
    },

    openColumnEditModal: function (th) {
        if (!th || th.length !== 1) return;

        var colIndex = th.prevAll('th').length;
        if (colIndex === 0) return;

        this.ensureColumnEditModal();

        var titleInput = th.find('input[type="text"]').first();
        var drafts = [];
        $('#ri_Table tbody tr').each(function () {
            var td = $(this).find('td').eq(colIndex - 1);
            if (td.length !== 1) return;
            drafts.push({
                td: td,
                content: td.find('input[type="text"]').not('.ri_Weight').first().val() || '',
                score: td.find('input.ri_Weight').first().val() || '',
            });
        });
        if (drafts.length === 0) return;

        this.columnEditState = {
            th: th,
            colIndex: colIndex,
            title: titleInput.val() || '',
            drafts: drafts,
            originals: drafts.map(function (item) {
                return {
                    content: item.content,
                    score: item.score,
                };
            }),
            activeIndex: 0,
        };

        $('#ri_ColumnEditModalTitle').text(this.columnEditState.title || _('Edit'));
        this.renderColumnEditModalFields();

        $('#ri_ColumnEditModal').addClass('show').attr('aria-hidden', 'false').css('display', 'block');
        $('body').addClass('modal-open');
        if ($('#ri_ColumnEditModalBackdrop').length === 0) {
            $('body').append('<div id="ri_ColumnEditModalBackdrop" class="modal-backdrop fade show"></div>');
        }
        $('#ri_ColumnEditContent').focus();
    },

    renderColumnEditModalFields: function () {
        if (!this.columnEditState || !this.columnEditState.drafts || this.columnEditState.drafts.length === 0) return;

        var index = this.columnEditState.activeIndex;
        var total = this.columnEditState.drafts.length;
        var active = this.columnEditState.drafts[index];
        var first = this.columnEditState.drafts[0];

        $('#ri_ColumnEditContent').val(active.content || '');
        $('#ri_ColumnEditScore').val(active.score || '');

        $('#ri_ColumnEditFirstCellInfo').text(
            _('First row') +
                ': ' +
                (first.content || '-') +
                ' (' +
                (first.score || '-') +
                ')'
        );
        $('#ri_ColumnEditPosition').text(index + 1 + ' / ' + total);
        $('#ri_ColumnEditUp').prop('disabled', index === 0);
        $('#ri_ColumnEditDown').prop('disabled', index === total - 1);
    },

    syncActiveColumnEditDraft: function () {
        if (!this.columnEditState || !this.columnEditState.drafts || this.columnEditState.drafts.length === 0) return;

        var index = this.columnEditState.activeIndex;
        this.columnEditState.drafts[index].content = $('#ri_ColumnEditContent').val() || '';
        this.columnEditState.drafts[index].score = $('#ri_ColumnEditScore').val() || '';

        this.renderColumnEditModalFields();
    },

    navigateColumnEditModal: function (delta) {
        if (!this.columnEditState || !this.columnEditState.drafts || this.columnEditState.drafts.length === 0) return;

        this.syncActiveColumnEditDraft();

        var nextIndex = this.columnEditState.activeIndex + delta;
        if (nextIndex < 0 || nextIndex >= this.columnEditState.drafts.length) return;

        this.columnEditState.activeIndex = nextIndex;
        this.renderColumnEditModalFields();
    },

    closeColumnEditModal: function () {
        $('#ri_ColumnEditModal').removeClass('show').attr('aria-hidden', 'true').css('display', 'none');
        $('body').removeClass('modal-open');
        $('#ri_ColumnEditModalBackdrop').remove();
        this.columnEditState = null;
    },

    hasUnsavedColumnEditChanges: function () {
        if (!this.columnEditState || !this.columnEditState.drafts || !this.columnEditState.originals) return false;

        var drafts = this.columnEditState.drafts;
        var originals = this.columnEditState.originals;
        if (drafts.length !== originals.length) return true;

        for (var i = 0; i < drafts.length; i++) {
            if (drafts[i].content !== originals[i].content || drafts[i].score !== originals[i].score) {
                return true;
            }
        }

        return false;
    },

    requestCloseColumnEditModal: function () {
        if (!this.columnEditState) {
            this.closeColumnEditModal();
            return;
        }

        this.syncActiveColumnEditDraft();

        if (!this.hasUnsavedColumnEditChanges()) {
            this.closeColumnEditModal();
            return;
        }

        eXe.app.confirm(
            _('Attention'),
            _('There are unsaved changes in this column. Close and lose them?'),
            function () {
                $exeDevice.closeColumnEditModal();
            }
        );
    },

    applyColumnEditModal: function () {
        if (!this.columnEditState || !this.columnEditState.drafts || this.columnEditState.drafts.length === 0) {
            this.closeColumnEditModal();
            return;
        }

        this.syncActiveColumnEditDraft();

        for (var i = 0; i < this.columnEditState.drafts.length; i++) {
            var draft = this.columnEditState.drafts[i];
            draft.td.find('input[type="text"]').not('.ri_Weight').first().val(draft.content);
            draft.td.find('input.ri_Weight').first().val(draft.score);
        }

        this.columnEditState.originals = this.columnEditState.drafts.map(function (item) {
            return {
                content: item.content,
                score: item.score,
            };
        });

        this.setMaxScore();
    },

    // Remove any HTML tags
    removeTags: function (str) {
        var wrapper = $('<div></div>');
        wrapper.html(str);
        return wrapper.text();
    },

    // Transform the editable table into a normal one
    makeNormal: function () {
        var cells = this.cells;
        cells.each(function (i) {
            var id, val;
            var html = this.innerHTML;
            var tmp = $('<div></div>');
            tmp.html(html);
            $('label', tmp).remove();
            var inputs = $('input', tmp);
            if (inputs.length == 1) {
                id = inputs.eq(0).attr('id');
                html = $('#' + id).val();
            } else if (inputs.length == 2) {
                id = inputs.eq(0).attr('id');
                html = $('#' + id).val();
                id = inputs.eq(1).attr('id');
                html += ' <span>(' + $('#' + id).val() + ')</span>';
            }
            this.innerHTML = html;
        });
    },
};
