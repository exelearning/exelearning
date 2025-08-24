import Modal from '../modal.js';

export default class ModalReleaseNotes extends Modal {
    constructor(manager) {
        let id = 'modalReleaseNotes';
        let titleDefault;
        super(manager, id, titleDefault, false);
    }

    /**
     *
     * @param {*} data
     */
    show() {
        // Set title
        this.titleDefault = _('Release notes');
        let time = this.manager.closeModals() ? this.timeMax : this.timeMin;
        setTimeout(() => {
            this.setTitle(this.titleDefault);
            this.modal.show();
        }, time);
    }

    /**
     * Set content of changeLog to modal
     *
     */
    async load() {
        let contents = await eXeLearning.app.api.getChangelogText();
        let viewer = this.modalElementBody.querySelector(
            '.body-release .changelog-content'
        );
        viewer.innerHTML = eXeLearning.app.common.markdownToHTML(contents);
        // Add some style to the titles
        $('h2', viewer).each(function () {
            var e = $(this);
            var h = e.html();
            h = h.split(' - ');
            if (h.length == 2) {
                h = h[0] + ' <span>' + h[1] + '</span>';
                e.html(h);
            }
            e.attr('class', 'lead mb-4');
        });
        $('h3', viewer).attr('class', 'lead mb-3');
    }
}
