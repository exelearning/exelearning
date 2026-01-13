/**
 * eXeLearning Preview Service Worker
 * Serves preview content from memory, enabling unified preview/export rendering
 * Adapted from eXeViewer approach (https://github.com/exelearning/exeviewer)
 */

const SW_VERSION = '1.0.0';

// In-memory storage for preview content
let contentFiles = new Map();
let contentReady = false;

// Content options
let contentOptions = {
    openExternalLinksInNewWindow: true
};

// The base path will be determined from the registration scope
let basePath = '/';

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
    '.dtd': 'application/xml-dtd'
};

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
self.addEventListener('install', (event) => {
    console.log(`[Preview SW] Service Worker v${SW_VERSION} installing...`);
    // Skip waiting to activate immediately
    event.waitUntil(self.skipWaiting());
});

/**
 * Activate event - claim all clients immediately
 */
self.addEventListener('activate', (event) => {
    console.log(`[Preview SW] Service Worker v${SW_VERSION} activated`);
    // Claim all clients immediately
    event.waitUntil(self.clients.claim());
});

/**
 * Message event - receive content from the main application
 */
self.addEventListener('message', (event) => {
    const { type, data } = event.data || {};

    switch (type) {
        case 'SET_CONTENT':
            // Receive the complete preview content
            contentFiles.clear();
            for (const [path, buffer] of Object.entries(data.files)) {
                contentFiles.set(path, buffer);
            }
            contentReady = true;
            console.log(`[Preview SW] Content loaded: ${contentFiles.size} files`);

            // Store options
            if (data.options) {
                contentOptions = { ...contentOptions, ...data.options };
            }

            // Notify the client that content is ready
            if (event.source) {
                event.source.postMessage({
                    type: 'CONTENT_READY',
                    fileCount: contentFiles.size
                });
            }
            break;

        case 'UPDATE_FILES':
            // Update specific files (for live preview refresh)
            if (!contentReady) {
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
            console.log(`[Preview SW] Updated ${Object.keys(data.files).length} files`);

            // Notify all clients that content was updated
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'CONTENT_UPDATED',
                        updatedPaths: Object.keys(data.files)
                    });
                });
            });
            break;

        case 'CLEAR_CONTENT':
            // Clear the current content
            contentFiles.clear();
            contentReady = false;
            console.log('[Preview SW] Content cleared');

            if (event.source) {
                event.source.postMessage({
                    type: 'CONTENT_CLEARED'
                });
            }
            break;

        case 'GET_STATUS':
            // Return the current status
            const statusResponse = {
                type: 'STATUS',
                ready: contentReady,
                fileCount: contentFiles.size,
                version: SW_VERSION,
                files: Array.from(contentFiles.keys())
            };

            // Respond via MessageChannel port if available, otherwise via source
            if (event.ports && event.ports[0]) {
                event.ports[0].postMessage(statusResponse);
            } else if (event.source) {
                event.source.postMessage(statusResponse);
            }
            break;

        case 'CLAIM_CLIENTS':
            // Force claim all clients
            self.clients.claim();
            console.log('[Preview SW] Claimed all clients');
            break;

        case 'SKIP_WAITING':
            // Skip waiting for update
            self.skipWaiting();
            break;

        default:
            if (type) {
                console.warn(`[Preview SW] Unknown message type: ${type}`);
            }
    }
});

/**
 * Fetch event - intercept viewer requests and serve from memory
 */
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const pathname = url.pathname;

    // Only handle /viewer/* requests
    const viewerIndex = pathname.indexOf('/viewer/');
    if (viewerIndex !== -1) {
        event.respondWith(handleViewerRequest(pathname, viewerIndex));
        return;
    }

    // Let all other requests pass through to the network
});

/**
 * Script to inject into HTML files to handle external links
 * Opens external links in a new tab to avoid navigation issues in iframes
 */
