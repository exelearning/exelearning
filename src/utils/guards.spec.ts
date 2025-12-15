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
import type { JwtPayload } from '../routes/auth';

// ============================================================================
// TEST DATA
// ============================================================================

const createPayload = (overrides: Partial<JwtPayload> = {}): JwtPayload => ({
    sub: 1,
    email: 'test@example.com',
    roles: ['ROLE_USER'],
    isGuest: false,
    authMethod: 'local',
    ...overrides,
});

const adminPayload = createPayload({ roles: ['ROLE_USER', 'ROLE_ADMIN'] });
const userPayload = createPayload({ roles: ['ROLE_USER'] });
const guestPayload = createPayload({ roles: ['ROLE_GUEST'], isGuest: true });
const multiRolePayload = createPayload({ roles: ['ROLE_USER', 'ROLE_ADMIN', 'ROLE_EDITOR'] });

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
        expect(requireAuth(userPayload)).toBeNull();
    });

    it('should return 401 error for null payload', () => {
        const result = requireAuth(null);
        expect(result).not.toBeNull();
        expect(result?.status).toBe(401);
        expect(result?.error).toBe('UNAUTHORIZED');
    });

    it('should return 401 error for undefined payload', () => {
        const result = requireAuth(undefined);
        expect(result).not.toBeNull();
        expect(result?.status).toBe(401);
    });

    it('should return 401 error for payload without sub', () => {
        const invalidPayload = { ...userPayload, sub: undefined as unknown as number };
        const result = requireAuth(invalidPayload);
        expect(result).not.toBeNull();
        expect(result?.status).toBe(401);
    });
});

// ============================================================================
// requireAdmin TESTS
// ============================================================================

describe('requireAdmin', () => {
    it('should return null for admin user', () => {
        expect(requireAdmin(adminPayload)).toBeNull();
    });

    it('should return 403 error for non-admin user', () => {
        const result = requireAdmin(userPayload);
        expect(result).not.toBeNull();
        expect(result?.status).toBe(403);
        expect(result?.error).toBe('FORBIDDEN');
    });

    it('should return 401 error for null payload', () => {
        const result = requireAdmin(null);
        expect(result).not.toBeNull();
        expect(result?.status).toBe(401);
        expect(result?.error).toBe('UNAUTHORIZED');
    });

    it('should return 401 error for undefined payload', () => {
        const result = requireAdmin(undefined);
        expect(result).not.toBeNull();
        expect(result?.status).toBe(401);
    });

    it('should return 403 error for guest user', () => {
        const result = requireAdmin(guestPayload);
        expect(result).not.toBeNull();
        expect(result?.status).toBe(403);
    });
});

// ============================================================================
// requireAnyRole TESTS
// ============================================================================

describe('requireAnyRole', () => {
    it('should return null when user has one of the required roles', () => {
        expect(requireAnyRole(adminPayload, ['ROLE_ADMIN', 'ROLE_SUPER'])).toBeNull();
    });

    it('should return 403 when user has none of the required roles', () => {
        const result = requireAnyRole(userPayload, ['ROLE_ADMIN', 'ROLE_SUPER']);
        expect(result).not.toBeNull();
        expect(result?.status).toBe(403);
    });

    it('should return 401 for null payload', () => {
        const result = requireAnyRole(null, ['ROLE_ADMIN']);
        expect(result).not.toBeNull();
        expect(result?.status).toBe(401);
    });

    it('should include required roles in error message', () => {
        const result = requireAnyRole(userPayload, ['ROLE_ADMIN', 'ROLE_SUPER']);
        expect(result?.message).toContain('ROLE_ADMIN');
        expect(result?.message).toContain('ROLE_SUPER');
    });
});

// ============================================================================
// isSelfModification TESTS
// ============================================================================

describe('isSelfModification', () => {
    it('should return true when user ID matches target', () => {
        const payload = createPayload({ sub: 5 });
        expect(isSelfModification(payload, 5)).toBe(true);
    });

    it('should return false when user ID does not match target', () => {
        const payload = createPayload({ sub: 5 });
        expect(isSelfModification(payload, 10)).toBe(false);
    });

    it('should return false for null payload', () => {
        expect(isSelfModification(null, 5)).toBe(false);
    });

    it('should return false for undefined payload', () => {
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
        const authError = requireAuth(adminPayload);
        const adminError = requireAdmin(adminPayload);

        expect(authError).toBeNull();
        expect(adminError).toBeNull();
    });

    it('should allow user to access authenticated resources but not admin', () => {
        const authError = requireAuth(userPayload);
        const adminError = requireAdmin(userPayload);

        expect(authError).toBeNull();
        expect(adminError).not.toBeNull();
        expect(adminError?.status).toBe(403);
    });

    it('should detect self-modification for admin removing own role', () => {
        const payload = createPayload({ sub: 10, roles: ['ROLE_USER', 'ROLE_ADMIN'] });
        const isself = isSelfModification(payload, 10);
        const isAdmin = hasRole(payload.roles, ROLES.ADMIN);

        expect(isself).toBe(true);
        expect(isAdmin).toBe(true);
    });

    it('should handle multi-role user correctly', () => {
        expect(hasRole(multiRolePayload.roles, ROLES.USER)).toBe(true);
        expect(hasRole(multiRolePayload.roles, ROLES.ADMIN)).toBe(true);
        expect(hasRole(multiRolePayload.roles, ROLES.EDITOR)).toBe(true);
        expect(hasRole(multiRolePayload.roles, 'ROLE_SUPER')).toBe(false);

        expect(requireAdmin(multiRolePayload)).toBeNull();
    });
});
