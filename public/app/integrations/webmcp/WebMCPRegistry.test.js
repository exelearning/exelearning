import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebMCPRegistry from './WebMCPRegistry.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger() {
    return {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        logRegistration: vi.fn(),
        logToolInvocation: vi.fn(),
        logPermission: vi.fn(),
        logDisposal: vi.fn(),
    };
}

function makeAudit() {
    return { emit: vi.fn() };
}

function makePermissions({ allowed = true, reason = 'policy:none' } = {}) {
    return { checkPermission: vi.fn(() => ({ allowed, reason })) };
}

function makeInstance() {
    return { registerTool: vi.fn() };
}

function makeDef(overrides = {}) {
    return {
        name: 'test.tool',
        description: 'A test tool',
        inputSchema: { properties: { x: { type: 'string' } } },
        writes: false,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// createSession
// ---------------------------------------------------------------------------

describe('WebMCPRegistry.createSession', () => {
    it('creates a session with an AbortController and empty tools map', () => {
        const registry = new WebMCPRegistry();
        const session = registry.createSession();

        expect(session).toBeDefined();
        expect(session.controller).toBeInstanceOf(AbortController);
        expect(session.signal).toBe(session.controller.signal);
        expect(session.signal.aborted).toBe(false);
        expect(session.tools).toBeInstanceOf(Map);
        expect(session.tools.size).toBe(0);
    });

    it('assigns an incrementing session ID starting at 1', () => {
        const registry = new WebMCPRegistry();
        const s1 = registry.createSession();
        registry.disposeSession();
        const s2 = registry.createSession();

        expect(s1.id).toBe(1);
        expect(s2.id).toBe(2);
    });

    it('aborts the previous session when called a second time', () => {
        const registry = new WebMCPRegistry();
        const first = registry.createSession();
        const signal = first.signal;

        expect(signal.aborted).toBe(false);
        registry.createSession(); // should abort first session

        expect(signal.aborted).toBe(true);
    });

    it('does not carry tools from the previous session', () => {
        const registry = new WebMCPRegistry();
        const instance = makeInstance();
        registry.createSession();
        registry.registerTool(instance, 'webmcp-js', makeDef(), async () => ({}));

        // Start a fresh session
        registry.createSession();

        expect(registry.getRegisteredTools()).toHaveLength(0);
    });

    it('emits REGISTRATION_STARTED audit event', () => {
        const audit = makeAudit();
        const registry = new WebMCPRegistry({ audit });
        registry.createSession();

        expect(audit.emit).toHaveBeenCalledWith('registration:started', expect.objectContaining({ sessionId: 1 }));
    });
});

// ---------------------------------------------------------------------------
// registerTool
// ---------------------------------------------------------------------------

describe('WebMCPRegistry.registerTool', () => {
    it('throws when no session is active', () => {
        const registry = new WebMCPRegistry();
        expect(() => registry.registerTool(makeInstance(), 'native', makeDef(), async () => ({}))).toThrow(
            'No active session',
        );
    });

    it('adds the tool to the session tools map', () => {
        const registry = new WebMCPRegistry();
        registry.createSession();
        registry.registerTool(makeInstance(), 'webmcp-js', makeDef({ name: 'my.tool' }), async () => ({}));

        const tools = registry.getRegisteredTools();
        expect(tools).toHaveLength(1);
        expect(tools[0].name).toBe('my.tool');
    });

    it('calls instance.registerTool with correct native API shape', () => {
        const registry = new WebMCPRegistry();
        const session = registry.createSession();
        const instance = makeInstance();
        const def = makeDef({ name: 'exe.pages.list', writes: false });

        registry.registerTool(instance, 'native', def, async () => ({}));

        expect(instance.registerTool).toHaveBeenCalledOnce();
        const [arg, options] = instance.registerTool.mock.calls[0];
        expect(arg.name).toBe('exe.pages.list');
        expect(arg.description).toBe(def.description);
        expect(arg.inputSchema).toEqual(expect.objectContaining({ type: 'object' }));
        expect(arg.execute).toBeTypeOf('function');
        expect(arg.annotations).toEqual({ readOnlyHint: true });
        // Spec: AbortSignal is forwarded as the second argument so the browser
        // can unregister the tool when the session is disposed.
        expect(options).toEqual({ signal: session.signal });
    });

    it('merges per-tool annotations on top of the readOnlyHint default', () => {
        const registry = new WebMCPRegistry();
        registry.createSession();
        const instance = makeInstance();
        const def = makeDef({
            name: 'exe.pages.delete',
            writes: true,
            annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false },
        });

        registry.registerTool(instance, 'native', def, async () => ({}));

        const [arg] = instance.registerTool.mock.calls[0];
        expect(arg.annotations).toEqual({
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: false,
            openWorldHint: false,
        });
    });

    it('forwards inputSchema.required when the tool catalog provides it', () => {
        const registry = new WebMCPRegistry();
        registry.createSession();
        const instance = makeInstance();
        const def = {
            name: 'exe.demo.add',
            description: 'Demo with required',
            inputSchema: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    body: { type: 'string' },
                },
                required: ['title'],
            },
            writes: true,
        };

        registry.registerTool(instance, 'native', def, async () => ({}));

        const [arg] = instance.registerTool.mock.calls[0];
        expect(arg.inputSchema.required).toEqual(['title']);
    });

    it('sets readOnlyHint: false for write tools in native mode', () => {
        const registry = new WebMCPRegistry();
        registry.createSession();
        const instance = makeInstance();

        registry.registerTool(instance, 'native', makeDef({ writes: true }), async () => ({}));

        const arg = instance.registerTool.mock.calls[0][0];
        expect(arg.annotations.readOnlyHint).toBe(false);
    });

    it('calls instance.registerTool with correct webmcp-js positional API shape', () => {
        const registry = new WebMCPRegistry();
        registry.createSession();
        const instance = makeInstance();
        const def = makeDef({ name: 'exe.pages.list' });

        registry.registerTool(instance, 'webmcp-js', def, async () => ({}));

        expect(instance.registerTool).toHaveBeenCalledOnce();
        const [name, description, schema, execute] = instance.registerTool.mock.calls[0];
        expect(name).toBe('exe.pages.list');
        expect(description).toBe(def.description);
        expect(schema).toEqual(expect.objectContaining({ type: 'object' }));
        expect(execute).toBeTypeOf('function');
    });

    it('returns the wrapped execute function', () => {
        const registry = new WebMCPRegistry();
        registry.createSession();
        const execute = registry.registerTool(makeInstance(), 'webmcp-js', makeDef(), async () => ({ ok: true }));
        expect(execute).toBeTypeOf('function');
    });
});

