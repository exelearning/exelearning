import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StaticContentAdapter } from './StaticContentAdapter.js';

describe('StaticContentAdapter', () => {
    let adapter;
    let mockDataProvider;

    beforeEach(() => {
        mockDataProvider = {
            get: vi.fn(),
            set: vi.fn(),
        };

        adapter = new StaticContentAdapter(mockDataProvider);
    });

    describe('constructor', () => {
        it('should store dataProvider', () => {
            expect(adapter.dataProvider).toBe(mockDataProvider);
        });

        it('should allow null dataProvider', () => {
            const adapterWithoutProvider = new StaticContentAdapter();
            expect(adapterWithoutProvider.dataProvider).toBeNull();
        });
    });

    describe('savePage', () => {
        it('should return OK (Yjs handles sync)', async () => {
            const result = await adapter.savePage({ pageId: '123', title: 'Test' });

            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('reorderPage', () => {
        it('should return OK (Yjs handles sync)', async () => {
            const result = await adapter.reorderPage({ order: [1, 2, 3] });

            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('clonePage', () => {
        it('should return OK (Yjs handles sync)', async () => {
            const result = await adapter.clonePage({ pageId: '123' });

            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('deletePage', () => {
        it('should return OK (Yjs handles sync)', async () => {
            const result = await adapter.deletePage('page-123');

            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('reorderBlock', () => {
        it('should return OK (Yjs handles sync)', async () => {
            const result = await adapter.reorderBlock({ order: [1, 2] });

            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('deleteBlock', () => {
        it('should return OK (Yjs handles sync)', async () => {
            const result = await adapter.deleteBlock('block-123');

            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('reorderIdevice', () => {
        it('should return OK (Yjs handles sync)', async () => {
            const result = await adapter.reorderIdevice({ order: [1, 2] });

            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('saveIdevice', () => {
        it('should return OK (Yjs handles sync)', async () => {
            const result = await adapter.saveIdevice({ ideviceId: '123', content: 'test' });

            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('cloneIdevice', () => {
        it('should return OK (Yjs handles sync)', async () => {
            const result = await adapter.cloneIdevice({ ideviceId: '123' });

            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('deleteIdevice', () => {
        it('should return OK (Yjs handles sync)', async () => {
            const result = await adapter.deleteIdevice('idevice-123');

            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('send', () => {
        it('should return OK and warn about offline mode', async () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const result = await adapter.send('some_endpoint', { data: 'test' });

            expect(result).toEqual({ responseMessage: 'OK' });
            expect(consoleSpy).toHaveBeenCalledWith(
                '[StaticContentAdapter] Endpoint some_endpoint not available in offline mode',
            );

            consoleSpy.mockRestore();
        });
    });
});
