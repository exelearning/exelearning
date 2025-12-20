/**
 * Media Helper Functions
 *
 * Utility functions for processing media elements in HTML content.
 * Used to add MIME types and simplify MediaElement.js structures to native HTML5.
 */

// MIME type mappings for common media formats
export const MEDIA_MIME_TYPES: Record<string, string> = {
    // Video
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    webm: 'video/webm',
    ogg: 'video/ogg',
    ogv: 'video/ogg',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    // Audio
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    oga: 'audio/ogg',
    aac: 'audio/aac',
    flac: 'audio/flac',
};

/**
 * Extract file extension from a URL.
 * Handles query strings and paths with multiple segments.
 *
 * @param url - URL or file path
 * @returns Lowercase extension or null if not found
 */
export function getExtensionFromUrl(url: string): string | null {
    if (!url) return null;

    // Remove query string
    let path = url.split('?')[0];

    // Get the last part after /
    const lastSlash = path.lastIndexOf('/');
    if (lastSlash !== -1) {
        path = path.substring(lastSlash + 1);
    }

    // Get extension
    const dotIndex = path.lastIndexOf('.');
    if (dotIndex !== -1 && dotIndex < path.length - 1) {
        return path.substring(dotIndex + 1).toLowerCase();
    }

    return null;
}

/**
 * Check if a media element needs a type attribute.
 * Returns true if type is missing, empty, or invalid (doesn't contain /).
 *
 * @param typeAttr - Current type attribute value
 * @returns true if type needs to be set
 */
export function needsTypeAttribute(typeAttr: string | null): boolean {
    return !typeAttr || !typeAttr.includes('/');
}

/**
 * Add MIME type attributes to media elements in HTML.
 * Must be called BEFORE resolving asset URLs (while extensions are still in URLs).
 *
 * @param html - HTML content with asset:// URLs containing filenames
 * @param domParser - DOMParser instance (for browser/test compatibility)
 * @returns HTML with type attributes added to source/video/audio elements
 */
export function addMediaTypes(html: string, domParser?: DOMParser): string {
    if (!html) return html;

    const parser = domParser || new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    let modified = 0;

    // Process all source, video[src], audio[src] elements
    doc.querySelectorAll('source, video[src], audio[src]').forEach(el => {
        const currentType = el.getAttribute('type');
        if (!needsTypeAttribute(currentType)) return;

        const src = el.getAttribute('src') || '';
        const ext = getExtensionFromUrl(src);
        if (ext && MEDIA_MIME_TYPES[ext]) {
            el.setAttribute('type', MEDIA_MIME_TYPES[ext]);
            modified++;
        }
    });

    return modified > 0 ? '<!DOCTYPE html>\n' + doc.documentElement.outerHTML : html;
}

/**
 * Simplify MediaElement.js video structures to native HTML5 video.
 * Converts complex <video class="mediaelement"><source src="..."></video>
 * to simple <video src="..." controls> that browsers handle natively.
 *
 * @param html - HTML content
 * @param domParser - DOMParser instance (for browser/test compatibility)
 * @returns HTML with simplified video/audio elements
 */
export function simplifyMediaElements(html: string, domParser?: DOMParser): string {
    if (!html) return html;

    const parser = domParser || new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    let modified = 0;

    // Find all video elements with class "mediaelement" or with source children
    doc.querySelectorAll('video.mediaelement, video:has(source)').forEach(video => {
        // Get the source URL - either from <source> child or from video.src
        let src = video.getAttribute('src') || '';
        const sourceEl = video.querySelector('source');
        if (sourceEl) {
            src = sourceEl.getAttribute('src') || src;
        }

        // Skip if no source found
        if (!src) return;

        // Get type from source if available
        const type = sourceEl?.getAttribute('type') || '';

        // Preserve important attributes
        const width = video.getAttribute('width') || '';
        const height = video.getAttribute('height') || '';
        const poster = video.getAttribute('poster') || '';
        const className = (video.className || '').replace('mediaelement', '').trim();

        // Create simple video element
        const newVideo = doc.createElement('video');
        newVideo.setAttribute('src', src);
        newVideo.setAttribute('controls', '');

        if (type) newVideo.setAttribute('type', type);
        if (width) newVideo.setAttribute('width', width);
        if (height) newVideo.setAttribute('height', height);
        if (poster) newVideo.setAttribute('poster', poster);
        if (className) newVideo.className = className;

        // Style for responsive sizing
        newVideo.style.maxWidth = '100%';
        newVideo.style.height = 'auto';

        // Replace the old video with the new simple one
        video.parentNode?.replaceChild(newVideo, video);
        modified++;
    });

    // Also simplify audio elements with source children
    doc.querySelectorAll('audio:has(source)').forEach(audio => {
        let src = audio.getAttribute('src') || '';
        const sourceEl = audio.querySelector('source');
        if (sourceEl) {
            src = sourceEl.getAttribute('src') || src;
        }

        if (!src) return;

        const type = sourceEl?.getAttribute('type') || '';
        const className = audio.className || '';

        const newAudio = doc.createElement('audio');
        newAudio.setAttribute('src', src);
        newAudio.setAttribute('controls', '');

        if (type) newAudio.setAttribute('type', type);
        if (className) newAudio.className = className;

        audio.parentNode?.replaceChild(newAudio, audio);
        modified++;
    });

    return modified > 0 ? '<!DOCTYPE html>\n' + doc.documentElement.outerHTML : html;
}
