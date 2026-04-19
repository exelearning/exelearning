/**
 * Tests for Translations Sort Command
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeXlf(targetLang: string, units: { id: string; resname: string; source: string; target: string }[]): string {
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
// Setup
// ---------------------------------------------------------------------------

describe('Translations Sort Command', () => {
    const testDir = path.join(process.cwd(), 'test', 'temp', 'translations-sort-test');
    const testTranslationsDir = path.join(testDir, 'translations');
    const originalCwd = process.cwd;

    // Three trans-units in EN reference order: A → B → C
    const unitA = { id: 'id_A', resname: 'Key A', source: 'Key A', target: '' };
    const unitB = { id: 'id_B', resname: 'Key B', source: 'Key B', target: '' };
    const unitC = { id: 'id_C', resname: 'Key C', source: 'Key C', target: '' };

    const enXlfContent = makeXlf('en', [unitA, unitB, unitC]);
    // Spanish file starts in order B → A → C (intentionally shuffled)
    const esXlfShuffled = makeXlf('es', [
        { ...unitB, target: 'Clave B' },
        { ...unitA, target: 'Clave A' },
        { ...unitC, target: 'Clave C' },
    ]);

    beforeEach(async () => {
        await fs.ensureDir(testTranslationsDir);
        await fs.writeFile(path.join(testTranslationsDir, 'messages.en.xlf'), enXlfContent);
        await fs.writeFile(path.join(testTranslationsDir, 'messages.es.xlf'), esXlfShuffled);
        process.cwd = () => testDir;
    });

    afterEach(async () => {
        process.cwd = originalCwd;
        const { resetDependencies } = await import('./translations-sort');
        resetDependencies();
        if (await fs.pathExists(testDir)) {
            await fs.remove(testDir);
        }
    });

    // -----------------------------------------------------------------------
    // Argument validation
    // -----------------------------------------------------------------------

    describe('argument validation', () => {
        it('should fail for an unknown locale', async () => {
            const { execute, configure } = await import('./translations-sort');
            configure({ extractKeys: async () => new Set(['Key A', 'Key B', 'Key C']) });

            const result = await execute([], { locale: 'zz' });

            expect(result.success).toBe(false);
            expect(result.message).toContain('Unknown locale');
            expect(result.message).toContain('zz');
        });

        it('should fail when messages.en.xlf does not exist', async () => {
            await fs.remove(path.join(testTranslationsDir, 'messages.en.xlf'));

            const { execute, configure } = await import('./translations-sort');
            configure({ extractKeys: async () => new Set(['Key A', 'Key B', 'Key C']) });

            const result = await execute([], {});

            expect(result.success).toBe(false);
            expect(result.message).toContain('Reference file not found');
        });
    });

    // -----------------------------------------------------------------------
    // Sync check
    // -----------------------------------------------------------------------

    describe('sync check', () => {
        it('should fail and list new keys when extracted set has keys missing from messages.en.xlf', async () => {
            const { execute, configure } = await import('./translations-sort');
            // New key "Key D" is in source but not yet in messages.en.xlf
            configure({ extractKeys: async () => new Set(['Key A', 'Key B', 'Key C', 'Key D']) });

            const result = await execute([], { locale: 'es' });

            expect(result.success).toBe(false);
            expect(result.message).toContain('not in sync');
            expect(result.message).toContain('Key D');
            expect(result.message).toContain('make translations');
            // Temp file must be cleaned up on failure
            expect(await fs.pathExists(path.join(testTranslationsDir, 'messages.tmp.xlf'))).toBe(false);
        });

        it('should succeed when extracted keys exactly match messages.en.xlf', async () => {
            const { execute, configure } = await import('./translations-sort');
            configure({ extractKeys: async () => new Set(['Key A', 'Key B', 'Key C']) });

            const result = await execute([], { locale: 'es' });

            expect(result.success).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Sorting — specific locale
    // -----------------------------------------------------------------------

    describe('sorting a specific locale', () => {
        it('should reorder trans-units to match messages.en.xlf order', async () => {
            const { execute, configure } = await import('./translations-sort');
            configure({ extractKeys: async () => new Set(['Key A', 'Key B', 'Key C']) });

            const result = await execute([], { locale: 'es' });

            expect(result.success).toBe(true);
            expect(result.message).toContain('messages.es.xlf');

            const sorted = await fs.readFile(path.join(testTranslationsDir, 'messages.es.xlf'), 'utf-8');
            const posA = sorted.indexOf('id="id_A"');
            const posB = sorted.indexOf('id="id_B"');
            const posC = sorted.indexOf('id="id_C"');
            expect(posA).toBeLessThan(posB);
            expect(posB).toBeLessThan(posC);
        });

        it('should preserve translations during reordering', async () => {
            const { execute, configure } = await import('./translations-sort');
            configure({ extractKeys: async () => new Set(['Key A', 'Key B', 'Key C']) });

            await execute([], { locale: 'es' });

            const sorted = await fs.readFile(path.join(testTranslationsDir, 'messages.es.xlf'), 'utf-8');
            expect(sorted).toContain('Clave A');
            expect(sorted).toContain('Clave B');
            expect(sorted).toContain('Clave C');
        });

        it('should use canonical 6/8-space indentation', async () => {
            const { execute, configure } = await import('./translations-sort');
            configure({ extractKeys: async () => new Set(['Key A', 'Key B', 'Key C']) });

            await execute([], { locale: 'es' });

            const sorted = await fs.readFile(path.join(testTranslationsDir, 'messages.es.xlf'), 'utf-8');
            expect(sorted).toMatch(/^ {6}<trans-unit /m);
            expect(sorted).toMatch(/^ {8}<source>/m);
            expect(sorted).toMatch(/^ {8}<target>/m);
        });

        it('should preserve CDATA in target', async () => {
            const esWithCdata = makeXlf('es', [
                { ...unitB, target: '<![CDATA[&percnt; of correct answers]]>' },
                { ...unitA, target: 'Clave A' },
                { ...unitC, target: 'Clave C' },
            ]);
            await fs.writeFile(path.join(testTranslationsDir, 'messages.es.xlf'), esWithCdata);

            const { execute, configure } = await import('./translations-sort');
            configure({ extractKeys: async () => new Set(['Key A', 'Key B', 'Key C']) });

            await execute([], { locale: 'es' });

            const sorted = await fs.readFile(path.join(testTranslationsDir, 'messages.es.xlf'), 'utf-8');
            expect(sorted).toContain('<![CDATA[&percnt; of correct answers]]>');
        });

        it('should delete the temp file after success', async () => {
            const { execute, configure } = await import('./translations-sort');
            configure({ extractKeys: async () => new Set(['Key A', 'Key B', 'Key C']) });

            await execute([], { locale: 'es' });

            expect(await fs.pathExists(path.join(testTranslationsDir, 'messages.tmp.xlf'))).toBe(false);
        });

        it('should fail and preserve temp file when re-verification detects a missing string', async () => {
            // Inject a readFileForVerification that returns en.xlf without one unit,
            // simulating a hypothetical sort bug that drops a trans-unit.
            const truncatedEn = makeXlf('en', [unitA, unitB]); // unitC is missing

            const { execute, configure } = await import('./translations-sort');
            configure({
                extractKeys: async () => new Set(['Key A', 'Key B', 'Key C']),
                readFileForVerification: () => truncatedEn,
            });

            const result = await execute([], { locale: 'es' });

            expect(result.success).toBe(false);
            expect(result.message).toContain('Re-verification failed');
            expect(result.message).toContain('1 string(s)');
            // Temp file must be preserved for inspection
            expect(await fs.pathExists(path.join(testTranslationsDir, 'messages.tmp.xlf'))).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Sorting — all locales
    // -----------------------------------------------------------------------

    describe('sorting all locales', () => {
        it('should sort every XLF file present in the directory', async () => {
            // Add a second locale file (Catalan) also shuffled
            const caXlf = makeXlf('ca', [
                { ...unitC, target: 'Clau C' },
                { ...unitA, target: 'Clau A' },
                { ...unitB, target: 'Clau B' },
            ]);
            await fs.writeFile(path.join(testTranslationsDir, 'messages.ca.xlf'), caXlf);

            const { execute, configure } = await import('./translations-sort');
            configure({ extractKeys: async () => new Set(['Key A', 'Key B', 'Key C']) });

            const result = await execute([], {});

            expect(result.success).toBe(true);
            expect(result.message).toContain('XLF file(s)');

            for (const file of ['messages.es.xlf', 'messages.ca.xlf']) {
                const sorted = await fs.readFile(path.join(testTranslationsDir, file), 'utf-8');
                const posA = sorted.indexOf('id="id_A"');
                const posB = sorted.indexOf('id="id_B"');
                const posC = sorted.indexOf('id="id_C"');
                expect(posA).toBeLessThan(posB);
                expect(posB).toBeLessThan(posC);
            }
        });

        it('should skip and warn about missing locale files without failing', async () => {
            // Remove Spanish file to simulate a missing locale
            await fs.remove(path.join(testTranslationsDir, 'messages.es.xlf'));

            const { execute, configure } = await import('./translations-sort');
            configure({ extractKeys: async () => new Set(['Key A', 'Key B', 'Key C']) });

            const result = await execute([], {});

            // Should still succeed (other locales, if present, are sorted)
            expect(result.success).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // printHelp
    // -----------------------------------------------------------------------

    describe('printHelp', () => {
        it('should print help text without throwing', async () => {
            const { printHelp } = await import('./translations-sort');
            expect(() => printHelp()).not.toThrow();
        });
    });

    // -----------------------------------------------------------------------
    // Extra units not in reference (edge case)
    // -----------------------------------------------------------------------

    describe('edge cases', () => {
        it('should append trans-units not present in reference order at the end', async () => {
            // es.xlf has an extra unit "id_X" that is NOT in messages.en.xlf
            const esWithExtra = makeXlf('es', [
                { ...unitB, target: 'Clave B' },
                { id: 'id_X', resname: 'Key X', source: 'Key X', target: 'Clave X' },
                { ...unitA, target: 'Clave A' },
                { ...unitC, target: 'Clave C' },
            ]);
            await fs.writeFile(path.join(testTranslationsDir, 'messages.es.xlf'), esWithExtra);

            const { execute, configure } = await import('./translations-sort');
            configure({ extractKeys: async () => new Set(['Key A', 'Key B', 'Key C']) });

            await execute([], { locale: 'es' });

            const sorted = await fs.readFile(path.join(testTranslationsDir, 'messages.es.xlf'), 'utf-8');
            // Known units sorted first
            const posA = sorted.indexOf('id="id_A"');
            const posB = sorted.indexOf('id="id_B"');
            const posC = sorted.indexOf('id="id_C"');
            const posX = sorted.indexOf('id="id_X"');
            expect(posA).toBeLessThan(posB);
            expect(posB).toBeLessThan(posC);
            // Extra unit still present
            expect(posX).toBeGreaterThan(-1);
        });

        it('should normalise irregular indentation in the source file', async () => {
            // Write a file with non-standard 12-space indentation on one trans-unit
            const esIrregular =
                `<?xml version="1.0" encoding="utf-8"?>\n` +
                `<xliff xmlns="urn:oasis:names:tc:xliff:document:1.2" version="1.2">\n` +
                `  <file source-language="en" target-language="es" datatype="plaintext" original="file.ext">\n` +
                `    <body>\n` +
                `            <trans-unit id="id_A" resname="Key A">\n` +
                `              <source>Key A</source>\n` +
                `              <target>Clave A</target>\n` +
                `            </trans-unit>\n` +
                `      <trans-unit id="id_B" resname="Key B">\n` +
                `        <source>Key B</source>\n` +
                `        <target>Clave B</target>\n` +
                `      </trans-unit>\n` +
                `      <trans-unit id="id_C" resname="Key C">\n` +
                `        <source>Key C</source>\n` +
                `        <target>Clave C</target>\n` +
                `      </trans-unit>\n` +
                `    </body>\n` +
                `  </file>\n` +
                `</xliff>`;
            await fs.writeFile(path.join(testTranslationsDir, 'messages.es.xlf'), esIrregular);

            const { execute, configure } = await import('./translations-sort');
            configure({ extractKeys: async () => new Set(['Key A', 'Key B', 'Key C']) });

            await execute([], { locale: 'es' });

            const sorted = await fs.readFile(path.join(testTranslationsDir, 'messages.es.xlf'), 'utf-8');
            // All trans-units should now use 6-space indent
            const lines = sorted.split('\n').filter(l => l.includes('<trans-unit'));
            for (const line of lines) {
                expect(line).toMatch(/^ {6}<trans-unit /);
            }
        });
    });
});
