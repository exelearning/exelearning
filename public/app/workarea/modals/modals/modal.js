export default class Modal {
    constructor(manager, id, titleDefault, clearAfterClose) {
        this.manager = manager;
        this.id = id;
        this.titleDefault = titleDefault;
        this.clearAfterClose = clearAfterClose;
        this.confirmExec = undefined;
        this.cancelExec = undefined;
        this.closeExec = undefined;
        this.modalElement = document.getElementById(this.id);
        this.modalElementHeader =
            this.modalElement.querySelector('.modal-header');
        this.modalElementTitle =
            this.modalElement.querySelector('.modal-title');
        this.modalElementBody = this.modalElement.querySelector('.modal-body');
        this.modalElementButtonsConfirm =
            this.modalElement.querySelectorAll('.confirm');
        this.modalElementButtonsClose =
            this.modalElement.querySelectorAll('.close');
        this.modalElementButtonsCancel =
            this.modalElement.querySelectorAll('.cancel');
        this.exeTabs = this.modalElement.querySelectorAll(
            '.exe-form-tabs li a'
        );
        this.exeContents =
            this.modalElement.querySelectorAll('.exe-form-content');
        this.exeHelp = this.modalElement.querySelectorAll('.exe-form-help');
        this.cancelButton = this.modalElement.querySelector(
            'button.close.btn.btn-secondary'
        );
        this.preventCloseModal = false;
        this.tabSelectedLink = null;
        this.modal = new bootstrap.Modal(this.modalElement, {});
        this.timeMax = 500;
        this.timeMin = 50;

        // Initialize testing state attribute
        this.modalElement.setAttribute('data-open', 'false');
        // Sync data-open with Bootstrap modal events
        this.modalElement.addEventListener('shown.bs.modal', () => {
            this.modalElement.setAttribute('data-open', 'true');
        });
        this.modalElement.addEventListener('hidden.bs.modal', () => {
            this.modalElement.setAttribute('data-open', 'false');
        });
    }

    /**
     *
     */
    behaviour() {
        // Move
        this.interactModal();
        // Close
        this.addBehaviourCloseModal();
        // Cancel
        this.addBehaviourCancelModal();
        // Confirm
        this.addBehaviourButtonConfirm();
        // eXe tabs
        this.addBehaviourExeTabs();
        // eXe help
        this.addBehaviourExeHelp();
        this.addBehaviourBodyToHideHelpDialogs();
    }

    /**
     *
     */
    addBehaviourCloseModal() {
        // Button close
        this.modalElementButtonsClose.forEach((button) => {
            button.addEventListener('click', (e) => {
                this.close();
                // if (this.cancelExec) {
                //   this.cancelExec.call();
                // }
            });
        });
    }

    /**
     *
     */
    addBehaviourCancelModal() {
        this.modalElementButtonsCancel.forEach((button) => {
            button.addEventListener('click', (e) => {
                this.cancel();
            });
        });
    }

    /**
     *
     */
    addBehaviourButtonConfirm() {
        this.modalElementButtonsConfirm.forEach((button) => {
            button.addEventListener('click', (e) => {
                this.confirm();
            });
        });
    }

    /**
     *
     */
    addBehaviourExeTabs() {
        this.exeTabs = this.modalElement.querySelectorAll(
            '.exe-form-tabs li a'
        );
        this.exeContents =
            this.modalElement.querySelectorAll('.exe-form-content');
        this.exeTabs.forEach((link) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                // Hide help texts
                this.hideHelpContentAll();
                // Tabs
                this.exeTabs.forEach((tab) => {
                    tab.classList.remove('exe-form-active-tab');
                });
                link.classList.add('exe-form-active-tab');
                // Content
                if (this.exeContents.length > 0) {
                    this.exeContents.forEach((content) => {
                        content.classList.remove('exe-form-active-content');
                    });
                    this.modalElementBody
                        .querySelector(`${link.hash}.exe-form-content`)
                        .classList.add('exe-form-active-content');
                    this.tabSelectedLink = link.hash;
                } else {
                    this.exeContentsRows = this.modalElement.querySelectorAll(
                        '.exe-form-content-rows .row-form-content'
                    );
                    if (this.exeContentsRows.length > 0) {
                        this.exeContentsRows.forEach((row) => {
                            if (
                                '#' + row.getAttribute('category') ==
                                link.hash
                            ) {
                                row.classList.remove('hidden');
                            } else {
                                row.classList.add('hidden');
                            }
                        });
                    }
                }
            });
        });
    }

    /**
     *
     */
    addBehaviourExeHelp() {
        this.exeHelp = this.modalElement.querySelectorAll('.exe-form-help');
        this.exeHelp.forEach((help) => {
            // Help text
            let helpContent = help.querySelector('.help-content');
            // Add title
            help.setAttribute('title', _('Information'));
            // Close
            this.hideHelpContent(help);
            // Click event
            help.querySelector('icon').addEventListener('click', (icon) => {
                let show = helpContent.classList.contains('help-hidden');
                this.hideHelpContentAll();
                if (show) this.showHelpContent(help);
            });
        });
    }

    /**
     * Hide helps dialog when clicking on modal body
     *
     */
    addBehaviourBodyToHideHelpDialogs() {
        this.modalElement.addEventListener('click', (event) => {
            if (!event.target.classList.contains('form-help-exe-icon')) {
                this.hideHelpContentAll();
            }
        });
    }

    /**
     * Init interval to check if modal is closed
     *
     */
    initCloseCheckInterval() {
        this.intervalCloseCheck = setInterval(() => {
            if (!this.modal._isShown) {
                this.close();
            }
        }, 100);
    }

    /**
     * Show help row text
     *
     * @param {*} helpContainer
     */
    showHelpContent(helpContainer) {
        let helpContent = helpContainer.querySelector('.help-content');
        helpContent.classList.remove('help-hidden');
        helpContainer.classList.add('help-content-active');
        helpContainer.classList.remove('help-content-disabled');
    }

    /**
     * Hide help row text
     *
     * @param {*} helpContainer
     */
    hideHelpContent(helpContainer) {
        let helpContent = helpContainer.querySelector('.help-content');
        helpContent.classList.add('help-hidden');
        helpContainer.classList.add('help-content-disabled');
        helpContainer.classList.remove('help-content-active');
    }

    /**
     * Hide all help texts
     *
     */
    hideHelpContentAll() {
        this.exeHelp = this.modalElement.querySelectorAll('.exe-form-help');
        this.exeHelp.forEach((help) => {
            this.hideHelpContent(help);
        });
    }

    /**
     * Interact drag and drop modal
     *
     */
    interactModal() {
        interact(`#${this.id}.modal .modal-header`).draggable({
            listeners: {
                move: this.dragMoveModalListener.bind(this),
            },
            inertia: false,
            modifiers: [
                interact.modifiers.restrictRect({
                    restriction: document.querySelector('#main'),
                    endOnly: true,
                }),
            ],
        });
    }

    /**
     *
     */
    dragMoveModalListener(event) {
        let modalContent = event.target.parentNode;
        if (!modalContent.classList.contains('static')) {
            // keep the dragged position in the data-x/data-y attributes
            let x =
                (parseFloat(modalContent.getAttribute('data-x')) || 0) +
                event.dx;
            let y =
                (parseFloat(modalContent.getAttribute('data-y')) || 0) +
                event.dy;
            // translate the element
            modalContent.style.transform =
                'translate(' + x + 'px, ' + y + 'px)';
            // update the posiion attributes
            modalContent.setAttribute('data-x', x);
            modalContent.setAttribute('data-y', y);
        }
    }

    /**
     *
     * @param {*} data
     */
    show(data) {
        let time = this.manager.closeModals() ? this.timeMax : this.timeMin;
        setTimeout(() => {
            data = data ? data : {};
            let title = data.title ? data.title : this.titleDefault;
            let contentId = data.contentId ? data.contentId : null;
            let body = data.body ? data.body : '';
            // Set params
            this.setTitle(title);
            this.setContentId(contentId);
            this.setBody(body);
            // Show modal
            this.modal.show();
            // Focus cancel button
            if (this.cancelButton) {
                setTimeout(() => {
                    this.cancelButton.focus();
                }, this.timeMax);
            }
        }, time);
    }

    /**
     *
     */
    close(confirm) {
        if (this.preventCloseModal) {
            this.preventCloseModal = false;
            return false;
        }
        if (this.intervalCloseCheck) {
            clearInterval(this.intervalCloseCheck);
        }
        if (!confirm && this.closeExec) {
            this.closeExec.call();
        }
        // Move focus out of modal before hiding to avoid aria-hidden warning
        // "Blocked aria-hidden on an element because its descendant retained focus"
        if (document.activeElement && this.modalElement.contains(document.activeElement)) {
            document.activeElement.blur();
        }
        this.modal.hide();
        if (this.clearAfterClose) {
            setTimeout(() => {
                this.modalElementTitle.innerHTML = '';
                this.modalElementBody.innerHTML = '';
                this.modalElementHeader.removeAttribute('modal-content-id');
                this.modalElementBody.removeAttribute('modal-content-id');
            }, 100);
        }
    }

    /**
     *
     */
    async confirm() {
        this.modalElementButtonsConfirm.forEach((button) => {
            button.classList.add('disabled');
        });
        if (this.confirmExec) await this.confirmExec.call();
        this.close(true);
        setTimeout(() => {
            this.modalElementButtonsConfirm.forEach((button) => {
                button.classList.remove('disabled');
            });
        }, this.timeMax);
    }

    /**
     *
     */
    async cancel() {
        this.modalElementButtonsCancel.forEach((button) => {
            button.classList.add('disabled');
        });
        if (this.cancelExec) await this.cancelExec.call();
        this.close(true);
        setTimeout(() => {
            this.modalElementButtonsCancel.forEach((button) => {
                button.classList.remove('disabled');
            });
        }, this.timeMax);
    }

    /**
     *
     * @param {*} title
     */
    setContentId(contentId) {
        if (contentId) {
            this.modalElementHeader.setAttribute('modal-content-id', contentId);
            this.modalElementBody.setAttribute('modal-content-id', contentId);
        } else {
            this.modalElementHeader.removeAttribute('modal-content-id');
            this.modalElementBody.removeAttribute('modal-content-id');
        }
    }

    /**
     *
     * @param {*} title
     */
    setTitle(title) {
        this.modalElementTitle.innerHTML = title;
    }

    /**
     *
     * @param {*} body
     */
    setBody(body) {
        this.modalElementBody.innerHTML = body;
    }

    /***
     *
     */
    setConfirmExec(func) {
        this.confirmExec = func;
    }

    /***
     *
     */
    setCancelExec(func) {
        this.cancelExec = func;
    }

    /**
     *
     * @param {*} func
     */
    setCloseExec(func) {
        this.closeExec = func;
    }

    /*******************************************************************************
     * SORT TABLE
     *******************************************************************************/

    /**
     * sorTable
     * Compare values in td to order asc or desc
     *
     * @param {*} table
     * @param {*} thCount
     * @param {*} type
     * @param {*} sort
     */
    sorTable(table, thCount, type) {
        var shouldSwitch,
            switchcount = 0;
        let rows = table.rows;
        let sort = rows[0].getAttribute('sort-type')
            ? rows[0].getAttribute('sort-type')
            : 'asc';
        var switching = true;
        while (switching) {
            switching = false;
            for (var i = 1; i < rows.length - 1; i++) {
                let x = rows[i].getElementsByTagName('td')[thCount];
                let y = rows[i + 1].getElementsByTagName('td')[thCount];
                if (!x || !y) return false;
                switch (type) {
                    case 'string':
                        shouldSwitch = this.sorTableString(sort, x, y);
                        break;
                    case 'date':
                        shouldSwitch = this.sorTableDate(sort, x, y);
                        break;
                    case 'float':
                        shouldSwitch = this.sorTableFloat(sort, x, y);
                        break;
                    case 'checkbox':
                        shouldSwitch = this.sorTableCheckbox(sort, x, y);
                        break;
                    default:
                        return false;
                }
                if (shouldSwitch) break;
            }
            // Move rows
            if (shouldSwitch) {
                rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
                switching = true;
                switchcount++;
            }
        }
        // Add sort attribute
        let newSort = sort == 'asc' ? 'desc' : 'asc';
        rows[0].setAttribute('sort-type', newSort);
    }

    /**
     * sorTableString
     * Compare innerhtml to sort
     *
     * @param {*} sort
     * @param {*} x
     * @param {*} y
     * @returns
     */
    sorTableString(sort, x, y) {
        if (sort == 'asc') {
            return x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase();
        } else if (sort == 'desc') {
            return x.innerHTML.toLowerCase() < y.innerHTML.toLowerCase();
        }
        return false;
    }

    /**
     * sorTableDate
     * Compare id(timestamp) to sort
     *
     * @param {*} sort
     * @param {*} x
     * @param {*} y
     * @returns
     */
    sorTableDate(sort, x, y) {
        if (sort == 'asc') {
            return x.id > y.id;
        } else if (sort == 'desc') {
            return x.id < y.id;
        }
        return false;
    }

    /**
     * sorTableFloat
     * Compare innerhtml parsed to float
     *
     * @param {*} sort
     * @param {*} x
     * @param {*} y
     * @returns
     */
    sorTableFloat(sort, x, y) {
        if (sort == 'asc') {
            return (
                parseFloat(x.getAttribute('size')) >
                parseFloat(y.getAttribute('size'))
            );
        } else if (sort == 'desc') {
            return (
                parseFloat(x.getAttribute('size')) <
                parseFloat(y.getAttribute('size'))
            );
        }
        return false;
    }

    /**
     * sorTableCheckbox
     * Compare value of input checkbox
     *
     * @param {*} sort
     * @param {*} x
     * @param {*} y
     * @returns
     */
    sorTableCheckbox(sort, x, y) {
        let inputX = x.querySelector('input');
        let inputY = y.querySelector('input');
        if (sort == 'asc') {
            return inputX.checked > inputY.checked;
        } else if (sort == 'desc') {
            return inputX.checked < inputY.checked;
        }
        return false;
    }

    /*******************************************************************************
     * CSV EXPORT
     *******************************************************************************/

    /**
     * Convert an HTML table to CSV format
     * Parses the visible table in the modal and generates a CSV string
     *
     * @param {HTMLTableElement} tableElement - The table element to convert
     * @param {Object} options - Options for CSV generation
     * @param {number[]} [options.skipColumns=[]] - Column indices to skip (0-based)
     * @returns {string} CSV string with UTF-8 BOM prefix
     */
    tableToCSV(tableElement, options = {}) {
        const skipColumns = options.skipColumns || [];
        const rows = [];

        // Get headers from thead
        const thead = tableElement.querySelector('thead');
        if (thead) {
            const headers = [];
            // Try to find th elements inside tr first, fallback to direct children
            let ths = thead.querySelectorAll('tr th');
            if (ths.length === 0) {
                // Handle non-standard structure where th is direct child of thead
                ths = thead.querySelectorAll('th');
            }
            ths.forEach((th, index) => {
                if (!skipColumns.includes(index)) {
                    headers.push(this._escapeCSVValue(th.textContent.trim()));
                }
            });
            if (headers.length > 0) {
                rows.push(headers.join(','));
            }
        }

        // Get data from tbody
        const tbody = tableElement.querySelector('tbody');
        if (tbody) {
            const trs = tbody.querySelectorAll('tr');
            trs.forEach((tr) => {
                const cells = [];
                const tds = tr.querySelectorAll('td');

                // Skip empty or placeholder rows (e.g., "No links found")
                if (tds.length === 1 && tds[0].colSpan > 1) {
                    return;
                }

                tds.forEach((td, index) => {
                    if (!skipColumns.includes(index)) {
                        // Get text content, handling links specially
                        let value = td.textContent.trim();
                        cells.push(this._escapeCSVValue(value));
                    }
                });

                if (cells.length > 0) {
                    rows.push(cells.join(','));
                }
            });
        }

        return rows.join('\r\n');
    }

    /**
     * Escape a value for CSV format
     * Handles commas, quotes, and newlines
     *
     * @param {string} value - The value to escape
     * @returns {string} Escaped value
     * @private
     */
    _escapeCSVValue(value) {
        if (value === null || value === undefined) {
            return '';
        }

        const str = String(value);

        // If value contains comma, quote, or newline, wrap in quotes
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            // Escape quotes by doubling them
            return `"${str.replace(/"/g, '""')}"`;
        }

        return str;
    }

    /**
     * Download content as a CSV file
     *
     * @param {string} csvContent - The CSV content (without BOM)
     * @param {string} filename - The filename for the download
     */
    downloadCSVFile(csvContent, filename) {
        const blob = new Blob(['\ufeff', csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = filename;

        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        URL.revokeObjectURL(url);
    }

    /*******************************************************************************
     * FILTER TABLE
     *******************************************************************************/

    /**
     * Make a table input filter
     *
     * @returns
     */
    makeFilterTable(container, filterTdClass, placeholder) {
        let inputFilter = document.createElement('input');
        inputFilter.classList.add('table-filter');
        inputFilter.classList.add('form-control');
        inputFilter.setAttribute('type', 'text');
        inputFilter.setAttribute('placeholder', placeholder);
        inputFilter.addEventListener('keyup', () => {
            // Declare variables
            let filter = inputFilter.value.toUpperCase();
            let tr = container.getElementsByTagName('tr');
            // Loop through all table rows, and hide those who don't match the search query
            container.querySelectorAll('tr').forEach((tr) => {
                let td = tr.querySelector(filterTdClass);
                if (td) {
                    let txtValue = td.textContent || td.innerText;
                    if (txtValue.toUpperCase().indexOf(filter) > -1) {
                        tr.style.display = '';
                    } else {
                        tr.style.display = 'none';
                    }
                }
            });
        });

        return inputFilter;
    }
}
