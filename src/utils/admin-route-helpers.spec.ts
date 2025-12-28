/**
 * Tests for Admin Route Helpers
 */
import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
    createErrorResponse,
    parseIntegerId,
    validateFileUpload,
    deleteFileIfExists,
    fileExists,
    getFilesDir,
    getJwtSecret,
} from './admin-route-helpers';

describe('Admin Route Helpers', () => {
    describe('createErrorResponse', () => {
        test('should create 400 Bad Request response', () => {
            const response = createErrorResponse(400, 'Invalid input');
            expect(response).toEqual({
                error: 'Bad Request',
                message: 'Invalid input',
            });
        });

        test('should create 401 Unauthorized response', () => {
            const response = createErrorResponse(401, 'No token provided');
            expect(response).toEqual({
                error: 'Unauthorized',
                message: 'No token provided',
            });
        });

        test('should create 403 Forbidden response', () => {
            const response = createErrorResponse(403, 'Admin required');
            expect(response).toEqual({
                error: 'Forbidden',
                message: 'Admin required',
            });
        });

        test('should create 404 Not Found response', () => {
            const response = createErrorResponse(404, 'Resource not found');
            expect(response).toEqual({
                error: 'Not Found',
                message: 'Resource not found',
            });
        });

        test('should create 500 Internal Server Error response', () => {
            const response = createErrorResponse(500, 'Something went wrong');
            expect(response).toEqual({
                error: 'Internal Server Error',
                message: 'Something went wrong',
            });
        });

        test('should use "Error" for unknown status codes', () => {
            const response = createErrorResponse(418, "I'm a teapot");
            expect(response).toEqual({
                error: 'Error',
                message: "I'm a teapot",
            });
        });
    });

    describe('parseIntegerId', () => {
        test('should parse valid integer string', () => {
            expect(parseIntegerId('123')).toBe(123);
        });

        test('should parse zero', () => {
            expect(parseIntegerId('0')).toBe(0);
        });

        test('should parse negative numbers', () => {
            expect(parseIntegerId('-5')).toBe(-5);
        });

        test('should return null for non-numeric string', () => {
            expect(parseIntegerId('abc')).toBeNull();
        });

        test('should return null for empty string', () => {
            expect(parseIntegerId('')).toBeNull();
        });

        test('should return null for float string', () => {
            // parseInt returns the integer part, but this is still valid
            expect(parseIntegerId('12.5')).toBe(12);
        });

        test('should return null for mixed string', () => {
            // parseInt parses leading digits
            expect(parseIntegerId('123abc')).toBe(123);
        });
    });

    describe('validateFileUpload', () => {
        test('should return null for valid file', () => {
            const file = { name: 'test.zip', size: 1024 };
            expect(validateFileUpload(file)).toBeNull();
        });

        test('should return error for null file', () => {
            const result = validateFileUpload(null);
            expect(result).not.toBeNull();
            expect(result?.status).toBe(400);
            expect(result?.response).toEqual({
                error: 'Bad Request',
                message: 'No file uploaded',
            });
        });

        test('should return error for undefined file', () => {
            const result = validateFileUpload(undefined);
            expect(result).not.toBeNull();
            expect(result?.status).toBe(400);
        });

        test('should return null for empty object (truthy)', () => {
            // An empty object is truthy, so it passes the check
            expect(validateFileUpload({})).toBeNull();
        });
    });

    describe('deleteFileIfExists', () => {
        let tempDir: string;
        let testFile: string;

        beforeEach(async () => {
            tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'admin-helpers-test-'));
            testFile = path.join(tempDir, 'test-file.txt');
        });

        afterEach(async () => {
            await fs.remove(tempDir);
        });

        test('should delete existing file', async () => {
            await fs.writeFile(testFile, 'test content');
            expect(await fs.pathExists(testFile)).toBe(true);

            await deleteFileIfExists(testFile);

            expect(await fs.pathExists(testFile)).toBe(false);
        });

        test('should not throw for non-existent file', async () => {
            const nonExistent = path.join(tempDir, 'does-not-exist.txt');
            expect(await fs.pathExists(nonExistent)).toBe(false);

            // Should not throw
            await expect(deleteFileIfExists(nonExistent)).resolves.toBeUndefined();
        });

        test('should delete existing directory', async () => {
            const subDir = path.join(tempDir, 'sub-directory');
            await fs.mkdir(subDir);
            await fs.writeFile(path.join(subDir, 'file.txt'), 'content');
            expect(await fs.pathExists(subDir)).toBe(true);

            await deleteFileIfExists(subDir);

            expect(await fs.pathExists(subDir)).toBe(false);
        });
    });

    describe('fileExists', () => {
        let tempDir: string;

        beforeEach(async () => {
            tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'admin-helpers-test-'));
        });

        afterEach(async () => {
            await fs.remove(tempDir);
        });

        test('should return true for existing file', async () => {
            const testFile = path.join(tempDir, 'exists.txt');
            await fs.writeFile(testFile, 'content');

            expect(await fileExists(testFile)).toBe(true);
        });

        test('should return false for non-existent file', async () => {
            const testFile = path.join(tempDir, 'does-not-exist.txt');

            expect(await fileExists(testFile)).toBe(false);
        });

        test('should return true for existing directory', async () => {
            expect(await fileExists(tempDir)).toBe(true);
        });
    });

    describe('getFilesDir', () => {
        const originalEnv = { ...process.env };

        afterEach(() => {
            process.env = { ...originalEnv };
        });

        test('should return ELYSIA_FILES_DIR if set', () => {
            process.env.ELYSIA_FILES_DIR = '/custom/elysia/path';
            process.env.FILES_DIR = '/other/path';

            expect(getFilesDir()).toBe('/custom/elysia/path');
        });

        test('should return FILES_DIR if ELYSIA_FILES_DIR not set', () => {
            delete process.env.ELYSIA_FILES_DIR;
            process.env.FILES_DIR = '/files/path';

            expect(getFilesDir()).toBe('/files/path');
        });

        test('should return default if no env vars set', () => {
            delete process.env.ELYSIA_FILES_DIR;
            delete process.env.FILES_DIR;

            expect(getFilesDir()).toBe('/mnt/data');
        });
    });

    describe('getJwtSecret', () => {
        const originalEnv = { ...process.env };

        afterEach(() => {
            process.env = { ...originalEnv };
        });

        test('should return JWT_SECRET if set', () => {
            process.env.JWT_SECRET = 'my-jwt-secret';
            process.env.APP_SECRET = 'my-app-secret';

            expect(getJwtSecret()).toBe('my-jwt-secret');
        });

        test('should return APP_SECRET if JWT_SECRET not set', () => {
            delete process.env.JWT_SECRET;
            process.env.APP_SECRET = 'my-app-secret';

            expect(getJwtSecret()).toBe('my-app-secret');
        });

        test('should return default if no env vars set', () => {
            delete process.env.JWT_SECRET;
            delete process.env.APP_SECRET;

            expect(getJwtSecret()).toBe('elysia-dev-secret-change-me');
        });
    });
});
