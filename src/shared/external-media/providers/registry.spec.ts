import { describe, expect, it } from 'bun:test';
import { PROVIDERS, findProviderForUrl, getProvider, parseExternalMedia, buildCanonicalEmbedUrl } from './registry';

describe('provider registry', () => {
    it('is keyed by id, with no duplicates', () => {
        const ids = PROVIDERS.map(p => p.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toContain('youtube');
        expect(ids).toContain('mediateca-madrid');
    });

    it('resolves a provider from a URL host', () => {
        expect(findProviderForUrl(new URL('https://www.youtube.com/watch?v=aqz-KE-bpKQ'))?.id).toBe('youtube');
        expect(findProviderForUrl(new URL('https://youtu.be/aqz-KE-bpKQ'))?.id).toBe('youtube');
        expect(findProviderForUrl(new URL('https://player.vimeo.com/video/76979871'))?.id).toBe('vimeo');
        expect(findProviderForUrl(new URL('https://mediateca.educa.madrid.org/video/abcd1234'))?.id).toBe(
            'mediateca-madrid',
        );
    });

    /** Host matching is exact or a dotted-suffix, so look-alikes cannot slip through. */
    it('rejects look-alike hosts', () => {
        expect(findProviderForUrl(new URL('https://youtube.com.evil.example/watch?v=x'))).toBeNull();
        expect(findProviderForUrl(new URL('https://evil-vimeo.com/video/1'))).toBeNull();
        expect(findProviderForUrl(new URL('https://notyoutube.com/embed/aqz-KE-bpKQ'))).toBeNull();
    });

    it('extracts the resource id from every URL shape a provider publishes', () => {
        expect(parseExternalMedia('https://www.youtube.com/watch?v=aqz-KE-bpKQ')?.resourceId).toBe('aqz-KE-bpKQ');
        expect(parseExternalMedia('https://youtu.be/aqz-KE-bpKQ')?.resourceId).toBe('aqz-KE-bpKQ');
        expect(parseExternalMedia('https://www.youtube.com/embed/aqz-KE-bpKQ')?.resourceId).toBe('aqz-KE-bpKQ');
        expect(parseExternalMedia('https://vimeo.com/76979871')?.resourceId).toBe('76979871');
        expect(parseExternalMedia('https://player.vimeo.com/video/76979871')?.resourceId).toBe('76979871');
    });

    it('rebuilds the canonical, privacy-friendly URL from a bare id', () => {
        expect(buildCanonicalEmbedUrl('youtube', 'aqz-KE-bpKQ')).toBe(
            'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ',
        );
        expect(buildCanonicalEmbedUrl('vimeo', '76979871')).toBe('https://player.vimeo.com/video/76979871');
        expect(buildCanonicalEmbedUrl('dailymotion', 'x8abc12')).toBe(
            'https://www.dailymotion.com/embed/video/x8abc12',
        );
        expect(buildCanonicalEmbedUrl('mediateca-madrid', 'abcd1234')).toBe(
            'https://mediateca.educa.madrid.org/video/abcd1234/fs',
        );
    });

    /**
     * The id is templated straight into a URL, so anything that could carry a path,
     * query or fragment out of the template must be refused.
     */
    it('refuses an id that could escape the template', () => {
        expect(buildCanonicalEmbedUrl('youtube', '../../evil')).toBeNull();
        expect(buildCanonicalEmbedUrl('youtube', 'abc/def')).toBeNull();
        expect(buildCanonicalEmbedUrl('youtube', 'abc?x=1')).toBeNull();
        expect(buildCanonicalEmbedUrl('youtube', 'abc#frag')).toBeNull();
        expect(buildCanonicalEmbedUrl('vimeo', 'notanumber')).toBeNull();
        expect(buildCanonicalEmbedUrl('vimeo', '')).toBeNull();
    });

    it('refuses an unknown provider', () => {
        expect(buildCanonicalEmbedUrl('nope', 'x')).toBeNull();
        expect(getProvider('nope')).toBeNull();
    });

    it('rejects non-https and credentialled URLs outright', () => {
        expect(parseExternalMedia('http://www.youtube.com/watch?v=aqz-KE-bpKQ')).toBeNull();
        expect(parseExternalMedia('https://evil@www.youtube.com/watch?v=aqz-KE-bpKQ')).toBeNull();
        expect(parseExternalMedia('javascript:alert(1)')).toBeNull();
        expect(parseExternalMedia('not a url')).toBeNull();
    });

    it('describes the passive transport every provider is rendered with', () => {
        for (const provider of PROVIDERS.filter(p => p.passive.supported)) {
            expect(provider.passive.sandbox, provider.id).toContain('allow-scripts');
            expect(provider.passive.sandbox, provider.id).not.toContain('allow-top-navigation');
            expect(provider.passive.referrerPolicy, provider.id).toBe('strict-origin-when-cross-origin');
        }
    });

    /**
     * Phase 0 (S7b) established that a provider's player API validates the embedder's
     * origin, which an opaque frame cannot supply. Controlled mode is therefore not
     * claimed for anyone yet — Phase 4 decides it, gated on S4.
     */
    it('does not yet claim controlled support for any provider', () => {
        expect(PROVIDERS.filter(p => p.controlled.supported)).toEqual([]);
    });
});
