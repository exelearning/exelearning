/**
 * Transport-agnostic core of preview serving contract v2.
 *
 * Both HTTP adapters — the Elysia routes (`src/routes/preview-session.ts`) and
 * the Electron `app://` handler (`src/services/electron-preview-handler.ts`) —
 * delegate here so the protocol semantics (upload validation, two-stage byte
 * budgets, tiered response headers, ETag/Range handling) exist exactly once
 * and cannot drift between the two.
 *
 * Everything below operates on WHATWG `Request`/`Response` primitives and the
 * shared session manager; there is no framework import.
 */
import { previewCspHeader, previewPermissionsPolicy } from '../shared/security/previewSandbox';
import * as previewFixedResources from './preview-fixed-resources';
import type * as previewSessionManager from './preview-session-manager';
import type { FixedResourceResolver, PreviewSession } from './preview-session-manager';

/** Contract protocol version advertised by create-session. */
export const PROTOCOL_VERSION = 2;

/**
 * Advertised upper bound for one upload request. Bun's default request-body
 * cap is 128 MiB and oversized bodies die at the transport layer (connection
 * error, not a clean 413), so clients must batch uploads below it.
 */
export const RECOMMENDED_BATCH_BYTES = 64 * 1024 * 1024;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PreviewSessionManager = typeof previewSessionManager;

export interface PreviewServingDeps {
    manager: PreviewSessionManager;
    fixedResources: FixedResourceResolver;
}

/** The default fixed-resource resolver is the manifest-gated service module. */
export function defaultFixedResources(): FixedResourceResolver {
    return previewFixedResources;
}

/** Adapter-level handler result: an HTTP status plus its JSON body. */
export interface HandlerResult {
    status: number;
    body: unknown;
}

// =============================================================================
// Management API bodies
// =============================================================================

/** 201 body for POST /api/preview-session. */
export function createSessionResponse(manager: PreviewSessionManager, ownerUserId: number): HandlerResult {
    const { previewId } = manager.createSession(ownerUserId);
    const limits = manager.getLimits();
    return {
        status: 201,
        body: {
            previewId,
            protocolVersion: PROTOCOL_VERSION,
            revision: 0,
            limits: {
                maxFilesPerSession: limits.maxFilesPerSession,
                maxBytesPerSession: limits.maxBytesPerSession,
                maxAssetBytes: limits.maxAssetBytes,
                recommendedBatchBytes: RECOMMENDED_BATCH_BYTES,
            },
        },
    };
}

/**
 * Parse a multipart field that carries JSON. The field is sent as a JSON
 * string, but multipart parsers may deliver it pre-parsed — accept both (same
 * duck-typing as the `metadata` field in upload-session.ts).
 */
function parseJsonField(raw: unknown): { ok: true; value: unknown } | { ok: false } {
    if (typeof raw !== 'string') return { ok: true, value: raw };
    try {
        return { ok: true, value: JSON.parse(raw) };
    } catch {
        return { ok: false };
    }
}

function error(status: number, message: string): HandlerResult {
    return { status, body: { success: false, error: message } };
}

/**
 * POST /api/preview-session/:id/assets — `assets` JSON `[{ key, size }]`,
 * `files[]` index-aligned.
 *
 * The byte budget is enforced twice: on DECLARED sizes before buffering
 * anything and on ACTUAL bytes while buffering, so an under-reported size can
 * never amplify memory (two-stage pattern shared with upload-session.ts).
 * Per-entry validation (key shape, immutability, declared-vs-actual mismatch,
 * per-asset cap) happens in `storeAssets`.
 */
