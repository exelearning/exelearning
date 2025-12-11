import { generateId, generateIdCheckUnique, generateRandomStr } from './id-generator.util';

describe('ID Generator Utilities', () => {
    describe('generateId', () => {
        it('should generate an ID with correct length (20 characters)', () => {
            const id = generateId();
            expect(id).toHaveLength(20);
        });

        it('should generate an ID starting with current date (YYYYMMDDHHmmss)', () => {
            const id = generateId();
            const now = new Date();

            // Extract date components from ID
            const year = id.substring(0, 4);
            const month = id.substring(4, 6);
            const day = id.substring(6, 8);

            // Verify they match current date (UTC)
            expect(year).toBe(now.getUTCFullYear().toString());
            expect(month).toBe(String(now.getUTCMonth() + 1).padStart(2, '0'));
            expect(day).toBe(String(now.getUTCDate()).padStart(2, '0'));
        });

        it('should have 6 random uppercase letters at the end', () => {
            const id = generateId();
            const randomPart = id.substring(14);

            expect(randomPart).toHaveLength(6);
            expect(randomPart).toMatch(/^[A-Z]{6}$/);
        });

        it('should generate different IDs on consecutive calls', () => {
            const id1 = generateId();
            const id2 = generateId();

            // IDs should be different (random part makes them unique)
            expect(id1).not.toBe(id2);
        });

        it('should generate IDs with valid timestamp format', () => {
            const id = generateId();
            const timestamp = id.substring(0, 14);

            // Extract time components
            const hours = timestamp.substring(8, 10);
            const minutes = timestamp.substring(10, 12);
            const seconds = timestamp.substring(12, 14);

            // Verify they are valid time values
            expect(Number(hours)).toBeGreaterThanOrEqual(0);
            expect(Number(hours)).toBeLessThan(24);
            expect(Number(minutes)).toBeGreaterThanOrEqual(0);
            expect(Number(minutes)).toBeLessThan(60);
            expect(Number(seconds)).toBeGreaterThanOrEqual(0);
            expect(Number(seconds)).toBeLessThan(60);
        });

        it('should generate multiple unique IDs', () => {
            const ids = new Set<string>();
            const count = 100;

            for (let i = 0; i < count; i++) {
                ids.add(generateId());
            }

            // All IDs should be unique
            expect(ids.size).toBe(count);
        });

        it('should match Symfony ID format pattern', () => {
            const id = generateId();

            // Pattern: YYYYMMDDHHmmss + 6 uppercase letters
            // Example: 20250116143027ABCDEF
            expect(id).toMatch(/^\d{14}[A-Z]{6}$/);
        });
    });

    describe('generateIdCheckUnique', () => {
        it('should generate a unique ID not in the provided array', () => {
            const existingIds = ['20250116143027ABCDEF', '20250116143028GHIJKL', '20250116143029MNOPQR'];

            const newId = generateIdCheckUnique(existingIds);

            expect(existingIds).not.toContain(newId);
            expect(newId).toHaveLength(20);
        });

        it('should generate an ID when array is empty', () => {
            const newId = generateIdCheckUnique([]);

            expect(newId).toHaveLength(20);
            expect(newId).toMatch(/^\d{14}[A-Z]{6}$/);
        });

        it('should keep generating until a unique ID is found', () => {
            const existingIds: string[] = [];

            // Generate 10 unique IDs
            for (let i = 0; i < 10; i++) {
                const newId = generateIdCheckUnique(existingIds);
                expect(existingIds).not.toContain(newId);
                existingIds.push(newId);
            }

            expect(existingIds).toHaveLength(10);
            // All should be unique
            expect(new Set(existingIds).size).toBe(10);
        });

        it('should handle large arrays efficiently', () => {
            const existingIds: string[] = [];

            // Generate 1000 IDs
            for (let i = 0; i < 1000; i++) {
                existingIds.push(generateId());
            }

            const startTime = Date.now();
            const newId = generateIdCheckUnique(existingIds);
            const duration = Date.now() - startTime;

            expect(existingIds).not.toContain(newId);
            expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
        });
    });

    describe('generateRandomStr', () => {
        it('should generate a string with correct length', () => {
            expect(generateRandomStr(6)).toHaveLength(6);
            expect(generateRandomStr(10)).toHaveLength(10);
            expect(generateRandomStr(1)).toHaveLength(1);
        });

        it('should generate only uppercase letters', () => {
            const str = generateRandomStr(20);
            expect(str).toMatch(/^[A-Z]+$/);
        });

        it('should generate different strings on consecutive calls', () => {
            const str1 = generateRandomStr(10);
            const str2 = generateRandomStr(10);

            // While theoretically possible to be the same, it's extremely unlikely
            expect(str1).not.toBe(str2);
        });

        it('should handle edge case of length 0', () => {
            const str = generateRandomStr(0);
            expect(str).toBe('');
        });

        it('should generate strings with good randomness distribution', () => {
            const length = 1000;
            const str = generateRandomStr(length);
            const letterCounts: Record<string, number> = {};

            // Count occurrences of each letter
            for (const char of str) {
                letterCounts[char] = (letterCounts[char] || 0) + 1;
            }

            // With 1000 characters and 26 letters, we expect roughly 38 of each letter
            // Allow for natural variance (between 15 and 70) to avoid flaky test failures
            Object.values(letterCounts).forEach(count => {
                expect(count).toBeGreaterThanOrEqual(15);
                expect(count).toBeLessThanOrEqual(70);
            });
        });

        it('should use all 26 uppercase letters over multiple generations', () => {
            const allLetters = new Set<string>();

            // Generate enough random strings to likely hit all letters
            for (let i = 0; i < 100; i++) {
                const str = generateRandomStr(10);
                for (const char of str) {
                    allLetters.add(char);
                }
            }

            // Should have all 26 letters (very high probability)
            expect(allLetters.size).toBe(26);
        });
    });

    describe('Integration: ID Format Compatibility', () => {
        it('should generate IDs that can be used for date-based directory structure', () => {
            const id = generateId();

            // Extract date components as they would be used for file paths
            const year = id.substring(0, 4);
            const month = id.substring(4, 6);
            const day = id.substring(6, 8);

            // Verify path would be valid
            const path = `files/tmp/${year}/${month}/${day}/${id}/`;
            expect(path).toMatch(/^files\/tmp\/\d{4}\/\d{2}\/\d{2}\/\d{14}[A-Z]{6}\/$/);
        });

        it('should be compatible with Symfony session ID format', () => {
            const id = generateId();

            // Symfony expects:
            // - 14-digit timestamp (YYYYMMDDHHmmss)
            // - 6 uppercase letters
            // Total: 20 characters

            expect(id).toHaveLength(20);
            expect(id.substring(0, 14)).toMatch(/^\d{14}$/);
            expect(id.substring(14)).toMatch(/^[A-Z]{6}$/);
        });
    });
});
