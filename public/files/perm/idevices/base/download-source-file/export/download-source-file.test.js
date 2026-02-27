/**
 * Download Source File iDevice - Export Tests
 *
 * Unit tests for the download-source-file iDevice export code.
 * The export code is minimal since the actual download functionality
 * is provided by exe_elpx_download.js.
 *
 * Run with: make test-frontend
 */

/* eslint-disable no-undef */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('download-source-file iDevice (export)', () => {
  let scriptContent;

  beforeAll(() => {
    // Read the export script content
    const scriptPath = join(__dirname, 'download-source-file.js');
    scriptContent = readFileSync(scriptPath, 'utf-8');
  });

  describe('script structure', () => {
    it('is wrapped in an IIFE', () => {
      expect(scriptContent).toContain('(function()');
      expect(scriptContent).toContain('})()');
    });

    it('uses strict mode', () => {
      expect(scriptContent).toContain("'use strict'");
    });

    it('contains documentation about exe_elpx_download.js dependency', () => {
      expect(scriptContent).toContain('exe_elpx_download.js');
    });

    it('does not define global variables directly', () => {
      // The script should not pollute the global namespace
      expect(scriptContent).not.toContain('var $exeDevice');
      // Note: It accesses window (window.eXe), but doesn't define globals on it directly
    });
  });

  describe('script execution', () => {
    it('executes without errors', () => {
      expect(() => {
        // Execute the script in a safe context
        // eslint-disable-next-line no-eval
        eval(scriptContent);
      }).not.toThrow();
    });

    it('does not modify global scope', () => {
      const globalKeysBefore = Object.keys(global);

      // Execute the script
      // eslint-disable-next-line no-eval
      eval(scriptContent);

      const globalKeysAfter = Object.keys(global);

      // The script should not add new global variables
      // (some test infrastructure may add keys, so we check for specific ones)
      expect(globalKeysAfter).not.toContain('$exeDevice');
      expect(globalKeysAfter).not.toContain('downloadSourceFile');
    });
  });

  describe('integration notes', () => {
    it('script is designed to work with exe_elpx_download.js', () => {
      // This test documents the expected integration pattern
      // The export script relies on exe_elpx_download.js to handle:
      // - Detecting download links with exe-package:elp protocol
      // - Generating the .elpx file from Yjs document
      // - Triggering the browser download

      expect(scriptContent).toContain('download');
      expect(scriptContent).toContain('iDevice');
    });
  });
});
