import { describe, expect, it, beforeAll, afterAll, afterEach } from 'bun:test';
import { execute, printHelp, configureDependencies, resetDependencies } from './elp-convert';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { zipSync, unzipSync, strToU8 } from 'fflate';

// Fixtures directory
const FIXTURES_DIR = path.resolve(__dirname, '../../../test/fixtures');
const TEST_ELP = path.join(FIXTURES_DIR, 'basic-example.elp');

// Temp output directory for tests
const TEMP_DIR = path.join('/tmp', `elp-convert-test-${Date.now()}`);

describe('elp:convert command', () => {
    beforeAll(async () => {
        // Create temp directory for test outputs
        await fs.mkdir(TEMP_DIR, { recursive: true });
    });

    afterAll(async () => {
        // Clean up temp directory
        if (existsSync(TEMP_DIR)) {
            await fs.rm(TEMP_DIR, { recursive: true, force: true });
        }
    });

    describe('printHelp', () => {
        it('should print help without errors', () => {
            expect(() => printHelp()).not.toThrow();
        });
    });

    describe('argument validation', () => {
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

        it('should show help when --help flag is passed', async () => {
            const result = await execute([], { help: true });
            expect(result.success).toBe(true);
        });

        it('should show help when -h flag is passed', async () => {
            const result = await execute([], { h: true });
            expect(result.success).toBe(true);
        });
    });

    describe('input file validation', () => {
        it('should fail if input file does not exist', async () => {
            const result = await execute(['/nonexistent/file.elp', '/tmp/output.elpx'], {});
            expect(result.success).toBe(false);
            expect(result.message).toContain('Input file not found');
        });

        it('should accept existing ELP file', async () => {
            const outputPath = path.join(TEMP_DIR, 'test-existing.elpx');
            const result = await execute([TEST_ELP, outputPath], {});
            expect(result.success).toBe(true);
            expect(existsSync(outputPath)).toBe(true);
        });
    });

    describe('output directory validation', () => {
        it('should fail if output directory cannot be created', async () => {
            // Try to write to a system directory that definitely won't be writable
            const result = await execute([TEST_ELP, '/root/test/output.elpx'], {});
            expect(result.success).toBe(false);
            expect(result.message).toMatch(/Cannot create output directory|not writable/);
        });

        it('should create output directory if it does not exist', async () => {
            const newDir = path.join(TEMP_DIR, 'new-subdir', 'nested');
            const outputPath = path.join(newDir, 'output.elpx');
            const result = await execute([TEST_ELP, outputPath], {});
            expect(result.success).toBe(true);
            expect(existsSync(outputPath)).toBe(true);
        });
    });

    describe('conversion functionality', () => {
        it('should convert ELP to ELPX format', async () => {
            const outputPath = path.join(TEMP_DIR, 'converted.elpx');
            const result = await execute([TEST_ELP, outputPath], {});

            expect(result.success).toBe(true);
            expect(result.message).toContain('Conversion completed');
            expect(existsSync(outputPath)).toBe(true);

            // Check that output file is not empty
            const stats = await fs.stat(outputPath);
            expect(stats.size).toBeGreaterThan(0);
        });

        it('should add .elpx extension if not provided', async () => {
            const outputPath = path.join(TEMP_DIR, 'no-extension');
            const result = await execute([TEST_ELP, outputPath], {});

            expect(result.success).toBe(true);
            // The actual output should have .elpx extension
            expect(existsSync(outputPath + '.elpx')).toBe(true);
        });

        it('should accept --debug flag', async () => {
            const outputPath = path.join(TEMP_DIR, 'debug-test.elpx');
            const result = await execute([TEST_ELP, outputPath], { debug: true });
            expect(result.success).toBe(true);
        });

        it('should accept -d flag for debug', async () => {
            const outputPath = path.join(TEMP_DIR, 'debug-d-test.elpx');
            const result = await execute([TEST_ELP, outputPath], { d: true });
            expect(result.success).toBe(true);
        });

        it('should accept flag-based arguments', async () => {
            const outputPath = path.join(TEMP_DIR, 'flag-based.elpx');
            const result = await execute([], { input: TEST_ELP, output: outputPath });
            expect(result.success).toBe(true);
            expect(existsSync(outputPath)).toBe(true);
        });
    });

    describe('output file content', () => {
        it('should create a valid ZIP file', async () => {
            const outputPath = path.join(TEMP_DIR, 'zip-check.elpx');
            await execute([TEST_ELP, outputPath], {});

            // Check ZIP magic bytes (PK..)
            const buffer = await fs.readFile(outputPath);
            expect(buffer[0]).toBe(0x50); // 'P'
            expect(buffer[1]).toBe(0x4b); // 'K'
        });

        it('should contain content.xml in the output', async () => {
            const outputPath = path.join(TEMP_DIR, 'content-check.elpx');
            await execute([TEST_ELP, outputPath], {});

            // Use fflate to verify content
            const buffer = await fs.readFile(outputPath);
            const zip = unzipSync(new Uint8Array(buffer));

            expect(zip['content.xml']).toBeDefined();
        });
    });

    describe('error handling', () => {
        it('should handle invalid ELP file gracefully', async () => {
            // Create an invalid ELP file (not a valid ZIP)
            const invalidElp = path.join(TEMP_DIR, 'invalid.elp');
            await fs.writeFile(invalidElp, 'not a valid zip file');

            const outputPath = path.join(TEMP_DIR, 'invalid-output.elpx');
            const result = await execute([invalidElp, outputPath], {});

            expect(result.success).toBe(false);
            expect(result.message).toContain('Conversion failed');
        });

        it('should handle corrupted ZIP file', async () => {
            // Create a file with ZIP magic bytes but corrupted content
            const corruptedElp = path.join(TEMP_DIR, 'corrupted.elp');
            const corruptedBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
            await fs.writeFile(corruptedElp, corruptedBuffer);

            const outputPath = path.join(TEMP_DIR, 'corrupted-output.elpx');
            const result = await execute([corruptedElp, outputPath], {});

            expect(result.success).toBe(false);
            expect(result.message).toContain('Conversion failed');
        });

        it('should handle ELP without content.xml', async () => {
            // Create a valid ZIP but without content.xml
            const zipData = zipSync({
                'dummy.txt': strToU8('no content.xml here'),
            });

            const noContentElp = path.join(TEMP_DIR, 'no-content.elp');
            await fs.writeFile(noContentElp, Buffer.from(zipData));

            const outputPath = path.join(TEMP_DIR, 'no-content-output.elpx');
            const result = await execute([noContentElp, outputPath], {});

            expect(result.success).toBe(false);
            expect(result.message).toContain('Conversion failed');
        });
    });

    describe('directory writability', () => {
        it('should fail if output directory is not writable', async () => {
            // Use /proc on Linux or /System on macOS - directories that exist but aren't writable
            const readOnlyDir = process.platform === 'darwin' ? '/System' : '/proc';
            const outputPath = path.join(readOnlyDir, 'test-output.elpx');

            const result = await execute([TEST_ELP, outputPath], {});

            expect(result.success).toBe(false);
            expect(result.message).toMatch(/Cannot create output directory|not writable/);
        });
    });

    describe('stdin input', () => {
        afterEach(() => {
            resetDependencies();
        });

        it('should read from stdin when input is "-"', async () => {
            // Read test ELP file to use as stdin data
            const elpData = await fs.readFile(TEST_ELP);

            // Configure mock stdin reader
            configureDependencies({
                readStdin: async () => elpData,
            });

            const outputPath = path.join(TEMP_DIR, 'stdin-test.elpx');
            const result = await execute(['-', outputPath], {});

            expect(result.success).toBe(true);
            expect(result.message).toContain('Conversion completed');
            expect(existsSync(outputPath)).toBe(true);
        });

        it('should fail when stdin is empty', async () => {
            // Configure mock stdin reader that returns empty buffer
            configureDependencies({
                readStdin: async () => Buffer.alloc(0),
            });

            const outputPath = path.join(TEMP_DIR, 'stdin-empty.elpx');
            const result = await execute(['-', outputPath], {});

            expect(result.success).toBe(false);
            expect(result.message).toContain('No data received from stdin');
        });

        it('should handle stdin with debug mode', async () => {
            const elpData = await fs.readFile(TEST_ELP);

            configureDependencies({
                readStdin: async () => elpData,
            });

            const outputPath = path.join(TEMP_DIR, 'stdin-debug.elpx');
            const result = await execute(['-', outputPath], { debug: true });

            expect(result.success).toBe(true);
        });

        it('should fail when stdin contains invalid ELP data', async () => {
            // Configure mock stdin with invalid data
            configureDependencies({
                readStdin: async () => Buffer.from('invalid elp data'),
            });

            const outputPath = path.join(TEMP_DIR, 'stdin-invalid.elpx');
            const result = await execute(['-', outputPath], {});

            expect(result.success).toBe(false);
            expect(result.message).toContain('Conversion failed');
        });
    });
});
