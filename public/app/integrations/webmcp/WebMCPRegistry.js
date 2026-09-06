import { AUDIT_EVENTS } from './WebMCPAudit.js';
import { wrapResult } from './validators.js';

/**
 * WebMCPRegistry manages idempotent MCP tool registration using a session model
 * backed by AbortController. Creating a new session automatically aborts and
 * disposes any previous session, making it safe to call init() repeatedly.
 *
 * Usage:
 *   const registry = new WebMCPRegistry({ logger, audit, permissions });
 *   const session = registry.createSession();
 *   registry.registerAll(instance, mode, toolCatalog, handlerMap);
 *   // Later, on teardown or re-init:
 *   registry.disposeSession();
 */
export default class WebMCPRegistry {
    /**
     * @param {object} [options]
     * @param {import('./WebMCPLogger.js').default} [options.logger]
     * @param {import('./WebMCPAudit.js').default}  [options.audit]
     * @param {import('./WebMCPPermissions.js').default} [options.permissions]
     */
    constructor(options = {}) {
        this._logger = options.logger ?? null;
        this._audit = options.audit ?? null;
        this._permissions = options.permissions ?? null;
        this._currentSession = null; // { id, controller, signal, tools: Map }
        this._sessionCounter = 0;
    }

    // -------------------------------------------------------------------------
    // Session lifecycle
    // -------------------------------------------------------------------------

    /**
     * Creates a new registration session, aborting any previous one first.
     * Returns the new session object.
     *
     * @returns {{ id: number, controller: AbortController, signal: AbortSignal, tools: Map }}
     */
    createSession() {
        if (this._currentSession) {
            this.disposeSession();
        }

        this._sessionCounter++;
        const controller = new AbortController();
        this._currentSession = {
            id: this._sessionCounter,
            controller,
            signal: controller.signal,
            tools: new Map(), // name -> { name, description, writes, handler }
        };

        this._logger?.debug(`Registry session #${this._sessionCounter} created`);
        this._audit?.emit(AUDIT_EVENTS.REGISTRATION_STARTED, { sessionId: this._sessionCounter });

        return this._currentSession;
    }

    /**
     * Aborts the current session's AbortController and clears all registered tools.
     * Safe to call when no session is active.
     */
    disposeSession() {
        if (!this._currentSession) return;

        const session = this._currentSession;
        const toolCount = session.tools.size;

        session.controller.abort();
        session.tools.clear();
        this._currentSession = null;

        this._logger?.logDisposal({ sessionId: session.id, toolsRemoved: toolCount });
        this._audit?.emit(AUDIT_EVENTS.DISPOSAL, { sessionId: session.id, toolsRemoved: toolCount });
    }

    // -------------------------------------------------------------------------
    // Tool registration
    // -------------------------------------------------------------------------

