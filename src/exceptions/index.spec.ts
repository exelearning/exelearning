/**
 * Tests for Custom Exceptions
 */
import { describe, it, expect } from 'bun:test';
import {
    getStatusText,
    HttpException,
    TranslatableException,
    AutosaveRecentSaveException,
    UserAlreadyOpenSessionException,
    UserInsufficientSpaceException,
    ExtensionNotInstalledException,
} from './index';

describe('Exceptions', () => {
    describe('getStatusText', () => {
        it('should return correct text for 400', () => {
            expect(getStatusText(400)).toBe('Bad Request');
        });

        it('should return correct text for 401', () => {
            expect(getStatusText(401)).toBe('Unauthorized');
        });

        it('should return correct text for 403', () => {
            expect(getStatusText(403)).toBe('Forbidden');
        });

        it('should return correct text for 404', () => {
            expect(getStatusText(404)).toBe('Not Found');
        });

        it('should return correct text for 409', () => {
            expect(getStatusText(409)).toBe('Conflict');
        });

        it('should return correct text for 500', () => {
            expect(getStatusText(500)).toBe('Internal Server Error');
        });

        it('should return correct text for 502', () => {
            expect(getStatusText(502)).toBe('Bad Gateway');
        });

        it('should return correct text for 503', () => {
            expect(getStatusText(503)).toBe('Service Unavailable');
        });

        it('should return "Error" for unknown status codes', () => {
            expect(getStatusText(999)).toBe('Error');
            expect(getStatusText(418)).toBe('Error');
        });
    });

    describe('HttpException', () => {
        it('should create exception with message and default status code', () => {
            const exception = new HttpException('Something went wrong');
            expect(exception.message).toBe('Something went wrong');
            expect(exception.statusCode).toBe(500);
            expect(exception.name).toBe('HttpException');
        });

        it('should create exception with custom status code', () => {
            const exception = new HttpException('Not found', 404);
            expect(exception.message).toBe('Not found');
            expect(exception.statusCode).toBe(404);
        });

        it('should be an instance of Error', () => {
            const exception = new HttpException('Error');
            expect(exception).toBeInstanceOf(Error);
        });
    });

    describe('TranslatableException', () => {
        it('should create exception with translation key', () => {
            const exception = new TranslatableException('error.key');
            expect(exception.translationKey).toBe('error.key');
            expect(exception.message).toBe('error.key');
            expect(exception.statusCode).toBe(400);
            expect(exception.parameters).toEqual({});
            expect(exception.name).toBe('TranslatableException');
        });

        it('should create exception with custom status code', () => {
            const exception = new TranslatableException('error.key', 403);
            expect(exception.statusCode).toBe(403);
        });

        it('should create exception with parameters', () => {
            const exception = new TranslatableException('error.key', 400, { foo: 'bar', count: 5 });
            expect(exception.parameters).toEqual({ foo: 'bar', count: 5 });
        });
    });

    describe('AutosaveRecentSaveException', () => {
        it('should create exception with correct translation key', () => {
            const exception = new AutosaveRecentSaveException();
            expect(exception.translationKey).toBe('error.autosave_recent_save');
            expect(exception.statusCode).toBe(400);
        });
    });

    describe('UserAlreadyOpenSessionException', () => {
        it('should create exception with correct translation key and status', () => {
            const exception = new UserAlreadyOpenSessionException();
            expect(exception.translationKey).toBe('error.session_already_open');
            expect(exception.statusCode).toBe(409);
        });
    });

    describe('UserInsufficientSpaceException', () => {
        it('should create exception with formatted space parameters', () => {
            const exception = new UserInsufficientSpaceException(
                500 * 1024 * 1024, // 500 MB used
                1024 * 1024 * 1024, // 1 GB max
                100 * 1024 * 1024, // 100 MB required
                524 * 1024 * 1024, // 524 MB available
            );

            expect(exception.translationKey).toBe('error.insufficient_space');
            expect(exception.statusCode).toBe(400);
            expect(exception.usedSpace).toBe(500 * 1024 * 1024);
            expect(exception.maxSpace).toBe(1024 * 1024 * 1024);
            expect(exception.requiredSpace).toBe(100 * 1024 * 1024);
            expect(exception.availableSpace).toBe(524 * 1024 * 1024);

            // Parameters should have formatted strings
            expect(exception.parameters.usedSpace).toBe('500.0 MB');
            expect(exception.parameters.maxSpace).toBe('1.0 GB');
            expect(exception.parameters.requiredSpace).toBe('100.0 MB');
            expect(exception.parameters.availableSpace).toBe('524.0 MB');
        });

        it('should handle 0 bytes', () => {
            const exception = new UserInsufficientSpaceException(0, 1024, 512, 1024);
            expect(exception.parameters.usedSpace).toBe('0 B');
        });

        it('should handle KB values', () => {
            const exception = new UserInsufficientSpaceException(
                1024, // 1 KB
                2048, // 2 KB
                512,
                1536,
            );
            expect(exception.parameters.usedSpace).toBe('1.0 KB');
            expect(exception.parameters.maxSpace).toBe('2.0 KB');
        });
    });

    describe('ExtensionNotInstalledException', () => {
        it('should create exception with extension name', () => {
            const exception = new ExtensionNotInstalledException('imagick');
            expect(exception.translationKey).toBe('error.extension_not_installed');
            expect(exception.statusCode).toBe(500);
            expect(exception.extension).toBe('imagick');
            expect(exception.parameters.extension).toBe('imagick');
        });
    });
});
