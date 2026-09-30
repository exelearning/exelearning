import { describe, expect, it } from 'vitest';
import { isTrustedEmbedUrl, TRUSTED_EMBED_HOSTS } from './trustedEmbedHosts.js';

describe('isTrustedEmbedUrl', () => {
    it.each([
        'https://www.youtube.com/embed/abc',
        'https://youtube.com/embed/abc',
        'https://www.youtube-nocookie.com/embed/abc',
        'https://youtu.be/abc',
        'https://player.vimeo.com/video/123',
        'https://vimeo.com/123',
        'https://www.dailymotion.com/embed/video/x2jvvep',
        'https://dai.ly/x2jvvep',
        'https://mediateca.educa.madrid.org/video/ywxnnec399b/fs',
        // Trusted per host: the same library serves document embeds too.
        'https://mediateca.educa.madrid.org/documentos/nl3fhe1a2b3c',
    ])('trusts %s', url => {
        expect(isTrustedEmbedUrl(url)).toBe(true);
    });

    it.each([
        'https://example.com/widget',
        'https://h5p.org/h5p/embed/1',
        'https://notyoutube.com/embed/abc',
        'https://www.geogebra.org/material/iframe/id',
        '',
        null,
        undefined,
        'not a url at all ://',
    ])('does not trust %s', url => {
        expect(isTrustedEmbedUrl(url)).toBe(false);
    });

    it.each([
        'https://youtube.com.evil.example/embed/abc',
        'https://evil-vimeo.com/video/1',
        'https://notyoutu.be/x',
        'https://mediateca.educa.madrid.org.evil.com/video/x',
    ])('rejects the look-alike host %s', url => {
        expect(isTrustedEmbedUrl(url)).toBe(false);
    });

    it.each([
        'https://evil.com@youtube.com/embed/x',
        'https://user:pass@player.vimeo.com/video/1',
    ])('rejects credentials in the authority: %s', url => {
        // They read as the provider while the request goes elsewhere; the
        // canonical relay refuses them too.
        expect(isTrustedEmbedUrl(url)).toBe(false);
    });

    it('matches subdomains of a trusted host', () => {
        expect(TRUSTED_EMBED_HOSTS).toContain('vimeo.com');
        expect(isTrustedEmbedUrl('https://player.vimeo.com/video/1')).toBe(true);
    });
});
