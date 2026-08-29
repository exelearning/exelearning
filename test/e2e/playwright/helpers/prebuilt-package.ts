/**
 * Serve a package that was exported by a DIFFERENT build.
 *
 * `buildHtml5Package()` exports in-process, so it can only ever produce what the
 * checkout it runs in produces. A producer axis — "does core main's export behave
 * differently from core #2209's under the same host?" — needs packages built by each
 * revision and then served unchanged. This loads such a zip into the same
 * `BuiltPackage` shape the serving model already consumes, so nothing downstream has to
 * know where the bytes came from.
 *
 * The serve-time iDevice patch is applied here exactly as the plugin applies it, for the
 * same reason: it is part of the serving model, not of the export.
 */
import * as fs from 'fs';
import * as path from 'path';
import { unzipSync } from '../../../../src/shared/export';
import { applyIdevicePatch, ideviceNodeIds, sha256Hex, type BuiltPackage } from './moodle-serving-model';

/**
 * Load an exported HTML5 zip from disk as a servable package.
 *
 * @param zipPath absolute path to the zip an exporter produced
 * @returns the package in the shape `installMoodleServing()` expects
 */
export function loadHtml5PackageFromZip(zipPath: string): BuiltPackage {
    const zipBytes = new Uint8Array(fs.readFileSync(zipPath));
    const raw = unzipSync(zipBytes) as unknown as Record<string, Uint8Array>;

    const files: Record<string, Uint8Array> = {};
    const patchedFiles: string[] = [];
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    for (const [key, bytes] of Object.entries(raw)) {
        if (key.endsWith('/')) continue;
        if (key.endsWith('.js')) {
            const { source, applied } = applyIdevicePatch(key, decoder.decode(bytes));
            if (applied > 0) {
                files[key] = encoder.encode(source);
                patchedFiles.push(key);
                continue;
            }
        }
        files[key] = bytes;
    }

    // Navigation order: index.html first, then html/* in the order the exporter wrote
    // them. Zip entry order is the export order, so it is preserved rather than sorted.
    const pageKeys = Object.keys(files).filter(
        key => key === 'index.html' || (key.startsWith('html/') && key.endsWith('.html')),
    );
    pageKeys.sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : 0));

    const pages = pageKeys.map((url, index) => ({
        index,
        url,
        ideviceNodes: ideviceNodeIds(decoder.decode(files[url])),
    }));

    const indexHtml = decoder.decode(files['index.html'] ?? new Uint8Array());
    const cfgMatch = /window\.exeXapi=(\{.*?\});/.exec(indexHtml);

    return {
        files,
        zipSha256: sha256Hex(zipBytes),
        pages,
        xapiConfig: cfgMatch ? (JSON.parse(cfgMatch[1]) as Record<string, unknown>) : {},
        patchedFiles,
    };
}

/** Resolve the exported zip for one scenario and producer in the audit package store. */
export function auditPackagePath(root: string, producer: string, scenario: string, format: string): string {
    return path.join(root, 'packages', producer, `${scenario}-${producer}-${format}.zip`);
}