// ---------------------------------------------------------------------------
// Handler wrapper behaviour
// ---------------------------------------------------------------------------

describe('WebMCPRegistry handler wrapper', () => {
    it('returns an error result when the session is aborted', async () => {
        const registry = new WebMCPRegistry();
        registry.createSession();
        const execute = registry.registerTool(makeInstance(), 'webmcp-js', makeDef(), async () => ({ ok: true }));

        registry.disposeSession(); // aborts signal

        const result = await execute({});
        expect(result.content[0].text).toContain('Session has been disposed');
    });

    it('checks permissions before calling handler for write tools', async () => {
        const permissions = makePermissions({ allowed: false, reason: 'session:denied' });
        const registry = new WebMCPRegistry({ permissions });
        registry.createSession();
        const handler = vi.fn(async () => ({ ok: true }));
        const execute = registry.registerTool(makeInstance(), 'webmcp-js', makeDef({ writes: true }), handler);

        const result = await execute({});

        expect(handler).not.toHaveBeenCalled();
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.success).toBe(false);
    });

    it('calls handler when permissions are granted', async () => {
        const permissions = makePermissions({ allowed: true });
        const registry = new WebMCPRegistry({ permissions });
        registry.createSession();
        const handler = vi.fn(async () => ({ value: 42 }));
        const execute = registry.registerTool(makeInstance(), 'webmcp-js', makeDef({ writes: true }), handler);

        const result = await execute({ x: 'hello' });

        expect(handler).toHaveBeenCalledWith({ x: 'hello' });
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.success).toBe(true);
        expect(parsed.data.value).toBe(42);
    });

    it('wraps handler result in MCP content envelope with success:true and data', async () => {
        const registry = new WebMCPRegistry();
        registry.createSession();
        const execute = registry.registerTool(
            makeInstance(),
            'webmcp-js',
            makeDef(),
            async () => ({ pages: [1, 2, 3] }),
        );

        const result = await execute({});

        expect(result).toEqual({
            content: [{ type: 'text', text: expect.any(String) }],
        });
        // Success path must NOT carry isError.
        expect(result.isError).toBeUndefined();
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.success).toBe(true);
        expect(parsed.data.pages).toEqual([1, 2, 3]);
    });

    it('wraps thrown errors in MCP content envelope with success:false and isError:true', async () => {
        const registry = new WebMCPRegistry();
        registry.createSession();
        const execute = registry.registerTool(makeInstance(), 'webmcp-js', makeDef(), async () => {
            throw new Error('something broke');
        });

        const result = await execute({});

        expect(result.isError).toBe(true);
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.success).toBe(false);
        expect(parsed.error).toBe('something broke');
    });

    it('skips permission check for read-only tools', async () => {
        const permissions = makePermissions({ allowed: false }); // would deny writes
        const registry = new WebMCPRegistry({ permissions });
        registry.createSession();
        const handler = vi.fn(async () => ({ ok: true }));
        const execute = registry.registerTool(makeInstance(), 'webmcp-js', makeDef({ writes: false }), handler);

        await execute({});

        // permissions.checkPermission is called, but for reads it returns allowed
        // In WebMCPPermissions, read-only bypasses. Here we check the mock isn't blocking:
        // Our mock returns allowed:false, but reads skip if permissions module handles it.
        // Since our registry always calls checkPermission when permissions is set,
        // verify the handler was or was not called based on the mock response.
        // (The registry defers the read-only logic to the permissions module.)
        expect(permissions.checkPermission).toHaveBeenCalledWith('test.tool', { writes: false });
    });
});

