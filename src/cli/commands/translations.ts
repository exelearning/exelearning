/**
 * Translations Command
 * Extract translation strings and clean XLF files
 *
 * Usage: bun cli translations [options]
 * Options:
 *   --locale <code>   Process specific locale only
 *   --extract-only    Only extract strings (skip cleanup)
 *   --clean-only      Only clean XLF files (skip extraction)
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

    // Patterns to search for trans() calls
    const patterns = [
        /trans\(\s*['"]([^'"]+)['"]/g, // trans('key') or trans("key")
        /trans\(\s*`([^`]+)`/g, // trans(`key`)
        /__\(\s*['"]([^'"]+)['"]/g, // __('key') or __("key")
        /\bt\(\s*['"]([^'"]+)['"]/g, // t('key') or t("key")
        /\bc_\(\s*['"]([^'"]+)['"]/g, // c_('key') or c_("key") — content translations in common_i18n.js
    ];

    // Source directories to scan
    const sourceGlobs = [new Glob('src/**/*.ts'), new Glob('views/**/*.njk'), new Glob('public/app/**/*.js')];

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
 * Process a single locale
 */
async function processLocale(
    locale: string,
    keys: Set<string>,
    extractOnly: boolean,
    cleanOnly: boolean,
): Promise<{ extracted: number; cleaned: boolean }> {
    const xlfPath = path.join(TRANSLATIONS_DIR, `messages.${locale}.xlf`);

    if (!fs.existsSync(xlfPath)) {
        warning(`XLF file not found: ${xlfPath}`);
        return { extracted: 0, cleaned: false };
    }

    let content = fs.readFileSync(xlfPath, 'utf-8');
    let extracted = 0;
    let cleaned = false;

    // Extract: add new keys
    if (!cleanOnly && keys.size > 0) {
        const result = addKeysToXlf(content, keys);
        content = result.content;
        extracted = result.added;
    }

    // Clean: remove invalid entries
    if (!extractOnly) {
        const result = cleanXlfContent(content);
        content = result.content;
        cleaned = result.cleaned;
    }

    // Write back
    fs.writeFileSync(xlfPath, content, 'utf-8');

    return { extracted, cleaned };
}

export async function execute(
    positional: string[],
    flags: Record<string, string | boolean | string[]>,
): Promise<TranslationsResult> {
    // Parse options
    const specificLocale = getString(flags, 'locale');
    const extractOnly = getBoolean(flags, 'extract-only', false);
    const cleanOnly = getBoolean(flags, 'clean-only', false);

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

    // Extract keys from source files (unless clean-only)
    let keys = new Set<string>();
    if (!cleanOnly) {
        info('Scanning source files for translation keys...');
        keys = await extractTranslationKeys();
        info(`Found ${keys.size} unique translation keys`);
    }

    // Process each locale
    let totalExtracted = 0;
    let totalCleaned = 0;

    for (const locale of locales) {
        info(`Processing locale: ${locale}`);
        const result = await processLocale(locale, keys, extractOnly, cleanOnly);
        totalExtracted += result.extracted;
        if (result.cleaned) totalCleaned++;
    }

    const messages: string[] = [];
    if (!cleanOnly) {
        messages.push(`Extracted ${totalExtracted} new keys`);
    }
    if (!extractOnly) {
        messages.push(`Cleaned ${totalCleaned}/${locales.length} XLF files`);
    }

    return {
        success: true,
        message: messages.join('. '),
        stats: {
            extracted: totalExtracted,
            cleaned: totalCleaned,
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
  --locale <code>   Process specific locale only
  --extract-only    Only extract strings (skip cleanup)
  --clean-only      Only clean XLF files (skip extraction)
  -h, --help        Show this help message

${colors.cyan('Available Locales:')}
  ${Object.keys(LOCALES).join(', ')}

${colors.cyan('Extraction:')}
  Scans source files for translation function calls:
  - trans('key'), trans("key")
  - __('key'), __("key")
  - t('key'), t("key")

  Source directories:
  - src/**/*.ts
  - views/**/*.njk
  - public/app/**/*.js

${colors.cyan('Cleanup:')}
  - Replaces <target>__...</target> with <target></target>
  - Removes trans-units with source starting with \\\\
  - Cleans up multiple empty lines

${colors.cyan('Examples:')}
  bun cli translations                   # Extract and clean all locales
  bun cli translations --locale=es       # Process Spanish only
  bun cli translations --extract-only    # Only add new keys
  bun cli translations --clean-only      # Only clean invalid entries
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
