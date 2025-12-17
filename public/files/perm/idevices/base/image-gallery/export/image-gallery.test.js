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
});
