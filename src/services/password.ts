/**
 * Password Service
 *
 * Single source of truth for eXeLearning-managed passwords:
 *
 * - hashing/verification (bcrypt, same cost used by local user creation),
 * - whether a *persisted account* owns an eXeLearning password at all
 *   (`isPasswordAccount`), and
 * - whether the *current session* may change it (`canChangePassword`).
 *
 * Password operations must never be reimplemented in routes or CLI commands:
 * CAS/OIDC/SAML/guest accounts also carry a random bcrypt hash in the `password`
 * column, so "the column is not empty" is not an eligibility test.
 */
import * as bcrypt from 'bcryptjs';
import { parseRoles } from '../db/types';
import { ROLES } from '../utils/guards';

/**
 * bcrypt cost factor. Must stay aligned with local user creation
 * (`cli/commands/create-user.ts`, `POST /api/admin/users`).
 */
export const BCRYPT_COST = 10;

/**
 * Minimum length for a new password, aligned with the admin "create user" form
 * and `POST /api/admin/users` (`t.String({ minLength: 4 })`).
 */
export const MIN_PASSWORD_LENGTH = 4;

/**
 * The subset of a persisted user row needed to classify the account.
 * Accepts the full `User` row as well.
 */
export interface PasswordAccountUser {
    roles: string;
    /** External login identifier: `cas:{username}` / `oidc:{subject}`, null for local accounts. */
    user_id?: string | null;
    /** Set by `findOrCreateExternalUser` for externally managed identities. */
    external_identifier?: string | null;
}

/**
 * Everything needed to decide whether the *current session* may change its own
 * password. `user` is the persisted account behind the session, when available.
 */
export interface PasswordSessionContext {
    authMethod?: 'local' | 'cas' | 'openid' | 'saml' | 'guest' | null;
    isGuest?: boolean | null;
    isImpersonated?: boolean | null;
    /** True when the installation runs offline / with authentication disabled. */
    offlineMode?: boolean | null;
    user?: PasswordAccountUser | null;
}

/**
 * Result of validating a candidate new password.
 * `message` is a user-facing, translatable English string.
 */
export interface PasswordValidationResult {
    valid: boolean;
    message?: string;
}

/**
 * Hash a password with bcrypt using the project-wide cost factor.
 */
export async function hashPassword(password: string): Promise<string> {
    return Bun.password.hash(password, {
        algorithm: 'bcrypt',
        cost: BCRYPT_COST,
    });
}

/**
 * Verify a plaintext password against a stored bcrypt hash.
 * Uses the same comparator as the login routes so any hash accepted at login is
 * accepted here. Never throws: a malformed or empty hash simply fails.
 */
export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
    if (!password || !hash) return false;
    try {
        return await bcrypt.compare(password, hash);
    } catch {
        return false;
    }
}

/**
 * Whether a persisted account owns an eXeLearning-managed password.
 *
 * Rejects guests and every externally managed identity (CAS, OIDC, SAML and any
 * provider added later, which all populate `user_id` and/or
 * `external_identifier`). Deliberately does NOT look at the `password` column:
 * external accounts also store a random bcrypt hash there.
 */
export function isPasswordAccount(user: PasswordAccountUser | null | undefined): boolean {
    if (!user) return false;

    // Guests authenticate without a password they know.
    if (parseRoles(user.roles).includes(ROLES.GUEST)) return false;

    // Any external identity marker disqualifies the account.
    if (hasValue(user.user_id)) return false;
    if (hasValue(user.external_identifier)) return false;

    return true;
}

/**
 * Whether the current session may change its own password.
 *
 * True only for a session authenticated with the local password method, that is
 * not a guest, not impersonated, not running in offline/no-auth mode, and whose
 * persisted account is a local password account.
 *
 * Impersonation must be checked explicitly: an impersonated token inherits the
 * administrator's `authMethod`, so `authMethod === 'local'` alone is not enough.
 */
export function canChangePassword(context: PasswordSessionContext): boolean {
    if (context.offlineMode) return false;
    if (context.authMethod !== 'local') return false;
    if (context.isGuest) return false;
    if (context.isImpersonated) return false;
    if (context.user !== undefined && context.user !== null && !isPasswordAccount(context.user)) return false;
    return true;
}

/**
 * Validate a candidate new password against the application's password rules.
 */
export function validateNewPassword(password: unknown): PasswordValidationResult {
    if (typeof password !== 'string' || password.length === 0) {
        return { valid: false, message: 'The new password cannot be empty.' };
    }
    if (password.trim().length === 0) {
        return { valid: false, message: 'The new password cannot be empty.' };
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
        return {
            valid: false,
            message: `The new password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
        };
    }
    return { valid: true };
}

/**
 * Message shown when a password operation is refused because the account is not
 * an eXeLearning password account. Used by the CLI and the admin panel, where
 * the target account is already known to the operator.
 */
export const EXTERNAL_ACCOUNT_MESSAGE =
    'This account uses an external authentication provider and does not have an eXeLearning-managed password.';

/**
 * Message shown to an end user whose session may not change a password.
 * Intentionally vague — it is returned over the public API.
 */
export const PASSWORD_CHANGE_UNAVAILABLE_MESSAGE = 'Password changes are not available for this account.';

function hasValue(field: string | null | undefined): boolean {
    return typeof field === 'string' && field.trim() !== '';
}
