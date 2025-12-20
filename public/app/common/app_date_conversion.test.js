import DateConversion from './app_date_conversion.js';

describe('DateConversion', () => {
  let dateConversion;

  beforeEach(() => {
    dateConversion = new DateConversion();
  });

  describe('getDateYear', () => {
    it('should return the year from a date', () => {
      const date = new Date('2025-12-17T10:30:45.123');
      expect(dateConversion.getDateYear(date)).toBe(2025);
    });

    it('should return the year for a different date', () => {
      const date = new Date('2020-01-01T00:00:00.000');
      expect(dateConversion.getDateYear(date)).toBe(2020);
    });

    it('should handle leap year', () => {
      const date = new Date('2024-02-29T12:00:00.000');
      expect(dateConversion.getDateYear(date)).toBe(2024);
    });
  });

  describe('getDateMonth', () => {
    it('should return month with leading zero for single digits', () => {
      const date = new Date('2025-01-17T10:30:45.123');
      expect(dateConversion.getDateMonth(date)).toBe('01');
    });

    it('should return month with leading zero for September', () => {
      const date = new Date('2025-09-17T10:30:45.123');
      expect(dateConversion.getDateMonth(date)).toBe('09');
    });

    it('should return month without leading zero for October', () => {
      const date = new Date('2025-10-17T10:30:45.123');
      expect(dateConversion.getDateMonth(date)).toBe('10');
    });

    it('should return month without leading zero for December', () => {
      const date = new Date('2025-12-17T10:30:45.123');
      expect(dateConversion.getDateMonth(date)).toBe('12');
    });
  });

  describe('getDateDay', () => {
    it('should return day with leading zero for single digits', () => {
      const date = new Date('2025-12-01T10:30:45.123');
      expect(dateConversion.getDateDay(date)).toBe('01');
    });

    it('should return day with leading zero for day 09', () => {
      const date = new Date('2025-12-09T10:30:45.123');
      expect(dateConversion.getDateDay(date)).toBe('09');
    });

    it('should return day without leading zero for day 10', () => {
      const date = new Date('2025-12-10T10:30:45.123');
      expect(dateConversion.getDateDay(date)).toBe('10');
    });

    it('should return day without leading zero for day 31', () => {
      const date = new Date('2025-12-31T10:30:45.123');
      expect(dateConversion.getDateDay(date)).toBe('31');
    });
  });

  describe('getDateHour', () => {
    it('should return hour with leading zero for single digits', () => {
      const date = new Date('2025-12-17T00:30:45.123');
      expect(dateConversion.getDateHour(date)).toBe('00');
    });

    it('should return hour with leading zero for hour 09', () => {
      const date = new Date('2025-12-17T09:30:45.123');
      expect(dateConversion.getDateHour(date)).toBe('09');
    });

    it('should return hour without leading zero for hour 10', () => {
      const date = new Date('2025-12-17T10:30:45.123');
      expect(dateConversion.getDateHour(date)).toBe('10');
    });

    it('should return hour without leading zero for hour 23', () => {
      const date = new Date('2025-12-17T23:30:45.123');
      expect(dateConversion.getDateHour(date)).toBe('23');
    });
  });

  describe('getDateMinutes', () => {
    it('should return minutes with leading zero for single digits', () => {
      const date = new Date('2025-12-17T10:00:45.123');
      expect(dateConversion.getDateMinutes(date)).toBe('00');
    });

    it('should return minutes with leading zero for minute 09', () => {
      const date = new Date('2025-12-17T10:09:45.123');
      expect(dateConversion.getDateMinutes(date)).toBe('09');
    });

    it('should return minutes without leading zero for minute 10', () => {
      const date = new Date('2025-12-17T10:10:45.123');
      expect(dateConversion.getDateMinutes(date)).toBe('10');
    });

    it('should return minutes without leading zero for minute 59', () => {
      const date = new Date('2025-12-17T10:59:45.123');
      expect(dateConversion.getDateMinutes(date)).toBe('59');
    });
  });

  describe('getDateSeconds', () => {
    it('should return seconds with leading zero for single digits', () => {
      const date = new Date('2025-12-17T10:30:00.123');
      expect(dateConversion.getDateSeconds(date)).toBe('00');
    });

    it('should return seconds with leading zero for second 09', () => {
      const date = new Date('2025-12-17T10:30:09.123');
      expect(dateConversion.getDateSeconds(date)).toBe('09');
    });

    it('should return seconds without leading zero for second 10', () => {
      const date = new Date('2025-12-17T10:30:10.123');
      expect(dateConversion.getDateSeconds(date)).toBe('10');
    });

    it('should return seconds without leading zero for second 59', () => {
      const date = new Date('2025-12-17T10:30:59.123');
      expect(dateConversion.getDateSeconds(date)).toBe('59');
    });
  });

  describe('getDateMilliseconds', () => {
    it('should return milliseconds with double leading zero for single digits', () => {
      const date = new Date('2025-12-17T10:30:45.001');
      expect(dateConversion.getDateMilliseconds(date)).toBe('001');
    });

    it('should return milliseconds with double leading zero for millisecond 009', () => {
      const date = new Date('2025-12-17T10:30:45.009');
      expect(dateConversion.getDateMilliseconds(date)).toBe('009');
    });

    it('should return milliseconds with single leading zero for double digits', () => {
      const date = new Date('2025-12-17T10:30:45.010');
      expect(dateConversion.getDateMilliseconds(date)).toBe('010');
    });

    it('should return milliseconds with single leading zero for millisecond 099', () => {
      const date = new Date('2025-12-17T10:30:45.099');
      expect(dateConversion.getDateMilliseconds(date)).toBe('099');
    });

    it('should return milliseconds without leading zero for triple digits', () => {
      const date = new Date('2025-12-17T10:30:45.100');
      expect(dateConversion.getDateMilliseconds(date)).toBe('100');
    });

    it('should return milliseconds without leading zero for millisecond 999', () => {
      const date = new Date('2025-12-17T10:30:45.999');
      expect(dateConversion.getDateMilliseconds(date)).toBe('999');
    });

    it('should handle millisecond 123', () => {
      const date = new Date('2025-12-17T10:30:45.123');
      expect(dateConversion.getDateMilliseconds(date)).toBe('123');
    });
  });

  describe('edge cases', () => {
    it('should handle midnight', () => {
      const date = new Date('2025-12-17T00:00:00.000');
      expect(dateConversion.getDateHour(date)).toBe('00');
      expect(dateConversion.getDateMinutes(date)).toBe('00');
      expect(dateConversion.getDateSeconds(date)).toBe('00');
      expect(dateConversion.getDateMilliseconds(date)).toBe('000');
    });

    it('should handle end of day', () => {
      const date = new Date('2025-12-17T23:59:59.999');
      expect(dateConversion.getDateHour(date)).toBe('23');
      expect(dateConversion.getDateMinutes(date)).toBe('59');
      expect(dateConversion.getDateSeconds(date)).toBe('59');
      expect(dateConversion.getDateMilliseconds(date)).toBe('999');
    });

    it('should handle first day of year', () => {
      const date = new Date('2025-01-01T00:00:00.000');
      expect(dateConversion.getDateYear(date)).toBe(2025);
      expect(dateConversion.getDateMonth(date)).toBe('01');
      expect(dateConversion.getDateDay(date)).toBe('01');
    });

    it('should handle last day of year', () => {
      const date = new Date('2025-12-31T23:59:59.999');
      expect(dateConversion.getDateYear(date)).toBe(2025);
      expect(dateConversion.getDateMonth(date)).toBe('12');
      expect(dateConversion.getDateDay(date)).toBe('31');
    });
  });
});
