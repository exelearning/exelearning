import { generateElpFilename, parseElpFilename } from './elp-filename.util';

describe('ELP Filename Utilities', () => {
    describe('generateElpFilename', () => {
        it('should generate correct ELP filename', () => {
            const odeId = '20250118101234ABC';
            const odeVersionId = '20250118101235DEF';

            const result = generateElpFilename(odeId, odeVersionId);

            expect(result).toBe('20250118101234ABC_20250118101235DEF.elpx');
        });

        it('should handle different ID formats', () => {
            const odeId = 'test123';
            const odeVersionId = 'version456';

            const result = generateElpFilename(odeId, odeVersionId);

            expect(result).toBe('test123_version456.elpx');
        });
    });

    describe('parseElpFilename', () => {
        it('should parse valid ELP filename with .elpx extension', () => {
            const filename = '20250118101234ABC_20250118101235DEF.elpx';

            const result = parseElpFilename(filename);

            expect(result).not.toBeNull();
            expect(result?.odeId).toBe('20250118101234ABC');
            expect(result?.odeVersionId).toBe('20250118101235DEF');
        });

        it('should parse valid ELP filename with .elp extension', () => {
            const filename = '20250118101234ABC_20250118101235DEF.elp';

            const result = parseElpFilename(filename);

            expect(result).not.toBeNull();
            expect(result?.odeId).toBe('20250118101234ABC');
            expect(result?.odeVersionId).toBe('20250118101235DEF');
        });

        it('should return null for invalid filename (no underscore)', () => {
            const filename = '20250118101234ABC.elpx';

            const result = parseElpFilename(filename);

            expect(result).toBeNull();
        });

        it('should return null for invalid filename (multiple underscores)', () => {
            const filename = 'id1_id2_id3.elpx';

            const result = parseElpFilename(filename);

            expect(result).toBeNull();
        });

        it('should handle filename without extension', () => {
            const filename = '20250118101234ABC_20250118101235DEF';

            const result = parseElpFilename(filename);

            expect(result).not.toBeNull();
            expect(result?.odeId).toBe('20250118101234ABC');
            expect(result?.odeVersionId).toBe('20250118101235DEF');
        });
    });

    describe('generateElpFilename and parseElpFilename integration', () => {
        it('should be able to parse generated filename', () => {
            const odeId = '20250118101234ABC';
            const odeVersionId = '20250118101235DEF';

            const filename = generateElpFilename(odeId, odeVersionId);
            const parsed = parseElpFilename(filename);

            expect(parsed).not.toBeNull();
            expect(parsed?.odeId).toBe(odeId);
            expect(parsed?.odeVersionId).toBe(odeVersionId);
        });
    });
});
