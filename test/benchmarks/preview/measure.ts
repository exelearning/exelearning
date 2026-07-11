/**
 * Upload measurement for the preview-refresh benchmark.
 *
 * Playwright cannot size a multipart request body (`request.sizes().requestBodySize`
 * is 0 for form-data, and `postDataBuffer()` is null), and protocol v2 sends BOTH
 * upload endpoints (`/assets`, `/revisions`) as multipart. So instead of scraping
 * the network layer we inject a `fetch` shim into the page (harness code, not app
 * code) that measures the EXACT serialized body of every `/api/preview-session`
 * request by re-serializing its body (`new Response(body).arrayBuffer()`). This is
 * the real on-wire payload — protocol-agnostic — for both v1 (manifest/blobs) and
 * v2 (assets/revisions).
 *
 * The shim records into `window.__exeBench.uploads`; the Node side marks an index
 * before a scenario and collects the slice after the refresh completes.
 */
import type { Page } from '@playwright/test';

export type PreviewReqKind =
    | 'session-create'
    | 'manifest'
    | 'blobs'
    | 'assets'
    | 'revisions'
    | 'session-delete'
    | 'other';

export interface UploadRecord {
    url: string;
    method: string;
    kind: PreviewReqKind;
    bytes: number;
    manifestFileCount?: number;
    writeCount?: number;
    deleteCount?: number;
    assetCount?: number;
    done: boolean;
    t: number;
}

/**
 * Installed in the page. Patches `window.fetch` (which the provider calls
 * dynamically, so a late patch still intercepts) to record the exact serialized
 * body size of every preview-session request without delaying the real fetch.
 */
export function installFetchMeter(): void {
    const w = window as any;
    if (w.__exeBench?.installed) return;
    const uploads: any[] = [];
    w.__exeBench = { installed: true, uploads };
    const realFetch = w.fetch.bind(w);

    const classify = (url: string, method: string): string => {
        if (/\/api\/preview-session\/[0-9a-f-]{36}\/assets\b/i.test(url)) return 'assets';
        if (/\/api\/preview-session\/[0-9a-f-]{36}\/revisions\b/i.test(url)) return 'revisions';
        if (/\/api\/preview-session\/[0-9a-f-]{36}\/manifest\b/i.test(url)) return 'manifest';
        if (/\/api\/preview-session\/[0-9a-f-]{36}\/blobs\b/i.test(url)) return 'blobs';
        if (/\/api\/preview-session\/?($|\?)/i.test(url) && method === 'POST') return 'session-create';
        if (/\/api\/preview-session\/[0-9a-f-]{36}\/?($|\?)/i.test(url) && method === 'DELETE') return 'session-delete';
        return 'other';
    };

    const measureBytes = async (body: any): Promise<number> => {
        if (body == null) return 0;
        if (typeof body === 'string') return new TextEncoder().encode(body).length;
        try {
            return (await new Response(body).arrayBuffer()).byteLength;
        } catch {
            return 0;
        }
    };

    const parseMeta = (kind: string, body: any, rec: any): void => {
        try {
            if (kind === 'manifest' && typeof body === 'string') {
                const j = JSON.parse(body);
                rec.manifestFileCount = j.files ? Object.keys(j.files).length : 0;
            } else if (kind === 'revisions' && body && typeof body.get === 'function') {
                const r = body.get('revision');
                if (typeof r === 'string') {
                    const j = JSON.parse(r);
                    rec.writeCount = (j.writes || []).length;
                    rec.deleteCount = (j.deletes || []).length;
                }
            } else if (kind === 'assets' && body && typeof body.get === 'function') {
                const a = body.get('assets');
                if (typeof a === 'string') {
                    const j = JSON.parse(a);
                    rec.assetCount = Array.isArray(j) ? j.length : 0;
                }
            }
        } catch {
            /* metadata best-effort */
        }
    };

    w.fetch = (input: any, init: any) => {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        const method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        const p = realFetch(input, init);
        try {
            if (/\/api\/preview-session/i.test(url)) {
                const kind = classify(url, method);
                const body = init && init.body;
                const rec: any = { url, method, kind, bytes: 0, done: false, t: Date.now() };
                parseMeta(kind, body, rec);
                uploads.push(rec);
                // Measure after kicking off the real fetch so timing is unperturbed.
                measureBytes(body)
                    .then((b: number) => {
                        rec.bytes = b;
                        rec.done = true;
                    })
                    .catch(() => {
                        rec.done = true;
                    });
            }
        } catch {
            /* never let instrumentation break the app fetch */
        }
        return p;
    };
}

