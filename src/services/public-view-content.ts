/**
 * Public read-only viewer content service.
 *
 * Builds the multi-page HTML5 export for a publicly shared project and serves its
 * individual files so they can be rendered inside an opaque-origin sandboxed
 * iframe (see {@link ../shared/security/publicViewSandbox}). The export is built
 * once and cached in memory keyed by the project's persisted Yjs document
 * version, so editing the project naturally invalidates the cache.
 *
 * The cache key intentionally does NOT use `projects.updated_at`: Yjs
 * persistence (full-state replace, incremental updates, snapshot upsert) writes
 * only to the `yjs_*` tables and never bumps `projects.updated_at`, so an edit
 * would otherwise serve a stale public view. The Yjs document version
 * ({@link getDocumentVersion}) increments on every persisted edit.
 *
 * `buildHtml5PreviewExport` lives here (rather than in the API route module) so
 * it is the single source of truth shared by the public viewer and the external
 * export API.
 */
import * as path from 'path';
import { unzipSync } from 'fflate';
import type { Project } from '../db/types';
import { db } from '../db/client';
import { getDocumentVersion } from '../db/queries';
import { reconstructDocument } from '../websocket/yjs-persistence';
import { getFilesDir } from './file-helper';
import { getMimeType } from '../utils/mime-types';
import {
    Html5Exporter,
    ServerYjsDocumentWrapper,
    YjsDocumentAdapter,
    CombinedAssetProvider,
    FileSystemAssetProvider,
    DatabaseAssetProvider,
    FileSystemResourceProvider,
    FflateZipProvider,
    ServerLatexPreRenderer,
} from '../shared/export';

export interface ExportResult {
    success: boolean;
    data?: Uint8Array;
    error?: string;
}

export interface PublicViewFile {
    content: Uint8Array;
    contentType: string;
}

type ExportBuilder = (project: Project) => Promise<ExportResult>;

/** Resolves the persisted Yjs document version used to key the export cache. */
type VersionResolver = (project: Project) => Promise<string>;

/**
 * Build an HTML5 preview export (multi-page) for a project as a ZIP.
 *
 * It works purely from the project record: the internal UUID is only used
 * server-side to locate Yjs data and assets, and is never returned to the
 * caller.
 */
export async function buildHtml5PreviewExport(project: Project): Promise<ExportResult> {
    // Load the Yjs document
    const ydoc = await reconstructDocument(project.id);

    // Create document adapter
    const wrapper = new ServerYjsDocumentWrapper(ydoc, project.uuid);
    const documentAdapter = new YjsDocumentAdapter(wrapper);

    // Create asset providers
    const filesDir = getFilesDir();
    const assetsPath = path.join(filesDir, 'assets', project.uuid);
    const fsAssetProvider = new FileSystemAssetProvider(assetsPath);
    const dbAssetProvider = new DatabaseAssetProvider(db, project.id);
    const assetProvider = new CombinedAssetProvider([fsAssetProvider, dbAssetProvider]);

    // Create resource provider
    const resourceProvider = new FileSystemResourceProvider(path.join(process.cwd(), 'public'));

    // Create ZIP provider
    const zipProvider = new FflateZipProvider();

    // Create the HTML5 exporter for preview
    const exporter = new Html5Exporter(documentAdapter, resourceProvider, assetProvider, zipProvider, {
        singlePage: false,
    });

    // Run the export with server-side LaTeX pre-render hooks.
    const latexRenderer = new ServerLatexPreRenderer();
    return exporter.export({
        preRenderLatex: async (html: string) => latexRenderer.preRender(html),
        preRenderDataGameLatex: async (html: string) => latexRenderer.preRenderDataGameLatex(html),
    });
}

// ============================================================================
// In-memory cache of unzipped exports (keyed by public view id)
// ============================================================================

interface CacheEntry {
    key: string;
    files: Map<string, Uint8Array>;
}

/** Max number of distinct public projects kept unzipped in memory at once. */
const MAX_CACHE_ENTRIES = 32;

/** Upper bounds on a single export kept in memory (cost / DoS protection). */
const MAX_EXPORT_BYTES = 100 * 1024 * 1024; // 100 MB total unzipped
const MAX_EXPORT_FILES = 5000;

const cache = new Map<string, CacheEntry>();

// Deduplicate concurrent builds: while an export for a given cache key is being
// built, parallel requests await the same promise instead of each rebuilding it
// (a full reconstructDocument + export is expensive).
const inFlight = new Map<string, Promise<Map<string, Uint8Array> | null>>();

/**
 * Default version resolver: the effective persisted Yjs document version.
 *
 * Keying the cache on this (rather than `projects.updated_at`) ensures the
 * public export is rebuilt whenever the document content actually changes, since
 * Yjs persistence does not touch `projects.updated_at`.
 */
