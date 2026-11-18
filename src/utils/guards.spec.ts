/**
 * Guards Utility Tests
 * Tests for role-based authorization functions
 */
import { describe, expect, it } from 'bun:test';
import {
    hasRole,
    hasAnyRole,
    hasAllRoles,
    requireAuth,
    requireAdmin,
    requireAnyRole,
    isSelfModification,
    ROLES,
    PROTECTED_ROLE,
} from './guards';
import { toAuthenticatedIdentity } from '../auth/types';
import type { AuthenticatedIdentity } from '../auth/types';

// ============================================================================
// TEST DATA
// ============================================================================

const createIdentity = (overrides: Partial<AuthenticatedIdentity> = {}): AuthenticatedIdentity => ({
    userId: 1,
    email: 'test@example.com',
    roles: ['ROLE_USER'],
    isGuest: false,
    authMethod: 'local',
    ...overrides,
});

const adminIdentity = createIdentity({ roles: ['ROLE_USER', 'ROLE_ADMIN'] });
const userIdentity = createIdentity({ roles: ['ROLE_USER'] });
const guestIdentity = createIdentity({ roles: ['ROLE_GUEST'], isGuest: true });
const multiRoleIdentity = createIdentity({ roles: ['ROLE_USER', 'ROLE_ADMIN', 'ROLE_EDITOR'] });

// ============================================================================
// hasRole TESTS
// ============================================================================

describe('hasRole', () => {
    it('should return true when role is present', () => {
        expect(hasRole(['ROLE_USER', 'ROLE_ADMIN'], 'ROLE_ADMIN')).toBe(true);
    });

    it('should return false when role is not present', () => {
        expect(hasRole(['ROLE_USER'], 'ROLE_ADMIN')).toBe(false);
    });

    it('should return false for undefined roles', () => {
        expect(hasRole(undefined, 'ROLE_ADMIN')).toBe(false);
    });

    it('should return false for null roles', () => {
        expect(hasRole(null, 'ROLE_ADMIN')).toBe(false);
    });

    it('should return false for empty array', () => {
        expect(hasRole([], 'ROLE_ADMIN')).toBe(false);
    });

    it('should be case-sensitive', () => {
        expect(hasRole(['ROLE_ADMIN'], 'role_admin')).toBe(false);
    });
});

// ============================================================================
// hasAnyRole TESTS
// ============================================================================

describe('hasAnyRole', () => {
    it('should return true when user has one of the required roles', () => {
        expect(hasAnyRole(['ROLE_USER', 'ROLE_ADMIN'], ['ROLE_ADMIN', 'ROLE_SUPER'])).toBe(true);
    });

    it('should return true when user has multiple matching roles', () => {
        expect(hasAnyRole(['ROLE_USER', 'ROLE_ADMIN', 'ROLE_EDITOR'], ['ROLE_ADMIN', 'ROLE_EDITOR'])).toBe(true);
    });

    it('should return false when user has none of the required roles', () => {
        expect(hasAnyRole(['ROLE_USER'], ['ROLE_ADMIN', 'ROLE_SUPER'])).toBe(false);
    });

    it('should return false for undefined roles', () => {
        expect(hasAnyRole(undefined, ['ROLE_ADMIN'])).toBe(false);
    });

    it('should return false for empty required roles array', () => {
        expect(hasAnyRole(['ROLE_USER'], [])).toBe(false);
    });
});

// ============================================================================
// hasAllRoles TESTS
// ============================================================================

describe('hasAllRoles', () => {
    it('should return true when user has all required roles', () => {
        expect(hasAllRoles(['ROLE_USER', 'ROLE_ADMIN', 'ROLE_EDITOR'], ['ROLE_ADMIN', 'ROLE_EDITOR'])).toBe(true);
    });

    it('should return false when user is missing a required role', () => {
        expect(hasAllRoles(['ROLE_USER', 'ROLE_ADMIN'], ['ROLE_ADMIN', 'ROLE_EDITOR'])).toBe(false);
    });

    it('should return true for empty required roles array', () => {
        expect(hasAllRoles(['ROLE_USER'], [])).toBe(true);
    });

    it('should return false for undefined roles', () => {
        expect(hasAllRoles(undefined, ['ROLE_ADMIN'])).toBe(false);
    });
});

// ============================================================================
// requireAuth TESTS
// ============================================================================

describe('requireAuth', () => {
    it('should return null for authenticated user', () => {
        expect(requireAuth(userIdentity)).toBeNull();
    });

    it('should return 401 error for null identity', () => {
        const result = requireAuth(null);
        expect(result).not.toBeNull();
        expect(result?.status).toBe(401);
        expect(result?.error).toBe('UNAUTHORIZED');
    });

    it('should return 401 error for undefined identity', () => {
        const result = requireAuth(undefined);
        expect(result).not.toBeNull();
        expect(result?.status).toBe(401);
    });

    it('returns 401 when the token sub could not be parsed at the boundary', () => {
        // `sub: 'not-a-user-id'` never becomes an identity — that check lives
        // in `toAuthenticatedIdentity` (see src/auth/types.spec.ts). Guards
        // only ever see a null identity in that case.
        const payload = { sub: 'not-a-user-id', email: 'x@y.z', roles: ['ROLE_USER'] };
        expect(toAuthenticatedIdentity(payload as never)).toBeNull();
        expect(requireAuth(toAuthenticatedIdentity(payload as never))).not.toBeNull();
    });
});

