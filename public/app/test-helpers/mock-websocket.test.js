import { describe, it, expect, vi } from 'vitest';
import {
    MockAwareness,
    MockWebsocketProvider,
    MockIndexeddbPersistence,
    decodeAssetMessage,
} from './mock-websocket.js';

describe('mock-websocket helpers', () => {
    it('registers and unregisters awareness listeners', () => {
        const awareness = new MockAwareness();
        const handler = vi.fn();

        awareness.on('change', handler);
        expect(awareness._listeners.change).toHaveLength(1);

        awareness.off('change', handler);
        expect(awareness._listeners.change).toHaveLength(0);
    });

    it('returns awareness states map', () => {
        const awareness = new MockAwareness();
        awareness._states.set(1, { name: 'User' });

        expect(awareness.getStates().get(1)).toEqual({ name: 'User' });
    });

    it('tracks awareness state changes', () => {
        const awareness = new MockAwareness();
        awareness.setLocalState({ name: 'User' });
        awareness.setLocalStateField('status', 'active');

        expect(awareness.getLocalState()).toEqual({ name: 'User', status: 'active' });
    });

    it('fires sync callbacks on provider once', () => {
        vi.useFakeTimers();
        const provider = new MockWebsocketProvider('ws://test', 'room', {}, {});
        const callback = vi.fn();

        provider.once('sync', callback);
        vi.runAllTimers();

        expect(callback).toHaveBeenCalledWith(true);
        vi.useRealTimers();
    });

    it('adds and removes provider listeners', () => {
        const provider = new MockWebsocketProvider('ws://test', 'room', {}, {});
        const handler = vi.fn();

        provider.on('status', handler);
        expect(provider._listeners.status).toHaveLength(1);

        provider.off('status', handler);
        expect(provider._listeners.status).toHaveLength(0);
    });

    it('handles disconnect and destroy calls', () => {
        const provider = new MockWebsocketProvider('ws://test', 'room', {}, {});

        expect(() => provider.disconnect()).not.toThrow();
        expect(() => provider.destroy()).not.toThrow();
    });

    it('fires synced callbacks on indexeddb persistence', () => {
        vi.useFakeTimers();
        const persistence = new MockIndexeddbPersistence('db', {});
        const callback = vi.fn();

        persistence.on('synced', callback);
        vi.runAllTimers();

        expect(callback).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });

    it('supports destroying indexeddb persistence', () => {
        const persistence = new MockIndexeddbPersistence('db', {});

        expect(() => persistence.destroy()).not.toThrow();
    });

    it('decodes asset messages with or without prefix', () => {
        const payload = { ok: true };
        const encoded = new TextEncoder().encode(JSON.stringify(payload));
        const prefixed = new Uint8Array(encoded.length + 1);
        prefixed[0] = 0xff;
        prefixed.set(encoded, 1);

        expect(decodeAssetMessage(prefixed)).toEqual(payload);
        expect(decodeAssetMessage(encoded)).toEqual(payload);
        expect(decodeAssetMessage(JSON.stringify(payload))).toEqual(payload);
    });
});
