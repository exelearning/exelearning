/**
 * eXeLearning
 *
 * Loading the idevices in the menu
 */

/**
 * MenuIdevicesCompose class
 *
 */
export default class MenuIdevicesCompose {
    constructor(parent, ideviceList) {
        this.parent = parent;
        this.idevicesList = ideviceList;
        this.idevicesInstalled = this.idevicesList.installed;
        this.menuIdevices = document.querySelector(
            '#menu_idevices #list_menu_idevices'
        );
        this.readers = [];
    }

    // English category keys used in config.xml files - these are constant
    // DO NOT translate these - they must match the backend category values
    categoryKeys = {
        information: 'Information and presentation',
        evaluation: 'Assessment and tracking',
        games: 'Games',
        interactive: 'Interactive activities',
        science: 'Science',
        imported: 'Imported',
    };

    // Order of categories to display (using English keys)
    categoriesOrder = ['information', 'evaluation', 'games', 'interactive', 'science'];

    // Get translated title for a category key (called at render time)
    getCategoryTitle(key) {
        return _(this.categoryKeys[key] || key);
    }

    /**
     * Generate the HTML in the idevices menu
     *
     */
    compose() {
        // Clean menu
        this.categoriesExtra = [];
        this.categoriesIdevices = {};
        this.categoryKeyToIcon = {};
        this.menuIdevices.innerHTML = '';

        // Build reverse lookup: English category name -> icon key
        this.englishToKey = {};
        for (let [iconKey, englishName] of Object.entries(this.categoryKeys)) {
            this.englishToKey[englishName] = iconKey;
            this.categoriesIdevices[englishName] = [];
            this.categoryKeyToIcon[englishName] = iconKey;
        }

        this.addIdevicesToCategory();

        // Generate elements - use English category names for lookup
        const orderedEnglishCategories = this.categoriesOrder.map(key => this.categoryKeys[key]);
        const allCategories = orderedEnglishCategories.concat(this.categoriesExtra);

        allCategories.forEach((englishCategory) => {
            if (this.categoriesIdevices[englishCategory]) {
                // Use known icon key, or create a safe CSS class name for unknown categories
                const iconKey = this.categoryKeyToIcon[englishCategory] ||
                    englishCategory.toLowerCase().replace(/[^a-z0-9]/g, '-');
                this.createDivCategoryIdevices(
                    englishCategory,
                    this.categoriesIdevices[englishCategory],
                    iconKey
                );
            }
        });
    }

    /**
     * Add idevices to categories
     * Uses English category names from backend to match with known categories
     *
     * @return dict
     */
    addIdevicesToCategory() {
        for (let [key, idevice] of Object.entries(this.idevicesInstalled)) {
            // idevice.category is in English (from config.xml)
            const category = idevice.category;
            if (!this.categoriesIdevices[category]) {
                this.categoriesIdevices[category] = [];
                this.categoriesExtra.push(category);
            }
            this.categoriesIdevices[category].push(idevice);
        }
    }

    /**
     * Create node parent category
     *
     * @param {string} englishCategory - English category name (e.g., "Information and presentation")
     * @param {*} idevices
     * @param {string} icon - Icon key (e.g., "information")
     */
    createDivCategoryIdevices(englishCategory, idevices, icon) {
        // The Text iDevice should be in the first place for "Information and presentation"
        if (englishCategory === this.categoryKeys.information) {
            // Find the object with id == "text"
            const index = idevices.findIndex((obj) => obj.id === 'text');
            if (index > -1) {
                // Put Text in the first place
                const [item] = idevices.splice(index, 1);
                idevices.unshift(item);
            }
        }
        // Translate the category title for display
        const translatedTitle = _(englishCategory);
        let nodeDivCategory = this.elementDivCategory(translatedTitle);
        nodeDivCategory.append(this.elementLabelCategory(translatedTitle, icon));
        nodeDivCategory.append(this.elementDivIdevicesParent(idevices, icon));
        this.menuIdevices.append(nodeDivCategory);
    }

