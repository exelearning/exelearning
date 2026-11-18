/**
 * Tests for the shared JWT auth helper plugin.
 *
 * Pins the contract that consumers rely on:
 *   - `.derive(identity)` bubbles out of the plugin (the `.as('scoped')`
 *     in the implementation), so callers can read it on their own routes.
 *   - Token is accepted from `Authorization: Bearer …` and from the `auth`
 *     cookie, falling back to a `null` identity when none is present or the
 *     token cannot be verified.
 *   - The raw string `sub` is parsed to the numeric `userId` exactly once,
 *     here at this boundary.
 */
import { describe, it, expect, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { SignJWT } from 'jose';
import { withJwtAuth } from './route-auth';
import { getJwtSecret } from './jwt-secret';

const TEST_JWT_SECRET = getJwtSecret();

async function signToken(sub: number, roles: string[] = ['ROLE_USER']): Promise<string> {
    const secret = new TextEncoder().encode(TEST_JWT_SECRET);
    return new SignJWT({ sub, email: `u${sub}@test.local`, roles })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);
}

describe('withJwtAuth', () => {
    let app: Elysia;
    let token: string;

    beforeAll(async () => {
        token = await signToken(42, ['ROLE_USER', 'ROLE_ADMIN']);
        app = new Elysia().use(withJwtAuth()).get('/whoami', ({ identity }) => ({ identity }));
    });

    it('returns null identity when no token is present', async () => {
        const res = await app.handle(new Request('http://localhost/whoami'));
        expect(res.status).toBe(200);
        const data = (await res.json()) as { identity: unknown };
        expect(data.identity).toBeNull();
    });

    it('returns the authenticated identity when the Authorization header carries a valid token', async () => {
        const res = await app.handle(
            new Request('http://localhost/whoami', {
                headers: { Authorization: `Bearer ${token}` },
            }),
        );
        expect(res.status).toBe(200);
        const data = (await res.json()) as { identity: Record<string, unknown> };
        expect(data.identity).toMatchObject({
            userId: 42,
            email: 'u42@test.local',
            isGuest: false,
        });
        expect(data.identity.roles).toEqual(['ROLE_USER', 'ROLE_ADMIN']);
    });

    it('reads the token from the auth cookie when no Authorization header is set', async () => {
        const res = await app.handle(
            new Request('http://localhost/whoami', {
                headers: { Cookie: `auth=${token}` },
            }),
        );
        expect(res.status).toBe(200);
        const data = (await res.json()) as { identity: Record<string, unknown> };
        expect(data.identity).toMatchObject({ userId: 42 });
    });

    it('falls back to null when the token cannot be verified', async () => {
        const res = await app.handle(
            new Request('http://localhost/whoami', {
                headers: { Authorization: 'Bearer not-a-valid-jwt' },
            }),
        );
        expect(res.status).toBe(200);
        const data = (await res.json()) as { identity: unknown };
        expect(data.identity).toBeNull();
    });

    it('falls back to null when the token has an unusable sub', async () => {
        const secret = new TextEncoder().encode(TEST_JWT_SECRET);
        const badToken = await new SignJWT({ sub: 'not-a-user-id', email: 'x@test.local', roles: ['ROLE_USER'] })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(secret);
        const res = await app.handle(
            new Request('http://localhost/whoami', {
                headers: { Authorization: `Bearer ${badToken}` },
            }),
        );
        expect(res.status).toBe(200);
        const data = (await res.json()) as { identity: unknown };
        expect(data.identity).toBeNull();
    });
});
