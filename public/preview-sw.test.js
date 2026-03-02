/**
 * Unit tests for preview-sw.js (Preview Service Worker)
 *
 * These tests verify the functionality of the service worker that serves
 * preview content from memory for the unified preview/export system.
 */

import {
    SW_VERSION,
    MIME_TYPES,
    EXTERNAL_LINK_HANDLER_SCRIPT,
    PREVIEW_REFRESH_SCRIPT,
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
} from './preview-sw.js';

describe('Preview Service Worker', () => {
    beforeEach(() => {
        // Mock console to avoid noise
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Constants', () => {
        it('should have SW_VERSION defined', () => {
            expect(SW_VERSION).toBe('1.0.0');
        });

        it('should have MIME_TYPES with common file types', () => {
            expect(MIME_TYPES['.html']).toBe('text/html; charset=utf-8');
            expect(MIME_TYPES['.css']).toBe('text/css; charset=utf-8');
            expect(MIME_TYPES['.js']).toBe('application/javascript; charset=utf-8');
            expect(MIME_TYPES['.json']).toBe('application/json; charset=utf-8');
            expect(MIME_TYPES['.png']).toBe('image/png');
            expect(MIME_TYPES['.jpg']).toBe('image/jpeg');
            expect(MIME_TYPES['.svg']).toBe('image/svg+xml');
            expect(MIME_TYPES['.pdf']).toBe('application/pdf');
            expect(MIME_TYPES['.mp4']).toBe('video/mp4');
            expect(MIME_TYPES['.mp3']).toBe('audio/mpeg');
        });

        it('should have EXTERNAL_LINK_HANDLER_SCRIPT defined', () => {
            expect(EXTERNAL_LINK_HANDLER_SCRIPT).toContain('data-injected-by="eXeLearning-Preview"');
            expect(EXTERNAL_LINK_HANDLER_SCRIPT).toContain('closest');
            expect(EXTERNAL_LINK_HANDLER_SCRIPT).toContain('setAttribute');
            expect(EXTERNAL_LINK_HANDLER_SCRIPT).toContain('noopener noreferrer external');
            // PDF files: open URL directly (SW serves HTML wrapper for navigation)
            expect(EXTERNAL_LINK_HANDLER_SCRIPT).toContain('.pdf');
            expect(EXTERNAL_LINK_HANDLER_SCRIPT).toContain("window.open(url.href, '_blank')");
            // Non-HTML resources: fetch from SW, open as blob URL
            expect(EXTERNAL_LINK_HANDLER_SCRIPT).toContain("window.open('about:blank'");
            expect(EXTERNAL_LINK_HANDLER_SCRIPT).toContain('fetch(url.href)');
            expect(EXTERNAL_LINK_HANDLER_SCRIPT).toContain('URL.createObjectURL');
        });

        it('should have PREVIEW_REFRESH_SCRIPT defined', () => {
            expect(PREVIEW_REFRESH_SCRIPT).toContain('data-injected-by="eXeLearning-Preview"');
            expect(PREVIEW_REFRESH_SCRIPT).toContain('CONTENT_UPDATED');
            expect(PREVIEW_REFRESH_SCRIPT).toContain('window.location.reload()');
        });

        it('should have PDF_EMBED_HANDLER_SCRIPT defined', () => {
            expect(PDF_EMBED_HANDLER_SCRIPT).toContain('data-injected-by="eXeLearning-Preview"');
            // Should detect PDF embed elements
            expect(PDF_EMBED_HANDLER_SCRIPT).toContain('object[data$=".pdf"]');
            expect(PDF_EMBED_HANDLER_SCRIPT).toContain('embed[src$=".pdf"]');
            expect(PDF_EMBED_HANDLER_SCRIPT).toContain('iframe[src$=".pdf"]');
            expect(PDF_EMBED_HANDLER_SCRIPT).toContain('[data-exe-pdf-src]');
            // Should load PDF.js
            expect(PDF_EMBED_HANDLER_SCRIPT).toContain('libs/pdfjs/pdf.min.mjs');
            expect(PDF_EMBED_HANDLER_SCRIPT).toContain('libs/pdfjs/pdf.worker.min.mjs');
            // Should render to canvas
            expect(PDF_EMBED_HANDLER_SCRIPT).toContain("createElement('canvas')");
            expect(PDF_EMBED_HANDLER_SCRIPT).toContain("getContext('2d')");
            expect(PDF_EMBED_HANDLER_SCRIPT).toContain('getDocument(src)');
            // Should have toolbar with navigation, zoom, and download
            expect(PDF_EMBED_HANDLER_SCRIPT).toContain('exe-pdf-tb');
            expect(PDF_EMBED_HANDLER_SCRIPT).toContain('class="ep"');
            expect(PDF_EMBED_HANDLER_SCRIPT).toContain('class="en"');
            expect(PDF_EMBED_HANDLER_SCRIPT).toContain('class="ezi"');
            expect(PDF_EMBED_HANDLER_SCRIPT).toContain('class="ezo"');
            expect(PDF_EMBED_HANDLER_SCRIPT).toContain('class="efw"');
            expect(PDF_EMBED_HANDLER_SCRIPT).toContain('class="edl"');
            expect(PDF_EMBED_HANDLER_SCRIPT).toContain('renderAll(sc');
            expect(PDF_EMBED_HANDLER_SCRIPT).toContain('pdf.getData()');
        });
    });

    describe('getMimeType', () => {
        it('should return correct MIME type for common extensions', () => {
            expect(getMimeType('index.html')).toBe('text/html; charset=utf-8');
            expect(getMimeType('style.css')).toBe('text/css; charset=utf-8');
            expect(getMimeType('script.js')).toBe('application/javascript; charset=utf-8');
            expect(getMimeType('data.json')).toBe('application/json; charset=utf-8');
            expect(getMimeType('image.png')).toBe('image/png');
            expect(getMimeType('photo.jpg')).toBe('image/jpeg');
            expect(getMimeType('photo.jpeg')).toBe('image/jpeg');
            expect(getMimeType('icon.svg')).toBe('image/svg+xml');
            expect(getMimeType('document.pdf')).toBe('application/pdf');
            expect(getMimeType('video.mp4')).toBe('video/mp4');
            expect(getMimeType('audio.mp3')).toBe('audio/mpeg');
        });

        it('should return application/octet-stream for unknown extensions', () => {
            expect(getMimeType('unknown.xyz')).toBe('application/octet-stream');
            expect(getMimeType('file.unknown')).toBe('application/octet-stream');
            expect(getMimeType('noextension')).toBe('application/octet-stream');
        });

        it('should handle uppercase extensions', () => {
            expect(getMimeType('FILE.HTML')).toBe('text/html; charset=utf-8');
            expect(getMimeType('FILE.CSS')).toBe('text/css; charset=utf-8');
        });

        it('should handle paths with multiple dots', () => {
            expect(getMimeType('my.file.name.html')).toBe('text/html; charset=utf-8');
            expect(getMimeType('image.backup.png')).toBe('image/png');
        });

        it('should handle all supported MIME types', () => {
            expect(getMimeType('page.htm')).toBe('text/html; charset=utf-8');
            expect(getMimeType('module.mjs')).toBe('application/javascript; charset=utf-8');
            expect(getMimeType('animation.gif')).toBe('image/gif');
            expect(getMimeType('favicon.ico')).toBe('image/x-icon');
            expect(getMimeType('image.webp')).toBe('image/webp');
            expect(getMimeType('image.avif')).toBe('image/avif');
            expect(getMimeType('font.woff')).toBe('font/woff');
            expect(getMimeType('font.woff2')).toBe('font/woff2');
            expect(getMimeType('font.ttf')).toBe('font/ttf');
            expect(getMimeType('font.eot')).toBe('application/vnd.ms-fontobject');
            expect(getMimeType('font.otf')).toBe('font/otf');
            expect(getMimeType('video.webm')).toBe('video/webm');
            expect(getMimeType('audio.ogg')).toBe('audio/ogg');
            expect(getMimeType('video.ogv')).toBe('video/ogg');
            expect(getMimeType('sound.wav')).toBe('audio/wav');
            expect(getMimeType('audio.m4a')).toBe('audio/mp4');
            expect(getMimeType('video.m4v')).toBe('video/mp4');
            expect(getMimeType('data.xml')).toBe('application/xml');
            expect(getMimeType('page.xhtml')).toBe('application/xhtml+xml');
            expect(getMimeType('readme.txt')).toBe('text/plain; charset=utf-8');
            expect(getMimeType('data.csv')).toBe('text/csv; charset=utf-8');
            expect(getMimeType('archive.zip')).toBe('application/zip');
            expect(getMimeType('animation.swf')).toBe('application/x-shockwave-flash');
            expect(getMimeType('schema.dtd')).toBe('application/xml-dtd');
        });
    });

    describe('extractFilePath', () => {
        it('should extract file path from viewer URL', () => {
            expect(extractFilePath('/viewer/index.html', 0)).toBe('index.html');
            expect(extractFilePath('/viewer/html/page2.html', 0)).toBe('html/page2.html');
            expect(extractFilePath('/viewer/content/resources/image.jpg', 0)).toBe('content/resources/image.jpg');
        });

        it('should handle root path', () => {
            expect(extractFilePath('/viewer/', 0)).toBe('index.html');
            expect(extractFilePath('/viewer', 0)).toBe('index.html');
        });

        it('should remove leading slash from file path', () => {
            expect(extractFilePath('/viewer//html/page.html', 0)).toBe('html/page.html');
        });

        it('should decode URL-encoded characters', () => {
            expect(extractFilePath('/viewer/file%20with%20spaces.html', 0)).toBe('file with spaces.html');
            expect(extractFilePath('/viewer/content/%C3%A1%C3%A9%C3%AD.html', 0)).toBe('content/áéí.html');
        });

        it('should handle subdirectory installations', () => {
            expect(extractFilePath('/app/viewer/index.html', 4)).toBe('index.html');
            // /exelearning/viewer/ - indexOf returns 12 (not 13)
            expect(extractFilePath('/exelearning/viewer/html/page.html', 12)).toBe('html/page.html');
        });
    });

    describe('findFileInContent', () => {
        it('should find file by exact path', () => {
            const contentFiles = new Map([
                ['index.html', 'content1'],
                ['style.css', 'content2'],
            ]);
            expect(findFileInContent(contentFiles, 'index.html')).toBe('content1');
            expect(findFileInContent(contentFiles, 'style.css')).toBe('content2');
        });

        it('should return undefined for missing files', () => {
            const contentFiles = new Map([['index.html', 'content']]);
            expect(findFileInContent(contentFiles, 'missing.html')).toBeUndefined();
        });

        it('should try index.html for directory paths without extension', () => {
            const contentFiles = new Map([
                ['somedir/index.html', 'content'],
                ['another/index.html', 'content2'],
            ]);
            expect(findFileInContent(contentFiles, 'somedir')).toBe('content');
            expect(findFileInContent(contentFiles, 'another/')).toBe('content2');
        });

        it('should not try index.html for paths with extensions', () => {
            const contentFiles = new Map([['file.txt/index.html', 'content']]);
            expect(findFileInContent(contentFiles, 'file.txt')).toBeUndefined();
        });

        it('should find file case-insensitively', () => {
            const contentFiles = new Map([
                ['INDEX.HTML', 'content1'],
                ['Style.CSS', 'content2'],
            ]);
            expect(findFileInContent(contentFiles, 'index.html')).toBe('content1');
            expect(findFileInContent(contentFiles, 'style.css')).toBe('content2');
        });

        it('should prefer exact match over case-insensitive match', () => {
            const contentFiles = new Map([
                ['index.html', 'exact'],
                ['INDEX.HTML', 'uppercase'],
            ]);
            expect(findFileInContent(contentFiles, 'index.html')).toBe('exact');
        });
    });

    describe('convertToUint8Array', () => {
        it('should convert ArrayBuffer to Uint8Array', () => {
            const buffer = new ArrayBuffer(10);
            const result = convertToUint8Array(buffer);
            expect(result).toBeInstanceOf(Uint8Array);
            expect(result.length).toBe(10);
        });

        it('should return Uint8Array unchanged', () => {
            const arr = new Uint8Array([1, 2, 3, 4, 5]);
            const result = convertToUint8Array(arr);
            expect(result).toBe(arr);
        });

        it('should convert string to Uint8Array', () => {
            const str = 'Hello World';
            const result = convertToUint8Array(str);
            expect(result).toBeInstanceOf(Uint8Array);
            // UTF-8 encoding
            expect(new TextDecoder().decode(result)).toBe('Hello World');
        });

        it('should return unknown types as-is (fallback)', () => {
            const num = 123;
            const result = convertToUint8Array(num);
            expect(result).toBe(123);
        });
    });

    describe('injectScripts', () => {
        it('should inject scripts before </body>', () => {
            const html = '<!DOCTYPE html><html><body><p>Content</p></body></html>';
            const body = new TextEncoder().encode(html);
            const result = injectScripts(body);
            const resultHtml = new TextDecoder().decode(result);

            expect(resultHtml).toContain('data-injected-by="eXeLearning-Preview"');
            expect(resultHtml).toContain('</script>\n</body>');
        });

        it('should inject scripts before </html> if no </body>', () => {
            const html = '<!DOCTYPE html><html><p>Content</p></html>';
            const body = new TextEncoder().encode(html);
            const result = injectScripts(body);
            const resultHtml = new TextDecoder().decode(result);

            expect(resultHtml).toContain('data-injected-by="eXeLearning-Preview"');
            expect(resultHtml).toContain('</script>\n</html>');
        });

        it('should append scripts at end if no closing tags', () => {
            const html = '<!DOCTYPE html><html><body><p>Content</p>';
            const body = new TextEncoder().encode(html);
            const result = injectScripts(body);
            const resultHtml = new TextDecoder().decode(result);

            expect(resultHtml).toContain('data-injected-by="eXeLearning-Preview"');
            expect(resultHtml.trim().endsWith('</script>')).toBe(true);
        });

        it('should include external link handler by default', () => {
            const html = '<!DOCTYPE html><html><body></body></html>';
            const body = new TextEncoder().encode(html);
            const result = injectScripts(body);
            const resultHtml = new TextDecoder().decode(result);

            expect(resultHtml).toContain("closest('a[href]')");
            expect(resultHtml).toContain('setAttribute');
            expect(resultHtml).toContain('noopener noreferrer external');
            // PDF files: open URL directly (SW serves wrapper)
            expect(resultHtml).toContain('.pdf');
            expect(resultHtml).toContain("window.open(url.href, '_blank')");
            // Non-HTML resources: fetch from SW, open as blob URL
            expect(resultHtml).toContain("window.open('about:blank'");
            expect(resultHtml).toContain('fetch(url.href)');
            expect(resultHtml).toContain('URL.createObjectURL');
        });

        it('should skip external link handler when disabled', () => {
            const html = '<!DOCTYPE html><html><body></body></html>';
            const body = new TextEncoder().encode(html);
            const result = injectScripts(body, { openExternalLinksInNewWindow: false });
            const resultHtml = new TextDecoder().decode(result);

            expect(resultHtml).not.toContain("closest('a[href]')");
            expect(resultHtml).toContain('CONTENT_UPDATED'); // Should still have refresh script
        });

        it('should always include preview refresh script', () => {
            const html = '<!DOCTYPE html><html><body></body></html>';
            const body = new TextEncoder().encode(html);
            const result = injectScripts(body);
            const resultHtml = new TextDecoder().decode(result);

            expect(resultHtml).toContain('CONTENT_UPDATED');
            expect(resultHtml).toContain('window.location.reload()');
        });

        it('should always include PDF embed handler script', () => {
            const html = '<!DOCTYPE html><html><body></body></html>';
            const body = new TextEncoder().encode(html);
            const result = injectScripts(body);
            const resultHtml = new TextDecoder().decode(result);

            expect(resultHtml).toContain('initPdfEmbeds');
            expect(resultHtml).toContain('renderPdfEmbed');
            expect(resultHtml).toContain('data-exe-pdf-src');
        });

        it('should include PDF embed handler even when external links disabled', () => {
            const html = '<!DOCTYPE html><html><body></body></html>';
            const body = new TextEncoder().encode(html);
            const result = injectScripts(body, { openExternalLinksInNewWindow: false });
            const resultHtml = new TextDecoder().decode(result);

            expect(resultHtml).toContain('initPdfEmbeds');
        });

        it('should return original body on error', () => {
            // Pass an object that will cause issues during processing
            const invalidBody = { notABuffer: true };
            // This should not throw - should catch error and return original
            const result = injectScripts(invalidBody);
            expect(result).toBe(invalidBody);
        });
    });

    describe('createNotReadyResponse', () => {
        it('should return 503 status', async () => {
            const response = createNotReadyResponse();
            expect(response.status).toBe(503);
        });

        it('should return HTML content type', async () => {
            const response = createNotReadyResponse();
            expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
        });

        it('should contain user-friendly message', async () => {
            const response = createNotReadyResponse();
            const text = await response.text();
            expect(text).toContain('Preview not available');
            expect(text).toContain('open the preview panel');
        });
    });

    describe('createNotFoundResponse', () => {
        it('should return 404 status', async () => {
            const response = createNotFoundResponse('missing.html');
            expect(response.status).toBe(404);
        });

        it('should return HTML content type', async () => {
            const response = createNotFoundResponse('missing.html');
            expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
        });

        it('should include the file path in message', async () => {
            const response = createNotFoundResponse('path/to/missing.html');
            const text = await response.text();
            expect(text).toContain('File not found');
            expect(text).toContain('path/to/missing.html');
        });
    });

    describe('createSuccessResponse', () => {
        it('should return 200 status', async () => {
            const body = new Uint8Array([1, 2, 3]);
            const response = createSuccessResponse(body, 'application/octet-stream');
            expect(response.status).toBe(200);
        });

        it('should set correct Content-Type', async () => {
            const body = new Uint8Array([1, 2, 3]);
            const response = createSuccessResponse(body, 'text/html; charset=utf-8');
            expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
        });

        it('should set Cache-Control to prevent caching', async () => {
            const body = new Uint8Array([1, 2, 3]);
            const response = createSuccessResponse(body, 'text/html');
            expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
        });

        it('should set X-Served-By header', async () => {
            const body = new Uint8Array([1, 2, 3]);
            const response = createSuccessResponse(body, 'text/html');
            expect(response.headers.get('X-Served-By')).toBe('eXeLearning-Preview-SW');
        });

        it('should return the body content', async () => {
            const body = new TextEncoder().encode('Hello World');
            const response = createSuccessResponse(body, 'text/plain');
            const text = await response.text();
            expect(text).toBe('Hello World');
        });
    });

    describe('createPdfViewerResponse', () => {
        it('should return 200 status with text/html content type', async () => {
            const response = createPdfViewerResponse('content/resources/doc.pdf', '/viewer/content/resources/doc.pdf', '/');
            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
        });

        it('should contain PDF.js import with basePath', async () => {
            const response = createPdfViewerResponse('content/resources/doc.pdf', '/viewer/content/resources/doc.pdf', '/');
            const text = await response.text();
            expect(text).toContain('import("/libs/pdfjs/pdf.min.mjs")');
            expect(text).toContain('workerSrc="/libs/pdfjs/pdf.worker.min.mjs"');
        });

        it('should use window.location.href as PDF source', async () => {
            const response = createPdfViewerResponse('content/resources/doc.pdf', '/viewer/content/resources/doc.pdf', '/');
            const text = await response.text();
            expect(text).toContain('getDocument(window.location.href)');
        });

        it('should contain canvas-based rendering elements', async () => {
            const response = createPdfViewerResponse('content/resources/doc.pdf', '/viewer/content/resources/doc.pdf', '/');
            const text = await response.text();
            expect(text).toContain('id="pages"');
            expect(text).toContain('id="loading"');
            expect(text).toContain('id="error"');
            expect(text).toContain('createElement("canvas")');
            expect(text).toContain('getContext("2d")');
        });

        it('should contain toolbar with navigation, zoom, and download controls', async () => {
            const response = createPdfViewerResponse('content/resources/doc.pdf', '/viewer/content/resources/doc.pdf', '/');
            const text = await response.text();
            // Toolbar container
            expect(text).toContain('id="tb"');
            // Page navigation
            expect(text).toContain('id="prev"');
            expect(text).toContain('id="next"');
            expect(text).toContain('id="pn"');
            expect(text).toContain('id="pc"');
            // Zoom controls
            expect(text).toContain('id="zi"');
            expect(text).toContain('id="zo"');
            expect(text).toContain('id="zl"');
            expect(text).toContain('id="fw"');
            // Download button
            expect(text).toContain('id="dl"');
            // Render function
            expect(text).toContain('async function render(s)');
            // Download handler
            expect(text).toContain('pdf.getData()');
            expect(text).toContain('a.download=');
        });

        it('should include download filename from filePath', async () => {
            const response = createPdfViewerResponse('content/resources/report.pdf', '/viewer/content/resources/report.pdf', '/');
            const text = await response.text();
            expect(text).toContain('a.download="report.pdf"');
        });

        it('should not contain iframe', async () => {
            const response = createPdfViewerResponse('content/resources/doc.pdf', '/viewer/content/resources/doc.pdf', '/');
            const text = await response.text();
            expect(text).not.toContain('<iframe');
        });

        it('should derive title from filename', async () => {
            const response = createPdfViewerResponse('content/resources/my-report.pdf', '/viewer/content/resources/my-report.pdf', '/');
            const text = await response.text();
            expect(text).toContain('<title>my-report.pdf</title>');
        });

        it('should decode URL-encoded filenames in title', async () => {
            const response = createPdfViewerResponse('content/resources/my%20doc.pdf', '/viewer/content/resources/my%20doc.pdf', '/');
            const text = await response.text();
            expect(text).toContain('<title>my doc.pdf</title>');
        });

        it('should escape HTML special characters in filename', async () => {
            const response = createPdfViewerResponse('content/<script>.pdf', '/viewer/content/<script>.pdf', '/');
            const text = await response.text();
            expect(text).not.toContain('<script>.pdf</title>');
            expect(text).toContain('&lt;script&gt;.pdf</title>');
        });

        it('should use basePath for PDF.js library paths', async () => {
            const response = createPdfViewerResponse('doc.pdf', '/app/viewer/doc.pdf', '/app/');
            const text = await response.text();
            expect(text).toContain('import("/app/libs/pdfjs/pdf.min.mjs")');
            expect(text).toContain('workerSrc="/app/libs/pdfjs/pdf.worker.min.mjs"');
        });

        it('should set Cache-Control and X-Served-By headers', async () => {
            const response = createPdfViewerResponse('doc.pdf', '/viewer/doc.pdf', '/');
            expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
            expect(response.headers.get('X-Served-By')).toBe('eXeLearning-Preview-SW');
        });

        it('should use "Document" as fallback title when filename is empty', async () => {
            const response = createPdfViewerResponse('', '/viewer/', '/');
            const text = await response.text();
            expect(text).toContain('<title>Document</title>');
        });

        it('should default basePath to "/" when not provided', async () => {
            const response = createPdfViewerResponse('doc.pdf', '/viewer/doc.pdf');
            const text = await response.text();
            expect(text).toContain('import("/libs/pdfjs/pdf.min.mjs")');
        });
    });

    describe('Integration scenarios', () => {
        it('should handle complete HTML file serving flow', () => {
            const contentFiles = new Map([['index.html', '<html><body>Test</body></html>']]);
            const pathname = '/viewer/index.html';
            const viewerIndex = pathname.indexOf('/viewer/');
            const filePath = extractFilePath(pathname, viewerIndex);
            const fileData = findFileInContent(contentFiles, filePath);
            const body = convertToUint8Array(fileData);
            const mimeType = getMimeType(filePath);

            expect(filePath).toBe('index.html');
            expect(fileData).toBe('<html><body>Test</body></html>');
            expect(body).toBeInstanceOf(Uint8Array);
            expect(mimeType).toBe('text/html; charset=utf-8');
        });

        it('should handle binary file serving flow', () => {
            const pngData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header
            const contentFiles = new Map([['image.png', pngData]]);
            const pathname = '/viewer/image.png';
            const viewerIndex = pathname.indexOf('/viewer/');
            const filePath = extractFilePath(pathname, viewerIndex);
            const fileData = findFileInContent(contentFiles, filePath);
            const body = convertToUint8Array(fileData);
            const mimeType = getMimeType(filePath);

            expect(filePath).toBe('image.png');
            expect(body).toBe(pngData);
            expect(mimeType).toBe('image/png');
        });

        it('should handle nested directory path flow', () => {
            const contentFiles = new Map([['html/pages/page2.html', '<html>Page 2</html>']]);
            const pathname = '/viewer/html/pages/page2.html';
            const viewerIndex = pathname.indexOf('/viewer/');
            const filePath = extractFilePath(pathname, viewerIndex);
            const fileData = findFileInContent(contentFiles, filePath);

            expect(filePath).toBe('html/pages/page2.html');
            expect(fileData).toBe('<html>Page 2</html>');
        });
    });
});
