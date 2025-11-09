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
        name: _('Magnifier'),
    },
    idevicePath: '',
    msgs: {
        msgFullScreen: _('Full screen'),
        msgNotImage: _('The image is not available.'),
    },
    id: false,
    ci18n: {
        msgTypeGame: _('Magnifier'),
    },
    idevicePath: '',
    defaultImage: '',

    init: function (element, previousData, path) {
        this.ideviceBody = element;

        this.idevicePreviousData = previousData;

        this.idevicePath = path;

        this.defaultImage = path + 'hood.jpg';

        this.id = $(element).attr('idevice-id');
        this.setMessagesInfo();
        this.createForm();
    },

    setMessagesInfo: function () {
        const msgs = this.msgs;
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.'
        );
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    createForm: function () {
        const path = $exeDevice.idevicePath;
        const zoomOptions = [
            100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 250, 300,
            400, 600,
        ];

        const html = `
            <div id="magnifierIdeviceForm">
                <div class="mb-3">
                    <label for="instructions" class="sr-av">${_('Instructions')}:</label>
                    <textarea id="instructions" class="exe-html-editor mb-1">${c_("Choose the zoom and the magnifier's size. Then move your mouse over the image to see it enlarged.")}</textarea>
                </div>
                <div class="container">
                    <div class="ratio ratio-16x9 mb-4 MNFE-Preview">
                        <img src="${path}hood.jpg" alt="Preview" id="mnfPreviewImage"
                            class="img-fluid object-fit-contain object-position-left">
                    </div>
                    <div class="d-flex align-items-center mb-3">
                        <label for="mnfFileInput" class="form-label me-2 mb-0 sr-av">${_('Image URL')}:</label>
                        <input type="text" class="exe-file-picker form-control w-auto" id="mnfFileInput" />
                    </div>
                    <div class="row align-items-center mb-3">
                        <label for="mnfWidthInput" class="col-auto col-form-label">${_('Image width')}:</label>
                        <div class="col-auto">
                            <input type="number" class="form-control" id="mnfWidthInput" style="width: 6em;" value="400" min="200" max="1000">
                        </div>
                    </div>
                    <div class="row align-items-center mb-3">
                        <label for="mnfAlignSelect" class="col-auto col-form-label">${_('Align')}:</label>
                        <div class="col-auto">
                            <select class="form-select" id="mnfAlignSelect">
                                <option value="left">${_('Left')}</option>                               
                                <option value="right">${_('Right')}</option>
                                <option value="none" selected>${_('None')}</option>
                            </select>
                        </div>
                    </div>
                    <div class="row align-items-center mb-3">
                        <label for="mnfInitialZoomSelect" class="col-auto col-form-label">${_('Initial Zoom')}:</label>
                        <div class="col-auto">
                            <select class="form-select" id="mnfInitialZoomSelect">
                                ${zoomOptions.map((v) => `<option value="${v}"${v === 200 ? ' selected' : ''}>${v}%</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="row align-items-center mb-3">
                        <label for="mnfLensSizeSelect" class="col-auto col-form-label">${_('Magnifier Size')}:</label>
                        <div class="col-auto">
                            <select class="form-select" id="mnfLensSizeSelect">
                                <option value="1">50</option>
                                <option value="2" selected>100</option>
                                <option value="3">150</option>
                                <option value="4">200</option>
                                <option value="5">250</option>
                                <option value="6">300</option>
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
            $exeDevice.updateFieldGame(dataGame);
        }
    },

    updateFieldGame: function (data) {
        const width = Math.max(200, Math.min(data.width || 600, 1000));
        const height = data.height ?? '';
        const align = data.align ?? 'left';
        const defaultImage = $exeDevice.defaultImage;
        const textTextarea = data.textTextarea;
        const glassSize = data.glassSize ? data.glassSize : 1;
        const imageResource = data.imageResource;
        const initialZSize = data.initialZSize ?? 100;
        const isDefaultImage = data.isDefaultImage;
        const pathImage = isDefaultImage == '0' ? imageResource : '';
        const image = isDefaultImage == '0' ? imageResource : defaultImage;

        $('#mnfFileInput').val(pathImage);
        $exeDevice.loadImageWithFallback(data);
        $('#mnfPreviewImage').attr('src', image);

        $('#mnfWidthInput').val(width);
        $('#mnfHeightInput').val(height);
        $('#mnfAlignSelect').val(align);
        $('#mnfInitialZoomSelect').val(initialZSize);
        $('#mnfLensSizeSelect').val(glassSize);
        if (tinymce.get('instructions')) {
            tinymce.get('instructions').setContent(textTextarea);
        } else {
            $('#instructions').val(textTextarea);
        }
    },
    loadImageWithFallback: function (data) {
        $('#mnfPreviewImage')
            .off('error')
            .on('error', function () {
                $(this).off('error').attr('src', $exeDevice.defaultImage);
                data.isDefaultImage = '0';
                $('#mnfFileInput').val('');
            })
            .attr('src', data.image);
    },
    save: function () {
        let dataGame = $exeDevice.validateData();
        if (dataGame) {
            return dataGame;
        } else {
            return false;
        }
    },
    addEvents: function () {
        $('#mnfFileInput').on('input change', function () {
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'];
            const selectedFile = $(this).val().trim();
            const ext = selectedFile.split('.').pop().toLowerCase();
            if (selectedFile.startsWith('files') && !validExt.includes(ext)) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: jpg, jpeg, gif, png, svg, webp`
                );
                return;
            }
            $('#mnfPreviewImage').attr(
                'src',
                selectedFile || $exeDevice.defaultImage
            );
        });
        $('#mnfWidthInput')
            .on('input', function () {
                const v = $(this).val();
                if (v === '') return;
                if (!/^\d*$/.test(v)) {
                    $(this).val(String(v).replace(/\D/g, ''));
                }
            })
            .on('change blur', function () {
                let val = parseInt($(this).val(), 10);
                if (isNaN(val)) {
                    $(this).val('');
                    return;
                }
                const min = 200,
                    max = 1000;
                if (val < min) val = min;
                if (val > max) val = max;
                $(this).val(val);
            });
    },

    validateData: function () {
        const id = $exeDevice.id,
            imageResource = $('#mnfFileInput').val(),
            isDefaultImage = imageResource ? '0' : '1',
            width = $('#mnfWidthInput').val() || '',
            height = $('#mnfHeightInput').val() || '',
            initialZSize = $('#mnfInitialZoomSelect').val() || 100,
            maxZSize = 600,
            glassSize = $('#mnfLensSizeSelect').val() || 100,
            align = $('#mnfAlignSelect').val() || 'left',
            defaultImage = $exeDevice.idevicePath + 'hood.jpg';

        let html = '';
        if (tinyMCE.get('instructions'))
            html = tinyMCE.get('instructions').getContent();

        const textTextarea = html;

        return {
            id,
            typeGame: 'magnifier',
            textTextarea,
            isDefaultImage,
            imageResource,
            defaultImage,
            height,
            width,
            align,
            initialZSize,
            maxZSize,
            glassSize,
            ideviceId: id,
        };
    },
};
