/**
 * Scrambled List iDevice
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Ignacio Gros (http://gros.es/) for http://exelearning.net/
 *
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 *
 * It includes the HTML5 Sortable jQuery Plugin, released under the MIT license (details below)
 */

var $example = {
    ideviceClass: 'exampleIdeviceContent',

    /**
     * eXe idevice engine
     * Json idevice api function
     * Engine execution order: 1
     *
     * Get the base html of the idevice view
     *
     * @param {Object} data
     * @param {Number} accesibility
     * @param {String} template
     * @returns {String}
     */
    renderView: function (data, accesibility, template) {
        // Generate html content from data values
        let htmlContent = '';
        htmlContent += `<div class="${this.ideviceClass}">`;
        for (let [key, value] of Object.entries(data)) {
            let style =
                key == 'color' ? `style="background-color:${value}"` : '';
            htmlContent += `<div class="data-values-row">`;
            htmlContent += `<div class="td data-key">${key}</div>`;
            htmlContent += `<div class="td data-value" ${style}>${value}</div>`;
            htmlContent += `</div>`;
        }
        htmlContent += `</div>`;
        // Use template export/example.html
        // Insert the html content inside the template
        let html = template.replace('{content}', htmlContent);

        // Save html in database
        return html;
    },

    /**
     * Json idevice api function
     * Engine execution order: 2
     *
     * Add the behavior and other functionalities to idevice
     *
     * @param {Object} data
     * @param {Number} accesibility
     * @returns {Boolean}
     */
    renderBehaviour() {
        //
    },

    /**
     * Json idevice api function
     * Engine execution order: 3
     *
     * Initialize idevice parameters if necessary
     *
     * @param {Object} data
     * @param {Number} accesibility
     */
    init: function (data, accesibility) {
        //
    },
};
