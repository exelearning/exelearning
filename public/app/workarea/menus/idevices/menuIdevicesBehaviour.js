export default class MenuIdevicesBehaviour {
    constructor(parent) {
        this.parent = parent;
    }

    /**
     *
     */
    behaviour() {
        this.addEventClickIdeviceCategory();
        this.changeAttributePosBehaviour();
    }

    /**
     *
     */
    addEventClickIdeviceCategory() {
        this.parent.categoriesIdevicesLabels.forEach((label) => {
            label.addEventListener('click', (event) => {
                let category = label.parentNode;
                // thick menu behaviour
                if (this.parent.menuIdevices.getAttribute('size') == 'thick') {
                    this.parent.categoriesIdevices.forEach((element) => {
                        element.classList.remove('on');
                        element.classList.add('off');
                    });
                }
                // off -> on
                if (category.classList.contains('off')) {
                    this.parent.categoriesIdevices.forEach((element) => {
                        element.classList.remove('last-open');
                    });
                    category.classList.remove('off');
                    category.classList.add('on');
                    category.classList.add('last-open');
                    // on -> off
                } else {
                    category.classList.remove('on');
                    category.classList.remove('last-open');
                    category.classList.add('off');
                }
            });
        });
    }

    /**
     *
     */
    changeAttributePosBehaviour() {
        var parent = this;
        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                if (
                    mutation.type === 'attributes' &&
                    mutation.attributeName == 'size'
                ) {
                    parent.parent.categoriesIdevices.forEach((category) => {
                        category.classList.remove('on');
                        category.classList.add('off');
                    });
                    let lastOpen = parent.parent.menuIdevices.querySelector(
                        '.idevice_category.last-open'
                    );
                    if (lastOpen) {
                        lastOpen.classList.remove('off');
                        lastOpen.classList.add('on');
                    }
                }
            });
        });
        observer.observe(this.parent.menuIdevices, { attributes: true });
    }
}
