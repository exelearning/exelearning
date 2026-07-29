import { describe, expect, it } from 'bun:test';
import {
    EMBED_CHILD_ACTIONS,
    EMBED_HOST_ACTIONS,
    EMBED_TYPE,
    MEDIA_COMMANDS,
    MEDIA_EVENTS,
    MEDIA_TYPE,
    PROTOCOL_VERSION,
    isEmbedChildAction,
    isEmbedHostAction,
    isMediaCommand,
    isMediaEvent,
} from './messages';

describe('protocol vocabulary', () => {
    it('keeps the wire namespaces the shipped runtimes already use', () => {
        // Changing either string breaks every deployed package silently, so they are
        // pinned here rather than left to a refactor.
        expect(EMBED_TYPE).toBe('exe-embed');
        expect(MEDIA_TYPE).toBe('exe-media');
        expect(PROTOCOL_VERSION).toBe(1);
    });

    it('separates the two directions of the embed handshake', () => {
        expect([...EMBED_CHILD_ACTIONS]).toEqual(['hello', 'sync']);
        expect([...EMBED_HOST_ACTIONS]).toEqual(['welcome', 'request']);
        // No action may be legal in both directions: 'welcome' is what unlocks
        // promotion, so a child able to send it could unlock itself (ADR-0017).
        const overlap = EMBED_CHILD_ACTIONS.filter(a => (EMBED_HOST_ACTIONS as readonly string[]).includes(a));
        expect(overlap).toEqual([]);
    });

    it('publishes closed command and event enums', () => {
        expect(MEDIA_COMMANDS).toContain('play');
        expect(MEDIA_COMMANDS).toContain('getDuration');
        expect(MEDIA_EVENTS).toContain('timeupdate');
        expect(new Set(MEDIA_COMMANDS).size).toBe(MEDIA_COMMANDS.length);
        expect(new Set(MEDIA_EVENTS).size).toBe(MEDIA_EVENTS.length);
    });
});

describe('type guards', () => {
    it('accepts only members of its own enum', () => {
        expect(isEmbedChildAction('hello')).toBe(true);
        expect(isEmbedChildAction('welcome')).toBe(false);
        expect(isEmbedHostAction('welcome')).toBe(true);
        expect(isEmbedHostAction('hello')).toBe(false);
        expect(isMediaCommand('seek')).toBe(true);
        expect(isMediaCommand('ready')).toBe(false);
        expect(isMediaEvent('ready')).toBe(true);
        expect(isMediaEvent('seek')).toBe(false);
    });

    it('rejects non-strings rather than coercing them', () => {
        for (const guard of [isEmbedChildAction, isEmbedHostAction, isMediaCommand, isMediaEvent]) {
            expect(guard(undefined)).toBe(false);
            expect(guard(null)).toBe(false);
            expect(guard(1)).toBe(false);
            expect(guard({})).toBe(false);
            // Inherited Object members must not be mistaken for enum members.
            expect(guard('toString')).toBe(false);
            expect(guard('constructor')).toBe(false);
        }
    });
});
