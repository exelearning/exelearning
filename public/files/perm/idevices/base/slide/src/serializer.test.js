/**
 * Tests for the Slide iDevice serializer.
 *
 * Pure-logic module — exercised directly via vitest's TypeScript support.
 */

/* eslint-disable no-undef */
import { describe, it, expect } from 'vitest';
import { buildEmptyPayload, buildPayload, isHexColor, parsePrevious } from './serializer.ts';

describe('parsePrevious', () => {
    it('returns blank slide for null', () => {
        const r = parsePrevious(null);
        expect(r.width).toBe(1280);
        expect(r.height).toBe(720);
        expect(r.background).toBe('#ffffff');
        expect(r.fabric).toBeNull();
    });

    it('returns blank slide for undefined', () => {
        expect(parsePrevious(undefined).fabric).toBeNull();
    });

    it('returns blank slide for invalid JSON string', () => {
        expect(parsePrevious('not-json').fabric).toBeNull();
    });

    it('parses a JSON string payload', () => {
        const raw = JSON.stringify({ version: 3, engine: 'fabric', fabric: { objects: [] }, width: 800, height: 600 });
        const r = parsePrevious(raw);
        expect(r.width).toBe(800);
        expect(r.height).toBe(600);
        expect(r.fabric).toEqual({ objects: [] });
    });

    it('only accepts fabric scene when version + engine match', () => {
        const r = parsePrevious({ version: 2, engine: 'fabric', fabric: { objects: [] } });
        expect(r.fabric).toBeNull();
    });

    it('rejects fabric scene from a different engine', () => {
        const r = parsePrevious({ version: 3, engine: 'tldraw', fabric: { objects: [] } });
        expect(r.fabric).toBeNull();
    });

    it('clamps width and height into [MIN, MAX]', () => {
        expect(parsePrevious({ width: 50, height: 50 }).width).toBe(400);
        expect(parsePrevious({ width: 50, height: 50 }).height).toBe(200);
        expect(parsePrevious({ width: 9999, height: 9999 }).width).toBe(1920);
        expect(parsePrevious({ width: 9999, height: 9999 }).height).toBe(1200);
    });

    it('rejects unsafe background colours', () => {
        expect(parsePrevious({ background: 'javascript:alert(1)' }).background).toBe('#ffffff');
        expect(parsePrevious({ background: 'red' }).background).toBe('#ffffff');
    });

    it('accepts valid hex backgrounds (3 and 6 digit)', () => {
        expect(parsePrevious({ background: '#abc' }).background).toBe('#abc');
        expect(parsePrevious({ background: '#a1b2c3' }).background).toBe('#a1b2c3');
    });

    it('does not throw on unexpected future versions', () => {
        expect(() => parsePrevious({ version: 99, engine: 'fabric', fabric: { ok: true } })).not.toThrow();
        expect(parsePrevious({ version: 99, engine: 'fabric', fabric: { ok: true } }).fabric).toBeNull();
    });
});

describe('buildPayload', () => {
    it('produces a stable v3 payload with all required fields', () => {
        const payload = buildPayload({
            ideviceId: 'abc',
            fabric: { objects: [{ type: 'rect' }] },
            svg: '<svg/>',
            width: 1024,
            height: 768,
            background: '#ffeecc',
        });
        expect(payload.version).toBe(3);
        expect(payload.engine).toBe('fabric');
        expect(payload.ideviceId).toBe('abc');
        expect(payload.fabric).toEqual({ objects: [{ type: 'rect' }] });
        expect(payload.svg).toBe('<svg/>');
        expect(payload.width).toBe(1024);
        expect(payload.height).toBe(768);
        expect(payload.background).toBe('#ffeecc');
    });

    it('clamps oversized dimensions', () => {
        const payload = buildPayload({
            ideviceId: 'x',
            fabric: {},
            svg: '',
            width: 99999,
            height: 99999,
            background: '#fff',
        });
        expect(payload.width).toBe(1920);
        expect(payload.height).toBe(1200);
    });

    it('falls back to defaults when fabric/svg are not strings/objects', () => {
        const payload = buildPayload({
            ideviceId: 'x',
            fabric: null,
            svg: null,
            width: 1000,
            height: 600,
            background: 'not-a-color',
        });
        expect(payload.fabric).toEqual({});
        expect(payload.svg).toBe('');
        expect(payload.background).toBe('#ffffff');
    });

    it('coerces non-string ideviceId to empty string', () => {
        const payload = buildPayload({
            ideviceId: 42,
            fabric: {},
            svg: '',
            width: 1280,
            height: 720,
            background: '#fff',
        });
        expect(payload.ideviceId).toBe('');
    });
});

describe('buildEmptyPayload', () => {
    it('returns blank slide with the given idevice id', () => {
        const payload = buildEmptyPayload('idev-1');
        expect(payload.ideviceId).toBe('idev-1');
        expect(payload.fabric).toEqual({});
        expect(payload.svg).toBe('');
        expect(payload.width).toBe(1280);
        expect(payload.height).toBe(720);
        expect(payload.background).toBe('#ffffff');
    });
});

describe('isHexColor', () => {
    it('accepts 3 and 6 digit hex with leading #', () => {
        expect(isHexColor('#abc')).toBe(true);
        expect(isHexColor('#A1B2C3')).toBe(true);
    });

    it('rejects malformed values', () => {
        expect(isHexColor('red')).toBe(false);
        expect(isHexColor('#1234')).toBe(false);
        expect(isHexColor('#12')).toBe(false);
        expect(isHexColor('rgb(0,0,0)')).toBe(false);
        expect(isHexColor('')).toBe(false);
        expect(isHexColor(null)).toBe(false);
    });
});
