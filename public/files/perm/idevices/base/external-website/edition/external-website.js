var $exeDevice = {
    i18n: {
        name: _('External website'),
        // Spanish
        es: {
            'Remember that in HTTPS sites it is not possible to include HTTP pages':
                'Recuerde que en los sitios HTTPS no es posible incluir páginas HTTP',
            'empty field': 'Campo vacio.',
            Insert: 'Insertar',
            incorrect: 'incorrecta.',
            'Frame height:': 'Altura del marco:',
        },
    },

    /**
     *
     */
    init: function (element, previousData, path) {
        //** eXeLearning idevice engine data ***************************
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        //**************************************************************
        this.createForm();
    },

    /**
     * Create the form to insert HTML in the TEXTAREA
     *
     */
    createForm: function () {
        var html =
            '\
      <div id="websiteIdeviceForm">\
        <div id="websiteContainer">\
          <label class="text1" for="websiteUrl">' +
            _('URL') +
            ': </label>\
          <input type="text" id="websiteUrl" />\
          <p class="text2">' +
            _(
                'Remember that in HTTPS sites it is not possible to include HTTP pages'
            ) +
            '</p>\
        </div>\
        <div id="sizeSelectorContainer">\
          <label class="text1" for="sizeSelector"> ' +
            _('Frame height:') +
            '</label>\
          <select id="sizeSelector">\
            <option id="small" value="1">' +
            _('small') +
            '</option>\
            <option id="medium" value="2" selected>' +
            _('medium') +
            '</option>\
            <option id="large" value="3">' +
            _('large') +
            '</option>\
            <option id="super-size" value="4">' +
            _('super-size') +
            '</option>\
          </select>\
        </div>\
      </div>\
    ';
        this.ideviceBody.innerHTML = html;
        this.loadPreviousValues();
    },

    /**
     * Load the saved values in the form fields
     *
     */
    loadPreviousValues: function () {
        var originalHTML = this.idevicePreviousData;
        if (originalHTML != '') {
            var wrapper = $('<div></div>');
            wrapper.html(originalHTML);
            var website = $('iframe', wrapper).attr('src');
            var sizeOption = $('iframe', wrapper).attr('size');
            if (website && website.length > 0) {
                $('#websiteUrl').val(website);
            }
            if (sizeOption) {
                $('#sizeSelector option[value="' + sizeOption + '"]').prop(
                    'selected',
                    true
                );
            }
        }
    },

    /**
     * Check url exits
     * selected options
     *
     * @returns {String}
     */
    save: function () {
        var html = '';
        var errorMessage = c_(
            'Unable to display an iframe loaded over HTTP on a website that uses HTTPS.'
        );
        var url = $('#websiteUrl').val();
        var option = $('#sizeSelector').val();
        // Check url
        regexp =
            /(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
        if (!regexp.test(url)) {
            if (url == '') {
                eXe.app.alert(
                    _('empty field') + ' <br>' + _('Insert') + ' ' + _('URL')
                );
            } else {
                eXe.app.alert(_('URL') + ' ' + _('incorrect'));
            }
            return false;
        } else {
            // Save html
            html = this.generateHtmlExport(url, option, errorMessage);
            return html;
        }
    },

    /**
     * Generate export html
     *
     * @param {*} url
     * @param {*} option
     * @param {*} errorMessage
     * @returns {String}
     */
    generateHtmlExport: function (url, option, errorMessage) {
        var height = this.getHeightByOption(option);
        html =
            '\
      <div id="iframeWebsiteIdevice"> \
      <iframe src="' +
            url +
            '" size="' +
            option +
            '" width="600" height="' +
            height +
            '" style="width:100%;">\
      </iframe>\
      <div class="iframe-error-message" style="display:none;">' +
            errorMessage +
            '</div> \
      </div>\
      ';
        return html;
    },

    /**
     * Get iframe height
     *
     * @param {*} option
     * @returns {Number}
     */
    getHeightByOption: function (option) {
        let height;
        switch (option) {
            case '1':
                height = 200;
                break;
            case '2':
                height = 300;
                break;
            case '3':
                height = 500;
                break;
            case '4':
                height = 800;
                break;
            default:
                height = 300;
        }
        return height;
    },
};
