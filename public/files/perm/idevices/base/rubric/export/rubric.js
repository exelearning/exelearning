/**
 * Rubrics iDevice
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Ignacio Gros (http://gros.es/) for http://exelearning.net/
 *
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */

var $rubric = {
    // Default strings
    ci18n: {
        rubric: 'Rubric',
        error: 'Error',
        onlyOne: 'Only one rubric per page.',
        activity: 'Activity',
        name: 'Name',
        fullName: 'Name and surname',
        date: 'Date',
        score: 'Score',
        download: 'Download',
        calculateScore: 'Calculate score',
        notes: 'Notes',
        msgDelete: 'Are you sure you want clear all form fields?',
        reset: 'Reset',
        print: 'Print',
        apply: 'Apply',
        newWindow: 'New Window',
    },
    idevicePath: '',
    options: [],
    activities: $(),
    initialized: false,

    init: function () {
        if (this.initialized) return;
        this.initialized = true;
        this.loadGame();
    },

    loadGame: function () {
        // Legacy migration path:
        // If a rubric scope has interface/table markup but no DataGame payload,
        // rebuild DataGame first and clean the old interface so the runtime can
        // render everything from the generated DataGame.
        this.rebuildMissingDataGameFromInterface();

        this.options = [];
        this.activities = this.getActivitiesFromDataGame();

        if (this.activities.length === 0) return;
        if (this.activities.length > 1) {
            var msg =
                (this.ci18n.error || 'Error') +
                ' - ' +
                (this.ci18n.onlyOne || 'Only one rubric per page.');
            if (
                typeof eXe !== 'undefined' &&
                eXe.app &&
                typeof eXe.app.alert === 'function'
            ) {
                eXe.app.alert(msg);
            } else {
                alert(msg);
            }
            return false;
        }

        var self = this;
        this.activities.each(function (i) {
            var scope = $(this);
            var data = self.getGameData(scope, i);
            if (!data) return;

            self.options.push(data);

            self.createInterface(data);
            self.prepareInteractiveTable(data.table, data.scopeId, data.strings);
            self.initializeInteractiveState(data.table);
            self.addEvents(data.table, data.strings);
        });
    },

    rebuildMissingDataGameFromInterface: function () {
        var self = this;
        var migrated = 0;

        this.getLegacyScopesWithoutDataGame().each(function () {
            var scope = $(this);
            var data = self.extractDataGameFromLegacyInterface(scope);
            if (!data) return;

            self.injectDataGame(scope, data);
            self.clearLegacyInterfaceArtifacts(scope);
            migrated++;
        });
    },

    getLegacyScopesWithoutDataGame: function () {
        var scopes = [];
        var seen = [];

        function tryAddScope($scope) {
            if (!$scope || $scope.length !== 1) return;

            var domNode = $scope.get(0);
            if (seen.indexOf(domNode) !== -1) return;

            var hasDataGame = $scope.find('.exe-rubrics-DataGame').length > 0;
            if (hasDataGame) return;

            var hasTable =
                $scope.find('table.exe-table, table[data-rubric-table-type], table.exe-rubrics-export-table').length > 0;
            if (!hasTable) return;

            seen.push(domNode);
            scopes.push(domNode);
        }

        $('.idevice_node.rubric').each(function () {
            tryAddScope($(this));
        });

        // Fallback for standalone rubric containers not wrapped by .idevice_node
        $('.rubric').each(function () {
            var scope = $(this);
            if (scope.closest('.idevice_node.rubric').length > 0) return;
            tryAddScope(scope);
        });

        return $(scopes);
    },

    extractDataGameFromLegacyInterface: function (scope) {
        var $scope = $(scope);
        if ($scope.length !== 1) return null;

        var $table = $scope
            .find('table.exe-table, table[data-rubric-table-type], table.exe-rubrics-export-table')
            .first();
        if ($table.length !== 1) return null;

        var title = ($table.find('caption').first().text() || '').trim();

        var scores = [];
        $table.find('thead tr').first().children('th,td').each(function (index) {
            if (index === 0) return;
            scores.push(($(this).text() || '').trim());
        });

        var categories = [];
        var descriptions = [];
        var $rows = $table.find('tbody tr');
        if ($rows.length === 0) {
            $rows = $table.find('tr').slice(scores.length > 0 ? 1 : 0);
        }

        $rows.each(function () {
            var $row = $(this);
            var $cells = $row.children('th,td');
            if ($cells.length < 2) return;

            categories.push(($cells.eq(0).text() || '').trim());

            var row = [];
            $cells.slice(1).each(function () {
                var $cell = $(this).clone();
                $cell.find('input[type="checkbox"]').remove();

                var weight = '';
                var $span = $cell.find('span').first();
                if ($span.length === 1) {
                    var spanText = ($span.text() || '').trim();
                    var match = spanText.match(/^\(([^)]+)\)$/);
                    if (match && match[1]) weight = match[1].trim();
                    $span.remove();
                }

                row.push({
                    text: ($cell.html() || '').trim(),
                    weight: weight,
                });
            });

            descriptions.push(row);
        });

        if (scores.length === 0) {
            var maxCols = 0;
            for (var i = 0; i < descriptions.length; i++) {
                maxCols = Math.max(maxCols, descriptions[i].length);
            }
            for (var j = 0; j < maxCols; j++) scores.push('');
        }

        if (categories.length === 0 || descriptions.length === 0) return null;

        var i18n = {};
        $scope.find('.exe-rubrics-strings li, .exe-rubric-strings li').each(function () {
            var key = ($(this).attr('class') || '').trim();
            var value = ($(this).text() || '').trim();
            if (!key || !value) return;
            i18n[key] = value;
        });

        var data = {
            title: title,
            categories: categories,
            scores: scores,
            descriptions: descriptions,
        };

        if (Object.keys(i18n).length > 0) data.i18n = i18n;

        return data;
    },

    injectDataGame: function (scope, data) {
        var $scope = $(scope);
        if ($scope.length !== 1 || !data) return;

        if ($scope.find('.exe-rubrics-DataGame').length > 0) return;

        var encoded = '';
        try {
            encoded = escape(JSON.stringify(data));
        } catch (e) {
            encoded = JSON.stringify(data);
        }

        var $rubricContainer = $scope.find('.rubric').first();
        if ($rubricContainer.length !== 1) {
            $rubricContainer = $('<div class="rubric"></div>');
            $scope.prepend($rubricContainer);
        }

        $rubricContainer.prepend('<div class="exe-rubrics-DataGame js-hidden">' + encoded + '</div>');
    },

    clearLegacyInterfaceArtifacts: function (scope) {
        var $scope = $(scope);
        if ($scope.length !== 1) return;

        var $dataNode = $scope.find('.exe-rubrics-DataGame').first().detach();

        $scope.find('.exe-rubrics-wrapper, .exe-rubrics-content, .exe-rubrics-actions, #exe-rubrics-header, #exe-rubrics-footer').remove();
        $scope.find('.exe-rubric-strings, .exe-rubrics-strings').remove();
        $scope.find('.exe-rubrics-calc, #exe-rubrics-calc').remove();
        $scope.find('table.exe-table, table[data-rubric-table-type], table.exe-rubrics-export-table').remove();
        $scope.find('[data-rubric-field], #activity, #name, #date, #score, #notes').remove();

        if ($dataNode.length === 1) {
            var $rubricContainer = $scope.find('.rubric').first();
            if ($rubricContainer.length !== 1) {
                $rubricContainer = $('<div class="rubric"></div>');
                $scope.prepend($rubricContainer);
            }
            $rubricContainer.prepend($dataNode);
        }
    },

    getActivitiesFromDataGame: function () {
        var scopes = [];
        var seen = [];

        $('.exe-rubrics-DataGame').each(function () {
            var node = $(this);
            var scope = node.closest('.idevice_node.rubric');

            if (scope.length !== 1) {
                scope = node.closest('.rubric');
            }

            if (scope.length !== 1) {
                scope = node.parent();
            }

            if (scope.length !== 1) return;

            var domNode = scope.get(0);
            if (seen.indexOf(domNode) !== -1) return;

            seen.push(domNode);
            scopes.push(domNode);
        });

        return $(scopes);
    },

    getGameData: function (scope, instance) {
        scope = $(scope);
        if (scope.length !== 1) return null;

        var stored = this.loadDataGame(scope);
        if (!stored) return null;

        // Source of truth in export: serialized data payload, never existing DOM tables.
        var table = this.createTableFromData(stored);

        // Avoid duplicated legacy tables if present in old saved markup.
        scope
            .find('table.exe-table')
            .remove();

        var id = scope.length === 1 ? scope.get(0).getAttribute('id') : '';
        var instanceId = typeof instance === 'number' ? instance : 0;

        return {
            table: table,
            scope: scope,
            scopeId: id || 'rubric-' + instanceId,
            strings: this.getStringsFromData(stored),
            raw: stored,
        };
    },

    loadDataGame: function (scope) {
        var node = $(scope).find('.exe-rubrics-DataGame').first();
        if (node.length !== 1) return null;

        var encoded = node.text() || '';
        if (encoded === '') return null;

        var raw = encoded;
        try {
            raw = unescape(encoded);
        } catch (e) {
            raw = encoded;
        }

        try {
            var parsed = JSON.parse(raw);
            return this.normalizeDataGame(parsed);
        } catch (e) {
            return null;
        }
    },

    normalizeDataGame: function (data) {
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

    // Backward-compatible alias
    getStoredRubricData: function (scope) {
        return this.loadDataGame(scope);
    },

    createTableFromData: function (data) {
        var html = '<table class="exe-table exe-rubrics-export-table" data-rubric-table-type="export">';
        html += '<caption>' + (data.title || '') + '</caption>';
        html += '<thead><tr><th>&nbsp;</th>';

        for (var i = 0; i < data.scores.length; i++) {
            html += '<th>' + (data.scores[i] || '') + '</th>';
        }

        html += '</tr></thead><tbody>';

        for (var r = 0; r < data.categories.length; r++) {
            var row = data.descriptions[r] || [];
            html += '<tr>';
            html += '<th>' + (data.categories[r] || '') + '</th>';

            for (var c = 0; c < data.scores.length; c++) {
                var cell = row[c] || { text: '', weight: '' };
                html += '<td>' + (cell.text || '');
                if (cell.weight !== '') {
                    html += ' <span>(' + cell.weight + ')</span>';
                }
                html += '</td>';
            }

            html += '</tr>';
        }

        html += '</tbody></table>';
        return $(html);
    },

    getStringsFromData: function (data) {
        var strings = $.extend({}, this.ci18n);
        if (!data || typeof data !== 'object' || !data.i18n || typeof data.i18n !== 'object') return strings;

        Object.keys(data.i18n).forEach(function (key) {
            if (Object.prototype.hasOwnProperty.call(strings, key) && typeof data.i18n[key] === 'string') {
                strings[key] = data.i18n[key];
            }
        });

        return strings;
    },


    prepareInteractiveTable: function (table, tableId, strings) {
        var $table = $(table);
        strings = strings || this.ci18n;
        if ($table.length !== 1) return;

        $table
            .addClass('exe-rubrics-export-table')
            .attr('data-rubric-table-type', 'export');

        var scopeId = tableId || 'rubric';
        $table.attr('data-rubric-scope', scopeId);

        $table.find('tbody tr').each(function (rowIndex) {
            $(this)
                .find('td')
                .each(function (colIndex) {
                    if ($(this).find('input[type="checkbox"]').length > 0) return;

                    var val = '';
                    var span = $('span', this);
                    if (span.length === 1) {
                        try {
                            val = span.text().match(/\(([^)]+)\)/)[1];
                        } catch (e) {
                            val = '';
                        }
                        if (val !== '') {
                            val = val.replace(/[^0-9.,]/g, '');
                            val = val.replace(/,/g, '.');
                            if (isNaN(val)) val = '';
                        }
                    }

                    this.innerHTML +=
                        ' <input type="checkbox" name="criteria-' +
                        scopeId +
                        '-' +
                        rowIndex +
                        '" id="criteria-' +
                        scopeId +
                        '-' +
                        rowIndex +
                        '-' +
                        colIndex +
                        '" data-col-index="' +
                        colIndex +
                        '" value="' +
                        val +
                        '" />';
                });
        });

        var dataScope = this.getDataScope($table);

        // Legacy cleanup: remove old manual score controls and message area.
        $table.next('.exe-rubrics-calc, #exe-rubrics-calc').remove();

        this.ensureActionButtons($table, strings);
    },

    initializeInteractiveState: function (table) {
        var $table = $(table);
        if ($table.length !== 1) return;
        var dataScope = this.getDataScope($table);

        this.restoreRubricData($table);

        var scoreField = this.getField(dataScope, 'score');
        if (scoreField.length === 1 && scoreField.val() === '') {
            this.renderTableScore($table, this.calculateTableScore($table));
        }

        var dateField = this.getField(dataScope, 'date');
        if (dateField.length === 1 && dateField.val() === '') {
            dateField.val(this.getCurrentDate());
            this.saveRubricData($table);
        }
    },

    addEvents: function (table, strings) {
        this.addCheckboxEvents(table);
        this.addFieldEvents(table);
        this.addActionEvents(table, strings);
    },

    addCheckboxEvents: function (table) {
        var $table = $(table);
        $table.find('tbody input[type="checkbox"]').off('change.rubric').on('change.rubric', function () {
            if (this.checked) {
                $("input[name='" + this.name + "']").prop('checked', false);
                $(this).prop('checked', true);
            }

            var result = $rubric.calculateTableScore($table);
            $rubric.renderTableScore($table, result);
            $rubric.saveRubricData($table);
        });
    },

    addFieldEvents: function (table) {
        var $table = $(table);
        var dataScope = this.getDataScope($table);
        this.getFields(dataScope)
            .off('input.rubric change.rubric')
            .on('input.rubric change.rubric', function () {
                $rubric.saveRubricData($table);
            });
    },

    addActionEvents: function (table, strings) {
        var $table = $(table);
        var $actions = this.getDataScope($table).find('.exe-rubrics-actions').first();
        if ($actions.length !== 1) return;
        strings = strings || this.ci18n;

        $actions.find('.exe-rubrics-reset').off('click.rubric').on('click.rubric', function () {
            if (confirm(strings.msgDelete || 'Are you sure you want clear all form fields?')) {
                $rubric.resetRubricData($table);
            }
        });

        $actions.find('.exe-rubrics-download').off('click.rubric').on('click.rubric', function () {
            $rubric.saveAsPdf($table);
        });
    },

    getLicenseLabel: function (license) {
        if (typeof license !== 'string') return '';

        if (license === 'gnu-gpl') return 'GNU/GPL';
        if (license === 'copyright') return 'Copyright';
        if (license === 'pd') return 'Public Domain';
        if (/^CC-/.test(license)) return license.replace(/-/g, ' ');

        return license;
    },

    buildAuthorshipFooter: function (rawData) {
        if (!rawData || typeof rawData !== 'object') return '';
        if (rawData['visible-info'] === false) return '';

        var author = typeof rawData.author === 'string' ? rawData.author.trim() : '';
        var license = this.getLicenseLabel(rawData.license);

        var parts = [];
        if (author) parts.push(author);
        if (license) parts.push(license);

        if (parts.length === 0) return '';

        return '<p class="exe-rubrics-authorship">' + parts.join(' / ') + '</p>';
    },

    resolveAuthorshipFooter: function (root, rawData) {
        var $root = $(root);
        if ($root.length !== 1) return this.buildAuthorshipFooter(rawData);

        var currentTitle = '';
        if (rawData && typeof rawData === 'object') {
            if (typeof rawData.title === 'string') {
                currentTitle = rawData.title;
            } else if (rawData.table && typeof rawData.table === 'object' && typeof rawData.table.title === 'string') {
                currentTitle = rawData.table.title;
            }
        }

        // Prefer rich serialized authorship (links/title/license) when available.
        var rich = $root.find('.rubric-IDevice .exe-rubrics-authorship, .rubric .exe-rubrics-authorship').first();
        var html = '';
        if (rich.length === 1) {
            var clonedRich = rich.clone();
            if (currentTitle !== '') {
                var titleNode = clonedRich.find('.title em').first();
                if (titleNode.length === 1) {
                    titleNode.text(currentTitle);
                }
            }
            html = $('<div></div>').append(clonedRich).html();
        }

        if (html === '') {
            html = this.buildAuthorshipFooter(rawData);
        }

        // Remove previous authored blocks so we only render one footer in the interface.
        $root.find('.exe-rubrics-authorship').remove();

        return html;
    },

    createInterface: function (data) {
        var root = $(data.scope);
        var $table = $(data.table);
        var strings = data.strings || this.ci18n;
        var safeScopeId = String(data.scopeId || 'rubric').replace(/[^a-zA-Z0-9_-]/g, '-');

        if (root.length !== 1) return $();

        var activityId = 'rubric-activity-' + safeScopeId;
        var nameId = 'rubric-name-' + safeScopeId;
        var scoreId = 'rubric-score-' + safeScopeId;
        var dateId = 'rubric-date-' + safeScopeId;
        var notesId = 'rubric-notes-' + safeScopeId;
        var authorshipFooter = this.resolveAuthorshipFooter(root, data.raw);

        var html = `
            <div class="exe-rubrics-wrapper" data-rubric-interface="${safeScopeId}">
                <div class="exe-rubrics-content" data-rubric-content="${safeScopeId}">
                    <div id="exe-rubrics-header">
                        <p class="exe-rubrics-header-line">
                            <label for="${activityId}">${strings.activity}:</label>
                            <input type="text" id="${activityId}" class="form-control form-control-sm" data-rubric-field="activity" />
                            <label for="${nameId}">${strings.name}:</label>
                            <input type="text" id="${nameId}" class="form-control form-control-sm" data-rubric-field="name" />
                            <label for="${scoreId}">${strings.score}:</label>
                            <input type="text" id="${scoreId}" class="form-control form-control-sm" data-rubric-field="score" />
                            <label for="${dateId}">${strings.date}:</label>
                            <input type="text" id="${dateId}" class="form-control form-control-sm" data-rubric-field="date" value="${this.getCurrentDate()}" />
                        </p>
                    </div>
                    <div class="exe-rubrics-table-slot" data-rubric-table-slot="${safeScopeId}"></div>
                    <div id="exe-rubrics-footer">
                        <p>
                            <label for="${notesId}">${strings.notes}:</label>
                            <textarea id="${notesId}" class="form-control form-control-sm" data-rubric-field="notes" cols="32" rows="1"></textarea>
                        </p>
                    </div>
                    <p class="exe-rubrics-actions">
                        <button type="button" class="exe-rubrics-download btn btn-primary btn-sm">${strings.download}</button>
                        <button type="button" class="exe-rubrics-reset btn btn-primary btn-sm">${strings.reset}</button>
                    </p>
                    ${authorshipFooter}
                </div>
            </div>
        `;

        var $interface = $(html);
        if ($table.length === 1) {
            $interface.find('.exe-rubrics-table-slot').first().append($table);
        }

        root.find('.exe-rubrics-wrapper').remove();
        root.find('.exe-rubrics-content').remove();

        root.append($interface);

        return $interface;
    },

    getDataScope: function (table) {
        var $table = $(table);
        var content = $table.closest('.exe-rubrics-content');
        if (content.length === 1) return content;

        var node = $table.closest('.idevice_node.rubric, .rubric');
        if (node.length === 1) return node;

        return $table.parent();
    },

    getField: function (scope, fieldName) {
        var $scope = $(scope);
        var byData = $scope.find('[data-rubric-field="' + fieldName + '"]').first();
        if (byData.length === 1) return byData;
        return $scope.find('#' + fieldName).first();
    },

    getFields: function (scope) {
        var $scope = $(scope);
        var byData = $scope.find('[data-rubric-field="activity"], [data-rubric-field="name"], [data-rubric-field="date"], [data-rubric-field="score"], [data-rubric-field="notes"]');
        if (byData.length > 0) return byData;
        return $scope.find('#activity, #name, #date, #score, #notes');
    },

    getStorageKey: function (table) {
        var $table = $(table);
        var explicitId = $table.attr('data-rubric-id') || '';
        if (explicitId) return 'rubricData-' + explicitId;

        var scopeId = $table.attr('data-rubric-scope') || '';
        if (scopeId) return 'rubricData-' + scopeId;

        var nodeId = $table.closest('.idevice_node').attr('id') || '';
        if (nodeId) return 'rubricData-' + nodeId;

        return 'rubricData-default';
    },

    saveRubricData: function (table) {
        var $table = $(table);
        var root = this.getDataScope($table);
        if (root.length !== 1) return;

        var payload = {
            activity: this.getField(root, 'activity').val() || '',
            name: this.getField(root, 'name').val() || '',
            date: this.getField(root, 'date').val() || '',
            score: this.getField(root, 'score').val() || '',
            notes: this.getField(root, 'notes').val() || '',
            checks: [],
        };

        $table.find('tbody input[type="checkbox"]').each(function () {
            payload.checks.push(this.checked ? 1 : 0);
        });

        try {
            localStorage.setItem(this.getStorageKey($table), JSON.stringify(payload));
        } catch (e) {
            // Ignore storage quota/private mode errors.
        }
    },

    restoreRubricData: function (table) {
        var $table = $(table);
        var root = this.getDataScope($table);
        if (root.length !== 1) return;

        var raw = null;
        try {
            raw = localStorage.getItem(this.getStorageKey($table));
        } catch (e) {
            raw = null;
        }
        if (!raw) return;

        var data = null;
        try {
            data = JSON.parse(raw);
        } catch (e) {
            data = null;
        }
        if (!data || typeof data !== 'object') return;

        this.getField(root, 'activity').val(data.activity || '');
        this.getField(root, 'name').val(data.name || '');
        this.getField(root, 'date').val(data.date || '');
        this.getField(root, 'score').val(data.score || '');
        this.getField(root, 'notes').val(data.notes || '');

        var checks = Array.isArray(data.checks) ? data.checks : [];
        $table.find('tbody input[type="checkbox"]').each(function (idx) {
            this.checked = checks[idx] === 1;
        });
    },

    resetRubricData: function (table) {
        var $table = $(table);
        var root = this.getDataScope($table);
        if (root.length !== 1) return;

        $table.find('tbody input[type="checkbox"]').prop('checked', false);
        this.getField(root, 'activity').val('');
        this.getField(root, 'name').val('');
        this.getField(root, 'score').val('');
        this.getField(root, 'notes').val('');
        this.getField(root, 'date').val(this.getCurrentDate());

        try {
            localStorage.removeItem(this.getStorageKey($table));
        } catch (e) {
            // Ignore storage errors.
        }

        this.saveRubricData($table);
    },

    ensureActionButtons: function (table, strings) {
        var $table = $(table);
        strings = strings || this.ci18n;
        var $actions = this.getDataScope($table).find('.exe-rubrics-actions').first();
        if ($actions.length === 0) {
            $actions = $(
                '<p class="exe-rubrics-actions">' +
                    '<button type="button" class="exe-rubrics-download btn btn-primary btn-sm"></button> ' +
                    '<button type="button" class="exe-rubrics-reset btn btn-primary btn-sm"></button>' +
                '</p>'
            );
            this.getDataScope($table).append($actions);
        }

        $actions.find('.exe-rubrics-download, .exe-rubrics-reset').addClass('btn btn-primary btn-sm');

        $actions.find('.exe-rubrics-download').text(strings.download || 'Download');
        $actions.find('.exe-rubrics-reset').text(strings.reset || 'Reset');
    },

    saveAsPdf: function (table) {
        var $table = $(table);
        var target = this.buildCaptureTarget($table);
        if (!target) return;
        var captureClass = 'exe-rubrics-capture';
        var pdfFileName = this.getPdfFileName($table);

        var toPng = function (canvas) {
            try {
                var link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = 'rubric.png';
                link.click();
            } catch (e) {
                console.error('Error al descargar PNG:', e);
            }
        };

        var toPdf = function (canvas) {
            try {
                if (!window.jspdf || !window.jspdf.jsPDF) return false;
                var imgData = canvas.toDataURL('image/png');
                var pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
                var imgProps = pdf.getImageProperties(imgData);
                var pageWidth = pdf.internal.pageSize.getWidth();
                var pdfHeight = pdf.internal.pageSize.getHeight();
                var horizontalMargin = 10;
                var pdfWidth = Math.max(20, pageWidth - horizontalMargin * 2);
                var xOffset = (pageWidth - pdfWidth) / 2;
                var imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

                var heightLeft = imgHeight;
                var position = 0;

                pdf.addImage(imgData, 'PNG', xOffset, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;

                while (heightLeft > 0) {
                    position -= pdfHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', xOffset, position, pdfWidth, imgHeight);
                    heightLeft -= pdfHeight;
                }

                pdf.save(pdfFileName);
                return true;
            } catch (e) {
                console.error('Error al generar PDF:', e);
                return false;
            }
        };

        this.ensureHtml2Canvas(
            function () {
                target.classList.add(captureClass);
                window.html2canvas(target, {
                    backgroundColor: '#ffffff',
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    onclone: function (clonedDoc) {
                         var links = clonedDoc.querySelectorAll('link[rel="stylesheet"]');
                        for (var i = 0; i < links.length; i++) {
                            links[i].parentNode && links[i].parentNode.removeChild(links[i]);
                        }
                    },
                })
                    .then(function (canvas) {
                        if (window.jspdf && window.jspdf.jsPDF) {
                            if (!toPdf(canvas)) toPng(canvas);
                        } else {
                            $rubric.ensureJsPDF(
                                function () {
                                    if (!toPdf(canvas)) toPng(canvas);
                                },
                                function () {
                                    toPng(canvas);
                                }
                            );
                        }
                    })
                    .catch(function (e) {
                        console.error('Error al capturar la rúbrica:', e);
                    })
                    .finally(function () {
                        target.classList.remove(captureClass);
                        if (target && target.getAttribute('data-rubric-capture-temp') === '1') {
                            target.parentNode && target.parentNode.removeChild(target);
                        }
                    });
            },
            function () {
                console.error('No se pudo cargar html2canvas');
                if (target && target.getAttribute('data-rubric-capture-temp') === '1') {
                    target.parentNode && target.parentNode.removeChild(target);
                }
            }
        );
    },

    buildCaptureTarget: function (table) {
        var $table = $(table);
        var scope = this.getDataScope($table);
        if (scope.length !== 1) return null;

        var content = $table.closest('.exe-rubrics-content');
        var header = content.find('#exe-rubrics-header').first();
        if (header.length !== 1) {
            header = scope.find('#exe-rubrics-header').first();
        }
        var footer = content.find('#exe-rubrics-footer').first();
        if (footer.length !== 1) {
            footer = scope.find('#exe-rubrics-footer').first();
        }
        var authorship = content.find('.exe-rubrics-authorship').last();
        if (authorship.length !== 1) {
            authorship = scope.find('.exe-rubrics-authorship').last();
        }
        var temp = document.createElement('div');
        temp.className = 'exe-rubrics-content exe-rubrics-capture-shell rubric';
        temp.setAttribute('data-rubric-capture-temp', '1');
        temp.style.position = 'fixed';
        temp.style.left = '-99999px';
        temp.style.top = '0';
        temp.style.width = '1200px';
        temp.style.background = '#fff';
        temp.style.padding = '16px';
        temp.style.boxSizing = 'border-box';
        temp.style.zIndex = '-1';

        if (header.length === 1) {
            temp.appendChild(this.cloneNodeWithComputedStyles(header.get(0)));
        }
        temp.appendChild(this.cloneNodeWithComputedStyles($table.get(0)));
        if (footer.length === 1) {
            temp.appendChild(this.cloneNodeWithComputedStyles(footer.get(0)));
        }
        if (authorship.length === 1) {
            temp.appendChild(this.cloneNodeWithComputedStyles(authorship.get(0)));
        }

        this.alignCaptureCheckboxes(temp);

        document.body.appendChild(temp);
        return temp;
    },

    alignCaptureCheckboxes: function (root) {
        var container = root && root.querySelectorAll ? root : null;
        if (!container) return;

        var checkboxes = container.querySelectorAll('td input[type="checkbox"]');
        for (var i = 0; i < checkboxes.length; i++) {
            var checkbox = checkboxes[i];
            var cell = checkbox.closest('td');

            if (cell) {
                cell.style.position = 'relative';
            }

            checkbox.style.position = 'absolute';
            checkbox.style.right = '0px';
            checkbox.style.bottom = '0px';
            checkbox.style.left = 'auto';
            checkbox.style.margin = '0';
            checkbox.style.transform = 'none';
        }
    },

    cloneNodeWithComputedStyles: function (sourceNode) {
        var clone = sourceNode.cloneNode(true);
        this.applyComputedStylesRecursive(sourceNode, clone);
        return clone;
    },

    applyComputedStylesRecursive: function (sourceNode, targetNode) {
        if (!sourceNode || !targetNode || sourceNode.nodeType !== 1 || targetNode.nodeType !== 1) {
            return;
        }

        var computed = window.getComputedStyle(sourceNode);
        if (computed) {
            for (var i = 0; i < computed.length; i++) {
                var prop = computed[i];
                var value = computed.getPropertyValue(prop);
                if (value && value !== '') {
                    targetNode.style.setProperty(prop, value);
                }
            }
        }

        var sourceChildren = sourceNode.children;
        var targetChildren = targetNode.children;
        var childCount = Math.min(sourceChildren.length, targetChildren.length);
        for (var j = 0; j < childCount; j++) {
            this.applyComputedStylesRecursive(sourceChildren[j], targetChildren[j]);
        }
    },

    ensureHtml2Canvas: function (onReady, onError) {
        if (window.html2canvas) {
            onReady && onReady();
            return;
        }

        var scriptId = 'html2canvas-loader';
        var existing = document.getElementById(scriptId);
        if (existing) {
            var tries = 0;
            var iv = setInterval(function () {
                tries++;
                if (window.html2canvas) {
                    clearInterval(iv);
                    onReady && onReady();
                } else if (tries > 50) {
                    clearInterval(iv);
                    onError && onError();
                }
            }, 100);
            return;
        }

        var sources = [
            '/files/perm/idevices/base/rubric/export/html2canvas.js',
            'idevices/rubric/html2canvas.js',
            '../idevices/rubric/html2canvas.js',
            'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
        ];

        var tryLoad = function (idx) {
            if (idx >= sources.length) {
                onError && onError();
                return;
            }

            var s = document.createElement('script');
            s.id = scriptId;
            s.src = sources[idx];
            s.async = true;
            s.onload = function () {
                onReady && onReady();
            };
            s.onerror = function () {
                var current = document.getElementById(scriptId);
                if (current && current.parentNode) {
                    current.parentNode.removeChild(current);
                }
                tryLoad(idx + 1);
            };
            document.head.appendChild(s);
        };

        tryLoad(0);
    },

    ensureJsPDF: function (onReady, onError) {
        if (window.jspdf && window.jspdf.jsPDF) {
            onReady && onReady();
            return;
        }

        var scriptId = 'jspdf-umd-loader';
        var existing = document.getElementById(scriptId);
        if (existing) {
            var tries = 0;
            var iv = setInterval(function () {
                tries++;
                if (window.jspdf && window.jspdf.jsPDF) {
                    clearInterval(iv);
                    onReady && onReady();
                } else if (tries > 50) {
                    clearInterval(iv);
                    onError && onError();
                }
            }, 100);
            return;
        }

        var s = document.createElement('script');
        s.id = scriptId;
        s.src = 'https://cdn.jsdelivr.net/npm/jspdf/dist/jspdf.umd.min.js';
        s.async = true;
        s.onload = function () {
            onReady && onReady();
        };
        s.onerror = function () {
            onError && onError();
        };
        document.head.appendChild(s);
    },

    calculateTableScore: function (table) {
        var res = 0;
        $(table)
            .find('tbody input:checked')
            .each(function () {
                res += $rubric.getCheckboxScore(table, this);
            });
        if (isNaN(res)) return 0;
        return Math.round(res * 100) / 100;
    },

    calculateTableMaxScore: function (table) {
        var max = 0;

        $(table)
            .find('tbody tr')
            .each(function () {
                var rowMax = null;

                $(this)
                    .find('input[type="checkbox"]')
                    .each(function () {
                        var value = $rubric.getCheckboxScore(table, this);
                        if (isNaN(value)) value = 0;
                        if (rowMax === null || value > rowMax) {
                            rowMax = value;
                        }
                    });

                if (rowMax !== null) {
                    max += rowMax;
                }
            });

        if (isNaN(max)) return 0;
        return Math.round(max * 100) / 100;
    },

    formatScoreNumber: function (value) {
        var num = parseFloat(value);
        if (isNaN(num)) return '0';

        var rounded = Math.round(num * 100) / 100;
        if (Math.abs(rounded - Math.round(rounded)) < 0.0000001) {
            return String(Math.round(rounded));
        }

        return String(rounded);
    },

    formatScoreDisplay: function (score, maxScore) {
        var raw = parseFloat(score);
        if (isNaN(raw)) raw = 0;

        var max = parseFloat(maxScore);
        if (isNaN(max) || max <= 0) {
            return this.formatScoreNumber(raw);
        }

        var normalized = (raw / max) * 10;

        return (
            this.formatScoreNumber(normalized) +
            ' (' +
            this.formatScoreNumber(raw) +
            '/' +
            this.formatScoreNumber(max) +
            ')'
        );
    },

    renderTableScore: function (table, score) {
        var scoreField = this.getField(this.getDataScope(table), 'score');
        if (scoreField.length === 1) {
            var maxScore = this.calculateTableMaxScore(table);
            scoreField.val(this.formatScoreDisplay(score, maxScore));
            return;
        }
    },

    // Backward-compatible wrapper
    checkScore: function () {
        var table = $('table').first();
        if (table.length !== 1) return;
        var result = this.calculateTableScore(table);
        this.renderTableScore(table, result);
    },

    getCurrentDate: function () {
        return new Date().toLocaleDateString();
    },

    normalizeFileNameToken: function (value) {
        var text = typeof value === 'string' ? value : String(value || '');

        text = text.trim().toLowerCase();
        if (!text) return '';

        try {
            text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        } catch (e) {
            // Keep original text if normalize() is not supported.
        }

        text = text.replace(/[^a-z0-9]+/g, '_');
        text = text.replace(/^_+|_+$/g, '');
        text = text.replace(/_+/g, '_');

        return text;
    },

    getNormalizedActivityName: function (table) {
        var $table = $(table);
        var activityField = $();

        var siblingHeader = $table.prevAll('#exe-rubrics-header').first();
        if (siblingHeader.length === 1) {
            activityField = siblingHeader.find('[data-rubric-field="activity"], #activity').first();
        }

        if (activityField.length !== 1) {
            var root = this.getDataScope(table);
            if (root.length !== 1) return '';
            activityField = this.getField(root, 'activity');
        }

        return this.normalizeFileNameToken(activityField.val());
    },

    getPdfFileName: function (table) {
        var rubricLabel = this.ci18n.rubric || 'Rubric';
        var rubricPrefix = this.normalizeFileNameToken(rubricLabel) || 'rubric';
        var normalizedName = this.getNormalizedActivityName(table);
        if (!normalizedName) return rubricPrefix + '.pdf';
        return rubricPrefix + '_' + normalizedName + '.pdf';
    },

    parseScoreText: function (text) {
        if (typeof text !== 'string' || text === '') return null;

        var normalized = text.replace(/,/g, '.');
        var insideParens = normalized.match(/\(([^)]+)\)/);
        var candidate = insideParens && insideParens[1] ? insideParens[1] : '';

        if (!candidate) {
            var anyNumber = normalized.match(/-?\d+(?:\.\d+)?/);
            candidate = anyNumber && anyNumber[0] ? anyNumber[0] : '';
        }

        if (!candidate) return null;

        candidate = candidate.replace(/[^0-9.-]/g, '');
        if (candidate === '' || isNaN(candidate)) return null;

        return parseFloat(candidate);
    },

    getColumnScore: function (table, colIndex) {
        var headerCell = $(table).find('thead th').eq(colIndex + 1);
        if (headerCell.length !== 1) return 0;

        var parsed = this.parseScoreText(headerCell.text());
        if (parsed === null || isNaN(parsed)) return 0;

        return parsed;
    },

    getCheckboxScore: function (table, checkbox) {
        var cellScore = this.parseScoreText($(checkbox).val());
        if (cellScore !== null && !isNaN(cellScore)) return cellScore;

        var colIndex = parseInt(checkbox.getAttribute('data-col-index'), 10);
        if (isNaN(colIndex)) return 0;

        return this.getColumnScore(table, colIndex);
    },


};

$(function () {
    $rubric.init();
});
