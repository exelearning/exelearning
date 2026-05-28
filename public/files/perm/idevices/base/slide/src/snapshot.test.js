/* eslint-disable no-undef */
import { describe, it, expect } from 'vitest';
import { buildSnapshot, readSnapshot } from './snapshot.ts';

describe('buildSnapshot / readSnapshot', () => {
    it('round-trips scene + dimensions + background', () => {
        const scene = { objects: [{ type: 'rect' }] };
        const s = buildSnapshot(scene, 1024, 768, '#abcdef');
        const back = readSnapshot(s);
        expect(back.scene).toEqual(scene);
        expect(back.width).toBe(1024);
        expect(back.height).toBe(768);
        expect(back.background).toBe('#abcdef');
    });

    it('clamps dimensions on build (so undo cannot resurrect a stale invalid value)', () => {
        const back = readSnapshot(buildSnapshot({}, 50, 9999, '#fff'));
        expect(back.width).toBe(400);
        expect(back.height).toBe(1200);
    });

    it('replaces non-hex background with default', () => {
        const back = readSnapshot(buildSnapshot({}, 1280, 720, 'rgb(0,0,0)'));
        expect(back.background).toBe('#ffffff');
    });

    it('accepts a legacy scene-only snapshot (forward compatibility)', () => {
        const legacy = JSON.stringify({ objects: [{ type: 'rect' }] });
        const back = readSnapshot(legacy);
        expect(back.scene).toEqual({ objects: [{ type: 'rect' }] });
        expect(back.width).toBe(1280);
        expect(back.height).toBe(720);
        expect(back.background).toBe('#ffffff');
    });

    it('returns a blank snapshot for invalid JSON', () => {
        const back = readSnapshot('not-json');
        expect(back.scene).toEqual({});
        expect(back.width).toBe(1280);
    });

    it('treats non-object scene argument as empty', () => {
        const back = readSnapshot(buildSnapshot(null, 1280, 720, '#fff'));
        expect(back.scene).toEqual({});
    });
});
