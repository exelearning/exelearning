import Modal from '../modal.js';

export default class ModalOdeUsedFiles extends Modal {
    constructor(manager) {
        let id = 'modalOdeUsedFiles';
        let titleDefault;
        super(manager, id, titleDefault, false);
        this.confirmButtonDefaultText = _('End');
        this.cancelButtonDefaultText = _('Cancel');
        this.confirmButton = this.modalElement.querySelector(
            'button.btn.btn-primary'
        );
        this.cancelButton = this.modalElement.querySelector(
            'button.close.btn.btn-secondary'
        );
    }

    /**
     *
     * @param {*} odeElements
     * @returns {Node}
     */
    makeTheadElements() {
        let tHead = document.createElement('thead');
        let thTitles = [
            _('File'),
            _('Path'),
            _('Size'),
            _('Page name'),
            _('Block name'),
            _('Type'),
            _('Block position'),
        ];
        for (let thCount = 0; thCount < thTitles.length; thCount++) {
            let th = document.createElement('th');
            th.textContent = _(thTitles[thCount]);
            tHead.appendChild(th);
        }
        return tHead;
    }

    /**
     *
     * @param {*} odeElements
     * @returns {Node}
     */
    makeTbodyElements(odeElements) {
        let odeComponentLinkKey;
        let tBody = document.createElement('tbody');
        let files = odeElements['usedFiles'];
        for (
            odeComponentLinkKey = 0;
            odeComponentLinkKey < files.length;
            odeComponentLinkKey++
        ) {
            let tdContent = [
                files[odeComponentLinkKey]['usedFiles'],
                files[odeComponentLinkKey]['usedFilesPath'],
                files[odeComponentLinkKey]['usedFilesSize'],
                files[odeComponentLinkKey]['pageNamesUsedFiles'],
                files[odeComponentLinkKey]['blockNamesUsedFiles'],
                files[odeComponentLinkKey]['typeComponentSyncUsedFiles'],
                files[odeComponentLinkKey]['orderComponentSyncUsedFiles'],
            ];
            let tr = document.createElement('tr');
            for (let tdCount = 0; tdCount < tdContent.length; tdCount++) {
                let td = document.createElement('td');
                td.textContent = tdContent[tdCount];
                tr.appendChild(td);
            }
            tBody.appendChild(tr);
        }
        return tBody;
    }

    /**
     *
     * @param {*} odeElements
     * @returns {Node}
     */
    makeOdeListElements(odeElements) {
        let odeTable = document.createElement('table');
        let tHead = this.makeTheadElements();
        let tBody = this.makeTbodyElements(odeElements);
        odeTable.appendChild(tHead);
        odeTable.appendChild(tBody);
        odeTable.classList.add('table');
        odeTable.classList.add('table-striped');
        return odeTable;
    }

    /**
     * Generate html of body
     *
     * @param {*} odeElements
     * @returns {String}
     */
    makeBodyHtml(odeElements) {
        let element = document.createElement('div');
        element.append(this.makeOdeListElements(odeElements));
        return element.innerHTML;
    }

    /**
     *
     * @param {*} odeElements
     */
    show(odeElements) {
        // Set title
        this.titleDefault = _('Resource Report');
        let time = this.manager.closeModals() ? 500 : 50;
        setTimeout(() => {
            odeElements = odeElements ? odeElements : {};
            let title = odeElements.title
                ? odeElements.title
                : this.titleDefault;
            this.setTitle(title);
            this.setBody(this.makeBodyHtml(odeElements));
            this.setConfirmExec(() => {
                this.downloadCsv();
            });
            this.modal.show();
        }, time);
    }

    /**
     *
     */
    async downloadCsv() {
        this.preventCloseModal = true;
        let sessionId = eXeLearning.app.project.odeSession;
        let params = {
            csv: true,
            odeSessionId: sessionId,
            resourceReport: true,
        };
        await eXeLearning.app.api
            .getOdeSessionUsedFiles(params)
            .then(function (data) {
                var headerTitles = [
                    _('File'),
                    _('Path'),
                    _('Size'),
                    _('Page name'),
                    _('Block name'),
                    _('Type'),
                    _('Block position'),
                ];
                var csv =
                    eXeLearning.app.api.app.menus.navbar.utilities.json2Csv(
                        data['usedFiles'],
                        headerTitles
                    );
                var downloadLink = document.createElement('a');
                var blob = new Blob(['\ufeff', csv]);
                var url = URL.createObjectURL(blob);
                downloadLink.href = url;
                downloadLink.download = 'ResourceReport.csv';

                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            });
    }
}
