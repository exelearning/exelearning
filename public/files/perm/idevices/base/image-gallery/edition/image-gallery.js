var $exeDevice = {
    /**
     *  i18n
     */
    i18n: {
        name: _('Image gallery'),
        es: {
            'No Images Loaded': 'No Hay imagenes',
            'add image': 'Añadir imagenes',
        },
    },

    // ::: IDs for attribution options :::
    titleId: 'title',
    linktitleId: 'linktitle',
    authorId: 'author',
    linkauthorId: 'linkauthor',
    licenseId: 'license',

    // ::: Text for attribution options :::
    titleText: _('Title'),
    linktitleText: _('Link Title'),
    authorText: _('Author'),
    linkauthorText: _('Author URL'),
    licenseText: _('License'),

    // ::: iDevice default data :::
    // Title
    defaultTitle: '',
    defaultLinkTitle: '',
    defaultAuthor: '',
    defaultLinkAuthor: '',
    // License data list
    defaultLicense: '',
    licensePlacecholder: _('Choose a license...'),
    licenseOptions: [
        // { value: _("Choose a license...")},
        { value: _('Public Domain') },
        { value: 'GNU/GPL' },
        { value: 'Creative Commons (' + _('Public Domain') + ')' },
        { value: 'Creative Commons BY' },
        { value: 'Creative Commons BY-SA' },
        { value: 'Creative Commons BY-ND' },
        { value: 'Creative Commons BY-NC' },
        { value: 'Creative Commons BY-NC-SA' },
        { value: 'Creative Commons BY-NC-ND' },
        { value: 'Copyright (' + _('All Rights Reserved') + ')' },
        // { value: _("Choose a license..."), title: "" },
        // { value: _("Public Domain"), title: "pd" },
        // { value: "GNU/GPL", title: "gnu-gpl" },
        // { value: "Creative Commons (" + _("Public Domain") + ")", title: "CC0" },
        // { value: "Creative Commons BY", title: "CC-BY" },
        // { value: "Creative Commons BY-SA", title: "CC-BY-SA" },
        // { value: "Creative Commons BY-ND", title: "CC-BY-ND" },
        // { value: "Creative Commons BY-NC", title: "CC-BY-NC" },
        // { value: "Creative Commons BY-NC-SA", title: "CC-BY-NC-SA" },
        // { value: "Creative Commons BY-NC-ND", title: "CC-BY-NC-ND" },
        // { value: "Copyright (" + _("All Rights Reserved") + ")", title: "copyright" }
    ],

    // ::: List of elements to save :::
    dataIds: [],

    // ::: To save attribution modal data :::
    attributionData: {},
    attributionDataKeys: [
        'title',
        'linktitle',
        'author',
        'linkauthor',
        'license',
    ],

    /**
     * Init required eXe function
     */
    init: function (element, previousData) {
        //** eXeLearning idevice engine data ***************************
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        //**************************************************************
        this.idImage = 0;
        this.editionId = null;
        this.createForm();
    },

    /**
     * Create form main function
     * @called by exeDevice.init
     */
    createForm: function () {
        var html = `
      <div class="imageGalleryIdeviceForm">
        <div id="UploadImage">\
          <input type="button" id="addImageButton" value="${_('Add images')}"/>
          <span class="small text-muted" id="addImageInstructions">${_('Choose files or drag them here.')}</span>
          <input type="file" id="imageLoaded" multiple accept=".png, .jpeg, .jpg, .gif" style="display:none;" >
          <p id="textMsxHide">${_('The gallery has no images.')}</p>
        </div>
        <div id="imagesContainer"></div>
      </div>
    `;
        // Insert HTML into idevice body
        this.ideviceBody.innerHTML = html;
        // Load previous values
        this.loadPreviousValues(this.idevicePreviousData);
        // Add behaviour
        this.addImageButtonBehaviour();
        this.addImageBehaviour();
        this.addDragAndDropBehaviour();
        this.addSortableBehaviour(null);
        // set idImage equal to actual number of images (necesary to edit the idevice)
        this.idImage = this.ideviceBody.querySelectorAll(
            '.imgSelectContainer'
        ).length;
    },

    /**
     * Return the save
     *
     * @param {*} field
     */
    loadPreviousValues: function () {
        let data = this.idevicePreviousData;
        let incrementalId = 0;
        if (Object.keys(data).length > 1) {
            this.ideviceBody.querySelector('#textMsxHide').style.display =
                'none';
        }
        // Load images
        Object.entries(data).forEach(([key, value]) => {
            if (key !== 'ideviceId') {
                let imageData = {};
                this.attributionDataKeys.forEach((attrkey) => {
                    if (attrkey === 'license') {
                        imageData[attrkey] = this.getLicenseTitle(
                            value[attrkey]
                        );
                    } else {
                        imageData[attrkey] = value[attrkey];
                    }
                });
                $exeDevice.attributionData[`img_${incrementalId}`] = imageData;
                this.addImageHTML(incrementalId, value.img, value.thumbnail);
                incrementalId++;
            }
        });
    },

    /**
     * eXe idevice engine
     * Idevice api function
     *
     * It returns the HTML to save. Return false if you find any error
     *
     * @returns {String}
     */
    save: function () {
        let divImages = this.ideviceBody.querySelectorAll(
            '.imgSelectContainer'
        );

        divImages.forEach((divImg) => {
            this.dataIds.push(divImg.querySelector('img.image').id);
        });

        this.dataIds.forEach((element) => {
            let thumbnailURL = this.ideviceBody
                .querySelector(`#${element}`)
                .getAttribute('src');
            let imageURL = this.ideviceBody
                .querySelector(`#${element}`)
                .getAttribute('origin');
            let imageTitle,
                imageLinkTitle,
                imageAuthor,
                imageLinkAuthor,
                imageLicense;
            imageTitle =
                imageLinkTitle =
                imageAuthor =
                imageLinkAuthor =
                imageLicense =
                    '';

            if ($exeDevice.attributionData[element]) {
                imageTitle = $exeDevice.attributionData[element].title;
                imageLinkTitle = $exeDevice.attributionData[element].linktitle;
                imageAuthor = $exeDevice.attributionData[element].author;
                imageLinkAuthor =
                    $exeDevice.attributionData[element].linkauthor;
                imageLicense = this.getLicenseValue(
                    $exeDevice.attributionData[element].license
                );
            }

            let imageData = {
                img: imageURL,
                thumbnail: thumbnailURL,
                title: imageTitle,
                linktitle: imageLinkTitle,
                author: imageAuthor,
                linkauthor: imageLinkAuthor,
                license: imageLicense,
            };
            this[element] = imageData;
        });

        // Check if the values ​​are valid
        if (this.checkFormValues()) {
            return this.getDataJson();
        } else {
            return false;
        }
    },

    /**
     * Check if the form values are correct
     *
     * @returns {Boolean}
     */
    checkFormValues: function () {
        if (this.text == '') {
            eXe.app.alert(_('Please write some text.'));
            return false;
        }
        return true;
    },

    /**
     * Get a JSON with the idevice data
     *
     * @returns {Array}
     */
    getDataJson: function () {
        let data = {};

        data.ideviceId = this.ideviceBody.getAttribute('idevice-id');

        this.dataIds.forEach((key) => (data[key] = this[key]));

        return data;
    },

    /**
     * Add behaviour to button addImage
     * Opens the media library modal with multi-select enabled
     */
    addImageButtonBehaviour: function () {
        this.ideviceBody
            .querySelector('#addImageButton')
            .addEventListener('click', (event, id) => {
                // Open file manager with multi-select for adding new images
                this.openFileManagerForImages(true);
            });
    },

    /**
     * Open the file manager modal for selecting images
     * @param {boolean} multiSelect - Whether to allow multiple selection
     */
    openFileManagerForImages: function (multiSelect) {
        const fileManager = eXeLearning?.app?.modals?.filemanager;
        if (!fileManager) {
            // Fallback to native file input if modal not available
            console.warn('[ImageGallery] File manager not available, using native file input');
            this.ideviceBody.querySelector('#imageLoaded').click();
            return;
        }

        fileManager.show({
            accept: 'image',
            multiSelect: multiSelect,
            onSelect: (result) => {
                // Handle selected assets
                if (multiSelect && Array.isArray(result)) {
                    // Multiple images selected
                    result.forEach(assetInfo => {
                        this.addImageFromAsset(assetInfo);
                    });
                } else if (result) {
                    // Single image selected (for modify)
                    this.addImageFromAsset(result);
                }
            }
        });
    },

    /**
     * Add an image from asset manager selection
     * @param {Object} assetInfo - Object with assetUrl, blobUrl, and asset properties
     */
    addImageFromAsset: function (assetInfo) {
        const { assetUrl, blobUrl, asset } = assetInfo;

        // Hide the "no images" message
        this.ideviceBody.querySelector('#textMsxHide').style.display = 'none';

        if (this.editionId != null && this.editionId >= 0) {
            // Editing existing image
            let img = this.ideviceBody.querySelector(`#img_${this.editionId}`);
            img.setAttribute('origin', assetUrl);
            img.setAttribute('src', assetUrl);
        } else {
            // Adding new image
            this.addImageHTML(this.idImage, assetUrl, assetUrl);
            // Add sortable behaviour to the new image
            let images = this.ideviceBody.querySelectorAll('.imgSelectContainer');
            this.addSortableBehaviour(images[images.length - 1]);
            this.idImage++;
        }
        this.editionId = null;
    },

    /**
     *
     */
    readFile: function (file) {
        return new Promise((resolve, reject) => {
            let reader = new FileReader();
            reader.onload = (field) => {
                resolve(field.target.result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    /**
     * Process a dropped or selected file
     * Uses AssetManager directly for immediate asset:// URL generation
     */
    processFile: async function (file) {
        try {
            // Try to use AssetManager directly for immediate asset:// URLs
            const assetManager = eXeLearning?.app?.project?._yjsBridge?.assetManager;
            if (assetManager) {
                const assetUrl = await assetManager.insertImage(file);
                if (assetUrl) {
                    this.addImageFromAsset({
                        assetUrl: assetUrl,
                        blobUrl: assetManager.blobURLCache.get(assetManager.extractAssetId(assetUrl)),
                        asset: { filename: file.name }
                    });
                    return;
                }
            }

            // Fallback to old upload method if AssetManager not available
            let buffer = await this.readFile(file);
            await this.addUploadImage(buffer, file.name);
            // Add sortable behaviour to the news images
            let images = $exeDevice.ideviceBody.querySelectorAll(
                '.imgSelectContainer'
            );
            $exeDevice.addSortableBehaviour(images[images.length - 1]);
        } catch (err) {
            console.error('[ImageGallery] Error processing file:', err);
        }
    },

    /**
     * Upload Image and add to image container
     *
     * @param {*} imageData
     * @param {*} imageName
     */
    addUploadImage: async function (imageData, imageName) {
        let response = await eXe.app.uploadFile(imageData, imageName);
        if (
            response &&
            response.savedPath &&
            response.savedFilename &&
            response.savedThumbnailName
        ) {
            let originPath = `${response.savedPath}/${response.savedFilename}`;
            let thumbnailPath = `${response.savedPath}/${response.savedThumbnailName}`;
            // Add image HTML
            if (this.editionId != null && this.editionId >= 0) {
                let img = this.ideviceBody.querySelector(
                    `#img_${this.editionId}`
                );
                img.setAttribute('origin', originPath);
                img.setAttribute('src', thumbnailPath);
            } else {
                this.addImageHTML(this.idImage, originPath, thumbnailPath);
                this.idImage++;
            }
            this.editionId = null;
        }
    },

    /**
     * Add behaviour to change image event
     *
     * @param {*} field
     * @returns
     */
    addImageBehaviour: async function () {
        this.ideviceBody
            .querySelector('#imageLoaded')
            .addEventListener('change', (field) => {
                this.ideviceBody.querySelector('#textMsxHide').style.display =
                    'none';
                Array.from(field.target.files).forEach((file) => {
                    this.processFile(file);
                });
            });
    },

    /**
     * To generate the HTML container of image
     *
     * @param {*} id
     * @param {*} thumbnailURL
     */
    addImageHTML: function (id, originURL, thumbnailURL) {
        let html = `
      <div class="imgSelect">
        <div class="imageElement">
          <img height=128 width=128 src="${thumbnailURL}" id="img_${id}" class="image" origin="${originURL}" draggable="false">
        </div>
      </div>
      <div class="imgButtons">
        ${$exeDevice.getAttributionButtonHTML(id)}
        ${$exeDevice.getModiButtonHTML(id)}
        ${$exeDevice.getUpButtonHTML(id)}
        ${$exeDevice.getDownButtonHTML(id)}
        ${$exeDevice.getRemoveButtonHTML(id)}
      </div>`;
        let imgContainer = document.createElement('div');
        imgContainer.id = `imgSelectContainer_${id}`;
        imgContainer.classList.add('imgSelectContainer');
        imgContainer.innerHTML = html;
        this.ideviceBody
            .querySelector('#imagesContainer')
            .appendChild(imgContainer);
        this.addEventButtonsBehaviour(id);
        this.disabledButtons();
    },

    /**
     * Get HTML button attribution image
     *
     * @param {*} id
     * @returns string
     */
    getAttributionButtonHTML: function (id) {
        var html = `<button type="button" id="buttonAttribution_${id}" class="attribution" title="${_('Edit information')}"><i aria-hidden="true">edit</i><span class="visually-hidden">${_('Edit information')}</span></button>`;
        return html;
    },

    /**
     * Get HTML button up image
     *
     * @param {*} id
     * @returns string
     */
    getUpButtonHTML: function (id) {
        var html = `<button type="button" id="buttonUp_${id}" class="up" title="${_('Move up')}"><i aria-hidden="true">keyboard_arrow_left</i><span class="visually-hidden">${_('Move up')}</span></button>`;
        return html;
    },

    /**
     * Get HTML button down image
     *
     * @param {*} id
     * @returns string
     */
    getDownButtonHTML: function (id) {
        var html = `<button type="button" id="buttonDown_${id}" class="down" title="${_('Move down')}"><i aria-hidden="true">keyboard_arrow_right</i><span class="visually-hidden">${_('Move down')}</span></button>`;
        return html;
    },

    /**
     * Get HTML button modify image
     *
     * @param {*} id
     * @returns string
     */
    getModiButtonHTML: function (id) {
        var html = `<button type="button" id="buttonModify_${id}" class="modify" title="${_('Edit image')}"><i aria-hidden="true">image</i><span class="visually-hidden">${_('Edit image')}</span></button>`;
        return html;
    },

    /**
     * Get HTML button delete image
     *
     * @param {*} id
     * @returns string
     */
    getRemoveButtonHTML: function (id) {
        var html = `<button type="button" id="buttonRemove_${id}" class="remove" title="${_('Delete')}"><i aria-hidden="true">close</i><span class="visually-hidden">${_('Delete')}</span></button>`;
        return html;
    },

    /**
     * Input text
     * Function to create HTML textfield input
     *
     * @param {} id
     * @param {*} title
     *
     * @returns {String}
     */
    createInputHTML: function (id, title, instructions, value, placeholder) {
        let instructionsSpan = instructions
            ? `<span class="exe-field-instructions">${instructions}</span>`
            : '';
        let placeholderAttrib = placeholder
            ? `placeholder="${placeholder}"`
            : '';
        return `
          <div class="property-row">
            <label for="${id}">${title}:</label>
            <input type="text" value="${value}" ${placeholderAttrib} class="ideviceTextfield" name="${id}" id="${id}" onfocus="this.select()" />
            ${instructionsSpan}
          </div>`;
    },

    // /**
    //  * Dropdown List
    //  * Function to create HTML dropdown list
    //  *
    //  * @param {String} id
    //  * @param {String} title
    //  * @param {String} placeholder
    //  * @param {String} options
    //  * @param {String} value
    //  *
    //  * @returns {String}
    //  */
    // createDropDownListHTML: function (id, title, placeholder, options, value) {
    //   let optionsHTML = "";
    //   options.forEach(option => {
    //     if (option.value === value) {
    //       optionsHTML += `<option value="${option.value}" selected>${option.title}</option>`
    //     } else {
    //       optionsHTML += `<option value="${option.value}">${option.title}</option>`
    //     }
    //   })
    //   return `
    //         <div class="property-row">
    //           <label for="${id}-options" class="form-label">${title}</label>
    //           <select id="${id}-options">
    //             ${optionsHTML}
    //           </select>
    //         </div>`;
    // },

    /**
     * DataList
     * Function to create HTML datalist
     *
     * @param {String} id
     * @param {String} title
     * @param {String} placeholder
     * @param {String} options
     * @param {String} value
     *
     * @returns {String}
     */
    createDataListHTML: function (id, title, placeholder, options, value) {
        let optionsHTML = '';
        options.forEach((option) => {
            optionsHTML += `<option value="${option.value}">`;
        });
        return `
        <div class="property-row">
          <label for="${id}" class="form-label">${title}</label>
          <input class="ideviceTextfield " list="${id}-options" value="${value}" id="${id}" placeholder="${placeholder}">
          <datalist id="${id}-options">
            ${optionsHTML}
          </datalist>
        </div>`;
    },

    /**
     * Function to create HTML body of modal attribution window
     *
     * @param {String} id
     *
     * @returns {String}
     */
    createAttributionBodyHTML: function (id) {
        let imgId = `img_${id}`;
        let attrTitle = this.defaultTitle;
        let attrLinkTitle = this.defaultLinkTitle;
        let attrAuthor = this.defaultAuthor;
        let attrLinkAuthor = this.defaultLinkAuthor;
        let attrLicense = this.defaultLicense;

        // Check if exist data of this image
        if (this.attributionData[imgId]) {
            attrTitle = this.attributionData[imgId].title;
            attrLinkTitle = this.attributionData[imgId].linktitle;
            attrAuthor = this.attributionData[imgId].author;
            attrLinkAuthor = this.attributionData[imgId].linkauthor;
            attrLicense = this.attributionData[imgId].license;
        }

        let attrBodyHTML =
            '<div class="form-properties"><div class="properties-body-container"><div class="exe-properties-form-content"><div class="exe-table-content">';
        attrBodyHTML += this.createInputHTML(
            `${imgId}_${this.titleId}`,
            this.titleText,
            '',
            attrTitle
        );
        attrBodyHTML += this.createInputHTML(
            `${imgId}_${this.linktitleId}`,
            this.linktitleText,
            '',
            attrLinkTitle
        );
        attrBodyHTML += this.createInputHTML(
            `${imgId}_${this.authorId}`,
            this.authorText,
            '',
            attrAuthor
        );
        attrBodyHTML += this.createInputHTML(
            `${imgId}_${this.linkauthorId}`,
            this.linkauthorText,
            '',
            attrLinkAuthor
        );
        attrBodyHTML += this.createDataListHTML(
            `${imgId}_${this.licenseId}`,
            this.licenseText,
            this.licensePlacecholder,
            this.licenseOptions,
            attrLicense
        );
        attrBodyHTML += '</div></div></div></div>';
        return attrBodyHTML;
    },

    /**
     * Add events to buttons
     *
     * @param {*} id
     */
    addEventButtonsBehaviour: function (id) {
        let imageElement = this.ideviceBody.querySelector(
            `#imgSelectContainer_${id}`
        );
        // Add button
        /*
    this.ideviceBody.querySelector(`#buttonAdd_${id}`).addEventListener("click", () => {
      // Not implementing
    });
    */
        // Attribution button
        this.ideviceBody
            .querySelector(`#buttonAttribution_${id}`)
            .addEventListener('click', () => {
                let attributionTitle = _('Image attribution');
                let attributionBody = this.createAttributionBodyHTML(id);
                let imgId = `img_${id}`;
                eXeLearning.app.modals.confirm.show({
                    title: attributionTitle,
                    body: attributionBody,
                    confirmButtonText: _('Save'),
                    cancelButtonText: _('Close'),
                    confirmExec: () => {
                        // Actions if click Yes
                        $exeDevice.attributionData[imgId] = {
                            title: $(`#${imgId}_${$exeDevice.titleId}`)[0]
                                .value,
                            linktitle: $(
                                `#${imgId}_${$exeDevice.linktitleId}`
                            )[0].value,
                            author: $(`#${imgId}_${$exeDevice.authorId}`)[0]
                                .value,
                            linkauthor: $(
                                `#${imgId}_${$exeDevice.linkauthorId}`
                            )[0].value,
                            license: $(
                                `#${imgId}_${$exeDevice.licenseId}-options`
                            )[0].previousElementSibling.value,
                        };
                    },
                });
            });
        // Modify button
        this.ideviceBody
            .querySelector(`#buttonModify_${id}`)
            .addEventListener('click', () => {
                this.editionId = id;
                // Open file manager with single-select for modifying
                this.openFileManagerForImages(false);
            });
        // Remove button
        this.ideviceBody
            .querySelector(`#buttonRemove_${id}`)
            .addEventListener('click', () => {
                imageElement.remove();
                this.disabledButtons();
                if (this.checkImages() == 0)
                    $exeDevice.ideviceBody.querySelector(
                        '#textMsxHide'
                    ).style.display = '';
                $exeDevice.getReferences();
            });
        // Move up button
        this.ideviceBody
            .querySelector(`#buttonUp_${id}`)
            .addEventListener('click', () => {
                let prev = $(imageElement).prev();
                if (prev.length > 0) {
                    prev.insertAfter(imageElement);
                    this.disabledButtons();
                    $exeDevice.getReferences();
                }
            });
        // Move down button
        this.ideviceBody
            .querySelector(`#buttonDown_${id}`)
            .addEventListener('click', () => {
                let next = $(imageElement).next();
                if (next.length > 0) {
                    next.insertBefore(imageElement);
                    this.disabledButtons();
                    $exeDevice.getReferences();
                }
            });
    },

    /**
     * Check number of images in gallery
     *
     * @returns {number}
     */
    checkImages: function () {
        return this.ideviceBody.querySelectorAll('.imgSelectContainer').length;
    },

    /**
     * Check buttons to add classes
     *
     */
    disabledButtons: function () {
        let imageElements = document.querySelectorAll('.imgSelectContainer');
        imageElements.forEach((imageElement) => {
            let prev = $(imageElement).prev();
            let next = $(imageElement).next();
            let buttonUp = imageElement.querySelector('button.up');
            let buttonDown = imageElement.querySelector('button.down');

            buttonUp.classList.remove('disabled');
            buttonDown.classList.remove('disabled');

            if (prev.length == 0) buttonUp.classList.add('disabled');
            if (next.length == 0) buttonDown.classList.add('disabled');
        });
    },

    /**
     * Add drag and drop behaviour
     *
     */
    addDragAndDropBehaviour: function () {
        const dropArea = $exeDevice.ideviceBody.querySelector(
            '.imageGalleryIdeviceForm'
        );

        const resize_ob = new ResizeObserver(function (entries) {
            // // since we are observing only a single element, so we access the first element in entries array
            // let rect = entries[0].contentRect;

            // // current width & height
            // let width = rect.width;
            // let height = rect.height;
            if (typeof $exeDevice === 'object') {
                $exeDevice.getReferences();
            }
        });

        // start observing for resize
        resize_ob.observe(dropArea);

        this.dropAreaEvents(dropArea);
    },

    /**
     * Add sortable behaviour to items in drag and drop area
     *
     * @param {elemet} item - can be null. If null search all childs of the drop area
     *
     */
    addSortableBehaviour: function (item) {
        let sortables = $exeDevice.ideviceBody.querySelectorAll(
            '.imgSelectContainer'
        );

        if (item === 'undefined' || item === null) {
            sortables.forEach((imgContainer) => {
                this.itemsDropAreaEvents(imgContainer);
            });
        } else {
            this.itemsDropAreaEvents(item);
        }

        this.getReferences();
    },

    /**
     * Add events to drop area
     *
     * @param {Element} dropAreaElement
     */
    dropAreaEvents: function (dropAreaElement) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
            dropAreaElement.addEventListener(
                eventName,
                this.preventDefaults,
                false
            );
        });

        ['dragenter', 'dragover'].forEach((eventName) => {
            dropAreaElement.addEventListener(
                eventName,
                this.dropAreaHighlight,
                false
            );
        });

        ['dragleave', 'drop'].forEach((eventName) => {
            dropAreaElement.addEventListener(
                eventName,
                this.dropAreaUnhighlight,
                false
            );
        });

        dropAreaElement.addEventListener(
            'drop',
            this.dropAreaHandleDrop,
            false
        );
    },

    // Reference to stable drag and drop hightlight
    inDropArea: false,
    indexDraggingItem: null,
    indexOverItem: null,
    imgContainerHighlighted: null,

    // References for sortable behaviour
    firstItems: [],
    areasBeforeFirstItems: [],
    lastItems: [],
    areasAfterLastItems: [],

    preventDefaults: function (e) {
        e.preventDefault();
        e.stopPropagation();
    },

    /**
     * Add style to dropArea
     *
     */
    dropAreaHighlight: function (e) {
        $exeDevice.inDropArea = true;
        const dropArea = $exeDevice.ideviceBody.querySelector(
            '.imageGalleryIdeviceForm'
        );
        let itemDragging = $exeDevice.ideviceBody.querySelector('.dragging');
        if (itemDragging === null) {
            dropArea.classList.add('highlight');
        } else {
            $exeDevice.areasBeforeFirstItems.forEach((area, index) => {
                if (
                    e.pageX < area.right &&
                    e.pageX > area.left &&
                    e.pageY > area.top &&
                    e.pageY < area.bottom
                ) {
                    $exeDevice.itemUnhighlight();
                    if (itemDragging.getBoundingClientRect().top >= area.top) {
                        $exeDevice.firstItems[index].classList.add('highlight');
                    } else {
                        $exeDevice.firstItems[
                            index
                        ].previousElementSibling.classList.add('highlight');
                    }
                }
            });
            $exeDevice.areasAfterLastItems.forEach((area, index) => {
                if (
                    e.pageX < area.right &&
                    e.pageX > area.left &&
                    e.pageY > area.top &&
                    e.pageY < area.bottom
                ) {
                    $exeDevice.itemUnhighlight();
                    if (itemDragging.getBoundingClientRect().top <= area.top) {
                        $exeDevice.lastItems[index].classList.add('highlight');
                    } else {
                        $exeDevice.lastItems[
                            index
                        ].nextElementSibling.classList.add('highlight');
                    }
                }
            });
        }
    },

    /**
     * Add style to drop area items
     *
     */
    itemHighlight: function (e) {
        let imgContainer = e.srcElement.closest('.imgSelectContainer');
        let itemDragging = $exeDevice.ideviceBody.querySelector('.dragging');
        let imgContainers = $exeDevice.ideviceBody.querySelectorAll(
            '.imgSelectContainer'
        );
        imgContainers.forEach((element, index) => {
            element.classList.remove('highlight');
            if (element === imgContainer) {
                $exeDevice.indexOverItem = index;
            }
            if (element === itemDragging) {
                $exeDevice.indexDraggingItem = index;
            }
        });
        let middleReference =
            imgContainer.getBoundingClientRect().left +
            imgContainer.getBoundingClientRect().width / 2;
        if ($exeDevice.indexDraggingItem < $exeDevice.indexOverItem) {
            if (e.pageX < middleReference) {
                $exeDevice.imgContainerHighlighted =
                    imgContainers[$exeDevice.indexOverItem - 1];
                imgContainers[$exeDevice.indexOverItem - 1].classList.add(
                    'highlight'
                );
            } else {
                $exeDevice.imgContainerHighlighted = imgContainer;
                imgContainer.classList.add('highlight');
            }
        } else if ($exeDevice.indexDraggingItem > $exeDevice.indexOverItem) {
            if (e.pageX > middleReference) {
                $exeDevice.imgContainerHighlighted =
                    imgContainers[$exeDevice.indexOverItem + 1];
                imgContainers[$exeDevice.indexOverItem + 1].classList.add(
                    'highlight'
                );
            } else {
                $exeDevice.imgContainerHighlighted = imgContainer;
                imgContainer.classList.add('highlight');
            }
        } else {
            $exeDevice.imgContainerHighlighted = imgContainer;
            imgContainer.classList.add('highlight');
        }
    },

    /**
     * Remove style to dropArea
     *
     */
    dropAreaUnhighlight: function (e) {
        $exeDevice.itemUnhighlight();
        $exeDevice.inDropArea = false;
        const dropArea = $exeDevice.ideviceBody.querySelector(
            '.imageGalleryIdeviceForm'
        );
        setTimeout(function () {
            if (!$exeDevice.inDropArea) dropArea.classList.remove('highlight');
        }, 100);
    },

    /**
     * Remove style to drop area items
     *
     */
    itemUnhighlight: function (e) {
        let imgContainers = $exeDevice.ideviceBody.querySelectorAll(
            '.imgSelectContainer'
        );
        imgContainers.forEach((element) => {
            element.classList.remove('highlight');
        });
    },

    /**
     * Handle actions required after drop some file in the drop area
     *
     */
    dropAreaHandleDrop: function (e) {
        $exeDevice.ideviceBody.querySelector('#textMsxHide').style.display =
            'none';

        let dt = e.dataTransfer;
        let files = dt.files;

        Array.from(files).forEach((file) => {
            $exeDevice.processFile(file);
        });
    },

    /**
     * Add events to drop area
     *
     * @param {Element} itemDropArea
     */
    itemsDropAreaEvents: function (itemDropArea) {
        itemDropArea.setAttribute('draggable', true);

        // Events reference target image
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
            itemDropArea.addEventListener(
                eventName,
                this.preventDefaults,
                false
            );
        });
        ['dragenter', 'dragover'].forEach((eventName) => {
            itemDropArea.addEventListener(
                eventName,
                this.dropAreaHighlight,
                false
            );
            itemDropArea.addEventListener(eventName, this.itemHighlight, false);
        });
        ['drop'].forEach((eventName) => {
            itemDropArea.addEventListener(
                eventName,
                this.itemUnhighlight,
                false
            );
        });
        itemDropArea.addEventListener(
            'drop',
            this.itemsDropAreaHandleDrop,
            false
        );

        //Events dragged image
        itemDropArea.addEventListener('dragstart', this.handleDragStart, false);
        itemDropArea.addEventListener('dragend', this.handleDragEnd, false);
    },

    /**
     * Add class to the actual dragging element
     *
     */
    handleDragStart: function (e) {
        e.currentTarget.classList.add('dragging');
    },

    /**
     * Handle actions required after finishing dragging the element
     *
     */
    handleDragEnd: function (e) {
        let itemDragging = $exeDevice.ideviceBody.querySelector('.dragging');
        $exeDevice.areasBeforeFirstItems.forEach((area, index) => {
            if (
                e.pageX < area.right &&
                e.pageX > area.left &&
                e.pageY > area.top &&
                e.pageY < area.bottom
            ) {
                $exeDevice.firstItems[index].before(itemDragging);
            }
        });
        $exeDevice.areasAfterLastItems.forEach((area, index) => {
            if (
                e.pageX < area.right &&
                e.pageX > area.left &&
                e.pageY > area.top &&
                e.pageY < area.bottom
            ) {
                $exeDevice.lastItems[index].after(itemDragging);
            }
        });
        e.currentTarget.classList.remove('dragging');
        $exeDevice.getReferences();
    },

    /**
     * Get the references to make possible the sortable behaviour
     *
     */
    getReferences: function () {
        let dropAreaDataPosition = $exeDevice.ideviceBody
            .querySelector('.imageGalleryIdeviceForm')
            .getBoundingClientRect();
        let sortables = $exeDevice.ideviceBody.querySelectorAll(
            '.imgSelectContainer'
        );
        let rowsData = {};
        let referenceTop = null;
        let incrementalRow = 0;

        //Reset references arrays
        this.firstItems = [];
        this.areasBeforeFirstItems = [];
        this.lastItems = [];
        this.areasAfterLastItems = [];

        sortables.forEach((imgContainer, index) => {
            if (index == 0) {
                referenceTop = imgContainer.getBoundingClientRect().top;
                rowsData[`row_${incrementalRow}`] = [];
                rowsData[`row_${incrementalRow}`].push(imgContainer);
            } else {
                if (imgContainer.getBoundingClientRect().top == referenceTop) {
                    rowsData[`row_${incrementalRow}`].push(imgContainer);
                } else {
                    incrementalRow++;
                    rowsData[`row_${incrementalRow}`] = [];
                    rowsData[`row_${incrementalRow}`].push(imgContainer);
                    referenceTop = imgContainer.getBoundingClientRect().top;
                }
            }
        });

        Object.entries(rowsData).forEach(([key, value]) => {
            value.forEach((element, index) => {
                if (index == 0) {
                    $exeDevice.firstItems.push(element);
                    let dataPosition = element.getBoundingClientRect();
                    let areaBeforeElement = {
                        left: dataPosition.left - dataPosition.width,
                        top: dataPosition.top,
                        right: dataPosition.left,
                        bottom: dataPosition.bottom,
                    };
                    $exeDevice.areasBeforeFirstItems.push(areaBeforeElement);
                    if (value.length == 1) {
                        $exeDevice.lastItems.push(element);
                        let dataPosition = element.getBoundingClientRect();
                        let areaAfterElement = {
                            left: dataPosition.right,
                            top: dataPosition.top,
                            right: dropAreaDataPosition.right,
                            bottom: dataPosition.bottom,
                        };
                        $exeDevice.areasAfterLastItems.push(areaAfterElement);
                    }
                } else if (index == value.length - 1) {
                    $exeDevice.lastItems.push(element);
                    let dataPosition = element.getBoundingClientRect();
                    let areaAfterElement = {
                        left: dataPosition.right,
                        top: dataPosition.top,
                        right: dropAreaDataPosition.right,
                        bottom: dataPosition.bottom,
                    };
                    $exeDevice.areasAfterLastItems.push(areaAfterElement);
                }
            });
        });
    },

    /**
     * Handle actions required after drop some file in a drop area child element
     *
     */
    itemsDropAreaHandleDrop: function (e) {
        let dataPosition = e.currentTarget.getBoundingClientRect();
        let middlePosition = dataPosition.left + dataPosition.width / 2;

        let itemDragging = $exeDevice.ideviceBody.querySelector('.dragging');
        if (itemDragging === null) {
            let dt = e.dataTransfer;
            let files = dt.files;

            Array.from(files).forEach((file) => {
                $exeDevice.processFile(file);
            });
            const dropArea = $exeDevice.ideviceBody.querySelector(
                '.imageGalleryIdeviceForm'
            );
            dropArea.classList.remove('highlight');
        } else {
            if (e.pageX < middlePosition) {
                e.currentTarget.before(itemDragging);
            } else {
                e.currentTarget.after(itemDragging);
            }
        }
    },

    getLicenseValue: function (licenseTitle) {
        switch (licenseTitle) {
            case 'Creative Commons (' + _('Public Domain') + ')':
                return 'CC0';
            case 'Creative Commons BY':
                return 'CC-BY';
            case 'Creative Commons BY-SA':
                return 'CC-BY-SA';
            case 'Creative Commons BY-ND':
                return 'CC-BY-ND';
            case 'Creative Commons BY-NC':
                return 'CC-BY-NC';
            case 'Creative Commons BY-NC-SA':
                return 'CC-BY-NC-SA';
            case 'Creative Commons BY-NC-ND':
                return 'CC-BY-NC-ND';
            case 'Copyright (' + _('All Rights Reserved') + ')':
                return _('All Rights Reserved');
            default:
                return licenseTitle;
        }
    },

    getLicenseTitle: function (licenseValue) {
        switch (licenseValue) {
            case 'CC0':
                return 'Creative Commons (' + _('Public Domain') + ')';
            case 'CC-BY':
                return 'Creative Commons BY';
            case 'CC-BY-SA':
                return 'Creative Commons BY-SA';
            case 'CC-BY-ND':
                return 'Creative Commons BY-ND';
            case 'CC-BY-NC':
                return 'Creative Commons BY-NC';
            case 'CC-BY-NC-SA':
                return 'Creative Commons BY-NC-SA';
            case 'CC-BY-NC-ND':
                return 'Creative Commons BY-NC-ND';
            case _('All Rights Reserved'):
                return 'Copyright (' + _('All Rights Reserved') + ')';
            default:
                return licenseValue;
        }
    },
};
