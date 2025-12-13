/**
 * JSZipZipProvider
 *
 * ZipProvider implementation using JSZip for browser-based ZIP creation.
 * This is the browser equivalent of ArchiverZipProvider.
 *
 * Usage:
 * ```typescript
 * import { JSZipZipProvider } from './providers/JSZipZipProvider';
 *
 * const zip = new JSZipZipProvider();
 * zip.addFile('index.html', '<html>...</html>');
 * zip.addFile('images/logo.png', imageBuffer);
 * const buffer = await zip.generateAsync();
 * ```
 */

import type { ZipProvider } from '../interfaces';

// JSZip type (loaded globally in browser via script tag)
interface JSZipInstance {
    file(path: string, data: string | Uint8Array | ArrayBuffer | Blob, options?: { binary?: boolean }): JSZipInstance;
    generateAsync(options: {
        type: string;
        compression?: string;
        compressionOptions?: { level: number };
    }): Promise<ArrayBuffer | Uint8Array | Blob>;
}

interface JSZipConstructor {
    new (): JSZipInstance;
}

// Get JSZip from global (browser) or require (Node.js for testing)
declare const JSZip: JSZipConstructor; // eslint-disable-line @typescript-eslint/no-unused-vars

/**
 * JSZipZipProvider class
 * Implements ZipProvider interface using JSZip
 */
export class JSZipZipProvider implements ZipProvider {
    private zip: JSZipInstance;
    private files: Map<string, string | Uint8Array> = new Map();

    constructor() {
        // Get JSZip from global or dynamic import
        const JSZipClass =
            typeof window !== 'undefined' ? (window as unknown as { JSZip: JSZipConstructor }).JSZip : require('jszip');

        if (!JSZipClass) {
            throw new Error('JSZip not available. Ensure jszip.min.js is loaded.');
        }

        this.zip = new JSZipClass();
    }

    /**
     * Add a file to the ZIP archive
     * @param path - File path within the ZIP
     * @param content - File content (string or Uint8Array)
     */
    addFile(path: string, content: string | Uint8Array): void {
        this.files.set(path, content);

        if (typeof content === 'string') {
            this.zip.file(path, content);
        } else {
            // Binary content
            this.zip.file(path, content, { binary: true });
        }
    }

    /**
     * Check if a file exists in the archive
     * @param path - File path
     * @returns true if file exists
     */
    hasFile(path: string): boolean {
        return this.files.has(path);
    }

    /**
     * Get a file's content from the archive
     * @param path - File path
     * @returns File content or undefined
     */
    getFile(path: string): string | Uint8Array | undefined {
        return this.files.get(path);
    }

    /**
     * Get number of files in the archive
     * @returns File count
     */
    getFileCount(): number {
        return this.files.size;
    }

    /**
     * Reset the archive (clear all files)
     */
    reset(): void {
        this.files.clear();
        // Create new JSZip instance
        const JSZipClass =
            typeof window !== 'undefined' ? (window as unknown as { JSZip: JSZipConstructor }).JSZip : require('jszip');
        this.zip = new JSZipClass();
    }

    /**
     * Generate the ZIP file as a Uint8Array
     * @returns Promise resolving to ZIP buffer
     */
    async generateAsync(): Promise<Uint8Array> {
        const arrayBuffer = (await this.zip.generateAsync({
            type: 'arraybuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 },
        })) as ArrayBuffer;

        return new Uint8Array(arrayBuffer);
    }

    /**
     * Generate the ZIP file as a Blob (browser-friendly)
     * @returns Promise resolving to Blob
     */
    async generateAsBlob(): Promise<Blob> {
        return (await this.zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 },
        })) as Blob;
    }

    /**
     * Generate the ZIP and trigger a download in the browser
     * @param filename - Download filename
     */
    async downloadAs(filename: string): Promise<void> {
        const blob = await this.generateAsBlob();

        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}
