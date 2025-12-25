import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import { execute, printHelp, VALID_FORMATS } from './elp-export';
import * as fs from 'fs/promises';
import * as path from 'path';
import { zipSync, unzipSync, strToU8 } from 'fflate';

// Create a minimal test ELP file for integration tests
const TEST_DIR = '/tmp/elp-export-test';
const TEST_ELP_PATH = path.join(TEST_DIR, 'test.elp');
const TEST_OUTPUT_DIR = path.join(TEST_DIR, 'output');

async function createTestElpFile(): Promise<void> {
    // Create minimal valid content.xml following ODE DTD structure
    const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeProperties>
  <odeProperty>
    <key>pp_title</key>
    <value>Test Project</value>
  </odeProperty>
  <odeProperty>
    <key>pp_author</key>
    <value>Test Author</value>
  </odeProperty>
  <odeProperty>
    <key>pp_lang</key>
    <value>en</value>
  </odeProperty>
</odeProperties>
<odeNavStructures>
  <odeNavStructure>
    <odePageId>page1</odePageId>
    <odeParentPageId></odeParentPageId>
    <pageName>Test Page</pageName>
    <odeNavStructureOrder>0</odeNavStructureOrder>
    <odePagStructures>
      <odePagStructure>
        <odePageId>page1</odePageId>
        <odeBlockId>block1</odeBlockId>
        <blockName>Block 1</blockName>
        <odePagStructureOrder>0</odePagStructureOrder>
        <odeComponents>
          <odeComponent>
            <odePageId>page1</odePageId>
            <odeBlockId>block1</odeBlockId>
            <odeIdeviceId>comp1</odeIdeviceId>
            <odeIdeviceTypeName>FreeTextIdevice</odeIdeviceTypeName>
            <htmlView><![CDATA[<p>Hello World</p>]]></htmlView>
            <odeComponentsOrder>0</odeComponentsOrder>
          </odeComponent>
        </odeComponents>
      </odePagStructure>
    </odePagStructures>
  </odeNavStructure>
</odeNavStructures>
</ode>`;

    // Create a minimal ZIP file (ELP format) using fflate
    const zipData = zipSync({
        'content.xml': strToU8(contentXml),
    });

    // Write to test directory
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.writeFile(TEST_ELP_PATH, Buffer.from(zipData));
}

async function cleanupTestDir(): Promise<void> {
    try {
        await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {
        // Ignore cleanup errors
    }
}

describe('elp:export command', () => {
    describe('printHelp', () => {
        it('should print help without errors', () => {
            expect(() => printHelp()).not.toThrow();
        });
    });

    describe('VALID_FORMATS', () => {
        it('should contain all expected formats', () => {
            expect(VALID_FORMATS).toContain('html5');
            expect(VALID_FORMATS).toContain('html5-sp');
            expect(VALID_FORMATS).toContain('scorm12');
            expect(VALID_FORMATS).toContain('scorm2004');
            expect(VALID_FORMATS).toContain('ims');
            expect(VALID_FORMATS).toContain('epub3');
            expect(VALID_FORMATS).toContain('elpx');
        });
    });

    describe('execute - validation', () => {
        it('should require INPUT argument', async () => {
            const result = await execute([], {});
            expect(result.success).toBe(false);
            expect(result.message).toContain('INPUT');
        });

        it('should require OUTPUT argument', async () => {
            const result = await execute(['input.elp'], {});
            expect(result.success).toBe(false);
            expect(result.message).toContain('OUTPUT');
        });

        it('should reject invalid format', async () => {
            const result = await execute(['input.elp', './output', 'invalid'], {});
            expect(result.success).toBe(false);
            expect(result.message).toContain('Invalid format');
            expect(result.message).toContain('invalid');
        });

        it('should show help when --help flag is passed', async () => {
            const result = await execute([], { help: true });
            expect(result.success).toBe(true);
        });

        it('should show help when -h flag is passed', async () => {
            const result = await execute([], { h: true });
            expect(result.success).toBe(true);
        });

        it('should fail when input file does not exist', async () => {
            const result = await execute(['nonexistent.elp', './output'], {});
            expect(result.success).toBe(false);
            expect(result.message).toContain('not found');
        });

        it('should succeed for epub3 format', async () => {
            await createTestElpFile();
            const result = await execute([TEST_ELP_PATH, TEST_OUTPUT_DIR, 'epub3'], {});
            expect(result.success).toBe(true);
            expect(result.message).toContain('Export completed');
            await cleanupTestDir();
        });

        it('should succeed for elpx format', async () => {
            await createTestElpFile();
            const result = await execute([TEST_ELP_PATH, TEST_OUTPUT_DIR, 'elpx'], {});
            expect(result.success).toBe(true);
            expect(result.message).toContain('Export completed');
            await cleanupTestDir();
        });
    });

    describe('execute - integration', () => {
        beforeAll(async () => {
            await createTestElpFile();
        });

        afterAll(async () => {
            await cleanupTestDir();
        });

        it('should export to html5 format', async () => {
            const outputPath = path.join(TEST_OUTPUT_DIR, 'test_web.zip');
            const result = await execute([TEST_ELP_PATH, outputPath], {});
            expect(result.success).toBe(true);
            expect(result.message).toContain('html5');

            // Verify output file exists
            const exists = await fs
                .access(outputPath)
                .then(() => true)
                .catch(() => false);
            expect(exists).toBe(true);
        });

        it('should export to html5-sp (single page) format', async () => {
            const outputPath = path.join(TEST_OUTPUT_DIR, 'test_page.zip');
            const result = await execute([TEST_ELP_PATH, outputPath, 'html5-sp'], {});
            expect(result.success).toBe(true);
            expect(result.message).toContain('html5-sp');
        });

        it('should export to scorm12 format', async () => {
            const outputPath = path.join(TEST_OUTPUT_DIR, 'test_scorm12.zip');
            const result = await execute([TEST_ELP_PATH, outputPath, 'scorm12'], {});
            expect(result.success).toBe(true);
            expect(result.message).toContain('scorm12');

            // Verify output contains imsmanifest.xml
            const zipBuffer = await fs.readFile(outputPath);
            const zip = unzipSync(new Uint8Array(zipBuffer));
            expect(zip['imsmanifest.xml']).toBeDefined();
        });

        it('should export to scorm2004 format', async () => {
            const outputPath = path.join(TEST_OUTPUT_DIR, 'test_scorm2004.zip');
            const result = await execute([TEST_ELP_PATH, outputPath, 'scorm2004'], {});
            expect(result.success).toBe(true);
            expect(result.message).toContain('scorm2004');
        });

        it('should export to ims format', async () => {
            const outputPath = path.join(TEST_OUTPUT_DIR, 'test_ims.zip');
            const result = await execute([TEST_ELP_PATH, outputPath, 'ims'], {});
            expect(result.success).toBe(true);
            expect(result.message).toContain('ims');
        });

        it('should export to epub3 format', async () => {
            const outputPath = path.join(TEST_OUTPUT_DIR, 'test_epub.epub');
            const result = await execute([TEST_ELP_PATH, outputPath, 'epub3'], {});
            expect(result.success).toBe(true);
            expect(result.message).toContain('epub3');

            // Verify output file exists
            const exists = await fs
                .access(outputPath)
                .then(() => true)
                .catch(() => false);
            expect(exists).toBe(true);

            // Verify output contains EPUB-required files
            const zipBuffer = await fs.readFile(outputPath);
            const zip = unzipSync(new Uint8Array(zipBuffer));
            expect(zip['mimetype']).toBeDefined();
            expect(zip['META-INF/container.xml']).toBeDefined();
        });

        it('should accept --format flag', async () => {
            const outputPath = path.join(TEST_OUTPUT_DIR, 'test_format_flag.zip');
            const result = await execute([TEST_ELP_PATH, outputPath], { format: 'scorm12' });
            expect(result.success).toBe(true);
            expect(result.message).toContain('scorm12');
        });

        it('should accept -f flag', async () => {
            const outputPath = path.join(TEST_OUTPUT_DIR, 'test_f_flag.zip');
            const result = await execute([TEST_ELP_PATH, outputPath], { f: 'ims' });
            expect(result.success).toBe(true);
            expect(result.message).toContain('ims');
        });

        it('should add .zip extension if not provided', async () => {
            const outputPath = path.join(TEST_OUTPUT_DIR, 'test_no_ext');
            const result = await execute([TEST_ELP_PATH, outputPath], {});
            expect(result.success).toBe(true);

            // Verify file was created with .zip extension
            const exists = await fs
                .access(outputPath + '.zip')
                .then(() => true)
                .catch(() => false);
            expect(exists).toBe(true);
        });

        it('should produce valid ZIP files', async () => {
            const outputPath = path.join(TEST_OUTPUT_DIR, 'test_valid_zip.zip');
            await execute([TEST_ELP_PATH, outputPath], {});

            const zipBuffer = await fs.readFile(outputPath);
            const zip = unzipSync(new Uint8Array(zipBuffer));

            // Verify basic structure
            expect(zip['index.html']).toBeDefined();
            expect(zip['content.xml']).toBeDefined();
        });

        it('should accept --base-url flag', async () => {
            const outputPath = path.join(TEST_OUTPUT_DIR, 'test_base_url.zip');
            const result = await execute([TEST_ELP_PATH, outputPath], {
                'base-url': 'https://example.com/content/',
            });
            expect(result.success).toBe(true);
        });

        it('should accept -b flag for base URL', async () => {
            const outputPath = path.join(TEST_OUTPUT_DIR, 'test_b_flag.zip');
            const result = await execute([TEST_ELP_PATH, outputPath], {
                b: 'https://example.com/',
            });
            expect(result.success).toBe(true);
        });

        it('should enable debug mode with --debug flag', async () => {
            const outputPath = path.join(TEST_OUTPUT_DIR, 'test_debug.zip');
            // Capture console output
            const originalLog = console.log;
            const logs: string[] = [];
            console.log = (...args: unknown[]) => {
                logs.push(args.join(' '));
            };

            try {
                const result = await execute([TEST_ELP_PATH, outputPath], {
                    debug: true,
                });
                expect(result.success).toBe(true);
                // Debug output should contain [DEBUG]
                expect(logs.some(log => log.includes('[DEBUG]'))).toBe(true);
            } finally {
                console.log = originalLog;
            }
        });

        it('should enable debug mode with -d flag', async () => {
            const outputPath = path.join(TEST_OUTPUT_DIR, 'test_d_flag.zip');
            const originalLog = console.log;
            const logs: string[] = [];
            console.log = (...args: unknown[]) => {
                logs.push(args.join(' '));
            };

            try {
                const result = await execute([TEST_ELP_PATH, outputPath], { d: true });
                expect(result.success).toBe(true);
                expect(logs.some(log => log.includes('[DEBUG]'))).toBe(true);
            } finally {
                console.log = originalLog;
            }
        });

        it('should handle debug mode with base URL logging', async () => {
            const outputPath = path.join(TEST_OUTPUT_DIR, 'test_debug_baseurl.zip');
            const originalLog = console.log;
            const logs: string[] = [];
            console.log = (...args: unknown[]) => {
                logs.push(args.join(' '));
            };

            try {
                const result = await execute([TEST_ELP_PATH, outputPath], {
                    debug: true,
                    'base-url': 'https://test.com/',
                });
                expect(result.success).toBe(true);
                // Should log the base URL in debug mode
                expect(logs.some(log => log.includes('Base URL'))).toBe(true);
            } finally {
                console.log = originalLog;
            }
        });
    });

    describe('execute - stdin input', () => {
        it('should read ELP from stdin when input is "-"', async () => {
            // Create test ELP content following ODE DTD structure
            const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeProperties>
  <odeProperty>
    <key>pp_title</key>
    <value>Stdin Project</value>
  </odeProperty>
  <odeProperty>
    <key>pp_author</key>
    <value>Test</value>
  </odeProperty>
  <odeProperty>
    <key>pp_lang</key>
    <value>en</value>
  </odeProperty>
</odeProperties>
<odeNavStructures>
  <odeNavStructure>
    <odePageId>p1</odePageId>
    <odeParentPageId></odeParentPageId>
    <pageName>Page</pageName>
    <odeNavStructureOrder>0</odeNavStructureOrder>
    <odePagStructures>
      <odePagStructure>
        <odePageId>p1</odePageId>
        <odeBlockId>b1</odeBlockId>
        <blockName>Block</blockName>
        <odePagStructureOrder>0</odePagStructureOrder>
        <odeComponents>
          <odeComponent>
            <odePageId>p1</odePageId>
            <odeBlockId>b1</odeBlockId>
            <odeIdeviceId>c1</odeIdeviceId>
            <odeIdeviceTypeName>FreeTextIdevice</odeIdeviceTypeName>
            <htmlView><![CDATA[<p>Test</p>]]></htmlView>
            <odeComponentsOrder>0</odeComponentsOrder>
          </odeComponent>
        </odeComponents>
      </odePagStructure>
    </odePagStructures>
  </odeNavStructure>
</odeNavStructures>
</ode>`;
            const zipData = zipSync({ 'content.xml': strToU8(contentXml) });
            const buffer = Buffer.from(zipData);

            // Mock stdin
            const originalStdin = process.stdin;
            const mockStdin = {
                [Symbol.asyncIterator]: async function* () {
                    yield buffer;
                },
            };
            Object.defineProperty(process, 'stdin', { value: mockStdin, writable: true });

            try {
                await fs.mkdir(TEST_DIR, { recursive: true });
                const outputPath = path.join(TEST_OUTPUT_DIR, 'stdin_test.zip');
                const result = await execute(['-', outputPath], { debug: true });

                expect(result.success).toBe(true);
                expect(result.message).toContain('html5');
            } finally {
                Object.defineProperty(process, 'stdin', { value: originalStdin, writable: true });
                await cleanupTestDir();
            }
        });
    });

    describe('execute - error handling', () => {
        it('should handle corrupted ELP file gracefully', async () => {
            // Create a corrupted ELP file
            const corruptedPath = path.join(TEST_DIR, 'corrupted.elp');
            await fs.mkdir(TEST_DIR, { recursive: true });
            await fs.writeFile(corruptedPath, 'not a valid zip file');

            const outputPath = path.join(TEST_OUTPUT_DIR, 'corrupted_output.zip');
            const result = await execute([corruptedPath, outputPath], {});

            expect(result.success).toBe(false);
            expect(result.message).toContain('failed');
        });

        it('should handle export errors gracefully', async () => {
            // Create an ELP without content.xml (truly invalid)
            const zipData = zipSync({
                'dummy.txt': strToU8('no content here'),
            });

            const invalidElpPath = path.join(TEST_DIR, 'no_content.elp');
            await fs.mkdir(TEST_DIR, { recursive: true });
            await fs.writeFile(invalidElpPath, Buffer.from(zipData));

            const outputPath = path.join(TEST_OUTPUT_DIR, 'invalid_output.zip');
            const result = await execute([invalidElpPath, outputPath], {});

            // Should fail gracefully when content.xml is missing
            expect(result.success).toBe(false);
            expect(result.message).toContain('content.xml');
        });
    });
});
