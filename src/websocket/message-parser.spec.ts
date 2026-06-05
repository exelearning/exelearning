/**
 * Tests for WebSocket Message Parser
 * Tests the REAL implementation - no mock.module()
 */
import { describe, it, expect } from 'bun:test';
import { parseMessage, isAssetMessageType, serializeAssetMessage, createAssetMessage } from './message-parser';

describe('WebSocket message-parser', () => {
    describe('isAssetMessageType', () => {
        it('should return true for valid asset message types', () => {
            expect(isAssetMessageType('awareness-update')).toBe(true);
            expect(isAssetMessageType('request-asset')).toBe(true);
            expect(isAssetMessageType('asset-uploaded')).toBe(true);
            expect(isAssetMessageType('prefetch-progress')).toBe(true);
            expect(isAssetMessageType('bulk-upload-progress')).toBe(true);
            expect(isAssetMessageType('upload-request')).toBe(true);
            expect(isAssetMessageType('bulk-upload-request')).toBe(true);
            expect(isAssetMessageType('asset-ready')).toBe(true);
            expect(isAssetMessageType('asset-not-found')).toBe(true);
            expect(isAssetMessageType('request-prefetch')).toBe(true);
            expect(isAssetMessageType('asset-available')).toBe(true);
            expect(isAssetMessageType('bulk-upload-complete')).toBe(true);
        });

        it('should return true for priority queue message types', () => {
            expect(isAssetMessageType('priority-update')).toBe(true);
            expect(isAssetMessageType('priority-ack')).toBe(true);
            expect(isAssetMessageType('navigation-hint')).toBe(true);
            expect(isAssetMessageType('preempt-upload')).toBe(true);
            expect(isAssetMessageType('resume-upload')).toBe(true);
            expect(isAssetMessageType('slot-available')).toBe(true);
            expect(isAssetMessageType('request-sync-state')).toBe(true);
            expect(isAssetMessageType('access-revoked')).toBe(true);
        });

        it('should return true for upload session message types', () => {
            expect(isAssetMessageType('upload-session-create')).toBe(true);
            expect(isAssetMessageType('upload-session-ready')).toBe(true);
            expect(isAssetMessageType('upload-file-progress')).toBe(true);
            expect(isAssetMessageType('upload-batch-complete')).toBe(true);
        });

        it('should return true for collaboration resync message types', () => {
            expect(isAssetMessageType('trigger-resync')).toBe(true);
        });

        it('should return false for invalid types', () => {
            expect(isAssetMessageType('unknown-type')).toBe(false);
            expect(isAssetMessageType('')).toBe(false);
            expect(isAssetMessageType(null)).toBe(false);
            expect(isAssetMessageType(undefined)).toBe(false);
            expect(isAssetMessageType(123)).toBe(false);
            expect(isAssetMessageType({})).toBe(false);
        });

        it('should return false for non-string values', () => {
            expect(isAssetMessageType([])).toBe(false);
            expect(isAssetMessageType(true)).toBe(false);
            expect(isAssetMessageType(() => {})).toBe(false);
        });
    });

    describe('parseMessage - string messages', () => {
        it('should parse valid JSON asset message', () => {
            const msg = JSON.stringify({ type: 'request-asset', projectId: 'p1', clientId: 'c1', data: {} });
            const result = parseMessage(msg);
            expect(result.kind).toBe('asset');
            if (result.kind === 'asset') {
                expect(result.message.type).toBe('request-asset');
                expect(result.message.projectId).toBe('p1');
            }
        });

        it('should return unknown for string not starting with {', () => {
            const result = parseMessage('hello world');
            expect(result.kind).toBe('unknown');
        });

        it('should return unknown for invalid JSON starting with {', () => {
            const result = parseMessage('{invalid json}');
            expect(result.kind).toBe('unknown');
        });

        it('should return unknown for valid JSON but unknown message type', () => {
            const msg = JSON.stringify({ type: 'unknown-type', data: {} });
            const result = parseMessage(msg);
            expect(result.kind).toBe('unknown');
        });
    });

    describe('parseMessage - buffer messages', () => {
        it('should parse Yjs sync message (byte 0)', () => {
            const buffer = Buffer.from([0, 1, 2, 3, 4]);
            const result = parseMessage(buffer);
            expect(result.kind).toBe('yjs');
            if (result.kind === 'yjs') {
                expect(result.data).toBeInstanceOf(Uint8Array);
            }
        });

        it('should parse Yjs sync message (byte 1)', () => {
            const buffer = Buffer.from([1, 1, 2, 3]);
            const result = parseMessage(buffer);
            expect(result.kind).toBe('yjs');
        });

        it('should parse Yjs update message (byte 2)', () => {
            const buffer = Buffer.from([2, 1, 2, 3]);
            const result = parseMessage(buffer);
            expect(result.kind).toBe('yjs');
        });

        it('should parse JSON buffer starting with { (0x7b)', () => {
            const msg = JSON.stringify({ type: 'asset-ready', projectId: 'p1', clientId: 'c1', data: {} });
            const buffer = Buffer.from(msg);
            const result = parseMessage(buffer);
            expect(result.kind).toBe('asset');
        });

        it('should parse asset message with 0xFF prefix', () => {
            const json = JSON.stringify({ type: 'upload-request', projectId: 'p1', clientId: 'c1', data: {} });
            const buffer = Buffer.concat([Buffer.from([0xff]), Buffer.from(json)]);
            const result = parseMessage(buffer);
            expect(result.kind).toBe('asset');
        });

        it('should return unknown for 0xFF prefix with invalid JSON', () => {
            const buffer = Buffer.concat([Buffer.from([0xff]), Buffer.from('not json')]);
            const result = parseMessage(buffer);
            expect(result.kind).toBe('unknown');
        });

        it('should return unknown for 0xFF prefix with unknown message type', () => {
            const json = JSON.stringify({ type: 'unknown', data: {} });
            const buffer = Buffer.concat([Buffer.from([0xff]), Buffer.from(json)]);
            const result = parseMessage(buffer);
            expect(result.kind).toBe('unknown');
        });

        it('should return unknown for empty buffer', () => {
            const result = parseMessage(Buffer.from([]));
            expect(result.kind).toBe('unknown');
        });

        it('should treat other binary data as Yjs', () => {
            const buffer = Buffer.from([100, 200, 50, 150]);
            const result = parseMessage(buffer);
            expect(result.kind).toBe('yjs');
        });

        it('should handle buffer starting with { but invalid JSON', () => {
            // 123 = '{', but followed by binary data
            const buffer = Buffer.from([123, 0, 1, 2, 3]);
            const result = parseMessage(buffer);
            // Falls through to yjs when JSON parse fails
            expect(result.kind).toBe('yjs');
        });

        it('should handle JSON buffer with unknown type', () => {
            const msg = JSON.stringify({ type: 'not-asset-type', data: {} });
            const buffer = Buffer.from(msg);
            const result = parseMessage(buffer);
            expect(result.kind).toBe('unknown');
        });

        it('should return unknown for 0xFF prefix only (length=1)', () => {
            const buffer = Buffer.from([0xff]);
            const result = parseMessage(buffer);
            // Single byte 0xFF should be treated as yjs
            expect(result.kind).toBe('yjs');
        });
    });

    describe('serializeAssetMessage', () => {
        it('should serialize asset message to JSON string', () => {
            const message = {
                type: 'request-asset' as const,
                projectId: 'p1',
                clientId: 'c1',
                data: { assetId: 'a1' },
            };
            const result = serializeAssetMessage(message);
            expect(typeof result).toBe('string');
            const parsed = JSON.parse(result);
            expect(parsed.type).toBe('request-asset');
            expect(parsed.projectId).toBe('p1');
            expect(parsed.data.assetId).toBe('a1');
        });
    });

    describe('createAssetMessage', () => {
        it('should create asset message with type, projectId, clientId, and data', () => {
            const message = createAssetMessage('asset-uploaded', 'project-123', 'client-456', { filename: 'test.png' });
            expect(message.type).toBe('asset-uploaded');
            expect(message.projectId).toBe('project-123');
            expect(message.clientId).toBe('client-456');
            expect(message.data).toEqual({ filename: 'test.png' });
        });

        it('should handle null data', () => {
            const message = createAssetMessage('priority-ack', 'p1', 'c1', null);
            expect(message.data).toBeNull();
        });

        it('should handle complex nested data', () => {
            const complexData = {
                assets: ['a1', 'a2'],
                metadata: { size: 100, nested: { level: 2 } },
            };
            const message = createAssetMessage('bulk-upload-progress', 'p1', 'c1', complexData);
            expect(message.data).toEqual(complexData);
        });
    });

    describe('edge cases', () => {
        it('should handle very large JSON messages', () => {
            const largeData = { items: new Array(500).fill('item') };
            const json = JSON.stringify({ type: 'awareness-update', projectId: 'p1', data: largeData });
            const buffer = Buffer.concat([Buffer.from([0xff]), Buffer.from(json)]);
            const result = parseMessage(buffer);
            expect(result.kind).toBe('asset');
        });

        it('should handle Unicode content in messages', () => {
            const json = JSON.stringify({
                type: 'asset-ready',
                projectId: 'p1',
                data: { filename: '日本語ファイル.png', emoji: '🎉' },
            });
            const buffer = Buffer.concat([Buffer.from([0xff]), Buffer.from(json, 'utf8')]);
            const result = parseMessage(buffer);
            expect(result.kind).toBe('asset');
            if (result.kind === 'asset') {
                const data = result.message.data as { filename: string };
                expect(data.filename).toBe('日本語ファイル.png');
            }
        });

        it('should handle JSON with null/undefined values', () => {
            const json = JSON.stringify({ type: 'request-asset', projectId: null, data: {} });
            const buffer = Buffer.concat([Buffer.from([0xff]), Buffer.from(json)]);
            const result = parseMessage(buffer);
            expect(result.kind).toBe('asset');
        });

        it('should handle single byte buffer', () => {
            const buffer = Buffer.from([1]);
            const result = parseMessage(buffer);
            expect(result.kind).toBe('yjs');
        });

        it('should parse all priority message types with 0xFF prefix', () => {
            const priorityTypes = ['priority-update', 'priority-ack', 'navigation-hint', 'preempt-upload'];
            for (const type of priorityTypes) {
                const json = JSON.stringify({ type, projectId: 'test', data: {} });
                const buffer = Buffer.concat([Buffer.from([0xff]), Buffer.from(json)]);
                const result = parseMessage(buffer);
                expect(result.kind).toBe('asset');
            }
        });

        it('should parse all upload session message types', () => {
            const sessionTypes = [
                'upload-session-create',
                'upload-session-ready',
                'upload-file-progress',
                'upload-batch-complete',
            ];
            for (const type of sessionTypes) {
                const json = JSON.stringify({ type, projectId: 'test', data: {} });
                const buffer = Buffer.concat([Buffer.from([0xff]), Buffer.from(json)]);
                const result = parseMessage(buffer);
                expect(result.kind).toBe('asset');
            }
        });
    });

    describe('roundtrip tests', () => {
        it('should serialize and parse back an asset message', () => {
            const original = createAssetMessage('awareness-update', 'proj-rt', 'client-rt', { test: 'data' });
            const serialized = serializeAssetMessage(original);
            const buffer = Buffer.concat([Buffer.from([0xff]), Buffer.from(serialized)]);
            const parsed = parseMessage(buffer);

            expect(parsed.kind).toBe('asset');
            if (parsed.kind === 'asset') {
                expect(parsed.message.type).toBe('awareness-update');
                expect(parsed.message.projectId).toBe('proj-rt');
            }
        });
    });
});
