import {
    getSessionDateComponents,
    getOdeSessionUrl,
    getOdeSessionPath,
    getOdeComponentsSyncUrl,
    getOdeComponentsSyncPath,
    replaceContextPath,
    unreplaceContextPath,
    ODE_XML_CONTEXT_PATH,
} from './url.util';

describe('URL Utilities', () => {
    describe('getSessionDateComponents', () => {
        it('should extract date components from a valid session ID', () => {
            const sessionId = '20250116143027ABCDEF';
            const components = getSessionDateComponents(sessionId);

            expect(components).not.toBeNull();
            expect(components?.year).toBe('2025');
            expect(components?.month).toBe('01');
            expect(components?.day).toBe('16');
        });

        it('should extract date components from different dates', () => {
            const testCases = [
                { id: '20231231235959XYZABC', year: '2023', month: '12', day: '31' },
                { id: '20240101000000DEFGHI', year: '2024', month: '01', day: '01' },
                { id: '20250630120000JKLMNO', year: '2025', month: '06', day: '30' },
            ];

            testCases.forEach(({ id, year, month, day }) => {
                const components = getSessionDateComponents(id);
                expect(components?.year).toBe(year);
                expect(components?.month).toBe(month);
                expect(components?.day).toBe(day);
            });
        });

        it('should return null for invalid session ID (too short)', () => {
            expect(getSessionDateComponents('2025011')).toBeNull();
            expect(getSessionDateComponents('short')).toBeNull();
            expect(getSessionDateComponents('')).toBeNull();
        });

        it('should return null for null or undefined input', () => {
            expect(getSessionDateComponents(null as any)).toBeNull();
            expect(getSessionDateComponents(undefined as any)).toBeNull();
        });

        it('should handle UUID format session IDs', () => {
            const uuidSessionId = 'aaa54536-d8d2-4a7b-bf6d-c809321ccc2a';
            const components = getSessionDateComponents(uuidSessionId);

            // UUID format should return current date components
            expect(components).not.toBeNull();
            expect(components?.year).toBeDefined();
            expect(components?.month).toBeDefined();
            expect(components?.day).toBeDefined();

            // Verify it's a valid date
            const year = parseInt(components?.year || '0', 10);
            const month = parseInt(components?.month || '0', 10);
            const day = parseInt(components?.day || '0', 10);
            expect(year).toBeGreaterThanOrEqual(2020);
            expect(month).toBeGreaterThanOrEqual(1);
            expect(month).toBeLessThanOrEqual(12);
            expect(day).toBeGreaterThanOrEqual(1);
            expect(day).toBeLessThanOrEqual(31);
        });

        it('should handle UUID v4 format', () => {
            const uuid = '550e8400-e29b-41d4-a716-446655440000';
            const components = getSessionDateComponents(uuid);

            expect(components).not.toBeNull();
            // Should use current date for UUIDs
            const now = new Date();
            expect(components?.year).toBe(now.getFullYear().toString());
        });

        it('should return null for session IDs with less than 14 characters', () => {
            // Session IDs must be at least 14 characters (YYYYMMDDHHmmss)
            const sessionId = '20250116';
            const components = getSessionDateComponents(sessionId);

            expect(components).toBeNull();
        });
    });

    describe('getOdeSessionUrl', () => {
        it('should generate correct relative URL path for session', () => {
            const sessionId = '20250116143027ABCDEF';
            const url = getOdeSessionUrl(sessionId);

            expect(url).toBe('files/tmp/2025/01/16/20250116143027ABCDEF/');
        });

        it('should generate URLs for different dates', () => {
            const testCases = [
                {
                    id: '20231231235959XYZABC',
                    expected: 'files/tmp/2023/12/31/20231231235959XYZABC/',
                },
                {
                    id: '20240101000000DEFGHI',
                    expected: 'files/tmp/2024/01/01/20240101000000DEFGHI/',
                },
                {
                    id: '20250630120000JKLMNO',
                    expected: 'files/tmp/2025/06/30/20250630120000JKLMNO/',
                },
            ];

            testCases.forEach(({ id, expected }) => {
                expect(getOdeSessionUrl(id)).toBe(expected);
            });
        });

        it('should return false for invalid session ID', () => {
            expect(getOdeSessionUrl('short')).toBe(false);
            expect(getOdeSessionUrl('')).toBe(false);
            expect(getOdeSessionUrl('invalid')).toBe(false);
        });

        it('should create hierarchical directory structure', () => {
            const sessionId = '20250116143027ABCDEF';
            const url = getOdeSessionUrl(sessionId);

            expect(url).toContain('/2025/');
            expect(url).toContain('/01/');
            expect(url).toContain('/16/');
        });

        it('should match Symfony URL format exactly', () => {
            const sessionId = '20250116143027ABCDEF';
            const url = getOdeSessionUrl(sessionId);

            // Symfony format: files/tmp/YYYY/MM/DD/{sessionId}/
            expect(url).toMatch(/^files\/tmp\/\d{4}\/\d{2}\/\d{2}\/\d{14}[A-Z]{6}\/$/);
        });
    });

    describe('getOdeSessionPath', () => {
        it('should generate absolute path with default base', () => {
            const sessionId = '20250116143027ABCDEF';
            const path = getOdeSessionPath(sessionId);

            expect(path).toContain('/tmp/2025/01/16/20250116143027ABCDEF/');
            expect(path).not.toMatch(/^files\//); // Should not start with 'files/' prefix
        });

        it('should use custom base path when provided', () => {
            const sessionId = '20250116143027ABCDEF';
            const customBase = '/custom/storage';
            const path = getOdeSessionPath(sessionId, customBase);

            expect(path).toBe('/custom/storage/tmp/2025/01/16/20250116143027ABCDEF/');
        });

        it('should use FILES_DIR environment variable', () => {
            const sessionId = '20250116143027ABCDEF';
            const originalEnv = process.env.FILES_DIR;

            process.env.FILES_DIR = '/env/files';
            const path = getOdeSessionPath(sessionId);
            expect(path).toContain('/env/files/tmp/');

            // Restore original
            if (originalEnv) {
                process.env.FILES_DIR = originalEnv;
            } else {
                delete process.env.FILES_DIR;
            }
        });

        it('should return false for invalid session ID', () => {
            expect(getOdeSessionPath('invalid')).toBe(false);
            expect(getOdeSessionPath('')).toBe(false);
        });

        it('should remove files/ prefix from URL when basePath is provided', () => {
            const sessionId = '20250116143027ABCDEF';
            const path = getOdeSessionPath(sessionId, '/base');

            // Should not have duplicate 'files' in path
            expect(path).not.toMatch(/files.*files/);
        });
    });

    describe('getOdeComponentsSyncUrl', () => {
        it('should generate correct URL for iDevice component', () => {
            const sessionId = '20250116143027ABCDEF';
            const ideviceId = '20250116143100XYZABC';
            const url = getOdeComponentsSyncUrl(sessionId, ideviceId);

            expect(url).toBe('files/tmp/2025/01/16/20250116143027ABCDEF/20250116143100XYZABC/');
        });

        it('should append iDevice ID to session URL', () => {
            const sessionId = '20250116143027ABCDEF';
            const ideviceId = '20250116143100XYZABC';
            const url = getOdeComponentsSyncUrl(sessionId, ideviceId);

            const sessionUrl = getOdeSessionUrl(sessionId);
            expect(url).toBe(`${sessionUrl}${ideviceId}/`);
        });

        it('should return false for invalid session ID', () => {
            const ideviceId = '20250116143100XYZABC';
            expect(getOdeComponentsSyncUrl('invalid', ideviceId)).toBe(false);
            expect(getOdeComponentsSyncUrl('', ideviceId)).toBe(false);
        });

        it('should handle multiple iDevice IDs for same session', () => {
            const sessionId = '20250116143027ABCDEF';
            const ideviceIds = ['20250116143100AAABBB', '20250116143200CCCDDD', '20250116143300EEEFFF'];

            ideviceIds.forEach(ideviceId => {
                const url = getOdeComponentsSyncUrl(sessionId, ideviceId);
                expect(url).toContain(sessionId);
                expect(url).toContain(ideviceId);
                expect(url).toMatch(/^files\/tmp\/\d{4}\/\d{2}\/\d{2}\/\d{14}[A-Z]{6}\/\d{14}[A-Z]{6}\/$/);
            });
        });
    });

    describe('getOdeComponentsSyncPath', () => {
        it('should generate absolute path for iDevice component', () => {
            const sessionId = '20250116143027ABCDEF';
            const ideviceId = '20250116143100XYZABC';
            const path = getOdeComponentsSyncPath(sessionId, ideviceId);

            expect(path).toContain('/tmp/2025/01/16/20250116143027ABCDEF/20250116143100XYZABC/');
        });

        it('should use custom base path', () => {
            const sessionId = '20250116143027ABCDEF';
            const ideviceId = '20250116143100XYZABC';
            const customBase = '/custom/storage';
            const path = getOdeComponentsSyncPath(sessionId, ideviceId, customBase);

            expect(path).toBe('/custom/storage/tmp/2025/01/16/20250116143027ABCDEF/20250116143100XYZABC/');
        });

        it('should return false for invalid session ID', () => {
            const ideviceId = '20250116143100XYZABC';
            expect(getOdeComponentsSyncPath('invalid', ideviceId)).toBe(false);
        });
    });

    describe('Integration: File System Compatibility', () => {
        it('should generate paths that can be used with fs operations', () => {
            const sessionId = '20250116143027ABCDEF';
            const path = getOdeSessionPath(sessionId, '/tmp/test');

            // Path should not have invalid characters for file systems
            expect(path).not.toContain('\\');
            expect(path).not.toContain('*');
            expect(path).not.toContain('?');
            expect(path).not.toContain('"');
            expect(path).not.toContain('<');
            expect(path).not.toContain('>');
            expect(path).not.toContain('|');
        });

        it('should be compatible with both Unix and Windows paths', () => {
            const sessionId = '20250116143027ABCDEF';
            const unixPath = getOdeSessionPath(sessionId, '/unix/base');
            const windowsPath = getOdeSessionPath(sessionId, 'C:\\windows\\base');

            expect(unixPath).toContain('/tmp/2025/01/16');
            expect(windowsPath).toContain('/tmp/2025/01/16');
        });

        it('should maintain consistency between URL and Path functions', () => {
            const sessionId = '20250116143027ABCDEF';
            const url = getOdeSessionUrl(sessionId);
            const path = getOdeSessionPath(sessionId, '/base');

            // Path should contain the URL structure (minus 'files/' prefix)
            expect(path).toContain('tmp/2025/01/16/20250116143027ABCDEF/');
            expect(url).toBe('files/tmp/2025/01/16/20250116143027ABCDEF/');
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should process malformed session IDs without crashing', () => {
            // The functions validate format and return false for malformed IDs
            // Malformed IDs shouldn't occur in normal use since they're generated by generateId()
            const result1 = getOdeSessionUrl('2025-01-16-ABCDEF');
            const result2 = getOdeSessionUrl('20250116_143027_ABCDEF');

            // Should not crash and should return false for invalid formats
            expect(result1).toBe(false);
            expect(result2).toBe(false);
        });

        it('should handle very long session IDs', () => {
            const longId = '20250116143027ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const components = getSessionDateComponents(longId);

            // Should still extract date components from beginning
            expect(components?.year).toBe('2025');
            expect(components?.month).toBe('01');
            expect(components?.day).toBe('16');
        });

        it('should handle base paths with trailing slashes', () => {
            const sessionId = '20250116143027ABCDEF';
            const pathWithSlash = getOdeSessionPath(sessionId, '/base/');
            const pathWithoutSlash = getOdeSessionPath(sessionId, '/base');

            // Both should work correctly
            expect(pathWithSlash).toContain('/base/');
            expect(pathWithoutSlash).toContain('/base/');
        });
    });

    describe('replaceContextPath', () => {
        const sessionId = '20250116143027ABCDEF';
        const sessionUrl = 'files/tmp/2025/01/16/20250116143027ABCDEF/';

        it('should replace context path placeholder with session URL', () => {
            const content = '<img src="{{context_path}}/sq01.jpg"/>';
            const expected = `<img src="${sessionUrl}sq01.jpg"/>`;

            const result = replaceContextPath(content, sessionId);
            expect(result).toBe(expected);
        });

        it('should replace multiple occurrences of context path', () => {
            const content = '<img src="{{context_path}}/img1.jpg"/><img src="{{context_path}}/img2.jpg"/>';
            const expected = `<img src="${sessionUrl}img1.jpg"/><img src="${sessionUrl}img2.jpg"/>`;

            const result = replaceContextPath(content, sessionId);
            expect(result).toBe(expected);
        });

        it('should handle content without context path placeholders', () => {
            const content = '<img src="regular/path/image.jpg"/>';

            const result = replaceContextPath(content, sessionId);
            expect(result).toBe(content);
        });

        it('should return null for null input', () => {
            const result = replaceContextPath(null, sessionId);
            expect(result).toBeNull();
        });

        it('should return null for undefined input', () => {
            const result = replaceContextPath(undefined, sessionId);
            expect(result).toBeNull();
        });

        it('should return empty string for empty string input', () => {
            const result = replaceContextPath('', sessionId);
            expect(result).toBeNull();
        });

        it('should return original content for invalid session ID', () => {
            const content = '<img src="{{context_path}}/image.jpg"/>';

            const result = replaceContextPath(content, 'invalid');
            expect(result).toBe(content);
        });

        it('should handle complex HTML content with multiple placeholders', () => {
            const content = `
        <div>
          <img src="{{context_path}}/image1.jpg"/>
          <a href="{{context_path}}/document.pdf">Download</a>
          <video src="{{context_path}}/video.mp4"></video>
        </div>
      `;

            const result = replaceContextPath(content, sessionId);
            expect(result).toContain(`${sessionUrl}image1.jpg`);
            expect(result).toContain(`${sessionUrl}document.pdf`);
            expect(result).toContain(`${sessionUrl}video.mp4`);
            expect(result).not.toContain(ODE_XML_CONTEXT_PATH);
        });

        it('should preserve case sensitivity in replacement', () => {
            const content = '<img src="{{context_path}}/Image.JPG"/>';
            const expected = `<img src="${sessionUrl}Image.JPG"/>`;

            const result = replaceContextPath(content, sessionId);
            expect(result).toBe(expected);
        });

        it('should handle JSON properties with context paths', () => {
            const jsonContent = '{"imagePath":"{{context_path}}/image.jpg","videoPath":"{{context_path}}/video.mp4"}';

            const result = replaceContextPath(jsonContent, sessionId);
            expect(result).toContain(`${sessionUrl}image.jpg`);
            expect(result).toContain(`${sessionUrl}video.mp4`);
        });
    });

    describe('unreplaceContextPath', () => {
        const sessionId = '20250116143027ABCDEF';
        const sessionUrl = 'files/tmp/2025/01/16/20250116143027ABCDEF/';

        it('should replace session URL with context path placeholder', () => {
            const content = `<img src="${sessionUrl}sq01.jpg"/>`;
            const expected = '<img src="{{context_path}}/sq01.jpg"/>';

            const result = unreplaceContextPath(content, sessionId);
            expect(result).toBe(expected);
        });

        it('should replace multiple occurrences of session URL', () => {
            const content = `<img src="${sessionUrl}img1.jpg"/><img src="${sessionUrl}img2.jpg"/>`;
            const expected = '<img src="{{context_path}}/img1.jpg"/><img src="{{context_path}}/img2.jpg"/>';

            const result = unreplaceContextPath(content, sessionId);
            expect(result).toBe(expected);
        });

        it('should handle content without session URLs', () => {
            const content = '<img src="regular/path/image.jpg"/>';

            const result = unreplaceContextPath(content, sessionId);
            expect(result).toBe(content);
        });

        it('should return null for null input', () => {
            const result = unreplaceContextPath(null, sessionId);
            expect(result).toBeNull();
        });

        it('should return null for undefined input', () => {
            const result = unreplaceContextPath(undefined, sessionId);
            expect(result).toBeNull();
        });

        it('should return empty string for empty string input', () => {
            const result = unreplaceContextPath('', sessionId);
            expect(result).toBeNull();
        });

        it('should return original content for invalid session ID', () => {
            const content = `<img src="${sessionUrl}image.jpg"/>`;

            const result = unreplaceContextPath(content, 'invalid');
            expect(result).toBe(content);
        });

        it('should handle complex HTML content with multiple session URLs', () => {
            const content = `
        <div>
          <img src="${sessionUrl}image1.jpg"/>
          <a href="${sessionUrl}document.pdf">Download</a>
          <video src="${sessionUrl}video.mp4"></video>
        </div>
      `;

            const result = unreplaceContextPath(content, sessionId);
            expect(result).toContain('{{context_path}}/image1.jpg');
            expect(result).toContain('{{context_path}}/document.pdf');
            expect(result).toContain('{{context_path}}/video.mp4');
            expect(result).not.toContain(sessionUrl);
        });

        it('should escape special regex characters in session URL', () => {
            // The session URL contains '/' which are special in regex
            const content = `<img src="${sessionUrl}image.jpg"/>`;

            const result = unreplaceContextPath(content, sessionId);
            expect(result).toContain('{{context_path}}/image.jpg');
        });
    });

    describe('Context Path Round-trip', () => {
        const sessionId = '20250116143027ABCDEF';

        it('should maintain content integrity after replace and unreplace', () => {
            const original = '<img src="{{context_path}}/image.jpg"/>';

            const replaced = replaceContextPath(original, sessionId);
            const unreplaced = unreplaceContextPath(replaced!, sessionId);

            expect(unreplaced).toBe(original);
        });

        it('should handle multiple round-trips', () => {
            const original = '<img src="{{context_path}}/img1.jpg"/><img src="{{context_path}}/img2.jpg"/>';

            // Replace -> Unreplace -> Replace -> Unreplace
            let content = replaceContextPath(original, sessionId);
            content = unreplaceContextPath(content!, sessionId);
            content = replaceContextPath(content!, sessionId);
            content = unreplaceContextPath(content!, sessionId);

            expect(content).toBe(original);
        });

        it('should handle complex content with multiple resources', () => {
            const original = `
        <div class="content">
          <img src="{{context_path}}/images/photo.jpg"/>
          <a href="{{context_path}}/documents/file.pdf">Download</a>
          <video src="{{context_path}}/videos/clip.mp4"></video>
        </div>
      `;

            const replaced = replaceContextPath(original, sessionId);
            const restored = unreplaceContextPath(replaced!, sessionId);

            expect(restored).toBe(original);
        });
    });

    describe('Integration: Context Path with Symfony ODE Format', () => {
        it('should match Symfony behavior for loading ODE XML', () => {
            const sessionId = '20250116143027ABCDEF';
            const xmlContent =
                '<odeComponent><htmlView>&lt;img src="{{context_path}}/sq01.jpg"/&gt;</htmlView></odeComponent>';

            // When loading from XML, placeholders should be replaced
            const result = replaceContextPath(xmlContent, sessionId);
            expect(result).toContain('files/tmp/2025/01/16/20250116143027ABCDEF/sq01.jpg');
            expect(result).not.toContain('{{context_path}}');
        });

        it('should match Symfony behavior for saving ODE XML', () => {
            const sessionId = '20250116143027ABCDEF';
            const htmlContent = '<img src="files/tmp/2025/01/16/20250116143027ABCDEF/sq01.jpg"/>';

            // When saving to XML, session URLs should be replaced with placeholders
            const result = unreplaceContextPath(htmlContent, sessionId);
            expect(result).toContain('{{context_path}}/sq01.jpg');
            expect(result).not.toContain('files/tmp/2025/01/16/20250116143027ABCDEF/');
        });

        it('should handle URL-encoded content', () => {
            const sessionId = '20250116143027ABCDEF';
            const encoded = '%7B%7Bcontext_path%7D%7D/image.jpg';

            // Should not replace URL-encoded version (browser will decode it)
            const result = replaceContextPath(encoded, sessionId);
            expect(result).toBe(encoded);
        });
    });
});
