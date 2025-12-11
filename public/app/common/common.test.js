/**
 * Common.js Bun Tests
 *
 * Unit tests for utility patterns used in common.js.
 * These tests verify the logic of utility functions used throughout eXeLearning frontend.
 *
 * Run with: bun test
 */

/* eslint-disable no-undef */

// Test functions available globally from vitest setup

// Test utility functions that can be tested in isolation
describe('Common utility patterns', () => {
  // Test color conversion logic
  describe('rgb to hex conversion', () => {
    function rgb2hex(color) {
      if (color.indexOf('#') !== -1) return color;
      const numbers = color.match(/\d+/g);
      if (!numbers || numbers.length < 3) return color;
      const r = parseInt(numbers[0], 10);
      const g = parseInt(numbers[1], 10);
      const b = parseInt(numbers[2], 10);
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    it('converts RGB string to hex', () => {
      expect(rgb2hex('rgb(255, 0, 0)')).toBe('#ff0000');
      expect(rgb2hex('rgb(0, 255, 0)')).toBe('#00ff00');
      expect(rgb2hex('rgb(0, 0, 255)')).toBe('#0000ff');
    });

    it('returns hex unchanged', () => {
      expect(rgb2hex('#abc123')).toBe('#abc123');
    });
  });

  // Test contrast calculation logic
  describe('contrast color selection', () => {
    function useBlackOrWhite(hex) {
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      return y >= 128 ? 'black' : 'white';
    }

    it('returns white for dark colors', () => {
      expect(useBlackOrWhite('000000')).toBe('white');
      expect(useBlackOrWhite('0000ff')).toBe('white');
    });

    it('returns black for light colors', () => {
      expect(useBlackOrWhite('ffffff')).toBe('black');
      expect(useBlackOrWhite('ffff00')).toBe('black');
    });
  });

  // Test time formatting logic
  describe('time formatting', () => {
    function getTimeToString(seconds) {
      const mins = Math.floor(seconds / 60) % 60;
      const secs = seconds % 60;
      return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    }

    it('formats seconds correctly', () => {
      expect(getTimeToString(0)).toBe('00:00');
      expect(getTimeToString(30)).toBe('00:30');
      expect(getTimeToString(60)).toBe('01:00');
      expect(getTimeToString(90)).toBe('01:30');
    });

    function hourToSeconds(time) {
      const parts = String(time).split(':').map(Number);
      if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
      }
      return parts[0] || 0;
    }

    it('converts HH:MM:SS to seconds', () => {
      expect(hourToSeconds('01:00:00')).toBe(3600);
      expect(hourToSeconds('00:01:00')).toBe(60);
      expect(hourToSeconds('00:00:30')).toBe(30);
    });

    it('converts MM:SS to seconds', () => {
      expect(hourToSeconds('01:30')).toBe(90);
      expect(hourToSeconds('05:00')).toBe(300);
    });
  });

  // Test JSON parsing helper
  describe('JSON parsing', () => {
    function parseJSONSafe(str) {
      try {
        return JSON.parse(str);
      } catch (e) {
        return {};
      }
    }

    it('parses valid JSON', () => {
      expect(parseJSONSafe('{"key": "value"}')).toEqual({ key: 'value' });
    });

    it('returns empty object for invalid JSON', () => {
      expect(parseJSONSafe('invalid')).toEqual({});
      expect(parseJSONSafe('')).toEqual({});
    });
  });

  // Test YouTube ID extraction
  describe('YouTube ID extraction', () => {
    function getIDYoutube(url) {
      if (!url) return '';
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = url.match(regExp);
      return match && match[2].length === 11 ? match[2] : '';
    }

    it('extracts ID from standard URL', () => {
      expect(getIDYoutube('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('extracts ID from short URL', () => {
      expect(getIDYoutube('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('extracts ID from embed URL', () => {
      expect(getIDYoutube('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('returns empty for invalid URL', () => {
      expect(getIDYoutube('https://example.com')).toBe('');
      expect(getIDYoutube('')).toBe('');
      expect(getIDYoutube(null)).toBe('');
    });
  });

  // Test array shuffle
  describe('array shuffle', () => {
    function shuffleArray(array) {
      if (!Array.isArray(array)) return array;
      const result = [...array];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    }

    it('returns array with same length', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = shuffleArray(arr);
      expect(result.length).toBe(arr.length);
    });

    it('contains same elements', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = shuffleArray(arr);
      expect(result.sort()).toEqual(arr.sort());
    });

    it('handles empty array', () => {
      expect(shuffleArray([])).toEqual([]);
    });

    it('handles non-array input', () => {
      expect(shuffleArray(null)).toBe(null);
      expect(shuffleArray(undefined)).toBe(undefined);
    });
  });

  // Test debounce pattern
  describe('debounce', () => {
    beforeEach(() => {
      // Bun test has timers built-in
    });

    afterEach(() => {
      // Cleanup happens automatically
    });

    function debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    }

    it('delays function execution', async () => {
      let called = false;
      const func = () => { called = true; };
      const debouncedFunc = debounce(func, 100);

      debouncedFunc();
      expect(called).toBe(false);

      await new Promise(resolve => setTimeout(resolve, 150));
      expect(called).toBe(true);
    });

    it('resets timer on subsequent calls', async () => {
      let callCount = 0;
      const func = () => { callCount++; };
      const debouncedFunc = debounce(func, 100);

      debouncedFunc();
      await new Promise(resolve => setTimeout(resolve, 50));
      debouncedFunc();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(callCount).toBe(0);

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(callCount).toBe(1);
    });
  });

  // Test encryption pattern (simple XOR)
  describe('simple encryption', () => {
    const KEY = 'exelearning';

    function encrypt(text) {
      if (!text) return '';
      return text
        .split('')
        .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ KEY.charCodeAt(i % KEY.length)))
        .join('');
    }

    function decrypt(text) {
      return encrypt(text); // XOR is symmetric
    }

    it('encrypt and decrypt are inverse operations', () => {
      const original = 'Hello World!';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('handles empty string', () => {
      expect(encrypt('')).toBe('');
      expect(decrypt('')).toBe('');
    });
  });
});
