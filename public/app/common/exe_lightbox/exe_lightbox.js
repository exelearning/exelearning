/**
 * eXeLearning content lightbox.
 *
 * Opens the `rel^="lightbox"` links of saved content with Tobii
 * (https://github.com/midzer/tobii, MIT), installed from npm and copied next
 * to this file by scripts/copy-vendor-libs.js. Tobii does the lightbox itself:
 * the accessible dialog, focus trap, keyboard and touch navigation, galleries,
 * zoom, captions and the image/iframe/HTML slide types.
 *
 * This file only keeps the link conventions that years of saved content use
 * (they come from prettyPhoto, which this replaces):
 *
 * - `rel="lightbox"` opens one item; `rel="lightbox[name]"` makes a gallery.
 * - `href="#id"` opens a copy of that element (modalwindow dialogs, and the
 *   audio/video boxes that $exe.setMultimediaGalleries creates).
 * - YouTube (`t=`/`start=`), Vimeo and Mediateca links open their player.
 * - `?iframe=true&width=W&height=H` opens the page in an iframe.
 * - The link `title` is the caption; it is shown as text, never as HTML.
 * - Large images get a "Full size" button ("New window" in SCORM/IMS frames).
 *
 * The author's links are not modified: Tobii is given detached proxy
 * elements, and this file opens them from the real links' click handlers.
 */
