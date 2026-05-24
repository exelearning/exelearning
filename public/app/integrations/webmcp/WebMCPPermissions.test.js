import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebMCPPermissions, {
    PERMISSION_POLICIES,
    resolvePolicy,
} from './WebMCPPermissions.js';
import WebMCPAudit, { AUDIT_EVENTS } from './WebMCPAudit.js';

// ---------------------------------------------------------------------------
// resolvePolicy
// ---------------------------------------------------------------------------

describe('resolvePolicy', () => {
    it('normalises per-action aliases', () => {
        expect(resolvePolicy('per-action')).toBe('per_action');
        expect(resolvePolicy('per_action')).toBe('per_action');
        expect(resolvePolicy('PER-ACTION')).toBe('per_action');
        expect(resolvePolicy('PER_ACTION')).toBe('per_action');
    });

    it('normalises none aliases', () => {
        expect(resolvePolicy('none')).toBe('none');
        expect(resolvePolicy('off')).toBe('none');
        expect(resolvePolicy('disabled')).toBe('none');
        expect(resolvePolicy('NONE')).toBe('none');
    });

    it('normalises session aliases', () => {
        expect(resolvePolicy('session')).toBe('session');
        expect(resolvePolicy('once')).toBe('session');
        expect(resolvePolicy('SESSION')).toBe('session');
    });

    it('defaults unknown values to session', () => {
        expect(resolvePolicy('unknown')).toBe('session');
        expect(resolvePolicy('')).toBe('session');
        expect(resolvePolicy(null)).toBe('session');
        expect(resolvePolicy(undefined)).toBe('session');
        expect(resolvePolicy(42)).toBe('session');
    });
});

// ---------------------------------------------------------------------------
// WebMCPPermissions
// ---------------------------------------------------------------------------

