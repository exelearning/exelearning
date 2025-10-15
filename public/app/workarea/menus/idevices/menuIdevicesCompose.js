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
    categoriesTitle = {
        information: _('Information and presentation'),
        evaluation: _('Assessment and tracking'),
        games: _('Games'),
        interactive: _('Interactive activities'),
        science: _('Science'),
        imported: _('Imported'),
    };

    categoriesFirst = [
        this.categoriesTitle.information,
        this.categoriesTitle.evaluation,
        this.categoriesTitle.games,
        this.categoriesTitle.interactive,
        this.categoriesTitle.science,
        // this.categoriesTitle.imported, // To do (see #381)
    ];

    /**
     * Generate the HTML in the idevices menu
     *
     */
    compose() {
        // Clean menu
        this.categoriesExtra = [];
        this.categoriesIdevices = {};
        this.categoriesIcons = [];
        this.menuIdevices.innerHTML = '';
        // Set categories
        for (let [key, title] of Object.entries(this.categoriesTitle)) {
            this.categoriesIdevices[title] = [];
            this.categoriesIcons[title] = key;
        }
        this.addIdevicesToCategory();

        // Generate elements
        this.orderedCategories = this.categoriesFirst.concat(
            this.categoriesExtra
        );
        this.orderedCategories.forEach((category) => {
            if (
                this.categoriesIdevices[category]
                //&& this.categoriesIdevices[category].length > 0
            ) {
                this.createDivCategoryIdevices(
                    category,
                    this.categoriesIdevices[category],
                    this.categoriesIcons[category]
                );
            }
        });
    }

    /**
     * Add idevices to categories
     *
     * @return dict
     */
    addIdevicesToCategory() {
        for (let [key, idevice] of Object.entries(this.idevicesInstalled)) {
            // TODO commented only for develop -> if (idevice.visible) {
            if (!this.categoriesIdevices[idevice.category]) {
                this.categoriesIdevices[idevice.category] = [];
                this.categoriesExtra.push(idevice.category);
            }
            this.categoriesIdevices[idevice.category].push(idevice);
            // }
        }
    }

    /**
     * Create node parent category
     *
     * @param {*} categoryTitle
     * @param {*} idevices
     */
    createDivCategoryIdevices(categoryTitle, idevices, icon) {
        let nodeDivCategory = this.elementDivCategory(categoryTitle);
        nodeDivCategory.append(this.elementLabelCategory(categoryTitle, icon));
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
                iconContent.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M14.4477 4.66123L14.4487 4.66025C13.759 4.63905 12.9955 4.7238 12.1811 4.88682H12.1792C10.6868 5.19656 9.17113 5.11934 7.81003 4.88486C7.01145 4.72165 6.23477 4.65928 5.56003 4.65928H5.55417C3.88031 4.69176 2.76724 5.57055 2.02487 6.72764C1.29089 7.87166 0.906897 9.30235 0.665495 10.5001C0.394799 11.8143 0.210039 12.9924 0.199675 14.0021C0.189364 15.0103 0.352631 15.8857 0.811003 16.5675L0.812956 16.5704C1.265 17.2255 1.94062 17.6227 2.78659 17.7745L2.78757 17.7755C5.00473 18.1669 7.0015 16.453 8.37155 13.419H11.6255C12.8549 16.1791 14.5951 17.8194 16.5796 17.8194C16.7777 17.8194 16.9935 17.7968 17.1723 17.7774L17.1821 17.7765L17.1909 17.7755C18.0556 17.6243 18.7356 17.2258 19.1694 16.5636C19.6363 15.8822 19.805 15.0083 19.7973 14.0021C19.7915 13.2443 19.6857 12.3921 19.519 11.4591L19.3335 10.5001C19.092 9.31223 18.7087 7.88686 17.9751 6.74326C17.2331 5.58683 16.1207 4.70432 14.4477 4.66123ZM12.8852 12.4913C12.6539 12.123 12.2573 11.9005 11.8198 11.9005H8.17917C7.67934 11.9007 7.23256 12.1922 7.02585 12.6583L7.02389 12.6622C6.75814 13.2825 6.26306 14.2944 5.57077 15.0968C4.87363 15.9048 4.0348 16.4358 3.07175 16.2638C2.58894 16.1737 2.29212 15.9861 2.10983 15.713L2.10788 15.711C1.82646 15.2967 1.72611 14.6178 1.76803 13.7315C1.80934 12.8589 1.98455 11.8482 2.19382 10.8204C2.53029 9.18676 2.97394 8.04391 3.53561 7.30967C4.05039 6.63686 4.6679 6.30074 5.43112 6.24619L5.58639 6.23936H5.71921C6.25807 6.23936 6.85741 6.29712 7.49753 6.43272H7.49948C9.1175 6.76081 10.8375 6.76041 12.4555 6.43272L12.4565 6.43369C13.1568 6.29775 13.8156 6.23965 14.3745 6.23936C15.2187 6.25778 15.8893 6.59614 16.438 7.31553C16.9996 8.05193 17.4378 9.1947 17.7641 10.8185L17.7661 10.8253C17.996 11.8517 18.1817 12.862 18.228 13.7335C18.275 14.6184 18.1736 15.2971 17.8921 15.711L17.8901 15.714C17.7081 15.9871 17.4116 16.1736 16.9292 16.2638L16.7495 16.2862C15.86 16.3592 15.0825 15.8431 14.4292 15.088C13.7367 14.2877 13.2415 13.2805 12.976 12.6612L12.9741 12.6583L12.8852 12.4913Z" fill="#0BA0A0"/>
<path d="M7.46001 9.13982H6.49985V8.17966C6.49985 8.05935 6.39985 7.93982 6.26001 7.93982H5.53969C5.41938 7.93982 5.29985 8.03982 5.29985 8.17966V9.13982H4.33969C4.21938 9.13982 4.09985 9.23982 4.09985 9.37966V10.1C4.09985 10.2203 4.19985 10.3398 4.33969 10.3398H5.29985V11.3C5.29985 11.4203 5.39985 11.5398 5.53969 11.5398H6.26001C6.38033 11.5398 6.49985 11.4398 6.49985 11.3V10.3398H7.46001C7.58033 10.3398 7.69985 10.2398 7.69985 10.1V9.37966C7.69985 9.26013 7.59985 9.13982 7.46001 9.13982Z" fill="#0BA0A0"/>
<path d="M13.9999 7.80005C13.6398 7.80005 13.3601 8.07973 13.3601 8.43989C13.3601 8.80005 13.6398 9.07973 13.9999 9.07973C14.3601 9.07973 14.6398 8.80005 14.6398 8.43989C14.6398 8.10005 14.3601 7.80005 13.9999 7.80005Z" fill="#0BA0A0"/>
<path d="M15.2795 9.10004C14.9193 9.10004 14.6396 9.37972 14.6396 9.73988C14.6396 10.1 14.9193 10.3797 15.2795 10.3797C15.6396 10.3797 15.9193 10.1 15.9193 9.73988C15.9201 9.37972 15.6396 9.10004 15.2795 9.10004Z" fill="#0BA0A0"/>
<path d="M12.6999 9.10004C12.3397 9.10004 12.0601 9.37972 12.0601 9.73988C12.0601 10.1 12.3397 10.3797 12.6999 10.3797C13.0601 10.3797 13.3397 10.1 13.3397 9.73988C13.3397 9.40004 13.0601 9.10004 12.6999 9.10004Z" fill="#0BA0A0"/>
<path d="M13.9794 10.4C13.6193 10.4 13.3396 10.6797 13.3396 11.0399C13.3396 11.4 13.6193 11.6797 13.9794 11.6797C14.3396 11.6797 14.6193 11.4 14.6193 11.0399C14.6201 10.6797 14.3396 10.4 13.9794 10.4Z" fill="#0BA0A0"/>
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
