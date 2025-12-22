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
            isInExe = eXe.app.isInExe();

        // In export/preview, regenerate gallery HTML with resolved URLs
        if (!isInExe && $node.length == 1) {
            let gallery = $imagegallery.getStringGallery(data);
            $node.html(gallery);
        }

        // Initialize lightbox - links have rel="lightbox[gallery-{id}]"
        // Re-initialize prettyPhoto to pick up new links
        const initLightbox = () => {
            const $links = $node.find('.imageGallery-IDevice a.imageLink');

            if ($links.length === 0) {
                return false;
            }

            // Check if prettyPhoto is available
            if (typeof $.fn.prettyPhoto === 'undefined') {
                console.log('[image-gallery] prettyPhoto not available yet');
                return false;
            }

            // Initialize prettyPhoto on gallery links
            // Using the hook 'rel' to group images by gallery
            try {
                $links.prettyPhoto({
                    hook: 'rel',
                    theme: 'pp_default',
                    social_tools: '',
                    deeplinking: false,
                    show_title: true,
                    allow_resize: true,
                    overlay_gallery: true,
                    overlay_gallery_max: 30
                });
                return true;
            } catch (e) {
                console.error('[image-gallery] prettyPhoto init error:', e);
                return false;
            }
        };

        // Try immediately, then retry with interval (wait for prettyPhoto to load)
        if (!initLightbox()) {
            let attempts = 0;
            const maxAttempts = 25; // 5 seconds max
            const interval = setInterval(() => {
                attempts++;
                if (initLightbox() || attempts >= maxAttempts) {
                    clearInterval(interval);
                }
            }, 200);
        }
    },

    changeDirectory(file, data) {
        const $node = $('#' + data.ideviceId),
            isInExe = eXe.app.isInExe();

        // In editor, don't modify asset:// URLs
        if (isInExe) return file;
        if ($node.length == 0) return file;

        // Handle blob: URLs (preview mode) - use directly
        if (file && file.startsWith('blob:')) {
            return file;
        }

        const pathMedia = $('html').is('#exe-index')
            ? 'content/resources/'
            : '../content/resources/';

        // Handle asset:// URLs
        if (file && file.startsWith('asset://')) {
            const assetPath = file.replace('asset://', '');
            return pathMedia + assetPath;
        }

        // Already resolved paths (from IdeviceRenderer) - return as-is
        // This handles: content/resources/uuid/file, ../content/resources/uuid/file
        if (file && (file.includes('content/resources/') || file.startsWith('../'))) {
            return file;
        }

        // Fallback: return file unchanged (shouldn't reach here with proper data)
        console.warn('[image-gallery] Unhandled file path format:', file);
        return file;
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
                // Use same image for thumbnail if no thumbnail field (CSS resize)
                let thumbnailURL = value.thumbnail
                    ? $imagegallery.changeDirectory(value.thumbnail, data)
                    : imageURL;
                let imageTitle = value.title || '';
                let imageLinkTitle = value.linktitle || '';
                let imageAuthor = value.author || '';
                let imageLinkAuthor = value.linkauthor || '';
                let imageLicense = value.license || '';
                let imageLinkLicense = this.getLinkLicense(value.license);
                htmlContent += `<div id="imageContainer_${idIncremental}" class="imageContainer">`;
                htmlContent += ` <a idevice-id="${ideviceId}" title="${imageTitle}" href="${imageURL}" class="imageLink" rel="lightbox[gallery-${ideviceId}]">`;
                htmlContent += `  <div class="imageElement">`;
                htmlContent += `   <img src="${thumbnailURL}" class="gallery-thumbnail" title="${imageTitle}" alt="${imageTitle}" titlelink="${imageLinkTitle}" author="${imageAuthor}" authorlink="${imageLinkAuthor}" license="${imageLicense}" licenselink="${imageLinkLicense}"/>`;
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
