import { strToU8, zipSync } from 'fflate';
import type { AssetProvider, ExportAsset, ZipArchive, ZipProvider } from '../../src/shared/export/interfaces';

/** Collects the files an exporter writes and zips them for real with fflate. */
export class MockZipProvider implements ZipProvider {
    createZip(): ZipArchive {
        throw new Error('createZip is not used by the exporters under test');
    }

    files = new Map<string, string | Uint8Array>();

    addFile(path: string, content: string | Buffer): void {
        this.files.set(path, content);
    }

    hasFile(path: string): boolean {
        return this.files.has(path);
    }

    getFilePaths(): string[] {
        return Array.from(this.files.keys());
    }

    async generateAsync(): Promise<Buffer> {
        // Create actual ZIP for realistic testing using fflate
        const zipData: Record<string, Uint8Array> = {};
        for (const [path, content] of this.files) {
            if (typeof content === 'string') {
                zipData[path] = strToU8(content);
            } else {
                zipData[path] = new Uint8Array(content);
            }
        }
        const zipped = zipSync(zipData);
        return Buffer.from(zipped);
    }
}

/** A project without assets. */
export class MockAssetProvider implements AssetProvider {
    async getAsset(_path: string): Promise<ExportAsset | null> {
        return null;
    }

    async getAllAssets(): Promise<ExportAsset[]> {
        return [];
    }

    async getProjectAssets(): Promise<ExportAsset[]> {
        return this.getAllAssets();
    }
}
