/**
 * eXeLearning Preview Service Worker
 * Serves preview content from memory, enabling unified preview/export rendering
 * Adapted from eXeViewer approach (https://github.com/exelearning/exeviewer)
 */

const SW_VERSION = '1.0.0';

/**
 * MIME types for common file extensions
 */
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'font/otf',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'audio/ogg',
    '.ogv': 'video/ogg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.m4v': 'video/mp4',
    '.pdf': 'application/pdf',
    '.xml': 'application/xml',
    '.xhtml': 'application/xhtml+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.zip': 'application/zip',
    '.swf': 'application/x-shockwave-flash',
    '.dtd': 'application/xml-dtd',
};

/**
 * Script to inject into HTML files to handle links in the preview.
 * - Anchor/special-protocol links: allow default
 * - External links (different origin): set target="_blank" and rel attributes, let browser handle
 * - Same-origin non-HTML resources (PDF, images, etc.): fetch via SW, open as blob URL in new tab
 * - Same-origin HTML pages: allow default (page-to-page navigation)
 */
const EXTERNAL_LINK_HANDLER_SCRIPT = `
<script data-injected-by="eXeLearning-Preview">
(function() {
    document.addEventListener('click', function(e) {
        var link = e.target.closest('a[href]');
        if (!link) return;

        var href = link.getAttribute('href');
        if (!href) return;

        // Allow anchors, mailto, javascript, blob, data
        if (/^(#|mailto:|javascript:|blob:|data:)/i.test(href)) return;

        try {
            var url = new URL(href, window.location.href);
            var isExternal = (url.protocol === 'http:' || url.protocol === 'https:') &&
                             url.origin !== window.location.origin;

            if (isExternal) {
                // External link: open directly in new tab
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer external');
                return;
            }

            // PDF files: open URL directly (SW serves HTML wrapper for navigation)
            if (/\\.pdf(\\?[^#]*)?(#.*)?$/i.test(url.pathname)) {
                e.preventDefault();
                e.stopPropagation();
                window.open(url.href, '_blank');
                return;
            }

            // Non-HTML resource: open in new tab via blob URL
            // (fetch through SW which has the files in memory)
            // Skip images — they may be handled by lightbox/gallery scripts
            var extMatch = url.pathname.match(/\\.([a-z0-9]+)$/i);
            if (extMatch && !/^html?$/i.test(extMatch[1]) && !/^(jpe?g|png|gif|svg|webp|avif|ico|bmp|tiff?)$/i.test(extMatch[1])) {
                e.preventDefault();
                e.stopPropagation();
                // Extract original filename from URL path (safe decode)
                var rawFileName = url.pathname.split('/').pop() || 'download';
                var fileName = rawFileName;
                try { fileName = decodeURIComponent(rawFileName); } catch (err) { fileName = rawFileName; }
                // Fetch from iframe context (intercepted by SW)
                fetch(url.href).then(function(r) {
                    if (!r.ok) throw new Error(r.status);
                    return r.blob();
                }).then(function(blob) {
                    var blobUrl = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 60000);
                }).catch(function() {
                    // Fallback: navigate to original URL
                    window.open(url.href, '_blank');
                });
                return;
            }

            // Same-origin HTML page: allow default navigation
        } catch (err) {
            // Invalid URL, let browser handle it
        }
    }, true);
})();
</script>
`;

/**
 * Script to handle preview refresh notifications from SW.
 * Also handles CONTENT_NEEDED: when the SW loses content, this relays
 * the event to the main window via BroadcastChannel so it can regenerate.
 */
const PREVIEW_REFRESH_SCRIPT = `
<script data-injected-by="eXeLearning-Preview">
(function() {
    if (navigator.serviceWorker) {
        navigator.serviceWorker.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'CONTENT_UPDATED') {
                // Check if current page was updated
                var currentPath = window.location.pathname.replace(/^\\/viewer\\//, '');
                if (!currentPath || currentPath === '/') currentPath = 'index.html';

                var updatedPaths = event.data.updatedPaths || [];
                if (updatedPaths.includes(currentPath) || updatedPaths.length === 0) {
                    // Reload the current page
                    window.location.reload();
                }
            }
            if (event.data && event.data.type === 'CONTENT_NEEDED') {
                // SW lost its content — relay to main window via BroadcastChannel
                try {
                    var ch = new BroadcastChannel('exe-preview-recovery');
                    ch.postMessage({ type: 'PREVIEW_CONTENT_LOST' });
                    ch.close();
                } catch (e) { /* BroadcastChannel not supported */ }
            }
        });
    }
})();
</script>
`;

