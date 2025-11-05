/**
 * UDL Content iDevice (edition code)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Ignacio Gros (http://gros.es/) for Consejería de Educación y Deporte, Junta de Andalucía (https://moocedu.juntadeandalucia.es/)
 * Cofinanced with the European Union FEDER funds.
 *
 * Characters and alternative content icons: Consejería de Educación y Deporte (Junta de Andalucía)
 * Add, move, delete block icons: Francisco Javier Pulido
 *
 *
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    // Allow empty paragraphs?
    allowEmptyParagraphs: false,

    // Each block is stored in a JSON object
    // This is de default content (an empty block)
    defaultContent: [
        {
            btnTxt: '',
            btnType: 0,
            contMain: '',
            contAlt1: '',
            contAlt2: '',
            contAlt3: '',
        },
    ],

    // Image names (characters)
    characters: ['', 'MOTUS', 'KARDIA', 'CLAVIS', 'LUMEN'],

    // Translatable strings (Language tab)
    ci18n: {
        simplified: c_('Easier to read'),
        audio: c_('Audio'),
        visual: c_('Visual aid'),
        hide: c_('Close'),
    },

    // i18n
    i18n: {
        // Required strings
        title: _('UDL Content'),
        shortTitle: _('UDL'), // That will be the title of the Style
        longTitle: _('Universal Design for Learning'), // Not used (help text)

        // Auto-complete
        datalist: [
            _('Activity'),
            _('Highlight'),
            _('Download the source file'),
            _('Example'),
            _('Exercises'),
            _('Write'),
            _('Listen'),
            _('Do it here'),
            _('Record'),
            _('Speak'),
            _('Read'),
            _('Objectives'),
            _('Guidance'),
            _('Information'),
            _('To get informed'),
            _('Think'),
            _('Assessment rubric'),
            _('Task'),
            _('Timing'),
            _('Work in group'),
            _('More information'),
            _('Challenge'),
            _('Note'),
            _('Trivia'),
            _('Cultural notes'),
            _('Learn to learn'),
            _('Instrument practice'),
            _('Music'),
            _('Mediation'),
            _('Use your hands'),
            _('Sign language'),
            _('Homogeneous groups'),
            _('Heterogeneous groups'),
            _('Debate'),
            _('Written text coproduction'),
            _('Oral text coproduction'),
            _('Digital competence'),
            _('Singing'),
            _('Semantic networks'),
            _('Easy read'),
            _('Important'),
            _('Grammar'),
            _('Vocabulary'),
            _('Playback'),
            _('Phonetics'),
            _('Visual aid'),
            _('Alternative content'),
        ],
    },

    // Go!
    init: function (element, previousData, path) {
        //** eXeLearning idevice engine data ***************************
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        //**************************************************************
        this.createForm();
        this.addDataListToTitle();
    },

    // Title auto-complete
    addDataListToTitle: function () {
        var opts = '';
        var lang = $('html').eq(0).attr('lang');
        if (typeof exe_elp_lang != 'undefined') exe_elp_lang = lang;
        var datalist = $exeDevice.i18n.datalist;
        for (var i = 0; i < datalist.length; i++) {
            opts += '<option>' + _(datalist[i]) + '</option>';
        }
        if (opts == '') return;
        var tit = $("#activeIdevice input[type='text']").eq(0);
        tit.attr('placeholder', _('Double click or type to see suggestions'));
        opts =
            '<datalist id="activeIdeviceTitleSuggestions">' +
            opts +
            '</datalist>';
        tit.after(opts);
        tit.attr('list', 'activeIdeviceTitleSuggestions');
    },

    // Create the form to insert HTML in the TEXTAREA
    createForm: function () {
        var html =
            '\
			<div id="udlContentForm" class="udl-udl-contentIdevice" >\
				<p id="udlContentTypeOptions">\
					<strong>' +
            _('Type') +
            ':</strong> \
					<label for="udlContentType-engagement" class="active"><input type="radio" name="udlContentType" id="udlContentType-engagement" value="engagement" checked="checked" /> ' +
            _('Engagement') +
            '</label> \
					<label for="udlContentType-representation"><input type="radio" name="udlContentType" id="udlContentType-representation" value="representation" /> ' +
            _('Representation') +
            '</label> \
					<label for="udlContentType-expression"><input type="radio" name="udlContentType" id="udlContentType-expression" value="expression" /> ' +
            _('Action & Expression') +
            '</label> \
				</p>\
				<p id="udlContentFormAddBlockWrapper"><a href="#" id="udlContentFormAddBlock" title="' +
            _('New block') +
            '">' +
            _('New block') +
            '</a></p>\
				<div id="udlContentFormBlocks"></div>\
			</div>\
			<p id="udlContentFormInfo">\
				<a href="#udlContentFormInfoContent" title="' +
            _('About this iDevice') +
            '"><span class="sr-av">' +
            _('About this iDevice') +
            '</span></a>\
				<span id="udlContentFormInfoContent">' +
            _('Cofinanced by:') +
            ' <span lang="es"><img src="' +
            this.idevicePath +
            'udl-content-logos.png" width="600" height="237" title="FEDER - Consejería de Educación y Deporte - Andalucía se mueve con Europa" alt="Unión Europea - FEDER - Junta de Andalucía - Consejería de Educación y Deporte - Andalucía se mueve con Europa" /></span></span>\
			</p>\
		';
        // Language tab (i18n)
        var strs = {};
        for (var i in this.ci18n) {
            strs[i] = _(this.ci18n[i]);
        }
        var tab =
            $exeDevicesEdition.iDevice.gamification.common.getLanguageTab(strs);
        html =
            '<div id="udlContentEditorWrapper"><div class="exe-form-tab" title="' +
            _('General settings') +
            '">' +
            html +
            '</div>' +
            tab +
            '</div>';
        this.ideviceBody.innerHTML = html;
        this.addCommonEvents();
        this.loadPreviousValues();
    },

    // JavaScript Common Events
    addCommonEvents: function () {
        $("input[name='udlContentType']").change(function () {
            $exeDevice.setActiveType(this.value);
        });
        // Add new block
        $('#udlContentFormAddBlock').click(function () {
            // Update the data
            var data = $exeDevice.formToJSON();
            // Add a new element
            data.push($exeDevice.defaultContent[0]);
            // Delete the editors
            $exeDevice.deleteEditors();
            // Remove the blocks
            $('#udlContentFormBlocks').html('');
            // Create a new form
            $exeDevice.jsonToForm(data);
            return false;
        });
        // Enable the tabs
        $exeDevicesEdition.iDevice.tabs.init('udlContentEditorWrapper');
        // iDevice info
        $('#udlContentFormInfo a').click(function () {
            $('#udlContentFormInfoContent').toggle();
            return false;
        });
    },

    // Add JavaScript events to the block elements
    addBlockEvents: function (i) {
        var block = $('#udlContentFormBlock-' + i);
        $('header', block)
            .eq(0)
            .attr('title', _('Hide') + '/' + _('Show') + ' #' + (i + 1));
        var e = $('.udlContentFormBlockDeleter', block);
        if (e.length != 1) return;
        $("input[name='udlContentCharacter-" + i + "']").change(function () {
            var v = this.value;
            var imgNames = $exeDevice.characters;
            $('#' + this.name + '-thumbnail')
                .attr(
                    'src',
                    $exeDevice.idevicePath + 'characters/' + v + '.png'
                )
                .attr('title', imgNames[v])
                .attr('class', 'pos-' + v);
        });
        // Delete block
        e.unbind('click').click(function () {
            var msg = _("Delete block $? This can't be undone.");
            msg = msg.replace('$', i + 1);
            eXe.app.confirm(_('Attention'), msg, function () {
                // Update the data
                var data = $exeDevice.formToJSON();
                // Remove the element
                data.splice(i, 1);
                // Delete the editors
                $exeDevice.deleteEditors();
                // Remove the blocks
                $('#udlContentFormBlocks').html('');
                // Create a new form
                $exeDevice.jsonToForm(data);
            });
            return false;
        });
        // Toggle block
        e = $('.udlContentToggler,.udlContentFormBlockHeader', block);
        e.unbind('click').click(function () {
            $('#udlContentFormBlockContent-' + i).toggle();
            return false;
        });
        // Move up
        e = $('.udlContentFormBlockUp', block);
        e.unbind('click').click(function () {
            // Update the data
            var data = $exeDevice.formToJSON();
            // Move up the element
            $exeDevice.move(data, i, -1);
            // Delete the editors
            $exeDevice.deleteEditors();
            // Remove the blocks
            $('#udlContentFormBlocks').html('');
            // Create a new form
            $exeDevice.jsonToForm(data);
            return false;
        });
        // Move down
        e = $('.udlContentFormBlockDown', block);
        e.unbind('click').click(function () {
            // Update the data
            var data = $exeDevice.formToJSON();
            // Move down the element
            $exeDevice.move(data, i, 1);
            // Delete the editors
            $exeDevice.deleteEditors();
            // Remove the blocks
            $('#udlContentFormBlocks').html('');
            // Create a new form
            $exeDevice.jsonToForm(data);
            return false;
        });
        // Button text field
        e = $("input[type='text']", block);
        e.unbind('keyup')
            .unbind('blur')
            .keyup(function () {
                $exeDevice.toggleBtnOptions(this);
            })
            .on('blur', function () {
                $exeDevice.toggleBtnOptions(this);
            });
        // Enable TinyMCE
        $exeTinyMCE.init('multiple-visible', '#udlContentFormTxt-' + i);
        // Enable the content type selector
        var tabs = $('.udlContentFormTabs a', block);
        tabs.unbind('click').click(function () {
            $exeDevice.saveToTextareas(block);
            tabs.removeClass('active');
            // Update the content of the editor with the right TEXTAREA
            var pos = this.className;
            pos = pos.replace('udl-a-', '');
            var id = block.attr('id');
            id = id.replace('udlContentFormBlock-', 'udlContentFormTxt-');
            var cont = $('#' + id + '-' + pos).val();
            tinymce.get(id).setContent(cont);
            // Add the "active" class to the current tab
            $(this).addClass('active');
            return false;
        });
    },

    // Show/Hide the button options (text or characters)
    toggleBtnOptions: function (e) {
        e.value = e.value.replace(/~/g, ''); // ~ is not allowed, as it's used when saving the content
        var fid = e.id;
        fid = fid.replace(
            'udlContentFormBlockButtonTxt-',
            'udlContentFormBlockButtonTxtOptions-'
        );
        var optionsBlock = $('#' + fid);
        if (e.value == '') optionsBlock.hide();
        else optionsBlock.show();
        // Check if there's accessible hidden content
        fid = fid.replace('Options-', 'Explanation-');
        optionsBlock = $('#' + fid);
        if (e.value != '' && e.value.indexOf('|') != -1) {
            var tmp = e.value;
            tmp = tmp.replace('|', '~~');
            var parts = tmp.split('~~');
            if (parts.length == 2) {
                if (parts[0] != '' && parts[1] != '') {
                    var spans = $('span', optionsBlock);
                    spans.eq(0).text(parts[0]);
                    spans.eq(1).text(parts[1]);
                    optionsBlock.show();
                }
            } else {
                optionsBlock.hide();
            }
        } else optionsBlock.hide();
    },

    // Move a block (up or down)
    move: function (array, index, delta) {
        var newIndex = index + delta;
        if (newIndex < 0 || newIndex == array.length) return; // Already at the top or bottom
        var indexes = [index, newIndex].sort(); // Sort the indexes
        array.splice(indexes[0], 2, array[indexes[1]], array[indexes[0]]); // Replace from lowest index, two elements, reverting the order
    },

    // Save the active TinyMCE content in a TEXTAREA
    saveToTextareas: function (block) {
        var id = block.attr('id');
        id = id.replace('udlContentFormBlock-', 'udlContentFormTxt-');
        var tabs = $('.udlContentFormTabs a', block);
        tabs.each(function (i) {
            if ($(this).hasClass('active')) {
                var tinyMCEcontent = tinymce.get(id).getContent();
                tinyMCEcontent =
                    $exeDevice.removeEmptyParagraphs(tinyMCEcontent);
                $('#' + id + '-' + i).val(tinyMCEcontent);
            }
        });
    },

    // Load the saved values in the form fields
    loadPreviousValues: function () {
        var originalHTML = this.idevicePreviousData;
        // Change the content type when selecting a UDL icon from the Style
        $('#activeIdevice .js-show-icon-panel-button').click(function () {
            $('#iconiDevice').on('load', function () {
                var src = this.src;
                src = src.split('/');
                src = src[src.length - 1];
                src = src.replace('icon_', '');
                if (src.indexOf('udl_eng_') == 0) {
                    $('#udlContentType-engagement').prop('checked', true);
                    $exeDevice.setActiveType('engagement');
                } else if (src.indexOf('udl_rep_') == 0) {
                    $('#udlContentType-representation').prop('checked', true);
                    $exeDevice.setActiveType('representation');
                } else if (src.indexOf('udl_exp_') == 0) {
                    $('#udlContentType-expression').prop('checked', true);
                    $exeDevice.setActiveType('expression');
                }
            });
        });
        //var originalHTML = field.val();
        var blocks; // JSON (we'll transform the original HTML into a JSON object)
        if (originalHTML != '') {
            var wrapper = $("<div id='udlContentTmpWrapper'></div>");
            wrapper.html(originalHTML);
            // Get the title of the alternative contents and the texto of the close button (the user can change them)
            var strs = this.ci18n;
            for (var i in strs) {
                var block, blockTitle, closeBtn;
                block = $('.exe-udlContent-content-' + i, wrapper);
                if (block.length > 0) {
                    block = block.eq(0);
                    blockTitle = $('.exe-udlContent-alt-content-title', block);
                    if (blockTitle.length == 1) {
                        blockTitle = blockTitle.text();
                        if (blockTitle != '') $('#ci18n_' + i).val(blockTitle);
                        closeBtn = $('.exe-udlContent-alt-content-hide', block);
                        if (closeBtn.length > 0) {
                            closeBtn = closeBtn.eq(0);
                            closeBtn = closeBtn.text();
                            if (closeBtn != '') $('#ci18n_hide').val(closeBtn);
                        }
                    }
                }
            }
            // Remove those elements (they are no longer required)
            $(
                '.exe-udlContent-alt-content-title,button.exe-udlContent-alt-content-hide',
                wrapper
            ).remove();
            // Get the right type
            var type = 'engagement';
            var div = $('.exe-udlContent', wrapper);
            if (div.length == 1) {
                if (div.hasClass('exe-udlContent-representation'))
                    type = 'representation';
                else if (div.hasClass('exe-udlContent-expression'))
                    type = 'expression';
                $('#udlContentType-' + type).prop('checked', true);
                $exeDevice.setActiveType(type);
            }
            blocks = this.htmlToJSON(wrapper);
        } else {
            $("#activeIdevice input[type='text']").eq(0).val(''); // Default title (empty)
            blocks = this.defaultContent;
        }
        // Transform that JSON into a form
        this.jsonToForm(blocks);
    },

    // Add a CSS to the selected type (to change its color)
    setActiveType: function (val) {
        $('#udlContentTypeOptions label').removeClass('active');
        $("label[for='udlContentType-" + val + "']").addClass('active');
    },

    // Get an HTML element and return a JSON object
    htmlToJSON: function (wrapper) {
        var contents = [];
        $('.exe-udlContent-block', wrapper).each(function (i) {
            var btnTxt = '';
            var btnType = 0;
            var header = $('.exe-udlContent-header', this);
            if (header.length == 1) {
                btnTxt = header.text() || '';
                // Transform the accessible hidden content into "foo | "
                var srAv = $('.sr-av', header);
                if (srAv.length == 1) {
                    var srAvTxt = srAv.text();
                    srAvTxt = $.trim(srAvTxt);
                    srAv.remove();
                    btnTxt = header.text();
                    if (btnTxt != '' && srAvTxt != '')
                        btnTxt = srAvTxt + ' | ' + btnTxt;
                }
                if (header.hasClass('exe-udlContent-character-1')) btnType = 1;
                else if (header.hasClass('exe-udlContent-character-2'))
                    btnType = 2;
                else if (header.hasClass('exe-udlContent-character-3'))
                    btnType = 3;
                else if (header.hasClass('exe-udlContent-character-4'))
                    btnType = 4;
            }
            var contMain = $('.exe-udlContent-content-main', this).html() || '';
            var contAlt1 =
                $('.exe-udlContent-content-simplified', this).html() || '';
            var contAlt2 =
                $('.exe-udlContent-content-audio', this).html() || '';
            var contAlt3 =
                $('.exe-udlContent-content-visual', this).html() || '';
            var item = {
                btnTxt: btnTxt,
                btnType: btnType,
                contMain: contMain,
                contAlt1: contAlt1,
                contAlt2: contAlt2,
                contAlt3: contAlt3,
            };
            contents.push(item);
        });
        if (contents.length == 0) return this.defaultContent;
        return contents;
    },

    // Get a JSON object and create a form
    jsonToForm: function (blocks) {
        for (var i = 0; i < blocks.length; i++) {
            this.createBlockForm(blocks[i]);
        }
        // Renew all the IDs
        this.addBlockFormIds();
    },

    // Transform the form into a JSON object
    formToJSON: function () {
        var contents = [];
        // Get the blocks
        $('.udlContentFormBlock').each(function (i) {
            var e = $(this);
            $exeDevice.saveToTextareas(e);
            var contAlt1 = '';
            var contAlt2 = '';
            var contAlt3 = '';

            var btnTxt = $("input[type='text']", this).val();
            btnTxt = $exeDevice.removeTags(btnTxt);
            var btnType = $("input[type='radio']:checked", this).val();
            var contMain = $('#udlContentFormTxt-' + i + '-0').val();
            var contAlt1 = $('#udlContentFormTxt-' + i + '-1').val();
            var contAlt2 = $('#udlContentFormTxt-' + i + '-2').val();
            var contAlt3 = $('#udlContentFormTxt-' + i + '-3').val();

            // Avoid wrong HTML
            contMain = $exeDevice.fixHTML(contMain);
            contAlt1 = $exeDevice.fixHTML(contAlt1);
            contAlt2 = $exeDevice.fixHTML(contAlt2);
            contAlt3 = $exeDevice.fixHTML(contAlt3);

            var item = {
                btnTxt: btnTxt,
                btnType: btnType,
                contMain: contMain,
                contAlt1: contAlt1,
                contAlt2: contAlt2,
                contAlt3: contAlt3,
            };
            contents.push(item);
        });
        if (contents.length == 0) return this.defaultContent;
        return contents;
    },

    // See jsonToForm. This adds a form block (at the end of the form)
    createBlockForm: function (block) {
        $('.udlContentFormBlockContent').hide();
        var btnTxt = block.btnTxt;
        var btnType = block.btnType;
        var btnOptionsStyle = ' style="display:none"';
        if (btnTxt != '') btnOptionsStyle = '';
        var btnTextPartsStyle = ' style="display:none"';
        // Check if there's hidden accessible text
        var txtA = '';
        var txtB = '';
        if (btnTxt.indexOf('|') != -1) {
            var tmp = btnTxt;
            tmp = tmp.replace('|', '~~');
            var parts = tmp.split('~~');
            if (parts.length == 2) {
                if (parts[0] != '' && parts[1] != '') {
                    btnTextPartsStyle = '';
                    txtA = parts[0];
                    txtB = parts[1];
                }
            }
        }
        var ch0 = '';
        var ch1 = '';
        var ch2 = '';
        var ch3 = '';
        var ch4 = '';
        var imgNames = $exeDevice.characters;
        if (btnType == 0) ch0 = ' checked="checked"';
        else if (btnType == 1) ch1 = ' checked="checked"';
        else if (btnType == 2) ch2 = ' checked="checked"';
        else if (btnType == 3) ch3 = ' checked="checked"';
        else if (btnType == 4) ch4 = ' checked="checked"';
        var contMain = block.contMain;
        var contAlt1 = block.contAlt1;
        var contAlt2 = block.contAlt2;
        var contAlt3 = block.contAlt3;
        var html =
            '\
			<article class="udlContentFormBlock">\
				<header class="udlContentFormBlockHeader">\
					<h2><strong>' +
            _('Block') +
            '</strong> <span class="udlContentFormBlockCounter"></span></h2> \
					<span class="udlContentFormBlockHeaderLinks">\
						<a href="#" class="udlContentFormBlockDeleter" title="' +
            _('Delete') +
            '">' +
            _('Delete') +
            '</a> \
						<a href="#" class="udlContentFormBlockUp" title="' +
            _('Up') +
            '">' +
            _('Up') +
            '</a> \
						<a href="#" class="udlContentFormBlockDown" title="' +
            _('Down') +
            '">' +
            _('Down') +
            '</a> \
						<a href="#" class="udlContentToggler sr-av" title="' +
            _('Hide') +
            '/' +
            _('Show') +
            '">' +
            _('Hide') +
            '/' +
            _('Show') +
            '</a> \
					</span>\
				</header>\
				<div class="udlContentFormBlockContent">\
					<p class="udlContentFormBlockButtonTxt udlContentField">\
						<label>' +
            _('Button text') +
            ': </label>\
						<input type="text" value="' +
            btnTxt +
            '" placeholder="' +
            _('Empty = No button') +
            '" />\
						<span class="udlContentFormBlockButtonTxtOptions"' +
            btnOptionsStyle +
            '>\
							<strong class="sr-av">' +
            _('Presentation') +
            ':</strong> \
							<label><input type="radio" value="0"' +
            ch0 +
            ' /> ' +
            _('Text button') +
            '</label> \
							<label><input type="radio" value="1"' +
            ch1 +
            ' /> ' +
            _('Character') +
            ' 1</label> \
							<label><input type="radio" value="2"' +
            ch2 +
            ' /> ' +
            _('Character') +
            ' 2</label> \
							<label><input type="radio" value="3"' +
            ch3 +
            ' /> ' +
            _('Character') +
            ' 3</label> \
							<label><input type="radio" value="4"' +
            ch4 +
            ' /> ' +
            _('Character') +
            ' 4</label> \
							<img src="' +
            this.idevicePath +
            'characters/' +
            btnType +
            '.png" alt="' +
            _('Character') +
            '" title="' +
            imgNames[btnType] +
            '" class="pos-' +
            btnType +
            '" />\
						</span>\
					</p>\
					<p class="udlContentField udlContentFormBlockButtonTxtExplanation"' +
            btnTextPartsStyle +
            '>\
						<strong>' +
            _('Button text') +
            ': </strong><span class="sr-only-explanation" title="' +
            _('Accessible hidden content') +
            '">' +
            txtA +
            '</span> <span title="' +
            _('Visible') +
            '">' +
            txtB +
            '</span>\
					</p>\
					<div class="udlContentFormBlockTxt udlContentField">\
						<label class="sr-av">' +
            _('Content') +
            ': </label>\
						<div class="udlContentFormTabs">\
							<p class="sr-av">' +
            _('Choose the content to edit:') +
            '</p>\
							<ul>\
								<li><a href="#" class="active udl-a-0">' +
            _('Main content (required)') +
            '</a></li>\
								<li><a href="#" title="' +
            _('Alternative content') +
            '" class="udl-a-1">' +
            _('Easier to read') +
            '</a></li>\
								<li><a href="#" title="' +
            _('Alternative content') +
            '" class="udl-a-2">' +
            _('Audio') +
            '</a></li>\
								<li><a href="#" title="' +
            _('Alternative content') +
            '" class="udl-a-3">' +
            _('Visual aid') +
            '</a></li>\
							</ul>\
						</div>\
						<textarea cols="30" rows="10" class="udlContentEditor">' +
            contMain +
            '</textarea>\
						<textarea cols="30" rows="1" class="udlContentEditorContent">' +
            contMain +
            '</textarea>\
						<textarea cols="30" rows="1" class="udlContentEditorContent">' +
            contAlt1 +
            '</textarea>\
						<textarea cols="30" rows="1" class="udlContentEditorContent">' +
            contAlt2 +
            '</textarea>\
						<textarea cols="30" rows="1" class="udlContentEditorContent">' +
            contAlt3 +
            '</textarea>\
					</div>\
				</div>\
			</article>\
		';
        $('#udlContentFormBlocks').append(html);
    },

    // After creating a form, add IDs to the elements so you can get the data and have no accessibility problems
    addBlockFormIds: function () {
        $('.udlContentFormBlock').each(function (i) {
            $(this).attr('id', 'udlContentFormBlock-' + i);
            $('.udlContentFormBlockCounter', this).text(i + 1);
            $('.udlContentFormBlockContent', this).attr(
                'id',
                'udlContentFormBlockContent-' + i
            );
            var labels = $('label', this);
            labels.eq(0).attr('for', 'udlContentFormBlockButtonTxt-' + i);
            labels.eq(1).attr('for', 'udlContentCharacter-' + i + '-0');
            labels.eq(2).attr('for', 'udlContentCharacter-' + i + '-1');
            labels.eq(3).attr('for', 'udlContentCharacter-' + i + '-2');
            labels.eq(4).attr('for', 'udlContentCharacter-' + i + '-3');
            labels.eq(5).attr('for', 'udlContentCharacter-' + i + '-4');
            labels.eq(6).attr('for', 'udlContentFormTxt-' + i);
            $("input[type='text']", this)
                .eq(0)
                .attr('id', 'udlContentFormBlockButtonTxt-' + i);
            $('.udlContentFormBlockButtonTxtOptions', this).attr(
                'id',
                'udlContentFormBlockButtonTxtOptions-' + i
            );
            $('.udlContentFormBlockButtonTxtExplanation', this).attr(
                'id',
                'udlContentFormBlockButtonTxtExplanation-' + i
            );
            var radios = $("input[type='radio']", this);
            radios
                .eq(0)
                .attr('name', 'udlContentCharacter-' + i)
                .attr('id', 'udlContentCharacter-' + i + '-0');
            radios
                .eq(1)
                .attr('name', 'udlContentCharacter-' + i)
                .attr('id', 'udlContentCharacter-' + i + '-1');
            radios
                .eq(2)
                .attr('name', 'udlContentCharacter-' + i)
                .attr('id', 'udlContentCharacter-' + i + '-2');
            radios
                .eq(3)
                .attr('name', 'udlContentCharacter-' + i)
                .attr('id', 'udlContentCharacter-' + i + '-3');
            radios
                .eq(4)
                .attr('name', 'udlContentCharacter-' + i)
                .attr('id', 'udlContentCharacter-' + i + '-4');
            $('.udlContentFormBlockButtonTxtOptions img', this).attr(
                'id',
                'udlContentCharacter-' + i + '-thumbnail'
            );
            $('.udlContentFormTabs', this).attr(
                'id',
                'udlContentFormTabs-' + i
            );
            var textareas = $('textarea', this);
            textareas
                .eq(0)
                .attr('name', 'udlContentFormTxt-' + i)
                .attr('id', 'udlContentFormTxt-' + i);
            textareas.eq(1).attr('id', 'udlContentFormTxt-' + i + '-0');
            textareas.eq(2).attr('id', 'udlContentFormTxt-' + i + '-1');
            textareas.eq(3).attr('id', 'udlContentFormTxt-' + i + '-2');
            textareas.eq(4).attr('id', 'udlContentFormTxt-' + i + '-3');
            // Events
            $exeDevice.addBlockEvents(i);
        });
    },

    // Remove all TinyMCE instances
    deleteEditors: function () {
        if (typeof tinymce == 'undefined') return;
        for (var i = tinymce.editors.length - 1; i > -1; i--) {
            var ed_id = tinymce.editors[i].id;
            tinyMCE.execCommand('mceRemoveEditor', true, ed_id);
        }
    },

    // Avoid wrong HTML: <source></source>
    fixHTML: function (c) {
        return c.replace(/" ><\/source>/g, '" />');
    },

    // Remove any HTML tags
    removeTags: function (str) {
        var wrapper = $('<div></div>');
        wrapper.html(str);
        return wrapper.text();
    },

    // Remove empty paragraphs
    removeEmptyParagraphs: function (c) {
        if (this.allowEmptyParagraphs) return c;
        var tmp = $('<div></div>');
        tmp.html(c);
        $('p', tmp).each(function (i) {
            var x = $(this).html();
            x = x.replace(/\s/g, '');
            x = x.replace(/&nbsp;/g, '');
            if (x == '') $(this).addClass('emptyParagraphToRemove');
        });
        $('p.emptyParagraphToRemove', tmp).remove();
        return tmp.html();
    },

    // Transform the form into a JSON object and that object into HTML to save
    save: function () {
        var html = '';
        var res;
        var data = this.formToJSON();
        var error = false;

        for (var i = 0; i < data.length; i++) {
            res = '';
            var block = data[i];
            if (block.contMain == '') error = true;
            else {
                var btnTxt = block.btnTxt;
                btnTxt = $.trim(btnTxt);
                // Check if the button text has accessible hidden content
                if (btnTxt.indexOf('|') != -1) {
                    var tmp = btnTxt.replace('|', '~~');
                    var parts = tmp.split('~~');
                    if (parts.length == 2) {
                        if (parts[0] != '' && parts[1] != '') {
                            btnTxt =
                                '<span class="sr-av">' +
                                $.trim(parts[0]) +
                                ' </span>' +
                                $.trim(parts[1]);
                        }
                    }
                }
                var css = '';
                if (btnTxt != '') css = ' js-hidden';
                // Alternative contents
                var cont1 = block.contAlt1;
                var cont2 = block.contAlt2;
                var cont3 = block.contAlt3;
                // Alternative contents titles
                var cont1T = _('Easier to read');
                var cont2T = _('Audio');
                var cont3T = _('Visual aid');
                var clsBtn = _('Hide');
                var v;
                v = $('#ci18n_simplified').val();
                if (v != '') cont1T = v;
                v = $('#ci18n_audio').val();
                if (v != '') cont2T = v;
                v = $('#ci18n_visual').val();
                if (v != '') cont3T = v;
                v = $('#ci18n_hide').val();
                if (v != '') clsBtn = v;
                // Close button
                clsBtn =
                    '<button class="exe-udlContent-alt-content-hide">' +
                    clsBtn +
                    '</button>';
                res += '<section class="exe-udlContent-block' + css + '">';
                if (btnTxt != '') {
                    var extraCSS = '';
                    var btnType = block.btnType;
                    if (
                        btnType == 1 ||
                        btnType == 2 ||
                        btnType == 3 ||
                        btnType == 4
                    )
                        extraCSS = ' exe-udlContent-character-' + btnType;
                    res +=
                        '<header class="exe-udlContent-header' +
                        extraCSS +
                        '"><h2 style="display:none;">' +
                        btnTxt +
                        '</h2></header>';
                }
                res += '<div class="exe-udlContent-content">';
                res +=
                    '<div class="exe-udlContent-content-main">' +
                    block.contMain +
                    '</div>';
                if (cont1 != '') {
                    cont1 =
                        "<header class='exe-udlContent-alt-content-title'><h2>" +
                        cont1T +
                        '</h2></header>' +
                        cont1 +
                        clsBtn;
                    res +=
                        '<article class="exe-udlContent-content-simplified js-hidden">' +
                        cont1 +
                        '</article>';
                }
                if (cont2 != '') {
                    cont2 =
                        "<header class='exe-udlContent-alt-content-title'><h2>" +
                        cont2T +
                        '</h2></header>' +
                        cont2 +
                        clsBtn;
                    res +=
                        '<article class="exe-udlContent-content-audio js-hidden">' +
                        cont2 +
                        '</article>';
                }
                if (cont3 != '') {
                    cont3 =
                        "<header class='exe-udlContent-alt-content-title'><h2>" +
                        cont3T +
                        '</h2></header>' +
                        cont3 +
                        clsBtn;
                    res +=
                        '<article class="exe-udlContent-content-visual js-hidden">' +
                        cont3 +
                        '</article>';
                }
                res += '</div>';
                res += '</section>';
                html += res;
            }
        }

        if (error == true) {
            eXe.app.alert(
                _('Please provide a main content for all the blocks.')
            );
            return;
        }

        var css =
            'exe-udlContent-' + $("input[name='udlContentType']:checked").val();
        html = '<div class="exe-udlContent ' + css + '">' + html + '</div>';

        // Return the HTML to save
        return html;
    },
};

if (typeof $exe_i18n == 'undefined') {
    var $exe_i18n = {
        previous: 'Previous',
        next: 'Next',
        show: 'Show',
        hide: 'Hide',
        showFeedback: 'Show Feedback',
        hideFeedback: 'Hide Feedback',
        correct: 'Correct',
        incorrect: 'Incorrect',
        menu: 'Menu',
        download: 'Download',
        yourScoreIs: 'Your score is ',
        dataError: 'Error recovering data',
        epubJSerror: 'This might not work in this ePub reader.',
        solution: 'Solution',
        epubDisabled: 'This activity does not work in ePub.',
        print: 'Print',
    };
}
