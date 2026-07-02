/**
 * Generation-time script injection for the opaque preview transports.
 *
 * The legacy Service Worker injected its helper scripts at serve time
 * (public/preview-sw.js); an opaque-origin iframe has no Service Worker, so
 * the equivalent behavior is baked into the HTML before it is uploaded (HTTP
 * transport) or rendered via srcdoc. The exporter output itself stays
 * untouched — real exports must not carry preview-only scripts.
 *
 * All injected blocks carry the marker attribute so decoration is idempotent
 * and the blocks are identifiable in tests.
 */

/** Marker attribute carried by every injected script block. */
export const INJECTED_MARKER = 'data-injected-by="eXeLearning-Preview"';

/**
 * Serialize a value for embedding inside an injected inline script. `<` is
 * escaped so attacker-controlled values (page paths come from authored
 * content) can never terminate the script block.
 * @param {*} value
 * @returns {string}
 */
function js(value) {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * Insert scripts before the LAST </body> (avoids matching inside inlined JS
 * string literals); appends when the page has no closing body tag.
 */
function injectBeforeLastBody(html, scripts) {
    const lastIndex = html.lastIndexOf('</body>');
    if (lastIndex !== -1) {
        return html.substring(0, lastIndex) + scripts + html.substring(lastIndex);
    }
    return html + scripts;
}

/**
 * Insert markup right after the opening <head> so it runs before exe_export.js
 * (which reads the teacher-mode flag during its own <head> execution). Falls
 * back to prepending when there is no <head>.
 */
function injectIntoHead(html, markup) {
    const match = html.match(/<head[^>]*>/i);
    if (match) {
        const at = match.index + match[0].length;
        return html.substring(0, at) + markup + html.substring(at);
    }
    return markup + html;
}

/**
 * Teacher-mode flag for the srcdoc transport. The editor preview always makes
 * the Teacher Mode toggle available (author = teacher); the HTTP transport
 * carries ?exe-teacher=1 in the URL, but srcdoc has no URL, so it sets a global
 * flag exe_export.js reads. Must run before exe_export.js → injected in <head>.
 */
function teacherModeFlagScript() {
    return `<script ${INJECTED_MARKER}>window.__EXE_TEACHER_MODE__ = true;</script>`;
}

/**
 * Link handling inside the opaque frame:
 * - anchors/special protocols: default behavior
 * - external links: open in a new (sandbox-inherited) tab
 * - same-document HTML pages: default navigation (http) or a NAVIGATE
 *   postMessage to the parent (srcdoc has no real URLs)
 * - PDFs and other non-HTML documents: OPEN_DOC postMessage — the trusted
 *   parent opens them (a sandboxed popup cannot render PDFs or download)
 * Images are skipped: lightbox/gallery scripts own them.
 * @param {'http'|'srcdoc'} mode
 * @param {string|null} pagePath Baked page path (srcdoc only).
 */
function buildLinkHandlerScript(mode, pagePath) {
    const pageExpr =
        mode === 'srcdoc'
            ? js(pagePath || 'index.html')
            : `(function(){var m=window.location.pathname.match(/\\/preview\\/[^/]+\\/(.*)$/);return (m&&m[1])||'index.html';})()`;
    const externalCheck =
        mode === 'srcdoc'
            ? `if (/^https?:\\/\\//i.test(href)) {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer external');
                return;
            }`
            : `var url = new URL(href, window.location.href);
            var isHttp = url.protocol === 'http:' || url.protocol === 'https:';
            if (isHttp && url.host !== window.location.host) {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer external');
                return;
            }`;
    const navigateBlock =
        mode === 'srcdoc'
            ? `e.preventDefault();
            window.parent.postMessage({ type: 'exe-preview-navigate', v: 1, href: href, page: currentPage }, '*');`
            : `// Same-host HTML page: default navigation within the session prefix.`;

    return `
<script ${INJECTED_MARKER}>
(function() {
    document.addEventListener('click', function(e) {
        var link = e.target.closest('a[href]');
        if (!link) return;
        var href = link.getAttribute('href');
        if (!href) return;

        // Allow anchors, mailto, javascript, blob, data
        if (/^(#|mailto:|javascript:|blob:|data:)/i.test(href)) return;

        var currentPage = ${pageExpr};
        try {
            ${externalCheck}

            // Non-HTML resources (PDF, documents, media): the parent opens them.
            // Skip images - they may be handled by lightbox/gallery scripts.
            var extMatch = href.match(/\\.([a-z0-9]+)(?:\\?[^#]*)?(#.*)?$/i);
            if (extMatch && !/^html?$/i.test(extMatch[1]) && !/^(jpe?g|png|gif|svg|webp|avif|ico|bmp|tiff?)$/i.test(extMatch[1])) {
                e.preventDefault();
                window.parent.postMessage({ type: 'exe-preview-open-document', v: 1, href: href, page: currentPage }, '*');
                return;
            }

            ${navigateBlock}
        } catch (err) {
            // Invalid URL: let the browser handle it.
        }
    }, true);
})();
</script>`;
}

/**
 * Report the rendered page path to the parent so auto-refresh can reload the
 * SAME page. The parent validates event.source and the payload schema.
 * @param {'http'|'srcdoc'} mode
 * @param {string|null} pagePath Baked page path (srcdoc only).
 */
function buildNavReporterScript(mode, pagePath) {
    const pageExpr =
        mode === 'srcdoc'
            ? js(pagePath || 'index.html')
            : `(function(){var m=window.location.pathname.match(/\\/preview\\/[^/]+\\/(.*)$/);return (m&&m[1])||'index.html';})()`;
    return `
<script ${INJECTED_MARKER}>
(function() {
    function report() {
        try {
            window.parent.postMessage({ type: 'exe-preview-nav', v: 1, page: ${pageExpr} }, '*');
        } catch (e) { /* no parent to report to */ }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', report);
    } else {
        report();
    }
})();
</script>`;
}

/**
 * PDF embed rendering with PDF.js (port of the Service Worker's
 * PDF_EMBED_HANDLER_SCRIPT). Browsers refuse the native PDF viewer inside an
 * opaque sandbox, so <object>/<embed>/<iframe> PDFs and
 * <div data-exe-pdf-src> placeholders render to canvases instead.
 * @param {string|null} pdfjsBase Base URL for libs/pdfjs (baked); when the
 *   module cannot load (e.g. srcdoc without CORS on the host) placeholders
 *   show a visible notice instead of failing silently.
 * @param {string} unavailableMessage User-facing fallback text.
 */
function buildPdfEmbedScript(pdfjsBase, unavailableMessage) {
    const baseAssignment = pdfjsBase ? `window.__EXE_PDFJS_BASE__ = ${js(pdfjsBase)};` : '';
    return `
<script ${INJECTED_MARKER}>
(function() {
    ${baseAssignment}
    function pdfEmbedTargets() {
        return document.querySelectorAll(
            'object[data$=".pdf"],object[data*=".pdf?"],object[data*=".pdf#"],' +
            'embed[src$=".pdf"],embed[src*=".pdf?"],embed[src*=".pdf#"],' +
            'iframe[src$=".pdf"],iframe[src*=".pdf?"],iframe[src*=".pdf#"],' +
            '[data-exe-pdf-src]'
        );
    }
    function initPdfEmbeds() {
        var embeds = pdfEmbedTargets();
        if (embeds.length === 0) return;

        var bp = window.__EXE_PDFJS_BASE__ || './';
        import(bp + 'libs/pdfjs/pdf.min.mjs').then(function(m) {
            m.GlobalWorkerOptions.workerSrc = bp + 'libs/pdfjs/pdf.worker.min.mjs';
            for (var i = 0; i < embeds.length; i++) renderPdfEmbed(m, embeds[i]);
        }).catch(function(err) {
            console.warn('[Preview] PDF.js load failed:', err);
            var msg = ${js(unavailableMessage)};
            for (var i = 0; i < embeds.length; i++) {
                var el = embeds[i];
                var note = document.createElement('div');
                note.setAttribute('data-exe-pdf-unavailable', '');
                note.style.cssText = 'padding:1rem;background:#f4f4f4;color:#555;font:14px/1.4 system-ui;text-align:center';
                note.textContent = msg;
                if (el.parentNode) el.parentNode.replaceChild(note, el);
            }
        });
    }

    function renderPdfEmbed(pdfjsLib, el) {
        var src = el.getAttribute('data-exe-pdf-src') || el.getAttribute('data') || el.getAttribute('src');
        if (!src) return;

        var container = document.createElement('div');
        var w = el.getAttribute('width') || el.style.width || '100%';
        var h = el.getAttribute('height') || el.style.height || '600px';
        if (/^\\d+$/.test(w)) w += 'px';
        if (/^\\d+$/.test(h)) h += 'px';
        container.style.cssText = 'width:' + w + ';height:' + h + ';overflow:auto;background:#525659;position:relative';
        if (el.className) container.className = el.className;
        if (el.id) container.id = el.id;

        var tb = document.createElement('div');
        tb.className = 'exe-pdf-tb';
        tb.style.cssText = 'position:sticky;top:0;z-index:10;display:none;align-items:center;gap:4px;' +
            'padding:4px 8px;background:#323232;color:#d1d1d1;font:13px/1.4 system-ui;' +
            'box-shadow:0 1px 4px rgba(0,0,0,.5);user-select:none';
        var btnCss = 'background:none;border:1px solid #555;color:#d1d1d1;padding:2px 8px;border-radius:3px;cursor:pointer;font:inherit;line-height:1.2';
        var spCss = 'width:1px;height:20px;background:#555;margin:0 2px';
        tb.innerHTML = '<button class="ep" style="' + btnCss + '" title="Previous">\\u25C0</button>' +
            '<span><span class="epn">1</span> / <span class="epc">-</span></span>' +
            '<button class="en" style="' + btnCss + '" title="Next">\\u25B6</button>' +
            '<span style="' + spCss + '"></span>' +
            '<button class="ezo" style="' + btnCss + '" title="Zoom out">\\u2212</button>' +
            '<span class="ezl">100%</span>' +
            '<button class="ezi" style="' + btnCss + '" title="Zoom in">+</button>' +
            '<button class="efw" style="' + btnCss + '" title="Fit width">\\u2194</button>';
        container.appendChild(tb);

        var pages = document.createElement('div');
        pages.style.cssText = 'display:flex;flex-direction:column;align-items:center;padding:8px 0;gap:4px';
        container.appendChild(pages);

        var loading = document.createElement('div');
        loading.textContent = 'Loading PDF\\u2026';
        loading.style.cssText = 'color:#ccc;font-family:system-ui;text-align:center;padding:1rem';
        pages.appendChild(loading);

        el.parentNode.replaceChild(container, el);

        pdfjsLib.getDocument(src).promise.then(function(pdf) {
            loading.remove();
            tb.style.display = 'flex';
            tb.querySelector('.epc').textContent = pdf.numPages;

            var uv, isc, sc, cs = [];
            pdf.getPage(1).then(function(page) {
                uv = page.getViewport({scale:1});
                isc = Math.min((container.clientWidth - 16) / uv.width, 2);
                sc = isc;
                return renderAll(sc);
            });

            function renderAll(s) {
                sc = s;
                tb.querySelector('.ezl').textContent = Math.round(s / isc * 100) + '%';
                var scrollRatio = 0;
                if (cs.length) {
                    var sh = container.scrollHeight - container.clientHeight;
                    if (sh > 0) scrollRatio = container.scrollTop / sh;
                }
                pages.innerHTML = ''; cs = [];
                var chain = Promise.resolve();
                for (var i = 1; i <= pdf.numPages; i++) {
                    (function(num) {
                        chain = chain.then(function() {
                            return pdf.getPage(num).then(function(pg) {
                                var vp = pg.getViewport({scale: s});
                                var c = document.createElement('canvas');
                                c.style.cssText = 'display:block;box-shadow:0 1px 4px rgba(0,0,0,0.3)';
                                c.width = vp.width; c.height = vp.height;
                                pages.appendChild(c); cs.push(c);
                                return pg.render({canvasContext: c.getContext('2d'), viewport: vp}).promise;
                            });
                        });
                    })(i);
                }
                return chain.then(function() {
                    var newSh = container.scrollHeight - container.clientHeight;
                    if (newSh > 0) container.scrollTop = scrollRatio * newSh;
                });
            }

            container.addEventListener('scroll', function() {
                var th = tb.offsetHeight + 8;
                for (var i = 0; i < cs.length; i++) {
                    if (cs[i].getBoundingClientRect().bottom - container.getBoundingClientRect().top > th) {
                        tb.querySelector('.epn').textContent = i + 1; break;
                    }
                }
            });
            tb.querySelector('.ep').onclick = function() {
                var n = +tb.querySelector('.epn').textContent;
                if (n > 1 && cs[n - 2]) cs[n - 2].scrollIntoView({behavior:'smooth', block:'start'});
            };
            tb.querySelector('.en').onclick = function() {
                var n = +tb.querySelector('.epn').textContent;
                if (n < pdf.numPages && cs[n]) cs[n].scrollIntoView({behavior:'smooth', block:'start'});
            };
            tb.querySelector('.ezi').onclick = function() { renderAll(sc * 1.25); };
            tb.querySelector('.ezo').onclick = function() { renderAll(sc / 1.25); };
            tb.querySelector('.efw').onclick = function() {
                renderAll(Math.min((container.clientWidth - 16) / uv.width, 2));
            };
        }).catch(function(err) {
            loading.textContent = 'Error loading PDF: ' + err.message;
            loading.style.color = '#ff6b6b';
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPdfEmbeds);
    } else {
        initPdfEmbeds();
    }
})();
</script>`;
}

/**
 * External-embed shim injection. The shim (exe_embed_shim.js) runs inside the
 * opaque preview iframe and promotes cross-origin/PDF embeds to geometry
 * placeholders that the editor-side relay overlays with the real player
 * in-place, automatically (no click). It must run before exe_media_bridge.js
 * (which checks `window.exeEmbedShim` and defers) → injected into <head>.
 * @param {{embedShimUrl?: string, embedShimSource?: string}} options
 * @returns {string} script markup, or '' when no shim is configured
 */
function embedShimScript(options) {
    if (options.embedShimUrl) {
        return `<script ${INJECTED_MARKER} src="${options.embedShimUrl}"></script>`;
    }
    if (options.embedShimSource) {
        return `<script ${INJECTED_MARKER}>${options.embedShimSource}</script>`;
    }
    return '';
}

/**
 * Decorate a generated preview page for the HTTP session transport. Runs
 * BEFORE hashing/upload so the served bytes match the manifest.
 * @param {string} html
 * @param {{pdfjsBase: string, pdfUnavailableMessage?: string, embedShimUrl?: string}} options
 * @returns {string}
 */
export function decorateForHttp(html, options) {
    if (html.includes(INJECTED_MARKER)) return html;
    const scripts =
        buildLinkHandlerScript('http', null) +
        buildNavReporterScript('http', null) +
        buildPdfEmbedScript(options.pdfjsBase, options.pdfUnavailableMessage || 'PDF preview is not available here.');
    let out = injectBeforeLastBody(html, scripts);
    const shim = embedShimScript(options);
    if (shim) out = injectIntoHead(out, shim);
    return out;
}

/**
 * Decorate a preview page for the srcdoc transport (static/embedded). Applied
 * at render time because the page path must be baked per page.
 * @param {string} html
 * @param {{pagePath: string, pdfjsBase?: string|null, pdfUnavailableMessage?: string}} options
 * @returns {string}
 */
export function decorateForSrcdoc(html, options) {
    if (html.includes(INJECTED_MARKER)) return html;
    const scripts =
        buildLinkHandlerScript('srcdoc', options.pagePath) +
        buildNavReporterScript('srcdoc', options.pagePath) +
        buildPdfEmbedScript(
            options.pdfjsBase || null,
            options.pdfUnavailableMessage || 'PDF preview is not available here.',
        );
    // Teacher-mode flag + external-embed shim go in <head> (both must run before
    // exe_export.js / exe_media_bridge.js); the rest goes before </body>.
    let out = injectIntoHead(injectBeforeLastBody(html, scripts), teacherModeFlagScript());
    const shim = embedShimScript(options);
    if (shim) out = injectIntoHead(out, shim);
    return out;
}
