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

    debugLog: function (step, details) {
        try {
            if (typeof console === 'undefined') return;
            if (typeof details === 'undefined') {
                console.log('[rubric-export] ' + step);
                return;
            }
            console.log('[rubric-export] ' + step, details);
        } catch (e) {
            // Ignore debug logging errors.
        }
    },

    debugTrace: function (step, details) {
        try {
            if (typeof console === 'undefined') return;
            if (typeof details === 'undefined') {
                console.log('[rubric-export] TRACE ' + step);
            } else {
                console.log('[rubric-export] TRACE ' + step, details);
            }
            if (typeof console.trace === 'function') {
                console.trace('[rubric-export] trace ' + step);
            }
        } catch (e) {
            // Ignore debug logging errors.
        }
    },

    init: function () {
        if (this.initialized) {
            this.debugLog('init:alreadyInitialized');
            return;
        }
        this.initialized = true;
        this.debugLog('init:start');
        this.loadGame();
        this.debugLog('init:end');
    },

    loadGame: function () {
        this.debugLog('loadGame:start');

        this.options = [];
        this.activities = this.getActivitiesFromDataGame();
        this.debugLog('loadGame:activities', {
            count: this.activities.length,
        });

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
            self.debugLog('loadGame:activityScope', {
                index: i,
                scopeId: scope.attr('id') || '',
                mode: scope.attr('mode') || '',
            });
            var data = self.getGameData(scope, i);
            if (!data) return;

            self.options.push(data);

            self.createInterface(data);
            self.prepareInteractiveTable(data.table, data.scopeId, data.strings);
            self.initializeInteractiveState(data.table);
            self.addEvents(data.table, data.strings);
        });
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

        this.debugLog('getActivitiesFromDataGame:result', {
            count: scopes.length,
        });

        return $(scopes);
    },

    getGameData: function (scope, instance) {
        scope = $(scope);
        if (scope.length !== 1) return null;

        var stored = this.loadDataGame(scope);
        this.debugLog('getGameData:storedData', {
            scopeId: scope.attr('id') || '',
            hasData: !!stored,
        });
        if (!stored) return null;

        // Source of truth in export: serialized data payload, never existing DOM tables.
        var table = this.createTableFromData(stored);
        this.debugTrace('getGameData:createTableFromData', {
            scopeId: scope.attr('id') || '',
            rows: Array.isArray(stored.descriptions) ? stored.descriptions.length : 0,
            cols: Array.isArray(stored.scores) ? stored.scores.length : 0,
        });

        // Avoid duplicated legacy tables if present in old saved markup.
        scope
            .find('table.exe-table')
            .remove();
        this.debugLog('getGameData:tablePreparedForInsertion', {
            scopeId: scope.attr('id') || '',
            tablesInScopeAfterCleanup: scope.find('table').length,
        });

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
        this.debugLog('createTableFromData:start', {
            title: data && data.title ? data.title : '',
            categories: Array.isArray(data && data.categories) ? data.categories.length : 0,
            scores: Array.isArray(data && data.scores) ? data.scores.length : 0,
        });
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
        this.debugTrace('createTableFromData:end');
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
        this.debugLog('prepareInteractiveTable:start', {
            tableId: tableId || '',
            hasTable: $table.length === 1,
        });
        if ($table.length !== 1) return;

        $table
            .addClass('exe-rubrics-export-table')
            .attr('data-rubric-table-type', 'export');

        // Remove rubric title line above the table in export view.
        $table.find('caption').remove();

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

            $rubric.debugLog('prepareInteractiveTable:checkboxesCreated', {
                tableId: tableId || '',
                checkboxCount: $table.find('tbody input[type="checkbox"]').length,
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

    createInterface: function (data) {
        var root = $(data.scope);
        var $table = $(data.table);
        var strings = data.strings || this.ci18n;
        var safeScopeId = String(data.scopeId || 'rubric').replace(/[^a-zA-Z0-9_-]/g, '-');

        this.debugLog('createInterface:start', {
            scopeId: data.scopeId || '',
            rootFound: root.length === 1,
        });

        if (root.length !== 1) return $();

        var activityId = 'rubric-activity-' + safeScopeId;
        var nameId = 'rubric-name-' + safeScopeId;
        var scoreId = 'rubric-score-' + safeScopeId;
        var dateId = 'rubric-date-' + safeScopeId;
        var notesId = 'rubric-notes-' + safeScopeId;

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
                    <p class="exe-rubrics-actions">
                        <button type="button" class="exe-rubrics-download btn btn-primary btn-sm">${strings.download}</button>
                        <button type="button" class="exe-rubrics-reset btn btn-primary btn-sm">${strings.reset}</button>
                    </p>
                    <div id="exe-rubrics-footer">
                        <p>
                            <label for="${notesId}">${strings.notes}:</label>
                            <textarea id="${notesId}" class="form-control form-control-sm" data-rubric-field="notes" cols="32" rows="1"></textarea>
                        </p>
                    </div>
                </div>
            </div>
        `;

        var $interface = $(html);
        if ($table.length === 1) {
            $interface.find('.exe-rubrics-table-slot').first().append($table);
            this.debugTrace('createInterface:slot.append(table)', {
                scopeId: safeScopeId,
            });
        }

        root.find('.exe-rubrics-wrapper').remove();
        root.find('.exe-rubrics-content').remove();

        var dataNode = root.find('.exe-rubrics-DataGame').first();
        if (dataNode.length === 1) {
            dataNode.before($interface).remove();
            this.debugTrace('createInterface:dataNode.before(interface).remove()', {
                scopeId: safeScopeId,
            });
        } else {
            root.append($interface);
            this.debugTrace('createInterface:root.append(interface)', {
                scopeId: safeScopeId,
            });
        }

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

        document.body.appendChild(temp);
        return temp;
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

    renderTableScore: function (table, score) {
        var scoreField = this.getField(this.getDataScope(table), 'score');
        if (scoreField.length === 1) {
            scoreField.val(score);
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
