/**
 * Unit tests for GeoGebra activity iDevice (export/runtime)
 */

/* eslint-disable no-undef */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
  const modifiedCode = code
    .replace(/var\s+\$geogebraactivity\s*=/, 'global.$geogebraactivity =')
    .replace(/\$\(function\s*\(\)\s*\{\s*\$geogebraactivity\.init\(\);\s*\}\);?\s*$/g, '');

  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$geogebraactivity;
}

describe('geogebra-activity iDevice (export)', () => {
  let $geogebraactivity;

  beforeEach(() => {
    global.$geogebraactivity = undefined;
    document.body.innerHTML = '';

    const filePath = join(__dirname, 'geogebra-activity.js');
    const code = readFileSync(filePath, 'utf-8');
    $geogebraactivity = loadExportIdevice(code);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    global.$geogebraactivity = undefined;
  });

  it('renders title when showTitle is enabled in saved metadata', () => {
    const author = escape('Ada Lovelace');
    const titleUrl = escape('https://www.geogebra.org/m/VgHhQXCC');
    const title = escape('Pendiente de una recta');
    const authLabel = escape('Authorship');
    const titleLabel = escape('Title');

    document.body.innerHTML = `
      <div class="auto-geogebra auto-geogebra-VgHhQXCC">
        <div class="auto-geogebra-author js-hidden">${author},${titleUrl},${title},1,${authLabel},1,${titleLabel}</div>
      </div>
    `;

    $geogebraactivity.activities = $('.auto-geogebra');
    $geogebraactivity.indicator.start();

    const titleNode = document.querySelector('.auto-geogebra-title');
    expect(titleNode).not.toBeNull();
    expect(titleNode.textContent).toContain('Title');
    expect(titleNode.textContent).toContain('Pendiente de una recta');
  });

  it('does not render title when showTitle is disabled', () => {
    const author = escape('Ada Lovelace');
    const titleUrl = escape('https://www.geogebra.org/m/VgHhQXCC');
    const title = escape('Pendiente de una recta');
    const authLabel = escape('Authorship');
    const titleLabel = escape('Title');

    document.body.innerHTML = `
      <div class="auto-geogebra auto-geogebra-VgHhQXCC">
        <div class="auto-geogebra-author js-hidden">${author},${titleUrl},${title},1,${authLabel},0,${titleLabel}</div>
      </div>
    `;

    $geogebraactivity.activities = $('.auto-geogebra');
    $geogebraactivity.indicator.start();

    expect(document.querySelector('.auto-geogebra-title')).toBeNull();
  });

  it('keeps legacy compatibility: 5-field metadata still shows title', () => {
    const author = escape('Ada Lovelace');
    const titleUrl = escape('https://www.geogebra.org/m/VgHhQXCC');
    const title = escape('Pendiente de una recta');
    const authLabel = escape('Authorship');

    document.body.innerHTML = `
      <div class="auto-geogebra auto-geogebra-VgHhQXCC">
        <div class="auto-geogebra-author js-hidden">${author},${titleUrl},${title},1,${authLabel}</div>
      </div>
    `;

    $geogebraactivity.activities = $('.auto-geogebra');
    $geogebraactivity.indicator.start();

    const titleNode = document.querySelector('.auto-geogebra-title');
    expect(titleNode).not.toBeNull();
    expect(titleNode.textContent).toContain('Pendiente de una recta');
  });

  it('renders authorship when showAuthor is enabled', () => {
    const author = escape('Ada Lovelace');
    const titleUrl = escape('https://www.geogebra.org/m/VgHhQXCC');
    const title = escape('Pendiente de una recta');
    const authLabel = escape('Authorship');
    const titleLabel = escape('Title');

    document.body.innerHTML = `
      <div class="auto-geogebra auto-geogebra-VgHhQXCC">
        <div class="auto-geogebra-author js-hidden">${author},${titleUrl},${title},1,${authLabel},1,${titleLabel}</div>
      </div>
    `;

    $geogebraactivity.activities = $('.auto-geogebra');
    $geogebraactivity.indicator.start();

    const authorNode = document.querySelector('.auto-geogebra-author');
    expect(authorNode).not.toBeNull();
    expect(authorNode.textContent).toContain('Authorship');
    expect(authorNode.textContent).toContain('Ada Lovelace');
  });

  it('does not render authorship when showAuthor is disabled', () => {
    const author = escape('Ada Lovelace');
    const titleUrl = escape('https://www.geogebra.org/m/VgHhQXCC');
    const title = escape('Pendiente de una recta');
    const authLabel = escape('Authorship');
    const titleLabel = escape('Title');

    document.body.innerHTML = `
      <div class="auto-geogebra auto-geogebra-VgHhQXCC">
        <div class="auto-geogebra-author js-hidden">${author},${titleUrl},${title},0,${authLabel},1,${titleLabel}</div>
      </div>
    `;

    $geogebraactivity.activities = $('.auto-geogebra');
    $geogebraactivity.indicator.start();

    expect(document.querySelector('.auto-geogebra-author')).toBeNull();
    expect(document.querySelector('.auto-geogebra-title')).not.toBeNull();
  });

  it('targets the GeoGebra iDevice body for report icons', () => {
    document.body.innerHTML = `
      <div class="idevice_body geogebra-activityIdevice">
        <div id="geogebra-1" class="idevice_node geogebra-activity">
          <div id="auto-geogebra-VgHhQXCC0"></div>
        </div>
      </div>
    `;

    const options = $geogebraactivity.getOptions(
      'VgHhQXCC0',
      100,
      [],
      'evaluation-1',
    );

    expect(options.id).toBe('geogebra-1');
    expect(options.main).toBe('auto-geogebra-VgHhQXCC0');
    expect(options.idevice).toBe('geogebra-activityIdevice');
  });

  it('does not enable report icons when the saved evaluation id is disabled', () => {
    document.body.innerHTML = `
      <div class="idevice_body geogebra-activityIdevice">
        <div id="geogebra-1" class="idevice_node geogebra-activity">
          <div id="auto-geogebra-VgHhQXCC0"></div>
        </div>
      </div>
    `;

    const options = $geogebraactivity.getOptions('VgHhQXCC0', 100, [], '0');

    expect(options.evaluation).toBe(false);
    expect(options.evaluationID).toBe('');
  });

  it('removes stale report icons when report tracking is disabled', () => {
    document.body.innerHTML = `
      <div class="idevice_body geogebra-activityIdevice">
        <div id="ac-geogebra-1"></div>
        <div class="Games-ReportIconDiv"></div>
        <div id="geogebra-1" class="idevice_node geogebra-activity">
          <div id="auto-geogebra-VgHhQXCC0"></div>
        </div>
      </div>
    `;

    $geogebraactivity.removeEvaluationIcon({
      id: 'geogebra-1',
      main: 'auto-geogebra-VgHhQXCC0',
      idevice: 'geogebra-activityIdevice',
    });

    expect(document.querySelector('.Games-ReportIconDiv')).toBeNull();
    expect(document.getElementById('ac-geogebra-1')).toBeNull();
  });

  it('addActivity applies the configured width and height to the GeoGebra applet', () => {
    const previousGGBApplet = global.GGBApplet;
    const previousReport = $exeDevices.iDevice.gamification.report;
    const capturedParams = [];

    vi.useFakeTimers();
    global.GGBApplet = vi.fn(function (parameters) {
      capturedParams.push(parameters);
      this.inject = vi.fn();
    });
    $exeDevices.iDevice.gamification.report = { updateEvaluationIcon: vi.fn() };

    document.body.innerHTML = `
      <div class="idevice_body geogebra-activityIdevice">
        <div id="geogebra-1" class="idevice_node geogebra-activity">
          <div class="auto-geogebra auto-geogebra-VgHhQXCC auto-geogebra-width-800 auto-geogebra-height-600"></div>
        </div>
      </div>
    `;

    try {
      const activity = document.querySelector('.auto-geogebra');
      $geogebraactivity.addActivity(
        activity,
        'VgHhQXCC',
        activity.className.split(' '),
        0,
      );
      vi.runAllTimers();

      expect(capturedParams[0].width).toBe(800);
      expect(capturedParams[0].height).toBe(600);
    } finally {
      vi.useRealTimers();
      global.GGBApplet = previousGGBApplet;
      $exeDevices.iDevice.gamification.report = previousReport;
    }
  });

  it('addActivity falls back to the default dimensions for legacy activities without size classes', () => {
    const previousGGBApplet = global.GGBApplet;
    const previousReport = $exeDevices.iDevice.gamification.report;
    const capturedParams = [];

    vi.useFakeTimers();
    global.GGBApplet = vi.fn(function (parameters) {
      capturedParams.push(parameters);
      this.inject = vi.fn();
    });
    $exeDevices.iDevice.gamification.report = { updateEvaluationIcon: vi.fn() };

    document.body.innerHTML = `
      <div class="idevice_body geogebra-activityIdevice">
        <div id="geogebra-1" class="idevice_node geogebra-activity">
          <div class="auto-geogebra auto-geogebra-VgHhQXCC"></div>
        </div>
      </div>
    `;

    try {
      const activity = document.querySelector('.auto-geogebra');
      $geogebraactivity.addActivity(
        activity,
        'VgHhQXCC',
        activity.className.split(' '),
        0,
      );
      vi.runAllTimers();

      expect(capturedParams[0].width).toBe($geogebraactivity.defaults.width);
      expect(capturedParams[0].height).toBe($geogebraactivity.defaults.height);
    } finally {
      vi.useRealTimers();
      global.GGBApplet = previousGGBApplet;
      $exeDevices.iDevice.gamification.report = previousReport;
    }
  });

  describe('indicator.getSize', () => {
    it('returns the configured width and height from the element classes', () => {
      const fakeElement = {
        className:
          'auto-geogebra auto-geogebra-VgHhQXCC auto-geogebra-width-800 auto-geogebra-height-600',
      };

      expect($geogebraactivity.indicator.getSize(fakeElement)).toEqual([800, 600]);
    });

    it('falls back to default dimensions when no size classes are present', () => {
      const fakeElement = { className: 'auto-geogebra auto-geogebra-VgHhQXCC' };

      expect($geogebraactivity.indicator.getSize(fakeElement)).toEqual([
        $geogebraactivity.defaults.width,
        $geogebraactivity.defaults.height,
      ]);
    });

    it('falls back to default dimensions for invalid (zero or non-numeric) size classes', () => {
      const fakeElement = {
        className:
          'auto-geogebra auto-geogebra-VgHhQXCC auto-geogebra-width-0 auto-geogebra-height-abc',
      };

      expect($geogebraactivity.indicator.getSize(fakeElement)).toEqual([
        $geogebraactivity.defaults.width,
        $geogebraactivity.defaults.height,
      ]);
    });
  });

  describe('parseSizeClasses', () => {
    it('parses valid width/height classes from an element', () => {
      const element = {
        className:
          'auto-geogebra auto-geogebra-VgHhQXCC auto-geogebra-width-800 auto-geogebra-height-600',
      };

      expect($geogebraactivity.parseSizeClasses(element)).toEqual([800, 600]);
    });

    it('parses valid width/height classes from a raw class string', () => {
      const classString = 'auto-geogebra auto-geogebra-width-320 auto-geogebra-height-240';

      expect($geogebraactivity.parseSizeClasses(classString)).toEqual([320, 240]);
    });

    it('parses valid width/height classes from an array of class tokens', () => {
      const classes = ['auto-geogebra', 'auto-geogebra-width-500', 'auto-geogebra-height-400'];

      expect($geogebraactivity.parseSizeClasses(classes)).toEqual([500, 400]);
    });

    it('falls back to defaults for garbage (zero or non-numeric) size classes', () => {
      const classString =
        'auto-geogebra auto-geogebra-width-0 auto-geogebra-height-abc';

      expect($geogebraactivity.parseSizeClasses(classString)).toEqual([
        $geogebraactivity.defaults.width,
        $geogebraactivity.defaults.height,
      ]);
    });

    it('falls back to defaults when size classes are missing', () => {
      expect($geogebraactivity.parseSizeClasses('auto-geogebra')).toEqual([
        $geogebraactivity.defaults.width,
        $geogebraactivity.defaults.height,
      ]);
    });
  });

  it('cleans stale report icons when the exported activity has evaluation id 0', () => {
    const previousGGBApplet = global.GGBApplet;
    const previousReport = $exeDevices.iDevice.gamification.report;
    const updateEvaluationIcon = vi.fn();

    vi.useFakeTimers();
    global.GGBApplet = vi.fn(function () {
      this.inject = vi.fn();
    });
    $exeDevices.iDevice.gamification.report = { updateEvaluationIcon };

    document.body.innerHTML = `
      <div class="idevice_body geogebra-activityIdevice">
        <div id="ac-geogebra-1"></div>
        <div class="Games-ReportIconDiv"></div>
        <div id="geogebra-1" class="idevice_node geogebra-activity">
          <div
            class="auto-geogebra auto-geogebra-VgHhQXCC auto-geogebra-evaluation-id-0 auto-geogebra-ideviceid-geogebra-1"
          ></div>
        </div>
      </div>
    `;

    try {
      const activity = document.querySelector('.auto-geogebra');
      $geogebraactivity.addActivity(
        activity,
        'VgHhQXCC',
        activity.className.split(' '),
        0,
      );
      vi.runAllTimers();

      expect(updateEvaluationIcon).not.toHaveBeenCalled();
      expect(document.querySelector('.Games-ReportIconDiv')).toBeNull();
      expect(document.getElementById('ac-geogebra-1')).toBeNull();
    } finally {
      vi.useRealTimers();
      global.GGBApplet = previousGGBApplet;
      $exeDevices.iDevice.gamification.report = previousReport;
    }
  });

  // The options literal used to declare msgYouScore twice, from two different
  // sources. The later one wins in JavaScript, so the effective value has
  // always come from the evaluation messages; this pins that, because dropping
  // the wrong one of the pair would have changed the label silently.
  describe('getOptions', () => {
    // msgs used to define msgYouScore twice — from messagesScorm[1], which is
    // what the editor writes 'Your score' into, and again from messagesEval[3],
    // which is the save button's caption. In an object literal the last wins,
    // so the correct one was shadowed and dead, and the score line read
    // "Save score: 6.67". Dropping the duplicate kept the winner.
    it('takes msgYouScore from the SCORM messages, where the editor puts it', () => {
      $geogebraactivity.messages = ['m0', 'm1', 'm2', 'button-caption'];

      const options = $geogebraactivity.getOptions(
        'a0',
        100,
        ['scorm0', 'your-score', 'scorm2', 'scorm3', 'scorm4'],
        ''
      );

      expect(options.msgs.msgYouScore).toBe('your-score');
      // [3] of the evaluation list is the button's caption, and that is the
      // only thing it feeds.
      expect(options.textButtonScorm).toBe('button-caption');
    });

    // The editor serialises the evaluation list as [0] incomplete, [1] passed,
    // [2] not passed. The two names were bound to the wrong slots, so the
    // progress report told a learner who passed that they had not — and paired
    // the message with the opposite icon, since showEvaluationIcon shows the
    // error icon with msgUnsuccessfulActivity and the success icon with
    // msgSuccessfulActivity.
    it('does not swap the pass and fail messages', () => {
      $geogebraactivity.messages = [
        'Incomplete activity',
        'Activity: Passed. Score: %s',
        'Activity: Not passed. Score: %s',
        'Save score',
      ];

      const options = $geogebraactivity.getOptions('a0', 100, [], '');

      expect(options.msgs.msgSuccessfulActivity).toBe('Activity: Passed. Score: %s');
      expect(options.msgs.msgUnsuccessfulActivity).toBe('Activity: Not passed. Score: %s');
      expect(options.msgs.msgUncompletedActivity).toBe('Incomplete activity');
    });

    it('does not swap them in the fallbacks either', () => {
      $geogebraactivity.messages = [];

      const options = $geogebraactivity.getOptions('a0', 100, [], '');

      expect(options.msgs.msgSuccessfulActivity).toContain('Passed');
      expect(options.msgs.msgSuccessfulActivity).not.toContain('Not passed');
      expect(options.msgs.msgUnsuccessfulActivity).toContain('Not passed');
    });

    // msgYouLastScore compared the value against the string 'undefined' where
    // its six siblings use typeof, so an absent message resolved to undefined
    // instead of the empty string every other message falls back to.
    it('falls back to an empty string for messages that were not supplied', () => {
      $geogebraactivity.messages = ['', '', '', ''];

      const options = $geogebraactivity.getOptions('a0', 100, [], '');

      expect(options.msgs.msgYouLastScore).toBe('');
      // The siblings, so the fallback stays uniform across all of them.
      expect(options.msgs.msgScoreScorm).toBe('');
      expect(options.msgs.msgScore).toBe('');
      expect(options.msgs.msgWeight).toBe('');
    });

    it('keeps a supplied last-score message', () => {
      $geogebraactivity.messages = ['', '', '', ''];

      const options = $geogebraactivity.getOptions(
        'a0',
        100,
        ['', '', '', '', 'última nota'],
        ''
      );

      expect(options.msgs.msgYouLastScore).toBe('última nota');
    });

    it('carries the applet suffix so the score is read from the right one', () => {
      $geogebraactivity.messages = ['', '', '', ''];

      const options = $geogebraactivity.getOptions('b1', 100, [], '');

      expect(options.appletSuffix).toBe('b1');
      expect(options.main).toBe('auto-geogebra-b1');
    });
  });

  // A page can carry several GeoGebra activities. The engine is loaded once
  // and publishes a single global `ggbApplet`, so reading the score from it
  // cannot tell the applets apart: with two scored activities both buttons
  // read the same construction.
  describe('reading the score from the right applet', () => {
    function fakeApplet(values) {
      return {
        exists: name => Object.prototype.hasOwnProperty.call(values, name),
        getValue: name => values[name],
      };
    }

    function scored(raw) {
      return fakeApplet({
        SCORMRawScore: raw,
        SCORMMinScore: 0,
        SCORMMaxScore: 100,
      });
    }

    afterEach(() => {
      delete global.ggbApplet;
    });

    it('captures each applet under its own suffix as it loads', () => {
      const previousGGBApplet = global.GGBApplet;
      const previousReport = $exeDevices.iDevice.gamification.report;
      const captured = [];

      vi.useFakeTimers();
      global.GGBApplet = vi.fn(function (parameters) {
        captured.push(parameters);
        this.inject = vi.fn();
      });
      $exeDevices.iDevice.gamification.report = { updateEvaluationIcon: vi.fn() };
      document.body.innerHTML = `
        <div class="idevice_body geogebra-activityIdevice">
          <div id="geogebra-1" class="idevice_node geogebra-activity">
            <div class="auto-geogebra auto-geogebra-AAA"></div>
          </div>
        </div>`;

      try {
        const activity = document.querySelector('.auto-geogebra');
        $geogebraactivity.addActivity(
          activity,
          'AAA',
          activity.className.split(' '),
          0,
        );
        vi.runAllTimers();

        // GeoGebra hands the applet its own API through this callback.
        const api = scored(50);
        captured[0].appletOnLoad(api);

        expect($geogebraactivity.applets.AAA0).toBe(api);
      } finally {
        vi.useRealTimers();
        global.GGBApplet = previousGGBApplet;
        $exeDevices.iDevice.gamification.report = previousReport;
      }
    });

    // The defect: two scored activities on one page must not share a score.
    it('gives each activity the score of its own construction', () => {
      $geogebraactivity.applets = { a0: scored(30), b1: scored(90) };
      global.ggbApplet = scored(30);

      expect(
        $geogebraactivity.getAppletScore({ appletSuffix: 'a0' })
      ).toBe('3.00');
      expect(
        $geogebraactivity.getAppletScore({ appletSuffix: 'b1' })
      ).toBe('9.00');
    });

    // A page with one activity, or an applet that loaded without firing the
    // callback, must keep behaving exactly as before.
    it('falls back to the global applet when none was captured', () => {
      $geogebraactivity.applets = {};
      global.ggbApplet = scored(70);

      expect($geogebraactivity.getApplet({ appletSuffix: 'x0' })).toBe(
        global.ggbApplet
      );
      expect($geogebraactivity.getAppletScore({ appletSuffix: 'x0' })).toBe(
        '7.00'
      );
    });

    it('answers null when there is no applet at all', () => {
      $geogebraactivity.applets = {};

      expect($geogebraactivity.getApplet({ appletSuffix: 'x0' })).toBeNull();
    });
  });

  // getValue() used to be read and formatted before exists() was checked, so a
  // construction without the SCORM variables threw on undefined.toFixed() —
  // and since the click handler runs sendScore() then saveEvaluation(), the
  // SCORM score was sent and the local record then never saved.
  describe('a construction without the SCORM variables', () => {
    afterEach(() => {
      delete global.ggbApplet;
    });

    it('scores 0 instead of throwing', () => {
      $geogebraactivity.applets = {
        z0: { exists: () => false, getValue: () => undefined },
      };

      expect(() =>
        $geogebraactivity.getAppletScore({ appletSuffix: 'z0' })
      ).not.toThrow();
      expect($geogebraactivity.getAppletScore({ appletSuffix: 'z0' })).toBe(
        '0.00'
      );
    });

    it('lets saveEvaluation record the attempt', () => {
      const previousReport = $exeDevices.iDevice.gamification.report;
      const saveEvaluation = vi.fn();
      $exeDevices.iDevice.gamification.report = { saveEvaluation };
      $geogebraactivity.applets = {
        z0: { exists: () => false, getValue: () => undefined },
      };

      try {
        expect(() =>
          $geogebraactivity.saveEvaluation({
            appletSuffix: 'z0',
            isInExe: false,
          })
        ).not.toThrow();
        expect(saveEvaluation).toHaveBeenCalledWith(
          expect.objectContaining({ scorerp: '0.00' }),
          false
        );
      } finally {
        $exeDevices.iDevice.gamification.report = previousReport;
      }
    });

    // A construction whose min and max are the same would divide by zero and
    // report NaN to the LMS.
    it('scores 0 for a degenerate score range', () => {
      $geogebraactivity.applets = {
        z0: {
          exists: () => true,
          getValue: name => (name === 'SCORMRawScore' ? 5 : 10),
        },
      };

      expect($geogebraactivity.getAppletScore({ appletSuffix: 'z0' })).toBe(
        '0.00'
      );
    });
  });

  // An applet has no end of its own — the learner can go on dragging the
  // construction — so saving is the only completion signal this activity has,
  // and it has to give it itself. The shared runtime decides completion from
  // gameOver alone and no longer infers it from the save button, so without
  // this the activity would never complete and its page would stay
  // `incomplete` however many times the learner saved.
  describe('sendScore', () => {
    let previousScorm;
    let previousPipwerks;
    let reported;

    beforeEach(() => {
      reported = [];
      previousScorm = $exeDevices.iDevice.gamification.scorm;
      previousPipwerks = global.pipwerks;
      $exeDevices.iDevice.gamification.scorm = {
        sendScoreNew: (auto, game) => reported.push({ auto, game }),
      };
      global.pipwerks = {
        SCORM: { SetScoreMax: () => {}, SetScoreMin: () => {} },
      };
      $geogebraactivity.applets = {
        z0: {
          exists: () => true,
          getValue: name =>
            ({ SCORMRawScore: 8, SCORMMinScore: 0, SCORMMaxScore: 10 })[name],
        },
      };
    });

    afterEach(() => {
      $exeDevices.iDevice.gamification.scorm = previousScorm;
      global.pipwerks = previousPipwerks;
    });

    it('declares the activity finished, because saving is its only end', () => {
      $geogebraactivity.sendScore({ appletSuffix: 'z0' });

      expect(reported).toHaveLength(1);
      expect(reported[0].auto).toBe(false);
      expect(reported[0].game.gameOver).toBe(true);
      expect(reported[0].game.gameStarted).toBe(true);
    });

    it('stands down without the SCORM wrapper', () => {
      delete global.pipwerks;

      $geogebraactivity.sendScore({ appletSuffix: 'z0' });

      expect(reported).toEqual([]);
    });
  });
});
