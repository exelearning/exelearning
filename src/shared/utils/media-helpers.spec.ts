/**
 * Media Helper Functions - Unit Tests
 */

import { describe, expect, it, beforeAll } from 'bun:test';
import { Window } from 'happy-dom';
import {
    getExtensionFromUrl,
    needsTypeAttribute,
    addMediaTypes,
    simplifyMediaElements,
    MEDIA_MIME_TYPES,
} from './media-helpers';

// Setup global DOMParser for tests
let domParser: DOMParser;

beforeAll(() => {
    const window = new Window();
    domParser = new window.DOMParser();
});

describe('MEDIA_MIME_TYPES', () => {
    it('should contain common video formats', () => {
        expect(MEDIA_MIME_TYPES.mp4).toBe('video/mp4');
        expect(MEDIA_MIME_TYPES.m4v).toBe('video/mp4');
        expect(MEDIA_MIME_TYPES.webm).toBe('video/webm');
        expect(MEDIA_MIME_TYPES.ogg).toBe('video/ogg');
        expect(MEDIA_MIME_TYPES.ogv).toBe('video/ogg');
        expect(MEDIA_MIME_TYPES.mov).toBe('video/quicktime');
    });

    it('should contain common audio formats', () => {
        expect(MEDIA_MIME_TYPES.mp3).toBe('audio/mpeg');
        expect(MEDIA_MIME_TYPES.m4a).toBe('audio/mp4');
        expect(MEDIA_MIME_TYPES.wav).toBe('audio/wav');
        expect(MEDIA_MIME_TYPES.oga).toBe('audio/ogg');
        expect(MEDIA_MIME_TYPES.aac).toBe('audio/aac');
        expect(MEDIA_MIME_TYPES.flac).toBe('audio/flac');
    });
});

describe('getExtensionFromUrl', () => {
    it('should return null for empty input', () => {
        expect(getExtensionFromUrl('')).toBeNull();
        expect(getExtensionFromUrl(null as unknown as string)).toBeNull();
    });

    it('should extract extension from simple filename', () => {
        expect(getExtensionFromUrl('video.mp4')).toBe('mp4');
        expect(getExtensionFromUrl('audio.mp3')).toBe('mp3');
    });

    it('should extract extension from URL path', () => {
        expect(getExtensionFromUrl('/path/to/video.m4v')).toBe('m4v');
        expect(getExtensionFromUrl('asset://uuid/filename.webm')).toBe('webm');
    });

    it('should extract extension from full URL', () => {
        expect(getExtensionFromUrl('https://example.com/media/video.mp4')).toBe('mp4');
        expect(getExtensionFromUrl('http://localhost:3000/assets/audio.wav')).toBe('wav');
    });

    it('should handle query strings', () => {
        expect(getExtensionFromUrl('video.mp4?v=123')).toBe('mp4');
        expect(getExtensionFromUrl('https://example.com/video.m4v?token=abc&t=10')).toBe('m4v');
    });

    it('should return lowercase extension', () => {
        expect(getExtensionFromUrl('VIDEO.MP4')).toBe('mp4');
        expect(getExtensionFromUrl('Audio.M4A')).toBe('m4a');
    });

    it('should return null for URL without extension', () => {
        expect(getExtensionFromUrl('/path/to/file')).toBeNull();
        expect(getExtensionFromUrl('blob:https://example.com/abc123')).toBeNull();
    });

    it('should handle multiple dots in filename', () => {
        expect(getExtensionFromUrl('my.video.file.mp4')).toBe('mp4');
        expect(getExtensionFromUrl('version.1.2.3.m4v')).toBe('m4v');
    });
});

describe('needsTypeAttribute', () => {
    it('should return true for null', () => {
        expect(needsTypeAttribute(null)).toBe(true);
    });

    it('should return true for empty string', () => {
        expect(needsTypeAttribute('')).toBe(true);
    });

    it('should return true for invalid type (no slash)', () => {
        expect(needsTypeAttribute('mp4')).toBe(true);
        expect(needsTypeAttribute('video')).toBe(true);
    });

    it('should return false for valid MIME type', () => {
        expect(needsTypeAttribute('video/mp4')).toBe(false);
        expect(needsTypeAttribute('audio/mpeg')).toBe(false);
        expect(needsTypeAttribute('video/webm; codecs="vp8, vorbis"')).toBe(false);
    });
});

