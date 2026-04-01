/**
 * Translations Sort Command
 * Reorders trans-unit elements in XLF files to match the order in messages.en.xlf.
 *
 * Usage: bun cli translations:sort [options]
 * Options:
 *   --locale <code>   Sort specific locale only (default: all locales)
 */
import { parseArgs, getString, hasHelp } from '../utils/args';
import { success, error, warning, info, colors, EXIT_CODES } from '../utils/output';
import { LOCALES } from '../../services/translation';
import { extractTranslationKeys, addKeysToXlf, unescapeXml } from './translations';
import * as fs from 'fs';
import * as path from 'path';

interface Deps {
    extractKeys: () => Promise<Set<string>>;
    /** Used to re-read messages.en.xlf during post-sort verification. Injectable for testing. */
    readFileForVerification: (filePath: string) => string;
}

const defaultDeps: Deps = {
    extractKeys: extractTranslationKeys,
    readFileForVerification: (filePath: string) => fs.readFileSync(filePath, 'utf-8'),
};

let deps = defaultDeps;

export function configure(newDeps: Partial<Deps>): void {
    deps = { ...defaultDeps, ...newDeps };
}

export function resetDependencies(): void {
    deps = defaultDeps;
}

function translationsDir(): string {
    return path.join(process.cwd(), 'translations');
}

function enXlf(): string {
    return path.join(translationsDir(), 'messages.en.xlf');
}

function tempXlf(): string {
    return path.join(translationsDir(), 'messages.tmp.xlf');
}

export interface TranslationsSortResult {
    success: boolean;
    message: string;
}

/**
 * Extract ordered list of trans-unit IDs from XLF content.
 */
function getReferenceOrder(content: string): string[] {
    const order: string[] = [];
    const pattern = /<trans-unit\b[^>]*>/g;
    let match;
    while ((match = pattern.exec(content)) !== null) {
        const idMatch = match[0].match(/\bid="([^"]+)"/);
        if (idMatch) {
            order.push(idMatch[1]);
        }
    }
    return order;
}

/**
 * Extract a set of resnames (unescaped) from XLF content.
 */
function getResnames(content: string): Set<string> {
    const resnames = new Set<string>();
    const pattern = /resname="([^"]+)"/g;
    let match;
    while ((match = pattern.exec(content)) !== null) {
        resnames.add(unescapeXml(match[1]));
    }
    return resnames;
}

/**
 * Parse all trans-unit blocks from XLF content, indexed by ID.
 * Each block is the raw string including its surrounding indentation newline.
 */
function parseTransUnitBlocks(content: string): Map<string, string> {
    const blocks = new Map<string, string>();
    // Match each trans-unit block including the leading newline+spaces
    const pattern = /\n[ \t]*<trans-unit\b[^>]*>[\s\S]*?<\/trans-unit>/g;
    let match;
    while ((match = pattern.exec(content)) !== null) {
        const block = match[0];
        const idMatch = block.match(/\bid="([^"]+)"/);
        if (idMatch) {
            blocks.set(idMatch[1], block);
        }
    }
    return blocks;
}

/**
 * Normalize a raw trans-unit block to canonical indentation:
 *   6 spaces before <trans-unit>, 8 spaces before <source> and <target>.
 * Preserves CDATA sections and all attribute values verbatim.
 */
function normalizeTransUnitBlock(rawBlock: string): string {
    // Extract the opening <trans-unit ...> tag (all attributes preserved)
    const openTagMatch = rawBlock.match(/<trans-unit\b[^>]*>/);
    if (!openTagMatch) return rawBlock;
    const openTag = openTagMatch[0];

    // Extract raw source content (between <source> and </source>)
    const sourceMatch = rawBlock.match(/<source>([\s\S]*?)<\/source>/);
    const sourceContent = sourceMatch ? sourceMatch[1] : '';

    // Extract raw target content (between <target> and </target>), preserving CDATA
    const targetMatch = rawBlock.match(/<target>([\s\S]*?)<\/target>/);
    const targetContent = targetMatch !== null ? targetMatch[1] : '';

    return (
        '\n' +
        `      ${openTag}\n` +
        `        <source>${sourceContent}</source>\n` +
        `        <target>${targetContent}</target>\n` +
        `      </trans-unit>`
    );
}

/**
 * Rewrite an XLF file so its trans-units appear in the given order.
 * Trans-units not present in referenceOrder are appended at the end (should not happen if files are in sync).
 */
function sortXlfContent(content: string, referenceOrder: string[]): string {
    const blocks = parseTransUnitBlocks(content);

    // Build ordered blocks
    const orderedBlocks: string[] = [];
    const seen = new Set<string>();

    for (const id of referenceOrder) {
        if (blocks.has(id)) {
            orderedBlocks.push(normalizeTransUnitBlock(blocks.get(id)!));
            seen.add(id);
        }
    }

    // Append any blocks not present in referenceOrder (should be empty in normal usage)
    for (const [id, block] of blocks) {
        if (!seen.has(id)) {
            orderedBlocks.push(normalizeTransUnitBlock(block));
        }
    }

    // Replace the body content between <body> and </body>
    return content.replace(/<body>([\s\S]*?)<\/body>/, `<body>${orderedBlocks.join('')}\n    </body>`);
}

