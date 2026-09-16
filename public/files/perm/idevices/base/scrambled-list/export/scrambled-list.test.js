/**
 * Unit tests for scrambled-list iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - randomizeArray: Shuffles array ensuring at least one change
 * - removeTags: Removes HTML tags from string
 * - setupTouchDrag / removeTouchDrag: Native touch drag-and-drop support
 */

/* eslint-disable no-undef */
// Import setup for DOM mocks (happy-dom), jQuery, and global mocks
import '../../../../../../../public/vitest.setup.js';

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $scrambledlist globally.
 * Note: This file doesn't have auto-init call.
 */
function loadExportIdevice(code) {
  const modifiedCode = code.replace(/var\s+\$scrambledlist\s*=/, 'global.$scrambledlist =');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$scrambledlist;
}

describe('scrambled-list iDevice export', () => {
  let $scrambledlist;

  beforeEach(() => {
    global.$scrambledlist = undefined;

    const filePath = join(__dirname, 'scrambled-list.js');
    const code = readFileSync(filePath, 'utf-8');

    $scrambledlist = loadExportIdevice(code);
  });

  describe('updateConfig', () => {
    beforeEach(() => {
      eXe.app.isInExe = vi.fn(() => false);
      eXe.app.getIdeviceInstalledExportPath = vi.fn(() => '/idevices/scrambled-list/');
      document.body.innerHTML = '';
    });

    it('does not throw when there is no saved data at all', () => {
      expect(() => $scrambledlist.updateConfig(undefined, 'sl-1')).not.toThrow();
    });

    it('does not throw when the saved data is empty', () => {
      expect(() => $scrambledlist.updateConfig({}, 'sl-1')).not.toThrow();
    });
  });

  describe('randomizeArray', () => {
    it('returns array of same length', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = $scrambledlist.randomizeArray([...arr]);
      expect(result).toHaveLength(arr.length);
    });

    it('contains all original elements', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = $scrambledlist.randomizeArray([...arr]);
      expect(result.sort()).toEqual(arr.sort());
    });

    it('ensures at least one element changes position', () => {
      const arr = [1, 2, 3, 4, 5];
      const original = [...arr];
      const result = $scrambledlist.randomizeArray(arr);

      let hasChanged = false;
      for (let i = 0; i < result.length; i++) {
        if (result[i] !== original[i]) {
          hasChanged = true;
          break;
        }
      }
      expect(hasChanged).toBe(true);
    });

    it('handles array with two elements', () => {
      const arr = [1, 2];
      const result = $scrambledlist.randomizeArray([...arr]);
      expect(result).toHaveLength(2);
      expect(result.sort()).toEqual([1, 2]);
    });
  });

  describe('removeTags', () => {
    it('removes HTML tags', () => {
      expect($scrambledlist.removeTags('<p>Hello</p>')).toBe('Hello');
    });

    it('handles nested tags', () => {
      expect($scrambledlist.removeTags('<div><span>Test</span></div>')).toBe('Test');
    });

    it('handles empty string', () => {
      expect($scrambledlist.removeTags('')).toBe('');
    });

    it('handles plain text', () => {
      expect($scrambledlist.removeTags('Plain text')).toBe('Plain text');
    });

    it('handles multiple elements', () => {
      expect($scrambledlist.removeTags('<p>Hello</p><p>World</p>')).toBe('HelloWorld');
    });
  });

  describe('borderColors', () => {
    it('has required color definitions', () => {
      expect($scrambledlist.borderColors).toBeDefined();
      expect($scrambledlist.borderColors.black).toBe('#1c1b1b');
      expect($scrambledlist.borderColors.blue).toBe('#5877c6');
      expect($scrambledlist.borderColors.green).toBe('#66FF66');
      expect($scrambledlist.borderColors.red).toBe('#FF6666');
      expect($scrambledlist.borderColors.white).toBe('#f9f9f9');
      expect($scrambledlist.borderColors.yellow).toBe('#f3d55a');
    });
  });

  describe('getMessages', () => {
    it('returns object with message strings', () => {
      const msgs = $scrambledlist.getMessages();
      expect(msgs).toBeDefined();
      expect(typeof msgs).toBe('object');
    });
  });

  describe('updateConfig', () => {
    it('targets the scrambled-list iDevice body for report icons', () => {
      const previousIsInExe = eXe.app.isInExe;
      eXe.app.isInExe = vi.fn(() => false);

      document.body.innerHTML = `
        <article>
          <header><h1 class="box-title">Scrambled list</h1></header>
          <div id="scrambled-1" class="idevice_node scrambled-list" data-idevice-path="/idevices/scrambled-list/"></div>
        </article>
      `;

      try {
        const result = $scrambledlist.updateConfig(
          {
            id: 'scrambled-1',
            attemptsNumber: 1,
            pendingAttempts: 1,
            msgs: $scrambledlist.getMessages(),
          },
          'scrambled-1',
        );

        expect(result.idevice).toBe('scrambled-listIdevice');
        expect(result.main).toBe('slscrambled-1');
      } finally {
        eXe.app.isInExe = previousIsInExe;
      }
    });

    // Invisible while nothing could report before a check, but the save button
    // can: a true here published a zero for a list nobody had answered instead
    // of the runtime telling the learner to do the activity first. check(),
    // retryGame() and sendScore() each set it at the moment they mean it.
    it('does not call the activity started before the learner checks it', () => {
      const previousIsInExe = eXe.app.isInExe;
      eXe.app.isInExe = vi.fn(() => false);

      try {
        expect($scrambledlist.updateConfig({ id: 'sl-1' }, 'sl-1').gameStarted).toBe(false);
      } finally {
        eXe.app.isInExe = previousIsInExe;
      }
    });

    it('normalizes legacy option objects before rendering', () => {
      const previousIsInExe = eXe.app.isInExe;
      eXe.app.isInExe = vi.fn(() => false);
      document.body.innerHTML = `
        <article>
          <header><h1 class="box-title">Scrambled list</h1></header>
          <div id="scrambled-1" class="idevice_node scrambled-list" data-idevice-path="/idevices/scrambled-list/"></div>
        </article>
      `;

      try {
        const result = $scrambledlist.updateConfig(
          {
            id: 'scrambled-1',
            options: [{ text: 'One' }, { value: '<strong>Two</strong>' }, ['Three']],
            msgs: $scrambledlist.getMessages(),
          },
          'scrambled-1',
        );

        expect(result.options).toEqual(['One', '<strong>Two</strong>', 'Three']);
      } finally {
        eXe.app.isInExe = previousIsInExe;
      }
    });
  });

  describe('setupTouchDrag', () => {
    it('exists as a function', () => {
      expect(typeof $scrambledlist.setupTouchDrag).toBe('function');
    });

    it('registers three touch listeners on the sortable list', () => {
      const listOrder = 0;
      const ul = document.createElement('ul');
      ul.id = `exe-sortableList-${listOrder}`;
      document.body.appendChild(ul);
      const spy = vi.spyOn(ul, 'addEventListener');

      $scrambledlist.setupTouchDrag(listOrder);

      expect(spy).toHaveBeenCalledWith('touchstart', expect.any(Function), { passive: false });
      expect(spy).toHaveBeenCalledWith('touchmove', expect.any(Function), { passive: false });
      expect(spy).toHaveBeenCalledWith('touchend', expect.any(Function), { passive: false });

      document.body.removeChild(ul);
      $scrambledlist.removeTouchDrag(listOrder);
    });

    it('stores handlers in _touchHandlers keyed by listOrder', () => {
      const listOrder = 1;
      const ul = document.createElement('ul');
      ul.id = `exe-sortableList-${listOrder}`;
      document.body.appendChild(ul);

      $scrambledlist.setupTouchDrag(listOrder);

      expect($scrambledlist._touchHandlers[listOrder]).toBeDefined();
      expect(typeof $scrambledlist._touchHandlers[listOrder].touchstart).toBe('function');
      expect(typeof $scrambledlist._touchHandlers[listOrder].touchmove).toBe('function');
      expect(typeof $scrambledlist._touchHandlers[listOrder].touchend).toBe('function');
      expect($scrambledlist._touchHandlers[listOrder].ul).toBe(ul);

      document.body.removeChild(ul);
      $scrambledlist.removeTouchDrag(listOrder);
    });

    it('does nothing when the UL element does not exist', () => {
      expect(() => $scrambledlist.setupTouchDrag(999)).not.toThrow();
      expect($scrambledlist._touchHandlers[999]).toBeUndefined();
    });

    it('removes previous listeners before registering new ones (idempotent)', () => {
      const listOrder = 2;
      const ul = document.createElement('ul');
      ul.id = `exe-sortableList-${listOrder}`;
      document.body.appendChild(ul);
      const removeSpy = vi.spyOn(ul, 'removeEventListener');

      $scrambledlist.setupTouchDrag(listOrder);
      $scrambledlist.setupTouchDrag(listOrder); // second call should remove first

      expect(removeSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('touchend', expect.any(Function));

      document.body.removeChild(ul);
      $scrambledlist.removeTouchDrag(listOrder);
    });
  });

  describe('removeTouchDrag', () => {
    it('exists as a function', () => {
      expect(typeof $scrambledlist.removeTouchDrag).toBe('function');
    });

    it('removes the three touch listeners', () => {
      const listOrder = 3;
      const ul = document.createElement('ul');
      ul.id = `exe-sortableList-${listOrder}`;
      document.body.appendChild(ul);

      $scrambledlist.setupTouchDrag(listOrder);
      const removeSpy = vi.spyOn(ul, 'removeEventListener');

      $scrambledlist.removeTouchDrag(listOrder);

      expect(removeSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('touchend', expect.any(Function));

      document.body.removeChild(ul);
    });

    it('deletes the entry from _touchHandlers', () => {
      const listOrder = 4;
      const ul = document.createElement('ul');
      ul.id = `exe-sortableList-${listOrder}`;
      document.body.appendChild(ul);

      $scrambledlist.setupTouchDrag(listOrder);
      expect($scrambledlist._touchHandlers[listOrder]).toBeDefined();

      $scrambledlist.removeTouchDrag(listOrder);
      expect($scrambledlist._touchHandlers[listOrder]).toBeUndefined();

      document.body.removeChild(ul);
    });

    it('does not throw when called without a prior setupTouchDrag', () => {
      expect(() => $scrambledlist.removeTouchDrag(888)).not.toThrow();
    });
  });

  describe('touch drag handler behaviors', () => {
    let listOrder, ul, li1, li2;

    beforeEach(() => {
      listOrder = 5;
      ul = document.createElement('ul');
      ul.id = `exe-sortableList-${listOrder}`;
      li1 = document.createElement('li');
      li1.textContent = 'Item A';
      li2 = document.createElement('li');
      li2.textContent = 'Item B';
      ul.appendChild(li1);
      ul.appendChild(li2);
      document.body.appendChild(ul);

      $scrambledlist.setupTouchDrag(listOrder);
    });

    afterEach(() => {
      $scrambledlist.removeTouchDrag(listOrder);
      if (ul.parentNode) document.body.removeChild(ul);
    });

    it('touchstart ignores touch on non-li elements', () => {
      // Firing touchstart on the UL itself (not an li child) should not throw
      const touchStartHandler = $scrambledlist._touchHandlers[listOrder].touchstart;
      const fakeTouch = { clientX: 0, clientY: 0 };
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(document.body);

      expect(() => touchStartHandler({ touches: [fakeTouch], preventDefault: vi.fn() })).not.toThrow();
    });

    it('touchmove does nothing when no item is being dragged', () => {
      const touchMoveHandler = $scrambledlist._touchHandlers[listOrder].touchmove;
      const preventDefaultMock = vi.fn();

      // Without a prior touchstart that set touchedItem, touchmove should return early
      expect(() => touchMoveHandler({ touches: [{ clientX: 10, clientY: 10 }], preventDefault: preventDefaultMock })).not.toThrow();
      // preventDefault should NOT be called since no item is being dragged
      expect(preventDefaultMock).not.toHaveBeenCalled();
    });

    it('touchend does nothing when no item is being dragged', () => {
      const touchEndHandler = $scrambledlist._touchHandlers[listOrder].touchend;
      expect(() => touchEndHandler({ changedTouches: [{ clientX: 10, clientY: 10 }] })).not.toThrow();
    });
  });

  describe('getOriginalIndexValue / getOriginalIndexNumber (legacy fallback)', () => {
    const el = (attr) => ({ getAttribute: () => attr });

    it('returns the data-orig-index attribute when present', () => {
      expect($scrambledlist.getOriginalIndexValue(el('2'), 5)).toBe('2');
      expect($scrambledlist.getOriginalIndexNumber(el('4'), 9)).toBe(4);
    });

    it('falls back to the position when the attribute is missing (eXe 2.9 imports)', () => {
      // Legacy <li> carry no data-orig-index, so the position is the canonical index.
      expect($scrambledlist.getOriginalIndexValue(el(null), 5)).toBe('5');
      expect($scrambledlist.getOriginalIndexValue(el(''), 3)).toBe('3');
      expect($scrambledlist.getOriginalIndexNumber(el(null), 9)).toBe(9);
      expect($scrambledlist.getOriginalIndexNumber(el('abc'), 7)).toBe(7);
    });
  });

  describe('normalizeOptions', () => {
    it('keeps string options and drops empties', () => {
      expect($scrambledlist.normalizeOptions(['a', '', '  ', 'b'])).toEqual(['a', 'b']);
    });

    it('extracts text from object-shaped options and tolerates non-arrays', () => {
      expect($scrambledlist.normalizeOptions([{ text: 'x' }, { html: 'y' }, 3])).toEqual(['x', 'y', '3']);
      expect($scrambledlist.normalizeOptions(undefined)).toEqual([]);
      expect($scrambledlist.normalizeOptions(null)).toEqual([]);
    });
  });

  describe('countRightAnswers', () => {
    it('counts every item that sits in its correct position', () => {
      expect($scrambledlist.countRightAnswers([0, 1, 2])).toBe(3);
    });

    it('counts only the items left in place after a swap', () => {
      // index 2 stays correct; 0 and 1 are swapped
      expect($scrambledlist.countRightAnswers([1, 0, 2])).toBe(1);
    });

    it('returns 0 when nothing is in place', () => {
      expect($scrambledlist.countRightAnswers([2, 0, 1])).toBe(0);
    });

    it('handles an empty list', () => {
      expect($scrambledlist.countRightAnswers([])).toBe(0);
    });
  });

  describe('sendScore', () => {
    /**
     * Capture what the shared grading surface receives, without touching it.
     *
     * @returns {{restore: function(): void, calls: Array}} the recorded calls
     */
    function captureGradingSurface() {
      const calls = [];
      const previous = global.$exeDevices;
      global.$exeDevices = {
        iDevice: {
          gamification: {
            scorm: {
              sendScoreNew: (auto, data) => calls.push({ auto, data }),
            },
          },
        },
      };
      return { calls, restore: () => { global.$exeDevices = previous; } };
    }

    it('reports the score on the 0..10 scale the grading surface expects', () => {
      const surface = captureGradingSurface();
      const data = { id: 'sl-1', isScorm: 1 };

      $scrambledlist.sendScore(3, 4, data);

      expect(surface.calls).toHaveLength(1);
      expect(surface.calls[0].data.scorerp).toBe(7.5);
      surface.restore();
    });

    it('marks the activity finished, so the page can leave `incomplete`', () => {
      // common.js derives completion from `gameOver` alone. Without the flag the
      // registry never marks the activity complete and any SCO carrying a
      // scrambled-list stays `incomplete` in the LMS even at 100%, which costs the
      // learner the "Learning Objects" grade and any completion condition keyed on
      // status.
      const surface = captureGradingSurface();
      const data = { id: 'sl-1', isScorm: 1 };

      $scrambledlist.sendScore(4, 4, data);

      expect(surface.calls[0].auto).toBe(true);
      expect(surface.calls[0].data.gameOver).toBe(true);
      expect(surface.calls[0].data.gameStarted).toBe(true);
      surface.restore();
    });

    // check() re-reads the node's JSON on every grading and works on that copy,
    // so what sendScore sets is gone by the next click unless it is written
    // back — and the save button would then have nothing to publish.
    it('writes the state it sets back onto the node', () => {
      const surface = captureGradingSurface();
      document.body.innerHTML = '<div id="sl-1" class="idevice_node"></div>';

      $scrambledlist.sendScore(3, 4, { id: 'sl-1', isScorm: 2 });

      const stored = JSON.parse($('#sl-1').attr('data-idevice-json-data'));
      expect(stored.scorerp).toBe(7.5);
      expect(stored.gameOver).toBe(true);
      expect(stored.gameStarted).toBe(true);
      surface.restore();
      document.body.innerHTML = '';
    });
  });

  // The defect the unification left behind: this iDevice wrote its own markup
  // with `display:none` and relied on updateScormNew to reveal the button,
  // which only runs inside a SCORM package. So the button was missing from the
  // editor and from every other export format, while the other thirty iDevices
  // showed it — the author enabled the option and saw nothing.
  describe('getScormHtml', () => {
    it('renders the button visible, not waiting on the SCORM runtime', () => {
      const html = $scrambledlist.getScormHtml({
        id: 'sl-1',
        isScorm: 2,
        textButtonScorm: 'Guardar',
      });

      expect(html).toContain('Games-SendScore');
      expect(html).not.toContain('display:none');
    });

    // Its own markup also gave the button this iDevice's grey `feedbackbutton`
    // class, so it did not even look like the same control as everywhere else.
    it('renders the same green control as every other iDevice', () => {
      const html = $scrambledlist.getScormHtml({
        id: 'sl-1',
        isScorm: 2,
        textButtonScorm: 'Guardar',
      });

      expect(html).toContain('btn btn-primary');
      expect(html).not.toContain('feedbackbutton');
    });

    it('renders no button in automatic mode', () => {
      const html = $scrambledlist.getScormHtml({
        id: 'sl-1',
        isScorm: 1,
        textButtonScorm: 'Guardar',
      });

      expect(html).not.toContain('Games-SendScore');
      // The runtime still needs somewhere to put its message.
      expect(html).toContain('Games-RepeatActivity');
    });

    it('renders nothing at all for an untracked activity', () => {
      expect($scrambledlist.getScormHtml({ id: 'sl-1', isScorm: 0 })).toBe('');
    });
  });

  /**
   * The save button the learner owns in manual mode, which this iDevice used to
   * render and never wire: it was visible in the package and did nothing.
   */
  describe('the save-score button', () => {
    let calls;
    let previousDevices;

    beforeEach(() => {
      calls = [];
      previousDevices = global.$exeDevices;
      global.$exeDevices = {
        iDevice: {
          gamification: {
            scorm: { sendScoreNew: (auto, data) => calls.push({ auto, data }) },
          },
        },
      };
      document.body.innerHTML = `
        <div id="sl-1" class="idevice_node">
          <input id="tofPSendScore-sl-1" type="button" class="Games-SendScore" style="display:none" />
          <span class="Games-RepeatActivity"></span>
        </div>`;
    });

    afterEach(() => {
      global.$exeDevices = previousDevices;
      document.body.innerHTML = '';
    });

    it('publishes the state the node holds, as a hand-sent score', () => {
      $('#sl-1').attr(
        'data-idevice-json-data',
        JSON.stringify({ id: 'sl-1', isScorm: 2, scorerp: 5, gameStarted: true, gameOver: false })
      );

      $scrambledlist.setBehaviourButtonSendScore({ id: 'sl-1', isScorm: 2 });
      $('#tofPSendScore-sl-1').trigger('click');

      expect(calls).toHaveLength(1);
      expect(calls[0].auto).toBe(false);
      expect(calls[0].data.scorerp).toBe(5);
      // Pressing the button changes nothing: an unchecked list is not finished.
      expect(calls[0].data.gameOver).toBe(false);
    });

    it('binds once however many times the behaviour is wired', () => {
      const ldata = { id: 'sl-1', isScorm: 2 };

      $scrambledlist.setBehaviourButtonSendScore(ldata);
      $scrambledlist.setBehaviourButtonSendScore(ldata);
      $('#tofPSendScore-sl-1').trigger('click');

      expect(calls).toHaveLength(1);
    });

    // The other modes render no button at all, so there is nothing to bind and
    // nothing to blow up on.
    it('stands down when the activity renders no button', () => {
      document.body.innerHTML = '';

      expect(() =>
        $scrambledlist.setBehaviourButtonSendScore({ id: 'sl-1' })
      ).not.toThrow();
    });

    // It is the only thing that publishes a grade in manual mode, so leaving it
    // out of the render step means the learner presses a button that does
    // nothing — which is exactly what this iDevice shipped before.
    it('is wired when the activity renders', () => {
      let bound;
      $scrambledlist.setBehaviourButtonSendScore = ldata => {
        bound = ldata.id;
      };
      global.$exeDevices.iDevice.gamification.scorm.registerActivity = () => {};
      global.$exeDevices.iDevice.gamification.math = {
        hasLatex: () => false,
        updateLatex: () => {},
      };

      $scrambledlist.renderBehaviour({ isScorm: 2 }, 0, 'sl-1');

      expect(bound).toBe('sl-1');
    });

    describe('readState', () => {
      it('falls back to the render-time options when the node holds nothing', () => {
        const ldata = { id: 'sl-1', isScorm: 2 };

        expect($scrambledlist.readState(ldata)).toBe(ldata);
      });

      it('falls back when what the node holds is not readable', () => {
        const ldata = { id: 'sl-1', isScorm: 2 };
        $('#sl-1').attr('data-idevice-json-data', '{not json');

        expect($scrambledlist.readState(ldata)).toBe(ldata);
      });
    });

    describe('persistState', () => {
      it('stands down without an activity or an id', () => {
        expect(() => $scrambledlist.persistState(null)).not.toThrow();
        expect(() => $scrambledlist.persistState({})).not.toThrow();
      });

      it('stands down when the node is not in the page', () => {
        expect(() =>
          $scrambledlist.persistState({ id: 'missing' })
        ).not.toThrow();
      });
    });
  });

  // Accepting the retry reshuffles the list and clears the feedback, so the
  // mark the LMS holds from the check that failed stops describing anything on
  // screen. It used to stay there until the learner checked again.
  describe('retryGame', () => {
    function captureGradingSurface() {
      const calls = [];
      const previous = global.$exeDevices;
      global.$exeDevices = {
        iDevice: {
          gamification: {
            scorm: {
              sendScoreNew: (auto, data) => calls.push({ auto, data }),
            },
          },
        },
      };
      return { calls, restore: () => { global.$exeDevices = previous; } };
    }

    function givenGradedList() {
      document.body.classList.add('exe-scorm');
      document.body.innerHTML += `
        <ul id="exe-sortableList-0"></ul>
        <ul id="exe-sortableListResults-0"><li>a</li><li>b</li></ul>
        <div id="exe-sortableList-0-feedback"></div>
        <div id="exe-sortableList-0-retry"></div>
        <button id="exe-sortableListButton-0"></button>`;
    }

    afterEach(() => {
      document.body.classList.remove('exe-scorm');
      document.body.innerHTML = '';
    });

    it('reports a zero and an attempt still open', () => {
      givenGradedList();
      const surface = captureGradingSurface();
      const data = { id: 'sl-1', isScorm: 1, scorerp: 5, gameOver: true, gameStarted: true };

      $scrambledlist.retryGame(0, data);

      expect(surface.calls).toHaveLength(1);
      expect(surface.calls[0].auto).toBe(true);
      expect(surface.calls[0].data.scorerp).toBe(0);
      // sendScoreNew drops a game that is neither started nor over, and it
      // derives completion from gameOver: the retry is not a finished attempt.
      expect(surface.calls[0].data.gameStarted).toBe(true);
      expect(surface.calls[0].data.gameOver).toBe(false);
      surface.restore();
    });

    it('says nothing when the activity does not report to SCORM', () => {
      givenGradedList();
      const surface = captureGradingSurface();

      $scrambledlist.retryGame(0, { id: 'sl-1', isScorm: 0 });

      expect(surface.calls).toHaveLength(0);
      surface.restore();
    });
  });

  /**
   * A wrong list with attempts left stops at the retry prompt: check() returns
   * there and never reaches sendScore. The state it leaves on the node is
   * therefore the only description of the attempt the save button can read.
   */
  describe('check leaves the node describing the attempt', () => {
    let previousReport;

    beforeEach(() => {
      previousReport = global.$exeDevices.iDevice.gamification.report;
      global.$exeDevices.iDevice.gamification.report = {
        saveEvaluation: () => {},
      };
    });

    afterEach(() => {
      global.$exeDevices.iDevice.gamification.report = previousReport;
      document.body.classList.remove('exe-scorm');
      document.body.innerHTML = '';
    });

    /**
     * A three-item list with the first two swapped: one of three in place.
     *
     * @param {Object} stored what the node holds before the check
     * @returns {Element} the check button to hand to check()
     */
    function givenMisorderedList(stored) {
      document.body.classList.add('exe-scorm');
      document.body.innerHTML = `
        <div id="sl-1" class="idevice_node">
          <div class="exe-sortableList">
            <ul id="exe-sortableList-0">
              <li data-orig-index="1">b</li>
              <li data-orig-index="0">a</li>
              <li data-orig-index="2">c</li>
            </ul>
            <ul id="exe-sortableListResults-0"><li>a</li><li>b</li><li>c</li></ul>
            <div id="exe-sortableList-0-feedback"></div>
            <div id="exe-sortableList-0-retry"></div>
            <p id="exe-sortableListButton-0">
              <input type="button" class="exe-sortableList-check-0" />
            </p>
          </div>
        </div>`;
      $('#sl-1').attr('data-idevice-json-data', JSON.stringify(stored));
      return $('.exe-sortableList-check-0')[0];
    }

    // The defect: the write-back ran before saveEvaluation, which is what
    // computes the mark, so the node kept the previous attempt's score. A
    // learner pressing the save button while the retry prompt was up published
    // that stale mark — 0 for a list that had just scored 3.33.
    it('stores the mark it has just computed, not the previous one', () => {
      const button = givenMisorderedList({
        id: 'sl-1',
        isScorm: 2,
        attemptsNumber: 3,
        pendingAttempts: 3,
        scorerp: 0,
        msgs: {},
      });

      $scrambledlist.check(button, 0);

      const stored = JSON.parse($('#sl-1').attr('data-idevice-json-data'));
      // One of three in place.
      expect(stored.scorerp).toBeCloseTo(10 / 3, 5);
      // And the attempt is open: the learner has still to accept or cancel.
      expect(stored.gameStarted).toBe(true);
      expect(stored.gameOver).toBe(false);
      // The attempt just spent still has to survive, as it always did.
      expect(stored.pendingAttempts).toBe(2);
    });

    // The button reads the node, so the two have to agree.
    it('is what the save button then publishes', () => {
      const calls = [];
      const previousDevices = global.$exeDevices;
      global.$exeDevices = {
        iDevice: {
          gamification: {
            scorm: { sendScoreNew: (auto, data) => calls.push({ auto, data }) },
            report: { saveEvaluation: () => {} },
          },
        },
      };
      const button = givenMisorderedList({
        id: 'sl-1',
        isScorm: 2,
        attemptsNumber: 3,
        pendingAttempts: 3,
        scorerp: 0,
        msgs: {},
      });
      $('#sl-1').append(
        '<input id="tofPSendScore-sl-1" type="button" class="Games-SendScore" />'
      );

      try {
        $scrambledlist.check(button, 0);
        $scrambledlist.setBehaviourButtonSendScore({ id: 'sl-1', isScorm: 2 });
        $('#tofPSendScore-sl-1').trigger('click');

        expect(calls).toHaveLength(1);
        expect(calls[0].auto).toBe(false);
        expect(calls[0].data.scorerp).toBeCloseTo(10 / 3, 5);
        expect(calls[0].data.gameOver).toBe(false);
      } finally {
        global.$exeDevices = previousDevices;
      }
    });
  });

  describe('escapeHtmlButKeepRenderedMath', () => {
    const mathSpan =
      '<span class="exe-math-rendered" data-latex="\\(x\\)"><svg></svg><math></math></span>';

    it('escapes plain HTML', () => {
      expect($scrambledlist.escapeHtmlButKeepRenderedMath('<b>x</b>')).toBe('&lt;b&gt;x&lt;/b&gt;');
    });

    it('keeps a valid pre-rendered math span verbatim', () => {
      const out = $scrambledlist.escapeHtmlButKeepRenderedMath('Pick ' + mathSpan);
      expect(out).toContain(mathSpan);
      expect(out.startsWith('Pick ')).toBe(true);
    });

    it('neutralises a forged math span carrying script (XSS boundary)', () => {
      const forged = '<span class="exe-math-rendered" data-latex=""><svg onload="alert(1)"></svg></span>';
      const out = $scrambledlist.escapeHtmlButKeepRenderedMath('Pick ' + forged);
      expect(out).not.toContain('<svg onload');
    });

    it('handles null/undefined', () => {
      expect($scrambledlist.escapeHtmlButKeepRenderedMath(null)).toBe('');
      expect($scrambledlist.escapeHtmlButKeepRenderedMath(undefined)).toBe('');
    });
  });

  describe('getListLinks (math-safe controls)', () => {
    const mathSpan =
      '<span class="exe-math-rendered" data-latex="\\(x\\)"><svg></svg><math></math></span>';

    it('adds sorter controls without removing pre-rendered math spans', () => {
      const listOrder = 10;
      document.body.innerHTML =
        `<ul id="exe-sortableList-${listOrder}">` +
        `<li data-orig-index="0">A ${mathSpan}</li>` +
        `<li data-orig-index="1">B</li>` +
        `</ul>`;

      $scrambledlist.getListLinks(listOrder);
      const ul = document.getElementById('exe-sortableList-' + listOrder);

      // Math span preserved, one sorter-control wrapper added per item.
      expect(ul.querySelectorAll('span.exe-math-rendered').length).toBe(1);
      expect(ul.querySelectorAll('span.exe-sortableList-controls').length).toBe(2);

      // Re-running (as on every sortupdate) must not duplicate or destroy math.
      $scrambledlist.getListLinks(listOrder);
      expect(ul.querySelectorAll('span.exe-math-rendered').length).toBe(1);
      expect(ul.querySelectorAll('span.exe-sortableList-controls').length).toBe(2);
    });
  });

  describe('enableList legacy htmlView support', () => {
    it('adds fallback original indexes to legacy list items without data attributes', () => {
      document.body.innerHTML = `
        <div class="exe-sortableList">
          <ul class="exe-sortableList-list">
            <li>One</li>
            <li>Two</li>
            <li>Three</li>
          </ul>
          <p class="exe-sortableList-buttonText">Check</p>
        </div>`;
      const activity = document.querySelector('.exe-sortableList');
      const randomize = vi
        .spyOn($scrambledlist, 'randomizeArray')
        .mockImplementation((items) => [items[1], items[0], items[2]]);

      try {
        $scrambledlist.enableList(activity, 12);

        const originalItems = document.querySelectorAll('#exe-sortableListResults-12 li');
        const playableItems = document.querySelectorAll('#exe-sortableList-12 li');
        expect(Array.from(originalItems).map((item) => item.getAttribute('data-orig-index'))).toEqual([
          '0',
          '1',
          '2',
        ]);
        expect(Array.from(playableItems).map((item) => item.getAttribute('data-orig-index'))).toEqual([
          '1',
          '0',
          '2',
        ]);
      } finally {
        randomize.mockRestore();
      }
    });
  });

  describe('renderView', () => {
    const template =
      '<div id="sl{idList}">{instructions}<ul class="exe-sortableList-list">{optionsText}</ul>' +
      '<p class="exe-sortableList-buttonText">{buttonText}</p>' +
      '<p class="exe-sortableList-rightText">{rightText}</p>' +
      '<p class="exe-sortableList-wrongText">{wrongText}</p>' +
      '{scormMessage}{afterElement}{evaluationID}{ideviceID}{evaluation}{scorm}</div>';

    it('emits data-orig-index per option and keeps rendered math in options and feedback', () => {
      const previousIsInExe = eXe.app.isInExe;
      eXe.app.isInExe = vi.fn(() => false);
      document.body.innerHTML = `
        <article><header><h1 class="box-title">SL</h1></header>
          <div id="sl-1" class="idevice_node scrambled-list" data-idevice-path="/idevices/scrambled-list/"></div>
        </article>`;
      const mathSpan =
        '<span class="exe-math-rendered" data-latex="\\(x\\)"><svg></svg><math></math></span>';

      try {
        const html = $scrambledlist.renderView(
          {
            id: 'sl-1',
            options: ['<p>' + mathSpan + '</p>', 'plain'],
            rightText: 'Great ' + mathSpan,
            wrongText: 'Nope',
            buttonText: 'Check',
            instructions: 'Order them',
            msgs: $scrambledlist.getMessages(),
          },
          0,
          template,
          'sl-1',
        );

        // Each option carries its correct-position index.
        expect(html).toContain('data-orig-index="0"');
        expect(html).toContain('data-orig-index="1"');
        // Rendered math survives in the option AND the feedback text.
        expect((html.match(/exe-math-rendered/g) || []).length).toBeGreaterThanOrEqual(2);
      } finally {
        eXe.app.isInExe = previousIsInExe;
      }
    });
  });

  // Issue #2263: getMessages() was Spanish, and it is what content without a
  // saved `msgs` falls back to — so the activity spoke Spanish whatever the
  // project language.
  describe('getMessages fallback texts', () => {
    it('is in the source language', () => {
      const msgs = $scrambledlist.getMessages();

      expect(msgs.msgCheck).toBe('Check');
      expect(msgs.msgSubmit).toBe('Submit');
      expect(msgs.msgTestFailed).toBe("You didn't pass the test. Please try again");
    });

    // The fallback is only useful if it is the same text the translator sees,
    // so no default may be left in another language. Accented characters are a
    // cheap, reliable proxy for the Spanish this replaced.
    it('leaves no default in another language', () => {
      const nonEnglish = Object.entries($scrambledlist.getMessages()).filter(
        ([, value]) => typeof value === 'string' && /[áéíóúñ¿¡]/i.test(value)
      );
      expect(nonEnglish).toEqual([]);
    });
  });
});
