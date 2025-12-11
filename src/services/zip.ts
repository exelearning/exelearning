/**
 * ZIP Service for Elysia
 * Provides ZIP file extraction and creation utilities
 *
 * Uses Dependency Injection pattern for testability
 */
import JSZipModule from 'jszip';
import * as fsExtra from 'fs-extra';
import * as pathModule from 'path';
import ArchiverModule from 'archiver';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Dependencies that can be injected for testing
 */
export interface ZipDeps {
    fs?: typeof fsExtra;
    path?: typeof pathModule;
    JSZip?: typeof JSZipModule;
    Archiver?: typeof ArchiverModule;
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
    const JSZip = deps.JSZip ?? JSZipModule;
    const Archiver = deps.Archiver ?? ArchiverModule;

    // ========================================================================
    // Extraction Functions
    // ========================================================================

    const extractZip = async (
        zipPath: string,
        targetDir: string
    ): Promise<string[]> => {
        // Read the zip file
        const zipData = await fs.readFile(zipPath);
        const zip = await JSZip.loadAsync(zipData);

        // Ensure target directory exists
        await fs.ensureDir(targetDir);

        const extractedFiles: string[] = [];

        // Extract all files
        for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
            // Skip directories
            if (zipEntry.dir) {
                await fs.ensureDir(path.join(targetDir, relativePath));
                continue;
            }

            // Get file content
            const content = await zipEntry.async('nodebuffer');

            // Build target path
            const targetPath = path.join(targetDir, relativePath);

            // Ensure parent directory exists
            await fs.ensureDir(path.dirname(targetPath));

            // Write file
            await fs.writeFile(targetPath, content);
            extractedFiles.push(relativePath);
        }

        return extractedFiles;
    };

    const extractZipFromBuffer = async (
        zipBuffer: Buffer,
        targetDir: string
    ): Promise<string[]> => {
        const zip = await JSZip.loadAsync(zipBuffer);

        // Ensure target directory exists
        await fs.ensureDir(targetDir);

        const extractedFiles: string[] = [];

        // Extract all files
        for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
            // Skip directories
            if (zipEntry.dir) {
                await fs.ensureDir(path.join(targetDir, relativePath));
                continue;
            }

            // Get file content
            const content = await zipEntry.async('nodebuffer');

            // Build target path
            const targetPath = path.join(targetDir, relativePath);

            // Ensure parent directory exists
            await fs.ensureDir(path.dirname(targetPath));

            // Write file
            await fs.writeFile(targetPath, content);
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
        options: { compressionLevel?: number } = {}
    ): Promise<void> => {
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(outputPath);
            const archive = Archiver('zip', {
                zlib: { level: options.compressionLevel ?? 6 },
            });

            output.on('close', () => resolve());
            output.on('error', reject);
            archive.on('error', reject);

            archive.pipe(output);
            archive.directory(sourceDir, false);
            archive.finalize();
        });
    };

    const createZipBuffer = async (sourceDir: string): Promise<Buffer> => {
        const zip = new JSZip();

        // Read all files from source directory
        const addFilesToZip = async (dir: string, zipFolder: JSZipModule): Promise<void> => {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    const subFolder = zipFolder.folder(entry.name);
                    if (subFolder) {
                        await addFilesToZip(fullPath, subFolder);
                    }
                } else {
                    const content = await fs.readFile(fullPath);
                    zipFolder.file(entry.name, content);
                }
            }
        };

        await addFilesToZip(sourceDir, zip);

        return zip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 },
        });
    };

    const addToZip = async (
        zipPath: string,
        files: Array<{ path: string; name: string }>
    ): Promise<void> => {
        // Load existing zip or create new
        let zip: JSZipModule;

        if (await fs.pathExists(zipPath)) {
            const zipData = await fs.readFile(zipPath);
            zip = await JSZip.loadAsync(zipData);
        } else {
            zip = new JSZip();
        }

        // Add files
        for (const file of files) {
            const content = await fs.readFile(file.path);
            zip.file(file.name, content);
        }

        // Write back
        const buffer = await zip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE',
        });

        await fs.writeFile(zipPath, buffer);
    };

    // ========================================================================
    // Reading Functions
    // ========================================================================

    const listZipContents = async (zipPath: string): Promise<string[]> => {
        const zipData = await fs.readFile(zipPath);
        const zip = await JSZip.loadAsync(zipData);

        return Object.keys(zip.files).filter(name => !zip.files[name].dir);
    };

    const readFileFromZip = async (
        zipPath: string,
        fileName: string
    ): Promise<Buffer | null> => {
        const zipData = await fs.readFile(zipPath);
        const zip = await JSZip.loadAsync(zipData);

        const file = zip.file(fileName);
        if (!file) return null;

        return file.async('nodebuffer');
    };

    const readFileFromZipAsString = async (
        zipPath: string,
        fileName: string,
        encoding: BufferEncoding = 'utf-8'
    ): Promise<string | null> => {
        const buffer = await readFileFromZip(zipPath, fileName);
        if (!buffer) return null;
        return buffer.toString(encoding);
    };

    const fileExistsInZip = async (
        zipPath: string,
        fileName: string
    ): Promise<boolean> => {
        const zipData = await fs.readFile(zipPath);
        const zip = await JSZip.loadAsync(zipData);
        return zip.file(fileName) !== null;
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
