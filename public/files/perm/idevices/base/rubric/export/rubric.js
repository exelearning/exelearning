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

    init: function () {
        $('.idevice_node.rubric').each(function (i, ideviceElement) {
            var table = $('table', this);
            if (table.length != 1) return;
            var ul = $('ul.exe-rubrics-strings', this);
            if (ul.length == 1) {
                // Update $rubric.ci18n to use the custom strings
                $('li', ul).each(function () {
                    if ($rubric.ci18n[this.className]) {
                        $rubric.ci18n[this.className] = $(this).text();
                    }
                });
            }

            var id = ideviceElement.getAttribute('id');

            $rubric.prepareInteractiveTable(table, id || 'rubric-' + i);
        });

        // Print version
        if ($('body').hasClass('exe-rubrics')) {
            var printTable = $('table').first();
            if (printTable.length === 1) {
                $rubric.prepareInteractiveTable(printTable, 'print');
            }
        }

        // Clear form button
        $('#clear').click(function () {
            $("input[type='checkbox']").prop('checked', false);
            $('#score,#notes').val('');
            var dateField = $('#date');
            if (dateField.length === 1) {
                dateField.val($rubric.getCurrentDate());
            }
            $('#activity').val('');
            $('#name').val('').focus();
        });

        // Print button
        $('#print').click(function () {
            try {
                window.print();
            } catch (e) {
                //
            }
        });
    },

    prepareInteractiveTable: function (table, tableId) {
        var $table = $(table);
        if ($table.length !== 1) return;

        // Remove rubric title line above the table in export view.
        $table.find('caption').remove();

        var scopeId = tableId || 'rubric';
        $table.attr('data-rubric-scope', scopeId);

        this.ensureHeaderAndFooter($table, scopeId);

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

        $table.find('tbody input[type="checkbox"]').off('change.rubric').on('change.rubric', function () {
            if (this.checked) {
                $("input[name='" + this.name + "']").prop('checked', false);
                $(this).prop('checked', true);
            }

            var result = $rubric.calculateTableScore($table);
            $rubric.renderTableScore($table, result);
            $rubric.saveRubricData($table);
        });

        var dataScope = this.getDataScope($table);
        this.getFields(dataScope)
            .off('input.rubric change.rubric')
            .on('input.rubric change.rubric', function () {
                $rubric.saveRubricData($table);
            });

        // Legacy cleanup: remove old manual score controls and message area.
        $table.next('.exe-rubrics-calc, #exe-rubrics-calc').remove();

        this.ensureActionButtons($table);
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

    ensureHeaderAndFooter: function (table, scopeId) {
        var $table = $(table);
        var root = this.getDataScope($table);
        if (root.length !== 1) return;

        var safeScopeId = String(scopeId || 'rubric').replace(/[^a-zA-Z0-9_-]/g, '-');

        if (root.find('#exe-rubrics-header').length === 0) {
            var activityId = 'rubric-activity-' + safeScopeId;
            var nameId = 'rubric-name-' + safeScopeId;
            var scoreId = 'rubric-score-' + safeScopeId;
            var dateId = 'rubric-date-' + safeScopeId;
            var header =
                '<div id="exe-rubrics-header">' +
                    '<p class="exe-rubrics-header-line">' +
                        '<label for="' + activityId + '">' + this.ci18n.activity + ':</label> ' +
                        '<input type="text" id="' + activityId + '" class="form-control form-control-sm" data-rubric-field="activity" />' +
                        '<label for="' + nameId + '">' + this.ci18n.name + ':</label> ' +
                        '<input type="text" id="' + nameId + '" class="form-control form-control-sm" data-rubric-field="name" />' +
                        '<label for="' + scoreId + '">' + this.ci18n.score + ':</label> ' +
                        '<input type="text" id="' + scoreId + '" class="form-control form-control-sm" data-rubric-field="score" />' +
                        '<label for="' + dateId + '">' + this.ci18n.date + ':</label> ' +
                        '<input type="text" id="' + dateId + '" class="form-control form-control-sm" data-rubric-field="date" value="' + this.getCurrentDate() + '" />' +
                    '</p>' +
                '</div>';
            $table.before(header);
        }

        if (root.find('#exe-rubrics-footer').length === 0) {
            var notesId = 'rubric-notes-' + safeScopeId;
            var footer =
                '<div id="exe-rubrics-footer">' +
                    '<p>' +
                        '<label for="' + notesId + '">' + this.ci18n.notes + ':</label> ' +
                        '<textarea id="' + notesId + '" class="form-control form-control-sm" data-rubric-field="notes" cols="32" rows="2"></textarea>' +
                    '</p>' +
                '</div>';
            $table.after(footer);
        }
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

    ensureActionButtons: function (table) {
        var $table = $(table);
        var $actions = $table.next('.exe-rubrics-actions');
        if ($actions.length === 0) {
            $actions = $(
                '<p class="exe-rubrics-actions">' +
                    '<button type="button" class="exe-rubrics-download btn btn-primary btn-sm"></button> ' +
                    '<button type="button" class="exe-rubrics-reset btn btn-primary btn-sm"></button>' +
                '</p>'
            );
            $table.after($actions);
        }

        $actions.find('.exe-rubrics-download, .exe-rubrics-reset').addClass('btn btn-primary btn-sm');

        $actions.find('.exe-rubrics-download').text(this.ci18n.download || 'Download');
        $actions.find('.exe-rubrics-reset').text(this.ci18n.reset || 'Reset');

        $actions.find('.exe-rubrics-reset').off('click.rubric').on('click.rubric', function () {
            if (confirm($rubric.ci18n.msgDelete || 'Are you sure you want clear all form fields?')) {
                $rubric.resetRubricData($table);
            }
        });

        $actions.find('.exe-rubrics-download').off('click.rubric').on('click.rubric', function () {
            $rubric.saveAsPdf($table);
        });
    },

    saveAsPdf: function (table) {
        var $table = $(table);
        var target = this.buildCaptureTarget($table);
        if (!target) return;
        var captureClass = 'exe-rubrics-capture';

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
                var pdfWidth = pdf.internal.pageSize.getWidth();
                var pdfHeight = pdf.internal.pageSize.getHeight();
                var imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

                var heightLeft = imgHeight;
                var position = 0;

                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;

                while (heightLeft > 0) {
                    position -= pdfHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                    heightLeft -= pdfHeight;
                }

                pdf.save('rubric.pdf');
                return true;
            } catch (e) {
                console.error('Error al generar PDF:', e);
                return false;
            }
        };

        this.ensureHtml2Canvas(
            function () {
                target.classList.add(captureClass);
                var detachedStyles = null;
                if (window.location.pathname.indexOf('/viewer/') !== -1) {
                    detachedStyles = $rubric.detachStylesheetsForCapture(document);
                }
                window.html2canvas(target, {
                    backgroundColor: '#ffffff',
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    onclone: function (clonedDoc) {
                        // In /viewer context html2canvas may clone into a document
                        // that cannot resolve SW-only relative CSS paths.
                        // Remove external stylesheets to avoid 404 noise and rely
                        // on inline computed styles copied into the capture target.
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
                        if (detachedStyles) {
                            $rubric.restoreStylesheetsAfterCapture(detachedStyles);
                        }
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

    detachStylesheetsForCapture: function (doc) {
        if (!doc || !doc.head) return [];

        var detached = [];
        var links = doc.querySelectorAll('link[rel="stylesheet"]');
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            detached.push({
                node: link,
                parent: link.parentNode,
                nextSibling: link.nextSibling,
            });
            link.parentNode && link.parentNode.removeChild(link);
        }

        return detached;
    },

    restoreStylesheetsAfterCapture: function (detached) {
        if (!Array.isArray(detached) || detached.length === 0) return;

        for (var i = detached.length - 1; i >= 0; i--) {
            var entry = detached[i];
            if (!entry || !entry.parent || !entry.node) continue;

            if (entry.nextSibling && entry.nextSibling.parentNode === entry.parent) {
                entry.parent.insertBefore(entry.node, entry.nextSibling);
            } else {
                entry.parent.appendChild(entry.node);
            }
        }
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

        // Capturamos siempre solo el bloque visible de la rúbrica
        // para evitar metadatos/elementos auxiliares en previsualización eXe.
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
            // Copy all computed properties to make capture independent from
            // external stylesheet loading inside html2canvas clone documents.
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

    printRubric: function (tit, html, rubricId) {
        if (document.getElementById('workarea')) {
            eXe.app.alert(_('Please export the content to apply the rubric.'));
            return false;
        }
        if (window.location.host == 'localhost:41309') {
            return false; // To review (Electron)
        }
        var rubricStyle, rubricScript, jqueryScript;
        var isBlob = window.location.protocol === 'blob:';
        if (isBlob) {
            // Preview mode: use absolute paths to server assets
            var origin = window.location.origin.replace('blob:', '');
            rubricStyle = origin + '/files/perm/idevices/base/rubric/export/rubric.css';
            rubricScript = origin + '/files/perm/idevices/base/rubric/export/rubric.js';
            jqueryScript = origin + '/libs/jquery/jquery.min.js';
        } else {
            // Export mode: use relative paths
            var isIndex = $('html').attr('id') == 'exe-index';
            var basePath = 'idevices/rubric/';
            if (!isIndex) basePath = '../' + basePath;
            rubricStyle = basePath + 'rubric.css';
            rubricScript = basePath + 'rubric.js';
            jqueryScript = 'libs/jquery/jquery.min.js';
            if (!isIndex) jqueryScript = '../' + jqueryScript;
        }
        // Strings
        var i18n = this.ci18n;
        var a = window.open(tit);
        a.document.open('text/html');
        a.document.write(
            '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">'
        );
        a.document.write(
            '<html xmlns="http://www.w3.org/1999/xhtml" class="exe-rubrics">'
        );
        a.document.write('<head>');
        a.document.write('<title>' + tit + '</title>');
        a.document.write(
            '<link rel="shortcut icon" href="favicon.ico" type="image/x-icon" />'
        );
        a.document.write(
            '<link href="' +
                rubricStyle +
                '" rel="stylesheet" type="text/css" />'
        );
        a.document.write(
            '<script type="text/javascript" src="' +
                jqueryScript +
                '"></script>'
        );
        a.document.write(
            '<script type="text/javascript" src="' +
                rubricScript +
                '"></script>'
        );
        a.document.write('</head>');
        a.document.write('<body class="exe-rubrics">');
        a.document.write('<div class="exe-rubrics-wrapper">');
        a.document.write('<div class="exe-rubrics-content">');
        a.document.write('<div id="exe-rubrics-header">');
        a.document.write('<p>');
        a.document.write(
            '<label for="activity">' +
            i18n.activity +
            ':</label> <input type="text" id="activity" class="form-control form-control-sm" />'
        );
        a.document.write(
            '<label for="name">' +
            i18n.name +
                ':</label> <input type="text" id="name" class="form-control form-control-sm" />'
        );
        a.document.write(
            '<label for="score">' +
                i18n.score +
                ':</label> <input type="text" id="score" class="form-control form-control-sm" />'
        );
        a.document.write(
            '<label for="date">' +
                i18n.date +
                ':</label> <input type="text" id="date" class="form-control form-control-sm" value="' +
                this.getCurrentDate() +
                '" />'
        );
        a.document.write('</p>');
        a.document.write('</div>');
        a.document.write('<table class="exe-table" data-rubric-id="' + (rubricId || 'print') + '">' + html + '</table>');
        a.document.write('<div id="exe-rubrics-footer">');
        a.document.write('<p>');
        a.document.write(
            '<label for="notes">' +
                i18n.notes +
                ':</label> <textarea id="notes" class="form-control form-control-sm" cols="32" rows="6"></textarea>'
        );
        a.document.write('</p>');
        a.document.write('</div>');
        a.document.write('</div>');
        a.document.write('</div>');
        a.document.write('</body>');
        a.document.write('</html>');
        a.document.close();
    },
};

$(function () {
    $rubric.init();
});
