/**
 * FflateZipProvider
 *
 * ZIP provider implementation using fflate for both server-side and browser use.
 * Replaces ArchiverZipProvider and JSZipZipProvider with a single unified implementation.
 *
 * fflate is a high-performance, lightweight ZIP library that works in both
 * Node.js/Bun and browser environments.
 */

import * as fflate from 'fflate';
import type { ZipProvider, ZipArchive } from '../interfaces';

/**
 * Convert various content types to Uint8Array
 */
function toUint8Array(content: string | Uint8Array | Buffer | Blob): Uint8Array {
    if (content instanceof Uint8Array) {
        // Already a Uint8Array (includes Buffer in Node.js)
        return content;
    }
    if (typeof content === 'string') {
        return new TextEncoder().encode(content);
    }
    // Blob - this shouldn't happen in sync context, but handle it
    throw new Error('Blob content must be converted to Uint8Array before adding to ZIP');
}

/**
 * FflateZipProvider - Creates ZIP archives using fflate
 *
 * This class implements both ZipProvider and ZipArchive interfaces,
 * allowing direct use as an archive (addFile, generateAsync) without
 * needing to call createZip() first. This matches the behavior of the
 * previous ArchiverZipProvider and JSZipZipProvider implementations.
 */
export class FflateZipProvider implements ZipProvider, ZipArchive {
    private files: Map<string, Uint8Array> = new Map();

    /**
     * Create a new ZIP archive (returns self for compatibility)
     */
    createZip(): ZipArchive {
        // Reset and return self for compatibility with interface
        this.reset();
        return this;
    }

    /**
     * Add a file to the archive
     */
    addFile(path: string, content: string | Uint8Array | Blob): void {
        const data = toUint8Array(content as string | Uint8Array | Buffer);
        this.files.set(path, data);
    }

    /**
     * Add multiple files from a Map
     */
    addFiles(files: Map<string, string | Uint8Array | Blob>): void {
        for (const [path, content] of files) {
            this.addFile(path, content);
        }
    }

    /**
     * Generate the ZIP archive (async version for compatibility)
     */
    async generateAsync(): Promise<Uint8Array> {
        return this.generate();
    }

    /**
     * Generate the ZIP archive
     */
    async generate(): Promise<Uint8Array> {
        // Convert files map to fflate format
        const zipData: fflate.Zippable = {};

        for (const [path, data] of this.files) {
            // fflate expects the data with optional compression options
            // Use level 6 for good compression/speed balance
            zipData[path] = [data, { level: 6 }];
        }

        // Use zipSync for simplicity (async version would use zip())
        return fflate.zipSync(zipData);
    }

    /**
     * Reset the archive for reuse
     */
    reset(): void {
        this.files.clear();
    }

    /**
     * Get the number of files in the archive
     */
    getFileCount(): number {
        return this.files.size;
    }

    /**
     * Check if a file exists in the archive
     */
    hasFile(path: string): boolean {
        return this.files.has(path);
    }

    /**
     * Get all file paths in the archive
     * Used for generating complete manifest listings (e.g., imsmanifest.xml)
     */
    getFilePaths(): string[] {
        return Array.from(this.files.keys());
    }

    /**
     * Get file content (for testing)
     */
    getFile(path: string): Uint8Array | undefined {
        return this.files.get(path);
    }

    /**
     * Get file content as string (for testing)
     */
    getFileAsString(path: string): string | undefined {
        const data = this.files.get(path);
        if (!data) return undefined;
        return new TextDecoder().decode(data);
    }
}

// =============================================================================
// Utility functions for ZIP operations
// =============================================================================

/**
 * Extract a ZIP buffer to an object of files
 * @param zipData - ZIP file as Buffer or Uint8Array
 * @returns Object with file paths as keys and content as Uint8Array values
 */
export function unzipSync(zipData: Buffer | Uint8Array): Record<string, Uint8Array> {
    const data = zipData instanceof Buffer ? new Uint8Array(zipData) : zipData;
    return fflate.unzipSync(data);
}

/**
 * Create a ZIP buffer from an object of files
 * @param files - Object with file paths as keys and content as values
 * @param options - Compression options
 * @returns ZIP content as Uint8Array
 */
export function zipSync(files: Record<string, Uint8Array | string>, options: { level?: number } = {}): Uint8Array {
    const level = options.level ?? 6;
    const zippable: fflate.Zippable = {};

    for (const [path, content] of Object.entries(files)) {
        const data = typeof content === 'string' ? new TextEncoder().encode(content) : content;
        zippable[path] = [data, { level }];
    }

    return fflate.zipSync(zippable);
}

/**
 * Async version of unzip for large files
 * @param zipData - ZIP file as Buffer or Uint8Array
 * @returns Promise with object of files
 */
export function unzip(zipData: Buffer | Uint8Array): Promise<Record<string, Uint8Array>> {
    return new Promise((resolve, reject) => {
        const data = zipData instanceof Buffer ? new Uint8Array(zipData) : zipData;
        fflate.unzip(data, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

/**
 * Async version of zip for large files
 * @param files - Object with file paths as keys and content as values
 * @param options - Compression options
 * @returns Promise with ZIP content as Uint8Array
 */
export function zip(files: Record<string, Uint8Array | string>, options: { level?: number } = {}): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const level = options.level ?? 6;
        const zippable: fflate.Zippable = {};

        for (const [path, content] of Object.entries(files)) {
            const data = typeof content === 'string' ? new TextEncoder().encode(content) : content;
            zippable[path] = [data, { level }];
        }

        fflate.zip(zippable, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

/**
 * List files in a ZIP archive
 * @param zipData - ZIP file as Buffer or Uint8Array
 * @returns Array of file paths (excluding directories)
 */
export function listZipContents(zipData: Buffer | Uint8Array): string[] {
    const unzipped = unzipSync(zipData);
    // fflate doesn't include directories in the result, so we just return all keys
    return Object.keys(unzipped);
}

/**
 * Read a single file from a ZIP archive
 * @param zipData - ZIP file as Buffer or Uint8Array
 * @param fileName - Path of file to read
 * @returns File content as Uint8Array, or null if not found
 */
export function readFileFromZip(zipData: Buffer | Uint8Array, fileName: string): Uint8Array | null {
    const unzipped = unzipSync(zipData);
    return unzipped[fileName] ?? null;
}

/**
 * Check if a file exists in a ZIP archive
 * @param zipData - ZIP file as Buffer or Uint8Array
 * @param fileName - Path of file to check
 * @returns True if file exists
 */
export function fileExistsInZip(zipData: Buffer | Uint8Array, fileName: string): boolean {
    const unzipped = unzipSync(zipData);
    return fileName in unzipped;
}
