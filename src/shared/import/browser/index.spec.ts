/**
 * Tests for the browser import adapter's runtime-policy handling (#2193).
 *
 * The adapter is the boundary between the environment-agnostic core importer
 * and the frontend, which knows the runtime. It must:
 *  - inspect the archive before inflating anything,
 *  - reject archives over the resolved hard limit with a structured error,
 *  - ask for confirmation only for entries in the controlled large range,
 *  - never mutate project state (or run the beforeImport hook) on rejection or
 *    cancellation,
 *  - apply the injected limits fresh on every call (no stale cached policy).
 */
import { describe, it, expect } from 'bun:test';
import * as Y from 'yjs';

import { createBrowserImporter } from './index';
import { ZipLimitError, ImportCancelledError } from '../importPolicy';

const MiB = 1024 * 1024;
const minimalContentXml = '<?xml version="1.0" encoding="UTF-8"?><odeProperties></odeProperties>';

async function buildElpx(payloadBytes: number, entryName = 'content/resources/video.mp4'): Promise<Uint8Array> {
    const fflate = await import('fflate');
    return fflate.zipSync(
        {
            'content.xml': new TextEncoder().encode(minimalContentXml),
            [entryName]: new Uint8Array(payloadBytes),
        },
        { level: 6 },
    );
}

function makeFile(bytes: Uint8Array): File {
    return new File([bytes], 'project.elpx');
}

function makeManager(): { manager: { getDoc: () => Y.Doc; projectId: string }; ydoc: Y.Doc } {
    const ydoc = new Y.Doc();
    return { manager: { getDoc: () => ydoc, projectId: 'test' }, ydoc };
}

