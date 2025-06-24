/* git */
/**
 * Magnifier iDevice (edition code)
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    // i18n
    i18n: {
        name: _('True or false'),
    },
    idevicePath: '',
    msgs: {
        msgFullScreen: _('Full screen'),
    },
    id: false,
    ci18n: {
        msgTypeGame: _('Magnifier'),
        
    },

    init: function (element, previousData, path) {
        this.ideviceBody = element;

        this.idevicePreviousData = previousData;

        this.idevicePath = path;

        this.id = $(element).attr('idevice-id');
        this.setMessagesInfo();
        this.createForm();
    },

    transformObject: function (data) {
        if (data.typeGame && data.typeGame === 'magnifier') {
            return data;
        }
        const width = data.width ? data.width : '';
        const height = data.height ? data.height : '';
        const align = data.align ?? 'left';
        const instructions = data.instructions || $('<div>').html(data.textTextarea).text().trim();
        const maxZSize = data.maxZSize ? data.maxZSize : 800;
        const glassSize = data.glassSize ? data.glassSize : 100;
        const initalZoom = data.initalZoom ? data.initalZoom : 100;
        const image = data.image || data.defaultImage || $magnifier.idevicePath + 'hood.jpg'
        return {
            id: $magnifier.ideviceId,
            typeGame: 'magnifier',
            instructions,
            msgs: $exeDevice.msgs,
            image,
            width,
            height,
            align,
            initalZoom,
            maxZSize,
            glassSize,
            ideviceId: $magnifier.ideviceId,
            msgs: $magnifier.msgs
        };
    },

    setMessagesInfo: function () {
        const msgs = this.msgs;
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.',
        );
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },


    createForm: function () {
        const path = $exeDevice.idevicePath;
        const zoomOptions = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200];
        const sizeOptions = [50, 100, 150, 200, 250, 300, 400];

        const html = `
            <div id="magnifierIdeviceForm">
                <!-- Instrucciones -->
                <div class="mb-3">
                    <label for="instructions" class="sr-av">${_('Instructions')}:</label>
                    <textarea id="instructions" class="exe-html-editor mb-1">${c_("Use the menus to choose the magnifier's size and zoom, and move the mouse over the image to see the details.")}</textarea>
                </div>

                <div class="container">
                    <div class="ratio ratio-16x9 mb-4 MNFE-Preview">
                        <img src="${path}hood.jpg" alt="Preview" id="mnfPreviewImage"
                            class="img-fluid object-fit-contain object-position-left">
                    </div>
                    <div class="d-flex align-items-center mb-3">
                        <label for="mnfFileInput" class="form-label me-2 mb-0 sr-av">${_('Image URL')}:</label>
                        <input type="text" class="exe-file-picker form-control w-auto" id="mnfFileInput">
                    </div>
                    <div class="row align-items-center mb-3">
                        <label for="mnfWidthInput" class="col-auto col-form-label">${_('Image width')}:</label>
                        <div class="col-auto">
                            <input type="number" class="form-control" id="mnfWidthInput" style="width: 6em;" value="400">
                        </div>
                    </div>
                    <div class="row align-items-center mb-3">
                        <label for="mnfAlignSelect" class="col-auto col-form-label">${_('Align')}:</label>
                        <div class="col-auto">
                            <select class="form-select" id="mnfAlignSelect">
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                            </select>
                        </div>
                    </div>
                    <div class="row align-items-center mb-3">
                        <label for="mnfInitialZoomSelect" class="col-auto col-form-label">${_('Initial Zoom')}:</label>
                        <div class="col-auto">
                            <select class="form-select" id="mnfInitialZoomSelect">
                                ${zoomOptions.map(v => `<option value="${v}"${v === 100 ? ' selected' : ''}>${v}%</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="row align-items-center mb-3">
                        <label for="mnfLensSizeSelect" class="col-auto col-form-label">${_('Magnifier Size')}:</label>
                        <div class="col-auto">
                            <select class="form-select" id="mnfLensSizeSelect">
                                ${sizeOptions.map(v => `<option value="${v}"${v === 100 ? ' selected' : ''}>${v}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.ideviceBody.innerHTML = html;
        this.loadPreviousValues();
        this.addEvents();
    },


    loadPreviousValues: function () {
        let dataGame = this.idevicePreviousData;

        if (dataGame && Object.keys(dataGame).length > 0) {
            const instructions = dataGame.instructions || '';
            dataGame = $exeDevice.transformObject(dataGame);
            if (tinymce.get('instructions')) {
                tinymce.get('instructions').setContent(dataGame.instructions);
            } else {
                $('#instructions').val(instructions);
            }

            $exeDevice.updateFieldGame(dataGame);
        }
    },

    updateFieldGame: function (game) {
        $('#mnfPreviewImage').attr('src', game.image);
        $('#mnfFileInput').val(game.image);
        $('#mnfWidthInput').val(game.width);
        $('#mnfHeightInput').val(game.height);
        $('#mnfAlignSelect').val(game.align);
        $('#mnfInitialZoomSelect').val(game.initalZoom);
        $('#mnfLensSizeSelect').val(game.glassSize);
    },

    save: function () {
        let dataGame = $exeDevice.validateData();
        console.log(dataGame)
        if (dataGame) {
            return dataGame;
        } else {
            return false;
        }
    },
    addEvents: function () {
        $('#mnfFileInput').on('change', function () {
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $(this).val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (
                (selectedFile.startsWith('files')) && !validExt.includes(ext)
            ) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: jpg, jpeg, gif, png, svg, webp`,
                );
                return false;
            }
            $('#mnfPreviewImage').attr('src', selectedFile);

            $ordenaMultimedia.on('click', '.MNF-FullLinkImage', function (e) {
            e.stopPropagation();
            const $image = $(this)
                .closest('.ODNP-CardContainer')
                .find('.ODNP-Image'),
                largeImageSrc = $image.attr('src');
            if (largeImageSrc && largeImageSrc.length > 3) {
                $exeDevices.iDevice.gamification.helpers.showFullscreenImage(
                    largeImageSrc,
                    $('#ordenaGameContainer-' + instance),
                );
            }
        });
        });

    },

    validateData: function () {
        const id = $exeDevice.id,
            image = $('#mnfFileInput').val() || $exeDevice.idevicePath + 'hood.jpg',
            width = $('#mnfWidthInput').val() || '',
            height = $('#mnfHeightInput').val() || '',
            initalZoom = $('#mnfInitialZoomSelect').val() || 100,
            maxZSize = 600,
            glassSize = $('#mnfLensSizeSelect').val() || 100,
            align = $('#mnfAlignSelect').val() || 'left';

        let html = '';
        if (tinyMCE.get('instructions')) {
            html = tinyMCE.get('instructions').getContent();
        }

        html = html.replace(/`/g, '\\`');

        const instructions = `\n${html}\n`;
        return {
            id,
            typeGame: 'magnifier',
            instructions: instructions,
            image,
            height,
            width,
            align,
            initalZoom,
            maxZSize,
            glassSize,
            ideviceId: id,
        };
    },
};
