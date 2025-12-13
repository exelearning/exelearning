/**
 * ZIP Service for Elysia
 * Provides ZIP file extraction and creation utilities
 *
 * Uses fflate for all ZIP operations (high-performance, works in Node.js and browser)
 * Uses Dependency Injection pattern for testability
 */
import * as fflateModule from 'fflate';
import * as fsExtra from 'fs-extra';
import * as pathModule from 'path';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Dependencies that can be injected for testing
 */
export interface ZipDeps {
    fs?: typeof fsExtra;
    path?: typeof pathModule;
    fflate?: typeof fflateModule;
}

/**
 * ZIP service interface
 */
export interface ZipService {
    extractZip: (zipPath: string, targetDir: string) => Promise<string[]>;
    extractZipFromBuffer: (zipBuffer: Buffer, targetDir: string) => Promise<string[]>;
    createZip: (sourceDir: string, outputPath: string, options?: { compressionLevel?: number }) => Promise<void>;
    createZipBuffer: (sourceDir: string) => Promise<Buffer>;
    addToZip: (zipPath: string, files: Array<{ path: string; name: string }>) => Promise<void>;
    listZipContents: (zipPath: string) => Promise<string[]>;
    readFileFromZip: (zipPath: string, fileName: string) => Promise<Buffer | null>;
    readFileFromZipAsString: (zipPath: string, fileName: string, encoding?: BufferEncoding) => Promise<string | null>;
    fileExistsInZip: (zipPath: string, fileName: string) => Promise<boolean>;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a ZipService instance with injected dependencies
 */
export function createZipService(deps: ZipDeps = {}): ZipService {
    const fs = deps.fs ?? fsExtra;
    const path = deps.path ?? pathModule;
    const fflate = deps.fflate ?? fflateModule;

    // ========================================================================
    // Extraction Functions
    // ========================================================================

    const extractZip = async (zipPath: string, targetDir: string): Promise<string[]> => {
        // Read the zip file
        const zipData = await fs.readFile(zipPath);
        // Convert Buffer to Uint8Array
        const uint8ZipData = new Uint8Array(zipData);

        // Ensure target directory exists
        await fs.ensureDir(targetDir);

        // Use sync version for reliability in Node.js/Bun environment
        const unzipped = fflate.unzipSync(uint8ZipData);
        const extractedFiles: string[] = [];

        // Extract all files
        for (const [relativePath, data] of Object.entries(unzipped)) {
            // Skip directories (they end with /)
            if (relativePath.endsWith('/')) {
                await fs.ensureDir(path.join(targetDir, relativePath));
                continue;
            }

            // Build target path
            const targetPath = path.join(targetDir, relativePath);

            // Ensure parent directory exists
            await fs.ensureDir(path.dirname(targetPath));

            // Write file
            await fs.writeFile(targetPath, Buffer.from(data));
            extractedFiles.push(relativePath);
        }

        return extractedFiles;
    };

    const extractZipFromBuffer = async (zipBuffer: Buffer, targetDir: string): Promise<string[]> => {
        // Convert Buffer to Uint8Array
        const uint8ZipData = new Uint8Array(zipBuffer);

        // Ensure target directory exists
        await fs.ensureDir(targetDir);

        // Use sync version for reliability in Node.js/Bun environment
        const unzipped = fflate.unzipSync(uint8ZipData);
        const extractedFiles: string[] = [];

        // Extract all files
        for (const [relativePath, data] of Object.entries(unzipped)) {
            // Skip directories (they end with /)
            if (relativePath.endsWith('/')) {
                await fs.ensureDir(path.join(targetDir, relativePath));
                continue;
            }

            // Build target path
            const targetPath = path.join(targetDir, relativePath);

            // Ensure parent directory exists
            await fs.ensureDir(path.dirname(targetPath));

            // Write file
            await fs.writeFile(targetPath, Buffer.from(data));
            extractedFiles.push(relativePath);
        }

        return extractedFiles;
    };

    // ========================================================================
    // Creation Functions
    // ========================================================================

    const createZip = async (
        sourceDir: string,
        outputPath: string,
        options: { compressionLevel?: number } = {},
    ): Promise<void> => {
        const level = options.compressionLevel ?? 6;
        const files: Record<string, fflateModule.Zippable[string]> = {};

        // Read all files from source directory
        const addFilesToZip = async (dir: string, basePath: string = ''): Promise<void> => {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const zipPath = basePath ? `${basePath}/${entry.name}` : entry.name;

                if (entry.isDirectory()) {
                    await addFilesToZip(fullPath, zipPath);
                } else {
                    const content = await fs.readFile(fullPath);
                    const uint8Data = new Uint8Array(content);
                    files[zipPath] = [uint8Data, { level }];
                }
            }
        };

        await addFilesToZip(sourceDir);

        // Create the ZIP
        const zipped = fflate.zipSync(files);
        await fs.writeFile(outputPath, Buffer.from(zipped));
    };

