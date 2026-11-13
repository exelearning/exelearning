/**
 * Tests for session revocation (dependency injection, no mock.module).
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import { SignJWT } from 'jose';
import type { User } from '../db/types';
import { passwordFingerprint, verifyToken } from '../routes/auth';
import { requireAuth, requireAdmin } from '../utils/guards';
import { withJwtAuth } from '../utils/route-auth';
import {
    getSessionRevocationReason,
    sessionRevocationGuard,
    verifySessionToken,
    type SessionRevocationDeps,
} from './session-revocation';

const TEST_SECRET = 'session-revocation-test-secret';
const originalApiJwtSecret = process.env.API_JWT_SECRET;

let users: Map<number, User>;
let lookups: number;

function makeUser(overrides: Partial<User> & { id: number }): User {
    return {
        email: `user${overrides.id}@example.com`,
        user_id: null,
        password: `hash-${overrides.id}`,
        roles: '["ROLE_USER"]',
        is_lopd_accepted: 1,
        quota_mb: null,
        external_identifier: null,
        api_token: null,
        is_active: 1,
        created_at: 0,
        updated_at: 0,
        ...overrides,
    } as User;
}

function deps(): SessionRevocationDeps {
    return {
        db: {} as SessionRevocationDeps['db'],
        findUserById: async (_db, id) => {
            lookups++;
            return users.get(id);
        },
        verifyToken,
    };
}

async function sign(claims: Record<string, unknown>, secret = TEST_SECRET): Promise<string> {
    return new SignJWT(claims)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(new TextEncoder().encode(secret));
}

async function tokenFor(user: User, extra: Record<string, unknown> = {}): Promise<string> {
    return sign({
        sub: user.id,
        email: user.email,
        roles: JSON.parse(user.roles),
        pwh: passwordFingerprint(user.password),
        ...extra,
    });
}

/** App with the guard, echoing what downstream routes receive. */
function echoApp(d = deps()) {
    return new Elysia().use(sessionRevocationGuard(d)).get('/echo', ({ request }) => ({
        authorization: request.headers.get('authorization'),
        cookie: request.headers.get('cookie'),
    }));
}

/** App with the guard in front of real route-auth guards. */
function protectedApp(d = deps()) {
    return new Elysia()
        .use(sessionRevocationGuard(d))
        .use(withJwtAuth())
        .get('/me', ({ jwtPayload, set }) => {
            const err = requireAuth(jwtPayload);
            if (err) {
                set.status = err.status;
                return err;
            }
            return { sub: jwtPayload!.sub };
        })
        .get('/admin', ({ jwtPayload, set }) => {
            const err = requireAdmin(jwtPayload);
            if (err) {
                set.status = err.status;
                return err;
            }
            return { ok: true };
        });
}

const get = (app: { handle: (r: Request) => Promise<Response> }, path: string, headers: Record<string, string> = {}) =>
    app.handle(new Request(`http://localhost${path}`, { headers }));

