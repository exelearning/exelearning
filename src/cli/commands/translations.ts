/**
 * Translations Command
 * Extract translation strings and clean XLF files
 *
 * Usage: bun cli translations [options]
 * Options:
 *   --locale <code>   Process specific locale only
 *   --extract-only       Only extract strings (skip cleanup)
 *   --clean-only         Only clean XLF files (skip extraction)
 *   --remove-obsolete    Remove trans-units not found in source code
 */
import { parseArgs, getString, getBoolean, hasHelp } from '../utils/args';
import { success, error, warning, info, colors, EXIT_CODES } from '../utils/output';
import { LOCALES } from '../../services/translation';
import * as fs from 'fs';
import * as path from 'path';
import { Glob } from 'bun';

const TRANSLATIONS_DIR = path.join(process.cwd(), 'translations');

export interface TranslationsResult {
    success: boolean;
    message: string;
    stats?: {
        extracted: number;
        cleaned: number;
        removed: number;
        locales: string[];
    };
}

/**
 * Files/directories to exclude from translation scanning
 */
const EXCLUDE_FILE_PATTERNS = [
    /\.spec\.ts$/, // Backend test files
    /\.test\.ts$/, // Backend test files
    /\.test\.js$/, // Frontend test files
    /[\\/]+exe_math[\\/]+/, // MathJax directory (has its own t() calls)
    /[\\/]+node_modules[\\/]+/, // Dependencies
    /[\\/]+cli[\\/]+commands[\\/]+translations\.ts$/, // This file (TRANS_PREFIX pattern matches its own source)
];

/**
 * Keys that look like test patterns (not real translations)
 */
const INVALID_KEY_PATTERNS = [
    /^test\./, // test.key, test.something
    /^pattern\./, // pattern.trans, pattern.t
    /^nonexistent\./, // nonexistent.translation.key
    /^new\.key\./, // new.key.from.source
    /^existing\.key$/, // existing.key
    /^key$/, // just "key"
];

/**
 * Check if a file path should be excluded from scanning
 */
