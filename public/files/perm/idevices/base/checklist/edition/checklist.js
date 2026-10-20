/* eslint-disable no-undef */
/**
/**
 * Checklist Activity iDevice (edition code)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narvaez Martinez y Javier Cayetano Rodríguez
 * Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    i18n: {
        category: _('Assessment and tracking'),
        name: _('Checklist'),
    },
    msgs: {},
    classIdevice: 'checklist',
    id: false,
    idevicePath: '',

    ci18n: {},

    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.refreshTranslations();
        this.createForm();
        this.addEvents();
    },
    setMessagesInfo: function () {
        const msgs = this.msgs;
        msgs.msgEProvideID = _('Please provide the ID of this progress report');
    },

    refreshTranslations: function () {
        this.ci18n = {
            msgComplit: c_('Completed'),
            msgDone: c_('Done'),
            msgInProgress: c_('In progress'),
            msgUnrealized: c_('Not completed'),
            msgtaskNumber: c_('Number of tasks'),
            msgName: c_('Name'),
            msgDate: c_('Date'),
            msgSave: c_('Download'),
            msgList: c_('checklist'),
            msgScore: c_('Score'),
            msgWeight: c_('Weight'),
            msgPoints: c_('points'),
            msgPoint: c_('point'),
            msgReboot: c_('Restart'),
            msgDelete: c_('Are you sure you want clear all form fields?'),
        };
    },

    createForm: function () {
        const path = $exeDevice.idevicePath,
            edition = $exeIDevicesEdition.iDevice,
            toggle = (id, label) => `
                        <span class="toggle-item">
                            <span class="toggle-control">
                                <input type="checkbox" class="toggle-input" id="${id}" />
                                <span class="toggle-visual" aria-hidden="true"></span>
                            </span>
                            <label class="toggle-label mb-0" for="${id}">${label}.</label>
                        </span>`,
            logo = (id, label, help, block, image, input, play, inputLabel, file) => `
                    <div class="mb-3">
                        <div class="d-flex align-items-center gap-2 flex-nowrap">
                            ${toggle(id, label)}
                            ${edition.common.getHelpTooltip(help)}
                        </div>
                        <div id="${block}" class="CTJ-Logo mt-2">
                            <div class="CTJ-Images">
                                <img class="CTJ-EMedia" src="${path}${file}" id="ctjEImage${image}" alt="${_('Image')}" />
                                <img class="CTJ-EMedia" src="${path}${file}" id="ctjEImageNo${image}" alt="${_('No image')}" />
                            </div>
                            <div class="CTJ-InputImage">
                                <label class="sr-av" for="${input}">${inputLabel}:</label>
                                <input type="text" class="exe-file-picker CTJ-EURLImage form-control me-0" id="${input}"/>
                                <a href="#" id="${play}" class="CTJ-ENavigationButton CTJ-EPlayVideo" title="${_('Show')}"><img src="${path}quextIEPlay.png" alt="${_('Show')}" class="CTJ-EButtonImage " /></a>
                            </div>
                        </div>
                    </div>`,
            options = `
                <div id="ctjEOptions">
                    <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                        ${toggle('ctjUserData', _('User data'))}
                        ${edition.common.getHelpTooltip(_('Ask the learners for their name and the date, at the top of the checklist.'))}
                    </div>
                    <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                        ${toggle('ctjSaveData', _('Remember marked options'))}
                        ${edition.common.getHelpTooltip(_('Keep what each learner ticks in their browser, so it is still there when they come back.'))}
                    </div>
                    <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                        ${toggle('ctjUseScore', _('Assign scores'))}
                        ${edition.common.getHelpTooltip(_('Give points to the items in the Questions tab. The checklist shows the score of what is ticked.'))}
                    </div>
                    ${logo('ctjCommunity', _('(Left) Logo'), _('Show an image at the top left of the checklist.'), 'ctjcommunitylogo', 'Community', 'ctjEURLCommunity', 'ctjEPlayCommunity', _('Community'), 'codejocomunidad.png')}
                    ${logo('ctjLogo', _('(Right) Logo'), _('Show an image at the top right of the checklist.'), 'ctjlogologo', 'Logo', 'ctjEURLLogo', 'ctjEPlayLogo', _('Logo'), 'cotejologo.png')}
                    ${logo('ctjDecorative', _('Decorative image'), _('Show an image beside the items. It is not shown on mobile devices.'), 'ctjdecorativelogo', 'Decorative', 'ctjEURLDecorative', 'ctjEPlayDecorative', _('Decorative image'), 'cotejodecorative.png')}
                    <div class="d-flex align-items-center flex-nowrap gap-2">
                        <label for="ctjFooter" class="mb-0">${_('Footer')}:</label>
                        ${edition.common.getHelpTooltip(_('Text at the bottom of the checklist, such as its license. It can include links.'))}
                        <input id="ctjFooter" type="text" class="form-control" value="Esta <a href=https://es.wikipedia.org/wiki/Lista_de_comprobaci%C3%B3n>lista de cotejo</a> se encuentra bajo una licencia</br><a href=http://creativecommons.org/licenses/by-sa/4.0>Creative Commons Reconocimiento-Compartir igual 4.0 International License</a>"/>
                    </div>
                </div>`,
            contents = `
                <div id="ctjEItems">
                    <div class="d-flex align-items-center flex-nowrap gap-2 mb-3">
                        <label for="ctjTitle" class="mb-0">${_('Title')}:</label>
                        <input id="ctjTitle" type="text" style="flex-grow: 1" class="form-control" />
                    </div>
                    <div class="d-flex align-items-center flex-nowrap gap-2 mb-3">
                        <label for="ctjSubTitle" class="mb-0">${_('Caption')}:</label>
                        <input id="ctjSubTitle" type="text" style="flex-grow: 1;" class="form-control"/>
                    </div>
                    <div>${_('(*) Cells support formatted text')}.</div>
                    <div class="CTJ-table-container mb-4">
                        <table class="CTJ-Table">
                            <thead>
                                <tr class="CTJ-header-row">
                                    <th class="CTJ-TypeColumn">${_('Type')}</th>
                                    <th class="CTJ-Points-column" data-points="0">${_('Points')}</th>
                                    <th class="CTJ-Level1-column" data-nivel="0">${_('Level')} 1</th>
                                    <th class="CTJ-Level2-column" data-nivel="1">${_('Level')} 2</th>
                                    <th class="CTJ-Level3-column" data-nivel="2">${_('Level')} 3</th>
                                    <th class="CTJ-Level4-column" data-nivel="3">${_('Level')} 4</th>
                                    <th class="CTJ-editar-column">${_('Edit')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr class="CTJ-data-row">
                                    <td class="CTJ-Types">
                                        <select class="CTJ-Select form-select">
                                            <option value="0" selected>${_('Box')}</option>
                                            <option value="1">${_('Text')}</option>
                                            <option value="2">${_('Selection')}</option>
                                            <option value="3">${_('Do not mark')}</option>
                                        </select>
                                    </td>
                                    <td class="CTJ-Points" contenteditable="true"></td>
                                    <td class="CTJ-Level1 CTJ-Levels" contenteditable="true"></td>
                                    <td class="CTJ-Level2 CTJ-Levels" contenteditable="true"></td>
                                    <td class="CTJ-Level3 CTJ-Levels" contenteditable="true"></td>
                                    <td class="CTJ-Level4 CTJ-Levels" contenteditable="true"></td>
                                    <td class="CTJ-Editions">
                                        <button class="CTJ-Add btn btn-primary btn-sm">${_('Add')}</button>
                                        <button class="CTJ-Delete btn btn-primary btn-sm">${_('Delete')}</button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>`,
            html = `
            <div id="gameQEIdeviceForm">
                ${edition.common.getIdeviceDescription(
                    _('You can use a checklist as a structured and easy way to understand the suggested activities in this educational resource. It will be a useful instrument for student self-assessment, allowing to monitor the completed activities.'),
                    'https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe40/html/lista-de-cotejo.html',
                )}
                ${edition.tabs.getHtml('gameQEIdeviceForm', {
                    path: path,
                    instructions: c_('Complete the checklist ticking the boxes for all finished activities.'),
                    options: options,
                    contents: contents,
                    after: true,
                    texts: this.ci18n,
                    share: false,
                    info: {
                        contents: _('Write the title of the checklist and its items, one per row, in the column of their level.'),
                    },
                })}
            </div>
        `;
        this.ideviceBody.innerHTML = html;
        edition.tabs.bind('gameQEIdeviceForm');
        $('.CTJ-Table .CTJ-Points-column, .CTJ-Table .CTJ-Points').hide();

        $exeDevice.loadPreviousValues();
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            const wrapper = $('<div></div>');
            wrapper.html(originalHTML);
            let json = $('.listacotejo-DataGame', wrapper).text();
            json = $exeDevices.iDevice.gamification.helpers.decrypt(json);

            const dataGame =
                $exeDevices.iDevice.gamification.helpers.isJsonString(json);

            let img = $('.listacotejo-LinkLogo', wrapper);
            if (img.length === 1) {
                img = img.attr('src') || '';
                dataGame.urlLogo = img;
            }

            img = $('.listacotejo-LinkCommunity', wrapper);
            if (img.length == 1) {
                img = img.attr('src') || '';
                dataGame.urlCommunity = img;
            }

            img = $('.listacotejo-LinkDecorative', wrapper);
            if (img.length == 1) {
                img = img.attr('src') || '';
                dataGame.urlDecorative = img;
            }

            $exeDevice.updateFieldGame(dataGame);

            const instructions = $('.listacotejo-instructions', wrapper);
            if (instructions.length == 1)
                $('#eXeGameInstructions').val(instructions.html());

            const textAfter = $('.listacotejo-extra-content', wrapper);
            if (textAfter.length == 1)
                $('#eXeIdeviceTextAfter').val(textAfter.html());

            $exeIDevicesEdition.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs
            );
        }
    },

    updateTable: function (arrayLevels) {
        const tbody = $('.CTJ-Table tbody'),
            useScore = $('#ctjUseScore').is(':checked');

        tbody.empty();

        arrayLevels.forEach((obj) => {
            const row = $('<tr></tr>').addClass('CTJ-data-row'),
                select = $('<select></select>').addClass('CTJ-Select form-select');

            [_('Box'), _('Text'), _('Selection'), _('Do not mark')].forEach(
                (option, index) => {
                    const optElement = $('<option></option>')
                        .attr('value', index)
                        .html(option);
                    if (index == obj.type) {
                        optElement.prop('selected', true);
                    }
                    select.append(optElement);
                }
            );

            const selectCell = $('<td></td>').append(select);

            row.append(selectCell);
            let edit = obj.type != 3;
            edit = edit.toString();
            const text = obj.type != 3 ? obj.points : '',
                points = $('<td></td>')
                    .addClass('CTJ-Points')
                    .attr('contenteditable', edit);

            points.html(text);
            row.append(points);

            for (let i = 0; i < 4; i++) {
                const cell = $('<td></td>')
                    .addClass(`CTJ-Level${i + 1} CTJ-Levels`)
                    .attr('contenteditable', 'true');
                if (i == obj.nivel) {
                    cell.html(obj.item);
                }
                row.append(cell);
            }
            const addButton = $('<button>' + _('Add') + '</button>').addClass(
                    'CTJ-Add btn btn-primary btn-sm'
                ),
                deleteButton = $(
                    '<button>' + _('Delete') + '</button>'
                ).addClass('CTJ-Delete btn btn-primary btn-sm'),
                editCell = $('<td></td>')
                    .addClass('CTJ-Editions')
                    .append(addButton, deleteButton);

            row.append(editCell);
            tbody.append(row);
        });

        if (useScore) {
            $('.CTJ-Table .CTJ-Points-column, .CTJ-Table .CTJ-Points').show();
        } else {
            $('.CTJ-Table .CTJ-Points-column, .CTJ-Table .CTJ-Points').hide();
        }
    },

    save: function () {
        const dataGame = $exeDevice.validateData();

        if (!dataGame) return false;

        const fields = this.ci18n,
            i18n = fields;
        for (let i in fields) {
            let fVal = $('#ci18n_' + i).val();
            if (fVal != '') i18n[i] = fVal;
        }

        dataGame.msgs = i18n;

        let json = JSON.stringify(dataGame),
            divContent = '';
        json = $exeDevices.iDevice.gamification.helpers.encrypt(json);

        let html = '<div class="listacotejo-IDevice">';
        const instructions = tinyMCE.get('eXeGameInstructions').getContent();
        if (instructions !== '') {
            divContent =
                '<div class="listacotejo-instructions CTJ-instructions">' +
                instructions +
                '</div>';
        }

        html += divContent;
        html +=
            '<div class="listacotejo-DataGame js-hidden">' + json + '</div>';
        html +=
            '<div class="listacotejo-bns js-hidden">' +
            _('Unsupported browser') +
            '</div>';

        const textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();
        if (textAfter != '') {
            html +=
                '<div class="listacotejo-extra-content">' +
                textAfter +
                '</div>';
        }
        let img = $('#ctjEURLLogo').val();
        if (img.trim().length > 0) {
            img =
                '<img src="' +
                img +
                '" class="js-hidden listacotejo-LinkLogo" alt="logo" />';
            html += img;
        }

        img = $('#ctjEURLCommunity').val();
        if (img.trim().length > 0) {
            img =
                '<img src="' +
                img +
                '" class="js-hidden listacotejo-LinkCommunity" alt="Community" />';
            html += img;
        }

        img = $('#ctjEURLDecorative').val();
        if (img.trim().length > 0) {
            img =
                '<img src="' +
                img +
                '" class="js-hidden listacotejo-LinkDecorative" alt="Decorative" />';
            html += img;
        }
        html += '</div>';
        return html;
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    getIdeviceID: function () {
        const ideviceid =
            $('#gameQEIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';

        return ideviceid;
    },

    validateData: function () {
        const title = $('#ctjTitle').val().trim(),
            subtitle = $('#ctjSubTitle').val().trim(),
            hasLogo = $('#ctjLogo').is(':checked'),
            urlLogo = $('#ctjEURLLogo').val().trim(),
            hasCommunity = $('#ctjCommunity').is(':checked'),
            urlCommunity = $('#ctjEURLCommunity').val().trim(),
            hasDecorative = $('#ctjDecorative').is(':checked'),
            urlDecorative = $('#ctjEURLDecorative').val().trim(),
            footer = $('#ctjFooter').val().trim(),
            saveData = $('#ctjSaveData').is(':checked'),
            userData = $('#ctjUserData').is(':checked'),
            useScore = $('#ctjUseScore').is(':checked');

        let isLevelComplete = false,
            hasEmptyRow = false,
            isMoreThanOneLevelFilled = false;

        if (title === '') {
            $exeDevice.showMessage(_('Indicate a title for the checklist'));
            return false;
        }

        $('.CTJ-data-row').each(function () {
            const $row = $(this),
                filledLevels = $row
                    .find('.CTJ-Level1, .CTJ-Level2, .CTJ-Level3, .CTJ-Level4')
                    .filter(function () {
                        return $(this).text().trim() !== '';
                    }).length;

            if (filledLevels === 0) {
                $exeDevice.showMessage(_('No empty items can be left'));
                hasEmptyRow = true;
                return false;
            }

            if (filledLevels > 0) {
                isLevelComplete = true;
            }

            if (filledLevels > 1) {
                isMoreThanOneLevelFilled = true;
                return false;
            }
        });

        if (!isLevelComplete || hasEmptyRow) {
            return false;
        }
        if (isMoreThanOneLevelFilled) {
            $exeDevice.showMessage(
                _(`You can only use text at this item's level`)
            );
            return false;
        }

        let arrayLevels = [];
        let scoreError = 0;
        $('.CTJ-Table .CTJ-data-row').each(function () {
            const $fila = $(this),
                type = $fila.find('.CTJ-Select option:selected').val(),
                points = $fila.find('.CTJ-Points').eq(0).text();

            let nivel = '',
                item = '';

            $fila.find('.CTJ-Levels').each(function () {
                if ($(this).text().trim() !== '') {
                    nivel = $('.CTJ-Table th')
                        .eq($(this).index())
                        .attr('data-nivel');
                    item = $(this).html();
                    return false;
                }
            });

            if (useScore) {
                if (type == 3 && points.trim().length > 0) {
                    scoreError = 2;
                    return false;
                }
            }

            const obj = {
                type: type,
                nivel: nivel,
                item: item,
                points: points,
            };
            arrayLevels.push(obj);
        });

        if (scoreError == 1) {
            $exeDevice.showMessage(
                _(
                    'You must indicate the number of points for each item to be assesed'
                )
            );
            return false;
        } else if (scoreError == 2) {
            $exeDevice.showMessage(
                _('You cannot indicate a score for this type of boxes')
            );
            return false;
        }

        return {
            typeGame: 'Cotejo',
            id: $exeDevice.id,
            title: title,
            subtitle: subtitle,
            levels: arrayLevels,
            hasLogo: hasLogo,
            urlLogo: urlLogo,
            hasCommunity: hasCommunity,
            urlCommunity: urlCommunity,
            hasDecorative: hasDecorative,
            urlDecorative: urlDecorative,
            saveData: saveData,
            userData: userData,
            footer: footer,
            useScore: useScore,
        };
    },
    isNumberInteger: function (str) {
        return Number.isInteger(Number(str)) && Number(str) >= 0;
    },
    addEvents1: function () {
        $('.CTJ-Add').click(function (e) {
            e.preventDefault();
            const parentRow = $(this).closest('.CTJ-data-row'),
                clonedRow = parentRow.clone(true);

            clonedRow
                .find('.CTJ-Level1, .CTJ-Level2, .CTJ-Level3, .CTJ-Level4')
                .html('');
            clonedRow.insertAfter(parentRow);
        });

        $('.CTJ-Delete').click(function (e) {
            e.preventDefault();
            if ($('.CTJ-data-row').length > 1) {
                if (confirm('¿Desea eliminar esta fila?')) {
                    $(this).closest('.CTJ-data-row').remove();
                }
            } else {
                $exeDevice.showMessage(_('There must be at least one row.'));
            }
        });

        $('#ctjEURLLogo').on('change', function () {
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp`'],
                selectedFile = $(this).val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (
                selectedFile.indexOf('files') == 0 &&
                validExt.indexOf(ext) == -1
            ) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
                return false;
            }
            let url = selectedFile,
                alt = _('Project logo');
            $exeDevice.showImage(
                '#ctjEImageLogo',
                '#ctjEImageNoLogo',
                url,
                alt
            );
        });

        $('#ctjEPlayLogo').on('click', function (e) {
            e.preventDefault();
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $('#ctjEURLLogo').val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (
                selectedFile.indexOf('files') == 0 &&
                validExt.indexOf(ext) == -1
            ) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
                return false;
            }
            const url = selectedFile,
                alt = _('Project logo');
            $exeDevice.showImage(
                '#ctjEImageLogo',
                '#ctjEImageNoLogo',
                url,
                alt
            );
        });

        $('#ctjEURLCommunity').on('change', function () {
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'web`'],
                selectedFile = $(this).val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (
                selectedFile.indexOf('files') == 0 &&
                validExt.indexOf(ext) == -1
            ) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
                return false;
            }
            const url = selectedFile,
                alt = _('Community/Company');
            $exeDevice.showImage(
                '#ctjEImageCommunity',
                '#ctjEImageNoCommunity',
                url,
                alt
            );
        });

        $('#ctjEPlayCommunity').on('click', function (e) {
            e.preventDefault();
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'web`'],
                selectedFile = $('#ctjEURLCommunity').val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (
                selectedFile.indexOf('files') == 0 &&
                validExt.indexOf(ext) == -1
            ) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
                return false;
            }
            const url = selectedFile,
                alt = _('Community/Company');
            $exeDevice.showImage(
                '#ctjEImageCommunity',
                '#ctjEImageNoCommunity',
                url,
                alt
            );
        });

        $('#ctjEURLDecorative').on('change', function () {
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'web`'],
                selectedFile = $(this).val(),
                ext = selectedFile.split('.').pop().toLowerCase();

            if (
                selectedFile.indexOf('files') == 0 &&
                validExt.indexOf(ext) == -1
            ) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
                return false;
            }
            const url = selectedFile,
                alt = _('Decoration');
            $exeDevice.showImage(
                '#ctjEImageDecorative',
                '#ctjEImageNoDecorative',
                url,
                alt
            );
        });

        $('#ctjEPlayDecorative').on('click', function (e) {
            e.preventDefault();
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'web`'],
                selectedFile = $('#ctjEURLDecorative').val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (
                selectedFile.indexOf('files') == 0 &&
                validExt.indexOf(ext) == -1
            ) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
                return false;
            }
            const url = selectedFile,
                alt = _('Decoration');
            $exeDevice.showImage(
                '#ctjEImageDecorative',
                '#ctjEImageNoDecorative',
                url,
                alt
            );
        });

        $('#ctjCommunity').change(function () {
            if ($(this).is(':checked')) {
                $('#ctjcommunitylogo').show();
            } else {
                $('#ctjcommunitylogo').hide();
            }
        });

        $('#ctjLogo').change(function () {
            if ($(this).is(':checked')) {
                $('#ctjlogologo').show();
            } else {
                $('#ctjlogologo').hide();
            }
        });

        $('#ctjDecorative').change(function () {
            if ($(this).is(':checked')) {
                $('#ctjdecorativelogo').show();
            } else {
                $('#ctjdecorativelogo').hide();
            }
        });

        $('#ctjUseScore').change(function () {
            if ($(this).is(':checked')) {
                $(
                    '.CTJ-Table .CTJ-Points-column, .CTJ-Table .CTJ-Points'
                ).show();
            } else {
                $(
                    '.CTJ-Table .CTJ-Points-column, .CTJ-Table .CTJ-Points'
                ).hide();
            }
        });

        $('.CTJ-Table')
            .on('change', 'select.CTJ-Select', function () {
                const selectedOptionIndex = $(this).val();
                const pointsCell = $(this).closest('tr').find('.CTJ-Points');
                if (selectedOptionIndex == '3') {
                    pointsCell.text('');
                    pointsCell.attr('contenteditable', 'false');
                } else {
                    pointsCell.attr('contenteditable', 'true');
                }
            })
            .trigger('change');

        $('.CTJ-Table').on('keypress', '.CTJ-Points', function (event) {
            const charCode = event.which ? event.which : event.keyCode;
            if (charCode > 31 && (charCode < 48 || charCode > 57)) {
                event.preventDefault();
            }
        });
    },
    addEvents() {
        const handleImageChange = (
            selectorInput,
            selectorImage,
            selectorNoImage,
            altText
        ) => {
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $(selectorInput).val(),
                ext = selectedFile.split('.').pop().toLowerCase();

            if (selectedFile.startsWith('files') && !validExt.includes(ext)) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: jpg, jpeg, gif, png, svg, webp`
                );
                return false;
            }
            $exeDevice.showImage(
                selectorImage,
                selectorNoImage,
                selectedFile,
                altText
            );
            return true;
        };

        $('.CTJ-Table').on('click', '.CTJ-Add', function (e) {
            e.preventDefault();
            const parentRow = $(this).closest('.CTJ-data-row'),
                clonedRow = parentRow.clone(true);

            clonedRow
                .find('.CTJ-Level1, .CTJ-Level2, .CTJ-Level3, .CTJ-Level4')
                .html('');
            clonedRow.insertAfter(parentRow);
        });

        $('.CTJ-Table').on('click', '.CTJ-Delete', function (e) {
            e.preventDefault();
            if ($('.CTJ-data-row').length > 1) {
                if (confirm(_('Do you want to delete this row?'))) {
                    $(this).closest('.CTJ-data-row').remove();
                }
            } else {
                $exeDevice.showMessage(_('There must be at least one row.'));
            }
        });
        const imageConfig = [
            {
                inputSelector: '#ctjEURLLogo',
                playButtonSelector: '#ctjEPlayLogo',
                imageSelector: '#ctjEImageLogo',
                noImageSelector: '#ctjEImageNoLogo',
                altText: _('Project logo'),
            },
            {
                inputSelector: '#ctjEURLCommunity',
                playButtonSelector: '#ctjEPlayCommunity',
                imageSelector: '#ctjEImageCommunity',
                noImageSelector: '#ctjEImageNoCommunity',
                altText: _('Community/Company'),
            },
            {
                inputSelector: '#ctjEURLDecorative',
                playButtonSelector: '#ctjEPlayDecorative',
                imageSelector: '#ctjEImageDecorative',
                noImageSelector: '#ctjEImageNoDecorative',
                altText: _('Decoration'),
            },
        ];

        imageConfig.forEach((config) => {
            const {
                inputSelector,
                playButtonSelector,
                imageSelector,
                noImageSelector,
                altText,
            } = config;

            $(inputSelector).on('change', () => {
                handleImageChange(
                    inputSelector,
                    imageSelector,
                    noImageSelector,
                    altText
                );
            });

            $(playButtonSelector).on('click', (e) => {
                e.preventDefault();
                handleImageChange(
                    inputSelector,
                    imageSelector,
                    noImageSelector,
                    altText
                );
            });
        });

        const checkboxConfig = [
            {
                checkboxSelector: '#ctjCommunity',
                targetSelector: '#ctjcommunitylogo',
            },
            { checkboxSelector: '#ctjLogo', targetSelector: '#ctjlogologo' },
            {
                checkboxSelector: '#ctjDecorative',
                targetSelector: '#ctjdecorativelogo',
            },
        ];

        checkboxConfig.forEach((config) => {
            const { checkboxSelector, targetSelector } = config;
            $(checkboxSelector).on('change', function () {
                $(targetSelector).toggle($(this).is(':checked'));
            });
        });

        $('#ctjUseScore').on('change', function () {
            const display = $(this).is(':checked') ? 'show' : 'hide';
            $('.CTJ-Table .CTJ-Points-column, .CTJ-Table .CTJ-Points')[
                display
            ]();
        });

        $('.CTJ-Table').on('change', 'select.CTJ-Select', function () {
            const selectedOptionIndex = $(this).val(),
                pointsCell = $(this).closest('tr').find('.CTJ-Points');
            if (selectedOptionIndex === '3') {
                pointsCell.text('').attr('contenteditable', 'false');
            } else {
                pointsCell.attr('contenteditable', 'true');
            }
        });

        $('.CTJ-Table').on('keypress', '.CTJ-Points', function (event) {
            const charCode = event.which || event.keyCode;
            if (charCode > 31 && (charCode < 48 || charCode > 57)) {
                event.preventDefault();
            }
        });
    },

    showImage: function (img, noimg, url, alt) {
        const $image = $(img);
        $image.hide();
        $image.attr('alt', alt);
        $(noimg).show();
        url = $exeDevices.iDevice.gamification.media.extractURLGD(url);
        $image
            .prop('src', url)
            .on('load', function () {
                if (
                    !this.complete ||
                    typeof this.naturalWidth == 'undefined' ||
                    this.naturalWidth == 0
                ) {
                    return false;
                } else {
                    const mData = $exeDevice.placeImageWindows(
                        this,
                        this.naturalWidth,
                        this.naturalHeight
                    );
                    $exeDevice.drawImage(this, mData);
                    $image.show();
                    $(noimg).hide();
                    return true;
                }
            })
            .on('error', function () {
                return false;
            });
    },

    placeImageWindows: function (image, naturalWidth, naturalHeight) {
        const wDiv =
                $(image).parent().width() > 0 ? $(image).parent().width() : 1,
            hDiv =
                $(image).parent().height() > 0 ? $(image).parent().height() : 1,
            varW = naturalWidth / wDiv,
            varH = naturalHeight / hDiv;

        let wImage = wDiv,
            hImage = hDiv,
            xImagen = 0,
            yImagen = 0;

        if (varW > varH) {
            wImage = parseInt(wDiv);
            hImage = parseInt(naturalHeight / varW);
            yImagen = parseInt((hDiv - hImage) / 2);
        } else {
            wImage = parseInt(naturalWidth / varH);
            hImage = parseInt(hDiv);
            xImagen = parseInt((wDiv - wImage) / 2);
        }
        return {
            w: wImage,
            h: hImage,
            x: xImagen,
            y: yImagen,
        };
    },

    updateFieldGame: function (game) {
        game.userData =
            typeof game.userData == 'undefined' ? false : game.userData;
        game.useScore =
            typeof game.useScore == 'undefined' ? false : game.useScore;
        game.weighted =
            typeof game.weighted !== 'undefined' ? game.weighted : 100;
        $exeDevice.id = $exeDevice.getIdeviceID();

        $('#ctjTitle').val(game.title);
        $('#ctjSubTitle').val(game.subtitle);
        $('#ctjSaveData').prop('checked', game.saveData);
        $('#ctjUserData').prop('checked', game.userData);
        $('#ctjLogo').prop('checked', game.hasLogo);
        $('#ctjCommunity').prop('checked', game.hasCommunity);
        $('#ctjDecorative').prop('checked', game.hasDecorative);
        $('#ctjEURLCommunity').val(game.urlCommunity);
        $('#ctjEURLLogo').val(game.urlLogo);
        $('#ctjEURLDecorative').val(game.urlDecorative);
        $('#ctjFooter').val(game.footer);
        $('#ctjUseScore').prop('checked', game.useScore);

        if (game.hasLogo) $('#ctjlogologo').show();
        if (game.hasCommunity) $('#ctjcommunitylogo').show();
        if (game.hasDecorative) $('#ctjdecorativelogo').show();

        for (let i = 0, len = game.levels.length; i < len; i++) {
            game.levels[i].points =
                game.levels[i].points === undefined
                    ? ''
                    : game.levels[i].points;
        }

        $exeDevice.updateTable(game.levels);

        $exeDevice.showImage(
            '#ctjEImageLogo',
            '#ctjEImageNoLogo',
            game.urlLogo,
            _('Project logo')
        );

        $exeDevice.showImage(
            '#ctjEImageCommunity',
            '#ctjEImageNoCommunity',
            game.urlCommunity,
            _('Community/Company')
        );

        $exeDevice.showImage(
            '#ctjEImageDecorative',
            '#ctjEImageNoDecorative',
            game.urlDecorative,
            _('Decorative image')
        );
    },

    drawImage: function (image, mData) {
        $(image).css({
            left: mData.x + 'px',
            top: mData.y + 'px',
            width: mData.w + 'px',
            height: mData.h + 'px',
        });
    },
};
