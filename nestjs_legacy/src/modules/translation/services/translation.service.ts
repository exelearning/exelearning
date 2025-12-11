import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { XlfParserService } from './xlf-parser.service';
import { LOCALES, DEFAULT_LOCALE } from '../constants/locales.constant';

@Injectable()
export class TranslationService implements OnModuleInit {
    private readonly logger = new Logger(TranslationService.name);

    // Map<locale, Map<sourceKey, translatedValue>>
    private catalogues: Map<string, Map<string, string>> = new Map();

    private currentLocale: string = DEFAULT_LOCALE;
    private previousLocale: string | null = null;

    // Global parameters that can be injected into translations
    private globalParameters: Record<string, string> = {};

    constructor(
        private readonly xlfParser: XlfParserService,
        private readonly configService: ConfigService,
    ) {}

    async onModuleInit(): Promise<void> {
        await this.loadAllTranslations();
    }

    /**
     * Load all XLF translation files on startup
     */
    async loadAllTranslations(): Promise<void> {
        const translationsDir = this.getTranslationsDir();

        this.logger.log(`Loading translations from: ${translationsDir}`);

        for (const locale of Object.keys(LOCALES)) {
            const filePath = path.join(translationsDir, `messages.${locale}.xlf`);

            try {
                await fs.access(filePath);
                const result = await this.xlfParser.parseXlfFile(filePath);
                this.catalogues.set(locale, result.translations);
                this.logger.log(`Loaded ${result.translations.size} translations for locale: ${locale}`);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                    this.logger.warn(`Translation file not found: ${filePath}`);
                    this.catalogues.set(locale, new Map());
                } else {
                    this.logger.error(`Error loading translations for ${locale}: ${(error as Error).message}`);
                }
            }
        }
    }

    /**
     * Translate a message with fallback to English
     * Replicates the Symfony Translator behavior
     */
    trans(
        id: string,
        parameters: Record<string, string> = {},
        domain: string | null = null,
        locale?: string,
    ): string {
        const targetLocale = locale || this.currentLocale;
        const mergedParams = { ...this.globalParameters, ...parameters };

        // Try to translate in the target locale
        let translated = this.catalogues.get(targetLocale)?.get(id);

        // Fallback to English if translation is empty or same as the key
        if (!translated || translated === id) {
            translated = this.catalogues.get('en')?.get(id);
        }

        // If still no translation, return the original id
        if (!translated || translated === id) {
            translated = id;
        }

        // Apply special transformations (elp -> elpx) - from original Symfony code
        translated = this.applyTransformations(translated);

        // Replace parameters (e.g., %name% -> value)
        translated = this.replaceParameters(translated, mergedParams);

        return translated;
    }

    /**
     * Apply special string transformations
     * Replicates: elp -> elpx transformation from Symfony Translator
     */
    private applyTransformations(text: string): string {
        let result = text;

        // elp -> elpx transformations (to review - #498)
        result = result.replace(/ \(elp\)/g, ' (elpx)');
        result = result.replace(/ \.elp /g, ' .elpx ');
        result = result.replace(/ elp /g, ' elpx ');
        if (result.endsWith('.elp')) {
            result += 'x';
        }

        // Remove ~ prefix if present
        if (result.startsWith('~')) {
            result = result.substring(1);
        }

        return result;
    }

    /**
     * Replace parameters in translation string
     * Supports both %param% and {param} formats
     */
    private replaceParameters(text: string, params: Record<string, string>): string {
        let result = text;

        for (const [key, value] of Object.entries(params)) {
            // Replace %key% format (Symfony style)
            result = result.replace(new RegExp(`%${key}%`, 'g'), value);
            // Replace {key} format
            result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        }

        return result;
    }

    /**
     * Get the full translation catalogue for a locale
     */
    getCatalogue(locale?: string): Record<string, string> {
        const targetLocale = locale || this.currentLocale;
        const catalogue = this.catalogues.get(targetLocale);

        if (!catalogue) {
            return {};
        }

        // Convert Map to plain object
        const result: Record<string, string> = {};
        for (const [key, value] of catalogue.entries()) {
            result[key] = value;
        }

        return result;
    }

    /**
     * Get catalogue with fallback - returns translations from target locale
     * with English fallback for missing keys
     */
    getCatalogueWithFallback(locale: string): Record<string, string> {
        const targetCatalogue = this.catalogues.get(locale) || new Map();
        const fallbackCatalogue = this.catalogues.get('en') || new Map();

        const result: Record<string, string> = {};

        // First, add all English translations as base
        for (const [key, value] of fallbackCatalogue.entries()) {
            result[key] = value;
        }

        // Then override with target locale translations
        for (const [key, value] of targetCatalogue.entries()) {
            if (value && value !== key) {
                result[key] = value;
            }
        }

        return result;
    }

    /**
     * Set the current locale
     */
    setLocale(locale: string): void {
        if (LOCALES[locale] || locale === DEFAULT_LOCALE) {
            this.currentLocale = locale;
        }
    }

    /**
     * Get the current locale
     */
    getLocale(): string {
        return this.currentLocale;
    }

    /**
     * Temporarily switch locale (useful for exports)
     */
    switchTemporaryLocale(temporaryLocale: string): boolean {
        // Validate locale format
        if (!/^[a-z]{2}(?:_[A-Z]{2})?$/.test(temporaryLocale)) {
            return false;
        }

        this.previousLocale = this.currentLocale;
        this.currentLocale = temporaryLocale;

        return true;
    }

    /**
     * Restore previous locale after temporary switch
     */
    restorePreviousLocale(): boolean {
        if (!this.previousLocale) {
            return false;
        }

        this.currentLocale = this.previousLocale;
        this.previousLocale = null;

        return true;
    }

    /**
     * Get available locales
     */
    getAvailableLocales(): string[] {
        return Object.keys(LOCALES);
    }

    /**
     * Get translations directory path
     */
    private getTranslationsDir(): string {
        // Check if we're in Electron packaged app
        const resourcesPath = this.configService.get<string>('RESOURCES_PATH');
        if (resourcesPath) {
            return path.join(resourcesPath, 'translations');
        }

        // Default: translations folder in project root
        return path.join(process.cwd(), 'translations');
    }

    /**
     * Set global parameters for translations
     */
    setGlobalParameters(params: Record<string, string>): void {
        this.globalParameters = { ...this.globalParameters, ...params };
    }

    /**
     * Reload translations (useful for development/hot-reload)
     */
    async reloadTranslations(): Promise<void> {
        this.catalogues.clear();
        await this.loadAllTranslations();
    }

    /**
     * Get the number of loaded translations for a locale
     */
    getTranslationCount(locale: string): number {
        return this.catalogues.get(locale)?.size || 0;
    }

    /**
     * Check if a locale is loaded
     */
    isLocaleLoaded(locale: string): boolean {
        return this.catalogues.has(locale);
    }
}