    /**
     * Create idevices nodes
     *
     * @return {Node}
     */
    elementDivIdevicesParent(ideviceData, icon) {
        let nodeDivIdevices = document.createElement('div');
        nodeDivIdevices.classList.add('idevices', 'type_' + icon);
        const titleElement = document.createElement('div');
        titleElement.classList.add('idevices-category-title');
        const descriptionElement = document.createElement('p');
        descriptionElement.classList.add('idevices-category-description');
        switch (icon) {
            case 'information':
                titleElement.textContent = _('Information and presentation');
                descriptionElement.textContent = _(
                    'Tools to display information, organize resources or enrich content with accessibility and diverse media.'
                );
                break;
            case 'evaluation':
                titleElement.textContent = _('Assessment and tracking');
                descriptionElement.textContent = _(
                    'Quizzes and other tools to check knowledge or progress, with the option to provide feedback.'
                );
                break;
            case 'games':
                titleElement.textContent = _('Games');
                descriptionElement.textContent = _(
                    'Resources that use game mechanics to motivate and reinforce learning without evaluation pressure.'
                );
                break;
            case 'interactive':
                titleElement.textContent = _('Interactive activities');
                descriptionElement.textContent = _(
                    'Exercises that require direct interaction, encouraging active learning and trial-and-error.'
                );
                break;
            case 'science':
                titleElement.textContent = _('Sciencie');
                descriptionElement.textContent = _(
                    'Resources designed to work on specific subject areas or topics.'
                );
                break;
            case 'imported':
                titleElement.textContent = _('Imported');
                descriptionElement.textContent = _(
                    'Select or drag to place the iDevice on the page.'
                );
                break;
            default:
                break;
        }
        nodeDivIdevices.append(titleElement);
        nodeDivIdevices.append(descriptionElement);

        if (icon !== 'imported') {
            ideviceData.forEach((ideviceData) => {
                if (ideviceData.id != 'example') {
                    nodeDivIdevices.append(this.elementDivIdevice(ideviceData));
                }
            });
        }

        if (icon === 'imported') {
            const userIdevicesContent = document.createElement('div');
            userIdevicesContent.classList.add('useridevices-content');
            ideviceData.forEach((ideviceData) => {
                userIdevicesContent.append(
                    this.elementDivIdeviceImported(ideviceData)
                );
            });
            nodeDivIdevices.append(userIdevicesContent);
            nodeDivIdevices.append(this.createImportDeviceBox());
        }
        return nodeDivIdevices;
    }

    createImportDeviceBox() {
        const emptyBox = document.createElement('button');
        emptyBox.classList.add('idevice-import-upload', 'btn');

        const iconContainer = document.createElement('div');
        iconContainer.classList.add('upload-box-icon');

        const icon = document.createElement('span');
        icon.classList.add('medium-icon', 'upload-cloud-icon-green');
        iconContainer.appendChild(icon);

        const textContainer = document.createElement('div');
        textContainer.classList.add('upload-box-text');

        const pStrong = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = _('Click to upload the file');
        pStrong.appendChild(strong);

        textContainer.appendChild(pStrong);

        emptyBox.appendChild(iconContainer);
        emptyBox.appendChild(textContainer);

        const inputFile = this.makeElementInputFileImportIdevice();
        emptyBox.appendChild(inputFile);

        emptyBox.addEventListener('click', () =>
            document.getElementById('idevice-file-import').click()
        );

        emptyBox.addEventListener('dragover', (e) => {
            e.preventDefault();
            emptyBox.classList.add('dragover');
        });

        emptyBox.addEventListener('dragleave', () => {
            emptyBox.classList.remove('dragover');
        });

        emptyBox.addEventListener('drop', (e) => {
            e.preventDefault();
            emptyBox.classList.remove('dragover');
            const files = e.dataTransfer.files;
            Array.from(files).forEach((file) => this.addNewReader(file));
        });

        return emptyBox;
    }