/** Marks scenario windows and collects the uploads recorded by the page shim. */
export class PreviewMeter {
    constructor(private readonly page: Page) {}

    /** Install the in-page shim (idempotent). */
    async install(): Promise<void> {
        await this.page.evaluate(installFetchMeter);
    }

    /** Current number of recorded uploads — the start of the next window. */
    async mark(): Promise<number> {
        return this.page.evaluate(() => (window as any).__exeBench?.uploads.length ?? 0);
    }

    /**
     * All uploads recorded since `from`, once every one has finished measuring.
     * Byte sizes are filled asynchronously by the shim, so this waits for `done`.
     */
    async collect(from: number): Promise<UploadRecord[]> {
        await this.page.waitForFunction(
            start => {
                const u = (window as any).__exeBench?.uploads ?? [];
                for (let i = start; i < u.length; i++) if (!u[i].done) return false;
                return true;
            },
            from,
            { timeout: 120_000, polling: 50 },
        );
        return this.page.evaluate(start => (window as any).__exeBench.uploads.slice(start), from);
    }
}

/** Aggregated metrics for one scenario window. */
export interface WindowMetrics {
    /** Upload round-trips (create + manifest/blobs + assets/revisions); excludes delete/serve. */
    requestCount: number;
    /** Total bytes uploaded across those round-trips. */
    uploadedBytes: number;
    /** Metadata-and-document upload bucket: manifest (v1) or revisions (v2). */
    bucketAbytes: number;
    /** Binary-asset upload bucket: blobs (v1) or assets (v2). */
    bucketBbytes: number;
    /** Publish round-trips (manifest or revisions) — used by the S6 probe. */
    syncCount: number;
    /** v1: files in the manifest. v2: documents written + new assets uploaded. */
    filesUploaded: number | null;
    /** Detected wire protocol for this window. */
    protocol: 'v1' | 'v2' | '?';
}

const REQUEST_KINDS = new Set<PreviewReqKind>(['session-create', 'manifest', 'blobs', 'assets', 'revisions']);

export function summarize(records: UploadRecord[]): WindowMetrics {
    let requestCount = 0;
    let uploadedBytes = 0;
    let bucketAbytes = 0;
    let bucketBbytes = 0;
    let syncCount = 0;
    let writeSum = 0;
    let assetSum = 0;
    let manifestFileCount: number | null = null;
    let sawRevisions = false;
    let sawManifest = false;

    for (const r of records) {
        if (!REQUEST_KINDS.has(r.kind)) continue;
        requestCount++;
        uploadedBytes += r.bytes;
        if (r.kind === 'manifest') {
            sawManifest = true;
            syncCount++;
            bucketAbytes += r.bytes;
            if (typeof r.manifestFileCount === 'number') manifestFileCount = r.manifestFileCount;
        } else if (r.kind === 'revisions') {
            sawRevisions = true;
            syncCount++;
            bucketAbytes += r.bytes;
            writeSum += r.writeCount ?? 0;
        } else if (r.kind === 'blobs') {
            bucketBbytes += r.bytes;
        } else if (r.kind === 'assets') {
            bucketBbytes += r.bytes;
            assetSum += r.assetCount ?? 0;
        }
    }

    const protocol = sawRevisions ? 'v2' : sawManifest ? 'v1' : '?';
    const filesUploaded = protocol === 'v2' ? writeSum + assetSum : manifestFileCount;
    return { requestCount, uploadedBytes, bucketAbytes, bucketBbytes, syncCount, filesUploaded, protocol };
}

export function median(values: number[]): number {
    if (values.length === 0) return NaN;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
