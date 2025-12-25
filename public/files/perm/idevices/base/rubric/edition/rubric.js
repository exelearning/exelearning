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
        //** eXeLearning idevice engine data ***************************
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        //**************************************************************
        // Create the edition form (#ri_RubricsEditor)
        // All the form will be created each time a default rubric is loaded or when editing an existing rubric
        // The editable table and the "Rubric information" fieldset will be in #ri_RubricsEditor
        // TODO: lightbox. target="_blank" at the moment.
        var html =
            '\
      <div class="exe-info">' +
            _(
                'Complete the table to define a scoring guide. Define the score or value of each descriptor.'
            ) +
            ' <a href="https://youtu.be/T_QtGkH68EY?t=92" target="_blank" hreflang="es" rel="lightbox">' +
            _('Learn how to apply a rubric') +
            '</a>.</div>\
      <div id="ri_RubricsEditor"></div>\
      <div id="ri_PreviousContent"></div>\
    ';
        this.ideviceBody.innerHTML = html;

        // Get original data (the iDevice content) and put it in #ri_PreviousContent
        var originalHTML = this.idevicePreviousData;
        $('#ri_PreviousContent').html(originalHTML);

        // Save the content in a JSON object (the Rubric information won't be in it yet)
        var data = this.tableToJSON('ri_PreviousContent');

        this.resetForm(true);

        if (data) {
            var block, tmp;

            // Rubric instructions
            block = $('.exe-rubrics-instructions', div);
            if (block.length == 1) {
                data.instructions = block.text();
            }

            // Rubric information
            var div = $('#ri_PreviousContent');
            var author = '';
            var authorURL = '';
            var license = '';
            var visibleInfo = true;

            block = $('.exe-rubrics-authorship', div);
            if (block.length == 1) {
                // Visibility
                if (block.hasClass('sr-av')) var visibleInfo = false;
                // Author
                tmp = $('span.author', block);
                if (tmp.length == 1) {
                    tmp = tmp.eq(0);
                    author = tmp.text();
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
                    tmp = tmp.eq(0);
                    tmp = tmp.text();
                    if (tmp.indexOf('CC ') == 0) {
                        license = tmp.replace('CC ', 'CC-');
                    }
                } else {
                    tmp = $('span.license', block);
                    if (tmp.length == 1) {
                        tmp = tmp.eq(0);
                        tmp = tmp.text();
                        if (tmp == 'GNU/GPL') license = 'gnu-gpl';
                        else if (tmp == _('All Rights Reserved'))
                            license = 'copyright';
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
                    var c = e.attr('class');
                    var t = e.text();
                    data.i18n[c] = t;
                });
            }

            this.jsonToTable(data, 'edition');
            this.originalData = data;
        }
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

    // Enable the FIELDSETs Toggler (see authoring.js)
    enableFieldsetToggle: function () {
        $('#ri_RubricInformation legend a').click(function () {
            $('#ri_RubricInformation').toggleClass('exe-fieldset-closed');
            return false;
        });
        $('#ri_RubricIntro legend a').click(function () {
            $('#ri_RubricIntro').toggleClass('exe-fieldset-closed');
            return false;
        });
    },

    // Create the form to edit the rubric (each time a rubric is selected or when editing an existing one)
    resetForm: function (createEditor) {
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

        // The first time the form is created, we add the table editor right after it
        if (createEditor == true) ed.after('<div id="ri_TableEditor"></div>');
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
            var instructions = $('#ri_RubricInstructions').val();
            if (instructions != '')
                intro =
                    '<p class="exe-rubrics-instructions">' +
                    instructions +
                    '</p>';

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

            return intro + table + info + lang;
        }

        var html = '';

        html +=
            '<div class="exe-form-tab" title="' + _('General settings') + '">';

        // Rubric use instructions
        var instructions = '';
        if (data.instructions) instructions = data.instructions;
        html +=
            '\
        <fieldset id="ri_RubricIntro" class="exe-fieldset exe-feedback-fieldset exe-fieldset-closed">\
          <legend><a href="#">' +
            _('Instructions') +
            '</a></legend>\
          <div>\
            <p class="exe-text-field">\
              <label for="ri_RubricInstructions">' +
            _('Rubric use instructions (optional)') +
            ': </label>\
              <input type="text" id="ri_RubricInstructions" value="' +
            instructions +
            '" />\
            </p>\
          </div>\
        </fieldset>';

        html += table;

        // Max score + Buttons (reset, add row, add column)
        html +=
            '<p>\
        <label for="ri_MaxScore">' +
            _('Maximum score:') +
            '</label> <input type="text" id="ri_MaxScore" readonly="readonly" value="" /> <span id="ri_MaxScoreInstructions">' +
            _('The result of adding the scores of the first level.') +
            '</span>\
        <input type="button" id="ri_AppendCol" value="' +
            _('New column') +
            '" />\
        <input type="button" id="ri_AppendRow" value="' +
            _('New row') +
            '" />\
        <input type="button" id="ri_Reset" value="' +
            _('Reset') +
            '" />\
      </p>';

        // Rubric information
        var author = '';
        var authorLink = '';
        var license = '';
        if (data.author) author = data.author;
        if (data['author-url']) authorLink = data['author-url'];
        if (data.license) license = data.license;
        html +=
            '\
        <fieldset id="ri_RubricInformation" class="exe-fieldset exe-feedback-fieldset exe-fieldset-closed">\
          <legend><a href="#">' +
            _('Rubric information') +
            '</a></legend>\
          <div>\
            <p><label for="ri_ShowRubricInfo"><input type="checkbox" id="ri_ShowRubricInfo" /> ' +
            _('Show rubric information') +
            '</label></p>\
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
        </fieldset>';

        html += '</div>'; // / .exe-form-tab (General settings)

        // Language tab (i18n)
        html += $exeDevicesEdition.iDevice.gamification.common.getLanguageTab(
            this.ci18n
        );

        var ed = $('#ri_TableEditor');
        this.editor = ed;
        ed.html(html);

        // Set the custom strings
        if (data.i18n) {
            var strings = data.i18n;
            for (var z in strings) {
                $('#ci18n_' + z).val(strings[z]);
            }
        }

        // Enable the tabs
        $exeDevicesEdition.iDevice.tabs.init('ri_TableEditor');

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

        // Should the rubric information be visible?
        var showRubricInfo = true;
        if (data['visible-info'] == false) showRubricInfo = false;
        $('#ri_ShowRubricInfo').prop('checked', showRubricInfo);

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

        // Get the rubic instructions and add the to the data
        var instructions = $('#ri_RubricInstructions').val();
        if (instructions != '') data.instructions = instructions;

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
            }
        });

        // Add row buttons (move up, mode down, delete row)
        var trActions =
            '<span class="ri_Actions">\
        <a href="#" class="ri_MoveTRUp" title="' +
            _('Up') +
            '"><span class="sr-av">&#8593;</span></a> \
        <a href="#" class="ri_MoveTRDown" title="' +
            _('Down') +
            '"><span class="sr-av">&#8595;</span></a> \
        <a href="#" class="ri_DeleteTR" title="' +
            _('Delete') +
            '"><span class="sr-av">&#120;</span></a> \
      </span>';
        $('tbody tr', this.editor).each(function () {
            $(this.firstChild).prepend(trActions);
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

        // Add column buttons (move left, move right, delete)
        var thActions =
            '<span class="ri_Actions">\
        <a href="#" class="ri_MoveTRToTheLeft" title="' +
            _('Left') +
            '"><span class="sr-av">&#8592;</span></a> \
        <a href="#" class="ri_MoveTRToTheRight" title="' +
            _('Right') +
            '"><span class="sr-av">&#8594;</span></a> \
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
