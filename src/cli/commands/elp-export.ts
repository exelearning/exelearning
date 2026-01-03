/**
 * ELP Export Command
 * Export .elp file to any supported format
 *
 * Usage:
 *   bun cli elp:export <input> <output> [format] [options]
 *   bun cli elp:export - <output> <format> < input.elp
 *
 * Formats:
 *   html5       HTML5 folder structure
 *   html5-sp    HTML5 single page
 *   scorm12     SCORM 1.2 package
 *   scorm2004   SCORM 2004 package
 *   ims         IMS Content Package
 *   epub3       EPUB 3 e-book
 *   elpx        Re-export as ELPX
 *
 * Options:
 *   --format, -f    Export format (alternative to positional)
 *   --theme, -t     Theme name (overrides ELP metadata)
 *   --base-url, -b  Base URL for links
 *   --debug, -d     Enable debug mode
 *   --help, -h      Show this help message
 */
import { getString, getBoolean, hasHelp } from '../utils/args';
import { colors } from '../utils/output';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';

// Import shared export system
import {
    ElpDocumentAdapter,
    FileSystemResourceProvider,
    FileSystemAssetProvider,
    FflateZipProvider,
    Html5Exporter,
    PageExporter,
    Scorm12Exporter,
    Scorm2004Exporter,
    ImsExporter,
    Epub3Exporter,
    ElpxExporter,
} from '../../shared/export';

export const VALID_FORMATS = ['html5', 'html5-sp', 'scorm12', 'scorm2004', 'ims', 'epub3', 'elpx'] as const;
export type ExportFormat = (typeof VALID_FORMATS)[number];

export interface ElpExportResult {
    success: boolean;
    message: string;
}

