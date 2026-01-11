import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServerSharingAdapter } from './ServerSharingAdapter.js';

describe('ServerSharingAdapter', () => {
    let adapter;
    let mockHttpClient;
    let mockEndpoints;

    beforeEach(() => {
        mockHttpClient = {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            patch: vi.fn(),
            delete: vi.fn(),
        };

        mockEndpoints = {
            api_project_get: { path: '/api/projects/{id}/sharing' },
            api_project_visibility_update: { path: '/api/projects/{id}/visibility' },
            api_project_collaborator_add: { path: '/api/projects/{id}/collaborators' },
            api_project_collaborator_remove: { path: '/api/projects/{id}/collaborators/{userId}' },
            api_project_transfer_ownership: { path: '/api/projects/{id}/owner' },
        };

        adapter = new ServerSharingAdapter(mockHttpClient, mockEndpoints, '/test');

        window.eXeLearning = { config: { baseURL: 'http://localhost:8083' } };
    });

    afterEach(() => {
        delete window.eXeLearning;
    });

    describe('constructor', () => {
        it('should store httpClient, endpoints, and basePath', () => {
            expect(adapter.http).toBe(mockHttpClient);
            expect(adapter.endpoints).toBe(mockEndpoints);
            expect(adapter.basePath).toBe('/test');
        });

        it('should default endpoints to empty object', () => {
            const adapterWithoutEndpoints = new ServerSharingAdapter(mockHttpClient);
            expect(adapterWithoutEndpoints.endpoints).toEqual({});
        });

        it('should default basePath to empty string', () => {
            const adapterWithoutPath = new ServerSharingAdapter(mockHttpClient, {});
            expect(adapterWithoutPath.basePath).toBe('');
        });
    });

    describe('_getEndpoint', () => {
        it('should return endpoint path if exists', () => {
            expect(adapter._getEndpoint('api_project_get')).toBe('/api/projects/{id}/sharing');
        });

        it('should return null if endpoint not found', () => {
            expect(adapter._getEndpoint('nonexistent')).toBeNull();
        });
    });

    describe('_isUuid', () => {
        it('should return true for valid UUID', () => {
            expect(adapter._isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
        });

        it('should return false for numeric ID', () => {
            expect(adapter._isUuid('12345')).toBe(false);
        });

        it('should return false for invalid UUID', () => {
            expect(adapter._isUuid('not-a-uuid')).toBe(false);
        });

        it('should return false for non-string', () => {
            expect(adapter._isUuid(12345)).toBe(false);
        });
    });

    describe('_getProjectPath', () => {
        it('should return UUID path for UUID', () => {
            const path = adapter._getProjectPath('550e8400-e29b-41d4-a716-446655440000');
            expect(path).toBe('/api/projects/uuid/550e8400-e29b-41d4-a716-446655440000');
        });

        it('should return numeric path for numeric ID', () => {
            const path = adapter._getProjectPath('12345');
            expect(path).toBe('/api/projects/12345');
        });
    });

    describe('getProject', () => {
        it('should use endpoint if available', async () => {
            mockHttpClient.get.mockResolvedValue({ project: {} });

            const result = await adapter.getProject('123');

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/projects/123/sharing');
            expect(result).toEqual({ project: {} });
        });

        it('should fallback to constructed URL if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerSharingAdapter(mockHttpClient, {}, '/test');
            mockHttpClient.get.mockResolvedValue({ project: {} });

            await adapterWithoutEndpoints.getProject('123');

            expect(mockHttpClient.get).toHaveBeenCalledWith(
                'http://localhost:8083/test/api/projects/123/sharing',
            );
        });

        it('should use UUID path for UUID', async () => {
            const adapterWithoutEndpoints = new ServerSharingAdapter(mockHttpClient, {}, '/test');
            mockHttpClient.get.mockResolvedValue({ project: {} });

            await adapterWithoutEndpoints.getProject('550e8400-e29b-41d4-a716-446655440000');

            expect(mockHttpClient.get).toHaveBeenCalledWith(
                'http://localhost:8083/test/api/projects/uuid/550e8400-e29b-41d4-a716-446655440000/sharing',
            );
        });
    });

    describe('updateVisibility', () => {
        it('should use endpoint if available', async () => {
            mockHttpClient.put.mockResolvedValue({ success: true });

            const result = await adapter.updateVisibility('123', 'public');

            expect(mockHttpClient.put).toHaveBeenCalledWith(
                '/api/projects/123/visibility',
                { visibility: 'public' },
            );
            expect(result).toEqual({ success: true });
        });

        it('should fallback to constructed URL with PATCH if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerSharingAdapter(mockHttpClient, {}, '/test');
            mockHttpClient.patch.mockResolvedValue({ success: true });

            await adapterWithoutEndpoints.updateVisibility('123', 'private');

            expect(mockHttpClient.patch).toHaveBeenCalledWith(
                'http://localhost:8083/test/api/projects/123/visibility',
                { visibility: 'private' },
            );
        });
    });

    describe('addCollaborator', () => {
        it('should use endpoint if available', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            const result = await adapter.addCollaborator('123', 'user@example.com', 'editor');

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/api/projects/123/collaborators',
                { email: 'user@example.com', role: 'editor' },
            );
            expect(result).toEqual({ success: true });
        });

        it('should default role to editor', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            await adapter.addCollaborator('123', 'user@example.com');

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/api/projects/123/collaborators',
                { email: 'user@example.com', role: 'editor' },
            );
        });

        it('should fallback to constructed URL if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerSharingAdapter(mockHttpClient, {}, '/test');
            mockHttpClient.post.mockResolvedValue({ success: true });

            await adapterWithoutEndpoints.addCollaborator('123', 'user@example.com', 'viewer');

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                'http://localhost:8083/test/api/projects/123/collaborators',
                { email: 'user@example.com', role: 'viewer' },
            );
        });
    });

    describe('removeCollaborator', () => {
        it('should use endpoint if available', async () => {
            mockHttpClient.delete.mockResolvedValue({ success: true });

            const result = await adapter.removeCollaborator('123', 'user-456');

            expect(mockHttpClient.delete).toHaveBeenCalledWith(
                '/api/projects/123/collaborators/user-456',
            );
            expect(result).toEqual({ success: true });
        });

        it('should fallback to constructed URL if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerSharingAdapter(mockHttpClient, {}, '/test');
            mockHttpClient.delete.mockResolvedValue({ success: true });

            await adapterWithoutEndpoints.removeCollaborator('123', 'user-456');

            expect(mockHttpClient.delete).toHaveBeenCalledWith(
                'http://localhost:8083/test/api/projects/123/collaborators/user-456',
            );
        });
    });

    describe('transferOwnership', () => {
        it('should use endpoint if available', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            const result = await adapter.transferOwnership('123', 'new-owner-456');

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/api/projects/123/owner',
                { newOwnerId: 'new-owner-456' },
            );
            expect(result).toEqual({ success: true });
        });

        it('should fallback to constructed URL with PATCH if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerSharingAdapter(mockHttpClient, {}, '/test');
            mockHttpClient.patch.mockResolvedValue({ success: true });

            await adapterWithoutEndpoints.transferOwnership('123', 'new-owner-456');

            expect(mockHttpClient.patch).toHaveBeenCalledWith(
                'http://localhost:8083/test/api/projects/123/owner',
                { newOwnerId: 'new-owner-456' },
            );
        });
    });

    describe('isSupported', () => {
        it('should return true', () => {
            expect(adapter.isSupported()).toBe(true);
        });
    });
});
