/* eslint-disable no-undef */
/**
 * DigCompEdu iDevice (export mode)
 *
 * Renders the stored summary content generated during edition mode.
 */
var $Digcompedu = {
    ideviceClass: 'digcompeduIdeviceContent',

    init(data, accessibility) {
        void data;
        void accessibility;
    },

    renderView(data, accessibility, template, ideviceId, pathMedia) {
        void ideviceId;
        const htmlContent = this.getHTMLView(data, pathMedia);
        return template.replace('{content}', htmlContent);
    },

    getHTMLView(data, pathMedia) {
        void pathMedia;
        const displayMode = data.digcompeduDisplayMode || 'table';
        const lang = data.digcompeduDataLang || 'es';
        const selectedCount = Array.isArray(data.digcompeduSelected)
            ? data.digcompeduSelected.length
            : 0;

        const summaryTableHtml = this.buildSummaryTable(data);
        const summaryTextHtml = this.buildTextSummary(data, lang);

        // Note: The outer container div is provided by the template (digcompedu.html)
        // We only generate the inner content here
        let html = '';

        if (!summaryTableHtml) {
            return `<div class="digcompedu-empty">${_('No indicators were selected for this activity.')}</div>`;
        }

        html += `<h3>${_('DigCompEdu summary')}</h3>`;
        html += `<p>${_('Selected indicators: ')}${selectedCount}</p>`;
        html += `<div class="digcompedu-summary-wrapper" data-lang="${lang}" data-display="${displayMode}">${summaryTableHtml}</div>`;

        if (displayMode === 'table+summary' && summaryTextHtml) {
            html += `<div class="digcompedu-text-summary">${summaryTextHtml}</div>`;
        }

        return html;
    },

    renderBehaviour(data, accessibility, ideviceId) {
        void data;
        void accessibility;
        void ideviceId;
    },

    /**
     * Return stored summary table HTML.
     * @param {Object} data
     * @returns {string}
     */
    buildSummaryTable(data) {
        return data.digcompeduSummaryTableHtml || '';
    },

    /**
     * Return stored textual summary HTML.
     * @param {Object} data
     * @param {string} lang
     * @returns {string}
     */
    buildTextSummary(data, lang) {
        void lang;
        return data.digcompeduSummaryTextHtml || '';
    },

    loadFrameworkData() {
        return null;
    },
};

var $digcompedu = $Digcompedu;
