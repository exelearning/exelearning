/**
 * Unit tests for the word-search iDevice editor.
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

describe('word-search iDevice edition', () => {
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
            <input id="sopaETime" />
      </form>`;
    $exeDevice = global.loadIdevice(join(__dirname, 'word-search.js'));
    $exeDevice.addEvents();
  });

  afterEach(() => {
    $exeDevicesEdition.iDevice.gamification.itinerary = previousItinerary;
    document.body.innerHTML = '';
  });

  describe('numeric field limits', () => {
    it('keeps a 2-digit time', () => {
      $('#sopaETime').val('45').trigger('keyup');

      expect($('#sopaETime').val()).toBe('45');
    });

    it('truncates the time beyond 2 digits and drops non-digits', () => {
      $('#sopaETime').val('1a234').trigger('keyup');

      expect($('#sopaETime').val()).toBe('12');
    });
  });
});
