import { HttpStatus } from '@nestjs/common';
import { TranslatableException } from './translatable.exception';

describe('TranslatableException', () => {
    describe('constructor', () => {
        it('should create exception with default status code', () => {
            const exception = new TranslatableException('error.test');

            expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
            expect(exception.getTranslationKey()).toBe('error.test');
            expect(exception.getTranslationParameters()).toEqual({});
        });

        it('should create exception with custom status code', () => {
            const exception = new TranslatableException(
                'error.not_found',
                HttpStatus.NOT_FOUND,
            );

            expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
            expect(exception.getTranslationKey()).toBe('error.not_found');
        });

        it('should create exception with parameters', () => {
            const params = { name: 'John', age: '30' };
            const exception = new TranslatableException(
                'error.with_params',
                HttpStatus.BAD_REQUEST,
                params,
            );

            expect(exception.getTranslationParameters()).toEqual(params);
        });
    });

    describe('getTranslationKey', () => {
        it('should return the translation key', () => {
            const exception = new TranslatableException('error.my_key');
            expect(exception.getTranslationKey()).toBe('error.my_key');
        });
    });

    describe('getTranslationParameters', () => {
        it('should return empty object when no parameters', () => {
            const exception = new TranslatableException('error.test');
            expect(exception.getTranslationParameters()).toEqual({});
        });

        it('should return parameters when provided', () => {
            const params = { foo: 'bar', baz: 'qux' };
            const exception = new TranslatableException(
                'error.test',
                HttpStatus.BAD_REQUEST,
                params,
            );
            expect(exception.getTranslationParameters()).toEqual(params);
        });
    });

    describe('isTranslatable', () => {
        it('should return true', () => {
            const exception = new TranslatableException('error.test');
            expect(exception.isTranslatable()).toBe(true);
        });
    });

    describe('message property', () => {
        it('should use translation key as message', () => {
            const exception = new TranslatableException('error.my_message');
            expect(exception.message).toBe('error.my_message');
        });
    });
});
