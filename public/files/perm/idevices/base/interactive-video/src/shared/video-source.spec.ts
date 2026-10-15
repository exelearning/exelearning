import { describe, expect, it } from 'vitest';
import {
    isSafeVideoUrl,
    normalizeVideoSource,
    parseMediatecaId,
    parseVimeoId,
    parseYouTubeId,
} from './video-source';

const YT_ID = 'dQw4w9WgXcQ'; // 11 chars

describe('parseYouTubeId', () => {
    it('extracts the id from watch URLs', () => {
        expect(parseYouTubeId('https://www.youtube.com/watch?v=' + YT_ID)).toBe(YT_ID);
        expect(parseYouTubeId('https://www.youtube.com/watch?v=' + YT_ID + '&t=30s')).toBe(YT_ID);
    });

    it('extracts the id from youtu.be short URLs', () => {
        expect(parseYouTubeId('https://youtu.be/' + YT_ID)).toBe(YT_ID);
        expect(parseYouTubeId('//youtu.be/' + YT_ID + '?feature=share')).toBe(YT_ID);
    });

    it('extracts the id from embed and shorts URLs', () => {
        expect(parseYouTubeId('https://www.youtube.com/embed/' + YT_ID)).toBe(YT_ID);
        expect(parseYouTubeId('https://www.youtube.com/shorts/' + YT_ID)).toBe(YT_ID);
        expect(parseYouTubeId('https://www.youtube-nocookie.com/embed/' + YT_ID)).toBe(YT_ID);
    });

    it('returns null when there is no valid 11-char id', () => {
        expect(parseYouTubeId('https://www.youtube.com/watch?v=short')).toBeNull();
        expect(parseYouTubeId('https://example.com/video.mp4')).toBeNull();
        expect(parseYouTubeId('')).toBeNull();
        expect(parseYouTubeId(null)).toBeNull();
    });
});

describe('parseVimeoId', () => {
    it('extracts numeric ids from vimeo URLs', () => {
        expect(parseVimeoId('https://vimeo.com/123456789')).toBe('123456789');
        expect(parseVimeoId('https://player.vimeo.com/video/123456789')).toBe('123456789');
    });

    it('returns null for non-vimeo or malformed URLs', () => {
        expect(parseVimeoId('https://youtu.be/' + YT_ID)).toBeNull();
        expect(parseVimeoId('https://vimeo.com/notanumber')).toBeNull();
        expect(parseVimeoId(null)).toBeNull();
    });
});

describe('parseMediatecaId', () => {
    it('extracts the id from EducaMadrid mediateca URLs', () => {
        expect(parseMediatecaId('https://mediateca.educa.madrid.org/video/abc123')).toBe('abc123');
        expect(parseMediatecaId('https://mediateca.educa.madrid.org/video/abc123?autoplay=1')).toBe('abc123');
    });

    it('matches http mediateca URLs too', () => {
        expect(parseMediatecaId('http://mediateca.educa.madrid.org/video/abc123')).toBe('abc123');
    });

    it('returns null for other hosts', () => {
        expect(parseMediatecaId('https://example.com/video/abc123')).toBeNull();
    });
});

describe('the URL parsers with non-string input', () => {
    it('reject non-strings instead of throwing', () => {
        for (const parse of [parseYouTubeId, parseVimeoId, parseMediatecaId]) {
            expect(parse(null)).toBeNull();
            expect(parse(undefined)).toBeNull();
            expect(parse(42)).toBeNull();
            expect(parse({})).toBeNull();
        }
    });
});

describe('isSafeVideoUrl', () => {
    it('rejects dangerous schemes', () => {
        expect(isSafeVideoUrl('javascript:alert(1)')).toBe(false);
        expect(isSafeVideoUrl('JavaScript:alert(1)')).toBe(false);
        expect(isSafeVideoUrl('  javascript:alert(1)')).toBe(false);
        expect(isSafeVideoUrl('data:text/html,<script>x</script>')).toBe(false);
        expect(isSafeVideoUrl('vbscript:msgbox(1)')).toBe(false);
    });

    it('accepts https, protocol-relative, relative and asset URLs', () => {
        expect(isSafeVideoUrl('https://www.youtube.com/watch?v=' + YT_ID)).toBe(true);
        expect(isSafeVideoUrl('//youtu.be/' + YT_ID)).toBe(true);
        expect(isSafeVideoUrl('resources/video.mp4')).toBe(true);
        expect(isSafeVideoUrl('asset://uuid.mp4')).toBe(true);
    });

    it('rejects empty or non-string input', () => {
        expect(isSafeVideoUrl('')).toBe(false);
        expect(isSafeVideoUrl(null)).toBe(false);
        expect(isSafeVideoUrl(undefined)).toBe(false);
    });
});

describe('normalizeVideoSource', () => {
    it('returns a structured descriptor for YouTube, upgrading to https', () => {
        expect(normalizeVideoSource('http://www.youtube.com/watch?v=' + YT_ID)).toEqual({
            provider: 'youtube',
            videoId: YT_ID,
            url: 'https://www.youtube.com/watch?v=' + YT_ID,
        });
    });

    it('returns a descriptor for Vimeo and Mediateca (https-forced)', () => {
        expect(normalizeVideoSource('https://vimeo.com/123456789')).toEqual({
            provider: 'vimeo',
            videoId: '123456789',
            url: 'https://player.vimeo.com/video/123456789',
        });
        expect(normalizeVideoSource('http://mediateca.educa.madrid.org/video/abc123')).toEqual({
            provider: 'mediateca',
            videoId: 'abc123',
            url: 'https://mediateca.educa.madrid.org/video/abc123',
        });
    });

    it('returns a local descriptor preserving the reference', () => {
        expect(normalizeVideoSource('resources/video.mp4')).toEqual({
            provider: 'local',
            videoId: null,
            url: 'resources/video.mp4',
        });
    });

    it('returns null for unsafe URLs', () => {
        expect(normalizeVideoSource('javascript:alert(1)')).toBeNull();
        expect(normalizeVideoSource('')).toBeNull();
        expect(normalizeVideoSource(null)).toBeNull();
    });
});