describe('BrowserElpxImporter runtime policy', () => {
    it('rejects an entry over the resolved hard limit with a structured error and no mutation', async () => {
        const zip = await buildElpx(2 * MiB);
        const { manager, ydoc } = makeManager();
        const importer = createBrowserImporter(manager, null);

        let beforeImportRan = false;
        let caught: ZipLimitError | null = null;
        try {
            await importer.importFromFile(makeFile(zip), {
                zipLimits: { maxEntryBytes: 1 * MiB },
                beforeImport: () => {
                    beforeImportRan = true;
                },
            });
        } catch (err) {
            caught = err as ZipLimitError;
        }

        expect(caught).toBeInstanceOf(ZipLimitError);
        expect(caught?.details.kind).toBe('entry-size');
        expect(caught?.details.entryName).toBe('content/resources/video.mp4');
        expect(beforeImportRan).toBe(false);
        expect(ydoc.getArray('navigation').length).toBe(0);
        ydoc.destroy();
    });

    it('asks for confirmation for an entry in the controlled range, then imports on accept', async () => {
        const zip = await buildElpx(2 * MiB);
        const { manager, ydoc } = makeManager();
        const importer = createBrowserImporter(manager, null);

        let confirmInfo: { entryName: string; entryBytes: number } | null = null;
        let beforeImportRan = false;
        const result = await importer.importFromFile(makeFile(zip), {
            zipLimits: { maxEntryBytes: 4 * MiB, maxTotalBytes: 8 * MiB },
            confirmEntryThreshold: 1 * MiB,
            onConfirmLargeEntry: info => {
                confirmInfo = info;
                return true;
            },
            beforeImport: () => {
                beforeImportRan = true;
            },
        });

        expect(confirmInfo).not.toBeNull();
        expect(confirmInfo?.entryName).toBe('content/resources/video.mp4');
        expect(confirmInfo?.entryBytes).toBe(2 * MiB);
        expect(beforeImportRan).toBe(true);
        expect(result).toBeDefined();
        ydoc.destroy();
    });

    it('cancelling the confirmation aborts without importing or running beforeImport', async () => {
        const zip = await buildElpx(2 * MiB);
        const { manager, ydoc } = makeManager();
        const importer = createBrowserImporter(manager, null);

        let beforeImportRan = false;
        let caught: unknown = null;
        try {
            await importer.importFromFile(makeFile(zip), {
                zipLimits: { maxEntryBytes: 4 * MiB, maxTotalBytes: 8 * MiB },
                confirmEntryThreshold: 1 * MiB,
                onConfirmLargeEntry: () => false,
                beforeImport: () => {
                    beforeImportRan = true;
                },
            });
        } catch (err) {
            caught = err;
        }

        expect(caught).toBeInstanceOf(ImportCancelledError);
        expect(beforeImportRan).toBe(false);
        expect(ydoc.getArray('navigation').length).toBe(0);
        ydoc.destroy();
    });

    it('does not ask for confirmation when no entry exceeds the threshold', async () => {
        const zip = await buildElpx(1024);
        const { manager, ydoc } = makeManager();
        const importer = createBrowserImporter(manager, null);

        let confirmCalls = 0;
        await importer.importFromFile(makeFile(zip), {
            zipLimits: { maxEntryBytes: 4 * MiB, maxTotalBytes: 8 * MiB },
            confirmEntryThreshold: 1 * MiB,
            onConfirmLargeEntry: () => {
                confirmCalls += 1;
                return true;
            },
        });

        expect(confirmCalls).toBe(0);
        ydoc.destroy();
    });

    it('clears IndexedDB (debug option) only after the gate passes', async () => {
        const zip = await buildElpx(1024);
        const { manager, ydoc } = makeManager();
        // A minimal AssetManager-like so buildImporter can construct a handler.
        const assetManager = {
            init: async () => {},
            extractAssetsFromZip: async () => new Map<string, string>(),
            convertContextPathToAssetRefs: (html: string) => html,
            preloadAllAssets: async () => 0,
        };
        const importer = createBrowserImporter(manager, assetManager);

        let deletedDb = '';
        const originalIndexedDB = (globalThis as { indexedDB?: unknown }).indexedDB;
        (globalThis as { indexedDB?: unknown }).indexedDB = {
            deleteDatabase: (name: string) => {
                deletedDb = name;
                const req: { onsuccess?: () => void; onerror?: () => void; onblocked?: () => void } = {};
                queueMicrotask(() => req.onsuccess?.());
                return req;
            },
        };

        try {
            await importer.importFromFile(makeFile(zip), {
                clearIndexedDB: true,
                zipLimits: { maxEntryBytes: 4 * MiB, maxTotalBytes: 8 * MiB },
            });
        } finally {
            (globalThis as { indexedDB?: unknown }).indexedDB = originalIndexedDB;
        }

        expect(deletedDb).toBe('exelearning-project-test');
        ydoc.destroy();
    });

    it('applies the injected policy fresh on every call (no stale cached limits)', async () => {
        const zip = await buildElpx(2 * MiB);
        const { manager, ydoc } = makeManager();
        const importer = createBrowserImporter(manager, null);

        // First call: desktop-style policy accepts the 2 MiB entry (no confirm).
        await importer.importFromFile(makeFile(zip), {
            zipLimits: { maxEntryBytes: 4 * MiB, maxTotalBytes: 8 * MiB },
        });

        // Second call on the SAME adapter: conservative policy must reject it,
        // proving the first (larger) policy was not retained.
        await expect(
            importer.importFromFile(makeFile(zip), {
                zipLimits: { maxEntryBytes: 1 * MiB },
            }),
        ).rejects.toBeInstanceOf(ZipLimitError);
        ydoc.destroy();
    });
});

describe('browser importer global registration', () => {
    it('exposes the importer, legacy handlers and runtime policy to the browser', async () => {
        const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
        const browser: Record<string, any> = { Logger: { log() {}, warn() {}, error() {} } };
        Object.defineProperty(globalThis, 'window', { value: browser, configurable: true, writable: true });
        const { manager, ydoc } = makeManager();
        try {
            const entry = './index.ts?browser-registration-coverage';
            const exports = await import(entry);
            expect(browser.ElpxImporter).toBe(exports.BrowserElpxImporter);
            expect(browser.SharedImporters.createBrowserImporter).toBe(browser.createBrowserImporter);
            expect(browser.SharedImporters.LegacyHandlerRegistry).toBe(browser.LegacyHandlerRegistry);
            expect(browser.SharedImporters.importPolicy).toBe(browser.ExeImportPolicy);
            expect(browser.SharedImporters.MultichoiceHandler).toBe(exports.MultichoiceHandler);
            expect(browser.SharedImporters.GeogebraHandler).toBe(exports.GeogebraHandler);
            expect(browser.ExeImportPolicy.CONSERVATIVE_ZIP_LIMITS.maxEntryBytes).toBeGreaterThan(0);
            const importer = browser.createBrowserImporter(manager);
            const result = await importer.importFromFile(makeFile(await buildElpx(16)));
            expect(result).toBeDefined();
        } finally {
            ydoc.destroy();
            if (original) Object.defineProperty(globalThis, 'window', original);
            else Reflect.deleteProperty(globalThis, 'window');
        }
    });
});
