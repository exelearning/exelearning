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
        if (!isInExe && $node.length == 1) {
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

        // Determine base path based on page location
        const basePath = $('html').is('#exe-index') ? '' : '../';

        // If path already starts with content/resources/, handle it
        if (file && file.startsWith('content/resources/')) {
            const parts = file.split('/');
            const filename = parts.pop();
            const possibleFolder = parts[parts.length - 1];

            // Check for malformed path: filename duplicated as folder
            // e.g., content/resources/image.png/image.png -> content/resources/image.png
            if (possibleFolder === filename) {
                parts.pop(); // Remove the duplicated folder
                return basePath + parts.join('/') + '/' + filename;
            }

            // Valid path with folder structure - preserve it
            return basePath + file;
        }

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
                const esc = $imagegallery.escapeAttr;
                let imageURL = esc($imagegallery.changeDirectory(value.img, data));
                let thumbnailURL = esc(
                    $imagegallery.changeDirectory(value.thumbnail, data)
                );
                let imageTitle = esc(value.title);
                let imageLinkTitle = esc(value.linktitle);
                let imageAuthor = esc(value.author);
                let imageLinkAuthor = esc(value.linkauthor);
                let imageLicense = esc(value.license);
                let imageLinkLicense = esc(this.getLinkLicense(value.license));
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
     * Escape a value for a double-quoted HTML attribute. Keeps the legacy
     * "undefined" text for missing values, as older versions saved it.
     */
    escapeAttr: function (value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
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
            // The caption (title, author, license and their links) is built
            // here with DOM APIs, so stored values are rendered as text.
            captionSelector: (link) =>
                $imagegallery.buildCaption(link.querySelector('img')),
            captionType: 'text',
            captionPosition: 'outside',
            // Disable file extension check to support blob:// URLs in editor
            fileExt: false,
        });
    },

    /**
     * Read a caption attribute. Galleries saved by older versions store the
     * literal string "undefined" for empty fields.
     */
    captionValue: function (img, name) {
        const value = img.getAttribute(name);
        return value && value !== 'undefined' ? value : '';
    },

    /**
     * Return the URL only when it is safe to use as a link target.
     */
    safeLink: function (href) {
        if (!href) return '';
        try {
            const url = new URL(href, window.location.href);
            return ['http:', 'https:', 'mailto:'].includes(url.protocol)
                ? href
                : '';
        } catch (e) {
            return '';
        }
    },

    /**
     * Build the lightbox caption for a gallery image: author, title and
     * license, each linked when a link is set. Returns null when there is
     * nothing to show.
     *
     * @param {HTMLImageElement} img
     * @returns {HTMLElement|null}
     */
    buildCaption: function (img) {
        if (!img) return null;
        const get = (name) => $imagegallery.captionValue(img, name);
        const author = get('author');
        const authorLink = $imagegallery.safeLink(get('authorlink'));
        const title = get('title');
        const titleLink = $imagegallery.safeLink(get('titlelink'));
        const license = get('license');
        const licenseLink = $imagegallery.safeLink(get('licenselink'));

        const caption = document.createElement('div');
        const add = (tag, className, text, attrs) => {
            const el = document.createElement(tag);
            if (className) el.className = className;
            if (text) el.textContent = text;
            Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
            return el;
        };
        const link = (href, className, text) =>
            add('a', className, text, { href, target: '_blank', rel: 'noopener' });

        if (author || authorLink) {
            caption.appendChild(
                authorLink
                    ? link(authorLink, 'caption author', author || authorLink)
                    : add('span', 'caption autor', author)
            );
        }
        if (title || titleLink) {
            const em = add('em', '', title || titleLink);
            const el = titleLink
                ? link(titleLink, 'caption title', '')
                : add('span', 'caption title', '');
            el.appendChild(em);
            caption.appendChild(el);
        }
        if (license) {
            const alone = !author && !authorLink && !title && !titleLink;
            const label =
                (typeof $exe_i18n !== 'undefined' && $exe_i18n.license) ||
                'License';
            const el = add('span', 'caption license', alone ? label + ': ' : '(');
            el.appendChild(
                licenseLink
                    ? add('a', '', license, {
                          href: licenseLink,
                          rel: 'license nofollow noopener',
                          target: '_blank',
                          title: license,
                      })
                    : add('span', 'custom-license', license)
            );
            if (!alone) el.appendChild(document.createTextNode(')'));
            caption.appendChild(el);
        }
        return caption.childNodes.length ? caption : null;
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
