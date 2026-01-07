/**
 * MCP Tools Index Tests
 *
 * Tests for the tools re-exports.
 */
import { describe, it, expect } from 'bun:test';
import {
    registerProjectTools,
    registerPageTools,
    registerBlockTools,
    registerComponentTools,
    registerMetadataTools,
    registerExportTools,
} from './index';

describe('MCP Tools Index', () => {
    it('should export registerProjectTools', () => {
        expect(typeof registerProjectTools).toBe('function');
    });

    it('should export registerPageTools', () => {
        expect(typeof registerPageTools).toBe('function');
    });

    it('should export registerBlockTools', () => {
        expect(typeof registerBlockTools).toBe('function');
    });

    it('should export registerComponentTools', () => {
        expect(typeof registerComponentTools).toBe('function');
    });

    it('should export registerMetadataTools', () => {
        expect(typeof registerMetadataTools).toBe('function');
    });

    it('should export registerExportTools', () => {
        expect(typeof registerExportTools).toBe('function');
    });
});
