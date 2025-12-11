/**
 * LibraryDetector Tests
 *
 * Tests for detecting required JS/CSS libraries from HTML content patterns.
 * Based on Symfony's ExportXmlUtil::getPathForLibrariesInIdevices() behavior.
 */

 

const LibraryDetector = require('./LibraryDetector');

describe('LibraryDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new LibraryDetector();
  });

  describe('constructor', () => {
    test('creates instance with empty detected libraries', () => {
      expect(detector.detectedLibraries).toBeDefined();
      expect(detector.detectedLibraries.size).toBe(0);
    });

    test('creates instance with empty files set', () => {
      expect(detector.filesToInclude).toBeDefined();
      expect(detector.filesToInclude.size).toBe(0);
    });
  });

  describe('getBaseLibraries', () => {
    test('returns array of base library files', () => {
      const base = detector.getBaseLibraries();

      expect(Array.isArray(base)).toBe(true);
      expect(base.length).toBeGreaterThan(0);
    });

    test('includes jQuery', () => {
      const base = detector.getBaseLibraries();

      expect(base).toContain('jquery/jquery.min.js');
    });

    test('includes Bootstrap JS and CSS', () => {
      const base = detector.getBaseLibraries();

      expect(base).toContain('bootstrap/bootstrap.bundle.min.js');
      expect(base).toContain('bootstrap/bootstrap.min.css');
    });

    test('includes common eXe scripts', () => {
      const base = detector.getBaseLibraries();

      expect(base).toContain('common.js');
      expect(base).toContain('common_i18n.js');
      expect(base).toContain('exe_export.js');
    });

    test('returns a copy, not the original array', () => {
      const base1 = detector.getBaseLibraries();
      const base2 = detector.getBaseLibraries();

      expect(base1).not.toBe(base2);
      expect(base1).toEqual(base2);
    });
  });

  describe('getScormLibraries', () => {
    test('returns array of SCORM library files', () => {
      const scorm = detector.getScormLibraries();

      expect(Array.isArray(scorm)).toBe(true);
      expect(scorm.length).toBeGreaterThan(0);
    });

    test('includes SCORM API wrapper', () => {
      const scorm = detector.getScormLibraries();

      expect(scorm).toContain('scorm/SCORM_API_wrapper.js');
    });

    test('includes SCOFunctions', () => {
      const scorm = detector.getScormLibraries();

      expect(scorm).toContain('scorm/SCOFunctions.js');
    });
  });

  describe('detectLibraries', () => {
    describe('exe_effects (exe-fx class)', () => {
      test('detects exe-fx class in HTML', () => {
        const html = '<div class="exe-fx slide-up">Content</div>';
        const result = detector.detectLibraries(html);

        expect(result.libraries.some(l => l.name === 'exe_effects')).toBe(true);
        expect(result.files).toContain('exe_effects/exe_effects.js');
        expect(result.files).toContain('exe_effects/exe_effects.css');
      });

      test('detects exe-fx with other classes', () => {
        const html = '<div class="my-class exe-fx another-class">Content</div>';
        const result = detector.detectLibraries(html);

        expect(result.libraries.some(l => l.name === 'exe_effects')).toBe(true);
      });

      test('does not detect if no exe-fx class', () => {
        const html = '<div class="normal-class">Content</div>';
        const result = detector.detectLibraries(html);

        expect(result.libraries.some(l => l.name === 'exe_effects')).toBe(false);
      });
    });

    describe('exe_games (exe-game class)', () => {
      test('detects exe-game class', () => {
        const html = '<div class="exe-game">Game content</div>';
        const result = detector.detectLibraries(html);

        expect(result.libraries.some(l => l.name === 'exe_games')).toBe(true);
        expect(result.files).toContain('exe_games/exe_games.js');
      });
    });

    describe('exe_highlighter (highlighted-code class)', () => {
      test('detects highlighted-code class', () => {
        const html = '<pre class="highlighted-code">function foo() {}</pre>';
        const result = detector.detectLibraries(html);

        expect(result.libraries.some(l => l.name === 'exe_highlighter')).toBe(true);
        expect(result.files).toContain('exe_highlighter/exe_highlighter.js');
        expect(result.files).toContain('exe_highlighter/exe_highlighter.css');
      });
    });

    describe('exe_lightbox (rel=lightbox)', () => {
      test('detects rel="lightbox" attribute', () => {
        const html = '<a href="image.jpg" rel="lightbox"><img src="thumb.jpg"></a>';
        const result = detector.detectLibraries(html);

        expect(result.libraries.some(l => l.name === 'exe_lightbox')).toBe(true);
        expect(result.files).toContain('exe_lightbox/exe_lightbox.js');
        expect(result.files).toContain('exe_lightbox/exe_lightbox.css');
      });

      test('detects lightbox with gallery group', () => {
        const html = '<a href="img1.jpg" rel="lightbox[gallery1]"><img src="t1.jpg"></a>';
        const result = detector.detectLibraries(html);

        expect(result.libraries.some(l => l.name === 'exe_lightbox')).toBe(true);
      });
    });

    describe('exe_lightbox (imageGallery class)', () => {
      test('detects imageGallery class', () => {
        const html = '<div class="imageGallery">Gallery content</div>';
        const result = detector.detectLibraries(html);

        expect(result.libraries.some(l => l.name === 'exe_lightbox_gallery')).toBe(true);
        expect(result.files).toContain('exe_lightbox/exe_lightbox.js');
      });
    });

    describe('exe_tooltips (exe-tooltip class)', () => {
      test('detects exe-tooltip class', () => {
        const html = '<span class="exe-tooltip" title="Info">Text</span>';
        const result = detector.detectLibraries(html);

        expect(result.libraries.some(l => l.name === 'exe_tooltips')).toBe(true);
        expect(result.files).toContain('exe_tooltips/exe_tooltips.js');
        expect(result.files).toContain('exe_tooltips/jquery.qtip.min.js');
      });
    });

    describe('exe_magnify (ImageMagnifierIdevice class)', () => {
      test('detects ImageMagnifierIdevice class', () => {
        const html = '<div class="ImageMagnifierIdevice">Image magnifier</div>';
        const result = detector.detectLibraries(html);

        expect(result.libraries.some(l => l.name === 'exe_magnify')).toBe(true);
        expect(result.files).toContain('exe_magnify/mojomagnify.js');
      });
    });

    describe('exe_wikipedia (exe-wikipedia-content class)', () => {
      test('detects exe-wikipedia-content class', () => {
        const html = '<div class="exe-wikipedia-content">Wikipedia article</div>';
        const result = detector.detectLibraries(html);

        expect(result.libraries.some(l => l.name === 'exe_wikipedia')).toBe(true);
        expect(result.files).toContain('exe_wikipedia/exe_wikipedia.css');
      });
    });

    describe('exe_media (mediaelement class)', () => {
      test('detects mediaelement class', () => {
        const html = '<div class="mediaelement"><audio src="file.mp3"></audio></div>';
        const result = detector.detectLibraries(html);

        expect(result.libraries.some(l => l.name === 'exe_media')).toBe(true);
        expect(result.files).toContain('exe_media/exe_media.js');
        expect(result.files).toContain('exe_media/exe_media.css');
      });
    });

    describe('exe_media (media file links with lightbox)', () => {
      test('detects mp3 links with lightbox rel', () => {
        const html = '<a href="audio.mp3" rel="lightbox">Play audio</a>';
        const result = detector.detectLibraries(html);

        expect(result.libraries.some(l => l.name === 'exe_media_link')).toBe(true);
        expect(result.files).toContain('exe_media/exe_media.js');
      });

      test('detects mp4 links with lightbox rel', () => {
        const html = '<a href="video.mp4" rel="lightbox">Watch video</a>';
        const result = detector.detectLibraries(html);

        expect(result.libraries.some(l => l.name === 'exe_media_link')).toBe(true);
      });

      test('detects ogg links with lightbox rel', () => {
        const html = '<a href="audio.ogg" rel="lightbox[media]">Play</a>';
        const result = detector.detectLibraries(html);

        expect(result.libraries.some(l => l.name === 'exe_media_link')).toBe(true);
      });
    });

    describe('abcjs (abc-music class)', () => {
      test('detects abc-music class', () => {
        const html = '<div class="abc-music">X:1\nT:Title\nM:4/4</div>';
        const result = detector.detectLibraries(html);

        expect(result.libraries.some(l => l.name === 'abcjs')).toBe(true);
        expect(result.files).toContain('abcjs/abcjs-basic-min.js');
        expect(result.files).toContain('abcjs/exe_abc_music.js');
      });
    });

    describe('exe_math (LaTeX expressions)', () => {
      test('detects inline LaTeX \\(...\\)', () => {
        const html = '<p>The formula is \\(x^2 + y^2 = r^2\\)</p>';
        const result = detector.detectLibraries(html);

        expect(result.libraries.some(l => l.name === 'exe_math')).toBe(true);
        expect(result.files).toContain('exe_math/tex-mml-svg.js');
      });

      test('detects display LaTeX \\[...\\]', () => {
        const html = '<p>\\[\\sum_{i=1}^{n} x_i\\]</p>';
        const result = detector.detectLibraries(html);

        expect(result.libraries.some(l => l.name === 'exe_math')).toBe(true);
      });

      test('does not detect without LaTeX delimiters', () => {
        const html = '<p>Normal text without math</p>';
        const result = detector.detectLibraries(html);

        expect(result.libraries.some(l => l.name === 'exe_math')).toBe(false);
      });
    });

    describe('mermaid (mermaid class)', () => {
      test('detects mermaid class', () => {
        const html = '<div class="mermaid">graph TD; A-->B;</div>';
        const result = detector.detectLibraries(html);

        expect(result.libraries.some(l => l.name === 'mermaid')).toBe(true);
        expect(result.files).toContain('mermaid/mermaid.min.js');
      });
    });

    describe('jquery-ui (sortable iDevices)', () => {
      test('detects ordena-IDevice class', () => {
        const html = '<div class="ordena-IDevice">Sortable items</div>';
        const result = detector.detectLibraries(html);

        expect(result.files).toContain('jquery-ui/jquery-ui.min.js');
      });

      test('detects clasifica-IDevice class', () => {
        const html = '<div class="clasifica-IDevice">Classification</div>';
        const result = detector.detectLibraries(html);

        expect(result.files).toContain('jquery-ui/jquery-ui.min.js');
      });

      test('detects relaciona-IDevice class', () => {
        const html = '<div class="relaciona-IDevice">Matching</div>';
        const result = detector.detectLibraries(html);

        expect(result.files).toContain('jquery-ui/jquery-ui.min.js');
      });

      test('detects dragdrop-IDevice class', () => {
        const html = '<div class="dragdrop-IDevice">Drag and drop</div>';
        const result = detector.detectLibraries(html);

        expect(result.files).toContain('jquery-ui/jquery-ui.min.js');
      });

      test('detects completa-IDevice class', () => {
        const html = '<div class="completa-IDevice">Fill in blanks</div>';
        const result = detector.detectLibraries(html);

        expect(result.files).toContain('jquery-ui/jquery-ui.min.js');
      });
    });

    describe('accessibility toolbar option', () => {
      test('includes exe_atools when option is true', () => {
        const html = '<div>Normal content</div>';
        const result = detector.detectLibraries(html, { includeAccessibilityToolbar: true });

        expect(result.libraries.some(l => l.name === 'exe_atools')).toBe(true);
        expect(result.files).toContain('exe_atools/exe_atools.js');
        expect(result.files).toContain('exe_atools/exe_atools.css');
      });

      test('does not include exe_atools when option is false', () => {
        const html = '<div>Normal content</div>';
        const result = detector.detectLibraries(html, { includeAccessibilityToolbar: false });

        expect(result.libraries.some(l => l.name === 'exe_atools')).toBe(false);
      });
    });

    describe('multiple libraries detection', () => {
      test('detects multiple libraries in same content', () => {
        const html = `
          <div class="exe-fx">Effects</div>
          <a href="img.jpg" rel="lightbox">Image</a>
          <div class="mermaid">graph TD</div>
          <p>\\(x^2\\)</p>
        `;
        const result = detector.detectLibraries(html);

        expect(result.count).toBeGreaterThanOrEqual(4);
        expect(result.files).toContain('exe_effects/exe_effects.js');
        expect(result.files).toContain('exe_lightbox/exe_lightbox.js');
        expect(result.files).toContain('mermaid/mermaid.min.js');
        expect(result.files).toContain('exe_math/tex-mml-svg.js');
      });

      test('does not duplicate files when same library detected multiple times', () => {
        const html = `
          <div class="exe-fx">Effect 1</div>
          <div class="exe-fx">Effect 2</div>
          <div class="exe-fx">Effect 3</div>
        `;
        const result = detector.detectLibraries(html);

        // Count occurrences of exe_effects.js
        const jsCount = result.files.filter(f => f === 'exe_effects/exe_effects.js').length;
        expect(jsCount).toBe(1);
      });
    });

    describe('empty and null input handling', () => {
      test('returns empty result for null input', () => {
        const result = detector.detectLibraries(null);

        expect(result.libraries).toEqual([]);
        expect(result.files).toEqual([]);
        expect(result.count).toBe(0);
      });

      test('returns empty result for undefined input', () => {
        const result = detector.detectLibraries(undefined);

        expect(result.libraries).toEqual([]);
        expect(result.files).toEqual([]);
      });

      test('returns empty result for empty string', () => {
        const result = detector.detectLibraries('');

        expect(result.libraries).toEqual([]);
        expect(result.files).toEqual([]);
      });

      test('returns empty result for non-string input', () => {
        const result = detector.detectLibraries(123);

        expect(result.libraries).toEqual([]);
      });
    });
  });

  describe('getAllRequiredFiles', () => {
    test('includes base libraries', () => {
      const files = detector.getAllRequiredFiles('<div>Simple content</div>');

      expect(files).toContain('jquery/jquery.min.js');
      expect(files).toContain('bootstrap/bootstrap.bundle.min.js');
      expect(files).toContain('common.js');
    });

    test('includes detected libraries', () => {
      const html = '<div class="exe-fx">Effects</div>';
      const files = detector.getAllRequiredFiles(html);

      expect(files).toContain('jquery/jquery.min.js'); // base
      expect(files).toContain('exe_effects/exe_effects.js'); // detected
    });

    test('includes SCORM libraries when option is true', () => {
      const files = detector.getAllRequiredFiles('<div>Content</div>', { includeScorm: true });

      expect(files).toContain('scorm/SCORM_API_wrapper.js');
      expect(files).toContain('scorm/SCOFunctions.js');
    });

    test('does not include SCORM libraries when option is false', () => {
      const files = detector.getAllRequiredFiles('<div>Content</div>', { includeScorm: false });

      expect(files).not.toContain('scorm/SCORM_API_wrapper.js');
    });

    test('does not duplicate files', () => {
      const html = '<div class="exe-fx">Effects</div>';
      const files = detector.getAllRequiredFiles(html);

      const uniqueFiles = [...new Set(files)];
      expect(files.length).toBe(uniqueFiles.length);
    });
  });

  describe('groupFilesByType', () => {
    test('separates JS and CSS files', () => {
      const files = [
        'jquery/jquery.min.js',
        'bootstrap/bootstrap.min.css',
        'exe_effects/exe_effects.js',
        'exe_effects/exe_effects.css',
      ];

      const grouped = detector.groupFilesByType(files);

      expect(grouped.js).toContain('jquery/jquery.min.js');
      expect(grouped.js).toContain('exe_effects/exe_effects.js');
      expect(grouped.css).toContain('bootstrap/bootstrap.min.css');
      expect(grouped.css).toContain('exe_effects/exe_effects.css');
    });

    test('handles files without extension', () => {
      const files = ['somefile', 'another'];
      const grouped = detector.groupFilesByType(files);

      expect(grouped.js).toEqual([]);
      expect(grouped.css).toEqual([]);
    });

    test('handles empty array', () => {
      const grouped = detector.groupFilesByType([]);

      expect(grouped.js).toEqual([]);
      expect(grouped.css).toEqual([]);
    });
  });

  describe('case sensitivity', () => {
    test('class matching is case insensitive', () => {
      const html = '<div class="EXE-FX">Content</div>';
      const result = detector.detectLibraries(html);

      expect(result.libraries.some(l => l.name === 'exe_effects')).toBe(true);
    });

    test('rel matching is case insensitive', () => {
      const html = '<a href="img.jpg" rel="LIGHTBOX">Image</a>';
      const result = detector.detectLibraries(html);

      expect(result.libraries.some(l => l.name === 'exe_lightbox')).toBe(true);
    });
  });

  describe('static properties', () => {
    test('LIBRARY_PATTERNS is defined', () => {
      expect(LibraryDetector.LIBRARY_PATTERNS).toBeDefined();
      expect(Array.isArray(LibraryDetector.LIBRARY_PATTERNS)).toBe(true);
      expect(LibraryDetector.LIBRARY_PATTERNS.length).toBeGreaterThan(0);
    });

    test('BASE_LIBRARIES is defined', () => {
      expect(LibraryDetector.BASE_LIBRARIES).toBeDefined();
      expect(Array.isArray(LibraryDetector.BASE_LIBRARIES)).toBe(true);
    });

    test('SCORM_LIBRARIES is defined', () => {
      expect(LibraryDetector.SCORM_LIBRARIES).toBeDefined();
      expect(Array.isArray(LibraryDetector.SCORM_LIBRARIES)).toBe(true);
    });
  });
});