// ============================================================================
// requireAdmin TESTS
// ============================================================================

describe('requireAdmin', () => {
    it('should return null for admin user', () => {
        expect(requireAdmin(adminIdentity)).toBeNull();
    });

    it('should return 403 error for non-admin user', () => {
        const result = requireAdmin(userIdentity);
        expect(result).not.toBeNull();
        expect(result?.status).toBe(403);
        expect(result?.error).toBe('FORBIDDEN');
    });

    it('should return 401 error for null identity', () => {
        const result = requireAdmin(null);
        expect(result).not.toBeNull();
        expect(result?.status).toBe(401);
        expect(result?.error).toBe('UNAUTHORIZED');
    });

    it('should return 401 error for undefined identity', () => {
        const result = requireAdmin(undefined);
        expect(result).not.toBeNull();
        expect(result?.status).toBe(401);
    });

    it('should return 403 error for guest user', () => {
        const result = requireAdmin(guestIdentity);
        expect(result).not.toBeNull();
        expect(result?.status).toBe(403);
    });
});

// ============================================================================
// requireAnyRole TESTS
// ============================================================================

describe('requireAnyRole', () => {
    it('should return null when user has one of the required roles', () => {
        expect(requireAnyRole(adminIdentity, ['ROLE_ADMIN', 'ROLE_SUPER'])).toBeNull();
    });

    it('should return 403 when user has none of the required roles', () => {
        const result = requireAnyRole(userIdentity, ['ROLE_ADMIN', 'ROLE_SUPER']);
        expect(result).not.toBeNull();
        expect(result?.status).toBe(403);
    });

    it('should return 401 for null identity', () => {
        const result = requireAnyRole(null, ['ROLE_ADMIN']);
        expect(result).not.toBeNull();
        expect(result?.status).toBe(401);
    });

    it('should include required roles in error message', () => {
        const result = requireAnyRole(userIdentity, ['ROLE_ADMIN', 'ROLE_SUPER']);
        expect(result?.message).toContain('ROLE_ADMIN');
        expect(result?.message).toContain('ROLE_SUPER');
    });
});

// ============================================================================
// isSelfModification TESTS
// ============================================================================

describe('isSelfModification', () => {
    it('should return true when user ID matches target', () => {
        const identity = createIdentity({ userId: 5 });
        expect(isSelfModification(identity, 5)).toBe(true);
    });

    it('should return false when user ID does not match target', () => {
        const identity = createIdentity({ userId: 5 });
        expect(isSelfModification(identity, 10)).toBe(false);
    });

    it('should return false for null identity', () => {
        expect(isSelfModification(null, 5)).toBe(false);
    });

    it('should return false for undefined identity', () => {
        expect(isSelfModification(undefined, 5)).toBe(false);
    });
});

// ============================================================================
// CONSTANTS TESTS
// ============================================================================

describe('ROLES constants', () => {
    it('should define USER role', () => {
        expect(ROLES.USER).toBe('ROLE_USER');
    });

    it('should define ADMIN role', () => {
        expect(ROLES.ADMIN).toBe('ROLE_ADMIN');
    });

    it('should define GUEST role', () => {
        expect(ROLES.GUEST).toBe('ROLE_GUEST');
    });

    it('should define EDITOR role', () => {
        expect(ROLES.EDITOR).toBe('ROLE_EDITOR');
    });
});

describe('PROTECTED_ROLE constant', () => {
    it('should be ROLE_USER', () => {
        expect(PROTECTED_ROLE).toBe('ROLE_USER');
    });
});

// ============================================================================
// INTEGRATION SCENARIOS
// ============================================================================

describe('Integration scenarios', () => {
    it('should allow admin to access admin-only resources', () => {
        const authError = requireAuth(adminIdentity);
        const adminError = requireAdmin(adminIdentity);

        expect(authError).toBeNull();
        expect(adminError).toBeNull();
    });

    it('should allow user to access authenticated resources but not admin', () => {
        const authError = requireAuth(userIdentity);
        const adminError = requireAdmin(userIdentity);

        expect(authError).toBeNull();
        expect(adminError).not.toBeNull();
        expect(adminError?.status).toBe(403);
    });

    it('should detect self-modification for admin removing own role', () => {
        const identity = createIdentity({ userId: 10, roles: ['ROLE_USER', 'ROLE_ADMIN'] });
        const isself = isSelfModification(identity, 10);
        const isAdmin = hasRole(identity.roles, ROLES.ADMIN);

        expect(isself).toBe(true);
        expect(isAdmin).toBe(true);
    });

    it('should handle multi-role user correctly', () => {
        expect(hasRole(multiRoleIdentity.roles, ROLES.USER)).toBe(true);
        expect(hasRole(multiRoleIdentity.roles, ROLES.ADMIN)).toBe(true);
        expect(hasRole(multiRoleIdentity.roles, ROLES.EDITOR)).toBe(true);
        expect(hasRole(multiRoleIdentity.roles, 'ROLE_SUPER')).toBe(false);

        expect(requireAdmin(multiRoleIdentity)).toBeNull();
    });
});
