import { describe, it, expect } from 'vitest';
import {
    AppError,
    NetworkError,
    FeatureDisabledError,
    StorageError,
    ValidationError,
    AuthError,
    NotFoundError,
} from './errors.js';
import errorsDefault from './errors.js';

describe('errors', () => {
    describe('AppError', () => {
        it('should create error with message and default code', () => {
            const error = new AppError('Test message');

            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(AppError);
            expect(error.message).toBe('Test message');
            expect(error.name).toBe('AppError');
            expect(error.code).toBe('APP_ERROR');
        });

        it('should create error with custom code', () => {
            const error = new AppError('Test message', 'CUSTOM_CODE');

            expect(error.message).toBe('Test message');
            expect(error.code).toBe('CUSTOM_CODE');
        });
    });

    describe('NetworkError', () => {
        it('should create network error with message only', () => {
            const error = new NetworkError('Network failed');

            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(NetworkError);
            expect(error.message).toBe('Network failed');
            expect(error.name).toBe('NetworkError');
            expect(error.code).toBe('NETWORK_ERROR');
            expect(error.statusCode).toBeNull();
            expect(error.response).toBeNull();
        });

        it('should create network error with status code', () => {
            const error = new NetworkError('Not Found', 404);

            expect(error.message).toBe('Not Found');
            expect(error.statusCode).toBe(404);
            expect(error.response).toBeNull();
        });

        it('should create network error with response data', () => {
            const responseData = { error: 'Invalid input' };
            const error = new NetworkError('Bad Request', 400, responseData);

            expect(error.message).toBe('Bad Request');
            expect(error.statusCode).toBe(400);
            expect(error.response).toEqual(responseData);
        });

        describe('isClientError', () => {
            it('should return true for 4xx status codes', () => {
                expect(new NetworkError('', 400).isClientError()).toBe(true);
                expect(new NetworkError('', 404).isClientError()).toBe(true);
                expect(new NetworkError('', 422).isClientError()).toBe(true);
                expect(new NetworkError('', 499).isClientError()).toBe(true);
            });

            it('should return false for non-4xx status codes', () => {
                expect(new NetworkError('', 200).isClientError()).toBe(false);
                expect(new NetworkError('', 301).isClientError()).toBe(false);
                expect(new NetworkError('', 500).isClientError()).toBe(false);
                expect(new NetworkError('', null).isClientError()).toBe(false);
            });
        });

        describe('isServerError', () => {
            it('should return true for 5xx status codes', () => {
                expect(new NetworkError('', 500).isServerError()).toBe(true);
                expect(new NetworkError('', 502).isServerError()).toBe(true);
                expect(new NetworkError('', 503).isServerError()).toBe(true);
                expect(new NetworkError('', 599).isServerError()).toBe(true);
            });

            it('should return false for non-5xx status codes', () => {
                expect(new NetworkError('', 200).isServerError()).toBe(false);
                expect(new NetworkError('', 400).isServerError()).toBe(false);
                expect(new NetworkError('', 404).isServerError()).toBe(false);
                expect(new NetworkError('', null).isServerError()).toBe(false);
            });
        });
    });

    describe('FeatureDisabledError', () => {
        it('should create feature disabled error', () => {
            const error = new FeatureDisabledError('Cloud Storage');

            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(FeatureDisabledError);
            expect(error.message).toBe('Feature "Cloud Storage" is not available in this mode');
            expect(error.name).toBe('FeatureDisabledError');
            expect(error.code).toBe('FEATURE_DISABLED');
            expect(error.feature).toBe('Cloud Storage');
        });
    });

    describe('StorageError', () => {
        it('should create storage error with message only', () => {
            const error = new StorageError('IndexedDB failed');

            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(StorageError);
            expect(error.message).toBe('IndexedDB failed');
            expect(error.name).toBe('StorageError');
            expect(error.code).toBe('STORAGE_ERROR');
            expect(error.cause).toBeNull();
        });

        it('should create storage error with cause', () => {
            const cause = new Error('Quota exceeded');
            const error = new StorageError('Failed to save', cause);

            expect(error.message).toBe('Failed to save');
            expect(error.cause).toBe(cause);
        });
    });

    describe('ValidationError', () => {
        it('should create validation error with message only', () => {
            const error = new ValidationError('Invalid input');

            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(ValidationError);
            expect(error.message).toBe('Invalid input');
            expect(error.name).toBe('ValidationError');
            expect(error.code).toBe('VALIDATION_ERROR');
            expect(error.fields).toEqual({});
        });

        it('should create validation error with field errors', () => {
            const fields = {
                email: 'Invalid email format',
                password: 'Password too short',
            };
            const error = new ValidationError('Form validation failed', fields);

            expect(error.message).toBe('Form validation failed');
            expect(error.fields).toEqual(fields);
        });
    });

    describe('AuthError', () => {
        it('should create auth error without requiresLogin', () => {
            const error = new AuthError('Access denied');

            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(AuthError);
            expect(error.message).toBe('Access denied');
            expect(error.name).toBe('AuthError');
            expect(error.code).toBe('AUTH_ERROR');
            expect(error.requiresLogin).toBe(false);
        });

        it('should create auth error with requiresLogin true', () => {
            const error = new AuthError('Session expired', true);

            expect(error.message).toBe('Session expired');
            expect(error.requiresLogin).toBe(true);
        });
    });

    describe('NotFoundError', () => {
        it('should create not found error', () => {
            const error = new NotFoundError('Project', 'proj-123');

            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(NotFoundError);
            expect(error.message).toBe('Project "proj-123" not found');
            expect(error.name).toBe('NotFoundError');
            expect(error.code).toBe('NOT_FOUND');
            expect(error.resourceType).toBe('Project');
            expect(error.resourceId).toBe('proj-123');
        });
    });

    describe('default export', () => {
        it('should export all error classes', () => {
            expect(errorsDefault.AppError).toBe(AppError);
            expect(errorsDefault.NetworkError).toBe(NetworkError);
            expect(errorsDefault.FeatureDisabledError).toBe(FeatureDisabledError);
            expect(errorsDefault.StorageError).toBe(StorageError);
            expect(errorsDefault.ValidationError).toBe(ValidationError);
            expect(errorsDefault.AuthError).toBe(AuthError);
            expect(errorsDefault.NotFoundError).toBe(NotFoundError);
        });
    });
});
