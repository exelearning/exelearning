import { describe, it, expect } from 'bun:test';
import { deriveBlockIcon, RENAMED_THEME_ICONS, resolveRenamedThemeIcon } from './block-icon';

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

    it('maps a theme icon name a shipped style has since renamed', () => {
        // Both names shipped in v4.0.0-v4.0.3, so saved projects still store them.
        expect(deriveBlockIcon('objetives')).toEqual({ source: 'theme', value: 'objectives' });
        expect(deriveBlockIcon('think-alt')).toEqual({ source: 'theme', value: 'think_alt' });
    });
});

describe('resolveRenamedThemeIcon', () => {
    it('maps every recorded rename onto the name the themes ship today', () => {
        for (const [stored, current] of Object.entries(RENAMED_THEME_ICONS)) {
            expect(resolveRenamedThemeIcon(stored)).toBe(current);
        }
    });

    it('names a file that one of the bundled styles actually ships', () => {
        // The table is only worth anything if its right-hand side exists on disk; a typo here
        // would swap one 404 for another.
        for (const current of Object.values(RENAMED_THEME_ICONS)) {
            const matches = new Bun.Glob(`public/files/perm/themes/**/icons/${current}.*`).scanSync('.');
            expect([...matches].length).toBeGreaterThan(0);
        }
    });

    it('leaves a name that was never renamed alone', () => {
        expect(resolveRenamedThemeIcon('objectives')).toBe('objectives');
        expect(resolveRenamedThemeIcon('')).toBe('');
    });

    it('does not resolve an Object.prototype member as a rename', () => {
        // The lookup key is a name off a saved project, so it is arbitrary text.
        expect(resolveRenamedThemeIcon('constructor')).toBe('constructor');
        expect(resolveRenamedThemeIcon('toString')).toBe('toString');
    });
});