    makeElementInputFileImportIdevice() {
        let inputFile = document.createElement('input');
        inputFile.setAttribute('type', 'file');
        inputFile.setAttribute('accept', '.zip');
        inputFile.id = 'idevice-file-import';
        inputFile.classList.add('hidden', 'idevice-file-import');
        let label = document.createElement('label');
        label.setAttribute('for', inputFile.id);
        label.classList.add('visually-hidden');
        label.textContent = _('Import iDevice in ZIP format');
        inputFile.addEventListener('change', (event) => {
            Array.from(inputFile.files).forEach((idevice) => {
                this.addNewReader(idevice);
            });
            inputFile.value = null;
        });
        let wrapper = document.createElement('div');
        wrapper.append(label);
        wrapper.append(inputFile);

        return wrapper;
    }

    addNewReader(file) {
        let reader = new FileReader();
        this.readers.push(reader);
        reader.onload = (event) => {
            this.uploadIdevice(file.name, event.target.result);
        };
        reader.readAsDataURL(file);
    }

    uploadIdevice(fileName, fileData) {
        let params = {};
        params.filename = fileName;
        params.file = fileData;
        eXeLearning.app.api.postUploadIdevice(params).then((response) => {
            if (response && response.responseMessage === 'OK') {
                response.idevice.id = response.idevice.name;
                this.idevicesList.loadIdevice(response.idevice);
                this.categoriesIdevices[_('Imported')].push(response.idevice);
                this.rebuildImportedIdevices();
            } else {
                // Show alert
                this.showElementAlert(
                    _('Failed to install the new iDevice'),
                    response
                );
            }
        });
    }

    removeIdevice(id) {
        let params = {};
        params.id = id;
        eXeLearning.app.api.deleteIdeviceInstalled(params).then((response) => {
            if (
                response &&
                response.responseMessage === 'OK' &&
                response.deleted &&
                response.deleted.name
            ) {
                this.idevicesList.removeIdevice(params.id);
                document.getElementById(params.id).remove();
                const idx = this.categoriesIdevices[_('Imported')].findIndex(
                    (obj) => obj.id === params.id
                );
                if (idx !== -1) {
                    this.categoriesIdevices[_('Imported')].splice(idx, 1);
                }
                this.rebuildImportedIdevices();
            } else {
                setTimeout(() => {
                    this.showElementAlert(
                        _('Could not remove the iDevice'),
                        response
                    );
                });
            }
        });
    }

    downloadIdeviceZip(idevice) {
        eXeLearning.app.api
            .getIdeviceInstalledZip(
                eXeLearning.app.project.odeSession,
                idevice.dirName
            )
            .then((response) => {
                if (response && response.zipFileName && response.zipBase64) {
                    let link = document.createElement('a');
                    link.setAttribute('type', 'hidden');
                    link.href = 'data:text/plain;base64,' + response.zipBase64;
                    link.download = response.zipFileName;
                    link.click();
                    link.remove();
                }
            });
    }

    rebuildImportedIdevices() {
        this.importedIdevicesContent = document.querySelector(
            '.idevices.type_imported .useridevices-content'
        );
        this.importedIdevicesContent.innerHTML = '';
        this.categoriesIdevices[_('Imported')].forEach((ideviceData) => {
            this.importedIdevicesContent.append(
                this.elementDivIdeviceImported(ideviceData)
            );
        });
        eXeLearning.app.project.idevices.behaviour();
    }

    showElementAlert(txt, response) {
        let defErrorText = txt;
        let resErrorText = response && response.error ? response.error : '';
        let errorText = resErrorText
            ? `<p>${defErrorText}:</p><p>&nbsp;${resErrorText}</p>`
            : `<p>${defErrorText}</p>`;
        eXe.app.alert(errorText);
    }

    /**
     * Create element div category
     *
     * @return {Node}
     */
    elementDivCategory(categoryTitle) {
        let nodeDivCategory = document.createElement('div');
        nodeDivCategory.classList.add('idevice_category');
        nodeDivCategory.classList.add('off');

        return nodeDivCategory;
    }