describe('session revocation', () => {
    beforeEach(() => {
        process.env.API_JWT_SECRET = TEST_SECRET;
        users = new Map([
            [1, makeUser({ id: 1 })],
            [2, makeUser({ id: 2, roles: '["ROLE_USER","ROLE_ADMIN"]' })],
        ]);
        lookups = 0;
    });

    afterEach(() => {
        if (originalApiJwtSecret === undefined) delete process.env.API_JWT_SECRET;
        else process.env.API_JWT_SECRET = originalApiJwtSecret;
    });

    describe('passwordFingerprint', () => {
        it('is stable for a hash and changes with the hash or the secret', () => {
            expect(passwordFingerprint('a')).toBe(passwordFingerprint('a'));
            expect(passwordFingerprint('a')).not.toBe(passwordFingerprint('b'));
            const before = passwordFingerprint('a');
            process.env.API_JWT_SECRET = 'another-secret';
            expect(passwordFingerprint('a')).not.toBe(before);
        });

        it('does not contain the hash and handles a missing password', () => {
            expect(passwordFingerprint('hash-1')).not.toContain('hash-1');
            expect(passwordFingerprint(null)).toBe(passwordFingerprint(''));
            expect(passwordFingerprint(undefined)).toHaveLength(32);
        });
    });

    describe('getSessionRevocationReason', () => {
        const base = (sub: unknown, extra: Record<string, unknown> = {}) =>
            ({ sub, email: 'x', roles: ['ROLE_USER'], ...extra }) as never;

        it('accepts a token that matches the account', async () => {
            const user = users.get(1)!;
            const payload = await verifyToken(await tokenFor(user));
            expect(await getSessionRevocationReason(payload!, deps())).toBeNull();
        });

        it.each([[undefined], [null], [0], [-3], [1.5], ['abc'], [Number.NaN]])(
            'rejects a missing or malformed subject (%p)',
            async sub => {
                expect(await getSessionRevocationReason(base(sub), deps())).toBe('invalid-subject');
                expect(lookups).toBe(0);
            },
        );

        it('accepts a numeric string subject', async () => {
            expect(await getSessionRevocationReason(base('1'), deps())).toBeNull();
        });

        it('rejects a deleted account', async () => {
            users.delete(1);
            expect(await getSessionRevocationReason(base(1), deps())).toBe('user-deleted');
        });

        it('rejects a deactivated account and accepts it again once re-activated', async () => {
            users.get(1)!.is_active = 0;
            expect(await getSessionRevocationReason(base(1), deps())).toBe('user-inactive');
            users.get(1)!.is_active = 1;
            expect(await getSessionRevocationReason(base(1), deps())).toBeNull();
        });

        it('rejects a token signed before a password change', async () => {
            const pwh = passwordFingerprint('hash-1');
            users.get(1)!.password = 'new-hash';
            expect(await getSessionRevocationReason(base(1, { pwh }), deps())).toBe('password-changed');
        });

        it('checks account state only for tokens without a password fingerprint', async () => {
            users.get(1)!.password = 'new-hash';
            expect(await getSessionRevocationReason(base(1), deps())).toBeNull();
        });

        it('rejects a token claiming a role the account lost', async () => {
            users.get(2)!.roles = '["ROLE_USER"]';
            const payload = base(2, { roles: ['ROLE_USER', 'ROLE_ADMIN'] });
            expect(await getSessionRevocationReason(payload, deps())).toBe('role-revoked');
        });

        it('keeps a session when the account only gained roles', async () => {
            users.get(1)!.roles = '["ROLE_USER","ROLE_ADMIN"]';
            expect(await getSessionRevocationReason(base(1), deps())).toBeNull();
        });

        it('treats unreadable stored roles as no roles', async () => {
            users.get(1)!.roles = 'not json';
            expect(await getSessionRevocationReason(base(1), deps())).toBe('role-revoked');
            users.get(1)!.roles = '"ROLE_USER"';
            expect(await getSessionRevocationReason(base(1), deps())).toBe('role-revoked');
            expect(await getSessionRevocationReason(base(1, { roles: undefined }), deps())).toBeNull();
        });

        it('accepts an impersonation token while the administrator is an active admin', async () => {
            expect(await getSessionRevocationReason(base(1, { impersonatedBy: 2 }), deps())).toBeNull();
        });

        it('rejects an impersonation token once the administrator is demoted, deactivated or deleted', async () => {
            const payload = base(1, { impersonatedBy: 2 });
            users.get(2)!.roles = '["ROLE_USER"]';
            expect(await getSessionRevocationReason(payload, deps())).toBe('impersonator-revoked');
            users.get(2)!.roles = '["ROLE_USER","ROLE_ADMIN"]';
            users.get(2)!.is_active = 0;
            expect(await getSessionRevocationReason(payload, deps())).toBe('impersonator-revoked');
            users.delete(2);
            expect(await getSessionRevocationReason(payload, deps())).toBe('impersonator-revoked');
        });
    });

    describe('verifySessionToken', () => {
        it('returns the payload of a valid session', async () => {
            const payload = await verifySessionToken(await tokenFor(users.get(1)!), deps());
            expect(payload?.sub).toBe(1);
        });

        it('rejects a forged token without looking up the account', async () => {
            expect(await verifySessionToken(await sign({ sub: 1 }, 'wrong-secret'), deps())).toBeNull();
            expect(lookups).toBe(0);
        });

        it('rejects a revoked session', async () => {
            const token = await tokenFor(users.get(1)!);
            users.get(1)!.is_active = 0;
            expect(await verifySessionToken(token, deps())).toBeNull();
        });
    });

    describe('sessionRevocationGuard', () => {
        it('leaves a valid cookie and bearer token in place', async () => {
            const token = await tokenFor(users.get(1)!);
            const res = await get(echoApp(), '/echo', { authorization: `Bearer ${token}`, cookie: `auth=${token}` });
            expect(await res.json()).toEqual({ authorization: `Bearer ${token}`, cookie: `auth=${token}` });
        });

        it('removes a revoked auth cookie but keeps the other cookies', async () => {
            const token = await tokenFor(users.get(1)!);
            users.get(1)!.is_active = 0;
            const res = await get(echoApp(), '/echo', { cookie: `locale=es; auth=${token}; theme=dark` });
            expect((await res.json()).cookie).toBe('locale=es; theme=dark');
        });

        it('drops the cookie header when the revoked token was its only cookie', async () => {
            const token = await tokenFor(users.get(1)!);
            users.delete(1);
            const res = await get(echoApp(), '/echo', { cookie: `auth=${token}` });
            expect((await res.json()).cookie).toBeNull();
        });

        it('removes a revoked bearer token', async () => {
            const token = await tokenFor(users.get(1)!);
            users.get(1)!.password = 'reset-by-admin';
            const res = await get(echoApp(), '/echo', { authorization: `Bearer ${token}` });
            expect((await res.json()).authorization).toBeNull();
        });

        it('leaves forged, expired and non-session values for the routes to reject', async () => {
            const forged = await sign({ sub: 1 }, 'wrong-secret');
            const res = await get(echoApp(), '/echo', {
                authorization: 'Basic abc',
                cookie: `auth=${forged}; other=1`,
            });
            expect(await res.json()).toEqual({ authorization: 'Basic abc', cookie: `auth=${forged}; other=1` });
            expect(lookups).toBe(0);
        });

        it('ignores requests without credentials and cookies without a value', async () => {
            const res = await get(echoApp(), '/echo', { cookie: 'auth=; x=1' });
            expect((await res.json()).cookie).toBe('auth=; x=1');
            const other = await get(echoApp(), '/echo', { cookie: 'x=1; flag' });
            expect((await other.json()).cookie).toBe('x=1; flag');
            const none = await get(echoApp(), '/echo');
            expect(await none.json()).toEqual({ authorization: null, cookie: null });
            expect(lookups).toBe(0);
        });

        it('turns a revoked session into an unauthenticated request for real routes', async () => {
            const user = users.get(1)!;
            const token = await tokenFor(user);
            expect((await get(protectedApp(), '/me', { cookie: `auth=${token}` })).status).toBe(200);

            user.is_active = 0;
            expect((await get(protectedApp(), '/me', { cookie: `auth=${token}` })).status).toBe(401);
            expect((await get(protectedApp(), '/me', { authorization: `Bearer ${token}` })).status).toBe(401);
        });

        it('stops a demoted admin from reaching admin routes', async () => {
            const admin = users.get(2)!;
            const token = await tokenFor(admin);
            expect((await get(protectedApp(), '/admin', { cookie: `auth=${token}` })).status).toBe(200);

            admin.roles = '["ROLE_USER"]';
            expect((await get(protectedApp(), '/admin', { cookie: `auth=${token}` })).status).toBe(401);
        });

        it('caches the result per token for a few seconds', async () => {
            const token = await tokenFor(users.get(1)!);
            const app = echoApp();
            const realNow = Date.now;
            let now = realNow();
            Date.now = () => now;
            try {
                await get(app, '/echo', { cookie: `auth=${token}` });
                await get(app, '/echo', { cookie: `auth=${token}` });
                expect(lookups).toBe(1);

                users.get(1)!.is_active = 0;
                now += 6_000;
                const res = await get(app, '/echo', { cookie: `auth=${token}` });
                expect((await res.json()).cookie).toBeNull();
                expect(lookups).toBe(2);
            } finally {
                Date.now = realNow;
            }
        });
    });
});
