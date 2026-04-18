/**
 * Translations Format Command
 * Normalizes XLF translation files:
 *   - Wraps <target> content in <![CDATA[...]]> when the text contains characters
 *     that are invalid as raw XML (unrecognised entity references or bare `<`).
 *   - Normalises indentation: 6 spaces before <trans-unit>, 8 spaces before
 *     <source> and <target>.
 *
 * Usage: bun cli translations:format [options]
 * Options:
 *   --locale <code>   Format specific locale only (default: all locales except "en")
 */
import { parseArgs, getString, hasHelp } from '../utils/args';
import { success, error, warning, info, colors, EXIT_CODES } from '../utils/output';
import { LOCALES } from '../../services/translation';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Dependency injection
// ---------------------------------------------------------------------------

interface Deps {
    readFile: (filePath: string) => string;
    writeFile: (filePath: string, content: string) => void;
    fileExists: (filePath: string) => boolean;
}

const defaultDeps: Deps = {
    readFile: (filePath: string) => fs.readFileSync(filePath, 'utf-8'),
    writeFile: (filePath: string, content: string) => fs.writeFileSync(filePath, content, 'utf-8'),
    fileExists: (filePath: string) => fs.existsSync(filePath),
};

let deps = defaultDeps;

export function configure(newDeps: Partial<Deps>): void {
    deps = { ...defaultDeps, ...newDeps };
}

export function resetDependencies(): void {
    deps = defaultDeps;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function translationsDir(): string {
    return path.join(process.cwd(), 'translations');
}

// ---------------------------------------------------------------------------
// Core logic (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Returns true when `text` contains characters that make it invalid as raw XML
 * text content:
 *   - A bare `<` character.
 *   - An `&` that is NOT the start of one of the five predefined XML entity
 *     references: &amp; &lt; &gt; &quot; &apos;
 */
export function needsCDATA(text: string): boolean {
    if (text.includes('<')) return true;
    let pos = 0;
    while ((pos = text.indexOf('&', pos)) !== -1) {
        const rest = text.slice(pos + 1);
        if (!/^(amp|lt|gt|quot|apos);/i.test(rest)) return true;
        pos++;
    }
    return false;
}

/**
 * Given the raw content between `<target>` and `</target>` tags, returns the
 * correctly formatted version:
 *   - Already-wrapped CDATA sections are left untouched.
 *   - Empty content is left untouched.
 *   - Plain text that requires CDATA is wrapped: `<![CDATA[...]]>`.
 *   - Plain text that does not require CDATA is returned as-is.
 */
export function formatTargetContent(rawContent: string): string {
    if (rawContent.startsWith('<![CDATA[') && rawContent.endsWith(']]>')) {
        return rawContent;
    }
    if (rawContent.trim() === '') return rawContent;
    if (needsCDATA(rawContent)) {
        return `<![CDATA[${rawContent}]]>`;
    }
    return rawContent;
}

/**
 * Normalise a single raw trans-unit block (including its leading newline+spaces)
 * to canonical indentation and apply CDATA formatting to <target>.
 */
export function formatTransUnitBlock(rawBlock: string): string {
    const openTagMatch = rawBlock.match(/<trans-unit\b[^>]*>/);
    if (!openTagMatch) return rawBlock;
    const openTag = openTagMatch[0];

    const sourceMatch = rawBlock.match(/<source>([\s\S]*?)<\/source>/);
    const sourceContent = sourceMatch ? sourceMatch[1] : '';

    const targetMatch = rawBlock.match(/<target>([\s\S]*?)<\/target>/);
    const targetContent = targetMatch !== null ? targetMatch[1] : '';
    const formattedTarget = formatTargetContent(targetContent);

    return (
        '\n' +
        `      ${openTag}\n` +
        `        <source>${sourceContent}</source>\n` +
        `        <target>${formattedTarget}</target>\n` +
        `      </trans-unit>`
    );
}

/**
 * Apply formatting to the full content of an XLF file:
 * normalise every trans-unit block and add CDATA where required.
 */
export function formatXlfContent(content: string): string {
    return content.replace(
        /\n[ \t]*<trans-unit\b[^>]*>[\s\S]*?<\/trans-unit>/g,
        match => formatTransUnitBlock(match),
    );
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

export interface TranslationsFormatResult {
    success: boolean;
    message: string;
}

export async function execute(
    _positional: string[],
    flags: Record<string, string | boolean | string[]>,
): Promise<TranslationsFormatResult> {
    const specificLocale = getString(flags, 'locale');

    if (specificLocale && !LOCALES[specificLocale]) {
        return {
            success: false,
            message: `Unknown locale: ${specificLocale}. Available: ${Object.keys(LOCALES).join(', ')}`,
        };
    }

    // "en" is the source language — its targets are always identical to the
    // source, so CDATA normalisation does not apply. Exclude it unless the
    // caller explicitly requests it.
    const localesToFormat = specificLocale
        ? [specificLocale]
        : Object.keys(LOCALES).filter(l => l !== 'en');

    const dir = translationsDir();
    let formattedCount = 0;
    let unchangedCount = 0;

    for (const locale of localesToFormat) {
        const xlfPath = path.join(dir, `messages.${locale}.xlf`);
        if (!deps.fileExists(xlfPath)) {
            warning(`XLF file not found, skipping: messages.${locale}.xlf`);
            continue;
        }
        const original = deps.readFile(xlfPath);
        const formatted = formatXlfContent(original);
        if (formatted !== original) {
            deps.writeFile(xlfPath, formatted);
            formattedCount++;
            info(`Formatted: messages.${locale}.xlf`);
        } else {
            unchangedCount++;
            info(`No changes: messages.${locale}.xlf`);
        }
    }

    const scope = specificLocale ? `messages.${specificLocale}.xlf` : `${formattedCount + unchangedCount} XLF file(s)`;
    const detail = formattedCount > 0
        ? `${formattedCount} file(s) updated, ${unchangedCount} already correct.`
        : `All files already correctly formatted.`;

    return {
        success: true,
        message: `Formatted ${scope}. ${detail}`,
    };
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

export function printHelp(): void {
    console.log(`
${colors.bold('translations:format')} - Normalise XLF translation files

${colors.cyan('Usage:')}
  bun cli translations:format [options]

${colors.cyan('Options:')}
  --locale <code>   Format specific locale only (default: all locales except "en")
  -h, --help        Show this help message

${colors.cyan('What it does:')}
  1. Reads each target-language XLF file in translations/.
  2. Wraps any <target> element whose text contains characters invalid as raw
     XML (e.g. &percnt;, bare <) inside a CDATA section:
       <target><![CDATA[...]]></target>
  3. Leaves already-wrapped CDATA sections and valid plain-text targets untouched.
  4. Normalises indentation: 6 spaces before <trans-unit>, 8 spaces before
     <source> and <target>.

${colors.cyan('Available Locales:')}
  ${Object.keys(LOCALES).join(', ')}

${colors.cyan('Examples:')}
  bun cli translations:format                   # Format all locales
  bun cli translations:format --locale=es        # Format Spanish only
`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

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
