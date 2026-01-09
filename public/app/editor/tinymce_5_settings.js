var $exeTinyMCE = {
    // imagetools is disabled because it generates base64 images
    // colorpicker contextmenu textcolor . Añadidos al core, no hace falta añadir en plugins?
    plugins:
        'tooltips exeaudio edicuatex abcmusic exemindmap exemermaid rssfeed modalwindow exealign exeimage exemedia toggletoolbars exeeffects easyattributes advlist lists autolink exelink charmap preview anchor searchreplace visualchars visualblocks code codemagic fullscreen insertdatetime table paste template hr clearfloat addcontent definitionlist blockquoteandcite pastecode abbr exegames_hangman directionality',
    // These buttons will be visible when the others are hidden
    buttons0:
        'toggletoolbars | undo redo | bold italic | formatselect | alignleft aligncenter alignright alignjustify | exelink unlink | bullist numlist | exeimage exemedia | fullscreen',
    // When buttons0 are hidden, 1, 2 and 3 are visible
    buttons1:
        'toggletoolbars | bold italic | formatselect fontsizeselect fontselect | forecolor backcolor',
    buttons2:
        'alignleft aligncenter alignright alignjustify | template clearfloat addcontent | bullist numlist definitionlist | exelink unlink | outdent indent | blockquote blockquoteandcite | ltr rtl',
    buttons3:
        'undo redo | cut copy paste pastetext | pastehtml pastecode edicuatex | tooltips modalwindow exeeffects | exeimage exemedia | exemindmap exemermaid | exeaudio abcmusic | codemagic | fullscreen',
    browser_spellcheck: true,

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
    language: 'all', // We set all so we can use eXe's i18n mechanism in all.js,
    edicuatex_url: '/app/common/edicuatex/index.html',
    edicuatex_mathjax_url: '/app/common/exe_math/tex-mml-svg.js',
    getTemplates: function () {
        return [
            {
                title: _('2 columns') + ' 50% 50%',
                description: '',
                url: `libs/tinymce_5/js/tinymce/templates/2-50-50.html`,
            },
            {
                title: _('2 columns') + ' 30% 70%',
                description: '',
                url: `libs/tinymce_5/js/tinymce/templates/2-30-70.html`,
            },
            {
                title: _('2 columns') + ' 70% 30%',
                description: '',
                url: `libs/tinymce_5/js/tinymce/templates/2-70-30.html`,
            },
            {
                title: _('3 columns'),
                description: '',
                url: `libs/tinymce_5/js/tinymce/templates/3.html`,
            },
            {
                title: _('Image (left) + Text (right)'),
                description: '',
                url: `libs/tinymce_5/js/tinymce/templates/img-txt.html`,
            },
            {
                title: _('Text (left) + Image (right)'),
                description: '',
                url: `libs/tinymce_5/js/tinymce/templates/txt-img.html`,
            },
            {
                title: _('Table with column headers'),
                description: '',
                url: `libs/tinymce_5/js/tinymce/templates/table-thead-th.html`,
            },
            {
                title: _('Table with row headers'),
                description: '',
                url: `libs/tinymce_5/js/tinymce/templates/table-tbody-th.html`,
            },
            {
                title: _('Table with column and row headers'),
                description: '',
                url: `libs/tinymce_5/js/tinymce/templates/table-th.html`,
            },
            {
                title: _('2 videos'),
                description: '',
                url: `libs/tinymce_5/js/tinymce/templates/2-videos.html`,
            },
            {
                title: _('2 images'),
                description: '',
                url: `libs/tinymce_5/js/tinymce/templates/2-images.html`,
            },
            {
                title: _('3 images'),
                description: '',
                url: `libs/tinymce_5/js/tinymce/templates/3-images.html`,
            },
        ];
    },
    table_default_styles: {
        width: '100%',
    },

    getAssetURL: function (url) {
        // URL pattern: {basePath}/{version}/path (e.g., /web/exelearning/v0.0.0-alpha/libs/...)
        let assetUrl =
            eXeLearning.config.baseURL +
            eXeLearning.config.basePath +
            '/' +
            eXeLearning.version;
        return assetUrl + url;
    },

    // Get classes from base.css and style.css
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
                    sheet.href.indexOf('./style.css') != -1)
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
            templates: this.getTemplates(),
            table_default_styles: this.table_default_styles,
            table_class_list: this.getAvailableClasses(),
            rel_list: this.rel_list,

            // Math plugin
            edicuatex_url: this.getAssetURL(this.edicuatex_url),
            edicuatex_mathjax_url: this.getAssetURL(this.edicuatex_mathjax_url),

            // Images
            image_advtab: true,
            image_title: this.image_title,
            file_browser_callback: function (field_name, url, type) {
                // Open Media Library modal
                const filemanager = window.eXeLearning?.app?.modals?.filemanager;
                if (filemanager) {
                    filemanager.show({
                        onSelect: function(result) {
                            // result = { assetUrl, blobUrl, asset }
                            const field = document.getElementById(field_name);
                            if (field) {
                                field.value = result.blobUrl;
                                // Trigger change event for TinyMCE to pick up
                                field.dispatchEvent(new Event('change'));
                            }
                        }
                    });
                }
            },
            /* enable automatic uploads of images represented by blob or data URIs*/
            automatic_uploads: true,
            file_picker_types: 'file image media',
            /* and here's our custom image picker - opens Media Library modal */
            file_picker_callback: function (cb, value, meta) {
                // Open Media Library modal
                const filemanager = window.eXeLearning?.app?.modals?.filemanager;
                if (filemanager) {
                    filemanager.show({
                        onSelect: function(result) {
                            // result = { assetUrl, blobUrl, asset }

                            // For PDFs, use asset:// URL directly (resolved by asset system)
                            // This avoids TinyMCE converting to base64
                            if (result.asset.mime === 'application/pdf') {
                                cb(result.assetUrl, {
                                    title: result.asset.filename || '',
                                    'data-mce-pdf': 'true'
                                });
                                return;
                            }

                            // For HTML files, bypass TinyMCE's media dialog and insert iframe directly
                            // TinyMCE's media dialog creates <video> elements for all sources, not <iframe>
                            const filename = result.asset.filename || '';
                            if (result.asset.mime === 'text/html' || /\.html?$/i.test(filename)) {
                                // Get the active TinyMCE editor
                                const editor = tinymce.activeEditor;
                                if (editor) {
                                    // Insert iframe directly with asset:// URL
                                    // resolveAssetUrlsInEditor will use resolveHtmlWithAssets() for display
                                    editor.insertContent(
                                        '<iframe src="' + result.assetUrl + '" ' +
                                        'data-mce-html="true" ' +
                                        'style="width:100%; height:600px; border:1px solid #ccc;"></iframe>'
                                    );
                                    // Close the TinyMCE media dialog
                                    editor.windowManager.close();
                                }
                                return;
                            }

                            // Use blob URL directly - it's already in AssetManager cache
                            // When images_upload_handler is triggered by TinyMCE (automatic_uploads: true),
                            // it will find this blob URL in reverseBlobCache and return immediately
                            // without re-processing. Later, convertBlobUrlsToAssetUrls() will convert
                            // blob:// to asset:// for persistence.
                            const assetManager = window.eXeLearning?.app?.project?._yjsBridge?.assetManager;

                            // Ensure blob URL is in cache (it should be, but verify)
                            if (assetManager && result.blobUrl && result.asset?.id) {
                                if (!assetManager.reverseBlobCache.has(result.blobUrl)) {
                                    assetManager.reverseBlobCache.set(result.blobUrl, result.asset.id);
                                    assetManager.blobURLCache.set(result.asset.id, result.blobUrl);
                                }
                            }

                            cb(result.blobUrl, {
                                title: result.asset.filename || '',
                                alt: result.asset.filename || '',
                                'data-asset-id': result.asset.id  // CRITICAL: Used by convertBlobURLsToAssetRefs
                            });
                        }
                    });
                } else {
                    console.warn('[TinyMCE] Media Library not available');
                }
            },

            // Drag and Drop
            paste_data_images: true,
            // Upload tab?
            image_uploadtab: false,
            images_upload_handler: async function (blobInfo, success, failure) {
                // Check if this is a blob URL from the AssetManager (already stored in IndexedDB)
                const blobUri = blobInfo.blobUri();
                const assetManager = window.eXeLearning?.app?.project?._yjsBridge?.assetManager;

                if (assetManager && blobUri && blobUri.startsWith('blob:')) {
                    // Check if this blob URL is in our cache (meaning it's from AssetManager)
                    if (assetManager.reverseBlobCache.has(blobUri)) {
                        // Already an asset, no upload needed - just return the blob URL
                        success(blobUri);
                        return;
                    }
                }

                // Store pasted/dropped images in AssetManager (IndexedDB)
                if (assetManager) {
                    $exeTinyMCE.lockScreen();
                    try {
                        const blob = blobInfo.blob();
                        const file = new File([blob], blobInfo.filename() || 'image.png', { type: blob.type });
                        const assetUrl = await assetManager.insertImage(file);

                        // Extract UUID from asset:// URL (insertImage returns "asset://uuid/filename")
                        const assetId = assetManager.extractAssetId(assetUrl);

                        // Get or create blob URL for the asset (using synced method to ensure reverseBlobCache consistency)
                        let newBlobUrl = assetManager.getBlobURLSynced?.(assetId) ?? assetManager.blobURLCache.get(assetId);
                        if (!newBlobUrl) {
                            // Use the original blob directly (works for both new and deduplicated assets)
                            // since we already have it in memory
                            newBlobUrl = URL.createObjectURL(blob);
                            assetManager.blobURLCache.set(assetId, newBlobUrl);
                            assetManager.reverseBlobCache.set(newBlobUrl, assetId);
                        } else if (!assetManager.reverseBlobCache.has(newBlobUrl)) {
                            // CRITICAL: Ensure reverseBlobCache is synced - this is required for convertBlobUrlsToAssetUrls
                            assetManager.reverseBlobCache.set(newBlobUrl, assetId);
                        }
                        // CRITICAL: Pass data-asset-id so convertBlobURLsToAssetRefs can convert even if blob URL changes
                        success(newBlobUrl, { 'data-asset-id': assetId });
                    } catch (err) {
                        console.error('[TinyMCE] Failed to store in AssetManager:', err);
                        failure(_('Error storing image'));
                    }
                    $exeTinyMCE.unlockScreen();
                } else {
                    // AssetManager not available - cannot store image
                    console.error('[TinyMCE] AssetManager not available');
                    failure(_('Media library not available'));
                }
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
            setup: function (ed) {
                // Register SetContent handler BEFORE content is loaded
                // This is critical for resolving asset:// URLs in the initial content
                ed.on('SetContent', function() {
                    $exeTinyMCE.resolveAssetUrlsInEditor(ed);
                });
            },
            init_instance_callback: function (ed) {
                if (mode == 'multiple') {
                    if (divExists) div.removeAttr('style'); // FR 303
                    $exeTinyMCEToggler.init(ed.id, hide);
                }

                // Hook for Yjs collaborative editing - bind editor if Yjs is enabled
                if (typeof $exeTinyMCE.onEditorInit === 'function') {
                    $exeTinyMCE.onEditorInit(ed);
                }

                // Note: SetContent handler is now registered in setup() callback
                // to catch the initial content load before init_instance_callback runs

                // Also observe DOM changes for dynamically inserted media (e.g., audio recorder, PDF embed)
                const editorBody = ed.getBody();
                if (editorBody) {
                    const observer = new MutationObserver(function(mutations) {
                        let hasNewMedia = false;
                        for (const mutation of mutations) {
                            if (mutation.type === 'childList') {
                                for (const node of mutation.addedNodes) {
                                    if (node.nodeType === 1) {
                                        const hasAssetUrl = node.querySelector?.('audio[src^="asset://"], video[src^="asset://"], iframe[src^="asset://"]') ||
                                            (node.matches?.('audio[src^="asset://"], video[src^="asset://"], iframe[src^="asset://"]'));
                                        if (hasAssetUrl) {
                                            hasNewMedia = true;
                                            break;
                                        }
                                    }
                                }
                            }
                            if (hasNewMedia) break;
                        }
                        if (hasNewMedia) {
                            $exeTinyMCE.resolveAssetUrlsInEditor(ed);
                        }
                    });
                    observer.observe(editorBody, { childList: true, subtree: true });

                    // Clean up observer when editor is removed
                    ed.on('remove', function() {
                        observer.disconnect();
                    });
                }
            },
        }); //End tinymce
    },

    getSchema: function () {
        var s = 'html5';
        return s;
    },

    getContentCSS: function () {
        // Fallback theme path if theme not yet selected (timing issue during iDevice loading)
        var themePath = eXeLearning.app.themes.selected?.path || '/files/perm/themes/base/INTEF/';
        return (
            themePath +
            'style.css,' +
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

    /**
     * Resolve asset:// URLs to blob:// URLs for audio/video elements in TinyMCE editor
     * This allows media to play within the editor while keeping asset:// URLs for persistence
     *
     * NOTE: We intentionally DO NOT resolve iframes (PDFs) because:
     * 1. TinyMCE strips custom attributes like data-asset-src when processing media elements
     * 2. This causes the blob:// URL to be saved instead of asset://
     * 3. PDFs don't need playback preview in the editor - they display correctly in preview mode
     *
     * @param {Object} ed - TinyMCE editor instance
     */
    resolveAssetUrlsInEditor: function (ed) {
        const assetManager = window.eXeLearning?.app?.project?._yjsBridge?.assetManager;
        if (!assetManager) return;

        const body = ed.getBody();
        if (!body) return;

        // Find audio, video, and iframe elements with asset:// URLs
        const mediaElements = body.querySelectorAll('audio[src^="asset://"], video[src^="asset://"], iframe[src^="asset://"]');

        for (const media of mediaElements) {
            const assetUrl = media.getAttribute('src');
            if (!assetUrl || !assetUrl.startsWith('asset://')) continue;

            const isIframe = media.tagName.toLowerCase() === 'iframe';

            // For audio/video: Skip if already resolved (has data-asset-src)
            // For iframes: Skip if src is already a blob URL (already resolved)
            if (!isIframe && media.getAttribute('data-asset-src')) continue;
            if (isIframe && media.getAttribute('src').startsWith('blob:')) continue;

            // For audio/video: Store the original asset URL in data-asset-src
            // For iframes: DON'T add data-asset-src - TinyMCE preserves the URL via data-mce-p-src
            // on the parent span.mce-preview-object
            if (!isIframe) {
                media.setAttribute('data-asset-src', assetUrl);
            }

            // Check if this is an HTML iframe (needs full resolution with internal URLs)
            const isHtmlIframe = isIframe && (
                media.getAttribute('data-mce-html') === 'true' ||
                assetUrl.match(/\.html?$/i)
            );

            if (isHtmlIframe) {
                // For HTML iframes, store original asset URL before resolving
                // This is needed because TinyMCE doesn't wrap directly-inserted iframes in span.mce-preview-object
                media.setAttribute('data-asset-src', assetUrl);

                // For HTML iframes, use resolveHtmlWithAssets to resolve internal URLs
                const assetIdMatch = assetUrl.match(/asset:\/\/([a-f0-9-]+)/i);
                if (assetIdMatch) {
                    assetManager.resolveHtmlWithAssets(assetIdMatch[1]).then(function(resolvedUrl) {
                        if (resolvedUrl) {
                            media.setAttribute('src', resolvedUrl);
                            // Register in reverseBlobCache so convertBlobUrlsToAssetUrls can restore it
                            assetManager.reverseBlobCache.set(resolvedUrl, assetIdMatch[1]);
                        }
                    }).catch(function(err) {
                        console.warn('[TinyMCE] Failed to resolve HTML asset:', assetUrl, err);
                    });
                }
            } else {
                // Resolve to blob URL asynchronously (for audio, video, PDF iframes)
                assetManager.resolveAssetURL(assetUrl).then(function(blobUrl) {
                    if (blobUrl) {
                        media.setAttribute('src', blobUrl);
                    }
                }).catch(function(err) {
                    console.warn('[TinyMCE] Failed to resolve asset URL:', assetUrl, err);
                });
            }
        }

        // Also handle TinyMCE's mce-preview-object spans (used for media preview)
        const previewSpans = body.querySelectorAll('span.mce-preview-object[data-mce-p-src^="asset://"]');

        for (const span of previewSpans) {
            const assetUrl = span.getAttribute('data-mce-p-src');
            if (!assetUrl || !assetUrl.startsWith('asset://')) continue;

            // Find the inner media element (audio, video, or iframe)
            const innerMedia = span.querySelector('audio, video, iframe');
            if (!innerMedia) continue;

            const isIframe = innerMedia.tagName.toLowerCase() === 'iframe';

            // For audio/video: Skip if already resolved (has data-asset-src)
            // For iframes: Skip if src is already a blob URL
            if (!isIframe && innerMedia.getAttribute('data-asset-src')) continue;
            if (isIframe && innerMedia.getAttribute('src')?.startsWith('blob:')) continue;

            // Store the original asset URL in data-asset-src for all media types
            // This ensures the asset URL is preserved even if TinyMCE doesn't wrap in mce-preview-object
            innerMedia.setAttribute('data-asset-src', assetUrl);

            // Check if this is an HTML iframe (needs full resolution with internal URLs)
            const isHtmlIframe = isIframe && (
                innerMedia.getAttribute('data-mce-html') === 'true' ||
                assetUrl.match(/\.html?$/i)
            );

            if (isHtmlIframe) {
                // For HTML iframes, use resolveHtmlWithAssets to resolve internal URLs
                const assetIdMatch = assetUrl.match(/asset:\/\/([a-f0-9-]+)/i);
                if (assetIdMatch) {
                    assetManager.resolveHtmlWithAssets(assetIdMatch[1]).then(function(resolvedUrl) {
                        if (resolvedUrl) {
                            innerMedia.setAttribute('src', resolvedUrl);
                            // Register in reverseBlobCache so convertBlobUrlsToAssetUrls can restore it
                            assetManager.reverseBlobCache.set(resolvedUrl, assetIdMatch[1]);
                        }
                    }).catch(function(err) {
                        console.warn('[TinyMCE] Failed to resolve HTML asset in preview:', assetUrl, err);
                    });
                }
            } else {
                // Resolve to blob URL asynchronously (for audio, video, PDF iframes)
                assetManager.resolveAssetURL(assetUrl).then(function(blobUrl) {
                    if (blobUrl) {
                        innerMedia.setAttribute('src', blobUrl);
                    }
                }).catch(function(err) {
                    console.warn('[TinyMCE] Failed to resolve asset URL in preview:', assetUrl, err);
                });
            }
        }
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
                '</div>'
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
                    '</a>'
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

// Export for Node.js/CommonJS (tests)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { $exeTinyMCE, $exeTinyMCEToggler };
}