function shouldExcludeFile(filePath: string): boolean {
    return EXCLUDE_FILE_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Check if a key looks like a test pattern and should be excluded
 */
function isInvalidKey(key: string): boolean {
    return INVALID_KEY_PATTERNS.some(pattern => pattern.test(key));
}

/**
 * Extract translation keys from source files
 */
async function extractTranslationKeys(): Promise<Set<string>> {
    const keys = new Set<string>();

    // Patterns to search for translation function calls
    const patterns = [
        /trans\(\s*['"]([^'"]+)['"]/g, // trans('key') or trans("key")
        /trans\(\s*`([^`]+)`/g, // trans(`key`)
        /__\(\s*['"]([^'"]+)['"]/g, // __('key') or __("key")
        /__\(\s*`([^`]+)`/g, // __(`key`)
        /\bt\(\s*['"]([^'"]+)['"]/g, // t('key') or t("key")
        /\bt\(\s*`([^`]+)`/g, // t(`key`)
        /(?<![.\w])_\(\s*['"]([^'"]+)['"]/g, // _('key') - GUI translations (negative lookbehind avoids c_)
        /(?<![.\w])_\(\s*`([^`]+)`/g, // _(`key`) - GUI translations with backticks
        /\bc_\(\s*['"]([^'"]+)['"]/g, // c_('key') - content translations
        /\bc_\(\s*`([^`]+)`/g, // c_(`key`) - content translations with backticks
        /['"]([^'"]+)['"]\s*\|\s*trans\b/g, // 'key' | trans - Nunjucks filter
        /\$\{TRANS_PREFIX\}([^`$]+)/g, // ${TRANS_PREFIX}Key - runtime translatable strings
    ];

    // Source directories to scan
    const sourceGlobs = [
        new Glob('src/**/*.ts'),
        new Glob('views/**/*.njk'),
        new Glob('public/app/**/*.js'),
        new Glob('public/libs/**/*.js'),
        new Glob('public/files/perm/idevices/**/*.js'),
    ];

    for (const glob of sourceGlobs) {
        for await (const filePath of glob.scan({ cwd: process.cwd(), absolute: true })) {
            // Skip excluded files/directories
            if (shouldExcludeFile(filePath)) {
                continue;
            }

            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                for (const pattern of patterns) {
                    // Reset regex state
                    pattern.lastIndex = 0;
                    let match;
                    while ((match = pattern.exec(content)) !== null) {
                        const key = match[1].trim();
                        // Skip keys that look like template expressions, are empty,
                        // start with backslash, or match test patterns
                        if (key && !key.includes('${') && !key.startsWith('\\') && !isInvalidKey(key)) {
                            keys.add(key);
                        }
                    }
                }
            } catch {
                // Skip files that can't be read
            }
        }
    }

    return keys;
}

/**
 * Generate a unique ID for XLF trans-unit
 */
function generateTransUnitId(): string {
    return Math.random().toString(36).substring(2, 9);
}

/**
 * Add new keys to XLF file
 */
function addKeysToXlf(xlfContent: string, newKeys: Set<string>): { content: string; added: number } {
    // Find existing keys in XLF
    const existingKeys = new Set<string>();
    const resnamePattern = /resname="([^"]+)"/g;
    let match;
    while ((match = resnamePattern.exec(xlfContent)) !== null) {
        existingKeys.add(match[1]);
    }

    // Find keys to add
    const keysToAdd = [...newKeys].filter(k => !existingKeys.has(k));

    if (keysToAdd.length === 0) {
        return { content: xlfContent, added: 0 };
    }

    // Generate new trans-units
    const newUnits = keysToAdd
        .map(key => {
            const id = generateTransUnitId();
            return `      <trans-unit id="${id}" resname="${escapeXml(key)}">
        <source>${escapeXml(key)}</source>
        <target></target>
      </trans-unit>`;
        })
        .join('\n');

    // Insert before </body>
    const bodyCloseIndex = xlfContent.lastIndexOf('</body>');
    if (bodyCloseIndex === -1) {
        warning('Could not find </body> tag in XLF file');
        return { content: xlfContent, added: 0 };
    }

    const newContent = xlfContent.slice(0, bodyCloseIndex) + newUnits + '\n    ' + xlfContent.slice(bodyCloseIndex);

    return { content: newContent, added: keysToAdd.length };
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Unescape XML entities back to plain characters
 */
function unescapeXml(str: string): string {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
}

/**
 * Clean XLF file content
 */
function cleanXlfContent(content: string): { content: string; cleaned: boolean } {
    let cleaned = false;
    let result = content;

    // 1. Replace <target>__...</target> with <target></target>
    const targetPattern = /<target>__([^<]*)<\/target>/g;
    if (targetPattern.test(result)) {
        result = result.replace(targetPattern, '<target></target>');
        cleaned = true;
    }

    // 2. Remove trans-units with source starting with \\
    const backslashPattern = /<trans-unit\b[^>]*>[\s\S]*?<source>\\\\[^<]*<\/source>[\s\S]*?<\/trans-unit>\s*/g;
    if (backslashPattern.test(result)) {
        result = result.replace(backslashPattern, '');
        cleaned = true;
    }

    // 3. Clean up multiple empty lines
    const multipleNewlines = /\n\s*\n\s*\n/g;
    if (multipleNewlines.test(result)) {
        result = result.replace(multipleNewlines, '\n\n');
        cleaned = true;
    }

    return { content: result, cleaned };
}

/**
 * Remove trans-units whose resname is not in the valid keys set.
 * Returns the cleaned content and count of removed units.
 */
function removeObsoleteTransUnits(content: string, validKeys: Set<string>): { content: string; removed: number } {
    if (validKeys.size === 0) {
        return { content, removed: 0 };
    }

    let removed = 0;

    // Match each <trans-unit ...> ... </trans-unit> block (with optional trailing whitespace)
    const transUnitPattern = /<trans-unit\b[^>]*>[\s\S]*?<\/trans-unit>\s*/g;
    const resnamePattern = /resname="([^"]+)"/;

    const result = content.replace(transUnitPattern, match => {
        const resnameMatch = match.match(resnamePattern);
        if (resnameMatch) {
            const resname = resnameMatch[1];
            if (!validKeys.has(unescapeXml(resname))) {
                removed++;
                return '';
            }
        }
        return match;
    });

    return { content: result, removed };
}

/**
 * Process a single locale
 */
async function processLocale(
    locale: string,
    keys: Set<string>,
    extractOnly: boolean,
    cleanOnly: boolean,
    removeObsolete: boolean,
): Promise<{ extracted: number; cleaned: boolean; removed: number }> {
    const xlfPath = path.join(TRANSLATIONS_DIR, `messages.${locale}.xlf`);

    if (!fs.existsSync(xlfPath)) {
        warning(`XLF file not found: ${xlfPath}`);
        return { extracted: 0, cleaned: false, removed: 0 };
    }

    let content = fs.readFileSync(xlfPath, 'utf-8');
    let extracted = 0;
    let cleaned = false;
    let removed = 0;

    // Extract: add new keys
    if (!cleanOnly && keys.size > 0) {
        const result = addKeysToXlf(content, keys);
        content = result.content;
        extracted = result.added;
    }

    // Clean: remove invalid entries and obsolete trans-units
    if (!extractOnly) {
        const cleanResult = cleanXlfContent(content);
        content = cleanResult.content;
        cleaned = cleanResult.cleaned;

        // Remove trans-units whose keys no longer exist in source code (only with explicit flag)
        if (removeObsolete && keys.size > 0) {
            const obsoleteResult = removeObsoleteTransUnits(content, keys);
            content = obsoleteResult.content;
            removed = obsoleteResult.removed;
            if (removed > 0) {
                cleaned = true;
            }
        }
    }

    // Write back
    fs.writeFileSync(xlfPath, content, 'utf-8');

    return { extracted, cleaned, removed };
}

