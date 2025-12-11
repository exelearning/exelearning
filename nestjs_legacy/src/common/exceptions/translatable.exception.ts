import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base exception class that supports i18n translation.
 * Messages are translated using TranslationService in the HttpExceptionFilter.
 *
 * Usage:
 * throw new TranslatableException('error.page_not_found', HttpStatus.NOT_FOUND);
 * throw new TranslatableException('error.insufficient_space', HttpStatus.BAD_REQUEST, { used: '5GB', max: '10GB' });
 */
export class TranslatableException extends HttpException {
    private readonly translationKey: string;
    private readonly translationParameters: Record<string, string>;

    constructor(
        translationKey: string,
        statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
        parameters: Record<string, string> = {},
    ) {
        // Pass the translation key as the message (will be translated by the filter)
        super(translationKey, statusCode);
        this.translationKey = translationKey;
        this.translationParameters = parameters;
    }

    /**
     * Get the translation key for this exception
     */
    getTranslationKey(): string {
        return this.translationKey;
    }

    /**
     * Get the parameters to interpolate in the translation
     */
    getTranslationParameters(): Record<string, string> {
        return this.translationParameters;
    }

    /**
     * Check if this exception has a translation key
     */
    isTranslatable(): boolean {
        return true;
    }
}