    /**
     * Create element label category
     *
     * @param {*} categoryTitle
     *
     * @return {Node}
     */
    elementLabelCategory(categoryTitle, icon) {
        let categoryLabel = document.createElement('div');
        categoryLabel.classList.add('label');
        // Icon
        let iconContent = document.createElement('div');
        iconContent.classList.add('icon-content');
        switch (icon) {
            case 'information':
                iconContent.innerHTML = `<svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M7.65088 15.093H12.1509" stroke="#0BA0A0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M3.90088 5.34302V3.09302H15.9009V5.34302" stroke="#0BA0A0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M9.90088 3.09302V15.093" stroke="#0BA0A0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
                break;
            case 'evaluation':
                iconContent.innerHTML = `<svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M9.90088 15.093H16.6509" stroke="#0BA0A0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M13.2759 2.718C13.5742 2.41964 13.9789 2.25201 14.4009 2.25201C14.6098 2.25201 14.8167 2.29317 15.0097 2.37312C15.2028 2.45308 15.3781 2.57027 15.5259 2.718C15.6736 2.86574 15.7908 3.04113 15.8708 3.23416C15.9507 3.42719 15.9919 3.63407 15.9919 3.843C15.9919 4.05194 15.9507 4.25882 15.8708 4.45185C15.7908 4.64488 15.6736 4.82027 15.5259 4.968L6.15088 14.343L3.15088 15.093L3.90088 12.093L13.2759 2.718Z" stroke="#0BA0A0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
                break;
            case 'games':
                iconContent.innerHTML = `<svg width="21" height="14" viewBox="0 0 21 14" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M6.69389 1.73877C5.07021 1.34554 3.45263 2.27094 3.08093 3.80571C3.08093 3.80571 2.69951 5.69429 2.31367 6.9738C1.92782 8.25331 1.1049 10.3585 1.1049 10.3585C0.826125 11.5096 1.58732 12.6818 2.80509 12.9767C4.49571 13.3861 7.11904 11.3417 8.1315 9.83111C8.25653 9.64456 8.42544 9.48764 8.6426 9.43041C8.95616 9.34779 9.4841 9.24706 10.1875 9.25002C10.8722 9.25291 11.4802 9.35589 11.8556 9.43735C12.1106 9.49268 12.3168 9.66484 12.4627 9.88115C13.4445 11.337 15.8186 13.3692 17.4393 12.9767C18.657 12.6818 19.4182 11.5096 19.1395 10.3585C19.1395 10.3585 18.3165 8.25331 17.9307 6.9738C17.5449 5.69429 17.1634 3.80571 17.1634 3.80571C16.7917 2.27094 15.1742 1.34554 13.5505 1.73877C13.5505 1.73877 11.5471 2.10422 10.1875 2.12502C8.75562 2.14694 6.69389 1.73877 6.69389 1.73877Z" stroke="#0BA0A0" stroke-width="1.7"/>
<rect x="13.2891" y="6.5813" width="1.1875" height="1.1875" rx="0.59375" fill="#0BA0A0"/>
<rect x="13.2891" y="4.2063" width="1.1875" height="1.1875" rx="0.59375" fill="#0BA0A0"/>
<path d="M6.16602 4.79159C6.16602 4.46834 6.42806 4.2063 6.7513 4.2063C7.07455 4.2063 7.33659 4.46834 7.33659 4.79159V7.13273C7.33659 7.45598 7.07455 7.71802 6.7513 7.71802C6.42806 7.71802 6.16602 7.45598 6.16602 7.13273V4.79159Z" fill="#0BA0A0"/>
<path d="M7.92204 5.37689C8.24528 5.37689 8.50732 5.63893 8.50732 5.96218C8.50732 6.28542 8.24528 6.54747 7.92204 6.54747L5.58089 6.54746C5.25765 6.54746 4.99561 6.28542 4.99561 5.96218C4.99561 5.63893 5.25765 5.37689 5.58089 5.37689L7.92204 5.37689Z" fill="#0BA0A0"/>
<rect x="13.2891" y="5.3938" width="1.1875" height="1.1875" rx="0.59375" transform="rotate(90 13.2891 5.3938)" fill="#0BA0A0"/>
<rect x="15.6641" y="5.3938" width="1.1875" height="1.1875" rx="0.59375" transform="rotate(90 15.6641 5.3938)" fill="#0BA0A0"/>
</svg>`;
                break;
            case 'interactive':
                iconContent.innerHTML = `<svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M14.3679 9.84898L15.6531 10.7985M15.1023 6.90397L16.5795 6.68212M13.5353 4.30458L14.3592 3.18942M6.87914 4.31586L7.99087 5.13726M10.3684 2.09302L10.5902 3.57019M3.22217 11.0573L11.6026 6.92036L10.1098 16.1463L7.72384 12.17L3.22217 11.0573Z" stroke="#0BA0A0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
                break;
            case 'science':
                iconContent.innerHTML = `<svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
<g>
<path d="M15.9539 13.6504L11.712 6.37853V2.45205H12.5421C12.7623 2.45205 12.9734 2.36459 13.1291 2.20892C13.2848 2.05324 13.3722 1.84209 13.3722 1.62193C13.3722 1.40177 13.2848 1.19062 13.1291 1.03495C12.9734 0.879268 12.7623 0.791809 12.5421 0.791809H5.90114C5.68098 0.791809 5.46983 0.879268 5.31416 1.03495C5.15848 1.19062 5.07102 1.40177 5.07102 1.62193C5.07102 1.84209 5.15848 2.05324 5.31416 2.20892C5.46983 2.36459 5.68098 2.45205 5.90114 2.45205H6.73126V6.37853L2.48934 13.6504C2.26898 14.0287 2.15224 14.4584 2.15089 14.8962C2.14954 15.334 2.26363 15.7644 2.48166 16.1441C2.69969 16.5237 3.01394 16.8392 3.39276 17.0587C3.77157 17.2782 4.20155 17.3939 4.63936 17.3942H13.7707C14.2085 17.3939 14.6385 17.2782 15.0173 17.0587C15.3961 16.8392 15.7104 16.5237 15.9284 16.1441C16.1464 15.7644 16.2605 15.334 16.2592 14.8962C16.2578 14.4584 16.1411 14.0287 15.9207 13.6504H15.9539ZM8.27529 7.00942C8.34851 6.88615 8.38855 6.74601 8.39151 6.60266V2.45205H10.0518V6.60266C10.0533 6.74884 10.0934 6.89202 10.168 7.01772L10.8819 8.26291H7.56138L8.27529 7.00942ZM14.5178 15.3106C14.4454 15.4361 14.3414 15.5404 14.2161 15.6132C14.0909 15.6861 13.9488 15.7248 13.8039 15.7257H4.67256C4.52769 15.7248 4.38558 15.6861 4.26033 15.6132C4.13509 15.5404 4.03109 15.4361 3.95866 15.3106C3.8858 15.1844 3.84744 15.0413 3.84744 14.8956C3.84744 14.7499 3.8858 14.6067 3.95866 14.4805L6.59014 9.92315H11.8614L14.5178 14.4888C14.5907 14.615 14.629 14.7582 14.629 14.9039C14.629 15.0496 14.5907 15.1927 14.5178 15.3189V15.3106ZM7.56138 11.5834C7.3972 11.5834 7.23671 11.6321 7.10019 11.7233C6.96368 11.8145 6.85728 11.9442 6.79445 12.0958C6.73162 12.2475 6.71518 12.4144 6.74721 12.5755C6.77924 12.7365 6.85831 12.8844 6.9744 13.0005C7.09049 13.1166 7.23841 13.1957 7.39944 13.2277C7.56046 13.2597 7.72737 13.2433 7.87906 13.1804C8.03074 13.1176 8.16039 13.0112 8.25161 12.8747C8.34282 12.7382 8.39151 12.5777 8.39151 12.4135C8.39151 12.1934 8.30405 11.9822 8.14837 11.8265C7.99269 11.6709 7.78155 11.5834 7.56138 11.5834ZM10.8819 12.4135C10.7177 12.4135 10.5572 12.4622 10.4207 12.5534C10.2842 12.6446 10.1778 12.7743 10.1149 12.926C10.0521 13.0777 10.0357 13.2446 10.0677 13.4056C10.0997 13.5666 10.1788 13.7145 10.2949 13.8306C10.411 13.9467 10.5589 14.0258 10.7199 14.0578C10.881 14.0898 11.0479 14.0734 11.1995 14.0106C11.3512 13.9477 11.4809 13.8413 11.5721 13.7048C11.6633 13.5683 11.712 13.4078 11.712 13.2436C11.712 13.0235 11.6245 12.8123 11.4689 12.6567C11.3132 12.501 11.102 12.4135 10.8819 12.4135Z" fill="#0BA0A0"/>
</g>
<defs>
<rect width="18" height="18" fill="white" transform="translate(0.900879 0.0930176)"/>
</defs>
</svg>
`;
                break;
            case 'imported':
                iconContent.innerHTML = `<svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M13.6509 6.09302L9.90088 2.34302L6.15088 6.09302" stroke="#0BA0A0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M9.90088 2.34302L9.90088 11.343" stroke="#0BA0A0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M16.6509 11.343L16.6509 14.343C16.6509 14.7408 16.4928 15.1224 16.2115 15.4037C15.9302 15.685 15.5487 15.843 15.1509 15.843L4.65088 15.843C4.25305 15.843 3.87152 15.685 3.59022 15.4037C3.30891 15.1224 3.15088 14.7408 3.15088 14.343L3.15088 11.343" stroke="#0BA0A0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
                break;
            default:
                iconContent.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 21 21" fill="none">
  <rect width="20.4598" height="20.4598" transform="translate(0.540039)"/>
  <path d="M10.77 5.75391V10.2295M10.77 10.2295V14.7051M10.77 10.2295H6.29443M10.77 10.2295H15.2456" stroke="#0BA1A1" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;
                break;
        }
        // tittle
        let categorySpanTitle = document.createElement('h3');
        categorySpanTitle.classList.add('idevice_category_name');
        categorySpanTitle.innerHTML = categoryTitle;
        // add to label parent
        categoryLabel.append(iconContent);
        categoryLabel.append(categorySpanTitle);

        return categoryLabel;
    }