export async function execute(
    positional: string[],
    flags: Record<string, string | boolean | string[]>,
): Promise<ElpExportResult> {
    if (hasHelp(flags)) {
        printHelp();
        return { success: true, message: '' };
    }

    const input = positional[0] || getString(flags, 'input');
    const output = positional[1] || getString(flags, 'output');
    const format = (positional[2] || getString(flags, 'format') || getString(flags, 'f') || 'html5') as string;
    const baseUrl = getString(flags, 'base-url') || getString(flags, 'b');
    const theme = getString(flags, 'theme') || getString(flags, 't');
    const debug = getBoolean(flags, 'debug') || getBoolean(flags, 'd');

    // Validate required arguments
    if (!input) {
        return {
            success: false,
            message: 'INPUT is required. Use: elp:export <input> <output> [format]',
        };
    }

    if (!output) {
        return {
            success: false,
            message: 'OUTPUT is required. Use: elp:export <input> <output> [format]',
        };
    }

    // Validate format
    if (!VALID_FORMATS.includes(format as ExportFormat)) {
        return {
            success: false,
            message: `Invalid format: ${format}. Valid formats: ${VALID_FORMATS.join(', ')}`,
        };
    }

    // Check if input file exists (unless stdin)
    if (input !== '-' && !existsSync(input)) {
        return {
            success: false,
            message: `Input file not found: ${input}`,
        };
    }

    if (debug) {
        console.log(`[DEBUG] Input: ${input}`);
        console.log(`[DEBUG] Output: ${output}`);
        console.log(`[DEBUG] Format: ${format}`);
        if (baseUrl) console.log(`[DEBUG] Base URL: ${baseUrl}`);
        if (theme) console.log(`[DEBUG] Theme: ${theme}`);
    }

    try {
        // Handle stdin input
        let inputPath = input;
        let tempInputFile: string | null = null;

        if (input === '-') {
            // Read from stdin and write to temp file
            const chunks: Buffer[] = [];
            for await (const chunk of process.stdin) {
                chunks.push(Buffer.from(chunk));
            }
            const stdinData = Buffer.concat(chunks);

            tempInputFile = path.join('/tmp', `elp-input-${Date.now()}.elp`);
            await fs.writeFile(tempInputFile, stdinData);
            inputPath = tempInputFile;

            if (debug) {
                console.log(`[DEBUG] Wrote stdin to ${tempInputFile}`);
            }
        }

        // Create document adapter from ELP file
        if (debug) {
            console.log(`[DEBUG] Loading ELP file: ${inputPath}`);
        }

        const document = await ElpDocumentAdapter.fromElpFile(inputPath);
        const meta = document.getMetadata();

        if (debug) {
            console.log(`[DEBUG] Project title: ${meta.title}`);
            console.log(`[DEBUG] Pages: ${document.getNavigation().length}`);
        }

        // Create providers
        const publicDir = path.resolve(process.cwd(), process.env.PUBLIC_DIR || 'public');
        const resourceProvider = new FileSystemResourceProvider(publicDir);

        // Get the extracted ELP directory path from the adapter
        const extractedPath = document.extractedPath || path.dirname(inputPath);
        const assetProvider = new FileSystemAssetProvider(extractedPath);

        const zipProvider = new FflateZipProvider();

        // Create appropriate exporter based on format
        let exporter;
        switch (format) {
            case 'html5':
                exporter = new Html5Exporter(document, resourceProvider, assetProvider, zipProvider);
                break;
            case 'html5-sp':
                exporter = new PageExporter(document, resourceProvider, assetProvider, zipProvider);
                break;
            case 'scorm12':
                exporter = new Scorm12Exporter(document, resourceProvider, assetProvider, zipProvider);
                break;
            case 'scorm2004':
                exporter = new Scorm2004Exporter(document, resourceProvider, assetProvider, zipProvider);
                break;
            case 'ims':
                exporter = new ImsExporter(document, resourceProvider, assetProvider, zipProvider);
                break;
            case 'epub3':
                exporter = new Epub3Exporter(document, resourceProvider, assetProvider, zipProvider);
                break;
            case 'elpx':
                exporter = new ElpxExporter(document, resourceProvider, assetProvider, zipProvider);
                break;
            // No default needed - invalid formats are caught by VALID_FORMATS check above
        }

        // Run export
        if (debug) {
            console.log(`[DEBUG] Starting ${format} export...`);
        }

        const result = await exporter.export({
            filename: path.basename(output),
            baseUrl,
            theme,
        });

        if (!result.success) {
            return {
                success: false,
                message: `Export failed: ${result.error}`,
            };
        }

        // Write output
        const extension = exporter.getFileExtension();
        const outputPath = output.endsWith('.zip') || output.endsWith(extension) ? output : `${output}${extension}`;

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        await fs.mkdir(outputDir, { recursive: true });

        // Write the ZIP buffer
        if (result.data) {
            await fs.writeFile(outputPath, result.data);
        }

        // Clean up temp file if created
        if (tempInputFile) {
            await fs.unlink(tempInputFile).catch(() => {});
        }

        if (debug) {
            console.log(`[DEBUG] Export completed: ${outputPath}`);
        }

        return {
            success: true,
            message: `Export completed: ${outputPath} (format: ${format})`,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            message: `Export failed: ${errorMessage}`,
        };
    }
}

export function printHelp(): void {
    console.log(`
${colors.bold('elp:export')} - Export ELP to various formats

${colors.cyan('Usage:')}
  bun cli elp:export <input> <output> [format] [options]
  bun cli elp:export - <output> <format> < input.elp

${colors.cyan('Description:')}
  Export .elp file to any supported format

${colors.cyan('Arguments:')}
  input     Input ELP file path (use "-" for stdin)
  output    Output file path (.zip will be added if needed)
  format    Export format (default: html5)

${colors.cyan('Formats:')}
  html5       HTML5 folder structure
  html5-sp    HTML5 single page
  scorm12     SCORM 1.2 package
  scorm2004   SCORM 2004 package
  ims         IMS Content Package
  epub3       EPUB 3 e-book
  elpx        Re-export as ELPX

${colors.cyan('Options:')}
  --format, -f    Export format (alternative to positional)
  --theme, -t     Theme name (overrides ELP metadata)
  --base-url, -b  Base URL for links
  --debug, -d     Enable debug mode
  --help, -h      Show this help message

${colors.cyan('Examples:')}
  bun cli elp:export input.elp ./output html5
  bun cli elp:export input.elp ./output --format=scorm12
  bun cli elp:export - ./output scorm2004 < input.elp
  bun cli elp:export input.elp ./output html5 --base-url=https://example.com
`);
}
