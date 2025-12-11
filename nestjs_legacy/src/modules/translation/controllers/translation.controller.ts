import { Controller, Get, Param, Query } from '@nestjs/common';
import { TranslationService } from '../services/translation.service';
import { TranslationListDto, TranslationResponseDto } from '../dto/translation-list.dto';

@Controller('api/translations')
export class TranslationController {
    constructor(private readonly translationService: TranslationService) {}

    /**
     * Get all translation lists (all locales)
     * Endpoint: GET /api/translation-management/translations
     */
    @Get()
    async getTranslationLists(): Promise<Record<string, Record<string, string>>> {
        const result: Record<string, Record<string, string>> = {};

        for (const locale of this.translationService.getAvailableLocales()) {
            result[locale] = this.translationService.getCatalogueWithFallback(locale);
        }

        return result;
    }

    /**
     * Get available locales
     * Endpoint: GET /api/translation-management/translations/locales
     */
    @Get('locales')
    async getAvailableLocales(): Promise<string[]> {
        return this.translationService.getAvailableLocales();
    }

    /**
     * Get translation list for a specific locale
     * Endpoint: GET /api/translation-management/translations/:locale/list
     */
    @Get(':locale/list')
    async getTranslationListForLocale(@Param('locale') locale: string): Promise<TranslationListDto> {
        const translations = this.translationService.getCatalogueWithFallback(locale);

        return {
            locale,
            translations,
        };
    }

    /**
     * Get a single translation
     * Endpoint: GET /api/translation-management/translations/:locale/translate
     */
    @Get(':locale/translate')
    async translateKey(
        @Param('locale') locale: string,
        @Query('key') key: string,
    ): Promise<TranslationResponseDto> {
        const translation = this.translationService.trans(key, {}, null, locale);

        return {
            key,
            translation,
            locale,
        };
    }
}
