/**
 * Data transfer object for translation list responses
 */
export class TranslationListDto {
    /**
     * The locale code
     * @example 'es'
     */
    locale: string;

    /**
     * Key-value pairs of translations
     * @example { 'Permissions error': 'Error de permisos', 'Show questionnaire': 'Mostrar cuestionario' }
     */
    translations: Record<string, string>;
}

/**
 * Single translation response
 */
export class TranslationResponseDto {
    key: string;
    translation: string;
    locale: string;
}
