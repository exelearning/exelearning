/**
 * Network capture for the preview-refresh benchmark.
 *
 * A `PreviewMeter` listens to every request the page makes and keeps only the
 * ones that belong to the HTTP preview transport:
 *
 *   POST /api/preview-session                       → create session
 *   POST /api/preview-session/{id}/manifest         → sync manifest (full file list)
 *   POST /api/preview-session/{id}/blobs            → upload missing blobs
 *   DELETE /api/preview-session/{id}                → dispose session
 *   GET  /preview/{id}/...                          → opaque iframe serving
 *
 * Byte accounting:
 *  - Manifest JSON: the real on-wire body size from `request.sizes()`.
 *  - Blob payload: Chromium does not report the multipart blobs body size to
 *    Playwright, so it is derived from the manifest request (path→{sha,size})
 *    intersected with the manifest response (`missing` hashes) — the exact
 *    content the client must upload, excluding small multipart framing overhead.
 *
 * Scenarios are run serially with a quiescence wait between them, so slicing the
 * buffer by index cleanly attributes requests to one refresh.
 */
import type { Page, Request } from '@playwright/test';

export type PreviewReqKind = 'session-create' | 'manifest' | 'blobs' | 'session-delete' | 'serve' | 'other';

export interface CapturedRequest {
    url: string;
    method: string;
    kind: PreviewReqKind;
    /** Date.now() when the request started (Node clock). */
    tStart: number;
    /** On-wire body size in bytes (0 for GET; unreliable for multipart, see below). */
    uploadBytes: number;
    /** For manifest calls: number of files declared in the manifest. */
    manifestFileCount?: number;
    /**
     * For manifest calls: the blob PAYLOAD the client must upload for this
     * refresh = sum of sizes of the hashes the server reported missing.
     *
     * Chromium does not report the multipart blob request body size to Playwright
     * (`sizes().requestBodySize` is 0 for form-data), so blob bytes are derived
     * here from the manifest request (path→{sha,size}) ∩ the manifest response
     * (`missing`). This is exact content payload; it excludes the small multipart
     * framing overhead (~150 B per file).
     */
    derivedBlobBytes?: number;
    /** For manifest calls: number of hashes the server reported missing. */
    missingCount?: number;
}

const PREVIEW_SESSION_RE = /\/api\/preview-session(\/([0-9a-f-]{36})\/(manifest|blobs))?\/?($|\?)/i;
const PREVIEW_SERVE_RE = /\/preview\/[0-9a-f-]{36}\//i;

function classify(req: Request): PreviewReqKind {
    const url = req.url();
    const method = req.method().toUpperCase();
    if (/\/api\/preview-session\/[0-9a-f-]{36}\/manifest\b/i.test(url)) return 'manifest';
    if (/\/api\/preview-session\/[0-9a-f-]{36}\/blobs\b/i.test(url)) return 'blobs';
    if (/\/api\/preview-session\/?($|\?)/i.test(url) && method === 'POST') return 'session-create';
    if (/\/api\/preview-session\/[0-9a-f-]{36}\/?($|\?)/i.test(url) && method === 'DELETE') return 'session-delete';
    if (PREVIEW_SERVE_RE.test(url)) return 'serve';
    return 'other';
}

export class PreviewMeter {
    private reqs: CapturedRequest[] = [];
    private lastEventAt = 0;
    private pending: Promise<void>[] = [];
    private readonly listener: (req: Request) => void;

