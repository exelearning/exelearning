/**
 * Tests for Translations Format Command
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeXlf(
    targetLang: string,
    units: { id: string; resname: string; source: string; target: string }[],
): string {
    const body = units
        .map(
            u =>
                `      <trans-unit id="${u.id}" resname="${u.resname}">\n` +
                `        <source>${u.source}</source>\n` +
                `        <target>${u.target}</target>\n` +
                `      </trans-unit>`,
        )
        .join('\n');

    return (
        `<?xml version="1.0" encoding="utf-8"?>\n` +
        `<xliff xmlns="urn:oasis:names:tc:xliff:document:1.2" version="1.2">\n` +
        `  <file source-language="en" target-language="${targetLang}" datatype="plaintext" original="file.ext">\n` +
        `    <header><tool tool-id="symfony" tool-name="Symfony"/></header>\n` +
        `    <body>\n` +
        body +
        `\n    </body>\n` +
        `  </file>\n` +
        `</xliff>`
    );
}

// ---------------------------------------------------------------------------
// Unit tests — needsCDATA
// ---------------------------------------------------------------------------

describe('needsCDATA', () => {
    let needsCDATA: (text: string) => boolean;

    beforeEach(async () => {
        ({ needsCDATA } = await import('./translations-format'));
    });

    it('returns false for plain text with no special characters', () => {
        expect(needsCDATA('Error de permisos')).toBe(false);
    });

    it('returns false for text with valid &amp; entity', () => {
        expect(needsCDATA('Texto con &amp; símbolo')).toBe(false);
    });

    it('returns false for text with valid &lt; entity', () => {
        expect(needsCDATA('a &lt; b')).toBe(false);
    });

    it('returns false for text with valid &gt; entity', () => {
        expect(needsCDATA('a &gt; b')).toBe(false);
    });

    it('returns false for text with valid &quot; entity', () => {
        expect(needsCDATA('click &quot;OK&quot;')).toBe(false);
    });

    it('returns false for text with valid &apos; entity', () => {
        expect(needsCDATA("it&apos;s fine")).toBe(false);
    });

    it('returns false for empty string', () => {
        expect(needsCDATA('')).toBe(false);
    });

    it('returns true for text containing a bare <', () => {
        expect(needsCDATA('a < b')).toBe(true);
    });

    it('returns true for text with &percnt; (HTML entity, not valid XML)', () => {
        expect(needsCDATA('%s&percnt; de aciertos')).toBe(true);
    });

    it('returns true for text with &nbsp; (HTML entity, not valid XML)', () => {
        expect(needsCDATA('texto&nbsp;más')).toBe(true);
    });

    it('returns true for text with a bare & at the end', () => {
        expect(needsCDATA('A & B')).toBe(true);
    });

    it('returns true when text contains both a valid entity and an invalid one', () => {
        expect(needsCDATA('&amp; y &percnt;')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Unit tests — formatTargetContent
// ---------------------------------------------------------------------------

describe('formatTargetContent', () => {
    let formatTargetContent: (raw: string) => string;

    beforeEach(async () => {
        ({ formatTargetContent } = await import('./translations-format'));
    });

    it('returns plain safe text unchanged', () => {
        expect(formatTargetContent('Error de permisos')).toBe('Error de permisos');
    });

    it('returns empty string unchanged', () => {
        expect(formatTargetContent('')).toBe('');
    });

    it('wraps text containing &percnt; in CDATA', () => {
        const input = '%s&percnt; de aciertos';
        expect(formatTargetContent(input)).toBe(`<![CDATA[${input}]]>`);
    });

    it('wraps text containing a bare < in CDATA', () => {
        const input = 'a < b';
        expect(formatTargetContent(input)).toBe(`<![CDATA[${input}]]>`);
    });

    it('leaves already-wrapped CDATA untouched', () => {
        const input = '<![CDATA[%s&percnt; de aciertos]]>';
        expect(formatTargetContent(input)).toBe(input);
    });

    it('does not wrap text that only contains valid XML entities', () => {
        const input = 'Haz clic en &quot;Aceptar&quot;';
        expect(formatTargetContent(input)).toBe(input);
    });
});

// ---------------------------------------------------------------------------
// Unit tests — formatTransUnitBlock
// ---------------------------------------------------------------------------

describe('formatTransUnitBlock', () => {
    let formatTransUnitBlock: (raw: string) => string;

    beforeEach(async () => {
        ({ formatTransUnitBlock } = await import('./translations-format'));
    });

    it('normalises indentation for a plain-text target', () => {
        const input =
            '\n    <trans-unit id="abc" resname="Key">\n' +
            '      <source>Key</source>\n' +
            '      <target>Valor</target>\n' +
            '    </trans-unit>';
        const result = formatTransUnitBlock(input);
        expect(result).toBe(
            '\n      <trans-unit id="abc" resname="Key">\n' +
            '        <source>Key</source>\n' +
            '        <target>Valor</target>\n' +
            '      </trans-unit>',
        );
    });

    it('adds CDATA to target when content requires it', () => {
        const input =
            '\n      <trans-unit id="pct" resname="%s&amp;percnt; correct">\n' +
            '        <source>%s&amp;percnt; correct</source>\n' +
            '        <target>%s&percnt; correcto</target>\n' +
            '      </trans-unit>';
        const result = formatTransUnitBlock(input);
        expect(result).toContain('<target><![CDATA[%s&percnt; correcto]]></target>');
    });

    it('preserves already-wrapped CDATA in target', () => {
        const input =
            '\n      <trans-unit id="pct" resname="key">\n' +
            '        <source>source</source>\n' +
            '        <target><![CDATA[%s&percnt; correcto]]></target>\n' +
            '      </trans-unit>';
        const result = formatTransUnitBlock(input);
        expect(result).toContain('<target><![CDATA[%s&percnt; correcto]]></target>');
    });

    it('does not add CDATA to a safe plain-text target', () => {
        const input =
            '\n      <trans-unit id="ok" resname="Simple">\n' +
            '        <source>Simple</source>\n' +
            '        <target>Sencillo</target>\n' +
            '      </trans-unit>';
        const result = formatTransUnitBlock(input);
        expect(result).toContain('<target>Sencillo</target>');
        expect(result).not.toContain('CDATA');
    });
});

// ---------------------------------------------------------------------------
// Unit tests — formatXlfContent
// ---------------------------------------------------------------------------

describe('formatXlfContent', () => {
    let formatXlfContent: (content: string) => string;

    beforeEach(async () => {
        ({ formatXlfContent } = await import('./translations-format'));
    });

    it('wraps targets that need CDATA and leaves safe targets unchanged', () => {
        const xlf = makeXlf('es', [
            { id: 'u1', resname: 'Safe', source: 'Safe', target: 'Seguro' },
            { id: 'u2', resname: '%s&amp;percnt;', source: '%s&amp;percnt;', target: '%s&percnt;' },
        ]);
        const result = formatXlfContent(xlf);
        expect(result).toContain('<target>Seguro</target>');
        expect(result).toContain('<target><![CDATA[%s&percnt;]]></target>');
    });

    it('is idempotent — running twice produces the same output', () => {
        const xlf = makeXlf('es', [
            { id: 'u1', resname: 'key', source: 'key', target: '%s&percnt; right' },
        ]);
        const once = formatXlfContent(xlf);
        const twice = formatXlfContent(once);
        expect(twice).toBe(once);
    });

    it('returns the content unchanged when no CDATA is needed', () => {
        const xlf = makeXlf('es', [
            { id: 'u1', resname: 'Safe', source: 'Safe', target: 'Seguro' },
            { id: 'u2', resname: 'Safe2', source: 'Safe2', target: 'También seguro' },
        ]);
        // Format then compare — indentation may be normalised, so compare parsed structure
        const result = formatXlfContent(xlf);
        expect(result).not.toContain('CDATA');
    });
});

// ---------------------------------------------------------------------------
// Integration tests — execute
// ---------------------------------------------------------------------------

describe('execute', () => {
    const testDir = path.join(process.cwd(), 'test', 'temp', 'translations-format-test');
    const testTranslationsDir = path.join(testDir, 'translations');
    const originalCwd = process.cwd;

    beforeEach(async () => {
        await fs.ensureDir(testTranslationsDir);
        process.cwd = () => testDir;
    });

    afterEach(async () => {
        process.cwd = originalCwd;
        const { resetDependencies } = await import('./translations-format');
        resetDependencies();
        if (await fs.pathExists(testDir)) {
            await fs.remove(testDir);
        }
    });

    it('fails for an unknown locale', async () => {
        const { execute, configure } = await import('./translations-format');
        configure({ readFile: () => '', writeFile: () => {}, fileExists: () => false });
        const result = await execute([], { locale: 'xx' });
        expect(result.success).toBe(false);
        expect(result.message).toContain('Unknown locale');
    });

    it('succeeds and formats a specific locale file', async () => {
        const xlfPath = path.join(testTranslationsDir, 'messages.es.xlf');
        const original = makeXlf('es', [
            { id: 'u1', resname: 'key', source: 'key', target: '%s&percnt; correcto' },
        ]);
        await fs.writeFile(xlfPath, original);

        const { execute } = await import('./translations-format');
        const result = await execute([], { locale: 'es' });

        expect(result.success).toBe(true);
        const written = await fs.readFile(xlfPath, 'utf-8');
        expect(written).toContain('<![CDATA[%s&percnt; correcto]]>');
    });

    it('reports unchanged when file already has correct CDATA', async () => {
        const xlfPath = path.join(testTranslationsDir, 'messages.es.xlf');
        const original = makeXlf('es', [
            { id: 'u1', resname: 'key', source: 'key', target: '<![CDATA[%s&percnt; correcto]]>' },
        ]);
        await fs.writeFile(xlfPath, original);

        const { execute } = await import('./translations-format');
        const result = await execute([], { locale: 'es' });

        expect(result.success).toBe(true);
        expect(result.message).toContain('already correctly formatted');
    });

    it('skips missing XLF files with a warning', async () => {
        const { execute } = await import('./translations-format');
        // No file written — should skip gracefully
        const result = await execute([], { locale: 'es' });
        expect(result.success).toBe(true);
    });

    it('does not modify safe files', async () => {
        const xlfPath = path.join(testTranslationsDir, 'messages.es.xlf');
        const original = makeXlf('es', [
            { id: 'u1', resname: 'Safe', source: 'Safe', target: 'Seguro' },
        ]);
        // Normalise so round-trip indentation doesn't cause spurious diff
        const { formatXlfContent } = await import('./translations-format');
        const normalised = formatXlfContent(original);
        await fs.writeFile(xlfPath, normalised);

        const { execute } = await import('./translations-format');
        const result = await execute([], { locale: 'es' });

        expect(result.success).toBe(true);
        const written = await fs.readFile(xlfPath, 'utf-8');
        expect(written).toBe(normalised);
        expect(written).not.toContain('CDATA');
    });
});
