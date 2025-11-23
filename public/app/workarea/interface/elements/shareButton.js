export default class ShareProjectButton {
    constructor() {
        this.shareMenuHeadButton = document.querySelector(
            '#head-top-share-button'
        );
    }

    /**
     * Init element
     *
     */
    init() {
        this.addEventClick();
    }

    /**
     * Add event click to button
     *
     */
    addEventClick() {
        this.shareMenuHeadButton.addEventListener('click', (event) => {
            // First save content (make propietary of the content)
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            eXeLearning.app.project.save().then(() => {
                this.copyUserSessionId();
            });
        });
    }

    /**
     * Modal to show the share link and copy
     *
     */
    async copyUserSessionId() {
        let result = await eXeLearning.app.api.getCurrentUserOdeSessionId();
        let body = this.makeBodyElementShareUrl(result);
        await eXeLearning.app.modals.alert.show({
            title: _('Share link'),
            body: body.innerHTML,
            contentId: 'Ok',
        });

        // Set event copy button (due to innerHtml)
        setTimeout(() => {
            this.addEventButtonCopy();
        }, 1000);
    }

    /**
     * Event to copy to the clipboard
     *
     */
    addEventButtonCopy() {
        let shareButton = document.getElementById('shareUrlButton');
        shareButton.addEventListener('click', () => {
            // Get the text field
            let copyText = document.getElementById('shareLinkCode');
            let copyTextValue = copyText.innerText;

            if (!navigator.clipboard) {
                let textArea = document.createElement('textarea');

                textArea.value = copyTextValue;

                document.body.appendChild(textArea);

                textArea.select();
                textArea.focus();

                document.execCommand('copy');
                textArea.remove();
            } else {
                navigator.clipboard.writeText(copyTextValue);
            }
        });
    }

    /**
     * Get element to append
     *
     * @param {*} result
     * @returns
     */
    makeBodyElementShareUrl(result) {
        let element = document.createElement('div');
        element.classList.add('element-share-url');
        element.append(this.makeUrlBody(result));
        return element;
    }

    /**
     * Make body content to show the share url
     *
     * @param {*} result
     * @returns
     */
    makeUrlBody(result) {
        let element = document.createElement('div');
        let p = document.createElement('p');
        let urlDiv = document.createElement('div');
        let urlString = document.createElement('div');
        let urlButton = document.createElement('button');

        element.classList.add('share-link-div');

        p.classList.add('share-link-text');
        p.innerHTML = _('The share link is:');

        urlDiv.classList.add('share-link-div-content');

        urlString.classList.add('share-link-code-string');
        urlString.id = 'shareLinkCode';
        urlString.innerHTML = `<strong> ${result.shareSessionUrl}</strong>`;

        urlButton.id = 'shareUrlButton';
        urlButton.title = _('Copy to clipboard');
        // urlButton.classList.add('exe-icon');
        // urlButton.classList.add('share-url-button');
        urlButton.innerHTML =
            '<i class="auto-icon" aria-hidden="true">content_paste</i><span class="visually-hidden">' +
            _('Copy to clipboard') +
            '</span>';

        urlDiv.append(urlString);
        urlDiv.append(urlButton);

        element.append(p);
        element.append(urlDiv);

        return element;
    }
}