describe('WebMCPPermissions', () => {
    beforeEach(() => {
        window.eXeLearning = { config: {} };
        // jsdom does not define window.confirm — install a stub so vi.spyOn works.
        if (typeof window.confirm !== 'function') {
            window.confirm = () => false;
        }
        vi.spyOn(window, 'confirm');
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete window.eXeLearning;
    });

    // -----------------------------------------------------------------------
    // Construction / getPolicy
    // -----------------------------------------------------------------------

    describe('constructor / getPolicy', () => {
        it('defaults to session policy', () => {
            const p = new WebMCPPermissions();
            expect(p.getPolicy()).toBe(PERMISSION_POLICIES.SESSION);
        });

        it('reads policy from options.policy', () => {
            const p = new WebMCPPermissions({ policy: 'none' });
            expect(p.getPolicy()).toBe(PERMISSION_POLICIES.NONE);
        });

        it('reads policy from window config when options.policy is absent', () => {
            window.eXeLearning.config.webmcpWriteConfirmationPolicy = 'per-action';
            const p = new WebMCPPermissions();
            expect(p.getPolicy()).toBe(PERMISSION_POLICIES.PER_ACTION);
        });

        it('options.policy takes precedence over window config', () => {
            window.eXeLearning.config.webmcpWriteConfirmationPolicy = 'per-action';
            const p = new WebMCPPermissions({ policy: 'none' });
            expect(p.getPolicy()).toBe(PERMISSION_POLICIES.NONE);
        });
    });

    // -----------------------------------------------------------------------
    // Read operations always allowed
    // -----------------------------------------------------------------------

    describe('read operations', () => {
        it('always allows non-write calls without prompting', () => {
            const p = new WebMCPPermissions({ policy: 'per_action' });
            const result = p.checkPermission('some.tool', { writes: false });
            expect(result.allowed).toBe(true);
            expect(result.reason).toBe('read-only');
            expect(window.confirm).not.toHaveBeenCalled();
        });

        it('defaults writes to false when option is omitted', () => {
            const p = new WebMCPPermissions({ policy: 'per_action' });
            const result = p.checkPermission('some.tool');
            expect(result.allowed).toBe(true);
            expect(window.confirm).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Policy: none
    // -----------------------------------------------------------------------

    describe('policy: none', () => {
        it('allows write operations without prompting', () => {
            const p = new WebMCPPermissions({ policy: 'none' });
            const result = p.checkPermission('tool.write', { writes: true });
            expect(result.allowed).toBe(true);
            expect(result.reason).toBe('policy:none');
            expect(window.confirm).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Policy: session
    // -----------------------------------------------------------------------

    describe('policy: session', () => {
        it('prompts on the first write call', () => {
            window.confirm.mockReturnValue(true);
            const p = new WebMCPPermissions({ policy: 'session' });

            const result = p.checkPermission('tool.write', { writes: true });

            expect(window.confirm).toHaveBeenCalledTimes(1);
            expect(window.confirm).toHaveBeenCalledWith(
                'Allow MCP write actions for this browser session?',
            );
            expect(result.allowed).toBe(true);
            expect(result.reason).toBe('session:approved');
        });

        it('does not prompt again after session approval', () => {
            window.confirm.mockReturnValue(true);
            const p = new WebMCPPermissions({ policy: 'session' });

            p.checkPermission('tool.write', { writes: true });
            const second = p.checkPermission('another.write', { writes: true });

            expect(window.confirm).toHaveBeenCalledTimes(1);
            expect(second.allowed).toBe(true);
            expect(second.reason).toBe('session:pre-approved');
        });

        it('returns denied when user cancels the session prompt', () => {
            window.confirm.mockReturnValue(false);
            const p = new WebMCPPermissions({ policy: 'session' });

            const result = p.checkPermission('tool.write', { writes: true });

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('session:denied');
            expect(p.isSessionApproved()).toBe(false);
        });

        it('prompts again after resetSession', () => {
            window.confirm.mockReturnValue(true);
            const p = new WebMCPPermissions({ policy: 'session' });

            p.checkPermission('tool.write', { writes: true });
            p.resetSession();
            p.checkPermission('tool.write', { writes: true });

            expect(window.confirm).toHaveBeenCalledTimes(2);
        });
    });

    // -----------------------------------------------------------------------
    // Policy: per_action
    // -----------------------------------------------------------------------

    describe('policy: per_action', () => {
        it('prompts on every write call', () => {
            window.confirm.mockReturnValue(true);
            const p = new WebMCPPermissions({ policy: 'per_action' });

            p.checkPermission('tool.a', { writes: true });
            p.checkPermission('tool.b', { writes: true });

            expect(window.confirm).toHaveBeenCalledTimes(2);
        });

        it('includes the tool name in the prompt', () => {
            window.confirm.mockReturnValue(true);
            const p = new WebMCPPermissions({ policy: 'per_action' });

            p.checkPermission('pages.create', { writes: true });

            expect(window.confirm).toHaveBeenCalledWith(
                'Allow MCP action "pages.create" to modify this project?',
            );
        });

        it('returns denied when user cancels', () => {
            window.confirm.mockReturnValue(false);
            const p = new WebMCPPermissions({ policy: 'per_action' });

            const result = p.checkPermission('tool.write', { writes: true });

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('per-action:denied');
        });
    });

    // -----------------------------------------------------------------------
    // isSessionApproved / resetSession
    // -----------------------------------------------------------------------

    describe('isSessionApproved / resetSession', () => {
        it('starts as false', () => {
            const p = new WebMCPPermissions({ policy: 'session' });
            expect(p.isSessionApproved()).toBe(false);
        });

        it('becomes true after session approval', () => {
            window.confirm.mockReturnValue(true);
            const p = new WebMCPPermissions({ policy: 'session' });
            p.checkPermission('tool', { writes: true });
            expect(p.isSessionApproved()).toBe(true);
        });

        it('resetSession clears approval', () => {
            window.confirm.mockReturnValue(true);
            const p = new WebMCPPermissions({ policy: 'session' });
            p.checkPermission('tool', { writes: true });
            p.resetSession();
            expect(p.isSessionApproved()).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // Per-tool overrides
    // -----------------------------------------------------------------------

    describe('per-tool overrides', () => {
        it('getToolPolicy returns null when no override is set', () => {
            const p = new WebMCPPermissions({ policy: 'session' });
            expect(p.getToolPolicy('tool.write')).toBeNull();
        });

        it('setToolPolicy stores and getToolPolicy retrieves the override', () => {
            const p = new WebMCPPermissions({ policy: 'session' });
            p.setToolPolicy('tool.special', 'none');
            expect(p.getToolPolicy('tool.special')).toBe(PERMISSION_POLICIES.NONE);
        });

        it('override takes precedence over global policy', () => {
            window.confirm.mockReturnValue(true);
            const p = new WebMCPPermissions({ policy: 'per_action' });
            p.setToolPolicy('trusted.tool', 'none');

            const result = p.checkPermission('trusted.tool', { writes: true });

            expect(result.allowed).toBe(true);
            expect(result.reason).toBe('policy:none');
            expect(window.confirm).not.toHaveBeenCalled();
        });

        it('clearToolPolicies removes all overrides', () => {
            const p = new WebMCPPermissions({ policy: 'session' });
            p.setToolPolicy('tool.a', 'none');
            p.setToolPolicy('tool.b', 'none');
            p.clearToolPolicies();

            expect(p.getToolPolicy('tool.a')).toBeNull();
            expect(p.getToolPolicy('tool.b')).toBeNull();
        });

        it('normalises the policy value via resolvePolicy when setting override', () => {
            const p = new WebMCPPermissions({ policy: 'session' });
            p.setToolPolicy('tool.x', 'per-action');
            expect(p.getToolPolicy('tool.x')).toBe(PERMISSION_POLICIES.PER_ACTION);
        });
    });

    // -----------------------------------------------------------------------
    // Audit event emission
    // -----------------------------------------------------------------------

    describe('audit integration', () => {
        it('emits WRITE_PERFORMED when write is approved', () => {
            window.confirm.mockReturnValue(true);
            const audit = new WebMCPAudit();
            const emitSpy = vi.spyOn(audit, 'emit');

            const p = new WebMCPPermissions({ policy: 'session', audit });
            p.checkPermission('tool.write', { writes: true });

            expect(emitSpy).toHaveBeenCalledWith(
                AUDIT_EVENTS.WRITE_PERFORMED,
                expect.objectContaining({ toolName: 'tool.write' }),
            );
        });

        it('emits PERMISSION_DENIED when write is denied', () => {
            window.confirm.mockReturnValue(false);
            const audit = new WebMCPAudit();
            const emitSpy = vi.spyOn(audit, 'emit');

            const p = new WebMCPPermissions({ policy: 'session', audit });
            p.checkPermission('tool.write', { writes: true });

            expect(emitSpy).toHaveBeenCalledWith(
                AUDIT_EVENTS.PERMISSION_DENIED,
                expect.objectContaining({ toolName: 'tool.write' }),
            );
        });

        it('does not emit any audit event for read operations', () => {
            const audit = new WebMCPAudit();
            const emitSpy = vi.spyOn(audit, 'emit');

            const p = new WebMCPPermissions({ policy: 'per_action', audit });
            p.checkPermission('tool.read', { writes: false });

            expect(emitSpy).not.toHaveBeenCalled();
        });

        it('does not emit when no audit instance is provided', () => {
            window.confirm.mockReturnValue(true);
            // Should not throw even without an audit instance.
            const p = new WebMCPPermissions({ policy: 'session' });
            expect(() => p.checkPermission('tool.write', { writes: true })).not.toThrow();
        });
    });
});
