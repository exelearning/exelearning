import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import LinkValidationManager from './LinkValidationManager.js';

// Mock the SSEClient module
vi.mock('../../rest/SSEClient.js', () => ({
    default: {
        createStream: vi.fn(),
    },
}));

// Mock global eXeLearning
const mockApi = {
    extractLinksForValidation: vi.fn(),
    getLinkValidationStreamUrl: vi.fn(() => 'http://test.com/validate-stream'),
};

beforeEach(() => {
    global.eXeLearning = {
        app: {
            project: { odeSession: 'test-session-id' },
            api: mockApi,
        },
    };
});

afterEach(() => {
    vi.clearAllMocks();
    delete global.eXeLearning;
});

describe('LinkValidationManager', () => {
    describe('constructor', () => {
        it('should initialize with empty state', () => {
            const manager = new LinkValidationManager();

            expect(manager.links.size).toBe(0);
            expect(manager.isInProgress()).toBe(false);
            expect(manager.wasCancelled()).toBe(false);
        });
    });

    describe('getStats', () => {
        it('should return correct stats for empty manager', () => {
            const manager = new LinkValidationManager();
            const stats = manager.getStats();

            expect(stats).toEqual({
                total: 0,
                validated: 0,
                valid: 0,
                broken: 0,
                pending: 0,
            });
        });

        it('should count links by status', () => {
            const manager = new LinkValidationManager();
            manager.links.set('1', { id: '1', status: 'pending' });
            manager.links.set('2', { id: '2', status: 'valid' });
            manager.links.set('3', { id: '3', status: 'valid' });
            manager.links.set('4', { id: '4', status: 'broken' });

            const stats = manager.getStats();

            expect(stats.total).toBe(4);
            expect(stats.valid).toBe(2);
            expect(stats.broken).toBe(1);
            expect(stats.pending).toBe(1);
            expect(stats.validated).toBe(3); // valid + broken
        });
    });

    describe('getAllLinks', () => {
        it('should return all links as array', () => {
            const manager = new LinkValidationManager();
            manager.links.set('1', { id: '1', url: 'https://a.com', status: 'pending' });
            manager.links.set('2', { id: '2', url: 'https://b.com', status: 'valid' });

            const links = manager.getAllLinks();

            expect(links).toHaveLength(2);
            expect(links[0].url).toBe('https://a.com');
        });
    });

    describe('getBrokenLinks', () => {
        it('should return only broken links', () => {
            const manager = new LinkValidationManager();
            manager.links.set('1', { id: '1', url: 'https://valid.com', status: 'valid' });
            manager.links.set('2', {
                id: '2',
                url: 'https://broken.com',
                status: 'broken',
                error: '404',
            });
            manager.links.set('3', { id: '3', url: 'https://pending.com', status: 'pending' });

            const broken = manager.getBrokenLinks();

            expect(broken).toHaveLength(1);
            expect(broken[0].url).toBe('https://broken.com');
            expect(broken[0].error).toBe('404');
        });
    });

    describe('getValidLinks', () => {
        it('should return only valid links', () => {
            const manager = new LinkValidationManager();
            manager.links.set('1', { id: '1', url: 'https://valid.com', status: 'valid' });
            manager.links.set('2', { id: '2', url: 'https://broken.com', status: 'broken' });

            const valid = manager.getValidLinks();

            expect(valid).toHaveLength(1);
            expect(valid[0].url).toBe('https://valid.com');
        });
    });

    describe('getLinkById', () => {
        it('should return link by ID', () => {
            const manager = new LinkValidationManager();
            manager.links.set('test-id', { id: 'test-id', url: 'https://test.com' });

            const link = manager.getLinkById('test-id');

            expect(link).toBeDefined();
            expect(link.url).toBe('https://test.com');
        });

        it('should return undefined for non-existent ID', () => {
            const manager = new LinkValidationManager();

            const link = manager.getLinkById('non-existent');

            expect(link).toBeUndefined();
        });
    });

    describe('reset', () => {
        it('should clear all state', () => {
            const manager = new LinkValidationManager();
            manager.links.set('1', { id: '1', status: 'valid' });
            manager.isValidating = true;
            manager.isCancelled = true;

            manager.reset();

            expect(manager.links.size).toBe(0);
            expect(manager.isInProgress()).toBe(false);
            expect(manager.wasCancelled()).toBe(false);
        });
    });

    describe('toExportFormat', () => {
        it('should convert links to export format', () => {
            const manager = new LinkValidationManager();
            manager.links.set('1', {
                id: '1',
                url: 'https://broken.com',
                count: 3,
                pageName: 'Page 1',
                blockName: 'Block 1',
                ideviceType: 'text',
                order: '2',
                status: 'broken',
                error: '404',
            });

            const exported = manager.toExportFormat(true);

            expect(exported).toHaveLength(1);
            expect(exported[0]).toEqual({
                brokenLinks: 'https://broken.com',
                brokenLinksError: '404',
                nTimesBrokenLinks: 3,
                pageNamesBrokenLinks: 'Page 1',
                blockNamesBrokenLinks: 'Block 1',
                typeComponentSyncBrokenLinks: 'text',
                orderComponentSyncBrokenLinks: '2',
            });
        });

        it('should export all links when onlyBroken is false', () => {
            const manager = new LinkValidationManager();
            manager.links.set('1', {
                id: '1',
                url: 'https://valid.com',
                count: 1,
                pageName: '',
                blockName: '',
                ideviceType: '',
                order: '',
                status: 'valid',
                error: null,
            });
            manager.links.set('2', {
                id: '2',
                url: 'https://broken.com',
                count: 1,
                pageName: '',
                blockName: '',
                ideviceType: '',
                order: '',
                status: 'broken',
                error: '500',
            });

            const exported = manager.toExportFormat(false);

            expect(exported).toHaveLength(2);
        });
    });

    describe('startValidation', () => {
        it('should extract links and set initial state', async () => {
            const { default: SSEClient } = await import('../../rest/SSEClient.js');

            mockApi.extractLinksForValidation.mockResolvedValue({
                responseMessage: 'OK',
                links: [
                    {
                        id: 'link-1',
                        url: 'https://example.com',
                        count: 1,
                        pageName: 'Page 1',
                        blockName: 'Block 1',
                        ideviceType: 'text',
                        order: '1',
                    },
                ],
                totalLinks: 1,
            });

            // Mock SSE stream that completes immediately
            SSEClient.createStream.mockImplementation((url, data, callbacks) => {
                // Simulate immediate completion
                setTimeout(() => {
                    callbacks.onEvent({
                        event: 'link-validated',
                        data: { id: 'link-1', status: 'valid', error: null },
                    });
                    callbacks.onComplete();
                }, 10);
                return { cancel: vi.fn() };
            });

            const manager = new LinkValidationManager();
            const onLinksExtracted = vi.fn();
            const onLinkUpdate = vi.fn();
            const onComplete = vi.fn();

            manager.onLinksExtracted = onLinksExtracted;
            manager.onLinkUpdate = onLinkUpdate;
            manager.onComplete = onComplete;

            await manager.startValidation([{ html: '<a href="https://example.com">Link</a>' }]);

            expect(onLinksExtracted).toHaveBeenCalled();
            expect(onLinkUpdate).toHaveBeenCalledWith('link-1', 'valid', null, expect.any(Object));
            expect(onComplete).toHaveBeenCalled();
        });

        it('should call onComplete immediately for empty links', async () => {
            mockApi.extractLinksForValidation.mockResolvedValue({
                responseMessage: 'OK',
                links: [],
                totalLinks: 0,
            });

            const manager = new LinkValidationManager();
            const onComplete = vi.fn();
            manager.onComplete = onComplete;

            await manager.startValidation([]);

            expect(onComplete).toHaveBeenCalledWith(
                { total: 0, validated: 0, valid: 0, broken: 0, pending: 0 },
                false
            );
        });

        it('should not start if validation already in progress', async () => {
            const manager = new LinkValidationManager();
            manager.isValidating = true;

            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await manager.startValidation([]);

            expect(consoleSpy).toHaveBeenCalledWith(
                '[LinkValidationManager] Validation already in progress'
            );
            expect(mockApi.extractLinksForValidation).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });

    describe('cancel', () => {
        it('should cancel active stream', () => {
            const cancelFn = vi.fn();
            const manager = new LinkValidationManager();
            manager.streamHandle = { cancel: cancelFn };

            manager.cancel();

            expect(cancelFn).toHaveBeenCalled();
            expect(manager.isCancelled).toBe(true);
            expect(manager.streamHandle).toBeNull();
        });
    });

    describe('_handleStreamEvent', () => {
        it('should update link status on validation event', () => {
            const manager = new LinkValidationManager();
            manager.links.set('link-1', {
                id: 'link-1',
                url: 'https://test.com',
                status: 'pending',
                error: null,
            });

            const onLinkUpdate = vi.fn();
            manager.onLinkUpdate = onLinkUpdate;

            manager._handleStreamEvent({
                event: 'link-validated',
                data: { id: 'link-1', status: 'broken', error: '404' },
            });

            const link = manager.getLinkById('link-1');
            expect(link.status).toBe('broken');
            expect(link.error).toBe('404');
            expect(onLinkUpdate).toHaveBeenCalled();
        });

        it('should call onProgress after each update', () => {
            const manager = new LinkValidationManager();
            manager.links.set('link-1', { id: 'link-1', status: 'pending' });

            const onProgress = vi.fn();
            manager.onProgress = onProgress;

            manager._handleStreamEvent({
                event: 'link-validated',
                data: { id: 'link-1', status: 'valid', error: null },
            });

            expect(onProgress).toHaveBeenCalledWith({
                total: 1,
                validated: 1,
                valid: 1,
                broken: 0,
                pending: 0,
            });
        });
    });
});
