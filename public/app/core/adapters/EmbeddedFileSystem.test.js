/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EmbeddedFileSystem } from './EmbeddedFileSystem.js';

describe('EmbeddedFileSystem', () => {
    let adapter;
    let postMessageCalls;
    let messageHandler;

    beforeEach(() => {
        postMessageCalls = [];

        // Mock window.parent to be different from window
        // and capture postMessage calls
        const mockParent = {
            postMessage: (message, origin) => {
                postMessageCalls.push({ message, origin });
            },
        };

        // Override parent property
        Object.defineProperty(window, 'parent', {
            value: mockParent,
            writable: true,
            configurable: true,
        });

        // Track message handlers
        const originalAddEventListener = window.addEventListener.bind(window);
        vi.spyOn(window, 'addEventListener').mockImplementation((type, handler, options) => {
            if (type === 'message') {
                messageHandler = handler;
            }
            return originalAddEventListener(type, handler, options);
        });

        adapter = new EmbeddedFileSystem({ timeout: 500 });
    });

    afterEach(() => {
        if (adapter) {
            adapter.destroy();
        }
        vi.restoreAllMocks();
    });

    /**
     * Helper to simulate a response from the parent
     */
    function simulateParentResponse(data, origin = '*') {
        const event = new MessageEvent('message', { data, origin });
        if (messageHandler) {
            messageHandler(event);
        }
    }

    /**
     * Helper to wait for postMessage to be called
     * This is needed because _toArrayBuffer is async
     */
    async function waitForPostMessage(timeout = 100) {
        const start = Date.now();
        while (postMessageCalls.length === 0 && Date.now() - start < timeout) {
            await new Promise((resolve) => setTimeout(resolve, 5));
        }
        return postMessageCalls.length > 0;
    }

    describe('constructor', () => {
        it('should initialize with default options', () => {
            expect(adapter.parentOrigin).toBe('*');
        });

        it('should accept custom options', () => {
            const customAdapter = new EmbeddedFileSystem({
                parentOrigin: 'https://example.com',
                timeout: 5000,
            });
            expect(customAdapter.parentOrigin).toBe('https://example.com');
            expect(customAdapter.timeout).toBe(5000);
            customAdapter.destroy();
        });
    });

    describe('save', () => {
        it('should send save request to parent and handle response', async () => {
            const data = new Uint8Array([1, 2, 3]);
            const savePromise = adapter.save(data, 'project-123', 'test.elpx');

            // Wait for postMessage to be called (async due to _toArrayBuffer)
            await waitForPostMessage();

            // Check that postMessage was called
            expect(postMessageCalls.length).toBeGreaterThan(0);
            const call = postMessageCalls[0];
            expect(call.message.type).toBe('EXELEARNING_SAVE_REQUEST');
            expect(call.message.filename).toBe('test.elpx');
            expect(call.message.operation).toBe('save');

            // Simulate response
            simulateParentResponse({
                type: 'EXELEARNING_SAVE_RESPONSE',
                requestId: call.message.requestId,
                path: '/saved/test.elpx',
            });

            const result = await savePromise;
            expect(result.success).toBe(true);
            expect(result.path).toBe('/saved/test.elpx');
        });

        it('should handle save error response', async () => {
            const data = new Uint8Array([1, 2, 3]);
            const savePromise = adapter.save(data, 'project-123', 'test.elpx');

            await waitForPostMessage();
            const call = postMessageCalls[0];

            // Simulate error response
            simulateParentResponse({
                type: 'EXELEARNING_SAVE_REQUEST_ERROR',
                requestId: call.message.requestId,
                error: 'Save failed',
            });

            const result = await savePromise;
            expect(result.success).toBe(false);
            expect(result.error).toBe('Save failed');
        });

        it('should handle timeout', async () => {
            const data = new Uint8Array([1, 2, 3]);
            const result = await adapter.save(data, 'project-123', 'test.elpx');

            expect(result.success).toBe(false);
            expect(result.error).toContain('timed out');
        });
    });

    describe('saveAs', () => {
        it('should send saveAs request to parent', async () => {
            const data = new Uint8Array([1, 2, 3]);
            const savePromise = adapter.saveAs(data, 'project.elpx');

            await waitForPostMessage();
            const call = postMessageCalls[0];
            expect(call.message.type).toBe('EXELEARNING_SAVE_REQUEST');
            expect(call.message.operation).toBe('saveAs');

            // Simulate response
            simulateParentResponse({
                type: 'EXELEARNING_SAVE_RESPONSE',
                requestId: call.message.requestId,
                filename: 'project.elpx',
            });

            const result = await savePromise;
            expect(result.success).toBe(true);
        });
    });

    describe('open', () => {
        it('should send open request and receive file data', async () => {
            const openPromise = adapter.open(['elpx']);

            await waitForPostMessage();
            const call = postMessageCalls[0];
            expect(call.message.type).toBe('EXELEARNING_OPEN_REQUEST');
            expect(call.message.extensions).toEqual(['elpx']);

            // Simulate response with file data
            const fileData = new Uint8Array([1, 2, 3]);
            simulateParentResponse({
                type: 'EXELEARNING_OPEN_RESPONSE',
                requestId: call.message.requestId,
                bytes: fileData.buffer,
                filename: 'opened.elpx',
            });

            const result = await openPromise;
            expect(result.success).toBe(true);
            expect(result.data).toBeInstanceOf(Uint8Array);
            expect(result.name).toBe('opened.elpx');
        });

        it('should handle canceled open', async () => {
            const openPromise = adapter.open(['elpx']);

            await waitForPostMessage();
            const call = postMessageCalls[0];

            // Simulate cancel response
            simulateParentResponse({
                type: 'EXELEARNING_OPEN_REQUEST_ERROR',
                requestId: call.message.requestId,
                error: 'Operation canceled by user',
            });

            const result = await openPromise;
            expect(result.success).toBe(false);
            expect(result.error).toContain('Canceled');
        });

        it('should handle missing file data', async () => {
            const openPromise = adapter.open(['elpx']);

            await waitForPostMessage();
            const call = postMessageCalls[0];

            // Simulate response without bytes
            simulateParentResponse({
                type: 'EXELEARNING_OPEN_RESPONSE',
                requestId: call.message.requestId,
            });

            const result = await openPromise;
            expect(result.success).toBe(false);
            expect(result.error).toBe('No file data received');
        });
    });

    describe('readFile', () => {
        it('should return error (not supported)', async () => {
            const result = await adapter.readFile('/some/path');

            expect(result.success).toBe(false);
            expect(result.error).toContain('not supported');
        });
    });

    describe('exportToFolder', () => {
        it('should send export request to parent', async () => {
            const zipData = new Uint8Array([1, 2, 3]);
            const exportPromise = adapter.exportToFolder(zipData, 'project');

            await waitForPostMessage();
            const call = postMessageCalls[0];
            expect(call.message.type).toBe('EXELEARNING_EXPORT_REQUEST');
            expect(call.message.filename).toBe('project.zip');
            expect(call.message.format).toBe('folder');

            // Simulate response
            simulateParentResponse({
                type: 'EXELEARNING_EXPORT_RESPONSE',
                requestId: call.message.requestId,
                path: '/exported/project',
            });

            const result = await exportPromise;
            expect(result.success).toBe(true);
            expect(result.path).toBe('/exported/project');
        });

        it('should keep .zip extension if already present', async () => {
            const zipData = new Uint8Array([1, 2, 3]);
            const exportPromise = adapter.exportToFolder(zipData, 'project.zip');

            await waitForPostMessage();
            const call = postMessageCalls[0];
            expect(call.message.filename).toBe('project.zip');

            // Simulate response
            simulateParentResponse({
                type: 'EXELEARNING_EXPORT_RESPONSE',
                requestId: call.message.requestId,
                path: '/exported/project.zip',
            });

            await exportPromise;
        });
    });

    describe('supports', () => {
        it('should return true for postMessage', () => {
            expect(adapter.supports('postMessage')).toBe(true);
        });

        it('should return true for exportToFolder', () => {
            expect(adapter.supports('exportToFolder')).toBe(true);
        });

        it('should return false for saveToPath', () => {
            expect(adapter.supports('saveToPath')).toBe(false);
        });

        it('should return false for readFile', () => {
            expect(adapter.supports('readFile')).toBe(false);
        });

        it('should return false for nativeDialogs', () => {
            expect(adapter.supports('nativeDialogs')).toBe(false);
        });

        it('should return false for unknown capability', () => {
            expect(adapter.supports('unknownCapability')).toBe(false);
        });
    });

    describe('_toArrayBuffer', () => {
        it('should return ArrayBuffer unchanged', async () => {
            const buffer = new ArrayBuffer(3);
            const result = await adapter._toArrayBuffer(buffer);
            expect(result).toBe(buffer);
        });

        it('should convert Uint8Array to ArrayBuffer', async () => {
            const data = new Uint8Array([1, 2, 3]);
            const result = await adapter._toArrayBuffer(data);
            expect(result).toBeInstanceOf(ArrayBuffer);
            expect(result.byteLength).toBe(3);
        });

        it('should convert Blob to ArrayBuffer', async () => {
            const blob = new Blob(['test']);
            const result = await adapter._toArrayBuffer(blob);
            expect(result).toBeInstanceOf(ArrayBuffer);
        });

        it('should throw for unsupported type', async () => {
            await expect(adapter._toArrayBuffer('string')).rejects.toThrow('Unsupported data type');
        });
    });

    describe('destroy', () => {
        it('should clear pending requests', () => {
            // Just test that destroy can be called without error
            expect(() => adapter.destroy()).not.toThrow();
            expect(adapter.pendingRequests.size).toBe(0);
        });
    });
});
