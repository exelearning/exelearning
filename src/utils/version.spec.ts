/**
 * Tests for version utility
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { getAppVersion, configure, resetDependencies } from './version';

describe('version utility', () => {
    const originalEnv = process.env.APP_VERSION;

    beforeEach(() => {
        // Clear the env var before each test
        delete process.env.APP_VERSION;
    });

    afterEach(() => {
        // Restore original value
        if (originalEnv !== undefined) {
            process.env.APP_VERSION = originalEnv;
        } else {
            delete process.env.APP_VERSION;
        }
        resetDependencies();
    });

    describe('getAppVersion', () => {
        it('should return APP_VERSION from environment if set', () => {
            process.env.APP_VERSION = 'v3.1.0-test';
            const version = getAppVersion();
            expect(version).toBe('v3.1.0-test');
        });

        it('should return version from package.json if APP_VERSION not set', () => {
            // This test relies on package.json being found
            const version = getAppVersion();
            expect(version).toMatch(/^v\d+\.\d+\.\d+/);
        });

        it('should return a version string starting with v', () => {
            const version = getAppVersion();
            expect(version.startsWith('v')).toBe(true);
        });

        it('should return valid semver format', () => {
            const version = getAppVersion();
            // Check that it's a valid version format (v followed by numbers and dots)
            expect(version).toMatch(/^v\d+\.\d+\.\d+/);
        });

        it('should handle environment version without v prefix', () => {
            process.env.APP_VERSION = '3.1.0';
            const version = getAppVersion();
            expect(version).toBe('3.1.0'); // Returns as-is from env
        });

        it('should return consistent results on multiple calls', () => {
            const version1 = getAppVersion();
            const version2 = getAppVersion();
            expect(version1).toBe(version2);
        });
    });

    describe('dependency injection', () => {
        it('should return v0.0.0 when package.json is not found', () => {
            configure({
                existsSync: () => false,
                dirname: '/nonexistent',
            });

            const version = getAppVersion();
            expect(version).toBe('v0.0.0');
        });

        it('should return v0.0.0 when package.json contains invalid JSON', () => {
            configure({
                existsSync: () => true,
                readFileSync: () => 'not valid json {{{',
                dirname: '/test',
            });

            const version = getAppVersion();
            expect(version).toBe('v0.0.0');
        });

        it('should return version from mock package.json', () => {
            configure({
                existsSync: () => true,
                readFileSync: () => JSON.stringify({ version: '1.2.3' }),
                dirname: '/test',
            });

            const version = getAppVersion();
            expect(version).toBe('v1.2.3');
        });

        it('should search up directory tree until package.json is found', () => {
            let callCount = 0;
            configure({
                existsSync: path => {
                    callCount++;
                    // Return true only on the 3rd call (simulating finding package.json 2 dirs up)
                    return callCount === 3;
                },
                readFileSync: () => JSON.stringify({ version: '2.0.0' }),
                dirname: '/a/b/c',
            });

            const version = getAppVersion();
            expect(version).toBe('v2.0.0');
            expect(callCount).toBe(3);
        });

        it('should reset dependencies correctly', () => {
            configure({
                existsSync: () => false,
                dirname: '/nonexistent',
            });

            // First call with mocked deps
            expect(getAppVersion()).toBe('v0.0.0');

            // Reset and call again
            resetDependencies();
            const version = getAppVersion();

            // After reset, should find the real package.json
            expect(version).toMatch(/^v\d+\.\d+\.\d+/);
        });

        it('should stop searching after 10 directories', () => {
            let callCount = 0;
            configure({
                existsSync: () => {
                    callCount++;
                    return false; // Never find package.json
                },
                dirname: '/a/b/c/d/e/f/g/h/i/j/k/l/m',
            });

            const version = getAppVersion();
            expect(version).toBe('v0.0.0');
            expect(callCount).toBe(10); // Should stop after 10 iterations
        });
    });
});
