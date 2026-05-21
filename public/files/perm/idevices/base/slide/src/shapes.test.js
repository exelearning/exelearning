/**
 * Tests for shape descriptor factories.
 *
 * Descriptors are framework-free JSON. The canvas adapter turns them into
 * Fabric objects; tests only verify geometry and defaults so the shape
 * library can evolve without rebuilding the bundle.
 */

/* eslint-disable no-undef */
import { describe, it, expect } from 'vitest';
import {
    arrowDescriptor,
    circleDescriptor,
    descriptorFromBBox,
    heartDescriptor,
    lineDescriptor,
    rectDescriptor,
} from './shapes.ts';

describe('rectDescriptor', () => {
    it('produces a sensible default rectangle', () => {
        const d = rectDescriptor();
        expect(d.role).toBe('rect');
        expect(d.width).toBeGreaterThan(0);
        expect(d.height).toBeGreaterThan(0);
        expect(d.fill).toMatch(/^#/);
        expect(d.strokeWidth).toBe(0);
    });

    it('respects custom origin', () => {
        const d = rectDescriptor(10, 20);
        expect(d.left).toBe(10);
        expect(d.top).toBe(20);
    });
});

describe('circleDescriptor', () => {
    it('produces a circle with positive radius', () => {
        const d = circleDescriptor();
        expect(d.role).toBe('circle');
        expect(d.radius).toBeGreaterThan(0);
        expect(d.fill).toMatch(/^#/);
    });
});

describe('lineDescriptor', () => {
    it('produces a line with two endpoints', () => {
        const d = lineDescriptor();
        expect(d.role).toBe('line');
        expect(d.points).toHaveLength(4);
        expect(d.strokeWidth).toBeGreaterThan(0);
    });
});

describe('arrowDescriptor', () => {
    it('produces an endpoint-based arrow descriptor', () => {
        const d = arrowDescriptor();
        expect(d.role).toBe('arrow');
        expect(typeof d.x1).toBe('number');
        expect(typeof d.y1).toBe('number');
        expect(typeof d.x2).toBe('number');
        expect(typeof d.y2).toBe('number');
        expect(d.headSize).toBeGreaterThan(0);
        expect(d.strokeWidth).toBeGreaterThan(0);
    });

    it('respects custom endpoints', () => {
        const d = arrowDescriptor(10, 20, 200, 30);
        expect(d.x1).toBe(10);
        expect(d.y1).toBe(20);
        expect(d.x2).toBe(200);
        expect(d.y2).toBe(30);
    });
});

describe('descriptorFromBBox', () => {
    const bbox = { left: 100, top: 50, width: 240, height: 160 };

    it('builds a rectangle descriptor scaled to the bbox', () => {
        const d = descriptorFromBBox('rect', bbox);
        expect(d.role).toBe('rect');
        expect(d.left).toBe(100);
        expect(d.top).toBe(50);
        expect(d.width).toBe(240);
        expect(d.height).toBe(160);
    });

    it('builds an ellipse with rx/ry that match half the bbox', () => {
        const d = descriptorFromBBox('ellipse', bbox);
        expect(d.role).toBe('ellipse');
        expect(d.rx).toBe(120);
        expect(d.ry).toBe(80);
    });

    it('builds a triangle with a closed path', () => {
        const d = descriptorFromBBox('triangle', bbox);
        expect(d.role).toBe('triangle');
        expect(d.path).toContain('M');
        expect(d.path).toContain('Z');
    });

    it('builds an arrow with endpoints derived from the bbox', () => {
        const d = descriptorFromBBox('arrow', bbox);
        expect(d.role).toBe('arrow');
        // Right-arrow: x1 == bbox.left, x2 == right edge
        expect(d.x1).toBe(100);
        expect(d.x2).toBe(340);
    });

    it('reverses arrow endpoints for the left-arrow variant', () => {
        const d = descriptorFromBBox('arrow-left', bbox);
        expect(d.role).toBe('arrow-left');
        expect(d.x1).toBeGreaterThan(d.x2);
    });

    it('clamps the bbox to a minimum side', () => {
        const d = descriptorFromBBox('rect', { left: 0, top: 0, width: 0, height: 0 });
        expect(d.role).toBe('rect');
        expect(d.width).toBeGreaterThan(0);
        expect(d.height).toBeGreaterThan(0);
    });

    it('builds a star path for the star kind', () => {
        const d = descriptorFromBBox('star', bbox);
        expect(d.role).toBe('star');
        expect(d.path).toMatch(/^M /);
    });

    it('builds a speech bubble descriptor', () => {
        const d = descriptorFromBBox('speech-bubble', bbox);
        expect(d.role).toBe('speech-bubble');
        expect(d.path.length).toBeGreaterThan(20);
    });
});

describe('heartDescriptor', () => {
    it('produces a closed SVG path string', () => {
        const d = heartDescriptor();
        expect(d.role).toBe('heart');
        expect(d.path.startsWith('M')).toBe(true);
        expect(d.path.trim().endsWith('Z')).toBe(true);
    });

    it('uses a vivid fill colour by default', () => {
        const d = heartDescriptor();
        expect(d.fill).toMatch(/^#/);
    });
});

