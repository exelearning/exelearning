/**
 * Static Bundle Configuration
 *
 * Re-exports from canonical sources for static bundle generation.
 * This eliminates duplication and ensures consistency with the main codebase.
 */

import { LOCALES as LOCALE_NAMES_MAP, PACKAGE_LOCALES } from '../../src/services/translation';
import { LICENSE_REGISTRY } from '../../src/shared/export/constants';

// =============================================================================
// Supported Locales
// =============================================================================

/**
 * Supported GUI locales (for translation files).
 * These correspond to translation files in translations/messages.{locale}.xlf
 * Derived from LOCALES in src/services/translation.ts
 */
export const LOCALES = Object.keys(LOCALE_NAMES_MAP) as readonly string[];

/**
 * Locale display names for UI dropdowns
 * Re-exported from src/services/translation.ts
 */
export const LOCALE_NAMES = LOCALE_NAMES_MAP;

/**
 * Package locales for project language selection.
 * Full list of ~40 locales for content packages.
 * Re-exported from src/services/translation.ts
 */
export { PACKAGE_LOCALES };

// =============================================================================
// Licenses (derived from LICENSE_REGISTRY)
// =============================================================================

/**
 * Available licenses for project properties dropdown.
 * Derived from LICENSE_REGISTRY, filtering out legacy licenses.
 *
 * Format: { 'license-key': 'display name' }
 */
export const LICENSES: Record<string, string> = Object.fromEntries(
    Object.entries(LICENSE_REGISTRY)
        .filter(([, entry]) => !entry.legacy)
        .map(([key, entry]) => [key, entry.displayName])
);

// =============================================================================
// Type exports
// =============================================================================

export type LocaleCode = keyof typeof LOCALE_NAMES_MAP;
