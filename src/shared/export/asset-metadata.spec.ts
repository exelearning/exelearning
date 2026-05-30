import { describe, it, expect } from 'bun:test';
import { pickAssetExportMetadata } from './asset-metadata';

describe('pickAssetExportMetadata', () => {
    it('keeps only non-empty string fields', () => {
        const result = pickAssetExportMetadata({
            description: 'A sunset',
            altText: '',
            title: '   ',
            license: 'Creative Commons BY',
            author: 'Ada',
            unknown: 'ignored',
        });
        expect(result).toEqual({
            description: 'A sunset',
            license: 'Creative Commons BY',
            author: 'Ada',
        });
    });

    it('returns null when there is no usable metadata', () => {
        expect(pickAssetExportMetadata({ description: '', altText: null as unknown as string })).toBeNull();
        expect(pickAssetExportMetadata({})).toBeNull();
        expect(pickAssetExportMetadata(null)).toBeNull();
        expect(pickAssetExportMetadata(undefined)).toBeNull();
    });

    it('ignores non-string values', () => {
        expect(pickAssetExportMetadata({ description: 123 as unknown as string })).toBeNull();
    });
});
