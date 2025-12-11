import { HttpStatus } from '@nestjs/common';
import { TranslatableException } from '../translatable.exception';
import { AutosaveRecentSaveException } from './autosave-recent-save.exception';
import { UserInsufficientSpaceException } from './user-insufficient-space.exception';
import { UserAlreadyOpenSessionException } from './user-already-open-session.exception';
import { ExtensionNotInstalledException } from './extension-not-installed.exception';

describe('Logical Exceptions', () => {
    describe('AutosaveRecentSaveException', () => {
        it('should extend TranslatableException', () => {
            const exception = new AutosaveRecentSaveException();
            expect(exception).toBeInstanceOf(TranslatableException);
        });

        it('should use translation key "error.autosave_recent_save"', () => {
            const exception = new AutosaveRecentSaveException();
            expect(exception.getTranslationKey()).toBe('error.autosave_recent_save');
        });

        it('should use HttpStatus.BAD_REQUEST', () => {
            const exception = new AutosaveRecentSaveException();
            expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        });

        it('should have empty translation parameters', () => {
            const exception = new AutosaveRecentSaveException();
            expect(exception.getTranslationParameters()).toEqual({});
        });
    });

    describe('UserInsufficientSpaceException', () => {
        it('should extend TranslatableException', () => {
            const exception = new UserInsufficientSpaceException();
            expect(exception).toBeInstanceOf(TranslatableException);
        });

        it('should use translation key "error.insufficient_space"', () => {
            const exception = new UserInsufficientSpaceException();
            expect(exception.getTranslationKey()).toBe('error.insufficient_space');
        });

        it('should use HttpStatus.BAD_REQUEST', () => {
            const exception = new UserInsufficientSpaceException();
            expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        });

        describe('formatBytes function', () => {
            it('should format 0 bytes correctly', () => {
                const exception = new UserInsufficientSpaceException(0, 0, 0, 0);
                const params = exception.getTranslationParameters();
                expect(params.usedSpace).toBe('0 B');
            });

            it('should format bytes (< 1024) correctly', () => {
                const exception = new UserInsufficientSpaceException(512, 0, 0, 0);
                const params = exception.getTranslationParameters();
                expect(params.usedSpace).toBe('512 B');
            });

            it('should format kilobytes correctly', () => {
                const exception = new UserInsufficientSpaceException(1024, 0, 0, 0);
                const params = exception.getTranslationParameters();
                expect(params.usedSpace).toBe('1 KB');
            });

            it('should format megabytes correctly', () => {
                const exception = new UserInsufficientSpaceException(1048576, 0, 0, 0);
                const params = exception.getTranslationParameters();
                expect(params.usedSpace).toBe('1 MB');
            });

            it('should format gigabytes correctly', () => {
                const exception = new UserInsufficientSpaceException(1073741824, 0, 0, 0);
                const params = exception.getTranslationParameters();
                expect(params.usedSpace).toBe('1 GB');
            });

            it('should format terabytes correctly', () => {
                const exception = new UserInsufficientSpaceException(1099511627776, 0, 0, 0);
                const params = exception.getTranslationParameters();
                expect(params.usedSpace).toBe('1 TB');
            });

            it('should handle decimal values correctly', () => {
                // 1.5 MB = 1,572,864 bytes
                const exception = new UserInsufficientSpaceException(1572864, 0, 0, 0);
                const params = exception.getTranslationParameters();
                expect(params.usedSpace).toBe('1.5 MB');
            });
        });

        describe('space getters', () => {
            it('should store raw numeric values via getUsedSpace()', () => {
                const exception = new UserInsufficientSpaceException(5000, 0, 0, 0);
                expect(exception.getUsedSpace()).toBe(5000);
            });

            it('should store raw numeric values via getMaxSpace()', () => {
                const exception = new UserInsufficientSpaceException(0, 10000, 0, 0);
                expect(exception.getMaxSpace()).toBe(10000);
            });

            it('should store raw numeric values via getRequiredSpace()', () => {
                const exception = new UserInsufficientSpaceException(0, 0, 2000, 0);
                expect(exception.getRequiredSpace()).toBe(2000);
            });

            it('should store raw numeric values via getAvailableSpace()', () => {
                const exception = new UserInsufficientSpaceException(0, 0, 0, 1000);
                expect(exception.getAvailableSpace()).toBe(1000);
            });
        });

        it('should pass formatted values to translation parameters', () => {
            const exception = new UserInsufficientSpaceException(
                5 * 1024 * 1024, // 5 MB used
                10 * 1024 * 1024, // 10 MB max
                2 * 1024 * 1024, // 2 MB required
                1024 * 1024, // 1 MB available
            );
            const params = exception.getTranslationParameters();
            expect(params.usedSpace).toBe('5 MB');
            expect(params.maxSpace).toBe('10 MB');
            expect(params.requiredSpace).toBe('2 MB');
            expect(params.availableSpace).toBe('1 MB');
        });

        it('should default all parameters to 0', () => {
            const exception = new UserInsufficientSpaceException();
            expect(exception.getUsedSpace()).toBe(0);
            expect(exception.getMaxSpace()).toBe(0);
            expect(exception.getRequiredSpace()).toBe(0);
            expect(exception.getAvailableSpace()).toBe(0);
        });
    });

    describe('UserAlreadyOpenSessionException', () => {
        it('should extend TranslatableException', () => {
            const exception = new UserAlreadyOpenSessionException();
            expect(exception).toBeInstanceOf(TranslatableException);
        });

        it('should use translation key "error.session_already_open"', () => {
            const exception = new UserAlreadyOpenSessionException();
            expect(exception.getTranslationKey()).toBe('error.session_already_open');
        });

        it('should use HttpStatus.CONFLICT', () => {
            const exception = new UserAlreadyOpenSessionException();
            expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
        });

        it('should have empty translation parameters', () => {
            const exception = new UserAlreadyOpenSessionException();
            expect(exception.getTranslationParameters()).toEqual({});
        });
    });

    describe('ExtensionNotInstalledException', () => {
        it('should extend TranslatableException', () => {
            const exception = new ExtensionNotInstalledException('gd');
            expect(exception).toBeInstanceOf(TranslatableException);
        });

        it('should use translation key "error.extension_not_installed"', () => {
            const exception = new ExtensionNotInstalledException('gd');
            expect(exception.getTranslationKey()).toBe('error.extension_not_installed');
        });

        it('should use HttpStatus.INTERNAL_SERVER_ERROR', () => {
            const exception = new ExtensionNotInstalledException('gd');
            expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        });

        it('should store extension name via getExtensionName()', () => {
            const exception = new ExtensionNotInstalledException('gd');
            expect(exception.getExtensionName()).toBe('gd');
        });

        it('should pass extension name to translation parameters', () => {
            const exception = new ExtensionNotInstalledException('zip');
            const params = exception.getTranslationParameters();
            expect(params.extension).toBe('zip');
        });

        it('should handle different extension names', () => {
            const gdException = new ExtensionNotInstalledException('gd');
            const zipException = new ExtensionNotInstalledException('zip');
            const imagickException = new ExtensionNotInstalledException('imagick');

            expect(gdException.getExtensionName()).toBe('gd');
            expect(zipException.getExtensionName()).toBe('zip');
            expect(imagickException.getExtensionName()).toBe('imagick');
        });
    });

    describe('inheritance', () => {
        it('all exceptions should be translatable', () => {
            const exceptions = [
                new AutosaveRecentSaveException(),
                new UserInsufficientSpaceException(),
                new UserAlreadyOpenSessionException(),
                new ExtensionNotInstalledException('test'),
            ];

            exceptions.forEach((exception) => {
                expect(exception.isTranslatable()).toBe(true);
            });
        });

        it('all exceptions should extend HttpException', () => {
            const exceptions = [
                new AutosaveRecentSaveException(),
                new UserInsufficientSpaceException(),
                new UserAlreadyOpenSessionException(),
                new ExtensionNotInstalledException('test'),
            ];

            exceptions.forEach((exception) => {
                expect(exception.getStatus).toBeDefined();
                expect(exception.getResponse).toBeDefined();
            });
        });
    });
});
