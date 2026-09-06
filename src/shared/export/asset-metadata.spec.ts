import { describe, it, expect } from 'bun:test';
import { pickAssetExportMetadata } from './asset-metadata';

describe('pickAssetExportMetadata', () => {
    it('keeps only non-empty string fields', () => {
        const result = pickAssetExportMetadata({
            description: 'A sunset',
            title: '   ',
            license: 'Creative Commons BY',
            author: 'Ada',
            authorUrl: 'https://author.example',
            sourceUrl: '',
            unknown: 'ignored',
        });
        expect(result).toEqual({
            description: 'A sunset',
            license: 'Creative Commons BY',
            author: 'Ada',
            authorUrl: 'https://author.example',
        });
    });

    it('does not carry the per-instance alt text (no longer centralized)', () => {
        const result = pickAssetExportMetadata({ altText: 'a cat on a mat' });
        expect(result).toBeNull();
    });

    it('returns null when there is no usable metadata', () => {
        expect(pickAssetExportMetadata({ description: '', author: null as unknown as string })).toBeNull();
        expect(pickAssetExportMetadata({})).toBeNull();
        expect(pickAssetExportMetadata(null)).toBeNull();
        expect(pickAssetExportMetadata(undefined)).toBeNull();
    });

    it('ignores non-string values', () => {
        expect(pickAssetExportMetadata({ description: 123 as unknown as string })).toBeNull();
    });
});
