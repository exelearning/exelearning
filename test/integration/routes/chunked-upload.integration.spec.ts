/**
 * Chunked Upload Integration Tests
 * Tests for concurrent chunk uploads and race condition prevention
 *
 * This test creates a minimal Elysia app that implements chunked upload logic
 * to test the race condition prevention and chunk tracking without requiring
 * the full database and file system dependencies.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import * as fs from 'fs-extra';
import * as path from 'path';

// In-memory storage for chunked uploads (mirrors the real implementation)
const chunkUploads = new Map<
    string,
    {
        projectId: string;
        filename: string;
        totalChunks: number;
        uploadedChunks: Set<number>;
        chunkDir: string;
        createdAt: Date;
    }
>();

// Test chunks directory
const testChunksDir = path.join(process.cwd(), 'test', 'temp', 'chunks-test');

/**
 * Create a minimal test app with chunked upload routes
 */
function createChunkedUploadTestApp(): Elysia {
    return (
        new Elysia({ name: 'chunked-upload-test', prefix: '/api/projects/:projectId/assets' })
            // GET /upload-chunk - Check if chunk exists
            .get('/upload-chunk', async ({ params, query, set }) => {
                const { projectId } = params;
                const identifier = query.resumableIdentifier as string;
                const chunkNumber = parseInt(query.resumableChunkNumber as string, 10);

                if (!identifier || !chunkNumber) {
                    set.status = 400;
                    return { success: false, error: 'Missing required parameters' };
                }

                const upload = chunkUploads.get(`${projectId}:${identifier}`);
                if (upload?.uploadedChunks.has(chunkNumber)) {
                    // Chunk exists
                    set.status = 200;
                    return { exists: true };
                }

                // Chunk doesn't exist
                set.status = 204;
                return;
            })

            // POST /upload-chunk - Upload a chunk
            .post('/upload-chunk', async ({ params, body, set }) => {
                try {
                    const { projectId } = params;
                    const data = body as any;

                    const identifier = data.resumableIdentifier;
                    const chunkNumber = parseInt(data.resumableChunkNumber, 10);
                    const totalChunks = parseInt(data.resumableTotalChunks, 10);
                    const filename = data.resumableFilename;
                    const chunk = data.file;

                    if (!identifier || !chunkNumber || !chunk) {
                        set.status = 400;
                        return { success: false, error: 'Missing required parameters' };
                    }

                    const uploadKey = `${projectId}:${identifier}`;
                    const chunkDir = path.join(testChunksDir, projectId, identifier);

                    // Initialize upload tracking SYNCHRONOUSLY to prevent race condition
                    // Set the Map entry BEFORE any async operation
                    if (!chunkUploads.has(uploadKey)) {
                        // Set the entry FIRST (synchronously)
                        chunkUploads.set(uploadKey, {
                            projectId,
                            filename,
                            totalChunks,
                            uploadedChunks: new Set<number>(),
                            chunkDir,
                            createdAt: new Date(),
                        });
                    }

                    // Ensure the directory exists (multiple calls are safe with ensureDir)
                    await fs.ensureDir(chunkDir);

                    const upload = chunkUploads.get(uploadKey)!;

                    // Save chunk to disk
                    const chunkPath = path.join(chunkDir, `chunk_${chunkNumber}`);

                    // Handle both Blob and Buffer
                    let chunkBuffer: Buffer;
                    if (chunk instanceof Blob) {
                        chunkBuffer = Buffer.from(await chunk.arrayBuffer());
                    } else if (Buffer.isBuffer(chunk)) {
                        chunkBuffer = chunk;
                    } else {
                        chunkBuffer = Buffer.from(String(chunk));
                    }

                    await fs.writeFile(chunkPath, chunkBuffer);

                    // Mark chunk as uploaded
                    upload.uploadedChunks.add(chunkNumber);

                    // Check if all chunks uploaded
                    const allUploaded = upload.uploadedChunks.size === upload.totalChunks;

                    return {
                        success: true,
                        chunkNumber,
                        allUploaded,
                        uploadedChunks: upload.uploadedChunks.size,
                        totalChunks: upload.totalChunks,
                    };
                } catch (error: any) {
                    set.status = 500;
                    return { success: false, error: error.message };
                }
            })

            // DELETE /upload-chunk/:identifier - Cancel chunked upload
            .delete('/upload-chunk/:identifier', async ({ params, set: _set }) => {
                const { projectId, identifier } = params;
                const uploadKey = `${projectId}:${identifier}`;

                const upload = chunkUploads.get(uploadKey);
                if (upload) {
                    // Clean up chunks directory
                    await fs.remove(upload.chunkDir);
                    chunkUploads.delete(uploadKey);
                }

                return { success: true };
            })
    );
}

