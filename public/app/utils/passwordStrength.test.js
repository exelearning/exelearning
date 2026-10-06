import { scorePasswordStrength, MIN_PASSWORD_LENGTH } from './passwordStrength.js';

describe('scorePasswordStrength', () => {
  it('reports an empty password', () => {
    expect(scorePasswordStrength('')).toEqual({ score: 0, level: 'empty', percent: 0 });
  });

  it('treats non-string input as empty', () => {
    expect(scorePasswordStrength(undefined).level).toBe('empty');
    expect(scorePasswordStrength(null).level).toBe('empty');
    expect(scorePasswordStrength(12345678).level).toBe('empty');
  });

  it('reports a password below the accepted minimum', () => {
    const result = scorePasswordStrength('a'.repeat(MIN_PASSWORD_LENGTH - 1));

    expect(result.level).toBe('too-short');
    expect(result.score).toBe(0);
  });

  it('accepts the minimum length as weak rather than too short', () => {
    const result = scorePasswordStrength('a'.repeat(MIN_PASSWORD_LENGTH));

    expect(result.level).toBe('weak');
    expect(result.score).toBe(1);
  });

  it('never rates a password under 8 characters above weak, however varied', () => {
    const result = scorePasswordStrength('aB3!');

    expect(result.level).toBe('weak');
  });

  it('rates a long single-class password as fair', () => {
    expect(scorePasswordStrength('aaaaaaaa').level).toBe('fair');
  });

  it('rewards character variety at equal length', () => {
    const plain = scorePasswordStrength('abcdefgh');
    const varied = scorePasswordStrength('abcdEF12');

    expect(varied.score).toBeGreaterThan(plain.score);
  });

  it('rewards extra length at equal variety', () => {
    const shorter = scorePasswordStrength('abcdefgh');
    const longer = scorePasswordStrength('abcdefghijkl');

    expect(longer.score).toBeGreaterThan(shorter.score);
  });

  it('rates a long, varied password as strong', () => {
    expect(scorePasswordStrength('Corr3ct-Horse-Battery!').level).toBe('strong');
  });

  it('rates a long passphrase of plain words as good', () => {
    expect(scorePasswordStrength('correcthorsebatterystaple').level).toBe('good');
  });

  it('keeps the score within 0-4 and the percentage within 0-100', () => {
    const samples = ['', 'a', 'abcd', 'abcdefgh', 'Abcdefgh1', 'Corr3ct-Horse-Battery-Staple!!'];

    samples.forEach(sample => {
      const { score, percent } = scorePasswordStrength(sample);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(4);
      expect(percent).toBeGreaterThanOrEqual(0);
      expect(percent).toBeLessThanOrEqual(100);
    });
  });

  it('exposes a percentage that tracks the score', () => {
    expect(scorePasswordStrength('Corr3ct-Horse-Battery!').percent).toBe(100);
    expect(scorePasswordStrength('a'.repeat(MIN_PASSWORD_LENGTH)).percent).toBe(25);
  });

  it('keeps the minimum aligned with the backend rule', () => {
    // src/services/password.ts uses the same value; a mismatch would let the UI
    // promise something the API rejects.
    expect(MIN_PASSWORD_LENGTH).toBe(4);
  });
});
