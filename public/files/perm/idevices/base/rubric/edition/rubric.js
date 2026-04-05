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
        rubric: c_('Rubric'),
        activity: c_('Activity'),
        name: c_('Name'),
        date: c_('Date'),
        score: c_('Score'),
        notes: c_('Notes'),
        download: c_('Download'),
        msgDelete: c_('Are you sure you want clear all form fields?'),
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
        this.removeLegacyRenderedArtifacts();
        this.createForm();
    },

    removeLegacyRenderedArtifacts: function () {
        if (!this.ideviceBody) return;

        var container = $(this.ideviceBody).closest('.idevice_node.rubric');
        if (container.length !== 1) return;

        // Legacy/export wrappers can survive in the node root and overlap the edition form.
        container
            .children('.exe-rubrics-wrapper, .exe-rubrics-content')
            .remove();
    },

    createForm: function () {
        // Only one Rubric iDevice per page.
        if ($('.iDevice_wrapper.rubricIdevice').length > 0) {
            this.ideviceBody.innerHTML =
                '<p>' +
                _('You can only add one Rubric iDevice per page.') +
                '</p>';
            return;
        }

        const html = `
            <div id="ri_IdeviceForm">
                <p class="exe-block-info exe-block-dismissible">
                    ${_('Complete the table to define a scoring guide. Define the score or value of each descriptor.')}
                    <a href="https://youtu.be/T_QtGkH68EY?t=92" target="_blank" hreflang="es" rel="lightbox">${_('Learn how to apply a rubric')}</a>.
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Complete the following rubric'))}
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
                <div class="exe-form-tab" title="${_('CSV import/export')}">
                    <fieldset class="exe-fieldset">
                        <legend><a href="#">${_('CSV import/export')}</a></legend>
                        <div id="ri_CsvTools">
                            <p class="exe-block-info">
                                ${_('You can import rubric data from CSV files.')}
                            </p>
                            <div class="ri-csv-import">
                                <form method="POST">
                                    <div class="exe-file-upload" data-exe-upload>
                                        <label for="ri_CsvFile" class="form-label mb-1">${_('Import')}: </label>
                                        <input type="file" id="ri_CsvFile" accept=".csv,text/csv" class="exe-file-input" />
                                        <button type="button" class="btn btn-primary exe-file-btn" data-exe-file-trigger>${_('Choose')}</button>
                                        <span class="exe-file-name" data-exe-file-name>${_('No file selected')}</span>
                                        <span class="exe-field-instructions d-block mt-1">${_('Supported formats')}: csv</span>
                                    </div>
                                </form>
                            </div>
                            <p class="exe-block-info mt-3">
                                ${_('You can export the rubric in CSV format to integrate it into other compatible activities.')}
                            </p>
                            <p class="ri-csv-export-actions d-flex align-items-center justify-content-start gap-1 mb-0">
                                <input type="button" id="ri_ExportCsv" class="btn btn-primary" value="${_('Export CSV')}" />
                            </p>
                        </div>
                    </fieldset>
                </div>
                ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
            </div>
        `;
        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('ri_IdeviceForm');
        this.renderRubricTemplateControls();
        this.loadPreviousValues();
        this.initCSVTabControls();
    },

    loadPreviousValues: function () {
        var originalHTML = this.idevicePreviousData;
        if (!originalHTML) return;

        // Parse previous HTML in-memory to avoid rendering legacy/export markup during edition.
        var div = $('<div></div>').html(originalHTML);
        var dataFromDataGame = this.getStoredRubricData(div);
        var data = dataFromDataGame;
        if (!dataFromDataGame) {
            data = this.tableToJSON(div);
        }
        if (!data) return;

        var block, tmp;

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

        if (data.instructions) {
            $('#eXeGameInstructions').val(data.instructions);
        }
        if (data.textAfter) {
            $('#eXeIdeviceTextAfter').val(data.textAfter);
        }

        this.originalData = data;
    },

    getStoredRubricData: function (container) {
        var node = $('.exe-rubrics-DataGame', container).first();
        if (node.length !== 1) return null;

        var encoded = node.text() || '';
        if (encoded === '') return null;

        var raw = this.decodeEscapedHTML(encoded);
        if (raw === '') raw = encoded;

        try {
            var parsed = JSON.parse(raw);
            parsed = this.normalizeStoredRubricData(parsed);
            if (!parsed) return null;
            return parsed;
        } catch (e) {
            return null;
        }
    },

    normalizeStoredRubricData: function (data) {
        if (!data || typeof data !== 'object') return null;

        var sourceTable = null;
        if (data.table && typeof data.table === 'object') {
            sourceTable = data.table;
        } else {
            sourceTable = data;
        }

        if (!Array.isArray(sourceTable.categories) || !Array.isArray(sourceTable.scores) || !Array.isArray(sourceTable.descriptions)) {
            return null;
        }

        var normalized = $.extend(true, {}, data);
        normalized.table = {
            title: sourceTable.title || '',
            categories: sourceTable.categories,
            scores: sourceTable.scores,
            descriptions: sourceTable.descriptions,
        };
        normalized.title = normalized.table.title;
        normalized.categories = normalized.table.categories;
        normalized.scores = normalized.table.scores;
        normalized.descriptions = normalized.table.descriptions;

        return normalized;
    },

    getIdeviceID: function () {
        var ideviceid =
            $('#ri_IdeviceForm')
                .closest('div.idevice_node.rubric')
                .attr('id') || '';

        return ideviceid;
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
    renderRubricTemplateControls: function () {
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
            rubric: 'Rubric',
            activity: 'Activity',
            name: 'Name',
            date: 'Date',
            score: 'Score',
            notes: 'Notes',
            download: 'Download',
            msgDelete: 'Are you sure you want clear all form fields?',
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

    initCSVTabControls: function () {
        var $csvTools = $('#ri_CsvTools');
        var $csvFile = $csvTools.find('#ri_CsvFile');
        var $csvUploadWrap = $csvTools.find('[data-exe-upload]').first();
        var $csvFileName = $csvUploadWrap.find('[data-exe-file-name]').first();

        $csvUploadWrap
            .find('[data-exe-file-trigger]')
            .off('click.rubricCsv')
            .on('click.rubricCsv', function () {
                $csvFile.trigger('click');
                return false;
            });

        $csvFile.off('change.rubricCsv').on('change.rubricCsv', function () {
            var fileName = _('No file selected');
            if (this.files && this.files.length === 1 && this.files[0]) {
                fileName = this.files[0].name || fileName;
            }
            if ($csvFileName.length === 1) {
                $csvFileName.text(fileName);
            }

            if (!this.files || this.files.length !== 1) return;
            $exeDevice.readCSVFile(this.files[0]);
        });

        $('#ri_ExportCsv').off('click.rubricCsv').on('click.rubricCsv', function () {
            $exeDevice.exportCSV();
            return false;
        });
    },

    readCSVFile: function (file) {
        if (!file) return;
        if (!this.isCSVFile(file)) {
            this.alert(_('Only CSV files are allowed.'));
            return;
        }
        var reader = new FileReader();
        reader.onload = function (ev) {
            var csv = ev && ev.target ? ev.target.result : '';
            if (typeof csv !== 'string') csv = '';
            $exeDevice.importCSV(csv);
        };
        reader.onerror = function () {
            $exeDevice.alert(_('Could not read the selected CSV file.'));
        };
        reader.readAsText(file, 'utf-8');
    },

    isCSVFile: function (file) {
        if (!file) return false;
        var fileName = (file.name || '').toLowerCase();
        var fileType = (file.type || '').toLowerCase();
        var hasCsvExtension = /\.csv$/i.test(fileName);
        var hasCsvMime = fileType === 'text/csv' || fileType === 'application/csv';
        // Some browsers provide an empty MIME type for local files.
        return hasCsvExtension || hasCsvMime;
    },

    importCSV: function (csvText) {
        var parsed;
        try {
            parsed = this.csvToRubricData(csvText);
        } catch (e) {
            this.alert(e && e.message ? e.message : _('Invalid CSV format.'));
            return;
        }

        if (!parsed.title || parsed.title.trim() === '') {
            parsed.title = c_('Imported rubric');
        }

        this.clearCurrentRubricEdition();
        this.jsonToTable(parsed, 'edition');
        this.enableFieldsetToggle();
        this.setEditionFocus();
        this.alert(_('CSV imported successfully.'));
    },

    clearCurrentRubricEdition: function () {
        if (this.editor && this.editor.length === 1) {
            this.editor.empty();
        }
        this.cells = null;
    },

    exportCSV: function () {
        var data = this.tableEditorToJSON();
        if (!data || !data.categories || data.categories.length === 0) {
            this.alert(_('There is no rubric to export.'));
            return;
        }

        var csv = this.rubricDataToCSV(data);

        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'rubric.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    tableEditorToJSON: function () {
        var table = $('#ri_TableEditor table').first();
        if (table.length !== 1) return null;
        var self = this;

        var data = {
            title: '',
            categories: [],
            scores: [],
            descriptions: [],
        };

        var captionInput = $('caption input[type="text"]', table).first();
        if (captionInput.length === 1) {
            data.title = this.removeTags(captionInput.val() || '');
        }

        var thInputs = $('thead th input[type="text"]', table);
        thInputs.each(function (index) {
            // Skip first hidden corner header cell.
            if (index === 0) return;
            data.scores.push(self.removeTags($(this).val() || ''));
        });

        $('tbody tr', table).each(function () {
            var row = $(this);
            var categoryInput = $('th input[type="text"]', row).first();
            var category = self.removeTags(categoryInput.val() || '');
            if (category === '') return;

            data.categories.push(category);

            var descriptors = [];
            $('td', row).each(function () {
                var td = $(this);
                var textInput = td.find('input[type="text"]').not('.ri_Weight').first();
                var weightInput = td.find('input.ri_Weight').first();

                descriptors.push({
                    weight: self.removeTags(weightInput.val() || ''),
                    text: self.sanitizeDescriptorHtml(textInput.val() || ''),
                });
            });

            data.descriptions.push(descriptors);
        });

        if (data.categories.length === 0) return null;
        return data;
    },

    csvToRubricData: function (csvText) {
        if (typeof csvText !== 'string' || csvText.trim() === '') {
            throw new Error(_('Please provide CSV content.'));
        }

        var normalized = csvText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        var lines = normalized.split('\n').filter(function (line) {
            return line.trim() !== '';
        });
        if (lines.length < 2) {
            throw new Error(_('The CSV must include a header row and at least one data row.'));
        }

        var rows = [];
        for (var i = 0; i < lines.length; i++) {
            rows.push(this.parseCSVLine(lines[i]));
        }

        var header = rows[0].map(function (cell) {
            return cell.trim();
        });

        var hasDescriptionColumn = header.length > 1 && /(descrip|description)/i.test(header[1]);
        var hasWeightColumn = header.length > 2 && /(peso|weight)/i.test(header[header.length - 1]);
        var scoreStart = hasDescriptionColumn ? 2 : 1;
        var scoreEnd = hasWeightColumn ? header.length - 1 : header.length;
        if (scoreEnd <= scoreStart) {
            throw new Error(_('The CSV must include at least one score column.'));
        }

        var scores = header.slice(scoreStart, scoreEnd);
        var headerWeights = [];
        for (var s = 0; s < scores.length; s++) {
            var match = scores[s].match(/\(([^)]+)\)\s*$/);
            headerWeights.push(match ? this.normalizeNumericValue(match[1]) : '');
        }

        var data = {
            title: '',
            categories: [],
            scores: scores,
            descriptions: [],
        };

        for (var r = 1; r < rows.length; r++) {
            var row = rows[r];
            while (row.length < header.length) row.push('');

            var categoryRaw = (row[0] || '').trim();
            if (categoryRaw === '') continue;

            var parsedCategory = this.parseCsvCriterionAndScore(categoryRaw);
            var category = parsedCategory.text;
            var criterionScore = parsedCategory.score;

            var descriptionCol = hasDescriptionColumn ? (row[1] || '').trim() : '';
            var rowWeight = hasWeightColumn
                ? this.normalizeNumericValue(row[header.length - 1])
                : '';

            var descriptors = [];
            for (var c = 0; c < scores.length; c++) {
                var txtRaw = (row[scoreStart + c] || '').trim();
                var parsedDescriptor = this.parseCsvDescriptorAndScore(txtRaw);
                var txt = parsedDescriptor.text;
                if (txt === '' && c === 0 && descriptionCol !== '') txt = descriptionCol;
                descriptors.push({
                    weight:
                        parsedDescriptor.score ||
                        headerWeights[c] ||
                        rowWeight ||
                        criterionScore,
                    text: txt,
                });
            }

            data.categories.push(category);
            data.descriptions.push(descriptors);
        }

        if (data.categories.length === 0) {
            throw new Error(_('No rubric rows could be imported from the CSV.'));
        }

        return data;
    },

    rubricDataToCSV: function (data) {
        var headers = ['Criterio', 'Descripción'];
        for (var i = 0; i < data.scores.length; i++) {
            headers.push(this.csvPlainText(data.scores[i]));
        }
        headers.push('Peso (%)');

        var rows = [headers];
        for (var r = 0; r < data.categories.length; r++) {
            var row = [];
            var descriptors = data.descriptions[r] || [];
            row.push(this.csvPlainText(data.categories[r] || ''));
            row.push(
                this.csvDescriptorText(
                    descriptors[0] ? descriptors[0].text || '' : '',
                    descriptors[0] ? descriptors[0].weight || '' : ''
                )
            );

            var rowWeight = '';
            for (var c = 0; c < data.scores.length; c++) {
                var cell = descriptors[c] || { text: '', weight: '' };
                row.push(this.csvDescriptorText(cell.text || '', cell.weight || ''));
                if (rowWeight === '' && cell.weight) rowWeight = this.csvPlainText(cell.weight);
            }
            row.push(rowWeight);
            rows.push(row);
        }

        var csvRows = [];
        for (var z = 0; z < rows.length; z++) {
            var encoded = [];
            for (var j = 0; j < rows[z].length; j++) {
                encoded.push(this.encodeCSVCell(rows[z][j]));
            }
            csvRows.push(encoded.join(','));
        }
        return csvRows.join('\n');
    },

    parseCsvCriterionAndScore: function (value) {
        var plain = this.csvPlainText(value);
        if (plain === '') {
            return { text: '', score: '' };
        }

        var match = plain.match(/^(.*?)\s*#\s*([-+]?[0-9]+(?:[.,][0-9]+)?)\s*$/);
        if (!match) {
            return { text: plain, score: '' };
        }

        var text = match[1].trim();
        var score = this.normalizeNumericValue(match[2]);
        return { text: text, score: score };
    },

    parseCsvDescriptorAndScore: function (value) {
        var plain = this.csvPlainText(value);
        if (plain === '') {
            return { text: '', score: '' };
        }

        var match = plain.match(/^(.*?)\s*#\s*([-+]?[0-9]+(?:[.,][0-9]+)?)\s*$/);
        if (!match) {
            return { text: plain, score: '' };
        }

        return {
            text: match[1].trim(),
            score: this.normalizeNumericValue(match[2]),
        };
    },

    csvDescriptorText: function (value, score) {
        var parsed = this.parseCsvDescriptorAndScore(value);
        var text = parsed.text;
        var resolvedScore = parsed.score || this.normalizeNumericValue(score);

        if (text === '') return '';
        if (resolvedScore === '') return text;
        return text + '#' + resolvedScore;
    },

    csvCriterionText: function (value) {
        var plain = this.csvPlainText(value);
        if (plain === '') return '';

        var scoreMatch = null;
        var text = plain;

        // "Criterion (4)" => "Criterion#4"
        scoreMatch = text.match(/^(.*)\(([-+]?[0-9]+(?:[.,][0-9]+)?)\)\s*$/);
        if (scoreMatch) {
            text = scoreMatch[1].trim();
            return text + '#' + this.normalizeNumericValue(scoreMatch[2]);
        }

        // "Criterion Puntuacion: 4" / "Criterion Score: 4" => "Criterion#4"
        scoreMatch = text.match(/^(.*?)(?:puntuaci[oó]n|score)\s*:\s*([-+]?[0-9]+(?:[.,][0-9]+)?)\s*$/i);
        if (scoreMatch) {
            text = scoreMatch[1].trim();
            return text + '#' + this.normalizeNumericValue(scoreMatch[2]);
        }

        return plain;
    },

    csvPlainText: function (value) {
        if (value === null || typeof value === 'undefined') return '';

        var wrapper = $('<div></div>');
        wrapper.html(String(value));

        // Exclude interactive controls from CSV output.
        wrapper
            .find('button, input[type="button"], input[type="submit"], input[type="reset"], .btn')
            .remove();

        var text = wrapper.text();
        text = text.replace(/\s+/g, ' ').trim();
        return text;
    },

    parseCSVLine: function (line) {
        var cells = [];
        var value = '';
        var inQuotes = false;

        for (var i = 0; i < line.length; i++) {
            var ch = line.charAt(i);

            if (ch === '"') {
                if (inQuotes && line.charAt(i + 1) === '"') {
                    value += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === ',' && !inQuotes) {
                cells.push(value);
                value = '';
            } else {
                value += ch;
            }
        }

        if (inQuotes) {
            throw new Error(_('Invalid CSV format.'));
        }

        cells.push(value);
        return cells;
    },

    encodeCSVCell: function (value) {
        if (value === null || typeof value === 'undefined') return '';
        value = String(value);
        if (value.indexOf('"') > -1) value = value.replace(/"/g, '""');
        if (/[",\n]/.test(value)) return '"' + value + '"';
        return value;
    },

    normalizeNumericValue: function (value) {
        if (value === null || typeof value === 'undefined') return '';
        value = String(value).trim();
        if (value === '') return '';
        value = value.replace(',', '.');
        var num = parseFloat(value);
        if (isNaN(num)) return '';
        return String(num);
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

        $exeDevice.renderRubricTemplateControls();

        $('#ri_LoadCEDECRubrics').remove();
        $('#ri_NewTableOptions').show();
    },

    // After adding a new table, change the focus to the first visible INPUT so the user knows what to do
    setEditionFocus: function () {
        $('#ri_Cell-2').select();
    },

    // Get a table and return it as a JSON object.
    // Accepts either a container ID (legacy) or a jQuery/DOM container.
    tableToJSON: function (source) {
        var i,
            z,
            t = $(),
            container = $();

        if (typeof source === 'string') {
            container = $('#' + source);
        } else {
            container = $(source);
        }

        if (container.is('table')) {
            t = container.first();
        } else {
            t = container
                .find('table.exe-rubrics-edition-table, table[data-rubric-table-type="edition"], table.exe-table:not(.exe-rubrics-export-table):not([data-rubric-table-type="export"])')
                .first();
        }

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
        var i, z, c;
        var tableTitle = this.escapeHtml(this.removeTags(data.title || ''));
        var html = "<table class='exe-table exe-rubrics-edition-table' data-rubric-table-type='edition'>";
        html += '<caption>' + tableTitle + '</caption>';
        html += '<thead>';
        html += '<tr>';
        html += '<th>&nbsp;</th>';
        for (i = 0; i < data.scores.length; i++) {
            html += '<th>' + this.escapeHtml(this.removeTags(data.scores[i] || '')) + '</th>';
        }
        html += '</tr>';
        html += '</thead>';
        html += '<tbody>';
        for (i = 0; i < data.descriptions.length; i++) {
            c = data.descriptions[i];
            html += '<tr>';
            html += '<th>' + this.escapeHtml(this.removeTags(data.categories[i] || '')) + '</th>';
            for (z = 0; z < data.scores.length; z++) {
                html += '<td>' + $exeDevice.sanitizeDescriptorHtml(c[z].text || '');
                var safeWeight = this.removeTags(c[z].weight || '');
                if (safeWeight != '')
                    html += ' <span>(' + this.escapeHtml(safeWeight) + ')</span>';
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

    collectRubricStringsFromForm: function () {
        var formScope = $(this.ideviceBody).find('#ri_IdeviceForm').first();
        var scopedFields = $();
        if (formScope.length === 1) {
            scopedFields = formScope.find('input[id^="ci18n_"]');
        }

        if (scopedFields.length > 0) {
            var scopedStrings = {};
            scopedFields.each(function () {
                var id = ($(this).attr('id') || '').trim();
                if (id.indexOf('ci18n_') !== 0) return;

                var key = id.replace(/^ci18n_/, '');
                if (!key) return;

                scopedStrings[key] = $(this).val() || '';
            });
            return scopedStrings;
        }

        var strings = {};
        for (var key in $exeDevice.ci18n) {
            if (!Object.prototype.hasOwnProperty.call($exeDevice.ci18n, key)) continue;
            var customField = $();
            if (formScope.length === 1) {
                customField = formScope.find('#ci18n_' + key).first();
            }
            if (customField.length !== 1) {
                customField = $('#ci18n_' + key).first();
            }
            var translatedValue = $exeDevice.getTranslatedString(key);
            var value = translatedValue;

            if (customField.length === 1 && customField.val() !== '') {
                value = customField.val();
            }

            strings[key] = value;
        }
        return strings;
    },

    buildRubricAuthorshipHTML: function (data) {
        var author = this.removeTags(data.author || '');
        var authorURL = this.sanitizeExternalUrl(data['author-url'] || '');
        var license = data.license || '';
        var infoVisibility = data['visible-info'] ? '' : ' sr-av';
        var title = this.removeTags(data.title || '');

        if (author === '' && authorURL === '' && license === '') return '';

        var info = '<p class="exe-rubrics-authorship' + infoVisibility + '">';
        if (author !== '') {
            if (authorURL !== '') {
                info +=
                    '<a href="' +
                    this.escapeAttribute(authorURL) +
                    '" target="_blank" class="author" rel="noopener">' +
                    this.escapeHtml(author) +
                    '</a>. ';
            } else {
                info += '<span class="author">' + this.escapeHtml(author) + '</span>. ';
            }
        }
        info += '<span class="title"><em>' + this.escapeHtml(title) + '</em></span> ';
        if (license !== '') {
            info += '<span class="license">(';
            if (license.indexOf('CC') === 0) {
                info +=
                    '<a href="https://creativecommons.org/licenses/" rel="license nofollow noopener" target="_blank" title="Creative Commons ' +
                    license +
                    '">' +
                    license.replace('CC-', 'CC ') +
                    '</a>';
            } else if (license === 'gnu-gpl') {
                info += 'GNU/GPL';
            } else if (license === 'copyright') {
                info += _('All Rights Reserved');
            } else if (license === 'pd') {
                info += _('Public Domain');
            }
            info += ')</span>';
        }
        info += '</p>';
        return info;
    },

    buildRubricStringsHTML: function (strings) {
        var lang = '<ul class="exe-rubrics-strings">';
        var map = strings || {};
        for (var key in map) {
            if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
            var safeKey = String(key || '').replace(/[^a-zA-Z0-9_-]/g, '');
            if (!safeKey) continue;
            lang += '<li class="' + safeKey + '">' + this.escapeHtml(map[key]) + '</li>';
        }
        lang += '</ul>';
        return lang;
    },

    buildRichTextDataHTML: function (instructions, textAfter) {
        return (
            '<div class="exe-rubrics-richtext-data sr-av">' +
                '<span class="exe-rubrics-instructions-data">' +
                this.encodeEscapedHTML(instructions || '') +
                '</span>' +
                '<span class="exe-rubrics-text-after-data">' +
                this.encodeEscapedHTML(textAfter || '') +
                '</span>' +
            '</div>'
        );
    },

    buildSerializedRubricHTML: function (data, instructions, textAfter, options) {
        var cfg = options || {};
        var wrapperClass = cfg.wrapperClass || '';
        var includeWrapper = !!cfg.includeWrapper;
        var instructionsClass = cfg.instructionsClass || 'exe-rubrics-instructions';

        var instructionsHTML = (instructions || '').trim() !== ''
            ? '<div class="' + instructionsClass + '">' + (instructions || '') + '</div>'
            : '';
        var textAfterHTML = (textAfter || '').trim() !== ''
            ? '<div class="exe-rubrics-text-after">' + (textAfter || '') + '</div>'
            : '';

        var dataPayload = this.encodeEscapedHTML(JSON.stringify(data));
        var dataBlock =
            '<div class="rubric">' +
                '<div class="exe-rubrics-DataGame js-hidden">' + dataPayload + '</div>' +
                this.buildRubricAuthorshipHTML(data) +
                this.buildRubricStringsHTML(data.i18n) +
            '</div>';

        var body =
            instructionsHTML +
            dataBlock +
            textAfterHTML +
            this.buildRichTextDataHTML(instructions, textAfter);

        if (!includeWrapper) return body;

        return '<div class="' + wrapperClass + '">' + body + '</div>';
    },

    // Tranform the JSON data into:
    // If mode is "normal":  Instructions (optional) + serialized rubric data + the rubric footer (authorship, license...) + Custom strings
    // If mode is "edition": Instructions (fieldset) + A table + The max score input + The buttons to reset and add rows and columns + The "Rubric information" fieldset + The i18n tab
    jsonToTable: function (data, mode) {
        // Create the iDevice content
        if (mode == 'normal') {
            var instrEditor = tinyMCE.get('eXeGameInstructions');
            var instructions = instrEditor ? instrEditor.getContent() : ($('#eXeGameInstructions').val() || '');
            data['visible-info'] = $('#ri_ShowRubricInfo').prop('checked');
            data.author = this.removeTags($('#ri_RubricAuthor').val() || '');
            data['author-url'] = this.sanitizeExternalUrl($('#ri_RubricAuthorURL').val() || '');
            data.license = $('#ri_RubricLicense').val() || '';
            data.i18n = this.collectRubricStringsFromForm();

            var textAfterEditor = tinyMCE.get('eXeIdeviceTextAfter');
            var textAfter = textAfterEditor ? textAfterEditor.getContent() : ($('#eXeIdeviceTextAfter').val() || '');

            return this.buildSerializedRubricHTML(data, instructions, textAfter, {
                includeWrapper: false,
                instructionsClass: 'exe-rubrics-instructions',
            });
        }

        var table = $exeDevice.getTableHTML(data);

        var html = '';

        html += table;

        // Max score + Buttons (reset, add row, add column)
                html +=
                        '<div id="ri_TableControls">\
                <div class="ri-table-controls-left">\
                    <label for="ri_MaxScore">' +
                        _('Maximum score:') +
                        '</label> <input type="text" id="ri_MaxScore" readonly="readonly" aria-readonly="true" value="" /> <span id="ri_MaxScoreInstructions">' +
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
        var authorEscaped = this.escapeAttribute(author);
        var authorLinkEscaped = this.escapeAttribute(authorLink);
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
            authorEscaped +
            '" /> \
            </p>\
            <p>\
              <label for="ri_RubricAuthorURL">' +
            _('Source/Author Link') +
            ':</label> <input type="text" id="ri_RubricAuthorURL" value="' +
            authorLinkEscaped +
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
            var formScope = $(this.ideviceBody).find('#ri_IdeviceForm').first();
            var scopedFields = $();
            if (formScope.length === 1) {
                scopedFields = formScope.find('input[id^="ci18n_"]');
            }

            if (scopedFields.length > 0) {
                scopedFields.each(function () {
                    var id = ($(this).attr('id') || '').trim();
                    if (id.indexOf('ci18n_') !== 0) return;

                    var key = id.replace(/^ci18n_/, '');
                    if (!Object.prototype.hasOwnProperty.call(strings, key)) return;

                    $(this).val(strings[key]);
                });
            } else {
                for (var z in strings) {
                    if (!Object.prototype.hasOwnProperty.call(strings, z)) continue;
                    var customField = $('#ci18n_' + z).first();
                    if (customField.length === 1) {
                        customField.val(strings[z]);
                    }
                }
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
            if (this.id.indexOf('-weight') == -1) {
                this.value = $exeDevice.sanitizeDescriptorHtml(this.value);
            } else {
                this.value = $exeDevice.removeTags(this.value);
            }
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

        var tableData = this.tableEditorToJSON();
        if (!tableData) {
            this.alert(_('The rubric is empty...'));
            return false;
        }

        var data = {
            typeGame: 'Rubric',
            version: 2,
            id:
                this.getIdeviceID() ||
                (this.originalData && this.originalData.id
                    ? this.originalData.id
                    : ''),
            table: tableData,
            // Keep legacy flat fields for backward compatibility.
            title: tableData.title,
            categories: tableData.categories,
            scores: tableData.scores,
            descriptions: tableData.descriptions,
        };

        // Get the rubric instructions and add them to the data
        var instrEditor = tinyMCE.get('eXeGameInstructions');
        var instructions = instrEditor ? instrEditor.getContent() : ($('#eXeGameInstructions').val() || '');
        if (instructions.trim() !== '') data.instructions = instructions;

        // Get the rubric information and add it to data
        data['visible-info'] = $('#ri_ShowRubricInfo').prop('checked');
        var author = this.removeTags($('#ri_RubricAuthor').val() || '');
        if (author != '') data.author = author;
        var authorURL = this.sanitizeExternalUrl($('#ri_RubricAuthorURL').val() || '');
        if (authorURL != '') data['author-url'] = authorURL;
        var license = $('#ri_RubricLicense').val();
        if (license != '') data.license = license;

        data.i18n = this.collectRubricStringsFromForm();

        var textAfterEditor = tinyMCE.get('eXeIdeviceTextAfter');
        var textAfter = textAfterEditor
            ? textAfterEditor.getContent()
            : ($('#eXeIdeviceTextAfter').val() || '');

        return this.buildSerializedRubricHTML(data, instructions, textAfter, {
            includeWrapper: true,
            wrapperClass: 'rubric-IDevice',
            instructionsClass: 'exe-rubrics-instructions gameQP-instructions',
        });
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
                if (html.length === 2) {
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
            var row = $(this).parents('tr:first');
            eXe.app.confirm(_('Row'), _('Delete the row?'), function () {
                row.remove();
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
            var colIndex = $(this).closest('th').prevAll('th').length;
            eXe.app.confirm(_('Column'), _('Delete the column?'), function () {
                $('#ri_Table tr').each(function () {
                    $('th,td', this).each(function (i) {
                        if (i == colIndex) $(this).remove();
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
            _('Assessment criteria') +
            '</h5>' +
            '<button type="button" id="ri_CellEditClose" class="btn-close" aria-label="' +
            _('Close') +
            '"></button>' +
            '</div>' +
            '<div class="modal-body">' +
            '<p id="ri_CellEditPerformanceInfo" class="form-text"></p>' +
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
        var row = td.closest('tr');
        var criterionTitle = row.find('th input[type="text"]').first().val() || '';
        var colIndex = td.prevAll('td').length + 1;
        var columnTitle =
            $('#ri_Table thead th')
                .eq(colIndex)
                .find('input[type="text"]')
                .first()
                .val() || '';

        $('#ri_CellEditContent').val(contentInput.val() || '');
        $('#ri_CellEditScore').val(scoreInput.val() || '');
        $('#ri_CellEditModalTitle').text(
            _('Assessment criteria') + (criterionTitle ? ': ' + criterionTitle : '')
        );
        $('#ri_CellEditPerformanceInfo').text(
            _('Performance level') + (columnTitle ? ': ' + columnTitle : '')
        );

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
        this.closeRowEditModal();
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

    escapeHtml: function (str) {
        var value = typeof str === 'string' ? str : String(str || '');
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    escapeAttribute: function (str) {
        return this.escapeHtml(str);
    },

    sanitizeExternalUrl: function (url) {
        var value = typeof url === 'string' ? url.trim() : '';
        if (value === '') return '';

        // Block executable schemes while keeping regular and relative links working.
        var normalized = value.replace(/[\u0000-\u001F\u007F\s]+/g, '').toLowerCase();
        if (
            normalized.indexOf('javascript:') === 0 ||
            normalized.indexOf('data:') === 0 ||
            normalized.indexOf('vbscript:') === 0
        ) {
            return '';
        }

        return value;
    },

    // Allow only <b>, <i> and <u> in descriptor text; strip all other tags.
    sanitizeDescriptorHtml: function (value) {
        var input = typeof value === 'string' ? value : String(value || '');
        if (input === '') return '';

        var template = document.createElement('template');
        template.innerHTML = input;

        var sanitizeNode = function (node) {
            if (!node) return document.createDocumentFragment();

            if (node.nodeType === Node.TEXT_NODE) {
                return document.createTextNode(node.nodeValue || '');
            }

            if (node.nodeType !== Node.ELEMENT_NODE) {
                return document.createDocumentFragment();
            }

            var tag = String(node.tagName || '').toLowerCase();
            var fragment = document.createDocumentFragment();

            for (var i = 0; i < node.childNodes.length; i++) {
                fragment.appendChild(sanitizeNode(node.childNodes[i]));
            }

            if (tag === 'b' || tag === 'i' || tag === 'u') {
                var allowed = document.createElement(tag);
                allowed.appendChild(fragment);
                return allowed;
            }

            return fragment;
        };

        var output = document.createElement('div');
        for (var i = 0; i < template.content.childNodes.length; i++) {
            output.appendChild(sanitizeNode(template.content.childNodes[i]));
        }

        return output.innerHTML;
    },

    // Transform the editable table into a normal one
    makeNormal: function () {
        var cells = this.cells;
        if (!cells || typeof cells.each !== 'function' || cells.length === 0) return;
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
                html = $exeDevice.sanitizeDescriptorHtml($('#' + id).val());
                id = inputs.eq(1).attr('id');
                html += ' <span>(' + $('#' + id).val() + ')</span>';
            }
            this.innerHTML = html;
        });
    },
};