    const createZipBuffer = async (sourceDir: string): Promise<Buffer> => {
        const files: Record<string, fflateModule.Zippable[string]> = {};

        // Read all files from source directory
        const addFilesToZip = async (dir: string, basePath: string = ''): Promise<void> => {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const zipPath = basePath ? `${basePath}/${entry.name}` : entry.name;

                if (entry.isDirectory()) {
                    await addFilesToZip(fullPath, zipPath);
                } else {
                    const content = await fs.readFile(fullPath);
                    const uint8Data = new Uint8Array(content);
                    files[zipPath] = [uint8Data, { level: 6 }];
                }
            }
        };

        await addFilesToZip(sourceDir);

        // Create the ZIP
        const zipped = fflate.zipSync(files);
        return Buffer.from(zipped);
    };

    const addToZip = async (zipPath: string, filesToAdd: Array<{ path: string; name: string }>): Promise<void> => {
        // Load existing zip contents or start fresh
        let existingFiles: Record<string, Uint8Array> = {};

        if (await fs.pathExists(zipPath)) {
            const zipData = await fs.readFile(zipPath);
            const uint8ZipData = new Uint8Array(zipData);
            existingFiles = fflate.unzipSync(uint8ZipData);
        }

        // Add new files
        for (const file of filesToAdd) {
            const content = await fs.readFile(file.path);
            const uint8Data = new Uint8Array(content);
            existingFiles[file.name] = uint8Data;
        }

        // Convert to format expected by zip()
        const zippableFiles: Record<string, fflateModule.Zippable[string]> = {};
        for (const [name, data] of Object.entries(existingFiles)) {
            zippableFiles[name] = [data, { level: 6 }];
        }

        // Create and write the new ZIP
        const zipped = fflate.zipSync(zippableFiles);
        await fs.writeFile(zipPath, Buffer.from(zipped));
    };

    // ========================================================================
    // Reading Functions
    // ========================================================================

    const listZipContents = async (zipPath: string): Promise<string[]> => {
        const zipData = await fs.readFile(zipPath);
        const uint8ZipData = new Uint8Array(zipData);
        const unzipped = fflate.unzipSync(uint8ZipData);

        // Filter out directories (fflate doesn't include them, but just in case)
        return Object.keys(unzipped).filter(name => !name.endsWith('/'));
    };

    const readFileFromZip = async (zipPath: string, fileName: string): Promise<Buffer | null> => {
        const zipData = await fs.readFile(zipPath);
        const uint8ZipData = new Uint8Array(zipData);
        const unzipped = fflate.unzipSync(uint8ZipData);

        if (unzipped[fileName]) {
            return Buffer.from(unzipped[fileName]);
        }

        return null;
    };

    const readFileFromZipAsString = async (
        zipPath: string,
        fileName: string,
        encoding: BufferEncoding = 'utf-8',
    ): Promise<string | null> => {
        const buffer = await readFileFromZip(zipPath, fileName);
        if (!buffer) return null;
        return buffer.toString(encoding);
    };

    const fileExistsInZip = async (zipPath: string, fileName: string): Promise<boolean> => {
        const zipData = await fs.readFile(zipPath);
        const uint8ZipData = new Uint8Array(zipData);
        const unzipped = fflate.unzipSync(uint8ZipData);
        return fileName in unzipped;
    };

    // ========================================================================
    // Return ZipService Interface
    // ========================================================================

    return {
        extractZip,
        extractZipFromBuffer,
        createZip,
        createZipBuffer,
        addToZip,
        listZipContents,
        readFileFromZip,
        readFileFromZipAsString,
        fileExistsInZip,
    };
}

// ============================================================================
// Default Instance (for backwards compatibility)
// ============================================================================

const defaultZipService = createZipService();

// Export all functions from the default instance for backwards compatibility
export const extractZip = defaultZipService.extractZip;
export const extractZipFromBuffer = defaultZipService.extractZipFromBuffer;
export const createZip = defaultZipService.createZip;
export const createZipBuffer = defaultZipService.createZipBuffer;
export const addToZip = defaultZipService.addToZip;
export const listZipContents = defaultZipService.listZipContents;
export const readFileFromZip = defaultZipService.readFileFromZip;
export const readFileFromZipAsString = defaultZipService.readFileFromZipAsString;
export const fileExistsInZip = defaultZipService.fileExistsInZip;
