/**
 * Unit tests for crossword iDevice (export/runtime)
 *
 * Covers the pure helpers and the crossing-maximising layout generator
 * (generateLayout / canPlaceWord / countCrossings / buildGridFromPlacements).
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $eXeCrucigrama globally.
 * Replaces 'var $eXeCrucigrama' with 'global.$eXeCrucigrama' to make it accessible.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$eXeCrucigrama\s*=/, 'global.$eXeCrucigrama =');
  // Remove auto-init call: $(function () { $eXeCrucigrama.init(); });
  modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeCrucigrama\.init\(\);\s*\}\);?/g, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$eXeCrucigrama;
}

const emptyGrid = (size) =>
  Array(size)
    .fill()
    .map(() => Array(size).fill(null));

// Write a vertical word straight into a grid (test fixture).
const putVertical = (grid, word, row, col) => {
  for (let i = 0; i < word.length; i++) {
    grid[row + i][col] = { letter: word[i], vi: 0, lvi: i, hi: -1 };
  }
};

// Write a horizontal word straight into a grid (test fixture).
const putHorizontal = (grid, word, row, col) => {
  for (let i = 0; i < word.length; i++) {
    grid[row][col + i] = { letter: word[i], hi: 0, lhi: i, vi: -1 };
  }
};

describe('crossword iDevice export', () => {
  let $eXeCrucigrama;

  beforeEach(() => {
    global.$eXeCrucigrama = undefined;

    const filePath = join(__dirname, 'crossword.js');
    const code = readFileSync(filePath, 'utf-8');

    $eXeCrucigrama = loadExportIdevice(code);
  });

  describe('shuffleArray', () => {
    it('returns array of same length', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = $eXeCrucigrama.shuffleArray([...arr]);
      expect(result.length).toBe(arr.length);
    });

    it('contains all original elements', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = $eXeCrucigrama.shuffleArray([...arr]);
      expect(result.sort()).toEqual(arr.sort());
    });

    it('handles empty array', () => {
      expect($eXeCrucigrama.shuffleArray([])).toEqual([]);
    });

    it('handles single element array', () => {
      expect($eXeCrucigrama.shuffleArray([1])).toEqual([1]);
    });
  });

  describe('clear', () => {
    it('trims whitespace', () => {
      expect($eXeCrucigrama.clear('  hello  ')).toBe('hello');
    });

    it('normalizes multiple spaces to single space', () => {
      expect($eXeCrucigrama.clear('hello   world')).toBe('hello world');
    });

    it('handles newlines and carriage returns', () => {
      expect($eXeCrucigrama.clear('hello\nworld')).toBe('hello world');
      expect($eXeCrucigrama.clear('hello\r\nworld')).toBe('hello world');
    });

    it('handles empty string', () => {
      expect($eXeCrucigrama.clear('')).toBe('');
    });
  });

  describe('colors', () => {
    it('has required color definitions', () => {
      expect($eXeCrucigrama.colors).toBeDefined();
      expect($eXeCrucigrama.colors.correct).toBe('#3DA75A');
      expect($eXeCrucigrama.colors.incorrect).toBe('#F22420');
    });
  });

  describe('init / enable', () => {
    it('exist as functions', () => {
      expect(typeof $eXeCrucigrama.init).toBe('function');
      expect(typeof $eXeCrucigrama.enable).toBe('function');
    });
  });

  describe('options / caches', () => {
    it('are initialized empty', () => {
      expect($eXeCrucigrama.options).toEqual([]);
      expect($eXeCrucigrama.domCache).toEqual({});
      expect($eXeCrucigrama.inputCache).toEqual({});
    });
  });

  describe('boardSize / maxWords', () => {
    it('defaults to a 16x16 board capped at 16 words', () => {
      expect($eXeCrucigrama.boardSize).toBe(16);
      expect($eXeCrucigrama.maxWords).toBe(16);
    });
  });

  describe('applyBoardLayout', () => {
    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('derives the CSS grid tracks and variable from boardSize', () => {
      document.body.innerHTML =
        '<div id="ccgmCrossword-0" class="CCGMP-Crucigrama"></div>';
      $eXeCrucigrama.options[0] = { boardSize: 16 };
      $eXeCrucigrama.initDOMCache(0);

      $eXeCrucigrama.applyBoardLayout(0);

      const el = document.getElementById('ccgmCrossword-0');
      expect(el.style.gridTemplateColumns).toBe('repeat(16, 1fr)');
      expect(el.style.gridTemplateRows).toBe('repeat(16, 1fr)');
      expect(el.style.getPropertyValue('--ccgm-board-size')).toBe('16');
    });

    it('reflects any board size (not coupled to the default)', () => {
      document.body.innerHTML =
        '<div id="ccgmCrossword-0" class="CCGMP-Crucigrama"></div>';
      $eXeCrucigrama.options[0] = { boardSize: 12 };
      $eXeCrucigrama.initDOMCache(0);

      $eXeCrucigrama.applyBoardLayout(0);

      const el = document.getElementById('ccgmCrossword-0');
      expect(el.style.gridTemplateColumns).toBe('repeat(12, 1fr)');
    });
  });

  describe('canPlaceWord', () => {
    const setup = (grid, size) => {
      $eXeCrucigrama.options[0] = { boardSize: size, grid };
    };

    it('accepts a free placement with empty separators', () => {
      const grid = emptyGrid(10);
      setup(grid, 10);
      expect($eXeCrucigrama.canPlaceWord(0, 'AT', 2, 2, true, grid)).toBe(true);
    });

    it('(A) rejects a word flush before/after another word', () => {
      const grid = emptyGrid(10);
      grid[2][1] = { letter: 'B', vi: 0, hi: -1 };
      setup(grid, 10);
      expect($eXeCrucigrama.canPlaceWord(0, 'AT', 2, 2, true, grid)).toBe(false);

      const grid2 = emptyGrid(10);
      grid2[2][4] = { letter: 'X', vi: 0, hi: -1 };
      setup(grid2, 10);
      expect($eXeCrucigrama.canPlaceWord(0, 'AT', 2, 2, true, grid2)).toBe(false);
    });

    it('cannot start on an occupied cell', () => {
      const grid = emptyGrid(10);
      grid[2][2] = { letter: 'Z', vi: 0, hi: -1 };
      setup(grid, 10);
      expect($eXeCrucigrama.canPlaceWord(0, 'AT', 2, 2, true, grid)).toBe(false);
    });

    it('accepts an interior crossing with a matching letter', () => {
      const grid = emptyGrid(10);
      putVertical(grid, 'CAT', 5, 3); // C A T at col 3
      setup(grid, 10);
      // BAT crosses the A at (6,3)
      expect($eXeCrucigrama.canPlaceWord(0, 'BAT', 6, 2, true, grid)).toBe(true);
    });

    it('rejects a crossing with a mismatched letter', () => {
      const grid = emptyGrid(10);
      putVertical(grid, 'CAT', 5, 3);
      setup(grid, 10);
      // "BOT" would put O on the A at (6,3)
      expect($eXeCrucigrama.canPlaceWord(0, 'BOT', 6, 2, true, grid)).toBe(false);
    });

    it('rejects overlapping a parallel word', () => {
      const grid = emptyGrid(10);
      putHorizontal(grid, 'CAT', 2, 2); // horizontal at row 2
      setup(grid, 10);
      // Another horizontal over the same cells (parallel overlap, not a crossing)
      expect($eXeCrucigrama.canPlaceWord(0, 'CAR', 2, 2, true, grid)).toBe(false);
    });

    it('(B) rejects a horizontal cell touching a column top/bottom sideways', () => {
      const grid = emptyGrid(10);
      putVertical(grid, 'CAT', 5, 3); // rows 5..7
      setup(grid, 10);
      // (4,3) is directly above the column start, (8,3) below its end.
      expect($eXeCrucigrama.canPlaceWord(0, 'XY', 4, 3, true, grid)).toBe(false);
      expect($eXeCrucigrama.canPlaceWord(0, 'XY', 8, 3, true, grid)).toBe(false);
    });

    it('(B) works symmetrically for vertical words', () => {
      const grid = emptyGrid(10);
      putHorizontal(grid, 'CAT', 5, 3); // cols 3..5 at row 5
      setup(grid, 10);
      // A vertical at col 2 next to the row start, and col 6 next to its end.
      expect($eXeCrucigrama.canPlaceWord(0, 'XY', 5, 2, false, grid)).toBe(false);
      expect($eXeCrucigrama.canPlaceWord(0, 'XY', 5, 6, false, grid)).toBe(false);
    });

    it('accepts a vertical word that genuinely crosses a horizontal', () => {
      const grid = emptyGrid(10);
      putHorizontal(grid, 'CAT', 5, 2); // C A T at (5,2)(5,3)(5,4)
      setup(grid, 10);
      // "XAY" crosses the A at (5,3) vertically.
      expect($eXeCrucigrama.canPlaceWord(0, 'XAY', 4, 3, false, grid)).toBe(true);
    });

    it('respects the board edges', () => {
      const grid = emptyGrid(3);
      setup(grid, 3);
      expect($eXeCrucigrama.canPlaceWord(0, 'ABC', 1, 0, true, grid)).toBe(true);
      expect($eXeCrucigrama.canPlaceWord(0, 'ABCD', 0, 0, true, grid)).toBe(false);
    });
  });

  describe('countCrossings', () => {
    it('counts matching perpendicular cells for a horizontal word', () => {
      const grid = emptyGrid(10);
      putVertical(grid, 'CAT', 5, 3);
      expect($eXeCrucigrama.countCrossings('BAT', 6, 2, true, grid)).toBe(1);
      expect($eXeCrucigrama.countCrossings('BOX', 0, 0, true, grid)).toBe(0);
    });

    it('counts matching perpendicular cells for a vertical word', () => {
      const grid = emptyGrid(10);
      putHorizontal(grid, 'CAT', 5, 2);
      // Vertical crossing the A at (5,3).
      expect($eXeCrucigrama.countCrossings('XAY', 4, 3, false, grid)).toBe(1);
    });
  });

  describe('buildGridFromPlacements', () => {
    it('rebuilds grid/wordsGame/mappedWords grouped verticals-first', () => {
      const mOptions = {
        boardSize: 10,
        wordsGame: [{ word: 'CAT' }, { word: 'RAT' }],
        grid: emptyGrid(10),
        mappedWords: [],
        half: 0,
      };
      $eXeCrucigrama.options[0] = mOptions;

      // CAT vertical at col 3 rows 2..4; RAT horizontal at row 3 cols 2..4.
      // They cross on the shared 'A' at (3,3).
      const placements = [
        { index: 0, row: 2, col: 3, horizontal: false, crossings: 1 },
        { index: 1, row: 3, col: 2, horizontal: true, crossings: 1 },
      ];

      $eXeCrucigrama.buildGridFromPlacements(0, placements);

      expect(mOptions.half).toBe(1); // one vertical
      expect(mOptions.wordsGame.map((w) => w.word)).toEqual(['CAT', 'RAT']);
      expect(mOptions.numberQuestions).toBe(2);

      const g = mOptions.grid;
      expect(g[2][3].vi).toBe(0); // vertical CAT -> index 0
      expect(g[3][2].hi).toBe(1); // horizontal RAT -> index half(1)+0
      // crossing cell carries both orientations
      expect(g[3][3].vi).toBe(0);
      expect(g[3][3].hi).toBe(1);

      // letters consistent with mappedWords
      mOptions.mappedWords.forEach((cells, wi) => {
        const word = mOptions.wordsGame[wi].word;
        cells.forEach(({ row, col }, i) => {
          expect(g[row][col].letter).toBe(word[i]);
        });
      });
    });

    it('drops unplaced words (only placements survive)', () => {
      const mOptions = {
        boardSize: 10,
        wordsGame: [{ word: 'CAT' }, { word: 'XYZ' }, { word: 'RAT' }],
        grid: emptyGrid(10),
        mappedWords: [],
        half: 0,
      };
      $eXeCrucigrama.options[0] = mOptions;

      // Only CAT and RAT placed; XYZ (index 1) is omitted.
      $eXeCrucigrama.buildGridFromPlacements(0, [
        { index: 0, row: 2, col: 3, horizontal: false, crossings: 0 },
        { index: 2, row: 3, col: 2, horizontal: true, crossings: 1 },
      ]);

      expect(mOptions.wordsGame.map((w) => w.word)).toEqual(['CAT', 'RAT']);
      expect(mOptions.wordsGame).toHaveLength(2);
    });
  });

  describe('bestFreePosition (fallback fill)', () => {
    it('seats a word in free space on an empty board', () => {
      const grid = emptyGrid(10);
      $eXeCrucigrama.options[0] = { boardSize: 10, grid };
      const pos = $eXeCrucigrama.bestFreePosition(0, 'HELLO', grid);
      expect(pos).not.toBeNull();
      expect(
        $eXeCrucigrama.canPlaceWord(
          0,
          'HELLO',
          pos.row,
          pos.col,
          pos.horizontal,
          grid
        )
      ).toBe(true);
    });

    it('prefers a crossing position when one exists', () => {
      const grid = emptyGrid(12);
      putVertical(grid, 'CAT', 4, 5); // C A T at col 5
      $eXeCrucigrama.options[0] = { boardSize: 12, grid };
      const pos = $eXeCrucigrama.bestFreePosition(0, 'BAT', grid);
      expect(pos.crossings).toBeGreaterThanOrEqual(1);
    });
  });

  describe('generateLayout (crossing-maximising solver)', () => {
    function runLayout(words) {
      const mOptions = {
        boardSize: $eXeCrucigrama.boardSize,
        half: 0,
        wordsGame: words.map((word) => ({ word })),
        grid: [],
        mappedWords: [],
        occupiedRows: new Set(),
        occupiedColumns: new Set(),
      };
      $eXeCrucigrama.options[0] = mOptions;
      $eXeCrucigrama.generateLayout(0);
      return mOptions;
    }

    function analyze(mOptions) {
      const B = mOptions.boardSize,
        g = mOptions.grid,
        n = mOptions.wordsGame.length;
      const hasLetter = (r, c) =>
        r >= 0 && r < B && c >= 0 && c < B && g[r][c] && g[r][c].letter;
      const isV = (r, c) =>
        hasLetter(r, c) && g[r][c].vi !== undefined && g[r][c].vi !== -1;
      const isH = (r, c) =>
        hasLetter(r, c) && g[r][c].hi !== undefined && g[r][c].hi !== -1;

      let crossings = 0,
        stale = 0,
        mism = 0,
        flush = 0;
      const adj = Array.from({ length: n }, () => new Set());

      for (let r = 0; r < B; r++) {
        for (let c = 0; c < B; c++) {
          const cell = g[r][c];
          if (!cell) continue;
          const hH = isH(r, c),
            hV = isV(r, c);
          if (hH && hV) {
            crossings++;
            adj[cell.hi].add(cell.vi);
            adj[cell.vi].add(cell.hi);
          }
          const wi = hH ? cell.hi : cell.vi;
          if (!mOptions.wordsGame[wi]) {
            stale++;
            continue;
          }
          const li = hH ? cell.lhi : cell.lvi;
          if (mOptions.wordsGame[wi].word[li] !== cell.letter) mism++;

          // (A)/(B): a non-crossing cell must not touch another word sideways.
          if (!(hH && hV)) {
            if (hH && (isV(r - 1, c) || isV(r + 1, c))) flush++;
            if (hV && (isH(r, c - 1) || isH(r, c + 1))) flush++;
          }
        }
      }

      // connectivity: components of the crossing graph
      const seen = new Array(n).fill(false);
      let comp = 0;
      for (let i = 0; i < n; i++) {
        if (seen[i]) continue;
        comp++;
        const st = [i];
        seen[i] = true;
        while (st.length) {
          const x = st.pop();
          adj[x].forEach((y) => {
            if (!seen[y]) {
              seen[y] = true;
              st.push(y);
            }
          });
        }
      }
      return { n, crossings, comp, stale, mism, flush };
    }

    it('places every word (crossing or isolated) with crossings and no flush', () => {
      // Run several times: the layout is randomized, invariants must always hold.
      for (let t = 0; t < 8; t++) {
        const mOptions = runLayout([
          'ARIZONA',
          'NEWYORK',
          'ATHENS',
          'PARIS',
          'AGRA',
        ]);
        const a = analyze(mOptions);
        expect(a.n).toBe(5); // the fallback seats every word in free space
        expect(a.comp).toBeGreaterThanOrEqual(1); // crossings keep it connected
        expect(a.crossings).toBeGreaterThanOrEqual(1);
        expect(a.stale).toBe(0); // no dangling word indices
        expect(a.mism).toBe(0); // grid letters match the words
        expect(a.flush).toBe(0); // no fake words glued together
      }
    });

    it('places all 10 words, keeping the rules (no flush, consistent)', () => {
      const words = [
        'CASA',
        'PERRO',
        'GATO',
        'SOL',
        'LUNA',
        'ARBOL',
        'RIO',
        'MAR',
        'MONTE',
        'NUBE',
      ];
      for (let t = 0; t < 6; t++) {
        const mOptions = runLayout(words);
        const a = analyze(mOptions);
        expect(a.n).toBe(10); // every word seated (crossing or in free space)
        expect(a.crossings).toBeGreaterThanOrEqual(1);
        expect(a.stale).toBe(0);
        expect(a.mism).toBe(0);
        expect(a.flush).toBe(0);
      }
    });

    it('handles a single word (seed only) without crossings', () => {
      const mOptions = runLayout(['HELLO']);
      expect(mOptions.wordsGame).toHaveLength(1);
      const a = analyze(mOptions);
      expect(a.comp).toBe(1);
      expect(a.stale).toBe(0);
    });

    it('handles an empty word list', () => {
      const mOptions = runLayout([]);
      expect(mOptions.wordsGame).toHaveLength(0);
    });
  });

  describe('SCORM reporting from explicit controls', () => {
    function setupGame(overrides = {}) {
      $exeDevices.iDevice.gamification.media = {
        stopSound: vi.fn(),
      };
      $exeDevices.iDevice.gamification.report = {
        saveEvaluation: vi.fn(),
        updateEvaluationIcon: vi.fn(),
      };
      $exeDevices.iDevice.gamification.helpers.getTimeToString = vi.fn(
        () => '00:00'
      );
      $eXeCrucigrama.options[0] = Object.assign(
        {
          isScorm: 1,
          main: 'ccgmMainContainer-0',
          gameStarted: false,
          gameOver: false,
          hits: 0,
          score: 0,
          time: 0,
          wordsGame: [{ word: 'uno' }, { word: 'dos' }],
          numberQuestions: 2,
          modeGame: true,
          mappedWords: [],
          grid: [],
          caseSensitive: false,
          tilde: true,
          showSolution: false,
          itinerary: { showClue: false, showCodeAccess: false },
          feedBack: false,
          activeQuestion: -1,
          wordIndex: 0,
          word: 0,
          half: 1,
          hasBack: false,
          authorBackImage: '',
          msgs: {
            msgSelectWord: 'select',
            msgGameOver: 'Score %s %s %s',
            msgYouScore: 'Score',
          },
        },
        overrides
      );
      vi.spyOn($eXeCrucigrama, 'sendScore').mockImplementation(() => {});
    }

    afterEach(() => {
      document.body.innerHTML = '';
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('saveScormScore reports only in automatic SCORM mode', () => {
      setupGame({ isScorm: 1 });
      $eXeCrucigrama.saveScormScore(0);
      expect($eXeCrucigrama.sendScore).toHaveBeenCalledWith(true, 0);

      $eXeCrucigrama.sendScore.mockClear();
      $eXeCrucigrama.options[0].isScorm = 2;
      $eXeCrucigrama.saveScormScore(0);
      expect($eXeCrucigrama.sendScore).not.toHaveBeenCalled();
    });

    it('does not publish a score when the crossword starts automatically', () => {
      setupGame({ gameStarted: false, gameOver: true, hits: 2, score: 10 });

      $eXeCrucigrama.startGame(0);

      expect($eXeCrucigrama.sendScore).not.toHaveBeenCalled();
      expect($eXeCrucigrama.options[0].hits).toBe(0);
      expect($eXeCrucigrama.options[0].gameOver).toBe(false);
      expect($eXeCrucigrama.options[0].gameStarted).toBe(true);
    });

    it('publishes the cleared state when the play button starts the crossword', () => {
      setupGame({ gameStarted: false, gameOver: true, hits: 2, score: 10 });
      let stateWhenReported;
      $eXeCrucigrama.sendScore.mockImplementation(() => {
        const { hits, gameOver, gameStarted } = $eXeCrucigrama.options[0];
        stateWhenReported = { hits, gameOver, gameStarted };
      });

      $eXeCrucigrama.startGame(0, true);

      expect(stateWhenReported).toEqual({
        hits: 0,
        gameOver: false,
        gameStarted: true,
      });
    });

    it('publishes the cleared state when a finished game is restarted', () => {
      setupGame({ gameStarted: false, gameOver: true, hits: 2, score: 10 });
      $exeDevices.iDevice.gamification.helpers.shuffleAds = vi.fn((items) => items);
      vi.spyOn($eXeCrucigrama, 'cleanupInstance').mockImplementation(() => {});
      vi.spyOn($eXeCrucigrama, 'generateCrossword').mockImplementation(() => {});
      vi.spyOn($eXeCrucigrama, 'modeCrossword').mockImplementation(() => {});
      let stateWhenReported;
      $eXeCrucigrama.sendScore.mockImplementation(() => {
        const { hits, gameOver, gameStarted } = $eXeCrucigrama.options[0];
        stateWhenReported = { hits, gameOver, gameStarted };
      });

      $eXeCrucigrama.repeatActivity(0, true);

      expect(stateWhenReported).toEqual({
        hits: 0,
        gameOver: false,
        gameStarted: true,
      });
    });

    // A finished attempt always reports. gameOver() is reached from the check
    // button and from the countdown running out, never while the page loads,
    // so it carries no opt-in: a caller that forgot one would drop the
    // learner's final grade silently.
    it('reports whenever the attempt finishes', () => {
      setupGame({ hits: 1 });
      vi.spyOn($eXeCrucigrama, 'highlightWord').mockImplementation(() => {});
      vi.spyOn($eXeCrucigrama, 'saveEvaluation').mockImplementation(() => {});
      vi.spyOn($eXeCrucigrama, 'showFeedBack').mockImplementation(() => {});

      $eXeCrucigrama.gameOver(0);

      expect($eXeCrucigrama.sendScore).toHaveBeenCalledWith(true, 0);
    });

    it('checks and reports the score when time expires', () => {
      setupGame({ time: 1 / 60 });
      vi.useFakeTimers();
      document.body.innerHTML = `
        <div id="ccgmMainContainer-0">
          <div id="ccgmGameContainer-0">
            <span class="exeQuextIcons-Time"></span>
          </div>
          <div id="ccgmCrossword-0"></div>
          <span id="ccgmPTime-0"></span>
        </div>`;
      vi.spyOn($eXeCrucigrama, 'verifyCrossword').mockImplementation(() => {});

      $eXeCrucigrama.startGame(0);
      vi.advanceTimersByTime(1000);

      expect($eXeCrucigrama.verifyCrossword).toHaveBeenCalledWith(0);
    });

    it('passes explicit reporting from the interactive buttons', () => {
      setupGame({ isScorm: 0, time: 1 });
      document.body.innerHTML = `
        <div class="idevice_node">
          <div id="ccgmMainContainer-0">
            <a id="ccgmStartGame-0" href="#"></a>
            <a id="ccgmCheck-0" href="#"></a>
            <a id="ccgmReboot-0" href="#"></a>
          </div>
        </div>`;
      vi.spyOn($eXeCrucigrama, 'startGame').mockImplementation(() => {});
      vi.spyOn($eXeCrucigrama, 'verifyCrossword').mockImplementation(() => {});
      vi.spyOn($eXeCrucigrama, 'repeatActivity').mockImplementation(() => {});

      $eXeCrucigrama.addEvents(0);
      $('#ccgmStartGame-0').trigger('click');
      $('#ccgmCheck-0').trigger('click');
      $('#ccgmReboot-0').trigger('click');

      expect($eXeCrucigrama.startGame).toHaveBeenCalledWith(0, true);
      expect($eXeCrucigrama.repeatActivity).toHaveBeenCalledWith(0, true);
      // Checking always reports, so it needs no opt-in from the button.
      expect($eXeCrucigrama.verifyCrossword).toHaveBeenCalledWith(0);
    });

    it('does not report a game that was already running', () => {
      setupGame({ gameStarted: true });

      $eXeCrucigrama.startGame(0, true);

      expect($eXeCrucigrama.sendScore).not.toHaveBeenCalled();
    });

    // Unlocking with the access code is the learner opening the attempt, so it
    // reports like the play button — a board behind a code never starts on its
    // own, and without this the LMS kept the previous attempt's grade until the
    // learner checked the crossword.
    it('publishes the cleared state when a valid access code opens the board', () => {
      setupGame({ gameStarted: false, gameOver: true, hits: 2, score: 10 });
      document.body.innerHTML = `
        <div id="ccgmMainContainer-0">
          <a id="ccgmLinkMaximize-0" href="#"></a>
          <input id="ccgmCodeAccessE-0" value="AbrE" />
        </div>`;
      $eXeCrucigrama.options[0].itinerary.codeAccess = 'abre';
      vi.spyOn($eXeCrucigrama, 'showCubiertaOptions').mockImplementation(
        () => {}
      );
      vi.spyOn($eXeCrucigrama, 'startGame').mockImplementation(() => {});

      $eXeCrucigrama.enterCodeAccess(0);

      expect($eXeCrucigrama.startGame).toHaveBeenCalledWith(0, true);
    });

    // Without a countdown there is no play button, so the code is the only
    // explicit start the learner ever gives: it has to publish the zero and
    // leave the attempt unfinished.
    it('publishes a zero and an unfinished attempt when the code opens an untimed board', () => {
      setupGame({ time: 0, gameStarted: false, gameOver: true, hits: 2, score: 10 });
      $eXeCrucigrama.options[0].itinerary.codeAccess = 'abre';
      document.body.innerHTML = `
        <div id="ccgmMainContainer-0">
          <a id="ccgmLinkMaximize-0" href="#"></a>
          <div id="ccgmCrossword-0"></div>
          <input id="ccgmCodeAccessE-0" value="abre" />
        </div>`;
      vi.spyOn($eXeCrucigrama, 'showCubiertaOptions').mockImplementation(
        () => {}
      );
      let stateWhenReported;
      $eXeCrucigrama.sendScore.mockImplementation(() => {
        const { hits, score, gameOver, gameStarted } =
          $eXeCrucigrama.options[0];
        stateWhenReported = { hits, score, gameOver, gameStarted };
      });

      $eXeCrucigrama.enterCodeAccess(0);

      expect(stateWhenReported).toEqual({
        hits: 0,
        score: 0,
        gameOver: false,
        gameStarted: true,
      });
    });

    // The load-time guard used to read mOptions.showCodeAccess, a key nothing
    // sets. An untimed crossword therefore started itself behind its own cover,
    // and the code entry above hit startGame's early return in silence.
    it('leaves an untimed board behind an access code unstarted while the page loads', () => {
      setupGame({
        time: 0,
        itinerary: {
          showClue: false,
          showCodeAccess: true,
          codeAccess: 'abre',
          messageCodeAccess: 'code',
        },
      });
      document.body.innerHTML = `
        <div class="idevice_node">
          <div id="ccgmMainContainer-0">
            <div id="ccgmCodeAccessDiv-0"></div>
            <div id="ccgmMesajeAccesCodeE-0"></div>
            <input id="ccgmCodeAccessE-0" value="" />
          </div>
        </div>`;
      vi.spyOn($eXeCrucigrama, 'showCubiertaOptions').mockImplementation(
        () => {}
      );
      $exeDevices.iDevice.gamification.scorm.registerActivity = vi.fn();

      $eXeCrucigrama.addEvents(0);

      // gameStarted, not sendScore: the load path never passes reportScorm, so
      // asserting on the report would pass with the bug still in place.
      expect($eXeCrucigrama.options[0].gameStarted).toBe(false);
    });

    it('does not start or report when the access code is wrong', () => {
      setupGame({ gameStarted: false, gameOver: true, hits: 2, score: 10 });
      document.body.innerHTML = `
        <div id="ccgmMainContainer-0">
          <a id="ccgmLinkMaximize-0" href="#"></a>
          <div id="ccgmMesajeAccesCodeE-0"></div>
          <input id="ccgmCodeAccessE-0" value="nope" />
        </div>`;
      $eXeCrucigrama.options[0].itinerary.codeAccess = 'abre';
      vi.spyOn($eXeCrucigrama, 'startGame').mockImplementation(() => {});

      $eXeCrucigrama.enterCodeAccess(0);

      expect($eXeCrucigrama.startGame).not.toHaveBeenCalled();
      expect($('#ccgmCodeAccessE-0').val()).toBe('');
    });
  });
});
