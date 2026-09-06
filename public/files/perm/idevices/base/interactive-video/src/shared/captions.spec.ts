import { describe, expect, it } from 'vitest';
import { normalizeCaptions } from './captions';

describe('normalizeCaptions', () => {
    it('returns [] for non-arrays', () => {
        expect(normalizeCaptions(null)).toEqual([]);
        expect(normalizeCaptions(undefined)).toEqual([]);
        expect(normalizeCaptions('x')).toEqual([]);
    });

    it('drops captions without a source and maps url/assetId to src', () => {
        const out = normalizeCaptions([
            { lang: 'es', label: 'ES', src: 'resources/es.vtt' },
            { lang: 'en' }, // no source -> dropped
            { lang: 'fr', url: 'resources/fr.srt' },
            { lang: 'de', assetId: 'asset://uuid.vtt' },
        ]);
        expect(out.map(c => c.src)).toEqual(['resources/es.vtt', 'resources/fr.srt', 'asset://uuid.vtt']);
    });

    it('keeps at most one default and fills a missing label from the lang', () => {
        const out = normalizeCaptions([
            { src: 'a.vtt', lang: 'es', default: true },
            { src: 'b.vtt', lang: 'en', default: true },
            { src: 'c.vtt', lang: 'fr' },
        ]);
        expect(out.filter(c => c.default).length).toBe(1);
        expect(out[0]?.default).toBe(true);
        expect(out[1]?.label).toBe('en'); // label defaulted from lang
    });

    it('ignores non-object rows', () => {
        expect(normalizeCaptions([null, 42, { src: 'a.vtt' }])).toEqual([
            { src: 'a.vtt', lang: '', label: '', default: false },
        ]);
    });
});
