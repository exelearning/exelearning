/**
 * Shared Parsers
 *
 * Provides common parsing utilities for iDevice, theme, and translation files.
 * These parsers are used by both server routes and the static build script
 * to eliminate code duplication.
 *
 * @module shared/parsers
 *
 * @example
 * ```typescript
 * import {
 *     parseIdeviceConfig,
 *     parseThemeConfig,
 *     parseXlfContent,
 * } from '@/shared/parsers';
 * ```
 */

// iDevice parser
export {
    parseIdeviceConfig,
    parseIdeviceConfigBasic,
    type IdeviceConfig,
    type IdeviceIcon,
    type ParseIdeviceOptions,
    type FileSystemReader,
    type PathUtils,
} from './idevice-parser';

// Theme parser
export {
    parseThemeConfig,
    parseThemeConfigBasic,
    type ThemeConfig,
    type ThemeIcon,
    type ParseThemeOptions,
    type ThemeFileSystemReader,
    type ThemePathUtils,
} from './theme-parser';

// Translation parser
export {
    parseXlfContent,
    parseXlfFile,
    loadLocaleTranslations,
    loadAllTranslations,
    mergeTranslations,
    type TranslationMap,
    type ParsedTranslations,
    type TranslationFileSystemReader,
} from './translation-parser';
