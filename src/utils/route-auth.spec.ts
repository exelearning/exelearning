/**
 * Tests for the shared JWT auth helper plugin.
 *
 * Pins the contract that consumers rely on:
 *   - `.derive(jwtPayload)` bubbles out of the plugin (the `.as('scoped')`
 *     in the implementation), so callers can read it on their own routes.
 *   - Token is accepted from `Authorization: Bearer …` and from the `auth`
 *     cookie, falling back to a `null` payload when none is present or the
 *     token cannot be verified.
 */
import { describe, it, expect, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { SignJWT } from 'jose';
import { withJwtAuth } from './route-auth';

const TEST_JWT_SECRET = 'dev_secret_change_me';

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
        app = new Elysia().use(withJwtAuth()).get('/whoami', ({ jwtPayload }) => ({ jwtPayload }));
    });

    it('returns null jwtPayload when no token is present', async () => {
        const res = await app.handle(new Request('http://localhost/whoami'));
        expect(res.status).toBe(200);
        const data = (await res.json()) as { jwtPayload: unknown };
        expect(data.jwtPayload).toBeNull();
    });

    it('returns the decoded payload when the Authorization header carries a valid token', async () => {
        const res = await app.handle(
            new Request('http://localhost/whoami', {
                headers: { Authorization: `Bearer ${token}` },
            }),
        );
        expect(res.status).toBe(200);
        const data = (await res.json()) as { jwtPayload: Record<string, unknown> };
        expect(data.jwtPayload).toMatchObject({ sub: 42, email: 'u42@test.local' });
        expect(data.jwtPayload.roles).toEqual(['ROLE_USER', 'ROLE_ADMIN']);
    });

    it('reads the token from the auth cookie when no Authorization header is set', async () => {
        const res = await app.handle(
            new Request('http://localhost/whoami', {
                headers: { Cookie: `auth=${token}` },
            }),
        );
        expect(res.status).toBe(200);
        const data = (await res.json()) as { jwtPayload: Record<string, unknown> };
        expect(data.jwtPayload).toMatchObject({ sub: 42 });
    });

    it('falls back to null when the token cannot be verified', async () => {
        const res = await app.handle(
            new Request('http://localhost/whoami', {
                headers: { Authorization: 'Bearer not-a-valid-jwt' },
            }),
        );
        expect(res.status).toBe(200);
        const data = (await res.json()) as { jwtPayload: unknown };
        expect(data.jwtPayload).toBeNull();
    });
});
