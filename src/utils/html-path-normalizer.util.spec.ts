import { normalizeHtmlPaths, hasWindowsPaths } from './html-path-normalizer.util';

describe('HTML Path Normalizer Utility', () => {
    describe('normalizeHtmlPaths', () => {
        it('should convert backslashes to forward slashes in src attributes', () => {
            const html = '<img src="resources\\image.jpg" alt="test">';
            const result = normalizeHtmlPaths(html);
            expect(result).toBe('<img src="resources/image.jpg" alt="test">');
        });

        it('should convert backslashes to forward slashes in href attributes', () => {
            const html = '<a href="documents\\file.pdf">Download</a>';
            const result = normalizeHtmlPaths(html);
            expect(result).toBe('<a href="documents/file.pdf">Download</a>');
        });

        it('should handle multiple backslashes in paths', () => {
            const html = '<img src="content\\resources\\20251009090601ROYVYO\\sq01.jpg">';
            const result = normalizeHtmlPaths(html);
            expect(result).toBe('<img src="content/resources/20251009090601ROYVYO/sq01.jpg">');
        });

        it('should handle single quotes in attributes', () => {
            const html = "<img src='resources\\image.jpg'>";
            const result = normalizeHtmlPaths(html);
            expect(result).toBe("<img src='resources/image.jpg'>");
        });

        it('should handle multiple attributes in same tag', () => {
            const html = '<video poster="videos\\thumb.jpg" src="videos\\movie.mp4"></video>';
            const result = normalizeHtmlPaths(html);
            expect(result).toBe('<video poster="videos/thumb.jpg" src="videos/movie.mp4"></video>');
        });

        it('should handle srcset attribute with multiple paths', () => {
            const html = '<source srcset="images\\small\\pic.jpg 480w, images\\large\\pic.jpg 800w">';
            const result = normalizeHtmlPaths(html);
            expect(result).toBe('<source srcset="images/small/pic.jpg 480w, images/large/pic.jpg 800w">');
        });

        it('should handle data attributes', () => {
            const html = '<div data-src="path\\to\\file.js"></div>';
            const result = normalizeHtmlPaths(html);
            expect(result).toBe('<div data-src="path/to/file.js"></div>');
        });

        it('should handle mixed forward and backslashes', () => {
            const html = '<img src="resources/subfolder\\image.png">';
            const result = normalizeHtmlPaths(html);
            expect(result).toBe('<img src="resources/subfolder/image.png">');
        });

        it('should not affect content without paths', () => {
            const html = '<p>Simple text content</p>';
            const result = normalizeHtmlPaths(html);
            expect(result).toBe('<p>Simple text content</p>');
        });

        it('should handle null input', () => {
            const result = normalizeHtmlPaths(null);
            expect(result).toBe('');
        });

        it('should handle undefined input', () => {
            const result = normalizeHtmlPaths(undefined);
            expect(result).toBe('');
        });

        it('should handle empty string', () => {
            const result = normalizeHtmlPaths('');
            expect(result).toBe('');
        });

        it('should preserve paths that already use forward slashes', () => {
            const html = '<img src="resources/image.jpg">';
            const result = normalizeHtmlPaths(html);
            expect(result).toBe('<img src="resources/image.jpg">');
        });

        it('should handle complex HTML with multiple elements', () => {
            const html = `
        <div>
          <img src="images\\photo1.jpg">
          <a href="docs\\manual.pdf">Manual</a>
          <video poster="videos\\thumb\\preview.jpg" src="videos\\clip.mp4"></video>
        </div>
      `;
            const result = normalizeHtmlPaths(html);
            expect(result).toContain('src="images/photo1.jpg"');
            expect(result).toContain('href="docs/manual.pdf"');
            expect(result).toContain('poster="videos/thumb/preview.jpg"');
            expect(result).toContain('src="videos/clip.mp4"');
            expect(result).not.toContain('\\');
        });

        it('should handle case-insensitive attribute names', () => {
            const html = '<IMG SRC="images\\photo.jpg" HREF="docs\\file.pdf">';
            const result = normalizeHtmlPaths(html);
            expect(result).toBe('<IMG SRC="images/photo.jpg" HREF="docs/file.pdf">');
        });

        it('should handle form action attributes', () => {
            const html = '<form action="scripts\\submit.php"></form>';
            const result = normalizeHtmlPaths(html);
            expect(result).toBe('<form action="scripts/submit.php"></form>');
        });

        it('should not modify backslashes in text content', () => {
            const html = '<p>This is a backslash: \\ in text</p><img src="path\\image.jpg">';
            const result = normalizeHtmlPaths(html);
            expect(result).toContain('This is a backslash: \\ in text');
            expect(result).toContain('src="path/image.jpg"');
        });
    });

    describe('hasWindowsPaths', () => {
        it('should detect Windows paths in src attributes', () => {
            const html = '<img src="resources\\image.jpg">';
            expect(hasWindowsPaths(html)).toBe(true);
        });

        it('should detect Windows paths in href attributes', () => {
            const html = '<a href="docs\\file.pdf">Link</a>';
            expect(hasWindowsPaths(html)).toBe(true);
        });

        it('should return false for Unix paths', () => {
            const html = '<img src="resources/image.jpg">';
            expect(hasWindowsPaths(html)).toBe(false);
        });

        it('should return false for null input', () => {
            expect(hasWindowsPaths(null)).toBe(false);
        });

        it('should return false for undefined input', () => {
            expect(hasWindowsPaths(undefined)).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(hasWindowsPaths('')).toBe(false);
        });

        it('should return false for text without paths', () => {
            const html = '<p>Simple text content</p>';
            expect(hasWindowsPaths(html)).toBe(false);
        });
    });
});
