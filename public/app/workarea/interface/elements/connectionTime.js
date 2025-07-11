export default class ConnecionTime {
    constructor() {
        this.connTimeElementWrapper =
            document.querySelector('#exe-last-edition');
        this.connTimeElement = document.querySelector(
            '#exe-last-edition .content'
        );
        // To do this.lastEditionPreText = _('Last save:');
        this.lastUpdatedJson = null;
        this.lastUpdatedDate = null;
        this.intervalTime = eXeLearning.config.clientIntervalGetLastEdition;
    }

    /**
     * Init element
     *
     */
    async init() {
        await this.loadLasUpdatedInInterface();
    }

    /**
     *
     *
     */
    async loadLasUpdatedInInterface() {
        // Set tooltip
        this.loadLastUpdated().then((response) => {
            this.setLastUpdatedToElement();
        });
    }

    /**
     * Load ode last update from api
     *
     */
    async loadLastUpdated() {
        let odeId = eXeLearning.app.project.odeId;
        this.lastUpdatedJson =
            await eXeLearning.app.api.getOdeLastUpdated(odeId);
        this.lastUpdatedDate = this.lastUpdatedJson.lastUpdatedDate;
    }

    /**
     * Set last update string to interface element
     *
     */
    setLastUpdatedToElement() {
        if (this.lastUpdatedDate) {
            // To do this.lastEditionPreText = _('Last save:');

            let timeDict = this.getTimeDiffToNow();
            let textEditionValueText = this.makeStringTimeDiff(
                timeDict.days,
                timeDict.hours,
                timeDict.minutes
            );

            $(this.connTimeElementWrapper).attr(
                'data-bs-original-title',
                `${textEditionValueText}`
            );
            this.connTimeElement.innerHTML = `<span class="auto-icon" aria-hidden="true">history</span><span class="visually-hidden">${textEditionValueText}</span>`;
            this.connTimeElementWrapper.className = 'saved';
            $('#head-top-save-button')
                .attr('data-bs-original-title', textEditionValueText)
                .removeClass('unsaved');
        } else {
            if (
                eXeLearning.app.user.preferences.preferences.versionControl
                    .value === 'false' &&
                eXeLearning.app.project.offlineInstallation
            ) {
                $(this.connTimeElementWrapper).attr(
                    'data-bs-original-title',
                    _('No previous versions')
                );
                this.connTimeElement.innerHTML =
                    '<span class="auto-icon" aria-hidden="true">work_history</span><span class="visually-hidden">' +
                    _('No previous versions') +
                    '</span>';
                this.connTimeElementWrapper.className = 'no-versions';
                $('#head-top-save-button')
                    .attr('data-bs-original-title', _('No previous versions'))
                    .removeClass('unsaved');
            } else {
                $(this.connTimeElementWrapper).attr(
                    'data-bs-original-title',
                    _('Unsaved project')
                );
                this.connTimeElement.innerHTML =
                    '<span class="auto-icon" aria-hidden="true">warning</span><span class="visually-hidden">' +
                    _('Unsaved project') +
                    '</span>';
                this.connTimeElementWrapper.className = 'unsaved';
                $('#head-top-save-button')
                    .attr('data-bs-original-title', _('Unsaved project'))
                    .addClass('unsaved');
            }
        }
        $('#exe-last-edition').tooltip();
    }

    /**
     *
     * @returns {Dict}
     */
    getTimeDiffToNow() {
        let timeNow = Math.floor(new Date().getTime() / 1000);
        let timeDiff = timeNow - this.lastUpdatedDate;
        let days = Math.max(0, Math.floor(timeDiff / 60 / 60 / 60));
        let hours = Math.max(0, Math.floor(timeDiff / 60 / 60));
        let minutes = Math.max(0, Math.floor(timeDiff / 60));

        return { days: days, hours: hours, minutes: minutes };
    }

    /**
     * Make string from time
     *
     * @param {*} days
     * @param {*} hours
     * @param {*} minutes
     */
    makeStringTimeDiff(days, hours, minutes) {
        let lastEditionText = '';
        if (days == 1) {
            lastEditionText = _('Saved one day ago');
        } else if (days > 1) {
            lastEditionText = _('Saved %s days ago');
            lastEditionText = lastEditionText.replace('%s', days);
        } else if (hours == 1) {
            lastEditionText = _('Saved an hours ago');
        } else if (hours > 1) {
            lastEditionText = _('Saved %s hours ago');
            lastEditionText = lastEditionText.replace('%s', hours);
        } else if (minutes) {
            lastEditionText = _('Saved %s minutes ago');
            lastEditionText = lastEditionText.replace('%s', minutes);
        } else {
            lastEditionText = _(`Saved a few seconds ago`);
        }

        return lastEditionText;
    }
}
