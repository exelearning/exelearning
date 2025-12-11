/**
 * ArchiverZipProvider
 *
 * ZIP provider implementation using the Archiver library for server-side use.
 * Creates ZIP archives in memory and returns them as Buffer.
 */

import archiver from 'archiver';
import type { ZipProvider } from '../interfaces';

export class ArchiverZipProvider implements ZipProvider {
    private files: Map<string, string | Buffer> = new Map();

    /**
     * Add a file to the ZIP archive
     */
    addFile(path: string, content: string | Buffer | Uint8Array): void {
        // Convert Uint8Array to Buffer if needed
        const data = content instanceof Uint8Array && !(content instanceof Buffer) ? Buffer.from(content) : content;
        this.files.set(path, data);
    }

    /**
     * Generate the ZIP archive and return as Buffer
     */
    async generateAsync(): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const archive = archiver('zip', {
                zlib: { level: 9 }, // Maximum compression
            });

            const chunks: Buffer[] = [];

            archive.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });

            archive.on('end', () => {
                resolve(Buffer.concat(chunks));
            });

            archive.on('error', (err: Error) => {
                reject(err);
            });

            // Add all files to the archive
            for (const [path, content] of this.files) {
                if (typeof content === 'string') {
                    archive.append(content, { name: path });
                } else {
                    archive.append(content, { name: path });
                }
            }

            // Finalize the archive
            archive.finalize();
        });
    }

    /**
     * Reset the provider for reuse
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
     * Get file content (for testing)
     */
    getFile(path: string): string | Buffer | undefined {
        return this.files.get(path);
    }
}
