import { describe, it, expect } from 'bun:test';
import { deriveBlockIcon } from './block-icon';

describe('deriveBlockIcon', () => {
    it('derives a material icon from a mi- prefixed name', () => {
        expect(deriveBlockIcon('mi-lightbulb')).toEqual({ source: 'material', value: 'lightbulb' });
    });

    it('strips only the leading mi- prefix', () => {
        expect(deriveBlockIcon('mi-mi-thing')).toEqual({ source: 'material', value: 'mi-thing' });
    });

    it('derives an asset icon from an asset:// url', () => {
        expect(deriveBlockIcon('asset://uuid-123/icon.jpg')).toEqual({
            source: 'asset',
            value: 'asset://uuid-123/icon.jpg',
        });
    });

    it('derives an asset icon from an absolute / path', () => {
        expect(deriveBlockIcon('/files/perm/x.png')).toEqual({ source: 'asset', value: '/files/perm/x.png' });
    });

    it('derives a theme icon from a plain name', () => {
        expect(deriveBlockIcon('objectives')).toEqual({ source: 'theme', value: 'objectives' });
    });

    it('derives none from an empty or missing name', () => {
        expect(deriveBlockIcon('')).toEqual({ source: 'none', value: '' });
        expect(deriveBlockIcon(undefined)).toEqual({ source: 'none', value: '' });
        expect(deriveBlockIcon(null)).toEqual({ source: 'none', value: '' });
    });

    it('coerces non-string input to a string before deriving', () => {
        // Guards the export.ts path which previously wrapped iconName in String(...)
        expect(deriveBlockIcon(123 as unknown as string)).toEqual({ source: 'theme', value: '123' });
    });
});