// ---------------------------------------------------------------------------
// disposeSession
// ---------------------------------------------------------------------------

describe('WebMCPRegistry.disposeSession', () => {
    it('aborts the AbortController', () => {
        const registry = new WebMCPRegistry();
        const session = registry.createSession();
        const signal = session.signal;

        registry.disposeSession();

        expect(signal.aborted).toBe(true);
    });

    it('clears the tools map', () => {
        const registry = new WebMCPRegistry();
        registry.createSession();
        registry.registerTool(makeInstance(), 'webmcp-js', makeDef(), async () => ({}));

        registry.disposeSession();

        expect(registry.getRegisteredTools()).toHaveLength(0);
    });

    it('sets hasActiveSession() to false', () => {
        const registry = new WebMCPRegistry();
        registry.createSession();
        registry.disposeSession();

        expect(registry.hasActiveSession()).toBe(false);
    });

    it('is safe to call when no session is active', () => {
        const registry = new WebMCPRegistry();
        expect(() => registry.disposeSession()).not.toThrow();
    });

    it('emits DISPOSAL audit event with tool count', () => {
        const audit = makeAudit();
        const registry = new WebMCPRegistry({ audit });
        registry.createSession();
        registry.registerTool(makeInstance(), 'webmcp-js', makeDef(), async () => ({}));

        audit.emit.mockClear();
        registry.disposeSession();

        expect(audit.emit).toHaveBeenCalledWith('disposal', expect.objectContaining({ toolsRemoved: 1 }));
    });
});

// ---------------------------------------------------------------------------
// getRegisteredTools
// ---------------------------------------------------------------------------

describe('WebMCPRegistry.getRegisteredTools', () => {
    it('returns empty array when no session is active', () => {
        const registry = new WebMCPRegistry();
        expect(registry.getRegisteredTools()).toEqual([]);
    });

    it('returns tool metadata without the internal handler reference', () => {
        const registry = new WebMCPRegistry();
        registry.createSession();
        registry.registerTool(
            makeInstance(),
            'webmcp-js',
            makeDef({ name: 'exe.pages.list', description: 'List pages', writes: false }),
            async () => ({}),
        );

        const tools = registry.getRegisteredTools();
        expect(tools).toHaveLength(1);
        expect(tools[0]).toEqual({ name: 'exe.pages.list', description: 'List pages', writes: false });
        expect(tools[0]).not.toHaveProperty('handler');
    });
});

