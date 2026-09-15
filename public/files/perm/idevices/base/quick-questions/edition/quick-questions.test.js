/**
 * Unit tests for the quick-questions iDevice editor.
 *
 * The numeric fields truncate their value on keyup. Capping them at one digit
 * made ordinary values impossible to enter: the second keystroke was dropped,
 * so an author aiming for 10 silently ended up with 1.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('quick-questions iDevice edition', () => {
  let $exeDevice;
  let previousItinerary;

  beforeEach(() => {
    global.$exeDevice = undefined;
    previousItinerary = $exeDevicesEdition.iDevice.gamification.itinerary;
    // addEvents wires the whole editor. The itinerary component lives outside
    // this iDevice's source, so it is stubbed rather than exercised here.
    $exeDevicesEdition.iDevice.gamification.itinerary = {
      addEvents: () => {},
      getTab: () => '',
      init: () => {},
      setValues: () => {},
    };
    document.body.innerHTML = `
      <script></script>
      <form id="gameQEIdeviceForm">
            <input id="quextETimeSilence" />
      </form>`;
    $exeDevice = global.loadIdevice(join(__dirname, 'quick-questions.js'));
    $exeDevice.addEvents();
  });

  afterEach(() => {
    $exeDevicesEdition.iDevice.gamification.itinerary = previousItinerary;
    document.body.innerHTML = '';
  });

  describe('numeric field limits', () => {
    it('keeps a 3-digit silence time', () => {
      $('#quextETimeSilence').val('120').trigger('keyup');

      expect($('#quextETimeSilence').val()).toBe('120');
    });

    it('truncates the silence time beyond 3 digits and drops non-digits', () => {
      $('#quextETimeSilence').val('1a2345').trigger('keyup');

      expect($('#quextETimeSilence').val()).toBe('123');
    });
  });

    /**
     * The pass-score control is a shared block in common_edition.js, exercised
     * by its own tests. What is specific to this iDevice -- and what silently
     * breaks if someone edits the form -- is the wiring: all four call sites
     * have to be present, and the two saved fields have to reach the stored
     * data. Reading the source is how that is checked without standing up the
     * whole edition form.
     */
    describe('pass score wiring', () => {
        let source;

        beforeEach(() => {
            source = readFileSync(join(__dirname, 'quick-questions.js'), 'utf-8');
        });

        it('renders the control immediately above the progress report', () => {
            const passScoreAt = source.indexOf('gamification.passScore.getContents()');
            const progressBarAt = source.indexOf('gamification.progressBar.getContents(');

            expect(passScoreAt).toBeGreaterThan(-1);
            expect(progressBarAt).toBeGreaterThan(-1);
            expect(passScoreAt).toBeLessThan(progressBarAt);
        });

        it('restores the control when the iDevice is reopened', () => {
            expect(source).toContain('gamification.passScore.setValues(');
            expect(source).toContain('passScoreMode: game.passScoreMode');
            expect(source).toContain('passScoreCustom: game.passScoreCustom');
        });

        it('saves the mode and the customised mark, and nothing else', () => {
            expect(source).toContain('gamification.passScore.getValues()');
            expect(source).toContain('passScoreMode: passScore.passScoreMode');
            expect(source).toContain('passScoreCustom: passScore.passScoreCustom');
            // The project value is never copied into the iDevice: it is read
            // live, so an iDevice on the global mode follows the project.
            expect(source).not.toContain('passScoreGlobal');
        });

        it('wires the radio and input handlers', () => {
            expect(source).toContain('gamification.passScore.addEvents()');
        });
    });
});
