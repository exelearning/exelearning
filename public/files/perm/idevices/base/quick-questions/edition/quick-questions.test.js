/**
 * Unit tests for the quick-questions iDevice editor.
 *
 * The numeric fields truncate their value on keyup. Capping them at one digit
 * made ordinary values impossible to enter: the second keystroke was dropped,
 * so an author aiming for 10 silently ended up with 1.
 */

/* eslint-disable no-undef */
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
});
