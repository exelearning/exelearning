import { AUDIT_EVENTS } from './WebMCPAudit.js';

/**
 * Canonical permission policy values.
 */
export const PERMISSION_POLICIES = {
    SESSION: 'session',      // One confirmation prompt per browser session
    PER_ACTION: 'per_action', // Prompt on every write operation
    NONE: 'none',             // No confirmation required
};

/**
 * Resolves an arbitrary user-supplied policy string to a canonical
 * PERMISSION_POLICIES value, defaulting to 'session'.
 *
 * Accepted aliases:
 *   'per-action' | 'per_action'  → 'per_action'
 *   'none' | 'off' | 'disabled'  → 'none'
 *   'session' | 'once'           → 'session'
 *   anything else                → 'session'
 *
 * @param {unknown} value
 * @returns {'session'|'per_action'|'none'}
 */
export function resolvePolicy(value) {
    if (typeof value !== 'string') {
        return PERMISSION_POLICIES.SESSION;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === 'per-action' || normalized === 'per_action') {
        return PERMISSION_POLICIES.PER_ACTION;
    }
    if (normalized === 'none' || normalized === 'off' || normalized === 'disabled') {
        return PERMISSION_POLICIES.NONE;
    }
    if (normalized === 'session' || normalized === 'once') {
        return PERMISSION_POLICIES.SESSION;
    }
    return PERMISSION_POLICIES.SESSION;
}

/**
 * WebMCPPermissions manages write-confirmation logic for MCP tool invocations.
 *
 * Policy resolution order for a given tool call:
 *   1. Per-tool override (if set via setToolPolicy)
 *   2. Global policy (resolved at construction time from options.policy or config)
 *
 * Read operations (writes: false) are always allowed without a prompt.
 *
 * The class is designed for future extension:
 *   - Per-tool overrides are stored in a Map and checked first.
 *   - The confirmation UI is isolated to one private method (_prompt) so it
 *     can be swapped for a modal in the future without touching policy logic.
 */
export default class WebMCPPermissions {
    /**
     * @param {object} [options]
     * @param {string} [options.policy]   - Policy string; resolved via resolvePolicy().
     *                                      Defaults to window.eXeLearning?.config?.webmcpWriteConfirmationPolicy.
     * @param {import('./WebMCPLogger.js').default} [options.logger]  - Optional logger instance.
     * @param {import('./WebMCPAudit.js').default}  [options.audit]   - Optional audit instance.
     */
    constructor(options = {}) {
        const configPolicy = window.eXeLearning?.config?.webmcpWriteConfirmationPolicy;
        this._policy = resolvePolicy(options.policy ?? configPolicy);
        this._sessionApproved = false;
        this._toolOverrides = new Map(); // toolName -> PERMISSION_POLICIES value
        this._logger = options.logger ?? null;
        this._audit = options.audit ?? null;
    }

    // -------------------------------------------------------------------------
    // Policy accessors
    // -------------------------------------------------------------------------

    /**
     * Returns the active global policy string.
     *
     * @returns {'session'|'per_action'|'none'}
     */
    getPolicy() {
        return this._policy;
    }

    /**
     * Returns true when the session has already been approved (session policy).
     *
     * @returns {boolean}
     */
    isSessionApproved() {
        return this._sessionApproved;
    }

    /**
     * Clears session approval.  Call this on dispose / reinitialisation so a
     * fresh confirmation prompt is shown in the new session.
     */
    resetSession() {
        this._sessionApproved = false;
    }

    // -------------------------------------------------------------------------
    // Permission check
    // -------------------------------------------------------------------------

    /**
     * Determines whether the given tool invocation is allowed, prompting the
     * user if required by the effective policy.
     *
     * @param {string}  toolName
     * @param {object}  [options]
     * @param {boolean} [options.writes=false]  - true when the tool performs a write
     * @returns {{ allowed: boolean, reason: string }}
     */
    checkPermission(toolName, options = {}) {
        const writes = options.writes === true;

        // Read operations are unconditionally allowed.
        if (!writes) {
            return { allowed: true, reason: 'read-only' };
        }

        const effectivePolicy = this._toolOverrides.get(toolName) ?? this._policy;

        let allowed;
        let reason;

        if (effectivePolicy === PERMISSION_POLICIES.NONE) {
            allowed = true;
            reason = 'policy:none';
        } else if (effectivePolicy === PERMISSION_POLICIES.SESSION) {
            if (this._sessionApproved) {
                allowed = true;
                reason = 'session:pre-approved';
            } else {
                allowed = this._prompt(
                    this._t('Allow MCP write actions for this browser session?'),
                );
                if (allowed) {
                    this._sessionApproved = true;
                    reason = 'session:approved';
                } else {
                    reason = 'session:denied';
                }
            }
        } else {
            // PER_ACTION
            // Use a static, translatable template so it matches a catalog key,
            // then substitute the tool name into the (possibly localised) result.
            // Interpolating the tool name before _() would produce a unique
            // string per tool that no catalog entry could ever match.
            const message = this._t('Allow MCP action "%s" to modify this project?').replace(
                '%s',
                toolName,
            );
            allowed = this._prompt(message);
            reason = allowed ? 'per-action:approved' : 'per-action:denied';
        }

        if (this._audit) {
            if (allowed) {
                this._audit.emit(AUDIT_EVENTS.WRITE_PERFORMED, { toolName, reason });
            } else {
                this._audit.emit(AUDIT_EVENTS.PERMISSION_DENIED, { toolName, reason });
            }
        }

        if (this._logger) {
            this._logger.logPermission({ toolName, allowed, reason });
        }

        return { allowed, reason };
    }

    // -------------------------------------------------------------------------
    // Per-tool overrides
    // -------------------------------------------------------------------------

    /**
     * Sets a per-tool policy override.  The override takes precedence over the
     * global policy when checkPermission is called for that tool.
     *
     * @param {string} toolName
     * @param {'session'|'per_action'|'none'} policy
     */
    setToolPolicy(toolName, policy) {
        this._toolOverrides.set(toolName, resolvePolicy(policy));
    }

    /**
     * Returns the per-tool override for the given tool, or null when none is set.
     *
     * @param {string} toolName
     * @returns {'session'|'per_action'|'none'|null}
     */
    getToolPolicy(toolName) {
        return this._toolOverrides.get(toolName) ?? null;
    }

    /**
     * Removes all per-tool policy overrides.
     */
    clearToolPolicies() {
        this._toolOverrides.clear();
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Shows a browser confirmation dialog and returns the user's boolean answer.
     * Extracted so future implementations can replace it with a modal.
     *
     * @param {string} message
     * @returns {boolean}
     */
    _prompt(message) {
        return window.confirm(message);
    }

    /**
     * Localises a UI string when the global `_()` translator is available.
     * Falls back to the original string in environments where it is missing.
     *
     * @param {string} message
     * @returns {string}
     */
    _t(message) {
        if (typeof globalThis._ === 'function') {
            try {
                return globalThis._(message);
            } catch {
                return message;
            }
        }
        return message;
    }
}