export async function handleAssetsUpload(
    session: PreviewSession,
    rawAssetsField: unknown,
    files: Blob[],
    manager: PreviewSessionManager,
): Promise<HandlerResult> {
    const parsed = parseJsonField(rawAssetsField);
    if (!parsed.ok) return error(400, 'Invalid assets JSON');
    const entries = parsed.value;
    if (
        !Array.isArray(entries) ||
        entries.some(e => typeof e?.key !== 'string' || typeof e?.size !== 'number' || !Number.isFinite(e.size))
    ) {
        return error(400, 'assets must be an array of { key, size } entries');
    }
    if (files.length !== entries.length) {
        return error(400, 'assets and files must be index-aligned');
    }

    const limits = manager.getLimits();
    const remainingBudget = limits.maxBytesPerSession - manager.sessionBytes(session);
    // Budget only the bytes that will actually be stored: an entry whose key the
    // session already holds is immutable (storeAssets reports it alreadyStored and
    // charges nothing), so counting it here would spuriously 413 a re-sent batch.
    let declaredBytes = 0;
    for (const entry of entries) {
        if (session.assets.has(entry.key)) continue;
        declaredBytes += entry.size;
        if (declaredBytes > remainingBudget) {
            return error(413, 'Upload exceeds the preview session byte budget');
        }
    }

    const buffered: Uint8Array[] = [];
    let bufferedBytes = 0;
    for (let i = 0; i < files.length; i++) {
        const bytes = new Uint8Array(await files[i].arrayBuffer());
        if (!session.assets.has(entries[i].key)) bufferedBytes += bytes.length;
        if (bufferedBytes > remainingBudget) {
            return error(413, 'Upload exceeds the preview session byte budget');
        }
        buffered.push(bytes);
    }

    // A concurrent DELETE / TTL sweep may have removed the session while the
    // upload body was buffering; do not mutate global accounting for a dead one.
    if (!manager.isRegistered(session)) {
        return error(404, 'Preview session not found');
    }

    const result = manager.storeAssets(
        session,
        entries.map((entry: { key: string; size: number }, i: number) => ({
            key: entry.key,
            declaredSize: entry.size,
            bytes: buffered[i],
        })),
    );
    return { status: 200, body: result };
}

interface RevisionWire {
    baseRevision?: unknown;
    nextRevision?: unknown;
    writes?: unknown;
    deletes?: unknown;
    assetRefs?: unknown;
    fixedRefs?: unknown;
}

function isStringRecord(value: unknown): value is Record<string, string> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.values(value).every(v => typeof v === 'string')
    );
}

/**
 * POST /api/preview-session/:id/revisions — `revision` JSON meta, `files[]`
 * index-aligned with `meta.writes`. All bytes are buffered BEFORE
 * `applyRevision` runs, so the store's revision re-check and its single
 * synchronous publish block make the swap atomic under concurrent reads.
 */
export async function handleRevisionUpload(
    session: PreviewSession,
    rawRevisionField: unknown,
    files: Blob[],
    manager: PreviewSessionManager,
    fixedResources: FixedResourceResolver,
): Promise<HandlerResult> {
    const parsed = parseJsonField(rawRevisionField);
    if (!parsed.ok) return error(400, 'Invalid revision JSON');
    const meta = parsed.value as RevisionWire | null;
    if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
        return error(400, 'revision must be a JSON object');
    }
    if (!Number.isInteger(meta.baseRevision) || !Number.isInteger(meta.nextRevision)) {
        return error(400, 'baseRevision and nextRevision must be integers');
    }
    const writes = meta.writes ?? [];
    if (!Array.isArray(writes) || writes.some(w => typeof w !== 'string')) {
        return error(400, 'writes must be an array of paths');
    }
    const deletes = meta.deletes ?? [];
    if (!Array.isArray(deletes) || deletes.some(d => typeof d !== 'string')) {
        return error(400, 'deletes must be an array of paths');
    }
    const assetRefs = meta.assetRefs ?? {};
    const fixedRefs = meta.fixedRefs ?? {};
    if (!isStringRecord(assetRefs) || !isStringRecord(fixedRefs)) {
        return error(400, 'assetRefs and fixedRefs must map paths to string ids');
    }
    if (files.length !== writes.length) {
        return error(400, 'revision writes and files must be index-aligned');
    }

    // Buffer write payloads with an amplification guard: a revision whose
    // document payload alone cannot fit the session budget is rejected before
    // it is fully materialized (the exact post-delta budget is applyRevision's
    // job).
    const limits = manager.getLimits();
    const remainingForDocuments = limits.maxBytesPerSession - session.assetBytes;
    const bufferedWrites: Array<{ path: string; bytes: Uint8Array }> = [];
    let bufferedBytes = 0;
    for (let i = 0; i < files.length; i++) {
        const bytes = new Uint8Array(await files[i].arrayBuffer());
        bufferedBytes += bytes.length;
        if (bufferedBytes > remainingForDocuments) {
            return error(413, 'Revision exceeds the preview session byte budget');
        }
        bufferedWrites.push({ path: writes[i] as string, bytes });
    }

    // A concurrent DELETE / TTL sweep may have removed the session while the
    // revision body was buffering; do not mutate global accounting for a dead one
    // (the client re-creates on 404 and re-seeds a full snapshot).
    if (!manager.isRegistered(session)) {
        return error(404, 'Preview session not found');
    }

    const result = manager.applyRevision(
        session,
        {
            baseRevision: meta.baseRevision as number,
            nextRevision: meta.nextRevision as number,
            writes: bufferedWrites,
            deletes: deletes as string[],
            assetRefs,
            fixedRefs,
        },
        fixedResources,
    );
    if ('active' in result) {
        return { status: 200, body: result };
    }
    if (result.status === 409) {
        return { status: 409, body: { reason: 'revision-conflict', currentRevision: result.currentRevision } };
    }
    if (result.status === 422) {
        // Contract shape: { reason, missing } / { reason, resources } — do not
        // leak the internal status discriminant into the wire body.
        const { status, ...body } = result;
        return { status, body };
    }
    return error(result.status, result.message);
}

