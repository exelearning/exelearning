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

// Export for testing
/* istanbul ignore else */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SW_VERSION,
        MIME_TYPES,
        EXTERNAL_LINK_HANDLER_SCRIPT,
        PREVIEW_REFRESH_SCRIPT,
        getMimeType,
        extractFilePath,
        findFileInContent,
        convertToUint8Array,
        injectScripts,
        createNotReadyResponse,
        createNotFoundResponse,
        createSuccessResponse,
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
    async function handleViewerRequest(pathname, viewerIndex) {
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
            event.respondWith(handleViewerRequest(pathname, viewerIndex));
            return;
        }

        // Let all other requests pass through to the network
    });
}
