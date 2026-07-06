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

  it('finalizes the activity (gameOver) when the manual save button triggers sendScore', () => {
    const originalPipwerks = global.pipwerks;
    const originalGgb = global.ggbApplet;
    const originalScorm = $exeDevices.iDevice.gamification.scorm;
    const sendScoreNew = vi.fn();
    $exeDevices.iDevice.gamification.scorm = { sendScoreNew };
    global.pipwerks = { SCORM: { SetScoreMax: vi.fn(), SetScoreMin: vi.fn() } };
    global.ggbApplet = { exists: () => false, getValue: () => 0 };

    try {
      $geogebraactivity.sendScore({ main: '#x', ideviceNumber: 1, weighted: 100, msgs: {} });

      // Pressing the save button finalizes the activity on the first save.
      expect(sendScoreNew).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ gameStarted: true, gameOver: true }),
      );
    } finally {
      global.pipwerks = originalPipwerks;
      global.ggbApplet = originalGgb;
      $exeDevices.iDevice.gamification.scorm = originalScorm;
    }
  });

  it('only finalizes on first save; subsequent saves update score without changing state', () => {
    const originalPipwerks = global.pipwerks;
    const originalGgb = global.ggbApplet;
    const originalScorm = $exeDevices.iDevice.gamification.scorm;
    const sendScoreNew = vi.fn();
    $exeDevices.iDevice.gamification.scorm = { sendScoreNew };
    global.pipwerks = { SCORM: { SetScoreMax: vi.fn(), SetScoreMin: vi.fn() } };
    global.ggbApplet = { exists: () => false, getValue: () => 0 };

    try {
      const options = { main: '#x', ideviceNumber: 1, weighted: 100, msgs: {} };
      // First save: gameOver = true (marks activity as completed)
      $geogebraactivity.sendScore(options);
      // Second save: gameOver = false (just updates score, doesn't change terminal state)
      $geogebraactivity.sendScore(options);

      expect(sendScoreNew).toHaveBeenCalledTimes(2);

      // First call should finalize
      expect(sendScoreNew.mock.calls[0][0]).toBe(false); // auto === false -> manual save
      expect(sendScoreNew.mock.calls[0][1]).toEqual(
        expect.objectContaining({ gameStarted: true, gameOver: true }),
      );

      // Second call should not finalize (prevent re-evaluation in Moodle)
      expect(sendScoreNew.mock.calls[1][0]).toBe(false); // auto === false -> manual save
      expect(sendScoreNew.mock.calls[1][1]).toEqual(
        expect.objectContaining({ gameStarted: true, gameOver: false }),
      );
    } finally {
      global.pipwerks = originalPipwerks;
      global.ggbApplet = originalGgb;
      $exeDevices.iDevice.gamification.scorm = originalScorm;
    }
  });
});
