import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import { SignJWT } from 'jose';
import { createYjsRoutes, type YjsDependencies } from './yjs';

const TEST_SECRET = 'dev_secret_change_me';

const mockProject = {
    id: 1,
    uuid: '11111111-1111-4111-8111-111111111111',
    title: 'History project',
    owner_id: 42,
    visibility: 'private',
    status: 'active',
};

async function signToken(sub: number, roles: string[]): Promise<string> {
    const secret = new TextEncoder().encode(TEST_SECRET);
    return new SignJWT({ sub, email: `u${sub}@test.local`, roles })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);
}

function authHeaders(token: string): Record<string, string> {
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
    };
}

describe('Yjs version history routes', () => {
    let app: Elysia;
    let adminToken: string;
    let userToken: string;
    let historySaveCalls: unknown[][];
    let canonicalSaveCalls: unknown[][];
    let restoreCalls: unknown[][];

    beforeAll(async () => {
        adminToken = await signToken(7, ['ROLE_USER', 'ROLE_ADMIN']);
        userToken = await signToken(42, ['ROLE_USER']);
    });

    function createDependencies(): YjsDependencies {
        return {
            db: {} as any,
            queries: {
                findProjectByUuid: async (_db: any, uuid: string) =>
                    uuid === mockProject.uuid ? (mockProject as any) : undefined,
                findSnapshotByProjectId: async () => undefined,
                loadDocumentWithUpdates: async () => ({ snapshot: undefined, updates: [] }),
                upsertSnapshot: async (...args: unknown[]) => {
                    canonicalSaveCalls.push(args);
                    return {
                        id: 1,
                        project_id: 1,
                        snapshot_data: args[2],
                        snapshot_version: args[3],
                        created_at: 1,
                        updated_at: 1,
                    } as any;
                },
                updateProjectTitle: async () => undefined,
                updateProjectTitleAndSave: async () => undefined,
                checkProjectAccess: async () => ({ hasAccess: true }),
            },
            history: {
                saveSnapshotWithHistory: async (...args: unknown[]) => {
                    historySaveCalls.push(args);
                    const options = args[1] as any;
                    return {
                        id: 1,
                        project_id: options.projectId,
                        snapshot_data: options.snapshotData,
                        snapshot_version: options.snapshotVersion,
                        created_at: 1,
                        updated_at: 1,
                    } as any;
                },
                listVersionHistory: async () => [
                    {
                        id: 11,
                        project_id: 1,
                        snapshot_data: new Uint8Array([1, 2, 3]),
                        version: '123',
                        description: 'Previous snapshot before explicit save',
                        created_by: 7,
                        created_at: 123,
                    },
                ],
                restoreVersionSnapshot: async (...args: unknown[]) => {
                    restoreCalls.push(args);
                    return {
                        id: 1,
                        project_id: 1,
                        snapshot_data: new Uint8Array([4]),
                        snapshot_version: 'restored',
                        created_at: 1,
                        updated_at: 1,
                    } as any;
                },
                getHistoryLimit: () => 5,
            },
        };
    }

    beforeEach(() => {
        historySaveCalls = [];
        canonicalSaveCalls = [];
        restoreCalls = [];
        app = new Elysia().use(createYjsRoutes(createDependencies()));
    });

    it('uses versioned persistence for explicit saves', async () => {
        const response = await app.handle(
            new Request(`http://localhost/api/projects/uuid/${mockProject.uuid}/yjs-document?markSaved=true`, {
                method: 'POST',
                headers: authHeaders(userToken),
                body: new Uint8Array([9, 8, 7]),
            }),
        );

        expect(response.status).toBe(200);
        expect(historySaveCalls).toHaveLength(1);
        expect(canonicalSaveCalls).toHaveLength(0);
        const options = historySaveCalls[0][1] as any;
        expect(options.historyLimit).toBe(5);
        expect(options.createdBy).toBe(42);
    });

    it('does not create history for automatic persistence', async () => {
        const response = await app.handle(
            new Request(`http://localhost/api/projects/uuid/${mockProject.uuid}/yjs-document`, {
                method: 'POST',
                headers: authHeaders(userToken),
                body: new Uint8Array([9, 8, 7]),
            }),
        );

        expect(response.status).toBe(200);
        expect(historySaveCalls).toHaveLength(0);
        expect(canonicalSaveCalls).toHaveLength(1);
    });

    it('requires authentication to list history', async () => {
        const response = await app.handle(
            new Request(`http://localhost/api/projects/uuid/${mockProject.uuid}/yjs-history`),
        );

        expect(response.status).toBe(401);
    });

    it('requires the administrator role to list history', async () => {
        const response = await app.handle(
            new Request(`http://localhost/api/projects/uuid/${mockProject.uuid}/yjs-history`, {
                headers: authHeaders(userToken),
            }),
        );

        expect(response.status).toBe(403);
    });

    it('returns history metadata without exposing snapshot bytes', async () => {
        const response = await app.handle(
            new Request(`http://localhost/api/projects/uuid/${mockProject.uuid}/yjs-history`, {
                headers: authHeaders(adminToken),
            }),
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.historyLimit).toBe(5);
        expect(body.versions).toHaveLength(1);
        expect(body.versions[0].size).toBe(3);
        expect(body.versions[0].snapshot_data).toBeUndefined();
    });

    it('returns 503 when history support is not configured', async () => {
        const dependencies = createDependencies();
        delete dependencies.history;
        const testApp = new Elysia().use(createYjsRoutes(dependencies));

        const response = await testApp.handle(
            new Request(`http://localhost/api/projects/uuid/${mockProject.uuid}/yjs-history`, {
                headers: authHeaders(adminToken),
            }),
        );

        expect(response.status).toBe(503);
    });

    it('returns 404 when listing history for a missing project', async () => {
        const response = await app.handle(
            new Request('http://localhost/api/projects/uuid/missing/yjs-history', {
                headers: authHeaders(adminToken),
            }),
        );

        expect(response.status).toBe(404);
    });

    it('requires the administrator role to restore history', async () => {
        const response = await app.handle(
            new Request(`http://localhost/api/projects/uuid/${mockProject.uuid}/yjs-history/11/restore`, {
                method: 'POST',
                headers: authHeaders(userToken),
            }),
        );

        expect(response.status).toBe(403);
        expect(restoreCalls).toHaveLength(0);
    });

    it('requires authentication to restore history', async () => {
        const response = await app.handle(
            new Request(`http://localhost/api/projects/uuid/${mockProject.uuid}/yjs-history/11/restore`, {
                method: 'POST',
            }),
        );

        expect(response.status).toBe(401);
        expect(restoreCalls).toHaveLength(0);
    });

    it('returns 503 when restore support is not configured', async () => {
        const dependencies = createDependencies();
        delete dependencies.history;
        const testApp = new Elysia().use(createYjsRoutes(dependencies));

        const response = await testApp.handle(
            new Request(`http://localhost/api/projects/uuid/${mockProject.uuid}/yjs-history/11/restore`, {
                method: 'POST',
                headers: authHeaders(adminToken),
            }),
        );

        expect(response.status).toBe(503);
    });

    it('returns 404 when restoring history for a missing project', async () => {
        const response = await app.handle(
            new Request('http://localhost/api/projects/uuid/missing/yjs-history/11/restore', {
                method: 'POST',
                headers: authHeaders(adminToken),
            }),
        );

        expect(response.status).toBe(404);
        expect(restoreCalls).toHaveLength(0);
    });

    it('validates the version ID before restoring', async () => {
        const response = await app.handle(
            new Request(`http://localhost/api/projects/uuid/${mockProject.uuid}/yjs-history/invalid/restore`, {
                method: 'POST',
                headers: authHeaders(adminToken),
            }),
        );

        expect(response.status).toBe(400);
        expect(restoreCalls).toHaveLength(0);
    });

    it('restores a version as an administrator', async () => {
        const response = await app.handle(
            new Request(`http://localhost/api/projects/uuid/${mockProject.uuid}/yjs-history/11/restore`, {
                method: 'POST',
                headers: authHeaders(adminToken),
            }),
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.version).toBe('restored');
        const options = restoreCalls[0][1] as any;
        expect(options).toEqual({ projectId: 1, versionId: 11, historyLimit: 5, createdBy: 7 });
    });

    it('returns 404 when the requested version does not exist', async () => {
        const dependencies = createDependencies();
        dependencies.history!.restoreVersionSnapshot = async () => undefined;
        const testApp = new Elysia().use(createYjsRoutes(dependencies));

        const response = await testApp.handle(
            new Request(`http://localhost/api/projects/uuid/${mockProject.uuid}/yjs-history/99/restore`, {
                method: 'POST',
                headers: authHeaders(adminToken),
            }),
        );

        expect(response.status).toBe(404);
    });
});
