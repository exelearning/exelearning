/**
 * cssClassHelper Tests
 *
 * Unit tests for parseCssClassList: turning a user-supplied cssClass string
 * into a clean list of non-empty class tokens that are safe for classList.add().
 *
 * Run with: make test-frontend
 */

import { describe, it, expect } from 'vitest';
import { parseCssClassList } from './cssClassHelper.js';

describe('parseCssClassList', () => {
    it('returns an empty array for an empty string', () => {
        expect(parseCssClassList('')).toEqual([]);
    });

    it('returns an empty array for null or undefined', () => {
        expect(parseCssClassList(null)).toEqual([]);
        expect(parseCssClassList(undefined)).toEqual([]);
    });

    it('returns an empty array for non-string values', () => {
        expect(parseCssClassList(42)).toEqual([]);
        expect(parseCssClassList({})).toEqual([]);
    });

    it('returns an empty array for a string of only whitespace', () => {
        expect(parseCssClassList(' ')).toEqual([]);
        expect(parseCssClassList('   ')).toEqual([]);
    });

    it('splits a normal space-separated list', () => {
        expect(parseCssClassList('class1 class2 class3')).toEqual([
            'class1',
            'class2',
            'class3',
        ]);
    });

    it('drops empty tokens from leading, trailing and double spaces', () => {
        expect(parseCssClassList('  a  b  ')).toEqual(['a', 'b']);
    });

    it('treats tabs and newlines as separators and drops empty tokens', () => {
        expect(parseCssClassList('a\tb\nc')).toEqual(['a', 'b', 'c']);
    });

    it('never returns an empty-string token for a pasted CSS rule', () => {
        const pastedCss =
            '.lista_de_cotejo {     border: 1px solid #d4d4d4;     ' +
            "border-radius: 6px;     overflow: hidden;     font-family: 'Andika', sans-serif;     " +
            'background-color: #ffffff;     margin-bottom: 20px;     box-shadow: 0 2px 4px rgba(0,0,0,0.05); }';
        const result = parseCssClassList(pastedCss);
        expect(result.length).toBeGreaterThan(0);
        expect(result).not.toContain('');
        // every token is safe to pass to classList.add() (no empty, no whitespace)
        for (const token of result) {
            expect(token).not.toBe('');
            expect(token).not.toMatch(/\s/);
        }
    });
});
