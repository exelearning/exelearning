var $exeTinyMCE = {
    // imagetools is disabled because it generates base64 images
    // colorpicker contextmenu textcolor . Añadidos al core, no hace falta añadir en plugins?
    plugins:
        'tooltips exeaudio pastemath abcmusic exemindmap rssfeed modalwindow exealign exeimage exemedia toggletoolbars exeeffects easyattributes advlist lists autolink exelink charmap preview anchor searchreplace visualchars visualblocks code codemagic fullscreen insertdatetime table paste template hr clearfloat addcontent definitionlist blockquoteandcite pastecode abbr exegames_hangman directionality',
    // These buttons will be visible when the others are hidden
    buttons0:
        'toggletoolbars | undo redo | bold italic | formatselect | alignleft aligncenter alignright alignjustify | exelink unlink | bullist numlist | exeimage exemedia | fullscreen',
    // When buttons0 are hidden, 1, 2 and 3 are visible
    buttons1:
        'toggletoolbars | bold italic | formatselect fontsizeselect fontselect | forecolor backcolor',
    buttons2:
        'alignleft aligncenter alignright alignjustify clearfloat addcontent | bullist numlist definitionlist | exelink unlink | outdent indent | blockquote blockquoteandcite | ltr rtl',
    buttons3:
        'undo redo | cut copy paste pastetext | pastehtml pastecode pastemath | tooltips modalwindow exeeffects | exeimage exemedia | exemindmap exeaudio abcmusic | codemagic | fullscreen',
    browser_spellcheck: true,

    path_to_folder: '/libs/tinymce_5/js/tinymce/',
    menubar: 'edit insert format table tools',
    menu: {
        edit: {
            title: 'Edit',
            items: 'undo redo | selectall searchreplace | cut copy paste pastetext | easyattributes',
        },
        insert: {
            title: 'Insert',
            items: 'template | hr charmap anchor clearfloat addcontent | abbr insertdatetime',
        }, // ' | exegames_hangman' removed
        format: {
            title: 'Format',
            items: 'underline strikethrough superscript subscript | formats | removeformat',
        },
        table: {
            title: 'Table',
            items: 'inserttable tableprops deletetable | cell row column',
        },
        tools: {
            title: 'Tools',
            items: 'code codemagic visualchars visualblocks fullscreen',
        },
    },
    contextmenu: 'exelink | inserttable | cell row column deletetable',
    language: 'all', // We set all so we can use eXe's i18n mechanism in all.js
    templates: [
        {
            title: '2 ' + 'columns' + ' 50% 50%',
            description: '',
            url: `libs/tinymce_5/js/tinymce/templates/2-50-50.html`,
        },
        {
            title: '2 ' + 'columns' + ' 30% 70%',
            description: '',
            url: `libs/tinymce_5/js/tinymce/templates/2-30-70.html`,
        },
        {
            title: '2 ' + 'columns' + ' 70% 30%',
            description: '',
            url: `libs/tinymce_5/js/tinymce/templates/2-70-30.html`,
        },
        {
            title: '3 ' + 'columns',
            description: '',
            url: `libs/tinymce_5/js/tinymce/templates/3.html`,
        },
        {
            title: 'Image (left) + Text (right)',
            description: '',
            url: `libs/tinymce_5/js/tinymce/templates/img-txt.html`,
        },
        {
            title: 'Text (left) + Image (right)',
            description: '',
            url: `libs/tinymce_5/js/tinymce/templates/txt-img.html`,
        },
        {
            title: 'Table with column headers',
            description: '',
            url: `libs/tinymce_5/js/tinymce/templates/table-thead-th.html`,
        },
        {
            title: 'Table with row headers',
            description: '',
            url: `libs/tinymce_5/js/tinymce/templates/table-tbody-th.html`,
        },
        {
            title: 'Table with column and row headers',
            description: '',
            url: `libs/tinymce_5/js/tinymce/templates/table-th.html`,
        },
        {
            title: '2 ' + 'videos',
            description: '',
            url: `libs/tinymce_5/js/tinymce/templates/2-videos.html`,
        },
        {
            title: '2 ' + 'images',
            description: '',
            url: `libs/tinymce_5/js/tinymce/templates/2-images.html`,
        },
        {
            title: '3 ' + 'images',
            description: '',
            url: `libs/tinymce_5/js/tinymce/templates/3-images.html`,
        },
    ],
    table_default_styles: {
        width: '100%',
    },

    // Get classes from base.css and content.css
    getAvailableClasses: function () {
        var sheets = document.styleSheets;
        var sheet, rule, rules, item, name, tmp;
        var classes = [];
        var names = [];
        for (var i = 0, iLen = sheets.length; i < iLen; i++) {
            sheet = sheets[i];
            if (
                sheet.href &&
                (sheet.href.indexOf('./base.css') != -1 ||
                    sheet.href.indexOf('./content.css') != -1)
            ) {
                rules = sheet.rules || sheet.cssRules;
                for (var j = 0, jLen = rules.length; j < jLen; j++) {
                    rule = rules[j];
                    tmp = rule.cssText.match(/\.\w+/g);
                    if (tmp) {
                        classes.push.apply(classes, tmp);
                    }
                }
            }
        }
        classes.sort();
        // Add some classes (exe-hidden, etc.)
        var rightClasses = [
            { text: '-- Not Set --', value: '' },
            { text: 'exe-hidden', value: 'exe-hidden' },
            { text: 'exe-hidden-accessible', value: 'exe-hidden-accessible' },
            { text: 'exe-table', value: 'exe-table' },
            { text: 'exe-table-minimalist', value: 'exe-table-minimalist' },
        ];
        for (var z = 0; z < classes.length; z++) {
            name = classes[z].replace('.', '');
            if (
                isNaN(classes[z].charAt(1)) &&
                names.indexOf(name) == -1 &&
                name.indexOf('iDevice') == -1 &&
                name.indexOf('Idevice') == -1 &&
                name != 'js'
            ) {
                rightClasses.push({ text: name, value: name });
                names.push(name);
            }
        }

        return rightClasses;
    },

    rel_list: [
        { title: '---', value: '' },
        { title: 'alternate', value: 'alternate' },
        { title: 'author', value: 'author' },
        { title: 'bookmark', value: 'bookmark' },
        { title: 'external', value: 'external' },
        { title: 'help', value: 'help' },
        { title: 'license', value: 'license' },
        { title: 'lightbox', value: 'lightbox' },
        { title: 'next', value: 'next' },
        { title: 'nofollow', value: 'nofollow' },
        { title: 'prev', value: 'prev' },
    ],
    image_title: true,
    init: function (mode, criteria, hide) {
        this.mode = mode;

        var h = 175;
        if (mode == 'multiple') h = 50;
        var w = 882;
        if (
            typeof $exeTinyMCEToggler.documentWidth == 'undefined' ||
            (typeof $exeTinyMCEToggler.documentWidth != 'undefined' &&
                $exeTinyMCEToggler.documentWidth < 900)
        )
            w = '';

        // FR 303
        var divExists = false;
        if (mode == 'multiple') {
            var div = $(criteria).parent();
            if (
                div.length == 1 &&
                div.attr('class') == 'block' &&
                !div[0].hasAttribute('style')
            ) {
                divExists = true;
                div.css({
                    width: w + 'px',
                    height: h + 50 + 'px',
                    border: '1px solid #C0C0C0',
                }).addClass('hidden-editor');
            }
        }

        tinymce.init({
            language: this.language,
            selector: criteria,
            height: 350,
            convert_urls: false,
            toolbar_mode: 'wrap', // To review. The default toolbar mode, floanting, sometimes causes unexpected errors when editing activities (theme.min.js. line 28818)
            paste_as_text: true,
            schema: this.getSchema(),
            resize: 'both',
            draggable_modal: true,
            branding: false,
            entity_encoding: 'raw',
            remove_trailing_brs: false,
            valid_children: this.getValidChildren(),
            valid_elements: this.getValidElements(),
            extended_valid_elements: this.getExtendedValidElements(),
            fix_list_elements: true,
            plugins: this.plugins,
            menubar: this.menubar,
            menu: this.menu,
            content_css: this.getContentCSS(),
            contextmenu: this.contextmenu,
            browser_spellcheck: this.browser_spellcheck,
            templates: this.templates,
            table_default_styles: this.table_default_styles,
            table_class_list: this.getAvailableClasses(),
            rel_list: this.rel_list,

            // Base URL
            path_to_folder: this.path_to_folder,
            // Images
            image_advtab: true,
            image_title: this.image_title,
            file_browser_callback: function (field_name, url, type) {
                exe_tinymce.chooseImage(field_name, url, type);
            },
            image_title: true,
            /* enable automatic uploads of images represented by blob or data URIs*/
            automatic_uploads: true,
            file_picker_types: 'file image media',
            /* and here's our custom image picker*/
            file_picker_callback: function (cb, value, meta) {
                var input = document.createElement('input');
                input.setAttribute('type', 'file');
                // input.setAttribute('accept', 'image/*');
                input.onchange = function () {
                    var file = this.files[0];
                    var fd = new FormData();
                    fd.append('file', file);
                    fd.append('filename', [file.name]);
                    fd.append('odeSessionId', [
                        eXeLearning.app.project.odeSession,
                    ]);

                    $exeTinyMCE.lockScreen();
                    let lockStartTime = new Date();

                    eXe.app.uploadLargeFile(fd).then((response) => {
                        let loadTime = new Date().getTime() - lockStartTime;
                        if (
                            response &&
                            response.savedPath &&
                            response.savedFilename
                        ) {
                            let fullPath = `${response.savedPath}${response.savedFilename}`;
                            cb(fullPath, {
                                title: response.savedFilename,
                                size: response.savedFileSize,
                            });
                        } else {
                            eXe.app.alert(_(response.code));
                        }
                        $exeTinyMCE.unlockScreen(loadTime);
                    });
                };
                input.click();
            },

            // Drag and Drop
            paste_data_images: true,
            // Upload tab?
            image_uploadtab: false,
            images_upload_handler: async function (blobInfo, success, failure) {
                // eXeLearning upload file
                $exeTinyMCE.lockScreen();
                let base64 = `data:${blobInfo.blob().type};base64,${blobInfo.base64()}`;
                let response = await eXe.app.uploadFile(
                    base64,
                    blobInfo.filename(),
                );
                if (response && response.savedPath && response.savedFilename) {
                    let fullPath = `${response.savedPath}${response.savedFilename}`;
                    success(fullPath);
                } else {
                    eXe.app.alert(_('Error uploading file'));
                }
                $exeTinyMCE.unlockScreen();
            },

            // Media
            media_alt_source: false,
            media_poster: false,

            // Style Formats (see defaultStyleFormats in tinymce.js)
            style_formats: [
                {
                    title: 'Headings',
                    items: [
                        { title: 'Heading 1', format: 'h1' },
                        { title: 'Heading 2', format: 'h2' },
                        { title: 'Heading 3', format: 'h3' },
                        { title: 'Heading 4', format: 'h4' },
                        { title: 'Heading 5', format: 'h5' },
                        { title: 'Heading 6', format: 'h6' },
                    ],
                },
                {
                    title: _('Inline'),
                    items: [
                        { title: _('Bold'), icon: 'bold', format: 'bold' },
                        {
                            title: _('Italic'),
                            icon: 'italic',
                            format: 'italic',
                        },
                        {
                            title: _('Underline'),
                            icon: 'underline',
                            format: 'underline',
                        },
                        {
                            title: _('Strikethrough'),
                            icon: 'strike-through',
                            format: 'strikethrough',
                        },
                        {
                            title: _('Superscript'),
                            icon: 'superscript',
                            format: 'superscript',
                        },
                        {
                            title: _('Subscript'),
                            icon: 'subscript',
                            format: 'subscript',
                        },
                        {
                            title: _('Code'),
                            icon: 'sourcecode',
                            format: 'code',
                        },
                        // Deletion, Insertion and Cite are not part of the default list
                        { title: _('Deletion') + ': <del>', inline: 'del' },
                        { title: _('Insertion') + ': <ins>', inline: 'ins' },
                        { title: _('Cite') + ': <cite>', inline: 'cite' },
                        {
                            title: _('Highlighted text') + ': <mark>',
                            inline: 'mark',
                        },
                    ],
                },
                {
                    title: 'Blocks',
                    items: [
                        { title: 'Paragraph', format: 'p' },
                        { title: 'Blockquote', format: 'blockquote' },
                        { title: 'Div', format: 'div' },
                        { title: 'Pre', format: 'pre' },
                    ],
                },
                {
                    title: 'Alignment',
                    items: [
                        {
                            title: 'Left',
                            icon: 'align-left',
                            format: 'alignleft',
                        },
                        {
                            title: 'Center',
                            icon: 'align-center',
                            format: 'aligncenter',
                        },
                        {
                            title: 'Right',
                            icon: 'align-right',
                            format: 'alignright',
                        },
                        {
                            title: 'Justify',
                            icon: 'align-justify',
                            format: 'alignjustify',
                        },
                    ],
                },
            ],
            style_formats_merge: false, // Overwrite default style formats
            toolbar: [
                this.buttons0,
                this.buttons1,
                this.buttons2,
                this.buttons3,
            ],
            init_instance_callback: function (ed) {
                if (mode == 'multiple') {
                    if (divExists) div.removeAttr('style'); // FR 303
                    $exeTinyMCEToggler.init(ed.id, hide);
                }
            },
        }); //End tinymce
    },

    getSchema: function () {
        var s = 'html5';
        return s;
    },

    getContentCSS: function () {
        return (
            eXeLearning.app.themes.selected.path +
            'content.css,' +
            eXeLearning.app.api.apiUrlBase +
            '/app/editor/tinymce_5_extra.css,' +
            eXeLearning.app.api.apiUrlBase +
            '/libs/bootstrap/bootstrap.min.css'
        );
    },

    getValidElements: function () {
        var e = '*[*]';
        return e;
    },

    getValidChildren: function () {
        var v = '+body[style]';
        return v;
    },

    getExtendedValidElements: function () {
        var e = '';
        return e;
    },

    lockScreen: function () {
        const loadScreen = document.getElementById('load-screen-node-content');
        loadScreen.style.zIndex = '9999';
        loadScreen.style.position = 'fixed';
        loadScreen.style.top = '0';
        loadScreen.style.left = '0';
        loadScreen.classList.remove('hide', 'hidden');
        loadScreen.classList.add('loading');
    },

    unlockScreen: function (delay = 1000) {
        delay = delay > 1000 ? 400 : 0;
        const loadScreen = document.getElementById('load-screen-node-content');
        loadScreen.classList.remove('loading');
        loadScreen.classList.add('hidding');
        setTimeout(() => {
            loadScreen.classList.add('hide', 'hidden');
            loadScreen.classList.remove('hidding');
            loadScreen.style.zIndex = '990';
            loadScreen.style.position = 'absolute';
            delete loadScreen.style.top;
            delete loadScreen.style.left;
        }, delay);
    },
};

