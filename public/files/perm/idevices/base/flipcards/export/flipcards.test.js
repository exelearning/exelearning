/**
 * Unit tests for flipcards iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - getCardDefault: Returns default card object structure
 * - getTimeToStringMemory: Formats time to mm:ss
 * - hexToRgba: Converts hex color to rgba
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $eXeFlipCards globally.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$eXeFlipCards\s*=/, 'global.$eXeFlipCards =');
  // Remove auto-init call: $(function () { $eXeFlipCards.init(); });
  modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeFlipCards\.init\(\);\s*\}\);?/g, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$eXeFlipCards;
}

describe('flipcards iDevice export', () => {
  let $eXeFlipCards;
  let scoreCalls;

  beforeEach(() => {
    global.$eXeFlipCards = undefined;
    scoreCalls = [];
    // The runtime reaches for the shared gamification surface when it reports a
    // score, so it has to exist before the file is evaluated.
    global.$exeDevices = {
      iDevice: {
        gamification: {
          scorm: { sendScoreNew: (auto, game) => scoreCalls.push({ auto, game }) },
        },
      },
    };

    const filePath = join(__dirname, 'flipcards.js');
    const code = readFileSync(filePath, 'utf-8');

    $eXeFlipCards = loadExportIdevice(code);
  });

  describe('getCardDefault', () => {
    it('returns object with required front side properties', () => {
      const card = $eXeFlipCards.getCardDefault();
      expect(card.id).toBe('');
      expect(card.type).toBe(2);
      expect(card.url).toBe('');
      expect(card.audio).toBe('');
      expect(card.x).toBe(0);
      expect(card.y).toBe(0);
      expect(card.author).toBe('');
      expect(card.alt).toBe('');
      expect(card.eText).toBe('');
      expect(card.color).toBe('#000000');
      expect(card.backcolor).toBe('#ffffff');
      expect(card.correct).toBe(0);
    });

    it('returns object with required back side properties', () => {
      const card = $eXeFlipCards.getCardDefault();
      expect(card.urlBk).toBe('');
      expect(card.audioBk).toBe('');
      expect(card.xBk).toBe(0);
      expect(card.yBk).toBe(0);
      expect(card.authorBk).toBe('');
      expect(card.altBk).toBe('');
      expect(card.eTextBk).toBe('');
      expect(card.colorBk).toBe('#000000');
      expect(card.backcolorBk).toBe('#ffffff');
    });

    it('returns new object on each call', () => {
      const card1 = $eXeFlipCards.getCardDefault();
      const card2 = $eXeFlipCards.getCardDefault();
      expect(card1).not.toBe(card2);
      expect(card1).toEqual(card2);
    });
  });

  describe('getTimeToStringMemory', () => {
    it('formats zero seconds', () => {
      expect($eXeFlipCards.getTimeToStringMemory(0)).toBe('00:00');
    });

    it('formats seconds only', () => {
      expect($eXeFlipCards.getTimeToStringMemory(30)).toBe('00:30');
      expect($eXeFlipCards.getTimeToStringMemory(59)).toBe('00:59');
    });

    it('formats minutes and seconds', () => {
      expect($eXeFlipCards.getTimeToStringMemory(60)).toBe('01:00');
      expect($eXeFlipCards.getTimeToStringMemory(90)).toBe('01:30');
      expect($eXeFlipCards.getTimeToStringMemory(125)).toBe('02:05');
    });

    it('pads single digits with zeros', () => {
      expect($eXeFlipCards.getTimeToStringMemory(65)).toBe('01:05');
    });

    it('handles large values', () => {
      expect($eXeFlipCards.getTimeToStringMemory(3599)).toBe('59:59');
    });
  });

  describe('hexToRgba', () => {
    it('converts 6-digit hex to rgba', () => {
      expect($eXeFlipCards.hexToRgba('#ff0000', 1)).toBe('rgba(255,0,0,1)');
      expect($eXeFlipCards.hexToRgba('#00ff00', 1)).toBe('rgba(0,255,0,1)');
      expect($eXeFlipCards.hexToRgba('#0000ff', 1)).toBe('rgba(0,0,255,1)');
    });

    it('handles hex without hash', () => {
      expect($eXeFlipCards.hexToRgba('ff0000', 1)).toBe('rgba(255,0,0,1)');
    });

    it('applies opacity parameter', () => {
      expect($eXeFlipCards.hexToRgba('#ff0000', 0.5)).toBe('rgba(255,0,0,0.5)');
      expect($eXeFlipCards.hexToRgba('#ff0000', 0)).toBe('rgba(255,0,0,0)');
    });

    it('defaults to opacity 1 if not finite', () => {
      expect($eXeFlipCards.hexToRgba('#ff0000', undefined)).toBe('rgba(255,0,0,1)');
    });

    it('converts 3-digit hex to rgba', () => {
      expect($eXeFlipCards.hexToRgba('#f00', 1)).toBe('rgba(255,0,0,1)');
      expect($eXeFlipCards.hexToRgba('#0f0', 1)).toBe('rgba(0,255,0,1)');
    });

    it('handles white and black', () => {
      expect($eXeFlipCards.hexToRgba('#ffffff', 1)).toBe('rgba(255,255,255,1)');
      expect($eXeFlipCards.hexToRgba('#000000', 1)).toBe('rgba(0,0,0,1)');
    });
  });

  describe('borderColors', () => {
    it('has required color definitions', () => {
      expect($eXeFlipCards.borderColors).toBeDefined();
      expect($eXeFlipCards.borderColors.black).toBe('#1c1b1b');
      expect($eXeFlipCards.borderColors.blue).toBe('#3334a1');
      expect($eXeFlipCards.borderColors.green).toBe('#006641');
      expect($eXeFlipCards.borderColors.red).toBe('#a2241a');
      expect($eXeFlipCards.borderColors.white).toBe('#ffffff');
      expect($eXeFlipCards.borderColors.yellow).toBe('#f3d55a');
    });
  });

  describe('options', () => {
    it('is initialized as array', () => {
      expect(Array.isArray($eXeFlipCards.options)).toBe(true);
    });
  });

  describe('idevicePath', () => {
    it('is initially empty', () => {
      expect($eXeFlipCards.idevicePath).toBe('');
    });
  });

  /**
   * Completion signal.
   *
   * The runtime decides whether a page may be reported passed/failed from what the
   * activity says about itself (`gameOver`), not from the score it sends. The four
   * authored modes end differently: 0 (Show) and 1 (Navigation) are "flip every card"
   * tasks whose end condition is the visited score reaching 10, while 2 (Identify) and
   * 3 (Memory) finish through gameOver()/gameOverMemory(), which raise the flag
   * themselves before reporting.
   */
  describe('sendScore completion signal', () => {
    /**
     * Minimal instance state: sendScore only reads the mode, the flipped card
     * numbers, the hit count and the card count.
     *
     * @param {object} state mode and progress of the authored activity
     * @returns {number} the instance index to pass to sendScore
     */
    function givenInstance({ type, visiteds = [], hits = 0, cards }) {
      $eXeFlipCards.options = [{ type, visiteds, hits, realNumberCards: cards }];
      return 0;
    }

    it('reports the fraction of cards flipped in Navigation mode', () => {
      $eXeFlipCards.sendScore(true, givenInstance({ type: 1, visiteds: [0], cards: 4 }));

      expect(scoreCalls).toHaveLength(1);
      expect(scoreCalls[0].game.scorerp).toBe(2.5);
    });

    it('does not mark a Navigation activity finished while cards remain unflipped', () => {
      $eXeFlipCards.sendScore(true, givenInstance({ type: 1, visiteds: [0], cards: 4 }));

      expect(scoreCalls[0].game.gameOver).toBeUndefined();
    });

    it('does not count the same card twice towards the end condition', () => {
      $eXeFlipCards.sendScore(true, givenInstance({ type: 1, visiteds: [2, 2, 2, 2], cards: 4 }));

      expect(scoreCalls[0].game.scorerp).toBe(2.5);
      expect(scoreCalls[0].game.gameOver).toBeUndefined();
    });

    it('marks a Navigation activity finished once every card has been flipped', () => {
      // 4 of 4 flipped: score 10 of 10, and the activity is over. Without the flag
      // the page stays `incomplete` in the LMS at 100%.
      $eXeFlipCards.sendScore(true, givenInstance({ type: 1, visiteds: [0, 1, 2, 3], cards: 4 }));

      expect(scoreCalls[0].game.scorerp).toBe(10);
      expect(scoreCalls[0].game.gameOver).toBe(true);
    });

    it('marks a Show activity finished once every card has been flipped', () => {
      $eXeFlipCards.sendScore(true, givenInstance({ type: 0, visiteds: [1, 0], cards: 2 }));

      expect(scoreCalls[0].game.scorerp).toBe(10);
      expect(scoreCalls[0].game.gameOver).toBe(true);
    });

    it('leaves an Identify activity to its own gameOver(), even on a perfect intermediate report', () => {
      // validateReponseGame() reports after every answer and gameOver() runs later,
      // so an intermediate report must never complete the activity by itself.
      $eXeFlipCards.sendScore(true, givenInstance({ type: 2, hits: 4, cards: 4 }));

      expect(scoreCalls[0].game.scorerp).toBe('10.00');
      expect(scoreCalls[0].game.gameOver).toBeUndefined();
    });

    it('leaves a Memory activity to its own gameOverMemory()', () => {
      // correctPairMemory() reports on every matched pair; gameOverMemory() owns the flag.
      $eXeFlipCards.sendScore(true, givenInstance({ type: 3, hits: 4, cards: 4 }));

      expect(scoreCalls[0].game.gameOver).toBeUndefined();
    });

    it('carries a flag already raised by the mode-specific game over into the report', () => {
      const instance = givenInstance({ type: 3, hits: 4, cards: 4 });
      $eXeFlipCards.options[instance].gameOver = true;

      $eXeFlipCards.sendScore(true, instance);

      expect(scoreCalls[0].game.gameOver).toBe(true);
    });
  });

  // An untimed memory game starts itself while the page loads, and that start
  // hides the cover — wiping out the code dialog that had just been put up.
  // The learner played without a code and only met the dialog when the cover
  // came back at game over.
  describe('an untimed memory game behind an access code', () => {
    const instance = 0;

    function givenMemoryGame(overrides) {
      document.body.innerHTML = `
        <div id="flcdsMainContainer-${instance}">
          <div id="flcdsCubierta-${instance}">
            <div id="flcdsCodeAccessDiv-${instance}">
              <div id="flcdsMesajeAccesCodeE-${instance}"></div>
              <input id="flcdsCodeAccessE-${instance}" value="abre" />
            </div>
          </div>
          <div id="flcdsStartLevels-${instance}"></div>
        </div>`;
      $eXeFlipCards.options[instance] = Object.assign(
        {
          id: instance,
          type: 3,
          time: 0,
          author: '',
          fullscreen: false,
          itinerary: { showCodeAccess: true, codeAccess: 'abre' },
          msgs: {},
        },
        overrides
      );
      vi.spyOn($eXeFlipCards, 'startGameMemory').mockImplementation(() => {});
      return instance;
    }

    afterEach(() => {
      document.body.innerHTML = '';
      vi.restoreAllMocks();
    });

    it('starts the game when the code is accepted, and publishes', () => {
      $eXeFlipCards.enterCodeAccess(givenMemoryGame());

      // The second argument is the whole point: without it startGameMemory
      // starts the game silently and the LMS keeps the previous attempt's
      // grade until a card is turned.
      expect($eXeFlipCards.startGameMemory).toHaveBeenCalledWith(instance, true);
      expect($(`#flcdsCodeAccessDiv-${instance}`).css('display')).toBe('none');
      expect($(`#flcdsCubierta-${instance}`).css('display')).toBe('none');
    });

    it('starts nothing when the code is wrong', () => {
      const i = givenMemoryGame();
      $(`#flcdsCodeAccessE-${i}`).val('nope');

      $eXeFlipCards.enterCodeAccess(i);

      expect($eXeFlipCards.startGameMemory).not.toHaveBeenCalled();
      expect($(`#flcdsCodeAccessE-${i}`).val()).toBe('');
    });

    // A valid code stands in for the play button, as it does in every other
    // timed iDevice. It used to only uncover the board, leaving the learner in
    // front of a button they had already earned and the LMS with nothing.
    it('starts a timed memory game too, rather than revealing its play button', () => {
      $eXeFlipCards.enterCodeAccess(givenMemoryGame({ time: 2 }));

      expect($eXeFlipCards.startGameMemory).toHaveBeenCalledWith(instance, true);
    });

    // The load path is where the defect lived: it started the game itself and
    // the start hid the dialog on its way in.
    it('does not start itself while the page loads', () => {
      const i = givenMemoryGame();
      $exeDevices.iDevice.gamification.scorm.registerActivity = vi.fn();

      $eXeFlipCards.addEvents(i);

      expect($eXeFlipCards.startGameMemory).not.toHaveBeenCalled();
      expect($(`#flcdsCubierta-${i}`).css('display')).not.toBe('none');
      expect($(`#flcdsCodeAccessDiv-${i}`).css('display')).not.toBe('none');
    });

    it('still starts itself when there is no code in front of it', () => {
      const i = givenMemoryGame({
        itinerary: { showCodeAccess: false, codeAccess: '' },
      });
      $exeDevices.iDevice.gamification.scorm.registerActivity = vi.fn();

      $eXeFlipCards.addEvents(i);

      expect($eXeFlipCards.startGameMemory).toHaveBeenCalledWith(i);
    });

    // Only the memory mode waits to be started. Every other mode is live from
    // the moment the page loads, so the code has nothing to start — but it is
    // still the learner's first interaction, and nothing published for it.
    it.each([1, 2])('publishes the opening zero for a live mode %i', (type) => {
      const i = givenMemoryGame({ type, isScorm: 1 });
      const sendScore = vi.spyOn($eXeFlipCards, 'sendScore').mockImplementation(() => {});

      $eXeFlipCards.enterCodeAccess(i);

      expect(sendScore).toHaveBeenCalledWith(true, i);
      expect($eXeFlipCards.startGameMemory).not.toHaveBeenCalled();
    });

    it('publishes nothing for a live mode outside automatic SCORM', () => {
      const i = givenMemoryGame({ type: 1, isScorm: 2 });
      const sendScore = vi.spyOn($eXeFlipCards, 'sendScore').mockImplementation(() => {});

      $eXeFlipCards.enterCodeAccess(i);

      expect(sendScore).not.toHaveBeenCalled();
    });
  });

  // The report has to come from the learner's own start, never from the
  // automatic one an untimed memory game gets while the page loads: that would
  // score a page the learner has merely opened.
  describe('the opening zero of a memory game', () => {
    const instance = 0;

    function givenStartableGame(overrides) {
      document.body.innerHTML = `
        <div id="flcdsMainContainer-${instance}">
          <div id="flcdsMultimedia-${instance}"></div>
          <div id="flcdsStartLevels-${instance}"></div>
          <div id="flcdsCubierta-${instance}"></div>
          <div id="flcdsGameOver-${instance}"></div>
          <div id="flcdsMessage-${instance}"></div>
          <div id="flcdsPHits-${instance}"></div>
          <div id="flcdsPNumber-${instance}"></div>
          <div id="flcdsPShowClue-${instance}"></div>
          <div id="flcdsShowClue-${instance}"></div>
          <div id="flcdsPTime-${instance}"></div>
        </div>`;
      $eXeFlipCards.options[instance] = Object.assign(
        {
          id: instance,
          type: 3,
          time: 0,
          isScorm: 1,
          gameStarted: false,
          cardsGame: [],
          realNumberCards: 0,
          showCards: false,
          itinerary: {},
          msgs: {},
        },
        overrides
      );
      vi.spyOn($eXeFlipCards, 'addCardsMemory').mockImplementation(() => {});
      vi.spyOn($eXeFlipCards, 'initCardsMemory').mockImplementation(() => {});
      vi.spyOn($eXeFlipCards, 'refreshCards').mockImplementation(() => {});
      vi.spyOn($eXeFlipCards, 'refreshCardsMemory').mockImplementation(() => {});
      vi.spyOn($eXeFlipCards, 'showMessageMemory').mockImplementation(() => {});
      vi.spyOn($eXeFlipCards, 'updateTimeMemory').mockImplementation(() => {});
      return instance;
    }

    afterEach(() => {
      document.body.innerHTML = '';
      vi.restoreAllMocks();
    });

    it('is published when the start was asked for', () => {
      const i = givenStartableGame();
      const sendScore = vi.spyOn($eXeFlipCards, 'sendScore').mockImplementation(() => {});

      $eXeFlipCards.startGameMemory(i, true);

      expect(sendScore).toHaveBeenCalledWith(true, i);
    });

    it('stays silent when the page started the game by itself', () => {
      const i = givenStartableGame();
      const sendScore = vi.spyOn($eXeFlipCards, 'sendScore').mockImplementation(() => {});

      $eXeFlipCards.startGameMemory(i);

      expect(sendScore).not.toHaveBeenCalled();
      // Silent, but started: the board is playable and the first card's report
      // will carry, since sendScoreNew drops an unstarted game.
      expect($eXeFlipCards.options[i].gameStarted).toBe(true);
    });

    it('does not report in manual SCORM mode', () => {
      const i = givenStartableGame({ isScorm: 2 });
      const sendScore = vi.spyOn($eXeFlipCards, 'sendScore').mockImplementation(() => {});

      $eXeFlipCards.startGameMemory(i, true);

      expect(sendScore).not.toHaveBeenCalled();
    });

    // addCardsMemory has just replaced every card, so the sizing pass that
    // follows has to be the memory one. refreshCards looks for
    // `.FLCDSP-CardDraw`, which this mode never builds: it matched nothing and
    // the new cards kept the stylesheet's 2.5em, spilling over the edge.
    it('sizes the cards it has just built', () => {
      const i = givenStartableGame();

      $eXeFlipCards.startGameMemory(i);

      expect($eXeFlipCards.refreshCardsMemory).toHaveBeenCalledWith(i);
      expect($eXeFlipCards.refreshCards).not.toHaveBeenCalled();
    });

    // Play again is the learner's own start, like the play button and the
    // access code, and it resets the board and the score. Rebooting silently
    // left the LMS holding the finished attempt's mark and status while a
    // fresh game sat at zero on screen — and a learner who walked away there
    // left the previous grade standing.
    describe('playing again reports the restart', () => {
      it('memory mode reboots through the reporting start', () => {
        const i = givenStartableGame({ gameStarted: true, hits: 4, score: 100, gameOver: true });
        // rebootGameMemory stops any card audio on its way out.
        $exeDevices.iDevice.gamification.media = { stopSound: vi.fn() };
        vi.spyOn($eXeFlipCards, 'startGameMemory').mockImplementation(() => {});

        $eXeFlipCards.rebootGameMemory(i);

        expect($eXeFlipCards.startGameMemory).toHaveBeenCalledWith(i, true);
      });

      it('card modes report the restart themselves', () => {
        // rebootGame does not go through startGameMemory.
        const i = givenStartableGame({ type: 1, gameStarted: true, hits: 4, score: 100, gameOver: true });
        document.body.innerHTML += `
          <div id="flcdsPErrors-${i}"></div>
          <div id="flcdsPScore-${i}"></div>
          <div id="flcdsLinkV-${i}"></div>
          <div id="flcdsLinkF-${i}"></div>`;
        vi.spyOn($eXeFlipCards, 'refreshGame').mockImplementation(() => {});
        const sendScore = vi.spyOn($eXeFlipCards, 'sendScore').mockImplementation(() => {});

        $eXeFlipCards.rebootGame(i);

        expect(sendScore).toHaveBeenCalledWith(true, i);
        // The report has to describe the restart, not the attempt it replaces:
        // sendScoreNew drops an unstarted game and derives completion from
        // gameOver, so both flags are set before it goes out.
        expect($eXeFlipCards.options[i]).toMatchObject({ score: 0, gameStarted: true, gameOver: false });
      });
    });
  });

  // The text of a card is sized by measurement, and every way that measurement
  // can lie ends the same way: text too big for the card, clipped by the
  // `overflow: hidden` on the box.
  describe('fitting the text to the card', () => {
    /**
     * A text block standing in for `.FLCDSP-ETextDinamyc`. Neither happy-dom
     * nor jsdom lays anything out, so the two figures the fit reads —
     * the block's scroll width and its own height — are supplied here.
     *
     * @param {object} box - scrollWidth and outerHeight of the block, in px.
     * @returns {object} Something `textOverflows` can measure.
     */
    function givenTextBlock({ scrollWidth = 0, outerHeight = 0 }) {
      return { 0: { scrollWidth }, outerHeight: () => outerHeight };
    }

    describe('textOverflows', () => {
      // The defect this replaced: the block is `width: 100%`, so outerWidth()
      // reports the container's width no matter how far a word runs past it.
      // "electroencefalografista" at 26px needs ~262px of a 184px card.
      it('catches a word too long to fit, which the block width hides', () => {
        const $text = givenTextBlock({ scrollWidth: 262, outerHeight: 30 });

        expect($eXeFlipCards.textOverflows($text, 184, 134)).toBe(true);
      });

      it('catches text that has wrapped past the bottom', () => {
        const $text = givenTextBlock({ scrollWidth: 180, outerHeight: 210 });

        expect($eXeFlipCards.textOverflows($text, 184, 134)).toBe(true);
      });

      it('accepts text that fits', () => {
        const $text = givenTextBlock({ scrollWidth: 180, outerHeight: 60 });

        expect($eXeFlipCards.textOverflows($text, 184, 134)).toBe(false);
      });

      // scrollWidth is a rounded integer, so a fractional container would
      // otherwise report a sub-pixel overflow and shrink the text for nothing.
      it('does not read a rounded-up scroll width as overflow', () => {
        const $text = givenTextBlock({ scrollWidth: 184, outerHeight: 60 });

        expect($eXeFlipCards.textOverflows($text, 183.5, 134)).toBe(false);
      });
    });

    describe('adjustFontSize', () => {
      /**
       * @param {object} card - text of the card and, when it has one, the size
       * of its box. A box without a size stands for a hidden card.
       * @returns {jQuery} The container to fit.
       */
      function givenCard({ text = 'electroencefalografista', box = '' }) {
        document.body.innerHTML = `
          <div class="FLCDSP-EText" style="${box}">
            <div class="FLCDSP-ETextDinamyc">${text}</div>
          </div>`;
        return $('.FLCDSP-EText');
      }

      afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
      });

      // The regression: a hidden card measures zero in jQuery 3, both loops of
      // the old fit were skipped, and the text kept the 26px maximum the
      // function had just stamped on it. Sizing nothing is the honest outcome —
      // the stylesheet's own size still applies.
      it('leaves a card it cannot measure alone', () => {
        const $container = givenCard({});

        expect($eXeFlipCards.adjustFontSize($container)).toBe(false);
        expect($container.find('.FLCDSP-ETextDinamyc')[0].style.fontSize).toBe('');
      });

      it('shrinks until the text fits', () => {
        const $container = givenCard({ box: 'width:184px;height:134px;' });
        vi.spyOn($eXeFlipCards, 'textOverflows').mockImplementation(($text) =>
          parseFloat($text.css('font-size')) > 18
        );

        expect($eXeFlipCards.adjustFontSize($container)).toBe(true);
        expect($container.find('.FLCDSP-ETextDinamyc').css('font-size')).toBe('18px');
      });

      it('stops at the minimum rather than shrinking away', () => {
        const $container = givenCard({ box: 'width:184px;height:134px;' });
        vi.spyOn($eXeFlipCards, 'textOverflows').mockReturnValue(true);

        $eXeFlipCards.adjustFontSize($container);

        expect($container.find('.FLCDSP-ETextDinamyc').css('font-size')).toBe('10px');
      });

      it('has nothing to fit on a card that carries only an image', () => {
        const $container = givenCard({ text: '   ', box: 'width:184px;height:134px;' });
        const overflows = vi.spyOn($eXeFlipCards, 'textOverflows');

        expect($eXeFlipCards.adjustFontSize($container)).toBe(false);
        expect(overflows).not.toHaveBeenCalled();
      });

      it('reaches for the hidden card behind a zero measurement', () => {
        const $container = givenCard({});
        const measureVisible = vi.spyOn($eXeFlipCards, 'measureVisible');

        $eXeFlipCards.adjustFontSize($container);

        expect(measureVisible).toHaveBeenCalledTimes(1);
      });
    });

    describe('measureVisible', () => {
      afterEach(() => {
        document.body.innerHTML = '';
      });

      /**
       * @returns {jQuery} A box inside a card the mode has hidden.
       */
      function givenHiddenCard() {
        document.body.innerHTML = `
          <div class="FLCDSP-CardDraw" style="display:none">
            <div class="FLCDSP-EText"></div>
          </div>`;
        return $('.FLCDSP-EText');
      }

      it('lifts the hiding on the way in and puts it back on the way out', () => {
        const $box = givenHiddenCard();
        const $card = $('.FLCDSP-CardDraw');

        const seen = $eXeFlipCards.measureVisible($box, () =>
          window.getComputedStyle($card[0]).display
        );

        expect(seen).not.toBe('none');
        expect($card[0].style.display).toBe('none');
      });

      // A card hidden by the stylesheet rather than inline must not come back
      // with an inline `display` the stylesheet never asked for.
      it('leaves no inline display behind', () => {
        const $box = givenHiddenCard();
        $('.FLCDSP-CardDraw')[0].style.display = '';
        document.head.innerHTML = '<style>.FLCDSP-CardDraw{display:none}</style>';

        $eXeFlipCards.measureVisible($box, () => null);

        expect($('.FLCDSP-CardDraw')[0].style.display).toBe('');
        document.head.innerHTML = '';
      });

      it('puts the hiding back even when the measurement throws', () => {
        const $box = givenHiddenCard();

        expect(() =>
          $eXeFlipCards.measureVisible($box, () => {
            throw new Error('no layout');
          })
        ).toThrow('no layout');
        expect($('.FLCDSP-CardDraw')[0].style.display).toBe('none');
      });

      it('measures an empty selection without touching the tree', () => {
        expect($eXeFlipCards.measureVisible($('.nothing-here'), () => 'done')).toBe('done');
      });
    });

    // A card can carry a formula on one face and plain text on the other. The
    // back used to be decided by reading the front's content, which sized half
    // of them by the wrong rule.
    describe('fitTextBox', () => {
      afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
      });

      /**
       * @param {string} back - content of the card's back face.
       * @returns {object} The spies each rule was routed through.
       */
      function givenCardWithMathsOnTheBack(back) {
        document.body.innerHTML = `
          <div id="flcdsMultimedia-0">
            <div class="FLCDSP-CardDraw">
              <div class="FLCDSP-FlipCardFront">
                <div class="FLCDSP-EText"><div class="FLCDSP-ETextDinamyc">Energía</div></div>
              </div>
              <div class="FLCDSP-FlipCardBack">
                <div class="FLCDSP-EText"><div class="FLCDSP-ETextDinamyc">${back}</div></div>
              </div>
            </div>
          </div>`;
        $exeDevices.iDevice.gamification.math = {
          hasLatex: (text) => /\\\(|\\\[|\\begin\{|\$\$/.test(text),
        };
        return {
          measured: vi.spyOn($eXeFlipCards, 'adjustFontSize').mockReturnValue(true),
          byCardCount: vi.spyOn($eXeFlipCards, 'setFontSizeMath').mockImplementation(() => {}),
        };
      }

      it('sizes each face by its own content', () => {
        const { measured, byCardCount } = givenCardWithMathsOnTheBack('\\(E=mc^2\\)');

        $eXeFlipCards.setFontSize(0);

        expect(measured).toHaveBeenCalledTimes(1);
        expect(measured.mock.calls[0][0].text().trim()).toBe('Energía');
        expect(byCardCount).toHaveBeenCalledTimes(1);
        expect(byCardCount.mock.calls[0][0].text().trim()).toBe('\\(E=mc^2\\)');
      });

      it('measures both faces when neither holds a formula', () => {
        const { measured, byCardCount } = givenCardWithMathsOnTheBack('Masa por c al cuadrado');

        $eXeFlipCards.setFontSize(0);

        expect(measured).toHaveBeenCalledTimes(2);
        expect(byCardCount).not.toHaveBeenCalled();
      });
    });
  });
});
