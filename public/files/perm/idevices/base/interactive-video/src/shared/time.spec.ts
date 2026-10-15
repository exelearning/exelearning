import { describe, expect, it } from 'vitest';
import { hmsToSeconds, secondsToHms, toSeconds } from './time';

describe('secondsToHms', () => {
    it('formats sub-minute values as mm:ss with zero padding', () => {
        expect(secondsToHms(0)).toBe('00:00');
        expect(secondsToHms(5)).toBe('00:05');
        expect(secondsToHms(59)).toBe('00:59');
    });

    it('formats minute values as mm:ss', () => {
        expect(secondsToHms(65)).toBe('01:05');
        expect(secondsToHms(600)).toBe('10:00');
        expect(secondsToHms(3599)).toBe('59:59');
    });

    it('switches to hh:mm:ss once the value reaches one hour', () => {
        expect(secondsToHms(3600)).toBe('01:00:00');
        expect(secondsToHms(3661)).toBe('01:01:01');
        expect(secondsToHms(36000)).toBe('10:00:00');
    });

    it('floors fractional seconds', () => {
        expect(secondsToHms(12.9)).toBe('00:12');
    });

    it('clamps invalid or negative input to 00:00', () => {
        expect(secondsToHms(-5)).toBe('00:00');
        expect(secondsToHms(NaN)).toBe('00:00');
        expect(secondsToHms('nope')).toBe('00:00');
        expect(secondsToHms(undefined)).toBe('00:00');
    });
});

describe('hmsToSeconds', () => {
    it('parses mm:ss into seconds', () => {
        expect(hmsToSeconds('00:05')).toBe(5);
        expect(hmsToSeconds('01:05')).toBe(65);
        expect(hmsToSeconds('10:00')).toBe(600);
    });

    it('parses hh:mm:ss into seconds', () => {
        expect(hmsToSeconds('01:00:00')).toBe(3600);
        expect(hmsToSeconds('01:01:01')).toBe(3661);
    });

    it('tolerates unpadded components', () => {
        expect(hmsToSeconds('1:5')).toBe(65);
        expect(hmsToSeconds('1:1:1')).toBe(3661);
    });

    it('returns NaN for unparseable input', () => {
        expect(hmsToSeconds('')).toBeNaN();
        expect(hmsToSeconds('abc')).toBeNaN();
        expect(hmsToSeconds('1:2:3:4')).toBeNaN();
    });

    it('rejects anything that is not mm:ss / hh:mm:ss (never throws)', () => {
        expect(hmsToSeconds(42)).toBeNaN();
        expect(hmsToSeconds(null)).toBeNaN();
        expect(hmsToSeconds(undefined)).toBeNaN();
        expect(hmsToSeconds('90')).toBeNaN(); // no colon
        expect(hmsToSeconds('mm:ss')).toBeNaN(); // not digits
        expect(hmsToSeconds('01:-5')).toBeNaN();
    });

    it('round-trips with secondsToHms', () => {
        for (const s of [0, 5, 65, 3600, 3661, 36000]) {
            expect(hmsToSeconds(secondsToHms(s))).toBe(s);
        }
    });
});

describe('toSeconds', () => {
    it('passes finite non-negative numbers through', () => {
        expect(toSeconds(12)).toBe(12);
        expect(toSeconds(12.5)).toBe(12.5);
        expect(toSeconds(0)).toBe(0);
    });

    it('coerces numeric strings', () => {
        expect(toSeconds('12')).toBe(12);
        expect(toSeconds('12.5')).toBe(12.5);
    });

    it('parses hh:mm:ss / mm:ss strings', () => {
        expect(toSeconds('01:05')).toBe(65);
        expect(toSeconds('01:01:01')).toBe(3661);
    });

    it('defaults invalid or negative input to 0 (never throws)', () => {
        expect(toSeconds(NaN)).toBe(0);
        expect(toSeconds(-3)).toBe(0);
        expect(toSeconds('-3')).toBe(0);
        expect(toSeconds('nonsense')).toBe(0);
        expect(toSeconds('00:0x')).toBe(0);
        expect(toSeconds(Infinity)).toBe(0);
        expect(toSeconds(null)).toBe(0);
        expect(toSeconds(undefined)).toBe(0);
        expect(toSeconds({})).toBe(0);
    });
});
