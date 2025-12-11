import { TranslationListDto, TranslationResponseDto } from './translation-list.dto';

describe('Translation DTOs', () => {
    describe('TranslationListDto', () => {
        it('should create an instance with locale and translations', () => {
            const dto = new TranslationListDto();
            dto.locale = 'es';
            dto.translations = {
                'Hello': 'Hola',
                'World': 'Mundo',
            };

            expect(dto.locale).toBe('es');
            expect(dto.translations).toEqual({
                'Hello': 'Hola',
                'World': 'Mundo',
            });
        });

        it('should allow empty translations object', () => {
            const dto = new TranslationListDto();
            dto.locale = 'en';
            dto.translations = {};

            expect(dto.locale).toBe('en');
            expect(dto.translations).toEqual({});
        });

        it('should handle various locale formats', () => {
            const dto = new TranslationListDto();

            dto.locale = 'en';
            expect(dto.locale).toBe('en');

            dto.locale = 'es-ES';
            expect(dto.locale).toBe('es-ES');

            dto.locale = 'zh-Hans-CN';
            expect(dto.locale).toBe('zh-Hans-CN');
        });

        it('should handle special characters in translations', () => {
            const dto = new TranslationListDto();
            dto.locale = 'ja';
            dto.translations = {
                'greeting': 'こんにちは',
                'special': '<>&"\'',
            };

            expect(dto.translations['greeting']).toBe('こんにちは');
            expect(dto.translations['special']).toBe('<>&"\'');
        });

        it('should handle long translation keys and values', () => {
            const dto = new TranslationListDto();
            dto.locale = 'en';
            dto.translations = {
                'This is a very long translation key that might appear in the application':
                    'Esta es una traducción muy larga que podría aparecer en la aplicación',
            };

            expect(Object.keys(dto.translations)).toHaveLength(1);
        });
    });

    describe('TranslationResponseDto', () => {
        it('should create an instance with key, translation, and locale', () => {
            const dto = new TranslationResponseDto();
            dto.key = 'Permissions error';
            dto.translation = 'Error de permisos';
            dto.locale = 'es';

            expect(dto.key).toBe('Permissions error');
            expect(dto.translation).toBe('Error de permisos');
            expect(dto.locale).toBe('es');
        });

        it('should allow empty translation', () => {
            const dto = new TranslationResponseDto();
            dto.key = 'untranslated';
            dto.translation = '';
            dto.locale = 'en';

            expect(dto.key).toBe('untranslated');
            expect(dto.translation).toBe('');
        });

        it('should handle unicode in all fields', () => {
            const dto = new TranslationResponseDto();
            dto.key = '日本語キー';
            dto.translation = '日本語の翻訳';
            dto.locale = 'ja';

            expect(dto.key).toBe('日本語キー');
            expect(dto.translation).toBe('日本語の翻訳');
            expect(dto.locale).toBe('ja');
        });
    });
});