/* This will run when having more than one TEXTAREA in a page */
var $exeTinyMCEToggler = {
    mode: 'always', // "always" if you don't want to have contents without HTML (plain textareas). Any other value if you do.

    setup: function (eds) {
        eds.each(function () {
            var n = this.name;
            this.id = n;
            var e = $(this);
            if ($exeTinyMCEToggler.mode == 'always') {
                $exeTinyMCEToggler.createViewer(e);
            } else {
                if (e.val() == '' || e.val() == e.html()) {
                    // No HTML (plain textarea)
                    e.css({
                        border: '1px solid #ccc',
                        height: '1.5em',
                        width: '100%',
                        padding: '15px',
                        margin: '0 0 1.5em 0',
                    });
                    // To review $exeTinyMCEToggler.createEditorLink(e,n);
                } else {
                    $exeTinyMCEToggler.createViewer(e);
                }
            }
        });
    },

    createViewer: function (e) {
        if (typeof this.documentWidth == 'undefined') {
            this.documentWidth = $(document).width();
        }
        var id = e.attr('id');
        var n = e.attr('name');
        var c = e.val();
        var w = ';width:852px';
        if (this.documentWidth < 900) w = '';
        // To review: $exeTinyMCEToggler.createEditorLink(e,n);
        var v = $(
            '<div class="exe-textarea-preview" id="' +
                id +
                '-viewer" style="height:96px;padding:2px 15px;border:1px solid #ccc;overflow:auto' +
                w +
                '" onclick="$exeTinyMCEToggler.removeViewer(\'' +
                id +
                '\')">' +
                c +
                '</div>',
        );
        e.before(v).addClass('sr-av'); // If we use e.hide() TinyMCE won't be properly displayed
    },

    removeViewer: function (id) {
        $('#' + id + '-toggler').remove();
        this.startEditor(id, true);
    },

    getHelpLink: function (e) {
        // The textarea has a label with an ID: textareaID-editor-label
        var w = $('#' + e.attr('id') + '-editor-label');
        if (w.length > 0) return w;

        // Get the help link to insert the TinyMCE toggler after it
        var r = '';

        // Multi-choice, etc.
        var p = e.parent().parent().prev();
        var f = $('A', p).eq(0); // f = First link in p, being p the previous element (it can be different in each case)
        if (f.length == 1 && f.html().indexOf('/images/help.gif') != -1) {
            return f;
        }

        // Look for the help link in the previous .block
        p = e.parent().prev('.block');
        f = $('A', p).eq(0);
        if (f.length == 1 && f.html().indexOf('/images/help.gif') != -1) {
            return f;
        }

        // Multi-select question has a different HTML. We look for the help link.
        p = e.parent();
        f = $('A', p).eq(0);
        if (f.length == 1 && f.html().indexOf('/images/help.gif') != -1) {
            return f;
        }

        // Case Study...
        p = e.parent().prev().prev().prev();
        if (p.length == 1) {
            var h = p.attr('href');
            if (h && h.indexOf('Javascript:void') == 0) {
                return p;
            }
        }

        return r;
    },

    createEditorLink: function (e, id) {
        var f = this.getHelpLink(e);
        if (f != '') {
            var l = $(
                '<a href="#" id="' +
                    id +
                    '-toggler" onclick="$exeTinyMCEToggler.startEditor(\'' +
                    id +
                    '\',false);$(this).remove();return false" class="exe-editor-toggler visible-editor">' +
                    _('Editor') +
                    '</a>',
            );
            f.css('margin-right', '55px').after(l);
        } else {
            // We can't find the help link, so be just enable the editor
            // $exeTinyMCEToggler.startEditor(id,false);
        }
    },

    startEditor: function (id, hide) {
        $('#' + id + '-viewer').remove();
        $('#' + id).show();
        $exeTinyMCE.init('multiple', '#' + id, hide);
    },

    addLinkAndToggle: function (id, lab, l, hide) {
        lab.css('margin-right', '5px').after(l);
        if (hide != false)
            this.toggle(id, document.getElementById(id + '-toggler'));
    },

    init: function (id, hide) {
        var e = $('#' + id);
        var f = this.getHelpLink(e);
    },

    toggle: function (id, e) {
        var p = $('#' + id).parent();
        window[e.id + '-iframeHeight'] = '134px';
        var t = $('IFRAME', p);
        var i = '';
        if (t.length == 1) i = t.eq(0);
        if ($(e).hasClass('visible-editor')) {
            // Hide toolbars
            if (i != '') {
                window[e.id + '-iframeHeight'] = i.css('height');
                var w = i.css('width');
                if (parseInt(w.replace('px', '')) < 500) w = '700px';
                i.css('width', w);
                var h = parseInt(window[e.id + '-iframeHeight'].replace('px'));
                h = 100; // Force height: Comment this line to make it as high as the TinyMCE editor
                i.css('height', h + 'px');
            }
            $(e).removeClass('visible-editor').addClass('hidden-editor');
            p.addClass('hidden-editor');
            $('.mce-edit-area').css('border-width', '0'); // So the box doesn't have a 2px border top
        } else {
            // Show toolbars
            if (i != '') i.css('height', window[e.id + '-iframeHeight']);
            $(e).removeClass('hidden-editor').addClass('visible-editor');
            $('.mce-edit-area').css('border-width', '1px 0 0');
            p.removeClass('hidden-editor');
        }
    },
};
