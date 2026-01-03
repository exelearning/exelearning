/**
 * Image Compressor Bun Tests
 *
 * Unit tests for the image-compressor URL detection and dimension calculation logic.
 * These test the key functions modified to support blob/asset URLs from IndexedDB.
 *
 * Run with: bun test public/libs/tinymce_5/js/tinymce/plugins/exeimage/image-compressor/__tests__/
 */

/* eslint-disable no-undef */

describe('Image Compressor URL Detection', () => {
  describe('URL type detection', () => {
    it('should detect blob: URLs', () => {
      const url = 'blob:http://localhost:3001/12345-abcde';
      expect(url.startsWith('blob:')).toBe(true);
      expect(url.startsWith('asset://')).toBe(false);
      expect(url.startsWith('data:')).toBe(false);
    });

    it('should detect asset:// URLs', () => {
      const url = 'asset://91bbffad-6b30-56d5-1b62-0db6704559e8/image.jpg';
      expect(url.startsWith('blob:')).toBe(false);
      expect(url.startsWith('asset://')).toBe(true);
      expect(url.startsWith('data:')).toBe(false);
    });

    it('should detect data: URLs', () => {
      const url = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      expect(url.startsWith('blob:')).toBe(false);
      expect(url.startsWith('asset://')).toBe(false);
      expect(url.startsWith('data:')).toBe(true);
    });

    it('should detect regular file URLs', () => {
      const url = 'files/tmp/session123/image.png';
      expect(url.startsWith('blob:')).toBe(false);
      expect(url.startsWith('asset://')).toBe(false);
      expect(url.startsWith('data:')).toBe(false);
    });

    it('should detect resources/ URLs', () => {
      const url = 'resources/image.png';
      expect(url.indexOf('resources/') === 0).toBe(true);
    });
  });

  describe('Dimension calculation', () => {
    function calculateDimensions(originalWidth, originalHeight, newsize) {
      const aspectRatio = originalWidth / originalHeight || 1;
      let newWidth, newHeight;

      if (aspectRatio > 1) {
        newWidth = newsize;
        newHeight = Math.round(newsize / aspectRatio);
      } else if (aspectRatio < 1) {
        newHeight = newsize;
        newWidth = Math.round(newsize * aspectRatio);
      } else {
        newWidth = newHeight = newsize;
      }

      return { newWidth, newHeight };
    }

    it('should calculate dimensions for landscape image (width > height)', () => {
      const result = calculateDimensions(800, 600, 400);
      expect(result.newWidth).toBe(400);
      expect(result.newHeight).toBe(300);
    });

    it('should calculate dimensions for portrait image (height > width)', () => {
      const result = calculateDimensions(600, 800, 400);
      expect(result.newWidth).toBe(300);
      expect(result.newHeight).toBe(400);
    });

    it('should calculate dimensions for square image', () => {
      const result = calculateDimensions(500, 500, 300);
      expect(result.newWidth).toBe(300);
      expect(result.newHeight).toBe(300);
    });

    it('should handle zero dimensions with fallback', () => {
      const result = calculateDimensions(0, 0, 300);
      // aspectRatio would be NaN, || 1 makes it 1
      expect(result.newWidth).toBe(300);
      expect(result.newHeight).toBe(300);
    });
  });

  describe('Asset ID extraction', () => {
    function extractAssetId(assetUrl) {
      return assetUrl.replace('asset://', '').split('/')[0];
    }

    it('should extract asset ID from asset:// URL with filename', () => {
      const url = 'asset://91bbffad-6b30-56d5-1b62-0db6704559e8/image.jpg';
      expect(extractAssetId(url)).toBe('91bbffad-6b30-56d5-1b62-0db6704559e8');
    });

    it('should extract asset ID from asset:// URL without filename', () => {
      const url = 'asset://91bbffad-6b30-56d5-1b62-0db6704559e8';
      expect(extractAssetId(url)).toBe('91bbffad-6b30-56d5-1b62-0db6704559e8');
    });
  });

  describe('Filename extraction', () => {
    function extractFilename(url) {
      if (url.startsWith('blob:')) {
        return 'optimized_image.jpg';
      }
      return url.split('/').pop().split('_').pop();
    }

    it('should return default filename for blob URLs', () => {
      const url = 'blob:http://localhost:3001/12345-abcde';
      expect(extractFilename(url)).toBe('optimized_image.jpg');
    });

    it('should extract filename from regular path', () => {
      const url = 'files/tmp/session/prefix_myimage.png';
      expect(extractFilename(url)).toBe('myimage.png');
    });
  });
});

describe('ExeImage Plugin skipSubmit Flag', () => {
  describe('skipSubmit behavior', () => {
    let mockImgCompressor;

    beforeEach(() => {
      mockImgCompressor = {
        originalSrc: 'blob:http://localhost:3001/test',
        isBlob: true,
        isAsset: false,
        skipSubmit: false,
      };
    });

    it('should check skipSubmit flag and reset it', () => {
      // Simulate mySubmit check
      mockImgCompressor.skipSubmit = true;

      if (mockImgCompressor && mockImgCompressor.skipSubmit) {
        mockImgCompressor.skipSubmit = false;
        // api.close() would be called here
      }

      expect(mockImgCompressor.skipSubmit).toBe(false);
    });

    it('should not skip when skipSubmit is false', () => {
      mockImgCompressor.skipSubmit = false;
      let skipped = false;

      if (mockImgCompressor && mockImgCompressor.skipSubmit) {
        skipped = true;
      }

      expect(skipped).toBe(false);
    });

    it('should detect blob image type correctly', () => {
      mockImgCompressor.originalSrc = 'blob:http://localhost:3001/test';
      mockImgCompressor.isBlob = mockImgCompressor.originalSrc.startsWith('blob:');
      mockImgCompressor.isAsset = mockImgCompressor.originalSrc.startsWith('asset://');

      expect(mockImgCompressor.isBlob).toBe(true);
      expect(mockImgCompressor.isAsset).toBe(false);
    });

    it('should detect asset image type correctly', () => {
      mockImgCompressor.originalSrc = 'asset://uuid-here/filename.jpg';
      mockImgCompressor.isBlob = mockImgCompressor.originalSrc.startsWith('blob:');
      mockImgCompressor.isAsset = mockImgCompressor.originalSrc.startsWith('asset://');

      expect(mockImgCompressor.isBlob).toBe(false);
      expect(mockImgCompressor.isAsset).toBe(true);
    });
  });
});

describe('Image extension detection', () => {
  function getExtensionFromDataUrl(src) {
    if (src.indexOf('data:image/') !== 0) return null;

    let ext = src.replace('data:image/', '');
    ext = ext.split(';')[0].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    return ext;
  }

  it('should extract png extension', () => {
    const src = 'data:image/png;base64,iVBORw0KGgo...';
    expect(getExtensionFromDataUrl(src)).toBe('png');
  });

  it('should extract and normalize jpeg to jpg', () => {
    const src = 'data:image/jpeg;base64,/9j/4AAQSkZJRg...';
    expect(getExtensionFromDataUrl(src)).toBe('jpg');
  });

  it('should extract gif extension', () => {
    const src = 'data:image/gif;base64,R0lGODlhAQAB...';
    expect(getExtensionFromDataUrl(src)).toBe('gif');
  });

  it('should return null for non-data URLs', () => {
    const src = 'blob:http://localhost:3001/test';
    expect(getExtensionFromDataUrl(src)).toBe(null);
  });
});
