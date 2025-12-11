import { getDateDirStructureFromIdentifier, getCurrentDateDirStructure } from './date-directory.util';

describe('Date Directory Utilities', () => {
    describe('getDateDirStructureFromIdentifier', () => {
        it('should extract date structure from valid identifier', () => {
            const identifier = '20250118101235DEF';

            const result = getDateDirStructureFromIdentifier(identifier);

            expect(result).toBe('2025/01/18/');
        });

        it('should handle minimum length identifier (YYYYMMDD)', () => {
            const identifier = '20250118';

            const result = getDateDirStructureFromIdentifier(identifier);

            expect(result).toBe('2025/01/18/');
        });

        it('should handle identifier with extra characters', () => {
            const identifier = '20251231235959ABCDEFG';

            const result = getDateDirStructureFromIdentifier(identifier);

            expect(result).toBe('2025/12/31/');
        });

        it('should throw error for identifier too short', () => {
            const identifier = '2025011';

            expect(() => getDateDirStructureFromIdentifier(identifier)).toThrow('Invalid identifier format');
        });

        it('should throw error for invalid year', () => {
            const identifier = '19990118101235DEF'; // Year 1999 is invalid

            expect(() => getDateDirStructureFromIdentifier(identifier)).toThrow('Invalid year in identifier');
        });

        it('should throw error for invalid month', () => {
            const identifier = '20251318101235DEF'; // Month 13 is invalid

            expect(() => getDateDirStructureFromIdentifier(identifier)).toThrow('Invalid month in identifier');
        });

        it('should throw error for invalid day', () => {
            const identifier = '20250132101235DEF'; // Day 32 is invalid

            expect(() => getDateDirStructureFromIdentifier(identifier)).toThrow('Invalid day in identifier');
        });

        it('should accept valid edge case dates', () => {
            // Test first day of year
            expect(getDateDirStructureFromIdentifier('20250101000000ABC')).toBe('2025/01/01/');

            // Test last day of year
            expect(getDateDirStructureFromIdentifier('20251231235959XYZ')).toBe('2025/12/31/');

            // Test leap year day
            expect(getDateDirStructureFromIdentifier('20240229120000LMN')).toBe('2024/02/29/');
        });
    });

    describe('getCurrentDateDirStructure', () => {
        it('should return current date in YYYY/MM/DD/ format', () => {
            const result = getCurrentDateDirStructure();
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');

            const expected = `${year}/${month}/${day}/`;

            expect(result).toBe(expected);
        });

        it('should pad month and day with leading zeros', () => {
            const result = getCurrentDateDirStructure();

            // Check format with regex: YYYY/MM/DD/
            expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2}\/$/);
        });
    });
});