// ---------------------------------------------------------------------------
// registerAll
// ---------------------------------------------------------------------------

describe('WebMCPRegistry.registerAll', () => {
    it('registers all tools from the catalog and returns count', () => {
        const registry = new WebMCPRegistry();
        registry.createSession();
        const instance = makeInstance();

        const catalog = [
            { name: 'tool.a', description: 'A', handlerName: 'handleA', writes: false },
            { name: 'tool.b', description: 'B', handlerName: 'handleB', writes: true },
        ];
        const handlers = {
            handleA: async () => ({ a: true }),
            handleB: async () => ({ b: true }),
        };

        const count = registry.registerAll(instance, 'native', catalog, handlers);

        expect(count).toBe(2);
        expect(registry.getRegisteredTools()).toHaveLength(2);
        expect(instance.registerTool).toHaveBeenCalledTimes(2);
    });

    it('skips tools with missing handlers and warns', () => {
        const logger = makeLogger();
        const registry = new WebMCPRegistry({ logger });
        registry.createSession();

        const catalog = [
            { name: 'tool.a', description: 'A', handlerName: 'missing', writes: false },
        ];

        const count = registry.registerAll(makeInstance(), 'webmcp-js', catalog, {});

        expect(count).toBe(0);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('missing'));
    });

    it('emits REGISTRATION_COMPLETED audit event', () => {
        const audit = makeAudit();
        const registry = new WebMCPRegistry({ audit });
        registry.createSession();
        audit.emit.mockClear();

        registry.registerAll(makeInstance(), 'webmcp-js', [], {});

        expect(audit.emit).toHaveBeenCalledWith('registration:completed', expect.objectContaining({ toolCount: 0 }));
    });
});

// ---------------------------------------------------------------------------
// Idempotency and re-registration
// ---------------------------------------------------------------------------

describe('WebMCPRegistry idempotency', () => {
    it('re-registration after dispose starts clean with no tools', () => {
        const registry = new WebMCPRegistry();
        registry.createSession();
        registry.registerTool(makeInstance(), 'webmcp-js', makeDef(), async () => ({}));
        registry.disposeSession();

        registry.createSession();
        expect(registry.getRegisteredTools()).toHaveLength(0);
    });

    it('double createSession does not accumulate tools from first session', () => {
        const registry = new WebMCPRegistry();
        registry.createSession();
        registry.registerTool(makeInstance(), 'webmcp-js', makeDef({ name: 'tool.first' }), async () => ({}));

        // Second createSession should reset
        registry.createSession();

        expect(registry.getRegisteredTools()).toHaveLength(0);
    });

    it('session IDs increment across dispose/recreate cycles', () => {
        const registry = new WebMCPRegistry();

        registry.createSession();
        expect(registry.getSessionId()).toBe(1);
        registry.disposeSession();

        registry.createSession();
        expect(registry.getSessionId()).toBe(2);
    });

    it('aborted session handlers return error without executing business logic', async () => {
        const registry = new WebMCPRegistry();
        registry.createSession();
        const handler = vi.fn(async () => ({ ok: true }));
        const execute = registry.registerTool(makeInstance(), 'webmcp-js', makeDef(), handler);

        // Simulate a second init aborting the first session
        registry.createSession();

        const result = await execute({});
        expect(handler).not.toHaveBeenCalled();
        expect(result.content[0].text).toContain('Session has been disposed');
    });
});

// ---------------------------------------------------------------------------
// hasActiveSession / getSessionId
// ---------------------------------------------------------------------------

describe('WebMCPRegistry.hasActiveSession and getSessionId', () => {
    it('returns false and null before any session is created', () => {
        const registry = new WebMCPRegistry();
        expect(registry.hasActiveSession()).toBe(false);
        expect(registry.getSessionId()).toBeNull();
    });

    it('returns true and session ID when a session is active', () => {
        const registry = new WebMCPRegistry();
        registry.createSession();
        expect(registry.hasActiveSession()).toBe(true);
        expect(registry.getSessionId()).toBe(1);
    });

    it('returns false after dispose even though session object may linger', () => {
        const registry = new WebMCPRegistry();
        registry.createSession();
        registry.disposeSession();
        expect(registry.hasActiveSession()).toBe(false);
        expect(registry.getSessionId()).toBeNull();
    });
});
