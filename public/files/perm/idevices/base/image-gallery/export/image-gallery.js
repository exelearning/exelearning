/**
 * Image Gallery iDevice
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: SDWEB - Innovative Digital Solutions
 *
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $imagegallery = {
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
        // In export context, the HTML is already rendered correctly server-side
        // Don't re-generate to preserve correct paths (changeDirectory would break them)
        if (document.body.classList.contains('exe-export')) {
            return null; // Return null to prevent innerHTML replacement in exe_export.js
        }

        // Generate html content from data values
        let htmlContent = $imagegallery.getStringGallery(data);
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
    renderBehaviour(data) {
        const $node = $('#' + data.ideviceId),
            isInExe = eXe.app.isInExe(),
            isExport = document.body.classList.contains('exe-export');

        // Only re-render gallery in preview panel (not in export, which already has correct HTML)
        // Export HTML is generated server-side with correct paths; re-rendering would break them
        if (!isInExe && !isExport && $node.length == 1) {
            let gallery = $imagegallery.getStringGallery(data);
            $node.html(gallery);
        }

        // Disabled links
        document
            .querySelectorAll('.image-galleryIdevice .imageGallery-IDevice a')
            .forEach((img) => {
                img.addEventListener('click', (event) => {
                    event.stopPropagation();
                    event.preventDefault();
                });
            });

        // Simplelightbox
        if (typeof SimpleLightbox !== 'undefined') {
            this.createSLightboxGallery(data.ideviceId);
        } else {
            var interval = setInterval(function () {
                if (typeof SimpleLightbox !== 'undefined') {
                    $imagegallery.createSLightboxGallery(data.ideviceId);
                    clearInterval(interval);
                }
            }, 200);
        }
    },

    changeDirectory(file, data) {
        const $node = $('#' + data.ideviceId),
            isInExe = eXe.app.isInExe();

        // Keep asset://, blob://, and data: URLs as-is
        // - asset:// will be resolved by the asset resolver
        // - blob:// and data: are already resolved URLs (from preview/export)
        if (file && (file.startsWith('asset://') || file.startsWith('blob:') || file.startsWith('data:'))) {
            return file;
        }

        if (isInExe || $node.length == 0) return file;

        const pathMedia = $('html').is('#exe-index')
            ? 'content/resources/' + data.ideviceId + '/'
            : '../content/resources/' + data.ideviceId + '/';

        const parts = file.split(/[/\\]/),
            name = parts.pop(),
            dir = pathMedia.replace(/[/\\]+$/, '');
        return dir + '/' + name;
    },

    getStringGallery: function (data) {
        let ideviceId = data.ideviceId;
        let idIncremental = 0;
        let htmlContent = `
            <div class="imageGallery-IDevice">
                <div class="imageGallery-body">`;
        Object.entries(data).forEach(([key, value]) => {
            if (key !== 'ideviceId') {
                let imageURL = $imagegallery.changeDirectory(value.img, data);
                let thumbnailURL = $imagegallery.changeDirectory(
                    value.thumbnail,
                    data
                );
                let imageTitle = value.title;
                let imageLinkTitle = value.linktitle;
                let imageAuthor = value.author;
                let imageLinkAuthor = value.linkauthor;
                let imageLicense = value.license;
                let imageLinkLicense = this.getLinkLicense(value.license);
                htmlContent += `<div id="imageContainer_${idIncremental}" class="imageContainer">`;
                htmlContent += ` <a idevice-id="${ideviceId}" title="${imageTitle}" href="${imageURL}" class="imageLink">`;
                htmlContent += `  <div class="imageElement">`;
                htmlContent += `   <img src="${thumbnailURL}" height="128" width="128" title="${imageTitle}" alt="${imageTitle}" titlelink="${imageLinkTitle}" author="${imageAuthor}" authorlink="${imageLinkAuthor}" license="${imageLicense}" licenselink="${imageLinkLicense}"/>`;
                htmlContent += `  </div>`;
                htmlContent += ` </a>`;
                htmlContent += `</div>`;
                idIncremental++;
            }
        });
        htmlContent += `
                </div>
            </div>`;
        return htmlContent;
    },

    /**
     * Json idevice api function
     * Engine execution order: 3
     *
     */
    init: function () {},

    /**
     * Create a new simple ligthbox gallery
     *
     */
    createSLightboxGallery: function (ideviceId) {
        let selector = `[id="${ideviceId}"] .imageGallery-IDevice a`;
        new SimpleLightbox(selector, {
            // Custom lightbox for exe. Now we can take values from multiple attributes
            captionsData: [
                'title',
                'titlelink',
                'author',
                'authorlink',
                'license',
                'licenselink',
            ],
            captionPosition: 'outside',
            // Disable file extension check to support blob:// URLs in editor
            fileExt: false,
        });
    },

    getLinkLicense: function (attrLicense) {
        let linkLicense = '';
        if (
            attrLicense === 'pd' ||
            attrLicense === 'copyright' ||
            attrLicense === ''
        ) {
            linkLicense = '';
        } else if (attrLicense === 'gnu-gpl') {
            linkLicense = 'http://www.gnu.org/licenses/gpl.html';
        } else if (attrLicense === 'CC0') {
            linkLicense =
                'http://creativecommons.org/publicdomain/zero/1.0/deed';
        } else if (
            attrLicense === 'CC-BY' ||
            attrLicense === 'CC-BY-SA' ||
            attrLicense === 'CC-BY-ND' ||
            attrLicense === 'CC-BY-NC' ||
            attrLicense === 'CC-BY-NC-SA' ||
            attrLicense === 'CC-BY-NC-ND'
        ) {
            linkLicense = 'http://creativecommons.org/licenses/';
        } else {
            // linkLicense = attrLicense;
            linkLicense = '';
        }

        return linkLicense;
    },
};
