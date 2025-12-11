/**
 * BrowserResourceProvider
 *
 * Adapts ResourceFetcher (browser) to the unified ResourceProvider interface.
 * Fetches theme files, iDevice resources, and libraries via HTTP for browser exports.
 *
 * Usage:
 * ```typescript
 * import { BrowserResourceProvider } from './adapters/BrowserResourceProvider';
 *
 * const resourceFetcher = new ResourceFetcher();
 * const provider = new BrowserResourceProvider(resourceFetcher);
 * const themeFiles = await provider.fetchTheme('base');
 * ```
 */

import type { ResourceProvider } from '../interfaces';

/**
 * Interface for ResourceFetcher (browser class)
 */
interface ResourceFetcherInterface {
    fetchTheme(themeName: string): Promise<Map<string, Blob>>;
    fetchIdevice(ideviceType: string): Promise<Map<string, Blob>>;
    fetchBaseLibraries(): Promise<Map<string, Blob>>;
    fetchScormFiles(): Promise<Map<string, Blob>>;
    fetchLibraryFiles(paths: string[]): Promise<Map<string, Blob>>;
    fetchLibraryDirectory(libraryName: string): Promise<Map<string, Blob>>;
    fetchSchemas(format: string): Promise<Map<string, Blob>>;
}

/**
 * BrowserResourceProvider class
 * Implements ResourceProvider interface for browser-based exports
 */
export class BrowserResourceProvider implements ResourceProvider {
    private fetcher: ResourceFetcherInterface;

    /**
     * Create provider with ResourceFetcher instance
     * @param fetcher - ResourceFetcher instance
     */
    constructor(fetcher: ResourceFetcherInterface) {
        this.fetcher = fetcher;
    }

    /**
     * Fetch theme files
     * @param themeName - Theme name (e.g., 'base', 'blue')
     * @returns Map of path -> content
     */
    async fetchTheme(themeName: string): Promise<Map<string, Buffer>> {
        const blobMap = await this.fetcher.fetchTheme(themeName);
        return this.convertBlobMapToBufferMap(blobMap);
    }

    /**
     * Fetch iDevice resources
     * @param ideviceType - iDevice type name
     * @returns Map of path -> content
     */
    async fetchIdeviceResources(
        ideviceType: string
    ): Promise<Map<string, Buffer>> {
        const blobMap = await this.fetcher.fetchIdevice(ideviceType);
        return this.convertBlobMapToBufferMap(blobMap);
    }

    /**
     * Fetch base libraries (jQuery, common.js, etc.)
     * @returns Map of path -> content
     */
    async fetchBaseLibraries(): Promise<Map<string, Buffer>> {
        const blobMap = await this.fetcher.fetchBaseLibraries();
        return this.convertBlobMapToBufferMap(blobMap);
    }

    /**
     * Fetch SCORM-specific files
     * @returns Map of path -> content
     */
    async fetchScormFiles(): Promise<Map<string, Buffer>> {
        const blobMap = await this.fetcher.fetchScormFiles();
        return this.convertBlobMapToBufferMap(blobMap);
    }

    /**
     * Fetch specific library files by path
     * @param files - Array of file paths
     * @returns Map of path -> content
     */
    async fetchLibraryFiles(files: string[]): Promise<Map<string, Buffer>> {
        const blobMap = await this.fetcher.fetchLibraryFiles(files);
        return this.convertBlobMapToBufferMap(blobMap);
    }

    /**
     * Fetch all files in a library directory
     * @param libraryName - Library name (e.g., 'exe_effects')
     * @returns Map of path -> content
     */
    async fetchLibraryDirectory(
        libraryName: string
    ): Promise<Map<string, Buffer>> {
        const blobMap = await this.fetcher.fetchLibraryDirectory(libraryName);
        return this.convertBlobMapToBufferMap(blobMap);
    }

    /**
     * Fetch schema files for a format
     * @param format - Format name (scorm12, scorm2004, ims, epub3)
     * @returns Map of path -> content
     */
    async fetchSchemas(format: string): Promise<Map<string, Buffer>> {
        const blobMap = await this.fetcher.fetchSchemas(format);
        return this.convertBlobMapToBufferMap(blobMap);
    }

    /**
     * Normalize iDevice type name to directory name
     * @param ideviceType - Raw iDevice type name (e.g., 'FreeTextIdevice')
     * @returns Normalized directory name (e.g., 'text')
     */
    normalizeIdeviceType(ideviceType: string): string {
        // Map common type names to directory names
        const typeMap: Record<string, string> = {
            freetextidevice: 'text',
            textidevice: 'text',
            freetext: 'text',
        };
        const normalized = ideviceType.toLowerCase().replace(/idevice$/i, '');
        return (
            typeMap[normalized] ||
            typeMap[ideviceType.toLowerCase()] ||
            normalized ||
            'text'
        );
    }

    /**
     * Convert Map<string, Blob> to Map<string, Buffer>
     * In browser, we convert Blob to ArrayBuffer then to Buffer-like Uint8Array
     * @param blobMap - Map of path -> Blob
     * @returns Map of path -> Buffer
     */
    private async convertBlobMapToBufferMap(
        blobMap: Map<string, Blob>
    ): Promise<Map<string, Buffer>> {
        const result = new Map<string, Buffer>();

        const entries = Array.from(blobMap.entries());
        const conversions = entries.map(async ([path, blob]) => {
            const arrayBuffer = await blob.arrayBuffer();
            // In browser, use Uint8Array which is Buffer-compatible
            const buffer = Buffer.from(arrayBuffer);
            return { path, buffer };
        });

        const converted = await Promise.all(conversions);
        for (const { path, buffer } of converted) {
            result.set(path, buffer);
        }

        return result;
    }
}
