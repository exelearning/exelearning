export default class Toast {
    constructor(manager, id, element) {
        this.manager = manager;
        if (element) this.toastElement = element;
        this.id = id;
        this.defaultIcon = 'info';
        this.defaultTitle = '';
        this.defaultBody = '';
        if (!element) this.toastElement = document.getElementById(this.id);
        this.toastIcon = this.toastElement.querySelector(
            '.toast-header > .toast-icon'
        );
        this.toastTitle = this.toastElement.querySelector(
            '.toast-header > .toast-title'
        );
        this.toastBody = this.toastElement.querySelector('.toast-body');
        this.toast = new bootstrap.Toast(this.toastElement, {});
        this.hidingTime = 2000;
    }

    /**
     *
     * @param {*} data
     */
    show(data) {
        let icon = data.icon ? data.icon : this.defaultIcon;
        let title = data.title ? data.title : this.defaultTitle;
        let body = data.body ? data.body : this.defaultBody;
        // Set elements
        this.toastIcon.innerHTML = icon;
        this.toastTitle.innerHTML = title;
        this.toastBody.innerHTML = body;
        // Add class
        if (data.error) this.toastBody.classList.add('error');
        // Remove hiding class
        this.toastElement.classList.remove('hiding');
        // Show toast
        this.toast.show();
        // Autoremove
        if (data.remove)
            setTimeout(() => {
                this.remove();
            }, data.remove);
    }

    /**
     *
     */
    hide() {
        this.toastElement.classList.add('hiding');
        this.toastBody.classList.remove('error');
        setTimeout(() => {
            if (this.toastElement.classList.contains('hiding'))
                this.toast.hide();
        }, this.hidingTime);
    }

    /**
     *
     */
    remove() {
        this.toastElement.classList.add('hiding');
        setTimeout(() => {
            if (this.toastElement.classList.contains('hiding')) {
                this.toast.hide();
                this.toastElement.remove();
            }
        }, this.hidingTime);
    }
}