(function (root) {
    'use strict';

    var DEFAULT_WIDTH = 500;
    var DEFAULT_HEIGHT = 344;
    var MEDIATECA = 'https://mediateca.educa.madrid.org/';

    var tobii = null;
    var lightboxEl = null;
    var holder = null;
    var fullSizeButton = null;
    var bound = []; // { link, handler }
    var groups = {}; // Tobii group name → [item]
    var pendingBind = false;
    var counter = 0;

    function i18n(key, fallback) {
        var strings = root.$exe_i18n;
        return strings && typeof strings[key] === 'string' ? strings[key] : fallback;
    }

    /** Value of a query parameter, as prettyPhoto read it (raw, not decoded). */
    function param(url, name) {
        var match = new RegExp('[?&]' + name + '=([^&#]*)').exec(url);
        return match ? match[1] : '';
    }

    function size(url, name, fallback) {
        var value = parseFloat(param(url, name));
        return value > 0 ? value : fallback;
    }

    /** True for relative URLs and http(s) URLs: the only ones allowed in an iframe. */
    function isWebUrl(url) {
        var scheme = /^\s*([a-z][a-z0-9+.-]*):/i.exec(url);
        return !scheme || /^https?$/i.test(scheme[1]);
    }

    function isScriptUrl(url) {
        return /^\s*(javascript|vbscript):/i.test(url);
    }

    function decodeTitle(title) {
        if (!title) return '';
        try {
            return decodeURIComponent(title);
        } catch (e) {
            return title;
        }
    }

    /** Seconds from a YouTube `t`/`start` value: 90, 90s, 1m30s, 1h2m3s. */
    function youtubeSeconds(value) {
        var match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(value || '');
        if (!match || !match[0]) return 0;
        return (parseInt(match[1] || 0, 10) * 60 + parseInt(match[2] || 0, 10)) * 60 + parseInt(match[3] || 0, 10);
    }

    function youtubeEmbed(href) {
        var id = param(href, 'v');
        if (!id) {
            var match = /(?:youtu\.be\/|youtube\.com\/embed\/)([^?&#/]+)/i.exec(href);
            id = match ? match[1] : '';
        }
        if (!/^[\w-]+$/.test(id)) return null;
        var src = 'https://www.youtube.com/embed/' + id + '?rel=' + (param(href, 'rel') || '1') + '&autoplay=1';
        var start = youtubeSeconds(param(href, 'start')) || youtubeSeconds(param(href, 't'));
        if (start) src += '&start=' + start;
        return src;
    }

    function vimeoEmbed(href) {
        var match = /vimeo\.com\/(?:video\/)?(\d+)/i.exec(href);
        return match ? 'https://player.vimeo.com/video/' + match[1] + '?title=0&byline=0&portrait=0&autoplay=1' : null;
    }

    function mediatecaEmbed(href) {
        var src = href.split('?')[0].split('#')[0].replace(/\/$/, '');
        return /\/fs$/.test(src) ? src : src + '/fs';
    }

    /** The page URL of an `?iframe=true` link, without the prettyPhoto parameters. */
    function iframePage(href) {
        var hashIndex = href.indexOf('#');
        var hash = hashIndex > -1 ? href.substring(hashIndex) : '';
        var base = hashIndex > -1 ? href.substring(0, hashIndex) : href;
        var queryIndex = base.indexOf('?');
        if (queryIndex === -1) return href;
        var kept = base
            .substring(queryIndex + 1)
            .split('&')
            .filter(function (pair) {
                return pair && !/^(iframe|width|height)=/i.test(pair);
            });
        return base.substring(0, queryIndex) + (kept.length ? '?' + kept.join('&') : '') + hash;
    }

    function galleryName(link) {
        var rel = link.getAttribute('rel') || '';
        return /\[.*\]/.test(rel) ? rel : null;
    }

    /**
     * What a lightbox link opens, or null when it is left as a normal link
     * (unsupported or unsafe types, a missing #target).
     */
    function getItem(link) {
        var href = link.getAttribute('href') || '';
        var item = {
            type: 'image',
            src: href,
            caption: decodeTitle(link.getAttribute('title')),
            group: galleryName(link),
        };
        var video = function (src) {
            if (!src) return null;
            item.type = 'iframe';
            item.src = src;
            item.width = size(href, 'width', DEFAULT_WIDTH);
            item.height = size(href, 'height', DEFAULT_HEIGHT);
            return item;
        };

        if (href.indexOf(MEDIATECA) === 0) return video(mediatecaEmbed(href));
        if (/youtube\.com\/watch|youtu\.be|youtube\.com\/embed/i.test(href)) return video(youtubeEmbed(href));
        if (/vimeo\.com/i.test(href)) return video(vimeoEmbed(href));
        // Browser plug-in formats prettyPhoto embedded with <object>; no browser plays them now.
        if (/\.(mov|swf)(?:[?#]|$)/i.test(href)) return null;
        if (/\biframe=true\b/i.test(href)) return isWebUrl(href) ? video(iframePage(href)) : null;
        // `ajax=true` injected a fetched page as HTML; `custom=true` had no content.
        if (/\b(ajax|custom)=true\b/i.test(href)) return null;
        if (href.charAt(0) === '#') {
            var target = href.length > 1 ? document.getElementById(decodeTitle(href.substring(1))) : null;
            if (!target) return null;
            item.type = 'html';
            item.target = target;
            return item;
        }
        if (!href || isScriptUrl(href)) return null;
        return item;
    }

    /** A copy of an inline target, ready to be moved into the lightbox by Tobii. */
    function inlineContent(item) {
        var wrapper = document.createElement('div');
        wrapper.id = 'exe-lightbox-inline-' + counter++;
        wrapper.className = 'exe-lightbox-inline';

        var copy = item.target.cloneNode(true);
        copy.removeAttribute('id');
        copy.classList.remove('js-hidden');
        // A copy is prepared for every link on each bind: only load media when shown
        // (Tobii plays it when the slide opens).
        Array.prototype.forEach.call(copy.querySelectorAll('audio, video'), function (media) {
            media.setAttribute('preload', 'none');
        });
        wrapper.appendChild(copy);

        var media = copy.querySelector('.exe-media-box-element');
        if (media) {
            var sourceEl = media.hasAttribute('src') ? media : media.querySelector('source[src]');
            var src = sourceEl ? sourceEl.getAttribute('src') : '';
            if (media.classList.contains('exe-media-box-audio')) wrapper.classList.add('with-audio');
            if (item.caption) {
                var caption = document.createElement('p');
                caption.className = 'exe-lightbox-caption';
                caption.textContent = item.caption;
                wrapper.appendChild(caption);
            }
            if (src) wrapper.appendChild(downloadLink(src));
        }
        holder.appendChild(wrapper);
        return '#' + wrapper.id;
    }

    function downloadLink(src) {
        // Extension = last dot-segment of the file name, without query string or fragment
        var fileName = src.split('/').pop().split('?')[0].split('#')[0];
        var dot = fileName.lastIndexOf('.');
        var ext = dot > -1 ? fileName.substring(dot + 1) : '';
        var label = i18n('download', 'Download');

        var p = document.createElement('p');
        p.className = 'exe-media-download';
        var a = document.createElement('a');
        a.href = src;
        a.setAttribute('download', '');
        a.title = label;
        a.textContent = ext || label;
        p.appendChild(a);
        return p;
    }

    /** The detached element Tobii reads the slide from. */
    function proxyFor(item, link) {
        var proxy = document.createElement('a');
        proxy.exeItem = item;
        if (item.caption) proxy.setAttribute('data-label', item.caption);
        if (item.type === 'image') {
            proxy.href = item.src;
            var thumb = link.querySelector('img');
            if (thumb) {
                var img = document.createElement('img');
                img.alt = thumb.getAttribute('alt') || '';
                proxy.appendChild(img);
            }
        } else if (item.type === 'iframe') {
            proxy.setAttribute('data-type', 'iframe');
            proxy.setAttribute('data-target', item.src);
            proxy.setAttribute('data-width', item.width + 'px');
            proxy.setAttribute('data-height', item.height + 'px');
        } else {
            proxy.setAttribute('data-type', 'html');
            proxy.setAttribute('data-target', inlineContent(item));
        }
        return proxy;
    }

    function isInPackageFrame() {
        var framed;
        try {
            framed = root.self !== root.top;
        } catch (e) {
            framed = true;
        }
        var body = document.body;
        return framed && (body.classList.contains('exe-scorm') || body.classList.contains('exe-ims'));
    }

    function currentItem() {
        if (!tobii || !tobii.isOpen()) return null;
        var list = groups[tobii.currentGroup()];
        return list ? list[tobii.slidesIndex()] : null;
    }

    /** The current slide (Tobii unhides it only once its content has loaded). */
    function currentSlide() {
        var slider = lightboxEl.querySelector('.tobii__slider:not([aria-hidden="true"])');
        return slider ? slider.children[tobii.slidesIndex()] || null : null;
    }

    function currentImage() {
        var slide = currentSlide();
        return slide ? slide.querySelector('figure img') : null;
    }

    /** Show the full-size button when the current image is shown smaller than it is. */
    function updateToolbar() {
        if (!fullSizeButton) return;
        var item = currentItem();
        var img = item && item.type === 'image' ? currentImage() : null;
        fullSizeButton.hidden = true;
        if (!img) return;
        if (!img.complete) {
            img.addEventListener('load', updateToolbar, { once: true });
            return;
        }
        fullSizeButton.textContent = exeLightbox.isInPackageFrame()
            ? i18n('newWindow', 'New window')
            : i18n('fullSize', 'Full size');
        fullSizeButton.hidden = !(img.naturalWidth > img.clientWidth + 1 || img.naturalHeight > img.clientHeight + 1);
    }

    function stop(event) {
        event.stopPropagation();
    }

    function createLightbox() {
        tobii = new root.Tobii({
            selector: false,
            captionText: function (el) {
                return el.exeItem ? el.exeItem.caption : '';
            },
            captionToggle: false,
            navLabel: [i18n('previous', 'Previous'), i18n('next', 'Next')],
            closeLabel: i18n('close_toolbar', 'Close'),
        });
        // Tobii appends its dialog to the body when it is created.
        lightboxEl = document.body.lastElementChild;

        fullSizeButton = document.createElement('button');
        fullSizeButton.type = 'button';
        fullSizeButton.className = 'exe-lightbox-full-size';
        fullSizeButton.hidden = true;
        // Keep Tobii's drag/swipe handling out of this button.
        fullSizeButton.addEventListener('pointerdown', stop);
        fullSizeButton.addEventListener('pointerup', stop);
        fullSizeButton.addEventListener('click', function (event) {
            event.stopPropagation();
            var img = currentImage();
            if (img) root.open(img.currentSrc || img.src || img.getAttribute('data-src'), '_blank');
        });
        lightboxEl.appendChild(fullSizeButton);

        tobii.on('open', updateToolbar);
        tobii.on('next', updateToolbar);
        tobii.on('previous', updateToolbar);
        tobii.on('close', function () {
            if (pendingBind) {
                pendingBind = false;
                bind();
            }
        });

        holder = document.createElement('div');
        holder.className = 'exe-lightbox-holder';
        holder.hidden = true;
        document.body.appendChild(holder);
    }

    function unbindLinks() {
        bound.forEach(function (entry) {
            entry.link.removeEventListener('click', entry.handler);
        });
        bound = [];
        groups = {};
    }

    /**
     * (Re)bind every `rel^="lightbox"` link of the page. Safe to call again
     * after content changes; while the lightbox is open it waits until it closes.
     */
    function bind() {
        if (typeof root.Tobii !== 'function') return;
        if (tobii && tobii.isOpen()) {
            pendingBind = true;
            return;
        }
        unbindLinks();
        if (tobii) tobii.reset();

        var links = document.querySelectorAll('a[rel^="lightbox"]');
        var galleryIds = {};
        var galleries = 0;
        var singles = 0;

        Array.prototype.forEach.call(links, function (link) {
            var item = getItem(link);
            if (!item) return;
            if (!tobii) createLightbox();

            var name;
            if (item.group) {
                if (!galleryIds[item.group]) galleryIds[item.group] = 'exe-lightbox-gallery-' + galleries++;
                name = galleryIds[item.group];
            } else {
                name = 'exe-lightbox-single-' + singles++;
            }
            if (!groups[name]) groups[name] = [];
            var index = groups[name].length;
            groups[name].push(item);

            var proxy = proxyFor(item, link);
            proxy.setAttribute('data-group', name);
            tobii.add(proxy);

            var handler = function (event) {
                event.preventDefault();
                if (tobii.isOpen()) return;
                tobii.selectGroup(name);
                tobii.open(index);
            };
            link.addEventListener('click', handler);
            bound.push({ link: link, handler: handler });
        });
    }

    /** Remove the lightbox and every binding (tests, teardown). */
    function destroy() {
        unbindLinks();
        pendingBind = false;
        if (tobii) {
            if (tobii.isOpen()) tobii.close();
            tobii.destroy();
        }
        if (holder && holder.parentNode) holder.parentNode.removeChild(holder);
        tobii = lightboxEl = holder = fullSizeButton = null;
    }

    var exeLightbox = {
        bind: bind,
        destroy: destroy,
        getItem: getItem,
        isInPackageFrame: isInPackageFrame,
        updateToolbar: updateToolbar,
        instance: function () {
            return tobii;
        },
    };

    root.exeLightbox = exeLightbox;
})(typeof window !== 'undefined' ? window : this);
