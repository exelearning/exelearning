/**
 * Interfaces and Constants Unit Tests
 */

import { describe, it, expect } from 'bun:test';

import {
    BLOCK_PROPERTY_DEFAULTS,
    COMPONENT_PROPERTY_DEFAULTS,
    PAGE_PROPERTY_DEFAULTS,
    LEGACY_TYPE_ALIASES,
    defaultLogger,
} from './interfaces';

describe('interfaces constants', () => {
    describe('BLOCK_PROPERTY_DEFAULTS', () => {
        it('should have correct default values', () => {
            expect(BLOCK_PROPERTY_DEFAULTS.visibility).toBe('true');
            expect(BLOCK_PROPERTY_DEFAULTS.teacherOnly).toBe('false');
            expect(BLOCK_PROPERTY_DEFAULTS.allowToggle).toBe('true');
            expect(BLOCK_PROPERTY_DEFAULTS.minimized).toBe('false');
            expect(BLOCK_PROPERTY_DEFAULTS.identifier).toBe('');
            expect(BLOCK_PROPERTY_DEFAULTS.cssClass).toBe('');
        });
    });

    describe('COMPONENT_PROPERTY_DEFAULTS', () => {
        it('should have correct default values', () => {
            expect(COMPONENT_PROPERTY_DEFAULTS.visibility).toBe('true');
            expect(COMPONENT_PROPERTY_DEFAULTS.teacherOnly).toBe('false');
            expect(COMPONENT_PROPERTY_DEFAULTS.identifier).toBe('');
            expect(COMPONENT_PROPERTY_DEFAULTS.cssClass).toBe('');
        });
    });

    describe('PAGE_PROPERTY_DEFAULTS', () => {
        it('should have correct default values', () => {
            expect(PAGE_PROPERTY_DEFAULTS.visibility).toBe('true');
            expect(PAGE_PROPERTY_DEFAULTS.highlight).toBe('false');
            expect(PAGE_PROPERTY_DEFAULTS.hidePageTitle).toBe('false');
            expect(PAGE_PROPERTY_DEFAULTS.editableInPage).toBe('false');
            expect(PAGE_PROPERTY_DEFAULTS.titlePage).toBe('');
            expect(PAGE_PROPERTY_DEFAULTS.titleNode).toBe('');
        });
    });

    describe('LEGACY_TYPE_ALIASES', () => {
        it('should map download-package to download-source-file', () => {
            expect(LEGACY_TYPE_ALIASES['download-package']).toBe('download-source-file');
        });
    });

    describe('defaultLogger', () => {
        it('should have log, warn, and error methods', () => {
            expect(typeof defaultLogger.log).toBe('function');
            expect(typeof defaultLogger.warn).toBe('function');
            expect(typeof defaultLogger.error).toBe('function');
        });

        it('should not throw when logging', () => {
            expect(() => defaultLogger.log('test')).not.toThrow();
            expect(() => defaultLogger.warn('test')).not.toThrow();
            expect(() => defaultLogger.error('test')).not.toThrow();
        });
    });
});
