/**
 * Tests for SRT -> WebVTT subtitle conversion (issue #2034).
 *
 * Native <video><track> only understands WebVTT. Text iDevice video subtitles
 * are attached as raw .srt files, which produce zero cues in the browser's
 * native track engine. These tests define the contract for the isomorphic
 * converter used by the export/preview pipeline (see BaseExporter.spec.ts
 * for the pipeline-level integration tests).
 */
import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { convertSrtToVtt, isWebVtt } from './srt-to-vtt';

const FIXTURES_DIR = join(import.meta.dir, '..', '..', '..', 'test', 'fixtures', 'subtitles');

describe('isWebVtt', () => {
    it('detects a WEBVTT header', () => {
        expect(isWebVtt('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n')).toBe(true);
    });

    it('detects a WEBVTT header preceded by a UTF-8 BOM', () => {
        expect(isWebVtt('﻿WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n')).toBe(true);
    });

    it('returns false for raw SRT content', () => {
        expect(isWebVtt('1\n00:00:01,000 --> 00:00:02,000\nHi\n')).toBe(false);
    });

    it('returns false for empty content', () => {
        expect(isWebVtt('')).toBe(false);
    });
});

describe('convertSrtToVtt', () => {
    it('adds a WEBVTT header to the output', () => {
        const srt = '1\n00:00:01,000 --> 00:00:02,500\nHello world\n';
        const result = convertSrtToVtt(srt);
        expect(result.error).toBeUndefined();
        expect(result.vtt.startsWith('WEBVTT')).toBe(true);
    });

    it('converts a comma-decimal cue timestamp to a dot-decimal WebVTT timestamp', () => {
        const srt = '1\n00:00:01,000 --> 00:00:02,500\nHello world\n';
        const result = convertSrtToVtt(srt);
        expect(result.vtt).toContain('00:00:01.000 --> 00:00:02.500');
        expect(result.vtt).not.toContain('00:00:01,000');
        expect(result.vtt).not.toContain('00:00:02,500');
    });

    it('preserves the cue text', () => {
        const srt = '1\n00:00:01,000 --> 00:00:02,500\nHello world\n';
        const result = convertSrtToVtt(srt);
        expect(result.vtt).toContain('Hello world');
    });

    it('handles multi-cue files, preserving cue order, indices, and per-cue text', () => {
        const srt =
            '1\n00:00:01,000 --> 00:00:02,000\nFirst cue\n\n' + '2\n00:00:03,000 --> 00:00:04,500\nSecond cue\n';
        const result = convertSrtToVtt(srt);

        const firstIndex = result.vtt.indexOf('First cue');
        const secondIndex = result.vtt.indexOf('Second cue');
        expect(firstIndex).toBeGreaterThan(-1);
        expect(secondIndex).toBeGreaterThan(-1);
        expect(firstIndex).toBeLessThan(secondIndex);

        expect(result.vtt).toContain('00:00:01.000 --> 00:00:02.000');
        expect(result.vtt).toContain('00:00:03.000 --> 00:00:04.500');
    });

    it('preserves UTF-8 / accented, non-ASCII text (Spanish fixture content)', () => {
        const srt =
            '1\n00:00:02,360 --> 00:00:05,760\nEste es un vídeo de prueba para\nprobar los subtítulos en EXeLearning.\n';
        const result = convertSrtToVtt(srt);

        expect(result.vtt).toContain('Este es un vídeo de prueba para');
        expect(result.vtt).toContain('probar los subtítulos en EXeLearning.');
        expect(result.vtt).toContain('00:00:02.360 --> 00:00:05.760');
    });

    it('converts the real issue #2034 fixture (test-subtitle.srt) correctly', () => {
        const srt = readFileSync(join(FIXTURES_DIR, 'test-subtitle.srt'), 'utf-8');
        const result = convertSrtToVtt(srt);

        expect(result.error).toBeUndefined();
        expect(result.vtt.startsWith('WEBVTT')).toBe(true);
        expect(result.vtt).toContain('00:00:02.360 --> 00:00:05.760');
        expect(result.vtt).not.toContain(',360');
        expect(result.vtt).not.toContain(',760');
        expect(result.vtt).toContain('vídeo');
        expect(result.vtt).toContain('subtítulos');
    });

    it('handles CRLF line endings without corrupting timestamps or text', () => {
        const srt = '1\r\n00:00:01,000 --> 00:00:02,000\r\nHello\r\nWorld\r\n';
        const result = convertSrtToVtt(srt);

        expect(result.error).toBeUndefined();
        expect(result.vtt).toContain('00:00:01.000 --> 00:00:02.000');
        expect(result.vtt).toContain('Hello');
        expect(result.vtt).toContain('World');
    });

    it('handles LF line endings without corrupting timestamps or text', () => {
        const srt = '1\n00:00:01,000 --> 00:00:02,000\nHello\nWorld\n';
        const result = convertSrtToVtt(srt);

        expect(result.error).toBeUndefined();
        expect(result.vtt).toContain('00:00:01.000 --> 00:00:02.000');
        expect(result.vtt).toContain('Hello');
        expect(result.vtt).toContain('World');
    });

    it('strips a leading UTF-8 BOM before conversion', () => {
        const srt = '﻿1\n00:00:01,000 --> 00:00:02,000\nHello\n';
        const result = convertSrtToVtt(srt);

        expect(result.error).toBeUndefined();
        expect(result.vtt.charCodeAt(0)).not.toBe(0xfeff);
        expect(result.vtt.startsWith('WEBVTT')).toBe(true);
    });

    it('passes already-valid WebVTT content through without mangling it', () => {
        const vtt = readFileSync(join(FIXTURES_DIR, 'test-subtitle.vtt'), 'utf-8');
        const result = convertSrtToVtt(vtt);

        expect(result.error).toBeUndefined();
        expect(result.converted).toBe(false);
        expect(result.vtt).toContain('WEBVTT');
        expect(result.vtt).toContain('00:00:02.360 --> 00:00:05.760');
        expect(result.vtt).toContain('vídeo');
    });

    it('does not throw on malformed / non-subtitle input', () => {
        const malformed = 'this is not a subtitle file at all, just some garbage text\nwith no timestamps';
        expect(() => convertSrtToVtt(malformed)).not.toThrow();

        const result = convertSrtToVtt(malformed);
        // Contract: malformed input must degrade gracefully -- either a
        // reported error, or an empty/near-empty (but still valid) VTT
        // document. It must never throw an unhandled exception.
        expect(result.vtt.startsWith('WEBVTT')).toBe(true);
        expect(result.error).toBeDefined();
    });

    it('does not throw on empty input', () => {
        expect(() => convertSrtToVtt('')).not.toThrow();
        const result = convertSrtToVtt('');
        expect(result.vtt.startsWith('WEBVTT')).toBe(true);
    });

    it('does not throw on binary/non-text garbage input', () => {
        const binaryish = '\x00\x01\x02�� not text';
        expect(() => convertSrtToVtt(binaryish)).not.toThrow();
    });

    it('falls back to an empty WebVTT document and reports the error if an internal string operation throws unexpectedly', () => {
        // Exercises the outer try/catch's error path directly: convertSrtToVtt
        // must never let an unhandled exception escape, even if a string
        // primitive it relies on misbehaves. Temporarily forces
        // String.prototype.replace (used to normalize line endings) to throw,
        // then restores it synchronously so no other test observes the change.
        const originalReplace = String.prototype.replace;
        String.prototype.replace = function replaceOverride(): string {
            throw new Error('forced failure to exercise the defensive catch branch');
        };
        try {
            const result = convertSrtToVtt('1\n00:00:01,000 --> 00:00:02,000\nHello\n');
            expect(result.vtt).toBe('WEBVTT\n');
            expect(result.converted).toBe(true);
            expect(result.error).toContain('forced failure to exercise the defensive catch branch');
        } finally {
            String.prototype.replace = originalReplace;
        }
    });
});
