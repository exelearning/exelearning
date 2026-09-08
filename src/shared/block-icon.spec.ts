import { describe, it, expect } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
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
        // `objetives` shipped in every release from v4.0.0 to v4.0.3; `think-alt` only ever
        // reached v4.0.4 pre-release projects, since educablue arrived after v4.0.3. Both are
        // in saved projects, which is the whole reason the table exists.
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

describe('the JS twins of RENAMED_THEME_ICONS', () => {
    /** Reads a `RENAMED_THEME_ICONS = { ... }` literal out of a frontend file. */
    function readTable(relativePath: string): Record<string, string> {
        const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
        const match = source.match(/RENAMED_THEME_ICONS = \{([\s\S]*?)\n\s*\};/);
        if (!match) throw new Error(`RENAMED_THEME_ICONS literal not found in ${relativePath}`);
        return Object.fromEntries([...match[1].matchAll(/'?([\w-]+)'?:\s*'([\w-]+)'/g)].map(m => [m[1], m[2]]));
    }

    it('carry exactly the entries this module does', () => {
        // Three live copies, and each is the production path somewhere: this module on the
        // server and in the shared exporters, blockIconRuntime.js in the workarea once
        // yjs-loader.js has run, and blockNode.js's own copy while app.bundle.js is being
        // evaluated and `window.eXeBlockIconRuntime` does not exist yet. An entry added to one
        // and not the others leaves the projects it covers with a missing icon on whichever
        // path was forgotten -- silently, since a missing icon is what the bug looked like
        // before the table existed.
        expect(readTable('public/app/common/blockIconRuntime.js')).toEqual({ ...RENAMED_THEME_ICONS });
        expect(readTable('public/app/workarea/project/idevices/content/blockNode.js')).toEqual({
            ...RENAMED_THEME_ICONS,
        });
    });
});

describe('the Material icon tint every bundled style must declare', () => {
    // ADR-1247-04 makes the tint a theme-CSS contract: the application holds no table of
    // per-style colours any more, so a style that stops declaring --exe-icon-color silently
    // loses its tint twice over -- the header glyph falls back to the surrounding text colour
    // in the content and in exports, and the picker chips drop to --modal-icon-default. Both
    // are colour-only regressions no other test can see, so pin the invariant here.
    const styleDir = path.join(process.cwd(), 'public/files/perm/themes/base');
    const styles = fs
        .readdirSync(styleDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);

    it('finds the bundled styles on disk', () => {
        expect(styles.length).toBeGreaterThan(0);
    });

    it.each(styles)('%s declares --exe-icon-color', style => {
        const css = fs.readFileSync(path.join(styleDir, style, 'style.css'), 'utf8');
        // Strip comments first: a commented-out declaration is how the tint gets lost in the
        // first place, and it would otherwise satisfy the match.
        expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).toMatch(/--exe-icon-color\s*:\s*\S/);
    });
});
