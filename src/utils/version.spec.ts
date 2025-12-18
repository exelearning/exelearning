/**
 * Tests for version utility
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { getAppVersion } from './version';

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
});
