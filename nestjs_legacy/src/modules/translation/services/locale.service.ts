import { Injectable, Logger } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { UserPreferencesService } from '../../user-preferences/user-preferences.service';
import { LOCALES, DEFAULT_LOCALE } from '../constants/locales.constant';

export interface LocaleDetectionResult {
    locale: string;
    source: 'user_preference' | 'accept_language' | 'default';
}

@Injectable()
export class LocaleService {
    private readonly logger = new Logger(LocaleService.name);

    constructor(private readonly userPreferencesService: UserPreferencesService) {}

    /**
     * Detect the appropriate locale for the current request
     *
     * Priority:
     * 1. User preferences (if userId provided and preference exists)
     * 2. Accept-Language header parsing
     * 3. Default 'en'
     */
    async detectLocale(request: FastifyRequest, userId?: string): Promise<LocaleDetectionResult> {
        // 1. Check user preferences if userId provided
        if (userId) {
            const localeFromPreferences = await this.getLocaleFromUserPreferences(userId);
            if (localeFromPreferences) {
                this.logger.debug(`Locale from user preferences: ${localeFromPreferences}`);
                return { locale: localeFromPreferences, source: 'user_preference' };
            }
        }

        // 2. Parse Accept-Language header
        const localeFromHeader = this.parseAcceptLanguageHeader(request);
        if (localeFromHeader) {
            this.logger.debug(`Locale from Accept-Language header: ${localeFromHeader}`);
            return { locale: localeFromHeader, source: 'accept_language' };
        }

        // 3. Default locale
        this.logger.debug(`Using default locale: ${DEFAULT_LOCALE}`);
        return { locale: DEFAULT_LOCALE, source: 'default' };
    }

    /**
     * Get locale from user preferences database
     */
    private async getLocaleFromUserPreferences(userId: string): Promise<string | null> {
        try {
            const preference = await this.userPreferencesService.findByUserIdAndKey(userId, 'locale');
            if (preference && preference.value && this.isValidLocale(preference.value)) {
                return preference.value;
            }
        } catch (error) {
            this.logger.warn(`Failed to get locale preference for user ${userId}: ${(error as Error).message}`);
        }
        return null;
    }

    /**
     * Parse Accept-Language header and return best matching locale
     *
     * Handles formats like:
     * - "en-US,en;q=0.9,es;q=0.8"
     * - "es"
     * - "es-ES"
     */
    parseAcceptLanguageHeader(request: FastifyRequest): string | null {
        const acceptLanguage = request.headers['accept-language'];
        if (!acceptLanguage || typeof acceptLanguage !== 'string') {
            return null;
        }

        // Parse and sort by quality value
        const languages = this.parseAcceptLanguage(acceptLanguage);

        // Find first matching supported locale
        for (const { lang } of languages) {
            // Try exact match first (e.g., 'es')
            if (this.isValidLocale(lang)) {
                return lang;
            }
            // Try base language (e.g., 'en' from 'en-US')
            const baseLang = lang.split('-')[0].toLowerCase();
            if (this.isValidLocale(baseLang)) {
                return baseLang;
            }
        }

        return null;
    }

    /**
     * Parse Accept-Language header into sorted array by quality value
     */
    private parseAcceptLanguage(header: string): Array<{ lang: string; q: number }> {
        return header
            .split(',')
            .map((part) => {
                const [lang, qPart] = part.trim().split(';');
                const q = qPart ? parseFloat(qPart.replace('q=', '')) : 1.0;
                return { lang: lang.trim().toLowerCase(), q };
            })
            .filter(({ lang }) => lang.length > 0)
            .sort((a, b) => b.q - a.q);
    }

    /**
     * Check if a locale is valid/supported
     */
    isValidLocale(locale: string): boolean {
        return locale in LOCALES || locale === DEFAULT_LOCALE;
    }

    /**
     * Get list of supported locales
     */
    getSupportedLocales(): string[] {
        return Object.keys(LOCALES);
    }

    /**
     * Get default locale
     */
    getDefaultLocale(): string {
        return DEFAULT_LOCALE;
    }
}