const defaultResolveVersion: VersionResolver = project => getDocumentVersion(db, project.id);

// Dependency injection for tests: the export builder and version resolver can be
// swapped so unit tests do not run the full exporter pipeline or hit the DB.
let buildExport: ExportBuilder = buildHtml5PreviewExport;
let resolveVersion: VersionResolver = defaultResolveVersion;

export function configurePublicViewContent(deps: {
    buildExport?: ExportBuilder;
    resolveVersion?: VersionResolver;
}): void {
    if (deps.buildExport) buildExport = deps.buildExport;
    if (deps.resolveVersion) resolveVersion = deps.resolveVersion;
}

export function resetPublicViewContent(): void {
    buildExport = buildHtml5PreviewExport;
    resolveVersion = defaultResolveVersion;
    cache.clear();
    inFlight.clear();
}

async function cacheKeyFor(project: Project): Promise<string> {
    const version = await resolveVersion(project);
    return `${project.public_view_id ?? ''}:${version}`;
}

/**
 * Normalize a requested relative path against the export root.
 *
 * Returns a safe, root-relative POSIX path, or `null` if the request escapes the
 * export root (path traversal) or is otherwise invalid.
 */
export function normalizePublicViewPath(relPath: string): string | null {
    let p = (relPath ?? '').split('?')[0].split('#')[0];
    try {
        p = decodeURIComponent(p);
    } catch {
        return null;
    }
    // Backslashes are not path separators in the export; treat them as literal,
    // but a NUL byte is always invalid.
    if (p.includes('\0')) return null;
    p = p.replace(/^\/+/, '');
    if (p === '') p = 'index.html';
    const norm = path.posix.normalize(p);
    if (norm === '..' || norm.startsWith('../') || norm.startsWith('/') || path.posix.isAbsolute(norm)) {
        return null;
    }
    return norm;
}

/**
 * Build and unzip a project's export into a path→bytes map.
 *
 * Throws if the unzipped export exceeds the size/file-count bounds (cost / DoS
 * protection); returns `null` if the export could not be built.
 */
async function buildFiles(project: Project): Promise<Map<string, Uint8Array> | null> {
    const result = await buildExport(project);
    if (!result.success || !result.data) {
        return null;
    }

    const unzipped = unzipSync(result.data);
    const files = new Map<string, Uint8Array>();
    let totalBytes = 0;
    for (const [entryPath, data] of Object.entries(unzipped)) {
        // Skip directory entries
        if (entryPath.endsWith('/')) continue;
        totalBytes += data.length;
        if (files.size + 1 > MAX_EXPORT_FILES || totalBytes > MAX_EXPORT_BYTES) {
            throw new Error(
                `Public export too large (> ${MAX_EXPORT_FILES} files or ${MAX_EXPORT_BYTES} bytes): ${project.public_view_id}`,
            );
        }
        files.set(entryPath, data);
    }
    return files;
}

async function getFiles(project: Project): Promise<Map<string, Uint8Array> | null> {
    const id = project.public_view_id ?? '';
    const key = await cacheKeyFor(project);
    const cached = cache.get(id);
    if (cached && cached.key === key) {
        return cached.files;
    }

    // Coalesce concurrent builds for the same key onto a single promise.
    const pending = inFlight.get(key);
    if (pending) return pending;

    const build = (async () => {
        const files = await buildFiles(project);
        if (files) {
            // Evict the oldest entry if we are adding a brand new project and the
            // cache is full (entries for the same project are replaced in place).
            if (!cache.has(id) && cache.size >= MAX_CACHE_ENTRIES) {
                const oldest = cache.keys().next().value;
                if (oldest !== undefined) cache.delete(oldest);
            }
            cache.set(id, { key, files });
        }
        return files;
    })();

    inFlight.set(key, build);
    try {
        return await build;
    } finally {
        inFlight.delete(key);
    }
}

function contentTypeFor(relPath: string): string {
    const ext = path.posix.extname(relPath).toLowerCase();
    let contentType = getMimeType(ext);
    const isTextual =
        contentType.startsWith('text/') ||
        ext === '.js' ||
        ext === '.mjs' ||
        ext === '.json' ||
        ext === '.svg' ||
        ext === '.xml';
    if (isTextual && !contentType.includes('charset')) {
        contentType += '; charset=utf-8';
    }
    return contentType;
}

/**
 * Resolve a single file from a project's public HTML5 export.
 *
 * @returns the file bytes and content type, or `null` if the path is unsafe, the
 * export could not be built, or the file does not exist.
 */
export async function getPublicViewFile(project: Project, relPath: string): Promise<PublicViewFile | null> {
    const norm = normalizePublicViewPath(relPath);
    if (norm === null) return null;

    const files = await getFiles(project);
    if (!files) return null;

    const data = files.get(norm);
    if (!data) return null;

    return { content: data, contentType: contentTypeFor(norm) };
}