    /**
     * Create element idevice
     *
     * @param {*} ideviceData
     *
     * @return {Node}
     */
    elementDivIdevice(ideviceData) {
        let ideviceDiv = document.createElement('div');
        ideviceDiv.id = ideviceData.id;
        ideviceDiv.classList.add('idevice_item');
        ideviceDiv.classList.add('draggable');
        ideviceDiv.setAttribute('draggable', 'true');
        ideviceDiv.setAttribute('drag', 'idevice');
        ideviceDiv.setAttribute('icon-type', ideviceData.icon.type);
        ideviceDiv.setAttribute('icon-name', ideviceData.icon.name);
        // Testing: left menu id for this iDevice
        ideviceDiv.setAttribute('data-testid', `idevice-${ideviceData.id}`);
        ideviceDiv.append(this.elementDivIcon(ideviceData));
        ideviceDiv.append(this.elementDivTitle(ideviceData.title));

        return ideviceDiv;
    }

    elementDivIdeviceImported(ideviceData) {
        let ideviceDiv = document.createElement('div');
        ideviceDiv.id = ideviceData.id;
        ideviceDiv.classList.add('idevice_item', 'draggable');
        ideviceDiv.setAttribute('draggable', 'true');
        ideviceDiv.setAttribute('drag', 'idevice');
        ideviceDiv.setAttribute('title', ideviceData.title);
        ideviceDiv.setAttribute('icon-type', ideviceData.icon.type);
        ideviceDiv.setAttribute('icon-name', ideviceData.icon.name);
        // Testing: left menu id for this imported iDevice
        ideviceDiv.setAttribute('data-testid', `idevice-${ideviceData.id}`);

        ideviceDiv.append(this.elementDivIcon(ideviceData));
        ideviceDiv.append(this.elementDivTitle(ideviceData.title));

        const dropdownWrapper = document.createElement('div');
        dropdownWrapper.classList.add('dropdown');

        const btnAction = document.createElement('button');
        btnAction.classList.add(
            'btn',
            'button-tertiary',
            'btn-action-menu',
            'button-narrow',
            'd-flex',
            'justify-content-center',
            'align-items-center',
            'ideviceMenu',
            'exe-app-tooltip'
        );
        btnAction.setAttribute('type', 'button');
        btnAction.setAttribute('data-bs-toggle', 'dropdown');
        btnAction.setAttribute('aria-expanded', 'false');
        btnAction.innerHTML =
            '<span class="small-icon dots-menu-vertical-icon ideviceMenu"></span>';

        const dropdownMenu = document.createElement('ul');
        dropdownMenu.classList.add(
            'dropdown-menu',
            'ideviceMenu',
            'dropdown-menu-with-cols'
        );

        const liExport = document.createElement('li');
        const btnExport = document.createElement('button');
        btnExport.classList.add('dropdown-item', 'userIdeviceExport');
        btnExport.innerHTML =
            '<span class="small-icon download-icon-green"></span> ' +
            _('Export');
        liExport.appendChild(btnExport);
        btnExport.addEventListener('click', (e) => {
            e.preventDefault();
            this.downloadIdeviceZip(ideviceData);
        });

        const liDelete = document.createElement('li');
        const btnDelete = document.createElement('button');
        btnDelete.classList.add('dropdown-item', 'userIdeviceDelete');
        btnDelete.innerHTML =
            '<span class="small-icon delete-icon-red"></span> ' + _('Delete');
        liDelete.appendChild(btnDelete);
        btnDelete.addEventListener('click', (event) => {
            event.preventDefault();
            eXeLearning.app.modals.confirm.show({
                title: _('Delete iDevice'),
                body: _('Delete this iDevice: %s?').replace(
                    '%s',
                    ideviceDiv.id
                ),
                confirmButtonText: _('Delete'),
                cancelButtonText: _('Cancel'),
                confirmExec: () => {
                    this.removeIdevice(ideviceDiv.id);
                },
            });
        });

        dropdownMenu.append(liExport, liDelete);
        dropdownWrapper.append(btnAction, dropdownMenu);
        ideviceDiv.append(dropdownWrapper);

        return ideviceDiv;
    }

    /**
     *
     * @param {Array} ideviceData
     * @returns {Node}
     */
    elementDivIcon(ideviceData) {
        let ideviceIcon = document.createElement('div');
        ideviceIcon.classList.add('idevice_icon');
        if (ideviceData.icon.type === 'exe-icon') {
            ideviceIcon.innerHTML = ideviceData.icon.name;
        } else if (ideviceData.icon.type === 'img') {
            ideviceIcon.classList.add('idevice-img-icon');
            ideviceIcon.style.backgroundImage = `url(${ideviceData.path}/${ideviceData.icon.url})`;
            ideviceIcon.style.backgroundRepeat = 'no-repeat';
            ideviceIcon.style.backgroundPosition = 'center';
            ideviceIcon.style.backgroundSize = 'cover';
        }
        return ideviceIcon;
    }

    /**
     *
     * @param {String} title
     * @returns {Node}
     */
    elementDivTitle(title) {
        let ideviceTitle = document.createElement('div');
        ideviceTitle.classList.add('idevice_title');
        ideviceTitle.innerHTML = title;
        return ideviceTitle;
    }
}