    constructor(private readonly page: Page) {
        // Capture on `requestfinished` so `request.sizes()` is available: the
        // blob upload is multipart/form-data, for which postDataBuffer() returns
        // null. `sizes().requestBodySize` is the real body size on the wire
        // (works for JSON and multipart alike, and never buffers a 50 MiB body).
        this.listener = (req: Request) => {
            const url = req.url();
            const isPreview = PREVIEW_SESSION_RE.test(url) || PREVIEW_SERVE_RE.test(url);
            if (!isPreview) return;
            const kind = classify(req);
            const rec: CapturedRequest = { url, method: req.method(), kind, tStart: Date.now(), uploadBytes: 0 };
            let shaToSize: Map<string, number> | null = null;
            if (kind === 'manifest') {
                try {
                    const parsed = JSON.parse(req.postData() || '{}');
                    const files = (parsed?.files ?? {}) as Record<string, { sha256: string; size: number }>;
                    rec.manifestFileCount = Object.keys(files).length;
                    shaToSize = new Map();
                    for (const entry of Object.values(files)) {
                        if (!shaToSize.has(entry.sha256)) shaToSize.set(entry.sha256, entry.size);
                    }
                } catch {
                    rec.manifestFileCount = undefined;
                }
            }
            this.reqs.push(rec);
            this.lastEventAt = Date.now();

            // On-wire body size (accurate for JSON manifest; 0 for GET/multipart).
            this.pending.push(
                req
                    .sizes()
                    .then(s => {
                        rec.uploadBytes = s.requestBodySize >= 0 ? s.requestBodySize : 0;
                    })
                    .catch(() => {}),
            );

            // Derive blob payload from manifest request ∩ response(missing).
            if (kind === 'manifest' && shaToSize) {
                const map = shaToSize;
                this.pending.push(
                    req
                        .response()
                        .then(resp => (resp ? resp.json() : null))
                        .then((body: { missing?: string[] } | null) => {
                            const missing = Array.isArray(body?.missing) ? body!.missing : [];
                            let bytes = 0;
                            for (const h of missing) bytes += map.get(h) ?? 0;
                            rec.derivedBlobBytes = bytes;
                            rec.missingCount = missing.length;
                            if (process.env.BENCH_DEBUG) {
                                // eslint-disable-next-line no-console
                                console.error(
                                    `[meter] manifest files=${rec.manifestFileCount} missing=${rec.missingCount} blobPayload=${bytes}`,
                                );
                            }
                        })
                        .catch(() => {}),
                );
            }
        };
    }

    start(): void {
        this.page.on('requestfinished', this.listener);
    }

    stop(): void {
        this.page.off('requestfinished', this.listener);
    }

    /** Resolve all in-flight size lookups so byte counts are final. */
    async flush(): Promise<void> {
        await Promise.all(this.pending);
    }

    /** Index marking the current end of the buffer (start of the next window). */
    mark(): number {
        return this.reqs.length;
    }

    /** All preview requests captured since `from`. */
    since(from: number): CapturedRequest[] {
        return this.reqs.slice(from);
    }

    /**
     * Wait until no new preview request has arrived for `idleMs`. Condition-based
     * (not a fixed sleep): returns as soon as the network for this refresh settles.
     */
    async waitQuiet(idleMs = 200, timeoutMs = 120_000): Promise<void> {
        const deadline = Date.now() + timeoutMs;
        // Ensure at least one poll interval so an in-flight event is recorded.
        while (Date.now() < deadline) {
            const idle = Date.now() - (this.lastEventAt || 0);
            if (idle >= idleMs) {
                await this.flush();
                return;
            }
            await new Promise(r => setTimeout(r, 50));
        }
        await this.flush();
    }
}

/** Aggregate a window of captured requests into scenario metrics. */
export interface WindowMetrics {
    requestCount: number;
    manifestCount: number;
    blobsCount: number;
    sessionCreateCount: number;
    uploadedBytes: number; // manifest JSON + blob bodies
    manifestBytes: number; // manifest JSON only
    blobBytes: number; // blob bodies only
    manifestFileCount: number | null; // files declared in the last manifest of the window
}

export function summarize(reqs: CapturedRequest[]): WindowMetrics {
    let manifestBytes = 0;
    let blobBytes = 0;
    let manifestCount = 0;
    let blobsCount = 0;
    let sessionCreateCount = 0;
    let manifestFileCount: number | null = null;
    let previewReqCount = 0;
    for (const r of reqs) {
        if (r.kind === 'serve' || r.kind === 'other') continue;
        previewReqCount++;
        if (r.kind === 'manifest') {
            manifestCount++;
            manifestBytes += r.uploadBytes;
            // Blob payload is derived from this manifest's missing set (Chromium
            // does not expose the multipart blobs body size to Playwright).
            blobBytes += r.derivedBlobBytes ?? 0;
            if (typeof r.manifestFileCount === 'number') manifestFileCount = r.manifestFileCount;
        } else if (r.kind === 'blobs') {
            blobsCount++;
        } else if (r.kind === 'session-create') {
            sessionCreateCount++;
        }
    }
    return {
        requestCount: previewReqCount,
        manifestCount,
        blobsCount,
        sessionCreateCount,
        uploadedBytes: manifestBytes + blobBytes,
        manifestBytes,
        blobBytes,
        manifestFileCount,
    };
}

export function median(values: number[]): number {
    if (values.length === 0) return NaN;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
