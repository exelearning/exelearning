/**
 * Yjs WebSocket Collaboration Integration Tests
 * Tests WebSocket-based real-time collaboration functionality
 *
 * Note: These tests mock WebSocket behavior since actual WebSocket
 * connections require a running server. For E2E WebSocket tests,
 * use Playwright tests.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Kysely } from 'kysely';
import * as Y from 'yjs';
import {
    createTestDb,
    closeTestDb,
    createTestUser,
    generateTestToken,
    createTestProject,
    createTestYjsDocument,
} from '../helpers/integration-app';
import {
    createTestYjsDocument as createYjsDocHelper,
    encodeYjsDocument,
    decodeYjsDocument,
    extractMetadataFromYjs,
    extractAllPagesFromYjs,
} from '../../helpers/yjs-test-utils';
import type { Database, User } from '../../../src/db/types';

describe('Yjs Collaboration Integration', () => {
    let db: Kysely<Database>;
    let testUser: User;
    let testProjectId: number;
    let testProjectUuid: string;

    beforeAll(async () => {
        db = await createTestDb();
        testUser = await createTestUser(db, { email: 'yjs_test@test.local' });

        // Create a test project
        const project = await createTestProject(db, testUser.id, { title: 'Yjs Test Project' });
        testProjectId = project.id;
        testProjectUuid = project.uuid;
    });

    afterAll(async () => {
        await closeTestDb(db);
    });

    describe('Yjs Document Creation', () => {
        it('should create a valid Yjs document', () => {
            const ydoc = createYjsDocHelper({
                title: 'Test Document',
                author: 'Test Author',
                pageCount: 2,
                blocksPerPage: 1,
            });

            expect(ydoc).toBeDefined();

            const metadata = extractMetadataFromYjs(ydoc);
            expect(metadata).not.toBeNull();
            expect(metadata?.title).toBe('Test Document');
            expect(metadata?.author).toBe('Test Author');
        });

        it('should create document with nested pages', () => {
            const ydoc = createYjsDocHelper({
                title: 'Nested Document',
                pageCount: 1,
                nestedLevels: 2,
            });

            const pages = extractAllPagesFromYjs(ydoc);
            // Should have 1 root page + 2 nested levels = 3 pages total
            expect(pages.length).toBe(3);
        });
    });

    describe('Yjs Document Serialization', () => {
        it('should encode and decode document correctly', () => {
            const originalDoc = createYjsDocHelper({
                title: 'Serialization Test',
                pageCount: 2,
            });

            // Encode
            const encoded = encodeYjsDocument(originalDoc);
            expect(encoded).toBeInstanceOf(Uint8Array);
            expect(encoded.length).toBeGreaterThan(0);

            // Decode
            const decodedDoc = decodeYjsDocument(encoded);
            const metadata = extractMetadataFromYjs(decodedDoc);

            expect(metadata?.title).toBe('Serialization Test');
        });

        it('should preserve page structure after serialization', () => {
            const originalDoc = createYjsDocHelper({
                title: 'Structure Test',
                pageCount: 3,
                blocksPerPage: 2,
            });

            const originalPages = extractAllPagesFromYjs(originalDoc);
            const originalBlockCount = originalPages.reduce((sum, p) => sum + p.blocks.length, 0);

            // Encode and decode
            const encoded = encodeYjsDocument(originalDoc);
            const decodedDoc = decodeYjsDocument(encoded);

            const decodedPages = extractAllPagesFromYjs(decodedDoc);
            const decodedBlockCount = decodedPages.reduce((sum, p) => sum + p.blocks.length, 0);

            expect(decodedPages.length).toBe(originalPages.length);
            expect(decodedBlockCount).toBe(originalBlockCount);
        });
    });

    describe('Yjs Document Persistence', () => {
        it('should store Yjs document in database', async () => {
            const ydoc = createYjsDocHelper({
                title: 'Database Test',
                pageCount: 1,
            });

            const encoded = encodeYjsDocument(ydoc);
            const docId = await createTestYjsDocument(db, testProjectId, encoded);

            expect(docId).toBeGreaterThan(0);

            // Verify it was stored
            const stored = await db.selectFrom('yjs_documents').selectAll().where('id', '=', docId).executeTakeFirst();

            expect(stored).toBeDefined();
            expect(stored?.project_id).toBe(testProjectId);
        });

        it('should retrieve and restore Yjs document from database', async () => {
            // Create a new project for this test to avoid unique constraint
            const project2 = await createTestProject(db, testUser.id, { title: 'Retrieval Test Project' });

            // Create and store
            const originalDoc = createYjsDocHelper({
                title: 'Retrieval Test',
                author: 'Test Author',
                pageCount: 2,
            });

            const encoded = encodeYjsDocument(originalDoc);
            await createTestYjsDocument(db, project2.id, encoded);

            // Retrieve
            const stored = await db
                .selectFrom('yjs_documents')
                .select('snapshot_data')
                .where('project_id', '=', project2.id)
                .executeTakeFirst();

            expect(stored).toBeDefined();

            // Restore
            const restoredDoc = decodeYjsDocument(stored!.snapshot_data);
            const metadata = extractMetadataFromYjs(restoredDoc);

            expect(metadata?.title).toBe('Retrieval Test');
            expect(metadata?.author).toBe('Test Author');
        });
    });

    describe('JWT Token Generation', () => {
        it('should generate valid JWT for WebSocket auth', async () => {
            const token = await generateTestToken(testUser);

            expect(token).toBeDefined();
            expect(token.length).toBeGreaterThan(0);

            // JWT has 3 parts separated by dots
            const parts = token.split('.');
            expect(parts.length).toBe(3);
        });

        it('should include user info in token payload', async () => {
            const token = await generateTestToken(testUser);

            // Decode payload (middle part)
            const payloadB64 = token.split('.')[1];
            const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));

            expect(payload.sub).toBe(testUser.id);
            expect(payload.email).toBe(testUser.email);
        });
    });

    describe('WebSocket Connection Parameters', () => {
        it('should construct valid WebSocket URL', () => {
            const wsUrl = `ws://localhost:8080/yjs/project-${testProjectUuid}`;
            const url = new URL(wsUrl);

            expect(url.protocol).toBe('ws:');
            expect(url.pathname).toContain(testProjectUuid);
        });

        it('should add token as query parameter', async () => {
            const token = await generateTestToken(testUser);
            const wsUrl = `ws://localhost:8080/yjs/project-${testProjectUuid}?token=${token}`;
            const url = new URL(wsUrl);

            expect(url.searchParams.get('token')).toBe(token);
        });
    });

    describe('Yjs Update Handling', () => {
        it('should apply updates to document', () => {
            const ydoc = new Y.Doc();
            const metadata = ydoc.getMap('metadata');
            metadata.set('title', 'Initial Title');

            // Create update
            ydoc.transact(() => {
                metadata.set('title', 'Updated Title');
            });

            expect(metadata.get('title')).toBe('Updated Title');
        });

        it('should merge concurrent updates', () => {
            // Create two documents from same initial state
            const doc1 = createYjsDocHelper({ title: 'Base', pageCount: 1 });
            const initialState = encodeYjsDocument(doc1);

            const doc2 = decodeYjsDocument(initialState);

            // Make different changes
            const meta1 = doc1.getMap('metadata');
            meta1.set('author', 'Author 1');

            const meta2 = doc2.getMap('metadata');
            meta2.set('language', 'es');

            // Get updates
            const update1 = Y.encodeStateAsUpdate(doc1);
            const update2 = Y.encodeStateAsUpdate(doc2);

            // Create merged document
            const mergedDoc = new Y.Doc();
            Y.applyUpdate(mergedDoc, update1);
            Y.applyUpdate(mergedDoc, update2);

            const mergedMeta = mergedDoc.getMap('metadata');

            // Both changes should be present
            expect(mergedMeta.get('author')).toBe('Author 1');
            expect(mergedMeta.get('language')).toBe('es');
        });
    });
});