/**
 * Script to keep the Service Worker alive by periodically pinging it.
 * Only pings when the viewer page is visible. Stops when hidden.
 * Cleans up on beforeunload.
 */
const KEEPALIVE_SCRIPT = `
<script data-injected-by="eXeLearning-Preview">
(function() {
    var timer = null;
    var INTERVAL = 20000; // 20 seconds

    function ping() {
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'GET_STATUS' });
        }
    }

    function start() {
        if (!timer) {
            timer = setInterval(ping, INTERVAL);
            ping(); // immediate first ping
        }
    }

    function stop() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    // Start only when visible
    if (!document.hidden) start();

    document.addEventListener('visibilitychange', function() {
        if (document.hidden) { stop(); } else { start(); }
    });

    window.addEventListener('beforeunload', stop);
})();
</script>
`;

/**
 * Get MIME type based on file extension
 * @param {string} filename - Name of the file
 * @returns {string} MIME type
 */
function getMimeType(filename) {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Extract file path from viewer URL
 * @param {string} pathname - The URL pathname
 * @param {number} viewerIndex - Index where /viewer/ starts
 * @returns {string} The extracted file path
 */
function extractFilePath(pathname, viewerIndex) {
    let filePath = pathname.substring(viewerIndex + 8);

    // Handle root path
    if (filePath === '' || filePath === '/') {
        filePath = 'index.html';
    }

    // Remove leading slash if present
    if (filePath.startsWith('/')) {
        filePath = filePath.substring(1);
    }

    // Decode URL-encoded characters
    return decodeURIComponent(filePath);
}

/**
 * Find file in content map with fallbacks
 * @param {Map} contentFiles - Map of file paths to content
 * @param {string} filePath - The file path to find
 * @returns {*} The file data or undefined
 */
function findFileInContent(contentFiles, filePath) {
    // Direct lookup
    let fileData = contentFiles.get(filePath);

    // If not found, try with index.html for directory requests
    if (!fileData && !filePath.includes('.')) {
        const indexPath = filePath.endsWith('/') ? filePath + 'index.html' : filePath + '/index.html';
        fileData = contentFiles.get(indexPath);
    }

    // Also try case-insensitive search (Windows compatibility)
    if (!fileData) {
        for (const [key, value] of contentFiles) {
            if (key.toLowerCase() === filePath.toLowerCase()) {
                fileData = value;
                break;
            }
        }
    }

    return fileData;
}

/**
 * Convert file data to Uint8Array for Response
 * @param {*} fileData - The file data (ArrayBuffer, Uint8Array, or string)
 * @returns {Uint8Array} The data as Uint8Array
 */
function convertToUint8Array(fileData) {
    if (fileData instanceof ArrayBuffer) {
        return new Uint8Array(fileData);
    }
    if (fileData instanceof Uint8Array) {
        return fileData;
    }
    if (typeof fileData === 'string') {
        const encoder = new TextEncoder();
        return encoder.encode(fileData);
    }
    // Fallback
    return fileData;
}

/**
 * Script to replace embedded PDF elements (<object>, <embed>, <iframe>) with PDF.js
 * canvas-based renderers. Chrome blocks PDFium for ALL Service Worker-served content,
 * including inline embeds. This script detects PDF embeds on page load and renders
 * them using PDF.js instead.
 *
 * Also handles blob URL mode placeholders: <div data-exe-pdf-src="blob:...">
 * (created by PreviewPanelManager._replacePdfEmbedsForBlob).
 */
const PDF_EMBED_HANDLER_SCRIPT = `
<script data-injected-by="eXeLearning-Preview">
(function() {
    function initPdfEmbeds() {
        var embeds = document.querySelectorAll(
            'object[data$=".pdf"],object[data*=".pdf?"],object[data*=".pdf#"],' +
            'embed[src$=".pdf"],embed[src*=".pdf?"],embed[src*=".pdf#"],' +
            'iframe[src$=".pdf"],iframe[src*=".pdf?"],iframe[src*=".pdf#"],' +
            '[data-exe-pdf-src]'
        );
        if (embeds.length === 0) return;

        var bp = window.__EXE_PDFJS_BASE__ || (function() {
            var vi = window.location.pathname.indexOf('/viewer/');
            return vi >= 0 ? window.location.pathname.substring(0, vi) + '/' : '/';
        })();

        import(bp + 'libs/pdfjs/pdf.min.mjs').then(function(m) {
            m.GlobalWorkerOptions.workerSrc = bp + 'libs/pdfjs/pdf.worker.min.mjs';
            for (var i = 0; i < embeds.length; i++) renderPdfEmbed(m, embeds[i]);
        }).catch(function(err) {
            console.warn('[Preview] PDF.js load failed:', err);
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
            '<button class="efw" style="' + btnCss + '" title="Fit width">\\u2194</button>' +
            '<span style="' + spCss + '"></span>' +
            '<button class="edl" style="' + btnCss + '" title="Download">\\u2913</button>';
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

            var fp, uv, isc, sc, cs = [];
            pdf.getPage(1).then(function(page) {
                fp = page; uv = page.getViewport({scale:1});
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
            tb.querySelector('.edl').onclick = function() {
                pdf.getData().then(function(d) {
                    var b = new Blob([d], {type:'application/pdf'});
                    var u = URL.createObjectURL(b);
                    var a = document.createElement('a');
                    a.href = u;
                    var name = decodeURIComponent((src.split('/').pop() || 'document.pdf').split('?')[0].split('#')[0]);
                    a.download = name;
                    a.click();
                    setTimeout(function() { URL.revokeObjectURL(u); }, 60000);
                });
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
</script>
`;

/**
 * Inject scripts into HTML content
 * @param {Uint8Array} body - The HTML content as bytes
 * @param {Object} options - Content options
 * @returns {Uint8Array} The modified HTML content
 */
function injectScripts(body, options = { openExternalLinksInNewWindow: true }) {
    try {
        // Convert bytes to string
        const decoder = new TextDecoder('utf-8');
        let html = decoder.decode(body);

        // Prepare scripts to inject
        let scriptsToInject = '';
        if (options.openExternalLinksInNewWindow) {
            scriptsToInject += EXTERNAL_LINK_HANDLER_SCRIPT;
        }
        scriptsToInject += PREVIEW_REFRESH_SCRIPT;
        scriptsToInject += KEEPALIVE_SCRIPT;
        scriptsToInject += PDF_EMBED_HANDLER_SCRIPT;

        // Find insertion point (before </body> or </html>)
        const bodyCloseIndex = html.lastIndexOf('</body>');
        const htmlCloseIndex = html.lastIndexOf('</html>');

        let insertIndex = -1;
        if (bodyCloseIndex !== -1) {
            insertIndex = bodyCloseIndex;
        } else if (htmlCloseIndex !== -1) {
            insertIndex = htmlCloseIndex;
        }

        if (insertIndex !== -1) {
            html = html.substring(0, insertIndex) + scriptsToInject + html.substring(insertIndex);
        } else {
            // No closing tag found, append at the end
            html += scriptsToInject;
        }

        // Convert back to bytes
        const encoder = new TextEncoder();
        return encoder.encode(html);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[Preview SW] Failed to inject scripts:', err);
        return body;
    }
}

/**
 * Create a not-ready response
 * @returns {Response} 503 Service Unavailable response
 */
function createNotReadyResponse() {
    return new Response(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Preview</title></head>' +
            '<body style="font-family: system-ui; padding: 2rem; text-align: center;">' +
            '<h2>Preview not available</h2>' +
            '<p>Please open the preview panel to load content.</p>' +
            '<script>' +
            // Ask the main window to resend content via BroadcastChannel
            'try{var ch=new BroadcastChannel("exe-preview-recovery");' +
            'ch.postMessage({type:"PREVIEW_CONTENT_LOST"});ch.close();}catch(e){}' +
            // Auto-reload when SW gets content back (CONTENT_UPDATED)
            'if(navigator.serviceWorker){' +
            'navigator.serviceWorker.addEventListener("message",function(e){' +
            'if(e.data&&e.data.type==="CONTENT_UPDATED"){window.location.reload();}' +
            '});}' +
            '</script>' +
            '</body></html>',
        {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        },
    );
}

/**
 * Create a not-found response
 * @param {string} filePath - The file path that was not found
 * @returns {Response} 404 Not Found response
 */
function createNotFoundResponse(filePath) {
    return new Response(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Not Found</title></head>` +
            `<body style="font-family: system-ui; padding: 2rem;">` +
            `<h2>File not found</h2>` +
            `<p>The requested file was not found: <code>${filePath}</code></p>` +
            `</body></html>`,
        {
            status: 404,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        },
    );
}

/**
 * Create a success response
 * @param {Uint8Array} body - The response body
 * @param {string} mimeType - The content type
 * @returns {Response} 200 OK response
 */
function createSuccessResponse(body, mimeType) {
    return new Response(body, {
        status: 200,
        headers: {
            'Content-Type': mimeType,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'X-Served-By': 'eXeLearning-Preview-SW',
        },
    });
}

/**
 * Create an HTML viewer response for PDF files using PDF.js.
 * Chrome blocks its built-in PDF viewer (PDFium) for ALL Service Worker-served PDF
 * content (top-level, iframe, embed, object). This viewer uses PDF.js to parse and
 * render each page to <canvas> elements, bypassing Chrome's SW-PDF restrictions entirely.
 *
 * The viewer loads pdf.min.mjs from the network (not SW-intercepted) and uses
 * window.location.href as the PDF source. When PDF.js fetches it, the SW intercepts
 * the request as a regular fetch (destination ''), serving raw PDF bytes — no loop.
 *
 * @param {string} filePath - The file path used to derive the document title
 * @param {string} pathname - The full request pathname (used for title fallback)
 * @param {string} basePath - The base path prefix for loading PDF.js library files
 * @returns {Response} HTML response with PDF.js canvas-based viewer
 */
function createPdfViewerResponse(filePath, pathname, basePath) {
    const rawName = decodeURIComponent(filePath.split('/').pop() || 'Document');
    const fileName = rawName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const dlName = rawName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const safeBasePath = (basePath || '/').replace(/"/g, '&quot;');
    const html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
        '<title>' + fileName + '</title>' +
        '<style>' +
        '*{margin:0;padding:0;box-sizing:border-box}' +
        'body{background:#474747}' +
        '#tb{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:4px;' +
        'padding:4px 8px;background:#323232;color:#d1d1d1;font:13px/1.4 system-ui;' +
        'box-shadow:0 1px 4px rgba(0,0,0,.5);user-select:none}' +
        '#tb button{background:none;border:1px solid #555;color:#d1d1d1;' +
        'padding:2px 8px;border-radius:3px;cursor:pointer;font:inherit;line-height:1.2}' +
        '#tb button:hover{background:#444;border-color:#777}' +
        '#tb .sp{width:1px;height:20px;background:#555;margin:0 2px}' +
        '#pages{display:flex;flex-direction:column;align-items:center;padding:16px 0;gap:8px}' +
        'canvas{display:block;box-shadow:0 2px 8px rgba(0,0,0,0.4)}' +
        '#loading{color:#ccc;font-family:system-ui;text-align:center;padding:2rem;font-size:1.1rem}' +
        '#error{color:#ff6b6b;font-family:system-ui;text-align:center;padding:2rem;display:none}' +
        '</style></head><body>' +
        '<div id="tb" style="display:none">' +
        '<button id="prev" title="Previous">\u25C0</button>' +
        '<span><span id="pn">1</span> / <span id="pc">-</span></span>' +
        '<button id="next" title="Next">\u25B6</button>' +
        '<span class="sp"></span>' +
        '<button id="zo" title="Zoom out">\u2212</button>' +
        '<span id="zl">100%</span>' +
        '<button id="zi" title="Zoom in">+</button>' +
        '<button id="fw" title="Fit width">\u2194</button>' +
        '<span class="sp"></span>' +
        '<button id="dl" title="Download">\u2913</button>' +
        '</div>' +
        '<div id="loading">Loading PDF\u2026</div>' +
        '<div id="pages"></div>' +
        '<div id="error"></div>' +
        '<script type="module">' +
        'try{' +
        'var m=await import("' + safeBasePath + 'libs/pdfjs/pdf.min.mjs");' +
        'm.GlobalWorkerOptions.workerSrc="' + safeBasePath + 'libs/pdfjs/pdf.worker.min.mjs";' +
        'var pdf=await m.getDocument(window.location.href).promise;' +
        'document.getElementById("loading").style.display="none";' +
        'var tb=document.getElementById("tb");tb.style.display="flex";' +
        'document.getElementById("pc").textContent=pdf.numPages;' +
        'var fp=await pdf.getPage(1);var uv=fp.getViewport({scale:1});' +
        'var isc=Math.min((window.innerWidth-32)/uv.width,2);var sc=isc;' +
        'var pgs=document.getElementById("pages");var cs=[];' +
        'async function render(s){sc=s;' +
        'document.getElementById("zl").textContent=Math.round(s/isc*100)+"%";' +
        'var scrollRatio=0;if(cs.length){' +
        'var st=document.documentElement.scrollTop||document.body.scrollTop;' +
        'var sh=document.documentElement.scrollHeight-window.innerHeight;' +
        'if(sh>0)scrollRatio=st/sh;}' +
        'pgs.innerHTML="";cs=[];' +
        'for(var i=1;i<=pdf.numPages;i++){var pg=await pdf.getPage(i);' +
        'var vp=pg.getViewport({scale:s});' +
        'var c=document.createElement("canvas");c.width=vp.width;c.height=vp.height;' +
        'pgs.appendChild(c);cs.push(c);' +
        'await pg.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;}' +
        'var newSh=document.documentElement.scrollHeight-window.innerHeight;' +
        'if(newSh>0)window.scrollTo(0,scrollRatio*newSh);}' +
        'await render(sc);' +
        'window.addEventListener("scroll",function(){var th=tb.offsetHeight+10;' +
        'for(var i=0;i<cs.length;i++){if(cs[i].getBoundingClientRect().bottom>th){' +
        'document.getElementById("pn").textContent=i+1;break;}}});' +
        'document.getElementById("prev").onclick=function(){' +
        'var n=+document.getElementById("pn").textContent;' +
        'if(n>1&&cs[n-2])cs[n-2].scrollIntoView({behavior:"smooth"})};' +
        'document.getElementById("next").onclick=function(){' +
        'var n=+document.getElementById("pn").textContent;' +
        'if(n<pdf.numPages&&cs[n])cs[n].scrollIntoView({behavior:"smooth"})};' +
        'document.getElementById("zi").onclick=function(){render(sc*1.25)};' +
        'document.getElementById("zo").onclick=function(){render(sc/1.25)};' +
        'document.getElementById("fw").onclick=function(){' +
        'render(Math.min((window.innerWidth-32)/uv.width,2))};' +
        'document.getElementById("dl").onclick=async function(){' +
        'var d=await pdf.getData();var b=new Blob([d],{type:"application/pdf"});' +
        'var u=URL.createObjectURL(b);var a=document.createElement("a");' +
        'a.href=u;a.download="' + dlName + '";a.click();' +
        'setTimeout(function(){URL.revokeObjectURL(u)},60000)};' +
        '}catch(e){' +
        'document.getElementById("loading").style.display="none";' +
        'var el=document.getElementById("error");' +
        'el.style.display="block";' +
        'el.textContent="Error loading PDF: "+e.message;' +
        '}' +
        '</script></body></html>';
    return new Response(html, {
        status: 200,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'X-Served-By': 'eXeLearning-Preview-SW',
        },
    });
}

// Export for testing
/* istanbul ignore else */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SW_VERSION,
        MIME_TYPES,
        EXTERNAL_LINK_HANDLER_SCRIPT,
        PREVIEW_REFRESH_SCRIPT,
        KEEPALIVE_SCRIPT,
        PDF_EMBED_HANDLER_SCRIPT,
        getMimeType,
        extractFilePath,
        findFileInContent,
        convertToUint8Array,
        injectScripts,
        createNotReadyResponse,
        createNotFoundResponse,
        createSuccessResponse,
        createPdfViewerResponse,
    };
}

// Service Worker runtime code (only runs in SW context)
/* istanbul ignore next */
if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
    // In-memory storage for preview content
    let contentFiles = new Map();
    let contentReady = false;

    // Content options
    let contentOptions = {
        openExternalLinksInNewWindow: true,
    };

    // The base path will be determined from the registration scope
    let basePath = '/';

    /**
     * Get the viewer path prefix based on the registration scope
     * @returns {string} The viewer path prefix
     */
    function getViewerPathPrefix() {
        try {
            const scopeUrl = new URL(self.registration.scope);
            basePath = scopeUrl.pathname;
            if (!basePath.endsWith('/')) {
                basePath += '/';
            }
        } catch (e) {
            basePath = '/';
        }
        return basePath + 'viewer/';
    }

    /**
     * Install event - skip waiting to activate immediately
     */
    self.addEventListener('install', event => {
        // eslint-disable-next-line no-console
        console.log(`[Preview SW] Service Worker v${SW_VERSION} installing...`);
        // Skip waiting to activate immediately
        event.waitUntil(self.skipWaiting());
    });

    /**
     * Activate event - claim all clients immediately
     */
    self.addEventListener('activate', event => {
        // eslint-disable-next-line no-console
        console.log(`[Preview SW] Service Worker v${SW_VERSION} activated`);
        // Claim all clients immediately
        event.waitUntil(self.clients.claim());
    });

    /**
     * Message event - receive content from the main application
     */
    self.addEventListener('message', event => {
        const { type, data } = event.data || {};

        switch (type) {
            case 'SET_CONTENT':
                // Receive the complete preview content
                contentFiles.clear();
                for (const [path, buffer] of Object.entries(data.files)) {
                    contentFiles.set(path, buffer);
                }
                contentReady = true;
                // eslint-disable-next-line no-console
                console.log(`[Preview SW] Content loaded: ${contentFiles.size} files`);

                // Store options
                if (data.options) {
                    contentOptions = { ...contentOptions, ...data.options };
                }

                // Notify the client that content is ready
                // Use MessageChannel port if available (required for incognito mode)
                const responseTarget = (event.ports && event.ports[0]) ? event.ports[0] : event.source;
                if (responseTarget) {
                    responseTarget.postMessage({
                        type: 'CONTENT_READY',
                        fileCount: contentFiles.size,
                    });
                }

                // Broadcast CONTENT_UPDATED to all clients (needed for popup recovery)
                // When content is restored after SW termination, other clients (e.g. popup
                // windows showing the 503 page) need to know content is available again.
                self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'CONTENT_UPDATED',
                            updatedPaths: Object.keys(data.files),
                        });
                    });
                });
                break;

            case 'UPDATE_FILES':
                // Update specific files (for live preview refresh)
                if (!contentReady) {
                    // eslint-disable-next-line no-console
                    console.warn('[Preview SW] Cannot update files - no content loaded');
                    break;
                }

                for (const [path, buffer] of Object.entries(data.files)) {
                    if (buffer === null) {
                        // null means delete the file
                        contentFiles.delete(path);
                    } else {
                        contentFiles.set(path, buffer);
                    }
                }
                // eslint-disable-next-line no-console
                console.log(`[Preview SW] Updated ${Object.keys(data.files).length} files`);

                // Notify all clients that content was updated
                self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'CONTENT_UPDATED',
                            updatedPaths: Object.keys(data.files),
                        });
                    });
                });
                break;

            case 'CLEAR_CONTENT':
                // Clear the current content
                contentFiles.clear();
                contentReady = false;
                // eslint-disable-next-line no-console
                console.log('[Preview SW] Content cleared');

                // Use MessageChannel port if available (required for incognito mode)
                const clearResponseTarget = (event.ports && event.ports[0]) ? event.ports[0] : event.source;
                if (clearResponseTarget) {
                    clearResponseTarget.postMessage({
                        type: 'CONTENT_CLEARED',
                    });
                }
                break;

            case 'VERIFY_READY': {
                // Explicit verification that content is ready to be served
                // This handles Firefox's stricter event timing between messages and fetch
                // Use MessageChannel port if available (required for incognito mode)
                const verifyResponseTarget = (event.ports && event.ports[0]) ? event.ports[0] : event.source;
                if (verifyResponseTarget) {
                    verifyResponseTarget.postMessage({
                        type: 'READY_VERIFIED',
                        ready: contentReady && contentFiles.size > 0,
                        fileCount: contentFiles.size,
                    });
                }
                break;
            }

            case 'GET_STATUS': {
                // Return the current status
                const statusResponse = {
                    type: 'STATUS',
                    ready: contentReady,
                    fileCount: contentFiles.size,
                    version: SW_VERSION,
                    files: Array.from(contentFiles.keys()),
                };

                // Respond via MessageChannel port if available, otherwise via source
                if (event.ports && event.ports[0]) {
                    event.ports[0].postMessage(statusResponse);
                } else if (event.source) {
                    event.source.postMessage(statusResponse);
                }
                break;
            }

            case 'CLAIM_CLIENTS':
                // Force claim all clients and notify when done
                self.clients.claim().then(() => {
                    // eslint-disable-next-line no-console
                    console.log('[Preview SW] Claimed all clients');
                    if (event.source) {
                        event.source.postMessage({ type: 'CLIENTS_CLAIMED' });
                    }
                });
                break;

            case 'SKIP_WAITING':
                // Skip waiting for update
                self.skipWaiting();
                break;

            default:
                if (type) {
                    // eslint-disable-next-line no-console
                    console.warn(`[Preview SW] Unknown message type: ${type}`);
                }
        }
    });

    // Track if we've already requested content refresh (to avoid spamming)
    let contentRefreshRequested = false;
    let contentRefreshRequestTime = 0;
    const CONTENT_REFRESH_DEBOUNCE = 2000; // 2 seconds

    /**
     * Notify clients that content is needed
     * This is called when a viewer request comes in but content is not loaded
     */
    async function requestContentRefresh() {
        const now = Date.now();
        // Debounce content refresh requests
        if (contentRefreshRequested && (now - contentRefreshRequestTime) < CONTENT_REFRESH_DEBOUNCE) {
            return;
        }

        contentRefreshRequested = true;
        contentRefreshRequestTime = now;

        try {
            const clients = await self.clients.matchAll({ type: 'window' });
            // eslint-disable-next-line no-console
            console.log(`[Preview SW] Requesting content refresh from ${clients.length} client(s)`);

            for (const client of clients) {
                client.postMessage({
                    type: 'CONTENT_NEEDED',
                    reason: 'Service Worker restarted or content lost',
                });
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('[Preview SW] Failed to request content refresh:', err);
        }
    }

    /**
     * Handle requests to the viewer path
     * @param {string} pathname - The request pathname
     * @param {number} viewerIndex - Index where /viewer/ starts in pathname
     * @returns {Promise<Response>} The response
     */
    async function handleViewerRequest(pathname, viewerIndex, request) {
        const filePath = extractFilePath(pathname, viewerIndex);

        // Check if content is ready
        if (!contentReady || contentFiles.size === 0) {
            // eslint-disable-next-line no-console
            console.warn('[Preview SW] Content not ready yet');
            // Request content refresh from clients
            requestContentRefresh();
            return createNotReadyResponse();
        }

        // Reset refresh request flag since we have content
        contentRefreshRequested = false;

        // Look for the file in our content map
        const fileData = findFileInContent(contentFiles, filePath);

        if (fileData) {
            const mimeType = getMimeType(filePath);

            // PDF top-level navigation: serve PDF.js viewer HTML
            // Chrome blocks PDFium for ALL SW-served PDFs. PDF.js renders to canvas instead.
            // The viewer fetches the PDF via window.location.href (destination ''), so SW serves raw bytes.
            if (mimeType === 'application/pdf' && request && request.destination === 'document') {
                const swBasePath = pathname.substring(0, viewerIndex) + '/';
                return createPdfViewerResponse(filePath, pathname, swBasePath);
            }

            let body = convertToUint8Array(fileData);

            // For HTML files, inject helper scripts
            if (mimeType.startsWith('text/html')) {
                body = injectScripts(body, contentOptions);
            }

            return createSuccessResponse(body, mimeType);
        }

        // File not found
        // eslint-disable-next-line no-console
        console.warn(`[Preview SW] File not found: ${filePath}`);
        // eslint-disable-next-line no-console
        console.log('[Preview SW] Available files:', Array.from(contentFiles.keys()).slice(0, 20));

        return createNotFoundResponse(filePath);
    }

    /**
     * Fetch event - intercept viewer requests and serve from memory
     */
    self.addEventListener('fetch', event => {
        const url = new URL(event.request.url);
        const pathname = url.pathname;

        // Only handle /viewer/* requests
        const viewerIndex = pathname.indexOf('/viewer/');
        if (viewerIndex !== -1) {
            event.respondWith(handleViewerRequest(pathname, viewerIndex, event.request));
            return;
        }

        // Let all other requests pass through to the network
    });
}
