/**
 * ELP Export Command
 * Export .elp file to any supported format
 *
 * Uses the unified import system (ElpxImporter -> Yjs -> YjsDocumentAdapter)
 * to ensure parity with web-based exports.
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
import * as os from 'os';
import { existsSync, mkdirSync } from 'fs';
import * as Y from 'yjs';

// Import shared import system (new unified approach)
import { ElpxImporter, FileSystemAssetHandler } from '../../shared/import';

// Import shared export system
import {
    ServerYjsDocumentWrapper,
    YjsDocumentAdapter,
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
    ServerLatexPreRenderer,
    ServerMermaidPreRenderer,
} from '../../shared/export';

export const VALID_FORMATS = ['html5', 'html5-sp', 'scorm12', 'scorm2004', 'ims', 'epub3', 'elpx'] as const;
export type ExportFormat = (typeof VALID_FORMATS)[number];

export interface ElpExportResult {
    success: boolean;
    message: string;
}

// Lazy-initialized pre-renderers (singleton pattern)
let latexRenderer: ServerLatexPreRenderer | null = null;
let mermaidRenderer: ServerMermaidPreRenderer | null = null;

function getLatexRenderer(): ServerLatexPreRenderer {
    if (!latexRenderer) {
        latexRenderer = new ServerLatexPreRenderer();
    }
    return latexRenderer;
}

async function getMermaidRenderer(): Promise<ServerMermaidPreRenderer> {
    if (!mermaidRenderer) {
        mermaidRenderer = new ServerMermaidPreRenderer();
        await mermaidRenderer.initialize();
    }
    return mermaidRenderer;
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

            tempInputFile = path.join(os.tmpdir(), `elp-input-${Date.now()}.elp`);
            await fs.writeFile(tempInputFile, stdinData);
            inputPath = tempInputFile;

            if (debug) {
                console.log(`[DEBUG] Wrote stdin to ${tempInputFile}`);
            }
        }

        // Create extraction directory for assets
        const extractDir = path.join(
            os.tmpdir(),
            `elp-extract-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        );
        if (!existsSync(extractDir)) {
            mkdirSync(extractDir, { recursive: true });
        }

        if (debug) {
            console.log(`[DEBUG] Loading ELP file: ${inputPath}`);
            console.log(`[DEBUG] Extract directory: ${extractDir}`);
        }

        // Read the ELP file
        const elpBuffer = await fs.readFile(inputPath);

        // Create Y.Doc and import using ElpxImporter
        // This uses the same import code as the browser, ensuring parity
        const ydoc = new Y.Doc();
        const assetHandler = new FileSystemAssetHandler(extractDir);
        const importer = new ElpxImporter(ydoc, assetHandler);

        const importResult = await importer.importFromBuffer(new Uint8Array(elpBuffer));

        if (debug) {
            console.log(`[DEBUG] Import complete: ${importResult.pages} pages, ${importResult.assets} assets`);
        }

        // Wrap Y.Doc for export using YjsDocumentAdapter
        // This is the same adapter used by the browser export
        const wrapper = new ServerYjsDocumentWrapper(ydoc, 'cli-export');
        const document = new YjsDocumentAdapter(wrapper);
        const meta = document.getMetadata();

        if (debug) {
            console.log(`[DEBUG] Project title: ${meta.title}`);
            console.log(`[DEBUG] Pages: ${document.getNavigation().length}`);
            console.log(`[DEBUG] exportSource: ${meta.exportSource}`);
        }

        // Create providers
        // Pass extractDir to resourceProvider so it can find embedded themes
        const publicDir = path.resolve(process.cwd(), process.env.PUBLIC_DIR || 'public');
        const resourceProvider = new FileSystemResourceProvider(publicDir, extractDir);

        // Use the extraction directory for assets
        const assetProvider = new FileSystemAssetProvider(extractDir);

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

        // Create pre-render hooks for LaTeX and Mermaid
        // These convert LaTeX/Mermaid to static SVG, avoiding the need to bundle
        // MathJax (~1MB) and Mermaid (~2.7MB) libraries in the export
        const preRenderLatex = async (html: string) => {
            const renderer = getLatexRenderer();
            return renderer.preRender(html);
        };

        const preRenderDataGameLatex = async (html: string) => {
            const renderer = getLatexRenderer();
            return renderer.preRenderDataGameLatex(html);
        };

        const preRenderMermaid = async (html: string) => {
            const renderer = await getMermaidRenderer();
            return renderer.preRender(html);
        };

        if (debug) {
            console.log('[DEBUG] Pre-renderers initialized for LaTeX and Mermaid');
        }

        const result = await exporter.export({
            filename: path.basename(output),
            baseUrl,
            theme,
            preRenderLatex,
            preRenderDataGameLatex,
            preRenderMermaid,
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

        // Clean up extracted directory
        if (extractDir) {
            await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
        }

        // Clean up Y.Doc
        wrapper.destroy();

        // Clean up Mermaid renderer (releases jsdom resources)
        if (mermaidRenderer) {
            mermaidRenderer.destroy();
            mermaidRenderer = null;
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
