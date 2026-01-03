/**
 * ELP Convert Command
 * Convert eXeLearning v2.x (.elp) file to v3.0 (.elpx) format
 *
 * Usage:
 *   bun cli elp:convert <input> <output> [options]
 *   bun cli elp:convert - <output> < input.elp
 *
 * Options:
 *   --debug, -d    Enable debug mode
 *   --help, -h     Show this help message
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
    ElpxExporter,
} from '../../shared/export';

export interface ElpConvertResult {
    success: boolean;
    message: string;
}

/**
 * Read data from stdin
 * Exported for testing purposes
 */
export async function readFromStdin(): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

/**
 * Dependencies for elp-convert command (for testing)
 */
export interface ElpConvertDependencies {
    readStdin: () => Promise<Buffer>;
}

const defaultDependencies: ElpConvertDependencies = {
    readStdin: readFromStdin,
};

let deps = defaultDependencies;

/**
 * Configure dependencies (for testing)
 */
export function configureDependencies(newDeps: Partial<ElpConvertDependencies>): void {
    deps = { ...defaultDependencies, ...newDeps };
}

/**
 * Reset dependencies to defaults (for testing)
 */
export function resetDependencies(): void {
    deps = defaultDependencies;
}

/**
 * Check if a directory is writable by attempting to create a temp file
 */
async function isDirectoryWritable(dirPath: string): Promise<boolean> {
    const testFile = path.join(dirPath, `.write-test-${Date.now()}`);
    try {
        await fs.writeFile(testFile, '');
        await fs.unlink(testFile);
        return true;
    } catch {
        return false;
    }
}

/**
 * Ensure output directory exists and is writable
 */
async function ensureOutputDirectory(outputPath: string): Promise<{ success: boolean; error?: string }> {
    const outputDir = path.dirname(outputPath);

    // Check if output directory exists
    if (!existsSync(outputDir)) {
        try {
            await fs.mkdir(outputDir, { recursive: true });
        } catch (error) {
            return {
                success: false,
                error: `Cannot create output directory: ${outputDir}. ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }

    // Check if output directory is writable
    if (!(await isDirectoryWritable(outputDir))) {
        return {
            success: false,
            error: `Output directory is not writable: ${outputDir}`,
        };
    }

    return { success: true };
}

export async function execute(
    positional: string[],
    flags: Record<string, string | boolean | string[]>,
): Promise<ElpConvertResult> {
    if (hasHelp(flags)) {
        printHelp();
        return { success: true, message: '' };
    }

    const input = positional[0] || getString(flags, 'input');
    const output = positional[1] || getString(flags, 'output');
    const debug = getBoolean(flags, 'debug') || getBoolean(flags, 'd');

    // Validate required arguments
    if (!input) {
        return {
            success: false,
            message: 'INPUT is required. Use: elp:convert <input> <output>',
        };
    }

    if (!output) {
        return {
            success: false,
            message: 'OUTPUT is required. Use: elp:convert <input> <output>',
        };
    }

    // Check if input file exists (unless stdin)
    if (input !== '-' && !existsSync(input)) {
        return {
            success: false,
            message: `Input file not found: ${input}`,
        };
    }

    // Ensure output directory exists and is writable
    const outputCheck = await ensureOutputDirectory(output);
    if (!outputCheck.success) {
        return {
            success: false,
            message: outputCheck.error!,
        };
    }

    if (debug) {
        console.log(`[DEBUG] Input: ${input}`);
        console.log(`[DEBUG] Output: ${output}`);
    }

    try {
        // Handle stdin input
        let inputPath = input;
        let tempInputFile: string | null = null;

        if (input === '-') {
            // Read from stdin and write to temp file
            const stdinData = await deps.readStdin();

            if (stdinData.length === 0) {
                return {
                    success: false,
                    message: 'No data received from stdin',
                };
            }

            tempInputFile = path.join('/tmp', `elp-input-${Date.now()}.elp`);
            await fs.writeFile(tempInputFile, stdinData);
            inputPath = tempInputFile;

            if (debug) {
                console.log(`[DEBUG] Wrote stdin to ${tempInputFile} (${stdinData.length} bytes)`);
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
            console.log(`[DEBUG] Theme: ${meta.theme}`);
            console.log(`[DEBUG] Language: ${meta.language}`);
        }

        // Create providers
        const publicDir = path.resolve(process.cwd(), process.env.PUBLIC_DIR || 'public');
        const resourceProvider = new FileSystemResourceProvider(publicDir);

        // Get the extracted ELP directory path from the adapter
        const extractedPath = document.extractedPath || path.dirname(inputPath);
        const assetProvider = new FileSystemAssetProvider(extractedPath);

        const zipProvider = new FflateZipProvider();

        // Create ELPX exporter
        const exporter = new ElpxExporter(document, resourceProvider, assetProvider, zipProvider);

        // Run export
        if (debug) {
            console.log(`[DEBUG] Starting ELPX export...`);
        }

        const result = await exporter.export({
            filename: path.basename(output),
        });

        if (!result.success) {
            return {
                success: false,
                message: `Conversion failed: ${result.error}`,
            };
        }

        // Determine output path (add .elpx extension if needed)
        const outputPath =
            output.endsWith('.elpx') || output.endsWith('.zip') ? output : `${output}${exporter.getFileExtension()}`;

        // Write the ZIP buffer
        if (result.data) {
            await fs.writeFile(outputPath, result.data);

            if (debug) {
                const stats = await fs.stat(outputPath);
                console.log(`[DEBUG] Written ${stats.size} bytes to ${outputPath}`);
            }
        } else {
            return {
                success: false,
                message: 'Conversion produced no output data',
            };
        }

        // Clean up temp file if created
        if (tempInputFile) {
            await fs.unlink(tempInputFile).catch(() => {});
        }

        // Clean up extracted directory
        if (document.extractedPath) {
            await fs.rm(document.extractedPath, { recursive: true, force: true }).catch(() => {});
        }

        if (debug) {
            console.log(`[DEBUG] Conversion completed: ${outputPath}`);
        }

        return {
            success: true,
            message: `Conversion completed: ${outputPath}`,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            message: `Conversion failed: ${errorMessage}`,
        };
    }
}

export function printHelp(): void {
    console.log(`
${colors.bold('elp:convert')} - Convert ELP to ELPX format

${colors.cyan('Usage:')}
  bun cli elp:convert <input> <output> [options]
  bun cli elp:convert - <output> < input.elp

${colors.cyan('Description:')}
  Convert eXeLearning v2.x (.elp) file to v3.0 (.elpx) format

${colors.cyan('Arguments:')}
  input     Input ELP file path (use "-" for stdin)
  output    Output ELPX file path

${colors.cyan('Options:')}
  --debug, -d    Enable debug mode
  --help, -h     Show this help message

${colors.cyan('Examples:')}
  bun cli elp:convert input.elp output.elpx
  bun cli elp:convert - output.elpx < input.elp
  bun cli elp:convert input.elp output.elpx --debug
`);
}
