/**
 * Unit tests for sort iDevice edition wiring.
 *
 * The per-card image picker is rendered dynamically (addCard interpolates
 * $exeDevice.activeID), so the author-prefill declaration must carry the
 * interpolated row selector that common_edition.js resolves at click time.
 */

/* eslint-disable no-undef */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('sort iDevice edition', () => {
  describe('author prefill wiring (data-author-target)', () => {
    it('declares the per-card image picker target inside the card author/alt block', () => {
      const filePath = join(__dirname, 'sort.js');
      const code = readFileSync(filePath, 'utf-8');
      // Dynamic rows: the selector interpolates the card id so the shared
      // handler (seedDeclaredTargets) resolves the freshly rendered row.
      expect(code).toContain(
        'id="ordenaEURLImage-${$exeDevice.activeID}" data-author-target="#ordenaEAuthorAlt-${$exeDevice.activeID} .ODNE-EAuthor"'
      );
    });

    it('keeps the activity-level author field un-wired (it is not per-media)', () => {
      const filePath = join(__dirname, 'sort.js');
      const code = readFileSync(filePath, 'utf-8');
      expect(code).not.toMatch(/data-author-target="#ordenaEAuthor"/);
    });
  });
});
