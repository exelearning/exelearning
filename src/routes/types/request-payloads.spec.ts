/**
 * Tests for Request Payload Types
 *
 * These are type-only definitions, so we just verify they compile correctly
 * and can be used for type checking.
 */

import { describe, it, expect } from 'bun:test';
import type { ExportOptionsRequest } from './request-payloads';

describe('Request Payload Types', () => {
    describe('ExportOptionsRequest', () => {
        it('should accept export options', () => {
            const request: ExportOptionsRequest = {
                format: 'scorm12',
                theme: 'base',
                singlePage: false,
            };
            expect(request.format).toBe('scorm12');
        });
    });
});
