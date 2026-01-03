/**
 * Tests for Tmp Cleanup Command
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import { execute, printHelp, runCli, type TmpCleanupDependencies } from './tmp-cleanup';

describe('Tmp Cleanup Command', () => {
    const testDir = path.join(process.cwd(), 'test', 'temp', 'tmp-cleanup-test');
    const originalEnv = { ...process.env };

    beforeEach(async () => {
        await fs.ensureDir(testDir);
        // Set files dir to test directory
        process.env.ELYSIA_FILES_DIR = testDir;
        // Create tmp subdirectory
        await fs.ensureDir(path.join(testDir, 'tmp'));
    });

    afterEach(async () => {
        await fs.remove(testDir);
        process.env = { ...originalEnv };
    });

    describe('execute', () => {
        it('should return success when tmp directory is empty', async () => {
            const result = await execute([], {});

            expect(result.success).toBe(true);
            expect(result.stats?.filesRemoved).toBe(0);
            expect(result.stats?.dirsRemoved).toBe(0);
        });

        it('should return success when tmp directory does not exist', async () => {
            await fs.remove(path.join(testDir, 'tmp'));
            const result = await execute([], {});

            expect(result.success).toBe(true);
            expect(result.message).toContain('does not exist');
        });

        it('should remove old files', async () => {
            const tmpDir = path.join(testDir, 'tmp');
            const oldFile = path.join(tmpDir, 'old.txt');

            // Create file and set mtime to 2 days ago
            await fs.writeFile(oldFile, 'old content');
            const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
            await fs.utimes(oldFile, twoDaysAgo / 1000, twoDaysAgo / 1000);

            const result = await execute([], { 'max-age': '86400' }); // 24 hours

            expect(result.success).toBe(true);
            expect(result.stats?.filesRemoved).toBe(1);
            expect(await fs.pathExists(oldFile)).toBe(false);
        });

        it('should skip recent files', async () => {
            const tmpDir = path.join(testDir, 'tmp');
            const recentFile = path.join(tmpDir, 'recent.txt');

            // Create recent file
            await fs.writeFile(recentFile, 'recent content');

            const result = await execute([], { 'max-age': '86400' });

            expect(result.success).toBe(true);
            expect(result.stats?.skipped).toBeGreaterThan(0);
            expect(await fs.pathExists(recentFile)).toBe(true);
        });

        it('should remove empty directories', async () => {
            const tmpDir = path.join(testDir, 'tmp');
            const emptyDir = path.join(tmpDir, 'empty');

            await fs.ensureDir(emptyDir);

            const result = await execute([], { 'max-age': '86400' });

            expect(result.success).toBe(true);
            expect(result.stats?.dirsRemoved).toBe(1);
            expect(await fs.pathExists(emptyDir)).toBe(false);
        });

        it('should handle dry-run mode', async () => {
            const tmpDir = path.join(testDir, 'tmp');
            const oldFile = path.join(tmpDir, 'old-dryrun.txt');

            await fs.writeFile(oldFile, 'content');
            const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
            await fs.utimes(oldFile, twoDaysAgo / 1000, twoDaysAgo / 1000);

            const result = await execute([], { 'max-age': '86400', 'dry-run': true });

            expect(result.success).toBe(true);
            expect(result.stats?.filesRemoved).toBe(1); // Counted but not removed
            // File should still exist in dry-run
            expect(await fs.pathExists(oldFile)).toBe(true);
        });

        it('should recursively clean subdirectories', async () => {
            const tmpDir = path.join(testDir, 'tmp');
            const subDir = path.join(tmpDir, 'sub', 'deep');
            const oldFile = path.join(subDir, 'old.txt');

            await fs.ensureDir(subDir);
            await fs.writeFile(oldFile, 'content');
            const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
            await fs.utimes(oldFile, twoDaysAgo / 1000, twoDaysAgo / 1000);

            const result = await execute([], { 'max-age': '86400' });

            expect(result.success).toBe(true);
            expect(result.stats?.filesRemoved).toBeGreaterThan(0);
        });

        it('should reject invalid max-age', async () => {
            const result = await execute([], { 'max-age': '0' });

            expect(result.success).toBe(false);
            expect(result.message).toContain('greater than zero');
        });

        it('should reject negative max-age', async () => {
            const result = await execute([], { 'max-age': '-100' });

            expect(result.success).toBe(false);
            expect(result.message).toContain('greater than zero');
        });

        it('should use custom max-age', async () => {
            const tmpDir = path.join(testDir, 'tmp');
            const file = path.join(tmpDir, 'test.txt');

            await fs.writeFile(file, 'content');
            // Set mtime to 2 hours ago
            const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
            await fs.utimes(file, twoHoursAgo / 1000, twoHoursAgo / 1000);

            // With 1 hour max-age, file should be removed
            const result = await execute([], { 'max-age': '3600' });

            expect(result.success).toBe(true);
            expect(result.stats?.filesRemoved).toBe(1);
        });

        it('should handle mixed old and new files', async () => {
            const tmpDir = path.join(testDir, 'tmp');
            const oldFile = path.join(tmpDir, 'old.txt');
            const newFile = path.join(tmpDir, 'new.txt');

            // Create old file
            await fs.writeFile(oldFile, 'old');
            const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
            await fs.utimes(oldFile, twoDaysAgo / 1000, twoDaysAgo / 1000);

            // Create new file (uses current time by default)
            await fs.writeFile(newFile, 'new');

            const result = await execute([], { 'max-age': '86400' });

            expect(result.success).toBe(true);
            expect(result.stats?.filesRemoved).toBe(1);
            expect(result.stats?.skipped).toBe(1);
            expect(await fs.pathExists(oldFile)).toBe(false);
            expect(await fs.pathExists(newFile)).toBe(true);
        });

        it('should report failures gracefully', async () => {
            // This tests that failures are recorded but don't crash the process
            const tmpDir = path.join(testDir, 'tmp');
            await fs.ensureDir(tmpDir);

            const result = await execute([], {});

            expect(result.stats?.failures).toBeDefined();
            expect(Array.isArray(result.stats?.failures)).toBe(true);
        });

        it('should log directory removal in dry-run mode', async () => {
            const tmpDir = path.join(testDir, 'tmp');
            const emptyDir = path.join(tmpDir, 'empty-dryrun');
            await fs.ensureDir(emptyDir);

            const result = await execute([], { 'max-age': '86400', 'dry-run': true });

            expect(result.success).toBe(true);
            expect(result.stats?.dirsRemoved).toBeGreaterThan(0);
            // Directory should still exist in dry-run
            expect(await fs.pathExists(emptyDir)).toBe(true);
        });

        it('should skip directories with recent content', async () => {
            const tmpDir = path.join(testDir, 'tmp');
            const subDir = path.join(tmpDir, 'recent-dir');
            await fs.ensureDir(subDir);
            // Create a recent file inside
            await fs.writeFile(path.join(subDir, 'recent.txt'), 'content');

            const result = await execute([], { 'max-age': '86400' });

            expect(result.success).toBe(true);
            expect(result.stats?.skipped).toBeGreaterThan(0);
        });
    });

    describe('printHelp', () => {
        it('should not throw and contain key sections', () => {
            const originalLog = console.log;
            let output = '';
            console.log = (msg: string) => {
                output += msg;
            };

            expect(() => printHelp()).not.toThrow();

            console.log = originalLog;

            expect(output).toContain('tmp:cleanup');
            expect(output).toContain('--max-age');
            expect(output).toContain('--dry-run');
        });
    });

    describe('runCli', () => {
        const defaultDeps: TmpCleanupDependencies = {
            fileHelper: {
                getFilesDir: () => testDir,
            },
        };

        it('should show help when --help flag is passed', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', '--help'], defaultDeps, mockExit);

            expect(exitCode).toBe(0);
        });

        it('should show help when -h flag is passed', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', '-h'], defaultDeps, mockExit);

            expect(exitCode).toBe(0);
        });

        it('should exit with success when cleaning', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', 'tmp:cleanup'], defaultDeps, mockExit);

            expect(exitCode).toBe(0);
        });

        it('should exit with success on dry run', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', 'tmp:cleanup', '--dry-run'], defaultDeps, mockExit);

            expect(exitCode).toBe(0);
        });

        it('should exit with error when max-age is invalid', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            // Invalid max-age (0) should fail
            await runCli(['bun', 'cli', 'tmp:cleanup', '--max-age=0'], defaultDeps, mockExit);

            expect(exitCode).toBe(1);
        });

        it('should exit with success with valid max-age', async () => {
            let exitCode = -1;
            const mockExit = (code: number) => {
                exitCode = code;
            };

            await runCli(['bun', 'cli', 'tmp:cleanup', '--max-age=3600'], defaultDeps, mockExit);

            expect(exitCode).toBe(0);
        });
    });
});
