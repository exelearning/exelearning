/**
 * Download Package iDevice (edition code)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Ignacio Gros (http://gros.es/) for http://exelearning.net/
 *
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    // We use eXe's _ function
    i18n: {
        name: _('Download source file'),
    },

    // Messages
    warningMessage:
        '<p class="exe-block-warning">' +
        _(
            'Before adding a download link to your page, please go to the Properties tab and check if the information is right.'
        ) +
        '</p>',

    // eXeLicenses
    eXeLicenses: [
        [_('creative commons: attribution 4.0'), 'by/4.0'],
        [
            _('creative commons: attribution - non derived work 4.0'),
            'by-nd/4.0',
        ],
        [
            _(
                'creative commons: attribution - non derived work - non commercial 4.0'
            ),
            'by-nc-nd/4.0',
        ],
        [_('creative commons: attribution - non commercial 4.0'), 'by-nc/4.0'],
        [
            _(
                'creative commons: attribution - non commercial - share alike 4.0'
            ),
            'by-nc-sa/4.0',
        ],
        [_('creative commons: attribution - share alike 4.0'), 'by-sa/4.0'],
        [_('creative commons: attribution 3.0'), 'by/3.0'],
        [
            _('creative commons: attribution - non derived work 3.0'),
            'by-nd/3.0',
        ],
        [
            _(
                'creative commons: attribution - non derived work - non commercial 3.0'
            ),
            'by-nc-nd/3.0',
        ],
        [_('creative commons: attribution - non commercial 3.0'), 'by-nc/3.0'],
        [
            _(
                'creative commons: attribution - non commercial - share alike 3.0'
            ),
            'by-nc-sa/3.0',
        ],
        [_('creative commons: attribution - share alike 3.0'), 'by-sa/3.0'],
        [_('creative commons: attribution 2.5'), 'by/2.5'],
        [
            _('creative commons: attribution - non derived work 2.5'),
            'by-nd/2.5',
        ],
        [
            _(
                'creative commons: attribution - non derived work - non commercial 2.5'
            ),
            'by-nc-nd/2.5',
        ],
        [_('creative commons: attribution - non commercial 2.5'), 'by-nc/2.5'],
        [
            _(
                'creative commons: attribution - non commercial - share alike 2.5'
            ),
            'by-nc-sa/2.5',
        ],
        [_('creative commons: attribution - share alike 2.5'), 'by-sa/2.5'],
    ],

    /**
     *
     * @param {*} str
     * @returns
     */
    completeLicense: function (str) {
        if (str === 'propietary license') return c_('Proprietary license');
        if (str === 'not appropriate') return c_('Not appropriate');
        if (str === 'public domain') return c_('Public domain');

        // CC0 uses a publicdomain URL, not the standard licenses/ path
        if (str === _('creative commons: cc0 1.0') || str.toLowerCase() === 'creative commons: cc0 1.0') {
            return '<a href="https://creativecommons.org/publicdomain/zero/1.0/" rel="license" class="cc cc-0"><span></span>Creative Commons CC0 1.0</a>';
        }
        var licenses = this.eXeLicenses;
        var license;
        var type;
        var css;
        for (let i = 0; i < licenses.length; i++) {
            license = licenses[i];
            if (license[0] === str) {
                type = license[1].replace('/', ' ').toUpperCase();
                css = license[1].split('/');
                css = 'cc cc-' + css[0];
                str =
                    '<a href="https://creativecommons.org/licenses/' +
                    license[1] +
                    '/" rel="license" class="' +
                    css +
                    '"><span></span>Creative Commons ' +
                    type +
                    '</a>';
            }
        }
        return str;
    },

    /**
     * Updates the property placeholders with live data from eXe
     *
     */
    updateProperties: function () {
        var properties = eXe.app.getProjectProperties();
        var data1 = '-';
        var data2 = '-';
        var data3 = '-';
        var data4 = '-';

        var _data1 = properties.pp_title;
        if (_data1 && _data1.value && _data1.value != '') {
            data1 = _data1.value;
        }
        var _data2 = properties.pp_description;
        if (_data2 && _data2.value && _data2.value != '') {
            data2 = _data2.value;
        }
        var _data3 = properties.pp_author;
        if (_data3 && _data3.value && _data3.value != '') {
            data3 = _data3.value;
        }
        var _data4 = properties.pp_license;
        if (_data4 && _data4.value && _data4.value != '') {
            data4 = this.completeLicense(_data4.value);
        }

        if (tinymce.editors.length > 0 && tinymce.editors[0] && tinymce.editors[0].getDoc()) {
            var doc = tinymce.editors[0].getDoc();
            if (doc) {
                $('.exe-prop-locked .exe-prop-title', doc).html(data1);
                $('.exe-prop-locked .exe-prop-description', doc).html(data2);
                $('.exe-prop-locked .exe-prop-author', doc).html(data3);
                $('.exe-prop-locked .exe-prop-license', doc).html(data4);
            }
        }
        var desc = $('#dpiDescription');
        if (desc.length > 0) {
            var content = desc.val();
            if (content) {
                var wrapper = $('<div></div>').html(content);
                $('.exe-prop-locked .exe-prop-title', wrapper).html(data1);
                $('.exe-prop-locked .exe-prop-description', wrapper).html(data2);
                $('.exe-prop-locked .exe-prop-author', wrapper).html(data3);
                $('.exe-prop-locked .exe-prop-license', wrapper).html(data4);
                desc.val(wrapper.html());
            }
        }
    },

    /**
     *
     * @param {*} element
     * @param {*} previousData
     * @param {*} path
     */
    init: function (element, previousData, path) {
        //** eXeLearning idevice engine data ***************************
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        //**************************************************************
        this.createForm();
    },

    // Create the form to insert HTML in the TEXTAREA
    createForm: function () {
        var properties = eXe.app.getProjectProperties();
        var emptyP = true;
        if (properties.pp_title && properties.pp_title.value && properties.pp_title.value != '') emptyP = false;
        if (properties.pp_description && properties.pp_description.value && properties.pp_description.value != '') emptyP = false;
        if (properties.pp_author && properties.pp_author.value && properties.pp_author.value != '') emptyP = false;
        if (properties.pp_license && properties.pp_license.value && properties.pp_license.value != '') emptyP = false;

        if (emptyP) {
            let text = _(
                "Please don't forget to check the Properties tab: Title, language, license, author, description..."
            );
            eXe.app.alert(text);
        }

        // i18n
        var str1 = c_('General information about this educational resource');
        var str2 = c_('Title');
        var str3 = c_('Description');
        var str4 = c_('Authorship');
        var str5 = c_('License');
        var str6 = c_(
            'This content was created with eXeLearning, your free and open source editor to create educational resources.'
        );
        var str7 = c_('Download .elp file');

        // Note: The td wraps the span with mceNonEditable so the entire cell is immutable to the user
        // Styling is handled by global tinymce_5_extra.css to prevent inline styles from cloning to new rows
        var tdClass = 'class="mceNonEditable exe-prop-locked"';
        var pData1 = '<span class="exe-prop-title"></span>';
        var pData2 = '<span class="exe-prop-description"></span>';
        var pData3 = '<span class="exe-prop-author"></span>';
        var pData4 = '<span class="exe-prop-license"></span>';

        var defaultContent =
            '\
			<table class="exe-table exe-package-info">\
				<caption>' +
            str1 +
            ' </caption>\
				<tbody>\
					<tr>\
						<th>' +
            str2 +
            ' </th>\
						<td ' + tdClass + '>' +
            pData1 +
            ' </td>\
					</tr>\
					<tr>\
						<th>' +
            str3 +
            ' </th>\
						<td ' + tdClass + '>' +
            pData2 +
            ' </td>\
					</tr>\
					<tr>\
						<th>' +
            str4 +
            ' </th>\
						<td ' + tdClass + '>' +
            pData3 +
            ' </td>\
					</tr>\
					<tr>\
						<th>' +
            str5 +
            ' </th>\
						<td ' + tdClass + '>' +
            pData4 +
            ' </td>\
					</tr>\
				</tbody>\
			</table>\
			<p style="text-align:center">' +
            str6.replace(
                'eXeLearning',
                '<a href="https://exelearning.net/">eXeLearning</a>'
            ) +
            '</p>';

        var html =
            '\
			<div id="eXeDownloadPackageForm">\
				<p><label for="dpiDescription">' +
            _(
                'This block will create a link to download the elp file. Write some use instructions and customize your download link.'
            ) +
            '</label></p>\
				<p><textarea id="dpiDescription" class="exe-html-editor">' +
            defaultContent +
            '</textarea></p>\
				<fieldset>\
					<legend>' +
            _('Download link') +
            '</legend>\
					<p>\
						<label for="dpiButtonText">' +
            _('Button text:') +
            ' </label><input type="text" id="dpiButtonText" value="' +
            str7 +
            '" /> \
						<label for="dpiButtonFontSize" class="dpi-label-col">' +
            _('Font size') +
            ': </label>\
						<select id="dpiButtonFontSize">\
							<option value="1" selected="selected">100%</option>\
							<option value="1.1">110%</option>\
							<option value="1.2">120%</option>\
							<option value="1.3">130%</option>\
							<option value="1.4">140%</option>\
							<option value="1.5">150%</option>\
						</select>\
					</p>\
					<p>\
						<label for="dpiButtonBGcolor">' +
            _('Background Color') +
            ': </label> \
            <input type="color" id="dpiButtonBGcolor" class="exe-color-picker" value="#107275"/> \
						<label for="dpiButtonTextColor" class="dpi-label-col">' +
            _('Text Color') +
            ': </label> \
            <input type="color" id="dpiButtonTextColor" class="exe-color-picker" value="#ffffff" /> \
					</p>\
				</fieldset>\
			</div>\
		';
        this.ideviceBody.innerHTML = html;
        this.loadPreviousValues();

        // Populate values initially
        this.updateProperties();

        // Listen to focus changes
        $(window).off('focus.dlSourceFile').on('focus.dlSourceFile', function () {
            if ($('#eXeDownloadPackageForm').length > 0) {
                $exeDevice.updateProperties();
            } else {
                $(window).off('focus.dlSourceFile');
            }
        });

        // Update when TinyMCE is ready
        var updateInterval = setInterval(function() {
            if (tinymce.editors.length > 0 && tinymce.editors[0] && tinymce.editors[0].getDoc()) {
                $exeDevice.updateProperties();
                clearInterval(updateInterval);
            }
        }, 500);
        setTimeout(function() {
            clearInterval(updateInterval);
        }, 5000);
    },

    /**
     *
     * @param {*} color
     * @returns
     */
    rgb2hex: function (color) {
        var rgb = color.replace(/\s/g, '').match(/^rgba?\((\d+),(\d+),(\d+)/i);
        return rgb && rgb.length === 4
            ? ('0' + parseInt(rgb[1], 10).toString(16)).slice(-2) +
                  ('0' + parseInt(rgb[2], 10).toString(16)).slice(-2) +
                  ('0' + parseInt(rgb[3], 10).toString(16)).slice(-2)
            : color;
    },

    /**
     * Load the saved values in the form
     *
     */
    loadPreviousValues: function () {
        var originalHTML = this.idevicePreviousData;
        if (originalHTML != '') {
            var wrapper = $('<div></div>');
            wrapper.html(originalHTML);
            // Instructions
            var dpiDescription = $(
                '.exe-download-package-instructions',
                wrapper
            );
            if (dpiDescription.length == 1 && dpiDescription.html() != '') {
                // Find table and convert plain text cells to placeholders
                var table = $('table.exe-package-info', dpiDescription);
                if (table.length == 1) {
                    var tds = $('td', table);
                    if (tds.length == 4) {
                        var tdClass = 'mceNonEditable exe-prop-locked';
                        
                        var ensureTdLocked = function($td, propClass) {
                            $td.attr('class', tdClass);
                            $td.removeAttr('style'); // Strip legacy inline styles dynamically so they are no longer cloned
                            if ($td.find('.' + propClass).length == 0) {
                                $td.html('<span class="' + propClass + '"></span>');
                            } else {
                                // If span already exists, ensure it doesn't have legacy mceNonEditable classes
                                $td.find('.' + propClass).removeClass('mceNonEditable').css({'opacity': '', 'cursor': ''});
                            }
                        };

                        ensureTdLocked($(tds[0]), 'exe-prop-title');
                        ensureTdLocked($(tds[1]), 'exe-prop-description');
                        ensureTdLocked($(tds[2]), 'exe-prop-author');
                        ensureTdLocked($(tds[3]), 'exe-prop-license');
                    }
                }
                $('#dpiDescription').val(dpiDescription.html());
            }
            // Button
            var downloadButton = $('.exe-download-package-link a', wrapper);
            if (downloadButton.length == 1) {
                // Button text
                var dpiButtonText = downloadButton.text();
                if (dpiButtonText != '') {
                    $('#dpiButtonText').val(dpiButtonText);
                }
                // Font size
                var dpiButtonFontSize = downloadButton.css('font-size');
                if (dpiButtonFontSize != '') {
                    dpiButtonFontSize = dpiButtonFontSize.replace('em', '');
                    if (
                        dpiButtonFontSize == '1.1' ||
                        dpiButtonFontSize == '1.2' ||
                        dpiButtonFontSize == '1.3' ||
                        dpiButtonFontSize == '1.4' ||
                        dpiButtonFontSize == '1.5'
                    ) {
                        $('#dpiButtonFontSize').val(dpiButtonFontSize);
                    }
                }
                // Background color
                var dpiButtonBGcolor = downloadButton.css('background-color');
                dpiButtonBGcolor = $exeDevice.rgb2hex(dpiButtonBGcolor);
                if (dpiButtonBGcolor.length == 6)
                    $('#dpiButtonBGcolor').val('#' + dpiButtonBGcolor);
                // Text color
                var dpiButtonTextColor = downloadButton.css('color');
                dpiButtonTextColor = $exeDevice.rgb2hex(dpiButtonTextColor);
                if (dpiButtonTextColor.length == 6)
                    $('#dpiButtonTextColor').val('#' + dpiButtonTextColor);
            }
        }
    },

    /**
     *
     * @returns
     */
    save: function () {
        // Get the content
        if (tinymce.editors.length == 0) return $exeDevice.warningMessage; // The .exe-block-info is displayed
        // Instructions
        var dpiDescription = tinymce.editors[0].getContent();
        if (dpiDescription == '') {
            eXe.app.alert(
                _(
                    'Please provide some instructions or information about the resource.'
                )
            );
            return false;
        }

        // Inject properties into HTML
        var properties = eXe.app.getProjectProperties();
        var data1 = '-'; var data2 = '-'; var data3 = '-'; var data4 = '-';
        if (properties.pp_title && properties.pp_title.value) data1 = properties.pp_title.value;
        if (properties.pp_description && properties.pp_description.value) data2 = properties.pp_description.value;
        if (properties.pp_author && properties.pp_author.value) data3 = properties.pp_author.value;
        if (properties.pp_license && properties.pp_license.value) data4 = this.completeLicense(properties.pp_license.value);

        var descWrapper = $('<div></div>').html(dpiDescription);

        // Remove cloned property spans from newly added rows
        // to prevent overwriting user input in cloned rows
        var fixClonedRows = function() {
            var wrappers = descWrapper[0] ? [descWrapper[0]] : descWrapper.toArray();
            for (var w = 0; w < wrappers.length; w++) {
                var elements = wrappers[w].querySelectorAll('.exe-prop-title, .exe-prop-description, .exe-prop-author, .exe-prop-license');
                for (var i = 0; i < elements.length; i++) {
                    var el = elements[i];
                    var td = el.closest ? el.closest('td') : null;
                    // Fallback for older browsers if closest isn't available
                    if (!td) {
                        var curr = el.parentNode;
                        while(curr && curr.tagName !== 'TD' && curr.tagName !== 'BODY') curr = curr.parentNode;
                        if (curr && curr.tagName === 'TD') td = curr;
                    }
                    
                    // Legitimate cells retain the exe-prop-locked class. 
                    // Rows cloned by TinyMCE drop classes but keep contents/inline styles.
                    if (td && !td.classList.contains('exe-prop-locked')) {
                        td.style.backgroundColor = '';
                        td.style.color = '';
                        td.style.cursor = '';
                        if (!td.getAttribute('style')) td.removeAttribute('style');
                        
                        // Strip the class so it cannot be targeted
                        el.className = el.className.replace(/exe-prop-[a-z]+/g, '').trim();
                        
                        // Unwrap the span
                        var parent = el.parentNode;
                        while (el.firstChild) {
                            parent.insertBefore(el.firstChild, el);
                        }
                        parent.removeChild(el);
                    }
                }
            }
        };

        fixClonedRows();

        $('.exe-prop-title', descWrapper).html(data1);
        $('.exe-prop-description', descWrapper).html(data2);
        $('.exe-prop-author', descWrapper).html(data3);
        $('.exe-prop-license', descWrapper).html(data4);
        

        dpiDescription = descWrapper.html();
        // Button text
        var dpiButtonText = $('#dpiButtonText').val();
        // Remove HTML tags (just in case)
        var wrapper = $('<div></div>');
        wrapper.html(dpiButtonText);
        dpiButtonText = wrapper.text();
        if (dpiButtonText == '') {
            eXe.app.alert(_('You should write the button text.'));
            return false;
        }
        // Extra CSS
        var css = '';
        var dpiButtonFontSize = $('#dpiButtonFontSize').val();
        if (dpiButtonFontSize != '1')
            css += 'font-size:' + dpiButtonFontSize + 'em;';
        var dpiButtonBGcolor = $('#dpiButtonBGcolor').val();
        if (dpiButtonBGcolor != '' && dpiButtonBGcolor.length == 7)
            css += 'background-color:' + dpiButtonBGcolor + ';';
        var dpiButtonTextColor = $('#dpiButtonTextColor').val();
        if (dpiButtonTextColor != '' && dpiButtonTextColor.length == 7)
            css += 'color:' + dpiButtonTextColor + ';';
        if (css != '') css = ' style="' + css + '"';
        var html =
            '<div class="exe-download-package-instructions">' +
            dpiDescription +
            '</div>';
        html += '<p class="exe-download-package-link">';
        html +=
            '<a download="exe-package:elp-name" href="exe-package:elp"' +
            css +
            '>' +
            dpiButtonText +
            '</a>';
        html += '</p>';
        // Return the HTML to save
        return html;
    },
};
