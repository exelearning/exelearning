/**
 * Unit tests for the trivial iDevice (export/runtime).
 *
 * Covers the page lifecycle: the SCORM runtime owns the end of the session
 * (pagehide / visibilitychange), so the activity must never report a score of its
 * own when the page is hidden — that report races the runtime's own persistence and
 * termination, and can land after the session is already closed.
 *
 * The export declares `var $eXeTrivial`; it is rewired to a global and the auto-init
 * call is stripped so importing has no side effects.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$eXeTrivial\s*=/, 'global.$eXeTrivial =');
  // Remove the auto-init call, whichever form the export uses ($(function () {…}) or $(() => {…})).
  modifiedCode = modifiedCode.replace(
    /\$\(\s*(?:function\s*\(\)|\(\)\s*=>)\s*\{\s*\$eXeTrivial\.init\(\);\s*\}\s*\);?/g,
    ''
  );
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$eXeTrivial;
}

describe('trivial iDevice export', () => {
  let $eXeTrivial;

  beforeEach(() => {
    global.$eXeTrivial = undefined;
    const code = readFileSync(join(__dirname, 'trivial.js'), 'utf-8');
    $eXeTrivial = loadExportIdevice(code);
  });

  afterEach(() => {
    $(window).off('pagehide.eXeTrivial');
    delete global.$eXeTrivial;
    document.body.innerHTML = '';
  });

  describe('page lifecycle', () => {
    it('does not report a score when the page is hidden mid-game', () => {
      global.$exeDevices.iDevice.gamification.scorm.endScorm ??= vi.fn();
      $eXeTrivial.options[0] = {
        numeroTemas: 0,
        nombresTemas: [],
        msgs: {},
        itinerary: { showCodeAccess: false },
        numberLives: 0,
        instructions: '',
        title: '',
        author: '',
        isScorm: 0,
        hasVideo: false,
        gameStarted: true,
        gameOver: false,
      };
      // Board drawing needs a canvas; it is not what this test is about.
      $eXeTrivial.loadGameBoard = vi.fn();
      $eXeTrivial.sendScore = vi.fn();

      $eXeTrivial.addEvents(0);
      $(window).trigger('pagehide');

      expect($eXeTrivial.sendScore).not.toHaveBeenCalled();
    });
  });
});