    /**
     * Registers a single tool in the current session.
     *
     * The wrapped handler:
     *   1. Returns an error result when the session's AbortSignal is aborted.
     *   2. Checks permissions via the permissions module (when present).
     *   3. Calls the actual handler.
     *   4. Wraps the result in MCP content envelope via wrapResult().
     *   5. Catches errors and wraps them in an error envelope.
     *
     * Registration API differences between modes:
     *   native:    instance.registerTool({ name, description, inputSchema, execute, annotations })
     *   webmcp-js: instance.registerTool(name, description, inputSchema, execute)
     *
     * @param {object} instance  - WebMCP or navigator.modelContext instance
     * @param {'native'|'webmcp-js'} mode
     * @param {{ name: string, description: string, inputSchema: object, writes?: boolean }} definition
     * @param {(args: object) => Promise<unknown>} handler
     * @returns {(args: object) => Promise<object>} - The wrapped execute function
     */
    registerTool(instance, mode, definition, handler) {
        if (!this._currentSession) {
            throw new Error('No active session. Call createSession() first.');
        }

        const session = this._currentSession;
        const {
            name,
            description,
            inputSchema = {},
            writes = false,
            annotations: extraAnnotations = null,
        } = definition;

        const permissions = this._permissions;
        const logger = this._logger;
        const audit = this._audit;

        const execute = async (args) => {
            // 1. Abort check
            if (session.signal.aborted) {
                return wrapResult({ success: false, error: 'Session has been disposed', tool: name }, { isError: true });
            }

            // 2. Permission check
            if (permissions) {
                const { allowed, reason } = permissions.checkPermission(name, { writes });
                if (!allowed) {
                    audit?.emit(AUDIT_EVENTS.TOOL_REJECTED, { tool: name, reason });
                    return wrapResult({ success: false, error: 'Cancelled by user' }, { isError: true });
                }
            }

            // 3. Invoke handler
            const startTime = Date.now();
            try {
                audit?.emit(AUDIT_EVENTS.TOOL_INVOKED, { tool: name, writes });
                const result = await handler(args);
                const duration = Date.now() - startTime;
                audit?.emit(AUDIT_EVENTS.TOOL_COMPLETED, { tool: name, duration });
                logger?.logToolInvocation({ tool: name, writes, duration, success: true });

                // 4. Wrap result — preserve { success, data } envelope for MCP clients
                return wrapResult({ success: true, data: result });
            } catch (error) {
                const duration = Date.now() - startTime;
                const message = String(error?.message || error || 'Unknown error');
                logger?.error(`Tool ${name} failed: ${message}`);
                logger?.logToolInvocation({ tool: name, writes, duration, success: false, error: message });
                audit?.emit(AUDIT_EVENTS.TOOL_COMPLETED, { tool: name, duration, error: message });

                // 5. Wrap error — preserve { success, error } envelope and flag isError per MCP spec
                return wrapResult({ success: false, error: message }, { isError: true });
            }
        };

        // Register on the actual MCP instance.
        // inputSchema may be a raw properties map (from tool catalog) or a full JSON Schema object.
        const isFullSchema = inputSchema.type === 'object' && inputSchema.properties;
        const properties = isFullSchema ? inputSchema.properties : (inputSchema || {});
        const normalizedSchema = {
            type: 'object',
            properties,
            additionalProperties: true,
        };
        if (isFullSchema && Array.isArray(inputSchema.required)) {
            normalizedSchema.required = inputSchema.required;
        }

        // Merge per-tool annotations on top of the default readOnlyHint, so tools
        // can declare destructiveHint / idempotentHint / openWorldHint / untrustedContentHint.
        const annotations = { readOnlyHint: !writes };
        if (extraAnnotations && typeof extraAnnotations === 'object') {
            for (const [key, value] of Object.entries(extraAnnotations)) {
                if (typeof value === 'boolean') {
                    annotations[key] = value;
                }
            }
        }

        if (mode === 'native') {
            // Spec: registerTool(tool, { signal }) — AbortSignal unregisters when aborted.
            instance.registerTool(
                {
                    name,
                    description,
                    inputSchema: normalizedSchema,
                    execute,
                    annotations,
                },
                { signal: session.signal },
            );
        } else {
            // webmcp-js: positional arguments — no signal-based unregister.
            instance.registerTool(name, description, normalizedSchema, execute);
        }

        // Track in session
        session.tools.set(name, { name, description, writes, handler: execute });

        this._logger?.debug(`Registered tool: ${name} (writes=${writes}, mode=${mode})`);

        return execute;
    }

    /**
     * Registers multiple tools from a catalog.
     *
     * @param {object} instance  - WebMCP or navigator.modelContext instance
     * @param {'native'|'webmcp-js'} mode
     * @param {Array<{ name: string, description: string, inputSchema?: object, handlerName: string, writes?: boolean }>} toolCatalog
     * @param {Record<string, (args: object) => Promise<unknown>>} handlerMap
     * @returns {number} Count of tools registered
     */
    registerAll(instance, mode, toolCatalog, handlerMap) {
        let count = 0;
        for (const toolDef of toolCatalog) {
            const handler = handlerMap[toolDef.handlerName];
            if (typeof handler !== 'function') {
                this._logger?.warn(`No handler found for tool "${toolDef.name}" (handlerName="${toolDef.handlerName}")`);
                continue;
            }
            this.registerTool(instance, mode, toolDef, handler);
            count++;
        }

        this._logger?.logRegistration({ sessionId: this._currentSession?.id, toolCount: count });
        this._audit?.emit(AUDIT_EVENTS.REGISTRATION_COMPLETED, {
            sessionId: this._currentSession?.id,
            toolCount: count,
        });

        return count;
    }

    // -------------------------------------------------------------------------
    // Inspection
    // -------------------------------------------------------------------------

    /**
     * Returns metadata for all tools registered in the current session.
     *
     * @returns {Array<{ name: string, description: string, writes: boolean }>}
     */
    getRegisteredTools() {
        if (!this._currentSession) return [];
        return Array.from(this._currentSession.tools.values()).map((t) => ({
            name: t.name,
            description: t.description,
            writes: t.writes,
        }));
    }

    /**
     * Returns true when a session exists and has not been aborted.
     *
     * @returns {boolean}
     */
    hasActiveSession() {
        return this._currentSession !== null && !this._currentSession.controller.signal.aborted;
    }

    /**
     * Returns the current session ID, or null when no session is active.
     *
     * @returns {number|null}
     */
    getSessionId() {
        return this._currentSession?.id ?? null;
    }
}
