/**
 * Unit tests for image-gallery iDevice (export/runtime)
 *
 * Tests configuration and basic functions.
 * Note: This file doesn't have auto-init call but uses eXe.app.isInExe().
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('image-gallery iDevice export', () => {
  let code;

  beforeEach(() => {
    const filePath = join(__dirname, 'image-gallery.js');
    code = readFileSync(filePath, 'utf-8');
  });

  describe('file structure', () => {
    it('defines $imagegallery variable', () => {
      expect(code).toContain('var $imagegallery');
    });

    it('has renderView function', () => {
      expect(code).toContain('renderView:');
    });

    it('has renderBehaviour function', () => {
      expect(code).toContain('renderBehaviour');
    });

    it('has getStringGallery function', () => {
      expect(code).toContain('getStringGallery:');
    });

    it('has getLinkLicense function', () => {
      expect(code).toContain('getLinkLicense:');
    });

    it('has init function', () => {
      expect(code).toContain('init:');
    });
  });

  describe('no auto-init', () => {
    it('does not have auto-init call at end', () => {
      // image-gallery doesn't have $(function() { ... }) auto-init
      expect(code).not.toMatch(/\$\(function\s*\(\)\s*\{\s*\$imagegallery\.init\(\)/);
    });
  });

  describe('SimpleLightbox configuration', () => {
    it('disables fileExt check for blob:// URL support', () => {
      // SimpleLightbox by default checks if href ends with image extension
      // blob:// URLs don't have extensions, so fileExt must be disabled
      expect(code).toContain('fileExt: false');
    });

    it('has createSLightboxGallery function', () => {
      expect(code).toContain('createSLightboxGallery:');
    });
  });

  describe('changeDirectory URL handling', () => {
    it('keeps asset:// URLs as-is', () => {
      // asset:// URLs should not be converted to relative paths
      expect(code).toContain("file.startsWith('asset://')");
    });

    it('keeps blob: URLs as-is', () => {
      // blob: URLs are already resolved and should not be modified
      expect(code).toContain("file.startsWith('blob:')");
    });

    it('keeps data: URLs as-is', () => {
      // data: URLs are inline data and should not be modified
      expect(code).toContain("file.startsWith('data:')");
    });
  });

  describe('renderBehaviour context handling', () => {
    it('only re-renders gallery when not in editor and node exists', () => {
      // Gallery is re-rendered only when not in eXe editor and the node exists
      expect(code).toContain('!isInExe && $node.length == 1');
    });

    it('uses isInExe check from eXe.app', () => {
      // Uses eXe.app.isInExe() to detect editor context
      expect(code).toContain('isInExe = eXe.app.isInExe()');
    });
  });

  describe('changeDirectory folder path handling', () => {
    it('preserves valid content/resources paths', () => {
      // Paths starting with content/resources/ should be preserved
      expect(code).toContain("file.startsWith('content/resources/')");
    });

    it('detects malformed paths with duplicated filename as folder', () => {
      // Handles cases like content/resources/image.png/image.png
      expect(code).toContain('possibleFolder === filename');
    });
  });
});
