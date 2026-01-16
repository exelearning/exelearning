/**
 * Types and Auth Helpers Tests
 *
 * Tests for authentication helper functions, especially guest rejection.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import * as bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { db, resetClientCacheForTesting } from '../../../db/client';
import { up } from '../../../db/migrations/001_initial';
import { now } from '../../../db/types';
import { createAuthRoutes } from '../../auth';
import { findUserByEmail, findUserById, createUser } from '../../../db/queries';
import { authenticateRequest, errorResponse, successResponse, isAdmin } from './types';

let originalEnv: Record<string, string | undefined>;

const JWT_SECRET = 'test-secret-for-types-tests';

async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
}

describe('API v1 Types and Auth Helpers', () => {
    let userToken: string;
    let guestToken: string;

    beforeAll(async () => {
        originalEnv = {
            APP_AUTH_METHODS: process.env.APP_AUTH_METHODS,
            JWT_SECRET: process.env.JWT_SECRET,
            API_JWT_SECRET: process.env.API_JWT_SECRET,
        };
        process.env.APP_AUTH_METHODS = 'password,guest';
        process.env.JWT_SECRET = JWT_SECRET;
        process.env.API_JWT_SECRET = JWT_SECRET;

        await resetClientCacheForTesting();
        await up(db);

        // Create test user
        const hashedPw = await hashPassword('password');
        await db
            .insertInto('users')
            .values({
                email: 'typestest@test.com',
                user_id: 'types-test-user',
                password: hashedPw,
                roles: '["ROLE_USER"]',
                is_lopd_accepted: 1,
                is_active: 1,
                created_at: now(),
                updated_at: now(),
            })
            .executeTakeFirst();

        // Get regular user token via login
        const authDeps = {
            db,
            queries: { findUserByEmail, findUserById, createUser },
        };
        const app = new Elysia().use(createAuthRoutes(authDeps));

        const response = await app.handle(
            new Request('http://localhost/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'typestest@test.com', password: 'password' }),
            }),
        );
        const data = (await response.json()) as { access_token: string };
        userToken = data.access_token;

        // Create guest token manually using jose
        const secret = new TextEncoder().encode(JWT_SECRET);
        guestToken = await new SignJWT({
            email: 'guest-test@exelearning.net',
            roles: ['ROLE_USER'],
            isGuest: true,
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setSubject('999')
            .setExpirationTime('1d')
            .sign(secret);
    });

    afterAll(async () => {
        for (const [key, value] of Object.entries(originalEnv)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        await resetClientCacheForTesting();
    });

    describe('authenticateRequest', () => {
        it('should return error for missing Authorization header', async () => {
            const result = await authenticateRequest({});

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.status).toBe(401);
                expect(result.response.error.code).toBe('UNAUTHORIZED');
            }
        });

        it('should return error for malformed Authorization header', async () => {
            const result = await authenticateRequest({
                authorization: 'InvalidHeader',
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.status).toBe(401);
                expect(result.response.error.code).toBe('UNAUTHORIZED');
            }
        });

        it('should return error for invalid JWT token', async () => {
            const result = await authenticateRequest({
                authorization: 'Bearer invalid-token',
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.status).toBe(401);
                expect(result.response.error.code).toBe('UNAUTHORIZED');
            }
        });

        it('should return success for valid user token', async () => {
            const result = await authenticateRequest({
                authorization: `Bearer ${userToken}`,
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.user.email).toBe('typestest@test.com');
                expect(result.user.isGuest).toBe(false);
            }
        });

        it('should return 403 FORBIDDEN for guest token', async () => {
            const result = await authenticateRequest({
                authorization: `Bearer ${guestToken}`,
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.status).toBe(403);
                expect(result.response.error.code).toBe('FORBIDDEN');
                expect(result.response.error.message).toContain('guest');
            }
        });
    });

    describe('errorResponse', () => {
        it('should create error response object', () => {
            const result = errorResponse('TEST_ERROR', 'Test message');

            expect(result.success).toBe(false);
            expect(result.error.code).toBe('TEST_ERROR');
            expect(result.error.message).toBe('Test message');
        });

        it('should include details when provided', () => {
            const result = errorResponse('TEST_ERROR', 'Test message', { field: 'value' });

            expect(result.error.details).toEqual({ field: 'value' });
        });
    });

    describe('successResponse', () => {
        it('should create success response object', () => {
            const result = successResponse({ id: 1, name: 'Test' });

            expect(result.success).toBe(true);
            expect(result.data).toEqual({ id: 1, name: 'Test' });
        });
    });

    describe('isAdmin', () => {
        it('should return true for admin user', () => {
            const result = isAdmin({
                userId: 1,
                email: 'admin@test.com',
                roles: ['ROLE_USER', 'ROLE_ADMIN'],
                isGuest: false,
            });

            expect(result).toBe(true);
        });

        it('should return false for non-admin user', () => {
            const result = isAdmin({
                userId: 1,
                email: 'user@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
            });

            expect(result).toBe(false);
        });

        it('should return false for user with no roles', () => {
            const result = isAdmin({
                userId: 1,
                email: 'user@test.com',
                roles: [],
                isGuest: false,
            });

            expect(result).toBe(false);
        });
    });
});