// =============================================================================
// Serving (authless capability URL)
// =============================================================================

/**
 * Headers applied to every serving response, 404s included. `Cache-Control`
 * is NOT part of this set — it is tiered per resolution layer below.
 */
export function baseServeHeaders(): Record<string, string> {
    return {
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': previewPermissionsPolicy(),
        // Fonts (@font-face) and module/`fetch()` requests from the opaque
        // frame are CORS-mode with `Origin: null`; the route is authless and
        // cookieless, so a wildcard grants nothing beyond what the capability
        // URL already serves.
        'Access-Control-Allow-Origin': '*',
    };
}

function notFound(): Response {
    return new Response('Not found', {
        status: 404,
        headers: { ...baseServeHeaders(), 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    });
}

export type ParsedRange = { start: number; end: number } | 'unsatisfiable' | 'ignore' | null;

/**
 * Classify a `Range` request against a body of `totalSize` bytes (canonical
 * per RFC 9110 §14.1.2). Four outcomes drive the response:
 *
 *  - `null` — no `Range` header at all: serve the full body (200).
 *  - `{ start, end }` — a valid, satisfiable single byte range: serve 206.
 *  - `'unsatisfiable'` — a valid single range that cannot be met
 *    (first-byte-pos ≥ length, e.g. `bytes=99-`; or a zero-length suffix
 *    `bytes=-0`): serve 416 with an unsatisfied-range `Content-Range` header.
 *  - `'ignore'` — a syntactically INVALID or unsupported spec (non-`bytes`
 *    unit, multi-range, unparseable garbage, or last-byte-pos < first-byte-pos
 *    such as `bytes=5-2`): the RFC says an invalid Range MUST be ignored, so
 *    serve the full body (200).
 *
 * Structural validity (`a-b` with a ≤ b) is checked BEFORE satisfiability, so
 * an inverted spec that is also out of bounds (`bytes=15-2` on a shorter body)
 * is ignored (200 full), never answered 416.
 */
export function parseRangeHeader(value: string | null | undefined, totalSize: number): ParsedRange {
    if (!value) return null;
    const unit = /^bytes=(.*)$/.exec(value.trim());
    if (!unit) return 'ignore'; // non-`bytes` unit (or no `=`): ignore → 200 full
    const spec = unit[1];
    if (spec.includes(',')) return 'ignore'; // multi-range: unsupported → 200 full
    const single = /^(\d*)-(\d*)$/.exec(spec);
    if (!single) return 'ignore'; // unparseable single spec → 200 full
    const [, rawStart, rawEnd] = single;
    if (rawStart === '' && rawEnd === '') return 'ignore'; // `bytes=-`: invalid → 200 full

    if (rawStart === '') {
        // Suffix form (`bytes=-n`): the last n bytes. A zero-length suffix, or
        // any suffix against an empty body, is unsatisfiable.
        const suffix = Number.parseInt(rawEnd, 10);
        if (suffix === 0) return 'unsatisfiable';
        if (totalSize === 0) return 'unsatisfiable';
        return { start: Math.max(0, totalSize - suffix), end: totalSize - 1 };
    }

    const start = Number.parseInt(rawStart, 10);
    if (rawEnd === '') {
        // `bytes=a-`: satisfiable only when the first byte exists.
        if (start >= totalSize) return 'unsatisfiable';
        return { start, end: totalSize - 1 };
    }

    const end = Number.parseInt(rawEnd, 10);
    // Structural check BEFORE satisfiability: an inverted spec is invalid and
    // MUST be ignored, even when its first-byte-pos is also out of bounds.
    if (end < start) return 'ignore';
    if (start >= totalSize) return 'unsatisfiable';
    return { start, end: Math.min(end, totalSize - 1) };
}

/** Loose `If-None-Match` evaluation: any listed entity tag (or `*`) matches. */
function ifNoneMatchMatches(headerValue: string | null | undefined, etag: string): boolean {
    if (!headerValue) return false;
    return headerValue.split(',').some(candidate => {
        const cleaned = candidate.trim().replace(/^W\//i, '').replace(/^"|"$/g, '');
        return cleaned === '*' || cleaned === etag;
    });
}

export interface ServeRequestHeaders {
    ifNoneMatch?: string | null;
    range?: string | null;
}

/**
 * The contract's reference serving logic: UUID gate → session lookup (touches
 * the idle-TTL clock) → three-layer `getFile` → tiered headers.
 *
 * Cache-Control tiers: documents `no-store`; session assets `no-cache` +
 * `ETag: "<assetKey>"` (+ 304 / single-range 206/416); fixed resources
 * `private, max-age=31536000` (immutable for the installed version, `private`
 * keeps capability URLs out of shared caches); 404s `no-store`. Every
 * scriptable document type carries the sandbox-first CSP, whatever layer
 * resolved it.
 */
export function servePreviewFile(
    previewId: string,
    relPath: string,
    requestHeaders: ServeRequestHeaders,
    deps: PreviewServingDeps,
): Response {
    if (!UUID_RE.test(previewId)) return notFound();

    // Bare capability root (`/preview/{id}` or `/preview/{id}/`) → redirect to
    // the canonical entry document. Never serve index.html bytes from the bare
    // URL: a single canonical document URL keeps its relative asset references
    // resolving. The Location is RELATIVE so it survives BASE_PATH and the
    // Electron `app://` origin. A trailing slash (`relPath === '/'`) resolves
    // `index.html` against `/preview/{id}/`; no slash resolves
    // `{id}/index.html` against `/preview/{id}`. Stateless (before session
    // lookup): the redirect target answers existence.
    if (relPath === '' || relPath === '/') {
        const location = relPath === '/' ? 'index.html' : `${previewId}/index.html`;
        return new Response(null, {
            status: 302,
            headers: { ...baseServeHeaders(), 'Cache-Control': 'no-store', Location: location },
        });
    }

    const session = deps.manager.getSessionForServing(previewId);
    if (!session) return notFound();
    const file = deps.manager.getFile(session, relPath, deps.fixedResources);
    if (!file) return notFound();

    const headers: Record<string, string> = { ...baseServeHeaders(), 'Content-Type': file.contentType };
    // Emit the sandbox-first CSP on every scriptable document type (HTML, SVG,
    // XML), not just HTML: an author SVG opened top-level would otherwise run
    // its inline <script> same-origin (nosniff does not help — SVG is already
    // a scriptable type). This applies to ANY resolution layer.
    if (file.isScriptable) {
        headers['Content-Security-Policy'] = previewCspHeader();
    }

    if (file.kind === 'document') {
        headers['Cache-Control'] = 'no-store';
        return new Response(file.bytes, { headers });
    }

    if (file.kind === 'fixed') {
        headers['Cache-Control'] = 'private, max-age=31536000';
        return new Response(file.bytes, { headers });
    }

    // Session asset: revalidating cache tier with ETag + single-range support
    // (large audio/video seeks without a full re-download).
    headers['Cache-Control'] = 'no-cache';
    headers.ETag = `"${file.etag}"`;
    headers['Accept-Ranges'] = 'bytes';

    if (ifNoneMatchMatches(requestHeaders.ifNoneMatch, file.etag)) {
        return new Response(null, { status: 304, headers });
    }

    const total = file.bytes.length;
    const range = parseRangeHeader(requestHeaders.range, total);
    if (range === 'unsatisfiable') {
        headers['Content-Range'] = `bytes */${total}`;
        return new Response(null, { status: 416, headers });
    }
    // `null` (no Range) and `'ignore'` (invalid/unsupported spec) both serve the
    // full body; only a satisfiable window becomes a 206.
    if (range !== null && range !== 'ignore') {
        const body = file.bytes.slice(range.start, range.end + 1);
        headers['Content-Range'] = `bytes ${range.start}-${range.end}/${total}`;
        headers['Content-Length'] = String(body.length);
        return new Response(body, { status: 206, headers });
    }
    return new Response(file.bytes, { headers });
}
