import { describe, it, expect } from 'vitest';
import {
    toolCatalog,
    getToolDefinition,
    getToolsByCategory,
    getCategories,
    getReadOnlyTools,
    getWriteTools,
} from './index.js';

describe('Tool Catalog', () => {
    it('contains all 27 tools', () => {
        expect(toolCatalog.length).toBe(27);
    });

    it('every tool has required fields', () => {
        for (const tool of toolCatalog) {
            expect(tool).toHaveProperty('name');
            expect(tool).toHaveProperty('description');
            expect(tool).toHaveProperty('inputSchema');
            expect(tool).toHaveProperty('handlerName');
            expect(typeof tool.writes).toBe('boolean');
            expect(typeof tool.category).toBe('string');
        }
    });

    it('tool names are unique', () => {
        const names = toolCatalog.map((t) => t.name);
        expect(new Set(names).size).toBe(names.length);
    });

    it('handler names are strings', () => {
        for (const tool of toolCatalog) {
            expect(typeof tool.handlerName).toBe('string');
            expect(tool.handlerName.length).toBeGreaterThan(0);
        }
    });

    it('getToolDefinition finds existing tool', () => {
        const tool = getToolDefinition('exe.context.current');
        expect(tool).not.toBeNull();
        expect(tool.handlerName).toBe('getCurrentContext');
    });

    it('getToolDefinition returns null for missing tool', () => {
        expect(getToolDefinition('exe.nonexistent')).toBeNull();
    });

    it('getToolsByCategory returns correct tools', () => {
        const pageTools = getToolsByCategory('pages');
        expect(pageTools.length).toBe(3);
        expect(pageTools.every((t) => t.category === 'pages')).toBe(true);
    });

    it('getCategories returns sorted unique categories', () => {
        const categories = getCategories();
        expect(categories.length).toBeGreaterThan(0);
        const sorted = [...categories].sort();
        expect(categories).toEqual(sorted);
    });

    it('read-only tools have writes=false', () => {
        const readTools = getReadOnlyTools();
        expect(readTools.length).toBe(4); // context, get_metadata, icons.list, assets.list
        expect(readTools.every((t) => t.writes === false)).toBe(true);
    });

    it('write tools have writes=true', () => {
        const writeTools = getWriteTools();
        expect(writeTools.length).toBe(23);
        expect(writeTools.every((t) => t.writes === true)).toBe(true);
    });

    // W3C navigator.modelContext rejects names outside [A-Za-z0-9_.-] or
    // longer than 128 chars with InvalidStateError. Catch this before we hit
    // the browser by enforcing the same constraint on every catalog entry.
    it('every tool name matches the W3C WebMCP regex and length limit', () => {
        const nameRegex = /^[A-Za-z0-9_.-]{1,128}$/;
        for (const tool of toolCatalog) {
            expect(tool.name, `Tool ${tool.name} has invalid name`).toMatch(nameRegex);
        }
    });

    it('every tool description is a non-empty string', () => {
        for (const tool of toolCatalog) {
            expect(typeof tool.description).toBe('string');
            expect(tool.description.trim().length).toBeGreaterThan(0);
        }
    });

    it('every tool exposes a JSON Schema-shaped inputSchema (object with properties)', () => {
        for (const tool of toolCatalog) {
            expect(tool.inputSchema).toBeTypeOf('object');
            expect(tool.inputSchema.type).toBe('object');
            expect(tool.inputSchema.properties).toBeTypeOf('object');
            if (tool.inputSchema.required) {
                expect(Array.isArray(tool.inputSchema.required)).toBe(true);
            }
        }
    });

    it('per-tool annotations are plain boolean flags when present', () => {
        const allowedKeys = new Set([
            'readOnlyHint',
            'destructiveHint',
            'idempotentHint',
            'openWorldHint',
            'untrustedContentHint',
        ]);
        for (const tool of toolCatalog) {
            if (!tool.annotations) continue;
            for (const [key, value] of Object.entries(tool.annotations)) {
                expect(
                    allowedKeys.has(key),
                    `Tool ${tool.name}: annotation "${key}" is not part of the W3C ToolAnnotations set`,
                ).toBe(true);
                expect(typeof value, `Tool ${tool.name}.annotations.${key} must be boolean`).toBe('boolean');
            }
        }
    });

    it('destructive write tools opt-in to destructiveHint', () => {
        const destructive = ['exe.pages.delete', 'exe.components.delete'];
        for (const name of destructive) {
            const tool = getToolDefinition(name);
            expect(tool, `${name} not found`).not.toBeNull();
            expect(tool.annotations?.destructiveHint, `${name} should be destructiveHint:true`).toBe(true);
        }
    });

    it('tools that pull third-party content opt-in to untrustedContentHint', () => {
        const externals = [
            'exe.idevices.text.insert_image_url',
            'exe.idevices.image_gallery.add',
            'exe.assets.import_image_url',
        ];
        for (const name of externals) {
            const tool = getToolDefinition(name);
            expect(tool, `${name} not found`).not.toBeNull();
            expect(tool.annotations?.untrustedContentHint, `${name} should be untrustedContentHint:true`).toBe(true);
        }
    });
});
