import { beforeEach, describe, expect, it } from 'bun:test';
import { createFrameRegistry, type FrameRegistry } from './frame-registry';

let registry: FrameRegistry;
const windowA = { name: 'a' };
const windowB = { name: 'b' };
const SRC = 'https://lms.example/pkg/index.html';

beforeEach(() => {
    registry = createFrameRegistry();
});

describe('registration', () => {
    it('gives each frame its own handle', () => {
        const a = registry.register(windowA, SRC);
        const b = registry.register(windowB, SRC);
        expect(a).not.toBe(b);
        expect(registry.all()).toHaveLength(2);
    });

    /** Two records for one window would make resolution ambiguous. */
    it('replaces the record when the same window is registered again', () => {
        const first = registry.register(windowA, SRC);
        const second = registry.register(windowA, 'https://lms.example/pkg/other.html');
        expect(second).toBe(first);
        expect(registry.all()).toHaveLength(1);
        expect(registry.get(first)?.contentSrc).toBe('https://lms.example/pkg/other.html');
    });

    it('forgets a frame once unregistered', () => {
        const handle = registry.register(windowA, SRC);
        registry.unregister(handle);
        expect(registry.resolve(windowA)).toBeNull();
        expect(registry.get(handle)).toBeNull();
        expect(registry.all()).toHaveLength(0);
    });
});

describe('resolve — the trust anchor', () => {
    it('resolves a registered window by identity', () => {
        const handle = registry.register(windowA, SRC);
        expect(registry.resolve(windowA)?.handle).toBe(handle);
    });

    it('refuses a window that was never registered', () => {
        registry.register(windowA, SRC);
        expect(registry.resolve(windowB)).toBeNull();
    });

    /**
     * An unaddressed message must not authenticate itself. If a record could ever hold an
     * absent source, a message with no `source` would match it.
     */
    it('refuses an absent sender', () => {
        registry.register(undefined, SRC);
        expect(registry.resolve(undefined)).toBeNull();
        expect(registry.resolve(null)).toBeNull();
    });

    /** Identity, not shape: a look-alike object is not the frame. */
    it('refuses a different object with the same shape', () => {
        registry.register(windowA, SRC);
        expect(registry.resolve({ name: 'a' })).toBeNull();
    });
});

describe('welcome', () => {
    it('starts un-welcomed and flips once welcomed', () => {
        const handle = registry.register(windowA, SRC);
        expect(registry.get(handle)?.welcomed).toBe(false);
        registry.welcome(handle);
        expect(registry.get(handle)?.welcomed).toBe(true);
    });

    it('ignores a handle it does not know', () => {
        expect(() => registry.welcome('frame-999')).not.toThrow();
    });
});

describe('per-frame state', () => {
    it('remembers the overlay rect and the mounted players', () => {
        const handle = registry.register(windowA, SRC);
        registry.setLastRect(handle, { left: 1, top: 2, width: 3, height: 4 });
        registry.setPlayers(handle, [{ id: 'e1', src: 'https://p/1' }]);

        const record = registry.get(handle);
        expect(record?.lastRect).toEqual({ left: 1, top: 2, width: 3, height: 4 });
        expect(record?.players).toEqual([{ id: 'e1', src: 'https://p/1' }]);
    });

    it('keeps state separate per frame', () => {
        const a = registry.register(windowA, SRC);
        const b = registry.register(windowB, SRC);
        registry.setPlayers(a, [{ id: 'e1', src: 'https://p/1' }]);

        expect(registry.get(b)?.players).toEqual([]);
    });

    it('ignores state writes for an unknown handle', () => {
        expect(() => registry.setLastRect('frame-999', null)).not.toThrow();
        expect(() => registry.setPlayers('frame-999', [])).not.toThrow();
    });
});

describe('invalidate — navigation must not inherit a session', () => {
    /**
     * `event.source` survives navigation: the same `contentWindow` can host a different
     * document. Without this, a session granted to one document would remain available to
     * whatever loads next, which is §7.3 of the design brief.
     */
    it('drops the welcome, so the next document must handshake again', () => {
        const handle = registry.register(windowA, SRC);
        registry.welcome(handle);

        registry.invalidate(handle);

        expect(registry.get(handle)?.welcomed).toBe(false);
    });

    it('drops the remembered players and rect', () => {
        const handle = registry.register(windowA, SRC);
        registry.setPlayers(handle, [{ id: 'e1', src: 'https://p/1' }]);
        registry.setLastRect(handle, { left: 1, top: 2, width: 3, height: 4 });

        registry.invalidate(handle);

        expect(registry.get(handle)?.players).toEqual([]);
        expect(registry.get(handle)?.lastRect).toBeNull();
    });

    /** The frame is still a peer — it is the document that changed, not the element. */
    it('keeps the registration and the window identity', () => {
        const handle = registry.register(windowA, SRC);
        registry.invalidate(handle);

        expect(registry.resolve(windowA)?.handle).toBe(handle);
        expect(registry.all()).toHaveLength(1);
    });

    it('takes the new document src when navigation supplies one', () => {
        const handle = registry.register(windowA, SRC);
        registry.invalidate(handle, 'https://lms.example/pkg/page2.html');
        expect(registry.get(handle)?.contentSrc).toBe('https://lms.example/pkg/page2.html');
    });

    it('keeps the previous src when navigation supplies none', () => {
        const handle = registry.register(windowA, SRC);
        registry.invalidate(handle);
        expect(registry.get(handle)?.contentSrc).toBe(SRC);
    });

    it('ignores a handle it does not know', () => {
        expect(() => registry.invalidate('frame-999')).not.toThrow();
    });
});
