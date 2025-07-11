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
    }

    categoriesTitle = {
        text: _('Text'),
        interactive: _('Interactive activities'),
        games: _('Games'),
        others: _('Others'),
    };

    categoriesFirst = [
        this.categoriesTitle.text,
        this.categoriesTitle.interactive,
        this.categoriesTitle.games,
    ];
    categoriesLast = [this.categoriesTitle.others];

    /**
     * Generate the HTML in the idevices menu
     *
     */
    compose() {
        // Clean menu
        this.categoriesExtra = [];
        this.categoriesIdevices = {};
        this.menuIdevices.innerHTML = '';
        // Set categories
        for (let [key, title] of Object.entries(this.categoriesTitle)) {
            this.categoriesIdevices[title] = [];
        }
        this.addIdevicesToCategory();
        // Generate elements
        this.orderedCategories = this.categoriesFirst.concat(
            this.categoriesExtra,
            this.categoriesLast
        );
        this.orderedCategories.forEach((category) => {
            if (
                this.categoriesIdevices[category] &&
                this.categoriesIdevices[category].length > 0
            ) {
                this.createDivCategoryIdevices(
                    category,
                    this.categoriesIdevices[category]
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
            if (idevice.visible) {
                if (!this.categoriesIdevices[idevice.category]) {
                    this.categoriesIdevices[idevice.category] = [];
                    this.categoriesExtra.push(idevice.category);
                }
                this.categoriesIdevices[idevice.category].push(idevice);
            }
        }
    }

    /**
     * Create node parent category
     *
     * @param {*} categoryTitle
     * @param {*} idevices
     */
    createDivCategoryIdevices(categoryTitle, idevices) {
        let nodeDivCategory = this.elementDivCategory(categoryTitle);
        // Add title
        nodeDivCategory.append(this.elementLabelCategory(categoryTitle));
        // Add idevices
        nodeDivCategory.append(this.elementDivIdevicesParent(idevices));
        // Add Div to iDevices Menu
        this.menuIdevices.append(nodeDivCategory);
    }

    /**
     * Create idevices nodes
     *
     * @return {Node}
     */
    elementDivIdevicesParent(ideviceData) {
        var nodeDivIdevices = document.createElement('div');
        nodeDivIdevices.classList.add('idevices');
        // Add idevices
        ideviceData.forEach((ideviceData) => {
            nodeDivIdevices.append(this.elementDivIdevice(ideviceData));
        });

        return nodeDivIdevices;
    }

    /**
     * Create element div category
     *
     * @return {Node}
     */
    elementDivCategory(categoryTitle) {
        let nodeDivCategory = document.createElement('div');
        nodeDivCategory.classList.add('idevice_category');
        if (categoryTitle && categoryTitle != _('Text'))
            nodeDivCategory.classList.add('off');
        else {
            nodeDivCategory.classList.add('on');
            nodeDivCategory.classList.add('last-open');
        }

        return nodeDivCategory;
    }

    /**
     * Create element label category
     *
     * @param {*} categoryTitle
     *
     * @return {Node}
     */
    elementLabelCategory(categoryTitle) {
        let categoryLabel = document.createElement('div');
        categoryLabel.classList.add('label');
        // tittle
        let categorySpanTitle = document.createElement('h3');
        categorySpanTitle.classList.add('idevice_category_name');
        categorySpanTitle.innerHTML = categoryTitle;
        // add to label parent
        categoryLabel.append(categorySpanTitle);

        return categoryLabel;
    }

    /**
     * Create element idevice
     *
     * @param {*} idevice
     *
     * @return {Node}
     */
    elementDivIdevice(ideviceData) {
        // iDevice container
        let ideviceDiv = document.createElement('div');
        // -- Id
        ideviceDiv.id = ideviceData.id;
        // -- Classes
        ideviceDiv.classList.add('idevice_item');
        ideviceDiv.classList.add('draggable');
        // -- Attributes
        ideviceDiv.setAttribute('draggable', 'true');
        ideviceDiv.setAttribute('drag', 'idevice');
        ideviceDiv.setAttribute('title', ideviceData.title);
        ideviceDiv.setAttribute('icon-type', ideviceData.icon.type);
        ideviceDiv.setAttribute('icon-name', ideviceData.icon.name);
        // iDevice icon
        ideviceDiv.append(this.elementDivIcon(ideviceData));
        // iDevice Title
        ideviceDiv.append(this.elementDivTitle(ideviceData.title));

        return ideviceDiv;
    }

    /**
     *
     * @param {Array} data
     * @returns {Node}
     */
    elementDivIcon(ideviceData) {
        let ideviceIcon = document.createElement('div');
        ideviceIcon.classList.add('idevice_icon');
        // eXe app icon
        if (ideviceData.icon.type == 'exe-icon') {
            ideviceIcon.innerHTML = ideviceData.icon.name;
        }
        // Idevice icon
        else if (ideviceData.icon.type == 'img') {
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
