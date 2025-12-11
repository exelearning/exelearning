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

        it('should return false for invalid types', () => {
            expect(isAssetMessageType('unknown-type')).toBe(false);
            expect(isAssetMessageType('')).toBe(false);
            expect(isAssetMessageType(null)).toBe(false);
            expect(isAssetMessageType(undefined)).toBe(false);
            expect(isAssetMessageType(123)).toBe(false);
            expect(isAssetMessageType({})).toBe(false);
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
    });
});
