/**
 * Tests for the shared password service
 *
 * The eligibility matrix here is the single source of truth consumed by the CLI,
 * the self-service endpoint, the admin reset endpoint and the workarea menu, so
 * it is exercised exhaustively.
 */
import { describe, it, expect } from 'bun:test';
import * as bcrypt from 'bcryptjs';
import {
    BCRYPT_COST,
    MIN_PASSWORD_LENGTH,
    hashPassword,
    verifyPassword,
    isPasswordAccount,
    canChangePassword,
    validateNewPassword,
    EXTERNAL_ACCOUNT_MESSAGE,
    PASSWORD_CHANGE_UNAVAILABLE_MESSAGE,
} from './password';

const localAccount = { roles: '["ROLE_USER"]', user_id: null, external_identifier: null };
const guestAccount = { roles: '["ROLE_GUEST"]', user_id: null, external_identifier: null };
const casAccount = { roles: '["ROLE_USER"]', user_id: 'cas:jdoe', external_identifier: null };
const oidcAccount = { roles: '["ROLE_USER"]', user_id: 'oidc:abc-123', external_identifier: null };
const samlAccount = { roles: '["ROLE_USER"]', user_id: null, external_identifier: 'saml:abc-123' };

describe('hashPassword', () => {
    it('produces a bcrypt hash, never the plaintext', async () => {
        const hash = await hashPassword('s3cret-pass');

        expect(hash).not.toBe('s3cret-pass');
        expect(hash).not.toContain('s3cret-pass');
        expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it('uses the project-wide cost factor', async () => {
        const hash = await hashPassword('s3cret-pass');

        expect(BCRYPT_COST).toBe(10);
        expect(hash.split('$')[2]).toBe(String(BCRYPT_COST).padStart(2, '0'));
    });

    it('salts, so the same password hashes differently each time', async () => {
        const first = await hashPassword('s3cret-pass');
        const second = await hashPassword('s3cret-pass');

        expect(first).not.toBe(second);
    });
});

describe('verifyPassword', () => {
    it('accepts the matching password', async () => {
        const hash = await hashPassword('s3cret-pass');

        expect(await verifyPassword('s3cret-pass', hash)).toBe(true);
    });

    it('rejects a different password', async () => {
        const hash = await hashPassword('s3cret-pass');

        expect(await verifyPassword('other-pass', hash)).toBe(false);
    });

    it('verifies hashes produced by the login path (bcryptjs)', async () => {
        const hash = await bcrypt.hash('s3cret-pass', BCRYPT_COST);

        expect(await verifyPassword('s3cret-pass', hash)).toBe(true);
    });

    it('produces hashes the login path accepts (bcryptjs)', async () => {
        const hash = await hashPassword('s3cret-pass');

        expect(await bcrypt.compare('s3cret-pass', hash)).toBe(true);
    });

    it('returns false for empty input instead of throwing', async () => {
        const hash = await hashPassword('s3cret-pass');

        expect(await verifyPassword('', hash)).toBe(false);
        expect(await verifyPassword('s3cret-pass', '')).toBe(false);
        expect(await verifyPassword('s3cret-pass', null)).toBe(false);
        expect(await verifyPassword('s3cret-pass', undefined)).toBe(false);
    });

    it('returns false for a malformed hash instead of throwing', async () => {
        expect(await verifyPassword('s3cret-pass', 'not-a-bcrypt-hash')).toBe(false);
    });
});

describe('isPasswordAccount', () => {
    it('accepts a local account', () => {
        expect(isPasswordAccount(localAccount)).toBe(true);
    });

    it('accepts a local account with extra roles', () => {
        expect(isPasswordAccount({ ...localAccount, roles: '["ROLE_USER","ROLE_ADMIN"]' })).toBe(true);
    });

    it('accepts a local account whose optional identity fields are absent', () => {
        expect(isPasswordAccount({ roles: '["ROLE_USER"]' })).toBe(true);
    });

    it('rejects a guest account even though it has no external identifier', () => {
        expect(isPasswordAccount(guestAccount)).toBe(false);
    });

    it('rejects a CAS account', () => {
        expect(isPasswordAccount(casAccount)).toBe(false);
    });

    it('rejects an OIDC account', () => {
        expect(isPasswordAccount(oidcAccount)).toBe(false);
    });

    it('rejects an account with an external identifier', () => {
        expect(isPasswordAccount(samlAccount)).toBe(false);
    });

    it('treats a whitespace-only identity field as no external identity', () => {
        expect(isPasswordAccount({ roles: '["ROLE_USER"]', user_id: '   ', external_identifier: null })).toBe(true);
    });

    it('rejects null and undefined', () => {
        expect(isPasswordAccount(null)).toBe(false);
        expect(isPasswordAccount(undefined)).toBe(false);
    });

    it('falls back to the identity fields when the roles JSON is malformed', () => {
        // Unparseable roles yield an empty role list, so the account is judged by
        // its identity fields alone.
        expect(isPasswordAccount({ roles: 'not json', user_id: null })).toBe(true);
        expect(isPasswordAccount({ roles: 'not json', user_id: 'cas:x' })).toBe(false);
    });
});

describe('canChangePassword', () => {
    it('is true for a local session backed by a local account', () => {
        expect(
            canChangePassword({
                authMethod: 'local',
                isGuest: false,
                isImpersonated: false,
                offlineMode: false,
                user: localAccount,
            }),
        ).toBe(true);
    });

    it('is true for a local session when the account is not supplied', () => {
        expect(canChangePassword({ authMethod: 'local', isGuest: false, offlineMode: false })).toBe(true);
    });

    it.each([
        ['cas', casAccount],
        ['openid', oidcAccount],
        ['saml', samlAccount],
    ] as const)('is false for a %s session', (authMethod, user) => {
        expect(canChangePassword({ authMethod, isGuest: false, offlineMode: false, user })).toBe(false);
    });

    it('is false for a guest session', () => {
        expect(canChangePassword({ authMethod: 'guest', isGuest: true, offlineMode: false, user: guestAccount })).toBe(
            false,
        );
    });

    it('is false for a guest flagged session that claims local auth', () => {
        expect(canChangePassword({ authMethod: 'local', isGuest: true, offlineMode: false, user: localAccount })).toBe(
            false,
        );
    });

    it('is false in offline/no-auth mode', () => {
        expect(canChangePassword({ authMethod: 'local', isGuest: false, offlineMode: true, user: localAccount })).toBe(
            false,
        );
    });

    it('is false when a locally authenticated admin is impersonating someone', () => {
        // The impersonated token inherits the administrator's authMethod, which is
        // exactly why isImpersonated has to be checked on its own.
        expect(
            canChangePassword({
                authMethod: 'local',
                isGuest: false,
                isImpersonated: true,
                offlineMode: false,
                user: localAccount,
            }),
        ).toBe(false);
    });

    it('is false when the session has no auth method (offline auto-login token)', () => {
        expect(canChangePassword({ isGuest: false, offlineMode: false, user: localAccount })).toBe(false);
    });

    it('is false when the persisted account turns out to be external', () => {
        expect(canChangePassword({ authMethod: 'local', isGuest: false, offlineMode: false, user: casAccount })).toBe(
            false,
        );
    });
});

describe('validateNewPassword', () => {
    it('accepts a password of the minimum length', () => {
        expect(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH))).toEqual({ valid: true });
    });

    it('rejects an empty password', () => {
        const result = validateNewPassword('');

        expect(result.valid).toBe(false);
        expect(result.message).toContain('cannot be empty');
    });

    it('rejects a whitespace-only password', () => {
        const result = validateNewPassword('      ');

        expect(result.valid).toBe(false);
        expect(result.message).toContain('cannot be empty');
    });

    it('rejects a password shorter than the minimum', () => {
        const result = validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH - 1));

        expect(result.valid).toBe(false);
        expect(result.message).toContain(String(MIN_PASSWORD_LENGTH));
    });

    it('rejects non-string input', () => {
        expect(validateNewPassword(undefined).valid).toBe(false);
        expect(validateNewPassword(null).valid).toBe(false);
        expect(validateNewPassword(12345678).valid).toBe(false);
    });
});

describe('messages', () => {
    it('never leak the account type to end users', () => {
        expect(PASSWORD_CHANGE_UNAVAILABLE_MESSAGE).not.toContain('CAS');
        expect(PASSWORD_CHANGE_UNAVAILABLE_MESSAGE).not.toContain('OpenID');
    });

    it('explain the situation for CLI/admin operators', () => {
        expect(EXTERNAL_ACCOUNT_MESSAGE).toContain('external authentication provider');
    });
});