export async function execute(
    positional: string[],
    flags: Record<string, string | boolean | string[]>,
): Promise<TranslationsSortResult> {
    const specificLocale = getString(flags, 'locale');

    // Validate locale if given
    if (specificLocale && !LOCALES[specificLocale]) {
        return {
            success: false,
            message: `Unknown locale: ${specificLocale}. Available: ${Object.keys(LOCALES).join(', ')}`,
        };
    }

    const EN_XLF = enXlf();
    const TEMP_XLF = tempXlf();

    if (!fs.existsSync(EN_XLF)) {
        return { success: false, message: `Reference file not found: ${EN_XLF}` };
    }

    // Step 1: Extract all keys from source code
    info('Scanning source files for translation keys...');
    const extractedKeys = await deps.extractKeys();
    info(`Found ${extractedKeys.size} unique translation keys in source`);

    // Step 2: Generate temp XLF based on messages.en.xlf with any new keys appended
    const enContent = fs.readFileSync(EN_XLF, 'utf-8');
    const { content: tempContent } = addKeysToXlf(enContent, extractedKeys);
    fs.writeFileSync(TEMP_XLF, tempContent, 'utf-8');

    // Step 3: Compare resnames in temp file vs messages.en.xlf
    const enResnames = getResnames(enContent);
    const tempResnames = getResnames(tempContent);

    // onlyInTemp: keys added by the extraction that are not yet in messages.en.xlf.
    // Since addKeysToXlf only appends new keys, temp is always a superset of en.xlf,
    // so the only relevant difference is new keys present in the source but missing
    // from messages.en.xlf (user must run "make translations" first).
    const onlyInTemp = [...tempResnames].filter(r => !enResnames.has(r));

    if (onlyInTemp.length > 0) {
        fs.unlinkSync(TEMP_XLF);

        const lines: string[] = [
            'messages.en.xlf is not in sync with the source code.',
            `\nStrings found in source but missing from messages.en.xlf (run "make translations"):`,
        ];
        for (const r of onlyInTemp) lines.push(`  + ${r}`);
        return { success: false, message: lines.join('\n') };
    }

    // Step 4: Sort target files
    const referenceOrder = getReferenceOrder(tempContent);

    const localesToSort = specificLocale ? [specificLocale] : Object.keys(LOCALES);
    let sortedCount = 0;

    for (const locale of localesToSort) {
        const xlfPath = path.join(translationsDir(), `messages.${locale}.xlf`);
        if (!fs.existsSync(xlfPath)) {
            warning(`XLF file not found, skipping: messages.${locale}.xlf`);
            continue;
        }
        const original = fs.readFileSync(xlfPath, 'utf-8');
        const sorted = sortXlfContent(original, referenceOrder);
        fs.writeFileSync(xlfPath, sorted, 'utf-8');
        sortedCount++;
        info(`Sorted: messages.${locale}.xlf`);
    }

    // Step 5: Re-verify messages.en.xlf against temp file
    const enAfter = deps.readFileForVerification(EN_XLF);
    const enAfterResnames = getResnames(enAfter);
    const tempResnames2 = getResnames(tempContent);
    const diffAfter = [...tempResnames2].filter(r => !enAfterResnames.has(r));

    if (diffAfter.length > 0) {
        return {
            success: false,
            message: `Re-verification failed: ${diffAfter.length} string(s) missing from messages.en.xlf after sorting. Temp file preserved at: ${TEMP_XLF}`,
        };
    }

    // Step 6: Clean up temp file
    fs.unlinkSync(TEMP_XLF);

    const scope = specificLocale ? `messages.${specificLocale}.xlf` : `${sortedCount} XLF file(s)`;
    return {
        success: true,
        message: `Successfully sorted ${scope}. All trans-units now follow the order of messages.en.xlf.`,
    };
}

export function printHelp(): void {
    console.log(`
${colors.bold('translations:sort')} - Reorder trans-units in XLF files to match messages.en.xlf

${colors.cyan('Usage:')}
  bun cli translations:sort [options]

${colors.cyan('Options:')}
  --locale <code>   Sort specific locale only (default: all locales)
  -h, --help        Show this help message

${colors.cyan('Description:')}
  1. Extracts all strings from source code and compares them to messages.en.xlf.
  2. If messages.en.xlf is not in sync, shows the differences and exits.
  3. Reorders all XLF files (or the specified locale) so that trans-unit elements
     appear in the same order as in messages.en.xlf.
  4. Verifies that no strings were lost during sorting.
  5. Reports success and removes the temporary file.

${colors.cyan('Available Locales:')}
  ${Object.keys(LOCALES).join(', ')}

${colors.cyan('Examples:')}
  bun cli translations:sort                     # Sort all locales
  bun cli translations:sort --locale=es         # Sort Spanish only
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