describe('addMediaTypes', () => {
    it('should return empty/null input unchanged', () => {
        expect(addMediaTypes('')).toBe('');
        expect(addMediaTypes(null as unknown as string)).toBe(null);
    });

    it('should add type to source element without type', () => {
        const html = '<video><source src="asset://uuid/video.mp4"></video>';
        const result = addMediaTypes(html, domParser);

        expect(result).toContain('type="video/mp4"');
    });

    it('should add type to source with empty type attribute', () => {
        const html = '<video><source src="asset://uuid/video.m4v" type=""></video>';
        const result = addMediaTypes(html, domParser);

        expect(result).toContain('type="video/mp4"');
    });

    it('should not modify source with valid type', () => {
        const html = '<video><source src="asset://uuid/video.mp4" type="video/mp4"></video>';
        const result = addMediaTypes(html, domParser);

        // Should return original HTML (no modification needed)
        expect(result).toBe(html);
    });

    it('should add type to video element with src attribute', () => {
        const html = '<video src="asset://uuid/video.webm"></video>';
        const result = addMediaTypes(html, domParser);

        expect(result).toContain('type="video/webm"');
    });

    it('should add type to audio element with src attribute', () => {
        const html = '<audio src="asset://uuid/music.mp3"></audio>';
        const result = addMediaTypes(html, domParser);

        expect(result).toContain('type="audio/mpeg"');
    });

    it('should handle multiple media elements', () => {
        const html = `
      <video><source src="asset://1/video.mp4"></video>
      <audio src="asset://2/audio.m4a"></audio>
      <video src="asset://3/clip.mov"></video>
    `;
        const result = addMediaTypes(html, domParser);

        expect(result).toContain('type="video/mp4"');
        expect(result).toContain('type="audio/mp4"');
        expect(result).toContain('type="video/quicktime"');
    });

    it('should not add type for unknown extensions', () => {
        const html = '<video><source src="asset://uuid/video.unknown"></video>';
        const result = addMediaTypes(html, domParser);

        // Should return original HTML (no type could be determined)
        expect(result).toBe(html);
    });

    it('should handle blob URLs (no extension)', () => {
        const html = '<video><source src="blob:https://example.com/abc123"></video>';
        const result = addMediaTypes(html, domParser);

        // Should return original HTML (cannot determine type from blob URL)
        expect(result).toBe(html);
    });
});

describe('simplifyMediaElements', () => {
    it('should return empty/null input unchanged', () => {
        expect(simplifyMediaElements('')).toBe('');
        expect(simplifyMediaElements(null as unknown as string)).toBe(null);
    });

    it('should simplify video with mediaelement class and source child', () => {
        const html = '<video class="mediaelement"><source src="video.mp4" type="video/mp4"></video>';
        const result = simplifyMediaElements(html, domParser);

        expect(result).toContain('<video');
        expect(result).toContain('src="video.mp4"');
        expect(result).toContain('controls');
        expect(result).toContain('type="video/mp4"');
        expect(result).not.toContain('mediaelement');
        expect(result).not.toContain('<source');
    });

    it('should simplify video with source child (no mediaelement class)', () => {
        const html = '<video><source src="video.webm"></video>';
        const result = simplifyMediaElements(html, domParser);

        expect(result).toContain('<video');
        expect(result).toContain('src="video.webm"');
        expect(result).toContain('controls');
        expect(result).not.toContain('<source');
    });

    it('should preserve video attributes', () => {
        const html =
            '<video class="mediaelement custom-class" width="640" height="360" poster="thumb.jpg"><source src="video.mp4"></video>';
        const result = simplifyMediaElements(html, domParser);

        expect(result).toContain('width="640"');
        expect(result).toContain('height="360"');
        expect(result).toContain('poster="thumb.jpg"');
        expect(result).toContain('class="custom-class"');
        expect(result).not.toContain('mediaelement');
    });

    it('should add responsive styles', () => {
        const html = '<video class="mediaelement"><source src="video.mp4"></video>';
        const result = simplifyMediaElements(html, domParser);

        expect(result).toContain('max-width');
        expect(result).toContain('100%');
    });

    it('should simplify audio with source child', () => {
        const html = '<audio><source src="audio.mp3" type="audio/mpeg"></audio>';
        const result = simplifyMediaElements(html, domParser);

        expect(result).toContain('<audio');
        expect(result).toContain('src="audio.mp3"');
        expect(result).toContain('controls');
        expect(result).toContain('type="audio/mpeg"');
        expect(result).not.toContain('<source');
    });

    it('should not modify video without source child', () => {
        const html = '<video src="video.mp4" controls></video>';
        const result = simplifyMediaElements(html, domParser);

        // Should return original HTML (already simple format)
        expect(result).toBe(html);
    });

    it('should not modify video with empty source', () => {
        const html = '<video class="mediaelement"><source src=""></video>';
        const result = simplifyMediaElements(html, domParser);

        // Should return original HTML (no src to use)
        expect(result).toBe(html);
    });

    it('should handle multiple video and audio elements', () => {
        const html = `
      <video class="mediaelement"><source src="v1.mp4"></video>
      <audio><source src="a1.mp3"></audio>
      <video class="mediaelement"><source src="v2.webm"></video>
    `;
        const result = simplifyMediaElements(html, domParser);

        expect(result).toContain('src="v1.mp4"');
        expect(result).toContain('src="a1.mp3"');
        expect(result).toContain('src="v2.webm"');
        expect(result).not.toContain('<source');
        expect(result.match(/controls/g)?.length).toBe(3);
    });

    it('should preserve audio class', () => {
        const html = '<audio class="my-audio"><source src="audio.wav"></audio>';
        const result = simplifyMediaElements(html, domParser);

        expect(result).toContain('class="my-audio"');
    });
});
