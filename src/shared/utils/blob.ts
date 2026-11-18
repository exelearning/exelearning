/**
 * Shared binary helpers for the browser boundary.
 */

/**
 * Wrap raw bytes in a Blob. Internal export/asset pipelines carry binaries
 * as `Uint8Array`; a Blob is created only here, at the browser frontier
 * (downloads, object URLs, IndexedDB storage).
 *
 * The cast exists because TypeScript's DOM `BlobPart` requires a view over a
 * concrete `ArrayBuffer`, while our APIs use the wider `Uint8Array<ArrayBufferLike>`.
 */
export function blobFromBytes(bytes: Uint8Array, type: string): Blob {
    return new Blob([bytes as unknown as ArrayBufferView<ArrayBuffer>], { type });
}
