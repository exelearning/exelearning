import { describe, it, expect } from 'bun:test';
import {
    CLIENT_EVENT_TYPES,
    SERVER_EVENT_TYPES,
    allowedDetailKeysFor,
    getEventProvenance,
    isClientEventType,
    isProjectActivityEventType,
    isServerEventType,
    isTargetType,
    resolveSaveKind,
    saveEventTypeFor,
} from './events';

describe('project activity taxonomy', () => {
    it('keeps server and client codes disjoint', () => {
        const server = new Set<string>(SERVER_EVENT_TYPES);
        for (const type of CLIENT_EVENT_TYPES) {
            expect(server.has(type)).toBe(false);
        }
    });

    it('classifies provenance from the code', () => {
        expect(getEventProvenance('save.manual')).toBe('server');
        expect(getEventProvenance('access.collaborator_added')).toBe('server');
        expect(getEventProvenance('page.edited')).toBe('client');
        expect(getEventProvenance('unknown.code')).toBe('client');
        expect(isServerEventType('session.opened')).toBe(true);
        expect(isClientEventType('session.opened')).toBe(false);
        expect(isClientEventType('import.elpx')).toBe(true);
        expect(isProjectActivityEventType('idevice.moved')).toBe(true);
        expect(isProjectActivityEventType('nope')).toBe(false);
    });

    it('validates target types', () => {
        expect(isTargetType('page')).toBe(true);
        expect(isTargetType('user')).toBe(true);
        expect(isTargetType('asset')).toBe(false);
    });

    it('returns allow-listed detail keys per family', () => {
        expect(allowedDetailKeysFor('page.moved')).toContain('toParentId');
        expect(allowedDetailKeysFor('idevice.created')).toContain('ideviceType');
        expect(allowedDetailKeysFor('import.elpx')).toContain('components');
        expect(allowedDetailKeysFor('weird.thing')).toEqual([]);
    });

    describe('resolveSaveKind', () => {
        it('accepts the validated header values case-insensitively', () => {
            expect(resolveSaveKind('manual', false)).toBe('manual');
            expect(resolveSaveKind('Collaborative-Autosave', true)).toBe('collaborative-autosave');
            expect(resolveSaveKind(' unload ', true)).toBe('unload');
        });

        it('falls back to the legacy markSaved mapping for absent or invalid headers', () => {
            expect(resolveSaveKind(undefined, true)).toBe('manual');
            expect(resolveSaveKind(null, false)).toBe('unload');
            expect(resolveSaveKind('autosave', true)).toBe('manual');
            expect(resolveSaveKind('<script>', false)).toBe('unload');
        });

        it('maps kinds to event codes', () => {
            expect(saveEventTypeFor('manual')).toBe('save.manual');
            expect(saveEventTypeFor('collaborative-autosave')).toBe('save.autosave');
            expect(saveEventTypeFor('unload')).toBe('save.unload');
        });
    });
});