export async function execute(
    positional: string[],
    flags: Record<string, string | boolean | string[]>,
): Promise<TranslationsResult> {
    // Parse options
    const specificLocale = getString(flags, 'locale');
    const extractOnly = getBoolean(flags, 'extract-only', false);
    const cleanOnly = getBoolean(flags, 'clean-only', false);
    const removeObsolete = getBoolean(flags, 'remove-obsolete', false);

    // Determine locales to process
    const locales = specificLocale ? [specificLocale] : Object.keys(LOCALES);

    // Validate locale
    if (specificLocale && !LOCALES[specificLocale]) {
        return {
            success: false,
            message: `Unknown locale: ${specificLocale}. Available: ${Object.keys(LOCALES).join(', ')}`,
        };
    }

    // Check translations directory exists
    if (!fs.existsSync(TRANSLATIONS_DIR)) {
        return {
            success: false,
            message: `Translations directory not found: ${TRANSLATIONS_DIR}`,
        };
    }

    // Always extract keys from source files (needed for both extraction and cleanup)
    info('Scanning source files for translation keys...');
    const keys = await extractTranslationKeys();
    info(`Found ${keys.size} unique translation keys`);

    // Process each locale
    let totalExtracted = 0;
    let totalCleaned = 0;
    let totalRemoved = 0;

    for (const locale of locales) {
        info(`Processing locale: ${locale}`);
        const result = await processLocale(locale, keys, extractOnly, cleanOnly, removeObsolete);
        totalExtracted += result.extracted;
        totalRemoved += result.removed;
        if (result.cleaned) totalCleaned++;
    }

    const messages: string[] = [];
    if (!cleanOnly) {
        messages.push(`Extracted ${totalExtracted} new keys`);
    }
    if (!extractOnly) {
        messages.push(`Cleaned ${totalCleaned}/${locales.length} XLF files`);
        if (totalRemoved > 0) {
            messages.push(`Removed ${totalRemoved} obsolete trans-units across ${locales.length} locales`);
        }
    }

    return {
        success: true,
        message: messages.join('. '),
        stats: {
            extracted: totalExtracted,
            cleaned: totalCleaned,
            removed: totalRemoved,
            locales,
        },
    };
}

export function printHelp(): void {
    console.log(`
${colors.bold('translations')} - Extract and clean translation strings

${colors.cyan('Usage:')}
  bun cli translations [options]

${colors.cyan('Options:')}
  --locale <code>      Process specific locale only
  --extract-only       Only extract strings (skip cleanup)
  --clean-only         Only clean XLF files (skip extraction)
  --remove-obsolete    Remove trans-units not found in source code (destructive)
  -h, --help           Show this help message

${colors.cyan('Available Locales:')}
  ${Object.keys(LOCALES).join(', ')}

${colors.cyan('Extraction:')}
  Scans source files for translation function calls:
  - trans('key'), trans("key")
  - __('key'), __("key")
  - t('key'), t("key")
  - _('key'), _("key") (GUI translations)
  - c_('key'), c_("key") (content translations)
  - 'key' | trans (Nunjucks filter)
  - $\{TRANS_PREFIX}Key (runtime translatable strings)

  Source directories:
  - src/**/*.ts
  - views/**/*.njk
  - public/app/**/*.js
  - public/libs/**/*.js
  - public/files/perm/idevices/**/*.js

${colors.cyan('Cleanup:')}
  - Replaces <target>__...</target> with <target></target>
  - Removes trans-units with source starting with \\\\
  - Removes obsolete trans-units not found in source code (requires --remove-obsolete)
  - Cleans up multiple empty lines

${colors.cyan('Examples:')}
  bun cli translations                              # Extract and clean all locales
  bun cli translations --locale=es                  # Process Spanish only
  bun cli translations --extract-only               # Only add new keys
  bun cli translations --clean-only                 # Only clean invalid entries
  bun cli translations --clean-only --remove-obsolete  # Clean and remove obsolete keys
`);
}

// Allow running directly
if (import.meta.main) {
    const { positional, flags } = parseArgs(process.argv);

    if (hasHelp(flags)) {
        printHelp();
        process.exit(EXIT_CODES.SUCCESS);
    }

    execute(positional, flags)
        .then(result => {
            if (result.success) {
                success(result.message);
                process.exit(EXIT_CODES.SUCCESS);
            } else {
                error(result.message);
                process.exit(EXIT_CODES.FAILURE);
            }
        })
        .catch(err => {
            error(err instanceof Error ? err.message : String(err));
            process.exit(EXIT_CODES.FAILURE);
        });
}