describe('Chunked Upload Integration', () => {
    let app: Elysia;
    const testProjectId = 'test-chunked-upload-project';

    beforeAll(async () => {
        app = createChunkedUploadTestApp();
        await fs.ensureDir(testChunksDir);
    });

    beforeEach(async () => {
        // Clean up chunks directory and in-memory state before each test
        await fs.emptyDir(testChunksDir);
        chunkUploads.clear();
    });

    afterAll(async () => {
        await fs.remove(testChunksDir);
    });

    describe('Race Condition Prevention', () => {
        it('should handle concurrent chunk uploads without losing chunks', async () => {
            const identifier = `test-concurrent-${Date.now()}`;
            const totalChunks = 10;
            const baseUrl = `/api/projects/${testProjectId}/assets/upload-chunk`;

            // Send all chunks concurrently
            const promises: Promise<Response>[] = [];

            for (let i = 1; i <= totalChunks; i++) {
                const formData = new FormData();
                formData.append('file', new Blob([`chunk-data-${i}-`.repeat(100)]), 'test.mp4');
                formData.append('resumableIdentifier', identifier);
                formData.append('resumableChunkNumber', String(i));
                formData.append('resumableTotalChunks', String(totalChunks));
                formData.append('resumableFilename', 'test.mp4');
                formData.append('resumableType', 'video/mp4');

                promises.push(
                    app.handle(
                        new Request(`http://localhost${baseUrl}`, {
                            method: 'POST',
                            body: formData,
                        }),
                    ),
                );
            }

            // Wait for ALL chunks to complete
            const results = await Promise.all(promises);

            // All should succeed (status 200)
            for (let i = 0; i < results.length; i++) {
                const res = results[i];
                if (res.status !== 200) {
                    const text = await res.text();
                    console.error(`Chunk ${i + 1} failed:`, res.status, text);
                }
                expect(res.status).toBe(200);
            }

            // Parse responses to check uploadedChunks count
            const jsonResults = await Promise.all(
                results.map(async r => {
                    try {
                        const text = await r.clone().text();
                        return JSON.parse(text);
                    } catch {
                        return null;
                    }
                }),
            );

            // At least one should report allUploaded: true or all 10 chunks
            const finalResult = jsonResults.find(
                r => r && (r.allUploaded === true || r.uploadedChunks === totalChunks),
            );

            // If not, check the last result to see total chunks received
            if (!finalResult) {
                // All results should show progress toward 10 chunks
                const maxUploaded = Math.max(...jsonResults.filter(r => r).map(r => r.uploadedChunks || 0));
                expect(maxUploaded).toBe(totalChunks);
            }
        });

        it('should track all chunks correctly with sequential uploads', async () => {
            const identifier = `test-sequential-${Date.now()}`;
            const totalChunks = 5;
            const baseUrl = `/api/projects/${testProjectId}/assets/upload-chunk`;

            // Upload chunks sequentially
            for (let i = 1; i <= totalChunks; i++) {
                const formData = new FormData();
                formData.append('file', new Blob([`chunk-${i}`]), 'test.mp4');
                formData.append('resumableIdentifier', identifier);
                formData.append('resumableChunkNumber', String(i));
                formData.append('resumableTotalChunks', String(totalChunks));
                formData.append('resumableFilename', 'test.mp4');

                const res = await app.handle(
                    new Request(`http://localhost${baseUrl}`, {
                        method: 'POST',
                        body: formData,
                    }),
                );

                expect(res.status).toBe(200);
                const json = (await res.json()) as any;
                expect(json.success).toBe(true);
                expect(json.uploadedChunks).toBe(i);

                if (i === totalChunks) {
                    expect(json.allUploaded).toBe(true);
                }
            }
        });

        it('should handle batch concurrent uploads (simulating MAX_CONCURRENT_CHUNKS=3)', async () => {
            const identifier = `test-batch-${Date.now()}`;
            const totalChunks = 9;
            const batchSize = 3;
            const baseUrl = `/api/projects/${testProjectId}/assets/upload-chunk`;

            let totalUploaded = 0;

            // Upload in batches of 3 (like the client does)
            for (let batch = 0; batch < totalChunks; batch += batchSize) {
                const batchPromises: Promise<Response>[] = [];

                for (let i = batch; i < Math.min(batch + batchSize, totalChunks); i++) {
                    const chunkNumber = i + 1;
                    const formData = new FormData();
                    formData.append('file', new Blob([`chunk-${chunkNumber}`]), 'test.mp4');
                    formData.append('resumableIdentifier', identifier);
                    formData.append('resumableChunkNumber', String(chunkNumber));
                    formData.append('resumableTotalChunks', String(totalChunks));
                    formData.append('resumableFilename', 'test.mp4');

                    batchPromises.push(
                        app.handle(
                            new Request(`http://localhost${baseUrl}`, {
                                method: 'POST',
                                body: formData,
                            }),
                        ),
                    );
                }

                const batchResults = await Promise.all(batchPromises);

                // All should succeed
                for (const res of batchResults) {
                    expect(res.status).toBe(200);
                    const json = (await res.json()) as any;
                    expect(json.success).toBe(true);
                }

                totalUploaded += batchPromises.length;
            }

            expect(totalUploaded).toBe(totalChunks);
        });
    });

    describe('Chunk Existence Check', () => {
        it('should return 204 for non-existent chunk', async () => {
            const identifier = `test-check-${Date.now()}`;
            const baseUrl = `/api/projects/${testProjectId}/assets/upload-chunk`;

            const res = await app.handle(
                new Request(`http://localhost${baseUrl}?resumableIdentifier=${identifier}&resumableChunkNumber=1`, {
                    method: 'GET',
                }),
            );

            expect(res.status).toBe(204);
        });

        it('should return 200 for existing chunk', async () => {
            const identifier = `test-check-exists-${Date.now()}`;
            const baseUrl = `/api/projects/${testProjectId}/assets/upload-chunk`;

            // First upload a chunk
            const formData = new FormData();
            formData.append('file', new Blob(['chunk-1']), 'test.mp4');
            formData.append('resumableIdentifier', identifier);
            formData.append('resumableChunkNumber', '1');
            formData.append('resumableTotalChunks', '5');
            formData.append('resumableFilename', 'test.mp4');

            const uploadRes = await app.handle(
                new Request(`http://localhost${baseUrl}`, {
                    method: 'POST',
                    body: formData,
                }),
            );
            expect(uploadRes.status).toBe(200);

            // Now check if it exists
            const checkRes = await app.handle(
                new Request(`http://localhost${baseUrl}?resumableIdentifier=${identifier}&resumableChunkNumber=1`, {
                    method: 'GET',
                }),
            );

            expect(checkRes.status).toBe(200);
            const json = (await checkRes.json()) as any;
            expect(json.exists).toBe(true);
        });
    });

    describe('Upload Cancellation', () => {
        it('should cancel upload and clean up chunks', async () => {
            const identifier = `test-cancel-${Date.now()}`;
            const baseUrl = `/api/projects/${testProjectId}/assets/upload-chunk`;

            // Upload a few chunks
            for (let i = 1; i <= 3; i++) {
                const formData = new FormData();
                formData.append('file', new Blob([`chunk-${i}`]), 'test.mp4');
                formData.append('resumableIdentifier', identifier);
                formData.append('resumableChunkNumber', String(i));
                formData.append('resumableTotalChunks', '10');
                formData.append('resumableFilename', 'test.mp4');

                await app.handle(
                    new Request(`http://localhost${baseUrl}`, {
                        method: 'POST',
                        body: formData,
                    }),
                );
            }

            // Cancel the upload
            const cancelRes = await app.handle(
                new Request(`http://localhost${baseUrl}/${identifier}`, {
                    method: 'DELETE',
                }),
            );

            expect(cancelRes.status).toBe(200);
            const json = (await cancelRes.json()) as any;
            expect(json.success).toBe(true);

            // Verify chunk 1 no longer exists
            const checkRes = await app.handle(
                new Request(`http://localhost${baseUrl}?resumableIdentifier=${identifier}&resumableChunkNumber=1`, {
                    method: 'GET',
                }),
            );

            expect(checkRes.status).toBe(204);
        });
    });
});
