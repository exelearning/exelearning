/**
 * Tests for Translations Command
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('Translations Command', () => {
    const testDir = path.join(process.cwd(), 'test', 'temp', 'translations-test');
    const testTranslationsDir = path.join(testDir, 'translations');
    const originalCwd = process.cwd;

    beforeEach(async () => {
        // Create test directory structure
        await fs.ensureDir(testTranslationsDir);

        // Create sample XLF file
        const sampleXlf = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="es" datatype="plaintext">
    <body>
      <trans-unit id="abc123" resname="existing.key">
        <source>existing.key</source>
        <target>Clave existente</target>
      </trans-unit>
    </body>
  </file>
</xliff>`;

        await fs.writeFile(path.join(testTranslationsDir, 'messages.es.xlf'), sampleXlf);
        await fs.writeFile(path.join(testTranslationsDir, 'messages.en.xlf'), sampleXlf);

        // Mock process.cwd to return test directory
        process.cwd = () => testDir;
    });

    afterEach(async () => {
        // Restore process.cwd
        process.cwd = originalCwd;

        // Clean up test directory
        if (await fs.pathExists(testDir)) {
            await fs.remove(testDir);
        }

        // Reload translations with correct paths to avoid polluting other tests
        const { reloadTranslations } = await import('../../services/translation');
        reloadTranslations();
    });

    describe('execute', () => {
        it('should fail when translations directory does not exist', async () => {
            // Remove translations directory
            await fs.remove(testTranslationsDir);

            const { execute } = await import('./translations');
            const result = await execute([], {});

            expect(result.success).toBe(false);
            expect(result.message).toContain('not found');
        });

        it('should fail for unknown locale', async () => {
            const { execute } = await import('./translations');
            const result = await execute([], { locale: 'invalid_locale_xyz' });

            expect(result.success).toBe(false);
            expect(result.message).toContain('Unknown locale');
        });

        it('should process specific locale', async () => {
            const { execute } = await import('./translations');
            const result = await execute([], { locale: 'es', 'clean-only': true });

            expect(result.success).toBe(true);
            expect(result.stats?.locales).toEqual(['es']);
        });

        it('should support clean-only mode', async () => {
            const { execute } = await import('./translations');
            const result = await execute([], { locale: 'es', 'clean-only': true });

            expect(result.success).toBe(true);
            expect(result.message).toContain('Cleaned');
            expect(result.message).not.toContain('Extracted');
        });

        it('should support extract-only mode', async () => {
            const { execute } = await import('./translations');
            const result = await execute([], { locale: 'es', 'extract-only': true });

            expect(result.success).toBe(true);
            expect(result.message).toContain('Extracted');
            expect(result.message).not.toContain('Cleaned');
        });

        it('should return stats with extracted and cleaned counts', async () => {
            const { execute } = await import('./translations');
            const result = await execute([], { locale: 'es', 'clean-only': true });

            expect(result.stats).toBeDefined();
            expect(typeof result.stats?.extracted).toBe('number');
            expect(typeof result.stats?.cleaned).toBe('number');
            expect(Array.isArray(result.stats?.locales)).toBe(true);
        });
    });

    describe('XLF cleaning', () => {
        it('should clean target starting with __', async () => {
            const xlfWithUnderscore = `<?xml version="1.0"?>
<xliff version="1.2">
  <file>
    <body>
      <trans-unit id="1" resname="test.key">
        <source>test.key</source>
        <target>__test.key</target>
      </trans-unit>
    </body>
  </file>
</xliff>`;
            await fs.writeFile(path.join(testTranslationsDir, 'messages.es.xlf'), xlfWithUnderscore);

            const { execute } = await import('./translations');
            await execute([], { locale: 'es', 'clean-only': true });

            const content = await fs.readFile(path.join(testTranslationsDir, 'messages.es.xlf'), 'utf-8');
            expect(content).toContain('<target></target>');
            expect(content).not.toContain('<target>__test.key</target>');
        });

        it('should remove trans-units with backslash source', async () => {
            // The regex removes trans-units where source starts with \\
            // In XLF files, \\\\ (4 backslashes in string literal) = 2 backslashes in file = \\ match
            const xlfWithBackslash = `<?xml version="1.0"?>
<xliff version="1.2">
  <file>
    <body>
      <trans-unit id="2" resname="backslash.key">
        <source>\\\\backslash</source>
        <target></target>
      </trans-unit>
    </body>
  </file>
</xliff>`;
            await fs.writeFile(path.join(testTranslationsDir, 'messages.es.xlf'), xlfWithBackslash);

            const { execute } = await import('./translations');
            const result = await execute([], { locale: 'es', 'clean-only': true });

            // The function should complete successfully
            expect(result.success).toBe(true);

            const content = await fs.readFile(path.join(testTranslationsDir, 'messages.es.xlf'), 'utf-8');
            // Content should have been cleaned (backslash entry removed or body emptied)
            expect(content).not.toContain('backslash.key');
        });

        it('should clean multiple empty lines', async () => {
            const xlfWithEmptyLines = `<?xml version="1.0"?>
<xliff version="1.2">
  <file>
    <body>
      <trans-unit id="1" resname="test">
        <source>test</source>
        <target></target>
      </trans-unit>



      <trans-unit id="2" resname="test2">
        <source>test2</source>
        <target></target>
      </trans-unit>
    </body>
  </file>
</xliff>`;
            await fs.writeFile(path.join(testTranslationsDir, 'messages.es.xlf'), xlfWithEmptyLines);

            const { execute } = await import('./translations');
            await execute([], { locale: 'es', 'clean-only': true });

            const content = await fs.readFile(path.join(testTranslationsDir, 'messages.es.xlf'), 'utf-8');
            // Should not have more than 2 consecutive newlines
            expect(content).not.toMatch(/\n\s*\n\s*\n\s*\n/);
        });
    });

    describe('XLF key extraction', () => {
        it('should add new keys to XLF', async () => {
            // Create a source file with translation keys
            const srcDir = path.join(testDir, 'src');
            await fs.ensureDir(srcDir);
            await fs.writeFile(path.join(srcDir, 'test.ts'), `const msg = trans('new.key.from.source');`);

            const { execute } = await import('./translations');
            await execute([], { locale: 'es', 'extract-only': true });

            const content = await fs.readFile(path.join(testTranslationsDir, 'messages.es.xlf'), 'utf-8');
            expect(content).toContain('new.key.from.source');
        });

        it('should skip existing keys', async () => {
            const { execute } = await import('./translations');
            await execute([], { locale: 'es', 'extract-only': true });

            const content = await fs.readFile(path.join(testTranslationsDir, 'messages.es.xlf'), 'utf-8');
            // Should not duplicate existing.key
            const matches = content.match(/resname="existing\.key"/g);
            expect(matches?.length || 0).toBe(1);
        });

        it('should return added=0 when all keys already exist', async () => {
            // Create source file with only keys that already exist in XLF
            const srcDir = path.join(testDir, 'src');
            await fs.ensureDir(srcDir);
            await fs.writeFile(path.join(srcDir, 'existing.ts'), `const msg = trans('existing.key');`);

            const { execute } = await import('./translations');
            const result = await execute([], { locale: 'es', 'extract-only': true });

            expect(result.success).toBe(true);
            expect(result.stats?.extracted).toBe(0);
        });

        it('should handle multiple translation patterns', async () => {
            const srcDir = path.join(testDir, 'src');
            await fs.ensureDir(srcDir);
            await fs.writeFile(
                path.join(srcDir, 'patterns.ts'),
                `
                    const a = trans('pattern.trans');
                    const b = __('pattern.underscore');
                    const c = t('pattern.t');
                `,
            );

            const { execute } = await import('./translations');
            await execute([], { locale: 'es', 'extract-only': true });

            const content = await fs.readFile(path.join(testTranslationsDir, 'messages.es.xlf'), 'utf-8');
            expect(content).toContain('pattern.trans');
            expect(content).toContain('pattern.underscore');
            expect(content).toContain('pattern.t');
        });

        it('should skip template expressions', async () => {
            const srcDir = path.join(testDir, 'src');
            await fs.ensureDir(srcDir);
            await fs.writeFile(path.join(srcDir, 'template.ts'), `const msg = trans(\`dynamic.\${var}\`);`);

            const { execute } = await import('./translations');
            await execute([], { locale: 'es', 'extract-only': true });

            const content = await fs.readFile(path.join(testTranslationsDir, 'messages.es.xlf'), 'utf-8');
            // Should not add keys with template expressions
            expect(content).not.toContain('${');
        });
    });

    describe('printHelp', () => {
        it('should not throw when called', async () => {
            const { printHelp } = await import('./translations');

            const originalLog = console.log;
            let output = '';
            console.log = (msg: string) => {
                output += msg;
            };

            expect(() => printHelp()).not.toThrow();

            console.log = originalLog;

            // Should contain key sections
            expect(output).toContain('translations');
            expect(output).toContain('--locale');
            expect(output).toContain('--extract-only');
            expect(output).toContain('--clean-only');
        });
    });

    describe('edge cases', () => {
        it('should handle missing XLF file for locale', async () => {
            await fs.remove(path.join(testTranslationsDir, 'messages.es.xlf'));

            const { execute } = await import('./translations');
            const result = await execute([], { locale: 'es', 'clean-only': true });

            // Should not crash, just warn
            expect(result.success).toBe(true);
        });

        it('should handle XLF without body tag gracefully', async () => {
            // Create source file with translation keys so extraction is attempted
            const srcDir = path.join(testDir, 'src');
            await fs.ensureDir(srcDir);
            await fs.writeFile(path.join(srcDir, 'no-body.ts'), `const msg = trans('new.key.for.no.body');`);

            // Create XLF without </body> tag
            const invalidXlf = `<?xml version="1.0"?>
<xliff version="1.2">
  <file>
  </file>
</xliff>`;
            await fs.writeFile(path.join(testTranslationsDir, 'messages.es.xlf'), invalidXlf);

            const { execute } = await import('./translations');
            const result = await execute([], { locale: 'es', 'extract-only': true });

            // Should not crash, and should have 0 extracted (couldn't add due to missing body)
            expect(result.success).toBe(true);
            expect(result.stats?.extracted).toBe(0);
        });

        it('should escape XML special characters in keys', async () => {
            const srcDir = path.join(testDir, 'src');
            await fs.ensureDir(srcDir);
            await fs.writeFile(path.join(srcDir, 'special.ts'), `const msg = trans('key.with<special>&chars');`);

            const { execute } = await import('./translations');
            await execute([], { locale: 'es', 'extract-only': true });

            const content = await fs.readFile(path.join(testTranslationsDir, 'messages.es.xlf'), 'utf-8');
            // Should contain escaped version
            expect(content).toContain('&lt;');
            expect(content).toContain('&gt;');
            expect(content).toContain('&amp;');
        });
    });
});
