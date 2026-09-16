/**
 * Tests for the Material icon sprite parser (src/shared/material-icons/spriteParser.ts).
 *
 * The sprite is the single on-disk source for the vendored Material Symbols set;
 * these tests pin the extraction contract relied on by the export pipeline and
 * the editor runtime twin.
 */
import { describe, it, expect } from 'bun:test';
import {
    MATERIAL_ICON_FALLBACK,
    HELP_ICON_FALLBACK_DATA_URI,
    parseMaterialIconSprite,
    resolveMaterialIconSymbol,
    buildStandaloneSvg,
    getMaterialIconSvg,
    getMaterialIconDataUri,
} from './spriteParser';

const SPRITE = [
    '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">',
    '<symbol id="alarm" viewBox="0 -960 960 960">',
    '<path d="M40-200Z"/>',
    '</symbol>',
    '<symbol id="lightbulb" viewBox="0 -960 960 960"><path d="M10-10Z"/></symbol>',
    '<symbol id="help" viewBox="0 -960 960 960"><path d="M1-1Z"/></symbol>',
    '</svg>',
    '',
].join('\n');

describe('parseMaterialIconSprite', () => {
    it('extracts every symbol keyed by id', () => {
        const symbols = parseMaterialIconSprite(SPRITE);
        expect(symbols.size).toBe(3);
        expect([...symbols.keys()].sort()).toEqual(['alarm', 'help', 'lightbulb']);
    });

    it('captures viewBox and trims the body', () => {
        const symbols = parseMaterialIconSprite(SPRITE);
        expect(symbols.get('alarm')).toEqual({
            viewBox: '0 -960 960 960',
            body: '<path d="M40-200Z"/>',
        });
    });

    it('handles single-line symbols', () => {
        const symbols = parseMaterialIconSprite(SPRITE);
        expect(symbols.get('lightbulb')?.body).toBe('<path d="M10-10Z"/>');
    });

    it('returns an empty map for empty or falsy input', () => {
        expect(parseMaterialIconSprite('').size).toBe(0);
        expect(parseMaterialIconSprite(undefined as unknown as string).size).toBe(0);
    });

    it('skips malformed symbols missing id or viewBox', () => {
        const broken = '<svg><symbol viewBox="0 0 1 1"><path/></symbol><symbol id="x"><path/></symbol></svg>';
        expect(parseMaterialIconSprite(broken).size).toBe(0);
    });
});

describe('resolveMaterialIconSymbol', () => {
    const symbols = parseMaterialIconSprite(SPRITE);

    it('returns the requested symbol when present', () => {
        expect(resolveMaterialIconSymbol(symbols, 'alarm')?.body).toBe('<path d="M40-200Z"/>');
    });

    it('falls back to "help" for unknown or empty names', () => {
        expect(resolveMaterialIconSymbol(symbols, 'does-not-exist')?.body).toBe('<path d="M1-1Z"/>');
        expect(resolveMaterialIconSymbol(symbols, '')?.body).toBe('<path d="M1-1Z"/>');
        expect(resolveMaterialIconSymbol(symbols, null)?.body).toBe('<path d="M1-1Z"/>');
    });

    it('returns null when neither the name nor the fallback exist', () => {
        const noFallback = parseMaterialIconSprite('<svg><symbol id="only" viewBox="0 0 1 1"><path/></symbol></svg>');
        expect(resolveMaterialIconSymbol(noFallback, 'missing')).toBeNull();
    });

    it('honours a custom fallback', () => {
        expect(resolveMaterialIconSymbol(symbols, 'missing', 'lightbulb')?.body).toBe('<path d="M10-10Z"/>');
    });

    it('exposes the default fallback name', () => {
        expect(MATERIAL_ICON_FALLBACK).toBe('help');
    });
});

describe('buildStandaloneSvg / getMaterialIconSvg', () => {
    const symbols = parseMaterialIconSprite(SPRITE);

    it('wraps the body in a standalone svg with the symbol viewBox', () => {
        expect(buildStandaloneSvg({ viewBox: '0 -960 960 960', body: '<path d="M0Z"/>' })).toBe(
            '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 -960 960 960"><path d="M0Z"/></svg>',
        );
    });

    it('resolves a name to a full svg', () => {
        expect(getMaterialIconSvg(symbols, 'alarm')).toContain('<path d="M40-200Z"/>');
        expect(getMaterialIconSvg(symbols, 'alarm')).toContain('viewBox="0 -960 960 960"');
    });

    it('returns null when nothing resolves', () => {
        const empty = parseMaterialIconSprite('');
        expect(getMaterialIconSvg(empty, 'alarm')).toBeNull();
    });
});

describe('getMaterialIconDataUri', () => {
    const symbols = parseMaterialIconSprite(SPRITE);

    it('encodes the svg as a utf8 data URI', () => {
        const uri = getMaterialIconDataUri(symbols, 'alarm');
        expect(uri).toStartWith('data:image/svg+xml;utf8,');
        expect(decodeURIComponent(uri!.replace('data:image/svg+xml;utf8,', ''))).toContain('<path d="M40-200Z"/>');
    });

    it('falls back to "help" for unknown names', () => {
        const uri = getMaterialIconDataUri(symbols, 'nope');
        expect(decodeURIComponent(uri!.replace('data:image/svg+xml;utf8,', ''))).toContain('<path d="M1-1Z"/>');
    });

    it('returns null when nothing resolves', () => {
        expect(getMaterialIconDataUri(parseMaterialIconSprite(''), 'alarm')).toBeNull();
    });
});

describe('HELP_ICON_FALLBACK_DATA_URI', () => {
    it('is a self-contained svg data URI (no dead /icons/ path)', () => {
        expect(HELP_ICON_FALLBACK_DATA_URI).toStartWith('data:image/svg+xml;utf8,');
        expect(HELP_ICON_FALLBACK_DATA_URI).not.toContain('/icons/');

        const decoded = decodeURIComponent(HELP_ICON_FALLBACK_DATA_URI.replace('data:image/svg+xml;utf8,', ''));
        expect(decoded).toStartWith('<svg');
        // The help glyph path begins with this signature in the vendored sprite.
        expect(decoded).toContain('<path d="M484-247');
    });
});
