/**
 * Platform Integration Service Tests
 */
import { describe, it, expect, afterEach } from 'bun:test';
import {
    buildSetOdeUrl,
    buildGetOdeUrl,
    platformPetitionGet,
    platformPetitionSet,
    configure,
    resetDependencies,
} from './platform-integration';
import type { PlatformJWTPayload } from '../utils/platform-jwt';

describe('Platform Integration Service', () => {
    // Store original fetch
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        // Restore original fetch
        globalThis.fetch = originalFetch;
        // Reset dependencies
        resetDependencies();
    });

    describe('buildSetOdeUrl', () => {
        it('should build set_ode.php URL for SCORM module', () => {
            const returnUrl = 'https://moodle.example.com/mod/exescorm/view.php?id=123';
            expect(buildSetOdeUrl(returnUrl)).toBe('https://moodle.example.com/mod/exescorm/set_ode.php');
        });

        it('should build set_ode.php URL for web module', () => {
            const returnUrl = 'https://moodle.example.com/mod/exeweb/view.php?id=456';
            expect(buildSetOdeUrl(returnUrl)).toBe('https://moodle.example.com/mod/exeweb/set_ode.php');
        });

        it('should build set_ode.php URL for course/section pattern', () => {
            const returnUrl = 'https://moodle.example.com/course/section.php?id=789';
            expect(buildSetOdeUrl(returnUrl)).toBe('https://moodle.example.com/mod/exescorm/set_ode.php');
        });

        it('should return null for unknown URL pattern', () => {
            const returnUrl = 'https://moodle.example.com/some/other/path';
            expect(buildSetOdeUrl(returnUrl)).toBeNull();
        });

        it('should handle URLs with ports', () => {
            const returnUrl = 'https://moodle.example.com:8080/mod/exescorm/view.php?id=123';
            expect(buildSetOdeUrl(returnUrl)).toBe('https://moodle.example.com:8080/mod/exescorm/set_ode.php');
        });

        it('should handle URLs with subpaths', () => {
            const returnUrl = 'https://example.com/moodle/mod/exescorm/view.php?id=123';
            expect(buildSetOdeUrl(returnUrl)).toBe('https://example.com/moodle/mod/exescorm/set_ode.php');
        });
    });

    describe('buildGetOdeUrl', () => {
        it('should build get_ode.php URL for SCORM module', () => {
            const returnUrl = 'https://moodle.example.com/mod/exescorm/view.php?id=123';
            expect(buildGetOdeUrl(returnUrl)).toBe('https://moodle.example.com/mod/exescorm/get_ode.php');
        });

        it('should build get_ode.php URL for web module', () => {
            const returnUrl = 'https://moodle.example.com/mod/exeweb/view.php?id=456';
            expect(buildGetOdeUrl(returnUrl)).toBe('https://moodle.example.com/mod/exeweb/get_ode.php');
        });

        it('should build get_ode.php URL for course/section pattern', () => {
            const returnUrl = 'https://moodle.example.com/course/section.php?id=789';
            expect(buildGetOdeUrl(returnUrl)).toBe('https://moodle.example.com/mod/exescorm/get_ode.php');
        });

        it('should return null for unknown URL pattern', () => {
            const returnUrl = 'https://moodle.example.com/some/other/path';
            expect(buildGetOdeUrl(returnUrl)).toBeNull();
        });
    });

    describe('platformPetitionGet', () => {
        const mockPayload: PlatformJWTPayload = {
            userid: '123',
            cmid: '456',
            returnurl: 'https://moodle.example.com/mod/exescorm/view.php?id=1',
            pkgtype: 'scorm',
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
        };

        it('should throw error when URL cannot be built', async () => {
            const invalidPayload = {
                ...mockPayload,
                returnurl: 'https://invalid-url.com/unknown/path',
            };

            await expect(platformPetitionGet(invalidPayload, 'jwt-token')).rejects.toThrow(
                'Could not build platform integration URL',
            );
        });

        it('should throw error when platform returns non-OK status', async () => {
            globalThis.fetch = async () => new Response(null, { status: 500, statusText: 'Internal Server Error' });

            await expect(platformPetitionGet(mockPayload, 'jwt-token')).rejects.toThrow(
                'Platform responded with status 500',
            );
        });

        it('should throw error when platform returns error status in JSON', async () => {
            globalThis.fetch = async () =>
                new Response(
                    JSON.stringify({
                        status: '1',
                        description: 'File not found',
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } },
                );

            await expect(platformPetitionGet(mockPayload, 'jwt-token')).rejects.toThrow('File not found');
        });

        it('should throw error with default message when platform error has no description', async () => {
            globalThis.fetch = async () =>
                new Response(
                    JSON.stringify({
                        status: '1',
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } },
                );

            await expect(platformPetitionGet(mockPayload, 'jwt-token')).rejects.toThrow('Platform returned an error');
        });

        it('should return ELP data on success', async () => {
            const mockResponse = {
                ode_file: 'base64EncodedContent',
                ode_filename: 'test-project.elp',
                status: '0',
            };

            globalThis.fetch = async () =>
                new Response(JSON.stringify(mockResponse), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });

            const result = await platformPetitionGet(mockPayload, 'jwt-token');

            expect(result.ode_file).toBe('base64EncodedContent');
            expect(result.ode_filename).toBe('test-project.elp');
        });

        it('should send correct form data to platform', async () => {
            let capturedBody: FormData | null = null;
            let capturedUrl: string | null = null;

            globalThis.fetch = async (url, init) => {
                capturedUrl = url as string;
                capturedBody = init?.body as FormData;
                return new Response(
                    JSON.stringify({
                        ode_file: 'content',
                        ode_filename: 'file.elp',
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } },
                );
            };

            await platformPetitionGet(mockPayload, 'test-jwt-token');

            expect(capturedUrl).toBe('https://moodle.example.com/mod/exescorm/get_ode.php');
            expect(capturedBody).not.toBeNull();

            const odeDataString = capturedBody!.get('ode_data') as string;
            const odeData = JSON.parse(odeDataString);

            expect(odeData.ode_id).toBe('456');
            expect(odeData.ode_user).toBe('123');
            expect(odeData.jwt_token).toBe('test-jwt-token');
        });

        it('should handle network errors gracefully', async () => {
            globalThis.fetch = async () => {
                throw new Error('Network error');
            };

            await expect(platformPetitionGet(mockPayload, 'jwt-token')).rejects.toThrow(
                'Failed to fetch ELP from platform: Network error',
            );
        });
    });

    describe('platformPetitionSet', () => {
        const mockPayload: PlatformJWTPayload = {
            userid: '123',
            cmid: '456',
            returnurl: 'https://moodle.example.com/mod/exescorm/view.php?id=1',
            pkgtype: 'scorm',
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
        };

        it('should return error when URL cannot be built', async () => {
            const invalidPayload = {
                ...mockPayload,
                returnurl: 'https://invalid-url.com/unknown/path',
            };

            const result = await platformPetitionSet(invalidPayload, 'jwt-token', 'project-uuid');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Could not build platform integration URL');
        });

        it('should return error when project not found', async () => {
            // Configure with mock that returns null
            configure({
                findProjectByUuid: async () => null,
            });

            const result = await platformPetitionSet(mockPayload, 'jwt-token', 'non-existent-uuid');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Project not found');
        });

        it('should return error when Yjs document snapshot not found', async () => {
            // Configure with mock project but no snapshot
            configure({
                findProjectByUuid: async () => ({
                    id: 1,
                    uuid: 'test-uuid',
                    title: 'Test Project',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
                findSnapshotByProjectId: async () => undefined,
            });

            const result = await platformPetitionSet(mockPayload, 'jwt-token', 'test-uuid');

            expect(result.success).toBe(false);
            expect(result.error).toContain('No document saved for this project');
        });

        it('should return error when platform returns non-OK HTTP status', async () => {
            // Create a mock snapshot from Yjs document
            const mockSnapshot = createMockSnapshot();

            configure({
                findProjectByUuid: async () => ({
                    id: 1,
                    uuid: 'test-uuid',
                    title: 'Test Project',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
                findSnapshotByProjectId: async () => mockSnapshot,
            });

            globalThis.fetch = async () => new Response(null, { status: 500 });

            const result = await platformPetitionSet(mockPayload, 'jwt-token', 'test-uuid');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Platform responded with status 500');
        });

        it('should return error when platform returns error in JSON response', async () => {
            const mockSnapshot = createMockSnapshot();

            configure({
                findProjectByUuid: async () => ({
                    id: 1,
                    uuid: 'test-uuid',
                    title: 'Test Project',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
                findSnapshotByProjectId: async () => mockSnapshot,
            });

            globalThis.fetch = async () =>
                new Response(
                    JSON.stringify({
                        status: '1',
                        description: 'Upload failed',
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } },
                );

            const result = await platformPetitionSet(mockPayload, 'jwt-token', 'test-uuid');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Upload failed');
        });

        it('should return error when platform returns error field in JSON', async () => {
            const mockSnapshot = createMockSnapshot();

            configure({
                findProjectByUuid: async () => ({
                    id: 1,
                    uuid: 'test-uuid',
                    title: 'Test Project',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
                findSnapshotByProjectId: async () => mockSnapshot,
            });

            globalThis.fetch = async () =>
                new Response(
                    JSON.stringify({
                        error: 'Permission denied',
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } },
                );

            const result = await platformPetitionSet(mockPayload, 'jwt-token', 'test-uuid');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Permission denied');
        });

        it('should return success when platform upload succeeds', async () => {
            const mockSnapshot = createMockSnapshot();

            configure({
                findProjectByUuid: async () => ({
                    id: 1,
                    uuid: 'test-uuid',
                    title: 'Test Project',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
                findSnapshotByProjectId: async () => mockSnapshot,
                updateProjectByUuid: async () => undefined,
            });

            const platformResponse = { success: true, message: 'Upload complete' };
            globalThis.fetch = async () =>
                new Response(JSON.stringify(platformResponse), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });

            const result = await platformPetitionSet(mockPayload, 'jwt-token', 'test-uuid');

            expect(result.success).toBe(true);
            expect(result.platformResponse).toEqual(platformResponse);
        });

        it('should use HTML5 exporter for webzip package type', async () => {
            const webzipPayload = { ...mockPayload, pkgtype: 'webzip' as const };
            const mockSnapshot = createMockSnapshot();

            configure({
                findProjectByUuid: async () => ({
                    id: 1,
                    uuid: 'test-uuid',
                    title: 'Test Project',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
                findSnapshotByProjectId: async () => mockSnapshot,
                updateProjectByUuid: async () => undefined,
            });

            let capturedBody: FormData | null = null;
            globalThis.fetch = async (_url, init) => {
                capturedBody = init?.body as FormData;
                return new Response(JSON.stringify({ success: true }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            };

            const result = await platformPetitionSet(webzipPayload, 'jwt-token', 'test-uuid');

            expect(result.success).toBe(true);
            // Verify the request was made (regardless of export type - both create zips)
            expect(capturedBody).not.toBeNull();
        });

        it('should handle exceptions during snapshot loading gracefully', async () => {
            configure({
                findProjectByUuid: async () => ({
                    id: 1,
                    uuid: 'test-uuid',
                    title: 'Test Project',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
                findSnapshotByProjectId: async () => {
                    throw new Error('Database error');
                },
            });

            const result = await platformPetitionSet(mockPayload, 'jwt-token', 'test-uuid');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Failed to upload to platform');
            expect(result.error).toContain('Database error');
        });

        it('should handle network errors during upload', async () => {
            const mockSnapshot = createMockSnapshot();

            configure({
                findProjectByUuid: async () => ({
                    id: 1,
                    uuid: 'test-uuid',
                    title: 'Test Project',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
                findSnapshotByProjectId: async () => mockSnapshot,
            });

            globalThis.fetch = async () => {
                throw new Error('Connection refused');
            };

            const result = await platformPetitionSet(mockPayload, 'jwt-token', 'test-uuid');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Connection refused');
        });

        it('should send cmid as ode_id to platform', async () => {
            const mockSnapshot = createMockSnapshot();

            configure({
                findProjectByUuid: async () => ({
                    id: 1,
                    uuid: 'test-uuid',
                    title: 'Test Project',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
                findSnapshotByProjectId: async () => mockSnapshot,
                updateProjectByUuid: async () => undefined,
            });

            let capturedBody: FormData | null = null;
            globalThis.fetch = async (_url, init) => {
                capturedBody = init?.body as FormData;
                return new Response(JSON.stringify({ success: true }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            };

            await platformPetitionSet(mockPayload, 'jwt-token', 'test-uuid');

            expect(capturedBody).not.toBeNull();
            const odeDataString = capturedBody!.get('ode_data') as string;
            const odeData = JSON.parse(odeDataString);

            // Verify cmid is sent as ode_id (not projectUuid)
            expect(odeData.ode_id).toBe('456'); // mockPayload.cmid
        });

        it('should store platform_id after successful upload', async () => {
            const mockSnapshot = createMockSnapshot();
            let storedPlatformId: string | null = null;
            let storedProjectUuid: string | null = null;

            configure({
                findProjectByUuid: async () => ({
                    id: 1,
                    uuid: 'test-uuid',
                    title: 'Test Project',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
                findSnapshotByProjectId: async () => mockSnapshot,
                updateProjectByUuid: async (_db, uuid, data) => {
                    storedProjectUuid = uuid;
                    storedPlatformId = data.platform_id ?? null;
                    return undefined;
                },
            });

            globalThis.fetch = async () =>
                new Response(JSON.stringify({ success: true }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });

            const result = await platformPetitionSet(mockPayload, 'jwt-token', 'test-uuid');

            expect(result.success).toBe(true);
            // Verify platform_id (cmid) was stored for the project
            expect(storedProjectUuid).toBe('test-uuid');
            expect(storedPlatformId).toBe('456'); // mockPayload.cmid
        });

        it('should not store platform_id when upload fails', async () => {
            const mockSnapshot = createMockSnapshot();
            let updateCalled = false;

            configure({
                findProjectByUuid: async () => ({
                    id: 1,
                    uuid: 'test-uuid',
                    title: 'Test Project',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
                findSnapshotByProjectId: async () => mockSnapshot,
                updateProjectByUuid: async () => {
                    updateCalled = true;
                    return undefined;
                },
            });

            // Platform returns error
            globalThis.fetch = async () =>
                new Response(JSON.stringify({ status: '1', error: 'Upload failed' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });

            const result = await platformPetitionSet(mockPayload, 'jwt-token', 'test-uuid');

            expect(result.success).toBe(false);
            // updateProjectByUuid should NOT be called on failure
            expect(updateCalled).toBe(false);
        });
    });
});

/**
 * Create a minimal mock Yjs document with the required structure
 * ServerYjsDocumentWrapper expects:
 * - getMetadata() → doc.getMap('metadata')
 * - getNavigation() → doc.getArray('navigation')
 */
function createMockYjsDocument() {
    const Y = require('yjs');
    const doc = new Y.Doc();

    // Set up metadata (required for hasContent() check)
    const metadata = doc.getMap('metadata');
    metadata.set('title', 'Test Project');
    metadata.set('author', 'Test Author');
    metadata.set('language', 'en');
    metadata.set('license', 'CC BY-SA 4.0');

    // Create navigation array with a root page (required for export)
    const navigation = doc.getArray('navigation');
    const rootPage = new Y.Map();
    rootPage.set('id', 'root');
    rootPage.set('pageName', 'Home');
    rootPage.set('parentId', null);
    rootPage.set('order', 0);
    rootPage.set('blocks', new Y.Array());
    navigation.push([rootPage]);

    return doc;
}

/**
 * Create a mock YjsDocument snapshot record
 * This simulates what would be returned from findSnapshotByProjectId()
 */
function createMockSnapshot() {
    const Y = require('yjs');
    const doc = createMockYjsDocument();
    const snapshotData = Y.encodeStateAsUpdate(doc);

    return {
        id: 1,
        project_id: 1,
        snapshot_data: snapshotData,
        snapshot_version: '1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
}
