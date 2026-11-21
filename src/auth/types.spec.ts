/**
 * Tests for the canonical auth types and the single JWT `sub` parsing
 * boundary (`toAuthenticatedIdentity` / `userIdFromJwt`).
 */
import { describe, expect, it } from 'bun:test';
import { toAuthenticatedIdentity, userIdFromJwt, type JwtPayload } from './types';

const createPayload = (overrides: Partial<JwtPayload> = {}): JwtPayload => ({
    sub: '1',
    email: 'test@example.com',
    roles: ['ROLE_USER'],
    isGuest: false,
    authMethod: 'local',
    ...overrides,
});

describe('userIdFromJwt', () => {
    it('parses a string sub to a positive number', () => {
        expect(userIdFromJwt({ sub: '42' })).toBe(42);
        expect(userIdFromJwt({ sub: ' 42 ' })).toBe(42);
        expect(userIdFromJwt({ sub: '1' })).toBe(1);
    });

    it('accepts a numeric sub from older tokens', () => {
        expect(userIdFromJwt({ sub: 42 })).toBe(42);
        expect(userIdFromJwt({ sub: 1 })).toBe(1);
    });

    it('rejects zero and negative numbers', () => {
        expect(userIdFromJwt({ sub: 0 })).toBeNull();
        expect(userIdFromJwt({ sub: '0' })).toBeNull();
        expect(userIdFromJwt({ sub: -5 })).toBeNull();
        expect(userIdFromJwt({ sub: '-5' })).toBeNull();
    });

    it('rejects floats, exponents, and hex strings', () => {
        expect(userIdFromJwt({ sub: '1.5' })).toBeNull();
        expect(userIdFromJwt({ sub: 1.5 })).toBeNull();
        expect(userIdFromJwt({ sub: '1e3' })).toBeNull();
        expect(userIdFromJwt({ sub: '0x10' })).toBeNull();
    });

    it('returns null for missing, empty, or non-numeric sub', () => {
        expect(userIdFromJwt(null)).toBeNull();
        expect(userIdFromJwt(undefined)).toBeNull();
        expect(userIdFromJwt({})).toBeNull();
        expect(userIdFromJwt({ sub: '' })).toBeNull();
        expect(userIdFromJwt({ sub: '   ' })).toBeNull();
        expect(userIdFromJwt({ sub: 'abc' })).toBeNull();
        expect(userIdFromJwt({ sub: '42abc' })).toBeNull();
        expect(userIdFromJwt({ sub: NaN })).toBeNull();
        expect(userIdFromJwt({ sub: Infinity })).toBeNull();
    });
});

describe('toAuthenticatedIdentity', () => {
    it('maps a valid payload to a full identity', () => {
        const identity = toAuthenticatedIdentity(
            createPayload({
                sub: '42',
                email: 'u42@test.local',
                roles: ['ROLE_USER', 'ROLE_ADMIN'],
                isImpersonated: true,
                impersonatedBy: 7,
                impersonationSessionId: 'session-1',
            }),
        );
        expect(identity).toEqual({
            userId: 42,
            email: 'u42@test.local',
            roles: ['ROLE_USER', 'ROLE_ADMIN'],
            isGuest: false,
            authMethod: 'local',
            isImpersonated: true,
            impersonatedBy: 7,
            impersonationSessionId: 'session-1',
        });
    });

    it('normalises missing optional fields', () => {
        const identity = toAuthenticatedIdentity({ sub: '3', email: 'a@b.c', roles: [] });
        expect(identity).toEqual({
            userId: 3,
            email: 'a@b.c',
            roles: [],
            isGuest: false,
            authMethod: undefined,
            isImpersonated: undefined,
            impersonatedBy: undefined,
            impersonationSessionId: undefined,
        });
        expect(identity?.isGuest).toBe(false);
    });

    it('marks guest identities', () => {
        expect(toAuthenticatedIdentity(createPayload({ isGuest: true }))?.isGuest).toBe(true);
        expect(toAuthenticatedIdentity(createPayload({ isGuest: false }))?.isGuest).toBe(false);
    });

    it('coerces a non-array roles field to an empty array', () => {
        const payload = createPayload({ roles: 'ROLE_ADMIN' as unknown as string[] });
        expect(toAuthenticatedIdentity(payload)?.roles).toEqual([]);
    });

    it('returns null when sub cannot be parsed to a user id', () => {
        expect(toAuthenticatedIdentity(null)).toBeNull();
        expect(toAuthenticatedIdentity(undefined)).toBeNull();
        expect(toAuthenticatedIdentity(createPayload({ sub: 'not-a-user-id' }))).toBeNull();
        expect(toAuthenticatedIdentity(createPayload({ sub: '' }))).toBeNull();
        expect(toAuthenticatedIdentity(createPayload({ sub: '-5' }))).toBeNull();
    });
});
