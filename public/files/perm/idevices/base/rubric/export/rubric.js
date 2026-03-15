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
        date: 'Date',
        score: 'Score',
        calculateScore: 'Calculate score',
        notes: 'Notes',
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

            var i18n = $rubric.ci18n;
            var applyLink =
                '<a href="#" class="exe-rubrics-print" id="print-' +
                id +
                '"title="' +
                i18n.apply +
                ' (' +
                i18n.newWindow.toLowerCase() +
                ')"><span>' +
                i18n.apply +
                '</span></a>';
            $('caption', table).append(applyLink);
            $('#print-' + id).click(function () {
                $rubric.printRubric($('caption', table).text(), table.html());
                return false;
            });
            // To review (Electron)
            if (window.location.host == 'localhost:41309') {
                $('#print-' + id).css('cursor', 'not-allowed');
            }

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

        var scopeId = tableId || 'rubric';

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
        });

        var calcBlock = $table.next('.exe-rubrics-calc, #exe-rubrics-calc');
        if (calcBlock.length === 0) {
            calcBlock = $(
                '<p class="exe-rubrics-calc"><input type="button" class="calculate-score" value="' +
                    this.ci18n.calculateScore +
                    '" /> <span class="exe-rubrics-score-result"></span></p>'
            );
            $table.after(calcBlock);
        } else if (calcBlock.find('.exe-rubrics-score-result').length === 0) {
            calcBlock.append(' <span class="exe-rubrics-score-result"></span>');
        }

        var self = this;
        calcBlock
            .find('#calculate-score, .calculate-score')
            .off('click.rubric')
            .on('click.rubric', function () {
                var result = self.calculateTableScore($table);
                self.renderTableScore($table, result, calcBlock);
            });
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

    renderTableScore: function (table, score, calcBlock) {
        var scoreField = $(table).closest('.exe-rubrics-content').find('#score').first();
        if (scoreField.length === 1) {
            scoreField.val(score);
            return;
        }

        calcBlock
            .find('.exe-rubrics-score-result')
            .text(this.ci18n.score + ': ' + score);
    },

    // Backward-compatible wrapper
    checkScore: function () {
        var table = $('table').first();
        if (table.length !== 1) return;
        var calcBlock = table.next('.exe-rubrics-calc, #exe-rubrics-calc');
        var result = this.calculateTableScore(table);
        this.renderTableScore(table, result, calcBlock);
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

    printRubric: function (tit, html) {
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
                ':</label> <input type="text" id="activity" />'
        );
        a.document.write(
            '<label for="date">' +
                i18n.date +
                ':</label> <input type="text" id="date" />'
        );
        a.document.write('</p>');
        a.document.write('<p>');
        a.document.write(
            '<label for="name">' +
                i18n.name +
                ':</label> <input type="text" id="name" />'
        );
        a.document.write(
            '<label for="score">' +
                i18n.score +
                ':</label> <input type="text" id="score" />'
        );
        a.document.write('</p>');
        a.document.write('</div>');
        a.document.write('<table class="exe-table">' + html + '</table>');
        a.document.write(
            '<p id="exe-rubrics-calc"><input type="button" value="' +
                i18n.calculateScore +
                '" id="calculate-score" /></p>'
        );
        a.document.write('<div id="exe-rubrics-footer">');
        a.document.write('<p>');
        a.document.write(
            '<label for="notes">' +
                i18n.notes +
                ':</label> <textarea id="notes" cols="32" rows="6"></textarea>'
        );
        a.document.write('</p>');
        a.document.write('</div>');
        a.document.write('</div>');
        a.document.write(
            '<div id="commands"><input type="button" value="' +
                i18n.reset +
                '" id="clear" /> <input type="button" value="' +
                i18n.print +
                '" id="print" /></div>'
        );
        a.document.write('</div>');
        a.document.write('</body>');
        a.document.write('</html>');
        a.document.close();
    },
};

$(function () {
    $rubric.init();
});