const EXTERNAL_LINK_HANDLER_SCRIPT = `
<script data-injected-by="eXeLearning-Preview">
(function() {
    document.addEventListener('click', function(e) {
        var link = e.target.closest('a[href]');
        if (!link) return;

        var href = link.getAttribute('href');
        if (!href) return;

        // Check if it's an external link (starts with http:// or https:// and different origin)
        try {
            var url = new URL(href, window.location.href);
            var isExternal = (url.protocol === 'http:' || url.protocol === 'https:') &&
                             url.origin !== window.location.origin;

            if (isExternal) {
                e.preventDefault();
                e.stopPropagation();
                window.open(href, '_blank', 'noopener,noreferrer');
            }
        } catch (err) {
            // Invalid URL, let browser handle it
        }
    }, true);
})();
</script>
`;

/**
 * Script to handle preview refresh notifications from SW
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
        });
    }
})();
</script>
`;

/**
 * Inject scripts into HTML content
 * @param {Uint8Array} body - The HTML content as bytes
 * @returns {Uint8Array} The modified HTML content
 */
function injectScripts(body) {
    try {
        // Convert bytes to string
        const decoder = new TextDecoder('utf-8');
        let html = decoder.decode(body);

        // Prepare scripts to inject
        let scriptsToInject = '';
        if (contentOptions.openExternalLinksInNewWindow) {
            scriptsToInject += EXTERNAL_LINK_HANDLER_SCRIPT;
        }
        scriptsToInject += PREVIEW_REFRESH_SCRIPT;

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
        console.warn('[Preview SW] Failed to inject scripts:', err);
        return body;
    }
}

/**
 * Handle requests to the viewer path
 * @param {string} pathname - The request pathname
 * @param {number} viewerIndex - Index where /viewer/ starts in pathname
 * @returns {Promise<Response>} The response
 */
async function handleViewerRequest(pathname, viewerIndex) {
    // Extract the file path from the viewer URL
    // Skip past "/viewer/"
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
    filePath = decodeURIComponent(filePath);

    // Check if content is ready
    if (!contentReady || contentFiles.size === 0) {
        console.warn('[Preview SW] Content not ready yet');
        return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Preview</title></head>' +
            '<body style="font-family: system-ui; padding: 2rem; text-align: center;">' +
            '<h2>Preview not available</h2>' +
            '<p>Please open the preview panel to load content.</p>' +
            '</body></html>',
            {
                status: 503,
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            }
        );
    }

    // Look for the file in our content map
    let fileData = contentFiles.get(filePath);

    // If not found, try with index.html for directory requests
    if (!fileData && !filePath.includes('.')) {
        const indexPath = filePath.endsWith('/')
            ? filePath + 'index.html'
            : filePath + '/index.html';
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

    if (fileData) {
        const mimeType = getMimeType(filePath);

        // Convert data to Uint8Array for Response
        let body;
        if (fileData instanceof ArrayBuffer) {
            body = new Uint8Array(fileData);
        } else if (fileData instanceof Uint8Array) {
            body = fileData;
        } else if (typeof fileData === 'string') {
            // String data (for generated HTML)
            const encoder = new TextEncoder();
            body = encoder.encode(fileData);
        } else {
            // Fallback
            body = fileData;
        }

        // For HTML files, inject helper scripts
        if (mimeType.startsWith('text/html')) {
            body = injectScripts(body);
        }

        return new Response(body, {
            status: 200,
            headers: {
                'Content-Type': mimeType,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'X-Served-By': 'eXeLearning-Preview-SW'
            }
        });
    }

    // File not found
    console.warn(`[Preview SW] File not found: ${filePath}`);
    console.log('[Preview SW] Available files:', Array.from(contentFiles.keys()).slice(0, 20));

    return new Response(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Not Found</title></head>` +
        `<body style="font-family: system-ui; padding: 2rem;">` +
        `<h2>File not found</h2>` +
        `<p>The requested file was not found: <code>${filePath}</code></p>` +
        `</body></html>`,
        {
            status: 404,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        }
    );
}
